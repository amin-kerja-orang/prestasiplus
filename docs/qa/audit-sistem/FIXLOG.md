# System audit, screen by screen — FIXLOG (cloud)

Fixes for findings in `docs/qa/audit-sistem/BIJAK-SPM-AUDIT-REPORT.md` (branch `audit/sistem-2026-10-23`, commit `30aceaa`), admin scope only. `STUDENT-SCOPE-NOTES.md` is not acted on yet (student audit in progress).

- Fix branch: `claude/determined-dijkstra-ju5q60`, base `3e192a7`.
- Verify: in `../pp-audit-verify`, `git pull`, dev server on port 5199, then record in `VERIFY.md`.
- Status: **Fixed** (verify on screen), **In progress** (being fixed now), **Need-info** (answer the Question), **Declined** (reason in What changed), **Planned** (Full track; proposal below, not built until the user answers).
- Priority order (user, 2026-10-24): DSKP (§13) and shared stimulus (§13.9) first, then visual/responsive defects.

## FB table

| FB | Sumber | Track | Status | Commit | What changed | Question |
|---|---|---|---|---|---|---|
| FB-001 | §13.9.3 a2/a4, §3 #24 | Standard | In progress | | Attaching a stimulus gathers members and silently moves other questions; printed labels are not renumbered and the group header shows "Soalan 1 - 2" for members 1, 5, 2. Fix: renumber question labels in paper order after every attach/detach and show the real member list in the header. | |
| FB-002 | §13.9.3 c3, §13.9.4 (notice) | Standard | In progress | | Editing a shared stimulus gives no list of the questions that share it, and the review text says "semua 1 soalan" for a 4-member group. Fix: notice with the real sharer count and labels on `/admin/spm/soalan/:qid/sunting` and on the review item; correct the count text. (Fork-on-edit is FB-027, Planned.) | |
| FB-003 | §13.9.3 c1/c2, §13.9.4 (bank list) | Standard | In progress | | Bank chip "Rangsangan" has no group size and is missing on some members; the preview shows no siblings. Fix: chip "Kumpulan N soalan" on every member; preview lists the sibling questions. | |
| FB-004 | §13.4 (T1-T3 contradiction) | Standard | In progress | | "Tingkatan 1-3 (di luar DSKP)" passes intake with no unit, but the publish gate then refuses it ("topik DSKP belum dipilih"). Fix: one rule for both gates so a T1-T3 question that passed intake can be published. | |
| FB-005 | §10.2 V1 | Fast | In progress | | Raw select/input/textarea on the extract review and sunting pages have no visible boundary (staff border token is transparent). | |
| FB-006 | §10.2 V2 | Fast | In progress | | Selected pager/segment/tab button reads as disabled in dark (~1.4:1). | |
| FB-007 | §10.2 V3 | Fast | In progress | | Disabled primary buttons have near-unreadable labels (~1.9:1 dark, ~1.6:1 light). | |
| FB-008 | §10.2 V4 | Fast | In progress | | "Tambah dari bank" picker row text ~1.6:1 in dark. | |
| FB-009 | §10.2 V5 | Fast | In progress | | Tables wider than their card hide "Tindakan" (`/admin/spm/soalan`) and Status + "Semak" (`/admin/spm/semakan`). | |
| FB-010 | §10.2 V6 | Fast | In progress | | Phone cards show raw LaTeX (`soalan`, `semakan`) and drop Status/action fields (`soalan`, `semakan`, `kertas`, `ekstrak`). | |
| FB-011 | §10.2 V7 | Fast | In progress | | Four stacked scroll areas on the extract review page. | |
| FB-012 | §10.5 F1 | Fast | In progress | | Edit-question option rows clip at 320/375 ("Buang pilihan X" cut off). | |
| FB-013 | §10.5 F2, §10.4 | Fast | In progress | | "Tag DSKP" fieldset and selects overflow the card at 320/375. | |
| FB-014 | §10.5 F3 | Fast | In progress | | Expanded structured card: "Mod jawapan (a)" and "Buang bahagian (a)" beyond the card at 1024/1280. | |
| FB-015 | §10.5 F4, F5 | Fast | In progress | | PKSK question list and access tables (fixed layout) clip right columns at 768/1024; "Tindakan" unreachable. | |
| FB-016 | §10.5 F6 | Fast | In progress | | Cell content overflows its cell at 1280 (PKSK list/access, `/admin/questions`). | |
| FB-017 | §10.5 F7 | Fast | In progress | | Pentadbiran top bar tap targets under 40 px at 320/375 (menu, search, theme toggle, drawer close, brand). | |
| FB-018 | §10.5 F8 | Fast | In progress | | Page-level tap targets under 40 px at 320/375 ("Sisip matematik", slide-over "Tutup", checkboxes, "Tarik", "Lihat"). | |
| FB-019 | §10.5 F9 | Fast | In progress | | Sticky form bar covers the last fields on create/edit forms. | |
| FB-020 | §10.5 F10, §10.3 #15 | Fast | In progress | | Phone truncation: stat labels ("Jumlah ke…"), clipped input values, two-line pill. | |
| FB-021 | §10.3 #8 | Fast | In progress | | Phone review action bar on `/admin/spm/semakan/:key` floats over the answer scheme with no bar background. | |
| FB-022 | §6 P9, AC-22.4 / R26 | Fast | In progress | | Admin Bijak routes redirect a non-admin to its landing instead of 403. | |
| FB-023 | §9 #14, §12 #12 | Fast | In progress | | Bank stat total 79 vs subject counts 61 + 7 + 4 = 72. | |
| FB-024 | §10.3 #9-14, #16 | Fast | Need-info | | Judgement calls (form intro alignment, stat row 24 px short, ghost buttons in light, drop zone border, ekstrak filter bar, Tag DSKP indent, sidebar footer/ring). Not defects by the report. | Nak aku baiki juga item kosmetik ini (#9-14, #16), atau biar dulu? |
| FB-025 | §10.3 #17 | Fast | Need-info | | "Download Template" / "Template CSV" in English on `/admin/questions/import` (legacy .my replica, M04). | Halaman ini tiruan .my. Kalau di .my pun tertulis bahasa Inggeris, aku kekalkan (fideliti). Nak tukar ke BM juga? |
| FB-026 | §13 (all), §3 #19-22 | Full | Planned | | See proposal P-026. | See P-026 questions. |
| FB-027 | §13.9.4 fork row, AC-24.4 | Full | Planned | | See proposal P-027. | See P-027 questions. |
| FB-028 | §13.9.4 (1-3 stimuli; part-level `stimulus_ref`), §11 A10 | Full | Planned | | See proposal P-028. | See P-028 questions. |
| FB-029 | §13.9.4 kinds, §3 #13, §13.7, §13.9.3 b | Full | Planned | | See proposal P-029. | See P-029 questions. |
| FB-030 | §13.9.4 (attach on a Terbit question) | Full | Planned | | See proposal P-030. | See P-030 questions. |
| FB-031 | §6 A1/P1, §7.1 (KS-01) | Full | Planned | | See proposal P-031. | See P-031 questions. |
| FB-032 | §6 P4, §7.5, §9 #4 (KS-08) | Full | Planned | | See proposal P-032. | See P-032 questions. |
| FB-033 | §6 P8, §7.8 (KS-10) | Full | Planned | | See proposal P-033. | See P-033 questions. |
| FB-034 | §4 "Jana set", §6 A10 (US-29) | Full | Planned | | See proposal P-034. | See P-034 questions. |
| FB-035 | §4 "Salin untuk sunting", §9 #12, §6 P2/P3 | Full | Planned | | See proposal P-035. | See P-035 questions. |
| FB-036 | §6 A2, A3, A4, A9; §9 #6, #11; §13.6 duplicates | Full | Planned | | See proposal P-036 (other Partial gaps, bundled). | See P-036 questions. |
| FB-037 | §11.6 #1, §3 #14 | Doc | Need-info | | `v2-exam-schema.md` D1 drops numbered_list, sequence_order, code, cloze, gapped_text_match, essay_choice; `v2-bijak-spm.md` US-08 / AC-08.1 / AC-08.3 / R16 still require gaps, ordering, code and numbered list. D47 (2026-10-17) approved the exam schema one day after the Bijak doc. | Pilih: (a) ikut D1/D47, aku kemas kini US-08/R16 supaya buang kawalan itu; atau (b) kekalkan US-08, D1 perlu dipinda dan kawalan itu dibina. Cadangan aku: (a). |
| FB-038 | §11.6 #2, §9 #10, §3 #14 | Doc | Need-info | | Kertas Subjektif is Won't for v2.0 (`v2-bijak-spm.md` §6, R24, Q-B6) but F-76 / F-139 and menu item KS-07 still carry a treatment. | Pilih: (a) Won't: aku buang KS-07 dari menu dan tandakan F-76/F-139 "Won't v2.0"; atau (b) masuk skop v2.0 (jadi item Full baharu). Cadangan aku: (a). |
| FB-039 | §11.6 #3 | Doc | Need-info | | KS-02 label: "Databank Soalan" in the backlog, "Bank Soalan SPM" in the menu. | Label mana yang betul? Cadangan aku: "Bank Soalan SPM" (yang sudah dibina), aku kemas kini backlog. |
| FB-040 | §11.6 #4 | Doc | Need-info | | Paper types: QB §4.2 lists 7, intake code has 5, exam schema D8 `exam_type` lists 5 different values. | Senarai mana jadi rujukan? Cadangan aku: ikut D8 (skema diluluskan D47) dan selaraskan intake + QB §4.2. |
| FB-041 | §11.6 #5, §6 A4 | Doc | Need-info | | QB §4.1 keeps Lulus and Terbit separate and adds Diarkib; the code folds Lulus into Terbit and has no Diarkib. | Pilih: (a) ikut QB §4.1 (Lulus ≠ Terbit, ada Diarkib, jadi item Full); atau (b) kekalkan model kod sekarang dan kemas kini QB §4.1. |
| FB-042 | §11.6 #6 | Doc | Need-info | | F-71 / F-142 say Tracking A is "Merge-duplicate" but no doc says what replaces its set editor. | Tracking A diganti oleh apa? (cth. Pembina Kertas KS-09 dengan jenis "Tracking A", atau gugurkan terus.) |

## Proposals for Planned items (Full track: G1 → G6, nothing built until the user answers)

### P-026 DSKP integration (FB-026) — highest priority
- **Scope:** replace the 12 prototype units (`m28/admin/intake/lib/dskp.ts`) with a controlled DSKP list built from `docs/reference/dskp/*.json` (13 subjects, T4 + T5): Tingkatan → (Bidang/Tema where printed) → unit/Tajuk → SK → SP. SP becomes a pick list (multi-select of real codes; no free text). SK is derived from the chosen SP. TP 1-6 has no default and must be chosen (and confirmed by the reviewer when the AI suggested it). KBAT derived as TP ≥ 4 (spec D9). Form is part of the key (codes repeat across T4/T5). Publish gate (`gateErrors`) requires the same tag as the submit gate: subject, tingkatan, unit, ≥1 SP, TP (T1-T3 exempt per FB-004). Bank filter by unit/SP. Tag audit (AI suggestion vs final + confidence, AC-05.5).
- **Ownership (D12):** curriculum is owned by M03. The DSKP list would be published through an M03 contract (`dskpCatalog`) that m28 reads; m28 keeps no schema of its own. M10's fixture DSKP store (Bidang/SK/SP, used by M04/M08/M27) stays as is unless you want it replaced too.
- **Files:** new `src/modules/m03-curriculum/.../dskp-catalog.ts` (+ JSON loader + tests); `m28/admin/intake/lib/dskp.ts`, `components/QuestionEditor.vue` (Tag DSKP block), `domain/validation.ts`, `ai/mock-extractor.ts`, `server/admin.ts` (`gateErrors`, revision path, `legacyTag` rule), `domain/admin-types.ts`, `data/builders.ts` (seed tags), `admin/papers/BankPage.vue` (filter); docs `v2-question-bank.md` / `v2-bijak-spm.md` / architecture note.
- **Estimate:** L — G1 note + G2 design (1 session), build 3-4 developer tasks (catalog contract; Tag DSKP editor; gates + seeds; bank filter + audit), review + QA (1 session).
- **Questions (Q-026):**
  1. Setuju senarai DSKP dimiliki M03 (kontrak `dskpCatalog`) dan m28 hanya membaca? (D12)
  2. Subjek untuk v2.0: kesemua 13 DSKP, atau mula dengan Matematik, Sains, Sejarah dahulu? Landskap dan Nurseri serta Katering dan Penyajian tiada langsung dalam sistem sekarang. Perlu ditambah?
  3. TP: wajib dipilih tanpa nilai lalai? TP ditanda pada setiap soalan (1-6) walaupun DSKP takrifkan TP pada peringkat berbeza (Tajuk/SK/kemahiran/Modul)?
  4. KBAT: terbitan automatik (TP ≥ 4), atau medan berasingan?
  5. Pendidikan Islam: teks SK/SP dalam Jawi tidak dapat diekstrak. Cukup dengan kod sahaja buat masa ini?
  6. Soalan seed yang tiada tag: dikecualikan (pintu hanya untuk terbitan baharu), atau aku isi tag untuk semua seed?

### P-027 Fork a shared stimulus on edit (FB-027)
- **Scope:** AC-24.4. When a revision changes a shared stimulus, the editor asks: "Ubah untuk semua N soalan" (all sharers get a new version and go to review together as one group unit) or "Salin untuk soalan ini sahaja" (fork: the question leaves the group with its own copy). No silent propagation on approval (today `applyLive` replaces the stimulus for every sibling).
- **Files:** `m28/server/admin.ts` (`reviseQuestionFull`, `applyLive`, review seeds), `admin/papers/BankEditPage.vue`, `admin/papers/ReviewItemPage.vue`, `domain/types.ts`, tests.
- **Estimate:** M — 1 design note, 1-2 developer tasks, review + QA.
- **Questions:** Bila stimulus dikongsi disunting, pilihan lalai mana: "ubah untuk semua" atau "salin untuk soalan ini sahaja"? Perlukah semua ahli kumpulan disemak semula sebelum terbit?

### P-028 Multiple stimuli per question and part-level stimulus (FB-028)
- **Scope:** schema D6: 1-3 stimuli per question/group; `stimulus_ref` on a part (sub-question). Editor, review, preview, paper builder and the student attempt panel all render the list.
- **Files:** `m28/domain/types.ts` (`QuestionDef`, `GroupDef`, `PartDef`), intake grouping/validation/convert, `QuestionEditor.vue`, `IntakeReviewPage.vue`, `QuestionPreview.vue`, student `AttemptPage.vue` / `AttemptShell.vue` (student side touches the student audit scope).
- **Estimate:** L — touches the student renderer; G2 design needed.
- **Questions:** Had maksimum 3 stimulus setiap soalan, setuju? Perubahan ini menyentuh paparan murid. Nak tunggu audit murid siap dulu?

### P-029 More stimulus kinds (FB-029)
- **Scope:** add the kinds intended by D6 (graph, image, infographic, audio, map) and make "jadual" addable in intake (today only rajah/petikan; the manual path offers only "Tambah petikan"). Sample papers also use e-mel, notis/iklan, sajak, tajuk akhbar: these could be passage sub-kinds (label only).
- **Files:** `m28/domain/types.ts` (`StimulusDef.kind`), `IntakeReviewPage.vue` (`addStimulus`), stimulus renderer, validation (alt text), student renderer.
- **Estimate:** M.
- **Questions:** Jenis mana yang wajib untuk v2.0? Cadangan aku: jadual, graf, gambar, peta, serta petikan dengan sub-label (e-mel, notis, sajak, tajuk akhbar). Audio dan infografik ditangguhkan. Bagi laluan manual tanpa fail sumber, bagaimana "Tambah rajah" patut berfungsi: muat naik imej?

### P-030 Attach/detach a stimulus on a published bank question (FB-030)
- **Scope:** today grouping works only inside an intake batch. Add "Kumpulkan dengan rangsangan…" on the bank edit page: picking an existing stimulus creates a new version for the joining question and the group is reviewed as one unit.
- **Files:** `server/admin.ts`, `BankEditPage.vue`, grouping domain, review seeds.
- **Estimate:** M (depends on P-027).
- **Questions:** Perlukah ciri ini untuk v2.0, atau cukup dalam kelompok intake?

### P-031 Hub "Gambaran SPM" (FB-031, KS-01, AC-22.3)
- **Scope:** `/admin/spm` group landing with lane cards (label, description, total, attention count computed, not stored) for the built lanes (Bank Soalan SPM, Pembina Kertas, Ekstrak, Semakan). `/admin/spm` is 404 today.
- **Files:** new `m28/admin/hub/HubPage.vue`, route, `menu.ts` (KS-01 `to`), `server/admin.ts` (counts), tests.
- **Estimate:** S-M.
- **Questions:** Kad laluan mana yang mesti ada? Lorong lama (Tracking A, Subjektif, Databank) tidak dibina. Paparkan kad yang sudah dibina sahaja?

### P-032 Kontrak Simulasi editor (FB-032, KS-08, US-25 / AC-25.1-25.6, R30)
- **Scope:** list/create/edit/delete blueprints (Subjek, Kertas, Sumber Draf/Spec/Disahkan, Kod Kertas, Tempoh, Jumlah Markah, "Boleh tanda auto", Nota; Bahagian rows with label, rule, pilih N, markah, arahan, mod jawapan) with the "Kontrak dikongsi" banner, versions and audit. Today 4 hard-coded rows (`data/registry.ts:182-247`); no Sejarah blueprint although a Sejarah paper exists; MAT K2 and SN K2 have no live contract.
- **Files:** new `m28/admin/contracts/*`, `server/admin.ts`, `data/registry.ts`, `PaperNewPage.vue`, tests.
- **Estimate:** L (Q-B1 exam schema still blocks the field set).
- **Questions:** Q-B1 masih terbuka. Medan kontrak ikut skema D47? Tambah kontrak Sejarah? Kekalkan seed MAT K2/SN K2 (tiada di live) atau buang?

### P-033 Tanda Karangan queue (FB-033, KS-10, US-31 Should / R13)
- **Scope:** Admin Pusat queue of AI-proposed essay marks: student (anonymised), stem, proposed marks, rationale, scheme points; confirm or adjust; resolves "Menunggu semakan" on the student result.
- **Files:** new `m28/admin/essay-marking/*`, `server/store.ts` / `server/admin.ts`, student result linkage.
- **Estimate:** M.
- **Questions:** Perlu untuk v2.0 (US-31 ialah "Should")? Guru ditangguhkan (Q-B10)?

### P-034 Admin "Jana set" / pool preview (FB-034, US-29 Should)
- **Scope:** generate a draft paper from the bank by blueprint (count, year/board filters, live "{n} soalan tersedia"), keeping stimulus groups whole; regenerate.
- **Files:** `server/admin.ts` (reuse student generator `server/store.ts:327-349`), `PaperNewPage.vue`, `PaperEditorPage.vue`.
- **Estimate:** M.
- **Questions:** Perlu untuk v2.0?

### P-035 "Salin untuk sunting" and paper versions (FB-035, AC-24.x, AC-26.3)
- **Scope:** copy a published paper to a new draft (one copy, no "(Salinan)" chains); states "Dibatalkan terbit" / "Digantikan"; republish replaces the old version for new attempts only.
- **Files:** `server/admin.ts`, `domain/admin-types.ts` (`AdminPaperStatus`), `PaperListPage.vue`, `PaperEditorPage.vue`.
- **Estimate:** M.
- **Questions:** Kertas terbit diubah melalui salinan (seperti lama) atau versi baharu pada ID yang sama? Cadangan aku: versi baharu pada ID yang sama, dengan sejarah.

### P-036 Other Partial gaps (FB-036, bundled; each becomes its own FB once approved)
- Paper list: subject filter, search, 25 per page, attention column (A2, AC-22.1).
- Bank filters: chapter/unit, year, board/source (A3, AC-23.2).
- Withdraw/archive a Terbit question (QB US-14).
- Paper metadata edit: cover code, cover instructions, duration, Bahagian label/instruction/rule, passage edit (A9, AC-24.1-24.2).
- Publish override with reason + paper/contract audit (AC-27.2, US-32).
- Mod Pelajar opens Draf papers, attempts flagged as test data (US-28).
- Per-paper analytics (US-30).
- Edit link for Draf / Menunggu Semakan / Ditolak bank rows (§9 #11).
- Duplicate detection by normalised stem + options + figure hash (spec D9; `fileHash` stored but never compared).
- **Questions:** Mana antara ini yang masuk v2.0, dan susunan keutamaannya?
