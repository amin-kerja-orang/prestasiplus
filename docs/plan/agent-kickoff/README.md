# Starting a new PC (Claude Code kickoff)

Each backend lane has a paste-ready prompt: [PC-1](PC-1.md) Foundation to Identity, [PC-2](PC-2.md) Learning and Question bank, [PC-3](PC-3.md) Bijak and Paper builder, [PC-4](PC-4.md) Migration and ETL, [PC-5](PC-5.md) AI intake, [PC-6](PC-6.md) Teacher, Reports, Conformance and Seed, and [LEAD](LEAD.md) for the lead's integration assistant. The programme overview is [../sessions.md](../sessions.md); card status is [../backend-tracker.md](../backend-tracker.md).

## 0. Before anyone starts (lead, once)

The lead completes sync point S0 ([../sessions.md](../sessions.md) section 2): `feature/v2-backend` exists on GitHub with the plan, branch protection is on, each collaborator has write access to branches `be/*`, and the open decisions OD-1, OD-3, OD-12, OD-19 are answered. Nobody starts a lane before S0.

**Short rules for every agent session: [../AGENT-SYNC.md](../AGENT-SYNC.md)** (find a task, claim it with a draft PR, push hourly and at session end).

## 1. One-time setup on a new PC

Requirements: Git, Node 22.22.2 or newer (see `engines` in `package.json` and `.nvmrc`), Docker Desktop with Compose v2 (needed for PostgreSQL and Testcontainers), Claude Code installed and signed in, GitHub access to `github.com/amin-kerja-orang/prestasiplus`.

```
git clone https://github.com/amin-kerja-orang/prestasiplus.git
cd prestasiplus
git fetch origin
git switch feature/v2-backend
node -v                      # must satisfy engines
npm ci                       # installs every workspace
npm run contract:check       # must pass on a clean checkout
npm run typecheck && npm test   # frontend baseline must be green first
```

Once BE-01 and BE-02 are merged (PC-1 does them first):

```
cp .env.api.example .env.api       # local values only; git-ignored
cp .env.db.example .env.db         # local values only; git-ignored
docker compose up -d db            # PostgreSQL 16, no host port by default
npm run be:db:migrate
npm run be:verify
```

Never commit `.env.api`, `.env.db`, API keys, dumps or `.migration-out/`. If you need a host port for a DB tool, use an uncommitted `compose.override.yaml` (see `docs/architecture/v2-backend-plan.md` section 11). Docker must be running for the tests (Testcontainers).

## 2. Start a lane session

1. Pick the lane file for this PC (one lane per PC; if you have fewer PCs than lanes, run lanes one after another, see [../sessions.md](../sessions.md) section 3).
2. In the repo root run `git fetch origin && git switch feature/v2-backend && git pull --ff-only`.
3. Start Claude Code in the repo root (`claude`).
4. Open the lane file (for example [PC-2.md](PC-2.md)), copy **everything inside the `text` block**, and paste it as the first message. The prompt tells the agent to read the repo docs, read the tracker, pick the next unblocked card of the lane, branch, work contract-first, and report.
5. Let it finish one or two cards. At the end it prints the report; check that the PR is open (draft or ready) and that the tracker row on the branch is updated.
6. Start a **fresh** Claude Code session for the next session row of the lane (keeps the context small and focused).

## 3. What you do when the agent stops

| Situation | You do |
|---|---|
| Report says `review` | Make sure the PR is ready for review and CI is green; tell the lead. |
| Report says `blocked` | Read the one-line reason in the tracker; add a comment in the GitHub issue the agent opened; if the lead must decide, ping the lead. Then start a new session; it will pick the next unblocked card. |
| The agent asks for credentials, real data or access to the .cloud database | Answer **no**. The lead alone produces an anonymised dump out-of-band; the agent works from fixtures. |
| The agent wants to edit `src/**`, `e2e/**`, `docs/TRACKER.md` or another lane's folder | Answer no and let it open a `cross-lane` or `contract` issue. |
| Merge conflict on rebase | Follow [../sessions.md](../sessions.md) section 5/6: keep both sides on append-only files, regenerate `openapi.json` with `npm run contract:emit`, delete and regenerate your own unmerged migration. |

## 4. Daily routine (any lane)

```
git fetch origin
git rebase origin/feature/v2-backend     # on your own be/ branch
npm ci                                    # only if package-lock.json changed
npm run contract:check
npm run be:verify
git push --force-with-lease               # your own branch only
```

## 5. Rules that never change

- Contract first; one card, one branch, one PR into `feature/v2-backend`; the lead merges.
- Work only in your lane's folders; never `src/**`, `e2e/**`, `docs/TRACKER.md`.
- No secrets, no real people's names, no real data; the .cloud database is never reached from a collaborator PC.
- Migration-first schema rules (plan section 14) on every new table.
- Update your rows in [../backend-tracker.md](../backend-tracker.md) inside your PR.
