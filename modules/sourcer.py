import json
import os
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import feedparser

from utils.db import (
    fetch_next_topic as db_fetch_next,
    update_topic_status as db_update_status,
    get_queue_stats as db_get_stats,
)

DATA_DIR = Path("data")
TOPICS_FILE = DATA_DIR / "topics.json"


@dataclass
class TopicItem:
    id: str
    title: str
    keywords: list[str]
    niche: str
    status: str
    created_at: datetime
    processed_at: Optional[datetime] = None
    youtube_video_id: Optional[str] = None
    error_message: Optional[str] = None
    retry_count: int = 0


def get_next_topic(source: str = "supabase") -> Optional[TopicItem]:
    if source == "supabase":
        try:
            data = db_fetch_next()
            if data is None:
                return None
            return _dict_to_topic(data)
        except Exception:
            source = "json"
    if source == "json":
        return _get_next_local()
    return None


def update_topic_status(
    topic_id: str,
    status: str,
    youtube_video_id: str = None,
    error_message: str = None,
) -> bool:
    try:
        return db_update_status(topic_id, status, youtube_video_id, error_message)
    except Exception:
        return _update_local_status(topic_id, status, youtube_video_id, error_message)


def ingest_rss_feeds(feed_urls: list[str]) -> int:
    new_count = 0
    existing = set()
    topics_file = TOPICS_FILE
    if topics_file.exists():
        with open(topics_file) as f:
            try:
                existing_topics = json.load(f)
                existing = {t["title"] for t in existing_topics}
            except json.JSONDecodeError:
                existing_topics = []
    else:
        existing_topics = []

    for url in feed_urls:
        feed = feedparser.parse(url)
        for entry in feed.entries:
            title = entry.get("title", "").strip()
            if not title or title in existing:
                continue
            existing.add(title)
            topic = {
                "id": str(uuid.uuid4()),
                "title": title,
                "keywords": [],
                "niche": "rss",
                "status": "queued",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "processed_at": None,
                "youtube_video_id": None,
                "error_message": None,
                "retry_count": 0,
            }
            existing_topics.append(topic)
            new_count += 1

    if new_count > 0:
        with open(topics_file, "w") as f:
            json.dump(existing_topics, f, indent=2)
    return new_count


def get_queue_stats() -> dict:
    try:
        return db_get_stats()
    except Exception:
        return _get_local_stats()


def _get_next_local() -> Optional[TopicItem]:
    if not TOPICS_FILE.exists():
        return None
    with open(TOPICS_FILE) as f:
        try:
            topics = json.load(f)
        except json.JSONDecodeError:
            return None
    for i, topic in enumerate(topics):
        if topic.get("status") == "queued":
            topics[i]["status"] = "in_progress"
            with open(TOPICS_FILE, "w") as f:
                json.dump(topics, f, indent=2)
            return _dict_to_topic(topics[i])
    return None


def _update_local_status(
    topic_id: str,
    status: str,
    youtube_video_id: str = None,
    error_message: str = None,
) -> bool:
    if not TOPICS_FILE.exists():
        return False
    with open(TOPICS_FILE) as f:
        try:
            topics = json.load(f)
        except json.JSONDecodeError:
            return False
    for topic in topics:
        if topic.get("id") == topic_id:
            topic["status"] = status
            topic["processed_at"] = datetime.now(timezone.utc).isoformat()
            if youtube_video_id:
                topic["youtube_video_id"] = youtube_video_id
            if error_message:
                topic["error_message"] = error_message
            with open(TOPICS_FILE, "w") as f:
                json.dump(topics, f, indent=2)
            return True
    return False


def _get_local_stats() -> dict:
    if not TOPICS_FILE.exists():
        return {"queued": 0, "in_progress": 0, "done": 0, "failed": 0}
    with open(TOPICS_FILE) as f:
        try:
            topics = json.load(f)
        except json.JSONDecodeError:
            return {"queued": 0, "in_progress": 0, "done": 0, "failed": 0}
    stats = {"queued": 0, "in_progress": 0, "done": 0, "failed": 0}
    for t in topics:
        s = t.get("status", "queued")
        if s in stats:
            stats[s] += 1
    return stats


def _dict_to_topic(d: dict) -> TopicItem:
    return TopicItem(
        id=d.get("id", str(uuid.uuid4())),
        title=d.get("title", ""),
        keywords=d.get("keywords", []),
        niche=d.get("niche", "general_knowledge"),
        status=d.get("status", "queued"),
        created_at=_parse_dt(d.get("created_at")),
        processed_at=_parse_dt(d.get("processed_at")),
        youtube_video_id=d.get("youtube_video_id"),
        error_message=d.get("error_message"),
        retry_count=d.get("retry_count", 0),
    )


def _parse_dt(val) -> Optional[datetime]:
    if val is None:
        return None
    if isinstance(val, datetime):
        return val
    try:
        return datetime.fromisoformat(val.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None
