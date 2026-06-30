-- Create or update review_candidates table with media pipeline columns
CREATE TABLE IF NOT EXISTS review_candidates (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  make                 TEXT NOT NULL,
  model                TEXT NOT NULL,
  year                 INTEGER,
  slug                 TEXT UNIQUE,
  keyword              TEXT,
  search_volume        INTEGER,
  keyword_difficulty   INTEGER,
  trend_score          REAL,
  reference_image_url  TEXT,
  editorial_hero_url   TEXT,
  editorial_mid1_url   TEXT,
  editorial_mid2_url   TEXT,
  video_url            TEXT,
  hero_prompt          TEXT,
  mid1_prompt          TEXT,
  mid2_prompt          TEXT,
  video_prompt         TEXT,
  status               TEXT,
  raw_data             TEXT,
  video_job_id         TEXT,
  video_status         TEXT DEFAULT 'idle',
  last_commit_sha      TEXT,
  created_at           TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at           TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de logs
CREATE TABLE IF NOT EXISTS candidate_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  candidate_id  INTEGER NOT NULL,
  ts            TEXT NOT NULL,
  operation     TEXT NOT NULL,
  status        TEXT NOT NULL,
  message       TEXT,
  FOREIGN KEY (candidate_id) REFERENCES review_candidates(id)
);
CREATE INDEX IF NOT EXISTS idx_logs_candidate ON candidate_logs(candidate_id, ts DESC);
