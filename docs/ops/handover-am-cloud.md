# Handover for Amin's Claude Code cloud sessions (half AM)

Written 2026-10-21. Audience: a Claude Code CLOUD session working for `aminfaudzi` on the
private repo `amin-kerja-orang/prestasiplus`. A cloud session sees only this GitHub repo. It has
no local memory folder, no global user instructions, no local credentials and no old-PC Docker.
Everything needed is below. Anything not verified is marked **Perlu pengesahan**.

Reply language to Amin: Bahasa Melayu. Code, commits, PR text and docs: English.

---

## 1. Who is who now

| Person | Role |
|---|---|
| `azarulhakim` (Azarul) | **LEAD** since 2026-10-21 21:18 MYT (PR #108, decisions D60-D65 in `docs/TRACKER.md`). Half AZ. Only person who merges into `feature/v2-backend`. Owns deploys, the production VPS, the 23 Oct demo, G5 testing, shared frontend files, contract changes. |
| `aminfaudzi` (Amin) | Developer in half **AM** under the LEAD. Repo owner (installs the Claude GitHub App, holds the staging demo password). Does NOT merge, close others' PRs, or edit the contract any more. |

What this means in practice (AGENT-SYNC.md section 0, "Rules for the two halves"):
- Half AM lanes: PC-1 Identity/Users/Subscriptions, PC-4 data migration from the old system
  (BE-27..30, 34, 35), PC-6 Teacher/Reports/Seed. Also issues #94, #95, #97-#99, BE-42 PKSK, BE-46 marketplace.
- Take cards only from half AM lanes. Nothing left: report `idle`. Never take half AZ cards unless a Lead notice says so.
- Migration numbers for AM: **0070-0099** (AZ: 0040-0069). Never use 0024, 0016, 0029. 0035, 0036, 0039 are retired. Ask before creating a migration folder.
- `packages/contract/**` and `openapi.json` change only by the LEAD, in a contract-only PR. Send the exact diff or an issue; never hand-edit `openapi.json`.
- Shared files are append-only (`apps/api/src/modules/index.ts`, `apps/api/src/seed/index.ts`, `seed/poc/index.ts`, registries, deviations doc, `docs/plan/seed-profile.md`). Never edit the other half's lines. In `docs/plan/backend-tracker.md` edit only your own card rows.
- Frontend shared files (router, menu, `prototype-scope.ts`, transport) are changed only by half AZ.
- Build on your own `be/<card>-<slug>` or `fe/*` branch, open a (draft) PR, wait for the LEAD's merge.
  Every PR passes the "SEDIA MERGE" checker (scheduled every 2 hours: independent G4 Approve, no open findings, no conflicts, unique migrations, trial merge plus full `be:verify`).

## 2. State at handover

- Tip: `feature/v2-backend @ 23c98226` (merge of #108). Re-check with `git fetch origin && git rev-parse --short origin/feature/v2-backend` before relying on it.
- Open draft PRs:
  - **#105** (Azarul): solo games. Not Amin's.
  - **#101** (`ops/cloud-setup`): `docs/ops/cloud-migration.md` plus `scripts/cloud-install.sh`. **Amin to approve.** The SessionStart hook snippet is in section 2.5 of `docs/ops/cloud-migration.md` on that branch and is NOT committed (see section 3).
  - **#82** (BE-29 WIP ETL): Amin's lane (PC-4). Continue only when Amin says "Continue BE-29"; work in that card's existing branch.
- Items handed to the LEAD in the #108 comment (do not do these yourself):
  1. DB run of `test/practice-question-source` on the tip.
  2. Contract `.strictObject` patch from #106.
  3. BE-10 AC 11 follow-up issue.
  4. BE-47 sponsorship test flake.
  5. BE-33 AC7 rehearsal, and AC9 re-read of threat-model rows 44/46/48/50.
- Programme boards: issue #67 (merge queue), #78 (follow-up backlog, LEAD-owned).
- Live card board = the `be/*` branches on GitHub: `git fetch origin --prune && git ls-remote --heads origin "be/*"`. A branch for a card means the card is taken, whatever the tracker says.

## 3. First cloud session checklist

Environment (done by Amin in claude.ai; sessions cannot do this themselves):
1. Sign in at https://claude.ai/code with the claude.ai account; "Sign in with GitHub"; install the Claude GitHub App on `amin-kerja-orang/prestasiplus` (private repo). Confirm the repo shows in the selector. Plan type and whether a shared org environment is possible: **Perlu pengesahan**.
2. Create an environment (suggested name `pp-backend`). Network level: **Trusted** (default; covers npm, GitHub, Docker Hub). If `npm ci` fails downloading the Prisma engine or a postinstall binary, switch to **Custom** and add that host (**Perlu pengesahan**).
3. Setup: after #101 is merged, use `bash scripts/cloud-install.sh` (no-op unless `CLAUDE_CODE_REMOTE=true`). Until then use a setup script that runs `npm ci`. The script: `npm ci` (skipped if up to date), start PostgreSQL (`service postgresql start`, else `pg_ctlcluster`), create the test role (LOGIN SUPERUSER) and DB, export `TEST_DATABASE_URL` into `$CLAUDE_ENV_FILE`, then `npm run db:generate -w @pp/api`.
4. Hook (Amin adds it to `.claude/settings.json`; not committed by #101):
   ```json
   { "hooks": { "SessionStart": [ { "matcher": "startup|resume",
     "hooks": [ { "type": "command", "command": "bash \"$CLAUDE_PROJECT_DIR\"/scripts/cloud-install.sh" } ] } ] } }
   ```
5. Long commands: raise the two `BASH_*_TIMEOUT_MS` variables (`docs/ops/cloud-migration.md` section 2.4) and run long steps in the background writing to a log file, then poll the log.
6. PostgreSQL: the VM has PostgreSQL 16. Test DB URL form (placeholders only): `postgresql://<user>@127.0.0.1:5432/postgres`. The role needs CREATEDB/superuser (tests create and drop databases; migration 0001 runs `CREATE EXTENSION pgcrypto`). Fallback: leave `TEST_DATABASE_URL` unset and let Testcontainers start `postgres:16-alpine` (Docker socket access: **Perlu pengesahan**).

Secret and variable NAMES (values are entered by Amin in the claude.ai environment settings; never in the repo, chat, PR text or logs; never read or copy values from the old PC vault):
- Tests: `TEST_DATABASE_URL` (non-secret local value; the script sets it). Optional script overrides: `PP_TEST_DB_USER`, `PP_TEST_DB_PASS`, `PP_TEST_DB_NAME`, `PP_TEST_DB_HOST`, `PP_TEST_DB_PORT`.
- Only when running the API itself (throwaway dev values): `DATABASE_URL`, `SESSION_SECRET`, `IC_HASH_KEY` (different from `SESSION_SECRET`), `NODE_ENV`, `PORT`, `LOG_LEVEL`, `BASE_URL`, `PUBLIC_BASE_URL`, `PUBLIC_ORIGINS`, `COOKIE_SECURE`, `TRUST_PROXY_HOPS`, `ALLOW_DEMO_SEED`, `BIJAK_POC_QUESTIONS`.
- Compose stack: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`.
- Staging/deploy names from `render.yaml` and `docs/ops/demo-cloudflare-supabase.md` (LEAD territory; do not set unless asked): `CLIENT_IP_HEADER`, `EDGE_PROXY_SECRET`, `FILE_STORAGE_DIR`, `VITE_API_MODE`, `BASE_URL`.
- E2E over HTTP: `E2E_DEMO_PASSWORD` (a CI secret; the staging demo password is held by Amin, not in the repo; set only when actually running it).
- Secret-grade: `SESSION_SECRET`, `IC_HASH_KEY`, `POSTGRES_PASSWORD`, `E2E_DEMO_PASSWORD`, `EDGE_PROXY_SECRET`, any DB URL with a password. Environment variables are readable by anyone using the environment; API keys that Claude calls over HTTP should be "network secrets" instead. Prefer a per-person environment for secrets.
- Full variable list and which lane needs which: `docs/ops/cloud-migration.md` section 3.

First commands to verify (post the results in one `--body-file` comment to the LEAD):
```
git fetch origin && git log -1 --oneline origin/feature/v2-backend
psql "$TEST_DATABASE_URL" -c 'select 1'             # returns 1
npm run be:typecheck                                # exit 0
npm run contract:check                              # exit 0, no DB needed
npm run be:test -- <one spec path> --maxWorkers=2   # one targeted spec, note the elapsed time
gh auth status                                      # how gh is authenticated in the VM: Perlu pengesahan
```
Then: read `docs/plan/AGENT-SYNC.md` (latest Lead notices first) from `origin/feature/v2-backend`, make a session name (snippet in AGENT-SYNC "Quick start"), and take the first free half-AM card from the Open list.

## 4. Working rules for Amin's sessions

Role and delegation (from Amin's global instructions):
1. The main session is supervisor only: understand, split, write precise briefs, delegate, verify. Why: keeps the lead context clean and the work checked.
2. Delegate all implementation (investigation, code, tests, scripts, docs) to subagents with `model: "sonnet"` (alias for the newest Sonnet; never pin a version ID). Why: Amin's standing cost/quality decision.
3. Run independent subagents in parallel, one per independent part, each owning its own files. Why: speed, no edit conflicts.
4. Verify results yourself: re-run tests/checks; do not trust a subagent report as-is. Why: reports are confident even when wrong.
5. Pushes, deploys and prod writes are done by the main session itself, not by a subagent; subagents prepare and dry-run. Why: the auto-mode permission classifier rejects delegated push/deploy requests.
6. Subagents cannot grant extra permissions. If one is denied, do not look for a workaround; report it to Amin. Why: permission safety.
7. When touching `settings.json`, check for broken rules (several rules joined in one string with `\(` never match and fail silently). Why: silent permission bugs.
8. Brief subagents precisely (goal, exact files, task IDs, decisions made, expected output) and tell each to keep scratch files in its own subfolder. Why: subagents do not see this conversation.

Git and GitHub:
9. Before every push: `git fetch origin && git rebase origin/feature/v2-backend`, then `npm run contract:emit` and commit any `openapi.json` change. Why: stale-base `openapi.json` caused heavy conflicts. After rebasing a branch that had merge commits use `git push --force-with-lease`, only on your own branch.
10. No repeated WIP pushes; batch and push once, but push at least hourly and before a session ends, updating the tracker row and PR description with each push. Why: every push runs CI (about 10 min) and Actions minutes hit 90% on 2026-10-20, yet others see only what is on GitHub. Obey any LEAD "tahan push" hold.
11. Targeted checks while developing (`be:typecheck`, `be:lint`, vitest on the card's folders). Run the full `npm run be:verify` ONCE before the push, and tell the LEAD first. Why: heavy, and it gave false timeouts under load. In the cloud each session has its own VM, so only the one-run-per-push part still matters.
12. Post every `gh pr comment` / `gh issue comment` with `--body-file <file>` (write the text to a file first). Why: inline `--body` lets bash eat backticked paths and SHAs, silently.
13. Scripted conflict resolution: run resolve, add, commit, push under `set -e`; assert `git grep -n '^<<<<<<<' -- <file>` is empty before `git add`; regexes must accept `\r?\n` (CRLF files such as `docs/plan/backend-tracker.md`). Why: a missed CRLF match once committed and pushed conflict markers.
14. Never commit in a `--no-checkout` worktree (empty index means the commit deletes the tree; it once wiped 4087 files on the shared branch). Use a full `git worktree add --detach <path> <ref>`. Always `git show --stat <commit>` before pushing; thousands of deletions are the red flag. Recover with `git revert` plus a re-applied edit, not a force push.
15. One session, one checkout: `git worktree add ../pp-<card-id> -b <branch> origin/feature/v2-backend`, then `npm ci`. Confirm you are in the new directory before editing; do not chain edit/commit after a possibly failed `cd` with `;`. Why: a failed `cd` runs the edits in the wrong tree.
16. Kill only processes you started (own PID or task id); never filter by process name such as `node` or `vitest`. Why: other work dies silently.
17. Never point tests at staging or production.

Coordination:
18. Report to the LEAD at once when done, idle or blocked: post SHA plus status (or the blocker) on the PR or issue. Also post a short note when a long run (`be:verify`) starts and ends. Why: a silent session stalls the programme.
19. Talk to the team through GitHub (PR comments, issues labelled `question`, `blocked`, `contract`, `cross-lane`), never by asking Amin to relay messages. Ask Amin only for what only he owns (VPS, credentials, scope decisions). Why: Amin does not want to be the postman.
20. Do routine authorised work without asking permission (verify, branch, PR, tracker row), then report. Ask only for irreversible or outward-facing decisions, or a real blocker. Why: per-step confirmation annoys Amin.
21. Re-read `docs/plan/AGENT-SYNC.md` from `origin/feature/v2-backend` at the start and end of each session. Authority order: Lead notices and `lead` issues, then AGENT-SYNC, then the lane prompt, then the card file. Resume a card only when told "Continue BE-xx".
22. Superseded: the old LEAD-only habits (fast-forward merges, closing PRs, keeping the other group's card pipeline full, contract edits, allocating migrations) no longer apply to Amin's sessions.

Product and content:
23. Reply to Amin in Bahasa Melayu; code, commits, docs in English. Why: project rule.
24. No warning icons. Flag uncertain items in words: "Perlu pengesahan". Why: Amin's preference.
25. Privacy: never write a real person's name (teachers, students, authors, even in placeholder copy) into docs, seeds or code; use fictitious names. Exceptions: the handles `aminfaudzi`, `azarulhakim` and the first names Amin and Azarul. Never write secrets or personal data to the repo, PR text or summaries. Why: privacy overrides fidelity.
26. No generated media: no invented video, image, audio, fake YouTube ids or thumbnails. Use only media observed on live or the source server; otherwise leave empty or use the empty state. (Exception: user-triggered capture of the user's own on-screen content, e.g. the M14 card PNG.) Why: the rebuild mirrors real data.
27. No external-platform screens (payment gateway, WhatsApp, OAuth embeds). Simulate success/failed outcomes in-app (D14). Why: integration comes later.
28. Where a screen cannot be observed on live (roles with no login), the server code/data is the authoritative spec (D24; tag it SERVER). Do not ask Amin for role accounts. Live wins where it was observed. Why: Amin repeatedly said so.
29. `prestasiplus.cloud` is the primary v2 reference; `prestasiplus.my` only for what is missing there (D28-D32). The "tangkap muat" / capture ("ripped") work on prestasiplus.cloud is a SEPARATE project: do not touch it. Old systems are never modified; live is read-only.
30. Before showing a page to Amin, load it headless and confirm: body has content, no `pageerror`, no 4xx/5xx. Why: he once got a blank page.
31. When progress is asked for or crosses a 10% boundary, report overall % using `docs/TRACKER.md` section 0b and update the tracker with real numbers without asking. Count only evidenced work. Never claim a gate passed without real tool output.
32. Responsive is mandatory (375 / 768 / 1280px, no horizontal page scroll) for any UI work. Why: gates G4/G5.
33. Staging or deploy actions need explicit LEAD (and user) confirmation (`docs/ops/staging-refresh-2.md`, `docs/ops/deploy-execution.md`).

## 5. What stays only on the old PC

Saved to GitHub at the handover (2026-10-21), **not reviewed, not for merge as is**:
- `fe/wip-pc-handover` @ `b5e49cfc` (on `feature/student-prototype` @ `3e192a7a`): 25 uncommitted main-tree files — m17 Command Center board (12 components, page, test, e2e smoke), design system (`DsDataTable`, `DsNativeSelect`, `states.css`, form test), theme (`ui.config.ts`, `ui/components.ts`), `PentadbiranLayout.vue`, `docs/design/v2-screen-restyle-spec.md`, `docs/plan/backend-tasks/BE-03-auth-session.md`, and the root `CLAUDE.md` "Split for speed" rule (user instruction 2026-10-19). Owner of the frontend parts: **Perlu pengesahan** (half AZ owns shared frontend files; agree with the LEAD before building on it).
- `backup/pc-amin/v2-gap` (`4e65645a`, 2026-10-19, 17 files, design-system Wave 2A gaps) and `backup/pc-amin/v2-cm-b` (`61edc44b`, 2026-10-19, 493 files, Wave 2B codemods CM-2..4; probably stale against the restyle work on origin). Backups only.
- `feature/student-prototype` tracker commit `3e192a7a` pushed.

Left on the old PC only (checked: already on origin, superseded, v1-era or noise): 9 branches whose content is on origin (`backup/BE-19-*`, `backup/BE-24-*`, `backup/e2e-bijak-pre-rebase*`, `be/sweep-http`); 25 v1 prototype branches dated 2026-10-02..10 (`s1-*`, `s3-*`, `s7-*`, `m04-*`, `m05-*`, `worktree-agent-*`); 3 stashes (two CRLF phantoms, one v1 M05); superseded WIP in `pp-be19f`, `pp-be42`, `pp-int-regression`, `be-09-question-bank`; CRLF/scratch noise in other worktrees; private untracked notes in the main tree. Also the credentials file and the read-only server reference copy (never to be copied into the repo).

## 6. Where to look

- `docs/plan/AGENT-SYNC.md`: rules of the two halves (section 0), Quick start, Open list, Lead notices. Source of authority.
- `docs/TRACKER.md`: decisions D60-D65 (halves, LEAD change), D28-D32 (v2 direction), section 0b (progress formula).
- Issue #67: merge queue. Issue #78: LEAD-owned follow-up backlog.
- `docs/ops/cloud-migration.md`: cloud setup, env variables, first-day checklist (section 5). Section 2.5 (setup script, hook) is on `origin/ops/cloud-setup` (PR #101).
- `docs/plan/backend-tracker.md`: card rows (edit only your own). `docs/plan/reviews/`: fix review files named after your card first.
- `CLAUDE.md` and `AGENTS.md` at the repo root: project rules (SDLC gates, fidelity, privacy).
