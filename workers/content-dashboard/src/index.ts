export interface Env {
  DB: D1Database;
}

const CF_ACCESS_AUD = '4793ec5ef933b3a861171fc79cc9b20a443da006ceb175736c025eda321b7f5a';
const CF_ACCESS_CERTS_URL = 'https://gentle-fog-af89.cloudflareaccess.com/cdn-cgi/access/certs';

async function getPublicKeys(): Promise<JsonWebKey[]> {
  const res = await fetch(CF_ACCESS_CERTS_URL);
  const { keys } = await res.json() as { keys: JsonWebKey[] };
  return keys;
}

async function verifyAccessJWT(token: string): Promise<boolean> {
  try {
    const keys = await getPublicKeys();
    for (const key of keys) {
      try {
        const cryptoKey = await crypto.subtle.importKey(
          'jwk', key, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']
        );
        const [headerB64, payloadB64, sigB64] = token.split('.');
        const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
        const sig = Uint8Array.from(atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
        const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, sig, data);
        if (!valid) continue;
        const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
        if (payload.aud !== CF_ACCESS_AUD && payload.aud?.[0] !== CF_ACCESS_AUD) continue;
        if (payload.exp < Math.floor(Date.now() / 1000)) continue;
        return true;
      } catch { continue; }
    }
    return false;
  } catch { return false; }
}

function loginRedirect(requestUrl: string): Response {
  const loginUrl = `https://gentle-fog-af89.cloudflareaccess.com/cdn-cgi/access/login/content.frenzycars.com?redirect_url=${encodeURIComponent(new URL(requestUrl).pathname)}`;
  return Response.redirect(loginUrl, 302);
}

type CandidateStatus = 'suggested' | 'approved' | 'rejected' | 'published';

interface ReviewCandidate {
  id: number;
  make: string;
  model: string;
  year: number | null;
  slug: string;
  keyword: string | null;
  search_volume: number | null;
  keyword_difficulty: number | null;
  trend_score: number | null;
  reference_image_url: string | null;
  editorial_hero_url: string | null;
  editorial_mid1_url: string | null;
  editorial_mid2_url: string | null;
  video_url: string | null;
  hero_prompt: string | null;
  status: CandidateStatus;
  raw_data: string | null;
  created_at: string;
  updated_at: string;
}

const ALLOWED_STATUSES: CandidateStatus[] = ['suggested', 'approved', 'rejected', 'published'];
const STATUS_LABELS: Record<CandidateStatus, string> = {
  suggested: 'Suggested', approved: 'Approved', rejected: 'Rejected', published: 'Published',
};
const STATUS_COLORS: Record<CandidateStatus, string> = {
  suggested: '#888', approved: '#22c55e', rejected: '#ef4444', published: '#3b82f6',
};

const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:Inter,system-ui,sans-serif;background:#0d0d0d;color:#e5e5e5;min-height:100vh}
.shell{max-width:1100px;margin:0 auto;padding:2rem 1.5rem}
.header{display:flex;align-items:center;gap:1rem;margin-bottom:2rem;padding-bottom:1rem;border-bottom:1px solid #222}
.header a{color:#F7D720;text-decoration:none;font-weight:700;font-size:1.1rem;letter-spacing:-0.02em}
.header span{color:#555;font-size:.9rem}
h1{font-size:1.6rem;font-weight:800;margin-bottom:1.5rem}
.filters{display:flex;gap:.5rem;margin-bottom:1.5rem;flex-wrap:wrap}
.filter-link{padding:.35rem .9rem;border-radius:999px;font-size:.8rem;font-weight:600;text-decoration:none;background:#1a1a1a;color:#aaa;border:1px solid #2a2a2a}
.filter-link:hover{border-color:#F7D720;color:#F7D720}
.filter-link.active{background:#F7D720;color:#000;border-color:#F7D720}
.error{background:#2a0a0a;border:1px solid #7f1d1d;color:#fca5a5;padding:1rem 1.25rem;border-radius:8px;margin-bottom:1.5rem}
table{width:100%;border-collapse:collapse;font-size:.9rem}
th{text-align:left;padding:.6rem 1rem;color:#666;font-weight:600;font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #1a1a1a}
td{padding:.8rem 1rem;border-bottom:1px solid #141414;vertical-align:middle}
tr:hover td{background:#111}
.car-name{font-weight:700;color:#fff}
.car-year{color:#666;font-size:.8rem}
.badge{display:inline-block;padding:.2rem .7rem;border-radius:999px;font-size:.75rem;font-weight:700}
.view-link{color:#F7D720;text-decoration:none;font-weight:600;font-size:.85rem}
.empty{text-align:center;color:#555;padding:3rem;font-size:.95rem}
.count{color:#555;font-size:.85rem;margin-bottom:1rem}
.back{color:#F7D720;text-decoration:none;font-size:.85rem;display:inline-block;margin-bottom:1.5rem}
.car-heading{display:flex;align-items:center;gap:1rem;margin-bottom:2rem;flex-wrap:wrap}
.car-heading h1{margin:0}
.sections{display:grid;gap:1.5rem}
.section{background:#111;border:1px solid #1e1e1e;border-radius:10px;padding:1.5rem}
.section-title{font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#555;margin-bottom:1rem}
.grid-2{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1rem}
.stat-label{font-size:.75rem;color:#555;margin-bottom:.2rem}
.stat-value{font-weight:600;color:#e5e5e5}
.stat-value.empty{color:#333;font-style:italic;font-weight:400}
.image-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:1rem}
.image-placeholder{background:#1a1a1a;border:1px dashed #2a2a2a;border-radius:8px;aspect-ratio:16/9;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#333;font-size:.75rem;text-align:center;gap:.4rem}
.image-preview{border-radius:8px;width:100%;aspect-ratio:16/9;object-fit:cover}
.raw-data{background:#0a0a0a;border-radius:6px;padding:1rem;font-size:.8rem;color:#666;font-family:monospace;overflow-x:auto;white-space:pre-wrap}
.prompt-text{font-size:.85rem;color:#888;font-style:italic;line-height:1.5}
.actions{display:flex;gap:1rem;flex-wrap:wrap}
.btn{padding:.6rem 1.4rem;border-radius:8px;font-size:.9rem;font-weight:700;border:none;cursor:pointer;transition:opacity .15s}
.btn:hover{opacity:.85}
.btn-approve{background:#22c55e;color:#000}
.btn-reject{background:#ef4444;color:#fff}
.btn-suggest{background:#555;color:#fff}
.btn-publish{background:#3b82f6;color:#fff}
.status-msg{margin-top:1rem;font-size:.85rem;color:#22c55e}
.status-msg.error{color:#ef4444}
`;

function html(title: string, body: string): Response {
  return new Response(`<!doctype html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${title} | FrenzyCars Content</title>
<meta name="robots" content="noindex,nofollow">
<style>${CSS}</style>
</head><body><div class="shell">
<header class="header"><a href="/">FrenzyCars Content</a><span>·</span><span>${escHtml(title)}</span></header>
${body}
</div></body></html>`, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function escHtml(s: string | null | number): string {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function badge(status: CandidateStatus): string {
  const c = STATUS_COLORS[status];
  return `<span class="badge" style="background:${c}22;color:${c};border:1px solid ${c}44">${STATUS_LABELS[status]}</span>`;
}

function statVal(v: string | number | null, label: string): string {
  return `<div class="stat"><div class="stat-label">${label}</div>
<div class="stat-value${v == null ? ' empty' : ''}">${v != null ? escHtml(typeof v === 'number' ? v.toLocaleString() : v) : 'Not set yet'}</div></div>`;
}

function imgSlot(url: string | null, emoji: string, label: string): string {
  if (url) return `<img src="${escHtml(url)}" alt="${escHtml(label)}" class="image-preview">`;
  return `<div class="image-placeholder"><span>${emoji}</span><span>${label}<br>not available yet</span></div>`;
}

// ── Routes ─────────────────────────────────────────────────────────────────

async function handleList(url: URL, db: D1Database): Promise<Response> {
  const rawStatus = url.searchParams.get('status');
  const statusFilter = rawStatus && (ALLOWED_STATUSES as string[]).includes(rawStatus)
    ? rawStatus as CandidateStatus : undefined;

  let candidates: ReviewCandidate[] = [];
  let error = '';
  try {
    const q = statusFilter
      ? db.prepare('SELECT * FROM review_candidates WHERE status = ? ORDER BY created_at DESC').bind(statusFilter)
      : db.prepare('SELECT * FROM review_candidates ORDER BY created_at DESC');
    candidates = (await q.all<ReviewCandidate>()).results;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const filters = ['', ...ALLOWED_STATUSES].map(s => {
    const active = s === '' ? !statusFilter : statusFilter === s;
    const href = s ? `/?status=${s}` : '/';
    const label = s ? STATUS_LABELS[s as CandidateStatus] : 'All';
    return `<a href="${href}" class="filter-link${active ? ' active' : ''}">${label}</a>`;
  }).join('');

  let tableHtml = '';
  if (error) {
    tableHtml = `<div class="error">Error: ${escHtml(error)}</div>`;
  } else if (candidates.length === 0) {
    tableHtml = `<div class="empty">No candidates yet. Run the seed script to add some.</div>`;
  } else {
    const rows = candidates.map(c => `<tr>
<td><span class="car-name">${escHtml(c.make)} ${escHtml(c.model)}</span>${c.year ? `<span class="car-year"> · ${c.year}</span>` : ''}</td>
<td>${c.keyword ? escHtml(c.keyword) : '<span style="color:#444">—</span>'}</td>
<td>${c.search_volume != null ? c.search_volume.toLocaleString() : '<span style="color:#444">—</span>'}</td>
<td>${c.keyword_difficulty ?? '<span style="color:#444">—</span>'}</td>
<td>${badge(c.status)}</td>
<td><a href="/${c.id}/" class="view-link">Ver →</a></td>
</tr>`).join('');
    tableHtml = `<p class="count">${candidates.length} candidate${candidates.length !== 1 ? 's' : ''}${statusFilter ? ` · ${STATUS_LABELS[statusFilter]}` : ''}</p>
<table><thead><tr><th>Car</th><th>Keyword</th><th>Volume</th><th>KD</th><th>Status</th><th></th></tr></thead>
<tbody>${rows}</tbody></table>`;
  }

  return html('Reviews Pipeline', `
<h1>Reviews Pipeline</h1>
<nav class="filters">${filters}</nav>
${tableHtml}`);
}

async function handleDetail(id: number, db: D1Database): Promise<Response> {
  const candidate = await db
    .prepare('SELECT * FROM review_candidates WHERE id = ?')
    .bind(id)
    .first<ReviewCandidate>();

  if (!candidate) {
    return new Response('Candidate not found', { status: 404 });
  }

  const c = STATUS_COLORS[candidate.status];
  const rawData = candidate.raw_data
    ? `<pre class="raw-data">${escHtml(JSON.stringify(JSON.parse(candidate.raw_data), null, 2))}</pre>`
    : `<p class="stat-value empty">Data not collected yet</p>`;

  const actionButtons = ALLOWED_STATUSES
    .filter(s => s !== candidate.status)
    .map(s => `<button class="btn btn-${s}" onclick="setStatus(${candidate.id},'${s}')">${STATUS_LABELS[s]}</button>`)
    .join('');

  const body = `
<a href="/" class="back">← Back to pipeline</a>
<div class="car-heading">
  <h1>${escHtml(candidate.make)} ${escHtml(candidate.model)}${candidate.year ? ` ${candidate.year}` : ''}</h1>
  <span id="status-badge" class="badge" style="background:${c}22;color:${c};border:1px solid ${c}44">${STATUS_LABELS[candidate.status]}</span>
</div>
<div class="sections">
  <div class="section">
    <div class="section-title">SEO Data (Step 1)</div>
    <div class="grid-2">
      ${statVal(candidate.keyword, 'Keyword')}
      ${statVal(candidate.search_volume, 'Monthly Volume')}
      ${statVal(candidate.keyword_difficulty, 'Keyword Difficulty')}
      ${statVal(candidate.trend_score, 'Trend Score')}
    </div>
  </div>
  <div class="section">
    <div class="section-title">Images (Steps 2–3)</div>
    <div class="image-grid">
      ${imgSlot(candidate.reference_image_url, '📷', 'Reference image')}
      ${imgSlot(candidate.editorial_hero_url, '🎨', 'Editorial hero')}
      ${imgSlot(candidate.editorial_mid1_url, '🎨', 'Mid image 1')}
      ${imgSlot(candidate.editorial_mid2_url, '🎨', 'Mid image 2')}
    </div>
    ${candidate.hero_prompt ? `<div style="margin-top:1rem"><div class="stat-label" style="margin-bottom:.4rem">Hero prompt</div><p class="prompt-text">${escHtml(candidate.hero_prompt)}</p></div>` : ''}
  </div>
  <div class="section">
    <div class="section-title">Video (Step 4)</div>
    ${candidate.video_url
      ? `<video src="${escHtml(candidate.video_url)}" controls style="width:100%;border-radius:8px;max-width:640px"></video>`
      : `<div class="image-placeholder" style="max-width:320px;aspect-ratio:16/9"><span>🎬</span><span>Video not generated yet</span></div>`}
  </div>
  <div class="section">
    <div class="section-title">Scraped Data (Step 5)</div>
    ${rawData}
  </div>
  <div class="section">
    <div class="section-title">Actions</div>
    <div class="actions">${actionButtons}</div>
    <div id="action-msg" class="status-msg" style="display:none"></div>
  </div>
</div>
<script>
const COLORS={suggested:'#888',approved:'#22c55e',rejected:'#ef4444',published:'#3b82f6'};
const LABELS={suggested:'Suggested',approved:'Approved',rejected:'Rejected',published:'Published'};
async function setStatus(id,status){
  const msg=document.getElementById('action-msg');
  msg.style.display='none';
  try{
    const r=await fetch('/api/status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status})});
    const data=await r.json();
    if(data.ok){
      const badge=document.getElementById('status-badge');
      const c=COLORS[status];
      badge.textContent=LABELS[status];
      badge.style.background=c+'22';badge.style.color=c;badge.style.border='1px solid '+c+'44';
      msg.className='status-msg';msg.textContent='Status updated to '+LABELS[status];msg.style.display='block';
    }else{
      msg.className='status-msg error';msg.textContent=data.error||'Error';msg.style.display='block';
    }
  }catch(e){
    msg.className='status-msg error';msg.textContent='Network error';msg.style.display='block';
  }
}
</script>`;

  return html(`${candidate.make} ${candidate.model}`, body);
}

async function handleStatusApi(request: Request, db: D1Database): Promise<Response> {
  if (request.method !== 'POST') {
    return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
  }
  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }
  const { id, status } = body as Record<string, unknown>;
  const parsedId = typeof id === 'number' ? id : typeof id === 'string' ? parseInt(id, 10) : NaN;
  if (!Number.isFinite(parsedId) || parsedId <= 0) {
    return Response.json({ ok: false, error: 'Invalid id' }, { status: 400 });
  }
  if (typeof status !== 'string' || !(ALLOWED_STATUSES as string[]).includes(status)) {
    return Response.json({ ok: false, error: 'Invalid status' }, { status: 400 });
  }
  const updatedAt = new Date().toISOString();
  const result = await db
    .prepare('UPDATE review_candidates SET status = ?, updated_at = ? WHERE id = ?')
    .bind(status, updatedAt, parsedId)
    .run();
  if ((result.meta.changes ?? 0) === 0) {
    return Response.json({ ok: false, error: 'Candidate not found' }, { status: 404 });
  }
  return Response.json({ ok: true, status });
}

// ── Main handler ────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Verify Cloudflare Access JWT
    const token = request.headers.get('Cf-Access-Jwt-Assertion') ?? '';
    if (!token || !(await verifyAccessJWT(token))) {
      return loginRedirect(request.url);
    }

    // API
    if (path === '/api/status') return handleStatusApi(request, env.DB);

    // Detail: /123/ or /123
    const detailMatch = path.match(/^\/(\d+)\/?$/);
    if (detailMatch) {
      const id = parseInt(detailMatch[1], 10);
      return handleDetail(id, env.DB);
    }

    // List: / or anything else → list
    return handleList(url, env.DB);
  },
};
