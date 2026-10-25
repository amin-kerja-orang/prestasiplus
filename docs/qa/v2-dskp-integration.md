# QA report: v2 DSKP integration (G5)

| Field | Value |
|---|---|
| Feature slug | `v2-dskp-integration` (audit finding FB-026) |
| Date | 2026-10-25 |
| Branch / build under test | `claude/determined-dijkstra-ju5q60`, HEAD `975a8e19` (all tasks DSKP-T00 to T09 merged, G4 approved) |
| Requirements | `docs/requirements/v2-dskp-integration.md` (US-01 to US-11, 63 acceptance criteria, NFR-01 to NFR-08) |
| Design / architecture | `docs/design/v2-dskp-integration.md`, `docs/architecture/v2-dskp-integration.md` |
| Role | qa-engineer. No application code was changed; only the new e2e specs below and this report were written. |
| Verdict | **READY** after the re-test of section 7 (all three G5 bugs fixed and verified, 63 of 63 ACs Pass, no open bug). The first run (sections 2 to 6) was Not ready because of DSKP-G5-03 (High). |

## 1. How it was tested

| Item | Detail |
|---|---|
| App | Vite dev server of the worktree, `vite --mode e2e --port 5391` with `VITE_PROTOTYPE_SCOPE=on` (not 5173). Dev mode is needed because a few tests call the real in-page server (`bijakServer()`) through a dynamic import. Mock admin "Admin Pusat" (`admin@demo.test`) and student `pelajar@demo.test` through the fixtures' mock login. No live credential, no live system. |
| Browser | Chromium (`/opt/pw-browsers`), three Playwright projects: mobile 375x812 (touch), tablet 768x1024 (touch), desktop 1280x800. One extra run at 320 px. |
| New e2e specs (committed, `e2e/m06-spm/`) | `dskp-g5.spec.ts` (manual entry, Tag DSKP block, upload and AI, T1-T3, seed gates, flagged lifecycle), `dskp-g5-bank.spec.ts` (bank and queue filters), `dskp-g5-subjects.spec.ts` (all 13 subjects), `dskp-g5-extra.spec.ts` (student side, dark mode, server gates, performance, touch targets, 320 px, expected-fail defect tests), `dskp-g5-support.ts` (helpers), `dskp-g5.config.mjs` (config). Run: `E2E_BOOT_TIMEOUT_MS=90000 BIJAK_DEV=1 npx playwright test -c e2e/m06-spm/dskp-g5.config.mjs` from the repo root. |
| Screenshots | `/tmp/claude-0/-home-user-prestasiplus/2b4fb9d7-0908-5472-a089-6ef819b4f201/scratchpad/dskp-g5/shots/` (suffix `-375`, `-768`, `-1280`; light and dark). Short names below are relative to that folder. Raw logs in the parent folder: `unit.txt`, `dskp-check.txt`, `bijak-e2e.txt`, `e2e-final.txt`. |
| Test environment note | The worktree had no `node_modules`; a symlink to the main checkout made the dev server serve `pdfjs-dist/build/pdf.worker.min.mjs?url` as a raw module, so PDF upload failed with "Invalid `workerSrc` type". This is an environment artefact, not a product defect: with a real (hard-linked) `node_modules` inside the worktree, upload works. |
| Defects kept as tests | In the first run the three defects were kept as `test.fail()` expected-fail tests. After the fixes (section 7) the annotations are removed and the same tests are ordinary regression tests. |

## 2. Suites run (real output)

| Suite | Command | Result |
|---|---|---|
| Unit | `npx vitest run --project unit` | **Test Files 514 passed (514); Tests 8618 passed, 3 expected fail, 3 skipped, 9 todo; exit 0.** Duration 1097.9 s. No failure anywhere, so there is nothing outside DSKP to report. (The "Not implemented: HTMLCanvasElement getContext" lines are jsdom noise.) |
| DSKP generator check | `npm run dskp:check` | `dskp:check ok: 15 files match`, exit 0 (13 subject files, index, version). The script also printed the flagged-node table and "nodes with no TP table (6): BM 4.0, 5.0 (T4, T5), BI 5.0 (T4, T5)". |
| Bijak e2e (existing) | `BIJAK_DEV=1 E2E_BOOT_TIMEOUT_MS=90000 npx playwright test -c playwright.bijak.config.mjs` | **18 passed (6.9 m)**: 6 tests x mobile, tablet, desktop, including the two Tag DSKP editor tests. |
| DSKP G5 e2e (new) | `E2E_BOOT_TIMEOUT_MS=90000 npx playwright test` with the config of section 1, final run after the last edit | **135 tests (45 tests x 3 projects): 133 passed, 2 skipped, 0 unexpected failures** (36.1 m). The 2 skipped are the 320 px test on tablet and desktop (it sets its own width and runs once, on mobile). 8 of the passes are the expected-fail defect tests (DSKP-G5-01 x3, DSKP-G5-02 x3, DSKP-G5-03 x2 on the 375 project; the 768 and 1280 runs of G5-03 pass normally). An earlier full run had 5 failures, all on the 375 project and all in test helpers (the status select lives in the sheet below 768, a card prints "SP" and its codes apart, "Penapis" has a count chip); they were fixed in the specs and re-run green. No product failure was hidden. |
| Catalogue counts (independent recount from the generated JSON) | node script over `src/modules/m03-curriculum/dskp/data/*.json` | 13 subjects, 171 units, 528 SK, 2,057 selectable SP (T4 1,130, T5 927) plus 5 Bahasa Inggeris "No learning standard" slots. Equals the architecture and the README table. |
| Seed outcome (from the browser, bank with status "Semua status") | filters of the live page | 79 questions = 44 Tingkatan 1-3 + 7 tagged (Tingkatan 4) + 28 flagged. Equals architecture section 6 "Result as built". Terbit 72 + 7 waiting in the queue = 79. |

## 3. Test plan and results: one row per acceptance criterion

Widths: "3" means executed at 375, 768 and 1280 (all 3 projects pass in the final run). "unit" means the evidence is a unit/integration test of the full unit run above (executed, exit 0), not a browser step. Result is Pass unless stated. Test names are the `test()` titles (ids at the start).

Evidence key: **E1** `dskp-g5.spec.ts`, **E2** `dskp-g5-bank.spec.ts`, **E3** `dskp-g5-subjects.spec.ts`, **E4** `dskp-g5-extra.spec.ts`, **S** existing `bijak-spm.spec.ts`.

### US-01 DSKP catalogue

| AC | Steps | Width | Result | Evidence |
|---|---|---|---|---|
| AC-01.1 | Open the subject list of the manual declaration, the bank and the queue filters; compare with the 13 subjects of `docs/reference/dskp/`. Select every subject and tag it for T4 and T5. | 3 | Pass | E1 "AC-03.1 AC-04.1 AC-05.1: 13 subjects"; E2 "subject list, dependent selects"; E3 13 tests "AC-01.1 ... {subject}"; unit `counts.test.ts` |
| AC-01.2 | For each subject and tingkatan compare every unit option (code and title as printed, group labels, unit noun in the hint) and the SP list with the catalogue JSON. | 3 | Pass | E3 "AC-01.1 AC-01.2 AC-01.4 ... {subject}" (13 tests); screenshots `subject-MAT-*`, `subject-PI-*`; unit `tree.test.ts` |
| AC-01.3 | MAT T4 and T5 both have unit 1.0: the T4 list never contains T5 units ("Ubahan") and switching tingkatan swaps the list; keys differ per tingkatan. | 3 | Pass | E1 "AC-04.2..04.5 ..." (T5 list starts "1.0 - Ubahan"); E2 bank unit groups "Tingkatan 4"/"Tingkatan 5"; unit `keys.test.ts` ("same printed code in T4 and T5 gives two keys") |
| AC-01.4 | Count SP per unit in the picker against the JSON (13 subjects x T4/T5); recount the whole catalogue independently. | 3 | Pass | E3 (SP count per unit); independent recount 171 / 528 / 2,057 (T4 1,130, T5 927) in section 2; unit `counts.test.ts`, `tree.test.ts` |
| AC-01.5 | Catalogue read-only for readers: arrays frozen, no setter, m28 holds no unit/SP schema. Code inspection plus unit. | n/a | Pass | unit `tree.test.ts` ("isFrozen"), `tp.test.ts` (frozen descriptors), `contract.test.ts`; `grep difficulty` and schema search in m28: none |
| AC-01.6 | English-edition subjects (MTM, FIZ, SN, BI) show English titles as printed ("4.0 - Operasi Set" is MAT; "1.0 - Safety Measures in Laboratory" is SN), no BM alias. | 3 | Pass | E3 {Sains, Fizik, Matematik Tambahan, Bahasa Inggeris} |
| AC-01.7 | Pendidikan Moral T4 shows only bidang 5.0, 6.0, 7.0; Pendidikan Seni Visual loads all printed bidang (10 groups, 17 units). | 3 | Pass | E3 "Katering picks ... Pendidikan Moral groups by Bidang"; E3 "Pendidikan Seni Visual (PSV)" |
| AC-01.8 | Flagged nodes: Sains T4 SP 4.3.1 (reconstructed) badge + legend; Matematik Tambahan 2 units per tingkatan "(perlu semakan)"; Landskap T4 1.0, 3.0, 4.0 flagged; Bahasa Inggeris T4 draft edition flagged; BI "No learning standard" slots hidden. | 3 | Pass | E3 "a flagged unit and a reconstructed SP"; E3 "Matematik Tambahan, Landskap, Bahasa Melayu and Bahasa Inggeris edge cases"; screenshot `sn-flagged-sp-*` |
| AC-01.9 | Image-formula SPs stay as printed text; nothing in the UI depends on wording (checked by inspection of SP rows of MAT/MTM/FIZ). | 3 | Pass | E3 (SP rows render as printed); README known limit |

### US-02 TP descriptors

| AC | Steps | Width | Result | Evidence |
|---|---|---|---|---|
| AC-02.1 | For each of the 13 subjects pick unit, SP, TP 3: the descriptor equals the catalogue row at the printed level (Tajuk/Topic/Learning Area/Modul table, SK table, per Katering SK table, per Sejarah SK, per BM skill) and names its source ("Mengikut Tajuk 4.0", "Mengikut SK 1.26"). | 3 | Pass | E3 13 tests; E3 "Katering picks its TP table by SK, Sejarah shows one descriptor per SK"; E1 "AC-04.2 ..." (MAT 4.0 TP 3 and TP 5) |
| AC-02.2 | Descriptor is shown next to TP, follows the TP, and never changes the chosen TP. Helper lines before TP/SP are chosen. | 3 | Pass | E1 "AC-04.2 ... AC-02.2"; E3 (TP stays 3 after reading the descriptor); screenshot `tag-block-filled-*` |
| AC-02.3 | BM 4.0 prints no TP: general table is the fallback ("Mengikut jadual TP am subjek ini", Q-D2 default), TP stays required; BI 5.0 shows "Tiada penerangan TP dalam DSKP untuk unit ini." | 3 | Pass | E3 "edge cases" |
| AC-02.4 | General table is the fallback when a unit has none (BM 4.0). | 3 | Pass | E3 "edge cases"; unit `tp.test.ts` |
| AC-02.5 | TP select has exactly TP 1 to TP 6 for every subject. | 3 | Pass | E3 (7 options incl. placeholder, 13 subjects) |

### US-03 Special subjects

| AC | Steps | Width | Result | Evidence |
|---|---|---|---|---|
| AC-03.1 | Landskap (T4 modul 1-4, T5 5-7) and Katering (T4 1-4, T5 5-8) are in the manual subject list, the tag editor, and the bank/queue filters. | 3 | Pass | E3 {Landskap, Katering}; E2 subject list. See bug DSKP-G5-01 for the intake list filter (not named by this AC). |
| AC-03.2 | Pendidikan Islam: Jawi SK/SP/TP text rendered `dir=rtl lang=ms-Arab`, every row "perlu semakan ejaan", legend line. | 3 | Pass | E3 "Pendidikan Islam is Jawi, right-to-left"; E4 dark/light PI; screenshots `pi-jawi-light-*`, `dark-dark-pi-jawi-*`, `w320-pi-375` |
| AC-03.3 | A flagged Jawi SP can be chosen and tagged; the flag is visible in the list, chip and SK row. | 3 | Pass | E3 "Pendidikan Islam is Jawi" |
| AC-03.4 | T4 SK 1.26 to 1.32, T5 starts at 1.33, no renumbering. | 3 | Pass | E3 "Pendidikan Islam ... SK numbering runs on"; unit `tree.test.ts` |
| AC-03.5 | The two vocational subjects can be tagged although no Bijak paper exists; paper authoring keeps its blueprint list (Matematik, Sains). | 3 | Pass | E3 Landskap/Katering; probe: Paper baharu lists "Matematik, Sains" only |

### US-04 Tag DSKP editor (intake, manual, Sunting)

| AC | Steps | Width | Result | Evidence |
|---|---|---|---|---|
| AC-04.1 | Subject fixed ("Subjek: Matematik"); Tingkatan select shows "Pilih tingkatan" with no default; options T4, T5, "Tingkatan 1-3 (di luar DSKP)". Also in Sunting of a flagged question. | 3 | Pass | E1 "AC-03.1 AC-04.1 AC-05.1"; E1 flagged lifecycle (Sunting opens with empty Tingkatan) |
| AC-04.2 | T4: unit list only that subject and tingkatan, grouped by Bidang, "{kod} - {tajuk}". | 3 | Pass | E1 "AC-04.2..04.5 ..."; E3 |
| AC-04.3 | SP is a searchable checkbox list (code and text), multi-select, no free text; Enter in the search does not submit. | 3 | Pass | E1 "AC-04.2..04.5 ..."; screenshot `tag-block-filled-*` |
| AC-04.4 | SPs of two SK show two read-only SK rows in print order; removing a chip updates SK. | 3 | Pass | E1 "AC-04.2..04.5 ..." (4.1.1 and 4.2.1); E3 Sejarah three SK |
| AC-04.5 | An SP outside the unit cannot be found/picked ("2.1.1" gives "Tiada SP sepadan dengan "2.1.1"."); changing the unit clears SP with the notice "SP dikosongkan kerana unit berubah."; server refuses an SP outside the unit. | 3 | Pass | E1 "AC-04.2..04.5 ..."; E4 "revision gate matrix" (`SP tidak wujud dalam unit yang dipilih.`) |
| AC-04.6 | T1-T3: Unit, SP search and SK disabled, caption "Tingkatan 1-3 berada di luar DSKP. Unit dan SP tidak diperlukan; TP masih wajib."; gate asks only TP; TP required. | 3 | Pass | E1 "AC-04.6 AC-07.2 ..."; screenshot `tag-block-t1t3-*`, `dark-dark-tag-block-t1t3-*` |
| AC-04.7 | T4 to T5 with unit and SP set: both cleared and "Unit dan SP dikosongkan kerana tingkatan berubah." under Tingkatan. | 3 | Pass | E1 "AC-04.2..04.5 ..."; screenshot `tag-block-form-notice-*` |
| AC-04.8 | No horizontal page scroll at 375/768/1280 (and 320); touch targets >= 44 px (selects, SP rows, chip remove, clear-search); SP list scrolls inside itself; search by code or text. | 3 + 320 | Pass | E1, E3 (`expectNoHorizontalScroll` on every test); E4 "Touch targets" and "Narrowest width (320)"; screenshots `w320-tag-block-375`, `w320-pi-375` |
| AC-04.9 | Upload a PDF: a question with no catalogue match keeps Tingkatan, Unit and SP empty (no guessed code); a question with only a TP suggestion shows "AI tidak menjumpai unit yang sepadan. Pilih secara manual." The gate marks the unit ("Medan keyakinan rendah belum disahkan: unit DSKP."). | 3 | Pass (first run: with Low bug DSKP-G5-02; fixed and re-verified, section 7) | E1 "AC-04.9 AC-05.2 AC-05.3 AC-10.1"; screenshot `intake-ai-no-match-*` |

### US-05 TP mandatory, AI confirmation

| AC | Steps | Width | Result | Evidence |
|---|---|---|---|---|
| AC-05.1 | New manual question and a flagged seed in Sunting: TP select empty/"Pilih TP" (flagged seed shows its stored TP 2, no AI badge); default 3 gone. | 3 | Pass | E1 "AC-03.1 AC-04.1 AC-05.1"; E1 flagged lifecycle |
| AC-05.2 | Upload: a suggested TP is a pre-selected suggestion with "Cadangan AI · Keyakinan rendah" and a "Saya sahkan TP (cadangan AI)" box at any unit confidence (Q3 has tinggi unit/SP with no confirmation box, but TP still asks); submit disabled until ticked or changed. | 3 | Pass | E1 "AC-04.9 AC-05.2 ..."; screenshots `intake-ai-badges-*`, `intake-ai-q3-*` |
| AC-05.3 | Unit, SP and TP each have their own confirmation; the refusal names the field: "Medan keyakinan rendah belum disahkan: unit DSKP." / "...: SP." / "Cadangan AI belum disahkan: TP."; ticking turns the badge to "Disahkan"; changing the value resolves it ("Diubah daripada cadangan AI: ..."). | 3 | Pass | E1 "AC-04.9 AC-05.2 ..." |
| AC-05.4 | Server refuses TP 7, 0, 3.5 ("Tahap Penguasaan (TP) mesti antara 1 dan 6."); the UI offers only TP 1 to 6. | 3 | Pass | E4 "revision gate matrix" |
| AC-05.5 | TP independent of the difficulty field: no `difficulty` field in m28 code; Tag block sets only `tp`. | n/a | Pass | code search (no match in `m28-bijak-spm`) |

### US-06 KBAT

| AC | Steps | Width | Result | Evidence |
|---|---|---|---|---|
| AC-06.1 | "Aras KBAT (pilihan)" select: Bukan KBAT, Mengaplikasi, Menganalisis, Menilai, Mencipta, with "Tidak ditentukan oleh TP." | 3 | Pass | E1 "AC-04.2..04.5 ..." |
| AC-06.2 | TP 1 with KBAT Menilai, TP 6 with KBAT empty: neither changes the other; stored separately (bank row prints both). | 3 | Pass | E1 "AC-04.2..04.5 ..."; E1 upload test (row "TP 6 · KBAT Menganalisis") |
| AC-06.3 | Complete tag with KBAT empty passes the gate list and submit; publish works with and without KBAT. | 3 | Pass | E1 "AC-04.2..04.5 ..." (gate list empty); E1 flagged lifecycle (published with no KBAT); E1 upload test (published with KBAT) |
| AC-06.4 | AI KBAT suggestion follows AC-05.2. The mock extractor gives no KBAT suggestion (arch 5.3), so this cannot be reached in the browser. | n/a | Pass (unit only) | unit `kbat-field.test.ts`, `tag-confirm-gate.test.ts` |
| AC-06.5 | Bank and queue KBAT filter: Semua, Ya, Tidak, four levels; Ya/Tidak/level give the right rows (after publishing a Menganalisis question: Ya 1, Menganalisis 1, Menilai 0, Tidak 0 within the search). | 3 | Pass | E2 "each filter ..."; E2 queue test; E1 upload test (KBAT filters) |

### US-07 Gates

| AC | Steps | Width | Result | Evidence |
|---|---|---|---|---|
| AC-07.1 | Submit (server `submitForReview`), revision (`reviseQuestionFull`, stem-only `reviseQuestion`) and publish (Lulus & Terbit) all require subject, tingkatan, unit, SP and TP, with the same rule. A complete T4 tag publishes. | 3 | Pass | E4 "submit ... refused at the server"; E4 "revision gate matrix"; E1 flagged tests; E1 upload test (publishes T4); unit `tag-rule.parity.test.ts` |
| AC-07.2 | T1-T3: needs subject, tingkatan and TP only; unit/SP not asked; a T1-T3 tag carrying a unit is refused with "Tingkatan 1-3 (di luar DSKP) tidak mempunyai unit atau SP." | 3 | Pass | E1 "AC-04.6 AC-07.2 ..." (submit, review, publish); E4 gate matrix |
| AC-07.3 | Exact messages: "Subjek dan tingkatan perlu ditetapkan.", "Unit DSKP belum dipilih.", "Standard Pembelajaran (SP) belum dipilih.", "Tahap Penguasaan (TP) belum dipilih."; identical in the editor list, the server's submit result and the review gate panel ("Soalan 2: Subjek dan tingkatan perlu ditetapkan."). Bulk wording reserved (no bulk UI). | 3 | Pass | E1 "AC-04.2..04.5 ..."; E4 "submit ... same messages"; E1 "publishing the flagged seed mat2-rev-g1 is refused" |
| AC-07.4 | Publish checks codes: complete tag publishes; a flagged seed (no codes) is refused; revision matrix names a missing/ghost unit. The publish gate calling the same `tagIssues` is confirmed by the parity test. | 3 | Pass | E1 seed gates, E4 matrix; unit `tag-rule.parity.test.ts`, `tag-gates.test.ts` |
| AC-07.5 | Publishing `mat2-rev-g1` (flagged question 2) is refused: gate panel "Soalan 2: Subjek dan tingkatan perlu ditetapkan.", Lulus & Terbit disabled, still refused when forced on. Stem-only revision of `mat1-kecerunan-v1` is refused ("Soalan: Subjek dan tingkatan perlu ditetapkan."). Tagging it in Sunting (T1-T3) clears the flag live, the new version publishes, flagged count 28 to 27. | 3 | Pass | E1 "publishing the flagged seed mat2-rev-g1"; E1 "a stem-only revision of a flagged question"; E1 "tagging a flagged Terbit question in Sunting clears the flag"; screenshots `review-flagged-gate-*`, `sunting-flagged-*`, `review-revision-tagged-*` |
| AC-07.6 | Bulk: no bulk UI exists in the prototype; `partitionByTagRule` reports and skips failing items. | n/a | Pass (unit only) | unit `tag-rule.test.ts` |
| AC-07.7 | A stored unit absent from the catalogue fails the gate with the field named ("Unit DSKP tidak wujud dalam katalog."), also a unit of the other tingkatan. | 3 | Pass (server in page; the editor's "(tidak dijumpai dalam katalog)" option is unit-tested only) | E4 "revision gate matrix"; unit `tag-block.test.ts` |

### US-08 Seed tagging

| AC | Steps | Width | Result | Evidence |
|---|---|---|---|---|
| AC-08.1 | Bank with Semua status: 79 questions = 44 T1-T3 + 7 tagged (T4, with unit, SK, SP, TP) + 28 flagged with no unit/SP/tingkatan. | 3 | Pass | E2 "each filter, chips, counts equal rows" (44, 7, 28, sum 79); unit `seed-tags.test.ts` |
| AC-08.2 | No guessed tag: flagged rows show no SP; tagged rows carry evidence in `seed-tags.ts` (unit test requires it). | n/a | Pass | unit `seed-tags.test.ts`; E2 flagged rows |
| AC-08.3 | Filter "Perlu semakan tag": count computed (28 across all statuses, 25 Terbit), drawer alert text, excluded from publishing, good outcome "Semua soalan sudah bertag." only when true (after tagging all 25 Terbit flagged seeds through the real server; 3 flagged remain in the queue and are counted under Semua status). | 3 | Pass | E2; E1 flagged lifecycle; E4 "When nothing is flagged any more"; screenshots `bank-filter-flagged-*`, `bank-drawer-flagged-*`, `bank-all-tagged-*` |
| AC-08.4 | Old labels are mapped "matched" or "no match", never "closest": 3 matched label groups, the rest flagged (architecture 6.3, as-built table agrees with the browser counts above). | n/a | Pass | architecture section 6.3; unit `seed-tags.test.ts` |
| AC-08.5 | Counts unchanged by tagging: bank 72 Terbit + 7 waiting = 79; KPI tiles 61 + 7 + 4 = 72; KPI strip stays unfiltered by the filters; tagging in Sunting adds/removes no question. | 3 | Pass | E2; E1 flagged lifecycle (79 before and after) |
| AC-08.6 | Seed edit made in an isolated worktree, merged after `registry-boot.test.ts`. The process step cannot be re-verified by QA; `registry-boot.test.ts` is green in the full unit run. | n/a | Pass (unit; process not verifiable) | unit `registry-boot.test.ts` |

### US-09 Bank filter

| AC | Steps | Width | Result | Evidence |
|---|---|---|---|---|
| AC-09.1 | Subjek (13), Tingkatan, Unit (disabled until a subject, hint "Pilih subjek dahulu."; grouped "Tingkatan 4"/"Tingkatan 5" without tingkatan), SP (disabled until a unit, hint "Pilih unit dahulu."), TP, KBAT, "Perlu semakan tag"; dependent clearing (tingkatan change clears unit/SP; subject change clears unit/SP and keeps tingkatan, TP, KBAT; removing the Unit chip removes the SP chip; T1-T3 disables Unit). Each filter returns the independently expected set. Queue: the same five without the checkbox. | 3 | Pass | E2 (3 tests); screenshots `bank-filters-open-*`, `queue-filters-open-*` |
| AC-09.2 | Pager total equals rows (44 rows at page size 50, 7, 2, 1, 0); chips equal the applied filters; empty states use the filtered copy ("Tiada soalan dijumpai", "Cuba ubah atau set semula penapis.", "Set Semula"); the queue's filtered empty state is not "Baris gilir kosong". | 3 | Pass | E2; screenshots `bank-empty-filtered-*`, `queue-empty-filtered-*` |
| AC-09.3 | No horizontal page scroll with the bar, popover/sheet, chips, results, empty state and drawer open at 375, 768, 1280 (and 320). The inline bar, "Lagi Penapis" popover (md+) and "Penapis" sheet (<md) work. | 3 + 320 | Pass (first run: page scroll Pass, long Unit chip clipped at 375 = DSKP-G5-03; fixed and re-verified, section 7) | E2, E4 "Narrowest width"; E4 BUG DSKP-G5-03 (expected-fail); screenshot `bank-filter-unit-sp-375` |
| AC-09.4 | Rows show catalogue unit title, SP codes, TP (and KBAT); T1-T3 rows "Tingkatan 1-3 (di luar DSKP)" with no SP; flagged rows "Perlu semakan tag"; cards show Unit, SP, TP fields. Drawer shows the same badges and the flagged alert. | 3 | Pass | E2 "AC-09.4"; E2 rows; screenshots `bank-drawer-tagged-*`, `bank-filter-t1t3-*`, `bank-kbat-row-*` |

### US-10 Tag audit

| AC | Steps | Width | Result | Evidence |
|---|---|---|---|---|
| AC-10.1 | AI-suggested tag accepted, changed or hand-typed: history lines "Tag: Unit: 8.0 - ... (cadangan AI diterima, keyakinan rendah)", "Tag: TP: 6 (cadangan AI: 3, keyakinan rendah)", with the person and version of the entry. | 3 | Pass | E1 upload test; screenshot `review-ai-history-*` |
| AC-10.2 | Hand-typed tag: the line has no AI suffix. | 3 | Pass | E1 upload test (Q2), E1 T1-T3 test |
| AC-10.3 | Sunting that changes the tag: history shows "Tag: Tingkatan: (kosong) → kepada Tingkatan 1-3 (di luar DSKP)" with the change note, in the review workspace and the bank drawer; Unit/SP lines omitted for T1-T3. | 3 | Pass | E1 flagged lifecycle; screenshots `review-revision-tagged-*`, `bank-drawer-history-tag-*` |
| AC-10.4 | The history lists contain no button, input or link. | 3 | Pass | E4 "AC-10.4" |

### US-11 Ownership

| AC | Steps | Width | Result | Evidence |
|---|---|---|---|---|
| AC-11.1 | m28 reads the catalogue through `dskpCatalog` only; M03 is the single owner. `m28/admin/intake/lib/dskp.ts` (D-A) is gone; no unit/SP schema in m28. | n/a | Pass | code inspection; unit `dskp-source.test.ts` |
| AC-11.2 | D-A removed; D-B (M03 Bab/Topik) and D-C (M10 `mock/data/dskp.ts`) unchanged: `git diff` of the DSKP range shows no DSKP change in them. | n/a | Pass | `git diff --stat` of `src/modules/m10-teacher-class/mock/data`, M03 curriculum fixtures |
| AC-11.3 | M04 "DSKP Tagging (Pilihan)" unchanged (only an unrelated BM copy fix "DSKP ditag"). | n/a | Pass | `git diff` of `DskpTagging.vue` (copy only) |
| AC-11.4 | M03 Bab/Topik fixtures untouched; the catalogue is an additional tree beside them. | n/a | Pass | `git diff` of M03 `mock/`, `api/`, `pages/` (unrelated copy only) |

### Non-functional requirements

| NFR | Result | Evidence |
|---|---|---|
| NFR-01 Performance | Pass. After the lazy load of the subject chunk: switching tingkatan, selecting a unit and a SP search keystroke each render in under 300 ms (measured two frames after the event, Pendidikan Moral). | E4 "NFR-01" |
| NFR-02 Integrity | Pass (unit): a tag stores the catalogue version; a removed node fails the gate. | unit `dskp-source.test.ts`, `bank-filter.test.ts`; E4 matrix |
| NFR-03 Security | Pass: AI never final (confirm boxes, gate), catalogue read-only. | E1 upload test; unit contract tests |
| NFR-04 Accessibility | Pass for the existing pattern: every control has a visible label or aria-label (selects, SP search "Cari SP", "Buang SP {kod}", filter selects), required stars, live count line, visible focus ring seen in screenshots. FB-075 is a known pre-existing DS issue, not counted here. | screenshots; E1 |
| NFR-05 Localisation | Pass: BM copy as in the design copy table (all checked strings are asserted verbatim); Jawi in `dir=rtl`, `lang=ms-Arab`, Scheherazade rendering without clipping (screenshots light and dark). | E1, E3 |
| NFR-06 Responsive | Pass except DSKP-G5-03: no horizontal page scroll anywhere at 375/768/1280/320; touch targets >= 44 px at 375 (SP rows via the 44 px label row, chip remove, selects, clear-search). | E1 to E4, final run |
| NFR-07 Data privacy | Pass (unit): generator whitelist test, no personal names in data or seeds. | unit `drift.test.ts`, `seed-tags.test.ts` |
| NFR-08 Consistency | Pass: every count (pager, KPI, flagged, per filter) is computed from the data and equals its rows. | E2 |

**Totals: 63 of 63 acceptance criteria executed and Pass** (52 with a browser step, 11 by unit test, code inspection or diff review only, marked "n/a" in the Width column; AC-04.9 and AC-09.3 are Pass with a defect noted). The verdict is "Not ready" because of the open High bug, not because an AC failed; see section 4.

## 4. Bugs

| ID | Severity | Title | Owner | Status |
|---|---|---|---|---|
| DSKP-G5-03 | **High** | Long Unit chip is clipped at 375 px in the bank and queue filter bars | frontend-developer (DSKP-T08 / `DsActiveFilters`) | **Fixed and verified** (9e4472ca, section 7) |
| DSKP-G5-01 | Medium | Senarai Ekstrak "Subjek" filter still lists 3 subjects, not the 13 | frontend-developer (DSKP-T07) | **Fixed and verified** (9e4472ca, section 7) |
| DSKP-G5-02 | Low | "AI tidak menjumpai unit yang sepadan" caption is missing when the AI produced no suggestion at all | frontend-developer / backend-developer (extractor) | **Fixed and verified** (9e4472ca, section 7) |

The bug descriptions below are as found in the first run.

### DSKP-G5-03 (High): active-filter chip for a long unit title overflows its row at 375 px

- **Steps:** log in as Admin Pusat. Bank Soalan SPM (`/admin/spm/soalan`) or Baris Gilir Semakan (`/admin/spm/semakan`) at 375 px. Open "Penapis", Subjek Matematik, Tingkatan 4, Unit "1.0 - Fungsi dan Persamaan Kuadratik dalam Satu Pemboleh Ubah", "Guna".
- **Expected:** the chip "Unit 1.0 Fungsi ..." is truncated inside the chip row (design 6.1: "code + title, truncated by the chip"), its remove icon visible, nothing clipped (CLAUDE.md section 7; a layout break at 375 fails G5).
- **Actual:** the chip is 524 px wide in a 319 px row (left 28, right 552 at a 375 viewport; the container ends at 347). It is cut off by the viewport, the text is unreadable after "Persamaan Kuadratik dalam S" and the remove "x" is off screen. Page scroll stays 0 (the overflow is clipped), so the standard no-sideways-scroll check does not catch it. Only tapping the visible part of the chip removes the filter. At 768 and 1280 the chip fits (right edge 564 of 728 and 1199 of 1240). The queue bar uses the same component and breaks the same way.
- **Evidence:** `bank-filter-unit-sp-375.png`, `explore-chip-375.png`; measured by the expected-fail tests `BUG DSKP-G5-03 ... bank` and `... queue` in `dskp-g5-extra.spec.ts` (they pass on 768 and 1280, and fail as expected on 375).
- **Suspected cause:** the chip label has no `max-w-full` / `truncate` (`DsActiveFilters` button), exposed by the long DSKP unit titles.

### DSKP-G5-01 (Medium): intake list Subjek filter shows only Matematik, Sains, Sejarah

- **Steps:** `/admin/spm/soalan/ekstrak` (Senarai Ekstrak), open the "Subjek" filter.
- **Expected:** "Semua subjek" plus the 13 catalogue subjects (design 8: "Intake list ('Subjek' filter), bank and queue Subjek filters: the same 13"; architecture 5.4: `tagSubjects()` feeds "the intake declaration, intake list, review queue and bank filters").
- **Actual:** "Semua subjek, Matematik, Sains, Sejarah" (the list still calls `server.subjects()`, the 3 blueprint subjects, `IntakeListPage.vue` line 128). A batch of any of the other 10 subjects can be created (manual or upload) but cannot be filtered in the list. The declaration, the bank and the queue are correct.
- **Evidence:** expected-fail test `BUG DSKP-G5-01` in `dskp-g5-extra.spec.ts` (all 3 widths).
- **Fix hint:** use `server.tagSubjects()` in `IntakeListPage.vue` for that select.

### DSKP-G5-02 (Low): no "no match" caption for a question the AI cannot place at all

- **Steps:** upload a PDF with the question "Apakah warna langit pada waktu pagi?" (no command word, no catalogue match) for Matematik; open question 1.
- **Expected:** design 3.6 state NoMatch: caption "AI tidak menjumpai unit yang sepadan. Pilih secara manual." under Unit.
- **Actual:** Unit, SP and Tingkatan are empty (correct, not guessed, and the gate lists "Medan keyakinan rendah belum disahkan: unit DSKP."), but no caption appears. The caption only appears when the extractor also made some suggestion (for example a TP from a command word, like "Terangkan ..."), because `aiFieldState` returns early when `tagSuggestion` is absent.
- **Evidence:** expected-fail test `BUG DSKP-G5-02`; the matching case with the caption (a question that has a command word) is `intake-ai-no-match-*`; the failing case is the expected-fail test.

### Observations (not bugs; for the lead's attention)

1. **Wording of the gate for an unmatched empty unit.** After the AI finds nothing, the list shows both "Unit DSKP belum dipilih." and "Medan keyakinan rendah belum disahkan: unit DSKP." although there is nothing to confirm (the architecture 2.7 puts `tag.unit` in `lowFields` on no match; design 3.6 says "the gate asks for a value instead"). The two documents differ; the message clears as soon as a unit is chosen.
2. **Student weak topics for T1-T3.** For a Matematik K2 attempt the student result lists "Topik untuk disemak: Tingkatan 1-3 (di luar DSKP) - 5 markah hilang". It comes from the FB-004 decision (T1-T3 label as topic) and is not a DSKP regression, but the label is staff jargon in a student screen. A flagged seed forms no bucket (verified).
3. **Review workspace shows the first question's tag** for a stimulus group (`mat2-rev-g1` shows T1-T3 while question 2 is flagged); this is the accepted section 13.z deviation, the gate panel still names question 2.
4. For SK-level subjects (Sejarah, Pendidikan Islam, Tasawwur Islam) with a unit and TP chosen but no SP, the helper line says "Pilih unit dan SP untuk melihat penerangan TP." (the SP hint wins over "Pilih TP ..."); acceptable under design 3.5.

## 5. Known accepted deviations (not reported as bugs)

From design section 13 (13.x lead decisions, 13.z build deviations) and the task brief:

- D-UX1: T1-T3 renders Unit, SP and SK **disabled** with one caption (not hidden), as G1 AC-04.6.
- D-UX3: five curriculum filters sit in the `more` slot ("Lagi Penapis" popover from md, "Penapis" sheet below) and the tag is in the existing Soalan cell, not a new column.
- D-UX5: new refusal wording "Cadangan AI belum disahkan: TP." / "...: Aras KBAT.".
- UQ-1, UQ-2: queue has the same five filters (no "Perlu semakan tag"); read-only "Subjek: {nama}" caption.
- UQ-3: seed TP is not flagged (shows stored TP 2, no AI badge).
- 13.z T07: `@3xl` row 1 split 1/3 + 2/3; no "Tingkatan (pilihan)" field in the intake declaration; flag reason is the native `title`, not a tooltip.
- 13.z T08: card fallback "-"; queue filtered-empty copy "Tiada soalan dijumpai"; filter hints hidden for T1-T3; "·" separator; first-question tag for groups; history prints bare codes when the catalogue fails; no "Tiada soalan dijumpai" flash while loading; "Semua soalan sudah bertag." only when true; checkbox label centring; the popover's curriculum fields scroll inside (`max-h-80`).
- **FB-075** (pre-existing DS issue, not a DSKP bug): `DsFilterBar` sheet clips focus rings below md.
- Unit options show `(perlu semakan)` only for non-informational flags (`codeQuirk` is informational: Sains T5 6.0 is unflagged); Bahasa Inggeris T4 is flagged as a whole (draft edition).
- Seed TP values are authored (76 of 79 equal 2), per R-A.

## 6. Verdict of the first run (superseded by section 7)

**Not ready.**

Reasons:
1. **DSKP-G5-03 (High):** the long Unit chip in the bank and queue filter bars is clipped at 375 px (CLAUDE.md section 7 and the QA rule treat a clipped layout at a required width as High). Fix, then re-run the two expected-fail tests (`dskp-g5-extra.spec.ts`, remove `test.fail`).
2. DSKP-G5-01 (Medium) and DSKP-G5-02 (Low) are open; they do not block by the G5 rule, but G5-01 is a one-line fix in the same module and should go in with the High fix.

What passed: all 63 acceptance criteria executed with Pass (52 with a browser step at 375, 768 and 1280; 11 by unit test, code inspection or diff review as marked); the unit suite (514 files, 8,618 tests, no failure), `npm run dskp:check`, and the existing bijak e2e (18/18) are green; the gates give the same exact messages at submit, revision and publish; the flagged seed `mat2-rev-g1` cannot be published; tagging a flagged question in Sunting clears the flag and publishes; the 13 subjects, Jawi (right-to-left), the TP descriptors at the printed level, KBAT, the filters, the history lines, dark mode and 320 px all hold.

Re-test after the fix: see section 7.

## 7. Re-test after the G5 fixes (commit 9e4472ca merged into this branch)

The fixes were merged with a no-fast-forward merge of `worktree-agent-a4f704fdb96909b49` (9e4472ca: `DsActiveFilters` chip `min-w-0 max-w-full`; `IntakeListPage` uses `tagSubjects()`; the no-match caption without a suggestion; lead decision: an empty field needs no confirmation and the gate shows only "Unit DSKP belum dipilih."; the `test.fail` annotations removed; the submit race fixed in `dskp-g5-extra.spec.ts`).

### 7.1 Results (real output)

| Suite | Command | Result |
|---|---|---|
| DSKP G5 e2e, all three widths | `DSKP_REUSE=1 DSKP_SHOTS=... E2E_BOOT_TIMEOUT_MS=90000 npx playwright test -c e2e/m06-spm/dskp-g5.config.mjs` (Vite started from the repository root with `VITE_PROTOTYPE_SCOPE=on npx vite --mode e2e --port 5391`) | **135 tests (45 x mobile 375, tablet 768, desktop 1280): 133 passed, 2 skipped, 0 failed** (44.4 m). The 2 skipped are the 320 px test on tablet and desktop (it sets its own width, runs once on mobile). No expected-fail test is left: the three defect tests (8 runs) now pass as normal tests. |
| Bijak e2e (existing) | `BIJAK_DEV=1 E2E_BOOT_TIMEOUT_MS=90000 npx playwright test -c playwright.bijak.config.mjs` | **18 passed (6.9 m)** |
| Unit, m28 and DS | `npx vitest run --project unit src/modules/m28-bijak-spm src/ds` | **Test Files 73 passed (73); Tests 969 passed (969)**, exit 0 |
| `npm run dskp:check` | | `dskp:check ok: 15 files match` |
| Config self-start | `BIJAK_DEV=1 DSKP_PORT=5392 npx playwright test -c e2e/m06-spm/dskp-g5.config.mjs --project=desktop -g "13 subjects in the declaration"` (no `DSKP_REUSE`) | 1 passed: after the config fix below the config starts its own Vite from the root |

The full unit suite of the first run (514 files, 8,618 tests, exit 0) was not repeated; the merge changed only `tag-view.ts`, `validation.ts`, `IntakeListPage.vue`, `DsActiveFilters.vue` and two m28 test files, and both folders were re-run above.

### 7.2 Bug verification

| ID | Verified how | Result |
|---|---|---|
| DSKP-G5-03 | Tests `DSKP-G5-03 ... bank` and `... queue` x 3 widths: chip right edge inside its row and inside the viewport, touch target >= 44 px, `aria-label` "Buang penapis Unit 1.0 ...". Screenshot `shots2/bank-filter-unit-chip-375.png` shows "Unit 1.0 Fungsi dan Persamaan Kuad..." truncated with the remove icon visible. | **Fixed, verified** (375, 768, 1280; bank and queue) |
| DSKP-G5-01 | Test `DSKP-G5-01`: "Semua subjek" plus the 13 subjects in the intake list filter at 375 (sheet), 768 and 1280. | **Fixed, verified** |
| DSKP-G5-02 | Test `DSKP-G5-02`: a PDF question with no command word and no match shows "AI tidak menjumpai unit yang sepadan. Pilih secara manual."; the unit stays empty; the issue list no longer holds "Medan keyakinan rendah belum disahkan: unit DSKP." and keeps "Unit DSKP belum dipilih." after a tingkatan is chosen. | **Fixed, verified** |
| Observation 1 (duplicate wording of the gate for an empty unit) | Resolved by the same lead decision. The earlier assertions in the upload test (AC-05.3 refusal names, Q2 messages after T4 and after a unit) still pass. | Closed |

AC-04.9 and AC-09.3 are now plain Pass. All 63 acceptance criteria remain Pass; the rows of section 3 hold with the fixes (the full G5 suite above covers every browser-executed AC again).

### 7.3 The two student-side tests that failed for the developer

Tests: "AC-08.1 AC-07.5: a tagged seed shows its catalogue unit title as topic ..." and "AC-07.5: a paper made only of flagged seeds ...".

- In my first full run they passed on all three widths. On the retest, started on a freshly restarted Vite, they failed on the first attempt (`element was detached from the DOM`, snapshot at "Soalan 1 / 5" with an empty-looking attempt). So they do fail in my environment too, under load (load average 4, tests 2 to 3 times slower than before).
- **Root cause: a race in the spec, not a product bug.** The spec walked the attempt with `while (await next.isVisible()) click next`. `isVisible()` does not wait. On a slow start the attempt shell is visible before the first question and its footer are rendered, so `next` is not visible yet, the loop ran zero times, and the spec clicked `submit` while the page was still rendering the question: Playwright found the button, the page re-rendered it, and the click retried until the timeout. An exploratory spec confirmed it (`NEXT CLICKS 0`, no navigation, no console error, no page error).
- **Fix (spec only):** wait for `next` to be visible before the loop and for `submit` after it. With that, both tests pass at 375, 768 and 1280 on the loaded machine (6 of 6, then again inside the full run).
- Not a product defect: the attempt screen shows its shell for a moment before the question loads, which is existing M06 behaviour and outside DSKP.

### 7.4 Config defects found and fixed in `e2e/m06-spm/dskp-g5.config.mjs`

1. **`webServer` ran from `e2e/m06-spm`** (Playwright's default cwd is the config's folder), so Vite had no `index.html` there and served 404. Fixed with `cwd: '../..'` (verified by the self-start run above).
2. **`outputDir` was inside the Vite project root** (`test-results-dskp-g5`). Trace files written there are seen by Vite's file watcher and logged as "page reload"; they can reload open pages during a run (the Vite log shows these lines during the failing runs). The default is now `../../test-results/dskp-g5`, which Vite ignores by default and `.gitignore` covers. This was not the cause of the student-test race (the failure persisted after the move; the race was), but it is a real hazard and is fixed.
3. The developer's note that `node_modules` must be real (hard-linked) inside the worktree is correct: with a symlink to another checkout the dev server serves the pdf.js worker URL wrongly and PDF upload fails.

## 8. Final verdict

**Ready.**

- 63 of 63 acceptance criteria executed and Pass (52 with a browser step, 11 by unit test, code inspection or diff review as marked).
- No open bug of any severity: DSKP-G5-03 (High), DSKP-G5-01 (Medium) and DSKP-G5-02 (Low) are fixed and verified at 375, 768 and 1280.
- Suites: DSKP G5 e2e 133 passed, 2 skipped (by design), 0 failed; bijak e2e 18 of 18; unit m28 + DS 969 of 969; first-run full unit suite 8,618 passed; `dskp:check` ok.
- Remaining notes (not bugs): observation 2 (the student weak-topic list names "Tingkatan 1-3 (di luar DSKP)", from FB-004) and observation 3 (first-question tag for a stimulus group, accepted deviation); the known pre-existing FB-075.
