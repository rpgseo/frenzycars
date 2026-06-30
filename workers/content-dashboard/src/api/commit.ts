import type { Env } from '../index.js';
import { writeLog, getCandidate } from '../lib/db.js';
import { readGithubFile, writeGithubFile } from '../lib/github.js';
import type { ReviewCandidate } from '../ui/shared.js';

function buildFrontmatter(candidate: ReviewCandidate, existingFrontmatter: Record<string, unknown>): string {
  const lines: string[] = ['---'];

  const preserved = { ...existingFrontmatter };
  delete preserved['cover'];
  delete preserved['gallery'];
  delete preserved['video'];

  if (!preserved['title']) {
    preserved['title'] = `${candidate.make} ${candidate.model}${candidate.year ? ` ${candidate.year}` : ''} Review`;
  }
  if (!preserved['date']) preserved['date'] = new Date().toISOString();
  if (preserved['draft'] === undefined) preserved['draft'] = false;

  for (const [k, v] of Object.entries(preserved)) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'string') lines.push(`${k}: '${v.replace(/'/g, "''")}'`);
    else if (typeof v === 'boolean' || typeof v === 'number') lines.push(`${k}: ${v}`);
    else if (Array.isArray(v)) {
      lines.push(`${k}:`);
      for (const item of v) lines.push(`  - ${typeof item === 'string' ? `'${(item as string).replace(/'/g, "''")}'` : item}`);
    }
  }

  if (candidate.editorial_hero_url) lines.push(`cover: '${candidate.editorial_hero_url}'`);
  const galleryItems: string[] = [];
  if (candidate.editorial_mid1_url) galleryItems.push(candidate.editorial_mid1_url);
  if (candidate.editorial_mid2_url) galleryItems.push(candidate.editorial_mid2_url);
  if (galleryItems.length > 0) {
    lines.push('gallery:');
    for (const url of galleryItems) lines.push(`  - '${url}'`);
  }
  if (candidate.video_url) lines.push(`video: '${candidate.video_url}'`);

  lines.push('---');
  return lines.join('\n');
}

function extractFrontmatterAndBody(content: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };

  const yamlStr = match[1];
  const body = match[2] ?? '';

  const frontmatter: Record<string, unknown> = {};
  const lines = yamlStr.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const keyMatch = line.match(/^(\w[\w-]*)\s*:\s*(.*)$/);
    if (!keyMatch) { i++; continue; }
    const key = keyMatch[1];
    const rawVal = keyMatch[2].trim();

    if (rawVal === '') {
      const items: string[] = [];
      i++;
      while (i < lines.length && lines[i].startsWith('  - ')) {
        items.push(lines[i].replace(/^  - ['"]?/, '').replace(/['"]?$/, ''));
        i++;
      }
      if (items.length > 0) frontmatter[key] = items;
      continue;
    }

    if (rawVal === 'true') frontmatter[key] = true;
    else if (rawVal === 'false') frontmatter[key] = false;
    else if (!isNaN(Number(rawVal)) && rawVal !== '') frontmatter[key] = Number(rawVal);
    else frontmatter[key] = rawVal.replace(/^['"]/, '').replace(/['"]$/, '');
    i++;
  }

  return { frontmatter, body };
}

const PLACEHOLDER_BODY = `\n<!--more-->\n\n## Overview\n\nReview content coming soon.\n`;

export async function handleCommit(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { id } = body as Record<string, unknown>;
  const parsedId = typeof id === 'number' ? id : typeof id === 'string' ? parseInt(id, 10) : NaN;
  if (!Number.isFinite(parsedId) || parsedId <= 0)
    return Response.json({ ok: false, error: 'Invalid id' }, { status: 400 });

  const candidate = await getCandidate(env.DB, parsedId);
  if (!candidate) return Response.json({ ok: false, error: 'Candidate not found' }, { status: 404 });
  if (!candidate.editorial_hero_url)
    return Response.json({ ok: false, error: 'At least hero image is required before committing' }, { status: 400 });

  const filePath = `src/content/reviews/${candidate.slug}.md`;
  await writeLog(env.DB, parsedId, 'commit', 'pending', `Escribiendo ${filePath}...`);

  try {
    const existing = await readGithubFile(env.GITHUB_TOKEN, env.GITHUB_REPO, filePath);
    let existingFrontmatter: Record<string, unknown> = {};
    let markdownBody = PLACEHOLDER_BODY;
    let existingSha: string | null = null;

    if (existing) {
      const parsed = extractFrontmatterAndBody(existing.content);
      existingFrontmatter = parsed.frontmatter;
      markdownBody = parsed.body || PLACEHOLDER_BODY;
      existingSha = existing.sha;
    }

    const newFrontmatter = buildFrontmatter(candidate, existingFrontmatter);
    const fullContent = `${newFrontmatter}\n${markdownBody}`;
    const commitMessage = `content: update media for ${candidate.slug}`;

    const commitSha = await writeGithubFile(
      env.GITHUB_TOKEN, env.GITHUB_REPO, filePath, fullContent, existingSha, commitMessage
    );

    await env.DB.prepare('UPDATE review_candidates SET last_commit_sha = ?, updated_at = ? WHERE id = ?')
      .bind(commitSha, new Date().toISOString(), parsedId).run();

    const githubUrl = `https://github.com/${env.GITHUB_REPO}/commit/${commitSha}`;
    await writeLog(env.DB, parsedId, 'commit', 'ok', `Commit ${commitSha.slice(0, 7)} — ${filePath}`);

    return Response.json({ ok: true, commit_sha: commitSha, path: filePath, github_url: githubUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await writeLog(env.DB, parsedId, 'commit', 'error', msg);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
