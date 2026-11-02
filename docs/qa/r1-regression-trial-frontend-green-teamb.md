# R1 trial tree with the frontend fix (team B, lane B4)

Date 2026-11-02. Local stack only, nothing on any server. Verdict: **Ready**. No product failure.

## 1. What was tested

| Item | SHA |
|---|---|
| Tree under test | `16f798068` on `r1/b4-trial-frontend-green` (`r1/b4-e2e-flakes` `052d0cf44` + `r1/b1-reqb081-frontend-green` `3c65fff56`) |
| Base tip when the runs ended | BASE-211 `21d0586b4`. It already contains `3c65fff56` (BASE-209); the rest since BASE-207 is docs |

The tree under test differs from BASE-211 outside `docs/` only in `e2e/api/helpers.ts`, `e2e/api/r1-e2e-baseline.spec.ts`, `e2e/bijak/admin-publish-http.spec.ts` and `playwright.r1-e2e.config.ts`. So the product code tested is that of BASE-211.

No spec was changed. The scratch spec copy and scratch config in section 5 were never committed and have been deleted.

Stack: Postgres 16 container `b4-flakes-pg` (port 55491, UTC), API `dist/main.js` (`NODE_ENV=development`, `JOBS_WORKER_ENABLED=true`, `THROTTLE_GLOBAL_PER_MINUTE=3000`, every other throttle at its default), SPA built `VITE_API_MODE=http --mode demo`, Node 22.23.4, Playwright 1.63.0 CLI. HTTP specs ran one at a time, each on a new database (migrate, seed `poc`, seed `e2e`) with a new API process that was checked to own the port. No 429 and no 5xx in any API log of these runs.

## 2. HTTP specs, global 3000, fresh DB each (pass / fail / skip)

| Spec | 1280 | 768 | 375 |
|---|---|---|---|
| `r1-e2e-baseline` first run | 36 / 1 / 6 | 36 / 0 / 7 | 36 / 0 / 7 |
| `r1-e2e-baseline` repeat at 1280 | 36 / 0 / 7 | not needed | not needed |
| `admin-publish-http` | 6 / 0 / 0 | 6 / 0 / 0 | 6 / 0 / 0 |
| `e2e/api/icons-no-fetch` | 4 / 0 / 0 | 4 / 0 / 0 | 4 / 0 / 0 |

Skips in the 36 / 0 / 7 runs are the known seven: S2g, S2c, S2d, S5d, S3f, S3g, B-02.

## 3. Mock-mode specs (pass / fail / skip)

| Spec | 1280 | 768 | 375 |
|---|---|---|---|
| `e2e/bijak/admin-publish.spec.ts` | 4 / 0 / 2 | 4 / 0 / 2 | 4 / 0 / 2 |
| `e2e/bijak/set-builder-responsive.spec.ts` | 0 / 1 / 0 | 0 / 1 / 0 | 0 / 1 / 0 |
| `e2e/m04-question-bank/t6-reports.spec.ts` | 11 / 0 / 0 | 11 / 0 / 0 | 11 / 0 / 0 |
| `e2e/m04-question-bank/qa-g5-reports.spec.ts` | 16 / 0 / 0 | 16 / 0 / 0 | 16 / 0 / 0 |
| `e2e/m04-question-bank/smoke-question-list.spec.ts` | 14 / 0 / 0 | 14 / 0 / 0 | 13 / 0 / 1 |
| `e2e/icons/no-icon-fetch.spec.ts` | 4 / 0 / 0 | 4 / 0 / 0 | 4 / 0 / 0 |

Skips: `admin-publish` C-11 and C-16 are `test.fixme` in the spec. `smoke-question-list` at 375 is the spec's own "cards below md have no select-all checkbox". `no-icon-fetch` is the mock twin of the HTTP icon spec, added to the request because `ICON_ROUTES` is shared.

The main mock config has a fixed port (4173), so these ran through an uncommitted config on my own port 5496. The bijak config ran on 5497 through `BIJAK_PORT` and `BIJAK_REUSE`.

## 4. `file-x` and `footprints`: they load, no blocked fetch

The route specs do not reach these states, because `ICON_ROUTES` holds menu routes only and the Kuiz empty state needs a quiz with no questions. So a scratch script drove them on the real API at all three widths. It recorded `[icons] not bundled` warnings, requests to the Iconify hosts, and the path data of the drawn SVG. `KuizPage` used a stubbed empty session; the others are real responses.

| Screen, state | Personality | Icon drawn, fixed tree | Warning or request, fixed tree | Same check, control build without the fix |
|---|---|---|---|---|
| `KuizPage`, empty | learner | yes, 398 path characters | none | **nothing drawn, `[icons] not bundled: ph:file-x-duotone`** |
| `PaperQuizPage`, paper not found | learner | yes, 398 | none | **nothing drawn, same warning** |
| `ChainCards` Tahap 3, `/admin/kirkpatrick/chain` | staff | yes, 786 | none | drawn, no warning |
| `ChainCards` Tahap 3, `/guru/kirkpatrick/chain` | staff | yes, 786 | none | drawn, no warning |

The result is the same at 1280, 768 and 375, with no horizontal scroll. The control build proves the script can see the fault, and shows what the fix changes: pupils on the Kuiz and paper-quiz empty states had a blank icon.

Limit: `ChainCards` is only on staff routes here, so `ph:footprints-duotone` was not seen rendered. It is in the built bundle (absent from the control build), and regular `footprints` already worked before the fix. `PaperQuizPage`'s other two `file-x` states use the same component and icon and were not forced separately.

## 5. Every failure, with cause and owner

None is a product fault. Both are spec timing, owner B4. Neither spec was changed, as instructed.

### 5.1 `r1-e2e-baseline` S3d at 1280, first run

"The control question is offered in the picker": received 0. Cause: `buildPaper` reads the candidates after a fixed `waitForTimeout(1000)` (spec line 1848). Other sessions had the machine at a load average near 33, and the search answered 200 in 1.56 s. The trace shows the count read at 09:04:59.29 and the response arriving at 09:04:59.80. The repeat on a fresh DB at load about 4 passes, 36 / 0 / 7. Passes at 768 and 375.

### 5.2 `set-builder-responsive`, all widths, always

Failure: `unit-group-mat1-g1` count 0 after adding a stimulus group. It fails every time, in both runs. This has nothing to do with the frontend fix, since it stops at a step the fix does not touch.

Cause: the spec clicks "Tambah" on the group and then on a single question 47 ms later, without waiting. In mock mode `admin/builder/server/memory.ts` does an unlocked read, change and save across its latency, so the second add overwrites the first: the set shows only the single question ("ada 1"). The spec (`14df14a8e`) predates the placement calls added later the same day (`e15469094`, `78ca7ef31`); I did not check whether it ever passed after them. A second race follows: it reads `down.isEnabled()` before the single question lands, so it takes the `up` branch on a button that stays disabled.

Why this is not a product fault:
- **Real API, same clicks:** two "Tambah" clicks at 0, 50, 150 and 400 ms apart, 8 rounds at 1280: both questions on screen and stored every time, no error. `addPlacement` takes a paper lock in a transaction (`builder.service.ts:938`). These rounds used two single questions, as the default bank page showed no group.
- **The rest of the flow:** a scratch copy of the spec with only two waits added passes at all three widths: group, Naik / Turun, Buang, Terbitkan disabled reason, Semak Kertas, and every no-scroll check on the way.

Follow-up for B4: fix the two waits in the spec and replace the fixed wait in `buildPaper`. The mock's lost update (owner C) exists only where `VITE_API_MODE` is not `http`, such as a demo build: there, two quick "Tambah" clicks can drop one. It cannot reach a user of the real API.

## 6. Not run

Unit and API DB suites, lint, type-check, default or raised throttles, any server, and the whole mock e2e suite (only the listed specs). `NODE_ENV=development` throughout.

## 7. Verdict: Ready

- Baseline, publish and icon specs have no remaining failure at any width on fresh DBs at the production global throttle. One baseline step needed a repeat under outside load.
- `file-x` and `footprints` load with no blocked fetch on the three screens, within the limit in section 4.
- Mock specs pass except `set-builder-responsive`, a spec fault shown not to reach the product.
- Same condition as the final report: `THROTTLE_GLOBAL_PER_MINUTE=3000` in the production `api.env`.
