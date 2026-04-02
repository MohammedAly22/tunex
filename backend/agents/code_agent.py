"""Code Agent: Uses the LLM to generate training scripts, writes real files to disk.

This agent does NOT use hardcoded templates. It sends the full configuration
context to the LLM and asks it to generate production-quality training code.
It writes all files to the experiment directory on disk.
"""

import os
import logging
from .base import BaseAgent, AgentState
from .schemas import CodeOutput

logger = logging.getLogger("tunex.agents")

SYSTEM_PROMPT = """You are the Code Agent for TuneX, an LLM fine-tuning platform.

You receive the complete configuration (model, dataset, hyperparameters, LoRA config, GPU info)
and must generate ALL files needed to run a fine-tuning experiment.

You MUST generate these files:

1. **environment.yml** — Conda environment file with:
   - Python version (3.11)
   - All pip dependencies (torch, transformers, peft, trl, datasets, accelerate, bitsandbytes, etc.)
   - Specific version pins for reproducibility

2. **train.py** — Complete training script that:
   - Loads the model with the correct quantization config (if QLoRA)
   - Loads and preprocesses the dataset with proper tokenization
   - Sets up LoRA/QLoRA adapter (if applicable)
   - Configures TrainingArguments with ALL the hyperparameters provided
   - Uses SFTTrainer from trl
   - Includes proper logging, checkpointing, and evaluation
   - Saves the model and tokenizer after training
   - Handles the specific dataset format (instruction, chat, completion)

3. **inference.py** — Inference script that:
   - Loads the base model and LoRA adapter (or full model)
   - Provides a generate() function
   - Has a CLI interface for testing

4. **run.sh** — Shell script that:
   - Creates the conda environment from environment.yml
   - Activates the environment
   - Runs train.py
   - Includes error handling

5. **config.json** — JSON file with all training configuration for reproducibility

IMPORTANT:
- Write COMPLETE, production-ready code — no placeholders, no TODOs, no "..."
- Handle edge cases (missing pad token, dataset format variations, etc.)
- Include proper data preprocessing with tokenization templates
- Use the EXACT hyperparameters provided in the configuration
- The code must be ready to run as-is after creating the conda environment
"""


class CodeAgent(BaseAgent):
    name = "code"
    system_prompt = SYSTEM_PROMPT

    async def run(self, state: AgentState) -> AgentState:
        await self.set_status("thinking")
        await self.emit("Preparing to generate experiment files with LLM...", msg_type="thought")

        # Create experiment directory
        from backend.config import settings as app_settings
        exp_dir = os.path.join(app_settings.output_dir, state.experiment_id)
        os.makedirs(exp_dir, exist_ok=True)
        state.experiment_dir = exp_dir

        await self.set_status("acting")
        await self.emit(f"Experiment directory: {exp_dir}")

        # Build the full context for the LLM
        config = state.training_config
        lora = state.lora_config
        method = config.get("method", "lora")

        llm_input = (
            f"Generate all files for this fine-tuning experiment:\n\n"
            f"## Model\n"
            f"- Model ID: {state.model_id}\n"
            f"- Parameters: {state.model_params_b}B\n"
            f"- Method: {method}\n\n"
            f"## Dataset\n"
            f"- Dataset ID: {state.dataset_id}\n"
            f"- Train samples: {state.dataset_train_size}\n"
            f"- Eval samples: {state.dataset_eval_size}\n"
            f"- Task type: {state.task_type}\n\n"
            f"## GPU\n"
            f"- GPU: {state.gpu_name}\n"
            f"- VRAM: {state.gpu_vram_gb} GB\n\n"
            f"## Hyperparameters\n"
            f"- Learning rate: {config.get('learning_rate', 2e-4)}\n"
            f"- Batch size: {config.get('batch_size', 4)}\n"
            f"- Gradient accumulation: {config.get('gradient_accumulation_steps', 4)}\n"
            f"- Epochs: {config.get('num_epochs', 3)}\n"
            f"- Max sequence length: {config.get('max_seq_length', 2048)}\n"
            f"- Warmup ratio: {config.get('warmup_ratio', 0.03)}\n"
            f"- Weight decay: {config.get('weight_decay', 0.01)}\n"
            f"- LR scheduler: {config.get('lr_scheduler', 'cosine')}\n"
            f"- Optimizer: {config.get('optimizer', 'adamw_torch')}\n"
            f"- BF16: {config.get('bf16', True)}\n"
            f"- Gradient checkpointing: {config.get('gradient_checkpointing', True)}\n"
            f"- Seed: {config.get('seed', 42)}\n\n"
            f"## Output\n"
            f"- Output directory: {exp_dir}\n"
            f"- Experiment ID: {state.experiment_id}\n"
            f"- Conda env name: tunex-{state.experiment_id}\n"
        )

        if method in ("lora", "qlora") and lora:
            llm_input += (
                f"\n## LoRA Configuration\n"
                f"- Rank (r): {lora.get('r', 16)}\n"
                f"- Alpha: {lora.get('lora_alpha', 32)}\n"
                f"- Dropout: {lora.get('lora_dropout', 0.05)}\n"
                f"- Target modules: {lora.get('target_modules', ['q_proj', 'k_proj', 'v_proj', 'o_proj'])}\n"
            )

        if method == "qlora":
            llm_input += (
                f"\n## Quantization (QLoRA)\n"
                f"- Bits: {config.get('quantization_bits', 4)}\n"
                f"- Quant type: {config.get('quantization_type', 'nf4')}\n"
                f"- Compute dtype: {config.get('compute_dtype', 'bfloat16')}\n"
            )

        await self.emit("Generating code with LLM — this may take a moment...")

        # Call LLM for structured code output
        code_output = await self.call_llm_structured(
            user_message=llm_input,
            output_schema=CodeOutput,
        )

        state.conda_env_name = code_output.conda_env_name or f"tunex-{state.experiment_id}"

        # Write all generated files to disk
        for gen_file in code_output.files:
            filepath = os.path.join(exp_dir, gen_file.filename)

            # Create subdirectories if needed
            os.makedirs(os.path.dirname(filepath) if os.path.dirname(filepath) != exp_dir else exp_dir, exist_ok=True)

            with open(filepath, "w", encoding="utf-8") as f:
                f.write(gen_file.content)

            # Make shell scripts executable
            if gen_file.filename.endswith(".sh"):
                try:
                    os.chmod(filepath, 0o755)
                except OSError:
                    pass

            await self.emit(f"Written: {gen_file.filename} — {gen_file.description}", severity="success")
            await self.emit_file(gen_file.filename, gen_file.content, gen_file.description)

            # Track files in state
            state.generated_files.append({
                "filename": gen_file.filename,
                "content": gen_file.content,
                "description": gen_file.description,
            })

            # Track training/inference scripts specifically
            if gen_file.filename == "train.py":
                state.training_script = gen_file.content
            elif gen_file.filename == "inference.py":
                state.inference_script = gen_file.content

        await self.emit(
            f"All files written to {exp_dir}. {len(code_output.files)} files generated.",
            severity="success",
        )

        await self.set_status("complete")
        return state
