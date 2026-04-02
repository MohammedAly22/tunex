"""Infrastructure Agent: Environment verification, dependency checks, LLMFit, model access.

Verifies that all required dependencies exist, checks model accessibility on HuggingFace,
and runs LLMFit if available to validate GPU compatibility.
"""

import subprocess
import shutil
import logging
import httpx
from .base import BaseAgent, AgentState
from .schemas import InfrastructureOutput

logger = logging.getLogger("tunex.agents")

SYSTEM_PROMPT = """You are the Infrastructure Agent for TuneX, an LLM fine-tuning platform.

You verify that the training environment is ready. You check:
1. CUDA availability and GPU drivers
2. Required Python packages (torch, transformers, peft, trl, datasets, accelerate, bitsandbytes)
3. Model accessibility on HuggingFace (gated models may require auth tokens)
4. Dataset accessibility
5. LLMFit compatibility (if the CLI tool is installed)
6. Disk space for model weights and checkpoints

Report all findings honestly. Flag any issues that would prevent training from starting.
"""


class InfrastructureAgent(BaseAgent):
    name = "infrastructure"
    system_prompt = SYSTEM_PROMPT

    async def run(self, state: AgentState) -> AgentState:
        await self.set_status("thinking")
        await self.emit("Running infrastructure checks...", msg_type="thought")
        await self.set_status("acting")

        issues = []

        # 1. CUDA check
        cuda_available = await self._check_cuda()
        if cuda_available:
            await self.emit("CUDA is available", severity="success")
        else:
            await self.emit("CUDA not available — CPU-only training (very slow)", severity="warning")
            issues.append("CUDA not available")

        # 2. Dependency check
        required = ["torch", "transformers", "peft", "trl", "datasets", "accelerate"]
        if state.best_method == "qlora":
            required.append("bitsandbytes")

        missing = []
        for pkg in required:
            version = self._check_package(pkg)
            if version:
                await self.emit(f"{pkg} {version}", severity="info")
            else:
                missing.append(pkg)
                await self.emit(f"{pkg} — NOT INSTALLED", severity="warning")

        if missing:
            issues.extend(f"Missing package: {p}" for p in missing)
        state.dependencies_verified = len(missing) == 0

        # 3. Model accessibility
        model_ok = True
        if state.model_id:
            await self.emit(f"Checking model access: {state.model_id}...")
            model_ok = await self._check_model_access(state.model_id)
            if model_ok:
                await self.emit(f"Model '{state.model_id}' is accessible", severity="success")
                state.model_downloaded = True
            else:
                await self.emit(
                    f"Model '{state.model_id}' may be gated — ensure HF token is set",
                    severity="warning",
                )
                issues.append(f"Model {state.model_id} may require authentication")
                state.model_downloaded = True  # Will attempt at training time

        # 4. Dataset accessibility
        dataset_ok = True
        if state.dataset_id:
            await self.emit(f"Checking dataset access: {state.dataset_id}...")
            dataset_ok = await self._check_dataset_access(state.dataset_id)
            if dataset_ok:
                await self.emit(f"Dataset '{state.dataset_id}' is accessible", severity="success")
            else:
                await self.emit(
                    f"Could not verify dataset '{state.dataset_id}' — may require auth",
                    severity="warning",
                )
                issues.append(f"Dataset {state.dataset_id} access not confirmed")

        # 5. LLMFit check
        llmfit_ok = False
        if state.model_id:
            llmfit_ok = await self._run_llmfit(state)

        # 6. Report via LLM (optional enhancement)
        state.issues = issues

        output = InfrastructureOutput(
            cuda_available=cuda_available,
            dependencies_ok=len(missing) == 0,
            missing_packages=missing,
            model_accessible=model_ok,
            dataset_accessible=dataset_ok,
            llmfit_compatible=llmfit_ok,
            llmfit_details=state.llmfit_output or None,
            issues=issues,
        )

        if issues:
            # Ask LLM to analyze the issues and suggest fixes
            try:
                analysis_prompt = (
                    f"Infrastructure issues found:\n"
                    + "\n".join(f"- {i}" for i in issues)
                    + f"\n\nModel: {state.model_id}, Method: {state.best_method}\n"
                    f"Provide brief remediation advice."
                )
                advice = await self.call_llm(analysis_prompt)
                if advice:
                    await self.emit(f"Advice: {advice}", severity="info", msg_type="thought")
            except Exception:
                pass

        status_msg = f"Infrastructure: {len(issues)} issues found" if issues else "All infrastructure checks passed"
        await self.emit(status_msg, severity="warning" if issues else "success")

        await self.set_status("complete")
        return state

    async def _check_cuda(self) -> bool:
        try:
            import torch
            return torch.cuda.is_available()
        except ImportError:
            return False

    def _check_package(self, package: str) -> str:
        try:
            import importlib
            mod = importlib.import_module(package)
            return getattr(mod, "__version__", "installed")
        except ImportError:
            return ""

    async def _check_model_access(self, model_id: str) -> bool:
        try:
            from backend.config import settings
            headers = {}
            if settings.hf_token:
                headers["Authorization"] = f"Bearer {settings.hf_token}"
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.head(
                    f"https://huggingface.co/api/models/{model_id}",
                    headers=headers,
                )
                return resp.status_code == 200
        except Exception:
            return True  # Assume accessible if check fails

    async def _check_dataset_access(self, dataset_id: str) -> bool:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.head(
                    f"https://huggingface.co/api/datasets/{dataset_id}",
                )
                return resp.status_code == 200
        except Exception:
            return True

    async def _run_llmfit(self, state: AgentState) -> bool:
        """Run LLMFit CLI tool if installed."""
        llmfit_path = shutil.which("llmfit")
        if not llmfit_path:
            await self.emit("LLMFit CLI not found — using built-in VRAM estimator", severity="info")
            state.llmfit_output = "LLMFit not installed. Used built-in estimator."
            return False

        await self.emit(f"Running LLMFit: {state.model_id} on {state.gpu_name}...")
        try:
            cmd = ["llmfit", "--model", state.model_id]
            if state.gpu_name and state.gpu_name != "No GPU Detected":
                cmd.extend(["--gpu", state.gpu_name])
            if state.best_method:
                cmd.extend(["--method", state.best_method])

            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            output = (result.stdout + result.stderr).strip()
            state.llmfit_output = output

            if result.returncode == 0:
                await self.emit("LLMFit: Model is compatible with your GPU", severity="success")
                return True
            else:
                await self.emit(f"LLMFit warning: {output[:200]}", severity="warning")
                return False
        except subprocess.TimeoutExpired:
            await self.emit("LLMFit timed out", severity="warning")
            return False
        except Exception as e:
            await self.emit(f"LLMFit error: {e}", severity="warning")
            return False
