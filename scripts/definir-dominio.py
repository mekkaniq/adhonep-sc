#!/usr/bin/env python3
"""Define o domínio final: SEO (canonical/og), sitemap.xml, robots.txt e CNAME.
Uso:  python3 scripts/definir-dominio.py www.seudominio.org.br
(Rode na raiz do projeto. Pode rodar de novo para trocar o domínio.)"""
import sys, re, pathlib
if len(sys.argv) != 2 or '.' not in sys.argv[1] or '/' in sys.argv[1]:
    sys.exit('Uso: python3 scripts/definir-dominio.py www.seudominio.org.br  (sem https:// e sem barra)')
d = sys.argv[1].strip().lower(); base = f'https://{d}/'
bloco = f'''<!--SEO-INICIO-->
<link rel="canonical" href="{base}">
<meta name="description" content="Encontre um capítulo ativo, descubra os próximos eventos e conheça o trabalho da ADHONEP em Santa Catarina.">
<meta property="og:type" content="website"><meta property="og:locale" content="pt_BR">
<meta property="og:site_name" content="ADHONEP-SC"><meta property="og:title" content="ADHONEP-SC | Associação de Homens de Negócio do Evangelho Pleno">
<meta property="og:description" content="Encontre um capítulo ativo e conheça os próximos eventos da ADHONEP em Santa Catarina.">
<meta property="og:url" content="{base}"><meta property="og:image" content="{base}assets/og-image.png">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image">
<!--SEO-FIM-->'''
p = pathlib.Path('index.html'); h = p.read_text(encoding='utf8')
h = re.sub(r'<meta name="description"[^>]*>\s*', '', h)  # a descrição passa a vir do bloco SEO (evita duplicar)
h, n = re.subn(r'<!--SEO-INICIO-->.*?<!--SEO-FIM-->', lambda m: bloco, h, flags=re.S)
if n != 1: sys.exit('Marcadores SEO não encontrados no index.html')
p.write_text(h, encoding='utf8')
pathlib.Path('CNAME').write_text(d + '\n')
pathlib.Path('sitemap.xml').write_text(f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>{base}</loc></url></urlset>\n')
pathlib.Path('robots.txt').write_text(f'User-agent: *\nAllow: /\nSitemap: {base}sitemap.xml\n')
print('Pronto para', base, '\nAgora: cadastre', base, 'no Supabase (Authentication > URL Configuration) e faça o commit.')
