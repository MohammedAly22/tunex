'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Settings,
  Sparkles,
  Search,
  AlertTriangle,
  Upload,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Check,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import {
  POPULAR_MODELS,
  TASK_CHIPS,
  TRAINING_METHODS,
  LORA_RANKS,
  LR_SCHEDULERS,
  OPTIMIZERS,
  BATCH_SIZES,
} from '@/lib/constants';
import { TrainingMethod } from '@/lib/types';

function NewExperimentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get('mode') === 'custom' ? 'custom' : 'agent';

  const [mode, setMode] = useState<'agent' | 'custom'>(initialMode);
  const [agentPrompt, setAgentPrompt] = useState('');
  const [selectedChips, setSelectedChips] = useState<string[]>([]);
  const [settingsOk, setSettingsOk] = useState(true);

  useEffect(() => {
    // Check if LLM settings are configured
    async function checkSettings() {
      try {
        const res = await fetch('http://localhost:8000/api/settings/status');
        if (res.ok) {
          const data = await res.json();
          setSettingsOk(data.configured);
        }
      } catch {
        // Backend not running — show warning
        setSettingsOk(false);
      }
    }
    checkSettings();
  }, []);

  // Custom mode state
  const [selectedModel, setSelectedModel] = useState('');
  const [modelSearch, setModelSearch] = useState('');
  const [datasetSource, setDatasetSource] = useState<'huggingface' | 'upload' | 'agent'>('huggingface');
  const [datasetSearch, setDatasetSearch] = useState('');
  const [method, setMethod] = useState<TrainingMethod>('lora');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Hyperparameters
  const [loraR, setLoraR] = useState(16);
  const [loraAlpha, setLoraAlpha] = useState(32);
  const [loraDropout, setLoraDropout] = useState(0.05);
  const [quantBits, setQuantBits] = useState<4 | 8>(4);
  const [quantType, setQuantType] = useState<'nf4' | 'fp4'>('nf4');
  const [computeDtype, setComputeDtype] = useState<'float16' | 'bfloat16'>('bfloat16');
  const [lr, setLr] = useState('2e-4');
  const [batchSize, setBatchSize] = useState(4);
  const [gradAccum, setGradAccum] = useState(4);
  const [epochs, setEpochs] = useState(3);
  const [maxSeqLen, setMaxSeqLen] = useState(2048);
  const [warmupRatio, setWarmupRatio] = useState(0.03);
  const [weightDecay, setWeightDecay] = useState(0.01);
  const [lrScheduler, setLrScheduler] = useState('cosine');
  const [optimizer, setOptimizer] = useState('adamw_torch');
  const [bf16, setBf16] = useState(true);
  const [gradientCheckpointing, setGradientCheckpointing] = useState(true);
  const [maxGradNorm, setMaxGradNorm] = useState(0.3);
  const [experimentName, setExperimentName] = useState('');

  const toggleChip = (chip: string) => {
    setSelectedChips((prev) =>
      prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip]
    );
  };

  const launchAgents = () => {
    if (!settingsOk) {
      alert('Please configure your LLM provider in Settings before starting an experiment.');
      router.push('/settings');
      return;
    }
    if (!agentPrompt.trim()) return;
    const id = `exp-${Date.now()}`;
    // Save prompt to sessionStorage so the agent page can read it
    sessionStorage.setItem(`experiment_prompt_${id}`, agentPrompt.trim());
    if (selectedChips.length > 0) {
      sessionStorage.setItem(`experiment_chips_${id}`, JSON.stringify(selectedChips));
    }
    router.push(`/experiment/${id}/agents`);
  };

  const startExperiment = () => {
    if (!settingsOk) {
      alert('Please configure your LLM provider in Settings before starting an experiment.');
      router.push('/settings');
      return;
    }
    const id = `exp-${Date.now()}`;
    // Build prompt from custom mode selections
    const parts = [];
    if (selectedModel) parts.push(`Fine-tune ${selectedModel}`);
    if (datasetSearch) parts.push(`using dataset ${datasetSearch}`);
    if (experimentName) parts.push(`for ${experimentName}`);
    const customPrompt = parts.join(' ') || `Custom experiment with ${selectedModel || 'selected model'}`;
    sessionStorage.setItem(`experiment_prompt_${id}`, customPrompt);
    router.push(`/experiment/${id}/agents`);
  };

  return (
    <div className="p-8 max-w-[1100px] mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-[32px] font-mono font-bold mb-1">New Experiment</h1>
        <p className="text-[13px] text-text-secondary mb-8">
          Set up a new fine-tuning experiment
        </p>
      </motion.div>

      {/* Settings Warning */}
      {!settingsOk && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-warning/10 border border-warning/30 rounded-lg flex items-center gap-3"
        >
          <AlertTriangle size={18} className="text-warning flex-shrink-0" />
          <div className="flex-1">
            <p className="text-[13px] font-medium text-warning">LLM Backend Not Configured</p>
            <p className="text-[12px] text-text-secondary mt-0.5">
              Configure your LLM provider (API key) in Settings before starting an experiment. Agents need an LLM to reason.
            </p>
          </div>
          <Link
            href="/settings"
            className="px-4 py-1.5 bg-warning/20 hover:bg-warning/30 border border-warning/30 rounded-md text-[12px] text-warning transition-colors flex-shrink-0"
          >
            Go to Settings
          </Link>
        </motion.div>
      )}

      {/* Mode Selection */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {[
          {
            id: 'agent' as const,
            icon: Bot,
            title: 'Agent-Driven Mode',
            desc: "Tell the agents what you want in plain language. They'll determine the optimal model, dataset, and configuration for your GPU.",
          },
          {
            id: 'custom' as const,
            icon: Settings,
            title: 'Custom Mode',
            desc: 'Manually specify every detail: model, dataset, training method, hyperparameters.',
          },
        ].map((opt) => (
          <motion.button
            key={opt.id}
            onClick={() => setMode(opt.id)}
            className={cn(
              'p-5 rounded-lg border text-left transition-all duration-200',
              mode === opt.id
                ? 'border-primary bg-primary/5 ring-1 ring-primary/30 animate-pulse-glow'
                : 'border-border hover:bg-surface-2'
            )}
            whileTap={{ scale: 0.99 }}
          >
            <div className="flex items-center gap-3 mb-2">
              <div
                className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center',
                  mode === opt.id ? 'bg-primary/20' : 'bg-surface-2'
                )}
              >
                <opt.icon size={20} className={mode === opt.id ? 'text-primary' : 'text-text-muted'} />
              </div>
              <h3 className="text-[15px] font-semibold">{opt.title}</h3>
            </div>
            <p className="text-[13px] text-text-secondary">{opt.desc}</p>
          </motion.button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Agent-Driven Mode */}
        {mode === 'agent' && (
          <motion.div
            key="agent"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-6"
          >
            <div className="bg-surface-1 border border-border rounded-lg p-6">
              <textarea
                value={agentPrompt}
                onChange={(e) => setAgentPrompt(e.target.value)}
                placeholder="Describe your fine-tuning goal... e.g., 'Fine-tune Qwen 2.5 7B on code generation for Python. I want it to be good at writing FastAPI endpoints.'"
                rows={5}
                className="w-full bg-[#0F0F18] border border-border rounded-lg px-4 py-3 text-[15px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />

              {/* Task Chips */}
              <div className="flex flex-wrap gap-2 mt-4">
                {TASK_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => toggleChip(chip)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-[12px] border transition-all duration-150',
                      selectedChips.includes(chip)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-text-secondary hover:bg-surface-2'
                    )}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={launchAgents}
              disabled={!agentPrompt.trim()}
              className="inline-flex items-center gap-2 px-8 py-3 bg-primary hover:bg-primary-hover text-white text-[15px] font-medium rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Sparkles size={16} />
              Launch Agents
              <ArrowRight size={16} />
            </button>
          </motion.div>
        )}

        {/* Custom Mode */}
        {mode === 'custom' && (
          <motion.div
            key="custom"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-6"
          >
            {/* Section A: Model Selection */}
            <div className="bg-surface-1 border border-border rounded-lg p-6">
              <h3 className="text-[15px] font-mono font-semibold mb-4">Model Selection</h3>

              <div className="relative mb-4">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  value={modelSearch}
                  onChange={(e) => setModelSearch(e.target.value)}
                  placeholder="Search HuggingFace models..."
                  className="w-full bg-[#0F0F18] border border-border rounded-md pl-10 pr-3 py-2 text-[13px] text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-4 gap-2">
                {POPULAR_MODELS.filter(
                  (m) =>
                    !modelSearch ||
                    m.name.toLowerCase().includes(modelSearch.toLowerCase()) ||
                    m.id.toLowerCase().includes(modelSearch.toLowerCase())
                ).map((model) => (
                  <button
                    key={model.id}
                    onClick={() => setSelectedModel(model.id)}
                    className={cn(
                      'p-3 rounded-lg border text-left transition-all duration-150',
                      selectedModel === model.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-surface-2'
                    )}
                  >
                    <div className="text-[13px] font-medium truncate">{model.name}</div>
                    <div className="text-[11px] text-text-muted mt-1">
                      {model.params} params · {model.size}
                    </div>
                    {selectedModel === model.id && (
                      <Check size={14} className="text-primary mt-1" />
                    )}
                  </button>
                ))}
              </div>

              {selectedModel && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-4 p-3 bg-surface-2 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="status" status="success">
                      Compatible — fits in VRAM with LoRA
                    </Badge>
                  </div>
                  <div className="text-[11px] text-text-muted mt-2 font-mono">{selectedModel}</div>
                </motion.div>
              )}
            </div>

            {/* Section B: Dataset */}
            <div className="bg-surface-1 border border-border rounded-lg p-6">
              <h3 className="text-[15px] font-mono font-semibold mb-4">Dataset</h3>

              <div className="flex gap-2 mb-4">
                {(
                  [
                    { id: 'huggingface', label: 'HuggingFace Dataset' },
                    { id: 'upload', label: 'Upload Custom' },
                    { id: 'agent', label: 'Agent Finds Best' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setDatasetSource(opt.id)}
                    className={cn(
                      'px-4 py-2 rounded-md border text-[13px] transition-all',
                      datasetSource === opt.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-text-secondary hover:bg-surface-2'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {datasetSource === 'huggingface' && (
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                  />
                  <input
                    type="text"
                    value={datasetSearch}
                    onChange={(e) => setDatasetSearch(e.target.value)}
                    placeholder="Search HuggingFace datasets..."
                    className="w-full bg-[#0F0F18] border border-border rounded-md pl-10 pr-3 py-2 text-[13px] text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              )}

              {datasetSource === 'upload' && (
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/30 transition-colors">
                  <Upload size={32} className="mx-auto text-text-muted mb-3" />
                  <p className="text-[13px] text-text-secondary mb-1">
                    Drag and drop your dataset file here
                  </p>
                  <p className="text-[11px] text-text-muted">
                    Supports .jsonl, .csv, .parquet, .json
                  </p>
                </div>
              )}

              {datasetSource === 'agent' && (
                <div className="p-4 bg-surface-2 rounded-lg flex items-center gap-3">
                  <Info size={16} className="text-primary" />
                  <p className="text-[13px] text-text-secondary">
                    The Dataset Agent will find and recommend the best dataset for your task.
                  </p>
                </div>
              )}
            </div>

            {/* Section C: Training Configuration */}
            <div className="bg-surface-1 border border-border rounded-lg p-6">
              <h3 className="text-[15px] font-mono font-semibold mb-4">Training Configuration</h3>

              {/* Method Selection */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                {TRAINING_METHODS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setMethod(m.value as TrainingMethod)}
                    className={cn(
                      'p-3 rounded-lg border text-left transition-all',
                      method === m.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-surface-2'
                    )}
                  >
                    <div className="text-[13px] font-medium">{m.label}</div>
                    <div className="text-[11px] text-text-muted mt-1">{m.description}</div>
                  </button>
                ))}
              </div>

              {/* LoRA Config */}
              <AnimatePresence>
                {(method === 'lora' || method === 'qlora') && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-6 p-4 bg-surface-2 rounded-lg space-y-4"
                  >
                    <h4 className="text-[13px] font-mono font-medium text-text-secondary">
                      LoRA Parameters
                    </h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="text-[11px] text-text-muted block mb-1">
                          Rank (r): {loraR}
                        </label>
                        <div className="flex gap-1">
                          {LORA_RANKS.map((r) => (
                            <button
                              key={r}
                              onClick={() => setLoraR(r)}
                              className={cn(
                                'flex-1 py-1 text-[11px] rounded border transition-all',
                                loraR === r
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : 'border-border text-text-muted hover:bg-surface-3'
                              )}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] text-text-muted block mb-1">Alpha</label>
                        <input
                          type="number"
                          value={loraAlpha}
                          onChange={(e) => setLoraAlpha(Number(e.target.value))}
                          className="w-full bg-[#0F0F18] border border-border rounded-md px-3 py-1.5 text-[13px] text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-text-muted block mb-1">
                          Dropout: {loraDropout}
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={0.3}
                          step={0.01}
                          value={loraDropout}
                          onChange={(e) => setLoraDropout(Number(e.target.value))}
                          className="w-full accent-primary"
                        />
                      </div>
                    </div>

                    {method === 'qlora' && (
                      <div className="grid grid-cols-3 gap-4 pt-2 border-t border-border">
                        <div>
                          <label className="text-[11px] text-text-muted block mb-1">Quantization</label>
                          <div className="flex gap-1">
                            {([4, 8] as const).map((b) => (
                              <button
                                key={b}
                                onClick={() => setQuantBits(b)}
                                className={cn(
                                  'flex-1 py-1 text-[11px] rounded border transition-all',
                                  quantBits === b
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-border text-text-muted'
                                )}
                              >
                                {b}-bit
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-[11px] text-text-muted block mb-1">Type</label>
                          <div className="flex gap-1">
                            {(['nf4', 'fp4'] as const).map((t) => (
                              <button
                                key={t}
                                onClick={() => setQuantType(t)}
                                className={cn(
                                  'flex-1 py-1 text-[11px] rounded border transition-all',
                                  quantType === t
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-border text-text-muted'
                                )}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-[11px] text-text-muted block mb-1">Compute dtype</label>
                          <div className="flex gap-1">
                            {(['float16', 'bfloat16'] as const).map((d) => (
                              <button
                                key={d}
                                onClick={() => setComputeDtype(d)}
                                className={cn(
                                  'flex-1 py-1 text-[11px] rounded border transition-all',
                                  computeDtype === d
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-border text-text-muted'
                                )}
                              >
                                {d}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Hyperparameters */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="text-[11px] text-text-muted block mb-1">Learning Rate</label>
                  <input
                    type="text"
                    value={lr}
                    onChange={(e) => setLr(e.target.value)}
                    className="w-full bg-[#0F0F18] border border-border rounded-md px-3 py-1.5 text-[13px] font-mono text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-text-muted block mb-1">Batch Size</label>
                  <select
                    value={batchSize}
                    onChange={(e) => setBatchSize(Number(e.target.value))}
                    className="w-full bg-[#0F0F18] border border-border rounded-md px-3 py-1.5 text-[13px] text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {BATCH_SIZES.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-text-muted block mb-1">
                    Grad. Accumulation Steps
                  </label>
                  <input
                    type="number"
                    value={gradAccum}
                    onChange={(e) => setGradAccum(Number(e.target.value))}
                    className="w-full bg-[#0F0F18] border border-border rounded-md px-3 py-1.5 text-[13px] text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="text-[11px] text-text-muted block mb-1">Epochs</label>
                  <input
                    type="number"
                    value={epochs}
                    onChange={(e) => setEpochs(Number(e.target.value))}
                    className="w-full bg-[#0F0F18] border border-border rounded-md px-3 py-1.5 text-[13px] text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-text-muted block mb-1">Max Sequence Length</label>
                  <input
                    type="number"
                    value={maxSeqLen}
                    onChange={(e) => setMaxSeqLen(Number(e.target.value))}
                    className="w-full bg-[#0F0F18] border border-border rounded-md px-3 py-1.5 text-[13px] text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-text-muted block mb-1">
                    Warmup Ratio: {warmupRatio}
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={0.2}
                    step={0.01}
                    value={warmupRatio}
                    onChange={(e) => setWarmupRatio(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="text-[11px] text-text-muted block mb-1">LR Scheduler</label>
                  <select
                    value={lrScheduler}
                    onChange={(e) => setLrScheduler(e.target.value)}
                    className="w-full bg-[#0F0F18] border border-border rounded-md px-3 py-1.5 text-[13px] text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {LR_SCHEDULERS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-text-muted block mb-1">Optimizer</label>
                  <select
                    value={optimizer}
                    onChange={(e) => setOptimizer(e.target.value)}
                    className="w-full bg-[#0F0F18] border border-border rounded-md px-3 py-1.5 text-[13px] text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {OPTIMIZERS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end gap-4">
                  <label className="flex items-center gap-2 text-[13px] text-text-secondary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bf16}
                      onChange={(e) => setBf16(e.target.checked)}
                      className="accent-primary"
                    />
                    BF16
                  </label>
                  <label className="flex items-center gap-2 text-[13px] text-text-secondary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={gradientCheckpointing}
                      onChange={(e) => setGradientCheckpointing(e.target.checked)}
                      className="accent-primary"
                    />
                    Grad. Checkpoint
                  </label>
                </div>
              </div>

              {/* Advanced */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-[13px] text-text-secondary hover:text-text-primary transition-colors mt-2"
              >
                {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                Advanced Settings
              </button>

              <AnimatePresence>
                {showAdvanced && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border"
                  >
                    <div>
                      <label className="text-[11px] text-text-muted block mb-1">Weight Decay</label>
                      <input
                        type="number"
                        step={0.01}
                        value={weightDecay}
                        onChange={(e) => setWeightDecay(Number(e.target.value))}
                        className="w-full bg-[#0F0F18] border border-border rounded-md px-3 py-1.5 text-[13px] text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-text-muted block mb-1">Max Grad Norm</label>
                      <input
                        type="number"
                        step={0.1}
                        value={maxGradNorm}
                        onChange={(e) => setMaxGradNorm(Number(e.target.value))}
                        className="w-full bg-[#0F0F18] border border-border rounded-md px-3 py-1.5 text-[13px] text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-text-muted block mb-1">Seed</label>
                      <input
                        type="number"
                        defaultValue={42}
                        className="w-full bg-[#0F0F18] border border-border rounded-md px-3 py-1.5 text-[13px] text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Section D: Output */}
            <div className="bg-surface-1 border border-border rounded-lg p-6">
              <h3 className="text-[15px] font-mono font-semibold mb-4">Output Configuration</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] text-text-muted block mb-1">Experiment Name</label>
                  <input
                    type="text"
                    value={experimentName}
                    onChange={(e) => setExperimentName(e.target.value)}
                    placeholder="my-finetuned-model"
                    className="w-full bg-[#0F0F18] border border-border rounded-md px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-text-muted block mb-1">Save Strategy</label>
                  <div className="flex gap-2">
                    {(['steps', 'epoch'] as const).map((s) => (
                      <button
                        key={s}
                        className="flex-1 px-3 py-2 rounded-md border border-border text-[13px] text-text-secondary hover:bg-surface-2 transition-all capitalize"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={startExperiment}
              className="inline-flex items-center gap-2 px-8 py-3 bg-primary hover:bg-primary-hover text-white text-[15px] font-medium rounded-md transition-colors"
            >
              Start Experiment
              <ArrowRight size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function NewExperimentPage() {
  return (
    <Suspense fallback={<div className="p-8"><div className="animate-shimmer h-8 w-48 rounded-md" /></div>}>
      <NewExperimentContent />
    </Suspense>
  );
}
