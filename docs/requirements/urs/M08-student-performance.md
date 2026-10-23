# M08 — Student Performance & Analytics — User Requirements Specification

## 0. Document control

| Field | Value |
|---|---|
| Document | URS — M08 Student Performance & Analytics |
| Version | 1.12 |
| Date | 2026-10-02 |
| Status | Approved (G1) — v1.12 adds DV-M08-37 (S18 avatar); v1.11 marks the class-228 attention split 11 + 46 as INFERRED (total 57 and first three rows OBSERVED; DV-M08-36); v1.10 defines the Murid Terbaik accuracy as the mean session accuracy (R4-01); v1.9 applied the XL batch 3 round 3 Minors (R3-02 account 4 at 900004, R3-04 `pksk`); v1.8 applied the XL batch 3 decisions (XL3-02 session-mean accuracy, XL3-06 M14 wallet and streak, XL3-07 seeds, XR-M18-09 S9 template); v1.7 applied the XL round 2 follow-ups (XL2-35 re-check, XL2-47 references); v1.6 adopted the M05 v1.6 answer-log queries; v1.5 applied the cross-module review XL batch 2 (M08 parts of XL2-01, XL2-02, XL2-20 and the Minors XL2-23, 25, 31); no approved live behaviour changes. `/laporan-mingguan` for non-admin roles stays blocked pending a student/teacher test account (OQ-M08-01). |
| Author | product-analyst (agent); data/interface parts of the companion SRS by solution-architect (agent) |
| Source discovery | [M08-student-performance.md](../../discovery/M08-student-performance.md) (§2.22 audit top-up, §5 formulas, §6 chart configs, §8.2 defects D-1…D-29 with D-24 withdrawn and D-17 revised, §9 L-1…L-12, Q1–Q4, Appendices A–B), inventory [`inventory/M08/`](../../discovery/inventory/M08/) (`S1…S23-*.json`, `SHU-user-shell.json`, `_crawl.json`, `_summary.md`, raw states `inventory/_raw/M08/`), screenshots `docs/discovery/img/M08/` (masked), global shell [00-global-ui.md](../../discovery/00-global-ui.md), audit [M08-audit.md](../../qa/audit/M08-audit.md) |
| Companion SRS | [srs/M08-student-performance.md](../srs/M08-student-performance.md) |
| Related | M01 (404/403 pages, canonical seed accounts 1–11, `/login`), M02 v1.16 (users dataset with the M08 anchors and the role counts used on S1, schools 900001/900002, ClassroomRef), M03 (subjects 1–31, levels 1–11), M04 v1.10 (question store D11 dataset, §4.1 named queries, `dskpSpId`; M08 contributed anchors §6.13.2), M05 v1.12 (session store, the answer-log D11 dataset §6.14 and its named queries §6.14.2 DATA-M05-01, answer log DATA-M05-02, BR-31 completion contract, sessions A2–A5, P1–P4, M1–M4, dashboard quick action "🏅 Papan Pendahulu"), M06 (SPM session modes), M10 v1.11 (classrooms, enrolment, DSKP data set incl. the SPs M08 reads, `/guru/kelas/cipta`), M11 (references M08 for `/prestasi/kelas*` and `/analitik/kelas`), M14 (coins, syiling, tiers, streak, badges — not yet written), M16 (tournament banner), M21 (`/sponsor/register`), M23 (global shell) |

**Change log**

| Version | Date | Change |
|---|---|---|
| 1.12 | 2026-10-02 | **M08-T3 as-built notes (doc only).** New DV-M08-37 (S18 avatar, D9 visual bug). The SRS §6.11 test-hook note (clipboard and share are tested through Playwright permissions and `addInitScript`; the `mock.clipboard()` and `mock.stubShare()` hooks stay unused) is an SRS matter and changes no requirement here. No AC change. |
| 1.11 | 2026-10-02 | **Fidelity documentation fix (doc only; no observed value changed).** Class 228 "⚠️ Perlu Perhatian": only the total **57** and the first three rows ("3 sesi · 48.3%", "2 sesi · 45%", "5 sesi · 44.6%") are OBSERVED (discovery M08 lines 1218–1223); the split into 11 under 50% + 46 idle was written as observed in FN-M08-2.5.4 and AC-M08-13.2 and is now INFERRED. FN-M08-2.5.4 reworded; AC-M08-13.2 no longer states the split; new AC-M08-13.2a tests the observed facts plus the computed ordering rule; new DV-M08-36 (INFERRED choice, alternatives recorded). |
| 1.10 | 2026-09-27 | **Revision history — v1.10, XL batch 3 round 4 (R4-01 part 1).** The S3 "Murid Terbaik" accuracy is the student's **mean session accuracy** (M05 Q-SESS-MEAN-ACC per user), the basis of the level cards (XL3-02): the observed T4 row "4 sesi · 60 soalan 64%" is no count ÷ 60 (38 → 63.3 %, 39 → 65 %), so only a session mean fits (BR-M08-07, FR-M08-27, AC-M08-10.3, E2E-M08-12). Ties by user id ascending. The other observed rows fit: "3 sesi · 30 soalan 93.3%" (e.g. 10 · 10, 10 · 9, 10 · 9); the 10 T5 rows (live 126.7 % … 103.1 %, a live data fault shown "100%" under DV-M08-07) are students whose every session is fully correct (mean 100.0 %) with ids ascending in the live order, and no other student with ≥ 3 sessions reaches 100 %. §6.3 now cites the M10 §6.2.1 (v1.11) allocation of the 11 T4 sessions inside the M05 dataset instead of the v1.8 construction. No other change; coverage 1,553/1,553; trace 0 errors. |
| 1.9 | 2026-09-27 | **Revision history — v1.9, XL batch 3 round 3 Minors.** **R3-02:** canonical account 4 (`pelajarmaju`) is at fixture school **900004 "SK Demo Bestari"** (M02 v1.16), not 900002; SK Demo 900002 holds no student, so the admin's S9 stays "0 / 0" and "Tiada Data Pelajar" as observed — XR-M08-01 resolved (SRS §6 ids, BR-M08-17, §6.10 S9 row). **R3-04:** `pksk` is a practice mode (M05 v1.12 BR-35) and counts on S6 with the other practice modes (BR-M08-11). No other change; coverage 1,553/1,553; trace 0 errors. |
| 1.8 | 2026-09-27 | **Revision history — v1.8, cross-module review XL batch 3** (`docs/qa/audit/cross-module-logic-M12-M18.md`; Delivery Lead decisions). **XL3-02:** S1 "Purata Ketepatan" and the level-card / S2 / S3 card accuracy are now the **mean of completed-session accuracies** (M05 Q-SESS-MEAN-ACC; INFERRED, the definition live uses for M12 "Skor Purata" BR-M12-04 and M16 "tepat" BR-M16-31); the observed 79.8 / 79.7 / 63.9 % stay the build targets and the class figures stay per answer. Script `xl3acc.js` proves them feasible with M05 v1.10 (Q-ANS-CORRECT 396,053–396,476, session answers 471,895 or 478,464, any sessionless correct count): S1 79.8 %, T5 79.7 %, T4 63.9 % with the class rows 81.7 % / 51.3 % and the top student 28/30; no display constant is needed. Murid Terbaik lists students with ≥ 3 sessions (every observed row has 3–13; required because the T4 level has 11 sessions while 2 students with 3 + 4 sessions are listed). **XL3-06:** coins, syiling, tier progress, streak and badges are read from M14 (`wallet.summary.currentSyiling`, `streak.get`, `learnerBadges.forUser`; DV-M14-08/09): S6 Koin 342,703 → 256, S18 syiling 103 → 256 ("244 syiling lagi ke Silver", bar 51.2 %), S18 Kombo / kombo terpanjang 0 / 0 → 1 / 5; S20 "Koin" 26 unchanged; DV-M08-25 resolved, OQ-M08-06 closed; E2E-17 and E2E-50 updated. **XL3-07:** headcount seeds for M12 (Students A 4664 / B 4644), M17 (config 617 of class 370 with the 30 observed TOVs; pupil 2022) and M18 (8880: 148 graded entries = the 75 class-516 entries + 73 others, the 6 S27 subject rows; KLUANG coverage 65 / 64 with the scoping definitions); script `grade8880.js` proves the 8880 grades, subject GPS and On Track / Below rows fit inside the platform 744 and keep T4 34 / 41; SchoolSpmHistory gains `schoolId`, `gradeCounts` and subject rows (2025 platform counts, 8080 2026, the 2026 subject rows at 8880); new stored **ItemStatistic** set (DATA-M08-11) with the M18 critical-question anchors (KLUANG / Johor 20, 8880 20 + T4 variant, 8765 6, 2710 0); Q-M12-HC-RECORDS is not hosted (M12 DC-M12-02, XL3-34). **XR-M18-09:** S9 adopts the observed populated S30 template for `/analisa-item/sekolah[/{id}]` (FN-M08-4.1.5–4.1.10, FR-M08-61, 141–143, AC-M08-20.3–20.7, E2E-M08-70/71), with the school-scoped GPS card (DV-M08-31, as M18 DV-M18-39); the own-school empty copy keeps "… menjawab soalan latihan." and the `/{id}` route keeps its own observed "… menjawab soalan.". **XL3-21 / XR-M18-08:** 3201–3215 are at 8880 (M02 v1.12) with answers outside sessions, so every session figure (T4 11, "4 Simulasi" 0) holds; the school-admin anchor "9 murid" still holds (900001 = canonical 2 + 3001–3008). References refreshed (M02 v1.12, M04 v1.10, M05 v1.10, M10 v1.6, M11 v1.8, M12 v1.3, M14 v1.3, M17 v1.3, M18 v1.3). Open: XR-M08-01 (canonical 4 at SK Demo vs the observed empty S9). Coverage 1,553/1,553; trace 0 errors. |
| 1.7 | 2026-09-26 | **Revision history — v1.7, cross-module review XL round 2** (`docs/qa/audit/cross-module-logic-M08-M11.md` R2.4). **XL2-35:** re-checked the school-admin anchor "2 kelas · 9 murid · 1 guru" against M02 v1.10, which places the class-516 pupils 3201–3215 **without a school** (grade 10, T4 class pool). The M02 students of school 900001 are canonical 2 and 3001–3008 = **9**, so the anchor holds unchanged; only the note in SRS §6.10 now cites the M02 placement. **XL2-47:** cross-module references refreshed to M01 v1.9, M02 v1.10, M04 v1.9, M05 v1.7, M10 v1.5, M11 v1.6; OQ-M08-12 now records the owners' delivered contracts instead of the requests (the M02 anchor record 3001–3008 / 3201–3215 is delivered). No value, rule, AC or E2E changes; coverage 1,553/1,553; trace 0 errors. |
| 1.6 | 2026-09-26 | **Revision history — v1.6, adoption of M05 v1.6** (§6.14 answer-log dataset, §6.14.2 named queries). (1) The v1.5 placeholders are renamed to the M05 queries: Q-ANS-ALL, Q-ANS-CORRECT, Q-SESS-ALL, Q-SESS-LEVEL / Q-ANS-LEVEL, Q-SESS-CLASS / Q-ANS-CLASS, Q-SESS-USER / Q-ANS-USER, Q-SESS-PARTICIPANTS(period) (SRS §6.3, BR-M08-10/11/28, FR-M08-12). (2) The coins and accuracies of the observed and generated S20 standings are **M08 documented display data** (the D11 exception): under 1 coin per correct answer the observed week standings need ≥ 21,369 correct answers, but the log holds at most 13,779 answers in 7 days (M05 §6.14.1); the designed rows and the participant counts stay computed from the log (SRS BR-M08-28, alternatives recorded). (3) The new M05 modes `mission`, `remedial` and `question_set` are **practice modes** in every M08 figure that counts practice-mode sessions (BR-M08-10/11; M05 recommendation). No approved live behaviour changes; coverage 1,553/1,553; trace 0 errors. |
| 1.5 | 2026-09-26 | **Revision history — v1.5, cross-module review XL batch 2** (`docs/qa/audit/cross-module-logic-M08-M11.md`). XL2-02 (Delivery Lead): S1 "Murid" / "Guru" and the header "{n} murid" are the **M02 users counts by role** (`student` 4,533, `teacher` 551; M02 §6.15 B role facet, the M02 S1 stat cards) in scope, not enrolments; level cards, S2/S3 and "Prestasi Guru" stay enrolment-based (T4 149, T5 3,911; 310 teachers who own classes); the school-admin anchor is recomputed, not tuned ("2 kelas · 9 murid · 1 guru"). XL2-01: every answer and session figure is a named definition on the **M05 answer-log and session D11 dataset** (SRS §6.3; M05 query names to be cited once M05 publishes them); seeded and designed rows are anchors inside the totals. XL2-20: the DSKP SP/SK/Bidang records M08 reads are seeded by **M10**, and "available" counts come from the new **M04 `dskpSpId` facet**. XL2-23: "DEMO-4S" is the observed live code of class 516 (kept; the M10 join-code rule must accept observed legacy codes). XL2-25: DATA-M08-01 `levelId` and `color` marked derived. XL2-31: status and cross-references refreshed (M02 v1.7, M04 v1.6, M05 v1.5, M10 v1.2); "no login" → "no demo credentials". Coverage 1,553/1,553; trace 0 errors. |
| 1.4 | 2026-09-25 | **Revision history — v1.4, audit round 3 Minor R3-01.** The T4 "Murid Berisiko" rows now come from **11** distinct pupils, as observed on live (v1.3: 9): the BI 68 / 84 (−16) row moves from 3207 to 3211 and the MATH 68 / 82 (−14) row from 3212 to 3208 (SRS §6.10). Texts, gaps, order (incl. the last −10), 34 / 41 and the row 13 / 2 are unchanged; no other value changed. |
| 1.3 | 2026-09-25 | **Revision history — v1.3, audit round 2** (`docs/qa/audit/M08-audit.md` Round 2, FAIL 0/2/3). R2-01: config 213 now mirrors the **15 observed TOV/AR3 pairs** of live S23 (no value tuned; 3201–3203 keep their S15 anchors, 3204–3215 follow the live rank order), and the S22 band edges are rewritten from the observation (Above = AR > OTR; On Track = OTR − 2 ≤ AR ≤ OTR; Below = AR < OTR − 2 → 5 / 2 / 8, the live +2 gap counts as Above; FN-5.5.3, SRS BR-08); the observed pairs give exactly the live averages 62.1 / 67.1 / 72.1 / 77.1 / 71.9, S23 6 / 9 (live rule) and the DV-29 total 7 / 8 (unchanged). R2-02: designed config 504 is now Tingkatan 5, so it no longer adds a pair to the observed S3 T4 aggregate (34 / 41 and the 15 at-risk rows re-verified); the S13 level-filter test uses a new entry-less Tingkatan 4 config 506 (AC-25.2/25.3). R2-03: DV-13 example corrected. R2-04: the S6 card-order step of E2E-18 is provisional. R2-05: class 2002 (T5) answering the Sejarah T4 anchors is documented as valid (SRS §6.10). |
| 1.2 | 2026-09-25 | **Revision history — v1.2, cross-module alignment.** M05 v1.4 §6.15: the M05 practice anchors 600001–600065 carry `dskpSpId = null`, so the v1.1 claim of SPs 9101–9108 on them is removed; the progressing student's S7 now shows the no-data state (AC-18.5, provisional) and no designed S7 mastery is derived from M05 data. M04 v1.5: the M08 anchors are the contributed rows of M04 §6.13.2 (700001–700008 + 700101–700128 Kimia T5 with SPs 9001–9004; 700201–700215 Sejarah T4), so class 2002 is now "5 MARIKH - Sejarah" and its three sessions use 700201–700205 (AC-12.3, 15.2); question counts cite the M04 §4.1 named queries; runtime question ids start at 9,000,001. M02 v1.6: users 3101–3109 belong to M09, so the class-516 pupils move to **3201–3215** (OQ-M08-12 asks M02 to record the M08 anchors 3001–3008 and 3201–3215). Coverage unchanged 1,553/1,553; trace 0 errors. |
| 1.1 | 2026-09-25 | **Revision history — v1.1, audit fixes** (`docs/qa/audit/M08-audit.md`, round 1 FAIL 0/5/11), discovery top-up §2.22 and decisions D11/D12 + canonical ids. AUD-01: populated headcount states specified as OBSERVED from the top-up (S15 statuses, RS badge/chip/row, "Ketepatan Ramalan ETR vs RS" box, Menurun, Rendah, status icons and row tints; S6 pills "On Track"/"Below"/"—" and chip row; S5 badges and the new "📈 Headcount — Ringkasan Kelas" block; new screens S22 `/headcount/{id}/summary` and S23 `/headcount/{id}`; new FN-2.5.7, 2.6.9, 5.4.6, FT-5.5, FT-5.6). AUD-02: DV-09 withdrawn (the RS point renders); DV-21 narrowed to the red Gred AR pill without a target. AUD-03: DV-03 withdrawn — "Laporan Mingguan" shown as live; admin 403 observed; other roles blocked/provisional. AUD-04: DV-15 withdrawn — S8 "Kelas" lists own classes only (admin empty, as live). AUD-05: the 13 observed S3 T4 rows seeded; D-27 definitions replicated and documented; "Jumlah Sesi" = distinct sessions (new DV-28). D-28: new DV-29 (±2% rule for every "On Track"/"Below" on S5, S22, S23). D-29: new DV-30 (captions kept). DV-13 narrowed to rings with numerator > denominator. Minors: AUD-06 (DV-02/04 scoped to the admin; teacher/student INFERRED, provisional), AUD-07 (S10 order newest-created first), AUD-08 (S6 chip row), AUD-09 (ranking footer nasional only; DV-22 evidence), AUD-10 (guest redirects, public `/pelajar`, S11 Tahap pills, S5 "—" cells OBSERVED), AUD-11 (provisional marking), AUD-12 (CSS upper-case headers), AUD-13 (captions — now DV-30), AUD-14 (DV-13), AUD-15 (escaped pipes), AUD-16 (one leaderboard for every viewer). OQ-05 closed (two observed level fields), OQ-11 closed (canonical ids 1–11). Coverage re-generated: 1,553/1,553, 0 unmapped. |
| 1.0 | 2026-09-25 | First issue under D7 (fidelity), D8 (proven completeness), D9 (deviation rule) and D10 (accessibility and scope follow D9). Coverage 1,148/1,148; DV-M08-01…27. |

**Conventions** (same as M01–M06)
- Quoted UI copy is the exact live text. Where CSS upper-cases it, the fact is stated ("upper case by CSS"). English words that live shows ("On Track", "Below", "Below Target", "Off Track", "Above", "Tracking prestasi murid", "Auto-Setup", "Key-in AR", "Export CSV", "Active") are live copy and are kept.
- **OBSERVED** = seen on the live site (walk-through, inventory state, screenshot or page script). **SOURCE-DERIVED** = taken from page markup or script captured read-only, but the state itself was never rendered. **INFERRED** = the most likely live behaviour, not observed; no new UX is invented. **UNVERIFIED** = live behaviour or copy that exists but could not be observed (pending an L-state); nothing is asserted beyond the evidence. **PROPOSED** / **PROPOSED COPY** = a new value, layout or text written for the rebuild; listed in §9 for the Delivery Lead to report at G1. **Provisional** (E2E) = a scenario that asserts INFERRED, UNVERIFIED or PROPOSED behaviour and must be revisited when the L-state is observed.
- **L-n** = a not-observable state of discovery §9. **D-n** = a live defect of discovery §8.2. **DV-M08-nn** = fidelity deviation (§7); anything not listed there must match live. **SEC-M08-nn** = risk of the live behaviour, replicated with dummy data (SRS §11).
- Personal data: students are minors. Discovery masked every person, school and PPD (`<masked>`, `<person>`, `<name>`, `<in>`, `<school>`, `<ppd>`) and person ids in links (`{id}`). Seeds use clearly fictitious names.
- **Data (D11, D12; SRS §6):** large collections are deterministic virtual datasets that report the live totals, with observed records as anchors; every figure is computed from the dataset under its own documented definition (no stored copies of a total). Each store has one owner: sessions/answers M05, questions M04, users/schools M01/M02, classes/enrolments M10; M08 owns headcount configs/entries, analytics records, timeline posts and the ranking/leaderboard read models. Seed accounts are the canonical ids 1–11 (M01 v1.9).

---

## 1. Overview

M08 is the **performance and analytics** area of the user portal. It has eight menu routes that open 23 screens:

1. **Prestasi dashboards:** school (`/prestasi` → `/prestasi/sekolah`), level (`/prestasi/tingkatan[/t4|t5]`), class (`/prestasi/kelas[/{id}]`, with a headcount summary block when the class has a headcount) and the individual "Prestasi 360" (`/prestasi/{userId}`), including the estimated school grade average (GPS) and the headcount on-track figures.
2. **Adaptive analytics:** the learner's own "Analitik Pembelajaran" (`/analitik/pelajar`, sidebar "Analitik Adaptif") and the teacher-side "Analitik Kelas" (`/analitik/kelas`).
3. **Item analysis:** school (`/analisa-item/sekolah`), class picker (`/analisa-item/kelas`) and the class board "Papan Guru" (`/analisa-item/kelas/{id}`) with the difficulty index (1 − p) and the discrimination index (top 27% − bottom 27%).
4. **Headcount:** TOV → OTR1…n → ETR (+ RS) target tracking per class, subject and year: list and Auto-Setup (`/headcount`), dashboard (`/headcount/dashboard`), create (`/headcount/create`), per-config table (`/headcount/{id}`), class summary (`/headcount/{id}/summary`) and per-student view (`/headcount/student/{id}`).
5. **Timeline and public profile:** a learner's posts (`/timeline`, `/timeline/create`) and the public profile `/pelajar/{id}`.
6. **Ranking and leaderboard:** the academic ranking `/ranking` and the coins leaderboard `/leaderboard`.
7. **Weekly report** `/laporan-mingguan`: 403 for the admin; content for other roles not observable (blocked, OQ-M08-01).

Every screen except S18 and the error pages renders in the **user-portal layout** (shell SHU), even for the admin. The admin-panel sidebar has none of these routes. Entry points: the user-portal sidebar and its mobile "Lagi" drawer (§3 FT-M08-1.1), the S1 quick navigation, the S5 "Lihat Penuh →" and S6 "Lihat Penuh" links, and the M05 dashboard quick action "🏅 Papan Pendahulu" → `/leaderboard`.

**Routes covered** (TRACKER §4 M08 plus crawl and top-up finds):

| # | Route | Tab title (exact live) | Header title (as specified) |
|---|---|---|---|
| S1 | `/prestasi` → 302 `/prestasi/sekolah` | "Dashboard Sekolah — Prestasi" | "Dashboard Sekolah" (DV-M08-01; live "Dashboard") |
| S2 | `/prestasi/tingkatan` | "Pilih Tingkatan — Prestasi \| PRESTASIPLUS" | "Dashboard Tingkatan" |
| S3 | `/prestasi/tingkatan/{t4\|t5}` | "Tingkatan 4 — Dashboard Tingkatan \| PRESTASIPLUS" | "Tingkatan 4" / "Tingkatan 5" |
| S4 | `/prestasi/kelas` | "Pilih Kelas — Prestasi" | "Prestasi Kelas" |
| S5 | `/prestasi/kelas/{id}` | "{kelas} — Dashboard Kelas" | "{kelas}" |
| S6 | `/prestasi/{userId}` | "Prestasi 360 — {nama} — PRESTASIPLUS" | "Prestasi 360" (DV-M08-01) |
| S7 | `/analitik/pelajar` | "Analitik Pembelajaran" | "Analitik Pembelajaran" |
| S8 | `/analitik/kelas` (`?classroom_id=&subject_id=&risk_level=`) | "Analitik Kelas" | "Analitik Kelas" |
| S9 | `/analisa-item/sekolah` and `/analisa-item/sekolah/{id}` (`?tingkatan=T4\|T5`) | "Analisa Item Sekolah \| PRESTASIPLUS" | "Analisa Item — Sekolah" |
| S10 | `/analisa-item/kelas` | "Analisa Item — Papan Guru \| PRESTASIPLUS" | "Analisa Item" |
| S11 | `/analisa-item/kelas/{id}` | "Analisa Item — Papan Guru \| PRESTASIPLUS" | "Analisa Item" |
| S12 | `/headcount` | "Headcount - PRESTASIPLUS" | "Headcount" (DV-M08-01) |
| S13 | `/headcount/dashboard` | "Dashboard Headcount - PRESTASIPLUS" | "Dashboard Headcount" (DV-M08-01) |
| S14 | `/headcount/create` | "Buat Headcount Baru - PRESTASIPLUS" | "Buat Headcount Baru" (DV-M08-01) |
| S15 | `/headcount/student/{id}` | "Headcount {nama} - PRESTASIPLUS" | "Headcount — Prestasi Individu" (DV-M08-01) |
| S16 | `/timeline` | "Timeline Saya - PRESTASIPLUS" | "Timeline Saya" |
| S17 | `/timeline/create` | "Tambah Post - Timeline" | "Tambah Post" |
| S18 | `/pelajar/{id}` | "{nama} — Pelajar PRESTASIPLUS" | — (standalone public layout) |
| S19 | `/ranking` (`?scope=&subject_id=&tingkatan=&negeri=`) | "Kedudukan Nasional" / "Kedudukan {x}" | "Kedudukan" (DV-M08-01, DV-M08-22) |
| S20 | `/leaderboard` (`?period=all\|week\|month`) | "Papan Pendahulu - PRESTASIPLUS" | "Papan Pendahulu" |
| S21 | `/laporan-mingguan` | "403 - Akses Ditolak \| PRESTASIPLUS" (admin) | — (standalone 403 page) |
| S22 | `/headcount/{id}/summary` | "Ringkasan Kelas - PRESTASIPLUS" | "Ringkasan Kelas" (DV-M08-01) |
| S23 | `/headcount/{id}` (`?sort=ranking\|name`) | "Headcount {Subjek} - PRESTASIPLUS" | "Headcount {Subjek}" (DV-M08-01) |

Linked but not opened (L-12, provisional; SRS FR-M08-137): `/headcount/{id}/results/{n}`, `/headcount/{id}/edit`, `/headcount/{id}/unjuran`, `/headcount/{id}/settings`, `/headcount/{id}/export`, and the reset / delete / drop-students forms.

Other access outcomes (all OBSERVED): `/analisa-item` → 302 `/dashboard` for the admin (DV-M08-02); `/analitik/kelas/pelajar/{id}` → 403 (DV-M08-04); `/prestasi/kelas/sc-{id}` → 404 (DV-M08-06); `/prestasi?{id}` → S1 (DV-M08-08); `/pelajar/3` → 404 (DV-M08-19); `/timeline/{id}` GET → 405 (DV-M08-24); `/analisa-item/kelas/99999999` → 403; `/prestasi/99999999`, `/headcount/student/99999999`, `/pelajar/99999999`, `/prestasi/tingkatan/t3`, `/analitik`, `/analitik/guru`, `/analisa-item/pelajar`, `/analisa-item/{id}`, `/headcount/1` (unknown config) → 404; a guest → 302 `/login` on the session routes; `/pelajar/1` → 200 for a guest. `/guru/laporan-mingguan-kelas` → 403 belongs to M11.

**Cross-module ownership.** M08 owns `/prestasi/kelas*` and `/analitik/kelas`; M11 references them. `/gamification/leaderboard` (M14) and `/battle/leaderboard` (M16) are different pages. `/practice/progress` and `/practice/history` are M05. The Latihan Fokus / Fokus links start an M05 practice session and were never opened.

---

## 2. Actors

| Role | Involvement in M08 | Verified |
|---|---|---|
| Admin | Every screen. Platform-wide data on S1–S3; any class by URL on S5/S8/S11; any config by URL on S22/S23; any student on S6/S15; all 750 classes on S10; own data on S6/S7/S16/S18/S20; 403 on S21. Owns no class and no headcount (S4, S12, S13 empty; S8 and S14 class selects empty). | OBSERVED (admin account) |
| Guru (teacher) | Class dashboards (S4/S5), class analytics (S8), item analysis of own classes (S10/S11), headcount (S12–S15, S22, S23) of own classes; drawer teacher group "PENILAIAN" → Headcount, Prestasi `/prestasi/kelas`. | INFERRED (no teacher account) |
| Pentadbir Sekolah (school admin) | S1–S3 for own school only (discovery Q3). | INFERRED (OQ-M08-04) |
| Pelajar (student) | Own Prestasi 360 (S6), Analitik Pembelajaran (S7), Timeline (S16/S17), Kedudukan (S19), Papan Pendahulu (S20); public profile subject (S18); Laporan Mingguan (S21) probably permitted on live. | INFERRED (no student account) |
| Ibu Bapa (parent) | Possibly the weekly report and children's Prestasi 360. | INFERRED / UNVERIFIED (OQ-M08-01) |
| Public (no session) | S18 `/pelajar/{id}` only. | OBSERVED (200 without a session) |
| Guest on other routes | 302 → `/login`. | OBSERVED (8 routes), INFERRED for the rest |

The admin sees every user-portal menu item, including items whose target refuses or redirects the admin (S21 403, `/analisa-item`). Role-specific menu visibility for other roles is not observable.

---

## 3. Functional breakdown (Epic → Feature → Function)

Generated by script from the element inventory (`docs/discovery/inventory/M08/`) and the Function catalogue. "EL" lists inventory element IDs (prefix `EL-M08-`). Functions with EL "—" are behaviours (access, server rules, unobservable states) with no element of their own. The S15 sections repeat per config and per student, so their elements are mapped by rule (card/heading/chips → FN-5.4.2, status and summary chips → FN-5.4.3, tables → FN-5.4.5, the "Ketepatan Ramalan" box → FN-5.4.6); §6 lists every S15 element with its Function.

### EP-M08-1 — Navigation, shell entries and access

**FT-M08-1.1 — M08 entries in the user-portal shell (SHU)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M08-1.1.1 | Desktop sidebar (≥1024px) items in the main group: `fa-chart-line` "Headcount" → `/headcount`, `fa-chart-bar` "Prestasi" → `/prestasi`, `fa-brain` "Analitik Adaptif" → `/analitik/pelajar`, `fa-magnifying-glass-chart` "Analisa Item" → `/analisa-item` (admin target per DV-M08-02), `fa-file-lines` "Laporan Mingguan" → `/laporan-mingguan` (shown as live); `fa-trophy` "Kedudukan" → `/ranking`; `fa-camera` "Timeline Saya" → `/timeline` | SHU-011–014, 016, 065, 098 | All roles that see the item | OBSERVED (admin) + DV-M08-02 |
| FN-M08-1.1.2 | Mobile/tablet "Lagi" drawer (below 1024px): the same M08 links (SHU-175 Headcount, 176 Prestasi, 177 Analisa Item, 185 Laporan Mingguan, 206 Kedudukan, 305 Timeline Saya) and, in the teacher group "PENILAIAN", `fa-chart-line` "Headcount" → `/headcount` and `fa-chart-bar` "Prestasi" → `/prestasi/kelas` | SHU-175–177, 185, 206, 261–262, 305 | All; teacher group INFERRED Guru | OBSERVED (admin) |
| FN-M08-1.1.3 | Shell header title/subtitle per M08 screen: S2 "Dashboard Tingkatan" / "Pilih tingkatan untuk lihat prestasi keseluruhan"; S3 "Tingkatan {4\|5}" / "Dashboard Prestasi Tingkatan"; S4 "Prestasi Kelas" / "Pilih kelas untuk lihat prestasi keseluruhan"; S5 "{nama kelas}" / "{sekolah} · {subjek} · {tahun}" (subject omitted for a class without subject: "{sekolah} · {tahun}"); S7 "Analitik Pembelajaran" / "Pantau prestasi dan kenal pasti topik yang perlu diperkukuhkan"; S8 "Analitik Kelas" / "Pantau prestasi pelajar dan kenal pasti yang memerlukan perhatian"; S9 "Analisa Item — Sekolah" / "{sekolah}[ — Tingkatan n]"; S10/S11 "Analisa Item" / "Analisis tahap kesukaran dan diskriminasi soalan mengikut kelas"; S16 "Timeline Saya" / "Kongsi pencapaian & cerita anda"; S17 "Tambah Post" / "Kongsi pencapaian atau cerita baru"; S20 "Papan Pendahulu" / "Siapa juara minggu ini?" (all live). S1, S6, S12–S15, S19, S22, S23 show the fallback "Dashboard" / "Selamat datang kembali" on live; the rebuild shows the page title (DV-M08-01) | SHU-136–137, 373–401 | All | OBSERVED + DV-M08-01 |

**FT-M08-1.2 — Access, redirects and error pages**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M08-1.2.1 | Every M08 route except `/pelajar/{id}` requires a session: a guest gets 302 → `/login` (OBSERVED for `/prestasi`, `/ranking`, `/leaderboard`, `/timeline`, `/headcount`, `/analitik/pelajar`, `/laporan-mingguan`, `/analisa-item/kelas`; the other M08 routes INFERRED alike) | — | Guest | OBSERVED |
| FN-M08-1.2.2 | `/prestasi` redirects (302) to `/prestasi/sekolah` (S1) | — | Admin | OBSERVED |
| FN-M08-1.2.3 | Global 404 page (M01): "404", "🔍", h1 "Halaman Tidak Dijumpai", "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?", "Halaman Utama" → `/`, "Mula Latihan" (→ `/practice`, M01 DV-02; live `/latih-tubi`), "PRESTASIPLUS"; for `/prestasi/tingkatan/{other than t4\|t5}`, unknown `/prestasi/{userId}`, `/headcount/student/{id}`, `/pelajar/{id}`, `/prestasi/kelas/sc-{id}`, and `/analitik`, `/analitik/guru`, `/analisa-item/pelajar`, `/analisa-item/{id}` (all OBSERVED) | S3-001–007; S5-052–058; S6-128–134; S15-059–065; S18-060–065 | All | OBSERVED + M01 DV-02 |
| FN-M08-1.2.4 | Global 403 page "Akses Ditolak" (standalone): "403", "🚫", h1 "Akses Ditolak", "Anda tidak mempunyai kebenaran untuk mengakses halaman ini. Sila log masuk dengan akaun yang betul atau hubungi pentadbir.", "Halaman Utama" → `/`, "Log Masuk" → `/login`, "PRESTASIPLUS"; tab "403 - Akses Ditolak \| PRESTASIPLUS"; shown for an unknown or unpermitted `/analisa-item/kelas/{id}` | S11-076–082 | All | OBSERVED |
| FN-M08-1.2.5 | `/analisa-item` (sidebar "Analisa Item"): live redirects the admin to `/dashboard` with no message (dead end, OBSERVED). Rebuild: admin → `/analisa-item/kelas` (S10, DV-M08-02). Teacher → `/analisa-item/kelas` (INFERRED, provisional, L-2); school admin → `/analisa-item/sekolah` (S9, INFERRED, same dead-link fix; OD-R4); other roles, pelajar included → `/dashboard` (INFERRED, provisional, L-2) | — | Admin (OBSERVED); others INFERRED | OBSERVED + DV-M08-02 |
| FN-M08-1.2.6 | `/timeline/{id}` GET → live 405 English framework page "An Error Occurred: Method Not Allowed" (OBSERVED; unlinked). Rebuild: the global 404 page (DV-M08-24); no edit/delete UI (L-5) | — | All | OBSERVED + DV-M08-24 |

### EP-M08-2 — Prestasi dashboards (school, level, class, individual)

**FT-M08-2.1 — Dashboard Sekolah (S1 `/prestasi/sekolah`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M08-2.1.1 | Header card: 🏫 tile (amber tint), h1 "Dashboard Sekolah", "Ringkasan prestasi keseluruhan · {kelas} kelas · {murid} murid" ({murid} = M02 users with role `student` in scope, XL2-02); outline pills "Tingkatan" (indigo) → `/prestasi/tingkatan` and "Kelas" (blue) → `/prestasi/kelas`; tab "Dashboard Sekolah — Prestasi" | S1-004–009 | Admin; Admin Sekolah INFERRED | OBSERVED |
| FN-M08-2.1.2 | 7 stat cards (2 / `sm` 4 / `lg` 7 columns): "Murid" (slate-800; M02 users with role `student` in scope), "Guru" (indigo-400; M02 users with role `teacher` in scope — not only class owners, of whom 310 appear under "Prestasi Guru"), "Kelas" (blue-400), "Subjek" (purple-400), "Sesi Latihan" (emerald-400), "Soalan Dijawab" (amber-400, the only value with a thousands separator, as live), "Purata Ketepatan" (cyan-400, 1 decimal + "%"; the mean of the completed-session accuracies, BR-M08-07) | S1-010–030 | Admin | OBSERVED |
| FN-M08-2.1.3 | Card "📊 GPS Anggaran" / "Gred Purata Sekolah (lebih rendah = lebih baik)": big GPS value (2 decimals) in a ring, label "GPS", band pill (label and colour by the chart band rule, DV-M08-12; live "Sederhana"), "Berdasarkan **{n}** entri headcount", footnote "* Anggaran dari markah OTR, bukan SPM sebenar"; GPS = mean grade point of the graded headcount entries (A+ 0 … G 9) | S1-031–039 | Admin | OBSERVED + DV-M08-12 |
| FN-M08-2.1.4 | Card "📈 Taburan Gred (Anggaran)": one row per grade A+, A, A-, B+, B, C+, C, D, E, G with label, bar (width = count ÷ max count, colours per grade), count and "{%}" (1 decimal); footer "Jumlah: {n} rekod" | S1-040–072 | Admin | OBSERVED |
| FN-M08-2.1.5 | Card "📉 Trend GPS (5 Tahun)": "2022–2026 · lebih rendah = lebih baik", "Paksi Y diterbalikkan: 0 (A+) di atas, 9 (G) di bawah.", Chart.js line chart (overall + one dashed line per subject, reversed y 0–9 with grade ticks, band shading, tooltip band labels) and table Tahun · GPS Keseluruhan · Tahap · Calon · Sumber · Perubahan (headers upper case by CSS; 2022–2025 rows, "2026 Semasa" row "Tiada data" and "—") | S1-073–081 | Admin | OBSERVED |
| FN-M08-2.1.6 | Card "📚 GPS Mengikut Subjek": table # · Subjek · GPS · Gred · Entri · On Track · Below · Tiada Sasaran · Pencapaian (headers upper case by CSS); rows by GPS ascending, subjects without data ("—") last; GPS/Gred colour bands; Gred = grade at round(GPS); Pencapaian bar width round((9.5 − GPS) ÷ 9.5 × 100)% (OBSERVED on all 16 rows); scrolls inside its card below `md` | S1-082–084 | Admin | OBSERVED |
| FN-M08-2.1.7 | Card "🎓 Perbandingan Tingkatan": one link card per level → `/prestasi/tingkatan/t4\|t5` with "Tingkatan n", accuracy % (amber/emerald), bar (width = floor of %), "{k} kelas", "{m} murid", "{s} sesi latihan"; values from the same level aggregate as S2/S3 (DV-M08-05) | S1-085–088 | Admin | OBSERVED + DV-M08-05 |
| FN-M08-2.1.8 | Card "👩‍🏫 Prestasi Guru": scroll box (max 384px) with one card per teacher, A→Z: name, "{n} kelas · {m} murid", "Ketepatan: **x%**" (slate <50, amber 50–69.9, emerald ≥70), then "Tiada data headcount" or "On Track: n" + "Below: n" + bar round(on ÷ (on + below) × 100)% | S1-089–105 | Admin | OBSERVED |
| FN-M08-2.1.9 | Card "🔗 Navigasi Pantas" (2 / `sm` 4 columns): "🎓 Dashboard Tingkatan" → `/prestasi/tingkatan`, "📊 Dashboard Kelas" → `/prestasi/kelas`, "📈 Headcount" → `/headcount`, "🔬 Analisa Item" → `/analisa-item/sekolah` | S1-106–111 | Admin | OBSERVED |
| FN-M08-2.1.10 | Scope: no school selector; admin sees every school (750 kelas, 4533 murid); a school admin sees own school only (INFERRED, OQ-M08-04) | — | Admin (OBSERVED); Admin Sekolah INFERRED | OBSERVED / INFERRED |

**FT-M08-2.2 — Pilih Tingkatan (S2 `/prestasi/tingkatan`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M08-2.2.1 | Two link cards (1 / `sm` 2 columns), each indigo-50 tile icon, h3 "Tingkatan 4" / "Tingkatan 5", "{k} kelas \| {m} murid" → `/prestasi/tingkatan/t4\|t5`; only T4 and T5 exist (deliberate limit, D10); tab "Pilih Tingkatan — Prestasi \| PRESTASIPLUS" | S2-004–007 | Admin | OBSERVED |

**FT-M08-2.3 — Dashboard Tingkatan (S3 `/prestasi/tingkatan/{t4|t5}`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M08-2.3.1 | Header: "←" → `/prestasi/tingkatan`, tile, h1 "Tingkatan n", "Dashboard Prestasi Tingkatan · {k} kelas · {s} subjek", level pills "T4" / "T5" (active indigo-600 white, inactive gray-100); tab "Tingkatan n — Dashboard Tingkatan \| PRESTASIPLUS" | S3-011–016, 068–069 | Admin | OBSERVED |
| FN-M08-2.3.2 | 6 stat cards (2 / `sm` 3 / `lg` 6), each with its own definition: Kelas (gray-800; classes of the level), Murid (indigo-600; **distinct** students of the level), Purata Ketepatan (blue-600; mean of session accuracies, BR-M08-07), Jumlah Sesi (emerald-600, separator; **distinct** sessions — DV-M08-28, live T4 10), On Track (green-600) and Below Target (red-600) counting **student × headcount-config pairs** with no "Tiada Data" bucket (replicated) | S3-017–028, 070 | Admin | OBSERVED + DV-M08-28 |
| FN-M08-2.3.3 | Card "Headcount Keseluruhan": "{round(on ÷ (on + below) × 100)}% On Track", stacked bar (emerald on-track, red below, unrounded widths), legend "On Track: n" · "Below Target: n" | S3-029–033, 071–074 | Admin | OBSERVED |
| FN-M08-2.3.4 | Card "Perbandingan Kelas": table Kelas · Subjek · Guru · Murid · Sesi · Ketepatan · On Track · Below · Aksi (headers upper case by CSS); row Murid = **enrolments** of the class, Sesi/Ketepatan = sessions of the class members, On Track/Below = **one status per student** (replicated definitions); rows grouped "Tiada Subjek" first, subjects A–Z, "Kelas Sekolah" last, then class name; Guru "—" on school-class rows; Ketepatan red <50 / amber 50–69.9 / emerald ≥70; On Track green / Below red when >0 else gray-400; "Lihat →" → `/prestasi/kelas/{id}`; "Kelas Sekolah" rows have no link (DV-M08-06; live 404); no pagination; scrolls in its card below `md` | S3-034–040, 126–134 | Admin | OBSERVED + DV-M08-06 |
| FN-M08-2.3.5 | Card "Murid Terbaik": up to 10 rows (students with ≥ 3 sessions, BR-M08-07): rank (1 amber-500, 2 gray-400, 3 amber-700, others gray-400), name, "{n} sesi · {m} soalan", accuracy % (emerald-600), never above 100% (DV-M08-07) | S3-041–050, 075–110 | Admin | OBSERVED + DV-M08-07 |
| FN-M08-2.3.6 | Card "Murid Berisiko": up to 15 red link rows "{nama}" / "{kelas} · OTR{n}: {AR}% (sasaran {target}%)" + gap in red ("-26", "-33.3"), largest shortfall first; link → `/prestasi/{userId}` (DV-M08-08; live `/prestasi?{id}`) | S3-051–067, 111–125 | Admin | OBSERVED + DV-M08-08 |

**FT-M08-2.4 — Pilih Kelas (S4 `/prestasi/kelas`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M08-2.4.1 | Tile 📊, h1 "Dashboard Kelas", "Pilih kelas untuk lihat prestasi keseluruhan"; tab "Pilih Kelas — Prestasi" | S4-004–006 | Guru INFERRED; Admin | OBSERVED |
| FN-M08-2.4.2 | Empty state (viewer owns no active class): 📭 "Anda belum mempunyai kelas aktif." / "Cipta kelas terlebih dahulu untuk mula memantau prestasi murid." / button "Cipta Kelas" → `/guru/kelas/cipta` (M10) | S4-007–010 | Admin (OBSERVED) | OBSERVED |
| FN-M08-2.4.3 | Populated picker: the viewer's own active classes, each opening `/prestasi/kelas/{id}` (layout UNVERIFIED, L-6; the rebuild reuses the S10 class-card pattern, PROPOSED) | — | Guru | UNVERIFIED (L-6) |

**FT-M08-2.5 — Dashboard Kelas (S5 `/prestasi/kelas/{id}`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M08-2.5.1 | Header: "←" (title "Kembali ke senarai kelas") → `/prestasi/kelas`, 📊, h1 class name, "{sekolah} · {subjek} · {tahun} · Kod: **{kod}**" (code blue-600; subject omitted for a class without subject, e.g. "{sekolah} · 2026 · Kod: DEMO-4S"); tab "{kelas} — Dashboard Kelas" | S5-004–009, 059–062, 079–082 | Guru INFERRED; Admin | OBSERVED |
| FN-M08-2.5.2 | Select "Tukar Kelas..." (placeholder + the viewer's own classes); choosing an option navigates to that class; for a viewer without classes only the placeholder | S5-010 | Guru; Admin | OBSERVED |
| FN-M08-2.5.3 | 6 stat cards: Jumlah Murid · Purata Ketepatan (blue-600, "{x}%", "0%" when none) · Jumlah Sesi · Soalan Dijawab · Purata Masa/Sesi ("{m}m", 1 decimal, "0m") · Aktif 7 Hari | S5-011–028, 063–070, 099–100 | Guru; Admin | OBSERVED |
| FN-M08-2.5.4 | Card "⚠️ Perlu Perhatian (n)" (scroll list): students with accuracy <50% ("{n} sesi · {x}% ketepatan", badge "{x}%") by accuracy descending, then students with no practice ("Belum mula berlatih", badge "Tak Aktif") last (class 228: the total 57 and the first three rows "3 sesi · 48.3%", "2 sesi · 45%", "5 sesi · 44.6%" are OBSERVED, discovery M08 lines 1218–1223; the split of the 57 into 11 members under 50% + 46 idle is INFERRED, a generation choice — see DV-M08-36); each → `/prestasi/{userId}` | S5-029–036, 071–078, 093–094 | Guru; Admin | OBSERVED (order, total 57, first three rows) / INFERRED (11 + 46 split) |
| FN-M08-2.5.5 | Card "📈 Trend Aktiviti Kelas (30 Hari)": Chart.js line (Purata Ketepatan (%) + Sesi, two y axes, MM-DD labels, days with activity only); empty 📭 "Belum ada aktiviti dalam 30 hari terakhir." | S5-037–040 | Guru; Admin | OBSERVED |
| FN-M08-2.5.6 | Card "🏆 Kedudukan Murid": table # (🥇 🥈 🥉 then numbers) · Nama · Sesi · Soalan · Ketepatan ("—" when no practice; ≤100%, DV-M08-07) · Headcount (badge `badge-on` "On Track" / `badge-below` "Below" / `badge-na` "N/A" — status per the ±2% rule of the class headcount block, DV-M08-29) · Terakhir Aktif (relative, "—" when never) · Aksi "Lihat →" → `/prestasi/{userId}`; accuracy descending, ties by user id (INFERRED); headers upper case by CSS; no pagination | S5-041–051, 095–098 | Guru; Admin | OBSERVED + DV-M08-07/29 |
| FN-M08-2.5.7 | Block "📈 Headcount — Ringkasan Kelas" (only when the class has a headcount config; grid 1 / `sm` 3): "{n}" "On Track / Above" (emerald-50/200, number emerald-600, label emerald-700), "{n}" "Below Target" (red), "{n}" "Tiada Data" (gray); 6px stacked bar #22c55e / #ef4444 / #94a3b8; "Purata TOV: x%", "Purata ETR: x%", "Lihat Penuh →" → `/headcount/{configId}/summary`; uses the class's latest-updated config (INFERRED) and the ±2% rule (OBSERVED 7/8/0) | S5-083–092 | Guru; Admin | OBSERVED |

**FT-M08-2.6 — Prestasi 360 (S6 `/prestasi/{userId}`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M08-2.6.1 | Gradient hero: back `history.back()` (`fa-arrow-left`), initial avatar, h1 name, "Prestasi 360 — Dashboard Individu", `lg` mini stats "{x}%" "Ketepatan" and "{n}" "Hari Kombo"; tab "Prestasi 360 — {nama} — PRESTASIPLUS" | S6-004–011, 117 | Admin; Guru/Pelajar INFERRED | OBSERVED |
| FN-M08-2.6.2 | 4 stat cards (2 / `lg` 4): "Sesi Kuiz" (`fa-clipboard-list`), "Ketepatan" (`fa-check-circle`, 1 decimal), "Soalan Dijawab" (`fa-question-circle`), "Masa Belajar" (`fa-clock`, "{h}j {m}m" or "{m}m"); counts only practice-mode sessions (not SPM types; INFERRED, DV-M08-20 replicated) | S6-012–023, 118–123 | Admin | OBSERVED / INFERRED |
| FN-M08-2.6.3 | Card "Headcount — Prestasi SPM" (only when the student has headcount entries): per config h3 subject, "{kelas} · {tahun}", status pill "On Track" (`bg-green-100 text-green-700`) / "Below" (`bg-red-100 text-red-700`) / "—" (`bg-slate-100 text-slate-500`, no OTR target); chip row "TOV: x%" (amber) → one "OTR{i}: {AR}%" chip **only for checkpoints with an AR** (green-50/700 when AR ≥ target, red-50/700 below or without target) → "ETR: x%\|—" (purple), joined by chevrons, wrapping below 640px (DV-M08-10); "Lihat Penuh" → `/headcount/student/{id}`; cards by config last update, newest first (INFERRED) | S6-024–034, 135–167 | Admin | OBSERVED + DV-M08-10 |
| FN-M08-2.6.4 | Card "Penguasaan Subjek" (1 / `sm` 2 columns): per subject a tile with the first two letters of the subject code in the subject colour ("CH", "BM", "SC"), name, bar (≥80 #10b981, 60–79 #f59e0b, <60 #ef4444 — bands INFERRED), % (green/amber/red-600) and "{n} sesi · {m} soalan"; empty `fa-chart-pie` "Belum ada data latihan." + "Mula Berlatih" (`fa-play`) → `/practice` | S6-035–051, 124–125, 168–178 | Admin | OBSERVED / INFERRED (bands) |
| FN-M08-2.6.5 | Card "Aktiviti": "Kombo Hari" (orange-500), "Rekod Terbaik" (slate-700), "Koin" (amber-500, thousands separator; M14 `wallet.summary.currentSyiling`, the same value as the header chip — DV-M14-09); streak and best from M14 `streak.get`, "Hari Latihan" (indigo-500) | S6-052–061 | Admin | OBSERVED |
| FN-M08-2.6.6 | Card "Peta Aktiviti (90 Hari)": 90 cells oldest first, colour by sessions that day (0 #f1f5f9, 1 #bbf7d0, 2 #4ade80, 3 #16a34a, 4+ #15803d); hover shows and click toggles the tooltip (`fa-calendar-day`) "dd/mm (Hari) — Tiada aktiviti" or "… — n sesi" (INFERRED); legend "0", "1-1", "2-2", "3-3", "4+", "sesi/hari" (labels as live) | S6-062–076 | Admin | OBSERVED / INFERRED (active text) |
| FN-M08-2.6.7 | Card "Topik Perlu Perhatian": red rows (accuracy tile "{x}%", topic — a DSKP "{kod} — {tajuk}" cut at ~70 chars + "..." or a topic name, "{CODE} · {n} percubaan", badge `fa-bolt` "Fokus {k}", button title "Klik untuk {k} soalan fokus" `fa-bolt` "Fokus" (text from `sm`) → `/practice/{CODE}/quiz?[level={levelId}&]dskp_sp_id={id}&count={k}` (the `level` parameter is present or absent, both OBSERVED), k = min(available, 25)); legend "Fokus" + "Klik untuk buka set latihan tertumpu pada topik lemah itu sahaja."; empty `fa-check-circle` "Tiada topik lemah! Teruskan usaha." | S6-077–110, 126, 184–207 | Admin | OBSERVED |
| FN-M08-2.6.8 | Card "Cadangan": alternating blue-50 / amber-50 rows with icon bubble; sentences: "Sudah {n} hari tiada latihan. Mulakan semula dengan 10 soalan mudah untuk pemanasan.", "Belum ada sesi latihan lagi. Mulakan dengan subjek yang paling kamu minati!", "Tingkatkan prestasi {Subjek} (purata {x}%) dengan 3 sesi latihan fokus minggu ini.", "Topik '{topik}' ({x}% ketepatan) adalah titik lemah utama — buat latihan tertumpu untuk topik ini.", "{Subjek} OTR{n}: markah sebenar ({AR}) masih {gap} mata di bawah sasaran ({target}). Fokus latihan untuk kejar target.", "Mulakan perjalanan belajar kamu — setiap sesi latihan membina asas yang kukuh!" (copy OBSERVED; triggers INFERRED) | S6-111–116, 127, 208–213 | Admin | OBSERVED (copy) / INFERRED (triggers) |
| FN-M08-2.6.9 | Card "Lencana ({n})" (only when the student has badges): one icon tile per M14 badge with its name as tooltip (e.g. `fa-seedling` "Pemula Rajin", `fa-running` "Pelajar Aktif", `fa-coins` "Pengumpul") | S6-179–183 | Admin | OBSERVED |

### EP-M08-3 — Adaptive analytics

**FT-M08-3.1 — Analitik Pembelajaran (S7 `/analitik/pelajar`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M08-3.1.1 | Section "Topik Perlu Perhatian Utama (4)" (`fa-exclamation-triangle`): 4 weakest SPs across subjects (1 / `sm` 2 columns), not filtered by the tab: pill "{x}%" (red), trend icon, "{kod} — {tajuk}" cut at 70 chars + "...", "{Subjek} · {n} soalan dijawab", full-width "Latihan Fokus ({k} soalan)" (`fa-dumbbell`) → `/practice/{CODE}/quiz?level={level}&dskp_sp_id={id}&count={k}`, k = min(available, 25) in label and link (DV-M08-14) | S7-004–024 | Pelajar; Admin | OBSERVED + DV-M08-14 |
| FN-M08-3.1.2 | When the active subject has more than 4 weak SPs: "Masih ada topik lemah lain untuk subjek ini." + **{n − 4}** and a toggle "Lihat semua {n} topik lemah" (`fa-chevron-down`) / "Sembunyi senarai penuh" (`fa-chevron-up`); the open state is kept when the tab changes | S7-025–027, 105–106 | Pelajar; Admin | OBSERVED |
| FN-M08-3.1.3 | Expanded list (collapse animation, 1 / `md` 2 columns): every weak SP of the active subject, accuracy ascending: title cut at 100 chars, "{Subjek} · {n} soalan dijawab", pill "{x}%", "Latihan Fokus ({k} soalan)" (k capped at 25 in label and link, DV-M08-14) | S7-028–040 | Pelajar; Admin | OBSERVED + DV-M08-14 |
| FN-M08-3.1.4 | Subject tabs (horizontal scroll): one button per practised subject "{Subjek}" + "{x}%" (small, 75% opacity); first subject active by default; active blue-600 white shadow, inactive white slate-600 | S7-041–042 | Pelajar; Admin | OBSERVED |
| FN-M08-3.1.5 | Progress ring per subject (SVG, track #f1f5f9, arc #22c55e): centre "{mahir}" / "/ {n} SP" with n = the DSKP-map SP count of the pane (live), except when mahir > n, where n = mahir + sederhana + lemah + belum (DV-M08-13; live "8 / 2 SP"); label "Standard Dikuasai"; legend dots green-500 mahir, yellow-400 sederhana, red-500 lemah, slate-200 belum with counts | S7-043–050, 075–082 | Pelajar; Admin | OBSERVED + DV-M08-13 |
| FN-M08-3.1.6 | 4 KPIs (2 / `sm` 4): "Ketepatan" (1 decimal, red-600 <50 — other colours INFERRED), "Soalan Dijawab", "Trend 30 Hari" (icon: `fa-minus` stable observed; up/down INFERRED), "Unjuran Gred" (blue-600, "{low} – {high}", DV-M08-16) | S7-051–058, 083–090 | Pelajar; Admin | OBSERVED + DV-M08-16 |
| FN-M08-3.1.7 | Message box by accuracy band: <50 red-50 `fa-hand-holding-heart` "Jangan putus asa! Latihan konsisten akan membantu. Mulakan dengan topik yang paling lemah di bawah." (observed); other bands UNVERIFIED (L-9) | S7-059, 091 | Pelajar; Admin | OBSERVED / UNVERIFIED |
| FN-M08-3.1.8 | Card "Peta DSKP — Standard Pembelajaran" (`fa-map`): caption "{KSSR\|KSSM} {Subjek} {Darjah\|Tingkatan} n" (viewer's level), one tile per SP code with title "{kod}: {tajuk} — {status}" coloured Mahir green-100 / Sederhana yellow-100 / Lemah red-100 / Belum cuba slate-100; legend "Mahir (75%+)", "Sederhana (50-74%)", "Lemah (<50%)", "Belum Cuba", badge "Fokus" + "Klik untuk latihan fokus"; legend wraps (DV-M08-10) | S7-060–074, 092–104 | Pelajar; Admin | OBSERVED + DV-M08-10 |
| FN-M08-3.1.9 | No practised subject: page content when the viewer has no analytics (UNVERIFIED; the rebuild shows only the section heading with "(0)" and no tabs, PROPOSED — OQ-M08-08) | — | Pelajar | UNVERIFIED |

**FT-M08-3.2 — Analitik Kelas (S8 `/analitik/kelas`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M08-3.2.1 | GET filter form (auto-submit on change): "Kelas" `classroom_id` (the viewer's **own** classes, as S5/S14; the admin owns none → 0 options, as live, also when `classroom_id` is given), "Mata Pelajaran" `subject_id` (the class's subjects, first selected by default), "Risiko" `risk_level` "Semua Risiko" / "Kritikal" / "Tinggi" / "Sederhana" / "Rendah"; filters kept in the URL; the page is reached by URL only (no live link) | S8-004–010 | Guru INFERRED; Admin | OBSERVED |
| FN-M08-3.2.2 | No class (or no data): `fa-chart-line` "Tiada data analitik untuk kelas dan subjek ini." | S8-044 | Guru; Admin | OBSERVED |
| FN-M08-3.2.3 | 4 cards: "Jumlah Pelajar" (slate-700), "Purata Ketepatan" (blue-600, 1 decimal), "Pelajar Berisiko" (green-600 when 0; = critical + high, INFERRED), "Prestasi Baik" (emerald-600; = low, INFERRED); counts follow the risk filter as live | S8-011–022, 045–046 | Guru; Admin | OBSERVED / INFERRED |
| FN-M08-3.2.4 | Table "Senarai Pelajar" (headers upper case by CSS): # · Pelajar (link + `fa-arrow-up-right-from-square`) · Ketepatan · Soalan · Trend · Unjuran ("{low} – {high}", DV-M08-16) · Risiko badge (Sederhana amber, Rendah green observed; Tinggi orange, Kritikal red INFERRED, L-10) · Tindakan "Lihat Analitik" (`fa-chart-line`); for the admin both links → `/prestasi/{userId}` (DV-M08-04; live 403); for a teacher the live target is unobserved (L-3) and the rebuild uses the same target (INFERRED, provisional) | S8-023–043, 047–048 | Guru; Admin | OBSERVED + DV-M08-04/16 |

### EP-M08-4 — Item analysis

**FT-M08-4.1 — Analisa Item Sekolah (S9 `/analisa-item/sekolah[/{id}]`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M08-4.1.1 | Breadcrumb "Papan Pemuka" (`fa-arrow-left`) → `/dashboard` / "Analisa Item Sekolah"; tab "Analisa Item Sekolah \| PRESTASIPLUS" | S9-004–006 | Admin | OBSERVED |
| FN-M08-4.1.2 | School card (gradient): icon tile, h2 school name, the school code when it has one (e.g. "JEB2037", S30 template), type pill (e.g. "SK"), "PPD {ppd} • {negeri}", counters "{n} Pelajar", "{n} Jawapan" (BR-M08-17) | S9-007–014 | Admin | OBSERVED |
| FN-M08-4.1.3 | "Tingkatan:" (`fa-graduation-cap`) chips "Semua" / "Tingkatan 4" / "Tingkatan 5" → `?tingkatan=T4\|T5`; active indigo-600 white; header subtitle appends " — Tingkatan n" | S9-015–018 | Admin | OBSERVED |
| FN-M08-4.1.4 | Empty: `fa-users-slash` h3 "Tiada Data Pelajar" / "Tiada data pelajar untuk sekolah ini. Pastikan pelajar telah berdaftar dan menjawab soalan latihan." | S9-019–021 | Admin | OBSERVED |
| FN-M08-4.1.5 | Populated view (the observed S30 template, M18 FN-M18-5.3.3): cards "Jumlah Pelajar", "Soalan Dijawab" (separator), "Ketepatan Keseluruhan" (1 decimal) — 8880 "59", "10,194", "71.7%"; `?tingkatan=T4` "76.3%" (BR-M08-17) | — | Admin; officers | OBSERVED (M18 S30 template) |
| FN-M08-4.1.6 | Card "Profil Kesukaran": stacked bar with tooltips "Mudah: {n}", "Sederhana: {n}", "Sukar: {n}" and the counts under "Mudah" "Sederhana" "Sukar" = the listed question cards by label (8880 0 / 0 / 20; 8765 5 / 0 / 1); "Tiada data" without cards | — | Admin; officers | OBSERVED (M18 S30 template) |
| FN-M08-4.1.7 | Card "GPS Anggaran Sekolah": "{gps}" with the band pill (BR-M08-03), "Berdasarkan {n} entri headcount • Lebih rendah = lebih baik", year sparkline (labels "22" … "26", tooltips "{yyyy}: {gps}") and "Prestasi 360" (`fa-chart-pie`) → `/sekolah/{id}/prestasi` (M18 S27) — scoped to the school (DV-M08-31: 8880 "2.49" "Baik" "Berdasarkan 148 entri headcount"; live shows the platform 3.45 / 744) | — | Admin; officers | OBSERVED (M18 S30 template) + DV-M08-31 |
| FN-M08-4.1.8 | Card "Prestasi Mengikut Subjek" "Ringkasan ketepatan dan jawapan salah bagi setiap subjek": table "Subjek" · "Pelajar" · "Soalan" (distinct questions) · "Ketepatan" · "Salah" (wrong answers), accuracy ascending (8880: Sains 29 · 1,094 · 70.9% · 539 … Matematik 31 · 817 · 72.4% · 614) | — | Admin; officers | OBSERVED (M18 S30 template) |
| FN-M08-4.1.9 | Card "Soalan Paling Banyak Salah — Perlu Perhatian Khas" "Soalan yang majoriti pelajar jawab salah. Fokuskan pengajaran khas di sini.": "Tapis:" (`fa-filter`) pills "Semua ({n})", "{Subjek} ({n})" filtering client-side; question cards from the stored item-statistics set (DATA-M08-11): icon and label by % salah with the BR-M08-18 cut-offs (`fa-frown` "Sukar", `fa-meh` "Sederhana", `fa-smile` "Mudah"), rank, stem, chips, "{p}% salah", "{n} pelajar cuba", "{p}% pelajar terlibat", "{n} pelajar salah — klik untuk lihat" (omitted when none); a click toggles "Jawapan Betul", "Jawapan Salah Paling Popular ({n}x dipilih)" and the "Pelajar Yang Salah" chips (`fa-user`) → `/prestasi/{userId}` | — | Admin; officers | OBSERVED (M18 S30 template) / INFERRED (cut-offs) |
| FN-M08-4.1.10 | Route `/analisa-item/sekolah/{id}` (the same template for any school; linked from M18 S25/S26): a school with pupils but no answers shows "Soalan Dijawab" 0, "Ketepatan Keseluruhan" "0.0%", "Profil Kesukaran" "Tiada data", an empty subject table and no cards; an id without pupils shows `fa-users-slash` "Tiada Data Pelajar" / "Tiada data pelajar untuk sekolah ini. Pastikan pelajar telah berdaftar dan menjawab soalan." (the live copy of that route; the own-school route keeps FN-M08-4.1.4); access: admin any school, PPD / JPN officers the schools of their scope, other roles their own school, else the 403 page | — | Admin; officers; school staff | OBSERVED (M18 S30 template) / INFERRED (access) |

**FT-M08-4.2 — Pilih Kelas untuk Analisis (S10 `/analisa-item/kelas`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M08-4.2.1 | Breadcrumb "Papan Pemuka" → `/dashboard`; tile `fa-chalkboard-teacher`, h2 "Pilih Kelas untuk Analisis", "Klik mana-mana kelas untuk melihat analisa item"; tab "Analisa Item — Papan Guru \| PRESTASIPLUS" | S10-004–007 | Admin; Guru INFERRED | OBSERVED |
| FN-M08-4.2.2 | Class cards (1 / `sm` 2 / `lg` 3), newest-created first with classes created together in id order (INFERRED; OBSERVED first rows 1156, 1155, 1154 and ascending blocks), not paginated, each → `/analisa-item/kelas/{id}`: subject-colour tint, icon tile, h3 class name, subject, green dot `title="Aktif"`, "{n} pelajar" (`fa-users`), year (`fa-calendar`), join code, "Lihat Analisa" (`fa-arrow-right`); admin sees every class, a teacher own classes (INFERRED) | S10-008–013 | Admin; Guru INFERRED | OBSERVED / INFERRED (order rule) |

**FT-M08-4.3 — Analisa Item — Papan Guru (S11 `/analisa-item/kelas/{id}`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M08-4.3.1 | Breadcrumb "Papan Pemuka" → `/dashboard` / "Pilih Kelas" → `/analisa-item/kelas` / class name | S11-004–008, 064 | Admin; Guru | OBSERVED |
| FN-M08-4.3.2 | Class card: h2 class name, "{Subjek} • {level slug, e.g. tingkatan-5} • Tahun {tahun}" (raw slug as live), counters "{n} Pelajar", "{n} Soalan Diuji" | S11-009–015, 065–067 | Admin; Guru | OBSERVED |
| FN-M08-4.3.3 | 3 summary cards (3 columns at every width; labels upper case by CSS): "Mudah" / "Sederhana" / "Sukar" count + "{p}% daripada soalan" (hidden when 0 questions) | S11-016–027 | Admin; Guru | OBSERVED |
| FN-M08-4.3.4 | Tabs "Indeks Kesukaran" (`fa-chart-bar`) and "Indeks Diskriminasi" (`fa-filter`), each with a count badge; active indigo underline bold, inactive slate-500; default Kesukaran | S11-028–031, 068–069 | Admin; Guru | OBSERVED |
| FN-M08-4.3.5 | Difficulty tab search "Cari soalan..." and sort select "Paling Sukar Dahulu" (default) / "Paling Mudah Dahulu" / "Ketepatan Rendah Dahulu" / "Ketepatan Tinggi Dahulu" / "Paling Banyak Percubaan" — bound to the rows in the rebuild (DV-M08-17; live has no effect); hidden on the discrimination tab (OBSERVED) | S11-032–033 | Admin; Guru | OBSERVED + DV-M08-17 |
| FN-M08-4.3.6 | Difficulty table # · Soalan (2-line clamp; below `sm` + "{Subjek} — {Topik} — {Subtopik}"; `fa-users` "{n} pelajar salah"; chevron) · Subjek / Topik (hidden below `sm`) · Percubaan ("{a}" + "{s} pelajar") · Ketepatan (1 decimal; red <40, amber 40–74.9, green ≥75) · Indeks (1 − p, 2 decimals, mono) · Tahap pill "Sukar" (`fa-frown` #FEE2E2/#991B1B), "Sederhana" (`fa-meh` #FEF3C7/#92400E), "Mudah" (`fa-smile` #DCFCE7/#166534) (all OBSERVED; cuts 0.30/0.70 INFERRED); headers upper case by CSS; default order difficulty descending; no pagination | S11-034–036, 039, 042 | Admin; Guru | OBSERVED / INFERRED (cuts) |
| FN-M08-4.3.7 | Row click toggles the expanded row (pink background): "Jawapan Betul" (green letter tile + option text), "Jawapan Salah Popular ({n}x dipilih)" (amber), "Pelajar Yang Salah" (`fa-exclamation-triangle`) chips name + "{n}x salah" → `/prestasi/{userId}` | S11-037–038, 040–041, 043 | Admin; Guru | OBSERVED |
| FN-M08-4.3.8 | Difficulty empty: `fa-inbox` "Tiada Data Lagi" / "Pelajar dalam kelas ini belum menjawab sebarang soalan lagi." | S11-070–072 | Admin; Guru | OBSERVED |
| FN-M08-4.3.9 | Discrimination guide "Panduan Indeks Diskriminasi" (`fa-info-circle`): chips "≥ 0.40 = Sangat Baik", "0.30 – 0.39 = Baik", "0.20 – 0.29 = Sederhana", "< 0.20 = Lemah"; text "Indeks dikira berdasarkan perbezaan prestasi antara **27% pelajar terbaik** dan **27% pelajar bawah** dengan menggunakan semua sesi latihan." | S11-044–056 | Admin; Guru | OBSERVED |
| FN-M08-4.3.10 | Discrimination table # · Soalan · Kumpulan Atas ("{x}%" green-700 + "betul") · Kumpulan Bawah (red-700) · Indeks (3 decimals; green ≥0.30, amber 0.20–0.29, red <0.20) · Status pill (headers upper case by CSS); D = p(top 27%) − p(bottom 27%); index descending, no control | S11-057–058 | Admin; Guru | OBSERVED |
| FN-M08-4.3.11 | Fewer than 4 students with finished sessions: `fa-chart-line` "Data Tidak Mencukupi" / "Perlu sekurang-kurangnya 4 pelajar dengan sesi latihan selesai untuk mengira indeks diskriminasi." | S11-073–075 | Admin; Guru | OBSERVED |
| FN-M08-4.3.12 | Box "Tukar Kelas": one chip per class the viewer may open, in the S10 order (current class indigo gradient white, others white bordered) → `/analisa-item/kelas/{id}` | S11-059–063 | Admin; Guru | OBSERVED |

### EP-M08-5 — Headcount (TOV → OTR → ETR target tracking)

**FT-M08-5.1 — Headcount list (S12 `/headcount`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M08-5.1.1 | Gradient hero: h1 "Headcount" (`fa-chart-line`), "Tracking prestasi murid — TOV, OTR, AR & RS"; buttons "Dashboard" (`fa-tachometer-alt`) → `/headcount/dashboard`, "Buat Baru" (`fa-plus`) → `/headcount/create`, "Auto-Setup" (`fa-magic`, emerald) opens the modal with the selection reset; text ≥12px (DV-M08-18) | S12-004–008 | Guru INFERRED; Admin | OBSERVED + DV-M08-18 |
| FN-M08-5.1.2 | Empty: `fa-clipboard-list` "Belum ada headcount." + "Buat Sekarang" (`fa-plus`) → `/headcount/create` | S12-009–011 | Admin (OBSERVED) | OBSERVED |
| FN-M08-5.1.3 | Auto-Setup modal: backdrop (black/50; click closes), card (emerald icon, h3 "Auto-Setup Headcount", "Pilih tingkatan untuk auto-cipta headcount"), fade/scale transition; Esc closes; "Batal" only hides (ticks kept); reopening via "Auto-Setup" clears them; full width at 375 with the two buttons side by side | S12-012–015, 040 | Guru; Admin | OBSERVED |
| FN-M08-5.1.4 | Auto-Setup form `POST /headcount/auto-setup`: "Darjah" grid (3 columns) D1–D6 (`levels[]` 1…6, checked amber) and "Tingkatan" grid T1–T5 (`levels[]` T1…T5, checked blue) checkbox labels; hidden `_token` (live CSRF; not rendered by the SPA) | S12-016–039 | Guru; Admin | OBSERVED |
| FN-M08-5.1.5 | Submit "Auto-Setup" (`fa-magic`): disabled grey (`cursor-not-allowed`) with 0 ticks; emerald with "({n})" when n > 0 | S12-041–042 | Guru; Admin | OBSERVED |
| FN-M08-5.1.6 | Auto-Setup result (server creates headcount configs per ticked level) — UNVERIFIED (L-4): the rebuild creates one config per (own class of that level × class subject × current year) and returns to S12; no message (PROPOSED — OQ-M08-03) | — | Guru | UNVERIFIED (L-4) |
| FN-M08-5.1.7 | Populated list with a level filter (`filterLevel`) — UNVERIFIED (L-4): the rebuild lists one card per config (class, subject, level, year, mode, "{n} OTR") linking to its S23 page `/headcount/{id}`, PROPOSED — OQ-M08-03 | — | Guru | UNVERIFIED (L-4) |

**FT-M08-5.2 — Dashboard Headcount (S13 `/headcount/dashboard`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M08-5.2.1 | Hero h1 "Dashboard Headcount" (`fa-tachometer-alt`), "Ringkasan prestasi semua kelas anda", "Senarai Penuh" (`fa-list`) → `/headcount` | S13-004–006 | Guru; Admin | OBSERVED |
| FN-M08-5.2.2 | "Tapis:" (`fa-filter`) buttons "Semua ({n})" + one per distinct config level (sorted); active blue-600 white, inactive slate-100 (level labels UNVERIFIED, L-4) | S13-007–010 | Guru; Admin | OBSERVED / UNVERIFIED (labels) |
| FN-M08-5.2.3 | 4 cards "Konfigurasi" (filtered count, blue-600), "Jumlah Murid" (follows the filter, DV-M08-11), "On Track" (emerald-600), "Off Track" (red-500) | S13-011–022 | Guru; Admin | OBSERVED + DV-M08-11 |
| FN-M08-5.2.4 | When tracked > 0: "Keseluruhan On-Track" "{onPct}%" (≥70 emerald, ≥50 amber, else red), stacked bar on/off, legend "On Track:", "Off Track:", "Tiada Data:" | S13-023–031 | Guru | SOURCE-DERIVED |
| FN-M08-5.2.5 | Empty: "Belum ada headcount."; per-config chart stub ("Sasaran" / "Sebenar (AR)") drawn per config (SOURCE-DERIVED) | S13-032 | Admin (OBSERVED) | OBSERVED / SOURCE-DERIVED |

**FT-M08-5.3 — Buat Headcount Baru (S14 `/headcount/create`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M08-5.3.1 | Back link (`fa-arrow-left`) → `/headcount`; h1 "Buat Headcount Baru" | S14-004–005 | Guru; Admin | OBSERVED |
| FN-M08-5.3.2 | Form `POST /headcount`: "Pilih Kelas" `classroom_id` required ("— Pilih kelas —" + own classes), "Pilih Subjek" `subject_id` required ("— Pilih subjek —" + 31 subjects "Name (CODE)" A–Z), "Tingkatan" `education_level_id` required ("— Pilih tingkatan —", 10 "Tingkatan 4", 11 "Tingkatan 5"), "Tahun Akademik" `academic_year` number required (value = current year, min 2020, max 2100); hidden `_token` not rendered | S14-006–015 | Guru; Admin | OBSERVED |
| FN-M08-5.3.3 | "Bilangan OTR" radios `active_otrs` "2 OTR" / "3 OTR" (checked) / "4 OTR" / "5 OTR"; hint "Minimum 2 OTR · Default 3 OTR · Boleh tukar 2/3/4/5 ikut keperluan kelas." | S14-016–025 | Guru; Admin | OBSERVED |
| FN-M08-5.3.4 | "Mod Pengiraan Markah" radio cards `mode`: "🤖 Auto — Markah dikira automatik dari soalan latih tubi SPM + Tracking A pelajar di platform PrestasiPlus." (checked) / "✍️ Manual — Cikgu key-in markah pelajar sendiri (cth: dari peperiksaan formal sekolah)."; selected card blue border/bg; hint "Boleh ada 1 Auto + 1 Manual untuk kelas + subjek + tahun yang sama."; no field resets another | S14-026–031 | Guru; Admin | OBSERVED |
| FN-M08-5.3.5 | Submit "Cipta Headcount" (`fa-plus`, full width); native `required` bubbles only (no `novalidate`); with no class available submit can never pass | S14-032 | Guru; Admin | OBSERVED |
| FN-M08-5.3.6 | Create result and server errors (duplicate mode for class + subject + year) — UNVERIFIED (L-4); rebuild redirects to S12 on success; duplicate → error PROPOSED COPY (OQ-M08-03) | — | Guru | UNVERIFIED (L-4) |

**FT-M08-5.4 — Headcount — Prestasi Individu (S15 `/headcount/student/{id}`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M08-5.4.1 | Back `history.back()`; h1 name (`fa-user-graduate`); "Headcount — Prestasi Individu · {sekolah}"; tab "Headcount {nama} - PRESTASIPLUS" | S15-004–007 | Guru; Admin | OBSERVED |
| FN-M08-5.4.2 | One section per headcount config (config id ascending, INFERRED): card, h2 subject; chips school (`fa-school`), level (`fa-layer-group`), class (`fa-users`), year | S15 by rule (see §6: section) | Guru; Admin | OBSERVED |
| FN-M08-5.4.3 | Status pill "On Track" (`bg-green-100 text-green-700`) / "Below Target" (`bg-red-100 text-red-700`) / "Belum Ada Data" (`bg-slate-100 text-slate-500`, no OTR target) by the latest checkpoint with an AR vs its target; RS badge (`fa-star text-yellow-300`) "RS: x% (G)"; chips "TOV: x% (G)" (amber) · "ETR: x% (G)\|—" (purple) · "RS: x% (G)" (indigo-50/200, label indigo-600, value indigo-700); "Unjuran: x% (G)" (`fa-arrow-trend-up`; green-50/200/700, amber-50/200 or red-50 variant); trend chip "Meningkat" (`fa-arrow-up`, green-50) / "Stabil" (`fa-minus`, amber-50) / "Menurun" (`fa-arrow-down`, red-50); "Keyakinan: Tinggi" (green-600) / "Sederhana" (amber-600) / "Rendah" (slate-400) (all OBSERVED; rules INFERRED) | S15 by rule (see §6: status) | Guru; Admin | OBSERVED / INFERRED (rules) |
| FN-M08-5.4.4 | Chart per config (Chart.js line, 200px): labels TOV, OTR1…n, ETR, plus "RS" when an RS value exists (OBSERVED; DV-M08-09 withdrawn); datasets "Target (OTR)", "Markah Sebenar (AR)" (segment green ≥ target, red below, grey missing), "Unjuran (Trend)", "RS (SPM Sebenar)" star point | — | Guru; Admin | OBSERVED |
| FN-M08-5.4.5 | Table Checkpoint · Target (%) · Gred Target · AR (%) · Gred AR · Status: rows OTR1…n — target blue-700 + pill `bg-blue-100 text-blue-600` or "—"/"-"; AR ≥ target: row `bg-green-50`, AR green-700, Gred AR green-100/700, status `fa-check-circle text-green-500`; AR < target: row `bg-red-100 border-l-4 border-l-red-400`, AR red-700, pill red-100/700, status `fa-arrow-down text-red-500`; no AR: "—" slate-400, status "—" slate-300; AR without target: AR slate-400, Gred AR pill slate (DV-M08-21; live red), status "—"; then "ETR (Sasaran Akhir)" (purple, "Sasaran akhir") and "RS (SPM Sebenar)" (`fa-star text-yellow-500`, `bg-indigo-50 border-l-4 border-l-indigo-400`, value indigo-700, pill indigo-200/800, last cell "Direkod: {d MMM yyyy}" or empty) | S15 by rule (see §6: table) | Guru; Admin | OBSERVED + DV-M08-21 |
| FN-M08-5.4.6 | Box "Ketepatan Ramalan ETR vs RS" (when ETR and RS exist): "ETR (Ramalan): x% (G)" (purple-700), "RS (Sebenar): x% (G)" (indigo-700), "Selisih: {±d} markah", verdict by abs(RS − ETR): ≤5 "Ramalan Tepat" (green box, `fa-check-circle`, note "Ramalan ETR sangat tepat — selisih dalam lingkungan ±5 markah."), ≤10 "Hampir Tepat" (amber, `fa-exclamation-circle`, "Ramalan ETR agak tepat — selisih dalam lingkungan ±10 markah. Boleh diperbaiki lagi."), >10 "Selisih Besar" (red, `fa-times-circle`, "Selisih melebihi 10 markah. Semak semula kaedah penetapan ETR.") | S15 by rule (see §6: box) | Guru; Admin | OBSERVED |

**FT-M08-5.5 — Ringkasan Kelas (S22 `/headcount/{id}/summary`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M08-5.5.1 | Back (`fa-arrow-left`) → `/headcount/{id}`; h1 "Ringkasan Kelas" (`fa-chart-bar`); "{Subjek} · {kelas} · {Tingkatan n} · {tahun}"; tab "Ringkasan Kelas - PRESTASIPLUS" | S22-004–006 | Guru INFERRED; Admin | OBSERVED |
| FN-M08-5.5.2 | 4 cards (2 / `lg` 4): "{n}" "Jumlah Murid" (blue-700), "{x}" "Purata TOV (%)" (amber-700), "{x}" "Purata ETR (%)" (purple-700), "{n}" "OTR Aktif" | S22-007–018 | Guru; Admin | OBSERVED |
| FN-M08-5.5.3 | "Taburan Prestasi Per OTR": per checkpoint h3 "OTR{n}", "Above: n" (green-600, `fa-arrow-up`), "On Track: n" (blue-600, `fa-check`), "Below: n" (red-600, `fa-arrow-down`), "N/A: n" (slate-400) and a stacked bar green-500 / blue-500 / red-500 / slate-300 with `title` "{label}: n"; rule: Above = AR > OTR; On Track = OTR − 2 ≤ AR ≤ OTR; Below = AR < OTR − 2 (OBSERVED fit: the live gap +2 counts as Above, the gaps 0 and −2 as On Track → 5 / 2 / 8; the exact upper edge lies between "> OTR" and "≥ OTR + 2", INFERRED); N/A = no AR | S22-019–040 | Guru; Admin | OBSERVED / INFERRED (bounds) |
| FN-M08-5.5.4 | Legend "Above Target", "On Track (±2%)", "Below Target", "Belum Diisi" | S22-041–044 | Guru; Admin | OBSERVED |
| FN-M08-5.5.5 | "Lihat Table Penuh" (`fa-table`, blue-600) → `/headcount/{id}`; "Export CSV" (`fa-download`) → `/headcount/{id}/export` (download; content UNVERIFIED, L-12; provisional) | S22-045–046 | Guru; Admin | OBSERVED / UNVERIFIED (export) |

**FT-M08-5.6 — Headcount table (S23 `/headcount/{id}`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M08-5.6.1 | Back → `/headcount`; h1 subject; "{kelas} · {Tingkatan n} · {tahun} · Guru: {nama}"; status pill "Active" (green-100/700); tab "Headcount {Subjek} - PRESTASIPLUS" | S23-004–007 | Guru INFERRED; Admin | OBSERVED |
| FN-M08-5.6.2 | Chips "On Track: {n} ({p}%)" (`fa-check-circle`, green-50/200/700), "Below: {n} ({p}%)" (`fa-arrow-down`, red), "Belum Diisi: {n}" (`fa-minus-circle`, slate), "Jumlah: {n}" (`fa-users`, blue); status per student at the latest checkpoint with an AR by the "On Track (±2%)" rule (AR ≥ OTR − 2; DV-M08-29; live AR ≥ OTR, 6/9) | S23-008–011 | Guru; Admin | OBSERVED + DV-M08-29 |
| FN-M08-5.6.3 | Actions: "Key-in AR" (`fa-pen`, emerald) dropdown with "OTR1"…"OTR{n}" → `/headcount/{id}/results/{n}`; "Edit TOV/ETR" (`fa-edit`, amber) → `/edit`; "Export CSV" (`fa-download`) → `/export`; "Ringkasan Kelas" (`fa-chart-bar`) → `/summary`; "Unjuran" (`fa-arrow-trend-up`, amber-50) → `/unjuran`; "Tetapan" (`fa-cog`) → `/settings` (the target pages are not observed, L-12) | S23-012–020 | Guru; Admin | OBSERVED |
| FN-M08-5.6.4 | "Reset Data" (`fa-rotate-left`, orange-50) opens the modal: h3 "Reset Semua Data?", "Semua markah murid akan dikosongkan — **TOV, ETR, OTR, AR & RS**.", green box "Yang kekal selamat:" · "Senarai murid (tidak dipadam)" · "Tetapan headcount (subjek, kelas, tahun)", "Batal" (hides) and "Ya, Reset" (`POST /headcount/{id}/reset-ar`, not submitted — result UNVERIFIED, L-12); backdrop closes | S23-021, 023–030 | Guru; Admin | OBSERVED / UNVERIFIED (result) |
| FN-M08-5.6.5 | "Padam" (`fa-trash`, red-50) opens the modal: h3 "Padam Headcount?", "Anda pasti mahu padam headcount **{Subjek}** ({kelas}, {tahun})?", "Semua data murid, TOV, ETR, OTR, AR & RS akan dipadam secara kekal.", "Batal" and "Ya, Padam" (`DELETE /headcount/{id}`, not submitted — result UNVERIFIED, L-12) | S23-022, 031–039 | Guru; Admin | OBSERVED / UNVERIFIED (result) |
| FN-M08-5.6.6 | "Susun:" (`fa-sort`) links "Ranking" (`fa-trophy`, `?sort=ranking`, default, active blue-600) and "A-Z" (`fa-sort-alpha-down`, `?sort=name`) | S23-040–042 | Guru; Admin | OBSERVED |
| FN-M08-5.6.7 | Table: select-all checkbox · # · Nama (→ `/headcount/student/{id}`) · TOV · OTR1 · AR1 · … · OTR{n} · AR{n} · ETR, each value with "%" and "Gred" sub-headers; TOV amber-50/700 (pill amber-100), OTR blue, AR slate, AR cell green-100/700 (pill green-200) when on track by the ±2% rule (DV-M08-29) and red-100 when below, ETR purple; last row "Purata Kelas" (averages with grades) | S23-053–060 | Guru; Admin | OBSERVED + DV-M08-29 |
| FN-M08-5.6.8 | Row selection: ticking rows shows the orange bar "{n} murid dipilih" (`fa-check-square`) with "Gugurkan" (`fa-user-slash`) and "Kembalikan" (`fa-user-check`) (`POST /headcount/{id}/drop-students` `action`, `student_ids[]`; not submitted — result UNVERIFIED, L-12) and "Batal" (`fa-times`, clears the selection) | S23-043–052, 061–062 | Guru; Admin | OBSERVED / UNVERIFIED (result) |
| FN-M08-5.6.9 | Linked pages `/headcount/{id}/results/{n}` (Key-in AR), `/edit`, `/unjuran`, `/settings`, `/export` and the reset / delete / drop results: not observed (L-12); routes exist, UI not specified — provisional | — | Guru; Admin | UNVERIFIED (L-12) |

### EP-M08-6 — Timeline and public profile

**FT-M08-6.1 — Timeline Saya (S16 `/timeline`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M08-6.1.1 | h2 "📸 Timeline Saya", "Kongsi sijil, pencapaian, aktiviti & cerita anda", button "Tambah Post" (`fa-plus`, indigo→purple) → `/timeline/create` | S16-004–006 | All roles (own) | OBSERVED |
| FN-M08-6.1.2 | Empty: circle `fa-images`, h3 "Timeline Kosong", "Mula kongsi pencapaian, sijil, dan cerita anda untuk ditunjukkan pada profil awam anda!", "Tambah Post Pertama" → `/timeline/create` | S16-007–009 | All | OBSERVED |
| FN-M08-6.1.3 | Box "Profil Awam Anda" (`fa-globe`): link to the viewer's own `https://…/pelajar/{ownId}` (new tab; DV-M08-19 — live uses a wrong id) and copy button: writes the URL to the clipboard, swaps `fa-copy` → `fa-check` for 2 s | S16-010–012 | All | OBSERVED + DV-M08-19 |
| FN-M08-6.1.4 | Post cards when posts exist — UNVERIFIED (L-5): category, title, date, story, photos (from S17 fields); rebuild renders them newest first, PROPOSED layout (OQ-M08-02) | — | All | UNVERIFIED (L-5) |

**FT-M08-6.2 — Post Baru (S17 `/timeline/create`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M08-6.2.1 | "Kembali ke Timeline" (`fa-arrow-left`) → `/timeline`; card h2 "📸 Post Baru"; tab "Tambah Post - Timeline" | S17-004–006 | All | OBSERVED |
| FN-M08-6.2.2 | Form `POST /timeline` (multipart): "Tajuk *" `title` required, maxlength 150, placeholder "cth: Sijil Kecemerlangan Matematik 2026"; "Kategori *" `category` required "🏆 Sijil" / "🥇 Pencapaian" / "🏃 Aktiviti" / "✍️ Cerita" (selected) / "⭐ Lain-lain"; "Tarikh Acara" `event_date` date optional; "Cerita / Keterangan" `story` maxlength 2000, placeholder "Ceritakan pengalaman anda...", hint "Maks 2000 aksara"; Kategori + Tarikh 2 columns from `sm`; hidden `_token` not rendered | S17-007–017 | All | OBSERVED |
| FN-M08-6.2.3 | "Gambar * (Maks 5 gambar, 2MB setiap satu)": drop zone "Klik atau seret gambar ke sini" / "JPG, PNG, WEBP • Maks 2MB • 1-5 gambar", file input (accept jpeg/png/webp, multiple, no `required`); adds up to 5 files, a file over 2 MB → `alert("{nama} terlalu besar (maks 2MB)")`, files after the 5th silently dropped; previews (`<img alt="Preview">`) with remove (`fa-times`); "Keterangan Gambar (opsional)" (`fa-tag`) caption inputs `captions[i]` "Keterangan gambar {i+1}..." maxlength 200; typed captions are **kept** when photos are added or removed (DV-M08-30; live clears them all) | S17-018–021, 024–031 | All | OBSERVED / SOURCE-DERIVED + DV-M08-30 |
| FN-M08-6.2.4 | Buttons "Batal" (link → `/timeline`, discards the unsent form) and "Terbitkan" (`fa-paper-plane`, gradient); side by side at every width | S17-022–023 | All | OBSERVED |
| FN-M08-6.2.5 | Submit result — UNVERIFIED (L-5): server requires 1–5 photos (INFERRED); rebuild redirects to S16 with the new post; no-photo error PROPOSED COPY (OQ-M08-02) | — | All | UNVERIFIED (L-5) |

**FT-M08-6.3 — Public student profile (S18 `/pelajar/{id}`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M08-6.3.1 | Standalone layout (no shell; **public**: 200 without a session, OBSERVED). Top bar: logo "PRESTASIPLUS" (`fa-graduation-cap`) → `/`; "Kongsi" (`fa-share-alt`): `navigator.share({title, url})` or clipboard + `alert("Link disalin!")`; "Utama" (`fa-home`, label from `sm`) → `/` | S18-001–003 | Public | OBSERVED |
| FN-M08-6.3.2 | Cover (decorative) with `lg` chips "Pelajar PRESTASIPLUS" and "{n} hari bersama" (`fa-clock`) | S18-004–005 | Public | OBSERVED |
| FN-M08-6.3.3 | Profile card: avatar with tier emoji badge, h1 name + tier pill "🥉 Bronze", "Pelajar PRESTASIPLUS", chips school, level (public-profile level field, e.g. "Darjah 6" for the admin, separate from the M01 account grade 4 — both OBSERVED), "Ahli sejak {d MMMM yyyy}"; coin card "🪙 Syiling {n}" (M14 `currentSyiling`), mini cards "{n} 🔥 Kombo" (M14 `streak.get`), "{x}% 🎯 Tepat"; mini labels ≥12px (DV-M08-18) | S18-006–024 | Public | OBSERVED + DV-M08-18 |
| FN-M08-6.3.4 | Tier card "🥉 Bronze · Tahap 1", progress bar, "{n} syiling lagi ke Silver" (M14 tiers over `currentSyiling`) | S18-025–029 | Public | OBSERVED |
| FN-M08-6.3.5 | "Ringkasan Aktiviti" (`fa-chart-bar`): "{n} sesi latihan", "{n} hari berlatih", "{n} jawapan betul", "{n} kombo terpanjang" | S18-030–035 | Public | OBSERVED |
| FN-M08-6.3.6 | 4 stat cards "🪙 Syiling", "🔥 Kombo Hari", "📚 Sesi Latihan", "🎯 Ketepatan" | S18-036–051 | Public | OBSERVED |
| FN-M08-6.3.7 | Sponsor CTA h3 "Ingin menyokong pelajar ini?", "Jadilah penaja "Anak Angkat" dan bantu pelajar cemerlang!", "Jadi Penaja" (`fa-heart`) → `/sponsor/register` (M21) | S18-052–054 | Public | OBSERVED |
| FN-M08-6.3.8 | Footer "Teruskan usaha {nama pertama}!" / "Setiap latihan membawa kejayaan ⭐", "— Platform Latih Tubi Interaktif Malaysia", "PRESTASIPLUS" → `/` | S18-055–059 | Public | OBSERVED |
| FN-M08-6.3.9 | Sections fade in when 10% visible (IntersectionObserver adds `.visible` to `.reveal`); timeline posts shown on the profile when they exist (INFERRED, L-5) | — | Public | SOURCE-DERIVED / INFERRED |

### EP-M08-7 — Ranking and leaderboard

**FT-M08-7.1 — Kedudukan (S19 `/ranking`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M08-7.1.1 | Hero (blue→indigo→purple, `fa-trophy`) h1 "Kedudukan", subtitle and tab title "Kedudukan {x}": live shows the negeri name on the negeri scope with `negeri` set and "Nasional" in every other case (OBSERVED, incl. daerah + negeri); rebuild x = the active scope label, or the negeri name on the negeri scope (DV-M08-22) | S19-004–005, 047 | All | OBSERVED + DV-M08-22 |
| FN-M08-7.1.2 | Scope pills (horizontal scroll row): "Nasional" (`fa-globe-asia`), "Negeri" (`fa-map-marked-alt`), "Daerah" (`fa-map-pin`), "Sekolah" (`fa-school`) → `?{current filters}&scope=…`; active indigo-600 white; unknown scope → treated as nasional, no pill active | S19-006–009, 048–055, 061–064 | All | OBSERVED |
| FN-M08-7.1.3 | GET form with hidden `scope`; selects auto-submit: "Subjek" `subject_id` ("Semua Subjek" + 31 subjects A–Z), "Tingkatan" `tingkatan` ("Semua" / T4 / T5), "Negeri" `negeri` ("Pilih Negeri" + the states that have ranked students) on the negeri and daerah scopes (replicated, DV-M08-23) | S19-010–017 | All | OBSERVED |
| FN-M08-7.1.4 | Empty: "🏆" "Tiada data kedudukan" / "Mula menjawab soalan untuk muncul di papan kedudukan!" / "Mula Latihan" → `/practice` | S19-018–021 | All | OBSERVED |
| FN-M08-7.1.5 | Ranking list (12-column grid) header # · Pelajar · Tahap · Betul · Tepat; rank 🥇 🥈 🥉 then numbers; name + school (truncate); level badge "L{n}"; Betul (thousands separator); Tepat (2 decimals + "%", green-600 ≥50, red-500 <50 INFERRED); footer "Menunjukkan {n} dari {n} pelajar" (`bg-gray-50 text-xs text-gray-400`) **on the nasional scope only** (OBSERVED); order ascending by Betul (OBSERVED in three data states; INFERRED rule, OQ-M08-09) | S19-022–046, 056–060 | All | OBSERVED / INFERRED (order rule) |

**FT-M08-7.2 — Papan Pendahulu (S20 `/leaderboard`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M08-7.2.1 | Hero "🏆", h2 "Papan Pendahulu", "Siapa juara minggu ini?" (does not change with the period), decorative 🏅 ⭐; tab "Papan Pendahulu - PRESTASIPLUS" | S20-004–008 | All | OBSERVED |
| FN-M08-7.2.2 | Period links "Semua Masa" (`fa-infinity`) `?period=all`, "Minggu Ini" (`fa-calendar-week`) `?period=week`, "Bulan Ini" (`fa-calendar-alt`) `?period=month`; no or unknown `period` → Minggu Ini active | S20-009–011 | All | OBSERVED |
| FN-M08-7.2.3 | Card "Kedudukan Anda" (`fa-user-circle`): "#{rank}" or "#-" (indigo-600) "Ranking", Koin (amber-600), Sesi (blue-600), Ketepatan (green-600, rounded %); unranked in the period → "#-", 0, 0, 0%; own rank shown even outside the top 50 | S20-012–021, 059–060 | All | OBSERVED |
| FN-M08-7.2.4 | Podium (order 2-1-3): avatar, name (truncate, max 110px), "{x}% ketepatan" (≤100%, DV-M08-07), coins (`fa-coins`), base number; 👑 on rank 1; fits 375px (DV-M08-10) | S20-022–038, 061–063, 067–068 | All | OBSERVED + DV-M08-07/10 |
| FN-M08-7.2.5 | Table # · Pelajar · Koin · Sesi (from `md`) · Ketepatan (from `lg`) (headers **not** upper case): rank circle colours (1 amber, 2 slate, 3 orange, others slate-50), avatar border amber-300 top 3; accuracy pill green ≥80, amber 60–79.9, red <60 on the unrounded value; coins descending; at most 50 rows; the same list for every viewer | S20-039–055, 064–066, 069–071 | All | OBSERVED |
| FN-M08-7.2.6 | Footer "{n} peserta bersaing" (`fa-users`, n = rows shown) and "Dikemaskini real-time" (`fa-sync-alt`, from `md`) | S20-056–058 | All | OBSERVED |

### EP-M08-8 — Weekly report

**FT-M08-8.1 — Laporan Mingguan (S21 `/laporan-mingguan`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M08-8.1.1 | For the admin: the global 403 page (standalone, "Halaman Utama" → `/`, "Log Masuk" → `/login`); `?week=1` gives the same; tab "403 - Akses Ditolak \| PRESTASIPLUS" (OBSERVED). Menu item shown as live | S21-001–007 | Admin (OBSERVED) | OBSERVED |
| FN-M08-8.1.2 | For pelajar, ibu bapa and guru: page content (sections, week navigation, charts) and access NOT observable — BLOCKED pending a student/teacher test account (OQ-M08-01); until then the prototype reuses the observed global 403 page for these roles as a temporary stand-in (no new UI or copy; provisional, not asserted by E2E; to be replaced when discovered) | — | Pelajar/Ibu Bapa/Guru | UNVERIFIED (L-1) |


---

## 4. User stories

Values in the ACs come from the seed (SRS §6.10). "The admin" = `admin@demo.test` (id 1; mirrors the live admin; school SK Demo 900002). "The teacher" = `guru@demo.test` (id 5; SMK DEMO 900001; designed classes 2001 Kimia and 2002 Sejarah, headcount configs 501–505). "The school admin" = `adminsekolah@demo.test` (id 8; SMK DEMO). "The student" = `pelajar@demo.test` (id 2). "The progressing student" = `pelajarmaju@demo.test` (id 4; M05 sessions M1–M4). "The new student" = `pelajar2@demo.test` (id 3; no activity). "Murid Demo 01…08" = designed class members 3001–3008 (no demo credentials). "Murid Simulasi 01…15" = fictitious names for the 15 observed pupils of live class 516 "4 Simulasi" (ids 3201–3215, admin mirror).

| ID | Feature | MoSCoW | Story | Functions |
|---|---|---|---|---|
| US-M08-01 | FT-M08-1.1 | Must | As a user, I want the M08 pages in my sidebar or drawer with the right page title, so that I can find them and know where I am. | FN-M08-1.1.1–1.1.3 |
| US-M08-02 | FT-M08-1.2 | Must | As the owner, I want M08 closed to guests and wrong ids to show the standard 404/403 pages, so that the area behaves predictably. | FN-M08-1.2.1–1.2.4, 1.2.6 |
| US-M08-03 | FT-M08-1.2 | Must | As an admin, I want the "Analisa Item" menu item to open the item-analysis board, so that it is not a dead end. | FN-M08-1.2.5 |
| US-M08-04 | FT-M08-2.1 | Must | As an admin, I want a school dashboard with headline counts, so that I see the size and activity of the schools at a glance. | FN-M08-2.1.1, 2.1.2, 2.1.10 |
| US-M08-05 | FT-M08-2.1 | Must | As an admin, I want the estimated GPS and the grade distribution from headcount entries, so that I know the expected SPM standing. | FN-M08-2.1.3, 2.1.4 |
| US-M08-06 | FT-M08-2.1 | Should | As an admin, I want the 5-year GPS trend chart and table, so that I see whether results improve. | FN-M08-2.1.5 |
| US-M08-07 | FT-M08-2.1 | Must | As an admin, I want the GPS per subject with its grade and on-track counts, so that I find the weakest subjects. | FN-M08-2.1.6 |
| US-M08-08 | FT-M08-2.1 | Must | As an admin, I want the level comparison, the teacher performance list and quick links, so that I can drill down. | FN-M08-2.1.7–2.1.9 |
| US-M08-09 | FT-M08-2.2 / 2.3 | Must | As an admin, I want to pick Tingkatan 4 or 5 and see that level's counts and headcount summary, so that I compare levels. | FN-M08-2.2.1, 2.3.1–2.3.3 |
| US-M08-10 | FT-M08-2.3 | Must | As an admin, I want the level's class comparison, best students and at-risk students, so that I know where to act. | FN-M08-2.3.4–2.3.6 |
| US-M08-11 | FT-M08-2.4 | Must | As a teacher, I want to pick one of my classes (or be told to create one), so that I open its dashboard. | FN-M08-2.4.1–2.4.3 |
| US-M08-12 | FT-M08-2.5 | Must | As a teacher, I want a class dashboard with its counts and a class switcher, so that I monitor the class. | FN-M08-2.5.1–2.5.3 |
| US-M08-13 | FT-M08-2.5 | Must | As a teacher, I want the students needing attention, the 30-day trend and the class ranking, so that I help the right students. | FN-M08-2.5.4–2.5.6 |
| US-M08-14 | FT-M08-2.6 | Must | As a teacher or admin, I want a student's Prestasi 360 headline and headcount cards, so that I see the whole student. | FN-M08-2.6.1–2.6.3 |
| US-M08-15 | FT-M08-2.6 | Must | As a teacher or admin, I want the student's subject mastery, activity figures, badges and 90-day heatmap, so that I see effort and results. | FN-M08-2.6.4–2.6.6, 2.6.9 |
| US-M08-16 | FT-M08-2.6 | Must | As a teacher or admin, I want the student's weak topics with focus links and suggestions, so that I can recommend practice. | FN-M08-2.6.7, 2.6.8 |
| US-M08-17 | FT-M08-3.1 | Must | As a student, I want my weakest DSKP standards with a focus-practice button, so that I fix the weakest topics first. | FN-M08-3.1.1–3.1.3 |
| US-M08-18 | FT-M08-3.1 | Must | As a student, I want per-subject mastery, KPIs, a projected grade and the DSKP map, so that I know where I stand in each subject. | FN-M08-3.1.4–3.1.9 |
| US-M08-19 | FT-M08-3.2 | Must | As a teacher, I want class analytics filtered by class, subject and risk, so that I find students at risk. | FN-M08-3.2.1–3.2.4 |
| US-M08-20 | FT-M08-4.1 | Should | As an admin or officer, I want the school item analysis by level, so that I see question quality school-wide. | FN-M08-4.1.1–4.1.10 |
| US-M08-21 | FT-M08-4.2 | Must | As a teacher or admin, I want to pick a class for item analysis, so that I open its board. | FN-M08-4.2.1, 4.2.2 |
| US-M08-22 | FT-M08-4.3 | Must | As a teacher, I want each question's difficulty, accuracy and the students who got it wrong, with search and sort, so that I reteach the right items. | FN-M08-4.3.1–4.3.8 |
| US-M08-23 | FT-M08-4.3 | Must | As a teacher, I want each question's discrimination index and to switch class, so that I judge question quality. | FN-M08-4.3.9–4.3.12 |
| US-M08-24 | FT-M08-5.1 | Must | As a teacher, I want the headcount list with Auto-Setup by level, so that I create headcounts quickly. | FN-M08-5.1.1–5.1.7 |
| US-M08-25 | FT-M08-5.2 | Must | As a teacher, I want a headcount dashboard with a level filter and on-track totals, so that I see my classes' target status. | FN-M08-5.2.1–5.2.5 |
| US-M08-26 | FT-M08-5.3 | Must | As a teacher, I want to create a headcount for a class, subject, level and year with 2–5 OTRs in Auto or Manual mode, so that I track targets. | FN-M08-5.3.1–5.3.6 |
| US-M08-27 | FT-M08-5.4 | Must | As a teacher, I want one student's headcount sections with TOV, targets, actual results, RS, projection, prediction accuracy and chart, so that I see if the student is on track. | FN-M08-5.4.1–5.4.6 |
| US-M08-28 | FT-M08-6.1 | Should | As a student, I want my timeline and my public profile link, so that I can share my achievements. | FN-M08-6.1.1–6.1.4 |
| US-M08-29 | FT-M08-6.2 | Should | As a student, I want to post a title, category, date, story and 1–5 photos with captions, so that my achievement appears on my timeline. | FN-M08-6.2.1–6.2.5 |
| US-M08-30 | FT-M08-6.3 | Should | As a visitor, I want a student's public profile with stats and a sponsor button, so that I can see and support the student. | FN-M08-6.3.1–6.3.9 |
| US-M08-31 | FT-M08-7.1 | Must | As a student, I want the academic ranking by scope, subject and level, so that I compare myself with others. | FN-M08-7.1.1–7.1.5 |
| US-M08-32 | FT-M08-7.2 | Must | As a student, I want the coins leaderboard for all time, this week and this month with my own rank, so that I stay motivated. | FN-M08-7.2.1–7.2.6 |
| US-M08-33 | FT-M08-8.1 | Could | As the owner, I want `/laporan-mingguan` to behave as observed for the admin and stay unbuilt for other roles until it is discovered, so that nothing is invented. | FN-M08-8.1.1, 8.1.2 |
| US-M08-34 | cross-cutting | Must | As a user on a phone, tablet or desktop, I want every M08 screen to fit without page scrolling sideways and with readable text, so that I can use it anywhere. | All screen FNs; DV-M08-10, DV-M08-18 |
| US-M08-35 | FT-M08-2.5 | Must | As a teacher, I want the class dashboard to summarise its headcount and each student's headcount status with one rule, so that the numbers agree. | FN-M08-2.5.7 |
| US-M08-36 | FT-M08-5.5 | Must | As a teacher, I want a class summary per OTR checkpoint (Above / On Track / Below / N/A), so that I see how the class is tracking. | FN-M08-5.5.1–5.5.5 |
| US-M08-37 | FT-M08-5.6 | Must | As a teacher, I want the full headcount table of a class with status chips, sorting, actions, reset/delete confirmations and student selection, so that I manage the headcount. | FN-M08-5.6.1–5.6.9 |

### Acceptance criteria

**US-M08-01 — Menus and titles**
- **AC-M08-01.1** Given any user-portal M08 screen at 1280px, when it loads, then the sidebar shows "Headcount" (`fa-chart-line`) → `/headcount`, "Prestasi" (`fa-chart-bar`) → `/prestasi`, "Analitik Adaptif" (`fa-brain`) → `/analitik/pelajar`, "Analisa Item" (`fa-magnifying-glass-chart`) → `/analisa-item`, "Laporan Mingguan" (`fa-file-lines`) → `/laporan-mingguan`, "Kedudukan" (`fa-trophy`) → `/ranking` and "Timeline Saya" (`fa-camera`) → `/timeline`.
- **AC-M08-01.2** Given 375px or 768px, when I open "Lagi", then the drawer shows the same M08 links, and in the teacher group "PENILAIAN" "Headcount" → `/headcount` and "Prestasi" → `/prestasi/kelas`.
- **AC-M08-01.3** Given S2, S3, S4, S5, S7–S11, S16, S17 and S20, when each loads, then the header title and subtitle are the live ones listed in FN-M08-1.1.3 (e.g. S7 "Analitik Pembelajaran" / "Pantau prestasi dan kenal pasti topik yang perlu diperkukuhkan"; S5 class 228 "ALFA - Bahasa Inggeris" / "{sekolah} · Bahasa Inggeris · 2026"; S5 class 516 "4 Simulasi" / "{sekolah} · 2026").
- **AC-M08-01.4** Given S1, S6, S12, S13, S14, S15, S19, S22 and S23, when each loads, then the header title is "Dashboard Sekolah", "Prestasi 360", "Headcount", "Dashboard Headcount", "Buat Headcount Baru", "Headcount — Prestasi Individu", "Kedudukan", "Ringkasan Kelas" and "Headcount Sejarah" (config 213) respectively (not "Dashboard"), with the subtitle "Selamat datang kembali" (DV-M08-01, PROPOSED titles taken from each page's own tab title or heading).

**US-M08-02 — Access and error pages**
- **AC-M08-02.1** Given no session, when I open `/prestasi`, `/ranking`, `/leaderboard`, `/timeline`, `/headcount`, `/analitik/pelajar`, `/laporan-mingguan` or `/analisa-item/kelas`, then I am redirected to `/login` (OBSERVED); when I open `/pelajar/1`, then the public profile renders (OBSERVED).
- **AC-M08-02.2** Given the admin, when I open `/prestasi`, then the URL becomes `/prestasi/sekolah` and S1 renders.
- **AC-M08-02.3** Given `/prestasi/tingkatan/t3`, `/prestasi/99999999`, `/headcount/student/99999999`, `/pelajar/99999999`, `/prestasi/kelas/sc-419` or `/headcount/1`, when it loads, then the global 404 page shows "404", "🔍", "Halaman Tidak Dijumpai", "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?", "Halaman Utama" → `/`, "Mula Latihan" → `/practice` and "PRESTASIPLUS".
- **AC-M08-02.4** Given `/analisa-item/kelas/99999999`, when it loads, then the standalone 403 page shows "403", "🚫", "Akses Ditolak", "Anda tidak mempunyai kebenaran untuk mengakses halaman ini. Sila log masuk dengan akaun yang betul atau hubungi pentadbir.", "Halaman Utama" → `/`, "Log Masuk" → `/login`, and the tab "403 - Akses Ditolak | PRESTASIPLUS".
- **AC-M08-02.5** Given `/timeline/1`, when it loads, then the global 404 page renders (DV-M08-24).

**US-M08-03 — Analisa Item entry**
- **AC-M08-03.1** Given the admin, when I choose "Analisa Item" in the sidebar, then `/analisa-item/kelas` (S10) opens (DV-M08-02).
- **AC-M08-03.2** Given the teacher, when I open `/analisa-item`, then `/analisa-item/kelas` opens; given the student, then `/dashboard` opens with no message (both INFERRED, provisional, L-2).
- **AC-M08-03.3** Given the school admin, when I choose "Analisa Item" in the sidebar, then `/analisa-item/sekolah` (S9, own school) opens; given the student, when I open `/analisa-item/kelas` or `/analisa-item/kelas/{id}`, then the 403 page "Akses Ditolak" shows (both INFERRED, provisional, OD-R4).

**US-M08-04 — School dashboard header and stats**
- **AC-M08-04.1** Given the admin opens S1, when it loads, then it shows 🏫, h1 "Dashboard Sekolah", "Ringkasan prestasi keseluruhan · 750 kelas · 4533 murid", and the pills "Tingkatan" → `/prestasi/tingkatan` and "Kelas" → `/prestasi/kelas`.
- **AC-M08-04.2** Given S1, when the stat cards render, then they read "4533" "Murid" (M02 users with role `student`), "551" "Guru" (M02 users with role `teacher`), "750" "Kelas", "27" "Subjek", "32122" "Sesi Latihan", "478,499" "Soalan Dijawab", "79.8%" "Purata Ketepatan" (only "Soalan Dijawab" has a separator, as live) in 2 columns at 375, 4 at 768 and 7 at 1280.
- **AC-M08-04.3** Given the school admin opens S1, when it loads, then every figure is computed from SMK DEMO only: "Ringkasan prestasi keseluruhan · 2 kelas · 9 murid" (M02 students of school 900001: canonical 2 and 3001–3008), "1" Guru (teacher 5), GPS "5.33" with the pill "Sederhana" (amber) and "Berdasarkan 6 entri headcount" (INFERRED scope; provisional, OQ-M08-04).

**US-M08-05 — GPS and grade distribution**
- **AC-M08-05.1** Given S1, when "📊 GPS Anggaran" renders, then it shows "3.45" (= 2569 ÷ 744 from the grade distribution, A+ 0 … G 9), "GPS", the pill "Baik" in blue (DV-M08-12; live "Sederhana"), "Berdasarkan **744** entri headcount" and "* Anggaran dari markah OTR, bukan SPM sebenar".
- **AC-M08-05.2** Given "📈 Taburan Gred (Anggaran)", when it renders, then the rows read A+ 125 16.8%, A 146 19.6%, A- 96 12.9%, B+ 47 6.3%, B 107 14.4%, C+ 24 3.2%, C 23 3.1%, D 76 10.2%, E 28 3.8%, G 72 9.7%, each bar width = count ÷ 146 in the grade colour, and the footer "Jumlah: 744 rekod".

**US-M08-06 — GPS trend**
- **AC-M08-06.1** Given "📉 Trend GPS (5 Tahun)", when it renders, then it shows "2022–2026 · lebih rendah = lebih baik", "Paksi Y diterbalikkan: 0 (A+) di atas, 9 (G) di bawah." and a line chart with the overall line (5.2, 4.8, 4.5, 4.3, gap at 2026) and six dashed subject lines, y axis reversed 0–9 labelled "A+ (0)" … "G (9)".
- **AC-M08-06.2** Given the trend table (headers upper case by CSS), when it renders, then rows 2022–2025 read GPS "5.20" / "4.80" / "4.50" / "4.30" (amber), Tahap "Sederhana", Calon 150 / 160 / 175 / 180, Sumber "SPM Sebenar", Perubahan "—", "▼ 0.4", "▼ 0.3", "▼ 0.2" (emerald), and the last row "2026" + "Semasa", "Tiada data", "—" ×4 (the 2026 subject points are replicated, DV-M08-27).
- **AC-M08-06.3** Given I hover a 2022 point, when the tooltip opens, then it reads "Tahun 2022" and "GPS Keseluruhan: 5.20 (Sederhana)"; a 2026 overall point reads "GPS Keseluruhan: Tiada data".

**US-M08-07 — GPS per subject**
- **AC-M08-07.1** Given "📚 GPS Mengikut Subjek" (headers upper case by CSS), when it renders, then it has 18 rows in GPS order from "Tasawwur Islam 0.29 A+ 7 0 0 7" to "Perniagaan 7.15 D 84 7 61 16", then "Pendidikan Seni Visual" and "Sains Sukan" with "—" and 0 counts (discovery A.2).
- **AC-M08-07.2** Given a row, when it renders, then the grade equals the grade at round(GPS) (2.50 → B+, 3.56 → B, 4.54 → C+), GPS and grade share the colour band (≤2 emerald, ≤4 blue, ≤6 amber, >6 red) and the Pencapaian bar is round((9.5 − GPS) ÷ 9.5 × 100)% wide (Tasawwur Islam 97%); rows without data have no bar.

**US-M08-08 — Level comparison, teachers, quick links**
- **AC-M08-08.1** Given "🎓 Perbandingan Tingkatan", when it renders, then the cards read "Tingkatan 4" "63.9%" (amber) "13 kelas" "149 murid" "11 sesi latihan" and "Tingkatan 5" "79.7%" (emerald) "645 kelas" "3911 murid" "29971 sesi latihan" — the same values as S2/S3 (DV-M08-05 with DV-M08-28, PROPOSED; live S1 "11 / 148 / 10 / 63.9%" and "560 / 3467 / 25716 / 79.8%") — and link to `/prestasi/tingkatan/t4|t5`.
- **AC-M08-08.2** Given "👩‍🏫 Prestasi Guru", when it renders, then it holds 310 teacher cards A→Z in a box that scrolls inside itself (max 384px); the three observed cards read "1 kelas · 0 murid" "Ketepatan: 0%" "Tiada data headcount", "2 kelas · 76 murid" "72.5%", "3 kelas · 89 murid" "72.7%"; a card with headcount data shows "On Track: n", "Below: n" and the bar.
- **AC-M08-08.3** Given "🔗 Navigasi Pantas", when I press each tile, then "🎓 Dashboard Tingkatan" → `/prestasi/tingkatan`, "📊 Dashboard Kelas" → `/prestasi/kelas`, "📈 Headcount" → `/headcount`, "🔬 Analisa Item" → `/analisa-item/sekolah`.

**US-M08-09 — Level picker and level dashboard**
- **AC-M08-09.1** Given S2, when it loads, then two cards read "Tingkatan 4" "13 kelas | 149 murid" → `/prestasi/tingkatan/t4` and "Tingkatan 5" "645 kelas | 3911 murid" → `/prestasi/tingkatan/t5` (1 column at 375, 2 from 640px).
- **AC-M08-09.2** Given S3 T4, when it loads, then it shows "←" → `/prestasi/tingkatan`, h1 "Tingkatan 4", "Dashboard Prestasi Tingkatan · 13 kelas · 5 subjek", pill "T4" active (indigo) and "T5" inactive, and the cards 13 Kelas, 149 Murid, 63.9% Purata Ketepatan, **11** Jumlah Sesi (distinct sessions, DV-M08-28; live 10), 34 On Track, 41 Below Target.
- **AC-M08-09.3** Given "Headcount Keseluruhan" on T4 and T5, when it renders, then it reads "45% On Track" (34 ÷ 75) with "On Track: 34" · "Below Target: 41" and "28% On Track" (114 ÷ 403) with "On Track: 114" · "Below Target: 289"; the bar widths are the unrounded shares.
- **AC-M08-09.4** Given S3 T5, when it loads, then the header reads "Dashboard Prestasi Tingkatan · 645 kelas · 26 subjek" and the cards 645 / 3911 / 79.7% / 29,971 / 114 / 289.

**US-M08-10 — Class comparison and student lists**
- **AC-M08-10.1** Given S3 T4 "Perbandingan Kelas" (headers upper case by CSS), when it renders, then it has the 13 observed rows in order: "4 Bestari" Tiada Subjek 5 · 0 · 0% · 0 · 0 → 419; "4 Simulasi" Tiada Subjek 15 · 0 · 0% · 13 · 2 → 516; "4 Bestari - BM" 58 · 0 · 0% → 4; "4 Cemerlang - BM" 53 · 7 · 51.3% → 5; "4 Dedikasi - BM" 54 · 4 · 81.7% → 6; "MUMTAZ - Biologi" 0 → 90; "5 BEST" Fizik 0 → 25; "4 IBNU SINA" Matematik 0 → 115; "4 Bestari - SEJ" 58 → 8; "4 Cemerlang - SEJ" 53 · 7 · 51.3% → 9; "4 Dedikasi - SEJ" 54 · 4 · 81.7% → 10; "T4 4 Bestari" Kelas Sekolah 5; "T4 4 Khawarizmi" Kelas Sekolah 1 (fictitious teacher names; the colours per FN-M08-2.3.4); at 375 the table scrolls inside its card.
- **AC-M08-10.2** Given the two "Kelas Sekolah" rows, when they render, then Guru shows "—" and the Aksi cell has no link (DV-M08-06; live `/prestasi/kelas/sc-419|sc-806` 404).
- **AC-M08-10.3** Given "Murid Terbaik" on T4 and T5, when it renders, then each row's accuracy is the student's mean session accuracy (BR-M08-07) and T4 shows 2 rows ("3 sesi · 30 soalan" "93.3%", "4 sesi · 60 soalan" "64%") and T5 shows 10 rows whose live values above 100% (126.7%, 120%, 118.3%, 108.6%, 108%, 107.8%, 106%, 105%, 103.3%, 103.1%) display "100%" (DV-M08-07; computed 100.0 %: every session of those students fully correct), in the live order (ties by user id), with rank colours 1 amber, 2 gray, 3 amber-700.
- **AC-M08-10.4** Given "Murid Berisiko" on T4, when it renders, then it lists 15 red rows from "… 4 Simulasi · OTR3: 56.00% (sasaran 82.00%)" "-26" to "… OTR3: 83.00% (sasaran 93.00%)" "-10"; on T5 from "5 LEQOE · OTR3: 0.00% (sasaran 70.00%) -70" to "5 JUJUR · OTR3: 40.00% (sasaran 71.00%) -31"; each row opens `/prestasi/{userId}` of that student (DV-M08-08).
- **AC-M08-10.5** Given the T4 page, when the cards and the table are compared, then the cards keep their own definitions (Murid 149 distinct students vs Σ rows 356 enrolments; On Track 34 / Below 41 student × config pairs vs the "4 Simulasi" row 13 / 2 students; no "Tiada Data" bucket) as live (replicated, DV-M08-28), and the "4 Simulasi" row counts a student On Track when at least one of the student's configs is On Track (INFERRED definition that reproduces 13 / 2).

**US-M08-11 — Class picker**
- **AC-M08-11.1** Given the admin opens S4, when it loads, then it shows 📊, h1 "Dashboard Kelas", "Pilih kelas untuk lihat prestasi keseluruhan", 📭 "Anda belum mempunyai kelas aktif.", "Cipta kelas terlebih dahulu untuk mula memantau prestasi murid." and "Cipta Kelas" → `/guru/kelas/cipta`.
- **AC-M08-11.2** Given the teacher opens S4, when it loads, then one card per own active class (2001, 2002) opens `/prestasi/kelas/{id}` (layout PROPOSED; provisional, L-6).

**US-M08-12 — Class dashboard header and stats**
- **AC-M08-12.1** Given the admin opens class 228, when it loads, then it shows "←" (title "Kembali ke senarai kelas") → `/prestasi/kelas`, h1 "ALFA - Bahasa Inggeris", "{sekolah} · Bahasa Inggeris · 2026 · Kod: UDL749" and the cards 93 · 77.6% · 1618 · 34882 · 10.4m · 2.
- **AC-M08-12.2** Given the admin opens class 4, when it loads, then the cards read 58 · 0% · 0 · 0 · 0m · 0, and "Tukar Kelas..." has only the placeholder.
- **AC-M08-12.3** Given the teacher opens class 2001, when it loads, then the cards read 8 · 42.6% · 11 · 68 · 6.1m · 6, and choosing "5 MARIKH - Sejarah" in "Tukar Kelas..." opens `/prestasi/kelas/2002` (provisional: teacher access INFERRED).

**US-M08-13 — Attention, trend and ranking**
- **AC-M08-13.1** Given class 4 (admin), when it loads, then "⚠️ Perlu Perhatian (58)" lists 58 rows "Belum mula berlatih" with badge "Tak Aktif", the trend card shows 📭 "Belum ada aktiviti dalam 30 hari terakhir.", and the ranking rows show Ketepatan "—", Terakhir Aktif "—" and Headcount "N/A".
- **AC-M08-13.2** Given class 2001 (teacher), when it loads, then "⚠️ Perlu Perhatian (6)" lists Murid Demo 03–06 ("1 sesi · 37.5% ketepatan", badge "37.5%"), Murid Demo 07 ("2 sesi · 33.3% ketepatan") and Murid Demo 08 ("1 sesi · 12.5% ketepatan") in that order, each → `/prestasi/{userId}`; inactive students would follow them.
- **AC-M08-13.2a** Given class 228 (admin), when it loads, then "⚠️ Perlu Perhatian (57)" shows the total 57 (OBSERVED) and its first three rows are "3 sesi · 48.3% ketepatan" (badge "48.3%"), "2 sesi · 45% ketepatan" (badge "45%") and "5 sesi · 44.6% ketepatan" (badge "44.6%") in that order (OBSERVED); and, by the computed ordering rule (FN-M08-2.5.4, BR-M08-10), every later row with sessions has accuracy below 50% and no higher than the row before it, and every member without a session ("Belum mula berlatih", badge "Tak Aktif") comes after all rows with sessions. The exact count of rows under 50% versus idle rows is **not asserted** (the 11 + 46 split is INFERRED, DV-M08-36; the test checks that rows-with-sessions + idle rows = 57).
- **AC-M08-13.3** Given class 2001, when the trend card renders, then the chart has three points (09-15, 09-22, 09-24) with the datasets "Purata Ketepatan (%)" and "Sesi".
- **AC-M08-13.4** Given "🏆 Kedudukan Murid" of class 2001 (headers upper case by CSS), when it renders, then the rows are 🥇 Murid Demo 01 88.9%, 🥈 Murid Demo 02 50%, 🥉 and 4–6 Murid Demo 03–06 37.5%, 7 Murid Demo 07 33.3%, 8 Murid Demo 08 12.5%, with Sesi, Soalan, Headcount badge (Murid Demo 01 "Below" per config 504, the others "N/A"), Terakhir Aktif (relative) and "Lihat →" → `/prestasi/{userId}`; no row shows more than 100% (DV-M08-07).

**US-M08-14 — Prestasi 360 hero, stats and headcount**
- **AC-M08-14.1** Given the admin opens `/prestasi/1`, when it loads, then the hero shows the initial avatar, h1 "Admin Demo", "Prestasi 360 — Dashboard Individu" and (≥1024px) "0%" "Ketepatan" and "1" "Hari Kombo"; the cards read "0" Sesi Kuiz, "0.0%" Ketepatan, "0" Soalan Dijawab, "0m" Masa Belajar; there is no headcount card and no "Lencana" card.
- **AC-M08-14.2** Given the admin opens `/prestasi/3001`, when it loads, then the cards read "3", "85.7%", "14", "14m", and "Headcount — Prestasi SPM" shows 5 cards (504 Sejarah, 501 Kimia, 502 Kimia, 503 Bahasa Melayu, 505 Bahasa Melayu 2025 — newest update first); config 501 reads pill "On Track" and chips "TOV: 60%" → "OTR1: 65%" (green) → "OTR2: 70%" (green) → "ETR: 75%" (OTR3 has no AR and is omitted); config 504 "Below", "TOV: 50%" → "OTR1: 40%" (red) → "OTR2: 45%" (red) → "ETR: 65%"; config 502 "—", "TOV: 64%" → "ETR: —"; each "Lihat Penuh" → `/headcount/student/3001`.
- **AC-M08-14.3** Given 375px, when a headcount chip row is longer than the card, then it wraps and the page does not scroll sideways (DV-M08-10).
- **AC-M08-14.4** Given the admin opens Murid Simulasi 01 (`/prestasi/3201`), when it loads, then the headcount cards read, in order: Sejarah "Below" "TOV: 67%" → "OTR3: 56%" → "ETR: 56%"; Matematik "Below" 55 / 65 / 65; Bahasa Melayu "On Track" 58 / 60 / 60; Sains "—" 70 / 61 (red chip, no target) / 61; Bahasa Inggeris "On Track" 51 / 74 / 74 — each "{kelas} · {tahun}" "4 Simulasi · 2026".

**US-M08-15 — Mastery, activity, badges and heatmap**
- **AC-M08-15.1** Given `/prestasi/1`, when it loads, then "Penguasaan Subjek" shows `fa-chart-pie` "Belum ada data latihan." and "Mula Berlatih" → `/practice`; "Aktiviti" reads "1" Kombo Hari, "5" Rekod Terbaik, "256" Koin (M14 `currentSyiling`, XL3-06), "13" Hari Latihan.
- **AC-M08-15.2** Given `/prestasi/3001`, when it loads, then "Penguasaan Subjek" shows "CH" Kimia "89%" "2 sesi · 9 soalan" (green bar) and "SE" Sejarah "80%" "1 sesi · 5 soalan".
- **AC-M08-15.3** Given "Peta Aktiviti (90 Hari)", when it renders, then it has 90 cells (oldest first), the legend "0", "1-1", "2-2", "3-3", "4+", "sesi/hari", and hovering or clicking the first cell of the admin's map shows the tooltip "28/06 (Ahad) — Tiada aktiviti"; clicking the same cell again hides it.
- **AC-M08-15.4** Given Murid Demo 01, when I click the 24/09 cell, then the tooltip reads "24/09 (Khamis) — 1 sesi" (INFERRED active form) and the cell is #bbf7d0 (provisional, L-8).
- **AC-M08-15.5** Given `/prestasi/3201`, when it loads, then the card "Lencana (3)" shows three badge tiles with the tooltips "Pemula Rajin" (`fa-seedling`), "Pelajar Aktif" (`fa-running`) and "Pengumpul" (`fa-coins`).

**US-M08-16 — Weak topics and suggestions**
- **AC-M08-16.1** Given `/prestasi/1`, when it loads, then "Topik Perlu Perhatian" shows `fa-check-circle` "Tiada topik lemah! Teruskan usaha." and "Cadangan" shows "Sudah 127 hari tiada latihan. Mulakan semula dengan 10 soalan mudah untuk pemanasan." and "Mulakan perjalanan belajar kamu — setiap sesi latihan membina asas yang kukuh!".
- **AC-M08-16.2** Given Murid Demo 08 (`/prestasi/3008`), when it loads, then "Topik Perlu Perhatian" lists the weak topics accuracy ascending, each with "{x}%", the topic, "CHEM · {n} percubaan", "Fokus {k}" and a button titled "Klik untuk {k} soalan fokus" → `/practice/CHEM/quiz?level=11&dskp_sp_id={id}&count={k}`; "Sel Elektrolisis" shows "Fokus 25" (30 questions available, capped at 25); the legend reads "Klik untuk buka set latihan tertumpu pada topik lemah itu sahaja."; below 640px the button shows the icon only.
- **AC-M08-16.3** Given Murid Demo 08, when "Cadangan" renders, then it includes "Tingkatkan prestasi Kimia (purata 12.5%) dengan 3 sesi latihan fokus minggu ini." and "Topik 'Sel Elektrolisis' (0% ketepatan) adalah titik lemah utama — buat latihan tertumpu untuk topik ini." (triggers INFERRED; provisional).
- **AC-M08-16.4** Given `/prestasi/3201` (admin), when "Cadangan" renders, then it shows "Belum ada sesi latihan lagi. Mulakan dengan subjek yang paling kamu minati!", then "Sejarah OTR3: markah sebenar (56.00) masih 26 mata di bawah sasaran (82.00). Fokus latihan untuk kejar target." and "Matematik OTR3: markah sebenar (65.00) masih 5 mata di bawah sasaran (70.00). Fokus latihan untuk kejar target." (copy OBSERVED; triggers and order INFERRED; provisional).

**US-M08-17 — Weak-topic suggestions (S7)**
- **AC-M08-17.1** Given the admin opens S7, when it loads, then "Topik Perlu Perhatian Utama (4)" shows four Bahasa Melayu cards: "5.1.2 — Mengaplikasi pelbagai kata terbitan dalam pelbagai laras bah..." "Bahasa Melayu · 3 soalan dijawab" "Latihan Fokus (16 soalan)"; "3.4.1 — Menulis kerangka karangan dengan menyusun dan menganalisis i..." "· 1 soalan dijawab" "(16 soalan)"; "5.1.3 — …" "(7 soalan)"; "4.2.1 — …" "· 4 soalan dijawab" "(12 soalan)"; each pill "0%" and link `/practice/BM/quiz?level=4&dskp_sp_id={221|206|222|214}&count={16|16|7|12}`.
- **AC-M08-17.2** Given the Bahasa Melayu tab is active, when the page loads, then "Masih ada topik lemah lain untuk subjek ini." **13** and "Lihat semua 17 topik lemah" show; pressing it opens 17 Bahasa Melayu cards (accuracy ascending) and the toggle reads "Sembunyi senarai penuh"; pressing again closes the list.
- **AC-M08-17.3** Given the expanded list is open, when I switch to "Sejarah 35%", then the list stays open and shows 13 Sejarah cards, and the bar reads **9**.
- **AC-M08-17.4** Given the weak SP "2.1.1" with 50 available questions, when its card renders, then the button reads "Latihan Fokus (25 soalan)" and links with `count=25` (DV-M08-14; live label "(50 soalan)").

**US-M08-18 — Subject pane (S7)**
- **AC-M08-18.1** Given the admin's S7, when it loads, then the tabs read "Bahasa Melayu 41%" (active, blue) and "Sejarah 35%"; the BM ring shows "3" / "/ 3 SP" with a full arc (as live), "Standard Dikuasai", legend 3 · 6 · 17 · 0; the KPIs read "40.5%" (red) "Ketepatan", "79" "Soalan Dijawab", `fa-minus` "Trend 30 Hari", "G – C" "Unjuran Gred" (DV-M08-16).
- **AC-M08-18.2** Given the Sejarah tab, when I press it, then the ring shows "8" / "/ 23 SP" (DV-M08-13; live "8 / 2 SP") and the arc does not exceed the circle, KPIs "35.0%", "40", "G – D", and the map caption "KSSR Sejarah Darjah 4" with tiles "1.1", "2.1".
- **AC-M08-18.3** Given accuracy below 50%, when the pane renders, then the red message box shows `fa-hand-holding-heart` "Jangan putus asa! Latihan konsisten akan membantu. Mulakan dengan topik yang paling lemah di bawah."; for accuracy ≥ 50% no message box is shown (PROPOSED — other bands UNVERIFIED, OQ-M08-08; not exercised by the seed, whose only populated S7 is the admin's).
- **AC-M08-18.4** Given the BM map, when it renders, then the caption reads "KSSR Bahasa Melayu Darjah 4", the tiles "1.1", "2.1", "3.1" are "Belum cuba" (slate) with titles such as "1.1: Menguasai kandungan Kemahiran Membaca D4 bagi Darjah 4 — Belum cuba", and the legend "Mahir (75%+)", "Sederhana (50-74%)", "Lemah (<50%)", "Belum Cuba", "Fokus" "Klik untuk latihan fokus" wraps at 375 without page overflow.
- **AC-M08-18.5** Given the progressing student opens S7, whose practice answers carry no DSKP standard (M05 v1.12 §6.15: anchors 600001–600065 have `dskpSpId = null`), when it loads, then no SP record exists and the page shows the no-data state of AC-18.6 (PROPOSED; provisional, OQ-M08-08).
- **AC-M08-18.6** Given the new student opens S7, when it loads, then only "Topik Perlu Perhatian Utama (0)" shows and there are no tabs or panes (PROPOSED, OQ-M08-08; provisional).

**US-M08-19 — Class analytics (S8)**
- **AC-M08-19.1** Given the admin opens S8 without parameters, when it loads, then the form shows "Kelas" with no option (the admin owns no class, as live), "Mata Pelajaran", "Risiko" and the empty text "Tiada data analitik untuk kelas dan subjek ini.".
- **AC-M08-19.2** Given `?classroom_id=4`, when it loads, then "Kelas" still has no option (as live), "Mata Pelajaran" lists the class's 10 subjects with Bahasa Melayu selected, the cards read 6 · 0.0% · 0 · 4 and the table (headers upper case by CSS) has 6 rows with Unjuran "E – B", "D – A-", "A- – A+", "C+ – A", "G – B", "C – A-" (DV-M08-16) and Risiko "Sederhana", "Rendah", "Rendah", "Rendah", "Sederhana", "Rendah".
- **AC-M08-19.3** Given I choose "Rendah" in "Risiko", when the form submits, then the URL keeps `classroom_id=4&subject_id=1&risk_level=low`, the cards read 4 · 0.0% · 0 · 4 and 4 rows show; choosing "Sejarah" reloads with the same class (cards 6 · 0.0% · 0 · 2).
- **AC-M08-19.4** Given the admin on a row, when I press the name or "Lihat Analitik" (`fa-chart-line`), then `/prestasi/{userId}` opens (DV-M08-04; live 403).
- **AC-M08-19.5** Given the teacher opens `?classroom_id=2001&subject_id=10`, when it loads, then "Kelas" lists 2001 and 2002 with 2001 selected, the cards read 8 · 41.8% · 4 (red) · 1, the Risiko badges include "Kritikal", "Tinggi", "Sederhana" and "Rendah", and the row links open `/prestasi/{userId}` (teacher access, badge colours and link target INFERRED; provisional, L-3, L-10).

**US-M08-20 — School item analysis (S9)**
- **AC-M08-20.1** Given the admin opens S9, when it loads, then it shows "Papan Pemuka" → `/dashboard` / "Analisa Item Sekolah", the school card (SK Demo, "SK", "PPD {ppd} • Johor", "0" "Pelajar", "0" "Jawapan"), "Tingkatan:" chips with "Semua" active, and "Tiada Data Pelajar" / "Tiada data pelajar untuk sekolah ini. Pastikan pelajar telah berdaftar dan menjawab soalan latihan.".
- **AC-M08-20.2** Given I press "Tingkatan 4", when it loads, then the URL has `?tingkatan=T4`, that chip is active and the header subtitle reads "{sekolah} — Tingkatan 4".
- **AC-M08-20.3** Given the admin opens `/analisa-item/sekolah/8880`, when it loads, then the school card reads "SEKOLAH MENENGAH KEBANGSAAN TINGGI KLUANG", "JEB2037", "SMK", "PPD KLUANG • Johor", "59" "Pelajar", "10,194" "Jawapan"; the cards read "59", "10,194", "71.7%"; "Profil Kesukaran" 0 / 0 / 20; "GPS Anggaran Sekolah" "2.49" "Baik" "Berdasarkan 148 entri headcount • Lebih rendah = lebih baik" with "Prestasi 360" → `/sekolah/8880/prestasi` (DV-M08-31); "Prestasi Mengikut Subjek" lists Sains 29 · 1,094 · 70.9% · 539, Sejarah 29 · 1,109 · 71.0% · 615, Bahasa Inggeris 29 · 851 · 71.9% · 539, Bahasa Melayu 30 · 507 · 72.0% · 580, Matematik 31 · 817 · 72.4% · 614; the pills read "Semua (20)", "Bahasa Melayu (13)", "Sains (6)", "Sejarah (1)" and card 1 reads "Prinsip Pascal menyatakan bahawa:" with `fa-frown` "Sukar" and "100.0% salah".
- **AC-M08-20.4** Given `/analisa-item/sekolah/8880?tingkatan=T4`, when it loads, then "Ketepatan Keseluruhan" reads "76.3%", the subject table starts with Sejarah 15 · 854 · 75.7% · 312, the pills read "Bahasa Inggeris (1)", "Bahasa Melayu (11)", "Sains (2)", "Sejarah (6)", and pressing "Sains (2)" leaves only the Sains cards without a reload.
- **AC-M08-20.5** Given a question card, when I click it, then it opens "Jawapan Betul" with the correct option, "Jawapan Salah Paling Popular ({n}x dipilih)" with that option and the "Pelajar Yang Salah" chips linking `/prestasi/{userId}`; a second click closes it.
- **AC-M08-20.6** Given a school with pupils but no answers (M18 observed 2700), when `/analisa-item/sekolah/{id}` loads, then "Soalan Dijawab" "0", "Ketepatan Keseluruhan" "0.0%", "Profil Kesukaran" "Tiada data", an empty subject table and no question card show; given an id without pupils, then "Tiada Data Pelajar" / "Tiada data pelajar untuk sekolah ini. Pastikan pelajar telah berdaftar dan menjawab soalan." shows.
- **AC-M08-20.7** Given a teacher or pupil opens `/analisa-item/sekolah/{id}` of another school, when it loads, then the 403 page shows (INFERRED; provisional, OQ-M08-10); a PPD officer opens the schools of the district (M18 scope).

**US-M08-21 — Class picker (S10)**
- **AC-M08-21.1** Given the admin opens S10, when it loads, then it shows "Pilih Kelas untuk Analisis", "Klik mana-mana kelas untuk melihat analisa item" and 750 cards, newest-created first: "5 CYBER" "Sains Rumah Tangga" "1 pelajar" "2026" "JOV330" "Lihat Analisa" → `/analisa-item/kelas/1156`, then "sains rumah tangga" (0 pelajar, 0VV295) and "Chaos Academy" (0 pelajar, PVZ601); 1 / 2 / 3 columns at 375 / 768 / 1280.
- **AC-M08-21.2** Given the teacher opens S10, when it loads, then only classes 2001 and 2002 are listed (INFERRED; provisional).

**US-M08-22 — Difficulty tab (S11)**
- **AC-M08-22.1** Given the admin opens class 228, when it loads, then it shows the breadcrumb, "ALFA - Bahasa Inggeris", "Bahasa Inggeris • tingkatan-5 • Tahun 2026", "93" Pelajar, "596" Soalan Diuji, cards MUDAH 381 "64% daripada soalan", SEDERHANA 78 "13%…", SUKAR 137 "23%…" (labels upper case by CSS), tabs "Indeks Kesukaran 596" (active) and "Indeks Diskriminasi 596", and 596 rows (headers upper case by CSS) whose first observed rows read "Which of the following is a fact?" "2 pelajar salah" "2" "2 pelajar" "0.0%" "1.00" "Sukar".
- **AC-M08-22.2** Given the admin opens class 2001, when the difficulty table renders, then it lists 8 questions in difficulty order Q5 0.88, Q6 0.88, Q4 0.75, Q2 0.50, Q7 0.50, Q8 0.50, Q3 0.40, Q1 0.25 with Ketepatan 12.5% / 12.5% / 25.0% / 50.0% / 50.0% / 50.0% / 60.0% / 75.0%, Tahap Sukar ×3, Sederhana ×4, Mudah ×1, and the cards Mudah 1 "13%", Sederhana 4 "50%", Sukar 3 "38%".
- **AC-M08-22.3** Given class 2001, when I click the Q1 row, then it expands with "Jawapan Betul" (the correct option), "Jawapan Salah Popular (2x dipilih)" and "Pelajar Yang Salah" chips "Murid Demo 07" "1x salah" and "Murid Demo 08" "1x salah", each → `/prestasi/{userId}`; clicking again collapses it.
- **AC-M08-22.4** Given class 2001, when I choose "Paling Mudah Dahulu", then Q1 is first and Q5 last; "Ketepatan Tinggi Dahulu" puts Q1 (75.0%) first; "Paling Banyak Percubaan" puts Q2 and Q3 (10) first; typing part of Q4's text in "Cari soalan..." leaves only Q4 (case-insensitive); clearing it restores all rows (DV-M08-17).
- **AC-M08-22.5** Given class 6 "4 Dedikasi - BM" (admin), when it loads, then "Bahasa Melayu • tingkatan-4 • Tahun 2026", cards 0 without "% daripada soalan", tabs "… 0", and `fa-inbox` "Tiada Data Lagi" / "Pelajar dalam kelas ini belum menjawab sebarang soalan lagi." show.
- **AC-M08-22.6** Given 375px, when the table renders, then the "Subjek / Topik" column is hidden, "{Subjek} — {Topik} — {Subtopik}" shows under the question, the table scrolls inside its card and the summary stays 3 columns.
- **AC-M08-22.7** Given class 228 rows with Tahap "Sederhana" and "Mudah", when they render, then the pills read `fa-meh` "Sederhana" (#FEF3C7 / #92400E) and `fa-smile` "Mudah" (#DCFCE7 / #166534) (OBSERVED).

**US-M08-23 — Discrimination tab and class switch (S11)**
- **AC-M08-23.1** Given I press "Indeks Diskriminasi", when it opens, then the guide shows "≥ 0.40 = Sangat Baik", "0.30 – 0.39 = Baik", "0.20 – 0.29 = Sederhana", "< 0.20 = Lemah" and "Indeks dikira berdasarkan perbezaan prestasi antara **27% pelajar terbaik** dan **27% pelajar bawah** dengan menggunakan semua sesi latihan.", and the search and sort controls are hidden.
- **AC-M08-23.2** Given class 2001, when the discrimination table renders, then rows are in index order Q1 1.000, Q7 1.000, Q8 1.000, Q6 0.500 (Sangat Baik), Q2 0.333 (Baik; 66.7% / 33.3%), Q3 0.250 (Sederhana; 75.0% / 50.0%), Q4 0.000 (Lemah), Q5 -0.500 (Lemah; 0.0% / 50.0%).
- **AC-M08-23.3** Given class 2002 (3 students with finished sessions), when I open the discrimination tab, then `fa-chart-line` "Data Tidak Mencukupi" / "Perlu sekurang-kurangnya 4 pelajar dengan sesi latihan selesai untuk mengira indeks diskriminasi." shows.
- **AC-M08-23.4** Given "Tukar Kelas", when it renders, then it has one chip per class the viewer may open (750 for the admin, in the S10 order), the current class highlighted, and pressing a chip opens `/analisa-item/kelas/{id}`.

**US-M08-24 — Headcount list and Auto-Setup (S12)**
- **AC-M08-24.1** Given the admin opens S12, when it loads, then it shows h1 "Headcount", "Tracking prestasi murid — TOV, OTR, AR & RS", "Dashboard" → `/headcount/dashboard`, "Buat Baru" → `/headcount/create`, "Auto-Setup", and the empty state "Belum ada headcount." + "Buat Sekarang" → `/headcount/create`.
- **AC-M08-24.2** Given I press "Auto-Setup", when the modal opens, then it shows "Auto-Setup Headcount", "Pilih tingkatan untuk auto-cipta headcount", "Darjah" D1–D6 and "Tingkatan" T1–T5 unticked, "Batal" and a disabled grey "Auto-Setup"; ticking D5 and T2 turns them amber and blue and the submit emerald "Auto-Setup (2)".
- **AC-M08-24.3** Given ticks in the modal, when I press "Batal", the backdrop or Esc, then the modal closes; when I press "Auto-Setup" on the hero again, then every box is unticked and the submit is disabled.
- **AC-M08-24.4** Given 375px, when the modal is open, then it is full width with "Batal" and "Auto-Setup" side by side; the hero buttons wrap and their text is at least 12px (DV-M08-18).
- **AC-M08-24.5** Given the teacher ticks T5 and submits, when the request completes, then S12 reloads without a message and lists the configs (PROPOSED; provisional, L-4).
- **AC-M08-24.6** Given the teacher opens S12, when it loads, then 5 config cards show, each opening `/headcount/{id}` (PROPOSED layout; provisional, L-4).

**US-M08-25 — Headcount dashboard (S13)**
- **AC-M08-25.1** Given the admin opens S13, when it loads, then it shows h1 "Dashboard Headcount", "Ringkasan prestasi semua kelas anda", "Senarai Penuh" → `/headcount`, "Tapis:" "Semua (0)" (active), cards 0 Konfigurasi · 0 Jumlah Murid · 0 On Track · 0 Off Track, no on-track block and "Belum ada headcount.".
- **AC-M08-25.2** Given the teacher opens S13, when it loads, then "Semua (6)" plus one filter button per level (labels "Tingkatan 4" / "Tingkatan 5" PROPOSED) show, the cards read 6 · 48 · 3 · 3, and "Keseluruhan On-Track" "50%" (amber) with legend "On Track: 3", "Off Track: 3", "Tiada Data: 42" (provisional, L-4).
- **AC-M08-25.3** Given I press the Tingkatan 4 filter, when it filters, then it is active (blue) and the cards read 1 · 8 · 0 · 0 (config 506, no marks keyed yet; Jumlah Murid follows the filter, DV-M08-11) and the "Keseluruhan On-Track" block is hidden (tracked = 0) (provisional, L-4).

**US-M08-26 — Create headcount (S14)**
- **AC-M08-26.1** Given S14, when it loads, then it shows the back link → `/headcount`, h1 "Buat Headcount Baru", "Pilih Kelas" ("— Pilih kelas —" + own classes; admin: none), "Pilih Subjek" ("— Pilih subjek —" + 31 "Name (CODE)" A–Z), "Tingkatan" ("— Pilih tingkatan —", "Tingkatan 4", "Tingkatan 5"), "Tahun Akademik" 2026, "3 OTR" checked with the hint, "🤖 Auto" checked and highlighted, the mode hint and "Cipta Headcount".
- **AC-M08-26.2** Given empty required fields, when I press "Cipta Headcount", then the browser's native required message stops the submit and no request is sent.
- **AC-M08-26.3** Given I choose "✍️ Manual", when it changes, then the Manual card gets the blue border/background and Auto loses it; no other field changes.
- **AC-M08-26.4** Given the teacher fills class 2002, Sejarah, Tingkatan 5, 2026, 4 OTR, Auto, when I submit, then the config is created and S12 opens listing it; a second Auto config for the same class + subject + year is refused with PROPOSED COPY "Headcount Auto untuk kelas, subjek dan tahun ini sudah wujud." (provisional, L-4, OQ-M08-03).
- **AC-M08-26.5** Given 375px, when S14 renders, then the mode cards stack in one column and the submit is full width; from 768px the mode cards are 2 columns.

**US-M08-27 — Individual headcount (S15)**
- **AC-M08-27.1** Given the admin opens `/headcount/student/3001` (a teacher of class 2001 sees the same, INFERRED), when it loads, then h1 "Murid Demo 01", "Headcount — Prestasi Individu · SMK DEMO", and five sections in config order (501 Kimia, 502 Kimia, 503 Bahasa Melayu 2026, 504 Sejarah, 505 Bahasa Melayu 2025; all Tingkatan 5), each with chips school, level, class, year.
- **AC-M08-27.2** Given section 503 (no targets set), when it renders, then the status pill reads "Belum Ada Data" (slate), "TOV: 58.0% (C+)", "ETR: —", no RS badge, chip or box, and the table rows OTR1–OTR3 show Target "—", Gred Target "-", AR "—", Status "—".
- **AC-M08-27.3** Given section 501, when it renders, then the pill reads "On Track" (green), "TOV: 60.0% (B)", "ETR: 75.0% (A-)", "Unjuran: 75% (A-)" (Unjuran is trimmed per discovery, BUG-08) (green variant), "Meningkat", "Keyakinan: Sederhana" (Unjuran, trend and confidence rules INFERRED; provisional), and the table rows OTR1 62 / B / 65 / B+ and OTR2 66 / B+ / 70 / A- are tinted green with a green Gred AR pill and `fa-check-circle`, OTR3 70 / A- / "—" / "-" with Status "—", then "ETR (Sasaran Akhir)" 75.
- **AC-M08-27.4** Given section 505 (2025, RS 82%), when it renders, then the RS badge "RS: 82.0% (A)", the chip "RS: 82.0% (A)", the row "RS (SPM Sebenar)" 82.0 with an indigo pill "A", the chart's last label "RS" with the "RS (SPM Sebenar)" star point at 82 (as live), and the box "Ketepatan Ramalan ETR vs RS" with "ETR (Ramalan): 80.0% (A)", "RS (Sebenar): 82.0% (A)", "Selisih: +2 markah", "Ramalan Tepat" and "Ramalan ETR sangat tepat — selisih dalam lingkungan ±5 markah." show.
- **AC-M08-27.5** Given the admin opens `/headcount/student/3201`, when the Sejarah section renders, then it shows "Below Target" (red), "RS: 56.4% (C+)", chips "TOV: 67.0% (B+)", "ETR: 56.0% (C+)", "RS: 56.4% (C+)", "Unjuran: 56% (C+)", "Menurun", "Keyakinan: Rendah"; the OTR3 row 82.0 / A- / 56.0 / C+ tinted red with a left red border and `fa-arrow-down`; the RS row "Direkod: 13 Apr 2026"; the box "Selisih: +0.4 markah" "Ramalan Tepat".
- **AC-M08-27.6** Given Murid Simulasi 03 and 02 (`/headcount/student/3203`, `3202`), when their Sejarah sections render, then the boxes read "ETR (Ramalan): 57.0% (C+)", "RS (Sebenar): 47.0% (D)", "Selisih: -10 markah", amber "Hampir Tepat" + "Ramalan ETR agak tepat — selisih dalam lingkungan ±10 markah. Boleh diperbaiki lagi." and "ETR (Ramalan): 65.0% (B+)", "RS (Sebenar): 35.1% (G)", "Selisih: -29.9 markah", red "Selisih Besar" + "Selisih melebihi 10 markah. Semak semula kaedah penetapan ETR.".
- **AC-M08-27.7** Given Murid Simulasi 01's Sains section (AR without target), when it renders, then the pill reads "Belum Ada Data", the OTR3 AR "61.0" is slate and its Gred AR pill is slate, not red (DV-M08-21; live red).

**US-M08-28 — Timeline (S16)**
- **AC-M08-28.1** Given the admin opens S16, when it loads, then it shows "📸 Timeline Saya", "Kongsi sijil, pencapaian, aktiviti & cerita anda", "Tambah Post" → `/timeline/create`, "Timeline Kosong", "Mula kongsi pencapaian, sijil, dan cerita anda untuk ditunjukkan pada profil awam anda!", "Tambah Post Pertama" → `/timeline/create`, and "Profil Awam Anda" with the link `…/pelajar/1` (DV-M08-19; live `/pelajar/3`) opening in a new tab.
- **AC-M08-28.2** Given I press the copy button, when it runs, then the clipboard holds the profile URL and the icon shows `fa-check` for 2 seconds, then `fa-copy` again.
- **AC-M08-28.3** Given the student has seeded posts, when S16 loads, then the posts show newest first with category, title, date, story and photos (PROPOSED layout; provisional, L-5).

**US-M08-29 — New post (S17)**
- **AC-M08-29.1** Given S17, when it loads, then it shows "Kembali ke Timeline" → `/timeline`, "📸 Post Baru", "Tajuk *" (placeholder "cth: Sijil Kecemerlangan Matematik 2026", maxlength 150), "Kategori *" with "✍️ Cerita" selected and the five options in order, "Tarikh Acara", "Cerita / Keterangan" (placeholder "Ceritakan pengalaman anda...", maxlength 2000) + "Maks 2000 aksara", "Gambar * (Maks 5 gambar, 2MB setiap satu)", the drop zone texts, "Batal" and "Terbitkan".
- **AC-M08-29.2** Given an empty Tajuk, when I press "Terbitkan", then the native required message stops the submit.
- **AC-M08-29.3** Given I add 6 images of which one is 3 MB, when they are added, then an alert "{nama} terlalu besar (maks 2MB)" appears for the large one, at most 5 previews show with remove buttons, and "Keterangan Gambar (opsional)" shows one caption input per image ("Keterangan gambar 1..." …, maxlength 200).
- **AC-M08-29.4** Given a valid form with 1 image, when I press "Terbitkan", then the post is created and S16 shows it; without an image the mock refuses with PROPOSED COPY "Sila muat naik sekurang-kurangnya 1 gambar." (provisional, L-5, OQ-M08-02).
- **AC-M08-29.5** Given text typed in the form, when I press "Batal", then `/timeline` opens and nothing is saved.
- **AC-M08-29.6** Given two photos with captions typed, when I add a third photo or remove the first, then the captions typed for the remaining photos are kept with their photos (DV-M08-30; live clears every caption).

**US-M08-30 — Public profile (S18)**
- **AC-M08-30.1** Given no session, when I open `/pelajar/1`, then the standalone page shows "PRESTASIPLUS" → `/`, "Kongsi", "Utama" → `/`, h1 "Admin Demo", "🥉 Bronze", "Pelajar PRESTASIPLUS", chips school, "Darjah 6", "Ahli sejak 25 Oktober 2025", "🪙 Syiling 256", "1 🔥 Kombo" (M14 wallet and streak, XL3-06), "0% 🎯 Tepat".
- **AC-M08-30.2** Given ≥1024px, when it loads, then the cover chips "Pelajar PRESTASIPLUS" and "334 hari bersama" show; the tier card "🥉 Bronze · Tahap 1", bar 51.2%, "244 syiling lagi ke Silver"; "Ringkasan Aktiviti" "0 sesi latihan", "0 hari berlatih", "0 jawapan betul", "5 kombo terpanjang"; stat cards 256 / 1 / 0 / 0%.
- **AC-M08-30.3** Given the page, when it renders, then "Ingin menyokong pelajar ini?", "Jadilah penaja "Anak Angkat" dan bantu pelajar cemerlang!", "Jadi Penaja" → `/sponsor/register`, and the footer "Teruskan usaha Admin!", "Setiap latihan membawa kejayaan ⭐", "— Platform Latih Tubi Interaktif Malaysia", "PRESTASIPLUS" show.
- **AC-M08-30.4** Given a browser without `navigator.share`, when I press "Kongsi", then the page URL is copied and the alert "Link disalin!" appears; with `navigator.share`, the share sheet opens with the name and URL.
- **AC-M08-30.5** Given 375px, when it renders, then the layout is one column, "Utama" shows the icon only, the mini labels are at least 12px (DV-M08-18) and there is no horizontal page scroll.

**US-M08-31 — Kedudukan (S19)**
- **AC-M08-31.1** Given the admin opens `/ranking`, when it loads, then it shows "Kedudukan", subtitle "Nasional", tab "Kedudukan Nasional", "Nasional" pill active, the selects "Subjek" ("Semua Subjek" + 31) and "Tingkatan" ("Semua", "Tingkatan 4", "Tingkatan 5"), and three rows: 🥇 "L8" "2,223" "93.48%", 🥈 "L10" "5,293" "83.79%", 🥉 "L10" "17,612" "89.94%" (fictitious names and schools), with the footer "Menunjukkan 3 dari 3 pelajar".
- **AC-M08-31.2** Given I choose "Matematik", when the form submits, then the URL has `subject_id=3&scope=nasional`, the rows read "L4" "128" "48.85%" (red), "L7" "530" "35.50%" (red), "L8" "889" "99.78%", the footer shows, and every scope pill keeps `subject_id=3`.
- **AC-M08-31.3** Given "Negeri" with no state, when it loads, then the "Negeri" select ("Pilih Negeri", "Selangor") shows, the subtitle reads "Negeri" and the tab "Kedudukan Negeri" (DV-M08-22; live "Nasional"), and the empty state "🏆" "Tiada data kedudukan" / "Mula menjawab soalan untuk muncul di papan kedudukan!" / "Mula Latihan" → `/practice` shows; choosing "Selangor" shows the three rows **without** the footer, with subtitle and tab "Selangor" (as live).
- **AC-M08-31.4** Given "Daerah" (also with `negeri=Selangor`), "Sekolah" or `tingkatan=T4`, when it loads, then the empty state shows; on Daerah the Negeri select is still shown (DV-M08-23); the subtitle reads "Daerah" / "Sekolah" (DV-M08-22; live "Nasional").
- **AC-M08-31.5** Given `?scope=xyz`, when it loads, then the national list shows without the footer and no pill is active (as live).

**US-M08-32 — Papan Pendahulu (S20)**
- **AC-M08-32.1** Given the admin opens `/leaderboard`, when it loads, then "Minggu Ini" is active, "Kedudukan Anda" reads "#-" "Ranking", "0" "Koin", "0" "Sesi", "0%" "Ketepatan", the podium shows #2 "89% ketepatan" "1,215", #1 👑 "98% ketepatan" "1,547", #3 "99% ketepatan" "787", the table (headers not upper case) has 46 rows starting 98%, 89%, 99%, 68%, 100%, and the footer "46 peserta bersaing" and (≥768px) "Dikemaskini real-time".
- **AC-M08-32.2** Given "Semua Masa", when it loads, then "Kedudukan Anda" reads "#1050", "26", "4", "22%"; the podium #1 "88% ketepatan" "64,689", #2 "100% ketepatan" (live 101%, DV-M08-07) "30,510", #3 "93% ketepatan" "25,736"; the table has 50 rows and "50 peserta bersaing".
- **AC-M08-32.3** Given "Bulan Ini", when it loads, then the podium reads #1 "94%" "5,199", #2 "99%" "3,363", #3 "85%" "2,999", 50 rows, and "Kedudukan Anda" "#-".
- **AC-M08-32.4** Given `?period=xyz` or no parameter, when it loads, then "Minggu Ini" is active; the subtitle stays "Siapa juara minggu ini?" for every period.
- **AC-M08-32.5** Given the student (week coins 70 from P1–P4), when "Minggu Ini" loads, then "Kedudukan Anda" reads "#39", "70", "4", "65%", and the table is the same 46-row list the admin sees, with the student at row 39 (the list is shared by every viewer; provisional for the membership rule, INFERRED).
- **AC-M08-32.6** Given 375px, when the page renders, then the table shows #, Pelajar and Koin only, Sesi appears from 768px and Ketepatan from 1024px, the accuracy pills are green ≥80, amber 60–79.9, red <60, and the podium fits with no horizontal page scroll (DV-M08-10).

**US-M08-33 — Laporan Mingguan (S21)**
- **AC-M08-33.1** Given the admin, when I open `/laporan-mingguan` or `/laporan-mingguan?week=1`, then the standalone 403 page "Akses Ditolak" shows with "Halaman Utama" and "Log Masuk" (OBSERVED).
- **AC-M08-33.2** Given the sidebar and drawer, when they render for the admin, then "Laporan Mingguan" is listed as live.
- **AC-M08-33.3** Given a student, parent or teacher, when they open `/laporan-mingguan`, then the page is not specified (BLOCKED, OQ-M08-01): the prototype's temporary stand-in is not asserted (provisional).

**US-M08-34 — Responsive and readable**
- **AC-M08-34.1** Given every M08 screen at 375, 768 and 1280px, when it loads with the seed, then `document.documentElement.scrollWidth` ≤ the viewport width (DV-M08-10 fixes S6, S7 and S20).
- **AC-M08-34.2** Given every M08 screen, when it renders, then no text inside M08 page content is smaller than 12px at any width (DV-M08-18); decorative icons keep their live size; shell text is M23's.
- **AC-M08-34.3** Given wide tables (S1 subject GPS, S3 class comparison, S5 ranking, S8 list, S11 tables, S15 tables, S23 table), when the viewport is narrower than the table, then the table scrolls inside its own card.

**US-M08-35 — Class headcount summary (S5)**
- **AC-M08-35.1** Given the admin opens class 516, when it loads, then the header reads "4 Simulasi" / "{sekolah} · 2026 · Kod: DEMO-4S", the cards 15 · 0% · 0 · 0 · 0m · 0, and the block "📈 Headcount — Ringkasan Kelas" shows "7" "On Track / Above", "8" "Below Target", "0" "Tiada Data", a bar of 46.67% / 53.33% / 0%, "Purata TOV: 62.1%", "Purata ETR: 71.9%" and "Lihat Penuh →" → `/headcount/213/summary`.
- **AC-M08-35.2** Given class 516 "🏆 Kedudukan Murid", when it renders, then 7 rows show the badge "On Track" and 8 rows "Below" (DV-M08-29; live 6 / 9), all rows Sesi 0, Soalan 0, Ketepatan "—", Terakhir Aktif "—", and "⚠️ Perlu Perhatian (15)" lists 15 "Belum mula berlatih" / "Tak Aktif".
- **AC-M08-35.3** Given the teacher opens class 2001, when it loads, then the block (config 504) reads "0" "On Track / Above", "1" "Below Target", "7" "Tiada Data", "Purata TOV: 50.0%", "Purata ETR: 65.0%", "Lihat Penuh →" → `/headcount/504/summary` (provisional: latest-config rule INFERRED).
- **AC-M08-35.4** Given class 4 or 228 (no headcount config), when it loads, then no headcount block is shown.

**US-M08-36 — Class summary per OTR (S22)**
- **AC-M08-36.1** Given the admin opens `/headcount/213/summary`, when it loads, then it shows the back link → `/headcount/213`, h1 "Ringkasan Kelas", "Sejarah · 4 Simulasi · Tingkatan 4 · 2026", and the cards "15" Jumlah Murid, "62.1" Purata TOV (%), "71.9" Purata ETR (%), "3" OTR Aktif (2 columns below 1024px, 4 from 1024px).
- **AC-M08-36.2** Given "Taburan Prestasi Per OTR", when it renders, then OTR1 and OTR2 read "Above: 0", "On Track: 0", "Below: 0", "N/A: 15" (bar all slate, title "N/A: 15") and OTR3 reads "Above: 5", "On Track: 2", "Below: 8", "N/A: 0" with bar segments titled "Above: 5", "On Track: 2", "Below: 8"; the legend reads "Above Target", "On Track (±2%)", "Below Target", "Belum Diisi".
- **AC-M08-36.3** Given the buttons, when I press "Lihat Table Penuh", then `/headcount/213` opens; "Export CSV" points to `/headcount/213/export` (download content UNVERIFIED, L-12; provisional).

**US-M08-37 — Headcount table (S23)**
- **AC-M08-37.1** Given the admin opens `/headcount/213`, when it loads, then it shows the back link → `/headcount`, h1 "Sejarah", "4 Simulasi · Tingkatan 4 · 2026 · Guru: {nama}", pill "Active", and the chips "On Track: 7 (47%)", "Below: 8 (53%)", "Belum Diisi: 0", "Jumlah: 15" (DV-M08-29; live 6 (40%) / 9 (60%)).
- **AC-M08-37.2** Given the table, when it renders, then it has the columns # · Nama · TOV · OTR1 · AR1 · OTR2 · AR2 · OTR3 · AR3 · ETR with "%" and "Gred" sub-headers, 15 student rows (names → `/headcount/student/{id}`), AR3 cells green for the 7 students with AR ≥ OTR − 2 (Murid Simulasi 04–09 and 11, incl. Murid Simulasi 07 at −2) and red for the 8 below, and the last row "Purata Kelas" 62.1 B · 67.1 B+ · 72.1 A- · 77.1 A- · 71.9 A- · 71.9 A-; "Ranking" (`?sort=ranking`) is active by default and "A-Z" (`?sort=name`) orders the rows by name.
- **AC-M08-37.3** Given the actions, when they render, then "Key-in AR" opens a dropdown "OTR1", "OTR2", "OTR3" → `/headcount/213/results/1…3`, and "Edit TOV/ETR" → `/headcount/213/edit`, "Export CSV" → `/export`, "Ringkasan Kelas" → `/summary`, "Unjuran" → `/unjuran`, "Tetapan" → `/settings` (target pages UNVERIFIED, L-12; provisional).
- **AC-M08-37.4** Given I press "Reset Data", when the modal opens, then it reads "Reset Semua Data?", "Semua markah murid akan dikosongkan — TOV, ETR, OTR, AR & RS.", "Yang kekal selamat:", "Senarai murid (tidak dipadam)", "Tetapan headcount (subjek, kelas, tahun)", "Batal", "Ya, Reset"; "Batal" or the backdrop closes it; "Padam" opens "Padam Headcount?", "Anda pasti mahu padam headcount Sejarah (4 Simulasi, 2026)?", "Semua data murid, TOV, ETR, OTR, AR & RS akan dipadam secara kekal.", "Batal", "Ya, Padam".
- **AC-M08-37.5** Given I tick one student row, when it is ticked, then the bar "1 murid dipilih" with "Gugurkan", "Kembalikan" and "Batal" shows; "Batal" clears the selection and hides the bar; the select-all box ticks every row.
- **AC-M08-37.6** Given "Ya, Reset", "Ya, Padam", "Gugurkan" or "Kembalikan", when pressed, then the prototype applies the INFERRED effect (reset clears TOV/ETR/OTR/AR/RS, delete removes the config, drop/restore toggles the student's dropped state) and returns to the page (results UNVERIFIED, L-12; provisional).

---

## 5. UI expectations

| Screen | Key states (screenshots in `docs/discovery/img/M08/`) | Behaviour notes |
|---|---|---|
| S1 | populated (`prestasi-sekolah-desktop/-tablet/-mobile.png`) | 7-card stat grid; GPS + distribution 1/3 + 2/3 at `lg`; tables scroll in their cards; teacher list scrolls inside a 384px box. |
| S2 | 2 cards (`tingkatan-pilih-desktop.png`) | 1 column below 640px. |
| S3 | T4 with 13 rows (`tingkatan-t4-desktop/-mobile.png`, `tingkatan-t4-class-table.png`), T5; 404 for other levels | 9-column table scrolls in its card; lists 2 columns at `lg`. |
| S4 | empty (`kelas-pilih-empty.png`); populated (L-6, PROPOSED) | — |
| S5 | no activity (class 4), trend (class 228: `kelas-dashboard-*.png`), headcount block (class 516: `kelas-headcount-516.png`) | stats 2 / 3 / 6 columns; attention 1/3 + trend 2/3 at `lg`; block 1 / 3 columns. |
| S6 | empty own (`prestasi-360-empty.png`), tooltip, data, headcount status (`prestasi-360-headcount-status*.png`) | hero mini stats from 1024px; chip rows wrap at 375 (DV-M08-10). |
| S7 | default, all weak, Sejarah tab (`analitik-pelajar-*.png`) | tabs scroll horizontally; ring 1/3 + KPIs 2/3 at `lg`; legend wraps. |
| S8 | empty, class 4 (`analitik-kelas-*.png`) | filters stack below 640px; table scrolls. |
| S9 | empty school (`analisa-item-sekolah-*.png`); populated = the observed S30 template (M18 inventory S30, 8880 / 8765 / 2700) | pills wrap; cards 2 columns; question cards full width; subject table scrolls in its card |
| S10 | 750 cards (`analisa-item-kelas-pilih-*.png`) | 1 / 2 / 3 columns. |
| S11 | difficulty, row open, discrimination, empty, empty-disc, 403 (`analisa-item-*.png`) | 3 summary cards at every width; Subjek/Topik column hidden below 640px. |
| S12 | empty, Auto-Setup modal (`headcount-*.png`) | modal full width at 375, buttons side by side. |
| S13 | empty (`headcount-dashboard-desktop.png`); with data (SOURCE-DERIVED) | — |
| S14 | form (`headcount-create-*.png`) | mode cards 2 columns from 768px. |
| S15 | no targets (`headcount-pelajar-*.png`), populated with RS and prediction box (`headcount-pelajar-populated*.png`, `-selisih-besar.png`, `-hampir-tepat.png`) | chart 200px per section; table scrolls. |
| S16/S17 | empty timeline, form (`timeline-*.png`) | Kategori + Tarikh 2 columns from 640px; Batal/Terbitkan side by side. |
| S18 | own profile (`profil-awam-*.png`) | 3-column layout at `lg`; cover chips from 1024px. |
| S19 | national, negeri empty (`ranking-*.png`) | pills scroll horizontally; names truncate. |
| S20 | week (`leaderboard-*.png`) | Sesi from 768px, Ketepatan from 1024px. |
| S21 | 403 (`laporan-mingguan-403.png`) | standalone. |
| S22 | config 213 (`headcount-ringkasan-desktop/-mobile.png`) | cards 2 / 4 columns; per-OTR blocks stacked. |
| S23 | config 213, reset modal (`headcount-kelas-*.png`, `headcount-kelas-reset-modal.png`) | actions wrap; table scrolls inside its card. |

Loading: live pages are server-rendered and show no spinner; the prototype renders each screen after its mock response with no new spinner copy (SRS §8.3).

---

## 6. Coverage matrix (completeness proof)

Source: `docs/discovery/inventory/M08/` (1,553 content elements, 23 screens, after the audit top-up). Generated by script (`gen.js` + `fns.js` in the author's scratchpad `m08/writer/`; reproducible from the Function catalogue and the inventory JSON). Every M08 content element (S1–S23) is listed with the Function that covers it or with a concrete exclusion reason; each element maps to exactly one Function. Shell elements are chrome owned by the global shell / M23 and the module each link targets; only M08-relevant ones are mapped individually, the rest are listed by ID range with their owner. "Content" quotes the DOM text as captured (`<masked>`, `<person>`, `<name>`, `<in>`, `<school>`, `<ppd>`, `{id}` = discovery privacy mask).

**Summary**

| Set | Elements | Mapped to an M08 Function | Excluded (with reason) | Unmapped |
|---|---|---|---|---|
| M08 content (S1–S23) | 1553 | 1490 | 63 (M16 tournament banner "LIVE:", "MAIN", "DAFTAR" — hidden user-layout widget, EL-M08-S{1,2,4–17,19,20,22,23}-001–003 and EL-M08-S3-008–010) | 0 |
| User-portal shell SHU | 401 | 46 | 355 (global shell / M23 and linked modules) | 0 |

**1553/1553 M08 content elements covered (1490 mapped, 63 excluded with reason), 0 unmapped.** Including the shell: 1954/1954 elements accounted for (1536 mapped, 418 excluded with reason). 129 of the 151 Functions in §3 appear in this matrix; the other 22 are behaviour-only Functions (access, server rules, unobservable states) with no element by nature, or the S9 Functions observed on the shared S30 template (FN-M08-4.1.5–4.1.10; elements EL-M18-S30-020…093 in the M18 inventory).

### 6.1 M08 content elements

#### S1 — `/prestasi (→ /prestasi/sekolah)` (111 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M08-S1-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S1-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S1-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S1-004 | card | visible-default | "Dashboard Sekolah" | FN-M08-2.1.1 |
| EL-M08-S1-005 | text | visible-default | "🏫" | FN-M08-2.1.1 |
| EL-M08-S1-006 | heading | visible-default | "Dashboard Sekolah" | FN-M08-2.1.1 |
| EL-M08-S1-007 | text | visible-default | "Ringkasan prestasi keseluruhan · 750 kelas · 4533 murid" | FN-M08-2.1.1 |
| EL-M08-S1-008 | link | visible-default | "Tingkatan", → /prestasi/tingkatan | FN-M08-2.1.1 |
| EL-M08-S1-009 | link | visible-default | "Kelas", → /prestasi/kelas | FN-M08-2.1.1 |
| EL-M08-S1-010 | card | visible-default | "4533" | FN-M08-2.1.2 |
| EL-M08-S1-011 | text | visible-default | "4533" | FN-M08-2.1.2 |
| EL-M08-S1-012 | text | visible-default | "Murid" | FN-M08-2.1.2 |
| EL-M08-S1-013 | card | visible-default | "551" | FN-M08-2.1.2 |
| EL-M08-S1-014 | text | visible-default | "551" | FN-M08-2.1.2 |
| EL-M08-S1-015 | text | visible-default | "Guru" | FN-M08-2.1.2 |
| EL-M08-S1-016 | card | visible-default | "750" | FN-M08-2.1.2 |
| EL-M08-S1-017 | text | visible-default | "750" | FN-M08-2.1.2 |
| EL-M08-S1-018 | text | visible-default | "Kelas" | FN-M08-2.1.2 |
| EL-M08-S1-019 | card | visible-default | "27" | FN-M08-2.1.2 |
| EL-M08-S1-020 | text | visible-default | "27" | FN-M08-2.1.2 |
| EL-M08-S1-021 | text | visible-default | "Subjek" | FN-M08-2.1.2 |
| EL-M08-S1-022 | card | visible-default | "32122" | FN-M08-2.1.2 |
| EL-M08-S1-023 | text | visible-default | "32122" | FN-M08-2.1.2 |
| EL-M08-S1-024 | text | visible-default | "Sesi Latihan" | FN-M08-2.1.2 |
| EL-M08-S1-025 | card | visible-default | "478,499" | FN-M08-2.1.2 |
| EL-M08-S1-026 | text | visible-default | "478,499" | FN-M08-2.1.2 |
| EL-M08-S1-027 | text | visible-default | "Soalan Dijawab" | FN-M08-2.1.2 |
| EL-M08-S1-028 | card | visible-default | "79.8%" | FN-M08-2.1.2 |
| EL-M08-S1-029 | text | visible-default | "79.8%" | FN-M08-2.1.2 |
| EL-M08-S1-030 | text | visible-default | "Purata Ketepatan" | FN-M08-2.1.2 |
| EL-M08-S1-031 | card | visible-default | "📊 GPS Anggaran" | FN-M08-2.1.3 |
| EL-M08-S1-032 | heading | visible-default | "📊 GPS Anggaran" | FN-M08-2.1.3 |
| EL-M08-S1-033 | text | visible-default | "Gred Purata Sekolah (lebih rendah = lebih baik)" | FN-M08-2.1.3 |
| EL-M08-S1-034 | text | visible-default | "3.45" | FN-M08-2.1.3 |
| EL-M08-S1-035 | text | visible-default | "GPS" | FN-M08-2.1.3 |
| EL-M08-S1-036 | text | visible-default | "Sederhana" | FN-M08-2.1.3 |
| EL-M08-S1-037 | text | visible-default | "Berdasarkan entri headcount" | FN-M08-2.1.3 |
| EL-M08-S1-038 | text | visible-default | "744" | FN-M08-2.1.3 |
| EL-M08-S1-039 | text | visible-default | "* Anggaran dari markah OTR, bukan SPM sebenar" | FN-M08-2.1.3 |
| EL-M08-S1-040 | card | visible-default | "📈 Taburan Gred (Anggaran)" | FN-M08-2.1.4 |
| EL-M08-S1-041 | heading | visible-default | "📈 Taburan Gred (Anggaran)" | FN-M08-2.1.4 |
| EL-M08-S1-042 | text | visible-default | "A+" | FN-M08-2.1.4 |
| EL-M08-S1-043 | text | visible-default | "125" | FN-M08-2.1.4 |
| EL-M08-S1-044 | text | visible-default | "16.8%" | FN-M08-2.1.4 |
| EL-M08-S1-045 | text | visible-default | "A" | FN-M08-2.1.4 |
| EL-M08-S1-046 | text | visible-default | "146" | FN-M08-2.1.4 |
| EL-M08-S1-047 | text | visible-default | "19.6%" | FN-M08-2.1.4 |
| EL-M08-S1-048 | text | visible-default | "A-" | FN-M08-2.1.4 |
| EL-M08-S1-049 | text | visible-default | "96" | FN-M08-2.1.4 |
| EL-M08-S1-050 | text | visible-default | "12.9%" | FN-M08-2.1.4 |
| EL-M08-S1-051 | text | visible-default | "B+" | FN-M08-2.1.4 |
| EL-M08-S1-052 | text | visible-default | "47" | FN-M08-2.1.4 |
| EL-M08-S1-053 | text | visible-default | "6.3%" | FN-M08-2.1.4 |
| EL-M08-S1-054 | text | visible-default | "B" | FN-M08-2.1.4 |
| EL-M08-S1-055 | text | visible-default | "107" | FN-M08-2.1.4 |
| EL-M08-S1-056 | text | visible-default | "14.4%" | FN-M08-2.1.4 |
| EL-M08-S1-057 | text | visible-default | "C+" | FN-M08-2.1.4 |
| EL-M08-S1-058 | text | visible-default | "24" | FN-M08-2.1.4 |
| EL-M08-S1-059 | text | visible-default | "3.2%" | FN-M08-2.1.4 |
| EL-M08-S1-060 | text | visible-default | "C" | FN-M08-2.1.4 |
| EL-M08-S1-061 | text | visible-default | "23" | FN-M08-2.1.4 |
| EL-M08-S1-062 | text | visible-default | "3.1%" | FN-M08-2.1.4 |
| EL-M08-S1-063 | text | visible-default | "D" | FN-M08-2.1.4 |
| EL-M08-S1-064 | text | visible-default | "76" | FN-M08-2.1.4 |
| EL-M08-S1-065 | text | visible-default | "10.2%" | FN-M08-2.1.4 |
| EL-M08-S1-066 | text | visible-default | "E" | FN-M08-2.1.4 |
| EL-M08-S1-067 | text | visible-default | "28" | FN-M08-2.1.4 |
| EL-M08-S1-068 | text | visible-default | "3.8%" | FN-M08-2.1.4 |
| EL-M08-S1-069 | text | visible-default | "G" | FN-M08-2.1.4 |
| EL-M08-S1-070 | text | visible-default | "72" | FN-M08-2.1.4 |
| EL-M08-S1-071 | text | visible-default | "9.7%" | FN-M08-2.1.4 |
| EL-M08-S1-072 | text | visible-default | "Jumlah: 744 rekod" | FN-M08-2.1.4 |
| EL-M08-S1-073 | card | visible-default | "📉 Trend GPS (5 Tahun)" | FN-M08-2.1.5 |
| EL-M08-S1-074 | heading | visible-default | "📉 Trend GPS (5 Tahun)" | FN-M08-2.1.5 |
| EL-M08-S1-075 | text | visible-default | "2022–2026 · lebih rendah = lebih baik" | FN-M08-2.1.5 |
| EL-M08-S1-076 | text | visible-default | "Paksi Y diterbalikkan: 0 (A+) di atas, 9 (G) di bawah." | FN-M08-2.1.5 |
| EL-M08-S1-077 | table | visible-default | columns: Tahun · GPS Keseluruhan · Tahap · Calon · Sumber · Perubahan | FN-M08-2.1.5 |
| EL-M08-S1-078 | alert | visible-default | "Sederhana" | FN-M08-2.1.5 |
| EL-M08-S1-079 | alert | visible-default | "Sederhana" | FN-M08-2.1.5 |
| EL-M08-S1-080 | alert | visible-default | "Sederhana" | FN-M08-2.1.5 |
| EL-M08-S1-081 | alert | visible-default | "Sederhana" | FN-M08-2.1.5 |
| EL-M08-S1-082 | card | visible-default | "📚 GPS Mengikut Subjek" | FN-M08-2.1.6 |
| EL-M08-S1-083 | heading | visible-default | "📚 GPS Mengikut Subjek" | FN-M08-2.1.6 |
| EL-M08-S1-084 | table | visible-default | columns: # · Subjek · GPS · Gred · Entri · On Track · Below · Tiada Sasaran · Pencapaian | FN-M08-2.1.6 |
| EL-M08-S1-085 | card | visible-default | "🎓 Perbandingan Tingkatan" | FN-M08-2.1.7 |
| EL-M08-S1-086 | heading | visible-default | "🎓 Perbandingan Tingkatan" | FN-M08-2.1.7 |
| EL-M08-S1-087 | link | visible-default | "Tingkatan 4 63.9% 11 kelas 148 murid 10 sesi latihan", → /prestasi/tingkatan/t4 | FN-M08-2.1.7 |
| EL-M08-S1-088 | link | visible-default | "Tingkatan 5 79.8% 560 kelas 3467 murid 25716 sesi latihan", → /prestasi/tingkatan/t5 | FN-M08-2.1.7 |
| EL-M08-S1-089 | card | visible-default | "👩‍🏫 Prestasi Guru" | FN-M08-2.1.8 |
| EL-M08-S1-090 | heading | visible-default | "👩‍🏫 Prestasi Guru" | FN-M08-2.1.8 |
| EL-M08-S1-091 | text | visible-default | "." | FN-M08-2.1.8 |
| EL-M08-S1-092 | text | visible-default | "1 kelas · 0 murid" | FN-M08-2.1.8 |
| EL-M08-S1-093 | text | visible-default | "Ketepatan:" | FN-M08-2.1.8 |
| EL-M08-S1-094 | text | visible-default | "0%" | FN-M08-2.1.8 |
| EL-M08-S1-095 | empty-state | visible-default | "Tiada data headcount" | FN-M08-2.1.8 |
| EL-M08-S1-096 | text | visible-default | "<masked>" | FN-M08-2.1.8 |
| EL-M08-S1-097 | text | visible-default | "2 kelas · 76 murid" | FN-M08-2.1.8 |
| EL-M08-S1-098 | text | visible-default | "Ketepatan:" | FN-M08-2.1.8 |
| EL-M08-S1-099 | text | visible-default | "72.5%" | FN-M08-2.1.8 |
| EL-M08-S1-100 | empty-state | visible-default | "Tiada data headcount" | FN-M08-2.1.8 |
| EL-M08-S1-101 | text | visible-default | "<masked>" | FN-M08-2.1.8 |
| EL-M08-S1-102 | text | visible-default | "3 kelas · 89 murid" | FN-M08-2.1.8 |
| EL-M08-S1-103 | text | visible-default | "Ketepatan:" | FN-M08-2.1.8 |
| EL-M08-S1-104 | text | visible-default | "72.7%" | FN-M08-2.1.8 |
| EL-M08-S1-105 | empty-state | visible-default | "Tiada data headcount" | FN-M08-2.1.8 |
| EL-M08-S1-106 | card | visible-default | "🔗 Navigasi Pantas" | FN-M08-2.1.9 |
| EL-M08-S1-107 | heading | visible-default | "🔗 Navigasi Pantas" | FN-M08-2.1.9 |
| EL-M08-S1-108 | link | visible-default | "🎓 Dashboard Tingkatan", → /prestasi/tingkatan | FN-M08-2.1.9 |
| EL-M08-S1-109 | link | visible-default | "📊 Dashboard Kelas", → /prestasi/kelas | FN-M08-2.1.9 |
| EL-M08-S1-110 | link | visible-default | "📈 Headcount", → /headcount | FN-M08-2.1.9 |
| EL-M08-S1-111 | link | visible-default | "🔬 Analisa Item", → /analisa-item/sekolah | FN-M08-2.1.9 |

#### S2 — `/prestasi/tingkatan` (7 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M08-S2-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S2-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S2-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S2-004 | link | visible-default | "Tingkatan 4 13 kelas \| 149 murid", → /prestasi/tingkatan/t4, svg | FN-M08-2.2.1 |
| EL-M08-S2-005 | heading | visible-default | "Tingkatan 4" | FN-M08-2.2.1 |
| EL-M08-S2-006 | link | visible-default | "Tingkatan 5 645 kelas \| 3911 murid", → /prestasi/tingkatan/t5, svg | FN-M08-2.2.1 |
| EL-M08-S2-007 | heading | visible-default | "Tingkatan 5" | FN-M08-2.2.1 |

#### S3 — `/prestasi/tingkatan/{t4|t5}` (134 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M08-S3-001 | text | visible-default | "404" | FN-M08-1.2.3 |
| EL-M08-S3-002 | text | visible-default | "🔍" | FN-M08-1.2.3 |
| EL-M08-S3-003 | heading | visible-default | "Halaman Tidak Dijumpai" | FN-M08-1.2.3 |
| EL-M08-S3-004 | text | visible-default | "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?" | FN-M08-1.2.3 |
| EL-M08-S3-005 | link | visible-default | "Halaman Utama", → / | FN-M08-1.2.3 |
| EL-M08-S3-006 | link | visible-default | "Mula Latihan", → /latih-tubi | FN-M08-1.2.3 |
| EL-M08-S3-007 | text | visible-default | "PRESTASIPLUS" | FN-M08-1.2.3 |
| EL-M08-S3-008 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S3-009 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S3-010 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S3-011 | card | conditional | "←" | FN-M08-2.3.1 |
| EL-M08-S3-012 | link | conditional | "←", → /prestasi/tingkatan | FN-M08-2.3.1 |
| EL-M08-S3-013 | heading | conditional | "Tingkatan 4" | FN-M08-2.3.1 |
| EL-M08-S3-014 | text | conditional | "Dashboard Prestasi Tingkatan · 13 kelas · 5 subjek" | FN-M08-2.3.1 |
| EL-M08-S3-015 | link | conditional | "T4", → /prestasi/tingkatan/t4 | FN-M08-2.3.1 |
| EL-M08-S3-016 | link | conditional | "T5", → /prestasi/tingkatan/t5 | FN-M08-2.3.1 |
| EL-M08-S3-017 | text | conditional | "13" | FN-M08-2.3.2 |
| EL-M08-S3-018 | text | conditional | "Kelas" | FN-M08-2.3.2 |
| EL-M08-S3-019 | text | conditional | "149" | FN-M08-2.3.2 |
| EL-M08-S3-020 | text | conditional | "Murid" | FN-M08-2.3.2 |
| EL-M08-S3-021 | text | conditional | "63.9%" | FN-M08-2.3.2 |
| EL-M08-S3-022 | text | conditional | "Purata Ketepatan" | FN-M08-2.3.2 |
| EL-M08-S3-023 | text | conditional | "10" | FN-M08-2.3.2 |
| EL-M08-S3-024 | text | conditional | "Jumlah Sesi" | FN-M08-2.3.2 |
| EL-M08-S3-025 | text | conditional | "34" | FN-M08-2.3.2 |
| EL-M08-S3-026 | text | conditional | "On Track" | FN-M08-2.3.2 |
| EL-M08-S3-027 | text | conditional | "41" | FN-M08-2.3.2 |
| EL-M08-S3-028 | text | conditional | "Below Target" | FN-M08-2.3.2 |
| EL-M08-S3-029 | card | conditional | "45% On Track" | FN-M08-2.3.3 |
| EL-M08-S3-030 | text | conditional | "Headcount Keseluruhan" | FN-M08-2.3.3 |
| EL-M08-S3-031 | text | conditional | "45% On Track" | FN-M08-2.3.3 |
| EL-M08-S3-032 | text | conditional | "On Track: 34" | FN-M08-2.3.3 |
| EL-M08-S3-033 | text | conditional | "Below Target: 41" | FN-M08-2.3.3 |
| EL-M08-S3-034 | card | conditional | "Perbandingan Kelas" | FN-M08-2.3.4 |
| EL-M08-S3-035 | heading | conditional | "Perbandingan Kelas" | FN-M08-2.3.4 |
| EL-M08-S3-036 | table | conditional | columns: Kelas · Subjek · Guru · Murid · Sesi · Ketepatan · On Track · Below · Aksi | FN-M08-2.3.4 |
| EL-M08-S3-037 | link | conditional | "Lihat →", → /prestasi/kelas/419 | FN-M08-2.3.4 |
| EL-M08-S3-038 | link | conditional | "Lihat →", → /prestasi/kelas/516 | FN-M08-2.3.4 |
| EL-M08-S3-039 | link | conditional | "Lihat →", → /prestasi/kelas/4 | FN-M08-2.3.4 |
| EL-M08-S3-040 | link | conditional | "Lihat →", → /prestasi/kelas/5 | FN-M08-2.3.4 |
| EL-M08-S3-126 | link | conditional | "Lihat →", → /prestasi/kelas/6 | FN-M08-2.3.4 |
| EL-M08-S3-127 | link | conditional | "Lihat →", → /prestasi/kelas/90 | FN-M08-2.3.4 |
| EL-M08-S3-128 | link | conditional | "Lihat →", → /prestasi/kelas/25 | FN-M08-2.3.4 |
| EL-M08-S3-129 | link | conditional | "Lihat →", → /prestasi/kelas/115 | FN-M08-2.3.4 |
| EL-M08-S3-130 | link | conditional | "Lihat →", → /prestasi/kelas/8 | FN-M08-2.3.4 |
| EL-M08-S3-131 | link | conditional | "Lihat →", → /prestasi/kelas/9 | FN-M08-2.3.4 |
| EL-M08-S3-132 | link | conditional | "Lihat →", → /prestasi/kelas/10 | FN-M08-2.3.4 |
| EL-M08-S3-133 | link | conditional | "Lihat →", → /prestasi/kelas/sc-419 | FN-M08-2.3.4 |
| EL-M08-S3-134 | link | conditional | "Lihat →", → /prestasi/kelas/sc-806 | FN-M08-2.3.4 |
| EL-M08-S3-041 | card | conditional | "Murid Terbaik" | FN-M08-2.3.5 |
| EL-M08-S3-042 | heading | conditional | "Murid Terbaik" | FN-M08-2.3.5 |
| EL-M08-S3-043 | text | conditional | "1" | FN-M08-2.3.5 |
| EL-M08-S3-044 | text | conditional | "<masked>" | FN-M08-2.3.5 |
| EL-M08-S3-045 | text | conditional | "3 sesi · 30 soalan" | FN-M08-2.3.5 |
| EL-M08-S3-046 | text | conditional | "93.3%" | FN-M08-2.3.5 |
| EL-M08-S3-047 | text | conditional | "2" | FN-M08-2.3.5 |
| EL-M08-S3-048 | text | conditional | "<masked>" | FN-M08-2.3.5 |
| EL-M08-S3-049 | text | conditional | "4 sesi · 60 soalan" | FN-M08-2.3.5 |
| EL-M08-S3-050 | text | conditional | "64%" | FN-M08-2.3.5 |
| EL-M08-S3-051 | card | conditional | "Murid Berisiko" | FN-M08-2.3.6 |
| EL-M08-S3-052 | heading | conditional | "Murid Berisiko" | FN-M08-2.3.6 |
| EL-M08-S3-053 | link | conditional | "<masked> 4 Simulasi · OTR3: 56.00% (sasaran 82.00%) -26", → /prestasi?{id} | FN-M08-2.3.6 |
| EL-M08-S3-054 | link | conditional | "<masked> 4 Simulasi · OTR3: 58.00% (sasaran 77.00%) -19", → /prestasi?{id} | FN-M08-2.3.6 |
| EL-M08-S3-055 | link | conditional | "<masked> 4 Simulasi · OTR3: 75.00% (sasaran 93.00%) -18", → /prestasi?{id} | FN-M08-2.3.6 |
| EL-M08-S3-056 | link | conditional | "<masked> 4 Simulasi · OTR3: 65.00% (sasaran 83.00%) -18", → /prestasi?{id} | FN-M08-2.3.6 |
| EL-M08-S3-057 | link | conditional | "<masked> 4 Simulasi · OTR3: 57.00% (sasaran 74.00%) -17", → /prestasi?{id} | FN-M08-2.3.6 |
| EL-M08-S3-058 | link | conditional | "<masked> 4 Simulasi · OTR3: 66.00% (sasaran 82.00%) -16", → /prestasi?{id} | FN-M08-2.3.6 |
| EL-M08-S3-059 | link | conditional | "<masked> 4 Simulasi · OTR3: 68.00% (sasaran 84.00%) -16", → /prestasi?{id} | FN-M08-2.3.6 |
| EL-M08-S3-060 | link | conditional | "<masked> 4 Simulasi · OTR3: 83.00% (sasaran 98.00%) -15", → /prestasi?{id} | FN-M08-2.3.6 |
| EL-M08-S3-061 | link | conditional | "<masked> 4 Simulasi · OTR3: 64.00% (sasaran 79.00%) -15", → /prestasi?{id} | FN-M08-2.3.6 |
| EL-M08-S3-062 | link | conditional | "<masked> 4 Simulasi · OTR3: 68.00% (sasaran 82.00%) -14", → /prestasi?{id} | FN-M08-2.3.6 |
| EL-M08-S3-063 | link | conditional | "<masked> 4 Simulasi · OTR3: 75.00% (sasaran 89.00%) -14", → /prestasi?{id} | FN-M08-2.3.6 |
| EL-M08-S3-064 | link | conditional | "<masked> 4 Simulasi · OTR3: 69.00% (sasaran 82.00%) -13", → /prestasi?{id} | FN-M08-2.3.6 |
| EL-M08-S3-065 | link | conditional | "<masked> 4 Simulasi · OTR3: 62.00% (sasaran 75.00%) -13", → /prestasi?{id} | FN-M08-2.3.6 |
| EL-M08-S3-066 | link | conditional | "<masked> 4 Simulasi · OTR3: 61.00% (sasaran 74.00%) -13", → /prestasi?{id} | FN-M08-2.3.6 |
| EL-M08-S3-067 | link | conditional | "<masked> 4 Simulasi · OTR3: 83.00% (sasaran 93.00%) -10", → /prestasi?{id} | FN-M08-2.3.6 |
| EL-M08-S3-068 | heading | conditional | "Tingkatan 5" | FN-M08-2.3.1 |
| EL-M08-S3-069 | text | conditional | "Dashboard Prestasi Tingkatan · 645 kelas · 26 subjek" | FN-M08-2.3.1 |
| EL-M08-S3-070 | text | conditional | "79.7%" | FN-M08-2.3.2 |
| EL-M08-S3-071 | card | conditional | "28% On Track" | FN-M08-2.3.3 |
| EL-M08-S3-072 | text | conditional | "28% On Track" | FN-M08-2.3.3 |
| EL-M08-S3-073 | text | conditional | "On Track: 114" | FN-M08-2.3.3 |
| EL-M08-S3-074 | text | conditional | "Below Target: 289" | FN-M08-2.3.3 |
| EL-M08-S3-075 | text | conditional | "3 sesi · 15 soalan" | FN-M08-2.3.5 |
| EL-M08-S3-076 | text | conditional | "126.7%" | FN-M08-2.3.5 |
| EL-M08-S3-077 | text | conditional | "4 sesi · 50 soalan" | FN-M08-2.3.5 |
| EL-M08-S3-078 | text | conditional | "120%" | FN-M08-2.3.5 |
| EL-M08-S3-079 | text | conditional | "3" | FN-M08-2.3.5 |
| EL-M08-S3-080 | text | conditional | "<masked>" | FN-M08-2.3.5 |
| EL-M08-S3-081 | text | conditional | "6 sesi · 60 soalan" | FN-M08-2.3.5 |
| EL-M08-S3-082 | text | conditional | "118.3%" | FN-M08-2.3.5 |
| EL-M08-S3-083 | text | conditional | "4" | FN-M08-2.3.5 |
| EL-M08-S3-084 | text | conditional | "<masked>" | FN-M08-2.3.5 |
| EL-M08-S3-085 | text | conditional | "3 sesi · 84 soalan" | FN-M08-2.3.5 |
| EL-M08-S3-086 | text | conditional | "108.6%" | FN-M08-2.3.5 |
| EL-M08-S3-087 | text | conditional | "5" | FN-M08-2.3.5 |
| EL-M08-S3-088 | text | conditional | "<masked>" | FN-M08-2.3.5 |
| EL-M08-S3-089 | text | conditional | "5 sesi · 30 soalan" | FN-M08-2.3.5 |
| EL-M08-S3-090 | text | conditional | "108%" | FN-M08-2.3.5 |
| EL-M08-S3-091 | text | conditional | "6" | FN-M08-2.3.5 |
| EL-M08-S3-092 | text | conditional | "<masked>" | FN-M08-2.3.5 |
| EL-M08-S3-093 | text | conditional | "3 sesi · 114 soalan" | FN-M08-2.3.5 |
| EL-M08-S3-094 | text | conditional | "107.8%" | FN-M08-2.3.5 |
| EL-M08-S3-095 | text | conditional | "7" | FN-M08-2.3.5 |
| EL-M08-S3-096 | text | conditional | "<masked>" | FN-M08-2.3.5 |
| EL-M08-S3-097 | text | conditional | "5 sesi · 100 soalan" | FN-M08-2.3.5 |
| EL-M08-S3-098 | text | conditional | "106%" | FN-M08-2.3.5 |
| EL-M08-S3-099 | text | conditional | "8" | FN-M08-2.3.5 |
| EL-M08-S3-100 | text | conditional | "<masked>" | FN-M08-2.3.5 |
| EL-M08-S3-101 | text | conditional | "6 sesi · 55 soalan" | FN-M08-2.3.5 |
| EL-M08-S3-102 | text | conditional | "105%" | FN-M08-2.3.5 |
| EL-M08-S3-103 | text | conditional | "9" | FN-M08-2.3.5 |
| EL-M08-S3-104 | text | conditional | "<masked>" | FN-M08-2.3.5 |
| EL-M08-S3-105 | text | conditional | "3 sesi · 35 soalan" | FN-M08-2.3.5 |
| EL-M08-S3-106 | text | conditional | "103.3%" | FN-M08-2.3.5 |
| EL-M08-S3-107 | text | conditional | "10" | FN-M08-2.3.5 |
| EL-M08-S3-108 | text | conditional | "<masked>" | FN-M08-2.3.5 |
| EL-M08-S3-109 | text | conditional | "13 sesi · 295 soalan" | FN-M08-2.3.5 |
| EL-M08-S3-110 | text | conditional | "103.1%" | FN-M08-2.3.5 |
| EL-M08-S3-111 | link | conditional | "<masked> 5 LEQOE · OTR3: 0.00% (sasaran 70.00%) -70", → /prestasi?{id} | FN-M08-2.3.6 |
| EL-M08-S3-112 | link | conditional | "<masked> 5 ZUHRAH · OTR3: 0.00% (sasaran 69.00%) -69", → /prestasi?{id} | FN-M08-2.3.6 |
| EL-M08-S3-113 | link | conditional | "<masked> 5 IMTIAZ · OTR3: 20.00% (sasaran 88.00%) -68", → /prestasi?{id} | FN-M08-2.3.6 |
| EL-M08-S3-114 | link | conditional | "<masked> 5 BAKTI · OTR3: 20.00% (sasaran 86.00%) -66", → /prestasi?{id} | FN-M08-2.3.6 |
| EL-M08-S3-115 | link | conditional | "<masked> 5 LEQOE · OTR3: 0.00% (sasaran 60.00%) -60", → /prestasi?{id} | FN-M08-2.3.6 |
| EL-M08-S3-116 | link | conditional | "<masked> 5 LEQOE · OTR3: 40.00% (sasaran 98.00%) -58", → /prestasi?{id} | FN-M08-2.3.6 |
| EL-M08-S3-117 | link | conditional | "<masked> 5 CAMELIA · OTR2: 40.00% (sasaran 90.00%) -50", → /prestasi?{id} | FN-M08-2.3.6 |
| EL-M08-S3-118 | link | conditional | "<masked> 5 ZUHRAH · OTR3: 20.00% (sasaran 69.00%) -49", → /prestasi?{id} | FN-M08-2.3.6 |
| EL-M08-S3-119 | link | conditional | "<masked> 5 ZUHRAH · OTR3: 20.00% (sasaran 69.00%) -49", → /prestasi?{id} | FN-M08-2.3.6 |
| EL-M08-S3-120 | link | conditional | "<masked> 5 MUSYTARI · OTR3: 40.00% (sasaran 80.00%) -40", → /prestasi?{id} | FN-M08-2.3.6 |
| EL-M08-S3-121 | link | conditional | "<masked> 5 SAINS TULEN · OTR3: 40.00% (sasaran 78.00%) -38", → /prestasi?{id} | FN-M08-2.3.6 |
| EL-M08-S3-122 | link | conditional | "<masked> 5 IMTIAZ · OTR3: 60.00% (sasaran 96.00%) -36", → /prestasi?{id} | FN-M08-2.3.6 |
| EL-M08-S3-123 | link | conditional | "<masked> 5 NURANI · OTR2: 0.00% (sasaran 33.33%) -33.3", → /prestasi?{id} | FN-M08-2.3.6 |
| EL-M08-S3-124 | link | conditional | "<masked> 5 IKHLAS · OTR1: 20.00% (sasaran 51.33%) -31.3", → /prestasi?{id} | FN-M08-2.3.6 |
| EL-M08-S3-125 | link | conditional | "<masked> 5 JUJUR · OTR3: 40.00% (sasaran 71.00%) -31", → /prestasi?{id} | FN-M08-2.3.6 |

#### S4 — `/prestasi/kelas` (10 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M08-S4-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S4-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S4-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S4-004 | text | visible-default | "📊" | FN-M08-2.4.1 |
| EL-M08-S4-005 | heading | visible-default | "Dashboard Kelas" | FN-M08-2.4.1 |
| EL-M08-S4-006 | text | visible-default | "Pilih kelas untuk lihat prestasi keseluruhan" | FN-M08-2.4.1 |
| EL-M08-S4-007 | text | visible-default | "📭" | FN-M08-2.4.2 |
| EL-M08-S4-008 | text | visible-default | "Anda belum mempunyai kelas aktif." | FN-M08-2.4.2 |
| EL-M08-S4-009 | text | visible-default | "Cipta kelas terlebih dahulu untuk mula memantau prestasi murid." | FN-M08-2.4.2 |
| EL-M08-S4-010 | link | visible-default | "Cipta Kelas", → /guru/kelas/cipta | FN-M08-2.4.2 |

#### S5 — `/prestasi/kelas/{id}` (100 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M08-S5-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S5-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S5-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S5-079 | card | visible-default | "4 Simulasi" | FN-M08-2.5.1 |
| EL-M08-S5-005 | link | visible-default | "←", → /prestasi/kelas | FN-M08-2.5.1 |
| EL-M08-S5-006 | text | visible-default | "📊" | FN-M08-2.5.1 |
| EL-M08-S5-080 | heading | visible-default | "4 Simulasi" | FN-M08-2.5.1 |
| EL-M08-S5-081 | text | visible-default | "<school> · 2026 · Kod:" | FN-M08-2.5.1 |
| EL-M08-S5-082 | text | visible-default | "DEMO-4S" | FN-M08-2.5.1 |
| EL-M08-S5-010 | select | visible-default | 1 options | FN-M08-2.5.2 |
| EL-M08-S5-011 | card | visible-default | "15" | FN-M08-2.5.3 |
| EL-M08-S5-012 | text | visible-default | "15" | FN-M08-2.5.3 |
| EL-M08-S5-013 | text | visible-default | "Jumlah Murid" | FN-M08-2.5.3 |
| EL-M08-S5-014 | card | visible-default | "0%" | FN-M08-2.5.3 |
| EL-M08-S5-015 | text | visible-default | "0%" | FN-M08-2.5.3 |
| EL-M08-S5-016 | text | visible-default | "Purata Ketepatan" | FN-M08-2.5.3 |
| EL-M08-S5-017 | card | visible-default | "0" | FN-M08-2.5.3 |
| EL-M08-S5-018 | text | visible-default | "0" | FN-M08-2.5.3 |
| EL-M08-S5-019 | text | visible-default | "Jumlah Sesi" | FN-M08-2.5.3 |
| EL-M08-S5-020 | card | visible-default | "0" | FN-M08-2.5.3 |
| EL-M08-S5-021 | text | visible-default | "0" | FN-M08-2.5.3 |
| EL-M08-S5-022 | text | visible-default | "Soalan Dijawab" | FN-M08-2.5.3 |
| EL-M08-S5-023 | card | visible-default | "0m" | FN-M08-2.5.3 |
| EL-M08-S5-024 | text | visible-default | "0m" | FN-M08-2.5.3 |
| EL-M08-S5-025 | text | visible-default | "Purata Masa/Sesi" | FN-M08-2.5.3 |
| EL-M08-S5-026 | card | visible-default | "0" | FN-M08-2.5.3 |
| EL-M08-S5-027 | text | visible-default | "0" | FN-M08-2.5.3 |
| EL-M08-S5-028 | text | visible-default | "Aktif 7 Hari" | FN-M08-2.5.3 |
| EL-M08-S5-083 | card | visible-default | "📈 Headcount — Ringkasan Kelas" | FN-M08-2.5.7 |
| EL-M08-S5-084 | heading | visible-default | "📈 Headcount — Ringkasan Kelas" | FN-M08-2.5.7 |
| EL-M08-S5-065 | text | visible-default | "7" | FN-M08-2.5.3 |
| EL-M08-S5-085 | text | visible-default | "On Track / Above" | FN-M08-2.5.7 |
| EL-M08-S5-086 | text | visible-default | "8" | FN-M08-2.5.7 |
| EL-M08-S5-087 | text | visible-default | "Below Target" | FN-M08-2.5.7 |
| EL-M08-S5-088 | text | visible-default | "0" | FN-M08-2.5.7 |
| EL-M08-S5-089 | empty-state | visible-default | "Tiada Data" | FN-M08-2.5.7 |
| EL-M08-S5-090 | text | visible-default | "Purata TOV: 62.1%" | FN-M08-2.5.7 |
| EL-M08-S5-091 | text | visible-default | "Purata ETR: 71.9%" | FN-M08-2.5.7 |
| EL-M08-S5-092 | link | visible-default | "Lihat Penuh →", → /headcount/213/summary | FN-M08-2.5.7 |
| EL-M08-S5-093 | card | visible-default | "⚠️ Perlu Perhatian (15)" | FN-M08-2.5.4 |
| EL-M08-S5-094 | heading | visible-default | "⚠️ Perlu Perhatian (15)" | FN-M08-2.5.4 |
| EL-M08-S5-031 | link | visible-default | "<masked> Belum mula berlatih Tak Aktif", → /prestasi/{id} | FN-M08-2.5.4 |
| EL-M08-S5-032 | badge | visible-default | "Tak Aktif" | FN-M08-2.5.4 |
| EL-M08-S5-033 | link | visible-default | "<masked> Belum mula berlatih Tak Aktif", → /prestasi/{id} | FN-M08-2.5.4 |
| EL-M08-S5-034 | badge | visible-default | "Tak Aktif" | FN-M08-2.5.4 |
| EL-M08-S5-035 | link | visible-default | "<masked> Belum mula berlatih Tak Aktif", → /prestasi/{id} | FN-M08-2.5.4 |
| EL-M08-S5-036 | badge | visible-default | "Tak Aktif" | FN-M08-2.5.4 |
| EL-M08-S5-037 | card | visible-default | "📈 Trend Aktiviti Kelas (30 Hari)" | FN-M08-2.5.5 |
| EL-M08-S5-038 | heading | visible-default | "📈 Trend Aktiviti Kelas (30 Hari)" | FN-M08-2.5.5 |
| EL-M08-S5-039 | text | visible-default | "📭" | FN-M08-2.5.5 |
| EL-M08-S5-040 | text | visible-default | "Belum ada aktiviti dalam 30 hari terakhir." | FN-M08-2.5.5 |
| EL-M08-S5-041 | card | visible-default | "🏆 Kedudukan Murid" | FN-M08-2.5.6 |
| EL-M08-S5-042 | heading | visible-default | "🏆 Kedudukan Murid" | FN-M08-2.5.6 |
| EL-M08-S5-043 | table | visible-default | columns: # · Nama · Sesi · Soalan · Ketepatan · Headcount · Terakhir Aktif · Aksi | FN-M08-2.5.6 |
| EL-M08-S5-095 | badge | visible-default | "On Track" | FN-M08-2.5.6 |
| EL-M08-S5-045 | link | visible-default | "Lihat →", → /prestasi/{id} | FN-M08-2.5.6 |
| EL-M08-S5-096 | badge | visible-default | "On Track" | FN-M08-2.5.6 |
| EL-M08-S5-047 | link | visible-default | "Lihat →", → /prestasi/{id} | FN-M08-2.5.6 |
| EL-M08-S5-097 | badge | visible-default | "On Track" | FN-M08-2.5.6 |
| EL-M08-S5-049 | link | visible-default | "Lihat →", → /prestasi/{id} | FN-M08-2.5.6 |
| EL-M08-S5-098 | badge | visible-default | "On Track" | FN-M08-2.5.6 |
| EL-M08-S5-051 | link | visible-default | "Lihat →", → /prestasi/{id} | FN-M08-2.5.6 |
| EL-M08-S5-004 | card | conditional | "4 Bestari - BM" | FN-M08-2.5.1 |
| EL-M08-S5-007 | heading | conditional | "4 Bestari - BM" | FN-M08-2.5.1 |
| EL-M08-S5-008 | text | conditional | "<school> · Bahasa Melayu · 2026 · Kod:" | FN-M08-2.5.1 |
| EL-M08-S5-009 | text | conditional | "KCC904" | FN-M08-2.5.1 |
| EL-M08-S5-063 | card | conditional | "58" | FN-M08-2.5.3 |
| EL-M08-S5-029 | card | conditional | "⚠️ Perlu Perhatian (58)" | FN-M08-2.5.4 |
| EL-M08-S5-030 | heading | conditional | "⚠️ Perlu Perhatian (58)" | FN-M08-2.5.4 |
| EL-M08-S5-044 | badge | conditional | "N/A" | FN-M08-2.5.6 |
| EL-M08-S5-046 | badge | conditional | "N/A" | FN-M08-2.5.6 |
| EL-M08-S5-048 | badge | conditional | "N/A" | FN-M08-2.5.6 |
| EL-M08-S5-050 | badge | conditional | "N/A" | FN-M08-2.5.6 |
| EL-M08-S5-052 | text | conditional | "404" | FN-M08-1.2.3 |
| EL-M08-S5-053 | text | conditional | "🔍" | FN-M08-1.2.3 |
| EL-M08-S5-054 | heading | conditional | "Halaman Tidak Dijumpai" | FN-M08-1.2.3 |
| EL-M08-S5-055 | text | conditional | "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?" | FN-M08-1.2.3 |
| EL-M08-S5-056 | link | conditional | "Halaman Utama", → / | FN-M08-1.2.3 |
| EL-M08-S5-057 | link | conditional | "Mula Latihan", → /latih-tubi | FN-M08-1.2.3 |
| EL-M08-S5-058 | text | conditional | "PRESTASIPLUS" | FN-M08-1.2.3 |
| EL-M08-S5-059 | card | conditional | "ALFA - Bahasa Inggeris" | FN-M08-2.5.1 |
| EL-M08-S5-060 | heading | conditional | "ALFA - Bahasa Inggeris" | FN-M08-2.5.1 |
| EL-M08-S5-061 | text | conditional | "<school> · Bahasa Inggeris · 2026 · Kod:" | FN-M08-2.5.1 |
| EL-M08-S5-062 | text | conditional | "UDL749" | FN-M08-2.5.1 |
| EL-M08-S5-064 | card | conditional | "93" | FN-M08-2.5.3 |
| EL-M08-S5-066 | card | conditional | "77.6%" | FN-M08-2.5.3 |
| EL-M08-S5-099 | text | conditional | "77.6%" | FN-M08-2.5.3 |
| EL-M08-S5-067 | card | conditional | "1618" | FN-M08-2.5.3 |
| EL-M08-S5-070 | card | conditional | "34882" | FN-M08-2.5.3 |
| EL-M08-S5-068 | card | conditional | "10.4m" | FN-M08-2.5.3 |
| EL-M08-S5-069 | text | conditional | "10.4m" | FN-M08-2.5.3 |
| EL-M08-S5-100 | card | conditional | "2" | FN-M08-2.5.3 |
| EL-M08-S5-071 | card | conditional | "⚠️ Perlu Perhatian (57)" | FN-M08-2.5.4 |
| EL-M08-S5-072 | heading | conditional | "⚠️ Perlu Perhatian (57)" | FN-M08-2.5.4 |
| EL-M08-S5-073 | link | conditional | "<masked> 3 sesi · 48.3% ketepatan 48.3%", → /prestasi/{id} | FN-M08-2.5.4 |
| EL-M08-S5-074 | badge | conditional | "48.3%" | FN-M08-2.5.4 |
| EL-M08-S5-075 | link | conditional | "<masked> 2 sesi · 45% ketepatan 45%", → /prestasi/{id} | FN-M08-2.5.4 |
| EL-M08-S5-076 | badge | conditional | "45%" | FN-M08-2.5.4 |
| EL-M08-S5-077 | link | conditional | "<masked> 5 sesi · 44.6% ketepatan 44.6%", → /prestasi/{id} | FN-M08-2.5.4 |
| EL-M08-S5-078 | badge | conditional | "44.6%" | FN-M08-2.5.4 |

#### S6 — `/prestasi/{userId}` (213 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M08-S6-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S6-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S6-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S6-004 | link | visible-default | → javascript:history.back(), fa-arrow-left | FN-M08-2.6.1 |
| EL-M08-S6-005 | badge | visible-default | "<in>" | FN-M08-2.6.1 |
| EL-M08-S6-006 | heading | visible-default | "<masked>" | FN-M08-2.6.1 |
| EL-M08-S6-007 | text | visible-default | "Prestasi 360 — Dashboard Individu" | FN-M08-2.6.1 |
| EL-M08-S6-008 | text | visible-default | "74%" | FN-M08-2.6.1 |
| EL-M08-S6-009 | text | visible-default | "Ketepatan" | FN-M08-2.6.1 |
| EL-M08-S6-010 | text | visible-default | "1" | FN-M08-2.6.1 |
| EL-M08-S6-011 | text | visible-default | "Hari Kombo" | FN-M08-2.6.1 |
| EL-M08-S6-012 | card | visible-default | "17" | FN-M08-2.6.2 |
| EL-M08-S6-013 | text | visible-default | "17" | FN-M08-2.6.2 |
| EL-M08-S6-014 | text | visible-default | "Sesi Kuiz" | FN-M08-2.6.2 |
| EL-M08-S6-015 | card | visible-default | "74.0%" | FN-M08-2.6.2 |
| EL-M08-S6-016 | text | visible-default | "74.0%" | FN-M08-2.6.2 |
| EL-M08-S6-017 | text | visible-default | "Ketepatan" | FN-M08-2.6.2 |
| EL-M08-S6-018 | card | visible-default | "540" | FN-M08-2.6.2 |
| EL-M08-S6-019 | text | visible-default | "540" | FN-M08-2.6.2 |
| EL-M08-S6-020 | text | visible-default | "Soalan Dijawab" | FN-M08-2.6.2 |
| EL-M08-S6-021 | card | visible-default | "2j 9m" | FN-M08-2.6.2 |
| EL-M08-S6-022 | text | visible-default | "2j 9m" | FN-M08-2.6.2 |
| EL-M08-S6-023 | text | visible-default | "Masa Belajar" | FN-M08-2.6.2 |
| EL-M08-S6-024 | card | visible-default | "Headcount — Prestasi SPM" | FN-M08-2.6.3 |
| EL-M08-S6-025 | heading | visible-default | "Headcount — Prestasi SPM" | FN-M08-2.6.3 |
| EL-M08-S6-026 | heading | visible-default | "Kimia" | FN-M08-2.6.3 |
| EL-M08-S6-027 | text | visible-default | "5 MARIKH - Kimia · 2026" | FN-M08-2.6.3 |
| EL-M08-S6-028 | text | visible-default | "—" | FN-M08-2.6.3 |
| EL-M08-S6-029 | text | visible-default | "TOV: 69%" | FN-M08-2.6.3 |
| EL-M08-S6-030 | text | visible-default | "OTR1: 68%" | FN-M08-2.6.3 |
| EL-M08-S6-031 | text | visible-default | "OTR2: 43%" | FN-M08-2.6.3 |
| EL-M08-S6-032 | text | visible-default | "OTR3: 88%" | FN-M08-2.6.3 |
| EL-M08-S6-033 | text | visible-default | "ETR: —" | FN-M08-2.6.3 |
| EL-M08-S6-034 | link | visible-default | "Lihat Penuh", → /headcount/student/{id}, fa-external-link-alt | FN-M08-2.6.3 |
| EL-M08-S6-035 | card | visible-default | "Penguasaan Subjek" | FN-M08-2.6.4 |
| EL-M08-S6-036 | heading | visible-default | "Penguasaan Subjek" | FN-M08-2.6.4 |
| EL-M08-S6-037 | card | visible-default | "CH" | FN-M08-2.6.4 |
| EL-M08-S6-038 | text | visible-default | "CH" | FN-M08-2.6.4 |
| EL-M08-S6-039 | text | visible-default | "Kimia" | FN-M08-2.6.4 |
| EL-M08-S6-040 | text | visible-default | "69%" | FN-M08-2.6.4 |
| EL-M08-S6-041 | text | visible-default | "6 sesi · 200 soalan" | FN-M08-2.6.4 |
| EL-M08-S6-042 | card | visible-default | "SE" | FN-M08-2.6.4 |
| EL-M08-S6-043 | text | visible-default | "SE" | FN-M08-2.6.4 |
| EL-M08-S6-044 | text | visible-default | "Sejarah" | FN-M08-2.6.4 |
| EL-M08-S6-045 | text | visible-default | "53%" | FN-M08-2.6.4 |
| EL-M08-S6-046 | text | visible-default | "3 sesi · 100 soalan" | FN-M08-2.6.4 |
| EL-M08-S6-047 | card | visible-default | "PI" | FN-M08-2.6.4 |
| EL-M08-S6-048 | text | visible-default | "PI" | FN-M08-2.6.4 |
| EL-M08-S6-049 | text | visible-default | "Pendidikan Islam" | FN-M08-2.6.4 |
| EL-M08-S6-050 | text | visible-default | "95%" | FN-M08-2.6.4 |
| EL-M08-S6-051 | text | visible-default | "3 sesi · 80 soalan" | FN-M08-2.6.4 |
| EL-M08-S6-052 | card | visible-default | "Aktiviti" | FN-M08-2.6.5 |
| EL-M08-S6-053 | heading | visible-default | "Aktiviti" | FN-M08-2.6.5 |
| EL-M08-S6-054 | text | visible-default | "1" | FN-M08-2.6.5 |
| EL-M08-S6-055 | text | visible-default | "Kombo Hari" | FN-M08-2.6.5 |
| EL-M08-S6-056 | text | visible-default | "3" | FN-M08-2.6.5 |
| EL-M08-S6-057 | text | visible-default | "Rekod Terbaik" | FN-M08-2.6.5 |
| EL-M08-S6-058 | text | visible-default | "479" | FN-M08-2.6.5 |
| EL-M08-S6-059 | text | visible-default | "Koin" | FN-M08-2.6.5 |
| EL-M08-S6-060 | text | visible-default | "4" | FN-M08-2.6.5 |
| EL-M08-S6-061 | text | visible-default | "Hari Latihan" | FN-M08-2.6.5 |
| EL-M08-S6-062 | card | visible-default | "Peta Aktiviti (90 Hari)" | FN-M08-2.6.6 |
| EL-M08-S6-063 | heading | visible-default | "Peta Aktiviti (90 Hari)" | FN-M08-2.6.6 |
| EL-M08-S6-064 | clickable | visible-default | — | FN-M08-2.6.6 |
| EL-M08-S6-065 | clickable | visible-default | — | FN-M08-2.6.6 |
| EL-M08-S6-066 | clickable | visible-default | — | FN-M08-2.6.6 |
| EL-M08-S6-067 | clickable | visible-default | — | FN-M08-2.6.6 |
| EL-M08-S6-068 | clickable | visible-default | — | FN-M08-2.6.6 |
| EL-M08-S6-069 | clickable | visible-default | — | FN-M08-2.6.6 |
| EL-M08-S6-070 | clickable | visible-default | — | FN-M08-2.6.6 |
| EL-M08-S6-071 | text | visible-default | "0" | FN-M08-2.6.6 |
| EL-M08-S6-072 | text | visible-default | "1-1" | FN-M08-2.6.6 |
| EL-M08-S6-073 | text | visible-default | "2-2" | FN-M08-2.6.6 |
| EL-M08-S6-074 | text | visible-default | "3-3" | FN-M08-2.6.6 |
| EL-M08-S6-075 | text | visible-default | "4+" | FN-M08-2.6.6 |
| EL-M08-S6-076 | text | visible-default | "sesi/hari" | FN-M08-2.6.6 |
| EL-M08-S6-077 | card | visible-default | "Topik Perlu Perhatian" | FN-M08-2.6.7 |
| EL-M08-S6-078 | heading | visible-default | "Topik Perlu Perhatian" | FN-M08-2.6.7 |
| EL-M08-S6-079 | text | visible-default | "0%" | FN-M08-2.6.7 |
| EL-M08-S6-080 | text | visible-default | "Sifat Kimia dan Saling Pertukaran" | FN-M08-2.6.7 |
| EL-M08-S6-081 | text | visible-default | "CHEM · 1 percubaan" | FN-M08-2.6.7 |
| EL-M08-S6-082 | badge | visible-default | "Fokus 7", fa-bolt | FN-M08-2.6.7 |
| EL-M08-S6-083 | link | visible-default | "Fokus", → /practice/CHEM/quiz?level=11&dskp_sp_id=2530&count=7, fa-bolt | FN-M08-2.6.7 |
| EL-M08-S6-084 | text | visible-default | "0%" | FN-M08-2.6.7 |
| EL-M08-S6-085 | text | visible-default | "Polimer" | FN-M08-2.6.7 |
| EL-M08-S6-086 | text | visible-default | "CHEM · 1 percubaan" | FN-M08-2.6.7 |
| EL-M08-S6-087 | badge | visible-default | "Fokus 10", fa-bolt | FN-M08-2.6.7 |
| EL-M08-S6-088 | link | visible-default | "Fokus", → /practice/CHEM/quiz?level=11&dskp_sp_id=2544&count=10, fa-bolt | FN-M08-2.6.7 |
| EL-M08-S6-089 | text | visible-default | "0%" | FN-M08-2.6.7 |
| EL-M08-S6-090 | text | visible-default | "Sel Elektrolisis" | FN-M08-2.6.7 |
| EL-M08-S6-091 | text | visible-default | "CHEM · 3 percubaan" | FN-M08-2.6.7 |
| EL-M08-S6-092 | badge | visible-default | "Fokus 25", fa-bolt | FN-M08-2.6.7 |
| EL-M08-S6-093 | link | visible-default | "Fokus", → /practice/CHEM/quiz?level=11&dskp_sp_id=2513&count=25, fa-bolt | FN-M08-2.6.7 |
| EL-M08-S6-094 | text | visible-default | "0%" | FN-M08-2.6.7 |
| EL-M08-S6-095 | text | visible-default | "Getah Asli" | FN-M08-2.6.7 |
| EL-M08-S6-096 | text | visible-default | "CHEM · 1 percubaan" | FN-M08-2.6.7 |
| EL-M08-S6-097 | badge | visible-default | "Fokus 25", fa-bolt | FN-M08-2.6.7 |
| EL-M08-S6-098 | link | visible-default | "Fokus", → /practice/CHEM/quiz?level=11&dskp_sp_id=2545&count=25, fa-bolt | FN-M08-2.6.7 |
| EL-M08-S6-099 | text | visible-default | "0%" | FN-M08-2.6.7 |
| EL-M08-S6-100 | text | visible-default | "Siri Homolog" | FN-M08-2.6.7 |
| EL-M08-S6-101 | text | visible-default | "CHEM · 2 percubaan" | FN-M08-2.6.7 |
| EL-M08-S6-102 | badge | visible-default | "Fokus 25", fa-bolt | FN-M08-2.6.7 |
| EL-M08-S6-103 | link | visible-default | "Fokus", → /practice/CHEM/quiz?level=11&dskp_sp_id=2526&count=25, fa-bolt | FN-M08-2.6.7 |
| EL-M08-S6-104 | text | visible-default | "0%" | FN-M08-2.6.7 |
| EL-M08-S6-105 | text | visible-default | "Pendidikan Islam Tingkatan 4" | FN-M08-2.6.7 |
| EL-M08-S6-106 | text | visible-default | "PI · 1 percubaan" | FN-M08-2.6.7 |
| EL-M08-S6-107 | badge | visible-default | "Fokus 2", fa-bolt | FN-M08-2.6.7 |
| EL-M08-S6-108 | link | visible-default | "Fokus", → /practice/PI/quiz?level=11&dskp_sp_id=2244&count=2, fa-bolt | FN-M08-2.6.7 |
| EL-M08-S6-109 | badge | visible-default | "Fokus", fa-bolt | FN-M08-2.6.7 |
| EL-M08-S6-110 | text | visible-default | "Klik untuk buka set latihan tertumpu pada topik lemah itu sahaja." | FN-M08-2.6.7 |
| EL-M08-S6-111 | card | visible-default | "Cadangan" | FN-M08-2.6.8 |
| EL-M08-S6-112 | heading | visible-default | "Cadangan" | FN-M08-2.6.8 |
| EL-M08-S6-113 | text | visible-default | "Sudah 104 hari tiada latihan. Mulakan semula dengan 10 soalan mudah untuk pemanasan." | FN-M08-2.6.8 |
| EL-M08-S6-114 | text | visible-default | "Tingkatkan prestasi Sejarah (purata 53%) dengan 3 sesi latihan fokus minggu ini." | FN-M08-2.6.8 |
| EL-M08-S6-115 | text | visible-default | "Tingkatkan prestasi Fizik (purata 65%) dengan 3 sesi latihan fokus minggu ini." | FN-M08-2.6.8 |
| EL-M08-S6-116 | text | visible-default | "Topik 'Sel Elektrolisis' (0% ketepatan) adalah titik lemah utama — buat latihan tertumpu untuk topik ini." | FN-M08-2.6.8 |
| EL-M08-S6-117 | text | conditional | "0%" | FN-M08-2.6.1 |
| EL-M08-S6-118 | card | conditional | "0" | FN-M08-2.6.2 |
| EL-M08-S6-119 | card | conditional | "0.0%" | FN-M08-2.6.2 |
| EL-M08-S6-120 | text | conditional | "0.0%" | FN-M08-2.6.2 |
| EL-M08-S6-121 | card | conditional | "0" | FN-M08-2.6.2 |
| EL-M08-S6-122 | card | conditional | "0m" | FN-M08-2.6.2 |
| EL-M08-S6-123 | text | conditional | "0m" | FN-M08-2.6.2 |
| EL-M08-S6-124 | empty-state | conditional | "Belum ada data latihan." | FN-M08-2.6.4 |
| EL-M08-S6-125 | link | conditional | "Mula Berlatih", → /practice, fa-play | FN-M08-2.6.4 |
| EL-M08-S6-126 | empty-state | conditional | "Tiada topik lemah! Teruskan usaha." | FN-M08-2.6.7 |
| EL-M08-S6-127 | text | conditional | "Mulakan perjalanan belajar kamu — setiap sesi latihan membina asas yang kukuh!" | FN-M08-2.6.8 |
| EL-M08-S6-135 | heading | conditional | "Sejarah" | FN-M08-2.6.3 |
| EL-M08-S6-136 | text | conditional | "4 Simulasi · 2026" | FN-M08-2.6.3 |
| EL-M08-S6-137 | text | conditional | "Below" | FN-M08-2.6.3 |
| EL-M08-S6-138 | text | conditional | "TOV: 67%" | FN-M08-2.6.3 |
| EL-M08-S6-139 | text | conditional | "OTR3: 56%" | FN-M08-2.6.3 |
| EL-M08-S6-140 | text | conditional | "ETR: 56%" | FN-M08-2.6.3 |
| EL-M08-S6-141 | heading | conditional | "Matematik" | FN-M08-2.6.3 |
| EL-M08-S6-142 | text | conditional | "4 Simulasi · 2026" | FN-M08-2.6.3 |
| EL-M08-S6-143 | text | conditional | "Below" | FN-M08-2.6.3 |
| EL-M08-S6-144 | text | conditional | "TOV: 55%" | FN-M08-2.6.3 |
| EL-M08-S6-145 | text | conditional | "OTR3: 65%" | FN-M08-2.6.3 |
| EL-M08-S6-146 | text | conditional | "ETR: 65%" | FN-M08-2.6.3 |
| EL-M08-S6-147 | link | conditional | "Lihat Penuh", → /headcount/student/{id}, fa-external-link-alt | FN-M08-2.6.3 |
| EL-M08-S6-148 | heading | conditional | "Bahasa Melayu" | FN-M08-2.6.3 |
| EL-M08-S6-149 | text | conditional | "4 Simulasi · 2026" | FN-M08-2.6.3 |
| EL-M08-S6-150 | text | conditional | "On Track" | FN-M08-2.6.3 |
| EL-M08-S6-151 | text | conditional | "TOV: 58%" | FN-M08-2.6.3 |
| EL-M08-S6-152 | text | conditional | "OTR3: 60%" | FN-M08-2.6.3 |
| EL-M08-S6-153 | text | conditional | "ETR: 60%" | FN-M08-2.6.3 |
| EL-M08-S6-154 | link | conditional | "Lihat Penuh", → /headcount/student/{id}, fa-external-link-alt | FN-M08-2.6.3 |
| EL-M08-S6-155 | heading | conditional | "Sains" | FN-M08-2.6.3 |
| EL-M08-S6-156 | text | conditional | "4 Simulasi · 2026" | FN-M08-2.6.3 |
| EL-M08-S6-157 | text | conditional | "TOV: 70%" | FN-M08-2.6.3 |
| EL-M08-S6-158 | text | conditional | "OTR3: 61%" | FN-M08-2.6.3 |
| EL-M08-S6-159 | text | conditional | "ETR: 61%" | FN-M08-2.6.3 |
| EL-M08-S6-160 | link | conditional | "Lihat Penuh", → /headcount/student/{id}, fa-external-link-alt | FN-M08-2.6.3 |
| EL-M08-S6-161 | heading | conditional | "Bahasa Inggeris" | FN-M08-2.6.3 |
| EL-M08-S6-162 | text | conditional | "4 Simulasi · 2026" | FN-M08-2.6.3 |
| EL-M08-S6-163 | text | conditional | "On Track" | FN-M08-2.6.3 |
| EL-M08-S6-164 | text | conditional | "TOV: 51%" | FN-M08-2.6.3 |
| EL-M08-S6-165 | text | conditional | "OTR3: 74%" | FN-M08-2.6.3 |
| EL-M08-S6-166 | text | conditional | "ETR: 74%" | FN-M08-2.6.3 |
| EL-M08-S6-167 | link | conditional | "Lihat Penuh", → /headcount/student/{id}, fa-external-link-alt | FN-M08-2.6.3 |
| EL-M08-S6-168 | card | conditional | "BM" | FN-M08-2.6.4 |
| EL-M08-S6-169 | text | conditional | "BM" | FN-M08-2.6.4 |
| EL-M08-S6-170 | text | conditional | "Bahasa Melayu" | FN-M08-2.6.4 |
| EL-M08-S6-171 | text | conditional | "68%" | FN-M08-2.6.4 |
| EL-M08-S6-172 | text | conditional | "8 sesi · 94 soalan" | FN-M08-2.6.4 |
| EL-M08-S6-173 | text | conditional | "6 sesi · 68 soalan" | FN-M08-2.6.4 |
| EL-M08-S6-174 | card | conditional | "SC" | FN-M08-2.6.4 |
| EL-M08-S6-175 | text | conditional | "SC" | FN-M08-2.6.4 |
| EL-M08-S6-176 | text | conditional | "Sains" | FN-M08-2.6.4 |
| EL-M08-S6-177 | text | conditional | "70%" | FN-M08-2.6.4 |
| EL-M08-S6-178 | text | conditional | "6 sesi · 67 soalan" | FN-M08-2.6.4 |
| EL-M08-S6-179 | card | conditional | "Lencana (3)" | FN-M08-2.6.9 |
| EL-M08-S6-180 | heading | conditional | "Lencana (3)" | FN-M08-2.6.9 |
| EL-M08-S6-181 | tooltip | conditional | "Pemula Rajin", fa-seedling | FN-M08-2.6.9 |
| EL-M08-S6-182 | tooltip | conditional | "Pelajar Aktif", fa-running | FN-M08-2.6.9 |
| EL-M08-S6-183 | tooltip | conditional | "Pengumpul", fa-coins | FN-M08-2.6.9 |
| EL-M08-S6-184 | text | conditional | "3.1.6 — Membina pernyataan menggunakan pengkuanti "semua" dan "sebilanga..." | FN-M08-2.6.7 |
| EL-M08-S6-185 | text | conditional | "MATH · 1 percubaan" | FN-M08-2.6.7 |
| EL-M08-S6-186 | badge | conditional | "Fokus 4", fa-bolt | FN-M08-2.6.7 |
| EL-M08-S6-187 | link | conditional | "Fokus", → /practice/MATH/quiz?dskp_sp_id=34&count=4, fa-bolt | FN-M08-2.6.7 |
| EL-M08-S6-188 | text | conditional | "4.1.1 — Menentukan persilangan set menggunakan pelbagai perwakilan." | FN-M08-2.6.7 |
| EL-M08-S6-189 | text | conditional | "MATH · 1 percubaan" | FN-M08-2.6.7 |
| EL-M08-S6-190 | badge | conditional | "Fokus 9", fa-bolt | FN-M08-2.6.7 |
| EL-M08-S6-191 | link | conditional | "Fokus", → /practice/MATH/quiz?dskp_sp_id=41&count=9, fa-bolt | FN-M08-2.6.7 |
| EL-M08-S6-192 | text | conditional | "4.2.2 — Menentukan pelengkap bagi kesatuan set." | FN-M08-2.6.7 |
| EL-M08-S6-193 | text | conditional | "MATH · 1 percubaan" | FN-M08-2.6.7 |
| EL-M08-S6-194 | badge | conditional | "Fokus 6", fa-bolt | FN-M08-2.6.7 |
| EL-M08-S6-195 | link | conditional | "Fokus", → /practice/MATH/quiz?dskp_sp_id=45&count=6, fa-bolt | FN-M08-2.6.7 |
| EL-M08-S6-196 | text | conditional | "Warisan Negara Bangsa" | FN-M08-2.6.7 |
| EL-M08-S6-197 | text | conditional | "SEJ · 1 percubaan" | FN-M08-2.6.7 |
| EL-M08-S6-198 | badge | conditional | "Fokus 14", fa-bolt | FN-M08-2.6.7 |
| EL-M08-S6-199 | link | conditional | "Fokus", → /practice/SEJ/quiz?dskp_sp_id=347&count=14, fa-bolt | FN-M08-2.6.7 |
| EL-M08-S6-200 | text | conditional | "Warisan Negara Bangsa" | FN-M08-2.6.7 |
| EL-M08-S6-201 | text | conditional | "SEJ · 1 percubaan" | FN-M08-2.6.7 |
| EL-M08-S6-202 | badge | conditional | "Fokus 16", fa-bolt | FN-M08-2.6.7 |
| EL-M08-S6-203 | link | conditional | "Fokus", → /practice/SEJ/quiz?dskp_sp_id=364&count=16, fa-bolt | FN-M08-2.6.7 |
| EL-M08-S6-204 | text | conditional | "Dunia mikroorganisma" | FN-M08-2.6.7 |
| EL-M08-S6-205 | text | conditional | "SCI · 1 percubaan" | FN-M08-2.6.7 |
| EL-M08-S6-206 | badge | conditional | "Fokus 9", fa-bolt | FN-M08-2.6.7 |
| EL-M08-S6-207 | link | conditional | "Fokus", → /practice/SCI/quiz?dskp_sp_id=640&count=9, fa-bolt | FN-M08-2.6.7 |
| EL-M08-S6-208 | text | conditional | "Belum ada sesi latihan lagi. Mulakan dengan subjek yang paling kamu minati!" | FN-M08-2.6.8 |
| EL-M08-S6-209 | text | conditional | "Tingkatkan prestasi Matematik (purata 67.9%) dengan 3 sesi latihan fokus minggu ini." | FN-M08-2.6.8 |
| EL-M08-S6-210 | text | conditional | "Tingkatkan prestasi Bahasa Melayu (purata 68.1%) dengan 3 sesi latihan fokus minggu ini." | FN-M08-2.6.8 |
| EL-M08-S6-211 | text | conditional | "Topik 'Penulisan karangan lanjutan' (33.3% ketepatan) adalah titik lemah utama — buat latihan tertumpu untuk t…" | FN-M08-2.6.8 |
| EL-M08-S6-212 | text | conditional | "Sejarah OTR3: markah sebenar (56.00) masih 26 mata di bawah sasaran (82.00). Fokus latihan untuk kejar target." | FN-M08-2.6.8 |
| EL-M08-S6-213 | text | conditional | "Matematik OTR3: markah sebenar (65.00) masih 5 mata di bawah sasaran (70.00). Fokus latihan untuk kejar target…" | FN-M08-2.6.8 |
| EL-M08-S6-128 | text | conditional | "404" | FN-M08-1.2.3 |
| EL-M08-S6-129 | text | conditional | "🔍" | FN-M08-1.2.3 |
| EL-M08-S6-130 | heading | conditional | "Halaman Tidak Dijumpai" | FN-M08-1.2.3 |
| EL-M08-S6-131 | text | conditional | "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?" | FN-M08-1.2.3 |
| EL-M08-S6-132 | link | conditional | "Halaman Utama", → / | FN-M08-1.2.3 |
| EL-M08-S6-133 | link | conditional | "Mula Latihan", → /latih-tubi | FN-M08-1.2.3 |
| EL-M08-S6-134 | text | conditional | "PRESTASIPLUS" | FN-M08-1.2.3 |

#### S7 — `/analitik/pelajar` (106 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M08-S7-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S7-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S7-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S7-004 | heading | visible-default | "Topik Perlu Perhatian Utama (4)" | FN-M08-3.1.1 |
| EL-M08-S7-005 | card | visible-default | "0%" | FN-M08-3.1.1 |
| EL-M08-S7-006 | badge | visible-default | "0%" | FN-M08-3.1.1 |
| EL-M08-S7-007 | text | visible-default | "5.1.2 — Mengaplikasi pelbagai kata terbitan dalam pelbagai laras bah..." | FN-M08-3.1.1 |
| EL-M08-S7-008 | text | visible-default | "Bahasa Melayu · 3 soalan dijawab" | FN-M08-3.1.1 |
| EL-M08-S7-009 | link | visible-default | "Latihan Fokus (16 soalan)", → /practice/BM/quiz?level=4&dskp_sp_id=221&count=16, fa-dumbbell | FN-M08-3.1.1 |
| EL-M08-S7-010 | card | visible-default | "0%" | FN-M08-3.1.1 |
| EL-M08-S7-011 | badge | visible-default | "0%" | FN-M08-3.1.1 |
| EL-M08-S7-012 | text | visible-default | "3.4.1 — Menulis kerangka karangan dengan menyusun dan menganalisis i..." | FN-M08-3.1.1 |
| EL-M08-S7-013 | text | visible-default | "Bahasa Melayu · 1 soalan dijawab" | FN-M08-3.1.1 |
| EL-M08-S7-014 | link | visible-default | "Latihan Fokus (16 soalan)", → /practice/BM/quiz?level=4&dskp_sp_id=206&count=16, fa-dumbbell | FN-M08-3.1.1 |
| EL-M08-S7-015 | card | visible-default | "0%" | FN-M08-3.1.1 |
| EL-M08-S7-016 | badge | visible-default | "0%" | FN-M08-3.1.1 |
| EL-M08-S7-017 | text | visible-default | "5.1.3 — Mengaplikasi bentuk kata ganda dan akronim dalam pelbagai la..." | FN-M08-3.1.1 |
| EL-M08-S7-018 | text | visible-default | "Bahasa Melayu · 1 soalan dijawab" | FN-M08-3.1.1 |
| EL-M08-S7-019 | link | visible-default | "Latihan Fokus (7 soalan)", → /practice/BM/quiz?level=4&dskp_sp_id=222&count=7, fa-dumbbell | FN-M08-3.1.1 |
| EL-M08-S7-020 | card | visible-default | "0%" | FN-M08-3.1.1 |
| EL-M08-S7-021 | badge | visible-default | "0%" | FN-M08-3.1.1 |
| EL-M08-S7-022 | text | visible-default | "4.2.1 — Memahami dan menggunakan perbandingan semacam, kata-kata hik..." | FN-M08-3.1.1 |
| EL-M08-S7-023 | text | visible-default | "Bahasa Melayu · 4 soalan dijawab" | FN-M08-3.1.1 |
| EL-M08-S7-024 | link | visible-default | "Latihan Fokus (12 soalan)", → /practice/BM/quiz?level=4&dskp_sp_id=214&count=12, fa-dumbbell | FN-M08-3.1.1 |
| EL-M08-S7-025 | text | visible-default | "Masih ada topik lemah lain untuk subjek ini." | FN-M08-3.1.2 |
| EL-M08-S7-026 | text | visible-default | "13" | FN-M08-3.1.2 |
| EL-M08-S7-027 | toggle | visible-default | "Lihat semua 17 topik lemah", fa-chevron-down | FN-M08-3.1.2 |
| EL-M08-S7-028 | card | conditional | "15.3.2 — Menerangkan peranan Malaysia dalam hubungan ekonomi antarabangsa." | FN-M08-3.1.3 |
| EL-M08-S7-029 | text | conditional | "15.3.2 — Menerangkan peranan Malaysia dalam hubungan ekonomi antarabangsa." | FN-M08-3.1.3 |
| EL-M08-S7-030 | text | conditional | "Sejarah · 1 soalan dijawab" | FN-M08-3.1.3 |
| EL-M08-S7-031 | badge | conditional | "0%" | FN-M08-3.1.3 |
| EL-M08-S7-032 | link | conditional | "Latihan Fokus (13 soalan)", → /practice/SEJ/quiz?level=4&dskp_sp_id=418&count=13, fa-dumbbell | FN-M08-3.1.3 |
| EL-M08-S7-033 | text | conditional | "5.3.4 — Mengenal pasti dan menggunakan ayat penyata, ayat tanya, ayat perintah dan ayat seruan yan..." | FN-M08-3.1.3 |
| EL-M08-S7-034 | text | conditional | "Bahasa Melayu · 1 soalan dijawab" | FN-M08-3.1.3 |
| EL-M08-S7-035 | badge | conditional | "0%" | FN-M08-3.1.3 |
| EL-M08-S7-036 | link | conditional | "Latihan Fokus (13 soalan)", → /practice/BM/quiz?level=4&dskp_sp_id=179&count=13, fa-dumbbell | FN-M08-3.1.3 |
| EL-M08-S7-037 | text | conditional | "2.1.1 — Membaca pelbagai jenis teks untuk mengenal pasti dan membandingkan intonasi serta nada yan..." | FN-M08-3.1.3 |
| EL-M08-S7-038 | text | conditional | "Bahasa Melayu · 1 soalan dijawab" | FN-M08-3.1.3 |
| EL-M08-S7-039 | badge | conditional | "0%" | FN-M08-3.1.3 |
| EL-M08-S7-040 | link | conditional | "Latihan Fokus (50 soalan)", → /practice/BM/quiz?level=4&dskp_sp_id=194&count=25, fa-dumbbell | FN-M08-3.1.3 |
| EL-M08-S7-041 | button | visible-default | "Bahasa Melayu 41%" | FN-M08-3.1.4 |
| EL-M08-S7-042 | button | visible-default | "Sejarah 35%" | FN-M08-3.1.4 |
| EL-M08-S7-043 | card | visible-default | "3" | FN-M08-3.1.5 |
| EL-M08-S7-044 | text | visible-default | "3" | FN-M08-3.1.5 |
| EL-M08-S7-045 | text | visible-default | "/ 3 SP" | FN-M08-3.1.5 |
| EL-M08-S7-046 | text | visible-default | "Standard Dikuasai" | FN-M08-3.1.5 |
| EL-M08-S7-047 | text | visible-default | "3" | FN-M08-3.1.5 |
| EL-M08-S7-048 | text | visible-default | "6" | FN-M08-3.1.5 |
| EL-M08-S7-049 | text | visible-default | "17" | FN-M08-3.1.5 |
| EL-M08-S7-050 | text | visible-default | "0" | FN-M08-3.1.5 |
| EL-M08-S7-051 | card | visible-default | "40.5%" | FN-M08-3.1.6 |
| EL-M08-S7-052 | text | visible-default | "40.5%" | FN-M08-3.1.6 |
| EL-M08-S7-053 | text | visible-default | "Ketepatan" | FN-M08-3.1.6 |
| EL-M08-S7-054 | text | visible-default | "79" | FN-M08-3.1.6 |
| EL-M08-S7-055 | text | visible-default | "Soalan Dijawab" | FN-M08-3.1.6 |
| EL-M08-S7-056 | text | visible-default | "Trend 30 Hari" | FN-M08-3.1.6 |
| EL-M08-S7-057 | text | visible-default | "G-C" | FN-M08-3.1.6 |
| EL-M08-S7-058 | text | visible-default | "Unjuran Gred" | FN-M08-3.1.6 |
| EL-M08-S7-059 | text | visible-default | "Jangan putus asa! Latihan konsisten akan membantu. Mulakan dengan topik yang paling lemah di bawah.", fa-hand-holding-heart | FN-M08-3.1.7 |
| EL-M08-S7-060 | card | visible-default | "Peta DSKP — Standard Pembelajaran" | FN-M08-3.1.8 |
| EL-M08-S7-061 | heading | visible-default | "Peta DSKP — Standard Pembelajaran" | FN-M08-3.1.8 |
| EL-M08-S7-062 | text | visible-default | "KSSR Bahasa Melayu Darjah 4" | FN-M08-3.1.8 |
| EL-M08-S7-063 | tooltip | visible-default | "1.1: Menguasai kandungan Kemahiran Membaca D4 bagi Darjah 4 — Belum cuba" | FN-M08-3.1.8 |
| EL-M08-S7-064 | text | visible-default | "1.1" | FN-M08-3.1.8 |
| EL-M08-S7-065 | tooltip | visible-default | "2.1: Menguasai kandungan Kemahiran Menulis D4 bagi Darjah 4 — Belum cuba" | FN-M08-3.1.8 |
| EL-M08-S7-066 | text | visible-default | "2.1" | FN-M08-3.1.8 |
| EL-M08-S7-067 | tooltip | visible-default | "3.1: Menguasai kandungan Aspek Tatabahasa D4 bagi Darjah 4 — Belum cuba" | FN-M08-3.1.8 |
| EL-M08-S7-068 | text | visible-default | "3.1" | FN-M08-3.1.8 |
| EL-M08-S7-069 | text | visible-default | "Mahir (75%+)" | FN-M08-3.1.8 |
| EL-M08-S7-070 | text | visible-default | "Sederhana (50-74%)" | FN-M08-3.1.8 |
| EL-M08-S7-071 | text | visible-default | "Lemah (<50%)" | FN-M08-3.1.8 |
| EL-M08-S7-072 | text | visible-default | "Belum Cuba" | FN-M08-3.1.8 |
| EL-M08-S7-073 | text | visible-default | "Klik untuk latihan fokus" | FN-M08-3.1.8 |
| EL-M08-S7-074 | badge | visible-default | "Fokus" | FN-M08-3.1.8 |
| EL-M08-S7-075 | card | conditional | "8" | FN-M08-3.1.5 |
| EL-M08-S7-076 | text | conditional | "8" | FN-M08-3.1.5 |
| EL-M08-S7-077 | text | conditional | "/ 2 SP" | FN-M08-3.1.5 |
| EL-M08-S7-078 | text | conditional | "Standard Dikuasai" | FN-M08-3.1.5 |
| EL-M08-S7-079 | text | conditional | "8" | FN-M08-3.1.5 |
| EL-M08-S7-080 | text | conditional | "2" | FN-M08-3.1.5 |
| EL-M08-S7-081 | text | conditional | "13" | FN-M08-3.1.5 |
| EL-M08-S7-082 | text | conditional | "0" | FN-M08-3.1.5 |
| EL-M08-S7-083 | card | conditional | "35.0%" | FN-M08-3.1.6 |
| EL-M08-S7-084 | text | conditional | "35.0%" | FN-M08-3.1.6 |
| EL-M08-S7-085 | text | conditional | "Ketepatan" | FN-M08-3.1.6 |
| EL-M08-S7-086 | text | conditional | "40" | FN-M08-3.1.6 |
| EL-M08-S7-087 | text | conditional | "Soalan Dijawab" | FN-M08-3.1.6 |
| EL-M08-S7-088 | text | conditional | "Trend 30 Hari" | FN-M08-3.1.6 |
| EL-M08-S7-089 | text | conditional | "G-D" | FN-M08-3.1.6 |
| EL-M08-S7-090 | text | conditional | "Unjuran Gred" | FN-M08-3.1.6 |
| EL-M08-S7-091 | text | conditional | "Jangan putus asa! Latihan konsisten akan membantu. Mulakan dengan topik yang paling lemah di bawah.", fa-hand-holding-heart | FN-M08-3.1.7 |
| EL-M08-S7-092 | card | conditional | "Peta DSKP — Standard Pembelajaran" | FN-M08-3.1.8 |
| EL-M08-S7-093 | heading | conditional | "Peta DSKP — Standard Pembelajaran" | FN-M08-3.1.8 |
| EL-M08-S7-094 | text | conditional | "KSSR Sejarah Darjah 4" | FN-M08-3.1.8 |
| EL-M08-S7-095 | tooltip | conditional | "1.1: Menguasai kandungan Kesultanan Melayu D4 bagi Darjah 4 — Belum cuba" | FN-M08-3.1.8 |
| EL-M08-S7-096 | text | conditional | "1.1" | FN-M08-3.1.8 |
| EL-M08-S7-097 | tooltip | conditional | "2.1: Menguasai kandungan Pengaruh Islam D4 bagi Darjah 4 — Belum cuba" | FN-M08-3.1.8 |
| EL-M08-S7-098 | text | conditional | "2.1" | FN-M08-3.1.8 |
| EL-M08-S7-099 | text | conditional | "Mahir (75%+)" | FN-M08-3.1.8 |
| EL-M08-S7-100 | text | conditional | "Sederhana (50-74%)" | FN-M08-3.1.8 |
| EL-M08-S7-101 | text | conditional | "Lemah (<50%)" | FN-M08-3.1.8 |
| EL-M08-S7-102 | text | conditional | "Belum Cuba" | FN-M08-3.1.8 |
| EL-M08-S7-103 | text | conditional | "Klik untuk latihan fokus" | FN-M08-3.1.8 |
| EL-M08-S7-104 | badge | conditional | "Fokus" | FN-M08-3.1.8 |
| EL-M08-S7-105 | toggle | conditional | "Sembunyi senarai penuh", fa-chevron-up | FN-M08-3.1.2 |
| EL-M08-S7-106 | toggle | conditional | "Lihat semua 13 topik lemah", fa-chevron-down | FN-M08-3.1.2 |

#### S8 — `/analitik/kelas` (48 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M08-S8-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S8-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S8-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S8-004 | form | visible-default | — | FN-M08-3.2.1 |
| EL-M08-S8-005 | label | visible-default | "Kelas" | FN-M08-3.2.1 |
| EL-M08-S8-006 | select | visible-default | label "Kelas", `name=classroom_id`, 0 options | FN-M08-3.2.1 |
| EL-M08-S8-007 | label | visible-default | "Mata Pelajaran" | FN-M08-3.2.1 |
| EL-M08-S8-008 | select | visible-default | label "Mata Pelajaran", `name=subject_id`, 10 options | FN-M08-3.2.1 |
| EL-M08-S8-009 | label | visible-default | "Risiko" | FN-M08-3.2.1 |
| EL-M08-S8-010 | select | visible-default | label "Risiko", `name=risk_level`, 5 options | FN-M08-3.2.1 |
| EL-M08-S8-011 | card | visible-default | "6" | FN-M08-3.2.3 |
| EL-M08-S8-012 | text | visible-default | "6" | FN-M08-3.2.3 |
| EL-M08-S8-013 | text | visible-default | "Jumlah Pelajar" | FN-M08-3.2.3 |
| EL-M08-S8-014 | card | visible-default | "0.0%" | FN-M08-3.2.3 |
| EL-M08-S8-015 | text | visible-default | "0.0%" | FN-M08-3.2.3 |
| EL-M08-S8-016 | text | visible-default | "Purata Ketepatan" | FN-M08-3.2.3 |
| EL-M08-S8-017 | card | visible-default | "0" | FN-M08-3.2.3 |
| EL-M08-S8-018 | text | visible-default | "0" | FN-M08-3.2.3 |
| EL-M08-S8-019 | text | visible-default | "Pelajar Berisiko" | FN-M08-3.2.3 |
| EL-M08-S8-020 | card | visible-default | "4" | FN-M08-3.2.3 |
| EL-M08-S8-021 | text | visible-default | "4" | FN-M08-3.2.3 |
| EL-M08-S8-022 | text | visible-default | "Prestasi Baik" | FN-M08-3.2.3 |
| EL-M08-S8-023 | card | visible-default | "Senarai Pelajar" | FN-M08-3.2.4 |
| EL-M08-S8-024 | heading | visible-default | "Senarai Pelajar" | FN-M08-3.2.4 |
| EL-M08-S8-025 | table | visible-default | columns: # · Pelajar · Ketepatan · Soalan · Trend · Unjuran · Risiko · Tindakan | FN-M08-3.2.4 |
| EL-M08-S8-026 | link | visible-default | "<person>", → /analitik/kelas/pelajar/{id}, fa-arrow-up-right-from-square | FN-M08-3.2.4 |
| EL-M08-S8-027 | badge | visible-default | "Sederhana" | FN-M08-3.2.4 |
| EL-M08-S8-028 | link | visible-default | "Lihat Analitik", → /analitik/kelas/pelajar/{id}, fa-chart-line | FN-M08-3.2.4 |
| EL-M08-S8-029 | link | visible-default | "<person>", → /analitik/kelas/pelajar/{id}, fa-arrow-up-right-from-square | FN-M08-3.2.4 |
| EL-M08-S8-030 | badge | visible-default | "Rendah" | FN-M08-3.2.4 |
| EL-M08-S8-031 | link | visible-default | "Lihat Analitik", → /analitik/kelas/pelajar/{id}, fa-chart-line | FN-M08-3.2.4 |
| EL-M08-S8-032 | link | visible-default | "<person>", → /analitik/kelas/pelajar/{id}, fa-arrow-up-right-from-square | FN-M08-3.2.4 |
| EL-M08-S8-033 | badge | visible-default | "Rendah" | FN-M08-3.2.4 |
| EL-M08-S8-034 | link | visible-default | "Lihat Analitik", → /analitik/kelas/pelajar/{id}, fa-chart-line | FN-M08-3.2.4 |
| EL-M08-S8-035 | link | visible-default | "<person>", → /analitik/kelas/pelajar/{id}, fa-arrow-up-right-from-square | FN-M08-3.2.4 |
| EL-M08-S8-036 | badge | visible-default | "Rendah" | FN-M08-3.2.4 |
| EL-M08-S8-037 | link | visible-default | "Lihat Analitik", → /analitik/kelas/pelajar/{id}, fa-chart-line | FN-M08-3.2.4 |
| EL-M08-S8-038 | link | visible-default | "<person>", → /analitik/kelas/pelajar/{id}, fa-arrow-up-right-from-square | FN-M08-3.2.4 |
| EL-M08-S8-039 | badge | visible-default | "Sederhana" | FN-M08-3.2.4 |
| EL-M08-S8-040 | link | visible-default | "Lihat Analitik", → /analitik/kelas/pelajar/{id}, fa-chart-line | FN-M08-3.2.4 |
| EL-M08-S8-041 | link | visible-default | "<person>", → /analitik/kelas/pelajar/{id}, fa-arrow-up-right-from-square | FN-M08-3.2.4 |
| EL-M08-S8-042 | badge | visible-default | "Rendah" | FN-M08-3.2.4 |
| EL-M08-S8-043 | link | visible-default | "Lihat Analitik", → /analitik/kelas/pelajar/{id}, fa-chart-line | FN-M08-3.2.4 |
| EL-M08-S8-044 | empty-state | conditional | "Tiada data analitik untuk kelas dan subjek ini." | FN-M08-3.2.2 |
| EL-M08-S8-045 | card | conditional | "4" | FN-M08-3.2.3 |
| EL-M08-S8-046 | card | conditional | "2" | FN-M08-3.2.3 |
| EL-M08-S8-047 | badge | conditional | "Sederhana" | FN-M08-3.2.4 |
| EL-M08-S8-048 | badge | conditional | "Sederhana" | FN-M08-3.2.4 |

#### S9 — `/analisa-item/sekolah` (21 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M08-S9-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S9-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S9-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S9-004 | link | visible-default | "Papan Pemuka", → /dashboard, fa-arrow-left | FN-M08-4.1.1 |
| EL-M08-S9-005 | text | visible-default | "/" | FN-M08-4.1.1 |
| EL-M08-S9-006 | text | visible-default | "Analisa Item Sekolah" | FN-M08-4.1.1 |
| EL-M08-S9-007 | card | visible-default | "<school>" | FN-M08-4.1.2 |
| EL-M08-S9-008 | heading | visible-default | "<school>" | FN-M08-4.1.2 |
| EL-M08-S9-009 | text | visible-default | "SK" | FN-M08-4.1.2 |
| EL-M08-S9-010 | text | visible-default | "PPD <ppd> • Perak" | FN-M08-4.1.2 |
| EL-M08-S9-011 | text | visible-default | "0" | FN-M08-4.1.2 |
| EL-M08-S9-012 | text | visible-default | "Pelajar" | FN-M08-4.1.2 |
| EL-M08-S9-013 | text | visible-default | "0" | FN-M08-4.1.2 |
| EL-M08-S9-014 | text | visible-default | "Jawapan" | FN-M08-4.1.2 |
| EL-M08-S9-015 | text | visible-default | "Tingkatan:", fa-graduation-cap | FN-M08-4.1.3 |
| EL-M08-S9-016 | link | visible-default | "Semua", → /analisa-item/sekolah | FN-M08-4.1.3 |
| EL-M08-S9-017 | link | visible-default | "Tingkatan 4", → /analisa-item/sekolah?tingkatan=T4 | FN-M08-4.1.3 |
| EL-M08-S9-018 | link | visible-default | "Tingkatan 5", → /analisa-item/sekolah?tingkatan=T5 | FN-M08-4.1.3 |
| EL-M08-S9-019 | card | visible-default | "Tiada Data Pelajar" | FN-M08-4.1.4 |
| EL-M08-S9-020 | heading | visible-default | "Tiada Data Pelajar" | FN-M08-4.1.4 |
| EL-M08-S9-021 | empty-state | visible-default | "Tiada data pelajar untuk sekolah ini. Pastikan pelajar telah berdaftar dan menjawab soalan latihan." | FN-M08-4.1.4 |

#### S10 — `/analisa-item/kelas` (13 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M08-S10-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S10-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S10-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S10-004 | link | visible-default | "Papan Pemuka", → /dashboard, fa-arrow-left | FN-M08-4.2.1 |
| EL-M08-S10-005 | card | visible-default | "Pilih Kelas untuk Analisis" | FN-M08-4.2.1 |
| EL-M08-S10-006 | heading | visible-default | "Pilih Kelas untuk Analisis" | FN-M08-4.2.1 |
| EL-M08-S10-007 | text | visible-default | "Klik mana-mana kelas untuk melihat analisa item" | FN-M08-4.2.1 |
| EL-M08-S10-008 | link | visible-default | "5 CYBER Sains Rumah Tangga 1 pelajar 2026 JOV330 Lihat Analisa", → /analisa-item/kelas/1156, fa-users | FN-M08-4.2.2 |
| EL-M08-S10-009 | heading | visible-default | "5 CYBER" | FN-M08-4.2.2 |
| EL-M08-S10-010 | link | visible-default | "sains rumah tangga Sains Rumah Tangga 0 pelajar 2026 0VV295 Lihat Analisa", → /analisa-item/kelas/1155, fa-users | FN-M08-4.2.2 |
| EL-M08-S10-011 | heading | visible-default | "sains rumah tangga" | FN-M08-4.2.2 |
| EL-M08-S10-012 | link | visible-default | "Chaos Academy Sains Rumah Tangga 0 pelajar 2026 PVZ601 Lihat Analisa", → /analisa-item/kelas/1154, fa-users | FN-M08-4.2.2 |
| EL-M08-S10-013 | heading | visible-default | "Chaos Academy" | FN-M08-4.2.2 |

#### S11 — `/analisa-item/kelas/{id}` (82 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M08-S11-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S11-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S11-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S11-004 | link | visible-default | "Papan Pemuka", → /dashboard, fa-arrow-left | FN-M08-4.3.1 |
| EL-M08-S11-005 | text | visible-default | "/" | FN-M08-4.3.1 |
| EL-M08-S11-006 | link | visible-default | "Pilih Kelas", → /analisa-item/kelas | FN-M08-4.3.1 |
| EL-M08-S11-007 | text | visible-default | "/" | FN-M08-4.3.1 |
| EL-M08-S11-008 | text | visible-default | "ALFA - Bahasa Inggeris" | FN-M08-4.3.1 |
| EL-M08-S11-009 | card | visible-default | "ALFA - Bahasa Inggeris" | FN-M08-4.3.2 |
| EL-M08-S11-010 | heading | visible-default | "ALFA - Bahasa Inggeris" | FN-M08-4.3.2 |
| EL-M08-S11-011 | text | visible-default | "Bahasa Inggeris • tingkatan-5 • Tahun 2026" | FN-M08-4.3.2 |
| EL-M08-S11-012 | text | visible-default | "93" | FN-M08-4.3.2 |
| EL-M08-S11-013 | text | visible-default | "Pelajar" | FN-M08-4.3.2 |
| EL-M08-S11-014 | text | visible-default | "596" | FN-M08-4.3.2 |
| EL-M08-S11-015 | text | visible-default | "Soalan Diuji" | FN-M08-4.3.2 |
| EL-M08-S11-016 | card | visible-default | "Mudah" | FN-M08-4.3.3 |
| EL-M08-S11-017 | text | visible-default | "381" | FN-M08-4.3.3 |
| EL-M08-S11-018 | text | visible-default | "Mudah" | FN-M08-4.3.3 |
| EL-M08-S11-019 | text | visible-default | "64% daripada soalan" | FN-M08-4.3.3 |
| EL-M08-S11-020 | card | visible-default | "Sederhana" | FN-M08-4.3.3 |
| EL-M08-S11-021 | text | visible-default | "78" | FN-M08-4.3.3 |
| EL-M08-S11-022 | text | visible-default | "Sederhana" | FN-M08-4.3.3 |
| EL-M08-S11-023 | text | visible-default | "13% daripada soalan" | FN-M08-4.3.3 |
| EL-M08-S11-024 | card | visible-default | "Sukar" | FN-M08-4.3.3 |
| EL-M08-S11-025 | text | visible-default | "137" | FN-M08-4.3.3 |
| EL-M08-S11-026 | text | visible-default | "Sukar" | FN-M08-4.3.3 |
| EL-M08-S11-027 | text | visible-default | "23% daripada soalan" | FN-M08-4.3.3 |
| EL-M08-S11-028 | button | visible-default | "Indeks Kesukaran 596", fa-chart-bar | FN-M08-4.3.4 |
| EL-M08-S11-029 | badge | visible-default | "596" | FN-M08-4.3.4 |
| EL-M08-S11-030 | button | visible-default | "Indeks Diskriminasi 596", fa-filter | FN-M08-4.3.4 |
| EL-M08-S11-031 | badge | visible-default | "596" | FN-M08-4.3.4 |
| EL-M08-S11-032 | input | visible-default | — | FN-M08-4.3.5 |
| EL-M08-S11-033 | select | visible-default | 5 options | FN-M08-4.3.5 |
| EL-M08-S11-034 | card | visible-default | "#" | FN-M08-4.3.6 |
| EL-M08-S11-035 | table | visible-default | columns: # · Soalan · Subjek / Topik · Percubaan · Ketepatan · Indeks · Tahap | FN-M08-4.3.6 |
| EL-M08-S11-036 | clickable | visible-default | "1 Which of the following is a fact? Bahasa Inggeris — English Form 4 — English Form 4 2 pelajar salah Bahasa I…", fa-users | FN-M08-4.3.6 |
| EL-M08-S11-037 | link | conditional | "<masked> 1x salah", → /prestasi/{id}, fa-user | FN-M08-4.3.7 |
| EL-M08-S11-038 | link | conditional | "<masked> 1x salah", → /prestasi/{id}, fa-user | FN-M08-4.3.7 |
| EL-M08-S11-039 | clickable | visible-default | "2 "By the time we arrived, the movie _____ already started." Choose the correct form: Bahasa Inggeris — Englis…", fa-users | FN-M08-4.3.6 |
| EL-M08-S11-040 | link | hidden-only | "<masked> 1x salah", → /prestasi/{id}, fa-user | FN-M08-4.3.7 |
| EL-M08-S11-041 | link | hidden-only | "<masked> 1x salah", → /prestasi/{id}, fa-user | FN-M08-4.3.7 |
| EL-M08-S11-042 | clickable | visible-default | "3 "If it rains tomorrow, we _____ cancel the picnic." Choose the correct answer: Bahasa Inggeris — English For…", fa-users | FN-M08-4.3.6 |
| EL-M08-S11-043 | link | hidden-only | "<masked> 1x salah", → /prestasi/{id}, fa-user | FN-M08-4.3.7 |
| EL-M08-S11-044 | card | conditional | "Panduan Indeks Diskriminasi" | FN-M08-4.3.9 |
| EL-M08-S11-045 | heading | conditional | "Panduan Indeks Diskriminasi" | FN-M08-4.3.9 |
| EL-M08-S11-046 | text | conditional | "≥ 0.40" | FN-M08-4.3.9 |
| EL-M08-S11-047 | text | conditional | "= Sangat Baik" | FN-M08-4.3.9 |
| EL-M08-S11-048 | text | conditional | "0.30 – 0.39" | FN-M08-4.3.9 |
| EL-M08-S11-049 | text | conditional | "= Baik" | FN-M08-4.3.9 |
| EL-M08-S11-050 | text | conditional | "0.20 – 0.29" | FN-M08-4.3.9 |
| EL-M08-S11-051 | text | conditional | "= Sederhana" | FN-M08-4.3.9 |
| EL-M08-S11-052 | text | conditional | "< 0.20" | FN-M08-4.3.9 |
| EL-M08-S11-053 | text | conditional | "= Lemah" | FN-M08-4.3.9 |
| EL-M08-S11-054 | text | conditional | "Indeks dikira berdasarkan perbezaan prestasi antara dengan menggunakan semua sesi latihan." | FN-M08-4.3.9 |
| EL-M08-S11-055 | text | conditional | "27% pelajar terbaik" | FN-M08-4.3.9 |
| EL-M08-S11-056 | text | conditional | "27% pelajar bawah" | FN-M08-4.3.9 |
| EL-M08-S11-057 | card | conditional | "#" | FN-M08-4.3.10 |
| EL-M08-S11-058 | table | conditional | columns: # · Soalan · Kumpulan Atas · Kumpulan Bawah · Indeks · Status | FN-M08-4.3.10 |
| EL-M08-S11-059 | card | visible-default | "Tukar Kelas" | FN-M08-4.3.12 |
| EL-M08-S11-060 | heading | visible-default | "Tukar Kelas" | FN-M08-4.3.12 |
| EL-M08-S11-061 | link | visible-default | "5 CYBER", → /analisa-item/kelas/1156 | FN-M08-4.3.12 |
| EL-M08-S11-062 | link | visible-default | "sains rumah tangga", → /analisa-item/kelas/1155 | FN-M08-4.3.12 |
| EL-M08-S11-063 | link | visible-default | "Chaos Academy", → /analisa-item/kelas/1154 | FN-M08-4.3.12 |
| EL-M08-S11-064 | text | conditional | "4 Dedikasi - BM" | FN-M08-4.3.1 |
| EL-M08-S11-065 | card | conditional | "4 Dedikasi - BM" | FN-M08-4.3.2 |
| EL-M08-S11-066 | heading | conditional | "4 Dedikasi - BM" | FN-M08-4.3.2 |
| EL-M08-S11-067 | text | conditional | "Bahasa Melayu • tingkatan-4 • Tahun 2026" | FN-M08-4.3.2 |
| EL-M08-S11-068 | button | conditional | "Indeks Kesukaran 0", fa-chart-bar | FN-M08-4.3.4 |
| EL-M08-S11-069 | button | conditional | "Indeks Diskriminasi 0", fa-filter | FN-M08-4.3.4 |
| EL-M08-S11-070 | card | conditional | "Tiada Data Lagi" | FN-M08-4.3.8 |
| EL-M08-S11-071 | heading | conditional | "Tiada Data Lagi" | FN-M08-4.3.8 |
| EL-M08-S11-072 | text | conditional | "Pelajar dalam kelas ini belum menjawab sebarang soalan lagi." | FN-M08-4.3.8 |
| EL-M08-S11-073 | card | conditional | "Data Tidak Mencukupi" | FN-M08-4.3.11 |
| EL-M08-S11-074 | heading | conditional | "Data Tidak Mencukupi" | FN-M08-4.3.11 |
| EL-M08-S11-075 | text | conditional | "Perlu sekurang-kurangnya 4 pelajar dengan sesi latihan selesai untuk mengira indeks diskriminasi." | FN-M08-4.3.11 |
| EL-M08-S11-076 | text | conditional | "403" | FN-M08-1.2.4 |
| EL-M08-S11-077 | text | conditional | "🚫" | FN-M08-1.2.4 |
| EL-M08-S11-078 | heading | conditional | "Akses Ditolak" | FN-M08-1.2.4 |
| EL-M08-S11-079 | text | conditional | "Anda tidak mempunyai kebenaran untuk mengakses halaman ini. Sila log masuk dengan akaun yang betul atau hubung…" | FN-M08-1.2.4 |
| EL-M08-S11-080 | link | conditional | "Halaman Utama", → / | FN-M08-1.2.4 |
| EL-M08-S11-081 | link | conditional | "Log Masuk", → /login | FN-M08-1.2.4 |
| EL-M08-S11-082 | text | conditional | "PRESTASIPLUS" | FN-M08-1.2.4 |

#### S12 — `/headcount` (42 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M08-S12-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S12-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S12-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S12-004 | heading | visible-default | "Headcount" | FN-M08-5.1.1 |
| EL-M08-S12-005 | text | visible-default | "Tracking prestasi murid — TOV, OTR, AR & RS" | FN-M08-5.1.1 |
| EL-M08-S12-006 | link | visible-default | "Dashboard", → /headcount/dashboard, fa-tachometer-alt | FN-M08-5.1.1 |
| EL-M08-S12-007 | link | visible-default | "Buat Baru", → /headcount/create, fa-plus | FN-M08-5.1.1 |
| EL-M08-S12-008 | button | visible-default | "Auto-Setup", fa-magic | FN-M08-5.1.1 |
| EL-M08-S12-009 | card | visible-default | "Buat Sekarang" | FN-M08-5.1.2 |
| EL-M08-S12-010 | text | visible-default | "Belum ada headcount." | FN-M08-5.1.2 |
| EL-M08-S12-011 | link | visible-default | "Buat Sekarang", → /headcount/create, fa-plus | FN-M08-5.1.2 |
| EL-M08-S12-012 | modal | conditional | "Auto-Setup Headcount" | FN-M08-5.1.3 |
| EL-M08-S12-013 | clickable | conditional | — | FN-M08-5.1.3 |
| EL-M08-S12-014 | clickable | conditional | "Auto-Setup Headcount Pilih tingkatan untuk auto-cipta headcount Darjah D1 D2 D3 D4 D5 D6 Tingkatan T1 T2 T3 T4…", fa-magic | FN-M08-5.1.3 |
| EL-M08-S12-015 | heading | conditional | "Auto-Setup Headcount" | FN-M08-5.1.3 |
| EL-M08-S12-016 | form | conditional | — | FN-M08-5.1.4 |
| EL-M08-S12-017 | hidden-field | hidden-only | `name=_token` | FN-M08-5.1.4 |
| EL-M08-S12-018 | label | conditional | "D1" | FN-M08-5.1.4 |
| EL-M08-S12-019 | checkbox | conditional | label "D1", `name=levels[]` | FN-M08-5.1.4 |
| EL-M08-S12-020 | label | conditional | "D2" | FN-M08-5.1.4 |
| EL-M08-S12-021 | checkbox | conditional | label "D2", `name=levels[]` | FN-M08-5.1.4 |
| EL-M08-S12-022 | label | conditional | "D3" | FN-M08-5.1.4 |
| EL-M08-S12-023 | checkbox | conditional | label "D3", `name=levels[]` | FN-M08-5.1.4 |
| EL-M08-S12-024 | label | conditional | "D4" | FN-M08-5.1.4 |
| EL-M08-S12-025 | checkbox | conditional | label "D4", `name=levels[]` | FN-M08-5.1.4 |
| EL-M08-S12-026 | label | conditional | "D5" | FN-M08-5.1.4 |
| EL-M08-S12-027 | checkbox | conditional | label "D5", `name=levels[]` | FN-M08-5.1.4 |
| EL-M08-S12-028 | label | conditional | "D6" | FN-M08-5.1.4 |
| EL-M08-S12-029 | checkbox | conditional | label "D6", `name=levels[]` | FN-M08-5.1.4 |
| EL-M08-S12-030 | label | conditional | "T1" | FN-M08-5.1.4 |
| EL-M08-S12-031 | checkbox | conditional | label "T1", `name=levels[]` | FN-M08-5.1.4 |
| EL-M08-S12-032 | label | conditional | "T2" | FN-M08-5.1.4 |
| EL-M08-S12-033 | checkbox | conditional | label "T2", `name=levels[]` | FN-M08-5.1.4 |
| EL-M08-S12-034 | label | conditional | "T3" | FN-M08-5.1.4 |
| EL-M08-S12-035 | checkbox | conditional | label "T3", `name=levels[]` | FN-M08-5.1.4 |
| EL-M08-S12-036 | label | conditional | "T4" | FN-M08-5.1.4 |
| EL-M08-S12-037 | checkbox | conditional | label "T4", `name=levels[]` | FN-M08-5.1.4 |
| EL-M08-S12-038 | label | conditional | "T5" | FN-M08-5.1.4 |
| EL-M08-S12-039 | checkbox | conditional | label "T5", `name=levels[]` | FN-M08-5.1.4 |
| EL-M08-S12-040 | button | conditional | "Batal" | FN-M08-5.1.3 |
| EL-M08-S12-041 | button | conditional | "Auto-Setup (0)", fa-magic | FN-M08-5.1.5 |
| EL-M08-S12-042 | button | conditional | "Auto-Setup (2)", fa-magic | FN-M08-5.1.5 |

#### S13 — `/headcount/dashboard` (32 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M08-S13-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S13-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S13-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S13-004 | heading | visible-default | "Dashboard Headcount" | FN-M08-5.2.1 |
| EL-M08-S13-005 | text | visible-default | "Ringkasan prestasi semua kelas anda" | FN-M08-5.2.1 |
| EL-M08-S13-006 | link | visible-default | "Senarai Penuh", → /headcount, fa-list | FN-M08-5.2.1 |
| EL-M08-S13-007 | card | visible-default | "Tapis:" | FN-M08-5.2.2 |
| EL-M08-S13-008 | text | visible-default | "Tapis:", fa-filter | FN-M08-5.2.2 |
| EL-M08-S13-009 | button | visible-default | "Semua (0)" | FN-M08-5.2.2 |
| EL-M08-S13-010 | button | hidden-only | — | FN-M08-5.2.2 |
| EL-M08-S13-011 | card | visible-default | "0" | FN-M08-5.2.3 |
| EL-M08-S13-012 | text | visible-default | "0" | FN-M08-5.2.3 |
| EL-M08-S13-013 | text | visible-default | "Konfigurasi" | FN-M08-5.2.3 |
| EL-M08-S13-014 | card | visible-default | "0" | FN-M08-5.2.3 |
| EL-M08-S13-015 | text | visible-default | "0" | FN-M08-5.2.3 |
| EL-M08-S13-016 | text | visible-default | "Jumlah Murid" | FN-M08-5.2.3 |
| EL-M08-S13-017 | card | visible-default | "0" | FN-M08-5.2.3 |
| EL-M08-S13-018 | text | visible-default | "0" | FN-M08-5.2.3 |
| EL-M08-S13-019 | text | visible-default | "On Track" | FN-M08-5.2.3 |
| EL-M08-S13-020 | card | visible-default | "0" | FN-M08-5.2.3 |
| EL-M08-S13-021 | text | visible-default | "0" | FN-M08-5.2.3 |
| EL-M08-S13-022 | text | visible-default | "Off Track" | FN-M08-5.2.3 |
| EL-M08-S13-023 | card | hidden-only | "Keseluruhan On-Track" | FN-M08-5.2.4 |
| EL-M08-S13-024 | text | hidden-only | "Keseluruhan On-Track" | FN-M08-5.2.4 |
| EL-M08-S13-025 | text | hidden-only | "0%" | FN-M08-5.2.4 |
| EL-M08-S13-026 | text | hidden-only | "On Track:" | FN-M08-5.2.4 |
| EL-M08-S13-027 | text | hidden-only | "0" | FN-M08-5.2.4 |
| EL-M08-S13-028 | text | hidden-only | "Off Track:" | FN-M08-5.2.4 |
| EL-M08-S13-029 | text | hidden-only | "0" | FN-M08-5.2.4 |
| EL-M08-S13-030 | empty-state | hidden-only | "Tiada Data:" | FN-M08-5.2.4 |
| EL-M08-S13-031 | text | hidden-only | "0" | FN-M08-5.2.4 |
| EL-M08-S13-032 | text | visible-default | "Belum ada headcount." | FN-M08-5.2.5 |

#### S14 — `/headcount/create` (32 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M08-S14-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S14-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S14-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S14-004 | link | visible-default | → /headcount, fa-arrow-left | FN-M08-5.3.1 |
| EL-M08-S14-005 | heading | visible-default | "Buat Headcount Baru" | FN-M08-5.3.1 |
| EL-M08-S14-006 | form | visible-default | — | FN-M08-5.3.2 |
| EL-M08-S14-007 | hidden-field | hidden-only | `name=_token` | FN-M08-5.3.2 |
| EL-M08-S14-008 | label | visible-default | "Pilih Kelas" | FN-M08-5.3.2 |
| EL-M08-S14-009 | select | visible-default | label "Pilih Kelas", `name=classroom_id`, 1 options, required | FN-M08-5.3.2 |
| EL-M08-S14-010 | label | visible-default | "Pilih Subjek" | FN-M08-5.3.2 |
| EL-M08-S14-011 | select | visible-default | label "Pilih Subjek", `name=subject_id`, 32 options, required | FN-M08-5.3.2 |
| EL-M08-S14-012 | label | visible-default | "Tingkatan" | FN-M08-5.3.2 |
| EL-M08-S14-013 | select | visible-default | label "Tingkatan", `name=education_level_id`, 3 options, required | FN-M08-5.3.2 |
| EL-M08-S14-014 | label | visible-default | "Tahun Akademik" | FN-M08-5.3.2 |
| EL-M08-S14-015 | input | visible-default | label "Tahun Akademik", `name=academic_year`, required | FN-M08-5.3.2 |
| EL-M08-S14-016 | label | visible-default | "Bilangan OTR" | FN-M08-5.3.3 |
| EL-M08-S14-017 | label | visible-default | "2 OTR" | FN-M08-5.3.3 |
| EL-M08-S14-018 | radio | visible-default | label "2 OTR", `name=active_otrs` | FN-M08-5.3.3 |
| EL-M08-S14-019 | label | visible-default | "3 OTR" | FN-M08-5.3.3 |
| EL-M08-S14-020 | radio | visible-default | label "3 OTR", `name=active_otrs` | FN-M08-5.3.3 |
| EL-M08-S14-021 | label | visible-default | "4 OTR" | FN-M08-5.3.3 |
| EL-M08-S14-022 | radio | visible-default | label "4 OTR", `name=active_otrs` | FN-M08-5.3.3 |
| EL-M08-S14-023 | label | visible-default | "5 OTR" | FN-M08-5.3.3 |
| EL-M08-S14-024 | radio | visible-default | label "5 OTR", `name=active_otrs` | FN-M08-5.3.3 |
| EL-M08-S14-025 | text | visible-default | "Minimum 2 OTR · Default 3 OTR · Boleh tukar 2/3/4/5 ikut keperluan kelas." | FN-M08-5.3.3 |
| EL-M08-S14-026 | label | visible-default | "Mod Pengiraan Markah" | FN-M08-5.3.4 |
| EL-M08-S14-027 | label | visible-default | "🤖 Auto Markah dikira automatik dari soalan latih tubi SPM + Tracking A pelajar di platform PrestasiPlus." | FN-M08-5.3.4 |
| EL-M08-S14-028 | radio | visible-default | label "🤖 Auto Markah dikira automatik dari soalan latih tubi SPM + Tracking A pelajar di platform PrestasiPlus.", `name=mode` | FN-M08-5.3.4 |
| EL-M08-S14-029 | label | visible-default | "✍️ Manual Cikgu key-in markah pelajar sendiri (cth: dari peperiksaan formal sekolah)." | FN-M08-5.3.4 |
| EL-M08-S14-030 | radio | visible-default | label "✍️ Manual Cikgu key-in markah pelajar sendiri (cth: dari peperiksaan formal sekolah).", `name=mode` | FN-M08-5.3.4 |
| EL-M08-S14-031 | text | visible-default | "Boleh ada 1 Auto + 1 Manual untuk kelas + subjek + tahun yang sama." | FN-M08-5.3.4 |
| EL-M08-S14-032 | button | visible-default | "Cipta Headcount", fa-plus | FN-M08-5.3.5 |

#### S15 — `/headcount/student/{id}` (244 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M08-S15-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S15-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S15-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S15-004 | link | visible-default | → javascript:history.back(), fa-arrow-left | FN-M08-5.4.1 |
| EL-M08-S15-005 | heading | visible-default | "<masked>" | FN-M08-5.4.1 |
| EL-M08-S15-006 | text | visible-default | "Headcount — Prestasi Individu ·" | FN-M08-5.4.1 |
| EL-M08-S15-007 | text | visible-default | "<school>" | FN-M08-5.4.1 |
| EL-M08-S15-008 | card | visible-default | "Bahasa Melayu" | FN-M08-5.4.2 |
| EL-M08-S15-009 | heading | visible-default | "Bahasa Melayu" | FN-M08-5.4.2 |
| EL-M08-S15-010 | text | visible-default | "<school>", fa-school | FN-M08-5.4.2 |
| EL-M08-S15-011 | text | visible-default | "Tingkatan 5", fa-layer-group | FN-M08-5.4.2 |
| EL-M08-S15-012 | text | visible-default | "MARIKH - Bahasa Melayu", fa-users | FN-M08-5.4.2 |
| EL-M08-S15-013 | text | visible-default | "2026" | FN-M08-5.4.3 |
| EL-M08-S15-014 | empty-state | visible-default | "Belum Ada Data" | FN-M08-5.4.3 |
| EL-M08-S15-015 | text | visible-default | "TOV:" | FN-M08-5.4.3 |
| EL-M08-S15-016 | text | visible-default | "91.2% (A+)" | FN-M08-5.4.3 |
| EL-M08-S15-017 | text | visible-default | "ETR:" | FN-M08-5.4.3 |
| EL-M08-S15-018 | text | visible-default | "—" | FN-M08-5.4.3 |
| EL-M08-S15-019 | text | visible-default | "Unjuran:", fa-arrow-trend-up | FN-M08-5.4.3 |
| EL-M08-S15-020 | text | visible-default | "94.1% (A+)" | FN-M08-5.4.3 |
| EL-M08-S15-021 | text | visible-default | "Stabil", fa-minus | FN-M08-5.4.3 |
| EL-M08-S15-022 | text | visible-default | "Keyakinan:" | FN-M08-5.4.3 |
| EL-M08-S15-023 | text | visible-default | "Sederhana" | FN-M08-5.4.3 |
| EL-M08-S15-024 | table | visible-default | columns: Checkpoint · Target (%) · Gred Target · AR (%) · Gred AR · Status | FN-M08-5.4.5 |
| EL-M08-S15-025 | card | visible-default | "Kimia" | FN-M08-5.4.2 |
| EL-M08-S15-026 | heading | visible-default | "Kimia" | FN-M08-5.4.2 |
| EL-M08-S15-027 | text | visible-default | "<school>", fa-school | FN-M08-5.4.2 |
| EL-M08-S15-028 | text | visible-default | "Tingkatan 5", fa-layer-group | FN-M08-5.4.2 |
| EL-M08-S15-029 | text | visible-default | "5 MARIKH", fa-users | FN-M08-5.4.2 |
| EL-M08-S15-030 | text | visible-default | "2026" | FN-M08-5.4.3 |
| EL-M08-S15-031 | empty-state | visible-default | "Belum Ada Data" | FN-M08-5.4.3 |
| EL-M08-S15-032 | text | visible-default | "TOV:" | FN-M08-5.4.3 |
| EL-M08-S15-033 | text | visible-default | "69.0% (B+)" | FN-M08-5.4.3 |
| EL-M08-S15-034 | text | visible-default | "ETR:" | FN-M08-5.4.3 |
| EL-M08-S15-035 | text | visible-default | "—" | FN-M08-5.4.3 |
| EL-M08-S15-036 | text | visible-default | "Unjuran:", fa-arrow-trend-up | FN-M08-5.4.3 |
| EL-M08-S15-037 | text | visible-default | "71.2% (A-)" | FN-M08-5.4.3 |
| EL-M08-S15-038 | text | visible-default | "Meningkat", fa-arrow-up | FN-M08-5.4.3 |
| EL-M08-S15-039 | text | visible-default | "Keyakinan:" | FN-M08-5.4.3 |
| EL-M08-S15-040 | text | visible-default | "Tinggi" | FN-M08-5.4.3 |
| EL-M08-S15-041 | table | visible-default | columns: Checkpoint · Target (%) · Gred Target · AR (%) · Gred AR · Status | FN-M08-5.4.5 |
| EL-M08-S15-042 | card | visible-default | "Kimia" | FN-M08-5.4.2 |
| EL-M08-S15-043 | heading | visible-default | "Kimia" | FN-M08-5.4.2 |
| EL-M08-S15-044 | text | visible-default | "<school>", fa-school | FN-M08-5.4.2 |
| EL-M08-S15-045 | text | visible-default | "Tingkatan 5", fa-layer-group | FN-M08-5.4.2 |
| EL-M08-S15-046 | text | visible-default | "5 MARIKH - Kimia", fa-users | FN-M08-5.4.2 |
| EL-M08-S15-047 | text | visible-default | "2026" | FN-M08-5.4.3 |
| EL-M08-S15-048 | empty-state | visible-default | "Belum Ada Data" | FN-M08-5.4.3 |
| EL-M08-S15-049 | text | visible-default | "TOV:" | FN-M08-5.4.3 |
| EL-M08-S15-050 | text | visible-default | "69.0% (B+)" | FN-M08-5.4.3 |
| EL-M08-S15-051 | text | visible-default | "ETR:" | FN-M08-5.4.3 |
| EL-M08-S15-052 | text | visible-default | "—" | FN-M08-5.4.3 |
| EL-M08-S15-053 | text | visible-default | "Unjuran:", fa-arrow-trend-up | FN-M08-5.4.3 |
| EL-M08-S15-054 | text | visible-default | "71.2% (A-)" | FN-M08-5.4.3 |
| EL-M08-S15-055 | text | visible-default | "Meningkat", fa-arrow-up | FN-M08-5.4.3 |
| EL-M08-S15-056 | text | visible-default | "Keyakinan:" | FN-M08-5.4.3 |
| EL-M08-S15-057 | text | visible-default | "Tinggi" | FN-M08-5.4.3 |
| EL-M08-S15-058 | table | visible-default | columns: Checkpoint · Target (%) · Gred Target · AR (%) · Gred AR · Status | FN-M08-5.4.5 |
| EL-M08-S15-066 | text | conditional | "Tingkatan 4", fa-layer-group | FN-M08-5.4.2 |
| EL-M08-S15-067 | text | conditional | "4 Simulasi", fa-users | FN-M08-5.4.2 |
| EL-M08-S15-068 | text | conditional | "On Track" | FN-M08-5.4.3 |
| EL-M08-S15-069 | badge | conditional | "RS: 69.0% (B+)", fa-star | FN-M08-5.4.3 |
| EL-M08-S15-070 | text | conditional | "55.0% (C+)" | FN-M08-5.4.3 |
| EL-M08-S15-071 | text | conditional | "RS:" | FN-M08-5.4.3 |
| EL-M08-S15-072 | text | conditional | "69% (B+)" | FN-M08-5.4.3 |
| EL-M08-S15-073 | text | conditional | "Rendah" | FN-M08-5.4.3 |
| EL-M08-S15-074 | heading | conditional | "Ketepatan Ramalan ETR vs RS" | FN-M08-5.4.6 |
| EL-M08-S15-075 | text | conditional | "ETR (Ramalan):" | FN-M08-5.4.6 |
| EL-M08-S15-076 | text | conditional | "69.0% (B+)" | FN-M08-5.4.6 |
| EL-M08-S15-077 | text | conditional | "RS (Sebenar):" | FN-M08-5.4.6 |
| EL-M08-S15-078 | text | conditional | "69.0% (B+)" | FN-M08-5.4.6 |
| EL-M08-S15-079 | text | conditional | "Selisih:" | FN-M08-5.4.6 |
| EL-M08-S15-080 | text | conditional | "+0 markah" | FN-M08-5.4.6 |
| EL-M08-S15-081 | text | conditional | "Ramalan Tepat" | FN-M08-5.4.6 |
| EL-M08-S15-082 | text | conditional | "Ramalan ETR sangat tepat — selisih dalam lingkungan ±5 markah." | FN-M08-5.4.6 |
| EL-M08-S15-083 | card | conditional | "Bahasa Inggeris" | FN-M08-5.4.2 |
| EL-M08-S15-084 | heading | conditional | "Bahasa Inggeris" | FN-M08-5.4.2 |
| EL-M08-S15-085 | text | conditional | "Tingkatan 4", fa-layer-group | FN-M08-5.4.2 |
| EL-M08-S15-086 | text | conditional | "4 Simulasi", fa-users | FN-M08-5.4.2 |
| EL-M08-S15-087 | text | conditional | "Below Target" | FN-M08-5.4.3 |
| EL-M08-S15-088 | badge | conditional | "RS: 57.0% (C+)", fa-star | FN-M08-5.4.3 |
| EL-M08-S15-089 | text | conditional | "59.0% (C+)" | FN-M08-5.4.3 |
| EL-M08-S15-090 | text | conditional | "57.0% (C+)" | FN-M08-5.4.3 |
| EL-M08-S15-091 | text | conditional | "RS:" | FN-M08-5.4.3 |
| EL-M08-S15-092 | text | conditional | "57.0% (C+)" | FN-M08-5.4.3 |
| EL-M08-S15-093 | text | conditional | "57% (C+)" | FN-M08-5.4.3 |
| EL-M08-S15-094 | text | conditional | "Rendah" | FN-M08-5.4.3 |
| EL-M08-S15-095 | heading | conditional | "Ketepatan Ramalan ETR vs RS" | FN-M08-5.4.6 |
| EL-M08-S15-096 | text | conditional | "ETR (Ramalan):" | FN-M08-5.4.6 |
| EL-M08-S15-097 | text | conditional | "57.0% (C+)" | FN-M08-5.4.6 |
| EL-M08-S15-098 | text | conditional | "RS (Sebenar):" | FN-M08-5.4.6 |
| EL-M08-S15-099 | text | conditional | "57.0% (C+)" | FN-M08-5.4.6 |
| EL-M08-S15-100 | text | conditional | "Selisih:" | FN-M08-5.4.6 |
| EL-M08-S15-101 | text | conditional | "+0 markah" | FN-M08-5.4.6 |
| EL-M08-S15-102 | text | conditional | "Ramalan Tepat" | FN-M08-5.4.6 |
| EL-M08-S15-103 | text | conditional | "Ramalan ETR sangat tepat — selisih dalam lingkungan ±5 markah." | FN-M08-5.4.6 |
| EL-M08-S15-104 | card | conditional | "Matematik" | FN-M08-5.4.2 |
| EL-M08-S15-105 | heading | conditional | "Matematik" | FN-M08-5.4.2 |
| EL-M08-S15-106 | text | conditional | "Tingkatan 4", fa-layer-group | FN-M08-5.4.2 |
| EL-M08-S15-107 | text | conditional | "4 Simulasi", fa-users | FN-M08-5.4.2 |
| EL-M08-S15-108 | text | conditional | "Below Target" | FN-M08-5.4.3 |
| EL-M08-S15-109 | badge | conditional | "RS: 65.0% (B+)", fa-star | FN-M08-5.4.3 |
| EL-M08-S15-110 | text | conditional | "55.0% (C+)" | FN-M08-5.4.3 |
| EL-M08-S15-111 | text | conditional | "65.0% (B+)" | FN-M08-5.4.3 |
| EL-M08-S15-112 | text | conditional | "RS:" | FN-M08-5.4.3 |
| EL-M08-S15-113 | text | conditional | "65.0% (B+)" | FN-M08-5.4.3 |
| EL-M08-S15-114 | text | conditional | "65% (B+)" | FN-M08-5.4.3 |
| EL-M08-S15-115 | text | conditional | "Rendah" | FN-M08-5.4.3 |
| EL-M08-S15-116 | heading | conditional | "Ketepatan Ramalan ETR vs RS" | FN-M08-5.4.6 |
| EL-M08-S15-117 | text | conditional | "ETR (Ramalan):" | FN-M08-5.4.6 |
| EL-M08-S15-118 | text | conditional | "65.0% (B+)" | FN-M08-5.4.6 |
| EL-M08-S15-119 | text | conditional | "RS (Sebenar):" | FN-M08-5.4.6 |
| EL-M08-S15-120 | text | conditional | "65.0% (B+)" | FN-M08-5.4.6 |
| EL-M08-S15-121 | text | conditional | "Selisih:" | FN-M08-5.4.6 |
| EL-M08-S15-122 | text | conditional | "+0 markah" | FN-M08-5.4.6 |
| EL-M08-S15-123 | text | conditional | "Ramalan Tepat" | FN-M08-5.4.6 |
| EL-M08-S15-124 | text | conditional | "Ramalan ETR sangat tepat — selisih dalam lingkungan ±5 markah." | FN-M08-5.4.6 |
| EL-M08-S15-125 | card | conditional | "Sains" | FN-M08-5.4.2 |
| EL-M08-S15-126 | heading | conditional | "Sains" | FN-M08-5.4.2 |
| EL-M08-S15-127 | text | conditional | "<school>", fa-school | FN-M08-5.4.2 |
| EL-M08-S15-128 | text | conditional | "Tingkatan 4", fa-layer-group | FN-M08-5.4.2 |
| EL-M08-S15-129 | text | conditional | "4 Simulasi", fa-users | FN-M08-5.4.2 |
| EL-M08-S15-130 | text | conditional | "2026" | FN-M08-5.4.3 |
| EL-M08-S15-131 | badge | conditional | "RS: 60.0% (B)", fa-star | FN-M08-5.4.3 |
| EL-M08-S15-132 | text | conditional | "TOV:" | FN-M08-5.4.3 |
| EL-M08-S15-133 | text | conditional | "70.5% (A-)" | FN-M08-5.4.3 |
| EL-M08-S15-134 | text | conditional | "ETR:" | FN-M08-5.4.3 |
| EL-M08-S15-135 | text | conditional | "60.0% (B)" | FN-M08-5.4.3 |
| EL-M08-S15-136 | text | conditional | "RS:" | FN-M08-5.4.3 |
| EL-M08-S15-137 | text | conditional | "60.0% (B)" | FN-M08-5.4.3 |
| EL-M08-S15-138 | text | conditional | "Unjuran:", fa-arrow-trend-up | FN-M08-5.4.3 |
| EL-M08-S15-139 | text | conditional | "60% (B)" | FN-M08-5.4.3 |
| EL-M08-S15-140 | text | conditional | "Menurun", fa-arrow-down | FN-M08-5.4.3 |
| EL-M08-S15-141 | text | conditional | "Keyakinan:" | FN-M08-5.4.3 |
| EL-M08-S15-142 | text | conditional | "Rendah" | FN-M08-5.4.3 |
| EL-M08-S15-143 | table | conditional | columns: Checkpoint · Target (%) · Gred Target · AR (%) · Gred AR · Status | FN-M08-5.4.5 |
| EL-M08-S15-144 | heading | conditional | "Ketepatan Ramalan ETR vs RS" | FN-M08-5.4.6 |
| EL-M08-S15-145 | text | conditional | "ETR (Ramalan):" | FN-M08-5.4.6 |
| EL-M08-S15-146 | text | conditional | "60.0% (B)" | FN-M08-5.4.6 |
| EL-M08-S15-147 | text | conditional | "RS (Sebenar):" | FN-M08-5.4.6 |
| EL-M08-S15-148 | text | conditional | "60.0% (B)" | FN-M08-5.4.6 |
| EL-M08-S15-149 | text | conditional | "Selisih:" | FN-M08-5.4.6 |
| EL-M08-S15-150 | text | conditional | "+0 markah" | FN-M08-5.4.6 |
| EL-M08-S15-151 | text | conditional | "Ramalan Tepat" | FN-M08-5.4.6 |
| EL-M08-S15-152 | text | conditional | "Ramalan ETR sangat tepat — selisih dalam lingkungan ±5 markah." | FN-M08-5.4.6 |
| EL-M08-S15-153 | card | conditional | "Sejarah" | FN-M08-5.4.2 |
| EL-M08-S15-154 | heading | conditional | "Sejarah" | FN-M08-5.4.2 |
| EL-M08-S15-155 | text | conditional | "<school>", fa-school | FN-M08-5.4.2 |
| EL-M08-S15-156 | text | conditional | "Tingkatan 4", fa-layer-group | FN-M08-5.4.2 |
| EL-M08-S15-157 | text | conditional | "4 Simulasi", fa-users | FN-M08-5.4.2 |
| EL-M08-S15-158 | text | conditional | "2026" | FN-M08-5.4.3 |
| EL-M08-S15-159 | text | conditional | "Below Target" | FN-M08-5.4.3 |
| EL-M08-S15-160 | badge | conditional | "RS: 47.0% (D)", fa-star | FN-M08-5.4.3 |
| EL-M08-S15-161 | text | conditional | "TOV:" | FN-M08-5.4.3 |
| EL-M08-S15-162 | text | conditional | "46.0% (D)" | FN-M08-5.4.3 |
| EL-M08-S15-163 | text | conditional | "ETR:" | FN-M08-5.4.3 |
| EL-M08-S15-164 | text | conditional | "57.0% (C+)" | FN-M08-5.4.3 |
| EL-M08-S15-165 | text | conditional | "RS:" | FN-M08-5.4.3 |
| EL-M08-S15-166 | text | conditional | "47.0% (D)" | FN-M08-5.4.3 |
| EL-M08-S15-167 | text | conditional | "Unjuran:", fa-arrow-trend-up | FN-M08-5.4.3 |
| EL-M08-S15-168 | text | conditional | "57% (C+)" | FN-M08-5.4.3 |
| EL-M08-S15-169 | text | conditional | "Meningkat", fa-arrow-up | FN-M08-5.4.3 |
| EL-M08-S15-170 | text | conditional | "Keyakinan:" | FN-M08-5.4.3 |
| EL-M08-S15-171 | text | conditional | "Rendah" | FN-M08-5.4.3 |
| EL-M08-S15-172 | table | conditional | columns: Checkpoint · Target (%) · Gred Target · AR (%) · Gred AR · Status | FN-M08-5.4.5 |
| EL-M08-S15-173 | heading | conditional | "Ketepatan Ramalan ETR vs RS" | FN-M08-5.4.6 |
| EL-M08-S15-174 | text | conditional | "ETR (Ramalan):" | FN-M08-5.4.6 |
| EL-M08-S15-175 | text | conditional | "57.0% (C+)" | FN-M08-5.4.6 |
| EL-M08-S15-176 | text | conditional | "RS (Sebenar):" | FN-M08-5.4.6 |
| EL-M08-S15-177 | text | conditional | "47.0% (D)" | FN-M08-5.4.6 |
| EL-M08-S15-178 | text | conditional | "Selisih:" | FN-M08-5.4.6 |
| EL-M08-S15-179 | text | conditional | "-10 markah" | FN-M08-5.4.6 |
| EL-M08-S15-180 | text | conditional | "Hampir Tepat" | FN-M08-5.4.6 |
| EL-M08-S15-181 | text | conditional | "Ramalan ETR agak tepat — selisih dalam lingkungan ±10 markah. Boleh diperbaiki lagi." | FN-M08-5.4.6 |
| EL-M08-S15-059 | text | conditional | "404" | FN-M08-1.2.3 |
| EL-M08-S15-060 | text | conditional | "🔍" | FN-M08-1.2.3 |
| EL-M08-S15-061 | heading | conditional | "Halaman Tidak Dijumpai" | FN-M08-1.2.3 |
| EL-M08-S15-062 | text | conditional | "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?" | FN-M08-1.2.3 |
| EL-M08-S15-063 | link | conditional | "Halaman Utama", → / | FN-M08-1.2.3 |
| EL-M08-S15-064 | link | conditional | "Mula Latihan", → /latih-tubi | FN-M08-1.2.3 |
| EL-M08-S15-065 | text | conditional | "PRESTASIPLUS" | FN-M08-1.2.3 |
| EL-M08-S15-182 | text | conditional | "58.0% (C+)" | FN-M08-5.4.3 |
| EL-M08-S15-183 | text | conditional | "On Track" | FN-M08-5.4.3 |
| EL-M08-S15-184 | badge | conditional | "RS: 74.0% (A-)", fa-star | FN-M08-5.4.3 |
| EL-M08-S15-185 | text | conditional | "51.0% (C)" | FN-M08-5.4.3 |
| EL-M08-S15-186 | text | conditional | "74.0% (A-)" | FN-M08-5.4.3 |
| EL-M08-S15-187 | text | conditional | "74.0% (A-)" | FN-M08-5.4.3 |
| EL-M08-S15-188 | text | conditional | "74% (A-)" | FN-M08-5.4.3 |
| EL-M08-S15-189 | text | conditional | "74.0% (A-)" | FN-M08-5.4.6 |
| EL-M08-S15-190 | text | conditional | "74.0% (A-)" | FN-M08-5.4.6 |
| EL-M08-S15-191 | badge | conditional | "RS: 61.0% (B)", fa-star | FN-M08-5.4.3 |
| EL-M08-S15-192 | text | conditional | "70.2% (A-)" | FN-M08-5.4.3 |
| EL-M08-S15-193 | text | conditional | "61.0% (B)" | FN-M08-5.4.3 |
| EL-M08-S15-194 | text | conditional | "61.0% (B)" | FN-M08-5.4.3 |
| EL-M08-S15-195 | text | conditional | "61% (B)" | FN-M08-5.4.3 |
| EL-M08-S15-196 | text | conditional | "61.0% (B)" | FN-M08-5.4.6 |
| EL-M08-S15-197 | text | conditional | "61.0% (B)" | FN-M08-5.4.6 |
| EL-M08-S15-198 | badge | conditional | "RS: 56.4% (C+)", fa-star | FN-M08-5.4.3 |
| EL-M08-S15-199 | text | conditional | "67.0% (B+)" | FN-M08-5.4.3 |
| EL-M08-S15-200 | text | conditional | "56.0% (C+)" | FN-M08-5.4.3 |
| EL-M08-S15-201 | text | conditional | "56.4% (C+)" | FN-M08-5.4.3 |
| EL-M08-S15-202 | text | conditional | "56% (C+)" | FN-M08-5.4.3 |
| EL-M08-S15-203 | text | conditional | "Menurun", fa-arrow-down | FN-M08-5.4.3 |
| EL-M08-S15-204 | text | conditional | "56.0% (C+)" | FN-M08-5.4.6 |
| EL-M08-S15-205 | text | conditional | "56.4% (C+)" | FN-M08-5.4.6 |
| EL-M08-S15-206 | text | conditional | "+0.4 markah" | FN-M08-5.4.6 |
| EL-M08-S15-207 | text | conditional | "Ramalan Tepat" | FN-M08-5.4.6 |
| EL-M08-S15-208 | text | conditional | "Ramalan ETR sangat tepat — selisih dalam lingkungan ±5 markah." | FN-M08-5.4.6 |
| EL-M08-S15-209 | badge | conditional | "RS: 81.0% (A)", fa-star | FN-M08-5.4.3 |
| EL-M08-S15-210 | text | conditional | "72.0% (A-)" | FN-M08-5.4.3 |
| EL-M08-S15-211 | text | conditional | "81.0% (A)" | FN-M08-5.4.3 |
| EL-M08-S15-212 | text | conditional | "81.0% (A)" | FN-M08-5.4.3 |
| EL-M08-S15-213 | text | conditional | "81% (A)" | FN-M08-5.4.3 |
| EL-M08-S15-214 | text | conditional | "81.0% (A)" | FN-M08-5.4.6 |
| EL-M08-S15-215 | text | conditional | "81.0% (A)" | FN-M08-5.4.6 |
| EL-M08-S15-216 | badge | conditional | "RS: 68.0% (B+)", fa-star | FN-M08-5.4.3 |
| EL-M08-S15-217 | text | conditional | "68.0% (B+)" | FN-M08-5.4.3 |
| EL-M08-S15-218 | text | conditional | "68.0% (B+)" | FN-M08-5.4.3 |
| EL-M08-S15-219 | text | conditional | "68% (B+)" | FN-M08-5.4.3 |
| EL-M08-S15-220 | text | conditional | "68.0% (B+)" | FN-M08-5.4.6 |
| EL-M08-S15-221 | text | conditional | "68.0% (B+)" | FN-M08-5.4.6 |
| EL-M08-S15-222 | badge | conditional | "RS: 66.0% (B+)", fa-star | FN-M08-5.4.3 |
| EL-M08-S15-223 | text | conditional | "67.0% (B+)" | FN-M08-5.4.3 |
| EL-M08-S15-224 | text | conditional | "66.0% (B+)" | FN-M08-5.4.3 |
| EL-M08-S15-225 | text | conditional | "66.0% (B+)" | FN-M08-5.4.3 |
| EL-M08-S15-226 | text | conditional | "66% (B+)" | FN-M08-5.4.3 |
| EL-M08-S15-227 | text | conditional | "Stabil", fa-minus | FN-M08-5.4.3 |
| EL-M08-S15-228 | text | conditional | "66.0% (B+)" | FN-M08-5.4.6 |
| EL-M08-S15-229 | text | conditional | "66.0% (B+)" | FN-M08-5.4.6 |
| EL-M08-S15-230 | badge | conditional | "RS: 67.0% (B+)", fa-star | FN-M08-5.4.3 |
| EL-M08-S15-231 | text | conditional | "78.4% (A-)" | FN-M08-5.4.3 |
| EL-M08-S15-232 | text | conditional | "67.0% (B+)" | FN-M08-5.4.3 |
| EL-M08-S15-233 | text | conditional | "67.0% (B+)" | FN-M08-5.4.3 |
| EL-M08-S15-234 | text | conditional | "67% (B+)" | FN-M08-5.4.3 |
| EL-M08-S15-235 | text | conditional | "67.0% (B+)" | FN-M08-5.4.6 |
| EL-M08-S15-236 | text | conditional | "67.0% (B+)" | FN-M08-5.4.6 |
| EL-M08-S15-237 | badge | conditional | "RS: 35.1% (G)", fa-star | FN-M08-5.4.3 |
| EL-M08-S15-238 | text | conditional | "68.0% (B+)" | FN-M08-5.4.3 |
| EL-M08-S15-239 | text | conditional | "35.1% (G)" | FN-M08-5.4.3 |
| EL-M08-S15-240 | text | conditional | "Stabil", fa-minus | FN-M08-5.4.3 |
| EL-M08-S15-241 | text | conditional | "35.1% (G)" | FN-M08-5.4.6 |
| EL-M08-S15-242 | text | conditional | "-29.9 markah" | FN-M08-5.4.6 |
| EL-M08-S15-243 | text | conditional | "Selisih Besar" | FN-M08-5.4.6 |
| EL-M08-S15-244 | text | conditional | "Selisih melebihi 10 markah. Semak semula kaedah penetapan ETR." | FN-M08-5.4.6 |

#### S16 — `/timeline` (12 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M08-S16-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S16-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S16-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S16-004 | heading | visible-default | "📸 Timeline Saya" | FN-M08-6.1.1 |
| EL-M08-S16-005 | text | visible-default | "Kongsi sijil, pencapaian, aktiviti & cerita anda" | FN-M08-6.1.1 |
| EL-M08-S16-006 | link | visible-default | "Tambah Post", → /timeline/create, fa-plus | FN-M08-6.1.1 |
| EL-M08-S16-007 | heading | visible-default | "Timeline Kosong" | FN-M08-6.1.2 |
| EL-M08-S16-008 | text | visible-default | "Mula kongsi pencapaian, sijil, dan cerita anda untuk ditunjukkan pada profil awam anda!" | FN-M08-6.1.2 |
| EL-M08-S16-009 | link | visible-default | "Tambah Post Pertama", → /timeline/create, fa-plus | FN-M08-6.1.2 |
| EL-M08-S16-010 | text | visible-default | "Profil Awam Anda" | FN-M08-6.1.3 |
| EL-M08-S16-011 | link | visible-default | "https://prestasiplus.my/pelajar/3", → /pelajar/3 | FN-M08-6.1.3 |
| EL-M08-S16-012 | button | visible-default | fa-copy | FN-M08-6.1.3 |

#### S17 — `/timeline/create` (31 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M08-S17-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S17-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S17-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S17-004 | link | visible-default | "Kembali ke Timeline", → /timeline, fa-arrow-left | FN-M08-6.2.1 |
| EL-M08-S17-005 | card | visible-default | "📸 Post Baru" | FN-M08-6.2.1 |
| EL-M08-S17-006 | heading | visible-default | "📸 Post Baru" | FN-M08-6.2.1 |
| EL-M08-S17-007 | form | visible-default | — | FN-M08-6.2.2 |
| EL-M08-S17-008 | hidden-field | hidden-only | `name=_token` | FN-M08-6.2.2 |
| EL-M08-S17-009 | label | visible-default | "Tajuk *" | FN-M08-6.2.2 |
| EL-M08-S17-010 | input | visible-default | label "Tajuk *", `name=title`, required | FN-M08-6.2.2 |
| EL-M08-S17-011 | label | visible-default | "Kategori *" | FN-M08-6.2.2 |
| EL-M08-S17-012 | select | visible-default | label "Kategori *", `name=category`, 5 options, required | FN-M08-6.2.2 |
| EL-M08-S17-013 | label | visible-default | "Tarikh Acara" | FN-M08-6.2.2 |
| EL-M08-S17-014 | input | visible-default | label "Tarikh Acara", `name=event_date` | FN-M08-6.2.2 |
| EL-M08-S17-015 | label | visible-default | "Cerita / Keterangan" | FN-M08-6.2.2 |
| EL-M08-S17-016 | textarea | visible-default | label "Cerita / Keterangan", `name=story` | FN-M08-6.2.2 |
| EL-M08-S17-017 | text | visible-default | "Maks 2000 aksara" | FN-M08-6.2.2 |
| EL-M08-S17-018 | label | visible-default | "Gambar * (Maks 5 gambar, 2MB setiap satu)" | FN-M08-6.2.3 |
| EL-M08-S17-019 | input | hidden-only | label "Gambar * (Maks 5 gambar, 2MB setiap satu)", `name=photos[]` | FN-M08-6.2.3 |
| EL-M08-S17-020 | text | visible-default | "Klik atau seret gambar ke sini" | FN-M08-6.2.3 |
| EL-M08-S17-021 | text | visible-default | "JPG, PNG, WEBP • Maks 2MB • 1-5 gambar" | FN-M08-6.2.3 |
| EL-M08-S17-022 | link | visible-default | "Batal", → /timeline | FN-M08-6.2.4 |
| EL-M08-S17-023 | button | visible-default | "Terbitkan", fa-paper-plane | FN-M08-6.2.4 |
| EL-M08-S17-024 | input | hidden-only | `name=photos[]` | FN-M08-6.2.3 |
| EL-M08-S17-025 | image | conditional | — | FN-M08-6.2.3 |
| EL-M08-S17-026 | button | conditional | fa-times | FN-M08-6.2.3 |
| EL-M08-S17-027 | image | conditional | — | FN-M08-6.2.3 |
| EL-M08-S17-028 | button | conditional | fa-times | FN-M08-6.2.3 |
| EL-M08-S17-029 | text | conditional | "Keterangan Gambar (opsional)", fa-tag | FN-M08-6.2.3 |
| EL-M08-S17-030 | input | conditional | `name=captions[0]` | FN-M08-6.2.3 |
| EL-M08-S17-031 | input | conditional | `name=captions[1]` | FN-M08-6.2.3 |

#### S18 — `/pelajar/{id}` (65 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M08-S18-001 | link | visible-default | "PRESTASIPLUS", → /, fa-graduation-cap | FN-M08-6.3.1 |
| EL-M08-S18-002 | button | visible-default | "Kongsi", fa-share-alt | FN-M08-6.3.1 |
| EL-M08-S18-003 | link | visible-default | "Utama", → /, fa-home | FN-M08-6.3.1 |
| EL-M08-S18-004 | text | visible-default | "Pelajar PRESTASIPLUS", fa-graduation-cap | FN-M08-6.3.2 |
| EL-M08-S18-005 | text | visible-default | "334 hari bersama", fa-clock | FN-M08-6.3.2 |
| EL-M08-S18-006 | card | visible-default | "Admin Prestasiplus" | FN-M08-6.3.3 |
| EL-M08-S18-007 | image | visible-default | — | FN-M08-6.3.3 |
| EL-M08-S18-008 | badge | visible-default | "🥉" | FN-M08-6.3.3 |
| EL-M08-S18-009 | heading | visible-default | "Admin Prestasiplus" | FN-M08-6.3.3 |
| EL-M08-S18-010 | text | visible-default | "🥉 Bronze" | FN-M08-6.3.3 |
| EL-M08-S18-011 | text | visible-default | "Pelajar PRESTASIPLUS" | FN-M08-6.3.3 |
| EL-M08-S18-012 | badge | visible-default | "<school>", fa-school | FN-M08-6.3.3 |
| EL-M08-S18-013 | badge | visible-default | "Darjah 6", fa-layer-group | FN-M08-6.3.3 |
| EL-M08-S18-014 | badge | visible-default | "Ahli sejak 25 Oktober 2025", fa-calendar | FN-M08-6.3.3 |
| EL-M08-S18-015 | text | visible-default | "🪙" | FN-M08-6.3.3 |
| EL-M08-S18-016 | text | visible-default | "Syiling" | FN-M08-6.3.3 |
| EL-M08-S18-017 | text | visible-default | "103" | FN-M08-6.3.3 |
| EL-M08-S18-018 | card | visible-default | "🔥 0" | FN-M08-6.3.3 |
| EL-M08-S18-019 | text | visible-default | "0" | FN-M08-6.3.3 |
| EL-M08-S18-020 | text | visible-default | "🔥" | FN-M08-6.3.3 |
| EL-M08-S18-021 | text | visible-default | "Kombo" | FN-M08-6.3.3 |
| EL-M08-S18-022 | card | visible-default | "0%" | FN-M08-6.3.3 |
| EL-M08-S18-023 | text | visible-default | "0%" | FN-M08-6.3.3 |
| EL-M08-S18-024 | text | visible-default | "🎯 Tepat" | FN-M08-6.3.3 |
| EL-M08-S18-025 | card | visible-default | "Bronze" | FN-M08-6.3.4 |
| EL-M08-S18-026 | text | visible-default | "🥉" | FN-M08-6.3.4 |
| EL-M08-S18-027 | text | visible-default | "Bronze" | FN-M08-6.3.4 |
| EL-M08-S18-028 | text | visible-default | "Tahap 1" | FN-M08-6.3.4 |
| EL-M08-S18-029 | text | visible-default | "397 syiling lagi ke Silver" | FN-M08-6.3.4 |
| EL-M08-S18-030 | card | visible-default | "Ringkasan Aktiviti" | FN-M08-6.3.5 |
| EL-M08-S18-031 | heading | visible-default | "Ringkasan Aktiviti" | FN-M08-6.3.5 |
| EL-M08-S18-032 | text | visible-default | "0 sesi latihan" | FN-M08-6.3.5 |
| EL-M08-S18-033 | text | visible-default | "0 hari berlatih" | FN-M08-6.3.5 |
| EL-M08-S18-034 | text | visible-default | "0 jawapan betul" | FN-M08-6.3.5 |
| EL-M08-S18-035 | text | visible-default | "0 kombo terpanjang" | FN-M08-6.3.5 |
| EL-M08-S18-036 | card | visible-default | "103" | FN-M08-6.3.6 |
| EL-M08-S18-037 | text | visible-default | "🪙" | FN-M08-6.3.6 |
| EL-M08-S18-038 | text | visible-default | "103" | FN-M08-6.3.6 |
| EL-M08-S18-039 | text | visible-default | "Syiling" | FN-M08-6.3.6 |
| EL-M08-S18-040 | card | visible-default | "0" | FN-M08-6.3.6 |
| EL-M08-S18-041 | text | visible-default | "🔥" | FN-M08-6.3.6 |
| EL-M08-S18-042 | text | visible-default | "0" | FN-M08-6.3.6 |
| EL-M08-S18-043 | text | visible-default | "Kombo Hari" | FN-M08-6.3.6 |
| EL-M08-S18-044 | card | visible-default | "0" | FN-M08-6.3.6 |
| EL-M08-S18-045 | text | visible-default | "📚" | FN-M08-6.3.6 |
| EL-M08-S18-046 | text | visible-default | "0" | FN-M08-6.3.6 |
| EL-M08-S18-047 | text | visible-default | "Sesi Latihan" | FN-M08-6.3.6 |
| EL-M08-S18-048 | card | visible-default | "0%" | FN-M08-6.3.6 |
| EL-M08-S18-049 | text | visible-default | "🎯" | FN-M08-6.3.6 |
| EL-M08-S18-050 | text | visible-default | "0%" | FN-M08-6.3.6 |
| EL-M08-S18-051 | text | visible-default | "Ketepatan" | FN-M08-6.3.6 |
| EL-M08-S18-052 | heading | visible-default | "Ingin menyokong pelajar ini?" | FN-M08-6.3.7 |
| EL-M08-S18-053 | text | visible-default | "Jadilah penaja "Anak Angkat" dan bantu pelajar cemerlang!" | FN-M08-6.3.7 |
| EL-M08-S18-054 | link | visible-default | "Jadi Penaja", → /sponsor/register, fa-heart | FN-M08-6.3.7 |
| EL-M08-S18-055 | card | visible-default | "Teruskan usaha Admin!" | FN-M08-6.3.8 |
| EL-M08-S18-056 | text | visible-default | "Teruskan usaha Admin!" | FN-M08-6.3.8 |
| EL-M08-S18-057 | text | visible-default | "Setiap latihan membawa kejayaan ⭐" | FN-M08-6.3.8 |
| EL-M08-S18-058 | text | visible-default | "— Platform Latih Tubi Interaktif Malaysia", fa-graduation-cap | FN-M08-6.3.8 |
| EL-M08-S18-059 | link | visible-default | "PRESTASIPLUS", → /, fa-graduation-cap | FN-M08-6.3.8 |
| EL-M08-S18-060 | text | conditional | "🔍" | FN-M08-1.2.3 |
| EL-M08-S18-061 | heading | conditional | "Halaman Tidak Dijumpai" | FN-M08-1.2.3 |
| EL-M08-S18-062 | text | conditional | "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?" | FN-M08-1.2.3 |
| EL-M08-S18-063 | link | conditional | "Halaman Utama", → / | FN-M08-1.2.3 |
| EL-M08-S18-064 | link | conditional | "Mula Latihan", → /latih-tubi | FN-M08-1.2.3 |
| EL-M08-S18-065 | text | conditional | "PRESTASIPLUS" | FN-M08-1.2.3 |

#### S19 — `/ranking` (64 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M08-S19-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S19-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S19-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S19-004 | heading | visible-default | "Kedudukan" | FN-M08-7.1.1 |
| EL-M08-S19-005 | text | visible-default | "Nasional" | FN-M08-7.1.1 |
| EL-M08-S19-006 | link | visible-default | "Nasional", → /ranking?scope=nasional, fa-globe-asia | FN-M08-7.1.2 |
| EL-M08-S19-007 | link | visible-default | "Negeri", → /ranking?scope=negeri, fa-map-marked-alt | FN-M08-7.1.2 |
| EL-M08-S19-008 | link | visible-default | "Daerah", → /ranking?scope=daerah, fa-map-pin | FN-M08-7.1.2 |
| EL-M08-S19-009 | link | visible-default | "Sekolah", → /ranking?scope=sekolah, fa-school | FN-M08-7.1.2 |
| EL-M08-S19-010 | form | visible-default | — | FN-M08-7.1.3 |
| EL-M08-S19-011 | hidden-field | hidden-only | `name=scope` | FN-M08-7.1.3 |
| EL-M08-S19-012 | label | visible-default | "Subjek" | FN-M08-7.1.3 |
| EL-M08-S19-013 | select | visible-default | label "Subjek", `name=subject_id`, 32 options | FN-M08-7.1.3 |
| EL-M08-S19-014 | label | visible-default | "Tingkatan" | FN-M08-7.1.3 |
| EL-M08-S19-015 | select | visible-default | label "Tingkatan", `name=tingkatan`, 3 options | FN-M08-7.1.3 |
| EL-M08-S19-016 | label | visible-default | "Negeri" | FN-M08-7.1.3 |
| EL-M08-S19-017 | select | visible-default | label "Negeri", `name=negeri`, 2 options | FN-M08-7.1.3 |
| EL-M08-S19-018 | text | visible-default | "🏆" | FN-M08-7.1.4 |
| EL-M08-S19-019 | empty-state | visible-default | "Tiada data kedudukan" | FN-M08-7.1.4 |
| EL-M08-S19-020 | text | visible-default | "Mula menjawab soalan untuk muncul di papan kedudukan!" | FN-M08-7.1.4 |
| EL-M08-S19-021 | link | visible-default | "Mula Latihan", → /practice | FN-M08-7.1.4 |
| EL-M08-S19-022 | card | conditional | "# Pelajar Tahap Betul Tepat" | FN-M08-7.1.5 |
| EL-M08-S19-023 | text | conditional | "#" | FN-M08-7.1.5 |
| EL-M08-S19-024 | text | conditional | "Pelajar" | FN-M08-7.1.5 |
| EL-M08-S19-025 | text | conditional | "Tahap" | FN-M08-7.1.5 |
| EL-M08-S19-026 | text | conditional | "Betul" | FN-M08-7.1.5 |
| EL-M08-S19-027 | text | conditional | "Tepat" | FN-M08-7.1.5 |
| EL-M08-S19-028 | text | conditional | "🥇" | FN-M08-7.1.5 |
| EL-M08-S19-029 | text | conditional | "<masked>" | FN-M08-7.1.5 |
| EL-M08-S19-030 | text | conditional | "<school>" | FN-M08-7.1.5 |
| EL-M08-S19-031 | badge | conditional | "L8" | FN-M08-7.1.5 |
| EL-M08-S19-032 | text | conditional | "2,223" | FN-M08-7.1.5 |
| EL-M08-S19-033 | text | conditional | "93.48%" | FN-M08-7.1.5 |
| EL-M08-S19-034 | text | conditional | "🥈" | FN-M08-7.1.5 |
| EL-M08-S19-035 | text | conditional | "<masked>" | FN-M08-7.1.5 |
| EL-M08-S19-036 | text | conditional | "<school>" | FN-M08-7.1.5 |
| EL-M08-S19-037 | badge | conditional | "L10" | FN-M08-7.1.5 |
| EL-M08-S19-038 | text | conditional | "5,293" | FN-M08-7.1.5 |
| EL-M08-S19-039 | text | conditional | "83.79%" | FN-M08-7.1.5 |
| EL-M08-S19-040 | text | conditional | "🥉" | FN-M08-7.1.5 |
| EL-M08-S19-041 | text | conditional | "<masked>" | FN-M08-7.1.5 |
| EL-M08-S19-042 | text | conditional | "<school>" | FN-M08-7.1.5 |
| EL-M08-S19-043 | badge | conditional | "L10" | FN-M08-7.1.5 |
| EL-M08-S19-044 | text | conditional | "17,612" | FN-M08-7.1.5 |
| EL-M08-S19-045 | text | conditional | "89.94%" | FN-M08-7.1.5 |
| EL-M08-S19-046 | text | conditional | "Menunjukkan 3 dari 3 pelajar" | FN-M08-7.1.5 |
| EL-M08-S19-047 | text | conditional | "Selangor" | FN-M08-7.1.1 |
| EL-M08-S19-048 | link | conditional | "Nasional", → /ranking?negeri=Selangor&scope=nasional, fa-globe-asia | FN-M08-7.1.2 |
| EL-M08-S19-049 | link | conditional | "Negeri", → /ranking?negeri=Selangor&scope=negeri, fa-map-marked-alt | FN-M08-7.1.2 |
| EL-M08-S19-050 | link | conditional | "Daerah", → /ranking?negeri=Selangor&scope=daerah, fa-map-pin | FN-M08-7.1.2 |
| EL-M08-S19-051 | link | conditional | "Sekolah", → /ranking?negeri=Selangor&scope=sekolah, fa-school | FN-M08-7.1.2 |
| EL-M08-S19-052 | link | conditional | "Nasional", → /ranking?subject_id=3&scope=nasional, fa-globe-asia | FN-M08-7.1.2 |
| EL-M08-S19-053 | link | conditional | "Negeri", → /ranking?subject_id=3&scope=negeri, fa-map-marked-alt | FN-M08-7.1.2 |
| EL-M08-S19-054 | link | conditional | "Daerah", → /ranking?subject_id=3&scope=daerah, fa-map-pin | FN-M08-7.1.2 |
| EL-M08-S19-055 | link | conditional | "Sekolah", → /ranking?subject_id=3&scope=sekolah, fa-school | FN-M08-7.1.2 |
| EL-M08-S19-056 | badge | conditional | "L4" | FN-M08-7.1.5 |
| EL-M08-S19-057 | text | conditional | "48.85%" | FN-M08-7.1.5 |
| EL-M08-S19-058 | badge | conditional | "L7" | FN-M08-7.1.5 |
| EL-M08-S19-059 | text | conditional | "35.50%" | FN-M08-7.1.5 |
| EL-M08-S19-060 | text | conditional | "99.78%" | FN-M08-7.1.5 |
| EL-M08-S19-061 | link | conditional | "Nasional", → /ranking?tingkatan=T4&scope=nasional, fa-globe-asia | FN-M08-7.1.2 |
| EL-M08-S19-062 | link | conditional | "Negeri", → /ranking?tingkatan=T4&scope=negeri, fa-map-marked-alt | FN-M08-7.1.2 |
| EL-M08-S19-063 | link | conditional | "Daerah", → /ranking?tingkatan=T4&scope=daerah, fa-map-pin | FN-M08-7.1.2 |
| EL-M08-S19-064 | link | conditional | "Sekolah", → /ranking?tingkatan=T4&scope=sekolah, fa-school | FN-M08-7.1.2 |

#### S20 — `/leaderboard` (71 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M08-S20-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S20-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S20-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S20-004 | text | visible-default | "🏆" | FN-M08-7.2.1 |
| EL-M08-S20-005 | heading | visible-default | "Papan Pendahulu" | FN-M08-7.2.1 |
| EL-M08-S20-006 | text | visible-default | "Siapa juara minggu ini?" | FN-M08-7.2.1 |
| EL-M08-S20-007 | text | visible-default | "🏅" | FN-M08-7.2.1 |
| EL-M08-S20-008 | text | visible-default | "⭐" | FN-M08-7.2.1 |
| EL-M08-S20-009 | link | visible-default | "Semua Masa", → /leaderboard?period=all, fa-infinity | FN-M08-7.2.2 |
| EL-M08-S20-010 | link | visible-default | "Minggu Ini", → /leaderboard?period=week, fa-calendar-week | FN-M08-7.2.2 |
| EL-M08-S20-011 | link | visible-default | "Bulan Ini", → /leaderboard?period=month, fa-calendar-alt | FN-M08-7.2.2 |
| EL-M08-S20-012 | card | visible-default | "Kedudukan Anda" | FN-M08-7.2.3 |
| EL-M08-S20-013 | heading | visible-default | "Kedudukan Anda" | FN-M08-7.2.3 |
| EL-M08-S20-014 | text | visible-default | "#-" | FN-M08-7.2.3 |
| EL-M08-S20-015 | text | visible-default | "Ranking" | FN-M08-7.2.3 |
| EL-M08-S20-016 | text | visible-default | "0" | FN-M08-7.2.3 |
| EL-M08-S20-017 | text | visible-default | "Koin" | FN-M08-7.2.3 |
| EL-M08-S20-018 | text | visible-default | "0" | FN-M08-7.2.3 |
| EL-M08-S20-019 | text | visible-default | "Sesi" | FN-M08-7.2.3 |
| EL-M08-S20-020 | text | visible-default | "0%" | FN-M08-7.2.3 |
| EL-M08-S20-021 | text | visible-default | "Ketepatan" | FN-M08-7.2.3 |
| EL-M08-S20-022 | card | visible-default | "<masked>" | FN-M08-7.2.4 |
| EL-M08-S20-023 | image | visible-default | — | FN-M08-7.2.4 |
| EL-M08-S20-024 | text | visible-default | "<masked>" | FN-M08-7.2.4 |
| EL-M08-S20-025 | text | visible-default | "89% ketepatan" | FN-M08-7.2.4 |
| EL-M08-S20-026 | text | visible-default | "1,215", fa-coins | FN-M08-7.2.4 |
| EL-M08-S20-027 | badge | visible-default | "2" | FN-M08-7.2.4 |
| EL-M08-S20-028 | badge | visible-default | "👑" | FN-M08-7.2.4 |
| EL-M08-S20-029 | image | visible-default | — | FN-M08-7.2.4 |
| EL-M08-S20-030 | text | visible-default | "<masked>" | FN-M08-7.2.4 |
| EL-M08-S20-031 | text | visible-default | "98% ketepatan" | FN-M08-7.2.4 |
| EL-M08-S20-032 | text | visible-default | "1,547", fa-coins | FN-M08-7.2.4 |
| EL-M08-S20-033 | badge | visible-default | "1" | FN-M08-7.2.4 |
| EL-M08-S20-034 | image | visible-default | — | FN-M08-7.2.4 |
| EL-M08-S20-035 | text | visible-default | "<masked>" | FN-M08-7.2.4 |
| EL-M08-S20-036 | text | visible-default | "99% ketepatan" | FN-M08-7.2.4 |
| EL-M08-S20-037 | text | visible-default | "787", fa-coins | FN-M08-7.2.4 |
| EL-M08-S20-038 | badge | visible-default | "3" | FN-M08-7.2.4 |
| EL-M08-S20-039 | card | visible-default | "#" | FN-M08-7.2.5 |
| EL-M08-S20-040 | table | visible-default | columns: # · Pelajar · Koin · Sesi · Ketepatan | FN-M08-7.2.5 |
| EL-M08-S20-041 | badge | visible-default | "1" | FN-M08-7.2.5 |
| EL-M08-S20-042 | image | visible-default | — | FN-M08-7.2.5 |
| EL-M08-S20-043 | badge | visible-default | "98%" | FN-M08-7.2.5 |
| EL-M08-S20-044 | badge | visible-default | "2" | FN-M08-7.2.5 |
| EL-M08-S20-045 | image | visible-default | — | FN-M08-7.2.5 |
| EL-M08-S20-046 | badge | visible-default | "89%" | FN-M08-7.2.5 |
| EL-M08-S20-047 | badge | visible-default | "3" | FN-M08-7.2.5 |
| EL-M08-S20-048 | image | visible-default | — | FN-M08-7.2.5 |
| EL-M08-S20-049 | badge | visible-default | "99%" | FN-M08-7.2.5 |
| EL-M08-S20-050 | badge | visible-default | "4" | FN-M08-7.2.5 |
| EL-M08-S20-051 | image | visible-default | — | FN-M08-7.2.5 |
| EL-M08-S20-052 | badge | visible-default | "68%" | FN-M08-7.2.5 |
| EL-M08-S20-053 | badge | visible-default | "5" | FN-M08-7.2.5 |
| EL-M08-S20-054 | image | visible-default | — | FN-M08-7.2.5 |
| EL-M08-S20-055 | badge | visible-default | "100%" | FN-M08-7.2.5 |
| EL-M08-S20-056 | text | visible-default | "peserta bersaing", fa-users | FN-M08-7.2.6 |
| EL-M08-S20-057 | text | visible-default | "46" | FN-M08-7.2.6 |
| EL-M08-S20-058 | text | visible-default | "Dikemaskini real-time", fa-sync-alt | FN-M08-7.2.6 |
| EL-M08-S20-059 | text | conditional | "#1050" | FN-M08-7.2.3 |
| EL-M08-S20-060 | text | conditional | "22%" | FN-M08-7.2.3 |
| EL-M08-S20-061 | text | conditional | "101% ketepatan" | FN-M08-7.2.4 |
| EL-M08-S20-062 | text | conditional | "88% ketepatan" | FN-M08-7.2.4 |
| EL-M08-S20-063 | text | conditional | "93% ketepatan" | FN-M08-7.2.4 |
| EL-M08-S20-064 | badge | conditional | "88%" | FN-M08-7.2.5 |
| EL-M08-S20-065 | badge | conditional | "93%" | FN-M08-7.2.5 |
| EL-M08-S20-066 | badge | conditional | "84%" | FN-M08-7.2.5 |
| EL-M08-S20-067 | text | conditional | "94% ketepatan" | FN-M08-7.2.4 |
| EL-M08-S20-068 | text | conditional | "85% ketepatan" | FN-M08-7.2.4 |
| EL-M08-S20-069 | badge | conditional | "94%" | FN-M08-7.2.5 |
| EL-M08-S20-070 | badge | conditional | "85%" | FN-M08-7.2.5 |
| EL-M08-S20-071 | badge | conditional | "79%" | FN-M08-7.2.5 |

#### S21 — `/laporan-mingguan` (7 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M08-S21-001 | text | visible-default | "403" | FN-M08-8.1.1 |
| EL-M08-S21-002 | text | visible-default | "🚫" | FN-M08-8.1.1 |
| EL-M08-S21-003 | heading | visible-default | "Akses Ditolak" | FN-M08-8.1.1 |
| EL-M08-S21-004 | text | visible-default | "Anda tidak mempunyai kebenaran untuk mengakses halaman ini. Sila log masuk dengan akaun yang betul atau hubung…" | FN-M08-8.1.1 |
| EL-M08-S21-005 | link | visible-default | "Halaman Utama", → / | FN-M08-8.1.1 |
| EL-M08-S21-006 | link | visible-default | "Log Masuk", → /login | FN-M08-8.1.1 |
| EL-M08-S21-007 | text | visible-default | "PRESTASIPLUS" | FN-M08-8.1.1 |

#### S22 — `/headcount/{id}/summary` (46 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M08-S22-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S22-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S22-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S22-004 | link | visible-default | → /headcount/213, fa-arrow-left | FN-M08-5.5.1 |
| EL-M08-S22-005 | heading | visible-default | "Ringkasan Kelas" | FN-M08-5.5.1 |
| EL-M08-S22-006 | text | visible-default | "Sejarah · 4 Simulasi · Tingkatan 4 · 2026" | FN-M08-5.5.1 |
| EL-M08-S22-007 | card | visible-default | "15" | FN-M08-5.5.2 |
| EL-M08-S22-008 | text | visible-default | "15" | FN-M08-5.5.2 |
| EL-M08-S22-009 | text | visible-default | "Jumlah Murid" | FN-M08-5.5.2 |
| EL-M08-S22-010 | card | visible-default | "62.1" | FN-M08-5.5.2 |
| EL-M08-S22-011 | text | visible-default | "62.1" | FN-M08-5.5.2 |
| EL-M08-S22-012 | text | visible-default | "Purata TOV (%)" | FN-M08-5.5.2 |
| EL-M08-S22-013 | card | visible-default | "71.9" | FN-M08-5.5.2 |
| EL-M08-S22-014 | text | visible-default | "71.9" | FN-M08-5.5.2 |
| EL-M08-S22-015 | text | visible-default | "Purata ETR (%)" | FN-M08-5.5.2 |
| EL-M08-S22-016 | card | visible-default | "3" | FN-M08-5.5.2 |
| EL-M08-S22-017 | text | visible-default | "3" | FN-M08-5.5.2 |
| EL-M08-S22-018 | text | visible-default | "OTR Aktif" | FN-M08-5.5.2 |
| EL-M08-S22-019 | card | visible-default | "Taburan Prestasi Per OTR" | FN-M08-5.5.3 |
| EL-M08-S22-020 | heading | visible-default | "Taburan Prestasi Per OTR" | FN-M08-5.5.3 |
| EL-M08-S22-021 | heading | visible-default | "OTR1" | FN-M08-5.5.3 |
| EL-M08-S22-022 | text | visible-default | "Above: 0", fa-arrow-up | FN-M08-5.5.3 |
| EL-M08-S22-023 | text | visible-default | "On Track: 0", fa-check | FN-M08-5.5.3 |
| EL-M08-S22-024 | text | visible-default | "Below: 0", fa-arrow-down | FN-M08-5.5.3 |
| EL-M08-S22-025 | text | visible-default | "N/A: 15" | FN-M08-5.5.3 |
| EL-M08-S22-026 | tooltip | visible-default | "N/A: 15" | FN-M08-5.5.3 |
| EL-M08-S22-027 | heading | visible-default | "OTR2" | FN-M08-5.5.3 |
| EL-M08-S22-028 | text | visible-default | "Above: 0", fa-arrow-up | FN-M08-5.5.3 |
| EL-M08-S22-029 | text | visible-default | "On Track: 0", fa-check | FN-M08-5.5.3 |
| EL-M08-S22-030 | text | visible-default | "Below: 0", fa-arrow-down | FN-M08-5.5.3 |
| EL-M08-S22-031 | text | visible-default | "N/A: 15" | FN-M08-5.5.3 |
| EL-M08-S22-032 | tooltip | visible-default | "N/A: 15" | FN-M08-5.5.3 |
| EL-M08-S22-033 | heading | visible-default | "OTR3" | FN-M08-5.5.3 |
| EL-M08-S22-034 | text | visible-default | "Above: 5", fa-arrow-up | FN-M08-5.5.3 |
| EL-M08-S22-035 | text | visible-default | "On Track: 2", fa-check | FN-M08-5.5.3 |
| EL-M08-S22-036 | text | visible-default | "Below: 8", fa-arrow-down | FN-M08-5.5.3 |
| EL-M08-S22-037 | text | visible-default | "N/A: 0" | FN-M08-5.5.3 |
| EL-M08-S22-038 | tooltip | visible-default | "Above: 5" | FN-M08-5.5.3 |
| EL-M08-S22-039 | tooltip | visible-default | "On Track: 2" | FN-M08-5.5.3 |
| EL-M08-S22-040 | tooltip | visible-default | "Below: 8" | FN-M08-5.5.3 |
| EL-M08-S22-041 | text | visible-default | "Above Target" | FN-M08-5.5.4 |
| EL-M08-S22-042 | text | visible-default | "On Track (±2%)" | FN-M08-5.5.4 |
| EL-M08-S22-043 | text | visible-default | "Below Target" | FN-M08-5.5.4 |
| EL-M08-S22-044 | text | visible-default | "Belum Diisi" | FN-M08-5.5.4 |
| EL-M08-S22-045 | link | visible-default | "Lihat Table Penuh", → /headcount/213, fa-table | FN-M08-5.5.5 |
| EL-M08-S22-046 | link | visible-default | "Export CSV", → /headcount/213/export, fa-download | FN-M08-5.5.5 |

#### S23 — `/headcount/{id}` (62 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M08-S23-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S23-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S23-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M08-S23-004 | link | visible-default | → /headcount, fa-arrow-left | FN-M08-5.6.1 |
| EL-M08-S23-005 | heading | visible-default | "Sejarah" | FN-M08-5.6.1 |
| EL-M08-S23-006 | text | visible-default | "4 Simulasi · Tingkatan 4 · 2026 · Guru: <person>" | FN-M08-5.6.1 |
| EL-M08-S23-007 | text | visible-default | "Active" | FN-M08-5.6.1 |
| EL-M08-S23-008 | alert | visible-default | "On Track: 6 (40%)", fa-check-circle | FN-M08-5.6.2 |
| EL-M08-S23-009 | alert | visible-default | "Below: 9 (60%)", fa-arrow-down | FN-M08-5.6.2 |
| EL-M08-S23-010 | text | visible-default | "Belum Diisi: 0", fa-minus-circle | FN-M08-5.6.2 |
| EL-M08-S23-011 | alert | visible-default | "Jumlah: 15", fa-users | FN-M08-5.6.2 |
| EL-M08-S23-012 | dropdown-trigger | visible-default | "Key-in AR", fa-pen | FN-M08-5.6.3 |
| EL-M08-S23-013 | link | conditional | "OTR1", → /headcount/213/results/1 | FN-M08-5.6.3 |
| EL-M08-S23-014 | link | conditional | "OTR2", → /headcount/213/results/2 | FN-M08-5.6.3 |
| EL-M08-S23-015 | link | conditional | "OTR3", → /headcount/213/results/3 | FN-M08-5.6.3 |
| EL-M08-S23-016 | link | visible-default | "Edit TOV/ETR", → /headcount/213/edit, fa-edit | FN-M08-5.6.3 |
| EL-M08-S23-017 | link | visible-default | "Export CSV", → /headcount/213/export, fa-download | FN-M08-5.6.3 |
| EL-M08-S23-018 | link | visible-default | "Ringkasan Kelas", → /headcount/213/summary, fa-chart-bar | FN-M08-5.6.3 |
| EL-M08-S23-019 | link | visible-default | "Unjuran", → /headcount/213/unjuran, fa-arrow-trend-up | FN-M08-5.6.3 |
| EL-M08-S23-020 | link | visible-default | "Tetapan", → /headcount/213/settings, fa-cog | FN-M08-5.6.3 |
| EL-M08-S23-021 | button | visible-default | "Reset Data", fa-rotate-left | FN-M08-5.6.4 |
| EL-M08-S23-022 | button | visible-default | "Padam", fa-trash | FN-M08-5.6.5 |
| EL-M08-S23-023 | modal | conditional | "Reset Semua Data?" | FN-M08-5.6.4 |
| EL-M08-S23-024 | clickable | conditional | — | FN-M08-5.6.4 |
| EL-M08-S23-025 | clickable | conditional | "Reset Semua Data? Semua markah murid akan dikosongkan — TOV, ETR, OTR, AR & RS. Yang kekal selamat: Senarai mu…", fa-rotate-left | FN-M08-5.6.4 |
| EL-M08-S23-026 | heading | conditional | "Reset Semua Data?" | FN-M08-5.6.4 |
| EL-M08-S23-027 | button | conditional | "Batal" | FN-M08-5.6.4 |
| EL-M08-S23-028 | form | conditional | — | FN-M08-5.6.4 |
| EL-M08-S23-029 | hidden-field | hidden-only | `name=_token` | FN-M08-5.6.4 |
| EL-M08-S23-030 | button | conditional | "Ya, Reset", fa-rotate-left | FN-M08-5.6.4 |
| EL-M08-S23-031 | modal | conditional | "Padam Headcount?" | FN-M08-5.6.5 |
| EL-M08-S23-032 | clickable | conditional | — | FN-M08-5.6.5 |
| EL-M08-S23-033 | clickable | conditional | "Padam Headcount? Anda pasti mahu padam headcount Sejarah (4 Simulasi, 2026)? Semua data murid, TOV, ETR, OTR, …", fa-exclamation-triangle | FN-M08-5.6.5 |
| EL-M08-S23-034 | heading | conditional | "Padam Headcount?" | FN-M08-5.6.5 |
| EL-M08-S23-035 | button | conditional | "Batal" | FN-M08-5.6.5 |
| EL-M08-S23-036 | form | conditional | — | FN-M08-5.6.5 |
| EL-M08-S23-037 | hidden-field | hidden-only | `name=_token` | FN-M08-5.6.5 |
| EL-M08-S23-038 | hidden-field | hidden-only | `name=_method` | FN-M08-5.6.5 |
| EL-M08-S23-039 | button | conditional | "Ya, Padam", fa-trash | FN-M08-5.6.5 |
| EL-M08-S23-040 | text | visible-default | "Susun:", fa-sort | FN-M08-5.6.6 |
| EL-M08-S23-041 | filter | visible-default | "Ranking", → /headcount/213?sort=ranking, fa-trophy | FN-M08-5.6.6 |
| EL-M08-S23-042 | filter | visible-default | "A-Z", → /headcount/213?sort=name, fa-sort-alpha-down | FN-M08-5.6.6 |
| EL-M08-S23-043 | card | visible-default | "0 murid dipilih" | FN-M08-5.6.8 |
| EL-M08-S23-044 | text | conditional | "murid dipilih", fa-check-square | FN-M08-5.6.8 |
| EL-M08-S23-045 | text | conditional | "1" | FN-M08-5.6.8 |
| EL-M08-S23-046 | form | hidden-only | — | FN-M08-5.6.8 |
| EL-M08-S23-047 | hidden-field | hidden-only | `name=_token` | FN-M08-5.6.8 |
| EL-M08-S23-048 | hidden-field | hidden-only | `name=action` | FN-M08-5.6.8 |
| EL-M08-S23-049 | hidden-field | hidden-only | `name=student_ids[]` | FN-M08-5.6.8 |
| EL-M08-S23-050 | button | conditional | "Gugurkan", fa-user-slash | FN-M08-5.6.8 |
| EL-M08-S23-051 | button | conditional | "Kembalikan", fa-user-check | FN-M08-5.6.8 |
| EL-M08-S23-052 | button | conditional | "Batal", fa-times | FN-M08-5.6.8 |
| EL-M08-S23-053 | table | visible-default | columns:  · # · Nama · TOV · OTR1 · AR1 · OTR2 · AR2 · OTR3 · AR3 · ETR ·  ·  ·  · % · Gred · % · Gred · % · Gred · % · Gred · % · Gred · % · Gred · % · Gred · % · Gred | FN-M08-5.6.7 |
| EL-M08-S23-054 | checkbox | visible-default | — | FN-M08-5.6.7 |
| EL-M08-S23-055 | checkbox | visible-default | — | FN-M08-5.6.7 |
| EL-M08-S23-056 | link | visible-default | "<name>", → /headcount/student/{id} | FN-M08-5.6.7 |
| EL-M08-S23-057 | checkbox | visible-default | — | FN-M08-5.6.7 |
| EL-M08-S23-058 | link | visible-default | "<name>", → /headcount/student/{id} | FN-M08-5.6.7 |
| EL-M08-S23-059 | checkbox | visible-default | — | FN-M08-5.6.7 |
| EL-M08-S23-060 | link | visible-default | "<name>", → /headcount/student/{id} | FN-M08-5.6.7 |
| EL-M08-S23-061 | card | conditional | "1 murid dipilih" | FN-M08-5.6.8 |
| EL-M08-S23-062 | hidden-field | hidden-only | `name=student_ids[]` | FN-M08-5.6.8 |

### 6.2 Shell elements (M08-relevant only)

#### SHU — user-portal shell (chrome of S1–S17, S19, S20, S22, S23) — 401 elements, 46 M08-relevant

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M08-SHU-011 | link | visible-default | "Headcount", → /headcount, fa-chart-line | FN-M08-1.1.1 |
| EL-M08-SHU-012 | link | visible-default | "Prestasi", → /prestasi, fa-chart-bar | FN-M08-1.1.1 |
| EL-M08-SHU-013 | link | visible-default | "Analitik Adaptif", → /analitik/pelajar, fa-brain | FN-M08-1.1.1 |
| EL-M08-SHU-014 | link | visible-default | "Analisa Item", → /analisa-item, fa-magnifying-glass-chart | FN-M08-1.1.1 |
| EL-M08-SHU-016 | link | visible-default | "Laporan Mingguan", → /laporan-mingguan, fa-file-lines | FN-M08-1.1.1 |
| EL-M08-SHU-065 | link | visible-default | "Kedudukan", → /ranking, fa-trophy | FN-M08-1.1.1 |
| EL-M08-SHU-098 | link | visible-default | "Timeline Saya", → /timeline, fa-camera | FN-M08-1.1.1 |
| EL-M08-SHU-136 | heading | visible-default | "Dashboard" | FN-M08-1.1.3 |
| EL-M08-SHU-137 | text | visible-default | "Selamat datang kembali" | FN-M08-1.1.3 |
| EL-M08-SHU-175 | link | hidden-only | "Headcount", → /headcount, fa-chart-line | FN-M08-1.1.2 |
| EL-M08-SHU-176 | link | hidden-only | "Prestasi", → /prestasi, fa-chart-bar | FN-M08-1.1.2 |
| EL-M08-SHU-177 | link | hidden-only | "Analisa Item", → /analisa-item, fa-magnifying-glass-chart | FN-M08-1.1.2 |
| EL-M08-SHU-185 | link | hidden-only | "Laporan Mingguan", → /laporan-mingguan, fa-file-lines | FN-M08-1.1.2 |
| EL-M08-SHU-206 | link | hidden-only | "Kedudukan", → /ranking, fa-trophy | FN-M08-1.1.2 |
| EL-M08-SHU-261 | link | hidden-only | "Headcount", → /headcount, fa-chart-line | FN-M08-1.1.2 |
| EL-M08-SHU-262 | link | hidden-only | "Prestasi", → /prestasi/kelas, fa-chart-bar | FN-M08-1.1.2 |
| EL-M08-SHU-305 | link | hidden-only | "Timeline Saya", → /timeline, fa-camera | FN-M08-1.1.2 |
| EL-M08-SHU-373 | heading | conditional | "Dashboard Tingkatan" | FN-M08-1.1.3 |
| EL-M08-SHU-374 | text | conditional | "Pilih tingkatan untuk lihat prestasi keseluruhan" | FN-M08-1.1.3 |
| EL-M08-SHU-375 | heading | conditional | "Tingkatan 4" | FN-M08-1.1.3 |
| EL-M08-SHU-376 | text | conditional | "Dashboard Prestasi Tingkatan" | FN-M08-1.1.3 |
| EL-M08-SHU-377 | heading | conditional | "Tingkatan 5" | FN-M08-1.1.3 |
| EL-M08-SHU-378 | heading | conditional | "Prestasi Kelas" | FN-M08-1.1.3 |
| EL-M08-SHU-379 | text | conditional | "Pilih kelas untuk lihat prestasi keseluruhan" | FN-M08-1.1.3 |
| EL-M08-SHU-400 | heading | conditional | "4 Simulasi" | FN-M08-1.1.3 |
| EL-M08-SHU-401 | text | conditional | "<school> · 2026" | FN-M08-1.1.3 |
| EL-M08-SHU-380 | heading | conditional | "4 Bestari - BM" | FN-M08-1.1.3 |
| EL-M08-SHU-381 | text | conditional | "<school> · Bahasa Melayu · 2026" | FN-M08-1.1.3 |
| EL-M08-SHU-382 | heading | conditional | "ALFA - Bahasa Inggeris" | FN-M08-1.1.3 |
| EL-M08-SHU-383 | text | conditional | "<school> · Bahasa Inggeris · 2026" | FN-M08-1.1.3 |
| EL-M08-SHU-384 | heading | conditional | "Analitik Pembelajaran" | FN-M08-1.1.3 |
| EL-M08-SHU-385 | text | conditional | "Pantau prestasi dan kenal pasti topik yang perlu diperkukuhkan" | FN-M08-1.1.3 |
| EL-M08-SHU-386 | heading | conditional | "Analitik Kelas" | FN-M08-1.1.3 |
| EL-M08-SHU-387 | text | conditional | "Pantau prestasi pelajar dan kenal pasti yang memerlukan perhatian" | FN-M08-1.1.3 |
| EL-M08-SHU-388 | heading | conditional | "Analisa Item — Sekolah" | FN-M08-1.1.3 |
| EL-M08-SHU-389 | text | conditional | "<school>" | FN-M08-1.1.3 |
| EL-M08-SHU-390 | text | conditional | "<school> — Tingkatan 4" | FN-M08-1.1.3 |
| EL-M08-SHU-391 | text | conditional | "<school> — Tingkatan 5" | FN-M08-1.1.3 |
| EL-M08-SHU-392 | heading | conditional | "Analisa Item" | FN-M08-1.1.3 |
| EL-M08-SHU-393 | text | conditional | "Analisis tahap kesukaran dan diskriminasi soalan mengikut kelas" | FN-M08-1.1.3 |
| EL-M08-SHU-394 | heading | conditional | "Timeline Saya" | FN-M08-1.1.3 |
| EL-M08-SHU-395 | text | conditional | "Kongsi pencapaian & cerita anda" | FN-M08-1.1.3 |
| EL-M08-SHU-396 | heading | conditional | "Tambah Post" | FN-M08-1.1.3 |
| EL-M08-SHU-397 | text | conditional | "Kongsi pencapaian atau cerita baru" | FN-M08-1.1.3 |
| EL-M08-SHU-398 | heading | conditional | "Papan Pendahulu" | FN-M08-1.1.3 |
| EL-M08-SHU-399 | text | conditional | "Siapa juara minggu ini?" | FN-M08-1.1.3 |

Excluded SHU elements (prefix EL-M08-SHU-): 355 elements — IDs 001–010, 015, 017–064, 066–097, 099–135, 138–174, 178–184, 186–205, 207–260, 263–304, 306–372: **global shell (docs/discovery/00-global-ui.md) / M23 and the module each link targets (per URL in `_crawl.json`)**. IDs 001–003 are the shell logo/brand (→ /dashboard, logo image, "Platform Latih Tubi Nasional"): global shell, not the M16 banner. The dashboard quick action "🏅 Papan Pendahulu" → `/leaderboard` is M05 content (M05 inventory), not shell.

**Coverage result: 1553/1553 covered, 0 unmapped.**

---

## 7. Fidelity deviations

These are the **only** intended differences from the live site. Anything not listed must match live (D7). Rule D9 (user, standing, pre-approved): where live is broken or contradictory, fix it minimally; where it works, replicate it exactly. D10: accessibility replicates live; a deliberate, consistent limit is not broken; adding options to a working feature is new scope. CLAUDE.md §6: minimal fixes that create no new contradiction on the same screen; D11: every figure is computed from the dataset under its own definition. Rows "Rejected — replicate live" were candidates that turned out to work or could not be shown to be broken; "Withdrawn" rows were decided otherwise after the audit.

| ID | Discovery | Category | Live behaviour (evidence) | Rebuild behaviour (specified) and alternatives | Status |
|---|---|---|---|---|---|
| DV-M08-01 | D-1 | Wrong titles | S1, S6, S12, S13, S14, S15, S19, S22 and S23 show the fallback header "Dashboard" / "Selamat datang kembali" (EL-M08-SHU-136/137), while the other M08 screens show their own title. | **Titles only:** S1 "Dashboard Sekolah", S6 "Prestasi 360", S12 "Headcount", S13 "Dashboard Headcount", S14 "Buat Headcount Baru", S15 "Headcount — Prestasi Individu", S19 "Kedudukan", S22 "Ringkasan Kelas", S23 "Headcount {Subjek}" (each from the page's own tab title or heading; PROPOSED); subtitle "Selamat datang kembali" kept. | Approved (D9) |
| DV-M08-02 | D-2 (part), L-2 | Dead link | Sidebar/drawer "Analisa Item" → `/analisa-item` → 302 `/dashboard` for the admin, no message (OBSERVED); S10 is then reachable only by URL. The route's behaviour for other roles is not observable. | **Admin:** `/analisa-item` → `/analisa-item/kelas`. Teacher → `/analisa-item/kelas` and other roles → `/dashboard` are INFERRED (provisional, L-2), not live-derived. Alternatives: (a) replicate the admin dead end — rejected; (b) hide the item for the admin — rejected, leaves S10 unreachable; (c) build an unknown student view — rejected. | Approved (D9) for the admin |
| DV-M08-03 | D-2 (part), L-1 | Withdrawn | Sidebar/drawer "Laporan Mingguan" → 403 for the admin (OBSERVED); other roles not observed (probably permitted). | **Withdrawn (AUD-M08-03):** the item stays as live for every role; the admin gets the observed 403; the page for pelajar, ibu bapa and guru is blocked pending a test account (OQ-M08-01) — the prototype's temporary stand-in is not asserted. | Withdrawn — replicate live |
| DV-M08-04 | D-3, L-3 | Dead link | S8 row name link and "Lihat Analitik" → `/analitik/kelas/pelajar/{id}` → 403 for the admin (OBSERVED); the page itself and the teacher outcome are not observable. | **Admin:** both links open `/prestasi/{userId}` (S6). For a teacher the live target may work (L-3); the rebuild uses the same target because the target page cannot be built — INFERRED, provisional, OQ-M08-10. Alternatives: build the unknown page — rejected; remove the links — rejected; keep the 403 — rejected for the admin. | Approved (D9) for the admin |
| DV-M08-05 | D-7 | Contradictory counts | S1 level cards: T4 "11 kelas · 148 murid · 10 sesi · 63.9%", T5 "560 · 3467 · 25716 · 79.8%"; clicking them opens S2/S3 with T4 "13 / 149" and T5 "645 / 3911 / 29,971 / 79.7%". | S1 level cards read the same level aggregate as S2/S3 (D11: one dataset, one definition): T4 13 / 149 / 11 (DV-M08-28) / 63.9%, T5 645 / 3911 / 29971 / 79.7%. S1 header totals, stat cards and S2/S3 stay as live. Alternatives: change S2/S3 — rejected (more live values); replicate — rejected (click-through contradiction). | Approved (D9) |
| DV-M08-06 | D-4 | Dead link | S3 "Lihat →" on the "Kelas Sekolah" rows → `/prestasi/kelas/sc-419` and `sc-806` → 404. | These rows have an empty Aksi cell (no link). Alternatives: build a school-class dashboard — rejected; keep the 404 link — rejected. | Approved (D9) |
| DV-M08-07 | D-8 | Contradictory value | Accuracy above 100%: S3 Murid Terbaik 126.7% … 103.1%, S5 class 228 first row 125%, S20 podium "101% ketepatan". | Every accuracy shown in M08 is `min(value, 100)`; rows keep their live order (S3 Murid Terbaik: session means of 100.0 %, ties by user id ascending in the live order — v1.10, R4-01). Alternatives: recompute — impossible for the observed rows; hide rows — rejected. | Approved (D9) |
| DV-M08-08 | D-5 | Broken link | S3 "Murid Berisiko" rows link to `/prestasi?{id}`, which lands on S1. | Rows link to `/prestasi/{userId}` (the same student, verified by the audit). | Approved (D9) |
| DV-M08-09 | D-24 (withdrawn) | Withdrawn | With an RS value the S15 chart labels include "RS" and the "RS (SPM Sebenar)" star point renders (top-up §2.22.4; audit AUD-M08-02). | **Withdrawn:** replicated as live (FN-M08-5.4.4). | Withdrawn — replicate live |
| DV-M08-10 | D-9 | Responsive breakage | At 375px the page scrolls sideways: S7 418px (DSKP legend), S20 385px (podium); S6 392px when a headcount chip row is long. | S6 chip rows and the S7 legend wrap below 640px; the S20 podium columns shrink (names truncate) so the page fits 375px. | Approved (D9) |
| DV-M08-11 | D-16 | Contradictory | S13 "Jumlah Murid" is server-rendered and ignores the level filter, while the other three cards follow it (SOURCE-DERIVED). | "Jumlah Murid" = Σ students of the filtered configs. | Approved (D9) |
| DV-M08-12 | D-22 | Contradictory (same screen) | S1 GPS 3.45 has the pill "Sederhana" (blue), while the chart on the same page labels ≤4 "Baik" (blue). | The pill uses the chart's band rule (≤2 "Cemerlang", ≤4 "Baik", ≤6 "Sederhana", else "Perlu Perhatian"): 3.45 → "Baik" (blue unchanged). | Approved (D9) |
| DV-M08-13 | D-12 (ring) | Contradictory (same pane) | S7 Sejarah ring "8 / 2 SP" with dasharray "1256 -942" (numerator > denominator). The BM ring "3 / 3 SP" with a full arc is consistent with its own definition (map SP count) and is not a defect. | **Only when mahir > the map SP count** the denominator becomes mahir + sederhana + lemah + belum (SEJ "8 / 23 SP"); otherwise live (e.g. "3 / 3 SP"). Alternatives: (a) legend totals on every ring (v1.0) — rejected, changes the consistent BM ring (AUD-14); (b) clamp the ratio at 1 and keep "8 / 2" — rejected, the text still contradicts itself; (c) numerator = mastered map tiles (0 / 2) — rejected, contradicts the legend. The "/ 23 SP" wording beside a map of 2 tiles is recorded as PROPOSED for G1. The map is replicated (the viewer's own level). | Approved (D9), narrowed |
| DV-M08-14 | D-11 | Wrong label | S7 "Latihan Fokus (50 soalan)" starts `count=25` (6 of 34 labels differ from their link); S6 already shows the capped value. | The S7 label uses the capped count "min(n, 25)". | Approved (D9) |
| DV-M08-15 | D-13 | Withdrawn | S8 "Kelas" has 0 options for the admin, by the same own-class rule as S5 "Tukar Kelas..." and S14 "Pilih Kelas". | **Withdrawn (AUD-M08-04, D10):** own classes only; the admin's select is empty, as live. | Withdrawn — replicate live |
| DV-M08-16 | D-14 | Unreadable | Grade ranges joined with "-": "A--A+", "C-A-", "D-A-" (S8); S7 uses the same format ("G-C"). | Ranges shown as "{low} – {high}" on S7 and S8. Alternative: S8 only — rejected (same data type on S7). | Approved (D9) |
| DV-M08-17 | D-15 | Broken control | S11 search and sort have no effect (596 rows unchanged). | Search filters rows by question text (case-insensitive); the sort select orders by its five options; no match → no rows, no message. | Approved (D9) |
| DV-M08-18 | D-25, D-26 | Unreadable text | 10px text on the S12 hero at 375px, 11px/10px on S7, 10–11px S18 mini labels. | No text inside M08 page content below 12px at any width (M03 DV-06b / M05 DV-11 precedent); icons keep their size. | Approved (D9) |
| DV-M08-19 | D-6 | Dead link | S16 "Profil Awam Anda" shows and copies `/pelajar/3` → 404; the admin's own profile is `/pelajar/1`. | The link and the copy button use the viewer's own id. | Approved (D9) |
| DV-M08-20 | D-10 | Candidate | S6 shows 0 sessions for the admin while M05 shows 119 answered; the admin's sessions are SPM sessions and S6 counts practice-mode sessions (`random`, `chapter`, `revision`, and from M05 v1.12 `mission`, `remedial`, `question_set`) (INFERRED). | **Replicated.** | Rejected — replicate live |
| DV-M08-21 | D-17 (revised) | Visual bug (narrowed) | S15 "Belum Ada Data" means no OTR target (correct). The Gred AR pill is green when AR ≥ target and red when below (correct) **and red when there is no target** (top-up §2.22.4). S6 says "Below" / "—" where S15 says "Below Target" / "Belum Ada Data" (wording only). | **Only the no-target pill changes:** slate (`bg-slate-100 text-slate-500`, as the section's "Belum Ada Data" pill) instead of red; green/red kept. Status copy and the S6 wording replicated. Alternatives: replicate red — rejected (a red "below" signal where nothing is compared); hide the pill — rejected (removes the grade). | Approved (D9), narrowed |
| DV-M08-22 | D-19 | Wrong label | S19 subtitle and tab title read "Nasional" on every scope except negeri with `negeri` set ("Selangor"); `?scope=daerah&negeri=Selangor` still reads "Nasional" (audit AUD-09). | "Kedudukan {x}": x = the negeri name on the negeri scope when set, else the active scope's pill label ("Nasional", "Negeri", "Daerah", "Sekolah"; existing copy); daerah + negeri → "Daerah". Unknown scope → "Nasional". | Approved (D9) |
| DV-M08-23 | D-20 | Candidate | Daerah scope shows the "Negeri" select and no district select; the daerah view with data was never observed (L-11). | **Replicated**; a district select would be new scope (D10). | Rejected — replicate live |
| DV-M08-24 | new (probe) | Broken page | GET `/timeline/{id}` returns the English framework page "An Error Occurred: Method Not Allowed" (405); nothing links to it. | The global 404 page. | Approved (D9) |
| DV-M08-25 | D-18, Q4 | Contradictory values | Coin figures for the admin: header 256, S18 syiling 103, S6 Koin 342,703, S20 26. | **Resolved by M14 (DV-M14-08 / DV-M14-09, applied in v1.8, XL3-06):** S6 "Koin" and S18 syiling = M14 `currentSyiling` 256 (S18 "244 syiling lagi ke Silver"); S18 Kombo / kombo terpanjang = M14 streak 1 / 5; S20 "Koin" 26 stays BR-M08-28 (a period sum of session coins, not a balance). | Approved (D9, M14) |
| DV-M08-26 | D-21 | Candidate | Ranking order ascending by Betul in three data states (all, Matematik, BM). | **Replicated** (INFERRED rule; OQ-M08-09). | Rejected — replicate live |
| DV-M08-27 | D-23 | Candidate | Trend chart plots 2026 subject points while the table (overall GPS only) reads "2026 Semasa — Tiada data". | **Replicated.** | Rejected — replicate live |
| DV-M08-28 | D-27 | Contradictory (same screen) | S3 T4 cards vs table: Murid 149 vs Σ 356; Jumlah Sesi 10 vs Σ 22 (distinct 11); On Track 34 / Below 41 vs Σ 13 / 2; no "Tiada Data" bucket although some pairs have no target (top-up §2.22.1). Murid, On Track/Below and Ketepatan differ **by definition** (distinct students vs enrolments; student × config pairs vs one status per student; per-answer vs per-class). The Sesi 10 is not explainable from the page. | **Every figure is computed from the D11 dataset under its own documented definition** (URS AC-10.5, SRS BR-M08-07/08/09): the definitions are replicated, not relabelled; the only change is "Jumlah Sesi" = distinct sessions = **11** (live 10), which also sets the S1 T4 card (DV-M08-05). The missing "Tiada Data" bucket stays as live. Alternatives (discovery): (a) relabel the cards, e.g. "On Track (murid × subjek)" — rejected, the definitions are valid and it adds copy; (b) count pairs in the class rows — rejected, rewrites 13 observed rows; (c) replicate everything incl. 10 — rejected under D11 (the dataset gives 11). | Approved (D9; Delivery Lead decision on AUD-05) |
| DV-M08-29 | D-28 | Contradictory (same screen) | For class 516 / config 213: S5 block and S22 count On Track 7 / Below 8 (±2% band, S22 legend "On Track (±2%)"); on the same S5 page the row badges count 6 / 9 (AR ≥ OTR), as do the S23 chips "On Track: 6 (40%)" / "Below: 9 (60%)"; the S3 row shows 13 / 2 (per student over 5 configs). | Every "On Track" / "Below" on **S5, S22 and S23** uses the rule the pages state, "On Track (±2%)": On Track = AR ≥ OTR − 2 at the latest checkpoint with an AR (S22 splits it into Above = AR > OTR and On Track = OTR − 2 ≤ AR ≤ OTR, both "on track"), Below = AR < OTR − 2. S5 badges → 7 / 8, S23 chips → "7 (47%)" / "8 (53%)" and the AR cell colours follow. The S3 row keeps its own per-student definition (documented); S15 and S6 keep AR ≥ target as live (a cross-screen difference, documented, not on the same screen). Alternatives: (a) AR ≥ OTR everywhere — rejected, S22 would contradict its own legend; (b) replicate — rejected (same-screen contradiction on S5); (c) also change S3/S15/S6 — rejected, their definitions are not contradicted on their own screens. | Approved (D9; Delivery Lead decision) |
| DV-M08-30 | D-29 | Broken (data loss) | S17 `renderPreviews()` rebuilds `#captionFields` whenever a photo is added or removed, so every typed caption is cleared (top-up §2.22.7). | Typed captions are kept with their photos when photos are added or removed; nothing else changes. | Approved (D9) |
| DV-M08-31 | XR-M18-09 (M18 DV-M18-39) | Contradictory (same school, two screens) | On the school item-analysis template the "GPS Anggaran Sekolah" card shows the platform GPS 3.45 / "Berdasarkan 744 entri headcount" and the platform years (2022 5.20 …) while the school's own dashboard (M18 S27) shows 2.49 / 148 for the same school (8880). | The card is scoped to the school: 8880 "2.49" "Baik" "Berdasarkan 148 entri headcount", sparkline = the school's yearly headcount GPS (only 2026 for 8880); nothing else changes. Alternatives: replicate the platform value — rejected (same-school contradiction with S27); hide the card — rejected (removes a working element). | Approved (D9; adopted from M18) |
| DV-M08-36 | Discovery lines 1218–1223 | INFERRED generation choice (not a live defect) | Class 228 "⚠️ Perlu Perhatian (57)": only the total 57 and the first three rows (48.3%, 45%, 44.6%) were captured; how the 57 divides into members under 50% and idle members was not observed. | Seeds use **11 under 50% + 46 idle** (INFERRED). The three observed rows are pinned as anchors (3 sessions 29/60, 2 sessions 18/40, 5 sessions 45/101); the other 8 weak members are generated below 44.6% so the observed order holds. Class totals (1,618 sessions, 34,882 answers, 77.6%) are unchanged. Alternatives: any other split of the 57, for example 3 + 54 or 20 + 37 — **not checked for feasibility** with the class-228 pins and not chosen; no evidence favours any split. Only 11 + 46 is verified (M05 boot checks and unit tests); it can change without touching an observed value. Never asserted by E2E beyond the total 57, the first three rows and the ordering rule. | Choice (INFERRED) |
| DV-M08-37 | M08-T3 as-built (S18) | Broken (visual bug) | S18 avatar is a broken image: the tier-progress ring shows the image alt text inside an empty circle. | The ring is kept (tier colour, filled to the tier progress) and shows the student's initial inside it, since profiles have no photo; nothing else changes. Alternative: replicate the broken image — rejected (D9, visual bug). | Approved (D9) |
| DV-M08-39 | SWEEP-23OCT D2 | Dead link (403) | The sidebar "Headcount" and the S1 "Navigasi Pantas" tile "Headcount" are shown to pelajar, but `/headcount*` is teacher tooling and answers the 403 page (FR-M08-08; API `@Roles('admin','teacher','school_admin')`). | The S1 quick-nav tile is hidden for roles outside admin / teacher / school admin. The sidebar item is hidden for pelajar by adding `headcount` to `STUDENT_HIDDEN_IDS` in `src/shells/nav/user-nav.ts` (patch handed to half AZ; same precedent as `analisa-item`). Alternative rejected: open `/headcount` to pelajar (no pelajar view is specified and the API refuses the role). | Approved (user rule D9) |
| DV-M08-40 | SWEEP-23OCT D6 | Silent redirect to a screen the role cannot open | `/analisa-item` for pelajar and every role without a target redirected to a fixed `/dashboard` (FR-M08-09), which was not the pelajar home in http mode at the time and is not in the scope of other roles. | The fallback is the role's own home (`shellHomePath`: `/dashboard` for a pelajar in both modes since AZ-20c); still silent, no message. | Approved (user rule D9) |
| DV-M08-41 | SWEEP-23OCT A6 | Broken (404) | `/analisa-item/sekolah` (no `{id}`) for Admin Pusat, who has no school, answers 404 from the API and rendered the SPA 404 page. | The own-school 404 renders the S9 header, breadcrumb and the "Tiada Data Pelajar" empty state (as an id without pupils, FR-M08-143). A 404 on `/analisa-item/sekolah/{id}` stays the 404 page. | Approved (user rule D9) |
| DV-M08-42 | SWEEP-23OCT D5 | Wrong copy / dead button | S4 `/prestasi/kelas` empty state for a pelajar or a school admin repeated the teacher copy "Cipta kelas terlebih dahulu…" and the button "Cipta Kelas" → `/guru/kelas/cipta`, which they cannot open. `/prestasi/kelas/{id}` stays 404 for pelajar (BR-M08-26). | Teacher and admin keep the observed empty state (FR-M08-29). Any other role sees the title "Anda belum mempunyai kelas aktif.", the description "Prestasi kelas dipaparkan untuk guru yang mempunyai kelas aktif." and no button. | Approved (user rule D9) |
| DV-M08-43 | SWEEP-23OCT D4 | Dead link (404) | S18 `/pelajar/{id}` "Jadi Penaja" → `/sponsor/register` (M21 S7), a route that is not registered in the rebuild (SPA 404). | The sponsor CTA panel is hidden while no `/sponsor/register` route exists; it shows again, unchanged, once M21 registers it. | Approved (user rule D9) |
| DV-M08-44 | SWEEP-23OCT D6 | Dead link outside role scope | S6 "Mula Berlatih" → `/practice` and the "Fokus" buttons (and their legend) → `/practice/{CODE}/quiz` were shown to a teacher / admin reading a pupil's Prestasi 360, whose scope has no `/practice`. | Hidden when the role's prototype scope does not allow `/practice`; unchanged for pelajar. | Approved (user rule D9) |
| DV-M08-45 | AM-SWEEP-HTTP-23oct SW3-02 (S9) | Dead link (D9) | S9 "Prestasi 360" on `/analisa-item/sekolah/{id}` links to `/sekolah/{id}/prestasi`, which has no route, so the admin (whose prototype scope allows every path) lands on the global 404 page. | The link is hidden while the route does not exist (shown only when the path is both in scope and a real route); teacher and school-admin behaviour is unchanged. Alternative: build the school Prestasi 360 page — rejected (new scope). | Approved (user rule D9) |
| DV-M08-49 | SW5-09 (teammate report) | Broken (invalid id calls the API) | `/prestasi/kelas/:id` (S5) and `/analisa-item/kelas/:id` accepted any text as the id, so `/prestasi/kelas/abc` called `GET …/classes/NaN`. | Both routes take `:id([0-9]+)` (as the `/headcount` routes do); a non-numeric id falls through to the standalone 404 page and no API call is made. | Applied (D9) |

**Explicitly not deviations** (replicated as live): the "1-1 / 2-2 / 3-3" heatmap legend; the raw level slug "tingkatan-5"; English words in headcount copy; 750 unpaginated class cards (S10) and chips (S11); 645 unpaginated S3 rows; S1 number formatting; only T4/T5 level dashboards (D10); S4 header "Prestasi Kelas" with h1 "Dashboard Kelas"; S11 3-column summary at 375px; the admin's S7 map at the admin's own level; the BM ring "3 / 3 SP"; S8 class 4 with 6 profiles for a 58-student class; the S8 "Kelas" select limited to own classes; "Laporan Mingguan" in the menu; the leaderboard subtitle for every period; S6 "Sesi Kuiz" 0 (DV-20); the S15 "Belum Ada Data" status without targets and "On Track"/"Below Target" wording vs S6 "Below"/"—"; the S3 T4 card and row definitions except Sesi (DV-28); the RS chart point (DV-09 withdrawn); the four coin figures; S18 "Darjah 6" vs the M01 account grade 4 (two observed fields); S18 "0 hari berlatih" / "0 kombo terpanjang" vs S6 "13" / "5"; the Fokus link with or without `level`; the ranking footer on the nasional scope only; no loading spinners.

---

## 8. Out of scope

| Item | Owner / reason |
|---|---|
| The practice quiz started by "Latihan Fokus" / "Fokus" | M05 (M08 builds the link only). |
| Classrooms, enrolment, join codes, `/guru/kelas/cipta` | M10 (M08 reads ClassroomRef and seeds the designed classes through M10's contract). |
| DSKP data set (Bidang / SK / SP) | M10 (M04 DATA-M04-09). |
| Coins, syiling, tiers (Bronze → Silver), streak, badges ("Lencana"), `/gamification/leaderboard` | M14. |
| `/battle/leaderboard`, `/battle/ranking-sekolah` | M16. |
| `/guru/laporan-mingguan-kelas`, `/guru/analisis-item`, other teacher reports | M11. |
| `/sponsor/register` | M21. |
| Shell (sidebar, drawer, header, notification bell, chatbot, PWA install, tournament banner) | Global shell / M23 (M16 banner). |
| Weekly report content | Blocked (OQ-M08-01); not specified. |
| Headcount edit pages `/results/{n}`, `/edit`, `/unjuran`, `/settings`, CSV export content | Not observed (L-12); routes provisional, UI not specified. |
| Real backend aggregation, storage and sharing | Backend phase (D1, D2). |

---

## 9. Open questions

1. **OQ-M08-01 Weekly report (L-1) — blocking for FN-M08-8.1.2.** `/laporan-mingguan` returns 403 for the admin; its role, sections, week navigation and charts are unknown. **A student (and a teacher) test account is needed** to discover it and `/guru/laporan-mingguan-kelas` (M11). The menu item stays as live.
2. **OQ-M08-02 Timeline posts (L-5).** Post card layout on S16 and S18, edit/delete, and the server's photo rule (1–5 photos, INFERRED). PROPOSED: posts newest first; PROPOSED COPY "Sila muat naik sekurang-kurangnya 1 gambar.".
3. **OQ-M08-03 Headcount still unobserved (L-4, narrowed).** The S12 list with configs and its `filterLevel`, S13 with data and its filter labels, and the Auto-Setup and create results/errors. PROPOSED: card list, silent redirect, "Headcount Auto untuk kelas, subjek dan tahun ini sudah wujud.", filter labels "Tingkatan 4"/"Tingkatan 5". The S15 Unjuran, trend-chip and Keyakinan rules and the S5/S6 "latest config" rule are INFERRED (SRS BR-M08-24).
4. **OQ-M08-04 Who sees S1–S3 (discovery Q3).** INFERRED: the all-schools view is admin-only and a school admin sees its own school.
5. **OQ-M08-05 Admin profile level — closed.** Two observed fields: the account grade Darjah 4 (M01 `/profile/edit`, S7 captions, `level=4`) and the public-profile chip Darjah 6 (S18). Both are replicated.
6. **OQ-M08-06 Coins, activity and badges — closed (v1.8).** M14 owns them (DV-M14-08/09, XR-M14-03): S6 "Koin" and S18 syiling = `currentSyiling` 256, streak 1 / best 5, badges from `learnerBadges.forUser`; S20 "Koin" 26 stays BR-M08-28. The M08 fields `practiceDays` (S6 "Hari Latihan" 13) and the S18 activity counts ("0 hari berlatih") stay as observed.
7. **OQ-M08-07 S6 session scope (DV-M08-20).** Confirm that Prestasi 360 counts only practice-mode sessions and what "Sudah n hari tiada latihan" and "Belum ada sesi latihan lagi" are measured from.
8. **OQ-M08-08 Adaptive analytics bands (L-9, L-10).** Message box for accuracy ≥ 50%, trend up/down icons, Kritikal/Tinggi badge colours and the page for a learner with no data are unobserved (the S11 Tahap pills are now OBSERVED).
9. **OQ-M08-09 Ranking rules (L-11, DV-M08-23/26).** Ranking threshold, page size, the ascending-Betul order, the "Tahap" source, the daerah scope with data.
10. **OQ-M08-10 Teacher-side targets (L-2, L-3, L-6, L-7).** `/analisa-item` for teachers/students, `/analitik/kelas/pelajar/{id}` for a teacher, the populated S4 picker and S9.
11. **OQ-M08-11 Integer user ids — closed.** Canonical ids 1–11 (M01 v1.9) are used; module-designed users are 3001–3008 and 3201–3215, classes 2001–2002, configs 501–505.
12. **OQ-M08-12 Cross-module data requirements (D11/D12) — delivered.** M08 reads other owners' stores; each owner now provides the following (versions as in Related): **M05** — the answer-log and session D11 dataset (XL2-01; M05 v1.12 §6.14, named queries §6.14.2 cited in SRS §6.3; the observed/generated S20 standings are M08 documented display data, SRS BR-M08-28) with the platform allocation of SRS §6.3 (32,122 sessions, 478,499 answers, 79.8%; T4 11 distinct sessions at 63.9%, T5 29,971 at 79.7%) and the designed sessions of 3001–3008 (SRS §6.10) through the BR-31 contract; **M10** — classes (750, with the observed and designed anchors), enrolments (4,533 distinct students; T4 149, T5 3,911), teachers of classes (551), the DSKP SP/SK/Bidang records M08 reads (9001–9004 under Kimia T5; the admin's SPs 221, 206, 222, 214, 179, 194, 418 and the BM/Sejarah Darjah 4 map tiles; XL2-20); **M04** — the `dskpSpId` facet with the eligible counts (9001 → 30, 221 → 16, 206 → 16, 222 → 7, 214 → 12, 179 → 13, 194 → 50, 418 → 13); **M02** — S1 "Murid"/"Guru" = users by role (XL2-02); **M04** — the M08 contributed anchors of M04 v1.10 §6.13.2 (700001–700008, 700101–700128 Kimia T5 with SPs 9001–9004; 700201–700215 Sejarah T4), counted by the §4.1 named queries (no `dskpSpId` is expected on the M05 anchors); **M02** — the M08 user anchors 3001–3008 (SMK DEMO) and 3201–3215 (class-516 pupils, no school; 3101–3109 are M09's), recorded in M02 §6.15; **M14** — `wallet.summary`, `streak.get`, `learnerBadges.forUser` (XR-M14-03, applied v1.8); **M18 / M12 / M17** — read the M08 headcount, history and item-statistics stores (SRS §6.8, §6.10; XL3-07); **M02** — schools 900001/900002 as seeded.
13. **OQ-M08-13 Headcount pages not opened (L-12).** `/headcount/{id}/results/{n}`, `/edit`, `/unjuran`, `/settings`, `/export` and the results of reset, delete and drop/restore. The rebuild keeps the routes and the observed entry points and applies INFERRED effects (provisional); their UI is not specified.
14. **OQ-M08-14 Practice data of the class-516 pupils.** The top-up saw Penguasaan, weak topics and averages for an at-risk pupil (e.g. BM "8 sesi · 94 soalan", "Tingkatkan prestasi Matematik (purata 67.9%)…"). Mirroring them needs M05 anchor sessions (M05 owner); the seed mirrors only their headcount data, and the E2E assert only that.

**PROPOSED items to report at G1** (Delivery Lead): titles of DV-M08-01; S1 level-card values (DV-M08-05/28); "Baik" pill (DV-M08-12); the "/ 23 SP" denominator (DV-M08-13); range format (DV-M08-16); the ±2% statuses on S5/S23 (DV-M08-29); the PROPOSED COPY and layouts in OQ-02, 03, 08, 10, 13.
