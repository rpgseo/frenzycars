import { describe, it, expect } from 'vitest';
import { isValidStatus, parseStatusRequest, ALLOWED_STATUSES } from '../content-status.js';

describe('isValidStatus', () => {
  it('accepts all allowed statuses', () => {
    for (const s of ALLOWED_STATUSES) {
      expect(isValidStatus(s)).toBe(true);
    }
  });

  it('rejects unknown strings', () => {
    expect(isValidStatus('pending')).toBe(false);
    expect(isValidStatus('draft')).toBe(false);
    expect(isValidStatus('')).toBe(false);
  });

  it('rejects non-strings', () => {
    expect(isValidStatus(1)).toBe(false);
    expect(isValidStatus(null)).toBe(false);
    expect(isValidStatus(undefined)).toBe(false);
  });
});

describe('parseStatusRequest', () => {
  it('accepts valid input with numeric id', () => {
    const result = parseStatusRequest({ id: 5, status: 'approved' });
    expect(result).toEqual({ ok: true, id: 5, status: 'approved' });
  });

  it('accepts valid input with string id', () => {
    const result = parseStatusRequest({ id: '3', status: 'rejected' });
    expect(result).toEqual({ ok: true, id: 3, status: 'rejected' });
  });

  it('rejects non-numeric id', () => {
    const result = parseStatusRequest({ id: 'abc', status: 'approved' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.httpStatus).toBe(400);
  });

  it('rejects zero id', () => {
    const result = parseStatusRequest({ id: 0, status: 'approved' });
    expect(result.ok).toBe(false);
  });

  it('rejects invalid status', () => {
    const result = parseStatusRequest({ id: 1, status: 'draft' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Invalid status');
  });

  it('rejects null body', () => {
    const result = parseStatusRequest(null);
    expect(result.ok).toBe(false);
  });

  it('rejects non-object body', () => {
    const result = parseStatusRequest('bad');
    expect(result.ok).toBe(false);
  });
});
