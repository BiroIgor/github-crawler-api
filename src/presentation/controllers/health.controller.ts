import type { Request, Response } from "express";
import mongoose from "mongoose";
import type pg from "pg";
import type { RabbitMqConnection } from "../../infrastructure/queue/rabbitmq-connection.js";

export class HealthController {
  constructor(
    private readonly pool: pg.Pool,
    private readonly rabbit: RabbitMqConnection,
  ) {}

  check = async (_req: Request, res: Response) => {
    const checks = {
      postgres: false,
      mongo: false,
      rabbitmq: false,
    };

    try {
      await this.pool.query("SELECT 1");
      checks.postgres = true;
    } catch {
      checks.postgres = false;
    }

    checks.mongo = mongoose.connection.readyState === 1;

    try {
      await this.rabbit.getChannel();
      checks.rabbitmq = true;
    } catch {
      checks.rabbitmq = false;
    }

    const ok = checks.postgres && checks.mongo && checks.rabbitmq;
    res.status(ok ? 200 : 503).json({ ok, checks });
  };
}
