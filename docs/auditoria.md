# Auditoría completa — FrenzyCars (Hugo + Sveltia CMS)

Aplicación de las bases de conocimiento (`docs/kb-*.md`) al estado real del proyecto.
Fecha: 2026-06-24 · Hugo v0.163.3 · Despliegue: Cloudflare Pages (`frenzycars.pages.dev`)

---

## 0. Resumen ejecutivo

| Área | Estado | Severidad |
|---|---|---|
| Estructura de content (branch bundles `_index.md`) | ✅ Correcto | — |
| Artículos como `.md` planos (sin leaf bundles) | ⚠️ Funciona, pero no aprovecha Hugo | Media |
| **Portadas hotlinkeadas desde Unsplash** | 🔴 Crítico (SEO/Core Web Vitals/riesgo 404) | **Alta** |
| Sin pipeline de imágenes (`srcset`/WebP) | 🔴 Crítico para LCP/CLS | **Alta** |
| Duplicación CSS `assets/` vs `static/` | ⚠️ Ambiguo | Media |
| `?v=2` cache-busting manual en CSS | ⚠️ Ineficaz con pipeline | Baja |
| `preconnect` a `images.unsplash.com` | ⚠️ Dependencia externa | Media |
| SEO on-page (canonical, robots, JSON-LD) | ✅ Bueno | — |
| JSON-LD `image` apunta a URL cruda | ⚠️ Mejorable | Baja |
| `mainSections` duplica `menu.main` | ⚠️ Mantenimiento | Baja |
| Sveltia CMS: media global vs colocada | ⚠️ Coherente hoy, limita leaf bundles | Media |
| `twitter:card` siempre `summary_large_image` | ⚠️ Lógica muerta | Baja |
| `buildFuture = true` en producción | 🔴 Pendiente de lanzamiento | **Alta** |

---

## 1. Gestión de contenido (page bundles)

**Estado:** Usas **branch bundles** correctamente (cada sección con `_index.md`).
**Problema:** Los artículos son `.md` sueltos (`content/reviews/bmw-m5-touring.md`), **no leaf bundles**. La portada vive en una URL externa, no como page resource.

**Por qué importa** (ver `kb-hugo-content.md` §leaf-bundles): sin leaf bundles no puedes aplicar el **pipeline de imágenes de Hugo** a las portadas (resize, WebP, `srcset` responsivo, cacheado). Hoy entregas un único JPEG de Unsplash a 1600px a todos los dispositivos.

**Decisión de diseño requerida.** Hay dos caminos:

- **(A) Mantener `.md` planos** (más simple, recomendado si sigues con Unsplash o un CDN propio). Las plantillas resuelven la portada como string URL. Compatible 1:1 con Sveltia CMS tal cual.
- **(B) Migrar a leaf bundles** (`content/reviews/bmw-m5-touring/index.md` + `cover.jpg`). Permite pipeline local. **Requiere cambiar Sveltia** a colección con `path: "{{slug}}/index"` y `media_folder: ""` / `public_folder: ""` (colocación). Ver `kb-sveltia-cms.md`: Sveltia **sí** soporta imágenes colocadas por colección.

> Recomendación: **(A)** a corto plazo (lanzar rápido) + descargar las portadas de Unsplash a `static/images/` y servirlas locales. Reservar **(B)** para cuando quieras `srcset`/WebP automático, asumiendo el retoque de Sveltia.

---

## 2. Imágenes y pipeline (problema central) 🔴

Hallazgos en plantillas:

- `layouts/_default/single.html:30` → `<img src="{{ .Params.cover }}">` (sin `loading`, sin `srcset`, sin dimensiones).
- `layouts/partials/article-card.html:5` → `width="600" height="400"` pero `src` es la URL Unsplash original (1600px).
- `layouts/partials/lead-card.html:3` → `width="1200" height="800"`, mismo problema de `src`.
- `layouts/index.html:21` (lead secundario) → inline, sin dimensiones reales de la imagen servida.
- `baseof.html:21` → `<link rel="preconnect" href="https://images.unsplash.com">` acopla el rendimiento a un tercero.

**Impacto:**
- **LCP** sufre (descargas 1600px en móvil).
- **Pérdida de control** si Unsplash cambia/elimina la foto → 404 en producción.
- Sin WebP ni `srcset`, pierdes Core Web Vitals (mercado objetivo: SEO).

**Solución mínima (camino A — sin leaf bundles):**
1. Descargar cada portada a `static/images/<section>/<slug>.jpg` (ya tienes `download_images.js` en raíz).
2. Front matter: `cover = '/images/reviews/bmw-m5-touring.jpg'`.
3. Crear `layouts/partials/cover.html` que genere `<picture>` con variantes WebP vía `resources.Get` + `.Process` (snippet en `kb-hugo-content.md` apéndice y `kb-hugo-config-assets.md` §matriz).

**Solución avanzada (camino B — leaf bundles):** la portada pasa a ser **page resource**, accesible con `.Resources.GetMatch "cover.*"`, y `.Process` genera variantes relativas a la página.

---

## 3. Pipeline de assets (CSS/JS)

Hallazgo:
- Existen **dos** `style.css`: `assets/css/style.css` **y** `static/css/style.css`.
- `baseof.html:22-24` intenta `resources.Get "css/style.css"` y, si falla, carga `/css/style.css?v=2`.

**Problema:** el `?v=2` manual rompe el cache-busting real y mantiene ambigüedad sobre qué CSS manda. Además no hay minificación ni fingerprint.

**Fix (ver `kb-hugo-config-assets.md` §Hugo Pipes):**
```go
{{ $css := resources.Get "css/style.css" | minify | fingerprint }}
<link rel="stylesheet" href="{{ $css.RelPermalink }}" integrity="{{ $css.Data.Integrity }}">
```
- Eliminar la copia de `static/css/` para evitar doble fuente.
- El `?v=` deja de ser necesario (el hash del fingerprint invalida caché solo cuando cambia).

---

## 4. SEO / on-page

**Lo bueno:** `baseof.html` tiene canonical, robots condicional (`params.noindex`), OG, Twitter, y JSON-LD Article/Review + Rating en `single.html`. `maintenance/single.html` añade FAQPage + HowTo. Muy sólido.

**Mejoras:**
- `single.html:19` — el JSON-LD `image` usa `($img | absURL)` con la URL cruda. Google prefiere dimensiones explícitas (`width`/`height`); si migras a recursos, puedes añadirlas.
- `baseof.html:17` — `twitter:card` siempre `summary_large_image` (la rama condicional es idéntica en ambas ramas → lógica muerta). Simplifica.
- `og:image`/`twitter:image` dependen de la portada remota (mismo problema del §2).

---

## 5. Configuración (`hugo.toml`)

- `buildFuture = true` (línea 7) con comentario "DEV-ONLY". **Recordatorio de lanzamiento:** al pasar `params.noindex = false`, hay que quitar/poner a false `buildFuture` para que el escalonado de `publish_date` funcione. Confirmar antes de ir a producción.
- `mainSections` (línea 19) repite exactamente los `url` de `[[menu.main]]`. Podrías derivar uno del otro para evitar desincronía, pero no es bloqueante.
- Sin `[markup]` explícito: revisar si necesitas tabla de contenidos, `hrefTargetBlank`, o `goldmark` parser extensions. Hoy usa defaults.

---

## 6. Plantillas (lookup & métodos)

**Lo bueno:** uso correcto de `define "main"`, partials con contexto, `.Site.RegularPages`, `where`, `complement`, `first`, `after`.

**Observaciones:**
- `list.html:13` usa `.Pages` (incluye drafts según config). Confirma que los `_index.md` de sección no se listan como artículos (no deberían; son kind `section`).
- `single.html:26` (related) filtra por `Type` y excluye la propia página con `first 4`. Correcto, pero podrías usar `.Related` (related content, ver `kb-hugo-templates.md`) para afinar por tags.
- `index.html:4` selecciona featured; si ninguno tiene `featured`, toma el primero. Bien documentado implícitamente.

---

## 7. Sveltia CMS

**Estado:** config limpia y coherente (Decap-compatible). 8 colecciones folder-based, `maintenance` correctamente excluida (generada por `_content.gotmpl` desde `data/evergreen/`).

**Observaciones:**
- `media_folder: "static/images/uploads"` + `public_folder: "/images/uploads"` → modelo **global**. Coherente con mantener `.md` planos (camino A).
- **Incoherencia ACTUAL (resuelta):** las imágenes `static/images/advice/*.jpg` (27 ficheros) **sí tienen dueño**: son las portadas de las páginas evergreen referenciadas en `data/evergreen/troubleshooting.yaml` (`cover:`) y renderizadas por `maintenance/single.html`. 27 imágenes = 27 referencias, sin desajustes.
- Si migras a leaf bundles (camino B), Sveltia requiere por colección:
  ```yaml
  folder: "content/reviews"
  path: "{{slug}}/index"
  media_folder: ""        # colocada en el bundle
  public_folder: ""       # relativa a la página
  ```
  Ver `kb-sveltia-cms.md` §media-colocada.
- **No soportado por Sveltia** (no rompe nada hoy, pero a tener en cuenta): `local_backend` (ignorado; el modo local es el "Work with Local Repository"), Git Gateway, editorial workflow, PKCE para GitHub. Hoy usas PAT → correcto.

---

## 8. Content adapter (maintenance / evergreen)

`content/maintenance/_content.gotmpl` es sólido: anti-thin gate (descarta filas con <3 diferenciadores vía `warnf`), enriquece productos desde `products.yaml`, genera páginas virtuales con JSON-LD dedicado. No requiere cambios.

Verifica que las portadas (`cover` en `troubleshooting.yaml`) también sean locales (mismo problema del §2).

---

## 9. Plan de acción priorizado

1. **[Crítico] Localizar portadas.** Decidir camino A vs B. Descargar Unsplash → `static/images/<section>/` y actualizar `cover` en front matter (y en `data/evergreen/`).
2. **[Crítico] Pipeline de imágenes.** Implementar `partials/cover.html` con `<picture>`+WebP+`srcset` (snippet en KB) y reemplazar los `<img>` en `single.html`, `article-card.html`, `lead-card.html`, `index.html`.
3. **[Alto] Pipeline CSS.** `minify|fingerprint` en `baseof.html`, eliminar `static/css/style.css`.
4. **[Alto] Lanzamiento:** `params.noindex=false` + `buildFuture=false`.
5. **[Medio] Aclarar `static/images/advice/`:** crear los artículos o mover las imágenes.
6. **[Medio] Limpiar:** `twitter:card` muerto, `preconnect` Unsplash.
7. **[Bajo] Derivar `mainSections` del menú** y revisar `[markup]`.

---

## 10. Preguntas abiertas para ti

1. **Camino de imágenes: A (`.md` planos + imágenes en `static/`) o B (leaf bundles + colocación)?** → **DECIDIDO: B (implementado, ver §11)**
2. Las 28 imágenes de `static/images/advice/` — ¿artículos por crear, o ya descartados? → **RESUELTO: NO huérfanas.** Son las 27 portadas (`<slug>-hero.jpg`) referenciadas por `data/evergreen/troubleshooting.yaml` y consumidas por las páginas maintenance generadas (verificado: 27 imágenes = 27 referencias, coincidencia 1:1, todas renderizadas en `article-hero`).
3. ¿Las portadas de Unsplash se descargan y reemplazan, o se mantienen hotlinkeadas de forma permanente? → Temporales; se reemplazarán/scrapearán después.

---

## 11. Implementación Opción B (leaf bundles) — REALIZADA

Estado: **completado y verificado** (`hugo --gc --minify` → 169 páginas, 0 errores).

### Cambios aplicados

- **Nuevo partial `layouts/partials/cover.html`**: detecta automáticamente si la portada es:
  - un **page resource** llamado `cover.*` (leaf bundle colocado) → pipeline Hugo: WebP `<source>` 1x/2x + JPEG `<img>` con dimensiones reales, o
  - una **URL remota** en `.Params.cover` (Unsplash temporal) → `<img>` simple.
  - Transición sin fricción: cuando se descargue `cover.jpg` al bundle, el pipeline se activa solo.
- **Plantillas migradas al partial**: `_default/single.html` (hero 1600px eager), `partials/article-card.html` (600 lazy), `partials/lead-card.html` (1200 eager), `index.html` (lead-sec 600 lazy).
- **OG/Twitter + JSON-LD** (`baseof.html`, `single.html`): resuelven la imagen desde page resource procesado > URL front matter > logo. Arreglado además el `twitter:card` con lógica muerta.
- **19 artículos migrados** a leaf bundles: `content/<section>/<slug>.md` → `content/<section>/<slug>/index.md` (culture, electric, guides, news, reviews). URLs inalteradas.
- **Sveltia `config.yml`**: las 7 colecciones editables ahora crean entradas como `path: "{{slug}}/index"` con `media_folder: ""` / `public_folder: ""` (imágenes colocadas). `maintenance` sigue excluida (generada por data adapter).

### Convención de portada (importante)

- Nombre obligatorio del fichero de portada colocado: **`cover.<ext>`** (p. ej. `cover.jpg`).
- El partial lo localiza con `.Resources.GetMatch "cover.*"`. Si se nombra distinto, no se detectará como recurso y caerá al fallback de URL.
- Mientras la portada sea remota, deja `cover = 'https://...'` en el front matter (funciona vía fallback).

### Verificación

```
hugo --gc --minify --baseURL "https://frenzycars.pages.dev/"
→ Pages 169 | Processed images 0 (sin portadas locales aún) | 0 errores
public/reviews/bmw-m5-touring/index.html  → hero <img class=hero-img src=Unsplash loading=eager> ✔
```

### Pendientes (no bloqueantes, fuera del alcance B)

- Descargar/scrapear portadas reales y colocarlas como `cover.jpg` en cada bundle (activa WebP/srcset).
- Pipeline CSS (`minify|fingerprint`) y eliminar `static/css/style.css` duplicado (ítem 3 del §9).
- Lanzamiento: `params.noindex=false` + `buildFuture=false`.

