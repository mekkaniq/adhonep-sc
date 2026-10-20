# Testar em beta antes de publicar (pasta /beta)

O site de teste fica em `https://www.adhonepemsc.com.br/beta/`, dentro do mesmo repositório do GitHub.

**Atenção:** o beta usa o MESMO banco (Supabase) do site oficial. Tudo que você cadastrar lá aparece no site de verdade. Por isso:
- Use nomes com **"TESTE —"** (ex.: "TESTE — Jantar") e apague depois.
- Mudanças de SQL valem para os dois sites ao mesmo tempo. As migrações da ADHONEP-SC são sempre "aditivas" (só criam coisas novas), então o site oficial antigo continua funcionando.
- E-mail de redefinição de senha sempre leva ao site oficial (não ao beta). Teste isso no site oficial.

## Primeira vez (criar a pasta beta)
1. No GitHub, abra o repositório → **Add file → Create new file**.
2. No campo do nome, digite `beta/leia-me.txt` (ao digitar a barra, o GitHub cria a pasta). No texto, escreva qualquer coisa ("pasta de testes") e clique em **Commit changes**.
3. Abra a pasta `beta` que apareceu → **Add file → Upload files**.
4. Abra o zip **por dentro** (onde está o `index.html`), selecione TUDO (arquivos e as pastas `js`, `assets`, `docs`…) e arraste. **Não envie** `CNAME` nem `.nojekyll` (só o site da raiz usa). A pasta `supabase` não precisa ir.
5. Espere uns 10 minutos e abra `https://www.adhonepemsc.com.br/beta/`. Deve aparecer uma **faixa laranja "VERSÃO DE TESTE"** no topo, e o título da aba começa com "[TESTE]".

## A cada atualização
1. Rode o SQL novo (se houver) no Supabase.
2. Envie os arquivos novos para a pasta `beta` (mesmo processo).
3. Teste no beta com o checklist do arquivo `STATUS-claude-vX.Y.md`.
4. Estando tudo certo, envie **os mesmos arquivos** para a raiz do repositório (site oficial).
5. Apague os dados "TESTE —" que criou.

## Cuidados
- O beta tem cache próprio (o aplicativo instalado do site oficial não é afetado).
- O beta pede "Atualização incompleta" (faixa vermelha) se algum arquivo ficou de outra versão. Reenvie o arquivo citado.
- O `robots.txt` da raiz já bloqueia o Google de listar `/beta/`.
