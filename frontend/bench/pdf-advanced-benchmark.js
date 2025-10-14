#!/usr/bin/env node
/**
 * PDF 렌더링 고급 성능 비교 벤치마크
 * 
 * 모든 유의미한 지표를 측정:
 * 1. 렌더링 효율성 (pages/sec)
 * 2. Viewport 페이지 완료 시간
 * 3. 인터랙션 응답성
 * 4. 프레임 드롭
 * 5. 렌더링 순서
 * 6. 페이지당 렌더링 시간
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  baseUrl: 'http://localhost:3000/feedback/4',
  versions: [
    { name: 'PDF (일반)', query: 'version=pdf', key: 'pdf' },
    { name: 'Queue (우선순위 큐)', query: 'version=queue', key: 'queue' }
  ],
  runs: parseInt(process.argv[2]) || 10,
  cpuThrottle: 4,
  headless: true
};

function log(message, indent = 0) {
  console.log(`${'  '.repeat(indent)}${message}`);
}

function formatMs(ms) {
  return ms ? `${ms.toFixed(2)}ms` : 'N/A';
}

function calculateStats(values) {
  if (!values || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return { min: sorted[0], max: sorted[sorted.length - 1], avg, median: sorted[Math.floor(sorted.length / 2)] };
}

// ============================================================================
// 점진적 스크롤 시나리오 (사용자처럼 천천히 읽기)
// ============================================================================

async function measureGradualScroll(url, versionName, runNumber) {
  log(`Run ${runNumber}: ${versionName}`, 1);
  
  const browser = await puppeteer.launch({
    headless: CONFIG.headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1920, height: 1080 }
  });

  const page = await browser.newPage();
  const client = await page.target().createCDPSession();
  await client.send('Emulation.setCPUThrottlingRate', { rate: CONFIG.cpuThrottle });
  await client.send('Performance.enable');

  // 메트릭 수집
  await page.evaluateOnNewDocument(() => {
    window.__metrics = {
      renderEvents: [],
      longTasks: [],
      frameDrops: 0,
      interactionTimes: [],
      viewportRenderComplete: []
    };

    window.pdfRenderMetricsCollector = {
      metrics: [],
      add: function(metric) {
        this.metrics.push(metric);
        window.__metrics.renderEvents.push({
          page: metric.page,
          time: performance.now(),
          totalMs: metric.totalMs,
          getPageMs: metric.getPageMs,
          renderMs: metric.renderMs
        });
      }
    };

    if (window.PerformanceObserver) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) {
              window.__metrics.longTasks.push({
                duration: entry.duration,
                startTime: entry.startTime
              });
            }
          }
        });
        observer.observe({ entryTypes: ['longtask', 'measure'] });
      } catch (e) {}
    }

    // FPS 추적
    let lastFrameTime = performance.now();
    function trackFrame() {
      const now = performance.now();
      const delta = now - lastFrameTime;
      const fps = 1000 / delta;
      if (fps < 30) {
        window.__metrics.frameDrops++;
      }
      lastFrameTime = now;
      requestAnimationFrame(trackFrame);
    }
    requestAnimationFrame(trackFrame);
  });

  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

  // 점진적 스크롤 시뮬레이션
  const result = await page.evaluate(async () => {
    const startTime = performance.now();
    
    const scrollContainer = Array.from(document.querySelectorAll('div'))
      .find(div => {
        const style = window.getComputedStyle(div);
        return style.overflowY === 'auto' && div.scrollHeight > div.clientHeight;
      });
    
    if (!scrollContainer) return { success: false };
    
    const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
    const events = [];
    
    // 10단계 스크롤
    for (let i = 0; i <= 10; i++) {
      const stepStart = performance.now();
      const longTasksBefore = window.__metrics.longTasks.length;
      
      scrollContainer.scrollTop = (maxScroll / 10) * i;
      
      // 인터랙션 테스트: 버튼 클릭
      if (i % 3 === 0) {
        const button = document.querySelector('button');
        if (button) {
          const clickStart = performance.now();
          button.focus();
          const clickEnd = performance.now();
          window.__metrics.interactionTimes.push(clickEnd - clickStart);
        }
      }
      
      // 2초 대기 (읽기)
      await new Promise(r => setTimeout(r, 2000));
      
      const stepEnd = performance.now();
      const longTasksAfter = window.__metrics.longTasks.length;
      const newLongTasks = longTasksAfter - longTasksBefore;
      
      events.push({
        step: i,
        renderedPages: window.__metrics.renderEvents.length,
        stepTime: stepEnd - stepStart,
        longTasksInStep: newLongTasks
      });
    }
    
    const totalTime = performance.now() - startTime;
    
    return {
      success: true,
      totalTime,
      renderedPages: window.__metrics.renderEvents.length,
      renderSequence: window.__metrics.renderEvents.map(e => e.page),
      avgTimePerPage: window.__metrics.renderEvents.length > 0
        ? window.__metrics.renderEvents.reduce((sum, e) => sum + e.totalMs, 0) / window.__metrics.renderEvents.length
        : 0,
      longTasks: window.__metrics.longTasks.length,
      longTasksDetail: window.__metrics.longTasks.map(t => ({
        duration: t.duration.toFixed(2),
        startTime: t.startTime.toFixed(2)
      })),
      totalBlockingTime: window.__metrics.longTasks.reduce((sum, t) => sum + Math.max(0, t.duration - 50), 0),
      frameDrops: window.__metrics.frameDrops,
      avgInteractionTime: window.__metrics.interactionTimes.length > 0
        ? window.__metrics.interactionTimes.reduce((a, b) => a + b, 0) / window.__metrics.interactionTimes.length
        : 0,
      events
    };
  });

  if (!result || !result.success) {
    log(`   ❌ 측정 실패 (점진적): result=${result ? 'exists but success=false' : 'null'}`, 2);
    if (result) log(`   디버그: ${JSON.stringify({success: result.success, totalTime: result.totalTime, renderedPages: result.renderedPages})}`, 2);
    await browser.close();
    return null;
  }

  const cdpMetrics = await client.send('Performance.getMetrics');
  const jsHeapSize = cdpMetrics.metrics.find(m => m.name === 'JSHeapUsedSize');
  
  await browser.close();

  const efficiency = result.renderedPages / (result.totalTime / 1000);

  log(`   ✅ ${result.renderedPages}페이지, 효율: ${efficiency.toFixed(2)} pages/sec`, 2);
  if (result.renderedPages < 10) {
    log(`   ⚠️  렌더링 페이지 수가 적습니다! 렌더링된 페이지: [${result.renderSequence?.join(', ')}]`, 2);
  }

  return {
    ...result,
    jsHeapUsedSize: jsHeapSize?.value || 0,
    efficiency
  };
}

// ============================================================================
// 점프 스크롤 시나리오
// ============================================================================

async function measureJumpScroll(url, versionName, runNumber) {
  log(`Run ${runNumber}: ${versionName}`, 1);
  
  const browser = await puppeteer.launch({
    headless: CONFIG.headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1920, height: 1080 }
  });

  const page = await browser.newPage();
  const client = await page.target().createCDPSession();
  await client.send('Emulation.setCPUThrottlingRate', { rate: CONFIG.cpuThrottle });
  await client.send('Performance.enable');

  await page.evaluateOnNewDocument(() => {
    window.__metrics = {
      renderEvents: [],
      longTasks: [],
      frameDrops: 0,
      interactionTimes: []
    };

    window.pdfRenderMetricsCollector = {
      metrics: [],
      add: function(metric) {
        this.metrics.push(metric);
        window.__metrics.renderEvents.push({
          page: metric.page,
          time: performance.now(),
          totalMs: metric.totalMs
        });
      }
    };

    if (window.PerformanceObserver) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) {
              window.__metrics.longTasks.push({
                duration: entry.duration,
                startTime: entry.startTime
              });
            }
          }
        });
        observer.observe({ entryTypes: ['longtask', 'measure'] });
      } catch (e) {}
    }

    let lastFrameTime = performance.now();
    function trackFrame() {
      const now = performance.now();
      const delta = now - lastFrameTime;
      const fps = 1000 / delta;
      if (fps < 30) window.__metrics.frameDrops++;
      lastFrameTime = now;
      requestAnimationFrame(trackFrame);
    }
    requestAnimationFrame(trackFrame);
  });

  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

  const result = await page.evaluate(async () => {
    const startTime = performance.now();
    
    const scrollContainer = Array.from(document.querySelectorAll('div'))
      .find(div => {
        const style = window.getComputedStyle(div);
        return style.overflowY === 'auto' && div.scrollHeight > div.clientHeight;
      });
    
    if (!scrollContainer) return { success: false };
    
    const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
    const jumpPositions = [0, 0.2, 0.5, 0.8, 1.0, 0.3, 0.7, 0];
    const jumpMetrics = [];
    
    for (let i = 0; i < jumpPositions.length; i++) {
      const jumpStart = performance.now();
      const beforeRenderCount = window.__metrics.renderEvents.length;
      const longTasksBefore = window.__metrics.longTasks.length;
      
      scrollContainer.scrollTop = maxScroll * jumpPositions[i];
      
      // 인터랙션 테스트
      const button = document.querySelector('button');
      if (button) {
        const clickStart = performance.now();
        button.focus();
        const clickEnd = performance.now();
        window.__metrics.interactionTimes.push(clickEnd - clickStart);
      }
      
      await new Promise(r => setTimeout(r, 3000));
      
      const jumpEnd = performance.now();
      const afterRenderCount = window.__metrics.renderEvents.length;
      const longTasksAfter = window.__metrics.longTasks.length;
      const newLongTasks = longTasksAfter - longTasksBefore;
      
      jumpMetrics.push({
        jump: i + 1,
        position: jumpPositions[i],
        newPagesRendered: afterRenderCount - beforeRenderCount,
        timeToRender: jumpEnd - jumpStart,
        longTasksInJump: newLongTasks
      });
    }
    
    const totalTime = performance.now() - startTime;
    
    return {
      success: true,
      totalTime,
      renderedPages: window.__metrics.renderEvents.length,
      renderSequence: window.__metrics.renderEvents.map(e => e.page),
      avgTimePerPage: window.__metrics.renderEvents.length > 0
        ? window.__metrics.renderEvents.reduce((sum, e) => sum + e.totalMs, 0) / window.__metrics.renderEvents.length
        : 0,
      longTasks: window.__metrics.longTasks.length,
      longTasksDetail: window.__metrics.longTasks.map(t => ({
        duration: t.duration.toFixed(2),
        startTime: t.startTime.toFixed(2)
      })),
      totalBlockingTime: window.__metrics.longTasks.reduce((sum, t) => sum + Math.max(0, t.duration - 50), 0),
      frameDrops: window.__metrics.frameDrops,
      avgInteractionTime: window.__metrics.interactionTimes.length > 0
        ? window.__metrics.interactionTimes.reduce((a, b) => a + b, 0) / window.__metrics.interactionTimes.length
        : 0,
      jumpMetrics,
      avgNewPagesPerJump: jumpMetrics.length > 0
        ? jumpMetrics.reduce((sum, j) => sum + j.newPagesRendered, 0) / jumpMetrics.length
        : 0
    };
  });

  if (!result || !result.success) {
    log(`   ❌ 측정 실패 (점프): result=${result ? 'exists but success=false' : 'null'}`, 2);
    if (result) log(`   디버그: ${JSON.stringify({success: result.success, totalTime: result.totalTime, renderedPages: result.renderedPages})}`, 2);
    await browser.close();
    return null;
  }

  const cdpMetrics = await client.send('Performance.getMetrics');
  const jsHeapSize = cdpMetrics.metrics.find(m => m.name === 'JSHeapUsedSize');
  
  await browser.close();

  const efficiency = result.renderedPages / (result.totalTime / 1000);

  log(`   ✅ ${result.renderedPages}페이지, 효율: ${efficiency.toFixed(2)} pages/sec`, 2);
  if (result.renderedPages < 10) {
    log(`   ⚠️  렌더링 페이지 수가 적습니다! 렌더링된 페이지: [${result.renderSequence?.join(', ')}]`, 2);
  }

  return {
    ...result,
    jsHeapUsedSize: jsHeapSize?.value || 0,
    efficiency
  };
}

// ============================================================================
// 메인 실행
// ============================================================================

(async () => {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 PDF 렌더링 고급 성능 비교 벤치마크');
  console.log('='.repeat(80));
  console.log(`\n📊 설정: ${CONFIG.runs}회 실행, CPU ${CONFIG.cpuThrottle}x\n`);

  const allResults = {
    gradual: { pdf: [], queue: [] },
    jump: { pdf: [], queue: [] }
  };

  // ============================================================================
  // 시나리오 1: 점진적 스크롤
  // ============================================================================
  
  console.log('='.repeat(80));
  console.log('📊 시나리오 1: 점진적 스크롤 (실제 사용자 패턴)');
  console.log('='.repeat(80));
  console.log('   10개 구간으로 나눠서 스크롤, 각 2초씩 읽기\n');

  for (const version of CONFIG.versions) {
    const url = `${CONFIG.baseUrl}?${version.query}`;
    log(`📊 테스트 중: ${version.name}`);
    
    for (let i = 1; i <= CONFIG.runs; i++) {
      try {
        const result = await measureGradualScroll(url, version.name, i);
        if (result) {
          allResults.gradual[version.key].push(result);
          log(`   ✅ 데이터 수집 성공`, 2);
        } else {
          log(`   ⚠️ 결과가 null입니다`, 2);
        }
        if (i < CONFIG.runs) await new Promise(r => setTimeout(r, 2000));
      } catch (error) {
        log(`   ❌ 에러: ${error.message}`, 2);
        log(`   스택: ${error.stack}`, 2);
      }
    }
  }

  // ============================================================================
  // 시나리오 2: 점프 스크롤
  // ============================================================================
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 시나리오 2: 점프 스크롤 (급격한 위치 변경)');
  console.log('='.repeat(80));
  console.log('   8번의 위치 점프, 각 3초씩 대기\n');

  for (const version of CONFIG.versions) {
    const url = `${CONFIG.baseUrl}?${version.query}`;
    log(`📊 테스트 중: ${version.name}`);
    
    for (let i = 1; i <= CONFIG.runs; i++) {
      try {
        const result = await measureJumpScroll(url, version.name, i);
        if (result) {
          allResults.jump[version.key].push(result);
          log(`   ✅ 데이터 수집 성공`, 2);
        } else {
          log(`   ⚠️ 결과가 null입니다`, 2);
        }
        if (i < CONFIG.runs) await new Promise(r => setTimeout(r, 2000));
      } catch (error) {
        log(`   ❌ 에러: ${error.message}`, 2);
        log(`   스택: ${error.stack}`, 2);
      }
    }
  }

  // ============================================================================
  // 결과 분석
  // ============================================================================

  console.log('\n\n' + '='.repeat(80));
  console.log('📊 상세 성능 비교 결과');
  console.log('='.repeat(80));

  // 시나리오 1 분석
  console.log('\n🌊 시나리오 1: 점진적 스크롤');
  console.log('-'.repeat(80));
  console.log('메트릭'.padEnd(40) + 'PDF'.padEnd(20) + 'Queue'.padEnd(20) + '개선율');
  console.log('-'.repeat(80));

  // 렌더링된 페이지가 1개 이하인 비정상 결과 제외
  const g_pdf = allResults.gradual.pdf.filter(r => r.renderedPages > 1);
  const g_queue = allResults.gradual.queue.filter(r => r.renderedPages > 1);
  
  const g_pdf_excluded = allResults.gradual.pdf.length - g_pdf.length;
  const g_queue_excluded = allResults.gradual.queue.length - g_queue.length;
  
  if (g_pdf_excluded > 0) {
    console.log(`⚠️  PDF: ${g_pdf_excluded}개의 비정상 결과 제외됨 (렌더링 페이지 ≤ 1)`);
  }
  if (g_queue_excluded > 0) {
    console.log(`⚠️  Queue: ${g_queue_excluded}개의 비정상 결과 제외됨 (렌더링 페이지 ≤ 1)`);
  }
  if (g_pdf.length === 0 || g_queue.length === 0) {
    console.log('❌ 유효한 데이터가 없습니다. 통계를 계산할 수 없습니다.');
  }

  // 1. 렌더링 효율성
  const g_eff_pdf = calculateStats(g_pdf.map(r => r.efficiency));
  const g_eff_queue = calculateStats(g_queue.map(r => r.efficiency));
  let g_eff_improve = 0;
  if (g_eff_pdf && g_eff_queue) {
    g_eff_improve = ((g_eff_queue.avg - g_eff_pdf.avg) / g_eff_pdf.avg * 100);
  console.log(
    '렌더링 효율성 (pages/sec)'.padEnd(40) +
    `${g_eff_pdf.avg.toFixed(2)}`.padEnd(20) +
    `${g_eff_queue.avg.toFixed(2)}`.padEnd(20) +
    `${g_eff_improve > 0 ? '✅' : '❌'} ${g_eff_improve.toFixed(2)}%`
  );
  } else {
    console.log('렌더링 효율성 (pages/sec)'.padEnd(40) + '데이터 부족');
  }

  // 2. 렌더링된 페이지 수
  const g_pages_pdf = calculateStats(g_pdf.map(r => r.renderedPages));
  const g_pages_queue = calculateStats(g_queue.map(r => r.renderedPages));
  let g_pages_improve = 0;
  if (g_pages_pdf && g_pages_queue) {
    g_pages_improve = ((g_pages_queue.avg - g_pages_pdf.avg) / g_pages_pdf.avg * 100);
  console.log(
    '렌더링된 페이지 수'.padEnd(40) +
    `${g_pages_pdf.avg.toFixed(1)}개`.padEnd(20) +
    `${g_pages_queue.avg.toFixed(1)}개`.padEnd(20) +
    `${g_pages_improve > 0 ? '✅' : '❌'} ${g_pages_improve.toFixed(2)}%`
  );
  } else {
    console.log('렌더링된 페이지 수'.padEnd(40) + '데이터 부족');
  }

  // 3. 페이지당 평균 렌더링 시간
  const g_perPage_pdf = calculateStats(g_pdf.map(r => r.avgTimePerPage));
  const g_perPage_queue = calculateStats(g_queue.map(r => r.avgTimePerPage));
  if (g_perPage_pdf && g_perPage_queue) {
  const g_perPage_improve = ((g_perPage_pdf.avg - g_perPage_queue.avg) / g_perPage_pdf.avg * 100);
  console.log(
    '페이지당 평균 렌더링 시간'.padEnd(40) +
    formatMs(g_perPage_pdf.avg).padEnd(20) +
    formatMs(g_perPage_queue.avg).padEnd(20) +
    `${g_perPage_improve > 0 ? '✅' : '❌'} ${g_perPage_improve.toFixed(2)}%`
  );
  } else {
    console.log('페이지당 평균 렌더링 시간'.padEnd(40) + '데이터 부족');
  }

  // 4. 프레임 드롭
  const g_drops_pdf = calculateStats(g_pdf.map(r => r.frameDrops));
  const g_drops_queue = calculateStats(g_queue.map(r => r.frameDrops));
  let g_drops_improve = 0;
  if (g_drops_pdf && g_drops_queue) {
    g_drops_improve = ((g_drops_pdf.avg - g_drops_queue.avg) / g_drops_pdf.avg * 100);
  console.log(
    '프레임 드롭 (<30 FPS)'.padEnd(40) +
    `${g_drops_pdf.avg.toFixed(1)}개`.padEnd(20) +
    `${g_drops_queue.avg.toFixed(1)}개`.padEnd(20) +
    `${g_drops_improve > 0 ? '✅' : '❌'} ${g_drops_improve.toFixed(2)}%`
  );
  } else {
    console.log('프레임 드롭 (<30 FPS)'.padEnd(40) + '데이터 부족');
  }

  // 5. 인터랙션 응답 시간
  const g_interact_pdf = calculateStats(g_pdf.map(r => r.avgInteractionTime).filter(Boolean));
  const g_interact_queue = calculateStats(g_queue.map(r => r.avgInteractionTime).filter(Boolean));
  if (g_interact_pdf && g_interact_queue) {
    const g_interact_improve = ((g_interact_pdf.avg - g_interact_queue.avg) / g_interact_pdf.avg * 100);
    console.log(
      '인터랙션 응답 시간'.padEnd(40) +
      formatMs(g_interact_pdf.avg).padEnd(20) +
      formatMs(g_interact_queue.avg).padEnd(20) +
      `${g_interact_improve > 0 ? '✅' : '❌'} ${g_interact_improve.toFixed(2)}%`
    );
  }

  // 6. Long Tasks / TBT
  const g_longTasks_pdf = calculateStats(g_pdf.map(r => r.longTasks));
  const g_longTasks_queue = calculateStats(g_queue.map(r => r.longTasks));
  const g_tbt_pdf = calculateStats(g_pdf.map(r => r.totalBlockingTime));
  const g_tbt_queue = calculateStats(g_queue.map(r => r.totalBlockingTime));
  
  if (g_longTasks_pdf && g_longTasks_queue) {
  console.log(
    'Long Tasks 수'.padEnd(40) +
    `${g_longTasks_pdf.avg.toFixed(1)}개`.padEnd(20) +
    `${g_longTasks_queue.avg.toFixed(1)}개`.padEnd(20) +
    `${((g_longTasks_pdf.avg - g_longTasks_queue.avg) / g_longTasks_pdf.avg * 100).toFixed(2)}%`
  );
  } else {
    console.log('Long Tasks 수'.padEnd(40) + '데이터 부족');
  }

  if (g_tbt_pdf && g_tbt_queue) {
  console.log(
    'Total Blocking Time'.padEnd(40) +
    formatMs(g_tbt_pdf.avg).padEnd(20) +
    formatMs(g_tbt_queue.avg).padEnd(20) +
    `${((g_tbt_pdf.avg - g_tbt_queue.avg) / g_tbt_pdf.avg * 100).toFixed(2)}%`
  );
  } else {
    console.log('Total Blocking Time'.padEnd(40) + '데이터 부족');
  }

  // 7. 렌더링 순서
  console.log('\n   렌더링 순서 (처음 10개):');
  console.log(`   PDF:   [${g_pdf[0]?.renderSequence?.slice(0, 10).join(', ')}]`);
  console.log(`   Queue: [${g_queue[0]?.renderSequence?.slice(0, 10).join(', ')}]`);

  // 8. Long Tasks 발생 타이밍 (구간별)
  console.log('\n   📍 Long Tasks 발생 구간 (스크롤 단계별):');
  if (g_pdf[0]?.events) {
    const pdfStepsWithLongTasks = g_pdf[0].events.filter(e => e.longTasksInStep > 0);
    console.log(`   PDF:   ${pdfStepsWithLongTasks.map(e => `Step ${e.step}(${e.longTasksInStep}개)`).join(', ') || '없음'}`);
  }
  if (g_queue[0]?.events) {
    const queueStepsWithLongTasks = g_queue[0].events.filter(e => e.longTasksInStep > 0);
    console.log(`   Queue: ${queueStepsWithLongTasks.map(e => `Step ${e.step}(${e.longTasksInStep}개)`).join(', ') || '없음'}`);
  }

  // 9. Long Tasks 상세 정보
  console.log('\n   ⏱️  Long Tasks 상세 (duration > 50ms):');
  if (g_pdf[0]?.longTasksDetail && g_pdf[0].longTasksDetail.length > 0) {
    console.log(`   PDF:   ${g_pdf[0].longTasksDetail.map(t => `${t.duration}ms@${(parseFloat(t.startTime)/1000).toFixed(1)}s`).join(', ')}`);
  } else {
    console.log(`   PDF:   없음`);
  }
  if (g_queue[0]?.longTasksDetail && g_queue[0].longTasksDetail.length > 0) {
    console.log(`   Queue: ${g_queue[0].longTasksDetail.map(t => `${t.duration}ms@${(parseFloat(t.startTime)/1000).toFixed(1)}s`).join(', ')}`);
  } else {
    console.log(`   Queue: 없음`);
  }

  // 시나리오 2 분석
  console.log('\n\n🚀 시나리오 2: 점프 스크롤');
  console.log('-'.repeat(80));
  console.log('메트릭'.padEnd(40) + 'PDF'.padEnd(20) + 'Queue'.padEnd(20) + '개선율');
  console.log('-'.repeat(80));

  // 렌더링된 페이지가 1개 이하인 비정상 결과 제외
  const j_pdf = allResults.jump.pdf.filter(r => r.renderedPages > 1);
  const j_queue = allResults.jump.queue.filter(r => r.renderedPages > 1);
  
  const j_pdf_excluded = allResults.jump.pdf.length - j_pdf.length;
  const j_queue_excluded = allResults.jump.queue.length - j_queue.length;
  
  if (j_pdf_excluded > 0) {
    console.log(`⚠️  PDF: ${j_pdf_excluded}개의 비정상 결과 제외됨 (렌더링 페이지 ≤ 1)`);
  }
  if (j_queue_excluded > 0) {
    console.log(`⚠️  Queue: ${j_queue_excluded}개의 비정상 결과 제외됨 (렌더링 페이지 ≤ 1)`);
  }
  if (j_pdf.length === 0 || j_queue.length === 0) {
    console.log('❌ 유효한 데이터가 없습니다. 통계를 계산할 수 없습니다.');
  }

  // 1. 렌더링 효율성
  const j_eff_pdf = calculateStats(j_pdf.map(r => r.efficiency));
  const j_eff_queue = calculateStats(j_queue.map(r => r.efficiency));
  let j_eff_improve = 0;
  if (j_eff_pdf && j_eff_queue) {
    j_eff_improve = ((j_eff_queue.avg - j_eff_pdf.avg) / j_eff_pdf.avg * 100);
  console.log(
    '렌더링 효율성 (pages/sec)'.padEnd(40) +
    `${j_eff_pdf.avg.toFixed(2)}`.padEnd(20) +
    `${j_eff_queue.avg.toFixed(2)}`.padEnd(20) +
    `${j_eff_improve > 0 ? '✅' : '❌'} ${j_eff_improve.toFixed(2)}%`
  );
  } else {
    console.log('렌더링 효율성 (pages/sec)'.padEnd(40) + '데이터 부족');
  }

  // 2. 렌더링된 페이지 수
  const j_pages_pdf = calculateStats(j_pdf.map(r => r.renderedPages));
  const j_pages_queue = calculateStats(j_queue.map(r => r.renderedPages));
  let j_pages_improve = 0;
  if (j_pages_pdf && j_pages_queue) {
    j_pages_improve = ((j_pages_queue.avg - j_pages_pdf.avg) / j_pages_pdf.avg * 100);
  console.log(
    '렌더링된 페이지 수'.padEnd(40) +
    `${j_pages_pdf.avg.toFixed(1)}개`.padEnd(20) +
    `${j_pages_queue.avg.toFixed(1)}개`.padEnd(20) +
    `${j_pages_improve > 0 ? '✅' : '❌'} ${j_pages_improve.toFixed(2)}%`
  );
  } else {
    console.log('렌더링된 페이지 수'.padEnd(40) + '데이터 부족');
  }

  // 3. 점프당 새 페이지 수
  const j_newPages_pdf = calculateStats(j_pdf.map(r => r.avgNewPagesPerJump));
  const j_newPages_queue = calculateStats(j_queue.map(r => r.avgNewPagesPerJump));
  let j_newPages_improve = 0;
  if (j_newPages_pdf && j_newPages_queue) {
    j_newPages_improve = ((j_newPages_queue.avg - j_newPages_pdf.avg) / j_newPages_pdf.avg * 100);
  console.log(
    '점프당 새로 렌더링된 페이지'.padEnd(40) +
    `${j_newPages_pdf.avg.toFixed(2)}개`.padEnd(20) +
    `${j_newPages_queue.avg.toFixed(2)}개`.padEnd(20) +
    `${j_newPages_improve > 0 ? '✅' : '❌'} ${j_newPages_improve.toFixed(2)}%`
  );
  } else {
    console.log('점프당 새로 렌더링된 페이지'.padEnd(40) + '데이터 부족');
  }

  // 4. 페이지당 평균 시간
  const j_perPage_pdf = calculateStats(j_pdf.map(r => r.avgTimePerPage));
  const j_perPage_queue = calculateStats(j_queue.map(r => r.avgTimePerPage));
  if (j_perPage_pdf && j_perPage_queue) {
  console.log(
    '페이지당 평균 렌더링 시간'.padEnd(40) +
    formatMs(j_perPage_pdf.avg).padEnd(20) +
    formatMs(j_perPage_queue.avg).padEnd(20) +
    `${((j_perPage_pdf.avg - j_perPage_queue.avg) / j_perPage_pdf.avg * 100).toFixed(2)}%`
  );
  } else {
    console.log('페이지당 평균 렌더링 시간'.padEnd(40) + '데이터 부족');
  }

  // 5. 프레임 드롭
  const j_drops_pdf = calculateStats(j_pdf.map(r => r.frameDrops));
  const j_drops_queue = calculateStats(j_queue.map(r => r.frameDrops));
  if (j_drops_pdf && j_drops_queue) {
  console.log(
    '프레임 드롭 (<30 FPS)'.padEnd(40) +
    `${j_drops_pdf.avg.toFixed(1)}개`.padEnd(20) +
    `${j_drops_queue.avg.toFixed(1)}개`.padEnd(20) +
    `${((j_drops_pdf.avg - j_drops_queue.avg) / j_drops_pdf.avg * 100).toFixed(2)}%`
  );
  } else {
    console.log('프레임 드롭 (<30 FPS)'.padEnd(40) + '데이터 부족');
  }

  // 6. 인터랙션 응답
  const j_interact_pdf = calculateStats(j_pdf.map(r => r.avgInteractionTime).filter(Boolean));
  const j_interact_queue = calculateStats(j_queue.map(r => r.avgInteractionTime).filter(Boolean));
  if (j_interact_pdf && j_interact_queue) {
    console.log(
      '인터랙션 응답 시간'.padEnd(40) +
      formatMs(j_interact_pdf.avg).padEnd(20) +
      formatMs(j_interact_queue.avg).padEnd(20) +
      `${((j_interact_pdf.avg - j_interact_queue.avg) / j_interact_pdf.avg * 100).toFixed(2)}%`
    );
  }

  // 7. Long Tasks / TBT
  const j_longTasks_pdf = calculateStats(j_pdf.map(r => r.longTasks));
  const j_longTasks_queue = calculateStats(j_queue.map(r => r.longTasks));
  const j_tbt_pdf = calculateStats(j_pdf.map(r => r.totalBlockingTime));
  const j_tbt_queue = calculateStats(j_queue.map(r => r.totalBlockingTime));
  
  if (j_longTasks_pdf && j_longTasks_queue) {
  console.log(
    'Long Tasks 수'.padEnd(40) +
    `${j_longTasks_pdf.avg.toFixed(1)}개`.padEnd(20) +
    `${j_longTasks_queue.avg.toFixed(1)}개`.padEnd(20) +
    `${((j_longTasks_pdf.avg - j_longTasks_queue.avg) / j_longTasks_pdf.avg * 100).toFixed(2)}%`
  );
  } else {
    console.log('Long Tasks 수'.padEnd(40) + '데이터 부족');
  }

  if (j_tbt_pdf && j_tbt_queue) {
  console.log(
    'Total Blocking Time'.padEnd(40) +
    formatMs(j_tbt_pdf.avg).padEnd(20) +
    formatMs(j_tbt_queue.avg).padEnd(20) +
    `${((j_tbt_pdf.avg - j_tbt_queue.avg) / j_tbt_pdf.avg * 100).toFixed(2)}%`
  );
  } else {
    console.log('Total Blocking Time'.padEnd(40) + '데이터 부족');
  }

  // 렌더링 순서
  console.log('\n   렌더링 순서 (처음 10개):');
  console.log(`   PDF:   [${j_pdf[0]?.renderSequence?.slice(0, 10).join(', ')}]`);
  console.log(`   Queue: [${j_queue[0]?.renderSequence?.slice(0, 10).join(', ')}]`);

  // Long Tasks 발생 타이밍 (점프별)
  console.log('\n   📍 Long Tasks 발생 구간 (점프별):');
  if (j_pdf[0]?.jumpMetrics) {
    const pdfJumpsWithLongTasks = j_pdf[0].jumpMetrics.filter(j => j.longTasksInJump > 0);
    console.log(`   PDF:   ${pdfJumpsWithLongTasks.map(j => `Jump ${j.jump}→${(j.position*100).toFixed(0)}%(${j.longTasksInJump}개)`).join(', ') || '없음'}`);
  }
  if (j_queue[0]?.jumpMetrics) {
    const queueJumpsWithLongTasks = j_queue[0].jumpMetrics.filter(j => j.longTasksInJump > 0);
    console.log(`   Queue: ${queueJumpsWithLongTasks.map(j => `Jump ${j.jump}→${(j.position*100).toFixed(0)}%(${j.longTasksInJump}개)`).join(', ') || '없음'}`);
  }

  // Long Tasks 상세 정보
  console.log('\n   ⏱️  Long Tasks 상세 (duration > 50ms):');
  if (j_pdf[0]?.longTasksDetail && j_pdf[0].longTasksDetail.length > 0) {
    console.log(`   PDF:   ${j_pdf[0].longTasksDetail.map(t => `${t.duration}ms@${(parseFloat(t.startTime)/1000).toFixed(1)}s`).join(', ')}`);
  } else {
    console.log(`   PDF:   없음`);
  }
  if (j_queue[0]?.longTasksDetail && j_queue[0].longTasksDetail.length > 0) {
    console.log(`   Queue: ${j_queue[0].longTasksDetail.map(t => `${t.duration}ms@${(parseFloat(t.startTime)/1000).toFixed(1)}s`).join(', ')}`);
  } else {
    console.log(`   Queue: 없음`);
  }

  // ============================================================================
  // 종합 개선율
  // ============================================================================

  console.log('\n\n' + '='.repeat(80));
  console.log('🏆 우선순위 큐 종합 개선율');
  console.log('='.repeat(80));

  const improvements = [
    { name: '점진적 스크롤 - 효율성', value: g_eff_improve, better: g_eff_improve > 0 },
    { name: '점진적 스크롤 - 페이지 수', value: g_pages_improve, better: g_pages_improve > 0 },
    { name: '점진적 스크롤 - 프레임 드롭 감소', value: g_drops_improve, better: g_drops_improve > 0 },
    { name: '점프 스크롤 - 효율성', value: j_eff_improve, better: j_eff_improve > 0 },
    { name: '점프 스크롤 - 페이지 수', value: j_pages_improve, better: j_pages_improve > 0 },
    { name: '점프 스크롤 - 점프당 새 페이지', value: j_newPages_improve, better: j_newPages_improve > 0 },
  ];

  improvements.forEach(item => {
    const icon = item.better ? '✅' : '❌';
    console.log(`${icon} ${item.name}: ${item.value > 0 ? '+' : ''}${item.value.toFixed(2)}%`);
  });

  const totalImprovements = improvements.filter(i => i.better).length;
  const avgImprovement = improvements.reduce((sum, i) => sum + i.value, 0) / improvements.length;

  console.log('\n' + '-'.repeat(80));
  console.log(`📊 개선된 메트릭: ${totalImprovements}/${improvements.length}`);
  console.log(`📈 평균 개선율: ${avgImprovement.toFixed(2)}%`);
  
  // 핵심 수치 강조
  console.log('\n💡 핵심 개선 사항:');
  if (g_eff_pdf && g_eff_queue) {
  console.log(`   🎯 점진적 스크롤 - 렌더링 효율: ${g_eff_improve > 0 ? '+' : ''}${g_eff_improve.toFixed(2)}% (${g_eff_pdf.avg.toFixed(2)} → ${g_eff_queue.avg.toFixed(2)} pages/sec)`);
  }
  if (g_pages_pdf && g_pages_queue) {
  console.log(`   🎯 점진적 스크롤 - 페이지 수: ${g_pages_improve > 0 ? '+' : ''}${g_pages_improve.toFixed(2)}% (${g_pages_pdf.avg.toFixed(1)} → ${g_pages_queue.avg.toFixed(1)}개)`);
  }
  if (j_pages_pdf && j_pages_queue) {
  console.log(`   🎯 점프 스크롤 - 페이지 수: ${j_pages_improve > 0 ? '+' : ''}${j_pages_improve.toFixed(2)}% (${j_pages_pdf.avg.toFixed(1)} → ${j_pages_queue.avg.toFixed(1)}개)`);
  }
  console.log('-'.repeat(80));

  // 결과 저장
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(__dirname, 'bench_out');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const resultPath = path.join(outDir, `advanced-comparison-${timestamp}.json`);
  fs.writeFileSync(resultPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    config: CONFIG,
    results: allResults,
    filteredResults: {
      gradual: { pdf: g_pdf, queue: g_queue },
      jump: { pdf: j_pdf, queue: j_queue }
    },
    improvements,
    summary: { 
      totalImprovements, 
      avgImprovement,
      excludedCount: {
        gradual: {
          pdf: g_pdf_excluded,
          queue: g_queue_excluded
        },
        jump: {
          pdf: j_pdf_excluded,
          queue: j_queue_excluded
        }
      }
    }
  }, null, 2));

  console.log(`\n📁 결과 저장: ${resultPath}`);
  console.log('\n✅ 고급 벤치마크 완료!\n');
})();
