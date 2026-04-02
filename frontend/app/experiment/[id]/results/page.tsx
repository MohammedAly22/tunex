'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import {
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Minus,
  Send,
  Loader2,
  BarChart3,
  Play,
  Columns,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';

const BENCHMARK_DATA = [
  { benchmark: 'HumanEval', base: 42.1, finetuned: 65.2, fullMark: 100 },
  { benchmark: 'MBPP', base: 38.7, finetuned: 56.3, fullMark: 100 },
  { benchmark: 'MMLU', base: 61.2, finetuned: 63.8, fullMark: 100 },
  { benchmark: 'ARC', base: 54.3, finetuned: 55.1, fullMark: 100 },
  { benchmark: 'HellaSwag', base: 72.1, finetuned: 72.8, fullMark: 100 },
];

const EXAMPLE_PROMPTS = [
  {
    prompt: 'Write a FastAPI endpoint that returns a list of users from a database.',
    base_response: 'from fastapi import FastAPI\n\napp = FastAPI()\n\n@app.get("/users")\ndef get_users():\n    return [{"name": "user1"}]',
    finetuned_response: `from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from . import models, schemas
from .database import get_db

app = FastAPI()

@app.get("/users", response_model=List[schemas.User])
async def get_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Retrieve a paginated list of users."""
    users = db.query(models.User).offset(skip).limit(limit).all()
    if not users:
        raise HTTPException(status_code=404, detail="No users found")
    return users`,
  },
  {
    prompt: 'Create a Python decorator that retries a function on failure.',
    base_response: 'def retry(func):\n    def wrapper(*args):\n        try:\n            return func(*args)\n        except:\n            return func(*args)\n    return wrapper',
    finetuned_response: `import functools
import time
from typing import Callable, Type

def retry(
    max_attempts: int = 3,
    delay: float = 1.0,
    backoff: float = 2.0,
    exceptions: tuple[Type[Exception], ...] = (Exception,)
) -> Callable:
    """Retry decorator with exponential backoff."""
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    if attempt < max_attempts - 1:
                        time.sleep(delay * (backoff ** attempt))
            raise last_exception
        return wrapper
    return decorator`,
  },
];

export default function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [inferencePrompt, setInferencePrompt] = useState('');
  const [inferenceResult, setInferenceResult] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [activeExample, setActiveExample] = useState(0);

  const avgImprovement =
    BENCHMARK_DATA.reduce((sum, b) => sum + (b.finetuned - b.base), 0) / BENCHMARK_DATA.length;
  const bestImprovement = BENCHMARK_DATA.reduce(
    (best, b) => {
      const delta = b.finetuned - b.base;
      return delta > best.delta ? { name: b.benchmark, delta } : best;
    },
    { name: '', delta: 0 }
  );

  const handleGenerate = async () => {
    if (!inferencePrompt.trim()) return;
    setIsGenerating(true);
    // Simulate streaming response
    const response = '# Generated response will appear here\n# Connect backend for real inference';
    for (let i = 0; i <= response.length; i++) {
      await new Promise((r) => setTimeout(r, 20));
      setInferenceResult(response.slice(0, i));
    }
    setIsGenerating(false);
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-[32px] font-mono font-bold mb-1">Evaluation Results</h1>
            <p className="text-[13px] text-text-secondary">
              Post-training benchmarks and model analysis
            </p>
          </div>
          <button
            onClick={() => router.push(`/experiment/${id}/export`)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white text-[13px] font-medium rounded-md transition-colors"
          >
            Export & Publish <ArrowRight size={14} />
          </button>
        </div>
      </motion.div>

      {/* Spider Chart */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-surface-1 border border-border rounded-lg p-6 mb-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-mono font-semibold flex items-center gap-2">
            <BarChart3 size={16} className="text-primary" />
            Benchmark Comparison
          </h2>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-text-muted" /> Base Model
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-primary" /> Fine-tuned
            </span>
          </div>
        </div>

        <div className="flex items-center justify-center">
          <ResponsiveContainer width="100%" height={400}>
            <RadarChart data={BENCHMARK_DATA}>
              <PolarGrid stroke="#2A2A3A" />
              <PolarAngleAxis
                dataKey="benchmark"
                tick={{ fill: '#8888A0', fontSize: 12 }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={{ fill: '#555566', fontSize: 10 }}
              />
              <Radar
                name="Base Model"
                dataKey="base"
                stroke="#555566"
                fill="#555566"
                fillOpacity={0.1}
                strokeDasharray="4 4"
              />
              <Radar
                name="Fine-tuned"
                dataKey="finetuned"
                stroke="#6366F1"
                fill="#6366F1"
                fillOpacity={0.15}
                strokeWidth={2}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1A1A25',
                  border: '1px solid #2A2A3A',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Benchmark Table + Summary */}
      <div className="grid grid-cols-[2fr_1fr] gap-6 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-surface-1 border border-border rounded-lg overflow-hidden"
        >
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_2fr] gap-4 px-4 py-2.5 border-b border-border text-[11px] text-text-muted uppercase tracking-wider">
            <span>Benchmark</span>
            <span>Base</span>
            <span>Fine-tuned</span>
            <span>Delta</span>
            <span>Notes</span>
          </div>
          {BENCHMARK_DATA.map((b, i) => {
            const delta = b.finetuned - b.base;
            return (
              <motion.div
                key={b.benchmark}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 + i * 0.05 }}
                className={cn(
                  'grid grid-cols-[2fr_1fr_1fr_1fr_2fr] gap-4 px-4 py-3 border-b border-border items-center',
                  delta > 5 && 'bg-success/5'
                )}
              >
                <span className="text-[13px] font-medium">{b.benchmark}</span>
                <span className="text-[13px] font-mono text-text-secondary">{b.base.toFixed(1)}</span>
                <span className="text-[13px] font-mono font-semibold">{b.finetuned.toFixed(1)}</span>
                <span
                  className={cn(
                    'text-[13px] font-mono flex items-center gap-1',
                    delta > 0 ? 'text-success' : delta < 0 ? 'text-error' : 'text-text-muted'
                  )}
                >
                  {delta > 0 ? <ArrowUp size={12} /> : delta < 0 ? <ArrowDown size={12} /> : <Minus size={12} />}
                  {delta > 0 ? '+' : ''}
                  {delta.toFixed(1)}%
                </span>
                <span className="text-[11px] text-text-muted">
                  {delta > 10 ? 'Significant improvement' : delta > 2 ? 'Moderate improvement' : 'Marginal change'}
                </span>
              </motion.div>
            );
          })}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          <div className="bg-surface-1 border border-border rounded-lg p-4">
            <div className="text-[11px] text-text-muted mb-1">Average Improvement</div>
            <div className="text-[24px] font-mono font-bold text-success">
              +{avgImprovement.toFixed(1)}%
            </div>
            <div className="text-[11px] text-text-muted">across {BENCHMARK_DATA.length} benchmarks</div>
          </div>
          <div className="bg-surface-1 border border-border rounded-lg p-4">
            <div className="text-[11px] text-text-muted mb-1">Best Improvement</div>
            <div className="text-[24px] font-mono font-bold text-primary">
              +{bestImprovement.delta.toFixed(1)}%
            </div>
            <div className="text-[11px] text-text-muted">{bestImprovement.name}</div>
          </div>
          <div className="bg-surface-1 border border-border rounded-lg p-4">
            <div className="text-[11px] text-text-muted mb-1">Regressions</div>
            <div className="text-[18px] font-mono font-bold text-success">None</div>
            <div className="text-[11px] text-text-muted">No benchmark decreased</div>
          </div>
        </motion.div>
      </div>

      {/* Inference Playground */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="bg-surface-1 border border-border rounded-lg p-6 mb-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-mono font-semibold flex items-center gap-2">
            <Play size={16} className="text-primary" />
            Inference Playground
          </h2>
          <button
            onClick={() => setCompareMode(!compareMode)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-md border text-[12px] transition-all',
              compareMode ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text-secondary hover:bg-surface-2'
            )}
          >
            <Columns size={14} />
            Compare Mode
          </button>
        </div>

        <div className="flex gap-3 mb-4">
          <input
            type="text"
            value={inferencePrompt}
            onChange={(e) => setInferencePrompt(e.target.value)}
            placeholder="Type a prompt to test the model..."
            className="flex-1 bg-[#0F0F18] border border-border rounded-md px-4 py-2.5 text-[13px] text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
          />
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !inferencePrompt.trim()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white text-[13px] font-medium rounded-md transition-colors disabled:opacity-40"
          >
            {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Generate
          </button>
        </div>

        {inferenceResult && (
          <div className="bg-black rounded-lg p-4 font-mono text-[12px] text-text-primary whitespace-pre-wrap">
            {inferenceResult}
          </div>
        )}

        {/* Example Outputs */}
        <div className="mt-6">
          <h3 className="text-[13px] font-medium text-text-secondary mb-3">Example Outputs</h3>
          <div className="flex gap-2 mb-4">
            {EXAMPLE_PROMPTS.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveExample(i)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-[12px] border transition-all',
                  activeExample === i ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text-secondary hover:bg-surface-2'
                )}
              >
                Example {i + 1}
              </button>
            ))}
          </div>

          <div className="bg-surface-2 rounded-lg p-4 mb-3">
            <div className="text-[11px] text-text-muted mb-2">Prompt:</div>
            <p className="text-[13px]">{EXAMPLE_PROMPTS[activeExample].prompt}</p>
          </div>

          <div className={cn('grid gap-4', compareMode ? 'grid-cols-2' : 'grid-cols-1')}>
            {compareMode && (
              <div>
                <div className="text-[11px] text-text-muted mb-2">Base Model Output:</div>
                <div className="bg-black rounded-lg p-4 font-mono text-[11px] text-text-secondary whitespace-pre-wrap">
                  {EXAMPLE_PROMPTS[activeExample].base_response}
                </div>
              </div>
            )}
            <div>
              <div className="text-[11px] text-text-muted mb-2">
                {compareMode ? 'Fine-tuned Output:' : 'Model Output:'}
              </div>
              <div className="bg-black rounded-lg p-4 font-mono text-[11px] text-text-primary whitespace-pre-wrap">
                {EXAMPLE_PROMPTS[activeExample].finetuned_response}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Model Analysis */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-3 gap-4"
      >
        <div className="bg-surface-1 border border-border rounded-lg p-4">
          <div className="text-[11px] text-text-muted mb-2">Model Size</div>
          <div className="space-y-2">
            <div className="flex justify-between text-[13px]">
              <span className="text-text-secondary">Base Model</span>
              <span className="font-mono">14.2 GB</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-text-secondary">LoRA Adapter</span>
              <span className="font-mono text-success">67.2 MB</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-text-secondary">Merged</span>
              <span className="font-mono">14.3 GB</span>
            </div>
          </div>
        </div>
        <div className="bg-surface-1 border border-border rounded-lg p-4">
          <div className="text-[11px] text-text-muted mb-2">Inference Speed</div>
          <div className="text-[24px] font-mono font-bold text-secondary">48.3</div>
          <div className="text-[11px] text-text-muted">tokens/sec on RTX 4090</div>
        </div>
        <div className="bg-surface-1 border border-border rounded-lg p-4">
          <div className="text-[11px] text-text-muted mb-2">Memory Footprint</div>
          <div className="space-y-2">
            <div className="flex justify-between text-[13px]">
              <span className="text-text-secondary">Inference (FP16)</span>
              <span className="font-mono">14.2 GB</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-text-secondary">Inference (4-bit)</span>
              <span className="font-mono text-success">4.8 GB</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
