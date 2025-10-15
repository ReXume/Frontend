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
    let viewportPageCompleteTime = null;  // 뷰포트 내 페이지 완료 시점
    
    // 현재 뷰포트에 보이는 페이지 계산 함수
    const getVisiblePages = () => {
      const scrollTop = scrollContainer.scrollTop;
      const viewportHeight = scrollContainer.clientHeight;
      const canvases = Array.from(document.querySelectorAll('canvas'));
      
      return canvases.filter(canvas => {
        const parent = canvas.parentElement;
        if (!parent) return false;
        const rect = parent.getBoundingClientRect();
        const containerRect = scrollContainer.getBoundingClientRect();
        const relativeTop = rect.top - containerRect.top + scrollTop;
        const relativeBottom = relativeTop + rect.height;
        
        return relativeTop < scrollTop + viewportHeight && relativeBottom > scrollTop;
      }).length;
    };
    
    // 초기 뷰포트 페이지 수 계산
    const initialViewportPages = getVisiblePages();
    
    // 10단계 스크롤
    for (let i = 0; i <= 10; i++) {
      const stepStart = performance.now();
      const longTasksBefore = window.__metrics.longTasks.length;
      const renderedBefore = window.__metrics.renderEvents.length;
      
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
      
      // 2초 대기 (읽기) - 느린 스크롤
      await new Promise(r => setTimeout(r, 2000));
      
      const stepEnd = performance.now();
      const longTasksAfter = window.__metrics.longTasks.length;
      const newLongTasks = longTasksAfter - longTasksBefore;
      const renderedAfter = window.__metrics.renderEvents.length;
      const visiblePages = getVisiblePages();
      
      // 초기 뷰포트 페이지가 모두 렌더링 완료된 시점 기록
      if (!viewportPageCompleteTime && i === 0 && renderedAfter >= initialViewportPages) {
        viewportPageCompleteTime = stepEnd - startTime;
      }
      
      events.push({
        step: i,
        renderedPages: renderedAfter,
        visiblePages: visiblePages,
        newlyRendered: renderedAfter - renderedBefore,
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
      viewportCompleteTime: viewportPageCompleteTime || totalTime,
      initialViewportPages: initialViewportPages,
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
// 빠른 스크롤 시나리오 (Queue 최적화 상황)
// ============================================================================

async function measureFastScroll(url, versionName, runNumber) {
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

  // 빠른 스크롤 시뮬레이션 (500ms만 대기)
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
    let viewportPageCompleteTime = null;
    
    // 현재 뷰포트에 보이는 페이지 계산 함수
    const getVisiblePages = () => {
      const scrollTop = scrollContainer.scrollTop;
      const viewportHeight = scrollContainer.clientHeight;
      const canvases = Array.from(document.querySelectorAll('canvas'));
      
      return canvases.filter(canvas => {
        const parent = canvas.parentElement;
        if (!parent) return false;
        const rect = parent.getBoundingClientRect();
        const containerRect = scrollContainer.getBoundingClientRect();
        const relativeTop = rect.top - containerRect.top + scrollTop;
        const relativeBottom = relativeTop + rect.height;
        
        return relativeTop < scrollTop + viewportHeight && relativeBottom > scrollTop;
      }).length;
    };
    
    const initialViewportPages = getVisiblePages();
    
    // 10단계 빠른 스크롤 (500ms 대기)
    for (let i = 0; i <= 10; i++) {
      const stepStart = performance.now();
      const longTasksBefore = window.__metrics.longTasks.length;
      const renderedBefore = window.__metrics.renderEvents.length;
      
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
      
      // 500ms만 대기 (빠른 스크롤)
      await new Promise(r => setTimeout(r, 500));
      
      const stepEnd = performance.now();
      const longTasksAfter = window.__metrics.longTasks.length;
      const newLongTasks = longTasksAfter - longTasksBefore;
      const renderedAfter = window.__metrics.renderEvents.length;
      const visiblePages = getVisiblePages();
      
      if (!viewportPageCompleteTime && i === 0 && renderedAfter >= initialViewportPages) {
        viewportPageCompleteTime = stepEnd - startTime;
      }
      
      events.push({
        step: i,
        renderedPages: renderedAfter,
        visiblePages: visiblePages,
        newlyRendered: renderedAfter - renderedBefore,
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
      viewportCompleteTime: viewportPageCompleteTime || totalTime,
      initialViewportPages: initialViewportPages,
      events
    };
  });

  if (!result || !result.success) {
    log(`   ❌ 측정 실패 (빠른 스크롤): result=${result ? 'exists but success=false' : 'null'}`, 2);
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
// 매우 빠른 스크롤 시나리오 (Queue 극한 최적화 상황)
// ============================================================================

async function measureVeryFastScroll(url, versionName, runNumber) {
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

  // 매우 빠른 스크롤 시뮬레이션 (200ms만 대기)
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
    let viewportPageCompleteTime = null;
    
    // 현재 뷰포트에 보이는 페이지 계산 함수
    const getVisiblePages = () => {
      const scrollTop = scrollContainer.scrollTop;
      const viewportHeight = scrollContainer.clientHeight;
      const canvases = Array.from(document.querySelectorAll('canvas'));
      
      return canvases.filter(canvas => {
        const parent = canvas.parentElement;
        if (!parent) return false;
        const rect = parent.getBoundingClientRect();
        const containerRect = scrollContainer.getBoundingClientRect();
        const relativeTop = rect.top - containerRect.top + scrollTop;
        const relativeBottom = relativeTop + rect.height;
        
        return relativeTop < scrollTop + viewportHeight && relativeBottom > scrollTop;
      }).length;
    };
    
    const initialViewportPages = getVisiblePages();
    
    // 10단계 매우 빠른 스크롤 (200ms 대기 - 극한 상황)
    for (let i = 0; i <= 10; i++) {
      const stepStart = performance.now();
      const longTasksBefore = window.__metrics.longTasks.length;
      const renderedBefore = window.__metrics.renderEvents.length;
      
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
      
      // 200ms만 대기 (매우 빠른 스크롤 - Queue 우선순위가 중요한 상황)
      await new Promise(r => setTimeout(r, 200));
      
      const stepEnd = performance.now();
      const longTasksAfter = window.__metrics.longTasks.length;
      const newLongTasks = longTasksAfter - longTasksBefore;
      const renderedAfter = window.__metrics.renderEvents.length;
      const visiblePages = getVisiblePages();
      
      if (!viewportPageCompleteTime && i === 0 && renderedAfter >= initialViewportPages) {
        viewportPageCompleteTime = stepEnd - startTime;
      }
      
      events.push({
        step: i,
        renderedPages: renderedAfter,
        visiblePages: visiblePages,
        newlyRendered: renderedAfter - renderedBefore,
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
      viewportCompleteTime: viewportPageCompleteTime || totalTime,
      initialViewportPages: initialViewportPages,
      events
    };
  });

  if (!result || !result.success) {
    log(`   ❌ 측정 실패 (매우 빠른 스크롤): result=${result ? 'exists but success=false' : 'null'}`, 2);
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
    fast: { pdf: [], queue: [] },
    veryFast: { pdf: [], queue: [] }
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
  // 시나리오 2: 빠른 스크롤 (Queue 최적화 상황)
  // ============================================================================
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 시나리오 2: 빠른 스크롤 (Queue 최적화 상황)');
  console.log('='.repeat(80));
  console.log('   10개 구간으로 나눠서 빠르게 스크롤, 각 500ms씩만 대기\n');

  for (const version of CONFIG.versions) {
    const url = `${CONFIG.baseUrl}?${version.query}`;
    log(`📊 테스트 중: ${version.name}`);
    
    for (let i = 1; i <= CONFIG.runs; i++) {
      try {
        const result = await measureFastScroll(url, version.name, i);
        if (result) {
          allResults.fast[version.key].push(result);
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
  // 시나리오 3: 매우 빠른 스크롤 (Queue 극한 최적화 상황)
  // ============================================================================
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 시나리오 3: 매우 빠른 스크롤 (Queue 극한 최적화 상황)');
  console.log('='.repeat(80));
  console.log('   10개 구간으로 매우 빠르게 스크롤, 각 200ms씩만 대기 (렌더링 경쟁 극대화)\n');

  for (const version of CONFIG.versions) {
    const url = `${CONFIG.baseUrl}?${version.query}`;
    log(`📊 테스트 중: ${version.name}`);
    
    for (let i = 1; i <= CONFIG.runs; i++) {
      try {
        const result = await measureVeryFastScroll(url, version.name, i);
        if (result) {
          allResults.veryFast[version.key].push(result);
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

  // 렌더링된 페이지가 10개 미만인 비정상 결과 제외 (점진적 스크롤은 30페이지 기대)
  const g_pdf = allResults.gradual.pdf.filter(r => r.renderedPages >= 10);
  const g_queue = allResults.gradual.queue.filter(r => r.renderedPages >= 10);
  
  const g_pdf_excluded = allResults.gradual.pdf.length - g_pdf.length;
  const g_queue_excluded = allResults.gradual.queue.length - g_queue.length;
  
  if (g_pdf_excluded > 0) {
    console.log(`⚠️  PDF: ${g_pdf_excluded}개의 비정상 결과 제외됨 (렌더링 페이지 < 10)`);
  }
  if (g_queue_excluded > 0) {
    console.log(`⚠️  Queue: ${g_queue_excluded}개의 비정상 결과 제외됨 (렌더링 페이지 < 10)`);
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

  // 5. 뷰포트 페이지 완료 시간 (핵심 메트릭!)
  const g_viewport_pdf = calculateStats(g_pdf.map(r => r.viewportCompleteTime).filter(Boolean));
  const g_viewport_queue = calculateStats(g_queue.map(r => r.viewportCompleteTime).filter(Boolean));
  let g_viewport_improve = 0;
  if (g_viewport_pdf && g_viewport_queue) {
    g_viewport_improve = ((g_viewport_pdf.avg - g_viewport_queue.avg) / g_viewport_pdf.avg * 100);
    console.log(
      '초기 뷰포트 페이지 완료 시간 ⭐'.padEnd(40) +
      formatMs(g_viewport_pdf.avg).padEnd(20) +
      formatMs(g_viewport_queue.avg).padEnd(20) +
      `${g_viewport_improve > 0 ? '✅' : '❌'} ${g_viewport_improve.toFixed(2)}%`
    );
  } else {
    console.log('초기 뷰포트 페이지 완료 시간 ⭐'.padEnd(40) + '데이터 부족');
  }

  // 6. 인터랙션 응답 시간
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
  console.log('\n\n⚡ 시나리오 2: 빠른 스크롤');
  console.log('-'.repeat(80));
  console.log('메트릭'.padEnd(40) + 'PDF'.padEnd(20) + 'Queue'.padEnd(20) + '개선율');
  console.log('-'.repeat(80));

  // 렌더링된 페이지가 10개 미만인 비정상 결과 제외 (빠른 스크롤도 25+ 페이지 기대)
  const f_pdf = allResults.fast.pdf.filter(r => r.renderedPages >= 10);
  const f_queue = allResults.fast.queue.filter(r => r.renderedPages >= 10);
  
  const f_pdf_excluded = allResults.fast.pdf.length - f_pdf.length;
  const f_queue_excluded = allResults.fast.queue.length - f_queue.length;
  
  if (f_pdf_excluded > 0) {
    console.log(`⚠️  PDF: ${f_pdf_excluded}개의 비정상 결과 제외됨 (렌더링 페이지 < 10)`);
  }
  if (f_queue_excluded > 0) {
    console.log(`⚠️  Queue: ${f_queue_excluded}개의 비정상 결과 제외됨 (렌더링 페이지 < 10)`);
  }
  if (f_pdf.length === 0 || f_queue.length === 0) {
    console.log('❌ 유효한 데이터가 없습니다. 통계를 계산할 수 없습니다.');
  }

  // 1. 렌더링 효율성
  const f_eff_pdf = calculateStats(f_pdf.map(r => r.efficiency));
  const f_eff_queue = calculateStats(f_queue.map(r => r.efficiency));
  let f_eff_improve = 0;
  if (f_eff_pdf && f_eff_queue) {
    f_eff_improve = ((f_eff_queue.avg - f_eff_pdf.avg) / f_eff_pdf.avg * 100);
    console.log(
      '렌더링 효율성 (pages/sec)'.padEnd(40) +
      `${f_eff_pdf.avg.toFixed(2)}`.padEnd(20) +
      `${f_eff_queue.avg.toFixed(2)}`.padEnd(20) +
      `${f_eff_improve > 0 ? '✅' : '❌'} ${f_eff_improve.toFixed(2)}%`
    );
  } else {
    console.log('렌더링 효율성 (pages/sec)'.padEnd(40) + '데이터 부족');
  }

  // 2. 렌더링된 페이지 수
  const f_pages_pdf = calculateStats(f_pdf.map(r => r.renderedPages));
  const f_pages_queue = calculateStats(f_queue.map(r => r.renderedPages));
  let f_pages_improve = 0;
  if (f_pages_pdf && f_pages_queue) {
    f_pages_improve = ((f_pages_queue.avg - f_pages_pdf.avg) / f_pages_pdf.avg * 100);
    console.log(
      '렌더링된 페이지 수'.padEnd(40) +
      `${f_pages_pdf.avg.toFixed(1)}개`.padEnd(20) +
      `${f_pages_queue.avg.toFixed(1)}개`.padEnd(20) +
      `${f_pages_improve > 0 ? '✅' : '❌'} ${f_pages_improve.toFixed(2)}%`
    );
  } else {
    console.log('렌더링된 페이지 수'.padEnd(40) + '데이터 부족');
  }

  // 3. 페이지당 평균 렌더링 시간
  const f_perPage_pdf = calculateStats(f_pdf.map(r => r.avgTimePerPage));
  const f_perPage_queue = calculateStats(f_queue.map(r => r.avgTimePerPage));
  if (f_perPage_pdf && f_perPage_queue) {
    const f_perPage_improve = ((f_perPage_pdf.avg - f_perPage_queue.avg) / f_perPage_pdf.avg * 100);
    console.log(
      '페이지당 평균 렌더링 시간'.padEnd(40) +
      formatMs(f_perPage_pdf.avg).padEnd(20) +
      formatMs(f_perPage_queue.avg).padEnd(20) +
      `${f_perPage_improve > 0 ? '✅' : '❌'} ${f_perPage_improve.toFixed(2)}%`
    );
  } else {
    console.log('페이지당 평균 렌더링 시간'.padEnd(40) + '데이터 부족');
  }

  // 4. 프레임 드롭
  const f_drops_pdf = calculateStats(f_pdf.map(r => r.frameDrops));
  const f_drops_queue = calculateStats(f_queue.map(r => r.frameDrops));
  let f_drops_improve = 0;
  if (f_drops_pdf && f_drops_queue) {
    f_drops_improve = ((f_drops_pdf.avg - f_drops_queue.avg) / f_drops_pdf.avg * 100);
    console.log(
      '프레임 드롭 (<30 FPS)'.padEnd(40) +
      `${f_drops_pdf.avg.toFixed(1)}개`.padEnd(20) +
      `${f_drops_queue.avg.toFixed(1)}개`.padEnd(20) +
      `${f_drops_improve > 0 ? '✅' : '❌'} ${f_drops_improve.toFixed(2)}%`
    );
  } else {
    console.log('프레임 드롭 (<30 FPS)'.padEnd(40) + '데이터 부족');
  }

  // 5. 뷰포트 페이지 완료 시간 (핵심 메트릭!)
  const f_viewport_pdf = calculateStats(f_pdf.map(r => r.viewportCompleteTime).filter(Boolean));
  const f_viewport_queue = calculateStats(f_queue.map(r => r.viewportCompleteTime).filter(Boolean));
  let f_viewport_improve = 0;
  if (f_viewport_pdf && f_viewport_queue) {
    f_viewport_improve = ((f_viewport_pdf.avg - f_viewport_queue.avg) / f_viewport_pdf.avg * 100);
    console.log(
      '초기 뷰포트 페이지 완료 시간 ⭐'.padEnd(40) +
      formatMs(f_viewport_pdf.avg).padEnd(20) +
      formatMs(f_viewport_queue.avg).padEnd(20) +
      `${f_viewport_improve > 0 ? '✅' : '❌'} ${f_viewport_improve.toFixed(2)}%`
    );
  } else {
    console.log('초기 뷰포트 페이지 완료 시간 ⭐'.padEnd(40) + '데이터 부족');
  }

  // 6. 인터랙션 응답 시간
  const f_interact_pdf = calculateStats(f_pdf.map(r => r.avgInteractionTime).filter(Boolean));
  const f_interact_queue = calculateStats(f_queue.map(r => r.avgInteractionTime).filter(Boolean));
  if (f_interact_pdf && f_interact_queue) {
    const f_interact_improve = ((f_interact_pdf.avg - f_interact_queue.avg) / f_interact_pdf.avg * 100);
    console.log(
      '인터랙션 응답 시간'.padEnd(40) +
      formatMs(f_interact_pdf.avg).padEnd(20) +
      formatMs(f_interact_queue.avg).padEnd(20) +
      `${f_interact_improve > 0 ? '✅' : '❌'} ${f_interact_improve.toFixed(2)}%`
    );
  }

  // 6. Long Tasks / TBT
  const f_longTasks_pdf = calculateStats(f_pdf.map(r => r.longTasks));
  const f_longTasks_queue = calculateStats(f_queue.map(r => r.longTasks));
  const f_tbt_pdf = calculateStats(f_pdf.map(r => r.totalBlockingTime));
  const f_tbt_queue = calculateStats(f_queue.map(r => r.totalBlockingTime));
  
  if (f_longTasks_pdf && f_longTasks_queue) {
    console.log(
      'Long Tasks 수'.padEnd(40) +
      `${f_longTasks_pdf.avg.toFixed(1)}개`.padEnd(20) +
      `${f_longTasks_queue.avg.toFixed(1)}개`.padEnd(20) +
      `${((f_longTasks_pdf.avg - f_longTasks_queue.avg) / f_longTasks_pdf.avg * 100).toFixed(2)}%`
    );
  } else {
    console.log('Long Tasks 수'.padEnd(40) + '데이터 부족');
  }

  if (f_tbt_pdf && f_tbt_queue) {
    console.log(
      'Total Blocking Time'.padEnd(40) +
      formatMs(f_tbt_pdf.avg).padEnd(20) +
      formatMs(f_tbt_queue.avg).padEnd(20) +
      `${((f_tbt_pdf.avg - f_tbt_queue.avg) / f_tbt_pdf.avg * 100).toFixed(2)}%`
    );
  } else {
    console.log('Total Blocking Time'.padEnd(40) + '데이터 부족');
  }

  // 7. 렌더링 순서
  console.log('\n   렌더링 순서 (처음 10개):');
  console.log(`   PDF:   [${f_pdf[0]?.renderSequence?.slice(0, 10).join(', ')}]`);
  console.log(`   Queue: [${f_queue[0]?.renderSequence?.slice(0, 10).join(', ')}]`);

  // 8. Long Tasks 발생 타이밍 (구간별)
  console.log('\n   📍 Long Tasks 발생 구간 (스크롤 단계별):');
  if (f_pdf[0]?.events) {
    const fPdfStepsWithLongTasks = f_pdf[0].events.filter(e => e.longTasksInStep > 0);
    console.log(`   PDF:   ${fPdfStepsWithLongTasks.map(e => `Step ${e.step}(${e.longTasksInStep}개)`).join(', ') || '없음'}`);
  }
  if (f_queue[0]?.events) {
    const fQueueStepsWithLongTasks = f_queue[0].events.filter(e => e.longTasksInStep > 0);
    console.log(`   Queue: ${fQueueStepsWithLongTasks.map(e => `Step ${e.step}(${e.longTasksInStep}개)`).join(', ') || '없음'}`);
  }

  // 9. Long Tasks 상세 정보
  console.log('\n   ⏱️  Long Tasks 상세 (duration > 50ms):');
  if (f_pdf[0]?.longTasksDetail && f_pdf[0].longTasksDetail.length > 0) {
    console.log(`   PDF:   ${f_pdf[0].longTasksDetail.map(t => `${t.duration}ms@${(parseFloat(t.startTime)/1000).toFixed(1)}s`).join(', ')}`);
  } else {
    console.log(`   PDF:   없음`);
  }
  if (f_queue[0]?.longTasksDetail && f_queue[0].longTasksDetail.length > 0) {
    console.log(`   Queue: ${f_queue[0].longTasksDetail.map(t => `${t.duration}ms@${(parseFloat(t.startTime)/1000).toFixed(1)}s`).join(', ')}`);
  } else {
    console.log(`   Queue: 없음`);
  }

  // 시나리오 3 분석
  console.log('\n\n⚡⚡ 시나리오 3: 매우 빠른 스크롤 (200ms)');
  console.log('-'.repeat(80));
  console.log('메트릭'.padEnd(40) + 'PDF'.padEnd(20) + 'Queue'.padEnd(20) + '개선율');
  console.log('-'.repeat(80));

  // 렌더링된 페이지가 10개 미만인 비정상 결과 제외 (매우 빠른 스크롤도 최소 10페이지 기대)
  const vf_pdf = allResults.veryFast.pdf.filter(r => r.renderedPages >= 10);
  const vf_queue = allResults.veryFast.queue.filter(r => r.renderedPages >= 10);
  
  const vf_pdf_excluded = allResults.veryFast.pdf.length - vf_pdf.length;
  const vf_queue_excluded = allResults.veryFast.queue.length - vf_queue.length;
  
  if (vf_pdf_excluded > 0) {
    console.log(`⚠️  PDF: ${vf_pdf_excluded}개의 비정상 결과 제외됨 (렌더링 페이지 < 10)`);
  }
  if (vf_queue_excluded > 0) {
    console.log(`⚠️  Queue: ${vf_queue_excluded}개의 비정상 결과 제외됨 (렌더링 페이지 < 10)`);
  }
  if (vf_pdf.length === 0 || vf_queue.length === 0) {
    console.log('❌ 유효한 데이터가 없습니다. 통계를 계산할 수 없습니다.');
  }

  // 1. 렌더링 효율성
  const vf_eff_pdf = calculateStats(vf_pdf.map(r => r.efficiency));
  const vf_eff_queue = calculateStats(vf_queue.map(r => r.efficiency));
  let vf_eff_improve = 0;
  if (vf_eff_pdf && vf_eff_queue) {
    vf_eff_improve = ((vf_eff_queue.avg - vf_eff_pdf.avg) / vf_eff_pdf.avg * 100);
    console.log(
      '렌더링 효율성 (pages/sec)'.padEnd(40) +
      `${vf_eff_pdf.avg.toFixed(2)}`.padEnd(20) +
      `${vf_eff_queue.avg.toFixed(2)}`.padEnd(20) +
      `${vf_eff_improve > 0 ? '✅' : '❌'} ${vf_eff_improve.toFixed(2)}%`
    );
  } else {
    console.log('렌더링 효율성 (pages/sec)'.padEnd(40) + '데이터 부족');
  }

  // 2. 렌더링된 페이지 수
  const vf_pages_pdf = calculateStats(vf_pdf.map(r => r.renderedPages));
  const vf_pages_queue = calculateStats(vf_queue.map(r => r.renderedPages));
  let vf_pages_improve = 0;
  if (vf_pages_pdf && vf_pages_queue) {
    vf_pages_improve = ((vf_pages_queue.avg - vf_pages_pdf.avg) / vf_pages_pdf.avg * 100);
    console.log(
      '렌더링된 페이지 수'.padEnd(40) +
      `${vf_pages_pdf.avg.toFixed(1)}개`.padEnd(20) +
      `${vf_pages_queue.avg.toFixed(1)}개`.padEnd(20) +
      `${vf_pages_improve > 0 ? '✅' : '❌'} ${vf_pages_improve.toFixed(2)}%`
    );
  } else {
    console.log('렌더링된 페이지 수'.padEnd(40) + '데이터 부족');
  }

  // 3. 페이지당 평균 렌더링 시간
  const vf_perPage_pdf = calculateStats(vf_pdf.map(r => r.avgTimePerPage));
  const vf_perPage_queue = calculateStats(vf_queue.map(r => r.avgTimePerPage));
  if (vf_perPage_pdf && vf_perPage_queue) {
    const vf_perPage_improve = ((vf_perPage_pdf.avg - vf_perPage_queue.avg) / vf_perPage_pdf.avg * 100);
    console.log(
      '페이지당 평균 렌더링 시간'.padEnd(40) +
      formatMs(vf_perPage_pdf.avg).padEnd(20) +
      formatMs(vf_perPage_queue.avg).padEnd(20) +
      `${vf_perPage_improve > 0 ? '✅' : '❌'} ${vf_perPage_improve.toFixed(2)}%`
    );
  } else {
    console.log('페이지당 평균 렌더링 시간'.padEnd(40) + '데이터 부족');
  }

  // 4. 프레임 드롭
  const vf_drops_pdf = calculateStats(vf_pdf.map(r => r.frameDrops));
  const vf_drops_queue = calculateStats(vf_queue.map(r => r.frameDrops));
  let vf_drops_improve = 0;
  if (vf_drops_pdf && vf_drops_queue) {
    vf_drops_improve = ((vf_drops_pdf.avg - vf_drops_queue.avg) / vf_drops_pdf.avg * 100);
    console.log(
      '프레임 드롭 (<30 FPS)'.padEnd(40) +
      `${vf_drops_pdf.avg.toFixed(1)}개`.padEnd(20) +
      `${vf_drops_queue.avg.toFixed(1)}개`.padEnd(20) +
      `${vf_drops_improve > 0 ? '✅' : '❌'} ${vf_drops_improve.toFixed(2)}%`
    );
  } else {
    console.log('프레임 드롭 (<30 FPS)'.padEnd(40) + '데이터 부족');
  }

  // 5. 뷰포트 페이지 완료 시간 (핵심 메트릭!)
  const vf_viewport_pdf = calculateStats(vf_pdf.map(r => r.viewportCompleteTime).filter(Boolean));
  const vf_viewport_queue = calculateStats(vf_queue.map(r => r.viewportCompleteTime).filter(Boolean));
  let vf_viewport_improve = 0;
  if (vf_viewport_pdf && vf_viewport_queue) {
    vf_viewport_improve = ((vf_viewport_pdf.avg - vf_viewport_queue.avg) / vf_viewport_pdf.avg * 100);
    console.log(
      '초기 뷰포트 페이지 완료 시간 ⭐'.padEnd(40) +
      formatMs(vf_viewport_pdf.avg).padEnd(20) +
      formatMs(vf_viewport_queue.avg).padEnd(20) +
      `${vf_viewport_improve > 0 ? '✅' : '❌'} ${vf_viewport_improve.toFixed(2)}%`
    );
  } else {
    console.log('초기 뷰포트 페이지 완료 시간 ⭐'.padEnd(40) + '데이터 부족');
  }

  // 6. 인터랙션 응답 시간
  const vf_interact_pdf = calculateStats(vf_pdf.map(r => r.avgInteractionTime).filter(Boolean));
  const vf_interact_queue = calculateStats(vf_queue.map(r => r.avgInteractionTime).filter(Boolean));
  if (vf_interact_pdf && vf_interact_queue) {
    const vf_interact_improve = ((vf_interact_pdf.avg - vf_interact_queue.avg) / vf_interact_pdf.avg * 100);
    console.log(
      '인터랙션 응답 시간'.padEnd(40) +
      formatMs(vf_interact_pdf.avg).padEnd(20) +
      formatMs(vf_interact_queue.avg).padEnd(20) +
      `${vf_interact_improve > 0 ? '✅' : '❌'} ${vf_interact_improve.toFixed(2)}%`
    );
  }

  // 6. Long Tasks / TBT
  const vf_longTasks_pdf = calculateStats(vf_pdf.map(r => r.longTasks));
  const vf_longTasks_queue = calculateStats(vf_queue.map(r => r.longTasks));
  const vf_tbt_pdf = calculateStats(vf_pdf.map(r => r.totalBlockingTime));
  const vf_tbt_queue = calculateStats(vf_queue.map(r => r.totalBlockingTime));
  
  if (vf_longTasks_pdf && vf_longTasks_queue) {
    console.log(
      'Long Tasks 수'.padEnd(40) +
      `${vf_longTasks_pdf.avg.toFixed(1)}개`.padEnd(20) +
      `${vf_longTasks_queue.avg.toFixed(1)}개`.padEnd(20) +
      `${((vf_longTasks_pdf.avg - vf_longTasks_queue.avg) / vf_longTasks_pdf.avg * 100).toFixed(2)}%`
    );
  } else {
    console.log('Long Tasks 수'.padEnd(40) + '데이터 부족');
  }

  if (vf_tbt_pdf && vf_tbt_queue) {
    console.log(
      'Total Blocking Time'.padEnd(40) +
      formatMs(vf_tbt_pdf.avg).padEnd(20) +
      formatMs(vf_tbt_queue.avg).padEnd(20) +
      `${((vf_tbt_pdf.avg - vf_tbt_queue.avg) / vf_tbt_pdf.avg * 100).toFixed(2)}%`
    );
  } else {
    console.log('Total Blocking Time'.padEnd(40) + '데이터 부족');
  }

  // 7. 렌더링 순서
  console.log('\n   렌더링 순서 (처음 10개):');
  console.log(`   PDF:   [${vf_pdf[0]?.renderSequence?.slice(0, 10).join(', ')}]`);
  console.log(`   Queue: [${vf_queue[0]?.renderSequence?.slice(0, 10).join(', ')}]`);

  // 8. Long Tasks 발생 타이밍 (구간별)
  console.log('\n   📍 Long Tasks 발생 구간 (스크롤 단계별):');
  if (vf_pdf[0]?.events) {
    const vfPdfStepsWithLongTasks = vf_pdf[0].events.filter(e => e.longTasksInStep > 0);
    console.log(`   PDF:   ${vfPdfStepsWithLongTasks.map(e => `Step ${e.step}(${e.longTasksInStep}개)`).join(', ') || '없음'}`);
  }
  if (vf_queue[0]?.events) {
    const vfQueueStepsWithLongTasks = vf_queue[0].events.filter(e => e.longTasksInStep > 0);
    console.log(`   Queue: ${vfQueueStepsWithLongTasks.map(e => `Step ${e.step}(${e.longTasksInStep}개)`).join(', ') || '없음'}`);
  }

  // 9. Long Tasks 상세 정보
  console.log('\n   ⏱️  Long Tasks 상세 (duration > 50ms):');
  if (vf_pdf[0]?.longTasksDetail && vf_pdf[0].longTasksDetail.length > 0) {
    console.log(`   PDF:   ${vf_pdf[0].longTasksDetail.map(t => `${t.duration}ms@${(parseFloat(t.startTime)/1000).toFixed(1)}s`).join(', ')}`);
  } else {
    console.log(`   PDF:   없음`);
  }
  if (vf_queue[0]?.longTasksDetail && vf_queue[0].longTasksDetail.length > 0) {
    console.log(`   Queue: ${vf_queue[0].longTasksDetail.map(t => `${t.duration}ms@${(parseFloat(t.startTime)/1000).toFixed(1)}s`).join(', ')}`);
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
    { name: '점진적 스크롤 - 뷰포트 완료 ⭐', value: g_viewport_improve, better: g_viewport_improve > 0 },
    { name: '점진적 스크롤 - 프레임 드롭 감소', value: g_drops_improve, better: g_drops_improve > 0 },
    { name: '빠른 스크롤 (500ms) - 효율성', value: f_eff_improve, better: f_eff_improve > 0 },
    { name: '빠른 스크롤 (500ms) - 페이지 수', value: f_pages_improve, better: f_pages_improve > 0 },
    { name: '빠른 스크롤 (500ms) - 뷰포트 완료 ⭐', value: f_viewport_improve, better: f_viewport_improve > 0 },
    { name: '빠른 스크롤 (500ms) - 프레임 드롭 감소', value: f_drops_improve, better: f_drops_improve > 0 },
    { name: '매우 빠른 스크롤 (200ms) - 효율성', value: vf_eff_improve, better: vf_eff_improve > 0 },
    { name: '매우 빠른 스크롤 (200ms) - 페이지 수', value: vf_pages_improve, better: vf_pages_improve > 0 },
    { name: '매우 빠른 스크롤 (200ms) - 뷰포트 완료 ⭐', value: vf_viewport_improve, better: vf_viewport_improve > 0 },
    { name: '매우 빠른 스크롤 (200ms) - 프레임 드롭 감소', value: vf_drops_improve, better: vf_drops_improve > 0 }
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
  if (g_viewport_pdf && g_viewport_queue) {
    console.log(`   ⭐ 점진적 스크롤 - 뷰포트 완료: ${g_viewport_improve > 0 ? '+' : ''}${g_viewport_improve.toFixed(2)}% (${formatMs(g_viewport_pdf.avg)} → ${formatMs(g_viewport_queue.avg)})`);
  }
  if (g_eff_pdf && g_eff_queue) {
    console.log(`   🎯 점진적 스크롤 - 렌더링 효율: ${g_eff_improve > 0 ? '+' : ''}${g_eff_improve.toFixed(2)}% (${g_eff_pdf.avg.toFixed(2)} → ${g_eff_queue.avg.toFixed(2)} pages/sec)`);
  }
  if (f_viewport_pdf && f_viewport_queue) {
    console.log(`   ⭐ 빠른 스크롤 (500ms) - 뷰포트 완료: ${f_viewport_improve > 0 ? '+' : ''}${f_viewport_improve.toFixed(2)}% (${formatMs(f_viewport_pdf.avg)} → ${formatMs(f_viewport_queue.avg)})`);
  }
  if (f_pages_pdf && f_pages_queue) {
    console.log(`   🎯 빠른 스크롤 (500ms) - 페이지 수: ${f_pages_improve > 0 ? '+' : ''}${f_pages_improve.toFixed(2)}% (${f_pages_pdf.avg.toFixed(1)} → ${f_pages_queue.avg.toFixed(1)}개)`);
  }
  if (vf_viewport_pdf && vf_viewport_queue) {
    console.log(`   ⭐ 매우 빠른 스크롤 (200ms) - 뷰포트 완료: ${vf_viewport_improve > 0 ? '+' : ''}${vf_viewport_improve.toFixed(2)}% (${formatMs(vf_viewport_pdf.avg)} → ${formatMs(vf_viewport_queue.avg)})`);
  }
  if (vf_pages_pdf && vf_pages_queue) {
    console.log(`   🎯 매우 빠른 스크롤 (200ms) - 페이지 수: ${vf_pages_improve > 0 ? '+' : ''}${vf_pages_improve.toFixed(2)}% (${vf_pages_pdf.avg.toFixed(1)} → ${vf_pages_queue.avg.toFixed(1)}개)`);
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
      fast: { pdf: f_pdf, queue: f_queue },
      veryFast: { pdf: vf_pdf, queue: vf_queue }
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
        fast: {
          pdf: f_pdf_excluded,
          queue: f_queue_excluded
        },
        veryFast: {
          pdf: vf_pdf_excluded,
          queue: vf_queue_excluded
        }
      }
    }
  }, null, 2));

  console.log(`\n📁 결과 저장: ${resultPath}`);
  console.log('\n✅ 고급 벤치마크 완료!\n');
})();
