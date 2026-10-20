# claude v1.9 — resumo
- Tema claro/escuro/automático (botão 🌓 no topo; segue o aparelho; azul ADHONEP + dourado).
- Ícones novos (tocha grande, fundo marfim) + adhonep.ico para o app do Windows.
- Regiões: corrigido o clique nos botões de região (admin e Central); painel da região lista os capítulos (situação, presidente, telefone/WhatsApp) e mostra o diretor regional.
- Lista de municípios agora só aparece ao pesquisar.
- Rodar uma vez no SQL Editor: supabase/migracao-v1.1-gestao.sql, migracao-v1.8-diretoria.sql e migracao-v1.9-regioes-diretor.sql (telefone do diretor na região).

# claude v1.8 — Diretoria completa e registro rápido de reunião

**Novidades**
- **Diretoria do capítulo com 12 cargos** (presidente, vice, tesoureiro, 2º tesoureiro, secretário, 2º secretário, diretor de sócios, diretor de eventos, coordenadora e vice de Apoio Feminino, coordenador e vice de Jovens). Botão **Diretoria** na lista de capítulos e no registro rápido. Grava em `leader_mandates` (um registro por cargo), então Mandatos, alertas, Central e Roteiro já usam.
- Quem edita: administração, diretoria estadual, diretor regional (capítulos da região) e o **presidente do próprio capítulo** (exceto o cargo de Presidente). Precisa rodar `supabase/migracao-v1.8-diretoria.sql` uma vez.
- **Registro rápido de reunião** para o presidente (Aconteceu → presença → Salvar), com a data da reunião sugerida pelo dia cadastrado na página do capítulo.
- **Cobrança gentil** para a gestão: lista de capítulos atrasados com botão de WhatsApp e mensagem pronta (aparece na página Reuniões).
- Alertas de mandato agrupados por diretoria (um aviso por capítulo, não um por cargo).

**SQL novo:** `migracao-v1.8-diretoria.sql` (só troca as políticas de `leader_mandates`).
**Lembrete automático pelo WhatsApp:** não incluído (exige API paga do WhatsApp). Hoje a cobrança é com um toque.

---

# claude v1.7 — Central de comando + nota de saúde

**Novidades**
- Página **Central de comando** (menu lateral, para administração, diretoria estadual e diretores regionais): KPIs, mapa de capítulos, saúde (0–100), situação dos capítulos, ranking, alertas, comparativo de regiões (ou capítulos da região), próximos eventos e 6 gráficos de tendência. Alterna entre **Estadual** e **Regional**; diretor regional vê só a sua região. Botão **Tela cheia** e atualização automática a cada 5 min.
- **Nota de saúde 0–100** (relatório 30 · reuniões 30 · mandato 20 · atividade 20) na página Ranking e no painel Atenção.
- Imagem do topo em HD (v1.5) e efeito cortina (v1.4).

**Arquivos novos/alterados:** `js/central.js` (novo), `js/mapa.js` (segunda instância do mapa), `js/gestao.js`, `index.html`, `styles.css`, `sw.js`, demais `js/` só com o número da versão, `assets/fundo-hero.jpg`.
**SQL novo:** nenhum (continua valendo `migracao-v1.1-gestao.sql`).
**Só leitura:** a Central não grava nada no banco.

---

# STATUS · ADHONEP-SC claude v1.4

## Novidades da v1.4 (efeito cortina no site público; sem SQL novo)
- A capa (foto da Terra à noite, navy da ADHONEP) fica **fixa ao fundo**; ao rolar, ela se afasta e escurece enquanto a parte clara (off-white `#f6f3ec`) **sobe por cima**, com cantos arredondados e filete dourado. O conteúdo (mapa, eventos, "Sobre") e o rodapé ficam dentro dessa folha clara; a seção de eventos usa um off-white um pouco mais escuro.
- Indicador "Role para explorar" no pé da capa; a capa ocupa a primeira tela inteira.
- Respeita "reduzir movimento" do aparelho (sem afastar/escurecer; só a sobreposição).
- Nada muda no painel administrativo nem nas regras. Inclui toda a v1.1 e o acabamento dourado da v1.3.
- Enviar: `index.html`, `styles.css`, `sw.js` e todos os arquivos de `js/` (número da versão). Sem imagem nova nem SQL novo.
- Se achar o efeito forte demais: basta enviar o `styles.css` e `index.html` da v1.3.

## Novidades da v1.3 (acabamento dourado) (visual do site público; sem SQL novo)
- Mantém a foto da Terra à noite na capa (como antes), com um leve escurecimento à esquerda para o texto.
- Acabamento dourado: etiqueta com filete, destaque "uma missão." em itálico serifado dourado, botão principal dourado com brilho, caixa "38 capítulos" em vidro com borda dourada, filete dourado no fim da capa e no rodapé, fio dourado no topo dos cartões, títulos de seção com filete, seção "Sobre" com letra serifada.
- Nada muda no painel nem nas regras. Inclui toda a v1.1 (Roteiro, Mandatos, Reuniões, Agenda, Histórico).
- Enviar: `index.html`, `styles.css`, `sw.js` e todos os arquivos de `js/`. Não há imagem nova. SQL: `migracao-v1.1-gestao.sql`, se ainda não rodou.

## Novidades da v1.1 (versão acumulada: inclui tudo da v1.0 e das antigas v3.21/v3.22)
**SQL novo (rodar UMA vez ANTES de subir os arquivos):** `supabase/migracao-v1.1-gestao.sql` (cria `leader_mandates` e `chapter_meeting_log`; pode rodar de novo sem problema).

1. **Roteiro do evento** (botão "Roteiro" na lista de Eventos e na Agenda): assistente em 4 etapas (mestre de cerimônias → mesa diretiva → demais participações → revisão). Preenche sozinho presidente, vice, diretor regional (se houver mandato cadastrado) e as informações do capítulo (página pública + telefone). Rascunho salvo no aparelho. Gera a folha para **Imprimir / Salvar PDF** ou **Copiar texto**. O que faltar sai em amarelo no texto.
2. **Mandatos** (menu "Mandatos"): cargo, nome, início e fim por capítulo ou região; situação (Vigente / Vence em 60 dias / Vencido); botão "Renovar"; filtro "Capítulos ativos sem mandato". Quem grava: administrador, diretor estadual (tudo) e diretor regional (capítulos da sua região). Presidente só vê o do seu capítulo.
3. **Reuniões** (menu "Reuniões"): o presidente registra a reunião (ou "não houve"), presentes e visitantes; a diretoria vê a situação de todos os capítulos. Alerta quando passam 3 semanas sem reunião (30 dias se a página pública diz "quinzenal", 45 se "mensal"). Presidente só registra os últimos 60 dias; datas futuras não valem.
4. **Painel "Atenção"** agora também avisa mandato vencido/perto de vencer e capítulo com reunião atrasada (com botão de WhatsApp para o presidente quando o telefone está cadastrado).
5. **Histórico do capítulo** (botão "Histórico" em Capítulos): linha do tempo com mudanças de situação, mandatos, eventos e semanas sem reunião.
6. **Agenda** (menu "Agenda"): calendário do mês com eventos (e fim de mandatos para a diretoria); filtro por capítulo; no celular, mostra bolinhas e a lista abaixo.
7. **Modo beta**: se o site estiver numa pasta `/beta/`, aparece a faixa laranja "VERSÃO DE TESTE", o Google é impedido de listar e o cache é separado. Veja `docs/BETA-PASSO-A-PASSO.md`.
8. **Ícone do iPhone:** agora há um único `apple-touch-icon` com endereço novo (`/apple-touch-icon.png?v=11`), para o iPhone buscar o arquivo de novo. Não há garantia; se persistir, mande prints.
9. Correções: aviso de "Atualização incompleta" agora funciona e confere os 4 arquivos de `js/`; botões marcados como ocultos realmente somem.
10. Guia do e-mail próprio (Resend): `docs/EMAIL-RESEND-PASSO-A-PASSO.md`.

O registro de "quem alterou o quê" já existia (menu "Histórico de ações"); não foi refeito.

### Arquivos a enviar ao GitHub (v1.1)
`index.html`, `styles.css`, `sw.js`, `robots.txt` (raiz) e, em `js/`: `app.js`, `mapa.js`, `supabase.js`, **`gestao.js` (novo)**, **`roteiro.js` (novo)**. Docs e SQL novos são opcionais no site.

### Roteiro de testes da v1.1 (faça no beta)
- Administrador: abrir Agenda, Reuniões, Mandatos; cadastrar 1 mandato "TESTE"; "Renovar"; abrir "Histórico" de um capítulo; gerar um Roteiro até o PDF.
- Presidente: registrar uma reunião e a de "não houve"; ver que NÃO aparece "Novo mandato"; ver só o próprio capítulo.
- Diretor regional: ver a situação das reuniões da região (sem botão Registrar); cadastrar mandato de um capítulo da região; confirmar que não consegue editar mandato de região.
- Dashboard (admin/diretor): conferir o bloco "Liderança e reuniões" no painel Atenção.
- Celular: Agenda, assistente do Roteiro, impressão/PDF (no iPhone: Compartilhar → Salvar em Arquivos).

## Versão 1.0 (primeira versão oficial)
- Igual à antiga v3.22, só renomeada: a partir daqui a numeração recomeça em 1.x.
- Arquivos das versões anteriores continuam com os nomes antigos (migracao-v3.xx), que são os nomes reais dos arquivos SQL.

## Novidades da v3.22
- Janelas (modais) agora ficam acima do cabeçalho no celular; avisos acima das janelas.
- Mensagens de erro da criação de conta em português (e-mail já cadastrado, sem permissão na tabela, sessão vencida, sem conexão).

## Novidades da v3.7
- Ícone do app (iPhone): arquivos novos com nomes novos (assets/app-icon-180.png, app-icon-192.png, app-icon-512.png), caminhos absolutos, apple-touch-icon.png também na raiz e service worker sem devolver HTML no lugar de imagem.

## Novidades da v3.6
- A criação de contas chama a Edge Function pelo endereço real publicado no Supabase (rapid-responder), configurável em ADH_USER_FN no js/supabase.js.

## Novidades da v3.5
- Rodapé público: botão "Quero ser sócio" (abre https://adhonep.com/pt/socio/ em nova aba).
- Solicitações: removido o botão "Só aprovar"; a aprovação passa sempre por "Aprovar e criar conta".

## Novidades da v3.4
- Trava anti-mistura de versões: os scripts carregam com ?v=3.4 (sem cache velho) e o painel mostra faixa vermelha se index.html, js/app.js e js/supabase.js não forem da mesma versão.

## Novidades da v3.3
- Ficha de cadastro: texto ajustado para "Logo você receberá seu acesso: a diretoria validará seu pedido."

## Novidades da v3.2
- **Andamento mensal** (menu "Andamento mensal"): relatório mensal do capítulo (reuniões do capítulo/Apoio Feminino/Apoio Jovem, visitantes não sócios, eventos, Ministério de Prisões, considerações). Presidente envia até o dia 5 do mês seguinte; diretor regional aprova ou pede correções; administração enxerga tudo.
- **Ranking interno** (menu "Ranking", só administrador, diretor estadual e diretor regional da própria região): capítulos e regiões, pontuação editável pelo administrador. Nunca aparece na área pública.
- **Histórico de situação dos capítulos** (abertura, inativação, reativação) gravado automaticamente a partir da instalação.
- **Ficha de solicitação de cadastro revisada**: opção "Sócio", WhatsApp com +55 e máscara, município com sugestões, mensagens de erro claras, tela de confirmação.
- **Solicitações**: botão "Aprovar e criar conta" (abre o cadastro de usuário já preenchido e marca o pedido como aprovado) e link para abrir o WhatsApp da pessoa.
- **SQL obrigatório**: `supabase/migracao-v3.2-andamento-ranking.sql` (rodar uma vez).


## O que mudou
- **Mapa novo (`js/mapa.js`)**: limites de SC baixados do Supabase uma vez e guardados no navegador (IndexedDB, 30 dias; renovação em segundo plano). Nas visitas seguintes abre na hora.
- **Mapa público**: SC inteiro, cidades com capítulo ativo em dourado. Pesquisou uma cidade sem capítulo → mostra os 2 capítulos mais próximos (distância aproximada em km).
- **Mapa administrativo**: 4 status com cores próprias (ativo verde, em ativação âmbar, em reativação roxo, inativo vermelho); legenda clicável filtra por status.
- **Navegação**: clique na região → isola a região; clique na cidade → isola a cidade; clique fora (ou Esc, ou "Voltar") → volta um passo. Cada etapa mostra as informações no painel.
- **Contornos**: suavizados (simplificação + curvas) com borda de região e do estado mais contrastadas.
- **Erro `permission denied for table events`**: rode `supabase/migracao-v1.5-grants.sql` (faltava GRANT SELECT ao papel anon).
- Fontes locais (Inter/Poppins), transições entre telas, revelação ao rolar (respeita "reduzir movimento"), textos de "prévia" removidos, "Em implantação" → "Em ativação".
- Contato dos preletores continua visível na lista e no CSV (decisão do cliente).

## Não testado em navegador real
Esta versão foi validada por análise de sintaxe e testes de Node das funções do mapa (geometria, cidade mais próxima, status). **Não** foi aberta em navegador nem contra o seu Supabase. Teste no Vizotool e no GitHub Pages e reporte o que aparecer.

## Roteiro de teste
1. Rodar `migracao-v1.5-grants.sql` e recarregar: a agenda pública deve parar de dar erro.
2. Mapa público: clicar região → cidade → fora; pesquisar cidade sem capítulo.
3. Entrar como administrador → Regiões e municípios: mapa abre sozinho, 4 cores, filtros da legenda.
4. Repetir os testes de perfil (admin, diretor estadual, regional, presidente).

## Pendências
Política de privacidade (modelo), domínio oficial + URL no Supabase Auth, criação manual das contas, teste com 4 contas reais, CAPTCHA (adiado por decisão).

## Novidades da v2.4
- Instalável como app (PWA): `manifest.webmanifest`, `sw.js`, ícones, áreas seguras do iPhone, ajustes de toque/fonte no celular.
- Domínio `www.adhonepemsc.com.br` já aplicado (CNAME, sitemap, robots, SEO).
- Guia para iniciante: `docs/GUIA-INICIANTE-GITHUB-DOMINIO-APP.md`.
- Também não testado em aparelho real.

## Novidades da v2.4 (mapa)
- Corrigido: ao isolar uma região, o enquadramento incluía um município vinculado por engano a uma região distante (ex.: Timbó em Araranguá) e o mapa ficava minúsculo. Agora o enquadramento ignora esse município e o painel do administrador mostra um aviso para você corrigir o vínculo.
- Corrigido: lista "Explorar região" do mapa administrativo vinha vazia; mapa não é mais cortado embaixo.
- Contornos das regiões sem emendas cinzas entre municípios; linhas mais finas e elegantes.
- Nomes de regiões/cidades não se sobrepõem mais; cores de status mais suaves; fundo e dourado refinados; filtro duplicado de município escondido (a busca já sugere cidades).

## Novidades da v2.4 (mapa em tema escuro)
- Mapa público e administrativo em tema escuro (azul-marinho da ADHONEP), regiões com cores vivas e número em círculo, contorno branco, municípios com capítulo em **ouro brilhante**.
- Legenda das regiões (numeradas por ordem alfabética dos nomes do Supabase; clicar isola a região), cartões com totais, bússola e escala em km.
- Mapa administrativo: cores por status (ativo, em ativação, em reativação, inativo) sobre o mapa escuro.
- Os nomes das regiões vêm do banco; para mudar um nome ou vínculo, edite `regions` / `region_municipalities`.

## Novidades da v2.4
- Municípios sem capítulo em tons pastel harmonizados (um tom por região); ouro vivo só onde há capítulo.
- Bordas bem finas (municípios, regiões e estado). Numeração das regiões removida; nomes das regiões aparecem no mapa (sem sobrepor) e na legenda.
- Fundo com relevo simulando Paraná, Rio Grande do Sul e o mar (`assets/mapa-fundo.jpg`) e textura de relevo sobre o estado (`assets/mapa-relevo.jpg`).
- `supabase/correcao-timbo-regiao.sql`: move Timbó da região Araranguá para Blumenau (tem diagnóstico antes e conferência depois).

## Novidades da v2.4
- **Só limites reais do IBGE**: a imagem gerada por IA deixou de ser usada. O entorno (Paraná, Rio Grande do Sul, Argentina e o mar) agora é um terreno simulado desenhado a partir dos próprios limites dos municípios, então a costa e as fronteiras sempre encaixam.
- Corrigido: retângulo dourado grosso ao clicar num município (contorno de foco do navegador).
- Corrigido: após passar o mouse na legenda e clicar, municípios ficavam escurecidos ao isolar uma região.
- Bordas dos municípios um pouco mais visíveis (ainda finas).

## v3.12 — Biblioteca
- Biblioteca de documentos (supabase/migracao-v3.12-biblioteca.sql): visibilidade "Todos os sócios" ou "Somente diretoria"; publica admin/diretor estadual/diretor regional/presidente (diretoria só os três primeiros); registro automático de autor e data; exclui admin ou autor.
- Coordenadores (apoio jovem/feminino) e representante de campo agora conseguem entrar (área do sócio).
- Limpeza de textos técnicos no site público e no painel.

## Matriz de permissões (depois de rodar supabase/migracao-v3.13-permissoes-contato.sql)
| Perfil | Capítulos | Eventos | Biblioteca | Outros |
|---|---|---|---|---|
| Administrador | tudo (inclui apagar) | tudo | publica (todos/diretoria), apaga qualquer | tudo |
| Diretor estadual | edita, inclusive situação; não apaga | publica/edita todos | publica (todos/diretoria) | comunicados, preletores, histórico |
| Diretor regional | edita os da SUA região, inclusive situação (fica no histórico com o autor); não cria nem muda de região | publica/edita os da sua região | publica (todos/diretoria) | comunicados regionais, aprova andamento mensal |
| Presidente | só o contato (telefone) do próprio capítulo | publica/edita os do próprio capítulo | publica para todos os sócios | relatórios, sócios do capítulo, andamento mensal |
| Coordenador apoio jovem/feminino | — | publica/edita os do próprio capítulo | publica para todos os sócios | vê comunicados |
| Sócio | — | vê | baixa "Todos os sócios" | seus dados |

Contato do presidente: tabela `chapter_contacts`; só aparece no site se o capítulo estiver ativo e publicado E a opção "Mostrar no site público" = Sim.

## Página pública do capítulo
- SQL: `supabase/migracao-v3.19-pagina-capitulo.sql` (rodar ANTES de subir os arquivos): tabela `chapter_public_info`, visão pública `public_chapter_info`, pasta pública `chapter-photos`.
- Quem edita: administrador, diretor estadual, diretor regional (da sua região), presidente (do próprio capítulo) — botão "Página" na lista de capítulos.
- Só aparece no site se: capítulo ativo + publicado + "Mostrar no site" = Sim. Link direto: `/#capitulo/<id>`.

## Convite pelo WhatsApp + quadro "Atenção"
- Sem SQL novo. Só lê dados que já existem (eventos, relatórios mensais, contatos).
- Convite: botão "Convidar pelo WhatsApp" nos eventos públicos e "Convidar" no painel; gera a arte (PNG) e a mensagem; no celular abre o compartilhamento.
- Atenção (admin, diretor estadual, diretor regional): relatórios mensais atrasados (🟡 1 mês, 🔴 2+ meses nos últimos 3), com botão "Falar com o presidente" (WhatsApp com lembrete pronto).
- Alerta de reunião semanal NÃO incluído (reuniões não são registradas uma a uma).
- (v3.21) o convite usa a arte cadastrada no evento (se houver); só gera arte automática quando o evento não tem imagem.
- (v3.22) diretor regional passa a ver 'Visão geral' e 'Regiões e municípios' (mapa administrativo só com a sua região em destaque; as demais ficam apagadas, sem contar como 'sem capítulo').
