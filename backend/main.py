"""TuneX Backend — FastAPI Application."""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.core.database import init_db
from backend.api.routes import router as api_router
from backend.api.websocket import router as ws_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("tunex")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting TuneX backend...")
    await init_db()
    logger.info("Database initialized.")
    yield
    logger.info("Shutting down TuneX backend.")


app = FastAPI(
    title="TuneX API",
    description="Agentic Fine-Tuning Platform Backend",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(api_router)
app.include_router(ws_router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "tunex"}
