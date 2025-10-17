#!/usr/bin/env node
/**
 * LongTask 추적용 벤치마크
 * PDF.js sendWithPromise 호출과 LongTask 추적 벤치마크
 * 
 * 목적:
 * - 스크롤 이벤트 시 PDF.js의 sendWithPromise 호출 시점 측정
 * - LongTask 발생 시점과 상관관계 분석
 * - 타임라인으로 이벤트 시각화
 * 
 * 사용:
 *   node bench/bench-pdfjs-longtasks.js --url "http://localhost:3000/feedback/4?version=pdf"
 *   node bench/bench-pdfjs-longtasks.js --url "http://localhost:3000/feedback/4?version=queue"
 *   
 * 비교:
 *   node bench/bench-pdfjs-longtasks.js \
 *     --url1 "http://localhost:3000/feedback/4?version=pdf" --name1 "PDF" \
 *     --url2 "http://localhost:3000/feedback/4?version=queue" --name2 "Queue"
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// ---- 인자 파싱 ----
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
const stepDelay = parseInt(arg('delay', '500'), 10); // ms per scroll step
const realisticPattern = String(arg('realistic', 'false')) === 'true'; // 현실적 사용자 패턴
const outputFile = arg('output', null); // 출력 파일 지정

const benchDir = __dirname;
const outDir = path.join(benchDir, 'results');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

/**
 * PDF.js sendWithPromise와 LongTask 추적
 */
async function measurePDFJsWithLongTasks(testUrl, versionName) {
  console.log(`\n📊 측정 시작: ${versionName}`);
  console.log(`   URL: ${testUrl}`);
  
  const browser = await puppeteer.launch({
    headless: headless ? 'new' : false,
    defaultViewport: { width: 1920, height: 1080 },
    args: ['--disable-dev-shm-usage', '--no-sandbox'],
    protocolTimeout: 120000, // 2분
  });

  const page = await browser.newPage();
  
  // 타임아웃 설정 (2분)
  page.setDefaultTimeout(120000);

  // CPU throttling
  if (cpuThrottle > 1) {
    const client = await page.target().createCDPSession();
    await client.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottle });
    console.log(`   CPU ${cpuThrottle}x throttling 적용`);
  }

  // 콘솔 로그 포워딩
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('[PDFTrace]') || text.includes('[LongTask]')) {
      console.log(`   ${text}`);
    }
  });

  // 페이지 로드 전 추적 설정
  await page.evaluateOnNewDocument(() => {
    window.__pdfJsMetrics = {
      sendWithPromiseCalls: [],
      longTasks: [],
      scrollEvents: [],
      renderEvents: [],
      startTime: null,
    };

    // LongTask Observer
    if (window.PerformanceObserver) {
      try {
        const ltObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const timestamp = performance.now();
            window.__pdfJsMetrics.longTasks.push({
              startTime: entry.startTime,
              duration: entry.duration,
              timestamp: timestamp,
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
        window.__pdfJsMetrics.renderEvents.push({
          ...metric,
          timestamp: timestamp,
        });
      }
    };

    // PDF.js MessageHandler monkey patch
    // PDF.js가 로드된 후 실행되어야 함
    const patchPDFJS = () => {
      try {
        // PDF.js의 내부 구조에 접근
        // pdfjsLib가 전역에 노출되어 있다고 가정
        if (typeof window.pdfjsLib === 'undefined') {
          // 아직 로드 안됨
          setTimeout(patchPDFJS, 100);
          return;
        }

        console.log('[PDFTrace] PDF.js 발견, MessageHandler 패치 시도...');

        // MessageHandler를 찾기 위해 내부 구조 탐색
        // 실제로는 복잡하므로 다른 방법 사용
        
        // 대신 fetch API를 intercept해서 worker 통신 추적
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
          const timestamp = performance.now();
          const url = args[0]?.toString() || '';
          
          if (url.includes('pdf') || url.includes('worker')) {
            window.__pdfJsMetrics.sendWithPromiseCalls.push({
              type: 'fetch',
              url: url,
              timestamp: timestamp,
              stackTrace: new Error().stack?.split('\n').slice(2, 5).join(' | ') || '',
            });
            console.log(`[PDFTrace] fetch @ ${timestamp.toFixed(2)}ms: ${url.substring(0, 50)}...`);
          }
          
          return originalFetch.apply(this, args);
        };

        // Worker postMessage intercept (더 정확한 방법)
        const OriginalWorker = window.Worker;
        window.Worker = function(scriptURL, options) {
          const worker = new OriginalWorker(scriptURL, options);
          const originalPostMessage = worker.postMessage.bind(worker);
          
          worker.postMessage = function(message, ...rest) {
            const timestamp = performance.now();
            window.__pdfJsMetrics.sendWithPromiseCalls.push({
              type: 'worker_postMessage',
              message: typeof message === 'object' ? JSON.stringify(message).substring(0, 100) : String(message).substring(0, 100),
              timestamp: timestamp,
              stackTrace: new Error().stack?.split('\n').slice(2, 5).join(' | ') || '',
            });
            console.log(`[PDFTrace] worker.postMessage @ ${timestamp.toFixed(2)}ms`);
            return originalPostMessage(message, ...rest);
          };
          
          return worker;
        };
        
        console.log('[PDFTrace] Worker.postMessage 패치 완료');

      } catch (e) {
        console.error('[PDFTrace] 패치 실패:', e);
      }
    };

    // 페이지 로드 후 패치 시도
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', patchPDFJS);
    } else {
      patchPDFJS();
    }
  });

  console.log('   페이지 이동 중...');
  await page.goto(testUrl, { 
    waitUntil: ['networkidle2', 'domcontentloaded'], 
    timeout: 120000  // 2분
  });

  console.log('   페이지 로드 완료, 초기화 대기...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 버전 확인 및 렌더 메트릭 수집기 확인
  const versionInfo = await page.evaluate(() => {
    // 현재 버전 표시 엘리먼트 확인
    const versionDiv = document.querySelector('.bg-blue-100');
    const versionText = versionDiv?.textContent || 'Unknown';
    
    // 메트릭 수집기 존재 여부
    const hasCollector = typeof window.pdfRenderMetricsCollector !== 'undefined';
    
    return {
      versionText: versionText.trim(),
      hasCollector: hasCollector,
      url: window.location.href,
    };
  });
  
  console.log('   버전 정보:', versionInfo.versionText);
  console.log('   메트릭 수집기 존재:', versionInfo.hasCollector ? '✅' : '❌');
  console.log('   현재 URL:', versionInfo.url);

  // 측정 시작 시간 설정
  await page.evaluate(() => {
    window.__pdfJsMetrics.startTime = performance.now();
  });

  console.log('   스크롤 시뮬레이션 시작...');
  if (realisticPattern) {
    console.log('   🎯 현실적 사용자 패턴 모드 (스크롤 → 읽기 → 반복)');
  }

  // 스크롤 시뮬레이션 (타임아웃: 5분)
  const result = await page.evaluate(async (scrollSteps, stepDelay, realisticPattern) => {
    const scrollContainer = Array.from(document.querySelectorAll('div'))
      .find(div => {
        const style = window.getComputedStyle(div);
        return style.overflowY === 'auto' && div.scrollHeight > div.clientHeight;
      });
    
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
      window.__pdfJsMetrics.scrollEvents.push({
        timestamp: timestamp,
        scrollTop: scrollContainer.scrollTop,
        eventNumber: scrollEventCount,
      });
    };
    scrollContainer.addEventListener('scroll', scrollListener, { passive: true });

    if (realisticPattern) {
      // 현실적 사용자 패턴: 스크롤 쭉 내리고 → 읽기 → 반복
      console.log('[Scroll] 🎯 현실적 패턴 시작: 스크롤 → 읽기 → 반복');
      
      const scrollChunkSize = 300; // 한 번에 스크롤할 픽셀 수
      const scrollSpeed = 50; // 스크롤 속도 (ms 간격)
      const readTime = 1500; // 읽는 시간 (1.5초) - 타임아웃 방지
      const readDistance = 800; // 읽기 위해 스크롤하는 거리
      
      // 최대 스크롤 제한 - 약 15페이지까지 측정
      const maxMeasureScroll = Math.min(maxScroll, 15000); // 15000px ≈ 약 15페이지
      console.log(`[Scroll] 전체: ${maxScroll}px, 측정 범위: ${maxMeasureScroll}px (약 15페이지)`);
      
      let currentScroll = 0;
      let chunkCount = 0;
      
      while (currentScroll < maxMeasureScroll) {
        chunkCount++;
        const beforeCalls = window.__pdfJsMetrics.sendWithPromiseCalls.length;
        const beforeLongTasks = window.__pdfJsMetrics.longTasks.length;
        const beforeRenders = window.__pdfJsMetrics.renderEvents.length;
        
        // 1. 스크롤을 쭉 내림 (빠르게)
        const targetScroll = Math.min(currentScroll + readDistance, maxMeasureScroll);
        console.log(`[Scroll] Chunk ${chunkCount}: ${currentScroll.toFixed(0)}px → ${targetScroll.toFixed(0)}px (빠르게 스크롤)`);
        
        while (currentScroll < targetScroll) {
          currentScroll += scrollChunkSize;
          if (currentScroll > targetScroll) currentScroll = targetScroll;
          scrollContainer.scrollTop = currentScroll;
          await new Promise(r => setTimeout(r, scrollSpeed));
        }
        
        const afterScrollCalls = window.__pdfJsMetrics.sendWithPromiseCalls.length;
        const afterScrollLongTasks = window.__pdfJsMetrics.longTasks.length;
        const afterScrollRenders = window.__pdfJsMetrics.renderEvents.length;
        
        console.log(`[Scroll] 스크롤 중: sendWithPromise +${afterScrollCalls - beforeCalls}회, LongTask +${afterScrollLongTasks - beforeLongTasks}개, Render +${afterScrollRenders - beforeRenders}개`);
        
        // 2. 멈춰서 읽기 (느리게)
        console.log(`[Scroll] 📖 읽는 중... (${readTime}ms 대기)`);
        await new Promise(r => setTimeout(r, readTime));
        
        const afterReadCalls = window.__pdfJsMetrics.sendWithPromiseCalls.length;
        const afterReadLongTasks = window.__pdfJsMetrics.longTasks.length;
        const afterReadRenders = window.__pdfJsMetrics.renderEvents.length;
        
        console.log(`[Scroll] Chunk ${chunkCount} 완료: 총 sendWithPromise +${afterReadCalls - beforeCalls}회, LongTask +${afterReadLongTasks - beforeLongTasks}개, Render +${afterReadRenders - beforeRenders}개`);
        
        // 3. 아주 가끔 위로 조금 스크롤 (실제 사용자처럼)
        if (chunkCount % 3 === 0 && currentScroll > 200) {
          console.log(`[Scroll] ⬆️  위로 조금 스크롤 (다시 보기)`);
          currentScroll -= 150;
          scrollContainer.scrollTop = currentScroll;
          await new Promise(r => setTimeout(r, 500));
        }
      }
      
      console.log(`[Scroll] 현실적 패턴 완료: 총 ${chunkCount}개 청크`);
    } else {
      // 기존 단계별 스크롤
      for (let i = 0; i <= scrollSteps; i++) {
        const beforeCalls = window.__pdfJsMetrics.sendWithPromiseCalls.length;
        const beforeLongTasks = window.__pdfJsMetrics.longTasks.length;
        const beforeRenders = window.__pdfJsMetrics.renderEvents.length;
        
        const scrollPosition = (maxScroll / scrollSteps) * i;
        scrollContainer.scrollTop = scrollPosition;
        
        console.log(`[Scroll] Step ${i}/${scrollSteps}: ${scrollPosition.toFixed(0)}px`);
        
        // 대기
        await new Promise(r => setTimeout(r, stepDelay));
        
        const afterCalls = window.__pdfJsMetrics.sendWithPromiseCalls.length;
        const afterLongTasks = window.__pdfJsMetrics.longTasks.length;
        const afterRenders = window.__pdfJsMetrics.renderEvents.length;
        
        const newCalls = afterCalls - beforeCalls;
        const newLongTasks = afterLongTasks - beforeLongTasks;
        const newRenders = afterRenders - beforeRenders;
        
        console.log(`[Scroll] Step ${i} 결과: sendWithPromise ${newCalls}회, LongTask ${newLongTasks}개, Render ${newRenders}개`);
      }
    }

    scrollContainer.removeEventListener('scroll', scrollListener);

    const endTime = performance.now();
    const startTime = window.__pdfJsMetrics.startTime || 0;

    return {
      success: true,
      duration: endTime - startTime,
      sendWithPromiseCalls: window.__pdfJsMetrics.sendWithPromiseCalls,
      longTasks: window.__pdfJsMetrics.longTasks,
      scrollEvents: window.__pdfJsMetrics.scrollEvents,
      renderEvents: window.__pdfJsMetrics.renderEvents,
    };
  }, scrollSteps, stepDelay, realisticPattern);

  await browser.close();

  if (!result.success) {
    console.error(`   ❌ 측정 실패: ${result.error || 'Unknown error'}`);
    return null;
  }

  // 렌더링 효율 계산
  const renderEfficiency = result.renderEvents.length > 0 
    ? (result.renderEvents.length / (result.duration / 1000)).toFixed(2)
    : 0;
  
  console.log(`   ✅ 측정 완료`);
  console.log(`      - 감지된 버전: ${versionInfo.versionText}`);
  console.log(`      - sendWithPromise 호출: ${result.sendWithPromiseCalls.length}회`);
  console.log(`      - LongTask: ${result.longTasks.length}개`);
  console.log(`      - 스크롤 이벤트: ${result.scrollEvents.length}회`);
  console.log(`      - 렌더 이벤트: ${result.renderEvents.length}개`);
  console.log(`      - 렌더링 효율: ${renderEfficiency} pages/sec`);

  // 렌더 이벤트가 부족한 경우 경고
  if (result.renderEvents.length === 0) {
    console.warn(`   ⚠️  렌더 이벤트가 0개입니다! pdfRenderMetricsCollector가 제대로 작동하지 않을 수 있습니다.`);
  } else if (result.renderEvents.length < 5) {
    console.warn(`   ⚠️  렌더 이벤트가 ${result.renderEvents.length}개로 적습니다. 결과가 부정확할 수 있습니다.`);
  }

  return {
    version: versionName,
    detectedVersion: versionInfo.versionText,
    url: testUrl,
    hasCollector: versionInfo.hasCollector,
    duration: result.duration,
    sendWithPromiseCalls: result.sendWithPromiseCalls,
    longTasks: result.longTasks,
    scrollEvents: result.scrollEvents,
    renderEvents: result.renderEvents,
    renderEfficiency: parseFloat(renderEfficiency),
    timestamp: new Date().toISOString(),
  };
}

/**
 * 타임라인 분석 및 출력
 */
function analyzeTimeline(data) {
  console.log(`\n📊 타임라인 분석: ${data.version}`);
  console.log('='.repeat(80));

  // 모든 이벤트를 시간순으로 정렬
  const events = [];

  data.sendWithPromiseCalls.forEach(call => {
    events.push({
      type: 'sendWithPromise',
      timestamp: call.timestamp,
      details: call,
    });
  });

  data.longTasks.forEach(task => {
    events.push({
      type: 'longTask',
      timestamp: task.startTime,
      duration: task.duration,
      details: task,
    });
  });

  data.scrollEvents.forEach(scroll => {
    events.push({
      type: 'scroll',
      timestamp: scroll.timestamp,
      details: scroll,
    });
  });

  data.renderEvents.forEach(render => {
    events.push({
      type: 'render',
      timestamp: render.timestamp,
      details: render,
    });
  });

  events.sort((a, b) => a.timestamp - b.timestamp);

  // 타임라인 출력 (처음 50개만)
  console.log('\n⏱️  이벤트 타임라인 (처음 50개):');
  console.log('-'.repeat(80));
  console.log('Time(s)'.padEnd(10) + 'Type'.padEnd(20) + 'Details');
  console.log('-'.repeat(80));

  events.slice(0, 50).forEach(event => {
    const timeStr = (event.timestamp / 1000).toFixed(3) + 's';
    let detailStr = '';

    switch (event.type) {
      case 'sendWithPromise':
        detailStr = `${event.details.type}: ${event.details.message || event.details.url || ''}`.substring(0, 50);
        break;
      case 'longTask':
        detailStr = `duration: ${event.duration.toFixed(2)}ms`;
        break;
      case 'scroll':
        detailStr = `scrollTop: ${event.details.scrollTop.toFixed(0)}px`;
        break;
      case 'render':
        detailStr = `page ${event.details.page}: ${event.details.totalMs.toFixed(1)}ms`;
        break;
    }

    console.log(
      timeStr.padEnd(10) +
      event.type.padEnd(20) +
      detailStr
    );
  });

  // 상관관계 분석
  console.log('\n📈 상관관계 분석:');
  console.log('-'.repeat(80));

  // LongTask 발생 후 1초 이내에 발생한 sendWithPromise 호출 수
  let longTasksFollowedBySendWithPromise = 0;
  data.longTasks.forEach(task => {
    const taskEnd = task.startTime + task.duration;
    const callsAfter = data.sendWithPromiseCalls.filter(call => 
      call.timestamp >= taskEnd && call.timestamp <= taskEnd + 1000
    );
    if (callsAfter.length > 0) {
      longTasksFollowedBySendWithPromise++;
    }
  });

  // sendWithPromise 호출 후 1초 이내에 발생한 LongTask 수
  let sendWithPromiseFollowedByLongTask = 0;
  data.sendWithPromiseCalls.forEach(call => {
    const tasksAfter = data.longTasks.filter(task =>
      task.startTime >= call.timestamp && task.startTime <= call.timestamp + 1000
    );
    if (tasksAfter.length > 0) {
      sendWithPromiseFollowedByLongTask++;
    }
  });

  // 스크롤 이벤트 후 100ms 이내에 발생한 sendWithPromise 호출 수
  let scrollsFollowedBySendWithPromise = 0;
  data.scrollEvents.forEach(scroll => {
    const callsAfter = data.sendWithPromiseCalls.filter(call =>
      call.timestamp >= scroll.timestamp && call.timestamp <= scroll.timestamp + 100
    );
    if (callsAfter.length > 0) {
      scrollsFollowedBySendWithPromise++;
    }
  });

  // 스크롤 이벤트 후 500ms 이내에 발생한 LongTask 수
  let scrollsFollowedByLongTask = 0;
  data.scrollEvents.forEach(scroll => {
    const tasksAfter = data.longTasks.filter(task =>
      task.startTime >= scroll.timestamp && task.startTime <= scroll.timestamp + 500
    );
    if (tasksAfter.length > 0) {
      scrollsFollowedByLongTask++;
    }
  });

  console.log(`LongTask → sendWithPromise (1초 이내): ${longTasksFollowedBySendWithPromise}/${data.longTasks.length} (${(longTasksFollowedBySendWithPromise/data.longTasks.length*100).toFixed(1)}%)`);
  console.log(`sendWithPromise → LongTask (1초 이내): ${sendWithPromiseFollowedByLongTask}/${data.sendWithPromiseCalls.length} (${(sendWithPromiseFollowedByLongTask/data.sendWithPromiseCalls.length*100).toFixed(1)}%)`);
  console.log(`Scroll → sendWithPromise (100ms 이내): ${scrollsFollowedBySendWithPromise}/${data.scrollEvents.length} (${(scrollsFollowedBySendWithPromise/data.scrollEvents.length*100).toFixed(1)}%)`);
  console.log(`Scroll → LongTask (500ms 이내): ${scrollsFollowedByLongTask}/${data.scrollEvents.length} (${(scrollsFollowedByLongTask/data.scrollEvents.length*100).toFixed(1)}%)`);

  // LongTask 상세 정보
  console.log('\n⏱️  LongTask 상세 (duration > 50ms):');
  console.log('-'.repeat(80));
  if (data.longTasks.length > 0) {
    const totalBlockingTime = data.longTasks.reduce((sum, task) => sum + Math.max(0, task.duration - 50), 0);
    const avgDuration = data.longTasks.reduce((sum, task) => sum + task.duration, 0) / data.longTasks.length;
    const maxDuration = Math.max(...data.longTasks.map(task => task.duration));
    
    console.log(`Total: ${data.longTasks.length}개`);
    console.log(`Avg Duration: ${avgDuration.toFixed(2)}ms`);
    console.log(`Max Duration: ${maxDuration.toFixed(2)}ms`);
    console.log(`Total Blocking Time: ${totalBlockingTime.toFixed(2)}ms`);
    
    console.log('\nTop 10 longest tasks:');
    const sortedTasks = [...data.longTasks].sort((a, b) => b.duration - a.duration);
    sortedTasks.slice(0, 10).forEach((task, idx) => {
      console.log(`  ${idx + 1}. ${task.duration.toFixed(2)}ms @ ${(task.startTime / 1000).toFixed(3)}s`);
    });
  } else {
    console.log('LongTask 없음 ✅');
  }
}

/**
 * 비교 분석
 */
function compareVersions(data1, data2) {
  console.log('\n\n' + '='.repeat(80));
  console.log('🔍 버전 비교');
  console.log('='.repeat(80));
  
  console.log('\n메트릭'.padEnd(40) + data1.version.padEnd(20) + data2.version.padEnd(20) + '차이');
  console.log('-'.repeat(80));
  
  const metrics = [
    {
      name: '렌더링 효율',
      val1: data1.renderEfficiency || 0,
      val2: data2.renderEfficiency || 0,
      unit: ' pages/sec',
      lessIsBetter: false,
    },
    {
      name: '렌더 이벤트 수',
      val1: data1.renderEvents.length,
      val2: data2.renderEvents.length,
      unit: '개',
      lessIsBetter: false,
    },
    {
      name: 'sendWithPromise 호출 수',
      val1: data1.sendWithPromiseCalls.length,
      val2: data2.sendWithPromiseCalls.length,
      unit: '회',
      lessIsBetter: true,
    },
    {
      name: 'LongTask 수',
      val1: data1.longTasks.length,
      val2: data2.longTasks.length,
      unit: '개',
      lessIsBetter: true,
    },
    {
      name: 'LongTask 평균 시간',
      val1: data1.longTasks.length > 0 ? data1.longTasks.reduce((s, t) => s + t.duration, 0) / data1.longTasks.length : 0,
      val2: data2.longTasks.length > 0 ? data2.longTasks.reduce((s, t) => s + t.duration, 0) / data2.longTasks.length : 0,
      unit: 'ms',
      lessIsBetter: true,
    },
    {
      name: 'Total Blocking Time',
      val1: data1.longTasks.reduce((s, t) => s + Math.max(0, t.duration - 50), 0),
      val2: data2.longTasks.reduce((s, t) => s + Math.max(0, t.duration - 50), 0),
      unit: 'ms',
      lessIsBetter: true,
    },
    {
      name: '전체 시간',
      val1: data1.duration,
      val2: data2.duration,
      unit: 'ms',
      lessIsBetter: true,
    },
  ];

  metrics.forEach(metric => {
    // 소수점 자릿수 결정
    const decimals = metric.unit.includes('pages/sec') ? 2 : (metric.unit === 'ms' ? 2 : 0);
    const val1Str = metric.val1.toFixed(decimals) + metric.unit;
    const val2Str = metric.val2.toFixed(decimals) + metric.unit;
    const diff = metric.val2 - metric.val1;
    const diffPercent = metric.val1 > 0 ? (diff / metric.val1 * 100) : 0;
    
    let diffStr = '';
    const diffDecimals = metric.unit.includes('pages/sec') ? 2 : (metric.unit === 'ms' ? 2 : 0);
    
    if (metric.lessIsBetter) {
      if (diff < 0) {
        diffStr = `✅ ${diff.toFixed(diffDecimals)}${metric.unit} (${diffPercent.toFixed(1)}%)`;
      } else if (diff > 0) {
        diffStr = `❌ +${diff.toFixed(diffDecimals)}${metric.unit} (+${diffPercent.toFixed(1)}%)`;
      } else {
        diffStr = '➖ 동일';
      }
    } else {
      if (diff > 0) {
        diffStr = `✅ +${diff.toFixed(diffDecimals)}${metric.unit} (+${diffPercent.toFixed(1)}%)`;
      } else if (diff < 0) {
        diffStr = `❌ ${diff.toFixed(diffDecimals)}${metric.unit} (${diffPercent.toFixed(1)}%)`;
      } else {
        diffStr = '➖ 동일';
      }
    }

    console.log(
      metric.name.padEnd(40) +
      val1Str.padEnd(20) +
      val2Str.padEnd(20) +
      diffStr
    );
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
    console.error('  node bench/bench-pdfjs-longtasks.js --url "http://localhost:3000/feedback/4?version=pdf"');
    console.error('  node bench/bench-pdfjs-longtasks.js --url1 "..." --name1 "PDF" --url2 "..." --name2 "Queue"');
    process.exit(1);
  }

  console.log('\n🚀 PDF.js sendWithPromise & LongTask 벤치마크');
  console.log('='.repeat(80));
  console.log(`설정:`);
  console.log(`  - CPU Throttle: ${cpuThrottle}x`);
  if (realisticPattern) {
    console.log(`  - 스크롤 패턴: 🎯 현실적 (스크롤→읽기→반복)`);
  } else {
    console.log(`  - 스크롤 패턴: 단계별 (${scrollSteps}단계, ${stepDelay}ms)`);
  }
  console.log(`  - Headless: ${headless}`);

  const results = [];

  for (const { url, name } of urls) {
    const result = await measurePDFJsWithLongTasks(url, name);
    if (result) {
      results.push(result);
      analyzeTimeline(result);
    }
  }

  // 비교 분석
  if (results.length === 2) {
    compareVersions(results[0], results[1]);
  }

  // 결과 저장
  let outputPath;
  if (outputFile) {
    // 출력 파일이 지정된 경우
    outputPath = path.isAbsolute(outputFile) ? outputFile : path.join(benchDir, outputFile);
  } else {
    // 타임스탬프가 포함된 새 파일 생성
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    outputPath = path.join(outDir, `benchmark-results-${timestamp}.json`);
  }
  
  // 기존 결과 읽기 (파일이 있으면)
  let allResults = [];
  if (fs.existsSync(outputPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      allResults = existing.measurements || [];
      console.log(`\n📂 기존 결과 ${allResults.length}개 로드됨 (${path.basename(outputPath)})`);
    } catch (e) {
      console.warn('⚠️  기존 파일 읽기 실패, 새로 시작합니다.');
    }
  }
  
  // 새 결과 추가
  results.forEach(r => {
    allResults.push({
      ...r,
      timestamp: new Date().toISOString(),
      config: {
        cpuThrottle,
        scrollSteps,
        stepDelay,
        headless,
        realisticPattern,
      }
    });
  });
  
  // 기존 데이터에 renderEfficiency가 없으면 계산해서 추가
  allResults = allResults.map(r => {
    if (r.renderEfficiency === undefined && r.renderEvents && r.duration) {
      r.renderEfficiency = r.renderEvents.length > 0 
        ? parseFloat((r.renderEvents.length / (r.duration / 1000)).toFixed(2))
        : 0;
    }
    return r;
  });
  
  // 시나리오별 그룹화 및 평균 계산
  const grouped = {};
  allResults.forEach(result => {
    const key = result.version;
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(result);
  });
  
  // 시나리오별 평균 계산 (렌더링이 잘 안된 결과는 제외)
  const averages = {};
  Object.entries(grouped).forEach(([version, items]) => {
    // 렌더 이벤트가 5개 미만인 결과는 제외 (렌더링이 제대로 안된 경우)
    const validItems = items.filter(r => (r.renderEvents?.length || 0) >= 5);
    const excludedCount = items.length - validItems.length;
    
    if (excludedCount > 0) {
      console.log(`\n⚠️  ${version}: ${excludedCount}개 결과 제외됨 (렌더 이벤트 < 5개)`);
    }
    
    if (validItems.length === 0) {
      console.warn(`❌ ${version}: 유효한 데이터가 없습니다!`);
      return;
    }
    
    const sendWithPromiseCalls = validItems.map(r => r.sendWithPromiseCalls?.length || 0);
    const longTasks = validItems.map(r => r.longTasks?.length || 0);
    const renderEvents = validItems.map(r => r.renderEvents?.length || 0);
    const durations = validItems.map(r => r.duration || 0);
    const efficiencies = validItems.map(r => r.renderEfficiency || 0);
    
    const tbts = validItems.map(r => {
      const tasks = r.longTasks || [];
      return tasks.reduce((s, t) => s + Math.max(0, t.duration - 50), 0);
    });
    
    const avg = (arr) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const min = (arr) => arr.length > 0 ? Math.min(...arr) : 0;
    const max = (arr) => arr.length > 0 ? Math.max(...arr) : 0;
    
    averages[version] = {
      count: validItems.length,
      excluded: excludedCount,
      sendWithPromise: {
        avg: avg(sendWithPromiseCalls),
        min: min(sendWithPromiseCalls),
        max: max(sendWithPromiseCalls),
      },
      longTasks: {
        avg: avg(longTasks),
        min: min(longTasks),
        max: max(longTasks),
      },
      totalBlockingTime: {
        avg: avg(tbts),
        min: min(tbts),
        max: max(tbts),
      },
      renderEvents: {
        avg: avg(renderEvents),
        min: min(renderEvents),
        max: max(renderEvents),
      },
      renderEfficiency: {
        avg: avg(efficiencies),
        min: min(efficiencies),
        max: max(efficiencies),
      },
      duration: {
        avg: avg(durations),
        min: min(durations),
        max: max(durations),
      }
    };
  });
  
  // 파일 저장 (디렉토리 생성 확인)
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, JSON.stringify({
    lastUpdated: new Date().toISOString(),
    totalMeasurements: allResults.length,
    measurements: allResults,
    averages: averages,
  }, null, 2));

  console.log(`\n\n💾 결과 저장: ${outputPath}`);
  console.log(`   총 측정 횟수: ${allResults.length}회`);
  
  // 시나리오별 평균 출력
  console.log('\n' + '='.repeat(80));
  console.log('📊 시나리오별 평균 (전체 누적 데이터)');
  console.log('='.repeat(80));
  
  Object.entries(averages).forEach(([version, avg]) => {
    console.log(`\n🔹 ${version} (n=${avg.count}${avg.excluded > 0 ? `, 제외: ${avg.excluded}` : ''})`);
    console.log('-'.repeat(80));
    console.log(`   렌더링된 페이지:     평균 ${avg.renderEvents.avg.toFixed(1)}개 (${avg.renderEvents.min}~${avg.renderEvents.max})`);
    console.log(`   렌더링 효율:        평균 ${avg.renderEfficiency.avg.toFixed(2)} pages/sec (${avg.renderEfficiency.min.toFixed(2)}~${avg.renderEfficiency.max.toFixed(2)})`);
    console.log(`   sendWithPromise:     평균 ${avg.sendWithPromise.avg.toFixed(1)}회 (${avg.sendWithPromise.min}~${avg.sendWithPromise.max})`);
    console.log(`   LongTask:           평균 ${avg.longTasks.avg.toFixed(1)}개 (${avg.longTasks.min}~${avg.longTasks.max})`);
    console.log(`   Total Blocking Time: 평균 ${avg.totalBlockingTime.avg.toFixed(1)}ms (${avg.totalBlockingTime.min.toFixed(0)}~${avg.totalBlockingTime.max.toFixed(0)})`);
    console.log(`   전체 시간:          평균 ${(avg.duration.avg/1000).toFixed(1)}s (${(avg.duration.min/1000).toFixed(1)}~${(avg.duration.max/1000).toFixed(1)})`);
  });
  
  // 버전 비교 (PDF vs Queue)
  const versionNames = Object.keys(averages);
  const pdfVersions = versionNames.filter(v => v.startsWith('PDF-'));
  
  console.log('\n\n' + '='.repeat(80));
  console.log('🔍 버전 비교 (평균) - PDF vs Queue');
  console.log('='.repeat(80));
  
  pdfVersions.forEach(pdfVer => {
    const suffix = pdfVer.replace('PDF-', '');
    const queueVer = `Queue-${suffix}`;
    
    if (averages[queueVer]) {
      const pdfAvg = averages[pdfVer];
      const queueAvg = averages[queueVer];
      
      console.log(`\n📊 ${suffix} 환경 (PDF: n=${pdfAvg.count}, Queue: n=${queueAvg.count})`);
      console.log('-'.repeat(80));
      
      const efficiencyImprovement = pdfAvg.renderEfficiency && queueAvg.renderEfficiency
        ? ((queueAvg.renderEfficiency.avg - pdfAvg.renderEfficiency.avg) / pdfAvg.renderEfficiency.avg * 100)
        : null;
      const tbtImprovement = ((pdfAvg.totalBlockingTime.avg - queueAvg.totalBlockingTime.avg) / pdfAvg.totalBlockingTime.avg * 100);
      const ltImprovement = ((pdfAvg.longTasks.avg - queueAvg.longTasks.avg) / pdfAvg.longTasks.avg * 100);
      const sendImprovement = ((pdfAvg.sendWithPromise.avg - queueAvg.sendWithPromise.avg) / pdfAvg.sendWithPromise.avg * 100);
      const renderImprovement = ((queueAvg.renderEvents.avg - pdfAvg.renderEvents.avg) / pdfAvg.renderEvents.avg * 100);
      
      console.log(`   렌더링된 페이지:  ${pdfAvg.renderEvents.avg.toFixed(1)}개 → ${queueAvg.renderEvents.avg.toFixed(1)}개  (${renderImprovement > 0 ? '✅' : '❌'} ${renderImprovement.toFixed(1)}%)`);
      if (efficiencyImprovement !== null) {
        console.log(`   렌더링 효율:      ${pdfAvg.renderEfficiency.avg.toFixed(2)} → ${queueAvg.renderEfficiency.avg.toFixed(2)} pages/sec  (${efficiencyImprovement > 0 ? '✅' : '❌'} ${efficiencyImprovement.toFixed(1)}%)`);
      }
      console.log(`   TBT:              ${pdfAvg.totalBlockingTime.avg.toFixed(1)}ms → ${queueAvg.totalBlockingTime.avg.toFixed(1)}ms  (${tbtImprovement > 0 ? '✅' : '❌'} ${tbtImprovement.toFixed(1)}%)`);
      console.log(`   LongTask:         ${pdfAvg.longTasks.avg.toFixed(1)}개 → ${queueAvg.longTasks.avg.toFixed(1)}개  (${ltImprovement > 0 ? '✅' : '❌'} ${ltImprovement.toFixed(1)}%)`);
      console.log(`   sendWithPromise:  ${pdfAvg.sendWithPromise.avg.toFixed(1)}회 → ${queueAvg.sendWithPromise.avg.toFixed(1)}회  (${sendImprovement > 0 ? '✅' : '❌'} ${sendImprovement.toFixed(1)}%)`);
    }
  });
  
  // CPU 스로틀링 비교 (4x vs 1x)
  const cpuLevels = ['4x', '1x', '2x', '6x']; // 가능한 CPU 레벨
  const hasMultipleCpuLevels = cpuLevels.some(level => {
    return versionNames.some(v => v.endsWith(`-${level}`));
  });
  
  if (hasMultipleCpuLevels) {
    console.log('\n\n' + '='.repeat(80));
    console.log('⚡ CPU 스로틀링 영향 분석');
    console.log('='.repeat(80));
    
    // PDF 버전의 CPU 비교
    const pdfCpuVersions = versionNames.filter(v => v.startsWith('PDF-'));
    if (pdfCpuVersions.length >= 2) {
      console.log('\n📊 PDF 버전 - CPU 스로틀링 영향');
      console.log('-'.repeat(80));
      
      // 4x와 1x 비교
      const pdf4x = averages['PDF-4x'];
      const pdf1x = averages['PDF-1x'];
      
      if (pdf4x && pdf1x) {
        const renderDiff = ((pdf1x.renderEvents.avg - pdf4x.renderEvents.avg) / pdf4x.renderEvents.avg * 100);
        const efficiencyDiff = ((pdf1x.renderEfficiency.avg - pdf4x.renderEfficiency.avg) / pdf4x.renderEfficiency.avg * 100);
        const tbtDiff = ((pdf4x.totalBlockingTime.avg - pdf1x.totalBlockingTime.avg) / pdf4x.totalBlockingTime.avg * 100);
        const ltDiff = ((pdf4x.longTasks.avg - pdf1x.longTasks.avg) / pdf4x.longTasks.avg * 100);
        
        console.log(`   CPU 4x (저사양) → 1x (일반)`);
        console.log(`   렌더링된 페이지:     ${pdf4x.renderEvents.avg.toFixed(1)}개 → ${pdf1x.renderEvents.avg.toFixed(1)}개  (${renderDiff > 0 ? '✅' : '❌'} ${renderDiff.toFixed(1)}%)`);
        console.log(`   렌더링 효율:        ${pdf4x.renderEfficiency.avg.toFixed(2)} → ${pdf1x.renderEfficiency.avg.toFixed(2)} pages/sec  (${efficiencyDiff > 0 ? '✅' : '❌'} ${efficiencyDiff.toFixed(1)}%)`);
        console.log(`   TBT:                ${pdf4x.totalBlockingTime.avg.toFixed(1)}ms → ${pdf1x.totalBlockingTime.avg.toFixed(1)}ms  (${tbtDiff > 0 ? '✅' : '❌'} ${tbtDiff.toFixed(1)}%)`);
        console.log(`   LongTask:           ${pdf4x.longTasks.avg.toFixed(1)}개 → ${pdf1x.longTasks.avg.toFixed(1)}개  (${ltDiff > 0 ? '✅' : '❌'} ${ltDiff.toFixed(1)}%)`);
      }
    }
    
    // Queue 버전의 CPU 비교
    const queueCpuVersions = versionNames.filter(v => v.startsWith('Queue-'));
    if (queueCpuVersions.length >= 2) {
      console.log('\n📊 Queue 버전 - CPU 스로틀링 영향');
      console.log('-'.repeat(80));
      
      // 4x와 1x 비교
      const queue4x = averages['Queue-4x'];
      const queue1x = averages['Queue-1x'];
      
      if (queue4x && queue1x) {
        const renderDiff = ((queue1x.renderEvents.avg - queue4x.renderEvents.avg) / queue4x.renderEvents.avg * 100);
        const efficiencyDiff = ((queue1x.renderEfficiency.avg - queue4x.renderEfficiency.avg) / queue4x.renderEfficiency.avg * 100);
        const tbtDiff = ((queue4x.totalBlockingTime.avg - queue1x.totalBlockingTime.avg) / queue4x.totalBlockingTime.avg * 100);
        const ltDiff = ((queue4x.longTasks.avg - queue1x.longTasks.avg) / queue4x.longTasks.avg * 100);
        
        console.log(`   CPU 4x (저사양) → 1x (일반)`);
        console.log(`   렌더링된 페이지:     ${queue4x.renderEvents.avg.toFixed(1)}개 → ${queue1x.renderEvents.avg.toFixed(1)}개  (${renderDiff > 0 ? '✅' : '❌'} ${renderDiff.toFixed(1)}%)`);
        console.log(`   렌더링 효율:        ${queue4x.renderEfficiency.avg.toFixed(2)} → ${queue1x.renderEfficiency.avg.toFixed(2)} pages/sec  (${efficiencyDiff > 0 ? '✅' : '❌'} ${efficiencyDiff.toFixed(1)}%)`);
        console.log(`   TBT:                ${queue4x.totalBlockingTime.avg.toFixed(1)}ms → ${queue1x.totalBlockingTime.avg.toFixed(1)}ms  (${tbtDiff > 0 ? '✅' : '❌'} ${tbtDiff.toFixed(1)}%)`);
        console.log(`   LongTask:           ${queue4x.longTasks.avg.toFixed(1)}개 → ${queue1x.longTasks.avg.toFixed(1)}개  (${ltDiff > 0 ? '✅' : '❌'} ${ltDiff.toFixed(1)}%)`);
      }
    }
    
    // Queue의 CPU별 개선율 비교
    const pdf4x = averages['PDF-4x'];
    const pdf1x = averages['PDF-1x'];
    const queue4x = averages['Queue-4x'];
    const queue1x = averages['Queue-1x'];
    
    if (pdf4x && queue4x && pdf1x && queue1x) {
      console.log('\n📊 Queue 우선순위 방식의 효과 - CPU별 비교');
      console.log('-'.repeat(80));
      
      const improvement4x = ((queue4x.renderEvents.avg - pdf4x.renderEvents.avg) / pdf4x.renderEvents.avg * 100);
      const improvement1x = ((queue1x.renderEvents.avg - pdf1x.renderEvents.avg) / pdf1x.renderEvents.avg * 100);
      
      console.log(`   CPU 4x (저사양):  PDF ${pdf4x.renderEvents.avg.toFixed(1)}개 → Queue ${queue4x.renderEvents.avg.toFixed(1)}개  (✅ +${improvement4x.toFixed(1)}%)`);
      console.log(`   CPU 1x (일반):    PDF ${pdf1x.renderEvents.avg.toFixed(1)}개 → Queue ${queue1x.renderEvents.avg.toFixed(1)}개  (✅ +${improvement1x.toFixed(1)}%)`);
      console.log('');
      
      if (improvement4x > improvement1x) {
        const diff = improvement4x - improvement1x;
        console.log(`   💡 저사양 환경(4x)에서 Queue 방식의 효과가 ${diff.toFixed(1)}%p 더 큽니다!`);
      } else {
        const diff = improvement1x - improvement4x;
        console.log(`   💡 일반 환경(1x)에서 Queue 방식의 효과가 ${diff.toFixed(1)}%p 더 큽니다.`);
      }
    }
  }
  
  // 최종 평균 요약 테이블
  if (Object.keys(averages).length > 0) {
    console.log('\n\n' + '='.repeat(80));
    console.log('📊 최종 평균 요약 (렌더링 오류 제외)');
    console.log('='.repeat(80));
    console.log('');
    
    // 테이블 헤더
    const header = '버전'.padEnd(15) + 
                   '실행'.padEnd(8) + 
                   '렌더페이지'.padEnd(12) + 
                   '효율(p/s)'.padEnd(12) + 
                   'LongTask'.padEnd(12) + 
                   'TBT(ms)'.padEnd(12);
    console.log(header);
    console.log('-'.repeat(80));
    
    // 버전별 데이터 출력
    Object.entries(averages).forEach(([version, avg]) => {
      const versionStr = version.padEnd(15);
      const countStr = `${avg.count}회`.padEnd(8);
      const renderStr = `${avg.renderEvents.avg.toFixed(1)}개`.padEnd(12);
      const efficiencyStr = `${avg.renderEfficiency.avg.toFixed(2)}`.padEnd(12);
      const longTaskStr = `${avg.longTasks.avg.toFixed(1)}개`.padEnd(12);
      const tbtStr = `${avg.totalBlockingTime.avg.toFixed(0)}`.padEnd(12);
      
      console.log(versionStr + countStr + renderStr + efficiencyStr + longTaskStr + tbtStr);
    });
    
    console.log('-'.repeat(80));
    
    // 제외된 항목 정보
    const totalExcluded = Object.values(averages).reduce((sum, avg) => sum + (avg.excluded || 0), 0);
    if (totalExcluded > 0) {
      console.log(`\n⚠️  렌더 이벤트 < 5개로 제외된 결과: 총 ${totalExcluded}개`);
    } else {
      console.log(`\n✅ 모든 결과가 유효합니다 (제외 0개)`);
    }
  }
  
  console.log('\n✅ 벤치마크 완료!\n');

})().catch((e) => {
  console.error('❌ 오류 발생:', e);
  process.exit(1);
});
