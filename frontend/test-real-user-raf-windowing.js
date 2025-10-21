#!/usr/bin/env node
/**
 * 실사용자 테스트: raf-windowing 버전 4배 CPU 스로틀링
 * CSS 로딩 문제 해결 및 스크롤 컨테이너 개선된 버전
 */

const puppeteer = require('puppeteer');

async function testRealUserWithCSSFix() {
  console.log('\n🚀 실사용자 테스트: raf-windowing + 4배 CPU 스로틀링 (CSS 개선)');
  
  const browser = await puppeteer.launch({
    headless: false, // 시각적 확인
    defaultViewport: { width: 1920, height: 1080 },
    args: [
      '--disable-dev-shm-usage', 
      '--no-sandbox',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding'
    ],
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(180000);

  // CPU 4x 스로틀링
  const client = await page.target().createCDPSession();
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  console.log('✅ CPU 4x 스로틀링 적용');

  // CSS 로딩 완료 대기 설정
  await page.evaluateOnNewDocument(() => {
    window.__cssLoaded = false;
    window.__testMetrics = {
      longTasks: [],
      scrollEvents: [],
      startTime: null,
    };

    // LongTask 추적
    if (window.PerformanceObserver) {
      const ltObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__testMetrics.longTasks.push({
            startTime: entry.startTime,
            duration: entry.duration,
          });
          console.log(`[LongTask] ${entry.duration.toFixed(2)}ms`);
        }
      });
      ltObserver.observe({ type: 'longtask', buffered: true });
    }

    // CSS 로딩 완료 체크
    const checkCSSLoaded = () => {
      const allStylesheets = document.querySelectorAll('link[rel="stylesheet"]');
      const loadedCount = Array.from(allStylesheets).filter(link => 
        link.sheet && link.sheet.cssRules && link.sheet.cssRules.length > 0
      ).length;
      
      if (allStylesheets.length === 0 || loadedCount === allStylesheets.length) {
        window.__cssLoaded = true;
        console.log(`[CSS] 로딩 완료: ${loadedCount}/${allStylesheets.length}`);
        return true;
      }
      return false;
    };

    // DOM 로드 후 CSS 체크
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(checkCSSLoaded, 100);
      });
    } else {
      setTimeout(checkCSSLoaded, 100);
    }

    // 추가 체크를 위한 폴링
    const cssCheckInterval = setInterval(() => {
      if (checkCSSLoaded()) {
        clearInterval(cssCheckInterval);
      }
    }, 200);
  });

  // 콘솔 로그
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('[LongTask]') || text.includes('[CSS]') || text.includes('[Scroll]')) {
      console.log(`   ${text}`);
    }
  });

  console.log('   페이지 로딩 중...');
  await page.goto('http://localhost:3000/feedback/4?version=raf-windowing', {
    waitUntil: ['networkidle0', 'load'],
    timeout: 120000
  });

  // CSS 로딩 완료 대기
  console.log('   CSS 로딩 대기 중...');
  await page.waitForFunction(() => window.__cssLoaded === true, { timeout: 30000 });
  
  // 추가 렌더링 대기 (레이아웃 확정)
  await page.waitForTimeout(3000);
  console.log('   ✅ CSS 로딩 완료, 레이아웃 확정됨');

  // 스크롤 컨테이너 찾기 및 테스트
  const scrollResult = await page.evaluate(() => {
    window.__testMetrics.startTime = performance.now();

    // 다양한 방법으로 스크롤 컨테이너 찾기
    const findScrollContainer = () => {
      const candidates = [];
      
      // 방법 1: 명시적 overflowY 스타일
      Array.from(document.querySelectorAll('*')).forEach(el => {
        const style = window.getComputedStyle(el);
        if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && 
            el.scrollHeight > el.clientHeight + 10) {
          candidates.push({ el, method: 'overflowY', rect: el.getBoundingClientRect() });
        }
      });

      // 방법 2: 높이 기반 (90vh 등)
      Array.from(document.querySelectorAll('div')).forEach(el => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        
        if ((rect.height > 600 && rect.height < window.innerHeight * 0.95) ||
            style.height.includes('vh') || 
            el.className.includes('90vh') ||
            el.className.includes('flex-grow')) {
          if (el.scrollHeight > el.clientHeight + 10) {
            candidates.push({ el, method: 'height-based', rect });
          }
        }
      });

      // 방법 3: 가장 큰 스크롤 가능한 요소
      const scrollableByHeight = Array.from(document.querySelectorAll('*'))
        .filter(el => el.scrollHeight > el.clientHeight + 100)
        .sort((a, b) => b.scrollHeight - a.scrollHeight);

      if (scrollableByHeight.length > 0 && candidates.length === 0) {
        candidates.push({ 
          el: scrollableByHeight[0], 
          method: 'largest-scrollable', 
          rect: scrollableByHeight[0].getBoundingClientRect() 
        });
      }

      console.log(`[Scroll] 후보 컨테이너 ${candidates.length}개 발견:`);
      candidates.forEach((c, i) => {
        console.log(`  ${i}: ${c.method} - ${c.rect.width}x${c.rect.height}, scrollHeight: ${c.el.scrollHeight}`);
      });

      return candidates.length > 0 ? candidates[0].el : null;
    };

    const scrollContainer = findScrollContainer();
    
    if (!scrollContainer) {
      console.error('[Scroll] 스크롤 컨테이너를 찾을 수 없습니다');
      
      // 디버그 정보 출력
      console.log('[Scroll] 디버그 - 모든 div 요소:');
      Array.from(document.querySelectorAll('div')).forEach((div, idx) => {
        const rect = div.getBoundingClientRect();
        const style = window.getComputedStyle(div);
        if (rect.height > 100) { // 충분히 큰 요소만
          console.log(`  div[${idx}]: ${div.className} ${rect.width}x${rect.height}, overflowY: ${style.overflowY}, scrollHeight: ${div.scrollHeight}`);
        }
      });
      
      return { success: false, error: 'No scroll container found', debug: true };
    }

    const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
    console.log(`[Scroll] 컨테이너 발견! ${scrollContainer.scrollHeight}px 높이, 최대 스크롤: ${maxScroll}px`);

    // 스크롤 이벤트 리스너
    let scrollEventCount = 0;
    const scrollListener = () => {
      scrollEventCount++;
      window.__testMetrics.scrollEvents.push({
        timestamp: performance.now(),
        scrollTop: scrollContainer.scrollTop,
        eventNumber: scrollEventCount,
      });
    };
    scrollContainer.addEventListener('scroll', scrollListener, { passive: true });

    // 실사용자 패턴 스크롤
    const scrollChunkSize = 200;
    const scrollDelay = 100;
    const readDelay = 1500;
    const scrollDistance = 600;
    
    const maxTestScroll = Math.min(maxScroll, 12000);
    let currentScroll = 0;
    let chunkCount = 0;

    return new Promise(async (resolve) => {
      console.log('[Scroll] 🎯 실사용자 패턴 스크롤 시작...');
      
      while (currentScroll < maxTestScroll) {
        chunkCount++;
        
        // 스크롤
        const targetScroll = Math.min(currentScroll + scrollDistance, maxTestScroll);
        console.log(`[Scroll] Chunk ${chunkCount}: ${currentScroll}px → ${targetScroll}px`);
        
        while (currentScroll < targetScroll) {
          currentScroll += scrollChunkSize;
          if (currentScroll > targetScroll) currentScroll = targetScroll;
          scrollContainer.scrollTop = currentScroll;
          await new Promise(r => setTimeout(r, scrollDelay));
        }
        
        // 읽기 시간
        await new Promise(r => setTimeout(r, readDelay));
        
        // 가끔 위로 (실제 사용자처럼)
        if (chunkCount % 4 === 0 && currentScroll > 300) {
          console.log('[Scroll] ⬆️ 위로 조금 스크롤');
          currentScroll -= 200;
          scrollContainer.scrollTop = currentScroll;
          await new Promise(r => setTimeout(r, 800));
        }
      }

      scrollContainer.removeEventListener('scroll', scrollListener);
      
      const endTime = performance.now();
      resolve({
        success: true,
        duration: endTime - window.__testMetrics.startTime,
        scrollEvents: window.__testMetrics.scrollEvents,
        longTasks: window.__testMetrics.longTasks,
        maxScroll: maxScroll,
        actualScroll: currentScroll,
        chunks: chunkCount
      });
    });
  });

  await browser.close();

  if (!scrollResult.success) {
    console.error(`❌ 테스트 실패: ${scrollResult.error}`);
    if (scrollResult.debug) {
      console.log('   CSS가 제대로 로드되지 않았을 수 있습니다.');
    }
    return;
  }

  // 결과 출력
  const totalBlockingTime = scrollResult.longTasks.reduce((sum, task) => 
    sum + Math.max(0, task.duration - 50), 0
  );

  console.log('\n✅ 실사용자 테스트 완료 (4배 CPU 스로틀링)');
  console.log(`   - 테스트 시간: ${(scrollResult.duration / 1000).toFixed(1)}초`);
  console.log(`   - 스크롤 이벤트: ${scrollResult.scrollEvents.length}회`);
  console.log(`   - 스크롤 거리: ${scrollResult.actualScroll.toFixed(0)}px / ${scrollResult.maxScroll.toFixed(0)}px`);
  console.log(`   - 스크롤 청크: ${scrollResult.chunks}개`);
  console.log(`   - LongTask: ${scrollResult.longTasks.length}개`);
  console.log(`   - Total Blocking Time: ${totalBlockingTime.toFixed(2)}ms`);

  if (scrollResult.longTasks.length > 0) {
    const avgDuration = scrollResult.longTasks.reduce((sum, task) => sum + task.duration, 0) / scrollResult.longTasks.length;
    console.log(`   - LongTask 평균 지속시간: ${avgDuration.toFixed(2)}ms`);
  }
}

// 실행
(async () => {
  try {
    await testRealUserWithCSSFix();
  } catch (error) {
    console.error('❌ 테스트 오류:', error);
  }
})();
