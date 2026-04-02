'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Brain,
  Key,
  Folder,
  Palette,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Loader2,
  Save,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Settings } from '@/lib/types';
import { API_BASE_URL } from '@/lib/constants';
import { useTheme } from '@/components/layout/ThemeProvider';

const LLM_PROVIDERS = [
  {
    id: 'openai' as const,
    name: 'OpenAI',
    models: ['gpt-4o', 'gpt-4-turbo', 'gpt-4o-mini', 'gpt-3.5-turbo'],
    description: 'GPT models via OpenAI API',
  },
  {
    id: 'anthropic' as const,
    name: 'Anthropic Claude',
    models: ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5-20251001'],
    description: 'Claude models via Anthropic API',
  },
  {
    id: 'cohere' as const,
    name: 'Cohere',
    models: ['command-a-03-2025', 'command-r-plus', 'command-r', 'command-light'],
    description: 'Command models via Cohere API',
  },
  {
    id: 'ollama' as const,
    name: 'Local (Ollama)',
    models: ['llama3.1:8b', 'qwen2.5:7b', 'mistral:7b', 'codellama:7b'],
    description: 'Self-hosted models via Ollama',
  },
];

export default function SettingsPage() {
  const { theme: currentTheme, setTheme: applyTheme } = useTheme();
  const [settings, setSettings] = useState<Settings>({
    llm_provider: 'anthropic',
    llm_model: 'claude-sonnet-4-6',
    api_key: '',
    ollama_endpoint: 'http://localhost:11434',
    hf_token: '',
    hf_organization: '',
    output_dir: './outputs',
    cache_dir: './cache',
    max_vram_pct: 90,
    theme: 'dark',
    font_size: 14,
  });

  const [showApiKey, setShowApiKey] = useState(false);
  const [showHfToken, setShowHfToken] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<'success' | 'error' | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ ok: boolean; configured: boolean } | null>(null);

  const selectedProvider = LLM_PROVIDERS.find((p) => p.id === settings.llm_provider)!;

  const testConnection = async () => {
    setTestingConnection(true);
    setConnectionResult(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/settings/test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: settings.llm_provider,
          model: settings.llm_model,
          api_key: settings.api_key,
          endpoint: settings.ollama_endpoint,
        }),
      });
      setConnectionResult(res.ok ? 'success' : 'error');
    } catch {
      setConnectionResult('error');
    }
    setTestingConnection(false);
  };

  const saveSettings = async () => {
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        const data = await res.json();
        setSaveResult({ ok: true, configured: data.llm_configured });
      } else {
        setSaveResult({ ok: false, configured: false });
      }
    } catch {
      setSaveResult({ ok: false, configured: false });
    }
    setSaving(false);
  };

  return (
    <div className="p-8 max-w-[900px] mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-[32px] font-mono font-bold mb-1">Settings</h1>
        <p className="text-[13px] text-text-secondary mb-8">Configure TuneX platform settings</p>
      </motion.div>

      {/* Section 1: Agent LLM Configuration */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-surface-1 border border-border rounded-lg p-6 mb-6"
      >
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Brain size={16} className="text-primary" />
          </div>
          <div>
            <h2 className="text-[18px] font-mono font-semibold">Agent Brain</h2>
            <p className="text-[13px] text-text-secondary">Select which LLM powers TuneX agents</p>
          </div>
        </div>

        {/* Provider Selection */}
        <div className="grid grid-cols-4 gap-3 mt-5 mb-5">
          {LLM_PROVIDERS.map((provider) => (
            <button
              key={provider.id}
              onClick={() =>
                setSettings((s) => ({
                  ...s,
                  llm_provider: provider.id,
                  llm_model: provider.models[0],
                }))
              }
              className={cn(
                'p-4 rounded-lg border text-left transition-all duration-150',
                settings.llm_provider === provider.id
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                  : 'border-border hover:border-border hover:bg-surface-2'
              )}
            >
              <div className="text-[15px] font-medium mb-1">{provider.name}</div>
              <div className="text-[11px] text-text-muted">{provider.description}</div>
            </button>
          ))}
        </div>

        {/* Model Dropdown */}
        <div className="mb-4">
          <label className="text-[13px] text-text-secondary block mb-1.5">Model</label>
          <select
            value={settings.llm_model}
            onChange={(e) => setSettings((s) => ({ ...s, llm_model: e.target.value }))}
            className="w-full bg-[#0F0F18] border border-border rounded-md px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {selectedProvider.models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* API Key / Endpoint */}
        {settings.llm_provider !== 'ollama' ? (
          <div className="mb-4">
            <label className="text-[13px] text-text-secondary block mb-1.5">API Key</label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={settings.api_key}
                onChange={(e) => setSettings((s) => ({ ...s, api_key: e.target.value }))}
                placeholder="sk-..."
                className="w-full bg-[#0F0F18] border border-border rounded-md px-3 py-2 pr-10 text-[13px] text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
              >
                {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-4">
            <label className="text-[13px] text-text-secondary block mb-1.5">Ollama Endpoint</label>
            <input
              type="text"
              value={settings.ollama_endpoint}
              onChange={(e) => setSettings((s) => ({ ...s, ollama_endpoint: e.target.value }))}
              className="w-full bg-[#0F0F18] border border-border rounded-md px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        )}

        {/* Test Connection */}
        <div className="flex items-center gap-3">
          <button
            onClick={testConnection}
            disabled={testingConnection}
            className="inline-flex items-center gap-2 px-4 py-2 bg-surface-2 hover:bg-surface-3 border border-border rounded-md text-[13px] text-text-primary transition-colors disabled:opacity-50"
          >
            {testingConnection ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            Test Connection
          </button>
          {connectionResult === 'success' && (
            <span className="flex items-center gap-1 text-success text-[13px]">
              <CheckCircle size={14} /> Connected
            </span>
          )}
          {connectionResult === 'error' && (
            <span className="flex items-center gap-1 text-error text-[13px]">
              <XCircle size={14} /> Connection failed
            </span>
          )}
        </div>
      </motion.section>

      {/* Section 2: HuggingFace Integration */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-surface-1 border border-border rounded-lg p-6 mb-6"
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center">
            <Key size={16} className="text-warning" />
          </div>
          <div>
            <h2 className="text-[18px] font-mono font-semibold">HuggingFace Integration</h2>
            <p className="text-[13px] text-text-secondary">Dataset access and model publishing</p>
          </div>
        </div>

        <div className="mb-4">
          <label className="text-[13px] text-text-secondary block mb-1.5">HuggingFace API Token</label>
          <div className="relative">
            <input
              type={showHfToken ? 'text' : 'password'}
              value={settings.hf_token}
              onChange={(e) => setSettings((s) => ({ ...s, hf_token: e.target.value }))}
              placeholder="hf_..."
              className="w-full bg-[#0F0F18] border border-border rounded-md px-3 py-2 pr-10 text-[13px] text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              onClick={() => setShowHfToken(!showHfToken)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
            >
              {showHfToken ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div>
          <label className="text-[13px] text-text-secondary block mb-1.5">
            Default Organization / Namespace
          </label>
          <input
            type="text"
            value={settings.hf_organization}
            onChange={(e) => setSettings((s) => ({ ...s, hf_organization: e.target.value }))}
            placeholder="your-username"
            className="w-full bg-[#0F0F18] border border-border rounded-md px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </motion.section>

      {/* Section 3: Training Defaults */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-surface-1 border border-border rounded-lg p-6 mb-6"
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
            <Folder size={16} className="text-success" />
          </div>
          <div>
            <h2 className="text-[18px] font-mono font-semibold">Training Defaults</h2>
            <p className="text-[13px] text-text-secondary">Default paths and configurations</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-[13px] text-text-secondary block mb-1.5">Output Directory</label>
            <input
              type="text"
              value={settings.output_dir}
              onChange={(e) => setSettings((s) => ({ ...s, output_dir: e.target.value }))}
              className="w-full bg-[#0F0F18] border border-border rounded-md px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-[13px] text-text-secondary block mb-1.5">Cache Directory</label>
            <input
              type="text"
              value={settings.cache_dir}
              onChange={(e) => setSettings((s) => ({ ...s, cache_dir: e.target.value }))}
              className="w-full bg-[#0F0F18] border border-border rounded-md px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div>
          <label className="text-[13px] text-text-secondary block mb-1.5">
            Max VRAM Allocation: {settings.max_vram_pct}%
          </label>
          <input
            type="range"
            min={50}
            max={100}
            value={settings.max_vram_pct}
            onChange={(e) => setSettings((s) => ({ ...s, max_vram_pct: Number(e.target.value) }))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-[11px] text-text-muted mt-1">
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>
      </motion.section>

      {/* Section 4: Appearance */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="bg-surface-1 border border-border rounded-lg p-6 mb-8"
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center">
            <Palette size={16} className="text-secondary" />
          </div>
          <div>
            <h2 className="text-[18px] font-mono font-semibold">Appearance</h2>
            <p className="text-[13px] text-text-secondary">Theme and display settings</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[13px] text-text-secondary block mb-1.5">Theme</label>
            <div className="flex gap-2">
              {(['dark', 'light'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => { applyTheme(t); setSettings((s) => ({ ...s, theme: t })); }}
                  className={cn(
                    'flex-1 px-4 py-2 rounded-md border text-[13px] capitalize transition-all',
                    currentTheme === t
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-text-secondary hover:bg-surface-2'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[13px] text-text-secondary block mb-1.5">
              Font Size: {settings.font_size}px
            </label>
            <input
              type="range"
              min={11}
              max={18}
              value={settings.font_size}
              onChange={(e) => setSettings((s) => ({ ...s, font_size: Number(e.target.value) }))}
              className="w-full accent-primary"
            />
          </div>
        </div>
      </motion.section>

      {/* Save Button */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex justify-end"
      >
        <button
          onClick={saveSettings}
          disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary-hover text-white text-[13px] font-medium rounded-md transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save Settings
        </button>
        {saveResult?.ok && (
          <span className={cn(
            'flex items-center gap-1 text-[13px] ml-4',
            saveResult.configured ? 'text-success' : 'text-warning'
          )}>
            {saveResult.configured ? (
              <><CheckCircle size={14} /> Settings saved — LLM is ready</>
            ) : (
              <><XCircle size={14} /> Saved, but LLM connection not verified</>
            )}
          </span>
        )}
        {saveResult && !saveResult.ok && (
          <span className="flex items-center gap-1 text-[13px] text-error ml-4">
            <XCircle size={14} /> Failed to save — is the backend running?
          </span>
        )}
      </motion.div>
    </div>
  );
}
