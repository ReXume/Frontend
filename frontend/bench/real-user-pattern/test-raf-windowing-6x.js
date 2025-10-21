#!/usr/bin/env node
/**
 * raf-windowing 버전 4배 CPU 스로틀링 실사용자 테스트
 * http://localhost:3000/feedback/4?version=raf-windowing
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// ---- 설정 ----
const testUrl = 'http://localhost:3000/feedback/4?version=raf-windowing';
const cpuThrottle = 4; // 4배 CPU 스로틀링
const headless = false; // 시각적 확인을 위해 headless 비활성화
const realisticPattern = true; // 현실적 사용자 패턴

const benchDir = __dirname;
const outDir = path.join(benchDir, 'results');

/**
 * 4배 CPU 스로틀링을 적용한 실사용자 테스트
 */
async function testRealUserExperience() {
  console.log('\n🚀 raf-windowing 버전 4배 CPU 스로틀링 실사용자 테스트');
  console.log(`   URL: ${testUrl}`);
  console.log(`   CPU 스로틀링: ${cpuThrottle}x`);
  
  const browser = await puppeteer.launch({
    headless: headless ? 'new' : false,
    defaultViewport: { width: 1920, height: 1080 },
    args: [
      '--disable-dev-shm-usage', 
      '--no-sandbox',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows'
    ],
    protocolTimeout: 180000, // 3분
  });

  const page = await browser.newPage();
  
  // 타임아웃 설정 (3분)
  page.setDefaultTimeout(180000);

  // CSS와 스타일시트 로딩을 위한 설정
  await page.evaluateOnNewDocument(() => {
    // 스타일시트 로딩 완료 대기
    const waitForStyles = () => {
      return new Promise((resolve) => {
        if (document.readyState === 'complete') {
          // 모든 스타일시트 로드 완료 확인
          const stylesheets = document.querySelectorAll('link[rel="stylesheet"]');
          let loadedCount = 0;
          
          if (stylesheets.length === 0) {
            resolve();
            return;
          }
          
          stylesheets.forEach(link => {
            if (link.sheet) {
              loadedCount++;
            } else {
              link.addEventListener('load', () => {
                loadedCount++;
                if (loadedCount === stylesheets.length) {
                  resolve();
                }
              });
              link.addEventListener('error', () => {
                loadedCount++;
                if (loadedCount === stylesheets.length) {
                  resolve();
                }
              });
            }
          });
          
          if (loadedCount === stylesheets.length) {
            resolve();
          }
        } else {
          window.addEventListener('load', waitForStyles);
        }
      });
    };
    
    window.__waitForStyles = waitForStyles;
  });

  // CPU 스로틀링 설정만 적용
  const client = await page.target().createCDPSession();
  await client.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottle });
  
  console.log(`   ✅ CPU ${cpuThrottle}x 스로틀링 적용됨`);

  // 콘솔 로그 포워딩
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('[PDFTrace]') || text.includes('[LongTask]') || 
        text.includes('[FPS]') || text.includes('🧩') || text.includes('📊')) {
      console.log(`   ${text}`);
    }
  });

  // 페이지 로드 전 메트릭 추적 설정
  await page.evaluateOnNewDocument(() => {
    window.__realUserMetrics = {
      sendWithPromiseCalls: [],
      longTasks: [],
      scrollEvents: [],
      renderEvents: [],
      fpsMeasurements: [],
      networkRequests: [],
      startTime: null,
      pageLoadTime: null,
      firstContentfulPaint: null,
      largestContentfulPaint: null,
    };

    // 네트워크 요청 추적
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
      const startTime = performance.now();
      const url = args[0]?.toString() || '';
      
      return originalFetch.apply(this, args)
        .then(response => {
          const endTime = performance.now();
          window.__realUserMetrics.networkRequests.push({
            url: url.substring(0, 100),
            duration: endTime - startTime,
            timestamp: startTime,
            status: response.status,
          });
          return response;
        })
        .catch(error => {
          const endTime = performance.now();
          window.__realUserMetrics.networkRequests.push({
            url: url.substring(0, 100),
            duration: endTime - startTime,
            timestamp: startTime,
            status: 'error',
            error: error.message,
          });
          throw error;
        });
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
      
      if (currentTime - lastTime >= 1000) {
        const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
        const elapsed = (currentTime - fpsStartTime) / 1000;
        
        window.__realUserMetrics.fpsMeasurements.push({
          fps: fps,
          timestamp: currentTime,
          elapsed: elapsed,
          frameCount: frameCount
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
            const timestamp = performance.now();
            window.__realUserMetrics.longTasks.push({
              startTime: entry.startTime,
              duration: entry.duration,
              timestamp: timestamp,
            });
            console.log(`[LongTask] ${entry.duration.toFixed(2)}ms @ ${entry.startTime.toFixed(2)}ms`);
          }
        });
        ltObserver.observe({ type: 'longtask', buffered: true });

        // Web Vitals 측정
        const paintObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name === 'first-contentful-paint') {
              window.__realUserMetrics.firstContentfulPaint = entry.startTime;
            }
          }
        });
        paintObserver.observe({ type: 'paint', buffered: true });

        const lcpObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            window.__realUserMetrics.largestContentfulPaint = entry.startTime;
          }
        });
        lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

      } catch (e) {
        console.warn('[Metrics] Observer 초기화 실패:', e);
      }
    }
  });

  console.log('   페이지 로딩 중...');
  const startTime = Date.now();
  
  await page.goto(testUrl, { 
    waitUntil: ['networkidle0', 'load'], 
    timeout: 120000
  });

  const loadTime = Date.now() - startTime;
  
  console.log(`   페이지 로드 완료 (${loadTime}ms)`);
  
  // CSS와 스타일 로딩 대기
  console.log('   CSS 및 스타일 로딩 대기 중...');
  await page.waitForFunction(() => {
    // 모든 중요한 스타일시트가 로드되었는지 확인
    const stylesheets = document.querySelectorAll('link[rel="stylesheet"]');
    return Array.from(stylesheets).every(link => link.sheet || link.disabled);
  }, { timeout: 30000 });
  
  // 추가 렌더링 대기 (CSS 적용 완료)
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // 페이지 로드 시간 기록
  await page.evaluate(() => {
    window.__realUserMetrics.pageLoadTime = performance.now();
    window.__realUserMetrics.startTime = performance.now();
  });

  // 초기화 대기
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 버전 정보 확인
  const versionInfo = await page.evaluate(() => {
    const versionDiv = document.querySelector('.bg-indigo-100, .bg-blue-100, .bg-orange-100, .bg-green-100');
    const versionText = versionDiv?.textContent || 'Unknown';
    
    return {
      versionText: versionText.trim(),
      url: window.location.href,
      hasMetrics: typeof window.__realUserMetrics !== 'undefined',
    };
  });
  
  console.log('   버전 정보:', versionInfo.versionText);
  console.log('   메트릭 수집기:', versionInfo.hasMetrics ? '✅' : '❌');

  console.log('   🎯 실사용자 패턴 스크롤 시뮬레이션 시작...');

  // 실사용자 패턴 스크롤 테스트
  const result = await page.evaluate(async (pageLoadTime) => {
    // 여러 방법으로 스크롤 컨테이너 찾기 시도
    let scrollContainer = null;
    
    // 방법 1: overflowY: auto인 div 찾기
    scrollContainer = Array.from(document.querySelectorAll('div'))
      .find(div => {
        const style = window.getComputedStyle(div);
        return (style.overflowY === 'auto' || style.overflowY === 'scroll') && div.scrollHeight > div.clientHeight;
      });
    
    // 방법 2: 특정 스타일 속성을 가진 컨테이너 찾기
    if (!scrollContainer) {
      scrollContainer = Array.from(document.querySelectorAll('div'))
        .find(div => {
          const rect = div.getBoundingClientRect();
          const style = window.getComputedStyle(div);
          return div.style.maxHeight === '90vh' || style.maxHeight === '90vh' || 
                 (rect.width > 1000 && rect.height > 500); // PDF 컨테이너 크기 기준
        });
    }
    
    // 방법 3: 링크가 아닌 모든 스크롤 가능한 요소 검색
    if (!scrollContainer) {
      scrollContainer = Array.from(document.querySelectorAll('*'))
        .find(el => {
          const style = window.getComputedStyle(el);
          return (style.overflowY === 'auto' || style.overflowY === 'scroll') && 
                 el.scrollHeight > el.clientHeight + 100; // 충분한 스크롤 공간
        });
    }
    
    if (!scrollContainer) {
      console.error('[Scroll] 스크롤 컨테이너를 찾을 수 없습니다');
      return { success: false, error: 'No scroll container found' };
    }

    const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
    console.log(`[Scroll] 컨테이너 발견: ${scrollContainer.scrollHeight}px (max scroll: ${maxScroll}px)`);

    // 스크롤 이벤트 리스너
    let scrollEventCount = 0;
    const scrollListener = () => {
      const timestamp = performance.now();
      scrollEventCount++;
      window.__realUserMetrics.scrollEvents.push({
        timestamp: timestamp,
        scrollTop: scrollContainer.scrollTop,
        eventNumber: scrollEventCount,
      });
    };
    scrollContainer.addEventListener('scroll', scrollListener, { passive: true });

    // 실사용자 패턴: 천천히 스크롤하며 읽기
    console.log('[Scroll] 🎯 실사용자 패턴: 천천히 스크롤하며 읽기');
    
    const scrollChunkSize = 200; // 한 번에 스크롤할 픽셀 수 (더 작게)
    const scrollSpeed = 100; // 스크롤 속도 (더 느리게)
    const readTime = 2000; // 읽는 시간 (2초)
    const scrollDistance = 600; // 한 번에 스크롤할 거리
    
    // 최대 20페이지까지 테스트
    const maxMeasureScroll = Math.min(maxScroll, 20000);
    console.log(`[Scroll] 전체: ${maxScroll}px, 측정 범위: ${maxMeasureScroll}px (약 20페이지)`);
    
    let currentScroll = 0;
    let chunkCount = 0;
    
    while (currentScroll < maxMeasureScroll) {
      chunkCount++;
      const beforeCalls = window.__realUserMetrics.sendWithPromiseCalls.length;
      const beforeLongTasks = window.__realUserMetrics.longTasks.length;
      const beforeNetworkRequests = window.__realUserMetrics.networkRequests.length;
      
      // 1. 천천히 스크롤
      const targetScroll = Math.min(currentScroll + scrollDistance, maxMeasureScroll);
      console.log(`[Scroll] Chunk ${chunkCount}: ${currentScroll.toFixed(0)}px → ${targetScroll.toFixed(0)}px`);
      
      while (currentScroll < targetScroll) {
        currentScroll += scrollChunkSize;
        if (currentScroll > targetScroll) currentScroll = targetScroll;
        scrollContainer.scrollTop = currentScroll;
        await new Promise(r => setTimeout(r, scrollSpeed));
      }
      
      const afterScrollCalls = window.__realUserMetrics.sendWithPromiseCalls.length;
      const afterScrollLongTasks = window.__realUserMetrics.longTasks.length;
      const afterScrollNetworkRequests = window.__realUserMetrics.networkRequests.length;
      
      console.log(`[Scroll] 스크롤 중: sendWithPromise +${afterScrollCalls - beforeCalls}회, LongTask +${afterScrollLongTasks - beforeLongTasks}개, Network +${afterScrollNetworkRequests - beforeNetworkRequests}개`);
      
      // 2. 멈춰서 읽기
      console.log(`[Scroll] 📖 읽는 중... (${readTime}ms 대기)`);
      await new Promise(r => setTimeout(r, readTime));
      
      const afterReadCalls = window.__realUserMetrics.sendWithPromiseCalls.length;
      const afterReadLongTasks = window.__realUserMetrics.longTasks.length;
      const afterReadNetworkRequests = window.__realUserMetrics.networkRequests.length;
      
      console.log(`[Scroll] Chunk ${chunkCount} 완료: 총 sendWithPromise +${afterReadCalls - beforeCalls}회, LongTask +${afterReadLongTasks - beforeLongTasks}개, Network +${afterReadNetworkRequests - beforeNetworkRequests}개`);
      
      // 3. 가끔 위로 스크롤 (실제 사용자처럼)
      if (chunkCount % 4 === 0 && currentScroll > 300) {
        console.log(`[Scroll] ⬆️  위로 조금 스크롤 (다시 보기)`);
        currentScroll -= 200;
        scrollContainer.scrollTop = currentScroll;
        await new Promise(r => setTimeout(r, 800));
      }
    }
    
    console.log(`[Scroll] 실사용자 패턴 완료: 총 ${chunkCount}개 청크`);
    
    scrollContainer.removeEventListener('scroll', scrollListener);

    const endTime = performance.now();
    const startTime = window.__realUserMetrics.startTime || 0;

    return {
      success: true,
      duration: endTime - startTime,
      pageLoadTime: pageLoadTime,
      sendWithPromiseCalls: window.__realUserMetrics.sendWithPromiseCalls,
      longTasks: window.__realUserMetrics.longTasks,
      scrollEvents: window.__realUserMetrics.scrollEvents,
      networkRequests: window.__realUserMetrics.networkRequests,
      fpsMeasurements: window.__realUserMetrics.fpsMeasurements,
      firstContentfulPaint: window.__realUserMetrics.firstContentfulPaint,
      largestContentfulPaint: window.__realUserMetrics.largestContentfulPaint,
    };
  }, loadTime);

  await browser.close();

  if (!result.success) {
    console.error(`   ❌ 테스트 실패: ${result.error || 'Unknown error'}`);
    return null;
  }

  // 결과 분석
  const fpsStats = result.fpsMeasurements.length > 0 ? {
    avg: Math.round(result.fpsMeasurements.reduce((sum, m) => sum + m.fps, 0) / result.fpsMeasurements.length),
    min: Math.min(...result.fpsMeasurements.map(m => m.fps)),
    max: Math.max(...result.fpsMeasurements.map(m => m.fps)),
    count: result.fpsMeasurements.length
  } : { avg: 0, min: 0, max: 0, count: 0 };

  const networkStats = result.networkRequests.length > 0 ? {
    totalRequests: result.networkRequests.length,
    avgDuration: result.networkRequests.reduce((sum, r) => sum + r.duration, 0) / result.networkRequests.length,
    maxDuration: Math.max(...result.networkRequests.map(r => r.duration)),
    errors: result.networkRequests.filter(r => r.status === 'error').length
  } : { totalRequests: 0, avgDuration: 0, maxDuration: 0, errors: 0 };
  
  console.log(`\n   ✅ 4배 CPU 스로틀링 실사용자 테스트 완료`);
  console.log(`      - 페이지 로드 시간: ${result.pageLoadTime}ms`);
  console.log(`      - First Contentful Paint: ${result.firstContentfulPaint ? result.firstContentfulPaint.toFixed(0) + 'ms' : 'N/A'}`);
  console.log(`      - Largest Contentful Paint: ${result.largestContentfulPaint ? result.largestContentfulPaint.toFixed(0) + 'ms' : 'N/A'}`);
  console.log(`      - 네트워크 요청: ${networkStats.totalRequests}개 (평균 ${networkStats.avgDuration.toFixed(0)}ms, 최대 ${networkStats.maxDuration.toFixed(0)}ms)`);
  console.log(`      - 네트워크 오류: ${networkStats.errors}개`);
  console.log(`      - sendWithPromise 호출: ${result.sendWithPromiseCalls.length}회`);
  console.log(`      - LongTask: ${result.longTasks.length}개`);
  console.log(`      - 스크롤 이벤트: ${result.scrollEvents.length}회`);
  console.log(`      - FPS: 평균 ${fpsStats.avg} (최소 ${fpsStats.min}, 최대 ${fpsStats.max})`);

  const testResult = {
    version: 'raf-windowing-4x-cpu-throttle',
    detectedVersion: versionInfo.versionText,
    url: testUrl,
    testType: 'real-user-pattern',
    throttling: {
      cpu: cpuThrottle,
      network: 'none'
    },
    pageLoadTime: result.pageLoadTime,
    firstContentfulPaint: result.firstContentfulPaint,
    largestContentfulPaint: result.largestContentfulPaint,
    duration: result.duration,
    sendWithPromiseCalls: result.sendWithPromiseCalls,
    longTasks: result.longTasks,
    scrollEvents: result.scrollEvents,
    networkRequests: result.networkRequests,
    fpsMeasurements: result.fpsMeasurements,
    fpsStats: fpsStats,
    networkStats: networkStats,
    timestamp: new Date().toISOString(),
  };

  // 결과 저장
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = path.join(outDir, `real-user-test-raf-windowing-4x-cpu-${timestamp}.json`);
  
  fs.writeFileSync(outputPath, JSON.stringify(testResult, null, 2));
  
  console.log(`\n   💾 결과 저장: ${outputPath}`);
  
  // LongTask 상세 분석
  if (result.longTasks.length > 0) {
    const totalBlockingTime = result.longTasks.reduce((sum, task) => sum + Math.max(0, task.duration - 50), 0);
    const avgDuration = result.longTasks.reduce((sum, task) => sum + task.duration, 0) / result.longTasks.length;
    const maxDuration = Math.max(...result.longTasks.map(task => task.duration));
    
    console.log(`\n   ⏱️  LongTask 분석 (4배 CPU 스로틀링 환경):`);
    console.log(`      - 총 LongTask: ${result.longTasks.length}개`);
    console.log(`      - 평균 지속시간: ${avgDuration.toFixed(2)}ms`);
    console.log(`      - 최대 지속시간: ${maxDuration.toFixed(2)}ms`);
    console.log(`      - Total Blocking Time: ${totalBlockingTime.toFixed(2)}ms`);
    
    if (result.longTasks.length <= 5) {
      console.log(`\n   LongTask 상세:`);
      result.longTasks.forEach((task, idx) => {
        console.log(`      ${idx + 1}. ${task.duration.toFixed(2)}ms @ ${(task.startTime / 1000).toFixed(3)}s`);
      });
    }
  } else {
    console.log(`\n   ✅ LongTask 없음 - 4배 CPU 스로틀링 환경에서도 부드럽게 작동!`);
  }

  console.log(`\n🎯 실사용자 경험 테스트 완료!`);
  console.log(`   raf-windowing 버전이 4배 CPU 스로틀링 환경에서 어떻게 동작하는지 확인했습니다.`);

  return testResult;
}

// 실행
(async () => {
  try {
    await testRealUserExperience();
  } catch (error) {
    console.error('❌ 테스트 실행 중 오류:', error);
    process.exit(1);
  }
})();
