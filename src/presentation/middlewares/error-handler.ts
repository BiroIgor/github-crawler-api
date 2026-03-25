import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../shared/errors/app-errors.js";
import { logger } from "../../shared/logger.js";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message },
    });
    return;
  }

  logger.error({ err }, "Erro não tratado");
  res.status(500).json({
    error: { code: "INTERNAL", message: "Erro interno do servidor" },
  });
}
