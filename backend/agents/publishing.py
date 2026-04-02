"""Publishing Agent: Model card generation, export, HuggingFace upload.

Uses the LLM to generate comprehensive model cards and handles export in
multiple formats.
"""

import logging
from .base import BaseAgent, AgentState

logger = logging.getLogger("tunex.agents")

SYSTEM_PROMPT = """You are the Publishing Agent for TuneX, an LLM fine-tuning platform.

You generate comprehensive model cards following HuggingFace best practices and
prepare models for export/deployment.

Model card must include:
- YAML frontmatter (language, license, tags, base_model, datasets)
- Training methodology and all hyperparameters
- Hardware used and training duration
- Evaluation results with benchmark scores
- Usage examples with complete code snippets
- Limitations and bias considerations

Be detailed but honest about capabilities and limitations.
"""


class PublishingAgent(BaseAgent):
    name = "publishing"
    system_prompt = SYSTEM_PROMPT

    async def run(self, state: AgentState) -> AgentState:
        await self.set_status("thinking")
        await self.emit("Preparing model for export...", msg_type="thought")

        await self.set_status("acting")

        # Generate model card via LLM
        await self.emit("Generating model card with LLM...")

        card_prompt = (
            f"Generate a complete HuggingFace model card for:\n"
            f"- Base model: {state.model_id}\n"
            f"- Method: {state.best_method}\n"
            f"- Dataset: {state.dataset_id} ({state.dataset_train_size} samples)\n"
            f"- Task: {state.task_type}\n"
            f"- Config: {state.training_config}\n"
            f"- GPU: {state.gpu_name}\n\n"
            f"Include YAML frontmatter, training details, usage code, and limitations."
        )

        try:
            model_card = await self.call_llm(card_prompt)
            await self.emit("Model card generated.", severity="success")
        except Exception:
            model_card = self._fallback_model_card(state)
            await self.emit("Model card generated (template).", severity="success")

        # Write model card to experiment dir
        if state.experiment_dir:
            import os
            card_path = os.path.join(state.experiment_dir, "README.md")
            with open(card_path, "w", encoding="utf-8") as f:
                f.write(model_card)
            await self.emit_file("README.md", model_card, "HuggingFace model card")

        method = state.training_config.get("method", "lora")
        await self.emit("SafeTensors export ready.", severity="success")
        if method in ("lora", "qlora"):
            await self.emit("LoRA adapter saved — merge with base model available in export tab.", severity="success")
        await self.emit("GGUF quantization available: Q4_K_M, Q5_K_M, Q8_0", severity="info")

        await self.set_status("complete")
        return state

    def _fallback_model_card(self, state: AgentState) -> str:
        config = state.training_config
        method = config.get("method", "lora")
        model_short = state.model_id.split("/")[-1] if state.model_id else "model"

        return f"""---
language: en
license: apache-2.0
tags:
- {method}
- fine-tuned
- tunex
base_model: {state.model_id}
datasets:
- {state.dataset_id}
---

# {model_short} Fine-tuned with TuneX

Fine-tuned from [{state.model_id}](https://huggingface.co/{state.model_id}) using {method.upper()}.

## Training
- Dataset: {state.dataset_id} ({state.dataset_train_size:,} samples)
- Epochs: {config.get('num_epochs', 3)}
- LR: {config.get('learning_rate', 2e-4)}
- GPU: {state.gpu_name or 'N/A'}

## Usage
```python
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

base = AutoModelForCausalLM.from_pretrained("{state.model_id}")
model = PeftModel.from_pretrained(base, "<adapter_path>")
tokenizer = AutoTokenizer.from_pretrained("{state.model_id}")
```

Generated with [TuneX](https://github.com/tunex).
"""
