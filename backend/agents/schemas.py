"""Pydantic structured I/O models for inter-agent communication.

These schemas are used with LangChain's .with_structured_output() to ensure
type-safe, validated communication between agents. Each agent produces a
specific output schema that downstream agents consume.
"""

from pydantic import BaseModel, Field
from typing import Optional


# ─── Intent Analyzer ───────────────────────────────────────────────────────────

class IntentAnalysisOutput(BaseModel):
    """Output from the Intent Analyzer agent."""
    is_complete: bool = Field(
        description="Whether the request has enough detail to proceed with fine-tuning"
    )
    task_type: str = Field(
        description="Detected task type: code_generation, chat, summarization, translation, classification, math_reasoning, custom"
    )
    model_preference: Optional[str] = Field(
        None,
        description="The specific model the user wants (e.g. 'Qwen/Qwen2.5-7B') or None if not specified",
    )
    dataset_preference: Optional[str] = Field(
        None,
        description="User-specified HuggingFace dataset ID or None if agent should find one",
    )
    missing_info: list[str] = Field(
        default_factory=list,
        description="List of missing pieces of information needed to proceed",
    )
    follow_up_questions: list[str] = Field(
        default_factory=list,
        description="Questions to ask the user to fill in missing info",
    )
    refined_prompt: str = Field(
        description="A clear, unambiguous version of the user's fine-tuning goal",
    )


# ─── Planner ───────────────────────────────────────────────────────────────────

class PlannerStep(BaseModel):
    """A single step in the execution plan."""
    step_number: int = Field(description="Sequential step number")
    agent: str = Field(description="Which agent handles this step")
    action: str = Field(description="What this step does")
    depends_on: list[int] = Field(
        default_factory=list,
        description="Step numbers this depends on",
    )

class PlannerOutput(BaseModel):
    """Output from the Planner agent."""
    steps: list[PlannerStep] = Field(description="Ordered execution plan")
    estimated_duration_minutes: int = Field(description="Rough time estimate for full pipeline")
    risk_factors: list[str] = Field(
        default_factory=list,
        description="Potential issues that could affect the pipeline",
    )
    model_id: str = Field(
        description="Resolved HuggingFace model ID (e.g. 'Qwen/Qwen2.5-7B')",
    )
    dataset_strategy: str = Field(
        description="'user_specified' if user gave a dataset, 'agent_search' if agent should find one",
    )
    validation_notes: list[str] = Field(
        default_factory=list,
        description="Notes about model/dataset/task compatibility",
    )


# ─── Configuration ─────────────────────────────────────────────────────────────

class TrainingHyperparameters(BaseModel):
    """LLM-recommended hyperparameters."""
    learning_rate: float = Field(description="Learning rate (e.g. 2e-4)")
    batch_size: int = Field(description="Per-device train batch size")
    gradient_accumulation_steps: int = Field(description="Gradient accumulation steps")
    num_epochs: int = Field(description="Number of training epochs")
    max_seq_length: int = Field(description="Maximum sequence length")
    warmup_ratio: float = Field(description="Warmup ratio (0-1)")
    weight_decay: float = Field(description="Weight decay")
    lr_scheduler: str = Field(description="LR scheduler type: cosine, linear, constant")
    optimizer: str = Field(description="Optimizer: adamw_torch, adamw_8bit, paged_adamw_8bit")

class LoRAParams(BaseModel):
    """LoRA/QLoRA configuration."""
    r: int = Field(description="LoRA rank")
    lora_alpha: int = Field(description="LoRA alpha scaling factor")
    lora_dropout: float = Field(description="LoRA dropout rate")
    target_modules: list[str] = Field(description="List of module names to apply LoRA to")

class ConfigurationOutput(BaseModel):
    """Output from the Configuration agent."""
    gpu_name: str = Field(description="Detected GPU name")
    gpu_vram_gb: float = Field(description="Total GPU VRAM in GB")
    compatible: bool = Field(description="Whether the model fits on the GPU")
    best_method: str = Field(description="Recommended training method: full, lora, qlora")
    hyperparameters: TrainingHyperparameters = Field(description="Recommended hyperparameters")
    lora_config: Optional[LoRAParams] = Field(
        None, description="LoRA config if method is lora/qlora"
    )
    suggestions: list[str] = Field(
        default_factory=list,
        description="Additional optimization suggestions",
    )


# ─── Dataset ───────────────────────────────────────────────────────────────────

class DatasetCandidate(BaseModel):
    """A dataset candidate from HuggingFace search."""
    dataset_id: str = Field(description="HuggingFace dataset ID (e.g. 'sahil2801/CodeAlpaca-20k')")
    dataset_name: str = Field(description="Human readable dataset name")
    reason: str = Field(description="Why this dataset is a good match")
    relevance_score: float = Field(description="Relevance score 0-1")

class DatasetOutput(BaseModel):
    """Output from the Dataset agent."""
    dataset_id: str = Field(description="Selected HuggingFace dataset ID")
    dataset_name: str = Field(description="Human readable name")
    source: str = Field(default="huggingface", description="Dataset source")
    train_samples: int = Field(description="Number of training samples")
    eval_samples: int = Field(description="Number of evaluation samples")
    columns: list[str] = Field(default_factory=list, description="Dataset column names")
    format_type: str = Field(
        description="Format: instruction, chat, completion"
    )
    license: str = Field(default="unknown", description="Dataset license")
    reason: str = Field(description="Why this dataset was selected")


# ─── Code ──────────────────────────────────────────────────────────────────────

class GeneratedFile(BaseModel):
    """A file generated by the Code agent."""
    filename: str = Field(description="File name (e.g. 'train.py', 'environment.yml')")
    content: str = Field(description="Complete file content")
    description: str = Field(description="What this file does")

class CodeOutput(BaseModel):
    """Output from the Code agent."""
    files: list[GeneratedFile] = Field(
        description="List of generated files (train.py, inference.py, environment.yml, run.sh, etc.)"
    )
    conda_env_name: str = Field(description="Name for the conda environment")
    python_version: str = Field(default="3.11", description="Python version for the environment")
    pip_packages: list[str] = Field(
        description="Required pip packages for training"
    )


# ─── Infrastructure ───────────────────────────────────────────────────────────

class InfrastructureOutput(BaseModel):
    """Output from the Infrastructure agent."""
    cuda_available: bool = Field(description="Whether CUDA is available")
    dependencies_ok: bool = Field(description="Whether all dependencies are installed")
    missing_packages: list[str] = Field(
        default_factory=list, description="Missing Python packages"
    )
    model_accessible: bool = Field(description="Whether the HF model is accessible")
    dataset_accessible: bool = Field(description="Whether the HF dataset is accessible")
    llmfit_compatible: bool = Field(default=False, description="LLMFit compatibility result")
    llmfit_details: Optional[str] = Field(None, description="LLMFit output details")
    issues: list[str] = Field(default_factory=list, description="Any issues found")


# ─── Monitoring ────────────────────────────────────────────────────────────────

class PreflightCheck(BaseModel):
    """A single pre-flight check result."""
    name: str = Field(description="Check name")
    status: str = Field(description="pass, warn, or fail")
    detail: str = Field(description="Check result detail")

class MonitoringOutput(BaseModel):
    """Output from the Monitoring agent."""
    preflight_passed: bool = Field(description="Whether all critical checks passed")
    checks: list[PreflightCheck] = Field(description="Individual check results")
    warnings: list[str] = Field(default_factory=list, description="Warning messages")
    ready_to_train: bool = Field(description="Final go/no-go verdict")
    remediation_steps: list[str] = Field(
        default_factory=list,
        description="Steps to fix any issues found",
    )


# ─── Monitoring: Error Analysis ────────────────────────────────────────────────

class ErrorAnalysis(BaseModel):
    """LLM analysis of a training/setup error."""
    error_type: str = Field(description="Type of error: dependency, cuda, oom, config, code, network")
    root_cause: str = Field(description="What caused the error")
    fix_suggestion: str = Field(description="How to fix the error")
    code_fix: Optional[str] = Field(None, description="Code patch if applicable")
    retry: bool = Field(description="Whether to retry after fix")


# ─── Evaluation ────────────────────────────────────────────────────────────────

class BenchmarkResult(BaseModel):
    """Result from a single benchmark."""
    name: str = Field(description="Benchmark name")
    base_score: float = Field(description="Base model score")
    finetuned_score: float = Field(description="Fine-tuned model score")
    delta: float = Field(description="Score change (positive = improvement)")

class EvaluationOutput(BaseModel):
    """Output from the Evaluation agent."""
    benchmarks: list[BenchmarkResult] = Field(description="Benchmark results")
    avg_improvement: float = Field(description="Average score improvement")
    regressions: int = Field(description="Number of regressions detected")
    summary: str = Field(description="Overall analysis and deployment recommendation")
    ready_for_deployment: bool = Field(description="Whether model is production-ready")
