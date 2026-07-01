import type { Env } from '../index.js';
import { writeLog, getCandidate } from '../lib/db.js';
import { submitImageJob } from '../lib/kieai.js';

type ImageSlot = 'hero' | 'mid1' | 'mid2';
const SLOT_FIELD: Record<ImageSlot, string> = {
  hero: 'hero_image_job_id',
  mid1: 'mid1_image_job_id',
  mid2: 'mid2_image_job_id',
};
const SLOT_OP: Record<ImageSlot, string> = {
  hero: 'generate-image-hero',
  mid1: 'generate-image-mid1',
  mid2: 'generate-image-mid2',
};

export async function handleGenerateImage(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { id, slot, prompt } = body as Record<string, unknown>;
  const parsedId = typeof id === 'number' ? id : typeof id === 'string' ? parseInt(id, 10) : NaN;
  if (!Number.isFinite(parsedId) || parsedId <= 0)
    return Response.json({ ok: false, error: 'Invalid id' }, { status: 400 });
  if (!['hero', 'mid1', 'mid2'].includes(slot as string))
    return Response.json({ ok: false, error: 'Invalid slot' }, { status: 400 });
  if (typeof prompt !== 'string' || prompt.trim().length === 0)
    return Response.json({ ok: false, error: 'Prompt is required' }, { status: 400 });

  const typedSlot = slot as ImageSlot;
  const operation = SLOT_OP[typedSlot];

  const candidate = await getCandidate(env.DB, parsedId);
  if (!candidate) return Response.json({ ok: false, error: 'Candidate not found' }, { status: 404 });

  const referenceImageUrl =
    typedSlot === 'hero'
      ? candidate.reference_image_url ?? undefined
      : candidate.editorial_hero_url ?? undefined;

  await writeLog(env.DB, parsedId, operation, 'pending', 'Enviando job a kie.ai…');

  try {
    const taskId = await submitImageJob(env.KIE_AI_API_KEY, prompt.trim(), referenceImageUrl);

    // Save taskId to D1 so the poll endpoint can find it
    await env.DB.prepare(
      `UPDATE review_candidates SET ${SLOT_FIELD[typedSlot]} = ?, updated_at = ? WHERE id = ?`
    ).bind(taskId, new Date().toISOString(), parsedId).run();

    await writeLog(env.DB, parsedId, operation, 'pending', `Job creado: ${taskId}`);
    return Response.json({ ok: true, task_id: taskId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await writeLog(env.DB, parsedId, operation, 'error', msg);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
