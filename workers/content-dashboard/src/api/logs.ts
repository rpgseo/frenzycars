export async function handleClearLogs(request: Request, candidateId: number, db: D1Database): Promise<Response> {
  if (request.method !== 'DELETE') return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
  if (!Number.isFinite(candidateId) || candidateId <= 0)
    return Response.json({ ok: false, error: 'Invalid candidate_id' }, { status: 400 });

  const result = await db.prepare('DELETE FROM candidate_logs WHERE candidate_id = ?')
    .bind(candidateId).run();

  return Response.json({ ok: true, deleted: result.meta.changes ?? 0 });
}
