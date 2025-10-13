#!/usr/bin/env node
/**
 * compare.js — 여러 페이지의 성능을 한 번에 측정하고 비교
 * 실행 예:
 *   node bench/compare.js
 *   node bench/compare.js --runs 100
 *   node bench/compare.js -n 10
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 명령행 인자 파싱
function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  const shortI = process.argv.indexOf('-' + name[0]);
  if (shortI !== -1 && process.argv[shortI + 1]) return process.argv[shortI + 1];
  return def;
}

const runs = parseInt(arg('runs', '1'), 10);

// 측정할 페이지들
const pages = [
  {
    name: 'feedback-basic/4',
    url: 'http://localhost:3000/feedback-basic/4',
  },
  {
    name: 'feedback/4 (pdf)',
    url: 'http://localhost:3000/feedback/4?version=pdf',
  },
  {
    name: 'feedback/4 (queue)',
    url: 'http://localhost:3000/feedback/4?version=queue',
  },
];

const allResults = [];

console.log(`🚀 성능 측정 시작 (${runs}회 반복)...\n`);

// 통계 계산 함수
function calculateStats(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];
  const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  return {
    avg: avg,
    median: median,
    stdDev: stdDev,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
  };
}

// 각 페이지 측정
for (const page of pages) {
  console.log(`📊 측정 중: ${page.name} (${runs}회)`);
  console.log(`   URL: ${page.url}`);
  
  const pageResults = [];
  
  for (let i = 0; i < runs; i++) {
    process.stdout.write(`\r   진행: ${i + 1}/${runs}`);
    
    try {
      const output = execSync(
        `node bench/bench.js --url "${page.url}"`,
        { 
          cwd: __dirname + '/..',
          encoding: 'utf-8',
          maxBuffer: 10 * 1024 * 1024, // 10MB
          stdio: ['pipe', 'pipe', 'pipe'] // 출력 숨기기
        }
      );
      
      // 결과 파일 찾기 (가장 최근 것)
      const benchOutDir = path.join(__dirname, 'bench_out');
      const files = fs.readdirSync(benchOutDir)
        .filter(f => f.startsWith('results-') && f.endsWith('.json'))
        .sort()
        .reverse();
      
      if (files.length > 0) {
        const latestFile = path.join(benchOutDir, files[0]);
        const data = JSON.parse(fs.readFileSync(latestFile, 'utf-8'));
        pageResults.push(data);
      }
    } catch (error) {
      console.error(`\n❌ 에러 발생 (${page.name}, 시도 ${i + 1}):`, error.message);
    }
  }
  
  console.log('\n✅ 완료\n');
  
  if (pageResults.length > 0) {
    // 통계 계산
    const aggregated = {
      name: page.name,
      url: page.url,
      runs: pageResults.length,
      metrics: {},
      pdfMetrics: {},
    };
    
    // 각 메트릭별 통계
    const metricKeys = ['lcp', 'cls', 'fid', 'ttfb', 'tti', 'tbt', 'firstContentfulPaint', 'domInteractive', 'loadTime'];
    metricKeys.forEach(key => {
      const values = pageResults.map(r => r.metrics[key]).filter(v => v !== null && v !== undefined);
      if (values.length > 0) {
        aggregated.metrics[key] = calculateStats(values);
      }
    });
    
    // PDF 메트릭 통계
    const pdfMetricKeys = ['getPageMs', 'renderMs', 'paintMs', 'totalMs'];
    pdfMetricKeys.forEach(key => {
      const allValues = [];
      pageResults.forEach(r => {
        if (r.metrics.pdfRenderMetrics && r.metrics.pdfRenderMetrics.length > 0) {
          r.metrics.pdfRenderMetrics.forEach(p => {
            if (p[key] !== null && p[key] !== undefined) {
              allValues.push(p[key]);
            }
          });
        }
      });
      if (allValues.length > 0) {
        aggregated.pdfMetrics[key] = calculateStats(allValues);
      }
    });
    
    // 스크롤 메트릭 통계
    aggregated.scrollMetrics = {};
    const scrollMetricKeys = ['avgFps', 'minFps', 'frameDrops', 'scrollEvents', 'totalScrollTime'];
    scrollMetricKeys.forEach(key => {
      const values = pageResults
        .map(r => r.metrics.scrollMetrics?.[key])
        .filter(v => v !== null && v !== undefined);
      if (values.length > 0) {
        aggregated.scrollMetrics[key] = calculateStats(values);
      }
    });
    
    // 스크롤 중 렌더링된 페이지 수
    const renderCountValues = pageResults
      .map(r => r.metrics.scrollMetrics?.renderEventsDuringScroll?.length || 0)
      .filter(v => v > 0);
    if (renderCountValues.length > 0) {
      aggregated.scrollMetrics.pagesRenderedDuringScroll = calculateStats(renderCountValues);
    }
    
    allResults.push(aggregated);
  }
}

// 비교 결과 출력
console.log('\n' + '='.repeat(80));
console.log('📊 성능 비교 결과');
console.log('='.repeat(80) + '\n');

// 통계 포맷 함수
const formatStat = (stat) => {
  if (!stat) return 'N/A';
  if (runs === 1) return stat.avg?.toFixed(1) || 'N/A';
  return `${stat.avg.toFixed(1)} (±${stat.stdDev.toFixed(1)})`;
};

// 테이블 헤더
const headerSuffix = runs > 1 ? ' (평균 ±표준편차)' : '';
console.log('메트릭'.padEnd(30) + pages.map(p => p.name.padEnd(30)).join(''));
console.log('-'.repeat(30 + pages.length * 30));

// Core Web Vitals
const metrics = [
  { key: 'lcp', name: 'LCP (ms)' },
  { key: 'firstContentfulPaint', name: 'FCP (ms)' },
  { key: 'cls', name: 'CLS', format: (s) => s ? `${s.avg.toFixed(3)} (±${s.stdDev.toFixed(3)})` : 'N/A' },
  { key: 'ttfb', name: 'TTFB (ms)' },
  { key: 'tti', name: 'TTI (ms)' },
  { key: 'tbt', name: 'TBT (ms)' },
];

metrics.forEach(metric => {
  const row = metric.name.padEnd(30);
  const values = allResults.map(r => {
    const stat = r.metrics[metric.key];
    const formatted = metric.format ? metric.format(stat) : formatStat(stat);
    return formatted.padEnd(30);
  }).join('');
  console.log(row + values);
});

// PDF 렌더링 메트릭
console.log('\n' + '='.repeat(80));
console.log('📄 PDF 렌더링 성능');
console.log('='.repeat(80) + '\n');

const pdfMetrics = [
  { key: 'getPageMs', name: 'getPage (ms)' },
  { key: 'renderMs', name: 'render (ms)' },
  { key: 'paintMs', name: 'paint (ms)' },
  { key: 'totalMs', name: 'total (ms)' },
];

pdfMetrics.forEach(metric => {
  const row = metric.name.padEnd(30);
  const values = allResults.map(r => {
    const stat = r.pdfMetrics[metric.key];
    return formatStat(stat).padEnd(30);
  }).join('');
  console.log(row + values);
});

// 스크롤 성능 메트릭
console.log('\n' + '='.repeat(80));
console.log('📜 스크롤 성능 (Scroll Performance)');
console.log('='.repeat(80) + '\n');

const scrollMetrics = [
  { key: 'avgFps', name: 'Average FPS' },
  { key: 'minFps', name: 'Min FPS' },
  { key: 'frameDrops', name: 'Frame Drops' },
  { key: 'scrollEvents', name: 'Scroll Events' },
  { key: 'totalScrollTime', name: 'Total Scroll Time (ms)' },
  { key: 'pagesRenderedDuringScroll', name: 'Pages Rendered' },
];

scrollMetrics.forEach(metric => {
  const row = metric.name.padEnd(30);
  const values = allResults.map(r => {
    const stat = r.scrollMetrics?.[metric.key];
    return formatStat(stat).padEnd(30);
  }).join('');
  console.log(row + values);
});

// 추천
console.log('\n' + '='.repeat(80));
console.log('🏆 추천 (평균 기준)');
console.log('='.repeat(80) + '\n');

// 가장 빠른 FCP
const fastestFCP = allResults.reduce((min, r) => {
  const fcp = r.metrics.firstContentfulPaint?.avg;
  if (!fcp) return min;
  if (!min || fcp < min.fcp) return { name: r.name, fcp };
  return min;
}, null);

if (fastestFCP) {
  console.log(`✅ 가장 빠른 FCP: ${fastestFCP.name} (${fastestFCP.fcp.toFixed(1)}ms)`);
}

// 가장 좋은 CLS
const bestCLS = allResults.reduce((min, r) => {
  const cls = r.metrics.cls?.avg;
  if (cls === null || cls === undefined) return min;
  if (!min || cls < min.cls) return { name: r.name, cls };
  return min;
}, null);

if (bestCLS) {
  console.log(`✅ 가장 좋은 CLS: ${bestCLS.name} (${bestCLS.cls.toFixed(3)})`);
}

// 가장 빠른 TTI
const fastestTTI = allResults.reduce((min, r) => {
  const tti = r.metrics.tti?.avg;
  if (!tti) return min;
  if (!min || tti < min.tti) return { name: r.name, tti };
  return min;
}, null);

if (fastestTTI) {
  console.log(`✅ 가장 빠른 TTI: ${fastestTTI.name} (${fastestTTI.tti.toFixed(1)}ms)`);
}

if (runs > 1) {
  console.log(`\n📊 ${runs}회 측정 완료 - 평균, 표준편차, 최소/최대값 계산됨`);
}

console.log('\n✅ 비교 완료!\n');

// 비교 결과를 JSON으로 저장
const compareResultPath = path.join(__dirname, 'bench_out', `compare-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
fs.writeFileSync(compareResultPath, JSON.stringify({
  timestamp: new Date().toISOString(),
  runs: runs,
  pages: allResults,
}, null, 2));

console.log(`📁 비교 결과 저장: ${compareResultPath}\n`);

