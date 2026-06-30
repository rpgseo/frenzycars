export async function handleClearLogs(
  _req: Request,
  _id: number,
  _db: D1Database,
): Promise<Response> {
  return Response.json({ ok: false, error: 'Not implemented' }, { status: 501 });
}
