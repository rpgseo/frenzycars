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
