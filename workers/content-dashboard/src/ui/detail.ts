import type { Env } from '../index.js';

export async function handleDetail(_id: number, _env: Env): Promise<Response> {
  return new Response('Not implemented', { status: 501 });
}
