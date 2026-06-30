import type { Env } from '../index.js';
import { writeLog } from '../lib/db.js';
import { pollVideoJob } from '../lib/kieai.js';
import { uploadToR2, buildCfUrlFull } from '../lib/r2.js';

export async function handleJobPoll(request: Request, jobId: string, env: Env): Promise<Response> {
  if (request.method !== 'GET') return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
  if (!jobId) return Response.json({ ok: false, error: 'Missing job_id' }, { status: 400 });

  const candidate = await env.DB.prepare(
    'SELECT * FROM review_candidates WHERE video_job_id = ?'
  ).bind(jobId).first<{ id: number; slug: string; video_status: string }>();

  if (!candidate) return Response.json({ ok: false, error: 'Job not found' }, { status: 404 });

  if (candidate.video_status === 'done') return Response.json({ status: 'done' });
  if (candidate.video_status === 'error') return Response.json({ status: 'error' });

  try {
    const result = await pollVideoJob(env.KIE_AI_API_KEY, jobId);

    if (result.status === 'done' && result.videoUrl) {
      const videoRes = await fetch(result.videoUrl);
      if (!videoRes.ok) throw new Error(`Failed to download video: ${videoRes.status}`);
      const videoBytes = await videoRes.arrayBuffer();
      const key = `reviews/${candidate.slug}/video.mp4`;
      await uploadToR2(env.IMAGES, key, videoBytes, 'video/mp4');
      const finalUrl = buildCfUrlFull(env.CF_IMAGES_BASE_URL, key);

      await env.DB.prepare(
        'UPDATE review_candidates SET video_url = ?, video_status = ?, updated_at = ? WHERE id = ?'
      ).bind(finalUrl, 'done', new Date().toISOString(), candidate.id).run();

      await writeLog(env.DB, candidate.id, 'video-poll', 'ok', `Vídeo guardado: ${key}`);
      return Response.json({ status: 'done', url: finalUrl });
    }

    if (result.status === 'error') {
      await env.DB.prepare('UPDATE review_candidates SET video_status = ? WHERE id = ?')
        .bind('error', candidate.id).run();
      await writeLog(env.DB, candidate.id, 'video-poll', 'error', 'kie.ai reportó error en el job');
      return Response.json({ status: 'error' });
    }

    return Response.json({ status: 'pending' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await writeLog(env.DB, candidate.id, 'video-poll', 'error', msg);
    return Response.json({ status: 'error', error: msg });
  }
}
