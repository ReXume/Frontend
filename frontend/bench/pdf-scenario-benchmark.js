#!/usr/bin/env node
/**
 * PDF 렌더링 시나리오별 성능 비교
 * 
 * 시나리오 2: 점진적 스크롤 (실제 사용자처럼 천천히 읽으면서 스크롤)
 * 시나리오 3: 점프 스크롤 (특정 페이지로 급격하게 이동)
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// ============================================================================
// 설정
// ============================================================================

const CONFIG = {
  baseUrl: 'http://localhost:3000/feedback/4',
  versions: [
    { name: 'PDF (일반)', query: 'version=pdf', key: 'pdf' },
    { name: 'Queue (우선순위 큐)', query: 'version=queue', key: 'queue' }
  ],
  runs: 10,
  cpuThrottle: 4,
  headless: true
};

// ============================================================================
// 유틸리티
// ============================================================================

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
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg,
    median: sorted[Math.floor(sorted.length / 2)]
  };
}

// ============================================================================
// 시나리오 2: 점진적 스크롤
// ============================================================================

async function scenario2_GradualScroll(url, versionName, runNumber) {
  log(`Run ${runNumber}: ${versionName} - 점진적 스크롤`, 1);
  
  const browser = await puppeteer.launch({
    headless: CONFIG.headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1920, height: 1080 }
  });

  const page = await browser.newPage();
  const client = await page.target().createCDPSession();
  await client.send('Emulation.setCPUThrottlingRate', { rate: CONFIG.cpuThrottle });
  await client.send('Performance.enable');

  // 메트릭 수집기 설정
  await page.evaluateOnNewDocument(() => {
    window.__scenarioMetrics = {
      renderTimes: [],
      longTasks: [],
      renderEvents: []
    };

    window.pdfRenderMetricsCollector = {
      metrics: [],
      add: function(metric) {
        this.metrics.push(metric);
        window.__scenarioMetrics.renderEvents.push({
          page: metric.page,
          time: performance.now(),
          duration: metric.totalMs
        });
      }
    };

    if (window.PerformanceObserver) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) {
              window.__scenarioMetrics.longTasks.push({
                duration: entry.duration,
                startTime: entry.startTime
              });
            }
          }
        });
        observer.observe({ entryTypes: ['longtask', 'measure'] });
      } catch (e) {}
    }
  });

  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
  
  // 시나리오 2: 점진적 스크롤
  log(`   📜 점진적 스크롤 시작 (사용자처럼 천천히 읽기)`, 2);
  const scrollMetrics = await page.evaluate(async () => {
    const startTime = performance.now();
    const events = [];
    
    // 스크롤 컨테이너 찾기
    const scrollContainer = Array.from(document.querySelectorAll('div'))
      .find(div => {
        const style = window.getComputedStyle(div);
        return style.overflowY === 'auto' && div.scrollHeight > div.clientHeight;
      });
    
    if (!scrollContainer) {
      return { success: false, error: 'No scroll container' };
    }
    
    const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
    
    // 10개 구간으로 나눠서 천천히 스크롤
    for (let i = 0; i <= 10; i++) {
      const targetScroll = (maxScroll / 10) * i;
      
      // 스크롤
      scrollContainer.scrollTop = targetScroll;
      const scrollTime = performance.now();
      
      // 각 위치에서 2초씩 머물면서 읽기
      await new Promise(r => setTimeout(r, 2000));
      
      events.push({
        position: i,
        scrollTop: targetScroll,
        time: scrollTime - startTime,
        renderedPages: window.__scenarioMetrics.renderEvents.length
      });
    }
    
    const totalTime = performance.now() - startTime;
    
    return {
      success: true,
      totalTime,
      events,
      finalRenderedPages: window.__scenarioMetrics.renderEvents.length,
      longTasks: window.__scenarioMetrics.longTasks.length,
      totalBlockingTime: window.__scenarioMetrics.longTasks
        .reduce((sum, t) => sum + Math.max(0, t.duration - 50), 0)
    };
  });

  const cdpMetrics = await client.send('Performance.getMetrics');
  const jsHeapSize = cdpMetrics.metrics.find(m => m.name === 'JSHeapUsedSize');
  
  await browser.close();

  log(`   ✅ 완료 - ${scrollMetrics.finalRenderedPages}페이지, ${formatMs(scrollMetrics.totalTime)}`, 2);

  return {
    scenario: 'gradual-scroll',
    ...scrollMetrics,
    jsHeapUsedSize: jsHeapSize?.value || 0
  };
}

// ============================================================================
// 시나리오 3: 점프 스크롤
// ============================================================================

async function scenario3_JumpScroll(url, versionName, runNumber) {
  log(`Run ${runNumber}: ${versionName} - 점프 스크롤`, 1);
  
  const browser = await puppeteer.launch({
    headless: CONFIG.headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1920, height: 1080 }
  });

  const page = await browser.newPage();
  const client = await page.target().createCDPSession();
  await client.send('Emulation.setCPUThrottlingRate', { rate: CONFIG.cpuThrottle });
  await client.send('Performance.enable');

  // 메트릭 수집기 설정
  await page.evaluateOnNewDocument(() => {
    window.__scenarioMetrics = {
      renderTimes: [],
      longTasks: [],
      renderEvents: []
    };

    window.pdfRenderMetricsCollector = {
      metrics: [],
      add: function(metric) {
        this.metrics.push(metric);
        window.__scenarioMetrics.renderEvents.push({
          page: metric.page,
          time: performance.now(),
          duration: metric.totalMs
        });
      }
    };

    if (window.PerformanceObserver) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) {
              window.__scenarioMetrics.longTasks.push({
                duration: entry.duration,
                startTime: entry.startTime
              });
            }
          }
        });
        observer.observe({ entryTypes: ['longtask', 'measure'] });
      } catch (e) {}
    }
  });

  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
  
  // 시나리오 3: 점프 스크롤
  log(`   🚀 점프 스크롤 시작 (급격한 위치 변경)`, 2);
  const scrollMetrics = await page.evaluate(async () => {
    const startTime = performance.now();
    const events = [];
    
    // 스크롤 컨테이너 찾기
    const scrollContainer = Array.from(document.querySelectorAll('div'))
      .find(div => {
        const style = window.getComputedStyle(div);
        return style.overflowY === 'auto' && div.scrollHeight > div.clientHeight;
      });
    
    if (!scrollContainer) {
      return { success: false, error: 'No scroll container' };
    }
    
    const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
    
    // 점프 위치들: 0% → 20% → 50% → 80% → 100% → 30% → 70% → 0%
    const jumpPositions = [0, 0.2, 0.5, 0.8, 1.0, 0.3, 0.7, 0];
    
    for (let i = 0; i < jumpPositions.length; i++) {
      const targetScroll = maxScroll * jumpPositions[i];
      const beforeJump = performance.now();
      
      // 순간 이동
      scrollContainer.scrollTop = targetScroll;
      
      // 렌더링 대기 (3초)
      await new Promise(r => setTimeout(r, 3000));
      
      const afterJump = performance.now();
      const rendered = window.__scenarioMetrics.renderEvents.length;
      
      events.push({
        jumpNum: i + 1,
        position: `${(jumpPositions[i] * 100).toFixed(0)}%`,
        scrollTop: targetScroll,
        timeFromStart: beforeJump - startTime,
        renderTime: afterJump - beforeJump,
        renderedPages: rendered
      });
      
      console.log(`Jump ${i + 1}: ${(jumpPositions[i] * 100).toFixed(0)}% → ${rendered}페이지`);
    }
    
    const totalTime = performance.now() - startTime;
    
    return {
      success: true,
      totalTime,
      events,
      finalRenderedPages: window.__scenarioMetrics.renderEvents.length,
      longTasks: window.__scenarioMetrics.longTasks.length,
      totalBlockingTime: window.__scenarioMetrics.longTasks
        .reduce((sum, t) => sum + Math.max(0, t.duration - 50), 0)
    };
  });

  const cdpMetrics = await client.send('Performance.getMetrics');
  const jsHeapSize = cdpMetrics.metrics.find(m => m.name === 'JSHeapUsedSize');
  
  await browser.close();

  log(`   ✅ 완료 - ${scrollMetrics.finalRenderedPages}페이지, ${formatMs(scrollMetrics.totalTime)}`, 2);

  return {
    scenario: 'jump-scroll',
    ...scrollMetrics,
    jsHeapUsedSize: jsHeapSize?.value || 0
  };
}

// ============================================================================
// 메인 실행
// ============================================================================

(async () => {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 PDF 렌더링 시나리오 벤치마크');
  console.log('='.repeat(80));
  console.log(`\n📊 설정: ${CONFIG.runs}회 실행, CPU ${CONFIG.cpuThrottle}x\n`);

  const allResults = {
    scenario2: { pdf: [], queue: [] },
    scenario3: { pdf: [], queue: [] }
  };

  // ============================================================================
  // 시나리오 2: 점진적 스크롤
  // ============================================================================
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 시나리오 2: 점진적 스크롤 (천천히 읽으면서 스크롤)');
  console.log('='.repeat(80));
  console.log('   - 10개 구간으로 나눠서 스크롤');
  console.log('   - 각 위치에서 2초씩 머물기');
  console.log('   - 실제 사용자 읽기 패턴 시뮬레이션\n');

  for (const version of CONFIG.versions) {
    const url = `${CONFIG.baseUrl}?${version.query}`;
    log(`\n📊 테스트 중: ${version.name}`);
    
    for (let i = 1; i <= CONFIG.runs; i++) {
      try {
        const result = await scenario2_GradualScroll(url, version.name, i);
        allResults.scenario2[version.key].push(result);
        
        if (i < CONFIG.runs) {
          await new Promise(r => setTimeout(r, 2000));
        }
      } catch (error) {
        log(`   ❌ 에러: ${error.message}`, 2);
      }
    }
  }

  // ============================================================================
  // 시나리오 3: 점프 스크롤
  // ============================================================================
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 시나리오 3: 점프 스크롤 (급격한 위치 변경)');
  console.log('='.repeat(80));
  console.log('   - 0% → 20% → 50% → 80% → 100% → 30% → 70% → 0%');
  console.log('   - 각 점프 후 3초 대기');
  console.log('   - 우선순위 재조정 능력 테스트\n');

  for (const version of CONFIG.versions) {
    const url = `${CONFIG.baseUrl}?${version.query}`;
    log(`\n📊 테스트 중: ${version.name}`);
    
    for (let i = 1; i <= CONFIG.runs; i++) {
      try {
        const result = await scenario3_JumpScroll(url, version.name, i);
        allResults.scenario3[version.key].push(result);
        
        if (i < CONFIG.runs) {
          await new Promise(r => setTimeout(r, 2000));
        }
      } catch (error) {
        log(`   ❌ 에러: ${error.message}`, 2);
      }
    }
  }

  // ============================================================================
  // 결과 분석
  // ============================================================================

  console.log('\n\n' + '='.repeat(80));
  console.log('📊 시나리오별 성능 비교 결과');
  console.log('='.repeat(80));

  // 시나리오 2 결과
  console.log('\n📊 시나리오 2: 점진적 스크롤');
  console.log('-'.repeat(80));
  console.log('메트릭'.padEnd(35) + 'PDF (일반)'.padEnd(25) + 'Queue (우선순위 큐)'.padEnd(25));
  console.log('-'.repeat(80));

  const s2_pdf = allResults.scenario2.pdf;
  const s2_queue = allResults.scenario2.queue;

  const s2_totalTime_pdf = calculateStats(s2_pdf.map(r => r.totalTime));
  const s2_totalTime_queue = calculateStats(s2_queue.map(r => r.totalTime));

  console.log(
    '총 소요 시간'.padEnd(35) +
    formatMs(s2_totalTime_pdf?.avg).padEnd(25) +
    formatMs(s2_totalTime_queue?.avg).padEnd(25)
  );

  const s2_pages_pdf = calculateStats(s2_pdf.map(r => r.finalRenderedPages));
  const s2_pages_queue = calculateStats(s2_queue.map(r => r.finalRenderedPages));

  console.log(
    '렌더링된 페이지 수'.padEnd(35) +
    `${s2_pages_pdf?.avg.toFixed(1)}개`.padEnd(25) +
    `${s2_pages_queue?.avg.toFixed(1)}개`.padEnd(25)
  );

  const s2_longTasks_pdf = calculateStats(s2_pdf.map(r => r.longTasks));
  const s2_longTasks_queue = calculateStats(s2_queue.map(r => r.longTasks));

  console.log(
    'Long Tasks 수'.padEnd(35) +
    `${s2_longTasks_pdf?.avg.toFixed(1)}개`.padEnd(25) +
    `${s2_longTasks_queue?.avg.toFixed(1)}개`.padEnd(25)
  );

  const s2_tbt_pdf = calculateStats(s2_pdf.map(r => r.totalBlockingTime));
  const s2_tbt_queue = calculateStats(s2_queue.map(r => r.totalBlockingTime));

  console.log(
    'Total Blocking Time'.padEnd(35) +
    formatMs(s2_tbt_pdf?.avg).padEnd(25) +
    formatMs(s2_tbt_queue?.avg).padEnd(25)
  );

  const s2_mem_pdf = calculateStats(s2_pdf.map(r => r.jsHeapUsedSize));
  const s2_mem_queue = calculateStats(s2_queue.map(r => r.jsHeapUsedSize));

  console.log(
    'JS Heap Used'.padEnd(35) +
    `${(s2_mem_pdf?.avg / 1024 / 1024).toFixed(2)}MB`.padEnd(25) +
    `${(s2_mem_queue?.avg / 1024 / 1024).toFixed(2)}MB`.padEnd(25)
  );

  // 시나리오 3 결과
  console.log('\n📊 시나리오 3: 점프 스크롤');
  console.log('-'.repeat(80));
  console.log('메트릭'.padEnd(35) + 'PDF (일반)'.padEnd(25) + 'Queue (우선순위 큐)'.padEnd(25));
  console.log('-'.repeat(80));

  const s3_pdf = allResults.scenario3.pdf;
  const s3_queue = allResults.scenario3.queue;

  const s3_totalTime_pdf = calculateStats(s3_pdf.map(r => r.totalTime));
  const s3_totalTime_queue = calculateStats(s3_queue.map(r => r.totalTime));

  console.log(
    '총 소요 시간'.padEnd(35) +
    formatMs(s3_totalTime_pdf?.avg).padEnd(25) +
    formatMs(s3_totalTime_queue?.avg).padEnd(25)
  );

  const s3_pages_pdf = calculateStats(s3_pdf.map(r => r.finalRenderedPages));
  const s3_pages_queue = calculateStats(s3_queue.map(r => r.finalRenderedPages));

  console.log(
    '렌더링된 페이지 수'.padEnd(35) +
    `${s3_pages_pdf?.avg.toFixed(1)}개`.padEnd(25) +
    `${s3_pages_queue?.avg.toFixed(1)}개`.padEnd(25)
  );

  const s3_longTasks_pdf = calculateStats(s3_pdf.map(r => r.longTasks));
  const s3_longTasks_queue = calculateStats(s3_queue.map(r => r.longTasks));

  console.log(
    'Long Tasks 수'.padEnd(35) +
    `${s3_longTasks_pdf?.avg.toFixed(1)}개`.padEnd(25) +
    `${s3_longTasks_queue?.avg.toFixed(1)}개`.padEnd(25)
  );

  const s3_tbt_pdf = calculateStats(s3_pdf.map(r => r.totalBlockingTime));
  const s3_tbt_queue = calculateStats(s3_queue.map(r => r.totalBlockingTime));

  console.log(
    'Total Blocking Time'.padEnd(35) +
    formatMs(s3_tbt_pdf?.avg).padEnd(25) +
    formatMs(s3_tbt_queue?.avg).padEnd(25)
  );

  const s3_mem_pdf = calculateStats(s3_pdf.map(r => r.jsHeapUsedSize));
  const s3_mem_queue = calculateStats(s3_queue.map(r => r.jsHeapUsedSize));

  console.log(
    'JS Heap Used'.padEnd(35) +
    `${(s3_mem_pdf?.avg / 1024 / 1024).toFixed(2)}MB`.padEnd(25) +
    `${(s3_mem_queue?.avg / 1024 / 1024).toFixed(2)}MB`.padEnd(25)
  );

  // ============================================================================
  // 개선율 요약
  // ============================================================================

  console.log('\n\n' + '='.repeat(80));
  console.log('🏆 우선순위 큐 개선율');
  console.log('='.repeat(80));

  const improvements = [];

  // 시나리오 2
  console.log('\n🌊 시나리오 2: 점진적 스크롤');
  
  const s2_pageImprovement = ((s2_pages_pdf?.avg - s2_pages_queue?.avg) / s2_pages_pdf?.avg * 100);
  const s2_longTaskImprovement = ((s2_longTasks_pdf?.avg - s2_longTasks_queue?.avg) / s2_longTasks_pdf?.avg * 100);
  const s2_tbtImprovement = ((s2_tbt_pdf?.avg - s2_tbt_queue?.avg) / s2_tbt_pdf?.avg * 100);
  
  console.log(`  렌더링 페이지 수: ${s2_pageImprovement > 0 ? '✅' : '❌'} ${s2_pageImprovement.toFixed(2)}%`);
  console.log(`  Long Tasks 감소: ${s2_longTaskImprovement > 0 ? '✅' : '❌'} ${s2_longTaskImprovement.toFixed(2)}%`);
  console.log(`  TBT 감소: ${s2_tbtImprovement > 0 ? '✅' : '❌'} ${s2_tbtImprovement.toFixed(2)}%`);

  improvements.push(
    { name: 'S2: 페이지 수', value: s2_pageImprovement, better: s2_pageImprovement < 0 },
    { name: 'S2: Long Tasks', value: s2_longTaskImprovement, better: s2_longTaskImprovement > 0 },
    { name: 'S2: TBT', value: s2_tbtImprovement, better: s2_tbtImprovement > 0 }
  );

  // 시나리오 3
  console.log('\n🚀 시나리오 3: 점프 스크롤');
  
  const s3_pageImprovement = ((s3_pages_pdf?.avg - s3_pages_queue?.avg) / s3_pages_pdf?.avg * 100);
  const s3_longTaskImprovement = ((s3_longTasks_pdf?.avg - s3_longTasks_queue?.avg) / s3_longTasks_pdf?.avg * 100);
  const s3_tbtImprovement = ((s3_tbt_pdf?.avg - s3_tbt_queue?.avg) / s3_tbt_pdf?.avg * 100);
  
  console.log(`  렌더링 페이지 수: ${s3_pageImprovement > 0 ? '✅' : '❌'} ${s3_pageImprovement.toFixed(2)}%`);
  console.log(`  Long Tasks 감소: ${s3_longTaskImprovement > 0 ? '✅' : '❌'} ${s3_longTaskImprovement.toFixed(2)}%`);
  console.log(`  TBT 감소: ${s3_tbtImprovement > 0 ? '✅' : '❌'} ${s3_tbtImprovement.toFixed(2)}%`);

  improvements.push(
    { name: 'S3: 페이지 수', value: s3_pageImprovement, better: s3_pageImprovement < 0 },
    { name: 'S3: Long Tasks', value: s3_longTaskImprovement, better: s3_longTaskImprovement > 0 },
    { name: 'S3: TBT', value: s3_tbtImprovement, better: s3_tbtImprovement > 0 }
  );

  const totalImprovements = improvements.filter(i => i.better).length;
  const avgImprovement = improvements.reduce((sum, i) => sum + i.value, 0) / improvements.length;

  console.log('\n' + '-'.repeat(80));
  console.log(`📊 개선된 메트릭: ${totalImprovements}/${improvements.length}`);
  console.log(`📈 평균 개선율: ${avgImprovement.toFixed(2)}%`);
  console.log('-'.repeat(80));

  // 결과 저장
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(__dirname, 'bench_out');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const resultPath = path.join(outDir, `scenario-comparison-${timestamp}.json`);
  fs.writeFileSync(resultPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    config: CONFIG,
    results: allResults,
    improvements,
    summary: { totalImprovements, avgImprovement }
  }, null, 2));

  console.log(`\n📁 결과 저장: ${resultPath}`);
  console.log('\n✅ 벤치마크 완료!\n');
})();

