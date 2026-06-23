import os
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import requests

from modules.scripter import VideoScript

PEXELS_BASE = "https://api.pexels.com/videos"
PIXABAY_VIDEO_BASE = "https://pixabay.com/api/videos"
PIXABAY_IMAGE_BASE = "https://pixabay.com/api"


@dataclass
class MediaAsset:
    file_path: str
    asset_type: str
    source: str
    license: str
    attribution: str
    duration_seconds: float
    keywords_used: list[str]


def fetch_all_media(
    script: VideoScript,
    output_dir: str = "./output/media",
    prefer_video: bool = True,
) -> list[MediaAsset]:
    all_assets: list[MediaAsset] = []
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    section_keywords = _extract_section_keywords(script)

    for i, section in enumerate(script.sections):
        keywords = section_keywords.get(i, section.visual_cue.split()[:3])
        target_duration = section.estimated_duration_seconds
        assets = _fetch_section_media(
            visual_cue=section.visual_cue,
            keywords=[" ".join(keywords)],
            target_duration_seconds=target_duration,
            output_dir=str(output_path),
            prefer_video=prefer_video,
        )
        all_assets.extend(assets)

    return all_assets


def _fetch_section_media(
    visual_cue: str,
    keywords: list[str],
    target_duration_seconds: int,
    output_dir: str = "./output/media",
    prefer_video: bool = True,
) -> list[MediaAsset]:
    assets: list[MediaAsset] = []

    for keyword in keywords:
        if prefer_video:
            assets = _search_and_download_video(
                keyword, target_duration_seconds, output_dir
            )
            if assets:
                break
            image_assets = _search_and_download_image(keyword, output_dir)
            if image_assets:
                assets = image_assets
                break
        else:
            image_assets = _search_and_download_image(keyword, output_dir)
            if image_assets:
                assets = image_assets
                break

    if not assets:
        fallback = _generate_fallback_image(output_dir)
        if fallback:
            assets = [fallback]

    return assets


def _search_and_download_video(
    keyword: str, target_duration: int, output_dir: str
) -> list[MediaAsset]:
    api_key = os.getenv("PEXELS_API_KEY")
    if not api_key:
        return []

    headers = {"Authorization": api_key}
    params = {
        "query": keyword,
        "per_page": 5,
        "min_duration": min(5, target_duration),
        "max_duration": 30,
        "size": "medium",
    }

    try:
        r = requests.get(
            f"{PEXELS_BASE}/search",
            headers=headers,
            params=params,
            timeout=15,
        )
        r.raise_for_status()
        data = r.json()
        videos = data.get("videos", [])
    except requests.RequestException:
        videos = []

    assets: list[MediaAsset] = []
    for video in videos:
        video_url = _get_best_quality(video)
        if not video_url:
            continue
        filename = f"pexels_{video['id']}.mp4"
        filepath = os.path.join(output_dir, filename)
        if os.path.exists(filepath):
            assets.append(
                MediaAsset(
                    file_path=filepath,
                    asset_type="video",
                    source="pexels",
                    license="Pexels License",
                    attribution=f"Video by {video.get('user', {}).get('name', 'Unknown')} on Pexels",
                    duration_seconds=float(video.get("duration", 10)),
                    keywords_used=[keyword],
                )
            )
            continue
        try:
            vr = requests.get(video_url, timeout=30)
            vr.raise_for_status()
            with open(filepath, "wb") as f:
                f.write(vr.content)
            assets.append(
                MediaAsset(
                    file_path=filepath,
                    asset_type="video",
                    source="pexels",
                    license="Pexels License",
                    attribution=f"Video by {video.get('user', {}).get('name', 'Unknown')} on Pexels",
                    duration_seconds=float(video.get("duration", 10)),
                    keywords_used=[keyword],
                )
            )
        except requests.RequestException:
            continue

        if sum(a.duration_seconds for a in assets) >= target_duration:
            break

    return assets


def _search_and_download_image(keyword: str, output_dir: str) -> list[MediaAsset]:
    api_key = os.getenv("PIXABAY_API_KEY")
    if not api_key:
        return []

    params = {
        "key": api_key,
        "q": keyword.replace(" ", "+"),
        "image_type": "photo",
        "per_page": 5,
        "safesearch": "true",
    }

    try:
        r = requests.get(PIXABAY_IMAGE_BASE, params=params, timeout=15)
        r.raise_for_status()
        data = r.json()
        hits = data.get("hits", [])
    except requests.RequestException:
        hits = []

    assets: list[MediaAsset] = []
    for hit in hits[:3]:
        image_url = hit.get("largeImageURL") or hit.get("webformatURL")
        if not image_url:
            continue
        filename = f"pixabay_{hit['id']}.jpg"
        filepath = os.path.join(output_dir, filename)
        if os.path.exists(filepath):
            assets.append(
                MediaAsset(
                    file_path=filepath,
                    asset_type="image",
                    source="pixabay",
                    license="Pixabay License (CC0)",
                    attribution=f"Image by {hit.get('user', 'Unknown')} on Pixabay",
                    duration_seconds=0,
                    keywords_used=[keyword],
                )
            )
            continue
        try:
            ir = requests.get(image_url, timeout=30)
            ir.raise_for_status()
            with open(filepath, "wb") as f:
                f.write(ir.content)
            assets.append(
                MediaAsset(
                    file_path=filepath,
                    asset_type="image",
                    source="pixabay",
                    license="Pixabay License (CC0)",
                    attribution=f"Image by {hit.get('user', 'Unknown')} on Pixabay",
                    duration_seconds=0,
                    keywords_used=[keyword],
                )
            )
        except requests.RequestException:
            continue

    return assets


def _get_best_quality(video: dict) -> Optional[str]:
    video_files = video.get("video_files", [])
    preferred_quality = ["hd", "full_hd", "sd"]
    for quality in preferred_quality:
        for vf in video_files:
            if vf.get("quality") == quality and vf.get("link"):
                return vf["link"]
    for vf in video_files:
        if vf.get("link"):
            return vf["link"]
    return None


def _generate_fallback_image(output_dir: str) -> Optional[MediaAsset]:
    from PIL import Image, ImageDraw

    filepath = os.path.join(output_dir, "fallback_bg.jpg")
    if os.path.exists(filepath):
        return MediaAsset(
            file_path=filepath,
            asset_type="image",
            source="generated",
            license="CC0",
            attribution="Generated background",
            duration_seconds=0,
            keywords_used=[],
        )
    try:
        img = Image.new("RGB", (1920, 1080), color=(20, 30, 50))
        draw = ImageDraw.Draw(img)
        draw.text((960, 540), "AutoTube", fill=(200, 200, 200))
        img.save(filepath, "JPEG", quality=85)
        return MediaAsset(
            file_path=filepath,
            asset_type="image",
            source="generated",
            license="CC0",
            attribution="Generated background",
            duration_seconds=0,
            keywords_used=[],
        )
    except Exception:
        return None


def _extract_section_keywords(script: VideoScript) -> dict[int, list[str]]:
    result: dict[int, list[str]] = {}
    for i, section in enumerate(script.sections):
        cue = section.visual_cue.lower()
        words = [w for w in cue.split() if len(w) > 3]
        random.shuffle(words)
        result[i] = words[:5]
    return result
