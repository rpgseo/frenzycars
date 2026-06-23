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

        has_howto = '"@type":"HowTo"' in html.replace(" ", "")
        if not has_howto:
            failures.append(f"{rel}: missing HowTo JSON-LD")

    if failures:
        print("FAIL — {} issue(s):".format(len(failures)))
        for f in failures:
            print("  - " + f)
        return 1

    print("OK — {} pages, all checks passed".format(len(pages)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
