"""Monitoring Agent: Pre-flight validation, error analysis, training oversight.

Validates the entire pipeline output before training starts. Also analyzes
errors during conda creation or training, and sends context back to the
code agent for fixes.
"""

import logging
from .base import BaseAgent, AgentState
from .schemas import MonitoringOutput, ErrorAnalysis

logger = logging.getLogger("tunex.agents")

SYSTEM_PROMPT = """You are the Monitoring Agent for TuneX, an LLM fine-tuning platform.

Your responsibilities:
1. Run comprehensive pre-flight checks before training begins
2. Validate the generated code, configuration, and environment setup
3. Analyze errors from conda environment creation or training execution
4. Provide actionable remediation steps

Pre-flight checks to perform:
- Dataset: Is the ID valid? Are train/eval splits available? Enough samples?
- Training script: Does it exist? Is it syntactically valid? Does it match the config?
- Configuration: Is learning rate in a reasonable range? Does batch size fit VRAM?
- VRAM: Is there enough headroom (10-15% buffer)?
- Dependencies: Are all required packages available?
- LoRA: Are target modules valid for the model architecture?

When analyzing errors, determine:
- What type of error (dependency, CUDA, OOM, config, code, network)?
- What is the root cause?
- How to fix it?
- Should we retry after the fix?
"""


class MonitoringAgent(BaseAgent):
    name = "monitoring"
    system_prompt = SYSTEM_PROMPT

    async def run(self, state: AgentState) -> AgentState:
        """Run pre-flight validation checks."""
        await self.set_status("thinking")
        await self.emit("Running pre-flight validation...", msg_type="thought")

        # Build context for LLM analysis
        context = (
            f"Validate this fine-tuning setup:\n\n"
            f"Model: {state.model_id} ({state.model_params_b}B params)\n"
            f"Method: {state.best_method}\n"
            f"GPU: {state.gpu_name} ({state.gpu_vram_gb} GB VRAM)\n"
            f"GPU compatible: {state.gpu_compatible}\n"
            f"Dataset: {state.dataset_id} ({state.dataset_train_size} train / {state.dataset_eval_size} eval)\n"
            f"Training config: {state.training_config}\n"
            f"LoRA config: {state.lora_config}\n"
            f"Dependencies verified: {state.dependencies_verified}\n"
            f"Issues so far: {state.issues}\n"
            f"Training script exists: {bool(state.training_script)}\n"
            f"Training script lines: {len(state.training_script.splitlines()) if state.training_script else 0}\n"
            f"Generated files: {[f['filename'] for f in state.generated_files]}\n"
        )

        await self.set_status("acting")

        # Call LLM for structured pre-flight analysis
        output = await self.call_llm_structured(
            user_message=context,
            output_schema=MonitoringOutput,
        )

        # Report check results
        for check in output.checks:
            severity = {
                "pass": "success",
                "warn": "warning",
                "fail": "error",
            }.get(check.status, "info")
            await self.emit(f"[{check.status.upper()}] {check.name}: {check.detail}", severity=severity)

        if output.warnings:
            for w in output.warnings:
                await self.emit(f"Warning: {w}", severity="warning")

        if output.remediation_steps:
            for step in output.remediation_steps:
                await self.emit(f"Fix: {step}", severity="info")

        # Update state
        state.preflight_passed = output.preflight_passed
        state.ready_to_train = output.ready_to_train

        if output.ready_to_train:
            await self.emit(
                f"All pre-flight checks passed ({len(output.checks)} checks). Ready to train.",
                severity="success",
            )
        else:
            await self.emit(
                "Pre-flight found critical issues. Review before proceeding.",
                severity="warning",
            )

        await self.set_status("complete")
        return state

    async def analyze_error(self, state: AgentState, error_output: str, phase: str) -> ErrorAnalysis:
        """Analyze an error from conda creation or training execution.

        Returns an ErrorAnalysis with fix suggestions. The pipeline can use
        this to send context back to the code agent for a fix.
        """
        await self.set_status("acting")
        await self.emit(f"Analyzing {phase} error...", severity="warning")

        context = (
            f"An error occurred during {phase}.\n\n"
            f"Error output:\n```\n{error_output[:2000]}\n```\n\n"
            f"Setup context:\n"
            f"- Model: {state.model_id}\n"
            f"- Method: {state.best_method}\n"
            f"- GPU: {state.gpu_name} ({state.gpu_vram_gb} GB)\n"
            f"- Conda env: {state.conda_env_name}\n"
            f"- Experiment dir: {state.experiment_dir}\n"
        )

        analysis = await self.call_llm_structured(
            user_message=context,
            output_schema=ErrorAnalysis,
        )

        await self.emit(
            f"Error type: {analysis.error_type} — {analysis.root_cause}",
            severity="error",
        )
        await self.emit(f"Suggested fix: {analysis.fix_suggestion}", severity="info")

        if analysis.retry:
            await self.emit("Will attempt automatic fix and retry.", severity="info")

        await self.set_status("complete")
        return analysis
