import type { CrawlRequest } from "../../domain/entities/request.js";
import type { RequestRepository } from "../../domain/repositories/request-repository.js";

export class ListRequestsUseCase {
  constructor(private readonly requestRepository: RequestRepository) {}

  async execute(limit: number, offset: number): Promise<CrawlRequest[]> {
    return this.requestRepository.findAll(limit, offset);
  }
}
