# BookGrab

> **Disclaimer:** BookGrab is a personal project I built for myself. Support is limited to MyAnonyMouse (MAM) and Transmission.

BookGrab is a simple, streamlined web app: search MyAnonyMouse for ebooks and audiobooks and send them to your Transmission client with one click.

![](public/bookgrab.png)

## Why BookGrab?

Most people looking for book automation probably want [Readarr](https://readarr.com/). I built BookGrab because:

1. Readarr requires separate instances for audiobooks and ebooks, which is cumbersome
2. Readarr's author-based interface is too complicated to share with friends and family
3. I wanted a simpler, more direct search-and-download experience

BookGrab does one thing well: search MAM, download with a single click.

## Features

- Search MAM by title, author, narrator, series or tags; results stream in as they load, with a real progress bar
- **English only** by default (one tap to include every language); non-English results carry a language badge
- Filter by ebook / audiobook and sort by seeders, newest, size, title or downloads, instantly, without refetching
- One-click send to Transmission with separate download paths for audiobooks and ebooks; the app remembers what you already grabbed and tells you when Transmission already has it
- Optional copy of finished downloads to separate audiobook / ebook directories (copied, not moved)
- Shareable URLs: every search, filter, sort and page is in the address bar, so refresh, back/forward and deep links just work
- Optional per-user MAM token with live session status; otherwise the server's session is used and kept alive automatically
- Dark / light / system theme, installable PWA, mobile-first layout that scales to three columns on desktop

## Getting started

### Prerequisites

- A MyAnonyMouse account and a **dynamic seedbox** session token (MAM → Preferences → Security → create session with "Allow dynamic seedbox IP")
- A running Transmission client

### Option 1: Docker Compose (recommended)

```yaml
services:
  bookgrab:
    image: mrorbitman/bookgrab:latest
    container_name: bookgrab
    ports:
      - "3000:3000"
    environment:
      - MAM_TOKEN=your_mam_token_here            # seed only; rotations persist in /data
      - TRANSMISSION_URL=http://your-transmission-server:9091/transmission/rpc
      - AUDIOBOOK_DESTINATION_PATH=/path/to/audiobooks
      - EBOOK_DESTINATION_PATH=/path/to/ebooks
    volumes:
      - bookgrab_data:/data                      # keeps the rotated MAM session across restarts
    restart: unless-stopped
volumes:
  bookgrab_data:
```

```bash
docker compose up -d
```

Open http://localhost:3000. `GET /api/status` reports whether MAM and Transmission are configured.

### Option 2: Docker

```bash
docker run -d --name bookgrab -p 3000:3000 -v bookgrab_data:/data \
  -e MAM_TOKEN=your_mam_token_here \
  -e TRANSMISSION_URL=http://your-transmission-server:9091/transmission/rpc \
  -e AUDIOBOOK_DESTINATION_PATH=/path/to/audiobooks \
  -e EBOOK_DESTINATION_PATH=/path/to/ebooks \
  mrorbitman/bookgrab:latest
```

### Option 3: Run from source

Node 22.12+ (Node 26 recommended, see `.nvmrc`).

```bash
npm install
cp .env.local.example .env.local   # fill in MAM_TOKEN, TRANSMISSION_URL, paths
npm run dev                        # http://localhost:3000
```

No MAM account handy? `npm run dev:mock` runs the app against a built-in fake MAM + Transmission (see below).

### Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `MAM_TOKEN` | yes* | MAM `mam_id` session cookie. *Optional if every user supplies their own token in Settings. |
| `MAM_TOKEN_FILE` | no | File where rotated tokens are persisted. The Docker image sets `/data/mam_token`. |
| `TRANSMISSION_URL` | yes | Transmission RPC URL. |
| `AUDIOBOOK_DESTINATION_PATH` | yes | Download directory for audiobooks. |
| `EBOOK_DESTINATION_PATH` | yes | Download directory for ebooks. |
| `AUDIOBOOK_COPY_PATH` / `EBOOK_COPY_PATH` | no | When set, finished downloads of that type are **copied** here (never moved, so seeding continues). BookGrab must be able to read the download dirs and write these dirs. |
| `TRANSMISSION_PATH_MAP` | no | Maps Transmission's paths to BookGrab's when they differ, e.g. `/downloads=/mnt/downloads` (comma-separate several). |
| `COPY_QUEUE_FILE` | no | Where pending copies persist. The Docker image sets `/data/copy-queue.json`. |
| `COPY_POLL_INTERVAL_MS` | no | How often to check Transmission for finished downloads (default 30000). |
| `MAM_BASE_URL`, `MAM_SEEDBOX_URL` | no | Override MAM endpoints (used by tests). |
| `MAM_KEEPALIVE_DISABLED` | no | `true` disables the twice-daily server-side session refresh. |

### API

| Endpoint | Description |
| --- | --- |
| `GET /api/search?q=…&start=0&sort=seeds&lang=en&category=audiobook` | One MAM page: `{ books, hasMore, totalResults }` |
| `POST /api/grab` `{ torrentUrl, category }` | Send a MAM download link to Transmission: `{ success, message, duplicate }` |
| `POST /api/mam-keepalive` | Refresh the MAM session (header `x-mam-token` to check your own) |
| `GET /api/status` | Readiness and configuration summary (never includes secrets) |

Errors are always `{ error, code, hint? }`.

## Development

```bash
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm test            # unit tests (Vitest)
npm run build       # production build
npm run test:e2e    # Playwright e2e against the production build + mock backend
npm run check       # all of the above, in CI order
```

### Testing philosophy

**There is no such thing as a flaky test.** Tests in CI must pass reliably; if one fails intermittently, it has a race, and the race gets fixed. Retries are disabled everywhere and must stay disabled. Tests never need network access or credentials.

### Mock backend

`tests/mock/mock-backend.mjs` is a dependency-free fake of MAM's search and keepalive endpoints and Transmission's RPC, built from real (sanitised) MAM responses. It is what CI runs against, and what `npm run dev:mock` / `npm run start:mock` use. Query behaviours (`project hail mary`, `dune`, `nothing here`, `slow …`, `gated …`, `boom …`) are documented in [AGENTS.md](AGENTS.md).

### CI

`.github/workflows/ci.yml` runs lint, typecheck, unit tests, the production build and the Playwright suite on every push and pull request, then builds and publishes the multi-arch Docker image on `main` and tags. The image only publishes if every test passed.

See [AGENTS.md](AGENTS.md) for the architecture, the explicit state machines, and the rules for changing this codebase.

## Technologies

- Next.js 16 (App Router, Turbopack), React 19, TypeScript
- MyAnonyMouse JSON search API, Transmission RPC
- Vitest, Playwright

## Limitations

- Only works with MyAnonyMouse as the content source
- Requires a Transmission client for downloads
- No library management, just search and download
- A single search loads at most 500 results; refine the query to see more
