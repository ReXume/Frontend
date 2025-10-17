#!/usr/bin/env node
/**
 * 기기 성능별 PDF 렌더링 벤치마크 (현실적 사용자 패턴)
 * 
 * 목적:
 * - 저사양/중사양/고사양 기기에서의 성능 차이 측정
 * - 현실적 사용자 패턴(스크롤 → 읽기 → 반복)으로 일관된 비교
 * - bench-pdfjs-longtasks.js의 realistic 패턴과 동일
 * 
 * 사용:
 *   # 전체 기기 테스트 (PDF vs Queue)
 *   node bench/bench-device-behavior.js \
 *     --url1 "http://localhost:3000/feedback/4?version=pdf" --name1 "PDF" \
 *     --url2 "http://localhost:3000/feedback/4?version=queue" --name2 "Queue"
 *   
 *   # 특정 기기만 테스트
 *   node bench/bench-device-behavior.js --url "..." --devices "low,high"
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
const headless = String(arg('headless', 'true')) === 'true';

// 필터링 옵션
const deviceFilter = arg('devices', null); // 예: "low,high"

const benchDir = __dirname;
const outDir = path.join(benchDir, 'bench_out');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

/**
 * 기기 프로필 정의
 */
const DEVICE_PROFILES = {
  'low': {
    name: '저사양 기기',
    cpuThrottle: 6,
    description: '오래된 스마트폰, 저가형 노트북 (6x CPU throttle)',
    emoji: '🐌',
  },
  'mid': {
    name: '중사양 기기',
    cpuThrottle: 3,
    description: '일반 노트북, 중급 스마트폰 (3x CPU throttle)',
    emoji: '🚗',
  },
  'high': {
    name: '고사양 기기',
    cpuThrottle: 1,
    description: '최신 노트북, 플래그십 스마트폰 (throttle 없음)',
    emoji: '🚀',
  },
};

/**
 * 사용자 행동 패턴 정의
 * bench-pdfjs-longtasks.js의 realistic 패턴 사용
 */
const BEHAVIOR_PATTERNS = {
  'realistic': {
    name: '현실적 사용자 패턴',
    description: '스크롤 쭉 내리고 → 읽기 → 반복 (bench-pdfjs-longtasks.js와 동일)',
    emoji: '🎯',
    execute: async (scrollContainer, maxScroll) => {
      console.log('[Behavior] 🎯 현실적 패턴 시작: 스크롤 → 읽기 → 반복');
      
      const scrollChunkSize = 300; // 한 번에 스크롤할 픽셀 수
      const scrollSpeed = 50; // 스크롤 속도 (ms 간격)
      const readTime = 1500; // 읽는 시간 (1.5초)
      const readDistance = 800; // 읽기 위해 스크롤하는 거리
      
      // 최대 스크롤 제한 - 약 15페이지까지 측정
      const maxMeasureScroll = Math.min(maxScroll, 15000); // 15000px ≈ 약 15페이지
      console.log(`[Behavior] 전체: ${maxScroll}px, 측정 범위: ${maxMeasureScroll}px (약 15페이지)`);
      
      let currentScroll = 0;
      let chunkCount = 0;
      
      while (currentScroll < maxMeasureScroll) {
        chunkCount++;
        
        // 1. 스크롤을 쭉 내림 (빠르게)
        const targetScroll = Math.min(currentScroll + readDistance, maxMeasureScroll);
        console.log(`[Behavior] Chunk ${chunkCount}: ${currentScroll.toFixed(0)}px → ${targetScroll.toFixed(0)}px (빠르게 스크롤)`);
        
        while (currentScroll < targetScroll) {
          currentScroll += scrollChunkSize;
          if (currentScroll > targetScroll) currentScroll = targetScroll;
          scrollContainer.scrollTop = currentScroll;
          await new Promise(r => setTimeout(r, scrollSpeed));
        }
        
        // 2. 멈춰서 읽기
        console.log(`[Behavior] 📖 읽는 중... (${readTime}ms 대기)`);
        await new Promise(r => setTimeout(r, readTime));
        
        // 3. 아주 가끔 위로 조금 스크롤 (실제 사용자처럼)
        if (chunkCount % 3 === 0 && currentScroll > 200) {
          console.log(`[Behavior] ⬆️  위로 조금 스크롤 (다시 보기)`);
          currentScroll -= 150;
          scrollContainer.scrollTop = currentScroll;
          await new Promise(r => setTimeout(r, 500));
        }
      }
      
      console.log(`[Behavior] 🎯 현실적 패턴 완료: 총 ${chunkCount}개 청크`);
    },
  },
};

/**
 * 기기 + 행동 패턴으로 측정
 */
async function measureWithDeviceAndBehavior(testUrl, versionName, deviceProfile, behaviorPattern) {
  const testName = `${versionName}-${deviceProfile.emoji}${deviceProfile.name}-${behaviorPattern.emoji}${behaviorPattern.name}`;
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 측정: ${testName}`);
  console.log(`   URL: ${testUrl}`);
  console.log(`   기기: ${deviceProfile.emoji} ${deviceProfile.name} (CPU ${deviceProfile.cpuThrottle}x)`);
  console.log(`   행동: ${behaviorPattern.emoji} ${behaviorPattern.name}`);
  console.log(`${'='.repeat(80)}`);
  
  const browser = await puppeteer.launch({
    headless: headless ? 'new' : false,
    defaultViewport: { width: 1920, height: 1080 },
    args: ['--disable-dev-shm-usage', '--no-sandbox'],
    protocolTimeout: 300000,
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(300000);

  // CPU throttling 적용
  if (deviceProfile.cpuThrottle > 1) {
    const client = await page.target().createCDPSession();
    await client.send('Emulation.setCPUThrottlingRate', { rate: deviceProfile.cpuThrottle });
  }

  // 콘솔 로그 포워딩
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('[PDFTrace]') || text.includes('[LongTask]') || text.includes('[Behavior]')) {
      console.log(`   ${text}`);
    }
  });

  // 페이지 로드 전 메트릭 설정
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

    // Worker postMessage intercept
    const patchPDFJS = () => {
      try {
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
            });
            return originalPostMessage(message, ...rest);
          };
          
          return worker;
        };
      } catch (e) {
        console.error('[PDFTrace] 패치 실패:', e);
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', patchPDFJS);
    } else {
      patchPDFJS();
    }
  });

  console.log('   페이지 로딩 중...');
  await page.goto(testUrl, { 
    waitUntil: ['networkidle2', 'domcontentloaded'], 
    timeout: 60000 
  });

  console.log('   초기화 대기...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 버전 정보
  const versionInfo = await page.evaluate(() => {
    const versionDiv = document.querySelector('.bg-blue-100');
    return {
      versionText: versionDiv?.textContent?.trim() || 'Unknown',
      hasCollector: typeof window.pdfRenderMetricsCollector !== 'undefined',
    };
  });
  
  console.log(`   버전: ${versionInfo.versionText}, 수집기: ${versionInfo.hasCollector ? '✅' : '❌'}`);

  // 측정 시작
  await page.evaluate(() => {
    window.__pdfJsMetrics.startTime = performance.now();
  });

  console.log('   행동 패턴 실행 시작...');
  
  // 행동 패턴을 문자열로 전달하여 페이지에서 실행
  const behaviorCode = behaviorPattern.execute.toString();
  
  const result = await page.evaluate(async (behaviorCode) => {
    // 스크롤 컨테이너 찾기
    const scrollContainer = Array.from(document.querySelectorAll('div'))
      .find(div => {
        const style = window.getComputedStyle(div);
        return style.overflowY === 'auto' && div.scrollHeight > div.clientHeight;
      });
    
    if (!scrollContainer) {
      return { success: false, error: 'No scroll container found' };
    }

    const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
    console.log(`[Scroll] 컨테이너: ${scrollContainer.scrollHeight}px (max: ${maxScroll}px)`);

    // 스크롤 이벤트 리스너
    let scrollEventCount = 0;
    const scrollListener = () => {
      scrollEventCount++;
      window.__pdfJsMetrics.scrollEvents.push({
        timestamp: performance.now(),
        scrollTop: scrollContainer.scrollTop,
        eventNumber: scrollEventCount,
      });
    };
    scrollContainer.addEventListener('scroll', scrollListener, { passive: true });

    // 행동 패턴 실행
    try {
      // behaviorCode는 "async (scrollContainer, maxScroll) => { ... }" 형태의 문자열
      const behaviorFunc = eval(`(${behaviorCode})`);
      await behaviorFunc(scrollContainer, maxScroll);
    } catch (e) {
      console.error('[Behavior] 실행 오류:', e);
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
  }, behaviorCode);

  await browser.close();

  if (!result.success) {
    console.error(`   ❌ 측정 실패: ${result.error || 'Unknown error'}`);
    return null;
  }

  // 메트릭 계산
  const totalBlockingTime = result.longTasks.reduce((sum, task) => sum + Math.max(0, task.duration - 50), 0);
  const avgLongTaskDuration = result.longTasks.length > 0 
    ? result.longTasks.reduce((sum, task) => sum + task.duration, 0) / result.longTasks.length 
    : 0;
  const renderEfficiency = result.renderEvents.length > 0 
    ? (result.renderEvents.length / (result.duration / 1000)).toFixed(2)
    : 0;
  
  console.log(`   ✅ 측정 완료`);
  console.log(`      - 소요 시간: ${(result.duration / 1000).toFixed(2)}s`);
  console.log(`      - 렌더 이벤트: ${result.renderEvents.length}개 (${renderEfficiency} pages/sec)`);
  console.log(`      - sendWithPromise: ${result.sendWithPromiseCalls.length}회`);
  console.log(`      - LongTask: ${result.longTasks.length}개 (평균 ${avgLongTaskDuration.toFixed(2)}ms)`);
  console.log(`      - Total Blocking Time: ${totalBlockingTime.toFixed(2)}ms`);
  console.log(`      - 스크롤 이벤트: ${result.scrollEvents.length}회`);

  if (result.renderEvents.length === 0) {
    console.warn(`   ⚠️  렌더 이벤트가 0개입니다!`);
  }

  return {
    testName,
    version: versionName,
    device: deviceProfile.name,
    deviceEmoji: deviceProfile.emoji,
    cpuThrottle: deviceProfile.cpuThrottle,
    behavior: behaviorPattern.name,
    behaviorEmoji: behaviorPattern.emoji,
    detectedVersion: versionInfo.versionText,
    url: testUrl,
    duration: result.duration,
    renderEvents: result.renderEvents,
    renderEventsCount: result.renderEvents.length,
    renderEfficiency: parseFloat(renderEfficiency),
    sendWithPromiseCalls: result.sendWithPromiseCalls.length,
    longTasks: result.longTasks.length,
    avgLongTaskDuration,
    totalBlockingTime,
    scrollEvents: result.scrollEvents.length,
    timestamp: new Date().toISOString(),
  };
}

/**
 * 결과 분석 및 출력
 */
function analyzeResults(results) {
  console.log('\n\n' + '='.repeat(100));
  console.log('📊 종합 분석 결과');
  console.log('='.repeat(100));

  // 1. 기기별 분석
  console.log('\n🔹 기기별 성능 비교');
  console.log('-'.repeat(100));
  
  const byDevice = {};
  results.forEach(r => {
    if (!byDevice[r.device]) byDevice[r.device] = [];
    byDevice[r.device].push(r);
  });

  Object.entries(byDevice).forEach(([device, items]) => {
    const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
    console.log(`\n${items[0].deviceEmoji} ${device} (n=${items.length}):`);
    console.log(`   평균 렌더링 효율: ${avg(items.map(i => i.renderEfficiency)).toFixed(2)} pages/sec`);
    console.log(`   평균 TBT: ${avg(items.map(i => i.totalBlockingTime)).toFixed(1)}ms`);
    console.log(`   평균 LongTask: ${avg(items.map(i => i.longTasks)).toFixed(1)}개`);
    console.log(`   평균 소요 시간: ${(avg(items.map(i => i.duration)) / 1000).toFixed(1)}s`);
  });

  // 2. 행동 패턴별 분석
  console.log('\n\n🔹 행동 패턴별 성능 비교');
  console.log('-'.repeat(100));
  
  const byBehavior = {};
  results.forEach(r => {
    if (!byBehavior[r.behavior]) byBehavior[r.behavior] = [];
    byBehavior[r.behavior].push(r);
  });

  Object.entries(byBehavior).forEach(([behavior, items]) => {
    const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
    console.log(`\n${items[0].behaviorEmoji} ${behavior} (n=${items.length}):`);
    console.log(`   평균 렌더링 효율: ${avg(items.map(i => i.renderEfficiency)).toFixed(2)} pages/sec`);
    console.log(`   평균 TBT: ${avg(items.map(i => i.totalBlockingTime)).toFixed(1)}ms`);
    console.log(`   평균 LongTask: ${avg(items.map(i => i.longTasks)).toFixed(1)}개`);
    console.log(`   평균 스크롤 이벤트: ${avg(items.map(i => i.scrollEvents)).toFixed(0)}회`);
  });

  // 3. 버전별 분석
  console.log('\n\n🔹 버전별 성능 비교');
  console.log('-'.repeat(100));
  
  const byVersion = {};
  results.forEach(r => {
    if (!byVersion[r.version]) byVersion[r.version] = [];
    byVersion[r.version].push(r);
  });

  Object.entries(byVersion).forEach(([version, items]) => {
    const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
    console.log(`\n${version} (n=${items.length}):`);
    console.log(`   평균 렌더링 효율: ${avg(items.map(i => i.renderEfficiency)).toFixed(2)} pages/sec`);
    console.log(`   평균 TBT: ${avg(items.map(i => i.totalBlockingTime)).toFixed(1)}ms`);
    console.log(`   평균 LongTask: ${avg(items.map(i => i.longTasks)).toFixed(1)}개`);
    console.log(`   평균 sendWithPromise: ${avg(items.map(i => i.sendWithPromiseCalls)).toFixed(0)}회`);
  });

  // 4. 히트맵 형태로 출력 (기기 × 행동)
  if (Object.keys(byDevice).length > 1 && Object.keys(byBehavior).length > 1) {
    console.log('\n\n🔹 Total Blocking Time 히트맵 (기기 × 행동)');
    console.log('-'.repeat(100));
    
    const devices = Object.keys(byDevice);
    const behaviors = Object.keys(byBehavior);
    
    // 헤더
    let header = '기기 \\ 행동'.padEnd(20);
    behaviors.forEach(b => {
      const emoji = results.find(r => r.behavior === b)?.behaviorEmoji || '';
      header += `${emoji}${b}`.padEnd(20);
    });
    console.log(header);
    console.log('-'.repeat(100));
    
    // 각 기기별 행동 패턴 데이터
    devices.forEach(device => {
      const emoji = results.find(r => r.device === device)?.deviceEmoji || '';
      let row = `${emoji}${device}`.padEnd(20);
      
      behaviors.forEach(behavior => {
        const matches = results.filter(r => r.device === device && r.behavior === behavior);
        if (matches.length > 0) {
          const avgTbt = matches.reduce((sum, m) => sum + m.totalBlockingTime, 0) / matches.length;
          row += `${avgTbt.toFixed(0)}ms`.padEnd(20);
        } else {
          row += 'N/A'.padEnd(20);
        }
      });
      
      console.log(row);
    });
  }

  // 5. 가장 좋은/나쁜 조합
  console.log('\n\n🔹 Best & Worst 조합 (Total Blocking Time 기준)');
  console.log('-'.repeat(100));
  
  const sorted = [...results].sort((a, b) => a.totalBlockingTime - b.totalBlockingTime);
  
  console.log('\n✅ Best 3:');
  sorted.slice(0, 3).forEach((r, idx) => {
    console.log(`   ${idx + 1}. ${r.deviceEmoji}${r.device} × ${r.behaviorEmoji}${r.behavior} [${r.version}]`);
    console.log(`      TBT: ${r.totalBlockingTime.toFixed(0)}ms, LongTask: ${r.longTasks}개, 효율: ${r.renderEfficiency} pages/sec`);
  });
  
  console.log('\n❌ Worst 3:');
  sorted.slice(-3).reverse().forEach((r, idx) => {
    console.log(`   ${idx + 1}. ${r.deviceEmoji}${r.device} × ${r.behaviorEmoji}${r.behavior} [${r.version}]`);
    console.log(`      TBT: ${r.totalBlockingTime.toFixed(0)}ms, LongTask: ${r.longTasks}개, 효율: ${r.renderEfficiency} pages/sec`);
  });
}

/**
 * 버전 간 비교 (같은 기기+행동 조합)
 */
function compareVersionsByScenario(results) {
  const versions = [...new Set(results.map(r => r.version))];
  if (versions.length < 2) return;

  console.log('\n\n' + '='.repeat(100));
  console.log('🔍 버전 간 비교 (같은 조건)');
  console.log('='.repeat(100));

  const scenarios = {};
  results.forEach(r => {
    const key = `${r.device}|${r.behavior}`;
    if (!scenarios[key]) scenarios[key] = {};
    scenarios[key][r.version] = r;
  });

  Object.entries(scenarios).forEach(([key, versionData]) => {
    const [device, behavior] = key.split('|');
    
    if (Object.keys(versionData).length < 2) return; // 비교할 버전이 없으면 스킵
    
    const versionList = Object.keys(versionData);
    const v1 = versionData[versionList[0]];
    const v2 = versionData[versionList[1]];
    
    console.log(`\n${v1.deviceEmoji}${device} × ${v1.behaviorEmoji}${behavior}`);
    console.log('-'.repeat(80));
    console.log(`메트릭`.padEnd(30) + `${v1.version}`.padEnd(20) + `${v2.version}`.padEnd(20) + `개선율`);
    console.log('-'.repeat(80));
    
    const metrics = [
      { name: '렌더링 효율', key: 'renderEfficiency', unit: ' p/s', higher: true },
      { name: 'Total Blocking Time', key: 'totalBlockingTime', unit: 'ms', higher: false },
      { name: 'LongTask 수', key: 'longTasks', unit: '개', higher: false },
      { name: 'sendWithPromise 호출', key: 'sendWithPromiseCalls', unit: '회', higher: false },
      { name: '소요 시간', key: 'duration', unit: 'ms', higher: false },
    ];
    
    metrics.forEach(metric => {
      const val1 = v1[metric.key];
      const val2 = v2[metric.key];
      const diff = val2 - val1;
      const diffPercent = val1 > 0 ? (diff / val1 * 100) : 0;
      
      let indicator = '➖';
      if (metric.higher) {
        indicator = diff > 0 ? '✅' : (diff < 0 ? '❌' : '➖');
      } else {
        indicator = diff < 0 ? '✅' : (diff > 0 ? '❌' : '➖');
      }
      
      const val1Str = (typeof val1 === 'number' ? val1.toFixed(metric.unit === 'ms' ? 0 : 2) : val1) + metric.unit;
      const val2Str = (typeof val2 === 'number' ? val2.toFixed(metric.unit === 'ms' ? 0 : 2) : val2) + metric.unit;
      const diffStr = `${indicator} ${diffPercent.toFixed(1)}%`;
      
      console.log(metric.name.padEnd(30) + val1Str.padEnd(20) + val2Str.padEnd(20) + diffStr);
    });
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
    console.error('  cd frontend');
    console.error('  node bench/bench-device-behavior.js --url "http://localhost:3000/feedback/4?version=pdf"');
    console.error('  node bench/bench-device-behavior.js --url1 "..." --name1 "PDF" --url2 "..." --name2 "Queue"');
    console.error('\n또는 헬퍼 스크립트 사용 (추천):');
    console.error('  cd frontend/bench');
    console.error('  ./run-device-behavior-test.sh quick');
    console.error('\n옵션:');
    console.error('  --devices "low,high"    : 특정 기기만 테스트 (기본: 전체)');
    console.error('  --headless "false"      : 브라우저 창 표시');
    console.error('\n행동 패턴:');
    console.error('  🎯 현실적 패턴 (스크롤 → 읽기 → 반복) 고정');
    process.exit(1);
  }

  // 필터 적용
  let devices = Object.keys(DEVICE_PROFILES);
  const behaviors = ['realistic']; // 항상 현실적 패턴만 사용
  
  if (deviceFilter) {
    devices = deviceFilter.split(',').map(d => d.trim()).filter(d => DEVICE_PROFILES[d]);
    console.log(`🔧 기기 필터: ${devices.join(', ')}`);
  }

  console.log('\n🚀 기기별 성능 벤치마크 (현실적 사용자 패턴)');
  console.log('='.repeat(100));
  console.log(`URL 수: ${urls.length}개`);
  console.log(`기기 프로필: ${devices.length}개 (${devices.join(', ')})`);
  console.log(`행동 패턴: 🎯 현실적 패턴 (스크롤 → 읽기 → 반복) 고정`);
  console.log(`총 테스트: ${urls.length * devices.length}회`);
  console.log('='.repeat(100));

  const results = [];
  let testCount = 0;
  const totalTests = urls.length * devices.length;

  for (const { url, name } of urls) {
    for (const deviceKey of devices) {
      const device = DEVICE_PROFILES[deviceKey];
      const behavior = BEHAVIOR_PATTERNS['realistic']; // 항상 realistic 패턴 사용
      
      testCount++;
      console.log(`\n\n진행: ${testCount}/${totalTests}`);
      
      const result = await measureWithDeviceAndBehavior(url, name, device, behavior);
      if (result) {
        results.push(result);
      }
      
      // 테스트 간 대기 (브라우저 정리)
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // 결과 분석
  analyzeResults(results);
  compareVersionsByScenario(results);

  // 결과 저장
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = path.join(outDir, `device-behavior-${timestamp}.json`);
  
  fs.writeFileSync(outputPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    config: {
      headless,
      devices: devices.map(d => ({ key: d, ...DEVICE_PROFILES[d] })),
      behavior: {
        key: 'realistic',
        name: '현실적 사용자 패턴',
        description: 'bench-pdfjs-longtasks.js의 realistic 패턴과 동일',
      },
    },
    totalTests,
    results,
  }, null, 2));

  console.log(`\n\n💾 결과 저장: ${outputPath}`);
  console.log(`   총 ${results.length}개 테스트 완료`);
  console.log('\n✅ 벤치마크 완료!\n');

})().catch((e) => {
  console.error('❌ 오류 발생:', e);
  process.exit(1);
});

