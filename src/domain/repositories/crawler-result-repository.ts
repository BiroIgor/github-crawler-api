import type { CrawlerResult } from "../entities/crawler-result.js";

export interface CrawlerResultRepository {
  save(result: CrawlerResult): Promise<void>;
  findByRequestId(requestId: string): Promise<CrawlerResult | null>;
  deleteByRequestId(requestId: string): Promise<void>;
}
