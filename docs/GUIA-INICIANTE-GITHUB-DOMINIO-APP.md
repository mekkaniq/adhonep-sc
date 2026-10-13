# Guia para iniciantes — colocar o site no ar com www.adhonepemsc.com.br

Você vai usar 4 serviços: **GitHub** (guarda e publica os arquivos), **Supabase** (banco de dados e login), **seu domínio** (o endereço) e, depois, o **celular** (app instalável). Tudo pelo navegador, sem programar.

## Parte 1 — GitHub (guardar e publicar o site)
1. Acesse github.com → **Sign up**. Crie a conta com um e-mail que você sempre acessa e **ative a verificação em duas etapas** (Settings → Password and authentication).
2. Canto superior direito **+ → New repository**. Nome: `adhonep-sc`. Marque **Public**. Não marque nenhuma caixa de "Add README". Clique **Create repository**.
3. No seu computador, **descompacte** o zip `adhonep-sc-claude-v1.6.zip`. Entre na pasta até ver o arquivo `index.html`.
4. Na página do repositório recém-criado, clique em **uploading an existing file**.
5. Selecione **todos os arquivos e pastas de dentro** da pasta (não a pasta em si — o `index.html` precisa ficar na raiz) e arraste para a janela do GitHub. Espere terminar de carregar.
6. Embaixo, clique **Commit changes**. Pronto: o código está salvo.
   - Para atualizar no futuro: repita o upload com os arquivos novos; o GitHub substitui os de mesmo nome. O histórico fica guardado e dá para voltar atrás.
   - Se alguma pasta não subir, entre em **Add file → Upload files** e envie as pastas `js`, `assets`, `supabase`, `docs`, `scripts` uma a uma.
7. Ative o site: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `(root)` → Save**. Em 1 a 3 minutos aparece o endereço `https://SEU-USUARIO.github.io/adhonep-sc/` — já dá para testar nele.

## Parte 2 — Domínio www.adhonepemsc.com.br
1. Em **Settings → Pages → Custom domain**, digite `www.adhonepemsc.com.br` e **Save**. (O arquivo `CNAME` já vem pronto no projeto.)
2. No lugar onde você comprou o domínio (Registro.br ou outra empresa), abra a **edição de DNS** e crie:
   - **CNAME**: nome `www` → valor `SEU-USUARIO.github.io` (com o seu usuário do GitHub, sem `https://` e sem barra).
   - Para o endereço sem `www` abrir também, crie 4 registros **A** com nome vazio (ou `@`): `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` (confirme a lista atual na documentação do GitHub Pages).
   - Se o domínio estiver no Registro.br: Painel → seu domínio → **DNS → Editar zona** (use o DNS do próprio Registro.br).
3. Aguarde de alguns minutos até algumas horas. Volte em Settings → Pages: quando aparecer "DNS check successful", marque **Enforce HTTPS** (cadeado).
4. **Supabase** (obrigatório, senão o login e a recuperação de senha falham): Authentication → **URL Configuration** → *Site URL* = `https://www.adhonepemsc.com.br/` e, em *Redirect URLs*, adicione `https://www.adhonepemsc.com.br/**` e, só durante os testes, `https://SEU-USUARIO.github.io/**`.
5. No Supabase → SQL Editor, confira que rodou, nesta ordem, as migrações da pasta `supabase/` até `migracao-v1.5-grants.sql`.

## Parte 3 — Celular
O site já é adaptado para celular (menus, botões, formulários, mapa com toque). Teste no seu aparelho abrindo o endereço. A v1.6 também permite **instalar como app**:
- **Android (Chrome):** menu ⋮ → **Instalar app** (ou "Adicionar à tela inicial").
- **iPhone (Safari):** botão Compartilhar → **Adicionar à Tela de Início**.
O ícone aparece como um app, abre em tela cheia e carrega mais rápido. Os dados continuam vindo do Supabase.

## Parte 4 — Virar app de loja (opcional, depois)
1. **Agora (grátis):** o app instalável acima (PWA). Recomendo começar por ele e ver se os líderes usam.
2. **Google Play:** dá para empacotar o mesmo site com o PWABuilder (pwabuilder.com) e publicar. Exige conta de desenvolvedor Google (taxa única, hoje cerca de US$ 25).
3. **App Store (iPhone):** exige conta Apple Developer (anual, hoje cerca de US$ 99), um Mac e um empacotador (ex.: Capacitor). A Apple costuma recusar apps que são só um site; seria preciso algo nativo (notificações, por exemplo).
Confira valores e regras atuais antes de decidir.

## Segurança (importante)
- No código só pode existir a chave **sb_publishable_…**. Nunca coloque `service_role` nem senhas no GitHub.
- Ative verificação em duas etapas no GitHub, no Supabase e no provedor do domínio.
- Guarde as senhas em um gerenciador de senhas e o e-mail de recuperação do domínio.
