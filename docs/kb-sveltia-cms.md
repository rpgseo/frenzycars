# Base de Conocimiento — Sveltia CMS

> Referencia consolidada para el sitio Hugo **FrenzyCars** (`rpgseo/frenzycars`, rama `main`).
> Sveltia CMS vive en `static/admin/index.html` (cargado desde `unpkg`) y su configuración en
> `static/admin/config.yml`. Prosa en español; claves YAML / código en inglés.
> Fuente: documentación oficial de Sveltia CMS (https://sveltiacms.app/en/docs/) consultada en 2026-06.

## Tabla de contenidos

1. [¿Qué es Sveltia CMS?](#1-qué-es-sveltia-cms)
2. [Sveltia CMS vs Decap CMS](#2-sveltia-cms-vs-decap-cms)
3. [Estructura de `config.yml`](#3-estructura-de-configyml)
4. [Backend GitHub y autenticación](#4-backend-github-y-autenticación)
5. [Almacenamiento de medios (media)](#5-almacenamiento-de-medios-media)
6. [⚠️ Hugo leaf bundles e imágenes colocadas](#6--hugo-leaf-bundles-e-imágenes-colocadas)
7. [Tipos de colección](#7-tipos-de-colección)
8. [Widgets / tipos de campo](#8-widgets--tipos-de-campo)
9. [Slugs, rutas, resúmenes y previews](#9-slugs-rutas-resúmenes-y-previews)
10. [Mapeo de front matter (cómo los campos se vuelven YAML/TOML)](#10-mapeo-de-front-matter)
11. [Modo desarrollo local («Work with Local Repository»)](#11-modo-desarrollo-local)
12. [Características de Decap NO soportadas](#12-características-de-decap-no-soportadas)
13. [Apéndice: aplicación a FrenzyCars](#13-apéndice-aplicación-a-frenzycars)

---

## 1. ¿Qué es Sveltia CMS?

Sveltia CMS es un **CMS headless basado en Git**, libre (licencia MIT) y de código abierto, construido con el
framework Svelte y el editor Lexical. Su contenido vive en un repositorio Git (no hay base de datos). Se ejecuta
íntegramente en el navegador como una SPA de menos de 600 KB (min + brotli) servida por CDN.

Puntos clave:

- **Git-based**: cada cambio es un commit auditable; sin base de datos.
- **Headless / agnóstico de framework**: compatible con Hugo, Astro, Jekyll, Eleventy, Next.js, SvelteKit, etc.
- **Local-first**: permite trabajar contra el repositorio local sin servidor proxy (File System Access API).
- **Compatible con el formato de configuración, API y workflow de Netlify/Decap CMS**: en muchos casos es un
  reemplazo *drop-in* (cambiar una sola línea del `<script>`).
- **Estado**: beta; la 1.0 (GA) prevista para mediados de 2026.

Cómo aplica a FrenzyCars: Sveltia se carga en `static/admin/index.html` desde
`https://unpkg.com/@sveltia/cms/dist/sveltia-cms.js`. Lee `static/admin/config.yml`, se conecta al backend
GitHub y edita el contenido Markdown/YAML del repo.

---

## 2. Sveltia CMS vs Decap CMS

Sveltia se diseñó como **sucesor de Netlify CMS** (hoy Decap CMS). Mantiene la compatibilidad con la
configuración de Decap, pero no busca paridad 100 %.

Diferencias de terminología:

| Decap CMS | Sveltia CMS |
| --- | --- |
| Media library | Media storage provider |
| Folder collection | Entry collection |
| Widget | Field type |
| Summary string transformation | String transformation |

Migración: básicamente sustituir el script. De Decap:

```diff
-<script src="https://unpkg.com/decap-cms@^3.0.0/dist/decap-cms.js"></script>
+<script src="https://unpkg.com/@sveltia/cms/dist/sveltia-cms.js"></script>
```

Cómo aplica a FrenzyCars: si alguna vez hubo Decap, el `index.html` ya solo referencia `@sveltia/cms`. La
`config.yml` usa claves estándar compatibles; ver sección 12 para lo que *no* funciona.

---

## 3. Estructura de `config.yml`

La configuración admite YAML (por defecto), TOML o JSON. La ubicación por defecto es
`config.yml` junto a `index.html` (en FrenzyCars, `/admin/config.yml`). Se puede sobrescribir con:

```html
<link href="/admin/config.yml" type="application/yaml" rel="cms-config-url" />
```

Esquema JSON para autocompletado en VS Code (extensión YAML) — añadir al inicio del archivo:

```yaml
# yaml-language-server: $schema=https://unpkg.com/@sveltia/cms/schema/sveltia-cms.json
```

Forma general de `config.yml`:

```yaml
backend:
  name: github
  repo: rpgseo/frenzycars
  branch: main
# site_url: https://frenzycars.example.com   # opcional
media_folder: static/images/uploads
public_folder: /images/uploads
collections:
  - name: reviews
    label: Reseñas
    folder: content/reviews
    create: true
    fields: [...]
  # ... news, guides, electric, insurance, culture, gear
```

Claves raíz relevantes:

| Clave | Descripción |
| --- | --- |
| `backend` | Proveedor Git (`github`, `gitlab`, `gitea`/`forgejo`). Ver sección 4. |
| `backend.repo` | `owner/repo`. |
| `backend.branch` | Rama destino de los commits. |
| `site_url` | URL del sitio (opcional). |
| `media_folder` / `public_folder` | Carpeta física en el repo / ruta pública URL. Ver sección 5. |
| `collections` | Lista de colecciones (entry o file). Ver sección 7. |
| `slug` | Opciones globales de generación de slugs (sección 9). |
| `output` | Opciones de formato de salida YAML/JSON (sección 10). |
| `locale` | **No soportado** (sección 12); Sveltia autodetecta el idioma de la UI. |
| `local_backend` | **Ignorado**. Sveltia no usa proxy (sección 11). |

> **Nota `local_backend`**: Decap requiere `decap-server`. Sveltia **lo ignora** y ofrece su propio flujo
> «Work with Local Repository» basado en File System Access API (sección 11).

Cómo aplica a FrenzyCars: `backend.name: github`, `backend.repo: rpgseo/frenzycars`, `branch: main`.
No incluir `local_backend` (no hace nada). `media_folder: static/images/uploads`,
`public_folder: /images/uploads`.

---

## 4. Backend GitHub y autenticación

Configuración base:

```yaml
backend:
  name: github
  repo: rpgseo/frenzycars
  branch: main
```

GitHub Enterprise: añadir `base_url` y `api_root` (`https://host.example.com/api/v3`).

Sveltia usa la **API GraphQL** de GitHub por defecto (mejor rendimiento que REST; sin config extra) y los
commits se **firman con GPG automáticamente** (aparecen como *verified*). No soporta **Git LFS** en este backend.

### Métodos de autenticación

1. **Personal Access Token (PAT) — inicio rápido**.
   En la pantalla de login, botón *«Sign In with Token»*. Se genera un PAT en GitHub (scopes preseleccionados),
   se pega, y se guarda en `localStorage` del navegador. Ideal para desarrollador único o equipo pequeño.
   Se puede desactivar globalmente si se desea.

2. **Authorization Code Flow (OAuth)** — recomendado para varios usuarios / no técnicos.
   Requiere una *OAuth App* en GitHub + un servidor OAuth client:
   - **Sveltia CMS Authenticator** oficial (desplegable en Cloudflare Workers):
     ```yaml
     backend:
       name: github
       repo: rpgseo/frenzycars
       base_url: https://tu-authenticator.workers.dev
     ```
   - OAuth clients de terceros hechos para Decap (funcionan sin cambios).
   - **Netlify como proveedor OAuth**: método por defecto si no se configura nada (compatibilidad con Netlify CMS).

3. **PKCE (client-side)**: **NO disponible para GitHub** todavía. GitHub aún no publica PKCE *client-side*
   (rumores de finales de 2025, sin fecha). GitLab sí lo soporta; cuidado con asistentes de IA que afirman lo
   contrario.

> Si solo se usa el **modo local** (sección 11), no hace falta configurar autenticación.

Cómo aplica a FrenzyCars: el enfoque más simple es **PAT**. Para editores no técnicos, desplegar
*Sveltia CMS Authenticator* en Cloudflare Workers y añadir `base_url`.

---

## 5. Almacenamiento de medios (media)

El *internal media storage* usa el sistema de archivos del repositorio. Se configura en tres niveles que se
sobrescriben de mayor a menor: **top-level → collection → field**.

### Top-level

```yaml
media_folder: static/images/uploads   # carpeta física (relativa a la raíz del repo)
public_folder: /images/uploads        # ruta pública URL (debe empezar con /)
```

- `media_folder`: ruta absoluta relativa a la raíz del repo (la `/` inicial es opcional pero recomendada).
- `public_folder`: ruta URL pública; **debe** empezar con `/`. Si se omite, toma el valor de `media_folder`.
- **Cambio respecto a Decap**: Sveltia **no soporta URLs absolutas** en `public_folder`; solo rutas con `/`.
- Para **desactivar** el almacenamiento interno (solo externo), omite `media_folder`.

### Collection-level

```yaml
collections:
  - name: reviews
    folder: content/reviews
    media_folder: /static/images/uploads/reviews   # absoluto desde la raíz
    public_folder: /images/uploads/reviews
```

Si `media_folder` empieza **sin** `/`, se trata como relativo a la carpeta `folder` de la colección (entry-relative). Ver sección 6.

### Placeholders disponibles

`{{media_folder}}`, `{{public_folder}}`, `{{dirname}}`, `{{filename}}`, `{{extension}}` más las etiquetas de
slug (sección 9). Ejemplo:

```yaml
media_folder: '{{media_folder}}/reviews'
public_folder: '{{public_folder}}/reviews'
```

### Field-level

Cualquier campo `image` o `file` puede definir su propia carpeta:

```yaml
fields:
  - name: cover
    widget: image
    media_folder: /static/images/uploads/covers
    public_folder: /images/uploads/covers
```

### `asset_collections`

Permite definir colecciones de assets reutilizables (con `name`, `label`, `icon`, `media_folder`,
`public_folder`) que aparecen en el *media picker*.

### Optimización de imagen y tamaño (internal)

```yaml
media_libraries:
  default:
    config:
      transformations:
        raster_image:
          format: webp     # solo webp soportado
          quality: 85
          width: 2048
          height: 2048
        svg:
          optimize: true
      max_file_size: 1024000   # bytes
      slugify_filename: true   # Decap lo hacía por defecto; Sveltia NO slugifica salvo que se active
```

Cómo aplica a FrenzyCars: el `media_folder`/`public_folder` globales ya cumplen. Se recomienda
`slugify_filename: true` para mantener nombres de archivo consistentes, y `format: webp` con `quality: 85`
para imágenes optimizadas.

---

## 6. ⚠️ Hugo leaf bundles e imágenes colocadas

**Sí, Sveltia CMS soporta imágenes colocadas (Hugo leaf / page bundles)**, pero **no de forma automática**:
hay que configurar `path`, `media_folder` y `public_folder` **juntos** a nivel de colección.

### El patrón leaf bundle (`index.md` + imágenes en su carpeta)

```yaml
collections:
  - name: reviews
    label: Reseñas
    folder: content/reviews
    path: '{{slug}}/index'   # crea content/reviews/<slug>/index.md
    media_folder: ''         # '' => carpeta del propio entry
    public_folder: ''        # '' => referencia relativa al entry
    fields:
      - { name: title, label: Título }
      - { name: cover, label: Portada, widget: image }
      - { name: body, label: Cuerpo, widget: markdown }
```

Resultado en disco:

```
content/reviews/mi-resena/
├─ index.md
└─ cover.jpg
```

Y el front matter referencia la imagen **sin ruta de carpeta**:

```yaml
---
title: Mi reseña
cover: cover.jpg
---
```

### Subcarpeta dentro del bundle

```yaml
    path: '{{slug}}/index'
    media_folder: images
    public_folder: images
```

Produce `content/reviews/mi-resena/images/cover.jpg` y `cover: images/cover.jpg`.

### Comportamiento importante

- Los assets en carpetas entry-relative **solo pertenecen a ese entry**.
- **Al borrar el entry, Sveltia borra también esos assets** (y, en modo local, la carpeta contenedora vacía).
- `media_folder: ''` solo funciona como entry-relative en combinación con `path`; con `path` ausente no
  tendría sentido.

### Implicación para la refactorización de FrenzyCars

Sveltia **no obliga** a migrar a leaf bundles: funciona perfectamente con el modelo global
(`static/images/uploads`). Pero **sí permite** leaf bundles sin trabajo adicional. Por tanto:

- **No es necesario refactorizar** los artículos existentes para adoptar leaf bundles por culpa del CMS.
- Si se quiere co-location (mejor portabilidad, borrado limpio de imágenes), es factible **por colección**,
  añadiendo `path`, `media_folder: ''` y `public_folder: ''` solo a las colecciones que se elijan.
- Las páginas de mantenimiento generadas desde `data/evergreen/*.yaml` vía `_content.gotmpl` **no están en el
  CMS**, así que no se ven afectadas.

---

## 7. Tipos de colección

### Entry collection (antes *folder collection*)

Contiene múltiples entradas del mismo tipo; cada una es un archivo. Los editores pueden crear/editar/borrar.

```yaml
collections:
  - name: reviews
    label: Reseñas
    label_singular: Reseña       # singular para botones
    folder: content/reviews
    create: true                 # ⚠️ por defecto true (cambio frente a Decap, donde era false)
    delete: true                 # por defecto true
    fields: [...]
```

Opciones destacadas:

- `name` (obligatorio), `label`, `label_singular`, `description`.
- `folder` (obligatorio): carpeta de las entradas.
- `fields` (obligatorio): lista de campos.
- `create: false` / `delete: false` / `duplicate: false` para restringir.
- `limit: N`: máximo de entradas.
- `hide: true`: ocultar del UI.
- `format`, `extension`, `frontmatter_delimiter`: control de formato (sección 10).
- `body_field`: qué campo es el cuerpo y si va inline (sección 10).
- `slug`, `path`, `identifier_field`, `summary`, `thumbnail`, `preview_path`: sección 9.
- `index_file`: gestionar el `_index.md` de Hugo dentro de la misma colección con campos propios.
- `media_folder`/`public_folder`: sección 5.
- `nested`/`meta` (nested collections de Decap): **no implementado aún**.

Formatos por defecto: `yaml-frontmatter` con extensión `md`. El campo `body` (markdown) va al cuerpo del
archivo; el resto al front matter.

### File collection

Contiene archivos predefinidos; **solo se editan, no se crean ni borran**. Útil para configuración, *about*,
homepage.

```yaml
collections:
  - name: pages
    label: Páginas
    files:
      - name: about
        label: Página Acerca de
        file: content/pages/about.md
        fields: [...]
```

Cada `files[]` admite `name`, `label`, `icon`, `file`, `format`, `fields`, `media_folder`/`public_folder`.
No soporta `extension` (la extensión viene en `file`).

Cómo aplica a FrenzyCars: las 7 colecciones (`reviews`, `news`, `guides`, `electric`, `insurance`,
`culture`, `gear`) son **entry collections** (`folder:` + `fields:`). No se gestionan en el CMS las páginas
de mantenimiento (`data/evergreen/*`), que se generan vía Hugo content adapter.

---

## 8. Widgets / tipos de campo

Cada campo tiene `name`, `label` y `widget` (por defecto `string`). Tipos soportados:

| Widget | Uso |
| --- | --- |
| `string` | Texto corto de una línea. |
| `text` | Texto multilínea (textarea). |
| `markdown` | Editor Markdown basado en Lexical. |
| `richtext` | Editor enriquecido (basado en Lexical); salida Markdown. |
| `number` | Numérico. |
| `boolean` | Verdadero/falso (checkbox). |
| `datetime` | Fecha/hora (reemplaza al `date` obsoleto). |
| `select` | Lista de opciones. |
| `list` | Lista de valores u objetos. |
| `object` | Objeto anidado con subcampos. |
| `image` | Selector/subida de imagen. |
| `file` | Selector/subida de archivo. |
| `relation` | Referencia a entradas de otra colección. |
| `map` | Ubicación geográfica (mapa). |
| `keyvalue` | Pares clave-valor dinámicos. |
| `code` | Bloque de código (Lexical/Prism, no CodeMirror). |
| `color` | Selector de color. |
| `compute` | Valor calculado. |
| `hidden` | Campo oculto. |
| `uuid` | UUID generado. |

### string

```yaml
- { name: title, label: Título, widget: string, required: true, hint: "Título SEO" }
```
Opciones: `required`, `default`, `hint`, `pattern`, `prefix`/`suffix`, `multiple`.

### text

```yaml
- { name: description, label: Descripción, widget: text }
```

### number

```yaml
- { name: price, label: Precio, widget: number, value_type: int, min: 0, step: 100, default: 0 }
```
> Nota: `valueType` (camelCase) está deprecado; usar `value_type`.

### boolean

```yaml
- { name: draft, label: Borrador, widget: boolean, default: false }
```

### datetime

```yaml
- name: date
  label: Fecha
  widget: datetime
  format: YYYY-MM-DDTHH:mm:ssZ
  date_format: true      # o false o patrón
  time_format: true      # o false o patrón
  picker_utc: false
```
> `dateFormat`/`timeFormat`/`pickerUtc` (camelCase) deprecados; usar `date_format`/`time_format`/`picker_utc`.
> Usa Day.js (no Moment.js): revisar tokens de formato.

### select

```yaml
- name: category
  widget: select
  options: [suv, sedan, electrico]
  default: sedan
  multiple: false
```

### markdown / richtext

```yaml
- { name: body, label: Cuerpo, widget: markdown, minimal: false, sanitize_preview: true }
```
- `sanitize_preview` por defecto `true` en Sveltia (cambio frente a Decap).
- Los **remark plugins** (`CMS.registerRemarkPlugin`) **no funcionan** (editor Lexical).
- El cuerpo markdown por defecto se guarda fuera del front matter (sección 10).

### image / file

```yaml
- name: cover
  widget: image
  required: true
  media_folder: /static/images/uploads/covers
  public_folder: /images/uploads/covers
  multiple: false
```
- `allow_multiple` (Decap) **no soportado**; usar `multiple`.
- Se puede desactivar el almacenamiento interno del campo con `media_libraries: { default: false }`.

### list

Dos modos:

**`fields` (plural) → lista de objetos:**
```yaml
- name: authors
  widget: list
  fields:
    - { name: name, widget: string }
    - { name: role, widget: string }
```
Salida:
```yaml
authors:
  - name: Ana
    role: Editora
```

**`field` (singular) → lista de valores simples:**
```yaml
- name: tags
  widget: list
  field: { name: tag, widget: string }
```
Salida:
```yaml
tags:
  - electrico
  - suv
```

**`root: true`** → lista top-level sin nombre de campo (no válido en TOML).

### object

```yaml
- name: hero
  widget: object
  fields:
    - { name: title, widget: string }
    - { name: image, widget: image }
```

### relation

```yaml
- name: author
  widget: relation
  collection: authors
  value_field: slug
  search_fields: [name]
  display_fields: [name]        # snake_case
```
> `displayFields`/`searchFields`/`valueField` (camelCase) deprecados.

Cómo aplica a FrenzyCars: las colecciones usan `string` (título, slug, SEO), `datetime` (fecha), `boolean`
(draft), `list` (tags), `text` (descripción), `image` (portada), `number` (datos técnicos), `markdown` (cuerpo).

---

## 9. Slugs, rutas, resúmenes y previews

### Slug global (opciones)

```yaml
slug:
  encoding: unicode        # o ascii
  clean_accents: false     # true: é→e
  sanitize_replacement: '-'
  maxlength: 80
  trim: true
  lowercase: true
  timezone: utc            # o local
```

### Slug de colección

```yaml
slug: '{{year}}-{{month}}-{{slug}}'
identifier_field: title    # campo base del slug (por defecto title)
```

Etiquetas disponibles: `{{slug}}`, `{{year}}`, `{{month}}`, `{{day}}`, `{{hour}}`, `{{minute}}`,
`{{second}}`, `{{uuid}}`, `{{uuid_short}}`, `{{uuid_shorter}}`, además de cualquier nombre de campo
(`{{fields.slug}}` para un campo llamado `slug`). Soporta transformaciones (`{{date | date('YYYY-MM-DD')}}`).
El `slug` **no puede contener `/`**.

### path (subcarpetas / bundles)

```yaml
path: '{{year}}/{{month}}/{{slug}}'   # subcarpetas
path: '{{slug}}/index'                # leaf bundle Hugo
```

### summary (listado)

```yaml
summary: "{{title}} — {{date | date('DD MMM YYYY')}} {{published | ternary('', '(borrador)')}}"
```

### thumbnail

```yaml
thumbnail: featuredImage        # o [thumb, cover] o false
```

### preview_path

```yaml
preview_path: '/blog/{{year}}/{{month}}/{{slug}}'
preview_path_date_field: created_at
```

Cómo aplica a FrenzyCars: para limpiar acentos en slugs (acentos del español), activar `clean_accents: true`.
Un `path: '{{slug}}/index'` convierte una colección en leaf bundles (sección 6).

---

## 10. Mapeo de front matter

Por defecto: formato `yaml-frontmatter`, extensión `md`. Los campos se guardan como pares `clave: valor`
**en el orden definido en `fields`**. El campo llamado `body` (tipo markdown/richtext) se coloca **fuera** del
front matter como cuerpo del archivo:

```yaml
---
title: Mi reseña
date: 2025-06-24T12:00:00Z
draft: false
tags:
  - electrico
---
Cuerpo del artículo aquí.
```

Si solo existe `body`, se omite el bloque de front matter.

### `body_field` personalizado

Renombrar el cuerpo:
```yaml
body_field:
  key: content
```
Guardar el cuerpo dentro del front matter (inline):
```yaml
body_field:
  inline: true
```
Salida:
```yaml
---
title: Mi post
body: Texto del cuerpo
---
```

### Otros formatos

`format`: `yaml-frontmatter` (defecto), `toml-frontmatter` (`+++`), `json-frontmatter` (`{ }`),
`frontmatter` (autodetección), `yml`/`yaml`, `toml`, `json`, `raw` (texto plano, solo un campo `body`).
`extension` (p. ej. `markdown`) y `frontmatter_delimiter` (p. ej. `~~~`).

### Convenciones de salida

- Saltos de línea LF (`\n`) y nueva línea final.
- Fecha estándar `HH:mm:ss`.
- **Sveltia NO omite campos opcionales vacíos** por defecto (diferente a Decap). Para omitirlos:
  ```yaml
  output:
    omit_empty_optional_fields: true
    encode_file_path: false
    json: { indent_style: space, indent_size: 2 }
    yaml: { quote: none, indent_size: 2, indent_sequences: true }
  ```
- Markdown de Lexical: listas anidadas a 4 espacios, guiones `-` para listas, `**` negrita, `_` cursiva,
  `***` reglas horizontales, saltos de línea *suaves* (soft breaks).

Cómo aplica a FrenzyCars: el cuerpo de los artículos es el campo `markdown` llamado `body`; el resto de
metadatos va al front matter YAML. Si Hugo valida tipos estrictos y aparecen campos vacíos `""`, activar
`omit_empty_optional_fields: true`.

---

## 11. Modo desarrollo local

Sveltia sustituye el flujo de proxy de Decap (`decap-server`, `local_backend`) por uno nativo basado en la
**File System Access API**.

Requisitos:

- Navegador **basado en Chromium** (Chrome, Edge, Brave). **No** funciona en Firefox/Safari.
- Repositorio Git local (`git init` o clon) con carpeta `.git`.
- Servidor de desarrollo del framework corriendo (`hugo server`, puerto por defecto 1313).

Flujo:

1. `hugo server`.
2. Abrir `http://localhost:1313/admin/index.html`.
3. Pulsar **«Work with Local Repository»** y seleccionar la carpeta raíz del proyecto.
4. Editar: los cambios se escriben directamente en los archivos locales.
5. Previsualizar en `http://localhost:1313/`.
6. Hacer commit/push con cualquier cliente Git.

Limitaciones: Sveltia **no hace operaciones Git** (no fetch/pull/commit/push); hay que hacerlo manualmente y
recargar el CMS tras cambios en `config.yml` o tras actualizar el remoto.

> `local_backend: true` en `config.yml` se **ignora**. No hace falta `decap-server`.

Cómo aplica a FrenzyCars: para editar contenido localmente sin tocar GitHub, ejecutar `hugo server` y usar
«Work with Local Repository» en Chrome/Edge.

---

## 12. Características de Decap NO soportadas

### No implementadas aún (previstas antes de 1.0)

- **Editorial workflow** (estados *draft/review/ready*).
- **Open authoring** (autores externos con forks).
- **Nested collections** (`nested`/`meta`).
- **Custom preview templates** (`CMS.registerPreviewTemplate`).
- **Custom field types** (`CMS.registerWidget`).
- **Localización de la UI** (Sveltia autodetecta idioma; `locale` e `registerLocale` no funcionan).
- Validación exhaustiva de configuración.

### No se implementarán

- **Git Gateway** backend (deprecado por Netlify).
- **Netlify Identity Widget**.
- Implicit grant obsoleto de GitLab; Netlify Large Media deprecado.
- Opciones camelCase deprecadas (`sortableFields`, `dateFormat`, `editorComponents`, `valueType`,
  `displayFields`, `searchFields`, `valueField`). Usar snake_case.
- Widget `date` obsoleto → usar `datetime` con `type: date`.
- **Backends Azure DevOps y Bitbucket** (por rendimiento de su API).
- Plugin de **Gatsby**.
- Opciones de rendimiento irrelevantes: `search` global, `use_graphql` del backend, `options_length` de
  Relation (GraphQL ya está activo por defecto).
- **URL absoluta en `public_folder`**.
- `allow_multiple` de Image/File → usar `multiple`.
- **Remark plugins** del editor markdown (`registerRemarkPlugin` no-op).
- **Proxy local** (`netlify-cms-proxy-server`/`decap-server`) y `local_backend`.
- **PKCE client-side para GitHub** (a la espera de GitHub).

### Cambios de comportamiento notables

- `create` por defecto `true` en entry collections (en Decap era `false`).
- Los campos **obligatorios** se marcan (Decap marcaba los opcionales).
- Sveltia **no slugifica** los nombres de archivo subidos salvo `slugify_filename: true`.
- No omite campos vacíos opcionales por defecto (`omit_empty_optional_fields`).
- Markdown con soft breaks.
- `sanitize_preview: true` por defecto.
- Requiere **contexto seguro** (HTTPS o localhost/127.0.0.1).

---

## 13. Apéndice: aplicación a FrenzyCars

Configuración mínima recomendada para `static/admin/config.yml`:

```yaml
# yaml-language-server: $schema=https://unpkg.com/@sveltia/cms/schema/sveltia-cms.json
backend:
  name: github
  repo: rpgseo/frenzycars
  branch: main
# site_url: https://frenzycars.example.com
media_folder: static/images/uploads
public_folder: /images/uploads
slug:
  encoding: unicode
  clean_accents: true        # normaliza acentos del español en los slugs
  sanitize_replacement: '-'
  lowercase: true
media_libraries:
  default:
    config:
      slugify_filename: true
      transformations:
        raster_image: { format: webp, quality: 85, width: 2048 }
output:
  omit_empty_optional_fields: true   # evita claves vacías que rompan validaciones de Hugo
collections:
  - name: reviews
    label: Reseñas
    folder: content/reviews
    create: true
    fields:
      - { name: title, label: Título, widget: string }
      - { name: date, label: Fecha, widget: datetime }
      - { name: draft, label: Borrador, widget: boolean, default: false }
      - { name: tags, label: Tags, widget: list, field: { name: tag, widget: string } }
      - { name: cover, label: Portada, widget: image }
      - { name: summary, label: Resumen, widget: text }
      - { name: body, label: Cuerpo, widget: markdown }
  # ... news, guides, electric, insurance, culture, gear con la misma estructura
```

### Páginas de mantenimiento (fuera del CMS)

Las páginas evergreen se generan desde `data/evergreen/*.yaml` mediante el *content adapter*
`_content.gotmpl`. Por diseño **no son colecciones de Sveltia**: no aparecen en el CMS y no requieren
configuración. Si en el futuro se quisieran editarlas, habría que crear una **file collection** apuntando a
esos archivos YAML.

### Decisión sobre leaf bundles

Sveltia **sí** soporta imágenes colocadas (Hugo leaf bundles) vía `path: '{{slug}}/index'` +
`media_folder: ''` + `public_folder: ''`. **No es obligatorio migrar**: el modelo global
`static/images/uploads` funciona tal cual. La migración es opcional y **por colección**.
