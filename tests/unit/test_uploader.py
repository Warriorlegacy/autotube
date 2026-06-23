import json
from unittest.mock import MagicMock, patch

import pytest

from modules.uploader import _build_video_body, upload_video


def test_build_video_body(test_metadata):
    body = _build_video_body(test_metadata)
    assert body["snippet"]["title"] == test_metadata.title
    assert body["snippet"]["categoryId"] == "27"
    assert body["status"]["privacyStatus"] == "public"
    assert body["status"]["madeForKids"] is False


def test_build_video_body_private():
    from modules.metadata_gen import VideoMetadata

    metadata = VideoMetadata(
        title="Private Video",
        description="Test description",
        tags=["test"],
        privacy_status="private",
    )
    body = _build_video_body(metadata)
    assert body["status"]["privacyStatus"] == "private"


@pytest.mark.asyncio
async def test_upload_video_with_quota(tmp_path):
    from modules.metadata_gen import VideoMetadata

    metadata = VideoMetadata(
        title="Test Upload",
        description="Test",
        tags=["test"],
        privacy_status="private",
    )

    video_path = tmp_path / "test.mp4"
    video_path.write_bytes(b"fake video content")
    thumb_path = tmp_path / "test.jpg"
    thumb_path.write_bytes(b"fake thumb")

    mock_youtube = MagicMock()
    mock_request = MagicMock()
    mock_request.next_chunk.return_value = (None, {"id": "test-video-id"})
    mock_youtube.videos().insert.return_value = mock_request

    with patch("modules.uploader.check_quota_available", return_value=True):
        with patch("modules.uploader.record_api_usage"):
            video_id = upload_video(
                mock_youtube, str(video_path), str(thumb_path), metadata
            )
            assert video_id == "test-video-id"


@pytest.mark.asyncio
async def test_upload_video_fails_on_quota_exceeded():
    from modules.metadata_gen import VideoMetadata

    metadata = VideoMetadata(
        title="Test",
        description="Test",
        tags=["test"],
    )

    with patch("modules.uploader.check_quota_available", return_value=False):
        with pytest.raises(RuntimeError, match="quota exceeded"):
            upload_video(MagicMock(), "test.mp4", "test.jpg", metadata)
