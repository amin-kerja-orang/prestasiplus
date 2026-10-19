# Cross-module logic review — XL-R10, M25 Heatmap Topik Lemah (round 1)

| Field | Value |
|---|---|
| Scope | M25 URS v1.2 and SRS v1.2 (G1 approved, 2026-10-03) against the code and docs it reads: M03 (`curriculum.chaptersByIds`, `curriculum.subject(s)`, `GET /api/subjects`), M05 (`practice.answers(userId)`, seed of the admin log), M04 (question chapter links), M06 (provisional `GET /api/duta/recommendations`, owner M24), M08 (S6, kept separate, DV-M25-07), M01 (guards, role homes), shell `src/shells/nav/user-nav.ts` (F-19b), `docs/architecture/build-plan.md` §2.20 and §2.21 (M25-T1 / T2, F-31b) and the M25 stub in `src/modules/m25-ai-centre`. |
| Method | Read-only on code and requirement docs. SRS and URS read in full. Code read at the cited lines. **Reconciliation run:** a throw-away vitest probe (kept in the scratchpad `xl-r10/`; copied into `src/modules/m25-ai-centre/__tests__/` for the run only, then deleted, `git status` clean for that folder) booted the real mock (M01–M05, project clock) and read `practice.answers(userId)` for users 1–6, grouped by `chapterId`, joined with `curriculum.chaptersByIds`, and counted M04 `Q-CHAPTER` questions for the chapters named in the SRS. |
| Rules applied | CLAUDE.md §6 (D9, D11, D12, the XL gate), the severity scale of the precedent reviews (`cross-module-logic-M01-M07.md`, `-M08-M11.md`, `-M12-M18.md`): **Critical** = an observed live flow cannot complete; **Major** = two approved docs contradict, or a module depends on a contract, record or value its owner does not provide; **Minor** = stale reference, wording, local inconsistency. |
| Date | 2026-10-03 |

## Verdict

**FAIL — 0 Critical, 3 Major, 4 Minor.**

What fits (verified):
- **M03 contract.** `curriculum.chaptersByIds(ids)` exists and returns `{id, name, subjectId}` in the order given, skipping unknown and repeated ids (`src/modules/m03-curriculum/mock/repository/curriculum.ts:412`; test `student-handlers.test.ts:390`). All 15 chapter ids of SRS §6.7 A, C, F resolve with exactly the names and subjects the SRS prints: 2, 4, 35, 36, 87, 413, 382 (BM, Sejarah), 1, 143, 136 (Matematik), 12–16 (BM). The names that repeat (2 / 29, 136 / 152) are keyed by id, as the SRS says. `GET /api/subjects` returns the 31 subjects with `order` (BM 1, Matematik 3, Sejarah 5).
- **M05 contract.** `practice.answers(userId, filter = {})` (`practice.ts:1048`) has every filter field optional (`reads.ts:172`) and returns rows with `chapterId`, `subjectId`, `isCorrect`, oldest first. The M25 read model needs nothing else.
- **Pelajarmaju (id 4).** Reproduced exactly from the real seed: chapter 1 = 23 / 19, 143 = 7 / 3, 136 = 7 / 4, Σ 37 / 26, no chapterless answer. Percents 83 / 43 / 57 and the order 43, 57, 83 hold (R09, E2E-14).
- **Pelajar 2 (id 3), Guru (5), Ibubapa (6).** 0 answers, so the empty state (E2E-17) holds.
- **Fixtures `m25-bands` / `m25-ties`.** Chapters 12–16 exist, and each has 177–202 M04 questions, enough for `mock.addAnswer`. The arithmetic holds: 159 / 200 = 79.5 rounds half up to 80 (green), 79 / 100 is amber, and the order by accuracy 0.40, 0.50, 0.79, 0.795, 0.80 is as printed.
- **M06 Duta contract.** The handler is registered in the M06 plugin (`m06-spm/mock/index.ts:40`), needs only a session, and the three `bintang` records match SRS §6.7 E field for field (slugs, initials, taglines, subjects, states, ratings 4.92 / 4.88 / 4.80). `cikgu-demo-inspirasi` and `-tetamu` are never picked (`duta.ts:24`). With no `subject` and no `seed` the pick uses the seedable stream `ctx.prng.stream('m06.duta')`, so AC-08.6 holds.
- **Guards.** `decideAccess` (`src/app/router/guards.ts`) implements `roles` + `onForbidden: 'landing'` (redirect to the role home) and `'403'`. Admin is allowed on S1, the other six roles are redirected, a guest goes to `/login`. M08 S6 is untouched by M25 (no shared store, no read of its list).
- **Links.** `/buku-nota/heatmap`, `/practice/chapter` (M05 S4), `/latih-tubi` (M05 / M06 route), `/bilik-duta/{slug}` (M24, global 404 until built, stated in the SRS), `/login`, `/` resolve to an owned route or the documented global 404. `/heatmap-topik-lemah` is correctly left unregistered. The M25 stub (`index.ts`, `routes.ts`, `mock/index.ts`) is in place (F-31b); it has no routes, no hooks and no exports yet, which M25-T1 / T2 fill.

| Severity | Count |
|---|---|
| Critical | 0 |
| Major | 3 |
| Minor | 4 |
| **Total** | **7** |

**Build impact.** M25-T1 and M25-T2 are blocked for the admin figures (XL-R10-01) and for the fixture E2E (XL-R10-03). The pelajarmaju and empty-state paths can be built now.

---

## 1. Reconciliation result (script output)

Actual state of the shared mock at the project clock (probe, 2026-10-03):

| User | Total answers / correct | With chapter link | Chapterless | Result against SRS §6.4 / §6.7 |
|---|---|---|---|---|
| 1 admin | 119 / 46 | 35 = 18 / 8, 2 = 10 / 8, 36 = 5 / 3, 4 = 2 / 1 (Σ 35 / 20) | **84 / 26** (BM 44, Sejarah 40) | **FAIL.** Expected 6 cells (87, 413, 35, 36, 2, 382), Σ 116 / 45, hidden 3 / 1. Actual: 3 cells (35, 2, 36; Σ 33 / 19), hidden 86 / 27 |
| 2 pelajar | 94 / 70 | none | 94 / 70 | Empty state (SRS §6.7 D allows it: "only what the question links give"; no E2E asserts it) |
| 3 pelajar2 | 0 / 0 | none | 0 | PASS (empty state) |
| 4 pelajarmaju | 37 / 26 | 1, 143, 136 | 0 | **PASS**, 3 cells Σ 37 / 26 |
| 5 guru, 6 ibubapa | 0 / 0 | none | 0 | PASS (not admitted) |

M04 questions linked to the chapters of the missing cells: chapter 87 = 0, 382 = 0, 413 = 0 (chapters 2, 4, 35, 36, 12–16 have 177–321). The totals 119 / 46 agree with M05, so the log is intact. Only the chapter links of the A2–A5 answers are missing.

---

## 2. Findings

### XL-R10-01 — Major — owner M05 (seed) and M04 (anchors): the admin's A2–A5 answers carry no chapter link, so S1 shows 3 cells instead of 6

- **Evidence.** SRS §6.4 Q-M25-HM-ROWS / CELLS / HIDDEN (lines 176–178), §6.7 A and B (lines 213–237), XR-M25-02 (b) and XR-M25-03 (line 260–261) require the A2 (SEJ ×40), A3 (BM 33 of 34), A4 (BM ×5) and A5 (BM ×5) answers to link to chapters 382, 413, 413 and 87. The probe finds 84 chapterless admin answers (BM 44 = 34 + 5 + 5, Sejarah 40) and no M04 question in chapters 87, 382 or 413. Neither the M05 nor the M04 SRS mentions M25 (grep: 0 hits), so the requests are not applied and not accepted.
- **Impact.** E2E-M25-04 (admin six cells), 12, 13, 16, 22, 23, 24, 25 and the smoke "canonical admin (6 cells, attempts 116)" of M25-T2 cannot pass. E2E-M25-25 and -24 also need `mock.addAnswer` on a question of chapter 87 and the D2 chapter, and chapter 87 has no question.
- **Fix.** M04: contribute through `questions.contributeAnchors('M05', rows)` the 40 + 38 + 5 SPM-pool question rows with `curriculumChapterId` 382, 413, 87 (and one BM row with null), each replacing a generated row so no total moves, and confirm capacity. M05: pin the A2–A5 answers to those question ids so that BM T5 = 38 / 12, BM T4 = 5 / 0, SEJ T5 = 40 / 14, totals 119 / 46 unchanged; add the M05 test (`practice.answers(1)` grouped by chapter = the §6.7 A table). Record both in the M04 and M05 SRS change logs (XR-M25-02 b, 03). Tests must be re-run through `registry-boot.test.ts` (shared mock data, worktree rule). Do not change any M25 figure.

### XL-R10-02 — Major — owner solution-architect (build-plan §2.20 / §2.21, M25): the build plan contradicts the approved M25 v1.2 on role access and on blocking contracts

- **Evidence.** `docs/architecture/build-plan.md:1387`: "any signed-in role may open it", "SRS v1.0 (Draft)". SRS FR-M25-07, BR-M25-01, §9, XR-M25-06 (v1.2): student and admin only, the other six roles redirected, API #1 answers 403. Same file, lines 1402 and 1421: M05 `chapterAggregates` is a "Blocker for M25-T1", and "Route meta, any role (XR-M25-06)" (line 1405). v1.1 of the SRS re-scoped that to the existing `practice.answers` (XR-M25-02 a, "Could, not blocking"). Line 1403: `curriculum.chaptersByIds` "No", but it exists (`curriculum.ts:412`). Line 1421 (L19) repeats "two missing contracts … and the Draft SRS". M25-T1 scope (line 1393) lists no role guard on handler #1 and no 403.
- **Impact.** A builder following the plan would build an any-role route (fails E2E-M25-04) and wait for a method that is not required.
- **Fix.** Update §2.20 and the L19 row to SRS v1.2: G1 approved, student + admin gate (route meta `roles: ['student','admin']`, `onForbidden: 'landing'`; handler #1 `requireRole` → 403), read through `practice.answers`, `chaptersByIds` exists, the only open blockers are XL-R10-01 and -03 and F-19b. Add the M01 route meta to M25-T2.

### XL-R10-03 — Major — owner M25 (build-plan M25-T1 scope): the test hook `mock.loadFixture('m25-bands' | 'm25-ties')` has no owner and does not exist

- **Evidence.** SRS §6.9 (line 270) and §6.7 F define `mock.loadFixture(...)`; E2E-M25-15 and -26 use it. A search of `src/`, `e2e/` and `docs/architecture/` finds no `loadFixture` anywhere (`e2e/fixtures/mock-handle.ts` has no such method). Build-plan M25-T1 (line 1393) lists the repository, handler, named queries and client, but no hook; M05 owns only `addAnswer`, `answerChapter`, `addSession` (`hooks/index.ts`). The `m25-ai-centre/mock/index.ts` stub registers no hooks.
- **Impact.** E2E-M25-15 and -26 (provisional) cannot run, and nothing says who writes the fixtures. The question ids for chapters 12–16 are available (177–202 each), but a fixture of 200 answers in chapter 15 must pick them.
- **Fix.** Add to M25-T1: register the hook `loadFixture` in the M25 plugin, built on `practice.addAnswer` with M04 `Q-CHAPTER` question ids (repeat a question when a chapter has fewer than the needed answers, if M05 allows it), dev / test builds only; add it to `e2e/fixtures/mock-handle.ts` (shared file: through the owner of the handle). State that it must not run with the observed-figure checks.

### XL-R10-04 — Minor — owners M03, M05, M01, M08: the M25 requests are not recorded in the owner SRS

- **Evidence.** `grep "M25|chaptersByIds"` in the M01, M03, M04, M05, M08 SRS: 0 hits. `curriculum.chaptersByIds` is in the M03 code (comment "M25 XR-M25-04") but not in the M03 SRS §7 or §6.10 repository contract. M05 §7.2 still prints `AnswerFilter {date}` as required (XR-M25-02 a, XR-M14-13 b). XR-M25-06 (route meta for `/buku-nota/heatmap`, role list) and XR-M25-08 (M08 confirmation) are not acknowledged.
- **Fix.** One line in each owner's change log: M03 documents `chaptersByIds`; M05 prints `date?` as optional and accepts XR-M25-02; M01 adds the route to its role table; M08 confirms S6 stays separate.

### XL-R10-05 — Minor — owner M06 / M24: SRS #21 does not state the `null` answer

- **Evidence.** M06 SRS line 371: response `200 {data: DutaCard}`, auth `A`. The handler returns `ok(null)` when no `bintang` record is active (`duta.ts:27`), and M25 FR-M25-25, §7 #2 and E2E-M25-20 rely on "none → block absent". M25 §7 also writes auth `U`.
- **Fix.** M06 SRS #21: response `DutaCard | null`, and say that with no `subject` and no `seed` the pick is the seedable stream.

### XL-R10-06 — Minor — owner shell (F-19b): the F-19b scope is narrower than XR-M25-01, and a later `/buku-nota` href would double the active item

- **Evidence.** Build-plan F-19b (lines 198–201) changes only the Heatmap href. XR-M25-01 also asks for the active item and the header title / subtitle (b) and flags `buku-nota-saya` → `/buku-nota-saya` (c). `user-nav.ts:297` still holds `to: '/heatmap-topik-lemah'` and `:293` `to: '/buku-nota-saya'`, expected until F-19b runs. `isActivePath` (`user-nav.ts:701`) is a prefix rule: if (c) is applied and "Buku Nota Saya" becomes `/buku-nota`, both items are active on `/buku-nota/heatmap` unless `except: ['/buku-nota/heatmap']` is set.
- **Fix.** F-19b: set `to: '/buku-nota/heatmap'`; if (c) is applied, give "Buku Nota Saya" the `except`; add the nav test row. The header text comes from the route meta in M25-T2 (state it in the task).

### XL-R10-07 — Minor — owner solution-architect / M25: the smoke names "account 2" for the empty state, but the SRS uses Pelajar 2 (id 3)

- **Evidence.** Build-plan line 1394 "as account 2 (empty state)"; SRS §6.7 D and E2E-M25-17 use **id 3 (pelajar2)**, while **id 2 (pelajar)** has 94 chapterless answers. The probe shows both give the empty state today, so the smoke passes by luck; once M04 links P1–P4 questions to chapters (OQ-M25-09), id 2 gets cells.
- **Fix.** Write "Pelajar 2 (id 3)" in M25-T2.

---

## 3. Role and flow check

| Role | S1 | API #1 | Code basis |
|---|---|---|---|
| admin | opens, own data | 200 | `meta.roles` includes admin; M01 landing `/admin` unaffected |
| student | opens | 200 | menu item `roles: S` (`user-nav.ts:297`), shown only to the student |
| guru, ibu_bapa, penaja, school_admin, ppd_officer, jpn_officer | redirect to the M01 role home | 403 | `decideAccess` + `onForbidden: 'landing'`; `requireRole` for the API |
| guest | `/login` | 401 | `access: 'auth'` |

E2E flows: 30 scenarios; 28 are runnable once XL-R10-01 and XL-R10-03 are fixed. E2E-M25-21 and the "click the card" flow end on the global 404 until M24 exists, as the SRS states. No M25 flow writes data, and none touches M08.
