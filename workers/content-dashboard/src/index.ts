import { handleList } from './ui/list.js';
import { handleDetail } from './ui/detail.js';
import { handleStatusApi } from './api/status.js';
import { handleGenerateImage } from './api/generate-image.js';
import { handleGenerateVideo } from './api/generate-video.js';
import { handleJobPoll } from './api/job-poll.js';
import { handlePromptSave } from './api/prompt.js';
import { handleCommit } from './api/commit.js';
import { handleClearLogs } from './api/logs.js';

export interface Env {
  DB: D1Database;
  IMAGES: R2Bucket;
  KIE_AI_API_KEY: string;
  GITHUB_TOKEN: string;
  GITHUB_REPO: string;
  CF_IMAGES_BASE_URL: string;
}

const CF_ACCESS_AUD = '4793ec5ef933b3a861171fc79cc9b20a443da006ceb175736c025eda321b7f5a';
const CF_ACCESS_CERTS_URL = 'https://gentle-fog-af89.cloudflareaccess.com/cdn-cgi/access/certs';

async function getPublicKeys(): Promise<JsonWebKey[]> {
  const res = await fetch(CF_ACCESS_CERTS_URL);
  const { keys } = (await res.json()) as { keys: JsonWebKey[] };
  return keys;
}

async function verifyAccessJWT(token: string): Promise<boolean> {
  try {
    const keys = await getPublicKeys();
    for (const key of keys) {
      try {
        const cryptoKey = await crypto.subtle.importKey(
          'jwk',
          key,
          { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
          false,
          ['verify'],
        );
        const [headerB64, payloadB64, sigB64] = token.split('.');
        const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
        const sig = Uint8Array.from(atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')), c =>
          c.charCodeAt(0),
        );
        const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, sig, data);
        if (!valid) continue;
        const payload = JSON.parse(
          atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')),
        ) as { aud: string | string[]; exp: number };
        if (payload.aud !== CF_ACCESS_AUD && payload.aud?.[0] !== CF_ACCESS_AUD) continue;
        if (payload.exp < Math.floor(Date.now() / 1000)) continue;
        return true;
      } catch {
        continue;
      }
    }
    return false;
  } catch {
    return false;
  }
}

function loginRedirect(requestUrl: string): Response {
  const loginUrl = `https://gentle-fog-af89.cloudflareaccess.com/cdn-cgi/access/login/content.frenzycars.com?redirect_url=${encodeURIComponent(new URL(requestUrl).pathname)}`;
  return Response.redirect(loginUrl, 302);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Verify Cloudflare Access JWT
    const token = request.headers.get('Cf-Access-Jwt-Assertion') ?? '';
    if (!token || !(await verifyAccessJWT(token))) {
      return loginRedirect(request.url);
    }

    // API routes
    if (path === '/api/status') return handleStatusApi(request, env.DB);
    if (path === '/api/content/generate-image') return handleGenerateImage(request, env);
    if (path === '/api/content/generate-video') return handleGenerateVideo(request, env);
    if (path === '/api/content/prompt') return handlePromptSave(request, env.DB);
    if (path === '/api/content/commit') return handleCommit(request, env);

    const jobMatch = path.match(/^\/api\/content\/job\/([^/]+)$/);
    if (jobMatch) {
      const jobId = jobMatch[1];
      return handleJobPoll(request, jobId, env);
    }

    const logsMatch = path.match(/^\/api\/content\/logs\/(\d+)$/);
    if (logsMatch) {
      const candidateId = parseInt(logsMatch[1], 10);
      return handleClearLogs(request, candidateId, env.DB);
    }

    // Detail: /123/ or /123
    const detailMatch = path.match(/^\/(\d+)\/?$/);
    if (detailMatch) {
      const id = parseInt(detailMatch[1], 10);
      return handleDetail(id, env);
    }

    // Default: list
    return handleList(url, env.DB);
  },
};
