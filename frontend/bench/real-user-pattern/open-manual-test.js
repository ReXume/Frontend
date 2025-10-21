#!/usr/bin/env node
/**
 * 수동 성능 측정용 브라우저 열기
 * CPU 4x 스로틀링 환경에서 브라우저를 열어서 직접 성능 측정할 수 있습니다.
 * 
 * 사용법:
 *   node open-manual-test.js --url "http://localhost:3000/feedback/4?version=pdf"
 */

const puppeteer = require('puppeteer');

// 인자 파싱
function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  if (i === -1) return def;
  const next = process.argv[i + 1];
  if (!next || next.startsWith('--')) return true;
  return next;
}

const testUrl = arg('url', 'http://localhost:3000');
const cpuThrottle = parseFloat(arg('cpu', '4'));
const headless = String(arg('headless', 'false')) === 'true';

(async () => {
  console.log('🚀 수동 측정용 브라우저 실행');
  console.log('='.repeat(50));
  console.log(`URL: ${testUrl}`);
  console.log(`CPU 스로틀링: ${cpuThrottle}x`);
  console.log(`Headless: ${headless}`);
  console.log('='.repeat(50));

  const browser = await puppeteer.launch({
    headless: headless ? 'new' : false,
    defaultViewport: { width: 1920, height: 1080 },
    args: [
      '--disable-dev-shm-usage', 
      '--no-sandbox',
      '--disable-web-security',
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection'
    ],
    protocolTimeout: 120000,
  });

  const page = await browser.newPage();
  
  // CPU throttling 적용
  if (cpuThrottle > 1) {
    const client = await page.target().createCDPSession();
    await client.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottle });
    console.log(`✅ CPU ${cpuThrottle}x throttling 적용됨`);
  }

  // DevTools 열기
  try {
    await page.evaluateOnNewDocument(() => {
      // 성능 측정을 위한 헬퍼 함수들
      window.performanceHelpers = {
        // LongTask 감지
        initLongTaskObserver: function() {
          if (window.PerformanceObserver) {
            const observer = new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) {
                console.log(`🔴 LongTask: ${entry.duration.toFixed(2)}ms @ ${entry.startTime.toFixed(2)}ms`);
              }
            });
            observer.observe({ type: 'longtask', buffered: true });
            console.log('✅ LongTask 감지기 활성화됨');
          }
        },
        
        // FPS 측정 시작
        startFPSMeasurement: function() {
          let frameCount = 0;
          let lastTime = performance.now();
          
          function measureFPS() {
            frameCount++;
            const currentTime = performance.now();
            
            if (currentTime - lastTime >= 1000) {
              const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
              console.log(`🎯 FPS: ${fps}`);
              frameCount = 0;
              lastTime = currentTime;
            }
            
            requestAnimationFrame(measureFPS);
          }
          
          requestAnimationFrame(measureFPS);
          console.log('✅ FPS 측정 시작됨');
        },
        
        // 메모리 사용량 확인
        checkMemory: function() {
          if (performance.memory) {
            const mem = performance.memory;
            console.log(`💾 메모리: Used ${Math.round(mem.usedJSHeapSize / 1024 / 1024)}MB / Total ${Math.round(mem.totalJSHeapSize / 1024 / 1024)}MB / Limit ${Math.round(mem.jsHeapSizeLimit / 1024 / 1024)}MB`);
          }
        }
      };
    });
  } catch (e) {
    console.warn('⚠️  성능 헬퍼 설정 실패:', e.message);
  }

  console.log('\n📖 사용법:');
  console.log('1. 브라우저 DevTools 열기 (F12)');
  console.log('2. Console에서 다음 명령어 실행:');
  console.log('   performanceHelpers.initLongTaskObserver()  // LongTask 감지');
  console.log('   performanceHelpers.startFPSMeasurement()   // FPS 측정 시작');
  console.log('   performanceHelpers.checkMemory()           // 메모리 사용량 확인');
  console.log('3. Performance 탭에서 수동으로 측정하거나');
  console.log('4. Lighthouse 탭에서 직접 측정하세요!');
  console.log('\n🔗 페이지 이동 중...');

  await page.goto(testUrl, { 
    waitUntil: ['networkidle2', 'domcontentloaded'], 
    timeout: 120000 
  });

  console.log('✅ 페이지 로드 완료!');
  console.log('\n💡 브라우저가 열려있습니다. 수동으로 성능 측정을 진행하세요.');
  console.log('   브라우저를 닫으면 스크립트가 종료됩니다.');
  
  // 브라우저가 닫힐 때까지 대기
  browser.on('disconnected', () => {
    console.log('\n👋 브라우저가 닫혔습니다. 스크립트를 종료합니다.');
    process.exit(0);
  });

})().catch((e) => {
  console.error('❌ 오류 발생:', e);
  process.exit(1);
});
