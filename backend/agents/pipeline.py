"""Agent pipeline orchestration.

Orchestrates the multi-agent fine-tuning pipeline. Validates that the LLM is
configured before starting, and stops if the intent is incomplete.
"""

import asyncio
import logging
from typing import Callable, Optional

from .base import AgentState
from .llm import is_llm_configured, LLMNotConfiguredError
from .intent_analyzer import IntentAnalyzerAgent
from .planner import PlannerAgent
from .configuration import ConfigurationAgent
from .dataset import DatasetAgent
from .code_agent import CodeAgent
from .infrastructure import InfrastructureAgent
from .monitoring import MonitoringAgent
from .evaluation import EvaluationAgent
from .publishing import PublishingAgent

logger = logging.getLogger("tunex.pipeline")


class AgentPipeline:
    """Orchestrates the multi-agent fine-tuning pipeline.

    The pipeline enforces:
    1. LLM must be configured before starting (API key / Ollama server)
    2. Intent must be complete before proceeding past the analyzer
    3. Each agent receives the full state from previous agents
    4. Errors in any agent stop the pipeline and report to the user
    """

    def __init__(self, broadcast_fn: Optional[Callable] = None):
        self.broadcast_fn = broadcast_fn
        self.agents = {
            "intent_analyzer": IntentAnalyzerAgent(broadcast_fn),
            "planner": PlannerAgent(broadcast_fn),
            "configuration": ConfigurationAgent(broadcast_fn),
            "dataset": DatasetAgent(broadcast_fn),
            "code": CodeAgent(broadcast_fn),
            "infrastructure": InfrastructureAgent(broadcast_fn),
            "monitoring": MonitoringAgent(broadcast_fn),
            "evaluation": EvaluationAgent(broadcast_fn),
            "publishing": PublishingAgent(broadcast_fn),
        }

    async def validate_llm(self) -> bool:
        """Check if LLM is configured. Broadcast error if not."""
        if not is_llm_configured():
            if self.broadcast_fn:
                await self.broadcast_fn({
                    "type": "agent_message",
                    "agent": "planner",
                    "content": (
                        "LLM is not configured. Please go to Settings and configure "
                        "your LLM provider (OpenAI, Anthropic, Cohere, or Ollama) "
                        "with a valid API key before starting an experiment."
                    ),
                    "severity": "error",
                    "messageType": "error",
                })
                await self.broadcast_fn({
                    "type": "pipeline_error",
                    "error": "llm_not_configured",
                    "message": "Configure your LLM provider in Settings first.",
                })
            return False
        return True

    async def run_setup_pipeline(self, state: AgentState) -> AgentState:
        """Run the full setup phase: intent → plan → config → dataset → code → infra → monitoring."""

        # Gate: LLM must be configured
        if not await self.validate_llm():
            state.error = "LLM not configured"
            return state

        pipeline_order = [
            "intent_analyzer",
            "planner",
            "configuration",
            "dataset",
            "code",
            "infrastructure",
            "monitoring",
        ]

        for agent_name in pipeline_order:
            agent = self.agents[agent_name]
            try:
                await agent.set_status("thinking")
                state = await agent.run(state)

                # If intent is not complete, stop and wait for user clarification
                if agent_name == "intent_analyzer" and not state.intent_complete:
                    logger.info("Intent incomplete — waiting for user clarification")
                    if self.broadcast_fn:
                        await self.broadcast_fn({
                            "type": "pipeline_paused",
                            "reason": "intent_incomplete",
                            "message": "Waiting for your response to continue.",
                        })
                    return state

            except LLMNotConfiguredError as e:
                logger.error(f"LLM not configured: {e}")
                await agent.emit(str(e), severity="error", msg_type="error")
                await agent.set_status("error")
                state.error = str(e)
                if self.broadcast_fn:
                    await self.broadcast_fn({
                        "type": "pipeline_error",
                        "error": "llm_not_configured",
                        "message": str(e),
                    })
                break

            except Exception as e:
                logger.error(f"Agent {agent_name} failed: {e}", exc_info=True)
                await agent.emit(f"Error: {e}", severity="error", msg_type="error")
                await agent.set_status("error")
                state.error = str(e)

                # Try to analyze the error with the monitoring agent
                try:
                    monitor = self.agents["monitoring"]
                    await monitor.analyze_error(state, str(e), agent_name)
                except Exception:
                    pass
                break

            await asyncio.sleep(0.3)

        # Signal pipeline completion
        if self.broadcast_fn and not state.error:
            await self.broadcast_fn({
                "type": "pipeline_complete",
                "ready_to_train": state.ready_to_train,
                "experiment_dir": state.experiment_dir,
                "files": [f["filename"] for f in state.generated_files],
            })

        return state

    async def resume_after_answer(self, state: AgentState, user_answer: str) -> AgentState:
        """Resume the pipeline after the user answers a follow-up question.

        Re-runs the intent analyzer with the enriched prompt, then continues
        the rest of the pipeline.
        """
        if not await self.validate_llm():
            state.error = "LLM not configured"
            return state

        # Enrich the prompt with the user's answer
        state.user_prompt = f"{state.user_prompt}\n\nAdditional details: {user_answer}"
        state.intent_complete = True  # Reset so we re-check

        return await self.run_setup_pipeline(state)

    async def run_evaluation(self, state: AgentState) -> AgentState:
        if not await self.validate_llm():
            state.error = "LLM not configured"
            return state
        agent = self.agents["evaluation"]
        try:
            state = await agent.run(state)
        except Exception as e:
            logger.error(f"Evaluation failed: {e}")
            state.error = str(e)
        return state

    async def run_publishing(self, state: AgentState) -> AgentState:
        if not await self.validate_llm():
            state.error = "LLM not configured"
            return state
        agent = self.agents["publishing"]
        try:
            state = await agent.run(state)
        except Exception as e:
            logger.error(f"Publishing failed: {e}")
            state.error = str(e)
        return state
