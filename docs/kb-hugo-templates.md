# Base de Conocimiento — Hugo: Plantillas, Layouts y Métodos

> Referencia densa y autónoma para el sitio Hugo **FrenzyCards** (sección car-news/reviews).
> Las plantillas viven en `layouts/` y siguen la estructura clásica de Hugo:
> `_default/baseof.html`, `_default/single.html`, `_default/list.html` más partials en
> `layouts/_partials/` (article-card, lead-card, header, footer, score, spec-table, verdict)
> y plantillas de sección `about/single.html`, `maintenance/single.html`.
> Sveltia CMS alimenta el contenido. Sintaxis Go templates + HTML plano (sin Tailwind).

---

## Tabla de Contenidos

1. [Introducción a la sintaxis de plantillas](#1-introducción-a-la-sintaxis-de-plantillas)
   - [Contexto (el punto `.`)](#contexto-el-punto)
   - [Variables](#variables)
   - [Funciones y pipes](#funciones-y-pipes)
   - [Métodos](#métodos)
   - [Comentarios](#comentarios)
2. [Orden de resolución de plantillas (Lookup Order)](#2-orden-de-resolución-de-plantillas-lookup-order)
3. [Anatomía de plantillas base, single, list y home](#3-anatomía-de-plantillas-base-single-list-y-home)
   - [Base (`baseof.html`)](#base-baseofhtml)
   - [Home](#home)
   - [Single / Page](#single--page)
   - [List / Section / Taxonomy / Term](#list--section--taxonomy--term)
4. [Partials: paso de contexto, `.page` vs `$`, block/define](#4-partials-paso-de-contexto-page-vs--blockdefine)
5. [Métodos del objeto Page](#5-métodos-del-objeto-page)
6. [Métodos del objeto Site](#6-métodos-del-objeto-site)
7. [Render Hooks (links, images, headings)](#7-render-hooks-links-images-headings)
8. [Paginación](#8-paginación)
9. [Sitemap](#9-sitemap)
10. [Resumen de categorías de funciones](#10-resumen-de-categorías-de-funciones)

---

## 1. Introducción a la sintaxis de plantillas

Una **plantilla** es un archivo con *template actions* ubicado en el directorio `layouts`.
Hugo usa los paquetes `text/template` y `html/template` de Go. Para HTML usa `html/template`
por defecto (seguro frente a inyección de código).

```go-html-template
{{ $v1 := 6 }}
{{ $v2 := 7 }}
<p>The product of {{ $v1 }} and {{ $v2 }} is {{ mul $v1 $v2 }}.</p>
```

### Contexto (el punto)

El concepto más importante: **el punto (`.`) representa el contexto actual**. En una
plantilla de página, el contexto es el objeto `Page`.

```go-html-template
<h2>{{ .Title }}</h2>
```

El contexto puede cambiar dentro de bloques `range` o `with`:

```go-html-template
{{ range slice "foo" "bar" }}
  <p>{{ . }}</p>   <!-- aquí . es "foo" luego "bar" -->
{{ end }}

{{ with "baz" }}
  <p>{{ . }}</p>   <!-- aquí . es "baz" -->
{{ end }}
```

Para acceder al contexto original de la plantilla **dentro** de un `range` o `with`,
se antepone `$` al punto: `$.Title`.

```go-html-template
{{ with "foo" }}
  <p>{{ $.Title }} - {{ . }}</p>   <!-- $.Title es el título de la página -->
{{ end }}
```

> **Cuándo usarlo en FrenzyCards:** Dentro del partial `article-card`, si necesitas
> referenciar datos de la página contenedora (por ejemplo `.Site.Title`) mientras
> iteras páginas con `range`, usa `$.Site.Title`. La confusión de contexto es el error
> nº 1 de principiantes.

### Variables

Se inicializan con `:=` y se reasignan con `=`. El identificador va precedido de `$`.

```go-html-template
{{ $total := 3 }}
{{ range slice 7 11 21 }}
  {{ $total = add $total . }}
{{ end }}
{{ $total }} → 42
```

Las variables inicializadas dentro de un `if`/`range`/`with` tienen ámbito limitado al
bloque. Las declaradas fuera tienen ámbito de toda la plantilla.

Para slices/maps se usa `index`:

```go-html-template
{{ $slice := slice "foo" "bar" "baz" }}
{{ index $slice 2 }} → baz

{{ $map := dict "a" "foo" "b" "bar" "c" "baz" }}
{{ index $map "c" }} → baz
```

Para claves con guiones (no identificadores válidos) en `Params`, se usa obligatoriamente
`index`:

```go-html-template
{{ index .Params "key-with-hyphens" }}
```

### Funciones y pipes

Una función toma argumentos separados por espacios. El valor *piped* (con `|`) se
convierte en el **último argumento** de la función.

```go-html-template
{{ strings.ToLower "Hugo" }} → hugo
{{ "Hugo" | strings.ToLower }} → hugo
{{ "Hugo" | strings.ToLower | strings.TrimSuffix "o" }} → hug
{{ 5 | add 2 | mul 6 }} → 42
```

Muchas funciones tienen alias (`lower`, `upper`, `replace`, etc.).

Eliminación de espacios en blanco adyacentes con guiones `{{- -}}`:

```go-html-template
{{- $convertToLower := true -}}
{{- if $convertToLower -}}
  <h2>{{ strings.ToLower .Title }}</h2>
{{- end -}}
```

Comillas: dobles `"..."` (interpreta escapes `\u0021`), backticks `` `...` `` (literal
puro), simples `'!'` (rune → valor numérico, rara vez útil en plantillas).

### Métodos

Asociados a un objeto (p.ej. `Page` o `Site`), se encadenan con un punto:

```go-html-template
{{ .Site.Title }}  → My Site Title
{{ .Title }}       → My Page Title
{{ .Page.GetPage "/books/les-miserables" }}
```

### Comentarios

**Nunca uses comentarios HTML** (`<!-- -->`) para comentar código de plantilla: Hugo
evalúa el contenido antes de eliminarlos. Usa comentarios de plantilla:

```go-html-template
{{/* comentario en línea */}}
{{- /* comentario sin espacios adyacentes */ -}}
{{/*
   comentario en bloque
*/}}
```

Para emitir un comentario HTML real al output:

```go-html-template
{{ "<!-- comentario HTML -->" | safeHTML }}
```

---

## 2. Orden de resolución de plantillas (Lookup Order)

Hugo selecciona la plantilla para una página desde **la más específica a la más general**.
Los parámetros que determinan la búsqueda, en orden de especificidad:

| Parámetro        | Descripción |
|------------------|-------------|
| **Kind**         | El *Kind* de la página (`home`, `page`, `section`, `taxonomy`, `term`). Determina si busca en `single.html` (página regular) o `list.html` (listados). |
| **Layout**       | Definible en front matter (`layout: ...`). |
| **Output Format** | Nombre (`html`, `rss`, `amp`) + sufijo. Prefiere coincidencias con ambos. |
| **Language**     | Etiqueta de idioma en el nombre (p.ej. `index.fr.amp.html`). |
| **Type**         | Valor de `type` en front matter, si no, el nombre de la sección raíz (p.ej. `blog`). Siempre tiene valor; por defecto `page`. |
| **Section**      | Relevante para `section`, `taxonomy` y `term`. |

Hugo intercala búsquedas entre el proyecto y los temas, eligiendo siempre la más específica.

**Estructura de resolución típica (ejemplo para `single` en inglés/HTML):**

```
1. layouts/<TIPO>/<SECCIÓN>.single.html      (p.ej. layouts/reviews/single.html)
2. layouts/<TIPO>/single.html
3. layouts/_default/single.html              ← FrenzyCards usa esta como base
4. (tema) layouts/_default/single.html
```

Para páginas en la raíz de `content/` (sin sección), el *type* es `page`.

**Apuntar una página a una plantilla concreta** vía front matter:

```yaml
---
title: Contacto
type: miscellaneous      # mapea a layouts/miscellaneous/
layout: contact          # mapea a layouts/miscellaneous/contact.html
---
```

> **Cuándo usarlo en FrenzyCards:** Tus plantillas `about/single.html` y
> `maintenance/single.html` se resuelven porque las páginas bajo `content/about/` y
> `content/maintenance/` tienen *Section* = `about` / `maintenance`. El *fallback*
> `_default/single.html` captura cualquier otra sección sin plantilla específica.

---

## 3. Anatomía de plantillas base, single, list y home

### Base (`baseof.html`)

Plantilla fundacional que otras extienden. Define la estructura común (`<!DOCTYPE>`,
`<head>`, `<body>`, header, footer). Hugo aplica `baseof.html` a una plantilla solo si ésta
cumple: **(a)** contiene al menos un `define`, y **(b)** solo contiene `define`,
espacios en blanco y comentarios.

`block` define un marcador reemplazable; `define` (en la plantilla hija) lo rellena.

```go-html-template
<!-- layouts/_default/baseof.html -->
<!DOCTYPE html>
<html lang="{{ site.Language.Locale }}" dir="{{ or site.Language.Direction `ltr` }}">
<head>
  {{ partial "header.html" . }}
</head>
<body>
  {{ partial "header.html" . }}
  <main>
    {{ block "main" . }}{{ end }}
  </main>
  {{ partial "footer.html" . }}
</body>
</html>
```

> **Cuándo usarlo en FrenzyCards:** Esta es exactamente tu `_default/baseof.html`. Los
> partials `header` y `footer` se incluyen aquí. Cada layout de sección define su bloque
> `main`. Puedes añadir bloques adicionales (p.ej. `{{ block "scripts" . }}{{ end }}`)
> para inyectar JS selectivo.

### Home

Renderiza la portada del sitio. Resolución: `layouts/index.html` → `layouts/home.html`
→ `layouts/list.html` → `layouts/_default/list.html`.

```go-html-template
<!-- layouts/index.html -->
{{ define "main" }}
  {{ .Content }}
  {{ range first 5 .Site.RegularPages }}
    <h2><a href="{{ .RelPermalink }}">{{ .LinkTitle }}</a></h2>
  {{ end }}
{{ end }}
```

> **Cuándo usarlo en FrenzyCards:** La home muestra el `lead-card` del artículo destacado
> y una rejilla de `article-card`. Usa `range first N .Site.RegularPages` para los
> últimos reviews y `.Site.RegularPages` filtrando por `Section`.

### Single / Page

`page.html` renderiza una página regular; `single.html` es su *fallback*. Resolución:
`layouts/<SECCIÓN>/page.html` → `layouts/_default/page.html` → `layouts/<SECCIÓN>/single.html`
→ `layouts/_default/single.html`.

```go-html-template
<!-- layouts/_default/single.html -->
{{ define "main" }}
  <h1>{{ .Title }}</h1>
  {{ .Content }}
{{ end }}
```

```go-html-template
<!-- layouts/reviews/single.html -->
{{ define "main" }}
  <article>
    <h1>{{ .Title }}</h1>
    {{ partial "score.html" . }}
    {{ .Content }}
    {{ partial "verdict.html" . }}
    {{ partial "spec-table.html" . }}
  </article>
{{ end }}
```

> **Cuándo usarlo en FrenzyCards:** Los partials `score`, `verdict` y `spec-table`
> reciben `.` (la página actual) como contexto para extraer `.Params.score`,
> `.Params.verdict`, etc. definidos por Sveltia CMS en el front matter.

### List / Section / Taxonomy / Term

`list.html` es el *fallback* de `home`, `section`, `taxonomy` y `term`. Resolución para
sección: `layouts/<SECCIÓN>/section.html` → `layouts/<SECCIÓN>/list.html` →
`layouts/section/list.html` → `layouts/_default/list.html` → `layouts/_default/section.html`.

```go-html-template
<!-- layouts/_default/list.html -->
{{ define "main" }}
  <h1>{{ .Title }}</h1>
  {{ .Content }}
  {{ range .Pages }}
    <h2><a href="{{ .RelPermalink }}">{{ .LinkTitle }}</a></h2>
  {{ end }}
{{ end }}
```

**Taxonomy** (lista de términos): usa `.Data.Terms`:

```go-html-template
{{ define "main" }}
  <h1>{{ .Title }}</h1>
  {{ range .Data.Terms.ByCount }}
    <h2><a href="{{ .Page.RelPermalink }}">{{ .Page.LinkTitle }}</a> ({{ .Count }})</h2>
  {{ end }}
{{ end }}
```

Dentro de plantillas de taxonomy/term, el objeto `.Data` expone:
`Singular`, `Plural`, `Terms` (taxonomy) y además `Term` (term).

> **Cuándo usarlo en FrenzyCards:** Si defines taxonomías como `brands` o `segments`,
> crea `layouts/term.html` para listar reviews de una marca concreta, y
> `layouts/taxonomy.html` para el índice de todas las marcas ordenadas por conteo.

---

## 4. Partials: paso de contexto, `.page` vs `$`, block/define

Los **partials** son componentes reutilizables en `layouts/_partials/`. Se invocan con
`partial` o `partialCached`, pasando el contexto como segundo argumento:

```go-html-template
{{ partial "header.html" . }}
{{ partial "article-card.html" . }}     <!-- . es la Page actual -->
{{ partialCached "footer.html" . }}     <!-- cacheado; ideal para footer/header -->
```

**Pasar contexto personalizado** con `dict`:

```go-html-template
{{ partial "score.html" (dict "page" . "showStars" true) }}
```

Dentro del partial, accedes a los valores:

```go-html-template
<!-- layouts/_partials/score.html -->
{{ $page := .page }}
{{ $showStars := .showStars }}
<p>Puntuación: {{ $page.Params.score }}/10</p>
```

**Punto `.` vs `$` dentro de un partial:** En un partial, `.` es lo que recibiste como
argumento (la *page* si pasaste `.`). `$` no es especialmente diferente del punto en el
ámbito raíz del partial; la distinción `$` vs `.` importa principalmente dentro de
bloques `range`/`with`, donde `$` conserva el contexto del ámbito externo.

```go-html-template
<!-- layouts/_partials/article-card.html -->
{{ $page := . }}                       <!-- captura la página pasada como contexto -->
{{ range $page.GetTerms "brands" }}    <!-- itera términos; aquí . es cada término -->
  <a href="{{ .RelPermalink }}">{{ .LinkTitle }}</a>
  {{ $page.Title }}                    ← para volver a la página, usa la variable capturada
{{ end }}
```

> Recomendación: al inicio de cada partial captura `{{ $page := . }}` (o el nombre que
> proceda) para no perder la referencia al contexto recibido dentro de iteraciones.

**Resolución de partials:** Hugo no considera kind/type/lang para partials, pero sí
aplica *name matching* progresivo:

```go-html-template
{{ partial "footer.section.de.html" . }}
```

Busca: `_partials/footer.section.de.html` → `_partials/footer.section.html` →
`_partials/footer.de.html` → `_partials/footer.html`.

**Partials que devuelven valores** (con `return`):

```go-html-template
{{ $val := partial "my-helper.html" . }}
```

```go-html-template
<!-- layouts/_partials/my-helper.html -->
{{ $value := 32 }}
{{ return $value }}
```

**block / define:** Mecanismo base+extensión. `baseof.html` declara `{{ block "main" . }}`,
y cada plantilla hija lo rellena con `{{ define "main" }}...{{ end }}`. Un bloque puede
tener contenido por defecto entre `block` y `end` que se usa si ninguna plantilla lo define.

**Content views** (alternativa a partials, vía `.Render`): heredan el contexto de la
página y pueden targetear kind/type/lang. Útiles para tarjetas:

```go-html-template
{{ range where site.RegularPages "Section" "reviews" }}
  {{ .Render "view_card" }}      <!-- usa layouts/reviews/view_card.html -->
{{ end }}
```

```go-html-template
<!-- layouts/reviews/view_card.html -->
<div class="card">
  <h2><a href="{{ .RelPermalink }}">{{ .LinkTitle }}</a></h2>
  {{ .Summary }}
</div>
```

> **Cuándo usarlo en FrenzyCards:** Tus partials `article-card` y `lead-card` son la
> forma idiomática. Si necesitas que la tarjeta varíe por sección (distinto diseño para
> `news` vs `reviews`), usa *content views* con `.Render` o partials con *name matching*
> (`article-card.reviews.html`).

---

## 5. Métodos del objeto Page

Lista completa de métodos del objeto `Page`. Se invocan encadenados al punto o a una
variable de tipo página (`$page.Title`).

### Colecciones de páginas

| Método | Descripción |
|--------|-------------|
| `.Pages` | Páginas regulares de la sección actual + páginas de sección de subsecciones inmediatas. |
| `.RegularPages` | Solo páginas regulares de la sección actual. |
| `.RegularPagesRecursive` | Páginas regulares de la sección actual y de **todas** las subsecciones descendientes. |
| `.Sections` | Páginas de sección hijas inmediatas. |

### Contenido

| Método | Descripción |
|--------|-------------|
| `.Content` | Contenido renderizado (HTML). |
| `.ContentWithoutSummary` | Contenido renderizado sin el resumen. |
| `.Summary` | Resumen del contenido (auto o `<!--more-->`). |
| `.Truncated` | `true` si el contenido supera la longitud del resumen. |
| `.Plain` | Contenido renderizado sin etiquetas HTML. |
| `.PlainWords` | `.Plain` dividido en slice de palabras. |
| `.RawContent` | Contenido crudo (Markdown original). |
| `.TableOfContents` | Tabla de contenidos HTML generada de los headings. |
| `.WordCount` | Número de palabras. |
| `.FuzzyWordCount` | Conteo redondeado al múltiplo de 100 superior. |
| `.ReadingTime` | Tiempo de lectura estimado en minutos. |
| `.Len` | Longitud en bytes del contenido renderizado. |
| `.Fragments` | Estructura de datos de los fragmentos (headings) de la página. |

### URLs y enlaces

| Método | Descripción |
|--------|-------------|
| `.Permalink` | URL absoluta de la página. |
| `.RelPermalink` | URL relativa al root del sitio. |
| `.Path` | Ruta lógica de la página. |
| `.Ref OPTIONS` | URL absoluta de la página por path/idioma/output. |
| `.RelRef OPTIONS` | URL relativa de la página por path/idioma/output. |

### Metadatos

| Método | Descripción |
|--------|-------------|
| `.Title` | Título (front matter). |
| `.LinkTitle` | Título para enlaces (`linkTitle` si existe, si no `.Title`). |
| `.Description` | Descripción (front matter). |
| `.Date` | Fecha de la página. |
| `.PublishDate` | Fecha de publicación. |
| `.ExpiryDate` | Fecha de expiración. |
| `.Lastmod` | Última modificación. |
| `.Keywords` | Slice de keywords (front matter). |
| `.Type` | Tipo de contenido (`type` en front matter o sección raíz). |
| `.Layout` | Layout definido en front matter. |
| `.Kind` | Kind de la página (`home`, `page`, `section`, `taxonomy`, `term`). |
| `.Section` | Nombre de la sección de primer nivel donde reside. |
| `.Weight` | Peso (front matter). |
| `.Slug` | Slug de URL (front matter). |

### Parámetros y datos

| Método | Descripción |
|--------|-------------|
| `.Params` | Mapa de parámetros personalizados del front matter. |
| `.Param KEY` | Parámetro de página con *fallback* a parámetro de sitio. |
| `.Data` | Objeto de datos único por Kind (taxonomy/term). |
| `.File` | Información del archivo que respalda la página (para páginas con archivo). |
| `.GitInfo` | Metadatos del commit (si GitInfo habilitado). |
| `.Sitemap` | Ajustes de sitemap de la página (front matter o config). |

### Resources y bundles

| Método | Descripción |
|--------|-------------|
| `.Resources` | Colección de *page resources* (imágenes, etc. del bundle). |
| `.BundleType` | Tipo de bundle (`leaf`, `branch`) o vacío. |

### Navegación y jerarquía

| Método | Descripción |
|--------|-------------|
| `.Site` | El objeto `Site`. |
| `.CurrentSection` | Página de la sección en la que reside la página actual. |
| `.FirstSection` | Sección de primer nivel de la que desciende. |
| `.Parent` | Página de la sección padre. |
| `.Ancestors` | Colección de páginas de cada sección ancestro. |
| `.IsAncestor P2` | ¿La página actual es ancestro de P2? |
| `.IsDescendant P2` | ¿La página actual es descendiente de P2? |
| `.Next` | Siguiente página regular del sitio (orden global). |
| `.Prev` | Anterior página regular del sitio. |
| `.NextInSection` | Siguiente página regular dentro de la misma sección. |
| `.PrevInSection` | Anterior página regular dentro de la misma sección. |

### Búsqueda y taxonomías

| Método | Descripción |
|--------|-------------|
| `.GetPage PATH` | Devuelve una `Page` por ruta lógica. |
| `.GetTerms TAXONOMY` | Términos de la taxonomía asignados a la página, en orden de aparición en front matter. |
| `.HasShortcode NAME` | ¿La página invoca ese shortcode? |

### Paginación

| Método | Descripción |
|--------|-------------|
| `.Paginator` | Pagina la colección de páginas regulares recibida en contexto. |
| `.Paginate COLLECTION [N]` | Pagina cualquier colección, con tamaño de pager configurable. |

### Idioma y traducciones

| Método | Descripción |
|--------|-------------|
| `.Language` | Objeto `Language` de la página. |
| `.IsTranslated` | ¿Tiene una o más traducciones? |
| `.Translations` | Traducciones (excluyendo idioma actual), ordenadas. |
| `.AllTranslations` | Todas las traducciones incluyendo idioma actual. |
| `.TranslationKey` | Clave de traducción. |

### Clasificación (booleans)

| Método | Descripción |
|--------|-------------|
| `.IsHome` | ¿Es la home? |
| `.IsPage` | ¿Es página regular? |
| `.IsSection` | ¿Es página de sección? |
| `.IsNode` / `.IsBranch` | ¿Es nodo/branch (no página regular)? |
| `.Draft` | ¿Es borrador? |

### Renderizado y utilidades

| Método | Descripción |
|--------|-------------|
| `.Render NAME` | Renderiza una plantilla (content view) con la página como contexto. |
| `.RenderString [OPTS] MARKUP` | Renderiza markup a HTML. |
| `.RenderShortcodes` | Renderiza shortcodes preservando el markup circundante. |
| `.Scratch` | Estructura de datos persistente *scratched* a la página. |
| `.Store` | Estructura de datos persistente *scoped* a la página (sucesor moderno de Scratch). |
| `.Param KEY` | Parámetro con fallback página→sitio. |

> **Cuándo usarlo en FrenzyCards:**
> - `.Params.score`, `.Params.specs`, `.Params.verdict` → datos que Sveltia CMS guarda en front matter.
> - `.Resources.GetMatch "*cover*"` → imágenes de portada dentro de cada bundle de review.
> - `.Related` (ver abajo) → artículos relacionados al pie del review.
> - `.Summary` + `.Truncated` → tarjetas con extracto y enlace "leer más".
> - `.TableOfContents` → índice navegable en reviews largos.

#### Artículos relacionados (`.Related`)

Configurado en `hugo.toml` bajo `[related]`. Uso:

```go-html-template
{{ $related := .Site.RegularPages.Related . | first 3 }}
{{ range $related }}
  <a href="{{ .RelPermalink }}">{{ .Title }}</a>
{{ end }}
```

---

## 6. Métodos del objeto Site

Se accede vía `.Site` (desde una página) o `site` (variable global equivalente).

| Método | Descripción |
|--------|-------------|
| `.Site.Title` | Título del sitio (config). |
| `.Site.BaseURL` | URL base (config). |
| `.Site.Copyright` | Aviso de copyright (config). |
| `.Site.Language` | Objeto `Language` del sitio. |
| `.Site.LanguagePrefix` | Prefijo de idioma en URL, si existe. |
| `.Site.Languages` | Colección de objetos Language, ordenados por peso. |
| `.Site.Language.Locale` | Locale del idioma (útil para `<html lang>`). |
| `.Site.Home` | Página home del sitio. |
| `.Site.Pages` | Todas las páginas (todos los idiomas si multisite). |
| `.Site.AllPages` | Todas las páginas en todos los idiomas. |
| `.Site.RegularPages` | Todas las páginas regulares. |
| `.Site.Sections` | Páginas de sección de primer nivel. |
| `.Site.MainSections` | Slice de nombres de sección principales (config o la de más páginas). |
| `.Site.Taxonomies` | Estructura con todos los objetos Taxonomy, sus términos y páginas. |
| `.Site.Menus` | Colección de objetos menú. |
| `.Site.Data` | Datos compuestos de los archivos en `data/`. |
| `.Site.Params` | Mapa de parámetros personalizados del config. |
| `.Site.Param KEY` | Parámetro de sitio por clave. |
| `.Site.GetPage PATH` | Página por ruta. |
| `.Site.Lastmod` | Última fecha de modificación del contenido del sitio. |
| `.Site.BuildDrafts` | ¿Están habilitados los drafts en este build? |
| `.Site.Config` | Subconjunto de la configuración del proyecto. |
| `.Site.Sites` | Colección de todos los sitios (todas las dimensiones). |
| `.Site.Store` | Estructura persistente *scoped* al sitio. |

**Acceso a parámetros de sitio** (definidos en `hugo.toml`):

```go-html-template
{{ .Site.Params.subtitle }}
{{ .Site.Params.author.name }}
```

> **Cuándo usarlo en FrenzyCards:** Define en `hugo.toml` `[params]` global data como
> `brand_name`, `social_twitter`, `default_cover`. Léelos en `baseof.html` y partials
> (`header`, `footer`) con `.Site.Params.<key>`. Usa `.Site.RegularPages` en la home y
> `.MainSections` para feeds.

---

## 7. Render Hooks (links, images, headings)

Los **render hooks** son plantillas en `layouts/_markup/` que **sobrescriben la
conversión de Markdown a HTML**. Solo aplican a Markdown. Permiten añadir atributos
(`rel`, `class`, `loading`), resolver recursos, etc.

```
layouts/_markup/
├── render-link.html
├── render-image.html
└── render-heading.html
```

El *lookup order* de render hooks soporta variaciones por tipo/kind/idioma/output:

```
layouts/reviews/_markup/render-link.html    ← específico de sección reviews
layouts/_markup/render-link.html            ← global
layouts/_markup/render-link.rss.xml         ← específico de output format
```

### Hook de Links (`render-link.html`)

Contexto recibido:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `.Destination` | `string` | URL destino. |
| `.Text` | `template.HTML` | Texto del enlace. |
| `.PlainText` | `string` | Texto plano del enlace. |
| `.Title` | `string` | Atributo title (opcional). |
| `.Page` | `page` | Página actual. |
| `.PageInner` | `page` | Página anidada vía `RenderShortcodes`. |
| `.Ordinal` | `int` | Ordinal del enlace en la página (0-based). |
| `.Position` | `string` | Posición en el contenido. |

Ejemplo — añadir `rel="external"` a enlaces absolutos:

```go-html-template
<!-- layouts/_markup/render-link.html -->
{{- $u := urls.Parse .Destination -}}
<a href="{{ .Destination | safeURL }}"
  {{- with .Title }} title="{{ . }}"{{ end -}}
  {{- if $u.IsAbs }} rel="external"{{ end -}}
>
  {{- with .Text }}{{ . }}{{ end -}}
</a>
{{- /* chomp trailing newline */ -}}
```

### Hook de Images (`render-image.html`)

Contexto recibido:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `.Destination` | `string` | URL de la imagen. |
| `.Text` | `template.HTML` | Descripción (alt). |
| `.PlainText` | `string` | Alt como texto plano. |
| `.Title` | `string` | Title opcional. |
| `.IsBlock` | `bool` | `true` si imagen standalone no envuelta en `<p>`. |
| `.Attributes` | `map` | Atributos Markdown (requiere config `attribute.block: true`). |
| `.Page`, `.PageInner`, `.Ordinal`, `.Position` | | Igual que en links. |

Ejemplo — imagen standalone dentro de `<figure>`:

```go-html-template
<!-- layouts/_markup/render-image.html -->
{{- if .IsBlock -}}
  <figure>
    <img src="{{ .Destination | safeURL }}"
      {{- with .PlainText }} alt="{{ . }}"{{ end -}}
    >
    {{- with .Title }}<figcaption>{{ . }}</figcaption>{{ end -}}
  </figure>
{{- else -}}
  <img src="{{ .Destination | safeURL }}"
    {{- with .PlainText }} alt="{{ . }}"{{ end -}}
    {{- with .Title }} title="{{ . }}"{{ end -}}
  >
{{- end -}}
```

Config necesaria para `IsBlock` y `Attributes`:

```yaml
markup:
  goldmark:
    parser:
      attribute:
        block: true
      wrapStandAloneImageWithinParagraph: false
```

### Hook de Headings (`render-heading.html`)

Contexto recibido:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `.Level` | `int` | Nivel del heading (1–6). |
| `.Anchor` | `string` | `id` autogenerado. |
| `.Text` | `template.HTML` | Texto del heading. |
| `.PlainText` | `string` | Texto plano. |
| `.Attributes` | `map` | Atributos Markdown (requiere `attribute.title: true`). |
| `.Page`, `.PageInner`, `.Ordinal`, `.Position` | | Igual que en links. |

Ejemplo — heading con enlace ancla:

```go-html-template
<!-- layouts/_markup/render-heading.html -->
<h{{ .Level }} id="{{ .Anchor }}" {{- with .Attributes.class }} class="{{ . }}" {{- end }}>
  {{ .Text }}
  <a href="#{{ .Anchor }}">#</a>
</h{{ .Level }}>
```

> **Cuándo usarlo en FrenzyCards:** Crea `render-image.html` para inyectar
> `loading="lazy"` y `class="article-img"` a todas las imágenes Markdown de reviews,
> y `render-link.html` para `rel="external"` en enlaces salientes a fabricantes. El
> `render-heading.html` añade enlaces ancla que mejoran la navegación en reviews largos
> (especificaciones, veredicto).

---

## 8. Paginación

Pagina listados (`home`, `section`, `taxonomy`, `term`) en subconjuntos. Dos métodos:

- **`.Paginate COLLECTION [N]`** — flexible: pagina cualquier colección, permite
  filtrar/ordenar y sobrescribir el `pagerSize` del config.
- **`.Paginator`** — pagina la colección recibida en contexto, sin override de tamaño.

> **Regla crítica:** La primera invocación de paginación para una página de listado **se
> cachea** y no puede cambiarse. No invoques paginación más de una vez por página.

Config (`hugo.toml`):

```yaml
pagination:
  disableAliases: false   # true evita redirección alias del primer pager
  pagerSize: 10           # páginas por pager
  path: page              # segmento URL
```

Ejemplo con `Paginate`:

```go-html-template
{{ $pages := where site.RegularPages "Type" "reviews" }}
{{ $paginator := .Paginate $pages.ByTitle 7 }}

{{ range $paginator.Pages }}
  <h2><a href="{{ .RelPermalink }}">{{ .LinkTitle }}</a></h2>
{{ end }}

{{ partial "pagination.html" . }}
```

Ejemplo con `Paginator`:

```go-html-template
{{ range .Paginator.Pages }}
  <h2><a href="{{ .RelPermalink }}">{{ .LinkTitle }}</a></h2>
{{ end }}
{{ partial "pagination.html" . }}
```

**Paginación con agrupación:**

```go-html-template
{{ $paginator := .Paginate ($pages.GroupByDate "Jan 2006") }}
{{ range $paginator.PageGroups }}
  <h2>{{ .Key }}</h2>
  {{ range .Pages }}
    <h3><a href="{{ .RelPermalink }}">{{ .LinkTitle }}</a></h3>
  {{ end }}
{{ end }}
```

**Navegación entre pagers:** El partial embebido `pagination.html` ofrece dos formatos:

```go-html-template
{{ partial "pagination.html" (dict "page" . "format" "default") }}
{{ partial "pagination.html" (dict "page" . "format" "terse") }}
```

Para personalizar, copia el fuente a `layouts/_partials/pagination.html`.

**Métodos del objeto `Pager`:** `First`, `Last`, `Next`, `Prev`, `HasNext`, `HasPrev`,
`PageNumber`, `PagerSize`, `Pages`, `PageGroups`, `Pagers`, `NumberOfElements`,
`TotalNumberOfElements`, `TotalPages`, `URL`.

> **Cuándo usarlo en FrenzyCards:** En `layouts/_default/list.html` pagina los reviews
> con `{{ range (.Paginate .Pages).Pages }}` y renderiza el partial `pagination.html`
> debajo. Ajusta `pagerSize` en config a 9 o 12 para rejillas de tarjetas.

---

## 9. Sitemap

Hugo genera `sitemap.xml` automáticamente con plantillas embebidas (protocolo sitemap
v0.9). En monolingüe, un `sitemap.xml` en la raíz. En multilingüe, uno por idioma más un
`sitemapindex.xml` en la raíz.

**Override por página** (front matter):

```yaml
---
sitemap:
  changefreq: weekly
  priority: 0.8
  disable: true    # excluye la página del sitemap
---
```

**Override de plantilla:** crea `layouts/sitemap.xml` o `layouts/sitemapindex.xml`.
Dentro accede con `.Sitemap.ChangeFreq` y `.Sitemap.Priority`.

**Deshabilitar sitemap:**

```yaml
disableKinds:
- sitemap
```

> **Cuándo usarlo en FrenzyCards:** Por defecto no necesitas tocar el sitemap. Si
> quieres priorizar reviews sobre páginas estáticas, añade `sitemap.priority` en front
> matter mediante Sveltia CMS.

---

## 10. Resumen de categorías de funciones

Hugo ofrece cientos de funciones organizadas por *namespace*. Las más usadas:

| Namespace | Uso típico | Ejemplos clave |
|-----------|-----------|----------------|
| **go-template** | Control de flujo (Go nativo) | `if`, `else`, `range`, `with`, `end`, `block`, `define`, `template`, `and`, `or`, `not`, `eq`, `ne`, `gt`, `lt`, `len`, `index`, `print`, `printf`, `urlquery` |
| **collections** | Manipular slices/maps | `where`, `sort`, `slice`, `dict`, `index`, `append`, `del`, `merge`, `group`, `seq`, `apply`, `reverse`, `uniqual`, `querify` |
| **strings** | Trabajar con texto | `ToLower`/`lower`, `ToUpper`/`upper`, `Replace`/`replace`, `TrimPrefix`, `TrimSuffix`, `Split`, `Join`, `HasPrefix`, `HasSuffix`, `Contains`, `Truncate` |
| **compare** | Comparar valores | `Conditional`, `Eq`, `Ne`, `Gt`, `Lt`, `Ge`, `Le` |
| **math** | Operaciones numéricas | `add`, `sub`, `mul`, `div`, `mod`, `max`, `min`, `floor`, `ceil`, `round` |
| **time** | Fechas y horas | `now`, `time`, `dateFormat`, `duration` |
| **urls** | Parsear/escapar URLs | `Parse`, `AbsURL`, `RelURL`, `Query`, `JoinPath` |
| **safe** | Marcar valores como seguros | `safeHTML`, `safeURL`, `safeJS`, `safeCSS`, `safeHTMLAttr` |
| **resources** | Pipelines de recursos | `Get`, `GetMatch`, `GetRemote`, `FromFile`, `Concat`, `Minify`, `Fingerprint`, `ToCSS`, `ExecuteAsTemplate` |
| **images** | Procesado de imágenes | `Config`, `Filter`, `Fit`, `Fill`, `Resize`, `Crop` |
| **partials** | Invocar partials | `partial`, `partialCached` |
| **fmt** | Impresión | `Print`, `Printf`, `Println`, `Errorf`, `Warnf` |
| **os** | Sistema operativo | `Getenv`, `ReadFile` |
| **path** | Rutas de archivos | `Base`, `Dir`, `Ext`, `Join`, `Split` |
| **cast** | Conversión de tipos | `ToInt`, `ToString`, `ToFloat`, `ToBool` |
| **transform** | Transformar formatos | `Highlight`, `HTMLEscape`, `Markdownify`, `Emojify`, `XMLEscape` |
| **hugo** | Info del entorno | `Version`, `Environment`, `IsProduction`, `IsServer` |
| **lang** | Idioma | `Translate`/`i18n`, `NumFmt`, `FormatPercent` |
| **debug** | Depuración | `Dump` |
| **css** / **js** | Build de assets | `Babel`, `PostCSS`, `ToCSS` |

**Patrones frecuentes:**

```go-html-template
{{ where .Site.RegularPages "Section" "reviews" }}      <!-- filtrar por sección -->
{{ where .Pages "Params.score" "gt" 8 }}                <!-- filtrar por param -->
{{ first 5 (.Pages.ByDate.Reverse) }}                   <!-- 5 más recientes -->
{{ range .Pages.GroupByDate "2006-01" }}                <!-- agrupar por mes -->
{{ printf "Score: %d/10" .Params.score }}               <!-- formatear string -->
{{ now.Format "2006-01-02" }}                           <!-- fecha actual -->
{{ .Date | time.Format ":date_long" }}                  <!-- formatear fecha de página -->
{{ $img := .Resources.GetMatch "*cover*" }}             <!-- obtener recurso -->
{{ $img.RelPermalink }}                                  <!-- URL del recurso -->
{{ .Site.RegularPages | symdiff .Pages }}               <!-- diff de colecciones -->
{{ if eq hugo.Environment "production" }}...{{ end }}    <!-- condicional por entorno -->
```

> **Cuándo usarlo en FrenzyCards:** `where` + `first` para feeds filtrados en la home;
> `resources.GetMatch` + imágenes para portadas de reviews con procesado (resize/fill);
> `dateFormat` para fechas legibles; `safeHTML` cuando emites HTML desde variables.

---

*Fuente: Documentación oficial de Hugo (gohugo.io), v0.163.3. Sintaxis y métodos
verificados contra la docs pública. Adaptado al contexto del proyecto FrenzyCards.*
