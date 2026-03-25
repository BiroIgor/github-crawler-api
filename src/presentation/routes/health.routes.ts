import { Router } from "express";
import type { HealthController } from "../controllers/health.controller.js";

export function healthRouter(controller: HealthController): Router {
  const r = Router();
  r.get("/", controller.check);
  return r;
}
