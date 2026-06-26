# Base de Conocimiento — Hugo: Gestión de Contenido

> Referencia técnica densa sintetizada de la documentación oficial de Hugo (v0.163.3).
> Prosa explicativa en español; código, sintaxis y palabras clave en inglés.
> Documentada para **FrenzyCars**: sitio Hugo de noticias y reseñas de coches,
> artículos en `.md` planos con `cover` = URL remota de Unsplash en front matter TOML,
> secciones con `_index.md` (branch bundles), gestionado por Sveltia CMS,
> CSS plano en `static/css/style.css` (sin Tailwind).

---

## Tabla de Contenidos

1. [Contexto y refactor de FrenzyCars](#1-contexto-y-refactor-de-frenzycars)
2. [Organización del contenido](#2-organización-del-contenido)
3. [Page bundles (leaf vs branch)](#3-page-bundles-leaf-vs-branch)
4. [Page resources (.Resources.Get / .GetMatch)](#4-page-resources-resourcesget--resourcesgetmatch)
5. [Procesamiento de imágenes (pipeline)](#5-procesamiento-de-imágenes-pipeline)
6. [Front matter y mapeo a Page params](#6-front-matter-y-mapeo-a-page-params)
7. [Shortcodes](#7-shortcodes)
8. [Sections](#8-sections)
9. [Taxonomies](#9-taxonomies)
10. [Menus](#10-menus)
11. [Summaries](#11-summaries)
12. [Build options](#12-build-options)
13. [Archetypes](#13-archetypes)
14. [Multilingual](#14-multilingual)
15. [URL management](#15-url-management)
16. [Apéndice: snippet maestro de cover image](#16-apéndice-snippet-maestro-de-cover-image)

---

## 1. Contexto y refactor de FrenzyCars

Estado actual del proyecto:

```text
content/
├── _index.md                    # branch bundle (home)
└── reviews/
    ├── _index.md                # branch bundle (sección)
    ├── post-1.md                # .md plano, NO bundle
    └── post-2.md
```

Front matter actual (TOML):

```toml
+++
title = 'Toyota GR Corolla 2024'
date = 2024-05-12T10:00:00+02:00
draft = false
cover = 'https://images.unsplash.com/photo-XXXX?w=1200'
tags = ['reviews', 'hot-hatch']
+++
```

**Objetivo del refactor:** migrar de `.md` planos con `cover` remoto a **leaf bundles**
con imágenes locales (page resources), para habilitar el pipeline de procesamiento
de imágenes de Hugo (WebP, `srcset`, `.Resize`/`.Fit`/`.Fill`), reduciendo peso y
eliminando dependencia de URLs externas.

Estructura objetivo:

```text
content/
├── _index.md
└── reviews/
    ├── _index.md
    ├── toyota-gr-corolla-2024/
    │   ├── index.md             # leaf bundle
    │   └── cover.jpg            # page resource
    └── bmw-m5-cs-2023/
        ├── index.md
        └── cover.jpg
```

---

## 2. Organización del contenido

**Resumen:** Hugo refleja la estructura del directorio `content/` en la estructura de
URLs del sitio renderizado. El árbol de contenido determina secciones, slugs y paths.

### Conceptos clave

- La organización del **contenido fuente** define la **estructura renderizada**.
- Los directorios de primer nivel (`content/<DIRECTORIO>`) son especiales: definen
  el **content type / section**, que a su vez determina la selección de plantillas.
- Se admite anidamiento a cualquier profundidad.
- `_index.md` añade front matter y contenido a las páginas `home`, `section`,
  `taxonomy` y `term`. Se accede vía `GetPage` sobre un objeto `Site` o `Page`.

### Mapeo path → URL (pretty URLs, comportamiento por defecto)

```text
content/posts/my-first-hugo-post.md
  section = "posts"
  slug    = "my-first-hugo-post"
  url     = /posts/my-first-hugo-post/
  → https://example.org/posts/my-first-hugo-post/index.html
```

### Términos

| Término | Significado | ¿Sobreible en front matter? |
|---------|-------------|------------------------------|
| `section` | Directorio de primer nivel; determina el content type | **No** (solo se infiere de la ubicación) |
| `slug` | Último segmento de la URL; por defecto el nombre del archivo | Sí (`slug`) |
| `path` | Ruta al archivo sin incluir el slug | No |
| `url` | Path completo de la URL | Sí (`url`) |

### Gotchas

- La **home page bundle** (`content/_index.md`) puede contener recursos (imágenes)
  pero **no otras páginas de contenido**.
- `_index.md` solo existe en branch bundles; un archivo suelto `foo.md` es una
  página regular sin página de listado propia (a menos que su directorio sea de
  primer nivel = sección).

> **Cuándo usarlo en FrenzyCars:** las secciones `reviews/`, `news/`, `guides/`
> son de primer nivel y definen content types. Mantén los artículos como leaf
> bundles dentro de cada sección para que hereden layout de `reviews/page.html`.

---

## 3. Page bundles (leaf vs branch)

**Resumen:** Un *page bundle* es un directorio que encapsula contenido y recursos
asociados. Existen dos tipos: **leaf** (`index.md`) y **branch** (`_index.md`).

### Comparación — CLAVE del refactor

| Característica | Leaf bundle | Branch bundle |
|----------------|-------------|---------------|
| Archivo índice | `index.md` | `_index.md` |
| Page kind | `page` | `home`, `section`, `taxonomy`, `term` |
| Plantilla | single.html | home/section/taxonomy/term.html |
| Descendientes | **Ninguno** | Cero o más (otros bundles) |
| Ubicación de recursos | Adyacentes al índice o en subdirectorios | Igual, pero excluye los bundles descendientes |
| Tipos de recurso permitidos | `page`, `image`, `video`, etc. | Todos **excepto** `page` |

### Leaf bundle (el destino del refactor)

```text
content/reviews/
└── my-post/
    ├── content-1.md            # recurso tipo "page" (no se renderiza como página)
    ├── cover.jpg               # recurso tipo "image"
    ├── gallery.jpg
    └── index.md                # raíz del bundle → página renderizada
```

- Los `.md` que **no** sean `index.md` dentro de un leaf bundle son **recursos
  tipo `page`**, accesibles vía `.Resources` pero **no renderizados** como páginas.
- Un leaf bundle **no puede contener otro bundle**. Es terminal.

### Branch bundle

```text
content/
├── reviews/
│   ├── _index.md               # branch bundle (sección reviews)
│   ├── a-leaf-bundle/
│   │   └── index.md            # leaf dentro del branch
│   └── standalone.md           # página regular dentro de la sección
└── _index.md                   # branch bundle (home page)
```

- Los `.md` en un branch bundle **sí** se renderizan como páginas de contenido
  (a diferencia de los `.md` no-índice en leaf bundles).
- Los directorios de primer nivel **con o sin** `_index.md` son branch bundles.

### Headless bundles

Mediante `build` options en front matter se crean bundles no publicados cuyo
contenido/recursos se incluyen en otras páginas (ver [§12](#12-build-options)).

### Gotchas

- **Confusión #1:** `content-1.md` en un leaf bundle **no** es una página — es un
  recurso. Para páginas múltiples usa un branch bundle.
- **Confusión #2:** un directorio sin `index.md` ni `_index.md` **no** es bundle;
  los archivos sueltos son páginas regulares de la sección padre.
- La extensión del índice depende del content format: `index.md`, `index.html`,
  `index.adoc`, etc.

> **Cuándo usarlo en FrenzyCars:** cada artículo debe convertirse en un **leaf
> bundle** (`reviews/<slug>/index.md` + `cover.jpg`). Las secciones (`reviews/`,
> `news/`) permanecen como **branch bundles** con `_index.md`.

---

## 4. Page resources (.Resources.Get / .GetMatch)

**Resumen:** Los *page resources* son archivos asociados a un page bundle,
accesibles **solo** desde la página con la que están empaquetados, mediante métodos
sobre el objeto `Page`.

### Métodos de captura

| Método | Comportamiento |
|--------|----------------|
| `.Resources.Get $path` | Coincidencia **exacta** por ruta relativa al bundle; devuelve `nil` si no existe. **Lanza nada**: hay que comprobar con `with`. |
| `.Resources.GetMatch $pattern` | Primera coincidencia por **glob** (case-insensitive). |
| `.Resources.Match $pattern` | Todas las coincidencias por glob. |
| `.Resources.ByType "image"` | Todos los recursos de un tipo dado. |

### Patrones de uso robustos

Obtener imagen, lanzar error si falta (recomendado para el `cover`):

```go-html-template
{{ $path := "cover.jpg" }}
{{ with .Resources.Get $path }}
  <img src="{{ .RelPermalink }}" width="{{ .Width }}" height="{{ .Height }}" alt="">
{{ else }}
  {{ errorf "No se encuentra el page resource %q en %q" $path .Path }}
{{ end }}
```

Obtener **todas** las imágenes de un bundle:

```go-html-template
{{ range .Resources.ByType "image" }}
  {{ with .Resize "300x" }}
    <img src="{{ .RelPermalink }}" width="{{ .Width }}" height="{{ .Height }}" alt="">
  {{ end }}
{{ end }}
```

### Metadata vía front matter (`[[resources]]`)

La metadata de los page resources se gestiona desde el front matter de la página,
con un array `resources`. Campos:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `src` | string | **Requerido.** Glob pattern relativo al bundle (case-insensitive). |
| `name` | string | Sobrescribe `.Name`; admite placeholder `:counter`. Tras asignarlo, úsalo (no la ruta) con `Get`/`Match`. |
| `title` | string | Sobrescribe `.Title`; admite `:counter`. |
| `params` | map | Pares clave-valor personalizados. Se **fusionan** entre entradas coincidentes. |

Ejemplo TOML:

```toml
+++
title = 'Toyota GR Corolla 2024'

[[resources]]
  name = 'cover'
  src = 'cover.jpg'
  title = 'Toyota GR Corolla 2024'
  [resources.params]
    alt = 'Toyota GR Corolla Morizo Edition en circuito'

[[resources]]
  src = '*.jpg'
  [resources.params]
    gallery = true
+++
```

Tras esto, `cover.jpg` se obtiene con `.Resources.GetMatch "cover"` (por el `name`),
no por la ruta.

### Reglas de metadata

- Para `name` y `title`: **gana la primera entrada** coincidente; las posteriores
  se ignoran. Pon patrones específicas **antes** que wildcards amplios.
- Para `params`: **todas** las entradas coincidentes contribuyen; las posteriores
  tienen precedencia en claves duplicadas.
- `:counter` mantiene contadores **independientes por patrón `src` único**,
  empezando en 1.

### Gotchas

- Page resources **solo** accesibles desde page bundles (`index.md` / `_index.md`).
- En **branch bundles**, los recursos de tipo `page` (`.md`) **no** son recursos:
  son páginas de contenido. Por eso el `cover` debe vivir en el **leaf** bundle del
  artículo, no en el branch de la sección.
- `.Resources.Get` devuelve `nil` silenciosamente — usa siempre `{{ with ... }}`
  o `{{ errorf ... }}` para evitar `<img src="">` rotos.
- La ruta es **relativa al bundle**: `"cover.jpg"`, no `"content/reviews/.../cover.jpg"`.

> **Cuándo usarlo en FrenzyCars:** cada artículo referencia su portada con
> `.Resources.GetMatch "cover"`. Permite añadir `params.alt` localizado en el front
> matter en vez de hardcodear el `alt` en plantilla.

---

## 5. Procesamiento de imágenes (pipeline)

**Resumen:** Hugo transforma imágenes en build (resize, crop, fit, fill, filter) y
cachea el resultado. Solo las imágenes *processable* (JPEG, PNG, GIF, WebP, AVIF,
TIFF, BMP) pueden transformarse; **SVG, ICO, HEIC, HEIF** no son procesables (solo
se sirven tal cual).

### Origen del recurso

| Origen | Captura | Contexto |
|--------|---------|----------|
| **Page resource** (bundle) | `.Resources.Get "x.jpg"` | Dentro de plantilla de página |
| **Global resource** (`assets/`) | `resources.Get "images/x.jpg"` | Cualquier plantilla |
| **Remote resource** | `resources.GetRemote $url` | Migración desde URLs Unsplash |

```go-html-template
{{/* Page resource */}}
{{ $image := .Resources.Get "cover.jpg" }}

{{/* Global resource */}}
{{ $image := resources.Get "images/placeholder.jpg" }}

{{/* Remote resource (transición desde Unsplash) */}}
{{ with try (resources.GetRemote $url) }}
  {{ with .Err }}{{ errorf "%s" . }}{{ else with .Value }}
    {{/* procesar .Value */}}
  {{ end }}
{{ end }}
```

### Métodos de transformación

| Método | Descripción |
|--------|-------------|
| `.Resize "WxH"` | Redimensiona respetando aspecto. ej. `"300x"`, `"x300"`, `"300x200"`, `"300x300 jpg"` |
| `.Fit "WxH"` | **Reduce** (nunca escala arriba) para caber en la caja manteniendo aspecto |
| `.Fill "WxH"` | Recorta y redimensiona para **rellenar** exactamente la caja (cover crop) |
| `.Crop "WxH"` | Recorta según especificación sin reescalar |
| `.Filter $f` | Aplica filtros (blur, grayscale, etc.) |
| `.Process "spec"` | API unificada de procesamiento: ej. `"resize 300x webp"`, `"fit 800x450 webp q80"` |

> `.Process` es la forma moderna que combina operación + formato de salida + calidad
> en un solo string. La sintaxis moderna: `{{ .Process "resize 600x webp" }}`.

### Pipeline completo: cover WebP + srcset responsivo

Este es el patrón central para el refactor de FrenzyCars:

```go-html-template
{{/* layouts/partials/cover.html */}}
{{ $src := .Resources.GetMatch "cover" }}              {{/* por name del front matter */}}
{{ with $src }}
  {{ $alt := .Params.alt | default .Title }}

  {{/* Generar variantes */}}
  {{ $webp480  := .Process "fit 480x webp q75" }}
  {{ $webp800  := .Process "fit 800x webp q75" }}
  {{ $webp1200 := .Process "fit 1200x webp q75" }}
  {{ $jpeg800  := .Fit "800x jpg" }}                    {{/* fallback no-WebP */}}

  {{/* Imagen con loading lazy + dimensions + srcset */}}
  <picture class="cover">
    <source type="image/webp"
            srcset="{{ $webp480.RelPermalink }} 480w,
                    {{ $webp800.RelPermalink }} 800w,
                    {{ $webp1200.RelPermalink }} 1200w"
            sizes="(max-width: 768px) 100vw, 800px">
    <img src="{{ $jpeg800.RelPermalink }}"
         srcset="{{ $jpeg800.RelPermalink }} 800w"
         width="{{ $webp800.Width }}"
         height="{{ $webp800.Height }}"
         alt="{{ $alt }}"
         loading="lazy"
         decoding="async">
  </picture>
{{ else }}
  {{ errorf "Falta el page resource 'cover' en %q" .Path }}
{{ end }}
```

### Dimensiones y prevención de layout shift

`.Width` y `.Height` se exponen sobre cualquier resource de imagen processable.
**Siempre** incluye `width`/`height` en el `<img>` para evitar CLS (cumulative
layout shift) — relevante para Core Web Vitals / SEO.

### Detalles de formato

| Formato | IsImageResource | Processable | Con metadata (Exif/IPTC/XMP) |
|---------|-----------------|-------------|------------------------------|
| JPEG | sí | sí | sí |
| PNG | sí | sí | sí |
| WebP | sí | sí | sí |
| AVIF | sí | sí | sí |
| GIF | sí | sí | sí |
| TIFF | sí | sí | sí |
| BMP | sí | sí | sí |
| SVG | sí | **no** | **no** |
| HEIC/HEIF | sí | **no** | sí |
| ICO | sí | **no** | **no** |

Usa `reflect.IsImageResourceProcessable .` antes de procesar si el tipo no es seguro.

### Rendimiento y caché

- Hugo procesa bajo demanda y **cachea** en el file cache (ver `[caches]` en config).
- Imágenes fuente grandes (>4 MP) consumen mucha memoria en build: escala el
  original antes de subirlo.
- Para limpiar caché obsoleta: `hugo build --gc`.
- Netlify: configura `[caches.images] dir = ':cacheDir/images'` para persistir.

### Configuración global de imaging

Se controla en `[imaging]` (calidad por defecto, filtros de ancla para Crop/Fill,
orientación EXIF, etc.). Definir calidad/`bg` color por defecto aquí.

### Gotchas

- La metadata EXIF/IPTC **no se preserva** tras la transformación; úsala con
  `.Meta` sobre la imagen **original**.
- `.Fit` nunca escala hacia arriba (upscaling); si la fuente ya es menor, la
  devuelve sin cambios.
- `.Fill` recorta desde el centro por defecto (ancla configurable vía `[imaging]`).
- Generar demasiadas variantes por imagen multiplica el tiempo de build: limita a
  2–3 breakpoints (`srcset`).
- El `quality` (`q75`) en `.Process`/`.Resize` sobreescribe el `[imaging.quality]`
  global.

> **Cuándo usarlo en FrenzyCars:** este es **el** cambio central. Reemplaza
> `<img src="{{ .Params.cover }}">` (URL Unsplash remota) por el partial
> `cover.html` que procesa `cover.jpg` local a WebP con `srcset`. Reduce ~70% el
> peso de imágenes y elimina dependencia externa.

---

## 6. Front matter y mapeo a Page params

**Resumen:** Metadata en la cabecera de cada archivo de contenido. Formatos: YAML
(`---`), TOML (`+++`), JSON (`{}`). Hugo detecta el formato por los delimitadores.

FrenzyCars usa **TOML** (`+++`).

### Campos reservados más relevantes

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `title` | string | Título de la página → `.Title` |
| `date` | string/datetime | Fecha de creación → `.Date` |
| `lastmod` | string | Última modificación → `.Lastmod` |
| `publishDate` | string | Fecha de publicación (futuro = no renderiza salvo `--buildFuture`) |
| `expiryDate` | string | Fecha de expiración |
| `draft` | bool | Borrador (no renderiza salvo `--buildDrafts`) |
| `weight` | int | Orden dentro de colecciones (menor = arriba) |
| `slug` | string | Último segmento URL |
| `url` | string | Path URL completo |
| `description` | string | Para `<meta name="description">` → `.Description` |
| `summary` | string | Resumen explícito → `.Summary` |
| `keywords` | []string | Keywords meta / taxonomía |
| `aliases` | []string | Redirects a esta página |
| `type` | string | Sobrescribe el content type derivado de la sección |
| `layout` | string | Fuerza una plantilla concreta |
| `linkTitle` | string | Título corto para enlaces → `.LinkTitle` |
| `isCJKLanguage` | bool | Afecta word count/reading time |
| `menus` | string/[]string/map | Añade la página a menús |
| `taxonomies...` | []string | Términos de taxonomía (ej. `tags`, `categories`) |
| `params` | map | Parámetros personalizados → `.Params` |
| `resources` | array | Metadata de page resources |
| `cascade` | map/array | Propaga valores a descendientes |
| `build` | map | Build options |
| `headless` | bool | Atajo para leaf bundle headless |

### Parámetros personalizados (`[params]`)

Cualquier campo bajo `params` es accesible vía `.Params.<campo>`:

```toml
+++
title = 'Toyota GR Corolla 2024'
[params]
  author = 'Juan Pérez'
  reading_time_override = 5
  hero_color = '#cc0000'
+++
```

```go-html-template
{{ .Params.author }}            {{/* "Juan Pérez" */}}
{{ .Param "author" }}           {{/* idéntico, con fallback a config */}}
```

### Cómo mapea el `cover` actual → refactor

**Actual (deprecado para el refactor):** campo suelto en front matter.

```toml
cover = 'https://images.unsplash.com/photo-XXXX'
```
Acceso: `{{ .Params.cover }}` — pero NO permite procesamiento.

**Refactor (page resource nombrado):**

```toml
[[resources]]
  name = 'cover'
  src = 'cover.jpg'
  [resources.params]
    alt = 'Toyota GR Corolla 2024'
```
Acceso: `{{ .Resources.GetMatch "cover" }}` — permite `.Process`, `.Width`, etc.

> La transición puede ser **gradual**: la plantilla comprueba primero el page
> resource y, si no existe, hace fallback a `.Params.cover` (URL remota). Así los
> artículos no migrados siguen funcionando.

### Cascade

Un branch puede propagar valores a descendientes. Ej: fijar un author por defecto
para toda la sección `reviews`:

```toml
# content/reviews/_index.md
+++
title = 'Reseñas'
[cascade]
  [cascade.params]
    author = 'Equipo FrenzyCars'
    hero_color = '#1a1a1a'
+++
```

El descendiente lo hereda **salvo** que lo defina él mismo (o un ancestro más
cercano). Se puede acotar con `target` (por `path`, `kind`, `environment`):

```toml
[[cascade]]
  [cascade.params]
    show_ads = false
  [cascade.target]
    path = '{/reviews,/reviews/**}'
```

### Fechas

Formatos parseables: `2023-10-15T13:18:50-07:00`, `2023-10-15T13:18:50Z`,
`2023-10-15`, `15 Oct 2023`. TOML admite valores de fecha **sin comillas**.
Precedencia de zona horaria: offset del string > `timeZone` config > `Etc/UTC`.

### Gotchas

- Los nombres de campo reservados **no** se pueden reutilizar para custom params
  (no puedes crear un campo `type` propio). Usa `[params]`.
- `summary` (front matter) ≠ `.Summary` (método automático); ver [§11](#11-summaries).
- `description` se suele renderizar en `<meta>`, mientras que `.Summary` va en el
  cuerpo/listados.

> **Cuándo usarlo en FrenzyCars:** define un estándar de front matter TOML para
> todos los artículos: `title`, `date`, `draft`, `tags`, `categories`, y el array
> `[[resources]]` con el `cover`. Usa `cascade` en `_index.md` de sección para
> valores por defecto (author, color de héroe).

---

## 7. Shortcodes

**Resumen:** Plantillas invocables dentro del contenido Markdown para insertar
videos, imágenes, embeds, etc. Tres tipos: **embedded**, **custom**, **inline**.

### Sintaxis

Dos notaciones:

| Notación | Delimitador | Markdown interno |
|----------|-------------|------------------|
| Markdown | `{{% foo %}}` | **Sí** se procesa Markdown (ej. headings entran en ToC) |
| Standard | `{{< foo >}}` | **No** (se inserta post-Markdown) |

Argumentos **named** o **positional**, pero no mezclados en una misma llamada:

```text
{{< figure src=/images/kitten.jpg alt="A white kitten" >}}
{{< youtube w7Ft2ymGmfc >}}
```

### Shortcodes embedded relevantes

`figure`, `youtube`, `vimeo`, `instagram`, `x`, `highlight`, `details`, `param`,
`ref`, `relref`, `qr`.

`figure` (útil para imágenes en cuerpo):

```text
{{< figure src="gallery.jpg" alt="Interior del coche" caption="Salpicadero digital" >}}
```

> Nota: `figure` con `src` relativo resuelve page resources en leaf bundles.

### Custom shortcode

```go-html-template
{{/* layouts/_shortcodes/audio.html */}}
{{ with resources.Get (.Get "src") }}
  <audio controls preload="auto" src="{{ .RelPermalink }}"></audio>
{{ end }}
```

Uso: `{{< audio src=/audio/test.mp3 >}}`

### Inline

Plantilla definida **dentro** del contenido; deshabilitado por defecto (seguridad).
Habilitar con `[security] enableInlineShortcodes = true`. No se pueden anidar.

### Nesting

Los shortcodes (no inline) se pueden anidar (galería con imágenes internas).

### Gotchas

- Shortcodes procesados **antes** que render hooks de Markdown — las imágenes en
  `figure` no pasan por image render hooks automáticamente.
- Argumentos con espacios → entrecomillar.
- Para multiline string usar raw literal: `` `texto<b>HTML</b>...` ``

> **Cuándo usarlo en FrenzyCars:** crea un shortcode `{{< car-specs >}}` para
> fichas técnicas tabuladas y `{{< gallery >}}` para galerías de imágenes (con
> page resources), estandarizando el formato de las reseñas.

---

## 8. Sections

**Resumen:** Una *section* es un directorio de contenido de primer nivel, o
cualquier directorio que contenga `_index.md`. Define el content type y la
selección de plantillas.

### Comportamiento

| | Sections | No-sections |
|--|----------|-------------|
| Nombres de dir → segmentos URL | sí | sí |
| Ancestros/descendientes lógicos | sí | no |
| Páginas de listado | sí | no |

- El listado de una sección incluye por defecto **solo** páginas regulares
  directas (`.Pages`). Para incluir descendientes profundos usar
  `.RegularPagesRecursive`.
- Subdirectorios **sin** `_index.md` no son secciones: sus archivos se agregan
  al listado de la sección padre, sin páginas de listado propias.

### Selección de plantilla

El lookup considera el **nombre de sección de primer nivel**, no el de
subsecciones. Para `content/reviews/...`:

- Section list → `layouts/reviews/section.html`
- Single page → `layouts/reviews/single.html` (o `page.html`)

Si necesitas plantilla distinta para una subsección, usa `type`/`layout` en front matter.

### Ancestros y descendientes

`.Parent`, `.Ancestors`, `.Sections` permiten navegar la jerarquía. Útil para
breadcrumbs:

```go-html-template
<nav class="breadcrumb">
  <ol>
    {{ range .Ancestors.Reverse }}
      <li><a href="{{ .RelPermalink }}">{{ .LinkTitle }}</a></li>
    {{ end }}
    <li aria-current="page">{{ .LinkTitle }}</li>
  </ol>
</nav>
```

> **Cuándo usarlo en FrenzyCars:** `reviews/`, `news/`, `guides/` son secciones de
> primer nivel. Crea `layouts/reviews/section.html` (listado de reseñas) y
> `layouts/reviews/single.html` (artículo individual).

---

## 9. Taxonomies

**Resumen:** Clasificaciones de contenido por relaciones lógicas. Por defecto Hugo
incluye `tags` y `categories`; se pueden definir las que se quieran.

- **Taxonomy:** categoría de clasificación (ej. `tags`).
- **Term:** clave dentro de la taxonomy (ej. `electric`).
- **Value:** contenido asignado a un término.

### Configuración

```toml
[taxonomies]
  tag = 'tags'
  category = 'categories'
  brand = 'brands'          # FrenzyCars: ej. Toyota, BMW
  author = 'authors'
```

### Asignar términos en front matter

```toml
+++
title = 'Toyota GR Corolla 2024'
tags = ['hot-hatch', 'performance']
categories = ['review']
brands = ['toyota']
+++
```

Hugo genera automáticamente:
- `/tags/` (lista de todos los términos)
- `/tags/hot-hatch/` (páginas con ese término)

### Taxonomic weight

Ordenar dentro de los listados de una taxonomía concreta:

```toml
+++
tags = ['electric']
tags_weight = 1000
weight = 10
+++
```

`weight` ordena en secciones/home; `tags_weight` ordena en páginas de término.

### Metadata de términos (branch bundles)

Para mostrar info enriquecida por término (ej. autores con foto):

```text
content/
└── authors/
    └── jsmith/
        ├── _index.md
        └── portrait.jpg
```

Plantilla `layouts/authors/term.html` puede usar `.Resources.Get "portrait.jpg"`
y `.Params.affiliation`.

### Acceso en plantilla

```go-html-template
{{ with .GetTerms "tags" }}
  <ul>{{ range . }}<li><a href="{{ .RelPermalink }}">{{ .LinkTitle }}</a></li>{{ end }}</ul>
{{ end }}
```

> **Cuándo usarlo en FrenzyCars:** define `tags` (estilo/categoría: hot-hatch, suv),
> `brands` (fabricantes), `authors`. Las páginas de marca (`/brands/toyota/`) son
> excelentes landing pages SEO con poco esfuerzo.

---

## 10. Menus

**Resumen:** Estructuras de navegación definibles de tres formas: automática, en
front matter o en configuración.

### Automática (section pages menu)

```toml
sectionPagesMenu = 'main'
```
Crea una entrada por cada sección de primer nivel → accesible vía `site.Menus.main`.

### En front matter

```toml
# Añadir a un solo menú
menus = 'main'

# A varios
menus = ['main', 'footer']

# Con propiedades
[menus.main]
  parent = 'Reviews'
  weight = 20
  pre = '<i class="icon-star"></i>'
  [menus.main.params]
    class = 'highlight'
```

Propiedades: `identifier`, `name`, `title`, `parent`, `weight`, `pre`, `post`,
`params`.

### En configuración

```toml
[[menus.main]]
  name = 'Reseñas'
  pageRef = '/reviews'
  weight = 10
[[menus.main]]
  name = 'Noticias'
  pageRef = '/news'
  weight = 20
```

### Render (plantilla típica)

```go-html-template
<nav>
  {{ range site.Menus.main }}
    <a href="{{ .URL }}">{{ .Name }}</a>
  {{ end }}
</nav>
```

Para menús anidados, iterar `.Children`.

### Gotchas

- `identifier` es **requerido** si dos entradas comparten `name` o para i18n.
- `menu` (singular) es alias de `menus`.
- Usa **un solo método** de definición para mantener mantenibilidad.

> **Cuándo usarlo en FrenzyCars:** define el menú principal en configuración
> (`hugo.toml`), no en front matter — es más simple y editable. Incluye Reseñas,
> Noticias, Guías y Marcas.

---

## 11. Summaries

**Resumen:** Tres formas de generar el resumen de un artículo. Precedencia:
manual > front matter > automático.

### Manual (divider `<!--more-->`)

```markdown
Primer párrafo del artículo. Esta parte es el resumen.

<!--more-->

Resto del contenido...
```

Debe ir en su **propia línea**, nunca inline. Soporta Markdown y shortcodes.

### Front matter (`summary`)

```toml
summary = 'Reseña completa del Toyota GR Corolla 2024.'
```
Independiente del cuerpo. **No** renderiza Markdown ni shortcodes.

### Automática

Si no se define, Hugo toma los primeros `summaryLength` párrafos (configurable).

### Comparación

| Tipo | Precedencia | Renderiza Markdown | Renderiza shortcodes |
|------|-------------|--------------------|-----------------------|
| Manual (`<!--more-->`) | 1 | sí | sí |
| Front matter (`summary`) | 2 | sí | **no** |
| Automática | 3 | sí | sí |

### Render en plantilla

```go-html-template
{{ range site.RegularPages }}
  <h2><a href="{{ .RelPermalink }}">{{ .LinkTitle }}</a></h2>
  <div class="summary">
    {{ .Summary }}
    {{ if .Truncated }}<a href="{{ .RelPermalink }}">Leer más…</a>{{ end }}
  </div>
{{ end }}
```

Alternativa de control fino: `{{ .Content | strings.Truncate 42 }}`.

### Gotchas

- `.Summary` automático puede **cortar** tags de bloque (blockquote, div) a la
  mitad y romper el HTML. Envolver en `<div>` o usar resumen manual.
- El resumen del front matter **no** procesa Markdown.

> **Cuándo usarlo en FrenzyCars:** usa el divider `<!--more-->` para controlar el
> extracto que aparece en cards de listado; así el extracto siempre queda limpio
> junto a la imagen de portada procesada.

---

## 12. Build options

**Resumen:** Controlan cómo Hugo trata una página en build. Se definen en front
matter bajo `[build]`. Por defecto:

```toml
[build]
  list = 'always'
  publishResources = true
  render = 'always'
```

| Opción | Valores | Descripción |
|--------|---------|-------------|
| `list` | `always` \| `local` \| `never` | Cuándo incluir la página en colecciones (`site.RegularPages`, `.Pages`) |
| `publishResources` | `true` \| `false` | Si publicar los page resources. Con `false`, solo se publican al invocar `.Permalink`/`.RelPermalink`/`.Publish` |
| `render` | `always` \| `link` \| `never` | Si renderizar la página a disco. `link` = no genera HTML pero asigna permalink |

### Patrones útiles

**Headless page** (no publica HTML pero sirve recursos):

```toml
[build]
  list = 'never'
  publishResources = false
  render = 'never'
```

Acceso vía `.Site.GetPage "/headless"` → `.Content` y `.Resources`.

**Headless section** (cascada a descendientes):

```toml
[[cascade]]
  [cascade.build]
    list = 'local'
    publishResources = false
    render = 'never'
```

**Ocultar sección condicionalmente** (ej. solo en dev):

```toml
[[cascade]]
  [cascade.build]
    list = 'never'
    render = 'never'
  [cascade.target]
    environment = 'production'
```

### Gotchas

- Aunque `publishResources = false`, si una plantilla invoca `.RelPermalink` el
  recurso **se publica** (comportamiento esperado).
- Cualquier página sigue accesible vía `.GetPage` sin importar sus build options.

> **Cuándo usarlo en FrenzyCars:** útil para contenido "interno" como borradores
> compartidos o datos auxiliares (ej. un JSON de especificaciones que se consume
> vía partial sin generar página pública).

---

## 13. Archetypes

**Resumen:** Plantillas para nuevo contenido usadas por `hugo new content`. Definen
front matter y opcionalmente cuerpo por defecto.

### Arquetipo por defecto

```toml
# archetypes/default.md
+++
date = '{{ .Date }}'
draft = true
title = '{{ replace .File.ContentBaseName `-` ` ` | title }}'
+++
```

Uso: `hugo new content reviews/mi-resena.md`

### Lookup order

1. `archetypes/posts.md`
2. `themes/<tema>/archetypes/posts.md`
3. `archetypes/default.md`
4. `themes/<tema>/archetypes/default.md`
5. built-in default

Un arquetipo con el **nombre de sección** tiene precedencia sobre `default.md`.
Forzar con `--kind`: `hugo new content --kind tutorials reviews/x.md`.

### Contexto disponible

`Date`, `File`, `Type`, `Site`. Cualquier función de plantilla es usable.

### Archetype para leaf bundles (ideal para FrenzyCars)

```text
archetypes/
└── reviews/
    ├── images/
    │   └── .gitkeep             # mantiene el subdirectorio en git
    └── index.md                 # front matter estándar
```

Al ejecutar `hugo new content reviews/nueva-resena`, se crea el bundle completo:

```text
content/reviews/nueva-resena/
├── images/
│   └── .gitkeep
└── index.md
```

> Los subdirectorios del arquetipo necesitan **al menos un archivo** o Hugo no los
> crea.

### Arquetipo recomendado para FrenzyCars

```toml
# archetypes/reviews/index.md
+++
date = '{{ .Date }}'
draft = true
title = '{{ replace .File.ContentBaseName `-` ` ` | title }}'
tags = []
categories = ['review']
brands = []

[[resources]]
  name = 'cover'
  src = 'cover.jpg'
  [resources.params]
    alt = ''
+++

<!--more-->
```

> **Cuándo usarlo en FrenzyCars:** crea `archetypes/reviews/` como leaf bundle
> con el `[[resources]]` del cover ya preconfigurado. Así `hugo new` y Sveltia CMS
> generan artículos con la estructura correcta desde el inicio.

---

## 14. Multilingual

**Resumen:** Hugo soporta i18n con configuración single-host o multi-host.
FrenzyCars actualmente es monolingüe (español), pero conviene conocerlo.

### Configuración

```toml
defaultContentLanguage = 'es'
defaultContentLanguageInSubdir = false
[languages]
  [languages.es]
    label = 'Español'
    locale = 'es-ES'
    weight = 1
  [languages.en]
    label = 'English'
    locale = 'en-US'
    weight = 2
```

### Traducción de contenido — dos enfoques

**Por nombre de archivo:** `about.es.md` ↔ `about.en.md` (mismo path/basename).
Código de idioma en **minúsculas** (`en-us`, no `en-US`).

**Por directorio de contenido:** cada idioma tiene su `contentDir` distinto.

### Bypass del enlazado

`translationKey = 'about'` enlaza páginas con paths distintos como traducciones.

### Localización de permalinks

Usar `slug`/`url` en front matter por idioma (ej. `/a-propos` en francés).

### Page bundles multilingües

Cada bundle hereda los recursos de sus traducciones **excepto** archivos de
contenido. Si dos archivos comparten basename entre idiomas, gana el del idioma
actual, si no, el de menor `weight`. Los recursos siguen la lógica de idioma por
nombre (`cover.es.jpg`) o directorio.

### Localización de strings, fechas, números

- `lang.Translate` / `T` para cadenas (tabla `i18n/`).
- `time.Format ":date_full"` se localiza según `locale`.
- `lang.FormatCurrency`, `lang.FormatNumber`, `lang.FormatPercent`.

### Menús multilingües

Definir entradas por idioma bajo `[languages.<lang>.menus]` o usar tablas de
traducción con `identifier` + `T`.

### Gotchas

- En multilingüe single-host, Hugo **no duplica** recursos Markdown compartidos
  por defecto (optimización); para Markdown los resolve vía render hooks.
- `enableMissingTranslationPlaceholders = true` marca cadenas faltantes como
  `[i18n] identifier`.
- Depurar traducciones: `hugo build --printI18nWarnings | grep i18n`.

> **Cuándo usarlo en FrenzyCars:** si se añade inglés (mercado internacional de
> coches), la estructura leaf bundle por idioma + `translationKey` permite
> compartir imágenes entre traducciones sin duplicarlas.

---

## 15. URL management

**Resumen:** Las URLs por defecto reflejan el path en `content/`. Se controlan con
`slug`, `url`, permalinks y aliases.

### `slug` — último segmento

```toml
slug = 'gr-corolla-2024'
```
Resulta en `/reviews/gr-corolla-2024/`. No aplica a home/section/taxonomy/term.

### `url` — path completo

```toml
url = 'articles/my-first-article'      # → /articles/my-first-article/
url = 'articles/my-first-article.html' # conserva la extensión
```

- `url` tiene precedencia sobre `slug`.
- Hugo **no sanitiza** `url`: cuidado con caracteres reservados del SO (en Windows,
  `:` falla). Escapar con `\:` (TOML con comillas simples).
- Multilingüe: `url` sin barra inicial → relativo a `baseURL` + prefijo de idioma.

### Tokens para permalinks/cascade

```
:year  :month  :monthname  :day  :weekday  :weekdayname  :yearday
:section  :sectionslug  :sections  :sections[last]  :sectionslugs
:title  :slug  :contentbasename  :slugorcontentbasename
```

Ejemplo típico en configuración:

```toml
[permalinks]
  reviews = '/:sections[last]/:slug'
```

### Aliases (redirects)

```toml
aliases = ['/old-url', 'old-name', '../old/path']
```

- Genera por defecto redirección **client-side** (HTML con `<meta refresh>`).
- Para **server-side** (`_redirects`, `.htaccess`): iterar `.Aliases` y poner
  `disableAliases = true` para no generar HTML.

### Post-procesado (legacy)

- `canonifyURLs = true`: convierte URLs relativas en absolutas (legacy, mejor
  usar funciones/render hooks).
- `relativeURLs = true`: convierte a relativas (solo para sites serverless/vía
  filesystem).

### Gotchas

- Cambiar un `slug` rompe enlaces antiguos: **siempre** añade `aliases` con la URL
  previa al renombrar/mover contenido.
- Los tokens de permalink solo actúan en `[permalinks]` config o `url` en cascade,
  no en `slug` simple.

> **Cuándo usarlo en FrenzyCars:** si al migrar de `.md` plano a leaf bundle el
  slug cambia, añade `aliases` para preservar URLs indexadas. Usa `[permalinks]`
> para unificar la estructura si las secciones tienen prefijos no deseados.

---

## 16. Apéndice: snippet maestro de cover image

Plantilla parcial reutilizable con **fallback** (transición gradual del refactor):

```go-html-template
{{/* layouts/partials/cover.html — invocar como {{ partial "cover.html" . }} */}}

{{ $alt := .Params.cover_alt | default .Title }}
{{ $class := .Params.cover_class | default "cover" }}

{{/* 1. Intentar page resource nombrado (nuevo estándar) */}}
{{ $src := .Resources.GetMatch "cover" }}

{{ with $src }}
  {{ $alt = .Params.alt | default $alt }}
  {{ $w800  := .Process "fit 800x webp q75" }}
  {{ $w1200 := .Process "fit 1200x webp q75" }}
  {{ $jpg   := .Fit "800x jpg" }}

  <picture class="{{ $class }}">
    <source type="image/webp"
            srcset="{{ $w800.RelPermalink }} 800w, {{ $w1200.RelPermalink }} 1200w"
            sizes="(max-width: 768px) 100vw, 800px">
    <img src="{{ $jpg.RelPermalink }}"
         width="{{ $w800.Width }}" height="{{ $w800.Height }}"
         alt="{{ $alt }}" loading="lazy" decoding="async">
  </picture>

{{/* 2. Fallback a URL remota (artículos no migrados) */}}
{{ else if .Params.cover }}
  <img src="{{ .Params.cover }}"
       class="{{ $class }}"
       alt="{{ $alt }}" loading="lazy" decoding="async">

{{/* 3. Error explícito si no hay nada */}}
{{ else }}
  {{ warnf "Sin cover ni page resource 'cover' en %q" .Path }}
{{ end }}
```

**Lista de comprobación del refactor:**

1. Convertir cada `reviews/<slug>.md` → `reviews/<slug>/index.md`.
2. Descargar la imagen Unsplash a `reviews/<slug>/cover.jpg`.
3. Añadir `[[resources]] name="cover" src="cover.jpg"` al front matter.
4. Eliminar `cover = 'https://...'` (o conservar temporalmente para el fallback).
5. Reemplazar `{{ .Params.cover }}` en plantillas por `{{ partial "cover.html" . }}`.
6. Ejecutar `hugo build --gc` para limpiar caché de imágenes antiguas.
```
