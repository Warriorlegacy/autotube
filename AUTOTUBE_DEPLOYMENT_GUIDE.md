# AutoTube Deployment Guide

> Deploy your autonomous YouTube publishing pipeline — from local setup to production cron.

---

## 1. Architecture Overview

AutoTube is a **modular Python 3.11+ pipeline** orchestrated by `pipeline_runner.py`. Each stage of video production lives in its own module under `modules/`, with shared utilities in `utils/`.

```
┌─────────────┐    ┌──────────┐    ┌──────────┐    ┌──────────────┐
│  Topic Queue │ → │ Script AI │ → │  Edge-TTS │ → │ Media Fetcher │
│  (sourcer)   │    │ (scripter)│    │(tts_engine)│   │(media_fetcher)│
└─────────────┘    └──────────┘    └──────────┘    └──────────────┘
                                                         │
┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│   Uploader   │ ← │   QA Engine  │ ← │  Thumbnail AI │ ← │
│  (uploader)  │    │  (qa_engine) │    │(thumbnail_gen)│  │
└──────────────┘    └──────────────┘    └──────────────┘  │
       │                                                   │
       ▼                                                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Metadata AI │ ← │  Assembler   │ ← ─ ─ ─ ─ ─ ─ ─ ─ ┘
│(metadata_gen)│    │ (assembler)  │
└──────────────┘    └──────────────┘
```

**Key characteristics:**

- **Stateless at runtime** — each run fetches state from Supabase, executes, and writes results back.
- **Retry-safe** — exponential backoff with permanent vs. transient error classification.
- **Alert-native** — Telegram notifications for success, failure, quota warnings, and queue exhaustion.
- **Observable** — structured JSON logging per stage, persisted to Supabase.

---

## 2. Prerequisites

### System Requirements

| Dependency | Version | Purpose |
|-----------|---------|---------|
| Python | 3.11+ | Runtime |
| FFmpeg | 4.4+ | Video/audio assembly |
| Git | 2.30+ | Version control |
| GitHub account | — | CI/CD scheduling |

### External Services (all free-tier)

| Service | Purpose | Quota |
|---------|---------|-------|
| Google Gemini API | Script & metadata generation | 60 requests/min (free) |
| Groq | LLM fallback | 30 req/min (free) |
| Edge-TTS | Voice narration | Local (free) |
| Pexels | Stock video footage | 200 req/hr (free) |
| Pixabay | Media fallback | 500 req/hr (free) |
| Supabase | State & queue management | 500 MB DB, 1 GB storage (free) |
| Telegram Bot | Notifications | Unlimited (free) |
| YouTube Data API v3 | Upload & metadata | 10,000 units/day (free) |
| GitHub Actions | Scheduled execution | 2,000 min/month (free) |

---

## 3. Local Setup

### 3.1 Clone & Environment

```bash
git clone <repo-url>
cd Youtube-automation
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
```

### 3.2 Install FFmpeg

**Windows:** Download from https://ffmpeg.org/download.html and add to PATH.

**macOS:** `brew install ffmpeg`

**Linux (Ubuntu/Debian):** `sudo apt install ffmpeg`

Verify:

```bash
ffmpeg -version
```

### 3.3 Configuration

Copy the environment template and populate it:

```bash
cp .env.example .env
```

Required environment variables:

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Google Gemini API key |
| `GROQ_API_KEY` | Groq API key (fallback) |
| `PEXELS_API_KEY` | Pexels API key |
| `PIXABAY_API_KEY` | Pixabay API key |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Supabase service role key |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token |
| `TELEGRAM_CHAT_ID` | Telegram chat ID for alerts |
| `YOUTUBE_TOKEN_BASE64` | Base64-encoded YouTube OAuth token.json |

### 3.4 YouTube OAuth Setup

Run the interactive OAuth flow to generate your token:

```bash
python setup/youtube_oauth.py
```

This will:
1. Open a browser for Google account authorization
2. Save `token.json` to `config/`
3. Output the base64-encoded version for use in CI/CD

Encode the token for GitHub Secrets:

```bash
# Windows PowerShell
$base64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes("config\token.json"))
Write-Output $base64

# macOS / Linux
base64 -i config/token.json | pbcopy
```

### 3.5 Supabase Schema Setup

Create the following tables in your Supabase project:

#### `topics` — Video topic queue

```sql
CREATE TABLE topics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  topic TEXT NOT NULL,
  niche TEXT NOT NULL DEFAULT 'general',
  source TEXT DEFAULT 'manual',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','processing','done','failed')),
  priority INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);
```

#### `pipeline_runs` — Run history

```sql
CREATE TABLE pipeline_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  topic_id UUID REFERENCES topics(id),
  status TEXT DEFAULT 'running' CHECK (status IN ('running','completed','failed')),
  stages_completed JSONB DEFAULT '[]',
  output_video_url TEXT,
  youtube_video_id TEXT,
  error TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_seconds FLOAT,
  logs JSONB DEFAULT '[]'
);
```

#### `youtube_quota` — API unit tracking

```sql
CREATE TABLE youtube_quota (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE DEFAULT CURRENT_DATE,
  units_used INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(date)
);
```

### 3.6 Seed Topic Queue

Populate initial topics to process:

```bash
python setup/seed_topics.py
```

This adds 20 sample topics covering technology, science, and business niches.

### 3.7 Run Tests

```bash
pytest tests/ -v
```

Expected: all 15+ test files pass (unit tests for every module + conftest fixtures).

### 3.8 Local Dry Run

```bash
python pipeline_runner.py --dry-run
```

This runs the full pipeline except the upload stage. Verify log output, generated video in `output/`, and Supabase state updates.

---

## 4. GitHub Actions Deployment

### 4.1 Required Secrets

Add these to your repository: **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Value |
|--------|-------|
| `GEMINI_API_KEY` | Your Gemini API key |
| `GROQ_API_KEY` | Your Groq API key |
| `PEXELS_API_KEY` | Your Pexels API key |
| `PIXABAY_API_KEY` | Your Pixabay API key |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_KEY` | Your Supabase service role key |
| `TELEGRAM_BOT_TOKEN` | Your Telegram bot token |
| `TELEGRAM_CHAT_ID` | Your Telegram chat ID |
| `YOUTUBE_TOKEN_BASE64` | Base64-encoded YouTube OAuth token |

### 4.2 Workflow Files

Three workflows are provided in `.github/workflows/`:

#### `daily_video.yml` — Production Schedule

- **Trigger:** Cron at 5:00 AM IST every day (`0 23 * * *` UTC)
- **Actions:** Checks out repo, sets up Python 3.11, installs FFmpeg, restores OAuth token, runs `pipeline_runner.py`, uploads logs as artifact
- **Manual trigger:** `workflow_dispatch` for on-demand runs

#### `tests.yml` — CI on Push

- **Trigger:** Push to `main`, any pull request
- **Actions:** Runs `pytest tests/ -v` and flake8 linting

#### `weekly_e2e.yml` — Weekly Dry Run (Sunday)

- **Trigger:** Cron at 6:00 AM IST every Sunday
- **Actions:** Runs pipeline with `--dry-run` flag, logs artifacts

### 4.3 Activation Steps

```bash
git add .github/workflows/
git commit -m "Add GitHub Actions workflows"
git push origin main
```

Verify the workflows appear in your repository's **Actions** tab.

---

## 5. First Run Checklist

Before enabling the production cron, verify each link in the chain:

- [ ] **Topic data** exists in Supabase `topics` table (run `seed_topics.py` or add manually)
- [ ] **All secrets** resolve in GitHub Actions (verify via a manual `workflow_dispatch` run)
- [ ] **Supabase connectivity** — pipeline reads/writes topic and run state correctly
- [ ] **YouTube OAuth** — token is authorized and non-expired
- [ ] **Script generation** — Gemini/Groq produces valid JSON script output
- [ ] **TTS synthesis** — Edge-TTS generates audio file for the script
- [ ] **Media fetching** — Pexels/Pixabay return clips for keywords
- [ ] **Video assembly** — FFmpeg produces a playable MP4 with audio
- [ ] **Thumbnail** — Pillow generates a 1280×720 PNG
- [ ] **Metadata** — AI writes title, description, tags, AI disclosure
- [ ] **QA pass** — All 14 checks pass (duration, codec, size, etc.)
- [ ] **Upload gate** — Pipeline attempts YouTube upload (verify in dry-run mode first)

---

## 6. Operational Safety

### Upload Mode

The pipeline supports two upload modes in `config.yaml`:

```yaml
upload:
  visibility: unlisted   # "unlisted" for review gate, "public" for direct publish
```

Start with `unlisted` to add a human review layer before videos go public.

### QA Gates

The QA engine runs 14 validations before upload. If any check fails, the pipeline logs the failure, sends a Telegram alert, and aborts the upload. Checks include:

- Video duration (configurable min/max)
- File size limits
- Codec compatibility
- Audio track presence
- Thumbnail dimensions (1280×720)
- Metadata length limits (title: 100 chars, description: 5000 chars)
- Keyword blacklist enforcement
- AI disclosure presence warning

### Content Guardrails

- **Keyword blacklist** in `config.yaml` prevents prohibited terms in scripts and metadata
- **AI disclosure** is automatically appended to every video description
- **Attribution** for stock assets is auto-generated
- **Niche orientation** — designed for educational, technology, and factual content

### Error Classification

The retry utility (`utils/retry.py`) classifies errors as:

| Type | Behavior | Examples |
|------|----------|---------|
| **Transient** | Retry with exponential backoff (max 3 attempts) | Network timeouts, rate limits, API 503 |
| **Permanent** | Abort immediately, alert via Telegram | Auth failures, invalid config, quota exhausted |

---

## 7. Monitoring and Alerts

### Telegram Bot

Set up alerts by creating a bot via [@BotFather](https://t.me/BotFather) and configuring:

```yaml
alerts:
  telegram:
    on_success: true
    on_failure: true
    on_quota_warning: true
    on_queue_empty: true
    weekly_summary: true
```

Alert types delivered:
- **Pipeline success** — video ID, duration, stages completed
- **Pipeline failure** — error message, failed stage, log excerpt
- **Quota warning** — YouTube API units remaining
- **Queue empty** — no topics to process (reminder to seed)
- **Weekly summary** — total runs, success rate, videos published

### Structured Logging

All logs use structlog with JSON formatting, written to:

- `logs/pipeline_{run_id}.json` — per-run log file
- `logs/pipeline.log` — rotating combined log
- Supabase `pipeline_runs.logs` column — persistent storage

---

## 8. Rollback Plan

| Scenario | Action |
|----------|--------|
| **Config error** | Revert `config.yaml` to last known-good version |
| **OAuth token expired** | Re-run `python setup/youtube_oauth.py`, re-encode for GitHub Secret |
| **Supabase data corruption** | Restore from `data/backups/` or Supabase point-in-time recovery |
| **Broken deployment** | `git revert` the offending commit, push to main |
| **Pipeline hang** | GitHub Actions has a 6-hour timeout; cancel and restart |

### Backup Topics

The `utils/backup_topics.py` script saves topic queue snapshots:

```bash
python utils/backup_topics.py
```

Backups are stored in `data/backups/topics_{date}.json`.

---

## 9. Scaling Notes

### Current Free-Tier Limits

| Resource | Limit | Monitor |
|----------|-------|---------|
| YouTube API | 10,000 units/day (~10 uploads) | Quota table in Supabase |
| GitHub Actions | 2,000 min/month (~66 daily runs) | Action billing page |
| Supabase DB | 500 MB | Database usage in dashboard |
| Gemini | 60 requests/min | Usage quotas in Google AI Studio |

### Upgrade Paths

When you exceed free-tier limits:

1. **YouTube quota** → Request quota increase via Google API Console
2. **GitHub Actions** → Move to self-hosted runner or dedicated CI
3. **Supabase** → Upgrade to Pro plan ($25/month)
4. **Voice quality** → Switch to ElevenLabs or Azure TTS (paid tiers)

### Multi-Channel Operation

The pipeline can be extended to support multiple YouTube channels by:

1. Maintaining separate `token.json` per channel
2. Adding a `channel` column to the topics table
3. Running parallel workflow instances with different secrets

---

## 10. Recommended Deployment Sequence

```
Step 1  →  Clone repo & create virtual environment
Step 2  →  Install FFmpeg & Python dependencies
Step 3  →  Configure .env, config.yaml
Step 4  →  Run YouTube OAuth setup
Step 5  →  Create Supabase tables
Step 6  →  Run tests: pytest tests/ -v
Step 7  →  Seed topics: python setup/seed_topics.py
Step 8  →  Set all GitHub Secrets
Step 9  →  Push GitHub Actions workflows
Step 10 →  Run manual workflow_dispatch (dry-run)
Step 11 →  Verify output in Actions log + Supabase
Step 12 →  Enable cron schedule
Step 13 →  Monitor Telegram alerts for first week
```

---

## 11. File Reference

### Core Pipeline

| File | Purpose |
|------|---------|
| `pipeline_runner.py` | Orchestrator — runs all 10 stages |
| `config.yaml` | Runtime configuration |
| `.env` | Local environment variables (gitignored) |
| `requirements.txt` | Python dependencies |

### Modules (`modules/`)

| Module | Stage | Key Dependencies |
|--------|-------|-----------------|
| `sourcer.py` | Topic ingestion | Supabase, feedparser |
| `scripter.py` | Script generation | Gemini API, Groq |
| `tts_engine.py` | Voice synthesis | Edge-TTS |
| `media_fetcher.py` | Stock media | Pexels, Pixabay APIs |
| `assembler.py` | Video assembly | FFmpeg, MoviePy |
| `thumbnail_gen.py` | Thumbnail design | Pillow |
| `metadata_gen.py` | SEO metadata | Gemini API |
| `qa_engine.py` | Quality validation | FFprobe |
| `uploader.py` | YouTube upload | YouTube Data API v3 |

### Utilities (`utils/`)

| File | Purpose |
|------|---------|
| `config_loader.py` | YAML + env merging |
| `logger.py` | Structlog configuration |
| `db.py` | Supabase CRUD operations |
| `retry.py` | Exponential backoff retry |
| `alerts.py` | Telegram notification dispatch |
| `backup_topics.py` | Topic queue backup |

### Setup (`setup/`)

| File | Purpose |
|------|---------|
| `youtube_oauth.py` | OAuth token generation |
| `seed_topics.py` | Sample topic seeding |
| `test_apis.py` | External API connectivity test |
| `download_font.py` | Montserrat Bold font download |

---

## 12. Troubleshooting

### Pipeline fails at script generation

- Verify `GEMINI_API_KEY` is set and valid
- Check Gemini API quota (60 req/min free tier)
- Ensure script topic is not empty or malformed

### FFmpeg errors during assembly

- Confirm FFmpeg is installed: `ffmpeg -version`
- Check input media files exist in `output/media/`
- Verify audio file was generated by TTS stage

### Upload fails

- Confirm YouTube OAuth token is valid (re-run `youtube_oauth.py` if expired)
- Check daily quota in `youtube_quota` table
- Verify video codec is H.264 and container is MP4

### Supabase connection errors

- Verify `SUPABASE_URL` and `SUPABASE_KEY` are correct
- Check network access (Supabase project may have IP restrictions)
- Confirm tables exist with correct schema

---

> **AutoTube** — Your YouTube channel. Running itself.
