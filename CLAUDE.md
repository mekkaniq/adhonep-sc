# ADHONEP-SC — como trabalhamos neste repositório

Plataforma da ADHONEP Santa Catarina: site público + painel por perfil + app (iOS/Android), tudo em HTML/JS
estático no GitHub Pages, com banco e login no Supabase (projeto `ayrdfetnscrfrlcssiua`).
Dono: Eduardo S. (GitHub `mekkaniq`). Fala em português, prefere tudo feito de uma vez até o fim.

## Onde fica cada coisa
| Pasta / arquivo | O que é |
|---|---|
| `/` (raiz) | **Site oficial** (www.adhonepemsc.com.br). Só muda no passo 5 do roteiro. |
| `beta/` | **Versão de teste** (www.adhonepemsc.com.br/beta/). Toda mudança nasce aqui. É também a base do app. |
| `app/` | App Capacitor. `app/scripts/build-web.sh` monta `app/www` a partir do `beta/` + `app/native/`. |
| `beta-global/` | Plataforma global (mundo → país → estado). Separada da de SC. |
| `supabase/esquema/00-base.sql` | Estrutura do banco de produção (sem dados). Ponto de partida dos testes. |
| `supabase/migracoes/` | Mudanças de banco NOVAS, uma por arquivo (`vX.Y-assunto.sql`), aplicadas depois da base. |
| `supabase/*.sql` (soltos) | Histórico das migrações antigas. Não rodar de novo. |
| `supabase/functions/` | Funções do servidor (a de usuários é publicada como `rapid-responder`). |
| `testes/` | Testes do banco e de tela. Ver `testes/LEIA-ME.md`. |
| `loadtest/` | Teste de carga k6 (roda pelo GitHub, só leitura). |
| `docs/BACKLOG.md` | **Única lista de pendências e prioridades.** |

## Regras que não mudam
- Identidade visual: azul ADHONEP de base, dourado nos detalhes. Sem laranja/marrom; vermelho só o do fogo da tocha.
- Telas que já são escuras por design (Central, mapas, capa, menu, rodapé, Eventos no app) não mudam no tema escuro.
- Privacidade: o que é público mostra só o necessário (ex.: evento mostra a cidade, não o capítulo). Telefone de
  diretor nunca é público. Aceite da Política de Privacidade obrigatório no cadastro.
- Perfis: administrador mexe em tudo e é o único que exclui (exceções em `testes/banco/30-perfis.sql`);
  diretor estadual publica mas não exclui; diretor regional aprova relatórios e publica comunicados da região dele;
  presidente publica eventos e envia relatórios do capítulo dele; sócio só vê.
- Plataforma de SC é só de SC. Troca de estado/nível global só aparece para quem tem papel nacional/global.
- No navegador, só a chave publicável (`sb_publishable_...`). Nunca `service_role`, nunca senha real em teste.
- Versões das entregas: "claude v1.x" (a última está em `docs/BACKLOG.md` → Feito).

## Testes (rodam sozinhos no GitHub a cada push e pull request — workflow "Testes (banco e tela)")
- Banco: `PGHOST=... PGUSER=... testes/banco/rodar.sh` — Postgres vazio, carrega `00-base.sql` + `migracoes/`, confere RLS,
  o que o visitante pode e as regras de perfil. Imprime OK/FAIL e sai com erro se falhar.
- Tela: `cd testes && npm install && npx playwright install chromium && node tela/rodar.js` — `/beta` com Supabase simulado.
- **Funcionalidade nova entra com teste novo** (no `30-perfis.sql` se for regra de acesso; no `tela/rodar.js` se for tela).

## Roteiro de entrega (toda mudança)
1. **Branch e backlog.** Criar branch a partir da `main` (`git checkout -b <assunto> main`) e colocar o item em
   "Fazendo agora" no `docs/BACKLOG.md`.
2. **Teste antes/depois.** Rodar os testes na `main` e na branch e mostrar os dois resultados ao Eduardo.
   Não é teste A/B: é provar que nada antigo quebrou (o que passava na `main` continua passando na branch) e que o novo funciona.
   O GitHub roda os dois sozinho (push na branch + último run da `main`); localmente: `git stash`/`git worktree` e rodar de novo.
3. **Publicar primeiro no /beta/ e validar no navegador** (navegador integrado ou Claude in Chrome).
   Como o GitHub Pages publica a `main` inteira, "publicar no beta" = juntar na `main` uma mudança que só mexe em `beta/`
   (e `app/`), deixando a raiz (oficial) como está. Precisa de login? **Chamar o Eduardo: a senha quem digita é ele.**
4. **Mudou banco, RLS, permissões ou perfis? PARAR.** Banco é um só para beta e oficial: aplicar na produção afeta os dois.
   Mostrar ao Eduardo o resultado do teste do banco (antes/depois) e só aplicar no Supabase depois do ok dele.
   O arquivo vai para `supabase/migracoes/` com "STATUS: PENDENTE" até ser aplicado; depois vira "APLICADA em dd/mm/aaaa".
5. **Oficial.** Levar a mudança para a raiz, merge, commit e push na `main` (o GitHub Pages publica o oficial).
   Conferir o site no ar e, se mexeu no app, gerar o build (iOS: workflow "App iOS → TestFlight" com o próximo número).
6. **Fechar.** Mover o item para "Feito" com data e versão "claude v1.x" e mandar ao Eduardo **só o zip**
   (`adhonep-beta-claude-v1.x.zip`, conteúdo da pasta `beta/`).

Pedidos que o Eduardo manda aos poucos para "subir tudo de uma vez" vão para a branch `proximo-pacote` e para
"Próximas" no backlog, até ele pedir para subir.

## Banco mudou fora das migrações?
Se algo foi alterado direto no SQL Editor do Supabase, exporte a estrutura de novo (passo a passo em
`testes/LEIA-ME.md`) para o `00-base.sql` continuar igual à produção.
