#!/usr/bin/env python3
import argparse
import os
import sys
import time
from pathlib import Path

from modules.assembler import assemble_video
from modules.media_fetcher import MediaAsset, fetch_all_media
from modules.metadata_gen import VideoMetadata, generate_metadata
from modules.qa_engine import QAConfig, QAResult, run_qa
from modules.scripter import VideoScript, generate_script
from modules.sourcer import TopicItem, get_next_topic, update_topic_status
from modules.thumbnail_gen import generate_thumbnail
from modules.tts_engine import run_generate_tts
from modules.uploader import authenticate_youtube, upload_video
from utils.alerts import (
    send_failure_alert,
    send_queue_empty_alert,
    send_quota_alert,
    send_success_alert,
)
from utils.config_loader import get_api_key, load_config
from utils.db import (
    check_quota_available,
    create_pipeline_run,
    record_api_usage,
    update_pipeline_run,
)
from utils.logger import PipelineLogger, setup_logging
from utils.retry import retry


class PipelineError(Exception):
    pass


class QAFailedError(PipelineError):
    pass


def run_pipeline(topic: TopicItem, config: dict) -> dict:
    pl = PipelineLogger(topic.id, config)
    result = {
        "topic_id": topic.id,
        "success": False,
        "video_id": None,
        "error": None,
        "stage": None,
    }
    run_id = None

    try:
        run_id = create_pipeline_run(topic.id)
    except Exception:
        pass

    try:
        pl.log_stage("SCRIPTING", "start")
        script: VideoScript = retry(
            lambda: generate_script(
                topic,
                style=config["content"]["script_style"],
                target_minutes=config["pipeline"]["target_video_duration_minutes"],
            ),
            max_retries=config["pipeline"]["max_retries"],
            base_delay=config["pipeline"]["retry_delay_base_seconds"],
        )
        pl.log_stage(
            "SCRIPTING",
            "done",
            words=script.total_words,
            duration=script.estimated_duration_seconds,
        )
        result["stage"] = "SCRIPTING"

        pl.log_stage("TTS_GENERATING", "start")
        audio_path, audio_duration = run_generate_tts(
            script,
            voice_key=config["tts"]["voice"],
        )
        pl.log_stage(
            "TTS_GENERATING", "done", audio_path=audio_path, duration=audio_duration
        )
        result["stage"] = "TTS_GENERATING"

        pl.log_stage("MEDIA_FETCHING", "start")
        media_assets: list[MediaAsset] = fetch_all_media(
            script,
            prefer_video=config["media"]["prefer_video_clips"],
        )
        pl.log_stage("MEDIA_FETCHING", "done", assets_count=len(media_assets))
        result["stage"] = "MEDIA_FETCHING"

        pl.log_stage("VIDEO_ASSEMBLING", "start")
        bg_music = None
        music_dir = Path("assets/music")
        if music_dir.exists():
            music_files = list(music_dir.glob("*.mp3"))
            if music_files:
                bg_music = str(music_files[0])

        video_path = assemble_video(
            script,
            audio_path,
            media_assets,
            bg_music_path=bg_music,
            bg_music_volume=config["video"]["background_music_volume"],
            subtitle_enabled=config["video"]["subtitle_enabled"],
            fps=config["video"]["fps"],
            codec=config["video"]["codec"],
            audio_codec=config["video"]["audio_codec"],
        )
        pl.log_stage("VIDEO_ASSEMBLING", "done", video_path=video_path)
        result["stage"] = "VIDEO_ASSEMBLING"

        pl.log_stage("THUMBNAIL_GEN", "start")
        bg_image = media_assets[0].file_path if media_assets else None
        thumbnail_path = generate_thumbnail(
            script.title_suggestion,
            background_image_path=bg_image,
            template=config["thumbnail"]["template"],
            overlay_opacity=config["thumbnail"]["overlay_opacity"],
            output_quality=config["thumbnail"]["output_quality"],
        )
        pl.log_stage("THUMBNAIL_GEN", "done", thumbnail_path=thumbnail_path)
        result["stage"] = "THUMBNAIL_GEN"

        pl.log_stage("METADATA_GEN", "start")
        metadata: VideoMetadata = generate_metadata(
            script,
            media_assets,
            category_id=config["youtube"]["category_id"],
            privacy_status=config["pipeline"]["privacy_status"],
        )
        pl.log_stage("METADATA_GEN", "done", title=metadata.title)
        result["stage"] = "METADATA_GEN"

        pl.log_stage("QA_CHECKING", "start")
        qa_config = QAConfig(
            min_duration_seconds=config["qa"]["min_duration_seconds"],
            max_duration_seconds=config["qa"]["max_duration_seconds"],
            max_file_size_mb=config["qa"]["max_file_size_mb"],
            min_file_size_mb=config["qa"]["min_file_size_mb"],
            blacklisted_keywords=config["qa"]["blacklisted_keywords"],
        )
        qa_result: QAResult = run_qa(video_path, thumbnail_path, metadata, qa_config)
        if not qa_result.passed:
            raise QAFailedError("; ".join(qa_result.issues))
        pl.log_stage(
            "QA_CHECKING",
            "done",
            passed=True,
            duration=qa_result.video_duration,
            size_mb=qa_result.file_size_mb,
        )
        result["stage"] = "QA_CHECKING"

        upload_needed = True
        review_mode = config["pipeline"].get("review_before_upload", False)
        if review_mode:
            metadata.privacy_status = "unlisted"

        pl.log_stage("UPLOADING", "start")
        QUOTA_NEEDED = 1650
        if check_quota_available(QUOTA_NEEDED, config["youtube"]["daily_quota_limit"]):
            youtube = authenticate_youtube()
            video_id = upload_video(youtube, video_path, thumbnail_path, metadata)
            pl.log_stage("UPLOADING", "done", video_id=video_id)
            result["video_id"] = video_id
            result["stage"] = "UPLOADING"
        else:
            quota_used = 0
            try:
                from utils.db import get_quota_usage_for_today

                quota_used = get_quota_usage_for_today()
            except Exception:
                pass
            send_quota_alert(quota_used, config["youtube"]["daily_quota_limit"])
            raise PipelineError(
                f"YouTube API quota exhausted ({quota_used}/{config['youtube']['daily_quota_limit']})"
            )

        update_topic_status(topic.id, "done", youtube_video_id=result["video_id"])
        result["success"] = True
        result["stage"] = "COMPLETED"

        try:
            send_success_alert(
                topic.title,
                result["video_id"],
                qa_result.video_duration,
                qa_result.file_size_mb,
            )
        except Exception:
            pass

    except QAFailedError as e:
        error_msg = str(e)
        result["error"] = error_msg
        update_topic_status(topic.id, "failed", error_message=error_msg)
        pl.log_error(result.get("stage", "UNKNOWN"), error_msg)
        try:
            send_failure_alert(topic.title, result.get("stage", "QA"), error_msg, 0)
        except Exception:
            pass

    except Exception as e:
        error_msg = f"{type(e).__name__}: {str(e)}"
        result["error"] = error_msg
        update_topic_status(topic.id, "failed", error_message=error_msg)
        pl.log_error(result.get("stage", "UNKNOWN"), error_msg)
        try:
            send_failure_alert(
                topic.title, result.get("stage", "UNKNOWN"), error_msg, 0
            )
        except Exception:
            pass

    finally:
        if run_id:
            try:
                update_pipeline_run(
                    run_id,
                    status="success" if result["success"] else "failed",
                    stage_reached=result.get("stage"),
                    stage_failed=None if result["success"] else result.get("stage"),
                    error_details={"error": result.get("error")}
                    if result.get("error")
                    else None,
                    youtube_video_id=result.get("video_id"),
                )
            except Exception:
                pass

        if config["cleanup"]["delete_local_files_after_upload"]:
            _cleanup_temp_files(topic.id)

    return result


def _cleanup_temp_files(topic_id: str) -> None:
    import shutil

    for dir_name in ["audio", "media", "video", "thumbnails"]:
        path = Path(f"output/{dir_name}")
        if path.exists():
            for f in path.iterdir():
                if f.is_file() and f.stat().st_size > 0:
                    try:
                        f.unlink()
                    except Exception:
                        pass


def main() -> None:
    setup_logging()
    config = load_config()

    parser = argparse.ArgumentParser(description="AutoTube Pipeline Runner")
    parser.add_argument(
        "--dry-run", action="store_true", help="Run pipeline without uploading"
    )
    parser.add_argument(
        "--privacy",
        choices=["public", "unlisted", "private"],
        help="Override privacy status",
    )
    parser.add_argument(
        "--topic-id", help="Process a specific topic by ID (skips queue)"
    )
    parser.add_argument(
        "--source",
        choices=["supabase", "json"],
        default="supabase",
        help="Topic source",
    )
    args = parser.parse_args()

    if args.dry_run:
        config["pipeline"]["privacy_status"] = "private"
    if args.privacy:
        config["pipeline"]["privacy_status"] = args.privacy

    topic = None
    if args.topic_id:
        from utils.db import get_supabase_client

        client = get_supabase_client()
        data = client.table("topics").select("*").eq("id", args.topic_id).execute()
        if data.data:
            from modules.sourcer import _dict_to_topic

            topic = _dict_to_topic(data.data[0])
    else:
        topic = get_next_topic(source=args.source)

    if topic is None:
        print("No queued topics found. Pipeline skipped.")
        try:
            send_queue_empty_alert()
        except Exception:
            pass
        sys.exit(0)

    print(f"Processing topic: {topic.title}")
    result = run_pipeline(topic, config)

    if result["success"]:
        print(f"Pipeline completed successfully. Video ID: {result['video_id']}")
    else:
        print(f"Pipeline failed at stage {result['stage']}: {result['error']}")
        sys.exit(1)


if __name__ == "__main__":
    main()
