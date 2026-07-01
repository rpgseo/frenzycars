CREATE TABLE IF NOT EXISTS cars (
  id INTEGER PRIMARY KEY,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  generation TEXT,
  trim TEXT NOT NULL,
  year INTEGER,
  slug TEXT UNIQUE NOT NULL,
  specs_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS comparisons (
  id INTEGER PRIMARY KEY,
  slug_a TEXT NOT NULL,
  slug_b TEXT NOT NULL,
  url_slug TEXT UNIQUE NOT NULL,
  editorial TEXT,
  kd INTEGER,
  monthly_searches INTEGER,
  published INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cars_slug ON cars(slug);
CREATE INDEX IF NOT EXISTS idx_comparisons_url_slug ON comparisons(url_slug);
CREATE INDEX IF NOT EXISTS idx_comparisons_published ON comparisons(published);

CREATE TABLE IF NOT EXISTS review_candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER,
  slug TEXT UNIQUE NOT NULL,

  keyword TEXT,
  search_volume INTEGER,
  keyword_difficulty INTEGER,
  trend_score INTEGER,

  reference_image_url TEXT,
  editorial_hero_url TEXT,
  editorial_mid1_url TEXT,
  editorial_mid2_url TEXT,
  video_url TEXT,
  dimensions_json TEXT,
  trims_json TEXT,

  hero_prompt TEXT,
  mid_prompt TEXT,
  video_prompt TEXT,

  raw_data TEXT,

  status TEXT NOT NULL DEFAULT 'suggested',

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_review_candidates_status ON review_candidates(status);
CREATE INDEX IF NOT EXISTS idx_review_candidates_slug ON review_candidates(slug);
