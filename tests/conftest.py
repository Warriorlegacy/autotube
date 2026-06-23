import json
import os
import subprocess
import tempfile
import uuid
from pathlib import Path
from typing import Any

import pytest

from modules.metadata_gen import VideoMetadata
from modules.scripter import VideoScript, ScriptSection


@pytest.fixture
def test_topic_dict() -> dict:
    return {
        "id": "test-001",
        "title": "How Do Black Holes Form?",
        "keywords": ["black holes", "space", "gravity"],
        "niche": "science",
        "status": "queued",
        "created_at": "2026-06-01T00:00:00+00:00",
        "retry_count": 0,
    }


@pytest.fixture
def test_script() -> VideoScript:
    return VideoScript(
        topic_id="test-001",
        title_suggestion="How Black Holes Actually Form",
        hook="Have you ever wondered what happens when a massive star runs out of fuel?",
        sections=[
            ScriptSection(
                heading="What is a Black Hole?",
                content="A black hole is a region of spacetime where gravity is so strong that nothing can escape. It forms when a massive star collapses under its own gravity.",
                visual_cue="show animated star collapsing",
                estimated_duration_seconds=45,
            ),
            ScriptSection(
                heading="How Do They Form?",
                content="When a star runs out of nuclear fuel, its core collapses inward. If the core is massive enough, it creates a singularity surrounded by an event horizon.",
                visual_cue="show space scene with stars",
                estimated_duration_seconds=60,
            ),
        ],
        outro="Thanks for watching! This video was created with the assistance of artificial intelligence.",
        full_text="Have you ever wondered what happens when a massive star runs out of fuel? A black hole is a region of spacetime where gravity is so strong that nothing can escape. When a star runs out of nuclear fuel, its core collapses inward. Thanks for watching! This video was created with the assistance of artificial intelligence.",
        total_words=50,
        estimated_duration_seconds=120,
    )


@pytest.fixture
def test_metadata() -> VideoMetadata:
    return VideoMetadata(
        title="How Black Holes Actually Form | Space Explained",
        description="In this video, we explore how black holes form from collapsing stars. Learn about event horizons, singularities, and the science behind these fascinating objects.\n\nThis video was created with the assistance of artificial intelligence.\n\nStock footage from Pexels.com and Pixabay.com (CC0 License)\n#Space #BlackHoles #Science",
        tags=["black holes", "space", "astronomy", "science", "physics"],
        category_id=27,
        privacy_status="public",
    )


@pytest.fixture
def tmp_short_video(tmp_path: Path) -> str:
    video_path = tmp_path / "short_video.mp4"
    _create_test_video(str(video_path), duration=2)
    return str(video_path)


@pytest.fixture
def tmp_valid_video(tmp_path: Path) -> str:
    video_path = tmp_path / "valid_video.mp4"
    _create_test_video(str(video_path), duration=5)
    return str(video_path)


@pytest.fixture
def tmp_thumbnail(tmp_path: Path) -> str:
    thumb_path = tmp_path / "test_thumb.jpg"
    from PIL import Image

    img = Image.new("RGB", (1280, 720), color=(20, 30, 50))
    img.save(str(thumb_path), "JPEG", quality=85)
    return str(thumb_path)


def _create_test_video(path: str, duration: int) -> None:
    cmd = [
        "ffmpeg",
        "-y",
        "-f",
        "lavfi",
        "-i",
        f"color=c=black:s=1920x1080:d={duration}:r=30",
        "-f",
        "lavfi",
        "-i",
        f"anullsrc=r=44100:cl=stereo",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-shortest",
        path,
    ]
    subprocess.run(cmd, capture_output=True, text=True)
