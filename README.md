# MNNR AI Blogs

Role-based blogging platform — Next.js 14 + AWS Amplify Gen 2 (Cognito, AppSync/DynamoDB, S3).

## Local development

1. Install deps: `npm install`
2. Start the Amplify sandbox (writes `amplify_outputs.json`):
   ```bash
   SEED_ADMIN_EMAILS="you@example.com" npx ampx sandbox
   ```
3. In another terminal: `npm run dev` → http://localhost:3000
4. Register with a seed email to get auto-promoted to SystemAdmin.

## Tests

```bash
npm test
```

## Roles

Reader → ContentWriter → ContentAdmin → SystemAdmin (Cognito groups). SystemAdmins
assign roles at `/admin`. Content is never hard-deleted — deletes set `status=DELETED`.

## Phase 2 — access & admin

- Users request elevated roles at `/account` (ContentWriter / ContentAdmin).
- System admins manage everything under `/admin`:
  - `/admin/requests` — approve/reject access requests.
  - `/admin/users` — change any user's role.
  - `/admin/moderation` — view and restore soft-deleted posts/comments
    (posts restore to draft, comments to active).
- Roles map to Cognito groups (the authority); `UserProfile` mirrors them for the
  admin user list and is upserted on sign-in.

## Deploy (later)

Connect the repo to AWS Amplify Hosting; Amplify builds the Next.js app and the
`amplify/` backend together.

## UI

News/editorial theme: dark sticky nav (Menu dropdown + centered wordmark + search),
two-column home page (lead article + Latest/Topics sidebar), category chips from the
post's first tag, cover images (set per post in the editor; a colored placeholder is
shown when absent), and article-grade markdown via the Tailwind typography plugin.
The nav search icon filters the home feed client-side.

## UI (SaaS theme)

Light enterprise-SaaS look (indigo primary): light top nav with Sign In / Get
Started, a home hero + feature cards + 3-column post grid with client-side search,
and custom `/login`, `/register`, and `/forgot` pages (the Amplify Authenticator was
replaced). `/auth` redirects to `/login`. "Continue with Google" is a styled
placeholder until a Cognito Google identity provider is configured.

## Coder terminals

Posts can embed a live Docker shell with a fenced block:

    ```terminal
    lab: python-basics
    ```

Valid labs: `python-basics`, `node-basics`, `linux-basics`. Only users in the
`Coder` Cognito group see a live terminal (others see a request-access prompt);
SystemAdmins grant Coder access at `/admin/users`. The browser connects to the relay
(`NEXT_PUBLIC_TERMINAL_WS_URL`) with its Cognito ID token; the relay verifies it
against the Cognito user pool and enforces the `Coder` group itself. There is no
shared secret — the relay is configured with the pool's `COGNITO_USER_POOL_ID` /
`COGNITO_CLIENT_ID`. Containers run with networking disabled, so package installs are
not available yet.

Coders can view and stop their running container at `/account` ("My containers").
The browser calls the blog's `/api/containers` and `/api/containers/stop` routes, which
verify the Cognito session + `Coder` group, mint a token, and proxy server-to-server to
the relay's `GET /api/containers` / `POST /api/containers/stop` over `TERMINAL_HTTP_URL`
(e.g. `https://terminal.nmmr.tech`; `http://localhost:8080` locally).

Networked lab variants (`python-net`, `node-net`, `linux-net`) give the terminal internet
access so `pip install` / `npm install` / `apt-get` work; the plain `*-basics` labs stay
offline. Networked containers run on a firewalled `nmmr-net` Docker network (internet
allowed, host LAN blocked) — see `nmmr-terminal/commands.md` and
`scripts/setup-nmmr-net.sh`.

## Simple RAG application

The home page "Practical guides" card links to `/guides`. Coders see a **Simple RAG
application** card there (others see "more guides coming soon"); it opens `/guides/rag`,
a small UI to ingest URLs/PDFs into a vector store and chat with that content. It is
backed by the `rag-backends` service (FastAPI + Chroma + a remote Ollama host), exposed
through the same Cloudflare tunnel as the relay (e.g. `https://rag.rajendravenkata.com`).

Only users in the `Coder` Cognito group can use it. The page is gated client-side, and —
the real enforcement — the browser calls the blog's own `/api/rag/chat`,
`/api/rag/ingest/url`, and `/api/rag/ingest/pdf` routes, which verify the Cognito session
+ `Coder` group (`getManageAuth`, 403 otherwise) and proxy **server-to-server** to the
backend. The browser never calls the backend directly, so the backend's URL and key stay
server-side and its CORS config is irrelevant to this path.

### Environment variables (server-side, not `NEXT_PUBLIC_`)

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `RAG_API_URL` | No (defaults to `http://localhost:8000`) | `https://rag.rajendravenkata.com` | Base URL of the `rag-backends` service the proxy routes call. Use the tunnel host in Amplify; localhost for local dev. |
| `RAG_API_KEY` | No | `<shared secret>` | Sent as `Authorization: Bearer <key>` to the backend. Set only if `rag-backends` has `RAG_API_KEY` enabled; the two values must match. |

On Amplify, set these under **App settings → Environment variables** and **redeploy**
(env changes only apply on a new build). Amplify exposes console env vars to the build
but not always to the Next.js SSR runtime, so `next.config.mjs` inlines `RAG_API_URL` /
`RAG_API_KEY` at build time for the `/api/rag/*` route handlers. If `RAG_API_URL` is unset,
the proxy falls back to `http://localhost:8000` (local dev) — which on Amplify produces a
502 "Could not reach the RAG service".
