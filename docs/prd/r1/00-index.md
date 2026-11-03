# PrestasiPlus V3 — Release 1 PRD

**Status:** Final for build (plan approved, D111; no open decision). **Date:** 2026-11-04. **Owner:** Delivery Lead.
**Governing principle (user):** *"berdasarkan V2+V1 untuk betulkan V3"*. V2 is the primary reference and V1 is the fallback. **Exception:** question structure follows the DSKP, D90 and D41, because V1/V2 were wrong there (40-cross-cutting FR-X1-4).
**Scope source:** `docs/Matriks-Akses-Peranan .xlsx`. **Every ticked module must be fully working** (D100): no "Pratonton" placeholder pages, no "akan datang", no "belum tersedia", no mock data.

## Awaiting user decision
None. Everything in this set is decided: by the user's standing principles, by the user on 2026-11-04 (D109 for OD-6 and OD-12, D110 for the working model, D111 for the plan approval), and by the Delivery Lead by principle (D112, D113). The table records the two items that were once open.

| # | Item | Decision | Where |
|---|---|---|---|
| 1 | Plan approval (sign-off). | **APPROVED 2026-11-04 (D111).** | plan §10 item 1 |
| 2 | Name of the designated UAT developer. | **Decided (D113-continued):** the name is an operational assignment, not a document decision. The product owner (`@aminfaudzi`) names "the designated UAT developer" privately and writes `UAT developer: @handle` in the first line of the pinned issue #503. Until then a team lead asks in #503. The role is defined in the RACI (plan §7): deploys `feature/v3-bijak-r1` to UAT daily, creates the shared test accounts, runs the approved script operations. | plan §7, R1-START-HERE decision 5 |

**Decided, D110 (user, 2026-11-04):**
- The UAT operator is a designated developer with server access. The user approves every write operation. D95 still holds: no AI session acts on a server. Every UAT data operation is run by that developer: dry-run first, then a report, then the user's approval, then the real run.
- There is no local acceptance environment. Acceptance, AC proofs and AC-CHAIN-1..9 run on UAT (`uat.prestasiplus.cloud`), a clone of V2 production data, in a visible browser at 375/768/1280. Developers still run unit/integration tests and CI locally and in CI. No UAT dump, anonymised restore or synthetic acceptance profile is made; the demo/e2e seed is only for automated tests in CI. UAT holds real pupil data: evidence stays in the gitignored `.evidence/`, and issues/PRs carry only pass/fail and IDs, never names.
- Content work (mapping questions to the right Bab, supplying missing figure images, regrouping stimulus groups) is owned by ADMIN users in the Portal Pentadbiran (improved question entry, "Soalan tanpa Bab" work-list, diagram audit, regroup work-list). Developers build and fix those screens; they do not do the content work. Scripts may only produce dry-run reports or assist bulk actions an admin confirms in the UI.

**Decided D112 (Delivery Lead, by principle, 2026-11-04; answers the 7 open questions of the Team B workflow doc, PR #522):**
- **Bab before Terbit:** Bab is REQUIRED when the question's Subjek + Tingkatan has chapters (D-A5, N-3); a Subjek + Tingkatan without chapters does not list the Bab item. Any older board decision "Q17 = not required" is superseded.
- **OCR/AI:** PDF extraction uses real OCR, in-house (Tesseract worker, `OCR_ENGINE=tesseract`, the S0 card that enables the worker). There is no external AI provider in R1: ALESA/AI stays hidden (D73/D102) and pupil data stays private. Extraction is rule-based (numbering, Rajah/Jadual/Petikan/Sumber detection) and an admin always reviews before anything publishes. A mock OCR is allowed only in CI tests, never on UAT.
- **Subjects without DSKP nodes** (for example Kimia, Biologi, Geografi, Perniagaan, Prinsip Perakaunan, Ekonomi): the S4 DSKP loading card loads the DSKP structure of every SPM subject offered from the official KPM DSKP documents (Tingkatan -> Subjek -> Bab -> SK -> SP -> TP, as D109). Until a subject's DSKP is loaded, SP and TP are required only when DSKP nodes exist for that Subjek + Tingkatan (the same conditional pattern as Bab). A Kontrak (JSU) can be created only for a Subjek whose DSKP is loaded.
- **Bijak content owner:** Admin users (D110). First content batch: the 6 subjects with sample papers (BM, BI, Matematik, Matematik Tambahan, Fizik, Sejarah), Kertas 1 first, Kertas 2 after the scheme editor is built. Content admins: named by team leads in issue #502 / #503 (an operational assignment, not a doc decision).
- **Sunting Pantas:** R1-ADM-Q-24 changes from Keep to Fix ("dead on the real API", Team B's audit).
- **Pupil Jana Kertas:** OUT of R1 (D88; V2 pupils have no such function). The pupil tab is hidden and its route returns 404 (FR-X2-2). Admin Jana Kertas (FR-ADM-QE7.2) stays.
- **24-hour slice ("Slice 0"):** plan section 5A, one end-to-end chain first, proving AC-CHAIN-1 and AC-CHAIN-2; everything else follows the normal sprints.

**Decided D113 (Delivery Lead, by principle, 2026-11-04; final, not to be reopened).** The product decisions are written once in the documents named in brackets; this list is the index.
- **Single answer store:** `practice_answers` with a `mode` (`latih_tubi`, `chapter`, `question_set`, `kuiz`, `simulasi`, `tracking_a`, `subjektif`, `structured`, `battle`, `pksk`, `audio_kbat` and the game modes). Every activity writes it, every report reads it (46, 40 FR-X4-5, 50 section 4.7a).
- **Stimulus group:** 1..n questions, 1 to 3 stimuli, a part-level stimulus is allowed; published, served, edited (draft copy and atomic swap) and retired as ONE unit; legacy regroup is an audited structural change; detection covers numbered and unnumbered references ("Rajah di atas", "Maklumat di bawah", "Sumber", "Teks", "Petikan"); the publish gate blocks `stimulus_missing` and `figure_only`; **a duplicated stem is shown once and is NOT excluded** (40 FR-X1-4, 45).
- **Question types and marking:** 11 types (including `true_false`, `mcq_multi`, `drawing`, `table_fill`, `essay_choice`, all served); MCQ 2 to 8 options, default 4; bilingual `ms+en`; the full scheme editor (45, 46).
- **Levels and status:** TP 1 to 6 and Kesukaran 1 to 5 are separate fields (Kesukaran default min(5,TP), typed by the admin); Kertas 1 to 4; status labels Draf / Menunggu Semakan / Diluluskan / Ditolak / Diarkibkan; review filter value `review`; no separate Penyemak role (45).
- **Numbers:** accuracy pooled and shown as a whole-number % everywhere (a manual Headcount AR may show one decimal); coin rate is an admin setting, default 1; password minimum 8; other pupils see a first name only and no school (20 XS, 40).
- **Games:** real pupils first, then a labelled "Robot PrestasiPlus" after 30 s, never a real pupil identity; game coins are an admin setting, default off, with caps; Liga is enrolled by Admin Pusat only; parent consent is not built (48).
- **No duplicates:** Set Builder is the only paper builder; Studio is the only question editor; `/leaderboard` and `GET /api/leaderboard` are canonical; Bijak is the only exam engine (`/spm-mock` redirects); one reward catalogue (`rewards`, `reward_redemptions`); `src/shells/pentadbiran/menu.ts` is the only admin menu; `previewHubRoutes` is deleted (S0-T05) (47, `docs/plan/r1-canonical-map.json`).
- **Process (R1-START-HERE, written once there):** the lock (`scripts/r1-lock.mjs`) is the only claim system; the board is GitHub issues, labels and milestones (no `r1-board.md`); branches `r1/<team>/<card>-<slug>`; AC proof is CI first, then UAT after the designated UAT developer deploys `feature/v3-bijak-r1` daily, results in `docs/plan/r1-ac-ledger.md`; the designated UAT developer creates one UAT test account per role per team and shares them privately (never in the repo); the product owner `@aminfaudzi` merges after the team lead's review; a cross-sector small PR names its card and carries a `Cross-sector: S<n>` line and the label `needs:S<n>`.
- **Split card:** S1-T09 is P0/L and is split into S1-T09a (scheme editor backend, `mode_config`, `options` key kind, MCQ minimum 2) and S1-T09b (bilingual `ms+en`, `drawing`, `table_fill`).
- **Cards re-typed (F-22):** S7-T01 and S5-T10 are Fix, S10-T07 is Complete, because each needs product code (a Verify card changes none).
- **Sprint order (F-09):** S5-T15 (the answer store) is in Sprint 1; S5-T10 in Sprint 1; S10-T04 in Sprint 2; S3-T02 and S8-T03 start in Sprint 3 after S1-T06, S1-T09a and S1-T09b; S4-T04 in Sprint 3; S6-T06 and S4-T09 in Sprint 4 (plan 5A).
- **"Not observed in V2" is not a question:** where the PRD says it, build from the FR text and the generic loading, error and empty rules (FR-X6) without blocking.

Already closed on 2026-11-04 and not to be reopened: all other OD-* (50 §7) and all OQ-API-* (60 §6.2), for example the public pupil profile (first name only, no school: OQ-API-04), the daily report cap (20), no 70% chapter unlock, Sekolah Bersaing computed on request, teacher submissions as intake batches (`source=guru`), no `/completeness` route, and `stem_duplicated` shown once instead of excluded.

## How a developer uses this set
1. **Pick a card** in `docs/plan/r1-development-plan.md` (sector card `S<n>-T<nn>`). Open `docs/plan/r1-traceability.md` and find the card: it lists every PRD module the card cites and the DM/API it owns.
2. **Read what the card points to**, in this order:
   - the card's `PRD:` line: the SRS module (`10`, `20` or `30`), its *Action* and *Current gap*, its FR and AC, and the exact BM copy;
   - the URS that the FR satisfies (`02-urs.md`, "Satisfied by"), to see why the card exists;
   - the card's `Data/API:` line: the DM rows in `50-data-model-erd.md` §4 (change, migration number, risk) and the API rows in `60-api-contract.md` §2 (route, roles, request, response, defect) and §2.17 (shapes of `Missing-Build` routes);
   - `40-cross-cutting.md` for the shared rules (question structure, T1-T5, counts, responsive, NFR).
3. **Build only the gap.** Reuse the existing code (FR-X1-5). A `Data/API` entry marked `Exists-OK` is only verified; `Exists-Fix` changes only the stated defect; `Missing-Build` adds only the stated route. Migrations use the numbers of `50` §4.8 and the plan's table "Migrations by card".    - Team workflow reference (BM): docs/plan/r1-aliran-kerja-bank-bijak.md (PR #522) — its 7 questions are answered by D112.
   - Anything the documents do not say or say twice: do not guess and do not wait. Post `[<team>/S-<k>] QUESTION: ...` on the card's issue (the two places that disagree and your suggested answer), set `status:blocked`, and tell your team lead; the team lead answers by the tie-break in "Rules of the chain" and [R1-FAQ Q11](../../plan/R1-FAQ.md).
4. **Prove the ACs in two steps (D113).** First in CI: tag every AC `[CI]` (a named automated test), `[UAT]` (needs UAT data or a human look) or `[CI+UAT]`, and list the `[UAT]` ones as "ACs awaiting UAT" in the PR. Then, after the merge and after the designated UAT developer has deployed `feature/v3-bijak-r1` to UAT, the card's team runs those ACs and the AC-CHAINs through the card in a visible browser at 375/768/1280 with its shared test accounts and writes the Pass/Fail rows in `docs/plan/r1-ac-ledger.md`. A card is Done only after UAT Pass. Working rules: [R1-START-HERE](../../plan/R1-START-HERE.md).
5. **Check the chain** before the PR: `node scripts/r1-trace-check.mjs` must exit 0. It fails when a URS, FR/AC range, DM or API ID is unknown, when a PRD module has no card, or when a DM or an `Exists-Fix`/`Missing-Build` API does not have exactly one owning card (the `- Data/API:` line of the card).

**Improve, not rebuild (guardrails, plan section 0B).** The product exists; the job is to find the gaps and close them.
- **Per-card workflow.** (1) Gap check first: for every FR and AC on the card, record works / broken / missing in the existing V3 code with file:line, and post it as the issue's "Gap check"; a card cannot move to In progress without it. (2) Confirm scope: if the code changed since the PRD's "Current gap", update the gap check, never the PRD intent. (3) Close the gaps only, in the existing files named under the card's "Starts from (existing)". (4) Prove the card's ACs and every AC-CHAIN-n through it (40 section X9, card S9-T06) in a visible browser at 375, 768 and 1280.
- **Change budget by card Type.** Keep and Verify: no product-code change, ACs proven only. Fix and Complete: edit the "Starts from" files, a new file only when the card names it. Build: new files only at the named location. Ops: no product code.
- **Prohibited.** A parallel page, service, store, route or table for something that already exists; deleting or rewriting a working page or module; a schema change without a DM ID; an endpoint without an API ID.
- **PR and review.** The PR names exactly one card ID (plus a `Cross-sector: S<n>` line when it touches another sector's files), links the gap check, lists the existing files changed, the reason for each new file, the DM/API IDs and the ACs proven with their `[CI]`/`[UAT]` tags. The team lead reviews, the product owner merges. A reviewer rejects a Fix or Complete PR that touches none of its "Starts from" files or adds a parallel implementation.
- **CI.** `node scripts/r1-scope-guard.mjs` (wired by S0-T04) fails a PR that adds a new page, controller or model without a DM/API ID, or that changes product code on a Keep, Verify or Ops card, and warns when a Fix or Complete card touches none of its "Starts from" paths or an existing file loses more than 60% of its lines. `node scripts/r1-canonical-map.mjs --check` fails on a route, menu entry, model or API that is not in `docs/plan/r1-canonical-map.json` (no duplicates, 47).
- **One store, one number.** Every answering activity writes `practice_answers` with a mode (DM-44, XS-8); every report reads that store, so data entered on one side is displayed identically on every other side (proved by AC-CHAIN-1..9).

**Rules of the chain.** The SRS wins over the plan on behaviour; the ERD (50) and the API contract (60) win on technical shape; where they disagree the row says so and the question is decided by the user's principles (`01-product-overview.md`).

**Size of the SRS parts (for planning):** pupil 10-murid; teacher and school admin 20-guru-admin-sekolah: Guru 27 sections, 158 FR / 158 AC (R1-GUR-A1..A5, 1, 2, 2b, 3-11, 8b, 41-44 and the Alat Soalan tools 44a-44e); Admin Sekolah 24 sections.

## What this PRD is: a gap-closing spec for the existing V3, NOT a rebuild
The base is the **existing V3 code** (`feature/v3-bijak-r1`). The work is to **close, fix and improve the gaps** found in the gap analysis, never to rebuild from scratch (40-cross-cutting **FR-X1-5**).
- Every module section has an **Action**:
  - **Keep**: matches already; verify only.
  - **Fix**: wrong today.
  - **Complete**: partly built.
  - **Build**: missing.
- Every module section also has a **Current gap** list. Developers change only what that list names.
- The reference behaviour (taken from V2/V1) is written in full only so that nobody has to open V1/V2. It is the yardstick for each gap, not an instruction to rewrite working code.
- Read order for a developer:
  1. the gap analysis (`docs/qa/gap-analysis-2026-11-04/GAP-ANALYSIS-FULL.md`)
  2. the module's *Action* and *Current gap*
  3. its reference behaviour and ACs (the V2 screens are described in words there)
  4. the task card

**No screenshots are needed or kept in the repository.** Every V2/V1 screen is described in words inside the SRS (layout, blocks in order, exact BM copy, states). Nobody who builds from these documents needs to open V1 or V2. If a detail is missing, ask the Delivery Lead.

## Why this PRD exists
A gap analysis of 3–4 November 2026 ([docs/qa/gap-analysis-2026-11-04/](../../qa/gap-analysis-2026-11-04/GAP-ANALYSIS-FULL.md)) compared V3 with V1 and V2 row by row against the matrix, covering both GitHub `feature/v3-bijak-r1` and UAT. It found:
- Pupil modules missing, or opening the wrong page.
- Bijak SPM with no papers on UAT.
- Migrated questions without Bab/SP, and questions published without their figure.
- A duplicated and partly broken admin question flow.
- Many admin screens missing.

This PRD states, for every matrix module, what V3 must do and how to prove it. The [development plan](../../plan/r1-development-plan.md) turns it into sector-owned task cards, and the [traceability matrix](../../plan/r1-traceability.md) links every PRD module to its cards.

## Read order and document map

Read in this order: [R1-START-HERE](../../plan/R1-START-HERE.md) and [R1-FAQ](../../plan/R1-FAQ.md) → 00 index → 01 product overview → 02 URS → 10 / 20 / 30 SRS per portal → 40 cross-cutting and NFR → 45 / 46 / 48 flow specs and 47 duplicates register (as the card needs) → 50 data model and ERD → 60 API contract → development plan → traceability.

| Order | File | Layer | Content |
|---|---|---|---|
| 1 | [00-index.md](00-index.md) | Entry | This file: read order, ID chain, ID conventions |
| 2 | [01-product-overview.md](01-product-overview.md) | PRD / BRD | Problem, goals and success measures, users and roles, scope in/out, decisions D100–D108 in plain words, constraints, assumptions, dependencies, risks, delivery order, glossary pointer |
| 3 | [02-urs.md](02-urs.md) | URS | User requirements per role (`URS-MUR/GUR/AS/ADM/ALL-nn`), grouped by matrix module, each mapped to the SRS requirements that satisfy it |
| 4 | [10-murid.md](10-murid.md) | SRS (pupil) | Pupil portal: shell, the question-paper contract (QP), every matrix module (R1-MUR-*) |
| 5 | [20-guru-admin-sekolah.md](20-guru-admin-sekolah.md) | SRS (teacher, school admin) | Teacher and school-admin portals (R1-GUR-*, R1-AS-*), cross-screen number definitions (XS) |
| 6 | [30-admin-pusat.md](30-admin-pusat.md) | SRS (central admin) | Feed map, admin menu (V2 structure, D107), question entry standard (QE, DSKP guidance), question pipeline, curriculum, content, users, monitoring, UAT data operations (U-OP) |
| 7 | [40-cross-cutting.md](40-cross-cutting.md) | SRS / NFR | Reference rule and the question-structure exception (stimulus groups, DSKP), scope and delivery order, T1–T5, data and counts, environments, NFRs, responsive rules (X6.1), verification protocol (X7), glossary (X8) |
| 8 | [50-data-model-erd.md](50-data-model-erd.md) | Design | Data model and ERD; entity IDs `ENT-*`, data changes `DM-nn` (action, migration, risk, owning card; the range is whatever 50 section 4 lists), data questions `OD-*` (all decided; OD-6 and OD-12 by the user on 2026-11-04, D109) |
| 9 | [60-api-contract.md](60-api-contract.md) | Design | API contract; endpoint IDs `API-<AREA>-nn` (every row: Exists-OK / Exists-Fix / Missing-Build), role matrix, screen to endpoint map, questions `OQ-API-*` (all decided) |
| 10 | [../../plan/r1-development-plan.md](../../plan/r1-development-plan.md) | Plan | Sectors, shared-file protocol, task cards, sprints, claim-and-track, Definition of Done |
| 10a | [45-question-authoring-flow.md](45-question-authoring-flow.md) | Flow spec (admin) | How a question is entered, imported, reviewed, published and maintained; the question model, scheme editor, bilingual, stimulus groups; decisions D-QA-n |
| 10b | [46-pupil-activity-flow.md](46-pupil-activity-flow.md) | Flow spec (pupil) | The shared answering engine, marking, one section per activity, the reports fed from the answer store |
| 10c | [47-v3-duplicates-register.md](47-v3-duplicates-register.md) | Register | The 34 duplicates of V3: which copy is kept, what happens to the rest, applied fixes (enforced by `docs/plan/r1-canonical-map.json`) |
| 10d | [48-game-and-gamification-spec.md](48-game-and-gamification-spec.md) | Spec | Games and gamification settings; GAME-00 common rules, one specification per game |
| 11 | [../../plan/r1-traceability.md](../../plan/r1-traceability.md) | Traceability | Generated by `node scripts/r1-trace-check.mjs`: PRD module → task cards, card → PRD modules, card → DM/API, DM/API → owning card. CI fails on gaps (unknown URS/FR/DM/API id, module without card, DM or API without exactly one owner). |

### The ID chain
Every piece of work can be traced in both directions:

**URS** (what the user must be able to do) → **FR / AC** (the SRS requirement and its acceptance criterion) → **DM / API** (the data entities and endpoints that carry it) → **plan card** (`S<sector>-T<nn>`) → **AC ledger** (`docs/plan/r1-ac-ledger.md`, the Pass/Fail result of each AC).

- To find why a card exists: read its "PRD:" line, then the URS that points to those FR IDs (02-urs "Satisfied by").
- To find whether a requirement is done: look up its AC in the ledger.
- A URS with no FR, an FR with no URS, or a module with no card is a documentation defect (the trace script reports it).

## Codes in plain words
Every code used in the PRD, the plan and the cards. If a code is not here, it is defined in 40 section X8 (glossary) or X11 (option sets).

| Code | Plain meaning | Where defined |
|---|---|---|
| D1..D113, D-A1..D-A17, D-API-n, D-QA-n | A decision. D100-D111: the user (product owner). D112, D113: the Delivery Lead, by principle (the product owner delegated detail decisions). D-A, D-API, D-QA: Delivery Lead decisions inside the plan, the API contract and 45. D100 = everything ticked in the matrix must work. | [01](01-product-overview.md), "Decided D112" and "Decided D113" above, plan 4.0D, 45 section 0, `docs/TRACKER.md` |
| URS / FR / AC | User requirement / functional requirement / acceptance criterion (a testable Given-When-Then) | "The ID chain" below |
| R1-MUR-n, R1-GUR-n, R1-AS-n, R1-ADM-xx | A module (screen group): pupil / teacher / school admin / central admin | "ID conventions" below |
| DM-nn / ENT-* | A data change (table, column, rule, data fix) with its migration number / an existing entity | [50](50-data-model-erd.md) section 4 |
| API-AREA-nn | One endpoint. Exists-OK = verify only; Exists-Fix = change the stated defect; Missing-Build = add it | [60](60-api-contract.md) section 2 |
| BS-nn, KS-nn, PM-nn | Ids of sidebar entries in `src/shells/pentadbiran/menu.ts` (BS = group "Bank Soalan", KS = group "Kertas & SPM", PM = a monitoring group). The keep / merge / hide / remove decision per id | [30](30-admin-pusat.md) section 3.3 |
| U-OP-nn | A one-off data operation on UAT (for example load DSKP, map chapters). Run by the designated UAT developer or by admin users; script operations are dry-run first, then a report, then the product owner's approval | [30](30-admin-pusat.md) section 5, plan section 7 |
| XS-1..8 | The agreed definitions of numbers shown on more than one screen (pupils, active pupils, teachers, answered, accuracy, scope, "questions tested", answer source) | [20](20-guru-admin-sekolah.md) section 5 |
| HC-SPEC (HC-1..6) | The one set of Headcount rules (TOV, ETR, OTR, AR, status, projection) used by every screen | [20](20-guru-admin-sekolah.md), R1-GUR-3 |
| FD-xx | A deliberate difference from V1/V2 (fidelity deviation), listed per module | each module section |
| OQ-xx / OD-xx | Open question / open data question. All are closed; the answer is written in the module | "Open questions" below, 50 section 7, 60 section 6.2 |
| DV-xx, DK-xx, RP-xx, QP | Deviation note / DSKP-level rule / responsive pattern / question-paper contract (FR-MUR-QP-n) | 20; 10 section 4.10; 20; 10 section 4.8 |
| E-nn | A piece of V2 evidence the Delivery Lead captures. "Not observed in V2" means: build from the FR text and FR-X6, do not block | [10](10-murid.md) section 6.3 |
| OPT-* | A shared option list (for example the values of Kertas) used by forms, CSV and filters. One master list | [40](40-cross-cutting.md) section X11 |
| ERR-xx | An error case with its exact BM message and behaviour. One catalogue | [40](40-cross-cutting.md) section X10 |
| GAME-xx, FR-GM-*, FR-QA-*, FR-PA-* | Game specification / game requirements / question-authoring requirements (45) / pupil-activity requirements (46) | 48, 45, 46 |
| `[CI]` / `[UAT]` / `[CI+UAT]` | How an AC is proven: a named automated test in CI / on UAT after the deploy / both | [R1-START-HERE](../../plan/R1-START-HERE.md) decision 4 |
| P0 / P1 / P2 | Blocks release / important / polish. All are in scope (D100) | "Priority" below |
| Delivery A / B | Order of delivery, never less scope | "Delivery order" below |
| Tingkatan / Darjah | Secondary Form 1-5 / primary Year. Only Tingkatan 1-5 exists in R1 (D72, D96) | [40](40-cross-cutting.md) X3 |
| Bab / SK / SP / TP / KBAT / aras / Kertas | Textbook chapter / learning content standard / learning standard / performance level (1-6) / higher-order thinking / difficulty level (1-5) / paper (1-4) | [40](40-cross-cutting.md) X8 |
| Terbit / Disahkan / Kontrak | Publish / verified / the rule set of a paper (sections, quotas, marks) | 40 X8 |
| Stimulus group | One figure, passage, table or graph with its 1..n questions, handled as ONE unit | 40 FR-X1-4 |
| `S<n>`, `S<n>-T<nn>` | Sector (S0..S10) / task card (a split card has a letter: S1-T09a). Also the lock key | plan sections 2 and 4 |
| duplicate | Six different meanings (admin screens, duplicated stem text, copied figure, duplicate store or number, duplicate route, duplicate code you might add), plus the intake detector and the redemption flag | [R1-FAQ Q5](../../plan/R1-FAQ.md), [47](47-v3-duplicates-register.md) |

## Delivery order ("Phase")
"Phase" means **order of delivery, never less scope**:
- **Phase 1** = the 1.0 columns of the matrix (plus Latih Tubi), plus every module a Phase-1 screen links to (D106).
- **Phase 2** = the rest of the ticked modules.

Both must be fully working. The only hidden modules are Cikgu Alesa and Mohon Keluarga Angkat (D102).

## User decisions this PRD implements
Full text is in [TRACKER.md](../../TRACKER.md).
- **D72 / D96:** secondary only.
- **D100:** everything in the matrix must work.
- **D101:** T1–T5 practice.
- **D102:** the two hidden modules.
- **D104:** Subjektif and Kertas Subjektif in 1.0.
- **D105:** drills serve figure questions and stimulus groups (DSKP).
- **D106:** no dead links.
- **D107:** admin menu follows V2.
- **D108:** principle rulings: 1..n groups, the thinking-level gate, the Set Soalan feed, Tiket Bantuan, school-admin Kirkpatrick, 404 for hidden URLs.
- **D112:** Bab before Terbit where chapters exist, in-house OCR and no external AI provider, DSKP for every offered SPM subject, Admin users own Bijak content, Sunting Pantas is Fix, pupil Jana Kertas out of R1, Slice 0 (see "Decided D112" above).
- **D113:** single answer store, stimulus groups as one unit, 11 question types, games, no duplicates, the R1 working process (see "Decided D113" above).
- Earlier decisions D28–D99 still apply where they are not superseded.

## ID conventions
| Kind | Format | Examples |
|---|---|---|
| Module (pupil / teacher / school admin) | `R1-MUR-<row>`, `R1-GUR-<row>`, `R1-AS-<row>` (row = matrix row; A1–A5 for account rows) | R1-MUR-13, R1-GUR-43, R1-AS-A5 |
| Pupil/teacher/school-admin requirement | `FR-<MUR\|GUR\|AS>-<row>-<n>`, `AC-…-<row>-<n>` | FR-MUR-4-2, AC-AS-11-3 |
| Shared blocks | `FR-MUR-SH-n` (shell), `FR-MUR-QP-n` (question-paper contract), `FR-MUR-DK-n` (DSKP levels), `XS-n` (cross-screen numbers), `RP-*` (responsive patterns) | FR-MUR-QP-6, XS-1 |
| Admin screen | `R1-ADM-<area>-<nn>`. Area is Q (questions), QE (question-entry standard), C (curriculum), N (content/settings), U (users/schools), M (monitoring), P2 (Phase-2 admin), G (stimulus-group rules), R (responsive) | R1-ADM-Q-16, R1-ADM-P2-03 |
| Admin requirement | `FR-ADM-<area><nn>.<n>`, `AC-ADM-<area><nn>.<n>` (the hyphen before the number is dropped) | FR-ADM-Q16.2, AC-ADM-QE1.3 |
| UAT data operation | `U-OP-nn` | U-OP-04 |
| Cross-cutting | `FR-X<n>-<m>`, `AC-X<n>-<m>`, `NFR-<n>` | FR-X2-0, AC-X6-2 |
| Task card (plan) | `S<sector>-T<nn>` | S3-T02 |
| User requirement (URS) | `URS-<MUR\|GUR\|AS\|ADM\|ALL>-<nn>` | URS-MUR-10 |
| Data / API | `DM-<nn>` (50), `API-<AREA>-<nn>` (60; areas AUTH, MUR, GUR, AS, ADM, Q, DSKP, BIJAK, PRAC, RPT, GAME, SUP, FILE) | DM-18, API-Q-05, API-GUR-24 |
| Card data line | `- Data/API: DM-…; API-…` (or `none`) on every plan card = the owner declaration; `- Also uses: …` = read only | S6-T16: DM-42; API-GUR-24, API-GUR-25 |

Priority: **P0** blocks the release · **P1** important · **P2** polish. All are in scope (D100).

## Reference and privacy
The repository is public, so no V1/V2 capture is stored in it. The redacted gap analysis is in `docs/qa/gap-analysis-2026-11-04/`. Only the Delivery Lead verifies against V2, in a visible browser on a local machine (40-cross-cutting X7); card teams never open V1 or V2 and writes any new finding into the SRS text.

## Open questions
The data questions (50 §7) and API questions (60 §6.2) are closed; none is open, and nothing awaits a user decision (see "Awaiting user decision" above). The module-level questions (OQ-MUR-*, OQ-G-*, OQ-AS-*, OQ-Q*) are consolidated at the end of each SRS part, each with a recommendation.
