# Relatório de segurança — plataforma ADHONEP-SC
**Data:** 25/11/2026 · **Teste:** simulação de ataque externo (Claude agindo como invasor), sem a chave secreta e sem acesso de administrador.
**Regra seguida:** nenhum dado real foi alterado — toda tentativa de escrita rodou em transação desfeita (ROLLBACK).

## Veredito
**Nenhuma vulnerabilidade crítica ou alta.** Não foi possível virar administrador, ler dados de outro capítulo/região, apagar nada, nem extrair segredos. As defesas (RLS do banco + funções com checagem de permissão) seguraram em todos os perfis. Os achados abaixo são de **baixo risco e configuração** — melhorias, não buracos.

---

## O que foi testado e segurou (defesas que funcionaram)

### 1. Visitante sem login (anônimo), atacando a API real com a chave pública
| Tentativa | Resultado |
|---|---|
| Ler `profiles` (nomes, telefones) | 🔒 negado |
| Ler `user_roles` (quem é o quê) | 🔒 negado |
| Ler `admin_audit_log` (histórico) | 🔒 negado |
| Ler `regions` (dados/telefone de diretor) | 🔒 negado |
| Ler `chapter_contacts` (telefones privados) | 🔒 negado |
| Ler capítulos não publicados | 🔒 não aparecem (vê só 35 dos 69 — os públicos) |

### 2. Sócio comum (menor nível com login) — 10 ataques, 10 bloqueados
Inserir papel de admin para si · subir a própria função para admin · virar presidente de outro capítulo · editar capítulo alheio · apagar capítulo · editar perfil de outra pessoa → **todos bloqueados**. Lê **só o próprio** perfil e papel; **0** relatórios e **0** registros de histórico visíveis.

### 3. Presidente de capítulo — 11 ataques, 11 bloqueados
Virar admin/diretor · assumir outro capítulo · apagar o próprio capítulo · apagar sócios de outro capítulo · publicar comunicado estadual · ler telefones ou alterar relatório de outro capítulo → **todos bloqueados**.

### 4. Diretor regional — 7 ataques, 7 bloqueados
Virar admin/estadual · auto-conceder outra região · editar capítulo, relatório, telefones ou comunicado de região que não é dele → **todos bloqueados**. O ranking dele roda **filtrado** só para as regiões dele.

### 5. Funções com privilégio elevado (RPC) — 11 testadas como sócio, 11 recusaram
Conceder papel **nacional** · criar região · mover município · **mudar a data de cobrança** · dar acesso ao ranking · **aprovar cadastro** · disparar notificação para todos · **exportar dados LGPD de outra pessoa** · **anonimizar (destruir) dados de outra pessoa** · virar editor de preletores · semear capítulos em massa → **todas exigiram administrador e recusaram o sócio.**

### 6. Segredos e arquivos
- No navegador há **só a chave pública** (`sb_publishable_`), como deve ser. O "service_role" que aparece no código é só comentário/mensagem — **não é chave**.
- **Histórico inteiro do Git (136 commits): nenhuma chave secreta vazada.**
- Buckets privados (**biblioteca** e **fotos de relatório**) estão trancados por perfil; os públicos são imagens que já aparecem no site.
- **RLS ligado nas 36 tabelas.**

---

## Achados (baixo/médio) — melhorias recomendadas

**1. [MÉDIO, fácil] Proteção contra senha vazada está desligada.**
O Supabase pode recusar senhas que já apareceram em vazamentos públicos (HaveIBeenPwned). Hoje está desligado. Ligar é 1 clique no painel. Vale ligar **antes** de convidar os diretores, já que entram com senha provisória.
→ Painel Supabase › Authentication › Policies › "Leaked password protection".

**2. [BAIXO] Anônimo lê as tabelas `chapters` e `events` direto (não só as vitrines).**
Dos capítulos públicos, o anônimo vê campos extras (número, endereço, anotações, nome do presidente/vice) e, nos eventos publicados, o `chapter_id` — que liga o evento ao capítulo, contra a regra "mostra a cidade, não o capítulo". Hoje `anotações`/`endereço` estão vazios, então **não há vazamento real** agora. Recomendação: expor ao anônimo só o que as vitrines mostram (restringir colunas ou tirar o SELECT do anônimo nas tabelas cruas).

**3. [BAIXO] As 3 vitrines públicas são "SECURITY DEFINER" (o Supabase marca como erro).**
Elas filtram certo (só capítulo público, ativo e que marcou `show_public`), então **não vazam** — hoje retornam vazio. Hardening: converter para `security_invoker`. Atenção a uma opção: o **telefone do presidente pode ficar público** se o capítulo marcar "mostrar publicamente" — hoje ninguém marcou. Confirmar se essa opção (opt-in, telefone de presidente, não de diretor) é desejada.

**4. [BAIXO] Formulário de cadastro e registro de aparelho abertos ao anônimo.**
É necessário (cadastro público pelo site e registro do app). Risco: alguém pode floodar envios (spam). Recomendação futura: limite de taxa / captcha no formulário público — já previsto no plano de hardening (Vercel/firewall) do backlog.

**5. [INFO] O Supabase lista 70 funções e 7 tabelas nos alertas.**
São a **API interna do app** (chamadas por quem está logado, cada uma com sua checagem — confirmado nos testes) e **tabelas trancadas só para o servidor** (backups, notificações, aparelhos). É o esperado, não é falha. Opcional: reduzir o ruído do alerta restringindo o EXECUTE das funções-auxiliares.

---

## Observação (funcional, não de segurança)
O presidente **não edita o próprio capítulo** direto na tabela `chapters` (a edição passa por função controlada). É restrição, não falha — mas vale confirmar se o fluxo de edição do presidente está funcionando pela tela.

## Próximos passos sugeridos (em ordem)
1. Ligar a proteção contra senha vazada (1 min).
2. Restringir o anônimo às vitrines (achado 2) e converter as vitrines para `security_invoker` (achado 3) — pequena migração de banco, com backup.
3. Confirmar a decisão sobre telefone público de presidente (achado 3).
4. No hardening com domínio próprio: limite de taxa/captcha no cadastro público (achado 4).

_Teste conduzido por Claude (Opus) a pedido do Eduardo, na madrugada de 25/11/2026. Reexecutar após mudanças de banco e antes do lançamento aos sócios._
