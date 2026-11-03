# R1 developer-readiness audit: can a developer new to V1/V2 build V3 from these documents?

**Auditor:** independent (read-only). **Date:** 2026-11-04. **Branch:** `docs/r1-prd-devplan`.
**Question:** can a developer who has never seen V1/V2 build PrestasiPlus V3 from `docs/prd/r1/*` and `docs/plan/r1-development-plan.md` so that data entered on one side is displayed and processed correctly on every other side?
**Method:** nine end-to-end data flows traced step by step against FR/AC, API (60), entity/DM (50), plan card, naming/enum agreement across documents and with the V3 code (`apps/api`, `packages/contract`), an E2E AC, and downstream aggregate definitions.
**Note on moving documents:** the plan and PRD were being edited while this audit ran (Data/API lines were added to every card, DM-42/43 appeared). Every finding below was re-checked against the text as of the end of the audit. A fresh run of `scripts/r1-trace-check.mjs` on a scratch copy reported: 0 uncovered modules, 0 ownership defects, 2 dangling ids (`API-BIJAK-18`, `API-BIJAK-19`), 1 unresolved URS range (`FR-MUR-4-12`), 2 card-column mismatches (`API-Q-13`, `API-Q-24`).

## Verdict: READY WITH FIXES

The document set is unusually complete: every screen is described in words, every module has FR + AC + card, the stimulus-group rule (1..n, never split) is stated consistently in 40, 10, 20, 30, 50, 60 and the plan, and the trace script now closes the PRD-to-card chain. A developer can build almost every screen. What is **not** yet safe is the **hand-over between sides**: five places where the data entered on one side cannot reach, or would be shown differently on, another side. Those are patches to the documents (text given below), not redesigns.

**Counts:** Blocker 5 · Major 15 · Minor 10 (30 findings).

### Top 10 findings (one line each)
1. **F-01 Blocker** Flow 2: nothing turns an accepted intake batch into a Bijak paper ("Kertas Diimport / Semak & Terbit" has no FR, API, DM or card).
2. **F-02 Blocker** Flows 1-3: Bijak sittings, Databank, Tracking A, Subjektif and Kuiz never reach `practice_answers` (code: reports, heatmap, Kirkpatrick, Command Center read only that table; session modes do not include them), yet FR-MUR-4-5 / 13-21 say they feed Prestasi, Headcount AR and Analisa Item.
3. **F-03 Blocker** Flow 5: the pupil Headcount ACs contradict the teacher rules (`AC-MUR-3-2` OTR2 = 65 vs 66; three different "On Track" rules).
4. **F-04 Blocker** Flow 1: plan card S5-T02 and the Sprint-3 demo still build the 70% chapter lock that D98 and the PRD forbid.
5. **F-05 Blocker** Flow 1: a manually entered question with no Bab never appears in Soalan by Chapter or the Heatmap, and nothing tells the admin; the wizard step calls the DSKP unit "Unit (Bab)"; the CSV has no Bab column.
6. **F-06 Major** `difficultyLevel` (1..5) is mandatory in the live create contract, but the PRD collects TP 1..6 plus a three-label "Kesukaran"; the TP-to-difficulty mapping exists only in code.
7. **F-07 Major** Flow 4: assigning a Set Soalan "to the class" has no field; DM says `classroom_id` is null only for migrated rows, FR says a published set goes to all the teacher's classes; mode named `set` vs `question_set`.
8. **F-08 Major** Flow 4: pupil "Sertai by code" is kept in 10-murid (FR-MUR-8-3) and removed in 20 / API-MUR-04 / API-GUR-04 (OQ-X-3 still open).
9. **F-09 Major** Flow 3: pupil Subjektif / structured practice has no self-mark API or storage (self-mark exists only on `bijak/attempts`).
10. **F-10 Major** Same figure, different number: pupil Ketepatan is an integer (87), XS-5 is 1 decimal; Remedial uses mean-of-sessions, XS-5 pooled; "Soalan Diuji" is mapped to XS-4 (answer rows) although it counts distinct questions.

---

## Flow tables

Status: **OK** = specified and consistent; **GAP** = missing or ambiguous; **CONFLICT** = two documents (or document and code) disagree.

### Flow 1. Admin adds a question (DSKP tags, group of 2-3) -> publish -> pupil drills -> mark -> all reports

| # | Step | FR / AC | API | DM / ENT | Card | Status | Note |
|---|---|---|---|---|---|---|---|
| 1 | Admin picks Tingkatan, Subjek, Bab, SK, SP, aras | FR-ADM-QE3.1, AC-QE3.1, 4.G.5 step 2 | API-Q-03, API-Q-09, API-DSKP-05 | 4.2.1 tag contract (`unit_node_id`, SP nodes, `chapter_id`) | S2-T01, S1-T02 | **CONFLICT** | QE3.1 and AC-QE3.1 call the DSKP unit "Unit (Bab)"; 4.G.5 makes Bab optional and separate. SK is derived (correct). See F-05. |
| 2 | Required difficulty | QE3.1 (TP), Tag step "Kesukaran (Mudah/Sederhana/Sukar)" | API-Q-03 body has `tag.tp`; live contract `baseInput.difficultyLevel` 1..5 is required | `difficulty_tp` only; no difficulty column in 50 | S1-T02 | **CONFLICT** | See F-06. |
| 3 | Stimulus group with 2-3 questions, figure uploaded once | FR-X1-4a/b, QE1.2, QE2.1-2.4, AC-QE2.1, AC-ADM-G5.2 | API-Q-07, API-Q-08 (`POST /stimulus-groups/:id/questions`) | INV-01..10, DM-01..04 | S1-T01, S2-T01 | OK | Minor: QE1.2 says "one stimulus", INV-06 / API-Q-08 allow 1..3 stimuli (F-26). |
| 4 | Completeness panel, review, Terbitkan | QE4.1-4.4, Q-05/06, AC-QE4.1/4.2 | API-Q-05 (`gate-check`), API-Q-06 | DM-19 | S1-T02, S2-T01 | GAP | Plan S1-T02 builds `GET /questions/:id/completeness`, API-Q-05 forbids that route (F-19). Kertas for a drill-only MCQ unclear (F-23). |
| 5 | Servability: "Dilihat murid di", no figure-less item served | Q-06, QE7.3, G7.1-7.3, QP-4/5/7 | API-Q-11, API-Q-12 | DM-05, INV-11, C-2 | S1-T06, S1-T07 | CONFLICT | Q-06 lists six activities (Simulasi, Kuiz, Databank, Latih Tubi, Bab, Permainan); API-Q-11 returns databank, latih_tubi_spm, bab, simulasi_paper, simulasi_kuiz, jana_kertas (F-19). |
| 6 | Appears in Latih Tubi with figure kept with its questions | FR-MUR-16-5, QE7.3/7.4, AC-MUR-16-2, AC-ADM-QE7.3 (E2E) | API-PRAC-01, API-PRAC-04 | DM-03, DM-20, DM-27, C-3 | S1-T06, S5-T03, S4-T06 | OK | Group counted by members; quiz may be shorter than N and says so. |
| 7 | Appears in Soalan by Chapter | FR-MUR-9-1..9-11, AC-MUR-9-1, 9-6 | API-PRAC-05, API-DSKP-09 | DM-17, DM-18 | S5-T02, S4-T03, S2-T08 | **CONFLICT** | Needs `chapter_id` (F-05); plan S5-T02 + Sprint-3 demo build the 70% lock (F-04). |
| 8 | Pupil answers, server marks, rewards | FR-MUR-16-6/7, AC-MUR-16-3/4, 4.4 | API-PRAC-01..03 | `practice_sessions`, `practice_answers`, INV-23 | S5-T03 | GAP | Coin rule: admin `flatCoins` (V2 shows 1) vs constant 2 (F-12). |
| 9 | Pupil Prestasi, Analisa Item, Heatmap, Remedial, Dashboard | FR-MUR-4-*, 6-*, 14-*, 12-*, 2-* | API-RPT-01, API-RPT-05, API-DSKP-08, API-PRAC-06/08 | XS-4/5, C-1..C-6 | S10-T01/T03/T05, S5-T04/T07 | **CONFLICT** | Rounding, mean vs pooled, band thresholds, session modes (F-02, F-10, F-25). |
| 10 | Teacher Prestasi, Analisa Item, Analitik, Laporan, Laporan Mingguan (that class) | FR-GUR-4/5/6/42/43-* | API-RPT-02/04/07, API-GUR-21 | XS-1..6 | S10-T03/T04/T07, S6-T01/T10 | **CONFLICT** | GUR-6-6 maps "Soalan Diuji" to XS-4 (F-10). |
| 11 | Admin Sekolah views | FR-AS-4/5/6/46-53, AC-XS-1..3 | API-RPT-02/04/06, API-AS-* | XS rules, DM-28/29 | S6-T03, S6-T09, S10-T07 | OK | Strong: XS-1..6 with one named query per measure. |
| 12 | Admin Pusat monitoring / reports | R1-ADM-M-03/05/06, FR-ADM-M06.2 | API-RPT-12, API-ADM-* | C-1 | S6-T08, S6-T11 | GAP | Admin screens are not in the XS "screens that must agree" lists (F-10). |
| 13 | One E2E AC proving the whole chain with one record | none | none | none | S9-T01/T03 generic | **GAP** | Only per-step E2E ACs exist (F-18). |

### Flow 2. Admin uploads a paper PDF -> extraction -> review -> publish -> pupil paper attempt -> score -> reports

| # | Step | FR / AC | API | DM / ENT | Card | Status | Note |
|---|---|---|---|---|---|---|---|
| 1 | Upload with Subjek, Tingkatan, Kertas 1..4, Tahun, Negeri, declaration | QE5.1, Q-08, AC-Q08.1 | API-Q-14 | DM-08, DM-09 | S1-T03, S2-T02 | OK | Contract still `'1'..'3'` (DM-08 fixes; ship the contract PR first). |
| 2 | Extraction keeps stimulus groups ("Rajah 3 -> soalan 5-8") | QE5.3/5.4, AC-QE5.1/5.2, AC-Q09.1 | API-Q-15 | `intake_stimuli`, items | S1-T03 | OK | Golden-fixture test specified in S1-T03. |
| 3 | Timeout / error state | Q07.2, AC-Q07.1 | API-Q-14 | n/a | S1-T04 | OK | Needs the worker and OCR on (U-OP-02). |
| 4 | Accept -> draft question with Kertas/Bahagian/tags | QE5.2, AC-QE5.3, Q09.1-09.4 | API-Q-15 | DM-07 | S1-T03 | OK | |
| 5 | Approve questions | QE4, Q-03 | API-Q-06 | | S1-T02 | OK | |
| 6 | **Batch -> draft paper ("Kertas Diimport", "Semak & Terbit")** | Q07.3 + OQ-Q07 only; QE5.2 "keeps printed structure" | **none** | **none** (no batch-to-paper link) | S2-T02 lists the tab only | **GAP** | F-01. |
| 7 | Set Builder / Terbit under a Disahkan contract | Q-13/14/15/16, AC-Q14.2 | API-BIJAK-09, API-BIJAK-10, API-BIJAK-11 | DM-11, DM-21, DM-22, DM-26 | S3-T01, S3-T02, S3-T08 | OK | |
| 8 | Pupil sits paper (group once, sticky, Hantar at 375) | FR-MUR-13-4..15, 13-23, AC-X6-2 | API-BIJAK-01..04 | `exam_attempts`, `attempt_results` | S3-T04, S8-T02..T04 | OK | |
| 9 | Score stored (objective auto-mark, best-N) | FR-MUR-13-8, 13-11, AC-13-3/13-6 | API-BIJAK-04 | `exam_attempts`, `practice_attempt_aggregates` (ENT-PracticeAttemptAggregate) | S3-T04 | OK | |
| 10 | Same downstream reports | FR-MUR-4-5, 13-21 (claim) vs XS-4, OD-7 (exclusion) | none | aggregates only | none | **CONFLICT** | F-02. |

### Flow 3. Bijak SPM: contract, papers, all lanes, Kertas Subjektif, Tracking A -> simulasi -> marking -> reports

| # | Step | FR / AC | API | DM / ENT | Card | Status | Note |
|---|---|---|---|---|---|---|---|
| 1 | Kontrak (blueprint) set up and Disahkan | Q-16, AC-Q16.1-16.3 | API-BIJAK-09, API-DSKP-06 | DM-21, DM-22, INV-15 | S3-T01, S3-T08 | OK | UAT has 0 contracts; U-OP-04 needs approval. |
| 2 | Paper in Set Builder, group as one unit | QE7.1/7.2, AC-QE7.1/7.2 | API-BIJAK-10/11 | DM-26, INV-14 | S3-T02, S1-T06 | OK | |
| 3 | Tracking A set | Q-17, AC-Q17.1-17.3, FR-MUR-13-18 | API-BIJAK-13, API-BIJAK-07 | DM-24, INV-26 | S3-T05 | OK | Attempt storage for Tracking A not defined (F-02). |
| 4 | Kertas Subjektif (papers `surface='subjektif'`) | Q-18, FR-MUR-13-26..30, AC-13-20..23 | API-BIJAK-14; **`API-BIJAK-18` cited but undefined** | DM-23, DM-25 | S3-T06 | GAP | Dangling id (F-21); Q-18.8 "cannot be published without scheme" vs FR-MUR-13-28 fallback text (F-27). |
| 5 | Subjektif lane (structured bank questions) | Q-23, FR-MUR-13-19, AC-Q23.2 | API-PRAC-10 (attempts), no self-mark | `ENT-StructuredAttempt` (no self-mark field listed) | S3-T06, S5-T11 | **GAP** | F-09. |
| 6 | Pupil simulasi, objective auto-mark | FR-MUR-13-6..12 | API-BIJAK-04 | | S3-T04 | OK | |
| 7 | Subjective self-mark, clamp, reward delta | FR-MUR-13-13/14, AC-13-7, 13-22 | API-BIJAK-05 | DM-25 (`graded.selfMarks`) | S3-T06 | OK | Reward rule is well specified. |
| 8 | Results -> teacher / AS reports | FR-MUR-13-21 | none | `practice_attempt_aggregates` | none | **GAP** | F-02. |

### Flow 4. Teacher creates class and pupils -> Kelas Saya -> Set Soalan -> assigned -> pupil answers -> results to teacher

| # | Step | FR / AC | API | DM / ENT | Card | Status | Note |
|---|---|---|---|---|---|---|---|
| 1 | Teacher creates class | FR-GUR-8-2, AC-GUR-8-1/8-2 | API-GUR-02, API-GUR-03 | `classrooms` | S6-T14 | OK | |
| 2 | Teacher adds / creates pupils | FR-GUR-8-3, FR-GUR-41-3, AC-GUR-8-3 | API-GUR-05, API-GUR-06 | `enrolments` (INV-24) | S6-T14, S6-T10 | OK | |
| 3 | Pupil sees Kelas Saya | FR-GUR-8-4, FR-MUR-8-*, AC-MUR-8-2 | API-MUR-04 | `classrooms.join_code` still in DM | S5-T08 | **CONFLICT** | F-08. |
| 4 | Teacher builds Set Soalan from approved questions | FR-GUR-8b-2, AC-GUR-8b-1 | API-GUR-16 | `question_sets`, `question_set_items` | S6-T14 | OK | Partial-group ids not rejected in the API (F-07). |
| 5 | Assign to the class | FR-GUR-8b-3/8b-4 | API-GUR-16 (`/copy`) | `question_sets.classroom_id` | S6-T14 | **GAP** | F-07. |
| 6 | Pupil sees Set Soalan Guru and answers | FR-MUR-26-1..4, AC-MUR-26-1/2 | API-GUR-15, API-PRAC-01 (`question_set`) | `practice_sessions.mode` | S5-T11 | CONFLICT | 10-murid / 20 say mode `set`; API/DM say `question_set` (F-07). |
| 7 | Results return to teacher (Hasil, Penyertaan, Skor Purata) | FR-GUR-8b-5, AC-GUR-8b-3 | API-GUR-16 (`/results`) | | S6-T14 | OK | |
| 8 | Same attempts in class Prestasi / XS | FR-GUR-8b-6 | | | | GAP | Whether `question_set` sessions count in XS-4/Headcount AR is not stated (F-02 mode registry). |

### Flow 5. Headcount: TOV/ETR -> key-in AR -> forecast -> pupil view -> Admin Sekolah read-only

| # | Step | FR / AC | API | DM / ENT | Card | Status | Note |
|---|---|---|---|---|---|---|---|
| 1 | Teacher config / Auto-Setup | FR-GUR-3-1/3-2, AC-GUR-3-1 | API-RPT-09 | `headcount_configs` | S10-T02 | OK | |
| 2 | Teacher sets TOV / ETR per pupil | FR-GUR-3-4, AC-GUR-3-2 | API-RPT-10 (`PUT /:id/tov`) | `headcount_entries` | S10-T02 | OK | OTR arithmetic verified: 53/66/80, 60/80, 50/60/70/80, 48/56/64/72/80. |
| 3 | V2 per-subject card "Simpan Sasaran" (class-level TOV / RS) | GUR-3 "Not in this V2 screen" paragraph | none | **no column / table** | S10-T02 | **GAP** | F-11. |
| 4 | Key-in AR (Manual) / live AR (Auto) | GUR-3 rules, AC-GUR-3-3/3-5/3-10 | API-RPT-10 (`/ar`) | `headcount_entry_marks` | S10-T02 | GAP | Auto AR counts "SPM latih tubi and Tracking A modes" only (F-02, F-03). |
| 5 | Forecast (Unjuran, Keyakinan, grade) | GUR-3 rules | API-RPT-09 | | S10-T02 | OK | Decimal AR vs integer grade bands unspecified (F-28). |
| 6 | Pupil Headcount view | FR-MUR-3-1..8, AC-MUR-3-1..3 | API-RPT-08 | | S10-T02 | **CONFLICT** | F-03. |
| 7 | Admin Sekolah read-only | FR-AS-3-1..5, AC-AS-3-1..3 | API-RPT-09 (school scope), refuse writes | `classrooms.school_id` (DM-29) | S10-T02 | OK | |
| 8 | Same On Track on Prestasi / Dashboard | FR-GUR-3-6, XS-6(d)(f) | | | S10-T07 | CONFLICT | MUR-4 Prestasi uses the third rule (F-03). |

### Flow 6. Teacher Sumbang Soalan -> admin intake review (source=guru) -> bank -> pupils

| # | Step | FR / AC | API | DM / ENT | Card | Status | Note |
|---|---|---|---|---|---|---|---|
| 1 | Single MCQ with Subjek, Tahap, Kesukaran, options | FR-GUR-44-2, AC-GUR-44-1 | API-GUR-18 | question + version | S6-T06 | GAP | No Bab, unit, SP, TP; "Kesukaran" 1-5 stars (F-15). |
| 2 | CSV import | FR-GUR-44-4, AC-GUR-44-4 | API-GUR-19 | | S6-T06 | OK | |
| 3 | PDF paper to admin | FR-GUR-44-3, AC-GUR-44-2/44-8, FR-ADM-Q12.1-12.5 | API-GUR-17, API-Q-14 | `intake_batches.source='guru'` | S1-T08, S6-T06 | OK | The 503 root cause is precise. |
| 4 | Admin sees it (Kiriman Guru) | FR-ADM-Q12.1/12.2, AC-ADM-Q12.1/12.2 | API-Q-14 (`source=guru` filter) | | S1-T08, S2-T02 | OK | |
| 5 | Admin tags and approves; DSKP gate | QE3/QE4, 4.G.1 | API-Q-05/06 | | S1-T02 | GAP | A teacher question has none of the gate fields; status label "Menunggu Semakan" vs `review` (F-15). |
| 6 | Pupil receives it by Bab / drill | | API-PRAC-01/05 | | | GAP | Same Bab rule as F-05. |
| 7 | Teacher stats Jumlah / Diluluskan / Menunggu / Digunakan | FR-GUR-44-1 | API-GUR-09 | | S6-T06 | GAP | "Digunakan = answered by pupils" has no formula or scope (F-15). |
| 8 | Private "Soalan & Rujukan" lane kept separate | FR-GUR-44a-4, AC-44a-4 | API-GUR-24/25 | DM-42 | S6-T16 | OK | Clean separation from the bank. |

### Flow 7. Tiket Bantuan: user creates -> admin sees and replies -> user sees reply and status

| # | Step | FR / AC | API | DM / ENT | Card | Status | Note |
|---|---|---|---|---|---|---|---|
| 1 | Pupil / teacher / AS creates | FR-MUR-A4-2, FR-GUR-A4, FR-AS-A4 | API-SUP-02 `{subject, body}` | `support_tickets` | S7-T10 | CONFLICT | FR-MUR-A4-2 says subject + category + message (F-14). |
| 2 | Admin queue (role label, school, 25 per page, filter) | FR-ADM-P2-20.1/20.3, AC-20.1 | API-SUP-03 | DM-32 (`created_role`, `school_id`) | S7-T09 | OK | |
| 3 | Admin replies, sets status | FR-ADM-P2-20.2 | API-SUP-05 | DM-32 single reply | S7-T09 | GAP | Status after a reply, notification, pupil reply: unspecified or contradicting (F-14). |
| 4 | User sees reply and status | FR-MUR-A4-3, AC-MUR-A4-2 | API-SUP-01 (`adminReply`) | | S7-T10 | CONFLICT | FR-MUR-A4-3 promises a thread and a pupil reply; the API is single reply (F-14). |
| 5 | Contact block | FR-ADM-N07.* | API-SUP-04 | DM-33 | S5-T05 | OK | |

### Flow 8. Admin creates school, subscription/quota, users (AS imports) -> login -> role sees exactly the matrix modules; hidden = 404; scope

| # | Step | FR / AC | API | DM / ENT | Card | Status | Note |
|---|---|---|---|---|---|---|---|
| 1 | School | R1-ADM-U-04, AC-ADM-U04.* | API-ADM-03 | `schools` | S6-T12 | OK | |
| 2 | Subscription / quota | U-09, AC-U09.1 | API-ADM-06 | DM-35 (`student_quota`) | S6-T11 | OK | OD-6 answered T1-T3 packages. |
| 3 | Users (Pelajar, Guru, Admin Sekolah) | U-02, AC-U02.1-02.3 | API-ADM-01 | `users` | S6-T12 | GAP | Password minimum 8 (V2 hint) vs 6 (FR-ADM-U02.4) (F-20). |
| 4 | AS imports pupils; approval by Admin Pusat | FR-AS-51-4, AC-AS-51-3, FR-ADM-U05.1/05.5 | API-AS-06 | | S6-T09 | GAP | Quota rule "refuse or import up to quota" unresolved (E-06); teacher import not specified (F-20). |
| 5 | Login by identifier | AC-X2-1 | API-AUTH-01 | | S5-T10 | OK | `AMBIGUOUS_USERNAME` handled. |
| 6 | Each role sees exactly its matrix modules | FR-X2-3, AC-X2-1, API §3 matrix | | | S0-T06, S5-T10 | OK | The API matrix with ✅ / ⚠️ / ❌ is clear. |
| 7 | Hidden modules are 404 for everyone | FR-X2-2, §1.7 | API-AUTH-16 | `feature_flags` DM-34 | S0-T10 | OK | |
| 8 | Scope = own school / class / pupil | XS-6(a), §1.3, API §3 | | INV-32 | S10-T01..T03 | GAP | `PUT /me` accepts `grade` and `schoolId` for a pupil (F-17). |

### Flow 9. Gamification: correct answers -> coins/XP/tokens -> leaderboard -> Kedai Hadiah -> admin queue -> delivery shown

| # | Step | FR / AC | API | DM / ENT | Card | Status | Note |
|---|---|---|---|---|---|---|---|
| 1 | Coins / XP per correct answer | 4.4, FR-MUR-16-7, AC-MUR-16-4 | API-PRAC-03 | wallet ledger | S5-T03, S7-T04 | **CONFLICT** | F-12. |
| 2 | Convert coins to tokens (tier rate) | FR-MUR-29-1/29-2, AC-MUR-29-1 | API-GAME-07 | tiers | S7-T04 | OK | Floors, debits exactly N used. |
| 3 | Tier / Cabaran | FR-MUR-28-2, 30-* | API-GAME-07 | | S7-T04 | OK | |
| 4 | Leaderboard / Kedudukan | FR-MUR-18-*, 33-* | API-GAME-04/06 | ledger | S7-T06 | GAP | "Syiling" = balance on one tab and earned-in-period on another; "display name" undefined (F-13). |
| 5 | Redeem in Kedai Hadiah | FR-MUR-31-1..5, AC-31-1..3 | API-GAME-08 | `redemptions` | S7-T05 | OK | |
| 6 | Admin queue, paste code, cancel refund | FR-ADM-P2-08.1, AC-P2-08.1/08.2 | API-ADM-15 | | S7-T05 | OK | |
| 7 | Delivery shown to pupil ("Tebusan Saya") | FR-MUR-31-4, AC-P2-08.1 | API-GAME-08 | | S7-T05 | GAP | Pupil statuses and the code field are not listed (F-29). |

---

## Findings

Format: location, problem, **exact fix text** to add. "Edit" = patch the owning document at that place.

### Blockers

**F-01 (Blocker) Flow 2: an accepted paper never becomes a Bijak paper.**
- Where: `30-admin-pusat.md` R1-ADM-Q-07 (FR-ADM-Q07.3, OQ-Q07), QE-05.2, Q-09; `60-api-contract.md` API-Q-14/15; `50-data-model-erd.md` DM-07..DM-09; plan S1-T03, S2-T02.
- Missing: Q07.3 says "`Kertas Diimport` lists draft papers created from a batch" and links `Semak & Terbit` to Q-15, but no FR says how a batch becomes a `papers` row with sections and placements, no endpoint creates it (the intake controller has only extract / review / items / stimuli / accept / reject / duplicate), no DM links a paper to its batch, no card owns it.
- Fix (minimum consistent with D90, QE-05, DM-23):
  - 30, add **FR-ADM-Q07.6** "`Hantar untuk semakan` on a batch whose accepted items are all drafts creates one draft paper per paper code in the batch: `papers` row (`surface='simulasi'`, subject, Tingkatan, Kertas, year, `exam_board`, title from the batch), one `paper_sections` row per printed Bahagian with its rule (`semua` / `pilih N`) copied from the Disahkan contract when it exists, and `paper_placements` for the accepted questions in printed order, each stimulus group placed whole and contiguous (INV-14). The paper is a draft; `Semak & Terbit` (Q-15) publishes it."
  - 30, add **AC-ADM-Q07.3** "Given a batch with sections A (10 items) and B (5 items) of which items 5-8 form a group, when `Hantar untuk semakan` is pressed, then one draft paper with 2 sections and 15 placements exists, items 5-8 are adjacent in one section, and `Kertas Diimport` lists it with Bilangan Soalan 15."
  - 60, add API row **`POST /api/intake/batches/:id/paper`** `{title?}` -> `201 {data: {paperId}}`; `409` when an item is still `pending`; `422` when the placement would split a group. Roles AP. Status Missing-Build. Card S1-T03 (BE) + S2-T02 (UI).
  - 50, add to DM-23's table a nullable `papers.source_batch_id` (FK `intake_batches`, set null) or state "no column: the link is `paper_placements` -> question -> `intake_item.question_id`" and say which.
  - Plan S1-T03: add "creates the draft paper from an accepted batch (API above)".

**F-02 (Blocker) Flows 1-4: Bijak sittings and the SPM lanes do not feed the downstream measures, although the documents say they do.**
- Evidence (code): `apps/api/prisma/migrations/0014_practice_write/migration.sql` allows modes `random, chapter, revision, past_year, latih_tubi, ramalan, mission, remedial, question_set, pksk` only; `reports/analytics`, `reports/kirkpatrick`, `heatmap`, `command-center/board` all read `practice_answers`; Bijak writes `exam_attempts` and `practice_attempt_aggregates` (through `bijak/integration/performance-bijak-aggregate.ts`).
- Evidence (docs): FR-MUR-4-5 ("Databank, Tracking A, Subjektif, Bijak ... the mode list is documented in the API" - it is not), FR-MUR-13-2, FR-MUR-13-21 ("feed Prestasi, Dashboard and Headcount AR"), GUR-3 ("Auto AR counts SPM latih tubi and Tracking A modes"), vs `50` OD-7 / XS-4 ("Bijak not added"). Nowhere is it said which screen reads which source, so a pupil's Prestasi and the teacher's Prestasi for the same pupil can differ.
- Fix:
  - 40, add a new section **X4a "Source registry"**: a table of every session / attempt source (`practice_sessions.mode` values with surface and table, `exam_attempts` kinds simulasi / kuiz / subjektif / tracking_a / databank) with five columns: counts in pupil Prestasi; in Headcount AR; in Analisa Item (per question); in Heatmap / Analitik (per Bab / SP); in XS-4 / XS-5 and Command Center. Where the source is `practice_answers`, say "Y"; where it is aggregates, say "unit only, shown as 'unit'" (OD-7).
  - 60 API-PRAC-01: replace "the mode list is documented in the API" by the list, and add the modes or the tables that Databank, Tracking A and Subjektif use. If they use existing modes, name the mode (for example `past_year` for Databank) and say so in FR-MUR-4-5.
  - Rewrite FR-MUR-4-5 and FR-MUR-13-21 to match the registry (for example: "Bijak sittings appear in Prestasi 'Sesi' as units and in Penguasaan Subjek by the aggregate accuracy; they are not in Analisa Item, Heatmap or XS-4").
  - Add **AC-X4a-1** "Given a pupil with 10 Latih Tubi answers (7 correct) and one Bijak sitting of 40 MCQ marks (30 correct), then pupil Prestasi, teacher Prestasi Kelas and AS Prestasi all show Ketepatan {value per registry}, XS-4 = 10 and the Bijak sitting is listed as 1 unit."
  - Plan: add to S10-T01 and S10-T03 "implements X4a".

**F-03 (Blocker) Flow 5: Headcount numbers and status differ between the pupil, teacher and Prestasi screens.**
- Where: `10-murid.md` R1-MUR-3 (rules + AC-MUR-3-2), R1-MUR-4 FR-MUR-4-6; `20-guru-admin-sekolah.md` R1-GUR-3 (Headcount model), XS-6(f).
- Conflicts:
  1. `AC-MUR-3-2` (TOV 40, RS 80) expects **OTR2 = 65**; MUR-3's own rule (0.66) and `AC-GUR-3-2` give **66** (40 + 40 x 0.66 = 66.4).
  2. "On Track": MUR-3 (and its Prestasi note) = AR >= ETR or AR >= TOV/ETR midpoint; AC-MUR-3-2 = AR >= TOV ("On Track" at AR 60); GUR-3 and XS-6(f) = AR >= OTR_k of the latest checkpoint (AR 60 vs OTR3 80 is "Below"). The same pupil is On Track to himself and Below to the teacher.
  3. AR source: MUR-3 "own attempts in that subject"; GUR-3 "SPM latih tubi and Tracking A modes" (meaning unclear: Latih Tubi? Chapter? Bijak?).
- Fix:
  - 10, `AC-MUR-3-2` replace by: "Given TOV 40, RS 80 and AR 60 (Auto), then OTR1 = 53, OTR2 = 66, OTR3 = ETR = 80, Jurang +40, 'Belum capai sasaran', Keyakinan 'Sederhana', and status 'Below' (AR 60 < OTR3 80; per-checkpoint: OTR1 On Track, OTR2 Below, OTR3 Below)."
  - 10, MUR-3 "Rules" paragraph and MUR-4 FR-MUR-4-6: delete the midpoint rule and write "Status uses the GUR-3 rule (AR >= OTR_k; pupil status = latest checkpoint with an AR); this document does not define a second rule."
  - 20, GUR-3 "AR in Auto mode": replace "(SPM latih tubi and Tracking A modes, M05)" by the list of modes from the X4a registry (F-02), for example "answers in `practice_answers` of this subject from modes latih_tubi, chapter, past_year, question_set, revision, mission, remedial within the config's academic year".
  - 20, GUR-3-3 add the grade band rule for decimals: "A grade band is chosen on the value rounded to a whole number" (F-28).

**F-04 (Blocker) Flow 1: the plan still builds the 70% chapter lock that D98 forbids.**
- Where: `docs/plan/r1-development-plan.md` card **S5-T02** ("Approach: ... 70% rule + copy ... Tests: spec with unlock rule ... V2 shows 15 subjects") and the Sprint-3 demo line ("Soalan by Chapter lists chapters with the 70% rule"). Contradicts FR-MUR-9-2, AC-MUR-9-2, FR-GUR-9-2, D98, 10-murid §4.7 FD-MUR-15. (PRD says 14 subject cards, plan says 15.)
- Fix: S5-T02 Approach -> "subjects and chapters from the Bab mapping; **every chapter open, no lock, no 70% copy** (D98, AC-MUR-9-2); group units shown once; real chapter numbers"; Tests -> "spec: chapter 3 startable with chapter 1 at 0%; page text has no '70%'"; remove "V2 shows 15 subjects". Sprint-3 demo (3) -> "Soalan by Chapter lists chapters, all open, with real counts". Also add to `docs/prd/r1/50` "Corrections to the development plan" list (item 9).

**F-05 (Blocker) Flow 1 and 6: Bab is neither collected as a requirement nor surfaced as a reason, so a correctly tagged question silently never reaches Soalan by Chapter or the Heatmap.**
- Where: `30` QE3.1 and AC-QE3.1 ("Subjek, Tingkatan, Unit, SP, TP, KBAT"; QE3.1 text: "Unit (Bab)"), 4.G.1 (Bab "MAY"), 4.G.5 step 2 (Bab optional), QE-04/Q-06 (Bab not listed), QE6.1 (CSV columns: no Bab), plan S1-T05 (CSV has a `bab` column), `10` FR-MUR-9-1 / FR-MUR-14-3.
- Problem: the pupil surfaces read `question_versions.chapter_id` (D89), the DSKP unit is `unit_node_id` (a different tree, 4.G.3). The user's own sequence "Tingkatan -> Subjek -> Bab -> SK -> SP" mixes both. Nothing in the entry screen, the completeness panel or "Dilihat murid di" says that a question without Bab is invisible in Soalan by Chapter / Heatmap.
- Fix:
  - 30 QE3.1 and AC-QE3.1: replace "Unit (Bab)" by "Unit DSKP (Tajuk / Bab-DSKP)" and add "then `Bab buku teks` (optional, from Kurikulum `chapters`)". Keep 4.G.5 order.
  - 30 QE-04: add a **non-blocking** panel item "Bab belum dipilih - soalan tidak akan muncul dalam Soalan by Chapter dan Heatmap Topik Lemah." (code `NO_CHAPTER`, severity `info`), with a link to the Bab field; it never blocks Terbitkan (D89).
  - 30 Q-06 and 60 API-Q-11: add servability reason for activity `bab`: "Bab belum dipaut - tidak disajikan dalam Soalan by Chapter." and for the Heatmap the same reason.
  - 30 QE6.1: add CSV column `bab_kod` (Bab code or number within subject + Tingkatan; blank allowed) and map the plan's `bab` to it; rename the other plan CSV names to the QE6.1 / DM-10 / API-Q-17 names (F-19).
  - 10 AC-MUR-9-1: add "Given the admin saves a new approved MCQ for Matematik T5 with Bab 'Bab 1' through the Studio wizard (not the bulk tool), then the T5 pupil's Soalan by Chapter shows 1 soalan in Bab 1 on the next load."

### Major

**F-06 (Major) Difficulty: three scales, one mandatory contract field, and the mapping is only in code.**
- Evidence: `packages/contract/src/questions/schema.ts` `baseInput.difficultyLevel` (1..5, required, message "Sila pilih tahap kesukaran."); `apps/api/src/modules/practice/question-bridge/be09-practice-mapping.ts:25` `difficultyOfTp` = `min(5, max(1, TP))`; docs: TP 1..6 on the leaf (4.2.1), admin Tag step "Kesukaran (Mudah/Sederhana/Sukar)" (30 QE-03 / 4.G.1), Latih Tubi five labels derived from TP (FR-MUR-16-3), Guru Set picker "Sains · Tingkatan 4 · star 2" with 1..3, Guru form five stars, Analisa Item tiers by % betul.
- Problem: a wizard built from QE-03 has no field that fills `difficultyLevel`, so `POST /api/questions` returns 422; and no document states how TP becomes the five Latih Tubi labels.
- Fix: 50 4.2.1, add rows: "Kesukaran (Latih Tubi / Databank filter, 5 labels): derived = `min(5, question TP)`, never typed for bank questions; the contract field `difficultyLevel` is set from it at save." and "Teacher/private question: 1..5 stars stored as `difficultyLevel`, TP null until an admin tags". 30 QE-03 / 4.G.1: remove the optional three-label "Kesukaran" from the Tag step (it has no storage) or state it is display of the derived value. 10 FR-MUR-16-3: append "TP 1..5 map to labels 1..5; TP 6 reads as 5 (Sangat Sukar)". 20 GUR-8b: state the star scale is 1..5 (V2 sample shows 1..3). 60 API-Q-03: add `difficultyLevel` to the request or state that the server derives it.

**F-07 (Major) Flow 4: "assign the Set Soalan to the class" has no data path; plus mode name and partial-group gaps.**
- Where: `20` GUR-8b FR-GUR-8b-3/8b-4 and API-GUR-16 rules; `50` `QuestionSet` (`classroom_id` "null only if migrated header", status `draft scheduled published`); `10` FR-MUR-26 / AC-MUR-26-1 (`set` session); `60` API-PRAC-01 mode `question_set`.
- Problems: (a) the create form and `POST /guru/question-sets` have no class; a never-copied published set is "visible to all the teacher's classes" but DM says null `classroom_id` is for migrated rows only; (b) `scheduled` has no FR; (c) `questionIds[]` lets a client send half a group although each item is a unit; (d) the session mode is `set` in 10 / 20 and `question_set` in 60 / DM / code.
- Fix: 20 FR-GUR-8b-3 -> "A set has optional `classroomId`. `null` = visible to the pupils of all the teacher's classes; a value = that class only. `Salin` creates a draft with the chosen `classroomId`." 50 `question_sets`: change the comment to "null = all own classes (also migrated headers)"; drop `scheduled` or add the FR. 60 API-GUR-16: add `classroomId?: Id | null` to the body and "`questionIds` containing part of a stimulus group -> 422 `fields.questionIds` 'Soalan dalam kumpulan rangsangan mesti dipilih bersama.'" 10 AC-MUR-26-1 and 20 GUR-8b data line: replace `set` by `question_set`. Plan S5-T11: its text "another class gets 404" and MUR-26-4 "403": pick 404 (record outside scope, §1.7) and patch AC-MUR-26-2.

**F-08 (Major) Flow 4: whether the pupil can join a class by code.**
- Where: `10` FR-MUR-8-3 / AC-MUR-8-3 / "Action: Keep ... Current gap: none"; `20` GUR-8 "Decision C7" and OQ-X-3 (recommendation: remove); `60` API-MUR-04 (`/kelas-saya/join`), API-GUR-04 (`qr-data`); `50` `classrooms.join_code`.
- Fix: 10 FR-MUR-8-3 -> "There is no pupil 'Sertai' box and no class code: a pupil is in a class only because the teacher or school admin added them (GUR-8, V2)." Delete AC-MUR-8-3; Action -> "Fix" with gap "remove 'Masukkan Kod Kelas' / 'Sertai' (`/kelas-saya/join`)". 60 API-MUR-04: mark `POST /kelas-saya/join` "Exists-Fix: remove". 50 `classrooms.join_code`: add "unused in R1, not displayed; drop later". 20 OQ-X-3: mark closed.

**F-09 (Major) Flow 3: Subjektif lane has no self-mark and no stored attempt that Prestasi can count.**
- Where: `10` FR-MUR-13-19, AC-MUR-13-12, FR-MUR-13-29; `30` Q-23, AC-ADM-Q23.2; `60` API-PRAC-10 (`POST /practice/structured/:id/attempts`: "answers -> attempt result", no self-mark); API-BIJAK-05 (self-mark of `exam_attempts` only); `50` `ENT-StructuredAttempt`.
- Fix: choose one storage and say it. Recommended (smallest): the Subjektif lane starts a Bijak-style attempt, so self-mark and scheme reveal reuse API-BIJAK-05 and DM-25. Text: 60 API-PRAC-10 -> "`POST /api/practice/structured/:id/attempts` creates an `exam_attempts` row of kind `subjektif`; marking, scheme reveal and `POST /api/bijak/attempts/:id/self-mark` apply; the attempt appears in Prestasi as a unit (X4a)". Add **AC-MUR-13-12b** "Given a Subjektif part of 4 marks, when the pupil self-marks 3, then the stored `selfMarks` is 3 and the pupil Prestasi session list shows the attempt with 3 / 4." Plan S3-T06/S5-T11: name the route.

**F-10 (Major) FR-X4-1: the same figure gets different numbers.**
- (a) `10` FR-MUR-4-4 / AC-MUR-4-5: Ketepatan "rounded" integer (87) and uses sessions' `questions`; `20` XS-5: 1 decimal over answered. (b) `10` FR-MUR-12-2/12-4 "mean session accuracy" for Remedial and Penguasaan red <60; XS-5 pooled. (c) `20` FR-GUR-6-6 maps **"Soalan Diuji"** (distinct questions, 596 in AC-GUR-6-1) to XS-4 (answer rows). (d) XS lists name only Guru and AS screens; pupil screens and Admin Pusat Laporan / Command Center / Monitoring are not listed although M-06 says "figures agree".
- Fix: 20 XS-5 add "Pupil screens (Prestasi, Penguasaan Subjek, Analisa Item, Remedial card, Analitik) use the same pooled formula; where a screen shows an integer it is the rounding of the 1-decimal value and says so." 10 AC-MUR-4-5 -> "Ketepatan 86.7 (shown 87 only on the hero)"; or change FR-MUR-4-4 to 1 decimal. 10 FR-MUR-12-2 -> "pooled accuracy over the pupil's answers in that subject, minimum 5 answers before a card is shown" [PROPOSED minimum]. 20 add **XS-7 Soalan Diuji** "distinct `question_id` answered by the scope's pupils in the window". Replace GUR-6-6 reference XS-4 by XS-7. Add Admin Pusat Command Center, Laporan, Monitoring, Kirkpatrick to the XS-1..XS-5 "Screens that must agree" cells.

**F-11 (Major) Flow 5: the V2 teacher card "Simpan Sasaran" (TOV and RS per subject) has nowhere to be saved.**
- Where: `20` GUR-3 ("the class-level TOV and RS of the V2 card are the defaults for every pupil"), `50` `HeadcountConfig` / `HeadcountEntry` (per pupil only), `60` API-RPT-10 (`/tov` per pupil), MUR-3 pill "Active (TOV and RS both set) / Draft".
- Fix: 50 add DM-44 "`headcount_configs.default_tov`, `default_etr` numeric(4,1) null: written by `PUT /api/headcounts/:id/defaults`; an entry with null `tov`/`etr` reads the default"; or state that Simpan Sasaran writes TOV / ETR into every entry of the config. 60 add the endpoint. 10 MUR-3: define "Active" as "the pupil's entry has TOV and ETR (own or default)". Plan S10-T02: name the field and endpoint.

**F-12 (Major) Flow 9: coin earning rate has two sources of truth.**
- Where: `10` §4.4, FR-MUR-16-7, AC-MUR-16-4 ("2 Syiling + 10 mata per correct"); `30` P2-09 (V2 admin shows "Syiling flat / soalan betul = 1"; API-ADM-16 `flatCoins`); code `practice/rules.ts` (`MISSION_COINS_PER_CORRECT = 3`, wallet credit "comes back from the reward port"). 4.4 lists no rate for `question_set`, `mission`, `remedial`, `revision`, games, PKSK.
- Fix: 10 §4.4 add a table: mode -> Syiling per correct -> XP per correct -> source setting. State "Syiling per correct = `reward-control.flatCoins`, seeded **2**, read by the wallet credit; `Mini-games beri syiling?` default No"; and add AC-ADM-P2-09.2 "Given flatCoins 2, a pupil with 7 of 10 correct earns 14 Syiling; given the admin sets 3, the next session earns 21". Say the V2 display "1" is the V2 data value, not the V3 seed. List mission (code: 3), remedial, set, games explicitly.

**F-13 (Major) Pupil privacy: "display name" is undefined and three documents disagree about what a stranger sees.**
- Where: `10` §4.3 ("pupil name appears only to the pupil and in the class list"), FR-MUR-18-2 (school-wide "Sekitar anda" names), FR-MUR-33-4, FR-MUR-21-6 and FR-MUR-P2-2 ("display name"), FR-MUR-A1-5 (anonymous public profile shows name and school), `60` API-MUR-03 (first name only, `school: null`), API §3 matrix (public profile "first name only"); code `gamification/name-privacy.ts` redacts names beyond scope.
- Fix: 10 §4.3 add "**Display name** = first given name only, plus the first letter of the next name (for example 'Aisyah B.'). It is the only name shown to another pupil on Kelas Saya, Kedudukan, Papan Pendahulu, game rooms and the public profile. Full name is shown only to the pupil, the class teacher, the school admin and Admin Pusat." 10 FR-MUR-A1-5: replace "name, school" by "display name; school only when the viewer is in the same school". 60 API-MUR-03 stays. Add AC "Given a pupil of another school opens a public profile, then no full name and no school".

**F-14 (Major) Flow 7: ticket thread, status and reply semantics contradict.**
- Where: `10` FR-MUR-A4-2 ("subject, category, message"), FR-MUR-A4-3 ("thread shows staff replies and lets the pupil reply while not Ditutup"), AC-MUR-A4-2 ("status changes"), AC-MUR-A4-3 (another pupil's ticket = 403), Action "Keep ... gap none"; `60` API-SUP-02 `{subject, body}`, API-SUP-05 single reply, DM-32, OD-4; `30` P2-20.2.
- Fix: 10 FR-MUR-A4-2 -> "creates a ticket with Subjek and Butiran (no category in R1)"; FR-MUR-A4-3 -> "shows the single admin reply under 'Balasan Sokongan'; the pupil cannot reply (open a new ticket)"; Action -> "Complete", gap "reply display depends on API-SUP-05". 30 P2-20.2 add "Saving a reply sets status `menunggu_balas` unless the admin chose another status in the same save [PROPOSED]; the owner gets an in-app notification 'Tiket anda telah dibalas.' [PROPOSED]." AC-MUR-A4-3 -> 404 (list is own-only, there is no detail route). Add AC-ADM-P2-20.4 "Given the reply is saved, then `GET /api/tiket` for the owner returns `adminReply` and `statusLabel`".

**F-15 (Major) Flow 6: a teacher question cannot pass the admin DSKP gate and its status labels do not map.**
- Where: `20` GUR-44 (form: Subjek, Tahap, Kesukaran, options; status "Menunggu Semakan"; "Digunakan = answered by pupils"), `30` Q-12 FR-ADM-Q12.4 ("Draft/Reviewed"), QE-03/4.G.1 (unit, SP, TP, aras, Kertas required for SPM-bound T4/T5).
- Fix: 20 GUR-44 add "Status words: Menunggu Semakan = `review`; Diluluskan = `approved`; Ditolak = `draft` with a rejection reason shown to the teacher [PROPOSED]." 30 Q-12 add FR-ADM-Q12.6 "A teacher MCQ opens in the Studio wizard with Subjek, Tingkatan, options and key prefilled; the admin completes unit, SP, TP, aras (and Bab) before Terbitkan; Kertas for a drill-only MCQ without a paper placement defaults to the Kertas the admin picks in the wizard [PROPOSED: Kertas 1]." Define "Digunakan" as "distinct pupils who answered the question in `practice_answers`" or "answer rows", and say which.

**F-16 (Major) Plan cards that drift from the PRD (a developer following the card builds the wrong thing).**
- S1-T02 builds `GET /api/questions/:id/completeness`; API-Q-05 / D-API-2 say the existing `gate-check` is the list and no new route is built. Fix S1-T02 Approach: "extend `GET /api/questions/:id/gate-check` `issues[]` with the DSKP-aware items; no `/completeness` route".
- S1-T05 CSV columns (`subjek, tingkatan, bab, sp, tp, aras, kertas, kumpulan_rangsangan, urutan`) differ from QE6.1 / DM-10 / API-Q-17 (subject code, Tingkatan, unit code, SP codes separated by `;`, TP, KBAT, kertas, bahagian, number label, `group_key`, `stimulus_text`, `stimulus_image`). Fix S1-T05: replace the list by "the QE6.1 columns, plus `bab_kod` (F-05)".
- S5-T02 70% (F-04).
- Add all three to 50 "Corrections to the development plan".

**F-17 (Major) Scope hole: a pupil can edit `grade` and `schoolId` through `PUT /api/me`.**
- Where: `60` API-AUTH-09 (request lists `grade`, `schoolId` "ignored for staff roles"), 10 FR-MUR-A2-5 (UI says contact the school).
- Effect: a pupil can move to another school or Tingkatan, changing XS-1, rankings, level gating and the school admin's list (flow 8 "scope is own school").
- Fix: 60 API-AUTH-09 -> "`schoolId` and `grade` are ignored for every role; they change only through admin user edit (`PUT /api/admin/users/:id`) or the school admin pupil edit." Add AC-MUR-A2-6 "Given a pupil sends `schoolId` or `grade` to `PUT /api/me`, then the stored values are unchanged."

**F-18 (Major) No E2E AC proves a whole chain with one record.**
- Only per-step E2E ACs exist (AC-ADM-QE7.3, AC-ADM-Q07.2, Q12.1 ...). S9-T03 is generic.
- Fix: 40, add **X7a Chain tests** with these ACs, and plan card **S9-T06 "Chain tests"** (P0, deps: sprint merged) that implements them as one Playwright spec per chain on the UAT-like dataset:
  - AC-CHAIN-1 "Admin creates a group 'Rajah 3' with 3 questions tagged Sains T4 / unit / SP / TP / aras / Bab 'Bab 2', approves them. T4 pupil: Latih Tubi 10 on Sains serves the 3 together with Rajah 3 once; Soalan by Chapter Bab 2 shows '3 soalan'; pupil answers 2 correct, 1 wrong. Then pupil Prestasi sessions +1, answers +3, Ketepatan 66.7; Analisa Item 'Isyarat Awal' lists the wrong one; Heatmap Bab 2 tile '3 cuba · 67% betul'; teacher (class with that pupil) Prestasi Kelas Soalan Dijawab +3; AS Prestasi same; Admin Pusat Laporan 'Jumlah Aktiviti' +3; wallet +4 Syiling / +20 XP (rate per F-12)."
  - AC-CHAIN-2 .. 9: one per flow in this audit (paper PDF; Bijak lanes; class + Set Soalan; Headcount; Sumbang Soalan; Tiket; school-user lifecycle with 404 / 403 checks; gamification redemption).

**F-19 (Major) Enumerations that differ between documents or between documents and code.**
- "Six activities" of "Dilihat murid di": Q-06 (Simulasi, Kuiz, Databank, Latih Tubi, Soalan by Chapter, Permainan) vs API-Q-11 (databank, latih_tubi_spm, bab, simulasi_paper, simulasi_kuiz, jana_kertas). Fix: pick the API list and add Permainan as `permainan`, or rename Q-06; publish one enum table in 60 §4.5.
- Question status labels: S2-T03 `?status=reviewed` vs contract `review`; teacher "Menunggu Semakan"; TRACKER-style "Pending". Fix: 30 §0 conventions add the status table (draft/review/approved/archived with BM label and filter value).
- Level codes: `T1..T5` in the PRD, `users.grade` 7..11 (XS-1) vs `education_levels.grade` 1..11 in `levels.json`. Fix: 50 §3.1 add "Tingkatan n = `education_levels.grade` 6+n = `users.grade` 6+n".

**F-20 (Major) Flow 8: onboarding rules that two places state differently or leave open.**
- Pupil password: U-02 hint "minimum 8 aksara" (V2) vs FR-ADM-U02.4 "minimum 6 characters (V1)". Fix: one rule, for example "8" (V2 wins as primary); apply to U-03 reset and AS-51 reset.
- Import quota: AC-ADM-U05.1 "refused ... or imports up to the quota (confirm E-06)". Fix: choose "refuse the whole file with 'Kuota penuh! Sila tingkatkan kuota dahulu.' when rows > baki" (DM-35 `student_quota`) and close E-06 as principle.
- Teachers: flow needs "AS imports teachers": 20 AS-52 has "Cipta Pengguna" only. Fix: state "no teacher bulk import in R1; Admin Pusat `Import Pengguna` (U-06) is the bulk path" or add the FR.
- Approval: say whether a teacher created by the school admin is active at once (AC-AS-52-2 implies yes) and a pupil imported is pending (AC-AS-51-3).

### Minor

**F-21 (Minor) Dangling ids and counts.** `API-BIJAK-18` and `API-BIJAK-19` are cited (API-BIJAK-05 note, API-Q-11 row) and never defined: replace by `API-BIJAK-14` / `API-BIJAK-12`. `URS-MUR-10` cites `FR-MUR-4-1..12`: add FR-MUR-4-12 or change to `4-1..11`. `API-Q-13` / `API-Q-24` owner S1-T07 is missing from the Cards column of 60.

**F-22 (Minor) Mastery band thresholds differ per screen with no table**: Prestasi Penguasaan 80 / 60; Heatmap 80 / 50; Analitik 75 / 50; Analisa Item red < 60; Remedial target 60; Guru Analisa Item 70 / 40. Add one table in 40 X4 marking each as "intentional, V2" so no developer unifies them.

**F-23 (Minor) "SPM-bound" and Kertas for a drill-only MCQ**: define `SPM-bound` in 30 4.G.1 as "subject in the SPM catalogue and Tingkatan 4 or 5", and say whether `Kertas` is asked for a flat MCQ with no paper placement (default Kertas 1 is the minimal choice).

**F-24 (Minor) Heatmap action**: 10 MUR-14 says "Keep", API-DSKP-08 / S10-T05 say "Exists-Fix". Also say what happens in a subject where some questions have Bab and others only SP (FR-MUR-14-3 "SP only when no Bab exists" is per subject or per question?). Fix: "per subject: if any approved question of the subject and Tingkatan has a Bab, the Heatmap uses Bab and ignores SP for that subject".

**F-25 (Minor) Analisa Item discrimination**: "Data Tidak Mencukupi" for 3 pupils; the minimum is not stated. Add "fewer than 10 pupils with answers on the question [PROPOSED]".

**F-26 (Minor) Stimulus count per group**: QE1.2 "one stimulus", INV-06 / API-Q-08 `stimulusIds[1..3]`. Add to QE1.2 "A group carries 1 to 3 stimuli (for example a Rajah and a Jadual) shown together once above the members."

**F-27 (Minor) Kertas Subjektif without scheme**: FR-ADM-Q18.8 "cannot be published without a scheme" vs FR-MUR-13-28 "the fallback text shows when the paper has no scheme". Keep Q-18.8 and delete the fallback case, or allow publishing with the flag. Pick one.

**F-28 (Minor) Grade bands and decimals**: GUR-3 bands (A+ 90-100, A 80-89 ...) leave 89.5 undefined. Add "bands apply to the value rounded to a whole number".

**F-29 (Minor) Pupil redemption view**: MUR-31 "Tebusan Saya" statuses and code field not listed. Add "statuses: Menunggu (pending_admin), Dihantar (delivered, shows the code), Dibatalkan (cancelled, tokens refunded)" and the same words in P2-08.

**F-30 (Minor) 403 versus 404 inconsistencies**: GUR-6-1 / AC-GUR-6-5 "another teacher's class = 403" vs §1.7 default 404 (only listed exceptions are 403); AC-MUR-A4-3 403; MUR-26-4 403 vs S5-T11 404. Add the three to the §1.7 exception list or change them to 404. Also mark `stem_duplicated` consistently: FR-ADM-G7.3 says a flagged question is excluded, DM-05 / OD-3 say `stem_duplicated` only renders once.

---

## What is solid (do not rework)

- **Stimulus-group model** end to end: one rule (1..n, whole, contiguous, once) in 40 FR-X1-4a..f, QE-01..08, QP-1..17, DM-01..06, INV-01..14, API-Q-07/08/24, cards S1-T01/T06/T07, S2-T04, S3-T02; ACs with concrete numbers (Rajah 3 -> Q5-8, range 5-7, 3 free slots vs 4).
- **Servability as stored data** (DM-05, INV-11, C-2): the admin indicator and the pupil draw share one predicate; the live defect (id 812791) is a named test case.
- **XS-1..6** definitions with a named query per measure, scope from session, windows named, "no data is not negative" (C-4).
- **Role / scope / 404-vs-403** table (60 §1.7, §3) and FeatureGuard shape (API-AUTH-16).
- **Headcount OTR arithmetic** and the Unjuran / Keyakinan rules in GUR-3 (verified by hand for n = 2..5).
- **Self-mark and Bijak rewards** (FR-MUR-13-13/14, DM-25): clamp, delta only, idempotent.
- **Traceability**: every card now has a Data/API owner line; DM / API ownership defects are 0; the "Corrections to the development plan" list in 50 shows the right discipline (extend it with F-04, F-16).
- **Honest evidence labels**: "Not observed in V2", "[PROPOSED]", Evidence IDs; nothing invented is written as fact.
- **Privacy rules** for real names in docs and seeds are stated and respected in the reviewed text.

## Files read

`docs/prd/r1/00-index, 40-cross-cutting`; `10-murid` (A1, A4, 2-6, 8, 9, 12-14, 16, 18, 26-31, 33, 4.3, 4.4); `20-guru-admin-sekolah` (GUR-3, 6, 8, 8b, 9, 43, 44, 44a, AS-3, 51, 52, section 5); `30-admin-pusat` (4.0 QE-01..08, Q-06..Q-12, Q-17, Q-18, Q-23, 4.G, U-02, U-03, U-05, U-09, M-05, M-06, P2-08, P2-09, P2-20); `50-data-model-erd` (4.1-4.4, 5, 6, 7); `60-api-contract` (1.3, 1.7, 2.1, 2.6-2.12, 2.17.8, 3); `docs/plan/r1-development-plan.md` (4.0, S1, S2, S3, S5, S6, S7, S9, sprint demos); `r1-traceability.md` and a fresh scratch run of `scripts/r1-trace-check.mjs`; code spot checks in `apps/api/src/modules/{practice,bijak,intake,gamification,reports}`, `apps/api/prisma/migrations/0014*`, `packages/contract/src/{questions,practice}`.


---

# Re-audit 2026-11-04

**Scope:** F-01..F-30 re-checked against the current text of 10/20/30/40/50/60/02 and the plan (some alignment edits were still landing). The trace script on a scratch copy now reports: 113 cards, uncovered 0, dangling 0, unknown DM/API 0, DM owned 49/49, API owned 114/114, ownership defects 0, card-column mismatches 0, unresolved URS 0.

## New verdict: READY WITH FIXES (close to READY)

All five original Blockers are closed. No new Blocker. Remaining: 3 Major and 3 Minor items, all small text patches.

## 1. Status of F-01..F-30

| ID | Status | Evidence |
|---|---|---|
| F-01 | CLOSED | FR-ADM-Q07.6, API-Q-25 `POST /intake/batches/:id/paper`, AC-CHAIN-2, S1-T03/S2-T02 |
| F-02 | CLOSED | Single store `practice_answers` (DM-44, FR-MUR-4-5, 13-21), mode registry 50 section 4.7a, 40 X4a, API-PRAC-01 mode list |
| F-03 | CLOSED | HC-SPEC (20 R1-GUR-3, HC-1..HC-6); AC-MUR-3-2 now 53/66/80 with OTR2 "Below"; FR-MUR-3-4 and FR-GUR-3-8 point to it |
| F-04 | CLOSED | S5-T02 and the Sprint-3 demo have no 70% lock (plan row "F-04 ... verified") |
| F-05 | CLOSED (see N-3) | FR-ADM-QE4.5 Bab required at publish, "Tajuk DSKP" term (30 line 26), `bab_kod` CSV column, INV-34, DM 4.2.1 row, AC-CHAIN-1(a) |
| F-06 | CLOSED | difficulty 1..5 stored, TP-to-label table in 40 precision list, QE3.1 "Tahap kesukaran (1 to 5)" |
| F-07 | CLOSED | DM-46 `question_set_classrooms`, API-GUR-16 `classroomIds`, partial-group 422, mode `question_set` in MUR-26 and AC-CHAIN-4 |
| F-08 | CLOSED | FR-MUR-8-3 removes join; API-MUR-04 "remove"; `join_code` left in DM as unused (acceptable) |
| F-09 | CLOSED | DM-44 row: self-mark updates `marks_awarded` of the part row via `POST /bijak/attempts/:id/self-mark`; AC-CHAIN-3 |
| F-10 | CLOSED | XS-5 whole-number pooled, XS-7 "Soalan Diuji", 40 precision table, Skor Purata separate |
| F-11 | CLOSED | DM-49 `headcount_configs.default_tov/default_etr` |
| F-12 | CLOSED (see N-2) | Rate is admin setting `flatCoins`, default 1; 10 section 4.4 table; AC-CHAIN-9 |
| F-13 | CLOSED | Display name = first name (10 section 4.3, FR-MUR-8-2, FR-MUR-A1-5 no school) |
| F-14 | CLOSED | Single reply, status set separately (FR-ADM-P2-20.2, FR-MUR-A4-2/3, AC-MUR-A4-2, AC-CHAIN-7) |
| F-15 | CLOSED | FR-ADM-Q12.6, status words, Digunakan definition in R1-GUR-44 |
| F-16 | CLOSED | S1-T02 reuses `gate-check`; S1-T05 uses QE6.1 columns incl. `bab_kod`; 50 Corrections 9-11 |
| F-17 | CLOSED | API-AUTH-09 ignores `grade`/`schoolId`; AC-CHAIN-8 checks it |
| F-18 | CLOSED | 40 section X9 AC-CHAIN-1..9; plan S9-T06 "owns all nine" |
| F-19 | PARTIAL | Q-06 now follows the API-Q-11 enum. Status-label table and grade mapping not found (N-6) |
| F-20 | CLOSED | Password min 8 (FR-ADM-U02.4, AC-U05.3, AC-MUR-A2-6); whole-file quota refusal (AC-CHAIN-8) |
| F-21 | CLOSED | Trace script clean; FR-MUR-4-12 exists |
| F-22 | CLOSED | 40 X4b band table |
| F-23 | PARTIAL | "SPM-bound" defined; Kertas rule for a drill-only MCQ not found (N-6) |
| F-24 | CLOSED | FR-MUR-14-3 per-subject Bab-else-SP rule |
| F-25 | CLOSED | AC-GUR-6-4 minimum 10 pupils [PROPOSED] |
| F-26 | PARTIAL | No explicit "1 to 3 stimuli" sentence in QE1.2 (N-6) |
| F-27 | CLOSED | FR-MUR-13-28: a paper without scheme cannot be published |
| F-28 | CLOSED | HC-5 rounds to a whole number before the band |
| F-29 | CLOSED | Pupil words Menunggu / Dihantar / Dibatalkan (FR-ADM-P2-08.4) |
| F-30 | PARTIAL | AC-MUR-26-2 now 404, AC-MUR-A4-3 aligned; GUR-6-1 / AC-GUR-6-5 "403" and the 60 section 1.7 exception list not re-checked (N-6) |

## 2. 40 section X9 AC-CHAIN-1..9

Consistent with 10/20/30/50/60 on values, enums and modes:
- **CHAIN-1:** 2 of 3 correct gives Ketepatan 67 (whole number), Heatmap amber (50-79), wallet +2 Syiling +20 XP at rate 1, XS-7 +3. OK.
- **CHAIN-2:** 12/15 gives 80, wallet +12 / +120 XP (rate x marks). Wording "Simulasi/Bijak mode" should read mode `simulasi` (N-5).
- **CHAIN-3:** mode `tracking_a` (75 = 30/40); Subjektif self-mark 3 then 4 updates one row, delta +1 Syiling / +10 XP; consistent with DM-44 and XS-5 (full marks only counts correct). OK.
- **CHAIN-4:** `classroomIds`, 404 for the other class, mode `question_set`, first names only, Skor Purata 80 (4/5). OK.
- **CHAIN-5:** OTR 53/66/80, AR 60 then 80 (16/20); Below then On Track; Keyakinan Sederhana then Tinggi. Matches HC-SPEC and AC-GUR-3-2. OK.
- **CHAIN-6..9:** consistent (Bab required, single-reply ticket, quota 30/31, password 7/8, 120 Syiling at 50:1 gives 2 tokens + 20 Syiling, weekly 28 = 7 + 21, status words). OK.
- **S9-T06** exists (P0, L), says it owns all nine and lists the cards each chain passes through. OK.

## 3. New contradictions and remaining fix text

**N-1 (Major) Does a Bijak Kuiz "Semak" write answers?** 50 section 4.7a registry has mode `kuiz` written "on `POST /bijak/attempts/:id/submit` of a kuiz paper", while per-question "Semak" of Simulasi Kuiz (FR-MUR-13-16, API-BIJAK-06 `kuiz/sessions/:id/check`) was earlier documented as writing no session. Fix: add to 50 section 4.7a and FR-MUR-13-16: "A Kuiz `Semak` check writes no `practice_answers` row; only the final submit/finish of the kuiz session writes one row per checked question (idempotent per session and question)", and name the writing call in API-BIJAK-06.

**N-2 (Major) Misi Harian reward has three rates.** API-GUR-11 `rewardCoins` (teacher-set, default 10), 10 section 4.4 table "Misi = rate x correct", and code `MISSION_COINS_PER_CORRECT = 3` (`practice/rules.ts`). Fix in 10 section 4.4: "Misi Harian: per-answer Syiling = the rate; the mission's `rewardCoins` is paid once when the target is reached; the code constant 3 is removed", plus AC "Given rate 1 and a mission with `rewardCoins` 10 and target 5, 5 correct answers give 5 + 10 Syiling". (Or the reverse; state one.)

**N-3 (Major) Bab gate wording.** FR-ADM-QE4.5 says a question without Bab "cannot be published" unconditionally; INV-34 and DM 4.2.1 say "when the subject and Tingkatan have chapters". T1-T3 subjects with no chapters (C-01.6) would be unpublishable. Fix: add to QE4.5 "when the subject and Tingkatan have at least one Bab; otherwise the Bab item is not listed", and mirror it in AC-CHAIN-1(a).

**N-4 (Minor)** 02-urs URS-MUR-09 and 20 OQ-X-2 still describe the old MUR-3 rules; change to "HC-SPEC".

**N-5 (Minor)** AC-CHAIN-1: say "Sesi Kuiz tile (sessions) = 1". AC-CHAIN-2: write the mode as `simulasi`.

**N-6 (Minor) Residuals of F-19, F-23, F-26, F-30:**
- F-19: add to 30 section 0 the status labels (`draft`=Draf, `review`=Menunggu Semakan, `approved`=Diluluskan, `archived`=Diarkib) and to 50 section 3.1 "Tingkatan n = `education_levels.grade` 6+n = `users.grade` 6+n".
- F-23: 30 4.G.1 add "A flat MCQ with no paper placement takes Kertas 1 unless the admin sets another."
- F-26: 30 QE1.2 add "A group carries 1 to 3 stimuli shown together once above its members."
- F-30: add "another teacher's class in Analisa Item = 403 (AC-GUR-6-5)" to the 60 section 1.7 exception list, or change AC-GUR-6-5 to 404.

## 4. Closure (2026-11-04)

| Item | Status | Fixed in |
|---|---|---|
| N-1 | CLOSED | 10 FR-MUR-13-16 and 4.4; 60 API-BIJAK-06; 50 section 4.7a registry row `kuiz` |
| N-2 | CLOSED | 10 section 4.4 (Misi Harian paragraph with the Fix and file refs); 20 AC-GUR-2b-3 and new AC-GUR-2b-5; 60 API-GUR-11 note; 50 DM-48; plan S6-T07 |
| N-3 | CLOSED | 30 FR-ADM-QE4.5 and 4.G.1 Bab row; 40 AC-CHAIN-1(a) |
| N-4 | CLOSED | 02 URS-MUR-09 (HC-SPEC); 20 OQ-X-2 and R1-GUR-3 pupil view note |
| N-5 | CLOSED | 40 AC-CHAIN-1 (Sesi Kuiz tile) and AC-CHAIN-2 (mode `simulasi`) |
| N-6 / F-19 | CLOSED | 30 section 0 status table (already present); 50 section 3.1 `ENT-User` grade mapping |
| N-6 / F-23 | CLOSED | 30 4.G.1 Kertas row |
| N-6 / F-26 | CLOSED | 30 FR-ADM-QE1.2 |
| N-6 / F-30 | CLOSED | 60 section 1.7 exception list (AC-GUR-6-5 stays 403) |
| OD-6, OD-12 | CLOSED (user, D109) | 50 section 7; 00-index; plan S4-T09 and section 10; 01 DEP-1; 30 OQ-D101, E-16 |

**Checked, no new conflict:** single answer store and mode registry vs API-PRAC-01; HC-SPEC vs MUR-3 / AS-3 / Prestasi; Set Soalan multi-class vs MUR-26, DM-46, API-GUR-16; join-by-code removal across 10/20/60; ticket single reply with status set separately; whole-number pooled accuracy vs XS-5 (Manual-AR exception stated); Bab vs "Tajuk DSKP" terms; coin rate default 1 (10 section 4.4, 30 P2-09.3, 40 precision list, AC-CHAIN-9, AC-MUR-16-4).
