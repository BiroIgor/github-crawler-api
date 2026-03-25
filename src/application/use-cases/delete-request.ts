import { NotFoundError } from "../../shared/errors/app-errors.js";
import type { RequestRepository } from "../../domain/repositories/request-repository.js";
import type { CrawlerResultRepository } from "../../domain/repositories/crawler-result-repository.js";

export class DeleteRequestUseCase {
  constructor(
    private readonly requestRepository: RequestRepository,
    private readonly resultRepository: CrawlerResultRepository,
  ) {}

  async execute(id: string): Promise<void> {
    const existing = await this.requestRepository.findById(id);
    if (!existing) throw new NotFoundError("Requisição não encontrada");
    await this.resultRepository.deleteByRequestId(id);
    await this.requestRepository.deleteById(id);
  }
}
