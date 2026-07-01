import { writeLog } from '../lib/db.js';

const ALLOWED_FIELDS = ['dimensions_json', 'trims_json'] as const;
type AllowedField = typeof ALLOWED_FIELDS[number];

export async function handleEditorialDataPatch(request: Request, db: D1Database): Promise<Response> {
  if (request.method !== 'PATCH') return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { id, field, value } = body as Record<string, unknown>;
  const parsedId = typeof id === 'number' ? id : typeof id === 'string' ? parseInt(id, 10) : NaN;
  if (!Number.isFinite(parsedId) || parsedId <= 0)
    return Response.json({ ok: false, error: 'Invalid id' }, { status: 400 });

  if (typeof field !== 'string' || !ALLOWED_FIELDS.includes(field as AllowedField))
    return Response.json({ ok: false, error: 'Invalid field' }, { status: 400 });

  if (typeof value !== 'string') return Response.json({ ok: false, error: 'Invalid value' }, { status: 400 });

  try {
    JSON.parse(value || '[]');
  } catch {
    return Response.json({ ok: false, error: 'Value must be valid JSON' }, { status: 400 });
  }

  const updatedAt = new Date().toISOString();
  await db.prepare(`UPDATE review_candidates SET ${field} = ?, updated_at = ? WHERE id = ?`)
    .bind(value, updatedAt, parsedId)
    .run();

  await writeLog(db, parsedId, 'editorial-data', 'ok', `${field} updated`);

  return Response.json({ ok: true });
}
