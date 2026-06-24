# Pipeline SEO de FrenzyCars (investigación de keywords)

Documentación del pipeline de investigación real (fases 1–6) tal como está
implementado en `scripts/seo/`. Para el flujo de **creación** de cada página ver
`sop-creacion-contenido.md`. Para la auditoría técnica del sitio ver `auditoria.md`.

Principio rector: **datos en vivo, nada fabricado.** Volumen/CPC/KD provienen de
DataForSEO Labs + Google Ads; el análisis SERP es real. Ausencia de dato se
guarda como `None`/vacío, **nunca** como 0.

---

## 1. Mapa de ficheros y artefactos

| Artefacto | Ruta | Quién lo produce | Contenido |
|---|---|---|---|
| Seeds | `research/keywords/seeds.yaml` | Manual (SEO) | Keywords semilla + competidores + majors a excluir + filtros |
| Pool | `research/keywords/pool.json` | `keyword_pipeline.py` | Expansión + volume/cpc/intent (cache) |
| SERP cache | `research/keywords/serp.json` | `keyword_pipeline.py` / `serp_brief.py` | Top10, dominios, títulos, page-types, PAA, related, intent, weak_score |
| Output | `research/keywords/output.{csv,json}` | `keyword_pipeline.py` | Tabla final por keyword |
| Plan editorial | `research/keywords/editorial_plan.csv` | `editorial_plan.py` | 95 clusters rankeados |
| Plan Fase 1 | `research/keywords/editorial_plan_fase1.csv` | `editorial_plan.py` | 18 ganadores + orden de pub |
| Briefs | `research/briefs/<slug>.md` | `serp_brief.py` | Brief de contenido por keyword |
| Productos | `data/evergreen/products.yaml` | `product_pipeline.py` | Enriquecimiento Amazon (ASIN, precio, rating) |
| Raw productos | `research/products/raw.json` | `product_pipeline.py` | Respuesta cruda cacheada |

---

## 2. Fases del pipeline (`keyword_pipeline.py`)

**Fase 1 — Seeds (manual).** `seeds.yaml` define 8 verticales, cada keyword con
`intent`, `ctype` (pillar/cluster/evergreen-support), `priority` cualitativa y
`expand` (qué expansiones correr). Define además `competitors` (beatables:
hotcars, topspeed, carscoops, theautopian, slashgear) y `majors_to_exclude`
(edmunds, kbb, motortrend, caranddriver) + `filters` (umbrales).

**Fase 2+3 — Expansión + métricas.** Por cada seed: una llamada a
`keyword_suggestions` (autocomplete de Google con volume/cpc/intent) y una a
`related_keywords` (expansión semántica). Pre-filtra por `volume >= vol_min`
dentro de la API para reducir coste. Backfill de volumen de seeds con
`google_ads/search_volume`. Resultado → `pool.json` (cache atómico, reanudable).

**Fase 3b — Keyword Difficulty.** `bulk_keyword_difficulty` en lotes. KD faltante
→ `None` (no se inventa como 0).

**Fase 4 — SERP + PAA + weak-spot.** Sobre el top-N por volumen (`--serp-cap`):
una llamada `serp/google/organic/live/advanced` por keyword (depth 10). Extrae:
urls/dominios/títulos top10, `people_also_ask`, `related_searches`, presencia de
`ai_overview`. Clasifica cada dominio (`_classify_domain`) en
`forum_ugc | shopping | aggregator | oem_dealer | other`. Calcula:
- `intent_serp` (mayoría de page-types)
- `forum_hits` (debilidad: foros en página 1 ⇒ rankable)
- `title_match_ratio` (cuántos títulos contienen términos core)
- `major_in_top3/top5` (dominancia de majors)
- `weak_score` (estilo LowFruits/KeywordChef, 0–100, higher = más fácil)

**Fase 5 — Filtros.** `volume_floor` (200 general; 0 para Maintenance long-tail).
Exclusión de SERPs *major-dominant* (`major_dominant_min >= 3`) salvo categoría
Reviews.

**Fase 6 — Clustering.** Union-find por solape SERP (`cluster_serp_overlap 0.40`):
keywords cuyo top10 comparte ≥40% de URLs → mismo cluster `CL-NNN`. El cluster con
más volumen agregado por categoría = `pillar`. Parent-topic proxy = keyword de más
volumen del cluster (`primary_keyword`).

**Prioridad.** Score KD+volumen driven (dominio de autoridad cero): KD≤10 (+2),
KD≤20 (+1); vol≥1000 (+2), vol≥300 (+1); ≥2 competidores beatables (+2);
lowfruit (+2). → `high/medium/low`.

Output → `output.csv` + `output.json`.

**Modos de ejecución:**
```
python scripts/seo/keyword_pipeline.py --dry            # solo seeds, sin gasto
python scripts/seo/keyword_pipeline.py --resume          # reutiliza pool.json + serp.json
python scripts/seo/keyword_pipeline.py --force           # re-ejecuta TODO (re-gasto)
python scripts/seo/keyword_pipeline.py --serp-cap 120    # tope de SERP (control de coste)
```

Credenciales: `DFS_LOGIN`, `DFS_PASSWORD`, `DFS_ENDPOINT` en `.env`.

---

## 3. Plan editorial (`editorial_plan.py`)

Lee `output.json`, agrega por cluster y puntúa cada cluster con criterios
objetivos: min-KD (≤5 +3, ≤10 +2, ≤20 +1), avg weak (≥85 +3, ≥70 +2), volumen
agregado (≥5000 +3, ≥1500 +2), lowfruit (+1), AI Overview/GEO (+1). Ordena por
score y volumen. Selecciona **18 ganadores** con **cap de 4 por categoría**
(spread temático). Escribe `editorial_plan.csv` (todos) y
`editorial_plan_fase1.csv` (ganadores + `pub_order`).

---

## 4. Enriquecimiento de productos (`product_pipeline.py`)

Para filas `page_type: gift-guide|buying-guide` con `products[].keyword`, llama a
`merchant/amazon/products/live/advanced`, selecciona el mejor resultado orgánico
(`_score`: orgánico > precio > rating > reviews > Amazon's Choice/Best Seller >
rank) y escribe `data/evergreen/products.yaml` (ASIN, título, imagen, precio,
rating, badges). El content adapter (`_content.gotmpl`) fusiona estos datos en
las tarjetas de producto. Cache `raw.json` (TTL 20h), dry-run por defecto.

```
python scripts/seo/product_pipeline.py            # offline desde cache
python scripts/seo/product_pipeline.py --live     # llama DataForSEO (pagado)
```

---

## 5. QA (`check_evergreen.py`)

Tras `hugo --printPathWarnings`: cuenta páginas, verifica 1×H1, ≥3 H2, y que cada
página emita FAQPage + (HowTo|ItemList) JSON-LD. Opcionalmente valida que
`products.yaml` tenga asin/image/price.

---

## 6. Mantenimiento y mejoras del pipeline

- **Re-ejecutar barato:** `--resume` reutiliza `pool.json` + `serp.json`. Solo
  `--force` re-gasta.
- **Añadir verticales:** añadir grupo en `seeds.yaml`; el resto fluye solo.
- **Ajustar selectividad:** tunar `filters` (umbrales) o los `KD_EASY/WEAK_HI/...`
  en `editorial_plan.py`.
- **Nuevas heurísticas SERP:** modificar `_classify_domain`, `_weak_score`,
  `_intent_from_serp` en `keyword_pipeline.py`; el normalizador de cache
  recalcula campos derivados sin re-fetch.
- **Coste:** controlar con `--serp-cap` y `serp_depth`. SERP es la partida más
  cara; KD/volume son baratos.
