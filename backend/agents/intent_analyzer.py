"""Intent Analyzer Agent: Validates user request completeness and asks follow-ups.

This is the first agent in the pipeline. It uses the LLM to analyze the user's
natural language request and determine if it contains enough detail to proceed
with fine-tuning. If not, it generates targeted follow-up questions.
"""

from .base import BaseAgent, AgentState
from .schemas import IntentAnalysisOutput

SYSTEM_PROMPT = """You are the Intent Analyzer for TuneX, an agentic LLM fine-tuning platform.

Analyze the user's fine-tuning request and determine whether it contains enough information to proceed.

A COMPLETE request needs ALL of the following:
1. A SPECIFIC model with version/size (e.g., "Qwen 2.5 7B", "Llama 3.1 8B", "Mistral 7B v0.3")
   - Just "Qwen" or "a model" is NOT enough — you need the exact variant
2. A clear task type (code generation, chat/conversation, summarization, translation, classification, math reasoning)
3. Either a specific dataset OR enough context so the dataset agent can find one (e.g., "Python code generation" is enough context)

If ANY of these are missing or ambiguous, set is_complete=false and ask specific follow-up questions.

Examples of INCOMPLETE requests:
- "Fine-tune qwen" → Missing version, task type. Ask: "Which Qwen version (e.g., Qwen 2.5 7B, 14B)?" and "What task (code, chat, summarization)?"
- "I want a code model" → Missing which base model. Ask: "Which base model? (e.g., Qwen 2.5 7B, CodeLlama 7B, Mistral 7B)"
- "Fine-tune a model for my data" → Missing model, task type. Ask both.

Examples of COMPLETE requests:
- "Fine-tune Qwen 2.5 7B on Python code generation using CodeAlpaca" → Complete
- "Fine-tune Llama 3.1 8B for customer support chat, find a good dataset" → Complete (agent will find dataset)

For model_preference, always resolve to the full HuggingFace model ID when possible:
- "Qwen 2.5 7B" → "Qwen/Qwen2.5-7B"
- "Llama 3.1 8B" → "meta-llama/Llama-3.1-8B"
- "Mistral 7B" → "mistralai/Mistral-7B-v0.3"
- "Phi 3 mini" → "microsoft/Phi-3-mini-4k-instruct"
"""


class IntentAnalyzerAgent(BaseAgent):
    name = "intent_analyzer"
    system_prompt = SYSTEM_PROMPT

    async def run(self, state: AgentState) -> AgentState:
        await self.set_status("thinking")
        await self.emit("Analyzing your fine-tuning request...", msg_type="thought")

        user_input = f"User request: {state.user_prompt}"
        if state.task_chips:
            user_input += f"\nTask tags: {', '.join(state.task_chips)}"

        # Call the LLM with structured Pydantic output
        output = await self.call_llm_structured(
            user_message=user_input,
            output_schema=IntentAnalysisOutput,
        )

        await self.set_status("acting")

        if output.is_complete:
            await self.emit(
                f"Request is complete. Task: {output.task_type}",
                severity="success",
            )
            await self.emit(f"Refined goal: {output.refined_prompt}")

            state.task_type = output.task_type
            state.intent_complete = True

            if output.model_preference:
                state.model_id = output.model_preference
                await self.emit(f"Model: {output.model_preference}", severity="info")
            if output.dataset_preference:
                state.dataset_id = output.dataset_preference
                await self.emit(f"Dataset: {output.dataset_preference}", severity="info")
        else:
            await self.emit("Your request needs more details:", severity="warning")
            for item in output.missing_info:
                await self.emit(f"  Missing: {item}", severity="warning")

            # Send follow-up questions to the user via WebSocket
            if output.follow_up_questions:
                all_questions = "\n".join(
                    f"• {q}" for q in output.follow_up_questions
                )
                await self.emit(all_questions, severity="warning")
                await self.ask_question(
                    question=output.follow_up_questions[0],
                    options=[],  # Free-form answer
                    question_id=f"intent_{state.experiment_id}",
                )

            state.intent_complete = False

        state.intent_analysis = output.model_dump()
        await self.set_status("complete")
        return state
