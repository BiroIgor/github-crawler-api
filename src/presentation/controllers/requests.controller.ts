import type { Request, Response, NextFunction } from "express";
import type { CreateRequestUseCase } from "../../application/use-cases/create-request.js";
import type { GetRequestByIdUseCase } from "../../application/use-cases/get-request-by-id.js";
import type { ListRequestsUseCase } from "../../application/use-cases/list-requests.js";
import type { DeleteRequestUseCase } from "../../application/use-cases/delete-request.js";

export class RequestsController {
  constructor(
    private readonly createRequest: CreateRequestUseCase,
    private readonly getRequestById: GetRequestByIdUseCase,
    private readonly listRequests: ListRequestsUseCase,
    private readonly deleteRequest: DeleteRequestUseCase,
  ) {}

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { organizationName } = req.body as { organizationName: string };
      const { requestId } = await this.createRequest.execute(organizationName);
      res.status(201).json({ requestId });
    } catch (e) {
      next(e);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { request, result } = await this.getRequestById.execute(id);
      res.json({
        request,
        result,
        pending: request.status === "pending" || request.status === "processing",
      });
    } catch (e) {
      next(e);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { limit, offset } = req.listQuery!;
      const { items, total } = await this.listRequests.execute(limit, offset);
      res.json({ items, total, limit, offset });
    } catch (e) {
      next(e);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      await this.deleteRequest.execute(id);
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  };
}
