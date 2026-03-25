import { Router } from "express";
import type { RequestsController } from "../controllers/requests.controller.js";
import {
  validateCreateRequest,
  validateIdParam,
  validateListQuery,
} from "../middlewares/validation.js";

export function requestsRouter(controller: RequestsController): Router {
  const r = Router();

  r.post("/", validateCreateRequest, controller.create);
  r.get("/", validateListQuery, controller.list);
  r.get("/:id", validateIdParam, controller.getById);
  r.delete("/:id", validateIdParam, controller.remove);

  return r;
}
