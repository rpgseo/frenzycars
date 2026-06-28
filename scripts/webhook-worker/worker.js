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

    const { title, slug, metaDescription, content_html, heroImageUrl, faqJsonLd, createdAt, author, tags } = payload;

    if (!slug || !title) {
      return new Response("Missing slug or title", { status: 400 });
    }

    // Build Astro-compatible YAML front matter
    const date = createdAt ? createdAt.split("T")[0] : new Date().toISOString().split("T")[0];

    const lines = [
      "---",
      `title: ${JSON.stringify(title)}`,
      `date: "${date}T00:00:00.000Z"`,
      `draft: false`,
      `description: ${JSON.stringify(metaDescription || "")}`,
    ];

    if (heroImageUrl) lines.push(`cover: ${JSON.stringify(heroImageUrl)}`);
    if (author) lines.push(`author: ${JSON.stringify(author)}`);

    // Tags as YAML array
    if (tags && Array.isArray(tags) && tags.length > 0) {
      lines.push("tags:");
      for (const t of tags) lines.push(`  - ${JSON.stringify(t)}`);
    }

    // FAQ as YAML array (not JSON string) — consumed by [slug].astro accordion + JSON-LD
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

    let html = content_html || "";

    // 1. Remove opening <h1> (duplicates the page title)
    html = html.replace(/<h1[^>]*>.*?<\/h1>/is, "");

    // 2. Remove hero image duplicate (first <p><img src="heroImageUrl"></p>)
    if (heroImageUrl) {
      const escapedUrl = heroImageUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      html = html.replace(new RegExp(`<p>\\s*<img[^>]*${escapedUrl}[^>]*>\\s*<\\/p>`, "i"), "");
    }

    // 3. Remove BabyLoveGrowth attribution link
    html = html.replace(/<p>\s*<a[^>]*babylovegrowth[^>]*>.*?<\/a>\s*<\/p>/gi, "");

    // 4. Remove BLG CTA section ("resources" block)
    html = html.replace(/<h2[^>]*>[^<]*resources[^<]*<\/h2>[\s\S]*?(?=<h2|$)/gi, "");

    // 5. Remove empty author-only blockquotes (e.g. <blockquote><p><em>— Ramón</em></p></blockquote>)
    html = html.replace(/<blockquote>\s*<p>\s*<em>[^<]{0,40}<\/em>\s*<\/p>\s*<\/blockquote>/gi, "");

    // 6. Convert <table> to styled data-table
    html = html.replace(/<table>/gi, '<div class="table-wrap"><table class="data-table">');
    html = html.replace(/<\/table>/gi, "</table></div>");

    // 7. Convert Pro Tip paragraphs to blockquote
    html = html.replace(/<p>\s*<strong>Pro Tip:<\/strong>([\s\S]*?)<\/p>/gi, "<blockquote><p><strong>Pro Tip:</strong>$1</p></blockquote>");

    // 8. Remove FAQ section from HTML body — it is now rendered via frontmatter faq[] accordion
    html = html.replace(/<h2[^>]*>\s*(?:FAQ|Frequently asked questions)\s*<\/h2>[\s\S]*?(?=<h2|$)/i, "");

    // 9. Remove any JSON-LD <script> blocks embedded in HTML body (BLG sometimes injects them)
    // Handles HTML-encoded quotes (&quot;), plain quotes, and multiple blocks
    html = html.replace(/<script[^>]*type=(?:["']|&quot;)application\/ld\+json(?:["']|&quot;)[^>]*>[\s\S]*?<\/script>/gi, "");

    lines.push(html);

    const fileText = lines.join("\n");
    // Astro content path (not Hugo)
    const filePath = `src/content/blog/${slug}.md`;
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
