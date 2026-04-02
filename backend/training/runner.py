"""Training runner: Executes the generated training script and streams metrics."""

import asyncio
import subprocess
import os
import json
import logging
from typing import Callable, Optional
from datetime import datetime, timezone

logger = logging.getLogger("tunex.training")


class TrainingRunner:
    """Manages training execution and metric streaming."""

    def __init__(
        self,
        experiment_id: str,
        script_path: str,
        broadcast_fn: Optional[Callable] = None,
    ):
        self.experiment_id = experiment_id
        self.script_path = script_path
        self.broadcast_fn = broadcast_fn
        self.process: Optional[subprocess.Popen] = None
        self._stop_requested = False

    async def start(self):
        """Start training in a subprocess."""
        logger.info(f"Starting training for experiment {self.experiment_id}")

        await self._broadcast_status("training", 0, 0)
        await self._broadcast_log("info", f"Starting training run for {self.experiment_id}")

        try:
            self.process = subprocess.Popen(
                ["python", self.script_path],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                env={**os.environ, "PYTHONUNBUFFERED": "1"},
            )

            # Stream output
            await self._stream_output()

            if self._stop_requested:
                await self._broadcast_status("paused", 0, 0)
                await self._broadcast_log("warning", "Training stopped by user")
            elif self.process.returncode == 0:
                await self._broadcast_status("completed", 100, 0)
                await self._broadcast_log("info", "Training completed successfully")
            else:
                await self._broadcast_status("failed", 0, 0)
                await self._broadcast_log("error", f"Training failed with exit code {self.process.returncode}")

        except Exception as e:
            logger.error(f"Training error: {e}")
            await self._broadcast_status("failed", 0, 0)
            await self._broadcast_log("error", str(e))

    async def stop(self):
        """Stop training gracefully."""
        self._stop_requested = True
        if self.process and self.process.poll() is None:
            self.process.terminate()
            await asyncio.sleep(5)
            if self.process.poll() is None:
                self.process.kill()

    async def _stream_output(self):
        """Read stdout and parse metrics from training output."""
        if not self.process or not self.process.stdout:
            return

        loop = asyncio.get_event_loop()
        while True:
            line = await loop.run_in_executor(None, self.process.stdout.readline)
            if not line and self.process.poll() is not None:
                break
            if not line:
                continue

            line = line.strip()
            await self._broadcast_log("info", line)

            # Try to parse training metrics from log lines
            metrics = self._parse_metrics(line)
            if metrics:
                await self._broadcast_metrics(metrics)

    def _parse_metrics(self, line: str) -> Optional[dict]:
        """Parse training metrics from log output."""
        # Common patterns from HuggingFace Trainer
        if "'loss'" in line or '"loss"' in line:
            try:
                # Try JSON parse
                data = json.loads(line)
                return {
                    "step": data.get("step", 0),
                    "epoch": data.get("epoch", 0),
                    "loss": data.get("loss", 0),
                    "lr": data.get("learning_rate", 0),
                    "grad_norm": data.get("grad_norm", 0),
                }
            except json.JSONDecodeError:
                pass

        # Pattern: {'loss': 1.234, 'learning_rate': 2e-4, ...}
        if "loss" in line and "learning_rate" in line:
            try:
                # Convert Python dict syntax to JSON
                json_str = line.replace("'", '"')
                data = json.loads(json_str)
                return {
                    "step": data.get("step", 0),
                    "epoch": data.get("epoch", 0),
                    "loss": data.get("loss", 0),
                    "lr": data.get("learning_rate", 0),
                    "grad_norm": data.get("grad_norm", 0),
                }
            except (json.JSONDecodeError, ValueError):
                pass

        return None

    async def _broadcast_metrics(self, metrics: dict):
        if self.broadcast_fn:
            await self.broadcast_fn({
                "type": "training_metrics",
                "step": metrics.get("step", 0),
                "epoch": metrics.get("epoch", 0),
                "loss": metrics.get("loss", 0),
                "lr": metrics.get("lr", 0),
                "grad_norm": metrics.get("grad_norm", 0),
                "tokens_per_sec": metrics.get("tokens_per_sec", 0),
                "total_steps": metrics.get("total_steps", 0),
            })

    async def _broadcast_status(self, status: str, progress_pct: float, eta_seconds: float):
        if self.broadcast_fn:
            await self.broadcast_fn({
                "type": "training_status",
                "status": status,
                "progress_pct": progress_pct,
                "eta_seconds": eta_seconds,
            })

    async def _broadcast_log(self, level: str, message: str):
        if self.broadcast_fn:
            await self.broadcast_fn({
                "type": "training_log",
                "level": level,
                "message": message,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
