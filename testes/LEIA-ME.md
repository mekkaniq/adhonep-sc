# Testes do ADHONEP-SC

Rodam sozinhos no GitHub (workflow **Testes (banco e tela)**) a cada push e pull request. Não usam segredos,
não tocam a produção e não usam senha real. Cada checagem imprime `OK` ou `FAIL`; se houver um `FAIL`, o teste sai com erro.

## Banco — `testes/banco/`
Monta um Postgres **vazio** só com o SQL do projeto e confere as regras.

| Arquivo | O que faz |
|---|---|
| `00-supabase-simulado.sql` | Peças do Supabase usadas pelo banco: papéis `anon`/`authenticated`/`service_role`, `auth.users`, `auth.uid()`. |
| `../../supabase/esquema/00-base.sql` | Estrutura da produção (tabelas, funções, RLS, políticas, permissões), sem dados. |
| `../../supabase/migracoes/*.sql` | Mudanças novas, em ordem de nome. |
| `10-ferramentas-e-dados.sql` | Funções de teste (`teste.tenta` roda um comando como uma pessoa e desfaz) e dados fictícios. |
| `20-estrutura.sql` | RLS ligada em todas as tabelas; o visitante só lê o público e só grava o pedido de cadastro; ninguém da API tem TRUNCATE. |
| `30-perfis.sql` | Regras de cada perfil (quem publica, quem aprova, quem só vê, só o administrador exclui). |

Rodar no computador (precisa de um Postgres de teste, nunca o de produção):
```
PGHOST=localhost PGPORT=5432 PGUSER=postgres PGPASSWORD=... bash testes/banco/rodar.sh
```

## Tela — `testes/tela/`
Abre o `/beta` no Chromium (Playwright) com o **Supabase simulado** (`simulador.js`): login de cada perfil,
envio de relatório mensal, comunicados por região no site público e todas as páginas no celular (390 px) sem rolagem lateral.
```
cd testes && npm install && npx playwright install chromium && node tela/rodar.js
```

## Funcionalidade nova = teste novo
- Regra de acesso ou banco → nova checagem em `banco/30-perfis.sql` (use `teste.tenta(teste.uid('presidente'), '...')`).
- Tela → novo bloco em `tela/rodar.js` (use `confere('nome', condição, detalhe)`).

## Atualizar o `00-base.sql` (quando o banco mudar fora das migrações)
1. No Supabase, publicar a função `exportar-esquema` com o conteúdo gerado a partir de `banco/exportar-esquema.sql`
   (só lê o catálogo; não lê dados).
2. GitHub → Actions → **Exportar esquema do banco (manutenção)** → Run workflow (na branch de trabalho).
3. Desligar a função de novo e conferir o diff do `00-base.sql` antes de juntar.
