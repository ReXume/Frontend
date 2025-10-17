#!/usr/bin/env node
/**
 * Device-Aware 렌더 스케줄러 벤치마크 (LongTask 추적)
 * 
 * 목적:
 * - Device-Aware 렌더 스케줄러의 성능 측정
 * - 기기 티어 감지 및 최적화 효과 검증
 * - LongTask, 스크롤 이벤트, IO 디바운스 추적
 * - 저성능/고성능 기기에서의 성능 비교
 * 
 * 사용:
 *   node bench-device-aware.js --cpu 1
 *   node bench-device-aware.js --cpu 6 --realistic true
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

const cpuThrottle = parseFloat(arg('cpu', '1'));
const headless = String(arg('headless', 'true')) === 'true';
const scrollSteps = parseInt(arg('steps', '10'), 10);
const stepDelay = parseInt(arg('delay', '500'), 10);
const realisticPattern = String(arg('realistic', 'true')) === 'true';

const benchDir = path.dirname(__dirname);
const outDir = path.join(benchDir, 'real-user-pattern', 'results');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

/**
 * Device-Aware 버전 측정 (LongTask 추적 포함)
 */
async function measureDeviceAware(cpuThrottle) {
  console.log(`\n📊 Device-Aware 측정 시작 (CPU ${cpuThrottle}x)`);
  
  const browser = await puppeteer.launch({
    headless: headless ? 'new' : false,
    defaultViewport: { width: 1920, height: 1080 },
    args: ['--disable-dev-shm-usage', '--no-sandbox'],
    protocolTimeout: 120000,
  });

  const page = await browser.newPage();
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
    if (text.includes('[Device-Aware]') || text.includes('[LongTask]') || text.includes('티어')) {
      console.log(`   ${text}`);
    }
  });

  // 메트릭 수집 설정
  await page.evaluateOnNewDocument(() => {
    window.__deviceAwareMetrics = {
      deviceTier: null,
      config: null,
      renderMetrics: [],
      scrollEvents: [],
      longTasks: [],
      ioDebounceEvents: [],
      workerMessages: [],
      startTime: null,
    };

    // LongTask Observer
    if (window.PerformanceObserver) {
      try {
        const ltObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const timestamp = performance.now();
            window.__deviceAwareMetrics.longTasks.push({
              startTime: entry.startTime,
              duration: entry.duration,
              timestamp: timestamp,
            });
            console.log(`[LongTask] ${entry.duration.toFixed(2)}ms @ ${entry.startTime.toFixed(2)}ms`);
          }
        });
        ltObserver.observe({ type: 'longtask', buffered: true });
      } catch (e) {
        console.log('[Device-Aware] LongTask observer not supported');
      }
    }

    // PDF 렌더 메트릭 수집기
    window.pdfRenderMetricsCollector = {
      add: (metric) => {
        window.__deviceAwareMetrics.renderMetrics.push({
          ...metric,
          timestamp: performance.now(),
        });
      }
    };

    // Worker postMessage intercept
    const OriginalWorker = window.Worker;
    window.Worker = function(scriptURL, options) {
      const worker = new OriginalWorker(scriptURL, options);
      const originalPostMessage = worker.postMessage.bind(worker);
      
      worker.postMessage = function(message, ...rest) {
        const timestamp = performance.now();
        window.__deviceAwareMetrics.workerMessages.push({
          type: 'worker_postMessage',
          timestamp: timestamp,
        });
        return originalPostMessage(message, ...rest);
      };
      
      return worker;
    };

    // 스크롤 이벤트 추적
    let scrollCount = 0;
    window.addEventListener('scroll', () => {
      scrollCount++;
      window.__deviceAwareMetrics.scrollEvents.push({
        count: scrollCount,
        timestamp: performance.now(),
        scrollY: window.scrollY,
      });
    }, { passive: true });
  });

  try {
    const url = 'http://localhost:3000/compare-device-aware';
    console.log(`   URL: ${url}`);
    
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });
    
    console.log('   ✓ 페이지 로드 완료, 초기화 대기...');
    await new Promise(r => setTimeout(r, 3000));

    // 기기 티어 및 설정 정보 수집
    const deviceInfo = await page.evaluate(() => {
      // Device-Aware 스케줄러에서 정보 가져오기
      try {
        if (typeof window !== 'undefined' && window.renderSchedulerDeviceAware) {
          const tier = window.renderSchedulerDeviceAware.getDeviceTier();
          const config = window.renderSchedulerDeviceAware.getConfig();
          
          // 메트릭에 저장
          if (window.__deviceAwareMetrics) {
            window.__deviceAwareMetrics.deviceTier = tier;
            window.__deviceAwareMetrics.config = config;
          }
          
          return { tier, config };
        }
      } catch (e) {
        console.error('[Device-Aware] 기기 정보 가져오기 실패:', e);
      }
      return { tier: 'unknown', config: { concurrency: 0, ioDebounceMs: 0, viewportMarginVh: 0 } };
    });

    console.log(`   🎯 기기 티어: ${deviceInfo.tier.toUpperCase()}`);
    console.log(`   ⚙️  동시 렌더 상한 (K): ${deviceInfo.config.concurrency}`);
    console.log(`   ⏱️  IO 디바운스: ${deviceInfo.config.ioDebounceMs}ms`);
    console.log(`   📏 Viewport Margin: ${deviceInfo.config.viewportMarginVh}vh`);

    // 메트릭 시작 시간 기록
    await page.evaluate(() => {
      window.__deviceAwareMetrics.startTime = performance.now();
    });

    console.log('   스크롤 시뮬레이션 시작...');
    if (realisticPattern) {
      console.log('   🎯 현실적 사용자 패턴 모드');
    }

    // 스크롤 시뮬레이션
    await page.evaluate(async (scrollSteps, stepDelay, realisticPattern) => {
      const scrollContainer = Array.from(document.querySelectorAll('div'))
        .find(div => {
          const style = window.getComputedStyle(div);
          return style.overflowY === 'auto' && div.scrollHeight > div.clientHeight;
        });
      
      if (!scrollContainer) {
        console.error('[Scroll] 스크롤 컨테이너를 찾을 수 없습니다');
        return;
      }

      const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
      console.log(`[Scroll] 컨테이너 발견: ${scrollContainer.scrollHeight}px`);

      if (realisticPattern) {
        // 현실적 사용자 패턴: 스크롤 → 읽기 → 반복
        const scrollChunkSize = 300;
        const scrollSpeed = 50;
        const readTime = 1500;
        const readDistance = 800;
        const maxMeasureScroll = Math.min(maxScroll, 15000);
        
        let currentScroll = 0;
        let chunkCount = 0;
        
        while (currentScroll < maxMeasureScroll) {
          chunkCount++;
          
          // 1. 빠르게 스크롤
          const targetScroll = Math.min(currentScroll + readDistance, maxMeasureScroll);
          console.log(`[Scroll] Chunk ${chunkCount}: ${currentScroll.toFixed(0)}px → ${targetScroll.toFixed(0)}px`);
          
          while (currentScroll < targetScroll) {
            currentScroll += scrollChunkSize;
            if (currentScroll > targetScroll) currentScroll = targetScroll;
            scrollContainer.scrollTop = currentScroll;
            await new Promise(r => setTimeout(r, scrollSpeed));
          }
          
          // 2. 읽기 (정지)
          console.log(`[Scroll] 읽기 중... (${readTime}ms 대기)`);
          await new Promise(r => setTimeout(r, readTime));
        }
        
        console.log(`[Scroll] 스크롤 완료: 총 ${chunkCount}개 청크`);
        
      } else {
        // 균등 스크롤
        for (let i = 0; i < scrollSteps; i++) {
          const progress = (i + 1) / scrollSteps;
          const targetY = Math.floor(maxScroll * progress);
          
          scrollContainer.scrollTop = targetY;
          await new Promise(r => setTimeout(r, stepDelay));
        }
      }
    }, scrollSteps, stepDelay, realisticPattern);

    console.log('   스크롤 완료, 렌더 완료 대기 (5초)');
    await new Promise(r => setTimeout(r, 5000));

    // 메트릭 수집
    const metrics = await page.evaluate(() => {
      const m = window.__deviceAwareMetrics;
      const duration = performance.now() - (m.startTime || 0);

      // LongTask 통계
      const longTasks = m.longTasks || [];
      const totalBlockedTime = longTasks.reduce((sum, lt) => sum + lt.duration, 0);
      const longtaskPct = duration > 0 ? (totalBlockedTime / duration) * 100 : 0;

      // 렌더 메트릭 통계
      const renders = m.renderMetrics || [];
      const avgRenderTime = renders.length > 0
        ? renders.reduce((sum, r) => sum + r.totalMs, 0) / renders.length
        : 0;

      // 스크롤 이벤트 통계
      const scrollEvents = m.scrollEvents || [];
      
      // Worker 메시지 통계
      const workerMessages = m.workerMessages || [];

      // config 기본값 설정
      const config = m.config || { concurrency: 0, ioDebounceMs: 0, viewportMarginVh: 0, description: '' };

      return {
        deviceTier: m.deviceTier || 'unknown',
        config: {
          concurrency: config.concurrency || 0,
          ioDebounceMs: config.ioDebounceMs || 0,
          viewportMarginVh: config.viewportMarginVh || 0,
          description: config.description || '',
        },
        duration: duration,
        scrollEvents: {
          count: scrollEvents.length,
          timeline: scrollEvents.slice(0, 10), // 처음 10개만
        },
        renderCount: renders.length,
        avgRenderTimeMs: parseFloat(avgRenderTime.toFixed(1)),
        renderMetrics: renders,
        longTasks: {
          count: longTasks.length,
          totalBlockedMs: parseFloat(totalBlockedTime.toFixed(1)),
          longtaskPct: parseFloat(longtaskPct.toFixed(2)),
          timeline: longTasks.map(lt => ({
            startTime: parseFloat(lt.startTime.toFixed(1)),
            duration: parseFloat(lt.duration.toFixed(1)),
          })),
        },
        workerMessages: {
          count: workerMessages.length,
          timeline: workerMessages.slice(0, 10),
        },
      };
    });

    console.log('\n   ✅ 측정 완료');
    console.log(`      - 기기 티어: ${metrics.deviceTier.toUpperCase()}`);
    console.log(`      - 동시 렌더 상한 (K): ${metrics.config?.concurrency || 'N/A'}`);
    console.log(`      - IO 디바운스: ${metrics.config?.ioDebounceMs || 0}ms`);
    console.log(`      - Viewport Margin: ${metrics.config?.viewportMarginVh || 0}vh`);
    console.log(`      - 총 소요 시간: ${(metrics.duration / 1000).toFixed(2)}초`);
    console.log(`      - 렌더 이벤트: ${metrics.renderCount}개`);
    console.log(`      - 렌더링 효율: ${(metrics.renderCount / (metrics.duration / 1000)).toFixed(2)} pages/sec`);
    console.log(`      - 평균 렌더 시간: ${metrics.avgRenderTimeMs}ms`);
    console.log(`      - 스크롤 이벤트: ${metrics.scrollEvents.count}회`);
    console.log(`      - Worker 메시지: ${metrics.workerMessages.count}개`);
    console.log(`      - Long Task: ${metrics.longTasks.count}개 (총 ${metrics.longTasks.totalBlockedMs}ms, ${metrics.longTasks.longtaskPct}% 차단)`);

    // 렌더 이벤트가 부족한 경우 경고
    if (metrics.renderCount === 0) {
      console.warn(`   ⚠️  렌더 이벤트가 0개입니다! pdfRenderMetricsCollector가 제대로 작동하지 않을 수 있습니다.`);
    } else if (metrics.renderCount < 5) {
      console.warn(`   ⚠️  렌더 이벤트가 ${metrics.renderCount}개로 적습니다. 결과가 부정확할 수 있습니다.`);
    }

    await browser.close();
    return metrics;

  } catch (err) {
    console.error('❌ 에러 발생:', err.message);
    await browser.close();
    throw err;
  }
}

/**
 * 현실적 스크롤 패턴
 */
async function realisticScroll(page, steps, baseDelay) {
  const maxScroll = await page.evaluate(() => {
    return document.documentElement.scrollHeight - window.innerHeight;
  });

  for (let i = 0; i < steps; i++) {
    const progress = (i + 1) / steps;
    const targetY = Math.floor(maxScroll * progress);
    
    await page.evaluate((y) => {
      window.scrollTo({ top: y, behavior: 'smooth' });
    }, targetY);

    // 변동성 있는 딜레이
    const variance = baseDelay * 0.3;
    const delay = baseDelay + (Math.random() * variance * 2 - variance);
    await new Promise(r => setTimeout(r, delay));

    // 가끔 멈춤
    if (Math.random() < 0.2) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

/**
 * 여러 결과 비교 출력
 */
function printComparison(results) {
  console.log('\n' + '='.repeat(80));
  console.log('📊 CPU 스로틀링별 비교 분석');
  console.log('='.repeat(80));
  console.log('');

  // CPU 레벨별로 정렬
  const sorted = results.sort((a, b) => a.cpuThrottle - b.cpuThrottle);

  // 테이블 헤더
  console.log('  CPU    | 티어   | K | 디바운스 | 렌더  | 효율      | TBT     | Long Task');
  console.log('  ' + '-'.repeat(76));

  sorted.forEach(r => {
    const cpuValue = r.cpuThrottle || r.settings?.cpuThrottle || 'N/A';
    const cpu = `${cpuValue}x`.padEnd(6);
    const tier = (r.result.deviceTier || 'unknown').toUpperCase().padEnd(6);
    const k = String(r.result.config?.concurrency || 0).padEnd(2);
    const debounce = `${r.result.config?.ioDebounceMs || 0}ms`.padEnd(9);
    const renders = `${r.result.renderCount || 0}개`.padEnd(5);
    const duration = r.result.duration || 1000;
    const efficiency = `${((r.result.renderCount || 0) / (duration / 1000)).toFixed(2)} p/s`.padEnd(9);
    const tbt = `${r.result.longTasks?.totalBlockedMs || 0}ms`.padEnd(7);
    const ltCount = r.result.longTasks?.count || 0;
    const ltPct = r.result.longTasks?.longtaskPct || 0;
    const lt = `${ltCount}개 (${ltPct}%)`;
    
    console.log(`  ${cpu} | ${tier} | ${k} | ${debounce} | ${renders} | ${efficiency} | ${tbt} | ${lt}`);
  });

  console.log('');
  console.log('='.repeat(80));

  // 개선율 분석
  if (results.length >= 2) {
    console.log('\n📈 성능 개선 분석');
    console.log('='.repeat(80));
    console.log('');

    const high = results.find(r => r.cpuThrottle === 1);
    const low = results.find(r => r.cpuThrottle === 6);

    if (high && low) {
      const highRenderCount = high.result.renderCount || 0;
      const lowRenderCount = low.result.renderCount || 0;
      const highTBT = high.result.longTasks?.totalBlockedMs || 0;
      const lowTBT = low.result.longTasks?.totalBlockedMs || 0;
      const highLTCount = high.result.longTasks?.count || 0;
      const lowLTCount = low.result.longTasks?.count || 0;

      const renderDiff = lowRenderCount > 0 ? ((highRenderCount - lowRenderCount) / lowRenderCount * 100) : 0;
      const tbtDiff = lowTBT > 0 ? ((lowTBT - highTBT) / lowTBT * 100) : 0;
      const ltDiff = lowLTCount > 0 ? ((lowLTCount - highLTCount) / lowLTCount * 100) : 0;

      const highTier = (high.result.deviceTier || 'unknown').toUpperCase();
      const lowTier = (low.result.deviceTier || 'unknown').toUpperCase();
      const highK = high.result.config?.concurrency || 0;
      const lowK = low.result.config?.concurrency || 0;
      const highDebounce = high.result.config?.ioDebounceMs || 0;
      const lowDebounce = low.result.config?.ioDebounceMs || 0;
      const highRenders = high.result.renderCount || 0;
      const lowRenders = low.result.renderCount || 0;
      const highTBT = high.result.longTasks?.totalBlockedMs || 0;
      const lowTBT = low.result.longTasks?.totalBlockedMs || 0;
      const highLT = high.result.longTasks?.count || 0;
      const lowLT = low.result.longTasks?.count || 0;

      console.log(`  고성능 기기 (CPU 1x) vs 저성능 기기 (CPU 6x):`);
      console.log('');
      console.log(`  기기 티어:`);
      console.log(`    - 고성능: ${highTier} (K=${highK}, 디바운스=${highDebounce}ms)`);
      console.log(`    - 저성능: ${lowTier} (K=${lowK}, 디바운스=${lowDebounce}ms)`);
      console.log('');
      console.log(`  렌더 이벤트: ${lowRenders}개 → ${highRenders}개 (${renderDiff > 0 ? '✅ +' : '❌ '}${renderDiff.toFixed(1)}%)`);
      console.log(`  TBT: ${lowTBT}ms → ${highTBT}ms (${tbtDiff > 0 ? '✅ -' : '❌ +'}${Math.abs(tbtDiff).toFixed(1)}%)`);
      console.log(`  Long Task: ${lowLT}개 → ${highLT}개 (${ltDiff > 0 ? '✅ -' : '❌ +'}${Math.abs(ltDiff).toFixed(1)}%)`);
      console.log('');

      // IO 디바운스 효과 분석
      if (lowDebounce > highDebounce) {
        console.log(`  💡 저성능 기기에서 IO 디바운스(${lowDebounce}ms)가 적용되어 메인 스레드 보호`);
      }
      if (lowK < highK && lowK > 0) {
        console.log(`  💡 저성능 기기에서 동시성(K=${lowK})을 낮춰 과부하 방지`);
      }
    }

    console.log('');
    console.log('='.repeat(80));
  }
}

/**
 * 메인 실행
 */
async function runBenchmark() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║   Device-Aware 렌더 스케줄러 벤치마크 (LongTask)    ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log(`\n설정:`);
  console.log(`  - CPU Throttle: ${cpuThrottle}x`);
  console.log(`  - 스크롤 단계: ${scrollSteps}`);
  console.log(`  - 단계당 딜레이: ${stepDelay}ms`);
  console.log(`  - 현실적 패턴: ${realisticPattern}`);

  const result = await measureDeviceAware(cpuThrottle);

  // 결과 저장
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const filename = `device-aware-cpu${cpuThrottle}x-${timestamp}.json`;
  const filepath = path.join(outDir, filename);
  
  const output = {
    benchmark: 'device-aware-longtask',
    timestamp: new Date().toISOString(),
    settings: {
      cpuThrottle,
      scrollSteps,
      stepDelay,
      realisticPattern,
    },
    result: result,
    cpuThrottle: cpuThrottle,
  };

  fs.writeFileSync(filepath, JSON.stringify(output, null, 2));
  console.log(`\n✅ 결과 저장: ${filepath}`);

  // 개별 요약 출력
  console.log('\n' + '='.repeat(80));
  console.log('📊 측정 결과 요약');
  console.log('='.repeat(80));
  console.log('');
  
  const renderEfficiency = (result.renderCount / (result.duration / 1000)).toFixed(2);
  const tbtPercentage = result.longTasks.longtaskPct;
  
  console.log(`  🎯 기기 티어: ${result.deviceTier.toUpperCase()}`);
  console.log(`  ⚙️  설정:`);
  console.log(`     - K (동시 렌더 상한): ${result.config?.concurrency || 'N/A'}`);
  console.log(`     - IO 디바운스: ${result.config?.ioDebounceMs || 0}ms`);
  console.log(`     - Viewport Margin: ${result.config?.viewportMarginVh || 0}vh`);
  console.log('');
  console.log(`  📈 성능 지표:`);
  console.log(`     - 총 소요 시간: ${(result.duration / 1000).toFixed(2)}초`);
  console.log(`     - 렌더 이벤트: ${result.renderCount}개`);
  console.log(`     - 렌더링 효율: ${renderEfficiency} pages/sec`);
  console.log(`     - 평균 렌더 시간: ${result.avgRenderTimeMs}ms`);
  console.log('');
  console.log(`  📊 이벤트 통계:`);
  console.log(`     - 스크롤 이벤트: ${result.scrollEvents.count}회`);
  console.log(`     - Worker 메시지: ${result.workerMessages.count}개`);
  console.log('');
  console.log(`  ⚡ Long Task 분석:`);
  console.log(`     - Long Task 발생: ${result.longTasks.count}개`);
  console.log(`     - 총 차단 시간 (TBT): ${result.longTasks.totalBlockedMs}ms`);
  console.log(`     - 차단 비율: ${tbtPercentage}%`);
  
  // Long Task 비율에 따른 평가
  console.log('');
  if (tbtPercentage < 5) {
    console.log(`  ✅ 우수! Long Task 비율이 ${tbtPercentage}%로 매우 낮습니다.`);
  } else if (tbtPercentage < 10) {
    console.log(`  ✅ 양호! Long Task 비율이 ${tbtPercentage}%로 적절합니다.`);
  } else if (tbtPercentage < 20) {
    console.log(`  ⚠️  주의! Long Task 비율이 ${tbtPercentage}%로 높습니다.`);
  } else {
    console.log(`  ❌ 경고! Long Task 비율이 ${tbtPercentage}%로 매우 높습니다. 최적화 필요.`);
  }
  
  console.log('');
  console.log('='.repeat(80));

  // 같은 디렉토리에 있는 다른 결과 파일들 찾아서 비교
  try {
    const files = fs.readdirSync(outDir)
      .filter(f => f.startsWith('device-aware-cpu') && f.endsWith('.json'))
      .map(f => path.join(outDir, f));
    
    if (files.length > 1) {
      const allResults = files.map(f => {
        try {
          const data = JSON.parse(fs.readFileSync(f, 'utf8'));
          return data;
        } catch {
          return null;
        }
      }).filter(d => d !== null);

      if (allResults.length > 1) {
        printComparison(allResults);
      }
    }
  } catch (e) {
    // 비교 실패해도 무시
  }
}

// 실행
runBenchmark().catch(console.error);
