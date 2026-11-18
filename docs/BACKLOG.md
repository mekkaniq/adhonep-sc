# BACKLOG — ADHONEP-SC

Única lista de pendências e prioridades do projeto. Arquivos antigos (`STATUS-claude-*.md`, guias, `app/PROXIMO-PACOTE.md`)
ficam como histórico; o que vale é esta página. Roteiro de entrega: `CLAUDE.md`.

## Fazendo agora
- **Pedidos do diretor estadual, pacote 1 (17/11/2026, branch `pacote-diretor-estadual`)** — no `/beta` e no app:
  (13) **Saúde dos capítulos só de SC** — [banco] v3.21 **APLICADA em 17/11/2026** (antes vinham ~350 capítulos do Brasil; agora 36 ativos e 22 regiões de SC). Teste `36-saude-so-sc.sql`.
  (3) **Relatório de evento com até 3 fotos** — [banco] v3.22 **APLICADA em 17/11/2026**: coluna `photo_paths` (máx. 3, travado no banco),
  pasta privada `event-report-photos` (vê quem vê o relatório; envia/apaga administrador e presidente do capítulo). Fotos otimizadas para 1600 px. Testes `37-fotos-relatorio.sql` e tela.
  (2) "Quero ser sócio" → **"Desejo ser sócio"** (rodapé do site e app). (4) **Central: clicar em "Santa Catarina"** com uma região aberta volta a Central
  inteira ao estado (diretor regional continua na região dele). Testes de tela.
- **Cobrança só a partir de 2027 e só de quem tem presidente com login + boas-vindas (18/11/2026)** — decisão do Eduardo:
  "Não dá para cobrar um presidente que não existe / que não tem acesso ao login". Até 31/12/2026 é implantação (preencher as
  informações básicas, nada é cobrado); a partir de 01/01/2027 os prazos contam (1º relatório: 1º trimestre de 2027, até 05/04/2027).
  Painel "Bem-vindo à plataforma" para presidentes e diretores até o lançamento ("Entendi" esconde). Capítulo sem presidente com login
  aparece como "não cobrado" e não perde ponto. [banco] v3.25 **APLICADA em 18/11/2026** (backup `supabase/backups/2026-11-18-antes-v3.25-cobranca.sql`). Testes `40-cobranca.sql` e tela 1l.
- **Mais coisas guardadas no aparelho (18/11/2026)** — quem volta todo dia não baixa tudo de novo: arquivos do site, imagens,
  ícones e dados fixos vêm do aparelho e se atualizam por trás; o **vídeo** é guardado inteiro na 1ª vez e depois toca do aparelho
  (com avanço/retrocesso); a página abre mesmo sem internet. Dados: municípios ficam 7 dias no aparelho, regiões e cidades de cada
  região 1 h, o resto 5 min (desenho do mapa já ficava 30 dias). Teste de tela 1m.
- **Monitor de velocidade (18/11/2026)** — workflow "Monitor de velocidade (alerta acima de 1 s)": a cada ~5 min mede as respostas
  do servidor (públicas e com login); passou de 1 s ou deu erro → o workflow falha e o GitHub manda e-mail ao Eduardo.
- **Teste de carga "mil"** (700 logados + 300 visitantes, uso real) — perfil novo no k6; rodar à noite, fora do horário de uso (plano Free).
- **Pedidos do diretor estadual, pacote 3 — Secretário e Representante de campo (18/11/2026)** — no `/beta` e no app:
  Em "Minha conta", quem tem cargo (presidente, diretor, coordenador, administrador) designa uma pessoa (pelo e-mail da conta dela)
  como **Secretário** ou **Representante de campo** (mesma coisa, outro nome). A pessoa passa a ter **as mesmas permissões** de quem
  designou, inclusive excluir; vê a faixa "Você está atuando como Secretário de …". Tudo o que ela faz fica no registro com o nome dela
  e "em nome de" quem designou. Secretário não designa secretário. Encerrar tira o acesso na hora; se o cargo de quem designou muda, acompanha.
  O antigo perfil "Representante de campo" (só via, ninguém usava) saiu dos formulários.
  [banco] v3.24 **APLICADA em 18/11/2026** com backup antes (`supabase/backups/2026-11-18-antes-v3.24-secretario.sql`). Testes `39-secretario.sql` e tela 1k.
  **Falta do pacote 3:** ata preenchida no sistema → aprovação do diretor regional → nova diretoria; regente só pelo nome; PDF da ata; Modo Eleição.
- **Pedidos do diretor estadual, pacote 2 (18/11/2026, branch `pacotes-2-3`)** — no `/beta` e no app:
  (7/8) **Relatório trimestral** (março, junho, setembro, dezembro; prazo dia 5 do mês seguinte; a Saúde soma os 3 meses).
  **Nada é cobrado antes do lançamento**: a data fica em `adh_config` → `lancamento` (vazia = ninguém fica pendente; só o administrador muda).
  Eventos que já passaram sem relatório aparecem em "Seus avisos" do presidente e na página de relatórios (só depois do lançamento).
  (9) **Aviso de fim de mandato** com os dias que o diretor escolher (padrão 60 e 30; botão na Gestão; administrador ou diretor estadual).
  [banco] v3.23 **APLICADA em 18/11/2026** com backup antes (`supabase/backups/2026-11-18-antes-v3.23-trimestral.sql`, testado: volta tudo).
  Testes `38-trimestral.sql` e tela 1i/1j.
- **Logoff por inatividade (17/11/2026)** — no navegador: 30 min sem mexer → sai (também no servidor); 2 min antes, aviso com contagem e
  "Continuar conectado"; depois, "Sua sessão foi encerrada por inatividade. Faça o login novamente." No app a sessão continua. No `/beta`; testes de tela.
- **Dividir regiões (17/11/2026, branch `regioes-brusque-jaragua`)** — [banco] `supabase/migracoes/v3.19-regioes-brusque-jaragua.sql` **APLICADA em 17/11/2026** (ok do Eduardo). Itajaí fica como está (Barra Velha e São João do Itaperiú não mudam).
  Brusque (Norberto Bruns): Brusque, Gaspar, Guabiruba, Botuverá (de Blumenau) e Nova Trento (de Tijucas).
  Jaraguá do Sul (Jean Dias): Jaraguá do Sul, Corupá, Guaramirim, Massaranduba, Schroeder (de Joinville).
  Ajustes seguintes: `select public.adh_mover_municipios('Região', array['Cidade', ...]);` no SQL Editor (só o dono do banco). Teste: `testes/banco/35-regioes.sql`.
- **Mudar cidade de região pelo painel (17/11/2026, branch `mover-cidade-regiao`)** — Regiões e municípios: o administrador busca a cidade e
  escolhe a região nova (capítulos vão junto, histórico guardado) e cria região com "+ Nova região". [banco] v3.20 **APLICADA em 17/11/2026**.
  Cores fixas no mapa para Brusque e Jaraguá do Sul; região nova sem cor fixa ganha cor estável pelo nome. Testes: `35-regioes.sql` e tela.
- **Tirar o nome "Supabase" das telas (17/11/2026)** — mensagens, títulos e login do `/beta` e do app (fica só na Política de Privacidade). Oficial só na troca completa do lançamento.
- **Texto do login (17/11/2026)** — "Entre com sua conta já cadastrada ou solicite o cadastro." no `/beta` e no app; oficial só na troca completa do lançamento.
- **GitHub Pages pelo Actions (17/11/2026)** — [feito] Eduardo trocou Source para "GitHub Actions" e criou `PAGES_PELO_ACTIONS = sim`;
  "Publicar site (GitHub Pages)" rodou com sucesso (só os arquivos do site; sem `docs/`, SQL, testes, zips).
  Falta conferir no navegador: site e `/beta/` abrindo, e `/docs/BACKLOG.md` dando 404.
- **Hardening (16/11/2026, branch `claude/eloquent-ramanujan-sjl4cy`)** — briefing de segurança:
  - [feito] varredura de chaves (gitleaks, histórico inteiro + zips): só a chave publicável; nada a rotacionar.
    Agora automática: job "Segredos" no workflow de testes, a cada push (`.gitleaks.toml`).
  - [feito] revisão do banco (views, gatilhos, funções de ação/leitura, tabelas sem política): papéis checados por dentro.
  - [APLICADA 16/11/2026] `supabase/migracoes/v3.18-hardening-gatilhos-dispositivos.sql` (gatilhos fora da API; limite no token de dispositivo).
  - [feito] `vercel.json` (CSP + Report-Only, anti-iframe, nosniff, HSTS sem preload) e `.vercelignore` (SQL/docs/testes fora do ar); teste de tela novo.
  - **Confirmado 16/11: o Pages publica os arquivos internos** (`www.adhonepemsc.com.br/docs/BACKLOG.md` abre).
    [feito] `scripts/montar-site.py` + workflow `publicar-site.yml` (Pages só com os arquivos do site); falta o Eduardo trocar
    Settings → Pages → Source para "GitHub Actions" e criar a variável `PAGES_PELO_ACTIONS = sim`. Testes de tela rodam na pasta publicada.
  - Supabase continua no **Free** (decisão do Eduardo, 16/11). [feito] `manter-ativo.yml` (leitura diária) e `backup-diario.yml`
    (banco criptografado → Google Drive, 30 dias, ~1 MB por dia; passo a passo em `docs/BACKUP.md`; faltam os 3 segredos).
  - A decidir: migrar para a Vercel depois da aprovação da Apple; Turnstile no login/cadastro (grátis).
    Proteção de senhas vazadas exige Pro: fica de fora.

## Cronograma de lançamento do app (combinado em 08/11/2026)
- **Semana 1 (09–15/11):** Apple: ficha da App Store (textos, Privacidade do app, prints, conta de revisão) e enviar o build 10 para análise até qua 11/11.
  Google: Segurança dos dados + ficha da loja, build 4 no teste fechado, **12 testadores aceitos até qua 11/11** (começa a contar os 14 dias).
  Decisões do Eduardo: ok na v3.17, Supabase Pro, lista de usuários para importar.
- **Semana 2 (16–22/11):** resposta da Apple (1–3 dias) e correções; **lançar na App Store**; importar diretores e presidentes e enviar os acessos;
  testadores Android usando o app (ao menos 1 abertura por dia); build com as correções.
- **Semana 3 (23–29/11):** fim dos 14 dias (~25/11) → pedir acesso de produção na Google (análise de até ~7 dias); notificações push.
- **Semana 4 (30/11–06/12):** **lançar na Google Play** (produção) e anunciar para os capítulos.

## Próximas (em ordem de prioridade)
1. ~~Aplicar a v3.17 na produção~~ **APLICADA em 12/11/2026** (migração `v3_17_sem_truncate_para_api`). Conferido na produção em 17/11;
   arquivo marcado como APLICADA.
2. **Confirmar as exceções de exclusão** que o teste do banco encontrou (hoje permitidas): presidente/diretores excluem
   registro de reunião (`chapter_meeting_log`) e mandato (`leader_mandates`); quem enviou um documento da Biblioteca
   pode excluí-lo; diretor estadual também consegue excluir reuniões e mandatos. Manter ou restringir ao administrador?
3. **Pacote do app** — **subido para a `main` em 17/11/2026** (a pedido do Eduardo); entra no próximo build iOS/Android:
   - [na main] evento público mostra a cidade em destaque e não o nome do capítulo;
   - (os próximos pedidos do Eduardo entram aqui).
4. **Conta de demonstração para os revisores** da Apple e da Google (perfil sócio, só leitura). Pode ser a mesma do teste de carga.
5. **Teste de carga k6 de novo**, com o ritmo real (`lancamento`), depois do plano Pro ou com 1 h sem outros testes.
6. **Lixeira de 30 dias para usuários excluídos** (proposta: excluir → bloqueia e vai para a Lixeira; restaurar em 30 dias;
   depois apaga sozinho). Aguardando decisão.
7. **Quem mais corrige cadastros**: hoje só o administrador (todos) e o presidente (sócios dele). Diretores também? Até onde?
8. **Troca completa beta → oficial no lançamento** (decisão do Eduardo, 17/11/2026: oficial congelado até lá; diretores usam o `/beta`, em sigilo). Na troca: voltar `robots` para `index,follow`, tirar `Disallow: /beta/` do robots.txt.
9. **Notificações push de verdade**: iOS (chave APNs + publicar `send-push`) e Android (Firebase / `GOOGLE_SERVICES_JSON`).
10. **Importar a lista de usuários** (~30 diretores + ~70 presidentes) antes de liberar o app.
11. **Ficha da App Store** (textos, privacidade, prints reais do iPhone) e ficha da Google Play.

## Observações da reunião de 12/11/2026 (Eduardo) — a priorizar e dividir em pacotes
> **17/11/2026 — feitos no pacote 1:** (2), (3), (4), (13). Seguem: (5) bug sem reprodução; pacote 2 = (7), (8), (9) alertas e relatório trimestral
> (4 perguntas do trimestral em aberto); pacote 3 = (12) Modo Eleição (absorve 6, 10, 11); (14) preletores; (15) menu; (1) marketing (Eduardo).
Marcação: **[tela]** só site/app · **[banco]** mexe em banco/RLS/permissões (parar e pedir o ok do Eduardo antes de aplicar).
- **Prioridade 1 · bug:** (5) **Informações do capítulo não gravaram.** Nenhum capítulo mudou no banco desde 08/11 (snapshot de 08/11 idêntico ao atual) e
  `chapter_public_info` está vazia. Falta o Eduardo dizer quando/qual tela/qual capítulo/mensagem ao salvar para reproduzir.
- **Correções:** (13) **[banco]** "Saúde dos capítulos" traz o Brasil todo: `adh_ranking` não filtra por SC (capítulos e regiões). Corrigir a função e testar antes/depois.
  (4) **[tela]** mapa do painel: clicar em "Santa Catarina" não volta ao mapa completo (visto em tela cheia; não reproduzido sem login).
  (3) **[tela]** relatório de eventos: máximo de 3 fotos.
  (2) **[tela]** trocar "Quero ser sócio" por "Desejo ser sócio" (site público e app).
  (15) **[tela]** menu: agrupar em seções recolhíveis (menu suspenso), melhorar a estética, principalmente no celular.
- **Funcionalidades novas (precisam de decisão do Eduardo):**
  (12) **[banco]** **Modo Eleição**: o secretário preenche a ata no sistema; vai ao diretor regional (e ao regente presente) e ao escritório nacional.
  Eleição exige regente (diretor regional ou representante de campo). Absorve (6) atualizar presidente/diretoria pela ata, (10) modelo de ata na Biblioteca e (11) ata preenchida da diretoria.
  Abertas: quem preenche (o "secretário" não é perfil de login hoje), como o escritório nacional recebe, se a diretoria nova vale na hora ou após confirmação.
  (8) **[banco]** alerta de fim de mandato 60 e 30 dias antes da eleição (`leader_mandates.end_date`).
  (7) **[banco]** evento com data vencida vira alerta de "relatório pendente" automaticamente.
  (9) **[banco]** relatório de andamento do capítulo trimestral (hoje mensal, prazo dia 5), com alertas "relatório daqui a X dias"; revê os pontos e limites do ranking.
  (14) **[banco]** preletores: nível de atualização ("está ativo?").
- **Outros:** (1) pensar no marketing.
- Backup completo feito em 12/11/2026 (`ADHONEP-BACKUP-2026-11-12.zip`, fora do repositório; contém dados pessoais).

## Decisões do Eduardo de 17/11/2026 (pedidos do diretor estadual) — anotado, aguardando o "pode fazer"
**Pacote 2 · relatório trimestral + alertas (7, 8, 9)**
- Trimestre de calendário. Relatórios em **março, junho, setembro e dezembro** (o último do ano é dezembro); **prazo dia 5** do mês seguinte.
- A **Saúde soma os 3 meses** do trimestre (teto de eventos/reuniões ×3 — proposta, confirmar). Não há relatórios antigos para converter.
- **Nada fica pendente antes do lançamento:** só cobra relatório de trimestre a partir do lançamento da plataforma (abrir já com tudo pendente
  só gera ansiedade). Mesma regra para "evento vencido → relatório pendente" (7): só eventos depois do lançamento.
- Avisos antes do prazo: proposta 15, 7 e 1 dia(s) antes do dia 5; depois, "atrasado".
- (8) **Alerta de fim de mandato: quantos dias antes é definido pelo diretor** (configurável; padrão 60 e 30).

**Pacote 3 · Modo Eleição (12, absorve 6, 10, 11)**
- **Secretário = cargo de confiança, por delegação.** Qualquer pessoa, indicada por alguém de qualquer nível ("secretário de Fulano").
  Representa e trabalha por quem o escolheu: **mesma capacidade de trabalho** de quem o indicou (vê e faz o mesmo), e **tudo que ele faz fica
  registrado** ("feito por X, secretário de Y"). Quem indicou pode tirar a qualquer hora; se quem indicou sai do cargo, o secretário perde junto.
  **Capacidades idênticas a quem o designou, inclusive excluir** (decidido 17/11): secretário do presidente = presidente; secretário de diretor = aquele diretor.
- **Ata:** secretário preenche no sistema → diretor regional (e regente) → **a diretoria nova só vale depois que o diretor regional aprova**
  (enquanto isso, vale a antiga; correção volta ao secretário, como nos relatórios).
- **Documentos oficiais** (modelo de ata, de relatório…): o Eduardo vai buscar; ficam na Biblioteca para baixar.
- **Envio ao escritório nacional:** começa pelo **(A)** — ata aprovada vira PDF, a pessoa baixa e envia pelo e-mail dela.
  **Meta: (B)** — o sistema envia sozinho (depende do e-mail próprio da ADHONEP / SMTP, item "E-mails do sistema").
- **Regente:** não precisa de login, basta o nome dele na ata, desde que seja o oficiante da eleição (diretor regional ou representante de campo).

## Anotações do Eduardo (descobertas, ainda sem ação)
- 06/11/2026 — **Código do site visível no F12.** Todo site mostra o próprio HTML/JS no navegador; isso é normal e não dá para esconder.
  A segurança precisa estar no servidor: regras de acesso do banco (RLS), chaves secretas só no Supabase e nada sensível no código.
  A revisar: conferir que não há segredo, senha, dado pessoal ou regra de negócio sensível no código público; avaliar
  minificar/ofuscar (só dificulta a leitura, não protege); confirmar que tudo que importa é barrado pelo banco (já testado em `testes/banco`).
- 06/11/2026 — **Hospedagem e "hardening".** Hoje: site no **GitHub Pages** a partir do repositório **público** `mekkaniq/adhonep-sc`
  (o código também fica aberto no GitHub), domínio no Registro.br, dados e login no Supabase. Pontos a decidir:
  repositório privado (GitHub Pages em repositório privado exige plano pago) ou mudar a hospedagem (Vercel / Cloudflare Pages);
  o GitHub Pages não deixa configurar cabeçalhos de segurança (CSP, HSTS, X-Frame-Options, Referrer-Policy) — outra hospedagem deixa;
  o Eduardo confirmou que quer **hardening** (reforço de segurança). Ideia dele: Vercel plano pago.
  Atenção: nenhuma hospedagem esconde o código que roda no navegador (HTML/JS/CSS sempre chega ao F12). O que a Vercel
  acrescenta: repositório privado, cabeçalhos de segurança, proteção contra robôs/abuso (firewall) e funções no servidor —
  regras que hoje estão no JS da página podem ir para o servidor, aí sim ficam invisíveis.
- 06/11/2026 — **Login continua valendo depois de voltar à página inicial e atualizar.** Hoje é o comportamento esperado:
  a sessão fica guardada no navegador até clicar em "Sair" ou o acesso expirar (o Supabase renova sozinho).
  Opções a decidir: sair sozinho após X minutos sem uso no painel; não lembrar o login ao fechar o navegador
  (guardar só na aba aberta); pedir a senha de novo antes de ações sensíveis (excluir, mudar perfis); deixar o
  "Sair" mais visível. No app, o Face ID cobre isso.
- 06/11/2026 — **Sugestão do Eduardo: HTML gerado por PHP no servidor + CSS, com hospedagem e banco SQL próprios.**
  O que ganha: a lógica fica no servidor (o navegador só recebe o HTML pronto), então regras e consultas não aparecem no F12.
  O que custa: reescrever site e painel (hoje tudo é JS + Supabase); manter servidor, PHP e banco (atualizações, backup,
  segurança); o app (Capacitor) e o modo offline dependem do JS atual. Meio-termo a avaliar: manter o Supabase e levar só
  as partes sensíveis para funções no servidor (Supabase Edge Functions ou Vercel), sem reescrever tudo.

## Depois
- Mapa do Brasil na plataforma global: país em partículas, cor com significado (grafite sem capítulo, dourado conforme os
  capítulos) e destaque ao passar o dedo (`beta-global/PENDENCIAS.md`).
- Pontos dourados no globo nos países com capítulo (quando houver dados reais de fora do Brasil).
- Religar a aba "Mundo" no app (escondida em 03/11/2026).
- Plataforma global de verdade (diretoria global, países, estados replicando SC); troca de nível hoje só para papel global.
- Mudar "Ranking" → "Saúde" também no `beta-global`.
- Transição globo → Brasil e painel lateral com números no mapa nacional.
- E-mails do sistema com a cara da ADHONEP (remetente próprio / SMTP).
- Cadastro por WhatsApp (quando houver número oficial).
- Mini testemunhos; página de relatos.
- Limpeza: cópias soltas de SQL na raiz (as oficiais estão em `supabase/`) e zips antigos no repositório.
- Excluir no painel do Supabase as funções temporárias já desligadas (`importar-convites`, `exportar-esquema`).

## Comigo (fora do código) — Eduardo
- Supabase **fica no Free por enquanto** (16/11). Configurar o backup: 3 segredos no GitHub (`docs/BACKUP.md`).
- Ativar o Pages pelo Actions (Settings → Pages → Source: GitHub Actions + variável `PAGES_PELO_ACTIONS = sim`).
- **Google Play**: aguardar a verificação de identidade; fazer o login no app Play Console num **Android de verdade** (emprestado serve);
  juntar **12 a 16 testadores** com Gmail e Android (coordenadores do Apoio Jovem) para o teste fechado de 14 dias.
- Rodar o workflow **App Android → Google Play** e cadastrar os segredos `ANDROID_KEYSTORE_B64` / `ANDROID_KEYSTORE_PASSWORD`.
- **Apple**: gerar a chave APNs (push); revogar a chave antiga do App Store Connect `25DU7MH4H3`.
- Confirmar de qual capítulo é o **Jantar de Pomerode** (06/11) — hoje ligado a Blumenau.
- Criar no sistema a conta de teste do **Coordenador do Apoio Jovem** (só existe a de Apoio Feminino).
- Pedir à sede o **D-U-N-S** se for abrir conta de organização no Google Play.
- Apresentação ao diretor estadual: não rodar teste de carga na véspera; abrir site e app 2 h antes (o plano gratuito pausa).

## Feito
- 07/11/2026 · claude v1.14 — Política de Privacidade conforme a Google Play (app ADHONEP SC, desenvolvedor, dados do app,
  exclusão de conta) no oficial e no `/beta`; página pública `excluir-conta.html` (link do Play Console); "Excluir minha conta"
  no app (Configurações) e em Minha conta; lista de pedidos de exclusão para o administrador concluir; função
  `rapid-responder` v4 (exclusão completa); aviso antes de pedir localização; builds Android 4 e iOS 10.
- 04/11/2026 · claude v1.13 — Roteiro de entrega no `CLAUDE.md`; este backlog; testes do banco (Postgres do zero, RLS,
  visitante, perfis) e de tela (Playwright com Supabase simulado) rodando no GitHub a cada push/PR; estrutura do banco de
  produção guardada em `supabase/esquema/00-base.sql`; achado e corrigido (pendente de ok) o TRUNCATE liberado para a API.
- 03/11/2026 · claude v1.12 — App: bolinha do mapa de SC menor, aba "Mundo" escondida, foto da Terra e identidade em Eventos,
  convites inteiros, busca de capítulo logo abaixo do mapa (builds iOS 7, 8 e 9); jantares de Brusque e Pomerode publicados.
- 02/11/2026 · claude v1.12 — Teste de carga k6 (fumaça/lançamento/pico); regras de acesso ~150× mais rápidas (v3.16);
  cache dos dados públicos no aparelho; editar cadastro pela plataforma, reaproveitar e-mail órfão e exclusão completa
  (função `rapid-responder` v3).
- 30/10/2026 · claude v1.11 — "Ranking" virou "Saúde dos capítulos" (estado, regiões clicáveis e capítulos); troca de
  estado/nível só para papel global; aviso de apoios do capítulo (liga/desliga Apoio Jovem/Feminino).
- 30/10/2026 · claude v1.10 — Relatório mensal do Apoio Jovem e do Apoio Feminino (v3.14/v3.15); vídeo da capa do `/beta`
  toca uma vez e para ao rolar; Face ID e mapa de partículas de SC no app; workflow do Android.
- Antes (histórico nos `STATUS-claude-*.md`): Biblioteca (v3.12), Andamento mensal e Saúde (v3.2), Central de comando,
  mandatos, reuniões, LGPD, app iOS no TestFlight.
