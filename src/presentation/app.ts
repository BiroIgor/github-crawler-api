import path from "node:path";
import express from "express";
import helmet, { contentSecurityPolicy } from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import type { AppContainer } from "../container.js";
import { RequestsController } from "./controllers/requests.controller.js";
import { HealthController } from "./controllers/health.controller.js";
import { requestsRouter } from "./routes/requests.routes.js";
import { healthRouter } from "./routes/health.routes.js";
import { errorHandler } from "./middlewares/error-handler.js";

export function createExpressApp(container: AppContainer): express.Express {
  const app = express();

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...contentSecurityPolicy.getDefaultDirectives(),
          "img-src": [
            "'self'",
            "data:",
            "https://avatars.githubusercontent.com",
          ],
        },
      },
    }),
  );
  app.use(
    cors({
      origin: true,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "64kb" }));
  app.use(
    rateLimit({
      windowMs: 60_000,
      max: 120,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  const requestsController = new RequestsController(
    container.createRequest,
    container.getRequestById,
    container.listRequests,
    container.deleteRequest,
  );
  const healthController = new HealthController(
    container.pool,
    container.rabbit,
  );

  app.use("/health", healthRouter(healthController));
  app.use("/api/requests", requestsRouter(requestsController));

  const publicDir = path.join(process.cwd(), "public");
  app.use(express.static(publicDir));

  app.use(errorHandler);

  return app;
}
