from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Server
    host: str = "0.0.0.0"
    port: int = 8000

    # LLM Provider
    llm_provider: str = "anthropic"  # openai, anthropic, cohere, ollama
    llm_model: str = "claude-sonnet-4-6"
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    cohere_api_key: Optional[str] = None
    ollama_endpoint: str = "http://localhost:11434"

    # HuggingFace
    hf_token: Optional[str] = None
    hf_organization: Optional[str] = None

    # Training
    output_dir: str = "./outputs"
    cache_dir: str = "./cache"
    max_vram_pct: int = 90

    # Database
    database_url: str = "sqlite+aiosqlite:///./tunex.db"

    class Config:
        env_file = ".env"
        env_prefix = "TUNEX_"


settings = Settings()
