import type { RequestRepository } from "../../domain/repositories/request-repository.js";
import type { QueuePublisher } from "../../domain/services/queue-publisher.js";
import { ConflictError } from "../../shared/errors/app-errors.js";

export class CreateRequestUseCase {
  constructor(
    private readonly requestRepository: RequestRepository,
    private readonly queuePublisher: QueuePublisher,
  ) {}

  async execute(organizationName: string): Promise<{ requestId: string }> {
    const existing =
      await this.requestRepository.findPendingByOrganization(organizationName);
    if (existing) {
      throw new ConflictError(
        `Já existe um pedido em andamento para "${organizationName}" (status: ${existing.status}). Aguarde a conclusão ou use o ID existente.`,
      );
    }
    const req = await this.requestRepository.create(organizationName);
    await this.queuePublisher.publish({
      requestId: req.id,
      organizationName: req.organizationName,
    });
    return { requestId: req.id };
  }
}
