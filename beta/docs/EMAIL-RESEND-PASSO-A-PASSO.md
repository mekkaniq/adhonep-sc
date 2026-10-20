# E-mail próprio da plataforma (Resend + Supabase)

Por que: o e-mail padrão do Supabase é só para testes (poucas mensagens por hora e quase só para a equipe do projeto). Para os presidentes receberem o "esqueci minha senha", precisa de um serviço de envio.

Faça DEPOIS de qualquer apresentação, com calma. Leva uns 30 minutos (mais a espera do DNS).

## 1. Conta e domínio no Resend
1. Crie uma conta grátis em resend.com (o plano grátis tem 3.000 e-mails/mês e 100/dia — de sobra).
2. **Domains → Add Domain** → `adhonepemsc.com.br` → região **São Paulo** (ou a mais próxima).
3. O Resend mostra uns registros DNS (normalmente: um **TXT** de DKIM em `resend._domainkey`, e um **MX** e um **TXT** de SPF em `send`). **Copie exatamente** o que aparecer na tela dele.
4. Entre no painel de DNS onde o domínio foi configurado (o mesmo onde apontaram o site) e crie esses registros. Se já existir um SPF no domínio raiz, **não apague**: os do Resend ficam no subdomínio `send`, sem conflito. Se aparecer aviso de conflito, mande um print.
5. No Resend, clique em **Verify**. Pode demorar de minutos a algumas horas. Só siga quando ficar **Verified**.

## 2. Chave (API key)
Resend → **API Keys → Create API Key** → permissão **Sending access** → copie a chave (começa com `re_`). Ela só aparece uma vez. Não coloque em nenhum arquivo do site.

## 3. Ligar no Supabase
Supabase → **Authentication → Emails → SMTP Settings** → ligue **Enable custom SMTP**:
- Sender email: `nao-responda@adhonepemsc.com.br`
- Sender name: `ADHONEP-SC`
- Host: `smtp.resend.com`
- Port: `465`
- Username: `resend`
- Password: a chave `re_...`

Salve. Depois, em **Authentication → URL Configuration**:
- **Site URL:** `https://www.adhonepemsc.com.br`
- **Redirect URLs:** adicione `https://www.adhonepemsc.com.br/**`

Em **Authentication → Rate Limits**, deixe "emails por hora" em um valor confortável (ex.: 50).

## 4. Testar
1. No site: "Entrar" → "Esqueci minha senha" com um e-mail Gmail seu que tenha conta na plataforma.
2. O e-mail deve chegar em 1 minuto (olhe o spam na primeira vez). Clique no link: deve abrir o site e pedir a nova senha.

## 5. Textos em português (Authentication → Emails → Templates)
Em cada modelo, troque Subject e corpo pelo texto abaixo. Mantenha o trecho `{{ .ConfirmationURL }}`.

**Reset Password** — Subject: `Redefinir sua senha — ADHONEP-SC`
```html
<h2>Redefinir senha</h2>
<p>Recebemos um pedido para redefinir a senha da sua conta na plataforma ADHONEP-SC.</p>
<p><a href="{{ .ConfirmationURL }}">Criar uma nova senha</a></p>
<p>Se não foi você, ignore este e-mail: sua senha continua a mesma.</p>
```

**Invite user** — Subject: `Seu acesso à plataforma ADHONEP-SC`
```html
<h2>Bem-vindo(a) à plataforma ADHONEP-SC</h2>
<p>A diretoria criou um acesso para você.</p>
<p><a href="{{ .ConfirmationURL }}">Aceitar convite e definir minha senha</a></p>
```

**Change Email Address** — Subject: `Confirme seu novo e-mail — ADHONEP-SC`
```html
<h2>Confirmar novo e-mail</h2>
<p>Para usar este endereço na plataforma ADHONEP-SC, confirme abaixo:</p>
<p><a href="{{ .ConfirmationURL }}">Confirmar novo e-mail</a></p>
```
