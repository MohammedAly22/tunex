'use client';

import { useState, useCallback } from 'react';
import { GPUInfo } from '@/lib/types';
import { useWebSocket } from './useWebSocket';

const DEFAULT_GPU: GPUInfo = {
  name: 'No GPU Detected',
  vram_total_gb: 0,
  vram_used_gb: 0,
  utilization_pct: 0,
  temperature_c: 0,
  compute_capability: 'N/A',
  driver_version: 'N/A',
  cuda_version: 'N/A',
};

export function useGPUStats() {
  const [gpu, setGpu] = useState<GPUInfo>(DEFAULT_GPU);
  const [hasGpu, setHasGpu] = useState(false);

  const handleMessage = useCallback((event: { type: string; vram_used_gb?: number; vram_total_gb?: number; utilization_pct?: number; temperature_c?: number }) => {
    if (event.type === 'gpu_stats') {
      setGpu((prev) => ({
        ...prev,
        vram_used_gb: event.vram_used_gb ?? prev.vram_used_gb,
        vram_total_gb: event.vram_total_gb ?? prev.vram_total_gb,
        utilization_pct: event.utilization_pct ?? prev.utilization_pct,
        temperature_c: event.temperature_c ?? prev.temperature_c,
      }));
      setHasGpu(true);
    }
  }, []);

  const { connected } = useWebSocket({
    path: '/ws/gpu',
    onMessage: handleMessage as (event: unknown) => void,
    autoConnect: true,
  });

  return { gpu, hasGpu, connected };
}
