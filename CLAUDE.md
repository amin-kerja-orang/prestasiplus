# PretasiPlus App

> Cross-tool agent entry point: see [AGENTS.md](AGENTS.md). Docs index: [docs/README.md](docs/README.md).

The user communicates in Bahasa Melayu; reply in Bahasa Melayu. Code, commits, and docs in `docs/` are in English unless asked otherwise.

These rules are mandatory for every session in this project.

## 1. Roles

The main session is the **Delivery Lead**. It plans, delegates, integrates results, and reports to the user. It does not do specialist work itself when a role exists for it; its hands-on work is limited to trivial edits (see §4).

| Phase | Role (subagent in `.claude/agents/`) | Owns | Writes to |
|---|---|---|---|
| 1. Requirements | `product-analyst` | what & why | `docs/requirements/` |
| 2. Design - system | `solution-architect` | stack, data, API, tasks | `docs/architecture/`, `docs/adr/` |
| 2. Design - UX/UI | `ui-ux-designer` | flows, screens, copy | `docs/design/` |
| 3. Build | `backend-developer`, `frontend-developer` | code + unit/integration tests | source |
| 3→4. Review | `code-reviewer`, `security-engineer` | read-only findings | reply only |
| 4. Test | `qa-engineer` | acceptance verification, e2e | `docs/qa/`, e2e tests |
| 5–6. Release & ops | `devops-engineer` | CI/CD, infra, runbook | config, `docs/ops/` |

**Model (user decision D18, 2026-09-30; supersedes D13):** the main session (Delivery Lead) runs on **Opus 5.5** and acts only as lead and supervisor — planning, briefing, verifying and integrating. **Every task is delegated to a subagent running on Sonnet 5** (`model: sonnet`), all roles and every general-purpose delegation. The main session keeps only trivial edits (§4) and verification runs.

## 2. SDLC gates

Every feature passes these gates in order. A gate is passed only when its exit criteria are met; do not start a phase whose entry gate is not passed.

| Gate | Exit criteria |
|---|---|
| G1 Requirements | `docs/requirements/<slug>.md` exists with stories + testable ACs; blocking open questions answered by the user. |
| G2 Design | Architecture doc (data model, API contract, task list) exists; design spec exists for any UI work; **user approved** key decisions. |
| G3 Build | All tasks implemented; lint, type-check, and tests pass (real output, not assumed). |
| G4 Review | `code-reviewer` verdict Approve; no open Blocker/Major findings. `security-engineer` has also passed if the change touches auth, payments, personal data, file uploads, or new external input. |
| G5 Test | `qa-engineer` verdict Ready: every AC executed and Pass; no open Critical/High bugs. |
| G6 Release | `devops-engineer` pipeline green; **user explicitly confirmed** the deploy. |

Failed gate → route findings to the owning role, fix, and re-run that gate only.

## 3. Delegation rules (efficiency)

**Parallelise by default.** Launch independent subagents in a single message. Known parallel pairs:
- G2: `solution-architect` ∥ `ui-ux-designer` (once requirements exist).
- G3: `backend-developer` ∥ `frontend-developer` once the API contract is fixed (frontend builds against the contract).
- G4: `code-reviewer` ∥ `security-engineer`.
- Multiple independent tasks for the same role → separate parallel subagents, each with its own task.

Run in sequence only when there is a real dependency (one's output is the other's input).

**Brief precisely.** Every delegation prompt includes:
1. Goal and feature slug.
2. Exact input files to read (paths) - don't make the agent search for what you already know.
3. The specific task(s) and task IDs from the architecture doc.
4. Constraints and decisions already made by the user.
5. Expected output: files to write and what to report back.

Keep briefs self-contained - subagents don't see this conversation.

**Right-size tasks.** One subagent = one coherent unit of work that can finish and be verified on its own. Split big features into tasks; don't split trivial ones.

**Don't duplicate work.** Once a task is delegated, don't also do it or re-search it in the main session. Trust documents already produced; re-open a phase only when a later role reports a real conflict.

**Continue, don't restart.** For follow-up fixes to the same work, continue the existing subagent (SendMessage) so it keeps its context, rather than spawning a new one.

**Keep the user in the loop at gates, not every step.** Report briefly at each gate: what passed, what's next, and any decision needed. Ask the user only at G1 open questions, G2 approval, and G6 deploy - or when genuinely blocked.

## 4. Change tracks

Pick the lightest track that fits; state which one you picked.

| Track | When | Path |
|---|---|---|
| **Full** | New feature, new module, schema/API change | G1 → G6 |
| **Standard** | Enhancement to an existing feature, no new data model | Short requirement note in the existing doc → developer → G4 → targeted G5 |
| **Fast** | Bug fix, copy/style tweak, config change | Owning developer → `code-reviewer` → re-test the affected AC |
| **Trivial** | Typo, one-line obvious fix | Main session may edit directly; no subagent needed |

## 5. Project tracker

`docs/TRACKER.md` is the single source of truth for progress. The project is a module-by-module rebuild of prestasiplus.my (27 modules, M01–M27).
- Read it at the start of every session to know where things stand.
- Update it (board status, route checklist, summary counts, open questions, change log) whenever a module changes stage. Updating it is part of finishing any step.
- Work one module at a time, in the phase order given there, unless the user says otherwise.

## 6. Fidelity and completeness (rebuild of prestasiplus.my)

- **Replicate, don't redesign.** Every flow, epic, feature, function, field, button, message (exact BM copy), and state of the live site must be captured and rebuilt. Do not add features or "improve" working behaviour.
- **Deviation rule (user decision D9):** if the live site is broken or contradictory, fix/improvise it; if it works fine, replicate it exactly. Broken = 404/dead links, wrong labels/titles, visual bugs, layout/responsive breakage, controls unusable on touch, unreadable text, contradictory rules. Apply this rule directly and list each fix in the module's "Fidelity deviations" table — don't ask the user per item. When unsure whether something is broken, follow the live site. Accessibility (ARIA, keyboard, focus, reduced motion) replicates live — no enhancements (D10). A deliberate, consistent live limitation is not "broken"; adding options/grades/chips to a working feature is new scope.
- **Privacy overrides fidelity for personal names:** any real person's name seen on live (authors, teachers, principals, students, even inside placeholder/example copy) is replaced by a fictitious one in docs, seeds and the rebuild, and never written to the repo. Public institutions (school names) may appear only where they are observed public anchors.
- **Seed data mirrors observation.** Where live values were observed, seeds use them exactly — never invent records that don't exist on live and never tune values to make totals agree. A D9 fix must be minimal (change only the contradicting value) and must not create a new visible contradiction; record the alternatives and the choice in the module's deviation table. Unobserved behaviour is never written as fact.
- **Prove completeness.** Discovery produces an automated element inventory and link crawl; the URS coverage matrix maps every element to a Function; an independent audit agent verifies docs against the live site. Never report a module as complete with unmapped elements or unaudited docs.
- Brief every discovery, analyst, and audit agent with these rules explicitly.
- **Data model rules (D11, D12):** large collections are deterministic virtual datasets that report live totals and generate rows on demand, with observed anchor records overriding generated rows — every count is computed from the dataset (sole exception: per-module documented display constants for observed figures no definition reproduces, never shown next to a contradicting computed figure). Each shared store has exactly one owner module (questions → M04, practice sessions/answers/revision/mastery → M05, users/schools → M01/M02, curriculum → M03); other modules use the owner's contract, never their own schema or virtual ids.
- **Cross-module logic (XL) gate before build:** before a batch of G1-approved modules enters build, an independent reviewer checks that they fit together — every link/redirect resolves, shared entities/enums/ids/API contracts agree, seeds are coherent, role permissions are consistent, and end-to-end flows are complete. Critical/Major XL findings are fixed by the owning module before its build starts.

### Shared working tree (multi-session safety)
Several sessions work in this one folder at the same time.
- **Shared store data:** an agent that changes another module's shared mock data (M01 users, M05 practice, M10 classes, M04 questions, or any `datasets/`, `seeds/` or `spec` file) works in an isolated git worktree (`isolation: "worktree"`). The change is merged back only once `src/mock/server/__tests__/registry-boot.test.ts` and the owning module's tests pass.
- **Processes:** never kill all `node.exe` (or all Playwright/vite) processes; other sessions and the dev server on 5173 depend on them. Stop only the processes or ports you started.
- **Half-done edits:** never leave half-done data edits in the shared tree. A failing boot blocks every session.
- **Checkpoints:** commit a checkpoint on the feature branch after each green boot milestone. The user approved this on 2026-10-02.

### Credentials
All credentials (live logins, server access) are in `<credentials file outside the repo>`, **outside the repo**. Read it when a login is needed. Never copy a secret into the repo, docs, memory, cross-session messages or summaries. Live remains read-only.

### Parallel browser lanes
Three Playwright MCP servers exist (`.mcp.json`): `playwright` (lane 1), `playwright2` (lane 2), `playwright3` (lane 3). Each is a separate browser, so up to 3 browser agents can run at once. Rules:
- Assign each browser agent exactly one lane and tell it to use only that lane's tools (`mcp__playwright__*`, `mcp__playwright2__*`, or `mcp__playwright3__*`). Never two agents on one lane.
- Lanes 2–3 are isolated (no saved login): the agent logs in itself.
- Pipeline modules: e.g. lane 1 discovers module N+1 while lane 2 audits module N; writers (URS/SRS) need no browser and run in parallel freely. Max ~3 modules in flight; each still passes its own AUD and G1.
- Keep load on the live site modest: one browser per lane, no rapid-fire scripted loops.
- **Scratchpad isolation:** parallel agents share one scratchpad directory. Every agent must keep its scripts and temp files in a module/role subfolder (`<scratchpad>/m05/`, `<scratchpad>/m08-audit/`, …) and only ever run scripts from its own subfolder. Brief every agent with this.

## 7. Conventions

- Use one feature slug (e.g. `user-login`) across all `docs/*/<slug>.md` files, branches (`feature/<slug>`), and commits.
- Work on a feature branch; never commit directly to `main`. Commit only when the user asks.
- Docs are the source of truth between phases. If code must diverge from a doc, the owning role updates the doc too.
- **Responsive is mandatory:** every screen must work on mobile (≥320px), tablet, and desktop without horizontal page scroll. Design specs define each screen's behaviour at 375 / 768 / 1280px; E2E tests run at all three sizes; a screen that breaks at any of them fails G4/G5.
- Never claim a gate passed without real evidence (tool output, test results, QA table).

## 8. v2 direction (D28–D32)

The project is evolving into v2, a new system (see `docs/TRACKER.md` D28–D32). For v2 work the §6 rules ("replicate, don't redesign", D9, D10) apply **only to unchanged flows**. Changed flows (the two portals, question intake and display), the UI theme (Nuxt UI, own theme, light + dark) and the Portal Pentadbiran follow D28–D32 and the v2 docs (`docs/requirements/v2-*.md`, `docs/architecture/v2-*.md`). **prestasiplus.cloud is the primary reference**; prestasiplus.my is used only for things not in .cloud. Old systems are never modified.
