import "dotenv/config";
import { createContainer } from "./container.js";
import { createExpressApp } from "./presentation/app.js";
import { logger } from "./shared/logger.js";
import { disconnectMongo } from "./infrastructure/database/mongo/connection.js";

async function main() {
  const container = await createContainer();
  const app = createExpressApp(container);

  const server = app.listen(container.env.PORT, () => {
    logger.info({ port: container.env.PORT }, "API no ar");
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Encerrando API…");
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    await container.rabbit.close();
    await container.pool.end();
    await disconnectMongo();
    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error({ err }, "Falha ao subir a API");
  process.exit(1);
});
