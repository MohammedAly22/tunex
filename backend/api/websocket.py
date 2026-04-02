"""WebSocket endpoints for real-time agent communication and training metrics."""

import asyncio
import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from backend.core.gpu import get_live_gpu_stats
from backend.agents.base import AgentState
from backend.agents.pipeline import AgentPipeline

logger = logging.getLogger("tunex.ws")

router = APIRouter()


class ConnectionManager:
    """Manages active WebSocket connections per experiment."""

    def __init__(self):
        self.connections: dict[str, list[WebSocket]] = {}

    async def connect(self, key: str, ws: WebSocket):
        await ws.accept()
        if key not in self.connections:
            self.connections[key] = []
        self.connections[key].append(ws)

    def disconnect(self, key: str, ws: WebSocket):
        if key in self.connections:
            self.connections[key] = [c for c in self.connections[key] if c != ws]
            if not self.connections[key]:
                del self.connections[key]

    async def broadcast(self, key: str, data: dict):
        if key in self.connections:
            dead = []
            for ws in self.connections[key]:
                try:
                    await ws.send_json(data)
                except Exception:
                    dead.append(ws)
            for ws in dead:
                self.disconnect(key, ws)


manager = ConnectionManager()

# In-memory store for active experiment states (keyed by experiment_id)
experiment_states: dict[str, AgentState] = {}


@router.websocket("/ws/gpu")
async def gpu_websocket(ws: WebSocket):
    """Stream GPU stats every 2 seconds."""
    await ws.accept()
    try:
        while True:
            stats = get_live_gpu_stats()
            await ws.send_json({
                "type": "gpu_stats",
                "vram_used_gb": stats.vram_used_gb,
                "vram_total_gb": stats.vram_total_gb,
                "utilization_pct": stats.utilization_pct,
                "temperature_c": stats.temperature_c,
            })
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        pass


@router.websocket("/ws/experiment/{experiment_id}/agents")
async def agent_websocket(ws: WebSocket, experiment_id: str):
    """WebSocket for agent communication during experiment setup.

    Handles:
    - user_message: Start the pipeline with a new user prompt
    - user_answer: Resume pipeline after answering a follow-up question
    """
    key = f"agents:{experiment_id}"
    await manager.connect(key, ws)

    async def broadcast_fn(data: dict):
        """Broadcast agent messages to all connected clients."""
        await manager.broadcast(key, data)

    try:
        while True:
            data = await ws.receive_text()
            msg = json.loads(data)
            msg_type = msg.get("type", "")

            if msg_type == "start_pipeline":
                # Start the full agent pipeline
                user_prompt = msg.get("prompt", "")
                task_chips = msg.get("taskChips", [])

                if not user_prompt:
                    await ws.send_json({
                        "type": "pipeline_error",
                        "error": "empty_prompt",
                        "message": "Please describe what you want to fine-tune.",
                    })
                    continue

                # Create agent state
                state = AgentState(
                    experiment_id=experiment_id,
                    user_prompt=user_prompt,
                    task_chips=task_chips,
                )
                experiment_states[experiment_id] = state

                # Run the pipeline in a background task
                pipeline = AgentPipeline(broadcast_fn=broadcast_fn)
                asyncio.create_task(
                    _run_pipeline_safe(pipeline, state, experiment_id, broadcast_fn)
                )

            elif msg_type == "user_answer":
                # Resume pipeline after user answers a follow-up question
                answer = msg.get("answer", "")
                state = experiment_states.get(experiment_id)

                if state and not state.intent_complete:
                    pipeline = AgentPipeline(broadcast_fn=broadcast_fn)
                    asyncio.create_task(
                        _resume_pipeline_safe(pipeline, state, answer, experiment_id, broadcast_fn)
                    )
                else:
                    await ws.send_json({
                        "type": "agent_message",
                        "agent": "planner",
                        "content": "No pending question. Pipeline may have already completed.",
                        "severity": "warning",
                        "messageType": "action",
                    })

            elif msg_type == "get_state":
                # Return current experiment state
                state = experiment_states.get(experiment_id)
                if state:
                    await ws.send_json({
                        "type": "state_update",
                        "state": state.model_dump(),
                    })

    except WebSocketDisconnect:
        manager.disconnect(key, ws)


async def _run_pipeline_safe(
    pipeline: AgentPipeline,
    state: AgentState,
    experiment_id: str,
    broadcast_fn,
):
    """Run the pipeline with error handling."""
    try:
        updated_state = await pipeline.run_setup_pipeline(state)
        experiment_states[experiment_id] = updated_state
    except Exception as e:
        logger.error(f"Pipeline failed for {experiment_id}: {e}", exc_info=True)
        await broadcast_fn({
            "type": "pipeline_error",
            "error": "pipeline_crash",
            "message": f"Pipeline crashed: {str(e)}",
        })


async def _resume_pipeline_safe(
    pipeline: AgentPipeline,
    state: AgentState,
    user_answer: str,
    experiment_id: str,
    broadcast_fn,
):
    """Resume pipeline after user answers a question."""
    try:
        updated_state = await pipeline.resume_after_answer(state, user_answer)
        experiment_states[experiment_id] = updated_state
    except Exception as e:
        logger.error(f"Pipeline resume failed for {experiment_id}: {e}", exc_info=True)
        await broadcast_fn({
            "type": "pipeline_error",
            "error": "pipeline_crash",
            "message": f"Pipeline crashed: {str(e)}",
        })


@router.websocket("/ws/experiment/{experiment_id}/training")
async def training_websocket(ws: WebSocket, experiment_id: str):
    """WebSocket for training metrics streaming."""
    key = f"training:{experiment_id}"
    await manager.connect(key, ws)
    try:
        while True:
            data = await ws.receive_text()
            msg = json.loads(data)

            if msg.get("type") == "stop_training":
                await manager.broadcast(key, {
                    "type": "training_status",
                    "status": "paused",
                    "progress_pct": 0,
                    "eta_seconds": 0,
                })

    except WebSocketDisconnect:
        manager.disconnect(key, ws)
