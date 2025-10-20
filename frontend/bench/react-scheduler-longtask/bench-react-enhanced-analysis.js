#!/usr/bin/env node
/**
 * React Scheduler Enhanced LongTask 분석 벤치마크
 * 
 * 기존 longtask-analytics.js를 React 스케줄러 분석으로 확장
 * - React 렌더링 루프 내부의 scheduler → w, uE, ux, uk 함수들 추적
 * - 성능 탭에서 관측된 3번의 LongTask 패턴 분석
 * - React 스케줄러와 LongTask 발생의 상관관계 분석
 * 
 * 사용법:
 *   node bench/react-scheduler-longtask/bench-react-enhanced-analysis.js --url "http://localhost:3000/feedback/4"
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// 인자 파싱
function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  if (i === -1) return def;
  const next = process.argv[i + 1];
  if (!next || next.startsWith('--')) return true;
  return next;
}

const singleUrl = arg('url', null);
const url1 = arg('url1', null);
const url2 = arg('url2', null);
const name1 = arg('name1', 'Version 1');
const name2 = arg('name2', 'Version 2');
const cpuThrottle = parseFloat(arg('cpu', '4'));
const headless = String(arg('headless', 'true')) === 'true';
const scrollSteps = parseInt(arg('steps', '8'), 10);
const stepDelay = parseInt(arg('delay', '800'), 10);
const scrollRange = parseFloat(arg('range', '0.3'));
const outputFile = arg('output', null);

const benchDir = __dirname;
const outDir = path.join(benchDir, 'results');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

/**
 * React 스케줄러 확장 LongTask 분석 메인 함수
 */
async function analyzeReactSchedulerLongTasks(testUrl, versionName) {
  console.log(`\n⚛️ React 스케줄러 LongTask 분석: ${versionName}`);
  console.log(`   URL: ${testUrl}`);
  
  const browser = await puppeteer.launch({
    headless: headless ? 'new' : false,
    defaultViewport: { width: 1920, height: 1080 },
    args: [
      '--disable-dev-shm-usage', 
      '--no-sandbox',
      '--enable-precise-memory-info',
      '--enable-gpu-rasterization'
    ],
    protocolTimeout: 120000,
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(120000);

  // CPU 스로틀링
  if (cpuThrottle > 1) {
    const client = await page.target().createCDPSession();
    await client.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottle });
    console.log(`   CPU ${cpuThrottle}x throttling 적용`);
  }

  // 콘솔 로그 포워딩
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('[LongTask]') || text.includes('[EventTrace]') || 
        text.includes('[PDFTrace]') || text.includes('[ReactScheduler]')) {
      console.log(`   ${text}`);
    }
  });

  // 페이지 로드 전 React 스케줄러 추적 설정
  await page.evaluateOnNewDocument(() => {
    window.__longTaskAnalytics = {
      longTasks: [],
      performanceEntries: [],
      userEvents: [],
      pdfEvents: [],
      renderEvents: [],
      navigationEvents: [],
      resourceEvents: [],
      layoutEvents: [],
      scriptEvents: [],
      cssEvents: [],
      networkEvents: [],
      domEvents: [],
      startTime: null,
      eventCounter: 0,
      stackTraces: new Map(),
      // React 스케줄러 확장 분석
      reactSchedulerCalls: [],
      reactRenderCommits: [],
      reactFunctionCalls: {
        scheduler: [],
        reconcile: [],
        render: [],
        commit: [],
        effect: [],
        memoized: []
      },
      bottleneckAnalysis: {
        slowOperations: [],
        heavyScripts: [],
        largeLayouts: [],
        expensivePaints: [],
        networkBottlenecks: []
      }
    };

    // React DevTools Hook 설정 (더 자세한 추적)
    if (typeof window !== 'undefined') {
      window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = window.__REACT_DEVTOOLS_GLOBAL_HOOK__ || {};
      
      // Fiber root 커밋 추적
      const originalOnCommitFiberRoot = window.__REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberRoot;
      window.__REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberRoot = function(id, root, priorityLevel) {
        const timestamp = performance.now();
        
        window.__longTaskAnalytics.reactRenderCommits.push({
          rootId: id,
          priorityLevel: priorityLevel,
          timestamp: timestamp,
          id: `commit_${++window.__longTaskAnalytics.eventCounter}`,
        });
        
        console.log(`[ReactScheduler] Render Commit @ ${timestamp.toFixed(2)}ms (priority: ${priorityLevel})`);
        
        if (originalOnCommitFiberRoot) {
          return originalOnCommitFiberRoot.call(this, id, root, priorityLevel);
        }
      };
    }

    // Performance Observer 설정 (기존 + React 확장)
    try {
      if ('PerformanceObserver' in window) {
        // LongTask Observer with React context enhancement
        const ltObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const timestamp = performance.now();
            
            // LongTask attribution 정보 수집
            let attribution = null;
            let reactContext = null;
            let schedulerContext = null;
            
            try {
              // entry.attribution에서 정보 추출
              if (entry.attribution && entry.attribution.length > 0) {
                const firstAttribution = entry.attribution[0];
                attribution = {
                  containerName: firstAttribution.containerName || 'unknown',
                  containerSrc: firstAttribution.containerSrc || 'unknown',
                  containerId: firstAttribution.containerId || 'unknown',
                  containerType: firstAttribution.containerType || 'unknown',
                  scriptURL: firstAttribution.scriptURL || 'unknown',
                  longestDuration: firstAttribution.longestDuration || 0,
                };
              }
              
              // React 컨텍스트 정보 수집
              const currentEntries = performance.getEntriesByType('measure');
              const recentMeasures = currentEntries.filter(measure => 
                measure.startTime >= entry.startTime - 200 && 
                measure.startTime <= entry.startTime + entry.duration
              );
              
              // 최근 React 스케줄러 호출들 찾기
              const schedulerCalls = window.__longTaskAnalytics.reactSchedulerCalls.filter(call => 
                call.timestamp >= entry.startTime - 500 && 
                call.timestamp <= entry.startTime + entry.duration + 500
              );
              
              // 최근 render commits 찾기
              const recentCommits = window.__longTaskAnalytics.reactRenderCommits.filter(commit => 
                commit.timestamp >= entry.startTime - 800 && 
                commit.timestamp <= entry.startTime + entry.duration + 800
              );
              
              // 근처 PDF 이벤트 찾기
              const nearbyPdfEvents = window.__longTaskAnalytics.pdfEvents.filter(event => 
                event.timestamp >= entry.startTime - 300 && 
                event.timestamp <= entry.startTime + entry.duration + 300
              );
              
              reactContext = {
                recentMeasures: recentMeasures.map(m => ({ 
                  name: m.name, 
                  duration: m.duration, 
                  startTime: m.startTime 
                })),
                schedulerCalls: schedulerCalls.map(c => ({
                  type: c.type || 'unknown',
                  message: c.message?.substring(0, 150) || '',
                  timestamp: c.timestamp,
                  priority: c.priority
                })),
                recentCommits: recentCommits.map(c => ({
                  priorityLevel: c.priorityLevel,
                  timestamp: c.timestamp,
                  rootId: c.rootId
                })),
                nearbyPdfEvents: nearbyPdfEvents.map(e => ({
                  page: e.page,
                  totalMs: e.totalMs,
                  timestamp: e.timestamp
                }))
              };
              
              // 스케줄러 컨텍스트 분석
              const stackTrace = new Error().stack || '';
              const schedulerFunctions = ['scheduler', 'unstable_runWithPriority', 'flushSync', 'workLoop', 'performWorkOnRoot'];
              const hasSchedulerFunctions = schedulerFunctions.some(func => stackTrace.includes(func));
              
              schedulerContext = {
                stackSnippets: stackTrace.split('\n').slice(1, 10).map(line => line.trim()),
                hasReactSchedulerFunctions: hasSchedulerFunctions,
                schedulerFunctionMatches: schedulerFunctions.filter(func => stackTrace.includes(func))
              };
              
            } catch (e) {
              reactContext = { error: e.message };
              schedulerContext = { error: e.message };
            }
            
            const longTaskData = {
              startTime: entry.startTime,
              duration: entry.duration,
              timestamp: timestamp,
              name: entry.name || 'unknown',
              attribution: attribution,
              reactContext: reactContext,
              schedulerContext: schedulerContext,
              stackTrace: stackTrace,
              id: `lt_${++window.__longTaskAnalytics.eventCounter}`,
            };
            
            window.__longTaskAnalytics.longTasks.push(longTaskData);
            
            console.log(`[LongTask] ${entry.duration.toFixed(2)}ms @ ${entry.startTime.toFixed(2)}ms`);
            
            // React 스케줄러 관련 LongTask 감지
            if (reactContext?.schedulerCalls?.length > 0 || 
                reactContext?.recentCommits?.length > 0 ||
                schedulerContext?.hasReactSchedulerFunctions) {
              console.log(`[ReactScheduler] React 관련 LongTask 감지 - 스케줄러: ${reactContext?.schedulerCalls?.length || 0}개, 커밋: ${reactContext?.recentCommits?.length || 0}개, 함수: ${schedulerContext?.hasReactSchedulerFunctions ? 'Yes' : 'No'}`);
            }
          }
        });
        
        ltObserver.observe({ type: 'longtask', buffered: true });
        console.log('[ReactScheduler] LongTask Observer 등록 완료');
        
        // Measure Observer (React 렌더링 측정)
        const measureObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            window.__longTaskAnalytics.performanceEntries.push({
              name: entry.name,
              startTime: entry.startTime,
              duration: entry.duration || 0,
              entryType: entry.entryType,
              timestamp: performance.now(),
              id: `perf_${++window.__longTaskAnalytics.eventCounter}`,
            });
            
            // React 관련 measure 감지
            if (entry.name.includes('react') || entry.name.includes('scheduler') || 
                entry.name.includes('render') || entry.name.includes('commit')) {
              console.log(`[ReactScheduler] React measure: ${entry.name} (${entry.duration.toFixed(2)}ms)`);
            }
          }
        });
        measureObserver.observe({ type: 'measure', buffered: true });

        // 기존 다른 Observer들도 유지...
        // (Navigation, Resource, Layout 등은 기존 코드 유지)
      }
    } catch (e) {
      console.error('[ReactScheduler] Observer 초기화 실패:', e);
    }

    // React 함수 호출 패칭
    const patchReactFunctions = () => {
      try {
        // setTimeout/setInterval을 통한 React 스케줄러 추적
        const originalSetTimeout = window.setTimeout;
        const originalSetInterval = window.setInterval;
        
        window.setTimeout = function(callback, delay, ...args) {
          const timestamp = performance.now();
          const stack = new Error().stack;
          
          if (stack && (stack.includes('scheduler') || stack.includes('workLoop') || 
                       stack.includes('flushSync') || stack.includes('unstable_runWithPriority'))) {
            const schedulerCall = {
              type: 'setTimeout',
              delay: delay,
              timestamp: timestamp,
              stack: stack.split('\n').slice(1, 5),
              id: `scheduler_${++window.__longTaskAnalytics.eventCounter}`,
            };
            window.__longTaskAnalytics.reactSchedulerCalls.push(schedulerCall);
            console.log(`[ReactScheduler] setTimeout from scheduler context @ ${timestamp.toFixed(2)}ms (delay: ${delay}ms)`);
          }
          
          return originalSetTimeout.call(this, callback, delay, ...args);
        };
        
        // ReactDOM.flushSync 추적
        if (typeof window.ReactDOM !== 'undefined' && window.ReactDOM.flushSync) {
          const originalFlushSync = window.ReactDOM.flushSync;
          window.ReactDOM.flushSync = function(callback) {
            const timestamp = performance.now();
            console.log(`[ReactScheduler] flushSync start @ ${timestamp.toFixed(2)}ms`);
            
            performance.mark(`react-flushsync-start-${timestamp}`);
            const result = originalFlushSync.call(this, callback);
            performance.mark(`react-flushsync-end-${timestamp}`);
            performance.measure(`react-flushsync-duration-${timestamp}`, 
              `react-flushsync-start-${timestamp}`, `react-flushsync-end-${timestamp}`);
            
            const endTime = performance.now();
            window.__longTaskAnalytics.reactSchedulerCalls.push({
              type: 'flushSync',
              duration: endTime - timestamp,
              timestamp: timestamp,
              id: `flushsync_${++window.__longTaskAnalytics.eventCounter}`,
            });
            
            console.log(`[ReactScheduler] flushSync end @ ${endTime.toFixed(2)}ms (${(endTime - timestamp).toFixed(2)}ms)`);
            return result;
          };
        }
        
        console.log('[ReactScheduler] React 함수 패칭 완료');
        
      } catch (e) {
        console.error('[ReactScheduler] React 함수 패칭 실패:', e);
      }
    };

    // React 로드 후 패칭
    const tryPatchReact = () => {
      if (typeof window.React !== 'undefined' || typeof window.ReactDOM !== 'undefined') {
        patchReactFunctions();
      } else {
        setTimeout(tryPatchReact, 100);
      }
    };

    document.addEventListener('DOMContentLoaded', tryPatchReact);
    tryPatchReact();

    // PDF 렌더링 메트릭 수집 (기존과 호환)
    window.pdfRenderMetricsCollector = {
      metrics: [],
      add: function(metric) {
        this.metrics.push(metric);
        const timestamp = performance.now();
        
        const event = {
          ...metric,
          timestamp: timestamp,
          id: `pdf_${++window.__longTaskAnalytics.eventCounter}`,
        };
        window.__longTaskAnalytics.pdfEvents.push(event);
        window.__longTaskAnalytics.renderEvents.push(event);
        
        console.log(`[ReactScheduler] PDF Page ${metric.page} rendered in ${metric.totalMs}ms @ ${timestamp.toFixed(2)}ms`);
      }
    };
  });

  console.log('   페이지 이동 중...');
  await page.goto(testUrl, { 
    waitUntil: ['networkidle2', 'domcontentloaded'], 
    timeout: 120000
  });

  console.log('   페이지 로드 완료, 초기화 대기...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // React 버전 및 분석 상태 확인
  const debugInfo = await page.evaluate(() => {
    return {
      longTaskObserverSupported: 'PerformanceObserver' in window,
      pdfCollectorExists: typeof window.pdfRenderMetricsCollector !== 'undefined',
      schedulerAnalyticsExists: typeof window.__longTaskAnalytics !== 'undefined',
      reactDevToolsHook: typeof window.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== 'undefined',
      hasReact: typeof window.React !== 'undefined',
      hasReactDOM: typeof window.ReactDOM !== 'undefined',
      initialLongTasks: window.__longTaskAnalytics?.longTasks?.length || 0,
      initialSchedulerCalls: window.__longTaskAnalytics?.reactSchedulerCalls?.length || 0,
      initialCommits: window.__longTaskAnalytics?.reactRenderCommits?.length || 0,
    };
  });
  
  console.log('   디버그 정보:', debugInfo);

  // 측정 시작 시간 설정
  await page.evaluate(() => {
    window.__longTaskAnalytics.startTime = performance.now();
  });

  // 버전 정보 확인
  const versionInfo = await page.evaluate(() => {
    const versionDiv = document.querySelector('.bg-blue-100');
    return {
      versionText: versionDiv?.textContent?.trim() || 'Unknown',
      hasCollector: typeof window.pdfRenderMetricsCollector !== 'undefined',
      url: window.location.href,
    };
  });
  
  console.log('   버전 정보:', versionInfo.versionText);

  console.log('   스크롤 시뮬레이션 시작...');
  
  // 스크롤 시뮬레이션 및 React 분석
  const result = await page.evaluate(async (scrollSteps, stepDelay, scrollRange) => {
    const scrollContainer = Array.from(document.querySelectorAll('div'))
      .find(div => {
        const style = window.getComputedStyle(div);
        return style.overflowY === 'auto' && div.scrollHeight > div.clientHeight;
      });
    
    if (!scrollContainer) {
      console.error('[ReactScheduler] 스크롤 컨테이너를 찾을 수 없습니다');
      return { success: false, error: 'No scroll container found' };
    }

    const fullMaxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
    const maxScroll = Math.min(fullMaxScroll * scrollRange, 50000);
    console.log(`[ReactScheduler] 스크롤 컨테이너: ${scrollContainer.scrollHeight}px (최대: ${maxScroll}px)`);

    // 단계별 스크롤과 React 렌더링 루프 분석
    for (let i = 0; i <= scrollSteps; i++) {
      const beforeLongTasks = window.__longTaskAnalytics.longTasks.length;
      const beforeSchedulerCalls = window.__longTaskAnalytics.reactSchedulerCalls.length;
      const beforeRenderCommits = window.__longTaskAnalytics.reactRenderCommits.length;
      
      const targetScrollPosition = (maxScroll / scrollSteps) * i;
      scrollContainer.scrollTop = targetScrollPosition;
      
      console.log(`[ReactScheduler] 스크롤 Step ${i}/${scrollSteps}: ${targetScrollPosition.toFixed(0)}px`);
      
      await new Promise(r => setTimeout(r, stepDelay));
      
      const afterLongTasks = window.__longTaskAnalytics.longTasks.length;
      const afterSchedulerCalls = window.__longTaskAnalytics.reactSchedulerCalls.length;
      const afterRenderCommits = window.__longTaskAnalytics.reactRenderCommits.length;
      
      const newLongTasks = afterLongTasks - beforeLongTasks;
      const newSchedulerCalls = afterSchedulerCalls - beforeSchedulerCalls;
      const newRenderCommits = afterRenderCommits - beforeRenderCommits;
      
      console.log(`[ReactScheduler] Step ${i} 결과:`);
      console.log(`   - LongTask: +${newLongTasks}개 (누적: ${afterLongTasks}개)`);
      console.log(`   - 스케줄러 호출: +${newSchedulerCalls}개 (누적: ${afterSchedulerCalls}개)`);
      console.log(`   - 렌더 커밋: +${newRenderCommits}개 (누적: ${afterRenderCommits}개)`);
      
      // React 관련 LongTask가 발생한 경우 상세 분석
      if (newLongTasks > 0) {
        const recentLongTasks = window.__longTaskAnalytics.longTasks.slice(-newLongTasks);
        recentLongTasks.forEach((task, idx) => {
          console.log(`   🔍 LongTask ${idx + 1} 분석:`);
          console.log(`      - 지속시간: ${task.duration.toFixed(2)}ms @ ${task.startTime.toFixed(2)}ms`);
          
          if (task.reactContext?.schedulerCalls?.length > 0) {
            console.log(`      - 관련 스케줄러 호출: ${task.reactContext.schedulerCalls.length}개`);
          }
          
          if (task.reactContext?.recentCommits?.length > 0) {
            console.log(`      - 관련 렌더 커밋: ${task.reactContext.recentCommits.length}개`);
          }
          
          if (task.schedulerContext?.hasReactSchedulerFunctions) {
            console.log(`      - React 스케줄러 함수 포함됨: ${task.schedulerContext.schedulerFunctionMatches.join(', ')}`);
          }
        });
      }
    }

    const endTime = performance.now();
    const startTime = window.__longTaskAnalytics.startTime || 0;

    return {
      success: true,
      duration: endTime - startTime,
      analytics: window.__longTaskAnalytics,
    };
  }, scrollSteps, stepDelay, scrollRange);

  await browser.close();

  if (!result.success) {
    console.error(`   ❌ 분석 실패: ${result.error || 'Unknown error'}`);
    return null;
  }

  const analytics = result.analytics;
  console.log(`   ✅ React 스케줄러 분석 완료`);
  console.log(`      - LongTask: ${analytics.longTasks.length}개`);
  console.log(`      - React 스케줄러 호출: ${analytics.reactSchedulerCalls.length}개`);
  console.log(`      - 렌더 커밋: ${analytics.reactRenderCommits.length}개`);
  console.log(`      - PDF 이벤트: ${analytics.pdfEvents.length}개`);

  return {
    version: versionName,
    detectedVersion: versionInfo.versionText,
    url: testUrl,
    duration: result.duration,
    analytics: analytics,
    timestamp: new Date().toISOString(),
  };
}

/**
 * React 스케줄러 LongTask 상세 분석
 */
function analyzeReactSchedulerLongTasks(data) {
  console.log(`\n⚛️ React 스케줄러 LongTask 분석: ${data.version}`);
  console.log('='.repeat(80));

  const analytics = data.analytics;
  if (!analytics) {
    console.log('❌ analytics 데이터가 없습니다.');
    return;
  }

  const { longTasks = [], reactSchedulerCalls = [], reactRenderCommits = [], pdfEvents = [] } = analytics;

  if (longTasks.length === 0) {
    console.log('✅ LongTask가 감지되지 않았습니다.');
    return;
  }

  // LongTask 통계
  const totalBlockingTime = longTasks.reduce((sum, task) => sum + Math.max(0, task.duration - 50), 0);
  const avgDuration = longTasks.reduce((sum, task) => sum + task.duration, 0) / longTasks.length;
  const maxDuration = Math.max(...longTasks.map(task => task.duration));

  console.log(`\n⏱️  LongTask 기본 통계:`);
  console.log(`   총 LongTask: ${longTasks.length}개`);
  console.log(`   평균 지속시간: ${avgDuration.toFixed(2)}ms`);
  console.log(`   최대 지속시간: ${maxDuration.toFixed(2)}ms`);
  console.log(`   Total Blocking Time: ${totalBlockingTime.toFixed(2)}ms`);

  // React 관련 LongTask 분석
  console.log(`\n⚛️ React 관련 LongTask 분석:`);
  
  const reactRelatedTasks = longTasks.filter(task => 
    task.reactContext?.schedulerCalls?.length > 0 || 
    task.reactContext?.recentCommits?.length > 0 ||
    task.schedulerContext?.hasReactSchedulerFunctions
  );
  
  const pureReactSchedulerTasks = longTasks.filter(task => 
    task.schedulerContext?.hasReactSchedulerFunctions
  );
  
  const tasksWithCommits = longTasks.filter(task => 
    task.reactContext?.recentCommits?.length > 0
  );
  
  const tasksWithPdfRendering = longTasks.filter(task => 
    task.reactContext?.nearbyPdfEvents?.length > 0
  );

  console.log(`   React 관련 LongTask: ${reactRelatedTasks.length}/${longTasks.length}개 (${(reactRelatedTasks.length/longTasks.length*100).toFixed(1)}%)`);
  console.log(`   스케줄러 함수 포함: ${pureReactSchedulerTasks.length}개`);
  console.log(`   렌더 커밋 관련: ${tasksWithCommits.length}개`);
  console.log(`   PDF 렌더링 연관: ${tasksWithPdfRendering.length}개`);

  // 가장 문제가 되는 LongTask들 상세 분석
  console.log(`\n🎯 Top 10 문제 LongTask 상세 분석:`);
  const sortedTasks = [...longTasks].sort((a, b) => b.duration - a.duration);
  sortedTasks.slice(0, 10).forEach((task, idx) => {
    console.log(`\n   ${idx + 1}. ${task.duration.toFixed(2)}ms LongTask @ ${(task.startTime / 1000).toFixed(3)}s`);
    
    // React 컨텍스트 정보
    if (task.reactContext) {
      if (task.reactContext.schedulerCalls?.length > 0) {
        console.log(`      ⚛️ 관련 스케줄러 호출: ${task.reactContext.schedulerCalls.length}개`);
        task.reactContext.schedulerCalls.slice(0, 3).forEach((call, callIdx) => {
          console.log(`         ${callIdx + 1}. ${call.type}: ${call.message?.substring(0, 60) || 'No details'}`);
        });
      }
      
      if (task.reactContext.recentCommits?.length > 0) {
        console.log(`      🔄 관련 렌더 커밋: ${task.reactContext.recentCommits.length}개`);
        task.reactContext.recentCommits.slice(0, 3).forEach((commit, commitIdx) => {
          console.log(`         ${commitIdx + 1}. Priority: ${commit.priorityLevel} @ ${commit.timestamp.toFixed(2)}ms`);
        });
      }
      
      if (task.reactContext.nearbyPdfEvents?.length > 0) {
        console.log(`      📄 근처 PDF 렌더링: ${task.reactContext.nearbyPdfEvents.length}개`);
      }
    }
    
    // 스케줄러 컨텍스트 정보
    if (task.schedulerContext?.hasReactSchedulerFunctions) {
      console.log(`      📋 React 스케줄러 함수: ${task.schedulerContext.schedulerFunctionMatches.join(', ')}`);
    }
  });
}

/**
 * 메인 실행
 */
(async () => {
  const urls = [];
  
  if (singleUrl) {
    urls.push({ url: singleUrl, name: 'Test' });
  } else {
    if (url1) urls.push({ url: url1, name: name1 });
    if (url2) urls.push({ url: url2, name: name2 });
  }

  if (urls.length === 0) {
    console.error('❌ URL을 지정해주세요 (--url 또는 --url1, --url2)');
    console.error('\n사용 예:');
    console.error('  node bench/react-scheduler-longtask/bench-react-enhanced-analysis.js --url "http://localhost:3000/feedback/4"');
    console.error('  node bench/react-scheduler-longtask/bench-react-enhanced-analysis.js --url1 "..." --name1 "PDF" --url2 "..." --name2 "Queue"');
    process.exit(1);
  }

  console.log('\n⚛️ React Scheduler Enhanced LongTask 분석 벤치마크');
  console.log('='.repeat(80));
  console.log(`설정:`);
  console.log(`  - CPU Throttle: ${cpuThrottle}x`);
  console.log(`  - 스크롤 단계: ${scrollSteps}단계, ${stepDelay}ms 간격`);
  console.log(`  - 스크롤 범위: 전체의 ${(scrollRange * 100).toFixed(0)}%`);
  console.log(`  - Headless: ${headless}`);

  const results = [];

  for (const { url, name } of urls) {
    const result = await analyzeReactSchedulerLongTasks(url, name);
    if (result && result.analytics) {
      results.push(result);
      analyzeReactSchedulerLongTasks(result);
    } else {
      console.log(`❌ ${name} 분석 실패 또는 데이터 없음`);
    }
  }

  // 결과 저장
  let outputPath;
  if (outputFile) {
    outputPath = path.isAbsolute(outputFile) ? outputFile : path.join(benchDir, outputFile);
  } else {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    outputPath = path.join(outDir, `react-enhanced-analysis-${timestamp}.json`);
  }
  
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const summary = {
    timestamp: new Date().toISOString(),
    config: {
      cpuThrottle,
      scrollSteps,
      stepDelay,
      headless,
      scrollRange,
    },
    results: results,
  };

  fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));

  console.log(`\n\n💾 결과 저장: ${outputPath}`);
  console.log(`   분석된 버전: ${results.length}개`);
  
  // 최종 요약
  console.log('\n' + '='.repeat(80));
  console.log('📋 React 스케줄러 분석 최종 요약');
  console.log('='.repeat(80));
  
  results.forEach(result => {
    const analytics = result.analytics;
    if (!analytics) return;
    
    const { longTasks = [], reactSchedulerCalls = [], reactRenderCommits = [], pdfEvents = [] } = analytics;
    const totalBlockingTime = longTasks.reduce((sum, task) => sum + Math.max(0, task.duration - 50), 0);
    
    const reactRelatedTasks = longTasks.filter(task => 
      task.reactContext?.schedulerCalls?.length > 0 || 
      task.reactContext?.recentCommits?.length > 0 ||
      task.schedulerContext?.hasReactSchedulerFunctions
    );
    
    console.log(`\n🔹 ${result.version}:`);
    console.log(`   📊 총 LongTask: ${longTasks.length}개 (TBT: ${totalBlockingTime.toFixed(1)}ms)`);
    console.log(`   ⚛️ React 관련 LongTask: ${reactRelatedTasks.length}개 (${(reactRelatedTasks.length/longTasks.length*100).toFixed(1)}%)`);
    console.log(`   🔧 스케줄러 호출: ${reactSchedulerCalls.length}개`);
    console.log(`   🔄 렌더 커밋: ${reactRenderCommits.length}개`);
    console.log(`   📄 PDF 렌더링: ${pdfEvents.length}개`);
  });
  
  console.log('\n✅ React 스케줄러 분석 완료!\n');

})().catch((e) => {
  console.error('❌ 오류 발생:', e);
  console.error(e.stack);
  process.exit(1);
});
