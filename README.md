# ADHONEP-SC claude v1.6

Site estático (HTML + JS) com Supabase, para GitHub Pages (raiz do repositório).

- `index.html`, `styles.css`, `js/`, `assets/`, `privacidade.html` (**modelo: preencher**), `404.html`, `robots.txt`, `.nojekyll`
- `supabase/` — SQL. Ordem: 3v.4 → 3v.6 → 3v.8 → v1.2-imagens → v1.3-publicacao → v1.4-perfis-e-publicacao → **v1.5-grants** (obrigatório; a v1.6 não tem SQL novo) (corrige o erro "permission denied for table events"). `auditoria-readonly.sql` só consulta.
- `scripts/definir-dominio.py` e `docs/PUBLICACAO-PASSO-A-PASSO.md` — publicação.
- `STATUS-claude-v1.6.md` — regras de perfis, roteiro de testes e pendências. Leia antes de publicar.

No navegador use SOMENTE a chave publicável (`sb_publishable_...`). Nunca `service_role`.
