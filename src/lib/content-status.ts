import type { CandidateStatus } from './reviews-d1.js';

export const ALLOWED_STATUSES: CandidateStatus[] = ['suggested', 'approved', 'rejected', 'published'];

export function isValidStatus(s: unknown): s is CandidateStatus {
  return typeof s === 'string' && (ALLOWED_STATUSES as string[]).includes(s);
}

export type StatusRequestError = { ok: false; error: string; httpStatus: 400 };
export type StatusRequestOk = { ok: true; id: number; status: CandidateStatus };

export function parseStatusRequest(
  body: unknown
): StatusRequestOk | StatusRequestError {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Invalid request body', httpStatus: 400 };
  }
  const { id, status } = body as Record<string, unknown>;
  const parsedId = typeof id === 'string' ? parseInt(id, 10) : typeof id === 'number' ? id : NaN;
  if (!Number.isFinite(parsedId) || parsedId <= 0) {
    return { ok: false, error: 'Invalid id', httpStatus: 400 };
  }
  if (!isValidStatus(status)) {
    return { ok: false, error: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}`, httpStatus: 400 };
  }
  return { ok: true, id: parsedId, status };
}
