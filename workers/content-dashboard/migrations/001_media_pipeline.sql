-- Nuevas columnas en review_candidates (tabla ya existe en producción)
ALTER TABLE review_candidates ADD COLUMN mid1_prompt    TEXT;
ALTER TABLE review_candidates ADD COLUMN mid2_prompt    TEXT;
ALTER TABLE review_candidates ADD COLUMN video_prompt   TEXT;
ALTER TABLE review_candidates ADD COLUMN video_job_id   TEXT;
ALTER TABLE review_candidates ADD COLUMN video_status   TEXT DEFAULT 'idle';
ALTER TABLE review_candidates ADD COLUMN last_commit_sha TEXT;

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
