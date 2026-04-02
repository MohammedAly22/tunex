"""Configuration Agent: GPU profiling, model compatibility, LLM-optimized hyperparameters.

Detects the user's GPU, runs VRAM analysis, and asks the LLM to recommend
optimal hyperparameters for the specific model + task + hardware combination.
"""

from .base import BaseAgent, AgentState
from .schemas import ConfigurationOutput
from backend.core.gpu import detect_gpu
from backend.core.llmfit import check_compatibility, estimate_params_from_id

SYSTEM_PROMPT = """You are the Configuration Agent for TuneX, an LLM fine-tuning platform.

You receive information about the user's GPU, model, and task, and must recommend
the optimal training configuration.

Your responsibilities:
1. Analyze GPU capabilities and VRAM constraints
2. Determine the best training method (full fine-tune, LoRA, QLoRA)
3. Recommend optimal hyperparameters for the specific model + task + GPU combination

Decision rules for training method:
- Full fine-tuning: Only if model params * 8 bytes < 40% of available VRAM (rare for >3B models)
- LoRA: If model fits in memory with adapter overhead (~60-80% VRAM utilization)
- QLoRA: If model is too large for LoRA (4-bit quantization reduces memory by ~4x)

Hyperparameter guidelines by task:
- Code generation: lr=2e-4, seq_len=2048-4096, epochs=3, LoRA r=16-32
- Chat/conversation: lr=1e-4, seq_len=1024-2048, epochs=2-3, LoRA r=16
- Summarization: lr=5e-5, seq_len=2048-4096, epochs=3-5, LoRA r=8-16
- Math reasoning: lr=1e-4, seq_len=1024-2048, epochs=3-5, LoRA r=16-32
- Classification: lr=2e-5, seq_len=512-1024, epochs=5-10, LoRA r=8

General rules:
- Always use gradient checkpointing when VRAM utilization > 60%
- Use BF16 when GPU compute capability >= 8.0, FP16 otherwise
- Cosine LR scheduler is the default
- LoRA target_modules should include attention (q_proj, k_proj, v_proj, o_proj) and optionally MLP (gate_proj, up_proj, down_proj) for complex tasks
- Adjust batch_size to fit VRAM (start with 4, reduce if needed)
- Use gradient_accumulation to achieve effective batch size of 16-32
"""


class ConfigurationAgent(BaseAgent):
    name = "configuration"
    system_prompt = SYSTEM_PROMPT

    async def run(self, state: AgentState) -> AgentState:
        await self.set_status("thinking")
        await self.emit("Detecting GPU and analyzing hardware...", msg_type="thought")

        # Step 1: GPU Detection (real hardware check)
        gpu = detect_gpu()
        state.gpu_name = gpu.name
        state.gpu_vram_gb = gpu.vram_total_gb

        await self.set_status("acting")
        await self.emit(
            f"GPU: {gpu.name} — {gpu.vram_total_gb} GB VRAM, "
            f"Compute {gpu.compute_capability}, CUDA {gpu.cuda_version}",
            severity="success",
        )

        # Step 2: VRAM Compatibility check (built-in estimator)
        if state.model_id:
            await self.emit(f"Running VRAM analysis for {state.model_id}...")
            compat = check_compatibility(
                model_id=state.model_id,
                gpu_vram_gb=gpu.vram_total_gb,
            )

            params_b = estimate_params_from_id(state.model_id)
            state.model_params_b = params_b
            state.gpu_compatible = compat.compatible
            state.best_method = compat.best_method

            if compat.compatible:
                best_est = next(
                    (e for e in compat.estimates if e.method == compat.best_method),
                    None,
                )
                vram_str = f"~{best_est.total_gb} GB" if best_est else "estimated"
                await self.emit(
                    f"Compatible — {compat.best_method.upper()} uses {vram_str} / {gpu.vram_total_gb} GB",
                    severity="success",
                )
            else:
                await self.emit(
                    f"Model may not fit in {gpu.vram_total_gb} GB VRAM",
                    severity="error",
                )
                for s in compat.suggestions:
                    await self.emit(s, severity="warning")

        # Step 3: Ask LLM for optimal hyperparameters
        await self.emit("Optimizing hyperparameters with LLM...", msg_type="thought")

        hp_input = (
            f"Model: {state.model_id} ({state.model_params_b}B parameters)\n"
            f"GPU: {gpu.name} ({gpu.vram_total_gb} GB VRAM, compute {gpu.compute_capability})\n"
            f"Training method: {state.best_method}\n"
            f"Task type: {state.task_type}\n"
            f"User goal: {state.user_prompt}\n"
            f"VRAM compatible: {state.gpu_compatible}"
        )

        config_output = await self.call_llm_structured(
            user_message=hp_input,
            output_schema=ConfigurationOutput,
        )

        # Apply LLM-recommended config to state
        hp = config_output.hyperparameters
        state.training_config = {
            "model_id": state.model_id,
            "method": state.best_method,
            "learning_rate": hp.learning_rate,
            "batch_size": hp.batch_size,
            "gradient_accumulation_steps": hp.gradient_accumulation_steps,
            "num_epochs": hp.num_epochs,
            "max_seq_length": hp.max_seq_length,
            "warmup_ratio": hp.warmup_ratio,
            "weight_decay": hp.weight_decay,
            "lr_scheduler": hp.lr_scheduler,
            "optimizer": hp.optimizer,
            "bf16": float(gpu.compute_capability or "0") >= 8.0,
            "gradient_checkpointing": True,
            "max_grad_norm": 0.3,
            "logging_steps": 10,
            "save_steps": 200,
            "eval_steps": 200,
            "seed": 42,
        }

        if state.best_method in ("lora", "qlora") and config_output.lora_config:
            lora = config_output.lora_config
            state.lora_config = {
                "r": lora.r,
                "lora_alpha": lora.lora_alpha,
                "lora_dropout": lora.lora_dropout,
                "target_modules": lora.target_modules,
                "bias": "none",
                "task_type": "CAUSAL_LM",
            }
        elif state.best_method in ("lora", "qlora"):
            # Fallback LoRA config if LLM didn't provide one
            state.lora_config = {
                "r": 16, "lora_alpha": 32, "lora_dropout": 0.05,
                "target_modules": ["q_proj", "k_proj", "v_proj", "o_proj"],
                "bias": "none", "task_type": "CAUSAL_LM",
            }

        if state.best_method == "qlora":
            state.training_config["quantization_bits"] = 4
            state.training_config["quantization_type"] = "nf4"
            state.training_config["compute_dtype"] = "bfloat16"

        await self.emit(
            f"Config: lr={hp.learning_rate}, batch={hp.batch_size}, "
            f"epochs={hp.num_epochs}, seq_len={hp.max_seq_length}",
            severity="success",
        )

        if config_output.suggestions:
            for s in config_output.suggestions:
                await self.emit(f"Tip: {s}", severity="info")

        await self.set_status("complete")
        return state
