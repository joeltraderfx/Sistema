const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

// Conecta ao Supabase via HTTP (funciona 100% no Render, sem IPv6)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Gera uma chave legivel tipo XXXX-XXXX-XXXX-XXXX
function generateLicenseKey() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
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
  if (greennContractId) {
    const { data: existing, error } = await supabase
      .from("licenses")
      .select("*")
      .eq("greenn_contract_id", greennContractId)
      .limit(1);

    if (error) throw error;

    if (existing && existing.length > 0) {
      const lic = existing[0];
      const base = new Date() > new Date(lic.expires_at) ? new Date() : new Date(lic.expires_at);
      const newExpires = new Date(base.getTime() + planDays * 86400000);

      const { data: updated, error: updateError } = await supabase
        .from("licenses")
        .update({ status: "active", expires_at: newExpires.toISOString(), updated_at: new Date().toISOString() })
        .eq("id", lic.id)
        .select();

      if (updateError) throw updateError;
      return { license: updated[0], isNew: false };
    }
  }

  const licenseKey = generateLicenseKey();
  const expiresAt = new Date(Date.now() + planDays * 86400000);

  const { data: inserted, error } = await supabase
    .from("licenses")
    .insert({
      license_key: licenseKey,
      product_id: productId,
      plan_days: planDays,
      client_email: clientEmail,
      client_name: clientName || null,
      status: "active",
      expires_at: expiresAt.toISOString(),
      greenn_sale_id: greennSaleId || null,
      greenn_contract_id: greennContractId || null,
    })
    .select();

  if (error) throw error;
  return { license: inserted[0], isNew: true };
}

async function revokeByContract(greennContractId) {
  if (!greennContractId) return;
  await supabase
    .from("licenses")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("greenn_contract_id", greennContractId);
}

// Valida (e, na 1a vez, vincula) uma chave a uma conta MT5
async function validateAndBind({ licenseKey, account, broker }) {
  try {
    const { data: licencas, error } = await supabase
      .from("licenses")
      .select("*")
      .eq("license_key", licenseKey)
      .limit(1);

    if (error) {
      console.error("Erro ao buscar licença:", error);
      return { ok: false, reason: "DATABASE_ERROR" };
    }

    if (!licencas || licencas.length === 0) {
      return { ok: false, reason: "KEY_NOT_FOUND" };
    }

    const lic = licencas[0];

    if (lic.status !== "active") {
      return { ok: false, reason: "KEY_CANCELED" };
    }

    if (!lic.expires_at || new Date(lic.expires_at) < new Date()) {
      return { ok: false, reason: "KEY_EXPIRED" };
    }

    if (!lic.bound_account) {
      // Primeira ativação: vincula a chave a esta conta
      const { error: updateError } = await supabase
        .from("licenses")
        .update({
          bound_account: String(account),
          bound_broker: broker || "Desconhecido",
          bound_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", lic.id);

      if (updateError) {
        console.error("Erro ao vincular conta:", updateError);
        return { ok: false, reason: "BIND_ERROR" };
      }

      return { ok: true, reason: "SUCCESS", expiresAt: lic.expires_at };
    }

    if (String(lic.bound_account) !== String(account)) {
      return { ok: false, reason: "KEY_BOUND_OTHER_ACCOUNT" };
    }

    return { ok: true, reason: "SUCCESS", expiresAt: lic.expires_at };

  } catch (error) {
    console.error("ERRO AO VALIDAR LICENÇA:", error);
    return { ok: false, reason: "SERVER_ERROR: " + error.message };
  }
}

module.exports = { createOrRenewLicense, revokeByContract, validateAndBind };
