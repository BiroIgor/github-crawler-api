import type { Pool } from "pg";
import type { CrawlRequest, RequestStatus } from "../../../domain/entities/request.js";
import type { RequestRepository } from "../../../domain/repositories/request-repository.js";

const TABLE = "ghorg_scrape_requests";

type Row = {
  id: string;
  organization_name: string;
  status: string;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
};

const ALLOWED: RequestStatus[] = [
  "pending",
  "processing",
  "completed",
  "failed",
];

function mapStatus(s: string): RequestStatus {
  if (ALLOWED.includes(s as RequestStatus)) return s as RequestStatus;
  return "failed";
}

function mapRow(row: Row): CrawlRequest {
  return {
    id: row.id,
    organizationName: row.organization_name,
    status: mapStatus(row.status),
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PgRequestRepository implements RequestRepository {
  constructor(private readonly pool: Pool) {}

  async create(organizationName: string): Promise<CrawlRequest> {
    const res = await this.pool.query<Row>(
      `INSERT INTO ${TABLE} (organization_name)
       VALUES ($1)
       RETURNING id, organization_name, status, error_message, created_at, updated_at`,
      [organizationName],
    );
    return mapRow(res.rows[0]);
  }

  async findById(id: string): Promise<CrawlRequest | null> {
    const res = await this.pool.query<Row>(
      `SELECT id, organization_name, status, error_message, created_at, updated_at
       FROM ${TABLE} WHERE id = $1`,
      [id],
    );
    if (res.rowCount === 0) return null;
    return mapRow(res.rows[0]);
  }

  async findAll(limit: number, offset: number): Promise<CrawlRequest[]> {
    const res = await this.pool.query<Row>(
      `SELECT id, organization_name, status, error_message, created_at, updated_at
       FROM ${TABLE}
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return res.rows.map(mapRow);
  }

  async updateStatus(
    id: string,
    status: RequestStatus,
    errorMessage: string | null = null,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE ${TABLE}
       SET status = $2, error_message = $3, updated_at = NOW()
       WHERE id = $1`,
      [id, status, errorMessage],
    );
  }

  async deleteById(id: string): Promise<void> {
    await this.pool.query(`DELETE FROM ${TABLE} WHERE id = $1`, [id]);
  }
}
