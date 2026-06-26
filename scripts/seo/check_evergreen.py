#!/usr/bin/env python3
"""Verify the evergreen advice pages meet Fase-1 Definition of Done.

Run AFTER `hugo --printPathWarnings`. Checks:
  1. Page count matches expected (default 18).
  2. Each page has both FAQPage and HowTo JSON-LD blocks.
  3. Each page has an H1 and at least 3 content sections (h2).
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ADVICE = ROOT / "public" / "advice"
PRODUCTS_YAML = ROOT / "data" / "evergreen" / "products.yaml"
EXPECTED = 18


def main() -> int:
    pages = sorted(
        p
        for p in ADVICE.rglob("index.html")
        if p.parent != ADVICE and "/page/" not in p.as_posix()
    )
    failures: list[str] = []

    if len(pages) != EXPECTED:
        failures.append(f"page count: expected {EXPECTED}, got {len(pages)}")

    for page in pages:
        html = page.read_text(encoding="utf-8")
        rel = page.parent.relative_to(ADVICE).as_posix()

        h1_count = html.count("<h1")
        if h1_count != 1:
            failures.append(f"{rel}: expected 1 h1, found {h1_count}")

        h2_count = html.count("<h2")
        if h2_count < 3:
            failures.append(f"{rel}: expected >=3 h2 sections, found {h2_count}")

        has_faq = '"@type":"FAQPage"' in html.replace(" ", "")
        if not has_faq:
            failures.append(f"{rel}: missing FAQPage JSON-LD")

        # Every page must emit a rich schema beyond FAQ: HowTo (troubleshooting)
        # or ItemList (gift-guide). This is generic over page_type, so any future
        # gift-guide row is covered without hardcoding its path.
        has_howto = '"@type":"HowTo"' in html.replace(" ", "")
        has_itemlist = '"@type":"ItemList"' in html.replace(" ", "")
        if not has_howto and not has_itemlist:
            failures.append(f"{rel}: missing HowTo or ItemList JSON-LD")

    if failures:
        print("FAIL — {} issue(s):".format(len(failures)))
        for f in failures:
            print("  - " + f)
        return 1

    # Optional: validate enriched product data if the pipeline has been run.
    if PRODUCTS_YAML.exists():
        import yaml
        data = yaml.safe_load(PRODUCTS_YAML.read_text(encoding="utf-8")) or {}
        for page_id, prods in data.items():
            if page_id == "_meta":
                continue
            for pid, p in (prods or {}).items():
                if not p.get("asin"):
                    failures.append(f"products.yaml {page_id}/{pid}: missing asin")
                if not p.get("image_url"):
                    failures.append(f"products.yaml {page_id}/{pid}: missing image_url")
                if not p.get("price_from"):
                    failures.append(f"products.yaml {page_id}/{pid}: missing price_from")
        if failures:
            print("FAIL — {} enrichment issue(s):".format(len(failures)))
            for f in failures:
                print("  - " + f)
            return 1

    print("OK — {} pages, all checks passed".format(len(pages)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
