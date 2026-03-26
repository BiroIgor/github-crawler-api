import "dotenv/config";
import { createContainer } from "./container.js";
import { GHORG_SCRAPE_JOBS_QUEUE } from "./infrastructure/queue/rabbitmq-topology.js";
import { disconnectMongo } from "./infrastructure/database/mongo/connection.js";
import { logger } from "./shared/logger.js";

async function main() {
  const container = await createContainer();
  const ch = await container.rabbit.getChannel();

  let activeJobs = 0;

  const { consumerTag } = await ch.consume(
    GHORG_SCRAPE_JOBS_QUEUE,
    (msg) => {
      void (async () => {
        if (!msg) return;
        activeJobs++;
        try {
          const body = JSON.parse(msg.content.toString()) as {
            requestId: string;
            organizationName: string;
          };
          const result = await container.crawlOrganization.execute(
            body.requestId,
            body.organizationName,
          );
          if (result === null) {
            logger.info(
              { requestId: body.requestId },
              "Job ignorado: pedido removido antes do scrape",
            );
          }
          ch.ack(msg);
        } catch (err) {
          logger.error({ err }, "Job ghorg_scrape falhou");
          ch.nack(msg, false, false);
        } finally {
          activeJobs--;
        }
      })();
    },
    { noAck: false },
  );

  logger.info({ queue: GHORG_SCRAPE_JOBS_QUEUE }, "Worker consumindo fila ghorg_scrape");

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Encerrando worker…");

    try {
      await ch.cancel(consumerTag);
    } catch {
      /* já fechado */
    }

    const deadline = Date.now() + 30_000;
    while (activeJobs > 0 && Date.now() < deadline) {
      logger.info({ activeJobs }, "Aguardando jobs em andamento…");
      await new Promise((r) => setTimeout(r, 500));
    }
    if (activeJobs > 0) {
      logger.warn({ activeJobs }, "Timeout esperando jobs — forçando encerramento");
    }

    await container.rabbit.close();
    await container.pool.end();
    await disconnectMongo();
    logger.info("Worker encerrado com sucesso");
    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error({ err }, "Falha ao subir o worker");
  process.exit(1);
});
