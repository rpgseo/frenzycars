const KIE_AI_BASE = 'https://api.kie.ai';

export async function generateImage(apiKey: string, prompt: string): Promise<ArrayBuffer> {
  const res = await fetch(`${KIE_AI_BASE}/api/v1/images/generations`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'nano-banana-2',
      prompt,
      width: 1792,
      height: 1008,
      num_images: 1,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`kie.ai image error ${res.status}: ${text}`);
  }

  const data = await res.json() as { data?: Array<{ url?: string; b64_json?: string }> };
  const item = data.data?.[0];

  if (!item) throw new Error('kie.ai: no image in response');

  if (item.url) {
    const imgRes = await fetch(item.url);
    if (!imgRes.ok) throw new Error(`Failed to download image from kie.ai CDN: ${imgRes.status}`);
    return imgRes.arrayBuffer();
  }

  if (item.b64_json) {
    const binary = atob(item.b64_json);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  throw new Error('kie.ai: response has neither url nor b64_json');
}

export async function submitVideoJob(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch(`${KIE_AI_BASE}/api/v1/videos/generations`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'kling-3.0-turbo',
      prompt,
      duration: 5,
      aspect_ratio: '16:9',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`kie.ai video submit error ${res.status}: ${text}`);
  }

  const data = await res.json() as { id?: string; task_id?: string };
  const jobId = data.id ?? data.task_id;
  if (!jobId) throw new Error('kie.ai: no job id in video submit response');
  return jobId;
}

export async function pollVideoJob(
  apiKey: string,
  jobId: string
): Promise<{ status: 'pending' | 'done' | 'error'; videoUrl?: string }> {
  const res = await fetch(`${KIE_AI_BASE}/api/v1/videos/generations/${jobId}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`kie.ai poll error ${res.status}: ${text}`);
  }

  const data = await res.json() as {
    status?: string;
    task_status?: string;
    output?: { url?: string };
    video_url?: string;
  };

  const status = data.status ?? data.task_status ?? '';

  if (status === 'succeeded' || status === 'completed' || status === 'done') {
    const videoUrl = data.output?.url ?? data.video_url;
    if (!videoUrl) throw new Error('kie.ai: job done but no video URL in response');
    return { status: 'done', videoUrl };
  }

  if (status === 'failed' || status === 'error') {
    return { status: 'error' };
  }

  return { status: 'pending' };
}
