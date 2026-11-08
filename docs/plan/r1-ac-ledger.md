# R1 AC ledger

The ledger is the record of **which acceptance criteria (ACs) and end-to-end chains (AC-CHAIN-n) passed or failed, where, when and by whom**. It is the measure of progress ("ACs passing / ACs planned", plan section 5A). Working rules: [R1-START-HERE.md](R1-START-HERE.md) (decision 4). Codes: [00-index "Codes in plain words"](../prd/r1/00-index.md#codes-in-plain-words).

## Who writes rows

| Env | Who writes the row | When |
|---|---|---|
| **CI** | The card's own team (the session that opened the PR). | In the card's PR, for every AC tagged `[CI]` or `[CI+UAT]`. One row per AC with the name of the automated test in the evidence column. |
| **UAT** | The card's team, acting as the UAT tester (it runs the ACs in a visible browser with the shared test accounts). | After the designated UAT developer posted, in #503, a deployed commit that contains the card's merge. One row per AC, and one row per AC-CHAIN-n that passes through the card. |

- A row is added or updated by a **docs-only PR** (touches only `docs/plan/r1-ac-ledger.md`; no card ID needed; no scope guard). When two PRs conflict on this file, rebase and keep both rows.
- A card moves to `status:done` only when every one of its ACs has a **Pass** row for the env it is tagged with (`[CI]` -> CI, `[UAT]` -> UAT, `[CI+UAT]` -> both). **A Fail row re-opens the card** (`status:in-progress`); when the fix is deployed, a new row is added below the Fail row (rows are never deleted or edited into a pass). The card's team lead sets `status:done` when every AC has its Pass row; the Delivery Lead samples Pass rows each sprint and may re-open a card with a new Fail row.

## Columns

| Column | Content |
|---|---|
| card | the card ID, for example `S1-T01` |
| AC / AC-CHAIN ID | the AC ID from the PRD (`AC-ADM-QE1.2`) or `AC-CHAIN-1` (one row per AC; do not write wildcards) |
| env | `CI` or `UAT` |
| result | `Pass` or `Fail` |
| date | `YYYY-MM-DD` |
| team/session | `<team>/S-<k>`, for example `team-amin/S-2` |
| evidence ref | **the name only** of a local `.evidence/` path (for example `.evidence/S1-T01/375-studio-wizard.png`) or the automated test name (`stimuli.service.spec.ts`). Never a link, never an uploaded file. |

Example of one row (format only; this is not a result):
`| S1-T01 | AC-ADM-QE1.2 | CI | Pass | 2026-11-10 | team-amin/S-2 | stimuli.service.spec.ts |`

## Privacy rules

- UAT holds real pupil data. **No person name, e-mail, phone, IC number, credential or server address** in this file. Evidence stays on the local machine in `.evidence/` (gitignored) and only its path name is written here.
- For a Fail, write the failing step in the PR or the issue comment in plain words and the AC ID, never the data that was on the screen.

## UAT test records (AC-CHAIN steps and any AC that needs data)

- Test records are created **on the dedicated test school** with the team's own test accounts, through the UI.
- Every record carries the prefix **`UJI <team> <date>`** in its name or title (`UJI team-amin 2026-11-10 Rajah 3`).
- The **creating team removes its records through the UI the same day** after the run (also after a Fail, once the failing step is written down). The test accounts themselves are kept.
- Anything left behind is reported by the team lead in #503 and removed by the creating team. At the end of each sprint the designated UAT developer lists records with the prefix `UJI ` and removes the leftovers as part of U-OP-14 (plan section 7 runbook).
- Never create records on a real school, never edit or delete a record that does not carry the team's prefix.

## Slice 0

During Slice 0 (plan section 5A) the UAT deploy is made on request. The team lead asks the designated UAT developer in #503; the rows are written in the same way.

## Sprint 0

| card | AC / AC-CHAIN ID | env | result | date | team/session | evidence ref |
|---|---|---|---|---|---|---|
| S8-T04 | AC-PA-21 | CI | Pass | 2026-11-05 | team-aa/S-1 | attempt-page-phone.test.ts::AC-PA-21 (warning once at every width; at 0 submits with auto:true; offline at 0 locks, banner, submits on reconnect); result-auto-banner.test.ts::AC-PA-21: auto=1 shows "Masa tamat. Jawapan anda telah dihantar secara automatik." once |
| S8-T04 | AC-PA-22 | CI | Pass | 2026-11-05 | team-aa/S-1 | attempt-page-phone.test.ts::AC-PA-22 (3 blank: "Anda belum menjawab 3 soalan." then "Hantar jawapan anda sekarang?"; focus starts on the safe button; Esc chooses the safe button) |
| S0-T12 | AC-ERR-7 | CI | Pass | 2026-11-05 | team-aa/S-1 | wave0.test.ts::shows Rujukan only on 5xx with a requestId; wave0.test.ts::Salin copies the request id |
| S0-T12 | AC-ERR-10 | CI | Pass | 2026-11-05 | team-aa/S-1 | client.test.ts::retries a GET 503 twice (about 1 s, then 3 s) and then fails; client.test.ts::never retries POST, PUT, PATCH or DELETE |
| S0-T12 | AC-ERR-12 | CI | Pass | 2026-11-05 | team-aa/S-1 | error-filter.spec.ts::415 gives UNSUPPORTED_MEDIA_TYPE with the generic text |
| S8-T02 | AC-PA-39 | CI | Pass | 2026-11-05 | team-aa/S-1 | leaf-links.test.ts::AC-PA-39: "Bahan 2" renders a button that opens Bahan 2; leaf-links.test.ts::AC-PA-39: "semua bahan" opens all (3 shown) in the drawer; leaf-links.test.ts::FR-PA-37: a leaf without stimulusId is unchanged; stimulus-panel.test.ts::FR-PA-37 source line |
| S8-T02 | AC-QA-09 | CI | Pass | 2026-11-05 | team-aa/S-1 | leaf-links.test.ts::FR-PA-37: the stimulus sits in the leaf, inline from 768; leaf-links.test.ts::FR-PA-37: a leaf without stimulusId is unchanged; leaf-links.test.ts::AC-PA-39: "semua bahan" opens all (3 shown) in the drawer |
| S6-T05 | AC-AS-0-2 | CI | Pass | 2026-11-05 | team-dd/S-1 | dashboard.spec.ts, amaran-access.spec.ts |
| S2-T03 | AC-ADM-Q03.1 | CI | Pass | 2026-11-05 | team-cc/S-2 | StudioListPage.test.ts |

## Sprint 1

| card | AC / AC-CHAIN ID | env | result | date | team/session | evidence ref |
|---|---|---|---|---|---|---|
| S1-T01 | AC-QA-02 | CI | Pass | 2026-11-05 | team-aa/S-3 | group-actions.spec.ts::AC-QA-02: member 3 fails the approve gate: 422 lists "Soalan 3: ..." and no member changes status |
| S1-T01 | AC-QA-03 | CI | Pass | 2026-11-05 | team-aa/S-3 | group-actions.spec.ts::AC-QA-03: an ids list with some but not all members is 422 stimulus_group_split on the group; nothing changes |
| S1-T01 | AC-QA-06 | CI | Pass | 2026-11-05 | team-aa/S-3 | group-actions.spec.ts::a draft member leaves group A and joins the end of group B in one call; A closes up; both details come back; audit row |
| S1-T01 | AC-QA-50 | CI | Pass | 2026-11-05 | team-aa/S-3 | group-actions.spec.ts::3 Draf members: 409 publishNotReady and nothing changes; after Hantar kumpulan all 3 are Menunggu Semakan; after Terbitkan kumpulan all 3 are Diluluskan together |
| S1-T01 | AC-QA-51 | CI | Pass | 2026-11-05 | team-aa/S-3 | group-actions.spec.ts::attaching a question of another Subjek to the empty Sains T4 group answers 422 memberScope; the same Subjek and Tingkatan is accepted |
| S1-T01 | AC-ADM-QE1.5 | CI | Pass | 2026-11-05 | team-aa/S-3 | group-actions.spec.ts::3 Draf members: 409 publishNotReady and nothing changes; after Hantar kumpulan all 3 are Menunggu Semakan; after Terbitkan kumpulan all 3 are Diluluskan together |
| S1-T01 | AC-ADM-QE2.3 | CI | Pass | 2026-11-05 | team-aa/S-3 | group-actions.spec.ts::a draft member leaves group A and joins the end of group B in one call; A closes up; both details come back; audit row |
| S1-T01 | AC-ADM-QE2.6 | CI | Pass | 2026-11-05 | team-aa/S-3 | group-actions.spec.ts::attaching a question of another Subjek to the empty Sains T4 group answers 422 memberScope; the same Subjek and Tingkatan is accepted |
| S1-T02 | AC-ADM-QE4.3 | CI | Pass | 2026-11-05 | team-aa/S-3 | bab-optional.spec.ts::without a Bab: gate-check lists NO_CHAPTER (step 4); the status route, the bulk action and create-as-approved name the same field; nothing moves |
| S1-T02 | AC-ADM-QE4.4 | CI | Pass | 2026-11-05 | team-aa/S-3 | bab-optional.spec.ts::a Subjek + Tingkatan without chapters has no NO_CHAPTER item and approves chapterless |
| S1-T01 | AC-ADM-QE2.1 | CI | Pass | 2026-11-05 | team-aa/S-3 | stimulus-api.spec.ts::adds the 2nd and 3rd question to a one-stimulus group; stimuli stay at 1 and the detail lists 3 members in order |
| S1-T01 | AC-ADM-QE2.2 | CI | Pass | 2026-11-05 | team-aa/S-3 | paper-units.spec.ts::is a paper-level error with the exact BM line (not section-prefixed, hard) |
| S1-T01 | AC-ADM-QE3.13 | CI | Pass | 2026-11-05 | team-aa/S-3 | stimulus-api.spec.ts::deletes an unused stimulus; a stimulus shown by a group is 409 with the BM message; audio rows are invisible |
| S5-T15 | AC-PA-01 | CI | Pass | 2026-11-06 | team-bb/S-1 | answer-store-writers.spec.ts::every direct writer is on the allow-list or the exemption with its exact count; answer-store-writers.spec.ts::the allow-list is empty |
| S5-T15 | AC-PA-15 | CI | Pass | 2026-11-06 | team-bb/S-1 | session-sweeper.spec.ts::abandons a session idle for more than 2 h, keeping its checks and writing nothing else; session-sweeper.spec.ts::an abandoned session is not in the history (repo and GET /practice/sessions) |
| S5-T06 | AC-MUR-54-2 | CI | Pass | 2026-11-06 | team-bb/S-1 | reports.spec.ts::AC-MUR-54-2: the note an admin writes on a report shows in the pupil own list |
| S5-T06 | AC-MUR-54-3 | CI | Pass | 2026-11-06 | team-bb/S-1 | reports.spec.ts::AC-MUR-54-3: a pupil report without an owned context is 403 in BM and stores nothing |
| S5-T06 | AC-MUR-54-5 | CI | Pass | 2026-11-06 | team-bb/S-1 | reports.spec.ts::AC-MUR-54-5: a second report by the same user for the same question version is 409 in BM and the first row is untouched |
| S5-T06 | AC-MUR-54-7 | CI | Pass | 2026-11-06 | team-bb/S-1 | reports.spec.ts::AC-MUR-54-7: five reports (pending, reviewed, fixed, dismissed, fixed on an archived question) count 1/1/2/1 with all 5; exactly one reads removed; ReportScreens.test.ts::AC-MUR-54-7: five reports show the counters, five cards, one "Dikeluarkan" and no "Selesai" |
| S6-T03 | AC-XS-1 | CI | Pass | 2026-11-05 | team-dd/S-4 | xs-queries.spec.ts |
| S6-T03 | AC-XS-2 | CI | Pass | 2026-11-05 | team-dd/S-4 | xs-queries.spec.ts |
| S6-T03 | AC-XS-3 | CI | Pass | 2026-11-05 | team-dd/S-4 | xs-queries.unit.spec.ts |
| S6-T03 | AC-X4-2 | CI | Pass | 2026-11-05 | team-dd/S-4 | xs-queries.spec.ts |
| S7-T02 | AC-AS-45-1 | CI | Pass | 2026-11-05 | team-cc/S-3 | leagues.spec.ts::AC-AS-45-1: the mean of session accuracy per school, in order, with the register name and state; sekolah-bersaing.test.ts::AC-AS-45-1: A rank 1 with a success 80% pill and 5, B rank 2 with a warning 60% pill and 3; rules.test.ts::AC-AS-45-1: ranks by accuracy, with the row shape of the contract |
| S7-T02 | AC-AS-45-2 | CI | Pass | 2026-11-05 | team-cc/S-3 | leagues.spec.ts::AC-AS-45-2: no sessions: an empty array and 200, even with the stored weekly rows present (DM-31); sekolah-bersaing.test.ts::AC-AS-45-2: an empty board shows both exact lines and no table; rules.test.ts::AC-AS-45-2: no session anywhere is an empty board |
| S7-T02 | AC-AS-45-3 | CI | Pass | 2026-11-05 | team-cc/S-3 | leagues.spec.ts::AC-AS-45-3: 40 schools give exactly 30 rows; rules.test.ts::AC-AS-45-3: cuts 40 schools to the top 30 |
| S7-T02 | AC-AS-45-6 | CI | Pass | 2026-11-05 | team-cc/S-3 | leagues.spec.ts::AC-AS-45-6: equal accuracy: more pupils first, then more sessions, then school name; sekolah-bersaing.test.ts::AC-AS-45-6: the colour follows the rounded value; rules.test.ts::AC-AS-45-6: breaks ties by pupils, then sessions, then name |
| S6-T02 | AC-AS-11-1 | CI | Pass | 2026-11-05 | team-dd/S-1 | routes.test.ts; KirkpatrickOverviewPage.test.ts |
| S6-T02 | AC-AS-11-2 | CI | Pass | 2026-11-05 | team-dd/S-1 | pupil-export.spec.ts; KirkpatrickPelajarPage.test.ts |
| S6-T02 | AC-AS-11-4 | CI | Pass | 2026-11-05 | team-dd/S-1 | routes.test.ts |
| S6-T02 | AC-AS-11-5 | CI | Pass | 2026-11-05 | team-dd/S-1 | interventions.spec.ts; handlers.test.ts |
| S6-T02 | AC-AS-11-8 | CI | Pass | 2026-11-05 | team-dd/S-1 | interventions.spec.ts; handlers.test.ts |
| S6-T02 | AC-GUR-11-1 | CI | Pass | 2026-11-05 | team-dd/S-1 | routes.test.ts |
| S6-T02 | AC-GUR-11-2 | CI | Pass | 2026-11-05 | team-dd/S-1 | KirkpatrickOverviewPage.test.ts; data.test.ts |
| S6-T02 | AC-GUR-11-3 | CI | Pass | 2026-11-05 | team-dd/S-1 | kirkpatrick/review.spec.ts |
| S6-T02 | AC-GUR-11-9 | CI | Pass | 2026-11-05 | team-dd/S-1 | kirkpatrick/review.spec.ts; KirkpatrickInterventionsPage.test.ts |
| S6-T04 | AC-AS-49-1 | CI | Pass | 2026-11-06 | team-dd/S-4 | amaran-risk.spec.ts |
| S6-T04 | AC-AS-49-2 | CI | Pass | 2026-11-06 | team-dd/S-4 | amaran-risk.spec.ts |
| S6-T04 | AC-AS-49-3 | CI | Pass | 2026-11-06 | team-dd/S-4 | amaran-access.spec.ts |
| S6-T04 | AC-AS-49-4 | CI | Pass | 2026-11-06 | team-dd/S-4 | amaran-risk.spec.ts; amaran-csv.spec.ts |
| S6-T04 | AC-AS-49-6 | CI | Pass | 2026-11-06 | team-dd/S-4 | amaran-access.spec.ts |
| S6-T04 | AC-AS-49-7 | CI | Pass | 2026-11-06 | team-dd/S-4 | amaran-risk.spec.ts |
| S6-T01 | AC-GUR-43-1 | CI | Pass | 2026-11-06 | team-dd/S-2 | m11 routes.test.ts; LaporanMingguanGuruPage.test.ts |
| S6-T01 | AC-GUR-43-2 | CI | Pass | 2026-11-06 | team-dd/S-2 | unit/guru-weekly-report.spec.ts; LaporanMingguanGuruPage.test.ts |
| S6-T01 | AC-GUR-43-3 | CI | Pass | 2026-11-06 | team-dd/S-2 | unit/guru-weekly-report.spec.ts; LaporanMingguanGuruPage.test.ts |
| S6-T01 | AC-GUR-43-4 | CI | Pass | 2026-11-06 | team-dd/S-2 | unit/guru-weekly-report.spec.ts; LaporanMingguanGuruPage.test.ts |
| S6-T01 | AC-GUR-43-5 | CI | Pass | 2026-11-06 | team-dd/S-2 | unit/guru-weekly-report.spec.ts; LaporanMingguanGuruPage.test.ts |
| S6-T01 | AC-GUR-43-6 | CI | Pass | 2026-11-06 | team-dd/S-2 | unit/guru-weekly-report.spec.ts; http/guru-weekly-report.spec.ts |
| S6-T01 | AC-GUR-43-7 | CI | Pass | 2026-11-06 | team-dd/S-2 | LaporanMingguanGuruPage.test.ts |
| S6-T01 | AC-GUR-43-8 | CI | Pass | 2026-11-06 | team-dd/S-2 | LaporanMingguanGuruPage.test.ts |
| S6-T01 | AC-GUR-43-10 | CI | Pass | 2026-11-06 | team-dd/S-2 | unit/guru-weekly-report.spec.ts |
| S6-T01 | AC-GUR-43-11 | CI | Pass | 2026-11-06 | team-dd/S-2 | unit/guru-weekly-report.spec.ts; LaporanMingguanGuruPage.test.ts; contract guru-weekly-report.test.ts |
| S3-T01 | AC-ADM-Q16.4 | CI | Pass | 2026-11-06 | team-cc/S-1 | blueprint-standards-api.spec.ts; kontrak-disahkan.test.ts |
| S3-T01 | AC-ADM-R8 | CI | Pass | 2026-11-06 | team-cc/S-1 | kontrak.spec.ts |
| S1-T02 | AC-ADM-QE4.1 | CI | Pass | 2026-11-05 | team-aa/S-3 | dskp-gate.spec.ts::AC-ADM-QE4.1: a draft with no tag lists exactly the unit and the SP gate-check approve returns two items, NO_UNIT then NO_SP, at step 4 with the PRD text |
| S1-T02 | AC-ADM-QE4.2 | CI | Pass | 2026-11-05 | team-aa/S-3 | gate-rows.spec.ts::AC-ADM-QE4.2: an SP outside the unit "12.1.1" gives SP_NOT_IN_TAXONOMY with the contract text, step 4 |
| S1-T02 | AC-ADM-QE4.5 | CI | Pass | 2026-11-05 | team-aa/S-3 | close-gates.spec.ts::without nodes a complete draft approves (200) and the panel never lists unit, SP or TP; once an SP node is loaded the same draft is refused |
| S1-T02 | AC-QA-42 | CI | Pass | 2026-11-05 | team-aa/S-3 | close-gates.spec.ts::AC-QA-42: the unloaded subject publishes; MATH (loaded) refuses unit, SP, TP and the aras of the leaf |
| S1-T02 | AC-QA-29 | CI | Pass | 2026-11-05 | team-aa/S-3 | textbook-ref.test.ts::AC-QA-29 Rujukan buku teks the compact form is "B3T4 M56", and "B3T4 M56-58" with hingga |
| S1-T02 | AC-ADM-QE4.6 | CI | Pass | 2026-11-05 | team-aa/S-3 | close-gates.spec.ts::a stem that names a figure with no stimulus: the detector flags it; submit and approve answer 422 with STIMULUS_MISSING; Bukan masalah lets it pass |
| S1-T02 | AC-ADM-QE3.3 | CI | Pass | 2026-11-05 | team-aa/S-3 | close-gates.spec.ts::AC-ADM-QE3.3 and AC-QA-31: Kesukaran is required on its own a draft with a TP and no Kesukaran is refused on submit and approve with "Sila pilih tahap kesukaran."; once typed it passes |
| S1-T02 | AC-QA-31 | CI | Pass | 2026-11-05 | team-aa/S-3 | close-gates.spec.ts::AC-ADM-QE3.3 and AC-QA-31: Kesukaran is required on its own a draft with a TP and no Kesukaran is refused on submit and approve with "Sila pilih tahap kesukaran."; once typed it passes |
| S1-T01 | AC-ADM-QE1.2 | CI | Pass | 2026-11-05 | team-aa/S-3 | questions/group-swap.spec.ts::AC-ADM-QE1.2 and AC-ADM-QE1.4 (swap half): after the swap every member names the NEW stimulus, the old stimulus row is unchanged, and a version-1 read is unchanged |
| S1-T01 | AC-ADM-QE1.3 | CI | Pass | 2026-11-05 | team-aa/S-3 | questions/servability-parity.spec.ts::S1-T06 (D105, AC-QP-7): with every INCLUDE surface, drills serve figures and whole groups, and an incomplete group is excluded as a whole |
| S1-T01 | AC-ADM-Q05.1 | CI | Pass | 2026-11-05 | team-aa/S-3 | questions/group-swap.spec.ts::AC-ADM-Q05.1: a draft copy staged [c,b,a] is published, groupOf lists [c,b,a], and the practice read returns that order |
| S1-T01 | AC-QA-07 | CI | Pass | 2026-11-05 | team-aa/S-3 | questions/stimulus-api.spec.ts::deletes an unused stimulus; a stimulus shown by a group is 409 with the BM message; audio rows are invisible |
| S1-T01 | AC-QA-10 | CI | Pass | 2026-11-05 | team-aa/S-3 | questions/stimulus-api.spec.ts::AC-QA-10 (G-06): an image stimulus with no or blank alt text is 422 on alt with "Sila isi teks alternatif untuk imej ini."; a clearing update is 422; a table or passage needs none; questions/group-option-bank.spec.ts::AC-QA-10: a letter that a leaf key of a member uses cannot be dropped; keeping it, or dropping an unused one, works |

## Sprint 2

| card | AC / AC-CHAIN ID | env | result | date | team/session | evidence ref |
|---|---|---|---|---|---|---|
| S10-T04 | AC-GUR-5-2 | CI | Pass | 2026-11-05 | team-bb/S-2 | student-and-class.spec.ts |
| S10-T04 | AC-GUR-5-3 | CI | Pass | 2026-11-05 | team-bb/S-2 | student-and-class.spec.ts |
| S10-T04 | AC-GUR-5-8 | CI | Pass | 2026-11-05 | team-bb/S-2 | student-and-class.spec.ts |
| S10-T04 | AC-AS-5-1 | CI | Pass | 2026-11-05 | team-bb/S-2 | student-and-class.spec.ts |
| S10-T04 | AC-AS-5-3 | CI | Pass | 2026-11-05 | team-bb/S-2 | class-pages.test.ts |
| S10-T04 | AC-MUR-5-1 | CI | Pass | 2026-11-05 | team-bb/S-2 | analitik-pelajar.spec.ts (fake SP port; UAT waits #924) |
| S10-T04 | AC-MUR-5-2 | CI | Pass | 2026-11-05 | team-bb/S-2 | analitik-pages.test.ts (fake SP port; UAT waits #924) |
| S10-T04 | AC-MUR-5-3 | CI | Pass | 2026-11-05 | team-bb/S-2 | analitik-pages.test.ts (fake SP port; UAT waits #924) |
| S1-T05 | AC-QA-34 | CI | Pass | 2026-11-05 | team-aa/S-3 | imports.spec.ts::[CI] the 2,000-row cap is admin-only: the Guru route refuses more than 500 rows with "Fail melebihi 500 baris." for every header, the admin route 2,001 rows with the 2,000 message; imports-csv.spec.ts::[CI] more than 2,000 data rows refuses the file whole (both formats); 2,000 is accepted |
| S4-T03 | AC-ADM-C05.1 | CI | Pass | 2026-11-05 | team-bb/S-3 | bulk-chapter.spec.ts::sets the Bab in place on the eligible rows, with expectedCount = matched, and writes one counts-only audit entry (no new version, status and live version unchanged); bulk-chapter.spec.ts::is live: a bulk run moves the counts at once |
| S4-T03 | AC-ADM-C05.2 | CI | Pass | 2026-11-05 | team-bb/S-3 | bulk-chapter.spec.ts::counts a question of another subject or level as refused and leaves it alone (AC-ADM-C05.2) |
| S4-T03 | AC-ADM-C05.4 | CI | Pass | 2026-11-05 | team-bb/S-3 | bulk-chapter.spec.ts::overwrite=false keeps an existing Bab (AC-ADM-C05.4: 10 selected, 4 with a Bab -> 6 linked, 4 refused); bulk-chapter.spec.ts::overwrite=true replaces an existing Bab (AC-ADM-C05.4: all 10 linked) |
| S6-T06 | AC-GUR-44-1 | CI | Pass | 2026-11-06 | team-dd/S-3 | guru.spec.ts; CiptaPage.test.ts; SumbangSoalanPage.test.ts |
| S6-T06 | AC-GUR-44-2 | CI | Pass | 2026-11-06 | team-dd/S-3 | missions/papers.spec.ts; papers-guru-intake.spec.ts; HantarKertasCard.test.ts |
| S6-T06 | AC-GUR-44-3 | CI | Pass | 2026-11-06 | team-dd/S-3 | HantarKertasCard.test.ts; missions/papers.spec.ts |
| S6-T06 | AC-GUR-44-4 | CI | Pass | 2026-11-06 | team-dd/S-3 | questions-workflow/imports.spec.ts; guru-csv.spec.ts |
| S6-T06 | AC-GUR-44-5 | CI | Pass | 2026-11-06 | team-dd/S-3 | guru.spec.ts |
| S6-T06 | AC-GUR-44-6 | CI | Pass | 2026-11-06 | team-dd/S-3 | DetailEditPages.test.ts; guru-csv.spec.ts |
| S6-T06 | AC-GUR-44-7 | CI | Pass | 2026-11-06 | team-dd/S-3 | smoke-sumbang-soalan-responsive.spec.ts |
| S6-T06 | AC-GUR-44-10 | CI | Pass | 2026-11-06 | team-dd/S-3 | QuestionForm.test.ts; dskp-rule.test.ts; guru.spec.ts |
| S6-T06 | AC-GUR-44-11 | CI | Pass | 2026-11-06 | team-dd/S-3 | guru-csv-old-gate.spec.ts |
| S6-T06 | AC-GUR-44-12 | CI | Pass | 2026-11-06 | team-dd/S-3 | QuestionForm.test.ts; dskp-rule.test.ts |
| S6-T06 | AC-GUR-44-13 | CI | Pass | 2026-11-06 | team-dd/S-3 | guru-csv.spec.ts; SumbangSoalanPage.test.ts; paper-csv-rules.test.ts; guru-handlers.test.ts |
| S6-T06 | AC-GUR-44-14 | CI | Pass | 2026-11-06 | team-dd/S-3 | HantarKertasCard.test.ts; paper-csv-rules.test.ts; guru-handlers.test.ts; missions/papers.spec.ts; papers-guru-intake.spec.ts |
| S4-T03 | AC-ADM-C05.1 | CI | Pass | 2026-11-05 | team-bb/S-3 | bulk-chapter.spec.ts::sets the Bab in place on the eligible rows, with expectedCount = matched, and writes one counts-only audit entry (no new version, status and live version unchanged); bulk-chapter.spec.ts::is live: a bulk run moves the counts at once |
| S4-T03 | AC-ADM-C05.2 | CI | Pass | 2026-11-05 | team-bb/S-3 | bulk-chapter.spec.ts::counts a question of another subject or level as refused and leaves it alone (AC-ADM-C05.2) |
| S4-T03 | AC-ADM-C05.4 | CI | Pass | 2026-11-05 | team-bb/S-3 | bulk-chapter.spec.ts::overwrite=false keeps an existing Bab (AC-ADM-C05.4: 10 selected, 4 with a Bab -> 6 linked, 4 refused); bulk-chapter.spec.ts::overwrite=true replaces an existing Bab (AC-ADM-C05.4: all 10 linked) |
| S1-T05 | AC-QA-34 | CI | Pass | 2026-11-05 | team-aa/S-3 | imports.spec.ts::[CI] the 2,000-row cap is admin-only: the Guru route refuses more than 500 rows with "Fail melebihi 500 baris." for every header, the admin route 2,001 rows with the 2,000 message; imports-csv.spec.ts::[CI] more than 2,000 data rows refuses the file whole (both formats); 2,000 is accepted; imports.spec.ts::[CI] AC-QA-34: 10 questions with 1 invalid: 9 imported, the error CSV has exactly one line |
| S1-T05 | AC-ADM-QE6.1 | CI | Pass | 2026-11-05 | team-aa/S-3 | questions-workflow/imports.spec.ts::[CI] a CSV of one group of 3 yields one group with 3 members in group_order and one stimulus, all drafts, in the same import; questions-workflow/imports-csv.spec.ts::[CI] one group of 3 rows is one group with 3 members in group_order and one stimulus |
| S1-T05 | AC-ADM-QE6.2 | CI | Pass | 2026-11-05 | team-aa/S-3 | questions-workflow/imports.spec.ts::[CI] a row with every DSKP column imports with its unit, SP, TP, aras, chapter and topic and passes the publish gate through the existing approve route |
| S1-T05 | AC-ADM-Q11.1 | CI | Pass | 2026-11-05 | team-aa/S-3 | questions-workflow/imports.spec.ts::[CI] a row with every DSKP column imports with its unit, SP, TP, aras, chapter and topic and passes the publish gate through the existing approve route |

## Sprint 3

| card | AC / AC-CHAIN ID | env | result | date | team/session | evidence ref |
|---|---|---|---|---|---|---|
| S1-T06 | AC-ADM-QE7.1 | CI | Pass | 2026-11-05 | team-aa/S-3 | builder-placements.spec.ts::[CI] AC-QE7.1: the Jana draw never splits a group: whole or not at all, members contiguous in group order |
| S1-T06 | AC-MUR-QP-6 | CI | Pass | 2026-11-05 | team-aa/S-3 | kuiz-whole-groups.spec.ts::[CI] AC-QP-6: a whole group is served together, contiguous and in group order |
| S8-T03 | AC-QA-18 | CI | Pass | 2026-11-05 | team-aa/S-3 | sanitize.test.ts::keeps allowed tags; render-markup.test.ts::sanitises before expanding |
| S5-T02 | AC-MUR-9-4 | CI | Pass | 2026-11-06 | team-bb/S-1 | chapter-pages.test.ts::a pupil whose own form has no chapter question sees the data-empty state (AC-MUR-9-4) |
| S5-T02 | AC-MUR-9-10 | CI | Pass | 2026-11-06 | team-bb/S-1 | chapter-pages.test.ts::AC-MUR-9-10: 7 servable questions enable only "5 soalan"; the others carry the title |
| S4-T07 | AC-ADM-C01.1 | CI | Pass | 2026-11-05 | team-bb/S-3 | CurriculumBrowserPage.test.ts |
| S5-T07 | AC-MUR-12-1 | CI | Pass | 2026-11-05 | team-dd/S-2 | remedial.spec.ts, pages.test.ts |
| S5-T07 | AC-MUR-12-2 | CI | Pass | 2026-11-05 | team-dd/S-2 | remedial.spec.ts, pages.test.ts |
| S5-T07 | AC-MUR-12-3 | CI | Pass | 2026-11-05 | team-dd/S-2 | remedial.spec.ts, pages.test.ts |
| S5-T07 | AC-MUR-12-4 | CI | Pass | 2026-11-05 | team-dd/S-2 | qa-g5-guards-responsive.spec.ts |
| S5-T07 | AC-MUR-12-5 | CI | Pass | 2026-11-05 | team-dd/S-2 | remedial.spec.ts |
| S5-T07 | AC-MUR-12-6 | CI | Pass | 2026-11-05 | team-dd/S-2 | remedial.spec.ts |
| S2-T09 | AC-ADM-Q19.1 | CI | Pass | 2026-11-06 | team-dd/S-5 | source-papers.spec.ts |
| S6-T08 | AC-GUR-10-1 | CI | Pass | 2026-11-06 | team-dd/S-2 | monitoring/pages.test.ts; monitoring/route-ids.test.ts |
| S6-T08 | AC-GUR-10-2 | CI | Pass | 2026-11-06 | team-dd/S-2 | analytics/monitoring.spec.ts |
| S6-T08 | AC-GUR-10-3 | CI | Pass | 2026-11-06 | team-dd/S-2 | analytics/monitoring.spec.ts; teacher-report-scope.spec.ts; monitoring/route-ids.test.ts |
| S6-T08 | AC-GUR-10-4 | CI | Pass | 2026-11-06 | team-dd/S-2 | analytics/monitoring.spec.ts |
| S6-T08 | AC-GUR-10-5 | CI | Pass | 2026-11-06 | team-dd/S-2 | analytics/monitoring.spec.ts; teacher-report-scope.spec.ts |
| S6-T08 | AC-GUR-10-6 | CI | Pass | 2026-11-06 | team-dd/S-2 | monitoring/pages.test.ts |
| S6-T08 | AC-GUR-10-8 | CI | Pass | 2026-11-06 | team-dd/S-2 | analytics/rules.spec.ts; monitoring/logic.test.ts; monitoring/pages.test.ts |
| S6-T08 | AC-AS-10-4 | CI | Pass | 2026-11-06 | team-dd/S-2 | monitoring/pages.test.ts |
| S6-T08 | AC-AS-10-6 | CI | Pass | 2026-11-06 | team-dd/S-2 | monitoring/pages.test.ts |
| S6-T08 | AC-ADM-M03.1 | CI | Pass | 2026-11-06 | team-dd/S-2 | admin-nav.test.ts; admin-shell.test.ts |
| S3-T02 | AC-QA-41 | CI | Pass | 2026-11-06 | team-cc/S-1 | set-builder.spec.ts |
| S3-T02 | AC-ADM-Q13.1 | CI | Pass | 2026-11-06 | team-cc/S-1 | set-builder-landing.test.ts |
| S3-T02 | AC-ADM-Q14.3 | CI | Pass | 2026-11-06 | team-cc/S-1 | set-builder.spec.ts |
| S3-T02 | AC-ADM-Q15.1 | CI | Pass | 2026-11-06 | team-cc/S-1 | builder-page.test.ts; semak-kertas.test.ts |
| S3-T02 | AC-ADM-QE7.4 | CI | Pass | 2026-11-06 | team-cc/S-1 | set-builder.spec.ts |
| S1-T06 | AC-ADM-QE7.2 | CI | Pass | 2026-11-05 | team-aa/S-3 | exam-builder/builder-placements.spec.ts::D90: a stimulus group is one unit > placing ONE member places the whole group, contiguous in group order |

## Sprint 4

| card | AC / AC-CHAIN ID | env | result | date | team/session | evidence ref |
|---|---|---|---|---|---|---|
| S5-T04 | AC-MUR-2-1 | CI | Pass | 2026-11-05 | team-bb/S-4 | DashboardPage.test.ts |
| S5-T05 | AC-MUR-A2-5 | CI | Pass | 2026-11-05 | team-bb/S-4 | profile.spec.ts |
| S5-T08 | AC-GUR-7-5 | CI | Pass | 2026-11-06 | team-bb/S-4 | videos.spec.ts::a teacher link must be a YouTube video link: everything else is 422 "Pautan mesti pautan YouTube yang sah." under videoUrl; VideoPages.test.ts::validates with the contract copy and posts nothing when invalid |
| S5-T08 | AC-GUR-7-6 | CI | Pass | 2026-11-06 | team-bb/S-4 | videos.spec.ts::a teacher of another school cannot see a teacher video; a guest and a pupil of another school cannot either |
| S5-T08 | AC-AS-7-4 | CI | Pass | 2026-11-06 | team-bb/S-4 | videos.spec.ts::a school admin gets 403 on POST, PUT and DELETE; VideoPages.test.ts::"Tambah Video" for school_admin: false |
| S5-T08 | AC-MUR-7-1 | CI | Pass | 2026-11-06 | team-bb/S-4 | VideoPages.test.ts::a pill with count 0 is not a link; others link to ?category |
| S5-T08 | AC-MUR-7-2 | CI | Pass | 2026-11-06 | team-bb/S-4 | VideoPages.test.ts::shows the empty state with "Lihat Semua Video" |
| S5-T08 | AC-MUR-7-5 | CI | Pass | 2026-11-06 | team-bb/S-4 | videos.spec.ts::a page holds 24 cards, newest first; meta follows the mock; a bad or too large page is not an error; VideoPages.test.ts::submitting the search pushes ?search and keeps the filters |
| S5-T04 | AC-MUR-2-3 | CI | Pass | 2026-11-06 | team-bb/S-4 | DashboardPage.test.ts::shows HomePakej for a package and hides it for null (FR-MUR-2-4); overview.spec.ts::package: null for a pupil with no complimentary package and no live school subscription |
| S5-T04 | AC-MUR-2-8 | CI | Pass | 2026-11-06 | team-bb/S-4 | HomeMood.test.ts::asks "Bagaimana perasaan anda hari ini?" with the four labelled choices; HomeMood.test.ts::after a reload with a stored choice, shows "✓ Sedih" and offers no choices; mood.spec.ts::reads null before a check-in, then records the first choice and reads it back (AC-MUR-2-8) |
| S5-T04 | AC-MUR-2-9 | CI | Pass | 2026-11-06 | team-bb/S-4 | DashboardPage.test.ts::Ketepatan shows "—" for null accuracy, without a count-up (AC-MUR-2-9); overview.spec.ts::accuracyPct is null with 0 answers (FR-MUR-2-13) |
| S5-T04 | AC-MUR-2-10 | CI | Pass | 2026-11-06 | team-bb/S-4 | mood.spec.ts::a second submit the same day is 409 ALREADY_CHECKED_IN and the row is unchanged (AC-MUR-2-10) |
| S5-T04 | AC-MUR-2-11 | CI | Pass | 2026-11-06 | team-bb/S-4 | mood-command-center.spec.ts::Guru Command Center "Mood Pelajar" counts 1 for Tertekan; mood-command-center.spec.ts::the Mood Pelajar drill lists the pupil; mood-command-center.spec.ts::the Admin Sekolah "Aktiviti Harian" mood panel counts it for the school; mood-command-center.spec.ts::and no other school |
| S5-T04 | AC-MUR-2-12 | CI | Pass | 2026-11-06 | team-bb/S-4 | mood.spec.ts::answers 401 without a session and 403 for every other role (AC-MUR-2-12) |
| S10-T06 | FR-X2-0 | CI | Pass | 2026-11-05 | team-dd/R-1 | check-http-build.test.mjs |
| S4-T06 | AC-X3-1 | CI | Pass | 2026-11-06 | team-bb/S-3 | bab-mode-t1.spec.ts; offered-levels-serving.spec.ts; offered-levels.spec.ts |
| S10-T01 | AC-MUR-4-2 | CI | Pass | 2026-11-05 | team-bb/S-2 | student-headcount-block.spec.ts |
| S10-T04 | AC-MUR-5-1 | CI | Pass | 2026-11-06 | team-bb/S-2 | unit/analitik-pelajar.spec.ts + http/analitik-pelajar-sp-real.spec.ts (real SP adapter; UAT: 0 SP tags, #924) |
| S10-T04 | AC-MUR-5-2 | CI | Pass | 2026-11-06 | team-bb/S-2 | analitik-pages.test.ts + http/analitik-pelajar-sp-real.spec.ts (real SP adapter) |
| S10-T04 | AC-MUR-5-3 | CI | Pass | 2026-11-06 | team-bb/S-2 | analitik-pages.test.ts + http/analitik-pelajar-sp-real.spec.ts (real SP adapter) |
| S4-T02 | AC-ADM-C04.1 | CI | Pass | 2026-11-06 | team-bb/S-3 | dskp-load.spec.ts |
| S4-T02 | AC-ADM-C04.3 | CI | Pass | 2026-11-06 | team-bb/S-3 | dskp-report.spec.ts; SubjectDskpReportTab.test.ts; nodes-per-in-scope-subject.spec.ts |
| S5-T04 | AC-MUR-2-4 | CI | Pass | 2026-11-06 | team-bb/S-4 | dashboard-prestasi-parity.spec.ts |
| S5-T08 | AC-AS-7-1 | CI | Pass | 2026-11-06 | team-bb/S-4 | VideoPages.test.ts::school_admin picks a category, only its videos show, no "Tambah Video"; videos.spec.ts::AC-GUR-7-1 / AC-AS-7-1 |
| S5-T08 | AC-GUR-7-1 | CI | Pass | 2026-11-06 | team-bb/S-4 | VideoPages.test.ts::choosing a category: the pills show 2 and 1, clicking the first lists exactly its 2 videos; videos.spec.ts::AC-GUR-7-1 / AC-AS-7-1 exactly 2 listed, pill counts 2 and 1 |
| S5-T08 | AC-GUR-7-2 | CI | Pass | 2026-11-06 | team-bb/S-4 | videos.spec.ts::AC-GUR-7-2 a teacher saves a video with title, category and valid URL and it is listed under that category; VideoPages.test.ts::teacher adds a video (category sent) |
| S5-T08 | AC-MUR-8-3 | CI | Pass | 2026-11-06 | team-bb/S-4 | kelas-saya.spec.ts::the teacher adds the pupil (PUT /guru/students/:id), then the class is in the pupil's next Kelas Saya, join route 404; KelasSayaPelajarPage.test.ts::no join field or "Sertai" with or without a class |
| S5-T12 | AC-MUR-20-1 | CI | Pass | 2026-11-05 | team-bb/S-4 | ArtikelPages.test.ts |
| S5-T12 | AC-MUR-20-2 | CI | Pass | 2026-11-05 | team-bb/S-4 | articles.spec.ts |
| S5-T12 | AC-MUR-20-3 | CI | Pass | 2026-11-05 | team-bb/S-4 | ArtikelPages.test.ts |
| S5-T12 | AC-MUR-20-4 | CI | Pass | 2026-11-05 | team-bb/S-4 | articles.spec.ts |
| S5-T12 | AC-MUR-24-3 | CI | Pass | 2026-11-05 | team-bb/S-4 | StudentPages.test.ts |
| S5-T12 | AC-MUR-25-3 | CI | Pass | 2026-11-05 | team-bb/S-4 | StudentPages.test.ts |
| S5-T11 | AC-MUR-17-2 | CI | Pass | 2026-11-06 | team-dd/S-2 | structured-answer.test.ts |
| S5-T11 | AC-MUR-26-6 | CI | Pass | 2026-11-06 | team-dd/S-2 | question-set-class.spec.ts |
| S3-T06 | AC-MUR-13-20 | CI | Pass | 2026-11-06 | team-dd/S-5 | bijak-papers/surface.spec.ts; subjektif-mock.test.ts; subjektif-pages.test.ts |
| S3-T06 | AC-MUR-13-21 | CI | Pass | 2026-11-06 | team-dd/S-5 | bijak-attempts/subjektif.spec.ts; subjektif-mock.test.ts; subjektif-pages.test.ts |
| S3-T06 | AC-MUR-13-22 | CI | Pass | 2026-11-06 | team-dd/S-5 | semakan.test.ts; subjektif-mock.test.ts |
| S3-T06 | AC-MUR-13-23 | CI | Pass | 2026-11-06 | team-dd/S-5 | subjektif-pages.test.ts |
| S3-T06 | AC-PA-10 | CI | Pass | 2026-11-06 | team-dd/S-5 | bijak-attempts/subjektif.spec.ts |
| S6-T10 | AC-GUR-8-8 | CI | Pass | 2026-11-06 | team-dd/S-2 | classes.test.ts; pupil-create.unit.spec.ts |
| S6-T10 | AC-GUR-41-1 | CI | Pass | 2026-11-06 | team-dd/S-2 | inactive-pupils.spec.ts; PelajarSayaPage.test.ts |
| S6-T10 | AC-GUR-41-2 | CI | Pass | 2026-11-06 | team-dd/S-2 | PelajarSayaPage.test.ts; pupil-create.unit.spec.ts; pupil-create.spec.ts |
| S6-T10 | AC-GUR-41-3 | CI | Pass | 2026-11-06 | team-dd/S-2 | PelajarSayaPage.test.ts |
| S6-T10 | AC-GUR-41-6 | CI | Pass | 2026-11-06 | team-dd/S-2 | pupil-create.unit.spec.ts; PelajarSayaPage.test.ts; pupil-create.spec.ts |
| S6-T10 | AC-GUR-41-7 | CI | Pass | 2026-11-06 | team-dd/S-2 | PelajarSayaPage.test.ts |
| S6-T10 | AC-GUR-42-1 | CI | Pass | 2026-11-06 | team-dd/S-2 | LaporanPage.test.ts |
| S6-T10 | AC-GUR-42-2 | CI | Pass | 2026-11-06 | team-dd/S-2 | LaporanPage.test.ts |
| S6-T10 | AC-GUR-42-3 | CI | Pass | 2026-11-06 | team-dd/S-2 | LaporanPage.test.ts; report-all-modes.spec.ts |
| S6-T10 | AC-GUR-42-6 | CI | Pass | 2026-11-06 | team-dd/S-2 | report-all-modes.spec.ts; analytics/teacher.spec.ts |
| S6-T10 | AC-GUR-42-7 | CI | Pass | 2026-11-06 | team-dd/S-2 | LaporanPage.test.ts |
| S3-T07 | AC-PA-32 | CI | Pass | 2026-11-06 | team-dd/S-3 | bijak-papers/generate.spec.ts; bijak-hub-no-jana.test.ts |
| S3-T07 | AC-MUR-13-29 | CI | Pass | 2026-11-06 | team-dd/S-3 | m06-spm/__tests__/pages/pages.test.ts; spm/hub.spec.ts (six hub entries per FR-MUR-13-1: five cards + Bijak SPM banner, lead ruling) |
| S1-T08 | AC-ADM-Q12.2 | CI | Pass | 2026-11-05 | team-aa/S-3 | papers-guru-intake.spec.ts::201 with a QuestionSetPaper; the admin sees the guru batch; ?source accepts only guru |

## Sprint 5

| card | AC / AC-CHAIN ID | env | result | date | team/session | evidence ref |
|---|---|---|---|---|---|---|
| S6-T16 | AC-GUR-44a-1 | CI | Pass | 2026-11-06 | team-dd/S-3 | classes/personal-questions.spec.ts; teacher-tools schema.test.ts; soalan-rujukan form.test.ts; soalan-rujukan pages.test.ts; personal-questions-handlers.test.ts |
| S6-T16 | AC-GUR-44a-2 | CI | Pass | 2026-11-06 | team-dd/S-3 | classes/personal-questions.spec.ts; soalan-rujukan form.test.ts; soalan-rujukan pages.test.ts; personal-questions-handlers.test.ts |
| S6-T16 | AC-GUR-44a-3 | CI | Pass | 2026-11-06 | team-dd/S-3 | classes/personal-questions.spec.ts; teacher-tools schema.test.ts; soalan-rujukan form.test.ts; soalan-rujukan pages.test.ts; personal-questions-handlers.test.ts |
| S6-T16 | AC-GUR-44a-4 | CI | Pass | 2026-11-06 | team-dd/S-3 | questions/private-exclusion.spec.ts |
| S6-T16 | AC-GUR-44a-5 | CI | Pass | 2026-11-06 | team-dd/S-3 | soalan-rujukan pages.test.ts; personal-questions-handlers.test.ts |
| S6-T16 | AC-GUR-44a-7 | CI | Pass | 2026-11-06 | team-dd/S-3 | classes/personal-questions.spec.ts; teacher-tools schema.test.ts; soalan-rujukan form.test.ts; soalan-rujukan pages.test.ts; personal-questions-handlers.test.ts |
| S6-T16 | AC-GUR-44a-8 | CI | Pass | 2026-11-06 | team-dd/S-3 | teacher-tools schema.test.ts; soalan-rujukan form.test.ts; soalan-rujukan pages.test.ts |
| S6-T16 | AC-GUR-44a-9 | CI | Pass | 2026-11-06 | team-dd/S-3 | classes/personal-questions.spec.ts; soalan-rujukan pages.test.ts; personal-questions-handlers.test.ts |
| S6-T16 | AC-GUR-44a-10 | CI | Pass | 2026-11-06 | team-dd/S-3 | questions/personal-questions-draw.spec.ts |
| S6-T18 | AC-GUR-44c-1 | CI | Pass | 2026-11-06 | team-dd/S-3 | questions-workflow/diagram-audit.spec.ts; diagrams-route.test.ts; mock/workflow-admin.test.ts; prototype-scope.test.ts |
| S6-T18 | AC-GUR-44c-2 | CI | Pass | 2026-11-06 | team-dd/S-3 | questions-workflow/diagram-audit.spec.ts; mock/workflow-admin.test.ts |
| S6-T18 | AC-GUR-44c-3 | CI | Pass | 2026-11-06 | team-dd/S-3 | intake-workflow/diagram-upload.spec.ts |
| S6-T18 | AC-GUR-44c-4 | CI | Pass | 2026-11-06 | team-dd/S-3 | questions-workflow/diagram-audit.spec.ts; DiagramAuditPage.test.ts; mock/workflow-admin.test.ts |
| S6-T18 | AC-GUR-44c-6 | CI | Pass | 2026-11-06 | team-dd/S-3 | questions-workflow/diagram-audit.spec.ts; intake-workflow/diagram-upload.spec.ts; DiagramAuditPage.test.ts; mock/workflow-admin.test.ts |
| S6-T17 | AC-GUR-44b-1 | CI | Pass | 2026-11-06 | team-dd/S-3 | questions/guru-structured.spec.ts; StructuredGuruPages.test.ts; structured-guru.test.ts |
| S6-T17 | AC-GUR-44b-2 | CI | Pass | 2026-11-06 | team-dd/S-3 | questions/guru-structured.spec.ts; StructuredGuruPages.test.ts; structured-guru.test.ts |
| S6-T17 | AC-GUR-44b-3 | CI | Pass | 2026-11-06 | team-dd/S-3 | guru-structured-submit.spec.ts; questions/guru-structured.spec.ts; StructuredGuruPages.test.ts |
| S6-T17 | AC-GUR-44b-4 | CI | Pass | 2026-11-06 | team-dd/S-3 | questions/guru-structured.spec.ts; guru-structured-submit.spec.ts; StructuredGuruPages.test.ts; structured-guru.test.ts |
| S6-T17 | AC-GUR-44b-6 | CI | Pass | 2026-11-06 | team-dd/S-3 | guru-structured-submit.spec.ts; structured-guru.test.ts; structured-submit-mock.test.ts; berstruktur/pages.test.ts |
| S6-T17 | AC-GUR-44b-8 | CI | Pass | 2026-11-06 | team-dd/S-3 | structured-form.test.ts; StructuredSubmitForm.test.ts; structured-submit-mock.test.ts |
| S6-T17 | AC-GUR-44b-9 | CI | Pass | 2026-11-06 | team-dd/S-3 | structured-form.test.ts; StructuredSubmitForm.test.ts |

## Sprint 6

| card | AC / AC-CHAIN ID | env | result | date | team/session | evidence ref |
|---|---|---|---|---|---|---|

## Sprint 7

| card | AC / AC-CHAIN ID | env | result | date | team/session | evidence ref |
|---|---|---|---|---|---|---|
| S5-T13 | AC-MUR-19-1 | CI | Pass | 2026-11-05 | team-dd/S-2 | student.service.spec.ts, http.spec.ts, student-pages.test.ts |
| S5-T13 | AC-MUR-19-2 | CI | Pass | 2026-11-05 | team-dd/S-2 | student.service.spec.ts, student-pages.test.ts, student-s1-s4b.spec.ts |
| S5-T13 | AC-MUR-19-3 | CI | Pass | 2026-11-05 | team-dd/S-2 | student.service.spec.ts, http.spec.ts, student-pages.test.ts |
| S5-T13 | AC-MUR-19-4 | CI | Pass | 2026-11-05 | team-dd/S-2 | student-s1-s4b.spec.ts |
| S5-T13 | AC-MUR-19-5 | CI | Pass | 2026-11-06 | team-dd/S-2 | student.service.spec.ts; http.spec.ts; answer-store-practice-writes.spec.ts |
| S7-T08 | AC-MUR-32-1 | CI | Pass | 2026-11-06 | team-dd/S-1 | m20-marketplace/__tests__/pages/pages.test.ts |
| S7-T08 | AC-MUR-32-2 | CI | Pass | 2026-11-06 | team-dd/S-1 | m20-marketplace/__tests__/pages/pages.test.ts |
| S7-T08 | AC-MUR-32-3 | CI | Pass | 2026-11-06 | team-dd/S-1 | marketplace/product.spec.ts; admin-sellers.spec.ts; m20-marketplace/__tests__/mock/admin.test.ts |
| S7-T08 | AC-ADM-P2-12.2 | CI | Pass | 2026-11-06 | team-dd/S-1 | admin-products.spec.ts; m20-marketplace/__tests__/pages/admin-pages.test.ts; m20-marketplace/__tests__/mock/admin.test.ts |
| S7-T08 | AC-ADM-P2-12.3 | CI | Pass | 2026-11-06 | team-dd/S-1 | admin-products.spec.ts; m20-marketplace/__tests__/pages/admin-pages.test.ts; m20-marketplace/__tests__/mock/admin.test.ts |
| S7-T08 | AC-ADM-P2-12.4 | CI | Pass | 2026-11-06 | team-dd/S-1 | admin-products.spec.ts; m20-marketplace/__tests__/pages/admin-pages.test.ts; packages/contract/src/marketplace/__tests__/admin.test.ts |
| S7-T08 | AC-ADM-P2-13.2 | CI | Pass | 2026-11-06 | team-dd/S-1 | admin-sellers.spec.ts; m20-marketplace/__tests__/pages/admin-pages.test.ts |

## Sprint 8

| card | AC / AC-CHAIN ID | env | result | date | team/session | evidence ref |
|---|---|---|---|---|---|---|
| S5-T14 | AC-AS-A1-1 | CI | Pass | 2026-11-05 | team-dd/S-5 | ProfilePages.test.ts |
| S5-T14 | AC-AS-A1-4 | CI | Pass | 2026-11-05 | team-dd/S-5 | ProfilePages.test.ts |
| S5-T14 | AC-AS-A2-1 | CI | Pass | 2026-11-05 | team-dd/S-5 | TetapanPage.test.ts |
| S5-T14 | AC-AS-A2-3 | CI | Pass | 2026-11-05 | team-dd/S-5 | TetapanPage.test.ts |
| S5-T14 | AC-AS-A2-4 | CI | Pass | 2026-11-05 | team-dd/S-5 | TetapanPage.test.ts |
| S5-T14 | AC-AS-A3-6 | CI | Pass | 2026-11-05 | team-dd/S-5 | PanduanPage.test.ts |

## Sprint 9

| card | AC / AC-CHAIN ID | env | result | date | team/session | evidence ref |
|---|---|---|---|---|---|---|
