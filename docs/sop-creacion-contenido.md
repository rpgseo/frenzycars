# SOP — Creación de contenido (keyword → página publicada)

Procedimiento **obligatorio** cada vez que se crea o actualiza una página
orientada a SEO. Garantiza que cada artículo esté alineado con la intención real
del SERP (no con suposiciones) y cumpla el Definition of Done.

Herramienta ejecutable: `scripts/seo/serp_brief.py` (genera el brief automáticamente).
Pipeline de investigación: ver `pipeline-seo.md`.

---

## 0. Cuándo aplicar este SOP

- Crear una página nueva para un cluster del plan editorial.
- Refrescar/actualizar una página existente (content decay).
- Cualquier página que deba ranquear.

No aplica a: noticias de marca puntuales, páginas corporativas (about).

---

## 1. Generar el brief (SERP top-5 → decisión)

```
python scripts/seo/serp_brief.py "<keyword>"          # cache, fetchea live lo que falte
python scripts/seo/serp_brief.py --from-plan 5        # top-5 GAPs no publicados
python scripts/seo/serp_brief.py --no-live "<kw>"     # solo cache (sin gasto)
```

El brief (en `research/briefs/<slug>.md`) decide a partir del **SERP real**:

- **Intent** (SERP-derived) y **formato** recomendado (`page_type`).
- **Top-5 actual**: dominios, page-types, títulos (a quién vas a desplazar).
- **Debilidad del SERP**: foros (rankable), majors en top-3 (necesita depth),
  AI Overview (escribir respuesta directa para GEO).
- **PAA** a cubrir + **related searches** (ángulos de contenido).
- `<title>`, H1, meta description, schema JSON-LD recomendado, outline H2.

### Reglas de decisión de formato (el núcleo del SOP)

El SERP manda, desambiguado por la frase del keyword:

| Señal | `page_type` | Schema | Plantilla Hugo |
|---|---|---|---|
| `best…` + agregadores/shopping ≥40% | `buying-guide` | ItemList + Product + FAQ | evergreen adapter (`maintenance/single.html`) |
| "why is my…", "how to fix/bleed…", síntomas (noise/shaking/leak…) | `troubleshooting` | HowTo + FAQPage | evergreen adapter |
| "how long…", "how much does…", "what is…", hechos/costos | `explainer` | Article + FAQPage | artículo leaf-bundle + FAQ |
| spec/OEM dominante | `review` | Review + Product | `single.html` |
| agregadores ≥50%, comparativa | `pillar` | Article | leaf-bundle |

> No adivines el formato por la palabra "best" sola: si el top-5 son foros y
> explainer, construye un explainer aunque la keyword suene comercial.

---

## 2. Elegir dónde vive el contenido

- **`buying-guide` / `troubleshooting`** → fila en `data/evergreen/troubleshooting.yaml`
  (generada por `content/maintenance/_content.gotmpl`, render con HowTo/ItemList).
  Portada en `static/images/advice/<id>-hero.jpg`.
- **`explainer` / `pillar` / `review`** → **leaf bundle** `content/<section>/<slug>/index.md`
  vía Sveltia (convención: portada colocada `cover.*`). FAQ schema en el bloque `head`.
- Sección = vertical canónico (reviews, news, guides, electric, insurance, culture, gear).

---

## 3. Escribir el contenido (reglas on-page)

- **`<title>` y H1** del brief; keyword primaria en título, H1, primeros 100
  palabras y slug.
- **TL;DR / `short_answer`** de 2–3 frases al inicio (sirve para AI Overview/GEO).
- Cubrir el **outline** + las **PAA** como secciones o FAQ.
- **Profundidad > longitud**: si hay major en top-3, superar su depth, no su
  conteo de palabras. Mínimo 900 palabras.
- **Datos con fuente**: números de coste/longevidad/datoss reales, sin inventar.
- **Enlazado interno** al topic hub y a clusters hermanos.

---

## 4. Schema JSON-LD (según `page_type`)

- `troubleshooting` → FAQPage + HowTo (steps, estimatedCost).
- `buying-guide` → ItemList + Product por pick (usa `product_pipeline.py`) + FAQPage.
- `explainer` → Article + FAQPage.
- `review` → Review (rating) + Product.
El adapter / `single.html` ya emiten Article/Review; FAQ/HowTo/ItemList se añaden
según plantilla.

---

## 5. Verificación (Definition of Done)

1. `hugo --printPathWarnings --gc --minify` → limpio, 0 warnings de ruta.
2. `python scripts/seo/check_evergreen.py` → verde (H1/H2/schema) para evergreen.
3. Si `buying-guide`: `python scripts/seo/product_pipeline.py --live` para
   enriquecer picks reales (asin/precio/rating).
4. Inspeccionar el HTML publicado: 1×H1, schema válido, portada, internal links.
5. Brief archivado en `research/briefs/` (trazabilidad de la decisión).

---

## 6. Actualizaciones (content decay)

1. Re-generar el brief (`serp_brief.py`, `--no-live` primero; live si el SERP
   cambió y la cache tiene >30 días).
2. Comparar nuevas PAA/related vs la página; añadir secciones que falten.
3. Refrescar datos (precios, cifras de modelo/año), actualizar `lastmod`.
4. Re-validar DoD.

---

## 7. Trazabilidad

Cada página publicada debe poder trazarse a: `seeds.yaml` → `output.json`
(cluster, métricas) → `editorial_plan.csv` (rank) → `research/briefs/<slug>.md`
(decisión) → contenido. Si una página no tiene brief, no cumple el SOP.
