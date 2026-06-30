import type { Env } from '../index.js';
import { writeLog, getCandidate } from '../lib/db.js';
import { generateImage } from '../lib/kieai.js';
import { uploadToR2, buildCfUrl } from '../lib/r2.js';

type ImageSlot = 'hero' | 'mid1' | 'mid2';
const SLOT_FIELD: Record<ImageSlot, string> = {
  hero: 'editorial_hero_url',
  mid1: 'editorial_mid1_url',
  mid2: 'editorial_mid2_url',
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

  await writeLog(env.DB, parsedId, operation, 'pending', 'Llamando a kie.ai...');

  try {
    const imageBytes = await generateImage(env.KIE_AI_API_KEY, prompt.trim());
    const key = `reviews/${candidate.slug}/${typedSlot}-original.jpg`;
    await uploadToR2(env.IMAGES, key, imageBytes, 'image/jpeg');
    const url = buildCfUrl(env.CF_IMAGES_BASE_URL, key);

    await env.DB.prepare(`UPDATE review_candidates SET ${SLOT_FIELD[typedSlot]} = ?, updated_at = ? WHERE id = ?`)
      .bind(url, new Date().toISOString(), parsedId).run();

    await writeLog(env.DB, parsedId, operation, 'ok', `${key} subido a R2`);
    return Response.json({ ok: true, url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await writeLog(env.DB, parsedId, operation, 'error', msg);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
