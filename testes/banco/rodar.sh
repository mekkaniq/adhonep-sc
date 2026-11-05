#!/usr/bin/env bash
# ADHONEP-SC · teste do banco: monta um Postgres do zero só com o SQL do projeto e confere as regras.
# Uso: testes/banco/rodar.sh   (variáveis PGHOST, PGPORT, PGUSER, PGPASSWORD apontam para um Postgres VAZIO de teste)
# Nunca aponte para a produção: o script cria e apaga o banco "adh_teste".
set -euo pipefail
cd "$(dirname "$0")/../.."
DB=adh_teste
Q="psql -X -q -v ON_ERROR_STOP=1"
echo "== Banco de teste: montando do zero"
$Q -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null
carrega() { echo "   carregando $1"; $Q -d $DB -f "$1" >/dev/null 2>/tmp/adh_carga.log || { cat /tmp/adh_carga.log; echo "FAIL ao carregar $1"; exit 1; }; }
carrega testes/banco/00-supabase-simulado.sql
carrega supabase/esquema/00-base.sql
for f in $(ls supabase/migracoes/*.sql 2>/dev/null | sort); do carrega "$f"; done
carrega testes/banco/10-ferramentas-e-dados.sql
echo "== Checagens"
for f in testes/banco/2*.sql testes/banco/3*.sql; do
  $Q -d $DB -f "$f" 2>&1 | sed -n 's/^.*NOTICE:  //p'
done
TOTAL=$($Q -At -d $DB -c "select count(*) from teste.resultado")
FALHAS=$($Q -At -d $DB -c "select count(*) from teste.resultado where not ok")
echo "== Banco: $((TOTAL-FALHAS)) OK, $FALHAS FAIL (de $TOTAL)"
[ "$FALHAS" = "0" ] || { echo "RESULTADO: FAIL"; exit 1; }
echo "RESULTADO: OK"
