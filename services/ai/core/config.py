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

    # Database — optional; required for the analytics job worker.
    # Accepts either DATABASE_URL or the discrete DATABASE_HOST/PORT/NAME/USER/PASSWORD vars.
    database_url: str | None = None
    database_host: str | None = None
    database_port: str = "5432"
    database_name: str | None = None
    database_user: str | None = None
    database_password: str | None = None

    def build_database_url(self) -> str | None:
        if self.database_url:
            return self.database_url
        if all([self.database_host, self.database_name, self.database_user, self.database_password]):
            return (
                f"postgresql+psycopg://{self.database_user}:{self.database_password}"
                f"@{self.database_host}:{self.database_port}/{self.database_name}"
            )
        return None

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
