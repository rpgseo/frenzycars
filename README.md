# FrenzyCars (Astro)

## Build

```bash
npm install && npm run build  # output in dist/
```

## Test

```bash
npm test  # 9/9 tests covering URL parity, content import, maintenance gate, slugify
```

## Deploy on Cloudflare Pages

- Framework preset: Astro
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `astro`
- `_redirects` and `_headers` are served automatically from `dist/`

## Environment

No environment variables required for static build.
Copy `.env.example` to `.env` for DataForSEO tools (optional, not needed for build).

## Phase 2 (D1)

Add `@astrojs/cloudflare` adapter and D1 binding when implementing the first dynamic feature.
Content stays in Markdown (no CMS in Phase 1). Edit `.md` files in `astro/src/content/`.

## Palette

- Accent: `#f7d720` (kept from original, non-negotiable)
- Base: `#0A0B0D` (new dark motorsport palette)
- CSS tokens: `astro/src/styles/global.css`
