require("dotenv").config();
const express = require("express");
const { createOrRenewLicense, revokeByContract, validateAndBind } = require("./license");
const { sendLicenseEmail } = require("./email");

const app = express();
app.use(express.json({ limit: "1mb" }));

const PLAN_DAYS_BY_PRODUCT_ID = JSON.parse(process.env.PLAN_DAYS_BY_PRODUCT_ID || "{}");
const PLAN_LABELS = { 30: "Mensal", 90: "Trimestral", 365: "Anual" };

app.get("/", (req, res) => res.send("License server ok"));

// ---------------------------------------------------------------
// Webhook da Greenn
// Configure no painel da Greenn, em cada um dos 3 produtos, a URL:
//   https://SEU-SERVIDOR/webhook/greenn?token=SEU_GREENN_WEBHOOK_TOKEN
// ---------------------------------------------------------------
app.post("/webhook/greenn", async (req, res) => {
  try {
    if (req.query.token !== process.env.GREENN_WEBHOOK_TOKEN) {
      return res.status(401).json({ error: "invalid token" });
    }

    const body = req.body;
    const type = body.type; // "sale" | "contract" | "lead"
    const currentStatus = body.currentStatus;

    // Sempre responde 200 rapido; processa em seguida (a Greenn espera 2xx)
    res.status(200).json({ received: true });

    if (type !== "sale" && type !== "contract") return; // ignora "lead" (carrinho abandonado) etc.

    const product = body.product || {};
    const client = body.client || {};
    const sale = body.sale || body.currentSale || {};
    const contract = body.contract || {};

    const productId = String(product.id || "");
    const planDays = PLAN_DAYS_BY_PRODUCT_ID[productId];

    if (!planDays) {
      console.warn(`Produto ${productId} nao mapeado em PLAN_DAYS_BY_PRODUCT_ID - ignorando evento.`);
      return;
    }

    const greennSaleId = sale.id ? String(sale.id) : null;
    const greennContractId = contract.id ? String(contract.id) : (type === "sale" ? greennSaleId : null);

    if (currentStatus === "paid") {
      const { license, isNew } = await createOrRenewLicense({
        productId,
        planDays,
        clientEmail: client.email,
        clientName: client.name,
        greennSaleId,
        greennContractId,
      });

      if (isNew) {
        await sendLicenseEmail({
          to: license.client_email,
          name: license.client_name,
          licenseKey: license.license_key,
          planLabel: PLAN_LABELS[planDays] || `${planDays} dias`,
          expiresAt: license.expires_at,
        });
      }
      console.log(`Licenca ${isNew ? "criada" : "renovada"}: ${license.license_key} (${client.email})`);
    } else if (["canceled", "unpaid", "refused", "refunded", "chargedback"].includes(currentStatus)) {
      await revokeByContract(greennContractId);
      console.log(`Licenca revogada para contrato ${greennContractId} (status: ${currentStatus})`);
    }
  } catch (err) {
    console.error("Erro processando webhook Greenn:", err);
  }
});

// ---------------------------------------------------------------
// Endpoint que o indicador MT5 chama para validar a chave
// ---------------------------------------------------------------
app.post("/validate", async (req, res) => {
  try {
    const { license_key, account, broker } = req.body || {};
    if (!license_key || !account) {
      return res.status(400).json({ ok: false, reason: "MISSING_FIELDS" });
    }
    const result = await validateAndBind({ licenseKey: license_key, account: String(account), broker });
    res.json(result);
  } catch (err) {
    console.error("Erro em /validate:", err);
    res.status(500).json({ ok: false, reason: "SERVER_ERROR" });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`License server rodando na porta ${port}`));
