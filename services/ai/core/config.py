from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    openai_api_key: str
    openai_model: str = "gpt-4o-mini"            # text generation (themes, draft, clarification, shorthand)
    openai_vision_model: str = "gpt-4o"           # vision/OCR — gpt-4o required for image input
    openai_audio_model: str = "whisper-1"         # audio transcription
    allowed_origins: list[str] = ["http://localhost:3000"]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
