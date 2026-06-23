import os
from datetime import date, datetime, timezone
from typing import Any

from supabase import Client, create_client

_url: str | None = None
_key: str | None = None
_client: Client | None = None


def get_supabase_client() -> Client:
    global _client, _url, _key
    if _client is not None:
        return _client
    _url = os.getenv("SUPABASE_URL")
    _key = os.getenv("SUPABASE_KEY")
    if not _url or not _key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set in .env")
    _client = create_client(_url, _key)
    return _client


def reset_client() -> None:
    global _client
    _client = None


def fetch_next_topic() -> dict[str, Any] | None:
    supabase = get_supabase_client()
    result = (
        supabase.table("topics")
        .update({"status": "in_progress"})
        .eq("status", "queued")
        .order("created_at")
        .limit(1)
        .execute()
    )
    if result.data and len(result.data) > 0:
        return result.data[0]
    return None


def update_topic_status(
    topic_id: str,
    status: str,
    youtube_video_id: str | None = None,
    error_message: str | None = None,
) -> bool:
    supabase = get_supabase_client()
    update_data: dict[str, Any] = {
        "status": status,
        "processed_at": datetime.now(timezone.utc).isoformat(),
    }
    if youtube_video_id:
        update_data["youtube_video_id"] = youtube_video_id
    if error_message:
        update_data["error_message"] = error_message
    result = supabase.table("topics").update(update_data).eq("id", topic_id).execute()
    return len(result.data) > 0


def create_pipeline_run(
    topic_id: str,
    status: str = "running",
) -> str | None:
    supabase = get_supabase_client()
    result = (
        supabase.table("pipeline_runs")
        .insert(
            {
                "topic_id": topic_id,
                "status": status,
                "started_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        .execute()
    )
    if result.data and len(result.data) > 0:
        return result.data[0].get("id")
    return None


def update_pipeline_run(
    run_id: str,
    status: str,
    stage_reached: str | None = None,
    stage_failed: str | None = None,
    error_details: dict | None = None,
    video_duration_seconds: float | None = None,
    file_size_mb: float | None = None,
    youtube_video_id: str | None = None,
    api_units_used: int | None = None,
) -> bool:
    supabase = get_supabase_client()
    update_data: dict[str, Any] = {
        "status": status,
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }
    if stage_reached is not None:
        update_data["stage_reached"] = stage_reached
    if stage_failed is not None:
        update_data["stage_failed"] = stage_failed
    if error_details is not None:
        update_data["error_details"] = error_details
    if video_duration_seconds is not None:
        update_data["video_duration_seconds"] = video_duration_seconds
    if file_size_mb is not None:
        update_data["file_size_mb"] = file_size_mb
    if youtube_video_id is not None:
        update_data["youtube_video_id"] = youtube_video_id
    if api_units_used is not None:
        update_data["api_units_used"] = api_units_used
    result = (
        supabase.table("pipeline_runs").update(update_data).eq("id", run_id).execute()
    )
    return len(result.data) > 0


def get_queue_stats() -> dict[str, int]:
    supabase = get_supabase_client()
    stats = {"queued": 0, "in_progress": 0, "done": 0, "failed": 0}
    for status in stats:
        result = (
            supabase.table("topics")
            .select("id", count="exact")
            .eq("status", status)
            .execute()
        )
        stats[status] = result.count or 0
    return stats


def get_quota_usage_for_today() -> int:
    supabase = get_supabase_client()
    today = date.today().isoformat()
    result = (
        supabase.table("youtube_quota").select("units_used").eq("date", today).execute()
    )
    if result.data and len(result.data) > 0:
        return result.data[0].get("units_used", 0)
    return 0


def record_api_usage(operation: str, units: int = 0) -> None:
    supabase = get_supabase_client()
    today = date.today().isoformat()
    unit_costs = {
        "videos.insert": 1600,
        "thumbnails.set": 50,
        "playlistItems.insert": 50,
    }
    units = units or unit_costs.get(operation, 0)
    existing = (
        supabase.table("youtube_quota")
        .select("id, units_used")
        .eq("date", today)
        .execute()
    )
    if existing.data and len(existing.data) > 0:
        supabase.table("youtube_quota").update(
            {
                "units_used": existing.data[0].get("units_used", 0) + units,
            }
        ).eq("id", existing.data[0]["id"]).execute()
    else:
        supabase.table("youtube_quota").insert(
            {
                "date": today,
                "units_used": units,
            }
        ).execute()


def check_quota_available(needed_units: int, limit: int = 10000) -> bool:
    used = get_quota_usage_for_today()
    return (used + needed_units) <= limit
