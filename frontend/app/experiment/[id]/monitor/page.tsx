'use client';

import { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Play,
  Pause,
  Square,
  Clock,
  TrendingDown,
  Zap,
  Cpu,
  Thermometer,
  Search,
  Download,
  ArrowRight,
  AlertTriangle,
  CheckCircle,
  Shield,
} from 'lucide-react';
import { cn, formatDuration, formatNumber } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';

// Generate demo training data
function generateDemoData(steps: number) {
  const data = [];
  for (let i = 0; i <= steps; i += 10) {
    const progress = i / steps;
    const baseLoss = 2.5 * Math.exp(-3 * progress) + 0.08;
    const noise = (Math.random() - 0.5) * 0.1 * (1 - progress * 0.5);
    const lr = progress < 0.03 ? (progress / 0.03) * 2e-4 : 2e-4 * (1 + Math.cos(Math.PI * (progress - 0.03) / 0.97)) / 2;
    data.push({
      step: i,
      loss: Math.max(0.05, baseLoss + noise),
      val_loss: Math.max(0.06, baseLoss + noise * 0.5 + 0.02),
      lr: lr,
      vram: 14.2 + Math.random() * 0.5,
      temp: 68 + Math.random() * 8,
      util: 92 + Math.random() * 8,
    });
  }
  return data;
}

const TOTAL_STEPS = 1800;
const ALL_DATA = generateDemoData(TOTAL_STEPS);

type LogLevel = 'info' | 'warning' | 'error' | 'debug';

const DEMO_LOGS: { level: LogLevel; msg: string; ts: string }[] = [
  { level: 'info', msg: '[2026-03-30 08:15:02] Starting training run...', ts: '08:15:02' },
  { level: 'info', msg: '[2026-03-30 08:15:03] Loading model: Qwen/Qwen2.5-7B', ts: '08:15:03' },
  { level: 'info', msg: '[2026-03-30 08:15:15] Model loaded. Applying LoRA adapters...', ts: '08:15:15' },
  { level: 'info', msg: '[2026-03-30 08:15:16] LoRA config: r=16, alpha=32, target_modules=[q_proj, k_proj, v_proj, o_proj]', ts: '08:15:16' },
  { level: 'info', msg: '[2026-03-30 08:15:18] Loading dataset: sahil2801/CodeAlpaca-20k', ts: '08:15:18' },
  { level: 'info', msg: '[2026-03-30 08:15:22] Dataset loaded. Train: 18000, Eval: 2000', ts: '08:15:22' },
  { level: 'info', msg: '[2026-03-30 08:15:23] Starting training: 3 epochs, 1800 steps total', ts: '08:15:23' },
  { level: 'info', msg: '[Step 100/1800] Loss: 1.842, LR: 1.98e-04, Tokens/s: 4521', ts: '08:16:45' },
  { level: 'info', msg: '[Step 200/1800] Loss: 1.234, LR: 1.94e-04, Tokens/s: 4612', ts: '08:18:07' },
  { level: 'info', msg: '[Step 300/1800] Loss: 0.891, LR: 1.87e-04, Tokens/s: 4589', ts: '08:19:29' },
  { level: 'warning', msg: '[Step 400/1800] Loss spike detected: 0.78 → 1.12', ts: '08:20:51' },
  { level: 'info', msg: '[Step 500/1800] Loss: 0.645, LR: 1.76e-04, Tokens/s: 4634', ts: '08:22:13' },
  { level: 'info', msg: '[Step 600/1800] Epoch 1/3 complete. Eval loss: 0.712', ts: '08:23:35' },
  { level: 'info', msg: '[Step 700/1800] Loss: 0.423, LR: 1.62e-04, Tokens/s: 4601', ts: '08:24:57' },
  { level: 'info', msg: '[Step 800/1800] Loss: 0.342, LR: 1.47e-04, Tokens/s: 4578', ts: '08:26:19' },
  { level: 'debug', msg: 'Checkpoint saved: outputs/checkpoint-800', ts: '08:26:22' },
  { level: 'info', msg: '[Step 900/1800] Loss: 0.287, LR: 1.31e-04, Tokens/s: 4612', ts: '08:27:41' },
];

const MONITORING_ENTRIES = [
  { ts: '08:15:23', check: 'Training Start', result: 'success' as const, detail: 'Training initialized successfully' },
  { ts: '08:16:45', check: 'Loss Analysis', result: 'success' as const, detail: 'Loss decreasing steadily at 1.842' },
  { ts: '08:20:51', check: 'Anomaly Detection', result: 'warning' as const, detail: 'Loss spike detected (0.78 → 1.12). Normal fluctuation from LR warmup completion.' },
  { ts: '08:22:13', check: 'Resource Monitor', result: 'success' as const, detail: 'GPU temp stable at 72°C. VRAM: 14.2/24.0 GB' },
  { ts: '08:23:35', check: 'Quality Check', result: 'success' as const, detail: 'Epoch 1 complete. Eval loss improving.' },
  { ts: '08:26:22', check: 'Checkpoint', result: 'success' as const, detail: 'Checkpoint saved at step 800' },
];

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }) {
  if (!active || !payload) return null;
  return (
    <div className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-[11px]">
      <div className="text-text-muted mb-1">Step {label}</div>
      {payload.map((p, i) => (
        <div key={i} className="text-text-primary">
          {p.name}: <span className="font-mono">{typeof p.value === 'number' ? p.value.toFixed(4) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function TrainingMonitorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [tab, setTab] = useState<'metrics' | 'logs' | 'monitoring' | 'config'>('metrics');
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState(ALL_DATA.slice(0, 1));
  const [paused, setPaused] = useState(false);
  const [logFilter, setLogFilter] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  // Animate data loading
  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        const next = prev + 1;
        if (next >= ALL_DATA.length) {
          clearInterval(interval);
          return prev;
        }
        setData(ALL_DATA.slice(0, next + 1));
        return next;
      });
    }, 200);
    return () => clearInterval(interval);
  }, [paused]);

  const latest = data[data.length - 1];
  const bestLoss = Math.min(...data.map((d) => d.loss));
  const stepNum = latest?.step || 0;
  const epoch = Math.floor(stepNum / 600) + 1;
  const progressPct = (stepNum / TOTAL_STEPS) * 100;
  const etaSeconds = ((TOTAL_STEPS - stepNum) / (stepNum || 1)) * (data.length * 0.2);
  const isComplete = stepNum >= TOTAL_STEPS;

  const tabs = [
    { id: 'metrics' as const, label: 'Live Metrics', icon: '📈' },
    { id: 'logs' as const, label: 'Terminal Logs', icon: '🖥️' },
    { id: 'monitoring' as const, label: 'Monitoring Agent', icon: '🛡️' },
    { id: 'config' as const, label: 'Configuration', icon: '⚙️' },
  ];

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-surface-1 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-[15px] font-mono font-semibold">Experiment: {id}</h1>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-[11px] text-text-muted font-mono">Qwen/Qwen2.5-7B</span>
              <Badge>LoRA</Badge>
              <Badge variant="status" status={isComplete ? 'completed' : 'training'}>
                {isComplete ? 'Completed' : 'Training'}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[13px] font-mono">
              Epoch {Math.min(epoch, 3)}/3 — Step {formatNumber(stepNum)}/{formatNumber(TOTAL_STEPS)}
            </div>
            <div className="w-48 h-1.5 bg-surface-3 rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
          <span className="text-[11px] text-text-muted flex items-center gap-1">
            <Clock size={12} />
            {isComplete ? 'Done' : `~${formatDuration(etaSeconds)} remaining`}
          </span>
          {isComplete ? (
            <button
              onClick={() => router.push(`/experiment/${id}/results`)}
              className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary hover:bg-primary-hover text-white text-[13px] font-medium rounded-md transition-colors"
            >
              View Results <ArrowRight size={14} />
            </button>
          ) : (
            <button
              onClick={() => setPaused(!paused)}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-error/10 hover:bg-error/20 border border-error/30 rounded-md text-[12px] text-error transition-colors"
            >
              <Square size={12} />
              Stop Training
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border bg-surface-1 px-6 flex-shrink-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-2.5 text-[13px] border-b-2 transition-colors',
              tab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            )}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-6 min-h-0">
        {tab === 'metrics' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-6 gap-3">
              {[
                { label: 'Current Loss', value: latest?.loss.toFixed(4) || '--', icon: TrendingDown, color: 'text-primary' },
                { label: 'Best Loss', value: bestLoss.toFixed(4), icon: TrendingDown, color: 'text-success' },
                { label: 'Learning Rate', value: latest?.lr.toExponential(2) || '--', icon: Zap, color: 'text-warning' },
                { label: 'Tokens/sec', value: '4,612', icon: Zap, color: 'text-secondary' },
                { label: 'GPU Util', value: `${latest?.util.toFixed(0) || '--'}%`, icon: Cpu, color: 'text-primary' },
                { label: 'GPU Temp', value: `${latest?.temp.toFixed(0) || '--'}°C`, icon: Thermometer, color: 'text-warning' },
              ].map((card) => (
                <div key={card.label} className="bg-surface-1 border border-border rounded-lg p-3">
                  <div className="text-[11px] text-text-muted mb-1">{card.label}</div>
                  <div className={cn('text-[18px] font-mono font-semibold', card.color)}>
                    {card.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Main Loss Chart */}
            <div className="bg-surface-1 border border-border rounded-lg p-4">
              <h3 className="text-[13px] font-mono font-semibold mb-3">Training Loss</h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="lossGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A3A" />
                  <XAxis dataKey="step" tick={{ fill: '#555566', fontSize: 11 }} stroke="#2A2A3A" />
                  <YAxis tick={{ fill: '#555566', fontSize: 11 }} stroke="#2A2A3A" />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="loss" stroke="#6366F1" fill="url(#lossGradient)" strokeWidth={2} name="Train Loss" />
                  <Line type="monotone" dataKey="val_loss" stroke="#22D3EE" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Val Loss" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Secondary Charts */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-surface-1 border border-border rounded-lg p-4">
                <h3 className="text-[13px] font-mono font-semibold mb-3">Learning Rate</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2A2A3A" />
                    <XAxis dataKey="step" tick={{ fill: '#555566', fontSize: 10 }} stroke="#2A2A3A" />
                    <YAxis tick={{ fill: '#555566', fontSize: 10 }} stroke="#2A2A3A" tickFormatter={(v: number) => v.toExponential(1)} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="lr" stroke="#F59E0B" strokeWidth={1.5} dot={false} name="LR" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-surface-1 border border-border rounded-lg p-4">
                <h3 className="text-[13px] font-mono font-semibold mb-3">GPU VRAM Usage</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={data}>
                    <defs>
                      <linearGradient id="vramGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22D3EE" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22D3EE" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2A2A3A" />
                    <XAxis dataKey="step" tick={{ fill: '#555566', fontSize: 10 }} stroke="#2A2A3A" />
                    <YAxis tick={{ fill: '#555566', fontSize: 10 }} stroke="#2A2A3A" domain={[0, 24]} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="vram" stroke="#22D3EE" fill="url(#vramGrad)" strokeWidth={1.5} name="VRAM (GB)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {tab === 'logs' && (
          <div className="bg-black rounded-lg border border-border overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface-1">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-error/60" />
                  <div className="w-3 h-3 rounded-full bg-warning/60" />
                  <div className="w-3 h-3 rounded-full bg-success/60" />
                </div>
                <span className="text-[11px] text-text-muted ml-2">Training Output</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input
                    type="text"
                    value={logFilter}
                    onChange={(e) => setLogFilter(e.target.value)}
                    placeholder="Filter logs..."
                    className="bg-surface-2 border border-border rounded pl-7 pr-2 py-1 text-[11px] text-text-primary w-48 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <button className="p-1 text-text-muted hover:text-text-secondary">
                  <Download size={14} />
                </button>
              </div>
            </div>
            <div ref={logRef} className="p-4 font-mono text-[12px] leading-relaxed max-h-[600px] overflow-y-auto">
              {DEMO_LOGS.filter((l) => !logFilter || l.msg.toLowerCase().includes(logFilter.toLowerCase())).map((log, i) => (
                <div
                  key={i}
                  className={cn(
                    'py-0.5',
                    log.level === 'info' && 'text-text-primary',
                    log.level === 'warning' && 'text-warning',
                    log.level === 'error' && 'text-error',
                    log.level === 'debug' && 'text-secondary'
                  )}
                >
                  {log.msg}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'monitoring' && (
          <div className="grid grid-cols-[3fr_2fr] gap-4">
            {/* Chat View */}
            <div className="bg-surface-1 border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <Shield size={16} className="text-error" />
                <span className="text-[13px] font-mono font-semibold">Monitoring Agent</span>
              </div>
              <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
                {[
                  { step: 100, msg: 'Step 100: Loss decreasing steadily at 1.842. Training is healthy. ✓', type: 'success' },
                  { step: 400, msg: 'Step 400: Loss spike detected (0.78 → 1.12). Analyzing... This appears to be a normal fluctuation due to learning rate warmup completion. No action needed.', type: 'warning' },
                  { step: 500, msg: 'Step 500: Loss recovered to 0.645. Spike was transient. ✓', type: 'success' },
                  { step: 600, msg: 'Step 600: Epoch 1 complete. Validation loss: 0.712. Model is learning well. ✓', type: 'success' },
                  { step: 800, msg: 'GPU temperature stable at 72°C. Memory usage consistent at 14.2/24.0 GB. ✓', type: 'info' },
                  { step: 800, msg: 'Checkpoint saved at step 800. Training is on track. ✓', type: 'success' },
                ].map((entry, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={cn(
                      'p-3 rounded-lg text-[12px]',
                      entry.type === 'success' && 'bg-success/5 border border-success/20',
                      entry.type === 'warning' && 'bg-warning/5 border border-warning/20',
                      entry.type === 'info' && 'bg-surface-2 border border-border'
                    )}
                  >
                    <span className="font-mono text-text-muted text-[10px]">Step {entry.step}</span>
                    <p className="mt-1 text-text-primary">{entry.msg}</p>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Decision Log */}
            <div className="bg-surface-1 border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <span className="text-[13px] font-mono font-semibold">Decision Log</span>
              </div>
              <div className="divide-y divide-border">
                {MONITORING_ENTRIES.map((entry, i) => (
                  <div key={i} className="px-4 py-2.5 flex items-start gap-2">
                    {entry.result === 'success' ? (
                      <CheckCircle size={14} className="text-success mt-0.5 flex-shrink-0" />
                    ) : (
                      <AlertTriangle size={14} className="text-warning mt-0.5 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-text-muted">{entry.ts}</span>
                        <span className="text-[12px] font-medium">{entry.check}</span>
                      </div>
                      <p className="text-[11px] text-text-secondary mt-0.5">{entry.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'config' && (
          <div className="bg-surface-1 border border-border rounded-lg p-6 max-w-2xl">
            <h3 className="text-[15px] font-mono font-semibold mb-4">Training Configuration</h3>
            <div className="space-y-4">
              {[
                { section: 'Model', items: [['Base Model', 'Qwen/Qwen2.5-7B'], ['Parameters', '7.6B'], ['Architecture', 'Qwen2ForCausalLM']] },
                { section: 'Dataset', items: [['Dataset', 'sahil2801/CodeAlpaca-20k'], ['Train Samples', '18,000'], ['Eval Samples', '2,000']] },
                { section: 'LoRA', items: [['Rank (r)', '16'], ['Alpha', '32'], ['Dropout', '0.05'], ['Target Modules', 'q_proj, k_proj, v_proj, o_proj']] },
                { section: 'Training', items: [['Learning Rate', '2e-4'], ['Batch Size', '4'], ['Grad Accum Steps', '4'], ['Epochs', '3'], ['Max Seq Length', '2048'], ['LR Scheduler', 'cosine'], ['Optimizer', 'adamw_torch'], ['BF16', 'true'], ['Gradient Checkpointing', 'true']] },
                { section: 'Hardware', items: [['GPU', 'NVIDIA RTX 4090'], ['VRAM', '24 GB'], ['CUDA', '12.1']] },
              ].map((section) => (
                <div key={section.section}>
                  <h4 className="text-[12px] text-text-muted uppercase tracking-wider mb-2">{section.section}</h4>
                  <div className="bg-surface-2 rounded-lg divide-y divide-border">
                    {section.items.map(([k, v]) => (
                      <div key={k} className="flex justify-between px-4 py-2">
                        <span className="text-[13px] text-text-secondary">{k}</span>
                        <span className="text-[13px] font-mono text-text-primary">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
