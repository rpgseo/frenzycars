#!/usr/bin/env python3
"""
FrenzyCars keyword research pipeline (Phases 2-6).
Output table:
    keyword | category | cluster_id | volume | cpc | kd% | intent |
    competitors_ranking | priority | content_type

Live-data-only: never fabricates volume/cpc/kd. Reads data/keywords/seeds.yaml
(Phase 1) and calls DataForSEO Labs + SERP APIs.

Provenance of DataForSEO response shapes (verified):
  - every task["result"] is a LIST (one element per request body).
  - keyword_suggestions item: {keyword, keyword_info{search_volume,cpc},
                               search_intent_info{...}}
  - related_keywords  item: {keyword_data{keyword}, related_keywords[...]}
  - search_volume     item: {keyword, search_volume, cpc, competition}
  - bulk KD           item: {keyword, keyword_difficulty}
  - serp organic      items: organic(url), people_also_ask, related_searches
"""
from __future__ import annotations

import argparse
import base64
import csv
import json
import os
import sys
import threading
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests
import yaml

ROOT = Path(__file__).resolve().parents[2]
SEEDS = ROOT / "research" / "keywords" / "seeds.yaml"
OUT_DIR = ROOT / "research" / "keywords"
OUT_DIR.mkdir(parents=True, exist_ok=True)


def _atomic_write_json(path: Path, obj) -> None:
    """Write JSON atomically so a crash mid-write never corrupts the cache."""
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(obj, indent=2), encoding="utf-8")
    os.replace(tmp, path)


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
        return f"Basic " + token


def dfs_post(path: str, payload: list[dict]) -> dict:
    url = f"{Cfg.endpoint}{path}"
    resp = requests.post(
        url, json=payload, headers={"Authorization": Cfg.auth_header()}, timeout=180
    )
    resp.raise_for_status()
    return resp.json()


def _task_results(data: dict) -> list[dict]:
    """Flatten all task result-list elements across the response."""
    out: list[dict] = []
    for t in data.get("tasks", []):
        if t.get("status_code") != 20000:
            print(f"  [warn] task {t.get('status_code')} {t.get('status_message')}",
                  file=sys.stderr)
            continue
        res = t.get("result")
        if isinstance(res, list):
            out.extend(res)
        elif isinstance(res, dict):
            out.append(res)
    return out


# --------------------------------------------------------------------------- #
# Phase 2 + 3a: expansion + volume/cpc/intent via Labs suggestions/related
# --------------------------------------------------------------------------- #
def log(msg: str) -> None:
    print(msg, flush=True)


def expand_with_metrics(keyword: str, vol_min: int = 50, limit: int = 200) -> list[dict]:
    """
    One Labs keyword_suggestions call (returns long-tails WITH keyword_info +
    search_intent) + one related_keywords call. Cheaper than N separate calls.
    Pre-filters by volume inside the API to keep the pool (and later SERP cost) small.
    """
    found: dict[str, dict] = {}
    sug_payload = {
        "keyword": keyword, "location_code": 2840, "language_code": "en",
        "limit": limit,
        "filters": ["keyword_info.search_volume", ">=", vol_min],
    }

    # keyword_suggestions (Google Autocomplete-based, carries volume/cpc/intent)
    try:
        data = dfs_post(
            "/v3/dataforseo_labs/google/keyword_suggestions/live", [sug_payload],
        )
        for r in _task_results(data):
            for it in r.get("items", []) or []:
                kw = it.get("keyword")
                if not kw:
                    continue
                ki = it.get("keyword_info") or {}
                si = it.get("search_intent_info") or {}
                found[kw] = {
                    "volume": ki.get("search_volume") or 0,
                    "cpc": ki.get("cpc") or 0.0,
                    "intent": si.get("main_intent") or "",
                }
    except requests.HTTPError as e:
        log(f"  [warn] suggestions '{keyword}': {e}")

    # related_keywords (semantic expansion)
    try:
        data = dfs_post(
            "/v3/dataforseo_labs/google/related_keywords/live",
            [{"keyword": keyword, "location_code": 2840, "language_code": "en"}],
        )
        for r in _task_results(data):
            for it in r.get("items", []) or []:
                kd = it.get("keyword_data") or {}
                kw = kd.get("keyword")
                ki = kd.get("keyword_info") or {}
                if kw and kw not in found:
                    found[kw] = {
                        "volume": ki.get("search_volume") or 0,
                        "cpc": ki.get("cpc") or 0.0,
                        "intent": "",
                    }
    except requests.HTTPError as e:
        log(f"  [warn] related '{keyword}': {e}")

    return [{"keyword": k, **v} for k, v in found.items()]


def bulk_volume(keywords: list[str], batch: int = 1000) -> dict[str, dict]:
    """Backfill volume/cpc for seeds themselves via Ads search_volume."""
    out: dict[str, dict] = {}
    for i in range(0, len(keywords), batch):
        chunk = keywords[i:i + batch]
        try:
            data = dfs_post(
                "/v3/keywords_data/google_ads/search_volume/live",
                [{"keywords": chunk, "location_code": 2840, "language_code": "en"}],
            )
            for r in _task_results(data):
                for it in r.get("items", []) or []:
                    out[it["keyword"]] = {
                        "volume": it.get("search_volume") or 0,
                        "cpc": it.get("cpc") or 0.0,
                    }
        except requests.HTTPError as e:
            # Only split/re-spend on size/policy restriction (400/422); never
            # blindly re-call the LIVE API for 429/5xx (back off + skip).
            status = getattr(getattr(e, "response", None), "status_code", None)
            print(f"  [warn] volume batch {i} (status {status}): {e}",
                  file=sys.stderr)
            if status in (400, 422) and batch > 50:
                time.sleep(1)
                out.update(bulk_volume(chunk, batch // 2))
            else:
                time.sleep(2)
        time.sleep(0.5)
    return out


def bulk_kd(keywords: list[str], batch: int = 1000) -> dict[str, int]:
    out: dict[str, int] = {}
    for i in range(0, len(keywords), batch):
        chunk = keywords[i:i + batch]
        try:
            data = dfs_post(
                "/v3/dataforseo_labs/google/bulk_keyword_difficulty/live",
                [{"keywords": chunk, "location_code": 2840, "language_code": "en"}],
            )
            for r in _task_results(data):
                for it in r.get("items", []) or []:
                    out[it["keyword"]] = it.get("keyword_difficulty") or 0
        except requests.HTTPError as e:
            status = getattr(getattr(e, "response", None), "status_code", None)
            print(f"  [warn] kd batch {i} (status {status}): {e}",
                  file=sys.stderr)
            if status in (400, 422) and batch > 50:
                time.sleep(1)
                out.update(bulk_kd(chunk, batch // 2))
            else:
                time.sleep(2)
        time.sleep(0.5)
    return out


# --------------------------------------------------------------------------- #
# Phase 4 + PAA harvest + weak-spot detection: SERP
# --------------------------------------------------------------------------- #
# User-generated content / forum domains (Keyword Chef / LowFruits weak-spot
# signal #1: forums & UGC on page 1 => high chance of ranking).
UGC_DOMAINS = {
    "reddit.com", "quora.com", "stackoverflow.com", "stackexchange.com",
    "youtube.com", "facebook.com", "pinterest.com", "tiktok.com",
    "twitter.com", "medium.com", "ning.com", "groups.io",
}
# Marketplaces / shopping (transactional SERP).
SHOPPING_DOMAINS = {
    "amazon.com", "ebay.com", "walmart.com", "bestbuy.com", "etsy.com",
    "homedepot.com", "lowes.com", "target.com", "costco.com",
    "autozone.com", "oreillyauto.com", "advanceautoparts.com", "rockauto.com",
    "carparts.com", "summitracing.com",
}
# Authority aggregators / review-list sites.
AGGREGATOR_DOMAINS = {
    "iseecars.com", "usnews.com", "cars.usnews.com", "consumerreports.org",
    "cargurus.com", "edmunds.com", "kbb.com", "caranddriver.com",
    "motortrend.com", "autoblog.com", "thecarconnection.com", "cars.com",
    "autotrader.com", "truecar.com", "carmax.com", "jalopnik.com",
    "motortrend.com", "topspeed.com", "hotcars.com", "carscoops.com",
    "theautopian.com", "slashgear.com",
}

STOPWORDS = {
    "a", "an", "the", "for", "to", "in", "on", "of", "and", "or", "with",
    "is", "are", "my", "me", "how", "what", "why", "when", "do", "does",
    "it", "your", "you", "best", "car", "cars",
}


def _domain_of(url: str) -> str:
    from urllib.parse import urlparse
    net = urlparse(url).netloc.lower()
    if net.startswith("www."):
        net = net[4:]
    return net


def _domain_matches(domain: str, ref: str) -> bool:
    """Anchored domain match: ref or any *.ref subdomain (no bare suffix)."""
    return domain == ref or domain.endswith("." + ref)


def _classify_domain(domain: str) -> str:
    if not domain:
        return "unknown"
    if any(_domain_matches(domain, d) for d in UGC_DOMAINS):
        return "forum_ugc"
    if any(_domain_matches(domain, d) for d in SHOPPING_DOMAINS):
        return "shopping"
    if any(_domain_matches(domain, d) for d in AGGREGATOR_DOMAINS):
        return "aggregator"
    # OEM / dealership heuristic
    if any(s in domain for s in ("dealer", "motors", "of ", "automall",
                                 "autogroup", "cars.com", "auto.com")):
        return "oem_dealer"
    for brand in ("toyota", "honda", "ford", "chevrolet", "nissan", "hyundai",
                  "kia", "mazda", "subaru", "volkswagen", "volvo", "bmw",
                  "mercedes", "audi", "lexus", "tesla", "jeep", "ram",
                  "gmc", "buick", "cadillac", "acura", "infiniti", "porsche"):
        if domain.startswith(brand) or f".{brand}" in domain:
            return "oem_dealer"
    return "other"


def _core_terms(keyword: str) -> set[str]:
    return {w for w in keyword.lower().replace("-", " ").split()
            if w not in STOPWORDS and len(w) > 2}


def _title_match_ratio(keyword: str, titles: list[str]) -> float:
    core = _core_terms(keyword)
    if not titles:
        return 0.0
    if not core:
        return 0.5  # neutral: no usable signal (all terms are stopwords)
    matched = 0
    for t in titles:
        tset = set((t or "").lower().split())
        if core & tset:
            matched += 1
    return matched / len(titles)


def _intent_from_serp(types: list[str], keyword: str) -> str:
    if not types:
        return classify_intent(keyword, "")
    counts: dict[str, int] = defaultdict(int)
    for t in types:
        counts[t] += 1
    n = len(types)
    forum = counts.get("forum_ugc", 0)
    shop = counts.get("shopping", 0)
    agg = counts.get("aggregator", 0)
    oem = counts.get("oem_dealer", 0)
    if shop / n >= 0.3:
        return "Transactional"
    if (agg + oem) / n >= 0.5 and any(w in keyword.lower()
                                      for w in ("best", "top", "vs", "review")):
        return "Commercial"
    if forum / n >= 0.3:
        return "Informational"  # community Q&A
    if agg / n >= 0.5:
        return "Commercial"
    return classify_intent(keyword, "")


def _weak_score(forum_hits: int, title_ratio: float, major_in_top5: bool,
                major_in_top3: bool, kd) -> int:
    """LowFruits/KeywordChef-style SERP weakness (higher = easier to rank)."""
    score = 50
    score += min(forum_hits, 4) * 10          # forums on page 1 => weak SERP
    score += (1 - title_ratio) * 20           # titles not matching => weak
    if not major_in_top5:
        score += 8
    if major_in_top3:
        score -= 18
    if kd is not None:
        kdv = float(kd)
        if kdv <= 10:
            score += 8
        elif kdv >= 30:
            score -= 12
    return int(max(0, min(100, score)))


def serp_insight(keyword: str, competitors: list[str], majors: list[str],
                 major_min: int = 3, depth: int = 10) -> dict | None:
    """Rich SERP analysis: competitors, major dominance, Top10 urls (clustering),
    per-result domains + titles + page types, forum/UGC weak-spot count,
    title-match ratio, AI-Overview (GEO), PAA questions, related searches,
    SERP-derived intent and a LowFruits-style weak_score. Returns None on
    transient failure so the caller can retry on resume (never cache empties)."""
    try:
        data = dfs_post(
            "/v3/serp/google/organic/live/advanced",
            [{
                "keyword": keyword, "location_code": 2840,
                "language_code": "en", "depth": depth,
            }],
        )
    except requests.HTTPError as e:
        # Never swallow as an empty result: that would poison the cache.
        log(f"  [warn] serp '{keyword}': {e}")
        return None

    urls: list[str] = []
    domains: list[str] = []
    titles: list[str] = []
    paa: list[str] = []
    related: list[str] = []
    ai_overview = False
    for r in _task_results(data):
        for it in r.get("items", []) or []:
            typ = it.get("type")
            if typ == "ai_overview":
                ai_overview = True
            elif typ == "organic":
                u = (it.get("url") or "").lower()
                urls.append(u)
                domains.append(_domain_of(u))
                titles.append(it.get("title") or "")
            elif typ == "people_also_ask":
                for el in it.get("items", []) or []:
                    q = el.get("title") or el.get("question")
                    if q:
                        paa.append(q)
            elif typ == "related_searches":
                rel = it.get("items") or []
                if isinstance(rel, list):
                    related.extend([x for x in rel if isinstance(x, str)])

    top10_urls = urls[:10]
    top10_domains = domains[:10]
    top10_titles = titles[:10]
    page_types = [_classify_domain(d) for d in top10_domains]
    forum_hits = sum(1 for t in page_types if t == "forum_ugc")
    title_ratio = _title_match_ratio(keyword, top10_titles)
    # Single normalized major-presence test for both weak_score and exclusion.
    def _maj_in(slice_: list[str]) -> bool:
        return any(_domain_matches(d, m) for d in slice_ for m in majors)
    major_in_top5 = _maj_in(top10_domains[:5])
    major_in_top3 = _maj_in(top10_domains[:3])
    major_count = sum(1 for d in top10_domains
                      if any(_domain_matches(d, m) for m in majors))
    comp_ranking = [c for c in competitors if any(c in u for u in urls)]
    return {
        "comp_ranking": comp_ranking,
        "major_dominant": major_count >= major_min,
        "top10": top10_urls,
        "domains": top10_domains,
        "titles": top10_titles,
        "page_types": page_types,
        "forum_hits": forum_hits,
        "title_match_ratio": round(title_ratio, 2),
        "major_in_top5": major_in_top5,
        "major_in_top3": major_in_top3,
        "ai_overview": ai_overview,
        "paa": paa,
        "related": related,
        "intent_serp": _intent_from_serp(page_types, keyword),
    }


# --------------------------------------------------------------------------- #
# Phase 6: SERP-overlap clustering (union-find)
# --------------------------------------------------------------------------- #
def cluster_by_serp(rows: list[dict], overlap: float = 0.40) -> dict:
    parent = {r["keyword"]: r["keyword"] for r in rows}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb

    # precompute URL sets once; build inverted index URL -> keywords to avoid
    # comparing pairs that share no URL at all.
    sets = {r["keyword"]: set(r.get("top10", [])) for r in rows}
    sets = {k: v for k, v in sets.items() if v}  # drop empty (no SERP data)
    inv: dict[str, list[str]] = defaultdict(list)
    for kw, us in sets.items():
        for u in us:
            inv[u].append(kw)

    candidate_pairs = set()
    for kws in inv.values():
        for i in range(len(kws)):
            for j in range(i + 1, len(kws)):
                candidate_pairs.add((kws[i], kws[j]))

    for a, b in candidate_pairs:
        ua, ub = sets[a], sets[b]
        inter = len(ua & ub)
        denom = min(len(ua), len(ub)) or 1
        if inter / denom >= overlap:
            union(a, b)

    groups: dict[str, list[str]] = defaultdict(list)
    for kw in parent:
        groups[find(kw)].append(kw)
    cid = {}
    for idx, members in enumerate(sorted(groups.values(), key=len, reverse=True), 1):
        for kw in members:
            cid[kw] = f"CL-{idx:03d}"
    return cid


# --------------------------------------------------------------------------- #
def classify_intent(kw: str, hinted: str = "") -> str:
    if hinted:
        return hinted.capitalize()
    k = kw.lower()
    if any(w in k for w in ("buy", "for sale", "dealership", "near me")):
        return "Transactional"
    if any(w in k for w in ("best", "top", "vs", "compare", "cheap", "price", "cost")):
        return "Commercial"
    return "Informational"


def run(dry: bool, serp_cap: int, resume: bool, force: bool = False) -> None:
    cfg = yaml.safe_load(SEEDS.read_text(encoding="utf-8"))
    competitors = cfg["competitors"]
    majors = cfg["majors_to_exclude"]
    flt = cfg["filters"]

    pool_file = OUT_DIR / "pool.json"
    serp_file = OUT_DIR / "serp.json"

    seed_rows = []
    for group in cfg["seeds"]:
        cat = group["category"]
        for s in group["seeds"]:
            seed_rows.append({"keyword": s["keyword"], "category": cat,
                              "intent_hint": s.get("intent", "")})

    if dry:
        _write_table(seed_rows, dry=True)
        log(f"[dry] {len(seed_rows)} seeds written.")
        return

    if not (Cfg.login and Cfg.password):
        sys.exit("[error] missing DFS_LOGIN/DFS_PASSWORD in .env or env (or use --dry).")

    # --- Phase 2 + 3: expand + metrics (persist + resumable) ---
    # Cache reuse is the default (safe path, no re-spend). --force re-runs all
    # paid calls even when caches exist.
    use_pool_cache = (not force) and pool_file.exists()
    if use_pool_cache:
        pool = json.loads(pool_file.read_text(encoding="utf-8"))
        log(f"[cache] pool.json loaded: {len(pool)} keywords"
            + ("" if resume else " (auto-reuse; pass --force to re-spend)"))
    else:
        pool: dict[str, dict] = {}
        for s in seed_rows:
            log(f"expand: {s['keyword']}")
            for t in expand_with_metrics(s["keyword"]):
                entry = pool.setdefault(t["keyword"], {"category": s["category"]})
                entry.setdefault("intent_hint", s["intent_hint"])
                entry["volume"] = t.get("volume", 0)
                entry["cpc"] = t.get("cpc", 0.0)
                if t.get("intent") and not entry.get("intent_dfs"):
                    entry["intent_dfs"] = t["intent"]
        # ensure seeds in pool
        for s in seed_rows:
            pool.setdefault(s["keyword"], {"category": s["category"]})
        log(f"[pool] {len(pool)} unique keywords")
        _atomic_write_json(pool_file, pool)

    # backfill volume for any keyword still missing it
    missing = [k for k, v in pool.items() if "volume" not in v]
    if missing:
        log(f"[metrics] backfilling volume for {len(missing)} keywords...")
        vol = bulk_volume(missing)
        for k, m in vol.items():
            pool[k]["volume"] = m["volume"]
            pool[k]["cpc"] = m["cpc"]
        _atomic_write_json(pool_file, pool)

    # --- Phase 5: volume floor ---
    floor = flt["volume_floor"]
    maint_floor = flt.get("maintenance_volume_floor", 0)
    kept = [k for k, v in pool.items() if
            (maint_floor if v["category"].startswith("Maintenance") else floor)
            <= (v["volume"] if v.get("volume") is not None else -1)]
    log(f"[filter] {len(kept)} keywords pass volume floor")

    # --- Phase 3b: KD (missing -> None, never fabricated as 0) ---
    if missing_kd := [k for k in kept if "kd" not in pool[k]]:
        log(f"[metrics] bulk keyword difficulty for {len(missing_kd)}...")
        kd = bulk_kd(missing_kd)
        for k in kept:
            pool[k]["kd"] = kd.get(k, None)
        _atomic_write_json(pool_file, pool)

    # --- Phase 4: SERP gap + PAA on top-N by volume (cost control) ---
    major_min = int(flt.get("major_dominant_min", 3))
    candidates = sorted(kept, key=lambda k: pool[k]["volume"], reverse=True)[:serp_cap]
    log(f"[serp] running SERP on top-{len(candidates)} by volume (cap={serp_cap})")
    all_paa = set()
    if (not force) and serp_file.exists():
        serp_cache = json.loads(serp_file.read_text(encoding="utf-8"))
        log(f"[cache] serp.json loaded: {len(serp_cache)} entries"
            + ("" if resume else " (auto-reuse; pass --force to re-spend)"))
    else:
        serp_cache = {}
    # Normalize cached entries to the current rules without re-fetching:
    # recompute ALL derived SERP fields from stored domains/titles using the
    # fixed classifiers (no re-spend). Legacy entries missing domains/titles
    # keep whatever was cached.
    for kw, s in serp_cache.items():
        s["top10"] = (s.get("top10", []) or [])[:10]
        doms = (s.get("domains", []) or [])[:10]
        titles = (s.get("titles", []) or [])[:10]
        if doms:
            page_types = [_classify_domain(d) for d in doms]
            s["page_types"] = page_types
            s["forum_hits"] = sum(1 for t in page_types if t == "forum_ugc")
            s["major_in_top5"] = any(_domain_matches(d, m)
                                     for d in doms[:5] for m in majors)
            s["major_in_top3"] = any(_domain_matches(d, m)
                                     for d in doms[:3] for m in majors)
            major_count = sum(1 for d in doms
                              if any(_domain_matches(d, m) for m in majors))
            s["major_dominant"] = major_count >= major_min
            s["intent_serp"] = _intent_from_serp(page_types, kw)
        else:  # legacy cache without domains: substring fallback
            s["major_dominant"] = sum(1 for m in majors
                                      if any(m in u for u in s["top10"])) >= major_min
        if titles:
            s["title_match_ratio"] = round(_title_match_ratio(kw, titles), 2)
    todo = [k for k in candidates if k not in serp_cache]
    lock = threading.Lock()
    done = [0]
    serp_depth = int(flt.get("serp_depth", 10))

    def _serp_job(kw: str) -> None:
        s = serp_insight(kw, competitors, majors, major_min=major_min,
                         depth=serp_depth)
        if s is None:
            return  # transient failure: leave uncached so resume retries
        with lock:
            serp_cache[kw] = s
            all_paa.update(s.get("paa", []))
            done[0] += 1
            snapshot = dict(serp_cache)
            n = done[0]
        if n % 10 == 0:
            _atomic_write_json(serp_file, serp_cache)
        log(f"[serp {n}/{len(todo)}] {kw}")

    workers = int(flt.get("serp_workers", 6))
    with ThreadPoolExecutor(max_workers=max(1, workers)) as ex:
        list(ex.map(_serp_job, todo))
    _atomic_write_json(serp_file, serp_cache)
    for s in serp_cache.values():
        all_paa.update(s.get("paa", []))
    log(f"[paa] harvested {len(all_paa)} FAQ-style questions")

    # --- merge kept + paa into rows ---
    # PAA questions are a separate FAQ stream: no fabricated metrics, excluded
    # from priority/pillar/cluster math.
    rows = []
    for k in kept:
        v = pool[k]
        s = serp_cache.get(k, {})
        intent_serp = s.get("intent_serp", "")
        rows.append({
            "keyword": k, "category": v["category"], "is_paa": False,
            "volume": v.get("volume", 0), "cpc": v.get("cpc", 0.0),
            "kd": v.get("kd"),
            "intent": intent_serp or classify_intent(
                k, v.get("intent_dfs") or v.get("intent_hint")),
            "comp_ranking": s.get("comp_ranking", []),
            "major_dominant": s.get("major_dominant", False),
            "major_in_top5": s.get("major_in_top5", False),
            "major_in_top3": s.get("major_in_top3", False),
            "forum_hits": s.get("forum_hits", 0),
            "title_match_ratio": s.get("title_match_ratio", 0.0),
            "page_types": s.get("page_types", []),
            "ai_overview": s.get("ai_overview", False),
            "top10": s.get("top10", []),
            "related": s.get("related", []),
        })
    for q in all_paa:
        rows.append({
            "keyword": q, "category": "Maintenance & DIY / Troubleshooting",
            "is_paa": True, "volume": None, "cpc": None, "kd": None,
            "intent": "Informational",
            "comp_ranking": [], "major_dominant": False, "ai_overview": False,
            "top10": [], "related": [],
        })

    # --- exclusion: majors dominant (except Cat-5) ---
    final = [r for r in rows if
             not (r["major_dominant"] and r["category"] != "Car Reviews & Comparisons")]

    # --- priority (KD + volume driven, with competitor-gap bonus) ---
    # For a zero-authority domain, low KD is the dominant opportunity signal.
    # Missing KD (None) contributes NO points — never treated as low difficulty.
    kd_hi = flt.get("kd_high", 10)
    kd_md = flt.get("kd_medium", 20)
    vol_hi = flt.get("volume_high", 1000)
    vol_md = flt.get("volume_medium", 300)
    minc = flt["gap_priority_min_competitors"]
    lf_score = int(flt.get("lowfruit_min_score", 70))
    lf_forums = int(flt.get("lowfruit_min_forums", 2))
    for r in final:
        if r["is_paa"]:
            r["priority"] = "n/a"   # FAQ stream, no scored metrics
            r["weak_score"] = None
            r["is_lowfruit"] = False
            continue
        kdv = r.get("kd")
        vol = int(r.get("volume", 0) or 0)
        ncomp = len(r["comp_ranking"])
        # LowFruits/KeywordChef-style SERP weakness (real difficulty signal).
        ws = _weak_score(r.get("forum_hits", 0),
                         r.get("title_match_ratio", 0.0),
                         r.get("major_in_top5", False),
                         r.get("major_in_top3", False), kdv)
        r["weak_score"] = ws
        r["is_lowfruit"] = ws >= lf_score or r.get("forum_hits", 0) >= lf_forums
        score = 0
        if kdv is not None:
            kdv = float(kdv)
            if kdv <= kd_hi:
                score += 2
            elif kdv <= kd_md:
                score += 1
        if vol >= vol_hi:
            score += 2
        elif vol >= vol_md:
            score += 1
        if ncomp >= minc:
            score += 2
        elif ncomp >= 1:
            score += 1
        if r["is_lowfruit"]:
            score += 2
        r["priority"] = "high" if score >= 4 else ("medium" if score >= 3 else "low")

    # --- Phase 6: clustering (keyword pool only; PAA excluded) ---
    kw_rows = [r for r in final if not r["is_paa"] and r["top10"]]
    cid = cluster_by_serp(kw_rows, flt["cluster_serp_overlap"])
    # standalone keywords (no SERP data) get unique clusters
    c = len(set(cid.values())) + 1
    for r in final:
        if r["is_paa"]:
            cid[r["keyword"]] = "FAQ"
        elif r["keyword"] not in cid:
            cid[r["keyword"]] = f"CL-{c:03d}"
            c += 1

    # pillar = highest aggregate-volume cluster per category (PAA excluded)
    agg: dict[tuple, int] = defaultdict(int)
    for r in final:
        if r["is_paa"]:
            continue
        agg[(r["category"], cid[r["keyword"]])] += int(r.get("volume", 0) or 0)
    pillar: dict[str, str] = {}
    for (cat, cl), _ in sorted(agg.items(), key=lambda x: -x[1]):
        pillar.setdefault(cat, cl)
    for r in final:
        cl = cid[r["keyword"]]
        if r["is_paa"]:
            r["content_type"] = "evergreen-support"
        elif cl == pillar.get(r["category"]):
            r["content_type"] = "pillar"
        elif r["category"].startswith("Maintenance"):
            r["content_type"] = "evergreen-support"
        else:
            r["content_type"] = "cluster"
        r["cluster_id"] = cl

    # Parent Topic (Ahrefs): keyword sending most traffic to top-ranking page.
    # Proxy = highest-volume non-PAA keyword in each cluster -> defines the
    # page that should target the whole cluster (URL / H1 / title).
    cl_best: dict[str, tuple[int, str]] = {}
    for r in final:
        if r["is_paa"]:
            continue
        cl_ = r["cluster_id"]
        vol = int(r.get("volume", 0) or 0)
        if cl_ not in cl_best or vol > cl_best[cl_][0]:
            cl_best[cl_] = (vol, r["keyword"])
    for r in final:
        r["primary_keyword"] = ("" if r["is_paa"]
                                else cl_best.get(r["cluster_id"], ("", r["keyword"]))[1])

    final.sort(key=lambda r: (r["category"], -(int(r.get("volume", 0) or 0))))
    _write_table(final)
    log(f"[done] {len(final)} rows -> data/keywords/output.csv (+ .json)")


def _write_table(rows: list[dict], dry: bool = False) -> None:
    fields = ["keyword", "category", "cluster_id", "primary_keyword", "volume",
              "cpc", "kd%", "intent", "forum_hits", "weak_score", "is_lowfruit",
              "competitors_ranking", "priority", "content_type", "ai_overview"]
    with (OUT_DIR / "output.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for r in rows:
            vol = r.get("volume")
            cpc = r.get("cpc")
            kdv = r.get("kd")
            ws = r.get("weak_score")
            w.writerow({
                "keyword": r["keyword"],
                "category": r["category"],
                "cluster_id": r.get("cluster_id", "—") if not dry else "—",
                "primary_keyword": r.get("primary_keyword", "") if not dry else "—",
                "volume": "" if vol is None else vol,
                "cpc": "" if cpc is None else round(float(cpc or 0.0), 2),
                "kd%": ("" if kdv is None else kdv) if not dry else "—",
                "intent": r.get("intent", r.get("intent_hint", "")),
                "forum_hits": "" if r.get("is_paa") else r.get("forum_hits", 0),
                "weak_score": "" if ws is None else ws,
                "is_lowfruit": "" if r.get("is_paa") else r.get("is_lowfruit", False),
                "competitors_ranking": ";".join(r.get("comp_ranking", [])),
                "priority": r.get("priority", "—") if not dry else "—",
                "content_type": r.get("content_type", "—") if not dry else "—",
                "ai_overview": r.get("ai_overview", False),
            })
    (OUT_DIR / "output.json").write_text(
        json.dumps(rows, indent=2, default=str), encoding="utf-8"
    )


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--resume", action="store_true",
                    help="reuse data/keywords/pool.json + serp.json if present")
    ap.add_argument("--force", action="store_true",
                    help="ignore caches and re-run ALL paid calls (re-spend)")
    ap.add_argument("--serp-cap", type=int, default=120,
                    help="max keywords to run SERP on (cost control), top by volume")
    args = ap.parse_args()
    run(dry=args.dry, serp_cap=args.serp_cap, resume=args.resume, force=args.force)
