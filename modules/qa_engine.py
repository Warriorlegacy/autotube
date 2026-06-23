import json
import os
import subprocess
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from PIL import Image

from modules.metadata_gen import VideoMetadata


@dataclass
class QAConfig:
    min_duration_seconds: int = 180
    max_duration_seconds: int = 900
    max_file_size_mb: int = 256
    min_file_size_mb: float = 1.0
    title_max_chars: int = 100
    title_min_chars: int = 20
    description_max_chars: int = 5000
    tags_max_total_chars: int = 500
    thumbnail_width: int = 1280
    thumbnail_height: int = 720
    blacklisted_keywords: list[str] = field(default_factory=list)
    require_audio: bool = True
    require_subtitles: bool = False


@dataclass
class QAResult:
    passed: bool
    issues: list[str]
    warnings: list[str]
    video_duration: float
    file_size_mb: float
    checked_at: datetime


def run_qa(
    video_path: str,
    thumbnail_path: str,
    metadata: VideoMetadata,
    config: Optional[QAConfig] = None,
) -> QAResult:
    if config is None:
        config = QAConfig()

    issues: list[str] = []
    warnings: list[str] = []
    video_duration = 0.0
    file_size_mb = 0.0

    issues.extend(_check_video_exists(video_path, config))
    issues.extend(_check_thumbnail_exists(thumbnail_path, config))

    if Path(video_path).exists():
        issues.extend(_check_video_duration(video_path, config))
        issues.extend(_check_file_size(video_path, config))
        issues.extend(_check_video_codec(video_path))
        if config.require_audio:
            issues.extend(_check_audio_track(video_path))

    if Path(thumbnail_path).exists():
        issues.extend(_check_thumbnail_dimensions(thumbnail_path, config))

    issues.extend(_check_metadata_lengths(metadata, config))
    issues.extend(_check_blacklisted_keywords(metadata, config))

    if (
        "AI disclosure" not in metadata.description
        and "artificial intelligence" not in metadata.description.lower()
    ):
        warnings.append("AI disclosure not found in description")

    video_duration = _get_duration(video_path)
    file_size_mb = _get_file_size_mb(video_path)

    return QAResult(
        passed=len(issues) == 0,
        issues=issues,
        warnings=warnings,
        video_duration=video_duration,
        file_size_mb=file_size_mb,
        checked_at=datetime.now(timezone.utc),
    )


def _check_video_exists(video_path: str, config: QAConfig) -> list[str]:
    if not Path(video_path).exists():
        return ["Video file does not exist"]
    return []


def _check_thumbnail_exists(thumbnail_path: str, config: QAConfig) -> list[str]:
    if not Path(thumbnail_path).exists():
        return ["Thumbnail file does not exist"]
    return []


def _check_video_duration(video_path: str, config: QAConfig) -> list[str]:
    duration = _get_duration(video_path)
    issues = []
    if duration < config.min_duration_seconds:
        issues.append(
            f"Video too short: {duration:.0f}s (min {config.min_duration_seconds}s)"
        )
    if duration > config.max_duration_seconds:
        issues.append(
            f"Video too long: {duration:.0f}s (max {config.max_duration_seconds}s)"
        )
    return issues


def _check_file_size(video_path: str, config: QAConfig) -> list[str]:
    size_mb = _get_file_size_mb(video_path)
    issues = []
    if size_mb < config.min_file_size_mb:
        issues.append(
            f"File too small: {size_mb:.2f} MB (min {config.min_file_size_mb} MB)"
        )
    if size_mb > config.max_file_size_mb:
        issues.append(
            f"File too large: {size_mb:.2f} MB (max {config.max_file_size_mb} MB)"
        )
    return issues


def _check_video_codec(video_path: str) -> list[str]:
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v",
                "quiet",
                "-print_format",
                "json",
                "-show_streams",
                video_path,
            ],
            capture_output=True,
            text=True,
        )
        data = json.loads(result.stdout)
        for stream in data.get("streams", []):
            if stream.get("codec_type") == "video":
                codec = stream.get("codec_name", "")
                if codec != "h264":
                    return [f"Video codec is {codec}, expected h264"]
                break
    except Exception:
        return ["Could not check video codec"]
    return []


def _check_audio_track(video_path: str) -> list[str]:
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v",
                "quiet",
                "-print_format",
                "json",
                "-show_streams",
                video_path,
            ],
            capture_output=True,
            text=True,
        )
        data = json.loads(result.stdout)
        has_audio = any(s.get("codec_type") == "audio" for s in data.get("streams", []))
        if not has_audio:
            return ["No audio track found in video"]
    except Exception:
        return ["Could not check audio track"]
    return []


def _check_thumbnail_dimensions(thumbnail_path: str, config: QAConfig) -> list[str]:
    try:
        with Image.open(thumbnail_path) as img:
            w, h = img.size
            issues = []
            if w != config.thumbnail_width:
                issues.append(
                    f"Thumbnail width {w}px, expected {config.thumbnail_width}px"
                )
            if h != config.thumbnail_height:
                issues.append(
                    f"Thumbnail height {h}px, expected {config.thumbnail_height}px"
                )
            return issues
    except Exception:
        return ["Could not check thumbnail dimensions"]


def _check_metadata_lengths(metadata: VideoMetadata, config: QAConfig) -> list[str]:
    issues = []
    if len(metadata.title) > config.title_max_chars:
        issues.append(
            f"Title too long: {len(metadata.title)} chars (max {config.title_max_chars})"
        )
    if len(metadata.title) < config.title_min_chars:
        issues.append(
            f"Title too short: {len(metadata.title)} chars (min {config.title_min_chars})"
        )
    if len(metadata.description) > config.description_max_chars:
        issues.append(
            f"Description too long: {len(metadata.description)} chars (max {config.description_max_chars})"
        )
    total_tags_chars = sum(len(t) for t in metadata.tags)
    if total_tags_chars > config.tags_max_total_chars:
        issues.append(
            f"Tags too long: {total_tags_chars} chars total (max {config.tags_max_total_chars})"
        )
    return issues


def _check_blacklisted_keywords(metadata: VideoMetadata, config: QAConfig) -> list[str]:
    if not config.blacklisted_keywords:
        return []
    issues = []
    text_to_check = (metadata.title + " " + metadata.description).lower()
    for keyword in config.blacklisted_keywords:
        if keyword.lower() in text_to_check:
            issues.append(f"Blacklisted keyword found: '{keyword}'")
    return issues


def _get_duration(video_path: str) -> float:
    if not Path(video_path).exists():
        return 0.0
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v",
                "quiet",
                "-print_format",
                "json",
                "-show_streams",
                video_path,
            ],
            capture_output=True,
            text=True,
        )
        data = json.loads(result.stdout)
        for stream in data.get("streams", []):
            duration = stream.get("duration")
            if duration:
                return float(duration)
    except Exception:
        pass
    return 0.0


def _get_file_size_mb(video_path: str) -> float:
    if not Path(video_path).exists():
        return 0.0
    return Path(video_path).stat().st_size / (1024 * 1024)
