export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Recurso não encontrado") {
    super(message, 404, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AppError {
  constructor(message = "Dados inválidos") {
    super(message, 400, "VALIDATION");
    this.name = "ValidationError";
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflito com o estado atual do recurso") {
    super(message, 409, "CONFLICT");
    this.name = "ConflictError";
  }
}
