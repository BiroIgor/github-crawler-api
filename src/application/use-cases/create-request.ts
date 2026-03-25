import type { RequestRepository } from "../../domain/repositories/request-repository.js";
import type { QueuePublisher } from "../../domain/services/queue-publisher.js";

export class CreateRequestUseCase {
  constructor(
    private readonly requestRepository: RequestRepository,
    private readonly queuePublisher: QueuePublisher,
  ) {}

  async execute(organizationName: string): Promise<{ requestId: string }> {
    const req = await this.requestRepository.create(organizationName);
    await this.queuePublisher.publish({
      requestId: req.id,
      organizationName: req.organizationName,
    });
    return { requestId: req.id };
  }
}
