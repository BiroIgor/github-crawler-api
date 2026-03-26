import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  MONGODB_URI: z.string().min(1),
  RABBITMQ_URL: z.string().min(1),
  /** URLs HTTP(S) de proxy separadas por vírgula (opcional). Ex.: http://user:pass@host:8080 */
  GHORG_PROXY_URLS: z.string().optional(),
  /** Opcional: token GitHub (PAT) para maior limite ao contar membros públicos via API. */
  GHORG_GITHUB_TOKEN: z.string().optional(),
});

export type Env = z.infer<typeof schema> & {
  ghorgProxyUrlList: string[];
};

let cached: Env | null = null;

function parseProxyList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function loadEnv(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error("Variáveis de ambiente inválidas (.env)");
  }
  cached = {
    ...parsed.data,
    ghorgProxyUrlList: parseProxyList(parsed.data.GHORG_PROXY_URLS),
  };
  return cached;
}
