# R1 evidence list: 3472/2 (worked example) and the four go-live Kertas 1 blueprints

- **Task:** T39 (lane A3). Research and docs only: no seed, no blueprint data change, no code change, no server access.
- **Date:** 2026-10-31. **Base:** `feature/v3-bijak-r1` at BASE-6 (`21ae62dd`).
- **Context (user decision on Q3, D95 revised, as briefed by the Delivery Lead):** on UAT, Admin Pusat creates and verifies ("Sahkan") blueprints by hand in Kontrak Blueprint, following the real flow, with no seed. Order: 3472/2 first, then Matematik 1449/1, Sejarah 1249/1, Fizik 4531/1 and Sains K1.
- **Neither D95 nor Q3 exists in `docs/TRACKER.md` at BASE-6** (the decision table ends at D91). The briefed rule "evidence from 2 or more bodies" is in the repo as D76(4), AC-39.2 and AC-39.7 (`docs/requirements/v2-bijak-spm.md`). D77 in the TRACKER is the unrelated Pemantauan revoke.
- **Tags:** "confirmed" = read in a repo file (path given) or replayed (see 1.3). "unconfirmed" = not verifiable in the repo; do not treat as fact. Bodies are the exam-board ids of the Kontrak evidence form (`sbp`, `selangor_mpsm`, `lpm`, `mrsm`, free text normalised to snake_case).
- **Privacy:** no person names appear here. Documents are named by kind, body and year only.

## 0. Summary

| Blueprint | Ready to Sahkan? | Missing evidence |
|---|---|---|
| **3472/2** Matematik Tambahan K2 (worked example, section 2) | **Yes on repo data, with one unconfirmed input.** Replay of the seed definitions: gate (a) to (d) and (f) clean once values are typed by the admin; evidence check passes (2 bodies, each paper + skema). Caveat below. | Duration (150) has two supporting bodies only if both covers state it. SPP says the Selangor file has no cover page, so its 150 is unconfirmed (the seed evidence states it anyway). Needs: the cover page of the Selangor 2025 3472/2 paper, or a cover of a third body's 3472/2 paper, or an LPM format document. If neither exists the admin enters duration for one body only and `durationMin` stays "tidak disahkan", which blocks Sahkan. |
| **1449/1** Matematik K1 | **No.** | (1) Section KBAT marks undetermined (35 or 36; Q13 page of the SBP paper unreadable): needs a legible scan of the SBP 2025 1449/1 paper, page with Q13. (2) Body rule: SBP has paper + skema, Selangor has a paper only: needs the Selangor 2025 1449/1 skema (SPP 10.1 says it was read, but no value is recorded in the repo), or the Johor 2025 Set 1 1449/1 paper + scheme (read per `v2-exam-schema.md` section 1, values only in prose), or an LPM format document. (3) Duration conflict to settle: 90 (3 trial bodies) vs 75 (existing PoC row, "official" convention). |
| **1249/1** Sejarah K1 | **No.** | One body only (Selangor 2025 paper; its scheme read per `v2-exam-schema.md` 8.2). Needs a second body's 1249/1 paper + skema (any other state or SBP 2025 set) or an LPM format document. Also: difficulty profile, per-Tajuk quota (T5 side not derivable in the repo; needs a textbook Bab-to-SK table) and KBAT marks do not exist anywhere. |
| **4531/1** Fizik K1 | **No.** | Papers: Selangor 2025 only; SBP has a skema (K1 key table inside the 4531/2 skema file) but no K1 paper in the repo. Needs the SBP 2025 4531/1 question paper (or another body's paper + skema, or an LPM format document). Also: difficulty profile and KBAT marks do not exist; quota exists only as a single-body reading (section 5.1). |
| **Sains K1** (code unconfirmed: PoC `4541/1`, web `1511/1`) | **No.** | Nothing in the repo beyond DB-derived figures (75 min, 40 mcq). Needs two bodies' Sains K1 paper + skema (any 2025 or later state trial sets) or an LPM format document, plus profile, quota and KBAT authoring against `docs/reference/dskp/sains.json`. The paper code must be read from a cover first. |

Shortest path for all four: one LPM format / JSU document per paper (`lpm_format` evidence). The check counts it as two supporting bodies and waives the "two bodies each with paper + skema" rule (`packages/exam-core/src/evidence.ts:buildLine`, `:checkEvidence`). It still fails on any contradicting statement, e.g. an LPM duration of 75 against a blueprint of 90. No LPM document is in the repo (open items Q-B16, Q-B17).

## 1. What Sahkan checks (read from code)

### 1.1 Code paths

| Step | Code |
|---|---|
| Route `POST /admin/blueprints/:subject/:kertas/verify` (Admin Pusat only, `@Roles('admin')`) | `apps/api/src/modules/exam/blueprints/blueprints.controller.ts` (`@Post(':subject/:kertas/verify')`) |
| Verify flow: lock head, run check, 422 `VERIFICATION_FAILED` with the full `check`, else insert-only verification row and flip `source`/`serves_students` | `apps/api/src/modules/exam/blueprints/blueprint-verification.service.ts:BlueprintVerificationService.verify` (line 180) |
| The check itself (all failures listed at once) | same file, `private check` (line 228) |
| Live check without writing (the Pengesahan tab) | same file, `state` (line 157) |
| AC-39.1 (a) to (d) and (f): `validateBlueprint` plus completeness | `packages/exam-core/src/validate.ts:validateForVerification` (line 274), `:validateBlueprint` (line 204) |
| AC-39.1 (e) and AC-39.7: evidence comparison and body rule | `packages/exam-core/src/evidence.ts:checkEvidence` (line 106), `:buildLine` (line 63) |
| Adapter (only import point of exam-core in the exam module) | `apps/api/src/modules/exam/blueprints/exam-core.adapter.ts` |
| Evidence writes (locked once Disahkan, 409) | `blueprint-verification.service.ts:addEvidence` (line 88), `:removeEvidence`, `:assertEditable` |
| Save = new version; values typed by the admin are "reviewed" | `apps/api/src/modules/exam/blueprints/blueprints.service.ts:create` (line 167), `:addVersion` (line 210), `:input` (reviewed flags) |
| Requirement text | `docs/requirements/v2-bijak-spm.md` AC-39.1, AC-39.2, AC-39.7, AC-39.9; design `docs/architecture/v2-bijak-spm-standards.md` 6.6 |
| Front end gate rows, Sahkan button, evidence drawer | `src/modules/m28-bijak-spm/admin/kontrak/domain/verify.ts:gateRows`, `components/VerifyPanel.vue`, `components/EvidenceDrawer.vue` |

### 1.2 The checks, in the order Sahkan evaluates them

`passes` is true only when `blueprintProblems`, `completeness` and every evidence line are empty or `ok` (`blueprint-verification.service.ts:check`).

| # | Check | Code | Rule |
|---|---|---|---|
| C1 | Consistency (AC-39.1a) | `validate.ts:validateBlueprint` | `TOTAL_MISMATCH` (stated total vs sum of section budgets); `CHOOSE_N_RANGE` (N in 1..M and budget divisible by N); `MODES` (modes outside the M04 leaf modes); profile tiling `SLOT_GAP`/`SLOT_OVERLAP`; `PROFILE_SHAPE` (TP 1..6, min <= max, ladder non-decreasing, `bahagian` kind needs exactly one group unless choose, choose needs exactly one group); `TP_COUNTS`; `MARKS_BAND`; `QUOTA_SUM` (lines sum to offered marks, or to M for basis questions; no duplicate unit, no negative); `QUOTA_UNIT` (unit must exist in the subject's DSKP nodes); `LEVEL_SHARE` (stated share must equal the share implied by the lines); `KBAT_RANGE` (0..offered marks); `KBAT_TOTAL` (paper KBAT must equal the sum of sections when every section has a value) |
| C2 | Duration (AC-39.1a) | `validate.ts:validateForVerification` | `NO_DURATION` when duration is empty or < 1 |
| C3 | Profile per section (b) | same | `NO_PROFILE` |
| C4 | Quota per section (c) | same | `NO_QUOTA`; `NO_SHARE` when the subject has T4 and T5 units in the DSKP and a section's unit levels cannot be derived |
| C5 | KBAT per section (d) | same | `NO_KBAT` when `kbatMarks` is null (0 counts as filled) |
| C6 | Reviewed (f, AC-39.9) | same | `UNREVIEWED` for each quota line or section KBAT still "Belum disemak". A value typed and saved by the admin is reviewed (`blueprints.service.ts:input`, `quotaToDoc`), so this only affects seeded rows. |
| C7 | Body rule (e, AC-39.2) | `evidence.ts:checkEvidence` | `NO_EVIDENCE_BODIES` unless some `lpm_format` item exists or at least 2 distinct bodies each have a `trial_paper` item AND a `skema` item |
| C8 | Evidence lines (AC-39.7) | `evidence.ts:checkEvidence`, `:buildLine` | For `durationMin`, `totalMarks`, and per section matched by position `markBudget`, `rule`, `questionCount`: any contradicting statement = `differs`; no statement = `not_covered`; fewer than 2 supporting bodies = `tidak_disahkan`; else `ok`. An `lpm_format` item counts as one extra supporting body. Every line must be `ok`. Topic quota and KBAT are not compared. |

Front end only (not server rules): Sahkan is refused while the form is unsaved ("Simpan perubahan dahulu.") and while "Nota pengesahan" is empty (the server accepts an empty note). Source: `VerifyPanel.vue`, `reason`.

### 1.3 How "would it pass today" was determined

`packages/exam-core/src/validate.ts` and `evidence.ts` are pure functions. They were replayed with `bun` (scratch scripts in the session scratchpad, not committed) on the seed definitions `apps/api/prisma/seed/bijak-standards/layer1.ts`, `evidence.ts` and `docs/reference/blueprints/*.json`, with unit levels taken from `docs/reference/dskp/*.json`. This reproduces C1 to C8 without the database and without the service. It does **not** prove the UAT database state (units loaded, existing rows). Results:

| Code | Gate as seeded | Gate after the admin has reviewed every value | Evidence check with the seeded study rows |
|---|---|---|---|
| 3472/2 | no problems; `UNREVIEWED` only | **clean** | **passes** (all lines ok, bodies rule met) |
| 1449/1 | no problems; `NO_KBAT@1`, `UNREVIEWED` | `NO_KBAT@1` | all lines ok, but `NO_EVIDENCE_BODIES` |

Variants replayed for K1 (one section, all, 40 questions, 40 marks):

| Evidence set | Result |
|---|---|
| SBP paper + SBP skema + Selangor paper (as the 1449/1 seed) | fails: `NO_EVIDENCE_BODIES` |
| the same + Selangor skema | passes |
| one `lpm_format` item with duration 90, total 40, section 1 stated | passes |
| `lpm_format` with duration 75 + trial papers saying 90 | fails: `durationMin: differs` |
| two bodies with paper + skema, one body's paper omits duration | fails: `durationMin: tidak_disahkan` |

## 2. Worked example: 3472/2 Matematik Tambahan Kertas 2 (the admin does this first)

Why first: both layer-1 and layer-2 values exist, all four sections of the check are satisfiable from repo data, and there is no PoC row to collide with (the PoC bank holds only Matematik K1/K2 and Sains K1/K2; `apps/api/src/modules/bijak/papers/poc/poc-bank.ts`).

### 2.1 Prerequisites (unconfirmed on UAT: no server access)

1. Logged in as Admin Pusat (`admin`). Other roles get 403 (AC-39.3).
2. The DSKP loader has run, so "Tambah unit" lists Matematik Tambahan T4 and T5 units (`docs/ops/dskp-loader.md`: UAT had 0 nodes before it ran). Without units, quota lines cannot be added and the gate fails.
3. No existing 3472/2 contract. If "Tambah Kontrak" shows "Kontrak untuk subjek dan kertas ini sudah wujud.", open it with "Buka kontrak" instead and edit; each Simpan then makes a new version.

### 2.2 Steps in Kontrak Blueprint

1. Open Kontrak Blueprint, press **Tambah Kontrak**. Subjek: Matematik Tambahan. Kertas: Kertas 2. Press **Teruskan** (opens an empty Draf).
2. **Maklumat Kertas:** Kod kertas `3472/2`; Tempoh (minit) `150`; Jumlah markah `100`; Status `Spec` (Draf is allowed; Disahkan is set only by Sahkan).
3. **Piawaian Peringkat Kertas (optional):** Sub-bahagian menaik off. Nisbah Tingkatan 4 / 5 may stay empty (each section carries its own). Kuota KBAT kertas: `130` is allowed; if filled it must equal the sum of the section values (`KBAT_TOTAL`).
4. **Tambah Bahagian** three times and fill:

| Field | Bahagian A | Bahagian B | Bahagian C |
|---|---|---|---|
| Label | Bahagian A | Bahagian B | Bahagian C |
| Bilangan soalan (M) | 7 | 4 | 4 |
| Jawab | semua | pilih N = 3 | pilih N = 2 |
| Belanjawan markah (selepas pilih N) | 50 | 30 | 20 |
| Mod jawapan dibenarkan | none (any) | none | none |
| Profil Kesukaran | `bahagian`, one group slot 1-7, TP 3-5, markah setiap soalan 5-9 | `bahagian`, one group slot 1-4, TP 4-5, markah 10-10 | `bahagian`, one group slot 1-4, TP 4-6, markah 10-10 |
| Kuota Topik, basis | markah | markah | markah |
| Kuota Topik, lines (T4/T5 unit = value) | T4 1.0 = 7; T4 2.0 = 8; T4 4.0 = 8; T4 8.0 = 6; T5 1.0 = 6; T5 2.0 = 7; T5 6.0 = 8 (sum 50) | T4 6.0 = 10; T4 7.0 = 10; T5 3.0 = 10; T5 5.0 = 10 (sum 40) | T4 9.0 = 10; T4 10.0 = 10; T5 7.0 = 10; T5 8.0 = 10 (sum 40) |
| Nisbah (optional) | T4 29 : T5 21 | 20 : 20 | 20 : 20 |
| Markah KBAT (tepat) | 50 | 40 | 40 |

   Sources: structure `apps/api/prisma/seed/bijak-standards/layer1.ts` (3472/2); quota, shares, KBAT and marks bands `docs/reference/blueprints/3472-2.json`; unit names `docs/reference/dskp/matematik-tambahan.json`. Quota values are the SBP reading (Selangor differs in A); the analyst notes in the JSON file list the alternatives. The README of that folder flags that nearly all marks come out as KBAT and asks for the encoding to be confirmed (O-3): the KBAT figures are analyst readings, not printed anywhere, and the admin owns them at Sahkan.
5. Press **Simpan**. A 422 `BLUEPRINT_INVALID` lists every problem (e.g. quota sum, total mismatch). Fix and save again. Replayed on these exact values: no problem codes.
6. Open the **Pengesahan** tab. Press **Tambah Bukti** four times (Jenis bukti, Badan penerbit, Tahun 2025, Kod kertas `3472/2`):

| # | Jenis | Badan | Values to type | Source in repo |
|---|---|---|---|---|
| E1 | Kertas percubaan | SBP | Tempoh 150 (only if the cover shows it, see caveat); Jumlah markah 100; rows: A markah 50, Jawab semua, 7 soalan; B markah 30, N daripada M with N = 3, 4 soalan; C markah 20, N = 2, 4 soalan | `evidence.ts` `ADD_K2`; `docs/discovery/SPM-paper-patterns.md` (SPP) section 4 and 10.2 |
| E2 | Kertas percubaan | Selangor MPSM | Same as E1. Leave Tempoh empty unless the cover is seen (SPP section 2: "cover and formula pages absent from the file") | same |
| E3 | Skema jawapan | SBP | One row only: A markah 50. Do not add rows for B and C | SPP 10.2 (all 15 totals confirmed) |
| E4 | Skema jawapan | Selangor MPSM | One row only: A markah 50 | SPP 10.2 |

   Entry rules that avoid false failures (from `EvidenceDrawer.vue`): a row's rule defaults to "Semua" and is always sent, so a skema row for a choose section would state "all" and be marked `differs`. A skema prints offered marks for B and C (40 each), but the "Markah" field is compared with the effective budget (30 and 20), so typing 40 would also be `differs`. Rows are matched by order (row 1 = A). Use the same body id every time (the form lowercases and underscores: "Selangor MPSM" becomes `selangor_mpsm`).
7. Press **Semak Bukti**. Expected: every line "Sepadan", gate rows green. If Tempoh shows "Tidak disahkan", only one body supplied a duration: see the caveat.
8. Fill **Nota pengesahan**, press **Sahkan**, confirm "Sahkan kontrak ini?". Expected message: "Kontrak berjaya disahkan." The badge becomes Disahkan, evidence is locked (409 on further evidence edits) and any structural edit afterwards becomes a new Spec version (AC-39.4).

### 2.3 Checks for 3472/2 and whether each passes today

| Check | Result with the values above | Basis |
|---|---|---|
| C1 consistency | pass: total 100 = 50+30+20; N divides budgets; quota sums 50/40/40 = offered marks; stated shares equal the implied shares (29:21, 20:20, 20:20); KBAT 50/40/40 within offered marks; 50+40+40 = 130 | replay, `validate.ts` |
| C2 duration | pass (150) | replay |
| C3 profile | pass (one covering group per section) | replay |
| C4 quota and share | pass (needs the DSKP units loaded) | replay; UAT state unconfirmed |
| C5 KBAT | pass (values supplied) | replay |
| C6 reviewed | pass (admin-typed values are reviewed) | `blueprints.service.ts:input` |
| C7 body rule | pass with E1 to E4 (SBP and Selangor each have paper + skema) | replay |
| C8 evidence lines | pass if E1 and E2 both state duration 150; **otherwise `durationMin` is `tidak_disahkan` and Sahkan is blocked** | replay; Selangor duration unconfirmed |

Items the evidence does not cover but which are not compared: topic quotas and KBAT (author-set, AC-39.7).

## 3. Kontrak form fields for the four K1 blueprints

Common to all: one section, rule "Jawab semua", answer mode "Aneka pilihan" (`mcq`), 1 mark per question, `Sub-bahagian menaik` off. Subject pick in Kontrak uses Bijak codes: Matematik `MAT`, Fizik `PHY`, Sejarah `SEJ`, Sains `SN` (`apps/api/src/modules/bijak/papers/subject-codes.ts`; curriculum codes MATH, PHY, SEJ, SCI).

| Field | 1449/1 Matematik K1 | 1249/1 Sejarah K1 | 4531/1 Fizik K1 | Sains K1 |
|---|---|---|---|---|
| Kod kertas | `1449/1` | `1249/1` | `4531/1` | **unconfirmed**: PoC bank `4541/1` (`poc-bank.ts`; 4541 is the printed Kimia code), web search result `1511/1` (not verified here); read it from a cover |
| Tempoh (minit) | **90** per seed and SPP 4 (SBP, Selangor), Johor scheme cover (`v2-exam-schema.md` D7). Conflict: existing PoC row 75; D7 calls 75 the "official, INFERRED" convention | 90 (printed "1 jam 30 minit", Selangor; `v2-exam-schema.md` D7) | 75 (printed "1 jam 15 minit", Selangor; D7) | unconfirmed: 75 in the .cloud DB (D7), 60 in the PoC row |
| Jumlah markah | 40 | 40 | 40 | 40 (DB, D7) |
| Bahagian (label) | one section; seed label "Bahagian A" (D7 calls it "Objektif") | one section, label free | one section, label free | one section, label free |
| Bilangan soalan (M) | 40 | 40 | 40 | 40 |
| Belanjawan markah | 40 | 40 | 40 | 40 |
| Profile | seeded: `ladder`, groups 1-10 TP 2-4, 11-20 TP 2-4, 21-30 TP 3-5, 31-40 TP 3-5, marks 1-1 (TP bands are [Default] proposals, SPP 5.1, "inferred, must be re-measured") | none in repo | none in repo; SPP/D8.1: Fizik K1 follows unit order, not difficulty | none in repo |
| Quota | seeded: basis questions, 16 lines (section 4.1), share T4 13 : T5 10 | none in repo; candidate in 5.2 | candidate in 5.1 | none in repo |
| KBAT (tepat) | **not set**: 35 or 36 (INCOMPLETE) | none | none | none |
| Existing contract at UAT | PoC row v1 (75 min, 10 marks, pool `MAT1-A`) if the exam seed ran (unconfirmed) | none expected (demo seed adds Sejarah K2 only) | none expected | PoC row `4541/1` (60 min) if the exam seed ran (unconfirmed) |

Validity rules for a K1 profile (`validate.ts:profileProblems`): groups must tile 1..40; kind `bahagian` allows exactly one group; kind `ladder` needs TP minimum and maximum non-decreasing across groups; a marks band, if filled, must be able to reach the 40 marks (so its minimum can only be 1).

## 4. 1449/1 Matematik K1

### 4.1 Definition in the repo (seed)

`apps/api/prisma/seed/bijak-standards/layer1.ts` (structure, profile, confidence high, bodies sbp + selangor_mpsm) and `docs/reference/blueprints/1449-1.json` (quota, share, notes). The seed module `exam-launch-blueprints.ts` (`examLaunchBlueprintsSeed`) is not used on UAT; its values are the admin's typing source.

Quota lines (basis questions, sum 40): T4 1.0 = 1; 2.0 = 2; 3.0 = 2; 4.0 = 2; 5.0 = 1; 6.0 = 1; 7.0 = 2; 8.0 = 1; 10.0 = 1 (13); T5 1.0 = 1; 2.0 = 2; 3.0 = 2; 4.0 = 1; 5.0 = 2; 6.0 = 2 (10); bucket "T1-T3, luar DSKP" = 17. Nisbah T4 13 : T5 10. Tags per `docs/reference/blueprints/README.md`: 0 observed, 2 inferred, 14 single-source (SBP only, because Selangor was sampled at 15 of 40). The 17 in the bucket includes 3 ambiguous items (Q20, Q25, Q28) placed there by rule; T4 4.0 = 2 comes from a partly legible page.

### 4.2 Evidence already in the repo

| Body | Item | Values | File |
|---|---|---|---|
| SBP 2025 | trial paper 1449/1 | 90 min, 40 marks, A: 40 q, all, 40 marks. 39 of 40 items read (one page unclear) | `apps/api/prisma/seed/bijak-standards/evidence.ts` (`MAT_K1`); SPP section 2 and 4 |
| Selangor MPSM 2025 | trial paper 1449/1 | same values; only 15 of 40 items read | same |
| SBP 2025 | skema | total 40 (the scheme prints (K1 + K2) / 140, so K1 counts 40); no rule, no duration | same; SPP 10.2 |
| Selangor MPSM 2025 | skema K1 | read in full (2 pages) per SPP 10.1, answer key accepts two options for Q1. **No value recorded in the repo**; not in the seed rows | SPP 10.1, 10.2 |
| Johor 2025 Set 1 | paper and scheme (text layer) | 40 q mcq; "1 jam 30 min" printed on the scheme cover; 19 of 40 items T1-T3 (SPP 5.5) | `docs/requirements/v2-exam-schema.md` sections 1, 7 (D7), 8.2. Values only in prose; body id would be `johor` (an exam-board value, D8) |

Documents live outside the repo (shared Drive folders, see SPP section 2; DSKP PDFs are not committed).

### 4.3 Missing to reach 2+ bodies and a passing gate

1. **KBAT marks (C5):** a legible copy of the SBP 2025 1449/1 paper, page with Q13, so the cognitive level can be read; 35 or 36 are the only candidates in `1449-1.json`. No skema or other file states cognitive level or KBAT (SPP 10.5), so the figure stays an analyst reading that the admin must own. A second body's K1 would also reduce the single-source risk.
2. **Body rule (C7):** a second body with BOTH paper and skema. Cheapest: the Selangor 2025 1449/1 skema (already read; type its values) giving SBP and Selangor. Alternative: the Johor paper and scheme. Alternative: one LPM format document.
3. **Duration (C8, settle before typing):** three trial bodies say 90. If an LPM document or official timetable says 75, the line becomes `differs` and the blueprint must follow the LPM value. Not resolvable from the repo.

### 4.4 Checks and whether they pass today

| Check | Result | Basis |
|---|---|---|
| C1 to C4 | pass (replayed on the seed values; needs Matematik DSKP units loaded) | replay |
| C5 KBAT | **fail `NO_KBAT@1`** until the admin enters a value | replay; `1449-1.json` notes |
| C6 | pass for typed values | `blueprints.service.ts:input` |
| C7 | **fail `NO_EVIDENCE_BODIES`** with SBP paper + skema and Selangor paper only | replay |
| C8 | all lines `ok` (duration 90, total 40, markBudget 40, rule all, 40 q: two bodies each) | replay |

## 5. 1249/1 Sejarah K1 and 4531/1 Fizik K1

Neither is in the seed (`layer1.ts` lists six codes; `architecture/v2-bijak-spm-standards.md` section 8 "Not seeded": Fizik K1, Sejarah K1, ... "cannot be Disahkan"; AC-40.5). There is no profile, no quota, no KBAT and no `blueprint_evidence` row for either.

### 5.1 4531/1 Fizik K1

Evidence in the repo:

| Body | Item | Values | File |
|---|---|---|---|
| Selangor MPSM 2025 (Set 1) | trial paper 4531/1 | 75 min ("1 jam 15 minit" printed), 40 q, single section, all, mcq with 3 or 4 options | `docs/requirements/v2-exam-schema.md` D7 and 8.2 (read by OCR) |
| Selangor MPSM 2025 | scheme K1 | read per the "4 per subject" count in section 1; **unconfirmed** that a K1 scheme was separate and what it states | same, section 1 |
| SBP 2025 | skema only | 40-row key table inside the 4531/2 skema file; key letter counts A 10, B 8, C 11, D 11 | SPP 10.4 and 10.6 |
| SBP 2025 | question paper 4531/1 | **not read** ("Fizik K1 and K3 not read") | SPP section 2 |

Quota candidate (basis questions, Selangor only, single body): T4 1.0 = 2; 2.0 = 3; 3.0 = 1; 4.0 = 3; 5.0 = 5; 6.0 = 5 (T4 19); T5 1.0 = 3; 2.0 = 5; 3.0 = 4; 4.0 = 2; 5.0 = 3 (confidence L, by order); 6.0 = 2; 7.0 = 2 (T5 21); sum 40. Source `v2-exam-schema.md` 8.2, labels at best Medium confidence (OCR). Not reviewed by anyone.

Missing: the SBP 2025 4531/1 question paper (a skema alone does not satisfy C7; it needs paper + skema per body), or any second body's 4531/1 paper + skema, or an LPM format document; a difficulty profile; per-question cognitive levels for the KBAT marks.

Checks today: C1 to C4 not runnable (no definition); C5 fail (no value); C7 fail (one body has a paper); C8 would be `tidak_disahkan` on every line until a second body states the same values.

### 5.2 1249/1 Sejarah K1

Evidence in the repo:

| Body | Item | Values | File |
|---|---|---|---|
| Selangor MPSM 2025 (Set 1) | trial paper 1249/1 | 90 min ("1 jam 30 minit" printed), 40 q mcq, all; 20 q on Tingkatan 4 and 20 on Tingkatan 5, 2 per Bab, 10 Bab per form | `docs/requirements/v2-exam-schema.md` D7 and 8.2; SPP section 2 ("cover only (40 MCQ, jawab semua)") |
| Selangor MPSM 2025 | scheme | prints Bab / Tingkatan / Muka surat per answer; K2 scheme only partly read | `v2-exam-schema.md` 8.2; SPP 10.1 |
| .cloud DB | derived blueprint 40/40 | not an issuing body; cannot count as evidence | `v2-exam-schema.md` D7 |

Quota candidate (basis questions, single body, **inferred**): Bab-to-Tajuk mapping for Tingkatan 4 is given (Bab 1-2 = Tajuk 9; Bab 3-6 = Tajuk 10; Bab 7-10 = Tajuk 11) which yields T4 Tajuk 9 = 4, Tajuk 10 = 8, Tajuk 11 = 8 (sum 20; confidence L-M, "to be confirmed with the textbook table of contents"). The Tingkatan 5 split over Tajuk 12 to 15 is **not derivable** in the repo (20 questions in total). Seed-style unit codes for the Kontrak picker are "Tajuk 9" to "Tajuk 15" (`docs/reference/dskp/sejarah.json`).

Missing: a second body's 1249/1 paper + skema (or an LPM format document); a textbook Bab-to-SK table (Tingkatan 5) for the quota; a difficulty profile (Sejarah K1 pattern was never studied); KBAT marks.

Checks today: same as Fizik K1 (C1 to C4 not runnable, C5 fail, C7 fail, C8 `tidak_disahkan`).

## 6. Sains K1

Nothing in the repo is a paper-derived definition.

| Source | Content | File |
|---|---|---|
| .cloud DB figures | K1 75 min, 40, single mcq section, confidence Medium; "no DSKP-aligned paper in the sample" | `docs/requirements/v2-exam-schema.md` D7 |
| PoC bank | Sains K1 contract `4541/1`, 60 min | `apps/api/src/modules/bijak/papers/poc/poc-bank.ts` |
| DSKP | 21 units (T4 12, T5 9), usable for the quota picker | `docs/reference/dskp/sains.json` |

The code `1511/1`: no repo file states it; a web search summary gave 40 objective questions in 1 jam 15 minit for 1511/1, but this was not confirmed against a paper cover and must be treated as **unconfirmed**. The PoC code `4541/1` shares the printed number of Kimia (Fizik is 4531, Biologi 4551 in SPP), so it may be a prototype placeholder; also unconfirmed.

Missing to reach 2+ bodies: for each of two bodies, a Sains K1 question paper and its skema (or one LPM format document); then profile, quota (per DSKP unit, basis questions) and KBAT marks authored from the papers.

Checks today: not runnable (no definition, no evidence); expect C3, C4, C5, C7 to fail until authored. The existing PoC contract, if present at UAT, must be edited (it is not a paper-derived Spec).

## 7. Surprises and contradictions found

1. `docs/SPM-SIMULASI-BLUEPRINT.md` named in the brief **does not exist** at BASE-6 (no file with "SIMULASI" in its name). Nothing was read from it.
2. Seed vs doc, 3472/2: `evidence.ts` (`ADD_K2`) gives the Selangor trial paper `durationMin: 150`, but SPP section 2 says the Selangor 3472/2 file has no cover page, and `v2-exam-schema.md` D7 calls the duration "INFERRED; cover not read". The Sahkan duration line may have only one real supporting body.
3. Seed vs PoC: seed 1449/1 duration 90 and 40 marks versus the existing PoC contract `1449/1` (75 min, 10 marks, one section `take: 10`). On a UAT database that ran the exam seed, the admin edits that row; the PoC papers stay on version 1.
4. Duration of Matematik K1: 90 in three trial bodies (SPP 4, D7) against 75 "official, INFERRED" in D7. Unresolved by the repo.
5. Sains K1 code: no repo file says `1511/1`; the PoC bank says `4541/1`, the Kimia number.
6. Brief vs TRACKER: "D77" is not the two-body rule (that is D76(4), AC-39.2); D95 and Q3 are not in the TRACKER at BASE-6.
7. AC-39.2 amended text says seeded study rows do not count towards the two bodies; the server check does not filter by origin (`blueprint-verification.service.ts:check` passes every evidence row to `checkEvidence`), while the front-end body counter does (`domain/verify.ts:evidenceBodies`, `origin === 'admin'`). No effect on the no-seed UAT flow, but the two disagree.
8. Evidence drawer traps (section 2.2 step 6): rows always send a rule ("Semua" by default) and "Markah" is compared with the effective budget, so skema rows for choose sections produce `differs`.
9. SPP says Fizik K1 and Sejarah K1 were not read (SBP 2025 study) while `v2-exam-schema.md` holds Selangor K1 readings for both. These are different bodies and sessions, not a conflict, but the repo has no stored values file for either.
10. The "Nota pengesahan" field is required by the front end but optional on the server (`BijakVerifyInputSchema`).

## 8. Documents to obtain (by kind, no persons)

| For | Document |
|---|---|
| 3472/2 | cover page of the Selangor 2025 3472/2 paper; or a third body's 2025 3472/2 paper cover |
| 1449/1 | legible scan of the SBP 2025 1449/1 paper (Q13 page); the Selangor 2025 1449/1 skema values (or the Johor 2025 Set 1 paper and scheme); an LPM or official statement of the Matematik K1 duration |
| 1249/1 | a second body's 2025 1249/1 paper and skema; Sejarah Tingkatan 5 textbook Bab-to-SK table |
| 4531/1 | SBP 2025 4531/1 question paper; or another body's 4531/1 paper and skema |
| Sains K1 | two bodies' 2025 or later Sains K1 papers with skema (cover shows the paper code and duration) |
| any | an LPM format or JSU document per paper (replaces the two-body rule, open items Q-B16 and Q-B17) |
