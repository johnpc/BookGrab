# BookGrab — guide for coding agents (and humans)

BookGrab is a small Next.js app: search MyAnonyMouse (MAM) for ebooks and
audiobooks, send a result to Transmission with one click. Read this file
before changing anything; it is the contract for how the codebase works and
how changes are proven.

## Ground rules

1. **There is no such thing as a flaky test.** CI must pass reliably. If a test
   fails intermittently, the test or the app has a race, and the race gets
   fixed. Never add retries, `waitForTimeout`, or "retry on failure" to make
   a test pass. Playwright and Vitest are configured with `retries: 0`; keep
   it that way.
2. **Tests never touch the real MAM or Transmission.** CI and `npm run test:e2e`
   use the mock backend in `tests/mock/` (see below). The real MAM session is
   IP-bound: using the production token from another machine will fail with
   403, and triggering a session refresh from another machine would re-bind
   production to that machine's IP. Do not copy the production token anywhere.
3. **Every behaviour change ships with a test** (unit for pure logic, e2e for
   anything a user sees) and must pass `npm run check` before it is pushed.
4. **State is explicit.** User-visible lifecycles are modelled as
   discriminated unions with reducers in `src/state/`. Do not reintroduce
   `isLoading` + `error` + `hasSearched` style boolean soups; add a state or
   event to the relevant machine instead.
5. **The URL is the source of truth for the search UI** (`q`, `sort`, `type`,
   `lang`, `page`). New view options go in the URL too, so deep links,
   refresh, back/forward and agent-driven navigation keep working.
6. Keep type checking strict. `next build` fails on type errors on purpose;
   do not re-enable `ignoreBuildErrors`.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Next dev server against the real backend (`.env.local`) |
| `npm run dev:mock` | Dev server against the mock backend, no credentials needed |
| `npm run lint` / `npm run typecheck` | ESLint 10 flat config / `tsc --noEmit` |
| `npm test` | Vitest unit tests (`tests/unit`) |
| `npm run build` | Production build (Turbopack, `output: standalone`) |
| `npm run test:e2e` | Playwright against the standalone build + mock backend |
| `npm run check` | Everything above, in CI order |
| `npm run start:mock` | Standalone production server against the mock backend |
| `npm run mock-backend` | Just the mock MAM + Transmission server on :4010 |

Node 26 (`.nvmrc`); Node 22.12+ works. Playwright browsers:
`npx playwright install chromium`.

## Architecture

```
src/
  app/                 Next 16 App Router
    page.tsx           Suspense boundary → <HomeClient/>
    layout.tsx         metadata, viewport, theme boot script, PWA registration
    api/search         GET  one MAM page: { books, hasMore, totalResults }
    api/grab           POST send a MAM download link to Transmission
    api/mam-keepalive  POST refresh (and rotate) a MAM session
    api/status         GET  readiness + configuration summary (no secrets)
  components/          Presentational components, CSS classes from globals.css
    HomeClient.tsx     The page: URL ⇄ state, wires hooks to components
  hooks/
    useBookSearch.ts   Search controller: fetch loop, abort, dispatch to reducer
    useGrabs.ts        Grab controller: per-book state map + localStorage
  state/               Explicit state machines (pure reducers, unit tested)
  lib/                 Server libs (MAM, Transmission, token) + pure helpers
  contexts/            SettingsProvider: user token, session, theme, language
tests/
  unit/                Vitest
  e2e/                 Playwright specs (desktop + mobile projects)
  mock/                Fake MAM + Transmission backend and fixtures
scripts/start-standalone.mjs  Runs .next/standalone like the Docker image
```

### Error contract

Every `/api/*` error body is `{ error, code, hint? }` with `code` one of
`BAD_REQUEST | MAM_NOT_CONFIGURED | MAM_AUTH | MAM_UPSTREAM |
TRANSMISSION_UPSTREAM | INTERNAL` (`src/types/index.ts`). Throw `AppError`
from `src/lib/api-error.ts`; routes convert it with `errorResponse`. The UI
keys its recovery actions off `code` (e.g. `MAM_AUTH` → "Open settings").

### Environment

| Variable | Purpose |
| --- | --- |
| `MAM_TOKEN` | Seed MAM session (`mam_id`). Once `MAM_TOKEN_FILE` exists it is ignored. |
| `MAM_TOKEN_FILE` | Where rotated tokens persist (Docker: `/data/mam_token`). |
| `TRANSMISSION_URL` | Transmission RPC endpoint. |
| `AUDIOBOOK_DESTINATION_PATH` / `EBOOK_DESTINATION_PATH` | Download dirs by category. |
| `MAM_BASE_URL` | MAM origin (default `https://www.myanonamouse.net`). Tests point it at the mock. |
| `MAM_SEEDBOX_URL` | Dynamic-seedbox keepalive URL. Tests point it at the mock. |
| `MAM_KEEPALIVE_DISABLED` | `true` disables the 12-hourly server keepalive (tests). |

## State machines

All machines live in `src/state/` as discriminated unions + reducers. UI
components expose the current state as `data-*` attributes so tests and
agents read state directly instead of inferring it from text.

### Search (`state/search.ts`, driven by `hooks/useBookSearch.ts`)

```
idle ─SEARCH_STARTED→ searching ─PAGE_RECEIVED(hasMore)→ streaming ─PAGE_RECEIVED…→
                           │                                  │
                           ├─PAGE_RECEIVED(!hasMore)──────────┴─SEARCH_COMPLETED→ ready
                           └─SEARCH_FAILED───────────────────────────────────────→ error (keeps partial books)
```

- Every event carries a `requestId`; events from a superseded search are
  ignored, and the controller aborts the old fetch. A newer search always wins.
- Pages render as they arrive (`streaming`) with a real progress bar.
- `MAX_RESULTS = 500` caps the fetch loop; `ready.truncated` tells the UI to say so.
- Sort and type filter are applied client-side over the loaded set, so they
  are instant and cause no refetch (unless truncated, where the server order
  matters and the search re-runs).
- Observable: `.app[data-search-status]`, `[data-testid=search-status][data-status|data-loaded|data-total]`.

### Grab (`state/grab.ts`, driven by `hooks/useGrabs.ts`)

```
idle ─GRAB_STARTED→ sending ─GRAB_SUCCEEDED→ added | duplicate
                        └─GRAB_FAILED→ error ─GRAB_RESET→ idle
```

- Keyed by book id and owned by the page, so paging/filtering never forgets a
  grab. `added`/`duplicate` persist in localStorage (`bookgrab.grabbed`, max 500).
- Observable: `[data-testid=book-card][data-grab-status]`, `[data-testid=grab-button][data-status]`.

### MAM session for a user token (`state/session.ts`, in `SettingsContext`)

```
unknown ─CHECK_STARTED→ checking ─CHECK_SUCCEEDED→ active
                            └─CHECK_FAILED→ error
any ─TOKEN_CLEARED→ unknown
```

Checked when a token is saved and every 55 minutes while a tab is open.
Observable: `[data-testid=session-status][data-status]`.

### Server MAM token (`lib/mam-token.ts`, `lib/mam-session.ts`)

Precedence: request header `x-mam-token` (user) → `MAM_TOKEN_FILE` → `MAM_TOKEN`
seed. The server refreshes its own session 30 s after boot and every 12 h,
persisting each rotated `mam_id` atomically. On a 403 during search it refreshes
once and retries. User-supplied tokens are never persisted or rotated.

### Theme (`lib/theme.ts`)

`system | dark | light` in localStorage (`bookgrab.theme`), applied to
`<html data-theme>` by an inline script before first paint. CSS custom
properties in `globals.css` carry both palettes.

### URL ⇄ view state (`components/HomeClient.tsx`)

`/?q=dune&sort=size&type=audiobook&lang=all&page=2`. Defaults are omitted
(`sort=seeds`, `type=all`, `page=1`). `lang` falls back to the saved preference
(`bookgrab.lang`, default `en` = English only). Rapid successive updates build
on a pending-params ref, never on the stale render snapshot.

### Service worker (`public/sw.js`)

Navigations are network-first (offline fallback), `/api/*` is never
intercepted, hashed static assets are cache-first. Bump `CACHE_VERSION` when
the strategy changes; `/sw.js` is served with `no-store`.

## Mock backend (`tests/mock/`)

`mock-backend.mjs` is a dependency-free Node HTTP server imitating MAM's
`loadSearchJSONbasic.php`, `dynamicSeedbox.php` and Transmission RPC
(including the 409 session-id handshake). Fixtures are real, sanitised MAM
responses. Behaviour is keyed on the query so tests are deterministic:

| Query | Behaviour |
| --- | --- |
| `project hail mary` | 20 fixture rows, 8 languages, both categories (10 English) |
| `dune` | 338 generated English rows → 17 pages |
| `nothing here` | 0 results |
| `slow …` | answered after 1.5 s |
| `gated …` | held until `POST /__mock/release` |
| `boom …` | MAM returns HTTP 500 |
| anything else | 7 generated rows; download links contain the query |

Torrents: adding the same link twice → `torrent-duplicate`; a link containing
`fail` → `unrecognized info`. Tokens: `mock-token` (any `-rN` rotation) is valid,
`wrong-type` → "Incorrect session type", anything else → 403.
`GET /__mock/state`, `POST /__mock/reset`. Because this state is shared,
Playwright runs with `workers: 1`.

## Verifying UI changes

Unit + e2e are the gate, but also look at the result: `E2E_VIDEO=1 npm run
test:e2e` records every test; `npx playwright show-report` opens traces.
Deploys go to `bookgrab.jpc.io` (Docker image `mrorbitman/bookgrab`, built by
CI on `main`).

## Next.js docs for this exact version

Version-matched docs are bundled in `node_modules/next/dist/docs/` (start at
`index.md`). Prefer them over web search when touching framework behaviour.
