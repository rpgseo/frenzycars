import { writeLog } from '../lib/db.js';

const ALLOWED_PROMPT_FIELDS = ['hero_prompt', 'mid1_prompt', 'mid2_prompt', 'video_prompt'] as const;
type PromptField = typeof ALLOWED_PROMPT_FIELDS[number];

export async function handlePromptSave(request: Request, db: D1Database): Promise<Response> {
  if (request.method !== 'PATCH') return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { id, field, value } = body as Record<string, unknown>;
  const parsedId = typeof id === 'number' ? id : typeof id === 'string' ? parseInt(id, 10) : NaN;
  if (!Number.isFinite(parsedId) || parsedId <= 0)
    return Response.json({ ok: false, error: 'Invalid id' }, { status: 400 });
  if (!ALLOWED_PROMPT_FIELDS.includes(field as PromptField))
    return Response.json({ ok: false, error: 'Invalid field' }, { status: 400 });
  if (typeof value !== 'string' || value.trim().length === 0)
    return Response.json({ ok: false, error: 'Value must be a non-empty string' }, { status: 400 });

  await db.prepare(`UPDATE review_candidates SET ${field as string} = ?, updated_at = ? WHERE id = ?`)
    .bind(value.trim(), new Date().toISOString(), parsedId).run();

  await writeLog(db, parsedId, 'prompt-save', 'ok', `${field as string} guardado`);
  return Response.json({ ok: true });
}
