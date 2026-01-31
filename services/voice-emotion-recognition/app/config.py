"""
Configuration for Voice Emotion Recognition Service
"""
from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    """Application settings"""

    # Model configuration
    model_cache_dir: Path = Path("/app/models")

    # API configuration
    max_file_size: int = 10 * 1024 * 1024  # 10MB
    timeout: int = 30

    # Logging
    log_level: str = "INFO"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
