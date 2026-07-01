const KIE_AI_BASE = 'https://api.kie.ai';

// --- Image generation (async, two-step) ---

// Appended to every image prompt so generated covers/gallery never contain
// text, watermarks, logos, captions, or license plates with lettering.
const NO_TEXT_SUFFIX =
  ' No text, no words, no letters, no numbers, no captions, no watermark, no logo, no signature, no typography, no license plate text. Clean image with zero written characters.';

export async function submitImageJob(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch(`${KIE_AI_BASE}/api/v1/jobs/createTask`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'nano-banana-2',
      input: {
        prompt: `${prompt}${NO_TEXT_SUFFIX}`,
        aspect_ratio: '16:9',
        resolution: '1K',
        output_format: 'jpg',
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`kie.ai image submit error ${res.status}: ${text}`);
  }

  const data = await res.json() as { code: number; data?: { taskId?: string } };
  const taskId = data.data?.taskId;
  if (!taskId) throw new Error(`kie.ai: no taskId in response: ${JSON.stringify(data)}`);
  return taskId;
}

export async function pollImageJob(
  apiKey: string,
  taskId: string,
): Promise<{ status: 'pending' | 'done' | 'error'; imageUrl?: string }> {
  const res = await fetch(`${KIE_AI_BASE}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`kie.ai image poll error ${res.status}: ${text}`);
  }

  const data = await res.json() as {
    code: number;
    data?: {
      state?: string;
      resultJson?: string;
      failMsg?: string;
    };
  };

  const state = data.data?.state ?? '';

  if (state === 'success') {
    let imageUrl: string | undefined;
    try {
      const result = JSON.parse(data.data?.resultJson ?? '{}') as { resultUrls?: string[] };
      imageUrl = result.resultUrls?.[0];
    } catch { /* ignore */ }
    if (!imageUrl) throw new Error('kie.ai: job success but no image URL in resultJson');
    return { status: 'done', imageUrl };
  }

  if (state === 'fail') {
    return { status: 'error' };
  }

  return { status: 'pending' };
}

// --- Video generation (async, two-step) ---

export async function submitVideoJob(apiKey: string, prompt: string, imageUrl: string): Promise<string> {
  const res = await fetch(`${KIE_AI_BASE}/api/v1/jobs/createTask`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'kling/v3-turbo-image-to-video',
      input: {
        prompt,
        image_urls: [imageUrl],
        duration: 5,
        resolution: '720p',
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`kie.ai video submit error ${res.status}: ${text}`);
  }

  const data = await res.json() as { code: number; data?: { taskId?: string } };
  const taskId = data.data?.taskId;
  if (!taskId) throw new Error(`kie.ai: no taskId in video response: ${JSON.stringify(data)}`);
  return taskId;
}

export async function pollVideoJob(
  apiKey: string,
  taskId: string,
): Promise<{ status: 'pending' | 'done' | 'error'; videoUrl?: string }> {
  const res = await fetch(`${KIE_AI_BASE}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`kie.ai video poll error ${res.status}: ${text}`);
  }

  const data = await res.json() as {
    code: number;
    data?: {
      state?: string;
      resultJson?: string;
    };
  };

  const state = data.data?.state ?? '';

  if (state === 'success') {
    let videoUrl: string | undefined;
    try {
      const result = JSON.parse(data.data?.resultJson ?? '{}') as { resultUrls?: string[] };
      videoUrl = result.resultUrls?.[0];
    } catch { /* ignore */ }
    if (!videoUrl) throw new Error('kie.ai: job success but no video URL in resultJson');
    return { status: 'done', videoUrl };
  }

  if (state === 'fail') {
    return { status: 'error' };
  }

  return { status: 'pending' };
}
