'use client';

import { useState, use } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download,
  Upload,
  CheckCircle,
  Loader2,
  FileText,
  Lock,
  Globe,
  Tag,
  Send,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatMessage {
  role: 'agent' | 'user';
  content: string;
  input?: { type: string; placeholder?: string; value?: string };
  options?: { label: string; value: string }[];
}

const EXPORT_FORMATS = [
  { id: 'safetensors', label: 'SafeTensors', ext: '.safetensors', desc: 'Recommended — fast and secure' },
  { id: 'pytorch', label: 'PyTorch', ext: '.bin', desc: 'Standard PyTorch format' },
  { id: 'gguf', label: 'GGUF', ext: '.gguf', desc: 'For llama.cpp / Ollama' },
  { id: 'onnx', label: 'ONNX', ext: '.onnx', desc: 'Cross-framework compatibility' },
];

const GGUF_QUANTS = ['Q4_0', 'Q4_K_M', 'Q5_0', 'Q5_K_M', 'Q8_0', 'F16'];

export default function ExportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [exportFormat, setExportFormat] = useState('safetensors');
  const [mergeAdapter, setMergeAdapter] = useState(false);
  const [ggufQuant, setGgufQuant] = useState('Q4_K_M');
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Publishing chat state
  const [publishActive, setPublishActive] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatStep, setChatStep] = useState(0);
  const [hfToken, setHfToken] = useState('');
  const [modelName, setModelName] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [tags, setTags] = useState('code-generation, qwen2.5, lora');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [published, setPublished] = useState(false);
  const [chatInput, setChatInput] = useState('');

  const handleDownload = async () => {
    setDownloading(true);
    // Simulate download
    for (let i = 0; i <= 100; i += 2) {
      await new Promise((r) => setTimeout(r, 50));
      setDownloadProgress(i);
    }
    setDownloading(false);
  };

  const startPublishing = () => {
    setPublishActive(true);
    setChatMessages([
      {
        role: 'agent',
        content: "Let's publish your fine-tuned model to HuggingFace! First, I'll need your HuggingFace token with write access.",
        input: { type: 'password', placeholder: 'hf_...' },
      },
    ]);
    setChatStep(1);
  };

  const advancePublishing = (value: string) => {
    const newMessages = [...chatMessages];

    switch (chatStep) {
      case 1:
        setHfToken(value);
        newMessages.push({ role: 'user', content: '••••••••••••' });
        newMessages.push({
          role: 'agent',
          content: 'Token validated. You have write access to your namespace. What should the model be named on HuggingFace?',
          input: { type: 'text', placeholder: 'username/qwen2.5-7b-code-python-lora' },
        });
        setChatStep(2);
        break;
      case 2:
        setModelName(value);
        newMessages.push({ role: 'user', content: value });
        newMessages.push({
          role: 'agent',
          content: 'Should this be a public or private repository?',
          options: [
            { label: 'Public', value: 'public' },
            { label: 'Private', value: 'private' },
          ],
        });
        setChatStep(3);
        break;
      case 3:
        setIsPublic(value === 'public');
        newMessages.push({ role: 'user', content: value === 'public' ? 'Public' : 'Private' });
        newMessages.push({
          role: 'agent',
          content: 'Any additional tags for the model card?',
          input: { type: 'text', placeholder: 'code-generation, qwen2.5, lora', value: tags },
        });
        setChatStep(4);
        break;
      case 4:
        setTags(value);
        newMessages.push({ role: 'user', content: value });
        newMessages.push({
          role: 'agent',
          content: "I've generated a comprehensive README / Model Card. Uploading now...",
        });
        setChatStep(5);
        // Start upload simulation
        simulateUpload(newMessages);
        break;
    }

    setChatMessages(newMessages);
    setChatInput('');
  };

  const simulateUpload = async (msgs: ChatMessage[]) => {
    setUploading(true);
    for (let i = 0; i <= 100; i += 1) {
      await new Promise((r) => setTimeout(r, 40));
      setUploadProgress(i);
    }
    setUploading(false);
    setPublished(true);
    setChatMessages([
      ...msgs,
      {
        role: 'agent',
        content: `Model published successfully! View at: https://huggingface.co/${modelName || 'user/model'}`,
      },
    ]);
  };

  const estimatedSize = exportFormat === 'gguf' && ggufQuant.startsWith('Q4') ? '4.2 GB'
    : exportFormat === 'gguf' && ggufQuant.startsWith('Q5') ? '5.1 GB'
    : exportFormat === 'gguf' && ggufQuant === 'Q8_0' ? '7.6 GB'
    : mergeAdapter ? '14.3 GB' : '67.2 MB';

  return (
    <div className="p-8 max-w-[1100px] mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-[32px] font-mono font-bold mb-1">Export & Publish</h1>
        <p className="text-[13px] text-text-secondary mb-8">
          Download or publish your fine-tuned model
        </p>
      </motion.div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Download Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-surface-1 border border-border rounded-lg p-6"
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Download size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-[18px] font-mono font-semibold">Download Locally</h2>
              <p className="text-[13px] text-text-secondary">Save to your machine</p>
            </div>
          </div>

          {/* Format Selection */}
          <div className="space-y-2 mb-4">
            <label className="text-[11px] text-text-muted uppercase tracking-wider">Format</label>
            <div className="grid grid-cols-2 gap-2">
              {EXPORT_FORMATS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setExportFormat(f.id)}
                  className={cn(
                    'p-3 rounded-lg border text-left transition-all',
                    exportFormat === f.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-surface-2'
                  )}
                >
                  <div className="text-[13px] font-medium">{f.label}</div>
                  <div className="text-[11px] text-text-muted">{f.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* GGUF Options */}
          <AnimatePresence>
            {exportFormat === 'gguf' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4"
              >
                <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-2">
                  Quantization Level
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {GGUF_QUANTS.map((q) => (
                    <button
                      key={q}
                      onClick={() => setGgufQuant(q)}
                      className={cn(
                        'px-3 py-1 rounded-md border text-[12px] transition-all',
                        ggufQuant === q ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text-secondary hover:bg-surface-2'
                      )}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Merge Adapter Option */}
          {exportFormat !== 'gguf' && (
            <div className="mb-4">
              <label className="flex items-center gap-2 text-[13px] text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={mergeAdapter}
                  onChange={(e) => setMergeAdapter(e.target.checked)}
                  className="accent-primary"
                />
                Merge adapter into base model (full model download)
              </label>
            </div>
          )}

          <div className="flex items-center justify-between p-3 bg-surface-2 rounded-lg mb-4">
            <span className="text-[13px] text-text-secondary">Estimated size:</span>
            <span className="text-[13px] font-mono font-medium">{estimatedSize}</span>
          </div>

          {downloading ? (
            <div>
              <div className="flex justify-between text-[11px] text-text-muted mb-1">
                <span>Downloading...</span>
                <span>{downloadProgress}%</span>
              </div>
              <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <button
              onClick={handleDownload}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-hover text-white text-[13px] font-medium rounded-md transition-colors"
            >
              <Download size={14} />
              Download Model
            </button>
          )}
        </motion.div>

        {/* Publish Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-surface-1 border border-border rounded-lg p-6"
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
              <Upload size={20} className="text-success" />
            </div>
            <div>
              <h2 className="text-[18px] font-mono font-semibold">Publish to HuggingFace</h2>
              <p className="text-[13px] text-text-secondary">Share with the community</p>
            </div>
          </div>

          {!publishActive ? (
            <button
              onClick={startPublishing}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-success/10 hover:bg-success/20 border border-success/30 text-success text-[13px] font-medium rounded-md transition-colors"
            >
              <Upload size={14} />
              Start Publishing Flow
            </button>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {chatMessages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    'p-3 rounded-lg text-[13px]',
                    msg.role === 'agent' ? 'bg-surface-2' : 'bg-primary/10 ml-8'
                  )}
                >
                  {msg.role === 'agent' && (
                    <div className="text-[11px] text-success font-medium mb-1">Publishing Agent</div>
                  )}
                  <p className="text-text-primary">{msg.content}</p>

                  {/* Published link */}
                  {published && msg.content.includes('huggingface.co') && (
                    <div className="mt-2 flex items-center gap-2">
                      <CheckCircle size={14} className="text-success" />
                      <a
                        href="#"
                        className="text-primary text-[13px] flex items-center gap-1 hover:underline"
                      >
                        View on HuggingFace <ExternalLink size={12} />
                      </a>
                    </div>
                  )}

                  {/* Input field */}
                  {msg.input && i === chatMessages.length - 1 && !published && (
                    <div className="mt-3 flex gap-2">
                      <input
                        type={msg.input.type}
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder={msg.input.placeholder}
                        className="flex-1 bg-[#0F0F18] border border-border rounded-md px-3 py-1.5 text-[13px] text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        onKeyDown={(e) => e.key === 'Enter' && chatInput && advancePublishing(chatInput)}
                      />
                      <button
                        onClick={() => chatInput && advancePublishing(chatInput)}
                        className="px-3 py-1.5 bg-primary hover:bg-primary-hover rounded-md transition-colors"
                      >
                        <Send size={12} className="text-white" />
                      </button>
                    </div>
                  )}

                  {/* Option buttons */}
                  {msg.options && i === chatMessages.length - 1 && !published && (
                    <div className="mt-3 flex gap-2">
                      {msg.options.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => advancePublishing(opt.value)}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-md border border-primary/30 text-primary text-[12px] hover:bg-primary/10 transition-colors"
                        >
                          {opt.value === 'public' ? <Globe size={12} /> : <Lock size={12} />}
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}

              {/* Upload progress */}
              {uploading && (
                <div className="p-3 bg-surface-2 rounded-lg">
                  <div className="flex justify-between text-[11px] text-text-muted mb-1">
                    <span className="flex items-center gap-1">
                      <Loader2 size={12} className="animate-spin" />
                      Uploading model weights...
                    </span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-success to-secondary rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>

      {/* README Preview (shown when publishing) */}
      {publishActive && chatStep >= 4 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface-1 border border-border rounded-lg p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <FileText size={16} className="text-primary" />
            <h3 className="text-[15px] font-mono font-semibold">Generated Model Card</h3>
          </div>
          <div className="bg-black rounded-lg p-6 font-mono text-[12px] text-text-primary leading-relaxed overflow-auto max-h-[400px]">
            <div className="text-[18px] font-bold mb-2 gradient-text">
              {modelName || 'user/qwen2.5-7b-code-python-lora'}
            </div>
            <div className="text-text-muted mb-4">
              Fine-tuned Qwen 2.5 7B model for Python code generation, specialized in FastAPI endpoints.
            </div>
            <div className="text-warning mb-2">## Model Details</div>
            <div className="text-text-secondary mb-4">
              - **Base Model:** Qwen/Qwen2.5-7B{'\n'}
              - **Method:** LoRA (r=16, alpha=32){'\n'}
              - **Dataset:** sahil2801/CodeAlpaca-20k{'\n'}
              - **Training Hardware:** NVIDIA RTX 4090 (24 GB){'\n'}
              - **Epochs:** 3{'\n'}
              - **Final Loss:** 0.089
            </div>
            <div className="text-warning mb-2">## Benchmark Results</div>
            <div className="text-text-secondary mb-4">
              | Benchmark | Base | Fine-tuned | Delta |{'\n'}
              |-----------|------|------------|-------|{'\n'}
              | HumanEval | 42.1 | 65.2 | +23.1 |{'\n'}
              | MBPP | 38.7 | 56.3 | +17.6 |{'\n'}
              | MMLU | 61.2 | 63.8 | +2.6 |
            </div>
            <div className="text-warning mb-2">## Usage</div>
            <div className="text-success">
              {`from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

base_model = AutoModelForCausalLM.from_pretrained("Qwen/Qwen2.5-7B")
model = PeftModel.from_pretrained(base_model, "${modelName || 'user/model'}")
tokenizer = AutoTokenizer.from_pretrained("${modelName || 'user/model'}")`}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
