"""Pydantic schemas for API request/response models."""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ExperimentCreate(BaseModel):
    name: str
    base_model: str
    dataset: str
    method: str = "lora"
    config: dict = {}


class ExperimentUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    config: Optional[dict] = None
    metrics: Optional[dict] = None
    benchmark_results: Optional[dict] = None
    error_message: Optional[str] = None


class ExperimentResponse(BaseModel):
    id: str
    name: str
    base_model: str
    dataset: str
    method: str
    status: str
    config: dict
    metrics: Optional[dict] = None
    benchmark_results: Optional[dict] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class SettingsPayload(BaseModel):
    llm_provider: str = "anthropic"
    llm_model: str = "claude-sonnet-4-6"
    api_key: Optional[str] = None
    ollama_endpoint: str = "http://localhost:11434"
    hf_token: Optional[str] = None
    hf_organization: Optional[str] = None
    output_dir: str = "./outputs"
    cache_dir: str = "./cache"
    max_vram_pct: int = 90


class ConnectionTestRequest(BaseModel):
    provider: str
    model: str
    api_key: Optional[str] = None
    endpoint: Optional[str] = None


class CompatibilityCheckRequest(BaseModel):
    model_id: str
    gpu_vram_gb: float
    max_vram_pct: int = 90
    batch_size: int = 4
    seq_length: int = 2048
    lora_r: int = 16


class AgentPrompt(BaseModel):
    prompt: str
    task_chips: list[str] = []
    mode: str = "agent"  # agent or custom


class UserMessage(BaseModel):
    content: str
    target_agent: Optional[str] = None


class UserAnswer(BaseModel):
    question_id: str
    answer: str
