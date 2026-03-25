export interface QueuePublisher {
  publish(message: {
    requestId: string;
    organizationName: string;
  }): Promise<void>;
}
