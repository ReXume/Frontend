#!/usr/bin/env node
/**
 * Simple vs RAF 버전 성능 비교 벤치마크
 * 
 * 목적:
 * - version=simple vs version=raf 성능 비교
 * - 4x CPU 스로틀링으로 실제 사용자 환경 시뮬레이션
 * - commit/checkout, setState, 프레임 성능 측정
 * 
 * 사용:
 *   node bench/bench-simple-vs-raf-performance.js
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// ---- 설정 ----
const CPU_THROTTLE = 4; // 4x 스로틀링
const RUNS_PER_URL = 5; // URL당 반복 횟수
const HEADLESS = true;

// 비교할 URL들
const TEST_CONFIGS = [
  {
    url: 'http://localhost:3000/feedback/4?version=simple',
    name: 'Simple (IntersectionObserver)',
    shortName: 'simple'
  },
  {
    url: 'http://localhost:3000/feedback/4?version=raf',
    name: 'RAF (requestAnimationFrame)',
    shortName: 'raf'
  }
];

const benchDir = __dirname;
const outDir = path.join(benchDir, 'results');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

/**
 * Simple vs RAF 버전 성능 측정
 */
async function measureVersionPerformance(testConfig, runNumber = 1) {
  console.log(`\n📊 측정 시작 (${runNumber}회차): ${testConfig.name}`);
  console.log(`   URL: ${testConfig.url}`);
  
  const browser = await puppeteer.launch({
    headless: HEADLESS ? 'new' : false,
    defaultViewport: { width: 1920, height: 1080 },
    args: ['--disable-dev-shm-usage', '--no-sandbox'],
    protocolTimeout: 120000, // 2분
  });

  const page = await browser.newPage();
  
  // 타임아웃 설정 (2분)
  page.setDefaultTimeout(120000);

  // CPU throttling 4x 적용
  const client = await page.target().createCDPSession();
  await client.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });
  console.log(`   CPU ${CPU_THROTTLE}x throttling 적용`);

  // 콘솔 로그 포워딩
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('[PerfTrace]') || text.includes('[StateChange]') || text.includes('[Frame]') || text.includes('[Commit]')) {
      console.log(`   ${text}`);
    }
  });

  // 페이지 로드 전 추적 설정
  await page.evaluateOnNewDocument(() => {
    window.__performanceMetrics = {
      startTime: performance.now(),
      navigationStart: performance.now(),
      commits: [],
      setStates: [],
      frameDrops: [],
      longTasks: [],
      scrollEvents: [],
      renderEvents: [],
      version: null,
      reactUpdates: [],
      domMutations: [],
    };

    // React 업데이트 추적을 위한 후킹
    let reactUpdateId = 0;
    
    // MutationObserver로 DOM 변화 추적
    if (window.MutationObserver) {
      const mutationObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            const hasCanvas = Array.from(mutation.addedNodes).some(node => 
              node.nodeType === Node.ELEMENT_NODE && 
              (node.tagName === 'CANVAS' || node.querySelector?.('canvas'))
            );
            
            if (hasCanvas) {
              window.__performanceMetrics.domMutations.push({
                type: 'canvas-added',
                timestamp: performance.now(),
                target: mutation.target.nodeName,
              });
            }
          }
        });
      });
      
      // 페이지 로드 후 DOM 관찰 시작
      setTimeout(() => {
        mutationObserver.observe(document.body, {
          childList: true,
          subtree: true,
        });
      }, 1000);
    }

    // LongTask Observer
    if (window.PerformanceObserver) {
      try {
        const ltObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            window.__performanceMetrics.longTasks.push({
              startTime: entry.startTime,
              duration: entry.duration,
              timestamp: performance.now(),
            });
          }
        });
        ltObserver.observe({ type: 'longtask', buffered: true });

        // Paint Events 추적
        const paintObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            window.__performanceMetrics.renderEvents.push({
              name: entry.name,
              startTime: entry.startTime,
              duration: entry.duration,
              timestamp: performance.now(),
            });
          }
        });
        paintObserver.observe({ type: 'paint', buffered: true });

        // Navigation Timing 추적
        const navObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            window.__performanceMetrics.commits.push({
              type: entry.entryType,
              startTime: entry.startTime,
              duration: entry.duration,
              timestamp: performance.now(),
            });
          }
        });
        navObserver.observe({ type: 'navigation', buffered: true });

      } catch (e) {
        console.warn('[PerformanceObserver] 초기화 실패:', e);
      }
    }

    // 프레임 드롭 측정
    let lastFrameTime = performance.now();
    let frameCount = 0;
    
    function measureFrame() {
      const currentTime = performance.now();
      const frameDuration = currentTime - lastFrameTime;
      
      // 16.67ms 이상이면 프레임 드롭으로 간주
      if (frameDuration > 20) {
        window.__performanceMetrics.frameDrops.push({
          timestamp: currentTime,
          duration: frameDuration,
          expectedDuration: 16.67,
          dropAmount: frameDuration - 16.67,
        });
      }
      
      lastFrameTime = currentTime;
      frameCount++;
      
      if (frameCount % 60 === 0) {
        console.log(`[Frame] 측정된 프레임: ${frameCount}, 드롭: ${window.__performanceMetrics.frameDrops.length}`);
      }
      
      requestAnimationFrame(measureFrame);
    }
    
    requestAnimationFrame(measureFrame);

    // 스크롤 이벤트 추적
    let scrollTimeout;
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        window.__performanceMetrics.scrollEvents.push({
          timestamp: performance.now(),
          scrollY: window.scrollY,
        });
      }, 100);
    }, { passive: true });

    // setState 호출 추적을 위한 전역 후킹
    window.setStateTracker = {
      initialTime: performance.now(),
      calls: [],
      
      trackStateChange: function(componentName, stateType, startTime, endTime) {
        const callData = {
          componentName,
          stateType,
          startTime,
          endTime,
          duration: endTime - startTime,
          timestamp: performance.now(),
        };
        this.calls.push(callData);
        window.__performanceMetrics.setStates.push(callData);
        console.log(`[StateChange] ${componentName} ${stateType}: ${(endTime - startTime).toFixed(2)}ms`);
      }
    };

    // 커밋/체크아웃 추적을 위한 후킹
    window.commitTracker = {
      initialTime: performance.now(),
      commits: [],
      
      trackCommit: function(commitType, startTime, endTime, details = {}) {
        const commitData = {
          commitType,
          startTime,
          endTime,
          duration: endTime - startTime,
          timestamp: performance.now(),
          details,
        };
        this.commits.push(commitData);
        window.__performanceMetrics.commits.push(commitData);
        console.log(`[Commit] ${commitType}: ${(endTime - startTime).toFixed(2)}ms`, details);
      }
    };

    // React 렌더링 사이클 추적을 위한 전역 함수
    window.__reactPerformanceTracker = {
      renderStart: function(componentName) {
        const startTime = performance.now();
        console.log(`[ReactRender] ${componentName} 렌더링 시작: ${startTime.toFixed(2)}ms`);
        return startTime;
      },
      
      renderEnd: function(componentName, startTime) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        window.__performanceMetrics.reactUpdates.push({
          componentName,
          startTime,
          endTime,
          duration,
          timestamp: endTime,
        });
        console.log(`[ReactRender] ${componentName} 렌더링 완료: ${duration.toFixed(2)}ms`);
      },
      
      stateChange: function(componentName, stateName, startTime, endTime) {
        if (window.setStateTracker) {
          window.setStateTracker.trackStateChange(componentName, stateName, startTime, endTime);
        }
      }
    };

    console.log('[PerfTrace] 성능 추적 초기화 완료');
  });

  try {
    // 페이지 로드
    console.log('   페이지 로딩 중...');
    const startTime = Date.now();
    
    await page.goto(testConfig.url, { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });

    // 페이지 로드 완료 대기
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const loadTime = Date.now() - startTime;
    console.log(`   페이지 로드 완료: ${loadTime}ms`);

    // 버전 정보 추출
    await page.evaluate(() => {
      const urlParams = new URLSearchParams(window.location.search);
      const version = urlParams.get('version') || 'unknown';
      window.__performanceMetrics.version = version;
      console.log(`[PerfTrace] 버전: ${version}`);
    });

    // 스크롤 테스트로 상호작용 유도
    console.log('   스크롤 테스트 시작...');
    await page.evaluate(async () => {
      // PDF가 로드될 때까지 대기
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          const hasPDF = document.querySelector('[data-page-number]') || 
                        document.querySelector('canvas') ||
                        document.querySelector('.pdf');
          if (hasPDF || Date.now() - window.__performanceMetrics.startTime > 10000) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 500);
      });
    });

    // 스크롤 시나리오 실행
    const scrollSteps = 10;
    const scrollDelay = 800;
    
    for (let i = 0; i < scrollSteps; i++) {
      await page.evaluate((step) => {
        window.scrollTo(0, step * 500);
        console.log(`[Scroll] 스크롤 단계 ${step + 1}: ${step * 500}px`);
      }, i);
      
      await new Promise(resolve => setTimeout(resolve, scrollDelay));
    }

    // 다시 위로 스크롤
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 최종 메트릭 수집
    console.log('   메트릭 수집 중...');
    const metrics = await page.evaluate(() => {
      const metrics = window.__performanceMetrics;
      
      // 추가 계산 메트릭
      const totalDuration = performance.now() - metrics.startTime;
      
      // LongTask 분석
      const longTaskStats = {
        count: metrics.longTasks.length,
        totalDuration: metrics.longTasks.reduce((sum, task) => sum + task.duration, 0),
        averageDuration: metrics.longTasks.length > 0 ? 
          metrics.longTasks.reduce((sum, task) => sum + task.duration, 0) / metrics.longTasks.length : 0,
        maxDuration: Math.max(...metrics.longTasks.map(task => task.duration), 0),
      };

      // 프레임 드롭 분석
      const frameStats = {
        totalDrops: metrics.frameDrops.length,
        totalDropTime: metrics.frameDrops.reduce((sum, drop) => sum + drop.dropAmount, 0),
        averageDropTime: metrics.frameDrops.length > 0 ?
          metrics.frameDrops.reduce((sum, drop) => sum + drop.dropAmount, 0) / metrics.frameDrops.length : 0,
        maxDropTime: Math.max(...metrics.frameDrops.map(drop => drop.dropAmount), 0),
      };

      // setState 호출 분석 (실제 수집된 데이터 사용)
      const setStateCalls = metrics.setStates || [];
      const setStateStats = {
        totalCalls: setStateCalls.length,
        averageDuration: setStateCalls.length > 0 ?
          setStateCalls.reduce((sum, call) => sum + call.duration, 0) / setStateCalls.length : 0,
        maxDuration: setStateCalls.length > 0 ?
          Math.max(...setStateCalls.map(call => call.duration)) : 0,
      };

      // 커밋 분석 (실제 수집된 데이터 사용)
      const commitCalls = metrics.commits || [];
      const commitStats = {
        totalCommits: commitCalls.length,
        averageDuration: commitCalls.length > 0 ?
          commitCalls.reduce((sum, commit) => sum + commit.duration, 0) / commitCalls.length : 0,
        maxDuration: commitCalls.length > 0 ?
          Math.max(...commitCalls.map(commit => commit.duration)) : 0,
      };

      // React 업데이트 분석
      const reactStats = {
        totalUpdates: metrics.reactUpdates.length,
        averageDuration: metrics.reactUpdates.length > 0 ?
          metrics.reactUpdates.reduce((sum, update) => sum + update.duration, 0) / metrics.reactUpdates.length : 0,
        maxDuration: metrics.reactUpdates.length > 0 ?
          Math.max(...metrics.reactUpdates.map(update => update.duration)) : 0,
      };

      // DOM 변화 분석
      const domStats = {
        totalMutations: metrics.domMutations.length,
        canvasAdditions: metrics.domMutations.filter(m => m.type === 'canvas-added').length,
      };

      return {
        ...metrics,
        totalDuration,
        longTaskStats,
        frameStats,
        setStateStats,
        commitStats,
        reactStats,
        domStats,
        scrollEventsCount: metrics.scrollEvents.length,
        renderEventsCount: metrics.renderEvents.length,
      };
    });

    console.log(`   측정 완료: ${metrics.totalDuration.toFixed(2)}ms`);
    console.log(`   LongTask: ${metrics.longTaskStats.count}개, 총 ${metrics.longTaskStats.totalDuration.toFixed(2)}ms`);
    console.log(`   프레임 드롭: ${metrics.frameStats.totalDrops}개, 총 손실 ${metrics.frameStats.totalDropTime.toFixed(2)}ms`);
    console.log(`   setState 호출: ${metrics.setStateStats.totalCalls}회`);
    console.log(`   React 업데이트: ${metrics.reactStats.totalUpdates}회, 평균 ${metrics.reactStats.averageDuration.toFixed(2)}ms`);
    console.log(`   커밋: ${metrics.commitStats.totalCommits}회, 캔버스 추가: ${metrics.domStats.canvasAdditions}개`);
    
    // 커밋 유형별 상세 분석
    const commitCalls = metrics.commits || [];
    const commitTypes = commitCalls.reduce((acc, commit) => {
      const type = commit.details?.type || commit.commitType || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
    
    if (Object.keys(commitTypes).length > 0) {
      console.log(`   커밋 유형별:`, commitTypes);
    }

    await browser.close();
    
    return {
      ...metrics,
      loadTime,
      runNumber,
      config: testConfig,
      timestamp: new Date().toISOString(),
    };

  } catch (error) {
    console.error(`   ❌ 측정 실패: ${error.message}`);
    await browser.close();
    throw error;
  }
}

/**
 * 메인 실행 함수
 */
async function main() {
  console.log('🚀 Simple vs RAF 성능 비교 벤치마크 시작');
  console.log(`📊 설정: CPU ${CPU_THROTTLE}x 스로틀링, URL당 ${RUNS_PER_URL}회 실행`);

  const allResults = [];

  for (const config of TEST_CONFIGS) {
    console.log(`\n🔍 ${config.name} 테스트 시작`);
    
    const configResults = [];
    
    for (let run = 1; run <= RUNS_PER_URL; run++) {
      try {
        const result = await measureVersionPerformance(config, run);
        configResults.push(result);
        
        // 실행 간 잠시 대기
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`❌ ${config.name} ${run}회차 실패:`, error.message);
      }
    }
    
    allResults.push({
      config,
      results: configResults,
    });
  }

  // 결과 분석 및 저장
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputFile = path.join(outDir, `simple-vs-raf-performance-${timestamp}.json`);
  
  const summaryReport = {
    timestamp: new Date().toISOString(),
    settings: {
      cpuThrottle: CPU_THROTTLE,
      runsPerUrl: RUNS_PER_URL,
      headless: HEADLESS,
    },
    results: allResults,
    comparison: generateComparison(allResults),
  };

  fs.writeFileSync(outputFile, JSON.stringify(summaryReport, null, 2));
  
  console.log('\n📈 결과 요약:');
  console.log(`📄 상세 결과: ${outputFile}`);
  
  // 간단한 비교 출력
  printComparisonSummary(summaryReport.comparison);

  console.log('\n✅ 벤치마크 완료!');
}

/**
 * 결과 비교 분석
 */
function generateComparison(allResults) {
  const comparison = {};
  
  for (const { config, results } of allResults) {
    if (results.length === 0) continue;
    
    const key = config.shortName;
    
    // 평균 계산
    comparison[key] = {
      config: config,
      averageLoadTime: results.reduce((sum, r) => sum + r.loadTime, 0) / results.length,
      averageTotalDuration: results.reduce((sum, r) => sum + r.totalDuration, 0) / results.length,
      averageLongTasks: results.reduce((sum, r) => sum + r.longTaskStats.count, 0) / results.length,
      averageLongTaskDuration: results.reduce((sum, r) => sum + r.longTaskStats.totalDuration, 0) / results.length,
      averageFrameDrops: results.reduce((sum, r) => sum + r.frameStats.totalDrops, 0) / results.length,
      averageFrameDropTime: results.reduce((sum, r) => sum + r.frameStats.totalDropTime, 0) / results.length,
      averageSetStateCalls: results.reduce((sum, r) => sum + r.setStateStats.totalCalls, 0) / results.length,
      averageSetStateDuration: results.reduce((sum, r) => sum + r.setStateStats.averageDuration, 0) / results.length,
      averageReactUpdates: results.reduce((sum, r) => sum + r.reactStats.totalUpdates, 0) / results.length,
      averageReactUpdateDuration: results.reduce((sum, r) => sum + r.reactStats.averageDuration, 0) / results.length,
      averageCommits: results.reduce((sum, r) => sum + r.commitStats.totalCommits, 0) / results.length,
      averageCanvasAdditions: results.reduce((sum, r) => sum + r.domStats.canvasAdditions, 0) / results.length,
      runCount: results.length,
    };
  }
  
  return comparison;
}

/**
 * 비교 결과 요약 출력
 */
function printComparisonSummary(comparison) {
  if (!comparison.simple || !comparison.raf) {
    console.log('❌ 비교할 데이터가 부족합니다.');
    return;
  }
  
  console.log('\n📊 성능 비교 (Simple vs RAF):');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`항목                    | Simple      | RAF         | 개선율`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // 로드 시간
  const loadTimeSimple = comparison.simple.averageLoadTime;
  const loadTimeRAF = comparison.raf.averageLoadTime;
  const loadTimeImprovement = ((loadTimeSimple - loadTimeRAF) / loadTimeSimple * 100).toFixed(1);
  console.log(`페이지 로드 시간 (ms)    | ${loadTimeSimple.toFixed(1).padStart(10)} | ${loadTimeRAF.toFixed(1).padStart(10)} | ${loadTimeImprovement}%`);
  
  // LongTask
  const longTaskSimple = comparison.simple.averageLongTaskDuration;
  const longTaskRAF = comparison.raf.averageLongTaskDuration;
  const longTaskImprovement = longTaskSimple > 0 ? ((longTaskSimple - longTaskRAF) / longTaskSimple * 100).toFixed(1) : '0.0';
  console.log(`LongTask 총 시간 (ms)    | ${longTaskSimple.toFixed(1).padStart(10)} | ${longTaskRAF.toFixed(1).padStart(10)} | ${longTaskImprovement}%`);
  
  // 프레임 드롭
  const frameDropSimple = comparison.simple.averageFrameDropTime;
  const frameDropRAF = comparison.raf.averageFrameDropTime;
  const frameDropImprovement = frameDropSimple > 0 ? ((frameDropSimple - frameDropRAF) / frameDropSimple * 100).toFixed(1) : '0.0';
  console.log(`프레임 드롭 시간 (ms)    | ${frameDropSimple.toFixed(1).padStart(10)} | ${frameDropRAF.toFixed(1).padStart(10)} | ${frameDropImprovement}%`);
  
  // setState 호출
  const setStateSimple = comparison.simple.averageSetStateCalls;
  const setStateRAF = comparison.raf.averageSetStateCalls;
  console.log(`setState 호출 수         | ${setStateSimple.toFixed(1).padStart(10)} | ${setStateRAF.toFixed(1).padStart(10)} | -`);
  
  // React 업데이트
  const reactUpdateSimple = comparison.simple.averageReactUpdates;
  const reactUpdateRAF = comparison.raf.averageReactUpdates;
  const reactUpdateImprovement = reactUpdateSimple > 0 ? ((reactUpdateSimple - reactUpdateRAF) / reactUpdateSimple * 100).toFixed(1) : '0.0';
  console.log(`React 업데이트 수        | ${reactUpdateSimple.toFixed(1).padStart(10)} | ${reactUpdateRAF.toFixed(1).padStart(10)} | ${reactUpdateImprovement}%`);
  
  // 커밋 수
  const commitSimple = comparison.simple.averageCommits;
  const commitRAF = comparison.raf.averageCommits;
  console.log(`커밋 수                  | ${commitSimple.toFixed(1).padStart(10)} | ${commitRAF.toFixed(1).padStart(10)} | -`);
  
  // 캔버스 추가 수
  const canvasSimple = comparison.simple.averageCanvasAdditions;
  const canvasRAF = comparison.raf.averageCanvasAdditions;
  console.log(`캔버스 추가 수           | ${canvasSimple.toFixed(1).padStart(10)} | ${canvasRAF.toFixed(1).padStart(10)} | -`);
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

// 실행
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { measureVersionPerformance, generateComparison };
