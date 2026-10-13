# STATUS · ADHONEP-SC claude v2.6

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
