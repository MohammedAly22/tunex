"""SQLAlchemy models for TuneX experiments."""

from sqlalchemy import Column, String, Integer, Float, JSON, DateTime, Enum as SAEnum
from sqlalchemy.orm import DeclarativeBase
from datetime import datetime, timezone
import enum


class Base(DeclarativeBase):
    pass


class ExperimentStatus(str, enum.Enum):
    configuring = "configuring"
    preparing = "preparing"
    training = "training"
    evaluating = "evaluating"
    completed = "completed"
    failed = "failed"
    paused = "paused"


class TrainingMethod(str, enum.Enum):
    full = "full"
    lora = "lora"
    qlora = "qlora"


class Experiment(Base):
    __tablename__ = "experiments"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    base_model = Column(String, nullable=False)
    dataset = Column(String, nullable=False)
    method = Column(SAEnum(TrainingMethod), nullable=False, default=TrainingMethod.lora)
    status = Column(SAEnum(ExperimentStatus), nullable=False, default=ExperimentStatus.configuring)
    config = Column(JSON, nullable=False, default=dict)
    metrics = Column(JSON, nullable=True)
    benchmark_results = Column(JSON, nullable=True)
    error_message = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class AgentLog(Base):
    __tablename__ = "agent_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    experiment_id = Column(String, nullable=False, index=True)
    agent_name = Column(String, nullable=False)
    message = Column(String, nullable=False)
    message_type = Column(String, nullable=False, default="action")
    severity = Column(String, nullable=False, default="info")
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class TrainingLog(Base):
    __tablename__ = "training_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    experiment_id = Column(String, nullable=False, index=True)
    step = Column(Integer, nullable=False)
    epoch = Column(Float, nullable=False)
    loss = Column(Float, nullable=False)
    learning_rate = Column(Float, nullable=False)
    grad_norm = Column(Float, nullable=True)
    tokens_per_sec = Column(Float, nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))
