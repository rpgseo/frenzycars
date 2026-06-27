/**
 * blg-repair-article.mjs
 * Fetches an article from BabyLoveGrowth API, applies the same
 * cleanup filters as the webhook worker, and commits it to GitHub.
 *
 * Usage:
 *   node scripts/blg-repair-article.mjs <slug>
 *
 * Env vars required:
 *   BLG_API_KEY     — BabyLoveGrowth API key (X-API-Key header)
 *   GITHUB_TOKEN    — GitHub personal access token (repo scope)
 *   GITHUB_REPO     — e.g. "rpgseo/frenzycars"
 *   GITHUB_BRANCH   — e.g. "main"
 */

const BLG_BASE = "https://api.babylovegrowth.ai/api/integrations/v1";
const slug = process.argv[2];

if (!slug) {
  console.error("Usage: node scripts/blg-repair-article.mjs <slug>");
  process.exit(1);
}

const { BLG_API_KEY, GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH = "main" } = process.env;

if (!BLG_API_KEY || !GITHUB_TOKEN || !GITHUB_REPO) {
  console.error("Missing env vars: BLG_API_KEY, GITHUB_TOKEN, GITHUB_REPO");
  process.exit(1);
}

// ── 1. List articles to find the one matching the slug ──────────────────────
console.log(`Searching for article with slug: ${slug}`);

let article = null;
let offset = 0;
const limit = 50;

while (true) {
  const res = await fetch(`${BLG_BASE}/articles?limit=${limit}&offset=${offset}`, {
    headers: { "X-API-Key": BLG_API_KEY, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`BLG list error: ${res.status} ${await res.text()}`);

  const articles = await res.json();
  if (articles.length === 0) break;

  const found = articles.find((a) => a.slug === slug);
  if (found) { article = found; break; }
  if (articles.length < limit) break;
  offset += limit;
}

if (!article) {
  console.error(`Article not found with slug: ${slug}`);
  process.exit(1);
}

console.log(`Found article id=${article.id}: "${article.title}"`);

// ── 2. Fetch full content ───────────────────────────────────────────────────
const fullRes = await fetch(`${BLG_BASE}/articles/${article.id}`, {
  headers: { "X-API-Key": BLG_API_KEY, "Content-Type": "application/json" },
});
if (!fullRes.ok) throw new Error(`BLG fetch error: ${fullRes.status} ${await fullRes.text()}`);
const full = await fullRes.json();

const {
  title,
  meta_description: metaDescription,
  content_html,
  hero_image_url: heroImageUrl,
  faqJsonLd,
  created_at: createdAt,
  keywords: tags,
} = full;

// ── 3. Build frontmatter ────────────────────────────────────────────────────
const date = createdAt ? createdAt.split("T")[0] : new Date().toISOString().split("T")[0];

const lines = [
  "---",
  `title: ${JSON.stringify(title)}`,
  `date: "${date}T00:00:00.000Z"`,
  `draft: false`,
  `description: ${JSON.stringify(metaDescription || "")}`,
];

if (heroImageUrl) lines.push(`cover: ${JSON.stringify(heroImageUrl)}`);

if (tags && Array.isArray(tags) && tags.length > 0) {
  lines.push("tags:");
  for (const t of tags) lines.push(`  - ${JSON.stringify(t)}`);
}

if (faqJsonLd && Array.isArray(faqJsonLd.mainEntity) && faqJsonLd.mainEntity.length > 0) {
  lines.push("faq:");
  for (const entity of faqJsonLd.mainEntity) {
    const q = (entity.name || "").replace(/"/g, '\\"');
    const a = (entity.acceptedAnswer?.text || "").replace(/"/g, '\\"');
    lines.push(`  - q: "${q}"`);
    lines.push(`    a: "${a}"`);
  }
}

lines.push("---", "");

// ── 4. Clean HTML (same filters as webhook worker) ──────────────────────────
let html = content_html || "";

// 1. Remove opening <h1>
html = html.replace(/<h1[^>]*>.*?<\/h1>/is, "");

// 2. Remove hero image duplicate
if (heroImageUrl) {
  const escapedUrl = heroImageUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  html = html.replace(new RegExp(`<p>\\s*<img[^>]*${escapedUrl}[^>]*>\\s*<\\/p>`, "i"), "");
}

// 3. Remove BabyLoveGrowth attribution link
html = html.replace(/<p>\s*<a[^>]*babylovegrowth[^>]*>.*?<\/a>\s*<\/p>/gi, "");

// 4. Remove BLG CTA section ("resources" block)
html = html.replace(/<h2[^>]*>[^<]*resources[^<]*<\/h2>[\s\S]*?(?=<h2|$)/gi, "");

// 5. Remove empty author-only blockquotes
html = html.replace(/<blockquote>\s*<p>\s*<em>[^<]{0,40}<\/em>\s*<\/p>\s*<\/blockquote>/gi, "");

// 6. Convert <table> to styled data-table
html = html.replace(/<table>/gi, '<div class="table-wrap"><table class="data-table">');
html = html.replace(/<\/table>/gi, "</table></div>");

// 7. Convert Pro Tip paragraphs to blockquote
html = html.replace(/<p>\s*<strong>Pro Tip:<\/strong>([\s\S]*?)<\/p>/gi, "<blockquote><p><strong>Pro Tip:</strong>$1</p></blockquote>");

// 8. Remove FAQ section from HTML body
html = html.replace(/<h2[^>]*>\s*(?:FAQ|Frequently asked questions)\s*<\/h2>[\s\S]*?(?=<h2|$)/i, "");

// 9. Remove any JSON-LD <script> blocks embedded in HTML body
html = html.replace(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, "");

lines.push(html);

const fileText = lines.join("\n");
const filePath = `src/content/blog/${slug}.md`;

// ── 5. Commit to GitHub ─────────────────────────────────────────────────────
const fileContent = Buffer.from(fileText).toString("base64");
const apiBase = `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`;
const ghHeaders = {
  Authorization: `token ${GITHUB_TOKEN}`,
  Accept: "application/vnd.github+json",
  "Content-Type": "application/json",
  "User-Agent": "FrenzyCars-Repair-Script/1.0",
};

let sha;
const existing = await fetch(apiBase, { headers: ghHeaders });
if (existing.ok) {
  const data = await existing.json();
  sha = data.sha;
  console.log(`File exists in repo, will update (sha=${sha.slice(0, 7)})`);
} else {
  console.log("File not in repo, will create new.");
}

const body = {
  message: `blog: repair "${title}" (remove inline JSON-LD)`,
  content: fileContent,
  branch: GITHUB_BRANCH,
  ...(sha ? { sha } : {}),
};

const commit = await fetch(apiBase, {
  method: "PUT",
  headers: ghHeaders,
  body: JSON.stringify(body),
});

if (!commit.ok) {
  const err = await commit.text();
  console.error("GitHub API error:", err);
  process.exit(1);
}

console.log(`✓ Committed ${filePath} to ${GITHUB_REPO}@${GITHUB_BRANCH}`);
console.log(`  URL: https://frenzycars.com/blog/${slug}/`);
