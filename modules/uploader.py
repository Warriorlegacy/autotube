import base64
import json
import os
from pathlib import Path

from google.auth.transport.requests import Request as AuthRequest
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

from modules.metadata_gen import VideoMetadata
from utils.db import check_quota_available, record_api_usage

SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube",
]

UNIT_COSTS = {
    "videos.insert": 1600,
    "thumbnails.set": 50,
    "playlistItems.insert": 50,
}
DAILY_QUOTA_LIMIT = 10000


def authenticate_youtube(token_path: str = "token.json") -> object:
    credentials = None

    if Path(token_path).exists():
        credentials = Credentials.from_authorized_user_file(token_path, SCOPES)

    env_token = os.getenv("YOUTUBE_TOKEN_BASE64")
    if not credentials and env_token:
        try:
            token_data = json.loads(base64.b64decode(env_token).decode("utf-8"))
            credentials = Credentials.from_authorized_user_info(token_data, SCOPES)
        except Exception:
            pass

    if not credentials:
        if Path("credentials.json").exists():
            flow = InstalledAppFlow.from_client_secrets_file("credentials.json", SCOPES)
            credentials = flow.run_local_server(port=8080)
            with open(token_path, "w") as f:
                f.write(credentials.to_json())
        else:
            raise FileNotFoundError(
                "No credentials.json found. Run setup/youtube_oauth.py first."
            )

    if credentials and credentials.expired and credentials.refresh_token:
        credentials.refresh(AuthRequest())
        if Path(token_path).exists():
            with open(token_path, "w") as f:
                f.write(credentials.to_json())

    if not credentials or not credentials.valid:
        raise RuntimeError("YouTube authentication failed")

    return build("youtube", "v3", credentials=credentials)


def upload_video(
    youtube_client,
    video_path: str,
    thumbnail_path: str,
    metadata: VideoMetadata,
    chunk_size_mb: int = 10,
) -> str:
    if not check_quota_available(
        UNIT_COSTS["videos.insert"] + UNIT_COSTS["thumbnails.set"]
    ):
        raise RuntimeError("YouTube API quota exceeded for today")

    body = _build_video_body(metadata)
    media = MediaFileUpload(
        video_path,
        chunksize=chunk_size_mb * 1024 * 1024,
        resumable=True,
    )

    request = youtube_client.videos().insert(
        part="snippet,status",
        body=body,
        media_body=media,
    )

    response = None
    while response is None:
        status, response = request.next_chunk()
        if status:
            progress = int(status.progress() * 100)
            if progress % 25 == 0:
                pass

    video_id = response.get("id")
    if not video_id:
        raise RuntimeError(f"Upload succeeded but no video ID: {response}")

    record_api_usage("videos.insert")

    if Path(thumbnail_path).exists():
        youtube_client.thumbnails().set(
            videoId=video_id,
            media_body=MediaFileUpload(thumbnail_path),
        ).execute()
        record_api_usage("thumbnails.set")

    return video_id


def _build_video_body(metadata: VideoMetadata) -> dict:
    return {
        "snippet": {
            "title": metadata.title,
            "description": metadata.description,
            "tags": metadata.tags,
            "categoryId": str(metadata.category_id),
            "defaultLanguage": metadata.default_language,
        },
        "status": {
            "privacyStatus": metadata.privacy_status,
            "madeForKids": metadata.made_for_kids,
            "selfDeclaredMadeForKids": metadata.made_for_kids,
        },
    }


def set_video_private(youtube_client, video_id: str) -> bool:
    youtube_client.videos().update(
        part="status",
        body={"id": video_id, "status": {"privacyStatus": "private"}},
    ).execute()
    return True


def delete_youtube_video(youtube_client, video_id: str) -> bool:
    youtube_client.videos().delete(id=video_id).execute()
    return True
