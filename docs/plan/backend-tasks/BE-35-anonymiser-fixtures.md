# BE-35 Anonymiser tool and synthetic .cloud fixture generator

| Field | Value |
|---|---|
| Size | M |
| Lane | PC-4 (folders: sessions.md section 5) |
| Priority | P1 |
| Wave | M (migration stream) |
| Depends on | BE-27 (needs `staging_cloud.sql`) |
| Parallel with | every API card, BE-28 |
| Owner module | migration |
| Security review | required (the tool handles real personal data of minors on the lead's PC) |

## Goal

Two things so that nobody except the lead ever touches real data: (a) an **anonymiser** the lead runs against the read-only .cloud source (or a raw dump on the lead's PC) that outputs a structurally faithful but pseudonymised dump for rehearsals; (b) a **synthetic fixture generator** that gives every developer and CI realistic .cloud-shaped data, including nasty cases, with no real data at all.

## Inputs (read these)

- `docs/plan/AGENT-SYNC.md`, `docs/plan/sessions.md` section 5
- `docs/architecture/v2-backend-plan.md` section 14.8 and section 9 (secrets and data protection)
- `docs/architecture/v2-data-migration.md` sections 1 (inventory), 4 (field differences), 5 (risks: PII, passwords, duplicates, orphans, date columns), 7
- BE-27 outputs: `apps/api/src/migration/ddl/staging_cloud.sql`, the profile report generator, `docs/architecture/v2-migration-runbook.md`
- BE-34 outputs (kit, `.gitignore` guard)
- Requirements: BE-NFR-13; BE-MIG-14, BE-MIG-15 ([URS 9.2](../../requirements/v2-backend-urs.md))

## Outputs

- `apps/api/src/migration/anonymise/**`: CLI `anonymise:run --source <read-only url or dump> --out <path> --config <anon.config.json>` (npm script in `apps/api/package.json`); per-table, per-column rules (`keep`, `pseudonym(kind)`, `null`, `fixed`, `scrub-text`, `hash-password-dummy`); deterministic pseudonyms from `HMAC(key, value)` mapped to realistic fictitious values (names, e-mails on the reserved domain `example.test`, phone-shaped numbers, IC-shaped numbers that fail the checksum, usernames); the key is read from the environment variable `ANON_HMAC_KEY` or a key file named by `ANON_HMAC_KEY_FILE`, **outside the repo**, and is never logged; the tool refuses to run if any column of the staging DDL is not covered by a rule (default deny)
- `apps/api/src/migration/anonymise/leak-scan.ts`: after anonymising, scans the output for e-mail/phone/IC patterns and for the original values (hashed lookup) and fails on any hit
- `apps/api/src/migration/fixtures/generate.ts`: `fixtures:generate --size tiny|small|medium --seed N`; deterministic; writes the `staging_cloud` shape (SQL `COPY` files or direct load); includes deliberate cases: orphan rows, duplicate e-mails, unknown enum values, non-bcrypt and shared-default hashes, roster users without e-mail, date-only edge cases (UTC vs Malaysia midnight), cyclic references, attempts whose legacy question is missing; also writes a manifest of the planted anomalies
- `apps/api/test/migration/fixtures/tiny/**` (committed, under 1 MB) and generator tests
- `docs/architecture/v2-migration-runbook.md` sections: "Lead: producing an anonymised dump", "Developers: using fixtures", "Deleting dumps"
- Tests under `apps/api/test/migration/anonymise/**`

## Files touched

Everything a PC may write for this card. A path outside this list needs a `cross-lane` issue first (sessions.md section 5).

- Folders written: `apps/api/src/migration/anonymise/**`, `apps/api/src/migration/fixtures/**`, `apps/api/test/migration/anonymise/**`, `apps/api/test/migration/fixtures/**`, `docs/architecture/v2-migration-runbook.md`.
- Prisma file(s): none (no schema change).
- Contract: none.
- Seeds: none.
- Tests: `apps/api/test/migration/anonymise/**`, `apps/api/test/migration/fixtures/**`.
- Other files: `apps/api/package.json` (scripts `anonymise:run`, `fixtures:generate`).
- Append-only shared files (one line each, never reorder): `docs/architecture/v2-backend-deviations.md` (a dated row only if you deviate); your own row in `docs/plan/backend-tracker.md`.
- No-clash note: PC-4 only; no Prisma file. It extends the folder and runbook created by BE-27 (BE-35 depends on BE-27).

## Endpoints

None.

## DB tables touched

`staging_cloud.*` only (load targets). No v2 tables.

## Acceptance criteria

1. Default deny: a column without a rule makes the tool exit non-zero and name the column (test with a synthetic DDL).
2. Determinism: same input and same key give identical output; a different key gives different pseudonyms; the same source value maps to the same pseudonym across tables, so relations and uniqueness survive (duplicate e-mails stay duplicates, distinct stay distinct).
3. Leak scan finds nothing on the fixture run; a planted real-looking value makes it fail.
4. Passwords: every hash is replaced by the hash of a documented dummy password; the original hashes never appear in the output.
5. The generator at `small` loads into `staging_cloud` in CI, and the BE-27 profiler reports the planted anomalies (counts match the generator's manifest).
6. Fixtures contain fictitious names only (checked against a deny-list pattern in a test) and no committed file exceeds 1 MB.
7. The runbook states: the key and raw dumps never enter the repo, the anonymised dump is shared out-of-band and encrypted, and everything is deleted after the rehearsal.

## Test commands

```
npm run be:test -- apps/api/test/migration/anonymise apps/api/test/migration/fixtures
npm run be:verify
```

## Definition of Done

1. Plan section 10 (all ten items) is met.
2. `npm run contract:check && npm run be:verify` is green. Paste the real tail of the output in the PR.
3. This card has no HTTP endpoints, so it adds no conformance scenarios; after BE-31 merges, `npm run be:test -- apps/api/test/conformance` must still pass.
4. This card creates no tables; the migration-first checklist (plan section 14.9) does not apply, but no change may break `npm run be:lint:migration` (once BE-34 is merged).
5. Label `security-review` on the PR; list the security decisions and the tests that prove them.
6. The card's tracker row is updated (status, PR number, one-line note) and the PR description follows the template in `docs/plan/backend-tasks/README.md`. Nothing stays only on your PC (AGENT-SYNC.md section 4).

## Open questions

Do not guess these; write your working assumption in the PR and ask the lead (issue labelled `question`) if it blocks you.

1. The lead runs the anonymiser on a real dump (OD-18); the card never touches real data. Confirm the dump hand-over format with the lead when OD-2 is answered.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-35 (anonymiser-fixtures). Work in this repo clone on branch be/BE-35-anonymiser-fixtures, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/plan/sessions.md section 5 (folder ownership); docs/architecture/v2-backend-plan.md (sections 9, 10 and 14); docs/architecture/v2-data-migration.md (sections 1, 4, 5); docs/plan/backend-tasks/BE-35-anonymiser-fixtures.md (this card, all of it).
Rules: Never commit secrets, keys, real personal names or any real data. You have NO access to the real .cloud database and must not ask for it; build and test only against synthetic data. Do not edit src/**, e2e/**, docs/TRACKER.md or contract folders. Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
Task: implement the anonymiser (default-deny column rules, deterministic HMAC pseudonyms, leak scan) and the seeded synthetic fixture generator that emit the staging_cloud shape defined by BE-27. Needs a security review.
When finished run npm run be:verify and report: files changed, real test output, deviations, open questions. Update docs/plan/backend-tracker.md (your card row) in the same PR.
```
