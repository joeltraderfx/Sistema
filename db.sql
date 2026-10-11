const { Pool } = require("pg");
const { URL } = require("url");

// Extrai as partes da DATABASE_URL para forçar IPv4
let poolConfig = {
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

if (process.env.DATABASE_URL) {
  try {
    const dbUrl = new URL(process.env.DATABASE_URL);
    poolConfig.host = dbUrl.hostname;
    poolConfig.port = parseInt(dbUrl.port || "5432");
    poolConfig.database = dbUrl.pathname.substring(1);
    poolConfig.user = dbUrl.username;
    poolConfig.password = dbUrl.password;
  } catch (e) {
    console.error("Erro ao parsear DATABASE_URL:", e.message);
    poolConfig.connectionString = process.env.DATABASE_URL;
  }
}

const pool = new Pool(poolConfig);

pool.on("error", (err) => {
  console.error("Erro inesperado no pool PostgreSQL:", err);
});

async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log("Query executada em", duration, "ms");
    return res;
  } catch (error) {
    console.error("Erro na query:", error.message);
    throw error;
  }
}

module.exports = { query, pool };
