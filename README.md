# GHOrg — API + Crawler de organizações GitHub

Teste técnico: API **Node.js/Express** que recebe o nome de uma organização no GitHub, enfileira o scraping via **RabbitMQ**, extrai dados da página pública com **Crawlee/Cheerio**, persiste requisições no **PostgreSQL** e snapshots parseados no **MongoDB**.

## Arquitetura

```
Cliente (UI / curl)
  │
  ▼
API Express ──────► PostgreSQL  (requisições + status)
  │
  ▼
RabbitMQ ─────────► Worker / Crawler
                        │
                        ├──► GitHub (HTML) ──► Cheerio parser
                        │
                        ├──► MongoDB (snapshot parseado)
                        │
                        └──► PostgreSQL (status → completed / failed)
```

### DDD (4 camadas)

| Camada | Responsabilidade | Exemplos |
|--------|-----------------|----------|
| **Domain** | Entidades e interfaces (zero deps externas) | `Request`, `CrawlerResult`, `RequestRepository`, `QueuePublisher` |
| **Application** | Use cases e serviços de orquestração | `CreateRequestUseCase`, `CrawlOrganizationService` |
| **Infrastructure** | Implementações concretas | `PgRequestRepository`, `MongoCrawlerResultRepository`, `CrawleeGithubCrawler`, `RabbitMqPublisher` |
| **Presentation** | HTTP (Express), rotas, middlewares | `RequestsController`, `HealthController`, validação Zod |

Dependency Injection manual via `container.ts`: use cases recebem **interfaces**, não implementações.

## Stack

- **Runtime:** Node.js 20+ / TypeScript (ES2022, NodeNext)
- **API:** Express + Helmet (CSP, headers) + CORS + express-rate-limit
- **Crawler:** Crawlee `CheerioCrawler` + Cheerio (HTTP puro, sem browser)
- **Banco relacional:** PostgreSQL 15 — tabela `ghorg_scrape_requests`
- **Banco não-relacional:** MongoDB 6 — collection `ghorg_organization_profiles`
- **Fila:** RabbitMQ 3 (`amqplib`) — queue `ghorg_scrape_jobs` + DLX/DLQ
- **Validação:** Zod (body, query params, env)
- **Logging:** pino (JSON estruturado, pino-pretty em dev)
- **Linter/Formatter:** ESLint 9 (flat config) + Prettier + typescript-eslint

## Pré-requisitos

- **Node.js 20+**
- **Docker Desktop** (Postgres, Mongo, RabbitMQ via `docker-compose.yml`)

## Como rodar

### 1. Infra (Docker)

```bash
cd github-crawler
docker compose up -d
```

Aguarde os healthchecks ficarem saudáveis (~15 s).

### 2. Configuração

```bash
cp .env.example .env
npm install
```

### 3. Executar (desenvolvimento)

São **dois processos** separados — abra dois terminais:

```bash
# Terminal 1 — API + UI estática (porta 3000)
npm run dev

# Terminal 2 — Worker (consumer da fila)
npm run dev:worker
```

- **UI:** http://localhost:3000
- **Health:** `GET http://localhost:3000/health`

### 4. Build de produção

```bash
npm run build
npm start            # API
npm run start:worker # Worker
```

### 5. API + worker em containers (Docker Compose)

Com o `.env` na raiz do projeto, o `docker-compose.yml` sobe **Postgres, Mongo, RabbitMQ** e os serviços **`api`** e **`worker`** (imagem multi-stage do `Dockerfile`). As variáveis `DATABASE_URL`, `MONGODB_URI` e `RABBITMQ_URL` são definidas no compose com hostnames `postgres`, `mongo` e `rabbitmq` (adequado dentro da rede Docker).

```bash
docker compose up -d --build
```

- **UI:** http://localhost:3000  

Para subir **apenas** bancos e fila (Node local com `npm run dev` / `dev:worker`):

```bash
docker compose up -d postgres mongo rabbitmq
```

## Qualidade de código

```bash
npm run lint      # ESLint + Prettier (regras em eslint.config.js)
npm run lint:fix
npm run format    # Prettier em src/**/*.ts
```

## Endpoints da API

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/requests` | Cria requisição de scrape. Body: `{ "organizationName": "nodejs" }`. Aceita login ou URL (`https://github.com/nodejs`). Retorna `{ "requestId": "uuid" }`. **409** se já existir pedido `pending` ou `processing` para a mesma organização. |
| `GET` | `/api/requests` | Lista requisições. Query: `?limit=15&offset=0`. Retorna `{ items, total, limit, offset }`. |
| `GET` | `/api/requests/:id` | Detalhe de uma requisição + resultado do crawler (se concluído). |
| `DELETE` | `/api/requests/:id` | Remove requisição do PostgreSQL e snapshot do MongoDB. |
| `GET` | `/health` | Status da API, PostgreSQL e RabbitMQ. |

## Fluxo completo

1. **`POST /api/requests`** — valida o nome, salva no PostgreSQL com status `pending`, publica job na fila RabbitMQ, retorna o `requestId`.
2. **Worker** consome da fila `ghorg_scrape_jobs`:
   - Atualiza status para `processing`.
   - Crawlee faz HTTP GET em `https://github.com/{org}` (sem browser).
   - Cheerio parseia: nome, descrição, site, localização, e-mail, avatar, repositórios fixados (nome, descrição, stars, forks, linguagem).
   - Se a organização tiver aba "People", faz scraping da página de membros (1ª + última página) para contar total.
   - Se `stats.repositories` ficou nulo no HTML, consulta `GET /orgs/{org}` na API REST pública do GitHub.
   - Salva snapshot no MongoDB, atualiza status para `completed`.
   - Em caso de erro: status `failed` com mensagem; mensagem vai para DLQ após esgotamento de retries.
3. **`GET /api/requests/:id`** — retorna a requisição + snapshot do MongoDB (se houver).

## Dados extraídos (JSON)

```json
{
  "name": "Node.js",
  "login": "nodejs",
  "description": "...",
  "website": "https://nodejs.org",
  "location": null,
  "email": null,
  "avatarUrl": "https://avatars.githubusercontent.com/...",
  "stats": {
    "repositories": 231,
    "people": 203
  },
  "pinnedRepos": [
    {
      "name": "node",
      "description": "Node.js JavaScript runtime",
      "stars": 116,
      "forks": 352,
      "language": "JavaScript"
    }
  ]
}
```

## Decisões técnicas

### Crawlee em vez de Puppeteer/Selenium
O enunciado pede scraping **via requests HTTP** (sem WebDriver). O Crawlee com `CheerioCrawler` faz exatamente isso: HTTP + Cheerio, com retry automático, proxy rotation e controle de concorrência — sem iniciar navegador.

### Acesso direto à URL da organização
O fluxo descrito no teste menciona "inserir no campo de busca". Na prática, o campo de busca do GitHub é JavaScript-rendered e exigiria browser. Acessar `https://github.com/{org}` diretamente produz o mesmo resultado (a página da organização) e é compatível com scraping HTTP puro.

### Contagem de membros (people)
O GitHub **não expõe o contador** de membros no HTML server-side (o `<span>` vem vazio). A solução foi fazer scraping da página `/orgs/{login}/people`, que lista 30 membros por página com paginação. O crawler busca a **1ª e a última página** (2 requests) e calcula o total: `(última − 1) × 30 + users_da_última`. Sem API REST, sem token.

### Contagem de repositórios (fallback)
Quando o HTML do perfil não traz o número, o código consulta `GET /orgs/{org}` na API pública do GitHub (campo `public_repos`). Isso é uma única chamada e funciona sem token dentro do rate limit anônimo.

### PostgreSQL para requisições, MongoDB para snapshots
- **PostgreSQL:** dados estruturados com status, timestamps, índices — ideal para listar e filtrar requisições.
- **MongoDB:** documento flexível, sem schema rígido — cada snapshot de organização pode ter campos variáveis.

### RabbitMQ + DLQ
- Jobs persistentes (`durable: true`, `persistent: true`).
- Dead Letter Exchange (`ghorg_scrape_dlx`) + Dead Letter Queue (`ghorg_scrape_jobs_dlq`): mensagens que falham vão para a DLQ para inspeção/reprocessamento.
- Worker com `prefetch(1)`: processa um job por vez.

### Prevenção de duplicatas
O `POST /api/requests` verifica se já existe pedido `pending` ou `processing` para a mesma organização antes de criar. Se existir, retorna **409 Conflict** com mensagem amigável (`ConflictError`).

### Segurança
- **Helmet** com CSP customizada (permite avatars do GitHub).
- **CORS** habilitado.
- **Rate limit:** 120 req/min.
- **Validação Zod** no body, query params e variáveis de ambiente.

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `DATABASE_URL` | Sim | Connection string PostgreSQL |
| `MONGODB_URI` | Sim | Connection string MongoDB |
| `RABBITMQ_URL` | Sim | Connection string AMQP |
| `PORT` | Não | Porta da API (default: 3000) |
| `GHORG_PROXY_URLS` | Não | Proxies HTTP(S) separados por vírgula |
| `GHORG_GITHUB_TOKEN` | Não | PAT GitHub para maior rate limit na API REST |

## Estrutura de pastas

```
github-crawler/
├── Dockerfile                 # Multi-stage build (TS → prod)
├── .dockerignore
├── docker-compose.yml         # Postgres, Mongo, RabbitMQ, api, worker
├── eslint.config.js           # ESLint 9 flat config
├── .prettierrc
├── .env.example
├── package.json
├── tsconfig.json
├── public/                    # UI estática (HTML/CSS/JS)
├── scripts/                   # Utilitários (smoke-test, clear-data)
└── src/
    ├── domain/
    │   ├── entities/          # Request, CrawlerResult
    │   ├── repositories/      # Interfaces: RequestRepository, CrawlerResultRepository
    │   └── services/          # Interface: QueuePublisher
    ├── application/
    │   ├── use-cases/         # CreateRequest, GetRequestById, ListRequests, DeleteRequest
    │   ├── services/          # CrawlOrganizationService
    │   └── ports/             # GithubCrawlerPort
    ├── infrastructure/
    │   ├── database/
    │   │   ├── postgres/      # PgRequestRepository, migrations, connection
    │   │   └── mongo/         # MongoCrawlerResultRepository, schemas, connection
    │   ├── queue/             # RabbitMQ connection, publisher, topology
    │   └── crawler/           # CrawleeGithubCrawler, github-parser, scrape-people-count
    ├── presentation/
    │   ├── routes/            # requests.routes, health.routes
    │   ├── controllers/       # RequestsController, HealthController
    │   └── middlewares/       # error-handler, validation (Zod)
    ├── config/env.ts          # Variáveis validadas com Zod
    ├── shared/                # Logger (pino), erros customizados, github-org-login
    ├── container.ts           # Composição / DI manual
    ├── index.ts               # Bootstrap da API
    └── worker.ts              # Bootstrap do Worker
```
