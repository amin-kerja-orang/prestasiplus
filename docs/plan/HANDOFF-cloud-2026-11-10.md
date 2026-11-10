# Handoff to the cloud session — 10 Nov 2026

For the next Claude session (Claude Code on the web) that continues V3 R1 work on branch
`feature/v3-bijak-r1`. Read this, then `CLAUDE.md`, `docs/TRACKER.md` (latest change-log rows) and the
live tracker `docs/plan/r1-pelan-100-peratus.md`.

## 1. Where things stand

- Goal: V3 100% ready on UAT (`uat.prestasiplus.cloud`) with the V2 (prestasiplus.cloud) database cloned
  and **working in V3** (not a raw copy).
- PO switched strategy on 10 Nov: deploy V3 to UAT now and use UAT for full-data loads; the local PC is only
  for code and small sample tests. UAT DB is rebuilt with `deploy/vps/rebuild-db.sh` (guarded; see
  `docs/ops/r1-uat-deploy.md`). The first UAT rebuild was run on 10 Nov from release `86dcb0f36` — check its
  result in the tracker change log.
- Readiness report: `docs/plan/r1-kesediaan-uat-2026-11-10.md`. Question-bank migration design:
  `docs/architecture/v2-question-bank-migration.md`.

## 2. PO rules (from the PO, in force)

- Reply to the PO in Bahasa Melayu; code/commits/docs in English (tracker/plan docs may be BM).
- V3 replaces V2 and continues V2's management: everything in V2 that is not deleted comes over with its
  status (approved, archived, draft). "Experience sama" for pupils, teachers and admins.
- Core DSKP rule (D90/D105): a rajah/stimulus is a group stimulus, never a standalone question; EVERY
  question of the group shows the rajah (Q2, Q3 … too); members keep V2 order; groups are never split.
  V2's defect (2nd+ questions without the rajah, rajah stored as its own "question") is repaired, never copied.
- Menu labels and page titles/subtitles must equal V2 (prestasiplus.cloud is the primary reference).
- Fix clear defects, V2 gaps and unimplemented PO decisions directly — do not ask whether to fix them. Ask
  (with options) only genuine product choices, data values only the PO knows, and push/deploy approvals.
- Estimates are in agent hours, never human developer-days.
- Never load the full V2 data on a local PC; use a scenario sample. Full loads only on UAT.
- No clutter: no new folders in the repo or beside it; temp output outside the repo; every agent stops the
  processes/containers it starts and removes its temp folders before reporting.
- Change only what the PO names when they point at a UI defect; don't restyle other things (e.g. the lime
  Mod Pelajar bar stays as it is).
- Report progress at each milestone; keep the tracker current; commit finished work promptly.
- Credentials are never written to the repo, docs, commits or messages. Live V1/V2 are read-only. Never touch
  the V2 production server's other tenant (pios). UAT holds real data: back up before any rebuild.
- Push and UAT deploys need explicit PO approval each time.

## 3. Open work (see the tracker for IDs)

1. `migrate:verify` does not know the new loaders (questions all statuses, structured, papers, documents,
   files) — extend `apps/api/src/migration/verify/*` so the rebuild can run without `--verify-soft`.
2. Legacy V2 papers: 64 of 69 published papers have no duration; V2 served them untimed (elapsed clock).
   V3 `ck_papers_duration` forbids untimed simulasi — allow untimed legacy papers (V2 parity) so they stay
   published. Kertas inference (`load/papers/plan.ts` `inferKertas`, rules `papers-3`) is written but
   untested: add unit tests, run the papers specs.
3. `test/migration/kit/migratable-double-upsert.spec.ts`: 2 failures for `paper_documents` /
   `paper_document_pages` (`ck_paper_document_pages_kind`) — fix the synthetic row.
4. T-B5b specs not run: `verify/rollback.db.spec`, `core/core.db.spec`, `core/class-school-fallback.db.spec`,
   `core/roles-jpn-agent.db.spec`, `activity/wallet.db.spec`, gamification repository specs.
5. PKSK (OC-4): 748 V2 `pksk_questions` have no options/answers. Domain mapping is clear (15→15). Decide
   with the PO whether to load them as drafts for admins to complete (V3 continues V2 management) or leave
   in the archive.
6. 8,028 approved V2 questions name a figure that V2 never stored (`stimulus_missing`, never served) — they
   are in the Regroup/Audit Rajah work-lists for admins; report the list to the PO.
7. 2 V2 picture files fail the JPEG parse (38 question rows held) — convert to PNG and re-run the files step.
8. E2E: T-C9 edits unverified; T-C11 rewrite of the mock specs for the Pembelajaran shell; Kedudukan specs.
9. Gate G-100: full backend suite in Linux (`deploy/test/compose.be-test.yaml`), E2E, code review, security
   review, QA audit per role on UAT data at 375/768/1280.
10. PO decisions pending at acceptance: manual restore drill, off-host backup copy, overdue raw `.cloud`
    retention on UAT (`PP_RAW_PURGE_BY`), removing `PP_ALLOW_DB_REBUILD` after acceptance.

## 4. Facts worth knowing

- Local stack for the PO: docker compose project `pp-v3` on :5194 (PO's PC only).
- Backend tests in Linux: `docs/ops/be-tests-linux.md` (`--maxWorkers=2 --testTimeout=120000`).
- V2 data quirks found: articles/notes have no body text in V2 itself; V2 has no officer scope (PPD/JPN load
  inactive until an admin assigns scope); V2 doesn't enforce the redeem budget; 20 V2 classes have no teacher,
  school or pupils; `legacy_canonical_map` is empty.
- Server access, dumps and V2 files are on the PO's PC and the UAT server only; a cloud session needs the PO
  to configure access before it can run anything on UAT.
