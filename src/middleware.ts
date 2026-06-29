import { defineMiddleware } from 'astro:middleware';

const CONTENT_PATHS = ['/content', '/api/content'];

export const onRequest = defineMiddleware((context, next) => {
  const pathname = context.url.pathname;
  const host = context.request.headers.get('host') ?? '';
  const isLocalDev = host.startsWith('localhost') || host.startsWith('127.0.0.1');
  const isContentDomain = host === 'content.frenzycars.com';

  // Redirect content.frenzycars.com/ → /content/
  if ((isContentDomain || isLocalDev) && (pathname === '/' || pathname === '')) {
    return Response.redirect(new URL('/content/', context.url), 302);
  }

  const isContentPath = CONTENT_PATHS.some(p => pathname.startsWith(p));
  if (!isContentPath) return next();

  if (!isLocalDev && !isContentDomain) {
    return new Response(null, { status: 404 });
  }

  return next();
});
