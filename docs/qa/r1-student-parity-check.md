# R1 student-side parity check (H-A20)

Branch `r1/ha20-student-parity`. Merged base: `feature/v3-bijak-r1` at 8e8812ed (BASE-17). Read-only research; no code, seed or data changed. Twin of `docs/qa/r1-admin-parity-check.md` (H-A19).

Scope: the pupil side of R1 (Bijak SPM / Simulasi list, attempt, Semakan, Cuba Lagi, Kuiz, Databank, Latih Tubi SPM, Soalan by Chapter, Laporan Soalan). Rows walk `docs/discovery/v2-parity/student.md` (B01-B21, C08, C11, C19), with exact copy and behaviour from `docs/discovery/BIJAK-SPM-cloud.md` 3.2-3.7 and `docs/discovery/cloud-student-mechanism.md` 1.7-1.8 and 2.1-2.8. The ACs are `docs/requirements/v3-bijak-spm-scope.md` R1-01 to R1-11 and R1-18. V3 was read with `git show` / `git grep` on the base and on the unmerged team C branches listed in section 2; no other branch was checked out.

## 1. Summary

73 rows. Each row has an API class and an FE class (one is `n/a` when the row has no work on that side).

| Side | parity | label differs | step differs | missing API | missing FE | unconfirmed | n/a |
|---|---|---|---|---|---|---|---|
| API (team A) | 49 | 1 | 2 | 2 | 0 | 4 | 15 |
| FE (team C) | 30 | 13 | 9 | 0 | 2 | 5 | 14 |

Reading the counts:

- The parity of the API side is high because R1 backend work (B12 self-mark, B13 suggestion, B15 Cuba Lagi / Lihat semakan lepas, B16 Kuiz, T28 XP and kombo) is in the base. The two real API gaps are both on unmerged branches: D94 self-mark reward (`r1/t38-selfmark-reward`) and the paper on a Bijak report (`r1/t42-reports-intake-acs`).
- The FE gaps are mostly merge state, not missing work: Kuiz (F12, H-C8), Mula refusal (H-C5), own stimuli (H-C7), Databank empty chip (T14) are built on branches that base does not contain yet. One FE item has no code anywhere: a Lapor control on Bijak Semakan (S-69).
- "label differs" and "step differs" rows for Latih Tubi SPM and Soalan by Chapter compare V3 (built from V1, observed live) with V2 text that was read from source on routes that are switched OFF in V2 (`latih-tubi` flag). Those V2 strings were never observed in a browser; the lead should decide whether .cloud copy or the observed V1 copy wins (rows S-53, S-58, S-60, S-62, S-64).

Decisions applied: D87 U2 / D92 (Databank, Latih Tubi SPM, Soalan by Chapter are text-only MCQ in R1; images and groups are `n/a`, deferred R2, not gaps), D91 (card = drawable, `group_id IS NULL`), D93 (Cuba Lagi earns per attempt), D94 (BM copy approved; self-mark reward is T38), D96 (Darjah hidden everywhere; no pupil effect, secondary only).

Stale rows in `docs/discovery/v2-parity/student.md` (dated 2026-10-30): B15 (self-mark, now in base), B16 (Cuba Lagi and Lihat semakan lepas, now in base), B13 (suggestion, now in base), B17 (Kuiz, API in base, FE on branch), B18 (XP and kombo at submit, now in base through T28). Do not use those rows for planning.

## 2. Code state used (unmerged student-facing branches)

| Branch | Head | In base 8e8812ed? | What it adds for the pupil |
|---|---|---|---|
| `r1/f12-kuiz` | 9e7cb8fb | no | Kuiz pages, routes, hub button (contained in hc8) |
| `r1/hc8-kuiz-stimuli` | 7ac922a7 | no | Kuiz serves a question's own stimuli of all seven kinds; BM refusal on an unavailable per-paper quiz |
| `r1/hc5-mula-403` | fc54afc8 | no | Cover `Mula` shows the API BM reason on 403 |
| `r1/hc7-own-stimuli` | 786d3e4d | no | A question's own stimuli above the stem on attempt and result |
| `r1/t14-student-bugs` | 1903b713 | no | Stem rows, Databank zero-count chip "Tiada soalan", feedback body de-duplicated |
| `r1/t15-bm-copy` | 09eabe2e | no | Approved BM copy (Q1) on ResultPage and docs |
| `r1/b16-kuiz` | 97e6c3df | no | API: Kuiz count rule and limits (team A) |
| `r1/t38-selfmark-reward` | 270e5140 | no | API: D94 self-mark reward (team A) |
| `r1/t42-reports-intake-acs` | b3cddd1c | no | API: report carries attemptId / paperId (team A) |
| `r1/t35-report-archive` | 4ea790b1 | no | API: Arkib on a report row (team A) |

Already in base: T28 (XP and streak at submit), self-mark, retry, past sittings, Kuiz API (`bijak/kuiz`), H-A2 reports Darjah, T08 secondary guard, T25, T32.

## 3. Legend

parity: same behaviour and copy. label differs: the exact BM on both sides is quoted. step differs: a different click path or order. missing API / missing FE: nothing in base (a branch that has it is named). unconfirmed: the live behaviour or the code could not be established. n/a: V3 addition, V2 defect fixed by D9, KIV, or deferred R2.

## 4. Rows

### 1. Paper list, cover and resume (B01-B03, B20)

| ID | V2 ref | V2 element (exact BM) | API | API evidence | FE | FE evidence | Action |
|---|---|---|---|---|---|---|---|
| S-01 | B01 / S1 | List heading "Simulasi Peperiksaan"; sidebar "Simulasi Peperiksaan" with badge "BARU" | n/a | No API text. | label differs | V3 names the entry "Bijak SPM" (sidebar keeps badge "BARU", `src/shells/nav/user-nav.ts:225`; deliberate, v2-bijak-spm AC-01.1). The string "Simulasi Peperiksaan" still exists once in `src/` (hub copy). | Deliberate rename (AC-01.1); record in the deviation table, no work. |
| S-02 | B01 / S1 | Only servable (published) papers listed, grouped by subject; a draft or withdrawn paper by direct URL is not found | parity | `GET bijak/papers`; spec "lists published curated papers only" and "404 'Kertas tidak ditemui' for an unknown, malformed, draft or withdrawn paper" (AC-R1-01.2, proven in ha17). | parity | `BijakHubPage.vue` tab "Kertas Pilihan", subject and kertas filters (V3 addition). | - |
| S-03 | B01 / S1 | Card: "Set N", badge "Tracking A" for composites, "Kertas N", "N markah", "N min", button "Mula"; "Sambung" when a sitting is open | parity | List carries state and attemptId (progress.spec, AC-R1-01.3 proven). | parity | Strings "Mula", "Sambung", "Tracking A" present in hub and cover (`PaperCoverPage.vue:97`). | - |
| S-04 | B01 / S1 | Empty state: "Tiada kertas tersedia buat masa ini" / "Set simulasi sedang dalam penyediaan. Semak semula tidak lama lagi." | n/a | No API text. | parity | Both strings present in the hub. | - |
| S-05 | B01 / E1 | SPM hub card "Bijak SPM" / "Duduki kertas SPM penuh dalam format kertas sebenar — bermasa, dengan skema." with "{n} set", only when n > 0 | parity | `GET spm/overview` (count of servable papers). | parity | Sentence present in 2 files (SPM hub). Hiding the card at n = 0: unconfirmed in the FE. | - |
| S-06 | B01 / S1 | Subheading "Duduki kertas SPM dalam format kertas sebenar — jawab, tanda automatik setiap halaman" | n/a | - | n/a | V2 marks it stale (N-03: pages are not auto-marked per page); not rebuilt. D9 fix, list in the deviation table. | Deviation row only. |
| S-07 | B02 / S2 | Cover: "SULIT", paper code, subject, "Kertas N", "N minit", numbered instructions, reference sheet | parity | Paper detail (`GET bijak/papers/:id`). | parity | `PaperCoverPage.vue` has SULIT, code, subject, kertas, minit, instructions, foldable reference sheet. Only one reference sheet is rendered; other declared reference assets: unconfirmed. | - |
| S-08 | B02 / S2 | Grid "Untuk Kegunaan Pemeriksa" (Bhg / Soalan / Penuh / Diperoleh / Jumlah), only when a part is self-marked | n/a | - | n/a | Absent (0 hits). V2 never fills it (print artefact, BIJAK-SPM-cloud 3.4), so nothing is lost; lead to confirm "n/a". | Lead call. |
| S-09 | B03 / S4 | Resume page "Sambung Percubaan": "Percubaan belum dihantar", "Masa berlalu setakat ini: mm:ss", "Sambung — teruskan jawapan & masa sedia ada", "Mula Semula — kosongkan jawapan & masa", confirm "Mula semula?" / "Semua jawapan dan masa untuk percubaan ini akan dikosongkan. Mula semula?", footnote | parity | `GET papers/:paperId/in-progress`, `POST attempts/:id/abandon` (progress.spec). | parity | `PaperCoverPage.vue:108-126,182-183`: every string is identical, including the footnote. Shown only after the fresh window (`FRESH_SECONDS`), as V2's 60 s rule. | - |
| S-10 | B03 / S2 | A logout destroys the session pin, so the next pupil on a shared device gets a BLANK sitting | step differs | V3 keeps the open attempt on the server and returns it on any device (AC-R1-05.2); no logout reset. | step differs | Cover offers Sambung after a new login. | By design (AC-R1-05.2, cross-device resume). Record as a conscious deviation; V2 behaviour is an operator request for shared devices (unconfirmed need). |
| S-11 | B20 | Content availability: only published papers with approved questions are served | parity | Servability rules (`servability-rules.spec`), bridge refusals (mapping.spec); content depends on T29/T30 and the K1 blueprint evidence runbook. | parity | Hub empty state. | Ops: content must exist on UAT (runbook). |

### 2. Attempt (B04, B05, B07-B12)

| ID | V2 ref | V2 element (exact BM) | API | API evidence | FE | FE evidence | Action |
|---|---|---|---|---|---|---|---|
| S-12 | B09 / S2 | Timer: "Masa berbaki" (timed) or "Masa berlalu" (untimed); amber at 5 min; "Amaran: masa berbaki kurang 5 minit."; auto-submit at 0 | parity | Server deadline plus grace; submit 4 "auto (zero time): auto_submitted" (AC-R1-05.4 proven). | parity | `AttemptPage.vue`: "Masa berbaki", "Masa berlalu", the warning sentence, "Masa tamat". | - |
| S-13 | B10 / S2 | Autosave labels "menyimpan…", "disimpan", "gagal simpan", "luar talian"; debounce 1 s; cross-device pre-fill | parity | `PUT attempts/:id/answers`, revision never overwritten by an older one (AC-R1-05.1 proven). Resume spec for answers, flags and picks missing (AC-R1-05.2 partial). | label differs | V3 `AttemptPage.vue:408-411`: "Menyimpan…", "Disimpan", "Gagal simpan — cuba lagi", "Luar talian — jawapan disimpan pada peranti ini" (capitalised, with a suffix). | Team A: resume spec (T40). Team C: label wording is a lead call (AC-R1-05.1 names the lower-case words). |
| S-14 | B04 / S2 | Page turner "← Sebelum", "Halaman X daripada Y", "Seterusnya →", "Hantar Jawapan", "KERTAS PEPERIKSAAN TAMAT" | n/a | - | step differs | One question per screen (`AttemptPage.vue`): "Sebelum" (aria), "Seterusnya", "Hantar"; no printed sheets, no end banner. By design (D28 c, D44; scope R1-02 note). | By design; deviation row. |
| S-15 | B04 / S2 | Question map: dot per question, legend "Dijawab" "Ditanda" "Belum", "pilih N", aria "Soalan N"; flag button "Tanda soalan" | n/a | - | parity | `NavigatorPanel`, `QuestionBlock.vue:96` ("Tanda soalan" / "Ditanda"); legend strings present. | - |
| S-16 | B05 / S2 | Choose-N: "Jawab N soalan sahaja." / "Jawab semua soalan.", "{c} / {n} soalan dipilih", "Pilih soalan ini untuk dijawab" | parity | Best-N scoring proven (golden.spec, self-mark.spec). A server limit on the number of picks is not asserted (AC-R1-02.1 partial). | parity | Strings and counter present (`chooseCounterLine`, `chooseFullHint`). | Team A: pick-limit spec (T40). |
| S-17 | B04 / S2 | Shared passage stays on screen: "📌 Petikan kekal dipapar semasa menjawab"; group members together in group order | parity | Group stimulus served once with its members (pipeline-chain.spec; AC-R1-02.3 proven). | parity | String present; shared Rajah pinned. | - |
| S-18 | B12 / S2 | Hantar: confirm "Hantar jawapan anda sekarang?"; double submit is one submission | parity | submit 2 and 3 (replay, simultaneous keys) proven (AC-R1-05.3). | parity | Dialog text identical (`AttemptPage.vue:728`); pending-submit retry. | - |
| S-19 | B07 / S2 | Widget mcq: radio group aria "Pilihan jawapan", options A-D | parity | mcq mapping and grading (mapping.spec). | parity | `PartInput.vue`, string present. | - |
| S-20 | B07 / S2 | Widget short_text "Tulis jawapan…" and numeric ("cth. 3.14…", aria "Jawapan berangka", optional unit) | parity | Mapped and graded. | parity | Both strings present. | - |
| S-21 | B07 / S2 | Widget extended_essay "Tulis jawapan anda di sini…", counter "{w} patah perkataan"; essay_choice topic radios, "Tulis karangan anda di sini…", counter with "sasaran min–max" | parity | essay_choice stored and mapped (T25, stimuli.spec; migration 0101). One attempt with all five modes through reload and Semakan is not specced (AC-R1-03.1 partial). | parity | Strings present; essay_choice flat view in admin lists is H-A7 (admin, not here). | Team A: five-mode attempt spec (T40). |
| S-22 | B07 / S2 | Widget working_shown ("Ruang kerja" + "Jawapan:"), table_fill, sequence_order, graph_plot, draw_on_diagram, code, cloze, numbered_list | n/a | Outside the five R1 modes; refused by the bridge with an admin-visible reason (AC-R1-03.2 proven). | n/a | KIV; never shown to the pupil. V2 fallback text "Jenis jawapan ini akan tersedia tidak lama lagi." exists in the FE but must never be reached (AC-R1-03.2). | Deferred R2. |
| S-23 | B08 / S2 | Seven stimulus kinds: passage, image, infographic, diagram, map, graph, table; captions "Rajah" / "Graf" / "Jadual"; load failure "Rajah tidak dapat dimuatkan" with "Cuba lagi" | parity | File-token URLs for pictures, table from tableData, source line (stimuli.spec); stem and option images (stem-image.spec, AC-R1-04.2 proven). Kinds outside the seven are refused with a reason. | parity | `StimulusView.vue` + `StimulusFigure` render all seven. A question's OWN stimuli above the stem on attempt and result are on `r1/hc7-own-stimuli` (786d3e4d), not yet merged. | Team C: merge H-C7 (hc7). |
| S-24 | B08 / S2 | Image failure also offers "Lapor" next to "Cuba lagi" | unconfirmed | - | unconfirmed | `StimulusView.vue` header comment mentions "Lapor"; whether it posts a report: unconfirmed (no ReportQuestionModal in m28 at base). | Team C: confirm. |

### 3. Semakan, self-mark, Cuba Lagi, history, rewards (B13-B16, B18, B19)

| ID | V2 ref | V2 element (exact BM) | API | API evidence | FE | FE evidence | Action |
|---|---|---|---|---|---|---|---|
| S-25 | B14 / S3 | Semakan header "Dihantar", score "{score} / {max}", live refresh after each self-mark | parity | `GET attempts/:id/result`; self-mark returns the new totals (self-mark.spec). | parity | `ResultPage.vue`, `PartResultCard.vue:52` ("{awarded} / {marks}"); "Dihantar" present. | - |
| S-26 | B14 / S3 | Scheme only after submit: block "Skema Pemarkahan · {marks} markah" | parity | Scheme withheld before submit (409 NOT_SUBMITTED on self-mark; result hidden). | parity | `PartResultCard.vue:154` identical; "Semakan belum tersedia" + "Skema pemarkahan hanya dipaparkan selepas kertas dihantar." before submit. | - |
| S-27 | B14 / S3 | Objective verdict "✓ Betul (a/m)" / "✗ Salah (a/m)"; V2 key lines "Jawapan: x", "Jawapan diterima: ...", "(toleransi ±t)" | parity | Statuses betul / separa / salah / kosong / belum_dimarkah. | label differs | V3 shows badges "Betul", "Separa", "Salah" and "{awarded} / {marks}" without the ✓/✗ glyphs; "Jawapan:" and "Jawapan diterima:" identical. "Separa" is a V3 state V2 does not have. | Lead call on the glyphs (cosmetic). |
| S-28 | B14 / S3 | mapping scheme "Padanan betul: {json}" (raw JSON, V2 defect N-14) | n/a | - | n/a | Not rebuilt (0 hits); raw JSON is a V2 defect. D9 fix. | Deviation row. |
| S-29 | B13 / S3 | Keyword suggestion: "🔎 Cadangan automatik (kata kunci): a / m — x/y isi dikesan. Sila semak & laraskan."; tick title "Kata kunci dikesan dalam jawapan" | parity | `keyword-suggest.ts` is a port of the V2 marker; deterministic; stored as awarded mark at submit, part stays belum_dimarkah (AC-R1-07.1-07.4 proven). | label differs | `KeywordSuggestion.vue:14-16,34`: "Cadangan automatik (kata kunci):", "{matched}/{total} isi dikesan. Sila semak & laraskan."; per point "Kata kunci dikesan dalam jawapan: " / "Tidak dikesan: ". Wording is near identical; the V2 `a / m` mark pair is shown elsewhere. Close to parity. | - |
| S-30 | B13 / S3 | Band rubric radio: "Band {b} · {label} ({min}-{max}): {descriptor}", aria "Pilih Band {b}" | parity | Band stored; mark clamped into the band range (self-mark.spec). | label differs | `SelfMarkControl.vue:87`: "Band {name} · {label} ({from}-{to})" in a picker; descriptors listed in the scheme (`PartResultCard.vue:173`: "{name} ({a}–{b}): {descriptor}", en dash). | - |
| S-31 | B15 / S3 | Self-mark: "Markah kendiri:" number input 0..marks with "/ {marks}"; saves on change; failure swallowed (best effort) | parity | `POST attempts/:id/self-mark`: owner only, after submit only, clamp, no lock (AC-R1-06.1, 06.4 proven; 06.6 proven). | step differs | `SelfMarkControl.vue`: stepper ("Kurangkan markah kendiri" / "Tambah markah kendiri") and an explicit "Simpan markah" button; states "Markah kendiri disimpan", "Belum disahkan", "Cadangan, belum disahkan"; failure shows "Markah tidak dapat disimpan. Cuba lagi."; leave guard "Anda ada markah kendiri yang belum disimpan. Tinggalkan halaman ini?". One more click than V2 and an error V2 hides; both are approved copy (D94 (1), T15). | Accepted deviation (D94). Record. |
| S-32 | B15 / S3 | Band selection defaults the stepper to the band midpoint and narrows min/max | parity | Server clamps into the band range; the midpoint rule is not asserted by any spec (AC-R1-06.2 partial). | parity | Presets the stepper (`SelfMarkControl.vue` header comment, `pickBand`). | Team A: midpoint spec only if the rule lives server side (T40). |
| S-33 | B15 / S3 | Per-Bahagian stepper for a document Bahagian (`semak-bahagian`) | n/a | Skipped by decision (OQ-2, T46): no R1 paper has such a Bahagian. | n/a | Not built; document Bahagian is KIV (B06). | Deferred R2. |
| S-34 | B13 / S3 | Unmarked written parts: "Belum dimarkah" and count 0 until marked | parity | Waiting status proven; total-contribution-0 spec missing (AC-R1-06.5 partial). | parity | "Belum dimarkah — perlu semakan" (`PartResultCard.vue:22,119`), banner "{n} bahagian belum dimarkah — perlu semakan" and "Jumlah markah ialah sementara sehingga semakan selesai." | Team A: spec (T40). |
| S-35 | B18 / S3 | Submit writes the practice record, Prestasi feed, kombo and Syiling (once) | parity | Aggregate row + wallet credit "Ganjaran kertas Bijak SPM" once per attempt (flow.spec); XP and streak (kombo) at submit are in base through T28; Cuba Lagi earns again, one award per attempt (D93). V2 rates beyond 2 syiling + 10 XP per mark, and the kombo step: unconfirmed (verify-first notes, AC-R1-10.1/10.2 partial). | unconfirmed | Reward amounts are not shown on the Bijak result page (V2 shows none on Semakan; unconfirmed). | Team A: spec that Cuba Lagi does not re-pay attempt 1 (T40). |
| S-36 | B18 / D94 | A self-mark that raises a part's mark credits 2 Syiling + 10 XP per mark gained, once per part, never above the part's marks | missing API | Not in base. `awardSelfMark` exists only on `r1/t38-selfmark-reward` (270e5140, unmerged). Base pays nothing for a later self-mark (ha17 AC-R1-10.2 note). | unconfirmed | No FE change in T38; whether the pupil should see the gain (toast or chip) is not decided. | Team A: merge T38. Team C: ask whether a reward chip is wanted. |
| S-37 | B16 / S3 | "Cuba Lagi" button on Semakan starts a fresh sitting; old attempt untouched | parity | `POST attempts/:id/retry` (self-mark.spec, pipeline-chain.spec; AC-R1-08.1 proven). | parity | `ResultPage.vue` "Cuba Lagi" (also "Sejarah Bijak SPM"); shows the API's BM message on failure (lines 188-201). | - |
| S-38 | B16 / S2 | "Lihat semakan lepas" link on a new sitting (attempt header) | parity | `GET papers/:paperId/attempts` newest first (AC-R1-08.2 proven). | step differs | `PastSittingsLink.vue` is on the cover (scope R1-08.2 says cover). V2 shows it in the attempt header of the new sitting; V3 does not. | Scope text wins (AC-R1-08.2); record. |
| S-39 | B16 | Withdrawn paper: "Cuba Lagi" refused with a plain BM message | parity | Refused with BM text (AC-R1-08.3 proven). | parity | ResultPage shows `e.message` from the API. On the cover, `Mula` on a 403 shows the API reason only on `r1/hc5-mula-403` (fc54afc8, unmerged); base shows "Percubaan tidak dapat dimulakan. Cuba lagi." | Team C: merge H-C5. |
| S-40 | B19 / H1 | History: `/spm/history` last 50 sessions; Bijak runs show as "Tahun Lepas" (V2 defect N-10) | parity | `GET bijak/history` newest first with score (attempts.spec). Cap of 50: unconfirmed. | parity | `HistoryPage.vue` "Sejarah Bijak SPM" (D9 fix: V3 labels Bijak runs correctly). | Deviation row (N-10). |
| S-41 | (V3 addition) | Share score "Kongsi" / "Skor disalin"; "Mod Latihan" instant feedback; photo answers | n/a | - | n/a | Not in V2; kept (student.md 'V3-only additions'). | - |

### 4. Simulasi Kuiz (B17)

| ID | V2 ref | V2 element (exact BM) | API | API evidence | FE | FE evidence | Action |
|---|---|---|---|---|---|---|---|
| S-42 | B17 / S5 | Random Kuiz `/simulasi/kuiz`: count 5/10/20/40 else 20, optional subject, approved MCQ with correct option, answer key never in the page, `Semak` is a server check | parity | `bijak/kuiz/sessions` (+`check`, `finish`) in base (kuiz.spec, AC-R1-09.1/09.2/09.4 proven). `r1/b16-kuiz` (97e6c3df) adjusts count/limits, not merged. | missing FE | No Kuiz page at base. Built on `r1/f12-kuiz` (9e7cb8fb) and extended by `r1/hc8-kuiz-stimuli` (7ac922a7, contains f12): route `/simulasi/kuiz`, hub button "Simulasi — Kuiz" (`/simulasi/kuiz?count=20`). | Team C: merge H-C8 (carries F12). Team A: merge B16. |
| S-43 | B17 / S5 | Copy: "Simulasi — Kuiz", "Soalan {i} daripada {n}", "Masa", "✓ Semak Jawapan", "🎉 Betul!" / "😟 Salah", "Soalan Seterusnya →" / "Tamat →", "Kuiz Selesai!", "Markah", "Ketepatan", "↻ Cuba Lagi", "Kertas penuh" | n/a | - | label differs | f12/hc8 `lib/kuiz.ts`: identical except the check button, which is "✓ Semak" (V2 S5 "✓ Semak Jawapan", S6 "✓ Semak"). Everything else verbatim. | Team C: one string, or accept (lead call). |
| S-44 | B17 / S5 | Stimulus: first stimulus only | parity | Item carries all stimuli of the question (kuiz.spec 1). | parity | hc8 serves a question's own stimuli of all seven kinds with caption, source and table (a superset; fits R1-04). | - |
| S-45 | B17 / S5 | Nothing stored | step differs | D91 U8: the random Kuiz IS stored as a practice session, feeds Soalan Aku Salah and pays the reward; the per-paper quiz stores nothing (kuiz.spec 11, 12, 17). | step differs | Result tiles "Syiling" / "Mata" (`KuizPage.vue:192-193`), absent in V2. | By decision U8; deviation row. |
| S-46 | B17 / S6 | Per-paper quiz `/simulasi/{paper}/kuiz`: MCQ parts paged by Bahagian, "✓ Semak", other parts a textarea "Tulis jawapan anda di sini…" never sent, footer "Skor: x / y", "← Sebelum" / "Seterusnya →" | parity | `GET bijak/kuiz/papers/:id`, `papers/:id/check` (kuiz.spec 15-17). | label differs | `PaperQuizPage.vue` (f12/hc8): same flow; adds a note under the textarea "Latihan sendiri — jawapan ini tidak disimpan atau dimarkah." ([PROPOSED] D-9, approved with D94 (1)); entry "Kuiz" button on the cover. | Approved addition. |
| S-47 | B17 / S5-S6 | Empty: "Belum ada soalan objektif" / "Kuiz ini mengambil soalan objektif daripada kertas yang telah diterbitkan..."; "Kertas ini tiada soalan"; "Skema jawapan belum tersedia untuk soalan ini." | parity | 422 "Belum ada soalan objektif" (kuiz.spec 5). | parity | `kuizCopy` verbatim (f12/hc8). | - |
| S-48 | B17 / S6 | Paper quiz of a withdrawn or unavailable paper | parity | The API answers a withdrawn or archived paper with a BM refusal (inferred from the hc8 commit message; the spec name was not checked). | parity | hc8 (9e7cb8fb) shows the API BM refusal. | - |

### 5. Databank Soalan SPM (C11)

| ID | V2 ref | V2 element (exact BM) | API | API evidence | FE | FE evidence | Action |
|---|---|---|---|---|---|---|---|
| S-49 | C11 / 2.8 | Heading "Databank Soalan SPM"; counts 5/10/20 (default 10); random, no level filters; "Pilih set:" 5/10/20 | parity | `GET spm/databank`; start: past_year counts 5/10/20 else 422 (start.spec; AC-R1-11.1 proven). | parity | `m06-spm/pages/DatabankPage.vue` "Databank Soalan SPM", "Pilih set:" 5/10/20. | - |
| S-50 | C11 / 2.8 | V2 subheading under the heading | n/a | - | unconfirmed | V3: "Pilih subjek dan mula jawab dari bank soalan" (V1 copy). The V2 subheading is not recorded in the discovery docs: unconfirmed. | Discovery gap; low. |
| S-51 | C11 / 2.8 | Subjects with zero approved MCQ are NOT listed | parity | Count is computed per subject (D91: card = drawable). | step differs | V3 lists every subject card. `r1/t14-student-bugs` (1903b713, unmerged) disables the card and shows the chip "Tiada soalan" for a zero count, the V2 Bab/Latih Tubi pattern; V2 Databank hides it. | Team C: merge T14; decide hide vs chip (lead). |
| S-52 | C11 / 2.8 | Quiz: one question per screen, "Soalan {i} daripada {n}", "Masa", "✓ Semak", then "🎉 Betul!" / "😟 Salah", "Penjelasan:" when present, "Soalan Seterusnya →" / "Tamat →" | parity | `POST practice/sessions/:id/check-answer` returns isCorrect, correctOptionId, explanation (check.spec; AC-R1-11.1). | label differs | `QuizRunner.vue`: "Semak", titles "Betul!" / "Salah", "Penjelasan:"; no emoji. T14 hides a feedback body that repeats the title. | Cosmetic; lead call. |
| S-53 | C11 / 2.8 | Result: letter grade, tiles, "Ganjaran Anda" (syiling, kombo, mata, baki) | parity | Session complete pays through the practice reward port (BE-12); record kept as mode `past_year`. | label differs | `QuizResults.vue` has "Ganjaran Anda"; the title and buttons come from `PRACTICE_LABELS`: "Keputusan Latihan", "Ulang Lagi", "Kembali" (V2 cloud Latih Tubi: "Kuiz Selesai!", "↻ Cuba Lagi", "Senarai Subjek"; V2 source-read, route OFF). | Lead call: V1-derived labels vs .cloud. |
| S-54 | C11 / R1-11.3 | Session stored with mode `spm_tahun_lepas` and counted in Prestasi | label differs | Internal mode stays `past_year` (decided T46, D9 naming row). The Databank to Prestasi by-subject spec is missing (AC-R1-11.3, 10.4 partial). | n/a | - | Team A: spec + deviation row (T40). |
| S-55 | C11 / R1-11.2 | An admin-approved MCQ (Tingkatan 1-5 with subject) raises the Databank count with no pool tag | parity | `servable-counts.spec`; `learner-visibility.ts` replaces the `pool:spm` tag (AC-R1-11.2 proven). | n/a | - | - |
| S-56 | C11 / D87 U2, D92 | Image-bearing questions and stimulus groups in Databank | n/a | Ungrouped single-leaf text MCQ only; card = drawable (`group_id IS NULL`, D91). | n/a | Deferred R2 (D87 U2, D92 (1)); admin sees the reason. | Deferred R2, not a gap. |
| S-57 | C11 / R1-11.4 | Legacy 406,396 questions still appear; image items stay excluded | unconfirmed | Loader semantics proven on fixtures; production no-regression is evidenced by the runbook SELECTs (UAT before/after), not by a spec. | n/a | - | Ops (runbook 3.6). |

### 6. Latih Tubi SPM (C-KIV, V2 text source-read)

| ID | V2 ref | V2 element (exact BM) | API | API evidence | FE | FE evidence | Action |
|---|---|---|---|---|---|---|---|
| S-58 | 2.1 | List: heading "Latih Tubi SPM", subheading "Pilih subjek untuk mula berlatih" | parity | `GET spm/latih-tubi` (T4 and T5 pool, ungrouped, single MCQ leaf). | label differs | V3 subheading "Pilih subjek untuk mula berlatih (Tingkatan 4 & 5)" (V1 copy with a level suffix); heading identical. V2 text is from source (route OFF). | Lead call. |
| S-59 | 2.1 | "Subjek Teras" / "Subjek Elektif" groups, chips "{n} soalan" and "Target SPM: {n}" / "Target Custom: {n}" | parity | Counts per subject = drawable (D91). | parity | `LatihTubiListPage.vue`: groups "Subjek Teras ({n})" / "Subjek Elektif ({n})", badge "{n} soalan", "Target {type}: {n}". | - |
| S-60 | 2.1 | Setup: "← Kembali ke Senarai Subjek", "{n} soalan tersedia", "Pilih Tahap Pendidikan" (+ "Semua Tahap"), "Pilih Tahap Kesukaran" (1-5 with counts), "Bilangan Soalan" 5/10/15/20, "▶ Mula Kuiz" | parity | start: SPM modes take their own count rules (start.spec). | step differs | `LatihTubiConfigPage.vue` ("Tetapan Kuiz"): Tingkatan 10/11 chips instead of Tahap Pendidikan, Tahap Kesukaran keys 2-5, "Bilangan Soalan" = target option or 5-60, "Mula Kuiz", no emoji. Built from V1 (observed live); V2 source-read only. | Lead call: .cloud flag OFF (unreachable), V1 observed. |
| S-61 | 2.1 | Quiz chips "🔀 Soalan dan pilihan jawapan dirawak setiap sesi.", "✓ Mengikut DSKP"; "Soalan oleh: Admin PRESTASI+" | parity | Options shuffled server side (unconfirmed for this mode). | label differs | "Mengikut DSKP" and "Soalan oleh" present in `QuizRunner.vue`; the shuffle sentence is absent (0 hits). | Team C: one string (lead call). |
| S-62 | 2.1 | Result "Kuiz Selesai!", "Tahniah, anda telah lengkapkan {subject}.", tiles Markah / Ketepatan / "🪙 Syiling" (2 per correct), "↻ Cuba Lagi", "Senarai Subjek"; empty "Tiada soalan untuk pilihan ini." | unconfirmed | 2 syiling per correct: rate not re-verified in this unit. | label differs | "Tahniah, anda telah lengkapkan" and "Tiada soalan untuk pilihan ini" are absent (0 hits); "Senarai Subjek" exists; result labels as S-53. | Team C: lead call; Team A: confirm rate. |
| S-63 | 2.1 | Question image caption "Rajah soalan" | n/a | Text-only MCQ in R1. | n/a | Deferred R2 (D87 U2, D92). | Deferred R2. |

### 7. Soalan by Chapter (C08)

| ID | V2 ref | V2 element (exact BM) | API | API evidence | FE | FE evidence | Action |
|---|---|---|---|---|---|---|---|
| S-64 | C08 / 2.3 | Subject list "Soalan by Chapter": subjects with chapters, chapter and question counts; banner on the Latih Tubi page "Soalan by Chapter" with "Mula →" | parity | `GET practice/chapter-subjects` (+ `:code`); counts ungrouped and approved (D91). | step differs | `ChapterIndexPage.vue` ("Mode Sistematik", "Latih Tubi Rawak") and `ChapterSubjectPage.vue` ("Progressive Unlock", "Lengkapkan semua soalan bab semasa dan capai 70% untuk buka bab seterusnya."): the V1 progressive-unlock design. The "Mula →" banner string is absent (0 hits). | Lead call: V1 is observed live; V2 hand-off goes to a flagged-off page. |
| S-65 | C08 / 2.3 | Chapter row "{n} soalan"; "Mula" when n > 0, else locked chip "Tiada soalan" (title "Belum ada soalan untuk...") | parity | Per-chapter counts from the bridge. | step differs | V3 cards are open or locked by the 70% rule (BR-16), not by an empty count; a chapter with 0 questions: unconfirmed. | Team C: confirm 0-question chapter. |
| S-66 | C08 / 2.3 | V2 count includes any status except `menunggu` (pending), so unapproved questions are counted | parity | V3 counts approved only (D9 fix; contradiction in V2: the count promises questions the draw refuses). | n/a | - | Deviation row. |
| S-67 | C08 / D92 | Images and stimulus groups in a chapter | n/a | Text-only MCQ (D87 U2). | n/a | Deferred R2. | Deferred R2. |

### 8. Laporan Soalan, pupil side (C19, R1-18)

| ID | V2 ref | V2 element (exact BM) | API | API evidence | FE | FE evidence | Action |
|---|---|---|---|---|---|---|---|
| S-68 | C19 / R1-18.1 | Report from a quiz question (Databank, Latih Tubi, Bab): button "Lapor Soalan" opens the reason modal | parity | `POST question-reports` with source `latihan` / `spm` (reports.spec). | parity | `QuizRunner.vue:453` "Lapor Soalan" + `ReportQuestionModal`; `QuizResults.vue` "Lapor soalan ini"; `StructuredAnswerPage.vue` "Lapor". | - |
| S-69 | R1-18.1 | Report from a Bijak attempt or Semakan, storing question and paper | missing API | Base has no paper column; `r1/t42-reports-intake-acs` (b3cddd1c, unmerged) adds `attemptId` / `paperId` and the stored paper. | missing FE | No `ReportQuestionModal` or Lapor control in `m28-bijak-spm` on base or on any team C branch checked (hc4 is admin). | Team A: merge T42. Team C: add a Lapor control on Semakan (new FE task, no id yet). |
| S-70 | C19 | Reasons list in the modal | unconfirmed | Contract reasons: "Jawapan tidak tepat", "Soalan mengelirukan", "Set jawapan tidak tepat" (V1 observed). | unconfirmed | V2 reason list is not in the discovery docs. | Discovery gap. |
| S-71 | C19 / R1-18.2 | `/laporan-soalan`: own reports only; V2 statuses baru / disemak / diperbaiki / ditolak | parity | `GET question-reports/mine`, own only (reports.spec; AC-R1-18.2 proven). | label differs | `LaporanSoalanPage.vue`: counters Jumlah / "Menunggu" / "Disemak" / "Diperbaiki" / "Dikeluarkan" / "Ditolak"; empty "Tiada Laporan". V3 has "Menunggu" for V2 "baru" and an extra "Dikeluarkan" (ha17 AC-R1-18.2 copy mismatch). | Lead call (AC says baru). |
| S-72 | R1-18.5 | Pupil sees the new status on the next view; the reporter is notified on a change | parity | Admin update notifies the reporter (reports.spec; proven). | parity | List refreshes on load. | - |
| S-73 | R1-18.4 | Archived question leaves Databank, Latih Tubi and Kuiz at once; Terbit papers keep their snapshot | parity | report-archive.spec 4, 5, 7 (Kuiz exclusion not asserted: AC-R1-18.4 partial). `r1/t35-report-archive` (4ea790b1) unmerged. | n/a | Admin warning is on the admin side (H-A19). | Team A: Kuiz exclusion step (T42). |

## 5. Gap list for team A (API)

Class `missing API`:

1. S-36 D94 self-mark reward: merge `r1/t38-selfmark-reward` (270e5140, T38 lane A1). Base pays nothing for a later self-mark.
2. S-69 Bijak report must store the paper: merge `r1/t42-reports-intake-acs` (b3cddd1c, T42 lane A2); then the FE control (team C list, item 6).

Class `step differs` / `label differs` (decisions, not code):

3. S-54 Databank internal mode stays `past_year`, not `spm_tahun_lepas` (T46 decision): add the deviation row; spec that a Databank session lands in Prestasi by subject and Sejarah (T40).
4. S-45 random Kuiz is stored (U8); S-10 open attempt survives logout (AC-R1-05.2): record both as deviations.

Class `unconfirmed` and partial proofs (specs T40/T41 cover these):

5. S-13 resume spec for answers, flags and picks (AC-R1-05.2); S-16 server limit on picks per Bahagian (AC-R1-02.1); S-21 one attempt with all five modes (AC-R1-03.1); S-32 band midpoint rule (AC-R1-06.2); S-34 unmarked parts count 0 (AC-R1-06.5).
6. S-35 Cuba Lagi does not re-pay attempt 1 (AC-R1-10.2) and V2 reward rates beyond 2 syiling + 10 XP per mark (unconfirmed).
7. S-62 Latih Tubi SPM "2 syiling per correct": rate not verified here. S-40 history cap of 50: unconfirmed.
8. S-42 merge `r1/b16-kuiz` (97e6c3df). S-73 Kuiz exclusion after Arkib is not asserted (T42); merge `r1/t35-report-archive`.
9. S-57 loader no-regression is ops evidence (runbook), not a spec.

## 6. Gap list for team C (FE)

Class `missing FE`:

1. S-42 Kuiz pages: merge `r1/hc8-kuiz-stimuli` (7ac922a7, contains `r1/f12-kuiz` 9e7cb8fb).
2. S-69 Lapor control on Bijak attempt / Semakan (AC-R1-18.1): no code on any branch checked; needs a new FE task id and the API from T42.

Merge state (built, not in base): S-23 own stimuli (`r1/hc7-own-stimuli`), S-39 Mula refusal text (`r1/hc5-mula-403`), S-51 Databank zero-count chip (`r1/t14-student-bugs`), approved copy (`r1/t15-bm-copy`).

Class `label differs` (lead call on each; V2 text quoted in the rows):

3. S-13 autosave labels; S-27 ✓/✗ glyphs; S-43 Kuiz check button "✓ Semak" vs "✓ Semak Jawapan"; S-46 textarea note (approved addition); S-52, S-53 quiz result labels ("Keputusan Latihan" / "Ulang Lagi" / "Kembali" vs "Kuiz Selesai!" / "↻ Cuba Lagi" / "Senarai Subjek"); S-58 Latih Tubi subheading suffix; S-61 shuffle sentence; S-62 "Tahniah, anda telah lengkapkan {subject}." and "Tiada soalan untuk pilihan ini."; S-71 "Menunggu" vs "baru" and extra "Dikeluarkan".

Class `step differs`:

4. S-14 one question per screen (by design); S-31 explicit "Simpan markah" (approved); S-38 "Lihat semakan lepas" on the cover, not in the attempt header (scope text); S-51 hide vs chip for an empty Databank subject; S-60 Latih Tubi setup (V1 observed); S-64 Soalan by Chapter progressive unlock (V1 observed); S-65 chapter with 0 questions (unconfirmed).

Class `unconfirmed`:

5. S-05 hide the Bijak card at 0 papers; S-07 other reference assets; S-24 "Lapor" next to "Cuba lagi" on an image failure; S-35/S-36 whether a reward chip should show on Semakan; S-50 and S-70 are discovery gaps (V2 text not recorded).

## 7. Deviations to record (D9, by decision, or lead call)

| Row | Deviation | Basis |
|---|---|---|
| S-01 | Entry named "Bijak SPM" instead of "Simulasi Peperiksaan" | v2-bijak-spm AC-01.1 |
| S-06 | Stale V2 subheading not rebuilt | D9 (N-03) |
| S-10 | Open attempt survives logout and device change | AC-R1-05.2 |
| S-14 | One question per screen, no printed sheets | D28 c, D44 |
| S-28 | No raw JSON for mapping schemes | D9 (N-14) |
| S-31 | Explicit save, error text, leave guard on self-mark | D94 (1), T15 |
| S-40 | Bijak runs labelled correctly in Sejarah | D9 (N-10) |
| S-45 | Random Kuiz is stored and rewarded | D91 U8 |
| S-54 | Databank mode name `past_year` | T46 decision |
| S-66 | Chapter counts approved only | D9, D91 |

## 8. Method and limits

- Copy was checked with exact-string `git grep -F` on `src/` of the base and of each branch in section 2; counts of 0 were then confirmed by reading the owning file. Substring hits on common words ("Mula", "Salah") were not used as proof.
- API behaviour comes from the controllers and services in `apps/api/src/modules/bijak`, `practice`, `spm`, and from the spec names recorded in `docs/qa/r1-backend-ac-coverage.md` (H-A17). No spec was run in this unit.
- V2 copy for Latih Tubi SPM and Soalan by Chapter is source-read (`cloud-student-mechanism.md` 2.1, 2.3), not observed in a browser, because the route flag is OFF in V2. Nothing here is written as live fact for those rows.
- Not checked: pixel layout at 375 / 768 / 1280 (E2E scope, R1-20), and any answer of the live site (no browser or server access in this unit).
