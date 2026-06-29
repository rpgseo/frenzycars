import { defineMiddleware } from 'astro:middleware';

const CONTENT_PATHS = ['/content', '/api/content'];

export const onRequest = defineMiddleware((context, next) => {
  const pathname = context.url.pathname;
  const isContentPath = CONTENT_PATHS.some(p => pathname.startsWith(p));

  if (!isContentPath) return next();

  const host = context.request.headers.get('host') ?? '';
  const isLocalDev = host.startsWith('localhost') || host.startsWith('127.0.0.1');
  const isContentDomain = host === 'content.frenzycars.com';

  if (!isLocalDev && !isContentDomain) {
    return new Response(null, { status: 404 });
  }

  return next();
});
