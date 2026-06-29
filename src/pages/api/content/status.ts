export const prerender = false;

import type { APIRoute } from 'astro';
import { getD1 } from '../../../lib/d1-client.js';
import { updateCandidateStatus } from '../../../lib/reviews-d1.js';
import { parseStatusRequest } from '../../../lib/content-status.js';

export const POST: APIRoute = async ({ request, locals }) => {
  const db = getD1(locals);
  if (!db) {
    return new Response(JSON.stringify({ ok: false, error: 'Database unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const parsed = parseStatusRequest(body);
  if (!parsed.ok) {
    return new Response(JSON.stringify({ ok: false, error: parsed.error }), {
      status: parsed.httpStatus,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const updated = await updateCandidateStatus(db, parsed.id, parsed.status);
  if (!updated) {
    return new Response(JSON.stringify({ ok: false, error: 'Candidate not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true, status: parsed.status }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
