# M03 — Curriculum (Subjects, Levels, Topics) — Independent Audit (AUD)

| Field | Value |
|---|---|
| Stage | AUD (TRACKER §6 step 4) |
| Date | 2026-09-25 |
| Auditor | Independent audit agent on browser lane 2 (`playwright2`). The auditor did not write the URS or SRS. |
| Documents audited | `docs/requirements/urs/M03-curriculum.md` v1.0 · `docs/requirements/srs/M03-curriculum.md` v1.0 |
| Evidence | Live https://prestasiplus.my: own admin login on lane 2, read-only. The page markup, inline scripts and CSS were read in place, and GET-only `fetch()` reads were spaced at least 450 ms apart. Other evidence: `docs/discovery/M03-curriculum.md`, `docs/discovery/inventory/M03/*`, `_curriculum-data.json`, and the audit screenshots in `docs/qa/audit/img/M03/`. |
| Safety | Read-only throughout. Nothing was saved, submitted, toggled or deleted. The "Aktif?" switches were never clicked. No practice, quiz or `/jawab` URL was opened. The only client-side reveals were opening tree nodes and opening one inline subtopic edit form. Text was typed into that form and then cancelled. It was not submitted, and the page was reloaded afterwards. Detail pages opened: subject 3, level 10, chapter 91, topic 126 (admin), and 23 student `/topics/{id}` pages (read by GET). Error flashes were produced by GET requests to ids that do not exist. There is no personal data on these screens. The only account string is the system account "Admin PRESTASI+". Shared tools were not modified. The re-inventory output was written to `.playwright-mcp/lane2/aud/` and not to `_raw/`. |

## Verdict: **FAIL**

There are **0 Critical, 8 Major and 13 Minor** findings.

The completeness proof is sound:
- The re-run inventory is identical to the saved captures.
- All 807 content elements are in the matrix.
- The 9 exclusions are correct.
- Traceability is complete.

The failures are in content:
- Some layout and state claims are wrong in ways the prototype would copy: the form button layout, the S7/S8 level list, and the reset behaviour of the subtopic edit form.
- Observable Peta Belajar values were guessed, and most guesses are wrong: the pill colours and the hero labels.
- Three items conflict with D9: DV-M03-08 and DV-M03-02 go beyond fixing a defect, and the reduced-motion behaviour is an accessibility enhancement that D9 says must stay as live.

Every fix is a document edit. A targeted re-audit of the affected items is enough afterwards.

## Summary counts

| Measure | Result |
|---|---|
| Content elements in the URS §6 matrix (script) | **807 / 807** inventory IDs (S1–S14) are present: 0 missing, 0 extra, 0 duplicated. 798 are mapped to an FN and 9 are excluded. |
| Matrix ↔ §3 FN "EL" columns (script) | 807 rows checked in both directions, **0 inconsistencies**. 138 FN rows parsed. |
| The 9 exclusions (S12/S13/S14 -001…003 "LIVE:", "MAIN", "DAFTAR") | **Correct.** They are the hidden tournament-banner template. On S12 it is `x-data` with `fetchActive()` → `/api/tournament/active`, `x-if="t.status === 'registration'"` → "DAFTAR". It belongs to M16 (TRACKER M16 lists `/tournament`, `/liga`, …). |
| Shell exclusions (SHA 199, SHU 365) | The ID ranges add up to 229 and 378. The M03-relevant shell items were checked live: "Peta Belajar" is `nav-item … active` in the sidebar and `drawer-nav-item active` on S14; the bottom nav has "Home" and "Topik" and no Peta Belajar item. |
| Live re-inventory (`inventory.js` + `run-state.js`; 10 saved states: S1 math-t4-topic-open, S1 bm-d1-edit-subtopic, S3@768, S6@375, S7, S9, S12, S13@375, S14@1280, S14@375) | **Totals are identical** in all 10 states (e.g. S1 284/284, S7 244/244, S12 408/408, S14 404/404). The only key differences are live shell values: the server-status tooltips ("Load: 0.38 / 8 cores" vs "0.52") and the notification count button ("10" vs "9", which accounts for the 5-element visible delta on the user pages). There are 0 content differences. |
| Traceability (script) | 138 FN, and all have ≥1 FR. 119 AC, and all have ≥1 E2E. 99 FR, and all have ≥1 E2E. There are 52 E2E, and §12 says each runs at 375/768/1280. There are 0 dangling AC or FR references. |
| Coverage-matrix mappings spot-checked by hand | 30 checked, 30 correct (list below). |
| Claims verified against live | **64 checked: 51 correct, 13 wrong or mislabelled** (list below). |
| Deviations DV-M03-01…09 | All 9 live behaviours were reproduced. 01, 03, 04, 05, 06, 07 and 09 are within D9. **08 and 02 are not clearly defects** (AUD-M03-06, -07). |
| Replicated candidates D-9, D-10, D-11, D-12 | These are correctly kept as live. The "reduced-motion" addition attached to D-10 is invented (AUD-M03-08). |
| Seed data (`_curriculum-data.json` vs live) | All 31 subjects match on code, colour, question count and core flag, and all 11 levels match on code, question count and subject count: 0 differences. The kept live ids 35, 36, 91, 92 (chapters) and 59, 60, 126, 127 (topics) are confirmed. The MATEMATIK→MATH, BAHASA_MELAYU→BM, … code map is confirmed for all 8 codes (AUD-M03-10). The DV-09 counts are confirmed: 334 chapters with number ≥100 in exactly the 11 named trees, 478 repeated topic numbers in 102 chapters. |
| Findings | **Critical 0 · Major 8 · Minor 13** |

## Findings

| ID | Severity | Doc + section | What's wrong | Live evidence | Required fix |
|---|---|---|---|---|---|
| AUD-M03-01 | **Major** | URS FN-1.1.16, AC-04.4; SRS FR-17 ("'Batal' … closes the form, **discards edits**"), E2E-12 | The docs say the inline subtopic edit form's "Batal" discards edits. On live it only hides the form (`@click="editingSubtopic = null"`), and the inputs are not reset. When the same form is opened again, it still shows the unsaved typed text. The same applies to the add-subtopic form: "Batal" hides it and the typed values stay. The values are lost only on a page reload. This is a partial reset. | BM + Darjah 1, subtopic 132: the name was "Mendengar sebutan dan intonasi". It was changed to "AUDIT TEMP", then "Batal" was pressed and the form reopened. The input value was still "AUDIT TEMP". Nothing was submitted and the page was reloaded after the test. | Specify the live behaviour: "Batal" hides the form, and typed values stay until the page reloads. The saved row text is unchanged, so the row shows the stored name. Apply the same to the add form. Update AC-04.1/04.4, FR-17, FR-20 and E2E-11/12. |
| AUD-M03-02 | **Major** | URS FN-2.2.9, AC-13.2 ("in 2 columns"); SRS FR-52 ("2-column grid"), §10 ("S7/S8 level checkboxes 2 columns (as live)") | "Tahap Pendidikan Berkaitan" is **not** a 2-column grid. It is a **single-column list inside a bordered scroll box** (`space-y-2 max-h-64 overflow-y-auto border rounded-lg p-4`). The box is 256 px high and its content is 508 px, so only about 5 levels show and the rest need an inner scroll. Each row is `label.flex … hover:bg-slate-50 p-2`. The discovery narrative made the same mistake. | `/admin/subjects/create` and `/admin/subjects/3/edit` markup. At 1280: box height 256 px, `scrollHeight` 508 px, all 11 labels at x=322 (one column). Screenshot `img/M03/s7-1280-levels-single-column-scroll.png`. | Specify the single-column list in a scroll box with a maximum height of 16 rem (256 px) at every width. Update FN-2.2.9, AC-13.2, FR-52 and §10. Tell the Delivery Lead that discovery §2.7 is wrong. |
| AUD-M03-03 | **Major** | URS AC-31.4 ("buttons are full width, stacked (as live)"); SRS §10 row "S2–S5, S7, S8, S10, S11" ("buttons stacked full width" at 375), FR-99, E2E-52 ("full-width buttons at 375") | None of the 8 forms stacks its buttons. They all use `flex items-center justify-end space-x-3 pt-4 border-t`, with no responsive variant, so "Batal" and the submit button sit **side by side and right-aligned at every width**. The discovery §7 row "full width, stacked" is wrong, and so is its own screenshot caption. | Button containers on S2, S3, S4, S5, S7, S8, S10 and S11 have the same class. At 375 on S2: "Batal" x=88, w=78 and "Simpan Bab" x=178, w=161, on the same row. Discovery `chapter-create-mobile.png` and audit `img/M03/s2-375-buttons-inline.png`. | Specify inline, right-aligned buttons at all widths, as live. Update AC-31.4, §10, FR-99 and E2E-52. The ≥44 px touch-target rule still applies to their height. |
| AUD-M03-04 | **Major** | SRS §6.8 "Peta Belajar pill colours" (BM #EF4444, SAINS #10B981, PI #059669, PM #EC4899, SEJARAH #F59E0B, GEO #0891B2 — "INFERRED (active state not captured)"), §13 Q1, FR-82 | The active pill colours can be observed with one GET per subject, and **6 of the 7 guesses are wrong**. The live values are MATEMATIK #3B82F6, BAHASA_MELAYU **#10B981**, BAHASA_INGGERIS #8B5CF6, SAINS **#F59E0B**, PENDIDIKAN_ISLAM **#14B8A6**, PENDIDIKAN_MORAL **#F97316**, SEJARAH **#EF4444**, GEOGRAFI **#06B6D4**. The markup is `class="subject-pill active text-white" style="background:#…; border-color:#…"`. | `/peta-belajar?subject={CODE}&grade=DARJAH_1` for all 8 codes. Screenshot `img/M03/s14-pend-islam-active-pill-subtitle-1280.png` (teal #14B8A6). | Replace the §6.8 values with the live ones, mark them OBSERVED and close SRS Q1. Update E2E-43 to check at least two non-Matematik pills. |
| AUD-M03-05 | **Major** | SRS FR-81 ("subjectLabel = the subject code title-cased … 'Matematik', 'Bahasa Melayu', **'Pendidikan Islam'**"), §6.8 ("hero labels per FR-81 (title case of the code)"), BR-15; URS FN-5.1.2 | The hero subtitle uses the **pill label**, not the title-cased code. Live reads "Terokai perjalanan **Pend. Islam** — takluki setiap pulau! 🏝️" and "Terokai perjalanan **Pend. Moral** — …". Title case is used only for an unknown code ("Zzz"). The docs specify "Pendidikan Islam" and "Pendidikan Moral", which is wrong copy. | Subtitle text for all 8 subjects at DARJAH_1: Matematik, Bahasa Melayu, Bahasa Inggeris, Sains, **Pend. Islam**, **Pend. Moral**, Sejarah, Geografi. For ZZZ: "Zzz". | FR-81/BR-15: the label is the known subject's pill label (the §6.8 list). An unknown code gives the title case of the code. Add E2E-45/43 cases for Pend. Islam and Pend. Moral. |
| AUD-M03-06 | **Major** (Delivery Lead decision) | URS §7 DV-M03-08, FN-5.1.5, FN-5.1.11, AC-25.2/25.3/25.4/25.6, US-M03-25; SRS FR-83, FR-84, BR-15, §6.9 (icon "📚" default, learner defaults), E2E-43/44/51 | DV-08 turns a **deliberate, consistently applied scope** into a feature. Live hard-codes 4 grade chips (Darjah 1–4). The server whitelists those 4 codes: DARJAH_5, TINGKATAN_1, XYZ and even lower-case `darjah_2` all fall back to Darjah 4, and the "Darjah 4" chip is then shown active, so the page states what it shows. Nothing fails, and there is no dead link or wrong label. The only contradictory part is the "🌍 Geografi" pill, which has no topics at D1–D4. Under D9 ("when unsure, follow live"; "working-but-improvable stays as live"), 7 new grade chips, maps for 5 grades with no known emoji data (so the seed has to invent "📚" icons), and a learner-grade default are new features. There is a second problem: the INFERRED default "the learner's own grade" is contradicted by the observed clamp. On live, a D5–T5 learner would get Darjah 4 whatever their grade. | Grade chips container: 4 `<a>` in `div.flex.gap-2` (no wrap). `?grade=DARJAH_5`, `TINGKATAN_1`, `XYZ` and `darjah_2` → chip "Darjah 4" active with the D4 topics (Nombor Hingga 100 000, Perpuluhan, Geometri). The legacy catalogue has D5 (8), D6 (8), T1 (34), T4 (19) and T5 (10) topics, but no emoji is observable for them. Screenshot `img/M03/s14-sains-grade-d5-served-as-d4-1280.png`. | The Delivery Lead decides. Recommended: **replicate** Darjah 1–4 and the fallback to Darjah 4, and limit DV-08 to the contradictory Geografi pill. Either keep that pill as live, with a note, or narrow the fix. If DV-08 is kept, rewrite its "Live behaviour" column. It should state that the fallback is visible and consistent, and that the rebuild must also set a default for learners above D4. |
| AUD-M03-07 | **Major** (Delivery Lead decision) | URS §7 DV-M03-02 (category "Broken navigation (content unreachable by the UI)"), FN-4.1.2/4.1.3, AC-20.2/20.3/20.6; SRS FR-70/71, E2E-35/36 | The evidence for DV-02 is wrong. The Tingkatan and GEOGRAFI topics are **reachable through the UI**. The default list ("Semua Darjah" + "Semua Subjek", which is also the sidebar's "Topik" target) shows all 125 cards, including every T1/T4/T5 and GEOGRAFI topic (for example ids 63, 67, 69, 73, 74, 86, …). The filter bar only lacks chips for them. That is an incomplete filter, not broken navigation. There is no 404, no dead link and no unreachable content, so adding chips is a new feature under D9. | `/topics`: 125 cards, and the list includes `/topics/69` (Kemahiran Geografi, GEOGRAFI), `/topics/67`, `/topics/73`, … . Subject chips: 7 codes plus "Semua Subjek". Grade chips: "Semua Darjah" plus Darjah 1–6. | The Delivery Lead decides. Either withdraw DV-02 and replicate the live chip set, or re-justify it as a contradictory rule ("Semua Darjah" lists Tingkatan topics that no chip can isolate) and correct the category and evidence text. |
| AUD-M03-08 | **Major** | SRS FR-85 ("with `prefers-reduced-motion` nodes are shown without animation"), NFR-M03-05 (pulse-glow, shimmer and fade-in respect reduced motion), E2E-42 ("with reduced motion all visible at once"); URS §7 D-10 bullet | This is invented behaviour. With `prefers-reduced-motion: reduce` emulated, live still runs `pulse-glow`, still sets `opacity:0` on the islands below the fold (the IntersectionObserver script has no media check), and still uses 0.5 s transitions. The only reduced-motion rule on the page is Font Awesome's, for its own spinner classes. D9 says: "Working-but-improvable behaviour (e.g. accessibility enhancements) stays as live." The claim in 00-global-ui ("the bundle has the query") refers to the Font Awesome CSS. The same pattern exists in M02 NFR-M02-05, so this is a project-wide point. | Emulated reduced motion at 1280: islands 3–5 have opacity "0" until scrolled into view, `.island-card.unlocked` animation is "pulse-glow 2s", and the only `@media (prefers-reduced-motion)` rule is in `font-awesome/6.5.1/css/all.min.css` (`.fa-spin` etc.). | Remove the reduced-motion behaviour from FR-85, NFR-M03-05, E2E-42 and the D-10 bullet, or list it as a DV that the user approves. The Delivery Lead should also settle the project-wide rule, since M02 NFR-M02-05 has the same wording. |
| AUD-M03-09 | Minor | URS FN-1.5.7 (INFERRED, UNVERIFIED COPY), OQ-1; SRS FR-38, BR-18 ("INFERRED, UNVERIFIED COPY"), §8 row "Unknown topic (S5)", E2E-20 | This case is observable. `/admin/curriculum/topics/{unknown}/edit` → 302 `/admin/curriculum` with the red flash "Topik tidak dijumpai." (with `fa-exclamation-circle`, one-time: gone after a reload). The placeholder copy happens to be right, but the tag is wrong, and the state is missing from the inventory and FN-1.1.19. | GET `/admin/curriculum/topics/999999/edit` → final URL `/admin/curriculum`, flash "Topik tidak dijumpai."; after a reload there is no flash. | Mark it OBSERVED and move it from the UNVERIFIED table to the observed §8 copy. Add it to FN-1.1.19 and AC-05. |
| AUD-M03-10 | Minor | URS FN-6.3.4, AC-23.2, OQ-7; SRS BR-16, FR-78, E2E-40 | The "Mula Berlatih" codes for the 6 other subjects are observable, and **all 6 guesses are right**: BAHASA_INGGERIS → `/practice/BI` (topic 12), SAINS → `/practice/SCI` (4), PENDIDIKAN_ISLAM → `/practice/PI` (15), PENDIDIKAN_MORAL → `/practice/PM` (17), SEJARAH → `/practice/SEJ` (18), GEOGRAFI → `/practice/GEO` (69). | GET `/topics/{12,4,15,17,18,69}`: every subtopic card links to the code shown. | Mark all 8 codes OBSERVED and close OQ-7. |
| AUD-M03-11 | Minor | URS FN-2.1.3, AC-10.3; SRS FR-40, §10 S6 row | Below 640 px (`sm`) two S6 cells change. "Soalan" shows the **number only**: the markup is `11688 <span class="hidden sm:inline">soalan</span>`. "Warna" shows the **swatch only**: the hex `<span>` is `hidden sm:inline`. The docs always show "{n} soalan" and swatch + hex. S9 does not do this; "{n} soalan" and "{n} subjek" show at every width. | S6 row 1 at 375: Soalan cell innerText "11688", Warna cell innerText "". Screenshot `img/M03/s6-375-soalan-hex-hidden.png`. | Add both conditional displays (breakpoint `sm`) to FN-2.1.3, FR-40 and §10, and assert them in E2E-21 at 375. |
| AUD-M03-12 | Minor | URS AC-13.2 (placeholder "cth: MATH01"), FN-3.2.4, AC-18.1; SRS FR-64 | Displayed casing: "Kod Subjek" and "Kod Tahap" both carry CSS `uppercase font-mono`, so their placeholders display **"CTH: MATH01"** and **"CTH: Y1"** and typed codes display in upper case. For S10/S11 the docs do not mention the upper-case display at all. The S10/S11 "Kod Tahap" hint also has an `fa-info-circle` icon, which FN-3.2.4 and FR-64 leave out. | S7/S10 input class `… uppercase font-mono`; computed `text-transform: uppercase`. Discovery `subject-create-desktop.png` shows "CTH: MATH01". | State "displayed upper-case (CSS; source 'cth: MATH01' / 'cth: Y1')" and add the S10 upper-case display and hint icon. |
| AUD-M03-13 | Minor | URS FN-3.1.2, FN-3.2.8; SRS FR-57, FR-59, FR-63–68, NFR-M03-06 | The S9–S11 accent colour is **pink**, and this is not specified. "Tambah Tahap" is `from-pink-500 to-pink-600`, as are the "Simpan Tahap" and "Kemaskini Tahap" submits. The S10/S11 input focus rings are `ring-pink-500` and the S9 switch focus ring is `ring-pink-500`. S6–S8 use indigo. The S9 table also uses fixed sizes (`text-xs`, `px-4 py-3`), while S6 uses responsive `text-[9px] sm:text-xs`. | S9, S10 and S11 markup. | Specify the pink accent (and the S9 fixed sizes) in the FRs or §10, or note them in NFR-M03-06. |
| AUD-M03-14 | Minor | URS FN-1.2.2, AC-06.3; SRS FR-25 ("when S2 was opened with both parameters, else `/admin/curriculum`") | The S2 back link and "Batal" pass through **whatever query was given**. `?subject_id=3` alone → `/admin/curriculum?subject_id=3`. It is not reset to `/admin/curriculum`. This is a conditional-line error. | GET `/admin/curriculum/chapters/create?subject_id=3`: both links go to `https://prestasiplus.my/admin/curriculum?subject_id=3`. | FR-25: the back and Batal target keeps the `subject_id` and/or `education_level_id` that S2 received. Add a partial-query case to E2E-15. |
| AUD-M03-15 | Minor | SRS FR-24 ("indentation shrinks below `md`"), §10 S1 row (breakpoint `md` only) | Wrong breakpoint. The S1 tree's indentation, padding and text sizes switch at **`sm` (640 px)**: `ml-4 sm:ml-8`, `pl-2 sm:pl-4`, `text-[10px] sm:text-base`, `p-2.5 sm:p-4`. Only the filter grid (3 columns) and the summary cards (4 across) switch at `md`. | S1 Matematik T4 markup. | §10 S1: breakpoints `sm` (tree, text) and `md` (filter and cards). FR-24: "below `sm`". |
| AUD-M03-16 | Minor | SRS FR-81 ("a full-width bar (yellow→amber, `shimmer`)"), NFR-M03-05; URS FN-5.1.3 ("shimmer") | Live references `animation: shimmer 2.5s infinite`, but there is **no `@keyframes shimmer`** on the page. The Tailwind build, inline styles and Font Awesome were all checked. So the highlight inside the bar never moves, and the bar is static. The docs specify a moving shimmer. | Scan of `document.styleSheets` for a keyframes rule named `shimmer`: none found. The computed `animationName` is "shimmer", but there is nothing for it to run. | Specify a static bar (the white highlight overlay stays still), or add a DV if a visible shimmer is wanted. |
| AUD-M03-17 | Minor | SRS BR-13 ("filters by exact `gradeLevel` … unknown value matches nothing"), FR-70, FR-72 | The S12 filters are **case-insensitive**. `?grade_level=darjah_1` lists the 17 Darjah 1 topics, and **no grade chip is active**, not even "Semua Darjah". The docs describe an exact match and do not say which chip is active for a non-canonical value. | GET `/topics?grade_level=darjah_1`: 17 cards, "Semua Subjek" active, no grade chip active. | BR-13: matching ignores case. FR-70: no grade chip is active when `grade_level` is not one of the canonical codes. |
| AUD-M03-18 | Minor | URS OQ-11; SRS §6.9 "Legacy topics" (placeholders "{topic name} {k}"; "topic 68's subtopic description" only), DATA-M03-06 | The seed gaps can be closed now. The real subtopic names were captured for the 19 topics with more than 3 subtopics (Appendix A below). Subtopic descriptions also exist for topics **4, 69 and 103**, not only 68: 4 → "Mengenal haiwan peliharaan seperti kucing, anjing", "Mengenal haiwan liar seperti harimau, gajah"; 69 → "Membaca dan mentafsir peta", "Rujukan grid"; 103 → subtopic 1 "SK 4.6 Sains Tingkatan 4". | GET `/topics/{id}` for the 19 ids plus 4 and 69. | Seed the Appendix A names and these descriptions instead of placeholders, and narrow OQ-11. The emoji for D5+ topics are still unobservable; see AUD-M03-06. |
| AUD-M03-19 | Minor | URS FN-4.2.3, FN-4.2.4; SRS FR-76 | Several S13 details are missing. The hero description is clamped to **3 lines** (`line-clamp-3`, `text-[11px] sm:text-sm`). The stat icons are coloured: `fa-list` purple-600, `fa-question-circle` green-600, `fa-chart-line` amber-600. The subtopic "Kemajuan" % is purple-600. | `/topics/7` markup. | Add the 3-line clamp and the icon colours. |
| AUD-M03-20 | Minor (Delivery Lead decision) | URS §7 DV-M03-06 (S1 only), SRS FR-24 | DV-06 applies "no text below 12 px" to S1 only, but the same small type is used elsewhere below 640 px: S6 headers and pills `text-[9px]`, S12 "SUBTOPIK:" `text-[9px]`, tick icons `text-[8px]`, chips `text-[10px]`, S13 badges `text-[9px]`, S14 island lines `text-[10px]`. If 9–10 px counts as "unreadable text" under D9 on S1, the rule is applied inconsistently. If only the ellipsis truncation on S1 is the defect, the "≥12 px" half of DV-06 goes beyond the fix. | S6, S12, S13 and S14 markup classes. | The Delivery Lead decides. Either narrow DV-06 to the truncation (keep the live sizes) or extend the size rule to the other M03 screens, and list them. |
| AUD-M03-21 | Minor | SRS FR-02 ("every subject, **including inactive ones**"), BR-08 ("subjects and levels by `order`, then id" tagged **OBSERVED**), URS FN-2.1.9 | These are untagged or mislabelled inferences. No inactive subject exists on live, so whether the S1, S2 and S3 selects list inactive subjects cannot be observed. The sort by `order` cannot be told apart from a sort by id, because `order` = id for every record. Both are stated as fact. | All 31 subjects and 11 levels are active, and order = id (S6/S9 data, `_curriculum-data.json`). | Tag both INFERRED. |

### Deviation verification (URS §7)

| DV | Live defect reproduced? | Within D9? | Note |
|---|---|---|---|
| DV-M03-01 icons | Yes. S6 rows 1–23 render `<i class="book-open …">`, `globe`, … (no glyph); 24–27 `fas fa-quran`/`fa-mosque`/`fa-pen-nib`/`fa-scale-balanced`; 28–29 `<i class="🍽 …">`/`👗` (no glyph); 30–31 `class=" …"`. | Yes (content invisible) | Accepted. |
| DV-M03-02 /topics chips | The chips are missing, **but the content is reachable** (the default list shows all 125). | **Questionable** | AUD-M03-07 |
| DV-M03-03 S6 width | Yes. At 1280 the table is 983 px inside a 911 px scroller. S9 is 911 in 911. | Yes (layout) | Accepted. |
| DV-M03-04 S14 header | Yes. The shell shows "Dashboard" / "Selamat datang kembali" on `/peta-belajar`, and the sidebar item "Peta Belajar" is active. | Yes (wrong title) | Accepted. |
| DV-M03-05 order | Yes. Matematik D1 "3,4,5,6,7,8,1,2"; Perniagaan T5 "1,6,2,7,3,4,5"; BI T2 "1,2,3,903,4"; SK T3 "1,2,902,3,903,4,904…961". | Yes (contradictory numbering) | Accepted. |
| DV-M03-06 S1 mobile | Yes. `h4`/`h5` have `truncate` and `text-[10px]`/`text-[9px]` below `sm`. | Yes for the truncation | See AUD-M03-20 on the size half and AUD-M03-15 on the breakpoint. |
| DV-M03-07 S6 switch | Yes. The S6 `@click` is `active=!active; fetch(…)` with no `.then` or `.catch`. S9 has `.then(r=>{if(!r.ok){active=!active;alert('Gagal kemaskini status')}}).catch(()=>{active=!active;alert('Ralat rangkaian')})`. | Yes (contradictory) | Accepted. The alert texts match exactly. |
| DV-M03-08 Peta grades | The clamp is reproduced (DARJAH_5, TINGKATAN_1, XYZ, `darjah_2` → D4). | **Questionable** (deliberate scope) | AUD-M03-06 |
| DV-M03-09 seed renumber | Yes. 334 chapters ≥100 in BI T2, SCI T3, PSV T2, PSV T3, PJK T1, PJK T2, RBT T2, SK T2, SK T3, BT T1, BT T2; 478 repeated topic numbers in 102 chapters (e.g. Matematik T4 Bab 1 "Topik 1: Fungsi", "Topik 1: Fungsi dan Persamaan Kuadratik", "Topik 2: Persamaan kuadratik"). | Yes (wrong labels) | Accepted as data only, with no form rule added. Note: the repeats come from older topics filed under the wrong chapters (e.g. "Persamaan serentak" under Bab 2 "Asas Nombor", "Hukum indeks" and "Surd dan logaritma" under Bab 3). Renumbering hides this but does not fix it, and that is acceptable. |

**Candidates kept as live:**
- **D-9** Confirmed: every subtopic of the topic links to the same `/practice/{CODE}`, and the badges are `<span>`s. Correctly replicated.
- **D-10** The fade-in is confirmed and correctly replicated. The added reduced-motion behaviour is invented (AUD-M03-08).
- **D-11** "Chapter ID diperlukan." is confirmed exactly. Correctly replicated.
- **D-12** Confirmed: Matematik Tambahan + Darjah 1 and BI + T3 show the empty tree, and the create links point at that pair. Correctly replicated.

## Coverage-matrix mappings checked by hand (30, all correct)

S1-005 (`subject_id` select → 1.1.2), S1-009 (prompt → 1.1.3), S1-020 ("3 / 7" card → 1.1.4), S1-023 (Tambah Bab → 1.1.5), S1-027 (Edit Bab → 1.1.8), S1-031 (Padam Bab → 1.1.9), S1-033 (Topik heading → 1.1.11), S1-041 (Edit Subtopik → 1.1.16), S1-045 (Padam Subtopik → 1.1.17), S1-068 (Tambah Subtopik toggle → 1.1.18), S1-076 (Tambah Topik → 1.1.14), S1-125/126 (flashes → 1.1.19), S2-015 (hint → 1.2.5), S3-020 (Aktif → 1.3.4), S4-004 (context card → 1.4.3), S5-025 (hint → 1.5.5), S6-007 (switch → 2.1.5), S6-062 (flash → 2.1.8), S7-015 (Font Awesome link → 2.2.5), S7-018 (colour text → 2.2.6), S9-083 (flash → 3.1.7), S10-013 (Peringkat select → 3.2.5), S12-012 (MATEMATIK chip → 4.1.3), S12-067 (empty → 4.1.5), S13-026 (Mula Berlatih → 4.2.6), S13-021 (Level 1 badge → 4.2.5), S14-024 (open island → 5.1.6), S14-030 (TERKUNCI → 5.1.7), S14-065 (empty → 5.1.10), SHU-377 ("Dashboard" → 5.1.1 / DV-04).

## Claims verified against live (64)

✔ = correct, ✘ = wrong, and the finding is given.

1. ✔ S1 tab title "Pengurusan Kurikulum - Admin PRESTASIPLUS".
2. ✔ Filter: "-- Pilih Subjek --" + 31 subjects by id, labelled with the BM name; "-- Pilih Tahap --" + Darjah 1…Tingkatan 5, values 1–11; `grid-cols-2 md:grid-cols-3`; "Tapis" `col-span-2 md:col-span-1`.
3. ✔ `?subject_id=3` only → the prompt card (`fa-info-circle`, both texts), with no cards and no tree.
4. ✔ Matematik + T4 → cards "Matematik", "Tingkatan 4", "10", "24 / 0"; Tambah Bab href `…create?subject_id=3&education_level_id=10`.
5. ✔ Chapter block `x-data="{ open: true }"`; topic `{ topicOpen: false, showAddSubtopic: false, editingSubtopic: null }`.
6. ✔ The chapter chevron hides the topics **and** "Tambah Topik" (both are inside `x-show="open"`).
7. ✔ The topic chevron shows the subtopic list, the "Tambah Subtopik" toggle and the form (inside `x-show="topicOpen"`); "Tiada subtopik" is italic.
8. ✔ The chapter description line "Auto-created from textbook coverage audit: T4-BT-MAT---MATEMATIK.pdf" is on Bab 4 (Operasi Set).
9. ✔ BM D1 topic 1 subtopics "Mendengar sebutan dan intonasi", "Bertutur untuk menyatakan permintaan"; edit form pre-filled (name, "Listening to pronunciation and intonation", "Mendengar dengan teliti").
10. ✘ The edit form's "Batal" discards edits (AUD-M03-01).
11. ✔ All confirm texts: bab, topik, subtopik, subjek, tahap pendidikan.
12. ✔ Tooltips "Edit Bab", "Padam Bab", "Edit Topik", "Padam Topik", "Edit Subtopik", "Padam Subtopik", "Edit", "Padam".
13. ✔ Flash "Bab tidak dijumpai." (chapter 999999 and `chapter_id=999999`) and "Chapter ID diperlukan."; red box with `fa-exclamation-circle`; one-time.
14. ✘ "Topik tidak dijumpai." is INFERRED (it is observed, AUD-M03-09).
15. ✔ "Subjek tidak dijumpai." → `/admin/subjects`; "Tahap Pendidikan tidak dijumpai." → `/admin/education-levels`.
16. ✔ `/admin/curriculum/subtopics/132/edit` → 404 (no subtopic pages).
17. ✔ BI + T3 → empty tree with `fa-inbox`, the text, and "Tambah Bab Pertama" to the same pair's create URL.
18. ✔ Chapter order in the Matematik D1, Perniagaan T5, BI T2 and SK T3 trees (DV-05/09 evidence).
19. ✔ S2 without a query: both selects on "-- Pilih … --"; back and Batal → `/admin/curriculum`.
20. ✘ S2 back link without both params → `/admin/curriculum` (AUD-M03-14).
21. ✔ S2 fields, placeholders, `min=1`, hint, textarea rows 4, no Aktif.
22. ✔ S3 chapter 91 values (Matematik, T4, "Fungsi dan Persamaan Kuadratik", "Functions and Quadratic Equations", 1, empty); Aktif checked + hint; "Kemaskini Bab"; back → `?subject_id=3&education_level_id=10`.
23. ✔ S4/S5 context card ("Bab", "Bab 1: Fungsi dan Persamaan Kuadratik", chips Matematik / Tingkatan 4).
24. ✔ S5 topic 126 values ("Fungsi", "Functions", "1", "Konsep fungsi dan graf", empty standard); Aktif + hint; "Kemaskini Topik"; no chapter select.
25. ✘ Form buttons stacked full width on mobile (AUD-M03-03).
26. ✔ S6 "Senarai Subjek", "Jumlah: 31 subjek", "Tambah" → `/admin/subjects/create`.
27. ✔ S6 headers are CSS `uppercase` (source "Ikon", "Nama (BM)", …).
28. ✔ S6 level lines (row 8 "Tingkatan 4, Tingkatan 5"; no line for rows 28–31); Kod pill `bg-slate-100 font-mono`; row 27 hex "#0f766e"; Teras for ids 1–7, Elektif for the rest; "13872" for Matematik.
29. ✘ S6 "Soalan" and hex at every width (AUD-M03-11).
30. ✔ S6 icon tile `background-color:{hex}20`, glyph colour = hex; which rows render (DV-01).
31. ✔ S6 switch: no error handling (DV-07 evidence); S9 switch alerts, exact texts.
32. ✔ S7 `code` maxlength 20, `uppercase font-mono`; hint text; icon default "fas fa-book", placeholder "cth: fas fa-calculator"; link https://fontawesome.com/icons `target="_blank"`.
33. ✘ Placeholder displayed "cth: MATH01" (it displays "CTH: MATH01", AUD-M03-12).
34. ✔ S7 colour `#4f46e5` + read-only `color_text`; inline script copies the value on `input`.
35. ✔ S7 "Subjek Teras (Core Subject)" unchecked + hint; "Susunan Paparan" `min=0`, value 0, `fa-sort` hint.
36. ✘ Level checkboxes in 2 columns (AUD-M03-02).
37. ✔ S8 subject 3 values: "Matematik", "Mathematics", "MATH", "calculator", "#EF4444", core checked, order 3, all 11 levels ticked, "Kemaskini Subjek".
38. ✔ S9 headers upper-case; rows 1/7/10 values; badges blue `fa-child` "Rendah", purple `fa-book-reader` "Menengah Rendah", indigo `fa-user-graduate` "Menengah Atas"; "11396 soalan", "16 subjek", T4 "25 subjek".
39. ✘ S9–S11 accent unspecified (pink; AUD-M03-13).
40. ✔ S10 fields, `maxlength=10`, stage options and values, "cth: KSSR, KSSM" + `fa-book-open` hint, order 0; S11 level 10 values; no Aktif on S10/S11.
41. ✔ S12 tab title "Topik - PRESTASIPLUS"; "Semua Darjah" green `bg-green-600`, "Semua Subjek" `bg-purple-600`; chip hrefs keep the other filter.
42. ✔ S12 125 cards on one page; order by sequence then id (1,3,4,6,7,10,12…,125,2,5,8,…).
43. ✔ S12 card: `from-purple-500 to-pink-500` header, "{n} Subtopik", h3, label; description `line-clamp-2`, omitted for 61 topics; "Subtopik:" CSS uppercase; green `fa-check-circle`; "+1 lagi..."; "Lihat Topik" `fa-eye`; grid `1 / sm:2 / lg:3`.
44. ✔ `?grade_level=DARJAH_1&subject=SAINS` → Haiwan, Hidupan, Tumbuhan, Fizikal dan Bahan; both chips active.
45. ✔ `?subject=GEOGRAFI` → the 5 topics (live order: Kemahiran Geografi, Geografi Tingkatan 4, Bentuk Muka Bumi, Cuaca dan Iklim, Sumber dan Kelestarian).
46. ✘ Exact-match filters (they are case-insensitive, AUD-M03-17).
47. ✔ S13 topic 7: tab title, header, back → `/topics`, hero texts, stat cards `grid-cols-3` at every width, 4 subtopics in order, badges green/yellow/red with `fa-circle`, 0%.
48. ✔ S13 topic 68 description on the hero and the subtopic; `/topics/99999` → 404 "Halaman Tidak Dijumpai".
49. ✔ "Mula Berlatih" `/practice/MATH` (7) and `/practice/BM` (68).
50. ✘ The other 6 codes are INFERRED (all observed and correct, AUD-M03-10).
51. ✔ S14 tab title "Peta Belajar — PRESTASIPLUS" (em dash).
52. ✔ Hero `journey-hero` gradient #059669 → #10B981 → #34D399, radius 2rem; tiles `hidden md:flex`; bar at every width.
53. ✘ Hero label title-cased for PI/PM (AUD-M03-05).
54. ✘ Pill colours for the other 7 subjects (AUD-M03-04).
55. ✔ Matematik active pill `#3B82F6`; inactive `bg-slate-50 text-slate-600`; hrefs keep the current grade.
56. ✔ Grade chip active `from-indigo-500 to-purple-600`; only Darjah 1–4; the fallback to Darjah 4 (DV-08 evidence).
57. ✔ Default (admin) Matematik + Darjah 4: 3 islands (Nombor Hingga 100 000 → `topic_id=38`, Perpuluhan → 39, Geometri locked); "0/3".
58. ✔ Matematik D1: Nombor (1) and Nombor Bulat Hingga 100 (7) open, 3 locked; "0/5".
59. ✔ Island CSS: unlocked #FBBF24 + `pulse-glow`; locked opacity 0.6, `cursor:not-allowed`, a `<div>` (not a link); mastered #34D399; started #60A5FA.
60. ✔ Map: `map-path` is the first child, so the first island (`nth-child(2)`, even) is on the right; `@media (max-width:768px)` centres the islands and hides the path and dots.
61. ✔ Fade-in: opacity 0 → 1, `translateY(30px)`, 0.5 s with `i*0.1s` delay, IntersectionObserver threshold 0.1.
62. ✘ Shimmer animation (it does not run on live, AUD-M03-16).
63. ✔ `?subject=ZZZ&grade=DARJAH_1` → no active pill, "Terokai perjalanan Zzz — …", "Tiada Topik Dijumpai" + text, "0/0", "0%".
64. ✔ Island emoji (B.6 sample): 🔢 Nombor, 🔣 Perpuluhan, 🔤 Huruf, 📖 Membaca dan Menulis, 🐾 Haiwan, 🌿 Hidupan, 🕌 Asas Akidah, 🤲 Ibadah Asas, 💖 Nilai Diri, 👨‍👩‍👦 Diri Saya dan Keluarga.

## Appendix A — Live subtopic names for the legacy topics with more than 3 subtopics (for the §6.9 seed, AUD-M03-18)

| Topic | Subtopics (in order) |
|---|---|
| 8 | Tambah Hingga 10; Tambah Hingga 18; Tolak Hingga 10; Tolak Hingga 18 |
| 10 | Huruf Vokal dan Konsonan; Suku Kata KV dan KVK; Membaca Perkataan Mudah; Menulis Huruf dan Perkataan |
| 12 | Alphabet Sounds; Simple Words (CVC); Classroom Objects; Colours and Numbers |
| 32 | Imbuhan Awalan meN-, ber-; Kata Majmuk; Kata Ganda; Simpulan Bahasa |
| 41 | Ayat Tunggal dan Majmuk; Karangan Pendek; Kata Sendi Nama; Imbuhan Apitan |
| 47 | Nombor Hingga 1 Juta; Pecahan Tak Wajar dan Nombor Bercampur; Perpuluhan Dua Tempat; Peratus |
| 49 | Cakap Ajuk dan Cakap Pindah; Ayat Aktif dan Pasif; Peribahasa; Penulisan Surat Rasmi |
| 54 | Penjajahan Portugis, Belanda, Inggeris; Pendudukan Jepun; Perjuangan Kemerdekaan; Tokoh-tokoh Kemerdekaan |
| 57 | Rumusan; Karangan Lanjutan; Komsas (Pantun, Sajak, Cerpen); Ayat Songsang dan Penegas |
| 102 | Suhu badan; Kadar nadi; Tekanan darah; Indeks Jisim Badan (BMI) |
| 103 | Kelestarian alam sekitar; Sektor tenaga; Sektor pengurusan sisa dan air sisa; Sektor pertanian dan perhutanan; Sektor pengangkutan; Teknologi hijau dan kehidupan |
| 104 | Pembahagian sel; Pewarisan; Mutasi; Teknologi kejuruteraan genetik; Variasi |
| 109 | Perubatan tradisional, perubatan moden dan perubatan komplementari; Radikal bebas; Antioksidan; Produk kesihatan |
| 110 | Gerakan linear; Graf gerakan linear; Pecutan graviti dan jatuh bebas; Jisim dan inersia |
| 111 | Aplikasi tenaga nuklear; Penghasilan tenaga nuklear; Kesan penggunaan tenaga nuklear; Tenaga nuklear di Malaysia |
| 113 | Diet seimbang dan nilai kalori; Keperluan nutrien dalam tumbuhan; Kitar nitrogen; Teknologi pengeluaran makanan; Teknologi pemprosesan makanan; Makanan dan suplemen |
| 114 | Kitaran hayat produk; Pencemaran alam sekitar; Pemuliharaan dan pengekalan alam sekitar; Pemeliharaan dan pemuliharaan alam sekitar |
| 116 | Pengenalan kepada sebatian karbon; Hidrokarbon; Alkohol; Lemak; Minyak sawit |

Topic 7 was already known. Topics 4 and 69 have 2 subtopics each, with descriptions (see AUD-M03-18).

## Screenshots (`docs/qa/audit/img/M03/`)

| File | Shows |
|---|---|
| `s7-1280-levels-single-column-scroll.png` | S7 levels as a single-column scroll box (AUD-M03-02) |
| `s2-375-buttons-inline.png` | S2 at 375: "Batal" and "Simpan Bab" side by side (AUD-M03-03) |
| `s14-pend-islam-active-pill-subtitle-1280.png` | Active pill #14B8A6 and subtitle "Pend. Islam"; header "Dashboard" (AUD-M03-04, -05; DV-04) |
| `s14-sains-grade-d5-served-as-d4-1280.png` | `?grade=DARJAH_5` served as Darjah 4 (AUD-M03-06) |
| `s6-375-soalan-hex-hidden.png`, `s6-375.png` | S6 at 375: number only, no hex (AUD-M03-11) |

---

## Round 2 — targeted re-audit (URS/SRS v1.2)

| Field | Value |
|---|---|
| Date | 2026-09-25 |
| Auditor | Same independent audit agent, browser lane 2 (`playwright2`), with the same read-only rules. The Peta Belajar and `/topics` checks were GET-only and at least 450 ms apart. No practice or quiz URL was opened. Nothing was clicked, typed or submitted in round 2. |
| Documents audited | URS v1.2 · SRS v1.2 (revision-history lines v1.1 "audit fixes" and v1.2 "integer-id alignment") · discovery narrative (17 "(corrected after audit)" markers counted) · CLAUDE.md §6 and TRACKER D10 · master SRS NFR-02 |

### Verdict: **PASS**

There are 0 Critical and 0 Major findings, and 4 new Minor findings. All 21 round-1 findings are closed. The scripted completeness proof shows no regressions. The new Minor findings are wording and scope clarifications. They do not block G1, and the writer can fix them in a v1.3 without a re-audit.

### Summary

| Measure | Result |
|---|---|
| Round-1 findings | **21 of 21 closed** (table below) |
| Coverage matrix (script) | 807/807 inventory IDs in URS §6: 0 missing, 0 extra, 0 duplicates. 798 mapped and 9 excluded (the tournament banner, M16). Matrix ↔ FN "EL" columns: **0 inconsistencies**. 138 FN. |
| Traceability (script) | All 138 FN have an FR. **121 AC** (was 119; AC-05.4 and AC-20.7 added) and all have an E2E. All 99 FR have an E2E. 52 E2E. 0 dangling or duplicate IDs. The URS count line "31 user stories · 121 acceptance criteria" matches. |
| Deviation list | DV-01, 03, 04, 05, 06(a+b), 07, 08 (narrowed) and 09 approved; DV-02 withdrawn. All fit D9/D10. Notes on DV-06(b) scope: R2-23, R2-24. |
| Integer ids | Subjects 1–31, levels 1–11 and legacy topics 1–125 keep their live ids. Codes are separate string fields in DATA-M03-01/02/06, BR-16 and §6.8. The kept tree ids (chapters 35, 36, 91, 92; topics 59, 60, 126, 127; subtopic 132) are correct. Other tree records get sequential ids and do **not** match live, and the v1.2 change log overstates this (R2-22). |
| Edited passages spot-checked | 15, all consistent with live (list below) |
| New findings | **Critical 0 · Major 0 · Minor 4** |

### Round-1 findings — status

| ID | Status | Evidence in v1.1/v1.2 (and live, where re-checked) |
|---|---|---|
| AUD-M03-01 | Closed | FN-1.1.16/1.1.18, FR-17/20, AC-04.1/04.4, §8 "Add toggle" row, and E2E-11/12 (reopen → typed text still there, reload → cleared) all describe the live partial reset. Discovery l.122 is corrected. |
| AUD-M03-02 | Closed | FN-2.2.9, FR-52, AC-13.2, §10 and E2E-27 (scrollHeight > clientHeight) specify a single-column scroll box of max height 256 px. Discovery l.181 is corrected. |
| AUD-M03-03 | Closed | AC-31.4, FR-99 (`flex justify-end space-x-3 pt-4 border-t`), §10 and E2E-52 (one row at 375/768/1280). Discovery §7 is corrected. |
| AUD-M03-04 | Closed | §6.8 now lists the 8 observed colours (OBSERVED), and they match the round-1 live readings. FR-82, AC-25.1, E2E-43 (3 colours asserted); SRS Q1 is closed. |
| AUD-M03-05 | Closed | FN-5.1.2, FR-81, BR-15, AC-25.1 and E2E-43 now use the pill label ("Pend. Islam", "Pend. Moral"), with "Zzz" for an unknown code. Live re-check: a typed `?subject=GEOGRAFI` → subtitle "Terokai perjalanan Geografi — …", as specified. |
| AUD-M03-06 | Closed | Darjah 1–4 only and the fallback to Darjah 4 are replicated (FN-5.1.5/5.1.11, FR-83/84, AC-25.2/25.3, E2E-44). The learner-grade default is removed: the same default applies to every user and the seed users are aligned. The "📚" icons are removed (null where not observed). DV-08 is narrowed to the Geografi pill (see below). Live re-check: `?subject=SAINS&grade=DARJAH_4` → "Penyiasatan Saintifik", which is the AC-25.3 example. |
| AUD-M03-07 | Closed | DV-02 is withdrawn (URS §7), and FN-4.1.2/4.1.3, FR-70/71, AC-20.2/20.3/20.6 and E2E-35/36 describe the live chip set. Live re-check of the new active-chip rules: `?grade_level=TINGKATAN_4` → no grade chip active, "Semua Subjek" active, 19 cards; `?subject=sains` → 35 cards, "Semua Darjah" active, no subject chip active. Both match FR-70/71. |
| AUD-M03-08 | Closed | FR-85 ("no reduced-motion handling (D10)"), NFR-M03-05, E2E-42 ("with emulated reduced motion the behaviour is the same") and the D-10 bullet. This now agrees with D10 and master NFR-02. |
| AUD-M03-09 | Closed | FN-1.1.19, FN-1.5.7, FR-38, BR-18, §8 and AC-05.4 / E2E-13 mark "Topik tidak dijumpai." as OBSERVED and one-time. |
| AUD-M03-10 | Closed | FN-6.3.4, BR-16, FR-78, AC-23.2 (with topic ids) and E2E-40 mark all 8 codes OBSERVED; OQ-7 is closed. Discovery l.91 and l.416 are corrected. |
| AUD-M03-11 | Closed | FN-2.1.3, FR-40 (`hidden sm:inline` on both), AC-10.3, §10 and E2E-21 at 375. S9 is "at every width" in FR-58, as live. |
| AUD-M03-12 | Closed | FN-2.2.4, FN-3.2.4, FR-48, FR-64 and AC-13.2 give the displayed "CTH: MATH01" / "CTH: Y1", the S10 hint `fa-info-circle`, and E2E-27 (computed text-transform). |
| AUD-M03-13 | Closed | FN-3.1.2, FN-3.2.8, FR-57 (pink gradient, `ring-pink-500`), FR-58 (fixed sizes), FR-64, and §7 "not deviations". |
| AUD-M03-14 | Closed | FN-1.2.2, FR-25, AC-06.3 and E2E-15 (`?subject_id=3` only → `/admin/curriculum?subject_id=3`). Discovery l.131 is corrected. |
| AUD-M03-15 | Closed | FR-24 (`sm` for tree indentation, padding and text; `md` for filter and cards) and §10 S1 row ("`sm` (tree), `md` (filter, cards)"). |
| AUD-M03-16 | Closed | FN-5.1.3, FR-81 (static highlight; no `@keyframes shimmer`), AC-24.2 and E2E-41. |
| AUD-M03-17 | Closed | FN-4.1.6, FR-72, BR-13 (case-insensitive), FR-70 (no chip active for a non-canonical value), AC-20.7 and E2E-36. |
| AUD-M03-18 | Closed | §6.9 "Legacy topics" uses the Appendix A names for the 18 topics and the observed descriptions for topics 4, 68, 69 and 103 (others null). Emoji are seeded only where observed. OQ-11 is narrowed. |
| AUD-M03-19 | Closed | FN-4.2.3/4.2.4, FR-76 (`line-clamp-3`, icon colours) and FR-77 (purple-600 %). |
| AUD-M03-20 | Closed (resolved as DV-06(b)) | This is Delivery Lead option "extend": DV-06(b) covers every M03 screen, backed by master NFR-02 "text < 12 px = unreadable". It fits D9/D10. Scope clarifications: R2-23 and R2-24. |
| AUD-M03-21 | Closed | FR-02 (inactive subjects INFERRED, OQ-8), BR-08 (subject/level order INFERRED: order = id) and FR-58 (INFERRED). |

### Deviation list review (D9 / D10)

| DV | Fit | Note |
|---|---|---|
| DV-M03-01 | D9 (content invisible) | Unchanged; accepted. |
| DV-M03-02 | Withdrawn | Correct under D10 ("completing a working filter with extra options is new scope"). |
| DV-M03-03 | D9 (layout) | Unchanged; accepted. |
| DV-M03-04 | D9 (wrong title) | Unchanged; accepted. |
| DV-M03-05 | D9 (contradictory numbering) | Unchanged; accepted. |
| DV-M03-06 (a) | D9 (unreadable, truncated text) | Accepted. |
| DV-M03-06 (b) | D9 via master NFR-02 (text < 12 px is unreadable) | Accepted. It applies the D10 definition consistently to S1, S6, S12, S13 and S14 and changes only the font size, not position, weight or colour. Two scope points to clarify: decorative icons (R2-23) and shell chrome (R2-24). §10 S13 row is inconsistent (R2-25). |
| DV-M03-07 | D9 (contradictory) | Unchanged; accepted. |
| DV-M03-08 (narrowed: the Geografi pill is not rendered) | D9 (contradictory control) | **Accepted as the minimal fix.** Live offers a pill that can never show content: the only accepted grades are Darjah 1–4, and Geografi topics exist only at T1 and T4. There are three options. Keeping the pill replicates a dead control. Extending the grades is new scope under D10. Removing the pill is the smallest change that removes the contradiction, and it takes no function away, since the live pill always shows the empty state. The typed `?subject=GEOGRAFI` URL still behaves as live apart from the missing active pill (empty state, subtitle "Geografi"; live check confirmed the subtitle). The URS §7 text documents the choice and the rejected alternatives. |
| DV-M03-09 | D9 (wrong labels, seed only) | Unchanged; accepted. |
| Replicated D-9, D-10 (now without reduced motion), D-11, D-12 | Correct | The D-10 bullet now states "no reduced-motion handling (live has none; D10)". |

### Integer-id check

- **Correct:**
  - The SRS §6 intro, DATA-M03-01…07 and the §6.9 id rule use `int` ids.
  - Subject 1–31, level 1–11 and legacy topic 1–125 ids equal the live ids. Round 1 compared all 31 subjects and 11 levels with 0 differences, and the S12/S14 links use the same topic ids (e.g. `/practice?topic_id=38`, `/topics/69`).
  - Codes stay separate string fields: `code` ≤20 / ≤10, the `gradeLevel` and `subject` enums, the BR-16 map, and "Codes … are separate string fields, never ids".
  - The pivot and foreign keys are `int` (`educationLevelIds: int[]`, `subjectId`, `chapterId`, `topicId`, `legacyTopicId`).
  - The M04 dependency (subject/level ids only, M04 SRS l.324) is unaffected.
- **Not fully matching:** see R2-22.

### New findings (round 2)

| ID | Severity | Doc + section | What's wrong | Evidence | Required fix |
|---|---|---|---|---|---|
| AUD-M03-R2-22 | Minor | SRS change log v1.2 ("chapters, topics, subtopics … use integer ids **matching the live values**"), URS change log v1.2 | This is an overstatement. §6.9 keeps live ids only for chapters 35, 36, 91, 92, topics 59, 60, 126, 127 and subtopic 132. Every other tree record gets "the next free integer in dataset order", which does not match live. For example, Matematik T4 "Topik 1: Fungsi dan Persamaan Kuadratik" is live topic **2691** and "Bab 3: Penaakulan Logik" is live chapter **93**. `_curriculum-data.json` has no tree ids, so the seed cannot match. The §6 intro itself is accurate. | Round-1 S1 markup: `chapters/93/edit`, `topics/2691/edit`, `topics/2692/edit`; round-1 inventory also shows subtopics 133 and 134. | Reword the v1.2 change-log lines to say that the tree ids match live only for the named records. If full id fidelity is wanted, the discovery owner can harvest the ids from the edit/delete links of the 140 non-empty tree pages (one GET each). |
| AUD-M03-R2-23 | Minor | URS §7 DV-M03-06(b) ("no text (**including icon glyphs used as text**) … below 12 px"; the evidence lists "ticks `text-[8px]`"), FR-99, E2E-52 | The wording is ambiguous for decorative icons. Several live icons are below 12 px and are not text: S12 tick `fa-check-circle text-[8px]`, S13 badge dot `fa-circle text-[6px] sm:text-[8px]`, S1 chevrons `text-[10px]`. Master NFR-02 speaks of *text* < 12 px. Scaling these icons to 12 px changes the look (a 6 px dot becomes a 12 px disc) without a readability reason, so it would be an unlisted visual change. | S12, S13 and S1 markup (round 1). | State that decorative icons keep their live size and that only readable text is raised. Remove "ticks" from the DV evidence, and exclude icon glyphs from the E2E-52 font-size scan. |
| AUD-M03-R2-24 | Minor | URS AC-31.1 ("no text on an M03 screen"), SRS FR-99, E2E-52 ("on every screen at 375 the computed font-size of **every visible text node** is ≥12 px") | The scope includes the global shell. At 375, live shell text is 8–10 px: the admin bottom nav "Dashboard", "Soalan", "Penaja" at 8 px; the admin header subtitle "Urus subjek pembelaj…" and the footer at 10 px; the user header pills "koin", "mata" at 9 px; the S13 header subtitle "MATEMATIK" at 10 px. As written, E2E-52 fails unless the shell (owned by the global doc / M23) is changed, and no DV covers that. | Live scan at 375 of text nodes outside `<main>` on `/admin/subjects` and `/topics/7`. | Limit DV-06(b), AC-31.1, FR-99 and E2E-52 to M03 content (`main`). Decide separately whether the M03-mapped shell header title/subtitle (FN-x.x.1, SHA/SHU) is included, and if so state it and have the Delivery Lead align the global shell spec. |
| AUD-M03-R2-25 | Minor | SRS §10 row S13 (Deviation "none"; no "text ≥12 px") | This is inconsistent with DV-06(b), which lists S13 (badges `text-[9px]`, hero description `text-[11px]`). The S1, S6, S12 and S14 rows all cite DV-M03-06b. | SRS §10 rows compared with URS §7 DV-06(b). | Add "text ≥12 px" and "DV-M03-06b (sizes)" to the S13 row. |

### Edited passages spot-checked (15, all consistent with live)

FN-1.1.16 · FN-1.2.2 · FN-2.1.3 · FN-2.2.9 · FN-5.1.11 · FR-17 · FR-25 · FR-70/71 (re-checked live: TINGKATAN_4 and lower-case `sains` active states) · FR-81 (typed GEOGRAFI → "Geografi", live) · FR-84 · BR-13 · SRS §6.8 colour row · URS §7 DV-08 row · AC-25.3 (Sains D4 "Penyiasatan Saintifik", live) · E2E-44.

No regression was found in unedited passages. §3.1 US→FR→E2E is still complete, and the §0.1 deviation list matches URS §7.
