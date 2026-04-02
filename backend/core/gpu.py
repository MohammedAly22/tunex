"""GPU detection and monitoring via NVIDIA-SMI / PyTorch."""

import subprocess
import json
from typing import Optional
from pydantic import BaseModel


class GPUInfo(BaseModel):
    name: str = "No GPU Detected"
    vram_total_gb: float = 0
    vram_used_gb: float = 0
    utilization_pct: float = 0
    temperature_c: float = 0
    compute_capability: str = "N/A"
    driver_version: str = "N/A"
    cuda_version: str = "N/A"


def detect_gpu() -> GPUInfo:
    """Detect GPU using PyTorch first, fall back to nvidia-smi."""
    try:
        import torch
        if torch.cuda.is_available():
            device = torch.cuda.current_device()
            props = torch.cuda.get_device_properties(device)
            total_vram = props.total_mem / (1024 ** 3)
            used_vram = torch.cuda.memory_allocated(device) / (1024 ** 3)

            return GPUInfo(
                name=props.name,
                vram_total_gb=round(total_vram, 1),
                vram_used_gb=round(used_vram, 1),
                utilization_pct=0,
                temperature_c=0,
                compute_capability=f"{props.major}.{props.minor}",
                driver_version=torch.version.cuda or "N/A",
                cuda_version=torch.version.cuda or "N/A",
            )
    except ImportError:
        pass

    # Fallback: nvidia-smi
    try:
        result = subprocess.run(
            [
                "nvidia-smi",
                "--query-gpu=name,memory.total,memory.used,utilization.gpu,temperature.gpu,driver_version",
                "--format=csv,noheader,nounits",
            ],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode == 0:
            parts = [p.strip() for p in result.stdout.strip().split(",")]
            if len(parts) >= 6:
                return GPUInfo(
                    name=parts[0],
                    vram_total_gb=round(float(parts[1]) / 1024, 1),
                    vram_used_gb=round(float(parts[2]) / 1024, 1),
                    utilization_pct=float(parts[3]),
                    temperature_c=float(parts[4]),
                    driver_version=parts[5],
                    cuda_version="N/A",
                )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass

    return GPUInfo()


def get_live_gpu_stats() -> GPUInfo:
    """Get current GPU stats (used for real-time monitoring)."""
    try:
        import torch
        if torch.cuda.is_available():
            device = torch.cuda.current_device()
            props = torch.cuda.get_device_properties(device)
            total = props.total_mem / (1024 ** 3)
            used = torch.cuda.memory_allocated(device) / (1024 ** 3)
            reserved = torch.cuda.memory_reserved(device) / (1024 ** 3)

            # Try to get utilization via nvidia-smi
            util = 0
            temp = 0
            try:
                result = subprocess.run(
                    ["nvidia-smi", "--query-gpu=utilization.gpu,temperature.gpu", "--format=csv,noheader,nounits"],
                    capture_output=True, text=True, timeout=5,
                )
                if result.returncode == 0:
                    parts = result.stdout.strip().split(",")
                    util = float(parts[0].strip())
                    temp = float(parts[1].strip())
            except Exception:
                pass

            return GPUInfo(
                name=props.name,
                vram_total_gb=round(total, 1),
                vram_used_gb=round(max(used, reserved), 1),
                utilization_pct=util,
                temperature_c=temp,
                compute_capability=f"{props.major}.{props.minor}",
            )
    except Exception:
        pass

    return detect_gpu()
