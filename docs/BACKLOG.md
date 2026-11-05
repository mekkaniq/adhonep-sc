# BACKLOG — ADHONEP-SC

Única lista de pendências e prioridades do projeto. Arquivos antigos (`STATUS-claude-*.md`, guias, `app/PROXIMO-PACOTE.md`)
ficam como histórico; o que vale é esta página. Roteiro de entrega: `CLAUDE.md`.

## Fazendo agora
- (nada — o próximo item sai de "Próximas")

## Próximas (em ordem de prioridade)
1. **Aplicar a v3.17 na produção** (tirar TRUNCATE/TRIGGER/REFERENCES do visitante e do logado). Arquivo pronto em
   `supabase/migracoes/v3.17-sem-truncate-para-api.sql`; o teste do banco passa com ela. **Aguardando o ok do Eduardo.**
2. **Confirmar as exceções de exclusão** que o teste do banco encontrou (hoje permitidas): presidente/diretores excluem
   registro de reunião (`chapter_meeting_log`) e mandato (`leader_mandates`); quem enviou um documento da Biblioteca
   pode excluí-lo; diretor estadual também consegue excluir reuniões e mandatos. Manter ou restringir ao administrador?
3. **Pacote do app (branch `proximo-pacote`)**, sobe tudo de uma vez quando o Eduardo pedir:
   - [feito na branch] evento público mostra a cidade em destaque e não o nome do capítulo;
   - (os próximos pedidos do Eduardo entram aqui).
4. **Conta de demonstração para os revisores** da Apple e da Google (perfil sócio, só leitura). Pode ser a mesma do teste de carga.
5. **Teste de carga k6 de novo**, com o ritmo real (`lancamento`), depois do plano Pro ou com 1 h sem outros testes.
6. **Lixeira de 30 dias para usuários excluídos** (proposta: excluir → bloqueia e vai para a Lixeira; restaurar em 30 dias;
   depois apaga sozinho). Aguardando decisão.
7. **Quem mais corrige cadastros**: hoje só o administrador (todos) e o presidente (sócios dele). Diretores também? Até onde?
8. **Levar o visual do `/beta` para o site oficial** no lançamento.
9. **Notificações push de verdade**: iOS (chave APNs + publicar `send-push`) e Android (Firebase / `GOOGLE_SERVICES_JSON`).
10. **Importar a lista de usuários** (~30 diretores + ~70 presidentes) antes de liberar o app.
11. **Ficha da App Store** (textos, privacidade, prints reais do iPhone) e ficha da Google Play.

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
- Assinar o **Supabase Pro** (sem pausas, máquina maior; decisão depois da apresentação ao diretor estadual).
- **Google Play**: aguardar a verificação de identidade; fazer o login no app Play Console num **Android de verdade** (emprestado serve);
  juntar **12 a 16 testadores** com Gmail e Android (coordenadores do Apoio Jovem) para o teste fechado de 14 dias.
- Rodar o workflow **App Android → Google Play** e cadastrar os segredos `ANDROID_KEYSTORE_B64` / `ANDROID_KEYSTORE_PASSWORD`.
- **Apple**: gerar a chave APNs (push); revogar a chave antiga do App Store Connect `25DU7MH4H3`.
- Confirmar de qual capítulo é o **Jantar de Pomerode** (06/11) — hoje ligado a Blumenau.
- Criar no sistema a conta de teste do **Coordenador do Apoio Jovem** (só existe a de Apoio Feminino).
- Pedir à sede o **D-U-N-S** se for abrir conta de organização no Google Play.
- Apresentação ao diretor estadual: não rodar teste de carga na véspera; abrir site e app 2 h antes (o plano gratuito pausa).

## Feito
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
