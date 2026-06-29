import { useState } from 'react';
import type { CandidateStatus } from '../../lib/reviews-d1.js';

interface Props {
  id: number;
  initialStatus: CandidateStatus;
}

type ActionState = 'idle' | 'saving' | 'error';

const STATUS_LABELS: Record<CandidateStatus, string> = {
  suggested: 'Suggested',
  approved: 'Approved',
  rejected: 'Rejected',
  published: 'Published',
};

const STATUS_COLORS: Record<CandidateStatus, string> = {
  suggested: '#888',
  approved: '#22c55e',
  rejected: '#ef4444',
  published: '#3b82f6',
};

export function applyStatusTransition(
  current: CandidateStatus,
  next: CandidateStatus
): CandidateStatus {
  return next;
}

export default function CandidateActions({ id, initialStatus }: Props) {
  const [status, setStatus] = useState<CandidateStatus>(initialStatus);
  const [state, setState] = useState<ActionState>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');

  async function changeStatus(next: CandidateStatus) {
    setState('saving');
    setErrorMsg('');
    try {
      const res = await fetch('/api/content/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: next }),
      });
      const data = await res.json() as { ok: boolean; status?: CandidateStatus; error?: string };
      if (data.ok && data.status) {
        setStatus(applyStatusTransition(status, data.status));
        setState('idle');
      } else {
        setErrorMsg(data.error ?? 'Unknown error');
        setState('error');
      }
    } catch {
      setErrorMsg('Network error — check your connection and try again');
      setState('error');
    }
  }

  const isSaving = state === 'saving';
  const color = STATUS_COLORS[status];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.8rem', color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Current status:
        </span>
        <span style={{
          display: 'inline-block', padding: '0.25rem 0.8rem', borderRadius: '999px',
          fontSize: '0.8rem', fontWeight: 700,
          background: `${color}22`, color, border: `1px solid ${color}44`,
        }}>
          {STATUS_LABELS[status]}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => changeStatus('approved')}
          disabled={isSaving || status === 'approved'}
          style={{
            padding: '0.55rem 1.4rem', borderRadius: '8px', fontWeight: 700,
            fontSize: '0.9rem', cursor: isSaving || status === 'approved' ? 'not-allowed' : 'pointer',
            background: status === 'approved' ? '#14532d' : '#22c55e22',
            color: '#22c55e', border: '1px solid #22c55e44',
            opacity: status === 'approved' ? 0.5 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          {isSaving ? '…' : 'Approve'}
        </button>

        <button
          onClick={() => changeStatus('rejected')}
          disabled={isSaving || status === 'rejected'}
          style={{
            padding: '0.55rem 1.4rem', borderRadius: '8px', fontWeight: 700,
            fontSize: '0.9rem', cursor: isSaving || status === 'rejected' ? 'not-allowed' : 'pointer',
            background: status === 'rejected' ? '#450a0a' : '#ef444422',
            color: '#ef4444', border: '1px solid #ef444444',
            opacity: status === 'rejected' ? 0.5 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          {isSaving ? '…' : 'Reject'}
        </button>

        <button
          onClick={() => changeStatus('suggested')}
          disabled={isSaving || status === 'suggested'}
          style={{
            padding: '0.55rem 1.4rem', borderRadius: '8px', fontWeight: 700,
            fontSize: '0.9rem', cursor: isSaving || status === 'suggested' ? 'not-allowed' : 'pointer',
            background: '#1a1a1a', color: '#888', border: '1px solid #2a2a2a',
            opacity: status === 'suggested' ? 0.5 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          Reset to Suggested
        </button>
      </div>

      {state === 'error' && (
        <div style={{
          background: '#2a0a0a', border: '1px solid #7f1d1d', color: '#fca5a5',
          padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.85rem',
          display: 'flex', alignItems: 'center', gap: '0.75rem',
        }}>
          <span>{errorMsg}</span>
          <button
            onClick={() => setState('idle')}
            style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontWeight: 700 }}
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
