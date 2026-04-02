import { AgentName } from './types';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
export const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

export const AGENT_CONFIG: Record<AgentName, { name: string; icon: string; color: string; bgColor: string; description: string }> = {
  planner: {
    name: 'Planner Agent',
    icon: '🧠',
    color: '#6366F1',
    bgColor: 'rgba(99, 102, 241, 0.15)',
    description: 'Orchestrates the pipeline, assigns tasks, manages sequencing',
  },
  dataset: {
    name: 'Dataset Agent',
    icon: '📊',
    color: '#22D3EE',
    bgColor: 'rgba(34, 211, 238, 0.15)',
    description: 'Finds, evaluates, downloads, and preprocesses datasets',
  },
  configuration: {
    name: 'Configuration Agent',
    icon: '⚙️',
    color: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.15)',
    description: 'GPU profiling, model compatibility, hyperparameter optimization',
  },
  code: {
    name: 'Code Agent',
    icon: '💻',
    color: '#10B981',
    bgColor: 'rgba(16, 185, 129, 0.15)',
    description: 'Writes training scripts, inference scripts, utilities',
  },
  infrastructure: {
    name: 'Infrastructure Agent',
    icon: '🔧',
    color: '#8B5CF6',
    bgColor: 'rgba(139, 92, 246, 0.15)',
    description: 'Environment setup, dependencies, downloads, verification',
  },
  monitoring: {
    name: 'Monitoring Agent',
    icon: '🛡️',
    color: '#EF4444',
    bgColor: 'rgba(239, 68, 68, 0.15)',
    description: 'Real-time oversight, anomaly detection, quality assurance',
  },
  evaluation: {
    name: 'Evaluation Agent',
    icon: '📈',
    color: '#EC4899',
    bgColor: 'rgba(236, 72, 153, 0.15)',
    description: 'Post-training benchmarking and analysis',
  },
  publishing: {
    name: 'Publishing Agent',
    icon: '🚀',
    color: '#14B8A6',
    bgColor: 'rgba(20, 184, 166, 0.15)',
    description: 'Model export, HuggingFace upload, README generation',
  },
};

export const NAV_ITEMS = [
  { label: 'Dashboard', href: '/', icon: 'LayoutDashboard' },
  { label: 'New Experiment', href: '/experiment/new', icon: 'Plus' },
  { label: 'Settings', href: '/settings', icon: 'Settings' },
] as const;

export const TRAINING_METHODS = [
  { value: 'full', label: 'Full Fine-Tuning', description: 'Train all model parameters' },
  { value: 'lora', label: 'LoRA', description: 'Low-Rank Adaptation — efficient parameter-efficient fine-tuning' },
  { value: 'qlora', label: 'QLoRA', description: 'Quantized LoRA — 4-bit quantized base with LoRA adapters' },
] as const;

export const POPULAR_MODELS = [
  { id: 'meta-llama/Llama-3.1-8B', name: 'Llama 3.1 8B', params: '8B', size: '16 GB' },
  { id: 'Qwen/Qwen2.5-7B', name: 'Qwen 2.5 7B', params: '7B', size: '14 GB' },
  { id: 'mistralai/Mistral-7B-v0.3', name: 'Mistral 7B', params: '7B', size: '14 GB' },
  { id: 'microsoft/phi-3-mini-4k-instruct', name: 'Phi-3 Mini', params: '3.8B', size: '7.6 GB' },
  { id: 'google/gemma-2-9b', name: 'Gemma 2 9B', params: '9B', size: '18 GB' },
  { id: 'meta-llama/CodeLlama-7b-hf', name: 'CodeLlama 7B', params: '7B', size: '14 GB' },
  { id: 'Qwen/Qwen2.5-3B', name: 'Qwen 2.5 3B', params: '3B', size: '6 GB' },
  { id: 'microsoft/phi-3-small-8k-instruct', name: 'Phi-3 Small', params: '7B', size: '14 GB' },
] as const;

export const TASK_CHIPS = [
  'Code Generation',
  'Chat/Conversation',
  'Summarization',
  'Translation',
  'Classification',
  'RAG/QA',
  'Math Reasoning',
  'Custom Task',
] as const;

export const LR_SCHEDULERS = ['cosine', 'linear', 'constant_with_warmup'] as const;
export const OPTIMIZERS = ['adamw_torch', 'adamw_8bit', 'paged_adamw_8bit'] as const;
export const BATCH_SIZES = [1, 2, 4, 8, 16] as const;
export const LORA_RANKS = [4, 8, 16, 32, 64, 128] as const;
