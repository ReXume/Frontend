#!/usr/bin/env node
/**
 * PDF 렌더링 디버깅 스크립트
 * 
 * viewport, 페이지 높이, rootMargin 등의 정보를 수집해서
 * 왜 정확히 15개, 30개가 렌더링되는지 확인
 */

const puppeteer = require('puppeteer');

const CONFIG = {
  baseUrl: 'http://localhost:3000/feedback/4',
  versions: [
    { name: 'PDF (일반)', query: 'version=pdf', key: 'pdf' },
    { name: 'Queue (우선순위 큐)', query: 'version=queue', key: 'queue' }
  ]
};

async function debugVersion(url, versionName) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔍 ${versionName} 디버깅`);
  console.log('='.repeat(80));
  
  const browser = await puppeteer.launch({
    headless: false,  // 눈으로 확인
    args: ['--no-sandbox'],
    defaultViewport: { width: 1920, height: 1080 }
  });

  const page = await browser.newPage();
  
  // 메트릭 수집기
  await page.evaluateOnNewDocument(() => {
    window.__debugMetrics = {
      renderEvents: [],
      intersectionEvents: []
    };

    window.pdfRenderMetricsCollector = {
      metrics: [],
      add: function(metric) {
        this.metrics.push(metric);
        window.__debugMetrics.renderEvents.push({
          page: metric.page,
          time: performance.now()
        });
        console.log(`✅ 페이지 ${metric.page} 렌더링 완료`);
      }
    };

    // IntersectionObserver 추적
    const OriginalIO = window.IntersectionObserver;
    window.IntersectionObserver = function(callback, options) {
      console.log('📐 IntersectionObserver 생성:', {
        rootMargin: options?.rootMargin,
        threshold: options?.threshold
      });
      
      window.__debugMetrics.observerConfig = options;
      
      const wrappedCallback = (entries, observer) => {
        entries.forEach(entry => {
          window.__debugMetrics.intersectionEvents.push({
            isIntersecting: entry.isIntersecting,
            time: performance.now(),
            targetInfo: {
              className: entry.target.className,
              id: entry.target.id
            }
          });
        });
        callback(entries, observer);
      };
      
      return new OriginalIO(wrappedCallback, options);
    };
  });

  await page.goto(url, { waitUntil: 'networkidle0' });
  
  // 초기 대기
  await new Promise(r => setTimeout(r, 3000));
  
  // 초기 상태 수집
  const initialInfo = await page.evaluate(() => {
    const scrollContainer = Array.from(document.querySelectorAll('div'))
      .find(div => {
        const style = window.getComputedStyle(div);
        return style.overflowY === 'auto' && div.scrollHeight > div.clientHeight;
      });
    
    return {
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      scrollContainer: scrollContainer ? {
        scrollHeight: scrollContainer.scrollHeight,
        clientHeight: scrollContainer.clientHeight,
        scrollTop: scrollContainer.scrollTop,
        maxScroll: scrollContainer.scrollHeight - scrollContainer.clientHeight
      } : null,
      canvasCount: document.querySelectorAll('canvas').length,
      renderedPages: window.__debugMetrics?.renderEvents?.length || 0,
      observerConfig: window.__debugMetrics?.observerConfig
    };
  });

  console.log('\n📐 초기 상태:');
  console.log(`   Viewport: ${initialInfo.viewport.width}x${initialInfo.viewport.height}`);
  if (initialInfo.scrollContainer) {
    console.log(`   스크롤 컨테이너: ${initialInfo.scrollContainer.clientHeight}px (높이)`);
    console.log(`   전체 콘텐츠: ${initialInfo.scrollContainer.scrollHeight}px`);
    console.log(`   최대 스크롤: ${initialInfo.scrollContainer.maxScroll}px`);
  }
  console.log(`   Canvas 개수: ${initialInfo.canvasCount}개`);
  console.log(`   렌더링된 페이지: ${initialInfo.renderedPages}개`);
  console.log(`   IntersectionObserver 설정:`, initialInfo.observerConfig);

  // 10단계 스크롤하면서 렌더링 추적
  console.log('\n📜 스크롤하면서 렌더링 추적:');
  
  for (let step = 0; step <= 10; step++) {
    const stepInfo = await page.evaluate((s) => {
      const scrollContainer = Array.from(document.querySelectorAll('div'))
        .find(div => {
          const style = window.getComputedStyle(div);
          return style.overflowY === 'auto' && div.scrollHeight > div.clientHeight;
        });
      
      if (!scrollContainer) return null;
      
      const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
      const targetScroll = (maxScroll / 10) * s;
      
      scrollContainer.scrollTop = targetScroll;
      
      // 잠깐 대기
      return new Promise(resolve => {
        setTimeout(() => {
          const renderedPages = window.__debugMetrics?.renderEvents?.length || 0;
          const canvasCount = document.querySelectorAll('canvas').length;
          
          // 현재 viewport에 보이는 페이지 계산
          const canvases = Array.from(document.querySelectorAll('canvas'));
          const visibleCanvases = canvases.filter(canvas => {
            const rect = canvas.getBoundingClientRect();
            return rect.top < window.innerHeight && rect.bottom > 0;
          });
          
          resolve({
            step: s,
            scrollTop: scrollContainer.scrollTop,
            renderedPages,
            canvasCount,
            visibleCanvases: visibleCanvases.length,
            renderSequence: window.__debugMetrics?.renderEvents?.map(e => e.page) || []
          });
        }, 2000);
      });
    }, step);
    
    if (stepInfo) {
      console.log(`   Step ${step}: scrollTop=${stepInfo.scrollTop.toFixed(0)}px, 렌더링=${stepInfo.renderedPages}개, viewport 내=${stepInfo.visibleCanvases}개`);
    }
  }

  // 최종 정보
  const finalInfo = await page.evaluate(() => {
    return {
      totalRendered: window.__debugMetrics?.renderEvents?.length || 0,
      renderSequence: window.__debugMetrics?.renderEvents?.map(e => e.page) || [],
      totalCanvas: document.querySelectorAll('canvas').length,
      intersectionEvents: window.__debugMetrics?.intersectionEvents?.length || 0
    };
  });

  console.log('\n📊 최종 결과:');
  console.log(`   총 렌더링: ${finalInfo.totalRendered}개`);
  console.log(`   렌더링 순서: [${finalInfo.renderSequence.slice(0, 20).join(', ')}...]`);
  console.log(`   IntersectionObserver 이벤트: ${finalInfo.intersectionEvents}회`);

  await new Promise(r => setTimeout(r, 5000));  // 5초간 유지
  await browser.close();

  return finalInfo;
}

(async () => {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 PDF 렌더링 디버깅 스크립트');
  console.log('='.repeat(80));
  console.log('\n목적: 왜 정확히 15개, 30개가 렌더링되는지 확인\n');

  for (const version of CONFIG.versions) {
    const url = `${CONFIG.baseUrl}?${version.query}`;
    await debugVersion(url, version.name);
  }

  console.log('\n✅ 디버깅 완료!\n');
})();

