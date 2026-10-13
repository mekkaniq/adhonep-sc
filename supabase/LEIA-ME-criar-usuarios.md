# Criar usuários pelo painel (claude v2.4)

O navegador nunca pode guardar a chave `service_role`. Por isso a criação de contas roda numa **Edge Function** do Supabase.

## Publicar a função (sem instalar nada)
1. Supabase → **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Nome: `admin-create-user` (exatamente).
3. Apague o código de exemplo, cole o conteúdo de `supabase/functions/admin-create-user/index.ts` e clique **Deploy**.
4. (Importante) Nas configurações da função, deixe **Verify JWT** ligado. `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já existem automaticamente.

## Usar
Painel → Usuários e acessos → **+ Novo usuário**.
- Com **senha provisória**: conta nasce ativa; repasse a senha e peça para trocar.
- Sem senha: envia convite por e-mail (o envio padrão do Supabase é limitado a poucos e-mails por hora; configure SMTP próprio se for convidar muitos).
- Somente `state_admin` consegue (a função confere no banco).

Requisitos de tabela: `profiles(id, full_name, phone)` e `user_roles(user_id, role, is_active, region_id, chapter_id)`.

## v2.4 — o que mudou (faça nesta ordem)
1. SQL Editor → rode `supabase/migracao-v2.3-socios-e-exclusao.sql` (cria o perfil Sócio, regras de leitura e a exclusão só do admin).
2. Edge Functions → `admin-create-user` → cole o NOVO `index.ts` e faça Deploy de novo (agora também exclui e ativa/desativa).
3. Suba os arquivos no GitHub.

Regras: administrador cria qualquer perfil e é o único que exclui. Presidente cadastra/desativa/reativa só sócios do próprio capítulo.
Sócio vê: eventos publicados do próprio capítulo, comunicados publicados (estaduais + da sua região) e edita o próprio nome/telefone.

## v2.4 — lançamento
Rode `supabase/migracao-v2.4-lancamento.sql`. Ela troca a trava antiga (40 pedidos/hora no site todo) por: bloqueio de e-mail repetido (pendente ou aprovado), pausa de 7 dias após rejeição e teto de 300/minuto e 3000/hora contra robôs.
No painel: Solicitações de cadastro → **Exportar planilha (CSV)** para aprovar em lote.
