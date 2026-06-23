import json
from unittest.mock import MagicMock, patch

import pytest

from modules.sourcer import TopicItem
from modules.scripter import VideoScript, generate_script


@pytest.fixture
def topic():
    return TopicItem(
        id="test-001",
        title="How Do Black Holes Form?",
        keywords=["black holes", "space", "gravity"],
        niche="science",
        status="queued",
        created_at="2026-06-01T00:00:00+00:00",
        retry_count=0,
    )


@patch("modules.scripter._call_gemini")
def test_generate_script_gemini(mock_gemini, topic):
    mock_gemini.return_value = {
        "title_suggestion": "How Black Holes Actually Form",
        "hook": "Have you ever wondered what happens when a massive star runs out of fuel?",
        "sections": [
            {
                "heading": "What is a Black Hole?",
                "content": "A black hole is a region of spacetime where gravity is so strong that nothing can escape.",
                "visual_cue": "show animated star collapsing",
                "estimated_duration_seconds": 60,
            }
        ],
        "outro": "Thanks for watching! This video was created with the assistance of artificial intelligence.",
    }

    script = generate_script(topic, style="educational", target_minutes=5)

    assert isinstance(script, VideoScript)
    assert script.topic_id == "test-001"
    assert "Black Holes" in script.title_suggestion
    assert len(script.sections) > 0
    assert "artificial intelligence" in script.outro
    assert "artificial intelligence" in script.full_text
    assert script.total_words > 0
    assert script.estimated_duration_seconds > 0


@patch("modules.scripter._call_gemini")
def test_generate_script_with_visual_cues(mock_gemini, topic):
    mock_gemini.return_value = {
        "title_suggestion": "Test Title",
        "hook": "Test hook for the video.",
        "sections": [
            {
                "heading": "Section 1",
                "content": "Content for section one.",
                "visual_cue": "show stars in space",
                "estimated_duration_seconds": 30,
            },
            {
                "heading": "Section 2",
                "content": "Content for section two.",
                "visual_cue": "show galaxy animation",
                "estimated_duration_seconds": 45,
            },
        ],
        "outro": "Thanks! This video was created with the assistance of artificial intelligence.",
    }

    script = generate_script(topic)
    assert len(script.sections) == 2
    assert script.sections[0].visual_cue == "show stars in space"
    assert script.sections[1].estimated_duration_seconds == 45


def test_sanitize_topic_title():
    from modules.scripter import _sanitize_topic_title

    clean = _sanitize_topic_title("Test <script> Title {injection}")
    assert "<" not in clean
    assert ">" not in clean
    assert "{" not in clean
    assert "}" not in clean
