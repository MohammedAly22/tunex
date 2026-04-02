# TuneX — Agentic Fine-Tuning Platform

**From prompt to checkpoint.** TuneX is a full-stack platform that uses AI agents to automate the entire LLM fine-tuning pipeline — from GPU detection and dataset selection to training script generation and model publishing.

## Features

- **8 Specialized AI Agents** — Planner, Intent Analyzer, Configuration, Dataset, Code, Infrastructure, Monitoring, Evaluation, Publishing
- **Multi-LLM Support** — OpenAI, Anthropic Claude, Cohere (command-a-03-2025), or local Ollama
- **LLMFit Integration** — Automatic GPU profiling and VRAM compatibility checking
- **Real-time Training Monitor** — Live loss curves, GPU stats, learning rate schedules
- **Agent Workspace** — Watch agents collaborate in real-time with a code viewer tab
- **Evaluation & Benchmarking** — Post-training benchmark comparison (HumanEval, MBPP, MMLU, etc.)
- **One-Click Publishing** — Export to SafeTensors/GGUF/PyTorch, publish to HuggingFace
- **Dark/Light Theme** — Full theme support with persistent preference

## Architecture

```
TuneX/
├── frontend/          # Next.js 16 + Tailwind CSS 4 + Framer Motion
│   ├── app/           # App Router pages
│   ├── components/    # Reusable UI components
│   ├── hooks/         # WebSocket & state hooks
│   └── lib/           # Types, constants, utilities
├── backend/           # FastAPI + WebSocket + SQLite
│   ├── agents/        # 8 AI agents with system prompts & Pydantic I/O
│   ├── api/           # REST + WebSocket endpoints
│   ├── core/          # GPU detection, LLMFit, database models
│   └── training/      # Training runner with metric streaming
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## Prerequisites

- **Python** 3.10+ (3.11 recommended)
- **Node.js** 18+ (20+ recommended)
- **NVIDIA GPU** with CUDA 11.8+ (for training; not required for UI)
- **Conda** (recommended) or venv

## Installation (Step-by-Step)

### Option A: Conda Environment (Recommended)

#### Step 1: Clone the repository

```bash
git clone https://github.com/your-username/tunex.git
cd tunex
```

#### Step 2: Create Conda environment

```bash
conda create -n tunex python=3.11 -y
conda activate tunex
```

#### Step 3: Install PyTorch with CUDA

```bash
# For CUDA 12.1 (check your CUDA version with: nvidia-smi)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

# For CUDA 11.8
# pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
```

#### Step 4: Install backend dependencies

```bash
pip install -r backend/requirements.txt
```

#### Step 5: (Optional) Install LLMFit

```bash
pip install llmfit
```

LLMFit (https://www.llmfit.org/) provides GPU compatibility checking. The app works without it (using built-in VRAM estimation) but LLMFit gives more accurate results.

#### Step 6: Install frontend dependencies

```bash
cd frontend
npm install
cd ..
```

#### Step 7: Configure environment

Create a `.env` file in the project root:

```bash
# Required: Choose ONE LLM provider for agents
# Option 1: Anthropic Claude (recommended)
TUNEX_LLM_PROVIDER=anthropic
TUNEX_ANTHROPIC_API_KEY=sk-ant-...

# Option 2: OpenAI
# TUNEX_LLM_PROVIDER=openai
# TUNEX_OPENAI_API_KEY=sk-...

# Option 3: Cohere
# TUNEX_LLM_PROVIDER=cohere
# TUNEX_COHERE_API_KEY=...
# TUNEX_LLM_MODEL=command-a-03-2025

# Option 4: Local Ollama (no API key needed)
# TUNEX_LLM_PROVIDER=ollama
# TUNEX_OLLAMA_ENDPOINT=http://localhost:11434

# Optional: HuggingFace (for model publishing)
TUNEX_HF_TOKEN=hf_...
```

#### Step 8: Start the backend

```bash
# From the project root
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

You should see:
```
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Starting TuneX backend...
INFO:     Database initialized.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

#### Step 9: Start the frontend (new terminal)

```bash
conda activate tunex
cd frontend
npm run dev
```

You should see:
```
▲ Next.js 16.x
- Local: http://localhost:3000
```

#### Step 10: Open in browser

Navigate to **http://localhost:3000**

You'll see the TuneX splash intro on first launch. Configure your LLM provider in **Settings** before starting experiments.

### Option B: Docker (Recommended for Production)

#### Step 1: Build and run

```bash
docker compose up --build
```

This starts both frontend and backend. Open **http://localhost:3000**.

#### Step 2: Configure via environment variables

```bash
# Create .env file first, then:
docker compose --env-file .env up --build
```

## Usage

### 1. Configure Settings (REQUIRED)

> **You must configure an LLM provider before using TuneX.** The agents use real LLM calls (via LangChain) with Pydantic structured output for every decision — intent analysis, hyperparameter optimization, dataset selection, code generation, and error analysis. Without a configured LLM, the pipeline will refuse to start.

Go to **Settings** and configure:
- **Agent Brain**: Select your LLM provider (OpenAI, Anthropic, Cohere, or Ollama) and enter your API key
- **HuggingFace Token**: (Optional) For gated model/dataset access and model publishing
- Click **Test Connection** to verify the LLM is reachable
- Click **Save Settings** — you should see "Settings saved — LLM is ready"

### 2. Create New Experiment

Go to **New Experiment** and choose:

- **Agent-Driven Mode**: Describe your goal in plain language (e.g., "Fine-tune Qwen 2.5 7B for Python code generation"). The Intent Analyzer will ask follow-up questions if your request is incomplete.
- **Custom Mode**: Manually select model, dataset, training method, and all hyperparameters.

### 3. Watch Agents Work

The Agent Workspace shows all agents collaborating in real-time via WebSocket:
- **Agent Grid**: 6 agents working sequentially — each produces Pydantic-validated output consumed by the next
- **Code & Files**: File explorer showing all generated files (train.py, inference.py, environment.yml, run.sh, config.json) written to disk by the Code Agent via LLM
- **Agent Comms**: Full chronological communication feed with timestamps

### 4. Monitor Training

After approving the configuration, watch training in real-time:
- Live loss curves and learning rate schedules
- GPU VRAM and temperature monitoring
- Terminal logs with search/filter
- Monitoring Agent alerts for anomalies

### 5. Evaluate Results

Post-training benchmarks show:
- Radar chart comparing base vs. fine-tuned model
- Detailed benchmark table with deltas
- Inference playground for testing

### 6. Export & Publish

- Download in SafeTensors, PyTorch, GGUF (with quantization options), or ONNX
- Publish to HuggingFace with auto-generated model card

## Supported LLM Providers

| Provider | Models | API Key Prefix |
|----------|--------|----------------|
| Anthropic | claude-sonnet-4-6, claude-opus-4-6, claude-haiku-4-5-20251001 | `sk-ant-` |
| OpenAI | gpt-4o, gpt-4-turbo, gpt-4o-mini | `sk-` |
| Cohere | command-a-03-2025, command-r-plus, command-r | — |
| Ollama | llama3.1:8b, qwen2.5:7b, mistral:7b (local) | — |

## Supported Training Models

| Model | Parameters | VRAM (LoRA) | VRAM (QLoRA) |
|-------|-----------|-------------|--------------|
| Qwen 2.5 7B | 7.6B | ~14 GB | ~8 GB |
| Llama 3.1 8B | 8.0B | ~16 GB | ~9 GB |
| Mistral 7B | 7.2B | ~14 GB | ~8 GB |
| Phi-3 Mini | 3.8B | ~8 GB | ~5 GB |
| Gemma 2 9B | 9.2B | ~18 GB | ~10 GB |
| CodeLlama 7B | 6.7B | ~13 GB | ~7 GB |
| Qwen 2.5 3B | 3.0B | ~6 GB | ~4 GB |

## Troubleshooting

### Backend won't start
- Ensure Python 3.10+ is activated: `python --version`
- Ensure all deps installed: `pip install -r backend/requirements.txt`
- Check port 8000 is free: `lsof -i :8000` or `netstat -ano | findstr 8000`

### Frontend won't start
- Ensure Node.js 18+: `node --version`
- Ensure deps installed: `cd frontend && npm install`
- Check port 3000 is free

### "LLM Backend Not Configured" warning
- Go to Settings and configure your API key
- Click "Test Connection" to verify
- If using Ollama, ensure it's running: `ollama serve`

### CUDA not detected
- Verify NVIDIA drivers: `nvidia-smi`
- Verify PyTorch CUDA: `python -c "import torch; print(torch.cuda.is_available())"`
- Reinstall PyTorch with correct CUDA version

### LLMFit not found
- Install: `pip install llmfit`
- The app works without it using built-in VRAM estimation

## Tech Stack

**Frontend**: Next.js 16, React 19, Tailwind CSS 4, Framer Motion, Recharts, Lucide Icons
**Backend**: FastAPI, SQLAlchemy (async), WebSockets, Pydantic v2
**Training**: PyTorch, HuggingFace Transformers, PEFT, TRL, BitsAndBytes
**Agents**: LangChain (structured output via `with_structured_output()`), Pydantic v2 I/O schemas, HuggingFace Hub API

## License

MIT
