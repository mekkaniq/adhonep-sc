# STATUS · ADHONEP-SC claude v1.6

## O que mudou
- **Mapa novo (`js/mapa.js`)**: limites de SC baixados do Supabase uma vez e guardados no navegador (IndexedDB, 30 dias; renovação em segundo plano). Nas visitas seguintes abre na hora.
- **Mapa público**: SC inteiro, cidades com capítulo ativo em dourado. Pesquisou uma cidade sem capítulo → mostra os 2 capítulos mais próximos (distância aproximada em km).
- **Mapa administrativo**: 4 status com cores próprias (ativo verde, em ativação âmbar, em reativação roxo, inativo vermelho); legenda clicável filtra por status.
- **Navegação**: clique na região → isola a região; clique na cidade → isola a cidade; clique fora (ou Esc, ou "Voltar") → volta um passo. Cada etapa mostra as informações no painel.
- **Contornos**: suavizados (simplificação + curvas) com borda de região e do estado mais contrastadas.
- **Erro `permission denied for table events`**: rode `supabase/migracao-v1.6-grants.sql` (faltava GRANT SELECT ao papel anon).
- Fontes locais (Inter/Poppins), transições entre telas, revelação ao rolar (respeita "reduzir movimento"), textos de "prévia" removidos, "Em implantação" → "Em ativação".
- Contato dos preletores continua visível na lista e no CSV (decisão do cliente).

## Não testado em navegador real
Esta versão foi validada por análise de sintaxe e testes de Node das funções do mapa (geometria, cidade mais próxima, status). **Não** foi aberta em navegador nem contra o seu Supabase. Teste no Vizotool e no GitHub Pages e reporte o que aparecer.

## Roteiro de teste
1. Rodar `migracao-v1.6-grants.sql` e recarregar: a agenda pública deve parar de dar erro.
2. Mapa público: clicar região → cidade → fora; pesquisar cidade sem capítulo.
3. Entrar como administrador → Regiões e municípios: mapa abre sozinho, 4 cores, filtros da legenda.
4. Repetir os testes de perfil (admin, diretor estadual, regional, presidente).

## Pendências
Política de privacidade (modelo), domínio oficial + URL no Supabase Auth, criação manual das contas, teste com 4 contas reais, CAPTCHA (adiado por decisão).

## Novidades da v1.6
- Instalável como app (PWA): `manifest.webmanifest`, `sw.js`, ícones, áreas seguras do iPhone, ajustes de toque/fonte no celular.
- Domínio `www.adhonepemsc.com.br` já aplicado (CNAME, sitemap, robots, SEO).
- Guia para iniciante: `docs/GUIA-INICIANTE-GITHUB-DOMINIO-APP.md`.
- Também não testado em aparelho real.
