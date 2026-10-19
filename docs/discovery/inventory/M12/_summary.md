# M12 — Element inventory & link crawl: summary

- **Captured:** 2026-09-25 from live https://prestasiplus.my. The capture was read-only, used an admin session on browser lane 3 (`playwright3`), and stored no credentials.
- **Method:** the same pipeline as M01–M11: `tools/inventory.js` → `tools/run-state.js` → `tools/split-batch.js` → `tools/merge-inventory.js` → `tools/diff-narrative.js`.
  - Capture plan: `tools/jobs/M12.js`, 48 UI states over 10 screens in groups A–F.
  - Screen map: `tools/jobs/M12.screens.json`, with `extraModuleRules` for the Kirkpatrick tree, `/kirkpatrick`, `/maklum-balas`, `/admin/laporan` → M17 and `/admin/monitoring*` → M17.
  - Masked screenshots: `tools/jobs/M12.shots.js` + `tools/shoot.js`, 29 PNGs in `docs/discovery/img/M12/`.
  - Appendix B of the narrative was generated from the merged inventory by a scratch script. That script is kept in the session scratchpad and not in the repo.
  - **No shared tool was modified.**
- **Privacy (students are minors):**
  - Each job runs in this order: its client-side actions, then `M12MASK` (in `tools/jobs/M12.js`), then `tools/sanitize.js {selectors:['.m12n'], titleName:false}`.
  - `M12MASK` masks the following:
    - student links in the T4 prediction table;
    - the ALESA "Pelajar" cell;
    - the student name on `/kirkpatrick/pelajar/{id}` (h1, `<title>`, the generated ALESA paragraph);
    - school names (`<school>`) and school codes (`<kod>`) in text, `<option>` labels and attributes;
    - avatars;
    - person-record ids in links and in the location (`/pelajar/{id}`).
  - `meta.piiLeakCheck`: 0 leaks in all 48 states. On S5, 938 strings were checked.
  - A grep of all raw and merged M12 files and of the narrative found none of these: `bin`/`binti`/`A/P`/`A/L`, school-name prefixes (SEKOLAH, KOLEJ, SAM, SMT) or school-code patterns. The only hits are the mask regex source inside `meta.actions`.
  - The screenshots were checked visually: `results-alesa.png` shows `<person>` and `<school>` in every row.
  - No unmasked dump was written to disk. The structure studies ran in-page and were returned only to the agent.
- **Files:**
  - Screen inventories: `S1-overview.json` … `S10-maklum-balas.json`.
  - Layout chrome: `SHA-admin-shell.json` (S1–S8) and `SHU-user-shell.json` (S9, S10). These are owned by the global doc.
  - `_crawl.json`.
  - Raw captures: `../_raw/M12/*.json` (48 files).
- **Status legend:** the same as M01–M11, with `normalizeIds` on.
- **Long lists** are sampled with variant-partitioned `opts.repeat` selectors, and totals are kept in each state's `meta.repeats`. The samples are:
  - S3: subject rows 2 Mastered + 2 Developing (+ Beginning in the school state), from 26 rows. School rows: 2 per accuracy colour, from 33.
  - S4: school rows 1 per tahap colour + 1 zero-activity row, from 33. All 36 alerts and all 7 × 18 heat cells are kept.
  - S5: school rows 1 per tahap + 1 inactive, from 33. Prediction rows 1 per grade colour, from 946. ALESA rows 1 per grade colour, from 50.

## 1. Per-screen counts

M12 content totals **755 elements** over 10 screens and **48** captured states (1280 / 768 / 375). The shells add 219 (SHA) and 372 (SHU) chrome elements, which are not M12 content.

| Screen (route) | Total | Visible default | Conditional | Hidden only | Mobile only | Desktop only | States | States captured |
|---|---|---|---|---|---|---|---|---|
| S1-overview `/admin/kirkpatrick` | 125 | 67 | 53 | 5 | 4 | 8 | 6 | default, school (8080), state-empty (Kelantan), guru twin (@1280); default @375/@768 |
| S2-reaction `/admin/kirkpatrick/reaction` | 18 | 18 | 0 | 0 | 0 | 0 | 4 | default, guru (@1280); default @375/@768 |
| S3-learning `/admin/kirkpatrick/learning` | 87 | 60 | 27 | 0 | 0 | 0 | 5 | default, school (URL-only filter), guru (@1280); default @375/@768 |
| S4-behavior `/admin/kirkpatrick/behavior` | 93 | 80 | 13 | 0 | 0 | 0 | 5 | default, school, guru (@1280); default @375/@768 |
| S5-results `/admin/kirkpatrick/results` | 184 | 146 | 38 | 0 | 0 | 0 | 5 | default, school (URL-only), guru (@1280); default @375/@768 |
| S6-chain `/admin/kirkpatrick/chain` | 67 | 67 | 0 | 0 | 0 | 3 | 4 | default, guru (@1280); default @375/@768 |
| S7-interventions `/admin/kirkpatrick/interventions` | 49 | 25 | 23 | 1 | 0 | 0 | 8 | default, toggle (stays closed), forced-open (DOM only), guru, method-405 (@1280); default, forced-open @375; default @768 |
| S8-pelajar `/admin/kirkpatrick/pelajar/{id}` | 80 | 52 | 28 | 0 | 0 | 0 | 6 | default (4664), low (4644), guru twin, unknown-403 (@1280); default @375/@768 |
| S9-prestasi-saya `/kirkpatrick` | 45 | 42 | 0 | 3 | 0 | 0 | 3 | default @1280/@375/@768 |
| S10-maklum-balas `/maklum-balas` | 7 | 4 | 0 | 3 | 0 | 0 | 2 | submitted (thank-you) @1280/@375 |
| SHA-admin-shell (chrome of S1–S8) | 219 | 75 | 27 | 117 | 7 | 70 | 41 | all SHA states |
| SHU-user-shell (chrome of S9, S10) | 372 | 152 | 15 | 205 | 15 | 148 | 5 | all SHU states |

Notes on the counts:
- **S7:** the 23 "conditional" elements are the intervention form fields. They are visible only in the forced-open states and are never reachable on live (narrative D-M12-1).
- **S9/S10:** the hidden-only elements are the SHU `tournamentBanner()` template inside `<main>` (an M16 component).

**Admin vs guru twins:**
- For every view, the `/guru` state has the same element keys and total as the `/admin` default. The `<main>` HTML is byte-identical (narrative §1.2).

**Horizontal page overflow:**
- The inventory flagged it on S1 @375 and S4 @375.
- A direct measurement on the unmasked pages gives `scrollWidth` 487 at a 375 viewport. The cause is the `school_id` select, which is 466 px wide (narrative D-M12-7).
- All other screens were within the viewport at 375 and 768.

**Empty and error states captured:**
- S1: "Tiada Data vs Tiada Data" / "Data tidak mencukupi untuk perbandingan.".
- S3: "Pre-Test / Post-Test belum dimulakan".
- S4: "Data Mood Belum Mencukupi".
- S7: "Tiada intervensi direkodkan lagi.". Also the 405 framework page.
- S8: 403 "Akses Ditolak".
- S9: "Tiada data Head Count. Guru perlu muat naik keputusan peperiksaan.".
- S10: the "Terima Kasih!" already-answered state.

## 2. Link crawl (`_crawl.json`)

- There are 223 internal URLs. By module: M12 25, M17 23, M10 17, M14 15, M18 12, M09 11, other modules ≤ 9.
- There are 6 `unknown` URLs: `/`, `/api/tournament/active`, `/chatbot/history?session_id=${this.sessionId}`, `/chatbot/rate`, `/chatbot/send`, `/fcm/token`. All are from the user-shell scripts on S9/S10 and are documented in 00-global-ui.
- New M12 routes, not in the TRACKER checklist:
  - `/admin/kirkpatrick/pelajar/{id}` and `/guru/kirkpatrick/pelajar/{id}` (S8);
  - `/kirkpatrick` (S9);
  - `/maklum-balas` (S10);
  - `/admin/kirkpatrick/export-pdf` (link only, never opened);
  - POST `/admin/kirkpatrick/interventions`;
  - `/admin/kirkpatrick/interventions/{id}` (405 on GET).
- Query variants visited:
  - `?school_id=` on overview, learning, behavior and results;
  - `?state=` on overview.
- `/admin/laporan` is classified **M17** (recommended owner; narrative §1.3).
- Probed and returned 404 (narrative §1):
  - `/admin/kirkpatrick/pelajar`, `/admin/kirkpatrick/interventions/1/edit`;
  - `/admin/kirkpatrick/survey`, `/admin/kirkpatrick/reaction/survey`, `/admin/kirkpatrick/api`, `/admin/kirkpatrick/data`, `/admin/kirkpatrick/export`, `/admin/kirkpatrick/nps`, `/admin/kirkpatrick/sekolah/{id}`;
  - `/survey`, `/tinjauan`, `/nps`, `/admin/nps`, `/admin/survey`, `/admin/surveys`, `/feedback`.

## 3. Reconciliation with the narrative

- `node tools/diff-narrative.js inventory/M12 M12-kirkpatrick.md` returns **0 candidates on every screen** (S1–S10).
- **Not in narrative:** *(empty)*.
- Every inventoried string, label, placeholder, field name, icon, option and script string appears in `docs/discovery/M12-kirkpatrick.md`, either in the §2 screen descriptions or in Appendix B.

## 4. Read-only limits (details in narrative §10)

These items were not observed, because each would need a write, an export or another role:
- the intervention list and its statuses, create success/errors and update;
- the `/maklum-balas` form and its submit;
- the populated mood analysis;
- the Learning Gain values;
- the export PDF;
- the teacher-scoped and student-scoped data views.
