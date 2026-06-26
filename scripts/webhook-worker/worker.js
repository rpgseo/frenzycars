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
    ];
    if (heroImageUrl) lines.push(`cover: ${JSON.stringify(heroImageUrl)}`);
    if (faqJson) lines.push(`faq_json_ld: ${JSON.stringify(faqJson)}`);
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

    // 4. Remove entire BLG CTA section ("Frenzycars resources..." block with its image)
    //    Matches from the h2 containing "resources" down to the next h2 or end
    html = html.replace(/<h2[^>]*>[^<]*resources[^<]*<\/h2>[\s\S]*?(?=<h2|$)/gi, "");

    // 5. Remove "Recommended" section (list of internal links BLG auto-generates)
    html = html.replace(/<h2[^>]*>[^<]*recommended[^<]*<\/h2>[\s\S]*?(?=<h2|$)/gi, "");

    // 6. Remove empty or author-only blockquotes (e.g. <blockquote><p><em>— Ramón</em></p></blockquote>)
    html = html.replace(/<blockquote>\s*<p>\s*<em>[^<]{0,40}<\/em>\s*<\/p>\s*<\/blockquote>/gi, "");

    // 7. Convert <table> to styled data-table wrapped in table-wrap
    html = html.replace(/<table>/gi, '<div class="table-wrap"><table class="data-table">');
    html = html.replace(/<\/table>/gi, "</table></div>");

    // 8. Convert FAQ section (h2#faq + h3/p pairs) to frenzy faq-item <details> format
    html = html.replace(
      /<h2[^>]*>\s*FAQ\s*<\/h2>([\s\S]*?)(?=<h2|$)/i,
      (_, faqBody) => {
        const items = [];
        const re = /<h3[^>]*>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/gi;
        let m;
        while ((m = re.exec(faqBody)) !== null) {
          const q = m[1].replace(/<[^>]*>/g, "").trim();
          const a = m[2].trim();
          items.push(`<details class="faq-item"><summary>${q}</summary><p>${a}</p></details>`);
        }
        if (!items.length) return "";
        return `<h2>Frequently asked questions</h2><div class="faq">${items.join("")}</div>`;
      }
    );

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
