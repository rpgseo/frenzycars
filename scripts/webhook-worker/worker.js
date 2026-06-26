/**
 * Cloudflare Worker — BabyLoveGrowth → FrenzyCars blog webhook
 *
 * Environment variables (set in Cloudflare dashboard → Worker → Settings → Variables):
 *   BLG_WEBHOOK_SECRET   — the Bearer token you set in BabyLoveGrowth
 *   GITHUB_TOKEN         — GitHub personal access token (repo scope)
 *   GITHUB_REPO          — "rpgseo/frenzycars"
 *   GITHUB_BRANCH        — "main"
 */

export default {
  async fetch(request, env) {
    // Only accept POST
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    // Validate Bearer token
    const auth = request.headers.get("Authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    if (token !== env.BLG_WEBHOOK_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Parse payload
    let payload;
    try {
      payload = await request.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const { title, slug, metaDescription, content_html, heroImageUrl, faqJsonLd, createdAt } = payload;

    if (!slug || !title) {
      return new Response("Missing slug or title", { status: 400 });
    }

    // Build Hugo front matter + content
    const date = createdAt ? createdAt.split("T")[0] : new Date().toISOString().split("T")[0];
    const faqJson = faqJsonLd ? JSON.stringify(faqJsonLd) : "";

    const lines = [
      "---",
      `title: ${JSON.stringify(title)}`,
      `date: "${date}"`,
      `description: ${JSON.stringify(metaDescription || "")}`,
      `markup: "html"`,
    ];
    if (heroImageUrl) lines.push(`cover: ${JSON.stringify(heroImageUrl)}`);
    if (faqJson) lines.push(`faq_json_ld: ${JSON.stringify(faqJson)}`);
    lines.push("---", "");

    // HTML body goes after the front matter — Hugo renders it via safeHTML in the layout
    const html = content_html || "";
    lines.push(html);

    const fileText = lines.join("\n");
    const filePath = `content/blog/${slug}.md`;
    const fileContent = btoa(unescape(encodeURIComponent(fileText)));

    // Check if file already exists (to get its SHA for update)
    const repo = env.GITHUB_REPO;
    const branch = env.GITHUB_BRANCH || "main";
    const apiBase = `https://api.github.com/repos/${repo}/contents/${filePath}`;
    const headers = {
      Authorization: `token ${env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "FrenzyCars-Webhook-Worker/1.0",
    };

    let sha;
    const existing = await fetch(apiBase, { headers });
    if (existing.ok) {
      const data = await existing.json();
      sha = data.sha;
    }

    // Commit to GitHub
    const body = {
      message: `blog: add "${title}"`,
      content: fileContent,
      branch,
      ...(sha ? { sha } : {}),
    };

    const commit = await fetch(apiBase, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    });

    if (!commit.ok) {
      const err = await commit.text();
      console.error("GitHub API error:", err);
      return new Response("GitHub commit failed", { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true, path: filePath }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
};
