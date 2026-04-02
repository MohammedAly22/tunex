'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Cpu, Database, Code, Shield, BarChart3, Rocket, ChevronRight, X } from 'lucide-react';

const STEPS = [
  {
    icon: Bot,
    title: 'Describe Your Goal',
    description: 'Tell the agents what you want in plain language. They analyze your intent and ask follow-up questions if anything is unclear.',
    color: '#6366F1',
  },
  {
    icon: Cpu,
    title: 'GPU Detection & Configuration',
    description: 'LLMFit detects your GPU, checks VRAM capacity, and determines the best training method (Full, LoRA, or QLoRA) for your hardware.',
    color: '#22D3EE',
  },
  {
    icon: Database,
    title: 'Smart Dataset Selection',
    description: 'The Dataset Agent searches HuggingFace, evaluates quality scores, and preprocesses data into the optimal format for your task.',
    color: '#F59E0B',
  },
  {
    icon: Code,
    title: 'Code Generation',
    description: 'A complete training script is auto-generated with your exact configuration — LoRA adapters, quantization, optimizers, and all.',
    color: '#10B981',
  },
  {
    icon: Shield,
    title: 'Pre-flight Checks',
    description: 'The Monitoring Agent validates everything: dataset format, script syntax, VRAM fit, dependencies — before a single GPU cycle is used.',
    color: '#EF4444',
  },
  {
    icon: BarChart3,
    title: 'Live Training & Evaluation',
    description: 'Watch loss curves, learning rate, and GPU stats in real-time. Post-training benchmarks compare base vs. fine-tuned performance.',
    color: '#EC4899',
  },
  {
    icon: Rocket,
    title: 'Export & Publish',
    description: 'Download in SafeTensors, GGUF, or PyTorch format. One-click publish to HuggingFace with an auto-generated model card.',
    color: '#14B8A6',
  },
];

export default function SplashIntro({ onDismiss }: { onDismiss: () => void }) {
  const [currentStep, setCurrentStep] = useState(0);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-bg/95 backdrop-blur-md flex items-center justify-center"
    >
      <button
        onClick={onDismiss}
        className="absolute top-6 right-6 p-2 text-text-muted hover:text-text-primary transition-colors"
      >
        <X size={20} />
      </button>

      <div className="max-w-4xl w-full px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <h1 className="text-[42px] font-mono font-bold gradient-text mb-2">Welcome to TuneX</h1>
          <p className="text-[16px] text-text-secondary">
            Your AI agents handle the entire fine-tuning pipeline. Here&apos;s how it works:
          </p>
        </motion.div>

        {/* Step Cards */}
        <div className="grid grid-cols-7 gap-2 mb-8">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const isActive = i === currentStep;
            return (
              <motion.button
                key={i}
                onClick={() => setCurrentStep(i)}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className={`flex flex-col items-center p-3 rounded-lg border transition-all duration-200 ${
                  isActive
                    ? 'border-primary bg-primary/10 scale-105'
                    : 'border-border hover:bg-surface-2 hover:border-border'
                }`}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-2"
                  style={{ backgroundColor: `${step.color}20` }}
                >
                  <Icon size={20} style={{ color: step.color }} />
                </div>
                <span className="text-[10px] text-text-secondary text-center leading-tight">
                  Step {i + 1}
                </span>
              </motion.button>
            );
          })}
        </div>

        {/* Active Step Detail */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="bg-surface-1 border border-border rounded-xl p-8 text-center"
          >
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: `${STEPS[currentStep].color}15` }}
            >
              {(() => {
                const Icon = STEPS[currentStep].icon;
                return <Icon size={32} style={{ color: STEPS[currentStep].color }} />;
              })()}
            </div>
            <h3 className="text-[20px] font-mono font-bold mb-2">{STEPS[currentStep].title}</h3>
            <p className="text-[15px] text-text-secondary max-w-lg mx-auto leading-relaxed">
              {STEPS[currentStep].description}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => setCurrentStep((p) => Math.max(0, p - 1))}
            disabled={currentStep === 0}
            className="px-4 py-2 text-[13px] text-text-secondary hover:text-text-primary transition-colors disabled:opacity-30"
          >
            Previous
          </button>

          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-all duration-200 ${
                  i === currentStep ? 'bg-primary w-6' : 'bg-surface-3'
                }`}
              />
            ))}
          </div>

          {currentStep < STEPS.length - 1 ? (
            <button
              onClick={() => setCurrentStep((p) => p + 1)}
              className="inline-flex items-center gap-1 px-4 py-2 text-[13px] text-primary hover:text-primary-hover transition-colors"
            >
              Next <ChevronRight size={14} />
            </button>
          ) : (
            <button
              onClick={onDismiss}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary-hover text-white text-[13px] font-medium rounded-md transition-colors"
            >
              Get Started <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
