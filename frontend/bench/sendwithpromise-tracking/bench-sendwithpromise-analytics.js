#!/usr/bin/env node
/**
 * SendWithPromise 호출 시점 추적 벤치마크
 * 
 * 주요 기능:
 * - SendWithPromise 호출 시점과 지속 시간 정확 추적
 * - 스크롤 이벤트와 SendWithPromise 호출의 상관관계 분석
 * - 3가지 버전 비교 (Base, PDF, Queue)
 * - 병목 지점 식별 및 분석
 * 
 * 사용법:
 *   node bench/sendwithpromise-tracking/bench-sendwithpromise-analytics.js \
 *     --url1 "http://localhost:3000/feedback-basic/4" --name1 "Base" \
 *     --url2 "http://localhost:3000/feedback/4?version=pdf" --name2 "PDF" \
 *     --url3 "http://localhost:3000/feedback/4?version=queue" --name3 "Queue"
 * 
 * 단일 URL 테스트:
 *   node bench/sendwithpromise-tracking/bench-sendwithpromise-analytics.js --url "http://localhost:3000/feedback/4"
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// 인자 파싱
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
const url3 = arg('url3', null);
const name1 = arg('name1', 'Version 1');
const name2 = arg('name2', 'Version 2');
const name3 = arg('name3', 'Version 3');
const cpuThrottle = parseFloat(arg('cpu', '4'));
const headless = String(arg('headless', 'true')) === 'true';
const scrollSteps = parseInt(arg('steps', '8'), 10);
const stepDelay = parseInt(arg('delay', '800'), 10);
const scrollRange = parseFloat(arg('range', '0.3')); // 스크롤 범위 (0.3 = 30%)
const outputFile = arg('output', null);

const benchDir = __dirname;
const outDir = path.join(benchDir, 'results');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

/**
 * SendWithPromise 호출 추적 메인 함수
 */
async function analyzeSendWithPromiseCalls(testUrl, versionName) {
  console.log(`\n🔍 SendWithPromise 호출 분석 시작: ${versionName}`);
  console.log(`   URL: ${testUrl}`);
  
  const browser = await puppeteer.launch({
    headless: headless ? 'new' : false,
    defaultViewport: { width: 1920, height: 1080 },
    args: [
      '--disable-dev-shm-usage', 
      '--no-sandbox',
      '--enable-precise-memory-info',
      '--enable-gpu-rasterization'
    ],
    protocolTimeout: 120000,
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(120000);

  // CPU 스로틀링
  if (cpuThrottle > 1) {
    const client = await page.target().createCDPSession();
    await client.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottle });
    console.log(`   CPU ${cpuThrottle}x throttling 적용`);
  }

  // 콘솔 로그 포워딩
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('[SendWithPromise]') || text.includes('[EventTrace]') || text.includes('[ScrollTrace]')) {
      console.log(`   ${text}`);
    }
  });

  // 페이지 로드 전 SendWithPromise 추적 설정
  await page.evaluateOnNewDocument(() => {
    window.__sendWithPromiseAnalytics = {
      sendWithPromiseCalls: [],
      scrollEvents: [],
      performanceEntries: [],
      userEvents: [],
      callCounter: 0,
      startTime: null,
      originalSendWithPromise: null,
      hooked: false,
      // Base 버전 분석을 위한 추가 정보
      allFunctionCalls: [],
      longTaskEvents: [],
      performanceCalls: []
    };

    // SendWithPromise 함수 후킹
    const hookSendWithPromise = () => {
      let found = false;
      
      // 1. MessageHandler 인스턴스들의 sendWithPromise 메서드 후킹
      const hookMessageHandlers = () => {
        // 모든 객체에서 MessageHandler의 sendWithPromise 찾기
        const searchInObject = (obj, path = '') => {
          if (!obj || typeof obj !== 'object') return false;
          
          try {
            if (obj.constructor && obj.constructor.name === 'MessageHandler') {
              if (typeof obj.sendWithPromise === 'function') {
                console.log(`[SendWithPromise] MessageHandler 발견: ${path}`);
                
                // 원본 함수 저장
                const originalFunc = obj.sendWithPromise;
                
                // 메서드 후킹
                obj.sendWithPromise = function(...args) {
                  const timestamp = performance.now();
                  const callId = ++window.__sendWithPromiseAnalytics.callCounter;
                  
                  const callInfo = {
                    id: callId,
                    timestamp: timestamp,
                    args: args.length,
                    stackTrace: new Error().stack,
                    callLocation: `${path}.sendWithPromise`,
                    messageHandler: true
                  };
                  
                  window.__sendWithPromiseAnalytics.sendWithPromiseCalls.push(callInfo);
                  console.log(`[SendWithPromise] MessageHandler 호출 #${callId} @ ${timestamp.toFixed(2)}ms`);
                  
                  const startTime = performance.now();
                  try {
                    const result = originalFunc.apply(this, args);
                    
                    if (result && typeof result.then === 'function') {
                      callInfo.duration = performance.now() - startTime;
                      callInfo.promiseResult = 'pending';
                      
                      result.then(
                        (resolvedValue) => {
                          callInfo.promiseResult = 'resolved';
                          callInfo.resolveTime = performance.now() - startTime;
                          console.log(`[SendWithPromise] MessageHandler Promise 해결 #${callId}`);
                        },
                        (error) => {
                          callInfo.promiseResult = 'rejected';
                          callInfo.rejectTime = performance.now() - startTime;
                          console.log(`[SendWithPromise] MessageHandler Promise 거부 #${callId}: ${error.message}`);
                        }
                      );
                    } else {
                      callInfo.duration = performance.now() - startTime;
                      callInfo.directReturn = true;
                    }
                    
                    return result;
                  } catch (error) {
                    callInfo.duration = performance.now() - startTime;
                    callInfo.error = error.message;
                    console.log(`[SendWithPromise] MessageHandler 에러 #${callId}: ${error.message}`);
                    throw error;
                  }
                };
                
                found = true;
                return true;
              }
            }
          } catch (e) {
            // 접근할 수 없는 프로퍼티는 무시
          }
          
          // 재귀적으로 객체 속성들을 검색 (너무 깊게 가지 않기 위해 제한)
          if (path.split('.').length < 3) {
            for (const key in obj) {
              try {
                if (obj.hasOwnProperty(key) && typeof obj[key] === 'object') {
                  if (searchInObject(obj[key], path ? `${path}.${key}` : key)) {
                    return true;
                  }
                }
              } catch (e) {
                // 접근할 수 없는 프로퍼티는 무시
              }
            }
          }
          
          return false;
        };
        
        // window 객체에서 검색
        searchInObject(window, 'window');
        
        // 전역 변수들에서도 검색
        try {
          if (typeof pdfjsLib !== 'undefined') searchInObject(pdfjsLib, 'pdfjsLib');
          if (typeof PDFViewerApplication !== 'undefined') searchInObject(PDFViewerApplication, 'PDFViewerApplication');
        } catch (e) {
          // 변수가 없는 경우 무시
        }
      };
      
      // MessageHandler 후킹 먼저 시도
      hookMessageHandlers();
      
      // 2. 기존 방식으로도 찾기
      const possibleLocations = [
        'window.SendWithPromise',
        'window.pdfjsLib.SendWithPromise',
        'window.PDFViewerApplication.SendWithPromise',
        'PDFViewerApplication.SendWithPromise',
        // 전역 함수로도 찾아보기
        ...Object.keys(window).filter(key => key.includes('SendWithPromise'))
      ];

      for (const location of possibleLocations) {
        try {
          const func = eval(location);
          if (typeof func === 'function') {
            console.log(`[SendWithPromise] 발견됨: ${location}`);
            
            // 원본 함수 저장
            window.__sendWithPromiseAnalytics.originalSendWithPromise = func;
            
            // 후킹된 함수로 교체
            eval(`${location} = function(...args) {
              const timestamp = performance.now();
              const callId = ++window.__sendWithPromiseAnalytics.callCounter;
              
              // 호출 정보 기록
              const callInfo = {
                id: callId,
                timestamp: timestamp,
                args: args.length,
                stackTrace: new Error().stack,
                callLocation: '${location}'
              };
              
              window.__sendWithPromiseAnalytics.sendWithPromiseCalls.push(callInfo);
              
              console.log(\`[SendWithPromise] 호출 #\${callId} @ \${timestamp.toFixed(2)}ms - 인자: \${args.length}개\`);
              
              // 원본 함수 호출 및 시간 측정
              const startTime = performance.now();
              try {
                const result = window.__sendWithPromiseAnalytics.originalSendWithPromise.apply(this, args);
                
                // Promise인 경우 완료 시간도 추적
                if (result && typeof result.then === 'function') {
                  const endTimestamp = performance.now();
                  callInfo.duration = endTimestamp - startTime;
                  callInfo.promiseResult = 'pending';
                  
                  result.then(
                    (resolvedValue) => {
                      const resolveTimestamp = performance.now();
                      callInfo.promiseResult = 'resolved';
                      callInfo.resolveTime = resolveTimestamp - startTime;
                      console.log(\`[SendWithPromise] Promise 해결 #\${callId} @ \${resolveTimestamp.toFixed(2)}ms\`);
                    },
                    (error) => {
                      const rejectTimestamp = performance.now();
                      callInfo.promiseResult = 'rejected';
                      callInfo.rejectTime = rejectTimestamp - startTime;
                      console.log(\`[SendWithPromise] Promise 거부 #\${callId} @ \${rejectTimestamp.toFixed(2)}ms - \${error.message || 'Unknown error'}\`);
                    }
                  );
                } else {
                  callInfo.duration = performance.now() - startTime;
                  callInfo.directReturn = true;
                }
                
                return result;
              } catch (error) {
                callInfo.duration = performance.now() - startTime;
                callInfo.error = error.message;
                console.log(\`[SendWithPromise] 에러 #\${callId}: \${error.message}\`);
                throw error;
              }
            };`);
            
            found = true;
            window.__sendWithPromiseAnalytics.hooked = true;
            break;
          }
        } catch (e) {
          // 해당 위치에 함수가 없는 경우 계속 진행
        }
      }
      
      if (!found) {
        console.log('[SendWithPromise] 함수를 찾을 수 없음 - 동적으로 후킹 시도');
      }
    };

    // 지속적인 동적 후킹을 위한 함수
    const attemptDynamicHooking = () => {
      // 이미 후킹이 성공했어도 계속 시도 (여러 인스턴스가 있을 수 있음)
      
      // 모든 전역 객체에서 MessageHandler 인스턴스 찾기
      const findMessageHandlers = () => {
        const handlers = [];
        
        // window 객체의 모든 속성 검사
        for (const key in window) {
          try {
            const obj = window[key];
            if (obj && typeof obj === 'object') {
              // MessageHandler 클래스 자체인지 확인
              if (obj.prototype && typeof obj.prototype.sendWithPromise === 'function') {
                console.log(`[SendWithPromise] MessageHandler 클래스 발견: ${key}`);
                handlers.push({ type: 'class', obj: obj, name: key });
              }
              
              // MessageHandler 인스턴스인지 확인
              if (obj.constructor && obj.constructor.name === 'MessageHandler' && typeof obj.sendWithPromise === 'function') {
                console.log(`[SendWithPromise] MessageHandler 인스턴스 발견: ${key}`);
                handlers.push({ type: 'instance', obj: obj, name: key });
              }
            }
          } catch (e) {
            // 접근할 수 없는 속성은 무시
          }
        }
        
        return handlers;
      };
      
      const handlers = findMessageHandlers();
      
      handlers.forEach(({ type, obj, name }) => {
        if (type === 'instance') {
          // 인스턴스의 메서드를 직접 후킹
          if (!obj.__sendWithPromiseHooked) {
            const original = obj.sendWithPromise;
            obj.sendWithPromise = function(...args) {
              const timestamp = performance.now();
              const callId = ++window.__sendWithPromiseAnalytics.callCounter;
              
              const callInfo = {
                id: callId,
                timestamp: timestamp,
                args: args.length,
                stackTrace: new Error().stack,
                callLocation: `${name}.sendWithPromise`,
                messageHandler: true,
                instanceName: name
              };
              
              window.__sendWithPromiseAnalytics.sendWithPromiseCalls.push(callInfo);
              console.log(`[SendWithPromise] 인스턴스 호출 #${callId} @ ${timestamp.toFixed(2)}ms`);
              
              const startTime = performance.now();
              try {
                const result = original.apply(this, args);
                
                if (result && typeof result.then === 'function') {
                  callInfo.duration = performance.now() - startTime;
                  callInfo.promiseResult = 'pending';
                  
                  result.then(
                    (resolvedValue) => {
                      callInfo.promiseResult = 'resolved';
                      callInfo.resolveTime = performance.now() - startTime;
                    },
                    (error) => {
                      callInfo.promiseResult = 'rejected';
                      callInfo.rejectTime = performance.now() - startTime;
                    }
                  );
                } else {
                  callInfo.duration = performance.now() - startTime;
                }
                
                return result;
              } catch (error) {
                callInfo.duration = performance.now() - startTime;
                callInfo.error = error.message;
                throw error;
              }
            };
            obj.__sendWithPromiseHooked = true;
            window.__sendWithPromiseAnalytics.hooked = true;
          }
        } else if (type === 'class') {
          // 클래스 프로토타입을 후킹
          if (!obj.prototype.__sendWithPromiseHooked) {
            const original = obj.prototype.sendWithPromise;
            obj.prototype.sendWithPromise = function(...args) {
              const timestamp = performance.now();
              const callId = ++window.__sendWithPromiseAnalytics.callCounter;
              
              const callInfo = {
                id: callId,
                timestamp: timestamp,
                args: args.length,
                stackTrace: new Error().stack,
                callLocation: `${name}.prototype.sendWithPromise`,
                messageHandler: true,
                className: name
              };
              
              window.__sendWithPromiseAnalytics.sendWithPromiseCalls.push(callInfo);
              console.log(`[SendWithPromise] 클래스 호출 #${callId} @ ${timestamp.toFixed(2)}ms`);
              
              const startTime = performance.now();
              try {
                const result = original.apply(this, args);
                
                if (result && typeof result.then === 'function') {
                  callInfo.duration = performance.now() - startTime;
                  callInfo.promiseResult = 'pending';
                  
                  result.then(
                    (resolvedValue) => {
                      callInfo.promiseResult = 'resolved';
                      callInfo.resolveTime = performance.now() - startTime;
                    },
                    (error) => {
                      callInfo.promiseResult = 'rejected';
                      callInfo.rejectTime = performance.now() - startTime;
                    }
                  );
                } else {
                  callInfo.duration = performance.now() - startTime;
                }
                
                return result;
              } catch (error) {
                callInfo.duration = performance.now() - startTime;
                callInfo.error = error.message;
                throw error;
              }
            };
            obj.prototype.__sendWithPromiseHooked = true;
            window.__sendWithPromiseAnalytics.hooked = true;
          }
        }
      });
    };

    // DOM 로드 후 후킹 시도
    document.addEventListener('DOMContentLoaded', () => {
      hookSendWithPromise();
      attemptDynamicHooking();
    });
    
    window.addEventListener('load', () => {
      if (!window.__sendWithPromiseAnalytics.hooked) {
        hookSendWithPromise();
        attemptDynamicHooking();
      }
    });
    
    // 더 강력한 후킹 방법: 모든 함수 이름으로 후킹 시도
    const hookAllPossibilities = () => {
      console.log('[SendWithPromise] 모든 가능한 후킹 방법 시도 중...');
      
      // 1. 전역 객체에서 sendWithPromise를 포함한 모든 함수 찾기
      const findAllFunctions = (obj, path = '', depth = 0) => {
        if (depth > 4 || !obj || typeof obj !== 'object') return;
        
        try {
          for (const key in obj) {
            try {
              const value = obj[key];
              
              // sendWithPromise를 포함한 함수 찾기
              if (typeof value === 'function' && key.toLowerCase().includes('sendwithpromise')) {
                console.log(`[SendWithPromise] 후킹 대상 발견: ${path ? path + '.' : ''}${key}`);
                
                // 함수 후킹
                obj[key] = function(...args) {
                  const timestamp = performance.now();
                  const callId = ++window.__sendWithPromiseAnalytics.callCounter;
                  
                  const callInfo = {
                    id: callId,
                    timestamp: timestamp,
                    args: args.length,
                    stackTrace: new Error().stack,
                    callLocation: `${path ? path + '.' : ''}${key}`,
                    hookedBy: 'functionName'
                  };
                  
                  window.__sendWithPromiseAnalytics.sendWithPromiseCalls.push(callInfo);
                  console.log(`[SendWithPromise] 함수명 후킹 호출 #${callId} @ ${timestamp.toFixed(2)}ms`);
                  
                  const startTime = performance.now();
                  try {
                    const result = value.apply(this, args);
                    
                    if (result && typeof result.then === 'function') {
                      callInfo.duration = performance.now() - startTime;
                      callInfo.promiseResult = 'pending';
                      
                      result.then(
                        (resolvedValue) => {
                          callInfo.promiseResult = 'resolved';
                          callInfo.resolveTime = performance.now() - startTime;
                        },
                        (error) => {
                          callInfo.promiseResult = 'rejected';
                          callInfo.rejectTime = performance.now() - startTime;
                        }
                      );
                    } else {
                      callInfo.duration = performance.now() - startTime;
                    }
                    
                    return result;
                  } catch (error) {
                    callInfo.duration = performance.now() - startTime;
                    callInfo.error = error.message;
                    throw error;
                  }
                };
              }
              
              // 재귀적으로 객체 검색
              if (typeof value === 'object' && value !== null && depth < 3) {
                findAllFunctions(value, path ? `${path}.${key}` : key, depth + 1);
              }
            } catch (e) {
              // 접근할 수 없는 속성 무시
            }
          }
        } catch (e) {
          // 전체 객체 접근 실패 무시
        }
      };
      
      // window 객체에서 검색
      findAllFunctions(window, 'window');
      
      // 5. 더 정확한 방법: 실제 객체에서 sendWithPromise 메서드 찾기
      const findAndHookSendWithPromise = () => {
        // 모든 객체를 순회하며 sendWithPromise 메서드 찾기
        const visited = new WeakSet();
        
        const searchObject = (obj, path = '', depth = 0) => {
          if (depth > 3 || !obj || typeof obj !== 'object' || visited.has(obj)) return;
          visited.add(obj);
          
          try {
            // 객체의 속성들을 확인
            for (const key in obj) {
              try {
                if (obj.hasOwnProperty && obj.hasOwnProperty(key)) {
                  const value = obj[key];
                  
                  // sendWithPromise 메서드 직접 확인
                  if (key === 'sendWithPromise' && typeof value === 'function') {
                    if (!obj.__sendWithPromiseAnalyticsHooked) {
                      console.log(`[SendWithPromise] 직접 발견: ${path}.${key}`);
                      
                      const original = value;
                      obj[key] = function(...args) {
                        const timestamp = performance.now();
                        const callId = ++window.__sendWithPromiseAnalytics.callCounter;
                        
                        const callInfo = {
                          id: callId,
                          timestamp: timestamp,
                          args: args.length,
                          stackTrace: new Error().stack,
                          callLocation: `${path}.${key}`,
                          hookedBy: 'directMethod',
                          methodName: key
                        };
                        
                        window.__sendWithPromiseAnalytics.sendWithPromiseCalls.push(callInfo);
                        console.log(`[SendWithPromise] 직접 후킹 호출 #${callId} @ ${timestamp.toFixed(2)}ms - ${path}.${key}`);
                        
                        const startTime = performance.now();
                        try {
                          const result = original.apply(this, args);
                          
                          if (result && typeof result.then === 'function') {
                            callInfo.duration = performance.now() - startTime;
                            callInfo.promiseResult = 'pending';
                            
                            result.then(
                              (resolvedValue) => {
                                callInfo.promiseResult = 'resolved';
                                callInfo.resolveTime = performance.now() - startTime;
                                console.log(`[SendWithPromise] 직접 Promise 해결 #${callId}`);
                              },
                              (error) => {
                                callInfo.promiseResult = 'rejected';
                                callInfo.rejectTime = performance.now() - startTime;
                                console.log(`[SendWithPromise] 직접 Promise 거부 #${callId}: ${error.message}`);
                              }
                            );
                          } else {
                            callInfo.duration = performance.now() - startTime;
                          }
                          
                          return result;
                        } catch (error) {
                          callInfo.duration = performance.now() - startTime;
                          callInfo.error = error.message;
                          throw error;
                        }
                      };
                      
                      obj.__sendWithPromiseAnalyticsHooked = true;
                      window.__sendWithPromiseAnalytics.hooked = true;
                    }
                  }
                  
                  // 객체라면 재귀적으로 검색
                  if (typeof value === 'object' && value !== null && depth < 2) {
                    searchObject(value, path ? `${path}.${key}` : key, depth + 1);
                  }
                }
              } catch (e) {
                // 접근할 수 없는 속성 무시
              }
            }
          } catch (e) {
            // 객체 순회 실패 무시
          }
        };
        
        // window 객체에서 검색
        searchObject(window, 'window');
        
        // 주요 전역 객체들도 검색
        try {
          if (typeof pdfjsLib !== 'undefined') searchObject(pdfjsLib, 'pdfjsLib');
          if (typeof PDFViewerApplication !== 'undefined') searchObject(PDFViewerApplication, 'PDFViewerApplication');
        } catch (e) {
          // 변수가 없는 경우 무시
        }
      };
      
      findAndHookSendWithPromise();
      
      // 2. 더 직접적인 방법: Object.prototype 후킹 시도
      try {
        // 모든 객체의 sendWithPromise 메서드 후킹을 위한 전역 후킹
        const originalDefineProperty = Object.defineProperty;
        Object.defineProperty = function(obj, prop, descriptor) {
          if (prop === 'sendWithPromise' && typeof descriptor.value === 'function') {
            console.log('[SendWithPromise] defineProperty로 sendWithPromise 감지됨');
            
            const originalFunc = descriptor.value;
            descriptor.value = function(...args) {
              const timestamp = performance.now();
              const callId = ++window.__sendWithPromiseAnalytics.callCounter;
              
              const callInfo = {
                id: callId,
                timestamp: timestamp,
                args: args.length,
                stackTrace: new Error().stack,
                callLocation: 'defineProperty.sendWithPromise',
                hookedBy: 'defineProperty'
              };
              
              window.__sendWithPromiseAnalytics.sendWithPromiseCalls.push(callInfo);
              console.log(`[SendWithPromise] defineProperty 후킹 호출 #${callId} @ ${timestamp.toFixed(2)}ms`);
              
              const startTime = performance.now();
              try {
                const result = originalFunc.apply(this, args);
                callInfo.duration = performance.now() - startTime;
                return result;
              } catch (error) {
                callInfo.duration = performance.now() - startTime;
                callInfo.error = error.message;
                throw error;
              }
            };
          }
          return originalDefineProperty.call(this, obj, prop, descriptor);
        };
      } catch (e) {
        console.log('[SendWithPromise] defineProperty 후킹 실패:', e.message);
      }
      
      // 3. Worker 메시지 후킹 (PDF.js에서 많이 사용)
      try {
        const originalPostMessage = Worker.prototype.postMessage;
        if (originalPostMessage) {
          Worker.prototype.postMessage = function(message, transfer) {
            const timestamp = performance.now();
            
            // 모든 Worker 메시지를 로그로 기록 (Base 버전 분석용)
            const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
            const messageObj = typeof message === 'object' ? message : null;
            
            // 모든 Worker 메시지 로깅 (Base 버전에서 실제 어떤 메시지가 오는지 확인)
            console.log(`[WorkerMessage] ${messageStr.substring(0, 100)}...`);
            
            // 더 많은 PDF.js 액션들 추가 (Base 버전에서도 감지되도록)
            const isRelevantMessage = messageStr.includes('sendWithPromise') || 
                                   messageStr.includes('GetDocRequest') || 
                                   messageStr.includes('getPage') ||
                                   messageStr.includes('GetPageRequest') ||
                                   messageStr.includes('RenderPageRequest') ||
                                   messageStr.includes('RenderTask') ||
                                   messageStr.includes('GetOperatorList') ||
                                   messageStr.includes('GetTextContent') ||
                                   messageStr.includes('GetAnnotations') ||
                                   messageStr.includes('GetStructTree') ||
                                   messageStr.includes('action') || // Base 버전에서 일반적인 액션들도 감지
                                   messageStr.includes('worker') ||
                                   messageStr.includes('main') ||
                                   (messageObj && (
                                     messageObj.action === 'GetDocRequest' || 
                                     messageObj.action === 'GetPageRequest' ||
                                     messageObj.action === 'RenderPageRequest' ||
                                     messageObj.action === 'GetOperatorList' ||
                                     messageObj.action === 'GetTextContent' ||
                                     messageObj.action === 'GetAnnotations' ||
                                     messageObj.action === 'GetStructTree' ||
                                     messageObj.action)); // 모든 액션 감지
            
            if (isRelevantMessage) {
              // 중복 체크 (같은 timestamp와 action은 제외)
              const action = messageObj ? messageObj.action : 'unknown';
              const existingCall = window.__sendWithPromiseAnalytics.sendWithPromiseCalls.find(call => 
                Math.abs(call.timestamp - timestamp) < 100 && 
                (call.action === action || call.message === messageStr.substring(0, 200))
              );
              
              if (!existingCall) {
                const callId = ++window.__sendWithPromiseAnalytics.callCounter;
                
                const callInfo = {
                  id: callId,
                  timestamp: timestamp,
                  args: 1,
                  stackTrace: new Error().stack,
                  callLocation: 'Worker.postMessage',
                  message: messageStr.substring(0, 200),
                  hookedBy: 'workerPostMessage',
                  action: action,
                  fullMessage: messageStr.length > 200 ? messageStr : messageStr // 전체 메시지 저장
                };
                
                window.__sendWithPromiseAnalytics.sendWithPromiseCalls.push(callInfo);
                console.log(`[SendWithPromise] Worker 메시지 감지 #${callId} @ ${timestamp.toFixed(2)}ms - 액션: ${action}`);
                console.log(`[SendWithPromise] 전체 메시지: ${messageStr.substring(0, 500)}${messageStr.length > 500 ? '...' : ''}`);
              }
            }
            
            return originalPostMessage.call(this, message, transfer);
          };
        }
      } catch (e) {
        console.log('[SendWithPromise] Worker 후킹 실패:', e.message);
      }
      
      // 4. 기존 방법들도 계속 시도
      attemptDynamicHooking();
    };

    // 즉시 후킹 시도
    hookSendWithPromise();
    attemptDynamicHooking();
    hookAllPossibilities();
    
    // 주기적으로 동적 후킹 시도 (PDF.js 로딩 지연 대응)
    const hookingInterval = setInterval(() => {
      attemptDynamicHooking();
      hookAllPossibilities();
    }, 1000);
    
    // 30초 후 인터벌 정리
    setTimeout(() => {
      clearInterval(hookingInterval);
    }, 30000);

    // 스크롤 이벤트 추적 개선
    let scrollTimeout;
    const trackScrollEvent = (e) => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const timestamp = performance.now();
        let scrollTop, scrollLeft, target;
        
        if (e.target === document || e.target === document.documentElement || e.target === document.body) {
          // window 스크롤
          scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
          scrollLeft = window.pageXOffset || document.documentElement.scrollLeft || 0;
          target = 'window';
        } else {
          // 요소 스크롤
          scrollTop = e.target.scrollTop || 0;
          scrollLeft = e.target.scrollLeft || 0;
          target = e.target.tagName || 'unknown';
        }
        
        const scrollEvent = {
          timestamp: timestamp,
          scrollTop: scrollTop,
          scrollLeft: scrollLeft,
          target: target,
          id: ++window.__sendWithPromiseAnalytics.callCounter,
        };
        
        window.__sendWithPromiseAnalytics.scrollEvents.push(scrollEvent);
        console.log(`[ScrollTrace] 스크롤 이벤트 @ ${timestamp.toFixed(2)}ms - ${target}: Top: ${scrollTop.toFixed(0)}px`);
      }, 16); // 60fps로 제한
    };

    // 이벤트 리스너 등록 개선
    const setupEventListeners = () => {
      // window 스크롤 이벤트
      window.addEventListener('scroll', trackScrollEvent, { passive: true });
      
      // 문서 레벨 스크롤 이벤트
      document.addEventListener('scroll', trackScrollEvent, { passive: true, capture: true });
      
      // 동적으로 추가되는 스크롤 가능한 요소들도 감지
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) { // Element node
              const element = node;
              const style = window.getComputedStyle(element);
              if (style.overflow === 'auto' || style.overflowY === 'auto' || style.overflow === 'scroll' || style.overflowY === 'scroll') {
                element.addEventListener('scroll', trackScrollEvent, { passive: true });
              }
              // 자식 요소들도 확인
              element.querySelectorAll && element.querySelectorAll('*').forEach((child) => {
                const childStyle = window.getComputedStyle(child);
                if (childStyle.overflow === 'auto' || childStyle.overflowY === 'auto' || childStyle.overflow === 'scroll' || childStyle.overflowY === 'scroll') {
                  child.addEventListener('scroll', trackScrollEvent, { passive: true });
                }
              });
            }
          });
        });
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupEventListeners);
    } else {
      setupEventListeners();
    }
  });

  console.log('   페이지 이동 중...');
  await page.goto(testUrl, { 
    waitUntil: ['networkidle2', 'domcontentloaded'], 
    timeout: 120000
  });

  console.log('   페이지 로드 완료, 초기화 대기...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // 스택 트레이스 수집을 위한 추가 후킹 설정
  await page.evaluate(() => {
    // Error 객체의 stack 속성을 후킹해서 sendWithPromise 호출 감지
    const originalConsoleError = console.error;
    const originalConsoleLog = console.log;
    
    const checkStackTraceForSendWithPromise = (stack) => {
      if (stack && stack.includes('sendWithPromise')) {
        const timestamp = performance.now();
        const callId = ++window.__sendWithPromiseAnalytics.callCounter;
        
        const callInfo = {
          id: callId,
          timestamp: timestamp,
          args: 0,
          stackTrace: stack,
          callLocation: 'stackTrace.sendWithPromise',
          hookedBy: 'stackTrace'
        };
        
        window.__sendWithPromiseAnalytics.sendWithPromiseCalls.push(callInfo);
        console.log(`[SendWithPromise] 스택 트레이스 감지 #${callId} @ ${timestamp.toFixed(2)}ms`);
      }
    };
    
    // Error 생성자 후킹
    const OriginalError = window.Error;
    window.Error = function(message) {
      const error = new OriginalError(message);
      setTimeout(() => checkStackTraceForSendWithPromise(error.stack), 0);
      return error;
    };
    
    // 프로미스 생성자 후킹 (PDF.js에서 많이 사용)
    const OriginalPromise = window.Promise;
    const originalThen = Promise.prototype.then;
    
    Promise.prototype.then = function(onFulfilled, onRejected) {
      const stack = new Error().stack;
      if (stack && stack.includes('sendWithPromise')) {
        const timestamp = performance.now();
        const callId = ++window.__sendWithPromiseAnalytics.callCounter;
        
        const callInfo = {
          id: callId,
          timestamp: timestamp,
          args: 0,
          stackTrace: stack,
          callLocation: 'Promise.then.sendWithPromise',
          hookedBy: 'promiseThen'
        };
        
        window.__sendWithPromiseAnalytics.sendWithPromiseCalls.push(callInfo);
        console.log(`[SendWithPromise] Promise.then 감지 #${callId} @ ${timestamp.toFixed(2)}ms`);
      }
      
      return originalThen.call(this, onFulfilled, onRejected);
    };
  });

  await new Promise(resolve => setTimeout(resolve, 2000)); // 추가 후킹 대기

  // SendWithPromise 후킹 상태 및 디버깅 정보 확인
  const hookStatus = await page.evaluate(() => {
    // 더 자세한 디버깅 정보 수집
    const debugInfo = {
      hooked: window.__sendWithPromiseAnalytics?.hooked || false,
      callsDetected: window.__sendWithPromiseAnalytics?.sendWithPromiseCalls?.length || 0,
      scrollEventsDetected: window.__sendWithPromiseAnalytics?.scrollEvents?.length || 0,
      analyticsExists: typeof window.__sendWithPromiseAnalytics !== 'undefined',
      globalObjects: [],
      messageHandlers: [],
      // Base 버전 분석용 추가 정보
      longTasksCount: performance.getEntriesByType('longtask').length,
      totalWorkerMessages: window.__sendWithPromiseAnalytics?.sendWithPromiseCalls?.length || 0,
      allMessages: window.__sendWithPromiseAnalytics?.sendWithPromiseCalls?.map(call => ({
        action: call.action,
        timestamp: call.timestamp,
        message: call.message?.substring(0, 50) || 'unknown'
      })) || []
    };

    // 전역 객체들 확인
    try {
      for (const key in window) {
        try {
          const obj = window[key];
          if (obj && typeof obj === 'object') {
            // pdfjs 관련 객체들 확인
            if (key.toLowerCase().includes('pdf') || key.toLowerCase().includes('message')) {
              debugInfo.globalObjects.push({
                name: key,
                type: obj.constructor?.name || 'unknown',
                hasSendWithPromise: typeof obj.sendWithPromise === 'function',
                prototypeHasSendWithPromise: obj.prototype && typeof obj.prototype.sendWithPromise === 'function'
              });
            }
            
            // MessageHandler 인스턴스 확인
            if (obj.constructor?.name === 'MessageHandler' || 
                (obj.prototype && obj.prototype.constructor?.name === 'MessageHandler')) {
              debugInfo.messageHandlers.push({
                name: key,
                type: 'instance',
                hasSendWithPromise: typeof obj.sendWithPromise === 'function'
              });
            }
          }
        } catch (e) {
          // 접근할 수 없는 속성 무시
        }
      }
    } catch (e) {
      console.log('전역 객체 검색 중 오류:', e.message);
    }

    return debugInfo;
  });
  
  console.log('   후킹 상태:', hookStatus.hooked ? '✅ 성공' : '❌ 실패');
  console.log('   감지된 호출:', hookStatus.callsDetected + '개');
  console.log('   스크롤 이벤트:', hookStatus.scrollEventsDetected + '개');
  console.log('   LongTask 수:', hookStatus.longTasksCount + '개');
  console.log('   Worker 메시지 총 수:', hookStatus.totalWorkerMessages + '개');
  
  if (hookStatus.allMessages.length > 0) {
    console.log('   감지된 메시지들:');
    hookStatus.allMessages.slice(0, 10).forEach((msg, idx) => {
      console.log(`     ${idx + 1}. ${msg.action || 'unknown'} @ ${msg.timestamp.toFixed(1)}ms - ${msg.message}`);
    });
    if (hookStatus.allMessages.length > 10) {
      console.log(`     ... 외 ${hookStatus.allMessages.length - 10}개 더`);
    }
  }
  
  if (hookStatus.globalObjects.length > 0) {
    console.log('   발견된 PDF 관련 객체들:');
    hookStatus.globalObjects.forEach(obj => {
      console.log(`     - ${obj.name}: ${obj.type} (sendWithPromise: ${obj.hasSendWithPromise ? '✅' : '❌'})`);
    });
  }
  
  if (hookStatus.messageHandlers.length > 0) {
    console.log('   발견된 MessageHandler들:');
    hookStatus.messageHandlers.forEach(handler => {
      console.log(`     - ${handler.name}: ${handler.hasSendWithPromise ? '✅' : '❌'}`);
    });
  }
  
  if (!hookStatus.hooked && hookStatus.globalObjects.length === 0 && hookStatus.messageHandlers.length === 0) {
    console.log('   ⚠️ PDF.js가 아직 로드되지 않았거나 다른 이름으로 사용될 수 있습니다.');
  }

  // 버전 정보 확인
  const versionInfo = await page.evaluate(() => {
    const versionDiv = document.querySelector('.bg-blue-100');
    return {
      versionText: versionDiv?.textContent?.trim() || 'Unknown',
      hasAnalytics: typeof window.__sendWithPromiseAnalytics !== 'undefined',
      url: window.location.href,
    };
  });
  
  console.log('   버전 정보:', versionInfo.versionText);

  console.log('   스크롤 시뮬레이션 시작...');
  
  // 스크롤 시뮬레이션 및 SendWithPromise 호출 추적
  const result = await page.evaluate(async (scrollSteps, stepDelay, scrollRange) => {
    // 측정 시작 시간 설정
    if (!window.__sendWithPromiseAnalytics.startTime) {
      window.__sendWithPromiseAnalytics.startTime = performance.now();
    }
    
    // 스크롤 컨테이너 찾기 개선
    let scrollContainer = null;
    
    // 1. div 요소들에서 스크롤 가능한 것 찾기
    const divs = Array.from(document.querySelectorAll('div, main, section, article'));
    scrollContainer = divs.find(div => {
      const style = window.getComputedStyle(div);
      return (style.overflowY === 'auto' || style.overflowY === 'scroll') && 
             div.scrollHeight > div.clientHeight;
    });
    
    // 2. body나 html이 스크롤 가능한 경우
    if (!scrollContainer) {
      if (document.body.scrollHeight > window.innerHeight) {
        scrollContainer = document.body;
      } else if (document.documentElement.scrollHeight > window.innerHeight) {
        scrollContainer = document.documentElement;
      }
    }
    
    // 3. 전체 문서에서 스크롤 가능한 요소 찾기
    if (!scrollContainer) {
      const allElements = Array.from(document.querySelectorAll('*'));
      scrollContainer = allElements.find(el => {
        const style = window.getComputedStyle(el);
        return (style.overflow === 'auto' || style.overflowY === 'auto' || 
                style.overflow === 'scroll' || style.overflowY === 'scroll') && 
               el.scrollHeight > el.clientHeight && el.clientHeight > 0;
      });
    }
    
    if (!scrollContainer) {
      console.error('[EventTrace] 스크롤 컨테이너를 찾을 수 없습니다. 모든 div 요소를 확인합니다.');
      // 디버그 정보 출력
      const debugInfo = divs.slice(0, 5).map(div => ({
        tagName: div.tagName,
        scrollHeight: div.scrollHeight,
        clientHeight: div.clientHeight,
        overflowY: window.getComputedStyle(div).overflowY,
        className: div.className
      }));
      console.log('[EventTrace] 디버그 - 상위 5개 div 요소:', debugInfo);
      
      // window 스크롤을 기본으로 사용
      scrollContainer = {
        scrollTop: 0,
        scrollHeight: document.body.scrollHeight,
        clientHeight: window.innerHeight,
        scrollTo: (top) => window.scrollTo(0, top)
      };
      scrollContainer.scrollTop = scrollContainer.scrollTop || window.pageYOffset || 0;
      
      console.log('[EventTrace] window 스크롤을 기본 컨테이너로 사용합니다.');
    }

    const fullMaxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
    const maxScroll = Math.min(fullMaxScroll * scrollRange, 50000); // 최대 50,000px 또는 지정된 비율
    
    console.log(`[EventTrace] 스크롤 컨테이너 정보:`);
    console.log(`  - 요소: ${scrollContainer.tagName || 'window/fake'}`);
    console.log(`  - 높이: ${scrollContainer.scrollHeight}px (클라이언트: ${scrollContainer.clientHeight}px)`);
    console.log(`  - 최대 스크롤: ${fullMaxScroll}px`);
    console.log(`  - 테스트 범위: ${maxScroll}px (${(scrollRange * 100).toFixed(0)}%)`);
    
    // 현재 스크롤 위치 확인
    const currentScroll = scrollContainer.scrollTop || window.pageYOffset || 0;
    console.log(`  - 현재 위치: ${currentScroll}px`);

    // 단계별 스크롤 실행
    for (let i = 0; i <= scrollSteps; i++) {
      const beforeCalls = window.__sendWithPromiseAnalytics.sendWithPromiseCalls.length;
      const beforeScrollEvents = window.__sendWithPromiseAnalytics.scrollEvents.length;
      
      // 이벤트 마킹 시작
      performance.mark(`scroll-step-${i}-start`);
      
      const targetScrollPosition = (maxScroll / scrollSteps) * i;
      const currentScrollPosition = scrollContainer.scrollTop !== undefined ? scrollContainer.scrollTop : (window.pageYOffset || 0);
      
      console.log(`[EventTrace] 스크롤 Step ${i}/${scrollSteps}: ${currentScrollPosition.toFixed(0)}px → ${targetScrollPosition.toFixed(0)}px`);
      
      // 자연스러운 스크롤 시뮬레이션
      const scrollDistance = targetScrollPosition - currentScrollPosition;
      const smoothScrollSteps = Math.max(5, Math.floor(Math.abs(scrollDistance) / 200));
      const stepSize = scrollDistance / smoothScrollSteps;
      const smoothStepDelay = 150;
      
      for (let j = 0; j < smoothScrollSteps; j++) {
        const newPosition = currentScrollPosition + (stepSize * (j + 1));
        
        // 스크롤 실행 - window 스크롤과 요소 스크롤 구분
        if (scrollContainer.scrollTo) {
          scrollContainer.scrollTo(0, Math.round(newPosition));
        } else {
          scrollContainer.scrollTop = Math.round(newPosition);
        }
        
        // 스크롤 이벤트가 발생할 시간을 주기 위해 대기
        if (j < smoothScrollSteps - 1) {
          await new Promise(r => setTimeout(r, smoothStepDelay));
        }
      }
      
      // 목표 위치 정확히 설정
      const finalPosition = Math.round(targetScrollPosition);
      if (scrollContainer.scrollTo) {
        scrollContainer.scrollTo(0, finalPosition);
      } else {
        scrollContainer.scrollTop = finalPosition;
      }
      
      // 실제 스크롤 위치 확인 (스크롤 완료 후 잠시 대기)
      await new Promise(r => setTimeout(r, 100));
      const actualPosition = scrollContainer.scrollTop !== undefined ? scrollContainer.scrollTop : (window.pageYOffset || 0);
      if (Math.abs(actualPosition - targetScrollPosition) > 10) {
        console.log(`[EventTrace] 스크롤 위치 조정: 목표 ${targetScrollPosition.toFixed(0)}px, 실제 ${actualPosition.toFixed(0)}px`);
      }
      
      const remainingDelay = Math.max(0, stepDelay - (smoothScrollSteps * smoothStepDelay));
      await new Promise(r => setTimeout(r, remainingDelay));
      
      performance.mark(`scroll-step-${i}-end`);
      performance.measure(`scroll-duration-${i}`, `scroll-step-${i}-start`, `scroll-step-${i}-end`);
      
      const afterCalls = window.__sendWithPromiseAnalytics.sendWithPromiseCalls.length;
      const afterScrollEvents = window.__sendWithPromiseAnalytics.scrollEvents.length;
      
      const newCalls = afterCalls - beforeCalls;
      const newScrollEvents = afterScrollEvents - beforeScrollEvents;
      
      console.log(`[EventTrace] Step ${i} 결과: SendWithPromise +${newCalls}개 호출, 스크롤 +${newScrollEvents}개 이벤트`);
      console.log(`[EventTrace] 누적 SendWithPromise 호출: ${afterCalls}개, 스크롤 이벤트: ${afterScrollEvents}개`);
    }

    const endTime = performance.now();
    const startTime = window.__sendWithPromiseAnalytics.startTime || 0;

    return {
      success: true,
      duration: endTime - startTime,
      analytics: window.__sendWithPromiseAnalytics,
    };
  }, scrollSteps, stepDelay, scrollRange);

  await browser.close();

  if (!result.success) {
    console.error(`   ❌ 분석 실패: ${result.error || 'Unknown error'}`);
    return null;
  }

  const analytics = result.analytics;
  console.log(`   ✅ SendWithPromise 분석 완료`);
  console.log(`      - SendWithPromise 호출: ${analytics.sendWithPromiseCalls.length}개`);
  console.log(`      - 스크롤 이벤트: ${analytics.scrollEvents.length}개`);

  return {
    version: versionName,
    detectedVersion: versionInfo.versionText,
    url: testUrl,
    duration: result.duration,
    analytics: analytics,
    timestamp: new Date().toISOString(),
  };
}

/**
 * SendWithPromise 호출 상세 분석
 */
function analyzeSendWithPromiseDetails(data) {
  console.log(`\n📊 SendWithPromise 호출 상세 분석: ${data.version}`);
  console.log('='.repeat(80));

  const { sendWithPromiseCalls, scrollEvents } = data.analytics;

  if (sendWithPromiseCalls.length === 0) {
    console.log('⚠️ SendWithPromise 호출이 감지되지 않았습니다.');
    console.log('   함수가 후킹되지 않았거나 해당 버전에서 사용되지 않을 수 있습니다.');
    return;
  }

  // SendWithPromise 호출 통계
  const totalCalls = sendWithPromiseCalls.length;
  const avgDuration = sendWithPromiseCalls
    .filter(call => call.duration !== undefined)
    .reduce((sum, call) => sum + call.duration, 0) / totalCalls;
  const maxDuration = Math.max(...sendWithPromiseCalls
    .filter(call => call.duration !== undefined)
    .map(call => call.duration));

  console.log(`\n⏱️  SendWithPromise 호출 통계:`);
  console.log(`   총 호출 횟수: ${totalCalls}개`);
  if (avgDuration) {
    console.log(`   평균 지속시간: ${avgDuration.toFixed(2)}ms`);
    console.log(`   최대 지속시간: ${maxDuration.toFixed(2)}ms`);
  }

  // 호출 패턴 분석
  console.log(`\n📈 호출 패턴 분석:`);
  
  const callsWithDuration = sendWithPromiseCalls.filter(call => call.duration !== undefined);
  const promiseCalls = sendWithPromiseCalls.filter(call => call.promiseResult !== undefined);
  
  console.log(`   직접 반환 호출: ${callsWithDuration.filter(call => call.directReturn).length}개`);
  console.log(`   Promise 반환 호출: ${promiseCalls.length}개`);
  
  if (promiseCalls.length > 0) {
    const resolved = promiseCalls.filter(call => call.promiseResult === 'resolved').length;
    const rejected = promiseCalls.filter(call => call.promiseResult === 'rejected').length;
    console.log(`   - 해결된 Promise: ${resolved}개`);
    console.log(`   - 거부된 Promise: ${rejected}개`);
  }

  // 스크롤과 SendWithPromise 호출 상관관계 분석
  console.log(`\n🔗 스크롤 이벤트와 SendWithPromise 호출 상관관계:`);
  
  let callsRelatedToScroll = 0;
  const scrollCorrelation = [];

  sendWithPromiseCalls.forEach(call => {
    const callTime = call.timestamp;
    
    // 호출 전후 500ms 내 스크롤 이벤트 찾기
    const nearbyScrollEvents = scrollEvents.filter(event => {
      const scrollTime = event.timestamp;
      return Math.abs(scrollTime - callTime) <= 500;
    });
    
    if (nearbyScrollEvents.length > 0) {
      callsRelatedToScroll++;
      scrollCorrelation.push({
        callId: call.id,
        callTime: callTime,
        nearbyScrollEvents: nearbyScrollEvents.length,
        scrollTimes: nearbyScrollEvents.map(e => ({ time: e.timestamp, scrollTop: e.scrollTop }))
      });
    }
  });

  console.log(`   스크롤과 연관된 SendWithPromise 호출: ${callsRelatedToScroll}/${totalCalls}개 (${(callsRelatedToScroll/totalCalls*100).toFixed(1)}%)`);

  // 상세 상관관계 정보
  if (scrollCorrelation.length > 0) {
    console.log(`\n📋 상세 상관관계 분석:`);
    scrollCorrelation.slice(0, 10).forEach((correlation, idx) => {
      console.log(`   ${idx + 1}. 호출 #${correlation.callId} @ ${(correlation.callTime / 1000).toFixed(2)}s`);
      console.log(`      → 근처 스크롤 이벤트: ${correlation.nearbyScrollEvents}개`);
      correlation.scrollTimes.slice(0, 3).forEach(scroll => {
        console.log(`        - ${(scroll.time / 1000).toFixed(2)}s: 스크롤 위치 ${scroll.scrollTop.toFixed(0)}px`);
      });
    });
  }

  // 시간대별 호출 분포
  console.log(`\n📅 시간대별 호출 분포:`);
  const timeBuckets = {};
  sendWithPromiseCalls.forEach(call => {
    const bucket = Math.floor(call.timestamp / 1000) * 1000;
    timeBuckets[bucket] = (timeBuckets[bucket] || 0) + 1;
  });

  Object.entries(timeBuckets).forEach(([time, count]) => {
    console.log(`   ${(parseInt(time) / 1000).toFixed(1)}s-${((parseInt(time) + 1000) / 1000).toFixed(1)}s: ${count}개 호출`);
  });

  // 가장 최근 호출들 상세 정보
  console.log(`\n🎯 최근 10개 SendWithPromise 호출 상세 분석:`);
  const recentCalls = [...sendWithPromiseCalls].slice(-10);
  recentCalls.forEach((call, idx) => {
    console.log(`\n   ${idx + 1}. 호출 #${call.id} @ ${(call.timestamp / 1000).toFixed(3)}s`);
    console.log(`      📍 위치: ${call.callLocation}`);
    console.log(`      📊 인자 수: ${call.args}개`);
    
    if (call.duration !== undefined) {
      console.log(`      ⏱️  지속시간: ${call.duration.toFixed(2)}ms`);
    }
    
    if (call.promiseResult) {
      console.log(`      🔄 Promise 결과: ${call.promiseResult}`);
      if (call.resolveTime !== undefined) {
        console.log(`      ✅ 해결 시간: ${call.resolveTime.toFixed(2)}ms`);
      }
      if (call.rejectTime !== undefined) {
        console.log(`      ❌ 거부 시간: ${call.rejectTime.toFixed(2)}ms`);
      }
    }
    
    if (call.error) {
      console.log(`      ❌ 에러: ${call.error}`);
    }
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
    if (url3) urls.push({ url: url3, name: name3 });
  }

  if (urls.length === 0) {
    console.error('❌ URL을 지정해주세요 (--url 또는 --url1, --url2, --url3)');
    console.error('\n사용 예:');
    console.error('  node bench/sendwithpromise-tracking/bench-sendwithpromise-analytics.js --url "http://localhost:3000/feedback/4"');
    console.error('  node bench/sendwithpromise-tracking/bench-sendwithpromise-analytics.js --url1 "http://localhost:3000/feedback-basic/4" --name1 "Base" --url2 "http://localhost:3000/feedback/4?version=pdf" --name2 "PDF" --url3 "http://localhost:3000/feedback/4?version=queue" --name3 "Queue"');
    process.exit(1);
  }

  console.log('\n🚀 SendWithPromise 호출 분석 벤치마크');
  console.log('='.repeat(80));
  console.log(`설정:`);
  console.log(`  - CPU Throttle: ${cpuThrottle}x`);
  console.log(`  - 스크롤 단계: ${scrollSteps}단계, ${stepDelay}ms 간격`);
  console.log(`  - 스크롤 범위: 전체의 ${(scrollRange * 100).toFixed(0)}%`);
  console.log(`  - Headless: ${headless}`);

  const results = [];

  for (const { url, name } of urls) {
    const result = await analyzeSendWithPromiseCalls(url, name);
    if (result) {
      results.push(result);
      analyzeSendWithPromiseDetails(result);
    }
  }

  // 결과 저장
  let outputPath;
  if (outputFile) {
    outputPath = path.isAbsolute(outputFile) ? outputFile : path.join(benchDir, outputFile);
  } else {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    outputPath = path.join(outDir, `sendwithpromise-analysis-${timestamp}.json`);
  }
  
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const summary = {
    timestamp: new Date().toISOString(),
    config: {
      cpuThrottle,
      scrollSteps,
      stepDelay,
      headless,
    },
    results: results,
  };

  fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));

  console.log(`\n\n💾 결과 저장: ${outputPath}`);
  console.log(`   분석된 버전: ${results.length}개`);
  
  // 최종 요약
  console.log('\n' + '='.repeat(80));
  console.log('📋 최종 요약');
  console.log('='.repeat(80));
  
  results.forEach(result => {
    const analytics = result.analytics;
    const { sendWithPromiseCalls, scrollEvents } = analytics;
    
    console.log(`\n🔹 ${result.version}:`);
    console.log(`   📞 SendWithPromise 호출: ${sendWithPromiseCalls.length}개`);
    console.log(`   📜 스크롤 이벤트: ${scrollEvents.length}개`);
    
    if (sendWithPromiseCalls.length > 0) {
      const callsWithDuration = sendWithPromiseCalls.filter(call => call.duration !== undefined);
      const avgDuration = callsWithDuration.length > 0 ? 
        callsWithDuration.reduce((sum, call) => sum + call.duration, 0) / callsWithDuration.length : 0;
      console.log(`   ⏱️  평균 호출 시간: ${avgDuration.toFixed(2)}ms`);
    }
  });
  
  console.log('\n✅ SendWithPromise 분석 완료!\n');

})().catch((e) => {
  console.error('❌ 오류 발생:', e);
  console.error(e.stack);
  process.exit(1);
});
