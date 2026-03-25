import amqp from "amqplib";
import { assertGhorgQueueTopology } from "./rabbitmq-topology.js";
import { logger } from "../../shared/logger.js";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class RabbitMqConnection {
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private closing = false;

  constructor(private readonly url: string) {}

  async getChannel(): Promise<amqp.Channel> {
    if (this.channel) return this.channel;
    return this.connect();
  }

  private async connect(attempt = 1): Promise<amqp.Channel> {
    const maxAttempts = 10;
    const baseDelay = 1000;

    try {
      this.connection = await amqp.connect(this.url);

      this.connection.on("error", (err) => {
        logger.error({ err }, "RabbitMQ connection error");
      });

      this.connection.on("close", () => {
        if (this.closing) return;
        logger.warn("RabbitMQ connection closed — tentando reconectar");
        this.connection = null;
        this.channel = null;
        void this.reconnect();
      });

      const ch = await this.connection.createChannel();
      await assertGhorgQueueTopology(ch);
      await ch.prefetch(1);
      this.channel = ch;

      if (attempt > 1) {
        logger.info(
          { attempt },
          "RabbitMQ reconectado com sucesso",
        );
      }

      return ch;
    } catch (err) {
      if (attempt >= maxAttempts) {
        logger.error(
          { err, attempt },
          "RabbitMQ: esgotadas tentativas de conexão",
        );
        throw err;
      }
      const delay = Math.min(baseDelay * 2 ** (attempt - 1), 30_000);
      logger.warn(
        { err, attempt, nextRetryMs: delay },
        "RabbitMQ: falha ao conectar — retry com backoff",
      );
      await sleep(delay);
      return this.connect(attempt + 1);
    }
  }

  private async reconnect(): Promise<void> {
    if (this.closing) return;
    try {
      await this.connect();
    } catch {
      logger.error("RabbitMQ: reconexão definitivamente falhou");
    }
  }

  async close(): Promise<void> {
    this.closing = true;
    try {
      await this.channel?.close();
    } finally {
      this.channel = null;
      await this.connection?.close();
      this.connection = null;
    }
  }
}
