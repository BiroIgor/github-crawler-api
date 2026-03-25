import { buildGithubApiHeaders } from "./github-api-headers.js";
import { githubApiFetch } from "./github-api-fetch.js";

function parseLinkRel(link: string | null, rel: string): string | null {
  if (!link) return null;
  for (const part of link.split(",")) {
    const m = part.trim().match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (m?.[2] === rel) return m[1].trim();
  }
  return null;
}

function queryInt(url: string, key: string, fallback: number): number {
  try {
    const v = new URL(url).searchParams.get(key);
    if (v == null) return fallback;
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Total de membros **públicos** da organização (API REST).
 * Usa `Link: rel="last"` para buscar só 1ª + última página (2 req), evitando
 * centenas de chamadas em orgs grandes (ex.: microsoft) e rate limit.
 */
export async function fetchPublicMembersCount(
  orgLogin: string,
  token?: string,
): Promise<number | null> {
  const headers = buildGithubApiHeaders(token);
  const firstUrl =
    `https://api.github.com/orgs/${encodeURIComponent(orgLogin)}/public_members?per_page=100`;

  const first = await githubApiFetch(firstUrl, headers);
  if (first.status === 404) return null;
  if (!first.ok) return null;
  const firstBody = (await first.json()) as unknown;
  if (!Array.isArray(firstBody)) return null;

  const lastUrl = parseLinkRel(first.headers.get("link"), "last");
  if (!lastUrl) {
    return firstBody.length;
  }

  const perPage = queryInt(firstUrl, "per_page", 100);
  const lastPageNum = queryInt(lastUrl, "page", 1);

  if (lastPageNum <= 1) {
    return firstBody.length;
  }

  const lastRes = await githubApiFetch(lastUrl, headers);
  if (lastRes.status === 404) return null;
  if (!lastRes.ok) return null;
  const lastBody = (await lastRes.json()) as unknown;
  if (!Array.isArray(lastBody)) return null;

  return (lastPageNum - 1) * perPage + lastBody.length;
}
