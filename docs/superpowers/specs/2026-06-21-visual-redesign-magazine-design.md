# FrenzyCars — Visual Redesign: Dense News Magazine + Ad Optimization

**Date:** 2026-06-21
**Phase:** Visual redesign (Phase 0 design system), scoped before evergreen pSEO (Phase 1)
**Status:** Approved design → pending implementation plan

## 1. Problem & Goals

The current site renders but feels thin — too few sections and grids to read as a digital car
magazine. It also lacks any ad inventory structure, which is required for AdSense/programmatic
monetization.

**Goals**

- Make the site read as a dense, newsy automotive magazine (Top Gear / Motor1 feel).
- Keep the existing brand: black + `#F7D720` accent + current typography.
- Build a reusable design system that Phase 1 evergreen types will adopt later.
- Reserve stable, CLS-free ad slots across Home, section lists, and article pages.
- Preserve SEO assets: static baked HTML, existing JSON-LD, Open Graph, canonical.

**Non-goals (this phase)**

- Evergreen content types (compare / faq / specs / how-to) — Phase 1 reuses this system.
- Internal-linking engine, data ingestion, GitHub/Cloudflare deployment.
- AdSense account/code integration (slots are built now; AdSense loads only when configured).

## 2. Design Principles

- **Not full-width.** A centered container reserves side margins and a right rail.
- **Hierarchy over uniformity.** Mixed card sizes and clearly marked section zones.
- **Reserved ad containers.** Every ad slot has a fixed `min-height` to guarantee zero CLS.
- **Component-driven.** Small partials each doing one thing, reused across pages.
- **Mobile-first.** Single column base, expanding to a 12-col grid with a 300px rail.

## 3. Design Tokens (extends existing CSS variables)

| Token | Value | Use |
|-------|-------|-----|
| `--bg` | `#000` | page background (existing) |
| `--surface` | `#0e0e0e` | cards, rails |
| `--surface-2` | `#161616` | nested blocks, table rows |
| `--border` | `#232323` | dividers |
| `--accent` | `#F7D720` | brand yellow (existing) |
| `--fg` / `--fg-muted` / `--fg-dim` | existing | text hierarchy |

**Typography:** same family as today. New modular scale: display `3.2rem` → h1 `2.2rem` → h2
`1.6rem` → h3 `1.2rem` → body `1rem` → small `0.85rem`. Tight tracking on headlines, wide
tracking + uppercase on eyebrows/labels.

**Shape/spacing:** radii 8–12px; spacing scale 4/8/12/16/24/40px.

## 4. Layout & Grid

- `.container`: `max-width: 1280px`, centered, horizontal padding 16px (24px ≥960px).
- Internal 12-column grid, gutter 24px (desktop).
- **Breakpoints:** 640 / 960 / 1200. Base 1 column; 2 columns ≥640; full 12-col with rail ≥960.
- **Right rail:** fixed 300px column on Home and Article (desktop only); collapses under content on mobile.
- **Header:** sticky, compact, with brand, nav, a search affordance (placeholder), CTA.

## 5. Ad Strategy & Core Web Vitals

All slots are manual and rendered by a single `partials/ads/slot.html` partial accepting
`slot` (id) and `format` (size hint). Each renders an empty reserved container so there is never a
layout shift whether or not an ad fills.

**Slots**

| Slot | Placement | Reserved size |
|------|-----------|---------------|
| Leaderboard | Top of Home, list, article | 728×90 → 970×250 responsive, `min-height: 90px` |
| In-feed (home) | Between content rows on Home | `min-height: 120px` |
| In-article | After intro + every ~3 paragraphs | `min-height: 250px` |
| Rail sticky | Right rail, Home + Article | 300×250 + 300×600, sticky on desktop |

**Activation:** `hugo.toml` params `adsense.enabled` (bool) and `adsense.client`
(`ca-pub-…`). The loader partial injects the AdSense script **only when enabled**. Locally and in
any build without a client ID, slots stay as empty reserved placeholders → safe to develop.

**CWV safeguards:** explicit `width`/`height` on images, `loading="lazy"` on non-critical
images/iframes, system fonts (no font-load CLS), reserved ad containers, no render-blocking ad
scripts above the fold except the (deferred) AdSense loader.

## 6. Pages

### 6.1 Home (`layouts/index.html`)
Order: Leaderboard → **Hero lead** (2/3 width: big cover, title, score) + 2 secondary cards →
"Latest" row (4 cards) → In-feed ad → **Reviews zone** (1 large with score-bar + 2 mini) with
sticky rail → **News zone** (dense mini-list + "Trending" block) → **Features zone** → Newsletter CTA.

### 6.2 Section list (`layouts/_default/list.html`)
Compact page-hero → responsive 3-column grid of rich cards (cover, score, author, date) →
in-feed ad every 9 items → sticky rail sidebar → pagination.

### 6.3 Article (`layouts/_default/single.html`)
Leaderboard → cover hero + meta → content column ~720px → in-article ads every ~3 paragraphs →
new optional blocks (**Verdict**, **Specs table**, **Pros/Cons**) when `rating`/`specs` present →
Related → sticky rail sidebar.

## 7. Components (partials)

New reusable partials:

- `partials/lead-card.html` — hero story card.
- `partials/article-card.html` — extended (existing) with score, author, date.
- `partials/score.html` — `.score-badge` / `.score-bar` from `.Params.rating`.
- `partials/spec-table.html` — renders `.Params.specs` key/value list.
- `partials/verdict.html` — highlighted verdict block from `.Params.verdict`.
- `partials/section-rail.html` — generic section zone wrapper (title + grid + optional rail).
- `partials/ads/slot.html` — reserved ad container (CLS-free).
- `partials/ads/head.html` — AdSense loader (conditional).

## 8. Content Scaffolding (placeholder)

Add ~9–12 demo posts across reviews/news/features with Unsplash covers and ratings to make Home
and lists look dense. Each carries `demo: true` front matter so they can be deleted in one
filtered pass later. Real editorial content (already present) is kept.

## 9. Technical Scope (files)

- `assets/css/style.css` and `static/css/style.css` (kept in sync) — new design system.
- `layouts/index.html`, `layouts/_default/list.html`, `layouts/_default/single.html`,
  `layouts/partials/article-card.html`, plus new partials in §7.
- `archetypes/default.md` — optional new fields (`verdict`, `specs`, `pros`, `cons`, `demo`).
- `hugo.toml` — `[params.adsense]` block + `demo` handling.
- **Unchanged:** Sveltia CMS (`static/admin/*`), content adapters (Phase 1), JSON-LD, OG.

## 10. Verification

- `hugo --gc --printPathWarnings` clean (0 errors, 0 warnings, 0 path collisions).
- Ad slots present as reserved containers with AdSense **off** (no script loaded).
- Existing JSON-LD (Article/Review) and OG tags still render correctly on a sample post.
- Home renders all zones; list shows ≥9 items with an in-feed ad; article shows in-article ads and a sticky rail on desktop.
- Visual density confirmed against the approved wireframes (Option A + ad layout).
