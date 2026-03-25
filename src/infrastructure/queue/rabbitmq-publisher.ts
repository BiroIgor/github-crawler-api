import type amqp from "amqplib";
import type { QueuePublisher } from "../../domain/services/queue-publisher.js";
import { GHORG_SCRAPE_JOBS_QUEUE } from "./rabbitmq-topology.js";

export class RabbitMqPublisher implements QueuePublisher {
  constructor(private readonly getChannel: () => Promise<amqp.Channel>) {}

  async publish(message: {
    requestId: string;
    organizationName: string;
  }): Promise<void> {
    const ch = await this.getChannel();
    ch.sendToQueue(GHORG_SCRAPE_JOBS_QUEUE, Buffer.from(JSON.stringify(message)), {
      persistent: true,
      contentType: "application/json",
    });
  }
}
