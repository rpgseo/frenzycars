import type { Env } from '../index.js';

export async function handleJobPoll(_req: Request, _jobId: string, _env: Env): Promise<Response> {
  return Response.json({ ok: false, error: 'Not implemented' }, { status: 501 });
}
