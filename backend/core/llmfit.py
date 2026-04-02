"""LLMFit: VRAM estimation and model compatibility analysis.

Estimates VRAM requirements for different training methods and determines
whether a given model can fit on the available GPU.
"""

from typing import Optional
from pydantic import BaseModel


class VRAMEstimate(BaseModel):
    method: str
    model_weights_gb: float
    optimizer_gb: float
    gradients_gb: float
    activations_gb: float
    total_gb: float
    fits: bool


class AlternativeModel(BaseModel):
    model_id: str
    params: str
    vram_required_gb: float
    reason: str


class CompatibilityResult(BaseModel):
    compatible: bool
    best_method: str
    estimates: list[VRAMEstimate]
    suggestions: list[str]
    alternative_models: list[AlternativeModel] = []


# Known model sizes in billions of parameters
MODEL_PARAMS = {
    "meta-llama/Llama-3.1-8B": 8.0,
    "Qwen/Qwen2.5-7B": 7.6,
    "Qwen/Qwen2.5-3B": 3.0,
    "mistralai/Mistral-7B-v0.3": 7.2,
    "microsoft/phi-3-mini-4k-instruct": 3.8,
    "microsoft/phi-3-small-8k-instruct": 7.0,
    "google/gemma-2-9b": 9.2,
    "meta-llama/CodeLlama-7b-hf": 6.7,
}


def estimate_params_from_id(model_id: str) -> float:
    """Estimate parameter count from model ID if not in known list."""
    if model_id in MODEL_PARAMS:
        return MODEL_PARAMS[model_id]

    # Heuristic: look for numbers followed by 'B' in the model name
    import re
    match = re.search(r"(\d+\.?\d*)\s*[bB]", model_id)
    if match:
        return float(match.group(1))

    # Default assumption for unknown models
    return 7.0


def estimate_vram(
    model_id: str,
    method: str,
    batch_size: int = 4,
    seq_length: int = 2048,
    lora_r: int = 16,
    quantization_bits: Optional[int] = None,
    gradient_checkpointing: bool = True,
) -> VRAMEstimate:
    """Estimate VRAM requirements for a training configuration."""
    params_b = estimate_params_from_id(model_id)
    bytes_per_param = 2  # FP16

    if method == "qlora":
        quantization_bits = quantization_bits or 4
        bytes_per_param = quantization_bits / 8

    model_weights_gb = (params_b * 1e9 * bytes_per_param) / (1024 ** 3)

    # Optimizer states (AdamW: 2 states per trainable param)
    if method == "full":
        trainable_params = params_b * 1e9
    else:
        # LoRA trainable params: 2 * r * d * num_layers * num_modules
        # Approximation: ~0.5% of total params for r=16
        trainable_ratio = (lora_r / 16) * 0.005
        trainable_params = params_b * 1e9 * trainable_ratio

    optimizer_gb = (trainable_params * 8) / (1024 ** 3)  # 8 bytes per param (2 states * 4 bytes)

    # Gradients
    gradients_gb = (trainable_params * 2) / (1024 ** 3)

    # Activations (rough estimate based on batch size and sequence length)
    activation_factor = 0.5 if gradient_checkpointing else 2.0
    activations_gb = (batch_size * seq_length * params_b * 0.001 * activation_factor)

    total_gb = model_weights_gb + optimizer_gb + gradients_gb + activations_gb

    return VRAMEstimate(
        method=method,
        model_weights_gb=round(model_weights_gb, 1),
        optimizer_gb=round(optimizer_gb, 1),
        gradients_gb=round(gradients_gb, 1),
        activations_gb=round(activations_gb, 1),
        total_gb=round(total_gb, 1),
        fits=False,  # Will be set by check_compatibility
    )


def check_compatibility(
    model_id: str,
    gpu_vram_gb: float,
    max_vram_pct: int = 90,
    batch_size: int = 4,
    seq_length: int = 2048,
    lora_r: int = 16,
) -> CompatibilityResult:
    """Check if a model is compatible with the available GPU."""
    available_gb = gpu_vram_gb * (max_vram_pct / 100)
    estimates = []
    suggestions = []

    for method in ["qlora", "lora", "full"]:
        quant_bits = 4 if method == "qlora" else None
        est = estimate_vram(
            model_id=model_id,
            method=method,
            batch_size=batch_size,
            seq_length=seq_length,
            lora_r=lora_r,
            quantization_bits=quant_bits,
        )
        est.fits = est.total_gb <= available_gb
        estimates.append(est)

    # Determine best method
    fitting = [e for e in estimates if e.fits]

    if fitting:
        # Prefer LoRA > QLoRA > Full (quality vs resource tradeoff)
        priority = {"lora": 1, "qlora": 2, "full": 0}
        best = max(fitting, key=lambda e: priority.get(e.method, -1))
        compatible = True
        best_method = best.method

        if best_method == "qlora" and not any(e.fits and e.method == "lora" for e in estimates):
            suggestions.append("Model requires quantization. QLoRA recommended.")
        if best.total_gb / available_gb > 0.85:
            suggestions.append("Tight VRAM fit. Consider reducing batch size or sequence length.")
    else:
        compatible = False
        best_method = "none"
        suggestions.append(f"Model too large for {gpu_vram_gb} GB VRAM.")
        suggestions.append("Try a smaller model or reduce batch size to 1.")

    # Suggest alternative models if not compatible
    alternatives = []
    if not compatible:
        params_b = estimate_params_from_id(model_id)
        for alt_id, alt_params in MODEL_PARAMS.items():
            if alt_params < params_b:
                alt_est = estimate_vram(alt_id, "qlora", batch_size=batch_size, seq_length=seq_length)
                if alt_est.total_gb <= available_gb:
                    alternatives.append(AlternativeModel(
                        model_id=alt_id,
                        params=f"{alt_params}B",
                        vram_required_gb=alt_est.total_gb,
                        reason=f"Fits in {gpu_vram_gb} GB with QLoRA",
                    ))

    return CompatibilityResult(
        compatible=compatible,
        best_method=best_method,
        estimates=estimates,
        suggestions=suggestions,
        alternative_models=alternatives,
    )
