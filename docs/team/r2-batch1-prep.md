# R2 batch 1: preparation note (read-only; no queue issued)

Status: preparation only. The R2 queue is NOT issued until the user approves (after R1 sign-off and the code-freeze decision). Prepared by A3 at 2026-11-02 06:03 UTC on BASE-202 1045e798; filed by the team A lead.

## Units (heads from ls-remote)

Base has moved: BASE-201 = reqb076-live-takedown c8965bb8 and BASE-202 = bulk-publish-allskipped 9b8b3940, so 4 held units remain, plus the local reqb079 minors.

**Merge order: 1 → 2 → 3 → 4.** Cumulative: 23 files, +602/−24 vs BASE-202. The only conflict is v2-backend-deviations.md (union). No contract emit change.

| # | Unit | Head | Notes | Conflict on BASE-202 |
|---|---|---|---|---|
| 1 | reqb076-approve-gate | c3557c60 | Supersedes live-takedown, which is already in base. Check that the two gates do not double-refuse or double-list. | Deviations doc only |
| 2 | builder-publish-p2028-test | 645744da | P2028 → 429 + Retry-After | Clean |
| 3 | reqb079-t34-t36-minors | 52345db7 | Plus the local A3 commits d8a3ebed/cbb78174 (sweepUser try/catch + test nits; 667/667), pushed as a fast-forward only after the lead's OK | Clean |
| 4 | e05b-l1-split-control | c4153ed7 | Test only | Clean |

## The E2E re-run must cover

Baseline: B4 r1-e2e-baseline 36/0/7 per width with raised throttles, on BASE-195.

- Approve and bulk Terbit of a version whose source is taken down: refused with `fields.source` / `failed[]`. Include an untouched-source control, and check there is no double gate with live-takedown.
- The bulk all-skipped flash (regression check).
- Builder Terbit:
  - P2028 → 429 + Retry-After;
  - the audited override and the review panel;
  - a paper with no Kontrak gets "Tiada blueprint", which is overridable; a Terbit paper gets no contract blocker.
- Attempts view/submit when the bundle is gone → 404. History stays 200 when there is one dead expired sitting.
- Image access with a sitting on a taken-down source: unchanged (REQ-B-074/077).

## KIV R2 items

| # | Item | KIV row | Owner | Size | Dependencies | Contract |
|---|---|---|---|---|---|---|
| 1 | Approve-gate override + clearing or replacing a source | 53 | M04 BE | M | Unit 1; override copy approval | Additive |
| 2 | Admin servability reason code `source_taken_down` | **new row (lead: add)** | contract + M04 | S–M | — | Additive |
| 3 | Null-blueprint demo seeds | 54 | seeds | S | Unit 3; shared-store worktree | None |
| 4 | [PROPOSED] strip | 56 | contract | S (at emit) | Copy approval | Text only |
| 5 | sweepUser minor | 55 | A3 | S | Unit 3; already fixed locally | None |
| 6 | pg "already executing" warning | 51 part 2 | QA/BE | XS | — | None |
| 7 | REQ-A-028 ready-tiers (r1/ready-tiers-check 9c80f08c) | **new row (lead: add)** | health BE + devops | M | Devops change first | None expected |

Other KIV rows:
- Row 33 is closed.
- Row 44 (Guru dismisses an exact duplicate): option (a) is size S with no contract change; option (b) is size M with additive decidedBy/decidedAt.
