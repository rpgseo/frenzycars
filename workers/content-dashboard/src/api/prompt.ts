export async function handlePromptSave(_req: Request, _db: D1Database): Promise<Response> {
  return Response.json({ ok: false, error: 'Not implemented' }, { status: 501 });
}
