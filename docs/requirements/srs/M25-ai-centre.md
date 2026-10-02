# M25 — AI Centre (Pusat AI), partial: student screen "Heatmap Topik Lemah" — Software Requirements Specification

## 0. Document control

| Field | Value |
|---|---|
| Document | SRS — M25 AI Centre (Pusat AI), **partial**: the student screen "Heatmap Topik Lemah" (`/buku-nota/heatmap`, Release 1.0). The other M25 screens are appended in later versions (IDs are appended, never renumbered) |
| Version | 1.2 |
| Date | 2026-10-03 |
| Status | **Approved (G1)**, user decision 2026-10-03 (v1.1 as written, DV-M25-06, the SERVER empty-state message; v1.2 = G1 closure and role gate). Scope: **"Heatmap Topik Lemah (Release 1.0)"**. v1.1 applies audit round 1 ([M25-audit.md](../../qa/audit/M25-audit.md)) |
| Author | product-analyst (agent), all sections; §6 data, §7 mock API and §11 are written for review by solution-architect at G2. The check scripts `coverage.cjs` and `trace.cjs` (writer's scratchpad `m25-writer/`, copied to `m25-v11/`) are run by the Delivery Lead |
| Source URS | [urs/M25-ai-centre.md](../urs/M25-ai-centre.md) v1.2 (30 Functions, 10 stories, 39 ACs, coverage 24/24) |
| Source discovery | [R10-release-1-0-screens.md](../../discovery/R10-release-1-0-screens.md) (Heatmap Topik Lemah = R10 S1; the DSKP Heatmap and Laporan Bulanan sections are deferred); inventory and seed snapshot `docs/discovery/inventory/R10/` (`S1-heatmap-topik-lemah.json`, `SHU-user-shell.json`, `_snapshot-2026-09-27.json`, captured 2026-09-27 12:39 MYT); screenshots `docs/discovery/img/R10/heatmap-topik-lemah-*.png` |
| Related (versions read 2026-10-03) | [M01](M01-authentication.md) **v1.16** (guards, role homes, canonical accounts, global 404 / 403), [M02](M02-users-schools.md) **v1.32**, [M03](M03-curriculum.md) v1.10 (DATA-M03-02 Subject, DATA-M03-03 CurriculumChapter), [M04](M04-question-bank.md) **v1.19** (question `curriculumChapterId`, anchors), [M05](M05-practice.md) **v1.20** (DATA-M05-02 QuizAnswer, §6.14 named queries, §6.13 `mock.addAnswer`, §7.2 read contract), [M06](M06-spm.md) v1.4 (DutaCard shape, `GET /api/duta/recommendations`, BR-M06-27, fictitious Duta seeds §6.7), [M08](M08-student-performance.md) **v1.18** (S6 "topik lemah", C2), [M16](M16-battle-games.md) v1.6 (banner), [M21](M21-sponsorship.md) v1.2 (template), M22 / M24 (not yet specified), architecture overview **v1.9** §6.6–§6.7, §6.12 (clock), [design/shells.md](../../design/shells.md) **v1.2.1**, [design/design-system.md](../../design/design-system.md) v1.11 §6; server copy `D:\Dev Projects\prestasiplus-reference\backend` (tag SERVER, D24) |

**Change log**

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-09-30 | First issue (partial M25). 35 FRs, 14 business rules, 1 validation rule, 2 derived read models and no owned store, 4 named queries, 2 mock endpoints (#1 owned, #2 M24's), 30 E2E (every one at 375 / 768 / 1280; 13 provisional), 5 SEC items, 8 owner requests. Reconciliation of every observed figure by hand (§6.5, 11 checks, all pass). The AI rule (no AI call) and D14 applied (§1, BR-M25-12). |
| 1.1 | 2026-10-03 | Audit round 1 applied (AUD-M25-01…08). **01** Cikgu Pakar asserted as a card set (FR-25, BR-M25-09, §6.7 E with the three M06 records, E2E-18 / 19 / 21, new AC-08.6 in E2E-18). **02** avatar = the live `.duta-av` gradient and ring (FR-23, §10.1). **03** role gate SERVER `role:pelajar` (FR-07, BR-M25-01, §9, E2E-04, XR-M25-06). **04** E2E-28 / FR-34 / NFR-07 count the 4 shell calls. **05** versions refreshed. **06** card and pill tokens and the card hover (FR-12, §10.1). **07** chapter ids in §6.7 A / C / F, XR-M25-04, tie-break by id (BR-M25-04). **08** SERVER evidence under OQ-M25-04; empty-state message (FR-20, BR-M25-08, §8.1, E2E-17). **M05 read** re-specified over the existing `practice.answers(userId)`; `practice.chapterAggregates` / `Q-ANS-USER-CHAPTER` do not exist and `practice.chapterStats(userId, chapterId)` is not used (it counts distinct questions): XR-M25-02 re-scoped (§6.1, §6.8). Counts: 35 FRs, 14 BRs, 4 named queries, 2 endpoints, 30 E2E (13 provisional), 5 SEC, 8 XR, 39 ACs in the URS. |
| 1.2 | 2026-10-03 | **G1 closed: Approved, user decision 2026-10-03** (v1.1, DV-M25-06 R1 + R2 minimum 5, SERVER empty-state message kept; OQ-M25-03, 04, 12 closed). **Role gate** (SERVER: `routes/web.php:1251` in the group at `:1111` `['auth', 'role:pelajar']`; `bootstrap/app.php:23` → `EnsureRole`, strict `in_array` l.27, no admin bypass; `homeFor` l.60–62; the l.47–49 403 is admin-subdomain only; no data endpoint): only student and admin (live 200 OBSERVED wins over the reconstruction, D24) open S1; guru, ibu_bapa, penaja, school_admin, ppd_officer, jpn_officer are redirected to their M01 role home; API #1 `403` for them is the rebuild's contract (INFERRED). FR-07, BR-01, E2E-04, §9 updated. No count changes. |

### 0.1 Fidelity deviations referenced here

URS §7 is authoritative. Approved fixes: DV-M25-01 (header title), 03 (round avatar with the live `.duta-av` gradient), 04 (pills at least 12 px), 08 (fictitious M24 card), 09 (menu href). Decision reported at G1: DV-M25-06 (population rule R1 + R2). Rejected — replicate live: DV-M25-02 (cell links to `/practice/chapter`), 05 (legend pill "Belum cuba" without a gray cell), 07 (M08 and M25 keep their own definitions).

---

## 1. Scope

The M25 prototype implements, against the mock service layer, the one screen of URS §1 — **S1 "Heatmap Topik Lemah" at `/buku-nota/heatmap`** — and the removal of the wrong menu href `/heatmap-topik-lemah` (that route renders the global 404 page). M25 owns **no store** (D12): every cell is computed per request through the named queries of §6.4 from the viewer's rows of M05's answer log and the names and order of M03's chapters and subjects, and the Cikgu Pakar card comes from M24's ambassador contract. The screen writes nothing, calls no AI and calls no external host.

**Out of scope:** URS §8 — "DSKP Heatmap" and "Laporan Bulanan" (school admin, deferred), Buku Nota Saya `/buku-nota`, Pusat Nota Ringkas and the rest of the AI Centre, any AI generation or chat, the ambassador record and its page (M24), practice sessions and chapter unlocking (M05), the shell (F-19b for the href), real backend concerns.

---

## 2. Screens & routes

| # | Route | Screen | Primary actor(s) | Shell · header / tab title | API (§7) |
|---|---|---|---|---|---|
| S1 | `/buku-nota/heatmap` | Heatmap Topik Lemah | Student (menu, SERVER gate); admin (OBSERVED); other roles are redirected to their home (SERVER) | SHU · "Heatmap Topik Lemah" / "Selamat datang kembali" (DV-M25-01) · tab "Heatmap Topik Lemah" | #1, #2 |
| — | `/heatmap-topik-lemah` | Global 404 (the rebuild's former menu href; not registered, DV-M25-09) | All | standalone | — |
| — | `/practice/chapter` | Cell target: M05 S4 "Soalan by Chapter" (not M25) | Student | SHU · M05 | — |
| — | `/bilik-duta/{slug}` | Card target: M24 page (not M25; global 404 until M24 is built) | All | M24 | — |

The route has no query string. Inbound links from the later M25 screens (`/buku-nota` tab "Heatmap Topik Lemah", `/pusat-nota-ringkas` tile "🌡️ Heatmap Topik") target `/buku-nota/heatmap` (FR-M25-05).

---

## 3. Functional requirements

| ID | Requirement | FN | AC |
|---|---|---|---|
| FR-M25-01 | The user shell SHALL show, in the "Pusat AI" section for role `student` only, the item "Heatmap Topik Lemah" (`fa-fire`, red) targeting `/buku-nota/heatmap` (not `/heatmap-topik-lemah`), in the sidebar and in the drawer below `lg`, and SHALL NOT show it to `admin`. The shell renders it; M25 registers the route and its active item (XR-M25-01). | 1.1.1 | 01.1, 01.2, 01.5 |
| FR-M25-02 | The route SHALL set the header title "Heatmap Topik Lemah" and the subtitle "Selamat datang kembali" (DV-M25-01). | 1.1.2 | 01.3 |
| FR-M25-03 | The route SHALL set the tab title "Heatmap Topik Lemah" exactly (no suffix). | 1.1.3 | 01.3 |
| FR-M25-04 | S1 SHALL render in the user-portal shell with no tab bar, back link, filter or form; the shell's tournament-banner partial SHALL NOT be treated as S1 content and stays hidden when no tournament is active. | 1.1.4 | 01.4 |
| FR-M25-05 | `/buku-nota/heatmap` SHALL be the single route of the screen and the target of the sidebar item and of the tab and tile of the later M25 screens `/buku-nota` and `/pusat-nota-ringkas`. | 1.1.5 | 01.1 |
| FR-M25-06 | S1 and API #1 SHALL require a session: a guest is sent to `/login` and the API answers `401 UNAUTHORIZED`. | 1.2.1 | 02.1 |
| FR-M25-07 | S1 and #1 SHALL accept the student role (`pelajar`; SERVER gate `role:pelajar`) and the admin (OBSERVED) and return the viewer's own heatmap; any other signed-in role (guru, ibu_bapa, penaja, school_admin, ppd_officer, jpn_officer) SHALL be redirected to its own home (M01 role home; SERVER `EnsureRole`, strict role check, no bypass) on S1 and SHALL receive `403 FORBIDDEN` from #1 (the rebuild's API contract, INFERRED; the server renders server-side and has no such endpoint), with no heatmap, hero or card data returned. | 1.2.2 | 02.2, 02.5 |
| FR-M25-08 | A GET navigation to `/heatmap-topik-lemah` SHALL render the M01 global 404 page. | 1.2.3 | 02.3 |
| FR-M25-09 | S1 SHALL show the shell loading behaviour while #1 is pending and the M01 global error convention on failure, and SHALL NOT render a partial cell. | 1.2.4 | 02.4 |
| FR-M25-10 | The layout SHALL follow §10: hero and subject cards fill the content column (max 1200 px); each subject grid uses `repeat(auto-fill, minmax(200px, 1fr))` with a 0.5 rem gap, giving 1 / 3 / 4 columns at 375 / 768 / 1280 px; the Cikgu Pakar block is at most 920 px wide and centred. | 1.3.1 | 03.1, 03.4 |
| FR-M25-11 | S1 SHALL have no horizontal page scroll and no content text below 12 px at 375 / 768 / 1280 px (including the four Cikgu Pakar pills, DV-M25-04); every topic cell SHALL be at least 44 px tall. | 1.3.2 | 03.2 |
| FR-M25-12 | Cells and the card SHALL be plain links with no `title`, tooltip or added ARIA; the subject names SHALL be h2 and the card name an h4; a hovered cell SHALL lift 2 px with the shadow `0 4px 8px rgba(0,0,0,.1)` and show a pointer cursor; a hovered Cikgu Pakar card SHALL turn its border `#c026d3`, lift 2 px and show the shadow `0 12px 24px rgba(192,38,211,.12)` (§10.1); no focus or reduced-motion enhancement is added (D10). | 1.3.3 | 03.3 |
| FR-M25-13 | The hero SHALL show the h1 "Heatmap Topik Lemah" and the paragraph "Topik mana anda kuat, mana lemah — semua dalam satu paparan. Klik kotak merah untuk fokus belajar." on the red gradient with white text (§10.1). | 2.1.1 | 04.1 |
| FR-M25-14 | The legend SHALL show four pills in the order "Lemah (< 50%)", "Sederhana (50-79%)", "Mantap (≥ 80%)", "Belum cuba" with the colours of §10.1, always, whether or not a gray cell exists. | 2.1.2 | 04.2 |
| FR-M25-15 | S1 SHALL render one block per subject that has at least one cell, headed by an h2 with the subject name. | 2.2.1 | 05.1 |
| FR-M25-16 | Each cell SHALL be one link showing the topic name (the M03 chapter name, no "Bab n:" prefix) and below it "{attempts} cuba · {percent}% betul". | 2.2.2 | 05.1, 05.3, 05.4 |
| FR-M25-17 | Each cell SHALL be coloured by the band of its percent (BR-M25-03) with the tokens of §10.1; the gray style SHALL exist in the stylesheet and SHALL NOT be rendered. | 2.2.3 | 05.2 |
| FR-M25-18 | Every cell SHALL link to `/practice/chapter` with no query string, whatever its band or subject (DV-M25-02). | 2.2.4 | 06.1 |
| FR-M25-19 | Subjects SHALL be ordered by M03 subject order; the cells of a subject by accuracy ascending, ties by topic name ascending, then by chapter id (BR-M25-04). | 2.2.5 | 05.1, 05.4, 05.5 |
| FR-M25-20 | When the viewer has no shown cell, S1 SHALL render the hero, the legend and, instead of subject blocks, the empty-state block of §8.1 (the `fa-fire` icon, "Belum ada data heatmap.", "Jawab soalan latih tubi dahulu — topik kuat dan lemah anda akan dipaparkan di sini." and the button "Mula Latih Tubi" → `/latih-tubi`; SERVER, D24) and no cell; a gray "Belum cuba" cell SHALL never be rendered. | 2.2.6 | 07.1, 07.2 |
| FR-M25-21 | The Cikgu Pakar block SHALL be rendered above the hero with the heading "🌟 Cikgu Pakar Untuk Topik Lemah" (shown in upper case by CSS). | 3.1.1 | 08.1, 08.4 |
| FR-M25-22 | The card SHALL be one link to `/bilik-duta/{slug}` (the slug of the shown record) holding the avatar, name, tagline and four pills, with the decorative star in the top-right corner. | 3.1.2 | 08.1, 08.5 |
| FR-M25-23 | The card SHALL show the initials in a 56 × 56 px round avatar (the live `.duta-av` style: gradient `#4338ca` → `#c026d3` at 135°, text `#fff`, weight 700, 1.15 rem, gold ring for the `bintang` tier; §10.1, DV-M25-03) and the name as an h4. | 3.1.3 | 08.1, 08.2 |
| FR-M25-24 | The card SHALL show the tagline and the pills "🥇 Duta Bintang", "📚 {subject}", "📍 {state}", "⭐ {rating}" (two decimals), each at least 12 px (DV-M25-04). | 3.1.4 | 08.1, 08.2 |
| FR-M25-25 | The card SHALL come from API #2 called without a subject and SHALL be one of the active `bintang` records of §6.7 E, picked by the seedable PRNG (same seed and same actions give the same card); when #2 fails or returns no card, the whole block SHALL be absent and the rest of S1 SHALL be unaffected (INFERRED). | 3.1.5 | 08.3, 08.6 |
| FR-M25-26 | API #1 SHALL return the cells of Q-M25-HM-CELLS for the session user, grouped by subject (BR-M25-01, 02). | 4.1.1 | 09.1 |
| FR-M25-27 | Percent SHALL be `round(100 × correct ÷ attempts)` rounded half up, and the band SHALL be taken on that whole number (BR-M25-03). | 4.1.2 | 09.5 |
| FR-M25-28 | Only answers with a chapter link SHALL be grouped (R1) and only chapters with at least K-M25-01 = 5 attempts SHALL be shown (R2) (BR-M25-02, DV-M25-06). | 4.1.3 | 09.1, 09.3 |
| FR-M25-29 | The heatmap SHALL be recomputed on every request over all time, so answers written through M05 after the seed appear on the next load. | 4.1.1 | 09.4 |
| FR-M25-30 | The displayed figures SHALL agree with M05's: chapter attempts and correct counts are M05's aggregates for the same chapter (BR-M25-10). | 4.1.3 | 09.2 |
| FR-M25-31 | M25 SHALL NOT change or align M08's "topik lemah" list; the two definitions stay separate (DV-M25-07). | 4.1.4 | 10.4 |
| FR-M25-32 | API #1 SHALL take no user parameter: the viewer is the session user and any `user_id` or `userId` query value is ignored (SEC-M25-01). | 4.1.4 | 10.2 |
| FR-M25-33 | M25 SHALL register no store; it SHALL read only through the contracts of §6.1 and SHALL write nothing to M03, M05 or M24; opening S1 SHALL change no count. | 4.1.4 | 10.3 |
| FR-M25-34 | The S1 view SHALL itself issue only #1 and #2 (the shell adds its own 4 calls: unread notifications, active tournament, chatbot history, offline snapshot); S1 SHALL NOT send any AI-generation, chatbot-message or external-host request and SHALL NOT render a generate, chat or note-creation control (BR-M25-12). | 4.1.5 | 10.1 |
| FR-M25-35 | API #1 SHALL answer with the envelope and error format of SRS.md §7 (`data`, `error.code`) and SHALL honour the configured mock latency and fault injection. | 1.2.1, 1.2.4 | 02.1, 02.4 |

### 3.1 Traceability (US → FR → E2E)

| US | FR | E2E |
|---|---|---|
| US-M25-01 | 01, 02, 03, 04, 05 | 01, 02 |
| US-M25-02 | 06, 07, 08, 09, 35 | 03, 04, 05, 06 |
| US-M25-03 | 10, 11, 12 | 07, 08, 09 |
| US-M25-04 | 13, 14 | 10, 11 |
| US-M25-05 | 15, 16, 17, 19 | 12, 13, 14, 15 |
| US-M25-06 | 18 | 16 |
| US-M25-07 | 20 | 17 |
| US-M25-08 | 21, 22, 23, 24, 25 | 18, 19, 20, 21 |
| US-M25-09 | 26, 27, 28, 29, 30 | 22, 23, 24, 25, 26 |
| US-M25-10 | 31, 32, 33, 34 | 27, 28, 29, 30 |

---

## 4. Business rules

| ID | Rule | Source |
|---|---|---|
| BR-M25-01 | **Access and scope.** S1 and #1: role `student` (`pelajar`) and `admin` only; any other signed-in role is redirected to its own home (API 403); guest → `/login` (API 401); the data is the viewer's own answers only (no user parameter). The menu item is `student` only. | OBSERVED (admin) / SERVER (student gate and redirect of all other roles, D24; user decision 2026-10-03) / INFERRED (guest, API 403) |
| BR-M25-02 | **Cell population.** Base = Q-M25-HM-ROWS(viewer): the viewer's answers grouped by (subject, chapter id) — never by name — with a chapter link (R1: an answer without a chapter link is not grouped). A row is shown iff `answered ≥ K-M25-01` (5) (R2). A subject with no shown row has no block. | OBSERVED (result) / INFERRED (rule, DV-M25-06) |
| BR-M25-03 | **Percent and band.** percent = `round(100 × correct ÷ answered)` half up; band = `red` if percent < 50, `amber` if 50 ≤ percent ≤ 79, `green` if percent ≥ 80; `gray` is never assigned. | OBSERVED (6 of 6) / INFERRED (edges) |
| BR-M25-04 | **Order.** Subjects by M03 `order` ascending, then `id`; cells by `correct ÷ answered` ascending, then topic name ascending (ms-MY collation), then chapter id ascending (M03 names repeat, e.g. ids 2 and 29). | OBSERVED (order) / INFERRED (ties) / PROPOSED (id tie-break) |
| BR-M25-05 | **Cell text.** Line 1 = the M03 chapter `name` (which has no "Bab n:" prefix); line 2 = "{answered} cuba · {percent}% betul" with "·" U+00B7 between single spaces; {answered} uses ms-MY grouping from 1,000 (INFERRED). | OBSERVED / INFERRED |
| BR-M25-06 | **Cell link.** Every cell → `/practice/chapter`, no query string. | OBSERVED |
| BR-M25-07 | **Legend.** The four pills are static copy and always shown. | OBSERVED |
| BR-M25-08 | **Empty state.** No shown row → hero and legend plus the empty-state block (§8.1: "Belum ada data heatmap.", the hint sentence, button "Mula Latih Tubi" → `/latih-tubi`); no subject block, no cell, no gray tile. Live has no empty account; the copy is the server template's (D24). | SERVER (message) / OBSERVED (no gray tile) |
| BR-M25-09 | **Cikgu Pakar.** The card = the single result of `GET /api/duta/recommendations` (M24) without `subject`; pick rule = BR-M06-27 (random among active `bintang` ambassadors, seedable by `mock.setRandomSeed`; not tied to the weak topics; M25 sends no `subject` and no `seed` query, so M06's subject preference does not apply). With the M06 seeds the set is {`cikgu-demo-matematik`, `cikgu-demo-bahasa`, `cikgu-demo-sains`} (§6.7 E): **no M25 assertion may name one record without reading the slug of the shown card**. None or failure → the block is absent. The card shows `tier` `bintang` only. | OBSERVED (card) / INFERRED (rule) |
| BR-M25-10 | **Agreement with M05.** For every shown cell, `answered` and `correct` = M05's aggregate of the same (subject, chapter) for the same user; the sum of shown `answered` + the hidden answers = the viewer's total in M05's answer log (Q-ANS-USER). | OBSERVED (admin) |
| BR-M25-11 | **Recompute.** Every request recomputes from the current M05 log and M03 names; no cache, no snapshot, no window (all time). | INFERRED |
| BR-M25-12 | **No AI, no external call.** S1 sends no AI request and simulates no AI outcome; the only requests **originating from the S1 view** are #1 and the M24 contract #2 (D14: no external host). The shell's own 4 calls (unread notifications, active tournament, chatbot history load by M22, offline snapshot) are not S1 requests and are allowed; a chatbot message send or any AI-generation call is not. If a later capture shows an AI control here, it is recorded as not built (a simulated outcome at most, PROPOSED). | OBSERVED (no control, no request) |
| BR-M25-13 | **No writes.** S1 creates, updates and deletes nothing and carries no counter (live has none). | OBSERVED |
| BR-M25-14 | **Names.** Topic and subject names are M03's (`name` of the chapter and of the subject); the M04 `chapterLabel` is not used. | OBSERVED (the six topics are M03 chapter names) / INFERRED |

---

## 5. Validation rules

| ID | Input | Rule | Error |
|---|---|---|---|
| V-M25-01 | S1 / #1 query string | none of the values is read: unknown parameters (`user_id`, `userId`, `subject`, `page`) are ignored and never change the result | — |

S1 has no form and no user input.

---

## 6. Data entities & fields

JSON fields are camelCase; ids are integers. "Now" is the shared mock clock (ADR-0006, architecture §6.12), project clock **2026-09-25T15:40:00+08:00**; no S1 value depends on it. Everything resets per E2E test (`mock.reset()`).

### 6.1 Referenced entities (owners; not redefined — D12)

| Entity | Owner | Fields M25 reads |
|---|---|---|
| Viewer's answers | M05 (DATA-M05-02 QuizAnswer; §7.2 repository read contract) | **existing contract (v1.1):** `practice.answers(userId)` with no filter (the `AnswerFilter` of the code has every field optional; M05 §7.2 still prints `{date}`, XR-M14-13 b documents it as optional) → rows `{chapterId, subjectId, isCorrect, answeredAt, …}`; M25 keeps rows with `chapterId` not null and groups them by `chapterId` in memory (answers per chapter = rows, correct = rows with `isCorrect`; the subject comes from the M03 chapter). The viewer's total answers and correct answers by Q-ANS-USER(userId) / Q-ANS-USER-CORRECT(userId) (existing, §6.14.2) for reconciliation only. **Not available:** the named query `Q-ANS-USER-CHAPTER` and the method `practice.chapterAggregates` do not exist in M05 v1.20. **Not suitable:** `practice.chapterStats(userId, chapterId)` (exists) counts distinct questions by their latest answer (BR-16) and needs the chapter id up front, so it does not equal "attempts" when a question is answered twice. Scope: canonical accounts (at most 119 rows); for a D11 generated user see XR-M25-02 |
| Chapter | M03 (DATA-M03-03) | `id`, `name`, `subjectId` (through a read-only repository lookup for any session, XR-M25-04) |
| Subject | M03 (DATA-M03-02; `GET /api/subjects` #28) | `id`, `name`, `order` |
| DutaCard | M24 (shape DATA-M06-08) | `slug`, `name`, `initials`, `tier`, `tagline`, `subject`, `state`, `rating`, `active` |
| Session user | M01 / M02 | `id`, `role` |

### 6.2 Derived read models (no storage)

**DATA-M25-01 — HeatmapTopic** (derived, per request): `{chapterId: int, name: string, attempts: int, correct: int, percent: int 0–100, band: 'red'|'amber'|'green'}`.

**DATA-M25-02 — HeatmapSubject** (derived, per request): `{subjectId: int, name: string, topics: HeatmapTopic[]}` (at least one topic; order BR-M25-04). API #1 returns `{subjects: HeatmapSubject[]}`, `[]` when there is no shown cell.

### 6.3 Constants and enumerations

| Item | Value |
|---|---|
| K-M25-01 `HEATMAP_MIN_ATTEMPTS` | 5 (any value 3–5 reproduces the observation; DV-M25-06) |
| Band `red` | percent < 50 · label "Lemah (< 50%)" · cell `#fee2e2` / border `#fca5a5` · legend text `#b91c1c`, border `#fca5a5` |
| Band `amber` | 50–79 · "Sederhana (50-79%)" · cell `#fef3c7` / `#fcd34d` · legend text `#92400e`, border `#fcd34d` |
| Band `green` | ≥ 80 · "Mantap (≥ 80%)" · cell `#d1fae5` / `#6ee7b7` · legend text `#047857`, border `#6ee7b7` |
| Band `gray` (never assigned) | "Belum cuba" · cell `#f1f5f9` / `#cbd5e1` at opacity 0.7 · legend text `#475569`, border `#cbd5e1` |
| Duta tier (card) | `bintang` "🥇 Duta Bintang" (observed); `inspirasi`, `tetamu` never picked (M06) |

### 6.4 Named queries (every displayed figure cites one)

Values at the project clock with the seed of §6.7.

| Query | Base | Definition | Value at the clock | Shown on |
|---|---|---|---|---|
| Q-M25-HM-ROWS(userId) | M05 `practice.answers(userId)` (existing) | viewer's answers grouped by `chapterId` (subject from M03), `chapterId` not null: `answered` = rows, `correct` = rows with `isCorrect` | admin: 7 rows (chapter id) — BM D1 Bab 1 (35) 18 / 8, BM D1 Bab 2 (36) 5 / 3, BM D1 Bab 3 (2) 10 / 8, BM D2 Bab 1 (4) 2 / 1, BM T4 Bab 1 (87) 5 / 0, BM T5 Bab 99 (413) 38 / 12, SEJ T5 Bab 1 (382) 40 / 14 (Σ 118 / 46); Pelajarmaju: 3 rows (chapters 1, 143, 136: 23 / 19, 7 / 3, 7 / 4); Pelajar 2: 0 | (base of the next) |
| Q-M25-HM-CELLS(userId) | Q-M25-HM-ROWS ⋈ M03 | rows with `answered ≥ K-M25-01`; name and subject from M03; percent and band per BR-M25-03; order BR-M25-04 | admin: 6 cells, Σ attempts 116, Σ correct 45; Pelajarmaju: 3 cells, Σ 37 / 26; Pelajar 2: 0 | S1 cells and blocks |
| Q-M25-HM-HIDDEN(userId) | Q-ANS-USER(userId) (M05) − Q-M25-HM-CELLS | answers (and correct answers) of the viewer that appear in no cell | admin: 3 answers, 1 correct (D2 chapter 2 / 1 and one chapterless wrong answer); Pelajarmaju 0; Pelajar 2 0 | tests and reconciliation only (never displayed) |
| Q-M25-DUTA | M24 `GET /api/duta/recommendations` | the single recommended card, or none | 1 card, one of `cikgu-demo-matematik`, `cikgu-demo-bahasa`, `cikgu-demo-sains` (seedable pick, BR-M25-09) for every viewer | S1 Cikgu Pakar block |

### 6.5 Count reconciliation (every observed figure; by hand; re-checked in audit round 1: all pass, nothing changed in v1.1)

| ID | Check | Result | Status |
|---|---|---|---|
| R01 | Displayed attempts | 5 + 38 + 18 + 5 + 10 + 40 = 116 = live (R10 §5.1) | PASS |
| R02 | Percents | correct 0, 12, 8, 3, 8, 14 → 0 / 5 = 0, 12 / 38 = 31.6 → 32, 8 / 18 = 44.4 → 44, 3 / 5 = 60, 8 / 10 = 80, 14 / 40 = 35 = live "0", "32", "44", "60", "80", "35" | PASS |
| R03 | Bands | 0, 32, 44 → red; 60 → amber; 80 → green; 35 → red = live 6 of 6 | PASS |
| R04 | Order | BM 0 ≤ 32 ≤ 44 ≤ 60 ≤ 80 and BM (order 1) before Sejarah (order 5) = live | PASS |
| R05 | BM Darjah 1 vs M05 S5 | 18 answers / 8 correct = 44.4 %, 5 / 3 = 60 %, 10 / 8 = 80 % = M05 "Skor 44.4%", "60%", "80%" and cells 44 / 60 / 80 | PASS |
| R06 | Sejarah vs M05 | M05 SEJ 40 answers / 14 correct (S8) and mastery 14 / 40 = 35.0 % (S12) = cell 40 / 35 % | PASS |
| R07 | Admin totals | M05 119 answers / 46 correct (BM 79 / 32, SEJ 40 / 14) = displayed 116 / 45 + hidden 3 / 1; BM: 79 / 32 = shown 76 / 31 + hidden 3 / 1 (D2 chapter 2 / 1, chapterless 1 / 0) — the C1 conflict, explained by R1 + R2 (DV-M25-06) | PASS |
| R08 | Minimum attempts | smallest shown cell 5 (two cells); the hidden D2 chapter has 2; every minimum in 3–5 reproduces; K-M25-01 = 5 | PASS |
| R09 | Pelajarmaju | Bab 1 M1 8 / 10 + M2 9 / 10 + M4 2 / 3 = 19 / 23 = 82.6 → 83 green; Bab 2 M3 3 / 5 + M4 0 / 2 = 3 / 7 = 42.9 → 43 red; Bab 3 M3 3 / 5 + M4 1 / 2 = 4 / 7 = 57.1 → 57 amber; Σ 37 / 26 = M05 S12 MATH 26 / 37; order 43, 57, 83 | PASS |
| R10 | Pelajar 2 | 0 answers (M05 empty states) → 0 cells | PASS |
| R11 | M08 vs M25 (C2) | M08 S6 "Tiada topik lemah!" (its own window and DSKP-SP definition) and four red S1 cells never share a page; not a reconcilable figure (DV-M25-07) | PASS (no check) |

**Classification.** (a) Computed through the named queries over M05 and M03: R01–R04, R08–R10. (b) Owner contracts: R05, R06, R07 (M05), M24's card. (c) Population rule: R07, R08 (DV-M25-06). No D9 fix changes a figure; no display constant.

### 6.6 Dataset spec (D11; every count is a named query of §6.4)

| Store | Owner | Primitive | Total at the clock | Facets (count-relevant) | Evidence | Runtime ids |
|---|---|---|---|---|---|---|
| — (M25 has no store) | — | derived per request | — | — | — | — |
| `QuizAnswer` | M05 | D11 virtual dataset (§6.14.3) | 478,499 | `userId`, `subjectId`, `chapterId`, `isCorrect` | M05 §6.14 | ≥ 9,000,001 |
| chapters, subjects | M03 | materialised tables | 1,251 (+ 60 out-of-tree) / 31 | `subjectId`, `name`, `order` | M03 §6.10 | — |

Generated users' heatmaps are derived by M05 from its per-cell counters, never by iterating rows (NFR-M25-01).

### 6.7 Seed (every value observed unless marked; the card is fictitious, DV-M25-08)

**A. Admin (id 1) — expected S1 (observed 2026-09-27):**

Cells are keyed by the M03 **chapter id** (curriculum.json of M03, read 2026-10-03; M03 names are not unique, so no lookup or grouping by name). M03 subject ids: Bahasa Melayu 1, Matematik 3, Sejarah 5.

| Subject (M03 order) | Chapter id | Topic (M03 chapter) | Attempts | Correct | Percent | Band |
|---|---|---|---|---|---|---|
| Bahasa Melayu (1) | 87 | Kemahiran Bahasa Tingkatan 4 (BM T4 Bab 1) | 5 | 0 | 0 | red |
| Bahasa Melayu | 413 | Kemahiran Bahasa Tingkatan 5 (BM T5 Bab 99) | 38 | 12 | 32 | red |
| Bahasa Melayu | 35 | Kemahiran Mendengar dan Bertutur (BM D1 Bab 1) | 18 | 8 | 44 | red |
| Bahasa Melayu | 36 | Kemahiran Membaca (BM D1 Bab 2) | 5 | 3 | 60 | amber |
| Bahasa Melayu | 2 | Kemahiran Menulis (BM D1 Bab 3; **not** id 29 = BM T1 Bab 2, same name) | 10 | 8 | 80 | green |
| Sejarah (5) | 382 | Sejarah Tingkatan 5 KSSM (SEJ T5 Bab 1) | 40 | 14 | 35 | red |

**Hidden (Q-M25-HM-HIDDEN):** BM D2 Bab 1 (id 4) "Kemahiran Mendengar dan Bertutur D2" 2 answers / 1 correct (below K-M25-01) and 1 wrong answer with no chapter link.

**B. What the admin's answer log must carry (the seed conditions of XR-M25-02 and XR-M25-03; totals equal M05 §6.12):**

| Answers (M05) | Count · correct | Chapter link required |
|---|---|---|
| Sessionless 19/02, BM Darjah 1 | 18 · 8 / 5 · 3 / 10 · 8 | BM D1 Bab 1 (35) / Bab 2 (36) / Bab 3 (2) (M05 §6.15 anchors, unchanged) |
| Sessionless 19/02, BM Darjah 2 | 2 · 1 | BM D2 Bab 1 (4) (M05 §6.15 anchors, unchanged) |
| A2 `latih_tubi` SEJ 2026-05-11 | 40 · 14 | SEJ T5 Bab 1 (382) (all 40) |
| A3 `latih_tubi` BM 2026-05-11 | 34 · 11 | BM T5 Bab 99 (id 413) for 33 answers (11 correct); its last answer, wrong, has no chapter link (PROPOSED choice) |
| A4 `past_year` BM 2026-05-19 | 5 · 1 | BM T5 Bab 99 (413) (all 5) |
| A5 `past_year` BM 2026-05-19 | 5 · 0 | BM T4 Bab 1 (87) (all 5) |

Totals: BM T5 = 33 + 5 = 38 answers, 11 + 1 = 12 correct; BM overall 79 / 32; SEJ 40 / 14; all 119 / 46 (unchanged from M05).

**C. Pelajarmaju (id 4) — expected S1 (computed from the fictitious M05 seed, provisional):** "Matematik": "Sukatan dan Geometri" (MATH D1 Bab 2, id 143) 7 · 3 → 43 % red; "Pecahan" (MATH D1 Bab 3, id 136; **not** id 152 = MATH D3 Bab 2, same name) 7 · 4 → 57 % amber; "Nombor Bulat hingga 100" (MATH D1 Bab 1, id 1) 23 · 19 → 83 % green.

**D. Pelajar 2 (id 3):** no answers → empty state. **Pelajar (id 2):** its SPM-pool answers (P1–P4) show only what their questions' chapter links give; no E2E asserts its cells (OQ-M25-09). Guru (5) and Ibubapa (6) are not admitted (BR-M25-01: redirected, API 403); their answers are irrelevant.

**E. Cikgu Pakar cards (owned by M24; fictitious, the `bintang` records M06 §6.7 already seeds; `cikgu-demo-inspirasi` and `cikgu-demo-tetamu` are never picked).** The pick is random and seedable (BR-M25-09): every viewer receives **one** of these three; M25 tests read the shown slug and compare the card with its own row.

| Slug | Name | Initials | Tagline | 📚 subject | 📍 state | ⭐ rating |
|---|---|---|---|---|---|---|
| `cikgu-demo-matematik` | Cikgu Demo Matematik | CM | Maestro Matematik · 22 tahun ajar pelajar B40 capai cita-cita. | Matematik | Johor | 4.92 |
| `cikgu-demo-bahasa` | Cikgu Demo Bahasa | CB | Pakar Bahasa Melayu SPM · 15 tahun mengajar Kertas 2. | Bahasa Melayu | Johor | 4.88 |
| `cikgu-demo-sains` | Cikgu Demo Sains | CS | Pakar Sains SPM · Jurulatih eksperimen sekolah. | Sains | Selangor | 4.80 |

All three carry the pill "🥇 Duta Bintang". Source: M06 SRS §6.7 (fictitious; only the Matematik row reproduces the card observed on live, DV-M25-08). The default PRNG seed of the E2E suites is `setRandomSeed(1)` (M06 §12); which record that yields is not asserted (XR-M25-05 e).

**F. Test-only fixtures** (never loaded with the observed-figure checks; built on `mock.addAnswer`): `m25-bands` — for Pelajar 2, the five Bahasa Melayu chapters 12, 13, 14, 15, 16 (the first five chapters of Darjah 3–4 in M03 order: D3 "Kemahiran Membaca D3" 12, "Kemahiran Menulis D3" 13, "Aspek Tatabahasa D3" 14, "Aspek Seni Bahasa" 15, D4 "Kemahiran Membaca D4" 16) with (attempts, correct) 10 · 4, 10 · 5, 100 · 79, 200 · 159 and 10 · 8 respectively; `m25-ties` — for Pelajar 2, the three Bahasa Melayu chapters 12, 13, 14 with 10 · 5 each (expected order by name: "Aspek Tatabahasa D3" (14), "Kemahiran Membaca D3" (12), "Kemahiran Menulis D3" (13)). Each answer uses a question whose M04 `curriculumChapterId` is that chapter.

### 6.8 Cross-module requests (XR-M25-nn; applied through the XL gate — M25 does not edit the owners' stores)

| ID | To | Request | Why | Status |
|---|---|---|---|---|
| XR-M25-01 | Global shell (task F-19b; `src/shells/nav/user-nav.ts`, design/shells.md) | (a) Change the `to` of the item `heatmap-topik-lemah` from `/heatmap-topik-lemah` (404 on live) to **`/buku-nota/heatmap`**; keep label, `fa-fire`, red, student-only, position; make the item active on that route. (b) Header title / subtitle for the route: "Heatmap Topik Lemah" / "Selamat datang kembali" (DV-M25-01, DV-SH-03). (c) Observation, Perlu pengesahan: the item `buku-nota-saya` targets `/buku-nota-saya` while the live page "Buku Nota Saya" is `/buku-nota` (200; R10 §1.1); the later M25 screen will confirm it — F-19b may correct it at the same time. (d) The live student item's own href was not observable (OQ-M25-01). | The nav href is 404 on live (C4). | Requested |
| XR-M25-02 | M05 (v1.20) | (a) **Re-scoped in v1.1 (Could, not blocking).** M25 reads through the **existing** `practice.answers(userId)` (all fields of its filter optional in the code; M05 §7.2 should print `date?` as optional, as already requested by XR-M14-13 b) and groups by `chapterId` itself (§6.1); `practice.chapterStats(userId, chapterId)` is not used (distinct questions, BR-16). `Q-ANS-USER-CHAPTER` and `practice.chapterAggregates` **do not exist** in M05 v1.20. Optional performance request, only if a D11 generated user is ever a viewer of S1: add the named query **Q-ANS-USER-CHAPTER(userId)** to §6.14.2 and the repository method `practice.chapterAggregates(userId): {subjectId: number, chapterId: number, answered: number, correct: number}[]` to §7.2 (all-time, `chapterId` not null, derived from per-cell counters, not by iterating rows). (b) Seed: the admin's answers of sessions A2, A3, A4, A5 carry the chapter links of §6.7 B (SEJ T5 Bab 1 ×40; BM T5 Bab 99 ×38; BM T4 Bab 1 ×5; the last answer of A3, a wrong one, without a chapter); totals stay 119 / 46, BM 79 / 32, SEJ 40 / 14. (c) Confirm that the 3 BM answers absent from S1 (C1) are explained by the rules R1 + R2 (DV-M25-06). | S1 cells (C1). | Requested |
| XR-M25-03 | M04 (v1.19) | Contribute, through `questions.contributeAnchors('M05', rows)` (or M05 §6.15 extended), the SPM-pool question rows answered in A2–A5 with `curriculumChapterId`: 40 rows of SEJ T5 → SEJ T5 Bab 1; 38 rows of BM T5 → BM T5 Bab 99 (413); 5 rows of BM T4 → BM T4 Bab 1; one further BM row (the wrong A3 answer) with `curriculumChapterId` null. Each replaces a generated row of the same cell, so no total changes; confirm capacity (each chapter's eligible count is at least its anchors). | S1 cells (the chapter link of an answer is its question's). | Requested |
| XR-M25-04 | M03 (v1.10) | Expose a read-only repository lookup for any signed-in session — `curriculum.chaptersByIds(ids)` → `{id, name, subjectId}` — and confirm the chapter ids and names used here (M03 `curriculum.json`; **cells are keyed by id, never by name**: "Kemahiran Menulis" exists as ids 2 and 29, "Pecahan" as 136 and 152): BM D1 Bab 1 "Kemahiran Mendengar dan Bertutur" (35), Bab 2 "Kemahiran Membaca" (36), Bab 3 "Kemahiran Menulis" (2); BM D2 Bab 1 "Kemahiran Mendengar dan Bertutur D2" (4); BM T4 Bab 1 "Kemahiran Bahasa Tingkatan 4" (87); BM T5 Bab 99 "Kemahiran Bahasa Tingkatan 5" (413); SEJ T5 Bab 1 "Sejarah Tingkatan 5 KSSM" (382); MATH D1 Bab 1 "Nombor Bulat hingga 100" (1), Bab 2 "Sukatan dan Geometri" (143), Bab 3 "Pecahan" (136); fixture chapters BM D3 "Kemahiran Membaca D3" (12), "Kemahiran Menulis D3" (13), "Aspek Tatabahasa D3" (14), "Aspek Seni Bahasa" (15), D4 "Kemahiran Membaca D4" (16). | Topic names; endpoint #14 is admin-only. | Requested |
| XR-M25-05 | M24 (not yet specified) | (a) Own the endpoint/contract `GET /api/duta/recommendations` (M06 #21) and accept M25's call without `subject`: one `DutaCard` or none (`200 {data: null}`), pick rule BR-M06-27. (b) Register `/bilik-duta/{slug}` (until M24 is built the link renders the global 404 page). (c) Keep the three fictitious `bintang` records of M06 §6.7 (`cikgu-demo-matematik` "CM", `cikgu-demo-bahasa` "CB", `cikgu-demo-sains` "CS") as the default-seed set; the provisional handler registered by M06-T1 serves the call until M24 is built. (d) Confirm the S1 pick rule (OQ-M25-05) — live showed a Matematik card to an account without Matematik cells. (e) Optional: document which `mock.setRandomSeed(n)` value yields which record, so that exact-text checks of one record can be added; M25's ACs do not depend on it (they assert the card set and AC-08.6 determinism). | The Cikgu Pakar card (C3). | Requested |
| XR-M25-06 | M01 (v1.16) | Route meta: `/buku-nota/heatmap` requires a session and the role `student` or `admin`; any other signed-in role is redirected to its role home (M01), and API #1 answers `403` (SERVER gate `role:pelajar`, D24; admin sekolah and PPD / JPN default to redirect, OQ-M25-01); the canonical accounts 1, 3, 4, 5, 6 are used unchanged. | Guard. | Requested |
| XR-M25-07 | ui-ux-designer (G2) | Design spec for S1 at 375 / 768 / 1280: hero, legend, subject cards, cell states (incl. the unrendered gray style), the round avatar (DV-M25-03) and the 12 px pills (DV-M25-04). design-system §6 has every icon S1 uses (§10.2): **no icon row is missing**. | G2. | Requested |
| XR-M25-08 | M08 (v1.18) | Confirmation only: M08 S6 keeps its own "topik lemah" definition; M25 does not read or change it (C2, DV-M25-07). | Scope. | Requested (confirmation only) |

### 6.9 Test hooks (dev / test builds only)

`mock.reset()`; `mock.setUser(id)`; `mock.setLatency(ms)`; `mock.failNext(path, code)`; `mock.addAnswer({userId, questionId, isCorrect, answeredAt?})` (M05 §6.13); `mock.loadFixture('m25-bands' | 'm25-ties')` (§6.7 F; built on `mock.addAnswer`); `mock.setRandomSeed(n)` (M06; the Duta pick; the E2E default is `setRandomSeed(1)`, and a test that needs a repeatable card calls it before each load, AC-M25-08.6). M25 adds no other hook and stores nothing to reset.

---

## 7. Mock API endpoints

Base `/api`; envelope and error format of SRS.md §7. Auth: **U** any signed-in user; guest → `401`; #1 additionally admits only `student` and `admin` (other roles → `403`, FR-M25-07). Both endpoints are read-only; the path of #1 mirrors the live route, and the response is a derived read model.

| # | Method | Path | Auth | Mut. | Request | Response (data) | Errors | Live equivalent |
|---|---|---|---|---|---|---|---|---|
| 1 | GET | `/api/buku-nota/heatmap` | U | no | none (any query value ignored, V-M25-01) | `{subjects: HeatmapSubject[]}` (§6.2; `[]` when no shown cell) | 401, 403 | GET `/buku-nota/heatmap` (HTML) |
| 2 | GET | `/api/duta/recommendations` | U | no | none from M25 (`subject` not sent) | `DutaCard` or `null` | 401 | server-rendered card; **owned by M24** (M06 #21) |

Repository contract (`@/modules/m25-ai-centre/mock`): `heatmap.forUser(userId)` → `HeatmapSubject[]` (implements Q-M25-HM-CELLS over `practice.answers(userId)` grouped by chapter id and M03 `chaptersByIds` (XR-M25-04), `GET /api/subjects`; no role check inside the repository, the gate is on the route and #1); `heatmap.hiddenForUser(userId)` → `{answers, correct}` (Q-M25-HM-HIDDEN, tests only).

---

## 8. States & messages

### 8.1 Observed copy (exact)

- **Hero:** "Heatmap Topik Lemah"; "Topik mana anda kuat, mana lemah — semua dalam satu paparan. Klik kotak merah untuk fokus belajar."
- **Legend:** "Lemah (< 50%)", "Sederhana (50-79%)", "Mantap (≥ 80%)", "Belum cuba".
- **Subject blocks:** subject name as h2 ("Bahasa Melayu", "Sejarah"); cells "{topic}" and "{n} cuba · {p}% betul".
- **Cikgu Pakar:** "🌟 Cikgu Pakar Untuk Topik Lemah"; card "{initials}", "{name}", "{tagline}", "🥇 Duta Bintang", "📚 {subject}", "📍 {state}", "⭐ {rating}".
- **Empty state (SERVER, D24; the server template, not observed on live):** "Belum ada data heatmap."; "Jawab soalan latih tubi dahulu — topik kuat dan lemah anda akan dipaparkan di sini."; button "Mula Latih Tubi" (→ `/latih-tubi`).
- **Titles:** header "Heatmap Topik Lemah" / "Selamat datang kembali"; tab "Heatmap Topik Lemah".
- **Hidden shell partial (not S1 content):** "LIVE:", "MAIN", "DAFTAR".
- **Global 404 (M01):** "404", "🔍", "Halaman Tidak Dijumpai", "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?", "Halaman Utama", "Mula Latihan".

### 8.2 INFERRED and PROPOSED behaviour (reported at G1; identical to URS OQ-M25-12; no new copy is invented)

| Item | Value | Reason |
|---|---|---|
| Empty state | hero, legend and the SERVER message block with the button "Mula Latih Tubi" (§8.1); no subject block, no cell. The user may revert it to "no message" at G1 | OQ-M25-04 (SERVER, D24) |
| Gray "Belum cuba" cell | style exists, never rendered (live wins over the server's gray tiles) | OQ-M25-04, DV-M25-05 |
| Population rule | R1 + R2 with K-M25-01 = 5 | OQ-M25-03, DV-M25-06 |
| Ordering and ties | M03 subject order; accuracy ascending; ties by name | OQ-M25-02 |
| Rounding and band edges | half up; band on the rounded percent; ms-MY grouping from 1,000 | OQ-M25-07 |
| Cikgu Pakar pick and absence | M06 pick (seedable, one of three records), one card, block absent on none or failure | OQ-M25-05 |
| Access | SERVER gate: student and (observed) admin; other roles redirected; guest → `/login`; active menu item; admin sekolah and PPD / JPN bypass unknown | OQ-M25-01 |
| Loading and errors | shell loading behaviour; M01 error convention | INFERRED (M01) |
| Recompute | every load, all time, no cache | OQ-M25-08 |
| Fixtures | `m25-bands`, `m25-ties` | test only |

### 8.3 Loading and errors

The data view uses the shell loading behaviour while #1 is pending; a failed #1 shows the M01 global error convention (no partial cell); a failed or empty #2 hides only the Cikgu Pakar block; a refused role is redirected to its home (S1) or gets `403` (#1); `/heatmap-topik-lemah` renders the global 404 page. No M25-specific loading or error copy exists on live.

---

## 9. Permissions matrix

| Route / endpoint | Admin | Pelajar | Ibu Bapa | Guru | Admin Sekolah | PPD / JPN | Penaja | Guest |
|---|---|---|---|---|---|---|---|---|
| S1, #1 | ✓ (OBSERVED, own data) | ✓ (SERVER) | redirect to home, 403 (SERVER) | redirect to home, 403 (SERVER) | redirect, 403 (SERVER; no bypass) | redirect, 403 (SERVER; no bypass) | redirect, 403 (SERVER) | `/login`, 401 |
| #2 (called by S1 only) | ✓ | ✓ | — (S1 not reachable) | — | — | — | — | 401 |
| Menu item "Heatmap Topik Lemah" | — (OBSERVED absent) | ✓ | — | — | — | — | — | — |

Admin behaviour and the absence of the menu item for the admin are OBSERVED. The student gate and the redirect of the other roles are SERVER (`routes/web.php` l.1111 group `['auth', 'role:pelajar']`, `EnsureRole`; D24); the redirect target in the rebuild is M01's role home; the API answer `403` is the rebuild's contract (INFERRED, no live endpoint); the guest cell is INFERRED. OQ-M25-01 is closed (user decision 2026-10-03).

---

## 10. Responsive behaviour

Measured on live by `tools/jobs/R10-measure.js` (snapshot `measure`; the SHU pages include a 15 px scrollbar); the rebuild keeps these layouts except the fixes of DV-M25-03 / 04. Every row: no horizontal page scroll (`scrollWidth ≤ clientWidth`), no content text below 12 px.

| Screen | 375 | 768 | 1280 |
|---|---|---|---|
| S1 | content 342 px; each subject grid **1 column** (cells 276 px wide, 60 px tall); legend wraps to 3 lines inside the hero; Cikgu Pakar card 272 px with the pills wrapping; the mobile bottom nav (shell) overlays the page bottom | grid **3 columns** (cells 211 px; two-line names give 77 px cells); card 645 px | sidebar visible; content column 958 px (max 1200); grid **4 columns** (cells 217 px); card 850 px (block max 920 px) |
| 404 | standalone M01 page | same | same |

Sidebar below `lg` is a drawer; the header and bottom nav are the shell's. H1 22.4 px, h2 17.6 px, topic name 13.6 px, figures line 12 px; the Cikgu pills are lifted from 11.52 px to at least 12 px (0.75 rem).

### 10.1 Visual tokens (observed; the rebuild's design spec at G2 keeps them)

| Element | Token |
|---|---|
| Hero | gradient `#b91c1c` → `#dc2626`, white text, radius 12 px; h1 1.4 rem / 700 |
| Legend pill | white background, `display:inline-block`, padding 0.3 rem 0.75 rem, radius 999 px, bold, 2 px border, line-height 1; colours per §6.3 |
| Subject block | white card, border `#e2e8f0`, radius 10 px; h2 1.1 rem `#1e3a8a` |
| Topic grid | `repeat(auto-fill, minmax(200px, 1fr))`, gap 0.5 rem |
| Topic cell | link; padding 0.6 rem 0.75 rem, radius 8 px, text `#1f2937` (padding, radius, text colour, line-height and transition: SERVER template CSS, whose font sizes, colours and hover equal what live measured); name weight 600 (13.6 px, line-height 1.3); figures line 12 px `#475569`, margin-top 0.2 rem; colours per §6.3; hover `translateY(-2px)` + `0 4px 8px rgba(0,0,0,.1)` (transition 0.1 s); cursor pointer |
| Cikgu Pakar block | gradient `#fef3c7` → white, border `#fde68a`, max width 920 px, centred; heading 0.78 rem / 800 / `#92400e` / upper case |
| Card (`a.duta-card.tier-bintang`) | OBSERVED (live CSS read in audit round 1, 2026-10-03; the R10 inventory and the three screenshots hold no CSS tokens, the screenshots only confirm the look: a rounded bordered card on the amber block, avatar left, name above the tagline, pills below, the star top-right): padding 1 rem 1.15 rem, radius 14 px, gap 0.85 rem between avatar and text; name 1 rem / 800 / `#0f172a`; tagline 0.82 rem / `#475569`; the decorative "⭐" (pseudo-element) opacity 0.6; **hover:** border `#c026d3`, `translateY(-2px)`, shadow `0 12px 24px rgba(192,38,211,.12)`. Card fill and resting border colour were not measured: the designer reads them from `heatmap-topik-lemah-desktop.png` at G2 (Perlu pengesahan) |
| Pills | tier pill (`🥇 Duta Bintang`): `#fef3c7` on `#92400e`; other pills (subject, state, rating): background `#f1f5f9`, text `#64748b`, padding 0.15 rem 0.55 rem, radius pill; live size 0.72 rem (11.52 px) is **lifted to 0.75 rem (12 px)** by DV-M25-04, all else as live |
| Avatar (DV-M25-03) | 56 × 56 px, `border-radius: 50%`, `linear-gradient(135deg, #4338ca, #c026d3)`, text `#fff`, weight 700, 1.15 rem, `display: flex`, initials centred (the live `.duta-av .av-img` rule, OBSERVED); tier `bintang` ring `0 0 0 2px #fbbf24` plus `0 4px 10px rgba(251,191,36,.3)` (live `.av-img.tier-bintang`) |
| Empty-state block (SERVER) | centred, padding 3 rem, text `#64748b`; `fa-fire` icon 2.5 rem in light red (`text-red-300`); first line weight 600 `#475569`; second line 0.85 rem; button "Mula Latih Tubi": background `#dc2626`, white text, padding 0.5 rem 1.25 rem, radius 8 px, weight 600, 0.85 rem, margin-top 1 rem (values from the server template; live unobservable) |

### 10.2 Visual fidelity — icons (design-system v1.11 §6)

| FA name (live) | Where | Lucide (design-system §6) |
|---|---|---|
| `fa-fire` (red) | user-shell menu item "Heatmap Topik Lemah" (rendered by the shell); the empty-state icon (SERVER) | `Flame` (§6.2, row exists) |
| `fa-circle` | hidden tournament banner "LIVE:" (M16, excluded) | `Circle` (§6.1, row exists) |
| emoji "🌟", "🥇", "📚", "📍", "⭐" | Cikgu Pakar heading and pills | literal emoji (content, not icons; §6 preamble) |

**Icon rows missing from design-system §6: none.**

---

## 11. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-M25-01 | Performance: #1 answers from the mock within the configured latency; it reads the viewer's own rows through `practice.answers(userId)` (canonical accounts: at most 119 rows) and never scans the 478,499 log rows; for a D11 generated viewer the optional `practice.chapterAggregates` (XR-M25-02 a) is needed, at most one row per chapter answered (≤ 1,311 chapters). |
| NFR-M25-02 | Determinism: for the same clock, seed and actions, #1 returns identical cells (ADR-0006); the Cikgu Pakar pick uses the seedable PRNG (`mock.setRandomSeed`): the same seed and actions give the same card, and tests assert the card set, not one record (BR-M25-09, AC-M25-08.6). |
| NFR-M25-03 | Localisation: copy as live (BM); numbers ms-MY; no date is shown. |
| NFR-M25-04 | Accessibility: replicates live (D10) — plain links, no `title`, no added ARIA; only unreadable text (D9, pills at least 12 px) is fixed. |
| NFR-M25-05 | Responsive: §10 at 375 / 768 / 1280, no horizontal page scroll (CLAUDE.md §7; NFR-RESP-01, 03, 10). |
| NFR-M25-06 | Privacy: only the viewer's own learning data is returned; the Cikgu Pakar card is fictitious in the prototype (DV-M25-08). |
| NFR-M25-07 | No AI, no external host: the S1 view itself issues no request other than #1 and #2; the page as a whole also carries the shell's 4 calls and nothing else (D14, BR-M25-12). |

### 11.1 Security notes (backend phase; security-engineer review recommended — the screen returns students' personal learning data, though only their own and read-only)

| ID | Risk | Requirement for the rebuild / backend |
|---|---|---|
| SEC-M25-01 | **IDOR:** a user parameter would expose another student's weak topics. | #1 takes no user parameter; the viewer is the session user; the server ignores any `user_id` (V-M25-01). |
| SEC-M25-02 | **Learning-analytics data of minors.** | Own data only; no export; no admin view of another user on this route (the admin sees their own); PDPA retention per backend policy. |
| SEC-M25-03 | **Ambassador card shows a real teacher's name, state, rating and profile link** (as M06 SEC-M06-09). | Consent and PDPA notice for ambassadors (M24). |
| SEC-M25-04 | **Stored XSS / unsafe content in names.** Topic, subject and card fields come from admin-edited data. | Render as escaped plain text; the cell href is a fixed internal path, the card href is built from a validated slug. |
| SEC-M25-05 | **No AI or third-party call from the view.** | Keep the view free of any AI, chatbot or external fetch (BR-M25-12); server-side guard against AI-shaped endpoints on this route. |

---

## 12. E2E test scenarios

Every scenario runs on the three Playwright projects mobile 375×812, tablet 768×1024 and desktop 1280×800 (master SRS §10); a width-specific step names its width and the scenario still runs on all three. Default user: the admin (`mock.setUser(1)`); clock: the **project clock 2026-09-25T15:40:00+08:00**. Values are the seed of §6.7. **Provisional** scenarios assert INFERRED or PROPOSED behaviour or non-admin accounts.

Provisional: 01, 03, 04, 06, 14, 15, 17, 20, 21, 24, 25, 26, 29 (13 of 30)

| ID | Scenario | FR | AC | Provisional |
|---|---|---|---|---|
| E2E-M25-01 | Pelajarmaju at 1280 and 375: the "Pusat AI" section (sidebar, then drawer) lists "Heatmap Topik Lemah" with href `/buku-nota/heatmap` (not `/heatmap-topik-lemah`) and it is the active item on S1; the admin's sidebar has no such entry. | 01, 05 | 01.1, 01.2, 01.5 | yes |
| E2E-M25-02 | Admin on S1: header "Heatmap Topik Lemah" / "Selamat datang kembali" (not "Dashboard"), tab title "Heatmap Topik Lemah", user shell, "LIVE:", "MAIN", "DAFTAR" not visible, no tab bar, filter, form or back link. | 02, 03, 04 | 01.3, 01.4 | no |
| E2E-M25-03 | Guest opens `/buku-nota/heatmap` → `/login`; `GET /api/buku-nota/heatmap` without a session → 401. | 06, 35 | 02.1 | yes |
| E2E-M25-04 | Admin opens S1 → renders with the six cells; pelajarmaju opens S1 → renders with its 3 cells; each of guru, ibubapa, penaja, school_admin, ppd_officer and jpn_officer opens S1 → redirected to its M01 role home, no S1 content, and `GET /api/buku-nota/heatmap` as each → 403 (SERVER gate; the redirect target and the API 403 are the rebuild's contract, INFERRED). | 07 | 02.2, 02.5 | yes (guru, ibubapa part) |
| E2E-M25-05 | Admin opens `/heatmap-topik-lemah` → global 404 copy ("404", "🔍", "Halaman Tidak Dijumpai", the sentence, "Halaman Utama" → `/`, "Mula Latihan" → `/latih-tubi`). | 08 | 02.3 | no |
| E2E-M25-06 | Latency 2 s → shell loading then hero and cells; fault on #1 → M01 global error convention and no partial cell. | 09, 35 | 02.4 | yes |
| E2E-M25-07 | Admin: the "Bahasa Melayu" grid has 1 / 3 / 4 columns and the "Sejarah" grid 1 / 3 / 4 at 375 / 768 / 1280 (computed `grid-template-columns`); at 1280 the Cikgu Pakar block is at most 920 px wide, centred, and the content column at most 1200 px. | 10 | 03.1, 03.4 | no |
| E2E-M25-08 | Admin: `scrollWidth ≤ clientWidth` at each width; the legend wraps at 375; no content text below 12 px (incl. the four Cikgu pills); every cell at least 44 px tall. | 11 | 03.2 | no |
| E2E-M25-09 | Admin: hover a cell → `translateY(-2px)`, shadow `0 4px 8px rgba(0,0,0,.1)` and pointer cursor; hover the card → border `#c026d3`, lifted 2 px, shadow `0 12px 24px rgba(192,38,211,.12)`; no cell or card has `title` or ARIA attributes; subject names are h2, the card name h4. | 12 | 03.3 | no |
| E2E-M25-10 | Admin: hero h1, paragraph and red gradient with white text. | 13 | 04.1 | no |
| E2E-M25-11 | Admin: four legend pills in order with their copy and text and border colours on white. | 14 | 04.2 | no |
| E2E-M25-12 | Admin: blocks "Bahasa Melayu" then "Sejarah"; the five BM cells in order and the Sejarah cell with their exact texts; no other cell; each cell is one link with the name line and the figures line (12 px, `#475569`). | 15, 16, 19 | 05.1, 05.3 | no |
| E2E-M25-13 | Admin: computed background and border of the cells — the first three BM cells and Sejarah red, Membaca amber, Menulis green. | 17 | 05.2 | no |
| E2E-M25-14 | Pelajarmaju: one block "Matematik" with "Sukatan dan Geometri" (chapter 143) "7 cuba · 43% betul" (red), "Pecahan" (chapter 136) "7 cuba · 57% betul" (amber), "Nombor Bulat hingga 100" (chapter 1) "23 cuba · 83% betul" (green). | 16, 19 | 05.4 | yes |
| E2E-M25-15 | Fixture `m25-ties`, Pelajar 2 (chapters 12, 13, 14, each 10 · 5): three cells of equal accuracy in ascending name order "Aspek Tatabahasa D3" (14), "Kemahiran Membaca D3" (12), "Kemahiran Menulis D3" (13). | 19 | 05.5 | yes |
| E2E-M25-16 | Admin: all six cells have href `/practice/chapter`; click "Kemahiran Menulis" → M05 "Soalan by Chapter" opens; no practice session is created. | 18 | 06.1 | no |
| E2E-M25-17 | Pelajar 2: hero and four pills, no subject block, no cell, no gray cell, no error, and the empty-state block "Belum ada data heatmap." / "Jawab soalan latih tubi dahulu — topik kuat dan lemah anda akan dipaparkan di sini." with the button "Mula Latih Tubi" → `/latih-tubi` (SERVER copy, D24); admin: the pill "Belum cuba" shows and no gray cell exists. | 20 | 07.1, 07.2 | yes (Pelajar 2 part) |
| E2E-M25-18 | Admin, run with `setRandomSeed(1)` and then with two other seeds: Cikgu Pakar block above the hero with the heading and exactly one card whose slug is in {`cikgu-demo-matematik`, `cikgu-demo-bahasa`, `cikgu-demo-sains`}, linking to `/bilik-duta/{slug}`, with the initials, the name (h4), the tagline and the four pills equal to that record's row of §6.7 E; DOM order block → hero → subject blocks; after `mock.reset()` and the same seed twice, the same slug (AC-M25-08.6). | 21, 22, 23, 24, 25 | 08.1, 08.4, 08.6 | no |
| E2E-M25-19 | Admin (any seed): the avatar is 56 × 56 px, `border-radius` 50%, with the gradient `#4338ca` → `#c026d3`, white text and the gold ring; every pill has a computed font size of at least 12 px. | 23, 24 | 08.2 | no |
| E2E-M25-20 | `mock.failNext('/api/duta/recommendations', 500)` → no Cikgu Pakar block; hero and cells still render. | 25 | 08.3 | yes |
| E2E-M25-21 | Click the card → `/bilik-duta/{slug}` of the shown card (the global 404 page while M24 is not built). | 22 | 08.5 | yes |
| E2E-M25-22 | Admin: six cells, displayed attempts 116, correct 45; `heatmap.hiddenForUser(1)` = 3 answers / 1 correct; the D2 chapter and the chapterless answer appear in no cell. | 26, 28 | 09.1 | no |
| E2E-M25-23 | Admin: "Sejarah Tingkatan 5 KSSM" equals M05's Sejarah (40 · 14 · 35 %); the three Darjah 1 cells equal M05's chapter list (18 → 44 %, 5 → 60 %, 10 → 80 %). | 30 | 09.2 | no |
| E2E-M25-24 | `mock.addAnswer` ×2 correct in the D2 chapter (id 4) → still no D2 cell; a third correct → the seventh cell "Kemahiran Mendengar dan Bertutur D2" "5 cuba · 80% betul" (green) between Membaca and Menulis; displayed attempts 121. | 28 | 09.3 | yes |
| E2E-M25-25 | `mock.addAnswer` one wrong answer in the BM T4 chapter (id 87) → after reload "6 cuba · 0% betul" and displayed attempts 117. | 29 | 09.4 | yes |
| E2E-M25-26 | Fixture `m25-bands`, Pelajar 2 (chapters 12, 13, 14, 15, 16): "10 cuba · 40% betul" red, "10 cuba · 50% betul" amber, "100 cuba · 79% betul" amber, "200 cuba · 80% betul" green, "10 cuba · 80% betul" green, in that order. | 27 | 09.5 | yes |
| E2E-M25-27 | M08 S6 of the admin still reads "Tiada topik lemah! Teruskan usaha." while S1 shows four red cells. | 31 | 10.4 | no |
| E2E-M25-28 | Record **all** network requests of the page (admin, S1 loaded and the cells hovered): the requests originating from the S1 view are exactly `/api/buku-nota/heatmap` and `/api/duta/recommendations`; the view's requests are request #1 and #2 of the view and neither is repeated by hovering; any other request belongs to the shell (unread notifications, active tournament, chatbot history load, offline snapshot — live may fetch the snapshot more than once, AUD-M25-13); none to an AI-generation, chatbot-message or external host; no generate, chat or note-creation control. | 34 | 10.1 | no |
| E2E-M25-29 | Admin opens `/buku-nota/heatmap?user_id=3` and `?userId=3` → the admin's own six cells. | 32 | 10.2 | yes |
| E2E-M25-30 | After `mock.reset()`: no M25 store; `heatmap.forUser` for users 1, 4 and 3 returns 6, 3 and 0 cells; opening S1 twice changes no count. | 33 | 10.3 | no |

---

## 13. Open questions

Identical to URS §9 (OQ-M25-01 … OQ-M25-12). **G1 closed 2026-10-03 (user decision): OQ-M25-01, 03, 04 and 12 are closed; the rest were non-blocking.** Earlier note — non-blocking for G1: all — OQ-M25-01 (menu href, role gate: SERVER student-only plus the observed admin, and guests), 02 (ordering), 03 (population rule, minimum 5), 04 (gray cells and the empty state: SERVER evidence, the user may revert the empty-state message), 05 (Cikgu Pakar pick rule: seedable pick among three records), 06 (cell link kept as live), 07 (rounding and format), 08 (time window), 09 (chapter links of the answers), 10 (avatar tokens: resolved), 11 (housekeeping), 12 (the list reported at G1). Owner requests XR-M25-01…08 (§6.8) go through the XL gate; XR-M25-02 (M05 seed; the read itself uses the existing `practice.answers`, the `chapterAggregates` method is optional), XR-M25-03 (M04 anchors), XR-M25-04 (M03 lookup) and XR-M25-05 (M24 contract) must be applied before the M25 build, and XR-M25-01 is applied by the shell task F-19b.
