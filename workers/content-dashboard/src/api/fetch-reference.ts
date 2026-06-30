import type { Env } from '../index.js';
import { writeLog } from '../lib/db.js';
import { uploadToR2, buildCfUrlFull } from '../lib/r2.js';

export async function handleFetchReference(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { id } = body as Record<string, unknown>;
  const parsedId = typeof id === 'number' ? id : typeof id === 'string' ? parseInt(id, 10) : NaN;
  if (!Number.isFinite(parsedId) || parsedId <= 0)
    return Response.json({ ok: false, error: 'Invalid id' }, { status: 400 });

  const candidate = await env.DB.prepare(
    'SELECT id, make, model, year, slug FROM review_candidates WHERE id = ?'
  ).bind(parsedId).first<{ id: number; make: string; model: string; year: number | null; slug: string }>();

  if (!candidate) return Response.json({ ok: false, error: 'Candidate not found' }, { status: 404 });

  await writeLog(env.DB, parsedId, 'fetch-reference', 'pending', `Buscando imagen en CarImages para ${candidate.make} ${candidate.model}…`);

  try {
    // Get signed URL from CarImages server-side (bypasses domain check with api_secret)
    const params = new URLSearchParams({
      api_key: env.CARIMAGES_API_KEY,
      api_secret: env.CARIMAGES_API_SECRET,
      make: candidate.make,
      model: candidate.model,
      width: '1200',
      format: 'webp',
    });
    if (candidate.year) params.set('year', String(candidate.year));

    const signedRes = await fetch(`https://carimagesapi.com/api/v1/signed-url?${params}`);
    if (!signedRes.ok) {
      const errText = await signedRes.text();
      throw new Error(`CarImages signed-url error ${signedRes.status}: ${errText}`);
    }
    const { url: imageUrl } = await signedRes.json() as { url: string };

    // Download the image
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error(`CarImages image download failed: ${imgRes.status}`);
    const imgBytes = await imgRes.arrayBuffer();

    // Upload to R2
    const key = `reviews/${candidate.slug}/reference.webp`;
    await uploadToR2(env.IMAGES, key, imgBytes, 'image/webp');
    const finalUrl = buildCfUrlFull(env.CF_IMAGES_BASE_URL, key);

    // Save to D1
    await env.DB.prepare(
      'UPDATE review_candidates SET reference_image_url = ?, updated_at = ? WHERE id = ?'
    ).bind(finalUrl, new Date().toISOString(), parsedId).run();

    await writeLog(env.DB, parsedId, 'fetch-reference', 'ok', `Imagen de referencia guardada: ${key}`);
    return Response.json({ ok: true, url: finalUrl });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await writeLog(env.DB, parsedId, 'fetch-reference', 'error', msg);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
