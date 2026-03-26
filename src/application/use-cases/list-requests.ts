import type { CrawlRequest } from "../../domain/entities/request.js";
import type { RequestRepository } from "../../domain/repositories/request-repository.js";

export type ListRequestsResult = {
  items: CrawlRequest[];
  total: number;
};

export class ListRequestsUseCase {
  constructor(private readonly requestRepository: RequestRepository) {}

  async execute(limit: number, offset: number): Promise<ListRequestsResult> {
    const [items, total] = await Promise.all([
      this.requestRepository.findAll(limit, offset),
      this.requestRepository.count(),
    ]);
    return { items, total };
  }
}
