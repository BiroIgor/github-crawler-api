import type amqp from "amqplib";

/** Fila: jobs de scrape de página de organização GitHub (nomenclatura ghorg). */
export const GHORG_SCRAPE_JOBS_QUEUE = "ghorg_scrape_jobs";

const DLQ = "ghorg_scrape_jobs_dlq";
const DLX = "ghorg_scrape_dlx";
const DLX_RK = "ghorg_dlq";

export async function assertGhorgQueueTopology(channel: amqp.Channel): Promise<void> {
  await channel.assertExchange(DLX, "direct", { durable: true });
  await channel.assertQueue(DLQ, { durable: true });
  await channel.bindQueue(DLQ, DLX, DLX_RK);
  await channel.assertQueue(GHORG_SCRAPE_JOBS_QUEUE, {
    durable: true,
    arguments: {
      "x-dead-letter-exchange": DLX,
      "x-dead-letter-routing-key": DLX_RK,
    },
  });
}
