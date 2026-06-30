import type { Env } from '../index.js';
import { writeLog, getCandidate } from '../lib/db.js';
import { submitVideoJob } from '../lib/kieai.js';

export async function handleGenerateVideo(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { id, prompt } = body as Record<string, unknown>;
  const parsedId = typeof id === 'number' ? id : typeof id === 'string' ? parseInt(id, 10) : NaN;
  if (!Number.isFinite(parsedId) || parsedId <= 0)
    return Response.json({ ok: false, error: 'Invalid id' }, { status: 400 });
  if (typeof prompt !== 'string' || prompt.trim().length === 0)
    return Response.json({ ok: false, error: 'Prompt is required' }, { status: 400 });

  const candidate = await getCandidate(env.DB, parsedId);
  if (!candidate) return Response.json({ ok: false, error: 'Candidate not found' }, { status: 404 });
  if (!candidate.editorial_hero_url)
    return Response.json({ ok: false, error: 'Genera primero la imagen hero antes de generar el vídeo' }, { status: 400 });

  await writeLog(env.DB, parsedId, 'generate-video', 'pending', 'Enviando job a kie.ai...');

  try {
    const jobId = await submitVideoJob(env.KIE_AI_API_KEY, prompt.trim(), candidate.editorial_hero_url);
    await env.DB.prepare(
      'UPDATE review_candidates SET video_job_id = ?, video_status = ?, updated_at = ? WHERE id = ?'
    ).bind(jobId, 'pending', new Date().toISOString(), parsedId).run();

    await writeLog(env.DB, parsedId, 'generate-video', 'ok', `Job enviado: ${jobId}`);
    return Response.json({ ok: true, job_id: jobId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await writeLog(env.DB, parsedId, 'generate-video', 'error', msg);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
