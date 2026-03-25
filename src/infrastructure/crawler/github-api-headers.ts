export const GITHUB_API_UA =
  "ghorg-github-organization-api/0.1 (organization profile scrape; Codilo test)";

export function buildGithubApiHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": GITHUB_API_UA,
  };
  const t = token?.trim();
  if (t) headers.Authorization = `Bearer ${t}`;
  return headers;
}
