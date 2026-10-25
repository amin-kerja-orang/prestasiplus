# UAT triage — 2026-10-24

Source: external UAT triage page (claude.ai artifact `56xeky5FjZEtnfzxvZZXMg`), run on the demo build `prestasiplus-demo.pages.dev`. Tester and client names are replaced by roles (privacy rule, CLAUDE.md §6). The original UAT script and screenshots are **not** in the repo.

Code baseline the triage reviewed: `feature/student-prototype` @ `3e192a7` (2026-10-21).

Totals reported: 124 cases, 73 Pass, 12 Fail, 30 Partial (sums to 115 — 9 cases unaccounted for; ask the tester). 42 not-passed cases grouped into 15 tasks.

## Work split (3 sessions)

| Lane | Tasks | Owns (may edit) | Must not edit |
|---|---|---|---|
| A — data & core flows | T0, T1, T2, T3 | seeds/datasets of M03/M04/M05/M10 and M01/M02 demo accounts, `src/mock/**` core, M05 `/practice/chapter`, M10 `/guru/kelas` `/guru/pelajar`, build/login SHA | — |
| B — question intake chain | T6, T11 | M04 + M28 intake/review code, screenshot uploader (UAT-A-SY05), game resume (UAT-M-26) | any `datasets/`, `seeds/`, `spec` file (ask lane A) |
| C — role scope & admin screens | T4, T5, T7, T8, T9, T10 | M08 `/prestasi*` routing, M11 monitoring filter, M27 DSKP heatmap display, M10/M11/M17 command center, M12 Kirkpatrick/Intervensi, M11/M27 export & print | any `datasets/`, `seeds/`, `spec` file (ask lane A) |
| User / tester | T12, T13, T14 | decisions and missing info | — |

Merge order: lane A first (seed changes affect re-tests of B and C), then B and C.

## Tasks

| ID | Pri | Task | Module | UAT rows | Triage cause / action |
|---|---|---|---|---|---|
| T0 | P0 | Confirm which build was tested | DevOps | all | No record of which commit is on pages.dev. Compare with `3e192a7`; if older, rebuild and re-test P0 rows. Show the commit SHA on the demo login screen from now on. |
| T1 | P0 | Demo seed data does not match SPM Form 4–5 scope | M03/M04/M05 seeds | M-19 (Critical), M-17, M-31, M-32, G-10, S-08, S-10, S-50, A-BS04, A-BS05, A-BS07, A-PS06, A-KK07, M-08 | Heatmap shows one topic only, "Nombor Bulat hingga 100" (primary), for a Form 4 account; notes "only up to Year 6". Seed a T4–T5 set (DSKP topics, questions, practice sessions, headcount, review rows, notes). D45: small PoC profile (~20 students, a few papers) is fine as long as the level is right. Re-test the 14 rows. |
| T2 | P0 | Murid and Guru cannot open Soalan by Chapter | M05 `/practice/chapter` | M-14 (Critical), G-14 (Critical) | Route exists with `access: auth`, no role limit. Likely a runtime error, empty mock chapter list, or old demo build (T0). |
| T3 | P0 | Guru cannot open students | M10 `/guru/kelas`, `/guru/pelajar` | G-13 (Critical), G-46 (Critical) | Class list shows no students; student profile won't open. Likely teacher-side student data (overlaps T1). |
| T4 | P1 | Role scope leak — murid sees school board | M08 `/prestasi` | M-09 (High) | `/prestasi` redirects to `/prestasi/sekolah` ("Dashboard Sekolah"), open to any logged-in role. Send murid to own performance view; review every M08 route with `access: auth` and no role limit. |
| T5 | P1 | Admin Sekolah can pick a state in the filter | M11 `/admin-sekolah/monitoring` | S-15 (Medium) | D30: Admin Sekolah = own school only. If other schools' data returns → P0 and re-check scope on every Admin Sekolah screen; else remove the state option for that role. |
| T6 | P1 | SPM question intake blocked in four places | M04/M28 | G-49 (High), A-KS16 (Fail), A-BS06 (High), A-BS02 (Medium) | Guru cannot save DSKP mapping; manual question jumps to extract screen on save; PKSK question fails after domain chosen; review queue has no approve/reject. Run the full chain teacher submit → review → approve → publish → murid sees; fix in flow order. BS02 may be data (T1). |
| T7 | P1 | DSKP Heatmap not displayed clearly | M27 `/admin-sekolah/dskp-heatmap` | S-52 (High) | Display (cell size, contrast, legend) or empty data (T1). Test at 375 and 1280px. |
| T8 | P2 | Command Center opens a new tab unasked | M11/M17 command center | G-06, S-06 (Medium) | Find the new-tab trigger (fullscreen/preview). If intended, make it clear before the click. |
| T9 | P2 | Duplicate buttons on two screens | M12 Kirkpatrick, Intervensi | G-16 (High), A-PM11 (Low) | Likely one shared component. |
| T10 | P2 | Export and print don't work | M11/M27 reports | G-47 (Medium), S-55 (Fail), S-56 (not tested) | Guru CSV export fails; Laporan Bulanan has no print view; Senarai Pelajar export untested. |
| T11 | P2 | Small broken filters/views | various | A-KS15 (Fail), A-SY05 (Low), M-26 (Medium) | Review-queue filter broken; screenshot uploader shows no image; game cannot continue (needs repro steps from tester). |
| T12 | P1 | Spec conflict — Analisa Item for Murid | M08 — decision | M-11 (Critical) | Code sends murid to `/dashboard` (`analisaItemTarget()`, marked INFERRED); roles matrix lists L11 Analisa Item as a Murid R1.0 line. **User decision**: build the screen (new scope) or fix the matrix and remove the menu item. |
| T13 | P3 | Three cases need tester info | tester | S-04, M-42, M-43, M-08 | Partial with no notes; M-08 Headcount marked N/A though R1.0. |
| T14 | P3 | Two scope questions for the client | client | S-53, A-KK07 | S-53 "generate only, or print too?"; KK07 primary-school notes in an SPM product (same root as T1?). |

UAT row prefixes: M = Murid, G = Guru, S = Admin Sekolah, A = Admin (Portal Pentadbiran).

## Phase 2 split (2026-10-25)

Phase 1 lanes B (T6, T11) and C (T4, T5, T7–T10) are merged into `claude/wizardly-euler-glqplr` (merge commits `dd67a6b`, `e9e567c`). T8 was reverted by user decision D56 (Command Center keeps opening in a new tab).

| Session | Scope | Owns | Must not edit |
|---|---|---|---|
| 1 — Lead (this branch) | Merge, G4/G5 for T0–T3, re-test all P0 rows, user decisions K1–K5/T12, deploy (after user confirmation), merge sessions 2 and 3 | integration; **stale Darjah e2e specs of M03, M05, M25** (fixed by the Lead as part of T1/T2 G4) | — |
| 2 — Mod Pelajar | `guru-mod-pelajar` G2 → G5 (docs: requirements/design/architecture `v2-guru-mod-pelajar.md`, ADR-0020) | shells, session store, mod-pelajar, M05 `ChapterIndexPage.vue`, `is_test` stamping on repository write paths | any `datasets/`, `seeds/`, spec data |
| 3 — Cleanup | D54 Darjah sweep (not PKSK), demo data gaps for review queues / m28, stale e2e of **other** modules (m02, m04, m06, m07, m14, m16 and spec-id drift), lint/DS debt, BUG-C2 | `datasets/`, `seeds/`, spec data | `src/shells/**`, `src/stores/session*`, mod-pelajar files, M05 `ChapterIndexPage.vue`, M05/M14 repository write paths; e2e of M03/M05/M25 |

Open user decisions: T12, K1 (guru sees other schools' students in M11/M12), K2 (parent/sponsor on M08 school screens), K3 (BS-02 label), K4 (separate "Terbit" step in M04), K5 ("Sambung Kata" card), T13, T14.
