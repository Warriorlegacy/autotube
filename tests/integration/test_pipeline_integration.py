import os
from unittest.mock import MagicMock, patch

import pytest

from modules.sourcer import TopicItem


@pytest.mark.skipif(not os.getenv("GEMINI_API_KEY"), reason="GEMINI_API_KEY not set")
def test_script_to_audio_integration():
    topic = TopicItem(
        id="int-test-001",
        title="How Rain Forms",
        keywords=["rain", "weather", "science"],
        niche="science",
        status="queued",
        created_at="2026-06-01T00:00:00+00:00",
        retry_count=0,
    )

    from modules.scripter import generate_script

    script = generate_script(topic, style="educational", target_minutes=3)
    assert script.estimated_duration_seconds > 0
    assert len(script.full_text) > 100

    from modules.tts_engine import run_generate_tts

    audio_path, duration = run_generate_tts(script, voice_key="en-IN")
    assert os.path.exists(audio_path)
    assert duration > 10

    os.remove(audio_path)


@pytest.mark.skipif(not os.getenv("GEMINI_API_KEY"), reason="GEMINI_API_KEY not set")
def test_metadata_from_script_integration():
    topic = TopicItem(
        id="int-test-002",
        title="Test: How Computers Work",
        keywords=["computers", "technology"],
        niche="technology",
        status="queued",
        created_at="2026-06-01T00:00:00+00:00",
        retry_count=0,
    )

    from modules.scripter import generate_script

    script = generate_script(topic, style="educational", target_minutes=3)

    from modules.metadata_gen import generate_metadata

    metadata = generate_metadata(script, [])
    assert len(metadata.title) <= 100
    assert len(metadata.title) >= 10
    assert "artificial intelligence" in metadata.description
