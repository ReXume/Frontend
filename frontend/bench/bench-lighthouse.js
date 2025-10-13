#!/usr/bin/env node
/**
 * bench-lighthouse.js — Lighthouse 전용 벤치마크 (3가지 버전 비교)
 *
 * 필수 패키지:
 *   npm install lighthouse chrome-launcher
 *
 * 사용 예:
 *   # 3가지 URL 비교 (각각 1회씩) - 기본
 *   node bench/bench-lighthouse.js \
 *     --url1 "http://localhost:3000/feedback/4?version=old" \
 *     --url2 "http://localhost:3000/feedback/4?version=pdf" \
 *     --url3 "http://localhost:3000/feedback/4?version=new"
 *
 *   # 이름 지정하기
 *   node bench/bench-lighthouse.js \
 *     --url1 "http://localhost:3000/feedback/4?version=old" --name1 "Old Version" \
 *     --url2 "http://localhost:3000/feedback/4?version=pdf" --name2 "PDF Version" \
 *     --url3 "http://localhost:3000/feedback/4?version=new" --name3 "New Version"
 *
 *   # 여러 번 실행 (통계용)
 *   node bench/bench-lighthouse.js \
 *     --url1 "http://localhost:3000/feedback/4?version=old" \
 *     --url2 "http://localhost:3000/feedback/4?version=pdf" \
 *     --url3 "http://localhost:3000/feedback/4?version=new" \
 *     --runs 3
 */

const fs = require('fs');
const path = require('path');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  if (i === -1) return def;
  const next = process.argv[i + 1];
  if (!next || next.startsWith('--')) return true; // boolean flag
  return next;
}

// ---- 인자 ----
const url1 = arg('url1', null);
const url2 = arg('url2', null);
const url3 = arg('url3', null);
const name1 = arg('name1', 'Version 1');
const name2 = arg('name2', 'Version 2');
const name3 = arg('name3', 'Version 3');
const runs = parseInt(arg('runs', '1'), 10); // 각 URL당 실행 횟수
const port = parseInt(arg('port', '3009'), 10);

// ---- 출력 경로 ----
const benchDir = __dirname;
const projectRoot = path.resolve(benchDir, '..');
const outDir = path.join(benchDir, 'bench_out');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

async function runSingleBench(versionName, testUrl, runNumber, totalRuns) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${versionName} - Run ${runNumber}/${totalRuns} 시작...`);
  console.log('='.repeat(60));

  const start = Date.now();

  let results = { 
    versionName,
    url: testUrl, 
    runNumber,
    timestamp: new Date().toISOString()
  };

  // Lighthouse 공식 지표 수집 (Lighthouse가 자체적으로 브라우저 실행)
  console.log('[Lighthouse] 측정 시작:', testUrl);
  try {
    const { default: lighthouse } = await import('lighthouse');
    const chromeLauncher = await import('chrome-launcher');
    
    // Chrome 실행
    const chrome = await chromeLauncher.launch({
      chromeFlags: ['--headless', '--disable-dev-shm-usage', '--no-sandbox']
    });

    const runnerResult = await lighthouse(testUrl, {
      logLevel: 'error',
      output: 'json',
      onlyCategories: ['performance'],
      port: chrome.port,
    });

    await chrome.kill();

    if (runnerResult && runnerResult.lhr) {
      const lhr = runnerResult.lhr;
      const audits = lhr.audits;
      results.lighthouse = {
        performanceScore: lhr.categories.performance.score * 100,
        metrics: {
          firstContentfulPaint: audits['first-contentful-paint']?.numericValue,
          largestContentfulPaint: audits['largest-contentful-paint']?.numericValue,
          totalBlockingTime: audits['total-blocking-time']?.numericValue,
          cumulativeLayoutShift: audits['cumulative-layout-shift']?.numericValue,
          speedIndex: audits['speed-index']?.numericValue,
          interactive: audits['interactive']?.numericValue,
        },
      };

      console.log(`[Lighthouse] 완료 - Score: ${results.lighthouse.performanceScore?.toFixed(1)}`);
    }
  } catch (e) {
    console.error('[Lighthouse] 실행 실패:', e?.message || e);
  }

  results.totalTime = Date.now() - start;

  // 저장
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeName = versionName.replace(/[^a-zA-Z0-9]/g, '_');
  const jsonPath = path.join(outDir, `lighthouse-${safeName}-run${runNumber}-${stamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
  console.log(`\nSaved: ${jsonPath}`);

  // 요약 출력 (Lighthouse만)
  if (results.lighthouse) {
    const s = results.lighthouse;
    console.log('\n=== Lighthouse (Official) ===');
    console.log('Score:', s.performanceScore?.toFixed(1));
    const m = s.metrics || {};
    const p = (v) => (v == null ? 'N/A' : `${v.toFixed(1)}ms`);
    console.log('FCP:', p(m.firstContentfulPaint));
    console.log('LCP:', p(m.largestContentfulPaint));
    console.log('TBT:', p(m.totalBlockingTime));
    console.log('CLS:', m.cumulativeLayoutShift == null ? 'N/A' : m.cumulativeLayoutShift.toFixed(3));
    console.log('Speed Index:', p(m.speedIndex));
    console.log('TTI:', p(m.interactive));
  }

  console.log('\n⏱️ Total Time:', results.totalTime, 'ms');
  
  return results;
}

(async () => {
  // URL 검증
  const urls = [];
  if (url1) urls.push({ url: url1, name: name1 });
  if (url2) urls.push({ url: url2, name: name2 });
  if (url3) urls.push({ url: url3, name: name3 });

  if (urls.length === 0) {
    console.error('❌ 최소 1개 이상의 URL을 지정해주세요 (--url1, --url2, --url3)');
    process.exit(1);
  }

  console.log(`\n🚀 ${urls.length}개 버전을 각각 ${runs}회씩 실행합니다...\n`);
  
  const allVersionResults = {};
  
  // 각 URL에 대해 실행
  for (const { url, name } of urls) {
    console.log(`\n${'#'.repeat(70)}`);
    console.log(`### ${name} 시작 ###`);
    console.log(`### URL: ${url}`);
    console.log('#'.repeat(70));
    
    const versionResults = [];
    
    // 여러 번 실행
    for (let i = 1; i <= runs; i++) {
      const result = await runSingleBench(name, url, i, runs);
      versionResults.push(result);
      
      // 마지막 실행이 아니면 잠시 대기
      if (i < runs) {
        console.log('\n⏸️  다음 실행까지 2초 대기...\n');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    allVersionResults[name] = versionResults;
    
    // 버전별 중간 요약
    if (runs > 1 && versionResults.length > 0 && versionResults[0].lighthouse) {
      console.log(`\n--- ${name} 요약 ---`);
      const scores = versionResults.map(r => r.lighthouse?.performanceScore).filter(s => s != null);
      const lcps = versionResults.map(r => r.lighthouse?.metrics?.largestContentfulPaint).filter(v => v != null);
      const avg = (arr) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
      console.log(`평균 Score: ${avg(scores)?.toFixed(1)}`);
      console.log(`평균 LCP: ${avg(lcps)?.toFixed(1)}ms`);
    }
  }

  // 전체 비교 요약
  console.log('\n' + '='.repeat(70));
  console.log('📊 전체 버전 비교');
  console.log('='.repeat(70));
  
  const avg = (arr) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  const min = (arr) => arr.length > 0 ? Math.min(...arr) : null;
  const max = (arr) => arr.length > 0 ? Math.max(...arr) : null;
  
  const comparisonSummary = {};
  
  for (const [versionName, results] of Object.entries(allVersionResults)) {
    const scores = results.map(r => r.lighthouse?.performanceScore).filter(s => s != null);
    const fcps = results.map(r => r.lighthouse?.metrics?.firstContentfulPaint).filter(v => v != null);
    const lcps = results.map(r => r.lighthouse?.metrics?.largestContentfulPaint).filter(v => v != null);
    const tbts = results.map(r => r.lighthouse?.metrics?.totalBlockingTime).filter(v => v != null);
    const clss = results.map(r => r.lighthouse?.metrics?.cumulativeLayoutShift).filter(v => v != null);
    const speedIndexes = results.map(r => r.lighthouse?.metrics?.speedIndex).filter(v => v != null);
    const interactives = results.map(r => r.lighthouse?.metrics?.interactive).filter(v => v != null);
    
    comparisonSummary[versionName] = {
      runs: results.length,
      performanceScore: { avg: avg(scores), min: min(scores), max: max(scores) },
      fcp: { avg: avg(fcps), min: min(fcps), max: max(fcps) },
      lcp: { avg: avg(lcps), min: min(lcps), max: max(lcps) },
      tbt: { avg: avg(tbts), min: min(tbts), max: max(tbts) },
      cls: { avg: avg(clss), min: min(clss), max: max(clss) },
      speedIndex: { avg: avg(speedIndexes), min: min(speedIndexes), max: max(speedIndexes) },
      tti: { avg: avg(interactives), min: min(interactives), max: max(interactives) },
    };
    
    console.log(`\n【${versionName}】`);
    console.log(`  Performance Score: ${avg(scores)?.toFixed(1)} (${min(scores)?.toFixed(1)} ~ ${max(scores)?.toFixed(1)})`);
    console.log(`  FCP: ${avg(fcps)?.toFixed(1)}ms (${min(fcps)?.toFixed(1)} ~ ${max(fcps)?.toFixed(1)})`);
    console.log(`  LCP: ${avg(lcps)?.toFixed(1)}ms (${min(lcps)?.toFixed(1)} ~ ${max(lcps)?.toFixed(1)})`);
    console.log(`  TBT: ${avg(tbts)?.toFixed(1)}ms (${min(tbts)?.toFixed(1)} ~ ${max(tbts)?.toFixed(1)})`);
    console.log(`  CLS: ${avg(clss)?.toFixed(3)} (${min(clss)?.toFixed(3)} ~ ${max(clss)?.toFixed(3)})`);
    console.log(`  Speed Index: ${avg(speedIndexes)?.toFixed(1)}ms`);
    console.log(`  TTI: ${avg(interactives)?.toFixed(1)}ms`);
  }
  
  // 비교 요약 저장
  const summaryStamp = new Date().toISOString().replace(/[:.]/g, '-');
  const comparisonPath = path.join(outDir, `comparison-lighthouse-${summaryStamp}.json`);
  fs.writeFileSync(comparisonPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    runsPerVersion: runs,
    versions: comparisonSummary,
    allResults: allVersionResults
  }, null, 2));
  console.log(`\n📊 Comparison saved: ${comparisonPath}`);

  console.log('\n✅ 모든 벤치마크 완료!\n');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

