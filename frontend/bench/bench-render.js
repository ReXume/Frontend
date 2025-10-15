#!/usr/bin/env node
/**
 * bench-render.js — PDF.js 렌더링 성능 측정 벤치마크
 *
 * PDF 렌더링 중복 호출, 동시성, Long Task, fetch 중복 등을 측정합니다.
 *
 * 필수 패키지:
 *   npm install puppeteer
 *
 * 사용 예:
 *   # 단일 URL 측정
 *   node bench/bench-render.js --url "http://localhost:3000/feedback/4?version=queue"
 *
 *   # 여러 URL 비교
 *   node bench/bench-render.js \
 *     --url1 "http://localhost:3000/feedback/4?version=old" --name1 "Old Version" \
 *     --url2 "http://localhost:3000/feedback/4?version=pdf" --name2 "PDF Version" \
 *     --url3 "http://localhost:3000/feedback/4?version=queue" --name3 "Queue Version"
 *
 *   # 여러 번 실행 (통계용)
 *   node bench/bench-render.js --url "..." --runs 5
 *
 *   # CPU 스로틀링 조정
 *   node bench/bench-render.js --url "..." --cpu 4
 *
 *   # 스크롤 속도 조정
 *   node bench/bench-render.js --url "..." --scroll-slow 120 --scroll-fast 20
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

// ---- 인자 파싱 ----
function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  if (i === -1) return def;
  const next = process.argv[i + 1];
  if (!next || next.startsWith('--')) return true;
  return next;
}

// 단일 URL 또는 여러 URL
const singleUrl = arg('url', null);
const urls = [];
const names = [];

if (singleUrl) {
  urls.push(singleUrl);
  names.push('Single URL');
} else {
  for (let i = 1; i <= 5; i++) {
    const url = arg(`url${i}`, null);
    const name = arg(`name${i}`, `Version ${i}`);
    if (url) {
      urls.push(url);
      names.push(name);
    }
  }
}

if (urls.length === 0) {
  console.error('❌ 오류: --url 또는 --url1, --url2 등을 지정해주세요.');
  process.exit(1);
}

const runs = parseInt(arg('runs', '1'), 10);
const cpuThrottle = parseFloat(arg('cpu', '4'));
const scrollSlowDelay = parseInt(arg('scroll-slow', '120'), 10);
const scrollFastDelay = parseInt(arg('scroll-fast', '20'), 10);
const saveResults = arg('save', 'true') === 'true';

// ---- 렌더링 성능 측정 함수 ----
async function measureRenderPerformance(url) {
  const browser = await puppeteer.launch({
    headless: false, // 디버깅: 브라우저 창 표시
    defaultViewport: { width: 1280, height: 800 },
    args: ['--disable-dev-shm-usage']
  });

  const [page] = await browser.pages();
  const client = await page.target().createCDPSession();

  // 1) CPU/네트워크 스로틀(재현성↑)
  await client.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottle });
  await client.send('Network.enable');
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 40,           // RTT ~40ms
    downloadThroughput: 5 * 1024 * 1024 / 8, // ~5Mbps
    uploadThroughput: 2 * 1024 * 1024 / 8    // ~2Mbps
  });

  // 2) 페이지 컨텍스트에 계측기 주입
  await page.evaluateOnNewDocument(() => {
    // 전역 수집 버킷
    window.__renderProbe = {
      active: 0,
      maxConcurrency: 0,
      totalRenderCalls: 0,
      duplicateRenderCount: 0,
      cancelledRenderCount: 0,
      seenKeyTimestamps: new Map(), // key -> lastStartTime
      longTaskCount: 0,
      longTaskTotal: 0,
      fetchSeen: new Map(), // urlKey -> count
      fetchDupCount: 0,
      logs: []
    };

    // Long Task 포착
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          window.__renderProbe.longTaskCount++;
          window.__renderProbe.longTaskTotal += e.duration;
        }
      }).observe({ type: 'longtask', buffered: true });
    } catch {}

    // fetch 중복 포착(범용)
    const origFetch = window.fetch?.bind(window);
    if (origFetch) {
      window.fetch = async (...args) => {
        try {
          const req = new Request(args[0], args[1]);
          const key = req.url + '|' + (req.headers.get('range') || '');
          const count = (window.__renderProbe.fetchSeen.get(key) || 0) + 1;
          window.__renderProbe.fetchSeen.set(key, count);
          if (count > 1) window.__renderProbe.fetchDupCount++;
        } catch {}
        return origFetch(...args);
      };
    }

    // IntersectionObserver도 로깅(선택)
    const OrigIO = window.IntersectionObserver;
    if (OrigIO) {
      window.IntersectionObserver = class extends OrigIO {
        constructor(cb, opts) {
          const wrapped = (entries, observer) => {
            // viewport 진입으로 렌더 트리거되는지 감 잡기
            const hit = entries.filter(e => e.isIntersecting).length;
            if (hit > 0) window.__renderProbe.logs.push({ t: performance.now(), type: 'io-intersect', hit });
            cb(entries, observer);
          };
          super(wrapped, opts);
        }
      };
    }

    // Canvas 렌더링 모니터링 패치 (PDF.js ES module 대응)
    // Canvas가 생성되기 전에 미리 prototype을 패치
    if (!HTMLCanvasElement.prototype.__renderPatched) {
      const originalGetContext = HTMLCanvasElement.prototype.getContext;
      const patchedContexts = new WeakSet();
      
      HTMLCanvasElement.prototype.getContext = function(...args) {
        const context = originalGetContext.apply(this, args);
        
        // 2D context이고 아직 패치되지 않았다면 패치
        if (context && args[0] === '2d' && !patchedContexts.has(context)) {
          patchedContexts.add(context);
          
          const originalDrawImage = context.drawImage;
          const canvasElement = this.canvas;
          let drawCallCount = 0;
          
          context.drawImage = function(...drawArgs) {
            drawCallCount++;
            
            // PDF 렌더링 감지: 
            // 1. Canvas to Canvas 렌더링 (PDF.js의 일반적인 방식)
            // 2. ImageData나 ImageBitmap
            // 3. 큰 이미지 (width > 50)
            const source = drawArgs[0];
            const isPDFRender = 
              source instanceof HTMLCanvasElement ||
              source instanceof ImageBitmap ||
              source instanceof ImageData ||
              (source && source.width && source.width > 50);
            
            if (isPDFRender) {
              window.__renderProbe.totalRenderCalls++;
              window.__renderProbe.active++;
              if (window.__renderProbe.active > window.__renderProbe.maxConcurrency) {
                window.__renderProbe.maxConcurrency = window.__renderProbe.active;
              }
              
              // 렌더링 타임스탬프 추적 (중복 감지용)
              const now = performance.now();
              const key = `${canvasElement?.width || 0}x${canvasElement?.height || 0}`;
              const last = window.__renderProbe.seenKeyTimestamps.get(key) || -Infinity;
              if (now - last < 1000) {
                window.__renderProbe.duplicateRenderCount++;
              }
              window.__renderProbe.seenKeyTimestamps.set(key, now);
              
              // 렌더링 완료 후 카운트 감소
              setTimeout(() => {
                window.__renderProbe.active = Math.max(0, window.__renderProbe.active - 1);
              }, 16); // 1 frame 후
            }
            
            return originalDrawImage.apply(this, drawArgs);
          };
        }
        
        return context;
      };
      
      HTMLCanvasElement.prototype.__renderPatched = true;
      window.__renderProbe.logs.push({ 
        t: performance.now(), 
        type: 'patch-ok',
        method: 'canvas-prototype-patch'
      });
    }
    
    // pdfjs-dist render 계층 훅킹 (전역 PDF.js가 있는 경우)
    const patchPdfJs = () => {
      // Canvas 개수 확인
      const canvases = document.querySelectorAll('canvas');
      if (canvases.length > 0) {
        window.__renderProbe.logs.push({ 
          t: performance.now(), 
          type: 'canvas-found',
          count: canvases.length 
        });
      }
      
      // 방법 3: 전역에서 PDF.js 찾기 (fallback)
      let lib = null;
      let foundMethod = '';
      
      if (window.pdfjsLib) {
        lib = window.pdfjsLib;
        foundMethod = 'window.pdfjsLib';
      } else if (window.PDFJS) {
        lib = window.PDFJS;
        foundMethod = 'window.PDFJS';
      } else {
        const keys = Object.keys(window);
        for (const key of keys) {
          if (key.toLowerCase().includes('pdf') && window[key]?.PDFPageProxy) {
            lib = window[key];
            foundMethod = `window.${key}`;
            break;
          }
        }
      }
      
      if (!lib || !lib.PDFPageProxy) {
        // 디버깅 정보 수집
        const availableKeys = Object.keys(window).filter(k => 
          k.toLowerCase().includes('pdf') || 
          k.toLowerCase().includes('react') ||
          k.includes('__')
        );
        window.__renderProbe.logs.push({ 
          t: performance.now(), 
          type: 'patch-search',
          availableKeys: availableKeys.slice(0, 10)
        });
        return false;
      }

      const proto = lib.PDFPageProxy.prototype;
      if (!proto.__renderPatched) {
        const origRender = proto.render;
        proto.render = function(renderParams) {
          const pageNumber = this.pageNumber || renderParams?.viewport?.viewBox?.toString();
          const scale = renderParams?.viewport?.scale ?? renderParams?.scale ?? 1;
          const key = `${pageNumber}@${scale.toFixed(3)}`;
          const now = performance.now();

          window.__renderProbe.totalRenderCalls++;
          window.__renderProbe.active++;
          if (window.__renderProbe.active > window.__renderProbe.maxConcurrency) {
            window.__renderProbe.maxConcurrency = window.__renderProbe.active;
          }

          // 짧은 시간(1s) 내 동일 key 재시작 ⇒ 중복으로 간주(휴리스틱)
          const last = window.__renderProbe.seenKeyTimestamps.get(key) || -Infinity;
          if (now - last < 1000) {
            window.__renderProbe.duplicateRenderCount++;
          }
          window.__renderProbe.seenKeyTimestamps.set(key, now);

          const task = origRender.call(this, renderParams);

          // 취소/완료 추적
          const done = () => { window.__renderProbe.active = Math.max(0, window.__renderProbe.active - 1); };
          task.promise
            .then(done)
            .catch((err) => {
              // pdfjs는 취소 시 RenderingCancelledException name/code를 씀
              const name = err?.name || err?.message || '';
              if (String(name).toLowerCase().includes('cancel')) {
                window.__renderProbe.cancelledRenderCount++;
              }
              done();
            });

          // cancel 직접 호출 여부도 기록
          if (typeof task.cancel === 'function') {
            const origCancel = task.cancel.bind(task);
            task.cancel = (...a) => {
              window.__renderProbe.cancelledRenderCount++;
              return origCancel(...a);
            };
          }
          return task;
        };
        proto.__renderPatched = true;
        window.__renderProbe.logs.push({ 
          t: performance.now(), 
          type: 'patch-ok',
          method: foundMethod
        });
      }
      return true;
    };

    // 전역 PDF.js 확인 (Canvas 패치는 이미 적용됨)
    // 폴링은 선택사항: Canvas 패치가 메인이고, PDF.js는 추가 정보용
    const start = performance.now();
    let attempts = 0;
    const tryPatchLoop = () => {
      attempts++;
      const found = patchPdfJs();
      
      if (found) {
        window.__renderProbe.logs.push({ 
          t: performance.now(), 
          type: 'pdfjs-found',
          attempts
        });
        return;
      }
      
      // 최대 5초만 시도 (Canvas 패치가 메인이므로 짧게)
      if (performance.now() - start > 5000) {
        window.__renderProbe.logs.push({ 
          t: performance.now(), 
          type: 'pdfjs-not-found',
          attempts,
          note: 'Using canvas-based monitoring instead'
        });
        return;
      }
      
      setTimeout(tryPatchLoop, 200);
    };
    tryPatchLoop();
  });

  // 3) 페이지 이동
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 });

  // 초기 렌더링 완료 대기 (PDF 로드 + 렌더링)
  console.log('  ⏳ PDF 로딩 대기 중...');
  await new Promise(resolve => setTimeout(resolve, 5000)); // 5초로 증가
  
  // Canvas가 생성될 때까지 추가 대기 + 페이지 구조 확인
  const pageInfo = await page.evaluate(() => {
    return new Promise((resolve) => {
      let attempts = 0;
      const checkCanvas = () => {
        attempts++;
        const canvas = document.querySelector('canvas');
        if (canvas) {
          resolve({
            canvasFound: true,
            attempts,
            canvasCount: document.querySelectorAll('canvas').length,
            bodyHTML: null
          });
          return;
        }
        
        if (performance.now() > 10000) { // 10초 타임아웃
          // Canvas를 찾지 못한 경우 페이지 구조 분석
          const allElements = Array.from(document.querySelectorAll('*'));
          const elementCounts = {};
          allElements.forEach(el => {
            const tag = el.tagName.toLowerCase();
            elementCounts[tag] = (elementCounts[tag] || 0) + 1;
          });
          
          // PDF 관련 요소 찾기
          const pdfElements = Array.from(document.querySelectorAll('[class*="pdf"], [class*="PDF"], [id*="pdf"]'));
          const loadingElements = Array.from(document.querySelectorAll('[class*="loading"], [class*="Loading"]'));
          
          resolve({
            canvasFound: false,
            attempts,
            canvasCount: 0,
            totalElements: allElements.length,
            elementCounts,
            pdfElements: pdfElements.map(el => ({
              tag: el.tagName,
              className: el.className,
              id: el.id,
              text: el.textContent?.substring(0, 100)
            })),
            loadingElements: loadingElements.map(el => ({
              tag: el.tagName,
              className: el.className,
              text: el.textContent?.substring(0, 50)
            })),
            bodyClasses: document.body.className,
            bodyChildrenCount: document.body.children.length
          });
          return;
        }
        setTimeout(checkCanvas, 100);
      };
      checkCanvas();
    });
  });
  
  if (pageInfo.canvasFound) {
    console.log(`  ✅ Canvas 발견! (${pageInfo.attempts}번째 시도, 총 ${pageInfo.canvasCount}개)`);
  } else {
    console.log('  ⚠️  Canvas를 찾을 수 없음 (계속 진행)');
    console.log(`     - 총 요소: ${pageInfo.totalElements}개`);
    console.log(`     - PDF 관련 요소: ${pageInfo.pdfElements?.length || 0}개`);
    console.log(`     - 로딩 요소: ${pageInfo.loadingElements?.length || 0}개`);
    if (pageInfo.loadingElements && pageInfo.loadingElements.length > 0) {
      console.log(`     - 로딩 메시지: "${pageInfo.loadingElements[0]?.text}"`);
    }
    if (pageInfo.pdfElements && pageInfo.pdfElements.length > 0) {
      console.log(`     - PDF 요소: ${pageInfo.pdfElements[0]?.className || pageInfo.pdfElements[0]?.tag}`);
    }
    
    // 스크린샷 저장 (디버깅용)
    const screenshotPath = path.join(__dirname, 'bench_out', `debug-${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`     - 🖼️  스크린샷: ${screenshotPath}`);
    
    // 콘솔 에러 확인
    const consoleErrors = await page.evaluate(() => {
      return window.__renderProbe?.logs.filter(log => log.type === 'error') || [];
    });
    if (consoleErrors.length > 0) {
      console.log(`     - ❌ 콘솔 에러: ${consoleErrors.length}개`);
    }
  }

  // 4) 스크롤 시나리오(천천히 → 빠르게)
  // PDF 컨테이너를 찾아서 스크롤
  const slowScroll = async () => {
    await page.evaluate(async (delay) => {
      // PDF가 있는 스크롤 가능한 컨테이너 찾기
      const findScrollableContainer = () => {
        // 1. Canvas 요소 찾기 (PDF 렌더링)
        const canvas = document.querySelector('canvas');
        if (!canvas) {
          window.__renderProbe.logs.push({ t: performance.now(), type: 'no-canvas' });
          return null;
        }
        
        // 2. Canvas의 부모 중 overflow가 설정된 컨테이너 찾기
        let element = canvas.parentElement;
        while (element && element !== document.body) {
          const style = window.getComputedStyle(element);
          const isScrollable = 
            style.overflowY === 'auto' || 
            style.overflowY === 'scroll' ||
            style.overflow === 'auto' ||
            style.overflow === 'scroll';
          
          if (isScrollable && element.scrollHeight > element.clientHeight) {
            return element;
          }
          element = element.parentElement;
        }
        
        // 3. scrollHeight가 clientHeight보다 큰 div 찾기
        element = canvas.parentElement;
        while (element && element !== document.body) {
          if (element.scrollHeight > element.clientHeight) {
            return element;
          }
          element = element.parentElement;
        }
        
        return null;
      };
      
      const container = findScrollableContainer();
      const scrollTarget = container || window;
      const isWindow = scrollTarget === window;
      
      const getScrollHeight = () => {
        if (isWindow) {
          return Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
        }
        return scrollTarget.scrollHeight;
      };
      
      const scrollTo = (y) => {
        if (isWindow) {
          window.scrollTo({ top: y, behavior: 'instant' });
        } else {
          scrollTarget.scrollTop = y;
        }
      };
      
      const step = Math.floor(window.innerHeight * 0.5);
      const totalHeight = getScrollHeight();
      
      window.__renderProbe.logs.push({ 
        t: performance.now(), 
        type: 'scroll-start', 
        height: totalHeight,
        container: container ? container.className || container.tagName : 'window',
        canvasFound: !!document.querySelector('canvas')
      });
      
      for (let y = 0; y < totalHeight; y += step) {
        scrollTo(y);
        await new Promise(r => setTimeout(r, delay));
      }
      
      // 맨 아래까지 스크롤
      scrollTo(totalHeight);
      await new Promise(r => setTimeout(r, delay * 2));
      
      window.__renderProbe.logs.push({ t: performance.now(), type: 'scroll-slow-end' });
    }, scrollSlowDelay);
  };
  
  const fastScroll = async () => {
    await page.evaluate(async (delay) => {
      // 동일한 컨테이너 찾기 로직
      const findScrollableContainer = () => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return null;
        
        let element = canvas.parentElement;
        while (element && element !== document.body) {
          const style = window.getComputedStyle(element);
          const isScrollable = 
            style.overflowY === 'auto' || 
            style.overflowY === 'scroll' ||
            style.overflow === 'auto' ||
            style.overflow === 'scroll';
          
          if (isScrollable && element.scrollHeight > element.clientHeight) {
            return element;
          }
          element = element.parentElement;
        }
        
        element = canvas.parentElement;
        while (element && element !== document.body) {
          if (element.scrollHeight > element.clientHeight) {
            return element;
          }
          element = element.parentElement;
        }
        
        return null;
      };
      
      const container = findScrollableContainer();
      const scrollTarget = container || window;
      const isWindow = scrollTarget === window;
      
      const getScrollHeight = () => {
        if (isWindow) {
          return Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
        }
        return scrollTarget.scrollHeight;
      };
      
      const scrollTo = (y) => {
        if (isWindow) {
          window.scrollTo({ top: y, behavior: 'instant' });
        } else {
          scrollTarget.scrollTop = y;
        }
      };
      
      // 맨 위로 돌아가기
      scrollTo(0);
      await new Promise(r => setTimeout(r, 500));
      
      const step = Math.floor(window.innerHeight * 1.5);
      const totalHeight = getScrollHeight();
      
      window.__renderProbe.logs.push({ t: performance.now(), type: 'scroll-fast-start' });
      
      for (let y = 0; y < totalHeight; y += step) {
        scrollTo(y);
        await new Promise(r => setTimeout(r, delay));
      }
      
      // 맨 아래까지 스크롤
      scrollTo(totalHeight);
      await new Promise(r => setTimeout(r, delay * 2));
      
      window.__renderProbe.logs.push({ t: performance.now(), type: 'scroll-fast-end' });
    }, scrollFastDelay);
  };

  await slowScroll();
  await new Promise(resolve => setTimeout(resolve, 1500)); // 렌더링 완료 대기
  await fastScroll();
  await new Promise(resolve => setTimeout(resolve, 2000)); // 마지막 렌더링 완료 대기

  // 5) 결과 수집
  const result = await page.evaluate(() => {
    const p = window.__renderProbe;
    
    // 스크롤 관련 로그 추출
    const scrollLogs = p.logs.filter(log => log.type.startsWith('scroll-'));
    const scrollStart = p.logs.find(log => log.type === 'scroll-start');
    const ioLogs = p.logs.filter(log => log.type === 'io-intersect');
    const patchOk = p.logs.find(log => log.type === 'patch-ok');
    const patchTimeout = p.logs.find(log => log.type === 'patch-timeout');
    const patchSearches = p.logs.filter(log => log.type === 'patch-search');
    const canvasFound = p.logs.find(log => log.type === 'canvas-found');
    const noCanvas = p.logs.find(log => log.type === 'no-canvas');
    
    return {
      maxConcurrency: p.maxConcurrency,
      totalRenderCalls: p.totalRenderCalls,
      duplicateRenderCount: p.duplicateRenderCount,
      cancelledRenderCount: p.cancelledRenderCount,
      longTaskCount: p.longTaskCount,
      longTaskTotalMs: Math.round(p.longTaskTotal),
      fetchDupCount: p.fetchDupCount,
      debugInfo: {
        scrollEvents: scrollLogs.length,
        scrollContainer: scrollStart ? scrollStart.container : 'unknown',
        scrollHeight: scrollStart ? scrollStart.height : 0,
        canvasFoundAtScroll: scrollStart ? scrollStart.canvasFound : false,
        intersectionEvents: ioLogs.reduce((sum, log) => sum + (log.hit || 0), 0),
        patchStatus: patchOk ? 'OK' : 'FAILED',
        patchMethod: patchOk?.method || 'N/A',
        patchTimeout: patchTimeout ? {
          canvasCount: patchTimeout.canvasCount,
          hasPDFElements: patchTimeout.hasPDFElements
        } : null,
        searchAttempts: patchSearches.length,
        availableKeys: patchSearches.length > 0 ? patchSearches[patchSearches.length - 1].availableKeys : [],
        canvasFoundDuringPatch: canvasFound ? canvasFound.count : 0,
        noCanvasDetected: !!noCanvas
      }
    };
  });

  await browser.close();
  return result;
}

// ---- 통계 계산 ----
function calcStats(values) {
  if (values.length === 0) return { min: 0, max: 0, avg: 0, median: 0 };
  
  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  
  return { min, max, avg, median };
}

// ---- 메인 실행 ----
(async () => {
  console.log('🎯 PDF 렌더링 성능 벤치마크');
  console.log(`📊 측정 횟수: ${runs}회`);
  console.log(`🔧 CPU 스로틀: ${cpuThrottle}x`);
  console.log(`📜 스크롤: 느림=${scrollSlowDelay}ms, 빠름=${scrollFastDelay}ms\n`);

  const allResults = [];

  // 각 URL에 대해 측정
  for (let urlIdx = 0; urlIdx < urls.length; urlIdx++) {
    const url = urls[urlIdx];
    const name = names[urlIdx];

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📍 ${name}: ${url}`);
    console.log('='.repeat(60));

    const runResults = [];

    for (let run = 1; run <= runs; run++) {
      process.stdout.write(`  ⏳ Run ${run}/${runs}...`);
      
      const result = await measureRenderPerformance(url);
      runResults.push(result);

      process.stdout.write(` ✅\n`);
    }

    // 통계 계산
    const stats = {
      maxConcurrency: calcStats(runResults.map(r => r.maxConcurrency)),
      totalRenderCalls: calcStats(runResults.map(r => r.totalRenderCalls)),
      duplicateRenderCount: calcStats(runResults.map(r => r.duplicateRenderCount)),
      cancelledRenderCount: calcStats(runResults.map(r => r.cancelledRenderCount)),
      longTaskCount: calcStats(runResults.map(r => r.longTaskCount)),
      longTaskTotalMs: calcStats(runResults.map(r => r.longTaskTotalMs)),
      fetchDupCount: calcStats(runResults.map(r => r.fetchDupCount))
    };

    // 결과 저장
    allResults.push({
      url,
      name,
      runs: runResults,
      stats
    });

    // 콘솔 출력
    console.log('\n📊 측정 결과:');
    console.log(`  🔄 최대 동시 렌더링: ${stats.maxConcurrency.avg.toFixed(1)} (min: ${stats.maxConcurrency.min}, max: ${stats.maxConcurrency.max})`);
    console.log(`  📝 총 렌더 호출: ${stats.totalRenderCalls.avg.toFixed(1)} (min: ${stats.totalRenderCalls.min}, max: ${stats.totalRenderCalls.max})`);
    
    const dupPct = stats.totalRenderCalls.avg > 0 
      ? (stats.duplicateRenderCount.avg / stats.totalRenderCalls.avg * 100).toFixed(1)
      : '0.0';
    const cancelPct = stats.totalRenderCalls.avg > 0
      ? (stats.cancelledRenderCount.avg / stats.totalRenderCalls.avg * 100).toFixed(1)
      : '0.0';
    
    console.log(`  ⚠️  중복 렌더: ${stats.duplicateRenderCount.avg.toFixed(1)} (${dupPct}%)`);
    console.log(`  🚫 취소된 렌더: ${stats.cancelledRenderCount.avg.toFixed(1)} (${cancelPct}%)`);
    console.log(`  ⏱️  Long Task: ${stats.longTaskCount.avg.toFixed(1)}개, 총 ${stats.longTaskTotalMs.avg.toFixed(0)}ms`);
    console.log(`  🌐 중복 fetch: ${stats.fetchDupCount.avg.toFixed(1)}회`);
    
    // 디버그 정보 출력 (첫 run 기준)
    if (runResults.length > 0 && runResults[0].debugInfo) {
      const debug = runResults[0].debugInfo;
      console.log(`\n🔍 디버그 정보:`);
      console.log(`  - PDF.js 패치: ${debug.patchStatus} ${debug.patchStatus === 'OK' ? `(${debug.patchMethod})` : ''}`);
      console.log(`  - 스크롤 컨테이너: ${debug.scrollContainer}`);
      console.log(`  - 스크롤 높이: ${debug.scrollHeight}px`);
      console.log(`  - Canvas 발견 (스크롤 시): ${debug.canvasFoundAtScroll ? '✅' : '❌'}`);
      console.log(`  - 스크롤 이벤트: ${debug.scrollEvents}회`);
      console.log(`  - IntersectionObserver 트리거: ${debug.intersectionEvents}회`);
      
      if (debug.noCanvasDetected) {
        console.log(`\n⚠️  스크롤 중 Canvas를 찾을 수 없음`);
        console.log(`  💡 가능한 원인:`);
        console.log(`     - PDF가 아직 로드되지 않음 (초기 대기 시간 부족)`);
        console.log(`     - PDF 렌더링이 지연됨`);
        console.log(`     - 해당 페이지에 PDF가 없음`);
      }
      
      if (debug.patchStatus === 'FAILED') {
        console.log(`\n⚠️  PDF.js 패치 실패 상세:`);
        console.log(`  - 검색 시도: ${debug.searchAttempts}회`);
        console.log(`  - Canvas 요소 (패치 중): ${debug.canvasFoundDuringPatch}개`);
        if (debug.patchTimeout) {
          console.log(`  - 전체 Canvas: ${debug.patchTimeout.canvasCount}개`);
          console.log(`  - PDF 관련 요소: ${debug.patchTimeout.hasPDFElements ? '있음' : '없음'}`);
        }
        if (debug.availableKeys.length > 0) {
          console.log(`  - 사용 가능한 키: ${debug.availableKeys.join(', ')}`);
        }
        console.log(`\n💡 해결 방법:`);
        console.log(`  1. 개발 서버가 실행 중인지 확인`);
        console.log(`  2. 해당 페이지에 PDF가 있는지 확인`);
        console.log(`  3. PDF.js 로드 방식 확인 (ES module, webpack 등)`);
      }
    }
  }

  // 비교 출력 (2개 이상일 때)
  if (allResults.length >= 2) {
    console.log(`\n\n${'='.repeat(60)}`);
    console.log('📊 버전 비교');
    console.log('='.repeat(60));

    const baseline = allResults[0];
    
    for (let i = 1; i < allResults.length; i++) {
      const candidate = allResults[i];
      
      console.log(`\n${baseline.name} vs ${candidate.name}:`);
      
      const metrics = [
        { key: 'maxConcurrency', label: '최대 동시 렌더링', unit: '' },
        { key: 'totalRenderCalls', label: '총 렌더 호출', unit: '' },
        { key: 'duplicateRenderCount', label: '중복 렌더', unit: '' },
        { key: 'cancelledRenderCount', label: '취소된 렌더', unit: '' },
        { key: 'longTaskCount', label: 'Long Task 개수', unit: '' },
        { key: 'longTaskTotalMs', label: 'Long Task 총 시간', unit: 'ms' },
        { key: 'fetchDupCount', label: '중복 fetch', unit: '' }
      ];

      for (const metric of metrics) {
        const baseVal = baseline.stats[metric.key].avg;
        const candVal = candidate.stats[metric.key].avg;
        const diff = candVal - baseVal;
        const diffPct = baseVal !== 0 ? (diff / baseVal * 100) : 0;
        
        const emoji = diff < 0 ? '✅' : diff > 0 ? '❌' : '➡️';
        const sign = diff >= 0 ? '+' : '';
        
        console.log(`  ${emoji} ${metric.label}: ${candVal.toFixed(1)}${metric.unit} (${sign}${diff.toFixed(1)}, ${sign}${diffPct.toFixed(1)}%)`);
      }
    }
  }

  // 파일 저장
  if (saveResults) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `render-${timestamp}.json`;
    const outDir = path.join(__dirname, 'bench_out');
    
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    
    const outputPath = path.join(outDir, filename);
    
    const output = {
      timestamp: new Date().toISOString(),
      config: {
        runs,
        cpuThrottle,
        scrollSlowDelay,
        scrollFastDelay
      },
      results: allResults
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`\n\n💾 결과 저장: ${outputPath}`);
  }

  console.log('\n✨ 벤치마크 완료!\n');
})();

