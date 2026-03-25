function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * `fetch` com retentativas só para **429** (throttling / secondary rate limit).
 * **403** com cota esgotada não resolve em segundos — retentar só atrasa o worker;
 * use `GHORG_GITHUB_TOKEN` ou espere o reset da janela.
 */
export async function githubApiFetch(
  url: string,
  headers: Record<string, string>,
): Promise<Response> {
  let backoffMs = 2000;
  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(url, { headers });
    if (res.status !== 429) return res;
    if (attempt === maxAttempts) return res;

    const ra = res.headers.get("retry-after");
    let waitMs = backoffMs;
    if (ra) {
      const sec = Number.parseInt(ra, 10);
      if (Number.isFinite(sec)) waitMs = sec * 1000;
    }
    waitMs = Math.min(Math.max(waitMs, 1000), 120_000);
    await sleep(waitMs);
    backoffMs = Math.min(backoffMs * 2, 60_000);
  }

  return fetch(url, { headers });
}
