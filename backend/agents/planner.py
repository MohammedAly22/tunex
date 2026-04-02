"""Planner Agent: Builds the execution plan and validates model/dataset/task coherence.

Takes the analyzed intent and creates a detailed execution plan, resolving
the model ID and validating that model + dataset + task make sense together.
"""

from .base import BaseAgent, AgentState
from .schemas import PlannerOutput

SYSTEM_PROMPT = """You are the Planner Agent for TuneX, an agentic LLM fine-tuning platform.

You receive the analyzed user intent (task type, model, dataset preferences) and create a
detailed execution plan. You also validate that the combination makes sense.

Your responsibilities:
1. Resolve the model to a valid HuggingFace model ID
2. Decide if the dataset agent should search for a dataset or use the user's specified one
3. Create an ordered execution plan with agent assignments
4. Identify risk factors and compatibility issues

Available agents and their capabilities:
- configuration: GPU detection, VRAM analysis, hyperparameter optimization
- dataset: HuggingFace search, dataset evaluation, preprocessing
- code: Training script generation, environment setup, file writing
- infrastructure: Dependency checking, model access verification, LLMFit
- monitoring: Pre-flight validation, error analysis

Model ID resolution — use the full HuggingFace path:
- "Qwen 2.5 7B" or "Qwen/Qwen2.5-7B" → model_id: "Qwen/Qwen2.5-7B"
- "Llama 3.1 8B" → model_id: "meta-llama/Llama-3.1-8B"
- "Mistral 7B" → model_id: "mistralai/Mistral-7B-v0.3"
- "Phi 3 mini" → model_id: "microsoft/Phi-3-mini-4k-instruct"
- "Gemma 2 9B" → model_id: "google/gemma-2-9b"
- "CodeLlama 7B" → model_id: "codellama/CodeLlama-7b-hf"

Validation checks to perform:
- Is the model suitable for the task? (e.g., a chat model for code gen may not be ideal)
- Is the model size reasonable for typical GPUs? (>70B needs multiple GPUs)
- Does the dataset format match the task type?

Set dataset_strategy to "user_specified" if the user gave a dataset, or "agent_search" if the agent should find one.
"""


class PlannerAgent(BaseAgent):
    name = "planner"
    system_prompt = SYSTEM_PROMPT

    async def run(self, state: AgentState) -> AgentState:
        await self.set_status("thinking")
        await self.emit("Building execution plan and validating configuration...", msg_type="thought")

        user_input = (
            f"User goal: {state.user_prompt}\n"
            f"Task type: {state.task_type}\n"
            f"Model preference: {state.model_id or 'not specified'}\n"
            f"Dataset preference: {state.dataset_id or 'not specified — agent should search'}\n"
            f"GPU: {state.gpu_name or 'unknown'} ({state.gpu_vram_gb or 'unknown'} GB)"
        )

        output = await self.call_llm_structured(
            user_message=user_input,
            output_schema=PlannerOutput,
        )

        await self.set_status("acting")

        # Update state with resolved model ID
        if output.model_id and not state.model_id:
            state.model_id = output.model_id
        elif output.model_id and state.model_id:
            # Prefer the planner's resolved ID (full HF path)
            if "/" in output.model_id:
                state.model_id = output.model_id

        await self.emit(f"Model resolved: {state.model_id}", severity="success")

        # Report the plan
        for step in output.steps:
            await self.emit(
                f"Step {step.step_number}: [{step.agent}] {step.action}",
                severity="info",
            )

        if output.risk_factors:
            for risk in output.risk_factors:
                await self.emit(f"⚠ Risk: {risk}", severity="warning")

        if output.validation_notes:
            for note in output.validation_notes:
                await self.emit(f"Validation: {note}", severity="info")

        await self.emit(
            f"Plan ready — estimated {output.estimated_duration_minutes} minutes",
            severity="success",
            msg_type="result",
        )

        state.messages.append({
            "agent": self.name,
            "content": f"Plan: {len(output.steps)} steps, ~{output.estimated_duration_minutes}min",
            "type": "result",
        })

        await self.set_status("complete")
        return state
