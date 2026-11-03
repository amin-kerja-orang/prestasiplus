# PrestasiPlus V3 — Release 1 PRD

**Status:** For user review (G1). **Date:** 2026-11-04. **Owner:** Delivery Lead.
**Governing principle (user):** *"berdasarkan V2+V1 untuk betulkan V3"*. V2 is the primary reference and V1 is the fallback. **Exception:** question structure follows the DSKP, D90 and D41, because V1/V2 were wrong there (40-cross-cutting FR-X1-4).
**Scope source:** `docs/Matriks-Akses-Peranan .xlsx`. **Every ticked module must be fully working** (D100): no "Pratonton" placeholder pages, no "akan datang", no "belum tersedia", no mock data.

## Awaiting user decision
Everything else in this set is decided (by the user's standing principles and, for OD-6 and OD-12, by the user on 2026-11-04, D109). Only the standing approvals below remain.

| # | Item | Why it needs the user | Where | Blocks |
|---|---|---|---|---|
| 1 | Plan approval, sector owners, UAT operator, UAT dump (or the synthetic profile), the Bab-mapping and figure-image owner. | Approvals and production-data writes (every U-OP step on UAT needs the user's explicit approval first). | plan §10 items 1, 3, 5, 6, 7 | Sprint 0 start, S4-T01, U-OP-xx |

Already closed on 2026-11-04 and not to be reopened: all other OD-* (50 §7) and all OQ-API-* (60 §6.2), for example the public pupil profile (first name only, no school: OQ-API-04), the daily report cap (20), no 70% chapter unlock, Sekolah Bersaing computed on request, teacher submissions as intake batches (`source=guru`), no `/completeness` route, and `stem_duplicated` shown once instead of excluded.

## How a developer uses this set
1. **Pick a card** in `docs/plan/r1-development-plan.md` (sector card `S<n>-T<nn>`). Open `docs/plan/r1-traceability.md` and find the card: it lists every PRD module the card cites and the DM/API it owns.
2. **Read what the card points to**, in this order:
   - the card's `PRD:` line: the SRS module (`10`, `20` or `30`), its *Action* and *Current gap*, its FR and AC, and the exact BM copy;
   - the URS that the FR satisfies (`02-urs.md`, "Satisfied by"), to see why the card exists;
   - the card's `Data/API:` line: the DM rows in `50-data-model-erd.md` §4 (change, migration number, risk) and the API rows in `60-api-contract.md` §2 (route, roles, request, response, defect) and §2.17 (shapes of `Missing-Build` routes);
   - `40-cross-cutting.md` for the shared rules (question structure, T1-T5, counts, responsive, NFR).
3. **Build only the gap.** Reuse the existing code (FR-X1-5). A `Data/API` entry marked `Exists-OK` is only verified; `Exists-Fix` changes only the stated defect; `Missing-Build` adds only the stated route. Migrations use the numbers of `50` §4.8 and the plan's table "Migrations by card". Anything the documents do not say: stop and ask the Delivery Lead.
4. **Prove the ACs.** Run every AC of the modules on the card in a visible browser at 375/768/1280, with real test output, and tick each AC with its result in the PR; the Delivery Lead records the result in `docs/plan/r1-ac-ledger.md`.
5. **Check the chain** before the PR: `node scripts/r1-trace-check.mjs` must exit 0. It fails when a URS, FR/AC range, DM or API ID is unknown, when a PRD module has no card, or when a DM or an `Exists-Fix`/`Missing-Build` API does not have exactly one owning card (the `- Data/API:` line of the card).

**Improve, not rebuild (guardrails, plan section 0B).** The product exists; the job is to find the gaps and close them.
- **Per-card workflow.** (1) Gap check first: for every FR and AC on the card, record works / broken / missing in the existing V3 code with file:line, and post it as the issue's "Gap check"; a card cannot move to In progress without it. (2) Confirm scope: if the code changed since the PRD's "Current gap", update the gap check, never the PRD intent. (3) Close the gaps only, in the existing files named under the card's "Starts from (existing)". (4) Prove the card's ACs and every AC-CHAIN-n through it (40 section X9, card S9-T06) in a visible browser at 375, 768 and 1280.
- **Change budget by card Type.** Keep and Verify: no product-code change, ACs proven only. Fix and Complete: edit the "Starts from" files, a new file only when the card names it. Build: new files only at the named location. Ops: no product code.
- **Prohibited.** A parallel page, service, store, route or table for something that already exists; deleting or rewriting a working page or module; a schema change without a DM ID; an endpoint without an API ID.
- **PR and review.** The PR names exactly one card ID, links the gap check, lists the existing files changed, the reason for each new file, the DM/API IDs and the ACs proven. A reviewer rejects a Fix or Complete PR that touches none of its "Starts from" files or adds a parallel implementation.
- **CI.** `node scripts/r1-scope-guard.mjs` (wired by S0-T04) fails a PR that adds a new page, controller or model without a DM/API ID, or that changes product code on a Keep, Verify or Ops card, and warns when a Fix or Complete card touches none of its "Starts from" paths or an existing file loses more than 60% of its lines.
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

Read in this order: 00 index → 01 product overview → 02 URS → 10 / 20 / 30 SRS per portal → 40 cross-cutting and NFR → 50 data model and ERD → 60 API contract → development plan → traceability.

| Order | File | Layer | Content |
|---|---|---|---|
| 1 | [00-index.md](00-index.md) | Entry | This file: read order, ID chain, ID conventions |
| 2 | [01-product-overview.md](01-product-overview.md) | PRD / BRD | Problem, goals and success measures, users and roles, scope in/out, decisions D100–D108 in plain words, constraints, assumptions, dependencies, risks, delivery order, glossary pointer |
| 3 | [02-urs.md](02-urs.md) | URS | User requirements per role (`URS-MUR/GUR/AS/ADM/ALL-nn`), grouped by matrix module, each mapped to the SRS requirements that satisfy it |
| 4 | [10-murid.md](10-murid.md) | SRS (pupil) | Pupil portal: shell, the question-paper contract (QP), every matrix module (R1-MUR-*) |
| 5 | [20-guru-admin-sekolah.md](20-guru-admin-sekolah.md) | SRS (teacher, school admin) | Teacher and school-admin portals (R1-GUR-*, R1-AS-*), cross-screen number definitions (XS) |
| 6 | [30-admin-pusat.md](30-admin-pusat.md) | SRS (central admin) | Feed map, admin menu (V2 structure, D107), question entry standard (QE, DSKP guidance), question pipeline, curriculum, content, users, monitoring, UAT data operations (U-OP) |
| 7 | [40-cross-cutting.md](40-cross-cutting.md) | SRS / NFR | Reference rule and the question-structure exception (stimulus groups, DSKP), scope and delivery order, T1–T5, data and counts, environments, NFRs, responsive rules (X6.1), verification protocol (X7), glossary (X8) |
| 8 | [50-data-model-erd.md](50-data-model-erd.md) | Design | Data model and ERD; entity IDs `ENT-*`, data changes `DM-01..DM-43` (action, migration, risk, owning card), data questions `OD-*` (all decided; OD-6 and OD-12 by the user on 2026-11-04, D109) |
| 9 | [60-api-contract.md](60-api-contract.md) | Design | API contract; endpoint IDs `API-<AREA>-nn` (187 rows: Exists-OK / Exists-Fix / Missing-Build), role matrix, screen to endpoint map, questions `OQ-API-*` (all decided) |
| 10 | [../../plan/r1-development-plan.md](../../plan/r1-development-plan.md) | Plan | Sectors, shared-file protocol, task cards, sprints, claim-and-track, Definition of Done |
| 11 | [../../plan/r1-traceability.md](../../plan/r1-traceability.md) | Traceability | Generated by `node scripts/r1-trace-check.mjs`: PRD module → task cards, card → PRD modules, card → DM/API, DM/API → owning card. CI fails on gaps (unknown URS/FR/DM/API id, module without card, DM or API without exactly one owner). |

### The ID chain
Every piece of work can be traced in both directions:

**URS** (what the user must be able to do) → **FR / AC** (the SRS requirement and its acceptance criterion) → **DM / API** (the data entities and endpoints that carry it) → **plan card** (`S<sector>-T<nn>`) → **AC ledger** (`docs/plan/r1-ac-ledger.md`, the Pass/Fail result of each AC).

- To find why a card exists: read its "PRD:" line, then the URS that points to those FR IDs (02-urs "Satisfied by").
- To find whether a requirement is done: look up its AC in the ledger.
- A URS with no FR, an FR with no URS, or a module with no card is a documentation defect (the trace script reports it).

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
The repository is public, so no V1/V2 capture is stored in it. The redacted gap analysis is in `docs/qa/gap-analysis-2026-11-04/`. The Delivery Lead verifies against V2 in a visible browser on a local machine (40-cross-cutting X7) and writes any new finding into the SRS text.

## Open questions
The data questions (50 §7) and API questions (60 §6.2) are closed; none is open; only the standing approvals under "Awaiting user decision" above remain. The module-level questions (OQ-MUR-*, OQ-G-*, OQ-AS-*, OQ-Q*) are consolidated at the end of each SRS part, each with a recommendation.
