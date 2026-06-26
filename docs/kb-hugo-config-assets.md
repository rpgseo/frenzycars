# Base de Conocimiento — Hugo: Configuración, Assets, Pipeline (Pipes) y CLI

> Referencia técnica consolidada para el proyecto **FrenzyCars** (sitio Hugo de noticias y reseñas de coches) desplegado en **Cloudflare Pages** (`frenzycars.pages.dev`).
> Prosa en español; código/configuración en inglés.
> Fuentes: documentación oficial de Hugo (gohugo.io), build v0.163.3.

---

## Tabla de contenidos

1. [Conceptos y estado actual de FrenzyCars](#1-conceptos-y-estado-actual-de-frenzycars)
2. [Instalación y entornos](#2-instalación-y-entornos)
3. [Estructura de directorios](#3-estructura-de-directorios)
4. [Configuración: `hugo.toml` y opciones globales](#4-configuración-hugotoml-y-opciones-globales)
5. [`[params]`, `[[menu.main]]`, `[pagination]`](#5-params-menumain-pagination)
6. [Configuración de Markup (Goldmark, highlight, ToC)](#6-configuración-de-markup-goldmark-highlight-toc)
7. [`[minify]`, `[server]`, `[build]`](#7-minify-server-build)
8. [Módulos Hugo (`[module]`, mounts, imports)](#8-módulos-hugo-module-mounts-imports)
9. [Hugo Pipes — Asset Pipeline](#9-hugo-pipes--asset-pipeline)
10. [Procesamiento de imágenes](#10-procesamiento-de-imágenes)
11. [Métodos del objeto `Resource`](#11-métodos-del-objeto-resource)
12. [CLI: comandos y flags](#12-cli-comandos-y-flags)
13. [Despliegue en Cloudflare Pages](#13-despliegue-en-cloudflare-pages)
14. [Recetas de migración para FrenzyCars](#14-recetas-de-migración-para-frenzycars)
15. [Tabla maestra de flags y opciones](#15-tabla-maestra-de-flags-y-opciones)

---

## 1. Conceptos y estado actual de FrenzyCars

FrenzyCars usa un único `hugo.toml` en la raíz del proyecto con secciones `[params]`, `[[menu.main]]` y `[pagination]`. Los recursos estáticos viven en `static/` y el CSS principal en `static/css/style.css`. Las imágenes de portada se **hotlinkean desde Unsplash** dentro del front matter, y existen imágenes locales en `static/images/advice/` y `static/images/uploads/`.

**Objetivo de esta KB:** migrar hacia el **asset pipeline de Hugo (Hugo Pipes)** para CSS/JS e implantar el **procesamiento de imágenes** (redimensionado, conversión a WebP, fingerprinting).

| Concepto | Significado |
|---|---|
| **global resource** | Archivo en el directorio `assets/` (o montado a `assets`). Se procesa con Pipes. |
| **page resource** | Archivo dentro de un *page bundle* (directorio de contenido). Ámbito de página. |
| **remote resource** | Archivo en un servidor remoto vía HTTP/HTTPS (`resources.GetRemote`). |
| **asset pipeline** | Cadena de funciones (Pipes) que transforman un recurso: Sass→CSS, minify, fingerprint, etc. |
| **processable image** | Imagen de la que Hugo puede extraer dimensiones y transformar (JPEG, PNG, WebP, GIF, AVIF, TIFF, BMP). SVG/ICO/HEIC **no** son procesables. |

---

## 2. Instalación y entornos

Hugo se instala por plataforma (macOS, Linux, Windows, BSD). Verifica con:

```bash
hugo version      # comprueba la instalación
hugo env          # versión + info de entorno
hugo help         # lista de comandos y flags
hugo server --help # ayuda de un subcomando
```

Hugo distingue **ediciones**: la estándar y la *extended*. **Nota importante (v0.153.0+):** la codificación WebP y Dart Sass ya funcionan en todas las ediciones; el chequeo de versión "extended" está desactivado. Se recomienda **Dart Sass** (no LibSass, que está deprecado) para compatibilidad entre ediciones.

**Cuándo usarlo en FrenzyCars:** Cloudflare Pages ejecuta el build en Linux. Fija `HUGO_VERSION` en las variables de entorno del proyecto (ver §13). Para desarrollo local en Windows, instala la edición extendida mediante `scoop install hugo-extended` o el binario oficial.

---

## 3. Estructura de directorios

Hugo genera un esqueleto al crear un proyecto (`hugo new project mi-proyecto`). Estructura típica:

```
mi-proyecto/
├── archetypes/        # plantillas para contenido nuevo
│   └── default.md
├── assets/            # recursos globales para el pipeline (CSS, JS, Sass, imágenes)
├── content/           # archivos de contenido (Markdown) + page resources
├── data/              # ficheros de datos (JSON, TOML, YAML, XML)
├── i18n/              # tablas de traducción (multilingüe)
├── layouts/           # plantillas (templates)
├── static/            # archivos copiados tal cual a public/
├── themes/            # temas
├── hugo.toml          # configuración del proyecto
├── public/            # (generado al compilar) sitio publicado
└── resources/         # (generado al compilar) caché del pipeline (CSS, imágenes)
```

| Directorio | Rol |
|---|---|
| `archetypes` | Plantillas para `hugo new`. |
| `assets` | Recursos para Pipes: CSS, Sass, JS/TS, imágenes. **Procesables.** |
| `config` | Alternativa: configuración dividida en subdirectorios (`config/_default/`, `config/production/`). |
| `content` | Markdown y page bundles. |
| `data` | Datos auxiliares accesibles vía `.Site.Data`. |
| `i18n` | Traducciones. |
| `layouts` | Templates que transforman contenido en HTML. |
| `public` | Salida del build (lo que se despliega). **No versionar.** |
| `resources` | Caché de salida del pipeline. Regenerable. |
| `static` | Copiado literalmente a `public` (favicon, robots.txt, verificaciones). |
| `themes` | Temas, cada uno en su subdirectorio. |

**Sistema de ficheros unificado:** Hugo *monta* los directorios del proyecto y de los temas/módulos en una vista unificada. Ante colisiones de ruta, gana el del nivel superior (proyecto > tema). Puedes montar directorios externos a `archetypes`, `assets`, `content`, `data`, `i18n`, `layouts` y `static` (ver §8).

**Cuándo usarlo en FrenzyCars:**
- **Migrar** `static/css/style.css` → `assets/css/style.css` (o `assets/sass/main.scss`) para que entre en el pipeline.
- Crear `assets/js/` para scripts que se procesen con `js.Build`.
- Las imágenes locales actuales (`static/images/advice/`, `static/images/uploads/`) pueden: (a) quedarse en `static` si se publican sin transformar, o (b) moverse a `assets/images/` (o a page bundles) para procesarlas (resize/WebP).
- Añadir `resources/_gen/` al `.gitignore` (es caché regenerable); alternativamente commitear `resources/_gen/images` para acelerar builds en CI.

---

## 4. Configuración: `hugo.toml` y opciones globales

La configuración puede ser un único `hugo.toml` en la raíz, o un directorio `config/` con override por entorno. Formatos soportados: TOML (por defecto), YAML, JSON. Una clave de config puede sobreescribirse con **variables de entorno** `HUGO_<SECCIÓN>_<CLAVE>` (en mayúsculas) o con el flag `--config`.

### Opciones de nivel superior (selección relevante)

| Opción | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `baseURL` | string | — | URL absoluta raíz (protocolo+host+ruta con `/` final). |
| `title` | string | — | Título del sitio. |
| `copyright` | string | — | Aviso de copyright (footer). |
| `languageCode` | string | — | **Deprecado v0.158.0**, usar `locale`. |
| `locale` | string | — | Tag RFC 5646; usado para traducciones y localización de fechas/números. |
| `theme` | string\|[]string | — | Tema(s); precedencia izquierda→derecha. |
| `themesDir` | string | `themes` | Directorio de temas. |
| `publishDir` | string | `public` | Directorio de salida. |
| `resourceDir` | string | `resources` | Caché de salida del pipeline. |
| `assetDir` | string | `assets` | Directorio de recursos globales. |
| `staticDir` | string | `static` | Directorio estático. |
| `contentDir` / `dataDir` / `layoutDir` / `archetypeDir` / `i18nDir` | string | `content`/`data`/... | Directorios de componentes. Si defines `mounts`, no uses estos. |
| `buildDrafts` | bool | `false` | Incluir borradores. |
| `buildExpired` | bool | `false` | Incluir contenido expirado. |
| `buildFuture` | bool | `false` | Incluir contenido futuro. |
| `enableRobotsTXT` | bool | `false` | Generar `robots.txt`. |
| `enableGitInfo` | bool | `false` | Metadatos de commits Git; activa `GitInfo`/`Lastmod`. |
| `enableEmoji` | bool | `false` | Emojis en Markdown. |
| `summaryLength` | int | `70` | Mín. palabras en resúmenes automáticos. |
| `paginate` | int | `10` | (vía `[pagination]`) Entradas por página. |
| `mainSections` | string\|[]string | — | Secciones principales (para la home/listados). |
| `timeout` | duration | `60s` | Timeout de generación de página; súbelo si hay mucho procesado de imágenes. |
| `timeZone` | string | — | Zona horaria (p. ej. `Europe/Madrid`). |
| `titleCaseStyle` | string | `ap` | `ap`\|`chicago`\|`go`\|`firstupper`\|`none`. |
| `cleanDestinationDir` | bool | `false` | Borrar de `public` lo que no exista en `static`. |
| `canonifyURLs` / `relativeURLs` | bool | `false` | Ver docs de URLs antes de activar. |
| `removePathAccents` | bool | `false` | Quitar acentos en rutas. |
| `disableKinds` | []string | — | Desactivar kinds: `404`,`home`,`page`,`robotstxt`,`rss`,`section`,`sitemap`,`taxonomy`,`term`. |
| `ignoreLogs` | []string | — | Suprimir warnings/errores por identificador (`erroridf`/`warnidf`). |
| `noBuildLock` | bool | `false` | No crear `.hugo_build.lock`. |
| `noChmod` / `noTimes` | bool | `false` | No sincronizar permisos/fechas. |

> **Directorio de caché:** configurable con `cacheDir` o `HUGO_CACHEDIR`. Por defecto: `$XDG_CACHE_HOME/hugo_cache` (Unix), `%LocalAppData%/hugo_cache` (Windows). Comprueba con `hugo config | grep cachedir`.

**Cuándo usarlo en FrenzyCars:** define `baseURL = "https://frenzycars.pages.dev/"`, `title`, `enableRobotsTXT = true`, `timeZone = "Europe/Madrid"`, y `mainSections = ["news","reviews"]` para que la home liste tus reseñas.

---

## 5. `[params]`, `[[menu.main]]`, `[pagination]`

### `[params]`
Contenedor libre de variables de sitio accesibles en plantillas como `.Site.Params.<clave>`. Ejemplo FrenzyCars:

```toml
[params]
  description = "Noticias y reseñas de coches"
  author = "Equipo FrenzyCars"
  defaultCover = "/images/default-cover.jpg"
  ogImage = "/images/og-default.png"
```

### `[[menu.main]]`
Define menús. Cada entrada admite `name`, `url`, `weight`, `identifier`, `pre`/`post` (HTML), `params`.

```toml
[[menu.main]]
  name = "Reseñas"
  url = "/reviews/"
  weight = 1

[[menu.main]]
  name = "Noticias"
  url = "/news/"
  weight = 2

[[menu.main]]
  name = "Consejos"
  url = "/advice/"
  weight = 3
```

> `sectionPagesMenu` (nivel raíz): si se define, cada sección de primer nivel se añade automáticamente al menú indicado.

### `[pagination]`
Reemplaza al antiguo `paginate` de nivel superior.

```toml
[pagination]
  disableAliases = false
  pagerSize = 12
  path = 'page'
```

| Clave | Por defecto | Descripción |
|---|---|---|
| `pagerSize` | `10` | Entradas por página (antes `paginate`). |
| `path` | `page` | Segmento de URL de paginación. |
| `disableAliases` | `false` | No crear redirecciones de alias para páginas paginadas. |

**Cuándo usarlo en FrenzyCars:** con `pagerSize = 12` (3×4 grid de cards de coches) y `mainSections` alineado con tus secciones `news`/`reviews`.

---

## 6. Configuración de Markup (Goldmark, highlight, ToC)

Por defecto Hugo usa **Goldmark**. Sección `[markup]`:

```toml
[markup]
  defaultMarkdownHandler = 'goldmark'

  [markup.goldmark]
    duplicateResourceFiles = false
    [markup.goldmark.extensions]
      definitionList = true
      linkify = true
      linkifyProtocol = 'https'
      strikethrough = true
      table = true
      taskList = true
      [markup.goldmark.extensions.typographer]
        disable = false
    [markup.goldmark.parser]
      autoHeadingID = true
      autoIDType = 'github'
      wrapStandAloneImageWithinParagraph = true
      [markup.goldmark.parser.attribute]
        block = false
        title = true
    [markup.goldmark.renderHooks]
      [markup.goldmark.renderHooks.image]
        useEmbedded = 'auto'
      [markup.goldmark.renderHooks.link]
        useEmbedded = 'auto'
    [markup.goldmark.renderer]
      hardWraps = false
      unsafe = false
      xhtml = false

  [markup.highlight]
    anchorLineNos = false
    codeFences = true
    guessSyntax = false
    lineNos = false
    lineNoStart = 1
    lineNumbersInTable = true
    noClasses = true
    style = 'monokai'
    tabWidth = 4
    wrapperClass = 'highlight'

  [markup.tableOfContents]
    startLevel = 2
    endLevel = 3
    ordered = false
```

Claves destacadas:
- `defaultMarkdownHandler`: `goldmark` (default), `asciidocext`, `org`, `pandoc`, `rst`.
- `renderer.unsafe`: si `true`, renderiza HTML crudo embebido en Markdown (necesario para shortcodes/HTML en contenido).
- `parser.attribute.block`: atributos Markdown en bloques (default `false`); `title` en headings (default `true`).
- `highlight.style`: tema Chroma (`monokai`, `dracula`, `github`, ...). Genera CSS con `hugo gen chromastyles --style=monokai > assets/css/syntax.css`.
- `highlight.noClasses = false` → usa CSS externo en vez de estilos inline.
- `tableOfContents.startLevel`/`endLevel`: rango de headings en el ToC.

**Cuándo usarlo en FrenzyCars:** activa `renderer.unsafe = true` si embebes HTML en tus reseñas; fija `highlight.style` coherente con tu paleta; deja el ToC en h2–h3 para reseñas largas.

---

## 7. `[minify]`, `[server]`, `[build]`

### `[minify]`
Controla la minificación por tipo de medio cuando se activa (`--minify` o pipeline). Sub-claves: `minifyOutputFormats`, y por tipo: `minifyHTML`, `minifyCSS`, `minifyJS`, `minifyJSON`, `minifySVG`, `minifyXML` con opciones de configuración del minifier (p. ej. `keepComments`, `precision` para CSS).

```toml
[minify]
  minifyOutputFormats = ['html', 'css', 'js', 'json', 'xml', 'svg']
```

### `[server]`
Configuración del servidor de desarrollo (`hugo server`).

```toml
[server]
  [[server.headers]]
    for = '/**'
    [server.headers.values]
      X-Frame-Options = 'DENY'
      Referrer-Policy = 'strict-origin-when-cross-origin'
  [[server.redirects]]
    from = '/old/**'
    to = '/new/:splat'
    status = 301
```

### `[build]`
Opciones del proceso de build.

```toml
[build]
  [build.buildStats]
    enable = false      # escribe stats de assets (class/id) para purge CSS
  [[build.cacheBusters]]
    source = 'assets/watching/hugo_stats\.json'
    target = 'css'
  useResourceCacheWhen = 'always'   # fallback si falta una herramienta externa
  noJSConfigInAssets = false
```

**Cuándo usarlo en FrenzyCars:**
- `--minify` en el comando de build de Cloudflare para reducir HTML/CSS/JS.
- `[build.buildStats]` + `cacheBusters` si adoptas una solución de purge CSS basada en clases detectadas.
- `[server]` para simular redirects/headers durante el desarrollo.

---

## 8. Módulos Hugo (`[module]`, mounts, imports)

Los módulos Hugo son **Go modules** (requieren Go ≥1.18 y Git). Útiles para compartir plantillas/shortcodes/assets entre proyectos o consumir temas desde un repo.

### Settings de nivel superior

| Clave | Default | Descripción |
|---|---|---|
| `proxy` | `direct` | Servidor proxy para descargar módulos remotos. |
| `private` | `*.*` | Globs de rutas tratadas como privadas. |
| `noProxy` | `none` | Globs que no usan el proxy. |
| `noVendor` | — | Glob de rutas a omitir al vendar. |
| `vendorClosest` | `false` | Tomar el módulo vendored más cercano. |
| `workspace` | `off` | Archivo Go workspace (absoluto o relativo). |
| `replacements` | — | `ruta -> dir` para desarrollo local. |
| `auth` | — | Configura `GOAUTH` para repos privados (v0.144+). |

Variables de entorno equivalentes: `HUGO_MODULE_PROXY`, `HUGO_MODULE_REPLACEMENTS`, `HUGO_MODULE_WORKSPACE`.

### Versión requerida

```toml
[module]
  [module.hugoVersion]
    min = '0.130.0'
    max = ''
    extended = false   # deprecado v0.153.0 (check desactivado)
```

### Imports

```toml
[module]
  [[module.imports]]
    path = 'github.com/usuario/mi-tema'
    disable = false
    ignoreConfig = false
    ignoreImports = false
    noMounts = false
    noVendor = false
```

### Mounts
Un *mount* mapea `source` (ruta de fichero) a `target` (ruta dentro del sistema unificado). **Definir un mount elimina el mount por defecto de ese componente**, así que redeclara los que necesites.

```toml
[module]
  [[module.mounts]]
    source = 'content'
    target = 'content'
  [[module.mounts]]
    source = 'node_modules'      # expone paquetes npm al pipeline
    target = 'assets'
  [[module.mounts]]
    source = 'assets'
    target = 'assets'
```

- `source`: ruta del proyecto (puede ser absoluta en el proyecto principal).
- `target`: debe empezar por un componente: `archetypes`, `assets`, `content`, `data`, `i18n`, `layouts`, `static`.
- `files`: globs de inclusión/exclusión, p. ej. `['! docs/*']` (reemplaza a `includeFiles`/`excludeFiles`).
- `disableWatch`: desactivar watch para ese mount.

**Cuándo usarlo en FrenzyCars:** inicialmente **no** necesitas módulos (sitio monolítico). Útil más adelante si extraes shortcodes a un repo compartido, o si montas `node_modules` hacia `assets` para usar paquetes JS con `js.Build`.

---

## 9. Hugo Pipes — Asset Pipeline

Hugo Pipes es el conjunto de funciones de procesamiento de assets. Los recursos deben recuperarse como objetos `Resource` antes de procesarse.

### assets vs static

| | `static/` | `assets/` |
|---|---|---|
| Publicación | Copiado literal a `public/` | Publicado **bajo demanda** al invocar `.Permalink`/`.RelPermalink`/`.Publish` |
| Procesable con Pipes | **No** | **Sí** |
| Caso de uso | favicon, robots.txt, archivos sin transformar | CSS, Sass, JS/TS, imágenes a transformar |

### Obtener un recurso

```go-html-template
{{/* global: en assets/ */}}
{{ $css := resources.Get "css/style.css" }}
{{ $scss := resources.Get "sass/main.scss" }}
{{ $img := resources.Get "images/cover.jpg" }}

{{/* remoto (HTTP/HTTPS) */}}
{{ $remote := resources.GetRemote "https://..." }}

{{/* page resource: dentro de un page bundle */}}
{{ $pageImg := .Resources.Get "cover.jpg" }}

{{/* helpers de búsqueda global */}}
{{ resources.Match "images/*.jpg" }}      // todos los .jpg
{{ resources.GetMatch "images/hero*" }}   // primero que coincida
{{ resources.ByType "image" }}            // por media type
```

### Go Pipes (cadenas)

Se recomienda encadenar con `|` para legibilidad. La cadena entera se cachea (se ejecuta solo la primera vez por build):

```go-html-template
{{ $style := resources.Get "sass/main.scss" | css.Sass | resources.Minify | resources.Fingerprint }}
<link rel="stylesheet" href="{{ $style.Permalink }}">
```

### CSS: Sass → CSS (`css.Sass` / `css.Scss`)

```go-html-template
{{ $opts := dict "transpiler" "dartsass" "targetPath" "css/main.css" "vars" ($sassVars) }}
{{ $css := resources.Get "sass/main.scss" | css.Sass $opts }}
```

- `transpiler`: `dartsass` (recomendado) o `libsass` (deprecado). Dart Sass requiere el binario `dart-sass-embedded`; en CI instálalo o usa `npx dart-sass-embedded`.
- `targetPath`: ruta de salida en `public/`.
- `outputStyle`: `expanded` o `compressed`.
- `vars`: variables Sass inyectadas desde Hugo.

### CSS: PostCSS (`css.PostCSS`)

Requiere PostCSS y plugins instalados vía npm (`postcss`, `autoprefixer`, etc.) con un `postcss.config.js` en la raíz.

```go-html-template
{{ $opts := dict "config" "postcss.config.js" "noMap": true }}
{{ $css := resources.Get "css/style.css" | css.PostCSS $opts }}
```

- Sin `config`, busca `postcss.config.js`.
- `noMap`: omite source maps.
- En CI: ejecuta `npm install` (o `hugo mod npm pack` + `npm install`) antes del build.
- Alternativa sin Node: `resources.PostCSS` con config embebida vía `map`.

### JavaScript: `js.Build` (esbuild)

```go-html-template
{{ $opts := dict
   "targetPath" "js/main.js"
   "targets"    "esnext"
   "sourceMap"  "inline"
   "externals"  (slice "react" "react-dom")
   "defines"    (dict "process.env.NODE_ENV" "\"production\"")
}}
{{ $js := resources.Get "js/main.js" | js.Build $opts }}
```

Opciones destacadas: `targetPath`, `targets`/`target` (p. ej. `es2020`), `sourceMap` (`none`/`inline`/`external`), `minify`, `loaders`, `externals`, `defines`, `pure`/`drop` (tree-shaking de `console`/`debugger`).

### Minificación (`resources.Minify`)

```go-html-template
{{ $cssMin := resources.Get "css/style.css" | resources.Minify }}
```

Minifica según el media type del recurso (CSS, JS, HTML, JSON, SVG, XML).

### Bundling / Concatenación (`resources.Concat`)

```go-html-template
{{ $bundle := slice
     (resources.Get "css/base.css")
     (resources.Get "css/layout.css")
     (resources.Get "css/components.css")
   | resources.Concat "css/bundle.css" }}
```

- El argumento es la **ruta destino** (dentro de `assets`/publicación).
- Suele encadenarse con `| minify | fingerprint`.

### Fingerprinting e integridad SRI (`resources.Fingerprint`)

```go-html-template
{{ $hashed := resources.Get "js/app.js" | js.Build | minify | resources.Fingerprint "sha512" }}
<script src="{{ $hashed.Permalink }}" integrity="{{ $hashed.Data.Integrity }}" crossorigin="anonymous"></script>
```

- Argumento: algoritmo (`sha256` [default], `sha384`, `sha512`).
- Añade el hash al nombre del fichero → **cache-busting**.
- `.Data.Integrity` genera el atributo SRI para `<script integrity>`/`<link integrity>`.

### Crear recurso desde string (`resources.FromString`)

Útil para generar CSS/JS dinámico desde plantillas:

```go-html-template
{{ $css := printf ":root{ --brand: %s; }" .Site.Params.brandColor }}
{{ $r := resources.FromString "css/dynamic.css" $css | minify | fingerprint }}
```

### Otras utilidades

- `resources.Copy`: copia/renombra un recurso cambiando su ruta de publicación.
- `resources.ToCSS`: alias histórico de `css.Sass`/`css.Scss`.
- `resources.PostProcess`: posprocesamiento tras el render (p. ej., para resolver class names tras el render HTML completo).

### Publicación
Un recurso del pipeline se publica al invocar `.Permalink`/`.RelPermalink`/`.Publish`. Con `.Content` se inlinea (p. ej., CSS crítico embebido en `<style>`).

**Cuándo usarlo en FrenzyCars (plan de migración):**
1. Mueve `static/css/style.css` → `assets/css/style.css`.
2. En `layouts/partials/head.html`, sustituye el `<link>` estático por:
   ```go-html-template
   {{ $css := resources.Get "css/style.css" | minify | fingerprint }}
   <link rel="stylesheet" href="{{ $css.RelPermalink }}" integrity="{{ $css.Data.Integrity }}" crossorigin="anonymous">
   ```
3. Si migras a Sass, renombra a `assets/sass/main.scss` y usa `css.Sass`.
4. Para JS, mueve scripts a `assets/js/` y procesa con `js.Build | minify | fingerprint`.

---

## 10. Procesamiento de imágenes

Hugo transforma imágenes durante el build (el resultado se cachea). Solo las **imágenes procesables** (JPEG, PNG, WebP, GIF, AVIF, TIFF, BMP) pueden transformarse. SVG/ICO/HEIC/HEIF son imágenes pero **no procesables**.

| Formato | ¿Imagen? | ¿Procesable? | ¿Metadatos (Exif/IPTC/XMP)? |
|---|---|---|---|
| AVIF | sí | sí | sí |
| BMP | sí | sí | sí |
| GIF | sí | sí | sí |
| HEIC | sí | **no** | sí |
| HEIF | sí | **no** | sí |
| ICO | sí | **no** | **no** |
| JPEG | sí | sí | sí |
| PNG | sí | sí | sí |
| SVG | sí | **no** | **no** |
| TIFF | sí | sí | sí |
| WebP | sí | sí | sí |

Comprobaciones previas (funciones `reflect.*`):
- `reflect.IsImageResource .` — ¿es imagen?
- `reflect.IsImageResourceProcessable .` — ¿se puede transformar?
- `reflect.IsImageResourceWithMeta .` — ¿tiene metadatos?

### Capturar la imagen

```go-html-template
{{/* page resource (page bundle) */}}
{{ $img := .Resources.Get "cover.jpg" }}
{{/* global resource */}}
{{ $img := resources.Get "images/cover.jpg" }}
{{/* remote */}}
{{ $img := resources.GetRemote "https://..." }}
```

### Métodos de transformación

| Método | Comportamiento |
|---|---|
| `.Resize "SPEC"` | Redimensiona. No recorta. |
| `.Fit "SPEC"` | Redimensiona reduciendo para caber dentro del box, manteniendo aspecto (sin recortar). |
| `.Fill "SPEC"` | Recorta y redimensiona para **llenar** exactamente el box (puede recortar). |
| `.Crop "SPEC"` | Recorta (sin redimensionar, salvo que se indique ancho/alto). |
| `.Process "SPEC"` | **Unificado**: cualquier combinación de operaciones en una sola cadena (recomendado). |
| `.Filter ...` | Aplica filtros (blur, grayscale, etc.). |

### Especificación (SPEC) — matriz completa de opciones

La `SPEC` es una cadena con opciones separadas por espacios. **Orden recomendado:** acción → dimensiones → opciones.

| Opción | Sintaxis | Descripción |
|---|---|---|
| **Acción** | `resize` \| `fit` \| `fill` \| `crop` | En `.Process` se incluye la acción; en `.Resize/.Fit/...` no. |
| **Ancho** | `Wx` o `WxH` | p. ej. `800x`, `800x600`. |
| **Alto** | `xH` | p. ej. `x400`. |
| **Calidad** | `q NN` | 1–100 (p. ej. `q 75`). Solo JPEG/WebP. |
| **Formato** | `webp` \| `jpeg` \| `png` \| `gif` \| `tiff` \| `bmp` | Conversión de formato. |
| **Ancla (recorte)** | `Center` \| `Top` \| `Bottom` \| `Left` \| `Right` \| `TopLeft` \| `TopRight` \| `BottomLeft` \| `BottomRight` | Punto de ancla al recortar (`Crop`/`Fill`). |
| **Fondo** | `bg #RRGGBB` o `bg "#ffffff"` | Color de fondo (para PNG→JPEG con transparencia). |
| **Rotación** | `r NN` | Grados. |
| **Filtro** | `filter Gauss` etc. | Vía `.Filter`. |
| **Hue/Saturación/Brillo** | `hue`, `sat`, `light` | Ajustes de color. |
| **Zoom** | `z NN` | Zoom extra al recortar (Fill). |

Ejemplos:

```go-html-template
{{ $img := .Resources.Get "cover.jpg" }}

{{/* Resize manteniendo aspecto (ancho fijo) */}}
{{ $a := $img.Resize "800x" }}

{{/* Resize + conversión a WebP + calidad */}}
{{ $b := $img.Resize "1200x webp q 75" }}

{{/* Fit dentro de 400x300 */}}
{{ $c := $img.Fit "400x300" }}

{{/* Fill exacto 300x200 anclado arriba */}}
{{ $d := $img.Fill "300x200 Top" }}

{{/* Crop centrado 200x200 */}}
{{ $e := $img.Crop "200x200 Center" }}

{{/* Process unificado: resize + webp + calidad en una pasada */}}
{{ $f := $img.Process "resize 1600x webp q 78" }}
```

### Render

```go-html-template
{{ with .Resources.Get "cover.jpg" }}
  {{ with .Process "resize 1200x webp q 75" }}
    <img src="{{ .RelPermalink }}" width="{{ .Width }}" height="{{ .Height }}" alt="{{ $.Title }}">
  {{ end }}
{{ end }}
```

Incluir siempre `width`/`height` evita *layout shift* (CLS).

### Rendimiento
- El procesado es **on-demand** y se cachea en el *file cache*. En CI grande, conviene cachear `resources/_gen` entre builds.
- Memoria/tiempo crecen con las dimensiones de la fuente: pre-escala imágenes enormes antes del build si el destino es pequeño.
- **Garbage collection:** `hugo build --gc` elimina caché no usado al cambiar specs o borrar imágenes.
- Subir `timeout` si el procesado de imágenes es pesado.

### Configuración `[imaging]`
Defaults globales aplicables cuando una SPEC no indica algo:

```toml
[imaging]
  anchor = 'Center'      # ancla por defecto para Crop/Fill
  bgColor = '#ffffff'
  hint    = 'photo'      # photo|picture|drawing|icon|text
  quality = 75
  resampleFilter = 'box' # box|lanczos|catmullRom|mitchell|nearest
```

**Cuándo usarlo en FrenzyCars:**
- Sustituye el **hotlink a Unsplash** del front matter por imágenes locales en page bundles o `assets/images/`.
- Genera variantes WebP con `.Process "resize ...x webp q 78"` para portadas y thumbnails (mejora LCP y ancho de banda).
- Para los thumbnails de cards: `.Fill "400x300 Center webp q 72"`.
- Para OpenGraph: `.Fit "1200x630"` en JPEG.
- Define `[imaging] quality = 75` como base.

---

## 11. Métodos del objeto `Resource`

Lista de métodos disponibles sobre un `Resource`:

| Método | Devuelve |
|---|---|
| `.Permalink` | Publica el recurso y devuelve su permalink absoluto. |
| `.RelPermalink` | Publica y devuelve la URL relativa. |
| `.Publish` | Publica el recurso (sin devolver URL). |
| `.Content` | El contenido (para inlinear). |
| `.Name` | Nombre (de front matter o ruta). |
| `.Title` | Título (de front matter o ruta). |
| `.MediaType` | Objeto media type. |
| `.ResourceType` | Tipo principal (p. ej. `image`, `text`). |
| `.Params` | Mapa de parámetros del front matter. |
| `.Width` / `.Height` | Dimensiones (solo imagen). |
| `.Colors` | Colores dominantes (solo imagen). |
| `.Exif` | Exif (formatos soportados). |
| `.Meta` | Exif + IPTC + XMP. |
| `.Data` | Info de respuesta HTTP (`resources.GetRemote`). |
| `.Err` | Error de `resources.GetRemote` (o nil). |
| `.Resize`/`.Fit`/`.Fill`/`.Crop`/`.Process`/`.Filter` | Imagen transformada (nuevo Resource). |

**Cuándo usarlo en FrenzyCars:** combina `.RelPermalink` + `.Width` + `.Height` + `.Data.Integrity` (tras `Fingerprint`) en todos los `<link>`/`<script>`/`<img>` del head y las plantillas de card.

---

## 12. CLI: comandos y flags

### Comandos principales

| Comando | Acción |
|---|---|
| `hugo build` (o `hugo`) | Compila el sitio a `public/`. |
| `hugo server` | Servidor de desarrollo con LiveReload. |
| `hugo new content <ruta>` | Crea contenido desde archetype. |
| `hugo new project <nombre>` | Crea un proyecto nuevo. |
| `hugo new theme <nombre>` | Crea un tema. |
| `hugo version` / `hugo env` | Versión / versión + entorno. |
| `hugo config` / `hugo config mounts` | Muestra config / mounts. |
| `hugo list drafts\|future\|expired\|published\|all` | Lista contenido por estado. |
| `hugo convert toJSON\|toTOML\|toYAML` | Convierte front matter. |
| `hugo deploy` | Despliega a cloud provider (S3/GCS/Azure) vía `[deployment]`. |
| `hugo gen chromastyles` | Genera CSS de Chroma para highlight. |
| `hugo mod init\|get\|tidy\|vendor\|clean\|graph\|verify\|npm pack` | Gestión de módulos. |
| `hugo completion <shell>` | Autocompletado. |

### Flags globales más usados (`hugo`/`hugo build`)

```text
-b,  --baseURL string          hostname raíz, p. ej. https://frenzycars.pages.dev/
-D,  --buildDrafts             incluir borradores
-E,  --buildExpired            incluir expirados
-F,  --buildFuture             incluir con fecha futura
     --cacheDir string         directorio de caché
     --cleanDestinationDir     borrar en destino lo ausente en static
     --clock string            fijar reloj (fechas) para probar draft/future
     --config string           fichero de config (default hugo.{toml,yaml,json})
     --configDir string        dir de config (default "config")
-c,  --contentDir string       dir de contenido
-d,  --destination string      dir de salida
     --disableKinds strings    desactivar kinds
     --enableGitInfo           añadir info de Git a las páginas
-e,  --environment string      entorno de build (development|production)
     --forceSyncStatic         copiar todo static al cambiar
     --gc                      limpieza de caché tras el build
     --ignoreCache             ignorar cachés configuradas
     --logLevel string         debug|info|warn|error
     --minify                  minificar HTML/XML/CSS/JS/JSON/SVG
     --noBuildLock             no crear .hugo_build.lock
     --noChmod / --noTimes     no sincronizar permisos / fechas
     --renderSegments strings  segmentos a renderizar
-M,  --renderToMemory          renderizar en memoria (server)
-s,  --source string           dir base de lectura
-t,  --theme strings           temas a usar
-w,  --watch                   vigilar cambios y reconstruir
```

### `hugo server` destacados

- `hugo server` → `http://localhost:1313/`, con LiveReload automático.
- `hugo server -D` → incluye borradores (equivalente a `--buildDrafts`).
- `hugo server --navigateToChanged` → redirige el navegador a la última página editada.
- `hugo server -b https://frenzycars.pages.dev` → sobreescribe `baseURL` localmente.
- `--bind`, `--port` → IP/puerto del servidor.
- `--renderToMemory` → no toca disco (rápido en server).

### Entornos
Hugo usa el entorno `development` con `hugo server` y `production` con `hugo`/`hugo build` (salvo flag `-e`). Puedes tener `config/production/hugo.toml` y `config/development/hugo.toml` para override por entorno.

**Cuándo usarlo en FrenzyCars:**
- Local: `hugo server -D` para ver borradores.
- Build de producción: `hugo --gc --minify` (limpieza + minificación).
- Validar config desplegada: `hugo config -e production`.

---

## 13. Despliegue en Cloudflare Pages

Cloudflare Pages compila el proyecto Hugo en su CI y sirve el directorio `public/`. Configuración típica en el dashboard de Cloudflare Pages:

| Ajuste | Valor |
|---|---|
| **Framework preset** | Hugo |
| **Build command** | `hugo --gc --minify` |
| **Build output directory** | `public` |
| **Root directory** | (raíz del repo) |

Variables de entorno (Settings → Environment variables):

| Variable | Valor | Nota |
|---|---|---|
| `HUGO_VERSION` | p. ej. `0.143.1` | Fija la versión exacta de Hugo. |
| `HUGO_ENV` | `production` | Entorno de build (override de `-e`). |
| `HUGO_CACHEDIR` | `/opt/build/cache/hugo_cache/` | Persiste caché entre builds. |
| `NODE_VERSION` | p. ej. `20` | Si usas PostCSS/`js.Build` con paquetes npm. |
| `GO_VERSION` | p. ej. `1.22` | Si usas Hugo Modules. |

Si tu pipeline necesita npm (PostCSS, Dart Sass, paquetes JS), antepón la instalación. **Opción A (con `package.json`):**
```bash
# Build command
npm install && hugo --gc --minify
```
**Opción B (Hugo Modules + `hugo mod npm pack`):**
```bash
hugo mod npm pack && npm install && hugo --gc --minify
```

> Cloudflare detecta el preset Hugo automáticamente y fija `public` como salida. El `baseURL` debe coincidir con tu dominio (`https://frenzycars.pages.dev/`) — configúralo en `hugo.toml` o via `HUGO_BASEURL`.

> **Nota:** la guía oficial `hugo-deploy` (`hugo deploy` con `[deployment]`) es para despliegue directo a **S3/GCS/Azure**, **no** Cloudflare Pages. Para Cloudflare Pages se usa el pipeline Git de Pages.

**Cuándo usarlo en FrenzyCars:** build command `hugo --gc --minify`, salida `public`, y `HUGO_VERSION` alineado con tu versión local. Si migras CSS a Sass/PostCSS, añade `npm install &&` al build command y `NODE_VERSION`.

---

## 14. Recetas de migración para FrenzyCars

### Receta A — CSS por pipeline (minify + fingerprint + SRI)

`assets/css/style.css` (movido desde `static/css/`):

```go-html-template
{{- $css := resources.Get "css/style.css" | minify | fingerprint "sha512" -}}
<link rel="stylesheet" href="{{ $css.RelPermalink }}" integrity="{{ $css.Data.Integrity }}" crossorigin="anonymous">
```

### Receta B — Sass (Dart Sass) + variables

`assets/sass/main.scss`:
```go-html-template
{{- $opts := dict "transpiler" "dartsass" "targetPath" "css/main.css" "outputStyle" "compressed" -}}
{{- $css := resources.Get "sass/main.scss" | css.Sass $opts | fingerprint -}}
<link rel="stylesheet" href="{{ $css.RelPermalink }}" integrity="{{ $css.Data.Integrity }}" crossorigin="anonymous">
```

### Receta C — JS con esbuild

`assets/js/main.js`:
```go-html-template
{{- $js := resources.Get "js/main.js" | js.Build (dict "targetPath" "js/main.js" "minify" true) | fingerprint -}}
<script src="{{ $js.Permalink }}" defer integrity="{{ $js.Data.Integrity }}" crossorigin="anonymous"></script>
```

### Receta D — Imagen de portada (Unsplash → local + WebP)

Mueve la imagen a un page bundle `content/reviews/coche-x/cover.jpg` y, en front matter, `cover: cover.jpg`. En la plantilla:
```go-html-template
{{- with .Resources.Get .Params.cover -}}
  {{- $img := .Process "resize 1600x webp q 78" -}}
  <img src="{{ $img.RelPermalink }}" width="{{ $img.Width }}" height="{{ $img.Height }}"
       alt="{{ $.Title }}" loading="lazy">
{{- end -}}
```

### Receta E — Thumbnails de card (Fill WebP)

```go-html-template
{{- with .Resources.Get .Params.cover -}}
  {{- $thumb := .Fill "400x300 Center webp q 72" -}}
  <img src="{{ $thumb.RelPermalink }}" width="{{ $thumb.Width }}" height="{{ $thumb.Height }}" alt="{{ .Title }}" loading="lazy">
{{- end -}}
```

### Receta F — CSS crítico embebido (inline)

```go-html-template
{{- $critical := resources.Get "css/critical.css" | minify -}}
<style>{{ $critical.Content | safeCSS }}</style>
```

---

## 15. Tabla maestra de flags y opciones

### Flags CLI recurrentes

| Flag corto | Flag largo | Acción |
|---|---|---|
| `-b` | `--baseURL` | URL raíz |
| `-D` | `--buildDrafts` | incluir borradores |
| `-E` | `--buildExpired` | incluir expirados |
| `-F` | `--buildFuture` | incluir futuros |
| `-e` | `--environment` | entorno |
| `-c` | `--contentDir` | dir contenido |
| `-d` | `--destination` | dir salida |
| `-s` | `--source` | dir base |
| `-t` | `--theme` | tema(s) |
| `-w` | `--watch` | vigilar cambios |
| `-M` | `--renderToMemory` | render en memoria |
| | `--gc` | garbage collection post-build |
| | `--minify` | minificar salidas |
| | `--config` | fichero de config |
| | `--enableGitInfo` | metadata Git |
| | `--cleanDestinationDir` | limpiar destino |
| | `--ignoreCache` | ignorar caché |
| | `--logLevel` | nivel de log |

### Opciones de SPEC de imagen (resumen)

| Token | Ejemplo | Efecto |
|---|---|---|
| `WxH` | `800x600` | dimensiones objetivo |
| `Wx` | `800x` | ancho fijo, alto proporcional |
| `xH` | `x400` | alto fijo |
| `q N` | `q 75` | calidad (JPEG/WebP) |
| `webp`/`jpeg`/`png`... | `webp` | formato de salida |
| `Center`/`Top`/`TopLeft`... | `Top` | ancla de recorte |
| `bg #RRGGBB` | `bg "#fff"` | color de fondo |
| `r N` | `r 90` | rotar grados |
| `z N` | `z 20` | zoom en Fill |

### Funciones del pipeline (resumen)

| Función | Propósito |
|---|---|
| `resources.Get` | recurso global desde `assets/` |
| `resources.GetRemote` | recurso remoto (HTTP/HTTPS) |
| `resources.Match` / `resources.GetMatch` | buscar por glob |
| `resources.ByType` | filtrar por media type |
| `resources.Copy` | copiar/renombrar recurso |
| `resources.Concat` | bundling (concatenar) |
| `resources.Minify` | minificar |
| `resources.Fingerprint` | hash + cache-busting + SRI |
| `resources.FromString` | crear recurso desde string |
| `css.Sass` / `css.Scss` | Sass → CSS (Dart/Lib) |
| `css.PostCSS` | procesar con PostCSS |
| `js.Build` | empaquetar JS (esbuild) |

---

*Fin del documento. Sincronizado con la documentación oficial de Hugo (gohugo.io), build de referencia v0.163.3.*
