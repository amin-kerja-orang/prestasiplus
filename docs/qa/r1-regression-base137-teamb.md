# R1 E2E regression on BASE-137 + T10 (team B, lane B4)

Date 2026-11-02. Local stack only, nothing on any server. Tree: `r1/b4-e2e-base105-t10`, which already holds `r1/t23-e2e-c` (c8f5b25dd), the BASE-102 harness fix, T10 (`bf78ca930`, in base since BASE-106) and the T10-flow spec (ec5e76c25), merged with `origin/feature/v3-bijak-r1` **BASE-137 `dac398fa9`** (no conflict, merge commit `200ed754d`). `npx prisma generate` was run in `apps/api` after the merge (migrations 0105, 0106, 0107, 0110 applied by `prisma migrate deploy` in every fresh DB). API and SPA were rebuilt from this tree.

| Run | Tree SHA |
|---|---|
| `r1-e2e-baseline` (3 widths + default-throttle run) | 200ed754d (spec = ec5e76c25) |
| `admin-publish-http` | 727f88c06 (adds the `Muat lagi` fix below) |

Stack: own Postgres 16 container `b4-e2e-105-pg` (port 55475, UTC, removed afterwards), a fresh DB per width and per spec (migrate, seed `poc`, seed `e2e`), API `dist/main.js` on 3475 (`JOBS_WORKER_ENABLED=true`), SPA built `VITE_API_MODE=http --mode demo` served by `vite preview` on 5475, Node 22.23.4, Playwright CLI, 1 worker. Raised throttle env (global, admin read/write, login, questions list and write, builder, servability, Bijak, practice, account, public) for the graded runs; the run named "default throttles" used none. Only processes and the container I started were stopped; `b4-r1e2e-pg` and port 5244 were not touched.

## 1. Verdict: Not ready

- Three failures at every width: S2a (new), S3e (new), S2e (carried). S4b and B-05 are blocked by S3e.
- S1h now passes (BASE-118 SP check). S3a, S3c, S3d, S1b pass (T10 flow in the spec).
- No layout break: `expectNoHScroll` passed on every visited screen at 375, 768 and 1280.
- `admin-publish-http` passes at all three widths with a spec fix (no seed or data fixture needed, see section 4).
- With default throttles, one more step fails with 429 (S1i).

## 2. Spec `r1-e2e-baseline` (43 steps), raised throttles

| Width | Pass / Fail / Skip | Failing steps |
|---|---|---|
| 1280 | 31 / 3 / 9 | S2a, S2e, S3e |
| 768 | 31 / 3 / 9 | same |
| 375 | 31 / 3 / 9 | same |

Skips (same at all widths): S2g, S2c, S2d, S5d (not needed by design); S3f and S3g (by design: S3c and S3d published through the UI, "Not needed: ... published through the UI", still true of the T10 flow); B-02 (known); S4b and B-05 (blocked by the S3e failure: "no published admin paper with a written part", "neither B-02 nor S4b produced a submitted attempt").

Passing now that failed or were not passing before: S1b (BS-02 opens the batch list, CSV page by its route), S3a (Set Builder), S3c, S3d (override UI, the S4a and S4a2 pupil sittings pass), S1h.

### Failures (all widths, identical)

| Step | What the command showed | Status vs the previous run (BASE-105 + T10) | Owner |
|---|---|---|---|
| **S2a** | "every DSKP-tagged run question approved through the UI": expected 7, got 5. Observations: Hantar untuk Semakan "succeeded on 9 of 9" (HTTP ok), then bulk Terbitkan on 9 rows: affected 5, refused "Peralihan 'Draf' -> 'Diterbitkan' tidak dibenarkan."; statuses after: 4 of the 9 still draft. Per entry path: PDF intake 0/2, CSV 0/2, Studio 3/3, Bank Soalan form 2/2. | **New** (S2a passed before) | Team A (question lifecycle). The reason the 4 stay draft was not captured by the spec (it counts HTTP 200 as sent). Probable cause, not verified: commit 6c444a1f7 (R1-H-A18, in BASE-132) makes the bulk Semakan run the submit gate, and S3e shows that gate refusing "Sila pilih bab." for a question without a chapter. The PDF and CSV rows carry no Bab. |
| **S3e** | API-assisted K2 step: `review: HTTP 200 affected 0 of 17 refused: Sila pilih bab.` (expected 17). The questions the step creates through `POST /api/questions` carry no `curriculumChapterId`, and the review gate now requires a Bab (`apps/api/.../lifecycle/gates.ts`). | **New** (S3e passed before) | B4 (spec: the API-created questions need a chapter) if the gate is intended; team A to confirm the gate is intended for API and intake-born questions. |
| **S2e (R1E2E-10)** | Bulk Terbitkan on an approved question still refuses "Peralihan 'Diterbitkan' -> 'Diterbitkan' tidak dibenarkan." | Carried over | Team A |

S1h (R1E2E-17), carried failing on BASE-102 and BASE-105: **now passes**. Observed: the server refuses SP "1.1" with "Soalan 1: SP "1.1" tiada dalam senarai kurikulum. Pilih SP daripada senarai DSKP.", the banner shows "Pelayan menolak 1 perkara. Baiki sebelum dihantar semula.", and "Dihantar untuk semakan" is not shown.

Cascade: S4b (self-mark of a written part) and B-05 did not run because S3e produced no K2 paper. They were not run, so their state on BASE-137 is unknown.

## 3. Default throttles, 1280 only (one run)

Result: 30 / 4 / 9. Failing: S2a, S2e, S3e (as above) and **S1i** (Studio list). S1i passes with raised throttles. The S1i trace shows HTTP 429 on `GET /api/questions?search=...`, `GET /api/me`, `GET /api/me/notifications/unread-count` and `GET /api/subjects` (the whole run shares one client address, so the global per-address limit is the likely one; the run did not tell which limit tripped, and the 240/min per-user list limit alone cannot be told apart). The failure message is the generic "the S1d question is listed ... element(s) not found". So with default throttles a fast single-address run does hit 429 and one step fails; no other step got a 429 that failed a step in this run. Same finding as BASE-102 (suggest raising throttles in the local E2E stack config; the UI shows no rate-limit message).

## 4. Spec `admin-publish-http` (BASE-137, spec 727f88c06)

| Width | Pass / Fail / Skip |
|---|---|
| 1280 | 6 / 0 / 0 |
| 768 | 5 / 0 / 1 |
| 375 | 5 / 0 / 1 |

- Skip at 768 and 375: "opening an existing paper renders the editor read-only path", reason from the spec "no existing paper in this environment" (its link selector finds no paper at those widths; not investigated).
- The write test (draft, assemble to Sepadan, Simpan, Terbitkan, student sees it, Tarik balik, delete) **passes at all three widths** (about 33 to 41 s) through the T10 flow: plain Terbitkan disabled, "belum Disahkan" shown, override tick, reason, confirm.
- **Correction to my previous report.** I said the 1449/1 write test failed because the fresh seed holds only 18 pickable questions. That was wrong. The pool for the section holds 57 units (54 eligible; 40 placed through the API all reach "Sepadan"). The picker shows 20 candidates per page and the spec's loop did not press "Muat lagi" (REQ-B-042), so it stopped after the first page. The fix is in the spec only: `assembleUntilMatching` waits for the page, presses "Muat lagi" while no addable row is visible, and still fails (poll timeout) when there is neither an addable row nor another page. The write test also gets a 150 s timeout (40 picks, two browser contexts; the 30 s default is too short).
- **No fixture was added**, although the request was to give the write test its own 1449/1 fixture: with the paging fix the seeded pool already offers 40 pickable questions, so a fixture would have been dead code that no run exercises. If team A still wants the spec independent of the seed (REQ-B-062), the fixture would be real API calls (`POST /api/questions` with kertas, tag and a chapter, then bulk review and approved); I probed that route once on a scratch DB (it works only with `curriculumChapterId`, which ties in with S3e). It is not built.

## 5. Not run

Unit and API DB suites, lint, type-check. S4b and B-05 (blocked). Only one run per width; one default-throttle run at 1280 only.

## 6. Commits (local, not pushed)

`200ed754d` merge of BASE-137; `727f88c06` spec fix; this report.
