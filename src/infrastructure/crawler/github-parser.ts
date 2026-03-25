import type { CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
import type { OrganizationData } from "../../domain/entities/crawler-result.js";

/** Título genérico da UI de busca do GitHub (não é nome da org). */
const GITHUB_SEARCH_UI_TITLE =
  /search code,\s*repositories,\s*users,\s*issues,\s*pull requests/i;

function parseCounter(text: string): number | null {
  const t = text.replace(/,/g, "").trim();
  if (!t) return null;
  const n = Number.parseInt(t.replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

/** Extrai números de textos tipo og:description ("has 231 repositories", "1.2k members"). */
function parseStatsFromMetaText(text: string | null | undefined): {
  repositories: number | null;
  people: number | null;
} {
  let repositories: number | null = null;
  let people: number | null = null;
  if (!text?.trim()) return { repositories, people };

  const repoMatch = text.match(
    /(?:has|,|\s)\s*([\d.,]+[kKmM]?)\s+repositories?\b/i,
  );
  if (repoMatch) {
    repositories = parseKStyleNumber(repoMatch[1]);
  } else {
    const repoAlt = text.match(/\b([\d.,]+[kKmM]?)\s+repositories?\b/i);
    if (repoAlt) repositories = parseKStyleNumber(repoAlt[1]);
  }

  const peopleMatch = text.match(
    /\b([\d.,]+[kKmM]?)\s+(?:members?|people|contributors?)\b/i,
  );
  if (peopleMatch) {
    people = parseKStyleNumber(peopleMatch[1]);
  }

  return { repositories, people };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Perfil de **organização** expõe link para `/orgs/{login}/people`; usuário não. */
export function isGithubOrganizationProfile(
  $: CheerioAPI,
  login: string,
): boolean {
  const le = escapeRegExp(login.toLowerCase());
  const re = new RegExp(`/orgs/${le}/people/?$`, "i");
  let found = false;
  $("a[href]").each((_, el) => {
    if (found) return;
    let path = ($(el).attr("href") ?? "").split("?")[0];
    try {
      if (/^https?:\/\//i.test(path)) path = new URL(path).pathname;
    } catch {
      /* manter path */
    }
    if (re.test(path)) found = true;
  });
  return found;
}

/** Contador em aba UnderlineNav: costuma estar no <li>, não dentro do <a>. */
function parseCounterInNavItem($: CheerioAPI, el: AnyNode): number | null {
  const $el = $(el);
  const $item = $el.closest(
    "li, [role='presentation'], .UnderlineNav-item, .header-nav-item, nav li, [data-testid*='UnderlineNav']",
  );
  const inItem = parseCounter(
    $item.find('span.Counter, span[class*="Counter"]').first().text(),
  );
  if (inItem !== null) return inItem;
  const inAnchor = parseCounter(
    $el.find('span.Counter, span[class*="Counter"]').first().text(),
  );
  if (inAnchor !== null) return inAnchor;
  return parseCounter($el.text().trim());
}

/** Contagem em abas/links do tipo /orgs/{login}/people (layout React do GitHub). */
function extractOrgPeopleFromPeopleTab(
  $: CheerioAPI,
  login: string,
): number | null {
  const le = escapeRegExp(login.toLowerCase());
  const pathRe = new RegExp(`/orgs/${le}/people/?$`, "i");

  const tryFromAnchor = (el: AnyNode) => {
    const $el = $(el);
    const aria = ($el.attr("aria-label") ?? $el.attr("title") ?? "").trim();
    const ariaM = aria.match(/\b([\d.,]+[kKmM]?)\s+members?\b/i);
    if (ariaM) {
      const n = parseKStyleNumber(ariaM[1]);
      if (n !== null) return n;
    }
    return parseCounterInNavItem($, el);
  };

  let out: number | null = null;
  $("a[href]").each((_, el) => {
    if (out !== null) return;
    const raw = $(el).attr("href") ?? "";
    let path = raw.split("?")[0];
    try {
      if (/^https?:\/\//i.test(path)) path = new URL(path).pathname;
    } catch {
      /* manter path */
    }
    if (!pathRe.test(path)) return;
    const n = tryFromAnchor(el);
    if (n !== null) out = n;
  });

  return out;
}

function parseKStyleNumber(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/,/g, "");
  if (!s) return null;
  if (s.endsWith("k")) {
    const n = Number.parseFloat(s.slice(0, -1));
    return Number.isFinite(n) ? Math.round(n * 1000) : null;
  }
  if (s.endsWith("m")) {
    const n = Number.parseFloat(s.slice(0, -1));
    return Number.isFinite(n) ? Math.round(n * 1_000_000) : null;
  }
  const n = Number.parseInt(s.replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

/** Contadores da barra de abas (Repositories / People) no layout atual do GitHub. */
function extractStatsFromNav(
  $: CheerioAPI,
  login: string,
): { repositories: number | null; people: number | null } {
  let repositories: number | null = null;
  let people: number | null = null;
  const loginLower = login.toLowerCase();

  $("a[href]").each((_, el) => {
    const hrefFull = $(el).attr("href") ?? "";
    const path = hrefFull.split("?")[0];
    const hLower = path.toLowerCase();

    const isRepositoriesNav =
      hrefFull.includes("tab=repositories") ||
      /\/orgs\/[^/]+\/repositories\/?$/i.test(path) ||
      hLower === `/${loginLower}/repositories`;

    if (isRepositoriesNav && repositories === null) {
      repositories = parseCounterInNavItem($, el);
    }

    const isPeopleNav =
      /\/orgs\/[^/]+\/people\/?$/i.test(path) ||
      hLower === `/${loginLower}/people` ||
      (path.includes("/people") &&
        (path.includes("/orgs/") || hLower.endsWith(`/${loginLower}/people`)));

    if (isPeopleNav && people === null) {
      people = parseCounterInNavItem($, el);
    }
  });

  return { repositories, people };
}

function extractLoginFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[0] ?? "";
  } catch {
    return "";
  }
}

function isGarbageTitle(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 160) return true;
  return GITHUB_SEARCH_UI_TITLE.test(t);
}

/** Bio da org não deve ser texto de card de repo (ex.: fork). */
const FORK_OR_REPO_LINE_JUNK = /forked\s+from\b/i;

function isGarbageOrgDescription(text: string | null | undefined): boolean {
  if (!text?.trim()) return true;
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length > 600) return true;
  return FORK_OR_REPO_LINE_JUNK.test(t);
}

function pickOrganizationDescription($: CheerioAPI): string | null {
  const narrowSelectors = [
    ".user-profile-bio",
    ".p-note",
    "[data-bio-text]",
    ".org-header-wrapper .color-fg-muted",
    ".orghead .color-fg-muted",
    ".Layout-sidebar .p-note",
    ".h-card .p-note",
  ];

  for (const sel of narrowSelectors) {
    const t = $(sel).first().text().trim();
    if (t && !isGarbageOrgDescription(t)) return t;
  }

  let fromMuted: string | null = null;
  $(".color-fg-muted.mb-1").each((_, el) => {
    if (fromMuted) return;
    const $el = $(el);
    if (
      $el.closest(
        ".pinned-item-list-item, li[data-repository-id], .js-pinned-items-reorder-list, .js-pinned-items-reorder-container",
      ).length > 0
    ) {
      return;
    }
    const t = $el.text().trim();
    if (t && !isGarbageOrgDescription(t)) fromMuted = t;
  });

  return fromMuted;
}

/** Nome exibido: og:title ("Node.js · GitHub") ou h1 do perfil, nunca o h1 global de busca. */
function pickOrganizationDisplayName($: CheerioAPI, login: string): string {
  const ogRaw = $('meta[property="og:title"]').attr("content")?.trim();
  if (ogRaw) {
    let t = ogRaw.replace(/\s*·\s*GitHub\s*$/i, "").trim();
    t = t.replace(/\s+-\s+Overview\s*$/i, "").trim();
    if (t && !isGarbageTitle(t)) {
      return t;
    }
  }

  const nameSelectors = [
    "main h1.p-name",
    ".ApplicationRow-main h1.p-name",
    ".org-header-wrapper h1.p-name",
    ".org-header-wrapper h1",
    ".vcard-names .p-name",
    "h1.p-name",
    'h1[class*="Profile"]',
  ];

  for (const sel of nameSelectors) {
    const t = $(sel).first().text().trim();
    if (t && !isGarbageTitle(t)) return t;
  }

  const mainH1 = $("main h1").first().text().trim();
  if (mainH1 && !isGarbageTitle(mainH1)) return mainH1;

  return login;
}

export function parseGithubOrganizationPage(
  $: CheerioAPI,
  sourceUrl: string,
  _responseTimeMs: number,
  _proxyUsed: string | null,
): OrganizationData {
  const login =
    $('meta[property="og:url"]').attr("content")?.split("/").filter(Boolean)
      .pop() ||
    extractLoginFromUrl(sourceUrl) ||
    $("h1.p-nickname, .p-nickname").first().text().replace("@", "").trim() ||
    "";

  const name = pickOrganizationDisplayName($, login);

  const ogDescMeta =
    $('meta[property="og:description"]').attr("content")?.trim() ?? null;

  let description = pickOrganizationDescription($);

  if (
    (!description || isGarbageOrgDescription(description)) &&
    ogDescMeta &&
    !isGarbageTitle(ogDescMeta) &&
    !isGarbageOrgDescription(ogDescMeta)
  ) {
    description = ogDescMeta;
  } else if (isGarbageOrgDescription(description)) {
    description = null;
  }

  const ogDescription = ogDescMeta;

  const website =
    $('a[rel="nofollow me"], a[itemprop="url"], .vcard-detail a[href^="http"]')
      .first()
      .attr("href") || null;

  const location =
    $('[itemprop="homeLocation"], span.p-label, li[itemprop="address"]')
      .first()
      .text()
      .trim() || null;

  const email =
    $('a[href^="mailto:"], li[itemprop="email"] a')
      .first()
      .attr("href")
      ?.replace(/^mailto:/i, "") || null;

  const avatarUrl =
    $('img.avatar, img[itemprop="image"], .avatar-user').first().attr("src") ||
    $('meta[property="og:image"]').attr("content") ||
    null;

  const fromNav = extractStatsFromNav($, login);
  const fromMeta = parseStatsFromMetaText(ogDescription ?? description);

  let repositories = fromNav.repositories ?? fromMeta.repositories;
  let people =
    fromNav.people ??
    fromMeta.people ??
    extractOrgPeopleFromPeopleTab($, login);

  if (repositories === null || people === null) {
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") ?? "";
      const t = $(el).text();
      if (repositories === null && href.includes("tab=repositories")) {
        const n =
          parseCounter(
            $(el).find('span.Counter, span[class*="Counter"]').first().text(),
          ) ?? parseCounter(t);
        if (n !== null) repositories = n;
      }
      if (people === null && /\/orgs\/[^/]+\/people\/?(\?|$)/i.test(href)) {
        const n =
          parseCounter(
            $(el).find('span.Counter, span[class*="Counter"]').first().text(),
          ) ?? parseCounter(t);
        if (n !== null) people = n;
      }
    });
  }

  const pinnedRepos: OrganizationData["pinnedRepos"] = [];

  $(".pinned-item-list-item, li[data-repository-id]").each((_, el) => {
    const item = $(el);
    const link = item.find('a[href^="/"]').filter((__, a) => {
      const h = $(a).attr("href") ?? "";
      return /^\/[^/]+\/[^/]+\/?$/.test(h) && !h.includes("tab=");
    });
    const href = link.first().attr("href") ?? "";
    const nameFromHref = href.split("/").filter(Boolean).slice(-1)[0] ?? "";
    if (!nameFromHref) return;

    const desc =
      item.find(".pinned-item-desc, .repo-description").text().trim() || null;
    const metaText = item.text();

    const starsMatch = metaText.match(/([\d.,kK]+)\s*stars?/i);
    const forksMatch = metaText.match(/([\d.,kK]+)\s*forks?/i);

    const parseK = (s: string | undefined) => {
      if (!s) return 0;
      const x = s.trim().toLowerCase().replace(/,/g, "");
      if (x.endsWith("k"))
        return Math.round(Number.parseFloat(x.slice(0, -1)) * 1000);
      return Number.parseInt(x.replace(/\D/g, ""), 10) || 0;
    };

    let stars = parseK(starsMatch?.[1]);
    let forks = parseK(forksMatch?.[1]);

    const starLink = item.find(`a[href$="/stargazers"]`).first();
    if (starLink.length) {
      const n = parseCounter(starLink.text());
      if (n !== null) stars = n;
    }
    const forkLink = item.find(`a[href$="/forks"]`).first();
    if (forkLink.length) {
      const n = parseCounter(forkLink.text());
      if (n !== null) forks = n;
    }

    const lang =
      item.find("[itemprop='programmingLanguage']").text().trim() || null;

    pinnedRepos.push({
      name: nameFromHref,
      description: desc,
      stars,
      forks,
      language: lang,
    });
  });

  return {
    name: name || login,
    login: login || name,
    description,
    website,
    location,
    email,
    avatarUrl,
    stats: { repositories, people },
    pinnedRepos,
  };
}
