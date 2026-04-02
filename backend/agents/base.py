"""Base agent class and shared state for TuneX agents."""

from typing import Optional, Type, TypeVar
from pydantic import BaseModel
from datetime import datetime, timezone
import logging

logger = logging.getLogger("tunex.agents")
T = TypeVar("T", bound=BaseModel)


class AgentMessage(BaseModel):
    agent: str
    content: str
    message_type: str = "action"  # thought, action, result, question, error
    severity: str = "info"  # info, warning, error, success
    timestamp: str = ""
    options: Optional[list[str]] = None
    question_id: Optional[str] = None


class AgentState(BaseModel):
    """Shared state passed between agents in the pipeline."""
    experiment_id: str
    user_prompt: str = ""
    task_chips: list[str] = []

    # Intent
    intent_complete: bool = True
    intent_analysis: dict = {}
    task_type: str = ""

    # GPU info
    gpu_name: str = ""
    gpu_vram_gb: float = 0
    gpu_compatible: bool = False
    best_method: str = "lora"

    # Model selection
    model_id: str = ""
    model_params_b: float = 0

    # Dataset
    dataset_id: str = ""
    dataset_train_size: int = 0
    dataset_eval_size: int = 0

    # Configuration
    training_config: dict = {}
    lora_config: dict = {}

    # Code — files written to disk
    experiment_dir: str = ""  # Path to experiment folder on disk
    generated_files: list[dict] = []  # [{filename, content, description}]
    training_script: str = ""
    inference_script: str = ""
    conda_env_name: str = ""

    # Infrastructure
    dependencies_verified: bool = False
    model_downloaded: bool = False
    dataset_downloaded: bool = False
    llmfit_output: str = ""

    # Monitoring
    preflight_passed: bool = False
    issues: list[str] = []

    # Output
    messages: list[dict] = []
    agent_statuses: dict = {}
    ready_to_train: bool = False
    error: Optional[str] = None


class BaseAgent:
    """Base class for all TuneX agents.

    Each agent has:
    - A name identifier
    - A system_prompt that guides LLM behavior
    - Methods to call the LLM (raw text or structured Pydantic output)
    - Methods to emit messages to the frontend via WebSocket
    """

    name: str = "base"
    system_prompt: str = "You are a helpful AI agent."

    def __init__(self, broadcast_fn=None):
        self.broadcast_fn = broadcast_fn

    async def emit(self, content: str, severity: str = "info", msg_type: str = "action"):
        """Emit a message to the frontend via WebSocket."""
        msg = AgentMessage(
            agent=self.name,
            content=content,
            message_type=msg_type,
            severity=severity,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )
        if self.broadcast_fn:
            await self.broadcast_fn({
                "type": "agent_message",
                "agent": msg.agent,
                "content": msg.content,
                "severity": msg.severity,
                "messageType": msg.message_type,
            })
        logger.info(f"[{self.name}] {content}")
        return msg

    async def set_status(self, status: str):
        """Update agent status on frontend."""
        if self.broadcast_fn:
            await self.broadcast_fn({
                "type": "agent_status",
                "agent": self.name,
                "status": status,
            })

    async def ask_question(self, question: str, options: list[str], question_id: str):
        """Ask the user a question with options via WebSocket."""
        if self.broadcast_fn:
            await self.broadcast_fn({
                "type": "agent_question",
                "agent": self.name,
                "question": question,
                "options": options,
                "questionId": question_id,
            })

    async def emit_file(self, filename: str, content: str, description: str = ""):
        """Emit a file creation event to the frontend."""
        if self.broadcast_fn:
            await self.broadcast_fn({
                "type": "file_created",
                "agent": self.name,
                "filename": filename,
                "content": content,
                "description": description,
            })

    async def call_llm(self, user_message: str, system_override: str = "") -> str:
        """Call the configured LLM with this agent's system prompt. Returns raw text."""
        from .llm import call_llm
        return await call_llm(
            system_prompt=system_override or self.system_prompt,
            user_message=user_message,
        )

    async def call_llm_structured(
        self, user_message: str, output_schema: Type[T], system_override: str = ""
    ) -> T:
        """Call the configured LLM and parse response into a Pydantic model.

        Uses LangChain's with_structured_output() for reliable structured responses.
        """
        from .llm import call_llm_structured
        return await call_llm_structured(
            system_prompt=system_override or self.system_prompt,
            user_message=user_message,
            output_schema=output_schema,
        )

    async def run(self, state: AgentState) -> AgentState:
        """Execute the agent's logic. Override in subclasses."""
        raise NotImplementedError
