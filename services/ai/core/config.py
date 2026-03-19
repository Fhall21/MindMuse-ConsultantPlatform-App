from typing import Any

from pydantic import Field
from pydantic.fields import FieldInfo
from pydantic_settings import BaseSettings, EnvSettingsSource, PydanticBaseSettingsSource, SettingsConfigDict


class _SettingsEnvSource(EnvSettingsSource):
    def prepare_field_value(self, field_name: str, field: FieldInfo, value: Any, value_is_complex: bool) -> Any:
        if field_name == "allowed_origins" and isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return super().prepare_field_value(field_name, field, value, value_is_complex)


class Settings(BaseSettings):
    openai_api_key: str
    openai_model: str = "gpt-4o-mini"            # text generation (themes, draft, clarification, shorthand)
    openai_vision_model: str = "gpt-4o"           # vision/OCR — gpt-4o required for image input
    openai_audio_model: str = "whisper-1"         # audio transcription
    allowed_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        _ = env_settings
        return (
            init_settings,
            _SettingsEnvSource(settings_cls),
            dotenv_settings,
            file_secret_settings,
        )

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
