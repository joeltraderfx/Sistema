# Servidor de Licenças — guia de deploy (passo a passo)

## 1. Banco de dados (Supabase — grátis)
1. Crie uma conta em https://supabase.com e um novo projeto.
2. Vá em **SQL Editor** → cole o conteúdo de `db.sql` → **Run**.
3. Vá em **Project Settings → Database → Connection string → URI** e copie. Isso vai no `DATABASE_URL`.

## 2. E-mail (Brevo — grátis, 300 e-mails/dia)
1. Crie conta em https://www.brevo.com
2. Em **Settings → SMTP & API → API Keys**, gere uma chave → `BREVO_API_KEY`.
3. Em **Senders**, cadastre e verifique o e-mail que vai aparecer como remetente → `EMAIL_FROM`.

## 3. Deploy (Render — grátis)
1. Suba esta pasta `server/` para um repositório no GitHub.
2. Em https://render.com → **New → Web Service** → conecte o repositório.
3. Build command: `npm install` — Start command: `npm start`.
4. Em **Environment**, cadastre todas as variáveis do `.env.example` com os valores reais.
5. Depois do deploy, você terá uma URL tipo `https://seu-app.onrender.com`.

(Railway ou Vercel funcionam de forma equivalente — o importante é configurar as mesmas variáveis de ambiente.)

## 4. Configurar o webhook na Greenn
Para **cada um dos 3 produtos** (Mensal, Trimestral, Anual):
1. No painel da Greenn, vá no produto → **Webhook Delivery / Envio de Webhook**.
2. Cole a URL: `https://seu-app.onrender.com/webhook/greenn?token=SEU_GREENN_WEBHOOK_TOKEN`
   (o token é o mesmo valor que você colocou em `GREENN_WEBHOOK_TOKEN` no `.env`).
3. Salve.
4. Faça uma compra de teste (ou peça o teste de webhook da Greenn) e confira nos logs do Render
   o `product.id` que chegou no payload — use esse valor para preencher `PLAN_DAYS_BY_PRODUCT_ID`
   corretamente (ex: `{"184321":30,"184322":90,"184323":365}`).

## 5. Pronto
A partir daqui, todo o fluxo é automático:
Cliente compra → Greenn dispara webhook → servidor gera a chave → e-mail é enviado →
cliente cola a chave no indicador → indicador valida e se auto-ativa na conta dele.

## Observações de segurança importantes
- `GREENN_WEBHOOK_TOKEN` e `LICENSE_SECRET` devem ser strings longas e aleatórias — nunca as deixe públicas.
- O Render free tier "dorme" o serviço após alguns minutos sem uso: o primeiro webhook depois de um
  tempo pode demorar ~30s para responder. Para um negócio em produção que não pode falhar,
  considere o plano pago mínimo (ou Railway), para o serviço ficar sempre ativo.
