import os
from pathlib import Path
from typing import Any

import yaml
from dotenv import load_dotenv

load_dotenv()


def _deep_merge(base: dict, override: dict) -> dict:
    merged = base.copy()
    for key, value in override.items():
        if key in merged and isinstance(merged[key], dict) and isinstance(value, dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def load_config(config_path: str = "config.yaml") -> dict[str, Any]:
    path = Path(config_path)
    if not path.exists():
        raise FileNotFoundError(f"Config file not found: {config_path}")

    with open(path, "r") as f:
        config = yaml.safe_load(f)

    env_overrides = _build_env_overrides()
    if env_overrides:
        config = _deep_merge(config, env_overrides)

    _validate_config(config)
    return config


def _build_env_overrides() -> dict:
    overrides = {}
    pipeline_overrides = {
        "privacy_status": os.getenv("PIPELINE_PRIVACY_STATUS"),
        "review_before_upload": os.getenv("PIPELINE_REVIEW_BEFORE_UPLOAD"),
    }
    pipeline_overrides = {k: v for k, v in pipeline_overrides.items() if v is not None}
    if pipeline_overrides:
        overrides["pipeline"] = pipeline_overrides

    return overrides


def _validate_config(config: dict) -> None:
    required_keys = [
        "pipeline.privacy_status",
        "content.niche",
        "ai.primary_provider",
        "tts.voice",
        "youtube.category_id",
    ]
    for key in required_keys:
        parts = key.split(".")
        obj = config
        for part in parts:
            if not isinstance(obj, dict) or part not in obj:
                raise ValueError(f"Missing required config key: {key}")
            obj = obj[part]


def get_api_key(name: str) -> str:
    key = os.getenv(name)
    if not key:
        raise ValueError(f"Missing API key: {name}. Set it in .env")
    return key
