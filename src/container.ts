import { loadEnv } from "./config/env.js";
import { CreateRequestUseCase } from "./application/use-cases/create-request.js";
import { GetRequestByIdUseCase } from "./application/use-cases/get-request-by-id.js";
import { ListRequestsUseCase } from "./application/use-cases/list-requests.js";
import { DeleteRequestUseCase } from "./application/use-cases/delete-request.js";
import { CrawlOrganizationService } from "./application/services/crawl-organization.js";
import { createPool } from "./infrastructure/database/postgres/connection.js";
import { ensureSchema } from "./infrastructure/database/postgres/migrate.js";
import { PgRequestRepository } from "./infrastructure/database/postgres/pg-request-repository.js";
import { connectMongo } from "./infrastructure/database/mongo/connection.js";
import { MongoCrawlerResultRepository } from "./infrastructure/database/mongo/mongo-crawler-result-repository.js";
import { RabbitMqConnection } from "./infrastructure/queue/rabbitmq-connection.js";
import { RabbitMqPublisher } from "./infrastructure/queue/rabbitmq-publisher.js";
import { CrawleeGithubCrawler } from "./infrastructure/crawler/github-crawler.js";
import type pg from "pg";

export type AppContainer = {
  env: ReturnType<typeof loadEnv>;
  pool: pg.Pool;
  rabbit: RabbitMqConnection;
  createRequest: CreateRequestUseCase;
  getRequestById: GetRequestByIdUseCase;
  listRequests: ListRequestsUseCase;
  deleteRequest: DeleteRequestUseCase;
  crawlOrganization: CrawlOrganizationService;
};

export async function createContainer(): Promise<AppContainer> {
  const env = loadEnv();
  const pool = createPool(env);
  await ensureSchema(pool);
  await connectMongo(env);

  const rabbit = new RabbitMqConnection(env.RABBITMQ_URL);

  const requestRepository = new PgRequestRepository(pool);
  const resultRepository = new MongoCrawlerResultRepository();
  const queuePublisher = new RabbitMqPublisher(() => rabbit.getChannel());

  const githubCrawler = new CrawleeGithubCrawler({
    proxyUrls: env.ghorgProxyUrlList,
    githubToken: env.GHORG_GITHUB_TOKEN,
  });
  const crawlOrganization = new CrawlOrganizationService(
    requestRepository,
    resultRepository,
    githubCrawler,
  );

  return {
    env,
    pool,
    rabbit,
    createRequest: new CreateRequestUseCase(requestRepository, queuePublisher),
    getRequestById: new GetRequestByIdUseCase(requestRepository, resultRepository),
    listRequests: new ListRequestsUseCase(requestRepository),
    deleteRequest: new DeleteRequestUseCase(requestRepository, resultRepository),
    crawlOrganization,
  };
}
