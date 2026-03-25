import type {
  CrawlMetadata,
  OrganizationData,
} from "../../domain/entities/crawler-result.js";

export interface GithubCrawlResult {
  data: OrganizationData;
  metadata: Pick<
    CrawlMetadata,
    "sourceUrl" | "responseTimeMs" | "proxyUsed" | "peopleCountSource"
  >;
}

export interface GithubCrawlerPort {
  crawl(organizationName: string): Promise<GithubCrawlResult>;
}
