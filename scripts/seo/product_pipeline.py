#!/usr/bin/env python3
"""
FrenzyCars product enrichment pipeline.

Reads the `keyword` seed from every product slot in the gift-guide rows of
data/evergreen/troubleshooting.yaml, fetches real Amazon product data from the
DataForSEO Merchant/Amazon API (LIVE, synchronous), picks the best organic
result, and writes enriched data to data/evergreen/products.yaml which the Hugo
content adapter merges into the product cards.

No fabrication: only selects from what the API returns. Editorial fields
(pitch, best_for) are never touched.

Usage:
  python scripts/seo/product_pipeline.py            # dry-run (offline, uses cache)
  python scripts/seo/product_pipeline.py --live     # call DataForSEO (paid)
  python scripts/seo/product_pipeline.py --live --no-cache   # force refresh

Result item shape (merchant/amazon/products/live/advanced), verified fields:
  data_asin, title, url, image_url, price_from, price_to, currency,
  rating{value,votes_count}, is_amazon_choice, is_best_seller,
  bought_past_month, type (amazon_serp | amazon_paid | ...).
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
import yaml

ROOT = Path(__file__).resolve().parents[2]
DATASET = ROOT / "data" / "evergreen" / "troubleshooting.yaml"
OUT_YAML = ROOT / "data" / "evergreen" / "products.yaml"
RAW_DIR = ROOT / "research" / "products"
RAW_DIR.mkdir(parents=True, exist_ok=True)
RAW_JSON = RAW_DIR / "raw.json"

# US marketplace via amazon.com (language is bound to the marketplace domain).
LOCATION_NAME = "United States"
LANGUAGE_NAME = "English (United States)"
SE_DOMAIN = "amazon.com"
DEPTH = 10          # results to consider per keyword
TTL_HOURS = 20      # reuse cached data younger than this
LOC_KEY = "dataforseo-merchant-products"


# --------------------------------------------------------------------------- #
# Config / auth (mirrors keyword_pipeline.py)
# --------------------------------------------------------------------------- #
def _load_env() -> None:
    env_file = ROOT / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip("'\""))


_load_env()


class Cfg:
    login = os.environ.get("DFS_LOGIN", "")
    password = os.environ.get("DFS_PASSWORD", "")
    endpoint = os.environ.get("DFS_ENDPOINT", "https://api.dataforseo.com").rstrip("/")

    @classmethod
    def auth_header(cls) -> str:
        token = base64.b64encode(f"{cls.login}:{cls.password}".encode()).decode()
        return "Basic " + token


def dfs_live(path: str, payload: list[dict]) -> dict:
    url = f"{Cfg.endpoint}{path}"
    resp = requests.post(
        url, json=payload, headers={"Authorization": Cfg.auth_header()}, timeout=180
    )
    resp.raise_for_status()
    return resp.json()


def log(msg: str) -> None:
    print(msg, flush=True)


# --------------------------------------------------------------------------- #
# Dataset reading
# --------------------------------------------------------------------------- #
def load_gift_products() -> list[dict]:
    """Return [{page_id, product_id, keyword}] for every gift/buying-guide product."""
    data = yaml.safe_load(DATASET.read_text(encoding="utf-8")) or []
    slots: list[dict] = []
    for row in data:
        if (row.get("page_type") or "") not in ("gift-guide", "buying-guide"):
            continue
        page_id = row["id"]
        for prod in row.get("products") or []:
            if prod.get("keyword"):
                slots.append(
                    {
                        "page_id": page_id,
                        "product_id": prod["id"],
                        "keyword": prod["keyword"],
                    }
                )
    return slots


# --------------------------------------------------------------------------- #
# Selection heuristic
# --------------------------------------------------------------------------- #
def _score(it: dict) -> float:
    """Higher = better pick. Prefers organic, in-stock, well-rated, popular."""
    s = 0.0
    if it.get("type") == "amazon_serp":
        s += 100              # organic over sponsored
    if it.get("price_from"):
        s += 50               # has a price (in stock / buyable)
    rating = (it.get("rating") or {})
    val = rating.get("value") or 0
    votes = rating.get("votes_count") or 0
    s += val * 10             # rating weight
    s += min(votes, 5000) / 500   # diminishing returns on review count
    if it.get("is_amazon_choice"):
        s += 30
    if it.get("is_best_seller"):
        s += 20
    # rank bonus: higher up the SERP is slightly better
    s += max(0, 20 - (it.get("rank_absolute") or 99))
    return s


def select_best(items: list[dict]) -> dict | None:
    # Prefer organic results; fall back to sponsored only if no organic exists.
    org = [i for i in items if i.get("data_asin") and i.get("type") == "amazon_serp"]
    if not org:
        org = [i for i in items if i.get("data_asin")]
    if not org:
        return None
    return max(org, key=_score)


def to_enriched(it: dict) -> dict:
    rating = it.get("rating") or {}
    badges = []
    if it.get("is_amazon_choice"):
        badges.append("Amazon's Choice")
    if it.get("is_best_seller"):
        badges.append("Best Seller")
    return {
        "asin": it.get("data_asin"),
        "title": it.get("title"),
        "image_url": it.get("image_url"),
        "price_from": it.get("price_from"),
        "price_to": it.get("price_to"),
        "currency": it.get("currency"),
        "rating": rating.get("value"),
        "reviews": rating.get("votes_count"),
        "bought_past_month": it.get("bought_past_month"),
        "badges": badges,
        "url": it.get("url"),
    }


# --------------------------------------------------------------------------- #
# Pipeline
# --------------------------------------------------------------------------- #
def _cache_fresh() -> bool:
    if not RAW_JSON.exists():
        return False
    try:
        data = json.loads(RAW_JSON.read_text(encoding="utf-8"))
        ts = data.get("_fetched_at") or 0
        age_h = (time.time() - ts) / 3600
        return age_h < TTL_HOURS
    except Exception:
        return False


def fetch_live(slots: list[dict], no_cache: bool = False) -> dict:
    """Call DataForSEO for each keyword. Returns {slot_key: enriched}.

    Respects the raw.json cache: only keywords not already cached (fresh) are
    fetched, so re-runs are cheap. Pass no_cache=True to force a full refresh.
    """
    cache: dict = {}
    if RAW_JSON.exists() and not no_cache:
        try:
            cache = json.loads(RAW_JSON.read_text(encoding="utf-8"))
        except Exception:
            cache = {}
    fetched_at = cache.get("_fetched_at") or 0
    cache_fresh = ((time.time() - fetched_at) / 3600) < TTL_HOURS

    # Split slots into cached vs. needing fetch.
    to_fetch: list[dict] = []
    enriched: dict[str, dict] = {}
    for sl in slots:
        key = f"{sl['page_id']}::{sl['product_id']}"
        if cache_fresh and key in cache:
            best = select_best(cache.get(key) or [])
            if best:
                enriched[key] = to_enriched(best)
            continue
        to_fetch.append(sl)

    if enriched:
        log(f"  reusing {len(enriched)} cached products (< {TTL_HOURS} h old)")
    if not to_fetch:
        log("  all products cached and fresh; nothing to fetch.")
        return enriched

    log(f"  fetching {len(to_fetch)} keyword(s) from DataForSEO (LIVE)...")
    for sl in to_fetch:
        key = f"{sl['page_id']}::{sl['product_id']}"
        payload = [{
            "keyword": sl["keyword"],
            "location_name": LOCATION_NAME,
            "language_name": LANGUAGE_NAME,
            "se_domain": SE_DOMAIN,
            "depth": DEPTH,
        }]
        try:
            data = dfs_live("/v3/merchant/amazon/products/live/advanced", payload)
        except requests.HTTPError as e:
            log(f"  [warn] '{sl['keyword']}': {e}")
            continue
        items: list[dict] = []
        for t in data.get("tasks", []):
            if t.get("status_code") != 20000:
                log(f"  [warn] task {t.get('status_code')} {t.get('status_message')}")
                continue
            for r in (t.get("result") or []):
                items.extend(r.get("items") or [])
        cache[key] = items
        # incremental flush so an interruption never loses progress
        cache["_fetched_at"] = time.time()
        _tmp = RAW_JSON.with_suffix(".tmp")
        _tmp.write_text(json.dumps(cache, indent=2), encoding="utf-8")
        os.replace(_tmp, RAW_JSON)
        best = select_best(items)
        if best:
            enriched[key] = to_enriched(best)
            log(f"  ok  {sl['keyword'][:40]:40} -> {best.get('data_asin')} "
                f"{(best.get('title') or '')[:48]}")
        else:
            log(f"  [warn] no organic product for '{sl['keyword']}'")
        time.sleep(1)  # gentle pacing
    # persist raw for audit + offline reuse (final stamp already kept current incrementally)
    cache["_fetched_at"] = time.time()
    tmp = RAW_JSON.with_suffix(".tmp")
    tmp.write_text(json.dumps(cache, indent=2), encoding="utf-8")
    os.replace(tmp, RAW_JSON)
    return enriched


def from_cache(slots: list[dict]) -> dict:
    """Rebuild enriched selection from cached raw.json (offline)."""
    if not RAW_JSON.exists():
        return {}
    data = json.loads(RAW_JSON.read_text(encoding="utf-8"))
    enriched: dict[str, dict] = {}
    for sl in slots:
        key = f"{sl['page_id']}::{sl['product_id']}"
        best = select_best(data.get(key) or [])
        if best:
            enriched[key] = to_enriched(best)
    return enriched


def write_yaml(enriched: dict[str, dict]) -> None:
    # nest under page_id -> product_id for clean adapter lookup
    nested: dict[str, dict] = {}
    for key, val in enriched.items():
        page_id, product_id = key.split("::", 1)
        nested.setdefault(page_id, {})[product_id] = val
    nested["_meta"] = {
        "updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "dataforseo merchant/amazon products live",
    }
    OUT_YAML.write_text(yaml.safe_dump(nested, sort_keys=False), encoding="utf-8")
    log(f"  wrote {OUT_YAML.relative_to(ROOT)} ({len(enriched)} products)")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--live", action="store_true",
                    help="call DataForSEO (paid). Default is offline dry-run from cache.")
    ap.add_argument("--no-cache", action="store_true",
                    help="ignore cached data and refetch (implies --live).")
    args = ap.parse_args()
    if args.no_cache:
        args.live = True

    slots = load_gift_products()
    if not slots:
        log("No gift-guide products with a `keyword` found. Nothing to do.")
        return 0

    if args.live:
        if not (Cfg.login and Cfg.password):
            log("ERROR: DFS_LOGIN/DFS_PASSWORD not set (.env).")
            return 2
        enriched = fetch_live(slots, no_cache=args.no_cache)
    else:
        if _cache_fresh():
            log("  cache is fresh (< %d h); using cached raw.json" % TTL_HOURS)
        else:
            log("  no fresh cache; using raw.json if present (run --live to refresh)")
        enriched = from_cache(slots)

    if not enriched:
        log("  no enriched data available — the adapter will fall back to static values.")
        if OUT_YAML.exists():
            OUT_YAML.unlink()
        return 0

    write_yaml(enriched)
    return 0


if __name__ == "__main__":
    sys.exit(main())
