# Which commit is on the demo?

UAT 2026-10-24 (task T0) ran on `https://prestasiplus-demo.pages.dev` and nobody could say which commit was built there. Since then every demo build prints its commit on the login screen.

## Read the commit from the login screen

Open `/login` on the demo. The last line under the card, below the copyright line, reads:

```
Binaan a1b2c3d · 2026-10-24
```

- `a1b2c3d` is the short commit SHA the bundle was built from. `+dirty` after it (for example `a1b2c3d+dirty`) means the build was made from a working tree with uncommitted changes to tracked files, so it does not match any commit exactly. Do not deploy such a build for UAT.
- `2026-10-24` is the build date (UTC).
- `unknown` means the build had no git checkout and no `VITE_BUILD_SHA` / `CF_PAGES_COMMIT_SHA`. Rebuild it properly.
- The line only exists in demo builds (`vite build --mode demo`: `npm run build`, `npm run build:artifact`, Docker). It is absent from `npm run dev`, the e2e build and the unit tests.

Compare with the branch head:

```
git rev-parse --short HEAD          # on the branch that should be tested
```

If the two differ, the demo is older than the branch. Rebuild and redeploy before re-testing, then check the login line again.

## Cross-check in Cloudflare Pages

Cloudflare dashboard, Workers & Pages, project `prestasiplus-demo`, tab Deployments. Each row shows the branch, the commit hash and message, and the time. The production row marked "Production" is what `prestasiplus-demo.pages.dev` serves. Its commit hash should start with the SHA on the login screen. If the project is deployed by direct upload (no git link), the dashboard shows no commit, and the login line is the only record.

## How the SHA is resolved

`vite.config.ts` injects `__BUILD_SHA__` and `__BUILD_DATE__` at build time, in this order:

1. `git rev-parse --short HEAD`
2. `VITE_BUILD_SHA` env var
3. `CF_PAGES_COMMIT_SHA` env var (set by Cloudflare Pages git builds)
4. `unknown`

Two details:

- An empty `VITE_BUILD_SHA` (the Docker / compose default when the variable is not exported) counts as unset: the lookup uses `||`, so it falls through to `CF_PAGES_COMMIT_SHA` and then `unknown`.
- The `+dirty` suffix is skipped when `CF_PAGES` is set (any Cloudflare Pages build). Those builds can touch tracked files such as `package-lock.json` during install, which would otherwise mark every Pages build dirty. The SHA there is the checked-out commit.

Docker builds have no `.git` in the context (`.dockerignore`), so pass it explicitly:

```
VITE_BUILD_SHA=$(git rev-parse --short HEAD) docker compose build
```

## Deployment configuration in the repo

There is no Cloudflare Pages or wrangler configuration in the repo (no `wrangler.toml`, `_headers`, `_redirects` or `functions/`). The Pages project settings (git link or direct upload, build command, output directory) live only in the Cloudflare dashboard. Record them in the runbook when they are confirmed. Until then the login line is the only proof of what is deployed.
