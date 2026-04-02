export type AgentName =
  | 'planner'
  | 'dataset'
  | 'configuration'
  | 'code'
  | 'infrastructure'
  | 'monitoring'
  | 'evaluation'
  | 'publishing';

export type AgentStatus = 'idle' | 'thinking' | 'acting' | 'complete' | 'error';

export type TrainingMethod = 'full' | 'lora' | 'qlora';

export type ExperimentStatus =
  | 'configuring'
  | 'preparing'
  | 'training'
  | 'evaluating'
  | 'completed'
  | 'failed'
  | 'paused';

export type LogLevel = 'info' | 'warning' | 'error' | 'debug';

export interface GPUInfo {
  name: string;
  vram_total_gb: number;
  vram_used_gb: number;
  utilization_pct: number;
  temperature_c: number;
  compute_capability: string;
  driver_version: string;
  cuda_version: string;
}

export interface Experiment {
  id: string;
  name: string;
  base_model: string;
  dataset: string;
  method: TrainingMethod;
  status: ExperimentStatus;
  created_at: string;
  updated_at: string;
  config: TrainingConfig;
  metrics?: TrainingMetrics;
}

export interface TrainingConfig {
  model_id: string;
  dataset_id: string;
  method: TrainingMethod;
  lora_r?: number;
  lora_alpha?: number;
  lora_dropout?: number;
  target_modules?: string[];
  quantization_bits?: 4 | 8;
  quantization_type?: 'nf4' | 'fp4';
  compute_dtype?: 'float16' | 'bfloat16';
  learning_rate: number;
  batch_size: number;
  gradient_accumulation_steps: number;
  num_epochs: number;
  max_seq_length: number;
  warmup_ratio: number;
  weight_decay: number;
  lr_scheduler: 'cosine' | 'linear' | 'constant_with_warmup';
  optimizer: 'adamw_torch' | 'adamw_8bit' | 'paged_adamw_8bit';
  fp16: boolean;
  bf16: boolean;
  gradient_checkpointing: boolean;
  max_grad_norm: number;
  logging_steps: number;
  save_steps: number;
  eval_steps: number;
  early_stopping_patience?: number;
  seed: number;
  output_dir: string;
  save_strategy: 'steps' | 'epoch';
  push_to_hub: boolean;
}

export interface TrainingMetrics {
  step: number;
  epoch: number;
  loss: number;
  lr: number;
  grad_norm: number;
  tokens_per_sec: number;
  total_steps: number;
}

export interface BenchmarkResult {
  benchmark: string;
  base_score: number;
  finetuned_score: number;
}

export interface AgentMessage {
  id: string;
  agent: AgentName;
  content: string;
  type: 'thought' | 'action' | 'result' | 'question' | 'error';
  severity: 'info' | 'warning' | 'error' | 'success';
  timestamp: string;
  options?: string[];
  questionId?: string;
}

export interface VRAMEstimate {
  method: TrainingMethod;
  model_weights_gb: number;
  optimizer_gb: number;
  gradients_gb: number;
  activations_gb: number;
  total_gb: number;
  fits: boolean;
}

export interface CompatibilityResult {
  compatible: boolean;
  best_method: TrainingMethod;
  estimates: VRAMEstimate[];
  suggestions: string[];
  alternative_models?: AlternativeModel[];
}

export interface AlternativeModel {
  model_id: string;
  params: string;
  vram_required_gb: number;
  reason: string;
}

export type WSEvent =
  | { type: 'agent_message'; agent: AgentName; content: string; severity: 'info' | 'warning' | 'error' | 'success'; messageType?: 'thought' | 'action' | 'result' | 'question' | 'error' }
  | { type: 'agent_status'; agent: AgentName; status: AgentStatus }
  | { type: 'agent_question'; agent: AgentName; question: string; options?: string[]; questionId: string }
  | { type: 'training_metrics'; step: number; epoch: number; loss: number; lr: number; grad_norm: number; tokens_per_sec: number; total_steps: number }
  | { type: 'training_log'; level: LogLevel; message: string; timestamp: string }
  | { type: 'gpu_stats'; vram_used_gb: number; vram_total_gb: number; utilization_pct: number; temperature_c: number }
  | { type: 'training_status'; status: ExperimentStatus; progress_pct: number; eta_seconds: number }
  | { type: 'benchmark_result'; benchmark: string; base_score: number; finetuned_score: number }
  | { type: 'download_progress'; filename: string; downloaded_bytes: number; total_bytes: number };

export interface Settings {
  llm_provider: 'openai' | 'anthropic' | 'cohere' | 'ollama';
  llm_model: string;
  api_key: string;
  ollama_endpoint: string;
  hf_token: string;
  hf_organization: string;
  output_dir: string;
  cache_dir: string;
  max_vram_pct: number;
  theme: 'dark' | 'light';
  font_size: number;
}
