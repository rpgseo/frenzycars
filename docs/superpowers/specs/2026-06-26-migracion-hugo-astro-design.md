# Migración FrenzyCars: Hugo → Astro (Cloudflare Pages + D1)

**Fecha:** 2026-06-26
**Estado:** Aprobado para planificación
**Alcance:** Fase 1 — migración 1:1 (paridad funcional) del frontend Hugo a Astro, con nueva paleta oscura.

---

## 1. Objetivo y restricciones no negociables

Migrar el frontend de FrenzyCars de Hugo a Astro sin pérdida de contenido ni de URLs, conservando la arquitectura de secciones, taxonomías y navegación, y aplicando una nueva paleta oscura que mantiene el acento `#f7d720`.

Restricciones (deben cumplirse y verificarse):

1. **Cero pérdida de contenido.** Ningún artículo publicado puede perderse. Se migra todo el Markdown/front matter actual.
2. **Paridad exacta de URLs.** Toda URL que existe hoy debe resolver igual en Astro, o redirigir con 301 a su equivalente exacto. Verificado con un test automático de paridad.
3. **Acento `#f7d720`** se mantiene. El resto de la paleta es nueva (tonos oscuros, temática de revista de motor), sin inspirarse en la paleta actual.

---

## 2. Decisiones de arquitectura (confirmadas con el usuario)

- **Rol de D1:** solo runtime/dinámico. El contenido editorial vive en Astro Content Collections (Markdown). D1 se reserva para futuras features dinámicas (newsletter, formularios, etc.).
- **CMS:** ninguno en fase 1. Se editan los `.md` en el repo. Se descarta Decap/Netlify CMS (`/admin/`).
- **Alcance:** migración 1:1 (paridad funcional) + nueva paleta. Sin features nuevas.
- **Maintenance:** se mantiene la generación desde datos (YAML) en build, incluido el anti-thin gate y el enriquecimiento de productos.
- **Despliegue:** Astro `output: 'static'` en Cloudflare Pages. El adaptador `@astrojs/cloudflare` + binding D1 se añade en una fase posterior.
- **Limpieza de datos:** migrar contenido íntegro (incluidos flags como `demo`) y corregir encoding roto (mojibake `â€"`→`—`, eliminar BOM). No se altera texto editorial.
- **Verificación:** test automático de paridad de URLs incluido en el plan.

---

## 3. Inventario del proyecto Hugo actual

### Configuración / URLs
- `baseURL = https://frenzycars.com/`, idioma único `en`.
- Sin bloque `[permalinks]` → permalinks por defecto de Hugo: `/<sección>/<slug>/`.
- Paginación: 9 por página (`pagerSize = 9`).
- Despliegue actual: Cloudflare Pages (`static/_redirects`, `static/_headers`).
- Redirect 301 existente: `/buyers-guide/best-car-loans-for-students/` → `/insurance/best-car-loans-for-students/`.

### Secciones
- Menú principal (8): reviews, news, maintenance, guides, electric, insurance, culture, gear.
- Footer "company": about, mission, company-news, contact, blog.
- Footer "legal": legal-notice, cookie-policy, privacy-policy, terms-conditions.

### Naturalezas de contenido (3)
1. **Markdown cuerpo libre** — reviews, news, culture, electric, guides, blog. Front matter TOML (`+++`) salvo blog/insurance en YAML (`---`). Algunos con BOM.
2. **Markdown estructurado data-driven** — insurance. Front matter rico (`question, short_answer, causes, steps, tables, faq, buying_tips, when_to_see_mechanic`...), cuerpo casi vacío; el layout lo renderiza.
3. **Páginas generadas 100% desde YAML** — maintenance. `content/maintenance/_content.gotmpl` genera 28 páginas desde `data/evergreen/troubleshooting.yaml` (+ `products.yaml`), con anti-thin gate (≥3 diferenciadores) y merge de enriquecimiento de productos. No existen `.md` para estas páginas.

### Taxonomías
- `tags` (activa, ~70 tags) → `/tags/` y `/tags/<slug>/`.
- `categories` (página índice existe pero vacía) → `/categories/`.

### Layouts y partials
- Genéricos: `_default/baseof.html`, `list.html`, `single.html`, `thanks.html`.
- Por sección: `blog/single`, `insurance/single` (173 líneas), `maintenance/single` (366 líneas), `about/single`.
- Home: `index.html` (105 líneas).
- 17 partials: header, footer, widgets/sidebar, cover, score, verdict, spec-table, article-card, lead-card, advice/product-url, ads/head, ads/slot, script.
- Render hook de tablas: `_default/_markup/render-table.html`.
- Shortcodes: ninguno.
- CSS único: `static/css/style.css` (343 líneas).

### Otros
- Decap/Netlify CMS en `/admin/` (se descarta).
- `llms.txt`, `robots.txt`, AdSense (desactivado, `enabled=false`), Amazon Associates (sin tag aún), `sharp` para imágenes.

### URLs totales generadas (snapshot de referencia desde `public/`)
~73 páginas de contenido + índices de sección + tags + home. Esta lista completa es el snapshot de referencia para el test de paridad.

---

## 4. Estrategia de URLs (paridad exacta)

Astro replica los permalinks `/<sección>/<slug>/` mediante la estructura de `src/pages/` y los slugs de las colecciones.

| URL actual | Origen Astro |
|---|---|
| `/` | `src/pages/index.astro` |
| `/<sección>/` | listado de sección |
| `/<sección>/<slug>/` | Content Collections o datos (maintenance) |
| `/tags/`, `/tags/<tag>/` | derivadas de `tags[]` del front matter |
| `/categories/` | índice vacío replicado (no romper la URL) |
| páginas sueltas (`/about/`, legales, etc.) | `.astro` o colección `pages` |
| `/buyers-guide/best-car-loans-for-students/` | **301** conservado en `_redirects` |

- **Trailing slash:** `trailingSlash: 'always'` + `build.format: 'directory'` → produce `/<slug>/index.html`, igual que Hugo.
- **Slugify de tags:** reproducir el mismo algoritmo de Hugo para que `/tags/v8/`, `/tags/mercedes-amg/`, etc. coincidan exactamente.

---

## 5. Modelo de contenido en Astro

### Colecciones editoriales (Markdown, cuerpo libre)
Una colección por sección para mapear 1:1 la URL: `reviews`, `news`, `culture`, `electric`, `guides`, `blog`, `gear`.
- Schema base (Zod): `title, date, draft, description, cover, tags[], author, demo?`.
- `reviews` añade `rating?`. Cada sección añade sus campos opcionales propios.

### Colección `insurance` (Markdown estructurado)
- Schema Zod que refleja el front matter rico (`question, short_answer, causes[], steps[], tables[], faq[], buying_tips[], when_to_see_mechanic[], section_labels`...).
- El layout `insurance/single` se porta a un componente Astro que renderiza esa estructura.

### Maintenance (generación desde datos)
- Se conservan `troubleshooting.yaml` + `products.yaml` como fuente de datos (movidos a `src/data/`).
- Ruta `src/pages/maintenance/[id].astro` con `getStaticPaths()` que:
  1. Lee el YAML.
  2. Reaplica el anti-thin gate (≥3 diferenciadores); las páginas que no pasen NO se generan.
  3. Hace el merge de enriquecimiento de productos (`products.yaml` sobre los slots de cada fila).
  4. Renderiza según `page_type`: troubleshooting, buying-guide, comparison, cost-guide, gift-guide, ranked-list.
- Resultado esperado: las mismas 28 URLs `/maintenance/<id>/`.

### Páginas sueltas
`about, mission, company-news, contact, cookie-policy, privacy-policy, legal-notice, terms-conditions, thanks` → colección `pages` o `.astro` directos. `/categories/` replicada como índice vacío.

### Taxonomía `tags`
Derivada de los `tags[]` de todas las colecciones en build → `/tags/` y `/tags/<slug>/` con el slugify de Hugo.

### Import / limpieza (cero pérdida)
Script de import único que:
- Copia cada `.md`.
- Convierte front matter TOML `+++` → YAML `---` (Astro solo entiende YAML/JSON).
- Arregla encoding: mojibake (`â€"`→`—`, etc.) y elimina BOM.
- Conserva todos los flags (`demo`, etc.) intactos.
- No altera el texto editorial.

---

## 6. Layouts/partials → componentes Astro

| Hugo | Astro | Trato |
|---|---|---|
| `_default/baseof.html` | `src/layouts/Base.astro` | 1:1 |
| `index.html` | `src/pages/index.astro` | 1:1 |
| `_default/list.html` | `src/layouts/List.astro` | 1:1 (listados + paginación 9/pág) |
| `_default/single.html` | `src/layouts/Single.astro` | 1:1 |
| `blog/insurance/maintenance/about single` | layouts/componentes por tipo | adaptación |
| `_default/thanks.html` | `src/pages/thanks.astro` | 1:1 |
| `_markup/render-table.html` | estilado global de `<table>` en CSS | adaptar |
| 17 partials | `src/components/*.astro` | 1:1 |
| `partials/ads/*` | componentes Ads (desactivados) | 1:1, flag `enabled=false` |
| `script.html`, `robots.txt`, `llms.txt` | `public/` o componente | 1:1 |
| shortcodes | — | ninguno |
| Decap `/admin/` | — | descartado |

**Config global:** `[params]` y `[menu]` de `hugo.toml` → `src/config/site.ts` tipado (menú principal, footer en 3 grupos, social, description, tagline, accent). Una sola fuente.

---

## 7. Paleta

- Acento **`#f7d720`** se mantiene como variable heredada (CTAs, enlaces, destacados).
- Resto: tema oscuro de revista de motor. Tokens CSS en `:root` (fondos, superficies, texto, bordes), dark-first, jerarquía por luminosidad de superficies. Reescritura del `style.css` actual sobre esta base. El detalle cromático exacto se afina en implementación.

---

## 8. Testing / verificación

1. **Paridad de URLs:** extraer la lista de URLs del `public/` de Hugo (snapshot de referencia) y un test que falla si el build de Astro (`dist/`) no produce exactamente ese conjunto, o un 301 equivalente registrado.
2. **Validación de schemas Zod** en build (front matter íntegro de todas las colecciones).
3. **Anti-thin gate de maintenance** produce las 28 páginas esperadas.
4. **Revisión visual** sección por sección con la nueva paleta.

---

## 9. Fuera de alcance (fase 1)

- Conexión real a D1 y adaptador Cloudflare (fase posterior).
- CMS / panel de edición.
- Features dinámicas nuevas (newsletter, comentarios, búsqueda).
- Rediseño de layouts más allá del cambio de paleta.
- Activación de ads / Amazon Associates.
