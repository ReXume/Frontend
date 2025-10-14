#!/usr/bin/env node
/**
 * PDF 렌더링 성능 비교 벤치마크
 * 
 * 일반 PDF vs 우선순위 큐 버전 성능 비교
 * - 렌더링 시간 측정
 * - 메인스레드 부하 측정 (Long Tasks)
 * - 메모리 사용량
 * - FPS 및 프레임 드롭
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// ============================================================================
// 설정
// ============================================================================

const CONFIG = {
  baseUrl: 'http://localhost:3000/feedback/4',
  versions: [
    { name: 'PDF (일반)', query: 'version=pdf', key: 'pdf' },
    { name: 'Queue (우선순위 큐)', query: 'version=queue', key: 'queue' }
  ],
  runs: parseInt(process.argv[2]) || 3,  // 실행 횟수
  waitAfterLoad: 2000,  // 초기 페이지 로드 대기 시간 (ms)
  measureInitialRender: true,  // 초기 렌더링 성능 측정
  targetPageMilestones: [1, 5, 10, 20],  // 측정할 페이지 마일스톤
  maxWaitTime: 20000,   // 최대 대기 시간 (20초, 스크롤 시간 포함)
  enableScroll: false,  // 스크롤 테스트 비활성화 (초기 렌더링 집중)
  cpuThrottle: 4,       // CPU 쓰로틀링 (4배 느림)
  headless: true        // Headless 모드
};

// ============================================================================
// 유틸리티 함수
// ============================================================================

function log(message, indent = 0) {
  const prefix = '  '.repeat(indent);
  console.log(`${prefix}${message}`);
}

function formatMs(ms) {
  return ms ? `${ms.toFixed(2)}ms` : 'N/A';
}

function formatMB(bytes) {
  return bytes ? `${(bytes / 1024 / 1024).toFixed(2)}MB` : 'N/A';
}

function calculateStats(values) {
  if (!values || values.length === 0) return null;
  
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = sum / values.length;
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];
  
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg,
    median
  };
}

// ============================================================================
// 성능 측정 함수
// ============================================================================

async function measureVersion(url, versionName, runNumber) {
  log(`Run ${runNumber}: ${versionName}`, 1);
  
  const browser = await puppeteer.launch({
    headless: CONFIG.headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security',
    ],
    defaultViewport: {
      width: 1920,
      height: 1080
    }
  });

  const page = await browser.newPage();
  
  // CPU 쓰로틀링 적용
  const client = await page.target().createCDPSession();
  await client.send('Emulation.setCPUThrottlingRate', { rate: CONFIG.cpuThrottle });
  
  // Performance Observer 활성화
  await client.send('Performance.enable');
  
  const metrics = {
    renderTime: null,
    longTasks: [],
    memoryUsage: null,
    fps: null,
    pdfPages: 0,
    totalBlockingTime: 0,
    timeToPage: {},  // 특정 페이지까지의 렌더링 시간
    renderSequence: []  // 렌더링 순서
  };

  // Long Task 추적
  const longTasks = [];
  
  // 페이지 메트릭 수집 준비
  await page.evaluateOnNewDocument(() => {
    window.__renderMetrics = {
      startTime: performance.now(),
      pdfRenderStart: null,
      pdfRenderEnd: null,
      pagesRendered: 0,
      longTasks: [],
      collectedMetrics: []  // PDF 컴포넌트에서 수집된 메트릭
    };

    // PDF 컴포넌트가 사용하는 메트릭 수집기 구현
    window.pdfRenderMetricsCollector = {
      metrics: [],
      add: function(metric) {
        console.log('✅ Metric collected:', metric.page, metric.totalMs + 'ms');
        this.metrics.push(metric);
        window.__renderMetrics.collectedMetrics.push(metric);
        
        // 첫 렌더링 시작 시간
        if (!window.__renderMetrics.pdfRenderStart) {
          window.__renderMetrics.pdfRenderStart = performance.now();
        }
        // 마지막 렌더링 종료 시간
        window.__renderMetrics.pdfRenderEnd = performance.now();
        window.__renderMetrics.pagesRendered++;
      }
    };

    // Long Task 감지
    if (window.PerformanceObserver) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) {  // 50ms 이상의 작업
              window.__renderMetrics.longTasks.push({
                name: entry.name,
                duration: entry.duration,
                startTime: entry.startTime
              });
            }
          }
        });
        observer.observe({ entryTypes: ['longtask', 'measure'] });
      } catch (e) {
        console.log('PerformanceObserver not fully supported');
      }
    }

    // Canvas 렌더링 감지 (백업용)
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(...args) {
      if (args[0] === '2d' && !this.__tracked) {
        this.__tracked = true;
      }
      return originalGetContext.apply(this, args);
    };
  });

  const navigationStart = Date.now();
  
  // 페이지 로드
  await page.goto(url, {
    waitUntil: 'networkidle0',
    timeout: 60000
  });

  // PDF 초기 렌더링 성능 측정
  log(`   ⏳ 초기 렌더링 성능 측정 중...`, 2);
  const renderStartTime = Date.now();
  let renderedCount = 0;
  const timeToPage = {};
  const milestones = [...CONFIG.targetPageMilestones].sort((a, b) => a - b);
  let achievedMilestones = new Set();
  
  // 초기 대기 (페이지 로드)
  await new Promise(resolve => setTimeout(resolve, CONFIG.waitAfterLoad));
  
  // 스크롤해서 페이지들을 viewport에 넣기 (PDF 컨테이너 직접 스크롤)
  log(`   📜 PDF 컨테이너 스크롤하면서 페이지 렌더링 트리거...`, 2);
  try {
    await page.evaluate(async () => {
      // PDF가 렌더링되는 스크롤 가능한 컨테이너 찾기
      const scrollContainer = Array.from(document.querySelectorAll('div'))
        .find(div => {
          const style = window.getComputedStyle(div);
          return style.overflowY === 'auto' && div.scrollHeight > div.clientHeight;
        });
      
      if (!scrollContainer) {
        console.log('⚠️ 스크롤 컨테이너를 찾을 수 없습니다. window를 스크롤합니다.');
        // 백업: window 스크롤
        const scrollHeight = document.documentElement.scrollHeight;
        const steps = 20;
        const stepSize = scrollHeight / steps;
        for (let i = 0; i <= steps; i++) {
          window.scrollTo(0, stepSize * i);
          await new Promise(r => setTimeout(r, 150));
        }
        return { success: true, container: 'window' };
      }
      
      console.log('✅ PDF 스크롤 컨테이너 찾음');
      const scrollHeight = scrollContainer.scrollHeight;
      const steps = 20;  // 20단계로 스크롤
      const stepSize = scrollHeight / steps;
      
      for (let i = 0; i <= steps; i++) {
        scrollContainer.scrollTop = stepSize * i;
        await new Promise(r => setTimeout(r, 150));  // 각 150ms씩 (총 3초)
      }
      
      return { success: true, container: 'div', scrollHeight };
    });
    log(`   ✅ 스크롤 완료`, 2);
  } catch (e) {
    log(`   ⚠️ 스크롤 에러 (무시): ${e.message}`, 2);
  }
  
  // 마일스톤 달성 확인 (폴링)
  const pollInterval = 500;  // 500ms마다 체크
  const maxTime = CONFIG.maxWaitTime;
  
  while (Date.now() - renderStartTime < maxTime) {
    const status = await page.evaluate(() => {
      const metrics = window.__renderMetrics?.collectedMetrics || [];
      return {
        collected: metrics.length,
        pages: metrics.map(m => m.page).sort((a, b) => a - b),
        allMetrics: metrics
      };
    });
    
    renderedCount = status.collected;
    
    // 각 마일스톤 달성 시간 기록
    for (const milestone of milestones) {
      if (!achievedMilestones.has(milestone) && renderedCount >= milestone) {
        const elapsed = Date.now() - renderStartTime;
        timeToPage[milestone] = elapsed;
        achievedMilestones.add(milestone);
        log(`   ⚡ ${milestone}페이지 렌더링 완료: ${elapsed}ms`, 2);
      }
    }
    
    // 모든 마일스톤 달성 시 종료
    if (achievedMilestones.size === milestones.length) {
      log(`   ✅ 모든 마일스톤 달성!`, 2);
      break;
    }
    
    // 일부라도 달성했는지 주기적으로 로그
    if (renderedCount > 0 && renderedCount % 5 === 0) {
      log(`   📊 진행: ${renderedCount}페이지 렌더링됨`, 2);
    }
    
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  
  // 달성하지 못한 마일스톤 처리
  for (const milestone of milestones) {
    if (!achievedMilestones.has(milestone)) {
      timeToPage[milestone] = null;  // 달성 실패
      log(`   ⚠️  ${milestone}페이지 마일스톤 미달성`, 2);
    }
  }
  
  metrics.timeToPage = timeToPage;
  
  log(`   📊 최종: ${renderedCount}개 페이지 렌더링 완료`, 2);

  // 메트릭 수집
  const pageMetrics = await page.evaluate(() => {
    return {
      renderMetrics: window.__renderMetrics,
      collectedMetrics: window.__renderMetrics.collectedMetrics || [],
      memory: performance.memory ? {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize
      } : null,
      navigation: performance.getEntriesByType('navigation')[0],
      canvasCount: document.querySelectorAll('canvas').length
    };
  });

  // 수집된 메트릭이 있으면 사용
  const collectedMetrics = pageMetrics.collectedMetrics;
  if (collectedMetrics.length > 0) {
    // 평균 렌더링 시간 계산
    const avgRenderTime = collectedMetrics.reduce((sum, m) => sum + (m.totalMs || 0), 0) / collectedMetrics.length;
    metrics.renderTime = avgRenderTime;
    metrics.renderCount = collectedMetrics.length;
    metrics.pdfRenderMetrics = collectedMetrics;  // 상세 메트릭 저장
    
    log(`   📊 ${collectedMetrics.length}개 페이지 렌더링 완료, 평균: ${avgRenderTime.toFixed(2)}ms`, 2);
  } else {
    // 수집된 메트릭이 없으면 기존 방식
    if (pageMetrics.renderMetrics.pdfRenderStart && pageMetrics.renderMetrics.pdfRenderEnd) {
      metrics.renderTime = pageMetrics.renderMetrics.pdfRenderEnd - pageMetrics.renderMetrics.pdfRenderStart;
    }
    log(`   ⚠️  메트릭이 수집되지 않았습니다`, 2);
  }

  metrics.longTasks = pageMetrics.renderMetrics.longTasks || [];
  metrics.totalBlockingTime = metrics.longTasks
    .filter(task => task.duration > 50)
    .reduce((sum, task) => sum + (task.duration - 50), 0);
  
  metrics.memoryUsage = pageMetrics.memory;
  metrics.pdfPages = pageMetrics.canvasCount;

  // FPS 측정 (스크롤 중)
  if (CONFIG.enableScroll) {
    const fpsData = await measureFPS(page);
    metrics.fps = fpsData;
  }

  // Chrome DevTools Protocol 메트릭
  const cdpMetrics = await client.send('Performance.getMetrics');
  const jsHeapSize = cdpMetrics.metrics.find(m => m.name === 'JSHeapUsedSize');
  const layoutCount = cdpMetrics.metrics.find(m => m.name === 'LayoutCount');
  
  metrics.layoutCount = layoutCount?.value || 0;
  metrics.jsHeapUsedSize = jsHeapSize?.value || 0;

  await browser.close();

  log(`✓ 완료 - 렌더링: ${formatMs(metrics.renderTime)}, 페이지: ${metrics.pdfPages}개`, 2);

  return metrics;
}

// 다양한 스크롤 시나리오 FPS 측정
async function measureFPS(page) {
  const scenarios = [];
  
  // 시나리오 1: 부드러운 스크롤 (Smooth Scroll)
  const smoothScroll = await page.evaluate(() => {
    return new Promise((resolve) => {
      const frames = [];
      let lastTime = performance.now();
      let isScrolling = true;

      function measureFrame() {
        if (!isScrolling) return;
        
        const now = performance.now();
        const delta = now - lastTime;
        frames.push(1000 / delta);
        lastTime = now;
        requestAnimationFrame(measureFrame);
      }

      requestAnimationFrame(measureFrame);

      // 5단계로 부드럽게 스크롤
      const scrollSteps = async () => {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        for (let i = 1; i <= 5; i++) {
          window.scrollTo({
            top: (maxScroll / 5) * i,
            behavior: 'smooth'
          });
          await new Promise(r => setTimeout(r, 400));
        }
        
        await new Promise(r => setTimeout(r, 500));
        isScrolling = false;
        
        const avgFps = frames.reduce((a, b) => a + b, 0) / frames.length;
        const minFps = Math.min(...frames);
        const droppedFrames = frames.filter(fps => fps < 30).length;
        const below60 = frames.filter(fps => fps < 60).length;
        
        resolve({
          scenario: 'smooth',
          avg: avgFps,
          min: minFps,
          max: Math.max(...frames),
          droppedFrames,
          below60Frames: below60,
          totalFrames: frames.length
        });
      };
      
      scrollSteps();
    });
  });
  scenarios.push(smoothScroll);

  await new Promise(r => setTimeout(r, 1000));
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await new Promise(r => setTimeout(r, 500));

  // 시나리오 2: 빠른 스크롤 (Fast Scroll)
  const fastScroll = await page.evaluate(() => {
    return new Promise((resolve) => {
      const frames = [];
      let lastTime = performance.now();
      let isScrolling = true;

      function measureFrame() {
        if (!isScrolling) return;
        
        const now = performance.now();
        const delta = now - lastTime;
        frames.push(1000 / delta);
        lastTime = now;
        requestAnimationFrame(measureFrame);
      }

      requestAnimationFrame(measureFrame);

      // 빠르게 연속 스크롤
      const scrollSteps = async () => {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        for (let i = 1; i <= 10; i++) {
          window.scrollTo({
            top: (maxScroll / 10) * i,
            behavior: 'smooth'
          });
          await new Promise(r => setTimeout(r, 150));  // 빠르게
        }
        
        await new Promise(r => setTimeout(r, 500));
        isScrolling = false;
        
        const avgFps = frames.reduce((a, b) => a + b, 0) / frames.length;
        const minFps = Math.min(...frames);
        const droppedFrames = frames.filter(fps => fps < 30).length;
        const below60 = frames.filter(fps => fps < 60).length;
        
        resolve({
          scenario: 'fast',
          avg: avgFps,
          min: minFps,
          max: Math.max(...frames),
          droppedFrames,
          below60Frames: below60,
          totalFrames: frames.length
        });
      };
      
      scrollSteps();
    });
  });
  scenarios.push(fastScroll);

  await new Promise(r => setTimeout(r, 1000));
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await new Promise(r => setTimeout(r, 500));

  // 시나리오 3: 급격한 점프 스크롤 (Jump Scroll)
  const jumpScroll = await page.evaluate(() => {
    return new Promise((resolve) => {
      const frames = [];
      let lastTime = performance.now();
      let isScrolling = true;

      function measureFrame() {
        if (!isScrolling) return;
        
        const now = performance.now();
        const delta = now - lastTime;
        frames.push(1000 / delta);
        lastTime = now;
        requestAnimationFrame(measureFrame);
      }

      requestAnimationFrame(measureFrame);

      // 큰 간격으로 점프
      const scrollSteps = async () => {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        const positions = [0, maxScroll * 0.3, maxScroll * 0.7, maxScroll, 0];
        
        for (const pos of positions) {
          window.scrollTo({
            top: pos,
            behavior: 'instant'
          });
          await new Promise(r => setTimeout(r, 300));
        }
        
        await new Promise(r => setTimeout(r, 500));
        isScrolling = false;
        
        const avgFps = frames.reduce((a, b) => a + b, 0) / frames.length;
        const minFps = Math.min(...frames);
        const droppedFrames = frames.filter(fps => fps < 30).length;
        const below60 = frames.filter(fps => fps < 60).length;
        
        resolve({
          scenario: 'jump',
          avg: avgFps,
          min: minFps,
          max: Math.max(...frames),
          droppedFrames,
          below60Frames: below60,
          totalFrames: frames.length
        });
      };
      
      scrollSteps();
    });
  });
  scenarios.push(jumpScroll);

  await new Promise(r => setTimeout(r, 500));
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));

  // 전체 평균 계산
  const allFrames = scenarios.flatMap(s => 
    Array(s.totalFrames).fill(s.avg)  // 간단한 근사치
  );
  
  return {
    scenarios: scenarios,
    overall: {
      avg: scenarios.reduce((sum, s) => sum + s.avg, 0) / scenarios.length,
      min: Math.min(...scenarios.map(s => s.min)),
      totalDroppedFrames: scenarios.reduce((sum, s) => sum + s.droppedFrames, 0),
      totalBelow60Frames: scenarios.reduce((sum, s) => sum + s.below60Frames, 0),
    }
  };
}

// ============================================================================
// 메인 실행
// ============================================================================

(async () => {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 PDF 렌더링 성능 비교 벤치마크');
  console.log('='.repeat(80));
  console.log(`\n📊 설정:`);
  console.log(`   실행 횟수: ${CONFIG.runs}회`);
  console.log(`   CPU 쓰로틀링: ${CONFIG.cpuThrottle}x`);
  console.log(`   대기 시간: ${CONFIG.waitAfterLoad}ms`);
  console.log(`   스크롤 테스트: ${CONFIG.enableScroll ? '활성화' : '비활성화'}`);
  console.log('');

  const allResults = {};

  // 각 버전에 대해 테스트 실행
  for (const version of CONFIG.versions) {
    const url = `${CONFIG.baseUrl}?${version.query}`;
    log(`\n📊 테스트 중: ${version.name}`);
    log(`URL: ${url}`, 1);
    
    const runs = [];
    
    for (let i = 1; i <= CONFIG.runs; i++) {
      try {
        const result = await measureVersion(url, version.name, i);
        runs.push(result);
        
        // 다음 실행 전 잠깐 대기
        if (i < CONFIG.runs) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        log(`❌ 에러: ${error.message}`, 2);
      }
    }
    
    allResults[version.key] = runs;
  }

  // ============================================================================
  // 결과 분석 및 출력
  // ============================================================================

  console.log('\n\n' + '='.repeat(80));
  console.log('📊 성능 비교 결과');
  console.log('='.repeat(80));

  // 통계 계산
  const stats = {};
  for (const [key, runs] of Object.entries(allResults)) {
    stats[key] = {
      renderTime: calculateStats(runs.map(r => r.renderTime).filter(Boolean)),
      longTaskCount: calculateStats(runs.map(r => r.longTasks.length)),
      totalBlockingTime: calculateStats(runs.map(r => r.totalBlockingTime)),
      memoryUsed: calculateStats(runs.map(r => r.memoryUsage?.usedJSHeapSize).filter(Boolean)),
      pdfPages: runs[0]?.pdfPages || 0,
      layoutCount: calculateStats(runs.map(r => r.layoutCount)),
      timeToPage: {},  // 페이지별 도달 시간
      fps: CONFIG.enableScroll ? {
        overall: {
          avg: calculateStats(runs.map(r => r.fps?.overall?.avg).filter(Boolean)),
          min: calculateStats(runs.map(r => r.fps?.overall?.min).filter(Boolean)),
          dropped: calculateStats(runs.map(r => r.fps?.overall?.totalDroppedFrames).filter(Boolean)),
          below60: calculateStats(runs.map(r => r.fps?.overall?.totalBelow60Frames).filter(Boolean))
        },
        smooth: runs[0]?.fps?.scenarios?.find(s => s.scenario === 'smooth'),
        fast: runs[0]?.fps?.scenarios?.find(s => s.scenario === 'fast'),
        jump: runs[0]?.fps?.scenarios?.find(s => s.scenario === 'jump')
      } : null
    };
    
    // Time to Page 통계 계산
    for (const milestone of CONFIG.targetPageMilestones) {
      const times = runs.map(r => r.timeToPage?.[milestone]).filter(Boolean);
      if (times.length > 0) {
        stats[key].timeToPage[milestone] = calculateStats(times);
      }
    }
  }

  // 1. PDF 렌더링 성능
  console.log('\n📄 PDF 렌더링 성능');
  console.log('-'.repeat(80));
  console.log('메트릭'.padEnd(35) + 'PDF (일반)'.padEnd(25) + 'Queue (우선순위 큐)'.padEnd(25));
  console.log('-'.repeat(80));

  const renderPdf = stats.pdf.renderTime?.avg || 0;
  const renderQueue = stats.queue.renderTime?.avg || 0;
  const renderImprovement = renderPdf > 0 ? ((renderPdf - renderQueue) / renderPdf * 100) : 0;

  console.log(
    '총 렌더링 시간 (avg)'.padEnd(35) +
    formatMs(renderPdf).padEnd(25) +
    formatMs(renderQueue).padEnd(25)
  );

  console.log(
    '렌더링된 페이지 수'.padEnd(35) +
    `${stats.pdf.pdfPages}개`.padEnd(25) +
    `${stats.queue.pdfPages}개`.padEnd(25)
  );

  // 1.5. Time to Page (특정 페이지까지 렌더링 시간)
  console.log('\n⚡ 빠른 렌더링 성능 (Time to Page)');
  console.log('-'.repeat(80));
  console.log('메트릭'.padEnd(35) + 'PDF (일반)'.padEnd(25) + 'Queue (우선순위 큐)'.padEnd(25));
  console.log('-'.repeat(80));

  for (const milestone of CONFIG.targetPageMilestones) {
    const pdfTime = stats.pdf.timeToPage[milestone]?.avg || null;
    const queueTime = stats.queue.timeToPage[milestone]?.avg || null;
    
    console.log(
      `${milestone}페이지까지 (avg)`.padEnd(35) +
      (pdfTime ? formatMs(pdfTime) : 'N/A').padEnd(25) +
      (queueTime ? formatMs(queueTime) : 'N/A').padEnd(25)
    );
  }

  // 2. 메인스레드 부하
  console.log('\n⚡ 메인스레드 부하');
  console.log('-'.repeat(80));
  console.log('메트릭'.padEnd(35) + 'PDF (일반)'.padEnd(25) + 'Queue (우선순위 큐)'.padEnd(25));
  console.log('-'.repeat(80));

  const longTasksPdf = stats.pdf.longTaskCount?.avg || 0;
  const longTasksQueue = stats.queue.longTaskCount?.avg || 0;
  const longTasksImprovement = longTasksPdf > 0 ? ((longTasksPdf - longTasksQueue) / longTasksPdf * 100) : 0;

  console.log(
    'Long Tasks 수 (>50ms)'.padEnd(35) +
    `${longTasksPdf.toFixed(1)}개`.padEnd(25) +
    `${longTasksQueue.toFixed(1)}개`.padEnd(25)
  );

  const tbtPdf = stats.pdf.totalBlockingTime?.avg || 0;
  const tbtQueue = stats.queue.totalBlockingTime?.avg || 0;
  const tbtImprovement = tbtPdf > 0 ? ((tbtPdf - tbtQueue) / tbtPdf * 100) : 0;

  console.log(
    'Total Blocking Time'.padEnd(35) +
    formatMs(tbtPdf).padEnd(25) +
    formatMs(tbtQueue).padEnd(25)
  );

  const layoutPdf = stats.pdf.layoutCount?.avg || 0;
  const layoutQueue = stats.queue.layoutCount?.avg || 0;

  console.log(
    'Layout 횟수'.padEnd(35) +
    `${layoutPdf.toFixed(0)}회`.padEnd(25) +
    `${layoutQueue.toFixed(0)}회`.padEnd(25)
  );

  // 3. 메모리 사용량
  console.log('\n💾 메모리 사용량');
  console.log('-'.repeat(80));
  console.log('메트릭'.padEnd(35) + 'PDF (일반)'.padEnd(25) + 'Queue (우선순위 큐)'.padEnd(25));
  console.log('-'.repeat(80));

  const memPdf = stats.pdf.memoryUsed?.avg || 0;
  const memQueue = stats.queue.memoryUsed?.avg || 0;
  const memImprovement = memPdf > 0 ? ((memPdf - memQueue) / memPdf * 100) : 0;

  console.log(
    'JS Heap Used Size'.padEnd(35) +
    formatMB(memPdf).padEnd(25) +
    formatMB(memQueue).padEnd(25)
  );

  // 4. FPS (스크롤 성능)
  if (CONFIG.enableScroll && stats.pdf.fps && stats.queue.fps) {
    console.log('\n📈 스크롤 성능 - 전체 평균');
    console.log('-'.repeat(80));
    console.log('메트릭'.padEnd(35) + 'PDF (일반)'.padEnd(25) + 'Queue (우선순위 큐)'.padEnd(25));
    console.log('-'.repeat(80));

    const fpsPdf = stats.pdf.fps.overall.avg?.avg || 0;
    const fpsQueue = stats.queue.fps.overall.avg?.avg || 0;

    console.log(
      '평균 FPS'.padEnd(35) +
      `${fpsPdf.toFixed(1)}`.padEnd(25) +
      `${fpsQueue.toFixed(1)}`.padEnd(25)
    );

    const minFpsPdf = stats.pdf.fps.overall.min?.avg || 0;
    const minFpsQueue = stats.queue.fps.overall.min?.avg || 0;

    console.log(
      '최소 FPS'.padEnd(35) +
      `${minFpsPdf.toFixed(1)}`.padEnd(25) +
      `${minFpsQueue.toFixed(1)}`.padEnd(25)
    );

    const droppedPdf = stats.pdf.fps.overall.dropped?.avg || 0;
    const droppedQueue = stats.queue.fps.overall.dropped?.avg || 0;

    console.log(
      '드롭된 프레임 (<30 FPS)'.padEnd(35) +
      `${droppedPdf.toFixed(1)}개`.padEnd(25) +
      `${droppedQueue.toFixed(1)}개`.padEnd(25)
    );

    const below60Pdf = stats.pdf.fps.overall.below60?.avg || 0;
    const below60Queue = stats.queue.fps.overall.below60?.avg || 0;

    console.log(
      '60fps 미만 프레임'.padEnd(35) +
      `${below60Pdf.toFixed(1)}개`.padEnd(25) +
      `${below60Queue.toFixed(1)}개`.padEnd(25)
    );

    // 시나리오별 상세 결과
    console.log('\n📊 스크롤 시나리오별 상세');
    console.log('-'.repeat(80));
    
    const scenarios = [
      { key: 'smooth', name: '부드러운 스크롤 (5단계)', emoji: '🌊' },
      { key: 'fast', name: '빠른 스크롤 (10단계)', emoji: '⚡' },
      { key: 'jump', name: '점프 스크롤 (급격한 이동)', emoji: '🚀' }
    ];

    scenarios.forEach(scenario => {
      const pdfData = stats.pdf.fps[scenario.key];
      const queueData = stats.queue.fps[scenario.key];
      
      if (pdfData && queueData) {
        console.log(`\n${scenario.emoji} ${scenario.name}`);
        console.log('  메트릭'.padEnd(35) + 'PDF'.padEnd(20) + 'Queue'.padEnd(20) + '개선율');
        
        const avgImprovement = ((pdfData.avg - queueData.avg) / pdfData.avg * 100).toFixed(1);
        const avgSign = parseFloat(avgImprovement) > 0 ? '✅' : '❌';
        console.log(
          '  평균 FPS'.padEnd(35) +
          `${pdfData.avg.toFixed(1)}`.padEnd(20) +
          `${queueData.avg.toFixed(1)}`.padEnd(20) +
          `${avgSign} ${avgImprovement}%`
        );
        
        const droppedImprovement = ((pdfData.droppedFrames - queueData.droppedFrames) / Math.max(pdfData.droppedFrames, 1) * 100).toFixed(1);
        const droppedSign = parseFloat(droppedImprovement) > 0 ? '✅' : '❌';
        console.log(
          '  드롭된 프레임'.padEnd(35) +
          `${pdfData.droppedFrames}개`.padEnd(20) +
          `${queueData.droppedFrames}개`.padEnd(20) +
          `${droppedSign} ${droppedImprovement}%`
        );
      }
    });
  }

  // 5. 개선율 요약
  console.log('\n\n' + '='.repeat(80));
  console.log('🏆 우선순위 큐 개선율');
  console.log('='.repeat(80));

  const improvements = [
    { name: '렌더링 시간', value: renderImprovement, better: renderImprovement > 0 },
    { name: 'Long Tasks 감소', value: longTasksImprovement, better: longTasksImprovement > 0 },
    { name: 'Total Blocking Time 감소', value: tbtImprovement, better: tbtImprovement > 0 },
    { name: '메모리 사용량 감소', value: memImprovement, better: memImprovement > 0 },
  ];

  // Time to Page 개선율 추가
  for (const milestone of CONFIG.targetPageMilestones) {
    const pdfTime = stats.pdf.timeToPage[milestone]?.avg;
    const queueTime = stats.queue.timeToPage[milestone]?.avg;
    if (pdfTime && queueTime) {
      const improvement = ((pdfTime - queueTime) / pdfTime * 100);
      improvements.push({
        name: `${milestone}페이지까지 렌더링`,
        value: improvement,
        better: improvement > 0
      });
    }
  }

  // FPS 개선율 추가
  if (CONFIG.enableScroll && stats.pdf.fps && stats.queue.fps) {
    const fpsPdf = stats.pdf.fps.overall.avg?.avg || 0;
    const fpsQueue = stats.queue.fps.overall.avg?.avg || 0;
    const fpsImprovement = fpsPdf > 0 ? -((fpsPdf - fpsQueue) / fpsPdf * 100) : 0;  // 높을수록 좋으므로 음수 반전
    
    const droppedPdf = stats.pdf.fps.overall.dropped?.avg || 0;
    const droppedQueue = stats.queue.fps.overall.dropped?.avg || 0;
    const droppedImprovement = droppedPdf > 0 ? ((droppedPdf - droppedQueue) / droppedPdf * 100) : 0;
    
    improvements.push(
      { name: '평균 FPS 향상', value: fpsImprovement, better: fpsImprovement > 0 },
      { name: '드롭 프레임 감소', value: droppedImprovement, better: droppedImprovement > 0 }
    );
  }

  improvements.forEach(item => {
    const icon = item.better ? '✅' : '❌';
    const sign = item.value > 0 ? '+' : '';
    console.log(`${icon} ${item.name}: ${sign}${item.value.toFixed(2)}%`);
  });

  const totalImprovements = improvements.filter(i => i.better).length;
  const avgImprovement = improvements.reduce((sum, i) => sum + i.value, 0) / improvements.length;

  console.log('\n' + '-'.repeat(80));
  console.log(`📊 개선된 메트릭: ${totalImprovements}/${improvements.length}`);
  console.log(`📈 평균 개선율: ${avgImprovement.toFixed(2)}%`);
  console.log('-'.repeat(80));

  // 결과 저장
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(__dirname, 'bench_out');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const resultPath = path.join(outDir, `pdf-render-comparison-${timestamp}.json`);
  fs.writeFileSync(resultPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    config: CONFIG,
    stats,
    improvements: improvements.map(i => ({ name: i.name, improvement: i.value })),
    summary: {
      totalImprovements,
      avgImprovement,
      totalMetrics: improvements.length
    }
  }, null, 2));

  console.log(`\n📁 결과 저장: ${resultPath}`);
  console.log('\n✅ 벤치마크 완료!\n');
})();

