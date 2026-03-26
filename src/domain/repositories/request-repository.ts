import type { CrawlRequest, RequestStatus } from "../entities/request.js";

export interface RequestRepository {
  create(organizationName: string): Promise<CrawlRequest>;
  findById(id: string): Promise<CrawlRequest | null>;
  findPendingByOrganization(organizationName: string): Promise<CrawlRequest | null>;
  findAll(limit: number, offset: number): Promise<CrawlRequest[]>;
  count(): Promise<number>;
  updateStatus(
    id: string,
    status: RequestStatus,
    errorMessage?: string | null,
  ): Promise<void>;
  deleteById(id: string): Promise<void>;
}
