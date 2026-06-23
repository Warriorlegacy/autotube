# AutoTube Platform — Product Requirements Document (PRD)

**Version:** 1.0 MVP  
**Date:** June 2026  
**Author:** Golu (Piyush Raj Singh)  
**Status:** Draft — In Review  

---

## Table of Contents

1. [Executive Summary & Objective](#1-executive-summary--objective)
2. [Success Metrics](#2-success-metrics)
3. [Stakeholders & User Stories](#3-stakeholders--user-stories)
4. [Features & Scope (MVP)](#4-features--scope-mvp)
5. [Non-Goals](#5-non-goals)
6. [Data Flows & Architecture Overview](#6-data-flows--architecture-overview)
7. [Compliance & Policy Constraints](#7-compliance--policy-constraints)
8. [Non-Functional Requirements](#8-non-functional-requirements)
9. [MVP Roadmap & Milestones](#9-mvp-roadmap--milestones)
10. [Risk Assessment & Mitigations](#10-risk-assessment--mitigations)
11. [Cost Boundary Analysis — What "Free" Means](#11-cost-boundary-analysis--what-free-means)

---

## 1. Executive Summary & Objective

### 1.1 Vision

AutoTube is a zero-cost, fully autonomous pipeline that — after initial setup — sources content topics, writes scripts, synthesizes voice-over, assembles video footage, creates thumbnails, generates SEO metadata, and uploads finished videos to YouTube on a configurable schedule. No manual intervention is required per-video once the system is running.

### 1.2 Problem Statement

Running a consistent YouTube channel requires significant repetitive effort: researching topics, writing scripts, recording or editing footage, uploading, and filling in metadata. For a solo creator or developer launching a content side-project, this bottleneck prevents scale. AutoTube removes every step of that loop.

### 1.3 Primary Objective

Enable a solo creator to maintain a consistent YouTube posting cadence (1–5 videos/day) across a niche channel — operating entirely on free-tier APIs and services — with the creator spending < 30 minutes/week on oversight.

### 1.4 Target Niches (Low Policy Risk, High Automation Fit)

These niches work well because they rely on factual, scriptable content with abundant royalty-free visuals:

- General Knowledge / Trivia ("Top 10 Facts About...")
- Educational Explainers ("How Does X Work?")
- History Summaries
- Technology Overviews
- Current Affairs Summaries (with proper attribution)
- Government Exam Tips & Study Content

---

## 2. Success Metrics

| Metric | MVP Target (Weeks 1–8) | Phase 2 Target (Months 3–6) |
|--------|------------------------|------------------------------|
| Video generation time | < 20 minutes/video | < 10 minutes/video |
| Upload success rate | ≥ 90% | ≥ 98% |
| Pipeline uptime | ≥ 95% | ≥ 99% |
| YouTube copyright strikes | 0 | 0 |
| Content policy violations | 0 | 0 |
| Monthly cost | ₹0 | < ₹500 |
| Videos published/week | 3–5 | 10–20 |
| Creator oversight time/week | < 30 min | < 15 min |
| Internal QA pass rate | ≥ 85% | ≥ 95% |
| Pipeline failure → alert time | < 5 minutes | < 2 minutes |

---

## 3. Stakeholders & User Stories

### 3.1 Stakeholders

| Stakeholder | Role | Interest |
|-------------|------|----------|
| Content Creator (Golu) | Primary User | Topic strategy, quality oversight, monetization |
| AutoTube Pipeline | System Agent | Autonomous execution |
| YouTube Platform | External Dependency | Compliance, upload target |
| Viewers | End Consumer | Useful, watchable content |

### 3.2 User Stories

#### Content Creator Stories

**US-01 — Topic Queue Setup**  
*As a creator, I want to preload a list of topics so the system generates videos without needing my daily input.*  
Acceptance: System reads from a JSON/DB topic queue; picks next available topic; marks it in-progress.

**US-02 — Hands-Off Production**  
*As a creator, I want the system to auto-generate script, voice-over, and assembled video so I spend zero time in production.*  
Acceptance: Full pipeline (script → audio → video) completes without manual steps.

**US-03 — SEO-Ready Metadata**  
*As a creator, I want AI-generated titles, descriptions, and tags so my videos are discoverable from day one.*  
Acceptance: Metadata generated with target keywords; title ≤ 100 chars; description includes attribution + AI disclosure.

**US-04 — Auto-Scheduling**  
*As a creator, I want videos uploaded on a schedule (e.g., daily at 8 AM IST) so my channel looks consistent.*  
Acceptance: Scheduler triggers pipeline at configured time; video published at target time.

**US-05 — Failure Alerts**  
*As a creator, I want an instant Telegram/email alert when something breaks so I can intervene before a day's upload is missed.*  
Acceptance: Alert fires within 5 minutes of pipeline failure, naming the failed stage and error.

**US-06 — Optional Human Review Gate**  
*As a creator, I want to optionally review a video before it goes public so I can catch quality issues.*  
Acceptance: `review_before_upload: true` config flag; system uploads as `unlisted` and alerts creator; waits for manual approval or auto-publishes after N hours.

**US-07 — Topic Queue Dashboard**  
*As a creator, I want to see topic queue status (queued, processing, done, failed) so I know when to add more topics.*  
Acceptance: Simple Supabase-backed status view or weekly summary Telegram message.

#### Operations Stories

**US-08 — Structured Logging**  
*As an ops user, I want every pipeline run logged with stage-level detail so I can diagnose any failure.*  
Acceptance: JSON log entry per run covering stage, timestamp, duration, error (if any), and YouTube video ID (if success).

**US-09 — Auto-Retry**  
*As an ops user, I want transient failures automatically retried (max 3x with backoff) so minor outages don't miss the upload schedule.*  
Acceptance: Retry logic with exponential backoff on all stages; permanent errors alert immediately.

---

## 4. Features & Scope (MVP)

### 4.1 Feature Modules

#### F-01: Content Sourcing Module
- **Topic Queue:** JSON/CSV-based topic list (local) + Supabase `topics` table (cloud)
- **Status Tracking:** Each topic tagged: `queued → in_progress → done | failed`
- **Optional RSS Ingestion:** Ingest new topics from RSS feeds (news sites, blogs)
- **Deduplication:** Prevent same topic from being processed twice

#### F-02: Script Generation Module
- AI-generated script (hook + 3–5 body sections + CTA/outro) using Gemini Flash or Groq
- Configurable style: `educational`, `listicle`, `explainer`
- Target script length: 400–1,200 words (maps to 3–8 minute video)
- Structured output: JSON with `sections`, `visual_cues`, and `estimated_duration`
- Mandatory AI disclosure sentence in outro

#### F-03: Text-to-Speech (TTS) Module
- Primary: Microsoft Edge-TTS (free, no key needed, high quality)
- Fallback: Google Cloud TTS (free tier: 1M chars/month)
- Voice options: Indian English (`en-IN-NeerjaNeural`), US English, British English
- Output: MP3 file with calculated duration

#### F-04: Video Assembly Module
- **Stock B-Roll:** Pexels Videos API + Pixabay Videos API (CC0, free with attribution)
- **Image Fallback:** Stock images with Ken Burns effect (zoom/pan via FFmpeg)
- **Subtitles:** Auto-generated SRT from script, overlaid on video
- **Background Music:** YouTube Audio Library tracks or Pixabay Music (CC0)
- **Render:** 1080p 30fps MP4 via FFmpeg + MoviePy

#### F-05: Thumbnail Generation Module
- Pillow-based template system (1280×720 JPEG)
- Text overlay: Bold title on contrasting background
- Templates: `bold_text`, `split_layout`, `minimal`
- Font: Montserrat Bold (Google Fonts, OFL licensed)
- Background: Fetched from same stock image APIs

#### F-06: Metadata Generation Module
- AI-generated title (max 100 chars), description (max 5,000 chars), tags
- SEO keyword integration from topic keywords
- Auto-generated hashtags
- Attribution block for stock media and music
- AI content disclosure (per YouTube 2024 policy)

#### F-07: Upload Service
- YouTube Data API v3 integration
- OAuth 2.0 authentication with token caching
- Resumable chunked upload for large files
- Sets: visibility, category, language, made-for-kids flag
- Thumbnail upload (requires channel verification)
- Retry on quota errors: pause + resume next day

#### F-08: Scheduler
- Primary: GitHub Actions cron (most reliable free option)
- Secondary: APScheduler (when running hosted)
- Configurable upload time per channel
- Queue management: skip if no topics available; alert creator

#### F-09: QA Engine
- Duration check: 3–15 minutes
- File format and codec validation
- File size check: < 256 MB
- Title/description length validation
- Keyword blacklist pre-check (configurable list)
- Thumbnail dimension check (1280×720)
- Audio track presence verification
- Retry logic: max 3 attempts per failed stage

#### F-10: Monitoring & Alerting
- Structured JSON logging (structlog) per run
- Telegram Bot notifications (failure, success, weekly summary)
- Optional: Email alerts via Gmail SMTP (free)
- Run history stored in Supabase `pipeline_runs` table
- Weekly automated summary: videos published, failures, queue status

---

## 5. Non-Goals

The following are explicitly out of scope for MVP. Each represents a meaningful complexity increase that should only be tackled post-validation.

| Non-Goal | Reason Deferred |
|----------|----------------|
| Multi-channel management UI | Adds auth/UX complexity; not needed for 1 channel MVP |
| YouTube Shorts automation | Different aspect ratio, algorithm, and editing logic |
| Live streaming | Entirely different infrastructure; high policy risk |
| AI avatar / talking-head videos | Deepfake policy risk; requires significant compute |
| Revenue analytics / AdSense tracking | No YouTube Partner API access at early stage |
| Social media cross-posting | Out of scope for v1; different APIs per platform |
| Multi-language support | Adds translation + TTS complexity |
| Paid AI image generation | Contradicts zero-cost constraint |
| Comments / community management | Different risk surface; requires moderation logic |
| A/B testing framework | Needs analytics infrastructure first |
| Auto-responding to copyright claims | Requires legal/manual review |

---

## 6. Data Flows & Architecture Overview

### 6.1 High-Level Pipeline Flow

```
[Topic Queue]
     │
     ▼
[Script Generator] ──── Gemini Flash / Groq API
     │
     ▼
[TTS Engine] ──────────── Edge-TTS (Microsoft)
     │
     ▼
[Media Fetcher] ────────── Pexels API + Pixabay API
     │
     ▼
[Video Assembler] ──────── FFmpeg + MoviePy
     │
     ▼
[Thumbnail Generator] ──── Pillow
     │
     ▼
[Metadata Generator] ───── Gemini Flash API
     │
     ▼
[QA Engine]
     │ PASS                 │ FAIL (retry)
     ▼                      ▼
[Upload Service] ──────── YouTube Data API v3
     │
     ▼
[Monitor / Alerting] ───── Telegram Bot
     │
     ▼
[Supabase — State Update]
```

### 6.2 State Machine

Each video job moves through these states in order:

```
QUEUED → SCRIPTING → TTS_GENERATING → MEDIA_FETCHING →
VIDEO_ASSEMBLING → THUMBNAIL_GEN → METADATA_GEN →
QA_CHECKING → UPLOADING → COMPLETED

         (any stage can transition to)→ FAILED → (requeue or alert)
```

### 6.3 Deployment Model (MVP)

```
GitHub Actions (cron trigger)
         │
         ▼
Ubuntu Runner (free, 2,000 min/month)
  ├── pulls repo
  ├── installs dependencies
  ├── runs pipeline_runner.py
  └── writes logs to Supabase
         │
         ▼
    [YouTube Channel]    [Telegram Bot]    [Supabase DB]
```

---

## 7. Compliance & Policy Constraints

### 7.1 YouTube Terms of Service

| Requirement | Implementation |
|-------------|---------------|
| No artificial engagement | Pipeline never calls engagement APIs |
| Content must be original/licensed | CC0-only media; AI-generated script |
| AI content disclosure required (2024+) | Mandatory outro sentence + description tag |
| No misleading thumbnails/titles | QA blacklist; AI generates factual metadata |
| No spam or low-effort content | Script has min word count + QA duration check |
| Comply with Community Guidelines | Keyword blacklist; niche selection (educational) |

### 7.2 Copyright & Licensing

- **All stock footage/images:** Pexels (CC0) and Pixabay (CC0) — free to use commercially with attribution
- **Background music:** YouTube Audio Library (royalty-free for YouTube) or Pixabay Music (CC0)
- **Fonts:** Montserrat (SIL Open Font License) — safe for commercial use
- **Attribution:** All CC-BY and credited sources listed in video description automatically
- **Prohibition:** No copyrighted clips, music, logos, or brand assets — ever

### 7.3 API Usage Compliance

| API | Key Constraint |
|-----|---------------|
| YouTube Data API v3 | 10,000 units/day; do not exceed; implement daily tracking |
| Gemini API | Free tier rate limits (15 RPM, 1M TPD for Flash) |
| Pexels API | Attribution required; no redistribution of raw API responses |
| Pixabay API | Attribution required; no mass-download beyond project needs |
| Edge-TTS | Do not use for politically sensitive or misleading content |

### 7.4 Content Safety Policy

- **Target niches are low-risk by design** (education, history, facts)
- **Keyword blacklist** screens every generated script and metadata before upload
- **No personal identifiable information** included in any video
- **No opinion-as-fact** — scripts always framed as informational
- **Misinformation prevention** — scripts grounded on AI knowledge; high-risk factual claims should flag for human review

### 7.5 Ethical Use Statement

AutoTube is designed for legitimate content creation. It must never be used to:
- Generate fake news or politically manipulative content
- Impersonate real individuals or organizations
- Spam YouTube with low-quality content to game algorithms
- Circumvent YouTube's spam detection systems

---

## 8. Non-Functional Requirements

| Category | Requirement | Detail |
|----------|-------------|--------|
| **Performance** | Full pipeline < 20 min/video | Bottleneck: FFmpeg render; optimize with hardware accel if available |
| **Reliability** | Auto-retry on transient failures | Exponential backoff; max 3 retries per stage |
| **Scalability** | 1–5 videos/day MVP; 10+ videos/day Phase 2 | Stateless pipeline; easily parallelized |
| **Observability** | JSON-structured logs per run | Stage, timestamp, duration, error, video ID |
| **Alerting** | < 5 min failure notification | Telegram Bot; include stage name + error message |
| **Cost** | ₹0/month MVP | All free-tier services; documented limits |
| **Security** | API keys never in code or logs | `.env` + GitHub Secrets; token.json gitignored |
| **Maintainability** | Config-driven; modular | YAML config; each module independently testable |
| **Rate Limit Compliance** | Respect all API quotas | YouTube unit tracker; backoff on 429/403 |
| **Storage** | < 500 MB Supabase free tier | Purge local output files after upload |

---

## 9. MVP Roadmap & Milestones

### Phase 1 — Foundation (Weeks 1–2)

**Goal:** Script generation from a topic.

| Task | Owner | Done When |
|------|-------|-----------|
| Project repo setup (structure, venv, config schema) | Dev | Repo created with all folders; config.yaml loads |
| Content Sourcer: JSON topic queue CRUD | Dev | Can read/write topic status from topics.json |
| Supabase schema setup (topics, pipeline_runs) | Dev | Tables created; Python client connects |
| Script Generator: Gemini Flash integration | Dev | Given a topic, returns structured VideoScript JSON |
| Script Generator: Groq fallback | Dev | If Gemini fails/rate-limits, Groq generates script |
| TTS Module: Edge-TTS integration | Dev | Given script text, returns MP3 file with correct duration |

**✅ Phase 1 Success Criteria:** Input topic → output validated script JSON + MP3 audio file.

---

### Phase 2 — Video Production (Weeks 3–4)

**Goal:** Full video assembly from script + audio.

| Task | Owner | Done When |
|------|-------|-----------|
| Media Fetcher: Pexels API integration | Dev | Returns downloaded CC0 clips for given keywords |
| Media Fetcher: Pixabay fallback | Dev | Falls back to Pixabay images when no video clips |
| Video Assembler: FFmpeg + MoviePy pipeline | Dev | 1080p MP4 assembled with audio + B-roll + subtitles |
| Video Assembler: Background music overlay | Dev | CC0 music at 20% volume mixed in |
| Thumbnail Generator: Pillow template | Dev | 1280×720 JPEG with title text overlay |
| Metadata Generator: Gemini API | Dev | Returns title, description, tags JSON |

**✅ Phase 2 Success Criteria:** Input topic → output MP4 + thumbnail JPEG + metadata JSON, ready for upload.

---

### Phase 3 — Upload & Schedule (Weeks 5–6)

**Goal:** Autonomous upload on schedule.

| Task | Owner | Done When |
|------|-------|-----------|
| YouTube OAuth 2.0 setup | Dev | credentials.json working; token cached |
| Upload Service: videos.insert | Dev | Video uploads successfully with metadata |
| Upload Service: thumbnails.set | Dev | Custom thumbnail attached |
| QA Engine: all validation checks | Dev | Passes/fails with detailed issues list |
| Scheduler: GitHub Actions cron | Dev | Pipeline triggers daily at configured time |
| Retry logic: exponential backoff | Dev | Transient failures auto-retry up to 3x |

**✅ Phase 3 Success Criteria:** Pipeline runs autonomously on schedule; video published to YouTube channel.

---

### Phase 4 — Ops & Hardening (Weeks 7–8)

**Goal:** Reliable, observable, long-running system.

| Task | Owner | Done When |
|------|-------|-----------|
| Structured logging (structlog) | Dev | JSON logs per run in Supabase pipeline_runs |
| Telegram Bot alerting | Dev | Alerts fire within 5 min on failure or success |
| Weekly summary message | Dev | Every Sunday: summary of week's uploads + failures |
| YouTube API quota tracker | Dev | Daily unit count tracked; alert at 80% usage |
| Error handling audit | Dev | All exception types handled; no silent failures |
| Documentation + runbook | Dev | README + operational runbook complete |
| 7-day autonomous run | Dev | Pipeline runs 7 days straight with < 2 failures |

**✅ Phase 4 Success Criteria:** Platform operates autonomously for 7 days; < 2 pipeline failures; all failures alerted within 5 minutes.

---

## 10. Risk Assessment & Mitigations

| Risk | Likelihood | Impact | Mitigation Strategy |
|------|:----------:|:------:|---------------------|
| YouTube channel strike or termination | Medium | Critical | Strict content policy + QA; AI disclosure; CC0-only media; start with unlisted uploads for first 2 weeks |
| YouTube API daily quota exhausted | Medium | High | Track units per run; enforce hard limit at 8,000/day; pause uploads + retry next day |
| Gemini/Groq rate limit hit mid-run | High | Medium | Exponential backoff; fallback between providers; queue retry for next cycle |
| Video quality too low (viewer complaints) | High | Medium | Internal QA score; min duration check; A/B test thumbnail/title styles |
| Background music copyright claim | Medium | High | Only YouTube Audio Library or CC0 Pixabay Music; avoid trending audio |
| Pexels/Pixabay clips irrelevant to topic | High | Low | Multiple search keyword queries; image fallback with Ken Burns effect |
| GitHub Actions free minutes exhausted | Low | Medium | 2,000 min/month; pipeline takes ~15 min → ~130 runs free; well within limit |
| Google ToS / YouTube policy change | Low | High | Monitor policy updates quarterly; subscribe to YouTube Creator Blog |
| Token expiry breaks OAuth silently | Medium | Medium | Refresh token monitoring; alert if token refresh fails |
| Supabase free tier limit hit | Low | Low | 500MB DB / 1GB storage; purge logs older than 90 days; move old data to JSON file |
| FFmpeg codec unavailable on runner | Low | Medium | Pin FFmpeg version in CI/CD; test codec availability in setup step |

---

## 11. Cost Boundary Analysis — What "Free" Means

### 11.1 Free Tier Stack (Target: ₹0/month)

| Service | Free Tier Limit | Used For | Risk of Hitting Limit |
|---------|-----------------|---------|----------------------|
| Google Gemini Flash API | 15 RPM, 1M TPD | Script + metadata generation | Low (2 calls/video) |
| Groq API | ~14,400 req/day | Script fallback | Low |
| Microsoft Edge-TTS | Unlimited | Text-to-speech | None |
| Pexels API | Unlimited + attribution | Stock footage/images | None |
| Pixabay API | Unlimited + attribution | Stock footage/images | None |
| YouTube Data API v3 | 10,000 units/day | Video upload (1,650 units each) | Max ~6 uploads/day |
| Supabase (free) | 500MB DB, 1GB storage | State + logs | Low (purge old data) |
| GitHub Actions | 2,000 min/month | Scheduling | Low at 1 video/day |
| Railway/Render (free) | 500 hrs/month | Optional hosting | Moderate at 5+/day |
| FFmpeg + MoviePy | Open source | Video assembly | None |
| Python + all libraries | Open source | All modules | None |

### 11.2 What Hits a Wall as You Scale

| Scaling Trigger | Paid Upgrade Needed | Estimated Cost |
|----------------|---------------------|----------------|
| > 6 uploads/day | YouTube API quota increase request OR multi-account | $0 (quota increase is free via request) |
| > 130 pipeline runs/month | GitHub Actions paid OR self-hosted runner | $4/month (GitHub) |
| Better voice quality | ElevenLabs Starter ($5/month) | ₹420/month |
| Faster/better renders | Better compute: Railway Pro ($5/month) | ₹420/month |
| Better thumbnails | Stable Diffusion API or Replicate.com | $0–10/month |
| > 1GB media storage | Supabase Pro ($25/month) or Cloudflare R2 (free 10GB) | ₹0 with R2 |

### 11.3 Realistic MVP Budget

```
Month 1–2 (MVP):   ₹0/month       ← 100% free tier
Month 3–4 (Growth): ₹0–500/month  ← Optional ElevenLabs or better hosting
Month 5+ (Scale):  ₹500–2,000/month ← If monetized channel justifies paid APIs
```

**Free tier is fully viable for 1–5 videos/day indefinitely** if content stays in educational niches and YouTube quota is respected.

---

*Document ends. See AutoTube_TRD.md for technical architecture, module specs, schemas, and operational runbook.*
