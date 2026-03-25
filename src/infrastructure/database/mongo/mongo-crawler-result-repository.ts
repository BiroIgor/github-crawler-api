import type { CrawlerResult } from "../../../domain/entities/crawler-result.js";
import type { CrawlerResultRepository } from "../../../domain/repositories/crawler-result-repository.js";
import { CrawlerResultModel } from "./schemas/crawler-result.schema.js";

export class MongoCrawlerResultRepository implements CrawlerResultRepository {
  async save(result: CrawlerResult): Promise<void> {
    await CrawlerResultModel.findOneAndUpdate(
      { requestId: result.requestId },
      {
        requestId: result.requestId,
        organizationName: result.organizationName,
        data: result.data,
        metadata: result.metadata,
      },
      { upsert: true, new: true },
    );
  }

  async findByRequestId(requestId: string): Promise<CrawlerResult | null> {
    const doc = await CrawlerResultModel.findOne({ requestId }).lean();
    if (!doc) return null;
    return {
      requestId: doc.requestId,
      organizationName: doc.organizationName,
      data: doc.data as CrawlerResult["data"],
      metadata: doc.metadata as CrawlerResult["metadata"],
    };
  }

  async deleteByRequestId(requestId: string): Promise<void> {
    await CrawlerResultModel.deleteOne({ requestId });
  }
}
