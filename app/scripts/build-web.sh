#!/usr/bin/env bash
# App = plataforma ADHONEP-SC "beta" (capa em vídeo, tema, Central de comando, gestão) + camada nativa (avisos, barra inferior, push).
# Não inclui /beta-global nem /beta/estado. Só dados de SC.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf www && mkdir -p www
B=../beta
cp "$B/index.html" "$B/styles.css" "$B/manifest.webmanifest" "$B/privacidade.html" "$B/termos.html" www/
cp -r "$B/js" "$B/assets" "$B/data" www/
rm -f www/assets/video/*.webm   # iOS não usa webm; só mp4
cp native/avisos.js native/app-native.js www/js/
cat native/app.css >> www/styles.css
python3 - <<'PY'
p='www/index.html';s=open(p).read()
tag='<script src="js/avisos.js"></script><script src="js/app-native.js"></script>\n'
assert '</body>' in s
import re
s=re.sub(r'<source[^>]*\.webm[^>]*>','',s)
s=s.replace('</body>',tag+'</body>',1)
open(p,'w').write(s)
PY
echo "www pronto: $(find www -type f | wc -l) arquivos, $(du -sh www | cut -f1)"
