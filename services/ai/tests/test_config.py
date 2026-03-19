import os

import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from core.config import Settings


def test_allowed_origins_parse_comma_separated_env(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    monkeypatch.setenv("ALLOWED_ORIGINS", "http://localhost:3000, https://app.example.com , https://api.example.com")

    settings = Settings()

    assert settings.allowed_origins == [
        "http://localhost:3000",
        "https://app.example.com",
        "https://api.example.com",
    ]
