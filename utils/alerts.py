import os
from datetime import datetime, timezone
from typing import Any

import requests

TELEGRAM_BOT_TOKEN: str | None = None
TELEGRAM_CHAT_ID: str | None = None


def _init_telegram() -> bool:
    global TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
    TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
    TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")
    return bool(TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID)


def _send_telegram_message(message: str) -> bool:
    if not _init_telegram():
        return False
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": message,
        "parse_mode": "HTML",
    }
    try:
        r = requests.post(url, json=payload, timeout=15)
        return r.status_code == 200
    except requests.RequestException:
        return False


def send_success_alert(
    topic_title: str, video_id: str, duration: float, file_size_mb: float
) -> bool:
    msg = (
        "\u2705 AutoTube: Video Published\n"
        "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n"
        f"\U0001f4cc Topic: {topic_title}\n"
        f"\u23f1 Duration: {duration:.0f}s\n"
        f"\U0001f4ca File Size: {file_size_mb:.1f} MB\n"
        f"\U0001f517 https://youtu.be/{video_id}\n"
        f"\U0001f550 Published: {datetime.now(timezone.utc).strftime('%d %b %Y, %H:%M UTC')}"
    )
    return _send_telegram_message(msg)


def send_failure_alert(
    topic_title: str, stage: str, error: str, retry_count: int
) -> bool:
    msg = (
        "\U0001f534 AutoTube: Pipeline FAILED\n"
        "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n"
        f"\U0001f4cc Topic: {topic_title}\n"
        f"\u274c Stage: {stage}\n"
        f"\U0001f41b Error: {error}\n"
        f"\U0001f501 Retry: {retry_count}/3\n"
        f"\U0001f550 Time: {datetime.now(timezone.utc).strftime('%d %b %Y, %H:%M UTC')}"
    )
    return _send_telegram_message(msg)


def send_quota_alert(units_used: int, limit: int) -> bool:
    msg = (
        "\u26a0\ufe0f AutoTube: YouTube API Quota Alert\n"
        f"Units used today: {units_used} / {limit}\n"
        "Uploads will pause and resume tomorrow."
    )
    return _send_telegram_message(msg)


def send_queue_empty_alert() -> bool:
    msg = (
        "\u26a0\ufe0f AutoTube: Topic Queue Empty\n"
        "No queued topics found. Pipeline skipped.\n"
        "Please add new topics to continue publishing."
    )
    return _send_telegram_message(msg)


def send_weekly_summary(stats: dict[str, Any]) -> bool:
    msg = (
        "\U0001f4ca AutoTube Weekly Report\n"
        "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n"
        f"\u2705 Uploaded: {stats.get('uploaded', 0)} videos\n"
        f"\u274c Failed: {stats.get('failed', 0)}\n"
        f"\U0001f4cb Queue: {stats.get('queued', 0)} topics remaining\n"
        f"\U0001f4c8 API Quota avg: {stats.get('avg_quota_usage', 0)} units/day\n"
    )
    return _send_telegram_message(msg)
