# R1 E2E regression on BASE-195 + T10 (team B, lane B4)

Date 2026-11-02. Local stack only, nothing on any server. Tree: branch `r1/b4-e2e-base105-t10` = `r1/t23-e2e-c` (c8f5b25dd) + BASE-102 harness fix + T10 (`bf78ca930`, in base since BASE-106) + the T10-flow spec (ec5e76c25) + the `Muat lagi` spec fix (727f88c06), merged with `origin/feature/v3-bijak-r1` **BASE-195 `12c8710b2`** (no conflict) as merge commit **`87b8f91d3`**. Fetch wrapped in `perl -e 'alarm 120; exec @ARGV' git fetch`. `npx prisma generate` run in `apps/api`; API and SPA rebuilt from this tree. All runs below were made at 87b8f91d3; the specs were not changed in this round (the merge brought 2 lines into `admin-publish-http.spec.ts` from base: the "Tarik balik kertas ini ke draf?" confirm).

Stack: own Postgres 16 container `b4-e2e-105-pg` (port 55475, UTC, removed afterwards), a fresh DB per width and per spec (all migrations applied by `prisma migrate deploy` (the DB setup logged success each time), including 0104, 0105, 0106, 0107, 0110; then seeds `poc` and `e2e`), API `dist/main.js` on 3475 (`JOBS_WORKER_ENABLED=true`), SPA built `VITE_API_MODE=http --mode demo` served by `vite preview` on 5475, Node 22.23.4, Playwright CLI, 1 worker. Raised throttle env for the graded runs; none for the default-throttle run. Only what I started was stopped; `b4-r1e2e-pg` and port 5244 were not touched.

## 1. Verdict: Ready (this tree, raised-throttle stack)

- `r1-e2e-baseline`: 36 pass, 0 fail, 7 skip at 1280, 768 and 375. S4b and B-05 run and pass.
- `admin-publish-http`: no failure at any width.
- S1h, S2a, S2e, S3e (the carried and new failures of BASE-137) all pass with no spec change.
- No layout break: `expectNoHScroll` passed on every visited screen at all three widths.
- Conditions on that verdict: it holds for a stack with raised API throttles. With default throttles one run at 1280 fails 12 steps from HTTP 429 (section 3); that is a test-stack setting and not a product assertion failing, but it is open.

## 2. `r1-e2e-baseline` (43 steps), raised throttles

| Width | Pass / Fail / Skip |
|---|---|
| 1280 | 36 / 0 / 7 |
| 768 | 36 / 0 / 7 |
| 375 | 36 / 0 / 7 |

Skips (same at all widths, each with its reason in the run): S2g (intake editor already set Aras pemikiran), S2c (S2a approved through the UI), S2d and S5d (not applicable since BASE-4: approved is the served status), S3f and S3g (the paper and the control paper were published through the UI), B-02 ("no Sains Kertas 2 paper on the hub (PoC papers no longer listed); self-mark is covered by S4b"). B-02 was already a known skip.

Previously failing steps, now (observed at 1280; the same at the other widths):
- **S1h (R1E2E-17):** pass. The server refuses SP "1.1" ("tiada dalam senarai kurikulum"), banner "Pelayan menolak 1 perkara...".
- **S2a:** pass. 9 run questions; Terbitkan affected 7; the 2 refused rows are the untagged CSV rows ("Sila pilih unit DSKP ...", which the spec excludes by design).
- **S2e (R1E2E-10):** pass. Terbitkan on an approved row: HTTP 200, affected 0, no "Diterbitkan -> Diterbitkan" refusal.
- **S3e:** pass. Review and approve of the 15 K2 questions: affected 15 of 15; 2 intake questions placed in Bahagian A. S3e's own assertions did not need a Q17 change: they passed unchanged, so no spec edit was made.
- **S4b** (written part self-mark: 15 written answers, own stimulus and shared passage shown once) and **B-05** (Cuba lagi after the old attempt: POST 201): both ran and passed.
- S3a, S3c (plain publish via API refused `ok=false`, UI override publishes), S3d, S1b, S4a, S4a2: pass.

New failures: none. Carried failures: none.

## 3. Default throttles, 1280 only, one run

Result: 23 pass / 12 fail / 8 skip. Failing: S1i, S3e, S4c, S4d, S4e, S4f, S6, B-01, B-02, B-04, B-04c, B-04b. Extra skips (S4b, B-05) because S3e failed ("no published admin paper with a written part"). All 12 failures are 429 responses; nothing else failed.

Which limit, from the failing traces (every 429 response of each failed test, with its `Retry-After`):

| Failing step | 429 responses in its trace | Limit indicated |
|---|---|---|
| S1i (Studio group members, expected 2 rows) | `GET /api/questions/studio/dskp`, `/api/admin/servability/questions/1291`, `/api/session`, `/api/me`, `/api/me/notifications/unread-count`, `/api/stimulus-groups/3` all in one window, Retry-After 14 s | **Per-address global** limit (`THROTTLE_GLOBAL_PER_MINUTE`, 300/min): unrelated routes with different per-route limits are refused together. |
| S3e | `POST /api/admin/papers/9/placements`, `RATE_LIMITED "Too Many Attempts"`, Retry-After 15 s; only that one request in the trace | **Per-user builder write** limit (`THROTTLE_BIJAK_BUILDER_WRITE_PER_MINUTE`, 60/min): S3e places 15 or more questions in a minute; the spec's S3e `post` helper has no 429 retry (S3f/S3g's helper does). |
| S4c, S4d, S4e, S4f, S6, B-01, B-02, B-04, B-04c, B-04b (login) | `GET /api/session`, `GET /api/public/stats` and `POST /api/auth/login` all 429 at the same moment (Retry-After 8 to 14 s) | **Per-address global** limit again (a login-only bucket would not refuse `/api/session` or `/api/public/stats`); the login limit (5/min) may also apply, the trace does not separate them. |

The **per-user list limit** (`THROTTLE_QUESTIONS_LIST_PER_MINUTE`, 240/min on `GET /api/questions`) did not cause any 429 in this run: no `GET /api/questions` list request was refused in any trace. The earlier BASE-137 default-throttle run (S1i) was the same global-address pattern. Same suggestion as before: raise the throttles in the local E2E stack config (owner B/C), show a rate-limit message instead of the generic error (Low, C), and let the S3e helper retry on 429 as S3f/S3g do (B4, if wanted; not done).

## 4. `admin-publish-http`

| Width | Pass / Fail / Skip |
|---|---|
| 1280 | 6 / 0 / 0 |
| 768 | 5 / 0 / 1 |
| 375 | 5 / 0 / 1 |

Skip at 768 and 375: "opening an existing paper renders the editor read-only path" (the spec's own skip, "no existing paper in this environment"; not investigated, same as BASE-137). The write test (draft, assemble to Sepadan through the picker pages, Simpan, Terbitkan through the T10 override, student sees it, Tarik balik with its confirm, delete) passes at all three widths.

## 5. Not run

Unit and API DB suites, lint, type-check, default-throttle runs at 768 and 375, repeat runs (one run per width).

## 6. Commits (local, not pushed)

`87b8f91d3` merge of BASE-195; this report.
