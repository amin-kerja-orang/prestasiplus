# M04 — Question Bank — Independent Audit (AUD)

| Field | Value |
|---|---|
| Stage | AUD (TRACKER §6 step 4) |
| Date | 2026-09-25 |
| Auditor | Independent audit agent on browser lane 1 (`playwright`). This agent did not write the URS or SRS. |
| Documents audited | `docs/requirements/urs/M04-question-bank.md` v1.0 · `docs/requirements/srs/M04-question-bank.md` v1.0 |
| Evidence | Live https://prestasiplus.my (admin session on lane 1, read-only); `docs/discovery/M04-question-bank.md` (incl. Appendix A); `docs/discovery/inventory/M04/*` and `_raw/M04/*`; page scripts and DOM read in place; cross-check against `docs/requirements/srs/M03-curriculum.md` and `docs/discovery/inventory/M03/_curriculum-data.json`; masked audit screenshots in `docs/qa/audit/img/M04/` |
| Safety | Read-only throughout. Nothing was saved, submitted, approved, dismissed, uploaded, imported, regenerated, audited or downloaded, and no file was chosen. No practice or quiz URL was opened, and no "Buka Soalan Sama" link was followed. Confirm and alert texts were read from page scripts. The only client-side interactions were: ticking one S1 row, then pressing "Laksanakan" with **no action selected** (native validation blocked it, and no request was sent), and choosing DSKP selects on S2 (GET JSON lookups only). The ~465k-row list was sampled, not paged. Scripted GETs ran sequentially with at least a 400 ms gap. No personal data is recorded here. The two screenshots contain no names, but both were checked. Shared tools were not modified. The re-run batch was kept in the scratchpad. |

## Verdict: **FAIL**

There are **0 Critical, 5 Major and 14 Minor** findings.

The completeness proof is sound:
- The inventory re-runs identically.
- The URS §6 matrix covers all 1,226 elements.
- Every traceability link resolves.

The failures are in behaviour:
- **Two live defects** are not recorded, and the docs describe the behaviour the code intends instead:
  - the S4 DSKP selects do not show their saved values;
  - the S11 school filter and pagers lose state.
- **Two client behaviours are specified wrongly:**
  - the S2 DSKP reset when Subjek or Tahap is cleared;
  - the S3 AI error messages.
- **One live message cannot be reached:** the S1 "Sila pilih tindakan terlebih dahulu" alert.

Every fix is a document edit. After that, a targeted re-audit of the affected items is enough.

## Summary counts

| Measure | Result |
|---|---|
| Content elements in URS §6 (script) | **1,226 / 1,226** inventory IDs (S1–S14): 0 missing, 0 extra, 0 duplicates. 1,218 are mapped to a Function and 8 are excluded. |
| Matrix ↔ §3 FN "EL" columns (script, ranges expanded) | **0 inconsistencies** in either direction. No matrix row cites an unknown FN. |
| Mapping semantics, spot-checked by hand | 30 rows, **30 correct** (list below) |
| The 8 exclusions | All justified: S12-001–003 and S13-001–003 are the M16 tournament banner; S14-001 and S14-030 are headings the discovery harness injected. |
| Live re-inventory (`inventory.js` + `run-state.js` + `sanitize.js`, using the `tools/jobs/M04.js` job definitions) | 15 states: S1 ×3 (incl. 375), S2 ×2, S3, S4, S5@768, S6@375, S8 empty, S9, S10 row-open, S11 subject-9, S12 tab-all, S13@375. **Totals are identical** to the saved raw captures in all 15. Content keys are identical (0 added, 0 removed). The PII leak check found 0 leaks in every state, and no state has horizontal overflow. S7 was not re-run, because its dataset code can only be redacted with a local-only name list. |
| Traceability (script) | 173 FN, each cited by ≥1 FR. 141 AC, each with ≥1 FR and ≥1 E2E. 111 FR, each with ≥1 E2E. 58 E2E, each run at 375/768/1280. 0 dangling references. |
| Claims verified against live | **64**: 53 correct, 11 incorrect (list below) |
| Deviations DV-M04-01…14 | All 11 "fix" rows are real live defects that fall within D9. The 3 replicated items are acceptable. Findings on individual DVs: AUD-M04-15 (DV-14 cause label), AUD-M04-16 (new BM copy and the DV-01 scope), AUD-M04-17 (DV-08 internal inconsistency), AUD-M04-05 (DV-11 scope). **Two live defects are missing from §7:** AUD-M04-03 and AUD-M04-05. |
| Cross-module (M03 SRS) | Subject ids, names, codes, Teras set (1–7 = `isCore`), level ids/codes/names and subject↔level links all agree, and every M04 anchor's subject/level pair is a valid M03 link. There are **type and reference mismatches** (AUD-M04-18). |
| ID format | Numeric ids match the live format: questions `#564159`, reports `/question-reports/10/update`, structured `3698`, papers `/question-submissions/4/…`, notes `data-id="525"`. The seed report ids do not keep the live ids (AUD-M04-19). |
| Findings | **Critical 0 · Major 5 · Minor 14** |

## Findings

| ID | Severity | Doc + section | What's wrong | Live evidence | Required fix |
|---|---|---|---|---|---|
| AUD-M04-01 | **Major** | URS FN-M04-1.1.10, AC-M04-04.3; SRS FR-M04-13, §8.2 S1 "Bulk alert", E2E-M04-07 | The docs say that pressing "Laksanakan" with no action chosen shows `alert('Sila pilih tindakan terlebih dahulu')`. On live, the `action` select carries `required` and the form has no `novalidate`. The browser's native "Please select an item in the list." bubble therefore blocks the submit before `submitBulkAction` runs, and **the alert can never appear**. | Bulk form attributes `method=POST action=…/bulk-action @submit.prevent=submitBulkAction`; the select has `required`. Test: tick 1 row, press "Laksanakan" with no action → 0 dialogs, 0 non-GET requests, `validationMessage` "Please select an item in the list." | Specify the native required bubble on the `action` select, and state that the alert copy exists only as unreachable script (do not show it). Rewrite AC-04.3, FR-13, §8.2 and E2E-07 (assert `checkValidity() === false`, no dialog, no request). |
| AUD-M04-02 | **Major** | SRS FR-M04-33 ("with one missing, Bidang shows only its placeholder and SK/SP are reset"); URS AC-M04-09.1; E2E-M04-19 | The reset is only partial on live. When Subjek or Tahap is cleared, `loadBidang()` runs `this.bidangList = []; return;` and does **not** reset `bidangId/skId/spId` or the SK/SP lists. Bidang shows its placeholder, but SK and SP stay enabled and populated, "DSKP tagged" stays visible, and the **stale `dskp_sp_id` is still posted**. A full reset (ids and SK/SP lists cleared) happens only when both Subjek and Tahap are set again. | S2: Sains + Tingkatan 5 → Bidang 515 → SK 2645 → SP 6169, then Tahap cleared. Result: Bidang value "" with 1 option; SK value "2645", 20 options, enabled; SP value "6169", enabled; `FormData.get('dskp_sp_id') === "6169"`. Script: `if (!subjectId \|\| !levelId) { this.bidangList = []; return; }`. | Either replicate this exactly (FR-33, AC-09.1, E2E-19), or add a D9 deviation. It is arguably contradictory, because a tag is posted for a subject/level that no longer matches. If a DV is added, say exactly what is reset. |
| AUD-M04-03 | **Major** | URS FN-M04-1.4.4, AC-M04-09.4, §7 (missing DV); SRS FR-M04-35, E2E-M04-20 | **Live defect not recorded.** On S4 the saved Bidang/SK/SP ids are in the Alpine model (`bidangId '515'`, `skId '2667'`, `spId '6191'`) and the three lists load. However, the selects are bound before their `x-for` options exist, so **all three display their placeholders** ("-- Pilih Bidang --", "-- Pilih SK --", "-- Pilih SP --") while "DSKP tagged" shows. The form data holds `dskp_sp_id = ""`, so **saving the edit form would silently remove the tag**. Because `spId` is set, "Buang tag DSKP" (`bidangId && !spId`) is also never shown. The docs say the saved values show, and label this OBSERVED. The discovery screenshot `question-edit-desktop.png` shows the same placeholders. | `/admin/questions/564159/edit` after `networkidle` + 3 s: model `["515","2667","6191"]`; each select `selectedIndex 0`, yet the saved value is present among its options; "DSKP tagged" `display:flex`; `FormData.get('dskp_sp_id') === ""`. Screenshot `img/M04/s4-dskp-preload-placeholders-1280.png`. | Add a DV (broken: the displayed state is wrong and there is silent data loss on save). The rebuild shows the saved Bidang/SK/SP selected and posts the saved SP. Keep AC-09.4 and E2E-20 as the DV behaviour, and cite the live defect in their text. Re-check how DV-06 reads: on live the button is unreachable on a tagged question until the admin clears SP. Tell the discovery owner that §2.4 ("saved ids are preloaded") needs a correction. |
| AUD-M04-04 | **Major** | URS FN-M04-1.6.3, AC-M04-11.4; SRS FR-M04-46, §8.2 S3 "AI card", E2E-M04-25 | The error messages are mapped wrongly. The live script calls `await resp.json()` first. A **non-JSON** failure therefore throws a `SyntaxError`, and its browser message is shown (e.g. `Unexpected token '<' …`), **not** "HTTP {status}". "HTTP {status}" appears only for a JSON reply with `ok` falsy and no `message`, and that includes HTTP 200 `{ok:false}`. A network failure shows the browser's "Failed to fetch". "Gagal jana penjelasan" appears only if the error message is empty, which in practice never happens. After an error, the empty block (text **and** button) is shown again beside the error box. | S3 script: `const data = await resp.json(); if (!resp.ok \|\| !data.ok) throw new Error(data.message \|\| ('HTTP ' + resp.status)); … catch (e) { …; if (empty) empty.style.display=''; errorMsg.textContent = e.message \|\| 'Gagal jana penjelasan'; … }` | Specify: JSON `{message}` → that message; JSON without a message → "HTTP {status}"; non-JSON or network error → the exception text (the mock may return a fixed English parser/network string); the empty state re-shown. Fix E2E-25's three branches. |
| AUD-M04-05 | **Major** | URS FN-M04-5.2.3/5.2.4/5.2.8/5.2.9, AC-M04-25.2/25.3/25.5, §7 DV-M04-11; SRS FR-M04-95…98, BR-M04-19, E2E-M04-50 | Several S11 behaviours are unrecorded or specified wrongly: (a) the **school filter applies to the MCQ list only**, and the structured list stays unfiltered; (b) the **MCQ section (h2 and pager) is omitted when its count is 0**, not only the Struktur section; (c) **both pagers drop every filter**, so the links are `?mcq_page=2` / `?str_page=2` without `subject_id` or `school_id`, and paging a filtered list shows the unfiltered list; (d) the top-10 subject pills stay global under both filters, whereas DV-11 changes them to follow the school filter without saying live does otherwise. FR-96 ("apply both to the lists and stat cards") and AC-25.5 do not match live. | `?school_id=380` → h2 only "Struktur (522)" (MCQ section absent), pager "Showing 1 to 20 of 522 results", links `?str_page=2`, empty message not shown. `?subject_id=9` → "MCQ (718)", "Struktur (6)", pager links `?mcq_page=2` (the subject is dropped). The pills are identical in all three states. | Document (a)–(d). Then decide under D9, and either replicate or extend DV-11. (c) is a clear "broken" case (paging loses the filter), and (a) is contradictory. Update the FRs, BR-19, the §7 Live column of DV-11, and E2E-50 (pager hrefs, school filter on the structured list, MCQ section absent at 0). |
| AUD-M04-06 | Minor | URS FN-M04-1.1.11, AC-M04-01.4; SRS FR-M04-07 ("`id` descending"), §7 #1 | S1 is **not** sorted by id descending. Live page 1 reads 564159, 564160, 564161, 564157, 564158, 564155, 564156, 564153 …, which is creation time descending with ties by id ascending (the same rule the SRS already uses for S8 in BR-M04-26). | S1 row ids read in DOM order. | Order by `createdAt` desc, then `id` asc. Give the anchors created timestamps that reproduce the order. |
| AUD-M04-07 | Minor | URS FN-M04-1.1.13, AC-M04-01.6; SRS FR-M04-09, §7 #1 (`subject{…icon}`) | The S1 "Subjek" cell is plain text with a **fixed generic `fa-book` icon (indigo)** on every row. It is not a pill and it does not use the subject's own icon (e.g. Sains shows `fa-book`, not the tile's `fa-flask`). | All row cells: `<i class="fas fa-book text-indigo-500 …">` + name, inside an `inline-flex` span with no background. | Specify a fixed book icon + name (no pill). The row icon does not need the subject-icon map. |
| AUD-M04-08 | Minor | URS AC-M04-03.3; SRS E2E-M04-03 | "`compliance_filter=missing_source` … their line reads 'Source: TIADA'" is wrong. On live these rows show their source type with no file line (e.g. "Source: TEXTBOOK"). "Source: TIADA" appears when `sourceType` is null (e.g. `compliance_filter=draft` rows). BR-M04-04 (`sourceFile = null`) is correct. | `?compliance_filter=missing_source` first rows: "… Source: TEXTBOOK" with no file line, "Diluluskan ACTIVE". | Reword AC-03.3: "rows have no source-file line". Add an anchor with `sourceType` set and `sourceFile` null, and assert that in E2E-03. |
| AUD-M04-09 | Minor | URS FN-M04-3.2.18, AC-M04-19.9; SRS FR-M04-78, §8.2 S7, BR (§7 #14 "unknown → empty"), E2E-M04-39 | Invented message: an unknown `status` value shows the **same** `fa-check-double` "Tiada laporan buat masa ini" as an empty tab, not "Tiada laporan". **No tab is active** in that state (this is not documented). The discovery narrative carries the same error. | `?status=zzz` → no tab has the active class; text "Tiada laporan buat masa ini"; icon `fas fa-check-double`. | Remove "Tiada laporan". Specify the shared empty text and that no tab is active. Fix E2E-39 and tell the discovery owner. |
| AUD-M04-10 | Minor | URS FN-M04-2.2.2, 4.2.3, 4.2.5, 5.2.1, 5.2.2, 1.1.12, 1.1.18; SRS FR-M04-08/60/88/89/95 | Displayed casing and literal copy: (a) CSS upper-case not stated for S6 bucket titles ("SKOR 51-75", "SKOR ≤ 50", "LEGACY GENERIC"), S9 box labels ("STIMULUS / KONTEKS SOALAN", "JAWAPAN MODEL") and S11 labels ("MCQ PERLU GAMBAR", "STRUKTUR PERLU GAMBAR", "JUMLAH", "MCQ PERLU GAMBAR MENGIKUT MATA PELAJARAN"). (b) The S6 Legacy Generic text shows the **backticks literally** ("\`tracking_a_feed_20260308\`"), but the docs render it as Markdown code. (c) The S1 badges are an FA icon + "DSKP" / "Latihan Tambahan"; there is no "✓" or "📖" character, although the docs quote "✓ DSKP" and "📖 Latihan Tambahan" as copy. (d) "Tambah Soalan Pertama" is a text link, not a button. | Computed `text-transform: uppercase` on those labels; S6 `innerText`; S1 badge HTML `<i class="fas fa-check-circle …"></i> DSKP` and `<i class="fas fa-book-open"></i> Latihan Tambahan`; empty-state `<a … class="inline-block … text-indigo-600">`. | State "displayed upper case (CSS)" and give the displayed form. Quote the backticks as literal characters. Write the badges as icon + text. Call the empty-state action a link. |
| AUD-M04-11 | Minor | SRS §10 S1, S6, S10 | Breakpoints: (a) the S1 filter grid is `grid-cols-2 md:grid-cols-4`, i.e. **2 columns at 375** (the SRS says "1 column (NFR-RESP-06)") and 4 from 768 (the SRS says "2+"); (b) the S6 KPI grid is `grid-cols-2 sm:grid-cols-4`, i.e. **2 columns at 375** (the SRS and discovery say 1 column); (c) the S10 counters are `grid-cols-2 md:grid-cols-4`. This is observable, but the SRS labels it "INFERRED from screenshot". | Class names read on each page. | Correct §10 to the live grids. Relabel S10 as OBSERVED. |
| AUD-M04-12 | Minor | SRS FR-M04-61 (Purata pill "≥90 emerald, 75–89.9 amber, <75 red — INFERRED") | The inferred thresholds are contradicted by live: Bahasa Arab **88.1** and Pendidikan Al-Quran & As-Sunnah **88.0** have emerald pills (`bg-emerald-100 text-emerald-700`). Every live row is emerald. | S6 subject table pill classes. | Put emerald at ≥76 (the Cemerlang bound, still INFERRED) or at least ≤88, so that no live value would render amber. |
| AUD-M04-13 | Minor | URS FN-M04-1.3.1–1.3.7, AC-M04-08.x; SRS FR-M04-29…32 | Keyboard details are missing: (a) the Jawi keys are **inserted within the rows** (row 1 `… ف ڤ غ ڠ ع ه خ ح چ ج د`, row 2 `… ن ڽ م ك ݢ ط`, row 3 `… و ۏ ز ظ`), not appended; (b) the toggle button **also closes** the panel and has an active (blue) state; (c) `dir="rtl"` and the font **stay** on the textarea after closing; (d) the panel is placed above when `rect.bottom + 8 + 360 > innerHeight` and is clamped horizontally (8 px / 12 px); (e) the toggle is 36×36 and the close button is 32×32 (AC-30.5 then requires 44 px, a project-wide fix). | Script `layouts.jawi`, the toggle click handler, `open()`/`close()`, `panelStyle()`; CSS `.vkb-toggle-btn` 36px. | Add (a)–(d) to FN-1.3.x, FR-30/32 and E2E-16. |
| AUD-M04-14 | Minor | URS FN-M04-5.3.6, AC-M04-27.4; SRS FR-M04-104, §7 #27 | The S12 button states are incomplete. The clicked button is **disabled** while waiting and stays disabled after "Done" (it is re-enabled on error). Success is judged by the **HTTP status** (`res.ok`) alone, not by a `{ok:true}` body. §7 #27 returns `{ok:false}` without a status, so a 200 `{ok:false}` would show "Done". | S12 script: `btn.disabled = true; … if (res.ok) {row.style.opacity='0.5'; btn.textContent='Done'} else {btn.textContent=orig; btn.disabled=false}`. | Add the disabled state. Make §7 #27 return a non-2xx status for failures. |
| AUD-M04-15 | Minor | URS §7 DV-M04-14 ("cause INFERRED") | The cause can be observed: the h1 colour is `rgb(30, 41, 59)`, the same as the `.adminhdr` background `rgb(30, 41, 59)`. The subtitle is white. The DV itself is valid (unreadable text). | Computed styles; screenshot `img/M04/s12-h1-invisible-1280.png`. | Relabel the cause as OBSERVED and cite the colours. |
| AUD-M04-16 | Minor (Delivery Lead decision) | URS §7 DV-M04-01, DV-M04-07, DV-M04-12; AC-14.1, FN-2.1.6; SRS FR-58, §6.6, §7 #10, E2E-33 | New BM copy is not marked. DV-01 invents a whole page (title, 4 column headers, "Tiada sejarah import."), a new entity (ImportRun), an endpoint and an E2E. DV-07 adds " (atau guna Tetapan Lalai)". DV-12 adds "Menunjukkan 0 daripada 0 soalan". None of these is marked **PROPOSED COPY**, although M02 DV-12 set that precedent. D9 permits improvising, so DV-01 is compliant. The minimal fix for a 500 link, however, is to remove or hide "Sejarah Import" (the M01 `/settings` 404 precedent was "drop or merge"). An invented history page is the largest new surface in M04. | `/admin/questions/import-history` returns HTTP 500 (re-checked). Its only live buttons are "Halaman Utama" → `/` and "Cuba Semula". | The Delivery Lead confirms the DV-01 scope with the user at G1 (keep the improvised page, or remove the link). Mark the DV-01, DV-07 and DV-12 strings as PROPOSED COPY in the URS/SRS. |
| AUD-M04-17 | Minor | URS §7 DV-M04-08; SRS BR-M04-15, §6.11 reports 6 and 7, E2E-40 | DV-08 contradicts itself. It treats the structured report on 3703 ("Set jawapan tidak tepat", the MCQ label) as the code `wrong_options`, to be relabelled "Markah tidak adil". Yet it treats the structured report on 2509 ("Jawapan tidak tepat", equally the MCQ label of `wrong_answer`) as legacy free text "displayed as stored". The two are the same case. Live only proves that the pill shows MCQ labels, plus the raw "unclear". | S7 cards: 3703 "Jawapan Salah" / "Set jawapan tidak tepat"; 2509 "Jawapan Salah" / "Jawapan tidak tepat". | Apply one rule. Either both are codes (2509 → "Skema jawapan tidak tepat") or both are stored text. Align the seed and E2E-40. |
| AUD-M04-18 | Minor | SRS §6.1 (`subjectId`/`educationLevelId` int), §6.10, §7 (no subject/level lookups), §0/§13 SQ-1; URS §0 "Related" | Cross-module mismatch with the M03 SRS: (a) M03 DATA-M03-01/02 type the subject and level `id` as **string** ("1"…"31", "1"…"11"), while M04 uses **int**; (b) M04 does not reference the M03 lookups `GET /api/subjects` (#28) and `GET /api/education-levels` (#29) that S1, S2, S5, S8 and S11 need, nor M03 `isCore` (M04 hard-codes Teras = ids 1–7; the values agree today); (c) the URS still says "the M03 URS/SRS did not exist when this was written"; (d) SQ-1 asks to confirm the numeric-id exception, which SRS.md §7.4 now grants. Master §7.4 says a *numeric* id, so M03's string ids are also off-rule. | M03 SRS §6.1/6.2 ("id string, '1'…'31'"), §7 #28/#29; SRS.md §7.4. The values are consistent: codes BM…SS, level codes D1…T5, `isCore` 1–7, and every M04 anchor pair is a valid M03 level link. | Align the id type with M03 (or both with §7.4 numeric, which the Delivery Lead decides across M03/M04). Reference M03 #28/#29 and `isCore`. Update the §0 Related row. Close SQ-1. |
| AUD-M04-19 | Minor | SRS §6.11 Reports ("ids 1–11") | Master §7.4 says seed data "keeps the live ids where known". The live report ids are known: 3698→10, 3700→9, 136891→6, 3703→4, 2509→3 (form actions `/question-reports/{id}/update`). The seed renumbers them (e.g. 136891 → 8, 3698 → 10 but 3700 → 9 by chance). | S7 form actions. | Use the live report ids for the reports that are live and new ids for the added dismissed report. Update E2E-40…43. |

### Deviation verification (URS §7)

| DV | Live defect reproduced? | Within D9? | Note |
|---|---|---|---|
| DV-M04-01 | Yes. HTTP 500 "Ralat Pelayan" with "Halaman Utama" and "Cuba Semula". | Yes (dead link) | The scope is a Delivery Lead decision (AUD-16). |
| DV-M04-02 | Yes. The header shows "Dashboard" / "Selamat datang, Admin" on S1, S2, S3, S7 and S8/S9, and "Dashboard" / "Selamat datang kembali" on S12. No sidebar item is active on S2; S1 and S5 are active. | Yes (wrong titles, missing active state) | — |
| DV-M04-03 (replicated) | S11 has no admin sidebar item (the SOALAN group is closed on S11). S12 uses the user layout. | Correctly replicated | Nothing is broken. |
| DV-M04-04 | Yes. "Jumlah: 439,478" vs the pager's 465278 vs the S6 figure of 466,041. PSV is 48,360 on S1 but 4,560 on S6. | Yes (contradictory) | — |
| DV-M04-05 | The edit form is MCQ-only (no type select; options and correct answer `required`). | Yes (contradictory: create offers 5 types that edit cannot round-trip) | **Latent.** No non-MCQ question exists live (URS OQ-3). This should be stated in the DV. |
| DV-M04-06 | Yes: `bidangId && !spId`. | Yes | On live the button is even less reachable because of AUD-03. |
| DV-M04-07 | Yes. `subject_id`/`education_level_id` are listed as required next to the "jika kolum berkaitan tiada" defaults. | Yes (contradictory rule) | The copy is proposed (AUD-16). |
| DV-M04-08 | Yes. "PENDING_MAPPING", "MARKING_SCHEME" and "unclear" are shown raw, and the structured report uses the MCQ label. | Yes (wrong labels) | Internal inconsistency (AUD-17). Note: the filter labels the source "Skema", while the DV's "MARKING SCHEME" keeps the English code. That is acceptable, but the other option could be recorded. |
| DV-M04-09 | Yes. At 768 the S1 pager content reaches 827 px (the viewport is 768). At 375 the "Soalan" column is 82 px (the table is 499 px in a 302 px scroller). | Yes (layout, unreadable) | — |
| DV-M04-10 (replicated) | Confirmed with no confirm dialog on: S7 (3 forms), S11 upload and dismiss, S12 (3 buttons), S10 "Simpan", S6 audit. | Correctly replicated | These work and are recorded as SEC-M04-01. |
| DV-M04-11 | Yes. The cards stay at 6,144 / 522 / 6,666 under `subject_id=9` while the headings read "MCQ (718)" / "Struktur (6)". | Yes (contradictory) | The Live column is incomplete, and the pill change goes beyond live (AUD-05). The school select has **10,221** options, and replicating it is acceptable (it works, it is just long). |
| DV-M04-12 | Yes: "Menunjukkan – daripada 0 soalan". | Yes (broken text) | The copy is proposed (AUD-16). |
| DV-M04-13 | Yes. S1 shows 29 tiles and omits 19 and 20. Tiles 28–31 are shown with 0 questions, so the omission is **not** data-driven (it is not "subjects with questions"). BT is active, linked to 11 levels in M03, has 6,300 questions on S6, and can be filtered. | Yes (contradictory / missing) | The DV is valid. |
| DV-M04-14 | Yes. The h1 colour equals the card background (AUD-15). | Yes (unreadable text) | — |
| "Not deviations" list | Checked: the English pager and labels, "Arkib" vs "Diarkibkan", the 4 fixed options, the MCQ-only import, the M10-owned structured authoring, native dialogs, the S11 school select, dataset badges, the S7 page without a pager, the modal subtitles. | Correctly replicated | The mixed-language and Arkib/Diarkibkan labels are consistent within each screen, so they are not broken. |
| **Missing** | The S4 DSKP selects show placeholders and the saved tag is lost on save (AUD-03). The S11 pagers drop filters and the school filter is MCQ-only (AUD-05). | Both are "broken" under D9 | They must be added as fixes or explicitly replicated. |

### Flows walked (up to, never including, the mutating click)

| Flow | Result |
|---|---|
| S1 list: default, subject-4, archived, pending_mapping, marking_scheme, missing_source, draft, untagged, verified_generated, search-empty; select one row; 768/375 | The structure, filter options, tiles, active tile, empty state and pager all match. Deviations: the alert (AUD-01), the order (AUD-06), the subject cell (AUD-07), missing_source (AUD-08), the filter grid (AUD-11). |
| S2 create: field attributes, type cards, DSKP cascade Sains/T5 → 515 → 2645 → 6169, then Tahap cleared; keyboard script and panel markup | The fields match exactly (required flags, placeholders, accept lists, `:required` for MCQ, A checked, defaults bm/1). Deviations: the reset (AUD-02) and the keyboard details (AUD-13). |
| S3 show (564159, 129114) | Tab title, h1/subtitle, delete `onsubmit` confirm, Maklumat labels in CSS upper case, "(1/5)", "Belum ditag", "20/03/2026 17:08", AI card copy, `updateStatus` confirm and actions, and the regen confirm all match. The error mapping differs (AUD-04). |
| S4 edit (564159) | PUT spoof, no type select, no keyboard, `remove_*` hidden flags and "Tukar gambar" x-text all match. The DSKP preload is broken (AUD-03). The existing-image preview could not be checked, because the sampled question has no image. |
| S5 import + history | All copy, links, accept `.csv,.txt` required and the difficulty default 2 match. History returns HTTP 500. |
| S6 quality | KPI/bucket values and copy, the distribution labels, the 26-row subject table, 11 level rows and the audit form (`@submit="submitting = true"`, no confirm) match. Casing (AUD-10), the KPI grid (AUD-11) and the pills (AUD-12) differ. |
| S7 reports: all, dismissed, zzz, default | Tabs (counts, colours, default Menunggu), card borders, badge order, "Dikeluarkan" vs "Diperbaiki", hidden fields, no confirm, "Nyahaktif Segera" absent when inactive, links and `target=_blank` URLs all match. The unknown status differs (AUD-09). |
| S8/S9 structured | Stats, alphabetical pills and subject filter, KBAT options, `hidden sm/md:table-cell`, Malay counter, English pager, the DV-12 empty counter, the Reset link, and the S9 content and links all match. |
| S10 papers | Counters (no Ditolak card), filter options, columns, PATCH panel (required select, maxlength 1000, 2 rows) and date format match. |
| S11 diagram audit: default, subject 9, subject 19, school 380 | Stats, pills, 10,221 schools, upload `image/*` required, "Dismiss", empty copy and the DV-11 defect match. Unrecorded behaviour: AUD-05. |
| S12 master notes | Title, shell fallback, summary copy, tabs, row meta/Soalan/Trap, 15 per page and the button script match. Differences: AUD-14 and AUD-15. |
| S13 + user-portal shell | Counters (`grid-cols-2 sm:grid-cols-5`) and empty copy match. Sidebar: "Semakan Nota Master" under "🛡️ Kawalan Kualiti", "Laporan Soalan" under "💎 Killer Features", "Kertas Soalan Guru" under "Admin", "Gambar Rajah 6,144" under "Bantuan". Only "Laporan Soalan" and "Semakan Nota Master" are in the mobile drawer. |
| S14 modal | **Not opened live** (host pages are practice URLs). Checked against the saved raw capture: 7 MCQ checkboxes, a textarea with rows 3 and maxlength 500, "Batal", "Hantar Laporan / Menghantar...", "Terima Kasih!", "Tutup". It agrees with the URS/SRS. |

## Claims verified (64)

| # | Claim (doc) | Result |
|---|---|---|
| 1 | S1 tab title "Pengurusan Soalan" | Correct |
| 2 | S1 shell fallback "Dashboard" / "Selamat datang, Admin" (DV-02 evidence) | Correct |
| 3 | h1 "📚 Pengurusan Soalan" + subtitle | Correct |
| 4 | "Tambah Soalan" ≥640 / "Tambah" <640 (`hidden sm:inline` / `sm:hidden`) | Correct |
| 5 | "Jumlah: 439,478 soalan" vs pager 465278 (DV-04) | Correct |
| 6 | 29 tiles; icons per SRS §6.10 (28–31 `fa-book`) | Correct |
| 7 | No BC/BT tiles (DV-13) | Correct |
| 8 | Truncation "Bahasa Melay...", "Reka Bentuk..." | Correct |
| 9 | Active tile `border-indigo-500 bg-indigo-50 shadow-md`; "Padam filter subjek — tunjuk semua" → `/admin/questions` | Correct |
| 10 | The 8 filter selects: names, values and labels | Correct |
| 11 | Icon-only `fa-search` submit | Correct |
| 12 | Bulk options Pilih Tindakan / Luluskan / Tolak / Arkibkan / Padam | Correct |
| 13 | Bulk confirm template and verbs | Correct |
| 14 | No-action alert "Sila pilih tindakan terlebih dahulu" | **Incorrect** (AUD-01) |
| 15 | Row delete confirm "Adakah anda pasti mahu memadamkan soalan ini?" | Correct |
| 16 | Row titles "Lihat" / "Edit" / "Padam" | Correct |
| 17 | Table headers upper-cased by CSS | Correct |
| 18 | Newest id first | **Incorrect** (AUD-06) |
| 19 | Subjek pill with the subject icon | **Incorrect** (AUD-07) |
| 20 | Archived "Arkib" (slate) + "INACTIVE" (red) | Correct |
| 21 | Raw "PENDING_MAPPING" / "MARKING_SCHEME" (DV-08) | Correct |
| 22 | `missing_source` → "Source: TIADA" | **Incorrect** (AUD-08) |
| 23 | `compliance_filter=draft` rows → "DRAFT", "Source: TIADA" | Correct |
| 24 | Empty state: `fa-inbox`, "Tiada soalan dijumpai", "Tambah Soalan Pertama", no table | Correct (it is a link, AUD-10) |
| 25 | "Showing 1 to 20 of 465278 results", 1–10 … 23263 23264, aria "&laquo; Previous" / "Go to page n" / "Next &raquo;" | Correct |
| 26 | Pager keeps filters (`?status=archived&page=2`) | Correct |
| 27 | DV-09: 768 pager 827 px; 375 "Soalan" 82 px | Correct |
| 28 | S1 filter 1 column at 375 | **Incorrect** (AUD-11) |
| 29 | S2 fields: required, placeholders, accept, min, rows, defaults | Correct |
| 30 | S2 `correct_answer` A checked, `:required="questionType === 'mcq'"` | Correct |
| 31 | `tf_answer` and `correct_answer_text` not required | Correct |
| 32 | DSKP endpoints, formats, sample "T5-SUB4-TEXTBOOK - Sains T5 - Sokongan Bab Buku Teks" | Correct |
| 33 | SK/SP reset when Subjek/Tahap is cleared | **Incorrect** (AUD-02) |
| 34 | Keyboard rows, 9 harakat titles, Scheherazade font, Esc, `sm:hidden` backdrop, 580 px, 44 px keys | Correct (details in AUD-13) |
| 35 | Keys use `@mousedown.prevent`; the input event is dispatched | Correct |
| 36 | S3 tab "Lihat Soalan", h1, "Soalan #id", delete `onsubmit` confirm | Correct |
| 37 | Maklumat labels in CSS upper case, "(1/5)", "Belum ditag", `dd/mm/yyyy HH:MM` | Correct |
| 38 | AI card empty/loading/default-error copy | Correct |
| 39 | AI error mapping (message / Gagal / HTTP for non-JSON) | **Incorrect** (AUD-04) |
| 40 | Regen confirm; `updateStatus` confirm and `pending_review` / `approve` | Correct |
| 41 | S4: PUT, no type select, no keyboard, `remove_question_image` / `remove_option_image_0..3` | Correct |
| 42 | S4 shows the saved Bidang/SK/SP | **Incorrect** (AUD-03) |
| 43 | "Buang tag DSKP" absent while SP is set (DV-06) | Correct |
| 44 | S5 copy, links, `.csv,.txt` required, difficulty default "2" | Correct |
| 45 | Import history HTTP 500 copy and buttons | Correct |
| 46 | S6 KPI values and bucket copy | Correct (casing and backticks, AUD-10) |
| 47 | Audit form: no confirm, "Sedang audit..." while submitting | Correct |
| 48 | Purata pill thresholds | **Incorrect** (AUD-12) |
| 49 | S7 tab title, tab counts and colours, default Menunggu | Correct |
| 50 | Card borders: pending amber, fixed/removed emerald, reviewed slate | Correct |
| 51 | Badge order; "Dikeluarkan" only on existing inactive questions; deleted question → "Diperbaiki" + "Soalan tidak dijumpai" | Correct |
| 52 | Hidden fields of the 3 actions; no confirm; "Nyahaktif Segera" only while active | Correct |
| 53 | "Lihat Soalan Struktur #id" / "Edit Soalan #id"; "Buka Soalan Sama" URLs (MATH) with `target=_blank` | Correct |
| 54 | Unknown status → "Tiada laporan" | **Incorrect** (AUD-09) |
| 55 | S8 stats, alphabetical pills and subjects, KBAT options, hidden columns, counter, pager | Correct |
| 56 | S8 empty counter "Menunjukkan – daripada 0 soalan"; Reset link | Correct |
| 57 | S9 pills, "ID: #3698", "08 Apr 2026", 3(A)–3(C), links | Correct (casing, AUD-10) |
| 58 | S10 counters (no Ditolak), filter, columns, PATCH panel, maxlength 1000 | Correct |
| 59 | S11 stats global under a filter; 10,221 schools; `subject_id=19` empty text; Struktur omitted at 0 | Correct |
| 60 | S11 filters apply to both lists; pager keeps only its own param | **Incorrect** (AUD-05) |
| 61 | S12 title, summary copy, tabs, row meta, 15/page, button script, invisible h1 | Correct |
| 62 | S13 counters and empty copy; `sm:grid-cols-5` | Correct |
| 63 | User-portal sidebar sections and the "Gambar Rajah" badge | Correct |
| 64 | Admin sidebar: no active item on S2; active on S1 and S5 | Correct |

## Coverage-matrix spot-check (hand, 30 rows)

These rows were checked: S2-020, S2-074, S2-104, S2-161, S2-168, S3-031, S3-055, S4-022, S4-091, S5-020, S5-053, S6-013, S6-092, S7-035, S7-090, S7-110, S7-126, S8-066, S8-068, S9-035, S10-021, S10-046, S11-086, S11-107, S11-145, S12-004, S12-055, S13-015, S14-008 and S14-031. **All 30 map to the right Function.**

The 8 exclusions (S12-001–003, S13-001–003 → the M16 tournament banner; S14-001/030 → harness headings) are justified. So are the SHA/SHU range exclusions to the global shell, M02, M06 and M07.

The content gaps this audit found (AUD-02/03/05) are not missing inventory IDs. They are behaviours of elements that exist (S2-012–019, S4-013–021, S11-022–025 and the pagers) that the FN/FR text describes wrongly.

## Cross-module check (M03 SRS)

| Item | M04 | M03 SRS | Result |
|---|---|---|---|
| Subject ids / names (1–31, id order) | S1 filter; §6.10 | `_curriculum-data.json` subjects | Match |
| Subject codes (MATH for "Buka Soalan Sama") | BR-M04-17 | DATA-M03-02 `code` | Match |
| Teras set | ids 1–7, hard-coded | `isCore` true for 1–7 | Values match; the reference is missing (AUD-18) |
| Level ids / codes / names | 1–11, D1…T5, "Darjah n" / "Tingkatan n" | BR-01, DATA-M03-01 | Match |
| Anchor subject/level pairs (e.g. BT/D2, BM/D3, Matematik/D4, Sejarah/D6) | §6.11 | `education_level_ids` | All valid |
| Subjects 28–31 without levels, BC without questions | Generated set excludes 19 and 28–31 | Links `[]`; BC count 0 | Consistent |
| Id type | int | string "1"…"31" | **Mismatch** (AUD-18) |
| Lookup endpoints | not referenced | #28 `/api/subjects`, #29 `/api/education-levels` | **Missing reference** (AUD-18) |
| Question counts | BR-M04-20: M03 columns read the M04 objective count | FR-M03-98: M04 count when the M04 store holds questions | Consistent |
| DSKP | M10-owned fixture subset | not defined in M03 | No conflict |

## Not verifiable read-only (correctly INFERRED / UNVERIFIED COPY in the docs)

These could not be checked without an unsafe or mutating action:
- every POST outcome and flash message;
- the non-MCQ S3/S4 rendering (no such question exists live);
- the used-question statistics and the quick-action buttons;
- AI generation and regeneration;
- the template CSV (a download);
- import results;
- a populated S13;
- flagged or approved master notes;
- the S14 modal live (practice host URLs are forbidden; the saved markup was used);
- the non-admin view;
- the S4 preview of an existing question image (the sampled questions have no image; `x-data="{ preview: null … }"` suggests the saved image is never previewed, which should be confirmed when a question with an image is known).

## Screenshots (`docs/qa/audit/img/M04/`, no personal data)

| File | Shows |
|---|---|
| `s4-dskp-preload-placeholders-1280.png` | The S4 DSKP block for 564159: all three selects show their placeholders while "DSKP tagged" is displayed (AUD-03). |
| `s12-h1-invisible-1280.png` | The S12 dark header card: the h1 is invisible (the text colour equals the background); only the white summary line is readable (DV-14, AUD-15). |

## Notes for the discovery owner (not audited documents; not edited)

- §2.4: "saved ids are preloaded" should add that the selects display placeholders (AUD-03).
- §2.7: "Unknown status: 'Tiada laporan'" is wrong (AUD-09).
- §2.6/§7: "KPI 1 column" is wrong; it is 2 columns (AUD-11).
- §2.1: "newest id first" is wrong (AUD-06).
- §2.11: the pager and school-filter behaviour is missing (AUD-05).

---

## Round 2: targeted re-audit of URS/SRS v1.1 (2026-09-25)

**Scope.** I checked the v1.1 changes for AUD-M04-01…19, the new or narrowed deviations (DV-M04-15, DV-M04-16, the narrowed DV-M04-11 and the reduced DV-M04-01), the 7 discovery corrections marked "(corrected after audit)", and D10 (accessibility replicates live).

Where it mattered I checked against live again, on lane 1 with the same read-only rules as round 1. No practice or quiz URL was opened and no action was triggered. The pages reloaded were S1, S3 564159, S4 564159, S11 `?subject_id=9`, S7 `?status=zzz` and S2. For each I only read DOM attributes and scripts.

The Delivery Lead's decisions on DV-01 (a minimal read-only table, PROPOSED COPY), DV-15, DV-16 and the narrowed DV-11 (the school filter stays MCQ-only) were treated as settled scope.

### Verdict: **PASS**

There are 0 Critical and 0 Major findings. All 19 round-1 findings are closed, with no regressions and no new findings.

### Sanity checks (script)

| Check | Result |
|---|---|
| Content elements in URS §6 | 1,226/1,226 (0 missing, 0 extra, 0 duplicates); 8 exclusions unchanged |
| Matrix ↔ §3 FN "EL" columns | 0 inconsistencies; 174 FN (new FN-M04-6.3.5 is behaviour-only) |
| FN → FR | 174/174; no FR cites an unknown FN |
| AC → FR / E2E | 143/143 on both (new AC-09.6 and AC-29.4) |
| FR → E2E | 112/112 (new FR-M04-112 → E2E-59); 59 E2E, all on 375/768/1280 |
| Dangling AC/FR references in E2E | 0 |
| Live still matches round-1 evidence | S1: select `required`, no `novalidate`, order 564159, 564160, 564161, 564157, 564158, 564155, filter grid `grid-cols-2 md:grid-cols-4`. S3: AI script unchanged (`await resp.json()`, `data.message \|\| ('HTTP ' + resp.status)`, `e.message \|\| 'Gagal jana penjelasan'`, empty state re-shown). S4: selects still at index 0 and `dskp_sp_id` = "". S11: `?subject_id=9` pager links still `?mcq_page=n`. S7: `?status=zzz` has 0 active tabs and shows "Tiada laporan buat masa ini". S2: the `loadBidang` partial-reset line is unchanged. |

### Finding status

| ID | Status | Evidence (docs v1.1 + live) |
|---|---|---|
| AUD-M04-01 | **Closed** | FN-1.1.10, AC-04.3, FR-13 and §8.2: the native required bubble blocks the submit, the alert is unreachable dead code and is not shown. E2E-07 asserts `checkValidity()` false, `valueMissing`, no dialog and no request. Live re-check: `required`, no `novalidate`. |
| AUD-M04-02 | **Closed** | FR-33 and the new AC-09.6: when either field is cleared, only the Bidang list empties; the ids, SK/SP lists, enabled state and "DSKP tagged" are kept, and the old SP is still posted. Setting both fields again resets all three. AC-09.1 limits the full reset to "both set". E2E-19 asserts SK 2667 / SP 6191 kept and `FormData` `dskp_sp_id` = "6191". This matches the live script. |
| AUD-M04-03 | **Closed** | New DV-M04-15. FN-1.4.4, AC-09.4, FR-35 and E2E-20 (including "save without changes keeps the tag") cite the live defect and the audit screenshot. The DV-06 text is updated for the interaction. The discovery §2.4 is corrected. |
| AUD-M04-04 | **Closed** | FN-1.6.3, AC-11.4, FR-46 and §7 #8 (test hooks for non-JSON and network failures) cover the five branches: JSON message → message; JSON without message → "HTTP {status}", including 200 `{ok:false}`; non-JSON → parse-error text; network → "Failed to fetch"; "Gagal jana penjelasan" effectively never. The empty state is re-shown in each. E2E-25 tests all five. This matches the live script. |
| AUD-M04-05 | **Closed** | FN-5.2.3/5.2.4/5.2.8/5.2.9, AC-25.1–25.6, FR-95–98 and BR-19 now state that the school filter is MCQ-only, the MCQ section is omitted at 0, and the pills are global. DV-16 covers the pager filters; DV-11 is narrowed to the stat cards. E2E-50 covers the pager href, the school-only case and the pills. The discovery §2.11 is corrected. |
| AUD-M04-06 | **Closed** | FN-1.1.11, FR-07 and the new BR-M04-31 order by `createdAt` desc, then `id` asc (live re-check: same first six ids). Discovery corrected. |
| AUD-M04-07 | **Closed** | FN-1.1.13 and FR-09: a fixed indigo `fa-book` icon + name, no pill. |
| AUD-M04-08 | **Closed** | AC-03.3 reworded (no file line; TIADA only when the type is empty). New anchor 570006 (textbook, no file); E2E-03 asserts both cases. |
| AUD-M04-09 | **Closed** | FN-3.2.18, AC-19.9, FR-78 and E2E-39: the same block and no active tab (live re-check). Discovery corrected in 2 places. |
| AUD-M04-10 | **Closed** | CSS upper case is stated for S6 buckets, S9 labels and S11 cards/labels. The backticks are literal (`&#96;`). The badges are icon + "DSKP" / "Latihan Tambahan". "Tambah Soalan Pertama" is an indigo text link with `fa-inbox`. |
| AUD-M04-11 | **Closed** | SRS §10: S1 filter `grid-cols-2 md:grid-cols-4` (kept as live, D10); S6 KPI `grid-cols-2 sm:grid-cols-4`; S10 `grid-cols-2 md:grid-cols-4` OBSERVED. Discovery corrected. |
| AUD-M04-12 | **Closed** | FR-61: emerald at ≥76 (INFERRED; every live value is emerald). |
| AUD-M04-13 | **Closed** | FN-1.3.1/1.3.3/1.3.7, AC-08.3 and FR-30/32: Jawi letters placed inside the rows (orders identical to the live `layouts.jawi`); the toggle closes the panel and shows an active state, 36×36; `dir="rtl"` and the font persist; placement and clamping. §7 keeps the live visual sizes, with the 44 px hit area coming from project rule NFR-RESP-03. |
| AUD-M04-14 | **Closed** | FR-104 and §7 #27: disabled while pending and after "Done", re-enabled on non-2xx; the body is not read; failures return non-2xx. |
| AUD-M04-15 | **Closed** | DV-14 cause OBSERVED, colours cited, audit screenshot referenced. |
| AUD-M04-16 | **Closed** | A PROPOSED COPY convention is added (§0) and applied to DV-01, DV-07 and DV-12 (FN-2.1.6/2.1.8/4.1.6, AC-13.3/14.1/22.5, S5h row). DV-01 is reduced to a read-only table with no actions, filters or details (settled scope, D9 "improvise"). OQ-5 carries the owner's G1 confirmation. |
| AUD-M04-17 | **Closed** | DV-08 and BR-15: one rule (stored reasons are codes; the label follows the question type). Reports 4 and 3 read "Markah tidak adil" / "Skema jawapan tidak tepat"; seed and E2E-40 aligned. |
| AUD-M04-18 | **Closed** | DATA-M04-01 `subjectId`/`educationLevelId` are int, and M03 SRS v1.2 now uses integer ids too, so the types agree. New FN-6.3.5, FR-112 and §7 #32/#33 reference M03 #28/#29 (paths and response shapes match M03) and `isCore`; E2E-59 added. URS §0 Related updated. SQ-1 closed. |
| AUD-M04-19 | **Closed** | §6.11 reports keep the live ids 10, 9, 6, 4 and 3 (matching the live form actions). Ids 8, 7, 5, 2 and 1 are inferred from the live newest-first order, which is consistent. Added report 11 (dismissed). E2E-40…43 renumbered. |

### Review of the new and changed deviations

| DV | Live defect real? | D9 / D10 fit | Specification check |
|---|---|---|---|
| DV-M04-15 (S4 DSKP preload) | Yes. Re-checked: `selectedIndex` 0 on all three selects, `dskp_sp_id` "". | Yes. The displayed state is wrong and saving silently loses data. It is not an accessibility item. | Only the display and the posted value change; the lists, chain loading and clearing of stale ids stay as live. E2E-20 tests saving without changes. Correct. |
| DV-M04-16 (S11 pagers keep filters) | Yes. Re-checked: `?subject_id=9` → `?mcq_page=2`. | Yes (paging loses the active filter). | Only `subject_id`/`school_id` are added to the links; dropping the other list's page parameter stays as live. `school_id` on the Struktur pager is harmless, because that list ignores it. Correct. |
| DV-M04-11 (narrowed) | Yes. The cards stay global while the headings are filtered. | Yes (contradictory display). Keeping the school filter MCQ-only follows D9/D10: structured cards show no school, so it is a consistent limit and not a contradiction. | Only the stat cards change (per-list filtered counts, "Jumlah" = their sum). The pills, the MCQ-only school filter, the MCQ omission at 0 and the school select are listed as replicated. Correct. |
| DV-M04-01 (reduced) | Yes (HTTP 500). | Yes (D9 "broken → improvise"; settled scope). | Read-only table, strings marked PROPOSED COPY, owner confirmation at G1 (OQ-5). Correct. |

D10: NFR-M04-06 replicates the live ARIA, titles and focus behaviour, and fixes only D9-broken items (DV-09, DV-14). The 44 px touch hit area comes from master NFR-RESP-03, which is still in force (the same as M03), so it is not an M04 enhancement.

### Spot-check of 12 edited passages

| # | Passage | Result |
|---|---|---|
| 1 | FN-1.1.10 / AC-04.3: native bubble text given as a browser example, alert "never shown" | Correct |
| 2 | FR-33: "only the Bidang list is emptied … old `dskp_sp_id` still posted" | Correct (script re-checked) |
| 3 | AC-09.1: full reset only when both are set and either changes | Correct (`loadBidang` resets the ids when both are present) |
| 4 | FR-46: parse first; message / HTTP {status} / parse text / "Failed to fetch" | Correct |
| 5 | E2E-25: HTTP 200 `{ok:false}` → "HTTP 200" | Correct |
| 6 | BR-M04-31 sample order | Correct (live) |
| 7 | FN-1.3.3 Jawi rows | Correct (identical to the live `layouts.jawi`) |
| 8 | FR-104 disabled/Done semantics | Correct (live script) |
| 9 | BR-19: "each list omitted at 0; empty message only when both are 0" | Correct (`?school_id=380` shows only Struktur and no empty message) |
| 10 | AC-15.2 literal backticks | Correct |
| 11 | §6.11 report ids vs the live form actions `/10`, `/9`, `/6`, `/4`, `/3` | Correct |
| 12 | §7 #32/#33 vs M03 §7 #28/#29 | Correct (paths, query, response fields and integer ids agree) |

### New findings

None.
