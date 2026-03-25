export type RequestStatus = "pending" | "processing" | "completed" | "failed";

export interface CrawlRequest {
  id: string;
  organizationName: string;
  status: RequestStatus;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}
