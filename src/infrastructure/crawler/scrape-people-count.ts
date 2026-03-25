import type { CheerioAPI } from "cheerio";

/**
 * Conta membros únicos e descobre a última página de paginação
 * na página `/orgs/{login}/people`.
 */
export function parsePeoplePage($: CheerioAPI, orgLogin: string) {
  const unique = new Set<string>();
  $('a[data-hovercard-url*="/users/"]').each((_, el) => {
    const href = $(el).attr("data-hovercard-url") ?? "";
    const m = href.match(/\/users\/([^/]+)\//);
    if (m?.[1]) unique.add(m[1]);
  });

  const loginLower = orgLogin.toLowerCase();
  let maxPage = 0;
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const re = new RegExp(
      `/orgs/${loginLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/people\\?page=(\\d+)`,
      "i",
    );
    const pm = href.match(re);
    if (pm) {
      const n = Number.parseInt(pm[1], 10);
      if (n > maxPage) maxPage = n;
    }
  });

  return { usersOnPage: unique.size, maxPage: maxPage || 1 };
}

/**
 * Calcula total a partir da primeira e da última página.
 */
export function computeTotalMembers(
  firstPage: { usersOnPage: number; maxPage: number },
  lastPage: { usersOnPage: number } | null,
): number {
  if (firstPage.maxPage <= 1) return firstPage.usersOnPage;
  if (!lastPage) return firstPage.usersOnPage * firstPage.maxPage;
  return (firstPage.maxPage - 1) * firstPage.usersOnPage + lastPage.usersOnPage;
}
