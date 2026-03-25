/** Padrão de login de usuário/organização no GitHub (até 39 caracteres). */
export const GHORG_LOGIN_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/;

/**
 * Extrai o login a partir de:
 * - `facebook`, `@facebook`
 * - `https://github.com/facebook`, `http://github.com/facebook/`, `github.com/facebook`
 * - `facebook/explore` → `facebook`
 */
export function extractGithubOrgLogin(raw: string): string {
  let s = raw.trim();
  if (!s) return s;
  if (s.startsWith("@")) s = s.slice(1).trim();

  const fromUrl = s.match(
    /(?:https?:\/\/)?(?:www\.)?github\.com\/([^/?#]+)/i,
  );
  if (fromUrl) {
    s = fromUrl[1];
  } else {
    const slash = s.indexOf("/");
    if (slash > 0) s = s.slice(0, slash);
  }

  return s.trim().toLowerCase();
}

export function normalizeGithubOrgInput(raw: string): string {
  const login = extractGithubOrgLogin(raw);
  if (!GHORG_LOGIN_PATTERN.test(login)) {
    throw new Error(
      "Nome de organização inválido. Use o login (ex.: facebook) ou a URL https://github.com/facebook",
    );
  }
  return login;
}
