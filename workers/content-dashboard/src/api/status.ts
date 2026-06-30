import { ALLOWED_STATUSES } from '../ui/shared.js';

export async function handleStatusApi(request: Request, db: D1Database): Promise<Response> {
  if (request.method !== 'POST') {
    return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }
  const { id, status } = body as Record<string, unknown>;
  const parsedId =
    typeof id === 'number' ? id : typeof id === 'string' ? parseInt(id, 10) : NaN;
  if (!Number.isFinite(parsedId) || parsedId <= 0) {
    return Response.json({ ok: false, error: 'Invalid id' }, { status: 400 });
  }
  if (typeof status !== 'string' || !(ALLOWED_STATUSES as string[]).includes(status)) {
    return Response.json({ ok: false, error: 'Invalid status' }, { status: 400 });
  }
  const updatedAt = new Date().toISOString();
  const result = await db
    .prepare('UPDATE review_candidates SET status = ?, updated_at = ? WHERE id = ?')
    .bind(status, updatedAt, parsedId)
    .run();
  if ((result.meta.changes ?? 0) === 0) {
    return Response.json({ ok: false, error: 'Candidate not found' }, { status: 404 });
  }
  return Response.json({ ok: true, status });
}
