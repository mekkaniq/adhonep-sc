#!/usr/bin/env bash
# App = plataforma ADHONEP-SC "beta" (dados e gestão) + camada de aplicativo (abas reais, globo, avisos, configurações).
# Não inclui /beta-global nem /beta/estado. Só dados de SC.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf www && mkdir -p www
B=../beta
cp "$B/index.html" "$B/styles.css" "$B/manifest.webmanifest" "$B/privacidade.html" "$B/termos.html" www/
cp -r "$B/js" "$B/assets" "$B/data" www/
rm -rf www/assets/video            # o app não usa o vídeo de capa (usa o globo)
find www/data/mun -type f ! -name SC.json -delete   # app = só Santa Catarina
cp native/shell.js native/globe.js native/app-native.js native/native-features.js native/offline.js www/js/
cp native/globe.json native/sc-cent.json www/data/
cat native/shell.css >> www/styles.css
python3 - <<'PY'
import re
p='www/index.html';s=open(p).read()
assert '</body>' in s
# capa em vídeo sai do app (o globo ocupa o Início)
s,n=re.subn(r'<section class="hero hero-vmode" id="heroSection">.*?</section><div class="hero-spacer"[^>]*></div>','<span id="publicActiveCount" hidden></span>',s,flags=re.S)
assert n==1,'hero não encontrada'
s=re.sub(r'<source[^>]*\.webm[^>]*>','',s)
s=s.replace('<head>','<head><script src="js/offline.js"></script>',1)
tag='<script src="js/globe.js"></script><script src="js/shell.js"></script><script src="js/app-native.js"></script><script src="js/native-features.js"></script>\n'
s=s.replace('</body>',tag+'</body>',1)
open(p,'w').write(s)
m='www/js/mapa.js';t=open(m).read()
k="if (ADH_UF !== 'SC') return downloadGeoStatic(progress);"
assert k in t
open(m,'w').write(t.replace(k,'return downloadGeoStatic(progress); /* app: limites locais, abre rápido e offline */',1))
PY
echo "www pronto: $(find www -type f | wc -l) arquivos, $(du -sh www | cut -f1)"
