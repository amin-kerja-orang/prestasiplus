# M07 — Premium PKSK — Independent Audit (AUD)

| Field | Value |
|---|---|
| Stage | AUD (TRACKER §6 step 4) |
| Date | 2026-09-25 |
| Auditor | Independent audit agent on browser lane 2 (`playwright2`). This agent did not write the URS or SRS. |
| Documents audited | `docs/requirements/urs/M07-pksk.md` v1.0 · `docs/requirements/srs/M07-pksk.md` v1.0 |
| Evidence | Live https://prestasiplus.my (admin session on lane 2, read-only, plus one cookie-less guest context for redirect checks); `docs/discovery/M07-pksk.md` (D-1…D-8, L-1…L-8, Appendices A–B); `docs/discovery/inventory/M07/*` and `_raw/M07/*`; page markup and inline scripts read in place; cross-checks against the M01, M02, M03 and M04 SRS/URS and the M02/M03/M04/M06 deviation precedents; masked audit screenshots in `docs/qa/audit/img/M07/` |
| Safety | Read-only throughout. No `/pksk/level/{L}/exam` or `/pksk/level/{L}/domain/{CODE}` URL was opened (not even as a guest). "Simpan Soalan", "Kemaskini", "Luluskan", "Tolak", "Padam", "Beri Akses" and "Tarik" were never pressed; the create form and the grant form were filled locally and left without submit. All list reads were same-origin GETs with ≥350 ms between requests (the 39-page id read took ~16 s). The access page was only ever rendered with the Pengguna / Diberi Oleh cells masked at DOMContentLoaded (init script equivalent to `M07MASK`), or read as structure only (ids, package, dates). No name or e-mail was read into any file; a grep of the lane-2 artefacts found no e-mail address. Shared tools were not modified; the re-run output went to `.playwright-mcp/lane2/` only. |

## Verdict: **FAIL**

There are **0 Critical, 4 Major and 6 Minor** findings.

The completeness proof is sound:
- The inventory re-runs identically on 8 sampled states.
- URS §6 accounts for all 486 content elements exactly once.
- The 9 exclusions are the M16 tournament banner; shell 001–003 are logo/brand under "global shell".
- Traceability closes (79 FN → 64 FR → 44 E2E, 91 AC, 0 dangling).
- Copy, enumerations, counts, colours, confirms and the Bahagian behaviour of the create/edit forms match live.

The failures are in two deviations and in the seed:
- **DV-M07-11** replaces two working live features (domain practice, full exam) with a page that says "Halaman ini belum tersedia." That is not a D9 fix, and the M05/M06 precedent is a provisional page pending the live session, not a "not available" notice.
- **DV-M07-07** (sticky "Tindakan" below 1024px) "fixes" in-card table scrolling that live already does and that NFR-RESP-05 (b) and the approved M02/M03/M04 decisions accept below 1024px.
- **The question seed invents ids and records that are observable on live.** Live ids are exactly **177698–178460** (contiguous). The page-39 anchors are given the wrong domain and level (live: Isu Global T4 / Bahasa Inggeris T1 / Isu Global T4, not "Matematik T1"). The 9 other "inovasi" hits are real live records, not generated rows.
- **The access seed adds two invented rows** (an expired T1 and a revoked T4, with UNVERIFIED labels) to the default list, so the default S8 shows 5 rows where live shows 3.

Every fix is a document edit. After that, a targeted re-audit of AUD-M07-01…04 is enough.

## Summary counts

| Measure | Result |
|---|---|
| Content elements in URS §6 (script) | **486 / 486** inventory IDs (S1–S8): 0 missing, 0 extra, 0 duplicates. 477 are mapped to a Function and 9 are excluded. |
| The 9 exclusions | EL-M07-S1/S2/S3-001–003 "LIVE:" / "MAIN" / "DAFTAR". This is the hidden `tournamentBanner()` widget, so **M16 is correct**. |
| Shell 001–003 | SHU-001–003 = `→ /dashboard`, logo image, "Platform Latih Tubi Nasional". SHA-001–003 = `→ /admin`, logo image, "Panel Pentadbir". Both are excluded as "global shell (logo/brand, …)", which is correct (the M06 AUD-12 error is not repeated). |
| Matrix ↔ §3 FN | Every matrix FN exists in §3 (79 FN defined, 56 cited in the matrix, 23 behaviour-only). 0 unknown. |
| Mapping semantics, spot-checked by hand | 30 rows (every 16th matrix row), **30 correct** (list below) |
| Live re-inventory (`inventory.js` + `run-state.js` + `sanitize.js` with the `tools/jobs/M07.js` job definitions) | 8 states: S1 default@1280, S2 t4@1280, S5 default@1280, S5 select-all@1280, S6 bahagian-c@1280, S7 bahagian-a@1280, S8 form-open@1280, S8 default@375. **Totals are identical** to the saved raw captures (411, 457, 272, 292, 242, 242, 236, 236), and the content keys are identical. The only differences are the admin server-status widget values (load, %, uptime), which is expected. PII leak check: 0 in all 8. No state has horizontal overflow. The action logs reproduce D-5 (`valid=false invalid=options[0..3][text]`) and "20 dipilih". |
| Traceability (script) | 79 FN, each cited by ≥1 FR. 91 AC, each with ≥1 FR and ≥1 E2E. 64 FR, each with ≥1 E2E. 44 E2E on 375/768/1280. 0 dangling references. **15** E2E are marked "provisional" (TRACKER says 20), and 2 more assert INFERRED ACs without the mark (AUD-M07-09). |
| Claims verified against live | **62**: 55 correct, 7 incorrect (list below) |
| Deviations DV-M07-01…12 | 01, 02, 03, 04, 05, 08, 12: valid. 09: valid (instability reproduced). **07: not a defect under the project's own table rule** (AUD-02). **11: not a D9 fix; changes working behaviour** (AUD-01). 06, 10 (replicated): correct. |
| Findings | **Critical 0 · Major 4 · Minor 6** |

## Findings

| ID | Severity | Doc + section | What's wrong | Live evidence | Required fix |
|---|---|---|---|---|---|
| AUD-M07-01 | **Major** | URS §7 DV-M07-11, FN-M07-1.5.1/1.5.2, AC-M07-07.1/07.2, §5 S4a/S4b, §8 row "Domain practice …", OQ-M07-08; SRS §1, §2 (S4a/S4b), FR-M07-16/17, §7 #5, §8.1/8.2 PROPOSED COPY, §10, E2E-M07-08 | **DV-11 replaces two working features with a "not available" page.** `/pksk/level/{L}/domain/{CODE}` and `/pksk/level/{L}/exam` are linked from 28 working controls on S2/S3 ("Latih Sekarang", domain cards, "Peperiksaan Penuh"). Nothing shows they are broken: they were simply not opened. The DV row admits it is "not a D9 fix" and a "Delivery Lead decision". But D7/D9 only allow deviations for broken behaviour, and D9 delegates only those to the Delivery Lead. The page tells a paying student "Halaman ini belum tersedia.", which contradicts live, where the core premium function works. It also asserts absence of UX as specified behaviour: E2E-08 requires "neither page contains a radio, textarea or timer". FR-16 invents a header ("{name}" / "{code}") that was not observed. The precedents differ. M05 specified its quiz pages SOURCE-DERIVED/INFERRED from captured templates. After AUD-M06-07, M06 kept a **neutral provisional page** (items + answer input + one submit, UNVERIFIED, E2E provisional), not a "belum tersedia" notice. | S2 T1/T4: 13 "Latih Sekarang" → `/pksk/level/{L}/domain/PKSK_*`, "Peperiksaan Penuh" → `/pksk/level/{L}/exam`. S3: 15 domain-card links. Hub copy "Latih tubi soalan dan peperiksaan penuh …", format 30/70/1. M06 URS FN-M06-6.2.3/6.2.4 (post-audit). | Withdraw DV-11 as a deviation. Specify L-2 and L-3 as **UNVERIFIED / INFERRED, pending the live session**, like M05/M06: a provisional functional page. For practice: approved questions of the domain and level, one at a time, reusing the already-specified M05 quiz component (INFERRED). For the exam: the SOURCE-DERIVED composition 30 A + 70 B + 1 C and weights 20/70/10, with answer inputs and one submit (PROPOSED COPY), and **no timer, auto-submit or result layout asserted**. Remove "Halaman ini belum tersedia." and the E2E-08 absence assertions, and mark E2E-08 provisional. List every open point under OQ-M07-02. Report the L-2/L-3 live session to the user as the top priority before G5. If the Delivery Lead still wants a placeholder, it is a non-D9 deviation that the **user** must approve (D7). |
| AUD-M07-02 | **Major** | URS §7 DV-M07-07, AC-M07-24.2, FN-M07-2.1.7/3.1.6 (DV refs), §5 S5 row; SRS FR-M07-63, §10 S5/S8, E2E-M07-44 | **DV-07 "fixes" working behaviour and contradicts approved precedent.** On live, the S5 table (855px) and the S8 table (609px at 375) sit in `card overflow-x-auto`: they scroll inside their card, and the page never scrolls (docW 360/753 ≤ viewport). That is exactly NFR-RESP-05 option (b), which the DV itself calls "as live". The approved decisions for the same situation keep in-card scrolling below 1024px **without** a sticky column: DV-M02-01 ("Below 1024 the table scrolls inside its card (NFR-RESP-05 b)"; sticky only at 1024–1279, where the desktop layout is expected to fit), DV-M03-03 and DV-M04-09. The actions are reachable by scrolling the card, so nothing is "unusable on touch". At ≥1024px the S5 table already fits (live). Adding a sticky column below 1024 is a new layout feature, and it makes M07 inconsistent with M02–M04. | 375: `table.scrollWidth 855`, card `clientWidth 342`, class `card overflow-x-auto`, `documentElement.scrollWidth 360`. 768: 855 / 715, docW 753. S8 375: 609 / 342. Screenshots `img/M07/questions-375-incard-scroll.png`, `img/M07/access-375-masked.png`. | Change DV-07 to "Rejected — replicate live (NFR-RESP-05 b, M02 DV-01 / M03 DV-03 / M04 DV-09 precedent)". Remove FR-M07-63, the sticky wording in §10 and AC-24.2, and the sticky assertions in E2E-44. Replace AC-24.2 with "the table scrolls inside its card and the page does not". |
| AUD-M07-03 | **Major** | SRS §6.8 Questions (anchors table, "Generated rows", "Exactly 13 texts …"), E2E-M07-14, E2E-M07-17 | **The question seed invents data that is observable on live.** (a) **Ids.** The 763 live ids are exactly **177698–178460, contiguous**, but the seed "generates" 177435–177918 and 178176–178431. 286 live ids fall outside that range (e.g. 178148, 178149, 178159, 178161), and the seed invents 263 that do not exist. (b) **Page-39 anchors.** They are marked "Matematik (B)\* / T1\* / fictitious". Live: **178174** Isu Global T4 "Apakah peranan Malaysia dalam PBB?"; **177919** Bahasa Inggeris T1 'What is the antonym of "generous"?' (this text is already quoted in discovery Appendix A.3); **178175** Isu Global T4 "Bagaimanakah perubahan iklim mempengaruhi negara-negara pulau kecil?". (c) **"inovasi".** The count 13 is correct (also for "INOVASI" and " inovasi "), but the 9 non-anchor hits are live records, not "generated Inovasi & Pencipta rows": 178148 "Apakah maksud inovasi?" (T1), 178149 "Apakah perbezaan antara ciptaan (invention) dan inovasi?" (T1), 178159 "Bagaimanakah Malaysia boleh menjadi hab inovasi di Asia Tenggara?" (T4), 178161 "Analisakan peranan universiti dalam ekosistem inovasi Malaysia." (T4), 178323 "Apakah contoh inovasi sosial?" (T1), 178324 "Apakah maksud inovasi dalam konteks T1?" (T1), 178328 "Apakah contoh inovasi sosial dalam konteks T1?" (T1), 178329 "Apakah maksud inovasi dalam konteks T4?" (T4), 178333 "Apakah contoh inovasi sosial dalam konteks T4?" (T4), all Inovasi & Pencipta. (d) **Templates.** The generated texts use "Bagi calon {L}, …", but only **102 of 763** live texts start that way. (e) **Asterisks.** 178359's full text is observable ("… tindakan terbaik ialah ...", difficulty 2, explanation "Menghormati kepelbagaian budaya ialah asas keharmonian."), and 178349 is T1 on live, so their asterisks are unnecessary. The totals (763; T1 383 / T4 380; A 160 / B 573 / C 30; per domain × level) **are** correct. | Read of all 39 pages (id, Bahagian, domain, level, status, text): 763 rows, 763 unique, min 177698, max 178460, one contiguous range. `?search=inovasi` ids and texts. `/admin/pksk/questions/{177919,178174,178175,178359,178349}/edit` textarea values. | Re-seed from observation: ids 177698–178460. Use the live domain/level of every id (the full id → domain/level map is readable from the 39 list pages), with live texts where captured (at least the anchors, page 1 and page 39, and the 13 "inovasi" rows). Keep "fictitious" only for texts not captured, and do not use a "Bagi calon" template as if it were representative. Correct the page-39 anchors, and E2E-14/17 where they assert texts. Keep the live `createdAt` interleave only as INFERRED (the list reads 177920, 178176, 177921, 178177 …, i.e. pairs sharing a timestamp, ties by id ascending, which is consistent with BR-M07-06). |
| AUD-M07-04 | **Major** | SRS §6.8 Access rows (ids 4, 5), "List order 3, 5, 2, 1, 4"; URS AC-M07-17.2, 17.3, 19.3, 20.5 (seed wording), §4 seed note; SRS E2E-M07-34/35 | **The default access seed contains records and states that live does not show.** Live has 3 rows, all "Aktif" Kombo with "Diberi Oleh" "-" (read 4× on 2026-09-25). The seed adds row 4 (expired T1, "Admin Demo", 30/06/2026) and row 5 (revoked T4, "Admin Demo"). Their labels "Tamat Tempoh" / "Ditarik" are UNVERIFIED placeholders, and whether expired or revoked rows are **listed at all** is unknown (OQ-7, L-7). So the default S8 in the rebuild shows 5 rows, 2 with invented labels and a non-"-" granter. AC-17.2 and E2E-34 (not provisional) assert them as the default list. This is the "invented seed records" error of the M05/M06 audits. Keeping the totals 3/3/3 does not make the rows observed. | `/admin/pksk/access` × 4 loads: access ids {1,2,3}, "PKSK Kombo (T1 + T4)", "-", 28/02/2026, 22/04/2026, 28/02/2026, "Tiada had", "Aktif". | The default seed holds only the 3 live-shaped active Kombo rows (fictitious users, live ids 1–3, live dates). Create the expired and revoked rows inside the provisional scenarios (fixture helper, e.g. `seedPkskAccessEdgeCases()`), not in the default dataset. Rewrite AC-17.2 and E2E-34 to the 3-row default. Move the expired/revoked assertions to provisional ACs/E2E (AC-19.3, E2E-39). `pelajar2@demo.test` then gets its "no access" state from having no row (the no-grant case). |
| AUD-M07-05 | Minor | SRS §10 S5 `md` column ("filters one row"); discovery §7 S5 768 (report to the discovery owner) | At 768px the filter row wraps: the three selects and the search share one line (top 504), and **"Cari" wraps to a second line** (top 535). "Tambah Soalan" is below (587). | S5 @768: control tops [504, 504, 504, 503, 535]. | State "selects + search on one row, 'Cari' wraps below; 'Tambah Soalan' below" for 768, and update E2E-44 if it asserts the filter row. |
| AUD-M07-06 | Minor | SRS BR-M07-06, FR-M07-25/26; URS FN-M07-2.1.13 | Filter semantics are partly mislabelled and partly incomplete. (a) "Unknown filter values match nothing" is **OBSERVED** (`?status=zzz`, `?bahagian=Z`, `?level=T9` → empty row), not INFERRED. (b) Filter values are **case-insensitive**: `?level=t1` returns 383 (the `level` route segment is case-sensitive, 404, which BR-19 has right). (c) The search is trimmed: `?search=%20inovasi%20` gives 13. Case-insensitive search is OBSERVED (`INOVASI` → 13). | GETs listed in (a)–(c). | Relabel (a) and the search case rule OBSERVED. Add "filter values match case-insensitively (`t1` = `T1`)" and "search is trimmed". |
| AUD-M07-07 | Minor | URS FN-M07-4.3.1, §2 Guest row, AC-M07-22.1; SRS §9 Guest row ("others INFERRED") | The guest redirects are observable and were verified: `/pksk/level/T1/domains`, `/pksk/level/T4/history`, `/admin/pksk/questions/create` and `/admin/pksk/access` → **302 `/login`** in a cookie-less context. Only the exam/domain routes stay unverified (not requested, by the safety rule). | Guest context `request.get(…, {maxRedirects:0})`. | Relabel these routes OBSERVED. Keep exam/domain INFERRED. |
| AUD-M07-08 | Minor | URS §5.1 L-1 ("SOURCE-DERIVED: the 'AKTIF' badge and green border are conditional"), FN-M07-1.1.5; SRS §8.3 | This is a mislabel. S1 is server-rendered. The active card carries static classes (`border-4 border-green-400 shadow-xl shadow-green-500/30`, badge `absolute top-4 right-4 bg-green-500 …`), and there is no `:class`, `x-show` or template for a locked variant in the page source. Nothing about the locked state is derivable from the captured markup. | `/pksk` markup: `main [\:class]` = none; the only template is the tournament banner. | Label the locked-card behaviour **INFERRED (L-1)** only. Keep "locked copy/styling UNVERIFIED". |
| AUD-M07-09 | Minor | SRS §12 (provisional marks), E2E-M07-05, 09, 42; URS AC-M07-07.3; TRACKER M07 line ("20 provisional") | The provisional marking is inconsistent. 15 scenarios are marked (02, 04, 08, 10, 11, 21, 22, 23, 29, 33, 34, 37, 38, 39, 43), not the 20 the TRACKER reports. E2E-05 asserts AC-04.4 (INFERRED mastery values) and E2E-42 asserts AC-22.2 (INFERRED role redirect / 403), but neither is marked. E2E-09 and AC-07.3 assert `/pksk/level/T1/domain/PKSK_XYZ` → 404, which is INFERRED (FN-1.5.4), but AC-07.3 is not labelled INFERRED. | Script over SRS §12 and URS ACs. | Mark the INFERRED steps of E2E-05, 09 and 42 provisional (or split them). Label AC-07.3 INFERRED. Report the real provisional count to the Delivery Lead for the TRACKER. |
| AUD-M07-10 | Minor | URS FN-M07-1.1.6, FN-M07-1.3.4; SRS FR-M07-04, FR-M07-13 | Observed styling is missing. (a) The hub "Mula Latihan" buttons are gradient buttons: T1 `from-indigo-600 to-purple-600`, T4 `from-purple-600 to-pink-600`, white bold text, `rounded-xl`, `hover:scale-105` + coloured hover shadow. (b) The S3 domain cards also scale on hover (`hover:scale-105`, `hover:shadow-xl`, `border-2 border-transparent`) and use `hover:border-{blue\|purple\|pink}-300` per section; only "hover border in the section colour" is specified. | `/pksk` and `/pksk/level/T4/domains` class lists. | Add (a) to FN-1.1.6 / FR-04 and (b) to FN-1.3.4 / FR-13 (with the 300 shade). |

### Deviation verification (URS §7)

| DV | Live defect reproduced? | Within D9/D10? | Note |
|---|---|---|---|
| DV-M07-01 history | Yes: `/pksk/level/T1/history` → HTTP 500 (re-checked). | Yes (dead link). Same pattern as the approved M04 DV-01 (smallest read-only page, PROPOSED COPY). | Acceptable. The copy still needs owner acceptance at G1 (OQ-08). |
| DV-M07-02 | Yes: subtitle "Kemaskini soalan #<?php echo e($question->id); ?>" on 178460, 178359 and 178349. | Yes (wrong text) | Minimal. |
| DV-M07-03 | Yes: S2 icons `fa-calculator`, `fa-flask`, … without `fas`; `::before` content "" (blank). The admin list renders `fas fa-brain` in #8b5cf6 and `fas fa-pen-fancy` in #a855f7. | Yes (visual bug) | Minimal (same icon as S5). |
| DV-M07-04 | Yes: h1 class `… text-white …`, computed `rgb(30, 41, 59)`. | Yes (unreadable) | Minimal. |
| DV-M07-05 | Yes: with Bahagian C + "Artikulasi Penulisan" + text, `checkValidity()` false on hidden `options[*][text]`. | Yes (a whole Bahagian cannot be created) | `disabled` while C is minimal: A/B keep `required`, typed values are kept, and nothing on the screen changes. It creates no new contradiction (the edit page renders no options card for C, as live). |
| DV-M07-06 (rejected) | Generic tab title on S1–S3 confirmed. | Replicating is correct | — |
| DV-M07-07 | Tables scroll inside their cards; the page does not. | **No** (NFR-RESP-05 b; precedent M02/M03/M04) | AUD-02 |
| DV-M07-08 | Yes: after B + Sains → A, the select shows "-- Pilih domain --" (value '') while Alpine `domainId` = "3". Text, difficulty 4, T4, option text and the (hidden) Betul tick are kept. | Yes (contradictory state), harmless | Minimal. There is no visible change (the native `required` behaves the same). |
| DV-M07-09 | Yes: 4 consecutive loads gave orders 1-3-2, 2-1-3, 1-3-2, 3-2-1. | Yes (contradictory/undefined order). Any stable order is a choice. "Newest grant first" matches the S5 "newest created first" convention and is recorded as a Delivery Lead choice (OQ-08). | Acceptable. Note that the seed's invented times 09:12 / 09:15 only break the 28/02 tie (not displayed). |
| DV-M07-10 (rejected) | A purple / B blue in the S5 pills (`bg-purple-100 text-purple-700` / `bg-blue-100 text-blue-700`) vs A blue / B purple on S1/S3. | Replicating is correct (styling, not a rule) | — |
| DV-M07-11 | **No defect.** The routes were not opened, and nothing shows they are broken. | **No** (not D9; working feature replaced) | AUD-01 |
| DV-M07-12 | Yes: 404 page "Mula Latihan" → `/latih-tubi` (`/pksk/level/ALL`). | = M01 DV-02 | — |

### L-states (discovery §9) — labels checked

| L | Label in URS §5.1 / SRS §8.3 | Audit |
|---|---|---|
| L-1 | "SOURCE-DERIVED" conditional badge + INFERRED gate | **Mislabel**: nothing is derivable (AUD-08). The gate and redirect are INFERRED and provisional, which is acceptable. |
| L-2, L-3 | Interim placeholder (DV-11) | **Not acceptable as specified** (AUD-01). The composition 30/70/1 and weights 20/70/10 are correctly SOURCE-DERIVED from the hub copy. |
| L-4 | DV-01 | OK |
| L-5 | INFERRED, UNVERIFIED COPY flashes | OK. The default status `approved` is INFERRED (same as M04 OQ-2). |
| L-6 | Pill colours UNVERIFIED (placeholders) | OK. The labels "Menunggu"/"Ditolak" are OBSERVED from the selects. |
| L-7 | INFERRED | OK in the rules, but the **default seed** should not carry these states (AUD-04). |
| L-8 | INFERRED | OK |

### Seed check

- **Accounts.** The ids 1–10 map to the M01 seed accounts with the same names and roles (M01 SRS §6.8). `pelajarmaju@demo.test` "Pelajar Maju Demo" is the M03 seed. No new account is added, and all `hasPkskSubscription = false`. The integer-id change request (OQ-M07-09b) is correctly raised as a cross-module item.
- **Domains.** The 15 records (id, Bahagian, name, name_en, code, icon, colour) match discovery A.1 and the live S2/S3/S5/S7 renderings (codes, order, S5 icon colours #8b5cf6, #ec4899 and #a855f7 checked).
- **Packages.** The ids 1–3, names and levels match the live select.
- **Question totals.** These are correct: 763; T1 383, T4 380; A 160, B 573, C 30; every domain × level count (live read of all 763 rows). The filtered totals A 160, C 30, T1&B 288 and "inovasi" 13 match live. **Ids, page-39 anchors and the "inovasi" rows are wrong (AUD-03).**
- **Page-1 anchors.** 178460 (Kebudayaan Kaum, T4, difficulty 3, options and explanation) and 178432–178450 (domains, levels and prefixes) match live.
- **Access.** Ids 1–3, dates 28/02/2026, 28/02/2026 and 22/04/2026, "Tiada had", "-" and the stats 3/3/3 match live. **Rows 4–5 are invented (AUD-04).**
- **Exam attempts / mastery** for `pelajar@demo.test`. These are fictitious data for unobserved states, which is acceptable only as provisional (AUD-09 for E2E-05).

## Coverage spot-check (30 rows, all correct)

S1-005 "SBP / MRSM / SMKA"→1.1.2 · S1-021 badge "C"→1.1.3 · S1-037 "Tingkatan 4"→1.1.4 · S2-014 "Latih Tubi Domains"→1.2.4 · S2-030 "Latih Sekarang" PKSK_SCI→1.2.6 · S2-046 "Kebudayaan Kaum"→1.2.5 · S2-062 "PKSK_ALAM"→1.2.5 · S2-078 "Penguasaan"→1.2.5 · S2-094 T4 exam link→1.2.4 · S3-002 "MAIN"→Excluded M16 · S3-018 "Bahasa Inggeris"→1.3.4 · S3-034 "Ekonomi Malaysia"→1.3.4 · S3-050 404 "PRESTASIPLUS"→1.3.6 · S3-066 T4 PKSK_ESSAY card→1.3.4 · S5-009 "Menunggu" stat→2.1.2 · S5-025 bulk form→2.1.6 · S5-041 fa-trash→2.1.9 · S5-057 fa-trash→2.1.9 · S5-073 pager "10"→2.1.10 · S5-089 "Next »"→2.1.11 · S5-105 `ids[]`→2.1.6 · S6-012 "Soalan"→2.2.3 · S6-028 `options[0][is_correct]`→2.2.5 · S6-044 fa-times→2.2.5 · S7-003 `_method`→2.3.2 · S7-019 "Pilihan Jawapan"→2.3.4 · S7-035 letter "C"→2.3.5 · S7-051 404 text→2.3.8 · S8-008 "3"→3.1.2 · S8-024 "Cari"→3.1.5 (plus S8-040 `access_id`→3.1.7).

## Claims verified against live (62)

✓ = correct, ✗ = incorrect (with finding).

1. ✓ S1 tab "PRESTASIPLUS - Platform Latih Tubi Nasional"; header "PKSK" / "Persediaan Kemasukan SBP / MRSM / SMKA".
2. ✓ S1 h1 "Persediaan Kemasukan", class `text-white`, computed rgb(30, 41, 59) (DV-04).
3. ✓ S1 hero sub "SBP / MRSM / SMKA" and lead text (exact).
4. ✓ Format tiles: A "Kecerdasan Insaniah" 30 soalan "Pemberat: 20%" "Nilai, akhlak & sahsiah"; B 70 / 70% "Kognitif & penaakulan"; C "1 esei" / 10% "Penulisan kreatif".
5. ✓ Circle colours blue-500 / purple-500 / pink-500.
6. ✓ Level cards: `border-4 border-green-400 shadow-xl shadow-green-500/30`; badge `bg-green-500 text-white`, `fa-unlock` "AKTIF" (no CSS uppercase; the text is upper case in the source).
7. ✓ "Mula Latihan" → `/pksk/level/T1` and `/pksk/level/T4`; no price/RM/upsell on S1.
8. ✗ "Mula Latihan" styling (gradients, hover scale) not specified (AUD-10).
9. ✓ S2 T4 header "Dashboard PKSK - T4" / "Pantau kemajuan latihan anda"; "Kembali ke PKSK" → `/pksk`.
10. ✓ S2 zero state "0%", "E", "Teruskan usaha anda!", "0", "0.0%".
11. ✓ S2 shortcuts → `/domains`, `/exam`, `/history` with the level in the href.
12. ✓ S2 lists exactly the 13 B domains in order, with codes; no Insaniah or Essay.
13. ✓ S2 icons lack `fas` and render blank (`::before` "") (DV-03).
14. ✓ "Latih Sekarang" `style="background: #3b82f622; color: #3b82f6;"` (tint + colour).
15. ✓ S2 grids `md:grid-cols-3` (shortcuts) and `md:grid-cols-2 lg:grid-cols-3` (domains).
16. ✓ S3 T4 header "Domain PKSK - T4" / "Pilih domain untuk latih tubi"; back "Kembali ke Dashboard" → `/pksk/level/T4`.
17. ✓ S3 section badges A blue-500, B purple-500, C pink-500; h2 texts.
18. ✓ S3 T4 counts 80; 27 ×3; Sejarah 24; 20 ×9; 15 (sum 380). T1 sum 383 (list read).
19. ✗ S3 card hover also scales (`hover:scale-105`), and the hover border is the 300 shade (AUD-10).
20. ✓ `/pksk/level/ALL` → 404 "404 - Halaman Tidak Dijumpai | PRESTASIPLUS", "Halaman Utama" → `/`, "Mula Latihan" → `/latih-tubi`.
21. ✓ `/pksk/level/t1` → 404 (level route case-sensitive, BR-19).
22. ✓ `/pksk/level/T1/history` → 500.
23. ✓ S5 stats 763 / 763 / 0 / 383 / 380 with indigo/green/amber/blue/purple-600.
24. ✓ S5 filter options (exact labels and values), `onchange="this.form.submit()"`, no `required`.
25. ✓ Search placeholder "Cari soalan..." `w-48`.
26. ✓ Page-1 order 178460, 178432…178450.
27. ✓ Page-39 ids 178174, 177919, 178175.
28. ✗ Seed page-39 anchors "Matematik T1": live Isu Global T4 / Bahasa Inggeris T1 / Isu Global T4 (AUD-03).
29. ✗ Seed id ranges: live ids 177698–178460 contiguous (AUD-03).
30. ✓ Pager "Showing 1 to 20 of 763 results", 1–10 … 38 39; below 640 "« Previous" / "Next »".
31. ✓ `?bahagian=A` → 160, pager links `?bahagian=A&page=2`, select preselected A.
32. ✓ `?bahagian=C` → 30; `?level=T1&bahagian=B` → 288.
33. ✓ `search=inovasi` → 13; every row contains "inovasi"; `INOVASI` → 13.
34. ✗ The 9 non-anchor "inovasi" rows are live records, not generated (AUD-03).
35. ✓ Empty row: `colspan=7`, `fa-inbox` "Tiada soalan PKSK lagi", "Tambah soalan pertama" → create, no pager.
36. ✓ Unknown filter values (`status=zzz`, `bahagian=Z`, `level=T9`) → empty row.
37. ✗ `level=t1` → 383 (case-insensitive, not documented) (AUD-06).
38. ✓ Pills: A purple-100/700, B blue-100/700, C pink-100/700 `rounded-full`; level chip `rounded` T1 blue, T4 purple; "Diluluskan" green-100/700.
39. ✓ Domain cell `fas fa-brain` color #8b5cf6 + name `text-xs`.
40. ✓ Select-all → "20 dipilih"; untick one row → "19 dipilih", header stays ticked; untick header → bar `display:none`.
41. ✓ S5 at 375: table 855 in a 342 `card overflow-x-auto`, page 360 ≤ 375; filters Bahagian+Level / Status+search / Cari; "Tambah Soalan" below.
42. ✗ S5 at 768: "Cari" wraps below the other filters (AUD-05).
43. ✓ S6 fields and `required`: bahagian, domain, target level, question_text, difficulty (required); explanation not; `options[i][text]` required; no `novalidate`.
44. ✓ S6 x-shows: options card `bahagian !== 'C'`, suffix `bahagian === 'A'`, Betul `bahagian === 'B'`, remove `options.length > 2`, add `options.length < 6`.
45. ✓ S6 B → 13 domains (+ placeholder = 14 options).
46. ✓ Bahagian change B→A: domain '' shown, Alpine `domainId` "3"; text, difficulty 4, T4, option text and hidden Betul tick kept.
47. ✓ C + Artikulasi + text → `checkValidity()` false on hidden option texts.
48. ✓ S6 difficulty in `grid grid-cols-1 md:grid-cols-2` (half width from md); footer `flex items-center justify-between`.
49. ✓ S7 PUT form, `editForm()` options JSON; 178460 "[B] Kebudayaan Kaum", Tingkatan 4, Diluluskan, difficulty 3, option A correct.
50. ✓ S7 status `required`, difficulty "1"–"5" not required, question_text required with no placeholder; labels Domain/Sasaran/Status/Kesukaran/Penjelasan.
51. ✓ S7 C record 178349: `options: []`, no "Tambah Pilihan"; A record 178359 options with the 4th flagged true.
52. ✓ `/admin/pksk/questions/99999999/edit` → 404.
53. ✓ S8 stats 3/3/3, `grid grid-cols-3` at every width.
54. ✓ S8 grant form: `user_id` number, "User ID", required, no min; package select 1*/2/3 with "(T1)/(T4)/(ALL)", required, no empty option; `expires_at` date, optional; "Beri Akses"; `md:grid-cols-4`, 1 column at 375.
55. ✓ Toggle hidden on load → open → closed → reopened with "123" kept; no "Batal".
56. ✓ Revoke form `onsubmit="return confirm('Tarik balik akses?')"`, hidden `access_id`, `fa-ban` "Tarik" red-500.
57. ✓ S8 rows: Kombo, "-", 28/02/2026 / 22/04/2026 / 28/02/2026, "Tiada had", "Aktif"; order unstable across 4 loads (DV-09).
58. ✓ S8 `?search=zzzzqqq` and `?page=2` → `colspan=7` `fa-lock` "Tiada rekod akses".
59. ✓ Admin sidebar "PREMIUM" (`toggle('premium')`), open on `/admin/pksk/questions` with "PKSK Soalan" active; closed on `/admin/questions`.
60. ✓ M04 list search "Bagi calon T4, apakah tindakan terbaik" → "Tiada soalan dijumpai"; `/admin/questions/178460` → 200 with the PKSK text.
61. ✓ Guest: `/pksk/level/T1/domains`, `/pksk/level/T4/history`, `/admin/pksk/questions/create`, `/admin/pksk/access` → 302 `/login` (AUD-07: relabel OBSERVED).
62. ✗ The locked-card state is labelled "SOURCE-DERIVED", but there is no conditional markup (AUD-08).

## Screenshots (`docs/qa/audit/img/M07/`, masked)

| File | Content |
|---|---|
| `access-375-masked.png` | S8 at 375: stats 3 columns, table scrolling inside its card (Pengguna/Diberi Oleh masked) |
| `access-form-open-375-masked.png` | S8 grant form open at 375 (1 column), typed id kept |
| `access-form-open-1280-masked.png` | S8 grant form open at 1280 (4 columns, "Pakej" label clipped as live) |
| `questions-375-incard-scroll.png` | S5 at 375: table scrolling inside its card (AUD-02 evidence) |
| `questions-search-inovasi-13.png` | S5 `?search=inovasi`: 13 rows (AUD-03 evidence) |

---

## Round 2 (targeted re-audit of v1.1)

| Field | Value |
|---|---|
| Date | 2026-09-25 |
| Auditor | Same independent agent, browser lane 2 (`playwright2`), read-only |
| Documents | `urs/M07-pksk.md` v1.1 and `srs/M07-pksk.md` v1.1 (change-log rows 1.1); `discovery/M07-pksk.md` (4 passages marked "corrected after audit") |
| Safety | Same as round 1. No exam or domain-practice URL was opened, no action was triggered, and only same-origin GET searches were run (≥450 ms apart). The access list was not re-rendered in round 2. |

### Verdict: **PASS**

There are **0 Critical, 0 Major and 1 Minor** findings (new, AUD-M07-11). All 10 round-1 findings are closed.

### Round-1 findings

| ID | Status | Evidence (v1.1) |
|---|---|---|
| AUD-M07-01 | **Closed** | DV-M07-11 is "Withdrawn — not a deviation". FN-1.5.1/1.5.2, FR-16/17, AC-07.1/07.2, §5.1 L-2/L-3 and SRS §8.1 now specify neutral provisional pages, labelled UNVERIFIED/INFERRED and pending L-2/L-3. The headings use live copy (domain name; "Peperiksaan Penuh" = the S2 card copy). The 30/70/1 composition and 20/70/10 weights are SOURCE-DERIVED. "No timer, auto-submit, section navigation or result layout is asserted." The only new copy is "Hantar", marked **PROPOSED COPY** (URS §0, FN-1.5.1/1.5.2, SRS §8.2, OQ-08). "Halaman ini belum tersedia." no longer appears anywhere (grep: 0). E2E-08 is provisional and has no absence assertions. BR-M07-25 ("10 per session, random") is explicitly a prototype choice, not observed, and no E2E asserts it: acceptable under the M06 precedent. |
| AUD-M07-02 | **Closed** | DV-M07-07 is "Rejected — replicate live" and cites the M02/M03/M04 precedent and the audit screenshot. FR-63 now requires in-card scroll with **no sticky column**. AC-24.2, SRS §10 S5/S8 and E2E-44 (card `scrollWidth > clientWidth`, no `position: sticky`) match live: card `overflow-x-auto`, 855/342 and 855/715, page 360/753. No sticky requirement remains. |
| AUD-M07-03 | **Closed** | SRS §6.8: ids 177698–178460 contiguous. Anchors 178174, 177919, 178175, 178359, 178349 and the 9 extra "inovasi" records carry live domain, level and text. The rest are marked **seed-assigned**, and the "Bagi calon" template claim is gone. **Read-only live re-check:** searches "peranan Malaysia dalam PBB" → 178174 Isu Global T4, "antonym of" → 177919 Bahasa Inggeris T1, "negara-negara pulau kecil" → 178175 Isu Global T4, "hab inovasi" → 178159 T4, "ekosistem inovasi" → 178161 T4, "ciptaan (invention)" → 178149 T1, "inovasi sosial dalam konteks T4" → 178333 T4, and "inovasi" → the 13 ids listed in the SRS, all with matching texts, domains and levels. Stats are unchanged (763/763/0/383/380). One residual gap: see AUD-M07-11. |
| AUD-M07-04 | **Closed** | The default access seed is exactly 3 rows (ids 1–3, Kombo, "-", 2026-02-28 / 2026-02-28 / 2026-04-22, no expiry, active). List order is **3, 2, 1** (BR-17: grantedAt desc, id desc). The expired and revoked rows live only in `seedPkskAccessEdgeCases()`, which is used only by provisional E2E-39. AC-17.2 and E2E-34 assert 3 rows in the order 3, 2, 1. AC-19.3 is INFERRED and a provisional fixture. AC-17.3 and E2E-35 now search "maju" (1 row). `pelajar2@demo.test` has no grant. |
| AUD-M07-05 | **Closed** | SRS §10 S5 at 768 and discovery §7 (corrected) say "Cari" wraps to a second row. E2E-44 asserts it. |
| AUD-M07-06 | **Closed** | FN-2.1.13, FR-26, BR-06 and discovery R-11 now have case-insensitive filter values (`level=t1` → 383), a trimmed case-insensitive search, and unknown values matching nothing, all labelled OBSERVED. |
| AUD-M07-07 | **Closed** | FN-4.3.1, SRS §9 Guest row and discovery §1 list the 7 routes as OBSERVED (302 → `/login`). Exam and domain-practice routes stay INFERRED. |
| AUD-M07-08 | **Closed** | FN-1.1.5, FR-05, §5.1 L-1 and SRS §8.3 say "INFERRED only" and that the static classes have no locked variant in the source. Discovery §2.1 is corrected. |
| AUD-M07-09 | **Closed** | Script: **17** provisional E2E (02, 04, 05, 08, 09, 10, 11, 21, 22, 23, 29, 33, 37, 38, 39, 42, 43). This matches the SRS change log. E2E-34 is no longer provisional, correctly, because it now asserts only the 3 live-shaped rows. **All 18 INFERRED ACs** (including AC-07.3, now labelled INFERRED) are covered only by E2E marked provisional or that carry a provisional step (0 violations). |
| AUD-M07-10 | **Closed** | FN-1.1.6 and FR-04 now specify the "Mula Latihan" gradients T1 `from-indigo-600 to-purple-600`, T4 `from-purple-600 to-pink-600`, `rounded-xl` and `hover:scale-105`. FN-1.3.4 and FR-13 specify `border-2 border-transparent`, hover `scale-105` and `shadow-xl`, and the 300-shade border per section. All match the round-1 class reads. |

### Regression checks

- **Coverage (script):** 486/486 content ids in URS §6, 0 missing, 0 extra, 0 duplicates. The 9 exclusions are unchanged (M16 banner). 79 FN defined, and every matrix FN exists.
- **Traceability (script):** 79 FN, each cited by ≥1 FR. 91 AC, each with ≥1 FR and ≥1 E2E. 64 FR, each with ≥1 E2E. 44 E2E. 0 dangling references.
- **Stale references:** DV-07 and DV-11 appear only as rejected or withdrawn. "belum tersedia", `177435` and "Matematik (B)\*" return 0 hits; "sticky" appears only in "no sticky column".
- **New endpoints §7 #21–23 and the reshaped #5:** these are provisional, and they send no `isCorrect` to students (consistent with SEC-M07-07). They trace to FR-16/17.
- **10 edited passages spot-checked, all consistent with live and with each other:**
  1. FN-1.1.5 static classes
  2. FN-1.1.6 / FR-04 gradients
  3. FN-1.3.4 / FR-13 hover
  4. FN-1.5.2 / FR-17 exam page
  5. FN-2.1.13 / BR-06 filter semantics
  6. FN-4.3.1 / SRS §9 guest
  7. AC-17.2 / E2E-34 3 rows, 3-2-1
  8. AC-24.2 / FR-63 / E2E-44 in-card scroll
  9. DV-M07-09 (Delivery Lead choice with alternatives, audit evidence 1-3-2 / 2-1-3 / 1-3-2 / 3-2-1)
  10. SRS §6.8 anchors table and `seedPkskAccessEdgeCases()`

### New finding

| ID | Severity | Doc + section | What's wrong | Live evidence | Required fix |
|---|---|---|---|---|---|
| AUD-M07-11 | Minor | SRS §6.8 anchors 178432–178450 ("text after the prefix seed-assigned"), and the notes of 178174 / 177919 / 178175 | **Some observable anchor values are still marked seed-assigned.** All 20 page-1 texts are short and shown in full on live page 1, so the rebuild's page 1 would show invented completions. Live full texts: 178432 "Bagi calon T4, apakah maksud belanjawan peribadi?", 178433 "Bagi calon T4, mengapakah tabungan penting?", 178434 "Bagi calon T4, apakah perbezaan keperluan dan kehendak?", 178435 "Bagi calon T4, bagaimanakah usahawan membantu ekonomi?", 178436 "Bagi calon T4, apakah kesan inflasi kepada pengguna?", 178437–178440 = 178432–178435 with " dalam konteks T4" before the "?", 178443 "Bagi calon T4, mengapakah prototaip penting?", 178444 "Bagi calon T4, apakah ciri pencipta yang berjaya?", 178445 "Bagi calon T4, mengapakah hak cipta perlu dihormati?", 178446 "Bagi calon T4, apakah contoh inovasi sosial?", 178447 "Bagi calon T4, apakah maksud inovasi dalam konteks T4?", 178448–178450 = 178443–178445 with " dalam konteks T4" before the "?". The page-39 anchors' difficulty and explanation were also read: 178174 difficulty 2, "Malaysia aktif dalam PBB melalui misi pengaman, hak asasi manusia dan pembangunan lestari."; 177919 difficulty 2, "The antonym (opposite) of generous is selfish."; 178175 difficulty 3 (explanation begins "Kenaikan paras laut mengancam kewujudan negara pulau kecil melalui banjir dan hakisan pant…"). | Round-1 read of list page 1; `/admin/pksk/questions/{178174,177919,178175}/edit` textarea and select values. | Replace "seed-assigned" with these live values in §6.8 (and the difficulty of the three page-39 anchors). This does not block G1. |

### Round 2 counts

| Severity | Open | Closed |
|---|---|---|
| Critical | 0 | 0 |
| Major | 0 | 4 (AUD-01…04) |
| Minor | 1 (AUD-11, new) | 6 (AUD-05…10) |
