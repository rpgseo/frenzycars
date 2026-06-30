import type { ReviewCandidate } from '../ui/shared.js';

export interface CandidateLog {
  id: number;
  candidate_id: number;
  ts: string;
  operation: string;
  status: 'ok' | 'error' | 'pending';
  message: string | null;
}

export async function writeLog(
  db: D1Database,
  candidateId: number,
  operation: string,
  status: 'ok' | 'error' | 'pending',
  message?: string
): Promise<void> {
  const ts = new Date().toISOString();
  await db.prepare(
    'INSERT INTO candidate_logs (candidate_id, ts, operation, status, message) VALUES (?, ?, ?, ?, ?)'
  ).bind(candidateId, ts, operation, status, message ?? null).run();

  const countResult = await db.prepare(
    'SELECT COUNT(*) as n FROM candidate_logs WHERE candidate_id = ?'
  ).bind(candidateId).first<{ n: number }>();
  const count = countResult?.n ?? 0;
  if (count > 50) {
    const toDelete = count - 50;
    await db.prepare(
      'DELETE FROM candidate_logs WHERE id IN (SELECT id FROM candidate_logs WHERE candidate_id = ? ORDER BY ts ASC LIMIT ?)'
    ).bind(candidateId, toDelete).run();
  }
}

export async function getLogs(db: D1Database, candidateId: number): Promise<CandidateLog[]> {
  const result = await db.prepare(
    'SELECT * FROM candidate_logs WHERE candidate_id = ? ORDER BY ts DESC LIMIT 50'
  ).bind(candidateId).all<CandidateLog>();
  return result.results;
}

export async function getCandidate(db: D1Database, id: number): Promise<ReviewCandidate | null> {
  return db.prepare('SELECT * FROM review_candidates WHERE id = ?')
    .bind(id).first<ReviewCandidate>();
}
