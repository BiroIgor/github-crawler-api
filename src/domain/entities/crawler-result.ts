export interface OrganizationData {
  name: string;
  login: string;
  description: string | null;
  website: string | null;
  location: string | null;
  email: string | null;
  avatarUrl: string | null;
  stats: {
    repositories: number | null;
    people: number | null;
  };
  pinnedRepos: Array<{
    name: string;
    description: string | null;
    stars: number;
    forks: number;
    language: string | null;
  }>;
}

export interface CrawlMetadata {
  sourceUrl: string;
  responseTimeMs: number;
  proxyUsed: string | null;
  fetchedAt: string;
  /**
   * Se definido, `stats.people` foi obtido pela API REST de membros **públicos**
   * (o HTML do GitHub não expõe mais o contador no SSR).
   */
  peopleCountSource?: "github_public_members_api" | "github_people_page_scrape";
  /**
   * Se definido, `stats.repositories` veio de `public_repos` em `GET /orgs/{org}`
   * (repositórios **públicos**).
   */
  repositoriesCountSource?: "github_org_rest_api";
}

export interface CrawlerResult {
  requestId: string;
  organizationName: string;
  data: OrganizationData;
  metadata: CrawlMetadata;
}
