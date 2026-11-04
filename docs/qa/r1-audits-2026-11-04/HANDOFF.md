# R1 docs: handoff to the cloud session (2026-11-04)

Branch: `docs/r1-prd-devplan` (PR #406 into `feature/v3-bijak-r1`, not merged). The local session stopped here. This file says exactly what is done, what is half done, and what is left. **Read it fully before starting.**

## 0. Goal and the one rule

Goal: the R1 PRD + development plan must let any developer or cloud agent build V3 **without asking a single clarification or decision question**. The product owner's rule: *if an agent must ask, the docs failed.* V3 is **improved, never rebuilt** (FR-X1-5, plan §0B).

Done criteria for this whole handoff (all must be true, with command output as proof):
1. `node scripts/r1-trace-check.mjs` exits 0 (today it fails only because new DM/API IDs from 45/46/48 are not yet registered in 50/60).
2. `node scripts/r1-canonical-map.mjs --check` PASS; `node scripts/r1-scope-guard.mjs --self-test` 55/55; `node scripts/r1-canonical-map.mjs --self-test` 12/12; `node scripts/r1-lock.mjs --self-test` 31/31.
3. No open markers in `docs/prd/r1/*.md`, `docs/plan/*.md` (R1 files): `grep -riE "PROPOSED|\bTBD\b|to confirm|needs user|unresolved|UNDECIDED"` returns 0 (the words may appear only inside quoted history, e.g. "was [PROPOSED], now decided").
4. Every finding in the audit files below is either applied in the docs or explicitly closed with a reason.
5. A fresh cold-reader test (T10) ends with **0 BLOCKER and 0 MAJOR** questions.
6. Privacy scan clean: no real person names, e-mails (except placeholders such as `contoh@email.com`, `@demo.test`, `example.org/test`), IC/phone numbers (except the placeholder `0191234567`), passwords, server IPs. The repo is PUBLIC.

## 1. Decisions already made (do not reopen)

Product owner decisions: D100–D111 (docs/TRACKER.md). Delivery Lead decisions by principle (the product owner delegated detail decisions): **D112** (in TRACKER + 00-index) and **D113** (below; add a D113 row to TRACKER and 00-index if missing).

D112: (1) Bab required before Terbit when Subjek+Tingkatan has chapters; (2) in-house Tesseract OCR, no external AI in R1, mock OCR only in CI; (3) load DSKP for every SPM subject offered; until loaded, SP/TP/aras required only where DSKP nodes exist; Kontrak only for loaded subjects; (4) content by Admin users, first the 6 sample-paper subjects (BM, BI, Matematik, Matematik Tambahan, Fizik, Sejarah), Kertas 1 first; (5) Sunting Pantas = Fix; (6) no pupil Jana Kertas in R1 (tab hidden, 404), admin Jana Kertas stays; (7) Slice 0 (plan §5A).

D113 (all final):
- Single answer store `practice_answers` with `mode`; every activity writes it; every report reads it. Modes include `latih_tubi`, `chapter`, `question_set`, `kuiz`, `simulasi`, `tracking_a`, `subjektif`, `structured`, `battle`, `pksk`, `audio_kbat` and game modes.
- Stimulus group: 1..n questions, 1–3 stimuli, part-level stimulus allowed; published, served, edited (draft copy + atomic swap) and retired as ONE unit; legacy regroup = audited structural change; detection covers numbered and unnumbered references ("Rajah di atas", "Maklumat di bawah", "Sumber", "Teks", "Petikan"); publish gate blocks `stimulus_missing` and `figure_only`; a duplicated stem is shown once and NOT excluded.
- Question types: 11 (incl. `true_false`, `mcq_multi`, `drawing`, `table_fill`, `essay_choice` served); MCQ 2–8 options, default 4; bilingual `ms+en`; full scheme editor (K/N/P/B/M/F/C, "@" alternatives, Maks N, bands, BI C/CA/O/L criteria, word ranges, compulsory/choose-N).
- TP 1–6 and Kesukaran 1–5 are separate fields, Kesukaran default min(5,TP), typed by admin. Kertas 1–4. Status labels Draf / Menunggu Semakan / Diluluskan / Ditolak / Diarkibkan; review filter value `review`; no separate Penyemak role.
- Accuracy pooled, whole-number % everywhere (manual Headcount AR may show 1 decimal). Coin rate is an admin setting, default 1. Password minimum 8. Other pupils see first name only, no school.
- Games (48): real pupils first, then a labelled "Robot PrestasiPlus" after 30 s, never a real pupil identity; game coins admin setting default off with caps; Liga enrolled by Admin Pusat only (no Guru/AS menu); parent consent not built.
- Duplicates (47 / register): Set Builder is the only paper builder; Studio is the only question editor; `/leaderboard` + `GET /api/leaderboard` canonical; Bijak is the only exam engine (`/spm-mock` redirects); one reward catalogue (`rewards`/`reward_redemptions`); `src/shells/pentadbiran/menu.ts` is the only admin menu; `previewHubRoutes` deleted (S0-T05).
- Process (cold-reader fixes, T4 below): locks are the only claim system; board = GitHub issues + labels + milestones (no r1-board.md); naming `r1/<team>/<card>-<slug>`; AC proof = CI first, then UAT after the designated UAT developer deploys `feature/v3-bijak-r1` daily, results in `docs/plan/r1-ac-ledger.md`; UAT test accounts per role per team created by the designated UAT developer and shared privately; product owner `@aminfaudzi` merges.
- S1-T09 is P0/L, split into S1-T09a (scheme editor backend, `mode_config`, `options` key kind, MCQ min 2) and S1-T09b (bilingual `ms+en`, drawing/table_fill).
- Verified facts (code + UAT): diagram audit route is `/admin/soalan-gambar`; Studio shows "Diterbitkan" (must be "Diluluskan"); AC-ADM-QE3.2 says MCQ 3–8 (fix to 2–8); 375 px Bijak sitting has no "Hantar" and no "Mod Peperiksaan" label; Kertas Subjektif card missing from the pupil hub (real gap); pupil Jana Kertas tab visible on UAT; pupil Prestasi redirects to the school dashboard; T1–T3 Latih Tubi shows "akan datang" (`rules.ts:43-45`); Laporan Soalan Saya has 5 counters (not 6); self-mark API (`attempts.controller.ts:171`) and photo API exist (plan S3-T06 "no self-mark endpoint" is wrong); `POST /api/intake/batches/:id/paper` does not exist; Sunting Pantas fails at `http-admin.ts:1053`; Studio list has no Tingkatan/Bab/DSKP filter; DSKP nodes on UAT unknown (2,844 vs 0) → U-OP-01 stays.

## 2. Input files in this folder (moved at T11 from `docs/prd/r1/_handoff-inputs/` to `docs/qa/r1-audits-2026-11-04/`; the decisions live in docs/TRACKER.md rows D113 and D113-c and in docs/prd/r1/00-index.md)

| File | What it is |
|---|---|
| `10-murid-fields.md` | Murid field & behaviour register; §0.1 K1–K22 decided; marking B-100..111; dialogs B-050..059; OPT sets |
| `20-guru-as-fields.md` | Guru/AS register (ALREADY merged into 20; reference only) |
| `30-admin-fields.md` | Admin register; **Part 1A is authoritative**; ignore anything marked SUPERSEDED |
| `error-handling.md` | ERR-xx catalogue (102 rows) + global rules; "Merge guide" at top |
| `game-mechanics.md` | Game audit (ALREADY turned into doc 48; reference only) |
| `wizard-vs-v2.md` | 55 V2 functions; split paths B1–B3, M1–M8, m1–m8 with fixes |
| `wizard-vs-exam-format.md` | Real SPM paper structures; G-01..G-19 with fixes; verdict per subject |
| `V3-DUPLICATES-REGISTER.md` | 34 duplicates, all decided (D113); §7 = 31-row fix list for the docs |
| `COLD-READER-QUESTIONS.md` | 74 findings (6 blocker); §4 FAQ draft; §5 doc-fix list |
| `PR522-aliran.md` | Team B workflow doc as submitted in PR #522 (BM) |
| `PR522-aliran-VERIFIED.md`, `PR522-verification-log.md` | Verified/improved version (36 processes, 150 steps) + log |

The UI prototype work-in-progress is `docs/prototype/r1-prototype-WIP.html`.

V1/V2 live captures and the real exam PDFs are **not** in the repo (private/copyright). Do not try to open V1/V2. Everything needed from them is already in the audit files above.

## 3. Task list (status at handoff)

| # | Task | Status | Files it may edit |
|---|---|---|---|
| T1 | Merge Murid register + fixes into 10 | **Half done**: "Field & behaviour spec" added to ~2 modules only | `docs/prd/r1/10-murid.md` |
| T2 | Merge Admin register + wizard/exam-format fixes into 30 | **Half done**: ~2 screens; D112 edits done | `docs/prd/r1/30-admin-pusat.md` |
| T3 | 40 §X10 Error handling, §X11 Option sets, §X9 AC-CHAIN-10, glossary; create 47 | **Not started** | `40-cross-cutting.md`, new `47-v3-duplicates-register.md` |
| T4 | Process/onboarding fixes from the cold-reader | **Half done**: START-HERE, ORCHESTRATOR, plan §6, 00-index partly edited; `r1-ac-ledger.md` created; FAQ not created | see T4 |
| T5 | Register every new DM/API in 50/60; resolve ID collisions | Not started | `50-data-model-erd.md`, `60-api-contract.md`, citing docs |
| T6 | Plan: cards/owners for all new FR/AC; card fixes | Not started (after T1–T5) | `docs/plan/r1-development-plan.md`, `r1-traceability.md` (generated) |
| T7 | Team workflow doc: finalise and publish | Verified draft exists | `docs/plan/r1-aliran-kerja-bank-bijak.md` (new in this branch) |
| T8 | UI prototype | WIP html exists | `docs/prototype/r1-prototype.html` |
| T9 | Re-verify wizard vs V2 and vs SPM format | Not started | none (report) |
| T10 | Cold-reader rerun until 0 BLOCKER/MAJOR | Not started | fixes in the owning docs |
| T11 | Final checks, cleanup, commit, push, PR update | — | — |

### T1. 10-murid.md
Continue the merge (check which modules already have "Field & behaviour spec"; add it to every other R1-MUR module). Inputs: `10-murid-fields.md` (§0.1, §1, §2, §3), `error-handling.md` (ERR-IDs), register §7 rows targeting 10, `46-pupil-activity-flow.md` §9.5 (changes 10 must make), `48` (games), and the verified facts in §1 above. For activity modules (9, 12, 13, 16, 17, 21, 26, games) write "End-to-end flow: see 46 §x / 48 GAME-xx" and keep only module-specific fields. Apply K1–K22 and the D113 decisions (incl. drawing/table_fill/essay_choice served, autosave 800 ms debounce in FR-MUR-13-10, duplicated stem shown once, Kertas Subjektif card in the hub, 375 px Hantar). Add "§0A Shared rules", "§A1 Option sets used here" (40 §X11 is master), "§A2 Data/API additions required". Remove all open markers; values without a source are "(R1 decision D113)". Add testable FR/AC continuing the numbering; keep existing IDs; update counts.

### T2. 30-admin-pusat.md
Continue the merge the same way for every QE/Q/C/N/U/M/P2 screen. Inputs: `30-admin-fields.md` Part 1A (+ CSV 34-column set 1A.9), `wizard-vs-v2.md` (B1–B3, M1–M8, m1–m8), `wizard-vs-exam-format.md` (G-01..G-19), `error-handling.md`, register §7, `45-question-authoring-flow.md` §10.5 (changes 30 must make), 48 (section 4.H admin game screens: point to 48), verified facts §1. For §4.0/4.A/4.G screens: "End-to-end: see 45 §x" + screen-level field blocks consistent with 45. Fix: `?status=review`; Studio route `/sunting`; Semak Kertas = review over Set Builder data; Audit Rajah `/admin/soalan-gambar` in the Soalan menu group; Q-03 filters (Subjek, Tingkatan, Bab, Tajuk DSKP, Status, Jenis, Sumber, Kertas); gate blocks `stimulus_missing`/`figure_only`; AC-ADM-QE3.2 → 2–8; Bab message exactly "Sila pilih Bab."; update §8.1 and §4.V.4 counts. Add §0A / §A1 / §A2.

### T3. 40 + 47
40: new §X10 "Error handling" (full ERR catalogue table from `error-handling.md` §9 + global rules: 401 with return URL and draft keep, 403 vs 404, offline banner, timeouts 30 s / 125 s import-export, GET-only retries, idempotency, 409 STALE_VERSION, upload limits, job states, 404/403/500/maintenance/boot page texts, logging, form message patterns). Align the generic form messages with 20 (§A2 note: "Sila isi {medan}.", "{Medan} sudah digunakan.", "{Medan} mesti antara…"). New §X11 "Option sets": master list merged from the three registers (one ID per concept; decided values). §X9: add AC-CHAIN-10 (text in `46-pupil-activity-flow.md` §9.7), make AC-CHAIN-1(a) SP/TP/aras conditional (D112-3). §X8 glossary: D112/D113, ERR/OPT/GAME/FR-QA/FR-PA/FR-GM, and the six meanings of "duplicate" → 47. Create `47-v3-duplicates-register.md` from `V3-DUPLICATES-REGISTER.md` (repo-clean; keep D113 decisions; §7 becomes "Applied fixes"; link `docs/plan/r1-canonical-map.json` and the CI rules).

### T4. Process fixes (cold-reader F-01..F-37 + §5 doc-fix list)
Files: `README.md`, `AGENTS.md`, `docs/README.md`, `docs/plan/README.md` (R1 pointer at top), `CLAUDE.md` (one pointer line under the title only), `docs/plan/R1-START-HERE.md` (keep the "No duplicates (enforced by CI)" section), `docs/plan/R1-ORCHESTRATOR-PROMPT.md`, plan §0A/§0B/§5/§5A/§6/§7/§8 + App. A/B/C, `00-index.md` (codes table), `.github/ISSUE_TEMPLATE/r1-card.yml`, `.github/pull_request_template.md` (remove old BE-card items; add scope-guard/canonical-map lines), `.github/CODEOWNERS` (owner `@aminfaudzi`, header: sector ownership is by locks), `scripts/r1-lock.mjs` (`--help`), `scripts/r1-create-issues.mjs` (`--update-bodies`, then run it with `--apply` to rewrite the "How to claim" part of the 113 issue bodies; also create labels `needs:S1..S10`), new `docs/plan/R1-FAQ.md` (from cold-reader §4, rewritten to the D113 process decisions), `docs/plan/r1-ac-ledger.md` (exists; check). Apply the D113 process decisions in §1. Fix F-09 (sprint/dependency conflicts; S5-T10 into a sprint), F-22 (Verify cards needing code → Fix/Complete: S7-T01, S10-T07, S5-T10), F-26 (duplicated stem rule everywhere), F-08 (cross-sector small PR rule: card ID + `Cross-sector: S<n>` line + label; the lock-holding team reviews within 1 working day).

### T5. 50 + 60 (after T1–T3 have produced their §A2 lists)
Register every new ID cited anywhere, then make `r1-trace-check.mjs` pass. **ID collisions to resolve:** 45 uses DM-50..DM-59 and API-Q-30..API-Q-39 (keep these); 48 also used DM-50..DM-55 → renumber 48's to the next free (DM-60..DM-65) and update 48; 46 uses working names DM-PA-01..08 / API-PA-01..09 → give real next-free IDs (DM / API-PRAC-xx etc.) and update 46. Add the §A2 additions from 10, 20 (ADD-01..ADD-22), 30, register (e.g. `practice_answers.mode`, `game_rooms.session_id`, `difficulty_level`, `rejection_reason`, Kertas 1–4, `permainan` servability, `combo`, multi-class `question_set_classrooms`, scheme tables, bilingual fields). Apply 50/60 fixes: Kesukaran typed with default (not "derived, never typed", 50 §4.2.1 and API-Q-03), API-Q-05 message "Sila pilih Bab.", API 4.1 Kertas 1–4, OQ-API-19 stale, API-BIJAK-03 pupil use removed, answer-mode registry (50 §4.7a) complete, DM-44 unique index includes `user_id`. Each new DM/API gets exactly one owning card.

### T6. Plan
Add owning cards for every new FR/AC (FR-QA-*, FR-PA-*, FR-GM-*, new FR in 10/20/30, AC-CHAIN-10 → S9-T06). Split S1-T09 (S1-T09a/S1-T09b, P0/L). Fix S3-T06 (self-mark endpoint exists → UI wiring). Add the Kertas Subjektif hub card work (S3-T07 or S5 card). Keep Slice 0 consistent. Recompute totals/sprints. Then run `node scripts/r1-trace-check.mjs` until exit 0, `node scripts/r1-canonical-map.mjs --check`, and regenerate issues for new cards: `node scripts/r1-create-issues.mjs --apply` (idempotent: only new cards).

### T7. Team workflow doc (BM)
Take `PR522-aliran-VERIFIED.md`; refresh its "PRD/kad" column against the FINAL 45 (Appendix A) and 46 (Appendix A); add at the top "Dokumen ini ialah gambaran aliran kerja (BM). Spesifikasi terperinci: 45 (admin) dan 46 (murid)."; remove any "perlu pengesahan" wording (replace with the D112/D113 decision); save as `docs/plan/r1-aliran-kerja-bank-bijak.md` in this branch. Then comment on PR #522 (repo amin-kerja-orang/prestasiplus): the verified version is in `docs/r1-prd-devplan` with 36 processes / 150 steps, list the top corrections, and suggest closing #522 as superseded.

### T8. Prototype
Finish `docs/prototype/r1-prototype-WIP.html` → `docs/prototype/r1-prototype.html` (delete the WIP file). Screens: `#admin-bank`, `#admin-cipta`, `#admin-wizard` (DSKP-order tag step with dependent selects; stimuli 1–3; group members 1..n with reorder; per-part mode, marks, key, part-level stimulus, BM/EN; scheme editor; Kertas/Bahagian; live gate panel naming missing fields), `#admin-import` (linked groups incl. "Rajah di atas"), `#admin-terbit` (group publish as one unit), `#murid-hub`, `#murid-kertas`, `#murid-jawab` (timer, map, stimulus once / "Lihat Rajah" on phone, BM/EN, MCQ/short/numeric/essay word count/table_fill/drawing, choose-N, autosave, offline demo, Hantar dialog), `#murid-keputusan` (score, skema reveal, self-mark ticks with Maks N/"@", essay band). Mock data invented (no real names, no real exam text). Self-contained HTML (inline CSS/JS, inline SVG; only Google Fonts allowed), token colors with light/dark, works at 375/768/1280 without horizontal scroll. If the session can publish a claude.ai Artifact, publish it and put the link in the PR description; otherwise keep the file in the repo.

### T9. Re-verify the question entry wizard
Using `wizard-vs-v2.md` and `wizard-vs-exam-format.md` as checklists: for every B/M/m and G item, confirm the fix is now specified in 30/45/50/60 (cite IDs). Write the result into `docs/qa/r1-dev-readiness-audit.md` as "Wizard re-verification 2026-11-0x" with a verdict YES/NO for V2 parity and YES/NO per subject (BM, BI, Fizik, Matematik, Matematik Tambahan, Sejarah). Anything NO → fix the docs, re-check.

### T10. Cold-reader rerun
A FRESH agent (no context) does the same test as `COLD-READER-QUESTIONS.md`: read START-HERE + 00-index first, then plan 33 cards across S0–S10 (include S1-T01, entry/import cards, S3 sitting/self-mark, S5 Latih Tubi, S6 teacher, S7 game, S8 rendering, S10 reports) using only the docs, and list every question/guess/contradiction. Fix every BLOCKER/MAJOR in the owning doc, rerun until 0 BLOCKER and 0 MAJOR. Put the final FAQ answers into `docs/plan/R1-FAQ.md`.

### T11. Finish
- Move `docs/prd/r1/_handoff-inputs/*` to `docs/qa/r1-audits-2026-11-04/` (audit record) and delete `_handoff-inputs/` (incl. this file, after copying its decisions into TRACKER/00-index).
- Run all checks in §0; privacy scan; commit with Co-Authored-By trailer; push `docs/r1-prd-devplan`.
- Update PR #406 description (what changed, checks output). Do NOT merge #406 (the product owner merges).
- Report to the product owner in Bahasa Melayu: what was finished, check results, anything that could not be done.

## 4. How to run it (parallel waves; never two agents on the same file)
- Wave 1 (parallel): T1, T2, T3, T4, T7, T8.
- Wave 2: T5 (needs the §A2 lists from T1–T3), then T6.
- Wave 3: T9 and T10, then fixes, then T11.

## 5. Hard rules
- Docs in English; UI copy exact Bahasa Melayu. Keep all existing IDs stable; new IDs continue the numbering.
- Never open V1/V2 or any server; never change product code in this branch (docs, scripts, templates and the prototype only).
- No real names, e-mails, credentials, IPs, school names tied to pupil data. Public repo.
- Commit only to `docs/r1-prd-devplan`; push; do not merge PR #406.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
