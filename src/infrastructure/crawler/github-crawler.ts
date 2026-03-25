import { CheerioCrawler, Configuration, ProxyConfiguration } from "crawlee";
import type { CheerioAPI } from "cheerio";
import type {
  CrawlMetadata,
  OrganizationData,
} from "../../domain/entities/crawler-result.js";
import type { GithubCrawlerPort } from "../../application/ports/github-crawler.port.js";
import {
  isGithubOrganizationProfile,
  parseGithubOrganizationPage,
} from "./github-parser.js";
import {
  parsePeoplePage,
  computeTotalMembers,
} from "./scrape-people-count.js";
import { fetchOrgPublicReposCount } from "./fetch-org-public-repos.js";
import { normalizeGithubOrgInput } from "../../shared/github-org-login.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export type CrawleeGithubCrawlerOptions = {
  proxyUrls?: string[];
  githubToken?: string;
};

export class CrawleeGithubCrawler implements GithubCrawlerPort {
  constructor(private readonly options: CrawleeGithubCrawlerOptions = {}) {}

  async crawl(organizationName: string) {
    const slug = normalizeGithubOrgInput(organizationName);
    const orgUrl = `https://github.com/${encodeURIComponent(slug)}`;
    const peopleUrl = `https://github.com/orgs/${encodeURIComponent(slug)}/people`;
    const started = Date.now();

    const proxyUrls = this.options.proxyUrls ?? [];
    const proxyConfiguration =
      proxyUrls.length > 0
        ? new ProxyConfiguration({ proxyUrls })
        : undefined;

    let orgParsed = false;
    let data!: OrganizationData;
    let proxyUsedLabel: string | null = null;
    let lastFailure: string | null = null;

    let firstPeoplePage: ReturnType<typeof parsePeoplePage> | null = null;
    let lastPeoplePage: { usersOnPage: number } | null = null;

    const crawlerConfig = new Configuration({ persistStorage: false });

    const crawler = new CheerioCrawler(
      {
        maxRequestsPerCrawl: 3,
        maxConcurrency: 1,
        maxRequestRetries: 2,
        requestHandlerTimeoutSecs: 30,
        proxyConfiguration,
        preNavigationHooks: [
          (_ctx, gotOptions) => {
            gotOptions.headers = {
              ...gotOptions.headers,
              "user-agent": UA,
              accept:
                "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
            };
          },
        ],
        async requestHandler({ $, request, log }) {
          const title = $("title").text();
          const reqUrl = request.url;

          if (reqUrl.includes("/people")) {
            const pageParam = new URL(reqUrl).searchParams.get("page");
            const info = parsePeoplePage($ as unknown as CheerioAPI, slug);
            if (!pageParam || pageParam === "1") {
              firstPeoplePage = info;
              if (info.maxPage > 1) {
                await crawler.addRequests([
                  `${peopleUrl}?page=${info.maxPage}`,
                ]);
              }
            } else {
              lastPeoplePage = { usersOnPage: info.usersOnPage };
            }
            return;
          }

          if (title.includes("Page not found") || title.includes("404")) {
            log.info(
              `GitHub retornou página não encontrada para ${reqUrl}`,
            );
            throw new Error("Organização não encontrada no GitHub");
          }
          if (proxyUrls.length > 0) {
            proxyUsedLabel = `${proxyUrls.length} proxy(s) ghorg`;
          }
          const $c = $ as unknown as CheerioAPI;
          data = parseGithubOrganizationPage(
            $c,
            reqUrl,
            Date.now() - started,
            proxyUsedLabel,
          );
          orgParsed = true;
          if (
            data.stats.people === null &&
            isGithubOrganizationProfile($c, slug)
          ) {
            await crawler.addRequests([peopleUrl]);
          }
        },
        failedRequestHandler({ request }, error) {
          if (request.url.includes("/people")) return;
          const err = error as Error & { statusCode?: number };
          const parts = [
            err.statusCode != null ? `HTTP ${err.statusCode}` : null,
            err.message,
            request.url,
          ].filter(Boolean);
          lastFailure = parts.join(" — ");
        },
      },
      crawlerConfig,
    );

    await crawler.run([orgUrl]);

    if (!orgParsed) {
      throw new Error(
        lastFailure ??
          "Não foi possível obter a página da organização (rate limit, bloqueio ou resposta inesperada)",
      );
    }

    let peopleCountSource: CrawlMetadata["peopleCountSource"];
    let repositoriesCountSource: CrawlMetadata["repositoriesCountSource"];

    if (data.stats.people === null && firstPeoplePage) {
      const total = computeTotalMembers(firstPeoplePage, lastPeoplePage);
      if (total > 0) {
        data.stats.people = total;
        peopleCountSource = "github_people_page_scrape" as CrawlMetadata["peopleCountSource"];
      }
    }

    if (data.stats.repositories === null) {
      const n = await fetchOrgPublicReposCount(
        slug,
        this.options.githubToken,
      );
      if (n !== null) {
        data.stats.repositories = n;
        repositoriesCountSource = "github_org_rest_api";
      }
    }

    return {
      data,
      metadata: {
        sourceUrl: orgUrl,
        responseTimeMs: Date.now() - started,
        proxyUsed: proxyUsedLabel,
        ...(repositoriesCountSource ? { repositoriesCountSource } : {}),
        ...(peopleCountSource ? { peopleCountSource } : {}),
      },
    };
  }
}
