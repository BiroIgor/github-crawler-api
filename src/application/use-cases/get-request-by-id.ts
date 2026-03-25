import { NotFoundError } from "../../shared/errors/app-errors.js";
import type { CrawlerResult } from "../../domain/entities/crawler-result.js";
import type { CrawlRequest } from "../../domain/entities/request.js";
import type { RequestRepository } from "../../domain/repositories/request-repository.js";
import type { CrawlerResultRepository } from "../../domain/repositories/crawler-result-repository.js";

export class GetRequestByIdUseCase {
  constructor(
    private readonly requestRepository: RequestRepository,
    private readonly resultRepository: CrawlerResultRepository,
  ) {}

  async execute(id: string): Promise<{
    request: CrawlRequest;
    result: CrawlerResult | null;
  }> {
    const request = await this.requestRepository.findById(id);
    if (!request) throw new NotFoundError("Requisição não encontrada");

    const result =
      request.status === "completed"
        ? await this.resultRepository.findByRequestId(id)
        : null;

    return { request, result };
  }
}
