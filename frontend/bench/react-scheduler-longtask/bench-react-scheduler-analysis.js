#!/usr/bin/env node
/**
 * React Scheduler LongTask 분석 벤치마크
 * 
 * React 렌더링 루프 내부에서 발생하는 LongTask 병목을 분석하기 위한 벤치마크
 * - React scheduler 함수들 (scheduler → w, uE, ux, uk 등) 추적
 * - 렌더링 커밋 간의 LongTask 발생 패턴 분석
 * - 성능 탭에서 관측된 3번의 LongTask 패턴 재현 및 분석
 * 
 * 주요 기능:
 * - React 스케줄러 호출 추적 및 스택 트레이스 수집
 * - 렌더링 커밋 사이의 렌더링 블로킹 시간 측정
 * - LongTask 발생 시점의 React 내부 함수 호출 분석
 * - PDF 렌더링과 React 렌더링의 상호작용 분석
 * 
 * 사용법:
 *   node bench/react-scheduler-longtask/bench-react-scheduler-analysis.js \
 *     --url "http://localhost:3000/feedback/4" --name "Current"
 * 
 * 버전 비교:
 *   node bench/react-scheduler-longtask/bench-react-scheduler-analysis.js \
 *     --url1 "http://localhost:3000/feedback/4?version=pdf" --name1 "PDF" \
 *     --url2 "http://localhost:3000/feedback/4?version=queue" --name2 "Queue"
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
const scrollSteps = parseInt(arg('steps', '10'), 10);
const stepDelay = parseInt(arg('delay', '800'), 10);
const reactTrackingLevel = arg('react-level', 'full'); // 'basic', 'full', 'debug'
const outputFile = arg('output', null);

const benchDir = __dirname;
const outDir = path.join(benchDir, 'results');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

/**
 * React Scheduler LongTask 분석 메인 함수
 */
async function analyzeReactSchedulerLongTasks(testUrl, versionName) {
  console.log(`\n⚛️ React Scheduler LongTask 분석: ${versionName}`);
  console.log(`   URL: ${testUrl}`);
  console.log(`   React 추적 레벨: ${reactTrackingLevel}`);
  
  const browser = await puppeteer.launch({
    headless: headless ? 'new' : false,
    defaultViewport: { width: 1920, height: 1080 },
    args: [
      '--disable-dev-shm-usage', 
      '--no-sandbox',
      '--enable-precise-memory-info',
      '--enable-gpu-rasterization',
      '--disable-background-timer-throttling', // 백그라운드 탭에서도 타이머 정상 동작
      '--disable-renderer-backgrounding',
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
    if (text.includes('[ReactScheduler]') || text.includes('[LongTask]') || text.includes('[RenderLoop]')) {
      console.log(`   ${text}`);
    }
  });

  // 페이지 로드 전 React 스케줄러 추적 설정
  await page.evaluateOnNewDocument(() => {
    window.__reactSchedulerAnalytics = {
      longTasks: [],
      reactSchedulerCalls: [],
      renderCommits: [],
      reactHooks: [],
      performanceEntries: [],
      userEvents: [],
      pdfEvents: [],
      startTime: null,
      eventCounter: 0,
      reactVersion: null,
      stackTraces: new Map(),
      // React 함수 호출 추적
      reactFunctionCalls: {
        scheduler: [],
        reconcile: [],
        render: [],
        commit: [],
        effect: [],
        memoized: [],
        unknown: []
      }
    };

    // React 디버그 모드를 위한 전역 설정
    if (typeof window !== 'undefined') {
      // React 18+ 디버깅
      if (reactTrackingLevel === 'full' || reactTrackingLevel === 'debug') {
        window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = window.__REACT_DEVTOOLS_GLOBAL_HOOK__ || {};
        window.__REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberRoot = function(id, root, priorityLevel) {
          const timestamp = performance.now();
          
          // renderRootSync, ensureRootIsScheduled 등의 함수 호출 감지
          window.__reactSchedulerAnalytics.renderCommits.push({
            rootId: id,
            priorityLevel: priorityLevel,
            timestamp: timestamp,
            id: `commit_${++window.__reactSchedulerAnalytics.eventCounter}`,
          });
          
          console.log(`[ReactScheduler] Commit @ ${timestamp.toFixed(2)}ms (priority: ${priorityLevel})`);
        };
        
        window.__REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberUnmount = function(id, fiber) {
          const timestamp = performance.now();
          console.log(`[ReactScheduler] Unmount @ ${timestamp.toFixed(2)}ms`);
        };
      }

      // React internals hooking을 위한 준비
      const originalConsoleError = console.error;
      const originalConsoleWarn = console.warn;
      
      console.error = function(...args) {
        const timestamp = performance.now();
        const message = args.join(' ');
        
        // React 스케줄러 관련 에러나 경고 감지
        if (message.includes('scheduler') || message.includes('flushSync') || 
            message.includes('unstable_runWithPriority') || message.includes('workLoop')) {
          window.__reactSchedulerAnalytics.reactSchedulerCalls.push({
            type: 'error',
            message: message,
            timestamp: timestamp,
            stack: new Error().stack,
            id: `sched_error_${++window.__reactSchedulerAnalytics.eventCounter}`,
          });
          console.log(`[ReactScheduler] Error detected: ${message.substring(0, 100)}`);
        }
        
        return originalConsoleError.apply(console, args);
      };
    }

    // Performance Observer 설정
    try {
      if ('PerformanceObserver' in window) {
        // LongTask Observer with React context
        const ltObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const timestamp = performance.now();
            
            // React scheduler 관련 함수 호출 추적
            let reactContext = null;
            let schedulerContext = null;
            
            try {
              // 현재 실행 중인 React 관련 함수들 찾기
              const currentEntries = performance.getEntriesByType('measure');
              const recentMeasures = currentEntries.filter(measure => 
                measure.startTime >= entry.startTime - 100 && 
                measure.startTime <= entry.startTime + entry.duration
              );
              
              // React scheduler 관련 함수 호출들 찾기
              const schedulerCalls = window.__reactSchedulerAnalytics.reactSchedulerCalls.filter(call => 
                call.timestamp >= entry.startTime - 200 && 
                call.timestamp <= entry.startTime + entry.duration + 200
              );
              
              // 최근 render commits 찾기
              const recentCommits = window.__reactSchedulerAnalytics.renderCommits.filter(commit => 
                commit.timestamp >= entry.startTime - 500 && 
                commit.timestamp <= entry.startTime + entry.duration + 500
              );
              
              // 근처 PDF 이벤트 찾기
              const nearbyPdfEvents = window.__reactSchedulerAnalytics.pdfEvents.filter(event => 
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
                  type: c.type,
                  message: c.message?.substring(0, 150),
                  timestamp: c.timestamp
                })),
                recentCommits: recentCommits.map(c => ({
                  priorityLevel: c.priorityLevel,
                  timestamp: c.timestamp
                })),
                nearbyPdfEvents: nearbyPdfEvents.map(e => ({
                  page: e.page,
                  totalMs: e.totalMs,
                  timestamp: e.timestamp
                }))
              };
              
              // 스케줄러 컨텍스트 생성
              const stackTrace = new Error().stack || '';
              schedulerContext = {
                stackSnippets: stackTrace.split('\n').slice(1, 8).map(line => line.trim()),
                hasReactSchedulerFunctions: stackTrace.includes('scheduler') || 
                                          stackTrace.includes('unstable_runWithPriority') ||
                                          stackTrace.includes('flushSync') ||
                                          stackTrace.includes('workLoop')
              };
              
            } catch (e) {
              reactContext = { error: e.message };
            }
            
            const longTaskData = {
              startTime: entry.startTime,
              duration: entry.duration,
              timestamp: timestamp,
              name: entry.name || 'unknown',
              attribution: entry.attribution || null,
              reactContext: reactContext,
              schedulerContext: schedulerContext,
              stackTrace: stackTrace,
              id: `lt_${++window.__reactSchedulerAnalytics.eventCounter}`,
            };
            
            window.__reactSchedulerAnalytics.longTasks.push(longTaskData);
            
            console.log(`[LongTask] ${entry.duration.toFixed(2)}ms @ ${entry.startTime.toFixed(2)}ms`);
            
            // React 스케줄러 관련 LongTask 감지
            if (reactContext?.schedulerCalls?.length > 0 || reactContext?.recentCommits?.length > 0) {
              console.log(`[ReactScheduler] React 관련 LongTask 감지됨 - scheduler 호출 ${reactContext.schedulerCalls.length}개, 커밋 ${reactContext.recentCommits.length}개`);
            }
          }
        });
        
        ltObserver.observe({ type: 'longtask', buffered: true });
        console.log('[ReactScheduler] LongTask Observer 등록 완료');
        
        // Measure Observer (React 렌더링 측정)
        const measureObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            window.__reactSchedulerAnalytics.performanceEntries.push({
              name: entry.name,
              startTime: entry.startTime,
              duration: entry.duration || 0,
              entryType: entry.entryType,
              timestamp: performance.now(),
              id: `perf_${++window.__reactSchedulerAnalytics.eventCounter}`,
            });
            
            // React 관련 measure 감지
            if (entry.name.includes('react') || entry.name.includes('scheduler') || 
                entry.name.includes('render') || entry.name.includes('commit')) {
              console.log(`[ReactScheduler] React measure: ${entry.name} (${entry.duration.toFixed(2)}ms)`);
            }
          }
        });
        measureObserver.observe({ type: 'measure', buffered: true });
        
      }
    } catch (e) {
      console.error('[ReactScheduler] Observer 초기화 실패:', e);
    }

    // React 함수 호출 패칭 및 추적
    const patchReactFunctions = () => {
      try {
        // React 스케줄러 관련 함수들 패칭 시도
        if (typeof window.React !== 'undefined' && window.React.unstable_scheduleCallback) {
          const originalScheduleCallback = window.React.unstable_scheduleCallback;
          window.React.unstable_scheduleCallback = function(priority, callback, options) {
            const timestamp = performance.now();
            window.__reactSchedulerAnalytics.reactFunctionCalls.scheduler.push({
              priority: priority,
              timestamp: timestamp,
              id: `scheduler_${++window.__reactSchedulerAnalytics.eventCounter}`,
            });
            console.log(`[ReactScheduler] unstable_scheduleCallback called (priority: ${priority}) @ ${timestamp.toFixed(2)}ms`);
            return originalScheduleCallback.call(this, priority, callback, options);
          };
        }
        
        // ReactDOM 관련 함수들 패칭
        if (typeof window.ReactDOM !== 'undefined') {
          if (window.ReactDOM.flushSync) {
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
              window.__reactSchedulerAnalytics.reactFunctionCalls.scheduler.push({
                type: 'flushSync',
                duration: endTime - timestamp,
                timestamp: timestamp,
                id: `flushsync_${++window.__reactSchedulerAnalytics.eventCounter}`,
              });
              
              console.log(`[ReactScheduler] flushSync end @ ${endTime.toFixed(2)}ms (${(endTime - timestamp).toFixed(2)}ms)`);
              return result;
            };
          }
        }
        
        console.log('[ReactScheduler] React 함수 패칭 완료');
        
      } catch (e) {
        console.error('[ReactScheduler] React 함수 패칭 실패:', e);
      }
    };

    // React가 로드된 후 패칭 실행
    const tryPatchReact = () => {
      if (typeof window.React !== 'undefined' || typeof window.ReactDOM !== 'undefined') {
        patchReactFunctions();
      } else {
        setTimeout(tryPatchReact, 100);
      }
    };

    // DOMContentLoaded 후에도 한 번 더 시도
    document.addEventListener('DOMContentLoaded', tryPatchReact);
    tryPatchReact();

    // PDF 렌더링 메트릭 수집 (기존 버전과 호환)
    window.pdfRenderMetricsCollector = {
      metrics: [],
      add: function(metric) {
        this.metrics.push(metric);
        const timestamp = performance.now();
        
        const event = {
          ...metric,
          timestamp: timestamp,
          id: `pdf_${++window.__reactSchedulerAnalytics.eventCounter}`,
        };
        window.__reactSchedulerAnalytics.pdfEvents.push(event);
        
        console.log(`[ReactScheduler] PDF Page ${metric.page} rendered in ${metric.totalMs}ms @ ${timestamp.toFixed(2)}ms`);
      }
    };
  });

  console.log('   페이지 이동 중...');
  try {
    await page.goto(testUrl, { 
      waitUntil: ['networkidle2', 'domcontentloaded'], 
      timeout: 120000
    });
    console.log('   페이지 로드 성공');
  } catch (error) {
    console.error(`   페이지 로드 실패: ${error.message}`);
    await browser.close();
    return null;
  }

  console.log('   페이지 로드 완료, React 분석 준비 중...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // React 버전 확인
  const reactInfo = await page.evaluate(() => {
    try {
      return {
        reactVersion: window.__reactSchedulerAnalytics?.reactVersion || 'unknown',
        hasReact: typeof window.React !== 'undefined',
        hasReactDOM: typeof window.ReactDOM !== 'undefined',
        schedulerAnalyticsExists: typeof window.__reactSchedulerAnalytics !== 'undefined',
        pageTitle: document.title,
        url: window.location.href,
        analyticsInitialized: window.__reactSchedulerAnalytics?.startTime !== undefined,
      };
    } catch (e) {
      return { error: e.message };
    }
  });
  
  console.log('   React 정보:', reactInfo);
  
  if (reactInfo.error) {
    console.error(`   React 정보 수집 실패: ${reactInfo.error}`);
    await browser.close();
    return null;
  }
  
  if (!reactInfo.schedulerAnalyticsExists) {
    console.error('   React 스케줄러 분석 객체가 초기화되지 않았습니다.');
    await browser.close();
    return null;
  }

  // React 스케줄러 추적 강화
  await page.evaluate((reactLevel) => {
    if (reactLevel === 'full' || reactLevel === 'debug') {
      // React internals에 더 깊이 접근하여 스케줄러 함수들 추적
      const originalSetTimeout = window.setTimeout;
      const originalSetInterval = window.setInterval;
      
      // 스케줄러 관련 타이머 호출 감지
      window.setTimeout = function(callback, delay, ...args) {
        const timestamp = performance.now();
        const stack = new Error().stack;
        
        if (stack && (stack.includes('scheduler') || stack.includes('workLoop') || 
                     stack.includes('flushSync') || stack.includes('unstable_runWithPriority'))) {
          window.__reactSchedulerAnalytics.reactSchedulerCalls.push({
            type: 'setTimeout',
            delay: delay,
            timestamp: timestamp,
            stack: stack.split('\n').slice(1, 5),
            id: `timeout_${++window.__reactSchedulerAnalytics.eventCounter}`,
          });
          console.log(`[ReactScheduler] setTimeout from scheduler context @ ${timestamp.toFixed(2)}ms (delay: ${delay}ms)`);
        }
        
        return originalSetTimeout.call(this, callback, delay, ...args);
      };
      
      window.setInterval = function(callback, delay, ...args) {
        const timestamp = performance.now();
        const stack = new Error().stack;
        
        if (stack && (stack.includes('scheduler') || stack.includes('workLoop'))) {
          window.__reactSchedulerAnalytics.reactSchedulerCalls.push({
            type: 'setInterval',
            delay: delay,
            timestamp: timestamp,
            stack: stack.split('\n').slice(1, 5),
            id: `interval_${++window.__reactSchedulerAnalytics.eventCounter}`,
          });
          console.log(`[ReactScheduler] setInterval from scheduler context @ ${timestamp.toFixed(2)}ms`);
        }
        
        return originalSetInterval.call(this, callback, delay, ...args);
      };
    }
  }, reactTrackingLevel);

  // 측정 시작 시간 설정
  await page.evaluate(() => {
    window.__reactSchedulerAnalytics.startTime = performance.now();
  });

  console.log('   스크롤 시뮬레이션 시작... (React 스케줄러 추적 활성화)');
  
  // 스크롤 시뮬레이션 및 React 렌더링 루프 분석
  const result = await page.evaluate(async (scrollSteps, stepDelay) => {
    const scrollContainer = Array.from(document.querySelectorAll('div'))
      .find(div => {
        const style = window.getComputedStyle(div);
        return style.overflowY === 'auto' && div.scrollHeight > div.clientHeight;
      });
    
    if (!scrollContainer) {
      console.error('[ReactScheduler] 스크롤 컨테이너를 찾을 수 없습니다');
      return { success: false, error: 'No scroll container found' };
    }

    const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
    console.log(`[ReactScheduler] 스크롤 컨테이너: ${scrollContainer.scrollHeight}px (최대: ${maxScroll}px)`);

    // 스크롤 이벤트 리스너 (React 렌더링 트리거 감지)
    let scrollEventCount = 0;
    const scrollListener = () => {
      const timestamp = performance.now();
      scrollEventCount++;
      
      window.__reactSchedulerAnalytics.userEvents.push({
        type: 'scroll',
        timestamp: timestamp,
        scrollTop: scrollContainer.scrollTop,
        eventNumber: scrollEventCount,
        id: `scroll_${++window.__reactSchedulerAnalytics.eventCounter}`,
      });
      
      // 스크롤 후 잠시 기다려서 React 렌더링 완료 대기
      setTimeout(() => {
        const renderCompleteTimestamp = performance.now();
        window.__reactSchedulerAnalytics.userEvents.push({
          type: 'render_complete_check',
          timestamp: renderCompleteTimestamp,
          delayFromScroll: renderCompleteTimestamp - timestamp,
          id: `render_check_${++window.__reactSchedulerAnalytics.eventCounter}`,
        });
      }, 100);
    };
    
    scrollContainer.addEventListener('scroll', scrollListener, { passive: true });

    // 단계별 스크롤과 React 렌더링 루프 분석
    for (let i = 0; i <= scrollSteps; i++) {
      const beforeLongTasks = window.__reactSchedulerAnalytics.longTasks.length;
      const beforeSchedulerCalls = window.__reactSchedulerAnalytics.reactSchedulerCalls.length;
      const beforeRenderCommits = window.__reactSchedulerAnalytics.renderCommits.length;
      
      // React 렌더링 측정 시작
      const stepStartTime = performance.now();
      performance.mark(`react-scroll-step-${i}-start`);
      
      const targetScrollPosition = (maxScroll / scrollSteps) * i;
      scrollContainer.scrollTop = targetScrollPosition;
      
      console.log(`[ReactScheduler] 스크롤 Step ${i}/${scrollSteps}: ${targetScrollPosition.toFixed(0)}px`);
      
      // React 렌더링 완료 대기 (더 긴 대기시간으로 변경)
      await new Promise(r => setTimeout(r, stepDelay));
      
      performance.mark(`react-scroll-step-${i}-end`);
      performance.measure(`react-scroll-duration-${i}`, `react-scroll-step-${i}-start`, `react-scroll-step-${i}-end`);
      
      const stepEndTime = performance.now();
      const afterLongTasks = window.__reactSchedulerAnalytics.longTasks.length;
      const afterSchedulerCalls = window.__reactSchedulerAnalytics.reactSchedulerCalls.length;
      const afterRenderCommits = window.__reactSchedulerAnalytics.renderCommits.length;
      
      const newLongTasks = afterLongTasks - beforeLongTasks;
      const newSchedulerCalls = afterSchedulerCalls - beforeSchedulerCalls;
      const newRenderCommits = afterRenderCommits - beforeRenderCommits;
      const stepDuration = stepEndTime - stepStartTime;
      
      console.log(`[ReactScheduler] Step ${i} 결과:`);
      console.log(`   - LongTask: +${newLongTasks}개 (누적: ${afterLongTasks}개)`);
      console.log(`   - 스케줄러 호출: +${newSchedulerCalls}개 (누적: ${afterSchedulerCalls}개)`);
      console.log(`   - 렌더 커밋: +${newRenderCommits}개 (누적: ${afterRenderCommits}개)`);
      console.log(`   - 단계 시간: ${stepDuration.toFixed(1)}ms`);
      
      // React 관련 LongTask가 발생한 경우 상세 분석
      if (newLongTasks > 0) {
        const recentLongTasks = window.__reactSchedulerAnalytics.longTasks.slice(-newLongTasks);
        recentLongTasks.forEach((task, idx) => {
          console.log(`   🔍 LongTask ${idx + 1} 분석:`);
          console.log(`      - 지속시간: ${task.duration.toFixed(2)}ms @ ${task.startTime.toFixed(2)}ms`);
          
          if (task.reactContext?.schedulerCalls?.length > 0) {
            console.log(`      - 관련 스케줄러 호출: ${task.reactContext.schedulerCalls.length}개`);
            task.reactContext.schedulerCalls.forEach((call, callIdx) => {
              console.log(`        ${callIdx + 1}. ${call.type}: ${call.message?.substring(0, 80) || 'No message'}`);
            });
          }
          
          if (task.reactContext?.recentCommits?.length > 0) {
            console.log(`      - 관련 렌더 커밋: ${task.reactContext.recentCommits.length}개`);
          }
          
          if (task.schedulerContext?.hasReactSchedulerFunctions) {
            console.log(`      - React 스케줄러 함수 포함됨`);
          }
        });
      }
    }

    scrollContainer.removeEventListener('scroll', scrollListener);

    const endTime = performance.now();
    const startTime = window.__reactSchedulerAnalytics.startTime || 0;

    return {
      success: true,
      duration: endTime - startTime,
      analytics: window.__reactSchedulerAnalytics,
    };
  }, scrollSteps, stepDelay);

  await browser.close();

  if (!result.success) {
    console.error(`   ❌ 분석 실패: ${result.error || 'Unknown error'}`);
    return null;
  }

  const analytics = result.analytics;
  if (!analytics) {
    console.error(`   ❌ analytics 데이터가 없습니다.`);
    return null;
  }

  console.log(`   ✅ React 스케줄러 분석 완료`);
  console.log(`      - LongTask: ${analytics.longTasks?.length || 0}개`);
  console.log(`      - React 스케줄러 호출: ${analytics.reactSchedulerCalls?.length || 0}개`);
  console.log(`      - 렌더 커밋: ${analytics.renderCommits?.length || 0}개`);
  console.log(`      - PDF 이벤트: ${analytics.pdfEvents?.length || 0}개`);
  console.log(`      - 사용자 이벤트: ${analytics.userEvents?.length || 0}개`);

  return {
    version: versionName,
    url: testUrl,
    duration: result.duration,
    analytics: analytics,
    reactInfo: reactInfo,
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

  const { longTasks = [], reactSchedulerCalls = [], renderCommits = [], pdfEvents = [] } = analytics;

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
        task.reactContext.nearbyPdfEvents.forEach((pdfEvent, pdfIdx) => {
          console.log(`         ${pdfIdx + 1}. Page ${pdfEvent.page}: ${pdfEvent.totalMs}ms`);
        });
      }
    }
    
    // 스케줄러 컨텍스트 정보
    if (task.schedulerContext?.stackSnippets?.length > 0) {
      console.log(`      📋 호출 스택 (일부):`);
      task.schedulerContext.stackSnippets.slice(0, 4).forEach((line, lineIdx) => {
        if (line.includes('scheduler') || line.includes('react') || line.includes('workLoop')) {
          console.log(`         ${lineIdx + 1}. ${line.substring(0, 80)}`);
        }
      });
    }
  });

  // React 스케줄러 호출 패턴 분석
  console.log(`\n🔧 React 스케줄러 호출 패턴:`);
  const schedulerCallTypes = {};
  reactSchedulerCalls.forEach(call => {
    schedulerCallTypes[call.type] = (schedulerCallTypes[call.type] || 0) + 1;
  });
  
  Object.entries(schedulerCallTypes).forEach(([type, count]) => {
    console.log(`   ${type}: ${count}회`);
  });

  // 렌더 커밋 패턴 분석
  console.log(`\n🔄 렌더 커밋 패턴:`);
  if (renderCommits.length > 0) {
    const priorityStats = {};
    renderCommits.forEach(commit => {
      priorityStats[commit.priorityLevel] = (priorityStats[commit.priorityLevel] || 0) + 1;
    });
    
    Object.entries(priorityStats).forEach(([priority, count]) => {
      console.log(`   Priority ${priority}: ${count}회 커밋`);
    });
  }
}

/**
 * React 렌더링 루프 패턴 분석
 */
function analyzeReactRenderLoopPattern(data) {
  console.log(`\n🔄 React 렌더링 루프 패턴: ${data.version}`);
  console.log('='.repeat(80));

  const analytics = data.analytics;
  if (!analytics) {
    console.log('❌ analytics 데이터가 없습니다.');
    return;
  }

  const { longTasks = [], reactSchedulerCalls = [], renderCommits = [], userEvents = [] } = analytics;

  // 시간대별 LongTask 분포와 React 이벤트들의 상관관계
  console.log(`\n⏰ 시간대별 React 이벤트 분포:`);
  
  // 5초 단위로 분석
  const timeBuckets = {};
  const bucketSize = 5000; // 5초
  
  [...longTasks, ...renderCommits, ...userEvents].forEach(event => {
    const bucket = Math.floor(event.timestamp / bucketSize) * bucketSize;
    if (!timeBuckets[bucket]) {
      timeBuckets[bucket] = { longTasks: 0, commits: 0, userEvents: 0, schedulerCalls: 0 };
    }
    
    if (event.startTime !== undefined) timeBuckets[bucket].longTasks++;
    else if (event.rootId !== undefined) timeBuckets[bucket].commits++;
    else if (event.type) timeBuckets[bucket].userEvents++;
  });
  
  reactSchedulerCalls.forEach(call => {
    const bucket = Math.floor(call.timestamp / bucketSize) * bucketSize;
    if (!timeBuckets[bucket]) {
      timeBuckets[bucket] = { longTasks: 0, commits: 0, userEvents: 0, schedulerCalls: 0 };
    }
    timeBuckets[bucket].schedulerCalls++;
  });

  Object.entries(timeBuckets).forEach(([time, events]) => {
    const timeStr = `${(parseInt(time) / 1000).toFixed(1)}s-${((parseInt(time) + bucketSize) / 1000).toFixed(1)}s`;
    console.log(`   ${timeStr}: LongTask ${events.longTasks}개, 커밋 ${events.commits}개, 사용자 ${events.userEvents}개, 스케줄러 ${events.schedulerCalls}개`);
  });

  // 연속된 LongTask 발생 패턴 찾기 (성능 탭에서 관측된 3번 연속 패턴)
  console.log(`\n🔍 연속 LongTask 패턴 분석:`);
  let consecutiveBursts = [];
  let currentBurst = [];
  
  longTasks.forEach((task, idx) => {
    if (idx === 0 || task.startTime - longTasks[idx - 1].startTime < 2000) {
      // 2초 이내면 같은 버스트로 간주
      currentBurst.push(task);
    } else {
      if (currentBurst.length >= 2) {
        consecutiveBursts.push([...currentBurst]);
      }
      currentBurst = [task];
    }
  });
  
  if (currentBurst.length >= 2) {
    consecutiveBursts.push(currentBurst);
  }
  
  if (consecutiveBursts.length > 0) {
    console.log(`   연속 LongTask 버스트 ${consecutiveBursts.length}개 발견:`);
    consecutiveBursts.forEach((burst, burstIdx) => {
      const totalDuration = burst.reduce((sum, task) => sum + task.duration, 0);
      const timeSpan = burst[burst.length - 1].startTime - burst[0].startTime;
      console.log(`      버스트 ${burstIdx + 1}: ${burst.length}개 LongTask, 총 ${totalDuration.toFixed(1)}ms, 시간 범위 ${timeSpan.toFixed(1)}ms`);
      
      // 각 버스트에서 React 관련성 확인
      const reactRelatedBurst = burst.filter(task => 
        task.reactContext?.schedulerCalls?.length > 0 || 
        task.reactContext?.recentCommits?.length > 0
      );
      console.log(`         → React 관련: ${reactRelatedBurst.length}/${burst.length}개`);
    });
  } else {
    console.log(`   연속 LongTask 버스트 패턴 없음`);
  }
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
    console.error('  node bench/react-scheduler-longtask/bench-react-scheduler-analysis.js --url "http://localhost:3000/feedback/4"');
    console.error('  node bench/react-scheduler-longtask/bench-react-scheduler-analysis.js --url1 "..." --name1 "PDF" --url2 "..." --name2 "Queue"');
    process.exit(1);
  }

  console.log('\n⚛️ React Scheduler LongTask 분석 벤치마크');
  console.log('='.repeat(80));
  console.log(`설정:`);
  console.log(`  - CPU Throttle: ${cpuThrottle}x`);
  console.log(`  - React 추적 레벨: ${reactTrackingLevel}`);
  console.log(`  - 스크롤 단계: ${scrollSteps}단계, ${stepDelay}ms 간격`);
  console.log(`  - Headless: ${headless}`);

  const results = [];

  for (const { url, name } of urls) {
    console.log(`\n🔍 분석 시작: ${name} (${url})`);
    const result = await analyzeReactSchedulerLongTasks(url, name);
    if (result && result.analytics) {
      results.push(result);
      analyzeReactSchedulerLongTasks(result);  // React 스케줄러 LongTask 분석
      analyzeReactRenderLoopPattern(result);  // 렌더링 루프 패턴 분석
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
    outputPath = path.join(outDir, `react-scheduler-analysis-${timestamp}.json`);
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
      reactTrackingLevel,
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
    if (!analytics) {
      console.log(`\n🔹 ${result.version}: ❌ analytics 데이터 없음`);
      return;
    }
    
    const { longTasks = [], reactSchedulerCalls = [], renderCommits = [], pdfEvents = [] } = analytics;
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
    console.log(`   🔄 렌더 커밋: ${renderCommits.length}개`);
    console.log(`   📄 PDF 렌더링: ${pdfEvents.length}개`);
  });
  
  console.log('\n✅ React 스케줄러 분석 완료!\n');

})().catch((e) => {
  console.error('❌ 오류 발생:', e);
  console.error(e.stack);
  process.exit(1);
});
