"""REST API routes for TuneX."""

import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from backend.core.database import get_session
from backend.core.models import Experiment as ExperimentModel
from backend.core.schemas import (
    ExperimentCreate,
    ExperimentUpdate,
    ExperimentResponse,
    SettingsPayload,
    ConnectionTestRequest,
    CompatibilityCheckRequest,
)
from backend.core.gpu import detect_gpu
from backend.core.llmfit import check_compatibility
from backend.config import settings
from backend.agents.llm import is_llm_configured

router = APIRouter(prefix="/api")


# --- Experiments ---

@router.get("/experiments", response_model=list[ExperimentResponse])
async def list_experiments(session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(ExperimentModel).order_by(ExperimentModel.created_at.desc()).limit(50)
    )
    return [
        ExperimentResponse(
            id=exp.id,
            name=exp.name,
            base_model=exp.base_model,
            dataset=exp.dataset,
            method=exp.method.value,
            status=exp.status.value,
            config=exp.config or {},
            metrics=exp.metrics,
            benchmark_results=exp.benchmark_results,
            error_message=exp.error_message,
            created_at=exp.created_at,
            updated_at=exp.updated_at,
        )
        for exp in result.scalars()
    ]


@router.post("/experiments", response_model=ExperimentResponse)
async def create_experiment(data: ExperimentCreate, session: AsyncSession = Depends(get_session)):
    exp_id = f"exp-{uuid.uuid4().hex[:12]}"

    # Create experiment directory
    exp_dir = os.path.join(settings.output_dir, exp_id)
    os.makedirs(exp_dir, exist_ok=True)

    exp = ExperimentModel(
        id=exp_id,
        name=data.name,
        base_model=data.base_model,
        dataset=data.dataset,
        method=data.method,
        config=data.config,
    )
    session.add(exp)
    await session.commit()
    await session.refresh(exp)
    return ExperimentResponse(
        id=exp.id,
        name=exp.name,
        base_model=exp.base_model,
        dataset=exp.dataset,
        method=exp.method.value,
        status=exp.status.value,
        config=exp.config or {},
        metrics=exp.metrics,
        created_at=exp.created_at,
        updated_at=exp.updated_at,
    )


@router.get("/experiments/{experiment_id}", response_model=ExperimentResponse)
async def get_experiment(experiment_id: str, session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(ExperimentModel).where(ExperimentModel.id == experiment_id)
    )
    exp = result.scalar_one_or_none()
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return ExperimentResponse(
        id=exp.id,
        name=exp.name,
        base_model=exp.base_model,
        dataset=exp.dataset,
        method=exp.method.value,
        status=exp.status.value,
        config=exp.config or {},
        metrics=exp.metrics,
        benchmark_results=exp.benchmark_results,
        error_message=exp.error_message,
        created_at=exp.created_at,
        updated_at=exp.updated_at,
    )


@router.patch("/experiments/{experiment_id}", response_model=ExperimentResponse)
async def update_experiment(
    experiment_id: str,
    data: ExperimentUpdate,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(ExperimentModel).where(ExperimentModel.id == experiment_id)
    )
    exp = result.scalar_one_or_none()
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(exp, field, value)

    await session.commit()
    await session.refresh(exp)
    return ExperimentResponse(
        id=exp.id,
        name=exp.name,
        base_model=exp.base_model,
        dataset=exp.dataset,
        method=exp.method.value,
        status=exp.status.value,
        config=exp.config or {},
        metrics=exp.metrics,
        benchmark_results=exp.benchmark_results,
        error_message=exp.error_message,
        created_at=exp.created_at,
        updated_at=exp.updated_at,
    )


@router.delete("/experiments/{experiment_id}")
async def delete_experiment(experiment_id: str, session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(ExperimentModel).where(ExperimentModel.id == experiment_id)
    )
    exp = result.scalar_one_or_none()
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
    await session.delete(exp)
    await session.commit()
    return {"status": "deleted", "id": experiment_id}


# --- GPU ---

@router.get("/gpu")
async def get_gpu():
    gpu = detect_gpu()
    return gpu.model_dump()


# --- Compatibility ---

@router.post("/compatibility")
async def check_model_compatibility(data: CompatibilityCheckRequest):
    result = check_compatibility(
        model_id=data.model_id,
        gpu_vram_gb=data.gpu_vram_gb,
        max_vram_pct=data.max_vram_pct,
        batch_size=data.batch_size,
        seq_length=data.seq_length,
        lora_r=data.lora_r,
    )
    return result.model_dump()


# --- Settings ---

@router.get("/settings/status")
async def settings_status():
    """Check if LLM settings are configured and the LLM is reachable."""
    configured = is_llm_configured()
    return {
        "configured": configured,
        "provider": settings.llm_provider,
        "model": settings.llm_model,
    }


@router.post("/settings")
async def save_settings(data: SettingsPayload):
    settings.llm_provider = data.llm_provider
    settings.llm_model = data.llm_model
    if data.api_key:
        if data.llm_provider == "openai":
            settings.openai_api_key = data.api_key
        elif data.llm_provider == "anthropic":
            settings.anthropic_api_key = data.api_key
        elif data.llm_provider == "cohere":
            settings.cohere_api_key = data.api_key
    if data.hf_token:
        settings.hf_token = data.hf_token
    if data.hf_organization:
        settings.hf_organization = data.hf_organization
    settings.output_dir = data.output_dir
    settings.cache_dir = data.cache_dir
    settings.max_vram_pct = data.max_vram_pct

    # Verify the LLM is now configured
    configured = is_llm_configured()
    return {"status": "ok", "llm_configured": configured}


@router.post("/settings/test-connection")
async def test_connection(data: ConnectionTestRequest):
    """Test LLM provider connection with a real API call."""
    try:
        if data.provider == "openai":
            import httpx
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    "https://api.openai.com/v1/models",
                    headers={"Authorization": f"Bearer {data.api_key}"},
                    timeout=10,
                )
                if resp.status_code == 200:
                    return {"status": "connected", "provider": "openai"}
                return {"status": "error", "detail": f"HTTP {resp.status_code}"}

        elif data.provider == "anthropic":
            import httpx
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": data.api_key or "",
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json",
                    },
                    json={
                        "model": data.model or "claude-sonnet-4-6",
                        "max_tokens": 1,
                        "messages": [{"role": "user", "content": "test"}],
                    },
                    timeout=10,
                )
                if resp.status_code == 200:
                    return {"status": "connected", "provider": "anthropic"}
                return {"status": "error", "detail": f"HTTP {resp.status_code}"}

        elif data.provider == "cohere":
            import httpx
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://api.cohere.com/v2/chat",
                    headers={
                        "Authorization": f"Bearer {data.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": data.model or "command-a-03-2025",
                        "messages": [{"role": "user", "content": "test"}],
                        "max_tokens": 1,
                    },
                    timeout=10,
                )
                if resp.status_code == 200:
                    return {"status": "connected", "provider": "cohere"}
                return {"status": "error", "detail": f"HTTP {resp.status_code}"}

        elif data.provider == "ollama":
            import httpx
            endpoint = data.endpoint or "http://localhost:11434"
            async with httpx.AsyncClient() as client:
                resp = await client.get(f"{endpoint}/api/tags", timeout=5)
                if resp.status_code == 200:
                    return {"status": "connected", "provider": "ollama"}
                return {"status": "error", "detail": f"HTTP {resp.status_code}"}

        return {"status": "error", "detail": "Unknown provider"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}


# --- Experiment Files ---

@router.get("/experiments/{experiment_id}/files")
async def list_experiment_files(experiment_id: str):
    """List files generated for an experiment."""
    exp_dir = os.path.join(settings.output_dir, experiment_id)
    if not os.path.exists(exp_dir):
        return {"files": []}

    files = []
    for fname in os.listdir(exp_dir):
        fpath = os.path.join(exp_dir, fname)
        if os.path.isfile(fpath):
            files.append({
                "filename": fname,
                "size": os.path.getsize(fpath),
            })
    return {"files": files}


@router.get("/experiments/{experiment_id}/files/{filename}")
async def get_experiment_file(experiment_id: str, filename: str):
    """Get the content of a generated file."""
    exp_dir = os.path.join(settings.output_dir, experiment_id)
    fpath = os.path.join(exp_dir, filename)

    # Security: prevent directory traversal
    if not os.path.abspath(fpath).startswith(os.path.abspath(exp_dir)):
        raise HTTPException(status_code=400, detail="Invalid file path")

    if not os.path.exists(fpath):
        raise HTTPException(status_code=404, detail="File not found")

    with open(fpath, "r", encoding="utf-8") as f:
        content = f.read()

    return {"filename": filename, "content": content}
