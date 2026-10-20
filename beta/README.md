# ADHONEP-SC claude v1.4

Site estático (HTML + JS) com Supabase, para GitHub Pages (raiz do repositório).

- `index.html`, `styles.css`, `js/`, `assets/`, `privacidade.html` (**modelo: preencher**), `404.html`, `robots.txt`, `.nojekyll`
- `supabase/` — SQL. Quem já rodou tudo até a v3.19 só precisa rodar **`migracao-v1.1-gestao.sql`**. Ordem completa: 3v.4 → 3v.6 → 3v.8 → v1.2-imagens → v1.3-publicacao → v1.4-perfis-e-publicacao → **v1.5-grants** (obrigatório) → v2.3 → v2.4 → v2.5 → v3.2 → v3.9 → v3.12 → v3.13 → v3.19 → **v1.1-gestao**. `auditoria-readonly.sql` só consulta.
- `scripts/definir-dominio.py` e `docs/PUBLICACAO-PASSO-A-PASSO.md` — publicação.
- `docs/BETA-PASSO-A-PASSO.md` — testar em /beta antes de publicar. `docs/EMAIL-RESEND-PASSO-A-PASSO.md` — e-mail próprio.
- `STATUS-claude-v1.4.md` — regras de perfis, roteiro de testes e pendências. Leia antes de publicar.

No navegador use SOMENTE a chave publicável (`sb_publishable_...`). Nunca `service_role`.
