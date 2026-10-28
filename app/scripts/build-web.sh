#!/usr/bin/env bash
# Copia SOMENTE o site de produção de SC (raiz) para app/www. Não inclui /beta, /beta-global nem arquivos de gestão do repositório.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf www && mkdir -p www
R=..
cp "$R/index.html" "$R/styles.css" "$R/manifest.webmanifest" "$R/privacidade.html" "$R/termos.html" www/
for d in js assets; do cp -r "$R/$d" "www/$d"; done
for f in inter-400.woff inter-500.woff inter-600.woff inter-700.woff poppins-500.woff poppins-700.woff fundo-hero.jpg mapa-mar.jpg mapa-terreno.jpg logo-branca.png logo-colorida.png favicon-48.png icon-192.png icon-512.png apple-touch-icon.png; do [ -f "$R/$f" ] && cp "$R/$f" www/; done
echo "www pronto: $(find www -type f | wc -l) arquivos"
