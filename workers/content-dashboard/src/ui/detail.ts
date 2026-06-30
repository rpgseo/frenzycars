import type { Env } from '../index.js';
import {
  ReviewCandidate,
  CandidateStatus,
  escHtml,
  html,
  STATUS_LABELS,
  STATUS_COLORS,
  ALLOWED_STATUSES,
} from './shared.js';
import { getCandidate, getLogs, CandidateLog } from '../lib/db.js';

// Silence unused-import lint for badge/CandidateStatus (used via type)
type _CandidateStatusAlias = CandidateStatus;

function carLabel(c: ReviewCandidate): string {
  return `${c.year ? c.year + ' ' : ''}${c.make} ${c.model}`;
}

function defaultPrompt(slot: 'hero' | 'mid1' | 'mid2' | 'video', c: ReviewCandidate): string {
  const label = carLabel(c);
  switch (slot) {
    case 'hero':
      return `Editorial hero shot of a ${label}, dynamic angle, cinematic automotive photography, magazine style`;
    case 'mid1':
      return `Interior detail of a ${label}, dramatic lighting, automotive magazine photography`;
    case 'mid2':
      return `Three-quarter rear shot of a ${label}, motion blur background, editorial style`;
    case 'video':
      return `Dynamic driving footage of a ${label}, cinematic car commercial style, golden hour lighting`;
  }
}

function imageSlot(
  c: ReviewCandidate,
  slot: 'hero' | 'mid1' | 'mid2',
  label: string,
  urlField: keyof ReviewCandidate,
  promptField: keyof ReviewCandidate,
): string {
  const url = c[urlField] as string | null;
  const promptValue = (c[promptField] as string | null) ?? defaultPrompt(slot, c);

  const previewHtml = url
    ? `<img class="image-preview" src="${escHtml(url)}" onclick="openLightbox('${escHtml(url)}')" title="Click para ampliar">`
    : `<div class="image-placeholder"><span>🎨</span><span>No generada aún</span></div>`;

  const btnClass = url ? 'btn btn-redo' : 'btn btn-generate';
  const btnText = url ? '↺ Rehacer' : 'Generar imagen';

  return `
<div class="image-slot" id="slot-${slot}">
  <div class="image-slot-label">${escHtml(label)}</div>
  <div class="image-slot-preview">${previewHtml}</div>
  <textarea class="prompt-area" id="prompt-${slot}" data-id="${c.id}">${escHtml(promptValue)}</textarea>
  <div class="slot-actions">
    <button id="btn-${slot}" class="${btnClass}" onclick="generateImage(${c.id},'${slot}')">${btnText}</button>
  </div>
  <div id="msg-${slot}" class="status-msg" style="display:none"></div>
</div>`;
}

function videoSection(c: ReviewCandidate): string {
  let videoHtml: string;
  if (c.video_url && c.video_status === 'done') {
    videoHtml = `<video src="${escHtml(c.video_url)}" controls style="width:100%;max-width:640px;border-radius:8px"></video>`;
  } else if (c.video_status === 'pending') {
    videoHtml = `<div class="video-placeholder"><span class="spinner"></span><span>Generando... (puede tardar varios minutos)</span></div>`;
  } else {
    videoHtml = `<div class="video-placeholder"><span>🎬</span><span>Video not generated yet</span></div>`;
  }

  const promptValue = c.video_prompt ?? defaultPrompt('video', c);
  const isPending = c.video_status === 'pending';
  const isDone = c.video_status === 'done' && !!c.video_url;
  const btnText = isPending ? '<span class="spinner"></span>Generando...' : (isDone ? '↺ Rehacer vídeo' : 'Generar vídeo');

  const safeJobId = c.video_job_id ? c.video_job_id.replace(/\\/g, '\\\\').replace(/'/g, "\\'") : '';
  const pollingScript = isPending && c.video_job_id
    ? `<script>startVideoPolling('${safeJobId}');</script>`
    : '';

  return `
<div class="section">
  <div class="section-title">Video (Step 4)</div>
  <div id="video-container">${videoHtml}</div>
  <textarea class="prompt-area" id="prompt-video" data-id="${c.id}" style="margin-top:.75rem">${escHtml(promptValue)}</textarea>
  <div class="slot-actions" style="margin-top:.5rem">
    <button id="btn-video" class="btn btn-generate" onclick="generateVideo(${c.id})"${isPending ? ' disabled' : ''}>${btnText}</button>
  </div>
  <div id="msg-video" class="status-msg" style="display:none"></div>
  ${pollingScript}
</div>`;
}

function commitSection(c: ReviewCandidate, githubRepo: string): string {
  const checks: Array<{ label: string; ok: boolean; optional?: boolean }> = [
    { label: 'cover ← editorial_hero_url', ok: !!c.editorial_hero_url },
    { label: 'gallery[0] ← editorial_mid1_url', ok: !!c.editorial_mid1_url },
    { label: 'gallery[1] ← editorial_mid2_url', ok: !!c.editorial_mid2_url },
    { label: 'video ← video_url', ok: !!c.video_url, optional: true },
  ];

  const checkItems = checks
    .map(ch => {
      const icon = ch.ok ? '✓' : '✗';
      const cls = ch.ok ? 'check-ok' : 'check-no';
      const optNote = ch.optional && !ch.ok ? ' (opcional)' : '';
      return `<li class="${cls}">${icon} ${escHtml(ch.label)}${optNote}</li>`;
    })
    .join('');

  const canCommit = !!c.editorial_hero_url;

  const commitResult = c.last_commit_sha
    ? `<div class="commit-result">Último commit: <a href="https://github.com/${escHtml(githubRepo)}/commit/${escHtml(c.last_commit_sha)}" target="_blank" style="color:#4ade80">${escHtml(c.last_commit_sha.slice(0, 7))}</a></div>`
    : '';

  return `
<div class="section">
  <div class="section-title">Publicar en repositorio</div>
  <div style="font-size:.8rem;color:#555;margin-bottom:.75rem;font-family:monospace">src/content/reviews/${escHtml(c.slug)}.md</div>
  <ul class="checklist">${checkItems}</ul>
  <div style="margin-top:1rem">
    <button class="btn btn-commit" onclick="commitToRepo(${c.id})"${canCommit ? '' : ' disabled'}>Insertar en post →</button>
  </div>
  <div id="msg-commit" class="status-msg" style="display:none"></div>
  ${commitResult}
</div>`;
}

function logsSection(logs: CandidateLog[], candidateId: number): string {
  const count = logs.length;

  let content: string;
  if (count === 0) {
    content = `<p style="color:#555;font-size:.85rem;padding:.5rem 0">Sin actividad aún.</p>`;
  } else {
    const rows = logs
      .map(log => {
        const ts = log.ts.replace('T', ' ').slice(0, 19);
        let icon: string;
        let iconClass: string;
        if (log.status === 'ok') {
          icon = '✓';
          iconClass = 'log-ok';
        } else if (log.status === 'error') {
          icon = '✗';
          iconClass = 'log-error';
        } else {
          icon = '⏳';
          iconClass = 'log-pending';
        }
        return `<tr>
          <td>${escHtml(ts)}</td>
          <td class="${iconClass}">${icon}</td>
          <td>${escHtml(log.operation)}</td>
          <td>${escHtml(log.message ?? '')}</td>
        </tr>`;
      })
      .join('');
    content = `<table class="logs-table">
      <thead><tr><th>Timestamp</th><th></th><th>Operación</th><th>Detalle</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  return `
<details>
  <summary>LOGS (${count} entradas)</summary>
  <div style="margin-top:.75rem">${content}</div>
  <div style="margin-top:.75rem">
    <button class="btn btn-danger" onclick="clearLogs(${candidateId})">Limpiar logs</button>
  </div>
</details>`;
}

const CLIENT_JS = `
const DEBOUNCE = {};

function debounce(key, fn, ms) {
  clearTimeout(DEBOUNCE[key]);
  DEBOUNCE[key] = setTimeout(fn, ms);
}

function savePrompt(id, field, value) {
  debounce('prompt-' + field, () => {
    fetch('/api/content/prompt', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, field, value }),
    });
  }, 800);
}

async function generateImage(id, slot) {
  const prompt = document.getElementById('prompt-' + slot).value.trim();
  if (!prompt) return;
  const btn = document.getElementById('btn-' + slot);
  const msg = document.getElementById('msg-' + slot);
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Generando...';
  msg.style.display = 'none';
  try {
    const r = await fetch('/api/content/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, slot, prompt }),
    });
    const data = await r.json();
    if (data.ok) {
      const preview = document.querySelector('#slot-' + slot + ' .image-slot-preview');
      const img = document.createElement('img');
      img.src = data.url;
      img.className = 'image-preview';
      img.title = 'Click para ampliar';
      img.onclick = () => openLightbox(data.url);
      preview.innerHTML = '';
      preview.appendChild(img);
      btn.className = 'btn btn-redo';
      btn.innerHTML = '\\u21ba Rehacer';
      btn.disabled = false;
    } else {
      msg.className = 'status-msg error';
      msg.textContent = data.error || 'Error generando imagen';
      msg.style.display = 'block';
      btn.disabled = false;
      btn.innerHTML = btn.className.includes('btn-redo') ? '\\u21ba Rehacer' : 'Generar imagen';
    }
  } catch (e) {
    msg.className = 'status-msg error';
    msg.textContent = 'Error de red';
    msg.style.display = 'block';
    btn.disabled = false;
    btn.innerHTML = btn.className.includes('btn-redo') ? '\\u21ba Rehacer' : 'Generar imagen';
  }
}

async function generateVideo(id) {
  const prompt = document.getElementById('prompt-video').value.trim();
  if (!prompt) return;
  const btn = document.getElementById('btn-video');
  const msg = document.getElementById('msg-video');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Enviando...';
  msg.style.display = 'none';
  try {
    const r = await fetch('/api/content/generate-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, prompt }),
    });
    const data = await r.json();
    if (data.ok) {
      document.getElementById('video-container').innerHTML =
        '<div class="video-placeholder"><span>\\uD83C\\uDFAC</span><span id="video-pending-text"><span class="spinner"></span>Generando... (puede tardar varios minutos)</span></div>';
      btn.innerHTML = '<span class="spinner"></span>Generando...';
      startVideoPolling(data.job_id);
    } else {
      msg.className = 'status-msg error';
      msg.textContent = data.error || 'Error enviando job de v\\u00EDdeo';
      msg.style.display = 'block';
      btn.disabled = false;
      btn.innerHTML = 'Generar v\\u00EDdeo';
    }
  } catch (e) {
    msg.className = 'status-msg error';
    msg.textContent = 'Error de red';
    msg.style.display = 'block';
    btn.disabled = false;
    btn.innerHTML = 'Generar v\\u00EDdeo';
  }
}

let pollInterval = null;
function startVideoPolling(jobId) {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(async () => {
    try {
      const r = await fetch('/api/content/job/' + jobId);
      const data = await r.json();
      if (data.status === 'done') {
        clearInterval(pollInterval);
        const btn = document.getElementById('btn-video');
        const vid = document.createElement('video');
        vid.src = data.url;
        vid.controls = true;
        vid.style.cssText = 'width:100%;max-width:640px;border-radius:8px';
        const vc = document.getElementById('video-container');
        vc.innerHTML = '';
        vc.appendChild(vid);
        btn.disabled = false;
        btn.className = 'btn btn-redo';
        btn.innerHTML = '\\u21ba Rehacer v\\u00EDdeo';
      } else if (data.status === 'error') {
        clearInterval(pollInterval);
        const btn = document.getElementById('btn-video');
        btn.disabled = false;
        btn.innerHTML = 'Generar v\\u00EDdeo';
        const msg = document.getElementById('msg-video');
        msg.className = 'status-msg error';
        msg.textContent = 'Error generando v\\u00EDdeo. Revisa los logs.';
        msg.style.display = 'block';
      }
    } catch (_) {}
  }, 5000);
}

async function commitToRepo(id) {
  const btn = document.querySelector('[onclick="commitToRepo(' + id + ')"]');
  const msg = document.getElementById('msg-commit');
  btn.disabled = true;
  btn.textContent = 'Insertando...';
  msg.style.display = 'none';
  try {
    const r = await fetch('/api/content/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const data = await r.json();
    if (data.ok) {
      msg.className = 'status-msg';
      msg.innerHTML = 'Post actualizado \\u2014 <a href="' + data.github_url + '" target="_blank" style="color:#4ade80">ver commit ' + data.commit_sha.slice(0,7) + '</a>';
      msg.style.display = 'block';
      btn.textContent = 'Insertar en post \\u2192';
      btn.disabled = false;
    } else {
      msg.className = 'status-msg error';
      msg.textContent = data.error || 'Error al commitear';
      msg.style.display = 'block';
      btn.textContent = 'Insertar en post \\u2192';
      btn.disabled = false;
    }
  } catch (e) {
    msg.className = 'status-msg error';
    msg.textContent = 'Error de red';
    msg.style.display = 'block';
    btn.textContent = 'Insertar en post \\u2192';
    btn.disabled = false;
  }
}

async function clearLogs(id) {
  await fetch('/api/content/logs/' + id, { method: 'DELETE' });
  location.reload();
}

const COLORS = { suggested:'#888', approved:'#22c55e', rejected:'#ef4444', published:'#3b82f6' };
const LABELS = { suggested:'Suggested', approved:'Approved', rejected:'Rejected', published:'Published' };
async function setStatus(id, status) {
  const msg = document.getElementById('action-msg');
  msg.style.display = 'none';
  try {
    const r = await fetch('/api/status', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id,status}) });
    const data = await r.json();
    if (data.ok) {
      const b = document.getElementById('status-badge');
      const c = COLORS[status];
      b.textContent = LABELS[status];
      b.style.background = c + '22'; b.style.color = c; b.style.border = '1px solid ' + c + '44';
      msg.className = 'status-msg'; msg.textContent = 'Status updated to ' + LABELS[status]; msg.style.display = 'block';
    } else {
      msg.className = 'status-msg error'; msg.textContent = data.error || 'Error'; msg.style.display = 'block';
    }
  } catch (e) {
    msg.className = 'status-msg error'; msg.textContent = 'Network error'; msg.style.display = 'block';
  }
}

function openLightbox(url) {
  const lb = document.getElementById('lightbox');
  const img = document.getElementById('lightbox-img');
  img.src = url;
  lb.classList.add('open');
}
function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });

['hero','mid1','mid2'].forEach(slot => {
  const el = document.getElementById('prompt-' + slot);
  if (el) el.addEventListener('input', () => savePrompt(Number(el.dataset.id), slot + '_prompt', el.value));
});
const vp = document.getElementById('prompt-video');
if (vp) vp.addEventListener('input', () => savePrompt(Number(vp.dataset.id), 'video_prompt', vp.value));
`;

export async function handleDetail(id: number, env: Env): Promise<Response> {
  const candidate = await getCandidate(env.DB, id);
  if (!candidate) return new Response('Candidate not found', { status: 404 });

  const logs = await getLogs(env.DB, id);

  const c = STATUS_COLORS[candidate.status];
  const actionButtons = ALLOWED_STATUSES
    .filter(s => s !== candidate.status)
    .map(s => `<button class="btn btn-${s}" onclick="setStatus(${candidate.id},'${s}')">${STATUS_LABELS[s]}</button>`)
    .join('');

  let rawData: string;
  try {
    rawData = candidate.raw_data
      ? `<pre class="raw-data">${escHtml(JSON.stringify(JSON.parse(candidate.raw_data), null, 2))}</pre>`
      : `<p class="stat-value empty">Data not collected yet</p>`;
  } catch {
    rawData = `<p class="stat-value empty">Data not collected yet</p>`;
  }

  const body = `
<div id="lightbox" class="lightbox" onclick="closeLightbox()">
  <img id="lightbox-img" src="" alt="Preview" onclick="event.stopPropagation()">
</div>
<a href="/" class="back">← Back to pipeline</a>
<div class="car-heading">
  <h1>${escHtml(candidate.make)} ${escHtml(candidate.model)}${candidate.year ? ` ${candidate.year}` : ''}</h1>
  <span id="status-badge" class="badge" style="background:${c}22;color:${c};border:1px solid ${c}44">${STATUS_LABELS[candidate.status]}</span>
</div>
<div class="sections">
  <div class="section">
    <div class="section-title">SEO Data (Step 1)</div>
    <div class="grid-2">
      <div class="stat"><div class="stat-label">Keyword</div><div class="stat-value${candidate.keyword ? '' : ' empty'}">${candidate.keyword ? escHtml(candidate.keyword) : 'Not set yet'}</div></div>
      <div class="stat"><div class="stat-label">Monthly Volume</div><div class="stat-value${candidate.search_volume == null ? ' empty' : ''}">${candidate.search_volume != null ? candidate.search_volume.toLocaleString() : 'Not set yet'}</div></div>
      <div class="stat"><div class="stat-label">Keyword Difficulty</div><div class="stat-value${candidate.keyword_difficulty == null ? ' empty' : ''}">${candidate.keyword_difficulty ?? 'Not set yet'}</div></div>
      <div class="stat"><div class="stat-label">Trend Score</div><div class="stat-value${candidate.trend_score == null ? ' empty' : ''}">${candidate.trend_score ?? 'Not set yet'}</div></div>
    </div>
  </div>
  <div class="section">
    <div class="section-title">Images (Steps 2–3)</div>
    <div class="image-grid">
      ${imageSlot(candidate, 'hero', 'Editorial hero', 'editorial_hero_url', 'hero_prompt')}
      ${imageSlot(candidate, 'mid1', 'Mid image 1', 'editorial_mid1_url', 'mid1_prompt')}
      ${imageSlot(candidate, 'mid2', 'Mid image 2', 'editorial_mid2_url', 'mid2_prompt')}
    </div>
  </div>
  ${videoSection(candidate)}
  <div class="section">
    <div class="section-title">Scraped Data (Step 5)</div>
    ${rawData}
  </div>
  <div class="section">
    <div class="section-title">Actions</div>
    <div class="actions">${actionButtons}</div>
    <div id="action-msg" class="status-msg" style="display:none"></div>
  </div>
  ${commitSection(candidate, env.GITHUB_REPO)}
  <div class="section">
    ${logsSection(logs, candidate.id)}
  </div>
</div>
<script>${CLIENT_JS}</script>`;

  return html(`${candidate.make} ${candidate.model}`, body);
}
