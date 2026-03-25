import type { Pool } from "pg";

/** Tabela relacional: fila de pedidos de scrape de perfil de organização no GitHub. */
const TABLE = "ghorg_scrape_requests";

export async function ensureSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_name VARCHAR(255) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      error_message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_ghorg_scrape_requests_status ON ${TABLE}(status);`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_ghorg_scrape_requests_created_at ON ${TABLE}(created_at DESC);`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_ghorg_scrape_requests_org ON ${TABLE}(organization_name);`,
  );
}
