# M18 — PPD & JPN: district and state portals, Amaran Awal, officer item analysis and Kombo views — Software Requirements Specification

## 0. Document control

| Field | Value |
|---|---|
| Document | SRS — M18 PPD & JPN |
| Version | 1.8 |
| Date | 2026-09-27 |
| Status | **Approved (G1)** — 2026-09-27 (v1.3: XL batch 3); audit round 2 PASS. OQ-M18-01 is non-blocking for G1 (officer views provisional, `@provisional` E2E) and open for G5. |
| Author | product-analyst (agent) for §1–§5, §8–§10, §12–§13; solution-architect (agent) for §6 data entities, named queries, reconciliation, datasets and seeds, §7 mock API, §11 |
| Source URS | [urs/M18-ppd-jpn.md](../urs/M18-ppd-jpn.md) v1.0 (203 FN, 41 stories, AC-M18-nn.m) |
| Source discovery | [M18-ppd-jpn.md](../../discovery/M18-ppd-jpn.md), inventory `docs/discovery/inventory/M18/` (seed snapshot `_snapshot-2026-09-26.json`, 2026-09-26 12:36 MYT), screenshots `docs/discovery/img/M18/` |
| Related | [M01](M01-authentication.md) v1.9, [M02](M02-users-schools.md) v1.11 (login placement as of v1.21; `lastActiveAt` requested by XR-M18-21), [M03](M03-curriculum.md), [M04](M04-question-bank.md) v1.9, [M05](M05-practice.md) v1.8, [M08](M08-student-performance.md) v1.7, [M10](M10-teacher-class.md) v1.6, [M11](M11-teacher-analytics.md) v1.8, [M14](M14-gamification.md), [M17](M17-admin-dashboard.md) (Command Center pattern), [shells](../../design/shells.md), architecture overview §6 (virtual datasets, repositories) |

**Change log**

| Version | Date | Change |
|---|---|---|
| 1.8 | 2026-09-27 | **Revision history — v1.8, XR-M18-21 amendment (F-23 build query)** (status stays Approved (G1); URS unchanged at v1.7). The class-1156 pupil is identified as live user id **4627** (S17 inventory: `/prestasi/4627`, `/amaran/intervensi/4627`; URS EL-M18-S17-023 / 025). No M02 anchor or M10 membership holds it: XR-M18-21 now asks M02 to add student anchor 4627 (one generated slot, no total change; school not observed — M02 places it) and M10 to make it the single member of class 1156; §6.11 B cites the id. No observed value changes. |
| 1.7 | 2026-09-27 | **Revision history — v1.7, two-field model (Delivery Lead reversal of DV-M18-43 (c))** (status stays Approved (G1)). Live keeps two independent per-user dates: the risk "Terakhir aktif" reads a stored activity date, M11 / M17 login states read `lastLoginAt` (7780 and 8880 disagree in opposite directions, so one field cannot hold both). New **§6.1a `User.lastActiveAt`** (owner M02 / M01, D12; stored, nullable, not derived from answers, sessions or logins) read by BR-M18-13 / 15 / 34; M18 no longer reads `lastLoginAt`. BR-M18-13's A branch stated precisely (A = 50 only without session, activity date and mastery — fits the observed 8765 pupil scored 97 with "Tiada aktiviti"). **DV-M18-43 and DV-M18-45 withdrawn — two-field model, 0 visible changes**; every observed value restored: S1 split **86 / 49**, 8880 rows (42 × 80 incl. S28 T4 15 × 80, T5 84.4 / 83.6 / 12 × 80 / 66.8; average 84.0), BATANG PADANG **29 / 4**, 7780 **97.6**, school 1 97.5, district **97.6**, school order HAMID KHAN first. C24, C25, C31 (now (a) two fields), Q-M18-RISK, §6.11 B, XR-M18-05 / 08, SQ-M18-03, E2E-M18-23 / 76 / 81 / 82 / 83 restated. New **XR-M18-21** (M02): add `lastActiveAt` and seed the 169 M18-visible pupils (115 dated / 54 null) from the observed rows; default for everyone else = `lastLoginAt`. |
| 1.6 | 2026-09-27 | **Revision history — v1.6, M02 v1.21 change request (F-23; BATANG PADANG logins)** (status stays Approved (G1)). §6.11 B pinned BATANG PADANG at 29 logged in / 4 never — observed on live S22 / S18 (26 Sep 12:36; 7780 15 / 2, school 1 14 / 2; averages 97.6 / 97.5 / 97.6 reproduced by BR-M18-13, R8d–e). M11 S3 (25 Sep 19:24, observed) shows all 6 T4/T5 pupils of 7780 "Belum login"; 4 of them carry February dates on S22. No counting definition reproduces both (same six pupils on both sides; a login window is refuted by 8880's February-dated login-only pupils that M11 counts as logged in; district / level membership unchanged) — new reconciliation row **C31** and **DV-M18-45** (URS §7, D9): the M02 v1.21 placement wins, **25 / 8** (7780 11 / 6, school 1 14 / 2). Risk inputs of §6.11 B, the 7780 seed row, Q-M18-RISK (7780 92.9, district 95.2), C25 and E2E-M18-81 / 82 / 83 restated. No change request to M02 (v1.21 already holds this placement). |
| 1.5 | 2026-09-27 | **Revision history — v1.5, XL batch 3 round 2 (R2-02)** (status stays Approved (G1)). 8765's 21 practice sessions (309 / 242) and 2700's single session fit no M05 store (the log is too small; KirkpatrickSessionAggregate is T4/T5 only), so they become M18 documented display values (new DATA-M18-07, reconciliation C30, alternatives recorded); Q-M18-SESS, §6.10, §6.11 D and XR-M18-05 no longer cite the M05 aggregate. No computed session figure of the same school and scope sits beside them (the calendar and S30 are answer-log figures, paired the same way on live). No visible change. |
| 1.4 | 2026-09-27 | **Revision history — v1.4** (status stays Approved (G1)). XR-M14-10: the school kombo means of 8880, 7780, 1, 2700, 8767 and 8772 cannot come from their own top-10 rows; kept as documented display values (new DV-M18-44, DATA-M18-06, C29, XR-M18-20; 0 visible changes vs ≈ 20 if computed). DV-M18-43: row count corrected to 28 and the alternatives listed with their visible-change counts (the M11-side alternative changes fewer values but overturns two modules' observations — rejected by the Delivery Lead). |
| 1.3 | 2026-09-27 | **Revision history — v1.3, XL batch 3** (`docs/qa/audit/cross-module-logic-M12-M18.md`; status stays Approved (G1)). XL3-20: 8880 login states follow the M02 v1.12 placement (14 never logged in) — new DV-M18-43 (D9) with the changed values (S1 split 114 / 21; 8880 risk rows of classes 516 / 517; average 93.5, order unchanged). XL3-21: 3201–3215's 6,563 answers are answers without a session (M05 v1.10). 8880's 2,956 other answers are `latih_tubi` sessions of T5 non-T4-class pupils. 8765's (and 2700's) sessions are read from M05 KirkpatrickSessionAggregate (M05 SQ-12 (a)); Q-M18-SESS reads each pupil from one store. XL3-33: entity renamed `AmaranIntervention`. XL3-35: class 517 stated as an anchor inside M10's 750 and M08's T5 3,911. XR-05 / XR-08 marked applied. |
| 1.2 | 2026-09-27 | **Revision history — v1.2, audit round 2 residuals and G1 approval.** R2-01: the stored critical-question set has one base and one owner (M08 item statistics, INFERRED; new XR-M18-19); Q-M18-CRIT no longer cites the answer log and includes 8765's 6 questions; XR-M18-10 drops the "Sukar" difficulty. R2-02: `pupilsWeak` on CorrectionSubject; 2710's five weakness rows seeded. R2-03: S5 "—" vs heat-map "0%" for a zero value, both replicated (BR-M18-19). R2-04: XR-M18-03 settled on a separate stored subject-accuracy set. R2-05: XR-M18-08 compensation uses 15 Aktif rows whose answers move to 3201–3215 (M11 Aktif 31 kept), decided at XL batch 3. Status Approved (G1); OQ-M18-01 open for G5. |
| 1.1 | 2026-09-27 | Audit round 1 fixes AUD-M18-01…11 and the top-up (see URS change log): project clock; live IC mask; BR-16, BR-19, BR-26, BR-33 rewritten from live evidence; Q-M18-ACCSTU base; C9 (a), C11, C17, C19, new C28; XR-02/03/08 restated, new XR-18 (M14 `totalDays`); §8.2 and §10 completed. |
| 1.0 | 2026-09-26 | First issue. 113 FRs, 34 BRs, 6 validation rules, 5 owned stores / constants + 14 read models, 38 mock endpoints, 109 E2E (21 provisional), 9 SEC items, 17 cross-module requests. Every count is a named query on an owner dataset or on an M18-owned aggregate that live itself stores (§6.8); count conflicts reconciled by script (§6.9, 85 checks, 0 failures). |

### 0.1 Fidelity deviations referenced here

URS §7 is authoritative. Approved fixes: DV-M18-01 (🥇), 02 (mean over schools with data), 03 (S10 KLUANG row), 04 (Pelajar column), 05 (developer line), 07 (MYT), 11 (one menu, DV-SH-04), 13 (IC masking + audited reveal), 14 (distinct-school counter), 15 (mastery %), 16 (S11 working panels), 17 (district CSV key), 18 (each school once), 19 (S20 in-card scroll), 21 (Kembali), 22 ("PPD" once), 23 (pupil's classes), 24 (S27 header), 25/26/27 (404 for unknown ids), 30 (≥ 12 px), 31 (white h2), 32 (S27 school-scoped), 39 (S30 school GPS). Rejected — replicate live: DV-M18-06, 08, 09, 10, 12, 20, 28, 29, 33, 34, 35, 37, 38, 40, 41, 42, 44. Replicate for the admin with a provisional officer page: DV-M18-36. **Withdrawn (v1.7) — two-field model, 0 visible changes:** DV-M18-43 (8880) and DV-M18-45 (7780); the risk rows read `lastActiveAt` (§6.1a) and every observed value is replicated.

---

## 1. Scope

The M18 prototype implements, against the mock service layer, the 33 screens of URS §1 in the user-portal shell (S11 standalone), for the admin preview (observed) and for the PPD / JPN officers (INFERRED scope, provisional). M18 **owns**: the risk model (computed, not stored), the intervention store (DATA-M18-01), the IC-reveal audit (DATA-M18-02), the daily ranking / usage snapshot (DATA-M18-03), the correction aggregate (DATA-M18-04) and the admin preview scopes (DATA-M18-05). Every other figure is **computed per request** from the owners' datasets through the named queries of §6.8 (D11/D12).

**Out of scope:** URS §8 — the M08 link targets, the M14 `/kombo` redirect and streak store, the owners' stores, the M17 Command Center, the global shell, real files / jobs / authorisation (backend phase).

---

## 2. Screens & routes

Page routes keep the live URLs and query names (`period`, `subject_id`, `grade`, `class_id`, `school_id`, `scope`, `district`, `state`, `tingkatan`, `format`) so bookmarked links work unchanged. `{id}` / `{studentId}` are integers (M02 / M01 ids); `{PPD}` is the district name as stored (URL-encoded, e.g. `PPD%20KLUANG`).

| # | Route | Screen | Primary actor(s) | Shell · tab title | API (§7) |
|---|---|---|---|---|---|
| S1 | `/ppd/dashboard` | Dashboard PPD | PPD officer; Admin | SHU · "Dashboard PPD \| PRESTASIPLUS" | #2 |
| S2 | `/ppd/command-center` | 403 (admin) / Command Center PPD (officer, provisional) | Admin; PPD officer | 403 standalone / standalone | #3 |
| S3 | `/ppd/statistik-penggunaan` | Statistik Penggunaan Daerah | PPD officer; Admin | SHU · "Statistik Penggunaan Daerah — {PPD}" | #4 |
| S4 | `/ppd/ranking-kebangsaan` | Ranking Sekolah 1 Malaysia | PPD officer; Admin | SHU · "Ranking Sekolah 1 Malaysia — PRESTASIPLUS" | #5 |
| S5 | `/ppd/benchmark-sekolah` | Benchmark Sekolah Daerah | PPD officer; Admin | SHU · "Benchmark Sekolah — {PPD}" | #6, #9 |
| S6 | `/ppd/peta-haba` | Peta Haba Prestasi Daerah | PPD officer; Admin | SHU · "Peta Haba Prestasi — {PPD}" | #7 |
| S7 | `/ppd/export-laporan` | Eksport Laporan Daerah | PPD officer; Admin | SHU · "Eksport Laporan — {PPD}" | #8, #9 |
| S8 | `/ppd/leaderboard-sekolah` | Leaderboard Sekolah Daerah | PPD officer; Admin | SHU · "Leaderboard Sekolah — {PPD}" | #10 |
| S9 | `/ppd/sekolah/{id}` | School statistics | PPD officer; Admin | SHU · "{SEKOLAH} — Statistik" | #11, #12 |
| S10 | `/jpn/dashboard` | Dashboard JPN | JPN officer; Admin | SHU · "Dashboard JPN \| PRESTASIPLUS" | #13 |
| S11 | `/jpn/command-center` | Command Center JPN | JPN officer; Admin | standalone · "Command Center JPN — {negeri}" | #14 |
| S12 | `/jpn/statistik-penggunaan` | Statistik Penggunaan Negeri | JPN officer; Admin | SHU · "Statistik Penggunaan Negeri — {negeri}" | #15 |
| S13 | `/jpn/ranking-kebangsaan` | Ranking Kebangsaan | JPN officer; Admin | SHU · "Ranking Kebangsaan — PRESTASIPLUS" | #5 |
| S14 | `/jpn/daerah/{PPD}` | Statistik Penggunaan Daerah (JPN) | JPN officer; Admin | SHU · "{PPD} — Statistik Daerah" | #16 |
| S15 | `/jpn/sekolah/{id}` | School statistics (JPN) | JPN officer; Admin | SHU · "{SEKOLAH} — Statistik" | #11, #12 |
| S16 | `/amaran` | Amaran Awal — Kelas | Guru; school admin; officers; Admin | SHU · "Amaran Awal — Kelas \| PRESTASIPLUS" | #17 |
| S17 | `/amaran/kelas/{id}` | Class risk | as S16 | SHU · as S16 | #18, #29 |
| S18 | `/amaran/ppd` | Amaran Awal — Daerah | PPD officer; Admin | SHU · "Amaran Awal — PPD \| PRESTASIPLUS" | #19, #31 |
| S19 | `/amaran/jpn` | Amaran Awal — Negeri | JPN officer; Admin | SHU · "Amaran Awal — JPN \| PRESTASIPLUS" | #20 |
| S20 | `/amaran/keberkesanan/ppd` | Keberkesanan Intervensi (Daerah) | PPD officer; Admin | SHU · "Keberkesanan Intervensi - {PPD}" | #23 |
| S21 | `/amaran/keberkesanan` | Keberkesanan Intervensi (own school) | Guru; school admin; Admin | SHU · "Keberkesanan Intervensi - {SEKOLAH}" | #24 |
| S22 | `/amaran/sekolah/{id}` | Amaran Awal — Sekolah | officers; school admin; guru; Admin | SHU · "Amaran Awal — Sekolah \| PRESTASIPLUS" | #21, #30 |
| S23 | `/amaran/ringkasan-eksekutif` | Ringkasan Eksekutif (print) | officers; school admin; Admin | SHU · "Ringkasan Eksekutif — {scope} \| PRESTASIPLUS" | #22 |
| S24 | `/amaran/intervensi/{studentId}` | Log Intervensi | Guru; school admin; officers (Q-M18-8); Admin | SHU · "Log Intervensi — {nama} \| PRESTASIPLUS" | #25–#28 |
| S25 | `/analisa-item/ppd` | Analisa Item PPD | PPD officer; Admin | SHU · "Analisa Item PPD \| PRESTASIPLUS" | #32 |
| S26 | `/analisa-item/jpn` | Analisa Item JPN | JPN officer; Admin | SHU · "Analisa Item JPN \| PRESTASIPLUS" | #33 |
| S27 | `/sekolah/{id}/prestasi` | Dashboard Prestasi Sekolah | officers; school admin; Admin | SHU · "Dashboard Sekolah — Prestasi" | #34 |
| S28 | `/sekolah/{id}/amaran` | Amaran Awal — Sekolah | as S22 | SHU · as S22 | #21, #30 |
| S29 | `/sekolah/{id}/kombo` | Kombo Harian — Sekolah | officers; school admin; Admin | SHU · "{SEKOLAH} — Kombo Harian \| PRESTASIPLUS" | #38 |
| S30 | `/sekolah/{id}/analisa-item` | Analisa Item Sekolah | officers; school admin; Admin | SHU · "Analisa Item Sekolah \| PRESTASIPLUS" | #35 |
| S31 | `/kombo/ppd` | Kombo Harian PPD | PPD officer; Admin | SHU · "Kombo Harian PPD \| PRESTASIPLUS" | #36 |
| S32 | `/kombo/jpn` | Kombo Harian JPN | JPN officer; Admin | SHU · "Kombo Harian JPN \| PRESTASIPLUS" | #37 |
| S33 | `/kombo/sekolah/{id}` | Kombo Harian — Sekolah | as S29 | SHU · as S29 | #38 |

Downloads: `/ppd/export-laporan?format=csv` (#9), `/amaran/export/class/{id}` (#29), `/amaran/export/school/{id}` (#30), `/amaran/export/district/{key}` (#31). Unknown ids or names on every `{id}` / `{PPD}` route → the M01 404 page (URS FN-M18-1.2.7/1.2.8).

---

## 3. Functional requirements

| ID | Requirement | FN | AC |
|---|---|---|---|
| FR-M18-01 | The user-portal menu SHALL render, from **one** declaration used by the desktop sidebar and the drawer (DV-SH-04, DV-M18-11), the M18 entries in this order with the live labels, icons and targets: "Command Center LIVE" (`fa-satellite-dish`, badge "LIVE"), "Dashboard PPD", "Statistik Penggunaan" (PPD), "Ranking Kebangsaan" (PPD), "Benchmark Sekolah", "Peta Haba", "Export Laporan", "Leaderboard Sekolah", "Dashboard JPN", "Statistik Penggunaan" (JPN), "Ranking Kebangsaan" (JPN), under the heading "PPD / JPN", and "Amaran Awal" (`fa-exclamation-triangle`) → `/amaran` in the first drawer group after "Analisa Item" and in "PENILAIAN" after "Laporan". Role filtering at render time: admin all; `ppd_officer` PPD entries + "Amaran Awal"; `jpn_officer` JPN entries + "Amaran Awal"; teacher "Amaran Awal" only (INFERRED). | 1.1.1, 1.1.2, 1.1.3, 1.1.4 | 01.1, 01.2, 01.4 |
| FR-M18-02 | Every M18 page except S11, S2 (admin) and the error pages SHALL render inside the user-portal shell (SHU) for every role; S11 SHALL render standalone; the 403/404 pages standalone (M01). | 1.1.8 | 01.3 |
| FR-M18-03 | The shell header title / subtitle SHALL be the per-screen values of URS FN-M18-1.1.5, with the fixes of FN-M18-1.1.6 (S27 "Dashboard Prestasi Sekolah" / "{SEKOLAH}", DV-M18-24; S23 "PPD {name}" without the doubled prefix, DV-M18-22). | 1.1.5, 1.1.6 | 02.1, 02.2, 02.3, 02.4 |
| FR-M18-04 | Each screen SHALL set the live tab title of URS FN-M18-1.1.7 (S23 with the DV-M18-22 fix). | 1.1.7 | 02.1, 02.2 |
| FR-M18-05 | Every M18 route SHALL require a session; a guest SHALL be redirected to `/login` by the M01 guard. | 1.2.1 | 03.1 |
| FR-M18-06 | Access SHALL follow §9: a role outside a route family's roles SHALL be sent to its M01 landing page (page) and receive `403 FORBIDDEN` (API). | 1.2.2 | 03.2, 03.3, 03.4 |
| FR-M18-07 | The server SHALL resolve the viewer's scope per BR-M18-01 (officers from `ppdDistrict` / `ppdState`, INFERRED) and apply it to every aggregate, list, select, drill-down and export of the request. | 1.2.3 | 04.2, 04.4 |
| FR-M18-08 | For the admin the server SHALL use the documented preview scopes of DATA-M18-05 (observed) without any picker. | 1.2.4 | 04.1 |
| FR-M18-09 | A request for a school, class, pupil, district or record outside the officer's scope SHALL return 403 (page: the M01 403 page); the admin is not scope-checked (as live). | 1.2.5 | 04.3, 04.4 |
| FR-M18-10 | Every M18 aggregate SHALL exclude the reserved fixture schools 900001–900099 (BR-M18-02). | 1.2.9 | 04.5 |
| FR-M18-11 | `/ppd/command-center` SHALL render the M01 403 page for the admin (exact copy of URS FN-M18-1.2.6). | 1.2.6 | 05.1 |
| FR-M18-12 | Unknown or non-numeric ids and unknown `{PPD}` names on every M18 route, and the probed paths of URS FN-M18-1.2.7, SHALL render the M01 404 page; `/amaran/kelas/{unknown}`, `/kombo/sekolah/{unknown}` and `/sekolah/{unknown}/analisa-item` SHALL also give 404 (DV-M18-25/26/27). | 1.2.7, 1.2.8 | 05.2, 05.3, 05.4 |
| FR-M18-13 | Pages with a head SHALL show the breadcrumb row and the header card of URS FN-M18-1.3.1 with the per-screen labels and counters. | 1.3.1 | 07.1 |
| FR-M18-14 | S3, S4 and S13 SHALL show the period pills of URS FN-M18-1.3.2 (`period` ∈ today / 7days / 30days, default and fallback 30days per BR-M18-30) and echo the label in the sub-lines. | 1.3.2 | 06.1 |
| FR-M18-15 | Ranked lists SHALL show 🥇 🥈 🥉 for places 1–3 then the number (S8 mobile "#n"), with the `sr-only` legend texts on S5/S8 (DV-M18-01). | 1.3.3 | 06.3 |
| FR-M18-16 | S1 tables SHALL page client-side by 20 with the `tablePager` UI and a "Cari sekolah..." search each; S10 tables by 20 with the numbered pager; pagers hidden at ≤ 20 rows (S1). | 1.3.4 | 06.2 |
| FR-M18-17 | Numbers, percentages, averages, dates and times SHALL use the formats of URS FN-M18-1.3.5 (times in MYT, DV-M18-07). | 1.3.5 | 06.4 |
| FR-M18-18 | Data views SHALL use the shell loading state and the M01 error convention; no M18-specific loading or error copy. | 1.3.6 | 06.5 |
| FR-M18-19 | No M18 content text SHALL render below 12px (DV-M18-30). | 1.3.7 | 06.4 |
| FR-M18-20 | S1 SHALL show the breadcrumb and header of URS FN-M18-2.1.1 with Q-M18-SCH(district, all) and Q-M18-STU(district). | 2.1.1 | 07.1 |
| FR-M18-21 | S1 SHALL show the KPI cards "Jumlah Sekolah", "Jumlah Pelajar", "GPS Purata" (+ grade chip) and "Ketepatan Keseluruhan" with the live sub-lines and the queries Q-M18-SCH, Q-M18-STU, Q-M18-GPS, Q-M18-ANS. | 2.1.2, 2.1.3, 2.1.5 | 07.2 |
| FR-M18-22 | S1 SHALL show "Pelajar Berisiko Merah" with the percentage line and the split "⚠ Drp ini: **{a}** akademik berisiko, **{b}** belum mula latih" (BR-M18-15). | 2.1.4 | 07.3 |
| FR-M18-23 | S1 SHALL show "Kombo Aktif" (Q-M18-KOMBO) and "Coverage Headcount" with the funnel line (Q-M18-HC). | 2.1.6, 2.1.7 | 07.4 |
| FR-M18-24 | S1 SHALL show the GPS comparison of every school of the district (BR-M18-22 order) with links to `/sekolah/{id}/prestasi`. | 2.1.8 | 08.1 |
| FR-M18-25 | S1 SHALL show the risk tiles, bar and legend and the risk table of the schools with pupils, each school once, links to `/sekolah/{id}/amaran`. | 2.1.9, 2.1.10 | 08.2, 08.3 |
| FR-M18-26 | S1 SHALL show one subject card per subject with answers in scope, accuracy ascending, per BR-M18-06. | 2.1.11 | 09.1 |
| FR-M18-27 | S1 SHALL show the kombo tiles and the kombo table with "Pelajar" = the school's pupil count (DV-M18-04) and links to `/sekolah/{id}/kombo`. | 2.1.12, 2.1.13 | 09.2 |
| FR-M18-28 | S1 SHALL show the mastery note, the 11 level tiles with p = n ÷ records and the table "Purata Tahap" (BR-M18-10), "Pelajar" per DV-M18-04. | 2.1.14, 2.1.15 | 09.3 |
| FR-M18-29 | S1 SHALL show "Pembetulan — Gambaran Daerah" for the current month from DATA-M18-04, the notice first line only when the month has no aggregate (DV-M18-05) and the table. | 2.1.16, 2.1.17, 2.1.18 | 10.1, 10.3 |
| FR-M18-30 | S1 SHALL show "Laporan Terperinci" with the five live links (self link kept). | 2.1.19 | 10.2 |
| FR-M18-31 | S2 SHALL answer the admin with the 403 page (FR-M18-11). | 2.2.1 | 11.1 |
| FR-M18-32 | S2 SHALL render, for a `ppd_officer`, the S11 component at district scope with the PROPOSED title of URS FN-M18-2.2.2 and polling of endpoint #3 (provisional). | 2.2.2 | 11.2 |
| FR-M18-33 | S3 SHALL show the head and, when the district has no practice in the period (Q-M18-USAGE), the three live empty-state variants. | 2.3.1, 2.3.2 | 12.1, 12.2 |
| FR-M18-34 | S3 SHALL show, when the district has practice in the period, the PROPOSED school table of URS FN-M18-2.3.3 (provisional). | 2.3.3 | 12.3 |
| FR-M18-35 | S4 SHALL show the national top-50 of the ranking snapshot (DATA-M18-03, BR-M18-20) for the period with the live columns, badge colours and links `/ppd/sekolah/{id}`. | 2.4.1, 2.4.2, 2.4.3 | 13.1, 13.2 |
| FR-M18-36 | S5 SHALL show the head, the active-school count and the counters "Purata Ketepatan" (mean over schools with data, DV-M18-02) and "Purata Aktif". | 2.5.1, 2.5.2 | 14.1, 14.3 |
| FR-M18-37 | S5 SHALL show the subject filter (32 options, "Tapis", "Kosongkan") and the formula note; an unknown `subject_id` renders all subjects. | 2.5.3, 2.5.4 | 14.3 |
| FR-M18-38 | S5 SHALL list every active school of the district with the live columns and the composite score of BR-M18-11 (lifetime Soalan/Pelajar), ordered by score then name. | 2.5.5 | 14.2 |
| FR-M18-39 | S5 "Eksport CSV" SHALL download the district CSV of endpoint #9 without the subject filter (as live). | 2.5.6 | 14.4 |
| FR-M18-40 | S6 SHALL show the head and the colour legend of URS FN-M18-2.6.1/2.6.2. | 2.6.1, 2.6.2 | 15.1 |
| FR-M18-41 | S6 SHALL show the school × core-subject matrix, row "Purata" and footer "Purata Daerah" per BR-M18-19 (PI 92.2%, DV-M18-40 rejected), the hint and the footer text; the table scrolls in its card. | 2.6.3 | 15.2, 15.3 |
| FR-M18-42 | S7 SHALL show the head and the five stats (active-school scope; "Purata Ketepatan" per DV-M18-02). | 2.7.1 | 16.1 |
| FR-M18-43 | S7 SHALL show the CSV card with the live texts, "Dijana" in MYT and "Muat Turun CSV" → endpoint #9 (UTF-8 BOM, the 11 listed columns; content provisional). | 2.7.2 | 16.1, 16.3 |
| FR-M18-44 | S7 SHALL show the 5-row alphabetical preview and the footer sentence. | 2.7.3 | 16.2 |
| FR-M18-45 | S8 SHALL show the head, the two tabs (highlight only, as live), the subject filter and the formula note. | 2.8.1, 2.8.2, 2.8.3, 2.8.4 | 17.2 |
| FR-M18-46 | S8 SHALL show the podium (order 2 · 1 · 3) and the full table with the 30-day Soalan/Pelajar and score of BR-M18-11. | 2.8.5, 2.8.6 | 17.1 |
| FR-M18-47 | S8 SHALL link "Eksport CSV" to `/ppd/export-laporan` and render the card list below 640px instead of the table. | 2.8.7, 2.8.8 | 17.3 |
| FR-M18-48 | S8 SHALL show the trend icon per BR-M18-12 (titles "Meningkat" / "Menurun" / "Stabil"; empty without activity). | 2.8.9 | 17.4 |
| FR-M18-49 | S9/S15 SHALL show the breadcrumb (S9 → S4 always; S15 → `/jpn/daerah/{PPD}`) and the school header with code, district, state, type and the three counters. | 2.9.1, 2.9.2 | 18.1, 18.2 |
| FR-M18-50 | S9/S15 SHALL show the GET filter (grade, class, subject; options limited to the school's levels, owned classes and subjects), "Tapis" and "Reset". | 2.9.3 | 18.3 |
| FR-M18-51 | S9/S15 SHALL show the six usage cards per BR-M18-23 over the filtered pupils. | 2.9.4 | 18.2, 18.3 |
| FR-M18-52 | S9/S15 SHALL show the sticky section nav marking the section in view. | 2.9.5 | 18.4 |
| FR-M18-53 | S9/S15 SHALL show "Statistik Bulanan" from practice sessions of the last 12 months (Q-M18-SESS), with the subject suffix and the empty state. | 2.9.6 | 19.1 |
| FR-M18-54 | S9/S15 SHALL show the 365-day calendar from the answer log (BR-M18-24) with the three figures, labels, tooltips and legend. | 2.9.7 | 19.2 |
| FR-M18-55 | S9/S15 SHALL show "Laporan Subjek" from the correction aggregate DATA-M18-04 (short codes per M03), with "Sebelum" / "Selepas" and "Purata Level" only when present, and the empty card. | 2.9.8 | 19.3 |
| FR-M18-56 | S9/S15 SHALL show "Ranking Pelajar" with the two tabs and the three live empty states; the filled ranking is PROPOSED (provisional). | 2.9.9 | 19.4 |
| FR-M18-57 | S9/S15 SHALL show "Prestasi Per Kelas" over the classes owned by the school (BR-M18-23) with the empty state. | 2.9.10 | 19.5 |
| FR-M18-58 | S9/S15 SHALL show the pupil accordions per owned class plus "Tiada Kelas", each with the pupil table of URS FN-M18-2.9.11, and the empty state. | 2.9.11 | 20.1 |
| FR-M18-59 | S9/S15 SHALL send and show masked ICs only; "Tunjuk IC Penuh" SHALL confirm with the live text, then call endpoint #12, show the returned ICs and write DATA-M18-02; "Sembunyikan IC" hides them without a request (DV-M18-13, SEC-M18-01). | 2.9.12 | 20.2, 20.3 |
| FR-M18-60 | S9/S15 SHALL show "Senarai Guru" of the school (M02 teachers) with the empty state. | 2.9.13 | 20.4 |
| FR-M18-61 | S10 SHALL show the breadcrumb, header and six KPI cards at state scope. | 3.1.1, 3.1.2 | 21.1 |
| FR-M18-62 | S10 SHALL filter every school table client-side by name and PPD, re-paginate, show "Reset" while filtered and count **distinct matching schools** (DV-M18-14); no match → "0 sekolah dijumpai" and "Tiada sekolah dijumpai". | 3.1.3 | 21.3 |
| FR-M18-63 | S10 SHALL show the district comparison of every PPD of the state per BR-M18-22, KLUANG with the DV-M18-03 values, links `/jpn/daerah/{PPD}` and the note. | 3.1.4 | 21.2 |
| FR-M18-64 | S10 SHALL show the state GPS table (links `/jpn/sekolah/{id}`), the risk tiles and the risk table with each school once (DV-M18-18). | 3.1.5, 3.1.6, 3.1.7 | 22.1, 22.2 |
| FR-M18-65 | S10 SHALL show the subject cards, the kombo section (DV-M18-04), the mastery section with p = n ÷ records (DV-M18-15) and the corrections section at state scope. | 3.1.8, 3.1.9, 3.1.10, 3.1.11 | 22.3 |
| FR-M18-66 | S10 SHALL show "Laporan Terperinci" with the four live links. | 3.1.12 | 22.4 |
| FR-M18-67 | S11 SHALL render standalone with the top bar, badge, "LIVE" and the MYT clock ticking every second; layout fixed at every width. | 3.2.1 | 23.1 |
| FR-M18-68 | S11 SHALL show the four tiles from endpoint #14 per BR-M18-28 ("Soalan Dijawab" numeric, DV-M18-16), animating the counters. | 3.2.2 | 23.2 |
| FR-M18-69 | S11 SHALL render the panels "Top Sekolah Aktif" (school names and links, DV-M18-16), "Aktiviti Hari Ini", "Live Feed", "Top Pelajar Minggu Ini" and "Pecahan Daerah" from endpoint #14, with the live empty texts. | 3.2.3, 3.2.5, 3.2.6, 3.2.7, 3.2.8 | 23.3 |
| FR-M18-70 | S11 SHALL render the "ALESA AI" sentence of the SOURCE-DERIVED template after the first response (values INFERRED, provisional). | 3.2.4 | 23.5 |
| FR-M18-71 | S11 SHALL poll endpoint #14 on load and every 10 s while open, stop on leave and keep the last values on a failed poll; footer as live. | 3.2.9 | 23.1, 23.4 |
| FR-M18-72 | S12 and S14 SHALL show their heads and the usage snapshot (DATA-M18-03); an empty snapshot shows "Data belum tersedia" and its sentence; unknown `{PPD}` → 404. | 3.3.1, 3.3.2, 3.3.3 | 24.1, 24.2 |
| FR-M18-73 | S12/S14 SHALL show, for a filled snapshot, the PROPOSED tables of URS FN-M18-3.3.4 (provisional). | 3.3.4 | 24.3 |
| FR-M18-74 | S13 SHALL show the head with the PPD / school counts, the PPD ranking (sums of the school rows) and the school top-50 of DATA-M18-03 for the period, links `/jpn/sekolah/{id}`. | 3.4.1, 3.4.2, 3.4.3, 3.4.4 | 25.1, 25.2, 25.3 |
| FR-M18-75 | The server SHALL compute each pupil's risk score per BR-M18-13 at request time (no stored scores). | 4.1.1 | 26.1, 26.2, 26.3 |
| FR-M18-76 | Risk status, row tint and the pupil cells SHALL follow BR-M18-14 and BR-M18-34. | 4.1.2, 4.1.3 | 26.1, 26.2, 26.3 |
| FR-M18-77 | Subject weakness and list order SHALL follow BR-M18-16 and BR-M18-22, identical on every Amaran view. | 4.1.4, 4.1.5 | 26.4, 27.3 |
| FR-M18-78 | S16 SHALL list the viewer's classes (§9) by id descending as cards linking `/amaran/kelas/{id}`. | 4.2.1 | 27.1, 03.4 |
| FR-M18-79 | S17 SHALL show the back link, tiles, distribution, the pupil table with "Intervensi" links and the subject analysis of the class; a class outside the viewer's classes → 403. | 4.3.1, 4.3.2, 4.3.3, 4.3.4, 4.3.5 | 27.2, 27.3, 27.4 |
| FR-M18-80 | S18 SHALL show the district tiles, distribution, the two buttons, the school comparison and the top-risk pupil table. | 4.4.1, 4.4.2, 4.4.3, 4.4.4, 4.4.5 | 28.1, 28.2, 28.3 |
| FR-M18-81 | S19 SHALL show the state head, tiles, distribution, the summary button, the district comparison, the school comparison with each school once (DV-M18-18) and the top-risk pupils. | 4.5.1, 4.5.2, 4.5.3, 4.5.4, 4.5.5, 4.5.6, 4.5.7 | 29.1, 29.2, 29.3 |
| FR-M18-82 | S22/S28 SHALL show the level pills (→ S28 URLs), tiles, distribution, the buttons, the subject analysis when data exists and the pupil list; `tingkatan` filters by class level. | 4.6.1, 4.6.2, 4.6.3, 4.6.4, 4.6.5, 4.6.6 | 30.1, 30.2, 30.3 |
| FR-M18-83 | S23 SHALL show the no-print toolbar with "Cetak / PDF" (`window.print()`) and "Kembali" per BR-M18-31 (DV-M18-21). | 4.7.1 | 31.4 |
| FR-M18-84 | S23 SHALL render the district / state / school report of URS FN-M18-4.7.2–4.7.8 ("PPD" once, MYT times, each school once); no query → the viewer's district. | 4.7.2, 4.7.3, 4.7.4, 4.7.5, 4.7.6, 4.7.7, 4.7.8 | 31.1, 31.2, 31.3 |
| FR-M18-85 | S20 SHALL show the back link, the school filter (submit on change) and the four cards per BR-M18-17 for the district or the chosen school. | 4.8.1, 4.8.2, 4.8.3 | 32.1, 32.4 |
| FR-M18-86 | S20/S21 SHALL draw the doughnut and the 6-month trend with the live chart configuration, or the two empty texts. | 4.8.4 | 32.2 |
| FR-M18-87 | S20 SHALL show the type list, the teacher table, the follow-up list and the school comparison; wide content scrolls in its card (DV-M18-19). | 4.8.5, 4.8.6, 4.8.7, 4.8.8 | 32.3, 32.4 |
| FR-M18-88 | S21 SHALL show the viewer's school, the back link and either the "Belum Ada Intervensi" card or the S20 content for the school. | 4.8.9, 4.8.10 | 32.5 |
| FR-M18-89 | The class and school CSVs (endpoints #29, #30) SHALL contain the PROPOSED columns of §7.2 for the scope (no IC, no e-mail) and be scope-checked (403). | 4.9.1, 4.9.3 | 33.1, 33.3 |
| FR-M18-90 | The district CSV link SHALL use the district key of the page (DV-M18-17) and endpoint #31. | 4.9.2 | 33.2 |
| FR-M18-91 | S24 SHALL show the three tiles and the history newest first with type badges and dates. | 4.10.1, 4.10.3 | 34.1, 34.2 |
| FR-M18-92 | S24 "Kembali" SHALL follow BR-M18-31 (DV-M18-21). | 4.10.7 | 34.3 |
| FR-M18-93 | S24 SHALL provide the create form of URS FN-M18-4.10.2 (defaults, native `required`, the pupil's classes only — DV-M18-23) posting to endpoint #26 and reloading the log. | 4.10.2 | 35.1, 35.2 |
| FR-M18-94 | Changing a record's effectiveness select SHALL save it at once (endpoint #27) and refresh the tiles. | 4.10.4 | 35.3 |
| FR-M18-95 | The pencil SHALL reveal the follow-up textarea + "Simpan" (endpoint #27); the trash SHALL confirm "Padam intervensi ini?" and delete (endpoint #28). | 4.10.5, 4.10.6 | 35.4 |
| FR-M18-96 | Intervention writes SHALL be authorised per BR-M18-18 and stored in DATA-M18-01; every effectiveness view reflects them at once. | 4.10.8 | 35.2, 35.5 |
| FR-M18-97 | S25/S26 SHALL show the head (white h2, DV-M18-31) and the four cards. | 5.1.1, 5.1.2 | 36.1, 36.4 |
| FR-M18-98 | S25 SHALL show the school comparison (schools with answers, accuracy descending, links `/analisa-item/sekolah/{id}`). | 5.1.3 | 36.2 |
| FR-M18-99 | S26 SHALL show the district comparison of every PPD of the state. | 5.1.7 | 36.4 |
| FR-M18-100 | S25/S26 SHALL show the subject cards and the critical questions per BR-M18-26 with the "Lihat Semua" / "Sembunyikan" toggle. | 5.1.4, 5.1.5, 5.1.6 | 36.3 |
| FR-M18-101 | S27 SHALL show the head and the seven stat cards per BR-M18-23 / BR-M18-32. | 5.2.1, 5.2.2 | 37.1 |
| FR-M18-102 | S27 SHALL show the school GPS card, the grade distribution and the subject GPS table (M08 BR-M08-01…04). | 5.2.3, 5.2.4, 5.2.5 | 37.2 |
| FR-M18-103 | S27 SHALL show the level and teacher cards scoped to the school (BR-M18-32, DV-M18-32) and the quick link to S30. | 5.2.6, 5.2.7, 5.2.8 | 37.3 |
| FR-M18-104 | S30 SHALL show the head, level pills, the three cards and the difficulty profile of the listed questions. | 5.3.1, 5.3.2, 5.3.3, 5.3.4 | 38.1, 38.3 |
| FR-M18-105 | S30 SHALL show the school's GPS card (DV-M18-39) and "Prestasi 360" → S27. | 5.3.5 | 38.2 |
| FR-M18-106 | S30 SHALL show the subject table, the subject pills and the question cards (stored set, label from % salah) with their open state per BR-M18-26. | 5.3.6, 5.3.7, 5.3.8 | 38.3, 38.4, 38.6 |
| FR-M18-107 | S30 SHALL show the zero state for a school with pupils but no answers, and "Tiada Data Pelajar" for a school without pupils. | 5.3.9 | 38.5, 38.7 |
| FR-M18-108 | S31/S32 SHALL show the head, the five tiles and the full school comparison (no pager) per BR-M18-09. | 6.1.1, 6.1.2 | 39.1, 39.2 |
| FR-M18-109 | S29/S33 SHALL show the five tiles, the 365-day school calendar and the class comparison per BR-M18-09. | 6.2.1, 6.2.2, 6.2.3 | 40.1, 40.2, 40.4 |
| FR-M18-110 | S29/S33 SHALL show the top-10 pupils with "Jumlah Hari" = the stored counter per BR-M18-33 (as live; DV-M18-41 rejected). | 6.2.4 | 40.2, 40.3 |
| FR-M18-111 | Kombo figures SHALL read the M14 streak store through Q-M18-KOMBO (no M18 copy). | 6.2.5 | 39.1, 40.1 |
| FR-M18-112 | Every M18 screen SHALL meet NFR-RESP at 375 / 768 / 1280 with the per-screen behaviour of §10: no page-level horizontal scroll; wide tables scroll inside their cards (NFR-RESP-05 b); S8 switches to cards below 640px; S11 keeps its fixed layout. | 1.3.1, 1.3.7 | 41.1, 41.2, 41.3 |
| FR-M18-113 | Every count and list on S1–S33 SHALL be computed per request from the owners' datasets through the named queries of §6.8 or read from the M18-owned aggregates (DATA-M18-03/04); no stored copy of an owner count. | 2.1.2, 2.1.5, 3.1.2, 5.1.2 | 07.2, 21.1, 36.1 |

### 3.1 Traceability (US → FR → E2E)

| US | FR | E2E |
|---|---|---|
| US-M18-01 | 01, 02 | 01, 02, 03, 04 |
| US-M18-02 | 03, 04 | 05, 06 |
| US-M18-03 | 05, 06, 78 | 07, 08, 09, 10 |
| US-M18-04 | 07, 08, 09, 10 | 11, 12, 13, 14 |
| US-M18-05 | 11, 12 | 08, 15, 16 |
| US-M18-06 | 14, 15, 16, 17, 18, 19 | 17, 18, 19, 20, 21 |
| US-M18-07 | 13, 20, 21, 22, 23, 113 | 22, 23, 24 |
| US-M18-08 | 24, 25 | 25, 26 |
| US-M18-09 | 26, 27, 28 | 27, 28, 29 |
| US-M18-10 | 29, 30 | 30, 31, 32 |
| US-M18-11 | 31, 32 | 33, 34 |
| US-M18-12 | 33, 34 | 35, 36 |
| US-M18-13 | 35 | 37, 38 |
| US-M18-14 | 36, 37, 38, 39 | 39, 40, 41, 42 |
| US-M18-15 | 40, 41 | 43, 44 |
| US-M18-16 | 42, 43, 44 | 45, 46, 47 |
| US-M18-17 | 45, 46, 47, 48 | 48, 49, 50, 51 |
| US-M18-18 | 49, 50, 51, 52 | 52, 53, 54 |
| US-M18-19 | 53, 54, 55, 56, 57 | 55, 56, 57, 58, 59 |
| US-M18-20 | 58, 59, 60 | 60, 61, 62 |
| US-M18-21 | 61, 62, 63, 113 | 63, 64, 65 |
| US-M18-22 | 64, 65, 66 | 66, 67, 68 |
| US-M18-23 | 67, 68, 69, 70, 71 | 69, 70, 71, 72 |
| US-M18-24 | 72, 73 | 73, 74 |
| US-M18-25 | 74 | 75 |
| US-M18-26 | 75, 76, 77 | 76, 77 |
| US-M18-27 | 77, 78, 79 | 78, 79, 80 |
| US-M18-28 | 80 | 81 |
| US-M18-29 | 81 | 82 |
| US-M18-30 | 82 | 83 |
| US-M18-31 | 83, 84 | 84, 85 |
| US-M18-32 | 85, 86, 87, 88 | 86, 87, 88 |
| US-M18-33 | 89, 90 | 89, 90 |
| US-M18-34 | 91, 92 | 91, 92 |
| US-M18-35 | 93, 94, 95, 96 | 93, 94, 95, 96, 97 |
| US-M18-36 | 97, 98, 99, 100, 113 | 98, 99 |
| US-M18-37 | 101, 102, 103 | 100, 101 |
| US-M18-38 | 104, 105, 106, 107 | 102, 103, 104, 109 |
| US-M18-39 | 108, 111 | 105 |
| US-M18-40 | 109, 110, 111 | 106, 107 |
| US-M18-41 | 112 | 108 |

---

## 4. Business rules

| ID | Rule | Source |
|---|---|---|
| BR-M18-01 | **Scope.** `ppd_officer` → district = `ppdDistrict`, state = `ppdState` (canonical 9: "PPD HULU LANGAT", "Selangor"); `jpn_officer` → state = `ppdState` (canonical 10: "Selangor"); teacher → own classes (M10) and their pupils; school admin → own school; admin → DATA-M18-05. A school is in a district scope when `School.district = district AND School.state = state`; in a state scope when `School.state = state`. JPN pages accept a PPD of the officer's state (S14). | INFERRED (officers) / OBSERVED (admin) |
| BR-M18-02 | **Fixture exclusion.** Schools 900001–900099 (M02) and their users are excluded from every M18 aggregate, list, select and export (as M11 BR-M11-34, M17); their own drill-down URLs render. | INFERRED (D11 consistency) |
| BR-M18-03 | **Schools.** Q-M18-SCH(scope, all) counts every school of the scope incl. inactive ("termasuk inactive": S1, S10, S20, S25, S26); Q-M18-SCH(scope, active) counts `isActive` schools (S5–S8 lists, S11). PPD KLUANG 118 / 116; Johor 1,189 / 1,187; PPD BATANG PADANG 122; Perak 1,102. | OBSERVED (R1, R2) |
| BR-M18-04 | **Pupils.** Q-M18-STU(scope[, activeOnly]) = users with role `student` whose `schoolId` is a school of the scope (all schools, or active schools for S5, S7, S8, S11); includes inactive users ("termasuk belum aktif"). PPD KLUANG 135 / 72. | OBSERVED (R2) |
| BR-M18-05 | **Answers and accuracy.** Q-M18-ANS(scope[, subjectId][, grade]) = M05 answer-log rows of the scope's pupils joined to an M04 question (orphan rows excluded, §6.9 C9); answers, correct, distinct pupils, distinct questions, wrong = answers − correct; accuracy = correct ÷ answers × 100 (1 decimal); 0 answers → "—" (tables) or "0.0%" (district rows). | OBSERVED (R3) |
| BR-M18-06 | **Subject cards (S1, S10, S25, S26).** One card per subject with answers in scope: name, accuracy, "{distinct pupils} pelajar", "{distinct questions} soalan", "{wrong answers} salah"; order accuracy ascending, ties by subject id. | OBSERVED (R3i) |
| BR-M18-07 | **GPS.** M08 BR-M08-01/03 over the graded headcount entries of the scope's pupils (Q-M18-GPS); grade chip = grade at round(GPS) half up (2.49 → "A-"); "—" without entries. | OBSERVED (R7e) |
| BR-M18-08 | **Headcount coverage.** "Coverage Headcount" = distinct pupils of the scope with ≥ 1 graded mark (64), percentage of Q-M18-STU; "Funnel: {n} dlm Headcount" = distinct pupils in ≥ 1 headcount config of the scope (65) (M08 definitions, XR-M18-06). | OBSERVED |
| BR-M18-09 | **Kombo (Q-M18-KOMBO).** Over the M14 streaks of the scope's pupils: "Kombo Aktif" = `current` > 0; "Purata Kombo" = mean `current` of those, except the six schools of DATA-M18-06 whose observed school means are documented display values (DV-M18-44); district / state means = Σ(kombo-active × school mean) ÷ Σ kombo-active over the school values (1 decimal, ".0" dropped at district / state level); "Kombo Tertinggi" = max `current`; "Pelajar Aktif Kombo" = Kombo Aktif; "Berlatih Hari Ini" / "Aktif Hari Ini" = pupils with ≥ 1 answer today (M05). School tables by Kombo Aktif descending, then school id; class tables by "Purata Kombo" descending (school's pupils in the class). | OBSERVED (R6) |
| BR-M18-10 | **Mastery (Q-M18-MASTERY).** Records = M05 SubjectMastery rows of the scope's pupils with a ladder level (0 "Pemula", 1 "Mula Belajar", 2 "Aktif", 3 "Tekun", 4 "Mahir", 5 "Pakar Muda", 6 "Cemerlang", 7 "Master", 8 "Grandmaster", 9 "Legend", 10 "Mythical"; level from the M05/M14 mastery stage); tile % = records of the level ÷ all records (DV-M18-15); school "Purata Tahap" = mean level (1 decimal) + name of round(mean) ("1.2 Mula Belajar", "0.0 Pemula"). | OBSERVED (R5) |
| BR-M18-11 | **Composite score.** Skor = 0.4 × "% Aktif" + 0.3 × "Ketepatan" + 0.3 × min(100, Soalan/Pelajar ÷ 5), 1 decimal; "% Aktif" = pupils with practice in the last 30 days ÷ pupils; "Ketepatan" = Q-M18-ACCSTU (mean of pupil accuracies, 0 when "—"); Soalan/Pelajar = lifetime answers ÷ pupils on S5 ("(10.6/pelajar)") and last-30-day answers ÷ pupils on S8 ("—" when 0). A school without pupils scores 0. Order: score descending, then name. | OBSERVED (R4) / INFERRED (normalisation) |
| BR-M18-12 | **Trend (S8).** Correct answers in the last 30 days vs the 30 days before: greater → "Meningkat" (`fa-arrow-up` green), smaller → "Menurun" (`fa-arrow-down` red), equal and > 0 → "Stabil" (`fa-minus`), both 0 → empty. | SOURCE-DERIVED (titles) / INFERRED |
| BR-M18-13 | **Risk score.** score = 0.4 × A + 0.3 × E + 0.3 × M, 1 decimal, where A = 100 − (mean practice-session accuracy), or 100 when the pupil has no session but a `lastActiveAt` or ≥ 1 mastery record, or 50 when the pupil has no session, no `lastActiveAt` and no mastery record (the "never active" case, texts "Tiada data latihan" / "Tiada aktiviti" / "Tiada data penguasaan"; otherwise a missing value reads "Tiada data"); E = min(100, days since `lastActiveAt` × 100 ÷ 30), 100 when null ("Tiada aktiviti"); M = (10 − mean mastery level) × 10, 100 without mastery records. `lastActiveAt` is the stored activity date of §6.2 (v1.7, two-field model), **not** `lastLoginAt`. Evaluated at the project clock (2026-09-25T15:40): the class-1156 pupil scores 44.7 there (observed 45.7 on 26 Sep, one day later). | INFERRED — fits every observed score incl. the 8765 pupil with mastery L1, no session and "Tiada aktiviti" → 97 (R8a–R8e, R17) |
| BR-M18-14 | **Risk status.** Hijau "On Track" score < 40; Kuning "Perlu Perhatian" 40–59.9 (row `bg-yellow-50`); Merah "Berisiko Tinggi" ≥ 60 (row `bg-red-50`). Tiles and bars count pupils per status; percentages integer ("0%", "100%"). | OBSERVED (labels) / PROPOSED (cut-offs) |
| BR-M18-15 | **Risk split (S1 KPI).** Of the Merah pupils: "belum mula latih" = pupils with no session, no `lastActiveAt` and no mastery record (the score-80 case); "akademik berisiko" = the rest (PPD KLUANG **86 / 49**, as live: 49 = 8880 42 + 8767 2 + 8772 2 + 2700 2 + 8765 1 score-80 pupils). | OBSERVED (figures) / INFERRED (rule) |
| BR-M18-16 | **Subject weakness.** School / district / state / S23 scope: one row per DATA-M18-04 CorrectionSubject row of the scope's schools, m = its `pupils`, w = its stored `pupilsWeak` (the audit top-up shows the counts equal the correction aggregate exactly, not the sessions: 8765 MT 6/6 although only 2 pupils have sessions); order as stored. Class scope (S17): the six core subjects, m = class members, w = members whose mean session accuracy in the subject is < 50% (PROPOSED). Shown "{w}/{m} pelajar lemah ({p}%)" (S23 "{w}/{m} lemah ({p}%)"). | OBSERVED (school rows) / PROPOSED (class rule) |
| BR-M18-17 | **Effectiveness.** Over DATA-M18-01 rows of the scope (district: schools of the district; school: the school; `school_id` filter): Jumlah = rows; Berkesan = `berkesan`; dinilai = rows ≠ `belum_dinilai`; Kadar Berkesan = round(berkesan ÷ dinilai × 100) or 0 when dinilai = 0 ("0/0 dinilai"); Perlu Tindakan = `sederhana` + `tidak_berkesan`; Belum Dinilai = `belum_dinilai`; by type ("{n} kali"), by teacher (Kadar "—" when dinilai = 0), by school; trend = rows per month of `interventionDate` for the current month and the 5 before; follow-up list = rows `belum_dinilai` (and `sederhana` / `tidak_berkesan`, INFERRED) newest first. | OBSERVED / INFERRED |
| BR-M18-18 | **Intervention writes.** Create / update / delete allowed to the pupil's teachers (M10), the school admin of the pupil's school, officers whose scope holds the pupil's school, and the admin (INFERRED, Q-M18-8); `teacherId` = the writer; defaults type `kaunseling`, date today, status `done`, effectiveness `belum_dinilai`; delete is hard (INFERRED). | INFERRED |
| BR-M18-19 | **School × subject accuracy (S6 cells, S5 / S8 "Ketepatan").** Base = a **separate stored per-pupil × subject accuracy set** (`correct ÷ answered` per pupil and subject; owner M05, INFERRED; not the SubjectMastery level rows; XR-M18-03) — neither the answer log (8765 BM single pupil 83.7% vs cell 60.3%) nor the practice sessions (8765 pupils 64% / 82.6% → 73.3 ≠ 73.1; 2700's 28.6% session appears nowhere). Cell = mean over the school's pupils holding a row in the subject; "0%" = rows with 0 correct; "—" = no row. S5 / S8 all-subject "Ketepatan" = mean over the school's pupils of their pooled row accuracy; with `subject_id` = the cell value. **Display differs by screen (both replicated):** S5 / S8 show "—" for a value of 0 or no row (2700: "—" in every subject), while the S6 heat map shows "0%" for rows with 0 correct (2700 BM / MT / SEJ) and "—" only without a row. Heat map rows = active schools alphabetically; colour > 70 Cemerlang (green), 41–70 Sederhana (amber), ≤ 40 Lemah (red); row "Purata" = mean of the row's cells > 0; footer = mean per subject over schools with a cell > 0. | OBSERVED / INFERRED (definition) |
| BR-M18-20 | **National ranking (DATA-M18-03).** A daily job snapshots, per period today / 7days / 30days, every school with ≥ 1 answer in the window: pupils with answers, correct, answers; top 50 by correct descending (ties answers descending, then id); PPD rows = sums of their schools; "PPD Aktif" / "Sekolah Aktif" = rows. Seeded with the observed 2026-09-26 rows. | OBSERVED ("Data ranking dikemas kini setiap hari") |
| BR-M18-21 | **Usage.** S3 counts live (Q-M18-USAGE over M05 in the period window); S12 / S14 read the daily usage snapshot (DATA-M18-03 usage part); empty → the empty card. | OBSERVED |
| BR-M18-22 | **Orders.** S1 GPS: schools with GPS by GPS ascending, then the rest by id; school risk tables (S1, S10, S18, S19, S23): average risk score descending, ties by school id (INFERRED; the observed S1 order is reproduced by the seeded risk inputs); S10 district table: by name (as live); S25: accuracy descending; S26: accuracy descending, ties by the M02 PPD id (INFERRED; observed tie order BATU PAHAT, JOHOR BAHRU, PASIR GUDANG, KULAI, KOTA TINGGI, MERSING, MUAR, PONTIAN, SEGAMAT, TANGKAK — XR-M18-01 keeps these PPD ids in that order); S16: class id descending; pupil risk lists: score descending, ties school, class, name. | OBSERVED / INFERRED (ties) |
| BR-M18-23 | **School usage (S9/S15, S27).** "Sudah Guna" = pupils with ≥ 1 completed practice session (M05 practice modes); "Belum Guna" = the rest; "% Penggunaan" = Sudah ÷ Jumlah (1 decimal); "Aktif 7 Hari" = pupils with a session in 7 days; "Purata Sesi / Pelajar" = sessions ÷ Sudah Guna (1 decimal, ".0" dropped); pupil status "Belum Guna" / "Tidak Aktif" (sessions, none in 7 days) / "Aktif"; pupil "Accuracy" = mean session accuracy; S27 "Sesi Latihan" / "Soalan Dijawab" = sessions / Σ `questionCount`; "Purata Ketepatan" = mean session accuracy (session-weighted); owned classes = M10 classes with `schoolId` = the school; S27 "Kelas" = distinct classes of the school's teachers. | OBSERVED (R7b–R7d, R13a) |
| BR-M18-24 | **Calendar (S9/S15, S29/S33).** 365 cells from (today − 364) to today; per day: distinct pupils with answers and correct answers (answer log); "Hari Aktif" = days with ≥ 1 answer; "Jumlah Betul" = Σ correct; "Purata/Hari" = round(Jumlah Betul ÷ Hari Aktif); colour steps by the day's correct count relative to the school's maximum (5 steps, INFERRED). | OBSERVED (R3c) |
| BR-M18-25 | **Correction aggregate (DATA-M18-04).** Monthly per school: pupils who made corrections; per school × subject: pelajar, soalan, accuracy, accuracy before / after corrections, average level. S1/S10 "Pembetulan" reads the current month; "Kadar Purata" = pupils with corrections ÷ pupils (1 decimal); S9/S15 "Laporan Subjek" reads the latest rows. | OBSERVED |
| BR-M18-26 | **Critical / most-wrong questions (S25, S26, S30).** The list is a **stored per-question statistics set** of the scope (not every answered question: 8765 answered 205 distinct questions and lists 6; 2710 has 119 answers and lists none) — single base and single owner: **M08 item statistics** (INFERRED per D12 — M08 owns school item analysis and its BR-M08-18 cut-offs label the cards; XR-M18-19); seeded as observed anchors (KLUANG 20, 8880 20, 8765 6, 2710 0, every other school 0). Order: % wrong descending, ties by question id (INFERRED); at most 20. The level filter (`tingkatan`, class-based) keeps the question set and recomputes attempts, % wrong and the denominators (8765: 21 all, 14 T4, 7 T5). Label and icon from % wrong in the current view with the M08 BR-M08-18 cut-offs (index = % wrong ÷ 100): > 70% "Sukar" `fa-frown`, 30–70% "Sederhana" `fa-meh`, ≤ 30% "Mudah" `fa-smile` (observed 100.0 / 84.6 → Sukar, 50.0 → Sederhana, 0.0 → Mudah; cut-offs INFERRED); "Profil Kesukaran" counts the listed cards by label; "{p}% terlibat" = pupils who attempted ÷ scope pupils (1 decimal); "Pelajar salah" = pupils with ≥ 1 wrong attempt; S30 adds the correct option and the most-chosen wrong option ("{n}x dipilih"; omitted with 0 wrong). | OBSERVED / INFERRED (set, ties, cut-offs) |
| BR-M18-27 | **IC privacy.** Pupil lists return `icMasked` only (mask = the live format "xxxxxx-xx-xx" + the last 2 digits, literal "x" — OBSERVED in the S9 DOM, audit AUD-M18-02; the full IC never travels in a list); the reveal endpoint returns the full ICs of the requested pupils after the confirm and writes one DATA-M18-02 row; full ICs are never cached in the page after "Sembunyikan IC". | DV-M18-13 |
| BR-M18-28 | **Command Center live data (S11; S2 officer).** Scope = the state (district for S2); active schools only (BR-M18-03): `totalSchools` = active schools; `totalStudents` = their pupils; `activeStudents` = those with ≥ 1 answer ever; `totalAnsweredRaw` = their answers; `accuracy`; `answeredToday`, `answeredWeek` (Monday 00:00 MYT → now), `answeredLastWeek`, `weekChange` = round((week − last) ÷ last × 100) or 0; `topSchools` = up to 5 schools by active pupils; `topStudents` = up to 5 pupils by answers this week; `recentFeed` = up to 10 latest answers; `districts` = per PPD: schools, pupils, active; AI sentence per the template ("stabil" when `weekChange` = 0; "{s}/{t} sekolah aktif" = schools with ≥ 1 active pupil / `totalSchools`; engagement share = active ÷ total). | SOURCE-DERIVED / INFERRED |
| BR-M18-29 | **Times.** Every displayed time is Asia/Kuala_Lumpur (DV-M18-07); "Dijana" = the request time. | DV-M18-07 |
| BR-M18-30 | **Periods.** `today` = 00:00 MYT → now; `7days` = the last 7 × 24 h; `30days` = the last 30 × 24 h (default; missing / unknown values → 30days). | OBSERVED / INFERRED (window edges) |
| BR-M18-31 | **"Kembali" (S23, S24).** Navigate to the previous in-app route when the app has one in its history; otherwise S23 → `/amaran/ppd` (district), `/amaran/jpn` (state), `/amaran/sekolah/{id}` (school); S24 → `/amaran`. | DV-M18-21 |
| BR-M18-32 | **S27 school scoping.** Level cards: classes of the school's teachers by level (k), the school's pupils in them (m), their completed practice sessions (s) and mean session accuracy (p); teacher cards: the teacher's classes and the school's pupils in them; "Ketepatan" = mean session accuracy of those pupils; "On Track / Below" = M08 headcount pairs of those pupils. | DV-M18-32 |
| BR-M18-33 | **Jumlah Hari.** The stored per-pupil counter `totalDays` of the M14 streak store (requested, XR-M18-18); not derived from the answer log (2710: 13 and 4 vs 3 calendar days). Seed: 2710 13 and 4, every other observed row 0. | OBSERVED (DV-M18-41 rejected) |
| BR-M18-34 | **Pupil activity dates.** Risk "Terakhir aktif" = date (MYT, "yyyy-mm-dd") of the stored `lastActiveAt` (§6.1a; not `lastLoginAt`), "Tiada aktiviti" when null; S9 "Terakhir Aktif" = date of the last completed practice session ("dd/mm/yyyy"), "Tiada rekod" when none. | OBSERVED (two definitions) |

---

## 5. Validation rules

| ID | Where | Rule | Message |
|---|---|---|---|
| V-M18-01 | S24 create (#26) | `type` ∈ {kaunseling, kelas_tambahan, tugasan_khas, hubungi_ibubapa, mentor_rakan, bimbingan, lain} required; `interventionDate` valid date required; `classroomId` null or one of the pupil's classes; `status` ∈ {done, planned}; `notes` required, ≤ 2,000 characters (PROPOSED limit); `followUp` ≤ 2,000 | Client: native `required` bubbles (as live). Server: 422 `VALIDATION_ERROR` with `fields` (INFERRED; no live copy — the form is re-rendered without a message) |
| V-M18-02 | S24 evaluate (#27) | `effectiveness` ∈ {belum_dinilai, berkesan, sederhana, tidak_berkesan} | 422 (no UI copy) |
| V-M18-03 | S24 follow-up (#27) | `followUp` ≤ 2,000 characters; empty allowed (clears) | 422 (no UI copy) |
| V-M18-04 | Query parameters | `period` ∈ {today, 7days, 30days} else 30days; `subject_id` integer of an M03 subject else ignored (S5/S8 keep "Kosongkan"); `grade` ∈ the school's levels else ignored; `class_id` an owned class else ignored; `tingkatan` ∈ {T4, T5} else all; `scope` ∈ {district, state, school} else the viewer's district; `school_id` in scope else 403 | none (silent fallback, as live) |
| V-M18-05 | Path ids | `{id}` / `{studentId}` integer and existing, `{PPD}` an existing district name of the scope's state; else 404 (DV-M18-25/26/27) | M01 404 page |
| V-M18-06 | IC reveal (#12) | body `{studentIds: int[]}` ≤ 500 ids, each a pupil of the school in the URL | 403 / 422 |

---

## 6. Data entities & fields

*(solution-architect)* JSON fields are camelCase; ids are integers (M01/M02 policy) except the M05 session ids. M18 stores only what the live system itself stores for M18 (interventions, the IC-reveal audit, two aggregates produced by live jobs) and one constant table; every other figure is a named query over the owners' datasets (§6.8), read through the owners' repositories (architecture §6.7). No M18 schema duplicates an owner store (D12).

### 6.1 Referenced entities (owners; not redefined — D12)

| Entity | Owner | Fields M18 reads |
|---|---|---|
| User | M01 DATA-M01-01 / M02 DATA-M02-01 | `id`, `name`, `role`, `grade` (1–11: Darjah 1–6 = 1–6, Tingkatan 1–5 = 7–11), `schoolId`, `isActive`, `icNumber` (fictitious in seeds), `ppdState`, `ppdDistrict`, `lastActiveAt` (§6.1a; requested XR-M18-21). M18 does **not** read `lastLoginAt` (login states belong to M01 / M11 / M17). |
| School | M02 DATA-M02-03 | `id`, `name`, `code`, `type`, `state`, `district`, `isActive` |
| Jpn / Ppd | M02 DATA-M02-04/05 | state and district names (S10 select, S14 validation) |
| Subject, EducationLevel | M03 | `id`, `name`, short code (BM, BI, MATH, CHEM, PHY, ADDMATH, SK, SEJ, BIO, PERNIAGA, GEO), core flag ("(Teras)" options) |
| Question | M04 (`questions.get`) | stem, options, `correctAnswer`, `subjectId`, topic / sub-topic labels, `difficulty` |
| QuizAnswer | M05 DATA-M05-02 | `userId`, `questionId`, `subjectId`, `selectedOptionId`, `isCorrect`, `answeredAt`, `sessionId` |
| PracticeSession | M05 DATA-M05-01 | `userId`, `mode`, `subjectId`, `status`, `completedAt`, `questionCount`, `correctCount` |
| SubjectMastery | M05 DATA-M05-11 | `userId`, `subjectId`, `correct`, `answered` → ladder level (M05/M14 stage mapping) |
| Headcount config / entry | M08 | pupil, subject, config, OTR target, AR grade (GPS BR-M08-01…04) |
| Classroom / Enrolment | M10 DATA-M10-01/02 | `id`, `name`, `subjectId`, level, `schoolId` (owning school), `teacherId`, active members |
| Streak | M14 DATA-M14-08 | `userId`, `current`, `best`, `lastActivityDate` |

### 6.1a `User.lastActiveAt` — stored activity date (two-field model, v1.7; owner M02 users / M01 account, D12)

Live keeps two independent per-user dates: the **activity date** behind the Amaran risk rows ("Terakhir aktif" / "Tiada aktiviti") and the **login date** behind M11 / M17 login states ("Login Terakhir", "Pernah Login", "Belum login"). Neither can be derived from the other: at 7780 four T4/T5 pupils carry activity dates 2026-02-26 … 28 while M11 shows them "Belum login"; at 8880 M11 shows 45 of the 53 register pupils with a login ("Belum login" 8) while S22 / S28 show 27 register pupils "Tiada aktiviti". Reading each screen from its own field reproduces every observed value (0 visible changes).

| Aspect | Definition |
|---|---|
| Name / type | `lastActiveAt`: ISO datetime (MYT offset) or `null`, on the M02 / M01 User record; one value per user |
| Source | a **stored** value (OBSERVED on S22 / S28 / S18 / S19 / S17 as a date). Its live update trigger is not observable, and it is **not** computed from other stores: not from the answer log (class 516 answered 6,563 times, activity null), not from the latest practice session (8765's 64% pupil: last session 07/04/2026, activity 2026-02-27) and not from `lastLoginAt` (7780, 8880 above). In the prototype it is **seeded** (XR-M18-21) and read-only at runtime (PROPOSED: no writer until the backend phase) |
| Nullability | nullable; `null` = no activity recorded → "Tiada aktiviti", E = 100, and (with no session and no mastery record) the "never active" score 80 |
| Without answers | a non-null value does not imply answers or sessions: login-only pupils with 0 answers show a date and score 100 ("Tiada data"); pupils with answers can be `null` (class 516) |
| Readers in M18 | BR-M18-13 (E and the A branch), BR-M18-15, BR-M18-34, the risk rows of S1 / S10 / S16–S19 / S22 / S23 / S28 and the CSVs #29–#31. No M18 figure reads `lastLoginAt` |
| Default for users not observed by M18 | `lastActiveAt` = `lastLoginAt` (the same instant, or `null` when `lastLoginAt` is null) — applies to generated and runtime users and officer scopes; no observed M18 figure depends on it (every M18-visible pupil is listed in XR-M18-21) |

### 6.2 DATA-M18-01 — AmaranIntervention (owned by M18; repository `amaranInterventions`)

Named `AmaranIntervention` to keep it apart from M12's `KirkpatrickIntervention` (XL3-33): the two live tables differ in content and are never merged.

| Field | Type | Req | Notes |
|---|---|---|---|
| id | int | yes | seeded live ids 2, 3; runtime from 1,000 |
| studentId | int → User | yes | the pupil (live `student_id`) |
| teacherId | int → User | yes | the writer (S20 "Statistik Guru") |
| schoolId | int → School | yes | the pupil's school at creation (scope filter) |
| classroomId | int → Classroom \| null | no | one of the pupil's classes (DV-M18-23) |
| type | enum `kaunseling\|kelas_tambahan\|tugasan_khas\|hubungi_ibubapa\|mentor_rakan\|bimbingan\|lain` | yes | labels URS FN-M18-4.10.2 |
| interventionDate | date | yes | default today |
| status | enum `done\|planned` | yes | "Selesai" / "Dirancang" |
| notes | string ≤ 2,000 | yes | escaped on output (SEC-M18-04) |
| followUp | string ≤ 2,000 \| null | no | |
| effectiveness | enum `belum_dinilai\|berkesan\|sederhana\|tidak_berkesan` | yes | default `belum_dinilai` |
| createdAt, updatedAt | datetime | yes | |

### 6.3 DATA-M18-02 — IcRevealAudit (owned by M18)

`{id, viewerId, schoolId, studentIds: int[], route, revealedAt}` — one row per accepted "Tunjuk IC Penuh" (BR-M18-27); read by the backend audit (no M18 screen shows it; the E2E reads it through the test hook).

### 6.4 DATA-M18-03 — Ranking and usage snapshot (owned by M18; output of the live daily job)

`RankingSnapshot {generatedAt, period: 'today'|'7days'|'30days', rows: [{schoolId, pupils, correct, answered}]}` — national, per period. `UsageSnapshot {generatedAt, state, district|null, rows: [{schoolId, pupils, correct, answered}]}`. Live states "Data ranking dikemas kini setiap hari" (S12, S14, S9 ranking), so these figures are a stored daily aggregate, not a live count. The seeded snapshot is an **M18-owned stored aggregate** (documented display data of M18, not a copy of an owner total): `generatedAt` **2026-09-25T15:30:00+08:00** (≤ the project clock; PROPOSED job time), rows = the values observed on 26 Sep 12:36 (§6.11 E). They are not recomputed from M05 in the default seed; the differences to the M05 / M11 counts at the clock are listed in §6.9 C11. A mock daily job (`mock.runDailyJobs()`) can rebuild them from M05 for tests that need it (never in the admin-mirror checks).

### 6.5 DATA-M18-04 — Correction aggregate (owned by M18; output of live `correction:backfill`)

`CorrectionMonthly {schoolId, month 'YYYY-MM', pupilsCorrected}` and `CorrectionSubject {schoolId, subjectId, pupils, pupilsWeak, questions|null, accuracy|null, accuracyBefore|null, accuracyAfter|null, avgLevel|null}` (`pupilsWeak` feeds the subject-weakness block, BR-M18-16). Seeds: no `CorrectionMonthly` row for 2026-09 (S1/S10 notice, "0 pelajar (0%)"); the observed `CorrectionSubject` rows of 8880 and 8765 (§6.11 G). Test-only profile `corrections-sep` adds one 2026-09 row (AC-M18-10.3).

### 6.6b DATA-M18-07 — Session figures kept as documented display values (D11 exception; XL3 R2-02, v1.5)

| School | Figure (observed) | Shown on |
|---|---|---|
| 8765 | 21 completed practice sessions, 309 questions, 242 correct; 2 pupils: 4 · 60 · 64% (last 07/04/2026) and 17 · 249 · 82.6% (last 21/03/2026); months Jan 2026 15 / 9 / 1, Feb 159 / 111 / 2, Mar 125 / 115 / 1, Apr 10 / 7 / 1; "Sudah Guna" 2, "Purata Sesi / Pelajar" 10.5 | S9 / S15 cards, "Statistik Bulanan", pupil rows ("Tidak Aktif"); risk inputs "Purata ketepatan: 64%" / "82.6%" (S22 / S28 / S23, scores 72.2 / 67) |
| 2700 | 1 session, 14 questions, 4 correct, 28.6% (13/02/2026), 1 pupil; month Feb 2026 14 / 4 / 1 | S9 cards, "Statistik Bulanan", pupil row; risk input 28.6% (score 88.6) |

**Why display values:** the sessions fit no M05 store — the answer log holds 222 answers for 8765 (309 > 222) and none for 2700; KirkpatrickSessionAggregate is scoped to T4/T5 pupils and 2700 is a primary school (XL3 R2-02). Every other school's session figures stay computed (Q-M18-SESS on the log). BR-M18-13 / BR-M18-23 read these pupils' values through Q-M18-SESS, so the cards, monthly rows, pupil rows and risk scores of 8765 / 2700 agree with each other.
**Neighbouring figures (checked):** no computed session figure of the same school and scope is shown beside them — every session figure of 8765 / 2700 on S9 / S15 / S22 / S28 / S23 comes from this table. The same pages show answer-log figures of a different metric: the S9 / S15 calendar "Jumlah Betul" (8765 186 over 16 days; 2700 0) and S30's answers (222 / 0). Live shows exactly these pairs on the same pages (8765 monthly Σ 242 correct vs calendar 186), so the rebuild adds no pairing; the two are declared different definitions (sessions vs answer log, like DV-M18-10 for 8880).
**Alternatives considered:** (a) M05 KirkpatrickSessionAggregate rows — infeasible (T4/T5 scope; Delivery Lead, XL3 R2-02); (b) log sessions — infeasible (309 > 222 answers; 2700 has no answer); (c) D9 change of the displayed figures to fit the log (e.g. scale 8765's sessions to ≤ 222 answers, drop 2700's session) — about 15 visible values change on S9 / S15 and the risk scores 72.2 / 67 / 88.6 move, rejected; (d) documented display values — **0 visible changes, chosen**.

### 6.6a DATA-M18-06 — School kombo means kept as documented display values (D11 exception; DV-M18-44)

| School | Displayed "Purata Kombo" | Mean of the rows (M14 §6.11.7 extras at 1) |
|---|---|---|
| 8880 | 6.4 | 6.6 |
| 7780 | 7 | 7.1 |
| 1 | 4.9 | 5.2 |
| 2700 | 6.8 | 7.6 |
| 8767 | 5.3 | 6.2 |
| 8772 | 6.4 | 7.7 |

Used on S1 / S10 kombo rows, S29 / S33 tiles, S23 school kombo and S31 / S32 rows; never beside a computed mean of the same school. Every other school (2710, 3160, 8765, all generated and runtime schools) computes BR-M18-09. District means are computed from these values (KLUANG 7.2, BATANG PADANG "6").

### 6.6 DATA-M18-05 — Admin preview scopes (constants, owned by M18)

| Page family | Scope (observed) |
|---|---|
| PPD analytics S1, S3, S5–S9, S20, S25 | district "PPD KLUANG", state "Johor" |
| JPN S10–S15, S26 | state "Johor" |
| Amaran / Kombo officer S18, S19, S23 (no `scope`), S31, S32 | district "PPD BATANG PADANG", state "Perak" |
| Own-school pages S21 | school 127 "SEKOLAH KEBANGSAAN MERU RAYA" |
| Class pages S16, S24 select | every class of the system (S24 select limited by DV-M18-23) |

### 6.7 Read models (API response shapes; computed, not stored)

`ScopeHeader {kind: 'district'|'state'|'school', district, state, schoolCount, pupilCount}` · `KpiBlock {schoolsAll, pupils, gps: {value, grade}|null, red: {count, pct, academic, notStarted}, accuracy, komboActive, coverage: {withMarks, pct, inHeadcount, inHeadcountPct}}` · `SchoolRow {id, name, code, type, district, state, pupils, ...metrics}` · `RiskTally {green, yellow, red, pct: {green, yellow, red}}` · `PupilRisk {userId, name, levelLabel, classLabel, score, status, accuracyText, engagementText, masteryText}` · `SubjectCard {subjectId, name, accuracy, pupils, questions, wrong}` · `MasteryTiles {records, pupils, levels: [{name, count, pct}]}` · `KomboSummary {active, pupils, avg, max, today}` · `CorrectionSummary {month, label, hasData, pupils, corrected, rate}` · `RankingRow {rank, schoolId, name, district, state, pupils, correct, answered, accuracy}` · `BenchmarkRow {rank, school, pupils, active, activePct, accuracy, answered, perPupil, score, trend}` · `SchoolStats {header, filters, cards, monthly[], calendar: {activeDays, correct, perDay, cells[365]}, subjects[], classes[], pupilsByClass[], teachers[]}` · `LiveData` (§7.1) · `EffectivenessReport {cards, doughnut[4], trend: {labels[6], data[6]}, byType[], byTeacher[], followUps[], bySchool[]}`.

### 6.8 Named queries (every displayed count cites one)

| Query | Base (owner) | Definition | Observed value(s) |
|---|---|---|---|
| Q-M18-SCH(scope, all\|active) | M02 schools | BR-M18-03 (fixtures excluded) | KLUANG 118 / 116; Johor 1,189 / 1,187; per PPD (S10); BATANG PADANG 122; Perak 1,102 |
| Q-M18-STU(scope[, activeSchools]) | M02 users | BR-M18-04 | KLUANG 135 / 72; BATANG PADANG = Perak 33; per school §6.11 B |
| Q-M18-ANS(scope[, subjectId][, level]) | M05 answer log ⋈ M04 | BR-M18-05 | KLUANG 10,535 answers, 7,539 correct (INFERRED 186 + 7,307 + 46), 71.6%; 8880 10,194 / 7,307 / 71.7%; 8765 222 / 186 / 83.8%; 2710 119 / 46 / 38.7%; subject rows §6.11 C |
| Q-M18-ACCSTU(schoolId[, subjectId]) | separate stored per-pupil × subject accuracy set (owner M05, INFERRED; XR-M18-03) | BR-M18-19 | 8765 73.1% overall; BM 60.3, MT 76.3, PI 92.2, SEJ 72.3; "0%" rows 3160 BI, 2700 BM / MT / SEJ, 8767 Sains / SEJ |
| Q-M18-SESS(scope\|schoolId\|userId[, filters][, months]) | M05 completed practice-mode PracticeSessions of the log (8880, 2710, class 1156, every generated and runtime pupil); for the three pupils of 8765 (2) and 2700 (1) whose observed sessions fit no M05 store, the **M18 documented display values of DATA-M18-07** (D11 exception) — each pupil from exactly one source | BR-M18-23 | 8880 60 sessions / 675 questions / 485 correct / 4 pupils; 8765 21 / 309 / 242 / 2 and 2700 1 / 14 / 4 (DATA-M18-07); per pupil §6.11 D |
| Q-M18-DAYS(schoolId, 365 d) | M05 answer log | BR-M18-24 ("Jumlah Hari" is the M14 stored counter, BR-M18-33) | 8880 33 days, 7,307 correct; 8765 16 days, 186 correct |
| Q-M18-GPS(scope) | M08 headcount | BR-M18-07 | KLUANG = Johor = 8880: 2.49 "A-" / 148 entries; platform 3.45 / 744 (M08) |
| Q-M18-HC(scope) | M08 headcount | BR-M18-08 | KLUANG 64 with marks (47.4%), 65 in headcount (48.1%) |
| Q-M18-KOMBO(scope\|schoolId) | M14 streaks + M05 today's answers | BR-M18-09 | KLUANG 81 / 7.2 / today 0; BATANG PADANG = Perak 29 / 6 / max 15; 8880 14 / 6.4 / 13; 7780 15 / 7 / 15; school 1 14 / 4.9 |
| Q-M18-MASTERY(scope\|schoolId) | M05 SubjectMastery | BR-M18-10 | KLUANG 38 records / 12 pupils (14 / 20 / 4); 2710 1.2; 8765 0.7 |
| Q-M18-RISK(scope\|classId\|schoolId) | computed (BR-M18-13) over M05 sessions, M02 / M01 `lastActiveAt` (§6.1a) and M05 mastery at the project clock | score, status, tallies, averages | class 1156 pupil 44.7 (observed 45.7 on 26 Sep); KLUANG 135 red (86 / 49); 8880 average 84.0 (not displayed; lowest in KLUANG); BATANG PADANG 33 red, 97.6 (7780 97.6, school 1 97.5); 8880 59 red; class 1156 one 45.7 |
| Q-M18-WEAK(scope, subject) | computed (BR-M18-16) | "{w}/{m}" | 8880 BM, BI, MT 1/1; class 1156 SEJ 1/1, others 0/1 |
| Q-M18-INT(scope[, schoolId]) | DATA-M18-01 | BR-M18-17 | KLUANG 2 records (8880), 0 evaluated, 2 belum dinilai; types 1 + 1; months Apr 2026 2 |
| Q-M18-RANK(period) | DATA-M18-03 | BR-M18-20 | §6.11 E |
| Q-M18-USAGE(scope, period) | M05 answer log (S3) / DATA-M18-03 usage (S12, S14) | BR-M18-21 | KLUANG 0 / 0 all periods; Johor snapshot empty |
| Q-M18-CORR(scope, month) | DATA-M18-04 | BR-M18-25 | 2026-09: none → notice; 0 corrected |
| Q-M18-CRIT(scope[, tingkatan]) | stored per-question statistics set (INFERRED owner M08 item statistics, XR-M18-19; question texts from M04) | BR-M18-26 | KLUANG = Johor 20 questions (§6.11 H); 8880 20 (BM 13, Sains 6, Sejarah 1) and its T4 variant 20; 8765 6 (Matematik 4, Pendidikan Islam 2; T4 / T5 recomputed); 2710 and every other school 0 |
| Q-M18-LIVE(scope) | M02 + M05 | BR-M18-28 | Johor: 1,187 schools, 72 pupils, 6 active, 222 answers, 83.8%, today 0, week 0; districts per S11 JSON |

### 6.9 Count reconciliation (every observed conflict; checked by `recon.cjs`, 85 checks, 0 failures)

Decision codes (Delivery Lead brief): **(a)** a different definition, expressed as a named query (valid only when the script shows the arithmetic fits); **(b)** a snapshot-time difference; **(c)** a D9 contradiction fixed minimally; **(d)** a documented display constant (D11 exception) — none is used for an owner total.

| # | Conflict (live) | Decision | Arithmetic / evidence (recon id) | Queries / request |
|---|---|---|---|---|
| C1 | Schools PPD KLUANG **118** (S1, S20, S25, S26) / **116** (S5–S8, S11) / **7** (S10 district row) | (a) all vs active; (c) for 7 | S5 ⊂ S1; S1 − S5 = {8880, 2710} = the schools S1 marks among "(termasuk inactive)" (R1a–c); 7 = schools with pupils (R1e) shown only in the KLUANG row while the other rows count all schools → DV-M18-03 | Q-M18-SCH(all\|active); XR-M18-01 (8880, 2710 `isActive = false`) |
| C2 | Pupils **135** (S1, S10, S25, S26) / **72** (S7, S11) / **134** (S10 row) | (a) all schools vs active schools; (c) for 134 | Σ risk rows 135; Σ S5 rows 72; 135 − 72 = 59 + 4 = 8880 + 2710 (R2a–c); 134 contradicts S10's own 135 → 135 (DV-M18-03) | Q-M18-STU; XR-M18-02 |
| C3 | Johor schools **1,189** (S10, S26) / **1,187** (S11) | (a) all vs active | Σ S10 district counts (1,071 + 118) = 1,189; Σ S11 JSON districts = 1,187 with KLUANG 116 (R2f–h) | Q-M18-SCH; XR-M18-01 |
| C4 | Accuracy **71.6%** (S1, S10, S25, S26) / **0.6%** (S5, S7) / **83.8%** (S11) / **73.1%** (S5, S8 for 8765) | (a) for 71.6 / 83.8 / 73.1; (c) for 0.6 | 71.6 = (186 + 7,307 + 46) / 10,535 pooled (R3b–d); 83.8 = 186 / 222 = active-school scope (R3h); 73.1 = mean of 8765's pupils' stored subject-accuracy rows (Q-M18-ACCSTU, a third base; feasible with the anchor rows of §6.11 C, R15); 0.6 = 73.1 ÷ 116 (R3f) → DV-M18-02 | Q-M18-ANS, Q-M18-ACCSTU; XR-M18-03 |
| C5 | Answers **10,535** (S25/S26) / **222** (S7, S11) | (a) all vs active schools | 10,535 − 222 = 10,313 = 10,194 (8880) + 119 (2710) (R3a) | Q-M18-ANS |
| C6 | Johor answers "Soalan Dijawab" **NaN** (S11) | (c) | script reads an absent field; value = 222 (DV-M18-16) | Q-M18-LIVE |
| C7 | 8880 pupils **59** (S1, S9, S27–S30) / **53** (M11) / **256** (S27 levels) / **58** (S9 accordions) | (a) 59 vs 53; (c) 256; (a) 58 | 59 = 53 T4/T5 (M11 register) + 6 lower forms (R14d); 256 = 143 + 113 platform-level class members (R7h) → school-scoped (DV-M18-32); 58 = pupils of the 2 owned classes + "Tiada Kelas": one pupil sits only in a class owned by another school (R7a) | Q-M18-STU; XR-M18-02, XR-M18-08 |
| C8 | 8880 answers **675** (S27) / **10,194** (S25, S30) / 485 correct (S9 monthly) / **7,307** correct (S9 calendar) | (a) sessions vs answer log | 675 = Σ S9 pupil questions 97 + 78 + 490 + 10 = Σ monthly 124 + 551 (R7b); 7,307 / 10,194 = 71.7% = S30 (R3c); T4 pupils have 6,563 answers but no session (R14e) | Q-M18-SESS, Q-M18-ANS, Q-M18-DAYS; XR-M18-05 |
| C9 | 8880 answers **10,194** (M18, 26 Sep 12:36) / **10,196** (M11 S3 and Σ weekly cells, 25 Sep 19:24) | (a) definition: Q-M18-ANS joins M04 questions; M11 Q-ANS-SEG counts all rows | answers cannot decrease with time; with 10,196 the M18 district accuracy would read 71.5% (R3e), so the 2 rows are outside every M18 figure: M05 marks 2 existing 8880 answer rows of week M8 as `orphan` (question no longer in M04), which Q-M18-ANS excludes by its M04 join and M11's Q-ANS-SEG keeps (R14c). INFERRED; if M05 declines, escalate to the Delivery Lead at the XL batch 3 gate (no display constant on an owner total) | Q-M18-ANS; XR-M18-05 |
| C10 | 8765 answers **222** (M18) / **210** (M11 Σ weekly) / 209 (M11 S3) | (a) + placement | 222 − 210 = 12 = M11's "answers before M1" in Johor, which M11 placed on 8880 as `observed:false` — now observed at 8765 (R14a) | XR-M18-04 (M05 / M11) |
| C11 | National ranking "Pelajar" vs M11 period Aktif (8080 7d 6 vs 12, 8082 30d 24 vs 26, 8106 30d 24 vs 23, 7d 13 vs 14; 8078, 8080 30d, 8090, 8284 equal) and "Hari Ini" 8082 1 · 57 · 60 | stored aggregate (M18-owned documented display data; not an owner total) | the ranking is a stored daily snapshot (BR-M18-20, "Data ranking dikemas kini setiap hari"); its rows are the observed record (26 Sep) with `generatedAt` ≤ the project clock. At the project clock the M05 / M11 period counts differ for 8080, 8082, 8106 as listed (R10d); no screen shows both figures side by side (S4/S13 vs M11 S2) | DATA-M18-03 |
| C12 | Composite score **22.6** (S5) / **21.9** (S8) | (a) lifetime vs 30-day Soalan/Pelajar | S8: 0.3 × 73.1 = 21.93 with Soalan/Pelajar "—"; S5: 21.93 + 0.3 × (10.57 ÷ 5) = 22.56 (R4a–c) | BR-M18-11 (normalisation INFERRED) |
| C13 | Mastery **36.8 / 52.6 / 10.5%** (S1) / **116.7 / 166.7 / 33.3%** (S10) | (c) | ÷ 38 records vs ÷ 12 pupils (R5) → DV-M18-15 | Q-M18-MASTERY |
| C14 | GPS 8880 **2.49** / 148 (S1, S27) / **3.45** / 744 (S30) / **2.88** / 150 (M17) | (a) for 3.45 = platform; (c) on S30; M17 figure routed | 369 / 148 = 2.49 (R7e); 2,569 / 744 = 3.45 = the M08 platform grade counts (R7f) → S30 shows the school (DV-M18-39); M17's 2.88 / 150 is an M17 definition (XR-M18-12) | Q-M18-GPS |
| C15 | Kombo table "Pelajar" 0 vs Kombo Aktif 18 … (S1, S10) | (c) | R6c → DV-M18-04 | Q-M18-STU, Q-M18-KOMBO |
| C30 | 8765 sessions 21 / 309 / 242 vs its 222 log answers; 2700 session 14 / 4 vs 0 log answers | (d) documented display values (DATA-M18-07; Delivery Lead, XL3 R2-02) | no M05 store holds them (log too small; KirkpatrickSessionAggregate is T4/T5 only); 0 visible changes vs ≈ 15 if forced into the log (R24) | DATA-M18-07 |
| C29 | School "Purata Kombo" vs the school's own top-10 rows (XR-M14-10): 8880, 7780, 1, 2700, 8767, 8772 below their feasible range | (d) documented display values (DV-M18-44, DATA-M18-06) | R23: feasible ranges from the top-10 rows with extras ≥ 1; 0 visible changes vs ≈ 20 cells if computed | DATA-M18-06; XR-M18-20 |
| C16 | Kombo **81** / avg **7.2**; BATANG PADANG **29** / "6" | (a) | Σ school rows 81, weighted mean 7.194 (R6a–b); 29, 5.986 (R6e) | Q-M18-KOMBO; XR-M18-07 |
| C17 | "Jumlah Hari" 0 vs Kombo 4–15 (S29/S33) | replicate the stored counter (DV-M18-41 rejected, AUD-M18-04) | 2710 shows 13 and 4 with 3 calendar days (R20): a stored counter, not a count of the answer log | BR-M18-33; XR-M18-18 |
| C18 | Subject cards "545 soalan" / "634 salah" (BM) | (a) distinct questions vs wrong answers | implied answers Σ 10,518–10,550 ∋ 10,535 (R3i); S30 ∋ 10,194 (R3j) | BR-M18-06 |
| C19 | Heat-map PI **92.2%** vs district PI card **92.3%**; heat-map BM 60.3 / SEJ 72.3 vs S30 8765 BM 83.7 / SEJ 84.6 | (a) two bases (stored subject-accuracy rows vs answer log) — DV-M18-40 rejected, replicate 92.2 | audit top-up: S30 8765 single BM / SEJ / PI pupils at 83.7 / 84.6 / 92.3 (answer log); sessions give 73.3, not 73.1 (R15b) | Q-M18-ACCSTU, Q-M18-ANS |
| C20 | S10 risk rows sum **181** / S19 and S23 duplicate school | (c) | R9a, R9b → DV-M18-18 | Q-M18-RISK |
| C21 | S10 filter "**479** / **43** sekolah dijumpai" | (c) | 118 × 4 + 7; 10 × 4 + 3 (R9c–d) → DV-M18-14 | client |
| C22 | 8880 classes **2** (S9) / **4** (S29) / **9** (S27) | (a) owned / holding pupils / teachers' classes | R13a: S27 9 = 5 + 4 kelas of the two teacher cards | BR-M18-23; XR-M18-08 |
| C23 | "Sudah Guna" 4 (S9) vs 31 answering pupils (S25) vs 14 kombo-active (S29) — 8880 | (a) | sessions (R7b) / answer log (R14b = M11 Aktif 31) / M14 streak | Q-M18-SESS, Q-M18-ANS, Q-M18-KOMBO |
| C24 | Risk "Terakhir aktif 2026-02-26" (S28) vs S9 "Tiada rekod" for the same pupils | (a) | stored activity date vs last practice session (BR-M18-34) | M02 / M01 `lastActiveAt` (§6.1a) |
| C25 | Risk scores 100 / 97 / 80 / 84.4 / 83.6 / 66.8 / 45.7 (44.7 at the project clock); averages 97.6 / 97.5 | (a) one formula | R8a–e, R17 (BR-M18-13 over `lastActiveAt`) | Q-M18-RISK |
| C31 | Risk activity vs M11 / M17 login states: 7780 — 4 of the 6 T4/T5 pupils "Terakhir aktif: 2026-02-26 … 28" (S22, 26 Sep 12:36; BATANG PADANG 29 dated / 4 "Tiada aktiviti") vs M11 S3 all 6 "Belum login" (25 Sep 19:24); 8880 — 27 register pupils "Tiada aktiviti" (S22 / S28) vs M11 "Belum login" 8, Aktif 31 and "Login sahaja" 14 all with a login | (a) two stored fields (v1.7, two-field model; DV-M18-43 and DV-M18-45 withdrawn) | the same pupils sit on both sides (S22 level lines T4 3 / T5 3 = M11 `tingkatanValues`), so no population filter separates them, and a single date cannot move from null to February overnight (7780) or back to null (8880): the screens read different fields. A login window in M11 is refuted by 8880 (February-dated risk rows vs 45 M11 logins). Risk reads `lastActiveAt`, M11 / M17 read `lastLoginAt` → every observed value holds: 29 / 4, 7780 97.6, school 1 97.5, district 97.6, KLUANG 86 / 49, 8880 84.0 | §6.1a; XR-M18-21; Q-M18-RISK |
| C26 | S12/S14 "0" vs S10 135 | (a) snapshot vs live | DV-M18-28 | Q-M18-USAGE |
| C28 | 8765 S30 `tingkatan` denominators T4 **14** / T5 **7** vs the grade split T4 12 / T5 4 / lower forms 5 (M11 register, S15 grade options) | (a) class-based filter vs grade | the S30 / S28 `tingkatan` filter counts the school's pupils in classes of that level: 17 of 21 pupils are in classes (S22: first-class labels T4 11, T5 6, none 4), T4-class set 14, T5-class set 7, 4 pupils in both (14 + 7 − 4 = 17) (R19); the grade split is a different attribute | FN-M18-4.6.1, 5.3.2 |
| C27 | 8284 7-day = 30-day row | not a conflict | M11 counts 8284 active in 7 days (R10e) | DATA-M18-03 |

### 6.10 Dataset spec — what M18 needs from each owner store (D11; architecture §6.6)

M18 adds **no rows to owner totals**. The admin mirror needs observed anchors placed **inside** the owners' existing cells; the requests are XR-M18-01…17 (§6.14). The build check (architecture §6.6 step 4) asserts every value in the "M18 target" column after the owners apply them.

| Store (owner) | Totals kept | M18 target (observed, 2026-09-26) | Anchors / placement | Feasibility |
|---|---|---|---|---|
| Schools (M02, 10,220) | 10,220 / 10,212 active / 8 inactive; SK 7,779 / SMK 2,441 | Johor **1,189** (11 PPD counts of S10: BATU PAHAT 176, JOHOR BAHRU 146, KLUANG 118, KOTA TINGGI 97, KULAI 73, MERSING 47, MUAR 129, PASIR GUDANG 112, PONTIAN 100, SEGAMAT 110, TANGKAK 81); **Perak 1,102** with PPD BATANG PADANG **122**; PPD KLUANG ids / names / codes; 2 inactive in KLUANG (8880, 2710); Selangor anchors of the ranking (8078, 8080, 8082, 8088, 8090, 8106 = PPD HULU LANGAT; 8284 = PPD SABAK BERNAM); 127 SK MERU RAYA (Perak) | the ids and names of the S10 GPS table (1,189 rows), S31 (122) and S32 (1,102) tables of the snapshot are anchors; the other schools stay generated. PPD assignment of the non-KLUANG Johor schools and the non-BATANG PADANG Perak schools: generated to the observed per-PPD counts (`observed:false`). Fixtures 900001–900003 stay (excluded by BR-M18-02) | Johor + Perak = 2,291 ≤ 10,116 non-Perlis schools; inactive 2 of 8 (8277 is another) ✓ |
| Users (M01/M02, 5,159; students 4,533) | all role and activity facets | pupils per school: 8880 **59**, 8765 **21**, 3160 **12**, 2700 **14**, 2710 **4**, 8772 **12**, 8767 **13**, 7780 **17**, school 1 **16** (Σ 168; the other KLUANG / BATANG PADANG schools 0); levels per §6.11 B; officers 9 / 10 unchanged | the M11 register already holds 53 + 16 + 7 + 8 + 6 = 90 of them (T4/T5); the other **78** are lower-form or primary pupils | **not feasible in M02 v1.11 as is:** its "other students" pool is 72 and already spread over the 23 other filter schools and 8106; school 1 is emptied there for fixture 900002. XR-M18-02 names the source (the T4 class pool, whose members live shows at 7780, school 1 and 3160) and the arithmetic |
| Answer log (M05, 478,499; segment 472,371) | all | KLUANG 10,535 answers / 7,539 correct (8880 10,194 / 7,307; 8765 222 / 186; 2710 119 / 46); per subject §6.11 C; calendar days 8880 33, 8765 16; 38 answering pupils (31 + 6 + 1); Selangor / Perak: as the owners already hold | 8880's 10,196 segment answers (M11 cells) incl. **2 orphan rows** (C9); 8765's 210 + **12 before M1** (C10); 2710's 119 in segment `other` (primary pupil); 12 BM/Sains/Sejarah critical-question anchors per §6.11 H | 119 ≤ 5,795 generated `other` answers ✓; no total changes |
| Practice sessions (M05, 32,122) | all | 8880 **60** completed practice-mode sessions / 675 questions / 485 correct (4 pupils: 8 · 97 · 38.9%, 7 · 78 · 41.1%, 44 · 490 · 83.1%, 1 · 10 · 90%; Feb 124 / 84 by 3 pupils, Mar 551 / 401 by 3 pupils); 8765 **21** / 309 / 242 (2 pupils: 4 · 60 · 64%, 17 · 249 · 82.6%; Jan 15/9, Feb 159/111, Mar 125/115, Apr 10/7); class 1156's pupil with sessions (58.6%) | 8880's segment 10,196 = 675 in the 60 practice-mode sessions + **6,563 answers without a session** (3201–3215, `sessionId` null; M05 v1.10, XL3-21) + **2,956 answers in completed `latih_tubi` sessions** (a non-practice mode, so S9 / S27 do not count them) held only by T5 register pupils of 8880 who are not T4-class members (M08 T4 "Jumlah Sesi" 11 and the "4 Simulasi" row "0" stay unchanged) + 2 orphan answers; 8765's and 2700's session figures are M18 documented display values (DATA-M18-07; they fit neither the log nor M05 KirkpatrickSessionAggregate) | counts inside the existing 32,122 |
| SubjectMastery (M05) | — | KLUANG 38 records of 12 pupils: 14 Pemula, 20 Mula Belajar, 4 Aktif; school means 2710 1.2, 8765 0.7; class 1156 pupil mean 3.95 | 38 anchor rows (XR-M18-03) | stored table, small |
| Headcount (M08) | 744 graded entries platform | 8880: **148** graded entries (A+ 4, A 36, A- 42, B+ 36, B 18, C+ 6, C 4, D 1, E 1, G 0) and the 6 subject rows of S27; KLUANG coverage 64 / 65 | inside M08's 744 (XR-M18-06) | 148 ≤ 744 ✓ |
| Classes (M10, 750) | 750 | 8880 owned classes 516 "4 Simulasi" (T4, 15 of 8880's pupils) and 517 "5 Simulasi" (T5, 15 — an observed anchor that takes the id slot of one generated T5 class in M10's 750, its 15 members being 8880 T5 register pupils already counted among the T5-class members, so M08's T5 card "Murid 3,911" and M10's 750 stay unchanged, XL3-35); classes holding 8880 pupils "5 Sinar" (Fizik), "5 Delima" (Sains); 7780 members in "4 Bestari - BM/SEJ", "4 Dedikasi - BM/SEJ", "4 Cemerlang - BM/SEJ", "5 Bestari - BM/SEJ", "5 Cemerlang - BM/SEJ"; class 1156 "5 CYBER" (Sains Rumah Tangga, 1 pupil) | anchors per XR-M18-08 (M08's designed class-516 pupils 3201–3215 are "no school" in M02 v1.10 — live shows them at 8880; XR-M18-08) | 750 unchanged |
| Streaks (M14) | — | current / best of the kombo-active pupils: KLUANG 81 (per school 18 / 14 / 12 / 12 / 11 / 10 / 4 with the S1 averages); BATANG PADANG 29 (7780 15 avg 7, school 1 14 avg 4.9); top-10 of 8880 and 7780 (§6.11 F) | anchor rows (XR-M18-07) | M14 streak store has no total |

### 6.11 Seed — admin mirror (every value observed; fictitious people)

**A. Schools (public anchors).** PPD KLUANG: the 118 rows (id, name) of snapshot `/ppd/dashboard` "Prestasi GPS" with codes from `/ppd/benchmark-sekolah` (e.g. 8880 JEB2037, 8765 JEA2029, 8953 JHA2001, 3156 JBC2003, 3159 JBC2007); 8880 and 2710 inactive. Johor: the 1,189 rows of `/jpn/dashboard`. PPD BATANG PADANG: the 122 rows of `/kombo/ppd`; Perak: the 1,102 rows of `/kombo/jpn` (ids 1 … 8029; 127 "SEKOLAH KEBANGSAAN MERU RAYA"). Ranking schools: 8082 ENGKU HUSAIN, 8106 BANDAR RINCHING, 8080 KHIR JOHARI, 8078 BANDAR BARU BANGI, 8090 PANDAN INDAH, 8088 JALAN TIGA (PPD HULU LANGAT, Selangor), 8284 SAM MUHAMMADIAH (PPD SABAK BERNAM, Selangor).

**B. Pupils (fictitious, anchors inside the M02 users dataset; names "Murid Demo KL-nnn" / "Murid Demo BP-nnn"; IC numbers fictitious and IC-shaped: `000000-00-0nnn` series, never a real date / place code).**

| School | Pupils | Levels (observed) | Notes |
|---|---|---|---|
| 8880 TINGGI KLUANG | 59 | T4 26 (15 in class 516), T5 27 (15 in class 517), lower 6 (D6 and T1–T3 per S9 options) | 28 in "Tiada Kelas" (S9); 1 in a class of another school; 4 with sessions; 31 with answers; the 15 class-516 pupils are M08 anchors 3201–3215 (XR-M18-08); 3215 = the intervention pupil (live id 2229) |
| 8765 LAYANG-LAYANG | 21 | grades T4 12, T5 4, T1–T3 5; classes: 17 in classes (T4-class 14, T5-class 7, 4 in both), 4 in none (C28) | 6 with answers, 2 with sessions |
| 3160 CHONG HWA I | 12 | primary | — |
| 2700 SERI KENCANA | 14 | primary | — |
| 2710 KAMPONG CHAMEK | 4 | primary | 1 with answers (119 / 46) |
| 8772 TAMAN KLUANG BARAT | 12 | T4 3, T5 4, lower 5 | — |
| 8767 TUN HUSSEIN ONN | 13 | T4 3, T5 5, lower 5 | — |
| 7780 HAMID KHAN | 17 | T4 3, T5 3, T1 4, T2 3, T3 4 (S22 level lines) | 15 score 100, 2 score 80 (as live; the 2 are one T4 and one T5 pupil) |
| 1 TOH TANDEWA SAKTI | 16 | Darjah 1–6 (S22) | 14 score 100, 2 score 80; some in "Tingkatan 4/5" classes (as live) |

Risk inputs (v1.7, two-field model §6.1a — every value as observed; each pupil's `lastActiveAt` is listed in XR-M18-21, its `lastLoginAt` stays as M02 places it for M11 / M17): the 33 BATANG PADANG pupils — **29** with a `lastActiveAt` between 2026-02-26 and 2026-02-28 and no session (score 100: 7780 15, school 1 14) and **4** with `lastActiveAt` null, no session and no mastery (80: 7780 2 — one T4, one T5 — and school 1 2); averages 7780 97.6, school 1 97.5, district 97.6; S18 order HAMID KHAN, TOH TANDEWA SAKTI. 8880 — **42** "Tiada aktiviti" pupils (80: the 15 class-516 pupils 3201–3215, 12 of class 517 and 15 others), 13 activity-only pupils (100; one 2026-05-19, twelve 26–28 Feb), 4 with sessions (84.4, 83.6, 66.8 — class 517 — and the "Tiada Kelas" pupil at 90% → 64); average 84.0, the lowest in PPD KLUANG (S1 / S10 order as observed); S28 T4 = the 15 class-516 pupils × 80, S28 T5 = 84.4, 83.6, twelve 80, 66.8. Other KLUANG schools (top-up): 2710 sessions 21.8%, `lastActiveAt` 2026-05-19, mastery 1.5 → 86.8; 2700 pupil 28.6%, 2026-02-28 → 88.6; 8765 pupils 64% / mastery 0.75 → 72.2 and 82.6%, 2026-03-21 → 67; 8765 activity-only pupils with mastery 0.2 / 0.67 / 1 / 1.5 → 99.4 / 98 / 97 / 95.5, and one 8765 pupil with mastery L1, no session and `lastActiveAt` null → 97 (A = 100 by the mastery branch of BR-M18-13); 8880 "Tiada Kelas" pupil 90% → 64 (R17); class 1156 pupil (live user id **4627**, S17; M02 anchor requested in XR-M18-21, school not observed) — sessions at 58.6%, `lastActiveAt` 2026-09-15, mastery mean 3.95 (44.7 at the project clock; observed 45.7 on 26 Sep). KLUANG score-80 pupils: 8880 42, 8767 2, 8772 2, 2700 2, 8765 1 = **49 "belum mula latih"**, the other **86 "akademik berisiko"** (S1 KPI as live); school averages order the S1 risk table as observed (CHONG HWA I ≥ TUN HUSSEIN ONN ≥ TAMAN KLUANG BARAT ≥ SERI KENCANA ≥ KAMPONG CHAMEK ≥ LAYANG-LAYANG ≥ TINGGI KLUANG); the build asserts both.

**C. Answers per subject (answer log, KLUANG).** Sejarah 31 pupils · 1,154 distinct questions · 649 wrong · 70.7%; Sains 29 · 1,094 · 539 · 70.9%; Bahasa Melayu 32 · 545 · 634 · 71.1%; Bahasa Inggeris 29 · 851 · 539 · 71.9%; Matematik 37 · 828 · 631 · 72.6%; Pendidikan Islam 1 · 50 · 4 · 92.3% (48 / 52). 8880 (S30): Sains 29 · 1,094 · 70.9% · 539; Sejarah 29 · 1,109 · 71.0% · 615; Bahasa Inggeris 29 · 851 · 71.9% · 539; Bahasa Melayu 30 · 507 · 72.0% · 580; Matematik 31 · 817 · 72.4% · 614; T4 15 pupils · 6,563 answers · 76.3% (Sejarah 15 · 854 · 75.7% · 312; BI 15 · 720 · 75.8% · 314; BM 15 · 471 · 76.0% · 327; Sains 15 · 831 · 76.7% · 272; MT 15 · 710 · 77.4% · 328). 8765 (S30, audit top-up): Matematik 6 · 60 · 77.3% · 17; Bahasa Melayu 1 · 43 · 83.7% · 7; Sejarah 1 · 52 · 84.6% · 8; Pendidikan Islam 1 · 50 · 92.3% · 4 (Σ wrong 36 = 222 − 186). 2710 (S30): Sejarah 1 · 40 · 35.0% · 26; Bahasa Melayu 1 · 79 · 40.5% · 47. (The v1.0 answer-log split of 8765 is dropped — infeasible, AUD-M18-03.) **Stored per-pupil × subject accuracy rows (Q-M18-ACCSTU anchors, XR-M18-03):** 8765 pupil X BM 35 / 58, SEJ 34 / 47, PI 47 / 51, MT 18 / 22 and pupil Y MT 17 / 24 → cells BM 60.3, SEJ 72.3, PI 92.2, MT 76.3 and overall mean 73.1 (R15); "0%" rows (0 correct, answered > 0): 3160 BI, 2700 BM / MT / SEJ, 8767 Sains / SEJ (one pupil each school). These rows are independent of the answer log (live keeps a separate stored figure).

**D. Sessions.** As §6.10 (8880 from the log; 8765 and 2700 as DATA-M18-07 display values — v1.5, XL3 R2-02; 2710: 4 · 84 · 21.8%, May 84 / 26, log); the three 8880 T5 pupils with sessions are in class 517; the fourth is in "Tiada Kelas" (1 · 10 · 90%, 22/02/2026). Last sessions 17/03/2026, 21/03/2026, 26/03/2026, 22/02/2026 (8880); 07/04/2026, 21/03/2026 (8765).

**E. Ranking snapshot (DATA-M18-03, `generatedAt` 2026-09-25T15:30:00+08:00; rows = the observed record of 2026-09-26 12:36).**

| Period | Rows (school id: pupils · correct · answered) |
|---|---|
| 30days | 8082: 24 · 8,351 · 9,195; 8106: 24 · 5,317 · 6,462; 8080: 18 · 3,710 · 4,271; 8078: 16 · 1,298 · 1,506; 8090: 5 · 726 · 857; 8088: 1 · 15 · 20; 8284: 1 · 3 · 5 |
| 7days | 8080: 6 · 1,365 · 1,584; 8106: 13 · 1,247 · 1,567; 8082: 8 · 1,084 · 1,256; 8078: 6 · 251 · 325; 8090: 2 · 89 · 95; 8088: 1 · 15 · 20; 8284: 1 · 3 · 5 |
| today | 8082: 1 · 57 · 60 |

Usage snapshot: no row for Johor or any Johor PPD.

**F. Streaks (M14 anchors; pupils fictitious).** 8880 top-10 (current / best): 13/16, 13/13, 12/20, 11/16, 8/14, 8/10, 7/16, 6/16, 6/12, 4/8 (14 kombo-active, mean 6.4); 7780 top-10: 15/16, 14/23, 12/18, 12/14, 10/20, 9/18, 8/16, 8/9, 7/15, 7/11 (15 active, mean 7); KLUANG per school (active, mean): 8765 18 / 8.2, 8880 14 / 6.4, 2700 12 / 6.8, 3160 12 / 9.3, 8767 11 / 5.3, 8772 10 / 6.4, 2710 4 / 7.5; school 1 14 / 4.9 (top-10 10/19 … 4/9, "Kombo Tertinggi" 10). **Class memberships and class-kombo rows of every observed school** (S29 tables, audit top-up `schools.{id}.s29.classes`): 8765, 3160, 2700, 8772, 8767, 2710, school 1 and 7780 each use the "4 / 5 Bestari / Cemerlang / Dedikasi - BM / SEJ" classes (M10 anchors 4–10 and the T5 twins); pupils of each school in classes (S22): 8765 17, 3160 9, 2700 10, 8772 8, 8767 8, 2710 2, school 1 9, 7780 8, 8880 30 (classes 516 / 517). 7780 classes (school's pupils · mean · max · active): "4 Bestari - BM" 1 · 8.0 · 8 · 1, "4 Bestari - SEJ" 1 · 8.0 · 8 · 1, "5 Bestari - BM" 2 · 7.0 · 14 · 1, "5 Bestari - SEJ" 2 · 7.0 · 14 · 1, "4 Dedikasi - BM" 5 · 6.2 · 10 · 4, "4 Dedikasi - SEJ" 5 · 6.2 · 10 · 4, "5 Cemerlang - SEJ" 3 · 6.0 · 14 · 3, "5 Cemerlang - BM" 3 · 6.0 · 14 · 3, "4 Cemerlang - SEJ" 3 · 5.3 · 8 · 3, "4 Cemerlang - BM" 3 · 5.3 · 8 · 3.

**G. Correction aggregate (DATA-M18-04).** `pupilsWeak` = `pupils` on every observed row (S22 / S28 weakness blocks). 8880: BM (1 · 26 · 34.6% · 72% / 72%), BI (1 · 8 · 50% · 71.9% / 71.9%), MATH (1 · 5 · 100% · 72.4% / 72.4%). 8765: MATH (6 · 184 · 45.6% · 77.3% / 77.3% · level 0.7), CHEM (5 · 142 · 48.5% · level 1), PHY (5 · 114 · 43.5% · 0.4), ADDMATH (2 · 97 · 48.5% · 1.5), SK Sains Komputer (3 · 71 · 56.8% · 1), SEJ (3 · 68 · 44.1% · 84.6% / 84.6% · 0.7), BIO (3 · 58 · 45.5% · 0.3), PERNIAGA (2 · 52 · 55.4% · 1), GEO (1 · 19 · 47.4%). 2710 (audit top-up, S22 weakness): Bahasa Melayu, Sejarah, Fizik, Geografi, Sains Komputer — each `pupils` 1, `pupilsWeak` 1; `questions`, `accuracy`, before / after and level not observed (null). Grade-T5 variants of 8880 as the snapshot (11.1%, 64.4%, 63.8%, 63.3%). No 2026-09 monthly row.

**H. Critical questions (M04 anchors, text as live; pupils fictitious).** KLUANG top 20 in order: 1 "Prinsip Pascal menyatakan bahawa:" (Sains · Tekanan dalam bendalir · Tekanan dalam bendalir; 2 pelajar, 2 cubaan); 2 "Kesan rumah hijau disebabkan oleh peningkatan gas:" (Sains · Teknologi Hijau untuk Kelestarian Alam Sekitar · Teknologi hijau dan kehidupan; 2, 2); 3 "Katod dalam sel elektrolisis disambungkan kepada terminal:" (Sains · Sel elektrolisis · Minyak sawit; 2, 2); 4 "Asap ekzos kenderaan merupakan sumber utama:" (Sains · Kelestarian Alam Sekitar · Pencemaran alam sekitar; 2, 2); 5 "Awalan "pe-" dalam kata "penulis" bermaksud..." (Bahasa Melayu · Kemahiran Bahasa Tingkatan 4 · Penulisan karangan lanjutan; 4, 4); 6 "Kata "buah tangan" ialah kata..." (BM T4; 3, 3); 7 "Penggandaan penuh dalam kata "kanak-kanak" membawa makna..." (BM T4; 2, 2); 8 "Predikat dalam ayat "Kami pergi ke sekolah setiap pagi" ialah..." (BM T4; 2, 2); 9 "Apakah yang dimaksudkan dengan "maklumat tersurat"?" (BM T4; 2, 2); 10 "Apakah yang dimaksudkan dengan "inferens"?" (BM T4; 3, 3); 11 "Dalam penulisan karangan, perenggan pendahuluan berfungsi untuk..." (BM T4; 3, 3); 12 "Kawasan bandar yang kurang pokok biasanya lebih panas kerana:" (Sains · Teknologi Hijau …; 2, 2); 13 "Dalam sel elektrolisis, kation bergerak ke katod kerana katod bercas:" (Sains · Sel elektrolisis · Minyak sawit; 3, 3); 14 "Ayat dasar bahasa Melayu terdiri daripada..." (BM T4; 2, 2); 15 "Imbuhan "per-" dalam kata "perbesar" membawa maksud..." (BM T4; 2, 2); 16 "Peribahasa "bagai aur dengan tebing" bermaksud..." (BM T4; 2, 2); 17 "Apakah perbezaan "pantun" dengan "syair"?" (BM T4; 2, 2); 18 "Kata adjektif bilangan yang tepat ialah" (Bahasa Melayu · Kemahiran Bahasa Tingkatan 5 · Mendengar, mengenal dan menyebut perkataan, rangkai kata, istilah dan ungkapan serta intonasi ayat dalam pelbagai ujaran.; 2, 2); 19 "Apakah yang dimaksudkan dengan "nada" dalam sesebuah karangan?" (BM T5; 2, 2); 20 "Karangan yang mempunyai kohesi yang baik bermaksud" (BM T5; 2, 2; one pupil of 8765). All "Sukar", "100.0% salah". 8765's S30 list (6 cards, audit top-up `schools.8765.s30.cards`: 1 "Satu garis lurus melalui titik (1, 3) dan (4, 9). Cari kecerunan garis itu." Matematik · Asas Nombor; 2–3, 6 Matematik · Fungsi dan Persamaan Kuadratik; 4–5 Pendidikan Islam) and 2710 (none). 8880's S30 list and its T4 variant: the rows of snapshot `/sekolah/8880/analisa-item` (with the correct and most-chosen wrong options, e.g. card 1 "A" "Tekanan dalam cecair tertutup dipindahkan sama rata ke semua bahagian" / "B" "Tekanan meningkat dengan kedalaman" "(1x dipilih)").

**I. Interventions (DATA-M18-01).** id 2: pupil **3215** (M08 anchor; the live pupil id 2229 is an observation, mapped once here), 8880, teacher = 8880's teacher 1 (fictitious "Guru Demo KL-01"), `kaunseling`, 2026-04-13, `done`, notes "Catatan contoh intervensi (data demo)." (PROPOSED fictitious text; live notes masked), effectiveness `belum_dinilai`; id 3: same pupil / teacher / date, `mentor_rakan`, notes "Catatan contoh intervensi kedua (data demo).", `belum_dinilai`.

**J. Teachers.** 8880: 2 teachers (fictitious "Guru Demo KL-01" with subjects Bahasa Melayu, Fizik and 4 classes incl. 516 / 517; "Guru Demo KL-02" without subjects, 5 classes); 8765: none.

### 6.12 Seed — officer views and test-only fixtures

- **PPD officer (9) and JPN officer (10):** no M18-specific rows. Their pages compute over PPD HULU LANGAT / Selangor from the same datasets (the ranking schools and M11's Selangor register: 8078, 8080, 8082, 8090, 8106, 8277 … as their `district` places them). ACs assert equality with the named queries (provisional).
- **Test-only profiles (never loaded with the admin-mirror checks):** `corrections-sep` (one 2026-09 CorrectionMonthly row at 8880, AC-M18-10.3); `trend` (a school with more correct answers in the last 30 days than the 30 before, AC-M18-17.4); `usage-selangor` (a usage snapshot for Selangor, AC-M18-24.3); `interventions-evaluated` (records in every effectiveness state).

### 6.13 Test hooks (dev / test builds only)

`mock.setUser(id)`, `mock.setClock(iso)` (default = project clock 2026-09-25T15:40:00+08:00; no M18 scenario overrides it), `mock.loadProfile(name)`, `mock.failNext(path)`, `mock.latency(ms)`, `mock.runDailyJobs()`, `mock.audit.icReveals()` (reads DATA-M18-02), `mock.advanceTimers(ms)` (S11 polling).

### 6.14 Cross-module requests (to the owners; D12 — applied in XL batch 3)

| ID | Owner | Request |
|---|---|---|
| XR-M18-01 | M02 | Schools: adopt the observed registers as anchors — Johor 1,189 (11 PPD counts), PPD KLUANG 118 (ids, names, codes), Perak 1,102 with PPD BATANG PADANG 122 (ids, names), 127 SK MERU RAYA, and the ranking schools' districts (HULU LANGAT, SABAK BERNAM); set `isActive = false` for **8880** and **2710** (2 of the 8 inactive) — observed on M02 `/admin/schools` as "Tidak Aktif" with the "Aktifkan" toggle (audit AUD-M18-12). |
| XR-M18-02 | M02 (+ M01) | Users: place the 168 pupils of §6.11 B (78 of them lower-form / primary, outside the M11 register); **school 1 must hold 16 pupils** (M02 v1.11 empties school 1 for fixture 900002 — choose another filter school to empty); source: the **T4 class pool** (M02 §6.15 C: 134 generated grade-10 no-school students holding the memberships of M10 T4 classes 4, 5, 6, 8, 9, 10). Live shows members of those classes at 7780 (5 lower-form pupils in "4 Dedikasi / 4 Cemerlang / 5 Cemerlang - BM/SEJ", S22), school 1 (9 pupils in "4/5 Bestari / Dedikasi / Cemerlang - BM", S22) and every other observed school (S22 in-class pupils: 3160 9, 2700 10, 8772 8, 8767 8, 2710 2, 8765 17; audit top-up). Arithmetic: k pool pupils (k = the in-class pupils of those schools who are not T4/T5 register pupils, at most 5 + 9 + 9 + 10 + 2 + (8 − 7) + (8 − 8) + … ≤ 36) keep their class memberships, get `schoolId` 7780 / 1 / 3160 and a lower grade (Darjah n / T1–T3, as live) → students 4,533 unchanged; M11 register 4,158 unchanged (they are not grade 10/11 with a school); M08 T4 level card 149 unchanged (it counts T4-class members whatever their grade or school); T4 pool 134 − k. The remaining 78 − k pupils come from the "other students" pool (72, of which ≥ 1 per other filter school holding students and 2 at 8106 stay): feasible when 72 − 2 − (other filter schools that hold students) ≥ 78 − k; fictitious IC-shaped `icNumber` for the 8880 pupils of classes 516 / 517 (S9 IC column), none elsewhere (as live "—"). |
| XR-M18-03 | M05 | (1) Hold a **separate stored per-pupil × subject accuracy set** `{userId, subjectId, correct, answered}` behind S5 / S6 (owner M05, INFERRED), independent of the answer log, the sessions and the SubjectMastery level rows, with the anchor rows of §6.11 C (8765 X / Y; "0%" rows at 3160 BI, 2700 BM / MT / SEJ, 8767 Sains / SEJ). A separate set is the feasible model: one row set shared with the mastery levels would need 13 pupils where S1 shows 12. (2) SubjectMastery levels, unchanged in scope: 38 rows for 12 KLUANG pupils (14 / 20 / 4; school means 2710 1.2, 8765 0.7); per-pupil means on S22: 8765 L0.2, L0.7 (×2, e.g. 0.67), L1 (×3), L1.5, L0.8 (0.75); 2710 L1, L1.5; class-1156 pupil 3.95. |
| XR-M18-04 | M05, M11 | Move the 12 "answers before M1" (M11 `observed:false` at 8880) to **8765** (observed: 222 = 210 + 12); M11 §6.7 row 8880 "10,208 (incl. 12 before M1)" → 10,196, row 8765 210 → 222 (S2 KPI and Johor totals unchanged). |
| XR-M18-05 | M05 (applied in v1.10) | 8880: 60 practice-mode sessions / 675 / 485 with the per-pupil rows and months; 3201–3215's 6,563 answers **without a session**; 2,956 answers in `latih_tubi` sessions of T5 non-T4-class pupils only. 8765's 21 sessions (309 / 242) and 2700's one session (14 / 4) are **not** requested from M05 any more: they fit neither the log (8765 has 222 answers, 2700 none) nor KirkpatrickSessionAggregate (T4/T5 scope; 2700 is primary) — M18 holds them as documented display values (DATA-M18-07, v1.5); **2 orphan rows** at 8880 week M8 (question outside M04) — C9; 2710's 119 / 46 in segment `other`; activity-only pupils (a `lastActiveAt`, no session) per §6.11 B and XR-M18-21. |
| XR-M18-06 | M08 | Headcount: 8880's 148 graded entries and 6 subject rows (S27), KLUANG coverage 64 with marks / 65 in configs; confirm the query definitions of BR-M18-07/08 (64 > 59 pupils of 8880 implies config membership beyond the school). |
| XR-M18-07 | M14 | Streak anchors of §6.11 F (KLUANG 81, BATANG PADANG 29, top-10 rows); confirm that "active" = stored `current` > 0 (not decayed). |
| XR-M18-08 | M10, M08, M02 (applied: M02 v1.12 §6.15 D) | Classes: 516 "4 Simulasi" and 517 "5 Simulasi" owned by 8880, their 15 + 15 members pupils of 8880. **Class 516:** live shows its 15 pupils at 8880 ("4 Simulasi" "15 pelajar" "0 guna", S9; S28 T4), so M08's anchors **3201–3215** move from "no school" (M02 XL2-35) to `schoolId 8880`, grade 10, as **15 of 8880's 26 T4 register pupils**; the live intervention pupil 2229 maps onto anchor **3215** (live ids are observations, not seed ids). **M02 / M05 compensation:** 3201–3215 are **active T4 answerers** (live S30 T4: 15 pupils, 6,563 answers, no practice session), so the 15 generated rows they replace must be **15 of 8880's Aktif T4 rows**, and those rows' answers (M05 answer log, inside 8880's M11 weekly cells) move to 3201–3215; the displaced rows leave 8880 as no-school grade-10 students without answers; M11 8880 Aktif stays **31** (login-only 14, never 8 unchanged), Σ weekly cells unchanged; totals: students 4,533 unchanged; M11 register 4,158 and 8880 = 53 (26 T4) unchanged; students without a school 22 = 7 named (3, 11, 3105–3109) + 15 generated (was 22 named); M08 T4 level card 149 unchanged (class memberships unchanged); M08 E2E-02 / 12 / 64 / 67 / 68 unaffected except where they assert "no school" for 3201–3215. Former open point (S28 shows the class-516 pupils "Tiada aktiviti" while they answered and M11 records 8880 "answered without login (+0)"): settled in v1.7 by the two-field model — their `lastLoginAt` stays as M02 places it (logged in, M11 / M17), their `lastActiveAt` is null (XR-M18-21), as live; "5 Sinar" (Fizik) and "5 Delima" (Sains) with 15 pupils of 8880; 8880's two teachers own 5 + 4 classes; the 7780 / school-1 memberships in the T4/T5 "Bestari / Dedikasi / Cemerlang - BM/SEJ" classes (M10 anchors 4–10 are held by no-school pupils in M02 v1.11); class 1156 "5 CYBER" (Sains Rumah Tangga, 1 pupil). |
| XR-M18-09 | M08 | School item analysis: live `/analisa-item/sekolah/{id}` is the same template as S30 (crawl note). Adopt the observed populated layout of URS FN-M18-5.3.x for `/analisa-item/sekolah[/{id}]` (replacing the INFERRED L-7 layout) and the school-scoped GPS card (DV-M18-39); align "Tiada Data Pelajar" wording (M08 FR-M08-60 ends "… menjawab soalan latihan."; S30 observed "… menjawab soalan."). |
| XR-M18-10 | M04 | Question anchors for the stored critical-question sets of XR-M18-19: the 20 KLUANG questions of §6.11 H, 8880's S30 lists and 8765's 6 questions (stems, options, keys, subject / topic / sub-topic), inside the existing M04 totals. The card label is not an M04 difficulty (it comes from % salah, BR-M18-26). |
| XR-M18-11 | M01 | Confirm landing pages for `ppd_officer` / `jpn_officer` (BR-07) and that the officers have no `schoolId` (scope from `ppdDistrict` / `ppdState`). |
| XR-M18-12 | M17 | 8880 GPS 2.88 / 150 on M17 vs M08's 2.49 / 148 (S27): M17 to state its definition or use Q-M18-GPS. |
| XR-M18-13 | M11 | "Amaran Awal" in the "PENILAIAN" group is an M18 entry (M11 FN-M11-1.1.1 lists it); M11 register 8880 53 / 8765 16 / 7780 6 / 8772 7 / 8767 8 confirmed as the T4/T5 subsets of M18's pupils (R14d). |
| XR-M18-14 | Shell (ui-ux-designer, shells.md) and master SRS FR-G-03 | `/ppd/*`, `/jpn/*`, `/amaran/*`, `/sekolah/{id}/*`, `/kombo/*`, `/analisa-item/(ppd\|jpn)` render in the **user-portal shell** on live (FN-M18-1.1.8); FR-G-03 and shells.md §1 say admin shell — update them. Declare the M18 menu entries (FN-M18-1.1.4) in the single menu list (DV-SH-04). |
| XR-M18-15 | M14 | `/kombo` stays the M14 redirect; M18's officer Kombo pages read DATA-M14-08 through M14's repository. |
| XR-M18-16 | M03 | Subject short codes for S9 cards (BM, BI, MATH, CHEM, PHY, ADDMATH, SK, SEJ, BIO, PERNIAGA, GEO) and the "(Teras)" core flag for the S5 select (32 options: 7 core + 24 electives + "Semua"). |
| XR-M18-18 | M14 | Add a stored per-pupil counter `totalDays` to DATA-M14-08 (live "Jumlah Hari"); anchors: 2710 pupils 13 and 4, every other observed top-10 row 0 (audit top-up). |
| XR-M18-19 | M08 | Own the stored per-question statistics set behind S25, S26 and S30 (INFERRED single owner, D12): per scope rows {questionId, attempts, pupils, wrong, wrongPupils, popularWrongOption} with the observed anchors — KLUANG / Johor 20 (§6.11 H), 8880 20 (+ T4 variant), 8765 6 (card 1 84.6% · 6 cuba; cards 2–6 0.0% · 1 cuba; T5 card 1 50.0% · 2 cuba), 2710 none; the level filter recomputes attempts and denominators over the same set; labels by the BR-M08-18 cut-offs. |
| XR-M18-20 | M14 | Answer to XR-M14-10: seed the §6.11.7 rows as planned (extras at streak 1); M18 does **not** recompute the school means of 8880, 7780, 1, 2700, 8767, 8772 — it shows the observed values as documented display data (DATA-M18-06, DV-M18-44); no M14 row needs adjusting. |
| XR-M18-21 | M02 (users; + M01 account record; + M10 for the class-1156 membership, v1.8) | **Two-field model (v1.7, §6.1a).** (1) Add a nullable stored field `lastActiveAt` (ISO datetime, MYT) to every User, independent of `lastLoginAt`; M18's risk rows read it, M11 / M17 keep reading `lastLoginAt`, which stays **exactly as M02 v1.21 places it** (no login pin changes). (2) **Seed values for every M18-visible pupil** — the observed "Terakhir aktif" dates of S22 / S28 / S18 / S17 (snapshot `_snapshot-2026-09-26.json` and top-up `_topup-2026-09-26.json` `schools.{id}.s22.pupilsRanked[*].penglibatan`, rank order = live order; time of day not observed → 12:00 MYT, PROPOSED; "Tiada aktiviti" → null): **7780** (17) — 15 dated: T4 "4 Bestari - BM" 02-26, T1 "4 Dedikasi - BM" 02-26, T3 "4 Cemerlang - BM" 02-27, T5 "5 Cemerlang - BM" 02-27, T2 "4 Cemerlang - BM" 02-27, T1 "5 Cemerlang - BM" 02-26, T3 "5 Cemerlang - BM" 02-26, T5 (no class) 02-28, T1 (no class) 02-26, T2 (no class) 02-28, T3 (no class) 02-28, T4 (no class) 02-27, T1 (no class) 02-27, T2 (no class) 02-26, T3 (no class) 02-28; null: T4 "4 Dedikasi - BM" and T5 (no class). **School 1** (16) — 14 dated in rank order 02-26, 02-28, 02-27, 02-27, 02-28, 02-27, 02-27, 02-26, 02-28, 02-26, 02-28, 02-28, 02-28, 02-28 (02-26 ×3, 02-27 ×4, 02-28 ×7); 2 null. **8880** (59) — 17 dated: 13 no-session pupils (T5 05-19; D6 02-26; T5 02-26; T2 02-28; T4 02-27; T1 02-26; T5 02-28; T2 02-26; T4 02-27; T4 02-27; T5 02-27; T4 02-27; T5 02-26) and the 4 session pupils (class 517: 03-17, 03-21, 03-26; "Tiada Kelas" 90% pupil 02-27); **42 null**: the 15 class-516 pupils 3201–3215, the 12 non-session class-517 pupils and 15 others (incl. the 2 remaining lower-form pupils). **8765** (21) — 19 dated (02-26 ×7, 02-27 ×9 incl. the 64% session pupil, 02-28 ×2, 03-21 = the 82.6% session pupil); null: the T5 "5 Bestari - BM" pupil with mastery L1 (score 97) and one no-class pupil without mastery (80). **8767** (13) — 11 dated (02-26 ×6, 02-27 ×1, 02-28 ×4), 2 null. **8772** (12) — 10 dated (02-26 ×2, 02-27 ×2, 02-28 ×6), 2 null. **2700** (14) — 12 dated (02-26 ×1, 02-27 ×6, 02-28 ×5 incl. the 28.6% session pupil), 2 null. **3160** (12) — all 12 dated (02-26 ×3, 02-27 ×3, 02-28 ×6). **2710** (4) — 2026-05-19 (the 21.8% session pupil), 05-21, 02-26, 02-27. **Class-1156 pupil** — 2026-09-15; identity (v1.8): live user id **4627** (S17 `/amaran/kelas/1156` links `/prestasi/4627` and `/amaran/intervensi/4627`, EL-M18-S17-023 / 025); **no M02 anchor holds it yet** — M02 must add student anchor **4627** (live id kept as the seed id, as for M12's 4664 / 4644), taking one generated student slot (no total changes); school and grade are **not observed** (S17 shows neither; the pupil is not among the S22 rows of the 9 observed schools), so M02 places it (grade 11 INFERRED from "5 CYBER", M08 §6.10 "1154–1156 (INFERRED T5)"; if placed at a school as a grade-11 pupil it must take an existing M11 register Aktif row of that school); M10 must make 4627 the single member of class 1156 "5 CYBER" (JOV330, Sains Rumah Tangga). Its other observed inputs stay as §6.11 B (sessions 58.6%, mastery mean 3.95, SEJ weak). Total 115 dated / 54 null over 169 users. (3) **Default for every other user:** `lastActiveAt` = `lastLoginAt` (same instant; null when null) — no observed M18 figure depends on it. (4) **M18 figures that depended on DV-M18-43 / 45 and now hold as live:** S1 KPI "86 akademik berisiko, 49 belum mula latih"; 8880 risk rows on S22 / S28 (T4 15 × 80; T5 84.4, 83.6, 12 × 80, 66.8); 7780 / school 1 / district averages 97.6 / 97.5 / 97.6 and the S18 / S19 / S23 order HAMID KHAN, TOH TANDEWA SAKTI; S18 / S19 pupil lists 29 × 100 then 4 × 80; the CSVs #29–#31. (5) No total changes (no user added or moved; M11 4,158 / 522, M17 3,152 / 1,371 and 1,708 logged-in unchanged). |
| XR-M18-17 | architecture (build-plan) | Two M18-owned aggregates populated by a mock daily job (`mock.runDailyJobs()`), polling endpoints with `mock.advanceTimers`, CSV download helper (`api.raw` with `text/csv`). |

---

## 7. Mock API endpoints

*(solution-architect)* Base `/api`; envelope, error format and locale of SRS.md §7 (`{data, meta}`; errors `{error: {code, message, fields?}}`). Auth: **AD** admin; **P** `ppd_officer` or admin; **J** `jpn_officer` or admin; **O** P or J; **A** O + `school_admin` + `teacher` (within scope, BR-M18-01); guest `401 UNAUTHORIZED` → `/login`; other roles `403 FORBIDDEN`. Every request resolves the scope server-side (FR-M18-07/08); out-of-scope ids → `403`, unknown ids → `404 NOT_FOUND` (FR-M18-12). Configurable mock latency (architecture §6.13). Page routes keep the live URLs; the endpoints are the REST shape of the same server-rendered data. No endpoint returns a full IC except #12.

| # | Method | Path | Auth | Mut. | Request | Response (data) | Errors | Live equivalent |
|---|---|---|---|---|---|---|---|---|
| 1 | GET | `/api/officer/scope` | A | no | — | `{role, district, state, schoolId, previewFamilies?}` (admin: DATA-M18-05) | 401 | server-side |
| 2 | GET | `/api/ppd/dashboard` | P | no | — | `{header: ScopeHeader, kpi: KpiBlock, gpsTable: SchoolRow[] (id, name, gps, grade, pupils), risk: {tally: RiskTally, rows: [{school, pupils, green, yellow, red}]}, subjects: SubjectCard[], kombo: {summary: KomboSummary, rows: [{school, pupils, active, avg}]}, mastery: {tiles: MasteryTiles, rows: [{school, pupils, avgLevel, levelName}]}, corrections: {summary: CorrectionSummary, rows: [{school, pupils, corrected, pct}]}}` | 401, 403 | GET `/ppd/dashboard` |
| 3 | GET | `/api/ppd/command-center/live-data` | P (admin 403 as live) | no | — | `LiveData` (§7.1) at district scope | 401, 403 | GET `/ppd/command-center` (403) |
| 4 | GET | `/api/ppd/usage` | P | no | `period` | `{header, period, schools: n, activePupils: n, rows: RankingRow[]}` (rows empty → empty state) | 401, 403 | GET `/ppd/statistik-penggunaan?period=` |
| 5 | GET | `/api/ranking/national` | O | no | `period` | `{period, ppdRows: [{rank, district, state, schools, pupils, correct, answered, accuracy}], schoolRows: RankingRow[] (≤ 50), activePpd, activeSchools, generatedAt}` (DATA-M18-03) | 401, 403 | GET `/ppd/ranking-kebangsaan`, `/jpn/ranking-kebangsaan` |
| 6 | GET | `/api/ppd/benchmark` | P | no | `subjectId?` | `{header, avgAccuracy, avgActivePct, subject: {id, name}\|null, rows: BenchmarkRow[] (score per BR-M18-11 lifetime)}` | 401, 403 | GET `/ppd/benchmark-sekolah?subject_id=` |
| 7 | GET | `/api/ppd/heatmap` | P | no | — | `{header, subjects: [{id, name}] (7 core), rows: [{school, cells: (number\|0\|null)[7], avg}], footer: (number\|null)[7]}` | 401, 403 | GET `/ppd/peta-haba` |
| 8 | GET | `/api/ppd/export` | P | no | — | `{header, stats: {schools, pupils, activePupils, avgAccuracy, answered}, columns: string[11], preview: Row[5], total, generatedAt}` | 401, 403 | GET `/ppd/export-laporan` |
| 9 | GET | `/api/ppd/export.csv` | P | no | — | `text/csv; charset=utf-8` with BOM, `Content-Disposition: attachment; filename="laporan-{ppd-slug}-{yyyymmdd}.csv"` (§7.2) | 401, 403 | GET `/ppd/export-laporan?format=csv` |
| 10 | GET | `/api/ppd/leaderboard` | P | no | `subjectId?` | `{header, podium: BenchmarkRow[3], rows: BenchmarkRow[] (score with 30-day Soalan/Pelajar, trend)}` | 401, 403 | GET `/ppd/leaderboard-sekolah?subject_id=` |
| 11 | GET | `/api/officer/schools/:id` | O | no | `grade?`, `classId?`, `subjectId?` | `SchoolStats` (§6.7; pupils with `icMasked` only) | 401, 403, 404 | GET `/ppd/sekolah/{id}`, `/jpn/sekolah/{id}` |
| 12 | POST | `/api/officer/schools/:id/ic-reveal` | O | yes (audit) | `{studentIds: int[]}` | `{data: [{userId, icNumber}]}`; writes DATA-M18-02 | 401, 403, 404, 422 | none on live (CSS toggle; DV-M18-13) |
| 13 | GET | `/api/jpn/dashboard` | J | no | — | as #2 at state scope + `districts: [{district, schools, pupils, red, redPct, accuracy}]`, `ppdOptions: string[]` | 401, 403 | GET `/jpn/dashboard` |
| 14 | GET | `/api/jpn/command-center/live-data` | J | no | — | `LiveData` (§7.1) at state scope | 401, 403 | GET `/jpn/command-center/live-data` |
| 15 | GET | `/api/jpn/usage` | J | no | — | `{header, districts: n, schools: n, pupils: n, rows: [...]}` (DATA-M18-03 usage; empty → empty state) | 401, 403 | GET `/jpn/statistik-penggunaan` |
| 16 | GET | `/api/jpn/districts/:ppd/usage` | J | no | — | `{header, schools, activePupils, rows}` | 401, 403, 404 | GET `/jpn/daerah/{PPD}` |
| 17 | GET | `/api/amaran/classes` | A | no | — | `[{id, name, subjectName, pupils}]` (id descending) | 401, 403 | GET `/amaran` |
| 18 | GET | `/api/amaran/classes/:id` | A | no | — | `{class: {id, name, subjectName}, tally: RiskTally, pupils: PupilRisk[], weakness: [{subject, weak, total, pct}]}` | 401, 403, 404 | GET `/amaran/kelas/{id}` |
| 19 | GET | `/api/amaran/ppd` | P | no | — | `{header, tally, schools: [{school, pupils, avgScore, green, yellow, red}], pupils: PupilRisk[] (with school, classLabel), exportKey}` | 401, 403 | GET `/amaran/ppd` |
| 20 | GET | `/api/amaran/jpn` | J | no | — | `{header, tally, districts: [{district, schools, pupils, avgScore, green, yellow, red}], schools: [...] (each once), pupils: PupilRisk[]}` | 401, 403 | GET `/amaran/jpn` |
| 21 | GET | `/api/amaran/schools/:id` | A | no | `tingkatan?` | `{school, levelFilter, tally, weakness[], pupils: PupilRisk[] (with levelLabel)}` | 401, 403, 404 | GET `/amaran/sekolah/{id}`, `/sekolah/{id}/amaran?tingkatan=` |
| 22 | GET | `/api/amaran/summary` | A | no | `scope`, `district?`, `state?`, `schoolId?` | `{scope, title, subtitle, pupilsLine?, generatedAt, tally, kombo: KomboSummary, schools?: [...] (each once), weakness?: [...]}` | 401, 403, 404 | GET `/amaran/ringkasan-eksekutif?…` |
| 23 | GET | `/api/amaran/effectiveness/ppd` | P | no | `schoolId?` | `EffectivenessReport` + `schoolOptions: [{id, name}]` | 401, 403 | GET `/amaran/keberkesanan/ppd?school_id=` |
| 24 | GET | `/api/amaran/effectiveness` | A | no | — | `{school: {id, name}, report: EffectivenessReport}` (viewer's school) | 401, 403 | GET `/amaran/keberkesanan` |
| 25 | GET | `/api/amaran/students/:id/interventions` | A | no | — | `{student: {id, name}, tally: {total, berkesan, belum}, classOptions: [{id, name}] (pupil's classes), records: Intervention[] (newest first, with teacherName)}` | 401, 403, 404 | GET `/amaran/intervensi/{studentId}` |
| 26 | POST | `/api/amaran/students/:id/interventions` | A (BR-M18-18) | yes | `{type, interventionDate, classroomId?, status, notes, followUp?}` | 201 `{data: Intervention}` | 401, 403, 404, 422 (V-M18-01) | POST `/amaran/intervensi` |
| 27 | PATCH | `/api/amaran/interventions/:id` | A (BR-M18-18) | yes | `{effectiveness?}` or `{followUp?}` | 200 `{data: Intervention}` | 401, 403, 404, 422 (V-M18-02/03) | POST `/amaran/intervensi/{id}` `_method=PATCH` |
| 28 | DELETE | `/api/amaran/interventions/:id` | A (BR-M18-18) | yes | — | 204 | 401, 403, 404 | POST `/amaran/intervensi/{id}` `_method=DELETE` |
| 29 | GET | `/api/amaran/export/class/:id` | A | no | — | CSV (§7.2) | 401, 403, 404 | GET `/amaran/export/class/{id}` |
| 30 | GET | `/api/amaran/export/school/:id` | A | no | — | CSV (§7.2) | 401, 403, 404 | GET `/amaran/export/school/{id}` |
| 31 | GET | `/api/amaran/export/district/:key` | P | no | — | CSV (§7.2) | 401, 403, 404 | GET `/amaran/export/district/{id}` (live id 0) |
| 32 | GET | `/api/item-analysis/ppd` | P | no | — | `{header, cards: {schools, pupils, answered, accuracy}, schools: [{school, type, pupils, answers, accuracy}], subjects: SubjectCard[], critical: CriticalQuestion[] (≤ 20)}` | 401, 403 | GET `/analisa-item/ppd` |
| 33 | GET | `/api/item-analysis/jpn` | J | no | — | as #32 with `districts: [{district, schools, pupils, answers, accuracy}]` | 401, 403 | GET `/analisa-item/jpn` |
| 34 | GET | `/api/schools/:id/performance` | O + school admin | no | — | `{school, classes, pupils, stats: {pupils, teachers, classes, subjects, sessions, answered, accuracy}, gps: {value, band, entries}, grades: [{grade, count, pct}], subjectGps: [...], levels: [{level, accuracy, classes, pupils, sessions}], teachers: [...]}` (school-scoped, BR-M18-32) | 401, 403, 404 | GET `/sekolah/{id}/prestasi` |
| 35 | GET | `/api/schools/:id/item-analysis` | O + school admin | no | `tingkatan?` | `{school, pupils, answers, accuracy, difficulty: {mudah, sederhana, sukar}, gps: {value, band, entries, history: [{year, gps}]}, subjects: [...], critical: CriticalQuestion[] (with correct and popular wrong option, wrongPupils)}` or `{empty: true}` | 401, 403, 404 | GET `/sekolah/{id}/analisa-item?tingkatan=` |
| 36 | GET | `/api/kombo/ppd` | P | no | — | `{header, summary: KomboSummary, rows: [{school, pupils, active, avg}]}` (all schools of the district) | 401, 403 | GET `/kombo/ppd` |
| 37 | GET | `/api/kombo/jpn` | J | no | — | as #36 at state scope | 401, 403 | GET `/kombo/jpn` |
| 38 | GET | `/api/kombo/schools/:id` | O + school admin | no | — | `{school, summary, calendar: {cells[365]}, classes: [{name, subject, pupils, avg, max, active}], top10: [{userId, name, current, best, days}]}` | 401, 403, 404 | GET `/sekolah/{id}/kombo`, `/kombo/sekolah/{id}` |

### 7.1 Live-data polling contract (S11, S2 officer)

`LiveData = {scope: {kind, state, district?}, totalSchools, totalStudents, totalStudentsRaw, activeStudents, totalAnsweredRaw, answeredToday, answeredWeek, answeredLastWeek, weekChange, accuracy, gpsOverall, topSchools: [{schoolId, schoolName, district, activeCount, totalAnswers}] (≤ 5), topStudents: [{studentId, name, schoolName, answersCount, accuracy}] (≤ 5), recentFeed: [{student, subject, correct, time, schoolId, schoolName}] (≤ 10), districts: [{district, schools, students, active, accuracy}], generatedAt}` (BR-M18-28). The page calls the endpoint on load and every **10 s** (`setInterval`, cleared on route leave), renders the tiles with an 800 ms ease-out count-up, keeps the last payload when a call fails (no message) and ticks the MYT clock every second independently. Names are escaped before rendering (SEC-M18-05). Rate: at most one request per 10 s per open page (mock asserts).

### 7.2 CSV contract (#9, #29–#31)

UTF-8 with BOM, comma separator, CRLF, header row, one row per record in the page order; values starting with `=`, `+`, `-`, `@` are prefixed with `'` (CSV-injection guard, SEC-M18-03). #9 columns (from the S7 text): Nama, Kod, Daerah, Pelajar, Aktif, % Aktif, Ketepatan, Soalan, Risiko Kritikal, Risiko Tinggi, Skor ("Risiko Kritikal" / "Risiko Tinggi" = pupils with score ≥ 80 / 60–79.9, PROPOSED). #29–#31 columns (PROPOSED): Bil, Pelajar, Sekolah (district only), Tingkatan / Kelas, Skor Risiko, Status, Ketepatan, Penglibatan, Penguasaan — **no IC, no e-mail, no phone**. Filenames `amaran-kelas-{id}-{yyyymmdd}.csv`, `amaran-sekolah-{id}-{yyyymmdd}.csv`, `amaran-daerah-{slug}-{yyyymmdd}.csv`. Each download is scope-checked and logged in the mock audit (backend: DATA-M18-02-like export log, SEC-M18-03).

---

## 8. States & messages

### 8.1 Observed copy (exact)

| Screen | State | Copy |
|---|---|---|
| S1 / S10 | no correction data | "Tiada data pembetulan untuk bulan ini ({YYYY-MM})" (second line removed, DV-M18-05) |
| S3 | empty 30 / 7 days | "Tiada data untuk tempoh ini" · "Tiada aktiviti latihan dalam tempoh 30 Hari yang lepas." / "… 7 Hari …" |
| S3 | empty today | "Belum ada pelajar buat latihan hari ini. Cuba lihat **7 Hari** atau **30 Hari**." |
| S9 / S15 | empty sections | "Tiada data" · "Tiada aktiviti direkodkan buat masa ini"; "Tiada data subjek"; "Tiada data ranking" · "Data ranking dikemas kini setiap hari"; "Pilih subjek dari filter di atas" · "Ranking akan dipaparkan mengikut subjek yang dipilih"; "Tiada data ranking untuk subjek ini"; "0 kelas dipaparkan" · "Tiada kelas dijumpai" · "Sila cipta kelas terlebih dahulu"; "Tiada data pelajar" · "Tiada pelajar dalam sekolah ini buat masa ini"; "Tiada guru berdaftar" · "Sekolah ini belum mempunyai guru yang berdaftar dalam sistem"; "Tiada rekod" |
| S9 / S15 | IC confirm | `Anda akan melihat No. IC penuh pelajar.\nTindakan ini direkodkan untuk pematuhan PDPA.\n\nTeruskan?` |
| S10 | no search match | "0 sekolah dijumpai" · "Tiada sekolah dijumpai" |
| S11 | before data / empty panels | "Memuatkan wawasan..." · "Tiada data" · "Tiada aktiviti terkini" · "Sama dengan minggu lepas" / "▲ +{n}% vs minggu lepas" / "▼ {n}% vs minggu lepas" |
| S12 / S14 | empty snapshot | "Data belum tersedia" · "Data ranking dikemas kini setiap hari. Sila semak semula esok." |
| S21 | no interventions | "Tiada data intervensi lagi." · "Tiada data trend lagi." · "Belum Ada Intervensi" · "Tiada rekod intervensi ditemui untuk sekolah ini. Guru boleh mula merekod intervensi dari halaman Amaran Awal." · "Lihat Senarai Risiko" |
| S24 | delete confirm | `Padam intervensi ini?` |
| S30 | school without answers | "Tiada Data Pelajar" · "Tiada data pelajar untuk sekolah ini. Pastikan pelajar telah berdaftar dan menjawab soalan." |
| Error pages | 403 / 404 | M01 pages (URS FN-M18-1.2.6, 1.2.7) |

### 8.2 PROPOSED COPY and PROPOSED layouts (report at G1; URS OQ-M18-10)

| Item | Proposed |
|---|---|
| S2 officer page title | tab "Command Center PPD — {PPD}", h1 "Command Center PPD" (DV-M18-36) |
| S3 / S12 / S14 filled | S4 / S13 table formats (FN-M18-2.3.3, 3.3.4) |
| S9 filled pupil ranking | "#" (medals) · name · class · accuracy (FN-M18-2.9.9) |
| S16 empty | reuse "Tiada kelas dijumpai" (FN-M18-4.2.1) |
| Risk cut-offs, weak-subject threshold | 40 / 60, 50% (BR-M18-14, BR-M18-16) |
| CSV columns | §7.2 (#9 Risiko Kritikal / Tinggi bands; #29–#31 columns) — also in URS FN-M18-4.9.x |
| Intervention notes / follow-up limit | 2,000 characters (V-M18-01, V-M18-03) |
| S2 officer "Pecahan Daerah" | replaced by the district's schools (FN-M18-2.2.2) |
| Admin S21 / officer S21 access | 403 for officers without an own school (§9) |
| Heat-map "0%" vs "—" cell rule, critical-question selection, risk bands, composite-score normalisation | BR-M18-19, BR-M18-26, BR-M18-14, BR-M18-11 (INFERRED / PROPOSED parts) |
| Seed intervention notes | "Catatan contoh intervensi (data demo)." (§6.11 I) |

### 8.3 Loading and errors

Loading: the shell's loading state (M01 convention) while a request is pending; S11 shows its placeholders ("Memuatkan wawasan...", zeros) until the first payload. Errors: the M01 global error convention for a failed page request; a failed S11 poll keeps the last values silently; a failed IC reveal leaves the masked ICs (no message, as live has none); a failed intervention save re-renders the form with the entered values (no invented flash text; OQ-M18-06).

---

## 9. Permissions matrix

| Route family | Admin | PPD officer (`ppd_officer`) | JPN officer (`jpn_officer`) | School admin (`school_admin`) | Guru (`teacher`) | Others / guest |
|---|---|---|---|---|---|---|
| PPD pages S1, S3–S9, S20, S25, S31 | ✓ preview scopes (OBSERVED) | ✓ own district | → `/jpn/dashboard` (page), 403 (API) | → landing, 403 | → landing, 403 | landing / `/login` |
| S2 `/ppd/command-center` | **403** (OBSERVED) | ✓ provisional page | 403 | 403 | 403 | landing / `/login` |
| JPN pages S10–S15, S19, S26, S32 | ✓ Johor / Perak (OBSERVED) | → `/ppd/dashboard`, 403 | ✓ own state (S14: PPDs of the state) | → landing, 403 | → landing, 403 | landing / `/login` |
| Amaran S16, S17 | ✓ every class | ✓ classes of the district | ✓ classes of the state | ✓ classes of the school | ✓ own classes | → landing, 403 |
| Amaran S18 / S19 | ✓ BATANG PADANG / Perak | S18 own district | S19 own state | → landing, 403 | → landing, 403 | → landing |
| S22, S28, S23 (school) | ✓ any school | schools of the district | schools of the state | own school | schools of own classes (INFERRED) | → landing |
| S21 | ✓ school 127 | 403 (no own school; INFERRED) | 403 (no own school; INFERRED) | own school | own school | → landing |
| S24 view / write | ✓ / ✓ | pupils of the district (Q-M18-8) / ✓ | pupils of the state / ✓ | own school / ✓ | own classes' pupils / ✓ | → landing |
| School drill-downs S27, S29, S30, S33 | ✓ any school | schools of the district | schools of the state | own school | → landing, 403 | → landing |
| IC reveal #12 | ✓ | ✓ in scope | ✓ in scope | — (no S9 access) | — | 403 |
| CSV #9, #29–#31 | ✓ | ✓ in scope | #29/#30 in scope | #29/#30 own school | #29 own classes | 403 |

Admin behaviour OBSERVED; every other cell INFERRED (provisional, OQ-M18-01). Out-of-scope ids → 403 (FR-M18-09).

---

## 10. Responsive behaviour

User-portal shell per `design/shells.md` (drawer + bottom nav below 1024px). Tables sit in `overflow-x-auto` card wrappers (NFR-RESP-05 b); no sticky columns. Widths measured on live (discovery §8.1) are the table minimum widths.

| Screen | 375 × 812 | 768 × 1024 | 1280 × 800 |
|---|---|---|---|
| S1 / S10 | KPI 2 columns; header counters wrap under the title; tables scroll in cards (S1 317–364 px, S10 448 px); pager centred | KPI 2 columns; tables fit | KPI 3 columns; sections full width |
| S3 / S12 / S14 | pills wrap; one empty card | as 375 | counters right of the title |
| S4 / S13 | 651–688 px tables scroll in cards | tables scroll (S13) / fit | fit |
| S5 | 692 px table scrolls in its card at 375 and 768; filter stacked | filter inline | fit |
| S6 | 888 px matrix scrolls in its card with the hint | scrolls (896 px) | fits |
| S7 | stats 2 columns; 864 px preview scrolls | stats 3 columns; preview scrolls | stats 5 columns |
| S8 | card list (`sm:hidden` table) with medals and badges | table (800 px) scrolls in its card | table fits; podium 3 columns |
| S9 / S15 | header meta wraps; filters stacked; cards 2 columns; section nav scrolls horizontally inside its bar; calendar scrolls in its card; tables 600–732 px scroll | cards 3 columns | cards 6 columns |
| S11 | fixed 4-column layout kept (as live): tiles and panels shrink inside the grid, long panel content scrolls inside its panel, **page `scrollWidth ≤ clientWidth`** (live measured no page overflow at 375, discovery §8.1), text ≥ 12 px (DV-M18-30) | same, no page overflow | same |
| S2 (PPD officer, provisional) | the S11 component at district scope: same behaviour as S11 at every width | same | same |
| S2 (admin) / 403 / 404 pages | M01 standalone error page: centred card, full width minus padding, buttons stacked | centred card, buttons in a row | centred card |
| S16 | class cards 1 column | 2 columns | 3 columns |
| S17, S18, S19, S22, S28 | tiles 2 columns; 746–862 px tables scroll in cards (also at 768) | tiles 2–4 columns | tiles 4 columns |
| S20 / S21 | cards 2 columns; charts full width; tables scroll in cards; **no page overflow** (DV-M18-19) | cards 2 columns, charts side by side from `lg` | cards 4 columns |
| S23 | cards 2 columns; toolbar wraps | cards 4 columns | cards 4 columns; print layout A4 |
| S24 | tiles 3 columns; form single column; history rows stack actions under the text | form 2 columns from `md` (as live) | form 2 columns |
| S25 / S26 | h2 14 px (`text-sm sm:text-2xl`); cards 2 columns; 492 / 554 px tables scroll | h2 24 px | as 768 |
| S27 | stat cards 2 columns; GPS and distribution stacked; 550 px table scrolls | stat cards 4 columns | 7 columns; GPS 1/3 + distribution 2/3 |
| S29 / S33 | tiles 2 columns; calendar scrolls in its card; tables scroll | tiles 2 columns | tiles 5 columns |
| S30 | pills wrap; cards 2 columns; sparkline years ≥ 12 px; question cards full width | cards 3 columns | cards in one row |
| S31 / S32 | h2 14 px; tiles 2 columns; 466 / 473 px tables scroll | tiles 3 columns | tiles 5 columns |

---

## 11. Non-functional requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-M18-01 | Performance | District / state pages read the owners' pre-aggregated cell counters (architecture §6.6) and never iterate the 478,499-row log per request; S10 renders 1,189 rows × 4 tables client-side with paging in < 1 s on the reference laptop (mock). |
| NFR-M18-02 | Consistency | One risk computation (BR-M18-13) serves every Amaran page; one scope resolver (BR-M18-01) serves every endpoint. |
| NFR-M18-03 | Privacy (PDPA; minors) | No full IC leaves the server except through #12 after the confirm; seeds contain no real name, e-mail or IC; exports exclude identifiers beyond the pupil name. |
| NFR-M18-04 | Localisation | All copy Bahasa Melayu as live (English terms kept as live); times MYT. |
| NFR-M18-05 | Accessibility | Replicates live (D10): medal legend texts `sr-only`; charts keep their legends; no new ARIA. |
| NFR-M18-06 | Responsive | NFR-RESP-01…10 per §10 at 375 / 768 / 1280. |

### 11.1 Security notes (backend phase; **security-engineer review required** — personal data of minors, new external input, exports)

| ID | Risk on live (replicated or fixed) | Requirement for the rebuild / backend |
|---|---|---|
| SEC-M18-01 | **IC exposure:** S9/S15 ship every pupil's full IC in the HTML; "Tunjuk IC Penuh" is a CSS toggle; the PDPA claim is not backed by a request (D-M18-20). | Masked IC only in list payloads; full ICs only via POST #12 for pupils of a school in the viewer's scope, after the confirm; every reveal writes DATA-M18-02 (viewer, school, pupil ids, time, route); rate-limit reveals; never log full ICs; seeds fictitious (DV-M18-13). |
| SEC-M18-02 | **Cross-district IDOR:** the admin opens any national school id on `/ppd/sekolah/{id}` and every `{id}` route; nothing observed limits an officer. | Every id route and endpoint (`/ppd/sekolah/{id}`, `/jpn/sekolah/{id}`, `/jpn/daerah/{PPD}`, `/sekolah/{id}/*`, `/amaran/kelas/{id}`, `/amaran/sekolah/{id}`, `/amaran/intervensi/{id}`, `/kombo/sekolah/{id}`, exports, `school_id` query) checks the viewer's scope server-side (BR-M18-01) → 403. |
| SEC-M18-03 | **CSV exports of minors' data** (district / school / class lists, not opened on live). | Scope-checked, minimal columns (§7.2: no IC, e-mail, phone), CSV-injection escaping, `Content-Disposition: attachment`, no caching (`Cache-Control: no-store`), export audit log. |
| SEC-M18-04 | **Intervention forms** (POST / PATCH-on-change / DELETE after `confirm`). | CSRF protection, authorisation per BR-M18-18 (writer must hold the pupil in scope), server validation V-M18-01…03, output escaping of notes and follow-ups, soft-delete or audit of deletions (backend decision), idempotent PATCH. |
| SEC-M18-05 | **Live-data polling** exposes pupil names (feed, top students) every 10 s; the live script injects names as HTML. | Scope-checked endpoint, names escaped before rendering, polling limited to open pages (1 / 10 s), no PII in URLs. |
| SEC-M18-06 | **Broad access to minors' data** (names, last-activity dates, risk labels) for officers and the admin. | Purpose-limited role matrix (§9), access logging for officer drill-downs (backend), no pupil data in page titles beyond the name already shown (S24 tab "Log Intervensi — {nama}", as live). |
| SEC-M18-07 | **`url()->previous()` "Kembali"** navigated to internal AJAX endpoints (`/notifikasi/unread-count`, `/admin/server-status`, `/chatbot/history?session_id=…`), leaking a chatbot session id in the href. | In-app history or fixed fallbacks only (BR-M18-31, DV-M18-21); never render referrer URLs. |
| SEC-M18-08 | **Unknown ids → 500** (S33) and 200 empty pages (S30) reveal internals / invite probing. | 404 for unknown ids (DV-M18-25/26/27); no stack traces. |
| SEC-M18-09 | **Developer operations text** ("`php artisan correction:backfill` … cron mungkin terhenti") shown to officers. | Removed (DV-M18-05); job health belongs to admin tooling. |

---

## 12. E2E test scenarios

Every scenario runs on the three Playwright projects mobile 375×812, tablet 768×1024 and desktop 1280×800 (master SRS §10); when a step is width-specific it names the width and the scenario still runs on all three. Default user: the admin (`mock.setUser(1)`); clock: the **project clock 2026-09-25T15:40:00+08:00** (architecture §6.12, AUD-M18-01); scenarios reading "Dijana", dates, the calendar window or risk scores assert the values at that clock. Values are the seed of §6.11. Scenarios marked **provisional** assert INFERRED or PROPOSED behaviour (officer scope and menus, unobservable states, files, write results) and carry the Playwright tag `@provisional`; they must be re-confirmed when OQ-M18-01 is answered.

Provisional: E2E-M18-03, 09, 10, 12, 13, 31, 34, 36, 42, 47, 51, 71, 72, 74, 80, 89, 90, 94, 95, 96, 97 (21 of 109)

| ID | Scenario | FR | AC | Provisional |
|---|---|---|---|---|
| E2E-M18-01 | Admin at 1280: sidebar group "PPD / JPN" lists the 11 entries of FR-M18-01 in order with icons, "LIVE" badge and targets; "Benchmark Sekolah", "Peta Haba", "Export Laporan", "Leaderboard Sekolah", "Command Center LIVE" present on desktop. | 01 | 01.1 | no |
| E2E-M18-02 | Admin at 375 and 768: drawer shows the same list and order; "Amaran Awal" after "Analisa Item" and under "PENILAIAN" → `/amaran`. | 01 | 01.2 | no |
| E2E-M18-03 | `ppd@demo.test`: menu shows PPD entries + "Amaran Awal", no JPN entry; `jpn@demo.test`: JPN entries + "Amaran Awal", no PPD entry. | 01 | 01.4 | yes |
| E2E-M18-04 | Shell: S1, S9, S18, S24, S30, S33 render the user-portal shell (chips, bell; bottom nav below 1024); S11 has no shell element. | 02 | 01.3 | no |
| E2E-M18-05 | Header title / subtitle and `document.title` of S1, S5, S10, S18, S19, S20, S25 equal URS FN-M18-1.1.5 / 1.1.7. | 03, 04 | 02.1 | no |
| E2E-M18-06 | S27 header "Dashboard Prestasi Sekolah" / school name and tab "Dashboard Sekolah — Prestasi"; S23 (no query) h1, subtitle and tab contain "PPD BATANG PADANG" and not "PPD PPD"; S28 `?tingkatan=T4` subtitle suffix; S17 1156 "5 CYBER — Sains Rumah Tangga". | 03, 04 | 02.2, 02.3, 02.4 | no |
| E2E-M18-07 | No session: `/ppd/dashboard`, `/jpn/dashboard`, `/amaran`, `/sekolah/8880/prestasi`, `/kombo/ppd` → `/login`. | 05 | 03.1 | no |
| E2E-M18-08 | Admin: S1, S3–S33 (known ids) render; `/ppd/command-center` shows the 403 page with the exact copy, links and tab title. | 06, 11 | 03.2, 05.1 | no |
| E2E-M18-09 | Role guards: PPD officer on `/jpn/dashboard` → `/ppd/dashboard`; JPN officer on `/ppd/dashboard` → `/jpn/dashboard`; student on `/amaran/ppd` → `/dashboard`; API calls answer 403. | 06 | 03.3 | yes |
| E2E-M18-10 | Teacher `guru@demo.test`: `/amaran` lists only classes 2001 and 2002; `/ppd/dashboard` → `/dashboard`. | 06, 78 | 03.4 | yes |
| E2E-M18-11 | Admin preview scopes: S1, S5, S20, S25 name "PPD KLUANG" / "Johor"; S10, S26 "Johor"; S18, S31, S23 (no query) "PPD BATANG PADANG" / "Perak"; S19, S32 "Perak"; S21 "SEKOLAH KEBANGSAAN MERU RAYA". | 08 | 04.1 | no |
| E2E-M18-12 | PPD officer: S1 header "PPD HULU LANGAT" / "Selangor"; "Jumlah Sekolah" = repository Q-M18-SCH(district, all); every table row's school has district PPD HULU LANGAT. | 07 | 04.2 | yes |
| E2E-M18-13 | PPD officer: `/ppd/sekolah/8880` → 403 page, `/ppd/sekolah/8082` renders; JPN officer: `/jpn/daerah/PPD%20KLUANG` → 403, `/jpn/daerah/PPD%20HULU%20LANGAT` renders. | 09, 07 | 04.3, 04.4 | yes |
| E2E-M18-14 | Fixture exclusion: S1 and S10 contain no "SK Demo" row; counts 118 / 1,189 unchanged with fixture 900002 in PPD KLUANG. | 10 | 04.5 | no |
| E2E-M18-15 | 404: `/ppd/sekolah/99999999`, `/jpn/sekolah/99999999`, `/jpn/daerah/BOGUS`, `/ppd`, `/jpn`, `/jpn/benchmark-sekolah`, `/amaran/keberkesanan/jpn`, `/amaran/kelas/99999999`, `/kombo/sekolah/99999999`, `/sekolah/99999999/analisa-item` show the 404 copy; none shows "Akses Ditolak", "Ralat Pelayan" or "Sekolah Tidak Dinyatakan". | 12 | 05.2, 05.3 | no |
| E2E-M18-16 | 404 for `/amaran/intervensi/99999999`, `/sekolah/99999999/prestasi`, `/amaran/sekolah/99999999`. | 12 | 05.4 | no |
| E2E-M18-17 | S4 period pills: URL, active pill, sub-lines "· 7 Hari" / "· Hari Ini"; `?period=bogus` → "30 Hari". | 14 | 06.1 | no |
| E2E-M18-18 | S1 GPS pager "1–20 daripada 118" "1 / 6", left chevron disabled, next → "21–40 daripada 118" "2 / 6"; risk table has no pager; search "KLUANG" filters and re-paginates. | 16 | 06.2 | no |
| E2E-M18-19 | S5 table and S8 podium / table / cards show 🥇 for place 1 (no "🏋"); "Tempat 1 — Emas", "Tempat 2 — Perak", "Tempat 3 — Gangsa" present. | 15 | 06.3 | no |
| E2E-M18-20 | Computed font sizes of content text ≥ 12px on S1, S9, S11, S20, S23, S24, S25, S30 at 375; number formats "1,189", "10,535", "7,307". | 17, 19 | 06.4 | no |
| E2E-M18-21 | `mock.latency(1000)`: S1 shows the shell loading state then data; `mock.failNext('/api/ppd/dashboard')`: M01 error convention, no M18 copy. | 18 | 06.5 | no |
| E2E-M18-22 | S1 breadcrumb, header card and cards "Jumlah Sekolah" 118, "Jumlah Pelajar" 135, "GPS Purata" 2.49 "A-", "Ketepatan Keseluruhan" 71.6% with sub-lines; values equal the repository queries. | 13, 20, 21, 113 | 07.1, 07.2 | no |
| E2E-M18-23 | S1 "Pelajar Berisiko Merah" 135, "100% daripada 135 pelajar", split 86 / 49 (as live). | 22 | 07.3 | no |
| E2E-M18-24 | S1 "Kombo Aktif" 81 and "Coverage Headcount" 64 "(47.4%)" with the funnel line. | 23 | 07.4 | no |
| E2E-M18-25 | S1 GPS table: 118 rows, row 1 TINGGI KLUANG 2.49 A- 59 → `/sekolah/8880/prestasi`, others "—". | 24 | 08.1 | no |
| E2E-M18-26 | S1 risk tiles, bar, legend and the 7-row table (each school once, Σ 135, links `/sekolah/{id}/amaran`). | 25 | 08.2, 08.3 | no |
| E2E-M18-27 | S1 six subject cards in order with the observed values. | 26 | 09.1 | no |
| E2E-M18-28 | S1 kombo tiles 81 / 135 / 7.2 / 0; rows LAYANG-LAYANG "21" 18 "8.2 hari", TINGGI KLUANG "59" 14 "6.4 hari". | 27 | 09.2 | no |
| E2E-M18-29 | S1 mastery note, tiles 14 (36.8%) / 20 (52.6%) / 4 (10.5%) / eight "(0%)", table rows "1.2 Mula Belajar" and "0.7 Mula Belajar" with Pelajar 4 / 21. | 28 | 09.3 | no |
| E2E-M18-30 | S1 corrections: "September 2026", notice "(2026-09)" without the developer line, 135 / 0 / "0.0%", rows "0 pelajar (0%)". | 29 | 10.1 | no |
| E2E-M18-31 | Profile `corrections-sep`: no notice; 8880 row "{n} pelajar ({p}%)". | 29 | 10.3 | yes |
| E2E-M18-32 | S1 "Laporan Terperinci" five links and targets. | 30 | 10.2 | no |
| E2E-M18-33 | Admin `/ppd/command-center` → 403 page. | 31 | 11.1 | no |
| E2E-M18-34 | PPD officer `/ppd/command-center`: standalone page "Command Center PPD", badge "PPD HULU LANGAT", clock, tiles = repository Q-M18-LIVE(district); second request after `mock.advanceTimers(10000)`. | 32 | 11.2 | yes |
| E2E-M18-35 | S3 head and the three empty-state variants (30 / 7 days / today with links). | 33 | 12.1, 12.2 | no |
| E2E-M18-36 | PPD officer S3 "30 Hari": table rows = repository Q-M18-USAGE(PPD HULU LANGAT, 30days). | 34 | 12.3 | yes |
| E2E-M18-37 | S4 30 days: 7 rows with medals, "Daerah / Negeri", values, badges, links `/ppd/sekolah/{id}`. | 35 | 13.1 | no |
| E2E-M18-38 | S4 7 days (KHIR JOHARI first) and today (ENGKU HUSAIN 1 · 57 · 60 · 95.0%). | 35 | 13.2 | no |
| E2E-M18-39 | S5 header "116" "Sekolah", "73.1%" "Purata Ketepatan", "0%" "Purata Aktif". | 36 | 14.1 | no |
| E2E-M18-40 | S5 116 rows; row 1 LAYANG-LAYANG "JEA2029" 21 · 0 · 0% · 73.1% · "222" "(10.6/pelajar)" · 22.6; rows 2–3 and the formula note. | 38 | 14.2 | no |
| E2E-M18-41 | S5 subject "Matematik (Teras)" → `?subject_id=3`, heading "— Matematik", 76.3% (row and header), "Kosongkan"; `?subject_id=99999` → all-subject heading + "Kosongkan". | 36, 37 | 14.3 | no |
| E2E-M18-42 | S5 "Eksport CSV" downloads a CSV with the 11 columns and 116 rows (BOM present). | 39 | 14.4 | yes |
| E2E-M18-43 | S6 h2, sub "· 7 subjek × 116 sekolah", legend. | 40 | 15.1 | no |
| E2E-M18-44 | S6 LAYANG-LAYANG cells 60.3 / 76.3 / 92.2 / 72.3, Purata 75.3; "0%" cells of CHONG HWA I (BI), SERI KENCANA (BM, MT, SEJ), TUN HUSSEIN ONN (Sains, SEJ); S5 with each core `subject_id` shows 8765 "Ketepatan" 60.3 / 76.3 / 92.2 / 72.3 or "—" and scores 18.7 / 23.5 / 28.3 / 22.3 / 0.6; footer; red cells ≤ 40; at 375 the hint shows and the table scrolls inside its card. | 41 | 15.2, 15.3 | no |
| E2E-M18-45 | S7 stats 116 / 72 / 0 / 73.1% / 222; meta "Format: CSV (UTF-8 BOM)", "Dijana: 25 Sep 2026, 15:40", "Daerah: PPD KLUANG, Johor". | 42, 43 | 16.1 | no |
| E2E-M18-46 | S7 preview 5 alphabetical rows and footer sentence. | 44 | 16.2 | no |
| E2E-M18-47 | S7 "Muat Turun CSV": header line exact, 116 rows, no IC / e-mail. | 43 | 16.3 | yes |
| E2E-M18-48 | S8 podium order and values; table row 1 21.9 with "—" Soalan/Pelajar and empty trend. | 46 | 17.1 | no |
| E2E-M18-49 | S8 "Ikut Subjek" changes only the tab highlight. | 45 | 17.2 | no |
| E2E-M18-50 | S8 at 375: card list with "🥇", "21 pelajar", "0 aktif (0%)", "73.1% tepat", "#4"; at 768 the table; "Eksport CSV" → `/ppd/export-laporan`. | 47 | 17.3 | no |
| E2E-M18-51 | Profile `trend`: the school's trend cell shows the "Meningkat" icon. | 48 | 17.4 | yes |
| E2E-M18-52 | `/ppd/sekolah/8880` head and counters; `/jpn/sekolah/8765` breadcrumb "PPD KLUANG" → `/jpn/daerah/PPD%20KLUANG` and cards 21 · 2 · 19 · 9.5% · 0 · 10.5. | 49 | 18.1, 18.2 | no |
| E2E-M18-53 | 8880 filter options; "— 4 Simulasi" + "Tapis" → `?class_id=516`, usage "0%", "Reset"; cards 59 · 4 · 55 · 6.8% · 0 · 15. | 50, 51 | 18.3, 18.2 | no |
| E2E-M18-54 | Section nav "Guru" scrolls to "Senarai Guru" and marks it. | 52 | 18.4 | no |
| E2E-M18-55 | "Statistik Bulanan" Feb / Mar 2026 rows; class 516 empty; `?subject_id=3` suffix "(subjek ditapis)". | 53 | 19.1 | no |
| E2E-M18-56 | Calendar 33 / 7,307 / 221, month labels, first tooltip "2025-09-26: 0 pelajar aktif, 0 betul". | 54 | 19.2 | no |
| E2E-M18-57 | "Laporan Subjek" 8880 three cards with Sebelum / Selepas; 8765 nine cards (MATH 6 · 184 · 45.6%, "Purata Level" 0.7). | 55 | 19.3 | no |
| E2E-M18-58 | "Ranking Pelajar" empty texts on both tabs and with a subject. | 56 | 19.4 | no |
| E2E-M18-59 | "Prestasi Per Kelas" "2 kelas dipaparkan" rows; 8765 "0 kelas dipaparkan" empty state. | 57 | 19.5 | no |
| E2E-M18-60 | Accordions and the "5 Simulasi" table (three "Tidak Aktif" rows with sessions, questions, accuracy, dates; "Belum Guna" rows "Tiada rekod"). | 58 | 20.1 | no |
| E2E-M18-61 | IC: list payloads contain no full IC; "Tunjuk IC Penuh" + cancel → no request; + accept → full fictitious ICs, button "Sembunyikan IC", `mock.audit.icReveals()` has 1 row (viewer 1, school 8880); "Sembunyikan IC" → masked again without a request. | 59 | 20.2, 20.3 | no |
| E2E-M18-62 | "Senarai Guru" 8880 two rows; 8765 empty state. | 60 | 20.4 | no |
| E2E-M18-63 | S10 header and six cards 1,189 · 135 · 2.49 "A-" · 135 · 71.6% · 81 (= repository queries). | 61, 113 | 21.1 | no |
| E2E-M18-64 | S10 district table 11 rows; KLUANG 118 · 135 · "135 (100%)" · 71.6%; others "—" "—" "0.0%"; links `/jpn/daerah/{PPD}`. | 63 | 21.2 | no |
| E2E-M18-65 | S10 filter: "PPD KLUANG" → "118 sekolah dijumpai" + "Reset"; "KLUANG" → "10 sekolah dijumpai"; "ZZZ" → "0 sekolah dijumpai" and "Tiada sekolah dijumpai"; "Reset" restores. | 62 | 21.3 | no |
| E2E-M18-66 | S10 GPS pager "Menunjukkan 1–20 daripada 1189 sekolah", buttons 1 2 … 60; risk table 7 distinct schools Σ 135 incl. TUN HUSSEIN ONN. | 64 | 22.1, 22.2 | no |
| E2E-M18-67 | S10 mastery 36.8 / 52.6 / 10.5%; kombo rows show school pupil counts; corrections section. | 65 | 22.3 | no |
| E2E-M18-68 | S10 "Laporan Terperinci" four links. | 66 | 22.4 | no |
| E2E-M18-69 | S11 standalone, "← Dashboard" → `/jpn/dashboard`, badge "Johor", "LIVE", clock changes after 1 s (`mock.advanceTimers`), footer text. | 67, 71 | 23.1 | no |
| E2E-M18-70 | S11 tiles 1,187 / "dari 1187 sekolah negeri", 72 / "6 aktif menjawab", "222", "83.8%"; panels: LAYANG-LAYANG → `/jpn/sekolah/8765` "6 plj", "0 soalan", "Minggu ini: 0", "Sama dengan minggu lepas", "Tiada data", "Tiada aktiviti terkini", 11 district rows ("116 sekolah · 72 pelajar", "6 aktif"); no "NaN", no "undefined", no console error. | 68, 69 | 23.2, 23.3 | no |
| E2E-M18-71 | S11 polling: a second `live-data` request after 10 s; none after leaving; `mock.failNext` keeps the last values. | 71 | 23.4 | yes |
| E2E-M18-72 | S11 "ALESA AI" sentence equals the template with the repository values ("stabil 0%", "8.3%", "83.8%", "1/1187", "0"). | 70 | 23.5 | yes |
| E2E-M18-73 | S12 head 0 / 0 / 0 and "Data belum tersedia"; `/jpn/daerah/PPD%20KLUANG` breadcrumb, head, empty card; the 11 Johor PPD names render. | 72 | 24.1, 24.2 | no |
| E2E-M18-74 | JPN officer + profile `usage-selangor`: S12 PROPOSED table rows = the snapshot rows. | 73 | 24.3 | yes |
| E2E-M18-75 | S13 head 2 / 7; PPD ranking two rows; school table = S4 with `/jpn/sekolah/{id}` links; 7 days and today variants. | 74 | 25.1, 25.2, 25.3 | no |
| E2E-M18-76 | Risk repository: fixtures with accuracy 38.9 / 41.1 / 83.1 (inactive, no mastery) → 84.4 / 83.6 / 66.8 "Berisiko Tinggi"; never active (no session, `lastActiveAt` null, no mastery) → 80 with the three "Tiada …" texts; activity-only (`lastActiveAt` > 30 days, `lastLoginAt` irrelevant) → 100; no session, `lastActiveAt` null, mastery L1 → 97 "Tiada data" / "Tiada aktiviti"; class-1156 pupil at the project clock → 44.7 "Perlu Perhatian" yellow row with its three texts. | 75, 76 | 26.1, 26.2, 26.3 | no |
| E2E-M18-77 | The class-1156 pupil's score / status are identical on S17, S22 (school of the pupil) and S23 (school scope). | 77 | 26.4 | no |
| E2E-M18-78 | `/amaran`: 750 cards by id descending, first three as observed, links `/amaran/kelas/{id}`. | 78 | 27.1 | no |
| E2E-M18-79 | `/amaran/kelas/1156`: back link, tiles 1 · 0 · 1 · 0, legend, row 44.7 with the pupil and "Intervensi" links, subject analysis SEJ 1/1 (100%), five 0/1 (0%). | 79, 77 | 27.2, 27.3 | no |
| E2E-M18-80 | Teacher opens a class that is not its own → 403 page. | 79 | 27.4 | yes |
| E2E-M18-81 | S18 tiles, bar, buttons (targets), school table 2 rows (HAMID KHAN 17 · 97.6, TOH TANDEWA SAKTI 16 · 97.5), pupil table 33 rows (29 × 100, 4 × 80, first row as observed). | 80 | 28.1, 28.2, 28.3 | no |
| E2E-M18-82 | S19 breadcrumb, header, tiles, only the summary button, district row 2 · 33 · 97.6, school rows HAMID KHAN 17 · 97.6 and TOH TANDEWA SAKTI 16 · 97.5 once each, 33 pupils. | 81 | 29.1, 29.2, 29.3 | no |
| E2E-M18-83 | `/amaran/sekolah/7780` pills, tiles, buttons, 17 pupils with level lines (15 × 100, 2 × 80); `/amaran/sekolah/1` 16 "Darjah n" pupils; `/sekolah/8880/amaran` 59 (13 × 100, 84.4, 83.6, 42 × 80, 66.8, 64) and the subject analysis; `?tingkatan=T5` 15 pupils 84.4 / 83.6 / 12 × 80 / 66.8, "Merah: 15"; `?tingkatan=T4` 15 × 80 "Tiada data latihan" "Tiada aktiviti" "Tiada data penguasaan" (as live). | 82 | 30.1, 30.2, 30.3 | no |
| E2E-M18-84 | S23 district (values, "Dijana: 25 September 2026, 15:40", table), state ("Negeri Perak", each school once), school 8880 (kombo 6.4 · 13 · 14 · 0, subject analysis). | 84 | 31.1, 31.2, 31.3 | no |
| E2E-M18-85 | S23 "Kembali" from S18 → `/amaran/ppd`; direct → scope page; "Cetak / PDF" calls `window.print` (stubbed); toolbar `display:none` under print media. | 83 | 31.4 | no |
| E2E-M18-86 | S20 back link, school select 119 options, cards 2 · 0% "0/0 dinilai" · 0 · 2, chart configs (doughnut [0,0,0,2], trend labels and data), type list, teacher row, follow-up rows → `/amaran/intervensi/3215`, school row. | 85, 86, 87 | 32.1, 32.2, 32.3 | no |
| E2E-M18-87 | S20 at 375: `scrollWidth ≤ clientWidth`; choosing a school → `?school_id=8880`, same figures. | 85, 87 | 32.4 | no |
| E2E-M18-88 | S21 header "SEKOLAH KEBANGSAAN MERU RAYA", back link → `/amaran/sekolah/127`, zero cards, both empty chart texts, "Belum Ada Intervensi" + link. | 88, 86 | 32.5 | no |
| E2E-M18-89 | Class CSV from S17 and district CSV from S18 (href uses the district key, not `/0`) download with the PROPOSED columns and no IC / e-mail. | 89, 90 | 33.1, 33.2 | yes |
| E2E-M18-90 | PPD officer requests `/api/amaran/export/school/8880` → 403, no download. | 89 | 33.3 | yes |
| E2E-M18-91 | `/amaran/intervensi/3215`: header, tiles 2 · 0 · 2, history two rows with badges, dates, selects, pencil, trash. | 91 | 34.1, 34.2 | no |
| E2E-M18-92 | "Kembali" from S20 → `/amaran/keberkesanan/ppd`; direct → `/amaran`. | 92 | 34.3 | no |
| E2E-M18-93 | Create form: 7 types ("Sesi Kaunseling" selected), date = 2026-09-25 (project clock), class select "— Tiada —" + the pupil's classes only (516), status options, placeholders, "Simpan Intervensi". | 93 | 35.1 | no |
| E2E-M18-94 | Empty "Catatan" blocks submit (`valueMissing`); filled submit → third record on top, tiles 3, S20 "Jumlah Intervensi" 3. | 93, 96 | 35.2 | yes |
| E2E-M18-95 | Effectiveness "Berkesan" saves on change; tile "Berkesan" 1; S20 "100%" "1/1 dinilai". | 94, 96 | 35.3 | yes |
| E2E-M18-96 | Pencil → follow-up saved; trash + cancel keeps; trash + OK removes. | 95 | 35.4 | yes |
| E2E-M18-97 | PPD officer (HULU LANGAT) POSTs an intervention for pupil 3215 → 403. | 96 | 35.5 | yes |
| E2E-M18-98 | S25 header (h2 computed colour white), cards 118 · 135 · 10,535 · 71.6%, school table 3 rows, subject cards, critical card 1 texts and chips, "Lihat Semua (20 soalan)" → 20 cards, "Sembunyikan". | 97, 98, 100, 113 | 36.1, 36.2, 36.3 | no |
| E2E-M18-99 | S26 header "JPN Johor", cards, district table (KLUANG first, 10 others 0 / "0.0%"), heading "Soalan Kritikal — Seluruh Negeri". | 97, 99 | 36.4 | no |
| E2E-M18-100 | S27 head, seven cards, GPS 2.49 "Baik" 148, grade rows and "Jumlah: 148 rekod", subject GPS 6 rows. | 101, 102 | 37.1, 37.2 | no |
| E2E-M18-101 | S27 level cards "4 kelas" / "5 kelas" with murid sum ≤ 59 (= repository school-scoped query); teacher cards count only 8880 pupils; "🔬 Analisa Item" → `/sekolah/8880/analisa-item`. | 103 | 37.3 | no |
| E2E-M18-102 | S30 head, cards 59 · 10,194 · 71.7%, profile 0 / 0 / 20, GPS card 2.49 "Baik" "Berdasarkan 148 entri headcount • Lebih rendah = lebih baik", "Prestasi 360" → S27. | 104, 105 | 38.1, 38.2 | no |
| E2E-M18-103 | S30 subject table rows; `?tingkatan=T4` 76.3% and T4 rows; pills and "Sains (6)" filter; card 1 opens with options, "(1x dipilih)", 2 pupil chips → `/prestasi/{id}`, "2 pelajar cuba", "3.4% pelajar terlibat". | 106 | 38.3, 38.4 | no |
| E2E-M18-104 | `/sekolah/2695/analisa-item` → "Tiada Data Pelajar" + sentence; `/sekolah/2700/analisa-item` → zeros, "Tiada data", no rows, no cards. | 107 | 38.5, 38.7 | no |
| E2E-M18-109 | `/sekolah/8765/analisa-item`: subject rows, pills, profile 5 / 0 / 1, card labels / icons / % salah / "pelajar cuba" / "% pelajar terlibat" for all, `?tingkatan=T4` and `?tingkatan=T5`; `/sekolah/2710/analisa-item` rows and no card. | 106 | 38.6 | no |
| E2E-M18-105 | S31 breadcrumb, h2, tiles 33 · 0 · 29 · 6 · 15, 122 rows (first three as observed, links `/kombo/sekolah/{id}`); S32 h2 "Kombo Harian — JPN Perak", 1,102 rows; tiles = repository Q-M18-KOMBO. | 108, 111 | 39.1, 39.2 | no |
| E2E-M18-106 | `/sekolah/8880/kombo` tiles 59 · 0 · 6.4 · 13 · 14 and 4 class rows; `/kombo/sekolah/7780` tiles 17 · 0 · 7 · 15 · 15, 10 class rows, top-10 current / best as observed; calendar labels and caption. | 109, 111 | 40.1, 40.2, 40.4 | no |
| E2E-M18-107 | Top-10 "Jumlah Hari": `/sekolah/2710/kombo` rows 15/19/0, 13/18/0, 1/5/13, 1/1/4; 8880 and 7780 rows 0 (stored counter, as live). | 110 | 40.3 | no |
| E2E-M18-108 | Responsive sweep S1, S3–S33 at 375 / 768 / 1280: `document.documentElement.scrollWidth ≤ clientWidth`; wide tables scroll inside their cards; S8 cards below 640 / table at 768; S11 fixed layout without page scroll; KPI grid column counts of §10. | 112 | 41.1, 41.2, 41.3 | no |

---

## 13. Open questions

URS §9 is authoritative (OQ-M18-01…11). Solution-architecture questions:

1. **SQ-M18-01 Orphan answer rows (§6.9 C9).** The two 8880 rows that M11 counts and M18 does not are modelled as answers to questions no longer in M04 (INFERRED). Classified (a) (AUD-M18-07). If M05 declines, the Delivery Lead decides at the XL batch 3 gate; no display constant is used for an owner total.
2. **SQ-M18-02 Feasibility of the pupil placement (XR-M18-02).** M02 v1.11 cannot hold the 78 lower-form / primary pupils of the observed schools without rebalancing its pools; the XL batch 3 reviewer must check the rebalanced allocation against M08 / M10 / M11.
3. **SQ-M18-03 Class 516 identity (XR-M18-08).** Live pupil 2229 → anchor 3215; 3201–3215 as active T4 answerers of 8880 taking over the answers of 15 Aktif generated rows (M11 Aktif 31 kept); `lastLoginAt` as M02 places it (M11 / M17), `lastActiveAt` null (v1.7, XR-M18-21) so S28 shows them "Tiada aktiviti" as live.
4. **SQ-M18-04 Mock daily job.** DATA-M18-03 / 04 are seeded from observation; `mock.runDailyJobs()` recomputes them from M05 at the clock and would replace the observed ranking (C11) — the admin-mirror E2E never run it.
