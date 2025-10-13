#!/usr/bin/env node
/**
 * bench-webvitals.js — Puppeteer + web-vitals 자동 측정 벤치마크
 *
 * 필수 패키지:
 *   npm install puppeteer web-vitals
 *
 * 사용 예:
 *   # 단일 URL 측정
 *   node bench/bench-webvitals.js --url "http://localhost:3000/feedback/4"
 *
 *   # 여러 URL 비교 (최대 5개)
 *   node bench/bench-webvitals.js \
 *     --url1 "http://localhost:3000/feedback/4?version=old" --name1 "Old Version" \
 *     --url2 "http://localhost:3000/feedback/4?version=pdf" --name2 "PDF Version" \
 *     --url3 "http://localhost:3000/feedback/4?version=new" --name3 "New Version"
 *
 *   # 여러 번 실행 (통계용)
 *   node bench/bench-webvitals.js --url "http://localhost:3000/feedback/4" --runs 5
 *
 *   # 스크롤 시뮬레이션 활성화
 *   node bench/bench-webvitals.js --url "http://localhost:3000/feedback/4" --scroll true
 *
 *   # CPU 제한 (저사양 시뮬레이션)
 *   node bench/bench-webvitals.js --url "http://localhost:3000/feedback/4" --cpu 4
 *
 *   # 프리셋 사용 (권장)
 *   node bench/bench-webvitals.js --url "..." --preset realistic  # 실제 환경 (wait=7s, scroll, cpu=2x)
 *   node bench/bench-webvitals.js --url "..." --preset intensive  # 강도 높음 (wait=10s, scroll, cpu=4x)
 *   node bench/bench-webvitals.js --url "..." --preset fast       # 빠른 측정 (wait=2s)
 *
 *   # 대기 시간 조정
 *   node bench/bench-webvitals.js --url "http://localhost:3000/feedback/4" --wait 5000
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
const url1 = arg('url1', null);
const url2 = arg('url2', null);
const url3 = arg('url3', null);
const url4 = arg('url4', null);
const url5 = arg('url5', null);
const name1 = arg('name1', 'Version 1');
const name2 = arg('name2', 'Version 2');
const name3 = arg('name3', 'Version 3');
const name4 = arg('name4', 'Version 4');
const name5 = arg('name5', 'Version 5');

// 설정
const runs = parseInt(arg('runs', '1'), 10);
const waitTime = parseInt(arg('wait', '3000'), 10);
const enableScroll = String(arg('scroll', 'false')) === 'true';
const headless = String(arg('headless', 'true')) === 'true';
const cpuThrottle = parseFloat(arg('cpu', '1')); // CPU throttling: 1=제한없음, 4=4배 느림, 6=6배 느림
const scrollIntensive = String(arg('scrollIntensive', 'false')) === 'true'; // 더 많은 스크롤
const preset = arg('preset', null); // 프리셋: 'realistic', 'fast', 'intensive'

// 프리셋 적용
let finalWaitTime = waitTime;
let finalScroll = enableScroll;
let finalCpu = cpuThrottle;
let finalScrollIntensive = scrollIntensive;

if (preset === 'realistic') {
  // 실제 사용자 환경 시뮬레이션
  finalWaitTime = 7000;
  finalScroll = true;
  finalCpu = 2;
  finalScrollIntensive = true;
  console.log('🎯 "realistic" 프리셋 적용: wait=7000ms, scroll=true, cpu=2x, scrollIntensive=true');
} else if (preset === 'intensive') {
  // 더욱 강도 높은 측정 (저사양 + 많은 렌더링)
  finalWaitTime = 10000;
  finalScroll = true;
  finalCpu = 4;
  finalScrollIntensive = true;
  console.log('🔥 "intensive" 프리셋 적용: wait=10000ms, scroll=true, cpu=4x, scrollIntensive=true');
} else if (preset === 'fast') {
  // 빠른 측정
  finalWaitTime = 2000;
  finalScroll = false;
  finalCpu = 1;
  finalScrollIntensive = false;
  console.log('⚡ "fast" 프리셋 적용: wait=2000ms, scroll=false, cpu=1x');
} else {
  // 개별 옵션 사용
  finalWaitTime = waitTime;
  finalScroll = enableScroll;
  finalCpu = cpuThrottle;
  finalScrollIntensive = scrollIntensive;
}

// ---- 경로 설정 ----
const benchDir = __dirname;
const outDir = path.join(benchDir, 'bench_out');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

/**
 * Puppeteer + web-vitals로 단일 URL 측정
 */
async function measureUrl(testUrl, runNumber = 1, config = {}) {
  const browser = await puppeteer.launch({
    headless: headless ? 'new' : false,
    defaultViewport: { width: 1920, height: 1080 },
    args: ['--disable-dev-shm-usage', '--no-sandbox'],
  });

  const page = await browser.newPage();

  // CPU throttling 설정 (CDP 사용)
  const cpuRate = config.cpu || cpuThrottle;
  if (cpuRate > 1) {
    const client = await page.target().createCDPSession();
    await client.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
    console.log(`[CPU] ${cpuRate}배 throttling 적용됨 (저사양 시뮬레이션)`);
  }

  // 콘솔 로그 포워딩
  page.on('console', (msg) => {
    const text = msg.text();
    if (!text.includes('web-vitals')) {
      console.log('[page]', text);
    }
  });

  console.log(`\n[${runNumber}] 측정 시작: ${testUrl}`);
  const startTime = Date.now();

  // 페이지 로드 전 측정 설정
  await page.evaluateOnNewDocument(() => {
    // 측정 결과 저장소
    window.__metrics = {
      webVitals: {},
      attribution: {},
      timing: {},
      longTasks: [],
      scrollMetrics: null,
    };

    // Long Tasks 수집
    try {
      const ltObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__metrics.longTasks.push({
            startTime: entry.startTime,
            duration: entry.duration,
          });
        }
      });
      ltObserver.observe({ type: 'longtask', buffered: true });
    } catch (_) {}

    // web-vitals 초기화 (window.webVitals가 로드되면 실행)
    const initWebVitals = () => {
      if (!window.webVitals) {
        setTimeout(initWebVitals, 100);
        return;
      }

      try {
        const { onFCP, onLCP, onCLS, onINP, onTTFB } = window.webVitals;

      onFCP((metric) => {
        window.__metrics.webVitals.FCP = metric.value;
        if (metric.attribution) {
          window.__metrics.attribution.FCP = {
            timeToFirstByte: metric.attribution.timeToFirstByte,
            firstByteToFCP: metric.attribution.firstByteToFCP,
            loadState: metric.attribution.loadState,
          };
        }
      }, { reportAllChanges: true });

      onLCP((metric) => {
        window.__metrics.webVitals.LCP = metric.value;
        if (metric.attribution) {
          window.__metrics.attribution.LCP = {
            element: metric.attribution.element?.tagName || null,
            url: metric.attribution.url || null,
            timeToFirstByte: metric.attribution.timeToFirstByte,
            resourceLoadDelay: metric.attribution.resourceLoadDelay,
            resourceLoadDuration: metric.attribution.resourceLoadDuration,
            elementRenderDelay: metric.attribution.elementRenderDelay,
          };
        }
      }, { reportAllChanges: true });

      onCLS((metric) => {
        window.__metrics.webVitals.CLS = metric.value;
        if (metric.attribution) {
          window.__metrics.attribution.CLS = {
            largestShiftValue: metric.attribution.largestShiftValue,
            largestShiftTime: metric.attribution.largestShiftTime,
            loadState: metric.attribution.loadState,
          };
        }
      }, { reportAllChanges: true });

      onINP((metric) => {
        window.__metrics.webVitals.INP = metric.value;
        if (metric.attribution) {
          window.__metrics.attribution.INP = {
            eventType: metric.attribution.eventType,
            eventTarget: metric.attribution.eventTarget,
            loadState: metric.attribution.loadState,
            inputDelay: metric.attribution.inputDelay,
            processingDuration: metric.attribution.processingDuration,
            presentationDelay: metric.attribution.presentationDelay,
          };
        }
      }, { reportAllChanges: true });

      onTTFB((metric) => {
        window.__metrics.webVitals.TTFB = metric.value;
        if (metric.attribution) {
          window.__metrics.attribution.TTFB = {
            waitingDuration: metric.attribution.waitingDuration,
            cacheDuration: metric.attribution.cacheDuration,
            dnsDuration: metric.attribution.dnsDuration,
            connectionDuration: metric.attribution.connectionDuration,
            requestDuration: metric.attribution.requestDuration,
          };
        }
      }, { reportAllChanges: true });
      
      console.log('[web-vitals] 초기화 완료');
      } catch (err) {
        console.error('[web-vitals] 초기화 실패:', err);
      }
    };

    // 즉시 실행 시작
    initWebVitals();
  });

  // 페이지 이동
  await page.goto(testUrl, { 
    waitUntil: ['networkidle2', 'domcontentloaded'], 
    timeout: 60000 
  });

  // web-vitals 라이브러리 주입 (페이지 로드 후)
  try {
    const webVitalsPath = require.resolve('web-vitals/dist/web-vitals.attribution.iife.js');
    await page.addScriptTag({ path: webVitalsPath });
    console.log('[web-vitals] 로컬 파일에서 로드됨');
  } catch (e) {
    console.warn('[web-vitals] 로컬 로드 실패, CDN 사용:', e?.message);
    await page.addScriptTag({ 
      url: 'https://unpkg.com/web-vitals@4/dist/web-vitals.attribution.iife.js' 
    });
    console.log('[web-vitals] CDN에서 로드됨');
  }

  // web-vitals 초기화 대기
  await page.waitForFunction(() => window.webVitals != null, { timeout: 5000 }).catch(() => {
    console.warn('[web-vitals] 로드 대기 시간 초과');
  });

  // 약간의 추가 대기 (web-vitals 이벤트 수집)
  await new Promise(resolve => setTimeout(resolve, 500));

  // 스크롤 시뮬레이션 (옵션)
  const shouldScroll = config.scroll ?? enableScroll;
  const intensive = config.scrollIntensive ?? scrollIntensive;
  
  if (shouldScroll) {
    console.log('[scroll] 스크롤 시뮬레이션 시작...');
    await page.evaluate(async (intensive) => {
      await new Promise((resolve) => {
        let totalScrolled = 0;
        // intensive 모드: 더 많이, 더 천천히 스크롤
        const scrollStep = intensive ? 300 : 500;
        const pauseTime = intensive ? 300 : 100;  // 스크롤 간격
        const multiplier = intensive ? 5 : 2;     // 스크롤 범위
        const maxScroll = document.documentElement.scrollHeight * multiplier;
        
        const metrics = {
          fps: [],
          frameDrops: 0,
          startTime: performance.now(),
        };

        let lastFrameTime = performance.now();

        const measureFPS = () => {
          const now = performance.now();
          const delta = now - lastFrameTime;
          const fps = 1000 / delta;
          metrics.fps.push(fps);
          if (fps < 30) metrics.frameDrops++;
          lastFrameTime = now;
        };

        const scrollListener = () => {
          requestAnimationFrame(measureFPS);
        };

        window.addEventListener('scroll', scrollListener, { passive: true });

        const step = async () => {
          window.scrollBy(0, scrollStep);
          totalScrolled += scrollStep;
          await new Promise(r => setTimeout(r, pauseTime));

          if (totalScrolled < maxScroll) {
            await step();
          } else {
            window.removeEventListener('scroll', scrollListener);
            metrics.endTime = performance.now();
            metrics.duration = metrics.endTime - metrics.startTime;
            metrics.avgFps = metrics.fps.length > 0 
              ? metrics.fps.reduce((a, b) => a + b, 0) / metrics.fps.length 
              : 0;
            metrics.minFps = metrics.fps.length > 0 ? Math.min(...metrics.fps) : 0;
            window.__metrics.scrollMetrics = metrics;
            
            if (intensive) {
              console.log(`[scroll] intensive 모드: ${totalScrolled}px 스크롤 완료`);
            }
            
            resolve();
          }
        };

        step();
      });
    }, scrollIntensive);
    console.log('[scroll] 스크롤 완료');
  }

  // 안정화 대기
  const finalWait = config.wait ?? waitTime;
  if (finalWait > 0) {
    console.log(`[wait] ${finalWait}ms 대기 중...`);
    await new Promise(resolve => setTimeout(resolve, finalWait));
  }

  // 결과 수집
  const results = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const paints = performance.getEntriesByType('paint');
    const fcp = paints.find(p => p.name === 'first-contentful-paint');
    const fp = paints.find(p => p.name === 'first-paint');

    // Navigation Timing
    if (nav) {
      window.__metrics.timing = {
        ttfb: nav.responseStart - nav.requestStart,
        domInteractive: nav.domInteractive - nav.fetchStart,
        domContentLoaded: nav.domContentLoadedEventEnd - nav.fetchStart,
        loadComplete: nav.loadEventEnd - nav.fetchStart,
        firstPaint: fp?.startTime || null,
        firstContentfulPaint: fcp?.startTime || null,
      };
    }

    // TTI 추정 (Long Tasks 기반)
    const fcpTime = window.__metrics.webVitals.FCP || window.__metrics.timing.firstContentfulPaint;
    let tti = null;
    
    if (fcpTime != null && window.__metrics.longTasks.length > 0) {
      const tasksAfterFCP = window.__metrics.longTasks.filter(t => t.startTime >= fcpTime);
      if (tasksAfterFCP.length > 0) {
        const lastTask = tasksAfterFCP[tasksAfterFCP.length - 1];
        tti = lastTask.startTime + lastTask.duration;
      } else {
        tti = fcpTime;
      }
    } else if (fcpTime != null) {
      tti = fcpTime;
    } else {
      tti = window.__metrics.timing.domInteractive;
    }
    
    window.__metrics.timing.tti = tti;

    // TBT 계산 (FCP ~ TTI 구간)
    let tbt = 0;
    if (fcpTime != null && tti != null) {
      const tasksInRange = window.__metrics.longTasks.filter(task => {
        const taskEnd = task.startTime + task.duration;
        return taskEnd > fcpTime && task.startTime < tti;
      });

      tbt = tasksInRange.reduce((sum, task) => {
        const blockingTime = Math.max(0, task.duration - 50);
        return sum + blockingTime;
      }, 0);
    }
    
    window.__metrics.timing.tbt = tbt;
    window.__metrics.timing.longTaskCount = window.__metrics.longTasks.length;

    return window.__metrics;
  });

  const endTime = Date.now();
  const totalTime = endTime - startTime;

  await browser.close();

  return {
    url: testUrl,
    runNumber,
    totalTime,
    timestamp: new Date().toISOString(),
    ...results,
  };
}

/**
 * 결과 출력
 */
function printResults(result) {
  const wv = result.webVitals || {};
  const timing = result.timing || {};
  const attr = result.attribution || {};
  const scroll = result.scrollMetrics;

  console.log('\n' + '='.repeat(70));
  console.log('📊 성능 측정 결과');
  console.log('='.repeat(70));

  // web-vitals 공식 지표가 있는지 확인
  const hasWebVitals = Object.values(wv).some(v => v != null && v !== undefined);
  
  if (hasWebVitals) {
    console.log('\n🏆 Core Web Vitals (Google 공식 - web-vitals 라이브러리):');
  } else {
    console.log('\n⚠️  web-vitals 라이브러리에서 값을 가져오지 못했습니다.');
    console.log('    페이지 로드 대기 시간(--wait)을 늘리거나 --scroll을 시도해보세요.\n');
  }

  // FCP (web-vitals만)
  console.log(`  FCP: ${wv.FCP != null ? wv.FCP.toFixed(1) + 'ms' : 'N/A'}`, 
    wv.FCP != null ? (wv.FCP < 1800 ? '✅' : wv.FCP < 3000 ? '⚠️' : '❌') : '');
  if (attr.FCP) {
    console.log(`      └─ TTFB: ${attr.FCP.timeToFirstByte?.toFixed(1) || 'N/A'}ms, TTFB→FCP: ${attr.FCP.firstByteToFCP?.toFixed(1) || 'N/A'}ms`);
  }

  // LCP (web-vitals만)
  console.log(`  LCP: ${wv.LCP != null ? wv.LCP.toFixed(1) + 'ms' : 'N/A'}`, 
    wv.LCP != null ? (wv.LCP < 2500 ? '✅' : wv.LCP < 4000 ? '⚠️' : '❌') : '');
  if (attr.LCP) {
    console.log(`      └─ Element: ${attr.LCP.element || 'N/A'}, Render Delay: ${attr.LCP.elementRenderDelay?.toFixed(1) || 'N/A'}ms`);
  }

  // CLS (web-vitals만)
  console.log(`  CLS: ${wv.CLS != null ? wv.CLS.toFixed(3) : 'N/A'}`, 
    wv.CLS != null ? (wv.CLS < 0.1 ? '✅' : wv.CLS < 0.25 ? '⚠️' : '❌') : '');
  if (attr.CLS && attr.CLS.largestShiftValue > 0) {
    console.log(`      └─ Max Shift: ${attr.CLS.largestShiftValue?.toFixed(3) || 'N/A'} at ${attr.CLS.largestShiftTime?.toFixed(1) || 'N/A'}ms`);
  }

  // INP (web-vitals만)
  console.log(`  INP: ${wv.INP != null ? wv.INP.toFixed(1) + 'ms' : 'N/A'}`, 
    wv.INP != null ? (wv.INP < 200 ? '✅' : wv.INP < 500 ? '⚠️' : '❌') : '');
  if (attr.INP) {
    console.log(`      └─ Event: ${attr.INP.eventType || 'N/A'}, Processing: ${attr.INP.processingDuration?.toFixed(1) || 'N/A'}ms`);
  }

  // TTFB (web-vitals만)
  console.log(`  TTFB: ${wv.TTFB != null ? wv.TTFB.toFixed(1) + 'ms' : 'N/A'}`, 
    wv.TTFB != null ? (wv.TTFB < 800 ? '✅' : '⚠️') : '');
  if (attr.TTFB) {
    console.log(`      └─ DNS: ${attr.TTFB.dnsDuration?.toFixed(1) || 'N/A'}ms, Request: ${attr.TTFB.requestDuration?.toFixed(1) || 'N/A'}ms`);
  }
  
  if (!hasWebVitals) {
    console.log('\n  ⚠️  모든 지표가 N/A입니다. web-vitals 라이브러리가 제대로 로드되지 않았습니다.');
  }

  console.log('\n⚡ Performance Timing:');
  console.log(`  DOM Interactive: ${timing.domInteractive?.toFixed(1) || 'N/A'}ms`);
  console.log(`  DOM Content Loaded: ${timing.domContentLoaded?.toFixed(1) || 'N/A'}ms`);
  console.log(`  Load Complete: ${timing.loadComplete?.toFixed(1) || 'N/A'}ms`);
  console.log(`  TTI (estimated): ${timing.tti?.toFixed(1) || 'N/A'}ms`, 
    timing.tti < 3800 ? '✅' : timing.tti < 7300 ? '⚠️' : '❌');
  console.log(`  TBT (calculated): ${timing.tbt?.toFixed(1) || 'N/A'}ms`, 
    timing.tbt < 200 ? '✅' : timing.tbt < 600 ? '⚠️' : '❌');
  console.log(`  Long Tasks: ${timing.longTaskCount || 0}개`);

  if (scroll) {
    console.log('\n📜 Scroll Performance:');
    console.log(`  Duration: ${scroll.duration?.toFixed(1) || 'N/A'}ms`);
    console.log(`  Avg FPS: ${scroll.avgFps?.toFixed(1) || 'N/A'}`, scroll.avgFps >= 50 ? '✅' : '⚠️');
    console.log(`  Min FPS: ${scroll.minFps?.toFixed(1) || 'N/A'}`);
    console.log(`  Frame Drops: ${scroll.frameDrops || 0}회`);
  }

  console.log(`\n⏱️  Total: ${result.totalTime}ms`);
  console.log('\n✅ Good | ⚠️ Needs Improvement | ❌ Poor\n');
}

/**
 * 통계 계산
 */
function calculateStats(results) {
  const avg = (arr) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  const min = (arr) => arr.length > 0 ? Math.min(...arr) : null;
  const max = (arr) => arr.length > 0 ? Math.max(...arr) : null;

  // web-vitals 값만 사용 (폴백 없음)
  const fcps = results.map(r => r.webVitals?.FCP).filter(v => v != null);
  const lcps = results.map(r => r.webVitals?.LCP).filter(v => v != null);
  const clss = results.map(r => r.webVitals?.CLS).filter(v => v != null);
  const inps = results.map(r => r.webVitals?.INP).filter(v => v != null);
  const ttfbs = results.map(r => r.webVitals?.TTFB).filter(v => v != null);
  const ttis = results.map(r => r.timing?.tti).filter(v => v != null);
  const tbts = results.map(r => r.timing?.tbt).filter(v => v != null);

  return {
    runs: results.length,
    fcp: { avg: avg(fcps), min: min(fcps), max: max(fcps) },
    lcp: { avg: avg(lcps), min: min(lcps), max: max(lcps) },
    cls: { avg: avg(clss), min: min(clss), max: max(clss) },
    inp: { avg: avg(inps), min: min(inps), max: max(inps) },
    ttfb: { avg: avg(ttfbs), min: min(ttfbs), max: max(ttfbs) },
    tti: { avg: avg(ttis), min: min(ttis), max: max(ttis) },
    tbt: { avg: avg(tbts), min: min(tbts), max: max(tbts) },
  };
}

/**
 * 메인 실행
 */
(async () => {
  // URL 목록 구성
  const urls = [];
  
  if (singleUrl) {
    urls.push({ url: singleUrl, name: 'Test' });
  } else {
    if (url1) urls.push({ url: url1, name: name1 });
    if (url2) urls.push({ url: url2, name: name2 });
    if (url3) urls.push({ url: url3, name: name3 });
    if (url4) urls.push({ url: url4, name: name4 });
    if (url5) urls.push({ url: url5, name: name5 });
  }

  if (urls.length === 0) {
    console.error('❌ URL을 지정해주세요 (--url 또는 --url1, --url2, ...)');
    console.error('\n사용 예:');
    console.error('  node bench/bench-webvitals.js --url "http://localhost:3000/feedback/4"');
    console.error('  node bench/bench-webvitals.js --url1 "..." --name1 "Version 1" --url2 "..." --name2 "Version 2"');
    process.exit(1);
  }

  console.log(`\n🚀 ${urls.length}개 URL을 각각 ${runs}회씩 측정합니다...`);
  if (preset) {
    console.log(`⚙️  프리셋: ${preset}`);
  }
  console.log(`⚙️  설정: wait=${finalWaitTime}ms, scroll=${finalScroll}, cpu=${finalCpu}x, scrollIntensive=${finalScrollIntensive}, headless=${headless}\n`);

  const allResults = {};
  
  // 측정 설정
  const measureConfig = {
    wait: finalWaitTime,
    scroll: finalScroll,
    cpu: finalCpu,
    scrollIntensive: finalScrollIntensive
  };

  // 각 URL 측정
  for (const { url, name } of urls) {
    console.log('\n' + '#'.repeat(70));
    console.log(`### ${name} ###`);
    console.log(`### ${url}`);
    console.log('#'.repeat(70));

    const urlResults = [];

    for (let i = 1; i <= runs; i++) {
      const result = await measureUrl(url, i, measureConfig);
      urlResults.push(result);
      printResults(result);

      // 다음 실행 전 대기
      if (i < runs) {
        console.log('⏸️  다음 실행까지 2초 대기...\n');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    allResults[name] = urlResults;

    // 여러 번 실행한 경우 통계 출력
    if (runs > 1) {
      const stats = calculateStats(urlResults);
      
      console.log('\n' + '─'.repeat(70));
      console.log(`📈 ${name} - ${runs}회 실행 통계 (web-vitals 공식)`);
      console.log('─'.repeat(70));
      console.log(`  FCP: avg ${stats.fcp.avg?.toFixed(1) || 'N/A'}ms (${stats.fcp.min?.toFixed(1) || 'N/A'} ~ ${stats.fcp.max?.toFixed(1) || 'N/A'})`);
      console.log(`  LCP: avg ${stats.lcp.avg?.toFixed(1) || 'N/A'}ms (${stats.lcp.min?.toFixed(1) || 'N/A'} ~ ${stats.lcp.max?.toFixed(1) || 'N/A'})`);
      console.log(`  CLS: avg ${stats.cls.avg?.toFixed(3) || 'N/A'} (${stats.cls.min?.toFixed(3) || 'N/A'} ~ ${stats.cls.max?.toFixed(3) || 'N/A'})`);
      console.log(`  INP: avg ${stats.inp.avg?.toFixed(1) || 'N/A'}ms (${stats.inp.min?.toFixed(1) || 'N/A'} ~ ${stats.inp.max?.toFixed(1) || 'N/A'})`);
      console.log(`  TTFB: avg ${stats.ttfb.avg?.toFixed(1) || 'N/A'}ms (${stats.ttfb.min?.toFixed(1) || 'N/A'} ~ ${stats.ttfb.max?.toFixed(1) || 'N/A'})`);
      console.log(`  TTI: avg ${stats.tti.avg?.toFixed(1) || 'N/A'}ms (${stats.tti.min?.toFixed(1) || 'N/A'} ~ ${stats.tti.max?.toFixed(1) || 'N/A'})`);
      console.log(`  TBT: avg ${stats.tbt.avg?.toFixed(1) || 'N/A'}ms (${stats.tbt.min?.toFixed(1) || 'N/A'} ~ ${stats.tbt.max?.toFixed(1) || 'N/A'})`);
    }
  }

  // 여러 URL 비교
  if (urls.length > 1) {
    console.log('\n' + '='.repeat(70));
    console.log('🏆 버전 비교 (web-vitals 공식)');
    console.log('='.repeat(70));

    for (const [name, results] of Object.entries(allResults)) {
      const stats = calculateStats(results);
      console.log(`\n【${name}】`);
      console.log(`  FCP: ${stats.fcp.avg?.toFixed(1) || 'N/A'}ms`);
      console.log(`  LCP: ${stats.lcp.avg?.toFixed(1) || 'N/A'}ms`, 
        stats.lcp.avg != null ? (stats.lcp.avg < 2500 ? '✅' : stats.lcp.avg < 4000 ? '⚠️' : '❌') : '');
      console.log(`  CLS: ${stats.cls.avg?.toFixed(3) || 'N/A'}`, 
        stats.cls.avg != null ? (stats.cls.avg < 0.1 ? '✅' : stats.cls.avg < 0.25 ? '⚠️' : '❌') : '');
      console.log(`  INP: ${stats.inp.avg?.toFixed(1) || 'N/A'}ms`,
        stats.inp.avg != null ? (stats.inp.avg < 200 ? '✅' : stats.inp.avg < 500 ? '⚠️' : '❌') : '');
      console.log(`  TTFB: ${stats.ttfb.avg?.toFixed(1) || 'N/A'}ms`,
        stats.ttfb.avg != null ? (stats.ttfb.avg < 800 ? '✅' : '⚠️') : '');
      console.log(`  TTI: ${stats.tti.avg?.toFixed(1) || 'N/A'}ms`, 
        stats.tti.avg != null ? (stats.tti.avg < 3800 ? '✅' : stats.tti.avg < 7300 ? '⚠️' : '❌') : '');
      console.log(`  TBT: ${stats.tbt.avg?.toFixed(1) || 'N/A'}ms`, 
        stats.tbt.avg != null ? (stats.tbt.avg < 200 ? '✅' : stats.tbt.avg < 600 ? '⚠️' : '❌') : '');
    }
  }

  // 결과 저장
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const summaryPath = path.join(outDir, `webvitals-${timestamp}.json`);
  
  const summary = {
    timestamp: new Date().toISOString(),
    config: {
      preset: preset || 'custom',
      runs,
      waitTime: finalWaitTime,
      enableScroll: finalScroll,
      scrollIntensive: finalScrollIntensive,
      headless,
      cpuThrottle: finalCpu,
    },
    results: allResults,
  };

  // 통계 추가
  if (urls.length > 1 || runs > 1) {
    summary.statistics = {};
    for (const [name, results] of Object.entries(allResults)) {
      summary.statistics[name] = calculateStats(results);
    }
  }

  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`\n💾 결과 저장: ${summaryPath}`);
  console.log('\n✅ 벤치마크 완료!\n');

})().catch((e) => {
  console.error('❌ 오류 발생:', e);
  process.exit(1);
});

