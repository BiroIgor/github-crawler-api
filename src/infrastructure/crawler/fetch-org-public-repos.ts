import { buildGithubApiHeaders } from "./github-api-headers.js";
import { githubApiFetch } from "./github-api-fetch.js";

/**
 * `public_repos` em `GET /orgs/{org}` — repositórios **públicos** da organização.
 */
export async function fetchOrgPublicReposCount(
  orgLogin: string,
  token?: string,
): Promise<number | null> {
  const res = await githubApiFetch(
    `https://api.github.com/orgs/${encodeURIComponent(orgLogin)}`,
    buildGithubApiHeaders(token),
  );
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const j = (await res.json()) as { public_repos?: unknown };
  return typeof j.public_repos === "number" ? j.public_repos : null;
}
