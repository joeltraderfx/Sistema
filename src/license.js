const crypto = require("crypto");
const { query } = require("./db");

// Gera uma chave legivel tipo XXXX-XXXX-XXXX-XXXX (base32, sem caracteres ambiguos)
function generateLicenseKey() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0,O,1,I
  const bytes = crypto.randomBytes(16);
  let raw = "";
  for (let i = 0; i < bytes.length; i++) {
    raw += alphabet[bytes[i] % alphabet.length];
  }
  return raw.match(/.{1,4}/g).slice(0, 4).join("-");
}

async function createOrRenewLicense({
  productId,
  planDays,
  clientEmail,
  clientName,
  greennSaleId,
  greennContractId,
}) {
  // Se ja existe uma licenca para este contrato, apenas renova (estende a validade)
  if (greennContractId) {
    const existing = await query(
      "select * from licenses where greenn_contract_id = $1",
      [greennContractId]
    );
    if (existing.rows.length > 0) {
      const lic = existing.rows[0];
      const base = new Date() > new Date(lic.expires_at) ? new Date() : new Date(lic.expires_at);
      const newExpires = new Date(base.getTime() + planDays * 86400000);
      const updated = await query(
        `update licenses set status='active', expires_at=$1, updated_at=now() where id=$2 returning *`,
        [newExpires.toISOString(), lic.id]
      );
      return { license: updated.rows[0], isNew: false };
    }
  }

  const licenseKey = generateLicenseKey();
  const expiresAt = new Date(Date.now() + planDays * 86400000);

  const inserted = await query(
    `insert into licenses (license_key, product_id, plan_days, client_email, client_name,
       status, expires_at, greenn_sale_id, greenn_contract_id)
     values ($1,$
