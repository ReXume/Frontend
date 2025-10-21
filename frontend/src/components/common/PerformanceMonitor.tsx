'use client';

import React, { useState, useEffect, useRef } from 'react';

interface PerformanceMetrics {
  cpuUsage: number;
  memoryUsage: number;
  fps: number;
  longTasks: number;
  timestamp: number;
}

// Performance Observer를 사용한 LongTask 추적
const useLongTaskObserver = () => {
  const [longTasks, setLongTasks] = useState(0);
  const observerRef = useRef<PerformanceObserver | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      return;
    }

    try {
      observerRef.current = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        setLongTasks(prev => prev + entries.length);
      });

      observerRef.current.observe({ entryTypes: ['longtask'] });
    } catch (error) {
      console.warn('LongTask observer not supported:', error);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return longTasks;
};

// FPS 측정
const useFPSMeasure = () => {
  const [fps, setFps] = useState(60);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());

  useEffect(() => {
    let animationId: number;

    const measureFPS = () => {
      frameCountRef.current++;
      const currentTime = performance.now();
      
      if (currentTime - lastTimeRef.current >= 1000) {
        setFps(Math.round((frameCountRef.current * 1000) / (currentTime - lastTimeRef.current)));
        frameCountRef.current = 0;
        lastTimeRef.current = currentTime;
      }
      
      animationId = requestAnimationFrame(measureFPS);
    };

    animationId = requestAnimationFrame(measureFPS);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, []);

  return fps;
};

// 메모리 사용량 측정
const useMemoryMeasure = () => {
  const [memoryUsage, setMemoryUsage] = useState(0);

  useEffect(() => {
    const updateMemory = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024);
        setMemoryUsage(usedMB);
      }
    };

    updateMemory();
    const interval = setInterval(updateMemory, 1000);

    return () => clearInterval(interval);
  }, []);

  return memoryUsage;
};

// CPU 사용률 측정 (메인 스레드 블로킹 기반)
const useCPUUsageMeasure = () => {
  const [cpuUsage, setCpuUsage] = useState(0);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsSupported(true);
    let lastFrameTime = performance.now();
    let blockedTime = 0;
    let frameCount = 0;
    let lastCpuUpdate = performance.now();

    const measureFrame = () => {
      const currentTime = performance.now();
      const frameDuration = currentTime - lastFrameTime;
      
      // 16.67ms (60fps 기준)보다 오래 걸린 프레임은 메인 스레드가 블로킹된 것으로 간주
      const expectedFrameTime = 16.67;
      if (frameDuration > expectedFrameTime) {
        blockedTime += frameDuration - expectedFrameTime;
      }
      
      frameCount++;
      lastFrameTime = currentTime;
      
      // 1초마다 CPU 사용률 업데이트
      if (currentTime - lastCpuUpdate >= 1000) {
        const totalExpectedTime = frameCount * expectedFrameTime;
        const cpuPercent = blockedTime > 0 && totalExpectedTime > 0 
          ? Math.min(100, Math.round((blockedTime / totalExpectedTime) * 100))
          : 0;
        
        setCpuUsage(cpuPercent);
        
        // 리셋
        blockedTime = 0;
        frameCount = 0;
        lastCpuUpdate = currentTime;
      }
      
      requestAnimationFrame(measureFrame);
    };

    requestAnimationFrame(measureFrame);
  }, []);

  return { cpuUsage, isSupported };
};

const PerformanceMonitor: React.FC = () => {
  const [isVisible, setIsVisible] = useState(true);
  const [position, setPosition] = useState<'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'>('top-right');
  
  const fps = useFPSMeasure();
  const memoryUsage = useMemoryMeasure();
  const longTasks = useLongTaskObserver();
  const { cpuUsage, isSupported: cpuSupported } = useCPUUsageMeasure();
  
  // LongTask가 많을 때 CPU 부하를 더 정확히 반영
  const [adjustedCpuUsage, setAdjustedCpuUsage] = useState(cpuUsage);
  
  useEffect(() => {
    // LongTask가 발생하면 CPU 사용률을 조정 (50ms 이상의 긴 작업은 더 큰 CPU 부하를 의미)
    let adjustment = cpuUsage;
    if (longTasks > 0) {
      // LongTask 하나당 추가로 5-10% CPU 부하로 간주 (최대 100%까지)
      adjustment = Math.min(100, cpuUsage + (longTasks * 8));
    }
    setAdjustedCpuUsage(adjustment);
  }, [cpuUsage, longTasks]);

  // 성능 지표에 따른 색상 결정
  const getStatusColor = (value: number, thresholds: { good: number; warning: number; critical: number }) => {
    if (value <= thresholds.good) return 'text-green-600';
    if (value <= thresholds.warning) return 'text-yellow-600';
    return 'text-red-600';
  };

  const fpsColor = getStatusColor(60 - fps, { good: 10, warning: 20, critical: 30 });
  const memoryColor = getStatusColor(100 - memoryUsage, { good: 30, warning: 10, critical: 0 });
  const cpuColor = getStatusColor(100 - adjustedCpuUsage, { good: 30, warning: 10, critical: 0 });

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed top-4 right-4 z-50 px-3 py-1 bg-blue-500 text-white text-xs rounded shadow-lg hover:bg-blue-600 transition-colors"
      >
        📊 성능 모니터
      </button>
    );
  }

  return (
    <div className={`fixed z-50 bg-black bg-opacity-80 text-white text-xs font-mono rounded-lg shadow-lg p-3 ${
      position === 'top-right' ? 'top-4 right-4' :
      position === 'top-left' ? 'top-4 left-4' :
      position === 'bottom-right' ? 'bottom-4 right-4' :
      'bottom-4 left-4'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold">실시간 성능 모니터</span>
        <div className="flex space-x-2">
          <button
            onClick={() => {
              const positions = ['top-right', 'top-left', 'bottom-right', 'bottom-left'] as const;
              const currentIndex = positions.indexOf(position);
              setPosition(positions[(currentIndex + 1) % positions.length]);
            }}
            className="px-2 py-1 bg-gray-600 rounded text-xs hover:bg-gray-500 transition-colors"
          >
            📍
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="px-2 py-1 bg-gray-600 rounded text-xs hover:bg-gray-500 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
      
      <div className="space-y-1">
        <div className="flex justify-between">
          <span>FPS:</span>
          <span className={fpsColor}>{fps}</span>
        </div>
        
        <div className="flex justify-between">
          <span>메모리:</span>
          <span className={memoryColor}>{memoryUsage}MB</span>
        </div>
        
        <div className="flex justify-between">
          <span>CPU:</span>
          <span className={cpuColor}>
            {cpuSupported ? `${adjustedCpuUsage}%` : '측정 불가'}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span>LongTask:</span>
          <span className={longTasks > 0 ? 'text-red-400' : 'text-green-400'}>{longTasks}</span>
        </div>
        
        <div className="flex justify-between text-gray-400">
          <span>업데이트:</span>
          <span>{new Date().toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
};

export default PerformanceMonitor;
