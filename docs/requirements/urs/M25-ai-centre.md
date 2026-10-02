# M25 — AI Centre (Pusat AI), partial: student screen "Heatmap Topik Lemah" — User Requirements Specification

## 0. Document control

| Field | Value |
|---|---|
| Document | URS — M25 AI Centre (Pusat AI), **partial**: the student screen "Heatmap Topik Lemah" (`/buku-nota/heatmap`, Release 1.0, user decision D15). The other M25 screens (Buku Nota Saya `/buku-nota`, Pusat Nota Ringkas `/pusat-nota-ringkas` and the rest of the AI Centre) are not yet discovered and are appended in later versions (IDs are appended, never renumbered) |
| Version | 1.0 |
| Date | 2026-09-30 |
| Status | **Draft** (awaiting G1). Scope: **"Heatmap Topik Lemah (Release 1.0)"**. No open question blocks the observed scope. The unobservable parts (student view, who may open the page, the population rule that hides three of the admin's answers, ordering ties, gray "Belum cuba" cells, the empty state, the Cikgu Pakar selection rule) are INFERRED or PROPOSED and listed in §9 (OQ-M25-12 is the list reported at G1) |
| Author | product-analyst (agent). §3 Function catalogue, §6 coverage matrix and the reconciliations were compiled by hand from the inventory JSON and the seed snapshot (the writer's session had no script runtime). The check scripts `coverage.cjs` and `trace.cjs` are in the writer's scratchpad `m25-writer/` for the Delivery Lead or the auditor to run; they were **not executed** by the writer |
| Source discovery | [R10-release-1-0-screens.md](../../discovery/R10-release-1-0-screens.md) (Heatmap Topik Lemah = R10 S1: §1–§4, figures §5.1–§5.3, ledger §5.4, responsive §8, defects D-R10-01…06 §8.2, OQ-R10-03…06 §9; the DSKP Heatmap S2 and Laporan Bulanan S3 sections are deferred and ignored here); inventory [`inventory/R10/`](../../discovery/inventory/R10/) (`S1-heatmap-topik-lemah.json` **24** elements, 3 captured states; `SHU-user-shell.json` 372; `_snapshot-2026-09-27.json`, seed snapshot captured **2026-09-27 12:39 MYT**); 3 masked screenshots `docs/discovery/img/R10/heatmap-topik-lemah-*.png` |
| Companion SRS | [srs/M25-ai-centre.md](../srs/M25-ai-centre.md) |
| Related | M01 v1.12 (session guard, canonical accounts 1, 3, 4, 5, 6, global 404 / 403), M02 v1.27 (users), **M03 v1.10** (chapters and subjects: the "topics"), M04 v1.16 (questions and their chapter link), **M05 v1.17** (answer log: §6.14 named queries, §7.2 read contract), M06 v1.4 (fictitious Duta cards, `GET /api/duta/recommendations`), M08 v1.10 (its own "topik lemah", C2), M16 v1.6 (tournament banner), M21 v1.2 (template), M22, M24 (not yet specified), global shells ([design/shells.md](../../design/shells.md) v1.2, DV-SH-03; the student uses the user shell), [design/design-system.md](../../design/design-system.md) **v1.11** §6 (icon rows; none missing, §10.2 of the SRS) |

**Change log**

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-09-30 | First issue (partial M25). Rules applied: D7 (fidelity), D8 (proven completeness), D9 / D10 (deviation rule, accessibility replicates live), D11 / D12 (every figure is a named query over M05's answer log and M03's chapters; M25 owns no store), D14 (no external screen), the AI rule (no AI call is triggered or simulated on this screen) and the privacy rule (the Cikgu Pakar card is a fictitious M24 record). **24/24** S1 content elements covered (21 mapped, 3 excluded with reason), 0 unmapped; the 372 shell elements are excluded as global-shell chrome, with the 2 that render the header title specified by FN-M25-1.1.2. 9 fidelity decisions (§7). |

**Conventions** (as M01–M21)
- Quoted UI copy is the exact live text (BM). The separator in the cell line is the middle dot "·" (U+00B7) with a space on each side.
- **OBSERVED** = seen on live with the admin account (walk-through, inventory state, snapshot, screenshot). **INFERRED** = the most likely live behaviour, not observed; no new UX is invented. **PROPOSED** = a value or behaviour written for the rebuild where live gives nothing; listed in §9 OQ-M25-12 for the Delivery Lead to report at G1.
- **D-R10-nn** = live defect of discovery §8.2; **DV-M25-nn** = fidelity decision (§7): anything not listed there must match live; **XR-M25-nn** = request to another owner (SRS §6.8); **C1–C5** = discovery cross-module conflicts (§5.3).
- **Personal data (privacy overrides fidelity):** the "Cikgu Pakar" card of live is an ambassador profile whose display name and initials are a real person's; they are not written anywhere. The rebuild shows the fictitious M24 record `cikgu-demo-matematik` "Cikgu Demo Matematik" (initials "CM") that M06 already seeds (DV-M25-08). The topic names, subjects and figures are the admin account's own practice aggregates and are not personal. The other accounts named here are the canonical fictitious accounts: "Admin" = `admin@demo.test` (id 1), "Pelajar" = `pelajar@demo.test` (2), "Pelajar 2" = `pelajar2@demo.test` (3, no answers), "Pelajarmaju" = `pelajarmaju@demo.test` (4), "Guru" = `guru@demo.test` (5), "Ibubapa" = `ibubapa@demo.test` (6).
- **Clock:** the single project clock **2026-09-25T15:40:00+08:00**. No S1 figure is time-dependent: the heatmap is all-time (INFERRED, OQ-M25-08), shows no date, and every seeded answer is dated before the clock.

---

## 1. Overview

M25 is the AI Centre ("Pusat AI") of PRESTASIPLUS: a section of the student and teacher menus that groups AI-assisted tools (Cikgu Alesa AI, AI notes, career and psychometric centres). This partial document covers the one M25 screen discovered so far: **"Heatmap Topik Lemah"** (R10 S1, student, Release 1.0). It tells a student which topics are strong and which are weak **in one view**: a red hero with a four-colour legend, then one card per subject with one coloured cell per topic answered ("{n} cuba · {p}% betul"), and above the hero a recommendation block **"Cikgu Pakar Untuk Topik Lemah"** with one ambassador card (an M24 record).

**Routes covered**

| # | Route | Tab title (exact live) | Shell header (title / subtitle) | Admin outcome (observed) |
|---|---|---|---|---|
| S1 | `/buku-nota/heatmap` (new route; no query string) | "Heatmap Topik Lemah" | SHU "Dashboard" / "Selamat datang kembali" on live (→ "Heatmap Topik Lemah", DV-M25-01); page h1 "Heatmap Topik Lemah" | 200, the admin's own data; guest INFERRED → `/login` |
| — | `/heatmap-topik-lemah` (the rebuild's former menu href) | global 404 "404 - Halaman Tidak Dijumpai \| PRESTASIPLUS" | standalone | 404 on live; not registered in the rebuild (DV-M25-09) |

**How the route was found (R10 §1.1).** The student sidebar item is not rendered for the admin, so its href is INFERRED from three points: the identical `<title>` and h1, the "Heatmap Topik Lemah" tab label on `/buku-nota` → `/buku-nota/heatmap`, and the "🌡️ Heatmap Topik" tile ("Visual diagnosis") of `/pusat-nota-ringkas` → `/buku-nota/heatmap`. `GET /heatmap-topik-lemah` (the href in the rebuild's `src/shells/nav/user-nav.ts`) is **404** on live.

**What S1 does not do (OBSERVED).** It has no filter, no form, no pagination, no chart library, no client-side state, no API call of its own and no view counter: a server-rendered CSS grid of links. The only script inside `<main>` is the shell's tournament-banner partial (hidden: no active tournament).

**No AI on this screen.** S1 offers no AI generation, chat or note creation and sends no AI request; the "Cikgu Pakar" block is an ambassador recommendation from M24, not AI output. "Pusat AI" is only the name of the menu section. Nothing on S1 is triggered or simulated as live AI (FN-M25-4.1.5).

**Cross-module ownership (D12).** M25 owns **no store**. Every S1 figure is a named query over: M05's answer log (per-chapter answers and correct answers of the viewer), M03's chapters and subjects (topic and subject names, subject order), and M24's ambassador contract (the card). The session and the role come from M01.

---

## 2. Actors

| Role | Involvement in S1 | Verified |
|---|---|---|
| Pelajar (student) | The sidebar item "Heatmap Topik Lemah" sits in the student-only sub-block of the "Pusat AI" menu; opens S1 for their own answers | Menu label and section OBSERVED (roles-matrix `murid` screenshots, transcribed in `user-nav.ts`); page INFERRED (no student account on lane 3; OQ-M25-01) |
| Admin | Opens S1 directly: 200, sees the admin's own practice data; the item is not in the admin's menu | OBSERVED |
| Guru, Ibu Bapa, Admin Sekolah, PPD / JPN, Penaja, other roles | INFERRED: the route has no role gate seen (the admin passes), so any signed-in role opens it and sees its own answers (mostly none → empty state); the menu item is student-only | INFERRED (OQ-M25-01) |
| Guest | INFERRED: redirected to `/login` like every user-portal page | INFERRED (OQ-M25-01) |
| System (M24 contract) | Supplies the Cikgu Pakar card | OBSERVED (card) / INFERRED (selection rule, OQ-M25-05) |

---

## 3. Functional breakdown (Epic → Feature → Function)

Compiled from the element inventory `S1-heatmap-topik-lemah.json` (24 elements). "EL" lists inventory element IDs (prefix `EL-M25-`; `EL-M25-S1-nnn` is `EL-R10-S1-nnn`). Functions with EL "—" are behaviours (shell entries, access rules, data rules, unobservable or PROPOSED states) with no content element of their own.

### EP-M25-1 — Navigation, shell, access, layout

**FT-M25-1.1 — Menu entry, header and tab titles**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M25-1.1.1 | Sidebar (and drawer below `lg`) item **"Heatmap Topik Lemah"** (`fa-fire`, red) → **`/buku-nota/heatmap`**, in the student-only sub-block of the "Pusat AI" section of the user shell (label, section and order as transcribed in `user-nav.ts`; not shown to the admin, OBSERVED absent from the admin's menu). The rebuild's current href `/heatmap-topik-lemah` is 404 on live and is replaced (DV-M25-09, XR-M25-01). The live href is INFERRED (R10 §1.1); the item is the active item on S1 (INFERRED). Rendered by the global shell; the SHU inventory holds no such element (it is not rendered for the admin) | — | Student | OBSERVED (label, section, absence for the admin) / INFERRED (href, active state) |
| FN-M25-1.1.2 | Shell header title **"Heatmap Topik Lemah"**, subtitle **"Selamat datang kembali"** (live title "Dashboard", D-R10-01 fixed, DV-M25-01; subtitle kept because it is not wrong). Rendered by the global shell from the route's header meta (DV-SH-03); SHU-136 and SHU-137 are excluded as shell chrome in §6.2 | — | Admin (OBSERVED), student (INFERRED) | OBSERVED + DV-M25-01 |
| FN-M25-1.1.3 | Tab title (exact live `<title>`): **"Heatmap Topik Lemah"** (no " - PRESTASIPLUS" suffix on this page) | — | All | OBSERVED |
| FN-M25-1.1.4 | Shell: S1 renders in the **user-portal shell** (coin / point / streak chips, bell, avatar menu are shell). The hidden M16 tournament banner (`tournamentBanner()`, "LIVE:", "MAIN", "DAFTAR"; hidden while no tournament is active) is a shell partial inside `<main>` and not M25 content (EL S1-001–003 excluded in §6.1). S1 has no tab bar, no back link, no filter and no form | — | All | OBSERVED |
| FN-M25-1.1.5 | Inbound links owned by later M25 screens, recorded as constraints on them: the "Heatmap Topik Lemah" tab of `/buku-nota` and the "🌡️ Heatmap Topik" tile of `/pusat-nota-ringkas` both target `/buku-nota/heatmap`. M25 registers the route; the two screens are specified when they are discovered | — | Student, admin | OBSERVED (live links) |

**FT-M25-1.2 — Access and error outcomes**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M25-1.2.1 | A guest opening S1 is sent to `/login` (M01 guard); the S1 API answers `401` | — | Guest | INFERRED (user-portal convention, OQ-M25-01) |
| FN-M25-1.2.2 | Every signed-in role opens S1 and sees the heatmap of its own answers (the admin OBSERVED; others INFERRED); a role with no answers sees the empty state (FN-M25-2.2.6) | — | Admin (OBSERVED); others (INFERRED) | OBSERVED / INFERRED |
| FN-M25-1.2.3 | `GET /heatmap-topik-lemah` renders the global **404** page (M01, standalone): "404", "🔍", h1 **"Halaman Tidak Dijumpai"**, "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?", "Halaman Utama" → `/`, "Mula Latihan" → `/latih-tubi`, "PRESTASIPLUS" | — | All | OBSERVED |
| FN-M25-1.2.4 | Loading and errors: the view shows the shared shell loading behaviour while the mock responds and the M01 global error convention on a mock failure; the live page is server-rendered and has no loading or error copy of its own | — | All | INFERRED (M01 convention) |

**FT-M25-1.3 — Layout, responsive rules and interaction**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M25-1.3.1 | Layout (measured on live, R10 §8.1): content column max 1200 px; hero and subject cards fill the column; the **Cikgu Pakar block max 920 px, centred**; each subject grid `repeat(auto-fill, minmax(200px, 1fr))` with a 0.5 rem gap → **1 / 3 / 4 columns** at 375 / 768 / 1280 px; the legend pills wrap inside the hero (3 lines at 375); the Cikgu card pills wrap | — | All | OBSERVED |
| FN-M25-1.3.2 | No horizontal page scroll at 320–1280 px (live has none); topic cells are at least 44 px tall (live 60 px); **no content text below 12 px** — the 11.52 px Cikgu Pakar pills are lifted (D-R10-04, DV-M25-04); the cell figures line is 12 px and stays | — | All | OBSERVED + DV-M25-04 |
| FN-M25-1.3.3 | Interaction and accessibility replicate live (D10): cells and the card are plain links (`a`) with no `title`, tooltip or added ARIA; heading levels as live (h1 hero, h2 subject, h4 card name); a cell lifts 2 px with a shadow on hover and shows a pointer cursor; no reduced-motion or focus enhancement is added | — | All | OBSERVED |

### EP-M25-2 — Heatmap

**FT-M25-2.1 — Hero and legend**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M25-2.1.1 | Hero (red gradient `#b91c1c` → `#dc2626`, white text, radius 12 px): h1 **"Heatmap Topik Lemah"** (1.4 rem, 700) and the paragraph **"Topik mana anda kuat, mana lemah — semua dalam satu paparan. Klik kotak merah untuk fokus belajar."** | S1-011–012 | Admin (OBSERVED), student (INFERRED) | OBSERVED |
| FN-M25-2.1.2 | Legend, four pills in this order, white background, 2 px coloured border, bold: **"Lemah (< 50%)"** (text `#b91c1c`, border `#fca5a5`), **"Sederhana (50-79%)"** (`#92400e`, `#fcd34d`), **"Mantap (≥ 80%)"** (`#047857`, `#6ee7b7`), **"Belum cuba"** (`#475569`, `#cbd5e1`). The four pills always show, although no "Belum cuba" cell is ever rendered (D-R10-06, DV-M25-05) | S1-013–016 | Admin (OBSERVED), student (INFERRED) | OBSERVED |

**FT-M25-2.2 — Subject blocks and topic cells**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M25-2.2.1 | One block per subject that has at least one cell (white card, border `#e2e8f0`, radius 10 px): h2 = the subject name (1.1 rem, `#1e3a8a`), then the topic grid. Seed (admin): "Bahasa Melayu" (5 cells) and "Sejarah" (1 cell) | S1-017, S1-023 | Admin (OBSERVED), student (INFERRED) | OBSERVED |
| FN-M25-2.2.2 | Topic cell = one link (`a.topic-cell`) with the topic name (semi-bold, 13.6 px; the M03 chapter name without the "Bab n:" prefix) and, below it, **"{n} cuba · {p}% betul"** (12 px, `#475569`); {n} = attempts, {p} = whole-number percent (FN-M25-4.1.2). Seed (admin): "Kemahiran Bahasa Tingkatan 4" "5 cuba · 0% betul"; "Kemahiran Bahasa Tingkatan 5" "38 cuba · 32% betul"; "Kemahiran Mendengar dan Bertutur" "18 cuba · 44% betul"; "Kemahiran Membaca" "5 cuba · 60% betul"; "Kemahiran Menulis" "10 cuba · 80% betul"; "Sejarah Tingkatan 5 KSSM" "40 cuba · 35% betul" | S1-018–022, S1-024 | Admin (OBSERVED), student (INFERRED) | OBSERVED |
| FN-M25-2.2.3 | Cell colour by band of the whole-number percent (background / border): **red** `#fee2e2` / `#fca5a5` for below 50; **amber** `#fef3c7` / `#fcd34d` for 50–79; **green** `#d1fae5` / `#6ee7b7` for 80 and above; **gray** `#f1f5f9` / `#cbd5e1` at opacity 0.7 exists in the live CSS and is never rendered (no data path produces it; OQ-M25-04) | — | All | OBSERVED (red, amber, green) / INFERRED (gray meaning) |
| FN-M25-2.2.4 | Every cell, whatever its colour or subject, links to **`/practice/chapter`** (M05 S4 "Soalan by Chapter" subject index) with no query string, although the hero says "Klik kotak merah untuk fokus belajar" (D-R10-02 replicated, DV-M25-02; OQ-M25-06). Following a cell starts no session | S1-018–022, S1-024 | All | OBSERVED (not followed on live) |
| FN-M25-2.2.5 | Order: subjects ascending by M03 subject order (Bahasa Melayu before Sejarah; alphabetical gives the same result); inside a subject, accuracy ascending — weakest first (OBSERVED 0, 32, 44, 60, 80); ties by topic name ascending | — | All | OBSERVED (order) / INFERRED (rule, ties) |
| FN-M25-2.2.6 | Empty state (a viewer with no shown cell, e.g. Pelajar 2): the hero and the legend show and **no subject block, no cell and no message** renders (INFERRED from a template loop; OQ-M25-04). Gray "Belum cuba" cells are not built: no data path renders them | — | All | INFERRED / PROPOSED |

### EP-M25-3 — Cikgu Pakar Untuk Topik Lemah

**FT-M25-3.1 — Ambassador recommendation block**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M25-3.1.1 | Block (amber gradient `#fef3c7` → white, border `#fde68a`, max 920 px, centred) placed **above the hero**, headed **"🌟 Cikgu Pakar Untuk Topik Lemah"** (0.78 rem, weight 800, `#92400e`; shown in upper case by CSS, DOM text as quoted) | S1-004 | Admin (OBSERVED), student (INFERRED) | OBSERVED |
| FN-M25-3.1.2 | One card = one link (`a.duta-card.tier-bintang`) → `/bilik-duta/{slug}` (M24) holding the avatar, the name, the tagline and four pills, with a decorative "⭐" in the top-right corner (CSS pseudo-element, not DOM text). Live slug `cikgu-maestro-math`; rebuild: the M24 record `cikgu-demo-matematik` (DV-M25-08). Until M24 is built the target renders the global 404 page (XR-M25-05) | S1-005 | All | OBSERVED |
| FN-M25-3.1.3 | Avatar and name: two-letter initials in a **56 × 56 px round avatar** (live renders them as plain unstyled text: D-R10-03 fixed with the tier colours already observed — background `#fef3c7`, text `#92400e`, border `#fde68a`; DV-M25-03), and the name as an h4. Seed: "CM", "Cikgu Demo Matematik" | S1-006 | All | OBSERVED + DV-M25-03 |
| FN-M25-3.1.4 | Tagline **"Maestro Matematik · 22 tahun ajar pelajar B40 capai cita-cita."** and four pills, all at least 12 px (live 11.52 px, D-R10-04, DV-M25-04): **"🥇 Duta Bintang"** (`#fef3c7` on `#92400e`), **"📚 {subject}"**, **"📍 {state}"**, **"⭐ {rating}"** (two decimals). Seed: "📚 Matematik", "📍 Johor", "⭐ 4.92" | S1-005, S1-007–010 | All | OBSERVED + DV-M25-04 |
| FN-M25-3.1.5 | Source and absence: the card is the single result of M24's `GET /api/duta/recommendations` called without a subject (the M06 contract). Live shows a Matematik card to an account with no Matematik cell, so the pick is not tied to the weak topics (INFERRED: random among active `bintang` ambassadors, as M06 BR-M06-27); when the contract returns none or fails, the whole block is absent and the rest of the page is unaffected (INFERRED). The `inspirasi` and `tetamu` card styles are never picked (OQ-M25-05) | — | All | INFERRED |

### EP-M25-4 — Figures, rules and module boundaries

**FT-M25-4.1 — How the cells are computed**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M25-4.1.1 | Aggregation: a cell is one M03 chapter the viewer has answered. **Attempts** = the viewer's answers (any mode, with or without a session) whose question is linked to that chapter (M05 answer log, `chapterId`); **correct** = those with `isCorrect`. Subject and chapter name come from M03. The heatmap is recomputed on every load, over all time (INFERRED: the admin's answers span 19/02 to 19/05/2026 and all appear; OQ-M25-08) and is per viewer | — | Admin (OBSERVED), others (INFERRED) | OBSERVED (values) / INFERRED (rule) |
| FN-M25-4.1.2 | Percent and band: {p} = whole number, rounded half up (`round(100 × correct ÷ attempts)`; OBSERVED 12 of 38 → 32, 8 of 18 → 44); the band is taken on that whole number (below 50, 50–79, 80 and above; the legend copy). Numbers of 1,000 or more use the ms-MY grouping (INFERRED, as M05; OQ-M25-07) | — | All | OBSERVED (6 of 6 cells fit) / INFERRED (edges) |
| FN-M25-4.1.3 | Which answers are shown: (R1) an answer whose question has no chapter link is not grouped; (R2) a chapter with **fewer than 5 attempts is not shown**. With M05's admin anchors (79 BM answers, 40 SEJ) these two rules give exactly the observed 76 BM and 40 SEJ answers: 3 answers, 1 correct, do not appear — 2 answers (1 correct) of the chapter "Kemahiran Mendengar dan Bertutur D2" and 1 wrong answer without a chapter link (C1, DV-M25-06; OQ-M25-03). All other displayed figures equal M05's (M05 S5 chapter list, M05 SEJ 40 / 14) | — | Admin | INFERRED (rule) / OBSERVED (result) |
| FN-M25-4.1.4 | Boundaries: M25 stores nothing; it reads M05 (answers), M03 (names, order) and M24 (card) through their contracts and writes nowhere; the viewer sees only their own answers (no user parameter); opening S1 changes no counter (live has none). M08's own "topik lemah" list (S6, all-time DSKP-SP based) differs for the same account and is not aligned (C2, DV-M25-07) | — | System | OBSERVED / INFERRED |
| FN-M25-4.1.5 | No AI: S1 has no AI generation, chat or note-creation control, sends no AI request and simulates no AI outcome; the shell chatbot (M22) and the AI notes of Buku Nota (later M25 screens) are outside S1. Should a later capture show an AI control here, it is recorded as **not built** (a simulated outcome at most, PROPOSED) | — | System | OBSERVED (no control, no request) |

---

## 4. User stories

Values in the ACs come from the seed (SRS §6.7: the admin's cells are the observed record of 2026-09-27, computed through the named queries of SRS §6.4) at the **project clock 2026-09-25T15:40:00+08:00**. "The admin" = `admin@demo.test` (id 1). Student, other-role and unobserved-rule ACs are **provisional** (no such account on live); INFERRED and PROPOSED behaviour is marked in the AC. Every AC runs at 375×812, 768×1024 and 1280×800.

| ID | Feature | MoSCoW | Story | Functions |
|---|---|---|---|---|
| US-M25-01 | FT-M25-1.1 | Must | As a student, I want the "Heatmap Topik Lemah" entry in my Pusat AI menu and a page whose header and tab title name it, so that I can reach it and know where I am. | FN-M25-1.1.1, FN-M25-1.1.2, FN-M25-1.1.3, FN-M25-1.1.4, FN-M25-1.1.5 |
| US-M25-02 | FT-M25-1.2 | Must | As a user, I want the page to need a session, to open for every signed-in role, and wrong URLs to give the standard 404 page, so that access and errors are predictable. | FN-M25-1.2.1, FN-M25-1.2.2, FN-M25-1.2.3, FN-M25-1.2.4 |
| US-M25-03 | FT-M25-1.3 | Must | As a student on a phone, tablet or desktop, I want the page to fit my screen with readable text and the same interactions as the live page, so that I can use it anywhere. | FN-M25-1.3.1, FN-M25-1.3.2, FN-M25-1.3.3 |
| US-M25-04 | FT-M25-2.1 | Must | As a student, I want the hero and the colour legend, so that I understand what the colours mean. | FN-M25-2.1.1, FN-M25-2.1.2 |
| US-M25-05 | FT-M25-2.2 | Must | As a student, I want my topics grouped by subject and coloured by how well I do, weakest first, so that I see my weak topics at a glance. | FN-M25-2.2.1, FN-M25-2.2.2, FN-M25-2.2.3, FN-M25-2.2.5 |
| US-M25-06 | FT-M25-2.2 | Must | As a student, I want to click a topic and go on to practise, so that I can work on what is weak. | FN-M25-2.2.4 |
| US-M25-07 | FT-M25-2.2 | Should | As a student who has not answered enough questions yet, I want the page to open cleanly without cells, so that I am not shown errors or empty boxes. | FN-M25-2.2.6 |
| US-M25-08 | FT-M25-3.1 | Must | As a student, I want a recommended ambassador teacher card above the heatmap, so that I can find expert help. | FN-M25-3.1.1, FN-M25-3.1.2, FN-M25-3.1.3, FN-M25-3.1.4, FN-M25-3.1.5 |
| US-M25-09 | FT-M25-4.1 | Must | As the owner, I want every cell computed from the student's own answers with fixed, documented rules that agree with the practice module, so that the figures are correct. | FN-M25-4.1.1, FN-M25-4.1.2, FN-M25-4.1.3 |
| US-M25-10 | FT-M25-4.1 | Must | As the owner, I want M25 to store nothing, expose only the viewer's own data and make no AI call, so that the screen stays within its module boundary and the AI rule. | FN-M25-4.1.4, FN-M25-4.1.5 |

### Acceptance criteria

**US-M25-01 — Menu, titles and shell**
- **AC-M25-01.1** Given pelajarmaju (provisional, student menu INFERRED) at 1280px in the user shell, when the sidebar renders, then the "Pusat AI" section lists "Heatmap Topik Lemah" (`fa-fire`, red) whose href is `/buku-nota/heatmap` and not `/heatmap-topik-lemah`; at 375px the drawer lists the same entry with the same href.
- **AC-M25-01.2** Given the admin, when the user-shell sidebar renders, then no "Heatmap Topik Lemah" entry shows (the student-only sub-block, OBSERVED).
- **AC-M25-01.3** Given the admin, when `/buku-nota/heatmap` loads, then the header reads "Heatmap Topik Lemah" / "Selamat datang kembali" (not "Dashboard", DV-M25-01) and the tab title is "Heatmap Topik Lemah".
- **AC-M25-01.4** Given the admin on S1, then the page renders in the user-portal shell, "LIVE:", "MAIN" and "DAFTAR" are not visible, and the page has no tab bar, filter, form or back link.
- **AC-M25-01.5** Given pelajarmaju (provisional) on S1, then the "Heatmap Topik Lemah" sidebar entry is the highlighted (active) item (INFERRED).

**US-M25-02 — Access and errors**
- **AC-M25-02.1** Given no session (provisional, INFERRED), when I open `/buku-nota/heatmap`, then I am sent to `/login`; the S1 API answers 401.
- **AC-M25-02.2** Given the admin, when I open S1, then it renders with the admin's own data; given guru and ibubapa (provisional, INFERRED), then S1 renders without a redirect or a 403 page and shows no cell.
- **AC-M25-02.3** Given any signed-in user, when I open `/heatmap-topik-lemah`, then the global 404 page shows "404", "🔍", "Halaman Tidak Dijumpai", "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?", "Halaman Utama" → `/` and "Mula Latihan" → `/latih-tubi`.
- **AC-M25-02.4** Given a mock latency of 2 s (provisional, INFERRED), when S1 loads, then the shell loading behaviour shows until the hero and blocks render; given a mock fault on the heatmap API, then the M01 global error convention shows and no partial cell renders.

**US-M25-03 — Layout, readability, interaction**
- **AC-M25-03.1** Given the admin, when S1 loads at 375, 768 and 1280px, then the "Bahasa Melayu" grid has 1, 3 and 4 columns, the "Sejarah" grid has the same column counts with one cell, and each subject block is a white bordered card.
- **AC-M25-03.2** Given the admin at 375, 768 and 1280px, then the page has no horizontal scroll (`scrollWidth ≤ clientWidth`), the legend wraps inside the hero, no content text is below 12px (including the four Cikgu Pakar pills, DV-M25-04) and every topic cell is at least 44px tall.
- **AC-M25-03.3** Given the admin on S1, when I hover a topic cell, then it lifts by 2px with a shadow and the cursor is a pointer; no cell or card has a `title` attribute, a tooltip or an added ARIA attribute; the subject names are h2 and the card name is an h4 (as live).
- **AC-M25-03.4** Given the admin at 1280px, then the Cikgu Pakar block is at most 920px wide and centred in the content column, and the content column is at most 1200px wide.

**US-M25-04 — Hero and legend**
- **AC-M25-04.1** Given the admin, when S1 loads, then the hero shows the h1 "Heatmap Topik Lemah" and the paragraph "Topik mana anda kuat, mana lemah — semua dalam satu paparan. Klik kotak merah untuk fokus belajar." on the red gradient (`#b91c1c` → `#dc2626`) with white text.
- **AC-M25-04.2** Given the admin, then the legend shows four pills in this order: "Lemah (< 50%)" (text `#b91c1c`, border `#fca5a5`), "Sederhana (50-79%)" (`#92400e`, `#fcd34d`), "Mantap (≥ 80%)" (`#047857`, `#6ee7b7`), "Belum cuba" (`#475569`, `#cbd5e1`), each on a white background with a 2px border.

**US-M25-05 — Topics by subject**
- **AC-M25-05.1** Given the admin, when S1 loads, then the blocks read "Bahasa Melayu" then "Sejarah"; the "Bahasa Melayu" cells are, in order: "Kemahiran Bahasa Tingkatan 4" "5 cuba · 0% betul"; "Kemahiran Bahasa Tingkatan 5" "38 cuba · 32% betul"; "Kemahiran Mendengar dan Bertutur" "18 cuba · 44% betul"; "Kemahiran Membaca" "5 cuba · 60% betul"; "Kemahiran Menulis" "10 cuba · 80% betul"; "Sejarah" holds one cell "Sejarah Tingkatan 5 KSSM" "40 cuba · 35% betul"; no other cell shows.
- **AC-M25-05.2** Given the admin, then the first three "Bahasa Melayu" cells and the "Sejarah" cell are red (`#fee2e2`, border `#fca5a5`), "Kemahiran Membaca" is amber (`#fef3c7`, border `#fcd34d`) and "Kemahiran Menulis" is green (`#d1fae5`, border `#6ee7b7`).
- **AC-M25-05.3** Given the admin, then each cell is a single link whose first line is the topic name without a "Bab n:" prefix and whose second line is the figures line in 12px `#475569`.
- **AC-M25-05.4** Given pelajarmaju (provisional, fictitious M05 seed), when S1 loads, then one block "Matematik" shows the cells, in order: "Sukatan dan Geometri" "7 cuba · 43% betul" (red), "Pecahan" "7 cuba · 57% betul" (amber), "Nombor Bulat hingga 100" "23 cuba · 83% betul" (green).
- **AC-M25-05.5** Given the fixture `m25-ties` (provisional, INFERRED tie rule), when S1 loads for Pelajar 2, then the three cells of equal accuracy appear in ascending topic-name order.

**US-M25-06 — Practise from a cell**
- **AC-M25-06.1** Given the admin on S1, then all six cells (red, amber and green; both subjects) have the href `/practice/chapter`; when I click "Kemahiran Menulis", then the M05 subject index "Soalan by Chapter" opens and no practice session starts.

**US-M25-07 — Empty state**
- **AC-M25-07.1** Given Pelajar 2 (provisional, INFERRED), when S1 loads, then the hero and the four legend pills show, no subject block, no cell (and no gray "Belum cuba" cell), no message and no error.
- **AC-M25-07.2** Given the admin, then the legend shows the pill "Belum cuba" while no gray cell renders (D-R10-06, DV-M25-05).

**US-M25-08 — Cikgu Pakar**
- **AC-M25-08.1** Given the admin, when S1 loads, then a block headed "🌟 Cikgu Pakar Untuk Topik Lemah" shows one card linking to `/bilik-duta/cikgu-demo-matematik` with the initials "CM", the name "Cikgu Demo Matematik" (h4), the tagline "Maestro Matematik · 22 tahun ajar pelajar B40 capai cita-cita." and the pills "🥇 Duta Bintang", "📚 Matematik", "📍 Johor", "⭐ 4.92".
- **AC-M25-08.2** Given the same card, then the initials sit in a 56×56px round avatar (background `#fef3c7`, text `#92400e`, DV-M25-03) and every pill text is at least 12px (DV-M25-04).
- **AC-M25-08.3** Given the ambassador contract fails or returns none (provisional, INFERRED), when S1 loads, then the whole Cikgu Pakar block is absent while the hero and the cells render.
- **AC-M25-08.4** Given the admin, then the order inside the content is: the Cikgu Pakar block, then the hero, then the subject blocks.
- **AC-M25-08.5** Given the admin (provisional until M24 is built), when I click the card, then `/bilik-duta/cikgu-demo-matematik` opens (M24; the global 404 page while M24 is not built).

**US-M25-09 — Figures and rules**
- **AC-M25-09.1** Given the admin, then S1 shows exactly 6 cells whose "cuba" figures add up to 116 (5 + 38 + 18 + 5 + 10 + 40); M05's admin totals (BM 79 answers / 32 correct, SEJ 40 / 14 = 119 / 46) exceed the displayed ones (116 / 45) by exactly 3 answers, 1 correct: 2 answers (1 correct) of the chapter "Kemahiran Mendengar dan Bertutur D2", below the 5-attempt minimum, and 1 wrong answer with no chapter link; none of the three appears in any cell.
- **AC-M25-09.2** Given the admin, then the "Sejarah Tingkatan 5 KSSM" cell equals M05's Sejarah figures (40 answers, 14 correct, 35%), and the three Darjah 1 cells equal M05's chapter list (18 answers, 44.4% → "44%"; 5, 60% → "60%"; 10, 80% → "80%").
- **AC-M25-09.3** Given the chapter "Kemahiran Mendengar dan Bertutur D2" holds 2 answers (1 correct) and two correct answers are added through `mock.addAnswer` (provisional, INFERRED rule), when S1 reloads, then that chapter has 4 attempts and still no cell; when a third correct answer is added (5 attempts, 4 correct), then a seventh cell "Kemahiran Mendengar dan Bertutur D2" "5 cuba · 80% betul" (green) shows between "Kemahiran Membaca" and "Kemahiran Menulis" (equal accuracy 80%, ties by name) and the displayed attempts add up to 121.
- **AC-M25-09.4** Given one more wrong answer in the chapter "Kemahiran Bahasa Tingkatan 4" added through `mock.addAnswer` (provisional, INFERRED), when S1 reloads, then that cell reads "6 cuba · 0% betul" and the displayed attempts add up to 117.
- **AC-M25-09.5** Given the fixture `m25-bands` (provisional, INFERRED edges), when S1 loads for Pelajar 2, then the five cells read, in order: "10 cuba · 40% betul" (red), "10 cuba · 50% betul" (amber), "100 cuba · 79% betul" (amber), "200 cuba · 80% betul" (green; 159 of 200 = 79.5% rounds to 80) and "10 cuba · 80% betul" (green).

**US-M25-10 — Boundaries and no AI**
- **AC-M25-10.1** Given the admin loads S1 and hovers the cells, when the requests initiated by the S1 view are recorded, then none goes to an AI, chatbot or external endpoint (`/api/ai…`, `/chatbot…`, `/api/cikgu…`, any host other than the app), and the page shows no generate, chat or note-creation control (the shell chatbot of M22 is not part of S1).
- **AC-M25-10.2** Given the admin (provisional, INFERRED), when I open `/buku-nota/heatmap?user_id=3` or `?userId=3`, then S1 shows the admin's own six cells and the API ignores the parameter.
- **AC-M25-10.3** Given `mock.reset()`, then M25 registers no store (no heatmap collection) and the cells for users 1, 4 and 3 equal the named query Q-M25-HM-CELLS over M05's aggregates and M03's names (6, 3 and 0 cells); opening S1 twice changes no count.
- **AC-M25-10.4** Given the admin, when the M08 screen S6 of the admin loads, then it still reads "Tiada topik lemah! Teruskan usaha." while S1 shows four red cells (two definitions, not aligned, DV-M25-07), and M25 changes nothing in M08.

---

## 5. UI expectations

| Screen | Key states (screenshots in `docs/discovery/img/R10/`) | Behaviour notes (per-width detail in SRS §10) |
|---|---|---|
| S1 | default with data (`heatmap-topik-lemah-desktop/-tablet/-mobile.png`, admin data; the Cikgu Pakar name and initials are masked in the images); empty (PROPOSED, not captured); Cikgu Pakar absent (INFERRED, not captured) | grid 1 / 3 / 4 columns; legend wraps at 375; Cikgu Pakar block max 920 px; pills at least 12 px (DV-M25-04); round avatar (DV-M25-03); header title fixed (DV-M25-01). |

Loading: the data view shows the shared shell loading behaviour while the mock responds (M01 convention; live is server-rendered). A mock failure uses the global error convention of M01. Non-functional requirements are in SRS §11.

---

## 6. Coverage matrix (completeness proof)

Source: `docs/discovery/inventory/R10/S1-heatmap-topik-lemah.json` (generated 2026-09-27; 3 captured states) and `SHU-user-shell.json`. Compiled element by element by hand; `coverage.cjs` in the writer's scratchpad `m25-writer/` re-checks it (every inventory id has exactly one row or one range; every "Covered by" is an existing Function or an exclusion; the FN "EL" column agrees with the matrix). The tournament-banner partial inside `<main>` (S1-001–003) is an M16 / shell partial and is excluded. The user shell (SHU) is chrome owned by the global shell (design/shells.md) and by the modules whose entries it carries: **all its elements are excluded**, and the 2 that render the header title name the Function that specifies it (FN-M25-1.1.2). "Content" quotes the DOM text as captured (`<masked>` = discovery masks of the ambassador's name and initials).

**Summary**

| Set | Elements | Mapped to an M25 Function | Excluded (with reason) | Unmapped |
|---|---|---|---|---|
| S1 — `/buku-nota/heatmap` | 24 | 21 | 3 (M16 tournament banner "LIVE:", "MAIN", "DAFTAR", EL S1-001–003) | 0 |
| **M25 content (S1)** | **24** | **21** | **3** | **0** |
| SHU — user-portal shell (chrome of S1) | 372 | 0 | 372 (global shell chrome; 2 render the header title specified by FN-M25-1.1.2) | 0 |

**24/24 M25 content elements covered (21 mapped, 3 excluded with reason), 0 unmapped.** Including the shell: 396/396 elements accounted for (21 mapped, 375 excluded with reason), 0 unmapped. 9 of the 30 Functions cover S1 elements and FN-M25-1.1.2 is named by the shell rows; the other 20 are behaviour-only Functions (menu entry and titles rendered by the shell, access rules, layout rules, data rules, unobservable or PROPOSED states).

### 6.1 M25 content elements

#### S1 — `/buku-nota/heatmap` (24 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M25-S1-001 | text | hidden-only | "LIVE:", fa-circle (tournament banner template, hidden: no active tournament) | Excluded — M16 tournament banner (shell partial inside main) |
| EL-M25-S1-002 | text | hidden-only | "MAIN" (tournament banner template) | Excluded — M16 tournament banner (shell partial inside main) |
| EL-M25-S1-003 | text | hidden-only | "DAFTAR" (tournament banner template) | Excluded — M16 tournament banner (shell partial inside main) |
| EL-M25-S1-004 | text | visible-default | "🌟 Cikgu Pakar Untuk Topik Lemah" | FN-M25-3.1.1 |
| EL-M25-S1-005 | link | visible-default | card: "<masked> <masked> Maestro Matematik · 22 tahun ajar pelajar B40 capai cita-cita. 🥇 Duta Bintang 📚 Matematik 📍 Johor ⭐ 4.92", → /bilik-duta/cikgu-maestro-math | FN-M25-3.1.2, FN-M25-3.1.4 |
| EL-M25-S1-006 | heading | visible-default | h4 "<masked>" (ambassador name) | FN-M25-3.1.3 |
| EL-M25-S1-007 | badge | visible-default | "🥇 Duta Bintang" | FN-M25-3.1.4 |
| EL-M25-S1-008 | badge | visible-default | "📚 Matematik" | FN-M25-3.1.4 |
| EL-M25-S1-009 | badge | visible-default | "📍 Johor" | FN-M25-3.1.4 |
| EL-M25-S1-010 | badge | visible-default | "⭐ 4.92" | FN-M25-3.1.4 |
| EL-M25-S1-011 | heading | visible-default | h1 "Heatmap Topik Lemah" | FN-M25-2.1.1 |
| EL-M25-S1-012 | text | visible-default | "Topik mana anda kuat, mana lemah — semua dalam satu paparan. Klik kotak merah untuk fokus belajar." | FN-M25-2.1.1 |
| EL-M25-S1-013 | badge | visible-default | "Lemah (< 50%)" | FN-M25-2.1.2 |
| EL-M25-S1-014 | badge | visible-default | "Sederhana (50-79%)" | FN-M25-2.1.2 |
| EL-M25-S1-015 | badge | visible-default | "Mantap (≥ 80%)" | FN-M25-2.1.2 |
| EL-M25-S1-016 | badge | visible-default | "Belum cuba" | FN-M25-2.1.2 |
| EL-M25-S1-017 | heading | visible-default | h2 "Bahasa Melayu" | FN-M25-2.2.1 |
| EL-M25-S1-018 | link | visible-default | "Kemahiran Bahasa Tingkatan 4 5 cuba · 0% betul", → /practice/chapter | FN-M25-2.2.2, FN-M25-2.2.4 |
| EL-M25-S1-019 | link | visible-default | "Kemahiran Bahasa Tingkatan 5 38 cuba · 32% betul", → /practice/chapter | FN-M25-2.2.2, FN-M25-2.2.4 |
| EL-M25-S1-020 | link | visible-default | "Kemahiran Mendengar dan Bertutur 18 cuba · 44% betul", → /practice/chapter | FN-M25-2.2.2, FN-M25-2.2.4 |
| EL-M25-S1-021 | link | visible-default | "Kemahiran Membaca 5 cuba · 60% betul", → /practice/chapter | FN-M25-2.2.2, FN-M25-2.2.4 |
| EL-M25-S1-022 | link | visible-default | "Kemahiran Menulis 10 cuba · 80% betul", → /practice/chapter | FN-M25-2.2.2, FN-M25-2.2.4 |
| EL-M25-S1-023 | heading | visible-default | h2 "Sejarah" | FN-M25-2.2.1 |
| EL-M25-S1-024 | link | visible-default | "Sejarah Tingkatan 5 KSSM 40 cuba · 35% betul", → /practice/chapter | FN-M25-2.2.2, FN-M25-2.2.4 |

### 6.2 Shell elements

The shell is chrome owned by the global shell (00-global-ui, design/shells.md) and by the modules whose entries it carries. Every element is excluded with its reason. The admin's user shell renders no M25 menu entry (the student-only "Heatmap Topik Lemah" item is not rendered for the admin), so no shell element carries an M25 entry; the header title elements name FN-M25-1.1.2. Ranges are inclusive and follow the inventory numbering.

#### SHU — user-portal shell (chrome of S1) — 372 elements, all excluded (2 carry the header title specified by FN-M25-1.1.2)

| Elements | Count | Covered by |
|---|---|---|
| EL-M25-SHU-001 – EL-M25-SHU-055 | 55 | Excluded — user shell chrome (shells.md; owning modules): sidebar, Pusat AI block, section menus |
| EL-M25-SHU-056 – EL-M25-SHU-056 | 1 | Excluded — user shell menu; "Mohon Keluarga Angkat" entry owned by M21 (FN-M21-1.1.2) |
| EL-M25-SHU-057 – EL-M25-SHU-135 | 79 | Excluded — user shell chrome (shells.md; owning modules): sidebar, drawer toggle |
| EL-M25-SHU-136 – EL-M25-SHU-137 | 2 | Excluded — user shell header; S1 title specified by FN-M25-1.1.2 (DV-M25-01): "Dashboard" (live title) and "Selamat datang kembali" |
| EL-M25-SHU-138 – EL-M25-SHU-342 | 205 | Excluded — user shell chrome (shells.md; owning modules): header chips and bell, drawer, bottom nav, footer, install prompts |
| EL-M25-SHU-343 – EL-M25-SHU-372 | 30 | Excluded — chatbot widget (M22) |

---

## 7. Fidelity deviations

These are the **only** intended differences from the live site or decisions on live contradictions (D7). Rule D9 (user, standing, pre-approved): where live is broken or contradictory, fix it minimally; where it works, replicate it exactly; when unsure, follow live. D10: accessibility replicates live. D14: no external platform screen. The AI rule: nothing is triggered or simulated as live AI. Privacy overrides fidelity for personal data. Precedents applied: header title from the route (shell DV-SH-03, M21 DV-M21-06); no content text below 12 px (M21 DV-M21-07); one owner per record (D12). Rows "Rejected — replicate live" were considered and deliberately not changed.

| ID | Discovery | Category | Live behaviour (evidence) | Rebuild behaviour (specified) and alternatives | Status |
|---|---|---|---|---|---|
| DV-M25-01 | D-R10-01 | Wrong title | The user-shell header of S1 shows "Dashboard" / "Selamat datang kembali" while the page is "Heatmap Topik Lemah" (EL SHU-136–137). | Header title **"Heatmap Topik Lemah"**; subtitle "Selamat datang kembali" kept (not wrong) (FN-M25-1.1.2). Alternatives: (a) also replace the subtitle by the hero text — rejected (not minimal; the hero already shows it); (b) keep "Dashboard" — rejected (wrong title). | Approved (D9) |
| DV-M25-02 | D-R10-02 | Candidate — promise not kept | The hero says "Klik kotak merah untuk fokus belajar", but every cell (red, amber, green; any subject) links to the generic `/practice/chapter` subject index, not to its topic (EL S1-018–022, S1-024). | **Rejected — replicate live** (FN-M25-2.2.4): the link works and is the same for every cell, a consistent live limitation. Alternatives: (a) link each cell to its subject's chapter list `/practice/chapter/{CODE}` — rejected (it still would not focus the topic, needs a level parameter, and the two-subject seed shows the same behaviour on live); (b) link the red cells to the chapter quiz — rejected (chapters are locked or unlocked by M05 rules the page cannot know, and a cell is a chapter only through M03). The user may still prefer (a) (OQ-M25-06). | Rejected — replicate live |
| DV-M25-03 | D-R10-03 | Visual bug | The Cikgu Pakar avatar initials render as plain unstyled text: the circle styles exist only under `.duta-av .av-img`, while `.duta-card .av-img` sets only the 56 × 56 size and the font size (screenshot; inventory S1-005). | A 56 × 56 px round avatar with the initials centred, using the tier colours already observed on the card — background `#fef3c7`, text `#92400e`, border `#fde68a` (FN-M25-3.1.3). Alternatives: (a) the site's `.duta-av` gradient — rejected (its colours were never captured, so it would invent values); (b) keep the plain text — rejected (visual bug). | Approved (D9) |
| DV-M25-04 | D-R10-04 | Unreadable text | The four Cikgu Pakar pills are 11.52 px (0.72 rem) at every width (snapshot `measure`: 4 elements under 12 px). | Minimum **12 px** for the pills; layout otherwise unchanged (FN-M25-1.3.2, FN-M25-3.1.4). The cell figures line (12 px) is not below the limit and stays. Alternative: keep — rejected (unreadable text is a D9 defect; the E2E rule forbids it). | Approved (D9) |
| DV-M25-05 | D-R10-06 | Candidate — legend pill without a cell | The "Belum cuba" legend pill shows although no gray cell is rendered for the admin (all six topics have answers). | **Rejected — replicate live** (FN-M25-2.1.2, 2.2.6): the pill is part of the fixed legend and the gray style exists in the live CSS; whether a gray cell ever renders is unobserved (OQ-M25-04). Alternatives: (a) hide the pill while no gray cell shows — rejected (changes the observed legend); (b) render gray cells for unanswered topics — rejected (new scope). | Rejected — replicate live |
| DV-M25-06 | C1 (OQ-R10-06) | Candidate — 3 answers not in S1 | M05 records the admin at 119 answers (BM 79 / 32 correct, SEJ 40 / 14); S1 shows 116 (BM 76, about 31 correct; SEJ 40 / 14). The rule that leaves 3 BM answers out is not observable. | **Not a D9 fix; a population rule chosen so the observed cells are reproduced exactly (FN-M25-4.1.3):** (R1) an answer with no chapter link is not grouped; (R2) a chapter with fewer than 5 attempts is not shown. Effect on the M05 anchors: the 2 answers of "Kemahiran Mendengar dan Bertutur D2" (1 correct) and 1 wrong answer without a chapter link are hidden = 3 answers, 1 correct. Alternatives: (a) the minimum could be 3 or 4 — the observation cannot tell them apart (the smallest shown cell has 5, the hidden chapter has 2); 5 is chosen because both 5-attempt cells sit exactly at the observed minimum; (b) hide the Darjah 2 chapter or all Darjah 2 answers — rejected (arbitrary); (c) change M05's anchors so no answer is hidden — rejected (would alter M05's observed S8 / S5 figures; seeds are never tuned); (d) show the Darjah 2 chapter — rejected (contradicts the observed six cells). No seed value is tuned. | Decision — reported at G1 (OQ-M25-03) |
| DV-M25-07 | C2 | Candidate — M08 says no weak topics | For the same account M08 S6 shows "Tiada topik lemah! Teruskan usaha." while S1 shows four "Lemah" cells. | **Rejected — replicate both.** The two pages use different definitions (M08: DSKP-SP weak topics within its window, "Sudah 127 hari tiada latihan"; S1: all-time chapter accuracy below 50%) and are never side by side (FN-M25-4.1.4). Alternative: align M08 with S1 — rejected (changes an approved observed page). | Rejected — replicate live |
| DV-M25-08 | — (privacy, C3) | Personal data | The Cikgu Pakar card holds a real ambassador's display name and two-letter initials (masked by discovery), with the observed slug `cikgu-maestro-math`. | The card is the fictitious M24 record already seeded by M06: slug `cikgu-demo-matematik`, name "Cikgu Demo Matematik", initials "CM"; tier, tagline, subject, state and rating stay as observed ("Duta Bintang", "Maestro Matematik · 22 tahun ajar pelajar B40 capai cita-cita.", "Matematik", "Johor", "4.92"). Alternative: seed the observed slug — rejected (M06 G1 already seeds one M24 record; D12 gives one owner). | Approved (privacy override) |
| DV-M25-09 | C4 | Broken link (in the rebuild) | `src/shells/nav/user-nav.ts` item `heatmap-topik-lemah` targets `/heatmap-topik-lemah`, which is 404 on live (R10 probe 1). | The item targets `/buku-nota/heatmap` (FN-M25-1.1.1, XR-M25-01 to the shell task F-19b); `/heatmap-topik-lemah` is not registered and renders the global 404 page as live (FN-M25-1.2.3). Alternative: register `/heatmap-topik-lemah` as an alias — rejected (adds a route that does not exist on live). | Approved (D9) |

**Deviation count:** 5 approved (01, 03, 04, 08, 09), 1 decision reported at G1 (06), 3 rejected / replicate live (02, 05, 07). No displayed figure of the admin changes: the six cells equal the observed ones.

### 7.1 Count reconciliation (summary)

Every figure of discovery §5.1 was recomputed by hand from the seed (SRS §6.5, checks R01–R11): **(a) computed through the named queries of SRS §6.4 over M05's answers and M03's chapters** — the six admin cells (5 / 0%, 38 / 32%, 18 / 44%, 5 / 60%, 10 / 80%, 40 / 35%), their bands and order, the total of 116 displayed answers; **(b) other owners' contracts** — M05's admin totals (119 answers, BM 79 / 32, SEJ 40 / 14) and chapter list (BM Darjah 1 chapters 18, 5, 10), M24's card; **(c) the population rule** — DV-M25-06 accounts for the 3 answers between 119 and 116 (1 correct between 46 and 45). No D9 fix changes a figure, and no display constant is used.

---

## 8. Out of scope

| Item | Owner / reason |
|---|---|
| "DSKP Heatmap" (school admin, `/admin-sekolah/dskp-heatmap`) and "Laporan Bulanan" (`/admin-sekolah/laporan-bulanan`) | Deferred (discovery R10 S2 / S3: 500 for the admin, no owner assigned); not part of this document |
| Buku Nota Saya `/buku-nota` (AI notes, tabs "Senarai" and "Heatmap Topik Lemah"), Pusat Nota Ringkas `/pusat-nota-ringkas` and the rest of the AI Centre | Later M25 versions (not yet discovered) |
| Any AI generation, chat or note creation; the shell chatbot | Not on S1 (FN-M25-4.1.5); chatbot M22; Cikgu Alesa M13 |
| The ambassador record, its page `/bilik-duta/{slug}` and its selection rule | M24 (XR-M25-05) |
| Practice sessions, the answer log, chapter unlocking, the `/practice/chapter*` pages | M05 (S1 only links to `/practice/chapter`) |
| Chapters and subjects | M03 |
| The user-shell menu, header and footer, the tournament banner | Global shell (task F-19b for the href), M16 |
| Real server-side authorisation, caching and analytics | Backend phase (SRS §11.1) |

---

## 9. Open questions

1. **OQ-M25-01 Menu href, roles and guests (discovery OQ-R10-05).** The student item is not rendered for the admin, so its href `/buku-nota/heatmap` is INFERRED (same title, tab and tile); the active state, the guest redirect and whether teachers, parents and other roles may open S1 are also INFERRED (any signed-in role, own answers). Non-blocking; the route is observed and the 404 of the old href is fixed (DV-M25-09).
2. **OQ-M25-02 Ordering.** Subjects by M03 order and cells by accuracy ascending are observed on 2 subjects and 5 cells; alphabetical subject order gives the same result; ties by topic name are INFERRED.
3. **OQ-M25-03 Population rule (discovery OQ-R10-06, C1).** R1 (no chapter link → not grouped) and R2 (fewer than 5 attempts → not shown) reproduce 116 / 76 / 40 exactly (DV-M25-06); a minimum of 3 or 4 fits too. Needs the seed conditions of XR-M25-02 and XR-M25-03. Perlu pengesahan.
4. **OQ-M25-04 Gray "Belum cuba" cells and the empty state (discovery OQ-R10-03).** No gray cell and no empty account were observed. The rebuild renders no gray cell, and shows the hero and legend only for a viewer with no shown cell (INFERRED), with no message. If a message is wanted it must be PROPOSED copy; none is invented.
5. **OQ-M25-05 Cikgu Pakar selection and absence (discovery OQ-R10-04, C3).** One card was observed; the rule, 0 or several cards and other tiers are unknown. Default: the M06 pick (random among active `bintang` ambassadors), one card, block hidden when none or on failure (INFERRED). M24 is not yet specified (XR-M25-05).
6. **OQ-M25-06 Cell link target (D-R10-02).** Replicated as live (`/practice/chapter`, DV-M25-02); the user may prefer the subject-level link `/practice/chapter/{CODE}`.
7. **OQ-M25-07 Rounding, band edges and number format.** Whole-number percent rounded half up, band on the rounded value (fits 6 of 6 cells), ms-MY grouping from 1,000 attempts: INFERRED.
8. **OQ-M25-08 Time window and recomputation.** All-time (the admin's answers date from 19/02 to 19/05/2026 and all appear), recomputed on every load: INFERRED; no cache is built.
9. **OQ-M25-09 Chapter links of the answers (XR-M25-02, XR-M25-03).** The admin's cells need the SPM-pool questions of sessions A2–A5 to carry chapter links (SEJ T5 Bab 1, BM T4 Bab 1, BM T5 Bab 99 and one chapterless wrong answer). Pelajar's (id 2) heatmap depends on the chapter links of its SPM-pool questions, which no owner has fixed: no E2E asserts its cells.
10. **OQ-M25-10 Avatar tokens (DV-M25-03).** The fix uses the observed tier colours; the designer confirms at G2.
11. **OQ-M25-11 Housekeeping for the Delivery Lead.** The module index of `docs/requirements/URS.md` and `SRS.md` lists M25 as `M25-pusat-ai.md`, while this file is `M25-ai-centre.md`; suggested TRACKER additions for M25: route `/buku-nota/heatmap` (this screen) and, from the discovery, `/buku-nota` and `/pusat-nota-ringkas`. The shell item "Buku Nota Saya" targets `/buku-nota-saya` in `user-nav.ts` while `/buku-nota` is 200 on live (Perlu pengesahan; XR-M25-01 b).
12. **OQ-M25-12 INFERRED and PROPOSED items — reported at G1:** the sidebar href and active state; the guest redirect; any signed-in role may open the page; ordering and ties; the population rule R1 + R2 with the minimum of 5; percent rounding and band edges; the empty state; the absence of gray cells; the Cikgu Pakar pick rule, single card and absence; the cell link kept as live; the loading and error convention; the fictitious M24 card; the fixtures `m25-bands` and `m25-ties`.
