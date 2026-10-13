# Criar usuários pelo painel (claude v3.1)

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

## v2.5 — solicitações de cadastro
Rode `supabase/migracao-v2.5-solicitacoes.sql`. Ela garante os GRANTs e as regras (RLS) para o formulário público gravar e só o administrador ler/decidir.
No painel, a tela "Solicitações de cadastro" agora carrega ao abrir e se atualiza a cada 45 s.

## v2.7
Sem SQL novo. Suba: index.html, styles.css, js/app.js e sw.js (e mantenha js/supabase.js da v2.6).
Corrige: "Solicitações de cadastro" estava oculta no menu do administrador.

## v2.8
Sem SQL novo. Suba: index.html, sw.js, sitemap.xml, privacidade.html, termos.html e assets/apple-touch-icon-2.png (pasta assets).
Termos de Uso e Política de Privacidade copiados do site anterior (texto idêntico, atualização 22/08/2026).

## v2.9
Sem SQL novo. Suba: index.html, 404.html, sw.js e js/supabase.js (pasta js).
No celular o menu do painel é uma faixa que rola para o lado; "Solicitações de cadastro" agora é o 2º item e há um aviso na Visão geral com a contagem de pedidos pendentes.

## v3.1
Sem SQL obrigatório. Opcional: rode `supabase/checagem-pre-lancamento.sql` (somente leitura) e confira os 4 resultados.
Novo: Histórico de ações agora vem do banco; links de comunicados só aceitam http/https.
Novo na v3.1: botão "Solicitar cadastro" no topo do site público.
