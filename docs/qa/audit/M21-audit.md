# M21 — Sponsorship & Anak Angkat (admin sponsors, anak angkat, foster-family applications, "Mohon Keluarga Angkat", public sponsor registration, PROPOSED sponsor portal) — Independent Audit (AUD, round 1)

| Field | Value |
|---|---|
| Documents audited | `docs/requirements/urs/M21-sponsorship.md` v1.0 (79 FN, 23 US, 73 AC, 15 DV, coverage matrix 934 rows), `docs/requirements/srs/M21-sponsorship.md` v1.0 (66 FR, 20 BR, 9 V, 13 named queries, 19 endpoints, 67 E2E, 10 SEC, 10 XR, §6.9 reconciliation R01–R14) |
| Evidence | Discovery `M21-sponsorship.md`; `inventory/M21/*.json` (S1–S7, SHA, SHU, `_crawl.json`, `_snapshot-2026-09-27.json`, `_summary.md`); `img/M21/` (index only). Live re-walk on 2026-09-27, about 11:53–12:05 MYT, browser lane 2 (`playwright2`), admin account plus one fresh cookie-less guest context for S7, read-only. |
| Screens re-opened live | S1 (1280, 375, 768), S2 (1280), S3 #6 and #11 (1280; #11 also at 375), S4 default (1280, 375), S5 default (1280), S6 (1280) with the user-shell menu, S7 as a guest (1280 with every client-side step, and 375). **Not opened:** the S1 filter / page variants, the S4 and S5 tab variants (the guard treats `?status=` as write-shaped, as the brief requires), `GET /admin/sponsors/{id}` (500), the 404 / 405 / 403 probes and the M17 dashboard cards. These were audited from the inventory and the snapshot. |
| Safety | A context-level route guard with a document / fetch cache was installed before the login, on both contexts. It aborted: every non-GET except `POST /login`; every external host except static CDNs (wa.me, gateways, analytics and avatar hosts were blocked); downloads (`content-disposition: attachment`); write-shaped GETs (approve, lulus, tolak, reactivate, aktifkan, toggle, assign, `/status`, `status=`, delete, logout, export, whatsapp, taja, `cari-pelajar`); and `GET /admin/sponsors/{id}`. **Verified by probes before any navigation:** on the admin context, `GET wa.me`, `POST /__m21a_probe`, `GET …/reactivate`, `…/lulus`, `…/status`, `cari-pelajar?q=zz`, `GET /admin/sponsors/6`, `GET /logout`, `GET …/export` and a gateway host were all blocked. `PUT` / `DELETE` probes were refused by the browser itself (no-cors), so they were not sent. On the guest context, `POST /__m21a_probe`, `POST /sponsor/register` and `GET wa.me` were blocked. The service worker was disabled by an init script. Each M21 page was fetched from the server **once**: 7 admin M21 documents and 1 guest S7 document. All width re-loads were cache hits (24 on the admin context, 1 on the guest context). Nothing was submitted, saved, reactivated, assigned, graduated, withdrawn, approved, rejected or registered. No confirm dialog was opened. Nothing was typed into the S4 student search. On S7 the only interactions were client-side: the tile, "Seterusnya" / "Kembali", the eye button, and one letter typed into "Bandar" and then cleared. No screenshot was taken. The browser was closed at the end, and this session's lane-2 console log was deleted. **Incident (no effect):** the first run lost its state object between tool calls. The re-installed guard was re-probed, and every probe was blocked in both runs. |
| View counters | M21 shows no counter (discovery §5.4). None was affected. |
| Privacy | Every read masked e-mails and phone numbers, and returned only line counts for the student, officer and applicant cells. The only reason text returned was row #1's, which is S6 example 2 (public site copy). No real name, e-mail, phone or reason appears in this report or in any scratch file. The live pages were checked for the docs' fictitious names ("Hafiz", "Irfan", "Hajar", "Adam Haikal", "Aina Sofea", "Rosnah"): **none occurs on live**, so no fictitious anchor matches a real person on these pages. |
| Cross-module docs | M01 SRS v1.12, M02 SRS **v1.26**, M15 v1.4, M17 v1.11, M19 v1.3, M08 v1.10, design-system **v1.9**, design/shells.md (DV-SH-03), `src/shells/nav/user-nav.ts` |
| Auditor | Independent audit agent (not an author) |
| Scripts | `<scratchpad>/m21-audit/cov.cjs` (matrix vs inventory: ids, kind, status, text, FN EL lists in both directions, exclusion reasons); `strict.cjs` (exact text equality); `trace.cjs` (E2E ACs ⊆ FR ACs, provisional list, tagged ACs, §3.1 table, SRS counts); `extra.cjs` (FN ↔ US ↔ FR ↔ AC ↔ E2E closure, and ACs that chain on other ACs) |

## Verdict: **FAIL**

| Severity | Count |
|---|---|
| Critical | 0 |
| Major | 1 |
| Minor | 6 |
| Nit | 4 |
| Info | 2 |

What is good:
- **Coverage is complete (independent script).**
  - All 934 inventory elements have exactly one matrix row: 342 mapped and 592 excluded. There are 0 unmapped rows, 0 duplicates and 0 rows for ids outside the inventory.
  - Kind and status match the inventory on every row.
  - **Exact text equality holds on all 247 text elements.** The one nested-quote case (S4-048, the Symfony 405 sentence) matches once the quotes are parsed.
  - Each mapped element's FN lists that element in its EL column. In the other direction there are 2 disagreements (AUD-M21-10).
  - The 3 content exclusions are exactly the M16 banner ("LIVE:", "MAIN", "DAFTAR") on S6. The shell exclusions carry FN references as the summary claims: SHA 3 sidebar + 9 header + 1 bottom nav = 13; SHU 1 menu + 2 header = 3.
  - 41 of the 79 FNs appear in the matrix.
- **Traceability is clean apart from §3.1.**
  - Counts: 79 FN / 23 US / 73 AC / 66 FR / 67 E2E / 15 DV / 10 XR / 10 SEC, with 0 errors in the writer's script.
  - Every FN is in exactly one US and at least one FR.
  - Every AC is in at least one FR and one E2E.
  - Every E2E's ACs belong to its FRs.
  - The 26 provisional E2Es are exactly the §12 list.
  - The SRS change-log counts (20 BR, 9 V, 13 queries, 19 endpoints) match the tables.
- **The live figures and copy are exact (re-read on 2026-09-27).**
  - **S1:** tab and header titles; the cards "6 Jumlah 0 Menunggu 0 Diluluskan 0 Ditolak 6 Digantung"; "6 penaja dijumpai"; both selects with every value and label; the placeholder "Nama, email..."; no "Reset"; the 7 columns.
  - **S1 rows:** order #11, #6 → #10; the dates; the badge "Digantung" with `fa-ban` in orange; the building icon on every category; "Pegawai" is 2 lines on #11 and "-" on #6–#10; "Lihat" → `/admin/sponsors/{id}` and "Edit" → `…/edit`, with **no `target`, `rel`, `title` or `aria-label`**.
  - **S2:** every label, placeholder, `type` and `required` (name and category only); a category select with no empty option (INDIVIDU preselected); the section icons; the back link and "Batal" → S1.
  - **S3 #6 / #11:** the prefilled organisation values (#6's description and website; #11 "Syarikat IT", "https://alesa.my"); no placeholder on any field; #6 has no contact data while #11 has all 8 contact / address fields and no registration number; `_method` PUT; the strip "SUSPENDED Status 0 Hadiah {date} Tarikh Daftar"; the card "Status Penaja: Digantung (SUSPENDED)" with a red dot; reactivate with `confirm('Aktifkan semula penaja ini?')`.
  - **S4:** cards 1 / 1 / 0 / 0; tabs "Semua (1)" (`bg-blue-600`), "Aktif (1)", "Graduated (0)", "Withdrawn (0)", "Expired (0)"; the sponsor select with only "Pilih Penaja"; the categories "-", B40, Asnaf, Yatim, OKU; the channels "Direct" / "Via Agent"; row #2 "Alesa It Services" / raw "SYARIKAT_SWASTA", B40, Direct, Active, 31/03/2026; "Graduate" / "Tarik" with hidden `status` graduated / withdrawn and **no `onsubmit`**.
  - **S5:** tabs 3 / 0 / 0 / 0 with "Menunggu" ringed; rows #3, #2, #1; roles "parent", "parent", "student"; "-" school lines on #3 / #2 and a school line on #1; all "B40" / "Pending"; reasons 83 characters ending "..." with no `title`; #2 and #3 have identical reasons; #1 is the example-2 text; "Lulus" has no confirm; "Tolak" has `confirm('Tolak permohonan ini?')`.
  - **S6:** header "Dashboard" / "Selamat datang kembali" (D-M21-06 confirmed); H1 24 px; the fields, `required` and rows 4; the hint with the link "sini" → `/register`; the 5 examples as `onclick="…value=this.innerText"` (bullet included, D-M21-09 confirmed); the note at 10 px in italics; both lists exact; the user-shell entry "Mohon Keluarga Angkat" between "Pembetulan" and "Penguasaan".
  - **S7 (guest):** title, H1, 17 labels, placeholders, `required` on the 12 fields; the 16 states; the alert "Sila pilih kategori penaja." with step 1 kept; the tile setting `KOPERASI`; the first bar turning `bg-emerald-400`; step 2 → 3 with empty fields; "Kembali" keeping the value; the eye button switching to `text` / `fa-eye-slash`; the note text; the `x-if` "Menghantar..." markup; footer links with no `target` or `rel`.
- **Seeds mirror observation.**
  - 6 sponsors, ids 6–11, all Syarikat Swasta / SUSPENDED with "Hadiah" 0.
  - The names, descriptions, websites and dates equal snapshot `S3_sponsorFields`. Empty tagline, logo and registration fields match. Contact data is present only on #11.
  - Anak angkat #2 is under sponsor #11: active, direct, B40, 31/03/2026.
  - 3 pending B40 applications, with the observed applicant structure (one self-applicant, two siblings from the same parent).
  - The fictitious #2 / #3 reason is 129 characters, and its first 80 characters + "..." match the AC text.
  - No record is invented. The test fixtures are kept out of the observed checks.
- **"Jumlah Penaja" 1 vs 6 (C2).** The writer's definition, "distinct sponsors with ≥ 1 anak-angkat record", gives 1 (only #11 has a record). "Approved sponsors" would give 0 and "all sponsors" 6, so both are ruled out. "With an active record" also gives 1, and OQ-M21-10 records it. The definition is labelled INFERRED. It is a named query (Q-M21-AA-SPONSORS), not a constant, and the two figures never appear on the same page. **Sound.**
- **Deviations.**
  - **DV-01 is minimal.** Live "Lihat" → 500 is broken. A redirect to S3 keeps the observed label, icon and href. It creates no new contradiction.
  - **DV-03:** the snapshot shows "Semua (0)" next to "Aktif (1)" on the Graduated / Withdrawn / Expired tabs, while the cards read 1. Showing the total is the minimal fix, and the other tabs stay global as live.
  - **DV-05 confirmed live:** S3 at 375 has scrollWidth 409 from the reactivate form and button; S4 has 397 from the "Expired (0)" tab, with the tab row `flex-wrap: nowrap`. Wrapping is minimal.
  - **DV-06:** matches the shell rule DV-SH-03 and the M13 / M14 / M16 pattern (title fixed, subtitle kept).
  - **DV-08** fixes the raw codes that sit next to BM labels, and keeps "(SUSPENDED)" as a code annotation. This is reasonable; see AUD-M21-06 for the labelling.
  - **Rejected DVs are deliberate and consistent on live:**
    - 04: page 2 of the Laravel pager, as the M20 precedent.
    - 09: every example copies its bullet.
    - 10: mixed-language labels.
    - 11: the free-text "Negeri" works on both forms.
    - 13: C2.
    - 15: consistent observed data.
  - The count "9 approved / 6 rejected" is correct.
- **D10 / D14.** No page adds ARIA or `rel`, and no M21 link on live has a `target`. The e-mail notice is a mock log only, with no external screen.
- **D11 / D12.** Every displayed count cites one of the 13 named queries, and there is no display constant. M21 owns its three stores. The sponsor store handover from M17 keeps the values (6 · 0 · 0 · 0 · 6 = M17 Q-M17-SPONSORS). The proposed M02 anchors (5231–5234, 5412, 5503–5505) collide with no M02 v1.26 block and no other module's ids. They fit inside the student / parent / sponsor cells without changing a count (sponsor cell: canonical 7 + 5501–5505 = 6).
- **Responsive.** Every E2E runs at 375 / 768 / 1280. The live grids equal SRS §10: S1 stats 2 / 5 / 5; S2 1 / 2 / 2 with address 3; S4 table 702 px in a 715 px card at 768 (fits); S7 H1 24 / 48.

Why it fails (1 Major):
1. **The S4 student-search result row is observable in the page source but is specified as PROPOSED, and wrongly.** Each row shows the e-mail followed by " · {school}", at 10 px. The API #9 contract and the M02 request (XR-M21-01 d) drop the school (AUD-M21-01).

---

## Findings

| ID | Severity | Doc & section | Issue | Live / doc evidence | Owner | Required fix |
|---|---|---|---|---|---|---|
| AUD-M21-01 | **Major** | URS FN-M21-3.1.3 (l.157), matrix EL-M21-S4-022 (l.612), OQ-M21-04 (l.1462), OQ-M21-13 (l.1471); SRS FR-M21-35 (l.97), §6.1 "Student search" (l.212), XR-M21-01 (d) (l.360), API #9 (l.391), §8.2 "Student search" (l.430) | **The result row of the student search is source-derived, and the docs call it PROPOSED and leave out the school.** Live S4 carries the Alpine template `<template x-for="s in results">`. Each row is a `div @click="select(s)"` holding two lines: `x-text="s.name"` (`font-semibold text-sm`) and `x-text="s.email + (s.school ? ' · ' + s.school : '')"` (`text-[10px] text-slate-400`). So the row shape is SOURCE-DERIVED, like every other Alpine behaviour the URS already labels that way (FN-3.1.3's own debounce and 2-character rule). The API returns a `school` field, and the second line appends " · {school}" when it is present. The docs: <br>• FN-3.1.3: "layout PROPOSED"; <br>• SRS §8.2: "row = name (bold) + e-mail (small)"; <br>• API #9 `[{name, email}]` and XR-M21-01 (d) `students.search(q)`: no school. <br>Discovery §2.4 missed the school part as well. The contract requested from M02 before the XL gate is therefore incomplete, and a faithful rebuild cannot show the observed row. The 10 px second line also falls under DV-M21-07. | Live `/admin/anak-angkat` template (read via DOM, not rendered; nothing typed); inventory S4-022 `hiddenBy: template:x-for=s in results`. | M21 product-analyst (solution-architect for #9 / XR) | <br>• FN-3.1.3 / FR-35: each result shows the name (bold) and "{e-mail}" + " · {school name}" when the student has a school, SOURCE-DERIVED; a click selects the row. <br>• API #9 → `[{name, email, school \| null}]`; XR-M21-01 (d) → `students.search(q)` returns the school name. <br>• §8.2 / OQ-04 / OQ-13: keep as PROPOSED only the result limit (≤ 10) and which students are searchable. <br>• Matrix S4-022: "name + e-mail · school". <br>• AC-12.2 / E2E-36: assert the school suffix for "Nur Hajar Binti Demo" (5231 has a school). <br>• DV-07: add the 10 px e-mail / school line. |
| AUD-M21-02 | Minor | URS DV-M21-07 (l.1421), FN-1.3.5 (l.109), FN-5.1.1 (l.196), FN-5.1.5 (l.200), FN-3.1.7 (l.161), FN-4.1.2 (l.172); SRS §10 (l.458) | **DV-07 lists the wrong sub-10 px elements.** Live at 375: <br>• **S7:** the 20 elements are the 13 tile labels **plus the 3 step pills** ("Organisasi", "Hubungan", "Akaun") **and 4 footer texts** ("Sudah ada akaun?", "Log Masuk", "Daftar Sebagai Pelajar", "Kembali ke Laman Utama"). The DV and FN-5.1.2 name only the "tile labels (20)"; there are 13 tiles. <br>• **S4:** the 7 elements are the sponsor category line "SYARIKAT_SWASTA" and the student cell, plus B40, Direct, Active, Graduate and Tarik. The DV says "badges and Graduate / Tarik". <br>• **S5:** the 18 elements include both student-cell lines (e-mail, school) in every row, besides B40, Pending, Lulus and Tolak. The DV says "S5 table". <br>AC-23.1's global rule ("no content text below 12 px") still yields the right rebuild, but the DV, the FNs and SRS §10 name a narrower fix. A developer following FN-5.1.1 / 5.1.5 would keep the pills and footer at 10 px. | Live S7 guest at 375 (20 nodes listed); live S4 and S5 at 1280. | M21 product-analyst | Rewrite the DV-07 live column with the actual elements (S7 pills, tiles and footer; S4 category line and student cell; S5 student cell; the S4 search row from AUD-01). Add "≥ 12 px" to FN-5.1.1 and FN-5.1.5. |
| AUD-M21-03 | Minor | URS FN-M21-3.1.4 (l.158), matrix S4-027 (l.617); FN-M21-5.1.3 (l.198), matrix S7-050 (l.780), SRS V-M21-04 (l.194), FR-52; FN-M21-2.3.4 (l.144), matrix S3-046 (l.567) | **Three observable attributes are missing.** <br>• The S4 "Saluran" select `channel` is **`required`** (live and inventory). FN-3.1.4 names `required` only on the sponsor select. <br>• The S7 "Poskod" `postcode` has **`maxlength="5"`** (live and inventory `maxlength: 5`). No doc states it, so the rebuild would accept 6 or more digits and V-M21-04 has no length rule. <br>• The S3 status card starts with a **`fa-toggle-on` icon (blue)** before "Status Penaja:" (live; discovery §2.3 "toggle icon"). FN-2.3.4 and §10.1 omit it. The icon already has a row in design-system §6. | Live S4 form, S7 guest form, S3 #6 / #11 card; inventory S4-027 `required`, S7-050 `maxlength`. | M21 product-analyst | Add `channel` `required` (FN-3.1.4, FR-34, matrix). Add `maxlength=5` (FN-5.1.3, matrix S7-050, V-M21-04 "postcode ≤ 5 characters"). Add the toggle icon (FN-2.3.4, matrix S3-046, §10.1). |
| AUD-M21-04 | Minor | URS FN-M21-5.1.5 (l.200), AC-M21-18.4 (l.356), matrix S7-069 (l.799); SRS FR-54, §8.1 S7 | **The footer order is wrong.** Live renders **"Sudah ada akaun? Log Masuk · Daftar Sebagai Pelajar"**: the "·" separates the two links. The inventory text "Sudah ada akaun? ·" joins the element's own text nodes, which lie on either side of the first link. The docs quote "**Sudah ada akaun? ·**" followed by "**Log Masuk**", which would render as "Sudah ada akaun? · Log Masuk". | Live S7 `innerText`. | M21 product-analyst | FN-5.1.5 / AC-18.4 / FR-54: "Sudah ada akaun?" "Log Masuk" → `/login` " · " "Daftar Sebagai Pelajar" → `/register`. Keep the matrix quote (it is the inventory text) with a note on the order. |
| AUD-M21-05 | Minor | URS §0 Related (l.14); SRS §0 Related (l.14), §6.1 (l.211), XR-M21-01 (l.360), XR-M21-08 (l.367), §10.1 (l.492–494), §13 (l.606) | **Cross-module citations are stale.** <br>• Current versions: M01 v1.12 (cited 1.11), **M02 v1.26** (cited 1.23), M15 v1.4 (cited 1.3). M17 (v1.11) and M08 (v1.10) are cited without a version. <br>• **XR-M21-08 has already been applied:** design-system **v1.9** added `fa-hands-helping` → `HandHelping`, `fa-piggy-bank` → `PiggyBank` and `fa-utensils` → `Utensils`. So "no §6 row — requested" in §10.1 and "must be applied before build" in §13 are out of date. <br>• **XR-M21-01 (a)** writes "5501 → `sponsor1@demo.test`, 5502 → `sponsor2@demo.test`" as if M02 had assigned them. M02 v1.26 only reserves 5501–5502 as sponsor anchors and gives them no e-mail. <br>• What M21 relies on is unchanged: the sponsor cell 6, no id collision (see "What is good"), and canonical 7 `penaja@demo.test`. | File headers; design-system l.21, l.472–474; M02 l.525. | M21 product-analyst | Cite the current versions. Mark XR-08 "Applied (design-system v1.9)" and fill in the three Lucide names. In XR-01 (a), phrase the e-mails as part of the request. |
| AUD-M21-06 | Minor | URS DV-M21-08 (l.1422), FN-M21-2.3.4 (l.144), FN-M21-2.3.6 (l.146), AC-M21-10.2 (l.314), AC-M21-10.3 (l.315); SRS BR-M21-16 (l.179), FR-M21-31 (l.93) | **Unobserved behaviour is stated as fact.** DV-08 keeps "(SUSPENDED)" because it is "a deliberate code annotation beside the label, **consistent for every status**". Only `SUSPENDED` exists on live, so "{label} ({code})" for the other statuses — "Diluluskan (APPROVED)", "Menunggu (PENDING)", "Ditolak (REJECTED)" — is INFERRED. FN-2.3.4, BR-16 and FR-31 state the pattern with no label. The same applies to the dot colour of the other statuses (FN-2.3.7 already says INFERRED). The decision itself is sound. | Snapshot S3 `statusBlock` (6 × SUSPENDED); live S3 #6 / #11. | M21 product-analyst | DV-08 rationale: "observed for SUSPENDED; the same pattern for the other statuses is INFERRED". Tag the "(CODE)" rule INFERRED in FN-2.3.4, BR-16 and FR-31. |
| AUD-M21-07 | Minor | Writer's `m21-writer/coverage.cjs`, `trace.cjs` | **The writer's scripts are the weak pre-AUD-M20-06 version.** <br>• `coverage.cjs` does not check kind, status or quoted text, that a row id exists in the inventory (only its screen prefix is checked), the FN EL lists in either direction, or the exclusions. <br>• `trace.cjs` does not check E2E ACs ⊆ FR ACs, the provisional list against the flags, tagged ACs, or the §3.1 table. <br>So the "0 errors" missed AUD-08 and AUD-10. The M20 round 2 audit recorded that the `m20-writer` scripts had been strengthened; M21 was adapted from an older copy. | Script source; both re-run: 0 errors each. | M21 product-analyst (process) | Adopt the strengthened `m20-writer` checks, or `m21-audit/*.cjs`, for v1.1 and later modules. |
| AUD-M21-08 | Nit | SRS §3.1 (l.138, 147, 148, 154, 155) | **§3.1 has drifted from the FR AC columns.** <br>• US-05 omits FR-29 (AC 05.2). <br>• US-14 lists FR-45, whose only AC (15.1) belongs to US-15. <br>• US-15 omits FR-45 and FR-66. <br>• US-21 omits FR-66 (AC 21.2). <br>• US-22 omits FR-33 (AC 22.3). <br>Separately, FR-45 cites FN-4.1.7 (a US-14 function) with only a US-15 AC. | `m21-audit/trace.cjs`, `extra.cjs`. | M21 product-analyst | Regenerate §3.1 from the FR AC column. Optionally add an AC-14.x row for the badges of unobserved statuses, so that FR-45 traces to US-14. |
| AUD-M21-09 | Nit | URS AC-M21-22.3 (l.375), AC-M21-23.1 (l.379); SRS E2E-M21-64 (l.597), E2E-M21-66 (l.599) | **Two non-provisional E2Es assert rebuild-only behaviour** (as AUD-M20-09). E2E-64 runs "after E2E-37 steps" (a PROPOSED assign; E2E-37 is provisional), and AC-22.3 chains on the provisional AC-12.3 without saying so. E2E-66 includes the PROPOSED P1 / P2 pages. | `trace.cjs` ("AC 23.1 tagged PROPOSED, all E2E non-provisional"); `extra.cjs` ("AC 22.3 depends on 12.3, not tagged"). | M21 product-analyst | Mark E2E-64 and E2E-66 provisional, or split the dependent steps out. Tag the second clause of AC-22.3 "(provisional)". |
| AUD-M21-10 | Nit | URS FN-M21-5.1.2 (l.197) | FN-5.1.2's EL list "S7-006–033" includes S7-006 / 007 (the form and `_token`). The matrix, and FN-5.1.6's own list, assign those two to FN-5.1.6. They are the only two disagreements in the FN ↔ matrix check. | `cov.cjs`. | M21 product-analyst | Start FN-5.1.2's list at S7-008. |
| AUD-M21-11 | Nit | URS AC-M21-11.2 (l.319); SRS §6.11 B (l.342), XR-M21-01 (b) (l.360) | The fictitious adopted-student address `m-demo0001@moe-dl.edu.my` uses the real Ministry of Education DELIMa domain. Every other fictitious account uses `@demo.test`. The local part is invented, but a seed address on a live government domain could collide with a real mailbox. | Docs. | M21 product-analyst | Keep the DELIMa style on a reserved domain, for example `m-demo0001@moe-dl.demo.test`, or record why the real domain is needed. |
| AUD-M21-12 | Info | URS DV-M21-06 (l.1420) | DV-06 matches shell rule DV-SH-03 and the M13 / M14 / M16 precedent (title fixed, subtitle "Selamat datang kembali" kept), but it does not cite them. | design/shells.md l.465, M16 DV-M16-01. | — | Optional: cite DV-SH-03. |
| AUD-M21-13 | Info | — | The S4 / S5 tab variants and the S1 filter variants were not re-opened. The brief's guard list includes "status", so `?status=` GETs were aborted (3 blocked attempts on `?status=graduated`, none reached the server). DV-03 and FN-3.1.6 / 4.1.1 were audited against the snapshot, whose default values equal the live re-read. | Guard log. | — | None. QA can confirm the tab counts at G5. |

---

## Scripted checks (summary)

| Script | Result |
|---|---|
| `m21-writer/coverage.cjs` (re-run) | 934 elements, 342 mapped, 592 excluded, 0 errors. |
| `m21-writer/trace.cjs` (re-run) | FN 79, US 23, AC 73, FR 66, E2E 67, DV 15, XR 10, SEC 10; 0 errors. |
| `m21-audit/cov.cjs` | 934 inventory = 934 rows. 0 unmapped, 0 duplicates, 0 non-inventory rows, 0 kind / status / text mismatches. Every matrix FN lists its element. Reverse check: 2 disagreements (S7-006 / 007, AUD-10). The 3 content exclusions are the M16 banner. Shell exclusions: SHA 13 and SHU 3 carry FN references. |
| `m21-audit/strict.cjs` | 247 text elements, 0 exact-equality differences. |
| `m21-audit/trace.cjs` | 0 E2E ACs outside their FRs. Provisional: 26 listed = 26 flagged = 26 claimed of 67. One PROPOSED-tagged AC (23.1) has only a non-provisional E2E (AUD-09). §3.1 has 5 drifts (AUD-08). |
| `m21-audit/extra.cjs` | Every FN is in one US and at least one FR. Every AC is in an FR and an E2E. There are no dangling ids. FR-45 / FR-66 cross stories (AUD-08). AC-22.3 chains on a provisional AC without a tag (AUD-09). |
| Reconciliation (by hand) | R01–R14 re-computed from the snapshot and the live re-read: all pass. The provisional after-action figures in AC-08.3, 10.2, 12.3, 13.1, 19.2 and 21.2 are arithmetically consistent with the seed. |

## What was checked live against the discovery evidence

| Area | Checked | Result |
|---|---|---|
| S1 | titles, cards, count, filter controls and options, columns, 6 rows (order, category icon, officer presence, badge, date, action hrefs, `target` / `rel` / `title` / ARIA), scroll and text size at 3 widths | as discovery (9–10 px text only at 375, 73 elements) |
| S2 | labels, placeholders, `type` / `required`, category options, section icons, links, button | as discovery |
| S3 #6 / #11 | header subtitle, prefilled organisation values, contact presence only, `_method`, strip, status card, reactivate confirm, overflow at 375 | as discovery; toggle icon undocumented (AUD-03) |
| S4 | cards, tabs and active style, assign form (`required`, Alpine attributes, options), row #2, status forms without confirm, 10 px elements, overflow at 375 | source-derived search row with school (AUD-01); `channel` required (AUD-03) |
| S5 | tabs and highlight, columns, 3 rows (structure only), reason length / equality / no title, action forms and confirms, 10 px elements | as discovery |
| S6 | header fallback, hero, fields, examples `onclick`, note size, hint link, info lists, shell menu position | as discovery |
| S7 (guest) | fields, `required` / `maxlength`, states, the alert, tile → category, bars, step navigation, value kept, eye toggle, note, loading markup, footer, text size at 375 | `maxlength=5` (AUD-03); footer order (AUD-04); pills and footer at 10 px (AUD-02) |
| Privacy | the docs' fictitious names on the live pages | none present |

## Recommended routing

Route AUD-M21-01 … 11 to the M21 writer (product-analyst; solution-architect for API #9 and XR-M21-01 in AUD-01) for v1.1. The Nits can be fixed in the same pass. After v1.1, run audit round 2 as a doc-only check: the evidence above is enough, and no further live capture is needed.

---

## Round 2 (URS / SRS v1.1, 2026-09-27)

### Scope and method

- **Documents audited:** `urs/M21-sponsorship.md` v1.1 and `srs/M21-sponsorship.md` v1.1.
- **Doc-only:** no browser session was opened in this round. Each fix was compared with the round-1 live evidence (above) and with the discovery inventory and snapshot.
- **Scripts re-run** from `<scratchpad>/m21-audit/`: `cov.cjs`, `strict.cjs`, `trace.cjs` and `extra.cjs`. The Delivery Lead reports the writer's scripts (`cov.cjs`, `strict.cjs`, `trace-strict.cjs`, `coverage.cjs`, `trace.cjs`) all exit 0. This round did not re-run or review them.
- **Regression grep** over both documents for stale text: "v1.23", "M15 v1.3", "no §6 row", "consistent for every status", `moe-dl`, "tile labels (20)", and the footer order "Sudah ada akaun? ·" in normative text.
- **Privacy check:** every person name and e-mail in both documents was listed and searched in the M21 evidence (see below).

### Verdict: **PASS**

| Severity | Count |
|---|---|
| Critical | 0 |
| Major | 0 |
| Minor | 0 |
| Nit | 0 |
| Info | 1 (AUD-M21-R2-01) |

All 11 actionable round-1 findings are closed. The fixes introduce no new inconsistency. M21 v1.1 passes the AUD gate and can go to G1.

### Scripted checks

| Check | Result |
|---|---|
| `m21-audit/cov.cjs` | 934 inventory elements = 934 rows: 342 mapped, 592 excluded. 0 unmapped, 0 duplicates, 0 non-inventory ids, 0 kind / status / text mismatches. The FN EL lists and the matrix now agree in both directions (0 disagreements). The 3 content exclusions are the M16 banner. |
| `m21-audit/strict.cjs` | 247 text elements, 0 exact-equality differences. |
| `m21-audit/trace.cjs` | 0 E2E ACs outside their FRs. Provisional: 29 listed = 29 flagged = 29 claimed of 68. Every PROPOSED / INFERRED / provisional-tagged AC now has a provisional E2E. **§3.1 has 0 drifts.** Counts: 66 FR, 20 BR, 9 V, 13 queries, 19 endpoints, 68 E2E, 10 SEC, 10 XR; 75 AC. |
| `m21-audit/extra.cjs` | Every FN is in one US and at least one FR. Every AC is in an FR and an E2E. There are no dangling ids and no cross-story FR mismatch. Every AC that chains on another AC is tagged provisional (10.3, 12.3, 14.4, 20.2, 21.1, 21.2, 22.3, 22.4). |
| Regression grep | 0 stale hits in normative text. The only hits are inside the v1.1 change-log rows. |

### Round-1 findings: verification

| ID | Status | Evidence (v1.1) |
|---|---|---|
| AUD-M21-01 (Major) | **Closed** | <br>• FN-3.1.3 (l.158) describes the result row as SOURCE-DERIVED from the `x-for="s in results"` template: the name in bold, then "{e-mail} · {school}" when a school exists. This matches the round-1 live read exactly. <br>• Matrix S4-022 (l.615) agrees. <br>• AC-12.2 (l.325) asserts "nurhajar@demo.test · SMK Demo Seri Putra" and the e-mail-only variant. <br>• OQ-04 (l.1465) and SRS §8.2 (l.432) keep only the scope and the ≤ 10 limit as PROPOSED. <br>• SRS §6.1 (l.213), API #9 `[{name, email, school}]` (l.392) and XR-M21-01 (d) carry `school`. <br>• DV-07 now includes the 10 px second line. |
| AUD-M21-02 | **Closed** | DV-07 (l.1424) lists the measured elements: <br>• S4 (7): the category line, the student line, 3 badges and 2 buttons; <br>• the search row; <br>• S5 (18): both student lines in every row, plus the badges and buttons; <br>• S7 (20): 13 tiles, 3 pills and 4 footer texts. <br>FN-5.1.1 and FN-5.1.5 now require ≥ 12 px, and so do SRS §10 S7 and E2E-66. |
| AUD-M21-03 | **Closed** | <br>• `channel` `required`: FN-3.1.4 (l.159), matrix S4-027 (l.620), FR-34. <br>• `maxlength=5`: FN-5.1.3, matrix S7-050 (l.783), FR-52, V-M21-04. <br>• Blue `fa-toggle-on`: FN-2.3.4 (l.145), matrix S3-046 (l.570), FR-31, §10.1 (`ToggleRight`). |
| AUD-M21-04 | **Closed** | FN-5.1.5 (l.201), AC-18.4 (l.358), FR-54 and SRS §8.1 give the rendered order "Sudah ada akaun?" "Log Masuk" " · " "Daftar Sebagai Pelajar". Matrix S7-069 keeps the inventory text and notes the rendered order. |
| AUD-M21-05 | **Closed** | <br>• Both docs cite M01 v1.12, M02 v1.26, M08 v1.10, M15 v1.4, M17 v1.11 and M19 v1.3. <br>• XR-M21-08 is "**Applied** (design-system v1.9: `HandHelping`, `PiggyBank`, `Utensils`)", and §10.1 and §13 are updated. <br>• XR-01 (a) is now worded as a request: M02 assigns the e-mails and names to the reserved 5501–5502 and creates 5503–5505. |
| AUD-M21-06 | **Closed** | DV-08, BR-16 (l.180) and FR-31 (l.94) say "OBSERVED for SUSPENDED; INFERRED for the other statuses". |
| AUD-M21-07 | **Closed** | The writer adopted strict scripts. The Delivery Lead reports they exit 0; this audit did not review their source. The audit's own scripts give the same results. |
| AUD-M21-08 | **Closed** | §3.1 has been regenerated, and the script finds 0 drifts. The new AC-14.4 gives FR-45 a US-14 AC. The new AC-22.5 / E2E-68 give FR-66 its US-22 trace. |
| AUD-M21-09 | **Closed** | E2E-64 (l.601) and E2E-66 (l.603) are provisional, and AC-22.3 is tagged provisional. |
| AUD-M21-10 | **Closed** | FN-5.1.2's EL list starts at S7-008. |
| AUD-M21-11 | **Closed** | The adopted student is now `irfanhakimi@demo.test` (SRS §6.11 B l.343, AC-11.2 l.320, XR-01). `moe-dl` no longer appears in any normative text. |
| AUD-M21-12 / 13 (Info) | No action needed | — |

**New content reviewed.**
- **AC-14.4:** the badges of unobserved statuses, provisional and INFERRED.
- **AC-22.5 / E2E-68:** `409 INVALID_STATE` on four wrong-source transitions, plus the observed "Active under Digantung" (C3); provisional.

Both are consistent with BR-07 / 11 / 14 / 15 and V-M21-07.

### Privacy check (example names and e-mails)

Fictitious people in v1.1:
- "Hafiz Bin Contoh"
- "Irfan Hakimi Bin Contoh"
- "Nur Hajar Binti Demo"
- "Adam Haikal Bin Demo"
- "Aina Sofea Binti Demo"
- "Rosnah Binti Demo"
- "Penaja Demo 1"…"5"
- "Pegawai Ujian"
- "Penaja Ujian"

All e-mails are on `@demo.test`. The only other addresses are the live placeholders `pelajar@email.com`, `anda@email.com` and `email@organisasi.com`.

What was searched:
- **Evidence scan:** the name tokens and e-mail local parts (Hafiz, Irfan, Hakimi, Hajar, Haikal, Sofea, Rosnah, and `nurhajar` / `irfanhakimi` / `adamhaikal` / `ainasofea` / `rosnah` / `pegawai.alesa`), case-insensitive. The sources were `inventory/M21/**`, the 55 raw captures in `inventory/_raw/M21/`, the discovery narrative and the `img/M21/` folder. **0 hits.** The raw captures hold only masks (`<person>` 173, `<name>` 100, `<email>` 110, `<phone>` 55, `<masked>` 8).
- **Live check (round 1):** the DOM of S1, S4 and S5 was checked on live for "Hafiz", "Irfan", "Hakimi", "Hajar", "Adam Haikal", "Aina Sofea" and "Rosnah". **None was present.** These pages hold every real person M21 shows: the officer, the adopted student, the three applicants and the parent. **No fictitious name matches a real person seen in the M21 evidence.**

### New findings (round 2)

| ID | Severity | Doc & section | Issue | Evidence | Owner | Required fix |
|---|---|---|---|---|---|---|
| AUD-M21-R2-01 | Info | — | The privacy comparison has two limits. <br>• The evidence stores personal data only in masked form, so the evidence scan can rule out a leak into the repository, but not a match with a real person. <br>• The matching guarantee rests on the round-1 live DOM check, and that check covered names only. The fictitious e-mails are all on the non-routable `@demo.test` domain, so they cannot equal a real address. | Round-1 live reads; evidence scan above. | — | None. |

### Routing

M21 v1.1 passes AUD and can go to G1. Report there the PROPOSED items of URS OQ-M21-13 / SRS §8.2 and the sponsor-portal decision (OQ-M21-01). Before build, the XL gate still has XR-M21-01…07 and 09–10 to process: the M02 anchors and the search `school` field, the M01 guards and landing page, and the M17 hand-over.
