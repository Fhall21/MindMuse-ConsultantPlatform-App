import os

import sys
import importlib
from pathlib import Path

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


def test_services_ai_main_imports_from_app_root(monkeypatch):
    service_root = Path(__file__).resolve().parents[1]
    app_root = service_root.parents[1]

    filtered_sys_path = [
        path
        for path in sys.path
        if Path(path or ".").resolve() != service_root.resolve()
    ]
    monkeypatch.setattr(sys, "path", [str(app_root), *filtered_sys_path])

    for module_name in list(sys.modules):
        if module_name == "core" or module_name.startswith("core."):
            sys.modules.pop(module_name, None)
        if module_name == "routers" or module_name.startswith("routers."):
            sys.modules.pop(module_name, None)
        if module_name == "workers" or module_name.startswith("workers."):
            sys.modules.pop(module_name, None)
        if module_name.startswith("services.ai"):
            sys.modules.pop(module_name, None)

    module = importlib.import_module("services.ai.main")

    assert module.app.title == "ConsultantPlatform AI Service"
