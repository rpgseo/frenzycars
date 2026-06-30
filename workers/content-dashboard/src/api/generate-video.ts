import type { Env } from '../index.js';

export async function handleGenerateVideo(_req: Request, _env: Env): Promise<Response> {
  return Response.json({ ok: false, error: 'Not implemented' }, { status: 501 });
}
