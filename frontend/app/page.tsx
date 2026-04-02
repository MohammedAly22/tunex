'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  Cpu,
  Brain,
  FlaskConical,
  HardDrive,
  Sparkles,
  SlidersHorizontal,
  PlayCircle,
  ChevronRight,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { TableRowSkeleton } from '@/components/ui/Skeleton';
import SplashIntro from '@/components/layout/SplashIntro';
import { cn, formatDate } from '@/lib/utils';
import { Experiment, GPUInfo } from '@/lib/types';
import { API_BASE_URL } from '@/lib/constants';

const DEMO_EXPERIMENTS: Experiment[] = [
  {
    id: 'exp-001',
    name: 'Qwen 2.5 7B Python Coder',
    base_model: 'Qwen/Qwen2.5-7B',
    dataset: 'sahil2801/CodeAlpaca-20k',
    method: 'qlora',
    status: 'completed',
    created_at: '2026-03-28T10:30:00Z',
    updated_at: '2026-03-28T14:22:00Z',
    config: {} as Experiment['config'],
  },
  {
    id: 'exp-002',
    name: 'Llama 3.1 Chat Assistant',
    base_model: 'meta-llama/Llama-3.1-8B',
    dataset: 'Open-Orca/OpenOrca',
    method: 'lora',
    status: 'training',
    created_at: '2026-03-30T08:15:00Z',
    updated_at: '2026-03-30T08:15:00Z',
    config: {} as Experiment['config'],
  },
  {
    id: 'exp-003',
    name: 'Mistral Summarizer',
    base_model: 'mistralai/Mistral-7B-v0.3',
    dataset: 'cnn_dailymail',
    method: 'lora',
    status: 'failed',
    created_at: '2026-03-25T16:00:00Z',
    updated_at: '2026-03-25T18:30:00Z',
    config: {} as Experiment['config'],
  },
];

function StatusCard({
  icon: Icon,
  label,
  value,
  subtext,
  status,
  delay,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subtext: string;
  status?: 'success' | 'warning' | 'error';
  delay: number;
}) {
  const statusColors = {
    success: 'text-success',
    warning: 'text-warning',
    error: 'text-error',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="bg-surface-1 border border-border rounded-lg p-4 flex items-start gap-3 hover:-translate-y-px transition-transform duration-150"
    >
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon size={18} className="text-primary" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] text-text-muted uppercase tracking-wider mb-1">{label}</div>
        <div className={cn('text-[15px] font-mono font-semibold', status && statusColors[status])}>
          {value}
        </div>
        <div className="text-[11px] text-text-muted mt-0.5">{subtext}</div>
      </div>
      {status && (
        <div className="ml-auto mt-1">
          <div
            className={cn(
              'w-2 h-2 rounded-full',
              status === 'success' && 'bg-success',
              status === 'warning' && 'bg-warning',
              status === 'error' && 'bg-error'
            )}
          />
        </div>
      )}
    </motion.div>
  );
}

export default function DashboardPage() {
  const [experiments, setExperiments] = useState<Experiment[]>(DEMO_EXPERIMENTS);
  const [loading, setLoading] = useState(true);
  const [gpuInfo, setGpuInfo] = useState<GPUInfo | null>(null);
  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('tunex-splash-dismissed')) {
      setShowSplash(true);
    }
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/experiments`);
        if (res.ok) {
          const data = await res.json();
          if (data.length > 0) setExperiments(data);
        }
      } catch {
        // Use demo data
      }
      try {
        const res = await fetch(`${API_BASE_URL}/api/gpu`);
        if (res.ok) {
          setGpuInfo(await res.json());
        }
      } catch {
        // No GPU info available
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  const runningCount = experiments.filter((e) => e.status === 'training').length;
  const completedCount = experiments.filter((e) => e.status === 'completed').length;

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      {/* Splash Intro */}
      <AnimatePresence>
        {showSplash && (
          <SplashIntro onDismiss={() => { setShowSplash(false); localStorage.setItem('tunex-splash-dismissed', '1'); }} />
        )}
      </AnimatePresence>

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-10"
      >
        <h1 className="text-[48px] font-mono font-bold gradient-text leading-tight mb-2">TuneX</h1>
        <p className="text-[18px] text-text-secondary mb-1">Agentic Fine-Tuning Platform</p>
        <p className="text-[13px] text-text-muted mb-6">
          From prompt to checkpoint. Let AI agents handle your fine-tuning pipeline.
        </p>
        <Link
          href="/experiment/new"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary-hover text-white text-[15px] font-medium rounded-md transition-colors duration-150"
        >
          New Experiment
          <ArrowRight size={16} />
        </Link>
      </motion.div>

      {/* Status Bar */}
      <div className="grid grid-cols-4 gap-4 mb-10">
        <StatusCard
          icon={Cpu}
          label="GPU Detected"
          value={gpuInfo?.name || 'Detecting...'}
          subtext={
            gpuInfo
              ? `${gpuInfo.vram_total_gb} GB VRAM · ${gpuInfo.utilization_pct}% util · ${gpuInfo.temperature_c}°C`
              : 'Connect backend to detect GPU'
          }
          status={gpuInfo ? 'success' : 'warning'}
          delay={0.1}
        />
        <StatusCard
          icon={Brain}
          label="LLM Backend"
          value="Not Configured"
          subtext="Configure in Settings"
          status="warning"
          delay={0.15}
        />
        <StatusCard
          icon={FlaskConical}
          label="Experiments"
          value={`${experiments.length} total`}
          subtext={`${runningCount} running · ${completedCount} completed`}
          delay={0.2}
        />
        <StatusCard
          icon={HardDrive}
          label="Storage"
          value="--"
          subtext="Connect backend for disk info"
          delay={0.25}
        />
      </div>

      {/* Recent Experiments Table */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[18px] font-mono font-semibold">Recent Experiments</h2>
          <Link
            href="/experiment/new"
            className="text-[13px] text-primary hover:text-primary-hover transition-colors flex items-center gap-1"
          >
            New Experiment <ChevronRight size={14} />
          </Link>
        </div>

        <div className="bg-surface-1 border border-border rounded-lg overflow-hidden">
          <div className="grid grid-cols-[2fr_1.5fr_1.5fr_100px_100px_80px_60px] gap-4 px-4 py-2.5 border-b border-border text-[11px] text-text-muted uppercase tracking-wider">
            <span>Experiment</span>
            <span>Base Model</span>
            <span>Dataset</span>
            <span>Method</span>
            <span>Status</span>
            <span>Date</span>
            <span />
          </div>

          {loading ? (
            <>
              <TableRowSkeleton />
              <TableRowSkeleton />
              <TableRowSkeleton />
            </>
          ) : experiments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-text-muted">
              <FlaskConical size={40} className="mb-3 opacity-30" />
              <p className="text-[15px] mb-1">No experiments yet.</p>
              <p className="text-[13px]">Start your first fine-tuning run.</p>
            </div>
          ) : (
            experiments.map((exp, i) => (
              <motion.div
                key={exp.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.05 * i }}
              >
                <Link
                  href={`/experiment/${exp.id}/agents`}
                  className="grid grid-cols-[2fr_1.5fr_1.5fr_100px_100px_80px_60px] gap-4 px-4 py-3 border-b border-border last:border-0 hover:bg-surface-2 transition-colors duration-150 items-center"
                >
                  <span className="text-[13px] font-medium text-text-primary truncate">
                    {exp.name}
                  </span>
                  <span className="text-[13px] text-text-secondary font-mono truncate">
                    {exp.base_model}
                  </span>
                  <span className="text-[13px] text-text-secondary truncate">{exp.dataset}</span>
                  <Badge>{exp.method.toUpperCase()}</Badge>
                  <Badge variant="status" status={exp.status}>
                    {exp.status === 'training' && <span className="w-2 h-2 rounded-full bg-success animate-breathe inline-block mr-1.5" />}
                    {exp.status}
                  </Badge>
                  <span className="text-[11px] text-text-muted">{formatDate(exp.created_at)}</span>
                  <div className="flex items-center gap-1">
                    <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExperiments(prev => prev.filter(exp2 => exp2.id !== exp.id)); }} className="p-1 text-text-muted hover:text-error transition-colors"><Trash2 size={14} /></button>
                    <ChevronRight size={14} className="text-text-muted" />
                  </div>
                </Link>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Quick Start Cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            icon: Sparkles,
            title: 'Agent-Driven',
            description: "Describe what you need. Agents handle the rest.",
            href: '/experiment/new?mode=agent',
          },
          {
            icon: SlidersHorizontal,
            title: 'Custom Setup',
            description: 'Full control over every parameter.',
            href: '/experiment/new?mode=custom',
          },
          {
            icon: PlayCircle,
            title: 'Resume Experiment',
            description: 'Continue a previous run.',
            href: '/experiment/new?mode=resume',
          },
        ].map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.05 }}
          >
            <Link
              href={card.href}
              className="block bg-surface-1 border border-border rounded-lg p-5 hover:-translate-y-px hover:border-primary/30 transition-all duration-150 group"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                <card.icon size={20} className="text-primary" />
              </div>
              <h3 className="text-[15px] font-medium mb-1">{card.title}</h3>
              <p className="text-[13px] text-text-secondary">{card.description}</p>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
