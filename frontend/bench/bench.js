#!/usr/bin/env node
/**
 * bench.js — Puppeteer로 PDF/웹 성능 벤치마크 (web-vitals 통합)
 *
 * 사용 예:
 *   # PDF 파일 직접 측정
 *   node bench/bench.js --pdf "/public/sample4.pdf" --pages 12 --scale 1.5
 *
 *   # URL 모드 (Core Web Vitals + 성능 지표 + PDF 렌더 메트릭)
 *   node bench/bench.js --url "http://localhost:3000/feedback/4?version=pdf" --wait 7000 --simulateInteraction true
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');
const puppeteer = require('puppeteer');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  if (i === -1) return def;
  const next = process.argv[i + 1];
  // boolean flag (present without value)
  if (!next || next.startsWith('--')) return true;
  return next;
}

// ---- 설정 인자 ----
const targetUrl = arg('url', null); // 웹 페이지 URL (있으면 이걸 측정)
const pdfArg = arg('pdf', '/public/sample4.pdf');
const pages = parseInt(arg('pages', '12'), 10);
const scale = parseFloat(arg('scale', '1.5'));
const rootMargin = arg('rootMargin', '200px');
const threshold = parseFloat(arg('threshold', '0.05'));
const port = parseInt(arg('port', '3009'), 10);
const extraWait = parseInt(arg('wait', '6000'), 10); // URL 모드 안정화 대기(ms)
const simulateInteraction = String(arg('simulateInteraction', 'false')) === 'true'; // INP 유도

// ---- 경로 계산 ----
const benchDir = __dirname;                       // /frontend/bench
const projectRoot = path.resolve(benchDir, '..'); // /frontend
const outDir = path.join(benchDir, 'bench_out');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// ---- 간단 정적 서버 (PDF 모드) ----
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.htm':  'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map':  'application/json; charset=utf-8',
  '.pdf':  'application/pdf',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.txt':  'text/plain; charset=utf-8',
};

(async () => {
  let server = null;
  let testUrl = targetUrl;

  // PDF 모드: 서버 시작
  if (!targetUrl) {
    await new Promise((resolve) => server = http.createServer((req, res) => {
      const parsed = url.parse(req.url);
      let filePath = path.join(projectRoot, decodeURIComponent(parsed.pathname));
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }
      if (!filePath.startsWith(projectRoot)) {
        res.statusCode = 403; res.end('Forbidden'); return;
      }
      fs.readFile(filePath, (err, data) => {
        if (err) { res.statusCode = 404; res.end('Not Found: ' + filePath); return; }
        const ext = path.extname(filePath).toLowerCase();
        res.setHeader('Content-Type', mime[ext] || 'application/octet-stream');
        res.end(data);
      });
    }).listen(port, resolve));

    const baseUrl = `http://localhost:${port}`;
    testUrl = `${baseUrl}/bench/harness.html` +
      `?pdf=${encodeURIComponent(pdfArg)}` +
      `&pages=${pages}` +
      `&scale=${scale}` +
      `&rootMargin=${encodeURIComponent(rootMargin)}` +
      `&threshold=${threshold}`;
  }

  // Headless 브라우저 실행
  const browser = await puppeteer.launch({
    headless: 'new',
    defaultViewport: { width: 1280, height: 1000 },
    args: ['--disable-dev-shm-usage', '--no-sandbox'],
  });
  const page = await browser.newPage();

  // 브라우저 콘솔을 터미널로 포워딩
  page.on('console', (msg) => console.log('[page]', msg.text()));

  // 리소스 로딩 실패 에러를 캡처
  page.on('response', response => {
    if (response.status() >= 400) {
      console.log(`[ERROR] ${response.status()} - ${response.url()}`);
    }
  });

  console.log('[runner] Open:', testUrl);

  // URL 모드인 경우: 측정/브리지 초기화 (탐색 전)
  if (targetUrl) {


        // PATCH START: web-vitals local injection with CDN fallback
    try {
      const webVitalsPath = require.resolve('web-vitals/dist/web-vitals.attribution.iife.js');
      await page.addScriptTag({ path: webVitalsPath });
      console.log('[runner] web-vitals loaded from local file');
    } catch (e) {
      console.warn('[runner] local web-vitals load failed, fallback to CDN:', e?.message);
      await page.addScriptTag({ url: 'https://unpkg.com/web-vitals@4/dist/web-vitals.attribution.iife.js' });
    }
    // PATCH END

    // 탐색 전 evaluateOnNewDocument: 브리지/옵저버/스토리지
    await page.evaluateOnNewDocument(() => {
      // 결과 저장소
      window.__WV = {};          // web-vitals 공식 값: {FCP,LCP,CLS,INP,TTFB}
      window.__WV_ATTRIBUTION = {}; // attribution 상세 정보
      window.__RAW = {};         // 네이티브 엔트리 기반 보조값
      window.__LONG_TASKS = [];  // Long Tasks 저장 (TBT 계산용)
      window.__FCP = null;       // FCP 시점 저장
      window.__TTI = null;       // TTI 시점 저장
      window.__TBT_OFFICIAL = 0; // 공식 TBT (Long Tasks 기반 실시간 계산)
      window.pdfRenderMetrics = [];
      window.scrollMetrics = {
        fps: [],               // 스크롤 중 FPS
        frameDrops: 0,         // 프레임 드롭 횟수
        scrollEvents: 0,       // 스크롤 이벤트 횟수
        longTasksDuringScroll: 0, // 스크롤 중 Long Tasks
        renderEventsDuringScroll: [], // 스크롤 중 렌더링된 페이지
      };
      window.pdfRenderMetricsCollector = {
        add: (metric) => {
          window.pdfRenderMetrics.push({ ...metric, timestamp: performance.now() });
          window.scrollMetrics.renderEventsDuringScroll.push({
            page: metric.page,
            timestamp: performance.now(),
            totalMs: metric.totalMs
          });
        }
      };

      // Long Tasks 수집 (나중에 FCP~TTI 구간 필터링)
      try {
        const ltObserver = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            window.__LONG_TASKS.push({
              startTime: e.startTime,
              duration: e.duration
            });
          }
        });
        ltObserver.observe({ type: 'longtask', buffered: true });
      } catch (_) {}

      // web-vitals 구독 (즉시 시작 - 이벤트 놓치지 않기)
      const initWebVitals = () => {
        const on = window.webVitals;
        if (!on) {
          // web-vitals 로드 대기 후 재시도
          setTimeout(initWebVitals, 100);
          return;
        }
        const set = (k, v) => { window.__WV[k] = v; };
        const setAttr = (k, v) => { window.__WV_ATTRIBUTION[k] = v; };
        
        try {
          // FCP with attribution
          on.onFCP((metric) => {
            set('FCP', metric.value);
            window.__FCP = metric.value;
            if (metric.attribution) {
              setAttr('FCP', {
                timeToFirstByte: metric.attribution.timeToFirstByte,
                firstByteToFCP: metric.attribution.firstByteToFCP,
                loadState: metric.attribution.loadState,
                navigationEntry: metric.attribution.navigationEntry?.toJSON?.() || null
              });
            }
          }, { reportAllChanges: true });
          
          // LCP with attribution
          on.onLCP((metric) => {
            set('LCP', metric.value);
            if (metric.attribution) {
              setAttr('LCP', {
                element: metric.attribution.element?.tagName || null,
                url: metric.attribution.url || null,
                timeToFirstByte: metric.attribution.timeToFirstByte,
                resourceLoadDelay: metric.attribution.resourceLoadDelay,
                resourceLoadDuration: metric.attribution.resourceLoadDuration,
                elementRenderDelay: metric.attribution.elementRenderDelay
              });
            }
          }, { reportAllChanges: true });
          
          // CLS with attribution
          on.onCLS((metric) => {
            set('CLS', metric.value);
            if (metric.attribution) {
              setAttr('CLS', {
                largestShiftTarget: metric.attribution.largestShiftTarget,
                largestShiftValue: metric.attribution.largestShiftValue,
                largestShiftTime: metric.attribution.largestShiftTime,
                loadState: metric.attribution.loadState
              });
            }
          }, { reportAllChanges: true });
          
          // INP with attribution
          on.onINP((metric) => {
            set('INP', metric.value);
            if (metric.attribution) {
              setAttr('INP', {
                eventTarget: metric.attribution.eventTarget,
                eventType: metric.attribution.eventType,
                loadState: metric.attribution.loadState,
                inputDelay: metric.attribution.inputDelay,
                processingDuration: metric.attribution.processingDuration,
                presentationDelay: metric.attribution.presentationDelay
              });
            }
          }, { reportAllChanges: true });
          
          // TTFB with attribution
          on.onTTFB((metric) => {
            set('TTFB', metric.value);
            if (metric.attribution) {
              setAttr('TTFB', {
                waitingDuration: metric.attribution.waitingDuration,
                cacheDuration: metric.attribution.cacheDuration,
                dnsDuration: metric.attribution.dnsDuration,
                connectionDuration: metric.attribution.connectionDuration,
                requestDuration: metric.attribution.requestDuration
              });
            }
          });
        } catch (e) {
          console.error('[web-vitals] Error:', e);
        }
      };
      
      // 즉시 실행 (DOMContentLoaded 기다리지 않음)
      initWebVitals();

      // raw 보조값 준비: paint/nav entries는 수집 시점에 읽음
      // LCP raw 보조(옵셔널)
      try {
        let _lcp = 0;
        const lcpObs = new PerformanceObserver((list) => {
          const last = list.getEntries().at(-1);
          _lcp = (last && (last.renderTime || last.loadTime)) || _lcp;
          window.__RAW.lcp = _lcp;
        });
        lcpObs.observe({ type: 'largest-contentful-paint', buffered: true });
      } catch (_) {}
      // CLS raw 보조
      try {
        let cls = 0;
        const clsObs = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) if (!e.hadRecentInput) cls += e.value;
          window.__RAW.cls = cls;
        });
        clsObs.observe({ type: 'layout-shift', buffered: true });
      } catch (_) {}
      // INP raw 보조(최대 duration)
      try {
        let maxDur = null;
        const inpObs = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            if (maxDur == null || e.duration > maxDur) maxDur = e.duration;
          }
          window.__RAW.inp = maxDur;
        });
        inpObs.observe({ type: 'event', buffered: true, durationThreshold: 16 });
      } catch (_) {}
    });
  }

  const startTime = Date.now();
  await page.goto(testUrl, { waitUntil: ['networkidle0', 'domcontentloaded'], timeout: 60000 });

  // URL 모드: INP 유도를 위한 가벼운 상호작용 (옵션)
  if (targetUrl && simulateInteraction) {
    try {
      await page.evaluate(() => {
        // 클릭/키보드 synthetic 이벤트로 event entries 생성
        const clickTarget = document.elementFromPoint(innerWidth / 2, innerHeight / 2) || document.body;
        clickTarget.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
      });
    } catch {}
  }

  // 사용자 스크롤 시뮬레이션 (PDF lazy 렌더/IO 우발성 줄이기)
  async function autoScroll() {
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let scrollContainer = document.body;
        const mainContent = document.querySelector('.w-full.md\\:w-2\\/3');
        if (mainContent) {
          const scrollableInMain = mainContent.querySelector('.overflow-y-auto, .overflow-auto');
          if (scrollableInMain) {
            scrollContainer = scrollableInMain;
            console.log('📜 PDF 컨테이너 찾음:', scrollContainer.className);
          } else {
            console.log('📜 전체 페이지 스크롤 사용');
          }
        } else {
          console.log('📜 메인 컨텐츠를 찾을 수 없음, body 스크롤 사용');
        }

        const maxScroll = scrollContainer === document.body
          ? document.body.scrollHeight
          : scrollContainer.scrollHeight;

        console.log(`📏 스크롤 가능 높이: ${maxScroll}px / viewport: ${window.innerHeight}px`);
        
        // 스크롤 성능 측정 시작
        window.scrollMetrics.scrollStartTime = performance.now();
        let lastFrameTime = performance.now();
        let frameCount = 0;
        
        // FPS 측정 (스크롤 중 프레임 성능)
        const measureFPS = () => {
          const now = performance.now();
          const delta = now - lastFrameTime;
          const fps = 1000 / delta;
          
          window.scrollMetrics.fps.push(fps);
          if (fps < 30) {
            window.scrollMetrics.frameDrops++;
          }
          
          lastFrameTime = now;
          frameCount++;
        };
        
        // 스크롤 이벤트 리스너
        let scrolling = false;
        const scrollListener = () => {
          window.scrollMetrics.scrollEvents++;
          if (!scrolling) {
            scrolling = true;
            requestAnimationFrame(() => {
              measureFPS();
              scrolling = false;
            });
          }
        };
        window.addEventListener('scroll', scrollListener, { passive: true });
        
        // 실제 사용자 스크롤 패턴 시뮬레이션: 스크롤 → 멈춤(읽기) → 스크롤 → 멈춤
        // 이렇게 해야 IntersectionObserver가 페이지를 감지하고 렌더링함
        const scrollStep = 800; // 한 번에 800px (약 1페이지 분량)
        const pauseTime = 1500; // 1.5초 멈춤 (페이지 렌더링 시간)
        const targetScroll = Math.max(maxScroll * 4, 30000); // 충분히 스크롤
        let total = 0;
        let lastRenderedCount = 0;
        let scrollCount = 0;

        const step = async () => {
          // 스크롤 실행 (부드럽게 애니메이션)
          const currentPos = scrollContainer === document.body ? window.scrollY : scrollContainer.scrollTop;
          const targetPos = currentPos + scrollStep;
          
          // 부드러운 스크롤 애니메이션 (10단계로 나눔)
          for (let i = 1; i <= 10; i++) {
            const pos = currentPos + (scrollStep * i / 10);
            if (scrollContainer === document.body) {
              window.scrollTo(0, pos);
            } else {
              scrollContainer.scrollTop = pos;
            }
            // 스크롤 이벤트 수동 트리거
            window.dispatchEvent(new Event('scroll'));
            await new Promise(r => requestAnimationFrame(r));
          }
          
          total += scrollStep;
          scrollCount++;
          
          // 스크롤 후 잠시 멈춤 (IntersectionObserver와 렌더링 대기)
          await new Promise(r => setTimeout(r, pauseTime));
          
          // 실제 렌더링된 페이지 확인
          const currentMetrics = (window.pdfRenderMetrics || []).length;
          if (currentMetrics > lastRenderedCount) {
            console.log(`📄 PDF 렌더링: ${lastRenderedCount + 1}→${currentMetrics}개 완료 (스크롤: ${total}px)`);
            lastRenderedCount = currentMetrics;
          }
          
          if (scrollCount % 5 === 0) {
            const canvases = document.querySelectorAll('canvas').length;
            console.log(`📍 진행: ${scrollCount}회 스크롤, ${total}px / ${targetScroll}px | 렌더링: ${currentMetrics}개`);
          }
          
          if (total < targetScroll) {
            await step(); // 재귀 호출
          } else {
            window.removeEventListener('scroll', scrollListener);
            
            const finalMetrics = (window.pdfRenderMetrics || []).length;
            window.scrollMetrics.scrollEndTime = performance.now();
            window.scrollMetrics.totalScrollTime = window.scrollMetrics.scrollEndTime - window.scrollMetrics.scrollStartTime;
            
            // FPS 통계 계산
            if (window.scrollMetrics.fps.length > 0) {
              const avgFps = window.scrollMetrics.fps.reduce((a, b) => a + b, 0) / window.scrollMetrics.fps.length;
              const minFps = Math.min(...window.scrollMetrics.fps);
              window.scrollMetrics.avgFps = avgFps;
              window.scrollMetrics.minFps = minFps;
            }
            
            console.log(`✅ 스크롤 완료 - ${scrollCount}회, ${total}px, ${finalMetrics}개 페이지 렌더링`);
            console.log(`   FPS: 평균 ${window.scrollMetrics.avgFps?.toFixed(1) || 'N/A'}, 최소 ${window.scrollMetrics.minFps?.toFixed(1) || 'N/A'}, 드롭 ${window.scrollMetrics.frameDrops}회`);
            
            // 마지막 페이지들 렌더링 대기
            setTimeout(resolve, 3000);
          }
        };
        step();
      });
    });
  }
  await autoScroll();

  // SPA 안정화/지연 로딩 대기
  if (targetUrl && extraWait > 0) {
    await new Promise(resolve => setTimeout(resolve, extraWait));
  }

  // (옵션) PDF 페이지 캔버스 수가 충분한지 살짝 더 기다림
  if (targetUrl) {
    try {
      await page.waitForFunction(
        `document.querySelectorAll('canvas').length >= 1`,
        { timeout: 2000 }
      );
    } catch {}
  }

  let results;

  if (targetUrl) {
    // ========== Web Vitals + 커스텀 메트릭 수집 (먼저 실행) ==========
    console.log('\n[Web Vitals] 측정 시작...');
    const metrics = await page.evaluate(() => {
      const data = {};

      // navigation/paint entries (raw 보조)
      const nav = performance.getEntriesByType('navigation')[0];
      const firstPaint = performance.getEntriesByType('paint').find(e => e.name === 'first-paint');
      const fcpPaint   = performance.getEntriesByType('paint').find(e => e.name === 'first-contentful-paint');

      if (nav) {
        data.ttfb = nav.responseStart - nav.requestStart; // ms
        data.loadTime = nav.loadEventEnd - nav.fetchStart;
        data.domContentLoaded = nav.domContentLoadedEventEnd - nav.fetchStart;
        data.domInteractive = nav.domInteractive - nav.fetchStart;
      }
      data.firstPaint = firstPaint ? firstPaint.startTime : undefined;
      data.firstContentfulPaint = fcpPaint ? fcpPaint.startTime : undefined;

      // RAW 보조/ WV 공식 값 / Attribution
      data.raw = Object.assign({}, window.__RAW);
      data.webVitals = Object.assign({}, window.__WV);
      data.webVitalsAttribution = Object.assign({}, window.__WV_ATTRIBUTION);
      
      // web-vitals 값이 없으면 raw 값으로 폴백
      if (!data.webVitals.LCP && data.raw.lcp) {
        data.webVitals.LCP = data.raw.lcp;
      }
      if (!data.webVitals.CLS && data.raw.cls != null) {
        data.webVitals.CLS = data.raw.cls;
      }
      if (!data.webVitals.FCP && data.firstContentfulPaint) {
        data.webVitals.FCP = data.firstContentfulPaint;
      }
      if (!data.webVitals.INP && data.raw.inp) {
        data.webVitals.INP = data.raw.inp;
      }

      // TTI(추정): 공식 TTI 알고리즘 근사
      // 1. FCP 이후 5초 조용한 창(quiet window) 찾기 - Long Task 없는 구간
      // 2. 마지막 Long Task 이후 + 네트워크가 조용해지는 시점
      const longTasks = performance.getEntriesByType('longtask');
      const fcp = window.__FCP || data.firstContentfulPaint;
      
      let tti = null;
      if (fcp != null) {
        if (longTasks && longTasks.length > 0) {
          // FCP 이후의 Long Tasks만 필터링
          const tasksAfterFCP = longTasks.filter(t => t.startTime >= fcp);
          
          if (tasksAfterFCP.length > 0) {
            // 마지막 Long Task의 종료 시점
            const lastTask = tasksAfterFCP[tasksAfterFCP.length - 1];
            tti = lastTask.startTime + lastTask.duration;
            
            // 5초 조용한 창 확인 (간소화: 마지막 Long Task + 50ms)
            tti = Math.max(tti, fcp + 50);
          } else {
            // FCP 이후 Long Task 없음
            tti = fcp;
          }
        } else {
          // Long Task 자체가 없음
          tti = fcp;
        }
      } else {
        // FCP 없으면 domInteractive 사용
        tti = data.domInteractive ?? null;
      }
      
      data.tti = tti;
      window.__TTI = tti;

      // TBT 공식 계산: FCP~TTI 구간의 Long Tasks (Lighthouse 방식)
      data.tbt = 0;
      data.tbtOfficial = 0;
      
      if (fcp != null && tti != null && window.__LONG_TASKS && window.__LONG_TASKS.length > 0) {
        // FCP~TTI 구간과 겹치는 Long Tasks 필터링
        const tasksInRange = window.__LONG_TASKS.filter(task => {
          const taskEnd = task.startTime + task.duration;
          return taskEnd > fcp && task.startTime < tti;
        });
        
        // TBT 계산: 각 Long Task에서 50ms를 초과하는 부분만 합산
        data.tbt = tasksInRange.reduce((sum, task) => {
          const taskEnd = task.startTime + task.duration;
          
          // FCP~TTI 구간에 실제로 겹치는 부분만 계산
          const overlapStart = Math.max(task.startTime, fcp);
          const overlapEnd = Math.min(taskEnd, tti);
          const overlapDuration = overlapEnd - overlapStart;
          
          // 50ms 임계값 초과 시간만 blocking time으로 계산 (Lighthouse TBT 공식)
          const blockingTime = Math.max(0, overlapDuration - 50);
          return sum + blockingTime;
        }, 0);
        
        // 공식 TBT와 동일
        data.tbtOfficial = data.tbt;
        
        // 디버깅 정보
        data.tbtDebug = {
          fcp: fcp,
          fcpSource: window.__FCP ? 'web-vitals' : 'raw',
          tti: tti,
          totalLongTasks: window.__LONG_TASKS.length,
          tasksInFcpTtiRange: tasksInRange.length,
          tbtCalculated: data.tbt,
          method: 'Lighthouse-compliant (FCP to TTI, >50ms tasks)',
          allLongTasks: window.__LONG_TASKS.map(t => ({
            start: t.startTime.toFixed(1),
            duration: t.duration.toFixed(1),
            end: (t.startTime + t.duration).toFixed(1)
          })),
          tasks: tasksInRange.map(t => ({
            start: t.startTime.toFixed(1),
            duration: t.duration.toFixed(1),
            end: (t.startTime + t.duration).toFixed(1),
            blocking: Math.max(0, t.duration - 50).toFixed(1)
          }))
        };
      } else {
        data.tbtDebug = {
          fcp: fcp,
          fcpSource: window.__FCP ? 'web-vitals' : (data.firstContentfulPaint ? 'raw' : 'none'),
          tti: tti,
          totalLongTasks: window.__LONG_TASKS?.length || 0,
          tasksInFcpTtiRange: 0,
          tbtCalculated: 0,
          method: 'No Long Tasks or missing FCP/TTI',
          allLongTasks: (window.__LONG_TASKS || []).map(t => ({
            start: t.startTime.toFixed(1),
            duration: t.duration.toFixed(1),
            end: (t.startTime + t.duration).toFixed(1)
          }))
        };
      }
      
      // 스크롤 성능 메트릭
      data.scrollMetrics = window.scrollMetrics || {};

      // PDF 렌더 메트릭 (앱에서 window.pdfRenderMetricsCollector.add(...)로 보고)
      data.pdfRenderMetrics = Array.isArray(window.pdfRenderMetrics) ? window.pdfRenderMetrics : [];
      
      // ============ 추가 웹 바이탈 지표 ============
      
      // 1. Resource Timing (리소스 로딩 성능)
      data.resources = {};
      const resources = performance.getEntriesByType('resource');
      const resourcesByType = {
        script: [],
        stylesheet: [],
        img: [],
        fetch: [],
        xmlhttprequest: [],
        other: []
      };
      
      resources.forEach(r => {
        const type = r.initiatorType || 'other';
        const duration = r.responseEnd - r.startTime;
        if (!resourcesByType[type]) resourcesByType[type] = [];
        resourcesByType[type].push({
          name: r.name.split('/').pop(),
          duration: duration,
          size: r.transferSize || 0,
        });
      });
      
      // 각 타입별 통계
      Object.keys(resourcesByType).forEach(type => {
        const items = resourcesByType[type];
        if (items.length > 0) {
          const durations = items.map(i => i.duration);
          const sizes = items.map(i => i.size);
          data.resources[type] = {
            count: items.length,
            avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
            maxDuration: Math.max(...durations),
            totalSize: sizes.reduce((a, b) => a + b, 0),
          };
        }
      });
      
      // 2. Memory Metrics (메모리 사용량)
      if (performance.memory) {
        data.memory = {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
          usedPercent: (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit * 100).toFixed(2),
        };
      }
      
      // 3. Layout Shift 상세 정보
      const layoutShifts = performance.getEntriesByType('layout-shift') || [];
      if (layoutShifts.length > 0) {
        data.layoutShifts = {
          count: layoutShifts.length,
          totalScore: layoutShifts.reduce((sum, e) => sum + (e.value || 0), 0),
          maxShift: Math.max(...layoutShifts.map(e => e.value || 0)),
          avgShift: layoutShifts.reduce((sum, e) => sum + (e.value || 0), 0) / layoutShifts.length,
        };
      }
      
      // 4. Long Animation Frames (LoAF) - 최신 브라우저
      try {
        const loafs = performance.getEntriesByType('long-animation-frame') || [];
        if (loafs.length > 0) {
          data.longAnimationFrames = {
            count: loafs.length,
            totalDuration: loafs.reduce((sum, e) => sum + e.duration, 0),
            maxDuration: Math.max(...loafs.map(e => e.duration)),
            avgDuration: loafs.reduce((sum, e) => sum + e.duration, 0) / loafs.length,
          };
        }
      } catch (e) {}
      
      // 5. Network Information
      if (navigator.connection) {
        data.networkInfo = {
          effectiveType: navigator.connection.effectiveType,
          downlink: navigator.connection.downlink,
          rtt: navigator.connection.rtt,
          saveData: navigator.connection.saveData,
        };
      }
      
      // 6. Device Memory
      if (navigator.deviceMemory) {
        data.deviceMemory = navigator.deviceMemory; // GB
      }
      
      // 7. Hardware Concurrency
      data.hardwareConcurrency = navigator.hardwareConcurrency || null;
      
      // 8. User Timing (커스텀 마크)
      const userMarks = performance.getEntriesByType('mark');
      const userMeasures = performance.getEntriesByType('measure');
      if (userMarks.length > 0 || userMeasures.length > 0) {
        data.userTiming = {
          marks: userMarks.map(m => ({ name: m.name, time: m.startTime })),
          measures: userMeasures.map(m => ({ name: m.name, duration: m.duration })),
        };
      }
      
      // 9. 렌더 블로킹 리소스 (CSS, 동기 스크립트)
      const renderBlocking = resources.filter(r => 
        r.renderBlockingStatus === 'blocking' || 
        (r.initiatorType === 'link' && r.name.includes('.css'))
      );
      if (renderBlocking.length > 0) {
        data.renderBlockingResources = {
          count: renderBlocking.length,
          totalDuration: renderBlocking.reduce((sum, r) => sum + (r.responseEnd - r.startTime), 0),
        };
      }
      
      // 10. Speed Index 근사값 (paint entries 기반)
      const paints = performance.getEntriesByType('paint');
      if (paints.length > 0) {
        data.speedIndex = {
          firstPaint: paints.find(p => p.name === 'first-paint')?.startTime || 0,
          firstContentfulPaint: paints.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
        };
      }

      return data;
    });

    console.log('[Web Vitals] 완료');
    
    // ========== Lighthouse 실행 (정확한 TBT, TTI, Speed Index) ==========
    console.log('\n[Lighthouse] 측정 시작...');
    
    let lighthouseResults = null;
    try {
      // Lighthouse를 dynamic import로 로드 (ESM 호환)
      const { default: lighthouse } = await import('lighthouse');
      
      // 새 페이지로 Lighthouse 측정 (독립 실행)
      const lighthouseOptions = {
        logLevel: 'error',
        output: 'json',
        onlyCategories: ['performance'],
        disableStorageReset: true,
      };
      
      const runnerResult = await lighthouse(testUrl, lighthouseOptions);
      
      if (runnerResult && runnerResult.lhr) {
        const lhr = runnerResult.lhr;
        const audits = lhr.audits;
        
        lighthouseResults = {
          performanceScore: lhr.categories.performance.score * 100,
          metrics: {
            // 정확한 Lighthouse 지표
            firstContentfulPaint: audits['first-contentful-paint']?.numericValue,
            largestContentfulPaint: audits['largest-contentful-paint']?.numericValue,
            totalBlockingTime: audits['total-blocking-time']?.numericValue,
            cumulativeLayoutShift: audits['cumulative-layout-shift']?.numericValue,
            speedIndex: audits['speed-index']?.numericValue,
            interactive: audits['interactive']?.numericValue, // 정확한 TTI
            
            // 추가 Lighthouse 지표
            firstMeaningfulPaint: audits['first-meaningful-paint']?.numericValue,
            maxPotentialFID: audits['max-potential-fid']?.numericValue,
            serverResponseTime: audits['server-response-time']?.numericValue,
          },
          diagnostics: {
            mainThreadWorkBreakdown: audits['mainthread-work-breakdown']?.details?.items || [],
            bootupTime: audits['bootup-time']?.details?.items || [],
            networkRequests: audits['network-requests']?.details?.items?.length || 0,
            totalByteWeight: audits['total-byte-weight']?.numericValue,
            domSize: audits['dom-size']?.numericValue,
          }
        };
        
        console.log(`[Lighthouse] 완료 - Performance Score: ${lighthouseResults.performanceScore.toFixed(1)}`);
      }
    } catch (err) {
      console.error('[Lighthouse] 실행 실패:', err.message);
    }

    const endTime = Date.now();
    results = {
      url: testUrl,
      totalTime: endTime - startTime,
      metrics,
      lighthouse: lighthouseResults // Lighthouse 공식 지표
    };
  } else {
    // PDF 모드: 기존 방식 (harness.html 에서 window.benchResults 채워야 함)
    await page.waitForFunction(
      'window.benchResults && window.benchResults.metrics && window.benchResults.metrics.length > 0',
      { timeout: 0 }
    );
    results = await page.evaluate(() => window.benchResults);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(outDir, `results-${stamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
  console.log(`\nSaved: ${jsonPath}`);

  if (targetUrl) {
    const m = results.metrics;
    const WV = m.webVitals || {};
    const LH = results.lighthouse;
    
    console.log('\n=== Performance Metrics Summary ===');
    
    // Lighthouse Performance Score
    if (LH && LH.performanceScore != null) {
      console.log('\n🎯 Lighthouse Performance Score:', LH.performanceScore.toFixed(1) + '/100',
        LH.performanceScore >= 90 ? '✅' : LH.performanceScore >= 50 ? '⚠️' : '❌');
    }

    console.log('\n📊 Core Web Vitals (web-vitals 공식 + Attribution):');
    console.log('  - FCP:', WV.FCP != null ? WV.FCP.toFixed(1) + 'ms' : 'N/A');
    if (m.webVitalsAttribution?.FCP) {
      const attr = m.webVitalsAttribution.FCP;
      console.log(`      TTFB: ${attr.timeToFirstByte?.toFixed(1) || 'N/A'}ms, TTFB→FCP: ${attr.firstByteToFCP?.toFixed(1) || 'N/A'}ms`);
    }
    
    console.log('  - LCP:', WV.LCP != null ? WV.LCP.toFixed(1) + 'ms' : 'N/A',
      WV.LCP != null ? (WV.LCP < 2500 ? '✅' : WV.LCP < 4000 ? '⚠️' : '❌') : '');
    if (m.webVitalsAttribution?.LCP) {
      const attr = m.webVitalsAttribution.LCP;
      console.log(`      Element: ${attr.element || 'N/A'}, Resource Load: ${attr.resourceLoadDuration?.toFixed(1) || 'N/A'}ms`);
      console.log(`      Render Delay: ${attr.elementRenderDelay?.toFixed(1) || 'N/A'}ms`);
    }
    
    console.log('  - CLS:', WV.CLS != null ? WV.CLS.toFixed(3) : 'N/A',
      WV.CLS != null ? (WV.CLS < 0.1 ? '✅' : WV.CLS < 0.25 ? '⚠️' : '❌') : '');
    if (m.webVitalsAttribution?.CLS) {
      const attr = m.webVitalsAttribution.CLS;
      console.log(`      Largest Shift: ${attr.largestShiftValue?.toFixed(3) || 'N/A'} at ${attr.largestShiftTime?.toFixed(1) || 'N/A'}ms`);
    }
    
    console.log('  - INP:', WV.INP != null ? WV.INP.toFixed(1) + 'ms' : 'N/A',
      WV.INP != null ? (WV.INP < 200 ? '✅' : WV.INP < 500 ? '⚠️' : '❌') : '');
    if (m.webVitalsAttribution?.INP) {
      const attr = m.webVitalsAttribution.INP;
      console.log(`      Event: ${attr.eventType || 'N/A'} on ${attr.eventTarget || 'N/A'}`);
      console.log(`      Input Delay: ${attr.inputDelay?.toFixed(1) || 'N/A'}ms, Processing: ${attr.processingDuration?.toFixed(1) || 'N/A'}ms, Presentation: ${attr.presentationDelay?.toFixed(1) || 'N/A'}ms`);
    }
    
    console.log('  - TTFB:', WV.TTFB != null ? WV.TTFB.toFixed(1) + 'ms' : 'N/A',
      WV.TTFB != null ? (WV.TTFB < 800 ? '✅' : '⚠️') : '');
    if (m.webVitalsAttribution?.TTFB) {
      const attr = m.webVitalsAttribution.TTFB;
      console.log(`      DNS: ${attr.dnsDuration?.toFixed(1) || 'N/A'}ms, Connection: ${attr.connectionDuration?.toFixed(1) || 'N/A'}ms, Request: ${attr.requestDuration?.toFixed(1) || 'N/A'}ms`);
    }

    console.log('\n⚡ Loading (raw 보조):');
    console.log('  - FP:', m.firstPaint != null ? m.firstPaint.toFixed(1) + 'ms' : 'N/A');
    console.log('  - FCP:', m.firstContentfulPaint != null ? m.firstContentfulPaint.toFixed(1) + 'ms' : 'N/A');
    console.log('  - DOM Interactive:', m.domInteractive != null ? m.domInteractive.toFixed(1) + 'ms' : 'N/A');
    console.log('  - DOM Content Loaded:', m.domContentLoaded != null ? m.domContentLoaded.toFixed(1) + 'ms' : 'N/A');
    console.log('  - Load Complete:', m.loadTime != null ? m.loadTime.toFixed(1) + 'ms' : 'N/A');

    console.log('\n🔄 Interactivity & Performance:');
    
    // Lighthouse 공식 지표 (있으면 우선 표시)
    if (LH && LH.metrics) {
      console.log('  🏆 Lighthouse 공식 지표:');
      if (LH.metrics.interactive != null) {
        console.log('    - TTI (Lighthouse):', (LH.metrics.interactive).toFixed(1) + 'ms',
          LH.metrics.interactive < 3800 ? '✅' : LH.metrics.interactive < 7300 ? '⚠️' : '❌');
      }
      if (LH.metrics.totalBlockingTime != null) {
        console.log('    - TBT (Lighthouse):', (LH.metrics.totalBlockingTime).toFixed(1) + 'ms',
          LH.metrics.totalBlockingTime < 200 ? '✅' : LH.metrics.totalBlockingTime < 600 ? '⚠️' : '❌');
      }
      if (LH.metrics.speedIndex != null) {
        console.log('    - Speed Index (Lighthouse):', (LH.metrics.speedIndex).toFixed(1) + 'ms',
          LH.metrics.speedIndex < 3400 ? '✅' : LH.metrics.speedIndex < 5800 ? '⚠️' : '❌');
      }
      if (LH.metrics.firstMeaningfulPaint != null) {
        console.log('    - FMP (Lighthouse):', (LH.metrics.firstMeaningfulPaint).toFixed(1) + 'ms');
      }
    }
    
    // 커스텀 계산 값 (참고용)
    if (m.tti != null || m.tbtOfficial != null) {
      console.log('  📊 커스텀 계산 (참고):');
      if (m.tti != null) {
        console.log('    - TTI (estimate):', m.tti.toFixed(1) + 'ms',
          m.tti < 3800 ? '✅' : m.tti < 7300 ? '⚠️' : '❌');
      }
      if (m.tbtOfficial != null) {
        console.log('    - TBT (custom):', m.tbtOfficial.toFixed(1) + 'ms',
          m.tbtOfficial < 200 ? '✅' : m.tbtOfficial < 600 ? '⚠️' : '❌');
      }
    }
    
    // TBT 디버깅 정보
    if (m.tbtDebug) {
      console.log('    📊 TBT 계산 상세:');
      console.log(`      - Method: ${m.tbtDebug.method || 'N/A'}`);
      console.log(`      - FCP: ${m.tbtDebug.fcp?.toFixed(1) || 'N/A'}ms (출처: ${m.tbtDebug.fcpSource || 'N/A'})`);
      console.log(`      - TTI: ${m.tbtDebug.tti?.toFixed(1) || 'N/A'}ms`);
      console.log(`      - 전체 Long Tasks: ${m.tbtDebug.totalLongTasks}개`);
      console.log(`      - FCP~TTI 구간과 겹치는 Long Tasks: ${m.tbtDebug.tasksInFcpTtiRange}개`);
      console.log(`      - 계산된 TBT: ${m.tbtDebug.tbtCalculated?.toFixed(1) || 'N/A'}ms`);
      
      // 모든 Long Tasks 표시 (디버깅용)
      if (m.tbtDebug.allLongTasks && m.tbtDebug.allLongTasks.length > 0 && m.tbtDebug.tasksInFcpTtiRange === 0) {
        console.log(`      - 모든 Long Tasks (FCP 밖):`);
        m.tbtDebug.allLongTasks.slice(0, 3).forEach((t, i) => {
          console.log(`        Task ${i+1}: ${t.start}ms ~ ${t.end}ms (duration: ${t.duration}ms)`);
        });
      }
      
      if (m.tbtDebug.tasks && m.tbtDebug.tasks.length > 0) {
        console.log(`      - FCP~TTI 구간 Long Tasks (최대 5개):`);
        m.tbtDebug.tasks.slice(0, 5).forEach((t, i) => {
          console.log(`        Task ${i+1}: ${t.start}ms ~ ${t.end}ms (duration: ${t.duration}ms, blocking: ${t.blocking}ms)`);
        });
        if (m.tbtDebug.tasks.length > 5) {
          console.log(`        ... and ${m.tbtDebug.tasks.length - 5} more tasks`);
        }
      }
    }

    if (m.pdfRenderMetrics && m.pdfRenderMetrics.length > 0) {
      console.log('\n📄 PDF Rendering Performance (app-reported):');
      const arr = m.pdfRenderMetrics;
      const n = arr.length;
      const avg = (k) => arr.reduce((s, x) => s + ((x[k] || 0)), 0) / n;
      const slowest = arr.reduce((max, x) => ((x.totalMs || 0) > (max.totalMs || 0) ? x : max), arr[0] || {});
      console.log(`  Total pages rendered: ${n}`);
      console.log('  Averages per page:');
      console.log(`    - getPage: ${(avg('getPageMs')).toFixed(1)}ms`);
      console.log(`    - render : ${(avg('renderMs')).toFixed(1)}ms`);
      console.log(`    - paint  : ${(avg('paintMs')).toFixed(1)}ms`);
      console.log(`    - total  : ${(avg('totalMs')).toFixed(1)}ms`);
      if (slowest) {
        console.log(`  Slowest page: ${slowest.page ?? 'N/A'} (${(slowest.totalMs || 0).toFixed(1)}ms)`);
      }
      console.log('\n  First 5 pages details:');
      arr.slice(0, 5).forEach(m =>
        console.log(`    Page ${m.page}: getPage=${(m.getPageMs || 0).toFixed(1)}ms, render=${(m.renderMs || 0).toFixed(1)}ms, paint=${(m.paintMs || 0).toFixed(1)}ms, total=${(m.totalMs || 0).toFixed(1)}ms`)
      );
    }
    
    // 스크롤 성능 메트릭
    if (m.scrollMetrics && m.scrollMetrics.scrollEvents > 0) {
      console.log('\n📜 Scroll Performance:');
      console.log(`  Total scroll time: ${(m.scrollMetrics.totalScrollTime || 0).toFixed(1)}ms`);
      console.log(`  Scroll events: ${m.scrollMetrics.scrollEvents}`);
      console.log(`  Average FPS: ${(m.scrollMetrics.avgFps || 0).toFixed(1)}`, m.scrollMetrics.avgFps >= 50 ? '✅' : m.scrollMetrics.avgFps >= 30 ? '⚠️' : '❌');
      console.log(`  Min FPS: ${(m.scrollMetrics.minFps || 0).toFixed(1)}`, m.scrollMetrics.minFps >= 30 ? '✅' : '⚠️');
      console.log(`  Frame drops (<30fps): ${m.scrollMetrics.frameDrops}회`);
      console.log(`  Pages rendered during scroll: ${(m.scrollMetrics.renderEventsDuringScroll || []).length}개`);
      
      // 스크롤 중 렌더링된 페이지 타임라인
      if (m.scrollMetrics.renderEventsDuringScroll && m.scrollMetrics.renderEventsDuringScroll.length > 0) {
        console.log('\n  Timeline (first 10 pages):');
        m.scrollMetrics.renderEventsDuringScroll.slice(0, 10).forEach(evt => {
          console.log(`    Page ${evt.page}: ${(evt.timestamp || 0).toFixed(0)}ms에 렌더링 (소요: ${(evt.totalMs || 0).toFixed(1)}ms)`);
        });
      }
    }

    // 리소스 로딩 성능
    if (m.resources && Object.keys(m.resources).length > 0) {
      console.log('\n📦 Resource Loading:');
      Object.entries(m.resources).forEach(([type, stats]) => {
        console.log(`  ${type}: ${stats.count}개, 평균 ${stats.avgDuration.toFixed(1)}ms, 총 ${(stats.totalSize / 1024).toFixed(1)}KB`);
      });
    }
    
    // 메모리 사용량
    if (m.memory) {
      console.log('\n💾 Memory Usage:');
      console.log(`  Used JS Heap: ${(m.memory.usedJSHeapSize / 1024 / 1024).toFixed(1)}MB / ${(m.memory.totalJSHeapSize / 1024 / 1024).toFixed(1)}MB`);
      console.log(`  Heap Usage: ${m.memory.usedPercent}%`, m.memory.usedPercent < 50 ? '✅' : m.memory.usedPercent < 75 ? '⚠️' : '❌');
    }
    
    // Layout Shift 상세
    if (m.layoutShifts) {
      console.log('\n📐 Layout Shifts:');
      console.log(`  Total shifts: ${m.layoutShifts.count}회`);
      console.log(`  Total CLS score: ${m.layoutShifts.totalScore.toFixed(3)}`);
      console.log(`  Max shift: ${m.layoutShifts.maxShift.toFixed(3)}`);
      console.log(`  Avg shift: ${m.layoutShifts.avgShift.toFixed(3)}`);
    }
    
    // Long Animation Frames
    if (m.longAnimationFrames) {
      console.log('\n🎬 Long Animation Frames:');
      console.log(`  Count: ${m.longAnimationFrames.count}개`);
      console.log(`  Avg duration: ${m.longAnimationFrames.avgDuration.toFixed(1)}ms`);
      console.log(`  Max duration: ${m.longAnimationFrames.maxDuration.toFixed(1)}ms`);
    }
    
    // 네트워크/디바이스 정보
    if (m.networkInfo || m.deviceMemory || m.hardwareConcurrency) {
      console.log('\n💻 Device & Network:');
      if (m.networkInfo) {
        console.log(`  Network: ${m.networkInfo.effectiveType}, Downlink: ${m.networkInfo.downlink}Mbps, RTT: ${m.networkInfo.rtt}ms`);
      }
      if (m.deviceMemory) {
        console.log(`  Device Memory: ${m.deviceMemory}GB`);
      }
      if (m.hardwareConcurrency) {
        console.log(`  CPU Cores: ${m.hardwareConcurrency}`);
      }
    }
    
    // Lighthouse 진단 정보
    if (LH && LH.diagnostics) {
      console.log('\n🔍 Lighthouse 진단:');
      if (LH.diagnostics.networkRequests) {
        console.log(`  - 네트워크 요청: ${LH.diagnostics.networkRequests}개`);
      }
      if (LH.diagnostics.totalByteWeight != null) {
        console.log(`  - 전체 페이지 크기: ${(LH.diagnostics.totalByteWeight / 1024 / 1024).toFixed(2)}MB`);
      }
      if (LH.diagnostics.domSize != null) {
        console.log(`  - DOM 요소: ${LH.diagnostics.domSize}개`);
      }
      if (LH.diagnostics.mainThreadWorkBreakdown && LH.diagnostics.mainThreadWorkBreakdown.length > 0) {
        const top3 = LH.diagnostics.mainThreadWorkBreakdown.slice(0, 3);
        console.log('  - 메인 스레드 작업 (Top 3):');
        top3.forEach((item, i) => {
          console.log(`    ${i+1}. ${item.groupLabel || item.group}: ${(item.duration || 0).toFixed(0)}ms`);
        });
      }
    }
    
    console.log('\n⏱️  Total Measurement Time:', results.totalTime, 'ms');
    console.log('\n✅ Good | ⚠️ Needs Improvement | ❌ Poor');
  } else {
    // PDF 모드 기존 출력
    console.log('Approx LongTask blocking (ms):', results.longTaskBlockingMsApprox);
    console.log('Averages (ms):', results.avg);
  }

  await browser.close();
  if (server) server.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
