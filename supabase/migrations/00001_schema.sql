-- AutoTube Schema
-- Migration 00001: Core tables

-- Topics queue: sources of video ideas
CREATE TABLE IF NOT EXISTS topics (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       TEXT NOT NULL,
    keywords    TEXT[] DEFAULT '{}',
    niche       TEXT NOT NULL DEFAULT 'general_knowledge',
    status      TEXT NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued', 'processing', 'done', 'failed', 'skipped')),
    source      TEXT DEFAULT 'system',
    youtube_video_id TEXT,
    error_message    TEXT,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Pipeline runs: tracks every execution
CREATE TABLE IF NOT EXISTS pipeline_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id        UUID REFERENCES topics(id) ON DELETE SET NULL,
    status          TEXT NOT NULL DEFAULT 'running'
                    CHECK (status IN ('running', 'success', 'failed')),
    stage_reached   TEXT,
    stage_failed    TEXT,
    youtube_video_id TEXT,
    error_details   JSONB,
    started_at      TIMESTAMPTZ DEFAULT now(),
    completed_at    TIMESTAMPTZ,
    duration_seconds INT
);

-- YouTube API quota tracking
CREATE TABLE IF NOT EXISTS youtube_quota (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date        DATE NOT NULL DEFAULT CURRENT_DATE,
    quota_used  INT NOT NULL DEFAULT 0,
    operations  JSONB DEFAULT '[]',
    created_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE(date)
);

-- Waitlist for website signups
CREATE TABLE IF NOT EXISTS waitlist (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       TEXT NOT NULL UNIQUE,
    name        TEXT,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_topics_status ON topics(status);
CREATE INDEX IF NOT EXISTS idx_topics_created ON topics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status ON pipeline_runs(status);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_topic ON pipeline_runs(topic_id);
CREATE INDEX IF NOT EXISTS idx_youtube_quota_date ON youtube_quota(date);
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);
