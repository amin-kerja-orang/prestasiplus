# AZ-32: integrated demo rehearsal, 22 Oct (for the 23 Oct demo)

Slug: `demo-rehearsal-integrated-22oct`. Owner: AZ-Dev3 (half AZ, #113). Run: 2026-10-21 19:40 to 22:30 UTC (22 Oct 03:40 to 06:30 MYT).

This is the first run of the **combined** stack: every half-AZ PR that is READY or SEDIA MERGE, merged on top of the two integration tips, on a fresh database, with the SPA in http mode against the real API. Nothing here was run against the cloud demo, prestasiplus.my or prestasiplus.cloud. The integration branches are local scratch only and were never pushed.

## 1. Verdict

**Go, with three High defects to fix or to keep out of the demo path.** They are all pre-existing on `be/integration-frontend` @ `d909e1e0`. None of them comes from a PR in this batch.

- D-01: a teacher cannot create a class from the UI (C-01).
- D-02: D1–D4 practice cannot start when a specific Darjah is picked. "Semua Tahap" works.
- D-03: Battle Arena "Quick Match" shows "Ralat sistem: ID giliran tidak sah."

All three are the same bug: the SPA sends or expects a numeric id where the contract uses string ids (`IdSchema`).

Everything the batch was meant to deliver works on the combined stack:
- the five solo games, including Kad Memori with D1–D4 cards (J-01 and J-02 closed);
- the SPM hub (J-04 closed);
- the intake review screens (J-03 closed for the screens);
- the D1–D4 pool.

There was no HTTP 5xx and no uncaught page error on any screen, and no horizontal scroll at 375, 768 or 1280.

## 2. Environment

| Item | Value |
|---|---|
| Backend tree | `feature/v2-backend` @ `23c98226` + the PRs in section 3, normal merges, local head `d76c859a` (scratch, not pushed) |
| Frontend tree | `be/integration-frontend` @ `d909e1e0` + the PRs in section 3, local head `01c7f9d1` (scratch, not pushed) |
| Database | Fresh PostgreSQL 16.15, local. Migrations 0001→0042 were applied in order by `psql`, with Prisma-compatible `_prisma_migrations` rows (the same path as `deploy/rehearsal/rehearsal-db.sh`, because the Prisma schema engine is offline here). All 36 folders applied cleanly, including **0040, 0041 and 0042**. |
| Seed | `npm run be:db:seed -- --profile=poc`, 25 modules, about 11 s. The DB was re-seeded fresh before the UAT and again at the end. |
| API | `node apps/api/dist/main.js` from the backend tree, port 3300. Settings: `NODE_ENV=production`, `BIJAK_POC_QUESTIONS=true`, `COOKIE_SECURE=true`, `TRUST_PROXY_HOPS=1`. |
| SPA | Built with `VITE_API_MODE=http npx vite build --mode demo` from the frontend tree (bundle check OK). Served by `vite preview` on port 5199, which proxies `/api` to the API on the same origin. |
| Browser | Playwright 1.63, Chromium 141 (`/opt/pw-browsers`), one browser, a fresh context per role. Viewports 375x812, 768x1024 and 1280x800. |
| Local differences from the demo | (1) The login throttle is raised to 120/min and the global throttle to 3000/min, so the many UAT logins from one address are not refused (J-14 not exercised). (2) There is no edge layer (Pages function or nginx), so the edge headers are absent. See section 6. (3) Chromium 141 is older than a current desktop Chrome (see D-06). |

## 3. PRs merged and conflicts

### 3.1 Backend (`feature/v2-backend` @ `23c98226`)

| Order | PR | Head | Result |
|---|---|---|---|
| 1 | #121 AZ-14 bulk-action `failed[]` | `e2451da5` | clean |
| 2 | #127 AZ-13 `practice_answers` index (0040) | `38039fcb` | clean |
| 3 | #129 AZ-02 PoC D1–D4 pool | `9e0ab958` (the G4 fix head, pushed during this run) | clean |
| 4 | #132 AZ-22 index rename (0041) | `f6174caa` | clean |
| 5 | #134 AZ-26 Kad Memori reveal idempotent | `43dffc0e` | **conflict** with #127 in `docs/architecture/v2-backend-deviations.md` |
| 6 | #135 AZ-31 nullable `classroom_id` (0042) | `f7f36935` | **conflict** with #127 and #134 in `docs/architecture/v2-backend-deviations.md` |
| 7 | #137 AZ-25 Betul/Salah flake | `7effcddc` | clean |
| 8–13 | docs/ops #112 `b2f356e6`, #115 `657ec0c8`, #116 `49ca37aa`, #117 `2e9338e1`, #118 `71b6ef0f`, #119 `e37c4eea` | | all clean |

A pairwise check on the tip showed that **#127, #134 and #135 conflict with each other, two by two**, all in the same place: each one appends at the end of `v2-backend-deviations.md`. #134 and #135 add a table row; #127 adds a new `## AZ-13` section. There is no code conflict. Locally I resolved it by keeping both sides and putting the rows into the table before the `## AZ-13` section.

### 3.2 Frontend (`be/integration-frontend` @ `d909e1e0`)

| Order | PR | Head | Result |
|---|---|---|---|
| 1 | #120 sync `feature/v2-backend` 2b0a9445 | `3726820d` | clean |
| 2 | #105 m16 solo games over http | `862324b5`, then the delta to `063eca04` (round 2, pushed 21:11 UTC) merged on top | **conflict** with #120 in `docs/architecture/v2-backend-deviations.md`: both append at the end of the file. I deferred #105 and merged it after #131, resolving it locally as a union. |
| 3 | #126 AZ-20a m06 SPM hub (stacked on #120) | `39949d55` | clean |
| 4 | #128 AZ-17 PartInput and `pksk_choice` (stacked on #120) | `7c65a1dc` | clean |
| 5 | #131 m28 intake review over http | `f4602e85` | clean |

Not in the batch, so not rehearsed: #140 and #141 (AZ-21c and AZ-24, CI), and #142 (AZ-18, stacked on #131).

### 3.3 Delta: #105 at `063eca04`

The full UAT ran with #105 at `862324b5`. AZ-Dev1's round-2 head `063eca04` (14 files, solo-game retry and recovery) was then merged on top, giving local frontend head `3690bb41`, and these were re-run:

| Check | Result |
|---|---|
| vue-tsc | 0 errors |
| http build and bundle check | OK |
| m16 unit tests | 40/40 files, 576 tests |
| The five solo games at 375, 768 and 1280 on a fresh seed | **5/5 PASS at each width**, no horizontal scroll |
| Kad Memori | 12 cards; full plays reach the result card at 1280 |

## 4. Gates on the merged trees (real output)

| Check | Result |
|---|---|
| Backend `be:verify -- --maxWorkers=2` | contract:check OK, contract-tests 22/22, lint, lint:migration and typecheck OK. **be:test: 479 files passed / 2 failed / 2 skipped; 7070 tests passed, 5 failed (exactly the 5 allowed local failures: 4 × `migrate-cli.spec.ts` and `pg-source.spec.ts` "a failed connection…"), 5 expected fail, 6 skipped.** `audit-coverage.spec.ts:38` did not flake (no re-run needed). `be:build`: exit 0 (built separately on the same tree, because `be:verify` stops at the first failing step). |
| Frontend `vue-tsc -b --noEmit` | exit 0, 0 errors. The first run, on a clean checkout before any vite build, failed with 35 errors because the generated `auto-imports.d.ts` and `components.d.ts` (both gitignored) did not exist yet. After one vite build it was clean. Not a defect, but CI must build, or generate those files, before it type-checks. |
| Frontend build | `VITE_API_MODE=http vite build --mode demo`: exit 0. `check-demo-bundle`: OK (3 markers, 525 files). |
| Frontend unit tests | `vitest run --project unit`: **544/544 files**, 9550 passed, 3 expected fail, 4 skipped, 9 todo, 0 failed. |
| `scripts/demo-walkthrough.sh` (read-only) | 102 passed, 0 failed, 5 skipped (the 5 write steps). |
| `scripts/demo-walkthrough.sh` with `CONFIRM_WRITES=1` (local DB, re-seeded afterwards) | **116 passed, 0 failed, 0 skipped: "GO"** |
| `scripts/demo-smoke.sh` | 26 passed, 2 failed. Both failures are local-only (section 6). |

## 5. UAT `docs/qa/uat-demo-23oct.md` (#115) at 375 / 768 / 1280

Read-only steps ran at all three widths. Write steps (create class, add pupil, sit and submit a paper, publish a paper, cross-role flows) ran once, at 1280. A step's overall result is its worst width.

### 5.1 Summary

| Role | Steps | Pass | Fail | of which copy only | Blocked (by-design gap) |
|---|---|---|---|---|---|
| Murid | 28 | 22 | 6 | 3 | 0 |
| Guru | 14 | 5 | 8 | 7 | 1 |
| Admin sekolah | 11 | 9 | 2 | 2 | 0 |
| Ibu bapa | 5 | 4 | 0 | 0 | 1 |
| Admin Pusat | 16 | 11 | 5 | 4 | 0 |
| Cross-role C-01..C-05 | 5 | 2 | 2 | 0 | 1 |
| Responsive RES-01..07 | 7 | 7 | 0 | 0 | 0 |
| **Total** | **86** | **60** | **23** | **16** | **3** |

Of the 23 FAILs, 16 are copy only: a subtitle or label in the script that the screen does not show, or shows reworded. The screens themselves work (D-15). The other 7 FAILs are functional and are listed below.

| Step | Defect |
|---|---|
| MUR-14 | D-02 |
| MUR-20 | D-03 |
| MUR-24 | D-05 |
| GUR-04 and C-01 | D-01 |
| C-02 | D-04, an error in the script |
| ADM-10 | D-12c |

Cross-role results:
- **C-03** (Admin Pusat publishes a paper, then the murid sees it and it disappears after "Tarik balik"): PASS.
- **C-04** (murid invites a parent, the parent accepts): PASS, with D-05.
- **C-01**: PASS once the class was created through the API with a string `subjectId`. Join by code and the teacher seeing the pupil both work.
- **C-05**: Blocked by design (J-05).

### 5.2 Results per step

Screenshots are named `<step>-<width>.png`. They are kept in the rehearsal session's scratch folder and are not committed. Ask AZ-Dev3 for any you need. A blank cell means the result is in the row's note; `n/a` means a write step that ran only at 1280.

**Murid**

| ID | Step | 375 | 768 | 1280 | Note | Screenshot |
|---|---|---|---|---|---|---|
| UAT-MUR-01 | Login page | FAIL | FAIL | PASS | copy only (D-15) | UAT-MUR-01-375.png |
| UAT-MUR-02 | Wrong password | PASS | PASS | PASS |  |  |
| UAT-MUR-03 | Inactive / suspended login | PASS | PASS | PASS |  |  |
| UAT-MUR-04 | Login as murid | PASS | PASS | PASS |  | dash-murid-375.png |
| UAT-MUR-05 | Bijak tabs/list | PASS | PASS | PASS |  |  |
| UAT-MUR-06 | Paper cover page | PASS | PASS | PASS |  |  |
| UAT-MUR-07 | Start exam mode + answer | n/a | n/a | PASS |  | RES02-attempt-375.png |
| UAT-MUR-08 | Reload resumes attempt | n/a | n/a | PASS |  |  |
| UAT-MUR-09 | Submit dialog | n/a | n/a | PASS |  | UAT-MUR-09-1280.png |
| UAT-MUR-10 | Result screen | n/a | n/a | PASS |  | UAT-MUR-10-1280.png |
| UAT-MUR-11 | Sejarah Bijak SPM | PASS | PASS | PASS |  |  |
| UAT-MUR-12 | SPM hub | PASS | PASS | PASS |  |  |
| UAT-MUR-13 | Latih Tubi list | PASS | PASS | PASS |  |  |
| UAT-MUR-14 | Config + start quiz | n/a | n/a | FAIL | D-02 | UAT-MUR-14-1280.png |
| UAT-MUR-15 | Soalan by Chapter | PASS | PASS | PASS |  |  |
| UAT-MUR-16 | Zona Permainan | PASS | PASS | PASS |  |  |
| UAT-MUR-17 | Five solo games | PASS | PASS | PASS |  |  |
| UAT-MUR-18 | Roda Nasib/Jutawan/Pertandingan/Uji Minda | PASS | PASS | PASS |  |  |
| UAT-MUR-19 | Sambung Kata 500 page | PASS | PASS | PASS |  |  |
| UAT-MUR-20 | Papan Bijak / Battle | n/a | n/a | FAIL | D-03 | J13-battle-quickmatch-1280.png |
| UAT-MUR-21 | Syiling & Token | PASS | PASS | PASS |  |  |
| UAT-MUR-22 | Kelas Saya | FAIL | FAIL | FAIL | copy only (D-15) |  |
| UAT-MUR-23 | Prestasi | PASS | PASS | PASS |  |  |
| UAT-MUR-24 | Jemput Ibu Bapa | PASS | PASS | FAIL | D-05 | MUR-24b-1280.png |
| UAT-MUR-25 | /bilik-duta | PASS | PASS | PASS |  |  |
| UAT-MUR-26 | /dashboard | PASS | PASS | PASS |  |  |
| UAT-MUR-27 | Profil + Tetapan | FAIL | FAIL | FAIL | copy only (D-15) |  |
| UAT-MUR-28 | Log Keluar | PASS | PASS | PASS |  |  |

**Guru**

| ID | Step | 375 | 768 | 1280 | Note | Screenshot |
|---|---|---|---|---|---|---|
| UAT-GUR-01 | Login guru | FAIL | FAIL | FAIL | copy only (D-15) | dash-guru-375.png |
| UAT-GUR-02 | Dashboard content | PASS | PASS | PASS |  |  |
| UAT-GUR-03 | Kelas Saya | FAIL | FAIL | FAIL | copy only (D-15) |  |
| UAT-GUR-04 | Create class | n/a | n/a | FAIL | D-01 | UAT-GUR-04-after-1280.png |
| UAT-GUR-05 | Pelajar Saya | FAIL | FAIL | FAIL | copy only (D-15) |  |
| UAT-GUR-06 | Prestasi Kelas | PASS | PASS | FAIL | D-04 (script) | UAT-GUR-06-1280.png |
| UAT-GUR-07 | Headcount | PASS | PASS | PASS |  |  |
| UAT-GUR-08 | Analitik / Analisa Item | PASS | PASS | PASS |  |  |
| UAT-GUR-09 | Command Center guru | PASS | PASS | PASS |  |  |
| UAT-GUR-10 | Monitoring/Kirkpatrick/Laporan | FAIL | FAIL | FAIL | copy only (D-15) |  |
| UAT-GUR-11 | Sumbang Soalan | FAIL | FAIL | FAIL | copy only (D-15) |  |
| UAT-GUR-12 | Laporan Mingguan | BLOCKED | BLOCKED | BLOCKED | by design (J-gap) |  |
| UAT-GUR-13 | Profil/Tetapan/Panduan/Tiket | FAIL | FAIL | FAIL | copy only (D-15) |  |
| UAT-GUR-14 | Log Keluar | PASS | PASS | PASS |  |  |

**Admin sekolah**

| ID | Step | 375 | 768 | 1280 | Note | Screenshot |
|---|---|---|---|---|---|---|
| UAT-ASK-01 | Login + dashboard | PASS | PASS | PASS |  | dash-adminsekolah-375.png |
| UAT-ASK-02 | Performance panel | PASS | PASS | PASS |  |  |
| UAT-ASK-03 | Senarai Pelajar | PASS | PASS | PASS |  |  |
| UAT-ASK-04 | Add pupil | n/a | n/a | FAIL | D-15 |  |
| UAT-ASK-05 | Senarai Guru | FAIL | FAIL | FAIL | copy only (D-15) |  |
| UAT-ASK-06 | Kelas Sekolah | PASS | PASS | PASS |  |  |
| UAT-ASK-07 | Reports | PASS | PASS | PASS |  |  |
| UAT-ASK-08 | Amaran Awal | PASS | PASS | PASS |  |  |
| UAT-ASK-09 | Other school screens | PASS | PASS | PASS |  |  |
| UAT-ASK-10 | /admin/users blocked | PASS | PASS | PASS |  |  |
| UAT-ASK-11 | Log Keluar | PASS | PASS | PASS |  |  |

**Ibu bapa**

| ID | Step | 375 | 768 | 1280 | Note | Screenshot |
|---|---|---|---|---|---|---|
| UAT-IBU-01 | Parent login | PASS | PASS | PASS |  | RES05-parent-landing-375.png |
| UAT-IBU-02 | Parent /dashboard, /spm/bijak | PASS | PASS | PASS |  |  |
| UAT-IBU-03 | Accept invite | n/a | n/a | PASS |  |  |
| UAT-IBU-04 | Lihat Profil Kemajuan | n/a | n/a | BLOCKED | by design (J-gap) |  |
| UAT-IBU-05 | Parent logout | PASS | PASS | PASS |  |  |

**Admin Pusat**

| ID | Step | 375 | 768 | 1280 | Note | Screenshot |
|---|---|---|---|---|---|---|
| UAT-ADM-01 | Admin login | PASS | PASS | PASS |  | dash-admin-375.png |
| UAT-ADM-02 | Sidebar menu | PASS | PASS | PASS |  |  |
| UAT-ADM-03 | Command Center + Aktiviti Harian | FAIL | FAIL | FAIL | copy only (D-15) |  |
| UAT-ADM-04 | Monitoring/Kirkpatrick T1-T4 | PASS | PASS | PASS |  |  |
| UAT-ADM-05 | Pengguna | PASS | PASS | PASS |  |  |
| UAT-ADM-06 | Sekolah | FAIL | FAIL | FAIL | copy only (D-15) |  |
| UAT-ADM-07 | Bank Soalan | PASS | PASS | PASS |  |  |
| UAT-ADM-08 | Pembina Kertas | FAIL | FAIL | FAIL | copy only (D-15) |  |
| UAT-ADM-09 | New paper + add questions | n/a | n/a | PASS |  | UAT-ADM-09-1280.png |
| UAT-ADM-10 | Publish | n/a | n/a | FAIL | D-12c | UAT-ADM-10-1280.png |
| UAT-ADM-11 | Muat Naik + Senarai Ekstrak | FAIL | FAIL | FAIL | D-06, D-15 |  |
| UAT-ADM-12 | Semakan / Bank SPM / Manual | PASS | PASS | PASS |  |  |
| UAT-ADM-13 | Langganan/Komplimen/PKSK | PASS | PASS | PASS |  |  |
| UAT-ADM-14 | Tiket | PASS | PASS | PASS |  |  |
| UAT-ADM-15 | Masuk Mod Pelajar | n/a | n/a | PASS |  |  |
| UAT-ADM-16 | Log Keluar | PASS | PASS | PASS |  |  |

**Aliran silang**

| ID | Step | 375 | 768 | 1280 | Note | Screenshot |
|---|---|---|---|---|---|---|
| C-01 | Guru creates class, murid joins, guru sees murid | n/a | n/a | FAIL | D-01 | C-01b-1280.png |
| C-02 | Murid submits Bijak, guru + admin sekolah see result | n/a | n/a | FAIL | D-04 (script) | C-02b-guru-1280.png |
| C-03 | Admin publishes paper, murid sees it | n/a | n/a | PASS |  | C-03b-1280.png |
| C-04 | Murid invites parent, parent accepts | n/a | n/a | PASS | D-05 | C-04b-1280.png |
| C-05 | Parent sees child result | n/a | n/a | BLOCKED | by design (J-gap) |  |

**Responsif**

| ID | Step | 375 | 768 | 1280 | Note | Screenshot |
|---|---|---|---|---|---|---|
| UAT-RES-01 | Murid /spm/bijak + /dashboard | PASS | PASS | PASS |  | dash-murid-375.png |
| UAT-RES-02 | Murid /permainan + attempt screen | PASS | PASS | PASS |  | RES02-attempt-375.png |
| UAT-RES-03 | Guru /guru | PASS | PASS | PASS |  | RES03-guru-375.png |
| UAT-RES-04 | Admin sekolah /admin-sekolah | PASS | PASS | PASS |  | RES04-adminsekolah-375.png |
| UAT-RES-05 | Ibu bapa blocked page + invite page | PASS | PASS | PASS |  | RES05-invite-visitor-375.png |
| UAT-RES-06 | Admin Pusat /admin/command-center | PASS | PASS | PASS |  | RES06-admin-375.png |
| UAT-RES-07 | Public /login | PASS | PASS | PASS |  | RES07-login-375.png |

**Extra focus**

| ID | Check | 375 | 768 | 1280 | Note | Screenshot |
|---|---|---|---|---|---|---|
| GAME-betul-salah | Betul atau Salah | PASS | PASS | PASS |  |  |
| GAME-cabaran-kilat | Cabaran Kilat | PASS | PASS | PASS |  |  |
| GAME-tembak-jawapan | Tembak Jawapan | PASS | PASS | PASS |  |  |
| GAME-susun-jawapan | Susun Jawapan | PASS | PASS | PASS |  |  |
| GAME-kad-memori | Kad Memori | PASS | PASS | PASS |  |  |
| EXTRA-D1D4-practice | D1-D4 practice random (specific Darjah) | n/a | n/a | FAIL | D-02 |  |
| J04-spm-hub | /spm hub | PASS | PASS | PASS |  |  |
| J04-databank | Databank Soalan SPM | PASS | PASS | PASS |  |  |
| J04-latih-tubi | Latih Tubi SPM | PASS | PASS | PASS |  |  |
| J04-tracking-a | Tracking A | PASS | PASS | PASS |  |  |
| J04-subjektif | Subjektif | PASS | PASS | PASS |  |  |
| J04-history | Sejarah Kuiz SPM | PASS | PASS | PASS |  |  |
| J04-databank-play | Databank quiz starts | n/a | n/a | PASS |  |  |
| J03-intake-upload | Admin: PDF upload (real PDF) | n/a | n/a | FAIL | D-06 |  |
| J03-intake-sample | Admin: sample extraction | n/a | n/a | PASS |  |  |
| J13-battle-quickmatch | Battle quick match | n/a | n/a | FAIL | D-03 |  |
| J13-papanbijak-quickmatch | Papan Bijak lobby | n/a | n/a | PASS |  |  |
| J07-chat-notif | Chat / notifikasi | n/a | n/a | PASS |  |  |
| J16-guruadmin-role-switch | guruadmin role switch | n/a | n/a | PASS |  |  |

### 5.3 Demo-critical new parts (from this batch)

| Area | Result |
|---|---|
| Five solo games (#105 + #134 + #129) | All five are playable at 375, 768 and 1280, each through to its result card:<br>- Betul atau Salah: 40 statements, 23/40, "LEGENDA!".<br>- Cabaran Kilat: 11/30.<br>- Tembak Jawapan: level 1.<br>- Susun Jawapan: 20 items.<br>- Kad Memori: 12 cards / 6 pairs, all matched in 39 moves.<br>The Darjah 1–6 / Tingkatan picker is shown. No "belum tersedia" blocker. |
| D1–D4 pool (#129) | Matematik Darjah 1–4: 24 questions each. The solo games serve D1 items, and Kad Memori faces come from D1–D4 Sains/PI/PM. Practice with **"Semua Tahap"** starts and finishes. Practice with **a specific Darjah fails (D-02)**. |
| SPM hub (#126) | `/spm`, Databank, Latih Tubi SPM, Tracking A, Subjektif and Sejarah Kuiz SPM all load with real data. A Databank quiz starts (`/spm/tahun-lepas/MATH/quiz`). |
| Intake review (#131) | All five load:<br>- Muat Naik Kertas<br>- Senarai Ekstrak<br>- Baris Gilir Semakan<br>- Bank Soalan SPM (445)<br>- Tulis Soalan Manual<br>"Cuba dengan kertas contoh" creates a batch (`POST /api/intake/batches` 201) and opens its review page. A real PDF upload fails on Chromium 141 (D-06). |
| Bijak SPM sitting | Start → answer → reload resumes the same attempt with its clock → submit dialog → result 4/21 → Sejarah lists it. PASS. |
| Pembina Kertas | New paper, 10 questions added, "Sepadan dengan blueprint", publish, the pupil sees it, withdraw. PASS. There is no delete control (D-12c). |

### 5.4 Known gaps J-01..J-16 on this build

| ID | Status now | Evidence |
|---|---|---|
| J-01 Kad Memori D1–D4 = 0 | **CLOSED** (#129) | 12 cards, 6 pairs; result card reached |
| J-02 solo games blocked in http | **CLOSED** (#105) | all five playable |
| J-03 intake review in http | **CLOSED for the screens** (#131) | The PDF upload part is D-06 |
| J-04 SPM hub in http | **CLOSED** (#126) | hub and 5 sub-screens with data |
| J-05 parent out of scope | by design, unchanged | "Belum tersedia dalam prototaip"; `/spm/bijak` gives a 403 page |
| J-06 murid lands on `/spm/bijak` | by design, unchanged | `/dashboard` reachable with data |
| J-07 Chat / bell hidden | by design, unchanged | |
| J-08 Laporan Mingguan | by design, unchanged | The page is "403 - Akses Ditolak", not "Belum tersedia" (script copy) |
| J-09 murid Headcount 403 | by design, unchanged | |
| J-10 no `/admin` dashboard | by design, unchanged | |
| J-11 Sambung Kata 500 | by design, unchanged | |
| J-12 empty states | partly changed | Papan Pendahulu, Soalan Aku Salah and the daily missions now have rows. The rest are still empty states, never errors. |
| J-13 Papan Bijak / Battle UI | **still open** | The Papan Bijak lobby works. Battle Quick Match fails (D-03). |
| J-14 login 5/min | not verifiable here | throttle raised locally |
| J-15 runbook says admin Bijak has no http client | still open (doc) | `docs/ops/demo-cloudflare-supabase.md:306` |
| J-16 `guruadmin` role switch on UI | not verifiable | There is no role switcher in the UI. The API switch passes in the walkthrough. |

## 6. Smoke script: the two local-only failures

`scripts/demo-smoke.sh` on the local stack gives 26 passed, 2 failed. Neither failure applies to the demo:
1. "`/api` cache-control no-store missing": on the demo, `Cache-Control: no-store` comes from the edge (`functions/api/[[path]].ts`, `docker/frontend/nginx.conf`). The local `vite preview` proxy has no edge layer.
2. "spoofed X-Forwarded-For changed the throttle key": locally `TRUST_PROXY_HOPS=1` with no edge rewriting `X-Forwarded-For`, and the login throttle is raised, so the check cannot hold. On the demo the edge overwrites the header.

## 7. Defects

Owner half is the half that owns the code. "PR to blame" is the PR in this batch that introduced the defect, or "none" when it is already on the tip.

| ID | Sev | Steps | Defect | Owner half | PR to blame | Evidence |
|---|---|---|---|---|---|---|
| D-01 | **High** | GUR-04, C-01 | **Teacher "Cipta Kelas" cannot save.**<br>- `POST /api/guru/classes` returns 422 "Sila pilih subjek." (`fields.subjectId`), because the SPA sends `subjectId` as a number. The contract (`ClassCreateRequestSchema`) uses string ids. The same body with `"3"` returns 201.<br>- File: `src/modules/m10-teacher-class/api/guru.ts` and the create form. | AZ (frontend http adapters) | none (on `d909e1e0`) | UAT-GUR-04-after-1280.png |
| D-02 | **High** | MUR-14, D1–D4 extra | **Practice with a specific Tahap Pendidikan never starts.**<br>- `POST /api/practice/sessions` with `levelId: <number>` returns 422 "Nilai tidak sah." (`fields.levelId`). The contract has `levelId: IdSchema` (string), and with the string id it returns 201.<br>- The SPA then silently returns to the config screen with no message.<br>- File: `src/modules/m05-practice/api/practice.ts` and the config page.<br>- Workaround in the demo: choose "Semua Tahap". | AZ (frontend) | none | EXTRA-D1D4-practice-1280.png |
| D-03 | **High** | MUR-20, J-13 | **Battle Arena Quick Match always errors.**<br>- The API answers 200 `{"queue_id":"1"}` (a string, per the contract test `BattleStartResponseSchema`).<br>- `useBattleSearch.ts:203` rejects anything that is not a number and shows "Ralat sistem: ID giliran tidak sah. Sila cuba lagi."<br>- The same applies to the poll, accept and reject ids typed as `number` in `m16-battle-games/api/battle.ts`.<br>- Workaround: do not show Battle Arena. | AZ (frontend, PC-7) | none | J13-battle-quickmatch-1280.png |
| D-04 | Low | GUR-06, C-02 | **UAT script error, not a product bug.**<br>- C-02 has the pupil sit Matematik and then looks at **Kelas Demo Tingkatan 4**, which is a *Bahasa Melayu* class. `ClassPerformanceService` filters by the class subject, so it rightly shows "Tiada data".<br>- **Kelas Demo Matematik T4** (`DEMO4M`) shows the Bijak figures: 15 sessions and 57.9% from the API before the UAT.<br>- Fix #115: point C-02 / GUR-06 at `DEMO4M`. | AZ (QA, #115) | #115 | C-02b-guru-1280.png |
| D-05 | Medium | MUR-24, C-04 | On first visit to `/jemput-ibu-bapa` (`hasToken=false`), the link, "Salin" and the WhatsApp link all end in `/ibu-bapa/terima/undefined`. "Jana Link Baru" fixes it. | AZ (frontend m01) | none | MUR-24b-1280.png |
| D-06 | Medium | ADM-11, J-03 | A real PDF upload fails before any request with "Pengekstrakan gagal: this[#t].getOrInsertComputed is not a function". `pdfjs-dist` 6.4.299 calls `Map.prototype.getOrInsertComputed`, which Chromium 141 lacks. Not verified on a current Chrome or Edge. Before the demo, try one upload on the demo laptop's browser, or demo the "kertas contoh" path. | AZ (frontend m28) | none (dependency already on `d909e1e0`) | J03-after-submit-1280.png |
| D-07 | Medium | MUR-21 | Cabaran Harian progress stays at 0 after four finished quizzes. | AZ | none | |
| D-08 | Medium | MUR-21 | Papan Pendahulu is not sorted by syiling, and an admin account appears on the pupil board. | AZ | none | |
| D-11 | Medium | GUR-10 | The teacher's `/guru/monitoring` is titled "… - Admin" and has a national Negeri filter. Teacher Kirkpatrick lists all 4 schools. This is a possible scope leak; to triage. | AZ | none | |
| D-09 | Low | all | Some icons are fetched at runtime from `api.iconify.design` and similar hosts. They fail offline and under a strict CSP. | AZ | none | |
| D-10 | Low | MUR-17 @375 | Tembak Jawapan: the tile text wraps mid-word, and the Alesa button covers "GARIS MAUT". | AZ (PC-7) | #105 area | GAME-tembak-jawapan-end-375.png |
| D-12 | Low | various | (a) The Latih Tubi card says Matematik 152, but the config offers only Darjah 1–4 (96) to a Tingkatan 4 pupil. (b) A teacher-created class has `schoolId` null, so it is missing from Kelas Sekolah. (c) There is no "Padam kertas" in Pembina Kertas. (d) `GET /api/admin/config/defaults` returns 404 on admin user create/edit. | AZ | none | |
| D-13 | Low | MUR-17 | Solo games award 0 syiling on every result card. Confirm whether this is the rule. | AZ (PC-7) | none | |
| D-14 | Low | ASK-01 | School dashboard: "Jumlah Guru" is 4, but Senarai Guru has 3. | AZ | none | |
| D-15 | Low | 16 steps | Copy drift between the UAT script and the screens: subtitles not shown or reworded, ASK-04 shows a generated password instead of a password field, and some route names. Update #115 (the screens work). | AZ (QA, #115) | #115 | |

No defect is owned by half AM. No Critical defect was found.

## 8. Recommended merge order for the LEAD

The batch merges with no code conflicts and stays green (sections 3 and 4). There are only three doc conflicts, all append-at-end of `docs/architecture/v2-backend-deviations.md`.

**Backend into `feature/v2-backend`:**
1. #121, #129 (at `9e0ab958`, after AZ-Dev4's re-review of the content delta), #132, #137. Any order; all clean.
2. #134 (the Kad Memori reveal is demo-critical).
3. #135, then #127. Each needs its author to merge the new base and keep both rows/sections (append-only; put the table rows above the `## AZ-13` section) before its SEDIA MERGE head is re-pinned.
4. Docs/ops #112, #115, #116, #117, #118, #119. All clean, any order. #115 should take the D-04 and D-15 script fixes first, or in a follow-up.
5. After #129 merges: re-run the PoC seed on the demo DB. The seed never updates existing rows; the fixed D1–D4 content needs a fresh seed or a reseed (`docs/ops/demo-reseed.md`).

**Frontend into `be/integration-frontend`:**
1. #120.
2. #126 and #128. Their base is `fe/sync-backend-2b0a9445` (#120's head). Retarget them to `be/integration-frontend` once #120 is in.
3. #131.
4. #105 last, at `063eca04` or newer (rehearsed in section 3.3). Its author merges the new base first (append conflict with #120 in the deviations doc).

**Before the demo, separately from this batch:** fix D-01, D-02 and D-03 (one small frontend PR: string ids per the contract), or keep "Cipta Kelas", specific-Darjah practice and Battle Arena out of the demo script. D-05 and D-06 have workarounds (press "Jana Link Baru" first; use "kertas contoh").

## 9. Follow-up

The rehearsal re-runs on each LEAD merge batch until 23 Oct 06:00 MYT. Only the deltas are posted on #113.
