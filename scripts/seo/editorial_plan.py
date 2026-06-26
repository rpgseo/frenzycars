#!/usr/bin/env python3
"""Build the Fase-1 editorial plan from the keyword research output.

Reads data/keywords/output.json, aggregates per cluster, scores each cluster
with objective criteria (difficulty + weak-spot + volume + intent + GEO),
enforces a per-category cap for topic spread, and writes:
  - data/keywords/editorial_plan.csv  (all clusters, ranked)
  - data/keywords/editorial_plan_fase1.csv  (selected winners + pub order)

Scoring is KD/weak-spot driven (zero-authority domain). No fabricated metrics.
"""
from __future__ import annotations

import csv
import json
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "research" / "keywords"

# ---- selection config (transparent, tunable) ------------------------------- #
TARGET_FASE1 = 18        # how many clusters to green-light for Fase 1
CATEGORY_CAP = 4         # max clusters per category in the Fase-1 set
KD_EASY, KD_MED = 5, 10
WEAK_HI, WEAK_MED = 85, 70
VOL_HI, VOL_MED = 5000, 1500


def _ti(x, default=0):
    try:
        return int(float(x))
    except (TypeError, ValueError):
        return default


def main() -> None:
    rows = json.loads((OUT / "output.json").read_text(encoding="utf-8"))
    kw_rows = [r for r in rows if not r.get("is_paa")]
    by_cl: dict[str, list[dict]] = defaultdict(list)
    for r in kw_rows:
        by_cl[r.get("cluster_id", "?")].append(r)

    clusters = []
    for cl, members in by_cl.items():
        # pick primary = highest-volume member with a real volume
        primary = max(members, key=lambda r: _ti(r.get("volume")))
        vols = [_ti(r.get("volume")) for r in members]
        kds = [r["kd"] for r in members if r.get("kd") is not None]
        weaks = [r.get("weak_score") for r in members
                 if r.get("weak_score") is not None]
        intents = Counter(r.get("intent", "") for r in members)
        ai = any(r.get("ai_overview") for r in members)
        cat = Counter(r["category"] for r in members).most_common(1)[0][0]
        ctype = Counter(r.get("content_type", "") for r in members
                        ).most_common(1)[0][0]
        agg_vol = sum(vols)
        min_kd = min(kds) if kds else None
        avg_weak = sum(weaks) / len(weaks) if weaks else 0
        dom_intent = intents.most_common(1)[0][0] if intents else ""

        # ---- objective score ---- #
        score = 0
        if min_kd is not None:
            if min_kd <= KD_EASY:
                score += 3
            elif min_kd <= KD_MED:
                score += 2
            elif min_kd <= 20:
                score += 1
        if avg_weak >= WEAK_HI:
            score += 3
        elif avg_weak >= WEAK_MED:
            score += 2
        elif avg_weak >= 50:
            score += 1
        if agg_vol >= VOL_HI:
            score += 3
        elif agg_vol >= VOL_MED:
            score += 2
        elif agg_vol >= 400:
            score += 1
        if primary.get("is_lowfruit"):
            score += 1
        if ai:
            score += 1  # GEO bonus (AI Overview present)

        clusters.append({
            "cluster_id": cl,
            "primary_keyword": primary["keyword"],
            "category": cat,
            "content_type": ctype,
            "n_keywords": len(members),
            "agg_volume": agg_vol,
            "min_kd": "" if min_kd is None else min_kd,
            "avg_weak_score": round(avg_weak),
            "dominant_intent": dom_intent,
            "ai_overview": ai,
            "is_lowfruit": bool(primary.get("is_lowfruit")),
            "cluster_score": score,
        })

    # rank: score desc, then aggregate volume desc
    clusters.sort(key=lambda c: (c["cluster_score"], c["agg_volume"]), reverse=True)

    _write_csv(OUT / "editorial_plan.csv", clusters, rank=True)

    # ---- Fase-1 selection with per-category cap ---- #
    picked, per_cat = [], Counter()
    for c in clusters:
        if len(picked) >= TARGET_FASE1:
            break
        if per_cat[c["category"]] >= CATEGORY_CAP:
            continue
        c = dict(c)
        c["pub_order"] = len(picked) + 1
        picked.append(c)
        per_cat[c["category"]] += 1

    _write_csv(OUT / "editorial_plan_fase1.csv", picked,
               rank=False, pub=True)

    print(f"[done] {len(clusters)} clusters ranked -> editorial_plan.csv")
    print(f"[done] {len(picked)} Fase-1 winners  -> editorial_plan_fase1.csv")
    print("\n=== FASE 1 PUBLICATION ORDER ===")
    for c in picked:
        ai = "AI" if c["ai_overview"] else "  "
        lf = "*" if c["is_lowfruit"] else " "
        print(f"  {c['pub_order']:>2}. [{ai}{lf}] score={c['cluster_score']} "
              f"kd={c['min_kd']:>3} weak={c['avg_weak_score']:>3} "
              f"vol={c['agg_volume']:>6} {c['dominant_intent']:<13} "
              f"{c['cluster_id']} {c['primary_keyword']}")


def _write_csv(path: Path, rows: list[dict], rank: bool, pub: bool = False) -> None:
    fields = ["cluster_id", "primary_keyword", "category", "content_type",
              "n_keywords", "agg_volume", "min_kd", "avg_weak_score",
              "cluster_score", "dominant_intent", "is_lowfruit", "ai_overview"]
    if rank:
        fields = ["rank"] + fields
    if pub:
        fields = ["pub_order"] + fields
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for i, c in enumerate(rows, 1):
            row = {k: c.get(k, "") for k in fields}
            if rank:
                row["rank"] = i
            w.writerow(row)


if __name__ == "__main__":
    main()
