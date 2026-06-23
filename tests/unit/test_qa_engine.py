import pytest

from modules.qa_engine import QAConfig, QAResult, run_qa


def test_qa_fails_on_missing_video():
    config = QAConfig(min_duration_seconds=180)
    result = run_qa("nonexistent.mp4", "thumb.jpg", None, config)
    assert not result.passed
    assert any("does not exist" in issue for issue in result.issues)


def test_qa_fails_on_short_video(tmp_short_video, tmp_thumbnail, test_metadata):
    config = QAConfig(min_duration_seconds=180)
    result = run_qa(tmp_short_video, tmp_thumbnail, test_metadata, config)
    assert not result.passed
    assert any("short" in issue.lower() for issue in result.issues)


def test_qa_blocks_blacklisted_keyword(test_metadata, tmp_valid_video, tmp_thumbnail):
    config = QAConfig(blacklisted_keywords=["scam"])
    test_metadata.title = "Top Scam Techniques 2024"
    result = run_qa(tmp_valid_video, tmp_thumbnail, test_metadata, config)
    assert not result.passed
    assert any("blacklist" in issue.lower() for issue in result.issues)


def test_qa_passes_valid_package(tmp_valid_video, tmp_thumbnail, test_metadata):
    config = QAConfig(min_duration_seconds=1, min_file_size_mb=0.001, title_min_chars=1)
    result = run_qa(tmp_valid_video, tmp_thumbnail, test_metadata, config)
    assert result.passed
    assert len(result.issues) == 0


def test_qa_detects_missing_thumbnail(tmp_valid_video, tmp_path, test_metadata):
    config = QAConfig()
    result = run_qa(tmp_valid_video, "missing_thumb.jpg", test_metadata, config)
    assert not result.passed


def test_qa_checks_title_length(test_metadata, tmp_valid_video, tmp_thumbnail):
    config = QAConfig(title_max_chars=10)
    result = run_qa(tmp_valid_video, tmp_thumbnail, test_metadata, config)
    assert not result.passed
    assert any("title" in issue.lower() for issue in result.issues)


def test_qa_returns_qa_result_type(tmp_valid_video, tmp_thumbnail, test_metadata):
    config = QAConfig()
    result = run_qa(tmp_valid_video, tmp_thumbnail, test_metadata, config)
    assert isinstance(result, QAResult)
    assert result.video_duration > 0
    assert result.file_size_mb > 0


def test_qa_warns_on_missing_ai_disclosure(tmp_valid_video, tmp_thumbnail):
    config = QAConfig(min_duration_seconds=1, min_file_size_mb=0.001, title_min_chars=1)
    from modules.metadata_gen import VideoMetadata

    metadata = VideoMetadata(
        title="Test Video Title",
        description="No disclosure here",
        tags=["test"],
    )
    result = run_qa(tmp_valid_video, tmp_thumbnail, metadata, config)
    assert result.passed
    assert any("AI disclosure" in w for w in result.warnings)
