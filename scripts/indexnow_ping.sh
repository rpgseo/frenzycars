#!/bin/sh
# Envía todas las URLs del sitemap a IndexNow tras cada build de Hugo.
# Uso: sh scripts/indexnow_ping.sh
# En Cloudflare Pages: añadir como post-build command:
#   hugo && sh scripts/indexnow_ping.sh

SITE="https://frenzycars.com"
KEY="6e1dc43532a94a82a827e55627b7e03a"
SITEMAP="public/sitemap.xml"

if [ ! -f "$SITEMAP" ]; then
  echo "No se encontró $SITEMAP. Ejecuta 'hugo' primero."
  exit 1
fi

# Extraer URLs del sitemap
URLS=$(grep -o '<loc>[^<]*</loc>' "$SITEMAP" | sed 's/<loc>//g' | sed 's/<\/loc>//g')

if [ -z "$URLS" ]; then
  echo "No se encontraron URLs en el sitemap."
  exit 1
fi

# Construir JSON con array de URLs
URL_JSON=$(echo "$URLS" | awk 'BEGIN{printf "["} NR>1{printf ","} {printf "\"%s\"", $0} END{printf "]"}')

PAYLOAD=$(cat <<EOF
{
  "host": "frenzycars.com",
  "key": "$KEY",
  "keyLocation": "$SITE/$KEY.txt",
  "urlList": $URL_JSON
}
EOF
)

echo "Enviando $(echo "$URLS" | wc -l | tr -d ' ') URLs a IndexNow..."

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "https://api.indexnow.org/indexnow" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d "$PAYLOAD")

if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "202" ]; then
  echo "OK — IndexNow respondió $RESPONSE"
else
  echo "Aviso — IndexNow respondió $RESPONSE (no bloquea el deploy)"
fi
