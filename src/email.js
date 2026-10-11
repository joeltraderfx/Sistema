const fetch = require("node-fetch");

async function sendLicenseEmail({ to, name, licenseKey, planLabel, expiresAt }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.error("BREVO_API_KEY nao configurada - email NAO enviado. Chave gerada:", licenseKey);
    return;
  }

  const expiresStr = new Date(expiresAt).toLocaleDateString("pt-BR");

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
      <h2>Sua chave de ativação chegou 🎉</h2>
      <p>Olá${name ? " " + name : ""},</p>
      <p>Obrigado pela sua compra! Seu plano <b>${planLabel}</b> está ativo.</p>
      <p style="font-size:14px;color:#555">Chave de ativação (cole no campo <b>LicenseKey</b> do indicador):</p>
      <p style="font-size:20px;font-weight:bold;background:#f4f4f4;padding:12px 16px;border-radius:8px;letter-spacing:1px">
        ${licenseKey}
      </p>
      <p style="font-size:14px;color:#555">Válida até: <b>${expiresStr}</b></p>
      <p style="font-size:13px;color:#888">Importante: a chave é válida em <b>apenas uma conta de negociação</b>. Ela será vinculada automaticamente na primeira vez que você rodar o indicador.</p>
    </div>
  `;

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      sender: { email: process.env.EMAIL_FROM, name: process.env.EMAIL_FROM_NAME || "Licencas" },
      to: [{ email: to, name: name || undefined }],
      subject: "Sua chave de ativação",
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("Falha ao enviar email via Brevo:", res.status, body);
  }
}

module.exports = { sendLicenseEmail };
