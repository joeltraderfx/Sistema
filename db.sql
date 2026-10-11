const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("SUPABASE_URL e SUPABASE_KEY devem estar configuradas");
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Função query adaptada para usar Supabase via HTTP
async function query(text, params = []) {
  try {
    // Extrair nome da tabela e operação do SQL
    const lowerText = text.toLowerCase().trim();
    
    // SELECT
    if (lowerText.startsWith("select")) {
      const match = text.match(/from\s+(\w+)/i);
      if (!match) throw new Error("Não foi possível extrair tabela do SELECT");
      const table = match[1];
      
      const whereMatch = text.match(/where\s+(\w+)\s*=\s*\$1/i);
      let query = supabase.from(table).select("*");
      if (whereMatch && params[0] !== undefined) {
        query = query.eq(whereMatch[1], params[0]);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return { rows: data || [], rowCount: data ? data.length : 0 };
    }
    
    // INSERT
    if (lowerText.startsWith("insert")) {
      const match = text.match(/into\s+(\w+)/i);
      if (!match) throw new Error("Não foi possível extrair tabela do INSERT");
      const table = match[1];
      
      // Extrair colunas e valores
      const colsMatch = text.match(/\(([^)]+)\)\s*values\s*\(([^)]+)\)/i);
      if (!colsMatch) throw new Error("Formato INSERT não suportado");
      
      const cols = colsMatch[1].split(",").map(c => c.trim());
      const values = colsMatch[2].split(",").map((v, i) => {
        const paramIndex = parseInt(v.replace("$", "")) - 1;
        return params[paramIndex];
      });
      
      const row = {};
      cols.forEach((col, i) => { row[col] = values[i]; });
      
      const { data, error } = await supabase.from(table).insert(row).select();
      if (error) throw error;
      return { rows: data || [], rowCount: data ? data.length : 0 };
    }
    
    // UPDATE
    if (lowerText.startsWith("update")) {
      const match = text.match(/update\s+(\w+)/i);
      if (!match) throw new Error("Não foi possível extrair tabela do UPDATE");
      const table = match[1];
      
      const whereMatch = text.match(/where\s+(\w+)\s*=\s*\$(\d+)/i);
      const setMatch = text.match(/set\s+(.+?)\s+where/i);
      
      let query = supabase.from(table).update({});
      if (whereMatch) {
        const col = whereMatch[1];
        const paramIdx = parseInt(whereMatch[2]) - 1;
        query = query.eq(col, params[paramIdx]);
      }
      
      const { data, error } = await query.select();
      if (error) throw error;
      return { rows: data || [], rowCount: data ? data.length : 0 };
    }
    
    throw new Error("Tipo de query não suportado: " + lowerText.split(" ")[0]);
    
  } catch (error) {
    console.error("Erro na query:", error);
    throw error;
  }
}

module.exports = { query, supabase };
