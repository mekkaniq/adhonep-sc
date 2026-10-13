# Publicação oficial — GitHub Pages + domínio próprio

Tempo estimado: 1 a 2 horas (o DNS pode levar horas para propagar).

## 0. Antes de tudo
1. **Backup do banco** (Supabase → Database → Backups, ou exporte as tabelas) e guarde.
2. Rode no Supabase, **nesta ordem e só se ainda não rodou**: `migracao-v1.2-imagens-eventos.sql`, `migracao-3v.8-relatorios-perfis.sql`, `migracao-v1.3-publicacao.sql`, `migracao-v1.4-perfis-e-publicacao.sql`. Confira a mensagem final de cada uma.
3. Preencha e revise `privacidade.html` (campos `[PREENCHER]`); apague o aviso de modelo.

## Teste antes do domínio oficial
Você não precisa de domínio para testar: o GitHub Pages (passo 2) já dá um endereço `https://SEU-USUARIO.github.io/NOME-DO-REPO/` de graça. Alternativas equivalentes para site estático: Cloudflare Pages ou Netlify (arrastar a pasta). O Lovable **não é indicado** para este projeto: ele cria os próprios projetos em React e não importa um repositório existente, então seria preciso reconstruir o site dentro dele.

## 1. Repositório no GitHub
1. Crie o repositório (ex.: `adhonep-sc`). **Público** funciona no plano gratuito do Pages; **a chave `sb_publishable_` pode ficar no código**, pois o acesso é protegido por RLS. **Nunca** coloque `service_role` nem senhas.
2. Envie TODO o conteúdo desta pasta para a branch `main` (arraste os arquivos em *Add file → Upload files*, ou use `git`). O `index.html` precisa ficar na **raiz**.
3. Crie uma tag da versão: *Releases → Create a new release → tag `claude-v1.6`* (permite voltar atrás).

## 2. Ativar o GitHub Pages
*Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch `main`, pasta `/ (root)` → Save.* Em alguns minutos o site abre em `https://SEU-USUARIO.github.io/NOME-DO-REPO/`.

## 3. Domínio oficial
1. No seu computador, na pasta do projeto: `python3 scripts/definir-dominio.py www.SEU-DOMINIO.org.br` (ou me passe o domínio e eu gero os arquivos). Isso ajusta canonical, prévia do WhatsApp (og:image), `sitemap.xml`, `robots.txt` e `CNAME`. Envie os arquivos alterados ao GitHub.
2. No provedor do domínio (DNS): crie um registro **CNAME** `www` → `SEU-USUARIO.github.io`. Para o domínio sem `www`, crie os registros **A** indicados na documentação oficial do GitHub Pages (confira a lista atual lá antes de usar).
3. Em *Settings → Pages → Custom domain*, digite o domínio e salve. Quando o certificado for emitido, marque **Enforce HTTPS**.

## 4. Supabase (obrigatório, senão login e recuperação de senha falham)
*Authentication → URL Configuration:* **Site URL** = `https://www.SEU-DOMINIO.org.br/` e acrescente em **Redirect URLs** o mesmo endereço (e, durante os testes, o endereço `github.io`).
Se o domínio mudar, atualize também a política CSP no `index.html` só se o projeto Supabase mudar (hoje ela permite apenas o seu projeto).

## 5. Contas dos diretores e presidentes
O sistema **não cria contas sozinho**. Fluxo: pedido no site → você cria o usuário em *Authentication → Users → Add user → Send invitation* (ou *Create new user*) → aprova o pedido na plataforma, que concede o papel. Quem esquecer a senha usa "Esqueci minha senha" na tela de login.

## 6. Teste final (desktop e celular, abas anônimas)
- Visitante: abre o site, vê mapa/eventos, envia uma solicitação de teste (e a segunda com o mesmo e-mail deve ser recusada).
- Presidente, diretor regional (da região e de outra região) e administrador: roteiro do `STATUS-claude-v1.3.md`.
- Compartilhe o link no WhatsApp: confira título e imagem da prévia.
- Console do navegador (F12): sem erros vermelhos.

## 7. Se algo der errado
Volte à tag anterior no GitHub (*Releases*) e republique. O banco tem o backup do passo 0.


## Teste gratuito (sem domínio próprio)
1. GitHub → repositório → Settings → Pages → Deploy from branch (`main`, raiz). O endereço fica `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/` (o nome do repositório é o nome do site).
2. Supabase → Authentication → URL Configuration: coloque esse endereço em *Site URL* e em *Redirect URLs*.
3. Alternativas gratuitas: Cloudflare Pages ou Netlify (arraste a pasta; ganha `nome.pages.dev` / `nome.netlify.app`).
4. Domínio oficial depois: registre em registro.br (ex.: adhonep-sc.org.br), aponte no GitHub Pages, rode `scripts/definir-dominio.py` e atualize as URLs no Supabase.
