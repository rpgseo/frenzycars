import type { Env } from '../index.js';
import { listGithubDir, readGithubFile } from '../lib/github.js';
import { extractFrontmatterAndBody } from '../lib/frontmatter.js';

const REVIEWS_DIR = 'src/content/reviews';

function deriveYear(slug: string, title: string): number | null {
  const fromSlug = slug.match(/(19|20)\d{2}/);
  if (fromSlug) return parseInt(fromSlug[0], 10);
  const fromTitle = title.match(/(19|20)\d{2}/);
  return fromTitle ? parseInt(fromTitle[0], 10) : null;
}

function deriveMakeModel(
  slug: string,
  title: string,
  tags: string[]
): { make: string; model: string } {
  const make = tags[0] || slug.split('-')[0] || 'Unknown';
  const model = title
    .replace(/^\d{4}\s*/, '')
    .replace(new RegExp(`^${make}\\s*`, 'i'), '')
    .replace(/\s*review.*$/i, '')
    .trim() || slug;
  return { make, model };
}

export async function handleSyncReviews(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
  }

  let files: Array<{ name: string; path: string }>;
  try {
    files = (await listGithubDir(env.GITHUB_TOKEN, env.GITHUB_REPO, REVIEWS_DIR))
      .filter(f => f.name.endsWith('.md'));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: `Failed to list ${REVIEWS_DIR}: ${msg}` }, { status: 500 });
  }

  let created = 0;
  let updated = 0;
  const errors: string[] = [];
  const now = new Date().toISOString();

  for (const file of files) {
    const slug = file.name.replace(/\.md$/, '');
    try {
      const fileData = await readGithubFile(env.GITHUB_TOKEN, env.GITHUB_REPO, file.path);
      if (!fileData) continue;

      const { frontmatter } = extractFrontmatterAndBody(fileData.content);
      const title = typeof frontmatter.title === 'string' ? frontmatter.title : slug;
      const tags = Array.isArray(frontmatter.tags) ? (frontmatter.tags as string[]) : [];
      const isDraft = frontmatter.draft === true;

      const { make, model } = deriveMakeModel(slug, title, tags);
      const year = deriveYear(slug, title);
      const cover = typeof frontmatter.cover === 'string' ? frontmatter.cover : null;
      const gallery = Array.isArray(frontmatter.gallery) ? (frontmatter.gallery as string[]) : [];
      const video = typeof frontmatter.video === 'string' ? frontmatter.video : null;
      const dimensions = frontmatter.dimensions ? JSON.stringify(frontmatter.dimensions) : null;
      const trims = frontmatter.trims ? JSON.stringify(frontmatter.trims) : null;

      const existing = await env.DB
        .prepare('SELECT id, status FROM review_candidates WHERE slug = ?')
        .bind(slug)
        .first<{ id: number; status: string }>();

      const status = isDraft ? 'suggested' : 'published';

      if (existing) {
        await env.DB
          .prepare(
            `UPDATE review_candidates SET
              make = ?, model = ?, year = ?,
              editorial_hero_url = COALESCE(?, editorial_hero_url),
              editorial_mid1_url = COALESCE(?, editorial_mid1_url),
              editorial_mid2_url = COALESCE(?, editorial_mid2_url),
              video_url = COALESCE(?, video_url),
              dimensions_json = COALESCE(?, dimensions_json),
              trims_json = COALESCE(?, trims_json),
              status = ?, updated_at = ?
            WHERE id = ?`
          )
          .bind(
            make, model, year,
            cover, gallery[0] ?? null, gallery[1] ?? null, video,
            dimensions, trims,
            status, now, existing.id
          )
          .run();
        updated++;
      } else {
        await env.DB
          .prepare(
            `INSERT INTO review_candidates
              (make, model, year, slug, editorial_hero_url, editorial_mid1_url, editorial_mid2_url,
               video_url, dimensions_json, trims_json, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            make, model, year, slug,
            cover, gallery[0] ?? null, gallery[1] ?? null, video,
            dimensions, trims,
            status, now, now
          )
          .run();
        created++;
      }
    } catch (e) {
      errors.push(`${slug}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return Response.json({
    ok: errors.length === 0,
    scanned: files.length,
    created,
    updated,
    errors,
  });
}
