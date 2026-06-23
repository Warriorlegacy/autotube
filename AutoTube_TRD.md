# AutoTube Platform — Technical Requirements Document (TRD)

**Version:** 1.0 MVP  
**Date:** June 2026  
**Author:** Golu (Piyush Raj Singh)  
**Status:** Draft  
**Companion Doc:** AutoTube_PRD.md  

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Tech Stack](#2-tech-stack)
3. [Module Specifications](#3-module-specifications)
4. [Database Schema](#4-database-schema)
5. [Configuration Schema](#5-configuration-schema)
6. [API Integrations](#6-api-integrations)
7. [Security Design](#7-security-design)
8. [Infrastructure & Deployment](#8-infrastructure--deployment)
9. [Operational Runbook](#9-operational-runbook)
10. [Testing Strategy](#10-testing-strategy)
11. [Directory Structure](#11-directory-structure)
12. [Dependencies (requirements.txt)](#12-dependencies-requirementstxt)

---

## 1. System Architecture

### 1.1 Pattern: Modular Pipeline (MVP) → Event-Driven Queue (Phase 2)

For MVP, the system is a **modular monolith** — all modules are Python functions in a single process, orchestrated by `pipeline_runner.py`. Every module is independently testable. The pipeline is stateless: Supabase holds all state.

For Phase 2, each module can be extracted into an independent worker consuming from a queue (Redis/Celery or Supabase Realtime).

### 1.2 Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                     AUTOTUBE PIPELINE                             │
│                                                                   │
│  ┌─────────────┐    ┌─────────────┐    ┌──────────────┐          │
│  │   SOURCER   │───▶│  SCRIPTER   │───▶│  TTS ENGINE  │          │
│  │ (topic queue│    │(Gemini/Groq)│    │ (Edge-TTS)   │          │
│  │  Supabase)  │    └─────────────┘    └──────────────┘          │
│  └─────────────┘                             │                    │
│                                              ▼                    │
│                                    ┌──────────────────┐          │
│  ┌─────────────┐    ┌──────────────┤ MEDIA FETCHER    │          │
│  │  METADATA   │    │  ASSEMBLER   │ (Pexels/Pixabay) │          │
│  │ GENERATOR   │    │(FFmpeg/Movie-│                  │          │
│  │(Gemini API) │    │  Py + SRT)   │                  │          │
│  └─────┬───────┘    └──────┬───────┘└──────────────────┘          │
│        │                  │                                        │
│        ▼                  ▼                                        │
│  ┌─────────────┐    ┌─────────────┐                               │
│  │  THUMBNAIL  │    │  QA ENGINE  │                               │
│  │ GENERATOR   │    │(validation +│                               │
│  │  (Pillow)   │    │ blacklist)  │                               │
│  └─────────────┘    └──────┬──────┘                               │
│                            │ PASS                                  │
│                            ▼                                       │
│                   ┌─────────────────┐                             │
│                   │  UPLOAD SERVICE │──────▶ YouTube Data API v3  │
│                   └────────┬────────┘                             │
│                            │                                       │
│                            ▼                                       │
│                   ┌─────────────────┐                             │
│                   │    MONITOR      │──────▶ Telegram Bot         │
│                   └────────┬────────┘                             │
│                            │                                       │
│                            ▼                                       │
│                      Supabase DB                                  │
│                   (state + run logs)                              │
└──────────────────────────────────────────────────────────────────┘
```

### 1.3 Job State Machine

```
┌─────────┐
│ QUEUED  │
└────┬────┘
     │
     ▼
┌──────────┐
│SCRIPTING │──── error ──▶ FAILED
└────┬─────┘
     ▼
┌──────────────┐
│TTS_GENERATING│──── error ──▶ FAILED
└──────┬───────┘
     ▼
┌──────────────┐
│MEDIA_FETCHING│──── error ──▶ FAILED (soft; uses image fallback)
└──────┬───────┘
     ▼
┌─────────────────┐
│VIDEO_ASSEMBLING │──── error ──▶ FAILED
└────────┬────────┘
     ▼
┌──────────────┐
│THUMBNAIL_GEN │──── error ──▶ FAILED
└──────┬───────┘
     ▼
┌──────────────┐
│METADATA_GEN  │──── error ──▶ FAILED
└──────┬───────┘
     ▼
┌─────────────┐
│ QA_CHECKING │──── fail ──▶ FAILED (with issues logged)
└──────┬──────┘
     ▼
┌──────────┐
│UPLOADING │──── error ──▶ FAILED (retry up to 3x)
└────┬─────┘
     ▼
┌───────────┐
│ COMPLETED │
└───────────┘
```

---

## 2. Tech Stack

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| Language | Python | 3.11+ | Ecosystem fit; asyncio support |
| AI Primary | Google Gemini Flash 2.0 | Latest | 1M TPD free; fast; structured output |
| AI Fallback | Groq (llama-3.1-70b) | Latest | Free tier; extremely fast inference |
| TTS | edge-tts (Microsoft) | 6.1+ | Free; no API key; high-quality neural voices |
| Video Assembly | MoviePy | 1.0.3 | Pythonic FFmpeg wrapper |
| Video Encoding | FFmpeg | 6.x | Industry standard; open source |
| Image Processing | Pillow | 10+ | Thumbnail generation |
| Stock Media | Pexels API + Pixabay API | REST | CC0 licensed; generous free tier |
| Upload SDK | google-api-python-client | 2.100+ | Official YouTube Data API v3 client |
| State / DB | Supabase (PostgreSQL) | Latest | Managed; 500MB free; Python SDK |
| File Storage | Local temp + Supabase Storage | — | Purge after upload |
| Scheduling | GitHub Actions (cron) | — | Most reliable free option |
| Alt Scheduling | APScheduler | 3.10+ | In-process scheduling for hosted deploy |
| Config | python-dotenv + PyYAML | Latest | Portable; secrets separation |
| Logging | structlog | 24+ | Structured JSON logs |
| Alerting | python-telegram-bot | 21+ | Free Telegram Bot API |
| Testing | pytest + pytest-asyncio | 8+ | Standard Python testing |
| CI/CD | GitHub Actions | — | Free 2,000 min/month |

---

## 3. Module Specifications

### 3.1 `modules/sourcer.py` — Content Sourcing

**Responsibility:** Fetch next available topic; mark as in-progress; optional RSS ingestion.

```python
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

@dataclass
class TopicItem:
    id: str
    title: str
    keywords: list[str]
    niche: str
    status: str  # queued | in_progress | done | failed
    created_at: datetime
    processed_at: Optional[datetime] = None
    youtube_video_id: Optional[str] = None
    error_message: Optional[str] = None

def get_next_topic(source: str = "supabase") -> Optional[TopicItem]:
    """
    Fetch next QUEUED topic; atomically set status = in_progress.
    Returns None if queue is empty.
    
    source: "supabase" | "json"
    """

def update_topic_status(
    topic_id: str,
    status: str,
    youtube_video_id: str = None,
    error_message: str = None
) -> bool:
    """
    Update topic status in Supabase or local JSON.
    Called by pipeline_runner.py on completion or failure.
    """

def ingest_rss_feeds(feed_urls: list[str]) -> int:
    """
    Parse RSS feeds; add new entries to topic queue.
    Returns count of new topics added.
    Deduplicates by title hash.
    """

def get_queue_stats() -> dict:
    """
    Returns {"queued": N, "in_progress": N, "done": N, "failed": N}
    Used for weekly summary reports.
    """
```

**Error Handling:**
- Empty queue → return `None`; pipeline logs and alerts "topic queue empty"
- Supabase unreachable → fall back to `topics.json`

---

### 3.2 `modules/scripter.py` — Script Generation

**Responsibility:** Call AI API to produce a structured video script.

```python
@dataclass
class ScriptSection:
    heading: str
    content: str
    visual_cue: str      # Instruction for media fetcher (e.g., "show busy city street")
    estimated_duration_seconds: int

@dataclass
class VideoScript:
    topic_id: str
    title_suggestion: str
    hook: str                     # Opening 10-15 seconds
    sections: list[ScriptSection]
    outro: str                    # Must include AI disclosure sentence
    full_text: str                # Concatenated for TTS
    total_words: int
    estimated_duration_seconds: int

def generate_script(
    topic: TopicItem,
    style: str = "educational",
    target_minutes: int = 5,
    provider: str = "gemini"      # gemini | groq
) -> VideoScript:
    """
    Calls AI API with structured prompt.
    Parses JSON response into VideoScript.
    Falls back to groq if gemini fails.
    """
```

**Prompt Template:**

```python
SCRIPT_PROMPT_TEMPLATE = """
You are an expert YouTube script writer. Write a {style} video script for:

Topic: {topic_title}
Keywords: {keywords}
Target Duration: {target_minutes} minutes
Audience: General / Educational

IMPORTANT RULES:
- The hook must grab attention in the first 10 seconds
- Each section must include a visual_cue (what footage/image to show)
- The outro MUST include this exact sentence: "This video was created with the assistance of artificial intelligence."
- Do NOT include any copyrighted material
- Keep language clear and engaging

Output ONLY valid JSON. No preamble. No markdown. No explanation.

Schema:
{{
  "title_suggestion": "<engaging title under 80 chars>",
  "hook": "<opening narration 30-40 words>",
  "sections": [
    {{
      "heading": "<section title>",
      "content": "<narration text 80-150 words>",
      "visual_cue": "<describe footage/image to show>",
      "estimated_duration_seconds": <integer>
    }}
  ],
  "outro": "<closing narration 30-50 words including AI disclosure>"
}}
"""
```

**Gemini API Call:**

```python
import google.generativeai as genai

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-2.0-flash")

response = model.generate_content(
    prompt,
    generation_config=genai.GenerationConfig(
        response_mime_type="application/json",
        temperature=0.7,
        max_output_tokens=2048
    )
)
script_data = json.loads(response.text)
```

**Groq Fallback:**

```python
from groq import Groq

client = Groq(api_key=os.getenv("GROQ_API_KEY"))
response = client.chat.completions.create(
    model="llama-3.1-70b-versatile",
    messages=[{"role": "user", "content": prompt}],
    response_format={"type": "json_object"},
    temperature=0.7
)
script_data = json.loads(response.choices[0].message.content)
```

---

### 3.3 `modules/tts_engine.py` — Text-to-Speech

**Responsibility:** Convert script narration text to MP3.

```python
import asyncio
import edge_tts

VOICES = {
    "en-IN": "en-IN-NeerjaNeural",      # Indian English (recommended)
    "en-US-female": "en-US-JennyNeural",
    "en-US-male": "en-US-GuyNeural",
    "en-GB": "en-GB-SoniaNeural",
}

async def generate_tts(
    script: VideoScript,
    voice_key: str = "en-IN",
    output_dir: str = "./output/audio"
) -> tuple[str, float]:
    """
    Generate MP3 from script.full_text using edge-tts.
    Returns (file_path, duration_seconds).
    Duration calculated via ffprobe after generation.
    """
    voice = VOICES.get(voice_key, VOICES["en-IN"])
    output_path = f"{output_dir}/{script.topic_id}.mp3"
    
    communicate = edge_tts.Communicate(script.full_text, voice=voice)
    await communicate.save(output_path)
    
    duration = get_audio_duration(output_path)  # via ffprobe
    return output_path, duration

def get_audio_duration(file_path: str) -> float:
    """Use ffprobe to get accurate audio duration in seconds."""
    import subprocess, json
    result = subprocess.run(
        ["ffprobe", "-v", "quiet", "-print_format", "json",
         "-show_streams", file_path],
        capture_output=True, text=True
    )
    data = json.loads(result.stdout)
    return float(data["streams"][0]["duration"])
```

---

### 3.4 `modules/media_fetcher.py` — Stock Media Acquisition

**Responsibility:** Download relevant CC0 stock footage and images for each script section.

```python
@dataclass
class MediaAsset:
    file_path: str
    asset_type: str          # "video" | "image"
    source: str              # "pexels" | "pixabay"
    license: str             # "CC0" | "Pexels License"
    attribution: str         # Credit line for description
    duration_seconds: float  # 0 for images
    keywords_used: list[str]

def fetch_section_media(
    visual_cue: str,
    keywords: list[str],
    target_duration_seconds: int,
    output_dir: str = "./output/media"
) -> list[MediaAsset]:
    """
    Main entry: tries Pexels video first, then Pixabay video,
    then Pexels image, then Pixabay image.
    Returns enough clips/images to cover target_duration.
    """

def _search_pexels_videos(keyword: str, min_duration: int = 5) -> list[dict]:
    """
    GET https://api.pexels.com/videos/search
    Params: query, per_page=5, min_duration, max_duration=30
    Returns list of video metadata dicts.
    """
    headers = {"Authorization": os.getenv("PEXELS_API_KEY")}
    params = {
        "query": keyword,
        "per_page": 5,
        "min_duration": min_duration,
        "max_duration": 30,
        "size": "medium"
    }
    r = requests.get("https://api.pexels.com/videos/search",
                     headers=headers, params=params)
    r.raise_for_status()
    return r.json().get("videos", [])

def _search_pixabay_images(keyword: str) -> list[dict]:
    """
    GET https://pixabay.com/api/
    Params: key, q, image_type=photo, per_page=5, safesearch=true
    Returns list of image metadata dicts.
    """
    params = {
        "key": os.getenv("PIXABAY_API_KEY"),
        "q": keyword.replace(" ", "+"),
        "image_type": "photo",
        "per_page": 5,
        "safesearch": "true",
        "editors_choice": "false"
    }
    r = requests.get("https://pixabay.com/api/", params=params)
    r.raise_for_status()
    return r.json().get("hits", [])
```

**Keyword Generation Strategy:**
Each `visual_cue` is passed through a keyword extractor that generates 2–3 specific search terms. e.g., `"show busy city street with people walking"` → `["city street pedestrians", "urban crowd", "busy street walk"]`. Try each until media found.

---

### 3.5 `modules/assembler.py` — Video Assembly

**Responsibility:** Assemble final 1080p MP4 from audio + media assets + subtitles.

```python
def assemble_video(
    script: VideoScript,
    audio_path: str,
    media_assets: list[MediaAsset],
    output_dir: str = "./output/video",
    resolution: tuple = (1920, 1080),
    fps: int = 30,
    subtitle_enabled: bool = True,
    bg_music_path: str = None,
    bg_music_volume: float = 0.20
) -> str:
    """
    Main assembly function. Strategy:
    1. Map sections to media assets by duration
    2. Trim/extend each asset to match section audio duration
    3. Apply Ken Burns effect to images
    4. Concatenate all clips
    5. Add subtitle overlay (SRT → ASS → FFmpeg)
    6. Mix in background music at bg_music_volume
    7. Render to 1080p MP4
    Returns output file path.
    """
```

**FFmpeg Commands — Key Patterns:**

```bash
# Ken Burns (zoom-pan) effect for images — 5 second clip from image
ffmpeg -loop 1 -i image.jpg -vf "
  zoompan=z='min(zoom+0.0015,1.5)':d=150:
  x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080
" -t 5 -c:v libx264 -pix_fmt yuv420p clip_out.mp4

# Mix video + audio
ffmpeg -i video_no_audio.mp4 -i narration.mp3 -c:v copy -c:a aac output.mp4

# Add subtitles from SRT
ffmpeg -i output.mp4 -vf "subtitles=subs.srt:fontsdir=/fonts:force_style='FontName=Montserrat,FontSize=36,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,BorderStyle=3'" final.mp4

# Mix background music at 20% volume
ffmpeg -i final.mp4 -i bgmusic.mp3 -filter_complex "
  [1:a]volume=0.2,afade=t=out:st={fade_start}:d=3[bg];
  [0:a][bg]amix=inputs=2:duration=first[a]
" -map 0:v -map "[a]" -c:v copy -c:a aac final_with_music.mp4
```

**SRT Generation from Script:**

```python
def generate_srt(script: VideoScript, audio_path: str) -> str:
    """
    Generate SRT subtitle file from script sections + audio timestamps.
    Uses section estimated_duration_seconds to create rough timestamps.
    Returns path to .srt file.
    """
    # Each section content is split into ~10-word chunks
    # Timestamps estimated from total audio duration / word count
```

---

### 3.6 `modules/thumbnail_gen.py` — Thumbnail Generation

**Responsibility:** Create YouTube-spec (1280×720 JPEG) thumbnail.

```python
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

THUMBNAIL_SPECS = {
    "width": 1280,
    "height": 720,
    "format": "JPEG",
    "quality": 95
}

def generate_thumbnail(
    title: str,
    background_image_path: str,
    template: str = "bold_text",
    output_path: str = "./output/thumbnails",
    font_path: str = "./assets/fonts/Montserrat-Bold.ttf"
) -> str:
    """
    Creates 1280x720 thumbnail. Templates:
    
    bold_text: Full image background + dark gradient overlay +
               large white title text + topic keyword badge
    
    split_layout: Right half image, left half solid color +
                  title text on solid background
    
    minimal: Image background + small text bottom-left +
             subtle gradient
    
    Returns output file path.
    """

def _bold_text_template(
    base_img: Image,
    title: str,
    font_path: str
) -> Image:
    """
    1. Resize + crop base image to 1280x720
    2. Darken with semi-transparent overlay (black 50%)
    3. Add drop shadow to text (render text twice, offset + blur)
    4. Add white title text (font size auto-fits to ~60-80px)
    5. Optional: Add a colored accent bar at bottom
    """
```

---

### 3.7 `modules/metadata_gen.py` — SEO Metadata Generation

**Responsibility:** Generate YouTube-compliant metadata from script.

```python
@dataclass
class VideoMetadata:
    title: str             # ≤ 100 chars; engaging + keyword-rich
    description: str       # ≤ 5000 chars; includes credits + AI disclosure + hashtags
    tags: list[str]        # ≤ 500 chars total combined
    category_id: int       # 27 = Education
    default_language: str  # "en"
    made_for_kids: bool    # False
    privacy_status: str    # "public" | "unlisted" | "private"

DESCRIPTION_TEMPLATE = """
{ai_description}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 This video was created with AI assistance.

📸 Stock footage & images from Pexels.com and Pixabay.com (CC0 License)
🎵 Background music from {music_source}

{attribution_lines}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{hashtags}
"""

def generate_metadata(
    script: VideoScript,
    media_assets: list[MediaAsset],
    music_source: str = "YouTube Audio Library",
    category_id: int = 27
) -> VideoMetadata:
    """
    Calls Gemini API for title, description, tags.
    Appends attribution block from media_assets.
    Validates lengths before returning.
    """
```

---

### 3.8 `modules/qa_engine.py` — Quality Assurance

**Responsibility:** Validate video package before upload; block bad outputs.

```python
@dataclass
class QAConfig:
    min_duration_seconds: int = 180     # 3 min
    max_duration_seconds: int = 900     # 15 min
    max_file_size_mb: int = 256
    min_file_size_mb: float = 1.0       # Catches empty/corrupt files
    title_max_chars: int = 100
    title_min_chars: int = 20
    description_max_chars: int = 5000
    tags_max_total_chars: int = 500
    thumbnail_width: int = 1280
    thumbnail_height: int = 720
    blacklisted_keywords: list[str] = field(default_factory=list)
    require_audio: bool = True
    require_subtitles: bool = False

@dataclass
class QAResult:
    passed: bool
    issues: list[str]        # Blocking issues — cause failure
    warnings: list[str]      # Non-blocking advisories
    video_duration: float
    file_size_mb: float
    checked_at: datetime

def run_qa(
    video_path: str,
    thumbnail_path: str,
    metadata: VideoMetadata,
    config: QAConfig
) -> QAResult:
    """Run all validation checks. Return QAResult."""

# Individual check functions:
def _check_video_duration(video_path: str, config: QAConfig) -> list[str]: ...
def _check_file_size(video_path: str, config: QAConfig) -> list[str]: ...
def _check_video_codec(video_path: str) -> list[str]: ...
def _check_audio_track(video_path: str, config: QAConfig) -> list[str]: ...
def _check_metadata_lengths(metadata: VideoMetadata, config: QAConfig) -> list[str]: ...
def _check_blacklisted_keywords(metadata: VideoMetadata, config: QAConfig) -> list[str]: ...
def _check_thumbnail_dimensions(thumbnail_path: str, config: QAConfig) -> list[str]: ...
```

**Full QA Checklist:**

| Check | Blocking? | Method |
|-------|-----------|--------|
| Video file exists | Yes | `os.path.exists` |
| Video is valid MP4 | Yes | `ffprobe` |
| Duration in bounds (3–15 min) | Yes | `ffprobe` |
| File size in bounds (1–256 MB) | Yes | `os.path.getsize` |
| Audio track present | Yes | `ffprobe streams` |
| Video codec is H.264 | Warning | `ffprobe codec_name` |
| Title ≤ 100 chars | Yes | `len(title)` |
| Title ≥ 20 chars | Warning | `len(title)` |
| Description ≤ 5000 chars | Yes | `len(description)` |
| Tags total ≤ 500 chars | Yes | `sum(len(t) for t in tags)` |
| No blacklisted keywords in title/desc | Yes | keyword scan |
| Thumbnail exists | Yes | `os.path.exists` |
| Thumbnail is 1280×720 | Yes | `Pillow Image.size` |
| AI disclosure in description | Warning | substring check |

---

### 3.9 `modules/uploader.py` — YouTube Upload Service

**Responsibility:** Authenticate and upload video with metadata to YouTube.

```python
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from google_auth_oauthlib.flow import InstalledAppFlow
from google.oauth2.credentials import Credentials

SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube"
]

def authenticate_youtube():
    """
    OAuth 2.0 flow.
    - Reads credentials.json (from Google Cloud Console)
    - Saves/loads token.json for subsequent runs
    - For CI/CD: reads token.json from environment variable or secrets
    Returns googleapiclient Resource.
    """

def upload_video(
    youtube_client,
    video_path: str,
    thumbnail_path: str,
    metadata: VideoMetadata,
    chunk_size_mb: int = 10
) -> str:
    """
    Resumable chunked upload.
    1. Call videos.insert with metadata
    2. Stream file in chunks (10MB default)
    3. If upload interrupted: resume from last byte
    4. After success: call thumbnails.set
    Returns youtube_video_id (str).
    """

def _build_video_body(metadata: VideoMetadata) -> dict:
    """Build YouTube API request body."""
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
        }
    }
```

**YouTube API Quota Tracking:**

```python
# Track daily unit consumption in Supabase
# youtube_api_quota table: date, units_used

UNIT_COSTS = {
    "videos.insert": 1600,
    "thumbnails.set": 50,
    "playlistItems.insert": 50,
}
DAILY_QUOTA_LIMIT = 10000
ALERT_THRESHOLD = 8000  # Alert at 80%

def check_quota_available(needed_units: int) -> bool:
    """Query today's usage; return True if units available."""

def record_api_usage(operation: str) -> None:
    """Increment daily unit counter in Supabase."""
```

---

### 3.10 `pipeline_runner.py` — Main Orchestrator

```python
def run_pipeline(
    topic: TopicItem,
    config: PipelineConfig
) -> PipelineResult:
    """
    Execute full pipeline for one topic.
    Each stage wrapped in try/except with retry logic.
    Updates topic status in Supabase after each stage.
    """
    result = PipelineResult(topic_id=topic.id)
    
    try:
        # Stage 1: Script
        update_stage(topic.id, "SCRIPTING")
        script = retry(generate_script, topic, config.script_style)
        
        # Stage 2: TTS
        update_stage(topic.id, "TTS_GENERATING")
        audio_path, duration = asyncio.run(generate_tts(script, config.tts_voice))
        
        # Stage 3: Media
        update_stage(topic.id, "MEDIA_FETCHING")
        media_assets = fetch_all_media(script, config)
        
        # Stage 4: Video Assembly
        update_stage(topic.id, "VIDEO_ASSEMBLING")
        video_path = assemble_video(script, audio_path, media_assets, config)
        
        # Stage 5: Thumbnail
        update_stage(topic.id, "THUMBNAIL_GEN")
        bg_image = media_assets[0].file_path if media_assets else None
        thumbnail_path = generate_thumbnail(script.title_suggestion, bg_image)
        
        # Stage 6: Metadata
        update_stage(topic.id, "METADATA_GEN")
        metadata = generate_metadata(script, media_assets)
        
        # Stage 7: QA
        update_stage(topic.id, "QA_CHECKING")
        qa_result = run_qa(video_path, thumbnail_path, metadata, config.qa)
        if not qa_result.passed:
            raise QAFailedError(qa_result.issues)
        
        # Stage 8: Upload
        update_stage(topic.id, "UPLOADING")
        youtube = authenticate_youtube()
        video_id = upload_video(youtube, video_path, thumbnail_path, metadata)
        
        # Finalize
        update_topic_status(topic.id, "done", youtube_video_id=video_id)
        result.success = True
        result.video_id = video_id
        send_telegram_alert("success", topic, video_id)
        
    except Exception as e:
        update_topic_status(topic.id, "failed", error_message=str(e))
        result.success = False
        result.error = str(e)
        send_telegram_alert("failure", topic, error=e)
    
    finally:
        log_pipeline_run(result)
        cleanup_temp_files(topic.id)  # Delete local output files
    
    return result
```

---

## 4. Database Schema

### 4.1 Supabase Tables (PostgreSQL)

```sql
-- Topic queue
CREATE TABLE topics (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       TEXT NOT NULL,
    keywords    TEXT[] DEFAULT '{}',
    niche       TEXT DEFAULT 'general_knowledge',
    status      TEXT DEFAULT 'queued'
                CHECK (status IN ('queued','in_progress','done','failed')),
    created_at  TIMESTAMPTZ DEFAULT now(),
    processed_at TIMESTAMPTZ,
    youtube_video_id TEXT,
    error_message TEXT,
    retry_count INT DEFAULT 0
);

CREATE INDEX idx_topics_status ON topics(status);

-- Pipeline run history
CREATE TABLE pipeline_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id        UUID REFERENCES topics(id) ON DELETE SET NULL,
    started_at      TIMESTAMPTZ DEFAULT now(),
    completed_at    TIMESTAMPTZ,
    status          TEXT CHECK (status IN ('running','success','failed','partial')),
    stage_reached   TEXT,   -- Last successfully completed stage
    stage_failed    TEXT,   -- Stage where failure occurred
    error_details   JSONB,
    video_duration_seconds FLOAT,
    file_size_mb    FLOAT,
    youtube_video_id TEXT,
    api_units_used  INT DEFAULT 0
);

CREATE INDEX idx_runs_status ON pipeline_runs(status);
CREATE INDEX idx_runs_started ON pipeline_runs(started_at);

-- YouTube API quota tracking
CREATE TABLE youtube_quota (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date        DATE DEFAULT CURRENT_DATE,
    units_used  INT DEFAULT 0,
    updated_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE(date)
);

-- Config key-value store (optional — for runtime config override)
CREATE TABLE config_overrides (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TIMESTAMPTZ DEFAULT now()
);
```

---

## 5. Configuration Schema

```yaml
# config.yaml — All runtime settings. Override via environment variables.

pipeline:
  target_video_duration_minutes: 5
  max_retries: 3
  retry_delay_base_seconds: 30    # Exponential: 30, 60, 120
  privacy_status: "public"        # public | unlisted | private
  review_before_upload: false     # If true: upload as unlisted; alert creator
  review_timeout_hours: 24        # Auto-publish if creator doesn't respond

content:
  niche: "general_knowledge"
  script_style: "educational"     # educational | listicle | explainer
  language: "en"
  min_script_words: 400
  max_script_words: 1200

ai:
  primary_provider: "gemini"      # gemini | groq
  gemini_model: "gemini-2.0-flash"
  groq_model: "llama-3.1-70b-versatile"
  temperature: 0.7
  max_output_tokens: 2048

tts:
  voice: "en-IN-NeerjaNeural"
  rate: "+0%"
  volume: "+0%"

media:
  prefer_video_clips: true
  fallback_to_images: true
  min_clip_duration_seconds: 5
  max_clip_duration_seconds: 30
  download_timeout_seconds: 30

video:
  resolution: "1920x1080"
  fps: 30
  codec: "libx264"
  audio_codec: "aac"
  background_music_volume: 0.20
  subtitle_enabled: true
  subtitle_font_size: 36
  subtitle_font_color: "white"

thumbnail:
  template: "bold_text"           # bold_text | split_layout | minimal
  font_path: "./assets/fonts/Montserrat-Bold.ttf"
  overlay_opacity: 0.55
  output_quality: 95

youtube:
  category_id: 27                 # 27 = Education
  default_language: "en"
  made_for_kids: false
  daily_quota_limit: 10000
  quota_alert_threshold: 8000

qa:
  min_duration_seconds: 180
  max_duration_seconds: 900
  max_file_size_mb: 256
  min_file_size_mb: 1.0
  blacklisted_keywords:
    - "violence"
    - "hate"
    - "spam"
    - "fake"
    - "scam"

notifications:
  telegram_enabled: true
  alert_on:
    - "failure"
    - "upload_success"
    - "quota_alert"
    - "queue_empty"
    - "weekly_summary"
  weekly_summary_day: "Sunday"
  weekly_summary_hour: 10         # 10 AM IST

cleanup:
  delete_local_files_after_upload: true
  keep_logs_days: 90
```

---

## 6. API Integrations

### 6.1 Google Gemini API

| Attribute | Value |
|-----------|-------|
| Endpoint | `generativelanguage.googleapis.com` |
| SDK | `google-generativeai` |
| Auth | API Key (env: `GEMINI_API_KEY`) |
| Model | `gemini-2.0-flash` |
| Free Limits | 15 RPM, 1,000 RPD, 1M TPD |
| Retry Strategy | 429 → wait 60s → retry |
| Used For | Script generation, metadata generation |

### 6.2 Groq API (Fallback)

| Attribute | Value |
|-----------|-------|
| SDK | `groq` |
| Auth | API Key (env: `GROQ_API_KEY`) |
| Model | `llama-3.1-70b-versatile` |
| Free Limits | 14,400 req/day, 6,000 TPM |
| Used For | Script fallback when Gemini unavailable |

### 6.3 Microsoft Edge-TTS

| Attribute | Value |
|-----------|-------|
| Library | `edge-tts` (Python package) |
| Auth | None required |
| Limits | None (uses Microsoft Azure under the hood but is free) |
| Output | MP3 files |
| Rate | ~1,000 chars/second; a 1,200-word script generates in ~5 seconds |

### 6.4 Pexels API

| Attribute | Value |
|-----------|-------|
| Endpoint | `api.pexels.com/videos/search` |
| Auth | API Key header: `Authorization: {PEXELS_API_KEY}` |
| Free Limits | 200 req/hour, 20,000 req/month |
| License | Pexels License (free for commercial use; attribution encouraged) |
| Required Credit | "Photo/Video by [Author] on Pexels" in description |

### 6.5 Pixabay API

| Attribute | Value |
|-----------|-------|
| Endpoint | `pixabay.com/api/` (images), `pixabay.com/api/videos/` |
| Auth | API Key in query param: `key={PIXABAY_API_KEY}` |
| Free Limits | No documented hard limit; reasonable use |
| License | Pixabay License (CC0, free for commercial use) |

### 6.6 YouTube Data API v3

| Attribute | Value |
|-----------|-------|
| SDK | `google-api-python-client` |
| Auth | OAuth 2.0 (user consent flow) |
| Daily Quota | 10,000 units/day (free) |
| Upload Cost | 1,600 units per `videos.insert` |
| Thumbnail Cost | 50 units per `thumbnails.set` |
| Max File Size | 256 GB (no practical concern) |
| Max Uploads/Day | ~6 (within 10,000 unit quota) |
| Quota Increase | Apply via Google Cloud Console (free approval) |

---

## 7. Security Design

### 7.1 Secret Management

```bash
# .env (NEVER commit to git)
GEMINI_API_KEY=AIzaSy...
GROQ_API_KEY=gsk_...
PEXELS_API_KEY=...
PIXABAY_API_KEY=...
SUPABASE_URL=https://...supabase.co
SUPABASE_KEY=eyJ...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...

# For CI/CD: Store all of the above as GitHub Actions Secrets
# Access in workflow: ${{ secrets.GEMINI_API_KEY }}
```

### 7.2 OAuth Token Handling for CI/CD

The YouTube OAuth token is the trickiest secret. It's a JSON file, not a simple string.

**Strategy:**
1. Run OAuth flow locally once → save `token.json`
2. Base64-encode: `base64 -i token.json | tr -d '\n'`
3. Store as `YOUTUBE_TOKEN_BASE64` GitHub Secret
4. In CI/CD workflow: decode back to file before running pipeline

```yaml
# In GitHub Actions workflow
- name: Restore YouTube OAuth token
  run: |
    echo "${{ secrets.YOUTUBE_TOKEN_BASE64 }}" | base64 --decode > token.json
```

**Note:** Refresh tokens expire if not used for 6 months. Schedule a test run at least monthly to keep token alive.

### 7.3 .gitignore Requirements

```gitignore
# Secrets
.env
credentials.json
token.json

# Generated output (large files)
output/
*.mp4
*.mp3
*.jpg
*.jpeg

# Python
__pycache__/
*.pyc
.venv/
```

### 7.4 Input Sanitization

```python
def sanitize_topic_title(title: str) -> str:
    """
    Remove potential prompt injection characters before using in AI prompts.
    Strip: <, >, {, }, \n in excess, special instruction-like patterns.
    Max length: 200 chars.
    """
    import re
    title = title.strip()[:200]
    title = re.sub(r'[<>{}]', '', title)
    return title
```

---

## 8. Infrastructure & Deployment

### 8.1 GitHub Actions (Recommended — Primary Trigger)

**File:** `.github/workflows/daily_video.yml`

```yaml
name: AutoTube Daily Video Pipeline

on:
  schedule:
    - cron: '30 23 * * *'  # 5:00 AM IST = 23:30 UTC previous day
  workflow_dispatch:         # Allow manual trigger

env:
  PYTHON_VERSION: '3.11'

jobs:
  generate-and-upload:
    runs-on: ubuntu-latest
    timeout-minutes: 45

    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Set Up Python
        uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}
          cache: 'pip'

      - name: Install System Dependencies
        run: |
          sudo apt-get update -qq
          sudo apt-get install -y ffmpeg
          ffmpeg -version

      - name: Install Python Dependencies
        run: pip install -r requirements.txt

      - name: Restore YouTube OAuth Token
        run: |
          echo "${{ secrets.YOUTUBE_TOKEN_BASE64 }}" | base64 --decode > token.json
          echo "Token restored successfully."

      - name: Run AutoTube Pipeline
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }}
          PEXELS_API_KEY: ${{ secrets.PEXELS_API_KEY }}
          PIXABAY_API_KEY: ${{ secrets.PIXABAY_API_KEY }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
          TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          TELEGRAM_CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}
        run: python pipeline_runner.py

      - name: Upload Run Log as Artifact
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: pipeline-log-${{ github.run_id }}
          path: output/logs/
          retention-days: 7
```

### 8.2 Local Development Setup

```bash
# Clone repo
git clone https://github.com/yourusername/autotube.git
cd autotube

# Create virtual environment
python -m venv .venv
source .venv/bin/activate       # Linux/Mac
# .venv\Scripts\activate        # Windows

# Install dependencies
pip install -r requirements.txt

# Install FFmpeg (Ubuntu/Debian)
sudo apt install ffmpeg

# Copy env template
cp .env.example .env
# Fill in your API keys in .env

# First-time YouTube OAuth setup
python setup/youtube_oauth.py
# This opens a browser; authorize; saves token.json

# Test script generation
python -m pytest tests/unit/test_scripter.py -v

# Run a dry-run pipeline (uploads as private)
python pipeline_runner.py --dry-run --privacy=private
```

### 8.3 Alternative Hosting: Railway.app (Free Tier)

If you want the pipeline to run hosted (not GitHub Actions):

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and create project
railway login
railway init

# Set environment variables
railway variables set GEMINI_API_KEY=... GROQ_API_KEY=...
# (set all secrets)

# Deploy
railway up

# Add cron via Railway cron syntax (in railway.json):
```

```json
{
  "build": { "builder": "nixpacks" },
  "deploy": {
    "startCommand": "python pipeline_runner.py",
    "cronSchedule": "30 23 * * *"
  }
}
```

---

## 9. Operational Runbook

### 9.1 Daily Monitoring Checklist

```
□ Check Telegram for overnight pipeline status
□ Review Supabase pipeline_runs: any failures?
□ Check youtube_quota table: units_used today < 8,000?
□ Verify topic queue has ≥ 7 days of topics
  → If < 7 topics: run topic_seeder.py to add new topics
□ Check published video (if any) for any content issues
□ Review GitHub Actions run logs if failure reported
```

### 9.2 Telegram Alert Formats

**Success Alert:**
```
✅ AutoTube: Video Published
━━━━━━━━━━━━━━━━━━━━━━━━
📌 Topic: Top 10 Facts About Mars
🎬 Title: "10 Incredible Facts About Mars That Will Shock You"
⏱ Duration: 5m 42s
📊 File Size: 67.3 MB
🔗 https://youtu.be/{video_id}
🕐 Published: 23 Jun 2026, 05:04 AM IST
```

**Failure Alert:**
```
🔴 AutoTube: Pipeline FAILED
━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 Topic: History of Ancient Egypt
❌ Stage: VIDEO_ASSEMBLING
🐛 Error: FFmpeg exited with code 1: codec libx264 not found
🔁 Retry: 3/3 (exhausted)
🕐 Time: 23 Jun 2026, 05:09 AM IST

Action needed: Check GitHub Actions logs → Run #4521
```

**Weekly Summary (Sunday):**
```
📊 AutoTube Weekly Report
━━━━━━━━━━━━━━━━━━━━━━━━
📅 Week: 16–22 Jun 2026
✅ Uploaded: 6 videos
❌ Failed: 1 (VIDEO_ASSEMBLING - FFmpeg)
📋 Queue: 12 topics remaining
📈 API Quota avg: 3,200 units/day (32% usage)

Top video: "10 Facts About Moon" — uploaded Jun 18
```

### 9.3 Retry & Error Classification

```python
# Transient errors — auto-retry with backoff
TRANSIENT_ERRORS = [
    "ConnectionTimeout",
    "ReadTimeout",
    "HTTPError 429",      # Rate limit
    "HTTPError 500",      # Server error
    "HTTPError 503",
    "TemporaryAPIError",
]

# Permanent errors — alert immediately, no retry
PERMANENT_ERRORS = [
    "HTTPError 401",      # Auth failed
    "HTTPError 403",      # Forbidden (quota exceeded, scope issue)
    "InvalidAPIKey",
    "QAFailedError",
    "FFmpegCodecError",   # Config issue
    "InvalidTopicError",
]

def classify_error(exc: Exception) -> str:
    error_str = str(type(exc).__name__)
    if any(e in error_str for e in TRANSIENT_ERRORS):
        return "transient"
    return "permanent"
```

### 9.4 Rollback Procedures

**Scenario: Bad video published publicly**
```python
# Immediately set to private via YouTube API
def set_video_private(youtube_client, video_id: str) -> bool:
    youtube_client.videos().update(
        part="status",
        body={"id": video_id, "status": {"privacyStatus": "private"}}
    ).execute()
```

**Scenario: Wrong config deployed**
```bash
# Revert config.yaml to last committed version
git checkout HEAD~1 -- config.yaml
# Run pipeline with reverted config
python pipeline_runner.py --config config.yaml
```

**Scenario: Supabase topics table corrupted**
```bash
# Restore from JSON backup (run weekly backup script)
python utils/backup_topics.py restore --file ./backups/topics_2026-06-20.json
```

**Scenario: YouTube token expired**
```bash
# Delete token.json and re-run OAuth
rm token.json
python setup/youtube_oauth.py
# Re-encode and update GitHub Secret
base64 -i token.json | tr -d '\n' | xclip  # copy to clipboard
# Paste into GitHub → Settings → Secrets → YOUTUBE_TOKEN_BASE64 → Update
```

---

## 10. Testing Strategy

### 10.1 Unit Tests

```
tests/unit/
├── test_sourcer.py         # Topic CRUD, RSS parsing, deduplication
├── test_scripter.py        # Script generation, JSON parsing, AI disclosure check
├── test_tts_engine.py      # Audio file generation, duration accuracy
├── test_media_fetcher.py   # API response parsing, download, fallback logic
├── test_assembler.py       # Assembly with mock media assets
├── test_thumbnail_gen.py   # Thumbnail dimensions, font rendering
├── test_metadata_gen.py    # Field lengths, attribution generation
├── test_qa_engine.py       # All QA checks with valid + invalid inputs
└── test_uploader.py        # Mock YouTube API responses, quota tracking
```

**Example Unit Test:**
```python
# tests/unit/test_qa_engine.py
import pytest
from modules.qa_engine import run_qa, QAConfig, QAResult

def test_qa_fails_on_short_video(tmp_video_3s):
    config = QAConfig(min_duration_seconds=180)
    result = run_qa(tmp_video_3s, "thumb.jpg", mock_metadata(), config)
    assert not result.passed
    assert any("duration" in issue.lower() for issue in result.issues)

def test_qa_blocks_blacklisted_keyword():
    config = QAConfig(blacklisted_keywords=["scam"])
    metadata = mock_metadata(title="Top Scam Techniques 2024")
    result = run_qa("valid_video.mp4", "thumb.jpg", metadata, config)
    assert not result.passed
    assert any("blacklist" in issue.lower() for issue in result.issues)

def test_qa_passes_valid_package(tmp_valid_video):
    config = QAConfig()
    result = run_qa(tmp_valid_video, "thumb.jpg", mock_metadata(), config)
    assert result.passed
    assert len(result.issues) == 0
```

### 10.2 Integration Tests

```python
# tests/integration/test_pipeline_integration.py
# Uses real API calls (except YouTube upload)

def test_script_to_audio_flow():
    """Integration: topic → script → audio file"""
    topic = TopicItem(id="test-001", title="Test: How Rain Forms", ...)
    script = generate_script(topic, style="educational")
    assert script.estimated_duration_seconds > 0
    audio_path, duration = asyncio.run(generate_tts(script))
    assert os.path.exists(audio_path)
    assert duration > 60

def test_media_fetch_flow():
    """Integration: visual_cue → downloaded media file"""
    assets = fetch_section_media("rain clouds forming", ["rain", "clouds"], 10)
    assert len(assets) > 0
    assert os.path.exists(assets[0].file_path)
```

### 10.3 End-to-End Dry Run

```python
# tests/e2e/test_full_pipeline.py
# Run weekly in CI; uploads as PRIVATE to avoid polluting channel

def test_full_pipeline_dry_run():
    """
    Full pipeline: topic → uploaded private YouTube video.
    Uses a test topic that won't be confused with real content.
    """
    topic = TopicItem(
        id="e2e-test-001",
        title="E2E Test Video — AutoTube Automated Test",
        keywords=["test", "automation"],
        niche="test"
    )
    
    result = run_pipeline(topic, override_privacy="private")
    
    assert result.success, f"Pipeline failed: {result.error}"
    assert result.video_id is not None
    assert result.video_id.startswith("https://") is False  # Should be video ID
    
    # Cleanup: delete test video
    delete_youtube_video(result.video_id)
```

---

## 11. Directory Structure

```
autotube/
│
├── .env.example                 # Template for environment variables
├── .gitignore                   # Excludes .env, credentials.json, token.json, output/
├── config.yaml                  # All runtime configuration
├── requirements.txt             # Python dependencies
├── README.md                    # Setup + usage documentation
│
├── pipeline_runner.py           # Main entry point — orchestrates all modules
│
├── modules/
│   ├── __init__.py
│   ├── sourcer.py               # Topic queue management
│   ├── scripter.py              # AI script generation
│   ├── tts_engine.py            # Text-to-speech
│   ├── media_fetcher.py         # Stock media download
│   ├── assembler.py             # FFmpeg/MoviePy video assembly
│   ├── thumbnail_gen.py         # Pillow thumbnail creation
│   ├── metadata_gen.py          # YouTube metadata generation
│   ├── qa_engine.py             # Quality assurance validation
│   └── uploader.py              # YouTube upload service
│
├── utils/
│   ├── __init__.py
│   ├── logger.py                # structlog setup; JSON logging
│   ├── alerts.py                # Telegram bot alert functions
│   ├── db.py                    # Supabase client singleton
│   ├── retry.py                 # Retry with exponential backoff
│   ├── config_loader.py         # YAML config + env var merger
│   └── backup_topics.py         # Weekly topic backup utility
│
├── setup/
│   ├── youtube_oauth.py         # First-time OAuth flow + token.json save
│   ├── test_apis.py             # Quick API connectivity test script
│   └── seed_topics.py           # Bulk-load topics into Supabase
│
├── assets/
│   ├── fonts/
│   │   └── Montserrat-Bold.ttf  # OFL licensed font for thumbnails
│   ├── music/
│   │   ├── ambient_01.mp3       # CC0 background music tracks
│   │   ├── ambient_02.mp3
│   │   └── README.txt           # Attribution + license info for each track
│   └── thumbnail_templates/
│       ├── bold_text.json       # Template config for Pillow
│       └── split_layout.json
│
├── data/
│   ├── topics.json              # Local fallback topic queue
│   ├── blacklist.txt            # One keyword per line
│   └── backups/                 # Weekly topic DB backups
│
├── output/                      # GITIGNORED — all generated files
│   ├── audio/
│   ├── media/
│   ├── video/
│   ├── thumbnails/
│   └── logs/
│
├── tests/
│   ├── unit/
│   │   ├── test_sourcer.py
│   │   ├── test_scripter.py
│   │   ├── test_tts_engine.py
│   │   ├── test_media_fetcher.py
│   │   ├── test_assembler.py
│   │   ├── test_thumbnail_gen.py
│   │   ├── test_metadata_gen.py
│   │   ├── test_qa_engine.py
│   │   └── test_uploader.py
│   ├── integration/
│   │   └── test_pipeline_integration.py
│   ├── e2e/
│   │   └── test_full_pipeline.py
│   └── conftest.py              # Shared test fixtures
│
└── .github/
    └── workflows/
        ├── daily_video.yml      # Main: cron-triggered pipeline
        ├── weekly_e2e.yml       # Weekly: full pipeline dry run
        └── tests.yml            # On push: run unit + integration tests
```

---

## 12. Dependencies (requirements.txt)

```txt
# ── AI / LLM ─────────────────────────────────────────────
google-generativeai>=0.8.0
groq>=0.11.0

# ── Text-to-Speech ────────────────────────────────────────
edge-tts>=6.1.0

# ── Video / Image Processing ──────────────────────────────
moviepy>=1.0.3
ffmpeg-python>=0.2.0
Pillow>=10.0.0

# ── YouTube API ───────────────────────────────────────────
google-api-python-client>=2.100.0
google-auth-oauthlib>=1.0.0
google-auth-httplib2>=0.1.0

# ── HTTP & APIs ───────────────────────────────────────────
requests>=2.31.0
httpx>=0.26.0

# ── Database (Supabase) ───────────────────────────────────
supabase>=2.0.0

# ── Scheduling ────────────────────────────────────────────
APScheduler>=3.10.0

# ── Configuration ─────────────────────────────────────────
python-dotenv>=1.0.0
PyYAML>=6.0

# ── Notifications ─────────────────────────────────────────
python-telegram-bot>=21.0

# ── Logging ───────────────────────────────────────────────
structlog>=24.0.0

# ── RSS Parsing (for optional topic ingestion) ────────────
feedparser>=6.0.0

# ── Utilities ─────────────────────────────────────────────
tqdm>=4.66.0
tenacity>=8.2.0          # Production-grade retry decorator

# ── Testing ───────────────────────────────────────────────
pytest>=8.0.0
pytest-asyncio>=0.23.0
pytest-mock>=3.12.0

# ── Dev Tools (not in production) ─────────────────────────
# black>=24.0.0
# ruff>=0.4.0
# ipython>=8.0.0
```

---

*Document ends. See AutoTube_PRD.md for product-level requirements, user stories, roadmap, and compliance rules.*
