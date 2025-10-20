#!/usr/bin/env node
/**
 * LongTask 이벤트 분석 벤치마크
 * 
 * Lighthouse Performance 탭 문제로 인한 정확한 LongTask 분석을 위한 전용 벤치마크
 * 
 * 주요 기능:
 * - LongTask 발생 시점과 지속 시간 정확 추적
 * - 이벤트 발신지(호출 스택) 분석
 * - 스크롤 이벤트와 LongTask 상관관계 분석
 * - PDF 렌더링 이벤트와 LongTask 연관성 분석
 * - 타임라인 기반 상세 분석
 * 
 * 사용법:
 *   node bench/longtask-events/bench-longtask-analytics.js \
 *     --url1 "http://localhost:3000/feedback/4?version=pdf" --name1 "PDF" \
 *     --url2 "http://localhost:3000/feedback/4?version=queue" --name2 "Queue"
 * 
 * 단일 URL 테스트:
 *   node bench/longtask-events/bench-longtask-analytics.js --url "http://localhost:3000/feedback/4"
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
const url3 = arg('url3', null);
const name1 = arg('name1', 'Version 1');
const name2 = arg('name2', 'Version 2');
const name3 = arg('name3', 'Version 3');
const cpuThrottle = parseFloat(arg('cpu', '4'));
const headless = String(arg('headless', 'true')) === 'true';
const scrollSteps = parseInt(arg('steps', '8'), 10);
const stepDelay = parseInt(arg('delay', '800'), 10);
const scrollRange = parseFloat(arg('range', '0.3')); // 스크롤 범위 (0.3 = 30%)
const outputFile = arg('output', null);

const benchDir = __dirname;
const outDir = path.join(benchDir, 'results');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

/**
 * LongTask 이벤트 분석 메인 함수
 */
async function analyzeLongTaskEvents(testUrl, versionName) {
  console.log(`\n🔍 LongTask 이벤트 분석 시작: ${versionName}`);
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
    if (text.includes('[LongTask]') || text.includes('[EventTrace]') || text.includes('[PDFTrace]')) {
      console.log(`   ${text}`);
    }
  });

  // 페이지 로드 전 이벤트 추적 설정
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
      bottleneckAnalysis: {
        slowOperations: [],
        heavyScripts: [],
        largeLayouts: [],
        expensivePaints: [],
        networkBottlenecks: []
      }
    };

    // Performance Observer 설정
    try {
        // LongTask Observer with enhanced attribution
        if ('PerformanceObserver' in window) {
          const ltObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              const timestamp = performance.now();
              
              // LongTask attribution 정보 수집 (Chrome 96+)
              let attribution = null;
              let stackTrace = '';
              
              try {
                // entry.attribution에서 더 자세한 정보 추출
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
                
                // 현재 실행 중인 작업들 추적을 위한 정보 수집
                const currentEntries = performance.getEntriesByType('measure');
                const recentMeasures = currentEntries.filter(measure => 
                  measure.startTime >= entry.startTime - 100 && 
                  measure.startTime <= entry.startTime + entry.duration
                );
                
                // LongTask 발생 시점 전후의 PDF 렌더링 이벤트 찾기
                const nearbyPdfEvents = window.__longTaskAnalytics.pdfEvents.filter(event => 
                  event.timestamp >= entry.startTime - 100 && 
                  event.timestamp <= entry.startTime + entry.duration + 100
                );
                
                stackTrace = `LongTask 발생 전후 컨텍스트:
  - 최근 측정: ${recentMeasures.length}개 (${recentMeasures.map(m => m.name).join(', ')})
  - 근처 PDF 이벤트: ${nearbyPdfEvents.length}개
`;
                
                if (nearbyPdfEvents.length > 0) {
                  nearbyPdfEvents.forEach(pdfEvent => {
                    stackTrace += `    * Page ${pdfEvent.page}: ${pdfEvent.totalMs}ms 렌더링\n`;
                  });
                }
                
              } catch (e) {
                stackTrace = `Attribution 수집 실패: ${e.message}`;
              }
              
              window.__longTaskAnalytics.longTasks.push({
                startTime: entry.startTime,
                duration: entry.duration,
                timestamp: timestamp,
                name: entry.name || 'unknown',
                attribution: attribution,
                context: {
                  recentMeasures: recentMeasures.map(m => ({ name: m.name, duration: m.duration, startTime: m.startTime })),
                  nearbyPdfEvents: nearbyPdfEvents.map(e => ({ page: e.page, totalMs: e.totalMs, timestamp: e.timestamp }))
                },
                stackTrace: stackTrace,
                id: `lt_${++window.__longTaskAnalytics.eventCounter}`,
              });
              
              console.log(`[LongTask] ${entry.duration.toFixed(2)}ms @ ${entry.startTime.toFixed(2)}ms - ${entry.name || 'unnamed'}`);
              if (attribution) {
                console.log(`  Container: ${attribution.containerName}, Script: ${attribution.scriptURL}`);
              }
            }
          });
          try {
            // 실시간과 버퍼드 둘 다 등록
            ltObserver.observe({ type: 'longtask', buffered: true });
            console.log('[LongTask] Observer 등록 완료 (buffered)');
          } catch (e) {
            console.error('[LongTask] Observer 등록 실패:', e);
          }
          
          // 실시간 LongTask 감지를 위한 추가 Observer
          try {
            const realtimeObserver = new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) {
                console.log(`[LongTask-REALTIME] 감지됨: ${entry.duration.toFixed(2)}ms @ ${entry.startTime.toFixed(2)}ms`);
                // 실시간 감지된 LongTask도 analytics에 추가
                const timestamp = performance.now();
                window.__longTaskAnalytics.longTasks.push({
                  startTime: entry.startTime,
                  duration: entry.duration,
                  timestamp: timestamp,
                  name: entry.name || 'realtime-detected',
                  attribution: entry.attribution || null,
                  context: { detected: 'realtime' },
                  stackTrace: '실시간 감지',
                  id: `lt_realtime_${++window.__longTaskAnalytics.eventCounter}`,
                });
              }
            });
            realtimeObserver.observe({ type: 'longtask' });
            console.log('[LongTask] 실시간 Observer 등록 완료');
          } catch (e) {
            console.error('[LongTask] 실시간 Observer 등록 실패:', e);
          }

        // Paint Observer (FCP, LCP 추적)
        const paintObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            window.__longTaskAnalytics.performanceEntries.push({
              name: entry.name,
              startTime: entry.startTime,
              duration: entry.duration || 0,
              entryType: entry.entryType,
              timestamp: performance.now(),
              id: `perf_${++window.__longTaskAnalytics.eventCounter}`,
            });
          }
        });
        paintObserver.observe({ type: 'paint', buffered: true });

        // Measure Observer (사용자 정의 측정)
        const measureObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            window.__longTaskAnalytics.performanceEntries.push({
              name: entry.name,
              startTime: entry.startTime,
              duration: entry.duration || 0,
              entryType: entry.entryType,
              timestamp: performance.now(),
              id: `meas_${++window.__longTaskAnalytics.eventCounter}`,
            });
          }
        });
        measureObserver.observe({ type: 'measure', buffered: true });

        // Navigation Observer (페이지 로딩 성능)
        const navigationObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const navEvent = {
              name: entry.name,
              startTime: entry.startTime,
              duration: entry.duration || 0,
              entryType: entry.entryType,
              timestamp: performance.now(),
              domContentLoaded: entry.domContentLoadedEventEnd - entry.fetchStart,
              loadComplete: entry.loadEventEnd - entry.fetchStart,
              dnsLookup: entry.domainLookupEnd - entry.domainLookupStart,
              tcpConnect: entry.connectEnd - entry.connectStart,
              request: entry.responseStart - entry.requestStart,
              response: entry.responseEnd - entry.responseStart,
              processing: entry.domComplete - entry.responseEnd,
              id: `nav_${++window.__longTaskAnalytics.eventCounter}`,
            };
            window.__longTaskAnalytics.navigationEvents.push(navEvent);
            console.log(`[Navigation] ${entry.entryType}: ${navEvent.duration.toFixed(1)}ms`);
          }
        });
        navigationObserver.observe({ type: 'navigation', buffered: true });

        // Resource Observer (네트워크 리소스)
        const resourceObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const resourceEvent = {
              name: entry.name,
              startTime: entry.startTime,
              duration: entry.duration || 0,
              entryType: entry.entryType,
              transferSize: entry.transferSize || 0,
              encodedBodySize: entry.encodedBodySize || 0,
              decodedBodySize: entry.decodedBodySize || 0,
              initiatorType: entry.initiatorType || 'unknown',
              timestamp: performance.now(),
              id: `res_${++window.__longTaskAnalytics.eventCounter}`,
            };
            window.__longTaskAnalytics.resourceEvents.push(resourceEvent);
            
            // 큰 리소스 감지 (병목 후보)
            if (resourceEvent.transferSize > 500000) { // 500KB 이상
              window.__longTaskAnalytics.bottleneckAnalysis.networkBottlenecks.push({
                type: 'large_resource',
                url: entry.name,
                size: resourceEvent.transferSize,
                duration: resourceEvent.duration,
                timestamp: resourceEvent.timestamp
              });
              console.log(`[NetworkBottleneck] 큰 리소스: ${entry.name} (${(resourceEvent.transferSize/1024).toFixed(1)}KB, ${resourceEvent.duration.toFixed(1)}ms)`);
            }
          }
        });
        resourceObserver.observe({ type: 'resource', buffered: true });

        // Layout Shift Observer (CLS)
        const layoutShiftObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              const layoutEvent = {
                startTime: entry.startTime,
                value: entry.value,
                sources: entry.sources ? entry.sources.map(source => ({
                  node: source.node?.tagName || 'unknown',
                  currentRect: source.currentRect,
                  previousRect: source.previousRect
                })) : [],
                timestamp: performance.now(),
                id: `layout_${++window.__longTaskAnalytics.eventCounter}`,
              };
              window.__longTaskAnalytics.layoutEvents.push(layoutEvent);
              
              if (entry.value > 0.1) {
                window.__longTaskAnalytics.bottleneckAnalysis.largeLayouts.push({
                  type: 'large_layout_shift',
                  value: entry.value,
                  startTime: entry.startTime,
                  timestamp: layoutEvent.timestamp
                });
                console.log(`[LayoutShift] 큰 레이아웃 이동: ${entry.value.toFixed(3)} @ ${(entry.startTime/1000).toFixed(2)}s`);
              }
            }
          }
        });
        try {
          layoutShiftObserver.observe({ type: 'layout-shift', buffered: true });
        } catch (e) {
          console.log('[LayoutShift] Observer 지원되지 않음');
        }

        // Script Tag Observer (스크립트 로딩 분석)
        const originalAppendChild = Node.prototype.appendChild;
        const originalInsertBefore = Node.prototype.insertBefore;
        
        Node.prototype.appendChild = function(child) {
          const result = originalAppendChild.call(this, child);
          if (child.tagName === 'SCRIPT') {
            const scriptEvent = {
              src: child.src || 'inline',
              timestamp: performance.now(),
              id: `script_${++window.__longTaskAnalytics.eventCounter}`,
            };
            window.__longTaskAnalytics.scriptEvents.push(scriptEvent);
            console.log(`[Script] 로드됨: ${child.src || '인라인 스크립트'}`);
          }
          return result;
        };
        
        Node.prototype.insertBefore = function(newNode, referenceNode) {
          const result = originalInsertBefore.call(this, newNode, referenceNode);
          if (newNode.tagName === 'SCRIPT') {
            const scriptEvent = {
              src: newNode.src || 'inline',
              timestamp: performance.now(),
              id: `script_${++window.__longTaskAnalytics.eventCounter}`,
            };
            window.__longTaskAnalytics.scriptEvents.push(scriptEvent);
            console.log(`[Script] 삽입됨: ${newNode.src || '인라인 스크립트'}`);
          }
          return result;
        };

        // DOM 조작 추적
        const originalCreateElement = document.createElement;
        document.createElement = function(tagName) {
          const element = originalCreateElement.call(this, tagName);
          const timestamp = performance.now();
          
          window.__longTaskAnalytics.domEvents.push({
            type: 'createElement',
            tagName: tagName,
            timestamp: timestamp,
            id: `dom_${++window.__longTaskAnalytics.eventCounter}`,
          });
          
          return element;
        };

        // MutationObserver로 DOM 변화 추적
        const mutationObserver = new MutationObserver((mutations) => {
          mutations.forEach(mutation => {
            const timestamp = performance.now();
            window.__longTaskAnalytics.domEvents.push({
              type: 'mutation',
              mutationType: mutation.type,
              target: mutation.target?.tagName || 'unknown',
              addedNodes: mutation.addedNodes.length,
              removedNodes: mutation.removedNodes.length,
              timestamp: timestamp,
              id: `mut_${++window.__longTaskAnalytics.eventCounter}`,
            });
          });
        });

        // 스타일 변경 및 CSS 관련 성능 추적
        const originalStyleSet = Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, 'cssText').set;
        Object.defineProperty(CSSStyleDeclaration.prototype, 'cssText', {
          set: function(value) {
            const timestamp = performance.now();
            window.__longTaskAnalytics.cssEvents.push({
              type: 'cssText_change',
              element: this.parentElement?.tagName || 'unknown',
              timestamp: timestamp,
              id: `css_${++window.__longTaskAnalytics.eventCounter}`,
            });
            return originalStyleSet.call(this, value);
          },
          get: Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, 'cssText').get
        });

        // ResizeObserver로 레이아웃 변화 추적
        if (window.ResizeObserver) {
          const resizeObserver = new ResizeObserver((entries) => {
            entries.forEach(entry => {
              const timestamp = performance.now();
              const rect = entry.contentRect;
              
              window.__longTaskAnalytics.layoutEvents.push({
                type: 'resize',
                width: rect.width,
                height: rect.height,
                target: entry.target?.tagName || 'unknown',
                timestamp: timestamp,
                id: `resize_${++window.__longTaskAnalytics.eventCounter}`,
              });
            });
          });
          
          // 모든 요소 관찰 시작 (DOMContentLoaded 후)
          document.addEventListener('DOMContentLoaded', () => {
            document.querySelectorAll('*').forEach(el => {
              resizeObserver.observe(el);
            });
          });
        }
      }

      // PDF 렌더링 이벤트 추적 및 성능 마킹
      window.pdfRenderMetricsCollector = {
        metrics: [],
        add: function(metric) {
          this.metrics.push(metric);
          const timestamp = performance.now();
          
          // PDF 렌더링 시작/종료 마크 추가
          performance.mark(`pdf-render-start-${metric.page}-${timestamp}`);
          performance.mark(`pdf-render-end-${metric.page}-${timestamp}`);
          
          // 렌더링 단계별 측정 마크
          if (metric.getPageMs !== undefined) {
            performance.measure(`pdf-getPage-${metric.page}-${timestamp}`, 
              performance.now() - metric.getPageMs, performance.now());
          }
          if (metric.renderMs !== undefined) {
            performance.measure(`pdf-render-${metric.page}-${timestamp}`, 
              performance.now() - metric.renderMs, performance.now());
          }
          if (metric.paintMs !== undefined) {
            performance.measure(`pdf-paint-${metric.page}-${timestamp}`, 
              performance.now() - metric.paintMs, performance.now());
          }
          
          const event = {
            ...metric,
            timestamp: timestamp,
            id: `pdf_${++window.__longTaskAnalytics.eventCounter}`,
          };
          window.__longTaskAnalytics.pdfEvents.push(event);
          window.__longTaskAnalytics.renderEvents.push(event);
          
          console.log(`[PDFTrace] Page ${metric.page} rendered in ${metric.totalMs}ms (getPage: ${metric.getPageMs}ms, render: ${metric.renderMs}ms, paint: ${metric.paintMs}ms)`);
        }
      };

      // 스택 트레이스 수집 개선
      const originalConsoleGroup = console.group;
      const originalConsoleGroupEnd = console.groupEnd;
      
      console.group = function(...args) {
        const stack = new Error().stack;
        window.__longTaskAnalytics.stackTraces.set('console_group', stack);
        return originalConsoleGroup.apply(console, args);
      };

      console.groupEnd = function() {
        const stack = new Error().stack;
        window.__longTaskAnalytics.stackTraces.set('console_group_end', stack);
        return originalConsoleGroupEnd.apply(console);
      };

    } catch (e) {
      console.error('[LongTask] Observer 초기화 실패:', e);
    }

    // 사용자 이벤트 추적 및 LongTask 예측
    const trackUserEvent = (eventType, event) => {
      const timestamp = performance.now();
      
      // 성능 측정 시작
      performance.mark(`${eventType}-start-${timestamp}`);
      
      window.__longTaskAnalytics.userEvents.push({
        type: eventType,
        timestamp: timestamp,
        target: event.target?.tagName || 'unknown',
        id: `user_${++window.__longTaskAnalytics.eventCounter}`,
      });
      
      // 다음 프레임에서 측정 종료 (LongTask 발생 가능성 추적)
      requestAnimationFrame(() => {
        performance.mark(`${eventType}-end-${timestamp}`);
        performance.measure(`${eventType}-duration-${timestamp}`, `${eventType}-start-${timestamp}`, `${eventType}-end-${timestamp}`);
      });
    };

    // 스크롤 이벤트 추적
    let scrollTimeout;
    const throttledScrollHandler = (e) => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        trackUserEvent('scroll', e);
      }, 16); // 60fps로 제한
    };

    // 이벤트 리스너 등록 (DOM 로드 후)
    const setupEventListeners = () => {
      window.addEventListener('scroll', throttledScrollHandler, { passive: true });
      window.addEventListener('click', (e) => trackUserEvent('click', e));
      window.addEventListener('mousedown', (e) => trackUserEvent('mousedown', e));
      window.addEventListener('mouseup', (e) => trackUserEvent('mouseup', e));
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupEventListeners);
    } else {
      setupEventListeners();
    }
  });

  console.log('   페이지 이동 중...');
  await page.goto(testUrl, { 
    waitUntil: ['networkidle2', 'domcontentloaded'], 
    timeout: 120000
  });

  console.log('   페이지 로드 완료, 초기화 대기...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // LongTask Observer와 PDF 렌더링 상태 확인
  const debugInfo = await page.evaluate(() => {
    return {
      longTaskObserverSupported: 'PerformanceObserver' in window,
      pdfCollectorExists: typeof window.pdfRenderMetricsCollector !== 'undefined',
      existingLongTasks: performance.getEntriesByType('longtask').length,
      existingMeasures: performance.getEntriesByType('measure').length,
      existingMarks: performance.getEntriesByType('mark').length,
      analyticsExists: typeof window.__longTaskAnalytics !== 'undefined',
    };
  });
  
  console.log('   디버그 정보:', debugInfo);

  // 측정 시작 시간 설정 및 테스트 LongTask 생성
  await page.evaluate(() => {
    window.__longTaskAnalytics.startTime = performance.now();
    
    // 테스트용 LongTask 생성 (디버깅용)
    const createTestLongTask = () => {
      console.log('[DEBUG] 테스트 LongTask 생성 시작');
      const startTime = performance.now();
      
      // CPU를 많이 사용하는 작업 (60ms 정도)
      let sum = 0;
      for (let i = 0; i < 10000000; i++) {
        sum += Math.random();
      }
      
      console.log(`[DEBUG] 테스트 LongTask 완료: ${performance.now() - startTime}ms`);
      return sum;
    };
    
    // 2초 후 테스트 LongTask 실행
    setTimeout(createTestLongTask, 2000);
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
  
  // 스크롤 시뮬레이션 및 이벤트 추적
  const result = await page.evaluate(async (scrollSteps, stepDelay, scrollRange) => {
    const scrollContainer = Array.from(document.querySelectorAll('div'))
      .find(div => {
        const style = window.getComputedStyle(div);
        return style.overflowY === 'auto' && div.scrollHeight > div.clientHeight;
      });
    
    if (!scrollContainer) {
      console.error('[EventTrace] 스크롤 컨테이너를 찾을 수 없습니다');
      return { success: false, error: 'No scroll container found' };
    }

    const fullMaxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
    // 파일 전체를 읽지 않고 일부분만 테스트
    const maxScroll = Math.min(fullMaxScroll * scrollRange, 50000); // 최대 50,000px 또는 지정된 비율
    console.log(`[EventTrace] 스크롤 컨테이너: ${scrollContainer.scrollHeight}px (전체 최대: ${fullMaxScroll}px, 테스트 범위: ${maxScroll}px, 범위 비율: ${scrollRange})`);

    // 스크롤 이벤트 리스너
    const scrollListener = () => {
      const timestamp = performance.now();
      window.__longTaskAnalytics.userEvents.push({
        type: 'scroll_detected',
        timestamp: timestamp,
        scrollTop: scrollContainer.scrollTop,
        id: `scroll_${++window.__longTaskAnalytics.eventCounter}`,
      });
    };
    scrollContainer.addEventListener('scroll', scrollListener, { passive: true });

    // 단계별 스크롤 실행 (사람처럼 자연스럽게)
    for (let i = 0; i <= scrollSteps; i++) {
      const beforeLongTasks = window.__longTaskAnalytics.longTasks.length;
      const beforePdfEvents = window.__longTaskAnalytics.pdfEvents.length;
      
      // 이벤트 마킹 시작
      performance.mark(`scroll-step-${i}-start`);
      
      const targetScrollPosition = (maxScroll / scrollSteps) * i;
      const currentScrollPosition = scrollContainer.scrollTop;
      
      console.log(`[EventTrace] 스크롤 Step ${i}/${scrollSteps}: ${currentScrollPosition.toFixed(0)}px → ${targetScrollPosition.toFixed(0)}px`);
      
      // 사람처럼 자연스럽게 스크롤 (여러 단계로 나누어서)
      const scrollDistance = targetScrollPosition - currentScrollPosition;
      const smoothScrollSteps = Math.max(5, Math.floor(Math.abs(scrollDistance) / 200)); // 200px마다 한 단계로 더 세밀하게
      const stepSize = scrollDistance / smoothScrollSteps;
      const smoothStepDelay = 150; // 각 스크롤 단계 간 150ms 대기로 더 천천히
      
      for (let j = 0; j < smoothScrollSteps; j++) {
        const newPosition = currentScrollPosition + (stepSize * (j + 1));
        scrollContainer.scrollTop = Math.round(newPosition);
        
        // 각 작은 스크롤 단계마다 잠깐 대기
        if (j < smoothScrollSteps - 1) {
          await new Promise(r => setTimeout(r, smoothStepDelay));
        }
      }
      
      // 목표 위치에 정확히 도달했는지 확인 및 조정
      if (Math.abs(scrollContainer.scrollTop - targetScrollPosition) > 10) {
        scrollContainer.scrollTop = targetScrollPosition;
      }
      
      // 해당 스크롤 단계 완료 후 원래 설정된 대기 시간 적용 (하지만 스크롤 시간을 빼서 조정)
      const remainingDelay = Math.max(0, stepDelay - (smoothScrollSteps * smoothStepDelay));
      await new Promise(r => setTimeout(r, remainingDelay));
      
      // 현재까지의 모든 LongTask 엔트리 확인
      const currentLongTasks = performance.getEntriesByType('longtask');
      
      performance.mark(`scroll-step-${i}-end`);
      performance.measure(`scroll-duration-${i}`, `scroll-step-${i}-start`, `scroll-step-${i}-end`);
      
      const afterLongTasks = window.__longTaskAnalytics.longTasks.length;
      const afterPdfEvents = window.__longTaskAnalytics.pdfEvents.length;
      
      const newLongTasks = afterLongTasks - beforeLongTasks;
      const newPdfEvents = afterPdfEvents - beforePdfEvents;
      
      // 더 자세한 디버그 정보 출력
      console.log(`[EventTrace] Step ${i} 결과: LongTask +${newLongTasks}개, PDF 이벤트 +${newPdfEvents}개`);
      console.log(`[EventTrace] 누적 LongTasks: ${afterLongTasks}개, PerformanceAPI LongTasks: ${currentLongTasks.length}개`);
      
      // LongTask가 감지되었지만 analytics에 추가되지 않은 경우
      if (currentLongTasks.length > afterLongTasks) {
        console.log(`[EventTrace] ⚠️ PerformanceAPI에서 ${currentLongTasks.length}개 LongTask 감지, analytics에는 ${afterLongTasks}개만 기록됨`);
      }
    }

    scrollContainer.removeEventListener('scroll', scrollListener);

    const endTime = performance.now();
    const startTime = window.__longTaskAnalytics.startTime || 0;

    // 마지막에 Performance API에서 누락된 LongTask 수집
    const missedLongTasks = performance.getEntriesByType('longtask');
    console.log(`[EventTrace] 최종 체크: PerformanceAPI LongTasks ${missedLongTasks.length}개, Analytics LongTasks ${window.__longTaskAnalytics.longTasks.length}개`);
    
    if (missedLongTasks.length > window.__longTaskAnalytics.longTasks.length) {
      console.log(`[EventTrace] 누락된 LongTask들을 수동으로 추가합니다.`);
      
      missedLongTasks.forEach(entry => {
        // 이미 추가된 LongTask인지 확인
        const alreadyAdded = window.__longTaskAnalytics.longTasks.some(existing => 
          existing.startTime === entry.startTime && existing.duration === entry.duration
        );
        
        if (!alreadyAdded) {
          console.log(`[EventTrace] 누락된 LongTask 추가: ${entry.duration.toFixed(2)}ms @ ${entry.startTime.toFixed(2)}ms`);
          window.__longTaskAnalytics.longTasks.push({
            startTime: entry.startTime,
            duration: entry.duration,
            timestamp: performance.now(),
            name: entry.name || 'missed-task',
            attribution: entry.attribution || null,
            context: { detected: 'manual-recovery' },
            stackTrace: 'PerformanceAPI에서 수동 복구',
            id: `lt_recovery_${++window.__longTaskAnalytics.eventCounter}`,
          });
        }
      });
    }

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
  console.log(`   ✅ 종합 분석 완료`);
  console.log(`      - LongTask: ${analytics.longTasks.length}개`);
  console.log(`      - PDF 렌더 이벤트: ${analytics.pdfEvents.length}개`);
  console.log(`      - 네비게이션 이벤트: ${analytics.navigationEvents.length}개`);
  console.log(`      - 리소스 이벤트: ${analytics.resourceEvents.length}개`);
  console.log(`      - 레이아웃 이벤트: ${analytics.layoutEvents.length}개`);
  console.log(`      - 스크립트 이벤트: ${analytics.scriptEvents.length}개`);
  console.log(`      - DOM 이벤트: ${analytics.domEvents.length}개`);
  console.log(`      - CSS 이벤트: ${analytics.cssEvents.length}개`);

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
 * 종합 성능 병목 분석
 */
function analyzePerformanceBottlenecks(data) {
  console.log(`\n🔍 종합 성능 병목 분석: ${data.version}`);
  console.log('='.repeat(80));

  const analytics = data.analytics;
  
  // 네트워크 병목 분석
  console.log(`\n🌐 네트워크 성능 분석:`);
  const { resourceEvents, navigationEvents } = analytics;
  
  if (navigationEvents.length > 0) {
    const nav = navigationEvents[0];
    console.log(`   페이지 로드 시간: ${nav.duration.toFixed(1)}ms`);
    console.log(`   DNS 조회: ${nav.dnsLookup.toFixed(1)}ms`);
    console.log(`   TCP 연결: ${nav.tcpConnect.toFixed(1)}ms`);
    console.log(`   요청/응답: ${(nav.request + nav.response).toFixed(1)}ms`);
    console.log(`   DOM 처리: ${nav.processing.toFixed(1)}ms`);
  }

  // 큰 리소스 분석
  const largeResources = resourceEvents.filter(res => res.transferSize > 100000); // 100KB+
  if (largeResources.length > 0) {
    console.log(`\n📦 큰 리소스 (100KB+):`);
    largeResources.forEach(res => {
      console.log(`   - ${res.name.split('/').pop()}: ${(res.transferSize/1024).toFixed(1)}KB (${res.duration.toFixed(1)}ms)`);
    });
  }

  // 레이아웃 성능 분석
  console.log(`\n📐 레이아웃 성능 분석:`);
  const { layoutEvents } = analytics;
  const layoutShifts = layoutEvents.filter(e => e.type !== 'resize' && e.value);
  const largeShifts = layoutEvents.filter(e => e.value && e.value > 0.1);
  
  console.log(`   총 레이아웃 이동: ${layoutShifts.length}개`);
  console.log(`   큰 레이아웃 이동 (>0.1): ${largeShifts.length}개`);
  
  if (largeShifts.length > 0) {
    const totalShift = layoutShifts.reduce((sum, shift) => sum + shift.value, 0);
    console.log(`   총 레이아웃 이동 점수: ${totalShift.toFixed(3)}`);
  }

  // DOM 조작 분석
  console.log(`\n🏗️  DOM 조작 분석:`);
  const { domEvents } = analytics;
  const mutations = domEvents.filter(e => e.type === 'mutation');
  const creates = domEvents.filter(e => e.type === 'createElement');
  
  console.log(`   요소 생성: ${creates.length}개`);
  console.log(`   DOM 변경: ${mutations.length}개`);
  
  if (mutations.length > 0) {
    const totalChanges = mutations.reduce((sum, mut) => sum + mut.addedNodes + mut.removedNodes, 0);
    console.log(`   총 DOM 변경 횟수: ${totalChanges}개`);
  }

  // 스크립트 로딩 분석
  console.log(`\n📜 스크립트 로딩 분석:`);
  const { scriptEvents } = analytics;
  const externalScripts = scriptEvents.filter(s => s.src && s.src !== 'inline');
  const inlineScripts = scriptEvents.filter(s => s.src === 'inline');
  
  console.log(`   외부 스크립트: ${externalScripts.length}개`);
  console.log(`   인라인 스크립트: ${inlineScripts.length}개`);
  
  if (externalScripts.length > 0) {
    console.log(`   외부 스크립트 목록:`);
    externalScripts.slice(0, 5).forEach(script => {
      console.log(`     - ${script.src.split('/').pop()}`);
    });
  }

  // CSS 성능 분석
  console.log(`\n🎨 CSS 성능 분석:`);
  const { cssEvents } = analytics;
  console.log(`   스타일 변경: ${cssEvents.length}개`);

  // 병목 원인 종합 분석
  console.log(`\n⚠️  성능 병목 후보:`);
  const { bottleneckAnalysis } = analytics;
  
  if (bottleneckAnalysis.networkBottlenecks.length > 0) {
    console.log(`   🌐 네트워크 병목: ${bottleneckAnalysis.networkBottlenecks.length}개`);
    bottleneckAnalysis.networkBottlenecks.forEach(bottleneck => {
      console.log(`     - ${bottleneck.url.split('/').pop()}: ${(bottleneck.size/1024).toFixed(1)}KB`);
    });
  }
  
  if (bottleneckAnalysis.largeLayouts.length > 0) {
    console.log(`   📐 큰 레이아웃 이동: ${bottleneckAnalysis.largeLayouts.length}개`);
  }
  
  // LongTask와 다른 이벤트들의 상관관계
  console.log(`\n🔗 LongTask 상관관계 분석:`);
  const { longTasks } = analytics;
  
  if (longTasks.length > 0) {
    // LongTask 발생 시점 근처의 다른 이벤트들 찾기
    longTasks.forEach((task, idx) => {
      console.log(`   LongTask ${idx + 1} (${task.duration.toFixed(1)}ms):`);
      
      // 근처 DOM 변경 찾기
      const nearbyMutations = domEvents.filter(d => 
        Math.abs(d.timestamp - task.startTime) < 500
      );
      if (nearbyMutations.length > 0) {
        console.log(`     → 동시 DOM 변경: ${nearbyMutations.length}개`);
      }
      
      // 근처 리소스 로딩 찾기
      const nearbyResources = resourceEvents.filter(r => 
        Math.abs(r.startTime - task.startTime) < 500
      );
      if (nearbyResources.length > 0) {
        console.log(`     → 동시 리소스 로딩: ${nearbyResources.length}개`);
      }
    });
  }
}

/**
 * LongTask 상세 분석
 */
function analyzeLongTaskDetails(data) {
  console.log(`\n📊 LongTask 상세 분석: ${data.version}`);
  console.log('='.repeat(80));

  const { longTasks, pdfEvents, userEvents, performanceEntries } = data.analytics;

  if (longTasks.length === 0) {
    console.log('✅ LongTask가 감지되지 않았습니다.');
    return;
  }

  // LongTask 통계
  const totalBlockingTime = longTasks.reduce((sum, task) => sum + Math.max(0, task.duration - 50), 0);
  const avgDuration = longTasks.reduce((sum, task) => sum + task.duration, 0) / longTasks.length;
  const maxDuration = Math.max(...longTasks.map(task => task.duration));

  console.log(`\n⏱️  LongTask 통계:`);
  console.log(`   총 LongTask: ${longTasks.length}개`);
  console.log(`   평균 지속시간: ${avgDuration.toFixed(2)}ms`);
  console.log(`   최대 지속시간: ${maxDuration.toFixed(2)}ms`);
  console.log(`   Total Blocking Time: ${totalBlockingTime.toFixed(2)}ms`);

  // LongTask 발생 패턴 분석
  console.log(`\n📈 LongTask 발생 패턴:`);
  
  // 시간대별 LongTask 분포
  const timeBuckets = {};
  longTasks.forEach(task => {
    const bucket = Math.floor(task.startTime / 1000) * 1000;
    timeBuckets[bucket] = (timeBuckets[bucket] || 0) + 1;
  });

  Object.entries(timeBuckets).forEach(([time, count]) => {
    console.log(`   ${(parseInt(time) / 1000).toFixed(1)}s-${((parseInt(time) + 1000) / 1000).toFixed(1)}s: ${count}개`);
  });

  // LongTask와 PDF 렌더링 이벤트 상관관계
  console.log(`\n🔗 LongTask와 PDF 렌더링 상관관계:`);
  let longTasksWithPdfContext = 0;
  
  longTasks.forEach(task => {
    const taskStart = task.startTime;
    const taskEnd = task.startTime + task.duration;
    
    // LongTask 전후 500ms 내 PDF 이벤트 찾기
    const nearbyPdfEvents = pdfEvents.filter(event => {
      const eventTime = event.timestamp;
      return eventTime >= taskStart - 500 && eventTime <= taskEnd + 500;
    });
    
    if (nearbyPdfEvents.length > 0) {
      longTasksWithPdfContext++;
      console.log(`   LongTask ${task.duration.toFixed(1)}ms @ ${(taskStart / 1000).toFixed(2)}s`);
      console.log(`     → 근처 PDF 이벤트: ${nearbyPdfEvents.length}개`);
      nearbyPdfEvents.forEach(event => {
        console.log(`       - Page ${event.page}: ${event.totalMs}ms 렌더링`);
      });
    }
  });

  console.log(`   PDF 렌더링과 연관된 LongTask: ${longTasksWithPdfContext}/${longTasks.length}개 (${(longTasksWithPdfContext/longTasks.length*100).toFixed(1)}%)`);

  // 가장 긴 LongTask들 상세 정보 및 원인 분석
  console.log(`\n🎯 Top 10 가장 긴 LongTask 상세 분석:`);
  const sortedTasks = [...longTasks].sort((a, b) => b.duration - a.duration);
  sortedTasks.slice(0, 10).forEach((task, idx) => {
    console.log(`\n   ${idx + 1}. ${task.duration.toFixed(2)}ms LongTask @ ${(task.startTime / 1000).toFixed(3)}s`);
    
    // Attribution 정보 출력
    if (task.attribution) {
      console.log(`      📍 발생 위치:`);
      console.log(`         - 컨테이너: ${task.attribution.containerName}`);
      console.log(`         - 스크립트: ${task.attribution.scriptURL}`);
      console.log(`         - 타입: ${task.attribution.containerType}`);
    }
    
    // 컨텍스트 정보 출력
    if (task.context) {
      if (task.context.recentMeasures && task.context.recentMeasures.length > 0) {
        console.log(`      📊 동시 진행된 작업:`);
        task.context.recentMeasures.slice(0, 3).forEach(measure => {
          console.log(`         - ${measure.name}: ${measure.duration.toFixed(1)}ms`);
        });
      }
      
      if (task.context.nearbyPdfEvents && task.context.nearbyPdfEvents.length > 0) {
        console.log(`      📄 관련 PDF 렌더링:`);
        task.context.nearbyPdfEvents.forEach(pdfEvent => {
          console.log(`         - Page ${pdfEvent.page}: ${pdfEvent.totalMs}ms 렌더링`);
        });
      }
    }
    
    // 스택 트레이스 정보 (개선된 버전)
    if (task.stackTrace && task.stackTrace.trim()) {
      console.log(`      🔍 상세 컨텍스트:`);
      const stackLines = task.stackTrace.split('\n').filter(line => line.trim());
      stackLines.slice(0, 5).forEach(line => {
        console.log(`         ${line.trim()}`);
      });
    }
  });
  
  // LongTask 원인 분류
  console.log(`\n📋 LongTask 원인 분류:`);
  const pdfRelatedTasks = longTasks.filter(task => {
    return task.context && task.context.nearbyPdfEvents && task.context.nearbyPdfEvents.length > 0;
  });
  
  const scriptRelatedTasks = longTasks.filter(task => {
    return task.attribution && task.attribution.scriptURL && !task.attribution.scriptURL.includes('unknown');
  });
  
  const unknownTasks = longTasks.filter(task => {
    const hasPdfContext = task.context && task.context.nearbyPdfEvents && task.context.nearbyPdfEvents.length > 0;
    const hasScriptAttribution = task.attribution && task.attribution.scriptURL && !task.attribution.scriptURL.includes('unknown');
    return !hasPdfContext && !hasScriptAttribution;
  });
  
  console.log(`   📄 PDF 렌더링 관련: ${pdfRelatedTasks.length}개 (${(pdfRelatedTasks.length/longTasks.length*100).toFixed(1)}%)`);
  console.log(`   📜 스크립트 실행 관련: ${scriptRelatedTasks.length}개 (${(scriptRelatedTasks.length/longTasks.length*100).toFixed(1)}%)`);
  console.log(`   ❓ 원인 미상: ${unknownTasks.length}개 (${(unknownTasks.length/longTasks.length*100).toFixed(1)}%)`);
  
  if (unknownTasks.length > 0) {
    console.log(`\n⚠️  원인을 파악하지 못한 LongTask들:`);
    unknownTasks.slice(0, 5).forEach((task, idx) => {
      console.log(`   ${idx + 1}. ${task.duration.toFixed(1)}ms @ ${(task.startTime / 1000).toFixed(2)}s`);
    });
  }
}

/**
 * 이벤트 타임라인 분석 (다중 버전 지원)
 */
function analyzeEventTimeline(dataArray) {
  console.log(`\n\n📅 이벤트 타임라인 비교 분석`);
  console.log('='.repeat(80));

  if (dataArray.length < 2) {
    console.log('단일 버전 분석 모드');
    return;
  }

  // 모든 이벤트를 시간순으로 정렬하여 비교
  const createEventTimeline = (data) => {
    const events = [];
    
    data.analytics.longTasks.forEach(task => {
      events.push({
        type: 'longTask',
        timestamp: task.startTime,
        duration: task.duration,
        version: data.version,
        data: task,
      });
    });

    data.analytics.pdfEvents.forEach(event => {
      events.push({
        type: 'pdfRender',
        timestamp: event.timestamp,
        duration: event.totalMs,
        version: data.version,
        data: event,
      });
    });

    data.analytics.userEvents.forEach(event => {
      events.push({
        type: 'userEvent',
        timestamp: event.timestamp,
        version: data.version,
        data: event,
      });
    });

    return events.sort((a, b) => a.timestamp - b.timestamp);
  };

  // 각 버전별 타임라인 생성
  const timelines = dataArray.map(data => ({
    version: data.version,
    timeline: createEventTimeline(data),
    analytics: data.analytics
  }));

  // 버전별 LongTask 수 비교
  console.log(`\n📊 버전별 LongTask 비교:`);
  timelines.forEach(({ version, analytics }) => {
    console.log(`   ${version}: ${analytics.longTasks.length}개 LongTask, ${analytics.pdfEvents.length}개 PDF 렌더 이벤트`);
  });

  // LongTask 밀도 분석
  const analyzeLongTaskDensity = (timeline, windowSize = 2000) => {
    const longTasks = timeline.filter(e => e.type === 'longTask');
    if (longTasks.length === 0) return [];

    const endTime = Math.max(...timeline.map(e => e.timestamp));
    const windows = [];
    
    for (let start = 0; start < endTime; start += windowSize) {
      const end = start + windowSize;
      const tasksInWindow = longTasks.filter(task => 
        task.timestamp >= start && task.timestamp < end
      );
      
      windows.push({
        start,
        end,
        count: tasksInWindow.length,
        totalDuration: tasksInWindow.reduce((sum, task) => sum + task.duration, 0),
      });
    }
    
    return windows;
  };

  // 각 버전별 LongTask 밀도 분석
  console.log(`\n⏰ LongTask 밀도 분석 (2초 윈도우):`);
  timelines.forEach(({ version, timeline }) => {
    const density = analyzeLongTaskDensity(timeline);
    const avgDensity = density.length > 0 ? (density.reduce((sum, w) => sum + w.count, 0) / density.length).toFixed(1) : '0';
    console.log(`   ${version}: 평균 ${avgDensity}개/윈도우`);
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
    if (url3) urls.push({ url: url3, name: name3 });
  }

  if (urls.length === 0) {
    console.error('❌ URL을 지정해주세요 (--url 또는 --url1, --url2, --url3)');
    console.error('\n사용 예:');
    console.error('  node bench/longtask-events/bench-longtask-analytics.js --url "http://localhost:3000/feedback/4"');
    console.error('  node bench/longtask-events/bench-longtask-analytics.js --url1 "..." --name1 "Base" --url2 "..." --name2 "PDF" --url3 "..." --name3 "Queue"');
    console.error('\n3개 버전 비교 예:');
    console.error('  node bench/longtask-events/bench-longtask-analytics.js \\');
    console.error('    --url1 "http://localhost:3000/feedback-basic/4" --name1 "Base" \\');
    console.error('    --url2 "http://localhost:3000/feedback/4?version=pdf" --name2 "PDF" \\');
    console.error('    --url3 "http://localhost:3000/feedback/4?version=queue" --name3 "Queue"');
    process.exit(1);
  }

  console.log('\n🚀 LongTask 이벤트 분석 벤치마크');
  console.log('='.repeat(80));
  console.log(`설정:`);
  console.log(`  - CPU Throttle: ${cpuThrottle}x`);
  console.log(`  - 스크롤 단계: ${scrollSteps}단계, ${stepDelay}ms 간격`);
  console.log(`  - 스크롤 범위: 전체의 ${(scrollRange * 100).toFixed(0)}%`);
  console.log(`  - Headless: ${headless}`);

  const results = [];

  for (const { url, name } of urls) {
    const result = await analyzeLongTaskEvents(url, name);
    if (result) {
      results.push(result);
      analyzePerformanceBottlenecks(result);  // 종합 성능 병목 분석
      analyzeLongTaskDetails(result);         // LongTask 상세 분석
    }
  }

  // 비교 분석 (다중 버전 지원)
  if (results.length >= 2) {
    analyzeEventTimeline(results);
  }

  // 결과 저장
  let outputPath;
  if (outputFile) {
    outputPath = path.isAbsolute(outputFile) ? outputFile : path.join(benchDir, outputFile);
  } else {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    outputPath = path.join(outDir, `longtask-analysis-${timestamp}.json`);
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
    },
    results: results,
  };

  fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));

  console.log(`\n\n💾 결과 저장: ${outputPath}`);
  console.log(`   분석된 버전: ${results.length}개`);
  
  // 최종 요약
  console.log('\n' + '='.repeat(80));
  console.log('📋 최종 요약');
  console.log('='.repeat(80));
  
  results.forEach(result => {
    const analytics = result.analytics;
    const { longTasks, pdfEvents, userEvents, resourceEvents, layoutEvents, domEvents, scriptEvents } = analytics;
    const totalBlockingTime = longTasks.reduce((sum, task) => sum + Math.max(0, task.duration - 50), 0);
    const avgDuration = longTasks.length > 0 ? longTasks.reduce((sum, task) => sum + task.duration, 0) / longTasks.length : 0;
    
    // 네트워크 총 크기 계산
    const totalNetworkSize = resourceEvents.reduce((sum, res) => sum + (res.transferSize || 0), 0);
    
    console.log(`\n🔹 ${result.version}:`);
    console.log(`   📊 LongTask: ${longTasks.length}개 (평균 ${avgDuration.toFixed(1)}ms, TBT ${totalBlockingTime.toFixed(1)}ms)`);
    console.log(`   📄 PDF 렌더: ${pdfEvents.length}개`);
    console.log(`   👆 사용자 이벤트: ${userEvents.length}개`);
    console.log(`   🌐 네트워크 리소스: ${resourceEvents.length}개 (총 ${(totalNetworkSize/1024/1024).toFixed(2)}MB)`);
    console.log(`   📐 레이아웃 이벤트: ${layoutEvents.length}개`);
    console.log(`   🏗️  DOM 조작: ${domEvents.length}개`);
    console.log(`   📜 스크립트: ${scriptEvents.length}개`);
    
    // 병목 후보 요약
    const { bottleneckAnalysis } = analytics;
    if (bottleneckAnalysis.networkBottlenecks.length > 0 || bottleneckAnalysis.largeLayouts.length > 0) {
      console.log(`   ⚠️  병목 후보: 네트워크 ${bottleneckAnalysis.networkBottlenecks.length}개, 레이아웃 ${bottleneckAnalysis.largeLayouts.length}개`);
    }
  });
  
  console.log('\n✅ LongTask 분석 완료!\n');

})().catch((e) => {
  console.error('❌ 오류 발생:', e);
  console.error(e.stack);
  process.exit(1);
});
