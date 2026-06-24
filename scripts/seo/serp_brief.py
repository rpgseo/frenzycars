#!/usr/bin/env python3
"""
FrenzyCars content-brief generator (the executable Content-Creation SOP).

Given one or more keywords, it produces a structured content brief by reading
the SERP data already harvested by keyword_pipeline.py (research/keywords/serp.json)
plus the metrics in output.json. If a keyword has no cached SERP, it fetches a
LIVE SERP via DataForSEO (reusing keyword_pipeline.serp_insight) and merges it
back into serp.json so nothing is re-spent on the next run.

For every keyword it decides, from the real top-5 SERP composition:
  - dominant intent (SERP-derived)
  - recommended content format / page_type
  - SERP weakness assessment (forum weak-spot, major dominance, title match)
  - PAA questions to answer + related searches (content angles)
  - recommended <title>, meta description, H1
  - recommended JSON-LD schema
  - a draft H2 outline derived from the SERP

Outputs one Markdown brief per keyword under research/briefs/<slug>.md and a
console summary table. This is the artefact you consult BEFORE writing a page
so every article is intent-aligned and SERP-informed.

Usage:
  python scripts/seo/serp_brief.py "best car cell phone mount"
  python scripts/seo/serp_brief.py "how long do ev batteries last" "are car prices coming down"
  python scripts/seo/serp_brief.py --from-plan 5        # top-5 GAP clusters not yet published
  python scripts/seo/serp_brief.py --no-live "kw"       # cache-only (never spend)
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import keyword_pipeline as kp  # noqa: E402  (reuse SERP + classifiers)

KW_DIR = ROOT / "research" / "keywords"
BRIEF_DIR = ROOT / "research" / "briefs"
BRIEF_DIR.mkdir(parents=True, exist_ok=True)
SERP_FILE = KW_DIR / "serp.json"
OUTPUT_JSON = KW_DIR / "output.json"
PLAN_CSV = KW_DIR / "editorial_plan.csv"
SEEDS = KW_DIR / "seeds.yaml"


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #
def _slug(kw: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", kw.lower()).strip("-")
    return s or "brief"


def _atomic_write_json(path: Path, obj) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(obj, indent=2), encoding="utf-8")
    import os
    os.replace(tmp, path)


def _load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def _page_type_counts(serp: dict) -> dict:
    counts: dict[str, int] = {}
    for t in (serp.get("page_types") or [])[:5]:
        counts[t] = counts.get(t, 0) + 1
    return counts


# --------------------------------------------------------------------------- #
# the decision core: SERP top-5 -> format/intent/schema/outline
# --------------------------------------------------------------------------- #
def decide_format(serp: dict, keyword: str) -> dict:
    """Map the real SERP composition to a content format recommendation.

    This is the heart of the SOP: we let the SERP tell us what to build rather
    than guessing from the keyword string alone.
    """
    types = _page_type_counts(serp)
    n = sum(types.values()) or 1
    shop = types.get("shopping", 0)
    agg = types.get("aggregator", 0)
    forum = types.get("forum_ugc", 0)
    oem = types.get("oem_dealer", 0)
    intent = serp.get("intent_serp") or kp.classify_intent(keyword)
    k = keyword.lower()

    # intent sub-signals: "broken thing -> diagnose/fix" vs "question of
    # fact/cost/longevity" vs "best-of". The SERP page-type mix dominates, but
    # the keyword phrasing disambiguates the two informational flavors.
    fix_it = bool(re.search(
        r"\b(why is my|how (do|to) (i |you )?(fix|diagnose|bleed|replace|reset)|"
        r"won't start|shaking|grinding|noise|leak|slipping|clicking|blowing hot|"
        r"check engine|wont start)\b", k))
    explainer = bool(re.search(
        r"\b(how long|how much does|how many|what is|what are|are .{0,20} coming|"
        r"when (will|does)|is .{0,20} worth|cheapest|most recalled|sales growth)\b",
        k))

    # format decision
    if shop / n >= 0.4 or ("best" in k and (agg + shop) / n >= 0.4):
        fmt, page_type = "Best-of roundup / comparison list", "buying-guide"
    elif fix_it:
        fmt, page_type = "How-to / troubleshooting explainer", "troubleshooting"
    elif explainer or intent == "Informational":
        fmt, page_type = "Definitive explainer / data guide", "explainer"
    elif oem / n >= 0.4:
        fmt, page_type = "Spec / product deep-dive", "review"
    elif agg / n >= 0.5:
        fmt, page_type = "Comparison / buyer guide", "buying-guide"
    else:
        fmt, page_type = "Definitive guide (pillar)", "pillar"

    # schema recommendation
    schema = ["Article"]
    if page_type == "buying-guide":
        schema = ["ItemList", "Product (per pick)", "FAQPage"]
    elif page_type == "troubleshooting":
        schema = ["HowTo", "FAQPage"]
    elif page_type == "explainer":
        schema = ["Article", "FAQPage"]
    elif page_type == "review":
        schema = ["Review", "Product"]

    # weakness read
    weak = {
        "forum_hits": serp.get("forum_hits", 0),
        "title_match_ratio": serp.get("title_match_ratio", 0),
        "major_in_top5": serp.get("major_in_top5", False),
        "major_in_top3": serp.get("major_in_top3", False),
        "ai_overview": serp.get("ai_overview", False),
    }
    verdict = []
    if weak["forum_hits"] >= 2:
        verdict.append("forums on page 1 -> weak SERP, rankable now")
    if weak["major_in_top3"]:
        verdict.append("major authority in top-3 -> harder, needs best-in-class depth")
    elif not weak["major_in_top5"]:
        verdict.append("no major in top-5 -> genuine gap")
    if weak["title_match_ratio"] >= 0.8:
        verdict.append("exact-match titles win -> use primary keyword in <title>/H1")
    if weak["ai_overview"]:
        verdict.append("AI Overview present -> write a crisp direct answer for GEO")

    return {
        "intent": intent,
        "format": fmt,
        "page_type": page_type,
        "schema": schema,
        "weakness": weak,
        "verdict": verdict or ["mixed SERP; match the dominant format depth"],
    }


def build_outline(serp: dict, fmt: dict, keyword: str) -> list[str]:
    """Draft H2 outline from PAA + related searches + standard sections."""
    paa = serp.get("paa") or []
    related = serp.get("related") or []
    pt = fmt["page_type"]
    h2s: list[str] = []

    if pt == "buying-guide":
        h2s = [
            "What to look for in a " + keyword.lower(),
            "How we tested / our rating criteria",
            "The best " + keyword.lower() + " in 2026",
            "Budget vs premium: what actually matters",
        ]
    elif pt == "troubleshooting":
        h2s = [
            "Quick answer (TL;DR)",
            "Most common causes",
            "How to diagnose it yourself, step by step",
            "When to see a mechanic (and what it typically costs)",
        ]
    elif pt == "explainer":
        h2s = [
            "Quick answer (TL;DR)",
            "The numbers that actually matter",
            "What changes the answer (key factors)",
            "How this compares to the alternative",
        ]
    else:  # pillar / review
        h2s = [
            "Why this matters in 2026",
            "The essentials, explained",
            "Key factors to compare",
        ]

    # fold the highest-signal PAA questions into the outline
    extras = []
    for q in paa[:6]:
        q = q.strip().rstrip("?").strip()
        if q and len(extras) < 3:
            extras.append(q[:70])
    if extras:
        h2s.append("Frequently asked questions")
    return h2s, extras


def title_meta(keyword: str, fmt: dict) -> dict:
    k = keyword
    if fmt["page_type"] == "buying-guide":
        year = "2026"
        return {
            "title": f"Best {k.capitalize()} of {year} (Tested & Ranked)",
            "h1": f"The Best {k.capitalize()} of {year}",
            "meta": f"Our tested picks for the best {k} in {year}, ranked by "
                    f"hold strength, ease of use and value. Buyer's guide with specs.",
        }
    if fmt["page_type"] == "troubleshooting":
        return {
            "title": f"{k.capitalize()} — Causes, Fixes & When to Worry",
            "h1": k.capitalize(),
            "meta": f"Why {k}: the common causes, how to diagnose and fix it "
                    f"yourself, costs, and when to call a mechanic.",
        }
    if fmt["page_type"] == "explainer":
        return {
            "title": f"{k.capitalize()} (Data-Backed 2026 Guide)",
            "h1": k.capitalize(),
            "meta": f"A clear, data-backed answer to {k}: the real numbers, the "
                    f"factors that move them, and what it means for you in 2026.",
        }
    return {
        "title": f"{k.capitalize()} — The Complete 2026 Guide",
        "h1": k.capitalize(),
        "meta": f"Everything you need to know about {k} in 2026: factors, "
                f"comparisons and expert recommendations.",
    }


# --------------------------------------------------------------------------- #
# SERP resolution: cache first, live-fetch only when missing
# --------------------------------------------------------------------------- #
def resolve_serp(keyword: str, allow_live: bool) -> dict | None:
    cache = _load_json(SERP_FILE)
    if keyword in cache:
        return cache[keyword]
    if not allow_live:
        return None
    if not (kp.Cfg.login and kp.Cfg.password):
        print("  [warn] no DFS creds; cannot live-fetch. Skipping (use cache).",
              file=sys.stderr)
        return None
    # need competitors/majors/filters from seeds.yaml
    cfg = __import__("yaml").safe_load(SEEDS.read_text(encoding="utf-8"))
    print(f"  [live] fetching SERP for '{keyword}'...")
    s = kp.serp_insight(keyword, cfg["competitors"], cfg["majors_to_exclude"],
                       major_min=int(cfg["filters"].get("major_dominant_min", 3)),
                       depth=int(cfg["filters"].get("serp_depth", 10)))
    if s is None:
        return None
    cache[keyword] = s
    _atomic_write_json(SERP_FILE, cache)  # merge back so it's never re-spent
    return s


def _metrics(keyword: str) -> dict:
    out = _load_json(OUTPUT_JSON)
    for r in out.get("rows", out) if isinstance(out, dict) else out:
        if isinstance(r, dict) and r.get("keyword") == keyword:
            return r
    return {}


# --------------------------------------------------------------------------- #
# brief rendering
# --------------------------------------------------------------------------- #
def render_brief(keyword: str, serp: dict, metrics: dict) -> str:
    fmt = decide_format(serp, keyword)
    h2s, faq_qs = build_outline(serp, fmt, keyword)
    tm = title_meta(keyword, fmt)
    top5 = list(zip(
        serp.get("domains", [])[:5],
        serp.get("page_types", [])[:5],
        serp.get("titles", [])[:5],
    ))

    lines = [
        f"# Content Brief — {keyword}",
        "",
        f"- **Cluster intent (SERP):** {fmt['intent']}",
        f"- **Recommended format:** {fmt['format']} (`page_type: {fmt['page_type']}`)",
        f"- **Volume / KD / weak:** "
        f"{metrics.get('volume','—')} / {metrics.get('kd','—')} / "
        f"{metrics.get('weak_score','—')} (lowfruit={metrics.get('is_lowfruit','—')})",
        f"- **Recommended schema:** {', '.join(fmt['schema'])}",
        "",
        "## SERP top-5 (what currently ranks)",
        "",
    ]
    for i, (dom, pt, title) in enumerate(top5, 1):
        lines.append(f"{i}. [{pt}] **{dom}** — {title}")
    lines += ["", "## SERP weakness assessment", ""]
    for v in fmt["verdict"]:
        lines.append(f"- {v}")
    lines += ["", "## Recommended on-page", "",
              f"- **`<title>`:** {tm['title']}",
              f"- **H1:** {tm['h1']}",
              f"- **Meta description:** {tm['meta']}"]
    lines += ["", "## Draft outline (H2)", ""]
    for h in h2s:
        lines.append(f"## {h}")
    if pt in ("troubleshooting", "explainer"):
        lines += ["", "> Lead with a direct **short_answer** (2-3 sentences) for the "
                  "TL;DR + AI Overview."]
    if faq_qs:
        lines += ["", "### FAQ to cover (from PAA)", ""]
        for q in faq_qs:
            lines.append(f"- {q}?")
    related = serp.get("related") or []
    if related:
        lines += ["", "### Content angles (related searches)", ""]
        for r in related[:10]:
            lines.append(f"- {r}")
    lines += ["",
              "## Definition of Done (per SOP)",
              "- 1× H1, >=3 H2 sections, >900 words",
              "- primary keyword in <title>, H1, first 100 words, URL slug",
              "- JSON-LD schema emitted (see above)",
              "- internal links to/from the topic hub",
              "- `hugo --printPathWarnings` clean + `check_evergreen.py` green",
              ""]
    return "\n".join(lines)


def run(keywords: list[str], allow_live: bool, from_plan: int) -> int:
    if from_plan:
        keywords = _gap_keywords(from_plan)
    if not keywords:
        print("No keywords. Pass keywords or --from-plan N.")
        return 1

    rows = []
    for kw in keywords:
        serp = resolve_serp(kw, allow_live)
        if not serp:
            print(f"  [skip] '{kw}': no SERP (cache miss, --no-live or fetch failed)")
            rows.append((kw, "SKIP", "—", "—"))
            continue
        metrics = _metrics(kw)
        fmt = decide_format(serp, kw)
        md = render_brief(kw, serp, metrics)
        out = BRIEF_DIR / f"{_slug(kw)}.md"
        out.write_text(md, encoding="utf-8")
        rows.append((kw, fmt["page_type"], fmt["intent"],
                     ", ".join(fmt["schema"])))
        print(f"  [ok] {kw[:42]:42} -> {out.relative_to(ROOT)} "
              f"[{fmt['page_type']}/{fmt['intent']}]")

    print("\n=== BRIEF SUMMARY ===")
    print(f"{'KEYWORD':42} {'FORMAT':16} {'INTENT':14} SCHEMA")
    for kw, pt, intent, schema in rows:
        print(f"{kw[:42]:42} {pt:16} {intent:14} {schema}")
    return 0


def _gap_keywords(n: int) -> list[str]:
    """Top-N plan clusters whose primary keyword is NOT yet a published page."""
    import csv
    if not PLAN_CSV.exists():
        return []
    # published slugs (evergreen ids + article folders)
    published = set()
    ev = ROOT / "data" / "evergreen" / "troubleshooting.yaml"
    if ev.exists():
        for line in ev.read_text(encoding="utf-8").splitlines():
            m = re.match(r"\s*-\s*id:\s*(\S+)", line)
            if m:
                published.add(m.group(1))
    content = ROOT / "content"
    for d in content.iterdir():
        if d.is_dir():
            for sub in d.iterdir():
                if sub.is_dir() and (sub / "index.md").exists():
                    published.add(sub.name)

    out = []
    with PLAN_CSV.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            pk = row.get("primary_keyword", "")
            slug = _slug(pk)
            if slug not in published and pk:
                out.append(pk)
            if len(out) >= n:
                break
    return out


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("keywords", nargs="*")
    ap.add_argument("--no-live", action="store_true",
                    help="cache-only; never call DataForSEO")
    ap.add_argument("--from-plan", type=int, default=0,
                    help="brief the top-N GAP clusters not yet published")
    args = ap.parse_args()
    sys.exit(run(args.keywords, allow_live=not args.no_live, from_plan=args.from_plan))
