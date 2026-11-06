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

## Sprint 5

| card | AC / AC-CHAIN ID | env | result | date | team/session | evidence ref |
|---|---|---|---|---|---|---|

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
