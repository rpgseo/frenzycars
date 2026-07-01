import type { Env } from '../index.js';
import { writeLog } from '../lib/db.js';
import { pollImageJob } from '../lib/kieai.js';
import { uploadToR2, buildCfUrl } from '../lib/r2.js';

type ImageSlot = 'hero' | 'mid1' | 'mid2';
const SLOT_JOB_FIELD: Record<ImageSlot, string> = {
  hero: 'hero_image_job_id',
  mid1: 'mid1_image_job_id',
  mid2: 'mid2_image_job_id',
};
const SLOT_URL_FIELD: Record<ImageSlot, string> = {
  hero: 'editorial_hero_url',
  mid1: 'editorial_mid1_url',
  mid2: 'editorial_mid2_url',
};
const SLOT_KEY_SUFFIX: Record<ImageSlot, string> = {
  hero: 'hero-original.jpg',
  mid1: 'mid1-original.jpg',
  mid2: 'mid2-original.jpg',
};

export async function handleImagePoll(request: Request, taskId: string, slot: string, env: Env): Promise<Response> {
  if (request.method !== 'GET') return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
  if (!['hero', 'mid1', 'mid2'].includes(slot))
    return Response.json({ ok: false, error: 'Invalid slot' }, { status: 400 });

  const typedSlot = slot as ImageSlot;

  const candidate = await env.DB.prepare(
    `SELECT id, slug, ${SLOT_JOB_FIELD[typedSlot]} as job_id FROM review_candidates WHERE ${SLOT_JOB_FIELD[typedSlot]} = ?`
  ).bind(taskId).first<{ id: number; slug: string; job_id: string }>();

  if (!candidate) return Response.json({ ok: false, error: 'Task not found' }, { status: 404 });

  try {
    const result = await pollImageJob(env.KIE_AI_API_KEY, taskId);

    if (result.status === 'done' && result.imageUrl) {
      const imgRes = await fetch(result.imageUrl);
      if (!imgRes.ok) throw new Error(`Failed to download image: ${imgRes.status}`);
      const imgBytes = await imgRes.arrayBuffer();
      // Unique key per job so a regenerated ("Rehacer") image gets a fresh URL
      // instead of overwriting the previous file at a path the CDN has cached.
      const key = `reviews/${candidate.slug}/${taskId}-${SLOT_KEY_SUFFIX[typedSlot]}`;
      await uploadToR2(env.IMAGES, key, imgBytes, 'image/jpeg');
      const finalUrl = buildCfUrl(env.CF_IMAGES_BASE_URL, key);

      await env.DB.prepare(
        `UPDATE review_candidates SET ${SLOT_URL_FIELD[typedSlot]} = ?, updated_at = ? WHERE id = ?`
      ).bind(finalUrl, new Date().toISOString(), candidate.id).run();

      await writeLog(env.DB, candidate.id, `generate-image-${typedSlot}`, 'ok', `Imagen guardada: ${key}`);
      return Response.json({ status: 'done', url: finalUrl });
    }

    if (result.status === 'error') {
      await writeLog(env.DB, candidate.id, `generate-image-${typedSlot}`, 'error', 'kie.ai reportó error en el job de imagen');
      return Response.json({ status: 'error' });
    }

    return Response.json({ status: 'pending' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await writeLog(env.DB, candidate.id, `generate-image-${typedSlot}`, 'error', msg);
    return Response.json({ status: 'error', error: msg });
  }
}
