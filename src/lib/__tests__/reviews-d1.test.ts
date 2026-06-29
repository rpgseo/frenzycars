import { describe, it, expect, vi } from 'vitest';
import { listCandidates, getCandidate, updateCandidateStatus } from '../reviews-d1.js';
import type { ReviewCandidate } from '../reviews-d1.js';

const makeCandidate = (overrides: Partial<ReviewCandidate> = {}): ReviewCandidate => ({
  id: 1, make: 'Porsche', model: '911', year: 2024, slug: 'porsche-911-2024',
  keyword: 'porsche 911 review', search_volume: 8100, keyword_difficulty: 62, trend_score: 85,
  reference_image_url: null, editorial_hero_url: null, editorial_mid1_url: null,
  editorial_mid2_url: null, video_url: null, hero_prompt: null, mid_prompt: null,
  video_prompt: null, raw_data: null, status: 'suggested',
  created_at: '2026-06-29T00:00:00.000Z', updated_at: '2026-06-29T00:00:00.000Z',
  ...overrides,
});

function makeDb(rows: ReviewCandidate[] = [], firstRow: ReviewCandidate | null = null, changes = 1): D1Database {
  const stmt = {
    bind: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue({ results: rows }),
    first: vi.fn().mockResolvedValue(firstRow),
    run: vi.fn().mockResolvedValue({ meta: { changes } }),
  };
  return { prepare: vi.fn().mockReturnValue(stmt) } as unknown as D1Database;
}

describe('listCandidates', () => {
  it('returns all candidates without filter', async () => {
    const rows = [makeCandidate(), makeCandidate({ id: 2, status: 'approved' })];
    const db = makeDb(rows);
    const result = await listCandidates(db);
    expect(result).toHaveLength(2);
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT *'));
  });

  it('filters by status', async () => {
    const rows = [makeCandidate({ status: 'approved' })];
    const db = makeDb(rows);
    const result = await listCandidates(db, 'approved');
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('approved');
    const stmt = (db.prepare as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(stmt.bind).toHaveBeenCalledWith('approved');
  });
});

describe('getCandidate', () => {
  it('returns the candidate when found', async () => {
    const candidate = makeCandidate();
    const db = makeDb([], candidate);
    const result = await getCandidate(db, 1);
    expect(result).toEqual(candidate);
  });

  it('returns null when not found', async () => {
    const db = makeDb([], null);
    const result = await getCandidate(db, 999);
    expect(result).toBeNull();
  });
});

describe('updateCandidateStatus', () => {
  it('returns true when a row was updated', async () => {
    const db = makeDb([], null, 1);
    const result = await updateCandidateStatus(db, 1, 'approved');
    expect(result).toBe(true);
  });

  it('returns false when no row matched', async () => {
    const db = makeDb([], null, 0);
    const result = await updateCandidateStatus(db, 999, 'approved');
    expect(result).toBe(false);
  });

  it('passes updated_at as ISO string', async () => {
    const db = makeDb([], null, 1);
    await updateCandidateStatus(db, 1, 'rejected');
    const stmt = (db.prepare as ReturnType<typeof vi.fn>).mock.results[0].value;
    const bindArgs: unknown[] = stmt.bind.mock.calls[0];
    expect(bindArgs[0]).toBe('rejected');
    expect(typeof bindArgs[1]).toBe('string');
    expect(() => new Date(bindArgs[1] as string)).not.toThrow();
    expect(bindArgs[2]).toBe(1);
  });
});
