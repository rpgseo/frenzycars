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
  mid_prompt: string | null;
  video_prompt: string | null;
  raw_data: string | null;
  status: CandidateStatus;
  created_at: string;
  updated_at: string;
}

export async function listCandidates(
  db: D1Database,
  statusFilter?: CandidateStatus
): Promise<ReviewCandidate[]> {
  if (statusFilter) {
    const result = await db
      .prepare('SELECT * FROM review_candidates WHERE status = ? ORDER BY created_at DESC')
      .bind(statusFilter)
      .all<ReviewCandidate>();
    return result.results;
  }
  const result = await db
    .prepare('SELECT * FROM review_candidates ORDER BY created_at DESC')
    .all<ReviewCandidate>();
  return result.results;
}

export async function getCandidate(
  db: D1Database,
  id: number
): Promise<ReviewCandidate | null> {
  return db
    .prepare('SELECT * FROM review_candidates WHERE id = ?')
    .bind(id)
    .first<ReviewCandidate>();
}

export async function updateCandidateStatus(
  db: D1Database,
  id: number,
  status: CandidateStatus
): Promise<boolean> {
  const updatedAt = new Date().toISOString();
  const result = await db
    .prepare('UPDATE review_candidates SET status = ?, updated_at = ? WHERE id = ?')
    .bind(status, updatedAt, id)
    .run();
  return (result.meta.changes ?? 0) > 0;
}
