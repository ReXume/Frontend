#!/usr/bin/env node
/**
 * RAF Windowing 버전 시각적 스크롤 테스트
 * PDF.js raf-windowing 버전의 스크롤 이벤트를 눈으로 확인하는 테스트
 * 
 * 목적:
 * - raf-windowing 버전의 스크롤 동작을 시각적으로 관찰
 * - CPU 스로틀링 4x로 저사양 환경 시뮬레이션
 * - 스크롤 시 페이지 렌더링 및 FPS 변화 확인
 * 
 * 사용:
 *   node bench/real-user-pattern/test-raf-windowing-visual.js
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// 설정값
const testUrl = 'http://localhost:3000/feedback/4?version=raf-windowing';
const cpuThrottle = 4; // CPU 스로틀링 4x (저사양 환경)
const headless = false; // 브라우저 창 표시 (눈으로 보기 위해)
const testDuration = 30000; // 테스트 지속시간 (30초)

const benchDir = __dirname;
const outDir = path.join(benchDir, 'results');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

/**
 * RAF Windowing 버전 시각적 테스트
 */
async function testRAFWindowingVisual() {
  console.log('\n🎯 RAF Windowing 시각적 스크롤 테스트 시작');
  console.log(`   URL: ${testUrl}`);
  console.log(`   CPU Throttling: ${cpuThrottle}x`);
  console.log(`   Headless: ${headless} (브라우저 창 표시)`);
  console.log(`   테스트 시간: ${testDuration / 1000}초`);
  
  const browser = await puppeteer.launch({
    headless: headless ? 'new' : false, // 브라우저 창 표시
    defaultViewport: { width: 1920, height: 1080 },
    args: [
      '--disable-dev-shm-usage', 
      '--no-sandbox',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor'
    ],
    protocolTimeout: 120000, // 2분
  });

  const page = await browser.newPage();
  
  // 타임아웃 설정 (2분)
  page.setDefaultTimeout(120000);

  // User-Agent와 추가 헤더 설정 (400 에러 방지)
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  // 추가 헤더 설정
  await page.setExtraHTTPHeaders({
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
  });

  // CPU throttling 적용
  if (cpuThrottle > 1) {
    const client = await page.target().createCDPSession();
    await client.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottle });
    console.log(`   ✅ CPU ${cpuThrottle}x throttling 적용됨`);
  }

  // 콘솔 로그 포워딩 (스크롤 관련 로그 추가)
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('🧩') || text.includes('[LongTask]') || text.includes('[FPS]') || 
        text.includes('[Scroll]') || text.includes('[Render]') || text.includes('Incremental') || 
        text.includes('rAF') || text.includes('페이즈 변경') || text.includes('스크롤') ||
        text.includes('PDF 뷰어') || text.includes('컨테이너') || text.includes('스크롤 이벤트')) {
      console.log(`   ${text}`);
    }
  });

  // 네트워크 에러 모니터링
  page.on('response', (response) => {
    if (!response.ok()) {
      console.log(`   ❌ 네트워크 에러: ${response.url()} - ${response.status()} ${response.statusText()}`);
    }
  });

  page.on('requestfailed', (request) => {
    console.log(`   ❌ 요청 실패: ${request.url()} - ${request.failure().errorText}`);
  });

  // 메트릭 수집 설정
  await page.evaluateOnNewDocument(() => {
    window.__rafWindowingMetrics = {
      scrollEvents: [],
      renderEvents: [],
      fpsMeasurements: [],
      longTasks: [],
      mountEvents: [],
      startTime: null,
    };

    // FPS 측정
    let frameCount = 0;
    let lastTime = performance.now();
    let fpsStartTime = null;

    function measureFPS() {
      frameCount++;
      const currentTime = performance.now();
      
      if (fpsStartTime === null) {
        fpsStartTime = currentTime;
      }
      
      // 1초마다 FPS 계산
      if (currentTime - lastTime >= 1000) {
        const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
        const elapsed = (currentTime - fpsStartTime) / 1000;
        
        window.__rafWindowingMetrics.fpsMeasurements.push({
          fps: fps,
          timestamp: currentTime,
          elapsed: elapsed,
        });
        
        console.log(`[FPS] ${fps} FPS @ ${elapsed.toFixed(1)}s`);
        
        frameCount = 0;
        lastTime = currentTime;
      }
      
      requestAnimationFrame(measureFPS);
    }
    
    requestAnimationFrame(measureFPS);

    // LongTask Observer
    if (window.PerformanceObserver) {
      try {
        const ltObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            window.__rafWindowingMetrics.longTasks.push({
              startTime: entry.startTime,
              duration: entry.duration,
              timestamp: performance.now(),
            });
            console.log(`[LongTask] ${entry.duration.toFixed(2)}ms @ ${entry.startTime.toFixed(2)}ms`);
          }
        });
        ltObserver.observe({ type: 'longtask', buffered: true });
      } catch (e) {
        console.warn('[LongTask] Observer 초기화 실패:', e);
      }
    }

    // PDF 렌더링 메트릭 수집
    window.pdfRenderMetricsCollector = {
      metrics: [],
      add: function(metric) {
        this.metrics.push(metric);
        const timestamp = performance.now();
        window.__rafWindowingMetrics.renderEvents.push({
          ...metric,
          timestamp: timestamp,
        });
        console.log(`[Render] 페이지 ${metric.page}: ${metric.totalMs.toFixed(1)}ms`);
      }
    };
  });

  console.log('   📖 페이지 로딩 중...');
  
  try {
    await page.goto(testUrl, { 
      waitUntil: ['domcontentloaded'], 
      timeout: 120000
    });
    
    // 네트워크가 안정될 때까지 조금 더 기다림
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 추가 리소스 로딩 대기 (Puppeteer에서는 waitForFunction 사용)
    try {
      await page.waitForFunction(() => {
        return document.readyState === 'complete';
      }, { timeout: 10000 });
    } catch (e) {
      console.log('   ⚠️  페이지 완전 로딩 타임아웃, 계속 진행...');
    }
    
  } catch (error) {
    console.error('   ❌ 페이지 로딩 실패:', error.message);
    // 페이지 로딩에 실패해도 계속 진행
  }

  console.log('   ⏳ 초기화 대기 중...');
  await new Promise(resolve => setTimeout(resolve, 5000)); // 5초 대기

  // PDF 로딩 완료 확인
  console.log('   🔍 PDF 콘텐츠 확인 중...');
  try {
    await page.waitForFunction(() => {
      const bodyHeight = document.body.scrollHeight;
      const docHeight = document.documentElement.scrollHeight;
      const viewportHeight = window.innerHeight;
      const maxHeight = Math.max(bodyHeight, docHeight);
      
      return maxHeight > viewportHeight + 500;
    }, { timeout: 60000 });
    console.log('   ✅ PDF 로딩 완료');
  } catch (error) {
    console.warn('   ⚠️  PDF 로딩 타임아웃, 계속 진행...');
  }

  // 버전 정보 확인 및 안정성 체크
  let versionInfo;
  try {
    versionInfo = await page.evaluate(() => {
      const versionDiv = document.querySelector('.bg-blue-100');
      const versionText = versionDiv?.textContent || 'Unknown';
      const hasCollector = typeof window.pdfRenderMetricsCollector !== 'undefined';
      
      return {
        versionText: versionText.trim(),
        hasCollector: hasCollector,
        url: window.location.href,
      };
    });
  } catch (error) {
    console.warn('   ⚠️  버전 정보 확인 실패:', error.message);
    versionInfo = { versionText: 'Unknown', hasCollector: false, url: testUrl };
  }
  
  console.log(`   🏷️  버전: ${versionInfo.versionText}`);
  console.log(`   📊 메트릭 수집기: ${versionInfo.hasCollector ? '✅' : '❌'}`);

  // 측정 시작
  try {
    await page.evaluate(() => {
      window.__rafWindowingMetrics.startTime = performance.now();
    });
  } catch (error) {
    console.warn('   ⚠️  메트릭 시작 실패:', error.message);
  }

  console.log('\n🎬 스크롤 테스트 시작! (30초간)');
  console.log('   브라우저 창에서 스크롤 동작을 직접 확인하세요.');
  console.log('   📊 화면 우측 상단의 진행률 표시를 확인하세요.');

  // 페이지 완전 안정화 대기
  console.log('   🔍 페이지 완전 안정화 대기 중...');
  
  // 더 강력한 안정성 체크
  for (let i = 0; i < 10; i++) {
    try {
      const pageInfo = await page.evaluate(() => {
        return {
          readyState: document.readyState,
          hasMetrics: typeof window.__rafWindowingMetrics !== 'undefined',
          hasCollector: typeof window.pdfRenderMetricsCollector !== 'undefined',
          bodyHeight: document.body.scrollHeight,
          docHeight: document.documentElement.scrollHeight
        };
      });
      
      console.log(`   📊 페이지 상태 체크 ${i + 1}/10: readyState=${pageInfo.readyState}, metrics=${pageInfo.hasMetrics}, bodyHeight=${pageInfo.bodyHeight}`);
      
      if (pageInfo.readyState === 'complete' && pageInfo.hasMetrics && pageInfo.bodyHeight > 10000) {
        console.log('   ✅ 페이지 안정화 완료!');
        break;
      }
      
      if (i === 9) {
        console.log('   ⚠️ 페이지 안정화 타임아웃, 강제 진행...');
      }
    } catch (error) {
      console.log(`   ⚠️ 페이지 체크 ${i + 1} 실패: ${error.message}`);
      if (i === 9) {
        console.log('   ❌ 페이지 접근 불가, 테스트 취소');
        throw new Error('Cannot access page after multiple attempts');
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2초씩 대기
  }
  
  // 스크롤 시뮬레이션 시작 - 안전한 실행 컨텍스트 처리
  let scrollTest;
  try {
    
    scrollTest = await page.evaluate(async (testDuration) => {
    console.log('[Scroll] 🚀 스크롤 테스트 함수 시작!');
    
    // 전역 스크롤 이벤트 카운터 초기화
    if (!window.__scrollEventCounter) {
      window.__scrollEventCounter = 0;
    }
    
    // 모든 가능한 스크롤 컨테이너 찾기 및 이벤트 리스너 등록
    const scrollContainers = [];
    
    console.log('[Scroll] 모든 스크롤 가능한 요소 검색 중...');
    
    // 1. window 스크롤 (가장 일반적)
    scrollContainers.push({
      element: window,
      type: 'window',
      getScroll: () => window.pageYOffset || document.documentElement.scrollTop,
      setScroll: (pos) => window.scrollTo(0, pos),
      maxScroll: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) - window.innerHeight
    });
    
    // 2. document.body 스크롤
    if (document.body.scrollHeight > window.innerHeight) {
      scrollContainers.push({
        element: document.body,
        type: 'body',
        getScroll: () => document.body.scrollTop,
        setScroll: (pos) => { document.body.scrollTop = pos; },
        maxScroll: document.body.scrollHeight - window.innerHeight
      });
    }
    
    // 3. 모든 div 요소 중 스크롤 가능한 것들
    Array.from(document.querySelectorAll('div')).forEach((div, index) => {
      const style = window.getComputedStyle(div);
      const rect = div.getBoundingClientRect();
      
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
        if (div.scrollHeight > div.clientHeight) {
          scrollContainers.push({
            element: div,
            type: `div-${index}`,
            getScroll: () => div.scrollTop,
            setScroll: (pos) => { div.scrollTop = pos; },
            maxScroll: div.scrollHeight - div.clientHeight
          });
        }
      }
    });
    
    console.log(`[Scroll] 발견된 스크롤 컨테이너: ${scrollContainers.length}개`);
    scrollContainers.forEach((container, i) => {
      console.log(`[Scroll] 컨테이너 ${i + 1}: ${container.type}, maxScroll: ${container.maxScroll}px`);
    });
    
    // 스크롤 이벤트 리스너 (모든 컨테이너에 적용)
    let totalScrollEvents = 0;
    const scrollListener = (event) => {
      totalScrollEvents++;
      window.__scrollEventCounter = totalScrollEvents;
      
      const timestamp = performance.now();
      const targetType = event.target === window ? 'window' : 
                        event.target === document.body ? 'body' : 
                        event.target.tagName || 'div';
      
      console.log(`[Scroll] 🎯 이벤트 발생! 총 ${totalScrollEvents}회, 타겟: ${targetType}`);
      
      // 메트릭 수집
      if (window.__rafWindowingMetrics) {
        window.__rafWindowingMetrics.scrollEvents.push({
          timestamp: timestamp,
          eventNumber: totalScrollEvents,
          targetType: targetType,
          scrollTop: event.target === window ? 
            (window.pageYOffset || document.documentElement.scrollTop) : 
            event.target.scrollTop || 0
        });
      }
    };
    
    // 모든 컨테이너에 이벤트 리스너 등록
    scrollContainers.forEach(container => {
      if (container.element === window) {
        window.addEventListener('scroll', scrollListener, { passive: true, capture: true });
        document.addEventListener('scroll', scrollListener, { passive: true, capture: true });
      } else {
        container.element.addEventListener('scroll', scrollListener, { passive: true, capture: true });
      }
      console.log(`[Scroll] 리스너 등록됨: ${container.type}`);
    });
    
    // 테스트용 즉시 스크롤 이벤트 발생
    setTimeout(() => {
      console.log('[Scroll] 🧪 테스트 스크롤 이벤트 발사...');
      window.scrollTo(0, 1);
      setTimeout(() => window.scrollTo(0, 0), 100);
      
      // 모든 컨테이너 테스트
      scrollContainers.forEach(container => {
        if (container.maxScroll > 0) {
          const testPos = Math.min(10, container.maxScroll);
          container.setScroll(testPos);
          setTimeout(() => container.setScroll(0), 100);
        }
      });
    }, 500);
    
    // 메인 스크롤 컨테이너 선택 (가장 큰 스크롤 범위를 가진 것)
    const mainScrollContainer = scrollContainers.length > 0 ? 
      scrollContainers.reduce((max, current) => current.maxScroll > max.maxScroll ? current : max) : 
      null;
      
    if (!mainScrollContainer || mainScrollContainer.maxScroll <= 0) {
      console.log('[Scroll] ❌ 스크롤할 수 있는 컨테이너를 찾을 수 없습니다.');
      return {
        success: false,
        error: 'No scrollable container found',
        scrollContainers: scrollContainers.length,
        totalEvents: totalScrollEvents
      };
    }
    
    console.log(`[Scroll] 메인 스크롤 컨테이너: ${mainScrollContainer.type}, maxScroll: ${mainScrollContainer.maxScroll}px`);
    
    // 스크롤 가능 여부 확인
    const canScroll = mainScrollContainer.maxScroll > 0;
    console.log(`[Scroll] 스크롤 가능 여부: ${canScroll ? '✅ 가능' : '❌ 불가능'}`);
    
    if (!canScroll) {
      console.log(`[Scroll] ⚠️ 스크롤할 내용이 없습니다.`);
      return {
        success: false,
        error: 'No scrollable content',
        maxScroll: mainScrollContainer.maxScroll,
        totalEvents: totalScrollEvents
      };
    }
    
    console.log('[Scroll] 스크롤 이벤트 리스너 등록 완료');
    console.log(`[Scroll] 현재 스크롤 위치: ${mainScrollContainer.getScroll()}px`);
    console.log(`[Scroll] 스크롤 가능 범위: 0 ~ ${mainScrollContainer.maxScroll}px`);

    const startTime = performance.now();
    const endTime = startTime + testDuration;

    console.log('[Scroll] 🎯 스크롤 시뮬레이션 시작');

    // 더 효과적인 스크롤 패턴
    const scrollPhases = [
      { name: '빠른 스크롤 다운', duration: 8000, direction: 1, speed: 12 },
      { name: '멈춤', duration: 2000, direction: 0, speed: 0 },
      { name: '천천히 스크롤 업', duration: 6000, direction: -1, speed: 6 },
      { name: '멈춤', duration: 2000, direction: 0, speed: 0 },
      { name: '빠른 스크롤 다운', duration: 8000, direction: 1, speed: 15 },
      { name: '빠른 스크롤 업', duration: 4000, direction: -1, speed: 10 },
    ];

    let phaseIndex = 0;
    let phaseStartTime = startTime;
    let currentScroll = 0;

    while (performance.now() < endTime) {
      const now = performance.now();
      const elapsed = (now - startTime) / 1000;
      const progress = Math.min(elapsed / (testDuration / 1000), 1);
      
      // 현재 페이즈 확인
      const phase = scrollPhases[phaseIndex % scrollPhases.length];
      const phaseElapsed = now - phaseStartTime;
      
      if (phaseElapsed >= phase.duration) {
        // 다음 페이즈로 이동
        phaseIndex++;
        phaseStartTime = now;
        console.log(`[Scroll] 페이즈 변경: ${phase.name} → ${scrollPhases[phaseIndex % scrollPhases.length].name}`);
      }

      // 진행률 표시 업데이트
      const progressElement = document.querySelector('.fixed.top-4.right-4');
      if (progressElement) {
        const latestFps = window.__rafWindowingMetrics.fpsMeasurements.length > 0 ? 
          window.__rafWindowingMetrics.fpsMeasurements[window.__rafWindowingMetrics.fpsMeasurements.length - 1].fps : 'N/A';
        
        progressElement.innerHTML = `
          <div>🧩 RAF Windowing 테스트</div>
          <div>진행률: ${(progress * 100).toFixed(1)}%</div>
          <div>경과시간: ${elapsed.toFixed(1)}s</div>
          <div>현재 페이즈: ${phase.name}</div>
          <div>스크롤 이벤트: ${totalScrollEvents}회</div>
          <div>렌더 이벤트: ${window.__rafWindowingMetrics ? window.__rafWindowingMetrics.renderEvents.length : 0}개</div>
          <div>FPS: ${latestFps}</div>
        `;
      }

      // 스크롤 실행
      if (phase.speed > 0) {
        const oldScroll = currentScroll;
        currentScroll += phase.direction * phase.speed;
        
        // 경계 처리
        if (currentScroll > mainScrollContainer.maxScroll) {
          currentScroll = mainScrollContainer.maxScroll;
        } else if (currentScroll < 0) {
          currentScroll = 0;
        }
        
        // 실제로 스크롤 위치가 변경된 경우에만 스크롤 실행
        if (Math.abs(currentScroll - oldScroll) > 0.1) {
          try {
            mainScrollContainer.setScroll(currentScroll);
            
            // 디버깅을 위해 스크롤 변화를 로그로 출력
            if (elapsed % 1 < 0.1) { // 1초마다 한 번씩
              console.log(`[Scroll] 스크롤 실행: ${oldScroll.toFixed(0)}px → ${currentScroll.toFixed(0)}px (페이즈: ${phase.name})`);
              
              // 실제 스크롤 위치 확인
              setTimeout(() => {
                const actualScroll = mainScrollContainer.getScroll();
                if (Math.abs(actualScroll - currentScroll) > 5) {
                  console.log(`[Scroll] ⚠️ 스크롤 위치 불일치: 예상=${currentScroll.toFixed(0)}px, 실제=${actualScroll.toFixed(0)}px`);
                }
              }, 50);
            }
          } catch (error) {
            console.log(`[Scroll] ❌ 스크롤 실행 오류: ${error.message}`);
          }
        }
      }

      // 더 부드러운 업데이트를 위해 16ms 대기
      await new Promise(r => setTimeout(r, 16));
    }

    // 이벤트 리스너 정리 - 모든 등록된 리스너 제거
    scrollContainers.forEach(container => {
      try {
        if (container.element === window) {
          window.removeEventListener('scroll', scrollListener, { capture: true });
          document.removeEventListener('scroll', scrollListener, { capture: true });
        } else {
          container.element.removeEventListener('scroll', scrollListener, { capture: true });
        }
      } catch (error) {
        console.log(`[Scroll] 리스너 제거 실패: ${container.type} - ${error.message}`);
      }
    });
    
    console.log(`[Scroll] 테스트 종료 - 총 이벤트: ${totalScrollEvents}회`);

    const finalTime = performance.now();

    return {
      success: true,
      duration: finalTime - startTime,
      scrollEvents: window.__rafWindowingMetrics ? window.__rafWindowingMetrics.scrollEvents : [],
      renderEvents: window.__rafWindowingMetrics ? window.__rafWindowingMetrics.renderEvents : [],
      fpsMeasurements: window.__rafWindowingMetrics ? window.__rafWindowingMetrics.fpsMeasurements : [],
      longTasks: window.__rafWindowingMetrics ? window.__rafWindowingMetrics.longTasks : [],
      maxScroll: mainScrollContainer.maxScroll,
      finalScrollPosition: mainScrollContainer.getScroll(),
      totalScrollEvents: totalScrollEvents,
      scrollContainersFound: scrollContainers.length
    };
  }, testDuration);
  } catch (error) {
    console.error('   ❌ 스크롤 테스트 실행 실패:', error.message);
    scrollTest = {
      success: false,
      error: error.message,
      scrollEvents: [],
      renderEvents: [],
      fpsMeasurements: [],
      longTasks: [],
      maxScroll: 0,
      finalScrollPosition: 0
    };
  }

  console.log('\n✅ 테스트 완료!');
  if (scrollTest && scrollTest.success !== false) {
    console.log(`   📊 총 스크롤 이벤트: ${scrollTest.scrollEvents ? scrollTest.scrollEvents.length : 0}회`);
    console.log(`   🖼️  렌더 이벤트: ${scrollTest.renderEvents ? scrollTest.renderEvents.length : 0}개`);
    console.log(`   ⏱️  LongTask: ${scrollTest.longTasks ? scrollTest.longTasks.length : 0}개`);
    console.log(`   📏 최대 스크롤: ${scrollTest.maxScroll || 0}px`);
    console.log(`   🎯 최종 스크롤 위치: ${(scrollTest.finalScrollPosition || 0).toFixed(0)}px`);
  } else {
    console.log(`   ❌ 테스트 실패: ${scrollTest?.error || 'Unknown error'}`);
  }
  
  // FPS 통계
  if (scrollTest && scrollTest.fpsMeasurements && scrollTest.fpsMeasurements.length > 0) {
    const avgFps = Math.round(scrollTest.fpsMeasurements.reduce((sum, m) => sum + m.fps, 0) / scrollTest.fpsMeasurements.length);
    const minFps = Math.min(...scrollTest.fpsMeasurements.map(m => m.fps));
    const maxFps = Math.max(...scrollTest.fpsMeasurements.map(m => m.fps));
    console.log(`   🎯 FPS: 평균 ${avgFps} (최소 ${minFps}, 최대 ${maxFps})`);
  }

  // 스크롤 이벤트 분포 분석
  if (scrollTest && scrollTest.scrollEvents && scrollTest.scrollEvents.length > 0) {
    const scrollDistance = Math.max(...scrollTest.scrollEvents.map(e => e.scrollTop)) - 
                          Math.min(...scrollTest.scrollEvents.map(e => e.scrollTop));
    console.log(`   📈 스크롤 이동 거리: ${scrollDistance.toFixed(0)}px`);
    
    // 스크롤 이벤트 간격 통계
    const intervals = [];
    for (let i = 1; i < scrollTest.scrollEvents.length; i++) {
      intervals.push(scrollTest.scrollEvents[i].timestamp - scrollTest.scrollEvents[i-1].timestamp);
    }
    if (intervals.length > 0) {
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      console.log(`   ⏰ 평균 스크롤 이벤트 간격: ${avgInterval.toFixed(1)}ms`);
    }
  }

  // 결과 저장
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = path.join(outDir, `raf-windowing-visual-test-${timestamp}.json`);
  
  fs.writeFileSync(outputPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    version: 'RAF-Windowing-Visual',
    url: testUrl,
    config: {
      cpuThrottle,
      testDuration,
      headless,
    },
    result: scrollTest,
    versionInfo,
  }, null, 2));

  console.log(`\n💾 결과 저장: ${outputPath}`);
  console.log('\n🎉 브라우저 창을 확인하여 스크롤 동작을 관찰하셨나요?');
  console.log('   📋 확인 사항:');
  console.log('   - 페이지가 점진적으로 마운트되는 것을 확인했나요?');
  console.log('   - 스크롤 시 부드러운 렌더링을 확인했나요?');
  console.log('   - 다양한 스크롤 패턴(빠름/천천히/멈춤)에서 성능이 어떻게 변화하는지 확인했나요?');
  console.log('   - FPS가 안정적으로 유지되는 것을 확인했나요?');
  console.log('   - 스크롤 방향 변경 시 렌더링 지연이 있었나요?');

  // 브라우저를 5초 후에 닫음 (결과 확인 시간 제공)
  setTimeout(async () => {
    await browser.close();
    console.log('\n🔚 테스트 종료');
  }, 5000);
}

// 실행
(async () => {
  try {
    await testRAFWindowingVisual();
  } catch (error) {
    console.error('❌ 테스트 실행 중 오류:', error);
    process.exit(1);
  }
})();
