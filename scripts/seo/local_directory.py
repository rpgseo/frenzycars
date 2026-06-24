#!/usr/bin/env python3
"""
Fetch real Google Maps 'car wrap shop' listings for major US metros via the
DataForSEO Google Maps SERP endpoint, and emit a YAML-friendly structure for
the car-wrap-near-me local-directory page.

Caches raw responses to research/local/car_wrap_shops.json (incremental flush).
"""
from __future__ import annotations
import base64, json, os, sys, time
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "research" / "local"
OUT_DIR.mkdir(parents=True, exist_ok=True)
RAW = OUT_DIR / "car_wrap_shops.json"

def load_env():
    f = ROOT / ".env"
    if not f.exists(): return
    for line in f.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line: continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip("'\""))
load_env()

LOGIN = os.environ.get("DFS_LOGIN", "")
PASSWORD = os.environ.get("DFS_PASSWORD", "")
ENDPOINT = os.environ.get("DFS_ENDPOINT", "https://api.dataforseo.com").rstrip("/")
AUTH = "Basic " + base64.b64encode(f"{LOGIN}:{PASSWORD}".encode()).decode()

CITIES = [
    "New York, New York, United States",
    "Los Angeles, California, United States",
    "Chicago, Illinois, United States",
    "Houston, Texas, United States",
    "Miami, Florida, United States",
    "Dallas, Texas, United States",
]
KEYWORD = "car wrap shop"
PER_CITY = 6

def fetch(city: str) -> list[dict]:
    payload = [{
        "keyword": KEYWORD,
        "location_name": city,
        "language_name": "English",
        "depth": 20,
    }]
    resp = requests.post(f"{ENDPOINT}/v3/serp/google/maps/search/live",
                         json=payload, headers={"Authorization": AUTH}, timeout=180)
    resp.raise_for_status()
    data = resp.json()
    items = []
    for t in data.get("tasks", []):
        if t.get("status_code") != 20000:
            print(f"  [warn] {city}: task {t.get('status_code')} {t.get('status_message')}", flush=True)
            continue
        for r in (t.get("result") or []):
            for it in (r.get("items") or []):
                items.append(it)
    return items

def normalize(it: dict) -> dict | None:
    if it.get("type") != "maps_search":
        return None
    name = it.get("title") or ""
    if not name:
        return None
    rating = (it.get("rating") or {})
    return {
        "name": name,
        "address": it.get("address") or it.get("description") or "",
        "phone": it.get("phone") or "",
        "rating": rating.get("value"),
        "reviews": rating.get("votes_count"),
        "maps_url": it.get("url") or it.get("cid") and f"https://www.google.com/maps?cid={it.get('cid')}",
    }

def main():
    cache = {}
    if RAW.exists():
        try: cache = json.loads(RAW.read_text(encoding="utf-8"))
        except Exception: cache = {}
    result = {}
    for city in CITIES:
        short = city.split(",")[0]
        if short in cache and cache[short]:
            print(f"  cached {short}", flush=True)
            shops = [normalize(it) for it in cache[short]]
        else:
            print(f"  fetching {short} ...", flush=True)
            try:
                raw_items = fetch(city)
            except Exception as e:
                print(f"  [err] {short}: {e}", flush=True)
                continue
            cache[short] = raw_items
            cache["_fetched_at"] = time.time()
            tmp = RAW.with_suffix(".tmp")
            tmp.write_text(json.dumps(cache, indent=2), encoding="utf-8")
            os.replace(tmp, RAW)
            shops = [normalize(it) for it in raw_items]
            time.sleep(1)
        shops = [s for s in shops if s][:PER_CITY]
        if shops:
            result[short] = shops
            print(f"  {short}: {len(shops)} shops | top: {shops[0]['name'][:40]}", flush=True)
    print("\n=== YAML ===", flush=True)
    print("  shops:", flush=True)
    for city, shops in result.items():
        state = {"New York":"NY","Los Angeles":"CA","Chicago":"IL","Houston":"TX","Miami":"FL","Dallas":"TX"}.get(city, "")
        print(f'    - city: "{city}, {state}"', flush=True)
        print(f"      items:", flush=True)
        for s in shops:
            print(f'      - name: "{(s["name"] or "").replace(chr(34),"")}"', flush=True)
            print(f'        address: "{(s["address"] or "").replace(chr(34),"")}"', flush=True)
            ph = (s.get("phone") or "").replace('"','')
            print(f'        phone: "{ph}"', flush=True)
            print(f'        rating: {s["rating"]}', flush=True)
            print(f'        reviews: {s["reviews"]}', flush=True)
            print(f'        maps_url: "{s["maps_url"] or ""}"', flush=True)

if __name__ == "__main__":
    main()
