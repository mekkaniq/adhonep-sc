#!/usr/bin/env python3
"""ADHONEP-SC · monta a pasta que vai para o ar (GitHub Pages pelo Actions ou Vercel).
Copia só os arquivos do site: tudo o que o git conhece MENOS o que está em .vercelignore
(documentação, SQL, testes, zips, app nativo...). Uso: python3 scripts/montar-site.py _site
"""
import fnmatch, os, shutil, subprocess, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DESTINO = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, '_site'))

regras = []
for linha in open(os.path.join(RAIZ, '.vercelignore'), encoding='utf-8'):
    linha = linha.strip()
    if linha and not linha.startswith('#'):
        regras.append(linha)

def fora(caminho):
    partes = caminho.split('/')
    if any(p.startswith('.') for p in partes):          # .github, .nojekyll, .vercelignore...
        return True
    if caminho == 'vercel.json':
        return True
    for r in regras:
        if r.endswith('/'):                               # pasta: em qualquer nível ou caminho exato
            r = r.rstrip('/')
            if '/' in r:
                if caminho.startswith(r + '/'):
                    return True
            elif r in partes[:-1]:
                return True
        elif '/' in r:
            if fnmatch.fnmatch(caminho, r):
                return True
        elif fnmatch.fnmatch(partes[-1], r):              # padrão de nome: em qualquer pasta
            return True
    return False

arquivos = subprocess.run(['git', '-C', RAIZ, 'ls-files', '-z'], capture_output=True, check=True).stdout.decode().split('\0')
if os.path.exists(DESTINO):
    shutil.rmtree(DESTINO)
n = 0
for a in filter(None, arquivos):
    if fora(a) or not os.path.isfile(os.path.join(RAIZ, a)):
        continue
    os.makedirs(os.path.dirname(os.path.join(DESTINO, a)) or DESTINO, exist_ok=True)
    shutil.copy2(os.path.join(RAIZ, a), os.path.join(DESTINO, a))
    n += 1
open(os.path.join(DESTINO, '.nojekyll'), 'w').close()
print(f'{n} arquivos do site em {DESTINO}')
