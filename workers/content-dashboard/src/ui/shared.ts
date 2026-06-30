export type CandidateStatus = 'suggested' | 'approved' | 'rejected' | 'published';

export interface ReviewCandidate {
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
  mid1_prompt: string | null;
  mid2_prompt: string | null;
  video_prompt: string | null;
  video_job_id: string | null;
  video_status: 'idle' | 'pending' | 'done' | 'error';
  last_commit_sha: string | null;
  status: CandidateStatus;
  raw_data: string | null;
  created_at: string;
  updated_at: string;
}

export const ALLOWED_STATUSES: CandidateStatus[] = ['suggested', 'approved', 'rejected', 'published'];

export const STATUS_LABELS: Record<CandidateStatus, string> = {
  suggested: 'Suggested',
  approved: 'Approved',
  rejected: 'Rejected',
  published: 'Published',
};

export const STATUS_COLORS: Record<CandidateStatus, string> = {
  suggested: '#888',
  approved: '#22c55e',
  rejected: '#ef4444',
  published: '#3b82f6',
};

export function escHtml(s: string | null | number): string {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function badge(status: CandidateStatus): string {
  const c = STATUS_COLORS[status];
  return `<span class="badge" style="background:${c}22;color:${c};border:1px solid ${c}44">${STATUS_LABELS[status]}</span>`;
}

export const CSS = `
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
.image-slots{display:flex;flex-direction:column;gap:1.25rem}
.image-row{display:grid;grid-template-columns:240px 1fr;gap:1.25rem;align-items:start;background:#0d0d0d;border:1px solid #1e1e1e;border-radius:8px;padding:1rem}
.image-row-preview{width:240px;flex-shrink:0}
.image-row-body{display:flex;flex-direction:column;gap:.6rem;min-width:0}
.image-placeholder{background:#1a1a1a;border:1px dashed #2a2a2a;border-radius:8px;aspect-ratio:16/9;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#333;font-size:.75rem;text-align:center;gap:.4rem;width:100%}
.image-preview{border-radius:8px;width:100%;aspect-ratio:16/9;object-fit:cover;cursor:pointer;transition:opacity .15s}
.image-preview:hover{opacity:.85}
.ref-image-row{display:flex;align-items:center;gap:1rem;margin-bottom:1rem;padding:.75rem 1rem;background:#0d0d0d;border:1px solid #1e1e1e;border-radius:8px}
.ref-label{font-size:.75rem;color:#555;font-weight:600;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap}
.ref-thumb{width:160px;height:90px;object-fit:cover;border-radius:6px;cursor:pointer;transition:opacity .15s;flex-shrink:0}
.ref-thumb:hover{opacity:.85}
.ref-thumb-placeholder{width:160px;height:90px;border-radius:6px;background:#1a1a1a;border:1px dashed #2a2a2a;display:flex;align-items:center;justify-content:center;font-size:.7rem;color:#444;text-align:center;flex-shrink:0}
.optional-badge{font-size:.65rem;font-weight:600;color:#555;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:4px;padding:.1rem .35rem;vertical-align:middle;text-transform:uppercase;letter-spacing:.04em}
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
.image-slot{display:flex;flex-direction:column;gap:.5rem}
.image-slot-label{font-size:.75rem;color:#555;font-weight:600;text-transform:uppercase;letter-spacing:.05em}
.image-slot-preview{border-radius:8px;width:100%;aspect-ratio:16/9;object-fit:cover}
.prompt-area{width:100%;background:#0a0a0a;border:1px solid #2a2a2a;border-radius:6px;padding:.6rem .8rem;color:#e5e5e5;font-size:.8rem;font-family:monospace;resize:vertical;min-height:80px;outline:none;transition:border-color .15s}
.prompt-area:focus{border-color:#F7D720}
.slot-actions{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.4rem}
.btn-generate{background:#F7D720;color:#000;padding:.35rem .8rem;border-radius:6px;font-size:.8rem;font-weight:700;border:none;cursor:pointer;transition:opacity .15s}
.btn-generate:hover{opacity:.85}
.btn-redo{background:#1a1a1a;color:#888;padding:.35rem .8rem;border-radius:6px;font-size:.8rem;font-weight:700;border:1px solid #2a2a2a;cursor:pointer;transition:opacity .15s}
.btn-redo:hover{opacity:.85}
.btn-commit{background:#7c3aed;color:#fff}
.btn-danger{background:#1a0505;color:#ef4444;border:1px solid #3f0e0e}
.spinner{display:inline-block;width:14px;height:14px;border:2px solid #444;border-top-color:#F7D720;border-radius:50%;animation:spin .6s linear infinite;vertical-align:middle}
@keyframes spin{to{transform:rotate(360deg)}}
.checklist{list-style:none;display:flex;flex-direction:column;gap:.4rem;font-size:.85rem}
.check-ok{color:#22c55e}
.check-no{color:#ef4444}
.check-opt{color:#555}
.commit-result{margin-top:1rem;padding:.75rem 1rem;border-radius:6px;font-size:.85rem;font-family:monospace;background:#0a0a0a;border:1px solid #2a2a2a}
.video-placeholder{background:#1a1a1a;border:1px dashed #2a2a2a;border-radius:8px;aspect-ratio:16/9;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#444;font-size:.85rem;gap:.5rem;max-width:480px}
.logs-table{width:100%;border-collapse:collapse;font-size:.8rem;font-family:monospace}
.logs-table td{padding:.4rem .6rem;border-bottom:1px solid #141414}
.log-ok{color:#22c55e}
.log-error{color:#ef4444}
.log-pending{color:#888}
details summary{cursor:pointer;color:#666;font-size:.8rem;padding:.4rem 0;list-style:none}
details summary::-webkit-details-marker{display:none}
details summary::before{content:'▶ ';font-size:.65rem}
details[open] summary::before{content:'▼ '}
.lightbox{display:none;position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:9999;align-items:center;justify-content:center}
.lightbox.open{display:flex}
.lightbox img{max-width:90vw;max-height:90vh;border-radius:8px;object-fit:contain}
`;

export function html(title: string, body: string): Response {
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
