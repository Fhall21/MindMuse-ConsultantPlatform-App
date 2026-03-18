from typing import Any

from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    openai_api_key: str
    openai_model: str = "gpt-4o-mini"            # text generation (themes, draft, clarification, shorthand)
    openai_vision_model: str = "gpt-4o"           # vision/OCR — gpt-4o required for image input
    openai_audio_model: str = "whisper-1"         # audio transcription
    allowed_origins: list[str] = ["http://localhost:3000"]

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def parse_allowed_origins(cls, value: Any) -> Any:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
