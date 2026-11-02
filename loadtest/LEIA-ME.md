# Teste de carga (k6) — ADHONEP-SC

Mede quanto tempo o **Supabase** (banco, login e funções) leva para responder quando muita gente abre o site e o app ao mesmo tempo. É **só leitura**: não grava nada no banco.

## Como rodar (pelo GitHub, sem instalar nada)
1. **Uma vez só:** em *Settings → Secrets and variables → Actions*, crie:
   - `K6_EMAIL` = e-mail de uma conta de **teste** (perfil sócio ou presidente; nunca a sua de administrador)
   - `K6_PASSWORD` = senha dessa conta
   (Sem eles o teste roda só a parte pública do site.)
2. *Actions → Teste de carga (k6) → Run workflow* e escolha o perfil:
   - **fumaca** (1 min): confere se tudo responde. Rode primeiro.
   - **lancamento** (9 min): uso real do lançamento — ~100 logados + 60 visitantes, cada um abrindo e navegando a cada 2–4 min.
   - **pico** (9 min): estresse — até 300 logados + 150 visitantes recarregando a cada ~20–30 s. Rode fora do horário de uso e espere ~1 h entre um teste pesado e outro (o plano gratuito tem "créditos" de CPU que se esgotam).
3. Ao terminar, o resumo aparece na própria página do workflow (tempos, falhas e se passou nas metas).

## Metas (passa = ✅)
- Menos de 1% de falhas
- 95% das consultas em menos de 0,8 s
- Site público abre em menos de 2,5 s; app logado em menos de 3 s; login em menos de 2 s

## Observações
- O site (GitHub Pages) não entra no teste: é estático, servido pela CDN do GitHub.
- O login roda em ritmo baixo de propósito: o Supabase limita logins por IP e o teste sai de uma máquina só. Isso não é limite dos usuários reais (cada um tem o próprio IP).
- No plano gratuito do Supabase, o perfil **pico** pode mostrar lentidão que não aconteceria no plano pago.
