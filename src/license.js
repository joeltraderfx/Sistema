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
     values ($1,$2,$3,$4,$5,'active',$6,$7,$8) returning *`,
    [licenseKey, productId, planDays, clientEmail, clientName || null, expiresAt.toISOString(), greennSaleId || null, greennContractId || null]
  );

  return { license: inserted.rows[0], isNew: true };
}

async function revokeByContract(greennContractId) {
  if (!greennContractId) return;
  await query(
    "update licenses set status='canceled', updated_at=now() where greenn_contract_id=$1",
    [greennContractId]
  );
}

// Valida (e, na 1a vez, vincula) uma chave a uma conta MT5
async function validateAndBind({ licenseKey, account, broker }) {
  try {
    const res = await query("select * from licenses where license_key=$1", [licenseKey]);
    
    if (!res || res.rows.length === 0) {
      return { ok: false, reason: "KEY_NOT_FOUND" };
    }
    
    const lic = res.rows[0];

    if (lic.status !== "active") {
      return { ok: false, reason: "KEY_CANCELED" };
    }

    // Proteção: verifica se expires_at existe antes de comparar
    if (!lic.expires_at || new Date(lic.expires_at) < new Date()) {
      return { ok: false, reason: "KEY_EXPIRED" };
    }

    if (!lic.bound_account) {
      // Primeira ativacao: vincula a chave a esta conta
      await query(
        "update licenses set bound_account=$1, bound_broker=$2, bound_at=now(), updated_at=now() where id=$3",
        [String(account), broker || 'Desconhecido', lic.id]
      );
      return { ok: true, reason: "SUCCESS", expiresAt: lic.expires_at };
    }

    if (String(lic.bound_account) !== String(account)) {
      return { ok: false, reason: "KEY_BOUND_OTHER_ACCOUNT" };
    }

    return { ok: true, reason: "SUCCESS", expiresAt: lic.expires_at };

  } catch (error) {
    // Isso é CRUCIAL: em vez de derrubar o servidor com erro 500, 
    // ele captura o erro, imprime no log do Render e avisa o MT5 o motivo real.
    console.error("ERRO AO VALIDAR LICENÇA:", error);
    return { ok: false, reason: "SERVER_ERROR: " + error.message };
  }
}

module.exports = { createOrRenewLicense, revokeByContract, validateAndBind };
