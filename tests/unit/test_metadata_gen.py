from unittest.mock import MagicMock, patch

import pytest

from modules.metadata_gen import VideoMetadata, generate_metadata


def test_generate_metadata_structure(test_script):
    with patch("modules.metadata_gen._call_metadata_api") as mock_api:
        mock_api.return_value = {
            "title": "How Black Holes Actually Form",
            "description": "Explore the fascinating science behind black holes.",
            "tags": ["black holes", "space", "science", "astronomy"],
            "hashtags": "#Space #BlackHoles #Science",
        }

        metadata = generate_metadata(test_script, [])

        assert isinstance(metadata, VideoMetadata)
        assert len(metadata.title) <= 100
        assert len(metadata.description) <= 5000
        assert "artificial intelligence" in metadata.description
        assert isinstance(metadata.tags, list)
        assert len(metadata.tags) > 0
        assert metadata.category_id == 27


def test_generate_metadata_with_attribution(test_script):
    with patch("modules.metadata_gen._call_metadata_api") as mock_api:
        mock_api.return_value = {
            "title": "Test Title",
            "description": "Test description.",
            "tags": ["test"],
            "hashtags": "#Test",
        }

        from modules.media_fetcher import MediaAsset

        assets = [
            MediaAsset(
                "/tmp/vid.mp4", "video", "pexels", "CC0", "Author", 10.0, ["space"]
            ),
        ]

        metadata = generate_metadata(test_script, assets)
        assert "Pexels" in metadata.description
        assert "Author" in metadata.description


def test_title_truncation(test_script):
    with patch("modules.metadata_gen._call_metadata_api") as mock_api:
        mock_api.return_value = {
            "title": "A" * 150,
            "description": "Test",
            "tags": ["test"],
            "hashtags": "#Test",
        }

        metadata = generate_metadata(test_script, [])
        assert len(metadata.title) <= 100


def test_description_truncation(test_script):
    with patch("modules.metadata_gen._call_metadata_api") as mock_api:
        mock_api.return_value = {
            "title": "Test",
            "description": "A" * 6000,
            "tags": ["test"],
            "hashtags": "#Test",
        }

        metadata = generate_metadata(test_script, [])
        assert len(metadata.description) <= 5000
