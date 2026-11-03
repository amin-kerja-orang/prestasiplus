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

## Wizard re-verification 2026-11-04

Task T9 (re-verify the question-entry wizard against V2 and against the real SPM paper formats). Independent check of the merged PRD; no PRD file was changed by this task. Every NO below is a GAP with the exact fix text in the register at the end; the Delivery Lead routes the fixes to the owning file.

### Method

- Checklists: `wizard-vs-v2.md` (55 V2 functions V01-V55, split paths B1-B3, M1-M8, m1-m8) and `wizard-vs-exam-format.md` (G-01, G-01b, G-02..G-05, G-07..G-19; there is no G-06) with the per-subject paper structures (BM, BI, Fizik, Matematik, Matematik Tambahan, Sejarah).
- Specs read in full for these items: 30 (QE-01..QE-08, Q-03..Q-05, Q-14..Q-16, Q-25, 4.G), 45 (all of section 3, 4, 7, 8), 46 (sections 2, 3, 7), 50 (DM-50..DM-59, DM-69, DM-70), 60 (API-Q-03..Q-39, API-BIJAK-05/09, section 4.1/4.2), 40 (X11 OPT-MOD-JAWAPAN), 10 (QP rules) and the plan (cards only, read-only, no line numbers cited).
- Rule per item: PASS only if (1) an FR in 30 or 45 states it, (2) an AC tests it, (3) the data shape is in 50 and the API in 60 where data or an API is involved, (4) the pupil side (answering, marking, self-mark, rendering) is in 46 or 10 where relevant, (5) an owning card family exists in the plan, and (6) the documents do not contradict each other on it. Anything else is GAP with the missing piece.
- 30 has no single B/M/m/G table; it tags each FR with the ID in brackets, e.g. `FR-ADM-QE1.6 (B1; FR-QA-01..03)`. I searched every ID in 30 and 45 and used those tags (all 38 IDs have at least one FR; M8 sits in FR-ADM-Q25.1).
- Plan check: the cards named by 45 section 8 / 46 section 7 exist, except that `S1-T09a` / `S1-T09b` are not yet card lines (the plan still has `S1-T09`, P1/M, whose text still says drawing and table_fill stay P2) and no card names R1-ADM-Q-25 (Soalan PKSK). Both are T6 work, listed as W-16; they are not counted against the specification verdicts.
- Count conventions: one row = one checklist item. 'PASS' needs all six conditions; a missing AC alone makes the row GAP (W-14).

### Result summary

- V2 functions: 46 PASS, 9 GAP of 55.
- Split paths B/M/m: 11 PASS, 8 GAP of 19.
- G items: 7 PASS, 12 GAP of 19.
- Total: **64 PASS, 29 GAP of 93**. 17 distinct defects (W-01..W-17) explain all GAPs; all are text or contradiction fixes, none needs a new screen.

### Verdicts

Superseded by run 2 below.

- **V2 parity: NO** (9 V2 rows GAP: V05, V09, V17, V19, V22, V23, V24, V32, V41; fixes W-01, W-02, W-06, W-07, W-13, W-14).
- **Bahasa Melayu: NO** (W-02, W-03, W-07, W-08, W-15).
- **Bahasa Inggeris: NO** (W-02, W-06, W-09, W-11).
- **Fizik: NO** (W-04, W-05, W-07, W-08).
- **Matematik: NO** (W-04, W-05, W-08, W-10, W-12).
- **Matematik Tambahan: NO** (W-04, W-05, W-12).
- **Sejarah: NO** (W-07, W-08, W-12, W-15).

Each verdict turns YES once the listed W-fixes are applied and this section is re-run (no new design is needed).

### Checklist 1: wizard-vs-v2 (55 V2 functions)

| ID | V2 function | FR | AC | DM / API | Pupil side | Verdict (gap) |
|---|---|---|---|---|---|---|
| V01 | Status tiles with counts | FR-ADM-Q03.6 | AC-ADM-Q03.1 | API-Q-01 | n/a | PASS |
| V02 | Filters + Tapis / Set Semula (V3 adds Tingkatan, Bab, DSKP) | FR-ADM-Q03.* (Q-03 filters) | AC-ADM-Q03.4 | API-Q-01 | n/a | PASS |
| V03 | Columns, 90 chars, 25 per page | Q-03 field block | AC-ADM-Q03.1 | API-Q-01 | n/a | PASS |
| V04 | Row actions Pratonton / Edit | Q-03 row 03-16 | AC-ADM-Q04.1 | API-Q-01 | n/a | PASS |
| V05 | Panel row action Sembunyikan (m1) | FR-ADM-Q03.9 | none | API-Q-04 (archive) | n/a | GAP (W-14) |
| V06 | Bank lama link, Cipta baharu | Q-03 regions | AC-ADM-Q03.1 | - | n/a | PASS |
| V07 | Import DOCX (ZIP) (dropped, PDF replaces) | FD-QE-4 | AC-ADM-Q07.1 | API-Q-14 | n/a | PASS |
| V08 | Import BI Kertas 1 modal (dropped) | FD-QE-4; FR-QA-35, FR-QA-37 | AC-QA-35, AC-QA-37 | API-Q-15 | n/a | PASS |
| V09 | Draft-recovery banner Pulihkan / Buang | 45 3.1.1 step 4 | none | browser storage | n/a | GAP (W-14) |
| V10 | Sumber soalan badge | 45 3.1.1 step 2; FR-QA-39 | AC-QA-39 | API-Q-03 | n/a | PASS |
| V11 | Status bar, Belum dipapar, Hantar, Arkib, Terbitkan | FR-ADM-Q04.3, Q04.4 | AC-ADM-Q04.1 | API-Q-05 | n/a | PASS |
| V12 | Tab strip (m2) | FR-ADM-QE2.5; FR-QA-16 | AC-ADM-QE2.4; AC-QA-16 | - | n/a | PASS |
| V13 | Kertas picker | FR-ADM-QE5.2; 45 3.1.3 | AC-ADM-QE5.3 | API-Q-03 (DM-07/08) | n/a | PASS |
| V14 | Bahagian select | 45 3.1.3; FR-ADM-QE5.2 | AC-ADM-QE5.3 | DM-07 | n/a | PASS |
| V15 | Nombor soalan | 45 3.1.3 | AC-ADM-QE5.3 | API-Q-03 numberLabel | n/a | PASS |
| V16 | Teks soalan (stem), placeholder | FR-ADM-QE3.14 (M6); FR-QA-16 | AC-QA-16 | API-Q-03 questionText | stem once: 46 1.5 item 4 | PASS |
| V17 | 15 stimulus kinds -> 7 (M7) | FR-ADM-QE3.21 | none; FD-QE-8 cited but never defined | DM-70 | 46 2.4 Kinds | GAP (W-13) |
| V18 | Kapsyen (pilihan) | FR-ADM-QE2.6; 45 G-03 | AC-QA-10 | DM-50 caption_en | 46 2.4 | PASS |
| V19 | Rich editor toolbar + math dialog | FR-ADM-QE3.16; FR-QA-18; 45 3.1.5 | AC-ADM-QE3.12; AC-QA-18 | sanitiser rule | pupil rendering of u, s, poem, columns, box not specified | GAP (W-07) |
| V20 | MathML static note | 45 3.1.5 | AC-QA-18 | - | 46 2.2 working (maths keyboard) | PASS |
| V21 | Stimulus per question -> group-first | FR-ADM-QE1.2, QE2.1..2.4 | AC-ADM-QE1.1, QE2.1 | DM-02..04; API-Q-07, API-Q-08 | 46 2.4; AC-PA-03 | PASS |
| V22 | Part tree Label, Jenis, Markah, Arahan | 45 3.1.6 L-01..L-05; FR-ADM-QE3.3 | AC-QA-26 | DM-55; API-Q-03 | 46 2.2 | GAP (W-06) |
| V23 | 14 answer modes (m8 typo, V2 14 -> 11 types / 9 modes) | FR-ADM-QE3.2, QE3.8, QE3.24 | AC-QA-26 | DM-69 | 46 2.2 | GAP (W-01) |
| V24 | Had perkataan (M6) | FR-ADM-QE3.12; FR-QA-21 | AC-QA-21 | DM-55 maxWords | counter copy and hard-limit behaviour conflict (45 vs 46) | GAP (W-02) |
| V25 | Jawapan diterima / Isi skema rows | FR-ADM-QE3.9; FR-QA-19 | AC-ADM-QE3.4; AC-QA-19 | DM-54; API-Q-30 | 46 3.3 | PASS |
| V26 | + Sub-bahagian, Buang, + Bahagian utama | 45 3.1.6 top paragraph | AC-QA-26 | - | n/a | PASS |
| V27 | Running Jumlah markah, tick, tiada skema | FR-ADM-QE3.9 chip; 45 3.1.6 | AC-QA-19 | API-Q-30 | n/a | PASS |
| V28 | Bab (real) + DSKP | FR-ADM-QE3.1, QE4.5 | AC-ADM-QE3.1, QE4.4 | API-Q-09 | 46 4.9 | PASS |
| V29 | Topik select | 45 T-fields; 4.G.1 | AC-ADM-QE3.1 | DM-47 | n/a | PASS |
| V30 | Kesukaran (TP + Tahap kesukaran 1-5) | FR-ADM-QE3.7; FR-QA-31 | AC-ADM-QE3.3; AC-QA-31 | DM-47; API-Q-03 | n/a | PASS |
| V31 | Save bar, names missing fields | FR-ADM-QE4.1 | AC-ADM-QE4.1 | API-Q-05 | n/a | PASS |
| V32 | Preview page (SULIT, marks, 0 patah perkataan) | FR-ADM-QE3.23; QE1.x | AC-ADM-QE3.12 | - | preview word-counter copy differs from 46 | GAP (W-02, W-14) |
| V33 | Flash / transition copy | 45 3.1.1 step 6 | AC-ADM-Q04.1 | - | n/a | PASS |
| V34 | Edit sebagai draf | FR-ADM-Q03.3, Q04.5 | AC-ADM-Q24.2 | API-Q-03 | n/a | PASS |
| V35 | Kelompok Item tab | FR-ADM-Q07.x | AC-ADM-Q07.1 | API-Q-14 | n/a | PASS |
| V36 | Kertas Diimport / Semak & Terbit | FR-ADM-Q07.6..7.9; FR-QA-41 | AC-ADM-Q07.3..07.6 | DM-45; API-Q-25 | n/a | PASS |
| V37 | Kiriman Guru tab | FR-ADM-Q12.1..12.6; FR-QA-39 | AC-ADM-Q12.1..12.3; AC-QA-39 | DM-58 | n/a | PASS |
| V38 | Review page Terima / Tolak / Simpan Sunting | FR-ADM-QE5.4, QE5.9, Q09.x | AC-ADM-Q09.1; AC-QA-36 | API-Q-15, API-Q-37 | n/a | PASS |
| V39 | Senarai Soalan, bulk, Luluskan Hasil Tapisan | FR-ADM-Q20.x; FR-QA-47 | AC-ADM-Q20.1; AC-QA-47 | API-Q-04 | n/a | PASS |
| V40 | Import CSV (dead in V2) | FR-ADM-QE6.1..6.4; FR-QA-33, 34 | AC-ADM-QE6.1..6.3; AC-QA-33, 34 | DM-10; API-Q-17 | n/a | PASS |
| V41 | Tabs Kualiti, Laporan | FR-ADM-Q21.1, Q22.x | AC-ADM-Q22.1; Q21 has no AC | API-Q-18, API-Q-20 | n/a | GAP (W-14) |
| V42 | Soalan Berstruktur list | FR-ADM-Q23.1..23.5 | AC-ADM-Q23.1, Q23.2 | - | n/a | PASS |
| V43 | Rubric editor -> Studio K/N/P (dropped) | FR-ADM-Q23.2; FR-QA-19 | AC-ADM-Q23.1 | API-Q-30 | 46 3.3 | PASS |
| V44 | Set Builder landing | FR-ADM-Q13.1..13.5 | AC-ADM-Q13.1, Q13.2 | API-BIJAK-10, API-BIJAK-11 | n/a | PASS |
| V45 | Builder: filters, Tambah, rule, Terbitkan | FR-ADM-Q14.1..14.6, QE7.x | AC-ADM-Q14.1, Q14.2 | API-BIJAK-10 | 46 2.5 | PASS |
| V46 | Panel builder chips (m5) | FR-ADM-Q14.7 | AC-ADM-Q14.3 | - | n/a | PASS |
| V47 | Paper review, Isu import (m5) | FR-ADM-Q15.1..15.6 | AC-ADM-Q15.1..15.4 | API-BIJAK-10 | n/a | PASS |
| V48 | Kontrak Simulasi list/editor | FR-ADM-Q16.1..16.9 | AC-ADM-Q16.1..16.5 | DM-57; API-BIJAK-09 | 46 2.5 rule line | PASS |
| V49 | Tracking A lane + set editor | FR-ADM-Q17.1..17.6 | AC-ADM-Q17.1..17.3 | API-BIJAK-07 | 46 4.5 | PASS |
| V50 | SPM hub, lanes, Quick Edit | FR-ADM-Q01.x, Q02.x, Q24.x | AC-ADM-Q01.1, Q02.1, Q24.1 | API-Q-11 | 46 4.1 | PASS |
| V51 | Kertas Subjektif list | FR-ADM-Q18.1..18.8 | AC-ADM-Q18.1..18.3 | API-BIJAK-14 | 46 4.7 | PASS |
| V52 | Sumber Kertas list + detail | FR-ADM-Q19.1, Q19.2 | AC-ADM-Q19.1 | API-Q-14 | n/a | PASS |
| V53 | PKSK Soalan (M8) | FR-ADM-Q25.1..25.3 | AC-ADM-Q25.1, Q25.2 | API-ADM-18 | 46 4.12 | PASS |
| V54 | Kurikulum / Subjek / Tahap | FR-ADM-C01.x..C03.x | AC-ADM-C01.1, C02.1, C03.1 | API-DSKP-04 | n/a | PASS |
| V55 | Diagram audit (M5) | FR-ADM-QE8.7; FR-QA-15 | AC-ADM-QE8.4; AC-QA-15 | API-Q-21 | n/a | PASS |

### Checklist 1b: split paths B1-B3, M1-M8, m1-m8

| ID | Requirement | FR | AC | DM / API | Pupil side | Verdict (gap) |
|---|---|---|---|---|---|---|
| B1 | Group published and served as one unit | FR-ADM-QE1.6; FR-QA-01..03 | AC-ADM-QE1.3; AC-QA-01..03 | DM-51; API-Q-31, API-Q-04, API-Q-11 | 46 1.5; AC-PA-02 | PASS |
| B2 | Edit a published group via draft copy | FR-ADM-QE1.7, Q05.4; FR-QA-04, 05 | AC-ADM-QE1.4, Q05.2; AC-QA-04, 05 | DM-51; API-Q-32, API-Q-33 | pinned sitting version (46 2.6) | PASS |
| B3 | Regroup of served members, no DSKP gate | FR-ADM-QE8.5, QE8.6; FR-QA-13 | AC-ADM-QE8.3; AC-QA-13 | DM-59; API-Q-24, API-Q-36 | n/a | PASS |
| M1 | Unnumbered references, 2-figure items | FR-ADM-QE5.8; FR-QA-08, 12 | AC-ADM-QE5.4; AC-QA-08, 12 | DM-53; API-Q-35, API-Q-38 | 46 1.5 item 2 | PASS |
| M2 | Group screen fields (Label, alt, Sumber, Bank, buttons) | FR-ADM-QE2.6; 45 G-01..G-09; FR-QA-10 | AC-QA-10 (alt text, bank letter); max-3 stimuli and required Label untested | DM-52; API-Q-07, API-Q-08 | Sumber line not in 46 | GAP (W-14, W-08) |
| M3 | Gate blocks stimulus_missing / figure_only | FR-ADM-QE4.7, QE4.2; FR-QA-11 | AC-ADM-QE4.6; AC-QA-11 | API-Q-05 | 46 1.5 items 1-2 | PASS |
| M4 | CSV group columns | FR-ADM-QE6.4; FR-QA-33 | AC-ADM-QE6.3; AC-QA-33 | DM-10; API-Q-17 | n/a | PASS |
| M5 | Audit Rajah menu entry | FR-ADM-QE8.7; FR-QA-15 | AC-ADM-QE8.4; AC-QA-15 | API-Q-21 | n/a | PASS |
| M6 | Stem field + Had perkataan | FR-ADM-QE3.14, QE3.12; FR-QA-16, 21 | AC-QA-16, AC-QA-21 | DM-55 | counter copy/hard-limit conflict | GAP (W-02) |
| M7 | Stimulus kinds record (7 kinds, code, Box, Audio) | FR-ADM-QE3.21 | none; FD-QE-8 undefined | DM-70 | 46 2.4 Kinds | GAP (W-13) |
| M8 | PKSK Soalan screen | FR-ADM-Q25.1..25.3 | AC-ADM-Q25.1, Q25.2 | API-ADM-18 | 46 4.12 | PASS |
| m1 | Sembunyikan (Panel Studio) | FR-ADM-Q03.9 | none | API-Q-04 | n/a | GAP (W-14) |
| m2 | Tab order, group takes Subjek | FR-ADM-QE2.5, QE2.1 (QE3.1 wording conflicts) | AC-ADM-QE2.4 | - | n/a | GAP (W-17) |
| m3 | Move between groups | FR-ADM-QE2.7; FR-QA-06 | AC-ADM-QE2.3; AC-QA-06 | API-Q-34 | n/a | PASS |
| m4 | Remove member naming a figure; no warning for 1 member | FR-ADM-QE2.7, QE2.4; FR-QA-07 | AC-ADM-QE2.2; AC-QA-07 (delete only; removal confirm untested) | DM-02 | n/a | GAP (W-14) |
| m5 | Chips Disematkan / Tidak disajikan; Isu import | FR-ADM-Q14.7, Q15.5 | AC-ADM-Q14.3, Q15.4 | DM-05 | n/a | PASS |
| m6 | Pilih N over groups | FR-ADM-QE7.5; FR-QA-41 | AC-ADM-QE7.4; AC-QA-41 | DM-57 | 46 2.5 choose-N | PASS |
| m7 | Review semantics Tolak / Terima | FR-ADM-QE5.9; FR-QA-36 | AC-ADM-QE5.5, AC-QA-36 (Terima kumpulan only; Tolak untested) | API-Q-37, API-Q-38 | n/a | GAP (W-14) |
| m8 | 13 vs 14 modes typo; delete-guard text | FR-ADM-QE3.24 | AC-ADM-QE3.13 (guard text only) | DM-02, DM-69 | n/a | GAP (W-01) |

### Checklist 2: wizard-vs-exam-format (G-01..G-19)

| ID | Requirement | FR | AC | DM / API | Pupil side | Verdict (gap) |
|---|---|---|---|---|---|---|
| G-01 | Marking-scheme editor | FR-ADM-QE3.9; FR-QA-19 | AC-ADM-QE3.4; AC-QA-19 | DM-54; API-Q-30 | 46 3.3, 3.4 (ticks, caps, pairs, bonus, paths, count-based) | PASS |
| G-01b | Choose one prompt inside a question | FR-ADM-QE3.12; FR-QA-22 | AC-ADM-QE3.7; AC-QA-22 | DM-55 alternatives | 46 2.2 essay_choice; FR-PA-07 | PASS |
| G-02 | Essay settings: word range, Had keras, Ruang | FR-ADM-QE3.12; FR-QA-21 | AC-ADM-QE3.7; AC-QA-21 | DM-55 | Had keras ON behaviour undefined; copy conflict | GAP (W-02) |
| G-03 | Per-criterion rubric (BI C/CA/O/L) | FR-ADM-QE3.10; FR-QA-20 | AC-ADM-QE3.5; AC-QA-20 | DM-54; API-BIJAK-05 criteria | 46 3.4 item 5; FR-PA-19; AC-PA-19 | PASS |
| G-04 | Part-level stimulus, which Bahan | FR-ADM-QE3.15; FR-QA-09 | AC-ADM-QE3.9; AC-QA-09 | question_parts.stimulus_id | 46 2.4 has no part-level / Bahan n / semua bahan rule | GAP (W-08) |
| G-05 | Rich-text formatting (u, s, poem, columns, box) | FR-ADM-QE3.16; FR-QA-18 | AC-ADM-QE3.12; AC-QA-18 | sanitiser rule | pupil rendering not specified in 46 or 10 | GAP (W-07) |
| G-07 | Bilingual BM+EN | FR-ADM-QE3.11; FR-QA-17 | AC-ADM-QE3.6; AC-QA-17 | DM-50; API-Q-03 | 45/30 say no toggle, 46 FR-PA-04 has a toggle | GAP (W-04) |
| G-08 | Inline gaps | FR-ADM-QE3.17; FR-QA-24 | AC-QA-24 | rule | 46 2.2 cloze row; FR-PA-05; AC-PA-05 | PASS |
| G-09 | Option-bank body, image, distractor | FR-ADM-QE3.18; FR-QA-10 | AC-ADM-QE3.10; AC-QA-10 | DM-52; API shape 4.1 optionBank lacks image/isDistractor/bodyEn | 46 2.2 match_letter; FR-PA-10 | GAP (W-11) |
| G-10 | Section controls (Wajib, marks list, count, label) | FR-ADM-Q16.8, QE7.5; FR-QA-25 | AC-QA-25; AC-ADM-QE7.4 | DM-57; API-BIJAK-09 text silent | 46 2.5 rule line | GAP (W-12) |
| G-11 | Pre-filled answer frame | FR-ADM-QE3.20; FR-QA-28 | AC-QA-28 | DM-55 preFill | 46 has no rendering rule | GAP (W-09) |
| G-12 | Sumber petikan + Rujukan buku teks | FR-ADM-QE3.20; FR-QA-29 | AC-QA-29 | DM-52, DM-56 | 46 3.3 textbook ref ok; Sumber line on stimulus missing | GAP (W-08) |
| G-13 | drawing and table_fill authored and served | FR-ADM-QE3.13; FR-QA-23 | AC-ADM-QE3.8; AC-QA-23 | DM-55; photo route API-BIJAK-04 | 45 mode 8 says no canvas, 46 2.2.2 has Papan Lukisan | GAP (W-05) |
| G-14 | MCQ second accepted option + Nota kunci | FR-ADM-QE3.19; FR-QA-27 | AC-QA-27 | DM-55 acceptedOptions | 46 M-MCQ ignores accepted list | GAP (W-10) |
| G-15 | Dependent parts / ecf | FR-ADM-QE3.20; FR-QA-30 | AC-ADM-QE3.11; AC-QA-30 | DM-55 dependsOnPart | 46 3.2 M-WORK ECF; 3.3 Bergantung pada | PASS |
| G-16 | Kertas 1..4 everywhere | FR-ADM-QE3.22 | none | DM-08; API 4.1 kertas '1'..'4' | 46 hub | GAP (W-14) |
| G-17 | marks_per_question + JSU | FR-ADM-Q16.9; FR-QA-25, 40 | AC-ADM-Q16.5; AC-QA-25, 40 | DM-57; API-Q-39 | n/a | PASS |
| G-18 | Per-mode leaf form | FR-ADM-QE3.8; FR-QA-26 | AC-QA-26 | DM-55 | 46 2.2 | PASS |
| G-19 | Pupil add-ons (bilingual, alternatives, steppers, gaps) | FR-ADM-QE3.23 (admin); FR-PA-04, 05, 07, 19 | AC-PA-04, 05, 19; admin preview parity has no AC | - | 46 2.3, 2.2, 3.4 | GAP (W-14) |

### Per-subject paper structure

#### Bahasa Melayu

| Paper element | Coverage (FR / AC / DM / pupil) | Verdict | Gap |
|---|---|---|---|
| K1 Bahagian A [30] compulsory, one question, 2 e-mail prompts, answer one, 150-200 words, band table | FR-ADM-QE3.12, Q16.8; FR-QA-22, 25; AC-ADM-QE3.7 | PASS | - |
| K1 Bahagian B [70] 4 questions answer one, 350-500 words, passage boxes with Sumber | Pilih N (FR-ADM-Q14.2, QE7.5), G-07 Sumber; FR-QA-41 | GAP | Sumber line on pupil (W-08); word counter (W-02) |
| K1 score-band table with sub-bands x criteria | FR-ADM-QE3.10; FR-QA-19/20; pupil 46 3.4 items 4-5 | PASS | - |
| K2 A [35] / B [35], Q9 summary max 120 words | FR-ADM-Q16.8; FR-QA-21 | GAP | Had keras behaviour (W-02, W-03) |
| K2 underline, struck word, poem two columns, boxed text | FR-ADM-QE3.16 | GAP | pupil rendering (W-07) |
| K2 Bahan 1-3, sub-parts citing a bahan or semua bahan | FR-ADM-QE3.15; FR-QA-09 | GAP | pupil panel rule (W-08) |
| K2 per-question Perhatian rules: copy = 0, minus 1 per spelling/punctuation error | FR-ADM-QE3.9 scheme_rules; DM-54 | GAP | no deduction code for punctuation (W-15) |
| Alternatives accepted, Peristiwa/Huraian pairs, 'Peristiwa lain boleh diterima' | FR-ADM-QE3.9 (@, Pasangan, Nota) | PASS | - |
| Verdict | - | NO | W-02, W-03, W-07, W-08, W-15 |

#### Bahasa Inggeris

| Paper element | Coverage (FR / AC / DM / pupil) | Verdict | Gap |
|---|---|---|---|
| P1 Part 1 MCQ 3 options each with own stimulus | FR-ADM-QE2.4, QE3.2 (2-8), AC-ADM-QE3.2 | PASS | - |
| P1 Part 2 cloze 10 gaps, per-gap options, worked example 0 | FR-ADM-QE3.17; FR-PA-05; AC-PA-05 | GAP | 0-mark example leaf contradicts L-04 min 1 (W-06) |
| P1 Part 3 passage + 8 MCQ | QE1.2, QE2.x | PASS | - |
| P1 Part 4 bank A-H sentences + 2 distractors | FR-ADM-QE3.18; DM-52; AC-ADM-QE3.10 | GAP | API shape 4.1 optionBank lacks image/isDistractor/bodyEn (W-11) |
| P1 Part 5 bank = texts A-F with pictures; Q37-40 summary gaps one word max | FR-ADM-QE3.17/3.18; 46 2.2 cloze | GAP | same (W-11); Maksimum perkataan copy (W-02) |
| P2 Part 1/2 compulsory, Part 3 three questions answer one (OR), numbering continues | FR-ADM-Q16.8, QE7.5; 46 2.5 | PASS | - |
| P2 e-mail frame pre-printed To/Subject, 80 words; 200-250 words | FR-ADM-QE3.20 / 45 L-12 / mode 6 | GAP | pupil rendering of the frame (W-09); word counter (W-02) |
| P2 content points C1..C4 with requires, accepted and not-accepted, minor omission | FR-ADM-QE3.9 (Tidak diterima, Bergantung pada, Nota) | PASS | - |
| P2 language grid C/CA/O/L each /5 = 20 | FR-ADM-QE3.10; FR-QA-20; AC-PA-19 | PASS | - |
| Verdict | - | NO | W-02, W-06, W-09, W-11 |

#### Fizik

| Paper element | Coverage (FR / AC / DM / pupil) | Verdict | Gap |
|---|---|---|---|
| K1 40 MCQ, composite Rajah, options bilingual | FR-ADM-QE3.11; QE2.x | GAP | bilingual rule conflict (W-04) |
| K2 A all / B answer one of two / C one; 20 marks each | FR-ADM-Q16.8, QE7.5; FR-QA-25/41 | PASS | - |
| Formula pages (Bahan rujukan) | FR-ADM-Q15.x; 46 4.2 cover reference sheets | PASS | - |
| Diberi data block, nuclear-equation box | FR-ADM-QE3.16 (Kotak teks); rich text | GAP | pupil rendering of boxes (W-07) |
| Part-level Rajah / Jadual with bilingual headers | FR-ADM-QE3.15; QE3.11 | GAP | W-08, W-04 |
| M1..Mn, Gantian betul, unit, JUMLAH, Ciri/Sebab pairs, S, bonus, Maks 4/10, 'terima sebarang bahan' | FR-ADM-QE3.9; AC-ADM-QE3.4; 46 3.3 | PASS | - |
| Draw / complete on diagram | FR-ADM-QE3.13; 46 2.2.2 | GAP | 45 mode 8 vs 46 contradiction (W-05) |
| Verdict | - | NO | W-04, W-05, W-07, W-08 |

#### Matematik

| Paper element | Coverage (FR / AC / DM / pupil) | Verdict | Gap |
|---|---|---|---|
| K1 40 MCQ bilingual, Rajah per item, options as figures, maths in options | FR-ADM-QE3.11; 45 mode 1 option images; MathML | GAP | W-04 |
| Key accepting two options | FR-ADM-QE3.19; AC-QA-27 | GAP | pupil marking ignores the accepted list (W-10) |
| K2 A [40] all / B all / C answer one of two; marks list 3,3,3,5,4 | FR-ADM-Q16.8, Q16.9; AC-ADM-Q16.5 | GAP | API-BIJAK-09 silent on new section fields (W-12) |
| Draw on printed Rajah / graph, sketch, Venn, shade | FR-ADM-QE3.13; AC-ADM-QE3.8 | GAP | W-05 |
| Complete table, fill blank from two words, Benar/Salah | 45 mode 9, mode 3, mode 1 | PASS | - |
| Different stimuli per sub-part; two tables in a question | FR-ADM-QE3.15; QE1.2 | GAP | pupil rule (W-08) |
| Scheme atau setara, ATAU, Mana-mana, Nota, model drawings | FR-ADM-QE3.9 (Jawapan model with images) | PASS | - |
| Verdict | - | NO | W-04, W-05, W-08, W-10, W-12 |

#### Matematik Tambahan

| Paper element | Coverage (FR / AC / DM / pupil) | Verdict | Gap |
|---|---|---|---|
| K2 A all [50] / B answer three / C answer two | FR-ADM-Q16.8, QE7.5; AC-ADM-QE7.4 | GAP | API-BIJAK-09 silent (W-12) |
| Bilingual prompts and tables | FR-ADM-QE3.11; 45 2.7 | GAP | W-04 |
| Fill table, plot at stated scale, best-fit line, read from own graph | FR-ADM-QE3.13, QE3.20; 45 7.6; AC-QA-30 | GAP | drawing pupil input contradiction (W-05) |
| K1/N1/P1, @, &, //, OR, Alternatif A/B, dilihat, P2,1,0, Mesti tunjuk operasi | FR-ADM-QE3.9; 46 3.3 | PASS | - |
| Table used by (a) and (b) | FR-ADM-QE1.2 | PASS | - |
| Verdict | - | NO | W-04, W-05, W-12 |

#### Sejarah

| Paper element | Coverage (FR / AC / DM / pupil) | Verdict | Gap |
|---|---|---|---|
| K1 40 MCQ, item-level Sumber box, statement-combination | FR-ADM-QE3.16, QE3.20 | GAP | Sumber line + box rendering on pupil (W-07, W-08) |
| Textbook ref per answer 'B3T4 M56', range 'M44-45' | FR-ADM-QE3.20; AC-QA-29; 46 3.3 | PASS | - |
| K2 A [40] all / B [60] answer three of five | FR-ADM-Q16.8 (example text says 'B choose 1 of 3'), QE7.5, AC-ADM-Q14.1 | GAP | wrong example in Q16.8; API-BIJAK-09 silent (W-12) |
| (a) two answer lines i/ii for [2 markah] | 45 mode 3 blank_count | PASS | - |
| Part-level source with URL and date | FR-ADM-QE3.15; 45 7.1 | GAP | pupil rule (W-08) |
| Aras 1-4 bands + content bank + category caps ('kebaikan maksimum 4') | FR-ADM-QE3.10, QE3.9; 45 7.1 note | GAP | rubric content-point groups with caps not specified (W-15) |
| Verdict | - | NO | W-07, W-08, W-12, W-15 |
### Gap register with exact fixes (W-01..W-17)

Next free numbers used below: FR-ADM-QE3.25, AC-ADM-QE2.5, QE3.14..QE3.17, QE5.6, Q03.6, Q04.5, Q05.3, Q21.1 (30); FR-QA-48, 49 and AC-QA-48, 49 (45); FR-PA-35..39 and AC-PA-37..41 (46). Fixes marked "(R1 decision D113)" are new decisions made here (reported as D113-continued).

**W-01 (V23, m8; 30) "14 modes" contradicts the 11 types / 9 modes.** 30 FR-ADM-QE3.24, rows 15-12 and 16-13, the OPT line in the section 4.V option-set list ("OPT-MOD-JAWAPAN (14 modes)"), the Q-16 V2 note ("the 14 modes are replaced by the 8 question types") and the QE-03 row of 4.V still say 14 modes or 8 types, while FR-ADM-QE3.2, QE3.8, 40 OPT-MOD-JAWAPAN and DM-69 say 11 types and 9 modes. Fix: replace FR-ADM-QE3.24 with "FR-ADM-QE3.24 (m8) The answer-mode list of the wizard and of `Mod Jawapan Dijangka` (OPT-MOD-JAWAPAN, 40 X11) has the 9 stored modes `mcq`, `match_letter`, `short_text`, `numeric`, `working`, `essay`, `essay_choice`, `drawing`, `table_fill`; the 14 V2 modes are migrated by FR-ADM-QE3.2 and never offered (the earlier '13 modes' typo is void). The delete-guard text is 'Rangsangan ini masih digunakan oleh {n} soalan.' (DM-02) and the code text `inUse` is retired."; in rows 15-12 and 16-13 and the 4.V option-set line write "(the 9 modes)"; in the Q-16 note write "the 14 V2 modes are replaced by the 11 question types and 9 leaf modes (FR-ADM-QE3.2)"; in the QE-03 4.V row write "11 types / 9 modes".

**W-02 (V24, V32, M6, G-02; 46, 45, 30) Word-counter copy conflict.** 30 AC-ADM-QE3.7, 45 AC-QA-21 and V2 use "patah perkataan"; 46 2.2, 2.2.1, FR-PA-06, AC-PA-05, AC-PA-06 use "perkataan". Decision: follow V2 (R1 decision D113). Fix in 46: in the `essay` row of 2.2 and in 2.2.1 write `{n} patah perkataan` and `{n} / {min}-{max} patah perkataan`; hints `Jawapan terlalu pendek ({n} patah perkataan; minimum {min}).` and `Jawapan melebihi {max} patah perkataan.`; in the cloze row and AC-PA-05 write `Maksimum {n} patah perkataan.`; in AC-PA-06 use the same two hints. Also in 45 AC-QA-21 replace "a `short_text` with `Had perkataan` 1 refuses 2 words" with "a `short_text` with `Had perkataan` 1 and two words typed shows 'Maksimum 1 patah perkataan.' and keeps the text".

**W-03 (G-02; 46) `Had keras` on has no pupil behaviour.** 46 2.2.1 defines only `Had keras` off. Add to 46 section 7.1: "FR-PA-35 Word limits. A word is a whitespace-separated token. With `Had keras` off the range is guidance (2.2.1). With `Had keras` on (essay), the editor accepts no word beyond `max`: typing past it is ignored, a paste is cut at `max` words, and the hint `Had {max} patah perkataan dicapai.` shows; below `min` only the hint shows and Hantar is never blocked. `Had perkataan` of a `short_text` leaf and the inline-gap `Maksimum perkataan` (the same `mode_config.maxWords`) show `Maksimum {n} patah perkataan.`, keep the typed text and do not change marking. (R1 decision D113.) Card S8-T03." and to 7.2: "AC-PA-37 Given an essay with 1 to 120 words and `Had keras` on, when the pupil types 125 words, then the text holds 120 words and the hint 'Had 120 patah perkataan dicapai.' shows; given a paste of 300 words, then 120 are kept; given `Had keras` off, 125 words are kept with 'Jawapan melebihi 120 patah perkataan.'; Hantar works in every case. S8-T03."

**W-04 (G-07; 45, 30) Bilingual toggle contradiction and required-English scope.** 45 2.7 last bullet and FR-QA-17, and 30 FR-ADM-QE3.11 say "no toggle"; 46 2.3, FR-PA-04 and AC-PA-04 define a three-way control. Decision: 46 wins on pupil behaviour (R1 decision D113). Fix: 45 2.7 last bullet becomes "The pupil sees BM above English as printed by default; the three-way control of 46 2.3 (FR-PA-04) can show one language only." In FR-QA-17 and 30 FR-ADM-QE3.11 replace "no toggle" with "stacked by default, with the pupil control of FR-PA-04". Also in FR-ADM-QE3.11 replace the sentence "sending with an empty English value is refused" with "sending is refused with 'Teks English diperlukan untuk soalan dwibahasa.' when the English value of the stem, a leaf prompt, an option, a stimulus body, a bank text or an alternative prompt is empty; caption, instruction and scheme text may stay BM only (as 45 2.7)."

**W-05 (G-13; 45) Drawing and table_fill pupil input contradicts 46.** 45 mode 8 says "There is no freehand canvas in R1" and the pupil draws on paper; 46 2.2.2 (FR-PA-08, AC-PA-16) specifies the Papan Lukisan over the template or a photo. Fix: in 45 3.1.6 mode 8 replace from "Pupil (D-QA-2):" to the end of the paragraph with "Pupil: as 46 2.2.2 (FR-PA-08): the template with the Papan Lukisan, or `Ambil gambar jawapan` / `Muat naik gambar` (<= 5 MB, up to 3 files, the existing `POST /api/bijak/attempts/:id/photos`); after Hantar `Tunjuk Skema Pemarkahan` and the pupil self-marks each point." In mode 9 replace "the cells that match the accepted values are pre-ticked as a suggestion; the pupil confirms or changes each tick (a change replaces the row)" with "the scheme shows the filled grid and the suggestion 'Cadangan automatik: {k} daripada {n} sel sepadan' (46 2.2.3); the leaf stays `belum_dimarkah` until the pupil self-marks with the stepper".

**W-06 (V22, BI P1 Part 2; 45, 30) A worked-example gap has 0 marks but marks are 1..100.** 45 mode 3 and 46 2.2 require a 0-mark example leaf; 45 L-04, 30 row 04-26 and AC messages require >= 1 ("Nilai mata mesti sekurang-kurangnya 1."). Fix: 45 L-04 becomes "`Markah` integer 1..100; 0 only when L-13 is ticked". Add "L-13 | `Contoh (tidak dimarkah)` | checkbox | optional; the leaf has marks 0, no scheme and no key, is shown to the pupil filled and read-only (46 2.2 cloze row), adds nothing to the part total, and is exempt from the scheme-sum check | none". In 30 row 04-26 write "marks 1 to 100 (0 for a leaf with `Contoh (tidak dimarkah)`)". Add to 30: "FR-ADM-QE3.25 (W-06; BI Part 2 worked example) A leaf may be marked `Contoh (tidak dimarkah)`: marks 0, no scheme, filled and read-only for the pupil, not counted in totals or reports." and "AC-ADM-QE3.17 Given a BI cloze with 10 gaps where gap 0 is `Contoh (tidak dimarkah)`, then the question saves with 10 marked leaves, the example shows filled and read-only to the pupil, and `practice_answers` gets no row for it."

**W-07 (G-05, V19; 46) Pupil rendering of rich-text formatting is unspecified.** Add to 46 7.1 "FR-PA-36 The pupil view renders exactly what the admin preview shows: `u` underline, `s` strike-through, `Baris puisi` (line breaks kept, a blank line = stanza gap), `Dua lajur` (two columns from 768 px, one column at 375 px, never a horizontal page scroll), `Kotak teks` (bordered box, text wraps), in stimuli, prompts, options and the scheme. Card S8-T03, S8-T02." and 7.2 "AC-PA-38 Given a BM passage with underline, strike-through, a two-column poem and a boxed source, then at 1280 px the pupil view equals the admin preview, at 375 px the poem is one column with its line breaks kept, and the page has no horizontal scroll. S8-T03."

**W-08 (G-04, G-12, M2; 46) Part-level stimulus, 'Bahan n' and 'Sumber:' have no pupil rule.** Add to 46 2.4 a rule block and in 7.1 "FR-PA-37 A stimulus with `sourceCitation` shows the line 'Sumber: {text}' under it, in the same panel. A leaf with its own `stimulusId` shows that stimulus inside the leaf card under the prompt (at 375 px a collapsible 'Lihat {label}' header). A prompt that cites a stimulus label (for example 'Bahan 2') carries a link that opens that stimulus in the panel; 'semua bahan' opens all stimuli of the group. Card S8-T02." and 7.2 "AC-PA-39 Given a Sejarah question with a source on part (c) only, then (a) and (b) show no source and (c) shows it with its 'Sumber:' line; given a prompt citing 'Bahan 2', then the link opens Bahan 2; given 'semua bahan', then all 3 show. S8-T02."

**W-09 (G-11; 46) Pre-filled answer frame has no pupil rule.** Add to 46 7.1 "FR-PA-38 A leaf with `Templat jawapan (pra-isi)` shows it as a read-only block directly above the answer area (for example the printed To and Subject lines of an e-mail); it is not part of the answer text, not counted in the word count and never marked. (R1 decision D113.) Card S8-T03." and 7.2 "AC-PA-40 Given an essay leaf with a pre-filled e-mail frame and a range of 80 words, then the frame shows above the textarea, 80 typed words count as 80, and the leaf marks ignore the frame. S8-T03."

**W-10 (G-14; 46) M-MCQ ignores the accepted second option.** Fix 46 3.2 M-MCQ: "awarded = marks if the chosen option identity equals the key or is listed in the key's `accepted` list (45 mode 1, `Terima pilihan lain`), else 0." and in 3.5 'What is revealed per kind' for mcq add "'Diterima juga: {label}' and the `Nota kunci` text when the key has accepted options". Add 7.1 "FR-PA-39 An MCQ whose key lists accepted options marks every listed option correct and reveals them with the `Nota kunci`. Card S3-T04, S1-T09a." and 7.2 "AC-PA-41 Given an MCQ with correct A and accepted D, then choosing D is awarded full marks, the reveal shows 'Jawapan: A' and 'Diterima juga: D' with the Nota kunci. S3-T04."

**W-11 (G-09, BI Part 4/5; 60 section 4.1) Shapes lag the DMs.** In 60 4.1: change the `questionType` comment to "11 types (DM-69)"; extend `stimuli[]` with `bodyEn?: RichText | null; captionEn?: string | null` (DM-50); change `optionBank?` to `{ label: 'A'..'H'; body: RichText /* {ms, en?} */; imageId?: Id | null; isDistractor?: boolean }[]` (DM-50, DM-52); add to `QuestionDetail` `language: 'bm'|'en'|'ms+en'; modeConfig?` (per part), `schemeRules?`, `textbookRef?: { bab; tingkatan; mukaSurat; hingga? } | null`, `rejectionReason?: string | null`; add the same optional fields to `QuestionCreateRequest`; and extend `StimulusGroupCreateRequest.optionBank` the same way. Owning card S1-T01 / S1-T09a (as DM-50, DM-52).

**W-12 (G-10, G-17; 60 API-BIJAK-09, 30 Q16.8) Kontrak write shape silent on the new section fields, and a wrong example.** Add to the API-BIJAK-09 row: "`BijakBlueprintAdminCreate` and `BijakBlueprintView` sections gain `label` (free text), `compulsory` (bool, mutually exclusive with `choose`), `marksPerQuestion?: number[]` (DM-57) and `questionCount` on the blueprint; verify checks that a paper's per-question marks equal the list ('Markah soalan {no} tidak sepadan dengan kontrak.'); `GET .../jsu` is API-Q-39. Card S3-T01." In 30 FR-ADM-Q16.8 replace "Sejarah (A all, B choose 1 of 3)" with "Sejarah Kertas 2 (A all, B choose 3 of 5, 20 marks each) and BI Paper 2 (Part 3 choose 1 of 3)".

**W-13 (V17, M7; 30) FD-QE-8 is cited but not defined, and M7 has no AC.** Append to the FD paragraph of 4.0: "FD-QE-8 The V2 15-kind `Jenis rangsangan` select is reduced to the 7 kinds of OPT-JENIS-RANGSANGAN; V2 `Box` becomes `Petikan` with `Kotak teks`, code and pseudocode become `Petikan` with the `</>` block, and `Audio` and `Video` are not offered (V2 had no rows for them)." Add "AC-ADM-QE3.15 Given the stimulus kind select, then it lists exactly Petikan, Rajah, Jadual, Graf, Peta, Carta / Infografik, Imej / Gambar and no Audio or Video; given a Sains Komputer pseudocode, then it is a `Petikan` with the `</>` block shown in monospace and never executed."

**W-14 (missing ACs; 30) Nine rows have an FR and no test.** Add to 30:
- "AC-ADM-Q03.6 (m1) Given the Panel row menu, when `Sembunyikan` is chosen and 'Ya, Sembunyikan' confirmed, then the question becomes `Diarkibkan` with the same audit row as `Arkib`, and a pupil no longer sees it."
- "AC-ADM-Q04.5 (V09) Given unsaved work from an earlier session, when the wizard opens, then the banner 'Terdapat kerja yang belum disimpan daripada sesi sebelum ini.' shows; `Pulihkan` restores every field; `Buang` asks 'Buang kerja yang belum disimpan?' and removes the draft only after 'Ya, Buang'."
- "AC-ADM-Q05.3 (M2) Given a group with 3 stimuli, then `Tambah rangsangan` is disabled with 'Satu kumpulan boleh mempunyai paling banyak 3 rangsangan.'; given a stimulus with an empty Label, then saving shows 'Sila isi label rangsangan.'; given `Pratonton kumpulan`, then the stimuli and members show as the pupil sees them."
- "AC-ADM-Q21.1 (V41) Given the `Kualiti` tab, when `POST /api/question-quality/audit` is run for a scope, then the tab lists the counts computed from the same rows as the Studio list (no figure typed by hand)."
- "AC-ADM-QE2.5 (m4) Given a member whose text names 'Rajah 3', when it is removed from its group, then the confirm 'Soalan ini menyebut {Rajah 3}. Tanpa kumpulan ia tidak akan dipaparkan kepada murid.' shows and, once confirmed, the question carries `stimulus_missing`."
- "AC-ADM-QE5.6 (m7) Given Semak Ekstrak, when `Tolak` is pressed on a stimulus item, then the group is discarded and its member items stay `pending` with `stimulus_missing`; when `Tolak` is pressed on a member, then it leaves the range; when `Terima` is pressed on a member before its group exists, then the group is created from the extracted stimulus first."
- "AC-ADM-QE3.14 (G-16) Given the Kertas filter, the Kontrak form and `GET /api/questions?kertas=4`, then Kertas 1 to 4 are accepted everywhere and `kertas=5` answers 422."
- "AC-ADM-QE3.16 (G-19, admin side) Given a `ms+en` question with an alternative-prompt essay and a BI criteria rubric, then `Pratonton` shows BM above English, the prompt picker, one stepper per criterion and the gaps in place, equal to the pupil screen."

**W-15 (G-01 for BM K2 and Sejarah K2; 45 3.1.7) Two scheme details are not representable.** (a) Deduction codes are only `spelling`, `unit`, `sf`, `dp`, `copy`; BM K2 'minus 1 per spelling or punctuation error' and a grammar rule need more. (b) Sejarah 'kebaikan sahaja, maksimum 4' is a cap over content points inside a `rubric` key, but groups are defined for `points` only. Add to 45 8.2 "FR-QA-48 In key kind `rubric`, the optional content points C1..Cn accept the same group rules as `points` (`Mana-mana N daripada M`, `Markah maksimum kumpulan`); the pupil self-mark applies the cap, and the reveal shows 'Maks {N}'." and "FR-QA-49 Deduction codes are `spelling`, `punctuation`, `grammar`, `unit`, `sf`, `dp`, `copy` and `other` (with a required free `Label`); each has `Jumlah` and an optional `Had`; the OPT-KOD list is added to 40 X11 as OPT-KOD-POTONGAN." with "AC-QA-48 Given a rubric essay with content points Maklumat (6) and Kebaikan (6) and a group cap 'Maks 4' on Kebaikan, then a pupil who ticks 6 Kebaikan points is credited 4 and the reveal shows 'Maks 4'." and "AC-QA-49 Given a question-level deduction `punctuation` of 1 per error with a cap of 5, then 7 errors deduct 5, never below 0, and the reveal lists the rule." Cards S1-T09a, S3-T06, S8-T05 (DM-54 carries them with no schema change).

**W-16 (plan, for T6; not counted in the verdicts).** (a) Create cards `S1-T09a` (scheme editor backend, `mode_config`, MCQ 2..8 and accepted options, word ranges, `essay_choice`, DM-54/DM-55, API-Q-30) and `S1-T09b` (bilingual `ms+en`, drawing/table_fill authoring, DM-50), P0/L, and rewrite the S1-T09 text that still says drawing and table_fill stay P2 and "8/14 widgets". (b) Give R1-ADM-Q-25 (Soalan PKSK, FR-ADM-Q25.1..25.3, API-ADM-18) an owning card (suggested: S2-T06 with Q-20/22/23). (c) Cite FR-QA-* / AC-QA-* / FR-PA-35..39 on their cards when the traceability is regenerated.

**W-17 (m2, QE3.2; 30) Two wording conflicts.** FR-ADM-QE3.1 says the wizard "keeps the V2 tab labels `Kertas`, `Rangsangan`, `Sub-bahagian`, `Tag` but collects data in the DSKP order", while FR-ADM-QE2.5 and FR-QA-16 fix the tab order `1 Tag`, `2 Kertas`, `3 Rangsangan`, `4 Sub-bahagian`; and AC-ADM-QE3.2 says 'exactly one correct tick' while FR-ADM-QE3.19 allows a second accepted option. Fix: in FR-ADM-QE3.1 replace the first clause with "The wizard keeps the V2 tab labels in the order `1 Tag`, `2 Kertas`, `3 Rangsangan`, `4 Sub-bahagian` (FR-ADM-QE2.5), so data is collected in the DSKP order:"; in AC-ADM-QE3.2 replace "exactly one correct tick" with "exactly one correct tick (a second accepted option only through `Terima pilihan lain` with a `Nota kunci`, FR-ADM-QE3.19)".

### Items checked and found sound (no action)

- B1-B3, M1, M3-M5, m3, m5, m6 are specified end to end: FR and AC in 30 (tagged), the FR-QA / AC-QA rows in 45 section 8, DM-51..DM-53 and DM-59 in 50, API-Q-31..Q-38 in 60 with shapes in 2.17.4, the pupil side in 46 1.5 and 2.4 (AC-PA-02, AC-PA-03), and owning cards S1-T01, S1-T03, S1-T07, S2-T01, S2-T03, S2-T04, S4-T04.
- The scheme editor (G-01) covers every mark notation in the six subjects' schemes: K/N/P/B/M/F/C, @, &, //, ATAU / Alternatif, Dilihat, tersirat, Maks N, bonus, pairs, P2,1,0, ECF, Tidak diterima, Nota, model answer with images, question-level zero and deduction rules (apart from W-15).
- Structure elements fully covered: compulsory sections, choose-N with equal marks per unit, marks per question, JSU export, blank_count lines, essay_choice with two stimuli, per-criterion language grid, option banks with images and distractors, inline gaps with one-word cap, formula pages, textbook reference, Kertas 1-4, MCQ 2-8 options, option images and maths in options, true_false, mcq_multi.
- No real exam text or real person names were written in this section (short identifiers such as "Rajah 3" and paper codes only).

## Wizard re-verification 2026-11-04 (run 2)

Task T9 re-run. Independent re-check of all 93 checklist items against the current 30, 45, 46, 50, 60, 40, 10, 20 and the plan, after the fixes for W-01..W-17. No PRD or plan file was changed by this task; the only edit outside this section is the line "Superseded by run 2 below." under the run-1 "Verdicts" heading.

### What changed since run 1

- Applied and verified by grep (each ID exists with the claimed content): 30 FR-ADM-QE3.24 (9 modes), QE3.25, QE3.1 (tab order), QE3.2 (accepted option), QE3.11 (stacked editors, English scope), QE3.21 / FD-QE-8, AC-ADM-QE3.13..QE3.17, AC-ADM-Q03.6, Q04.5, Q05.3, Q21.2, QE2.5, QE5.6, row 04-26, FR-ADM-Q16.8 (Sejarah B choose 3 of 5); 45 L-04, L-13, mode 8 and 9 pupil text, FR-QA-17, 21, 48, 49, AC-QA-21, 48, 49, section 2.7 toggle bullet; 46 FR-PA-35..39, AC-PA-37..42, "patah perkataan" everywhere, M-MCQ accepted list, reveal "Diterima juga"; 60 4.1 shapes (11 types, `bodyEn`, `captionEn`, `optionBank` with `imageId` / `isDistractor`, `schemeRules`, `textbookRef`, `rejectionReason`) and API-BIJAK-09 section fields; 40 OPT-KOD-POTONGAN; plan cards S1-T09a and S1-T09b (old S1-T09 is gone and no other doc cites it), and R1-ADM-Q-25 is owned by S5-T13 (with API-ADM-18). Every one of the 287 IDs cited by the run-1 tables was re-grepped and has a definition; every card named in 45 section 8 and 46 section 7 exists as a plan card.
- W-01..W-17 are closed as text. Checking the fixes as written found five new defects, N-1..N-5, all small text or one-field fixes; none needs a new screen.
- Plan note (not counted): the "New requirements" lines of S8-T02, S8-T03, S3-T04 and S1-T09a do not yet cite FR-PA-35..39, AC-PA-37..42, FR-QA-48, 49. The owning card is named in 45 and 46 and exists, so this is not a GAP; cite them when the traceability is regenerated.

### New defects found in run 2

- **N-1 (V22; BI P1 Part 2)** The worked-example leaf has no stored value: L-13 says the leaf is "shown filled", but no field holds the filled answer, DM-55 has no key for it, and nothing in 50 or 60 says marks 0 is valid only for such a leaf.
- **N-2 (G-07; Fizik, Matematik, Matematik Tambahan)** English-required scope conflicts: 30 FR-ADM-QE3.11 refuses sending only for stem, leaf prompt, option, stimulus body, bank text and alternative prompt (caption, instruction and scheme text may stay BM), but 45 section 3.1.5 (the "Bilingual (FR-QA-17)" paragraph) lists instruction, stimulus caption and bank text under the same refusal without that exception, and the plan card S1-T09b says "every text field".
- **N-3 (G-01; Sejarah)** FR-QA-48 (rubric content points with group caps) has no pupil side: 46 3.4 item 4 (rubric) has only the band select, and 3.3 has no tick list for a rubric key.
- **N-4 (V23, m8)** 45 conflict register row C-2 still says "QE3.24 has 14 modes"; QE3.24 now lists the 9 stored modes.
- **N-5 (G-14; Matematik)** The second accepted MCQ option has two stores: the key `{kind:'option', correct, accepted:[...], note}` (45 mode 1, 46 M-MCQ) and `mode_config.acceptedOptions` (DM-55, 45 section 3.1.6 extras list and DM table, 60 `modeConfig` comment, 30 A2 item 13).

### Per-item table (rows whose verdict changed, plus all remaining GAPs)

PASS now (were GAP in run 1; 24 rows): V05, V09, V17, V19, V24, V32, V41, M2, M6, M7, m1, m2, m4, m7, G-02, G-04, G-05, G-09, G-10, G-11, G-12, G-13, G-16, G-19. Verified closing evidence: V05 AC-ADM-Q03.6; V09 AC-ADM-Q04.5; V17 / M7 FD-QE-8 + AC-ADM-QE3.15 + DM-70; V19 / G-05 FR-PA-36 + AC-PA-38; V24 / M6 / G-02 FR-PA-35 + AC-PA-37 + AC-QA-21 + one copy "patah perkataan"; V32 preview "0 patah perkataan"; V41 AC-ADM-Q21.2; M2 AC-ADM-Q05.3 + FR-PA-37; m1 AC-ADM-Q03.6; m2 FR-ADM-QE3.1 order fixed; m4 AC-ADM-QE2.5; m7 AC-ADM-QE5.6; G-04 / G-12 FR-PA-37 + AC-PA-39; G-09 60 4.1 `optionBank`; G-10 API-BIJAK-09 + Q16.8; G-11 FR-PA-38 + AC-PA-40; G-13 45 mode 8 and 9 aligned with 46 2.2.2 / 2.2.3; G-16 AC-ADM-QE3.14; G-19 AC-ADM-QE3.16.

Rows that changed from PASS (run 1) to GAP, or stay GAP:

| ID | Requirement | Run 1 | Run 2 | Gap |
|---|---|---|---|---|
| V22 | Part tree Label, Jenis, Markah, Arahan (incl. 0-mark worked example) | GAP (W-06) | GAP | N-1 (example answer has no field, no DM / API rule for marks 0) |
| V23 | 14 V2 modes to 11 types / 9 modes | GAP (W-01) | GAP | N-4 (45 C-2 stale) |
| m8 | 14 vs 13 modes; delete-guard text | GAP (W-01) | GAP | N-4 |
| G-01 | Marking-scheme editor | PASS | GAP | N-3 (rubric content points: no pupil side) |
| G-07 | Bilingual BM+EN | GAP (W-04) | GAP | N-2 (English-required scope differs 30 vs 45 vs plan) |
| G-14 | MCQ second accepted option + Nota kunci | GAP (W-10) | GAP | N-5 (two stores) |

All other rows (the 87 PASS) meet the six conditions.

### Per-subject paper structure (changed elements and verdicts)

| Subject | Elements | PASS | GAP elements (gap) | Verdict |
|---|---|---|---|---|
| Bahasa Melayu | 8 | 8 | none | YES |
| Bahasa Inggeris | 8 | 7 | P1 Part 2 cloze worked example, 0 marks (N-1) | NO |
| Fizik | 7 | 5 | K1 bilingual MCQ (N-2); part-level Rajah / Jadual with bilingual headers (N-2) | NO |
| Matematik | 7 | 5 | K1 bilingual (N-2); key accepting two options (N-5) | NO |
| Matematik Tambahan | 5 | 4 | bilingual prompts and tables (N-2) | NO |
| Sejarah | 6 | 5 | Aras bands + content bank + category caps (N-3) | NO |

Closed since run 1 in the subject tables: BM K1 Bahagian B Sumber and counter, K2 Had keras, underline / poem / box rendering, Bahan panel, Perhatian deductions (punctuation code, OPT-KOD-POTONGAN); BI Part 4/5 bank shape and e-mail frame; Fizik Draw on diagram, boxes, part-level stimulus; Matematik section marks list, drawing; Matematik Tambahan section choices, plot and best-fit; Sejarah K1 Sumber box, K2 B choose 3 of 5, part-level source.

### Counts

- V2 functions: 53 PASS, 2 GAP of 55 (V22, V23).
- Split paths B/M/m: 18 PASS, 1 GAP of 19 (m8).
- G items: 16 PASS, 3 GAP of 19 (G-01, G-07, G-14).
- Total: **87 PASS, 6 GAP of 93** (run 1: 64 / 29). The 6 GAP rows are explained by 5 defects (N-1..N-5).

### Verdicts

Superseded by run 3 below.

- **V2 parity: NO** (V22 via N-1, V23 via N-4; 53 of 55 V2 rows PASS; m8 via N-4).
- **BM: YES**
- **BI: NO** (N-1)
- **Fizik: NO** (N-2)
- **Matematik: NO** (N-2, N-5)
- **Matematik Tambahan: NO** (N-2)
- **Sejarah: NO** (N-3)

Each verdict turns YES when the fixes below are applied; no new design is needed. Fixes marked "(R1 decision D113)" are new decisions (report as D113-continued). Next free IDs: AC-ADM-QE3.18, FR-ADM-QE3.26 (30); FR-PA-40 and AC-PA-43 (46); FR-QA-50 / AC-QA-50 (45; not needed here).

### Fixes for the remaining GAPs

**N-1 (V22, BI P1 Part 2).** Four edits.
1. 45 section 3.1.6, row L-13: replace its content cell with: "optional; when ticked, a required text `Jawapan contoh` appears (for an `mcq` or `match_letter` leaf the option label, otherwise text of at most 200 characters; message "Jawapan contoh diperlukan."); the leaf has marks 0 (stored as `mode_config.example = { "answer": "<value>" }`), no scheme and no key, is shown to the pupil filled with that value and read-only (46 2.2 cloze row), adds nothing to the part total, and is exempt from the scheme-sum check".
2. 50 DM-55: append to the key list "`example` (`{ "answer": string }`, present only on a `Contoh (tidak dimarkah)` leaf; `question_parts.marks` is 0 exactly when `example` is present and 1 to 100 otherwise)"; make the same addition to the DM-55 line of 45 section 10 and to 30 A2 item 13.
3. 60 API-Q-03 row, after the `modeConfig` mention: "a leaf with `modeConfig.example` has marks 0 and every other leaf marks 1 to 100, else `422` with 'Nilai mata mesti sekurang-kurangnya 1.' or 'Jawapan contoh diperlukan.'".
4. 46 section 2.2, cloze row, replace "is shown filled and read-only" with "is shown filled with `mode_config.example.answer` and read-only". Add "AC-ADM-QE3.18 Given a leaf with `Contoh (tidak dimarkah)` ticked and an empty `Jawapan contoh`, then saving shows 'Jawapan contoh diperlukan.'; given the answer 'was', then the pupil sees 'was' in the gap, read-only." to 30 after AC-ADM-QE3.17. (R1 decision D113.)

**N-2 (G-07; Fizik, Matematik, Matematik Tambahan).** In 45 section 3.1.5, paragraph starting "Bilingual (FR-QA-17)": replace "every text field below (stem, leaf prompt, option, instruction, stimulus body and caption, bank text, alternative prompt) shows two editors stacked, labelled `BM` and `English`. Saving or sending with an empty English value gives "Teks English diperlukan untuk soalan dwibahasa."" with "every text field below (stem, leaf prompt, option, instruction, stimulus body and caption, bank text, alternative prompt, scheme text) shows two editors stacked, labelled `BM` and `English`. Sending (`Hantar untuk semakan`, `Terbitkan`) gives "Teks English diperlukan untuk soalan dwibahasa." when the English value of the stem, a leaf prompt, an option, a stimulus body, a bank text or an alternative prompt is empty; caption, instruction and scheme text may stay BM only (30 FR-ADM-QE3.11, section 2.7)." Plan S1-T09b (owner T6), Approach (1): replace "a `ms+en` question needs the English text on every text field" with "a `ms+en` question needs the English text on the stem, leaf prompts, options, stimulus bodies, bank texts and alternative prompts (caption, instruction and scheme text may stay BM)".

**N-3 (G-01, Sejarah).** In 46 section 3.4, after item 4 add: "4a. **Rubric content points (FR-PA-40):** when the rubric key has content points C1..Cn (FR-QA-48), each shows the tick box 'Saya dapat markah ini' under the band select; groups 'Mana-mana N daripada M' and caps 'Maks {N}' apply as in 3.3; the stepper is set to the capped sum of the ticks (never above the part marks) and the band select shows the band whose range contains it; the pupil may still choose another band or move the stepper inside the part marks, and the last change wins. (R1 decision D113.)" Add to 46 section 7.1: "FR-PA-40 Self-mark of a rubric with content points: ticks with groups and caps set the stepper, as 3.4 item 4a. Card S3-T06, S8-T05." and to 7.2: "AC-PA-43 Given a rubric essay of 10 marks with content points Maklumat (6 x 1) and Kebaikan (6 x 1, group cap 'Maks 4'), when the pupil ticks 6 Maklumat and 6 Kebaikan, then the stepper shows 10 (6 + 4) and the band select shows the band containing 10; when the pupil then picks a lower band, the stepper moves into that band's range. S3-T06." Add FR-QA-48 to the pupil-side column of 45 8.2 (already cites S3-T06, S8-T05).

**N-4 (V23, m8).** In 45 section 10 conflict row C-2, replace "**Applied in 30 (T3: QE3.2 has 11 types, QE3.24 has 14 modes) and in 50 (T5: DM-69).**" with "**Applied in 30 (QE3.2 has 11 types; QE3.24 lists the 9 stored modes and the 14 V2 modes are migrated, never offered) and in 50 (DM-69).**"

**N-5 (G-14, Matematik).** The key is the single store. Remove `acceptedOptions` from: 50 DM-55 key list; 45 section 3.1.6 line "Per-mode extras are stored in `question_parts.mode_config` (DM-55): ..." and the DM-55 row of 45 section 10; 60 `modeConfig` comment in section 4.1; 30 A2 item 13. In 45 mode 1, after the key example, add "The accepted options live only in the answer key (`accepted`, `note`); `mode_config` has no copy."

## Wizard re-verification 2026-11-04 (run 3)

Task T9 re-run 3 after commit b313db7 (fixes N-1..N-5 and the plan citations). Independent re-check of the 6 GAP rows of run 2 and a grep-based check that the fixes introduced no contradiction across 30, 45, 46, 50, 60 and the plan. No file other than this one was changed; the only edit outside this section is the line "Superseded by run 3 below." under the run-2 "Verdicts" heading.

### What changed since run 2

- N-1 closed in text: 45 L-13 (`Jawapan contoh`, `mode_config.example = { "answer": ... }`, "Jawapan contoh diperlukan."), 45 section 3.1.6 extras list and DM-55 row, 50 DM-55 (`example`, marks 0 exactly when present), 60 API-Q-03 (422 rule) and 4.1 `modeConfig` comment, 46 cloze row ("filled with `mode_config.example.answer`"), 30 AC-ADM-QE3.18 and A2 item 13.
- N-2 closed: 45 section 3.1.5 bilingual paragraph now equals 30 FR-ADM-QE3.11 (refusal for stem, leaf prompt, option, stimulus body, bank text, alternative prompt; caption, instruction and scheme text may stay BM); plan S1-T09b has the same list.
- N-3 closed: 46 section 3.4 item 4a, FR-PA-40, AC-PA-43 (all grep-confirmed, with cards S3-T06, S8-T05).
- N-4 closed: 45 C-2 row says QE3.24 lists the 9 stored modes.
- N-5 closed: `acceptedOptions` no longer appears in any of 30, 40, 45, 46, 50, 60 or the plan; 45 mode 1 states that accepted options live only in the answer key; 46 M-MCQ and AC-QA-27 use the key `accepted` list.
- Plan citations verified on the cards: S1-T09a (FR-QA-48, 49, FR-PA-39), S2-T10 (AC-ADM-QE3.13..3.18, FR-ADM-QE3.25), S3-T04 (FR-PA-39, AC-PA-41), S3-T06 (FR-PA-40, AC-PA-43), S8-T02 (FR-PA-36, 37, AC-PA-39), S8-T03 (FR-PA-35, 36, 38, AC-PA-37, 38, 40, 42), S8-T05 (FR-PA-40, FR-QA-48, 49).

### Consistency spot-check

- `acceptedOptions`: 0 hits in the PRD and plan. One store (the key). OK.
- `mode_config.example`: stated the same way in 45 (L-13, extras, DM-55 table), 50 DM-55, 60 (API-Q-03, 4.1), 46 (cloze row), 30 (AC-ADM-QE3.18, A2 item 13). Key lists in 45, 50, 60 and 30 A2 item 13 are identical (`maxWords` .. `drawingKind`, `example`). OK.
- Bilingual field lists: 30 QE3.11, 45 3.1.5, plan S1-T09b agree. 45 section 2.7 line 245 names only "prompt, option and stimulus text" for the refusal, which is a subset and does not conflict.
- One new defect found:
  - **N-6 (V22; BI P1 Part 2)** 30 section 4.V field table row `marks | every leaf | integer 1 to 100` has no exception for a `Contoh (tidak dimarkah)` leaf, while 30 row 04-26, 45 L-04, 50 DM-55, 60 API-Q-03 and AC-ADM-QE3.18 say marks 0 is valid for it. This is a one-cell text contradiction on the V22 part-tree row.

### Per-item table (rows that are still GAP; all other rows PASS)

| ID | Requirement | Run 2 | Run 3 | Gap |
|---|---|---|---|---|
| V22 | Part tree Label, Jenis, Markah, Arahan (incl. 0-mark worked example) | GAP (N-1) | GAP | N-6 (30 field table `marks` row lacks the 0-mark exception) |
| V23 | 14 V2 modes to 11 types / 9 modes | GAP (N-4) | PASS | closed |
| m8 | 13 vs 14 modes typo; delete-guard text | GAP (N-4) | PASS | closed |
| G-01 | Marking-scheme editor | GAP (N-3) | PASS | closed (FR-PA-40, AC-PA-43) |
| G-07 | Bilingual BM+EN | GAP (N-2) | PASS | closed |
| G-14 | MCQ second accepted option + Nota kunci | GAP (N-5) | PASS | closed |

### Per-subject paper structure

| Subject | Elements | PASS | GAP elements | Verdict |
|---|---|---|---|---|
| Bahasa Melayu | 8 | 8 | none | YES |
| Bahasa Inggeris | 8 | 7 | P1 Part 2 worked example (N-6, one-cell contradiction) | NO |
| Fizik | 7 | 7 | none | YES |
| Matematik | 7 | 7 | none | YES |
| Matematik Tambahan | 5 | 5 | none | YES |
| Sejarah | 6 | 6 | none | YES |

### Counts

- V2 functions: 54 PASS, 1 GAP of 55 (V22).
- Split paths B/M/m: 19 PASS, 0 GAP of 19.
- G items: 19 PASS, 0 GAP of 19.
- Total: **92 PASS, 1 GAP of 93** (run 2: 87 / 6; run 1: 64 / 29).

### Verdicts

Superseded by run 4 below.

- **V2 parity: NO** (only V22, via N-6; 54 of 55 V2 rows PASS)
- **BM: YES**
- **BI: NO** (N-6)
- **Fizik: YES**
- **Matematik: YES**
- **Matematik Tambahan: YES**
- **Sejarah: YES**

All verdicts become YES when N-6 is applied; this is a one-cell edit.

### Fix for the remaining GAP

**N-6 (V22, BI).** Target: `docs/prd/r1/30-admin-pusat.md`, the field table that holds the row `| marks | every leaf | integer 1 to 100 | "Nilai mata mesti sekurang-kurangnya 1."; "Markah bahagian tidak boleh melebihi 100." |` (about line 840). Replace the validation cell `integer 1 to 100` with `integer 1 to 100; 0 only for a leaf with `Contoh (tidak dimarkah)` (FR-ADM-QE3.25, `mode_config.example`)`. No new ID is needed; next free IDs are unchanged (AC-ADM-QE3.19, FR-ADM-QE3.26, FR-PA-41, AC-PA-44).

## Wizard re-verification 2026-11-04 (run 4)

Task T9 re-run 4 after commit 8280e78 (N-6). Re-check of V22 and the BI paper, plus a last sweep of every marks-range statement in 30, 45, 46, 50, 60, 20, 10 and 40. No file other than this one was changed; the only edit outside this section is "Superseded by run 4 below." under the run-3 "Verdicts" heading.

### Confirmed since run 3

- N-6 applied: 30 field table row `marks` now reads "integer 1 to 100; 0 only for a leaf with `Contoh (tidak dimarkah)` (FR-ADM-QE3.25, `mode_config.example`)". 30 row 04-26 and row 15-12 (which defers to 04-26), 45 L-04, 50 DM-55 and 60 API-Q-03 all carry the exception. 46, 20, 10 and 40 state no leaf-marks range.

### Sweep result: one more place without the exception

- **N-7 (V22; BI P1 Part 2)** 45 section 3.1 validation table (line about 563): `| marks | every leaf | integer 1..100 | "Nilai mata mesti sekurang-kurangnya 1."; ... |` has no exception, the same defect as N-6 in the sibling table of 45 (L-04 in the same file has it).

### Counts

- V2 functions: 54 PASS, 1 GAP of 55 (V22, via N-7).
- Split paths B/M/m: 19 PASS, 0 GAP of 19.
- G items: 19 PASS, 0 GAP of 19.
- Total: **92 PASS, 1 GAP of 93**. BI paper: 7 of 8 elements PASS (P1 Part 2 worked example, N-7). All other subjects unchanged from run 3.

### Verdicts

- **V2 parity: NO** (V22 only, via N-7)
- **BM: YES**
- **BI: NO** (N-7)
- **Fizik: YES**
- **Matematik: YES**
- **Matematik Tambahan: YES**
- **Sejarah: YES**

### Fix for the remaining GAP

**N-7.** Target: `docs/prd/r1/45-question-authoring-flow.md`, the field validation table row `| marks | every leaf | integer 1..100 | ... |` (about line 563). Replace the cell `integer 1..100` with `integer 1..100; 0 only when L-13 (`Contoh (tidak dimarkah)`) is ticked (`mode_config.example`)`. No new ID needed. Once applied, V22 and BI turn PASS: 93 of 93 and all seven verdicts YES.
