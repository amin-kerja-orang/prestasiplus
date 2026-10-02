# M25 partial — Heatmap Topik Lemah (`/buku-nota/heatmap`) — Independent Audit (AUD, round 1)

| Field | Value |
|---|---|
| Documents audited | `docs/requirements/urs/M25-ai-centre.md` v1.0 (30 FN, 10 US, 37 AC, 9 DV, matrix 24 + 372 rows), `docs/requirements/srs/M25-ai-centre.md` v1.0 Draft (35 FR, 14 BR, 1 V, 4 named queries, 2 endpoints, 30 E2E, 5 SEC, 8 XR, §6.5 reconciliation R01–R11) |
| Evidence | `docs/discovery/R10-release-1-0-screens.md` (S1), `inventory/R10/S1-heatmap-topik-lemah.json`, `SHU-user-shell.json`, `_snapshot-2026-09-27.json`, `img/R10/heatmap-topik-lemah-tablet.png` (viewed). Live re-walk on 2026-10-02/03 (about 17:50–18:05 UTC), browser lane 3 (`playwright3`), admin account, read-only. Secondary (tag SERVER): `D:\Dev Projects\prestasiplus-reference\backend` (`BukuNotaController`, `buku-nota-heatmap.blade.php`, `routes/web.php`, `layout.blade.php`). Cross-module: M01, M03, M04, M05, M06, M08, M16 SRS, `src/shells/nav/user-nav.ts`, `src/modules/m03-curriculum/mock/data/curriculum.json`. |
| Live pages opened | `/buku-nota/heatmap` at 1280, 768 and 375 (computed styles, DOM order, links, attributes, grid columns, cell sizes, text under 12 px, hover, network), `/heatmap-topik-lemah` (404), `/buku-nota` (tab links), admin user-shell menu. Login used the admin login from the credentials file (not recorded here). |
| Safety | GET navigations only plus the one `POST /login`. No cell, card or form was submitted or followed. Hover was the only interaction. One reload of the heatmap returned a transient 500 (about 1 min) and then recovered; no state was changed. |
| Privacy | The live admin menu and card contain a real ambassador's name. It was not copied anywhere. A repo grep for its tokens returns 0 hits in `docs`, `src`, `e2e`. The docs use the fictitious M24/M06 record `cikgu-demo-matematik` (verified in M06 SRS l.333). |
| Scripts | `<scratchpad>/m25-audit/trace.cjs` (FN ↔ US ↔ FR ↔ AC ↔ E2E closure, provisional list, §3.1). Inventory ↔ matrix and text equality checked by node one-liners on the inventory JSON. |
| Auditor | Independent audit agent (not an author) |

## Verdict: **FAIL**

| Severity | Count |
|---|---|
| Critical | 0 |
| Major | 1 |
| Minor | 7 |
| Info | 4 |

Fail reason: 1 Major (AUD-M25-01, non-deterministic Cikgu Pakar card asserted by non-provisional ACs / E2Es). Everything observed on live matches the docs; the issues are about determinism, a wrong justification, stale citations and evidence gaps.

## What is good

- **Coverage is complete.**
  - All 24 S1 elements have one matrix row. Kind, status and text equal the inventory on every row, including the 3 hidden banner words (excluded as M16 partial).
  - SHU ranges 55 + 1 + 79 + 2 + 205 + 30 = 372. SHU-136 / 137 are "Dashboard" / "Selamat datang kembali" as stated. SHU-343–372 are the chatbot.
  - 9 FNs carry S1 elements, 1 (FN-1.1.2) is named by the shell rows, 20 are behaviour-only. This agrees with the URS §6 summary.
- **Traceability is clean (independent script).**
  - Counts: 30 FN, 37 AC, 35 FR, 30 E2E.
  - Every FN is in exactly 1 US and at least 1 FR. Every URS AC is in an FR and an E2E. No E2E AC lies outside its FRs.
  - The provisional list (13: 01, 03, 04, 06, 14, 15, 17, 20, 21, 24, 25, 26, 29) equals the flagged rows. SRS §3.1 has no drift.
- **Live figures and copy are exact (re-read live).**
  - Tab title "Heatmap Topik Lemah" (no suffix). Header "Dashboard" / "Selamat datang kembali" (D-R10-01 confirmed).
  - Cikgu Pakar block above the hero, heading and tagline, pills "🥇 Duta Bintang", "📚 Matematik", "📍 Johor", "⭐ 4.92".
  - Hero h1 and paragraph exact, gradient `#b91c1c → #dc2626`, radius 12 px, h1 22.4 px.
  - Legend: 4 pills in order, text / border colours exact, white background.
  - h2 "Bahasa Melayu" and "Sejarah" (17.6 px, `#1e3a8a`). Six cells, text, order and band colours exact (red `#fee2e2` / `#fca5a5`, amber `#fef3c7` / `#fcd34d`, green `#d1fae5` / `#6ee7b7`).
  - Every cell is an `a` with only `href` and `class` (no `title`, no ARIA) → `/practice/chapter`. Figures line 12 px `#475569`, topic name 13.6 px.
  - Hover: translateY(-2px), shadow `0 4px 8px rgba(0,0,0,.1)`, pointer.
  - Cikgu block wrapper max 920 px, centred. Avatar 56 × 56 with no circle / colour (DV-03 premise true). Four pills at 11.52 px (DV-04 premise true).
  - 1280: 4 columns (217 px), content 958 px. 768: 3 columns (211 px), card 645 px. 375: 1 column (276 px), card 272 px, legend wraps to 3 lines, cells 60 px.
  - No horizontal scroll at any width (scrollWidth = clientWidth).
  - No gray cell, no tab bar, no form. The admin menu has no Heatmap item.
  - `/heatmap-topik-lemah` is 404 with the exact BM copy and links "Halaman Utama" → `/`, "Mula Latihan" → `/latih-tubi`.
  - `/buku-nota` has tabs "Senarai" and "Heatmap Topik Lemah" → `/buku-nota/heatmap`.
  - The live cell values are unchanged since the 2026-09-27 snapshot.
- **Reconciliation by hand (R01–R11) re-computed: all pass.**
  - The 7 M05 admin rows sum to 118 / 46. Shown: 116 / 45. Hidden: 3 / 1. M05 anchors check: 18/8, 5/3, 10/8 plus D2 2/1; A3 34/11 → 33/11 plus 1 wrong; A4 5/1; A5 5/0.
  - Pelajarmaju: 23/19, 7/3, 7/4 from M05 sessions M1–M4. Order 43, 57, 83. AC-09.3, 09.4 and 09.5 arithmetic holds. Tie order "…D2" before "…Menulis" is correct.
  - Counts quoted in the change log, SRS header and TRACKER entry match the tables.
- **Deviations.** DV-01 (title), DV-04 (12 px, M21 DV-07 precedent), DV-08 (privacy, fictitious M06 record) and DV-09 (404 href) are justified under D9 and minimal. DV-05 and DV-07 (replicate) are sound. DV-06 is correctly marked a population-rule decision, not a D9 fix, with alternatives.
- **Cross-references.** M05 `practice.answers` and `addAnswer` exist (§7.2 / §6.13). `Q-ANS-USER-CHAPTER` and `chapterAggregates` do not exist yet and are requested as XR-M25-02. M03 `/api/subjects` is #28 and #14 is admin-only, as stated, and `chaptersByIds` is requested as XR-M25-04. M06 #21 and BR-M06-27 are quoted correctly. M08 S6 copy ("Tiada topik lemah!", "Sudah 127 hari") is present in M08. M16 banner as stated.
- **INFERRED / PROPOSED labelling** is consistent in URS §3, §9 and SRS §8.2, apart from AUD-M25-03.

## Findings

| ID | Severity | Doc & section | Issue | Live / doc evidence | Required fix |
|---|---|---|---|---|---|
| AUD-M25-01 | **Major** | URS AC-M25-08.1, AC-08.2, AC-08.4, AC-08.5; SRS §6.7 E ("With the default seed the admin and every other viewer receive this card"), BR-M25-09, E2E-M25-18 / 19 (non-provisional) | **The Cikgu Pakar card is asserted as one fixed record, but the pick is specified as random.** BR-M25-09 takes BR-M06-27: random among active `bintang` ambassadors. M06 §6.7 seeds three such ambassadors: `cikgu-demo-matematik`, `cikgu-demo-bahasa`, `cikgu-demo-sains`. The M25 call has no `subject`, so no preference applies. E2E-18 / 19 set no seed, so on a default run a Bahasa or Sains card can appear and AC-08.1 fails (CM, "Matematik", "Johor", "4.92"). Live does show one Matematik card, but the rule is INFERRED. | M06 SRS l.187, l.333, l.371 (`?subject=&seed=`); SRS §6.9 lists `mock.setRandomSeed(n)`; NFR-M25-02. | Pick one: (a) E2E-18 / 19 / 21 and AC-08.1 / 08.2 / 08.5 call `mock.setRandomSeed(<value that yields cikgu-demo-matematik>)`, with the value pinned by M06 / M24 (XR-M25-05); or (b) assert "one card of the seeded `bintang` set" and run the exact-text checks per record; or (c) M24 defines a fixed default for the M25 call. Remove or rewrite the sentence in §6.7 E. |
| AUD-M25-02 | Minor | URS DV-M25-03 alternative (a) and "colours never captured"; OQ-M25-10; SRS §10.1 "Avatar" | **The justification for rejecting the site's own avatar style is factually wrong.** Live CSS (readable on the page) defines `.duta-av .av-img {border-radius:50%; background:linear-gradient(135deg,#4338ca,#c026d3); color:#fff; font-weight:700; display:flex; centred}` and `.av-img.tier-bintang {box-shadow:0 0 0 2px #fbbf24, 0 4px 10px rgba(251,191,36,.3)}`. The discovery (D-R10-03) suggested exactly this. The doc instead builds a new combination of tier colours (`#fef3c7` / `#92400e` / `#fde68a`) taken from other elements. That is not the "minimal" fix when live ships a ready style that the card fails to apply. | Live computed styles read on 2026-10-03 (the live avatar span is 56 × 56, radius 0, no background, text `#334155` 18.4 px). R10 §8.2 D-R10-03. | Correct the DV-03 text. Either adopt the live `.duta-av` gradient and ring (observed values), or keep the tier colours and say why. The avatar font size (live 1.15 rem) should also be stated. |
| AUD-M25-03 | Minor | URS FN-M25-1.2.2, §2 Actors, OQ-M25-01; SRS BR-M25-01, FR-M25-07, §9, AC-M25-02.2 / E2E-M25-04 (guru, ibubapa part) | **"Any signed-in role opens the page" is labelled INFERRED but the only available code evidence points the other way, and it is not recorded.** In the secondary server copy the route sits in `Route::middleware(['auth','role:pelajar'])` (routes/web.php l.1111; the closing group l.1251 is inside it). The live admin gets 200, so the admin may bypass the role gate, which fits a student-only page. The doc's reasoning ("the admin passes, so every role passes") is the weaker reading. | `D:\Dev Projects\prestasiplus-reference\backend\routes\web.php` l.1111–1251 (SERVER, secondary, reconstruction). | Keep INFERRED, but add the alternative to OQ-M25-01: student only (admin bypass), other roles get 403 / redirect. Mark the guru / ibubapa ACs as provisional against that alternative. |
| AUD-M25-04 | Minor | URS AC-M25-10.1; SRS FR-M25-34, BR-M25-12, NFR-M25-07, E2E-M25-28 | **"Only `/api/buku-nota/heatmap` and `/api/duta/recommendations`" cannot hold for the whole page.** The live page also issues the shell's own calls: `/notifikasi/unread-count`, `/api/tournament/active`, `/chatbot/history?session_id=…`, `/api/offline/snapshot` (and a Cloudflare beacon). The rebuild shell will do the same (bell, banner, chatbot, offline). The wording "requests initiated by the S1 view" is ambiguous, and the E2E as written may fail on shell traffic. | Live network list, this audit. R10 §5.4 and §6. | State the filter: requests originating from the M25 view component, or "no AI / external-host request among all requests, and S1 adds no other request than #1 and #2". Mention that M22 chatbot history is shell, not S1. |
| AUD-M25-05 | Minor | URS §0 Related; SRS §0 Related, §6.1, XR-M25-02 (M05 v1.17), XR-M25-08 (M08 v1.10), `E2E`/AC text citing M01 v1.12, M04 v1.16 | **Cross-module citations are stale.** Current headers: M01 v1.16, M04 v1.19, M05 v1.20, M08 v1.18 (M03 v1.10, M06 v1.4, M16 v1.6 and design-system v1.11 are current). The facts quoted from them were re-checked and still hold. | SRS version rows read on 2026-10-03. | Update the Related lines and the XR targets to the current versions (doc-only). |
| AUD-M25-06 | Minor | URS FN-M25-3.1.2 – 3.1.4, §10.1 "Card and pills"; SRS §10.1 ("exact tokens not captured: designer to take them from the screenshot") | **Observable card tokens are missing, and the SRS says they were not captured.** Live CSS: card padding 1 rem 1.15 rem, radius 14 px, gap 0.85 rem; hover border `#c026d3`, lift 2 px, shadow `0 12px 24px rgba(192,38,211,.12)`; ⭐ pseudo-element opacity 0.6; non-tier pills background `#f1f5f9`, text `#64748b`, 0.72 rem, padding 0.15 / 0.55 rem; tagline 0.82 rem `#475569`; name 1 rem / 800 `#0f172a`. FN-M25-1.3.3 describes the cell hover only, so the **card's own hover (colour change and lift) is undocumented**. Rebuild drift is likely if the designer works from a masked screenshot. | Live computed style / stylesheet read. | Add these values to §10.1 and add the card hover to FN-1.3.3 / FR-12 (replicate live, D10). |
| AUD-M25-07 | Minor | SRS §6.7 A and C, §6.8 XR-M25-04, URS FN-2.2.2, AC-05.1, AC-05.4 | **Chapter names are not unique in M03, and ids are given only for some chapters.** The seed has "Kemahiran Menulis" twice (ids 2 and 29) and "Pecahan" twice (136 and 152). The docs give ids for 413, 35, 36, 1 but not for BM D1 Bab 3 "Kemahiran Menulis", MATH D1 Bab 2 / 3, BM T4 Bab 1 (id 87), SEJ T5 Bab 1 (id 382) or BM D2 Bab 1 (id 4). A name lookup would be ambiguous and the `m25-ties` / `m25-bands` fixtures pick chapters "in M03 order". | `src/modules/m03-curriculum/mock/data/curriculum.json` (names 87, 382, 4, 143, 136 / 152, 2 / 29). | Give M03 chapter ids for every seeded cell in §6.7 A and C and in XR-M25-04. Group by id, never by name. |
| AUD-M25-08 | Minor | URS FN-M25-2.2.6, OQ-M25-04, DV-M25-05; SRS BR-M25-08, §8.2 | **Evidence in the secondary copy was not used or recorded.** The reconstructed controller / view show a different design: gray tiles for every unattempted chapter of a practised subject, subjects sorted by name, tiles in chapter order, no minimum of attempts, and an empty-state message ("Belum ada data heatmap." with a "Mula Latih Tubi" button). Live contradicts the first four (no gray, accuracy order, a hidden D2 chapter), so the copy is not evidence of live behaviour and the doc's choice is right. But the empty-state message is a candidate for OQ-M25-04 (PROPOSED copy exists in a reference build) and the gray tile logic explains why the legend pill exists. | `BukuNotaController::heatmap`, `buku-nota-heatmap.blade.php`. It is a reconstruction (CLAUDE.md: secondary only). | Add a line to OQ-M25-04 / DV-M25-05 recording this as non-authoritative evidence; keep "no message" as the default. No behaviour change. |
| AUD-M25-09 | Info | URS §1, §8 | **Scope wording.** "Groups AI-assisted tools (… career and psychometric centres)" comes from `user-nav.ts`, not from live. The live admin "Pusat AI" section holds other items not listed as later M25 screens or as owned elsewhere: Kamus AI, Pendamping Motivasi, Doa & Motivasi, Aktiviti Advisor, Whiteboard → Quiz (`/pusat-ai/*`) and "Semakan Nota Master" (`/admin/master-notes`). SHU rows 001–055 are excluded as generic shell chrome without naming owners. | SHU inventory SHU-017–041; live menu. | Optional: add these routes to §8 as "owner not yet assigned" and tag the "career and psychometric" phrase INFERRED. Also keep OQ-M25-11 on `/buku-nota-saya` vs `/buku-nota` (confirmed: `/buku-nota` is 200 live and the nav still has `/buku-nota-saya`). |
| AUD-M25-10 | Info | URS DV-M25-02, OQ-M25-06 | **DV-02 is a borderline call.** CLAUDE.md §6 lists "contradictory rules" as broken, and the hero promises "Klik kotak merah untuk fokus belajar" while all cells go to the generic index. The doc replicates (consistent live limitation) and lists the alternatives; "it still would not focus the topic, needs a level parameter" is asserted but not verified. The rationale is acceptable and the user may override via OQ-06. | R10 §8.2 D-R10-02 recommended a minimal subject-level link or "follow live". | None required. The Delivery Lead can confirm at G1. |
| AUD-M25-11 | Info | URS §0 "Author"; SRS §0 | The writer's `coverage.cjs` / `trace.cjs` were not executed (no script runtime). This audit re-ran an independent closure and an inventory ↔ matrix check: 0 errors (see "What is good"). | `<scratchpad>/m25-audit/trace.cjs`. | None. |
| AUD-M25-12 | Info | — | Not re-opened live: guest redirect to `/login` (requires logout, a write-shaped GET), non-admin / student views, empty state, gray cells, a different Cikgu Pakar pick, `/bilik-duta/{slug}` and `/practice/chapter` follow-through (forbidden). All stay INFERRED / PROPOSED in the docs as labelled. | Safety rules. | None. |

## Scripted checks (summary)

| Check | Result |
|---|---|
| Inventory ↔ matrix (S1) | 24 rows = 24 elements; kind, status and text equal; 3 hidden-only excluded as the M16 banner. |
| SHU ranges | 372 = 55 + 1 + 79 + 2 + 205 + 30; boundary elements match (041 "Semakan Nota Master", 056 "Mohon Keluarga Angkat", 136 / 137 header, 343 chatbot). |
| `trace.cjs` | FN 30, AC 37, FR 35, E2E 30; 0 FN without US or FR; 0 AC without FR or E2E; 0 E2E AC outside FRs; provisional 13 = 13; §3.1 no drift. |
| Reconciliation R01–R11 | Re-computed by hand: all pass, including 116 / 45 shown, 3 / 1 hidden, 118 / 46 over 7 rows, Pelajarmaju 37 / 26. |
| Live vs doc (copy, colours, links, attributes, columns, widths, text size) | All equal except the undocumented items in AUD-M25-02 and AUD-M25-06. |
| Privacy grep | 0 hits for the live ambassador's name tokens; all docs / fixtures use the fictitious record. |

## Recommended routing

Route AUD-M25-01 to the M25 writer (product-analyst) with M06 / M24 for the seed value. Route AUD-M25-02 – 08 to the same writer for v1.1 (AUD-M25-07 touches M03 XR-M25-04). AUD-M25-09 – 12 are optional. After v1.1, run round 2 as a doc-only check (live evidence above is enough).

---

## Round 2 (URS / SRS v1.1, 2026-10-03)

### Scope and method

- **Documents audited:** `urs/M25-ai-centre.md` v1.1 and `srs/M25-ai-centre.md` v1.1.
- **Evidence:** the round-1 live reads (computed styles, network list, stylesheet rules, hover), the server copy (`routes/web.php` l.1111–1396, `EnsureRole`, `BukuNotaController`, the heatmap view), M03 `curriculum.json`, M05 `practice.answers` (code), M06 SRS §6.7 and §12. No new live session was needed.
- **Scripts:** `m25-audit/trace.cjs` re-run: FN 30, FR 35, E2E 30. 0 FN without US or FR, 0 AC without FR or E2E, 0 E2E AC outside its FRs, provisional 13 = 13. The Delivery Lead's coverage result (24/24 + 372) was not re-derived, because the matrix rows are unchanged.

### Verification of each fix

| ID | Result | Evidence |
|---|---|---|
| AUD-M25-01 | **Closed.** | AC-08.1 / 08.2 / 08.5 and E2E-18 / 19 / 21 assert "one of the three `bintang` slugs" and compare the card with its own row. New AC-08.6 asserts that the same seed gives the same card. The SRS §6.7 E sentence is rewritten. M06 §12 does state `setRandomSeed(1)` as the default for the suites. The seed value that yields the Matematik record is left to M06 / M24 (XR-M25-05 e), which is acceptable. |
| AUD-M25-02 | **Closed.** | DV-M25-03 and SRS §10.1 now carry the live `.duta-av .av-img` gradient `#4338ca → #c026d3`, white text, weight 700, 1.15 rem and the `tier-bintang` ring. All equal the live stylesheet values read in round 1. |
| AUD-M25-03 | **Closed.** | FN-1.2.2, FR-07, BR-M25-01, new AC-02.5 and E2E-04. They state the SERVER gate `role:pelajar`, the admin passing on live (OBSERVED bypass, written down), `EnsureRole` redirecting other roles to their home (`/guru`, `/admin`, `/pelajar`) and 403 on the API (labelled INFERRED). This agrees with `EnsureRole`. |
| AUD-M25-04 | **Closed, one nit (AUD-M25-13).** | E2E-28, FR-34 and NFR-07 separate the view's 2 calls from the shell's 4. |
| AUD-M25-05 | **Closed.** | The Related lines carry M01 v1.16, M04 v1.19, M05 v1.20 and M02 v1.32 (versions read 2026-10-03). |
| AUD-M25-06 | **Closed.** | §10.1 now has the card, pill and hover tokens. They equal live: padding 1 rem 1.15 rem, radius 14 px, hover `#c026d3` + 2 px + `0 12px 24px`, pills `#f1f5f9` / `#64748b`, 0.72 rem → 12 px by DV-04. FR-12 includes the card hover. |
| AUD-M25-07 | **Closed.** | The cells are keyed by M03 chapter id (143, 136 not 152, 1, 87, 382, 35, 36, 413) in §6.7, AC-05.4 and the tie-break rule. The ids and names equal `curriculum.json`. |
| AUD-M25-08 | **Closed.** | OQ-M25-04 records the SERVER evidence and states that it is a reconstruction. The empty state is promoted from INFERRED to SERVER (D24): "Belum ada data heatmap." / hint / "Mula Latih Tubi" → `/latih-tubi`. FR-20, BR-M25-08, AC-07.1 and E2E-17 agree. The user may revert it at G1 (§8.2). The gray tiles are still not rendered, which matches live. |
| M05 read change | **Accepted.** | `practice.answers(userId, filter = {})` exists in the code (`repository/practice.ts` l.1048). XR-M25-02 is re-scoped to Could. §6.1, §6.4 and the repository contract agree. The 118 / 46 and 116 / 45 reconciliation is unchanged. |
| AUD-M25-09 – 12 | Handled or noted. | Informational. |

### Regression check

- Counts are consistent: 39 ACs (URS), 35 FR, 14 BR, 4 queries, 2 endpoints, 30 E2E (13 provisional), 5 SEC, 8 XR.
- The provisional list is unchanged and still matches the flagged rows. AC-02.5 and AC-07.1 are marked provisional / SERVER and their E2Es (04, 17) are provisional for those parts.
- No real name was introduced. A repo grep for the ambassador's name tokens returns 0 hits. The three cards are the M06 fictitious records.
- The live-observed facts of round 1 are untouched.

### New findings

| ID | Severity | Doc & section | Issue | Evidence | Required fix |
|---|---|---|---|---|---|
| AUD-M25-13 | Minor | SRS E2E-M25-28 ("6 requests in all, none repeated") | Live loaded `/api/offline/snapshot` twice on S1, plus a Cloudflare RUM beacon POST (static assets excluded). "6, none repeated" is therefore not a live fact, and the test could fail on a harmless repeat. | Live network list, round 1 (items 10, 16, 17, 18, 19, 23). | Reword to "the S1 view's requests are exactly #1 and #2; shell calls may repeat, and none goes to an AI, chatbot-message or external host". Drop the exact count of 6. |
| AUD-M25-14 | Info | SRS §6.7 C, XR-M25-04 ("id 152 = MATH D3 Bab 2") | `curriculum.json` confirms ids 136 (Bab 3) and 152 (Bab 2) are both "Pecahan" in subject 3, but the file has no level on chapters (`educationLevelId` null), so "D3" for 152 is not verifiable from the data audited. The id-keying itself is correct. | `curriculum.json` chapters 136, 152. | Optional: cite the M03 level source, or drop "D3". |

### Round 2 verdict: **PASS**

| Severity | Open |
|---|---|
| Critical | 0 |
| Major | 0 |
| Minor | 1 (AUD-M25-13; fixable in a doc-only pass, not blocking) |
| Info | 1 (AUD-M25-14) |

All round-1 findings are verified closed against live, the server copy and the cross-module docs. G1 can proceed. AUD-M25-13 should be folded into the next doc edit.
