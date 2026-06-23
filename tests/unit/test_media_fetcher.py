from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from modules.media_fetcher import (
    MediaAsset,
    _extract_section_keywords,
    _fetch_section_media,
    _generate_fallback_image,
)


def test_media_asset_dataclass():
    asset = MediaAsset(
        file_path="/path/to/video.mp4",
        asset_type="video",
        source="pexels",
        license="Pexels License",
        attribution="Video by Author on Pexels",
        duration_seconds=10.0,
        keywords_used=["space"],
    )
    assert asset.asset_type == "video"
    assert asset.source == "pexels"


def test_fallback_image_generation(tmp_path):
    asset = _generate_fallback_image(str(tmp_path))
    assert asset is not None
    assert Path(asset.file_path).exists()
    assert asset.asset_type == "image"


def test_extract_section_keywords(test_script):
    keywords = _extract_section_keywords(test_script)
    assert isinstance(keywords, dict)
    assert len(keywords) > 0
