import type { APIRoute } from 'astro';
import { loadCompareIndex, type CompareIndex } from '../../lib/compare-index.js';

export function serializeIndex(index: CompareIndex): string {
  return JSON.stringify(index);
}

export const GET: APIRoute = async () => {
  const index = await loadCompareIndex();
  return new Response(serializeIndex(index), {
    headers: { 'Content-Type': 'application/json' },
  });
};
