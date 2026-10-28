# ADHONEP-SC como aplicativo (iPhone) — passo a passo

Nome do app: **ADHONEP-SC** · Bundle ID: **br.com.adhonepemsc.app** · Dados: só Santa Catarina (site da raiz).

## PARTE 1 — Você: conta de desenvolvedor (pessoa física)
Custo: **US$ 99/ano** (cobrado em dólar; cartão internacional). Fonte: https://developer.apple.com/support/enrollment/

1. Tenha um **Apple Account (Apple ID) seu**, com **verificação em duas etapas ligada** (Ajustes do iPhone → seu nome → Senha e Segurança).
2. Confira que o nome do Apple Account é seu **nome legal completo**, igual ao documento. Ele aparecerá na App Store como vendedor ("Seller"). Não use apelido.
3. No iPhone, baixe o app **Apple Developer** (ou acesse https://developer.apple.com/programs/enroll/ no navegador).
4. Entre com o Apple Account → **Enroll / Inscrever-se** → tipo **Individual / Pessoa física**.
5. Preencha endereço e telefone. Confirme os dados com o documento (CPF/RG como pedido).
6. Aceite o contrato e **pague os US$ 99**. Use **cartão em seu nome** (cartão de terceiro faz a Apple pedir foto do documento e atrasa).
7. Aguarde o e-mail de confirmação (normalmente até 24 h; se passar disso, fale com o Suporte Apple Developer informando o *Enrollment ID*).
8. Quando ativo, abra https://developer.apple.com/account → anote o **Team ID** (Membership details, 10 caracteres).

**Atenção (decisão consciente):** no app aparecerá o **seu nome** como publicador. Para trocar para a ADHONEP depois é preciso uma conta de **organização** (exige CNPJ + número D-U-N-S) e transferir o app. Dá para fazer sem perder nada, mas é um processo à parte.

## PARTE 2 — Você: preparar o app na App Store Connect
https://appstoreconnect.apple.com (mesmo login)
1. **Business → aceite os contratos** (Apps Pagos/Gratuitos). App gratuito: basta o contrato de apps gratuitos.
2. **Users and Access → Integrations → App Store Connect API → Generate API Key** (acesso **App Manager**). Anote: **Key ID**, **Issuer ID** e baixe o arquivo **.p8** (só baixa uma vez!).
3. **Certificates, Identifiers & Profiles** (developer.apple.com → Identifiers → +): crie o App ID com Bundle ID **br.com.adhonepemsc.app**.
4. **Apps → + → New App**: plataforma iOS, nome **ADHONEP-SC**, idioma Português (Brasil), Bundle ID acima, SKU `adhonep-sc-1`.

## PARTE 3 — Você: ligar ao GitHub (eu já deixei o build pronto)
Repositório → Settings → Secrets and variables → Actions → New repository secret:
- `APPLE_TEAM_ID` = Team ID
- `ASC_KEY_ID` = Key ID
- `ASC_ISSUER_ID` = Issuer ID
- `ASC_KEY_P8` = **todo o conteúdo** do arquivo .p8 (abra no bloco de notas, copie tudo)

Depois: aba **Actions → "App iOS → TestFlight" → Run workflow** (build 1). Em ~15 min o build aparece no **TestFlight** da App Store Connect. Você **não precisa de Mac**.

## PARTE 4 — Testar e enviar para revisão
1. Instale o app **TestFlight** no iPhone, entre com seu Apple Account e instale o ADHONEP-SC. Teste login, mapa, eventos, painel.
2. Na App Store Connect → seu app → **App Information/Privacy**: URL da política de privacidade = `https://www.adhonepemsc.com.br/privacidade.html`; responda o questionário de privacidade (coleta e-mail/nome/telefone de contato, ligados à conta).
3. Preencha a ficha: descrição, palavras-chave, categoria (Estilo de vida ou Negócios), **capturas de tela** (iPhone 6,9" e 6,5"), URL de suporte, classificação etária.
4. **Credenciais de teste para o revisor da Apple** (obrigatório, pois há login): crie um usuário de demonstração (ex.: perfil de sócio) e informe e-mail/senha em *App Review Information*. Eu preparo esse usuário quando você pedir.
5. Selecione o build → **Add for Review**. Revisão costuma levar de 1 a 3 dias.

## Riscos de reprovação (e como já tratei)
- **Guideline 4.2 (app que é só um site)**: a Apple pode reprovar "site embrulhado". O app já carrega o conteúdo localmente (abre offline, ícone, splash). Próxima etapa recomendada: **notificações push** (eventos/comunicados) e **ações nativas** (compartilhar, ligar, abrir rotas) para reforçar o valor nativo.
- **Guideline 5.1.1(v) (exclusão de conta)**: se o app permite criar conta, deve permitir excluí-la. Hoje contas são criadas por admins; recomendo incluir "Solicitar exclusão de conta" no painel. Posso fazer.
- Privacidade: texto atual é só Brasil/LGPD; ok para app de SC.

## Android (depois)
Conta Google Play: US$ 25 (única vez). O mesmo pacote gera o Android (`npm run android:add`).

## Comandos locais (só se tiver Mac)
```
cd app && npm install && npm run web && npx cap add ios && npm run assets && npx cap sync ios && npx cap open ios
```

## Atualização — recursos de app já incluídos
- Barra inferior nativa (Início, Capítulos, Eventos, Sobre, Conta), área segura do iPhone, links externos no navegador do sistema, compartilhar nativo.
- **Exclusão de conta**: Conta → "Solicitar exclusão da conta" (desativa acessos; coordenação conclui; pedidos ficam em `account_deletion_requests`).
- **Push**: o app pede permissão e registra o aparelho (`device_tokens`). Falta o **envio**, que precisa da chave APNs (.p8 de Push) da sua conta Apple: Certificates, Identifiers & Profiles → Keys → + → Apple Push Notifications service (APNs). Quando tiver, me passe Key ID e Team ID e eu ligo o envio por evento/comunicado.

## Atualização 2 — o app agora é a plataforma "beta" completa
Capa com efeito cortina, vídeo de apresentação (mp4), tema claro/escuro, Central de comando, gestão, diretoria e reuniões, mais a camada de app: barra inferior, **Avisos** (caixa de entrada), envio de avisos por líderes (📣 no painel), lembrete de véspera no evento e exclusão de conta.
Avisos automáticos (evento novo / pendência de cadastro / lembrete diário): rodar `supabase/PENDENTE-gatilhos-avisos.sql` no SQL Editor (a criação automática foi bloqueada).

## Atualização 3 — recursos nativos
Face ID (entrada rápida), ligar / como chegar / compartilhar no capítulo, adicionar evento ao calendário, uso offline (dados públicos salvos), atalho "Reunião" na barra para líderes, e envio de push preparado em `supabase/functions/send-push` (precisa dos segredos APNS_* e do segredo CRON_SECRET). O app agora usa Capacitor 8 e o fluxo do GitHub roda em macos-26 (Xcode 26, exigido pela Apple).
