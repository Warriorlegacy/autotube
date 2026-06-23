import os
from pathlib import Path
from tempfile import NamedTemporaryFile

import pytest
import yaml

from utils.config_loader import _validate_config, load_config


def test_load_config_success(tmp_path):
    config_data = {
        "pipeline": {
            "privacy_status": "public",
            "max_retries": 3,
            "retry_delay_base_seconds": 30,
            "target_video_duration_minutes": 5,
        },
        "content": {
            "niche": "test",
            "script_style": "educational",
            "language": "en",
            "min_script_words": 400,
            "max_script_words": 1200,
        },
        "ai": {
            "primary_provider": "gemini",
            "gemini_model": "gemini-2.0-flash",
            "groq_model": "test",
            "temperature": 0.7,
            "max_output_tokens": 2048,
        },
        "tts": {"voice": "en-IN", "rate": "+0%", "volume": "+0%"},
        "media": {
            "prefer_video_clips": True,
            "fallback_to_images": True,
            "min_clip_duration_seconds": 5,
            "max_clip_duration_seconds": 30,
            "download_timeout_seconds": 30,
        },
        "video": {
            "resolution": "1920x1080",
            "fps": 30,
            "codec": "libx264",
            "audio_codec": "aac",
            "background_music_volume": 0.2,
            "subtitle_enabled": True,
            "subtitle_font_size": 36,
            "subtitle_font_color": "white",
        },
        "thumbnail": {
            "template": "bold_text",
            "font_path": "./fonts/Montserrat.ttf",
            "overlay_opacity": 0.55,
            "output_quality": 95,
        },
        "youtube": {
            "category_id": 27,
            "default_language": "en",
            "made_for_kids": False,
            "daily_quota_limit": 10000,
            "quota_alert_threshold": 8000,
        },
        "qa": {
            "min_duration_seconds": 180,
            "max_duration_seconds": 900,
            "max_file_size_mb": 256,
            "min_file_size_mb": 1.0,
            "blacklisted_keywords": [],
        },
        "notifications": {
            "telegram_enabled": False,
            "alert_on": ["failure"],
            "weekly_summary_day": "Sunday",
            "weekly_summary_hour": 10,
        },
        "cleanup": {"delete_local_files_after_upload": True, "keep_logs_days": 90},
    }

    config_path = tmp_path / "test_config.yaml"
    with open(config_path, "w") as f:
        yaml.dump(config_data, f)

    orig_cwd = Path.cwd()
    os.chdir(tmp_path)
    try:
        config = load_config(str(config_path))
        assert config["pipeline"]["privacy_status"] == "public"
        assert config["content"]["niche"] == "test"
        assert config["youtube"]["category_id"] == 27
    finally:
        os.chdir(orig_cwd)


def test_validate_config_missing_key():
    config = {
        "pipeline": {"privacy_status": "public"},
        "content": {},
    }
    with pytest.raises(ValueError, match="Missing required config key"):
        _validate_config(config)


def test_validate_config_valid():
    config = {
        "pipeline": {
            "privacy_status": "public",
            "max_retries": 3,
            "retry_delay_base_seconds": 30,
            "target_video_duration_minutes": 5,
        },
        "content": {
            "niche": "test",
            "script_style": "educational",
            "language": "en",
            "min_script_words": 400,
            "max_script_words": 1200,
        },
        "ai": {
            "primary_provider": "gemini",
            "gemini_model": "test",
            "groq_model": "test",
            "temperature": 0.7,
            "max_output_tokens": 2048,
        },
        "tts": {"voice": "en-IN", "rate": "+0%", "volume": "+0%"},
        "media": {
            "prefer_video_clips": True,
            "fallback_to_images": True,
            "min_clip_duration_seconds": 5,
            "max_clip_duration_seconds": 30,
            "download_timeout_seconds": 30,
        },
        "video": {
            "resolution": "1920x1080",
            "fps": 30,
            "codec": "libx264",
            "audio_codec": "aac",
            "background_music_volume": 0.2,
            "subtitle_enabled": True,
            "subtitle_font_size": 36,
            "subtitle_font_color": "white",
        },
        "thumbnail": {
            "template": "bold_text",
            "font_path": "./fonts/Montserrat.ttf",
            "overlay_opacity": 0.55,
            "output_quality": 95,
        },
        "youtube": {
            "category_id": 27,
            "default_language": "en",
            "made_for_kids": False,
            "daily_quota_limit": 10000,
            "quota_alert_threshold": 8000,
        },
        "qa": {
            "min_duration_seconds": 180,
            "max_duration_seconds": 900,
            "max_file_size_mb": 256,
            "min_file_size_mb": 1.0,
            "blacklisted_keywords": [],
        },
        "notifications": {
            "telegram_enabled": False,
            "alert_on": ["failure"],
            "weekly_summary_day": "Sunday",
            "weekly_summary_hour": 10,
        },
        "cleanup": {"delete_local_files_after_upload": True, "keep_logs_days": 90},
    }
    _validate_config(config)
