import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { ValidationError } from "../../shared/errors/app-errors.js";
import {
  extractGithubOrgLogin,
  GHORG_LOGIN_PATTERN,
} from "../../shared/github-org-login.js";

const createBodySchema = z.object({
  organizationName: z
    .string()
    .trim()
    .min(1, "Informe o login ou a URL do perfil no GitHub")
    .max(2048)
    .transform((s) => extractGithubOrgLogin(s))
    .refine((s) => GHORG_LOGIN_PATTERN.test(s), {
      message:
        "Login inválido. Exemplos: facebook ou https://github.com/facebook",
    }),
});

export function validateCreateRequest(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const parsed = createBodySchema.safeParse(req.body);
  if (!parsed.success) {
    next(
      new ValidationError(
        parsed.error.issues.map((i) => i.message).join("; ") ||
          "organizationName inválido",
      ),
    );
    return;
  }
  req.body = parsed.data;
  next();
}

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export function validateListQuery(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    next(new ValidationError("Parâmetros limit/offset inválidos"));
    return;
  }
  req.listQuery = parsed.data;
  next();
}

const uuidParam = z.object({
  id: z.string().uuid(),
});

export function validateIdParam(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const parsed = uuidParam.safeParse(req.params);
  if (!parsed.success) {
    next(new ValidationError("ID deve ser um UUID válido"));
    return;
  }
  next();
}
