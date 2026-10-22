# Proposal AZ-27: shared-file hand-over, migration policy, contract ownership

Status: **approved.** LEAD DECISION on #113 of 22 Oct 2026, 10:30 MYT (the LEAD may override any line):
`AZ-27: 1 YES, 2 YES, 3 YES, 4 YES, 5 YES, 6 YES`. The "Rules text" blocks below are the approved text, with the G4
minors of the review on #139 folded in (see [section 5](#5-decision-record-22-oct-2026)). They are binding from the
LEAD's answer. `docs/plan/AGENT-SYNC.md` is LEAD-only under the rule approved here, so this PR does not edit it: the
LEAD pastes the blocks under "Rules for the two halves" (they extend rules 2-5 there), or ASSIGNs that edit. This
file stays as the record.

Builds on D60 (two halves), D64 (SEDIA MERGE + human merge by the LEAD), AGENT-SYNC rules 1-6, the LEAD notices on #113
(15:15 UTC item 6: claim a migration number by comment, first comment wins) and #109 (15:15 UTC item 1: half AM splits
0070-0089 for Lead-Amin1 and 0090-0099 for Lead-Amin2), and what happened in practice on 21 Oct:

- Cross-half schema change done by request: `[Amin1] REQUEST → half AZ` (Q4 A) → AZ-31 / #135 (migration 0042). It
  worked, inside one check-in cycle.
- Contract patches carried in PR bodies for the LEAD (AZ-14 #121, AZ-26 #134, AM-16).
- A migration-number collision between parallel developers (the third Major on #110), and two claims for one number
  (AZ-22: 0041 claimed twice on #113, 16:47 and 17:21 UTC; the first won).
- Files that no rule names yet but that both halves touch: `.env.api.example`, `scripts/demo-smoke.sh`,
  `docs/ops/go-live-bijak-spm.md`, `apps/api/prisma/schema.prisma`, `apps/api/prisma/migratable-models.json`.

The DEC ids are not written down in the repo; here **DEC-05 = shared-file hand-over rule** and **DEC-14 = migration
policy**, as named in the AZ-27 assignment.

## 1. DEC-05: shared files and hand-over

### Problem
AGENT-SYNC rule 4 lists some append-only files, rule 6 gives the frontend shared files to half AZ, and rule 5 says the
owner of a module changes it on request. Not covered: files that are not "append-only" but have no single owner (the
Prisma schema, env templates, ops docs, root `package.json`), and how a file is handed to the other half for one change
without both halves editing it.

### Rules text (approved 22 Oct 2026)

> **Shared files (DEC-05).** Every file that both halves may need is in one of three classes. A file not listed is owned
> by the half whose lane folder it is in; outside lane folders it is LEAD-only.
>
> | Class | Files | Who edits |
> |---|---|---|
> | **Append-only** | `apps/api/src/modules/index.ts`, `apps/api/prisma/seed/index.ts`, `seed/poc/index.ts`, registries, `docs/architecture/v2-backend-deviations.md`, `docs/plan/seed-profile.md`, `apps/api/prisma/migratable-models.json` (alphabetical: insert your line, never move another), `apps/api/prisma/schema.prisma` (add your own models and fields; a change to a model of the other half goes through a hand-over), `.env.api.example` (add your own keys in your lane's block) | Both halves, own lines only. A merge conflict is resolved by keeping both sides; after resolving a conflict in `schema.prisma`, `migratable-models.json` or `.env.api.example`, run `be:lint:migration`, `be:typecheck` and the env-template test before pushing. |
> | **Owner-only** | Frontend shared files (router, menu, `src/app/prototype-scope.ts`, transport): half AZ. `files.service.ts` and `common/**` throttle code: half AM (shared items SH-02, SH-04 on #109). Ops docs (`docs/ops/**`), `deploy/**`, `scripts/demo-*.sh`: half AZ (S6). Migration and cutover docs (`docs/ops/v2-cutover-plan.md`, lands with #124; `docs/ops/cloud-dump-procedure.md`, lands with #125) and `apps/api/src/migration/**`: half AM. | The owner only. The other half asks with a REQUEST (below). |
> | **LEAD-only** | `packages/contract/**`, `packages/contract/openapi.json`, `docs/plan/AGENT-SYNC.md`, `docs/TRACKER.md`, `.github/**` (CI workflows; D70), root `package.json` / `package-lock.json` (dependency changes), `.gitleaks.toml`, branch protection | The LEAD, or a developer on a LEAD `ASSIGN` or a named LEAD exception (for example a half-AZ DevOps card that adds one workflow). |
>
> This list corrects AGENT-SYNC rule 4: the seed index is `apps/api/prisma/seed/index.ts` (rule 4 names
> `apps/api/src/seed/index.ts`, which does not exist).
>
> **Hand-over protocol.**
> 1. The requester posts on the OWNER's queue issue (#113 for half AZ, #109 for half AM):
>    `REQUEST → half <XX>: <file(s)> — <why> — <exact patch or diff in a code block>`.
> 2. The owner answers within one check-in cycle with `ACCEPT <ref>` (and makes the change in its own PR, linking the
>    request) or `DECLINE <ref>: <reason, alternative>`. Silence for two cycles escalates to the LEAD.
> 3. For a larger change that only the requester can make, the LEAD may post `HANDOVER <file(s)> → <session or half> until
>    <PR merged | date>`. During a hand-over the owner does not edit those files; it ends by itself at the named event.
>    Only a LEAD notice starts a hand-over.
> 4. A PR that touches another half's owner-only file without an ACCEPT or a HANDOVER fails G4 (Major), whatever else
>    it does.

## 2. DEC-14: migration policy

### Rules text (approved 22 Oct 2026)

> **Migrations (DEC-14).**
> 1. **Ranges.** Half AZ **0040-0069**. Half AM **0070-0099** (Lead-Amin1 0070-0089, Lead-Amin2 0090-0099, #109).
>    Never used: 0016, 0024, 0029. Retired: 0035, 0036, 0039. When a range has 3 numbers left, its half asks the LEAD for
>    the next block of 30 from **0100** up (AZ 0100-0129, AM 0130-0159, …); blocks never interleave inside a half.
> 2. **Claim first.** Before creating the folder, comment `MIGRATION 00NN (<dev>, <item>)` on your half's queue issue.
>    The first comment wins (by timestamp). A valid claim is posted by the LEAD's account on behalf of a named session
>    of that half, or by the half's own owner account (`aminfaudzi` for half AM). A developer who lost the race renames its folder before pushing. The SEDIA
>    MERGE checker refuses a PR whose number is not claimed by that PR's item, or is claimed twice.
> 3. **Immutable once merged.** A migration on `feature/v2-backend` is never edited, renamed or deleted. A fix is a new
>    migration (as AZ-22 / 0041 did for the 0018 index name).
> 4. **Order independence.** The two ranges interleave in time: a lower number (e.g. 0042) can merge after a higher one
>    (0070). `prisma migrate deploy` then applies 0042 after 0070 on any database that already has 0070 (staging, the
>    demo, a rehearsal). So a migration may depend only on migrations **already on the tip** when its PR is opened, never
>    on an open PR of the other half; if it must, it takes a number above that migration and says so in the PR body.
> 5. **Forward-only, expand then contract.** Until the go-live + 2 weeks, migrations are additive (new tables, columns
>    with defaults or nullable, indexes, relaxed constraints). Dropping or renaming a column or table, or tightening a
>    constraint on data that the old-system import loads (`migratable-models.json` tables), needs a LEAD decision in the
>    PR body, a rehearsal on the AZ-30 rehearsal database (`deploy/rehearsal/rehearsal-db.sh`) and a note in the
>    deviations doc.
> 6. **Checks.** Every migration passes `be:lint:migration` (no Postgres enums; legacy columns on migratable tables),
>    the 63-byte identifier spec (AZ-22), the full `be:verify` in the SEDIA MERGE trial merge, and a clean apply on a
>    fresh database AND on a copy of the current demo or rehearsal schema (the order-independence check of rule 4).
> 7. **Production.** Migrations reach production only through the deploy (`deploy/vps/deploy.sh` step 5, after the
>    pre-deploy backup); never by hand. The migration of a release is listed in its deploy note. Once production
>    exists, a migration that rewrites a large table (`practice_answers`, `coin_ledger`, `battles`) states its expected
>    lock time from the rehearsal.

## 3. Contract ownership

### Rules text (approved 22 Oct 2026)

> **Contract (extends rule 3).**
> 1. `packages/contract/**` and `openapi.json` change only in a **contract-only PR** that the LEAD opens or ASSIGNs
>    (`contract/<item>-<slug>`), merged before the implementation PRs that need it.
> 2. **Who drafts.** The half that owns the module (its lane) drafts the patch and puts it in its implementation PR body
>    under a "Contract patch for the LEAD" heading, with the reason. It never edits `packages/contract/**` in that PR.
>    The LEAD decides: apply as a contract-only PR, change it, or refuse.
> 3. **Per-module ownership of the contract text** follows the lane of the module's backend card (`Lane` column of
>    `docs/plan/backend-tracker.md`). The examples below are read from that column and the lane split of
>    `docs/plan/sessions.md`; where they differ, the tracker row wins. Examples: `bijak`, `spm` (PC-3), `ai`, `intake` (PC-5), `games`, `battle` (PC-7) →
>    half AZ; `auth`, `session`, `users`, `schools` (PC-1), `classes`, `reports` (PC-6), `pksk` (BE-42), `marketplace`
>    (BE-46) → half AM. A folder whose cards sit in more than one lane, or none, is LEAD-only until the LEAD names an
>    owner. A change to a schema both halves use (`common`, `zod.ts`, `files`) is drafted by the requester and needs an
>    ACCEPT from the other half before the LEAD applies it.
> 4. `openapi.json` is regenerated with `npm run contract:emit`, never hand-edited or hand-merged; `contract:check` is
>    part of every verify. A breaking change needs the `contract-breaking` label (the `openapi-diff` job in `api.yml`
>    fails otherwise) and a note to the frontend.
> 5. **Frontend sync.** After each contract merge, half AZ (S5) syncs the contract into `be/integration-frontend` in one
>    sync PR before any frontend PR that relies on it (as #120 does).

## 4. Decisions for the LEAD (one word each)

| # | Question | Words | Default |
|---|---|---|---|
| 1 | Adopt the three shared-file classes and the file lists in section 1 | YES / EDIT | **YES** |
| 2 | Hand-over protocol: REQUEST/ACCEPT/DECLINE, and `HANDOVER` only by LEAD notice | YES / NO | **YES** |
| 3 | Next migration blocks of 30 from 0100 when a range has 3 numbers left | YES / NO | **YES** |
| 4 | Order-independence rule (depend only on migrations already on the tip) plus the SEDIA MERGE check of the claim | YES / NO | **YES** |
| 5 | Additive-only migrations until go-live + 2 weeks, with exceptions by LEAD decision plus a rehearsal | YES / NO | **YES** |
| 6 | Contract drafting by the module's half in the PR body; the LEAD applies it in a contract-only PR | YES / NO | **YES** |

Reply format: `AZ-27: 1 YES, 2 YES, 3 YES, 4 YES, 5 YES, 6 YES` (or `EDIT` with the change in the same comment).

After the answer: the approved "Rules text" goes into `docs/plan/AGENT-SYNC.md` (LEAD-only, so by the LEAD or on a
LEAD ASSIGN); the SEDIA MERGE checker prompt gets the claim check (rule 2 of DEC-14) from the LEAD.

## 5. Decision record (22 Oct 2026)

| # | Item | Answer | In force |
|---|---|---|---|
| 1 | Three shared-file classes and the file lists (section 1) | **YES** | From the answer. The lists include the G4 corrections below |
| 2 | Hand-over protocol (REQUEST / ACCEPT / DECLINE; `HANDOVER` only by LEAD notice; G4 Major otherwise) | **YES** | From the answer |
| 3 | Next migration blocks of 30 from 0100 (AZ 0100-0129, AM 0130-0159) when a range has 3 numbers left | **YES** | When a range reaches 3 numbers left |
| 4 | Order independence and the SEDIA MERGE claim check | **YES** | From the answer; the checker prompt change is the LEAD's |
| 5 | Additive-only migrations until go-live + 2 weeks (to 13 Nov 2026 for a 30 Oct go-live); exceptions by LEAD decision plus an AZ-30 rehearsal run | **YES** | From the answer |
| 6 | Contract drafted by the module's half in the PR body; the LEAD applies it in a contract-only PR; `openapi.json` only via `contract:emit` | **YES** | From the answer |

G4 minors of the independent review on #139, folded into the rules text above:

1. Seed index path: the list names `apps/api/prisma/seed/index.ts` and says it corrects AGENT-SYNC rule 4.
2. `v2-cutover-plan.md` and `cloud-dump-procedure.md` are marked "lands with #124 / #125"; SH-02 and SH-04 are named
   as the shared items on #109.
3. `.github/**` is LEAD-only (D70), with a named LEAD exception, no longer half-AZ owner-only.
4. LEAD-only files may also be edited on a LEAD `ASSIGN` or named exception (as #143 did for `TRACKER.md`).
5. After a conflict in an append-only schema or env file: the migration lint, type-check and env-template test run.
6. The folder-to-lane examples cite their source (the tracker `Lane` column; the tracker row wins).
7. Who may post a valid migration claim is named. CODEOWNERS for `packages/contract/**`, `.github/**` and
   `AGENT-SYNC.md` is left to the LEAD (it changes branch protection, which is LEAD-only).
