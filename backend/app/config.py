from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = Field(
        "postgresql+psycopg2://viacontab:viacontab@postgres:5432/viacontab",
        env="DATABASE_URL",
    )
    qdrant_url: str = Field("http://qdrant:6333", env="QDRANT_URL")
    openai_api_key: str = Field("", env="OPENAI_API_KEY")
    extraction_model: str = Field("gpt-4.1-nano", env="EXTRACTION_MODEL")
    embedding_model: str = Field("text-embedding-3-small", env="EMBEDDING_MODEL")
    debug_learning: bool = Field(False, env="DEBUG_LEARNING")
    allowed_origins: list[str] = Field(default_factory=lambda: ["*"])

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
