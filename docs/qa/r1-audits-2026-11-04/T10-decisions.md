# T10 cold-reader decisions (D113-continued), 2026-11-04

Decided by the Delivery Lead by principle (HANDOFF §1 principles) while closing cold-reader findings. Final; recorded in docs/TRACKER.md (row D113-c cold-reader) and docs/prd/r1/00-index.md. Finding IDs refer to the cold-reader run files of the same folder.


---

## T10 run-1 fix brief (shared by three fix agents)


Lead decisions for this round (apply them; they are D113-continued, record them in your report):
- D-T10-1 Accuracy on the wire: every report/practice API returns accuracy as a number with ONE decimal (pooled correct ÷ answered × 100, XS-5); every screen shows the whole number rounded half up (40 XS-5); only the manual Headcount AR screen may show one decimal. 60 §4.6 and every API row say this; cards S10-T01/S10-T03/S6-T01/S6-T03 cite it.
- D-T10-2 Databank mode string is `databank` (OPT-MODE-SESI master, 50 §4.7a); `past_year` and `ramalan` are legacy values only read for old rows, never written by R1 code.
- D-T10-3 Random Kuiz (Bijak SPM "Kuiz") uses API-BIJAK-06 (`/api/bijak/kuiz/sessions`, check, finish) and writes `practice_answers` with mode `kuiz`; it does NOT use API-PRAC-01. Card S3-T04's Data/API line and 10 R1-MUR-13 say so.
- D-T10-4 AC-CHAIN-2 reviewer step: imported questions arrive as Draf; an Admin Pusat user (the only reviewer role, no Penyemak) sets Bab/SP/TP/Kesukaran in the wizard (Bab required where chapters exist; SP/TP/aras where DSKP nodes exist, D112-3), sends to review (Menunggu Semakan, filter `review`), approves (Diluluskan), then Terbit publishes the group as one unit. The chain test seeds these steps through the UI.
- D-T10-5 S9 sector: S9 is the Delivery Lead's sector and is not claimable as a SECTOR, but its cards are worked by the Delivery Lead session (S9-T06 included): the chain spec for AC-CHAIN-n is written by the last card of that chain under `e2e/r1/chains/` (S0-owned folder; the card PR is a small cross-sector PR with `Cross-sector: S0` and label `needs:S0`), and S9-T06 runs and maintains the full chain suite. START-HERE, FAQ and the S9-T06 card say exactly this.
- D-T10-6 Build cards name their new files: every Build card (and every Complete card that creates a file) has a "New files:" line with exact paths following the existing module layout of that sector (see the "Starts from" paths and plan §2 "Owned" lines).

---

## T10 run-2 fix brief (shared by four fix agents)


Lead decisions (apply exactly; D113-continued; record them in your report and, if your files include 00-index or FAQ, in the right place):
- L-1 (D-01) Question types: 40 OPT-JENIS-SOALAN is the master list of the 11 `questionType` values: mcq, mcq_multi, true_false, match, short_answer, fill_blank, structured, working, essay, drawing, table_fill (30 FR-ADM-QE3.2 agrees). `short_text` and `numeric` are LEAF MODES (OPT-MOD-JAWAPAN, 9 modes), not question types. 50 DM-69 and plan S1-T09a must use the master list. Add one mapping table "questionType → default leaf mode(s)" in 40 next to OPT-JENIS-SOALAN: mcq→mcq; mcq_multi→mcq (multi); true_false→mcq (2 options Betul/Salah); match→match_letter; short_answer→short_text or numeric; fill_blank→short_text (one leaf per gap); structured→any leaf modes per part; working→working; essay→essay or essay_choice; drawing→drawing; table_fill→table_fill.
- L-2 (D-02) Group review: a stimulus group moves as one unit. On the group page the button "Hantar kumpulan untuk semakan" moves every Draf member to Menunggu Semakan in one transaction (API-Q-04 group-aware bulk status change, `groupId`). "Terbitkan kumpulan" (API-Q-31) is allowed only when every member is Menunggu Semakan or already Diluluskan; it sets all members Diluluskan atomically, else 409 with "Semua soalan dalam kumpulan mesti dihantar untuk semakan dahulu." Single (ungrouped) questions keep "Hantar untuk semakan" and "Terbitkan".
- L-3 (D-03) An empty group stores its own `subject_id` and `education_level_id` (and optional `kertas`) on the group row; API-Q-08 create/update body carries them; members must match (422 "Subjek dan Tingkatan ahli mesti sama dengan kumpulan."). If no DM row covers these columns, extend the group DM row (DM-51 or the existing stimulus_groups row) — the 50/60 owner adds them.
- L-4 (D-05) One DSKP tag rule everywhere (D112-1, D112-3): Bab is required when the question's Subjek + Tingkatan has chapters; SP, TP and aras are required only when DSKP nodes exist for that Subjek + Tingkatan; Kesukaran is always required (default min(5,TP), or 3 when no TP). 30, 45, plan and FAQ Q23 state exactly this.
- L-5 (D-06) DM-45: unique on (`source_batch_id`, `paper_code`) — one draft paper per paper code per batch.
- L-6 (D-07) Teacher submissions: every teacher submission (single MCQ, structured question, paper upload, diagram) is an intake item with `source = guru` (API-Q-* intake), reviewed in Semak Import / Kiriman Guru; "Terima" creates a Draf question with the submitted fields pre-filled in the wizard; card S2-T02 owns the pre-fill. 45 §3.4, 30 FR-ADM-Q12.6 and 20 FR-GUR-44-2 state the same.
- L-7 (D-12) The abandoned-session sweeper (2 h → `abandoned`) is owned by the card that owns DM-66 (check the plan) — one owner only.
- L-8 (D-13) Slice 0 does not need S7-T05: until S7-T05 merges, the coin rate is read with the default 1 when no `reward_settings` row exists (state this in plan §5A and in the S5-T03/S3-T04 cards that read the rate).
- L-9 (D-14) Chain 5 needs S10-T09: add it to S6-T03 deps and to 40 §X9 chain 5 card list and the S9-T06 chain table.
- L-10 (D-15) S7-T01: Type Complete (48 §5.1), size L, deps add S3-T04.
- L-11 (D-16) `flat_quiz_reward` range 0..20 (48 is the behaviour spec); DM-48 says 0..20.
- L-12 (D-17) Games serve only standalone text questions: no stimulus groups, no figures (46 §5.1, 48 GAME-00 §3.2, servability `permainan`); 40 FR-X1-4e is corrected.
- L-13 (D-18) The banned-string rule ("Pratonton" placeholder pages, "akan datang", "belum tersedia") applies to placeholder PAGES and notices; admin buttons labelled "Pratonton" / "Pratonton kumpulan" / "Pratonton kertas" are allowed (an allow-list in START-HERE, FAQ Q26 and S0-T04).
- L-14 (D-21) API-DSKP-09 bulk chapter body gains `overwrite: boolean` (default false) for "Tukar Bab sedia ada".

---

## T10 run-3 fix brief (shared by four fix agents)


Lead decisions (D113-continued, round 3; apply exactly, record in your report):
- M-1 Mode per screen: 40 holds ONE master table "Pupil activity → stored `mode` → API → card" next to OPT-MODE-SESI. Values: Latih Tubi → `latih_tubi` (API-PRAC-01); Soalan by Chapter → `chapter`; Remedial → `remedial`; Databank SPM → `databank`; Tracking A objective → `tracking_a`; Kuiz SPM → `kuiz` (API-BIJAK-06); Simulasi / Bijak paper sitting → `simulasi` (API-BIJAK-04); Kertas Subjektif sitting → `subjektif` (API-BIJAK-04 attempt kind subjektif, S3-T06); Soalan Berstruktur (R1-MUR-17) → `structured` (API-PRAC-10, S5-T11); Set Soalan Guru → `question_set`; PKSK → `pksk`; Audio KBAT → `audio_kbat`; Misi → `mission`; Battle Arena → `battle`; every other game → `game` (game key in `part_ref`). `past_year`, `ramalan`, `random` are legacy/read-only (never written by R1 screens). 10, 46, 50, 60 cite this table and must not contradict it.
- M-2 Late submit (B-04): the SRS wins. A Bijak/Simulasi/Subjektif submit is never rejected for lateness: at 00:00 the client auto-submits; a submit or offline sync arriving after expiry is accepted (late sync up to 24 h, 10 FR-MUR-13-32) and stored with its real `submittedAt`; the 30 s figure is only the client grace before auto-submit. 40 FR-ERR-19 and the matching ERR row are rewritten accordingly.
- M-3 Language values (A-07): stored values are `ms`, `en`, `ms+en` (40 OPT-BAHASA master). `bm` is accepted on input (CSV/API) and stored as `ms`. 50 DM-50, 60 §4.1 and 45 §2.7 use `ms`.
- M-4 "SPM-bound" (A-04): removed everywhere as a tagging condition (L-4 is the only DSKP tag rule); "SPM-bound" may remain only where it decides Kertas availability.
- M-5 Servability denominator is 6 everywhere ("n daripada 6"); 40 OPT-SERVABILITY fixed.
- M-6 AnswerLogPort (B-03): ONE signature, defined in 60 §2.17.5 and copied verbatim by 46 D-PA-1 and plan S5-T15: `record(entry: { userId, attemptId, questionId, partRef, mode, isCorrect, marksAwarded, marksMax, answeredAt })`, idempotency key (`attempt_id`, `user_id`, `question_id`, `part_ref`) (DM-44 unique index), `mode` ∈ the writable OPT-MODE-SESI values of M-1.
- M-7 Grader location (B-06): the one grader is `questions/grading.ts` (S1-owned; S1-T09a extends it). Exam engines and practice call it; no second grader in exam-core. 46 and 60 say so.
- M-8 Card ownership rules (plan + START-HERE; fixes the "unclaimed FR/AC" and "file not listed" class of findings): (a) a card owns EVERY FR/AC of the PRD modules on its PRD line, including IDs added later, unless another card names that ID explicitly (explicit beats module); (b) "Starts from" lists the entry files; the card may edit any other existing file of ITS OWN sector that its gap check shows is on the path of its FR/AC (scope-guard allows this); a file of another sector needs a cross-sector PR (decision 7); (c) a card creates new files only where its "New files:" line says.
- M-9 Data migrations (C-31): a data migration is allowed only when it ships in the same PR as the schema change it completes and is idempotent (re-runnable, dry-run first on UAT by the designated UAT developer); every other data repair is a script run by the UAT developer. Migration 0229 qualifies; DM-77 names the U-OP that runs its dry run.
- M-10 Paper code for imported papers (A-18): when the PDF gives no paper code, `paper_code` = `K{kertas}` (e.g. `K1`); unique index on (`source_batch_id`, `paper_code`) with paper_code NOT NULL after that default. Bahagian→section mapping: one section per detected "Bahagian X" heading, in order; no heading → one section "Bahagian A".
- M-11 Sizes: plan sizes are S/M/L only; 48 §0.6 uses the plan size (L) for S7-T01.
- M-12 10 R1-MUR-21 Action is Complete (matches plan S7-T01 and 48).

---

## T10 run-4 fix brief (shared by four fix agents)


Lead decisions, round 4 (apply exactly):
- N-1 (C-01, B-15) S9-T06 has NO `deps:` (recurring). It lands `e2e/r1/chains/helpers.ts` as its first small PR in Sprint 1; each chain-last card imports it and depends on S9-T06 (not the reverse). The full suite RUN (not the card) waits for the ten chain-last cards. A chain-last card's `deps:` lists every other card of its chain (40 §X9 chain table is the source).
- N-2 (D-08, A-26) Build cards may ALSO edit existing files of their own sector that the gap check shows are on the path (route/menu/module wiring); new files only at the "New files:" paths. START-HERE decision 12(b), plan §0B and FAQ Q3/Q41 say this for every Type except Keep/Verify/Ops.
- N-3 (B-14, C-18) Kertas Subjektif: attempt kind `subjektif`, stored mode `subjektif`, card S3-T06, API-BIJAK-04 (with `surface=subjektif`). Soalan Berstruktur: API-PRAC-10 creates attempts of kind `structured`, stored mode `structured`, card S5-T11. No `structured_attempts` table (remove any mention unless 50 registers it). Self-mark API-BIJAK-05 serves both kinds.
- N-4 (B-01, B-04, B-05) Kertas Subjektif papers: admin creates the paper (surface `subjektif`) in Set Builder; `POST /api/admin/papers/:id/source` (API-BIJAK-14) attaches a source PDF and its extracted groups become placements of THAT paper (no new paper); pupil list/viewer is API-BIJAK-04 `GET /api/bijak/papers?surface=subjektif` and the attempt is started by S3-T06's page via API-BIJAK-04. 45 §3.5, 60 API-BIJAK-04/14 and the plan say so.
- N-5 (C-10) `random` is rejected by API-PRAC-01 with 422 (ERR-REQ code); 46 §4.8 sentence allowing it is removed.
- N-6 (C-08) AnswerLogPort entry gains `isTest: boolean` (true for Mod Pelajar sessions, INV-30); 60 §2.17.5, 46 D-PA-1 and plan S5-T15 carry the identical signature.
- N-7 (D-01) Redeem idempotency is `clientUuid` per (userId, clientUuid) only; no `Idempotency-Key` header, no 10 s window.
- N-8 (D-02) One redemption budget: `reward_budget_sen_session` (DM-48), a global budget for the academic session; ERR-GAME-22 "Had tebusan sesi ini telah dicapai." fires when it is exhausted; there is no per-pupil money budget (per-pupil limits are the existing per-item stock and daily caps).
- N-9 (D-03) Reward category keys = OPT-HADIAH-KATEGORI stored values; migration 0229 maps the V2 capitalised keys to them (mapping table in DM-77).
- N-10 (D-25) SP on the wire is `spIds: Id[]` (1..3) everywhere; a single-select form sends a one-element array.
- N-11 (A-01) The scheme v2 field names in 45 §7 are normative (they supersede v2-exam-schema D4); 50 DM-54/DM-55 and 60 API-Q-30 cite 45 §7 and use its names.
- N-12 (A-02) `mcq_multi` and `true_false` are question types; their leaves use leaf mode `mcq` with `multi: true` (mcq_multi) or two fixed options Betul/Salah (true_false); the key field is `correctOptionIds: Id[]` everywhere (API-BIJAK-06 included).
- N-13 (A-23) One banned-string list and one allow-list, defined in 40 AC-X2-3 (master); 10 §4.11, plan table C, S0-T04 and FAQ Q26 cite it and must not restate a different list.
- N-14 (D-15) Liga has no pupil "Sertai" (D-GAME-3): 10 FR-MUR-23-2 / AC-MUR-23-1 updated.
- N-15 (D-10) A big card may be delivered in several PRs that all name the same card ID ("parts"), each PR stating which FR/AC it proves; the card is Done when all its ACs pass. START-HERE, FAQ and 48 §5.1 say so.

---

## T10 run-5 fix brief (shared by four fix agents)


Lead decisions, round 5 (apply exactly):
- P-1 (A-01) The 40 AC-X2-3 allow-list includes every banned-word string that a PRD FR/field spec quotes as exact UI copy (e.g. "Peta Belum Tersedia", "Bank soalan belum sedia", "Kedudukan belum tersedia", the three defensive pupil strings). The 40 fixer greps 10/20/30/45/46/48 for the banned words inside quoted copy and lists each allowed string with its screen; S0-T04 mirrors the list in `scripts/placeholder-allowlist.json` (its New file). S0-T04 also owns the Sprint 4 flip of PLACEHOLDER_CHECK_MODE from report to fail (A-03).
- P-2 (A-04) Stored batch statuses = 40 OPT-BATCH-STATUS (master); 40 X10.5.3 and any other list align to it.
- P-3 (A-05, A-06) Two timeout codes: `OCR_TIMEOUT` (page) and `OCR_BATCH_TIMEOUT` (batch) per the ERR catalogue. Settings: keep the existing `OCR_PAGE_TIMEOUT_MS` (default 90000) and add `OCR_BATCH_TIMEOUT_MS` (default 900000); the names OCR_PAGE_TIMEOUT_SECONDS / OCR_BATCH_TIMEOUT_MINUTES are withdrawn everywhere. `env.schema.ts` is S0's: S1-T04 changes it by a cross-sector PR to S0.
- P-4 (A-07) A bulk action on part of a group is refused with 422 ERR-QST-02 ("Soalan dalam kumpulan rangsangan mesti dipilih bersama."); `ids` + `groupId` together is also 422 (ERR-REQ). 60 API-Q-04, 45 §4.2, 40 ERR-QST-02 and the plan card agree.
- P-5 (B-02, C-04, B-08) Bijak and Kuiz timers: card S3-T04 owns ONE job in `bijak/` that auto-submits a Bijak attempt at deadline + 300 s and closes an abandoned Kuiz session after 2 h (checked rows kept, no reward); a later submit/sync still re-marks per the late-submit rule. S5-T15 owns only the practice-session sweeper. 60 API-PRAC-03 / API-BIJAK-04 / API-BIJAK-06, DM-66 and the plan say so.
- P-6 (B-10) Stimulus panel initial state = 46 §2.4 (open on a group's first member screen, collapsed on later member screens, pupil's choice kept); 10 FR-MUR-QP-8 and 40 FR-X6-6 copy it.
- P-7 (C-03) The coin-rate switch from constant 1 to the `reward_settings` row is done by S7-T05 in its own PR, with cross-sector PRs to S5 (practice rules) and S3 (Bijak result) for the readers; DM-48 and the cards say so.
- P-8 (D-18) The session budget counts every non-cancelled redemption (Menunggu + Dihantar); 48 GAME-21, 50 DM-48, 30 P2-09.1 agree.
- P-9 (D-25) Ranking ties follow 48 GAME-16 (distinct positions; the documented tie-break); 10 R1-MUR-33 and R1-MUR-18 copy it and the row counts.
- P-10 (D-36) Headcount pupil "Draft" + "Belum Ada Data" shows exactly when the pupil has no ETR for that config (a TOV alone does not change it); 10 FR-MUR-3-10, AC-MUR-3-7 and 50 DM-49 agree.
- P-11 (D-01) Unique class name = (`teacher_id`, `academic_year`, `lower(btrim(name))`).
- P-12 (A-16) `intake_items.section_label` is registered by extending the intake item DM row (no new ID).
- P-13 (A-18) S1-T10 writes `surface='simulasi'` and `exam_board` only when the migration 0161 columns exist; until S3-T06 merges, papers are created without them and S3-T06's migration backfills `surface='simulasi'` for imported papers. (Or move S1-T10 after S3-T06 if the plan fixer finds that simpler without breaking sprint order — the plan fixer decides and tells 50/60.)

---

## T10 run-6 fix brief (shared by four fix agents) — STRICT MODE



Decisions (Q-n), apply exactly:
- Q-1 (A-01) Kesukaran: default min(5, TP); 3 when there is no TP. U-OP-19 backfill writes `difficulty_level` only where `difficulty_tp` is 1..6 (TP 6 → 5, i.e. min(5,tp)); rows with no TP stay null and every reader falls back to least(5, tp), else 3. Migration 0128. Owners of this text: 45 T-12, 50 DM-47; plan S1-T02, 30 U-OP-19, 60 API-Q-03(d), FAQ Q23 copy it.
- Q-2 (A-04) One batch end rule, written in 45 §3.3.2 item 7 (owner) and pointed to by 40 X10.5.3, 50 DM-71/OPT-BATCH-STATUS row, 60 API-Q-26/API-Q-14: the batch clock starts at the first `processing`; a page that hits `OCR_TIMEOUT` or is unreadable is a failed page; when processing ends, status = `selesai_dengan_ralat` if ≥1 page failed and ≥1 item was extracted, `failed` if 0 items were extracted or `OCR_BATCH_TIMEOUT` was hit, else `ready_for_review`.
- Q-3 (A-05, A-07) S1-T04 PRD line adds FR-ADM-Q09.3 and FR-ADM-QE4.3 (Terima behaviour only); S1-T10's PRD line lists only the IDs it owns (no blanket R1-ADM-QE-05 / R1-ADM-Q-15); plan table 4.0 E gets rows for QE-05 and Q-15 (Q-15 = S3-T02).
- Q-4 (A-06, B-09) Imported papers: migration 0161 backfills `surface='simulasi'` only; `exam_board` stays null for imported papers. Plan card S1-T10, FAQ Q44, 50 DM-45 and DM-23, 30 Q07.6, 60 API-Q-25 say exactly this.
- Q-5 (A-11) S1-T01 proves AC-QA-07 / FR-ADM-QE2.7 as "part 2, after S1-T07" (parts rule).
- Q-6 (A-12) The 1..n group change in `exam/builder/paper-check.ts` is S3-T02's (API-BIJAK-10(a)); DM-01 and API-Q-08 text no longer assign it to S1-T01.
- Q-7 (A-18) The pupil reveal routes (API-BIJAK-04/05/06; owners per 60 Cards column) strip `guidance` and expose `correctOptionIds`; 45 §7.0 says "the reveal routes", not API-Q-30.
- Q-8 (A-22) `PLACEHOLDER_CHECK_MODE` default is `report` in code, in local lint and in the workflow until S0-T04 part 2 (start of Sprint 4) changes the default to `fail` in one PR; the Verify step reads report output in Sprints 1–3.
- Q-9 (A-29, C-09) Slice 0 order: S4-T06 and S5-T01 before S5-T03; S1-T03, S1-T04, S2-T02 (step 4a) before S1-T10.
- Q-10 (C-01) 40 AC-X3-1 follows FAQ Q42: [CI] proof now; the [UAT] row waits for S4-T09 + U-OP-12 data; the card stays In review until then (data-blocked, not failed).
- Q-11 (C-02) S4-T06 owns the Topik / Peta Belajar read switch (legacy_topics → chapters/topics/subtopics) per 50 DM-16 / 60 API-DSKP-01; its Approach and Files say so.
- Q-12 (C-08) The helper `coinsPerCorrect()` reads the `reward_settings` row when it exists and returns 1 when it does not; AC-MUR-16-4's rate-3 clause is tagged "[UAT] after S7-T05". 46 F7.3, 48 §3.7, 10, plan S5-T03/S7-T05 and FAQ Q43 say exactly this.
- Q-13 (C-10) The S5-T03 404 for an unassigned set is "part 2, after S6-T14" (DM-46).
- Q-14 (C-11) mcq_multi partial credit is graded in the one grader `questions/grading.ts` (S1-T09a owns it, AC-PA-14 owner S1-T09a); S5-T03 and S5-T11 only call it. 46 FR-PA-25 and 60 API-PRAC-02 say so.
- Q-15 (C-17) `marksMax` is 1 for an MCQ leaf, the leaf marks otherwise; plan S5-T15 copies 60 §2.17.5.
- Q-16 (C-18) S5-T15's "no write outside the port" test uses an allow-list of today's direct writers (Bijak, battle, games) that each owning card removes; the list shrinks to empty.
- Q-17 (C-27) S6-T01 sets `roles: ['guru']` on the teacher route `/guru/laporan-mingguan-kelas` in `routes/prestasi.ts`; `/guru/laporan-mingguan` redirects to it; `/laporan-mingguan` is untouched.
- Q-18 (C-31) S6-T03 implements XS-1..5 as queries in `xs-queries.ts`; XS-6..8 are rules applied by S10-T02 (owner).
- Q-19 (B-01, B-02, D-11) Plan cards S2-T10, S2-T01, S7-T06 get complete "New files:" lines (the plan fixer names paths following the existing module layout of their Starts-from paths — this is allowed as layout naming, not a product decision).
- Q-20 (B-03) The legacy "Jenis Soalan" → 11 types map lives in 50 DM-69 as a table (derive rows from 30 FR-ADM-QE3.2's own migration sentence and the V2 mode names listed in 30); plan S2-T01 cites DM-69, not 30 QE3.8.
- Q-21 (B-04) Kiriman Guru tab rows and tiles are intake ITEMS with `source=guru` (API-Q-15 filter), counted by OPT-KIRIMAN-STATUS; 30 Q-12 and plan S2-T02 say so.
- Q-22 (B-07) "Highest total already paid" is derived: the max `coins_awarded` over the pupil's earlier submitted attempts of the same paper (no new column); 46 §3.4.9 and the owning DM row state it.
- Q-23 (B-08) SubjektifAttemptPage starts with API-BIJAK-04 body `{paperId, kind: 'subjektif'}`, untimed; rows mode `subjektif`.
- Q-24 (D-01) The teacher mission form gains a required "Subjek" select (OPT-SUBJEK) in 20 R1-GUR-2b; the draw uses it.
- Q-25 (D-02) Migration 0127 is written by the S1 holder at S6-T16's request (decision 7); DM-42 and the plan say so.
- Q-26 (D-03) 48 GAME-20 names the draw location of plan S6-T16 (`classes/missions/practice-assignments.adapter.ts` + `question-pool.ts`).
- Q-27 (D-04, D-05) S6-T14 deps add S6-T20; AC-GUR-8-8 / FR-GUR-8-7 are proven by S6-T10 (owner of API-GUR-06) — 4.0 E row.
- Q-28 (D-08, D-09) DM-77 lists the columns added to `rewards` / `reward_redemptions`; `rewards.cost_coins` is the price and each redemption stores `cost_coins_snapshot`. The admin "double submission" flag is computed (no column): the same pupil has another non-cancelled redemption of the same reward in the same session year; 60 API-ADM-15 and 30 FR-ADM-P2-08.3 say so.
- Q-29 (D-12) 60 API-ADM-25 / API-ADM-17 bodies list exactly the 30 P2-14 P14-nn fields.
- Q-30 (D-14) DM-38 key rows are seeded by S7-T01 (migration 0224); S7-T01's Done excludes the ranking half of AC-GM-01.10 (S7-T06 proves it); one cancel route only (the plan fixer names which existing one stays).
- Q-31 (D-16) `selalu_salah` = questions the pupil answered at least twice, every answer wrong, within the filter scope (Subjek + period); 10 R1-MUR-6 and 60 §2.17.6 say so.
- Q-32 (D-18) API-RPT-01/02 accept `chapterId` for the Fokus action.
- Q-33 (D-20) When TOV is missing and ETR exists: Jurang and OTR show "—"; the status is the HC-SPEC value for a missing TOV if HC-SPEC defines one, else list it under "Needs lead decision" (do not invent copy).
- Q-34 (C-20) Writable modes: count them in 40's master table and make 10 A1 say the same number.

## Later decisions (round 6 follow-up)

- Q-23 (revised): Kertas Subjektif start uses API-BIJAK-04 body `{paperId, mode}` as 60 states; the attempt kind `subjektif` is derived from the paper surface; the sitting is untimed (60 wins on technical shape).
- Q-33 (decided): when TOV is missing and ETR exists, Jurang and OTR show "—" and the status pill reads "Belum Ada TOV".
- Q-35: OPT-KIRIMAN-STATUS is a display mapping over the intake item statuses; a teacher paper batch still being extracted shows one row "Sedang diproses".
- Q-36: the `tapis` filter of Analisa Item applies to every items list; games wire the BM/EN control (FR-PA-04 component, S8-T03) through card S7-T01.
- Q-37: reward price is the existing `rewards.token_cost`; each redemption stores `token_cost_snapshot` and `cost_value_sen_snapshot`; the session budget sums `cost_value_sen_snapshot`.
- Q-38: card S6-T20 depends on S1-T06; its teacher paper pages (part 2) merge after S6-T14 (removes a dependency cycle).

## T10 run-7 decisions — STRICT MODE

- R-1 (A-01) Key kind `options` = `{correctOptionIds: Id[]}` only (no `choices`/`choice` for it); other key kinds keep their 45 §7.0 fields. Plan S1-T09a and 10 A2 item 8 copy this.
- R-2 (A-02) Gate rows whose validators come from S1-T09a/b pass (inert) until those cards merge; their ACs are proven by S1-T09a/b ("part 2"). Plan S1-T02 says which rows.
- R-3 (A-03) Kesukaran is set on every save (typed, or the default); `NO_DIFFICULTY` fires only when `difficulty_level` is null (legacy rows); `difficultyDefaulted` is a response hint only, never stored. 50 DM-47 and 45 §4.1 row 9.
- R-4 (A-04) Migration 0163 is written by the S3 holder at S1-T10's request (decision 7), like 0127.
- R-5 (A-05) `drawing_template` is added to FILE_PURPOSES in S1-T09b's own backend PR (S1-owned file; no separate contract PR).
- R-6 (B-01) The review payload of a batch carries `targetPaperId` (non-null when a paper has `source_batch_id` = this batch); S2-T02 uses it to pick API-BIJAK-14 vs API-Q-25; that branch is S2-T02 part 2 after S3-T06. 60 §2.17.4 batch shape and plan S2-T02.
- R-7 (B-02) Kiriman Guru = Q-35 (40 OPT-KIRIMAN-STATUS display mapping over intake items; batch row "Sedang diproses" while extracting). 45 §3.4 copies it.
- R-8 (B-05) Select-all-by-filter bulk offers only Terbitkan and Arkib (API-Q-04 filter route); Hantar is per selection only. Plan S2-T01.
- R-9 (B-06) The alias `/admin/studio/questions/:id/edit` → `/sunting` is S2-T01's, in `routes/questions-form.ts`. Plan S2-T01/S2-T03 and 45 §9.
- R-10 (B-10) Kertas Subjektif `Tempoh (minit)` and `Jumlah Markah` are stored on the paper row (DM-23: use existing columns if present, else extend DM-23 with `duration_minutes int null` (null = untimed, shown as information only) and `total_marks int`); API-BIJAK-14 / the paper detail carry them.
- R-11 (B-12) The hand-over parameter is `subjectId` everywhere (plan S3-T07, 10 R1-MUR-17, 60 API-PRAC-10).
- R-12 (B-14) A second Kuiz finish is idempotent: 200 with the same result; the 409 "Kuiz ini sudah selesai." is removed from 46 §4.3.
- R-13 (C-01) 40 AC-CHAIN-1(d): the test Bab "UJI Rantaian" holds exactly 3 questions, the drill count is 3, the session ends after the 3rd answer (no early "Tamat" control is needed).
- R-14 (C-02) 50 DM-48 says what FAQ Q43 says: the helper `coinsPerCorrect()` reads the `reward_settings` row when it exists, else 1; S7-T05 creates the row; no reader switch PR.
- R-15 (C-03) `exam_attempts.kind` gains `structured` (extend the exam_attempts DM row's kind check; migration owned by S5-T11). Plan S5-T11.
- R-16 (C-04) Soalan Berstruktur reward = rate × awarded marks (46 wins); paid once per set: only the gain over the highest total already paid for the same set. 10 §4.4 and DM-25 copy it.
- R-17 (C-05) AC-PA-14 owner is S1-T09a (46 §7.2/§9.2 already); plan S5-T11 drops it.
- R-18 (C-06) Migration 0181 adds the `mode` check and NOT NULL as NOT VALID; it is validated (part 2 of S5-T15) when the direct-writer allow-list is empty. DM-44 and plan S5-T15.
- R-19 (C-07) S6-T03 proves the query-level ACs (AC-XS-1..3); AC-XS-4 and AC-X4-1 are proven by the screen cards S10-T01 / S10-T07 / S6-T13 (plan 4.0 E row).
- R-20 (C-08) The Misi Harian pupil path is S6-T07's (the writer in 40's master table); 46 §4.12 and 48 GAME-20 name S6-T07; S5-T03 drops AC-GM-20.2/20.5.
- R-21 (C-09) The `roles: []` at `routes/prestasi.ts` is the student/parent `/laporan-mingguan` route and stays unchanged; S6-T01 changes only the teacher route `/guru/laporan-mingguan-kelas` (and the `/guru/laporan-mingguan` redirect).
- R-22 (D-01) Headcount pupil "Active" = has an ETR for that config (P-10); 20 FR-GUR-3-9 and its "Pupil entry status" text copy it.
- R-23 (D-02) The Dashboard "Set Soalan" entry tile is added by S6-T14 itself (same sector file); plan S6-T14 no longer waits for S6-T07.
- R-24 (D-03) Settings key / column names: DM-38 is the master; DM-48 uses its names.
- R-25 (D-04) API-GUR-16 list response adds `summary {total, siap}` and accepts `classroomId`.
- R-26 (D-05) API-ADM-25 has two create routes, one for tournaments and one for leagues, each with its own body (league fields only on the league route); `levelIds` are numeric ids. 48 GAME-15 names the league route.
- R-27 (D-06) A teacher personal question (`teacher_private`) is Diluluskan on save (no review) and is servable only in the owner's missions (activity `misi`); 45 §3.4 and 40 OPT-STATUS-SOALAN note it.
- R-28 (D-07) Soalan & Rujukan edit page: New file `SoalanRujukanEditPage.vue`, route `/guru/soalan-rujukan/:id/sunting` (plan S6-T16).
- R-29 (D-08) "Used by an active Misi" = drawn into an assignment of a mission whose status is active (20 GUR-44a).
- R-30 (D-09) An out-of-class pupil answers 404 (60 §1.7 default); 20 AC-GUR-4-2 says 404.
- R-31 (D-10) Plan S10-T09 gets a New files line (pupil Headcount page path following the S10 layout).
- R-32 (D-11) S5-T08 removes the pupil "Sertai" box and the join-code fields (plan S5-T08 / S6-T14).

## T10 run-8 decisions — STRICT MODE

- S-0a Migration files: a card may create the migration file(s) that a DM row it owns names (no "New files:" entry needed). A migration on a table whose schema file belongs to another sector is written by that sector's holder at the card's request (decision 7); if no team holds that sector, the requesting card's team writes it in a PR labelled `needs:S<n>` that the product owner reviews. START-HERE decision 12(c), plan §0B, FAQ Q10 and Q41 say this.
- S-1 (A-01) Blur validation of free-text SP (FR-ADM-QE4.3) is S1-T02's: it calls API-Q-05 validate; S1-T03 only renders the result. Plan 4.0 E row + S1-T02 Approach.
- S-2 (A-02) 45 §4.1 gate table gets an "Owner card" column: rows that check an answer key or a question-type field → S1-T09a; rows that check a drawing template or table_fill cell → S1-T09b; every other row → S1-T02. (R-2 inert-until-merge rule stays.)
- S-3 (A-10) A printed Bahagian matches a Disahkan contract section by label, trimmed and case-insensitive ("Bahagian A" = "bahagian a"); the matched section's `semua` / `pilih N` is copied; no match → `semua`. 45 import section and plan S1-T10.
- S-4 (A-15) For `drawing` and `table_fill`, Terbit is refused only by gate rows 21 and 22 (missing template, blank cell). Plan S1-T09b wording.
- S-5 (C-01) `practice_answers.is_test` already exists (DM-44); plan S5-T15 removes it from its "add" list.
- S-6 (C-02, C-03) There is no `exam_attempts.kind` column. The attempt kind is the existing column `exam_attempts.paper_kind` (check today: `pilihan`, `jana`, migration 0013). New row DM-83 (Build, owner S3-T06): migration `0186_s3_exam_attempt_paper_kind` (replaces the name `0186_s5_exam_attempt_kind_structured`) widens `ck_exam_attempts_paper_kind` to `pilihan, jana, subjektif, structured`. A Kertas Subjektif sitting has `paper_kind='subjektif'` and `paper_id` set; a Soalan Berstruktur attempt has `paper_kind='structured'`, `paper_id` null, `composition` = the frozen question list, `title` = the set title; both use `mode='latihan'` (untimed). Every "attempt kind subjektif/structured" text means `paper_kind`. 50 ENT-ExamAttempt, §4.7a, §4.8 migration table (count unchanged), DM-83 row; plan S3-T06 (Data line, migration) and S5-T11 (drops the migration, cites DM-83); 60 API-BIJAK-04/05 and API-PRAC-10.
- S-7 (C-04) `kbatLevel` = the question's Aras index in OPT-ARAS order (Mengingat 1, Memahami 2, Mengaplikasi 3, Menganalisis 4, Menilai 5, Mencipta 6). KBAT = Aras 3..6 (KPM definition: Mengaplikasi, Menganalisis, Menilai, Mencipta). OPT-ARAS-KBAT badges 3..6; 50 line ~1313 stays; 60 API-PRAC-10 names `kbatLevel` with this source.
- S-8 (C-05) S5-T01 owns the CI seed fixture for AC-X3-1: a T1 and a T5 pupil, each with servable questions; `docs/ops/e2e-seed.md` profile table lists them; plan S5-T01 says so.
- S-9 (C-06) The 404 start check for an unassigned Set Soalan is S5-T11's (it already depends on S6-T14); S5-T03 drops it; 60 API-PRAC-01 names S5-T11 for that check.
- S-10 (C-07) S6-T03 implements XS-1..XS-8 in `xs-queries.ts` (XS-6, XS-7 as queries; XS-8 = every query reads all modes from `practice_answers`); screen cards (S10-T01..T04, S6-T13) import them. 60 §4.6 lists XS-1..8; S10-T02 text no longer claims XS-6..8.
- S-11 (C-08) Plan §5A: delete the clause saying S9-T06's deps are the chain-last cards (N-1 stands: S9-T06 has no deps).
- S-12 (B-01) Plan 4.0 E R1-MUR-13 row: FR-MUR-13-26/27/28 and AC-MUR-13-20..23 go to S3-T06 if their text is about Kertas Subjektif pages (check 10); otherwise leave and report.
- S-13 (B-02) FR-QA-18 rich-text toolbar: authoring editor = S2-T10; the sanitiser and pupil display = S8-T03. 4.0 E row and both cards; the plan fixer names the existing m04 editor file as S2-T10's path.
- S-14 (B-03, B-04) S2-T10 PRD line adds FR-QA-29 and FR-QA-30; `StudioLeafEditor.vue` goes in S2-T10 Starts-from if it exists in the repo, else in its New files (path following the m04 layout).
- S-15 (B-05) S2-T02 intake Tolak = API-Q-15 `.../reject` (not API-Q-06).
- S-16 (B-06) Stored intake item statuses are 40 OPT-KIRIMAN-STATUS's list (`pending`, `accepted`, `approved`, `draft` plus `rejection_reason`); there is no stored `rejected`; Tolak sets `rejection_reason` as 40 says. API-Q-15 accepts `status` ∈ those stored values and `kirimanStatus` ∈ OPT-KIRIMAN-STATUS display keys (mapped server-side). 30 Q-09/Q-12, 45 §3.3.4, 60 API-Q-15 align.
- S-17 (B-07) Group header actions are `Pisahkan` and `Lampirkan` (30 09-05); 45 §3.3.4 copies them; FAQ gets one line.
- S-18 (B-08) The helper `coinsPerCorrect()` is written by S5-T15 (both S3-T04 and S5-T03 depend on it); FAQ Q43, DM-48, plan S5-T03/S5-T15 and 48 say S5-T15.
- S-19 (B-09) `papers.level_scope` already exists (migration 0012, ENT-Paper); plan S3-T07 says "existing column", no DM change.
- S-20 (R-10 vs ENT-Paper) "Total marks never stored" holds for `pilihan`/`jana` papers; a `subjektif` paper stores the admin-typed `Jumlah Markah` in `total_marks` (DM-23). ENT-Paper text says so.
- S-21 (D-02) The "Urus set" Dashboard tile is S6-T14's (R-23); 20 R1-GUR-8b names S6-T14.
- S-22 (D-03) S6-T14 deps read "S6-T20 (part 1: migration 0200 only)"; S6-T20 part 2 merges after S6-T14. No cycle.
- S-23 (D-04) `/games/pertandingan` and `/games/uji-minda` are off in R1: the pages and `GET /api/games/pertandingan` / `GET /api/games/uji-minda` answer 404 (FR-GM-00.1); 60 API-GAME-02 drops them from the live list and notes "404 in R1"; S7-T01 owns the 404.
- S-24 (D-05) 48 §2 Storage follows FAQ Q43 (helper reads the row, no switch PR).
- S-25 (D-07) 60 API-GUR-16 list: key `rows`, `summary {total, siap}`, filter `classroomId`, paging `page`/`perPage` (60 §1 default), plus the counters R1-GUR-8b names (copy them).
- S-26 (D-08) Teacher CSV import (20 R1-GUR-44 F3): `bab` matches a chapter of the set's Subjek and Tingkatan by number, else by name (trimmed, case-insensitive); `sp` matches an SP code of that chapter; unknown → row error "Bab tidak dijumpai: {nilai}" / "SP tidak dijumpai: {nilai}", row skipped, other rows imported. 40 X10 gets the next ERR-GUR id for each.
- S-27 (D-13) 60 API-RPT-13: if §2.17.9 defines the rankings shape, the other docs align to it; if not, the 60 fixer writes the shape by copying the fields of 10 R1-MUR-18 and 48 GAME-16 (four scopes, "Sekitar anda") — list anything missing under "Needs lead decision".
- S-28 Paging params are the 60 §1 default `page`/`pageSize` (S-25 "perPage" was a slip).
- S-29 API-GUR-16 results route `summary {penyertaan, skorPurata, jumlahPercubaan}` + `classroomId` accepted (copies 20 R1-GUR-8b).
- S-30 State/national ranking pool = every active pupil of the scope, test accounts (is_test) excluded.
- S-31 45 §4.1 gate row 11 (MCQ rules) owner S1-T09a.

Lead follow-ups of round 8: `coinsPerCorrect()` lives in `apps/api/src/modules/practice/coins.ts` (S5-T15) and returns 1 until the `reward_settings` table exists; S6-T03 depends on S10-T01, S10-T02 and S10-T03 and switches their screen services to `xs-queries.ts`; S10-T04 and S6-T13 depend on S6-T03 and import it; the FR-QA-18 toolbar path is the existing Studio editor files.
