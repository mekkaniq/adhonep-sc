# Backup do banco — ADHONEP-SC

O Supabase **Free não faz backup**. Todo dia (de madrugada) o GitHub copia o banco inteiro
(capítulos, eventos, relatórios, cadastros e logins), **criptografa** e guarda no **Google Drive**, na pasta
`ADHONEP-SC/backups-banco`. Ficam os últimos 30 dias. Cada arquivo tem ~1 MB hoje (banco: 1,7 MB de dados em 16/11/2026), ~30 MB no total.
Workflow: `.github/workflows/backup-diario.yml`.

Não entram: arquivos do Storage (fotos de eventos, documentos da Biblioteca). Se quiser, dá para acrescentar depois.

**Cópia no PC Avell (opcional, sem trabalho extra):** instale o "Google Drive para computador" no Avell e deixe a
pasta `ADHONEP-SC` disponível offline. Assim cada backup fica no Drive **e** no Avell.

## Configurar (uma vez, ~15 minutos) — não precisa de VS Code

### 1. Senha do banco → segredo `SUPABASE_DB_URL`
1. Supabase → projeto adhonep-sc → botão **Connect** (topo) → **Session pooler**.
2. Copie o endereço (`postgresql://postgres.ayrdfetnscrfrlcssiua:[YOUR-PASSWORD]@aws-...pooler.supabase.com:5432/postgres`)
   e troque `[YOUR-PASSWORD]` pela senha do banco. Esqueceu a senha? Settings → Database → Reset database password
   (não afeta o site nem o app: eles não usam essa senha).
3. GitHub → repositório → Settings → Secrets and variables → Actions → **New repository secret**:
   nome `SUPABASE_DB_URL`, valor = o endereço com a senha.

### 2. Senha do backup → segredo `BACKUP_SENHA`
Invente uma senha longa (ex.: 5 palavras aleatórias), **guarde no seu gerenciador de senhas** (sem ela o backup não abre)
e cadastre como segredo `BACKUP_SENHA`.

### 3. Acesso ao Google Drive → segredo `RCLONE_CONF`
No PC (Windows, PowerShell):
```
winget install Rclone.Rclone
```
Feche e abra o PowerShell, depois:
```
rclone config create drive drive scope=drive.file
```
O navegador abre: entre com a conta Google onde quer os backups e clique em Permitir.
(`drive.file` = o rclone só enxerga as pastas que ele mesmo criar; não lê o resto do seu Drive.) Depois:
```
rclone config show drive
```
Copie **tudo** o que aparecer (incluindo a linha `[drive]`) e cadastre como segredo `RCLONE_CONF`.

### 4. Testar
GitHub → Actions → "Backup diário do banco (Google Drive)" → **Run workflow**. Em 2–3 minutos o arquivo
`adhonep-sc-banco-AAAA-MM-DD.dump.gpg` aparece no Drive. Se falhar, o GitHub manda e-mail.

## Restaurar (em caso de desastre)
Pedir ao Claude: "restaura o backup de DD/MM". Ele precisa do arquivo e da `BACKUP_SENHA`.
Na mão: `gpg -d arquivo.dump.gpg > banco.dump` e `pg_restore -d <conexão do banco novo> banco.dump`.
Testado em 16/11/2026: dump → criptografia → restauração num banco vazio, dados conferidos.

## Relógio (projeto não pausar)
O Free pausa o projeto após 7 dias sem uso. `.github/workflows/manter-ativo.yml` faz uma leitura pública
todo dia (só a chave publicável). Se o Supabase não responder, o GitHub manda e-mail: abrir o painel e clicar em **Restore**.
