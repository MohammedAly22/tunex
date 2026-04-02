'use client';

import { useState, useCallback } from 'react';
import { TrainingMetrics, ExperimentStatus, WSEvent, LogLevel } from '@/lib/types';
import { useWebSocket } from './useWebSocket';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
}

export function useTrainingMetrics(experimentId: string) {
  const [metrics, setMetrics] = useState<TrainingMetrics[]>([]);
  const [currentMetrics, setCurrentMetrics] = useState<TrainingMetrics | null>(null);
  const [status, setStatus] = useState<ExperimentStatus>('configuring');
  const [progressPct, setProgressPct] = useState(0);
  const [etaSeconds, setEtaSeconds] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const handleMessage = useCallback((event: WSEvent) => {
    if (event.type === 'training_metrics') {
      const m: TrainingMetrics = {
        step: event.step,
        epoch: event.epoch,
        loss: event.loss,
        lr: event.lr,
        grad_norm: event.grad_norm,
        tokens_per_sec: event.tokens_per_sec,
        total_steps: event.total_steps,
      };
      setMetrics((prev) => [...prev, m]);
      setCurrentMetrics(m);
    } else if (event.type === 'training_status') {
      setStatus(event.status);
      setProgressPct(event.progress_pct);
      setEtaSeconds(event.eta_seconds);
    } else if (event.type === 'training_log') {
      setLogs((prev) => [
        ...prev,
        { level: event.level, message: event.message, timestamp: event.timestamp },
      ]);
    }
  }, []);

  const { connected, send } = useWebSocket({
    path: `/ws/experiment/${experimentId}/training`,
    onMessage: handleMessage,
  });

  const stopTraining = useCallback(() => {
    send({ type: 'stop_training' });
  }, [send]);

  return {
    metrics,
    currentMetrics,
    status,
    progressPct,
    etaSeconds,
    logs,
    connected,
    stopTraining,
  };
}
