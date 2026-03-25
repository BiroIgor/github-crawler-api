import type { CrawlerResult } from "../../domain/entities/crawler-result.js";
import type { RequestRepository } from "../../domain/repositories/request-repository.js";
import type { CrawlerResultRepository } from "../../domain/repositories/crawler-result-repository.js";
import type { GithubCrawlerPort } from "../ports/github-crawler.port.js";

export class CrawlOrganizationService {
  constructor(
    private readonly requestRepository: RequestRepository,
    private readonly resultRepository: CrawlerResultRepository,
    private readonly githubCrawler: GithubCrawlerPort,
  ) {}

  /**
   * @returns `null` se o pedido não existir mais (ex.: apagado na API) — fila deve dar ack.
   */
  async execute(
    requestId: string,
    organizationName: string,
  ): Promise<CrawlerResult | null> {
    const row = await this.requestRepository.findById(requestId);
    if (!row) return null;

    await this.requestRepository.updateStatus(requestId, "processing", null);

    try {
      const { data, metadata } =
        await this.githubCrawler.crawl(organizationName);

      const result: CrawlerResult = {
        requestId,
        organizationName,
        data,
        metadata: {
          ...metadata,
          fetchedAt: new Date().toISOString(),
        },
      };

      await this.resultRepository.save(result);
      await this.requestRepository.updateStatus(requestId, "completed", null);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      const stillThere = await this.requestRepository.findById(requestId);
      if (stillThere) {
        await this.requestRepository.updateStatus(requestId, "failed", message);
      }
      throw err;
    }
  }
}
