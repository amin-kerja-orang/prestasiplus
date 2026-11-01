# Team B handover — for the incoming team B lead

Written by: team C lead (covered team B since 2026-11-01 12:57). Date: 2026-11-01 21:48 MYT. Account codes only (privacy rule).
Read this file top to bottom, then `README.md` and `requests/README.md` in this folder. You can continue from here without a verbal handover.

## 1. Your role (team B = integrator, review, QA, release)
- **Only team B merges into `feature/v3-bijak-r1`.** Every merge = one BASE-n row in `MERGE-LOG.md` (you are its only writer).
- Lanes (run as one lead session + subagents, or separate sessions):
  - **B1 Integrator** — merge queue, gate, BASE-n, `MERGE-LOG.md`, TRACKER change log, release runbook (T24 done; T37/H-A25 runbook in base).
  - **B2 Code review** — G4 verdict on the exact posted head (Approve / Approve w/ Minors / Changes requested).
  - **B3 Security** — units touching auth, files/uploads, new external input, admin overrides.
  - **B4 E2E QA** — Playwright R1 flow on the HTTP stack at 375 / 768 / 1280.
- **No AI session ever deploys, migrates or seeds a server.** The human owner of team B deploys.
- Files you write: `MERGE-LOG.md`, `status/B1.md`–`B4.md`, `requests/from-B.md`, `requests/answers-B.md`. Do not edit other teams' files.

## 2. Rules that do not change
- Merge by the **exact reviewed SHA** (the posted head = branch tip, no commits after). A head that moved needs a delta review (`git diff <reviewed> <new-tip>`; base-only changes = re-check only).
- Lanes merge the latest BASE before posting READY-FOR-REVIEW. After B2 Approve, the lane writes "B2 verdict: Approve @ <head> — ready for B1 merge".
- B1 gate on the merge result (real output, never assumed): api `tsc --noEmit`; `vue-tsc -p tsconfig.app.json`; `tsc -p tsconfig.node.json`; `packages/contract` tsc + `npx jiti scripts/emit-openapi.ts --check`; eslint on changed files; unit tests of touched modules; API DB specs of touched areas (+ `test/bijak-attempts` when `src/modules/m28-bijak-spm/data` or `packages/exam-core` change). Bisect any red against the previous BASE before blaming the unit.
- Cross-team asks go through `requests/` only. Product questions to the user go via the team A lead (`QUESTIONS.md`).
- Commit/merge messages in English; no personal names anywhere in git; secrets never in git.

## 3. State right now
- **Base:** `feature/v3-bijak-r1` @ **BASE-101 `b24d89170`** (T34). Lanes should merge BASE-101.
- Merged by team C while covering B (each: independent reviewer standing in for B2 + B1 gate; see MERGE-LOG rows):
  - BASE-94 H-C8 kuiz stimuli · BASE-95 REQ-B-042 Pembina picker pool · BASE-96 REQ-B-045 · BASE-97 R1E2E-C1/C2 · BASE-98 REQ-B-040 · BASE-99 **T36** (PoC flag no-op; fixed by team C) · BASE-100 team C follow-ups · BASE-101 **T34** (fixed by team C; Disahkan Terbit gate kept).
  - T34 and T36 were team A units fixed by team C on owner decision (team A agreed). Branches `r1/t34-builder-review-c`, `r1/t36-remove-poc-c`; team A's original branches untouched.
- Full log of what team C did for B: `status/C-covers-B.md` (incl. every verdict and gate number).

## 4. Your queue (in order)
1. **Confirm takeover**: add one line to `status/B1.md` ("B1 resumes merging from BASE-101"). Team C stops merging from that moment.
2. **T10 Set Builder** `r1/f08-builder-ui` (team C C1 restacking on BASE-101 now; head will be posted in `status/C1.md`) → **hc-builder-parity** after it. T10 fixes E2E S3a (`/admin/studio/sets` 404).
3. **E2E spec** `r1/t23-e2e-c` (from `r1/t23-e2e` d61f98bd5): picker "Muat lagi" loop + T34 audited-override path for 1449/1 (S3c, `admin-publish-http`). Team C QA is running it on BASE-101; results go to `docs/qa/` on `r1/c-qa-base98`. Take it over as B4's spec.
4. Then (team A units; need B2 verdicts): **T31** → REQ-A-008 (C); **T52** (eslint blocker) → REQ-A-012 (C); **REQ-B-031** report guard → **Lapor** `25e6739d` (C, B3 re-check); **T38** (Major T38-L1 best-N overpay) → **T40**; **T50** (changes requested); **T45** (vue-tsc TS2741 → REQ-B-041) → H-A21; **H-A18** (needs user answer Q10) → REQ-C-012; **REQ-B-044** (T04-minors chapter-practice red).
5. **Post-merge B2 re-check** of what team C merged, especially BASE-99 T36 and BASE-101 T34 (C-for-B2 verdicts are recorded, but B2 should confirm).
6. **B3 delta** on T34 (B3 Pass was on 5bb590d0; new: placements, groups/:groupId, section-pools routes, audited override) and open items: T38-L1, REQ-B-032 (NEW-1), T34-L1 residual, REP-L1/L2, T13-L3, T45-L1, SEC-C012-1.

## 5. Open review Minors (non-blocking; route to owners)
- T34: dead `overrideNotAllowed` message; `existingImages` regex rejects legacy decimal file ids (<8 chars); section-pool `q` search cost per keystroke; `setGroupLabel` changes the shared group title on published papers (confirm stimulus audit row); stale comment `apps/api/test/bijak-papers/helpers.ts:74`.
- T36: no explicit guard for reserved PoC ids (≥ `POC_QUESTION_ID_BASE`) in be09-question-source — 403 by absence only; stale PoC comments in `.github/workflows/e2e-http.yml:90`, `frontend.yml:173`, `prisma/seed/poc/export/attempt-source.ts:8`; verify performance / school-admin reports don't filter on paper status after `exam-retire-poc`; `deploy/vps/deploy.sh:115-120,275` still forces the flag false (harmless).
- H-C8: stimulus share count ignores group membership (pre-existing D90 edge).
- R1E2E-C1: intake list shows the wire label ("Sedia untuk semakan") after reload while the review page says "Semakan" after submit.

## 6. E2E status (B4)
- BASE-98: 33 pass / 3 fail / 7 skip at 1280 (375/768: +1 load flake each: S5e, B-04 — rerun on an idle machine; log R1E2E-C3/C4 only if they recur).
- Real fails: **S1h R1E2E-17** (unknown SP "1.1" accepted — team A), **S2e R1E2E-10** (team A), **S3a** (T10).
- Open, not asserted by the spec: R1E2E-16 (overview attention 25, lanes 0), R1E2E-09 (Bab tile 63 vs chapter total 15).
- Harness notes: API needs `JOBS_WORKER_ENABLED=true` (PDF intake); run a Vite build before `vue-tsc` on a clean tree (auto-imports); `vite preview` needs `VITE_API_PROXY_TARGET`; `apps/api` `npm run build` fails offline at `db:generate` → `npx vite build --config vite.build.config.ts`; rapid kuiz session POSTs hit 429.
- Pre-existing reds (not from new units): attempts.spec 5c; draw-bounded.spec ×3; challenges 5 / flow 2 (timezone: PG in +08 vs UTC); security/audit-coverage ×2; m10-teacher-class mock ×7; m04 questions-store.perf under load.

## 7. Release / live (owner's decision; human deploys)
- Demo DB must have **≥ 1 published bank paper** (or the e2e seed) before redeploy, else `scripts/demo-smoke.sh` fails (T36).
- After T34, a paper's Terbit needs its blueprint **Disahkan** (admin Sahkan in the UI with evidence) or the **audited override** with a reason. Do not seed Disahkan without evidence; do not add an is_test exemption.
- REQ-A-009 delivered via T36 (render.yaml key removed; redeploy script no longer requires the flag).

## 8. Requests addressed to team B
- `requests/from-A.md`: REQ-A-001 (DELIVERED), REQ-A-007 / REQ-A-011 (merge order; IN-PROGRESS — see answers-B), REQ-A-009 (DELIVERED, BASE-99).
- Your own open rows in `requests/from-B.md` (REQ-B-003…045): update status when the answering team delivers.
