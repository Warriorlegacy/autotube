import json
import uuid
from pathlib import Path

import pytest

from modules.sourcer import (
    TopicItem,
    get_next_topic,
    get_queue_stats,
    ingest_rss_feeds,
    update_topic_status,
)


def test_get_next_topic_json_empty(tmp_path: Path):
    from modules import sourcer

    sourcer.TOPICS_FILE = tmp_path / "topics.json"
    result = get_next_topic(source="json")
    assert result is None


def test_get_next_topic_json_with_queued(tmp_path: Path):
    topics = [
        {
            "id": "t1",
            "title": "Test Topic",
            "keywords": ["test"],
            "niche": "general_knowledge",
            "status": "queued",
            "created_at": "2026-06-01T00:00:00+00:00",
            "retry_count": 0,
        }
    ]
    topic_file = tmp_path / "topics.json"
    with open(topic_file, "w") as f:
        json.dump(topics, f)

    from modules import sourcer

    sourcer.TOPICS_FILE = topic_file

    result = get_next_topic(source="json")
    assert result is not None
    assert result.title == "Test Topic"
    assert result.status == "in_progress"


def test_update_topic_status_local(tmp_path: Path):
    topics = [
        {
            "id": "t1",
            "title": "Test",
            "keywords": [],
            "niche": "general_knowledge",
            "status": "in_progress",
            "created_at": "2026-06-01T00:00:00+00:00",
            "retry_count": 0,
        }
    ]
    topic_file = tmp_path / "topics.json"
    with open(topic_file, "w") as f:
        json.dump(topics, f)

    from modules import sourcer

    sourcer.TOPICS_FILE = topic_file

    result = update_topic_status("t1", "done", youtube_video_id="abc123")
    assert result is True

    with open(topic_file) as f:
        updated = json.load(f)
    assert updated[0]["status"] == "done"
    assert updated[0]["youtube_video_id"] == "abc123"


def test_get_queue_stats_empty(tmp_path: Path):
    from modules import sourcer

    sourcer.TOPICS_FILE = tmp_path / "topics.json"
    stats = get_queue_stats()
    assert stats["queued"] == 0
    assert stats["done"] == 0


def test_get_queue_stats_with_data(tmp_path: Path):
    topics = [
        {"id": "1", "status": "queued"},
        {"id": "2", "status": "done"},
        {"id": "3", "status": "failed"},
        {"id": "4", "status": "queued"},
    ]
    topic_file = tmp_path / "topics.json"
    with open(topic_file, "w") as f:
        json.dump(topics, f)

    from modules import sourcer

    sourcer.TOPICS_FILE = topic_file

    stats = get_queue_stats()
    assert stats["queued"] == 2
    assert stats["done"] == 1
    assert stats["failed"] == 1


def test_ingest_rss_feeds(tmp_path: Path):
    from modules import sourcer

    sourcer.TOPICS_FILE = tmp_path / "topics.json"

    count = ingest_rss_feeds([])
    assert count == 0
