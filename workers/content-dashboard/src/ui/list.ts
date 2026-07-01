import {
  type CandidateStatus,
  type ReviewCandidate,
  ALLOWED_STATUSES,
  STATUS_LABELS,
  escHtml,
  badge,
  html,
} from './shared.js';

export async function handleList(url: URL, db: D1Database): Promise<Response> {
  const rawStatus = url.searchParams.get('status');
  const statusFilter =
    rawStatus && (ALLOWED_STATUSES as string[]).includes(rawStatus)
      ? (rawStatus as CandidateStatus)
      : undefined;

  let candidates: ReviewCandidate[] = [];
  let error = '';
  try {
    const q = statusFilter
      ? db
          .prepare('SELECT * FROM review_candidates WHERE status = ? ORDER BY created_at DESC')
          .bind(statusFilter)
      : db.prepare('SELECT * FROM review_candidates ORDER BY created_at DESC');
    candidates = (await q.all<ReviewCandidate>()).results;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const filters = ['', ...ALLOWED_STATUSES]
    .map(s => {
      const active = s === '' ? !statusFilter : statusFilter === s;
      const href = s ? `/?status=${s}` : '/';
      const label = s ? STATUS_LABELS[s as CandidateStatus] : 'All';
      return `<a href="${href}" class="filter-link${active ? ' active' : ''}">${label}</a>`;
    })
    .join('');

  let tableHtml = '';
  if (error) {
    tableHtml = `<div class="error">Error: ${escHtml(error)}</div>`;
  } else if (candidates.length === 0) {
    tableHtml = `<div class="empty">No candidates yet. Run the seed script to add some.</div>`;
  } else {
    const rows = candidates
      .map(
        c => `<tr>
<td><span class="car-name">${escHtml(c.make)} ${escHtml(c.model)}</span>${c.year ? `<span class="car-year"> · ${c.year}</span>` : ''}</td>
<td>${c.keyword ? escHtml(c.keyword) : '<span style="color:#444">—</span>'}</td>
<td>${c.search_volume != null ? c.search_volume.toLocaleString() : '<span style="color:#444">—</span>'}</td>
<td>${c.keyword_difficulty ?? '<span style="color:#444">—</span>'}</td>
<td>${badge(c.status)}</td>
<td><a href="/${c.id}/" class="view-link">Ver →</a></td>
</tr>`,
      )
      .join('');
    tableHtml = `<p class="count">${candidates.length} candidate${candidates.length !== 1 ? 's' : ''}${statusFilter ? ` · ${STATUS_LABELS[statusFilter]}` : ''}</p>
<table><thead><tr><th>Car</th><th>Keyword</th><th>Volume</th><th>KD</th><th>Status</th><th></th></tr></thead>
<tbody>${rows}</tbody></table>`;
  }

  return html(
    'Reviews Pipeline',
    `
<h1>Reviews Pipeline</h1>
<div class="actions" style="margin-bottom:1.5rem">
  <button id="sync-btn" class="btn btn-suggest">Sync from repo</button>
</div>
<div id="sync-msg"></div>
<nav class="filters">${filters}</nav>
${tableHtml}
<script>
document.getElementById('sync-btn').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  const msg = document.getElementById('sync-msg');
  btn.disabled = true;
  btn.textContent = 'Syncing…';
  msg.innerHTML = '';
  try {
    const res = await fetch('/api/content/sync-reviews', { method: 'POST' });
    const data = await res.json();
    if (!data.ok && data.error) throw new Error(data.error);
    msg.innerHTML = '<p class="status-msg">Scanned ' + data.scanned + ' · created ' + data.created + ' · updated ' + data.updated +
      (data.errors && data.errors.length ? ' · ' + data.errors.length + ' error(s)' : '') + '</p>';
    if (data.errors && data.errors.length) {
      msg.innerHTML += '<p class="status-msg error">' + data.errors.join('<br>') + '</p>';
    }
    setTimeout(() => location.reload(), 1200);
  } catch (err) {
    msg.innerHTML = '<p class="status-msg error">' + (err && err.message ? err.message : String(err)) + '</p>';
    btn.disabled = false;
    btn.textContent = 'Sync from repo';
  }
});
</script>`,
  );
}
