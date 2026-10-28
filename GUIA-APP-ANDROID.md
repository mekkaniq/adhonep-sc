# ADHONEP SC no Android (Google Play) — passo a passo

Pacote do app: `br.com.adhonepemsc.app` · Nome: **ADHONEP SC**

## 1. Gerar o app (GitHub)
1. GitHub → **Actions** → **App Android → Google Play** → **Run workflow** (build 1, versão 1.0.0).
2. Ao terminar (uns 8 min), baixe o artefato **android-ADHONEP-SC**: tem o `.apk` (instala direto no Xiaomi para testar) e o `.aab` (é o que vai para o Google Play).
3. **Só na primeira vez**: o workflow cria a chave de assinatura e gera também o artefato **chave-android-GUARDE-PRIVADO** (dois arquivos .txt). Guarde-os num lugar seguro e cadastre-os em *Settings → Secrets and variables → Actions* com os nomes:
   - `ANDROID_KEYSTORE_B64` = conteúdo de `ANDROID_KEYSTORE_B64.txt`
   - `ANDROID_KEYSTORE_PASSWORD` = conteúdo de `ANDROID_KEYSTORE_PASSWORD.txt`
   (Sem isso, o próximo build criaria outra chave e o Google recusaria.) Não cole esses valores no chat.

## 2. Testar no Xiaomi
- Passe o `.apk` para o celular e instale (permitir "fontes desconhecidas" quando pedir).
- Xiaomi/MIUI: em *Configurações → Apps → ADHONEP SC* ative **Notificações** e **Início automático**, e deixe a economia de bateria em **Sem restrições**, senão avisos podem atrasar.

## 3. Conta Google Play Console
- play.google.com/console → conta de desenvolvedor (US$ 25, uma vez). Escolha **Organização** se a ADHONEP tiver CNPJ (exige número D-U-N-S, gratuito, demora dias) ou **Pessoal**.
- **Conta pessoal nova**: o Google exige **teste fechado com 12 testadores por 14 dias seguidos** antes de liberar a publicação. Conta de organização não tem essa exigência.
- Criar app → nome "ADHONEP SC", idioma Português (Brasil), app gratuito.

## 4. Publicar
1. Teste interno/fechado: *Testes → Teste fechado → Criar versão* → enviar o `.aab`. Ative o **Play App Signing** (aceitar o padrão).
2. Preencher: ficha da loja (texto abaixo), política de privacidade `https://www.adhonepemsc.com.br/privacidade.html`, **Segurança dos dados**, classificação de conteúdo, público-alvo (18+), declaração de anúncios (não tem).
3. Dados do revisor: conta de demonstração (perfil sócio) com e-mail e senha.
4. Exclusão de conta: informar o caminho no app (Configurações → Minha conta → Solicitar exclusão).
5. Depois dos 14 dias / aprovação: *Produção → Criar versão*.

## 5. Notificações (opcional, depois)
Precisa de um projeto Firebase gratuito: criar app Android `br.com.adhonepemsc.app`, baixar `google-services.json` e cadastrar o conteúdo como segredo `GOOGLE_SERVICES_JSON`. Sem isso o app funciona normalmente, só sem notificações push no Android (avisos continuam na aba Avisos).

## Ficha da loja (rascunho)
- **Nome (30):** ADHONEP SC
- **Descrição curta (80):** Capítulos, eventos e avisos da ADHONEP em Santa Catarina.
- **Descrição completa:** o mesmo texto de `app/LOJA-ficha.md` (seção Descrição).
- **Categoria:** Negócios (ou Estilo de vida) · **Contato:** e-mail da ADHONEP
- **Imagens:** ícone 512×512 (já em `app/assets`), gráfico de destaque 1024×500 e ao menos 2 capturas de tela do celular (tirar do app real).
- **Segurança dos dados:** coleta nome, e-mail, telefone (cadastro), criptografados em trânsito, exclusão disponível; sem compartilhamento com terceiros, sem anúncios.
