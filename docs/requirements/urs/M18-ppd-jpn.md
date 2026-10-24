# M18 — PPD & JPN: district and state portals, Amaran Awal, officer item analysis and Kombo views — User Requirements Specification

## 0. Document control

| Field | Value |
|---|---|
| Document | URS — M18 PPD & JPN (district / state education-office portals, Amaran Awal early warning and interventions, officer item analysis, school drill-downs, officer Kombo views) |
| Version | 1.7 |
| Date | 2026-09-27 |
| Status | **Approved (G1)** — 2026-09-27 (v1.3 applies XL batch 3 without changing the approval); independent audit PASS in round 2 (`docs/qa/audit/M18-audit.md`). OQ-M18-01 (officer account) does not block G1: the officer-only views stay INFERRED / provisional with `@provisional` E2E (as the teacher-account questions of M10–M12) and remain open for G5 verification. |
| Author | product-analyst (agent); data model, datasets and mock API of the companion SRS by solution-architect (agent) |
| Source discovery | [M18-ppd-jpn.md](../../discovery/M18-ppd-jpn.md) (§1–§9, defects D-M18-1…38 in §8.2, Q-M18-1…11, Appendices A–B); inventory [`inventory/M18/`](../../discovery/inventory/M18/) (`S1…S33-*.json`, `SHU-user-shell.json`, `_crawl.json`, `_summary.md`, dated seed snapshot `_snapshot-2026-09-26.json` captured 2026-09-26 12:36 MYT); 63 masked screenshots `docs/discovery/img/M18/` |
| Companion SRS | [srs/M18-ppd-jpn.md](../srs/M18-ppd-jpn.md) |
| Related | M01 v1.9 (User incl. `lastLoginAt`, guest redirect, 403/404 pages, landing BR-07: `ppd_officer` → `/ppd/dashboard`, `jpn_officer` → `/jpn/dashboard`, canonical accounts 1–11, school 900002 "SK Demo" in PPD KLUANG), M02 v1.11 (School register D11 10,220 schools with `district`/`state`/`isActive`, users D11 5,159 with `role`, `grade`, `schoolId`, `icNumber`, `ppdState`, `ppdDistrict`; canonical 9 PPD HULU LANGAT / Selangor, 10 Selangor; §6.15), M03 (subjects 1–31 and short codes, levels), M04 v1.9 (`questions.*`: stems, options, key, subject / topic / sub-topic, difficulty), M05 v1.8 (answer log DATA-M05-02, practice sessions DATA-M05-01, SubjectMastery DATA-M05-11, named queries §6.14.2), M08 v1.7 (headcount / GPS BR-M08-01…04, `/prestasi/*`, `/headcount/*`, `/analisa-item/sekolah*` — school item analysis owned by M08), M10 v1.6 (classrooms and enrolment, 750 classes), M11 v1.8 (monitoring register §6.7: school 8880 = 53 T4/T5 pupils, 10,196 answers; 8765 = 16, 210; 7780 = 6), M14 (streak store DATA-M14-08; `/kombo` redirect), M16 (tournament banner), M17 (Command Center pattern `/admin/command-center` + `live-data` polling, GPS 2.88), shells ([design/shells.md](../../design/shells.md) DV-SH-03, DV-SH-04) |

**Change log**

| Version | Date | Change |
|---|---|---|
| 1.7 | 2026-09-27 | **Revision history — v1.7, two-field model (Delivery Lead reversal of DV-M18-43 (c))** (status stays Approved (G1)). The risk "Terakhir aktif" reads a stored per-user activity date `lastActiveAt` (owner M02 / M01; SRS §6.1a, XR-M18-21), independent of `lastLoginAt`, which drives M11 / M17 login states; together they reproduce every observed value of 7780 and 8880. **DV-M18-43 and DV-M18-45 withdrawn — two-field model, 0 visible changes.** Restored as live: FN-M18-2.1.4 and AC-M18-07.3 "86 akademik berisiko, 49 belum mula latih"; AC-M18-30.3 (8880 T4 15 × 80, T5 84.4 / 83.6 / twelve 80 / 66.8); FN-M18-4.4.4, 4.5.5, 4.5.6, AC-M18-28.2, 28.3, 29.2, 30.2, 31.1 and DV-M18-18 (HAMID KHAN 97.6 first, TOH TANDEWA SAKTI 97.5, district 97.6, 29 × 100 then 4 × 80). |
| 1.6 | 2026-09-27 | **Revision history — v1.6, M02 v1.21 change request (F-23; BATANG PADANG logins)** (status stays Approved (G1)). Live S22 / S18 show 4 of 7780's 6 T4/T5 pupils with "Terakhir aktif: 2026-02-26 … 28" (score 100) while M11 S3 (25 Sep) shows all 6 "Belum login". Checked definitions: active vs all pupils, register vs all pupils (same six pupils on both sides), a login window (refuted by 8880's February-dated login-only pupils counted as logged in by M11), district / level membership (unchanged 33) — none reproduces both under the single `lastLoginAt`; the only fitting model (a second stored activity date) is the one rejected in DV-M18-43 (c). New **DV-M18-45** (D9): the M02 v1.21 placement wins — BATANG PADANG 29 / 4 → **25 / 8** (7780 11 / 6, school 1 14 / 2). Changed values: 4 pupil rows of 7780 (100 → 80 with the "Tiada …" texts), 7780 "Purata Skor" 97.6 → **92.9**, PPD BATANG PADANG 97.6 → **95.2**, school order on S18 / S19 / S23 (TOH TANDEWA SAKTI first); FN-M18-4.4.4, 4.5.5, 4.5.6, AC-M18-28.2, 28.3, 29.2, 30.2, 31.1 and DV-M18-18 restated. No other observed value changes. |
| 1.5 | 2026-09-27 | **Revision history — v1.5, XL batch 3 round 2 (R2-02)** (status stays Approved (G1)). 8765's 21 practice sessions (309 / 242) and 2700's single session fit no M05 store (the log is too small; KirkpatrickSessionAggregate is T4/T5 only), so they become M18 documented display values (new DATA-M18-07, reconciliation C30, alternatives recorded); Q-M18-SESS, §6.10, §6.11 D and XR-M18-05 no longer cite the M05 aggregate. No computed session figure of the same school and scope sits beside them (the calendar and S30 are answer-log figures, paired the same way on live). No visible change. |
| 1.4 | 2026-09-27 | **Revision history — v1.4** (status stays Approved (G1)). XR-M14-10: the school kombo means of 8880, 7780, 1, 2700, 8767 and 8772 cannot come from their own top-10 rows; kept as documented display values (new DV-M18-44, DATA-M18-06, C29, XR-M18-20; 0 visible changes vs ≈ 20 if computed). DV-M18-43: row count corrected to 28 and the alternatives listed with their visible-change counts (the M11-side alternative changes fewer values but overturns two modules' observations — rejected by the Delivery Lead). |
| 1.3 | 2026-09-27 | **Revision history — v1.3, XL batch 3** (`docs/qa/audit/cross-module-logic-M12-M18.md`; status stays Approved (G1)). XL3-20: 8880 login states follow the M02 v1.12 placement (14 never logged in) — new DV-M18-43 (D9) with the changed values (S1 split 114 / 21; 8880 risk rows of classes 516 / 517; average 93.5, order unchanged). XL3-21: 3201–3215's 6,563 answers are answers without a session (M05 v1.10). 8880's 2,956 other answers are `latih_tubi` sessions of T5 non-T4-class pupils. 8765's (and 2700's) sessions are read from M05 KirkpatrickSessionAggregate (M05 SQ-12 (a)); Q-M18-SESS reads each pupil from one store. XL3-33: entity renamed `AmaranIntervention`. XL3-35: class 517 stated as an anchor inside M10's 750 and M08's T5 3,911. XR-05 / XR-08 marked applied. |
| 1.2 | 2026-09-27 | **Revision history — v1.2, audit round 2 residuals and G1 approval.** R2-01: the stored critical-question set has one base and one owner (M08 item statistics, INFERRED; new XR-M18-19); Q-M18-CRIT no longer cites the answer log and includes 8765's 6 questions; XR-M18-10 drops the "Sukar" difficulty. R2-02: `pupilsWeak` on CorrectionSubject; 2710's five weakness rows seeded. R2-03: S5 "—" vs heat-map "0%" for a zero value, both replicated (BR-M18-19). R2-04: XR-M18-03 settled on a separate stored subject-accuracy set. R2-05: XR-M18-08 compensation uses 15 Aktif rows whose answers move to 3201–3215 (M11 Aktif 31 kept), decided at XL batch 3. Status Approved (G1); OQ-M18-01 open for G5. |
| 1.1 | 2026-09-27 | **Audit round 1 fixes** (Delivery Lead decisions and the audit top-up `_topup-2026-09-26.json`). AUD-01: single project clock 2026-09-25 15:40 (class-1156 risk 44.7; "Dijana", calendar window; ranking `generatedAt` ≤ clock, rows = the observed record). AUD-02: IC mask = live "xxxxxx-xx-xx" + last 2 digits. AUD-03: three accuracy bases (per-pupil = sessions; school × subject = a stored per-pupil subject figure; subject cards = answer log); v1.0 8765 split dropped; DV-M18-40 rejected (replicate 92.2); subject weakness from the correction aggregate. AUD-04: "Jumlah Hari" = stored counter, DV-M18-41 rejected, XR-M18-18. AUD-05: live pupil 2229 → M08 anchor 3215, XR-M18-08 restated with the M02 arithmetic. AUD-06: S30 list = stored per-question set, label from % salah (new AC-38.6/38.7, E2E-109). AUD-07 C9 = (a); AUD-08 source pool and class memberships; AUD-09 PROPOSED list and CSV columns; AUD-10 responsive rows; new Minor C28 (8765 class-based denominators). |
| 1.0 | 2026-09-26 | First issue under D7 (fidelity), D8 (proven completeness), D9/D10 (deviation rule, accessibility), D11 (every count computed from the owners' datasets through named queries; documented display data only where live itself stores an aggregate), D12 (one owner per store) and the privacy rule (fictitious pupils, teachers and IC numbers). §6 coverage matrix generated by script from the inventory JSON: **2,264/2,264** content elements covered, 0 unmapped (plus 417 shell elements accounted for). Count conflicts reconciled by script (85 checks, 0 failures; SRS §6.9). 42 deviation decisions (27 approved fixes, 14 rejected — replicate live, 1 replicate for the admin with a provisional officer page). Delivery Lead route decisions applied: `/analisa-item/ppd`, `/analisa-item/jpn`, `/kombo/ppd`, `/kombo/jpn`, `/kombo/sekolah/{id}`, `/amaran/*` and `/sekolah/{id}/*` belong to M18; school and teacher item analysis stays with M08; M14 owns the streak data. |

**Conventions** (as M01–M17)
- Quoted UI copy is the exact live text. English or mixed words that live shows ("Benchmark Sekolah", "Leaderboard Sekolah", "Command Center", "On Track", "Coverage Headcount", "Funnel", "Accuracy", "Below", "Top 50 Sekolah", "Live Feed", "Powered by ALESA AI", "Mythical", "Grandmaster", "Legend") are live copy and are kept. Where CSS upper-cases a text this is stated.
- **OBSERVED** = seen on the live site with the admin account (walk-through, inventory state, snapshot, screenshot). **SOURCE-DERIVED** = taken from page markup or script captured read-only, but the state itself never rendered (e.g. the S11 panels after the script error). **INFERRED** = the most likely live behaviour, not observed; no new UX is invented. **PROPOSED** / **PROPOSED COPY** = a value, layout or text written for the rebuild where live gives nothing; listed in §9 for the Delivery Lead to report at G1.
- **D-M18-n** = live defect of discovery §8.2; **N-M18-n** = a defect found while writing (not in discovery; §7). **Q-M18-n** = discovery open question. **DV-M18-nn** = fidelity deviation (§7); anything not listed there must match live. **SEC-M18-nn** = security / privacy item (SRS §11.1). **XR-M18-nn** = request to another module's owner (SRS §6.14).
- **Personal data (privacy overrides fidelity):** pupils are minors. Discovery masked every person name, e-mail and IC number (`<student:n>`, `<teacher:n>`, `<masked>`). School, PPD and state names are public anchors and are kept. Seeds use fictitious names ("Murid Demo …", "Guru Demo …") and **fictitious IC-shaped numbers** that cannot belong to a real person (SRS §6.11); no real name or IC is written anywhere.
- **Admin mirror vs officer views.** Every E2E value asserted for the admin is the observed value of the 2026-09-26 snapshot, reproduced by the owners' datasets (SRS §6.10–§6.11). The officer views (canonical 9 `ppd@demo.test`, 10 `jpn@demo.test`) compute the same queries over the INFERRED scope (FN-M18-1.2.3); their ACs are provisional (no officer account was used on live).
- "Admin" = `admin@demo.test` (canonical 1). Clock: the **single project clock 2026-09-25T15:40:00+08:00** (architecture §6.12; Delivery Lead decision on AUD-M18-01, as enforced for M14 and M17). Every time-dependent figure is computed at that clock and nothing is dated after it; the 2026-09-26 12:36 readings of discovery are the **observed record**. Figures that differ between the two instants are stated with both values (e.g. the class-1156 risk score: observed 45.7 on 26 Sep, **44.7** at the project clock — one day less since the observed last login 2026-09-15). PPD KLUANG, Johor and Perak have no activity in the last 30 days at either instant, so every "today" / "7 hari" / "30 hari" figure there is 0 as observed.

---

## 1. Overview

M18 is the officer area of PRESTASIPLUS. It serves the **district education office (PPD)** and the **state education department (JPN)** with aggregate views of the schools in their scope, the **Amaran Awal** early-warning system (per-pupil risk score, class / school / district / state risk views, an executive print report, and an intervention log with an effectiveness report), officer **item analysis** views, **school drill-downs** (performance, risk, kombo, item analysis) and officer **Kombo** views over the M14 streak data.

The TRACKER listed 11 M18 routes; the crawl found **33 screens** (22 new routes). Admin can open all of them except `/ppd/command-center` (403). The officer pages render inside the **user-portal shell** (SHU) on live.

**Routes covered**

| # | Route | Tab title (exact live) | Shell header (title / subtitle) | Admin outcome (observed) |
|---|---|---|---|---|
| S1 | `/ppd/dashboard` | "Dashboard PPD \| PRESTASIPLUS" | "Dashboard PPD" / "PPD KLUANG, Johor" | 200 (scope PPD KLUANG) |
| S2 | `/ppd/command-center` | "403 - Akses Ditolak \| PRESTASIPLUS" | standalone 403 | **403** |
| S3 | `/ppd/statistik-penggunaan` (`?period=`) | "Statistik Penggunaan Daerah — PPD KLUANG" | "Statistik Penggunaan Daerah" | 200, empty |
| S4 | `/ppd/ranking-kebangsaan` (`?period=`) | "Ranking Sekolah 1 Malaysia — PRESTASIPLUS" | "Ranking Sekolah 1 Malaysia" | 200, 7 schools |
| S5 | `/ppd/benchmark-sekolah` (`?subject_id=`) | "Benchmark Sekolah — PPD KLUANG" | "Benchmark Sekolah Daerah" | 200, 116 schools |
| S6 | `/ppd/peta-haba` | "Peta Haba Prestasi — PPD KLUANG" | "Peta Haba Prestasi Daerah" | 200 |
| S7 | `/ppd/export-laporan` (`?format=csv`) | "Eksport Laporan — PPD KLUANG" | "Eksport Laporan Daerah" | 200 |
| S8 | `/ppd/leaderboard-sekolah` (`?subject_id=`) | "Leaderboard Sekolah — PPD KLUANG" | "Leaderboard Sekolah Daerah" | 200 |
| S9 | `/ppd/sekolah/{id}` (`?grade=&class_id=&subject_id=`) | "{SEKOLAH} — Statistik" | "{SEKOLAH}" | 200; unknown id 404 |
| S10 | `/jpn/dashboard` | "Dashboard JPN \| PRESTASIPLUS" | "Dashboard JPN" / "Johor" | 200 (scope Johor) |
| S11 | `/jpn/command-center` | "Command Center JPN — Johor" | standalone dark page | 200 (script errors, D-M18-23) |
| S12 | `/jpn/statistik-penggunaan` | "Statistik Penggunaan Negeri — Johor" | "Statistik Penggunaan Negeri" | 200, "Data belum tersedia" |
| S13 | `/jpn/ranking-kebangsaan` (`?period=`) | "Ranking Kebangsaan — PRESTASIPLUS" | "Ranking Kebangsaan 1 Malaysia" / "JPN Johor" | 200 |
| S14 | `/jpn/daerah/{PPD}` | "{PPD} — Statistik Daerah" | "{PPD}" | 200; unknown name 404 |
| S15 | `/jpn/sekolah/{id}` | "{SEKOLAH} — Statistik" | "{SEKOLAH}" | 200 (template of S9) |
| S16 | `/amaran` | "Amaran Awal — Kelas \| PRESTASIPLUS" | "Amaran Awal — Kelas" / "Pilih kelas untuk lihat status risiko pelajar" | 200, every class |
| S17 | `/amaran/kelas/{id}` | "Amaran Awal — Kelas \| PRESTASIPLUS" | "Amaran Awal — Kelas" / "{kelas} — {subjek}" | 200; unknown id 403 (→ 404, DV-M18-27) |
| S18 | `/amaran/ppd` | "Amaran Awal — PPD \| PRESTASIPLUS" | "Amaran Awal — Daerah" / "PPD BATANG PADANG, Perak" | 200 |
| S19 | `/amaran/jpn` | "Amaran Awal — JPN \| PRESTASIPLUS" | "Amaran Awal — Negeri" / "Perak" | 200 |
| S20 | `/amaran/keberkesanan/ppd` (`?school_id=`) | "Keberkesanan Intervensi - PPD KLUANG" | "Keberkesanan Intervensi (Daerah)" / "PPD KLUANG, Johor · 118 sekolah" | 200 |
| S21 | `/amaran/keberkesanan` | "Keberkesanan Intervensi - SEKOLAH KEBANGSAAN MERU RAYA" | "Keberkesanan Intervensi" / "SEKOLAH KEBANGSAAN MERU RAYA" | 200, empty |
| S22 | `/amaran/sekolah/{id}` | "Amaran Awal — Sekolah \| PRESTASIPLUS" | "Amaran Awal — Sekolah" / "{SEKOLAH}" | 200 |
| S23 | `/amaran/ringkasan-eksekutif` (`?scope=district\|state\|school&district=&state=&school_id=`) | "Ringkasan Eksekutif — {scope} \| PRESTASIPLUS" | "Ringkasan Eksekutif" / scope | 200 |
| S24 | `/amaran/intervensi/{studentId}` | "Log Intervensi — {nama} \| PRESTASIPLUS" | "Log Intervensi" / "{nama}" | 200 (forms not submitted) |
| S25 | `/analisa-item/ppd` | "Analisa Item PPD \| PRESTASIPLUS" | "Analisa Item — PPD" | 200 |
| S26 | `/analisa-item/jpn` | "Analisa Item JPN \| PRESTASIPLUS" | "Analisa Item — JPN" | 200 |
| S27 | `/sekolah/{id}/prestasi` | "Dashboard Sekolah — Prestasi" | "Dashboard" / "Selamat datang kembali" (→ DV-M18-24) | 200 |
| S28 | `/sekolah/{id}/amaran` (`?tingkatan=T4\|T5`) | "Amaran Awal — Sekolah \| PRESTASIPLUS" | "Amaran Awal — Sekolah" / "{SEKOLAH}" (+ " — Tingkatan 4\|5") | 200 |
| S29 | `/sekolah/{id}/kombo` | "{SEKOLAH} — Kombo Harian \| PRESTASIPLUS" | "Kombo Harian — {SEKOLAH}" | 200 |
| S30 | `/sekolah/{id}/analisa-item` (`?tingkatan=`) | "Analisa Item Sekolah \| PRESTASIPLUS" | "Analisa Item — Sekolah" | 200; unknown id 200 empty (→ 404, DV-M18-26) |
| S31 | `/kombo/ppd` | "Kombo Harian PPD \| PRESTASIPLUS" | "Kombo Harian — PPD" | 200 (scope PPD BATANG PADANG) |
| S32 | `/kombo/jpn` | "Kombo Harian JPN \| PRESTASIPLUS" | "Kombo Harian — JPN" | 200 (scope Perak) |
| S33 | `/kombo/sekolah/{id}` | "{SEKOLAH} — Kombo Harian \| PRESTASIPLUS" | "Kombo Harian — {SEKOLAH}" | 200; unknown id 500 (→ 404, DV-M18-25) |

Probed and not found (global 404, replicated): `/ppd`, `/jpn`, `/jpn/benchmark-sekolah`, `/jpn/peta-haba`, `/jpn/export-laporan`, `/jpn/leaderboard-sekolah`, `/amaran/keberkesanan/jpn`, `/amaran/export`. JPN has no benchmark, heat map, export, leaderboard or effectiveness page of its own (as live). `/kombo` stays the M14 redirect to `/dashboard`.

**Downloads (not opened on live):** `/ppd/export-laporan?format=csv`, `/amaran/export/class/{id}`, `/amaran/export/school/{id}`, `/amaran/export/district/{id}` — file content PROPOSED from the page text (Q-M18-5).

**Cross-module ownership (Delivery Lead).** M18 owns every route above, the risk model, the intervention store, the IC-reveal audit and two stored aggregates the live system itself keeps (the daily ranking / usage snapshot and the correction aggregate, SRS §6.4–§6.5). Every other figure is computed from the owners' stores (D12): users, schools, districts and states → M01/M02; answers, sessions and mastery → M05; questions → M04; headcount and GPS → M08; classes → M10; streaks → M14. The school item-analysis component S30 is the same template as M08's `/analisa-item/sekolah/{id}` (crawl note); it is specified here from the observed populated state and offered to M08 as the shared component (XR-M18-09).

---

## 2. Actors

| Role | Involvement in M18 | Verified |
|---|---|---|
| Admin | Every screen (S2 403). Fixed preview scopes: PPD pages PPD KLUANG / Johor; JPN pages Johor; Amaran and Kombo officer pages PPD BATANG PADANG / Perak; S21 school SK MERU RAYA; S16 every class (FN-M18-1.2.4) | OBSERVED |
| Pegawai PPD (`ppd_officer`, canonical 9, PPD HULU LANGAT / Selangor) | Owner persona of the PPD pages, the district Amaran / Kombo / item-analysis views and the school drill-downs of the district; lands on `/ppd/dashboard` (M01 BR-07) | INFERRED (no officer account; Q-M18-1/2) |
| Pegawai JPN (`jpn_officer`, canonical 10, Selangor) | Owner persona of the JPN pages, the state Amaran / Kombo / item-analysis views and the school drill-downs of the state; lands on `/jpn/dashboard` | INFERRED |
| Guru (teacher, canonical 5) | Amaran Awal from the "PENILAIAN" group: own classes (S16/S17), pupils' intervention log (S24), own school's effectiveness (S21) | INFERRED |
| Admin Sekolah (`school_admin`, canonical 8) | Own school's risk (S22/S28), effectiveness (S21), drill-downs (S27, S29, S30) | INFERRED |
| Pelajar, Ibu Bapa, Penaja | Subjects of the data (pupils are minors); no access (M01 landing page / 403) | INFERRED |
| Guest | Redirected to `/login` | INFERRED |

Correction for `docs/design/shells.md` and master SRS FR-G-03: on live the `/ppd/*` and `/jpn/*` pages render in the **user-portal shell**, not the admin-panel shell (XR-M18-14).

---

## 3. Functional breakdown (Epic → Feature → Function)

Generated from the Function catalogue (`fns.cjs` in the author's scratchpad `m18-writer/`) and the element inventory. "EL" lists inventory element IDs (prefix `EL-M18-`). Functions with EL "—" are behaviours (access, scope, data rules, unobservable or PROPOSED states) with no element of their own.

### EP-M18-1 — Navigation, shell, access, scope and shared widgets


**FT-M18-1.1 — Menu entries, shell, header and tab titles**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M18-1.1.1 | User-portal desktop sidebar group heading **"PPD / JPN"** with **"Dashboard PPD"** (`fa-building-columns`) → `/ppd/dashboard`, **"Statistik PPD"** (`fa-chart-pie`) → `/ppd/statistik-penggunaan`, **"Ranking Kebangsaan"** (`fa-trophy`) → `/ppd/ranking-kebangsaan`, **"Dashboard JPN"** (`fa-building-flag`) → `/jpn/dashboard`, **"Ranking Kebangsaan JPN"** (`fa-trophy`) → `/jpn/ranking-kebangsaan` — the desktop rendering of the single M18 menu declaration of FN-M18-1.1.4 | SHU-104–109 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-1.1.2 | User-portal mobile drawer PPD / JPN entries (hidden until the drawer opens, below 1024 px): **"Command Center LIVE"** (`fa-satellite-dish`, badge "LIVE") → `/ppd/command-center`, "Dashboard PPD" → `/ppd/dashboard`, **"Statistik Penggunaan"** (`fa-chart-pie`) → `/ppd/statistik-penggunaan`, "Ranking Kebangsaan" (`fa-trophy`) → `/ppd/ranking-kebangsaan`, **"Benchmark Sekolah"** (`fa-ranking-star`) → `/ppd/benchmark-sekolah`, **"Peta Haba"** (`fa-map-location-dot`) → `/ppd/peta-haba`, **"Export Laporan"** (`fa-file-export`) → `/ppd/export-laporan`, **"Leaderboard Sekolah"** (`fa-trophy`) → `/ppd/leaderboard-sekolah`, "Dashboard JPN" (`fa-building-flag`) → `/jpn/dashboard`, "Statistik Penggunaan" (`fa-chart-pie`) → `/jpn/statistik-penggunaan`, "Ranking Kebangsaan" (`fa-trophy`) → `/jpn/ranking-kebangsaan` | SHU-189–200 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-1.1.3 | **"Amaran Awal"** (`fa-exclamation-triangle`) → `/amaran` in the drawer's first group (after "Analisa Item") and in the teacher group "PENILAIAN" (after "Laporan"); both kept as live (two groups, not a broken duplicate; D10) | SHU-178, 264 | Admin (OBSERVED); Guru, officers (INFERRED) | OBSERVED |
| FN-M18-1.1.4 | One menu declaration for the M18 entries (DV-SH-04, shells.md §6): the desktop sidebar and the drawer render the **same** ordered list = the drawer set of FN-M18-1.1.2 plus "Amaran Awal"; so Benchmark, Peta Haba, Export, Leaderboard and Command Center become reachable at ≥ 1024 px (D-M18-18, DV-M18-11). Labels: the drawer labels ("Statistik Penggunaan", "Ranking Kebangsaan"); the desktop-only labels "Statistik PPD" / "Ranking Kebangsaan JPN" are not kept. Role filtering at render time (FR-G-04): admin sees every entry (OBSERVED); `ppd_officer` the PPD entries and "Amaran Awal", `jpn_officer` the JPN entries and "Amaran Awal" (INFERRED, Q-M18-2) | — | All | OBSERVED + DV-SH-04 / INFERRED (officer filtering) |
| FN-M18-1.1.5 | Shell header title / subtitle per screen (exact live): S1 "Dashboard PPD" / "{PPD}, {negeri}" ("PPD KLUANG, Johor"); S3 "Statistik Penggunaan Daerah"; S4 "Ranking Sekolah 1 Malaysia"; S5 "Benchmark Sekolah Daerah"; S6 "Peta Haba Prestasi Daerah"; S7 "Eksport Laporan Daerah"; S8 "Leaderboard Sekolah Daerah"; S9/S15 "{SEKOLAH}"; S10 "Dashboard JPN" / "{negeri}"; S12 "Statistik Penggunaan Negeri"; S13 "Ranking Kebangsaan 1 Malaysia" / "JPN {negeri}"; S14 "{PPD}"; S16 "Amaran Awal — Kelas" / "Pilih kelas untuk lihat status risiko pelajar"; S17 "Amaran Awal — Kelas" / "{kelas} — {subjek}" ("5 CYBER — Sains Rumah Tangga"); S18 "Amaran Awal — Daerah" / "{PPD}, {negeri}"; S19 "Amaran Awal — Negeri" / "{negeri}"; S20 "Keberkesanan Intervensi (Daerah)" / "{PPD}, {negeri} · {n} sekolah"; S21 "Keberkesanan Intervensi" / "{SEKOLAH}"; S22/S28 "Amaran Awal — Sekolah" / "{SEKOLAH}" (S28 with `tingkatan` + " — Tingkatan 4" / " — Tingkatan 5"); S23 "Ringkasan Eksekutif" / scope name; S24 "Log Intervensi" / "{nama pelajar}"; S25 "Analisa Item — PPD"; S26 "Analisa Item — JPN"; S29/S33 "Kombo Harian — {SEKOLAH}"; S30 "Analisa Item — Sekolah" (unknown school sub "Analisis Item Seluruh Sekolah" is not rendered: 404, DV-M18-26); S31 "Kombo Harian — PPD"; S32 "Kombo Harian — JPN" | SHU-136–137, 373–400, 402–407, 410–417 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-1.1.6 | Header fixes: S27 shows **"Dashboard Prestasi Sekolah"** / "{SEKOLAH}" instead of the generic "Dashboard" / "Selamat datang kembali" (DV-M18-24, DV-SH-03; both strings are live copy of the page); S23 subtitle and tab title read **"PPD BATANG PADANG"** instead of "PPD PPD BATANG PADANG" (DV-M18-22) | SHU-401, 408–409 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED + DV-M18-22, DV-M18-24 |
| FN-M18-1.1.7 | Tab titles (exact live): S1 "Dashboard PPD \| PRESTASIPLUS"; S3 "Statistik Penggunaan Daerah — {PPD}"; S4 "Ranking Sekolah 1 Malaysia — PRESTASIPLUS"; S5 "Benchmark Sekolah — {PPD}"; S6 "Peta Haba Prestasi — {PPD}"; S7 "Eksport Laporan — {PPD}"; S8 "Leaderboard Sekolah — {PPD}"; S9/S15 "{SEKOLAH} — Statistik"; S10 "Dashboard JPN \| PRESTASIPLUS"; S11 "Command Center JPN — {negeri}"; S12 "Statistik Penggunaan Negeri — {negeri}"; S13 "Ranking Kebangsaan — PRESTASIPLUS"; S14 "{PPD} — Statistik Daerah"; S16/S17 "Amaran Awal — Kelas \| PRESTASIPLUS"; S18 "Amaran Awal — PPD \| PRESTASIPLUS"; S19 "Amaran Awal — JPN \| PRESTASIPLUS"; S20 "Keberkesanan Intervensi - {PPD}"; S21 "Keberkesanan Intervensi - {SEKOLAH}"; S22/S28 "Amaran Awal — Sekolah \| PRESTASIPLUS"; S23 "Ringkasan Eksekutif — {scope} \| PRESTASIPLUS" (scope "PPD BATANG PADANG", "Negeri Perak", "{SEKOLAH}"); S24 "Log Intervensi — {nama} \| PRESTASIPLUS"; S25 "Analisa Item PPD \| PRESTASIPLUS"; S26 "Analisa Item JPN \| PRESTASIPLUS"; S27 "Dashboard Sekolah — Prestasi"; S29/S33 "{SEKOLAH} — Kombo Harian \| PRESTASIPLUS"; S30 "Analisa Item Sekolah \| PRESTASIPLUS"; S31 "Kombo Harian PPD \| PRESTASIPLUS"; S32 "Kombo Harian JPN \| PRESTASIPLUS" | — | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-1.1.8 | Shell by screen: every M18 page renders in the **user-portal shell** (SHU: sidebar/drawer, header with the M14 chips, bell, bottom nav, M16 tournament banner in `<main>`) — as live for the admin; `docs/design/shells.md` and master FR-G-03 assign `/ppd/*`, `/jpn/*` to the admin-panel shell, which live contradicts (request XR-M18-14). S11 is a standalone full-screen page without shell; the 403 / 404 pages are standalone (M01). What a real officer gets is not observable (Q-M18-2): the prototype uses SHU for officers too (provisional) | — | All | OBSERVED (admin) / INFERRED (officers) |

**FT-M18-1.2 — Access, scope and error outcomes**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M18-1.2.1 | Every M18 route requires a session; a guest is redirected to `/login` (M01 guard) | — | Guest | INFERRED |
| FN-M18-1.2.2 | Route families and roles (SRS §9): **PPD pages** S1–S9, S20, S25, S31 → `admin`, `ppd_officer`; **JPN pages** S10–S15, S19, S26, S32 → `admin`, `jpn_officer`; **Amaran** S16, S17, S22, S24, S28 → `admin`, `teacher`, `school_admin`, `ppd_officer`, `jpn_officer` within their scope; S21, S23 → the same roles; **school drill-downs** S27, S29, S30, S33 → `admin`, officers, `school_admin` of that school; other roles → M01 landing page (page) / 403 (API). Admin: every page 200 except S2 (OBSERVED); every non-admin rule INFERRED (provisional) | — | All | OBSERVED (admin) / INFERRED |
| FN-M18-1.2.3 | **Officer scope rule (INFERRED from the canonical seeds, Q-M18-1):** a `ppd_officer` is scoped to one district = its `ppdDistrict` + `ppdState` (canonical 9: "PPD HULU LANGAT", "Selangor"); a `jpn_officer` to one state = its `ppdState` (canonical 10: "Selangor"). Every aggregate, list, select and drill-down of the officer pages is limited to schools with that `district`/`state` (M02 School). JPN pages accept a district of the officer's state (S14 `/jpn/daerah/{PPD}`); PPD pages accept only the officer's district | — | PPD / JPN officer | INFERRED |
| FN-M18-1.2.4 | **Admin preview scope (OBSERVED, unexplained on live, replicated — DV-M18-37):** the admin has no district/state of its own; the pages resolve to fixed observed scopes: PPD analytics pages (S1, S3, S5–S9, S20, S25) → **PPD KLUANG, Johor**; JPN pages (S10–S15, S26) → **Johor**; Amaran and Kombo officer pages (S18, S19, S23 without `scope`, S31, S32) → **PPD BATANG PADANG, Perak** / **Perak**; S21 → the school **SEKOLAH KEBANGSAAN MERU RAYA** (id 127); S16 lists every class of the system; S24's class select every class (DV-M18-23 limits it to the pupil's classes). No district/state picker (as live) | — | Admin | OBSERVED |
| FN-M18-1.2.5 | Out-of-scope drill-down for an officer (a school, class, pupil or district outside the officer's scope, e.g. `/ppd/sekolah/{id of another district}`): the page returns the global **403** page and the API `403 FORBIDDEN` (INFERRED; live lets the admin open any national school id). Admin: no scope check on school ids (OBSERVED: S9 opens any national school id) | — | Officers (INFERRED); Admin (OBSERVED) | INFERRED / OBSERVED (admin) |
| FN-M18-1.2.6 | Global **403** page (M01, standalone): "403", "🚫", h1 "Akses Ditolak", "Anda tidak mempunyai kebenaran untuk mengakses halaman ini. Sila log masuk dengan akaun yang betul atau hubungi pentadbir.", "Halaman Utama" → `/`, "Log Masuk" → `/login`, "PRESTASIPLUS"; tab "403 - Akses Ditolak \| PRESTASIPLUS" — shown for `/ppd/command-center` to the admin (S2, OBSERVED) and for every out-of-scope request of FN-M18-1.2.5 | S2-001–007 | Admin (OBSERVED); officers (INFERRED) | OBSERVED |
| FN-M18-1.2.7 | Global **404** page (M01, standalone): "404", "🔍", h1 "Halaman Tidak Dijumpai", "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?", "Halaman Utama" → `/`, "Mula Latihan" (target per M01 DV-02; live `/latih-tubi`), "PRESTASIPLUS" — for unknown or non-numeric ids on `/ppd/sekolah/{id}`, `/jpn/sekolah/{id}`, unknown `/jpn/daerah/{PPD}` names (OBSERVED), `/ppd`, `/jpn`, `/jpn/benchmark-sekolah`, `/jpn/peta-haba`, `/jpn/export-laporan`, `/jpn/leaderboard-sekolah`, `/amaran/keberkesanan/jpn`, `/amaran/export` (OBSERVED), and unknown ids on S17, S22, S24, S27–S30, S33 (FN-M18-1.2.8) | S9-190–196; S14-018–024 | All | OBSERVED + M01 DV-02 |
| FN-M18-1.2.8 | Unknown ids that live answers with another status render the **404** page instead (DV-M18-25/26/27; DL precedent): `/amaran/kelas/{unknown}` (live 403 "Akses Ditolak"), `/kombo/sekolah/{unknown}` (live 500 "Ralat Pelayan", "⚙️", "Sesuatu tidak kena di pihak kami. Pasukan teknikal telah dimaklumkan. Sila cuba sebentar lagi.", "Cuba Semula" → `javascript:location.reload()`), `/sekolah/{unknown}/analisa-item` (live 200 with "Sekolah Tidak Dinyatakan" / "Maklumat sekolah tidak tersedia"); the live copies are not rendered. The same rule applies to unknown ids on S22, S24, S27, S28, S29 (not probed on live) | S17-040–046; S30-076–078; S33-045–051 | All | OBSERVED (live outcome) + DV-M18-25/26/27 |
| FN-M18-1.2.9 | Reserved fixture schools **900001–900099** (M02) are excluded from every M18 district / state / national aggregate, list and select (as M11 BR-M11-34 and M17), so the observed Johor, PPD KLUANG, Perak and national figures stay exact (canonical school 900002 "SK Demo" is in PPD KLUANG, M01). Their own drill-down URLs still render (INFERRED) | — | All | INFERRED (D11 consistency with M11) |

**FT-M18-1.3 — Shared widgets and formats**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M18-1.3.1 | Common page head (S1, S3–S10, S12–S15, S19, S25, S26, S30–S32): breadcrumb row (`text-sm`) — back link with `fa-arrow-left`, "/", current label — then a header card (`card`, gradient icon tile) with the scope h2, a sub line and 1–3 counters on the right; per-screen labels in the screen Functions | — | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-1.3.2 | Period pills (S3, S4, S13): links **"Hari Ini"** (`fa-calendar-day`, `?period=today`), **"7 Hari"** (`fa-calendar-week`, `?period=7days`), **"30 Hari"** (`fa-calendar`, `?period=30days`, default, active style); a missing or unknown `period` (`bogus`) behaves as the default; the active pill is highlighted; the period label is echoed in the page sub-lines ("· 30 Hari", "· 7 Hari", "· Hari Ini") | S3-015–017; S4-010–012; S13-015–017 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-1.3.3 | Rank medals: places 1–3 show **🥇 🥈 🥉**, then the number ("4", "5" …; mobile S8 "#4") — in the S1/S10 GPS, kombo, mastery, correction and district tables, S4/S13, S5/S8, S25/S26 comparisons, S29/S33 top-10 and S31/S32 tables (as live, whatever the row values); the risk tables (S1/S10, S17–S19, S22/S28) number every row 1, 2, 3 …; legend texts "Tempat 1 — Emas", "Tempat 2 — Perak", "Tempat 3 — Gangsa" as `sr-only` / tooltip next to the medals (S5, S8). S5 and S8 show "🏋" for place 1 on live; the rebuild shows 🥇 (DV-M18-01) | S5-031–033; S8-059–061 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED + DV-M18-01 |
| FN-M18-1.3.4 | Client-side table pagers, 20 rows per page: **S1** `tablePager(20)` per table — "{a}–{b} daripada {n}", "{page} / {pages}", chevron buttons (`fa-chevron-left` disabled on page 1, `fa-chevron-right` disabled on the last page); the pager is hidden when the table has ≤ 20 rows (`totalPages > 1`); the table's "Cari sekolah..." search filters and re-paginates; **S10** `table[data-paginate]` — "Menunjukkan {a}–{b} daripada {n} sekolah", numbered buttons (1, 2, "…", last) and chevrons; the S10 filter (FN-M18-3.1.3) re-paginates every table | S1-060–066, 086–092, 139–145, 198–204, 218–224; S10-053–059, 078, 124–130, 168–174, 185–191 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-1.3.5 | Number and date formats (OBSERVED): integers with "," thousands separators ("1,189", "10,535", "7,307"); percentages with 1 decimal ("71.6%", "36.8%") except integer or whole values printed as live ("0%", "100%", "20%", "60%"); kombo averages with 1 decimal, ".0" dropped at district level ("6", "7.2", "6.4"); dates "13 Apr 2026", "2026-09-15" (risk tables), "17/03/2026" (S9), month labels "Feb 2026", "Mei 2026", "Ogs 2026"; times on S7/S23 in **MYT** (DV-M18-07) | — | All | OBSERVED + DV-M18-07 |
| FN-M18-1.3.6 | Loading and errors: data views show the shell loading behaviour while the mock responds and the M01 global error convention on a mock failure; no M18-specific loading or error copy exists on live (server-rendered pages) | — | All | INFERRED (M01 convention) |
| FN-M18-1.3.7 | Text size: content text rendered below 12 px on live (S1 KPI sub-lines 11 px and mastery "catatan"/"(n%)" 10 px, S9/S15 subject-card labels 10 px, S11 labels 9.6–11.5 px, S20/S21 sub-lines 10 px, S23 card labels and footer 10 px, S24 badges and dates 10 px, S25/S26 "Pelajar salah:" 10 px, S30 sparkline years 8.8 px) is raised to **12 px** (DV-M18-30, as M03 DV-06b / M08 DV-18 / M11 DV-23); icons and layout unchanged | — | All | OBSERVED + DV-M18-30 |

### EP-M18-2 — PPD portal (S1–S9, S15)


**FT-M18-2.1 — Dashboard PPD (S1 `/ppd/dashboard`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M18-2.1.1 | Breadcrumb "Papan Pemuka" (`fa-arrow-left`) → `/ppd/dashboard` (self, as live) / "Dashboard PPD"; header card h2 "{PPD}" ("PPD KLUANG"), "{negeri}" ("Johor"), "Dashboard Agregat Pejabat Pendidikan Daerah", counters "{schools}" "Sekolah" (118) and "{students}" "Pelajar" (135) | S1-004–014 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-2.1.2 | KPI cards (`grid-cols-2 lg:grid-cols-3`, labels upper case by CSS): **"Jumlah Sekolah"** 118 "Semua sekolah daftar di daerah (termasuk inactive)" (Q-M18-SCH(district, all)); **"Jumlah Pelajar"** 135 "Enrolmen pelajar (semua, termasuk belum aktif)" (Q-M18-STU(district, all schools)) | S1-015–022 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-2.1.3 | KPI **"GPS Purata"** "2.49" + grade chip "A-" (grade at round(GPS)), "Gred Purata Sekolah · Skala 1.00–9.00 (rendah=baik) · Hanya pelajar yang ada markah Headcount" — M08 headcount GPS over the district's graded entries (Q-M08-GPS(schools of the district)); "—" without entries (INFERRED) | S1-023–027 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-2.1.4 | KPI **"Pelajar Berisiko Merah"** "{red}" (135), "{p}% daripada {n} pelajar" ("100% daripada 135 pelajar"), "Zon risiko gagal SPM (EWS) · perlu intervensi segera", "⚠ Drp ini: **{a}** akademik berisiko, **{b}** belum mula latih" (86 / 49, as live; a + b = red; b = red pupils with no session, no stored activity date `lastActiveAt` and no mastery record, BR-M18-15) | S1-028–035 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED / INFERRED (split rule) |
| FN-M18-2.1.5 | KPI **"Ketepatan Keseluruhan"** "71.6%" "% jawapan betul dari semua quiz pelajar (lifetime)" = correct ÷ answers over the district's pupils' answer log (Q-M18-ANS(district)) | S1-036–039 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-2.1.6 | KPI **"Kombo Aktif"** "81" "daripada 135 pelajar" "Pelajar dgn streak latih tubi harian aktif (engagement)" — pupils with an active M14 streak (Q-M18-KOMBO) | S1-040–044 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-2.1.7 | KPI **"Coverage Headcount"** "64" "(47.4%)" "daripada 135 pelajar enrolled" "Pelajar yang ada markah Headcount masuk · skop GPS calc" "📊 Funnel: 65 dlm Headcount (48.1%) → 64 ada markah" — M08 headcount: pupils in a headcount config (65) and pupils with ≥ 1 graded mark (64) | S1-045–051 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-2.1.8 | Section **"Prestasi GPS — Perbandingan Sekolah"** "Kedudukan sekolah mengikut Gred Purata Sekolah (GPS) — lebih rendah lebih baik": search "Cari sekolah..." and table "#" · "Sekolah" (name link with `fa-external-link-alt` → `/sekolah/{id}/prestasi`) · "GPS" · "Gred" · "Pelajar" — every school of the district (118), schools with a GPS first by GPS ascending, then the others ("—" "—") in the live order (by school id) | S1-052–059 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-2.1.9 | Section **"Amaran Awal — Taburan Risiko"** "Taburan risiko pelajar merentasi sekolah dalam daerah": three tiles "{n}" "On Track" "{p}%", "{n}" "Perlu Perhatian" "{p}%", "{n}" "Berisiko Tinggi" "{p}%" (0 / 0 / 135 → 0% / 0% / 100%); bar "Taburan Risiko Keseluruhan Daerah" "{p}%" with the legend "Hijau: {n}", "Kuning: {n}", "Merah: {n}" | S1-067–083 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-2.1.10 | Risk table: search "Cari sekolah..." and "#" · "Sekolah" (link → `/sekolah/{id}/amaran`) · "Pelajar" · "Hijau" · "Kuning" · "Merah" — only schools with ≥ 1 pupil (7 rows), each school once, by average risk score descending as S18 (INFERRED sort key; the OBSERVED order CHONG HWA I 12, TUN HUSSEIN ONN 13, TAMAN KLUANG BARAT 12, SERI KENCANA 14, KAMPONG CHAMEK 4, LAYANG-LAYANG 21, TINGGI KLUANG 59 is reproduced by the risk inputs of the seeded pupils, BR-M18-22) | S1-084–085 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-2.1.11 | Section **"Analisa Item — Prestasi Mengikut Subjek"** "Ketepatan jawapan merentasi semua subjek dalam daerah": one card per subject with answers, accuracy ascending: name, "{p}%", `fa-users` "{n} pelajar", `fa-list-check` "{n} soalan" (distinct questions), `fa-times-circle` "{n} salah" (wrong answers) — Sejarah 70.7% · 31 · 1,154 · 649; Sains 70.9% · 29 · 1,094 · 539; Bahasa Melayu 71.1% · 32 · 545 · 634; Bahasa Inggeris 71.9% · 29 · 851 · 539; Matematik 72.6% · 37 · 828 · 631; Pendidikan Islam 92.3% · 1 · 50 · 4 ("salah" > "soalan" is consistent: distinct questions vs wrong attempts, DV-M18-33) | S1-093–125 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-2.1.12 | Section **"Kombo Latihan — Gambaran Daerah"** "Penglibatan harian pelajar merentasi sekolah dalam daerah": tiles "81" "Kombo Aktif", "135" "Jumlah Pelajar", "7.2" "Purata Kombo" (mean current kombo of the kombo-active pupils), "0" "Berlatih Hari Ini" | S1-126–136 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-2.1.13 | Kombo table: search and "#" · "Sekolah" (link → `/sekolah/{id}/kombo`) · "Pelajar" · "Kombo Aktif" · "Purata Kombo" ("{x} hari"); every school of the district, by kombo-active count descending then the live order; "Pelajar" = the school's pupil count (live shows 0 on every row, DV-M18-04) | S1-137–138 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED + DV-M18-04 |
| FN-M18-2.1.14 | Section **"Tahap Penguasaan — Taburan Daerah"** "Taburan tahap penguasaan pelajar merentasi daerah": note "📊 **{r} catatan penguasaan** daripada **{u} pelajar unik** (1 pelajar boleh ada catatan untuk pelbagai subjek)" (38 / 12); 11 level tiles in ladder order "Pemula", "Mula Belajar", "Aktif", "Tekun", "Mahir", "Pakar Muda", "Cemerlang", "Master", "Grandmaster", "Legend", "Mythical", each "{n}" "catatan" "({p}%)" with p = n ÷ records (14 / 20 / 4 → 36.8% / 52.6% / 10.5%; zero tiles "(0%)") | S1-146–195 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-2.1.15 | Mastery table: search and "#" · "Sekolah" (link → `/sekolah/{id}/analisa-item`) · "Pelajar" (school pupil count, DV-M18-04) · "Purata Tahap" ("{x} {level name}", e.g. "1.2 Mula Belajar", "0.7 Mula Belajar", "0.0 Pemula") by average level descending then the live order | S1-196–197 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED + DV-M18-04 |
| FN-M18-2.1.16 | Section **"Pembetulan — Gambaran Daerah"** "Kadar pembetulan pelajar untuk {Bulan YYYY}" ("September 2026", current month at the clock); when the month has no correction aggregate: amber notice `fa-triangle-exclamation` "Tiada data pembetulan untuk bulan ini ({YYYY-MM})" ("(2026-09)"); tiles "{n}" "Jumlah Pelajar" (135), "{n}" "Jumlah Pembetulan" (0), "{p}%" "Kadar Purata" ("0.0%") | S1-205–208, 210–215 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-2.1.17 | The developer line "Data agregat dijana oleh `php artisan correction:backfill`. Jika konsisten kosong, cron mungkin terhenti. Hubungi admin teknikal." is **not shown** to officers (DV-M18-05); the notice keeps only its first line | S1-209 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED + DV-M18-05 |
| FN-M18-2.1.18 | Corrections table: search and "#" · "Sekolah" (link → `/sekolah/{id}/prestasi`) · "Pelajar" · "Pembetulan" ("{n} pelajar ({p}%)", "0 pelajar (0%)") — every school of the district | S1-216–217 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-2.1.19 | Card **"Laporan Terperinci"** "Akses laporan mendalam untuk setiap modul": link tiles "Statistik Penggunaan" (`fa-chart-pie`) → S3, "Amaran Awal PPD" (`fa-bell`) → `/amaran/ppd`, "Analisa Item PPD" (`fa-chart-bar`) → `/analisa-item/ppd`, "Keberkesanan Intervensi" (`fa-chart-pie`) → `/amaran/keberkesanan/ppd`, "Papan Pemuka" (`fa-house`) → `/ppd/dashboard` (self link kept, DV-M18-29) | S1-225–232 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |

**FT-M18-2.2 — Command Center PPD (S2 `/ppd/command-center`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M18-2.2.1 | Admin → the global 403 page (OBSERVED; Delivery Lead: replicate). The menu entry stays (FN-M18-1.1.2) | — | Admin | OBSERVED |
| FN-M18-2.2.2 | `ppd_officer` → the S11 Command Center component at **district** scope (provisional, Q-M18-3; DV-M18-36): tab "Command Center PPD — {PPD}" and h1 "Command Center PPD" (PROPOSED COPY built from the live menu label), badge "{PPD}", "← Dashboard" → `/ppd/dashboard`, the four tiles and six panels of FN-M18-3.2.2–3.2.8 over the district, "Pecahan Daerah" replaced by the district's schools (PROPOSED), polling `GET /api/ppd/command-center/live-data` every 10 s | — | PPD officer | INFERRED / PROPOSED |

**FT-M18-2.3 — Statistik Penggunaan Daerah (S3 `/ppd/statistik-penggunaan`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M18-2.3.1 | Breadcrumb "Dashboard PPD" → S1 / "Statistik Penggunaan"; header "{PPD}" "{negeri}", "Statistik Penggunaan PRESTASIPLUS Dalam Daerah", counters "{n}" "Sekolah" and "{n}" "Pelajar Aktif" (schools / pupils with practice in the period; PPD KLUANG 0 / 0) | S3-004–014 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-2.3.2 | Empty state (no practice in the district in the period): card "Tiada data untuk tempoh ini" + "Tiada aktiviti latihan dalam tempoh 30 Hari yang lepas." (`period=7days`: "… 7 Hari …"; `period=today`: "Belum ada pelajar buat latihan hari ini. Cuba lihat **7 Hari** atau **30 Hari**." with the two words as links to `?period=7days` / `?period=30days`) | S3-018–024 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-2.3.3 | Filled state (district with practice in the period; e.g. officer 9 PPD HULU LANGAT): table of the district's schools with practice "#" · "Sekolah" (→ `/ppd/sekolah/{id}`) · "Pelajar" · "Betul" · "Dijawab" · "Ketepatan" (badge), by correct answers descending — **PROPOSED layout** reusing the S4 row format; the live filled layout is not observable (Q-M18-4, provisional) | — | PPD officer | PROPOSED |

**FT-M18-2.4 — Ranking Sekolah 1 Malaysia (S4 `/ppd/ranking-kebangsaan`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M18-2.4.1 | Breadcrumb "Dashboard PPD" / "Ranking Kebangsaan"; h2 "Ranking Sekolah 1 Malaysia", sub "Top 50 sekolah paling aktif merentas seluruh Malaysia · {30 Hari\|7 Hari\|Hari Ini}" | S4-004–009 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-2.4.2 | Card **"Top 50 Sekolah — 1 Malaysia"** "Berdasarkan jumlah jawapan betul · {period}": table "#" (medals) · "Sekolah" (→ `/ppd/sekolah/{id}`) · "Daerah / Negeri" (PPD line + state line) · "Pelajar" · "Betul" · "Dijawab" · "Ketepatan" (colour badge) — national (not the officer's district), top 50 by correct answers descending, from the daily ranking snapshot (DATA-M18-03): 30 Hari 7 rows (ENGKU HUSAIN 24 · 8,351 · 9,195 · 90.8% … SAM MUHAMMADIAH 1 · 3 · 5 · 60.0%) | S4-013–022 | All M18 roles | OBSERVED |
| FN-M18-2.4.3 | Period variants: "7 Hari" (7 rows, KHIR JOHARI first 6 · 1,365 · 1,584 · 86.2%) and "Hari Ini" (1 row ENGKU HUSAIN 1 · 57 · 60 · 95.0%) with the period echoed in both sub-lines; badge colours by accuracy band (≥ 80 green, 60–79.9 amber, < 60 red; INFERRED from the observed colours) | S4-023–030 | All M18 roles | OBSERVED / INFERRED (bands) |

**FT-M18-2.5 — Benchmark Sekolah Daerah (S5 `/ppd/benchmark-sekolah`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M18-2.5.1 | Breadcrumb "Dashboard PPD" / "Benchmark Sekolah"; header "{PPD}" "{negeri}", "Perbandingan prestasi semua sekolah dalam daerah", counter "{n}" "Sekolah" (active schools, 116) | S5-004–012 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-2.5.2 | Counters **"Purata Ketepatan"** and **"Purata Aktif"**: mean of the rows' "Ketepatan" over the schools **with a value** (not "—") (DV-M18-02: 73.1% where live shows 0.6% = 73.1 ÷ 116; with a subject the S6 cell values: BM 60.3% (live 0.5%), MT 76.3% (0.7%), PI 92.2% (0.8%), SEJ 72.3% (0.6%), BI / Moral / Sains "0%"); mean "% Aktif" over all listed schools ("0%") | S5-013–016, 034, 040 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED + DV-M18-02 |
| FN-M18-2.5.3 | Filter card **"Tapis Mata Pelajaran"**: GET form → same page, label and select `subject_id` (32 options: "Semua Mata Pelajaran" (empty), the 7 core subjects "Bahasa Inggeris (Teras)" 2, "Bahasa Melayu (Teras)" 1, "Matematik (Teras)" 3, "Pendidikan Islam (Teras)" 6, "Pendidikan Moral (Teras)" 7, "Sains (Teras)" 4, "Sejarah (Teras)" 5, then 24 electives A–Z with their M03 ids), button "Tapis" (`fa-filter`); with a subject set a link "Kosongkan" (`fa-times`) → the unfiltered page; the select keeps the value; an unknown `subject_id` renders like "all subjects" without a heading suffix but keeps "Kosongkan" (OBSERVED) | S5-017–021, 035 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-2.5.4 | Note "Skor Komposit = (% Aktif × 0.4) + (Purata Ketepatan × 0.3) + (Soalan/Pelajar × 0.3, ternormal) — Lebih tinggi lebih baik." | S5-022 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-2.5.5 | Card **"Kedudukan Sekolah"** (with a subject: "Kedudukan Sekolah — {subjek}"): table "#" (medals) · "Sekolah" (name → `/ppd/sekolah/{id}` + code line "JEA2029") · "Pelajar" · "Aktif" (active in 30 days) · "% Aktif" · "Ketepatan" (badge, mean of pupil accuracy, "—" without data) · "Soalan Dijawab" ("{n}" + "({x}/pelajar)" when > 0, else "0") · "Skor" (BR-M18-11, lifetime Soalan/Pelajar) — every active school, by score descending then name (LAYANG-LAYANG 21 · 0 · 0% · 73.1% · 222 (10.6/pelajar) · 22.6; the rest 0) | S5-023–024, 026–030, 036–037, 039 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-2.5.6 | **"Eksport CSV"** (`fa-download`) downloads the district CSV of FN-M18-2.7.2 (the live `onclick` target `/ppd/export-laporan?district={PPD}&state={negeri}&format=csv`; the subject filter is not applied, as live — DV-M18-06 rejected) | S5-025, 038, 041 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |

**FT-M18-2.6 — Peta Haba Prestasi Daerah (S6 `/ppd/peta-haba`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M18-2.6.1 | Breadcrumb "Dashboard PPD" / "Peta Haba"; h2 "Peta Haba Prestasi Daerah — {PPD}", sub "Prestasi rata-rata ketepatan pelajar mengikut sekolah dan mata pelajaran teras · {7} subjek × {116} sekolah" | S6-004–009 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-2.6.2 | Legend card "Petunjuk Warna:" swatches "Cemerlang" "> 70%", "Sederhana" "41–70%", "Lemah" "≤ 40%", "Tiada Data" | S6-010–018 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-2.6.3 | Card **"Prestasi Ketepatan (%) — Mata Pelajaran Teras × Sekolah"**, hint "Skrol ke kanan untuk melihat semua subjek pada skrin kecil.": table "Sekolah" (→ `/ppd/sekolah/{id}`) · 7 core-subject headers truncated with "…" ("Bahasa Ingge…", "Bahasa Melay…", "Matematik", "Pendidikan I…", "Pendidikan M…", "Sains", "Sejarah") · "Purata"; one row per active school (116) + footer row "Purata Daerah"; cells = Q-M18-ACCSTU (the separate stored per-pupil × subject accuracy set of M05, BR-M18-19; neither the answer log nor the practice sessions) "{p}%" coloured by band, "0%" (rows with 0 correct) or "—" (no row); "Purata" = mean of the row's cells > 0; footer = mean per subject over schools with a cell > 0; text "Sel merah menunjukkan purata ketepatan ≤ 40% — sekolah dan mata pelajaran berkenaan memerlukan perhatian segera. Klik nama sekolah untuk melihat laporan terperinci." (LAYANG-LAYANG BM 60.3%, MT 76.3%, PI 92.2%, SEJ 72.3%, Purata 75.3%; "0%" cells CHONG HWA I BI, SERI KENCANA BM / MT / SEJ, TUN HUSSEIN ONN Sains / SEJ; footer — / 60.3 / 76.3 / 92.2 / — / — / 72.3) | S6-019–026 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED (values) / INFERRED (store) |

**FT-M18-2.7 — Eksport Laporan Daerah (S7 `/ppd/export-laporan`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M18-2.7.1 | Breadcrumb "Dashboard PPD" / "Eksport Laporan"; header "{PPD}", "Eksport data prestasi semua sekolah dalam daerah ke CSV"; 5 stats (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`): "{n}" "Jumlah Sekolah" (116), "{n}" "Jumlah Pelajar" (72), "{n}" "Pelajar Aktif" (0), "{p}%" "Purata Ketepatan" (73.1%, DV-M18-02), "{n}" "Soalan Dijawab" (222) | S7-004–019 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED + DV-M18-02 |
| FN-M18-2.7.2 | Card **"Muat Turun Laporan CSV"**: "Fail CSV mengandungi data {n} sekolah dengan lajur: Nama, Kod, Daerah, Pelajar, Aktif, % Aktif, Ketepatan, Soalan, Risiko Kritikal, Risiko Tinggi, Skor.", `fa-info-circle` "Data dikira berdasarkan rekod terkini. Fail akan terbuka terus dengan Microsoft Excel atau Google Sheets.", button **"Muat Turun CSV"** (`fa-download`) → CSV download (UTF-8 with BOM, the 11 listed columns in that order, one row per active school in the benchmark order; column content INFERRED from the page text, Q-M18-5, provisional), meta "Format: CSV (UTF-8 BOM)" (`fa-file-csv`), "Dijana: {d MMM yyyy, HH:mm}" (`fa-calendar`, MYT, DV-M18-07), "Daerah: {PPD}, {negeri}" (`fa-map-marker-alt`) | S7-020–027 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED / INFERRED (file) |
| FN-M18-2.7.3 | Card **"Pratonton Data (5 Sekolah Pertama)"** "Data sebenar dalam fail CSV": table "Nama Sekolah" · "Kod" · "Pelajar" · "Aktif" · "% Aktif" · "Ketepatan" · "Soalan" · "Kritikal" · "Tinggi" · "Skor" — the first 5 active schools alphabetically (KOLEJ VOKASIONAL KLUANG, CHIAN BEE, CHONG ENG, …; all 0 / "—"), footer "Menunjukkan 5 dari {n} sekolah. Muat turun CSV untuk data lengkap." (the preview has no "Daerah" column, as live) | S7-028–032 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |

**FT-M18-2.8 — Leaderboard Sekolah Daerah (S8 `/ppd/leaderboard-sekolah`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M18-2.8.1 | Breadcrumb "Dashboard PPD" / "Leaderboard Sekolah"; header "{PPD}" "{negeri}", "Kedudukan sekolah berdasarkan skor komposit — aktiviti, ketepatan & jumlah soalan", counter "{n}" "Sekolah" (116) | S8-004–012 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-2.8.2 | Tabs (`x-data="{ tab: 'keseluruhan' }"`) **"Keseluruhan"** (`fa-list-ol`, default) and **"Ikut Subjek"** (`fa-book`): the tab changes only its own highlight; both show the same filter card and lists (as live — DV-M18-08 rejected) | S8-013–014 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-2.8.3 | Filter card "Tapis Mata Pelajaran" identical to FN-M18-2.5.3 (select `subject_id`, 32 options, "Tapis", "Kosongkan" → `/ppd/leaderboard-sekolah` when set) | S8-015–019, 065 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-2.8.4 | Note "Skor Komposit = (% Aktif × 0.4) + (Purata Ketepatan × 0.3) + (Soalan/Pelajar × 0.3, ternormal) — Trend berdasarkan perbandingan 30 hari terkini vs 30 hari sebelumnya." | S8-020 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-2.8.5 | Card **"Podium Teratas Daerah"**: three columns in podium order 2 · 1 · 3 — school link (→ `/ppd/sekolah/{id}`), score, medal, "Tempat {n}" (LAYANG-LAYANG "21.9" 🥇 "Tempat 1"; KOLEJ VOKASIONAL KLUANG "0" 🥈 "Tempat 2"; CHIAN BEE "0" 🥉 "Tempat 3") | S8-021–034 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED + DV-M18-01 |
| FN-M18-2.8.6 | Card **"Kedudukan Penuh"** (with a subject "Kedudukan Penuh — {subjek}"), desktop table (≥ 640 px): "#" · "Sekolah" (+ code) · "Pelajar" · "Aktif" · "% Aktif" · "Ketepatan" (badge) · "Soalan/Pelajar" (last 30 days; "—" when none) · "Trend" · "Skor" (BR-M18-11 with the 30-day Soalan/Pelajar: LAYANG-LAYANG 21.9) — every active school by score descending then name | S8-035–036, 038–042, 066–068 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-2.8.7 | **"Eksport CSV"** (`fa-download`) → `/ppd/export-laporan` (opens the S7 page, as live) | S8-037 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-2.8.8 | Mobile card list (< 640 px, `sm:hidden`): per school the rank (🥇 🥈 🥉, then "#4" …), school link, score, `fa-users` "{n} pelajar", `fa-user-check` "{n} aktif ({p}%)", badge "{p}% tepat" (only with data) | S8-043–058, 069 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-2.8.9 | Trend icons with titles "Meningkat" / "Menurun" / "Stabil" = last 30 days vs the 30 days before (BR-M18-12); empty cell when a school has no activity in either window (every observed row); the non-empty icons are SOURCE-DERIVED (titles in the page) and provisional (Q-M18-11) | S8-062–064 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED (empty) / SOURCE-DERIVED |

**FT-M18-2.9 — School statistics page (S9 `/ppd/sekolah/{id}`, S15 `/jpn/sekolah/{id}`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M18-2.9.1 | Breadcrumb: S9 "Ranking Kebangsaan" (`fa-arrow-left`) → `/ppd/ranking-kebangsaan` whatever the entry page (as live, DV-M18-12 rejected); S15 "{PPD}" → `/jpn/daerah/{PPD}`; current label "{SEKOLAH}" | S9-004–006; S15-004–006 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-2.9.2 | Header card: h2 "{SEKOLAH}", code ("JEB2037"), `fa-map-marker-alt` "{PPD}", "\|", `fa-flag` "{negeri}", "\|", `fa-tag` "{jenis}" ("SMK"); counters "{n}" "Pelajar" (59), "{p}%" "Penggunaan" (6.8%), "{n}" "Aktif 7 Hari" (0) | S9-007–020, 197–202; S15-007–020 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-2.9.3 | Filter card (GET form → same URL): "Tingkatan / Darjah" `grade` ("Semua" + only the levels the school has: "Darjah 6" D6, "Tingkatan 1"…"Tingkatan 5" T1–T5), "Kelas" `class_id` ("Semua Kelas" + the school's classes as "— {kelas}", e.g. "— 4 Simulasi" 516, "— 5 Simulasi" 517), "Subjek" `subject_id` ("Semua Subjek" + the school's subjects), "Tapis" (`fa-filter`); "Reset" (`fa-times`) → the unfiltered URL when a filter is set; selects keep the query | S9-021–029, 169; S15-021–029 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-2.9.4 | Six stat cards over the filtered pupils: "Jumlah Pelajar" (59); "Sudah Guna" (4) "Pelajar yang telah menjawab" (pupils with ≥ 1 completed practice session); "Belum Guna" (55) "Belum pernah menjawab soalan"; "% Penggunaan" (6.8% = Sudah Guna ÷ Jumlah); "Aktif 7 Hari" (0) "Latihan dalam 7 hari lepas"; "Purata Sesi / Pelajar" (15 = sessions ÷ Sudah Guna) "sesi per pelajar aktif" (8765: 21 · 2 · 19 · 9.5% · 0 · 10.5; class 516: "0%"; T5: "11.1%") | S9-030–051, 168, 170, 176–177; S15-030–051 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-2.9.5 | Sticky section nav (`officerSchoolNav()`, IntersectionObserver marks the section in view): links "Bulanan", "Kalendar", "Subjek", "Ranking", "Kelas", "Pelajar", "Guru" → `#sec-bulanan` … `#sec-guru` (smooth scroll) | S9-052–059; S15-052–059 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-2.9.6 | Card **"Statistik Bulanan"** "12 bulan terakhir — pecahan prestasi mengikut bulan" (with a subject: "… (subjek ditapis)"): table "Bulan" · "Soalan Dijawab" · "Soalan Betul" · "Pelajar Aktif" · "Purata/Pelajar" · "Accuracy" — one row per month with practice sessions in the last 12 months (8880: Feb 2026 124 · 84 · 3 · 41.3 · 67.7%; Mar 2026 551 · 401 · 3 · 183.7 · 72.8%); footer "Jumlah" (Σ, "—", "—", pooled accuracy) when more than one month (8765: 309 · 242 · — · — · 78.3%, INFERRED from S15); empty "Tiada data" / "Tiada aktiviti direkodkan buat masa ini" | S9-060–063, 171–172, 290; S15-060–063 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-2.9.7 | Card **"Kalendar Aktiviti Harian"** "365 hari — semakin gelap, semakin ramai pelajar aktif": "{n}" "Hari Aktif" (33), "{n}" "Jumlah Betul" (7,307 — correct answers in the 365 days, answer log), "{n}" "Purata/Hari" (221 = betul ÷ hari aktif); GitHub-style grid from (today − 364) to today, month labels "Sep" "Okt" "Nov" "Dis" "Jan" "Feb" "Mac" "Apr" "Mei" "Jun" "Jul" "Ogs" "Sep", day labels "Isn" "Rab" "Jum" "Ahd", cell tooltip "{yyyy-mm-dd}: {n} pelajar aktif, {n} betul", legend "Kurang" … "Lebih" (8765: 16 / 186 / 12) | S9-064–094; S15-064–094 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-2.9.8 | Section **"Laporan Subjek"** "Pecahan prestasi mengikut subjek — ketepatan sebelum & selepas pembetulan": one card per subject of the school's correction aggregate (DATA-M18-04): h3 name, short code ("BM", "BI", "MATH", "CHEM", "PHY", "ADDMATH", "SK", "SEJ", "BIO", "PERNIAGA", "GEO"), "{n}" "Pelajar", "{n}" "Soalan", "{p}%" "Accuracy", optional "Sebelum" / "Selepas" pair, optional "Purata Level" (`fa-layer-group`); empty card "Tiada data subjek" (8880: BM 1 · 26 · 34.6% · 72% / 72%; BI 1 · 8 · 50% · 71.9% / 71.9%; MATH 1 · 5 · 100% · 72.4% / 72.4%) | S9-095–135, 173–174, 178–183, 203–285; S15-095–201 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-2.9.9 | Card **"Ranking Pelajar"** "Kedudukan pelajar berdasarkan prestasi", Alpine tabs "Ikut Kelas" (`fa-door-open`, default) / "Ikut Subjek" (`fa-book`): empty "Tiada data ranking" / "Data ranking dikemas kini setiap hari"; subject tab without a subject filter "Pilih subjek dari filter di atas" / "Ranking akan dipaparkan mengikut subjek yang dipilih"; with a subject "Tiada data ranking untuk subjek ini"; the filled ranking (daily snapshot) is not observable (Q-M18-9): PROPOSED rows "#" (medals) · name · class · accuracy, provisional | S9-136–144, 291; S15-202–210 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED / PROPOSED (filled) |
| FN-M18-2.9.10 | Card **"Prestasi Per Kelas"** "{n} kelas dipaparkan": table "Kelas" · "Tingkatan" (badge, empty on live) · "Jumlah" · "Sudah Guna" · "Belum Guna" · "%" · "Accuracy" · "Penggunaan" (bar of width %) — one row per class of the school holding its pupils (8880: "4 Simulasi" 15 · 0 · 15 · 0% · — ; "5 Simulasi" 15 · 3 · 12 · 20% · 54.3%); empty "0 kelas dipaparkan", "Tiada kelas dijumpai" / "Sila cipta kelas terlebih dahulu" | S9-145–148, 184–186; S15-211–215 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-2.9.11 | Card **"Senarai Pelajar — Terperinci"** "Klik pada kelas untuk lihat senarai pelajar": one accordion per class ("{kelas}" "{n} pelajar" badges "{n} guna" / "{n} belum", `fa-chevron-right` rotating) and "Tiada Kelas" "{n} pelajar" for pupils without a class; opened: table "#" · "Nama Pelajar" (initial avatar + name) · "No. IC" (masked, FN-M18-2.9.12) · "Status" (badge "Belum Guna", "Tidak Aktif" — practised but not in the last 7 days — or "Aktif", INFERRED colour) · "Sesi" · "Soalan" · "Accuracy" (mean of the pupil's session accuracies) · "Terakhir Aktif" ("dd/mm/yyyy" of the last session or "Tiada rekod"); empty "Tiada data pelajar" / "Tiada pelajar dalam sekolah ini buat masa ini" | S9-149–151, 154–163, 175, 187–189, 286; S15-216–218, 221–224 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-2.9.12 | **IC privacy (DV-M18-13, SEC-M18-01):** badge "PDPA Dilindungi" (`fa-shield-alt`) and button **"Tunjuk IC Penuh"** (`fa-eye`) / "Sembunyikan IC" (`fa-eye-slash`); the list shows the masked IC in the **live format "xxxxxx-xx-xx" + the last 2 digits** (literal "x", OBSERVED in the S9 DOM) and the API never sends full ICs in the list; "Tunjuk IC Penuh" asks `confirm('Anda akan melihat No. IC penuh pelajar.\nTindakan ini direkodkan untuk pematuhan PDPA.\n\nTeruskan?')`; OK → a reveal request returns the full ICs of the listed pupils and writes one PDPA audit record (who, when, school, pupil ids); Cancel → nothing; "Sembunyikan IC" hides them again without a request. Seeds hold fictitious IC-shaped values only | S9-152–153; S15-219–220 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED (UI) + DV-M18-13 |
| FN-M18-2.9.13 | Card **"Senarai Guru"** "Guru berdaftar di {SEKOLAH}": table "#" · "Nama" · "Email" · "Subjek" (chips or "-") · "Kelayakan" ("-") · "Kelas" ("-") — the school's teachers (M02); empty "Tiada guru berdaftar" / "Sekolah ini belum mempunyai guru yang berdaftar dalam sistem" | S9-164–167, 287–289; S15-225–229 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |

### EP-M18-3 — JPN portal (S10–S14)


**FT-M18-3.1 — Dashboard JPN (S10 `/jpn/dashboard`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M18-3.1.1 | Breadcrumb "Papan Pemuka" → `/dashboard` / "Dashboard JPN"; header h2 "{negeri}" ("Johor"), badge "JPN", "Dashboard Agregat Jabatan Pendidikan Negeri", counters "{n}" "Sekolah" (1,189) and "{n}" "Pelajar" (135) | S10-004–014 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-3.1.2 | Six KPI cards (S1 template without sub-lines and without Coverage Headcount): "Jumlah Sekolah" 1,189; "Jumlah Pelajar" 135; "GPS Purata" 2.49 "A-"; "Pelajar Berisiko Merah" 135 "100% daripada 135 pelajar"; "Ketepatan Keseluruhan" 71.6%; "Kombo Aktif" 81 "daripada 135 pelajar" — state scope | S10-015–035 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-3.1.3 | Card **"Tapis & Cari"**: input "Cari nama sekolah..." (`#school-search-input`), select "Semua Daerah (PPD)" + the state's PPDs (Johor 11), "Reset" (`fa-times`, shown while a filter is active), counter "{n} sekolah dijumpai"; client-side filtering of every school table and re-pagination ("Menunjukkan 1–10 daripada 10 sekolah" …); no match → "0 sekolah dijumpai" and "Tiada sekolah dijumpai" in each table; the counter counts **distinct matching schools** (DV-M18-14: "PPD KLUANG" → 118 where live shows 479; "KLUANG" → 10 where live shows 43) | S10-036–040, 199–215 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED + DV-M18-14 |
| FN-M18-3.1.4 | Card **"Perbandingan Daerah (PPD) — Seluruh Negeri"** "Ringkasan prestasi semua Pejabat Pendidikan Daerah dalam negeri {negeri}": table "#" · "Daerah" (link → `/jpn/daerah/{PPD}`) · "Sekolah" · "Pelajar" · "Risiko Merah" ("{n} ({p}%)") · "Ketepatan" — one row per PPD in name order (as live: BATU PAHAT, JOHOR BAHRU, KLUANG …); "Sekolah" = all schools of the PPD, "—" for no pupils; **KLUANG row 118 · 135 · 135 (100%) · 71.6%** (DV-M18-03; live 7 · 134 · 134); note `fa-info-circle` "Klik nama daerah untuk lihat dashboard PPD terperinci" (kept; the link opens S14, DV-M18-35 rejected) | S10-041–048 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED + DV-M18-03 |
| FN-M18-3.1.5 | **"Prestasi GPS — Perbandingan Sekolah"** (state): as FN-M18-2.1.8 without a search box, 1,189 rows, school links → `/jpn/sekolah/{id}`, pager FN-M18-1.3.4 | S10-049–052 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-3.1.6 | **"Amaran Awal — Taburan Risiko"** "Taburan risiko pelajar merentasi sekolah dalam negeri": tiles, bar "Taburan Risiko Keseluruhan Negeri" and legend as FN-M18-2.1.9 (0 / 0 / 135) | S10-060–076 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-3.1.7 | State risk table "#" · "Sekolah" · "Pelajar" · "Hijau" · "Kuning" · "Merah" (no links, as live) — schools with ≥ 1 pupil, **each school once** (DV-M18-18: live lists TINGGI KLUANG twice and omits TUN HUSSEIN ONN, rows summing to 181 ≠ 135); "Menunjukkan 1–7 daripada 7 sekolah" | S10-077 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED + DV-M18-18 |
| FN-M18-3.1.8 | **"Analisa Item — Prestasi Mengikut Subjek"** "Ketepatan jawapan merentasi semua subjek dalam negeri": the subject cards of FN-M18-2.1.11 at state scope | S10-079–111 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-3.1.9 | **"Kombo Latihan — Gambaran Negeri"** "Penglibatan harian pelajar merentasi sekolah dalam negeri": tiles as FN-M18-2.1.12 and table "#" · "Sekolah" · "Pelajar" (school pupils, DV-M18-04) · "Kombo Aktif" · "Purata Kombo" (no links), 1,189 rows | S10-112–123 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED + DV-M18-04 |
| FN-M18-3.1.10 | **"Tahap Penguasaan — Taburan Negeri"** "Taburan tahap penguasaan pelajar merentasi negeri": 11 level tiles "{n}" "({p}%)" with **p = n ÷ records** (DV-M18-15: 36.8% / 52.6% / 10.5% where live shows 116.7% / 166.7% / 33.3% = n ÷ 12 pupils); no note line and no "catatan" label (as live); table "#" · "Sekolah" · "Pelajar" (DV-M18-04) · "Purata Tahap" | S10-131–167 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED + DV-M18-15 |
| FN-M18-3.1.11 | **"Pembetulan — Gambaran Negeri"** "Kadar pembetulan pelajar untuk {Bulan YYYY}": tiles "Jumlah Pelajar", "Jumlah Pembetulan", "Kadar Purata" and table "#" · "Sekolah" · "Pelajar" · "Pembetulan" ("{n} pelajar ({p}%)"); no notice line (as live on S10) | S10-175–184 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-3.1.12 | **"Laporan Terperinci"** "Akses laporan mendalam untuk setiap modul": "Statistik Penggunaan" (`fa-chart-pie`) → S12, "Amaran Awal" (`fa-bell`) → `/amaran/jpn`, "Analisa Item" (`fa-chart-bar`) → `/analisa-item/jpn`, "Kombo Harian" (`fa-fire`) → `/kombo/jpn` | S10-192–198 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |

**FT-M18-3.2 — Command Center JPN (S11 `/jpn/command-center`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M18-3.2.1 | Standalone full-screen dark page (Inter + JetBrains Mono, dark navy; no shell), same fixed 4-column layout at every width (tiles and panels shrink, no reflow — as live): top bar "← Dashboard" → `/jpn/dashboard`, h1 "Command Center JPN", badge "{negeri}", "LIVE" dot, clock "HH:MM:SS" "MYT" updated every second (Asia/Kuala_Lumpur) | S11-001–006, 043–044 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-3.2.2 | Four stat tiles from the live data: "Sekolah Aktif" "{n}" "dari {total} sekolah negeri" (both = active schools of the state, 1,187 — DV candidate rejected, DV-M18-42); "Pelajar Berdaftar" "{n}" "{m} aktif menjawab" (72 / 6); "Soalan Dijawab" "{n}" "sepanjang masa" (**222**, live "NaN"); "Ketepatan Purata" "{p}%" "keseluruhan negeri" (83.8%) — the three big counters animate (800 ms ease-out) | S11-007–019 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED + DV-M18-16 |
| FN-M18-3.2.3 | Panel "🏆 Top Sekolah Aktif": up to 5 rows rank · school name link → `/jpn/sekolah/{id}` · "{n} plj" (**"SEKOLAH MENENGAH KEBANGSAAN LAYANG-LAYANG"** → `/jpn/sekolah/8765` "6 plj", live "undefined" → `/jpn/sekolah/undefined`); "Tiada data" when empty | S11-020–024 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED + DV-M18-16 |
| FN-M18-3.2.4 | Panel "🤖 ALESA AI": placeholder "Memuatkan wawasan..." until the first response, then the script template "Negeri menunjukkan {peningkatan\|penurunan\|stabil} {n}% minggu ini. {p}% pelajar terlibat aktif. Ketepatan purata {a}% dengan {s}/{t} sekolah aktif. GPS daerah: {gps}." (SOURCE-DERIVED; never rendered on live because the script stops, D-M18-23; values provisional, Q-M18-10) | S11-025–027 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | SOURCE-DERIVED + DV-M18-16 |
| FN-M18-3.2.5 | Panel "📈 Aktiviti Hari Ini": bar + "{n} soalan" (0), "Minggu ini: {n}" (0), and "▲ +{n}% vs minggu lepas" / "▼ {n}% vs minggu lepas" / "Sama dengan minggu lepas" (observed "Sama dengan minggu lepas") | S11-028–034 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED / SOURCE-DERIVED |
| FN-M18-3.2.6 | Panel "⚡ Live Feed": up to 10 rows of the latest answers in the state (time, pupil, subject short name, school, "✓"/"✗", as the M17 feed) or "Tiada aktiviti terkini" (SOURCE-DERIVED; empty on live because the script stops) | S11-035–036 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | SOURCE-DERIVED + DV-M18-16 |
| FN-M18-3.2.7 | Panel "⭐ Top Pelajar Minggu Ini": up to 5 rows "{n} jwb · {p}%" or "Tiada data" (observed) | S11-037–039 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED / SOURCE-DERIVED |
| FN-M18-3.2.8 | Panel "🏢 Pecahan Daerah": one row per PPD of the state "{PPD}" "{n} sekolah · {n} pelajar", "{n} aktif" (SOURCE-DERIVED template; JSON `districts[]`: KLUANG "116 sekolah · 72 pelajar" "6 aktif", the others "{n} sekolah · 0 pelajar" "0 aktif"). The engagement rows ("Champion", "Konsisten", "Berkembang", "Minimum", "Disengaged") of the script have no panel on the page and are not rendered (the `eng` reference that throws is removed, DV-M18-16) | S11-040–041 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | SOURCE-DERIVED + DV-M18-16 |
| FN-M18-3.2.9 | Footer "Powered by ALESA AI · PrestasiPlus © 2026 · Data dikemaskini setiap 10 saat"; **polling** `GET /api/jpn/command-center/live-data` on load and every 10 s while the page is open (stops when it closes); a failed poll keeps the last values (INFERRED, M17 pattern) | S11-042 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |

**FT-M18-3.3 — Statistik Penggunaan Negeri and Daerah (S12 `/jpn/statistik-penggunaan`, S14 `/jpn/daerah/{PPD}`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M18-3.3.1 | S12: breadcrumb "Dashboard JPN" → S10 / "Statistik Penggunaan"; header "JPN {negeri}", "Statistik Penggunaan PRESTASIPLUS Seluruh Negeri", counters "{n}" "Daerah", "{n}" "Sekolah", "{n}" "Pelajar" from the daily usage snapshot (Johor 0 / 0 / 0); no period pills | S12-004–015 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-3.3.2 | Empty snapshot: card "Data belum tersedia" / "Data ranking dikemas kini setiap hari. Sila semak semula esok." (S12 and S14; every Johor PPD on live, DV-M18-28 rejected: a different source than S10) | S12-016–018; S14-015–017 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-3.3.3 | S14 (from the S10 district links): breadcrumb "Statistik Negeri" → S12 / "{PPD}"; header "{PPD}" "{negeri}", "Statistik Penggunaan PRESTASIPLUS Dalam Daerah", counters "{n}" "Sekolah", "{n}" "Pelajar Aktif"; a PPD name that does not exist in the state → 404 (OBSERVED `BOGUS`) | S14-004–014 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-3.3.4 | Filled usage snapshot (S12 per PPD, S14 per school): **PROPOSED** tables in the S13 format ("#" · "PPD"/"Sekolah" · "Sekolah" · "Pelajar" · "Betul" · "Dijawab" · "Ketepatan"); not observable (Q-M18-4, provisional) | — | JPN officer | PROPOSED |

**FT-M18-3.4 — Ranking Kebangsaan (S13 `/jpn/ranking-kebangsaan`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M18-3.4.1 | Breadcrumb "Dashboard JPN" / "Ranking Kebangsaan"; h2 "Ranking Kebangsaan", "1 Malaysia", sub "Ranking PPD & Sekolah merentas seluruh Malaysia · {period}", counters "{n}" "PPD Aktif" (2), "{n}" "Sekolah Aktif" (7) | S13-004–014 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-3.4.2 | Card **"Ranking PPD — 1 Malaysia"** "{n} PPD aktif · {period} — berdasarkan jumlah jawapan betul": table "#" (medals) · "PPD" · "Negeri" · "Sekolah" · "Pelajar" · "Betul" · "Dijawab" · "Ketepatan" (badge) — PPD rows = Σ of their school rows (🥇 PPD HULU LANGAT Selangor 6 · 88 · 19,417 · 22,311 · 87.0%; 🥈 PPD SABAK BERNAM 1 · 1 · 3 · 5 · 60.0%) | S13-018–023 | All M18 roles | OBSERVED |
| FN-M18-3.4.3 | Card **"Top 50 Sekolah — 1 Malaysia"**: the S4 table (FN-M18-2.4.2) with links → `/jpn/sekolah/{id}` | S13-024–029 | All M18 roles | OBSERVED |
| FN-M18-3.4.4 | Period variants: "7 Hari" (HULU LANGAT 6 · 36 · 4,051 · 4,847 · 83.6%; KHIR JOHARI first) and "Hari Ini" ("1 PPD aktif"; HULU LANGAT 1 · 1 · 57 · 60 · 95.0%) | S13-030–040 | All M18 roles | OBSERVED |

### EP-M18-4 — Amaran Awal — early warning and interventions (S16–S24, S28)


**FT-M18-4.1 — Risk model (computed by M18 from the owners' data)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M18-4.1.1 | **Risk score** 0–100 per pupil (higher = worse), 1 decimal (BR-M18-13, INFERRED weights fitted to every observed score): 0.4 × accuracy risk + 0.3 × engagement risk + 0.3 × mastery risk; accuracy risk = 100 − the mean of the practice-session accuracies of the pupil (the S9 "Accuracy" figure), or 100 when the pupil has no completed session but a login date ("Tiada data"), or 50 when never active ("Tiada data latihan"); engagement risk = min(100, days since the last login × 100 ÷ 30), 100 when none ("Tiada aktiviti"); mastery risk = (10 − average mastery level) × 10 on the ladder 0 "Pemula" … 10 "Mythical", 100 without mastery records ("Tiada data penguasaan") | — | System | INFERRED (Q-M18-6) |
| FN-M18-4.1.2 | **Risk status** by score (PROPOSED cut-offs consistent with the observations 45.7 / 44.7 → Kuning, 66.8 and above → Merah): Hijau **"On Track"** < 40, Kuning **"Perlu Perhatian"** 40–59.9 (row `bg-yellow-50`, yellow badge), Merah **"Berisiko Tinggi"** ≥ 60 (row `bg-red-50`, red badge) | — | System | OBSERVED (labels) / PROPOSED (cut-offs) |
| FN-M18-4.1.3 | Pupil cells of the risk tables: "Ketepatan" "Purata ketepatan: {p}%" or "Tiada data" / "Tiada data latihan"; "Penglibatan" "Terakhir aktif: {yyyy-mm-dd}" (date of the stored activity date `lastActiveAt`, M02 / M01 — not the login date; SRS §6.1a) or "Tiada aktiviti" when it is empty; "Penguasaan" "Purata tahap: L{round(avg)}" or "Tiada data" / "Tiada data penguasaan" | — | System | OBSERVED |
| FN-M18-4.1.4 | **Subject weakness** "{w}/{m} pelajar lemah ({p}%)": at school, district, state and S23 scope one row per subject of the correction aggregate (DATA-M18-04 CorrectionSubject) of the scope's schools — m = the row's pupils, w = its weak pupils (stored; every observed row has w = m: 8880 BM, BI, MT 1/1; 8765 Fizik 5/5, Biologi 3/3, Matematik 6/6, Sejarah 3/3, Kimia 5/5, Perniagaan 2/2, Matematik Tambahan 2/2, Sains Komputer 3/3, Geografi 1/1; 2710 BM, SEJ, Fizik, Geografi, Sains Komputer 1/1); at class scope (S17) the six core subjects with m = class members and w = members whose mean session accuracy in the subject is < 50% (PROPOSED; class 1156 SEJ 1/1, others 0/1) | — | System | OBSERVED (aggregate rows) / PROPOSED (class rule) |
| FN-M18-4.1.5 | Risk lists are ordered by score descending, ties by the live order (school, then class, then name); averages "Purata Skor" = mean pupil score (1 decimal) | — | System | OBSERVED |

**FT-M18-4.2 — Class list (S16 `/amaran`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M18-4.2.1 | Grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`) of class cards: `fa-exclamation-triangle` icon, class name, "{Subjek} · {n} pelajar" → `/amaran/kelas/{id}`; classes by id descending; admin: every class of the system (750; first "5 CYBER" "Sains Rumah Tangga · 1 pelajar"), teacher: own classes, school admin: the school's classes, officers: classes of the scope's schools (INFERRED); no empty state observed (PROPOSED: the S9 copy "Tiada kelas dijumpai" when none) | S16-004–006 | Admin (OBSERVED); Guru, school admin, officers (INFERRED) | OBSERVED / INFERRED |

**FT-M18-4.3 — Class risk (S17 `/amaran/kelas/{id}`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M18-4.3.1 | "Kembali ke senarai kelas" (`fa-arrow-left`) → `/amaran`; shell sub "{kelas} — {subjek}" | S17-004 | As FN-M18-4.2.1 | OBSERVED |
| FN-M18-4.3.2 | Four tiles (`grid-cols-2 lg:grid-cols-4`): "{n}" "Jumlah Pelajar", "{n}" "On Track", "{n}" "Perlu Perhatian", "{n}" "Berisiko Tinggi" (class 1156: 1 · 0 · 1 · 0) | S17-005–012 | As FN-M18-4.2.1 | OBSERVED |
| FN-M18-4.3.3 | Card **"Taburan Risiko"**: stacked bar ("100%") with the legend "Hijau (On Track)", "Kuning (Perlu Perhatian)", "Merah (Berisiko Tinggi)" | S17-013–018 | As FN-M18-4.2.1 | OBSERVED |
| FN-M18-4.3.4 | Card **"Senarai Pelajar Mengikut Risiko"**: table "#" · "Pelajar" (link → `/prestasi/{userId}`, M08) · "Skor Risiko" · "Status" (badge, row tint) · "Ketepatan" · "Penglibatan" · "Penguasaan" · "Tindakan" (button "Intervensi" `fa-clipboard-list` → `/amaran/intervensi/{userId}`) — class members by score descending (class 1156: observed 45.7 on 26 Sep = 44.7 at the project clock, "Perlu Perhatian" "Purata ketepatan: 58.6%" "Terakhir aktif: 2026-09-15" "Purata tahap: L4") | S17-020–025 | As FN-M18-4.2.1 | OBSERVED |
| FN-M18-4.3.5 | Card **"Analisis Risiko Mengikut Subjek"**: per core subject "{w}/{m} pelajar lemah ({p}%)" (FN-M18-4.1.4; class 1156: Sejarah 1/1 (100%), the other five 0/1 (0%)) | S17-026–039 | As FN-M18-4.2.1 | OBSERVED |

**FT-M18-4.4 — District risk (S18 `/amaran/ppd`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M18-4.4.1 | Four tiles "{n}" "Jumlah Pelajar" (33), "On Track" 0, "Perlu Perhatian" 0, "Berisiko Tinggi" 33 (district scope; the page has no breadcrumb or header card, as live) | S18-004–011 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-4.4.2 | Card **"Taburan Risiko Seluruh Daerah"**: bar "{p}%" and "Hijau: {n}", "Kuning: {n}", "Merah: {n}" | S18-012–017 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-4.4.3 | Buttons **"Keberkesanan Intervensi"** (`fa-chart-pie`) → `/amaran/keberkesanan/ppd` and **"Ringkasan Eksekutif"** (`fa-file-alt`) → `/amaran/ringkasan-eksekutif?scope=district&district={PPD}&state={negeri}` | S18-018–019 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-4.4.4 | Card **"Perbandingan Sekolah"**: table "#" · "Sekolah" (→ `/amaran/sekolah/{id}`) · "Pelajar" · "Purata Skor" · "Hijau" · "Kuning" · "Merah" — schools of the district with pupils, by average score descending (HAMID KHAN 17 · 97.6 · 0 · 0 · 17; TOH TANDEWA SAKTI 16 · 97.5 · 0 · 0 · 16) | S18-021–025 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-4.4.5 | Card **"Pelajar Berisiko Tertinggi"** "Menunjukkan {n} dari {m} pelajar": table "#" · "Pelajar" · "Sekolah" · "Tingkatan / Kelas" ("Tingkatan {n} {kelas}" of the pupil's first class or "-") · "Skor" · "Status" · "Ketepatan" · "Penglibatan" · "Penguasaan" — pupils by score descending (33 of 33; red rows) | S18-026–030 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |

**FT-M18-4.5 — State risk (S19 `/amaran/jpn`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M18-4.5.1 | Breadcrumb "Papan Pemuka" → `/dashboard` / "Amaran Awal JPN"; header "JPN {negeri}" ("JPN Perak"), "Laporan Amaran Awal Jabatan Pendidikan Negeri — Data Seluruh Negeri", counter "{n}" "Pelajar" (33) | S19-004–011 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-4.5.2 | Four tiles as FN-M18-4.4.1 at state scope (33 · 0 · 0 · 33) | S19-012–019 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-4.5.3 | Card **"Taburan Risiko Seluruh Negeri"** with bar and legend | S19-020–025 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-4.5.4 | Button **"Ringkasan Eksekutif"** (`fa-file-alt`) → `/amaran/ringkasan-eksekutif?scope=state&state={negeri}` (no CSV and no effectiveness button, as live) | S19-026 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-4.5.5 | Card **"Perbandingan Daerah (PPD)"** "Kedudukan daerah mengikut purata skor risiko": table "#" · "Daerah" · "Sekolah" (schools with pupils) · "Pelajar" · "Purata Skor" · "Hijau" · "Kuning" · "Merah" (PPD BATANG PADANG 2 · 33 · 97.6 · 0 · 0 · 33) | S19-027–030 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-4.5.6 | Card **"Perbandingan Sekolah"** "Kedudukan semua sekolah dalam negeri": table "#" · "Sekolah" (→ `/amaran/sekolah/{id}`) · "Daerah" · "Pelajar" · "Purata Skor" · "Hijau" · "Kuning" · "Merah" — **each school once** (DV-M18-18: HAMID KHAN 17 · 97.6 and TOH TANDEWA SAKTI 16 · 97.5, where live shows TOH TANDEWA SAKTI twice) | S19-031–036 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED + DV-M18-18 |
| FN-M18-4.5.7 | Card **"Pelajar Berisiko Tertinggi (Seluruh Negeri)"** "Menunjukkan {n} dari {m}": the S18 pupil table with the state's pupils | S19-037–040 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |

**FT-M18-4.6 — School risk (S22 `/amaran/sekolah/{id}`, S28 `/sekolah/{id}/amaran`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M18-4.6.1 | Level pills "Semua Tingkatan" → `/sekolah/{id}/amaran`, "Tingkatan 4" → `?tingkatan=T4`, "Tingkatan 5" → `?tingkatan=T5` (S22's pills point to the S28 URL, as live); with a level the shell sub gets " — Tingkatan {n}" and only pupils in classes of that level are counted | S22-004–006; S28-004–006 | Admin (OBSERVED); officers, school admin, guru (INFERRED) | OBSERVED |
| FN-M18-4.6.2 | Four tiles "Jumlah Pelajar" / "On Track" / "Perlu Perhatian" / "Berisiko Tinggi" (7780: 17 · 0 · 0 · 17; 8880: 59 · 0 · 0 · 59; T4 15, T5 15) | S22-007–014; S28-007–014 | As FN-M18-4.6.1 | OBSERVED |
| FN-M18-4.6.3 | Card **"Taburan Risiko Seluruh Sekolah"**: bar and "Hijau: {n}", "Kuning: {n}", "Merah: {n}" ("Merah: 59"; T4/T5 "Merah: 15") | S22-015–020; S28-015–020, 039 | As FN-M18-4.6.1 | OBSERVED |
| FN-M18-4.6.4 | Buttons **"Keberkesanan Intervensi"** (`fa-chart-pie`) → `/amaran/keberkesanan` (the viewer's own school effectiveness page, as live) and **"Ringkasan Eksekutif"** (`fa-file-alt`) → `/amaran/ringkasan-eksekutif?scope=school&school_id={id}` | S22-021–022; S28-021–022 | As FN-M18-4.6.1 | OBSERVED |
| FN-M18-4.6.5 | Card **"Senarai Pelajar Berisiko"** "Disusun mengikut skor risiko tertinggi": table "#" · "Pelajar" (name + level line "Tingkatan n" / "Darjah n") · "Tingkatan / Kelas" · "Skor" · "Status" · "Ketepatan" · "Penglibatan" · "Penguasaan" (school 1 shows "Darjah n" pupils in "Tingkatan 4/5" classes — data as observed, DV-M18-20 rejected) | S22-024–030; S28-032–038 | As FN-M18-4.6.1 | OBSERVED |
| FN-M18-4.6.6 | Card **"Analisis Risiko Mengikut Subjek"** when the school has pupils with answers in a core subject (FN-M18-4.1.4; 8880 "Bahasa Melayu", "Bahasa Inggeris", "Matematik" "1/1 pelajar lemah (100%)") | S28-024–031 | As FN-M18-4.6.1 | OBSERVED |

**FT-M18-4.7 — Ringkasan Eksekutif (S23 `/amaran/ringkasan-eksekutif`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M18-4.7.1 | Toolbar (`no-print`, hidden when printing): **"Cetak / PDF"** (`fa-print`) → `window.print()`; **"Kembali"** (`fa-arrow-left`) → the previous in-app page, or the scope's Amaran page when there is none (district → `/amaran/ppd`, state → `/amaran/jpn`, school → `/amaran/sekolah/{id}`) (DV-M18-21; live `url()->previous()` pointed at AJAX URLs) | S23-004–005, 044 | As S18/S19/S22 | OBSERVED + DV-M18-21 |
| FN-M18-4.7.2 | Report head: "PRESTASIPLUS · Ringkasan Eksekutif", h1 scope — `scope=district` **"PPD BATANG PADANG"** (DV-M18-22), `scope=state` "Negeri {negeri}", `scope=school` "{SEKOLAH}" — sub ("{negeri} — Ringkasan Eksekutif", "Ringkasan Eksekutif Seluruh Negeri", "{PPD}, {negeri}" + "{n} pelajar"), "Dijana: {d MMMM yyyy, HH:mm}" (MYT, DV-M18-07); no query → the viewer's district report | S23-006–010, 045–047, 056–057 | As S18/S19/S22 | OBSERVED + DV-M18-07, DV-M18-22 |
| FN-M18-4.7.3 | Cards "{n}" "Jumlah Pelajar"; "{p}%" "On Track (Hijau)" "{n} pelajar"; "{p}%" "Perlu Perhatian" "{n} pelajar"; "{p}%" "Berisiko Tinggi" "{n} pelajar" (33 · 0% · 0% · 100%) | S23-011–025 | As S18/S19/S22 | OBSERVED |
| FN-M18-4.7.4 | Card **"Taburan Risiko"** with the stacked bar ("100%") | S23-026–028 | As S18/S19/S22 | OBSERVED |
| FN-M18-4.7.5 | Card **"Penglibatan Latih Tubi (Kombo)"**: "{x}" "Purata Kombo", "{n}" "Kombo Tertinggi", "{n}" "Pelajar Aktif Kombo", "{n}" "Aktif Hari Ini" (district 6 / 15 / 29 / 0; school 8880 6.4 / 13 / 14 / 0) | S23-029–038 | As S18/S19/S22 | OBSERVED |
| FN-M18-4.7.6 | District / state: card **"Pecahan Mengikut Sekolah"** table "#" · "Sekolah" · "Pelajar" · "Hijau" · "Kuning" · "Merah" · "Prt. Skor" — each school once (DV-M18-18) | S23-039–041 | As S18/S19/S22 | OBSERVED + DV-M18-18 |
| FN-M18-4.7.7 | Footer "Laporan ini dijana secara automatik oleh PRESTASIPLUS · {d MMMM yyyy, HH:mm}" / "Untuk maklumat lanjut, hubungi pentadbir sistem." | S23-042–043 | As S18/S19/S22 | OBSERVED |
| FN-M18-4.7.8 | School scope: card **"Analisis Risiko Mengikut Subjek"** "{w}/{m} lemah ({p}%)" per core subject with data | S23-048–055 | As S18/S19/S22 | OBSERVED |

**FT-M18-4.8 — Keberkesanan Intervensi (S20 `/amaran/keberkesanan/ppd`, S21 `/amaran/keberkesanan`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M18-4.8.1 | S20: "Kembali ke Dashboard PPD" (`fa-arrow-left`) → `/ppd/dashboard` | S20-004 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-4.8.2 | S20 GET form "Filter Sekolah:" select `school_id` ("Semua sekolah ({n})" + every school of the district, 118), submitting on change (INFERRED `onchange`); the table's school names link `?school_id={id}`; with a school the cards, charts and lists cover that school (live showed the same numbers for 8880, which holds all interventions) | S20-005–007 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED / INFERRED |
| FN-M18-4.8.3 | Four cards: "{n}" "Jumlah Intervensi"; "{p}%" "Kadar Berkesan" "{b}/{d} dinilai" (b = berkesan, d = evaluated); "{n}" "Perlu Tindakan" "{s} sederhana, {t} tidak berkesan" (n = s + t); "{n}" "Belum Dinilai" (S20: 2 · 0% "0/0 dinilai" · 0 "0 sederhana, 0 tidak berkesan" · 2; S21: 0 · 0% · 0 · 0) | S20-008–021; S21-005–018 | Admin (OBSERVED); officers, school admin, guru (INFERRED) | OBSERVED |
| FN-M18-4.8.4 | Charts: **"Pecahan Keberkesanan"** doughnut (labels "Berkesan", "Sederhana", "Tidak Berkesan", "Belum Dinilai"; colours #10b981, #f59e0b, #ef4444, #94a3b8; cutout 60%; legend bottom, point style, 11 px bold) and **"Trend Bulanan (6 Bulan)"** line "Intervensi" per month for the last 6 months ("Apr 2026" … "Sep 2026"; #6366f1, fill, tension 0.4, no legend, y from 0 step 1); empty "Tiada data intervensi lagi." / "Tiada data trend lagi." | S20-022–025; S21-019–024 | As FN-M18-4.8.3 | OBSERVED |
| FN-M18-4.8.5 | Card **"Intervensi Mengikut Jenis"**: one row per type used "{label}" "{n} kali" ("Sesi Kaunseling" "1 kali", "Mentor Rakan Sebaya" "1 kali") | S20-026–031 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-4.8.6 | Card **"Statistik Guru"**: table "#" · "Guru" · "Jumlah" · "Berkesan" (badge) · "Belum Nilai" (badge) · "Kadar" ("—" when none evaluated) | S20-032–036 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-4.8.7 | Card **"Perlu Tindakan Susulan"**: records still "Belum Dinilai" (and those "Sederhana"/"Tidak Berkesan", INFERRED): pupil name, "{jenis} · {d MMM yyyy}", badge "Belum Dinilai", arrow (`fa-arrow-right`) → `/amaran/intervensi/{studentId}` | S20-037–046 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-4.8.8 | Card **"Perbandingan Sekolah Daerah"** "{n} sekolah ada intervensi": table "Sekolah" (link `?school_id={id}`) · "Jumlah" · "Berkesan" · "Sederhana" · "Tdk Berkesan" · "Blm Dinilai" · "Kadar Berkesan" (SMK TINGGI KLUANG 2 · 0 · 0 · 0 · 2 · 0%); the page scrolls tables inside their cards at 375 px (DV-M18-19; live page 498 px wide) | S20-047–051 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED + DV-M18-19 |
| FN-M18-4.8.9 | S21: "Kembali ke Amaran" (`fa-arrow-left`) → `/amaran/sekolah/{viewer school id}` (admin: 127) | S21-004 | As FN-M18-4.8.3 | OBSERVED |
| FN-M18-4.8.10 | S21 without records: card **"Belum Ada Intervensi"** "Tiada rekod intervensi ditemui untuk sekolah ini. Guru boleh mula merekod intervensi dari halaman Amaran Awal." + "Lihat Senarai Risiko" (`fa-exclamation-triangle`) → `/amaran/sekolah/{id}`; with records S21 shows the S20 cards, charts and lists for the school (INFERRED, provisional) | S21-025–028 | As FN-M18-4.8.3 | OBSERVED / INFERRED |

**FT-M18-4.9 — Amaran CSV exports**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M18-4.9.1 | S17 **"Muat Turun CSV"** (`fa-download`) → `/amaran/export/class/{id}` — CSV (UTF-8 BOM) of the class risk list; columns PROPOSED = SRS §7.2 ("Bil", "Pelajar", "Tingkatan / Kelas", "Skor Risiko", "Status", "Ketepatan", "Penglibatan", "Penguasaan"; district file adds "Sekolah" after "Pelajar"); no IC, no e-mail (not observable, Q-M18-5; provisional; SEC-M18-03) | S17-019 | As FN-M18-4.2.1 | OBSERVED (link) / PROPOSED (file) |
| FN-M18-4.9.2 | S18 **"Muat Turun CSV"** (`fa-download`) → `/amaran/export/district/{district key}` for the page's district (DV-M18-17: live `/amaran/export/district/0`); columns PROPOSED = SRS §7.2 with "Sekolah" | S18-020 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED + DV-M18-17 / PROPOSED (file) |
| FN-M18-4.9.3 | S22/S28 **"Muat Turun CSV"** (`fa-download`) → `/amaran/export/school/{id}`; columns PROPOSED = SRS §7.2 without "Sekolah" | S22-023; S28-023 | As FN-M18-4.6.1 | OBSERVED (link) / PROPOSED (file) |

**FT-M18-4.10 — Log Intervensi (S24 `/amaran/intervensi/{studentId}`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M18-4.10.1 | Tiles "{n}" "Jumlah Intervensi", "{n}" "Berkesan", "{n}" "Belum Dinilai" (3 columns at every width; 2 · 0 · 2) | S24-004–009 | Admin (OBSERVED); guru, school admin, officers (INFERRED, Q-M18-8) | OBSERVED |
| FN-M18-4.10.2 | Card **"Rekod Intervensi Baru"**: form (hidden `student_id`) "Jenis Intervensi" `type` (required; `kaunseling` "Sesi Kaunseling" (default), `kelas_tambahan` "Kelas Tambahan", `tugasan_khas` "Tugasan Khas", `hubungi_ibubapa` "Hubungi Ibu Bapa", `mentor_rakan` "Mentor Rakan Sebaya", `bimbingan` "Bimbingan", `lain` "Lain-lain"); "Tarikh" `intervention_date` (date, required, default today); "Kelas (Pilihan)" `classroom_id` ("— Tiada —" + **the pupil's own classes**, DV-M18-23; live every class, 750); "Status" `status` (`done` "Selesai" default, `planned` "Dirancang"); "Catatan / Apa Yang Dilakukan" `notes` (textarea, required, placeholder "Cth: Sesi kaunseling bersama pelajar tentang pengurusan masa..."); "Tindakan Susulan (Pilihan)" `follow_up` (placeholder "Cth: Jumpa semula minggu depan untuk semak kemajuan..."); "Simpan Intervensi" (`fa-save`) → create; native `required` validation; after save the page reloads with the new record on top (INFERRED, Q-M18-7) | S24-010–027 | As FN-M18-4.10.1 | OBSERVED (form) / INFERRED (result) |
| FN-M18-4.10.3 | Card **"Sejarah Intervensi"**: one row per record, newest first — type badge ("Sesi Kaunseling" `fa-comments` blue, "Mentor Rakan Sebaya" `fa-user-friends` cyan; other types INFERRED colours), date "{d MMM yyyy}", notes, meta line (teacher, status, follow-up) | S24-028–033, 045–048 | As FN-M18-4.10.1 | OBSERVED |
| FN-M18-4.10.4 | Per record: select `effectiveness` (`belum_dinilai` "Belum Dinilai", `berkesan` "Berkesan", `sederhana` "Sederhana", `tidak_berkesan` "Tidak Berkesan") that **saves on change** (PATCH; page reloads, INFERRED) | S24-034–037, 049–052 | As FN-M18-4.10.1 | OBSERVED (UI) / INFERRED (save) |
| FN-M18-4.10.5 | Per record: pencil toggle (`fa-pen`, `showFollowUp`) reveals textarea `follow_up` "Tindakan susulan..." + "Simpan" (PATCH follow-up) | S24-038–040, 053–055 | As FN-M18-4.10.1 | OBSERVED (UI) / INFERRED (save) |
| FN-M18-4.10.6 | Per record: trash button (`fa-trash`) → `confirm('Padam intervensi ini?')` → DELETE; Cancel keeps it | S24-041–044, 056–059 | As FN-M18-4.10.1 | OBSERVED (UI) / INFERRED (delete) |
| FN-M18-4.10.7 | **"Kembali"** (`fa-arrow-left`) → the previous in-app page, or `/amaran` when there is none (DV-M18-21; live `url()->previous()` gave `/admin/server-status`, `/notifikasi/unread-count`, `/chatbot/history?…`) | S24-060–062 | As FN-M18-4.10.1 | OBSERVED + DV-M18-21 |
| FN-M18-4.10.8 | Mutations are stored in the M18 intervention store (DATA-M18-01) and immediately change S20/S21, S24 tiles and the "Perlu Tindakan Susulan" list; only the pupil's teacher, school admin and officers of its scope may write (INFERRED; SEC-M18-04) | — | As FN-M18-4.10.1 | INFERRED |

### EP-M18-5 — Item analysis — officer views and school drill-downs (S25–S27, S30)


**FT-M18-5.1 — Analisa Item PPD / JPN (S25 `/analisa-item/ppd`, S26 `/analisa-item/jpn`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M18-5.1.1 | Breadcrumb "Papan Pemuka" → `/dashboard` / "Analisa Item PPD" ("Analisa Item JPN"); header card h2 "{PPD}" "{negeri}" / "JPN {negeri}" in **white** on the dark card (DV-M18-31; live dark slate, unreadable), "Laporan Analisa Item Pejabat Pendidikan Daerah — Data Keseluruhan Daerah" / "Laporan Analisa Item Jabatan Pendidikan Negeri — Data Keseluruhan Negeri", counters "{n}" "Sekolah" (118 / 1,189), "{n}" "Pelajar" (135); h2 `text-sm` at 375 and `sm:text-2xl` above (as live) | S25-004–014; S26-004–013 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED + DV-M18-31 |
| FN-M18-5.1.2 | Cards "Jumlah Sekolah" (118 / 1,189), "Jumlah Pelajar" (135), "Soalan Dijawab" (10,535), "Ketepatan PPD" / "Ketepatan Negeri" (71.6%) | S25-015–026; S26-014–025 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-5.1.3 | S25 card **"Perbandingan Sekolah"** "Kedudukan sekolah mengikut ketepatan jawapan pelajar": table "#" · "Sekolah" (→ `/analisa-item/sekolah/{id}`, M08) · "Jenis" · "Pelajar" (pupils with answers) · "Jawapan" · "Ketepatan" — schools with answers by accuracy descending (LAYANG-LAYANG SMK 6 · 222 · 83.8%; TINGGI KLUANG SMK 31 · 10,194 · 71.7%; KAMPONG CHAMEK SK 1 · 119 · 38.7%) | S25-027–033 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-5.1.4 | Card **"Prestasi Mengikut Subjek"** "Perbandingan ketepatan jawapan merentasi semua subjek dalam daerah\|negeri": the subject cards of FN-M18-2.1.11 | S25-034–066; S26-030–062 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-5.1.5 | Card **"Soalan Kritikal — Majoriti Pelajar Salah"** (S26 "Soalan Kritikal — Seluruh Negeri"), "Soalan yang perlu intervensi pengajaran segera di peringkat PPD\|JPN", `fa-exclamation-circle` "{n} soalan kritikal dijumpai" (20): cards (first 5 shown) with rank, question stem (M04), chips subject (`fa-book-open`), topic (`fa-bookmark`), sub-topic (`fa-tag`), label from % salah (BR-M18-26; all "Sukar" 100.0% observed), `fa-times-circle` "{p}% salah" (1 decimal), `fa-users` "{n} pelajar", `fa-percent` "{p}% terlibat" (pupils ÷ scope pupils, "1.5%" = 2 ÷ 135), `fa-rotate-right` "{n} cubaan", `fa-user-times` "Pelajar salah:" + pupil chips (`fa-user-graduate`) → `/headcount/student/{id}` (M08); list: the stored per-question statistics set of the scope by % wrong descending, at most 20 (BR-M18-26; INFERRED set and ties) | S25-067–109; S26-063–105 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED / INFERRED (selection) |
| FN-M18-5.1.6 | Toggle **"Lihat Semua ({n} soalan)"** (`fa-chevron-down`) / **"Sembunyikan"** (`fa-chevron-up`) (`x-data="{ showAll: false }"`) shows or hides cards 6–20 | S25-110–111; S26-106 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-5.1.7 | S26 card **"Perbandingan Daerah (PPD)"** "Kedudukan daerah mengikut ketepatan jawapan pelajar": table "#" · "Daerah" · "Sekolah" · "Pelajar" · "Jawapan" · "Ketepatan" (no links) — every PPD of the state by accuracy descending then the live order (KLUANG 118 · 135 · 10,535 · 71.6%; the 10 others "{schools} · 0 · 0 · 0.0%") | S26-026–029 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |

**FT-M18-5.2 — Dashboard Prestasi Sekolah (S27 `/sekolah/{id}/prestasi`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M18-5.2.1 | Head: "←" → `/prestasi/sekolah` (M08), "🏫", h1 "{SEKOLAH}", "Dashboard Prestasi Sekolah · {k} kelas · {n} murid" (9 · 59) | S27-004–008 | Admin (OBSERVED); officers, school admin (INFERRED) | OBSERVED |
| FN-M18-5.2.2 | Seven stat cards (`grid-cols-2 sm:grid-cols-4 lg:grid-cols-7`): "{n}" "Murid" (59), "Guru" (2), "Kelas" (9), "Subjek" (3), "Sesi Latihan" (60), "Soalan Dijawab" (675 — questions of the completed practice sessions), "Purata Ketepatan" (72.4% — mean of the session accuracies) | S27-009–029 | As FN-M18-5.2.1 | OBSERVED |
| FN-M18-5.2.3 | Card **"📊 GPS Anggaran"** "Gred Purata Sekolah (lebih rendah = lebih baik)": "{gps}" "GPS" band pill ("2.49" "Baik"), "Berdasarkan **{n}** entri headcount" (148), "* Anggaran dari markah OTR, bukan SPM sebenar" (M08 BR-M08-01/03 over the school's entries) | S27-030–038 | As FN-M18-5.2.1 | OBSERVED |
| FN-M18-5.2.4 | Card **"📈 Taburan Gred (Anggaran)"**: rows A+ … G with count and % (A+ 4 (2.7%), A 36 (24.3%), A- 42 (28.4%), B+ 36 (24.3%), B 18 (12.2%), C+ 6 (4.1%), C 4 (2.7%), D 1 (0.7%), E 1 (0.7%), G 0 (0%)), "Jumlah: {n} rekod" (148) | S27-039–071 | As FN-M18-5.2.1 | OBSERVED |
| FN-M18-5.2.5 | Card **"📚 GPS Mengikut Subjek"**: table "#" · "Subjek" · "GPS" · "Gred" · "Entri" · "On Track" · "Below" · "Tiada Sasaran" · "Pencapaian" (bar) per M08 BR-M08-04 (Bahasa Inggeris 2.21 A- 28 · 13 · 15 · 0 … Fizik 4.00 B 1 · 1 · 0 · 0) | S27-072–074 | As FN-M18-5.2.1 | OBSERVED |
| FN-M18-5.2.6 | Card **"🎓 Perbandingan Tingkatan"**: one link card per level "Tingkatan {n}" "{p}%" "{k} kelas" "{m} murid" "{s} sesi latihan" → `/prestasi/tingkatan/t{n}` (M08) — **scoped to the school** (DV-M18-32): k = the school's classes of the level (4 / 5 as live), m = the school's pupils in them, s and p = their sessions and mean session accuracy (live 143 / 113 murid, 10 / 85 sesi, 63.9% / 73.5% are platform figures) | S27-075–078 | As FN-M18-5.2.1 | OBSERVED + DV-M18-32 |
| FN-M18-5.2.7 | Card **"👩‍🏫 Prestasi Guru"**: per teacher of the school a link → `/prestasi/sekolah/{id}/guru/{userId}` (M08), "{k} kelas · {m} murid" (m = the school's pupils in the teacher's classes, DV-M18-32; live 151 / 30), "Ketepatan: {p}%", "On Track: {n}" "Below: {n}" or "Tiada data headcount" | S27-079–093 | As FN-M18-5.2.1 | OBSERVED + DV-M18-32 |
| FN-M18-5.2.8 | Card **"🔗 Navigasi Pantas"**: "🔬 Analisa Item" → `/sekolah/{id}/analisa-item` | S27-094–096 | As FN-M18-5.2.1 | OBSERVED |

**FT-M18-5.3 — Analisa Item Sekolah (S30 `/sekolah/{id}/analisa-item`; shared component, XR-M18-09)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M18-5.3.1 | Breadcrumb "Papan Pemuka" → `/dashboard` / "Analisa Item Sekolah"; school card h2 "{SEKOLAH}", code, type pill ("SMK"), "{PPD} • {negeri}", counters "{n}" "Pelajar" (59), "{n}" "Jawapan" (10,194) | S30-004–015 | As FN-M18-5.2.1 | OBSERVED |
| FN-M18-5.3.2 | Pills "Tingkatan:" (`fa-graduation-cap`) "Semua" / "Tingkatan 4" / "Tingkatan 5" (`?tingkatan=T4\|T5`, active `bg-indigo-600 text-white`) filtering the pupils by class level | S30-016–019 | As FN-M18-5.2.1 | OBSERVED |
| FN-M18-5.3.3 | Cards "Jumlah Pelajar" (59), "Soalan Dijawab" (10,194), "Ketepatan Keseluruhan" (71.7%; T4 76.3%) | S30-020–028, 082 | As FN-M18-5.2.1 | OBSERVED |
| FN-M18-5.3.4 | Card **"Profil Kesukaran"**: stacked bar with tooltips "Mudah: {n}", "Sederhana: {n}", "Sukar: {n}" and the counts under "Mudah" "Sederhana" "Sukar" = the listed question cards by their label (BR-M18-26): 8880 0 / 0 / 20, 8765 5 / 0 / 1; "Tiada data" without cards (2700, 3160 …) | S30-029–039 | As FN-M18-5.2.1 | OBSERVED |
| FN-M18-5.3.5 | Card **"GPS Anggaran Sekolah"**: "{gps}" band pill, "Berdasarkan {n} entri headcount • Lebih rendah = lebih baik", year sparkline (labels "22" … "26", tooltips "{yyyy}: {gps}") and link "Prestasi 360" (`fa-chart-pie`) → `/sekolah/{id}/prestasi` — **scoped to the school** (DV-M18-39: 8880 "2.49" "Baik" "Berdasarkan 148 entri headcount", as S27; live shows the platform 3.45 / 744 and the platform years 2022 5.20, 2023 4.80, 2024 4.50 …); the sparkline shows the school's yearly GPS points (M08 history; only the current year for 8880) | S30-040–051 | As FN-M18-5.2.1 | OBSERVED + DV-M18-39 |
| FN-M18-5.3.6 | Card **"Prestasi Mengikut Subjek"** "Ringkasan ketepatan dan jawapan salah bagi setiap subjek": table "Subjek" · "Pelajar" · "Soalan" (distinct questions) · "Ketepatan" · "Salah" (wrong answers) by accuracy ascending (Sains 29 · 1,094 · 70.9% · 539 … Matematik 31 · 817 · 72.4% · 614; T4 Sejarah 15 · 854 · 75.7% · 312 …) | S30-052–055 | As FN-M18-5.2.1 | OBSERVED |
| FN-M18-5.3.7 | Card **"Soalan Paling Banyak Salah — Perlu Perhatian Khas"** "Soalan yang majoriti pelajar jawab salah. Fokuskan pengajaran khas di sini.": "Tapis:" (`fa-filter`) subject pills "Semua ({n})", "{Subjek} ({n})" (8880: "Semua (20)", "Bahasa Melayu (13)", "Sains (6)", "Sejarah (1)"; T4 "Bahasa Inggeris (1)", "Bahasa Melayu (11)", "Sains (2)", "Sejarah (6)") filtering the cards client-side | S30-056–063, 083–086 | As FN-M18-5.2.1 | OBSERVED |
| FN-M18-5.3.8 | Question cards (click toggles `open`): icon and label from % salah (BR-M18-26: `fa-frown` "Sukar", `fa-meh` "Sederhana", `fa-smile` "Mudah"), rank, stem, chips, "{p}% salah", "{n} pelajar cuba", "{p}% pelajar terlibat" (pupils who tried ÷ pupils of the view: "3.4%" = 2 ÷ 59; 8765 "28.6%" = 6 ÷ 21, T4 "42.9%" (÷ 14), T5 "28.6%" (2 ÷ 7)), "{n} pelajar salah — klik untuk lihat" (omitted when none); opened: "{L}" "Jawapan Betul" {option}, "{L}" "Jawapan Salah Paling Popular ({n}x dipilih)" {option}, "Pelajar Yang Salah" chips (`fa-user`, name · class · wrong option) → `/prestasi/{userId}` (M08). Card lists are observed anchors: 8880 20 (all "Sukar" 100.0%), 8765 6 (card 1 "Sukar" 84.6% 6 cuba; cards 2–6 "Mudah" 0.0% 1 cuba 4.8%; T5 card 1 "Sederhana" 50.0% 2 cuba), 2710 none | S30-064–075, 087–093 | As FN-M18-5.2.1 | OBSERVED / INFERRED (cut-offs) |
| FN-M18-5.3.9 | A school with pupils but no answers shows "Soalan Dijawab" 0, "Ketepatan Keseluruhan" "0.0%", "Profil Kesukaran" "Tiada data", empty subject table and no cards (OBSERVED 1, 2700, 3160, 7780, 8767, 8772); a school without pupils shows **"Tiada Data Pelajar"** / "Tiada data pelajar untuk sekolah ini. Pastikan pelajar telah berdaftar dan menjawab soalan." (the copy of the live unknown-id page; INFERRED case; M08 FR-M08-60 wording differs — XR-M18-09) | S30-079–081 | As FN-M18-5.2.1 | OBSERVED / INFERRED |

### EP-M18-6 — Kombo Harian — officer views of the M14 streak store (S29, S31–S33)


**FT-M18-6.1 — District / state kombo (S31 `/kombo/ppd`, S32 `/kombo/jpn`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M18-6.1.1 | Breadcrumb "Papan Pemuka" → `/dashboard` / "Kombo Harian PPD" ("Kombo Harian JPN"); h2 "Kombo Harian — {PPD}" / "Kombo Harian — JPN {negeri}" (`text-sm sm:text-2xl`), "Gambaran keseluruhan aktiviti kombo latihan pelajar seluruh daerah\|negeri"; tiles "{n}" "Jumlah Pelajar" (33), "{n}" "Berlatih Hari Ini" (0), "{n}" "Kombo Aktif" (29), "{x}" "Purata Kombo" (6), "{n}" "Kombo Tertinggi" (15) | S31-004–019; S32-004–019 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |
| FN-M18-6.1.2 | Card **"Perbandingan Sekolah"** "Kedudukan sekolah mengikut bilangan kombo aktif": table "#" (medals) · "Sekolah" (→ `/kombo/sekolah/{id}`) · "Pelajar" · "Kombo Aktif" · "Purata Kombo" — every school of the scope (122 / 1,102 rows, no pager, as live), by kombo-active count descending then school id (HAMID KHAN 17 · 15 · 7; TOH TANDEWA SAKTI 16 · 14 · 4.9; SK PENDITA ZA'BA 0 · 0 · 0 …) | S31-020–026; S32-020–026 | Admin (OBSERVED); PPD / JPN officer (INFERRED) | OBSERVED |

**FT-M18-6.2 — School kombo (S29 `/sekolah/{id}/kombo`, S33 `/kombo/sekolah/{id}`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M18-6.2.1 | Tiles (`grid-cols-2 lg:grid-cols-5`): "{n}" "Jumlah Pelajar", "{n}" "Aktif Hari Ini", "{x}" "Purata Kombo", "{n}" "Kombo Tertinggi", "{n}" "Pelajar Aktif Kombo" (8880: 59 · 0 · 6.4 · 13 · 14; 7780: 17 · 0 · 7 · 15 · 15) | S29-004–013; S33-004–013 | Admin (OBSERVED); officers, school admin (INFERRED) | OBSERVED |
| FN-M18-6.2.2 | Card **"Aktiviti Harian Sekolah"**: 365-day grid (months, "Isn" "Rab" "Jum" "Ahd", "Kurang" … "Lebih") coloured by the school's correct answers per day, cells with a tooltip; caption "Warna menunjukkan bilangan soalan betul seluruh sekolah setiap hari" | S29-014–038; S33-014–038 | As FN-M18-6.2.1 | OBSERVED |
| FN-M18-6.2.3 | Card **"Perbandingan Kelas"**: table "Kelas" · "Subjek" · "Pelajar" (the school's pupils in the class) · "Purata Kombo" (1 decimal) · "Max Kombo" · "Aktif" — classes holding the school's pupils by average kombo descending (8880: "5 Sinar" Fizik 15 · 0.0 · 0 · 0 …; 7780: "4 Bestari - BM" Bahasa Melayu 1 · 8.0 · 8 · 1 …) | S29-039–041; S33-039–041 | As FN-M18-6.2.1 | OBSERVED |
| FN-M18-6.2.4 | Card **"Top 10 Kombo Sekolah"**: table "#" (medals) · "Nama" (→ `/prestasi/{userId}`, M08) · "Kombo" (current) · "Terbaik" (best) · "Jumlah Hari" (a **stored per-pupil counter**, replicated: 2710 rows "1 / 5 / 13" and "1 / 1 / 4"; 0 on every other observed row; not days counted from the answer log — DV-M18-41 rejected) — the school's pupils by current kombo descending, top 10 | S29-042–044; S33-042–044 | As FN-M18-6.2.1 | OBSERVED |
| FN-M18-6.2.5 | Kombo figures read the M14 streak store (DATA-M14-08 `current`, `best`) — "Kombo Aktif" = pupils with `current` > 0 as stored (live values are not decayed by inactivity, replicated); "Berlatih Hari Ini" / "Aktif Hari Ini" = pupils with an answer today (M05); `/kombo` itself stays the M14 redirect to `/dashboard` | — | System | OBSERVED / INFERRED |

---

## 4. User stories

Values in the ACs come from the seed (SRS §6.10–§6.11; admin figures = the observed record of 2026-09-26 12:36 MYT, computed at the project clock). "The admin" = `admin@demo.test` (id 1) at the **project clock 2026-09-25T15:40:00+08:00**; time-dependent values are stated at that clock. "The PPD officer" = `ppd@demo.test` (id 9, PPD HULU LANGAT, Selangor) and "the JPN officer" = `jpn@demo.test` (id 10, Selangor): their ACs are **provisional** (scope and menus INFERRED, Q-M18-1/2). "School 8880" = SEKOLAH MENENGAH KEBANGSAAN TINGGI KLUANG (JEB2037, PPD KLUANG, Johor); "8765" = SEKOLAH MENENGAH KEBANGSAAN LAYANG-LAYANG (JEA2029); "7780" = SEKOLAH MENENGAH KEBANGSAAN HAMID KHAN (PPD BATANG PADANG, Perak); "school 1" = SEKOLAH KEBANGSAAN TOH TANDEWA SAKTI; "pupil 3215" = the intervention pupil of 8880 (live user id 2229, mapped onto M08 anchor 3215 per XR-M18-08; fictitious name). E2E run at 375×812, 768×1024 and 1280×800.

| ID | Feature | MoSCoW | Story | Functions |
|---|---|---|---|---|
| US-M18-01 | FT-M18-1.1 | Must | As an officer, I want the PPD / JPN entries and "Amaran Awal" in one consistent menu inside the portal shell, so that I can reach every officer page on any device. | FN-M18-1.1.1–1.1.4, 1.1.8 |
| US-M18-02 | FT-M18-1.1 | Must | As an officer, I want each page's header and tab title to name the page and my scope, so that I know where I am. | FN-M18-1.1.5–1.1.7 |
| US-M18-03 | FT-M18-1.2 | Must | As the owner, I want the officer area closed to guests and to roles without a purpose, so that minors' data stays with authorised staff. | FN-M18-1.2.1, 1.2.2 |
| US-M18-04 | FT-M18-1.2 | Must | As an officer, I want every page limited to my district or state, and the admin preview to keep its observed scopes, so that figures are about the schools I am responsible for. | FN-M18-1.2.3–1.2.5, 1.2.9 |
| US-M18-05 | FT-M18-1.2 | Must | As any user, I want wrong or forbidden URLs to show the standard 403 / 404 pages, so that errors are predictable. | FN-M18-1.2.6–1.2.8 |
| US-M18-06 | FT-M18-1.3 | Must | As an officer, I want consistent page heads, period pills, medals, pagers and number formats, so that the pages read the same way. | FN-M18-1.3.1–1.3.7 |
| US-M18-07 | FT-M18-2.1 | Must | As a PPD officer, I want the district dashboard's scope header and KPI cards, so that I see the district's size, GPS, risk, accuracy, kombo and headcount coverage at a glance. | FN-M18-2.1.1–2.1.7 |
| US-M18-08 | FT-M18-2.1 | Must | As a PPD officer, I want the GPS and risk comparisons of the schools, so that I can see which schools need help. | FN-M18-2.1.8–2.1.10 |
| US-M18-09 | FT-M18-2.1 | Must | As a PPD officer, I want accuracy by subject, kombo and mastery per school, so that I understand engagement and learning. | FN-M18-2.1.11–2.1.15 |
| US-M18-10 | FT-M18-2.1 | Should | As a PPD officer, I want the monthly correction overview and the report links, so that I can open detailed reports. | FN-M18-2.1.16–2.1.19 |
| US-M18-11 | FT-M18-2.2 | Could | As a PPD officer, I want a live command center for my district, so that I can watch activity in real time. | FN-M18-2.2.1, 2.2.2 |
| US-M18-12 | FT-M18-2.3 | Should | As a PPD officer, I want usage statistics of my district per period, so that I know which schools practise. | FN-M18-2.3.1–2.3.3 |
| US-M18-13 | FT-M18-2.4 | Should | As an officer, I want the national top-50 school ranking per period, so that I can compare with the best schools. | FN-M18-2.4.1–2.4.3 |
| US-M18-14 | FT-M18-2.5 | Must | As a PPD officer, I want to benchmark every school of my district by a composite score, optionally by subject, and export it, so that I can rank schools fairly. | FN-M18-2.5.1–2.5.6 |
| US-M18-15 | FT-M18-2.6 | Should | As a PPD officer, I want a heat map of accuracy per school and core subject, so that weak school-subject pairs stand out. | FN-M18-2.6.1–2.6.3 |
| US-M18-16 | FT-M18-2.7 | Should | As a PPD officer, I want to preview and download the district report as CSV, so that I can work with it in a spreadsheet. | FN-M18-2.7.1–2.7.3 |
| US-M18-17 | FT-M18-2.8 | Should | As a PPD officer, I want a school leaderboard with a podium, trends and a mobile card list, so that I can celebrate and follow up schools. | FN-M18-2.8.1–2.8.9 |
| US-M18-18 | FT-M18-2.9 | Must | As an officer, I want a school's statistics page with filters and usage cards, so that I can drill into one school. | FN-M18-2.9.1–2.9.5 |
| US-M18-19 | FT-M18-2.9 | Must | As an officer, I want the school's monthly table, activity calendar, subject report, pupil ranking and class table, so that I see how the school practises. | FN-M18-2.9.6–2.9.10 |
| US-M18-20 | FT-M18-2.9 | Must | As an officer, I want the pupil and teacher lists with IC numbers masked unless I deliberately reveal them, so that pupils' privacy is protected and audited. | FN-M18-2.9.11–2.9.13 |
| US-M18-21 | FT-M18-3.1 | Must | As a JPN officer, I want the state dashboard with KPIs, a school search and district filter and the district comparison, so that I can compare districts. | FN-M18-3.1.1–3.1.4 |
| US-M18-22 | FT-M18-3.1 | Must | As a JPN officer, I want the state GPS, risk, subject, kombo, mastery and correction sections and report links, so that I see the whole state. | FN-M18-3.1.5–3.1.12 |
| US-M18-23 | FT-M18-3.2 | Should | As a JPN officer, I want a working live command center of my state, refreshed every 10 seconds, so that I can monitor activity. | FN-M18-3.2.1–3.2.9 |
| US-M18-24 | FT-M18-3.3 | Could | As a JPN officer, I want usage statistics of my state and of each district, so that I can see adoption. | FN-M18-3.3.1–3.3.4 |
| US-M18-25 | FT-M18-3.4 | Should | As a JPN officer, I want the national ranking of PPDs and schools per period, so that I can compare districts across states. | FN-M18-3.4.1–3.4.4 |
| US-M18-26 | FT-M18-4.1 | Must | As an officer or teacher, I want one risk score and status per pupil from accuracy, engagement and mastery, so that every Amaran view agrees. | FN-M18-4.1.1–4.1.5 |
| US-M18-27 | FT-M18-4.2 | Must | As a teacher, I want to pick a class and see its pupils by risk with subject weaknesses, so that I can start interventions. | FN-M18-4.2.1, 4.3.1–4.3.5 |
| US-M18-28 | FT-M18-4.4 | Must | As a PPD officer, I want the district risk view, so that I can see the schools and pupils at highest risk. | FN-M18-4.4.1–4.4.5 |
| US-M18-29 | FT-M18-4.5 | Must | As a JPN officer, I want the state risk view by district and school, so that I can direct support. | FN-M18-4.5.1–4.5.7 |
| US-M18-30 | FT-M18-4.6 | Must | As an officer or school admin, I want a school's risk list by level, so that I can follow up its pupils. | FN-M18-4.6.1–4.6.6 |
| US-M18-31 | FT-M18-4.7 | Should | As an officer, I want a printable executive summary for my district, state or a school, so that I can report upwards. | FN-M18-4.7.1–4.7.8 |
| US-M18-32 | FT-M18-4.8 | Should | As an officer or school admin, I want intervention effectiveness by type, teacher, school and month, so that I know what works. | FN-M18-4.8.1–4.8.10 |
| US-M18-33 | FT-M18-4.9 | Could | As an officer or teacher, I want CSV exports of the risk lists, so that I can share them within the school system. | FN-M18-4.9.1–4.9.3 |
| US-M18-34 | FT-M18-4.10 | Must | As a teacher, I want to see a pupil's intervention history and go back where I came from, so that I know what was done. | FN-M18-4.10.1, 4.10.3, 4.10.7 |
| US-M18-35 | FT-M18-4.10 | Must | As a teacher, I want to record, evaluate, follow up and delete interventions for a pupil, so that the log stays accurate. | FN-M18-4.10.2, 4.10.4–4.10.6, 4.10.8 |
| US-M18-36 | FT-M18-5.1 | Must | As an officer, I want item analysis of my district or state with school / district comparison and critical questions, so that teaching can target them. | FN-M18-5.1.1–5.1.7 |
| US-M18-37 | FT-M18-5.2 | Must | As an officer, I want a school's performance dashboard with GPS, grades, levels and teachers of that school only, so that its figures add up. | FN-M18-5.2.1–5.2.8 |
| US-M18-38 | FT-M18-5.3 | Must | As an officer, I want a school's item analysis with its own GPS, subject table and most-wrong questions, so that I can advise the school. | FN-M18-5.3.1–5.3.9 |
| US-M18-39 | FT-M18-6.1 | Should | As an officer, I want kombo engagement of my district or state per school, so that I see daily practice habits. | FN-M18-6.1.1, 6.1.2 |
| US-M18-40 | FT-M18-6.2 | Should | As an officer, I want a school's kombo page with its calendar, classes and top pupils, so that I can recognise engaged pupils. | FN-M18-6.2.1–6.2.5 |
| US-M18-41 | FT-M18-1.3 | Must | As any user, I want every M18 page usable at phone, tablet and desktop widths, so that I can work anywhere. | FN-M18-1.3.1, 1.3.7 |

### Acceptance criteria

**US-M18-01 — Menu and shell**
- **AC-M18-01.1** Given the admin at 1280px, when a user-portal page loads, then the sidebar group "PPD / JPN" holds, in order, "Command Center LIVE" (`fa-satellite-dish`, badge "LIVE") → `/ppd/command-center`, "Dashboard PPD" → `/ppd/dashboard`, "Statistik Penggunaan" → `/ppd/statistik-penggunaan`, "Ranking Kebangsaan" → `/ppd/ranking-kebangsaan`, "Benchmark Sekolah" → `/ppd/benchmark-sekolah`, "Peta Haba" → `/ppd/peta-haba`, "Export Laporan" → `/ppd/export-laporan`, "Leaderboard Sekolah" → `/ppd/leaderboard-sekolah`, "Dashboard JPN" → `/jpn/dashboard`, "Statistik Penggunaan" → `/jpn/statistik-penggunaan`, "Ranking Kebangsaan" → `/jpn/ranking-kebangsaan` with the live icons (DV-SH-04, DV-M18-11).
- **AC-M18-01.2** Given the admin at 375px, when I open the drawer, then the same list appears in the same order, and "Amaran Awal" (`fa-exclamation-triangle`) → `/amaran` appears after "Analisa Item" and under "PENILAIAN".
- **AC-M18-01.3** Given the admin, when I open any M18 page except S11 and the error pages, then the user-portal shell renders (header chips, bell, bottom nav below 1024px); S11 renders without shell.
- **AC-M18-01.4** Given the PPD officer (provisional), when I open the menu, then I see the PPD entries and "Amaran Awal" and no JPN entries; given the JPN officer (provisional), I see the JPN entries and "Amaran Awal" and no PPD entries.

**US-M18-02 — Titles**
- **AC-M18-02.1** Given the admin, when S1, S5, S10, S18, S19, S20 and S25 load, then the header reads "Dashboard PPD" / "PPD KLUANG, Johor", "Benchmark Sekolah Daerah", "Dashboard JPN" / "Johor", "Amaran Awal — Daerah" / "PPD BATANG PADANG, Perak", "Amaran Awal — Negeri" / "Perak", "Keberkesanan Intervensi (Daerah)" / "PPD KLUANG, Johor · 118 sekolah", "Analisa Item — PPD", and the tab titles are those of FN-M18-1.1.7.
- **AC-M18-02.2** Given `/sekolah/8880/prestasi`, when it loads, then the header reads "Dashboard Prestasi Sekolah" / "SEKOLAH MENENGAH KEBANGSAAN TINGGI KLUANG" (not "Dashboard" / "Selamat datang kembali") and the tab "Dashboard Sekolah — Prestasi" (DV-M18-24).
- **AC-M18-02.3** Given `/amaran/ringkasan-eksekutif`, when it loads, then the h1, the header subtitle and the tab read "PPD BATANG PADANG" (no doubled "PPD PPD", DV-M18-22).
- **AC-M18-02.4** Given `/sekolah/8880/amaran?tingkatan=T4`, when it loads, then the subtitle reads "SEKOLAH MENENGAH KEBANGSAAN TINGGI KLUANG — Tingkatan 4"; `/amaran/kelas/1156` shows "5 CYBER — Sains Rumah Tangga".

**US-M18-03 — Access**
- **AC-M18-03.1** Given no session, when I open any M18 route, then I am sent to `/login` (INFERRED).
- **AC-M18-03.2** Given the admin, when I open each of S1, S3–S33 (known ids), then each returns its page (200); `/ppd/command-center` returns the 403 page.
- **AC-M18-03.3** Given the PPD officer (provisional), when I open `/jpn/dashboard`, then I get the M01 landing page `/ppd/dashboard`; given the JPN officer (provisional), `/ppd/dashboard` sends me to `/jpn/dashboard`; given a student, any M18 route sends me to `/dashboard`.
- **AC-M18-03.4** Given the teacher (provisional), when I open `/amaran`, then only my own classes are listed; when I open `/ppd/dashboard`, then I get `/dashboard`.

**US-M18-04 — Scope**
- **AC-M18-04.1** Given the admin, when I open S1, S5, S20 and S25, then each is scoped to "PPD KLUANG" / "Johor"; S10 and S26 to "Johor"; S18, S31 and S23 without query to "PPD BATANG PADANG" / "Perak"; S19 and S32 to "Perak"; S21 to "SEKOLAH KEBANGSAAN MERU RAYA".
- **AC-M18-04.2** Given the PPD officer (provisional), when I open `/ppd/dashboard`, then the header reads "PPD HULU LANGAT" / "Selangor", "Jumlah Sekolah" equals the number of non-fixture schools with district "PPD HULU LANGAT" and every school in the tables belongs to that district.
- **AC-M18-04.3** Given the PPD officer (provisional), when I open `/ppd/sekolah/8880` (PPD KLUANG), then the 403 page shows; when I open `/ppd/sekolah/8082` (PPD HULU LANGAT), then the page renders.
- **AC-M18-04.4** Given the JPN officer (provisional), when I open `/jpn/daerah/PPD%20KLUANG` (Johor), then the 403 page shows; `/jpn/daerah/PPD%20HULU%20LANGAT` renders.
- **AC-M18-04.5** Given the admin, when S1 and S10 load, then the fixture school 900002 "SK Demo" (PPD KLUANG) is in no table and every count equals the observed value (118, 1,189).

**US-M18-05 — Errors**
- **AC-M18-05.1** Given the admin, when I open `/ppd/command-center`, then the 403 page shows "403", "🚫", "Akses Ditolak", the live sentence, "Halaman Utama" → `/`, "Log Masuk" → `/login`, "PRESTASIPLUS" and the tab "403 - Akses Ditolak | PRESTASIPLUS".
- **AC-M18-05.2** Given the admin, when I open `/ppd/sekolah/99999999`, `/jpn/sekolah/99999999`, `/jpn/daerah/BOGUS`, `/ppd`, `/jpn`, `/jpn/benchmark-sekolah` or `/amaran/keberkesanan/jpn`, then the 404 page shows "404", "🔍", "Halaman Tidak Dijumpai", the live sentence, "Halaman Utama", "Mula Latihan", "PRESTASIPLUS".
- **AC-M18-05.3** Given the admin, when I open `/amaran/kelas/99999999`, `/kombo/sekolah/99999999` or `/sekolah/99999999/analisa-item`, then the 404 page shows — not "Akses Ditolak", "Ralat Pelayan" or "Sekolah Tidak Dinyatakan" (DV-M18-25/26/27).
- **AC-M18-05.4** Given the admin, when I open `/amaran/intervensi/99999999`, `/sekolah/99999999/prestasi` or `/amaran/sekolah/99999999`, then the 404 page shows (INFERRED).

**US-M18-06 — Shared widgets**
- **AC-M18-06.1** Given the admin on S4, when I click "7 Hari" and then "Hari Ini", then the URL gets `?period=7days` / `?period=today`, the pill is active and the sub-lines end with "· 7 Hari" / "· Hari Ini"; `?period=bogus` behaves as "30 Hari".
- **AC-M18-06.2** Given the admin on S1, when I use the GPS table pager, then "1–20 daripada 118" and "1 / 6" show, chevron left is disabled on page 1, the next page shows "21–40 daripada 118" "2 / 6"; the 7-row risk table shows no pager; typing "KLUANG" in the GPS search re-paginates the matches.
- **AC-M18-06.3** Given the admin on S5 and S8, when the list loads, then place 1 shows "🥇" (not "🏋"), places 2–3 "🥈", "🥉", and the texts "Tempat 1 — Emas", "Tempat 2 — Perak", "Tempat 3 — Gangsa" exist for assistive tech (DV-M18-01).
- **AC-M18-06.4** Given any M18 page at 375px, when it renders, then no content text is smaller than 12px (DV-M18-30) and numbers use "," thousands separators ("1,189", "10,535").
- **AC-M18-06.5** Given a mock latency of 1 s, when S1 loads, then the shell loading state shows until the data arrives; given `mock.failNext('/api/ppd/dashboard')`, then the M01 global error convention shows (no M18-specific copy).

**US-M18-07 — S1 head and KPIs**
- **AC-M18-07.1** Given the admin on S1, when it loads, then the breadcrumb reads "Papan Pemuka" → `/ppd/dashboard` / "Dashboard PPD" and the header card shows "PPD KLUANG", "Johor", "Dashboard Agregat Pejabat Pendidikan Daerah", "118" "Sekolah", "135" "Pelajar".
- **AC-M18-07.2** Given S1, then the cards read "Jumlah Sekolah" 118 "Semua sekolah daftar di daerah (termasuk inactive)", "Jumlah Pelajar" 135 "Enrolmen pelajar (semua, termasuk belum aktif)", "GPS Purata" "2.49" "A-" with the GPS sub-line, "Ketepatan Keseluruhan" "71.6%" "% jawapan betul dari semua quiz pelajar (lifetime)".
- **AC-M18-07.3** Given S1, then "Pelajar Berisiko Merah" reads 135, "100% daripada 135 pelajar", "Zon risiko gagal SPM (EWS) · perlu intervensi segera" and "⚠ Drp ini: 86 akademik berisiko, 49 belum mula latih" (as live; the split reads `lastActiveAt`, not the login states).
- **AC-M18-07.4** Given S1, then "Kombo Aktif" reads 81 "daripada 135 pelajar" and "Coverage Headcount" reads "64" "(47.4%)", "daripada 135 pelajar enrolled", "📊 Funnel: 65 dlm Headcount (48.1%) → 64 ada markah".

**US-M18-08 — S1 GPS and risk**
- **AC-M18-08.1** Given S1, then "Prestasi GPS — Perbandingan Sekolah" lists 118 schools; row 1 is "SEKOLAH MENENGAH KEBANGSAAN TINGGI KLUANG" 2.49 "A-" 59 linking `/sekolah/8880/prestasi`; every other row shows "—" "—".
- **AC-M18-08.2** Given S1, then "Amaran Awal — Taburan Risiko" shows 0 "On Track" "0%", 0 "Perlu Perhatian" "0%", 135 "Berisiko Tinggi" "100%", the bar "Taburan Risiko Keseluruhan Daerah" "100%" and "Hijau: 0", "Kuning: 0", "Merah: 135".
- **AC-M18-08.3** Given S1, then the risk table has 7 rows (CHONG HWA I 12, TUN HUSSEIN ONN 13, TAMAN KLUANG BARAT 12, SERI KENCANA 14, KAMPONG CHAMEK 4, LAYANG-LAYANG 21, TINGGI KLUANG 59; Merah = Pelajar), each school once, linking `/sekolah/{id}/amaran`.

**US-M18-09 — S1 subjects, kombo, mastery**
- **AC-M18-09.1** Given S1, then six subject cards show in this order: Sejarah 70.7% 31 pelajar 1,154 soalan 649 salah; Sains 70.9% 29 · 1,094 · 539; Bahasa Melayu 71.1% 32 · 545 · 634; Bahasa Inggeris 71.9% 29 · 851 · 539; Matematik 72.6% 37 · 828 · 631; Pendidikan Islam 92.3% 1 · 50 · 4.
- **AC-M18-09.2** Given S1, then "Kombo Latihan — Gambaran Daerah" shows 81 "Kombo Aktif", 135 "Jumlah Pelajar", "7.2" "Purata Kombo", 0 "Berlatih Hari Ini"; the table's first rows are LAYANG-LAYANG "21" 18 "8.2 hari", TINGGI KLUANG "59" 14 "6.4 hari", SERI KENCANA "14" 12 "6.8 hari" (Pelajar = school pupils, DV-M18-04).
- **AC-M18-09.3** Given S1, then the mastery note reads "📊 38 catatan penguasaan daripada 12 pelajar unik (1 pelajar boleh ada catatan untuk pelbagai subjek)"; tiles Pemula 14 "(36.8%)", Mula Belajar 20 "(52.6%)", Aktif 4 "(10.5%)", the other eight 0 "(0%)"; the table shows KAMPONG CHAMEK "4" "1.2 Mula Belajar" and LAYANG-LAYANG "21" "0.7 Mula Belajar" first.

**US-M18-10 — S1 corrections and links**
- **AC-M18-10.1** Given S1 at the project clock, then "Pembetulan — Gambaran Daerah" shows "Kadar pembetulan pelajar untuk September 2026", the notice "Tiada data pembetulan untuk bulan ini (2026-09)" without the `php artisan correction:backfill` line (DV-M18-05), tiles 135 / 0 / "0.0%" and rows "0 pelajar (0%)".
- **AC-M18-10.2** Given S1, then "Laporan Terperinci" links "Statistik Penggunaan" → `/ppd/statistik-penggunaan`, "Amaran Awal PPD" → `/amaran/ppd`, "Analisa Item PPD" → `/analisa-item/ppd`, "Keberkesanan Intervensi" → `/amaran/keberkesanan/ppd`, "Papan Pemuka" → `/ppd/dashboard`.
- **AC-M18-10.3** Given a school with a correction aggregate for the current month (test fixture `corrections-sep`, provisional), when S1 loads, then no notice shows and the row reads "{n} pelajar ({p}%)".

**US-M18-11 — Command Center PPD**
- **AC-M18-11.1** Given the admin, when I open `/ppd/command-center`, then the 403 page shows (OBSERVED).
- **AC-M18-11.2** Given the PPD officer (provisional), when I open `/ppd/command-center`, then the standalone Command Center renders with "Command Center PPD", badge "PPD HULU LANGAT", the clock and the S11 tiles computed over the district, and it requests `/api/ppd/command-center/live-data` every 10 s.

**US-M18-12 — Usage statistics (PPD)**
- **AC-M18-12.1** Given the admin on S3, then the breadcrumb reads "Dashboard PPD" / "Statistik Penggunaan", the header "PPD KLUANG" "Johor" "Statistik Penggunaan PRESTASIPLUS Dalam Daerah" "0" "Sekolah" "0" "Pelajar Aktif", and the card "Tiada data untuk tempoh ini" "Tiada aktiviti latihan dalam tempoh 30 Hari yang lepas.".
- **AC-M18-12.2** Given S3 `?period=7days`, then the text reads "… 7 Hari …"; `?period=today` shows "Belum ada pelajar buat latihan hari ini. Cuba lihat 7 Hari atau 30 Hari." with both words linking to their periods.
- **AC-M18-12.3** Given the PPD officer (provisional), when S3 loads with "30 Hari", then the PROPOSED table lists the district's schools with practice (8082, 8106, 8080, 8078, 8090, 8088 of PPD HULU LANGAT) with Pelajar, Betul, Dijawab, Ketepatan computed from the answer log.

**US-M18-13 — National ranking (PPD)**
- **AC-M18-13.1** Given the admin on S4, then the h2 reads "Ranking Sekolah 1 Malaysia", the sub "Top 50 sekolah paling aktif merentas seluruh Malaysia · 30 Hari", the card "Top 50 Sekolah — 1 Malaysia" "Berdasarkan jumlah jawapan betul · 30 Hari" and 7 rows: 🥇 ENGKU HUSAIN "PPD HULU LANGAT" "Selangor" 24 · 8,351 · 9,195 · 90.8%, 🥈 BANDAR RINCHING 24 · 5,317 · 6,462 · 82.3%, 🥉 KHIR JOHARI 18 · 3,710 · 4,271 · 86.9%, 4 BANDAR BARU BANGI 16 · 1,298 · 1,506 · 86.2%, 5 PANDAN INDAH 5 · 726 · 857 · 84.7%, 6 JALAN TIGA 1 · 15 · 20 · 75.0%, 7 SAM MUHAMMADIAH "PPD SABAK BERNAM" 1 · 3 · 5 · 60.0%; names link `/ppd/sekolah/{id}`.
- **AC-M18-13.2** Given S4 "7 Hari", then 7 rows start with 🥇 KHIR JOHARI 6 · 1,365 · 1,584 · 86.2%, 🥈 BANDAR RINCHING 13 · 1,247 · 1,567 · 79.6%, 🥉 ENGKU HUSAIN 8 · 1,084 · 1,256 · 86.3%; "Hari Ini" shows 1 row ENGKU HUSAIN 1 · 57 · 60 · 95.0%.

**US-M18-14 — Benchmark**
- **AC-M18-14.1** Given the admin on S5, then the header shows "PPD KLUANG" "Johor" "Perbandingan prestasi semua sekolah dalam daerah", "116" "Sekolah", **"73.1%"** "Purata Ketepatan" (DV-M18-02) and "0%" "Purata Aktif".
- **AC-M18-14.2** Given S5, then the table has 116 rows; row 1 🥇 "SEKOLAH MENENGAH KEBANGSAAN LAYANG-LAYANG" "JEA2029" 21 · 0 · 0% · "73.1%" · "222" "(10.6/pelajar)" · 22.6; row 2 🥈 KOLEJ VOKASIONAL KLUANG, row 3 🥉 CHIAN BEE with "—" and 0; the formula note reads as live.
- **AC-M18-14.3** Given S5, when I choose "Matematik (Teras)" and press "Tapis", then the URL is `?subject_id=3`, the heading reads "Kedudukan Sekolah — Matematik", LAYANG-LAYANG shows "76.3%", "Purata Ketepatan" shows "76.3%" and "Kosongkan" → `/ppd/benchmark-sekolah` appears; `?subject_id=99999` shows the all-subject heading and "Kosongkan".
- **AC-M18-14.4** Given S5, when I press "Eksport CSV", then a CSV named for PPD KLUANG downloads with the 11 columns of FN-M18-2.7.2 and 116 rows (subject not applied) (provisional file content).

**US-M18-15 — Heat map**
- **AC-M18-15.1** Given the admin on S6, then the h2 reads "Peta Haba Prestasi Daerah — PPD KLUANG", the sub ends "· 7 subjek × 116 sekolah", the legend shows "Cemerlang" "> 70%", "Sederhana" "41–70%", "Lemah" "≤ 40%", "Tiada Data".
- **AC-M18-15.2** Given S6, then LAYANG-LAYANG shows BM "60.3%", MT "76.3%", PI "92.2%" (two bases, DV-M18-40 rejected), SEJ "72.3%", Purata "75.3%"; SERI KENCANA BM, MT, SEJ "0%"; the footer "Purata Daerah" reads "—", "60.3%", "76.3%", "92.2%", "—", "—", "72.3%"; cells ≤ 40% are red.
- **AC-M18-15.3** Given S6 at 375px, then the hint "Skrol ke kanan untuk melihat semua subjek pada skrin kecil." shows and the table scrolls inside its card.

**US-M18-16 — Export**
- **AC-M18-16.1** Given the admin on S7 at the project clock, then the stats read 116 "Jumlah Sekolah", 72 "Jumlah Pelajar", 0 "Pelajar Aktif", "73.1%" "Purata Ketepatan", 222 "Soalan Dijawab" and the meta "Format: CSV (UTF-8 BOM)", "Dijana: 25 Sep 2026, 15:40" (MYT at the project clock, DV-M18-07; live read 26 Sep 06:25 UTC-labelled), "Daerah: PPD KLUANG, Johor".
- **AC-M18-16.2** Given S7, then the preview lists 5 rows (KOLEJ VOKASIONAL KLUANG JHA2001, CHIAN BEE JBC2003, CHONG ENG JBC2007, …) and "Menunjukkan 5 dari 116 sekolah. Muat turun CSV untuk data lengkap.".
- **AC-M18-16.3** Given S7, when I press "Muat Turun CSV", then a UTF-8-with-BOM CSV downloads with the header "Nama,Kod,Daerah,Pelajar,Aktif,% Aktif,Ketepatan,Soalan,Risiko Kritikal,Risiko Tinggi,Skor" and 116 rows, with no IC or e-mail (provisional content).

**US-M18-17 — Leaderboard**
- **AC-M18-17.1** Given the admin on S8 at 1280px, then the podium shows KOLEJ VOKASIONAL KLUANG "0" 🥈 "Tempat 2", LAYANG-LAYANG "21.9" 🥇 "Tempat 1", CHIAN BEE "0" 🥉 "Tempat 3" in that order, and the table row 1 reads LAYANG-LAYANG 21 · 0 · 0% · "73.1%" · "—" · (empty trend) · 21.9.
- **AC-M18-17.2** Given S8, when I click "Ikut Subjek", then only the tab highlight changes and the same filter and lists stay (as live).
- **AC-M18-17.3** Given S8 at 375px, then the table is hidden and the card list shows "🥇" LAYANG-LAYANG "21.9" "21 pelajar" "0 aktif (0%)" "73.1% tepat", "🥈" …, "#4" …; "Eksport CSV" opens `/ppd/export-laporan`.
- **AC-M18-17.4** Given a school with more correct answers in the last 30 days than in the 30 days before (test fixture `trend`, provisional), when S8 loads, then its Trend cell shows the "Meningkat" icon.

**US-M18-18 — School page head, filter, cards**
- **AC-M18-18.1** Given the admin on `/ppd/sekolah/8880`, then the breadcrumb reads "Ranking Kebangsaan" → `/ppd/ranking-kebangsaan` / "SEKOLAH MENENGAH KEBANGSAAN TINGGI KLUANG", the header shows "JEB2037", "PPD KLUANG", "Johor", "SMK" and counters 59 "Pelajar", "6.8%" "Penggunaan", 0 "Aktif 7 Hari".
- **AC-M18-18.2** Given `/ppd/sekolah/8880`, then the cards read 59, 4 "Pelajar yang telah menjawab", 55 "Belum pernah menjawab soalan", "6.8%", 0 "Latihan dalam 7 hari lepas", 15 "sesi per pelajar aktif"; `/jpn/sekolah/8765` reads 21 · 2 · 19 · "9.5%" · 0 · "10.5" and its breadcrumb "PPD KLUANG" → `/jpn/daerah/PPD%20KLUANG`.
- **AC-M18-18.3** Given `/ppd/sekolah/8880`, then "Tingkatan / Darjah" lists "Semua", "Darjah 6", "Tingkatan 1" … "Tingkatan 5", "Kelas" lists "Semua Kelas", "— 4 Simulasi", "— 5 Simulasi", and "Subjek" "Semua Subjek", "Bahasa Inggeris", "Bahasa Melayu", "Matematik"; choosing class "— 4 Simulasi" and "Tapis" gives `?class_id=516`, "0%" usage, "Reset" → `/ppd/sekolah/8880`.
- **AC-M18-18.4** Given the section nav, when I click "Guru", then the page scrolls to "Senarai Guru" and the nav marks it.

**US-M18-19 — School activity sections**
- **AC-M18-19.1** Given `/ppd/sekolah/8880`, then "Statistik Bulanan" shows "Feb 2026" 124 · 84 · 3 · 41.3 · 67.7% and "Mar 2026" 551 · 401 · 3 · 183.7 · 72.8%; with `?class_id=516` it shows "Tiada data" / "Tiada aktiviti direkodkan buat masa ini"; with `?subject_id=3` the sub ends "(subjek ditapis)".
- **AC-M18-19.2** Given 8880 at the project clock, then the calendar shows 33 "Hari Aktif", "7,307" "Jumlah Betul", 221 "Purata/Hari", month labels "Sep" … "Ogs" "Sep", and the first cell tooltip "2025-09-26: 0 pelajar aktif, 0 betul" (window of 365 days ending at the project clock; live 26 Sep showed "2025-09-27 …").
- **AC-M18-19.3** Given 8880, then "Laporan Subjek" shows "Bahasa Melayu" "BM" 1 · 26 · "34.6%" "Sebelum" "72%" "Selepas" "72%", "Bahasa Inggeris" "BI" 1 · 8 · "50%" · "71.9%" / "71.9%", "Matematik" "MATH" 1 · 5 · "100%" · "72.4%" / "72.4%"; 8765 shows 9 cards starting "Matematik" "MATH" 6 · 184 · "45.6%" with "Purata Level" "0.7".
- **AC-M18-19.4** Given 8880, then "Ranking Pelajar" shows "Tiada data ranking" / "Data ranking dikemas kini setiap hari"; clicking "Ikut Subjek" shows "Pilih subjek dari filter di atas"; with `?subject_id=3` it shows "Tiada data ranking untuk subjek ini".
- **AC-M18-19.5** Given 8880, then "Prestasi Per Kelas" reads "2 kelas dipaparkan" with "4 Simulasi" 15 · 0 · 15 · "0%" · "—" and "5 Simulasi" 15 · 3 · 12 · "20%" · "54.3%"; `/jpn/sekolah/8765` reads "0 kelas dipaparkan" "Tiada kelas dijumpai" "Sila cipta kelas terlebih dahulu".

**US-M18-20 — Pupils, IC privacy, teachers**
- **AC-M18-20.1** Given 8880, then the accordions read "4 Simulasi" "15 pelajar" "0 guna" "15 belum", "5 Simulasi" "15 pelajar" "3 guna" "12 belum", "Tiada Kelas" "28 pelajar"; opening "5 Simulasi" shows 15 rows with three "Tidak Aktif" rows (8 · 97 · "38.9%" · "17/03/2026", 7 · 78 · "41.1%" · "21/03/2026", 44 · 490 · "83.1%" · "26/03/2026") and "Belum Guna" rows "—" "Tiada rekod".
- **AC-M18-20.2** Given 8880 with a class open, then every "No. IC" cell shows "xxxxxx-xx-xx" + the last 2 digits of the (fictitious) IC and the page's network responses contain no full IC (SEC-M18-01).
- **AC-M18-20.3** Given 8880, when I press "Tunjuk IC Penuh" and cancel the dialog "Anda akan melihat No. IC penuh pelajar.\nTindakan ini direkodkan untuk pematuhan PDPA.\n\nTeruskan?", then nothing changes and no request is made; when I accept, then the full (fictitious) ICs show, the button reads "Sembunyikan IC" (`fa-eye-slash`) and one IC-reveal audit record exists for the admin and school 8880.
- **AC-M18-20.4** Given 8880, then "Senarai Guru" "Guru berdaftar di SEKOLAH MENENGAH KEBANGSAAN TINGGI KLUANG" lists 2 teachers (one with subjects "Bahasa Melayu", "Fizik", the other "-"); 8765 shows "Tiada guru berdaftar" / "Sekolah ini belum mempunyai guru yang berdaftar dalam sistem".

**US-M18-21 — JPN head, filter, districts**
- **AC-M18-21.1** Given the admin on S10, then the header reads "Johor", badge "JPN", "Dashboard Agregat Jabatan Pendidikan Negeri", "1,189" "Sekolah", "135" "Pelajar", and six cards 1,189 · 135 · "2.49" "A-" · 135 "100% daripada 135 pelajar" · "71.6%" · 81 "daripada 135 pelajar".
- **AC-M18-21.2** Given S10, then "Perbandingan Daerah (PPD) — Seluruh Negeri" lists 11 PPDs with KLUANG "118" · "135" · "135 (100%)" · "71.6%" (DV-M18-03) and BATU PAHAT 176, JOHOR BAHRU 146, KOTA TINGGI 97, KULAI 73, MERSING 47, MUAR 129, PASIR GUDANG 112, PONTIAN 100, SEGAMAT 110, TANGKAK 81 with "—" "—" "0.0%"; names link `/jpn/daerah/{PPD}`.
- **AC-M18-21.3** Given S10, when I choose "PPD KLUANG", then "118 sekolah dijumpai" shows (DV-M18-14) and "Reset" appears; when I type "KLUANG" instead, then "10 sekolah dijumpai"; when I type "ZZZ", then "0 sekolah dijumpai" and "Tiada sekolah dijumpai"; "Reset" restores every table.

**US-M18-22 — JPN sections**
- **AC-M18-22.1** Given S10, then the GPS table shows "Menunjukkan 1–20 daripada 1189 sekolah" and page buttons 1, 2, "…", 60; row 1 links `/jpn/sekolah/8880`.
- **AC-M18-22.2** Given S10, then the state risk table lists 7 distinct schools summing to 135 (TUN HUSSEIN ONN present, TINGGI KLUANG once; DV-M18-18).
- **AC-M18-22.3** Given S10, then "Tahap Penguasaan — Taburan Negeri" shows Pemula 14 "(36.8%)", Mula Belajar 20 "(52.6%)", Aktif 4 "(10.5%)" (DV-M18-15) and the "Kombo Latihan — Gambaran Negeri" rows show the school pupil count.
- **AC-M18-22.4** Given S10, then "Laporan Terperinci" links "Statistik Penggunaan" → `/jpn/statistik-penggunaan`, "Amaran Awal" → `/amaran/jpn`, "Analisa Item" → `/analisa-item/jpn`, "Kombo Harian" → `/kombo/jpn`.

**US-M18-23 — Command Center JPN**
- **AC-M18-23.1** Given the admin on S11, then the page has no shell, "← Dashboard" → `/jpn/dashboard`, "Command Center JPN", badge "Johor", "LIVE", a ticking "HH:MM:SS" "MYT" clock and the footer "Powered by ALESA AI · PrestasiPlus © 2026 · Data dikemaskini setiap 10 saat".
- **AC-M18-23.2** Given S11 after the first poll, then the tiles read "Sekolah Aktif" "1,187" "dari 1187 sekolah negeri", "Pelajar Berdaftar" "72" "6 aktif menjawab", "Soalan Dijawab" **"222"** (not "NaN") "sepanjang masa", "Ketepatan Purata" "83.8%" "keseluruhan negeri" (DV-M18-16).
- **AC-M18-23.3** Given S11, then "Top Sekolah Aktif" shows "1" "SEKOLAH MENENGAH KEBANGSAAN LAYANG-LAYANG" → `/jpn/sekolah/8765` "6 plj" (not "undefined"); "Aktiviti Hari Ini" "0 soalan", "Minggu ini: 0", "Sama dengan minggu lepas"; "Top Pelajar Minggu Ini" "Tiada data"; "Live Feed" "Tiada aktiviti terkini"; "Pecahan Daerah" lists 11 PPDs with "PPD KLUANG" "116 sekolah · 72 pelajar" "6 aktif"; no script error in the console.
- **AC-M18-23.4** Given S11, when 10 s pass, then `/api/jpn/command-center/live-data` is requested again; when the page closes, then polling stops; given a failing poll (`mock.failNext`), then the last values stay (provisional).
- **AC-M18-23.5** Given S11, then the "ALESA AI" panel shows the template sentence with values "Negeri menunjukkan stabil 0% minggu ini. 8.3% pelajar terlibat aktif. Ketepatan purata 83.8% dengan 1/1187 sekolah aktif. GPS daerah: 0." (provisional values, SOURCE-DERIVED template).

**US-M18-24 — Usage (JPN)**
- **AC-M18-24.1** Given the admin on S12, then the header reads "JPN Johor", "Statistik Penggunaan PRESTASIPLUS Seluruh Negeri", 0 "Daerah", 0 "Sekolah", 0 "Pelajar", and the card "Data belum tersedia" "Data ranking dikemas kini setiap hari. Sila semak semula esok."; no period pills.
- **AC-M18-24.2** Given `/jpn/daerah/PPD%20KLUANG`, then the breadcrumb reads "Statistik Negeri" → `/jpn/statistik-penggunaan` / "PPD KLUANG", the header "PPD KLUANG" "Johor" "Statistik Penggunaan PRESTASIPLUS Dalam Daerah" 0 "Sekolah" 0 "Pelajar Aktif" and the same empty card; all 11 Johor PPD names render the same.
- **AC-M18-24.3** Given the JPN officer and a filled usage snapshot for Selangor (test fixture `usage-selangor`, provisional), when S12 loads, then the PROPOSED PPD table shows the snapshot rows.

**US-M18-25 — National ranking (JPN)**
- **AC-M18-25.1** Given the admin on S13, then the header shows "Ranking Kebangsaan", "1 Malaysia", "Ranking PPD & Sekolah merentas seluruh Malaysia · 30 Hari", 2 "PPD Aktif", 7 "Sekolah Aktif"; "Ranking PPD — 1 Malaysia" "2 PPD aktif · 30 Hari — berdasarkan jumlah jawapan betul" lists 🥇 "PPD HULU LANGAT" "Selangor" 6 · 88 · 19,417 · 22,311 · 87.0% and 🥈 "PPD SABAK BERNAM" 1 · 1 · 3 · 5 · 60.0%.
- **AC-M18-25.2** Given S13, then "Top 50 Sekolah — 1 Malaysia" equals the S4 table with links `/jpn/sekolah/{id}`.
- **AC-M18-25.3** Given S13 "7 Hari", then HULU LANGAT reads 6 · 36 · 4,051 · 4,847 · 83.6%; "Hari Ini" reads "1 PPD aktif · Hari Ini — berdasarkan jumlah jawapan betul" and HULU LANGAT 1 · 1 · 57 · 60 · 95.0%.

**US-M18-26 — Risk model**
- **AC-M18-26.1** Given pupils with lifetime accuracy 38.9%, 41.1% and 83.1%, last activity ≥ 30 days ago and no mastery record, when their risk is computed, then the scores are 84.4, 83.6 and 66.8 with status "Berisiko Tinggi".
- **AC-M18-26.2** Given a pupil never active, then the score is 80 with "Tiada data latihan", "Tiada aktiviti", "Tiada data penguasaan"; given a pupil with an activity date but no answers and no mastery, then the score is 100 with "Tiada data", "Terakhir aktif: {date}", "Tiada data".
- **AC-M18-26.3** Given the class-1156 pupil (session accuracy 58.6%, last active 2026-09-15, average mastery level 3.95) at the project clock, then the score is **44.7** (10 days since the last login; the observed 45.7 is the 26-Sep value, 11 days), status "Perlu Perhatian" (yellow row), "Purata ketepatan: 58.6%", "Terakhir aktif: 2026-09-15", "Purata tahap: L4".
- **AC-M18-26.4** Given the same pupil on S17, S22 and S23, then the score and status are identical on every page.

**US-M18-27 — Class list and class risk**
- **AC-M18-27.1** Given the admin on `/amaran`, then class cards are listed by id descending starting "5 CYBER" "Sains Rumah Tangga · 1 pelajar" → `/amaran/kelas/1156`, "sains rumah tangga" "Sains Rumah Tangga · 0 pelajar", "Chaos Academy" …; 750 cards in total.
- **AC-M18-27.2** Given `/amaran/kelas/1156`, then "Kembali ke senarai kelas" → `/amaran`, tiles 1 · 0 · 1 · 0, the distribution legend, and one row "44.7" at the project clock (observed "45.7" on 26 Sep) "Perlu Perhatian" with the pupil link → `/prestasi/{userId}` and "Intervensi" → `/amaran/intervensi/{userId}`.
- **AC-M18-27.3** Given `/amaran/kelas/1156`, then "Analisis Risiko Mengikut Subjek" shows "Sejarah" "1/1 pelajar lemah (100%)" and "Bahasa Melayu", "Bahasa Inggeris", "Matematik", "Sains", "Pendidikan Islam" "0/1 pelajar lemah (0%)".
- **AC-M18-27.4** Given the teacher (provisional), when I open a class that is not mine, then the 403 page shows.

**US-M18-28 — District risk**
- **AC-M18-28.1** Given the admin on S18, then tiles read 33 · 0 · 0 · 33, "Taburan Risiko Seluruh Daerah" "100%" "Hijau: 0" "Kuning: 0" "Merah: 33", and the buttons link `/amaran/keberkesanan/ppd` and `/amaran/ringkasan-eksekutif?scope=district&district=PPD%20BATANG%20PADANG&state=Perak`.
- **AC-M18-28.2** Given S18, then "Perbandingan Sekolah" lists HAMID KHAN 17 · 97.6 · 0 · 0 · 17 → `/amaran/sekolah/7780` and TOH TANDEWA SAKTI 16 · 97.5 · 0 · 0 · 16 → `/amaran/sekolah/1`.
- **AC-M18-28.3** Given S18, then "Pelajar Berisiko Tertinggi" "Menunjukkan 33 dari 33 pelajar" lists 29 rows with score 100 then 4 rows with 80; row 1 is a TOH TANDEWA SAKTI pupil "Tingkatan 4 4 Bestari - BM" 100 "Berisiko Tinggi" "Tiada data" "Terakhir aktif: 2026-02-26" "Tiada data".

**US-M18-29 — State risk**
- **AC-M18-29.1** Given the admin on S19, then the breadcrumb reads "Papan Pemuka" → `/dashboard` / "Amaran Awal JPN", the header "JPN Perak" "Laporan Amaran Awal Jabatan Pendidikan Negeri — Data Seluruh Negeri" 33 "Pelajar", tiles 33 · 0 · 0 · 33 and only the "Ringkasan Eksekutif" button (→ `?scope=state&state=Perak`).
- **AC-M18-29.2** Given S19, then "Perbandingan Daerah (PPD)" lists "PPD BATANG PADANG" 2 · 33 · 97.6 · 0 · 0 · 33 and "Perbandingan Sekolah" lists HAMID KHAN "PPD BATANG PADANG" 17 · 97.6 and TOH TANDEWA SAKTI 16 · 97.5 — each once (DV-M18-18).
- **AC-M18-29.3** Given S19, then "Pelajar Berisiko Tertinggi (Seluruh Negeri)" "Menunjukkan 33 dari 33" lists the 33 pupils by score.

**US-M18-30 — School risk**
- **AC-M18-30.1** Given the admin on `/amaran/sekolah/7780`, then the pills link `/sekolah/7780/amaran`, `?tingkatan=T4`, `?tingkatan=T5`, tiles 17 · 0 · 0 · 17, "Merah: 17", buttons "Keberkesanan Intervensi" → `/amaran/keberkesanan`, "Ringkasan Eksekutif" → `?scope=school&school_id=7780`, "Muat Turun CSV" → `/amaran/export/school/7780`.
- **AC-M18-30.2** Given `/amaran/sekolah/7780`, then the list shows 17 pupils with level lines (3 "Tingkatan 4", 3 "Tingkatan 5", 11 lower forms), 15 with score 100 and 2 with 80; `/amaran/sekolah/1` shows 16 "Darjah n" pupils, some in "Tingkatan 4 4 Bestari - BM" (as live).
- **AC-M18-30.3** Given `/sekolah/8880/amaran`, then tiles read 59 · 0 · 0 · 59 and "Analisis Risiko Mengikut Subjek" shows "Bahasa Melayu", "Bahasa Inggeris", "Matematik" "1/1 pelajar lemah (100%)"; `?tingkatan=T5` shows 15 pupils of "5 Simulasi" with 84.4, 83.6, twelve 80 and 66.8, and "Merah: 15"; `?tingkatan=T4` shows the 15 class-516 pupils with 80 "Tiada data latihan" "Tiada aktiviti" "Tiada data penguasaan" (as live).

**US-M18-31 — Executive summary**
- **AC-M18-31.1** Given the admin on `/amaran/ringkasan-eksekutif?scope=district&district=PPD%20BATANG%20PADANG&state=Perak` at the project clock, then the report shows "PRESTASIPLUS · Ringkasan Eksekutif", h1 "PPD BATANG PADANG", "Perak — Ringkasan Eksekutif", "Dijana: 25 September 2026, 15:40", cards 33 / "0%" "0 pelajar" / "0%" "0 pelajar" / "100%" "33 pelajar", kombo 6 · 15 · 29 · 0 and "Pecahan Mengikut Sekolah" HAMID KHAN 17 · 0 · 0 · 17 · 97.6, TOH TANDEWA SAKTI 16 · 0 · 0 · 16 · 97.5.
- **AC-M18-31.2** Given `?scope=state&state=Perak`, then the h1 reads "Negeri Perak", the sub "Ringkasan Eksekutif Seluruh Negeri" and the school table lists each school once (DV-M18-18).
- **AC-M18-31.3** Given `?scope=school&school_id=8880`, then the h1 reads the school name, "PPD KLUANG, Johor" "59 pelajar", kombo 6.4 · 13 · 14 · 0 and "Analisis Risiko Mengikut Subjek" "1/1 lemah (100%)" for BM, BI, MT.
- **AC-M18-31.4** Given I came from S18, when I press "Kembali", then I return to `/amaran/ppd`; opened directly, "Kembali" goes to the scope's Amaran page (DV-M18-21); "Cetak / PDF" calls the print dialog and the toolbar is hidden in print.

**US-M18-32 — Effectiveness**
- **AC-M18-32.1** Given the admin on S20, then "Kembali ke Dashboard PPD" → `/ppd/dashboard`, "Filter Sekolah:" lists "Semua sekolah (118)" + 118 schools, cards 2 "Jumlah Intervensi", "0%" "Kadar Berkesan" "0/0 dinilai", 0 "Perlu Tindakan" "0 sederhana, 0 tidak berkesan", 2 "Belum Dinilai".
- **AC-M18-32.2** Given S20, then the doughnut has data [0, 0, 0, 2] with the four labels and colours, the trend line "Intervensi" has labels "Apr 2026" … "Sep 2026" and data [2, 0, 0, 0, 0, 0].
- **AC-M18-32.3** Given S20, then "Intervensi Mengikut Jenis" lists "Sesi Kaunseling" "1 kali" and "Mentor Rakan Sebaya" "1 kali"; "Statistik Guru" one row 2 · 0 · 2 · "—"; "Perlu Tindakan Susulan" two rows "Sesi Kaunseling · 13 Apr 2026" and "Mentor Rakan Sebaya · 13 Apr 2026" "Belum Dinilai" → `/amaran/intervensi/3215`; "Perbandingan Sekolah Daerah" "1 sekolah ada intervensi" SMK TINGGI KLUANG 2 · 0 · 0 · 0 · 2 · "0%".
- **AC-M18-32.4** Given S20 at 375px, then the page does not scroll horizontally and wide tables scroll inside their cards (DV-M18-19); selecting a school in "Filter Sekolah:" reloads with `?school_id={id}`.
- **AC-M18-32.5** Given the admin on S21, then the header reads "Keberkesanan Intervensi" / "SEKOLAH KEBANGSAAN MERU RAYA", "Kembali ke Amaran" → `/amaran/sekolah/127`, cards 0 · "0%" "0/0 dinilai" · 0 · 0, "Tiada data intervensi lagi.", "Tiada data trend lagi." and "Belum Ada Intervensi" with "Lihat Senarai Risiko" → `/amaran/sekolah/127`.

**US-M18-33 — Amaran CSV**
- **AC-M18-33.1** Given `/amaran/kelas/1156`, when I press "Muat Turun CSV", then a CSV of the class risk list downloads (provisional columns; no IC, no e-mail).
- **AC-M18-33.2** Given S18, then "Muat Turun CSV" targets `/amaran/export/district/{key of PPD BATANG PADANG}` (not `/0`, DV-M18-17) and downloads the 33 pupils (provisional columns).
- **AC-M18-33.3** Given the PPD officer (provisional), when I request `/api/amaran/export/school/8880` (another district), then the API answers 403 and no file downloads.

**US-M18-34 — Intervention history**
- **AC-M18-34.1** Given the admin on `/amaran/intervensi/3215`, then the header reads "Log Intervensi" / "{nama pelajar}", tiles 2 "Jumlah Intervensi", 0 "Berkesan", 2 "Belum Dinilai".
- **AC-M18-34.2** Given the same page, then "Sejarah Intervensi" lists "Sesi Kaunseling" (`fa-comments`) "13 Apr 2026" and "Mentor Rakan Sebaya" (`fa-user-friends`) "13 Apr 2026", each with notes, an effectiveness select "Belum Dinilai", a pencil and a trash button.
- **AC-M18-34.3** Given I came from S20, when I press "Kembali", then I return to `/amaran/keberkesanan/ppd`; opened directly, it goes to `/amaran` (DV-M18-21).

**US-M18-35 — Record, evaluate, follow up, delete**
- **AC-M18-35.1** Given the log of pupil 3215, then the form shows "Jenis Intervensi" with 7 options ("Sesi Kaunseling" selected), "Tarikh" = today, "Kelas (Pilihan)" "— Tiada —" + only the pupil's classes (DV-M18-23), "Status" "Selesai"/"Dirancang", "Catatan / Apa Yang Dilakukan" with the live placeholder, "Tindakan Susulan (Pilihan)", "Simpan Intervensi".
- **AC-M18-35.2** Given an empty "Catatan", when I press "Simpan Intervensi", then the browser's required-field message blocks the submit; when I fill it and submit (provisional result), then a third record "Sesi Kaunseling" appears on top, "Jumlah Intervensi" reads 3 and S20 "Jumlah Intervensi" reads 3.
- **AC-M18-35.3** Given a record, when I choose "Berkesan" in its select, then it saves immediately (provisional), "Berkesan" reads 1, S20 "Kadar Berkesan" reads "100%" "1/1 dinilai".
- **AC-M18-35.4** Given a record, when I click the pencil, then "Tindakan susulan..." and "Simpan" appear; saving stores the follow-up (provisional); when I click the trash and cancel "Padam intervensi ini?", then the record stays; when I confirm, then it disappears (provisional).
- **AC-M18-35.5** Given the PPD officer of another district (provisional), when I post an intervention for pupil 3215, then the API answers 403.

**US-M18-36 — Officer item analysis**
- **AC-M18-36.1** Given the admin on S25, then the header h2 "PPD KLUANG" is white on the dark card (DV-M18-31), counters 118 · 135, cards 118 · 135 · "10,535" · "71.6%" "Ketepatan PPD".
- **AC-M18-36.2** Given S25, then "Perbandingan Sekolah" lists LAYANG-LAYANG "SMK" 6 · 222 · "83.8%", TINGGI KLUANG "SMK" 31 · 10,194 · "71.7%", KAMPONG CHAMEK "SK" 1 · 119 · "38.7%" linking `/analisa-item/sekolah/{id}`.
- **AC-M18-36.3** Given S25, then "20 soalan kritikal dijumpai" shows 5 cards; card 1 reads "Prinsip Pascal menyatakan bahawa:" "Sains" "Tekanan dalam bendalir" "Tekanan dalam bendalir" "Sukar" "100.0% salah" "2 pelajar" "1.5% terlibat" "2 cubaan" "Pelajar salah:" + 2 pupil chips → `/headcount/student/{id}`; "Lihat Semua (20 soalan)" shows 20 cards and "Sembunyikan".
- **AC-M18-36.4** Given the admin on S26, then the header reads "JPN Johor", cards 1,189 · 135 · 10,535 · "71.6%" "Ketepatan Negeri", "Perbandingan Daerah (PPD)" lists KLUANG 118 · 135 · 10,535 · "71.6%" first and the 10 others with 0 and "0.0%", and the critical card heading "Soalan Kritikal — Seluruh Negeri".

**US-M18-37 — School performance dashboard**
- **AC-M18-37.1** Given the admin on `/sekolah/8880/prestasi`, then "←" → `/prestasi/sekolah`, "🏫", h1 school name, "Dashboard Prestasi Sekolah · 9 kelas · 59 murid", cards 59 "Murid", 2 "Guru", 9 "Kelas", 3 "Subjek", 60 "Sesi Latihan", 675 "Soalan Dijawab", "72.4%" "Purata Ketepatan".
- **AC-M18-37.2** Given 8880, then "📊 GPS Anggaran" reads "2.49" "GPS" "Baik" "Berdasarkan 148 entri headcount"; "📈 Taburan Gred (Anggaran)" reads A+ 4 "2.7%" … G 0 "0%" and "Jumlah: 148 rekod"; "📚 GPS Mengikut Subjek" lists 6 rows starting "Bahasa Inggeris" 2.21 "A-" 28 · 13 · 15 · 0.
- **AC-M18-37.3** Given 8880, then "🎓 Perbandingan Tingkatan" shows "Tingkatan 4" "4 kelas" and "Tingkatan 5" "5 kelas" whose "murid" figures sum to at most 59 (school-scoped, DV-M18-32), linking `/prestasi/tingkatan/t4|t5`; the teacher cards' "murid" figures count only pupils of 8880; "🔬 Analisa Item" → `/sekolah/8880/analisa-item`.

**US-M18-38 — School item analysis**
- **AC-M18-38.1** Given the admin on `/sekolah/8880/analisa-item`, then the school card reads the name, "JEB2037", "SMK", "PPD KLUANG • Johor", 59 "Pelajar", "10,194" "Jawapan", cards 59 · "10,194" · "71.7%", "Profil Kesukaran" 0 / 0 / 20.
- **AC-M18-38.2** Given 8880, then "GPS Anggaran Sekolah" reads "2.49" "Baik" "Berdasarkan 148 entri headcount • Lebih rendah = lebih baik" (DV-M18-39) and "Prestasi 360" → `/sekolah/8880/prestasi`.
- **AC-M18-38.3** Given 8880, then "Prestasi Mengikut Subjek" lists Sains 29 · 1,094 · "70.9%" · 539, Sejarah 29 · 1,109 · "71.0%" · 615, Bahasa Inggeris 29 · 851 · "71.9%" · 539, Bahasa Melayu 30 · 507 · "72.0%" · 580, Matematik 31 · 817 · "72.4%" · 614; `?tingkatan=T4` shows "76.3%" and Sejarah 15 · 854 · "75.7%" · 312 first.
- **AC-M18-38.4** Given 8880, then the pills read "Semua (20)", "Bahasa Melayu (13)", "Sains (6)", "Sejarah (1)"; clicking "Sains (6)" shows 6 cards; opening card 1 shows "A" "Jawapan Betul" "Tekanan dalam cecair tertutup dipindahkan sama rata ke semua bahagian", "B" "Jawapan Salah Paling Popular (1x dipilih)" "Tekanan meningkat dengan kedalaman", "Pelajar Yang Salah" with 2 chips → `/prestasi/{userId}`; the card reads "2 pelajar cuba" "3.4% pelajar terlibat".
- **AC-M18-38.5** Given a school without pupils (e.g. 2695), when S30 loads, then "Tiada Data Pelajar" and its sentence show.
- **AC-M18-38.6** Given `/sekolah/8765/analisa-item`, then the subject table reads Matematik 6 · 60 · "77.3%" · 17, Bahasa Melayu 1 · 43 · "83.7%" · 7, Sejarah 1 · 52 · "84.6%" · 8, Pendidikan Islam 1 · 50 · "92.3%" · 4; pills "Semua (6)", "Matematik (4)", "Pendidikan Islam (2)"; "Profil Kesukaran" 5 / 0 / 1; card 1 `fa-frown` "Sukar" "84.6% salah" "6 pelajar cuba" "28.6% pelajar terlibat"; cards 2–6 `fa-smile` "Mudah" "0.0% salah" "1 pelajar cuba" "4.8% pelajar terlibat"; with `?tingkatan=T5` card 1 `fa-meh` "Sederhana" "50.0% salah" "2 pelajar cuba" "28.6%" and cards 2–6 "14.3%"; with `?tingkatan=T4` card 1 "42.9%", cards 2–6 "7.1%"; `/sekolah/2710/analisa-item` shows 119 answers, "38.7%", subject rows Sejarah 1 · 40 · "35.0%" · 26 and Bahasa Melayu 1 · 79 · "40.5%" · 47 and no card.
- **AC-M18-38.7** Given `/sekolah/2700/analisa-item`, then "Soalan Dijawab" 0, "Ketepatan Keseluruhan" "0.0%", "Profil Kesukaran" "Tiada data", no subject row and no card.

**US-M18-39 — District / state kombo**
- **AC-M18-39.1** Given the admin on S31, then the breadcrumb reads "Papan Pemuka" / "Kombo Harian PPD", h2 "Kombo Harian — PPD BATANG PADANG", tiles 33 · 0 · 29 · "6" · 15, and the table has 122 rows: HAMID KHAN 17 · 15 · 7 → `/kombo/sekolah/7780`, TOH TANDEWA SAKTI 16 · 14 · 4.9, SK PENDITA ZA'BA 0 · 0 · 0 …
- **AC-M18-39.2** Given S32, then the h2 reads "Kombo Harian — JPN Perak", the sub ends "seluruh negeri", the tiles equal S31 and the table has 1,102 rows.

**US-M18-40 — School kombo**
- **AC-M18-40.1** Given the admin on `/sekolah/8880/kombo`, then the tiles read 59 · 0 · "6.4" · 13 · 14 and "Perbandingan Kelas" lists "5 Sinar" "Fizik" 15 · "0.0" · 0 · 0, "4 Simulasi", "5 Simulasi", "5 Delima" "Sains".
- **AC-M18-40.2** Given `/kombo/sekolah/7780`, then the tiles read 17 · 0 · "7" · 15 · 15, "Perbandingan Kelas" starts "4 Bestari - BM" "Bahasa Melayu" 1 · "8.0" · 8 · 1, and "Top 10 Kombo Sekolah" starts 🥇 15 · 16, 🥈 14 · 23, 🥉 12 · 18 with names → `/prestasi/{userId}`.
- **AC-M18-40.3** Given the top-10 rows, then "Jumlah Hari" shows the stored counter: `/sekolah/2710/kombo` rows "1" "5" "13" and "1" "1" "4"; the 8880 and 7780 rows "0" (as live; DV-M18-41 rejected).
- **AC-M18-40.4** Given the calendar, then it shows 13 month labels, "Isn" "Rab" "Jum" "Ahd", "Kurang" … "Lebih" and "Warna menunjukkan bilangan soalan betul seluruh sekolah setiap hari".

**US-M18-41 — Responsive**
- **AC-M18-41.1** Given each of S1, S3–S33 at 375, 768 and 1280px, when it renders, then the page does not scroll horizontally (`scrollWidth ≤ clientWidth`), wide tables scroll inside their cards and KPI grids use the column counts of SRS §10.
- **AC-M18-41.2** Given S8 at 375px, then the card list replaces the table; at 768px the table shows and scrolls inside its card.
- **AC-M18-41.3** Given S11 at 375px, then the fixed 4-column layout renders without page scroll (as live), text ≥ 12px.

---

## 5. UI expectations

| Screen | Key states (screenshots in `docs/discovery/img/M18/`) | Behaviour notes (per-width detail in SRS §10) |
|---|---|---|
| S1 | default (`ppd-dashboard-desktop/-tablet/-mobile.png`), pager next | KPI cards 2 columns below `lg`, 3 at `lg`; every table scrolls in its card; pagers hidden at ≤ 20 rows. |
| S2 | 403 (`ppd-command-center-403.png`) | standalone 403 for the admin; officer page provisional (DV-M18-36). |
| S3 | empty 30 / 7 days / today (`ppd-statistik-desktop/-mobile.png`) | pills wrap at 375; filled layout PROPOSED. |
| S4, S13 | periods (`ppd-ranking-*.png`, `jpn-ranking-*.png`) | tables scroll in their cards at 375 / 768. |
| S5, S8 | all / subject 3 / bogus (`ppd-benchmark-*.png`, `ppd-leaderboard-*.png`, `ppd-leaderboard-tab-subjek.png`) | S8 card list below 640 px; 🥇 for place 1 (DV-M18-01). |
| S6 | default (`ppd-peta-haba-*.png`) | 888 px table scrolls in its card at 375 and 768 with the hint. |
| S7 | default (`ppd-export-*.png`) | stats 2 / 3 / 5 columns; preview table scrolls in its card. |
| S9, S15 | default, class open, grade T5, subject 3, school 8765, not found (`ppd-sekolah-*.png`, `jpn-sekolah-desktop.png`) | sticky section nav; accordions; IC masked (DV-M18-13). |
| S10 | default, district filter, search, empty search (`jpn-dashboard-*.png`) | numbered pagers; filter counter = distinct schools (DV-M18-14). |
| S11 | default (`jpn-command-center-desktop/-mobile.png`) | standalone dark page, same 4-column layout at every width; working panels (DV-M18-16). |
| S12, S14 | empty (`jpn-statistik-desktop.png`, `jpn-daerah-desktop.png`), not found | single empty card. |
| S16, S17 | class grid, class risk, 403 (`amaran-*.png`, `amaran-kelas-*.png`) | grid 1 / 2 / 3 columns; unknown class 404 (DV-M18-27). |
| S18, S19 | default (`amaran-ppd-*.png`, `amaran-jpn-desktop.png`) | 862 px tables scroll in their cards; each school once (DV-M18-18). |
| S20, S21 | default, school filter, empty (`amaran-keberkesanan-*.png`) | no page overflow at 375 (DV-M18-19). |
| S22, S28 | default, T4, T5 (`amaran-sekolah-desktop.png`, `sekolah-amaran-desktop.png`) | pills wrap; tables scroll in their cards. |
| S23 | district, state, school, no query (`amaran-ringkasan-*.png`) | print view; toolbar hidden in print; "Kembali" fixed (DV-M18-21). |
| S24 | default, follow-up open (`amaran-intervensi-*.png`) | tiles 3 columns at every width; form single column below `md`. |
| S25, S26 | default, show all (`analisa-item-ppd-*.png`, `analisa-item-jpn-desktop.png`) | h2 14 px at 375, white (DV-M18-31). |
| S27 | default (`sekolah-prestasi-*.png`) | stat cards 2 / 4 / 7 columns; header title fixed (DV-M18-24). |
| S29, S33 | default, 500 (`sekolah-kombo-*.png`, `kombo-sekolah-*.png`) | tiles 2 / 5 columns; calendar scrolls in its card; unknown id 404 (DV-M18-25). |
| S30 | default, T4, subject pill, question open, not found (`sekolah-analisa-item-*.png`) | school GPS (DV-M18-39); unknown id 404 (DV-M18-26). |
| S31, S32 | default (`kombo-ppd-*.png`, `kombo-jpn-desktop.png`) | h2 14 px at 375; long tables without pager (as live). |

Loading: every data view shows the shared shell loading behaviour while the mock responds (M01 convention; live pages are server-rendered). A mock failure uses the global error convention of M01; no M18-specific loading or error copy exists on live.

---

## 6. Coverage matrix (completeness proof)

Source: `docs/discovery/inventory/M18/` (generated 2026-09-26; 33 screens, 136 captured states). Generated by script (`matrix.cjs` from the Function catalogue `fns.cjs` and the inventory JSON, in the author's scratchpad `m18-writer/`; reproducible). Every M18 content element (S1–S33) is listed with the Function that covers it or with a concrete exclusion reason; each element maps to exactly one entry. The user-portal shell (SHU) is chrome owned by the global shell / M23; its M18-relevant elements are mapped and the rest excluded with a reason.

**Summary**

| Set | Elements | Mapped to an M18 Function | Excluded (with reason) | Unmapped |
|---|---|---|---|---|
| S1 — `/ppd/dashboard` | 232 | 229 | 3 | 0 |
| S2 — `/ppd/command-center` | 7 | 7 | 0 | 0 |
| S3 — `/ppd/statistik-penggunaan` | 24 | 21 | 3 | 0 |
| S4 — `/ppd/ranking-kebangsaan` | 30 | 27 | 3 | 0 |
| S5 — `/ppd/benchmark-sekolah` | 41 | 38 | 3 | 0 |
| S6 — `/ppd/peta-haba` | 26 | 23 | 3 | 0 |
| S7 — `/ppd/export-laporan` | 32 | 29 | 3 | 0 |
| S8 — `/ppd/leaderboard-sekolah` | 69 | 66 | 3 | 0 |
| S9 — `/ppd/sekolah/{id}` | 291 | 288 | 3 | 0 |
| S10 — `/jpn/dashboard` | 215 | 212 | 3 | 0 |
| S11 — `/jpn/command-center` | 44 | 44 | 0 | 0 |
| S12 — `/jpn/statistik-penggunaan` | 18 | 15 | 3 | 0 |
| S13 — `/jpn/ranking-kebangsaan` | 40 | 37 | 3 | 0 |
| S14 — `/jpn/daerah/{ppd}` | 24 | 21 | 3 | 0 |
| S15 — `/jpn/sekolah/{id}` | 229 | 226 | 3 | 0 |
| S16 — `/amaran` | 6 | 3 | 3 | 0 |
| S17 — `/amaran/kelas/{id}` | 46 | 43 | 3 | 0 |
| S18 — `/amaran/ppd` | 30 | 27 | 3 | 0 |
| S19 — `/amaran/jpn` | 40 | 37 | 3 | 0 |
| S20 — `/amaran/keberkesanan/ppd` | 51 | 48 | 3 | 0 |
| S21 — `/amaran/keberkesanan` | 28 | 25 | 3 | 0 |
| S22 — `/amaran/sekolah/{id}` | 30 | 27 | 3 | 0 |
| S23 — `/amaran/ringkasan-eksekutif` | 57 | 54 | 3 | 0 |
| S24 — `/amaran/intervensi/{studentId}` | 62 | 59 | 3 | 0 |
| S25 — `/analisa-item/ppd` | 111 | 108 | 3 | 0 |
| S26 — `/analisa-item/jpn` | 106 | 103 | 3 | 0 |
| S27 — `/sekolah/{id}/prestasi` | 96 | 93 | 3 | 0 |
| S28 — `/sekolah/{id}/amaran` | 39 | 36 | 3 | 0 |
| S29 — `/sekolah/{id}/kombo` | 44 | 41 | 3 | 0 |
| S30 — `/sekolah/{id}/analisa-item` | 93 | 90 | 3 | 0 |
| S31 — `/kombo/ppd` | 26 | 23 | 3 | 0 |
| S32 — `/kombo/jpn` | 26 | 23 | 3 | 0 |
| S33 — `/kombo/sekolah/{id}` | 51 | 48 | 3 | 0 |
| **M18 content (S1–S33)** | **2264** | **2171** | **93** (M16 tournament banner "LIVE:", "MAIN", "DAFTAR" on the 31 user-shell screens, EL-M18-S{n}-001–003) | **0** |
| User-portal shell SHU (chrome of S1, S3–S10, S12–S33) | 417 | 67 | 350 (global shell / M23, M14 chips, M22 bell and chatbot, entries of other modules) | 0 |

**2264/2264 M18 content elements covered (2171 mapped, 93 excluded with reason), 0 unmapped.** Including the shell: 2681/2681 elements accounted for (2238 mapped, 443 excluded with reason), 0 unmapped. 179 of the 203 Functions appear in this matrix; the other 24 are behaviour-only Functions (access and scope rules, the risk model, unobservable or PROPOSED states, data rules) with no element of their own.

### 6.1 M18 content elements

#### S1 — `/ppd/dashboard` (232 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M18-S1-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S1-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S1-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S1-004 | link | visible-default | "Papan Pemuka", → /ppd/dashboard, fa-arrow-left | FN-M18-2.1.1 |
| EL-M18-S1-005 | text | visible-default | "/" | FN-M18-2.1.1 |
| EL-M18-S1-006 | text | visible-default | "Dashboard PPD" | FN-M18-2.1.1 |
| EL-M18-S1-007 | card | visible-default | "PPD KLUANG" | FN-M18-2.1.1 |
| EL-M18-S1-008 | heading | visible-default | "PPD KLUANG" | FN-M18-2.1.1 |
| EL-M18-S1-009 | text | visible-default | "Johor" | FN-M18-2.1.1 |
| EL-M18-S1-010 | text | visible-default | "Dashboard Agregat Pejabat Pendidikan Daerah" | FN-M18-2.1.1 |
| EL-M18-S1-011 | text | visible-default | "118" | FN-M18-2.1.1 |
| EL-M18-S1-012 | text | visible-default | "Sekolah" | FN-M18-2.1.1 |
| EL-M18-S1-013 | text | visible-default | "135" | FN-M18-2.1.1 |
| EL-M18-S1-014 | text | visible-default | "Pelajar" | FN-M18-2.1.1 |
| EL-M18-S1-015 | card | visible-default | "Jumlah Sekolah" | FN-M18-2.1.2 |
| EL-M18-S1-016 | text | visible-default | "Jumlah Sekolah" | FN-M18-2.1.2 |
| EL-M18-S1-017 | text | visible-default | "118" | FN-M18-2.1.2 |
| EL-M18-S1-018 | text | visible-default | "Semua sekolah daftar di daerah (termasuk inactive)" | FN-M18-2.1.2 |
| EL-M18-S1-019 | card | visible-default | "Jumlah Pelajar" | FN-M18-2.1.2 |
| EL-M18-S1-020 | text | visible-default | "Jumlah Pelajar" | FN-M18-2.1.2 |
| EL-M18-S1-021 | text | visible-default | "135" | FN-M18-2.1.2 |
| EL-M18-S1-022 | text | visible-default | "Enrolmen pelajar (semua, termasuk belum aktif)" | FN-M18-2.1.2 |
| EL-M18-S1-023 | card | visible-default | "GPS Purata" | FN-M18-2.1.3 |
| EL-M18-S1-024 | text | visible-default | "GPS Purata" | FN-M18-2.1.3 |
| EL-M18-S1-025 | text | visible-default | "2.49" | FN-M18-2.1.3 |
| EL-M18-S1-026 | text | visible-default | "A-" | FN-M18-2.1.3 |
| EL-M18-S1-027 | text | visible-default | "Gred Purata Sekolah · Skala 1.00–9.00 (rendah=baik) · Hanya pelajar yang ada mar …" | FN-M18-2.1.3 |
| EL-M18-S1-028 | card | visible-default | "Pelajar Berisiko Merah" | FN-M18-2.1.4 |
| EL-M18-S1-029 | text | visible-default | "Pelajar Berisiko Merah" | FN-M18-2.1.4 |
| EL-M18-S1-030 | text | visible-default | "135" | FN-M18-2.1.4 |
| EL-M18-S1-031 | text | visible-default | "100% daripada 135 pelajar" | FN-M18-2.1.4 |
| EL-M18-S1-032 | text | visible-default | "Zon risiko gagal SPM (EWS) · perlu intervensi segera" | FN-M18-2.1.4 |
| EL-M18-S1-033 | text | visible-default | "⚠ Drp ini: akademik berisiko, belum mula latih" | FN-M18-2.1.4 |
| EL-M18-S1-034 | text | visible-default | "86" | FN-M18-2.1.4 |
| EL-M18-S1-035 | text | visible-default | "49" | FN-M18-2.1.4 |
| EL-M18-S1-036 | card | visible-default | "Ketepatan Keseluruhan" | FN-M18-2.1.5 |
| EL-M18-S1-037 | text | visible-default | "Ketepatan Keseluruhan" | FN-M18-2.1.5 |
| EL-M18-S1-038 | text | visible-default | "71.6%" | FN-M18-2.1.5 |
| EL-M18-S1-039 | text | visible-default | "% jawapan betul dari semua quiz pelajar (lifetime)" | FN-M18-2.1.5 |
| EL-M18-S1-040 | card | visible-default | "Kombo Aktif" | FN-M18-2.1.6 |
| EL-M18-S1-041 | text | visible-default | "Kombo Aktif" | FN-M18-2.1.6 |
| EL-M18-S1-042 | text | visible-default | "81" | FN-M18-2.1.6 |
| EL-M18-S1-043 | text | visible-default | "daripada 135 pelajar" | FN-M18-2.1.6 |
| EL-M18-S1-044 | text | visible-default | "Pelajar dgn streak latih tubi harian aktif (engagement)" | FN-M18-2.1.6 |
| EL-M18-S1-045 | card | visible-default | "Coverage Headcount" | FN-M18-2.1.7 |
| EL-M18-S1-046 | text | visible-default | "Coverage Headcount" | FN-M18-2.1.7 |
| EL-M18-S1-047 | text | visible-default | "64" | FN-M18-2.1.7 |
| EL-M18-S1-048 | text | visible-default | "(47.4%)" | FN-M18-2.1.7 |
| EL-M18-S1-049 | text | visible-default | "daripada 135 pelajar enrolled" | FN-M18-2.1.7 |
| EL-M18-S1-050 | text | visible-default | "Pelajar yang ada markah Headcount masuk · skop GPS calc" | FN-M18-2.1.7 |
| EL-M18-S1-051 | text | visible-default | "📊 Funnel: 65 dlm Headcount (48.1%) → 64 ada markah" | FN-M18-2.1.7 |
| EL-M18-S1-052 | card | visible-default | "Prestasi GPS — Perbandingan Sekolah" | FN-M18-2.1.8 |
| EL-M18-S1-053 | heading | visible-default | "Prestasi GPS — Perbandingan Sekolah" | FN-M18-2.1.8 |
| EL-M18-S1-054 | text | visible-default | "Kedudukan sekolah mengikut Gred Purata Sekolah (GPS) — lebih rendah lebih baik" | FN-M18-2.1.8 |
| EL-M18-S1-055 | input | visible-default | input, placeholder="Cari sekolah..." | FN-M18-2.1.8 |
| EL-M18-S1-056 | table | visible-default | table | FN-M18-2.1.8 |
| EL-M18-S1-057 | link | visible-default | "SEKOLAH MENENGAH KEBANGSAAN TINGGI KLUANG", → /sekolah/8880/prestasi, fa-external-link-alt | FN-M18-2.1.8 |
| EL-M18-S1-058 | link | visible-default | "SEKOLAH KEBANGSAAN (FELDA) ULU PENGGELI", → /sekolah/2695/prestasi, fa-external-link-alt | FN-M18-2.1.8 |
| EL-M18-S1-059 | link | visible-default | "SEKOLAH KEBANGSAAN SIMPANG RENGAM", → /sekolah/2696/prestasi, fa-external-link-alt | FN-M18-2.1.8 |
| EL-M18-S1-060 | text | visible-default | "– daripada" | FN-M18-1.3.4 |
| EL-M18-S1-061 | text | visible-default | "1" | FN-M18-1.3.4 |
| EL-M18-S1-062 | text | visible-default | "20" | FN-M18-1.3.4 |
| EL-M18-S1-063 | text | visible-default | "118" | FN-M18-1.3.4 |
| EL-M18-S1-064 | button | visible-default | button, fa-chevron-left | FN-M18-1.3.4 |
| EL-M18-S1-065 | text | visible-default | "1 / 6" | FN-M18-1.3.4 |
| EL-M18-S1-066 | button | visible-default | button, fa-chevron-right | FN-M18-1.3.4 |
| EL-M18-S1-067 | card | visible-default | "Amaran Awal — Taburan Risiko" | FN-M18-2.1.9 |
| EL-M18-S1-068 | heading | visible-default | "Amaran Awal — Taburan Risiko" | FN-M18-2.1.9 |
| EL-M18-S1-069 | text | visible-default | "Taburan risiko pelajar merentasi sekolah dalam daerah" | FN-M18-2.1.9 |
| EL-M18-S1-070 | text | visible-default | "0" | FN-M18-2.1.9 |
| EL-M18-S1-071 | text | visible-default | "On Track" | FN-M18-2.1.9 |
| EL-M18-S1-072 | text | visible-default | "0%" | FN-M18-2.1.9 |
| EL-M18-S1-073 | text | visible-default | "0" | FN-M18-2.1.9 |
| EL-M18-S1-074 | text | visible-default | "Perlu Perhatian" | FN-M18-2.1.9 |
| EL-M18-S1-075 | text | visible-default | "0%" | FN-M18-2.1.9 |
| EL-M18-S1-076 | text | visible-default | "135" | FN-M18-2.1.9 |
| EL-M18-S1-077 | text | visible-default | "Berisiko Tinggi" | FN-M18-2.1.9 |
| EL-M18-S1-078 | text | visible-default | "100%" | FN-M18-2.1.9 |
| EL-M18-S1-079 | text | visible-default | "Taburan Risiko Keseluruhan Daerah" | FN-M18-2.1.9 |
| EL-M18-S1-080 | text | visible-default | "100%" | FN-M18-2.1.9 |
| EL-M18-S1-081 | text | visible-default | "Hijau: 0" | FN-M18-2.1.9 |
| EL-M18-S1-082 | text | visible-default | "Kuning: 0" | FN-M18-2.1.9 |
| EL-M18-S1-083 | text | visible-default | "Merah: 135" | FN-M18-2.1.9 |
| EL-M18-S1-084 | input | visible-default | input, placeholder="Cari sekolah..." | FN-M18-2.1.10 |
| EL-M18-S1-085 | table | visible-default | table | FN-M18-2.1.10 |
| EL-M18-S1-086 | text | hidden-only | "– daripada" | FN-M18-1.3.4 |
| EL-M18-S1-087 | text | hidden-only | "1" | FN-M18-1.3.4 |
| EL-M18-S1-088 | text | hidden-only | "7" | FN-M18-1.3.4 |
| EL-M18-S1-089 | text | hidden-only | "7" | FN-M18-1.3.4 |
| EL-M18-S1-090 | button | hidden-only | button, fa-chevron-left | FN-M18-1.3.4 |
| EL-M18-S1-091 | text | hidden-only | "1 / 1" | FN-M18-1.3.4 |
| EL-M18-S1-092 | button | hidden-only | button, fa-chevron-right | FN-M18-1.3.4 |
| EL-M18-S1-093 | card | visible-default | "Analisa Item — Prestasi Mengikut Subjek" | FN-M18-2.1.11 |
| EL-M18-S1-094 | heading | visible-default | "Analisa Item — Prestasi Mengikut Subjek" | FN-M18-2.1.11 |
| EL-M18-S1-095 | text | visible-default | "Ketepatan jawapan merentasi semua subjek dalam daerah" | FN-M18-2.1.11 |
| EL-M18-S1-096 | text | visible-default | "Sejarah" | FN-M18-2.1.11 |
| EL-M18-S1-097 | text | visible-default | "70.7%" | FN-M18-2.1.11 |
| EL-M18-S1-098 | text | visible-default | "31 pelajar", fa-users | FN-M18-2.1.11 |
| EL-M18-S1-099 | text | visible-default | "1,154 soalan", fa-list-check | FN-M18-2.1.11 |
| EL-M18-S1-100 | text | visible-default | "649 salah", fa-times-circle | FN-M18-2.1.11 |
| EL-M18-S1-101 | text | visible-default | "Sains" | FN-M18-2.1.11 |
| EL-M18-S1-102 | text | visible-default | "70.9%" | FN-M18-2.1.11 |
| EL-M18-S1-103 | text | visible-default | "29 pelajar", fa-users | FN-M18-2.1.11 |
| EL-M18-S1-104 | text | visible-default | "1,094 soalan", fa-list-check | FN-M18-2.1.11 |
| EL-M18-S1-105 | text | visible-default | "539 salah", fa-times-circle | FN-M18-2.1.11 |
| EL-M18-S1-106 | text | visible-default | "Bahasa Melayu" | FN-M18-2.1.11 |
| EL-M18-S1-107 | text | visible-default | "71.1%" | FN-M18-2.1.11 |
| EL-M18-S1-108 | text | visible-default | "32 pelajar", fa-users | FN-M18-2.1.11 |
| EL-M18-S1-109 | text | visible-default | "545 soalan", fa-list-check | FN-M18-2.1.11 |
| EL-M18-S1-110 | text | visible-default | "634 salah", fa-times-circle | FN-M18-2.1.11 |
| EL-M18-S1-111 | text | visible-default | "Bahasa Inggeris" | FN-M18-2.1.11 |
| EL-M18-S1-112 | text | visible-default | "71.9%" | FN-M18-2.1.11 |
| EL-M18-S1-113 | text | visible-default | "29 pelajar", fa-users | FN-M18-2.1.11 |
| EL-M18-S1-114 | text | visible-default | "851 soalan", fa-list-check | FN-M18-2.1.11 |
| EL-M18-S1-115 | text | visible-default | "539 salah", fa-times-circle | FN-M18-2.1.11 |
| EL-M18-S1-116 | text | visible-default | "Matematik" | FN-M18-2.1.11 |
| EL-M18-S1-117 | text | visible-default | "72.6%" | FN-M18-2.1.11 |
| EL-M18-S1-118 | text | visible-default | "37 pelajar", fa-users | FN-M18-2.1.11 |
| EL-M18-S1-119 | text | visible-default | "828 soalan", fa-list-check | FN-M18-2.1.11 |
| EL-M18-S1-120 | text | visible-default | "631 salah", fa-times-circle | FN-M18-2.1.11 |
| EL-M18-S1-121 | text | visible-default | "Pendidikan Islam" | FN-M18-2.1.11 |
| EL-M18-S1-122 | text | visible-default | "92.3%" | FN-M18-2.1.11 |
| EL-M18-S1-123 | text | visible-default | "1 pelajar", fa-users | FN-M18-2.1.11 |
| EL-M18-S1-124 | text | visible-default | "50 soalan", fa-list-check | FN-M18-2.1.11 |
| EL-M18-S1-125 | text | visible-default | "4 salah", fa-times-circle | FN-M18-2.1.11 |
| EL-M18-S1-126 | card | visible-default | "Kombo Latihan — Gambaran Daerah" | FN-M18-2.1.12 |
| EL-M18-S1-127 | heading | visible-default | "Kombo Latihan — Gambaran Daerah" | FN-M18-2.1.12 |
| EL-M18-S1-128 | text | visible-default | "Penglibatan harian pelajar merentasi sekolah dalam daerah" | FN-M18-2.1.12 |
| EL-M18-S1-129 | text | visible-default | "81" | FN-M18-2.1.12 |
| EL-M18-S1-130 | text | visible-default | "Kombo Aktif" | FN-M18-2.1.12 |
| EL-M18-S1-131 | text | visible-default | "135" | FN-M18-2.1.12 |
| EL-M18-S1-132 | text | visible-default | "Jumlah Pelajar" | FN-M18-2.1.12 |
| EL-M18-S1-133 | text | visible-default | "7.2" | FN-M18-2.1.12 |
| EL-M18-S1-134 | text | visible-default | "Purata Kombo" | FN-M18-2.1.12 |
| EL-M18-S1-135 | text | visible-default | "0" | FN-M18-2.1.12 |
| EL-M18-S1-136 | text | visible-default | "Berlatih Hari Ini" | FN-M18-2.1.12 |
| EL-M18-S1-137 | input | visible-default | input, placeholder="Cari sekolah..." | FN-M18-2.1.13 |
| EL-M18-S1-138 | table | visible-default | table | FN-M18-2.1.13 |
| EL-M18-S1-139 | text | visible-default | "– daripada" | FN-M18-1.3.4 |
| EL-M18-S1-140 | text | visible-default | "1" | FN-M18-1.3.4 |
| EL-M18-S1-141 | text | visible-default | "20" | FN-M18-1.3.4 |
| EL-M18-S1-142 | text | visible-default | "118" | FN-M18-1.3.4 |
| EL-M18-S1-143 | button | visible-default | button, fa-chevron-left | FN-M18-1.3.4 |
| EL-M18-S1-144 | text | visible-default | "1 / 6" | FN-M18-1.3.4 |
| EL-M18-S1-145 | button | visible-default | button, fa-chevron-right | FN-M18-1.3.4 |
| EL-M18-S1-146 | card | visible-default | "Tahap Penguasaan — Taburan Daerah" | FN-M18-2.1.14 |
| EL-M18-S1-147 | heading | visible-default | "Tahap Penguasaan — Taburan Daerah" | FN-M18-2.1.14 |
| EL-M18-S1-148 | text | visible-default | "Taburan tahap penguasaan pelajar merentasi daerah" | FN-M18-2.1.14 |
| EL-M18-S1-149 | text | visible-default | "📊 daripada (1 pelajar boleh ada catatan untuk pelbagai subjek)" | FN-M18-2.1.14 |
| EL-M18-S1-150 | text | visible-default | "38 catatan penguasaan" | FN-M18-2.1.14 |
| EL-M18-S1-151 | text | visible-default | "12 pelajar unik" | FN-M18-2.1.14 |
| EL-M18-S1-152 | text | visible-default | "Pemula" | FN-M18-2.1.14 |
| EL-M18-S1-153 | text | visible-default | "14" | FN-M18-2.1.14 |
| EL-M18-S1-154 | text | visible-default | "catatan" | FN-M18-2.1.14 |
| EL-M18-S1-155 | text | visible-default | "(36.8%)" | FN-M18-2.1.14 |
| EL-M18-S1-156 | text | visible-default | "Mula Belajar" | FN-M18-2.1.14 |
| EL-M18-S1-157 | text | visible-default | "20" | FN-M18-2.1.14 |
| EL-M18-S1-158 | text | visible-default | "catatan" | FN-M18-2.1.14 |
| EL-M18-S1-159 | text | visible-default | "(52.6%)" | FN-M18-2.1.14 |
| EL-M18-S1-160 | text | visible-default | "Aktif" | FN-M18-2.1.14 |
| EL-M18-S1-161 | text | visible-default | "4" | FN-M18-2.1.14 |
| EL-M18-S1-162 | text | visible-default | "catatan" | FN-M18-2.1.14 |
| EL-M18-S1-163 | text | visible-default | "(10.5%)" | FN-M18-2.1.14 |
| EL-M18-S1-164 | text | visible-default | "Tekun" | FN-M18-2.1.14 |
| EL-M18-S1-165 | text | visible-default | "0" | FN-M18-2.1.14 |
| EL-M18-S1-166 | text | visible-default | "catatan" | FN-M18-2.1.14 |
| EL-M18-S1-167 | text | visible-default | "(0%)" | FN-M18-2.1.14 |
| EL-M18-S1-168 | text | visible-default | "Mahir" | FN-M18-2.1.14 |
| EL-M18-S1-169 | text | visible-default | "0" | FN-M18-2.1.14 |
| EL-M18-S1-170 | text | visible-default | "catatan" | FN-M18-2.1.14 |
| EL-M18-S1-171 | text | visible-default | "(0%)" | FN-M18-2.1.14 |
| EL-M18-S1-172 | text | visible-default | "Pakar Muda" | FN-M18-2.1.14 |
| EL-M18-S1-173 | text | visible-default | "0" | FN-M18-2.1.14 |
| EL-M18-S1-174 | text | visible-default | "catatan" | FN-M18-2.1.14 |
| EL-M18-S1-175 | text | visible-default | "(0%)" | FN-M18-2.1.14 |
| EL-M18-S1-176 | text | visible-default | "Cemerlang" | FN-M18-2.1.14 |
| EL-M18-S1-177 | text | visible-default | "0" | FN-M18-2.1.14 |
| EL-M18-S1-178 | text | visible-default | "catatan" | FN-M18-2.1.14 |
| EL-M18-S1-179 | text | visible-default | "(0%)" | FN-M18-2.1.14 |
| EL-M18-S1-180 | text | visible-default | "Master" | FN-M18-2.1.14 |
| EL-M18-S1-181 | text | visible-default | "0" | FN-M18-2.1.14 |
| EL-M18-S1-182 | text | visible-default | "catatan" | FN-M18-2.1.14 |
| EL-M18-S1-183 | text | visible-default | "(0%)" | FN-M18-2.1.14 |
| EL-M18-S1-184 | text | visible-default | "Grandmaster" | FN-M18-2.1.14 |
| EL-M18-S1-185 | text | visible-default | "0" | FN-M18-2.1.14 |
| EL-M18-S1-186 | text | visible-default | "catatan" | FN-M18-2.1.14 |
| EL-M18-S1-187 | text | visible-default | "(0%)" | FN-M18-2.1.14 |
| EL-M18-S1-188 | text | visible-default | "Legend" | FN-M18-2.1.14 |
| EL-M18-S1-189 | text | visible-default | "0" | FN-M18-2.1.14 |
| EL-M18-S1-190 | text | visible-default | "catatan" | FN-M18-2.1.14 |
| EL-M18-S1-191 | text | visible-default | "(0%)" | FN-M18-2.1.14 |
| EL-M18-S1-192 | text | visible-default | "Mythical" | FN-M18-2.1.14 |
| EL-M18-S1-193 | text | visible-default | "0" | FN-M18-2.1.14 |
| EL-M18-S1-194 | text | visible-default | "catatan" | FN-M18-2.1.14 |
| EL-M18-S1-195 | text | visible-default | "(0%)" | FN-M18-2.1.14 |
| EL-M18-S1-196 | input | visible-default | input, placeholder="Cari sekolah..." | FN-M18-2.1.15 |
| EL-M18-S1-197 | table | visible-default | table | FN-M18-2.1.15 |
| EL-M18-S1-198 | text | visible-default | "– daripada" | FN-M18-1.3.4 |
| EL-M18-S1-199 | text | visible-default | "1" | FN-M18-1.3.4 |
| EL-M18-S1-200 | text | visible-default | "20" | FN-M18-1.3.4 |
| EL-M18-S1-201 | text | visible-default | "118" | FN-M18-1.3.4 |
| EL-M18-S1-202 | button | visible-default | button, fa-chevron-left | FN-M18-1.3.4 |
| EL-M18-S1-203 | text | visible-default | "1 / 6" | FN-M18-1.3.4 |
| EL-M18-S1-204 | button | visible-default | button, fa-chevron-right | FN-M18-1.3.4 |
| EL-M18-S1-205 | card | visible-default | "Pembetulan — Gambaran Daerah" | FN-M18-2.1.16 |
| EL-M18-S1-206 | heading | visible-default | "Pembetulan — Gambaran Daerah" | FN-M18-2.1.16 |
| EL-M18-S1-207 | text | visible-default | "Kadar pembetulan pelajar untuk September 2026" | FN-M18-2.1.16 |
| EL-M18-S1-208 | empty-state | visible-default | "Tiada data pembetulan untuk bulan ini (2026-09)", fa-triangle-exclamation | FN-M18-2.1.16 |
| EL-M18-S1-209 | text | visible-default | "Data agregat dijana oleh `php artisan correction:backfill`. Jika konsisten koson …" | FN-M18-2.1.17 |
| EL-M18-S1-210 | text | visible-default | "135" | FN-M18-2.1.16 |
| EL-M18-S1-211 | text | visible-default | "Jumlah Pelajar" | FN-M18-2.1.16 |
| EL-M18-S1-212 | text | visible-default | "0" | FN-M18-2.1.16 |
| EL-M18-S1-213 | text | visible-default | "Jumlah Pembetulan" | FN-M18-2.1.16 |
| EL-M18-S1-214 | text | visible-default | "0.0%" | FN-M18-2.1.16 |
| EL-M18-S1-215 | text | visible-default | "Kadar Purata" | FN-M18-2.1.16 |
| EL-M18-S1-216 | input | visible-default | input, placeholder="Cari sekolah..." | FN-M18-2.1.18 |
| EL-M18-S1-217 | table | visible-default | table | FN-M18-2.1.18 |
| EL-M18-S1-218 | text | visible-default | "– daripada" | FN-M18-1.3.4 |
| EL-M18-S1-219 | text | visible-default | "1" | FN-M18-1.3.4 |
| EL-M18-S1-220 | text | visible-default | "20" | FN-M18-1.3.4 |
| EL-M18-S1-221 | text | visible-default | "118" | FN-M18-1.3.4 |
| EL-M18-S1-222 | button | visible-default | button, fa-chevron-left | FN-M18-1.3.4 |
| EL-M18-S1-223 | text | visible-default | "1 / 6" | FN-M18-1.3.4 |
| EL-M18-S1-224 | button | visible-default | button, fa-chevron-right | FN-M18-1.3.4 |
| EL-M18-S1-225 | card | visible-default | "Laporan Terperinci" | FN-M18-2.1.19 |
| EL-M18-S1-226 | heading | visible-default | "Laporan Terperinci" | FN-M18-2.1.19 |
| EL-M18-S1-227 | text | visible-default | "Akses laporan mendalam untuk setiap modul" | FN-M18-2.1.19 |
| EL-M18-S1-228 | link | visible-default | "Statistik Penggunaan", → /ppd/statistik-penggunaan, fa-chart-pie | FN-M18-2.1.19 |
| EL-M18-S1-229 | link | visible-default | "Amaran Awal PPD", → /amaran/ppd, fa-bell | FN-M18-2.1.19 |
| EL-M18-S1-230 | link | visible-default | "Analisa Item PPD", → /analisa-item/ppd, fa-chart-bar | FN-M18-2.1.19 |
| EL-M18-S1-231 | link | visible-default | "Keberkesanan Intervensi", → /amaran/keberkesanan/ppd, fa-chart-pie | FN-M18-2.1.19 |
| EL-M18-S1-232 | link | visible-default | "Papan Pemuka", → /ppd/dashboard, fa-house | FN-M18-2.1.19 |

#### S2 — `/ppd/command-center` (7 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M18-S2-001 | text | visible-default | "403" | FN-M18-1.2.6 |
| EL-M18-S2-002 | text | visible-default | "🚫" | FN-M18-1.2.6 |
| EL-M18-S2-003 | heading | visible-default | "Akses Ditolak" | FN-M18-1.2.6 |
| EL-M18-S2-004 | text | visible-default | "Anda tidak mempunyai kebenaran untuk mengakses halaman ini. Sila log masuk denga …" | FN-M18-1.2.6 |
| EL-M18-S2-005 | link | visible-default | "Halaman Utama", → / | FN-M18-1.2.6 |
| EL-M18-S2-006 | link | visible-default | "Log Masuk", → /login | FN-M18-1.2.6 |
| EL-M18-S2-007 | text | visible-default | "PRESTASIPLUS" | FN-M18-1.2.6 |

#### S3 — `/ppd/statistik-penggunaan` (24 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M18-S3-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S3-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S3-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S3-004 | link | visible-default | "Dashboard PPD", → /ppd/dashboard, fa-arrow-left | FN-M18-2.3.1 |
| EL-M18-S3-005 | text | visible-default | "/" | FN-M18-2.3.1 |
| EL-M18-S3-006 | text | visible-default | "Statistik Penggunaan" | FN-M18-2.3.1 |
| EL-M18-S3-007 | card | visible-default | "PPD KLUANG" | FN-M18-2.3.1 |
| EL-M18-S3-008 | heading | visible-default | "PPD KLUANG" | FN-M18-2.3.1 |
| EL-M18-S3-009 | text | visible-default | "Johor" | FN-M18-2.3.1 |
| EL-M18-S3-010 | text | visible-default | "Statistik Penggunaan PRESTASIPLUS Dalam Daerah" | FN-M18-2.3.1 |
| EL-M18-S3-011 | text | visible-default | "0" | FN-M18-2.3.1 |
| EL-M18-S3-012 | text | visible-default | "Sekolah" | FN-M18-2.3.1 |
| EL-M18-S3-013 | text | visible-default | "0" | FN-M18-2.3.1 |
| EL-M18-S3-014 | text | visible-default | "Pelajar Aktif" | FN-M18-2.3.1 |
| EL-M18-S3-015 | link | visible-default | "Hari Ini", → /ppd/statistik-penggunaan?period=today, fa-calendar-day | FN-M18-1.3.2 |
| EL-M18-S3-016 | link | visible-default | "7 Hari", → /ppd/statistik-penggunaan?period=7days, fa-calendar-week | FN-M18-1.3.2 |
| EL-M18-S3-017 | link | visible-default | "30 Hari", → /ppd/statistik-penggunaan?period=30days, fa-calendar | FN-M18-1.3.2 |
| EL-M18-S3-018 | card | visible-default | "Tiada data untuk tempoh ini" | FN-M18-2.3.2 |
| EL-M18-S3-019 | empty-state | visible-default | "Tiada data untuk tempoh ini" | FN-M18-2.3.2 |
| EL-M18-S3-020 | empty-state | visible-default | "Tiada aktiviti latihan dalam tempoh 30 Hari yang lepas." | FN-M18-2.3.2 |
| EL-M18-S3-021 | empty-state | conditional | "Tiada aktiviti latihan dalam tempoh 7 Hari yang lepas." | FN-M18-2.3.2 |
| EL-M18-S3-022 | text | conditional | "Belum ada pelajar buat latihan hari ini. Cuba lihat atau ." | FN-M18-2.3.2 |
| EL-M18-S3-023 | link | conditional | "7 Hari", → /ppd/statistik-penggunaan?period=7days | FN-M18-2.3.2 |
| EL-M18-S3-024 | link | conditional | "30 Hari", → /ppd/statistik-penggunaan?period=30days | FN-M18-2.3.2 |

#### S4 — `/ppd/ranking-kebangsaan` (30 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M18-S4-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S4-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S4-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S4-004 | link | visible-default | "Dashboard PPD", → /ppd/dashboard, fa-arrow-left | FN-M18-2.4.1 |
| EL-M18-S4-005 | text | visible-default | "/" | FN-M18-2.4.1 |
| EL-M18-S4-006 | text | visible-default | "Ranking Kebangsaan" | FN-M18-2.4.1 |
| EL-M18-S4-007 | card | visible-default | "Ranking Sekolah 1 Malaysia" | FN-M18-2.4.1 |
| EL-M18-S4-008 | heading | visible-default | "Ranking Sekolah 1 Malaysia" | FN-M18-2.4.1 |
| EL-M18-S4-009 | text | visible-default | "Top 50 sekolah paling aktif merentas seluruh Malaysia · 30 Hari" | FN-M18-2.4.1 |
| EL-M18-S4-010 | link | visible-default | "Hari Ini", → /ppd/ranking-kebangsaan?period=today, fa-calendar-day | FN-M18-1.3.2 |
| EL-M18-S4-011 | link | visible-default | "7 Hari", → /ppd/ranking-kebangsaan?period=7days, fa-calendar-week | FN-M18-1.3.2 |
| EL-M18-S4-012 | link | visible-default | "30 Hari", → /ppd/ranking-kebangsaan?period=30days, fa-calendar | FN-M18-1.3.2 |
| EL-M18-S4-013 | card | visible-default | "Top 50 Sekolah — 1 Malaysia" | FN-M18-2.4.2 |
| EL-M18-S4-014 | heading | visible-default | "Top 50 Sekolah — 1 Malaysia" | FN-M18-2.4.2 |
| EL-M18-S4-015 | text | visible-default | "Berdasarkan jumlah jawapan betul · 30 Hari" | FN-M18-2.4.2 |
| EL-M18-S4-016 | table | visible-default | table | FN-M18-2.4.2 |
| EL-M18-S4-017 | link | visible-default | "SEKOLAH MENENGAH KEBANGSAAN ENGKU HUSAIN", → /ppd/sekolah/8082 | FN-M18-2.4.2 |
| EL-M18-S4-018 | badge | visible-default | "90.8%" | FN-M18-2.4.2 |
| EL-M18-S4-019 | link | visible-default | "SEKOLAH MENENGAH KEBANGSAAN BANDAR RINCHING", → /ppd/sekolah/8106 | FN-M18-2.4.2 |
| EL-M18-S4-020 | badge | visible-default | "82.3%" | FN-M18-2.4.2 |
| EL-M18-S4-021 | link | visible-default | "SEKOLAH MENENGAH KEBANGSAAN KHIR JOHARI", → /ppd/sekolah/8080 | FN-M18-2.4.2 |
| EL-M18-S4-022 | badge | visible-default | "86.9%" | FN-M18-2.4.2 |
| EL-M18-S4-023 | text | conditional | "Top 50 sekolah paling aktif merentas seluruh Malaysia · 7 Hari" | FN-M18-2.4.3 |
| EL-M18-S4-024 | text | conditional | "Berdasarkan jumlah jawapan betul · 7 Hari" | FN-M18-2.4.3 |
| EL-M18-S4-025 | badge | conditional | "86.2%" | FN-M18-2.4.3 |
| EL-M18-S4-026 | badge | conditional | "79.6%" | FN-M18-2.4.3 |
| EL-M18-S4-027 | badge | conditional | "86.3%" | FN-M18-2.4.3 |
| EL-M18-S4-028 | text | conditional | "Top 50 sekolah paling aktif merentas seluruh Malaysia · Hari Ini" | FN-M18-2.4.3 |
| EL-M18-S4-029 | text | conditional | "Berdasarkan jumlah jawapan betul · Hari Ini" | FN-M18-2.4.3 |
| EL-M18-S4-030 | badge | conditional | "95.0%" | FN-M18-2.4.3 |

#### S5 — `/ppd/benchmark-sekolah` (41 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M18-S5-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S5-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S5-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S5-004 | link | visible-default | "Dashboard PPD", → /ppd/dashboard, fa-arrow-left | FN-M18-2.5.1 |
| EL-M18-S5-005 | text | visible-default | "/" | FN-M18-2.5.1 |
| EL-M18-S5-006 | text | visible-default | "Benchmark Sekolah" | FN-M18-2.5.1 |
| EL-M18-S5-007 | card | visible-default | "PPD KLUANG" | FN-M18-2.5.1 |
| EL-M18-S5-008 | heading | visible-default | "PPD KLUANG" | FN-M18-2.5.1 |
| EL-M18-S5-009 | text | visible-default | "Johor" | FN-M18-2.5.1 |
| EL-M18-S5-010 | text | visible-default | "Perbandingan prestasi semua sekolah dalam daerah" | FN-M18-2.5.1 |
| EL-M18-S5-011 | text | visible-default | "116" | FN-M18-2.5.1 |
| EL-M18-S5-012 | text | visible-default | "Sekolah" | FN-M18-2.5.1 |
| EL-M18-S5-013 | text | visible-default | "0.6%" | FN-M18-2.5.2 |
| EL-M18-S5-014 | text | visible-default | "Purata Ketepatan" | FN-M18-2.5.2 |
| EL-M18-S5-015 | text | visible-default | "0%" | FN-M18-2.5.2 |
| EL-M18-S5-016 | text | visible-default | "Purata Aktif" | FN-M18-2.5.2 |
| EL-M18-S5-017 | card | visible-default | "Tapis Mata Pelajaran" | FN-M18-2.5.3 |
| EL-M18-S5-018 | form | visible-default | form | FN-M18-2.5.3 |
| EL-M18-S5-019 | label | visible-default | "Tapis Mata Pelajaran" | FN-M18-2.5.3 |
| EL-M18-S5-020 | select | visible-default | select, name=subject_id, 32 options | FN-M18-2.5.3 |
| EL-M18-S5-021 | button | visible-default | "Tapis", fa-filter | FN-M18-2.5.3 |
| EL-M18-S5-022 | text | visible-default | "Skor Komposit = (% Aktif × 0.4) + (Purata Ketepatan × 0.3) + (Soalan/Pelajar × 0 …" | FN-M18-2.5.4 |
| EL-M18-S5-023 | card | visible-default | "Kedudukan Sekolah" | FN-M18-2.5.5 |
| EL-M18-S5-024 | heading | visible-default | "Kedudukan Sekolah" | FN-M18-2.5.5 |
| EL-M18-S5-025 | link | visible-default | "Eksport CSV", → /ppd/benchmark-sekolah?, fa-download | FN-M18-2.5.6 |
| EL-M18-S5-026 | table | visible-default | table | FN-M18-2.5.5 |
| EL-M18-S5-027 | link | visible-default | "SEKOLAH MENENGAH KEBANGSAAN LAYANG-LAYANG", → /ppd/sekolah/8765 | FN-M18-2.5.5 |
| EL-M18-S5-028 | badge | visible-default | "73.1%" | FN-M18-2.5.5 |
| EL-M18-S5-029 | link | visible-default | "KOLEJ VOKASIONAL KLUANG", → /ppd/sekolah/8953 | FN-M18-2.5.5 |
| EL-M18-S5-030 | link | visible-default | "SEKOLAH JENIS KEBANGSAAN (CINA) CHIAN BEE", → /ppd/sekolah/3156 | FN-M18-2.5.5 |
| EL-M18-S5-031 | text | visible-default | "Tempat 1 — Emas" | FN-M18-1.3.3 |
| EL-M18-S5-032 | text | visible-default | "Tempat 2 — Perak" | FN-M18-1.3.3 |
| EL-M18-S5-033 | text | visible-default | "Tempat 3 — Gangsa" | FN-M18-1.3.3 |
| EL-M18-S5-034 | text | conditional | "0.7%" | FN-M18-2.5.2 |
| EL-M18-S5-035 | link | conditional | "Kosongkan", → /ppd/benchmark-sekolah, fa-times | FN-M18-2.5.3 |
| EL-M18-S5-036 | card | conditional | "Kedudukan Sekolah — Matematik" | FN-M18-2.5.5 |
| EL-M18-S5-037 | heading | conditional | "Kedudukan Sekolah — Matematik" | FN-M18-2.5.5 |
| EL-M18-S5-038 | link | conditional | "Eksport CSV", → /ppd/benchmark-sekolah?subject_id=3, fa-download | FN-M18-2.5.6 |
| EL-M18-S5-039 | badge | conditional | "76.3%" | FN-M18-2.5.5 |
| EL-M18-S5-040 | text | conditional | "0%" | FN-M18-2.5.2 |
| EL-M18-S5-041 | link | conditional | "Eksport CSV", → /ppd/benchmark-sekolah?subject_id=99999, fa-download | FN-M18-2.5.6 |

#### S6 — `/ppd/peta-haba` (26 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M18-S6-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S6-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S6-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S6-004 | link | visible-default | "Dashboard PPD", → /ppd/dashboard, fa-arrow-left | FN-M18-2.6.1 |
| EL-M18-S6-005 | text | visible-default | "/" | FN-M18-2.6.1 |
| EL-M18-S6-006 | text | visible-default | "Peta Haba" | FN-M18-2.6.1 |
| EL-M18-S6-007 | card | visible-default | "Peta Haba Prestasi Daerah — PPD KLUANG" | FN-M18-2.6.1 |
| EL-M18-S6-008 | heading | visible-default | "Peta Haba Prestasi Daerah — PPD KLUANG" | FN-M18-2.6.1 |
| EL-M18-S6-009 | text | visible-default | "Prestasi rata-rata ketepatan pelajar mengikut sekolah dan mata pelajaran teras · …" | FN-M18-2.6.1 |
| EL-M18-S6-010 | card | visible-default | "Petunjuk Warna:" | FN-M18-2.6.2 |
| EL-M18-S6-011 | text | visible-default | "Petunjuk Warna:" | FN-M18-2.6.2 |
| EL-M18-S6-012 | text | visible-default | "Cemerlang" | FN-M18-2.6.2 |
| EL-M18-S6-013 | text | visible-default | "> 70%" | FN-M18-2.6.2 |
| EL-M18-S6-014 | text | visible-default | "Sederhana" | FN-M18-2.6.2 |
| EL-M18-S6-015 | text | visible-default | "41–70%" | FN-M18-2.6.2 |
| EL-M18-S6-016 | text | visible-default | "Lemah" | FN-M18-2.6.2 |
| EL-M18-S6-017 | text | visible-default | "≤ 40%" | FN-M18-2.6.2 |
| EL-M18-S6-018 | empty-state | visible-default | "Tiada Data" | FN-M18-2.6.2 |
| EL-M18-S6-019 | card | visible-default | "Prestasi Ketepatan (%) — Mata Pelajaran Teras × Sekolah" | FN-M18-2.6.3 |
| EL-M18-S6-020 | heading | visible-default | "Prestasi Ketepatan (%) — Mata Pelajaran Teras × Sekolah" | FN-M18-2.6.3 |
| EL-M18-S6-021 | text | visible-default | "Skrol ke kanan untuk melihat semua subjek pada skrin kecil." | FN-M18-2.6.3 |
| EL-M18-S6-022 | table | visible-default | table | FN-M18-2.6.3 |
| EL-M18-S6-023 | link | visible-default | "KOLEJ VOKASIONAL KLUANG", → /ppd/sekolah/8953 | FN-M18-2.6.3 |
| EL-M18-S6-024 | link | visible-default | "SEKOLAH JENIS KEBANGSAAN (CINA) CHIAN BEE", → /ppd/sekolah/3156 | FN-M18-2.6.3 |
| EL-M18-S6-025 | link | visible-default | "SEKOLAH JENIS KEBANGSAAN (CINA) CHIAU MIN", → /ppd/sekolah/3157 | FN-M18-2.6.3 |
| EL-M18-S6-026 | text | visible-default | "Sel merah menunjukkan purata ketepatan ≤ 40% — sekolah dan mata pelajaran berken …" | FN-M18-2.6.3 |

#### S7 — `/ppd/export-laporan` (32 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M18-S7-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S7-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S7-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S7-004 | link | visible-default | "Dashboard PPD", → /ppd/dashboard, fa-arrow-left | FN-M18-2.7.1 |
| EL-M18-S7-005 | text | visible-default | "/" | FN-M18-2.7.1 |
| EL-M18-S7-006 | text | visible-default | "Eksport Laporan" | FN-M18-2.7.1 |
| EL-M18-S7-007 | card | visible-default | "PPD KLUANG" | FN-M18-2.7.1 |
| EL-M18-S7-008 | heading | visible-default | "PPD KLUANG" | FN-M18-2.7.1 |
| EL-M18-S7-009 | text | visible-default | "Eksport data prestasi semua sekolah dalam daerah ke CSV" | FN-M18-2.7.1 |
| EL-M18-S7-010 | text | visible-default | "116" | FN-M18-2.7.1 |
| EL-M18-S7-011 | text | visible-default | "Jumlah Sekolah" | FN-M18-2.7.1 |
| EL-M18-S7-012 | text | visible-default | "72" | FN-M18-2.7.1 |
| EL-M18-S7-013 | text | visible-default | "Jumlah Pelajar" | FN-M18-2.7.1 |
| EL-M18-S7-014 | text | visible-default | "0" | FN-M18-2.7.1 |
| EL-M18-S7-015 | text | visible-default | "Pelajar Aktif" | FN-M18-2.7.1 |
| EL-M18-S7-016 | text | visible-default | "0.6%" | FN-M18-2.7.1 |
| EL-M18-S7-017 | text | visible-default | "Purata Ketepatan" | FN-M18-2.7.1 |
| EL-M18-S7-018 | text | visible-default | "222" | FN-M18-2.7.1 |
| EL-M18-S7-019 | text | visible-default | "Soalan Dijawab" | FN-M18-2.7.1 |
| EL-M18-S7-020 | card | visible-default | "Muat Turun Laporan CSV" | FN-M18-2.7.2 |
| EL-M18-S7-021 | heading | visible-default | "Muat Turun Laporan CSV" | FN-M18-2.7.2 |
| EL-M18-S7-022 | text | visible-default | "Fail CSV mengandungi data 116 sekolah dengan lajur: Nama, Kod, Daerah, Pelajar,  …" | FN-M18-2.7.2 |
| EL-M18-S7-023 | text | visible-default | "Data dikira berdasarkan rekod terkini. Fail akan terbuka terus dengan Microsoft  …", fa-info-circle | FN-M18-2.7.2 |
| EL-M18-S7-024 | link | visible-default | "Muat Turun CSV", → /ppd/export-laporan?format=csv, fa-download | FN-M18-2.7.2 |
| EL-M18-S7-025 | text | visible-default | "Format: CSV (UTF-8 BOM)", fa-file-csv | FN-M18-2.7.2 |
| EL-M18-S7-026 | text | visible-default | "Dijana: 26 Sep 2026, 04:21", fa-calendar | FN-M18-2.7.2 |
| EL-M18-S7-027 | text | visible-default | "Daerah: PPD KLUANG, Johor", fa-map-marker-alt | FN-M18-2.7.2 |
| EL-M18-S7-028 | card | visible-default | "Pratonton Data (5 Sekolah Pertama)" | FN-M18-2.7.3 |
| EL-M18-S7-029 | heading | visible-default | "Pratonton Data (5 Sekolah Pertama)" | FN-M18-2.7.3 |
| EL-M18-S7-030 | text | visible-default | "Data sebenar dalam fail CSV" | FN-M18-2.7.3 |
| EL-M18-S7-031 | table | visible-default | table | FN-M18-2.7.3 |
| EL-M18-S7-032 | text | visible-default | "Menunjukkan 5 dari 116 sekolah. Muat turun CSV untuk data lengkap." | FN-M18-2.7.3 |

#### S8 — `/ppd/leaderboard-sekolah` (69 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M18-S8-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S8-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S8-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S8-004 | link | visible-default | "Dashboard PPD", → /ppd/dashboard, fa-arrow-left | FN-M18-2.8.1 |
| EL-M18-S8-005 | text | visible-default | "/" | FN-M18-2.8.1 |
| EL-M18-S8-006 | text | visible-default | "Leaderboard Sekolah" | FN-M18-2.8.1 |
| EL-M18-S8-007 | card | visible-default | "PPD KLUANG" | FN-M18-2.8.1 |
| EL-M18-S8-008 | heading | visible-default | "PPD KLUANG" | FN-M18-2.8.1 |
| EL-M18-S8-009 | text | visible-default | "Johor" | FN-M18-2.8.1 |
| EL-M18-S8-010 | text | visible-default | "Kedudukan sekolah berdasarkan skor komposit — aktiviti, ketepatan & jumlah soala …" | FN-M18-2.8.1 |
| EL-M18-S8-011 | text | visible-default | "116" | FN-M18-2.8.1 |
| EL-M18-S8-012 | text | visible-default | "Sekolah" | FN-M18-2.8.1 |
| EL-M18-S8-013 | tab | visible-default | "Keseluruhan", fa-list-ol | FN-M18-2.8.2 |
| EL-M18-S8-014 | tab | visible-default | "Ikut Subjek", fa-book | FN-M18-2.8.2 |
| EL-M18-S8-015 | card | visible-default | "Tapis Mata Pelajaran" | FN-M18-2.8.3 |
| EL-M18-S8-016 | form | visible-default | form | FN-M18-2.8.3 |
| EL-M18-S8-017 | label | visible-default | "Tapis Mata Pelajaran" | FN-M18-2.8.3 |
| EL-M18-S8-018 | select | visible-default | select, name=subject_id, 32 options | FN-M18-2.8.3 |
| EL-M18-S8-019 | button | visible-default | "Tapis", fa-filter | FN-M18-2.8.3 |
| EL-M18-S8-020 | text | visible-default | "Skor Komposit = (% Aktif × 0.4) + (Purata Ketepatan × 0.3) + (Soalan/Pelajar × 0 …" | FN-M18-2.8.4 |
| EL-M18-S8-021 | card | visible-default | "Podium Teratas Daerah" | FN-M18-2.8.5 |
| EL-M18-S8-022 | heading | visible-default | "Podium Teratas Daerah" | FN-M18-2.8.5 |
| EL-M18-S8-023 | link | visible-default | "KOLEJ VOKASIONAL KLUANG", → /ppd/sekolah/8953 | FN-M18-2.8.5 |
| EL-M18-S8-024 | text | visible-default | "0" | FN-M18-2.8.5 |
| EL-M18-S8-025 | text | visible-default | "🥈" | FN-M18-2.8.5 |
| EL-M18-S8-026 | text | visible-default | "Tempat 2" | FN-M18-2.8.5 |
| EL-M18-S8-027 | link | visible-default | "SEKOLAH MENENGAH KEBANGSAAN LAYANG-LAYANG", → /ppd/sekolah/8765 | FN-M18-2.8.5 |
| EL-M18-S8-028 | text | visible-default | "21.9" | FN-M18-2.8.5 |
| EL-M18-S8-029 | text | visible-default | "🏋" | FN-M18-2.8.5 |
| EL-M18-S8-030 | text | visible-default | "Tempat 1" | FN-M18-2.8.5 |
| EL-M18-S8-031 | link | visible-default | "SEKOLAH JENIS KEBANGSAAN (CINA) CHIAN BEE", → /ppd/sekolah/3156 | FN-M18-2.8.5 |
| EL-M18-S8-032 | text | visible-default | "0" | FN-M18-2.8.5 |
| EL-M18-S8-033 | text | visible-default | "🥉" | FN-M18-2.8.5 |
| EL-M18-S8-034 | text | visible-default | "Tempat 3" | FN-M18-2.8.5 |
| EL-M18-S8-035 | card | visible-default | "Kedudukan Penuh" | FN-M18-2.8.6 |
| EL-M18-S8-036 | heading | visible-default | "Kedudukan Penuh" | FN-M18-2.8.6 |
| EL-M18-S8-037 | link | visible-default | "Eksport CSV", → /ppd/export-laporan, fa-download | FN-M18-2.8.7 |
| EL-M18-S8-038 | table | visible-default | table | FN-M18-2.8.6 |
| EL-M18-S8-039 | link | visible-default | "SEKOLAH MENENGAH KEBANGSAAN LAYANG-LAYANG", → /ppd/sekolah/8765 | FN-M18-2.8.6 |
| EL-M18-S8-040 | badge | visible-default | "73.1%" | FN-M18-2.8.6 |
| EL-M18-S8-041 | link | visible-default | "KOLEJ VOKASIONAL KLUANG", → /ppd/sekolah/8953 | FN-M18-2.8.6 |
| EL-M18-S8-042 | link | visible-default | "SEKOLAH JENIS KEBANGSAAN (CINA) CHIAN BEE", → /ppd/sekolah/3156 | FN-M18-2.8.6 |
| EL-M18-S8-043 | text | conditional | "🏋" | FN-M18-2.8.8 |
| EL-M18-S8-044 | link | conditional | "SEKOLAH MENENGAH KEBANGSAAN LAYANG-LAYANG", → /ppd/sekolah/8765 | FN-M18-2.8.8 |
| EL-M18-S8-045 | text | conditional | "21.9" | FN-M18-2.8.8 |
| EL-M18-S8-046 | text | conditional | "21 pelajar", fa-users | FN-M18-2.8.8 |
| EL-M18-S8-047 | text | conditional | "0 aktif (0%)", fa-user-check | FN-M18-2.8.8 |
| EL-M18-S8-048 | badge | conditional | "73.1% tepat" | FN-M18-2.8.8 |
| EL-M18-S8-049 | text | conditional | "🥈" | FN-M18-2.8.8 |
| EL-M18-S8-050 | link | conditional | "KOLEJ VOKASIONAL KLUANG", → /ppd/sekolah/8953 | FN-M18-2.8.8 |
| EL-M18-S8-051 | text | conditional | "0" | FN-M18-2.8.8 |
| EL-M18-S8-052 | text | conditional | "0 pelajar", fa-users | FN-M18-2.8.8 |
| EL-M18-S8-053 | text | conditional | "0 aktif (0%)", fa-user-check | FN-M18-2.8.8 |
| EL-M18-S8-054 | text | conditional | "🥉" | FN-M18-2.8.8 |
| EL-M18-S8-055 | link | conditional | "SEKOLAH JENIS KEBANGSAAN (CINA) CHIAN BEE", → /ppd/sekolah/3156 | FN-M18-2.8.8 |
| EL-M18-S8-056 | text | conditional | "0" | FN-M18-2.8.8 |
| EL-M18-S8-057 | text | conditional | "0 pelajar", fa-users | FN-M18-2.8.8 |
| EL-M18-S8-058 | text | conditional | "0 aktif (0%)", fa-user-check | FN-M18-2.8.8 |
| EL-M18-S8-059 | text | visible-default | "Tempat 1 — Emas" | FN-M18-1.3.3 |
| EL-M18-S8-060 | text | visible-default | "Tempat 2 — Perak" | FN-M18-1.3.3 |
| EL-M18-S8-061 | text | visible-default | "Tempat 3 — Gangsa" | FN-M18-1.3.3 |
| EL-M18-S8-062 | text | visible-default | "Meningkat" | FN-M18-2.8.9 |
| EL-M18-S8-063 | text | visible-default | "Menurun" | FN-M18-2.8.9 |
| EL-M18-S8-064 | text | visible-default | "Stabil" | FN-M18-2.8.9 |
| EL-M18-S8-065 | link | conditional | "Kosongkan", → /ppd/leaderboard-sekolah, fa-times | FN-M18-2.8.3 |
| EL-M18-S8-066 | card | conditional | "Kedudukan Penuh — Matematik" | FN-M18-2.8.6 |
| EL-M18-S8-067 | heading | conditional | "Kedudukan Penuh — Matematik" | FN-M18-2.8.6 |
| EL-M18-S8-068 | badge | conditional | "76.3%" | FN-M18-2.8.6 |
| EL-M18-S8-069 | badge | hidden-only | "76.3% tepat" | FN-M18-2.8.8 |

#### S9 — `/ppd/sekolah/{id}` (291 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M18-S9-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S9-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S9-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S9-004 | link | visible-default | "Ranking Kebangsaan", → /ppd/ranking-kebangsaan, fa-arrow-left | FN-M18-2.9.1 |
| EL-M18-S9-005 | text | visible-default | "/" | FN-M18-2.9.1 |
| EL-M18-S9-006 | text | visible-default | "SEKOLAH MENENGAH KEBANGSAAN TINGGI KLUANG" | FN-M18-2.9.1 |
| EL-M18-S9-007 | card | visible-default | "SEKOLAH MENENGAH KEBANGSAAN TINGGI KLUANG" | FN-M18-2.9.2 |
| EL-M18-S9-008 | heading | visible-default | "SEKOLAH MENENGAH KEBANGSAAN TINGGI KLUANG" | FN-M18-2.9.2 |
| EL-M18-S9-009 | text | visible-default | "JEB2037" | FN-M18-2.9.2 |
| EL-M18-S9-010 | text | visible-default | "PPD KLUANG", fa-map-marker-alt | FN-M18-2.9.2 |
| EL-M18-S9-011 | text | visible-default | "\|" | FN-M18-2.9.2 |
| EL-M18-S9-012 | text | visible-default | "Johor", fa-flag | FN-M18-2.9.2 |
| EL-M18-S9-013 | text | visible-default | "\|" | FN-M18-2.9.2 |
| EL-M18-S9-014 | text | visible-default | "SMK", fa-tag | FN-M18-2.9.2 |
| EL-M18-S9-015 | text | visible-default | "59" | FN-M18-2.9.2 |
| EL-M18-S9-016 | text | visible-default | "Pelajar" | FN-M18-2.9.2 |
| EL-M18-S9-017 | text | visible-default | "6.8%" | FN-M18-2.9.2 |
| EL-M18-S9-018 | text | visible-default | "Penggunaan" | FN-M18-2.9.2 |
| EL-M18-S9-019 | text | visible-default | "0" | FN-M18-2.9.2 |
| EL-M18-S9-020 | text | visible-default | "Aktif 7 Hari" | FN-M18-2.9.2 |
| EL-M18-S9-021 | card | visible-default | "Tingkatan / Darjah" | FN-M18-2.9.3 |
| EL-M18-S9-022 | form | visible-default | form | FN-M18-2.9.3 |
| EL-M18-S9-023 | label | visible-default | "Tingkatan / Darjah" | FN-M18-2.9.3 |
| EL-M18-S9-024 | select | visible-default | select, name=grade, 7 options | FN-M18-2.9.3 |
| EL-M18-S9-025 | label | visible-default | "Kelas" | FN-M18-2.9.3 |
| EL-M18-S9-026 | select | visible-default | select, name=class_id, 3 options | FN-M18-2.9.3 |
| EL-M18-S9-027 | label | visible-default | "Subjek" | FN-M18-2.9.3 |
| EL-M18-S9-028 | select | visible-default | select, name=subject_id, 4 options | FN-M18-2.9.3 |
| EL-M18-S9-029 | button | visible-default | "Tapis", fa-filter | FN-M18-2.9.3 |
| EL-M18-S9-030 | card | visible-default | "Jumlah Pelajar" | FN-M18-2.9.4 |
| EL-M18-S9-031 | text | visible-default | "Jumlah Pelajar" | FN-M18-2.9.4 |
| EL-M18-S9-032 | text | visible-default | "59" | FN-M18-2.9.4 |
| EL-M18-S9-033 | card | visible-default | "Sudah Guna" | FN-M18-2.9.4 |
| EL-M18-S9-034 | text | visible-default | "Sudah Guna" | FN-M18-2.9.4 |
| EL-M18-S9-035 | text | visible-default | "4" | FN-M18-2.9.4 |
| EL-M18-S9-036 | text | visible-default | "Pelajar yang telah menjawab" | FN-M18-2.9.4 |
| EL-M18-S9-037 | card | visible-default | "Belum Guna" | FN-M18-2.9.4 |
| EL-M18-S9-038 | text | visible-default | "Belum Guna" | FN-M18-2.9.4 |
| EL-M18-S9-039 | text | visible-default | "55" | FN-M18-2.9.4 |
| EL-M18-S9-040 | text | visible-default | "Belum pernah menjawab soalan" | FN-M18-2.9.4 |
| EL-M18-S9-041 | card | visible-default | "% Penggunaan" | FN-M18-2.9.4 |
| EL-M18-S9-042 | text | visible-default | "% Penggunaan" | FN-M18-2.9.4 |
| EL-M18-S9-043 | text | visible-default | "6.8%" | FN-M18-2.9.4 |
| EL-M18-S9-044 | card | visible-default | "Aktif 7 Hari" | FN-M18-2.9.4 |
| EL-M18-S9-045 | text | visible-default | "Aktif 7 Hari" | FN-M18-2.9.4 |
| EL-M18-S9-046 | text | visible-default | "0" | FN-M18-2.9.4 |
| EL-M18-S9-047 | text | visible-default | "Latihan dalam 7 hari lepas" | FN-M18-2.9.4 |
| EL-M18-S9-048 | card | visible-default | "Purata Sesi / Pelajar" | FN-M18-2.9.4 |
| EL-M18-S9-049 | text | visible-default | "Purata Sesi / Pelajar" | FN-M18-2.9.4 |
| EL-M18-S9-050 | text | visible-default | "15" | FN-M18-2.9.4 |
| EL-M18-S9-051 | text | visible-default | "sesi per pelajar aktif" | FN-M18-2.9.4 |
| EL-M18-S9-052 | clickable | hidden-only | clickable | FN-M18-2.9.5 |
| EL-M18-S9-053 | link | visible-default | "Bulanan", → #sec-bulanan | FN-M18-2.9.5 |
| EL-M18-S9-054 | link | visible-default | "Kalendar", → #sec-kalendar | FN-M18-2.9.5 |
| EL-M18-S9-055 | link | visible-default | "Subjek", → #sec-subjek | FN-M18-2.9.5 |
| EL-M18-S9-056 | link | visible-default | "Ranking", → #sec-ranking | FN-M18-2.9.5 |
| EL-M18-S9-057 | link | visible-default | "Kelas", → #sec-kelas | FN-M18-2.9.5 |
| EL-M18-S9-058 | link | visible-default | "Pelajar", → #sec-pelajar | FN-M18-2.9.5 |
| EL-M18-S9-059 | link | visible-default | "Guru", → #sec-guru | FN-M18-2.9.5 |
| EL-M18-S9-060 | card | visible-default | "Statistik Bulanan" | FN-M18-2.9.6 |
| EL-M18-S9-061 | heading | visible-default | "Statistik Bulanan" | FN-M18-2.9.6 |
| EL-M18-S9-062 | text | visible-default | "12 bulan terakhir — pecahan prestasi mengikut bulan" | FN-M18-2.9.6 |
| EL-M18-S9-063 | table | visible-default | table | FN-M18-2.9.6 |
| EL-M18-S9-064 | card | visible-default | "Kalendar Aktiviti Harian" | FN-M18-2.9.7 |
| EL-M18-S9-065 | heading | visible-default | "Kalendar Aktiviti Harian" | FN-M18-2.9.7 |
| EL-M18-S9-066 | text | visible-default | "365 hari — semakin gelap, semakin ramai pelajar aktif" | FN-M18-2.9.7 |
| EL-M18-S9-067 | text | visible-default | "33" | FN-M18-2.9.7 |
| EL-M18-S9-068 | text | visible-default | "Hari Aktif" | FN-M18-2.9.7 |
| EL-M18-S9-069 | text | visible-default | "7,307" | FN-M18-2.9.7 |
| EL-M18-S9-070 | text | visible-default | "Jumlah Betul" | FN-M18-2.9.7 |
| EL-M18-S9-071 | text | visible-default | "221" | FN-M18-2.9.7 |
| EL-M18-S9-072 | text | visible-default | "Purata/Hari" | FN-M18-2.9.7 |
| EL-M18-S9-073 | text | visible-default | "Sep" | FN-M18-2.9.7 |
| EL-M18-S9-074 | text | visible-default | "Okt" | FN-M18-2.9.7 |
| EL-M18-S9-075 | text | visible-default | "Nov" | FN-M18-2.9.7 |
| EL-M18-S9-076 | text | visible-default | "Dis" | FN-M18-2.9.7 |
| EL-M18-S9-077 | text | visible-default | "Jan" | FN-M18-2.9.7 |
| EL-M18-S9-078 | text | visible-default | "Feb" | FN-M18-2.9.7 |
| EL-M18-S9-079 | text | visible-default | "Mac" | FN-M18-2.9.7 |
| EL-M18-S9-080 | text | visible-default | "Apr" | FN-M18-2.9.7 |
| EL-M18-S9-081 | text | visible-default | "Mei" | FN-M18-2.9.7 |
| EL-M18-S9-082 | text | visible-default | "Jun" | FN-M18-2.9.7 |
| EL-M18-S9-083 | text | visible-default | "Jul" | FN-M18-2.9.7 |
| EL-M18-S9-084 | text | visible-default | "Ogs" | FN-M18-2.9.7 |
| EL-M18-S9-085 | text | visible-default | "Sep" | FN-M18-2.9.7 |
| EL-M18-S9-086 | text | visible-default | "Isn" | FN-M18-2.9.7 |
| EL-M18-S9-087 | text | visible-default | "Rab" | FN-M18-2.9.7 |
| EL-M18-S9-088 | text | visible-default | "Jum" | FN-M18-2.9.7 |
| EL-M18-S9-089 | text | visible-default | "Ahd" | FN-M18-2.9.7 |
| EL-M18-S9-090 | tooltip | visible-default | "2025-09-27: 0 pelajar aktif, 0 betul" | FN-M18-2.9.7 |
| EL-M18-S9-091 | tooltip | visible-default | "2025-09-28: 0 pelajar aktif, 0 betul" | FN-M18-2.9.7 |
| EL-M18-S9-092 | tooltip | visible-default | "2025-09-29: 0 pelajar aktif, 0 betul" | FN-M18-2.9.7 |
| EL-M18-S9-093 | text | visible-default | "Kurang" | FN-M18-2.9.7 |
| EL-M18-S9-094 | text | visible-default | "Lebih" | FN-M18-2.9.7 |
| EL-M18-S9-095 | heading | visible-default | "Laporan Subjek" | FN-M18-2.9.8 |
| EL-M18-S9-096 | text | visible-default | "Pecahan prestasi mengikut subjek — ketepatan sebelum & selepas pembetulan" | FN-M18-2.9.8 |
| EL-M18-S9-097 | card | visible-default | "Bahasa Melayu" | FN-M18-2.9.8 |
| EL-M18-S9-098 | heading | visible-default | "Bahasa Melayu" | FN-M18-2.9.8 |
| EL-M18-S9-099 | text | visible-default | "BM" | FN-M18-2.9.8 |
| EL-M18-S9-100 | text | visible-default | "1" | FN-M18-2.9.8 |
| EL-M18-S9-101 | text | visible-default | "Pelajar" | FN-M18-2.9.8 |
| EL-M18-S9-102 | text | visible-default | "26" | FN-M18-2.9.8 |
| EL-M18-S9-103 | text | visible-default | "Soalan" | FN-M18-2.9.8 |
| EL-M18-S9-104 | text | visible-default | "34.6%" | FN-M18-2.9.8 |
| EL-M18-S9-105 | text | visible-default | "Accuracy" | FN-M18-2.9.8 |
| EL-M18-S9-106 | text | visible-default | "Sebelum" | FN-M18-2.9.8 |
| EL-M18-S9-107 | text | visible-default | "72%" | FN-M18-2.9.8 |
| EL-M18-S9-108 | text | visible-default | "Selepas" | FN-M18-2.9.8 |
| EL-M18-S9-109 | text | visible-default | "72%" | FN-M18-2.9.8 |
| EL-M18-S9-110 | card | visible-default | "Bahasa Inggeris" | FN-M18-2.9.8 |
| EL-M18-S9-111 | heading | visible-default | "Bahasa Inggeris" | FN-M18-2.9.8 |
| EL-M18-S9-112 | text | visible-default | "BI" | FN-M18-2.9.8 |
| EL-M18-S9-113 | text | visible-default | "1" | FN-M18-2.9.8 |
| EL-M18-S9-114 | text | visible-default | "Pelajar" | FN-M18-2.9.8 |
| EL-M18-S9-115 | text | visible-default | "8" | FN-M18-2.9.8 |
| EL-M18-S9-116 | text | visible-default | "Soalan" | FN-M18-2.9.8 |
| EL-M18-S9-117 | text | visible-default | "50%" | FN-M18-2.9.8 |
| EL-M18-S9-118 | text | visible-default | "Accuracy" | FN-M18-2.9.8 |
| EL-M18-S9-119 | text | visible-default | "Sebelum" | FN-M18-2.9.8 |
| EL-M18-S9-120 | text | visible-default | "71.9%" | FN-M18-2.9.8 |
| EL-M18-S9-121 | text | visible-default | "Selepas" | FN-M18-2.9.8 |
| EL-M18-S9-122 | text | visible-default | "71.9%" | FN-M18-2.9.8 |
| EL-M18-S9-123 | card | visible-default | "Matematik" | FN-M18-2.9.8 |
| EL-M18-S9-124 | heading | visible-default | "Matematik" | FN-M18-2.9.8 |
| EL-M18-S9-125 | text | visible-default | "MATH" | FN-M18-2.9.8 |
| EL-M18-S9-126 | text | visible-default | "1" | FN-M18-2.9.8 |
| EL-M18-S9-127 | text | visible-default | "Pelajar" | FN-M18-2.9.8 |
| EL-M18-S9-128 | text | visible-default | "5" | FN-M18-2.9.8 |
| EL-M18-S9-129 | text | visible-default | "Soalan" | FN-M18-2.9.8 |
| EL-M18-S9-130 | text | visible-default | "100%" | FN-M18-2.9.8 |
| EL-M18-S9-131 | text | visible-default | "Accuracy" | FN-M18-2.9.8 |
| EL-M18-S9-132 | text | visible-default | "Sebelum" | FN-M18-2.9.8 |
| EL-M18-S9-133 | text | visible-default | "72.4%" | FN-M18-2.9.8 |
| EL-M18-S9-134 | text | visible-default | "Selepas" | FN-M18-2.9.8 |
| EL-M18-S9-135 | text | visible-default | "72.4%" | FN-M18-2.9.8 |
| EL-M18-S9-136 | card | visible-default | "Ranking Pelajar" | FN-M18-2.9.9 |
| EL-M18-S9-137 | heading | visible-default | "Ranking Pelajar" | FN-M18-2.9.9 |
| EL-M18-S9-138 | text | visible-default | "Kedudukan pelajar berdasarkan prestasi" | FN-M18-2.9.9 |
| EL-M18-S9-139 | button | visible-default | "Ikut Kelas", fa-door-open | FN-M18-2.9.9 |
| EL-M18-S9-140 | button | visible-default | "Ikut Subjek", fa-book | FN-M18-2.9.9 |
| EL-M18-S9-141 | empty-state | visible-default | "Tiada data ranking" | FN-M18-2.9.9 |
| EL-M18-S9-142 | text | visible-default | "Data ranking dikemas kini setiap hari" | FN-M18-2.9.9 |
| EL-M18-S9-143 | text | conditional | "Pilih subjek dari filter di atas" | FN-M18-2.9.9 |
| EL-M18-S9-144 | text | conditional | "Ranking akan dipaparkan mengikut subjek yang dipilih" | FN-M18-2.9.9 |
| EL-M18-S9-145 | card | visible-default | "Prestasi Per Kelas" | FN-M18-2.9.10 |
| EL-M18-S9-146 | heading | visible-default | "Prestasi Per Kelas" | FN-M18-2.9.10 |
| EL-M18-S9-147 | text | visible-default | "2 kelas dipaparkan" | FN-M18-2.9.10 |
| EL-M18-S9-148 | table | visible-default | table | FN-M18-2.9.10 |
| EL-M18-S9-149 | card | visible-default | "Senarai Pelajar — Terperinci" | FN-M18-2.9.11 |
| EL-M18-S9-150 | heading | visible-default | "Senarai Pelajar — Terperinci" | FN-M18-2.9.11 |
| EL-M18-S9-151 | text | visible-default | "Klik pada kelas untuk lihat senarai pelajar" | FN-M18-2.9.11 |
| EL-M18-S9-152 | alert | visible-default | "PDPA Dilindungi", fa-shield-alt | FN-M18-2.9.12 |
| EL-M18-S9-153 | button | visible-default | "Tunjuk IC Penuh", fa-eye | FN-M18-2.9.12 |
| EL-M18-S9-154 | dropdown-trigger | visible-default | "4 Simulasi 15 pelajar 0 guna 15 belum", fa-chevron-right | FN-M18-2.9.11 |
| EL-M18-S9-155 | badge | visible-default | "0 guna", fa-circle | FN-M18-2.9.11 |
| EL-M18-S9-156 | badge | visible-default | "15 belum", fa-circle | FN-M18-2.9.11 |
| EL-M18-S9-157 | table | conditional | table | FN-M18-2.9.11 |
| EL-M18-S9-158 | dropdown-trigger | visible-default | "5 Simulasi 15 pelajar 3 guna 12 belum", fa-chevron-right | FN-M18-2.9.11 |
| EL-M18-S9-159 | badge | visible-default | "3 guna", fa-circle | FN-M18-2.9.11 |
| EL-M18-S9-160 | badge | visible-default | "12 belum", fa-circle | FN-M18-2.9.11 |
| EL-M18-S9-161 | table | conditional | table | FN-M18-2.9.11 |
| EL-M18-S9-162 | dropdown-trigger | visible-default | "Tiada Kelas 28 pelajar", fa-chevron-right | FN-M18-2.9.11 |
| EL-M18-S9-163 | table | hidden-only | table | FN-M18-2.9.11 |
| EL-M18-S9-164 | card | visible-default | "Senarai Guru" | FN-M18-2.9.13 |
| EL-M18-S9-165 | heading | visible-default | "Senarai Guru" | FN-M18-2.9.13 |
| EL-M18-S9-166 | text | visible-default | "Guru berdaftar di SEKOLAH MENENGAH KEBANGSAAN TINGGI KLUANG" | FN-M18-2.9.13 |
| EL-M18-S9-167 | table | visible-default | table | FN-M18-2.9.13 |
| EL-M18-S9-168 | text | conditional | "0%" | FN-M18-2.9.4 |
| EL-M18-S9-169 | link | conditional | "Reset", → /ppd/sekolah/8880, fa-times | FN-M18-2.9.3 |
| EL-M18-S9-170 | text | conditional | "0%" | FN-M18-2.9.4 |
| EL-M18-S9-171 | empty-state | conditional | "Tiada data" | FN-M18-2.9.6 |
| EL-M18-S9-172 | empty-state | conditional | "Tiada aktiviti direkodkan buat masa ini" | FN-M18-2.9.6 |
| EL-M18-S9-173 | card | conditional | "Tiada data subjek" | FN-M18-2.9.8 |
| EL-M18-S9-174 | empty-state | conditional | "Tiada data subjek" | FN-M18-2.9.8 |
| EL-M18-S9-175 | badge | hidden-only | "Belum Guna", fa-circle | FN-M18-2.9.11 |
| EL-M18-S9-176 | text | conditional | "11.1%" | FN-M18-2.9.4 |
| EL-M18-S9-177 | text | conditional | "11.1%" | FN-M18-2.9.4 |
| EL-M18-S9-178 | text | conditional | "64.4%" | FN-M18-2.9.8 |
| EL-M18-S9-179 | text | conditional | "64.4%" | FN-M18-2.9.8 |
| EL-M18-S9-180 | text | conditional | "63.8%" | FN-M18-2.9.8 |
| EL-M18-S9-181 | text | conditional | "63.8%" | FN-M18-2.9.8 |
| EL-M18-S9-182 | text | conditional | "63.3%" | FN-M18-2.9.8 |
| EL-M18-S9-183 | text | conditional | "63.3%" | FN-M18-2.9.8 |
| EL-M18-S9-184 | text | conditional | "0 kelas dipaparkan" | FN-M18-2.9.10 |
| EL-M18-S9-185 | empty-state | conditional | "Tiada kelas dijumpai" | FN-M18-2.9.10 |
| EL-M18-S9-186 | text | conditional | "Sila cipta kelas terlebih dahulu" | FN-M18-2.9.10 |
| EL-M18-S9-187 | empty-state | conditional | "Tiada data pelajar" | FN-M18-2.9.11 |
| EL-M18-S9-188 | empty-state | conditional | "Tiada pelajar dalam sekolah ini buat masa ini" | FN-M18-2.9.11 |
| EL-M18-S9-189 | dropdown-trigger | conditional | "Tiada Kelas 11 pelajar", fa-chevron-right | FN-M18-2.9.11 |
| EL-M18-S9-190 | text | conditional | "404" | FN-M18-1.2.7 |
| EL-M18-S9-191 | text | conditional | "🔍" | FN-M18-1.2.7 |
| EL-M18-S9-192 | heading | conditional | "Halaman Tidak Dijumpai" | FN-M18-1.2.7 |
| EL-M18-S9-193 | text | conditional | "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL sal …" | FN-M18-1.2.7 |
| EL-M18-S9-194 | link | conditional | "Halaman Utama", → / | FN-M18-1.2.7 |
| EL-M18-S9-195 | link | conditional | "Mula Latihan", → /latih-tubi | FN-M18-1.2.7 |
| EL-M18-S9-196 | text | conditional | "PRESTASIPLUS" | FN-M18-1.2.7 |
| EL-M18-S9-197 | text | conditional | "SEKOLAH MENENGAH KEBANGSAAN LAYANG-LAYANG" | FN-M18-2.9.2 |
| EL-M18-S9-198 | card | conditional | "SEKOLAH MENENGAH KEBANGSAAN LAYANG-LAYANG" | FN-M18-2.9.2 |
| EL-M18-S9-199 | heading | conditional | "SEKOLAH MENENGAH KEBANGSAAN LAYANG-LAYANG" | FN-M18-2.9.2 |
| EL-M18-S9-200 | text | conditional | "JEA2029" | FN-M18-2.9.2 |
| EL-M18-S9-201 | text | conditional | "9.5%" | FN-M18-2.9.2 |
| EL-M18-S9-202 | text | conditional | "9.5%" | FN-M18-2.9.2 |
| EL-M18-S9-203 | text | conditional | "45.6%" | FN-M18-2.9.8 |
| EL-M18-S9-204 | text | conditional | "77.3%" | FN-M18-2.9.8 |
| EL-M18-S9-205 | text | conditional | "77.3%" | FN-M18-2.9.8 |
| EL-M18-S9-206 | text | conditional | "Purata Level" | FN-M18-2.9.8 |
| EL-M18-S9-207 | text | conditional | "0.7", fa-layer-group | FN-M18-2.9.8 |
| EL-M18-S9-208 | card | conditional | "Kimia" | FN-M18-2.9.8 |
| EL-M18-S9-209 | heading | conditional | "Kimia" | FN-M18-2.9.8 |
| EL-M18-S9-210 | text | conditional | "CHEM" | FN-M18-2.9.8 |
| EL-M18-S9-211 | text | conditional | "48.5%" | FN-M18-2.9.8 |
| EL-M18-S9-212 | text | conditional | "Purata Level" | FN-M18-2.9.8 |
| EL-M18-S9-213 | text | conditional | "1", fa-layer-group | FN-M18-2.9.8 |
| EL-M18-S9-214 | card | conditional | "Fizik" | FN-M18-2.9.8 |
| EL-M18-S9-215 | heading | conditional | "Fizik" | FN-M18-2.9.8 |
| EL-M18-S9-216 | text | conditional | "PHY" | FN-M18-2.9.8 |
| EL-M18-S9-217 | text | conditional | "43.5%" | FN-M18-2.9.8 |
| EL-M18-S9-218 | text | conditional | "Purata Level" | FN-M18-2.9.8 |
| EL-M18-S9-219 | text | conditional | "0.4", fa-layer-group | FN-M18-2.9.8 |
| EL-M18-S9-220 | card | conditional | "Matematik Tambahan" | FN-M18-2.9.8 |
| EL-M18-S9-221 | heading | conditional | "Matematik Tambahan" | FN-M18-2.9.8 |
| EL-M18-S9-222 | text | conditional | "ADDMATH" | FN-M18-2.9.8 |
| EL-M18-S9-223 | text | conditional | "2" | FN-M18-2.9.8 |
| EL-M18-S9-224 | text | conditional | "Pelajar" | FN-M18-2.9.8 |
| EL-M18-S9-225 | text | conditional | "97" | FN-M18-2.9.8 |
| EL-M18-S9-226 | text | conditional | "Soalan" | FN-M18-2.9.8 |
| EL-M18-S9-227 | text | conditional | "48.5%" | FN-M18-2.9.8 |
| EL-M18-S9-228 | text | conditional | "Accuracy" | FN-M18-2.9.8 |
| EL-M18-S9-229 | text | conditional | "Purata Level" | FN-M18-2.9.8 |
| EL-M18-S9-230 | text | conditional | "1.5", fa-layer-group | FN-M18-2.9.8 |
| EL-M18-S9-231 | card | conditional | "Sains Komputer" | FN-M18-2.9.8 |
| EL-M18-S9-232 | heading | conditional | "Sains Komputer" | FN-M18-2.9.8 |
| EL-M18-S9-233 | text | conditional | "SK" | FN-M18-2.9.8 |
| EL-M18-S9-234 | text | conditional | "3" | FN-M18-2.9.8 |
| EL-M18-S9-235 | text | conditional | "Pelajar" | FN-M18-2.9.8 |
| EL-M18-S9-236 | text | conditional | "71" | FN-M18-2.9.8 |
| EL-M18-S9-237 | text | conditional | "Soalan" | FN-M18-2.9.8 |
| EL-M18-S9-238 | text | conditional | "56.8%" | FN-M18-2.9.8 |
| EL-M18-S9-239 | text | conditional | "Accuracy" | FN-M18-2.9.8 |
| EL-M18-S9-240 | text | conditional | "Purata Level" | FN-M18-2.9.8 |
| EL-M18-S9-241 | text | conditional | "1", fa-layer-group | FN-M18-2.9.8 |
| EL-M18-S9-242 | card | conditional | "Sejarah" | FN-M18-2.9.8 |
| EL-M18-S9-243 | heading | conditional | "Sejarah" | FN-M18-2.9.8 |
| EL-M18-S9-244 | text | conditional | "SEJ" | FN-M18-2.9.8 |
| EL-M18-S9-245 | text | conditional | "3" | FN-M18-2.9.8 |
| EL-M18-S9-246 | text | conditional | "Pelajar" | FN-M18-2.9.8 |
| EL-M18-S9-247 | text | conditional | "68" | FN-M18-2.9.8 |
| EL-M18-S9-248 | text | conditional | "Soalan" | FN-M18-2.9.8 |
| EL-M18-S9-249 | text | conditional | "44.1%" | FN-M18-2.9.8 |
| EL-M18-S9-250 | text | conditional | "Accuracy" | FN-M18-2.9.8 |
| EL-M18-S9-251 | text | conditional | "84.6%" | FN-M18-2.9.8 |
| EL-M18-S9-252 | text | conditional | "84.6%" | FN-M18-2.9.8 |
| EL-M18-S9-253 | text | conditional | "Purata Level" | FN-M18-2.9.8 |
| EL-M18-S9-254 | text | conditional | "0.7", fa-layer-group | FN-M18-2.9.8 |
| EL-M18-S9-255 | card | conditional | "Biologi" | FN-M18-2.9.8 |
| EL-M18-S9-256 | heading | conditional | "Biologi" | FN-M18-2.9.8 |
| EL-M18-S9-257 | text | conditional | "BIO" | FN-M18-2.9.8 |
| EL-M18-S9-258 | text | conditional | "3" | FN-M18-2.9.8 |
| EL-M18-S9-259 | text | conditional | "Pelajar" | FN-M18-2.9.8 |
| EL-M18-S9-260 | text | conditional | "58" | FN-M18-2.9.8 |
| EL-M18-S9-261 | text | conditional | "Soalan" | FN-M18-2.9.8 |
| EL-M18-S9-262 | text | conditional | "45.5%" | FN-M18-2.9.8 |
| EL-M18-S9-263 | text | conditional | "Accuracy" | FN-M18-2.9.8 |
| EL-M18-S9-264 | text | conditional | "Purata Level" | FN-M18-2.9.8 |
| EL-M18-S9-265 | text | conditional | "0.3", fa-layer-group | FN-M18-2.9.8 |
| EL-M18-S9-266 | card | conditional | "Perniagaan" | FN-M18-2.9.8 |
| EL-M18-S9-267 | heading | conditional | "Perniagaan" | FN-M18-2.9.8 |
| EL-M18-S9-268 | text | conditional | "PERNIAGA" | FN-M18-2.9.8 |
| EL-M18-S9-269 | text | conditional | "2" | FN-M18-2.9.8 |
| EL-M18-S9-270 | text | conditional | "Pelajar" | FN-M18-2.9.8 |
| EL-M18-S9-271 | text | conditional | "52" | FN-M18-2.9.8 |
| EL-M18-S9-272 | text | conditional | "Soalan" | FN-M18-2.9.8 |
| EL-M18-S9-273 | text | conditional | "55.4%" | FN-M18-2.9.8 |
| EL-M18-S9-274 | text | conditional | "Accuracy" | FN-M18-2.9.8 |
| EL-M18-S9-275 | text | conditional | "Purata Level" | FN-M18-2.9.8 |
| EL-M18-S9-276 | text | conditional | "1", fa-layer-group | FN-M18-2.9.8 |
| EL-M18-S9-277 | card | conditional | "Geografi" | FN-M18-2.9.8 |
| EL-M18-S9-278 | heading | conditional | "Geografi" | FN-M18-2.9.8 |
| EL-M18-S9-279 | text | conditional | "GEO" | FN-M18-2.9.8 |
| EL-M18-S9-280 | text | conditional | "1" | FN-M18-2.9.8 |
| EL-M18-S9-281 | text | conditional | "Pelajar" | FN-M18-2.9.8 |
| EL-M18-S9-282 | text | conditional | "19" | FN-M18-2.9.8 |
| EL-M18-S9-283 | text | conditional | "Soalan" | FN-M18-2.9.8 |
| EL-M18-S9-284 | text | conditional | "47.4%" | FN-M18-2.9.8 |
| EL-M18-S9-285 | text | conditional | "Accuracy" | FN-M18-2.9.8 |
| EL-M18-S9-286 | dropdown-trigger | conditional | "Tiada Kelas 21 pelajar", fa-chevron-right | FN-M18-2.9.11 |
| EL-M18-S9-287 | text | conditional | "Guru berdaftar di SEKOLAH MENENGAH KEBANGSAAN LAYANG-LAYANG" | FN-M18-2.9.13 |
| EL-M18-S9-288 | empty-state | conditional | "Tiada guru berdaftar" | FN-M18-2.9.13 |
| EL-M18-S9-289 | text | conditional | "Sekolah ini belum mempunyai guru yang berdaftar dalam sistem" | FN-M18-2.9.13 |
| EL-M18-S9-290 | text | conditional | "12 bulan terakhir — pecahan prestasi mengikut bulan (subjek ditapis)" | FN-M18-2.9.6 |
| EL-M18-S9-291 | empty-state | hidden-only | "Tiada data ranking untuk subjek ini" | FN-M18-2.9.9 |

#### S10 — `/jpn/dashboard` (215 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M18-S10-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S10-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S10-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S10-004 | link | visible-default | "Papan Pemuka", → /dashboard, fa-arrow-left | FN-M18-3.1.1 |
| EL-M18-S10-005 | text | visible-default | "/" | FN-M18-3.1.1 |
| EL-M18-S10-006 | text | visible-default | "Dashboard JPN" | FN-M18-3.1.1 |
| EL-M18-S10-007 | card | visible-default | "Johor" | FN-M18-3.1.1 |
| EL-M18-S10-008 | heading | visible-default | "Johor" | FN-M18-3.1.1 |
| EL-M18-S10-009 | text | visible-default | "JPN" | FN-M18-3.1.1 |
| EL-M18-S10-010 | text | visible-default | "Dashboard Agregat Jabatan Pendidikan Negeri" | FN-M18-3.1.1 |
| EL-M18-S10-011 | text | visible-default | "1,189" | FN-M18-3.1.1 |
| EL-M18-S10-012 | text | visible-default | "Sekolah" | FN-M18-3.1.1 |
| EL-M18-S10-013 | text | visible-default | "135" | FN-M18-3.1.1 |
| EL-M18-S10-014 | text | visible-default | "Pelajar" | FN-M18-3.1.1 |
| EL-M18-S10-015 | card | visible-default | "Jumlah Sekolah" | FN-M18-3.1.2 |
| EL-M18-S10-016 | text | visible-default | "Jumlah Sekolah" | FN-M18-3.1.2 |
| EL-M18-S10-017 | text | visible-default | "1,189" | FN-M18-3.1.2 |
| EL-M18-S10-018 | card | visible-default | "Jumlah Pelajar" | FN-M18-3.1.2 |
| EL-M18-S10-019 | text | visible-default | "Jumlah Pelajar" | FN-M18-3.1.2 |
| EL-M18-S10-020 | text | visible-default | "135" | FN-M18-3.1.2 |
| EL-M18-S10-021 | card | visible-default | "GPS Purata" | FN-M18-3.1.2 |
| EL-M18-S10-022 | text | visible-default | "GPS Purata" | FN-M18-3.1.2 |
| EL-M18-S10-023 | text | visible-default | "2.49" | FN-M18-3.1.2 |
| EL-M18-S10-024 | text | visible-default | "A-" | FN-M18-3.1.2 |
| EL-M18-S10-025 | card | visible-default | "Pelajar Berisiko Merah" | FN-M18-3.1.2 |
| EL-M18-S10-026 | text | visible-default | "Pelajar Berisiko Merah" | FN-M18-3.1.2 |
| EL-M18-S10-027 | text | visible-default | "135" | FN-M18-3.1.2 |
| EL-M18-S10-028 | text | visible-default | "100% daripada 135 pelajar" | FN-M18-3.1.2 |
| EL-M18-S10-029 | card | visible-default | "Ketepatan Keseluruhan" | FN-M18-3.1.2 |
| EL-M18-S10-030 | text | visible-default | "Ketepatan Keseluruhan" | FN-M18-3.1.2 |
| EL-M18-S10-031 | text | visible-default | "71.6%" | FN-M18-3.1.2 |
| EL-M18-S10-032 | card | visible-default | "Kombo Aktif" | FN-M18-3.1.2 |
| EL-M18-S10-033 | text | visible-default | "Kombo Aktif" | FN-M18-3.1.2 |
| EL-M18-S10-034 | text | visible-default | "81" | FN-M18-3.1.2 |
| EL-M18-S10-035 | text | visible-default | "daripada 135 pelajar" | FN-M18-3.1.2 |
| EL-M18-S10-036 | card | visible-default | "Tapis & Cari" | FN-M18-3.1.3 |
| EL-M18-S10-037 | text | visible-default | "Tapis & Cari" | FN-M18-3.1.3 |
| EL-M18-S10-038 | input | visible-default | input, placeholder="Cari nama sekolah..." | FN-M18-3.1.3 |
| EL-M18-S10-039 | select | visible-default | select, 12 options | FN-M18-3.1.3 |
| EL-M18-S10-040 | button | conditional | "Reset", fa-times | FN-M18-3.1.3 |
| EL-M18-S10-041 | card | visible-default | "Perbandingan Daerah (PPD) — Seluruh Negeri" | FN-M18-3.1.4 |
| EL-M18-S10-042 | heading | visible-default | "Perbandingan Daerah (PPD) — Seluruh Negeri" | FN-M18-3.1.4 |
| EL-M18-S10-043 | text | visible-default | "Ringkasan prestasi semua Pejabat Pendidikan Daerah dalam negeri Johor" | FN-M18-3.1.4 |
| EL-M18-S10-044 | table | visible-default | table | FN-M18-3.1.4 |
| EL-M18-S10-045 | link | visible-default | "PPD BATU PAHAT", → /jpn/daerah/PPD%20BATU%20PAHAT | FN-M18-3.1.4 |
| EL-M18-S10-046 | link | visible-default | "PPD JOHOR BAHRU", → /jpn/daerah/PPD%20JOHOR%20BAHRU | FN-M18-3.1.4 |
| EL-M18-S10-047 | link | visible-default | "PPD KLUANG", → /jpn/daerah/PPD%20KLUANG | FN-M18-3.1.4 |
| EL-M18-S10-048 | text | visible-default | "Klik nama daerah untuk lihat dashboard PPD terperinci", fa-info-circle | FN-M18-3.1.4 |
| EL-M18-S10-049 | card | visible-default | "Prestasi GPS — Perbandingan Sekolah" | FN-M18-3.1.5 |
| EL-M18-S10-050 | heading | visible-default | "Prestasi GPS — Perbandingan Sekolah" | FN-M18-3.1.5 |
| EL-M18-S10-051 | text | visible-default | "Kedudukan sekolah mengikut Gred Purata Sekolah (GPS) — lebih rendah lebih baik" | FN-M18-3.1.5 |
| EL-M18-S10-052 | table | visible-default | table | FN-M18-3.1.5 |
| EL-M18-S10-053 | text | visible-default | "Menunjukkan 1–20 daripada 1189 sekolah" | FN-M18-1.3.4 |
| EL-M18-S10-054 | button | visible-default | button, fa-chevron-left | FN-M18-1.3.4 |
| EL-M18-S10-055 | button | visible-default | "1" | FN-M18-1.3.4 |
| EL-M18-S10-056 | button | visible-default | "2" | FN-M18-1.3.4 |
| EL-M18-S10-057 | text | visible-default | "…" | FN-M18-1.3.4 |
| EL-M18-S10-058 | button | visible-default | "60" | FN-M18-1.3.4 |
| EL-M18-S10-059 | button | visible-default | button, fa-chevron-right | FN-M18-1.3.4 |
| EL-M18-S10-060 | card | visible-default | "Amaran Awal — Taburan Risiko" | FN-M18-3.1.6 |
| EL-M18-S10-061 | heading | visible-default | "Amaran Awal — Taburan Risiko" | FN-M18-3.1.6 |
| EL-M18-S10-062 | text | visible-default | "Taburan risiko pelajar merentasi sekolah dalam negeri" | FN-M18-3.1.6 |
| EL-M18-S10-063 | text | visible-default | "0" | FN-M18-3.1.6 |
| EL-M18-S10-064 | text | visible-default | "On Track" | FN-M18-3.1.6 |
| EL-M18-S10-065 | text | visible-default | "0%" | FN-M18-3.1.6 |
| EL-M18-S10-066 | text | visible-default | "0" | FN-M18-3.1.6 |
| EL-M18-S10-067 | text | visible-default | "Perlu Perhatian" | FN-M18-3.1.6 |
| EL-M18-S10-068 | text | visible-default | "0%" | FN-M18-3.1.6 |
| EL-M18-S10-069 | text | visible-default | "135" | FN-M18-3.1.6 |
| EL-M18-S10-070 | text | visible-default | "Berisiko Tinggi" | FN-M18-3.1.6 |
| EL-M18-S10-071 | text | visible-default | "100%" | FN-M18-3.1.6 |
| EL-M18-S10-072 | text | visible-default | "Taburan Risiko Keseluruhan Negeri" | FN-M18-3.1.6 |
| EL-M18-S10-073 | text | visible-default | "100%" | FN-M18-3.1.6 |
| EL-M18-S10-074 | text | visible-default | "Hijau: 0" | FN-M18-3.1.6 |
| EL-M18-S10-075 | text | visible-default | "Kuning: 0" | FN-M18-3.1.6 |
| EL-M18-S10-076 | text | visible-default | "Merah: 135" | FN-M18-3.1.6 |
| EL-M18-S10-077 | table | visible-default | table | FN-M18-3.1.7 |
| EL-M18-S10-078 | text | visible-default | "Menunjukkan 1–7 daripada 7 sekolah" | FN-M18-1.3.4 |
| EL-M18-S10-079 | card | visible-default | "Analisa Item — Prestasi Mengikut Subjek" | FN-M18-3.1.8 |
| EL-M18-S10-080 | heading | visible-default | "Analisa Item — Prestasi Mengikut Subjek" | FN-M18-3.1.8 |
| EL-M18-S10-081 | text | visible-default | "Ketepatan jawapan merentasi semua subjek dalam negeri" | FN-M18-3.1.8 |
| EL-M18-S10-082 | text | visible-default | "Sejarah" | FN-M18-3.1.8 |
| EL-M18-S10-083 | text | visible-default | "70.7%" | FN-M18-3.1.8 |
| EL-M18-S10-084 | text | visible-default | "31 pelajar", fa-users | FN-M18-3.1.8 |
| EL-M18-S10-085 | text | visible-default | "1,154 soalan", fa-list-check | FN-M18-3.1.8 |
| EL-M18-S10-086 | text | visible-default | "649 salah", fa-times-circle | FN-M18-3.1.8 |
| EL-M18-S10-087 | text | visible-default | "Sains" | FN-M18-3.1.8 |
| EL-M18-S10-088 | text | visible-default | "70.9%" | FN-M18-3.1.8 |
| EL-M18-S10-089 | text | visible-default | "29 pelajar", fa-users | FN-M18-3.1.8 |
| EL-M18-S10-090 | text | visible-default | "1,094 soalan", fa-list-check | FN-M18-3.1.8 |
| EL-M18-S10-091 | text | visible-default | "539 salah", fa-times-circle | FN-M18-3.1.8 |
| EL-M18-S10-092 | text | visible-default | "Bahasa Melayu" | FN-M18-3.1.8 |
| EL-M18-S10-093 | text | visible-default | "71.1%" | FN-M18-3.1.8 |
| EL-M18-S10-094 | text | visible-default | "32 pelajar", fa-users | FN-M18-3.1.8 |
| EL-M18-S10-095 | text | visible-default | "545 soalan", fa-list-check | FN-M18-3.1.8 |
| EL-M18-S10-096 | text | visible-default | "634 salah", fa-times-circle | FN-M18-3.1.8 |
| EL-M18-S10-097 | text | visible-default | "Bahasa Inggeris" | FN-M18-3.1.8 |
| EL-M18-S10-098 | text | visible-default | "71.9%" | FN-M18-3.1.8 |
| EL-M18-S10-099 | text | visible-default | "29 pelajar", fa-users | FN-M18-3.1.8 |
| EL-M18-S10-100 | text | visible-default | "851 soalan", fa-list-check | FN-M18-3.1.8 |
| EL-M18-S10-101 | text | visible-default | "539 salah", fa-times-circle | FN-M18-3.1.8 |
| EL-M18-S10-102 | text | visible-default | "Matematik" | FN-M18-3.1.8 |
| EL-M18-S10-103 | text | visible-default | "72.6%" | FN-M18-3.1.8 |
| EL-M18-S10-104 | text | visible-default | "37 pelajar", fa-users | FN-M18-3.1.8 |
| EL-M18-S10-105 | text | visible-default | "828 soalan", fa-list-check | FN-M18-3.1.8 |
| EL-M18-S10-106 | text | visible-default | "631 salah", fa-times-circle | FN-M18-3.1.8 |
| EL-M18-S10-107 | text | visible-default | "Pendidikan Islam" | FN-M18-3.1.8 |
| EL-M18-S10-108 | text | visible-default | "92.3%" | FN-M18-3.1.8 |
| EL-M18-S10-109 | text | visible-default | "1 pelajar", fa-users | FN-M18-3.1.8 |
| EL-M18-S10-110 | text | visible-default | "50 soalan", fa-list-check | FN-M18-3.1.8 |
| EL-M18-S10-111 | text | visible-default | "4 salah", fa-times-circle | FN-M18-3.1.8 |
| EL-M18-S10-112 | card | visible-default | "Kombo Latihan — Gambaran Negeri" | FN-M18-3.1.9 |
| EL-M18-S10-113 | heading | visible-default | "Kombo Latihan — Gambaran Negeri" | FN-M18-3.1.9 |
| EL-M18-S10-114 | text | visible-default | "Penglibatan harian pelajar merentasi sekolah dalam negeri" | FN-M18-3.1.9 |
| EL-M18-S10-115 | text | visible-default | "81" | FN-M18-3.1.9 |
| EL-M18-S10-116 | text | visible-default | "Kombo Aktif" | FN-M18-3.1.9 |
| EL-M18-S10-117 | text | visible-default | "135" | FN-M18-3.1.9 |
| EL-M18-S10-118 | text | visible-default | "Jumlah Pelajar" | FN-M18-3.1.9 |
| EL-M18-S10-119 | text | visible-default | "7.2" | FN-M18-3.1.9 |
| EL-M18-S10-120 | text | visible-default | "Purata Kombo" | FN-M18-3.1.9 |
| EL-M18-S10-121 | text | visible-default | "0" | FN-M18-3.1.9 |
| EL-M18-S10-122 | text | visible-default | "Berlatih Hari Ini" | FN-M18-3.1.9 |
| EL-M18-S10-123 | table | visible-default | table | FN-M18-3.1.9 |
| EL-M18-S10-124 | text | visible-default | "Menunjukkan 1–20 daripada 1189 sekolah" | FN-M18-1.3.4 |
| EL-M18-S10-125 | button | visible-default | button, fa-chevron-left | FN-M18-1.3.4 |
| EL-M18-S10-126 | button | visible-default | "1" | FN-M18-1.3.4 |
| EL-M18-S10-127 | button | visible-default | "2" | FN-M18-1.3.4 |
| EL-M18-S10-128 | text | visible-default | "…" | FN-M18-1.3.4 |
| EL-M18-S10-129 | button | visible-default | "60" | FN-M18-1.3.4 |
| EL-M18-S10-130 | button | visible-default | button, fa-chevron-right | FN-M18-1.3.4 |
| EL-M18-S10-131 | card | visible-default | "Tahap Penguasaan — Taburan Negeri" | FN-M18-3.1.10 |
| EL-M18-S10-132 | heading | visible-default | "Tahap Penguasaan — Taburan Negeri" | FN-M18-3.1.10 |
| EL-M18-S10-133 | text | visible-default | "Taburan tahap penguasaan pelajar merentasi negeri" | FN-M18-3.1.10 |
| EL-M18-S10-134 | text | visible-default | "Pemula" | FN-M18-3.1.10 |
| EL-M18-S10-135 | text | visible-default | "14" | FN-M18-3.1.10 |
| EL-M18-S10-136 | text | visible-default | "(116.7%)" | FN-M18-3.1.10 |
| EL-M18-S10-137 | text | visible-default | "Mula Belajar" | FN-M18-3.1.10 |
| EL-M18-S10-138 | text | visible-default | "20" | FN-M18-3.1.10 |
| EL-M18-S10-139 | text | visible-default | "(166.7%)" | FN-M18-3.1.10 |
| EL-M18-S10-140 | text | visible-default | "Aktif" | FN-M18-3.1.10 |
| EL-M18-S10-141 | text | visible-default | "4" | FN-M18-3.1.10 |
| EL-M18-S10-142 | text | visible-default | "(33.3%)" | FN-M18-3.1.10 |
| EL-M18-S10-143 | text | visible-default | "Tekun" | FN-M18-3.1.10 |
| EL-M18-S10-144 | text | visible-default | "0" | FN-M18-3.1.10 |
| EL-M18-S10-145 | text | visible-default | "(0%)" | FN-M18-3.1.10 |
| EL-M18-S10-146 | text | visible-default | "Mahir" | FN-M18-3.1.10 |
| EL-M18-S10-147 | text | visible-default | "0" | FN-M18-3.1.10 |
| EL-M18-S10-148 | text | visible-default | "(0%)" | FN-M18-3.1.10 |
| EL-M18-S10-149 | text | visible-default | "Pakar Muda" | FN-M18-3.1.10 |
| EL-M18-S10-150 | text | visible-default | "0" | FN-M18-3.1.10 |
| EL-M18-S10-151 | text | visible-default | "(0%)" | FN-M18-3.1.10 |
| EL-M18-S10-152 | text | visible-default | "Cemerlang" | FN-M18-3.1.10 |
| EL-M18-S10-153 | text | visible-default | "0" | FN-M18-3.1.10 |
| EL-M18-S10-154 | text | visible-default | "(0%)" | FN-M18-3.1.10 |
| EL-M18-S10-155 | text | visible-default | "Master" | FN-M18-3.1.10 |
| EL-M18-S10-156 | text | visible-default | "0" | FN-M18-3.1.10 |
| EL-M18-S10-157 | text | visible-default | "(0%)" | FN-M18-3.1.10 |
| EL-M18-S10-158 | text | visible-default | "Grandmaster" | FN-M18-3.1.10 |
| EL-M18-S10-159 | text | visible-default | "0" | FN-M18-3.1.10 |
| EL-M18-S10-160 | text | visible-default | "(0%)" | FN-M18-3.1.10 |
| EL-M18-S10-161 | text | visible-default | "Legend" | FN-M18-3.1.10 |
| EL-M18-S10-162 | text | visible-default | "0" | FN-M18-3.1.10 |
| EL-M18-S10-163 | text | visible-default | "(0%)" | FN-M18-3.1.10 |
| EL-M18-S10-164 | text | visible-default | "Mythical" | FN-M18-3.1.10 |
| EL-M18-S10-165 | text | visible-default | "0" | FN-M18-3.1.10 |
| EL-M18-S10-166 | text | visible-default | "(0%)" | FN-M18-3.1.10 |
| EL-M18-S10-167 | table | visible-default | table | FN-M18-3.1.10 |
| EL-M18-S10-168 | text | visible-default | "Menunjukkan 1–20 daripada 1189 sekolah" | FN-M18-1.3.4 |
| EL-M18-S10-169 | button | visible-default | button, fa-chevron-left | FN-M18-1.3.4 |
| EL-M18-S10-170 | button | visible-default | "1" | FN-M18-1.3.4 |
| EL-M18-S10-171 | button | visible-default | "2" | FN-M18-1.3.4 |
| EL-M18-S10-172 | text | visible-default | "…" | FN-M18-1.3.4 |
| EL-M18-S10-173 | button | visible-default | "60" | FN-M18-1.3.4 |
| EL-M18-S10-174 | button | visible-default | button, fa-chevron-right | FN-M18-1.3.4 |
| EL-M18-S10-175 | card | visible-default | "Pembetulan — Gambaran Negeri" | FN-M18-3.1.11 |
| EL-M18-S10-176 | heading | visible-default | "Pembetulan — Gambaran Negeri" | FN-M18-3.1.11 |
| EL-M18-S10-177 | text | visible-default | "Kadar pembetulan pelajar untuk September 2026" | FN-M18-3.1.11 |
| EL-M18-S10-178 | text | visible-default | "135" | FN-M18-3.1.11 |
| EL-M18-S10-179 | text | visible-default | "Jumlah Pelajar" | FN-M18-3.1.11 |
| EL-M18-S10-180 | text | visible-default | "0" | FN-M18-3.1.11 |
| EL-M18-S10-181 | text | visible-default | "Jumlah Pembetulan" | FN-M18-3.1.11 |
| EL-M18-S10-182 | text | visible-default | "0.0%" | FN-M18-3.1.11 |
| EL-M18-S10-183 | text | visible-default | "Kadar Purata" | FN-M18-3.1.11 |
| EL-M18-S10-184 | table | visible-default | table | FN-M18-3.1.11 |
| EL-M18-S10-185 | text | visible-default | "Menunjukkan 1–20 daripada 1189 sekolah" | FN-M18-1.3.4 |
| EL-M18-S10-186 | button | visible-default | button, fa-chevron-left | FN-M18-1.3.4 |
| EL-M18-S10-187 | button | visible-default | "1" | FN-M18-1.3.4 |
| EL-M18-S10-188 | button | visible-default | "2" | FN-M18-1.3.4 |
| EL-M18-S10-189 | text | visible-default | "…" | FN-M18-1.3.4 |
| EL-M18-S10-190 | button | visible-default | "60" | FN-M18-1.3.4 |
| EL-M18-S10-191 | button | visible-default | button, fa-chevron-right | FN-M18-1.3.4 |
| EL-M18-S10-192 | card | visible-default | "Laporan Terperinci" | FN-M18-3.1.12 |
| EL-M18-S10-193 | heading | visible-default | "Laporan Terperinci" | FN-M18-3.1.12 |
| EL-M18-S10-194 | text | visible-default | "Akses laporan mendalam untuk setiap modul" | FN-M18-3.1.12 |
| EL-M18-S10-195 | link | visible-default | "Statistik Penggunaan", → /jpn/statistik-penggunaan, fa-chart-pie | FN-M18-3.1.12 |
| EL-M18-S10-196 | link | visible-default | "Amaran Awal", → /amaran/jpn, fa-bell | FN-M18-3.1.12 |
| EL-M18-S10-197 | link | visible-default | "Analisa Item", → /analisa-item/jpn, fa-chart-bar | FN-M18-3.1.12 |
| EL-M18-S10-198 | link | visible-default | "Kombo Harian", → /kombo/jpn, fa-fire | FN-M18-3.1.12 |
| EL-M18-S10-199 | text | conditional | "479 sekolah dijumpai" | FN-M18-3.1.3 |
| EL-M18-S10-200 | button | conditional | "6" | FN-M18-3.1.3 |
| EL-M18-S10-201 | button | conditional | "6" | FN-M18-3.1.3 |
| EL-M18-S10-202 | button | conditional | "6" | FN-M18-3.1.3 |
| EL-M18-S10-203 | button | conditional | "6" | FN-M18-3.1.3 |
| EL-M18-S10-204 | text | conditional | "0 sekolah dijumpai" | FN-M18-3.1.3 |
| EL-M18-S10-205 | empty-state | conditional | "Tiada sekolah dijumpai" | FN-M18-3.1.3 |
| EL-M18-S10-206 | empty-state | conditional | "Tiada sekolah dijumpai" | FN-M18-3.1.3 |
| EL-M18-S10-207 | empty-state | conditional | "Tiada sekolah dijumpai" | FN-M18-3.1.3 |
| EL-M18-S10-208 | empty-state | conditional | "Tiada sekolah dijumpai" | FN-M18-3.1.3 |
| EL-M18-S10-209 | empty-state | conditional | "Tiada sekolah dijumpai" | FN-M18-3.1.3 |
| EL-M18-S10-210 | text | conditional | "43 sekolah dijumpai" | FN-M18-3.1.3 |
| EL-M18-S10-211 | text | conditional | "Menunjukkan 1–10 daripada 10 sekolah" | FN-M18-3.1.3 |
| EL-M18-S10-212 | text | conditional | "Menunjukkan 1–3 daripada 3 sekolah" | FN-M18-3.1.3 |
| EL-M18-S10-213 | text | conditional | "Menunjukkan 1–10 daripada 10 sekolah" | FN-M18-3.1.3 |
| EL-M18-S10-214 | text | conditional | "Menunjukkan 1–10 daripada 10 sekolah" | FN-M18-3.1.3 |
| EL-M18-S10-215 | text | conditional | "Menunjukkan 1–10 daripada 10 sekolah" | FN-M18-3.1.3 |

#### S11 — `/jpn/command-center` (44 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M18-S11-001 | link | visible-default | "← Dashboard", → /jpn/dashboard | FN-M18-3.2.1 |
| EL-M18-S11-002 | heading | visible-default | "Command Center JPN" | FN-M18-3.2.1 |
| EL-M18-S11-003 | badge | visible-default | "Johor" | FN-M18-3.2.1 |
| EL-M18-S11-004 | text | visible-default | "LIVE" | FN-M18-3.2.1 |
| EL-M18-S11-005 | text | visible-default | "12:23:20" | FN-M18-3.2.1 |
| EL-M18-S11-006 | text | visible-default | "MYT" | FN-M18-3.2.1 |
| EL-M18-S11-007 | text | visible-default | "Sekolah Aktif" | FN-M18-3.2.2 |
| EL-M18-S11-008 | text | visible-default | "1,187" | FN-M18-3.2.2 |
| EL-M18-S11-009 | text | visible-default | "dari 1187 sekolah negeri" | FN-M18-3.2.2 |
| EL-M18-S11-010 | text | visible-default | "Pelajar Berdaftar" | FN-M18-3.2.2 |
| EL-M18-S11-011 | text | visible-default | "72" | FN-M18-3.2.2 |
| EL-M18-S11-012 | text | visible-default | "aktif menjawab" | FN-M18-3.2.2 |
| EL-M18-S11-013 | text | visible-default | "6" | FN-M18-3.2.2 |
| EL-M18-S11-014 | text | visible-default | "Soalan Dijawab" | FN-M18-3.2.2 |
| EL-M18-S11-015 | text | visible-default | "NaN" | FN-M18-3.2.2 |
| EL-M18-S11-016 | text | visible-default | "sepanjang masa" | FN-M18-3.2.2 |
| EL-M18-S11-017 | text | visible-default | "Ketepatan Purata" | FN-M18-3.2.2 |
| EL-M18-S11-018 | text | visible-default | "83.8%" | FN-M18-3.2.2 |
| EL-M18-S11-019 | text | visible-default | "keseluruhan negeri" | FN-M18-3.2.2 |
| EL-M18-S11-020 | text | visible-default | "Top Sekolah Aktif" | FN-M18-3.2.3 |
| EL-M18-S11-021 | text | visible-default | "🏆" | FN-M18-3.2.3 |
| EL-M18-S11-022 | text | visible-default | "1" | FN-M18-3.2.3 |
| EL-M18-S11-023 | link | visible-default | "undefined", → /jpn/sekolah/undefined | FN-M18-3.2.3 |
| EL-M18-S11-024 | text | visible-default | "6 plj" | FN-M18-3.2.3 |
| EL-M18-S11-025 | text | visible-default | "ALESA AI" | FN-M18-3.2.4 |
| EL-M18-S11-026 | text | visible-default | "🤖" | FN-M18-3.2.4 |
| EL-M18-S11-027 | text | visible-default | "Memuatkan wawasan..." | FN-M18-3.2.4 |
| EL-M18-S11-028 | card | visible-default | "0" | FN-M18-3.2.5 |
| EL-M18-S11-029 | text | visible-default | "Aktiviti Hari Ini" | FN-M18-3.2.5 |
| EL-M18-S11-030 | text | visible-default | "📈" | FN-M18-3.2.5 |
| EL-M18-S11-031 | text | visible-default | "0 soalan" | FN-M18-3.2.5 |
| EL-M18-S11-032 | text | visible-default | "Minggu ini:" | FN-M18-3.2.5 |
| EL-M18-S11-033 | text | visible-default | "0" | FN-M18-3.2.5 |
| EL-M18-S11-034 | text | visible-default | "Sama dengan minggu lepas" | FN-M18-3.2.5 |
| EL-M18-S11-035 | text | visible-default | "Live Feed" | FN-M18-3.2.6 |
| EL-M18-S11-036 | text | visible-default | "⚡" | FN-M18-3.2.6 |
| EL-M18-S11-037 | text | visible-default | "Top Pelajar Minggu Ini" | FN-M18-3.2.7 |
| EL-M18-S11-038 | text | visible-default | "⭐" | FN-M18-3.2.7 |
| EL-M18-S11-039 | empty-state | visible-default | "Tiada data" | FN-M18-3.2.7 |
| EL-M18-S11-040 | text | visible-default | "Pecahan Daerah" | FN-M18-3.2.8 |
| EL-M18-S11-041 | text | visible-default | "🏢" | FN-M18-3.2.8 |
| EL-M18-S11-042 | text | visible-default | "Powered by ALESA AI · PrestasiPlus © 2026 · Data dikemaskini setiap 10 saat" | FN-M18-3.2.9 |
| EL-M18-S11-043 | text | conditional | "12:23:23" | FN-M18-3.2.1 |
| EL-M18-S11-044 | text | conditional | "12:23:27" | FN-M18-3.2.1 |

#### S12 — `/jpn/statistik-penggunaan` (18 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M18-S12-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S12-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S12-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S12-004 | link | visible-default | "Dashboard JPN", → /jpn/dashboard, fa-arrow-left | FN-M18-3.3.1 |
| EL-M18-S12-005 | text | visible-default | "/" | FN-M18-3.3.1 |
| EL-M18-S12-006 | text | visible-default | "Statistik Penggunaan" | FN-M18-3.3.1 |
| EL-M18-S12-007 | card | visible-default | "JPN Johor" | FN-M18-3.3.1 |
| EL-M18-S12-008 | heading | visible-default | "JPN Johor" | FN-M18-3.3.1 |
| EL-M18-S12-009 | text | visible-default | "Statistik Penggunaan PRESTASIPLUS Seluruh Negeri" | FN-M18-3.3.1 |
| EL-M18-S12-010 | text | visible-default | "0" | FN-M18-3.3.1 |
| EL-M18-S12-011 | text | visible-default | "Daerah" | FN-M18-3.3.1 |
| EL-M18-S12-012 | text | visible-default | "0" | FN-M18-3.3.1 |
| EL-M18-S12-013 | text | visible-default | "Sekolah" | FN-M18-3.3.1 |
| EL-M18-S12-014 | text | visible-default | "0" | FN-M18-3.3.1 |
| EL-M18-S12-015 | text | visible-default | "Pelajar" | FN-M18-3.3.1 |
| EL-M18-S12-016 | card | visible-default | "Data belum tersedia" | FN-M18-3.3.2 |
| EL-M18-S12-017 | text | visible-default | "Data belum tersedia" | FN-M18-3.3.2 |
| EL-M18-S12-018 | text | visible-default | "Data ranking dikemas kini setiap hari. Sila semak semula esok." | FN-M18-3.3.2 |

#### S13 — `/jpn/ranking-kebangsaan` (40 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M18-S13-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S13-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S13-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S13-004 | link | visible-default | "Dashboard JPN", → /jpn/dashboard, fa-arrow-left | FN-M18-3.4.1 |
| EL-M18-S13-005 | text | visible-default | "/" | FN-M18-3.4.1 |
| EL-M18-S13-006 | text | visible-default | "Ranking Kebangsaan" | FN-M18-3.4.1 |
| EL-M18-S13-007 | card | visible-default | "Ranking Kebangsaan" | FN-M18-3.4.1 |
| EL-M18-S13-008 | heading | visible-default | "Ranking Kebangsaan" | FN-M18-3.4.1 |
| EL-M18-S13-009 | text | visible-default | "1 Malaysia" | FN-M18-3.4.1 |
| EL-M18-S13-010 | text | visible-default | "Ranking PPD & Sekolah merentas seluruh Malaysia · 30 Hari" | FN-M18-3.4.1 |
| EL-M18-S13-011 | text | visible-default | "2" | FN-M18-3.4.1 |
| EL-M18-S13-012 | text | visible-default | "PPD Aktif" | FN-M18-3.4.1 |
| EL-M18-S13-013 | text | visible-default | "7" | FN-M18-3.4.1 |
| EL-M18-S13-014 | text | visible-default | "Sekolah Aktif" | FN-M18-3.4.1 |
| EL-M18-S13-015 | link | visible-default | "Hari Ini", → /jpn/ranking-kebangsaan?period=today, fa-calendar-day | FN-M18-1.3.2 |
| EL-M18-S13-016 | link | visible-default | "7 Hari", → /jpn/ranking-kebangsaan?period=7days, fa-calendar-week | FN-M18-1.3.2 |
| EL-M18-S13-017 | link | visible-default | "30 Hari", → /jpn/ranking-kebangsaan?period=30days, fa-calendar | FN-M18-1.3.2 |
| EL-M18-S13-018 | card | visible-default | "Ranking PPD — 1 Malaysia" | FN-M18-3.4.2 |
| EL-M18-S13-019 | heading | visible-default | "Ranking PPD — 1 Malaysia" | FN-M18-3.4.2 |
| EL-M18-S13-020 | text | visible-default | "2 PPD aktif · 30 Hari — berdasarkan jumlah jawapan betul" | FN-M18-3.4.2 |
| EL-M18-S13-021 | table | visible-default | table | FN-M18-3.4.2 |
| EL-M18-S13-022 | badge | visible-default | "87.0%" | FN-M18-3.4.2 |
| EL-M18-S13-023 | badge | visible-default | "60.0%" | FN-M18-3.4.2 |
| EL-M18-S13-024 | card | visible-default | "Top 50 Sekolah — 1 Malaysia" | FN-M18-3.4.3 |
| EL-M18-S13-025 | heading | visible-default | "Top 50 Sekolah — 1 Malaysia" | FN-M18-3.4.3 |
| EL-M18-S13-026 | text | visible-default | "Berdasarkan jumlah jawapan betul · 30 Hari" | FN-M18-3.4.3 |
| EL-M18-S13-027 | table | visible-default | table | FN-M18-3.4.3 |
| EL-M18-S13-028 | link | visible-default | "SEKOLAH MENENGAH KEBANGSAAN ENGKU HUSAIN", → /jpn/sekolah/8082 | FN-M18-3.4.3 |
| EL-M18-S13-029 | badge | visible-default | "90.8%" | FN-M18-3.4.3 |
| EL-M18-S13-030 | text | conditional | "Ranking PPD & Sekolah merentas seluruh Malaysia · 7 Hari" | FN-M18-3.4.4 |
| EL-M18-S13-031 | text | conditional | "2 PPD aktif · 7 Hari — berdasarkan jumlah jawapan betul" | FN-M18-3.4.4 |
| EL-M18-S13-032 | badge | conditional | "83.6%" | FN-M18-3.4.4 |
| EL-M18-S13-033 | text | conditional | "Berdasarkan jumlah jawapan betul · 7 Hari" | FN-M18-3.4.4 |
| EL-M18-S13-034 | link | conditional | "SEKOLAH MENENGAH KEBANGSAAN KHIR JOHARI", → /jpn/sekolah/8080 | FN-M18-3.4.4 |
| EL-M18-S13-035 | badge | conditional | "86.2%" | FN-M18-3.4.4 |
| EL-M18-S13-036 | text | conditional | "Ranking PPD & Sekolah merentas seluruh Malaysia · Hari Ini" | FN-M18-3.4.4 |
| EL-M18-S13-037 | text | conditional | "1 PPD aktif · Hari Ini — berdasarkan jumlah jawapan betul" | FN-M18-3.4.4 |
| EL-M18-S13-038 | badge | conditional | "95.0%" | FN-M18-3.4.4 |
| EL-M18-S13-039 | text | conditional | "Berdasarkan jumlah jawapan betul · Hari Ini" | FN-M18-3.4.4 |
| EL-M18-S13-040 | badge | conditional | "95.0%" | FN-M18-3.4.4 |

#### S14 — `/jpn/daerah/{ppd}` (24 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M18-S14-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S14-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S14-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S14-004 | link | visible-default | "Statistik Negeri", → /jpn/statistik-penggunaan, fa-arrow-left | FN-M18-3.3.3 |
| EL-M18-S14-005 | text | visible-default | "/" | FN-M18-3.3.3 |
| EL-M18-S14-006 | text | visible-default | "PPD KLUANG" | FN-M18-3.3.3 |
| EL-M18-S14-007 | card | visible-default | "PPD KLUANG" | FN-M18-3.3.3 |
| EL-M18-S14-008 | heading | visible-default | "PPD KLUANG" | FN-M18-3.3.3 |
| EL-M18-S14-009 | text | visible-default | "Johor" | FN-M18-3.3.3 |
| EL-M18-S14-010 | text | visible-default | "Statistik Penggunaan PRESTASIPLUS Dalam Daerah" | FN-M18-3.3.3 |
| EL-M18-S14-011 | text | visible-default | "0" | FN-M18-3.3.3 |
| EL-M18-S14-012 | text | visible-default | "Sekolah" | FN-M18-3.3.3 |
| EL-M18-S14-013 | text | visible-default | "0" | FN-M18-3.3.3 |
| EL-M18-S14-014 | text | visible-default | "Pelajar Aktif" | FN-M18-3.3.3 |
| EL-M18-S14-015 | card | visible-default | "Data belum tersedia" | FN-M18-3.3.2 |
| EL-M18-S14-016 | text | visible-default | "Data belum tersedia" | FN-M18-3.3.2 |
| EL-M18-S14-017 | text | visible-default | "Data ranking dikemas kini setiap hari. Sila semak semula esok." | FN-M18-3.3.2 |
| EL-M18-S14-018 | text | conditional | "404" | FN-M18-1.2.7 |
| EL-M18-S14-019 | text | conditional | "🔍" | FN-M18-1.2.7 |
| EL-M18-S14-020 | heading | conditional | "Halaman Tidak Dijumpai" | FN-M18-1.2.7 |
| EL-M18-S14-021 | text | conditional | "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL sal …" | FN-M18-1.2.7 |
| EL-M18-S14-022 | link | conditional | "Halaman Utama", → / | FN-M18-1.2.7 |
| EL-M18-S14-023 | link | conditional | "Mula Latihan", → /latih-tubi | FN-M18-1.2.7 |
| EL-M18-S14-024 | text | conditional | "PRESTASIPLUS" | FN-M18-1.2.7 |

#### S15 — `/jpn/sekolah/{id}` (229 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M18-S15-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S15-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S15-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S15-004 | link | visible-default | "PPD KLUANG", → /jpn/daerah/PPD%20KLUANG, fa-arrow-left | FN-M18-2.9.1 |
| EL-M18-S15-005 | text | visible-default | "/" | FN-M18-2.9.1 |
| EL-M18-S15-006 | text | visible-default | "SEKOLAH MENENGAH KEBANGSAAN LAYANG-LAYANG" | FN-M18-2.9.1 |
| EL-M18-S15-007 | card | visible-default | "SEKOLAH MENENGAH KEBANGSAAN LAYANG-LAYANG" | FN-M18-2.9.2 |
| EL-M18-S15-008 | heading | visible-default | "SEKOLAH MENENGAH KEBANGSAAN LAYANG-LAYANG" | FN-M18-2.9.2 |
| EL-M18-S15-009 | text | visible-default | "JEA2029" | FN-M18-2.9.2 |
| EL-M18-S15-010 | text | visible-default | "PPD KLUANG", fa-map-marker-alt | FN-M18-2.9.2 |
| EL-M18-S15-011 | text | visible-default | "\|" | FN-M18-2.9.2 |
| EL-M18-S15-012 | text | visible-default | "Johor", fa-flag | FN-M18-2.9.2 |
| EL-M18-S15-013 | text | visible-default | "\|" | FN-M18-2.9.2 |
| EL-M18-S15-014 | text | visible-default | "SMK", fa-tag | FN-M18-2.9.2 |
| EL-M18-S15-015 | text | visible-default | "21" | FN-M18-2.9.2 |
| EL-M18-S15-016 | text | visible-default | "Pelajar" | FN-M18-2.9.2 |
| EL-M18-S15-017 | text | visible-default | "9.5%" | FN-M18-2.9.2 |
| EL-M18-S15-018 | text | visible-default | "Penggunaan" | FN-M18-2.9.2 |
| EL-M18-S15-019 | text | visible-default | "0" | FN-M18-2.9.2 |
| EL-M18-S15-020 | text | visible-default | "Aktif 7 Hari" | FN-M18-2.9.2 |
| EL-M18-S15-021 | card | visible-default | "Tingkatan / Darjah" | FN-M18-2.9.3 |
| EL-M18-S15-022 | form | visible-default | form | FN-M18-2.9.3 |
| EL-M18-S15-023 | label | visible-default | "Tingkatan / Darjah" | FN-M18-2.9.3 |
| EL-M18-S15-024 | select | visible-default | select, name=grade, 6 options | FN-M18-2.9.3 |
| EL-M18-S15-025 | label | visible-default | "Kelas" | FN-M18-2.9.3 |
| EL-M18-S15-026 | select | visible-default | select, name=class_id, 1 options | FN-M18-2.9.3 |
| EL-M18-S15-027 | label | visible-default | "Subjek" | FN-M18-2.9.3 |
| EL-M18-S15-028 | select | visible-default | select, name=subject_id, 10 options | FN-M18-2.9.3 |
| EL-M18-S15-029 | button | visible-default | "Tapis", fa-filter | FN-M18-2.9.3 |
| EL-M18-S15-030 | card | visible-default | "Jumlah Pelajar" | FN-M18-2.9.4 |
| EL-M18-S15-031 | text | visible-default | "Jumlah Pelajar" | FN-M18-2.9.4 |
| EL-M18-S15-032 | text | visible-default | "21" | FN-M18-2.9.4 |
| EL-M18-S15-033 | card | visible-default | "Sudah Guna" | FN-M18-2.9.4 |
| EL-M18-S15-034 | text | visible-default | "Sudah Guna" | FN-M18-2.9.4 |
| EL-M18-S15-035 | text | visible-default | "2" | FN-M18-2.9.4 |
| EL-M18-S15-036 | text | visible-default | "Pelajar yang telah menjawab" | FN-M18-2.9.4 |
| EL-M18-S15-037 | card | visible-default | "Belum Guna" | FN-M18-2.9.4 |
| EL-M18-S15-038 | text | visible-default | "Belum Guna" | FN-M18-2.9.4 |
| EL-M18-S15-039 | text | visible-default | "19" | FN-M18-2.9.4 |
| EL-M18-S15-040 | text | visible-default | "Belum pernah menjawab soalan" | FN-M18-2.9.4 |
| EL-M18-S15-041 | card | visible-default | "% Penggunaan" | FN-M18-2.9.4 |
| EL-M18-S15-042 | text | visible-default | "% Penggunaan" | FN-M18-2.9.4 |
| EL-M18-S15-043 | text | visible-default | "9.5%" | FN-M18-2.9.4 |
| EL-M18-S15-044 | card | visible-default | "Aktif 7 Hari" | FN-M18-2.9.4 |
| EL-M18-S15-045 | text | visible-default | "Aktif 7 Hari" | FN-M18-2.9.4 |
| EL-M18-S15-046 | text | visible-default | "0" | FN-M18-2.9.4 |
| EL-M18-S15-047 | text | visible-default | "Latihan dalam 7 hari lepas" | FN-M18-2.9.4 |
| EL-M18-S15-048 | card | visible-default | "Purata Sesi / Pelajar" | FN-M18-2.9.4 |
| EL-M18-S15-049 | text | visible-default | "Purata Sesi / Pelajar" | FN-M18-2.9.4 |
| EL-M18-S15-050 | text | visible-default | "10.5" | FN-M18-2.9.4 |
| EL-M18-S15-051 | text | visible-default | "sesi per pelajar aktif" | FN-M18-2.9.4 |
| EL-M18-S15-052 | clickable | hidden-only | clickable | FN-M18-2.9.5 |
| EL-M18-S15-053 | link | visible-default | "Bulanan", → #sec-bulanan | FN-M18-2.9.5 |
| EL-M18-S15-054 | link | visible-default | "Kalendar", → #sec-kalendar | FN-M18-2.9.5 |
| EL-M18-S15-055 | link | visible-default | "Subjek", → #sec-subjek | FN-M18-2.9.5 |
| EL-M18-S15-056 | link | visible-default | "Ranking", → #sec-ranking | FN-M18-2.9.5 |
| EL-M18-S15-057 | link | visible-default | "Kelas", → #sec-kelas | FN-M18-2.9.5 |
| EL-M18-S15-058 | link | visible-default | "Pelajar", → #sec-pelajar | FN-M18-2.9.5 |
| EL-M18-S15-059 | link | visible-default | "Guru", → #sec-guru | FN-M18-2.9.5 |
| EL-M18-S15-060 | card | visible-default | "Statistik Bulanan" | FN-M18-2.9.6 |
| EL-M18-S15-061 | heading | visible-default | "Statistik Bulanan" | FN-M18-2.9.6 |
| EL-M18-S15-062 | text | visible-default | "12 bulan terakhir — pecahan prestasi mengikut bulan" | FN-M18-2.9.6 |
| EL-M18-S15-063 | table | visible-default | table | FN-M18-2.9.6 |
| EL-M18-S15-064 | card | visible-default | "Kalendar Aktiviti Harian" | FN-M18-2.9.7 |
| EL-M18-S15-065 | heading | visible-default | "Kalendar Aktiviti Harian" | FN-M18-2.9.7 |
| EL-M18-S15-066 | text | visible-default | "365 hari — semakin gelap, semakin ramai pelajar aktif" | FN-M18-2.9.7 |
| EL-M18-S15-067 | text | visible-default | "16" | FN-M18-2.9.7 |
| EL-M18-S15-068 | text | visible-default | "Hari Aktif" | FN-M18-2.9.7 |
| EL-M18-S15-069 | text | visible-default | "186" | FN-M18-2.9.7 |
| EL-M18-S15-070 | text | visible-default | "Jumlah Betul" | FN-M18-2.9.7 |
| EL-M18-S15-071 | text | visible-default | "12" | FN-M18-2.9.7 |
| EL-M18-S15-072 | text | visible-default | "Purata/Hari" | FN-M18-2.9.7 |
| EL-M18-S15-073 | text | visible-default | "Sep" | FN-M18-2.9.7 |
| EL-M18-S15-074 | text | visible-default | "Okt" | FN-M18-2.9.7 |
| EL-M18-S15-075 | text | visible-default | "Nov" | FN-M18-2.9.7 |
| EL-M18-S15-076 | text | visible-default | "Dis" | FN-M18-2.9.7 |
| EL-M18-S15-077 | text | visible-default | "Jan" | FN-M18-2.9.7 |
| EL-M18-S15-078 | text | visible-default | "Feb" | FN-M18-2.9.7 |
| EL-M18-S15-079 | text | visible-default | "Mac" | FN-M18-2.9.7 |
| EL-M18-S15-080 | text | visible-default | "Apr" | FN-M18-2.9.7 |
| EL-M18-S15-081 | text | visible-default | "Mei" | FN-M18-2.9.7 |
| EL-M18-S15-082 | text | visible-default | "Jun" | FN-M18-2.9.7 |
| EL-M18-S15-083 | text | visible-default | "Jul" | FN-M18-2.9.7 |
| EL-M18-S15-084 | text | visible-default | "Ogs" | FN-M18-2.9.7 |
| EL-M18-S15-085 | text | visible-default | "Sep" | FN-M18-2.9.7 |
| EL-M18-S15-086 | text | visible-default | "Isn" | FN-M18-2.9.7 |
| EL-M18-S15-087 | text | visible-default | "Rab" | FN-M18-2.9.7 |
| EL-M18-S15-088 | text | visible-default | "Jum" | FN-M18-2.9.7 |
| EL-M18-S15-089 | text | visible-default | "Ahd" | FN-M18-2.9.7 |
| EL-M18-S15-090 | tooltip | visible-default | "2025-09-27: 0 pelajar aktif, 0 betul" | FN-M18-2.9.7 |
| EL-M18-S15-091 | tooltip | visible-default | "2025-09-28: 0 pelajar aktif, 0 betul" | FN-M18-2.9.7 |
| EL-M18-S15-092 | tooltip | visible-default | "2025-09-29: 0 pelajar aktif, 0 betul" | FN-M18-2.9.7 |
| EL-M18-S15-093 | text | visible-default | "Kurang" | FN-M18-2.9.7 |
| EL-M18-S15-094 | text | visible-default | "Lebih" | FN-M18-2.9.7 |
| EL-M18-S15-095 | heading | visible-default | "Laporan Subjek" | FN-M18-2.9.8 |
| EL-M18-S15-096 | text | visible-default | "Pecahan prestasi mengikut subjek — ketepatan sebelum & selepas pembetulan" | FN-M18-2.9.8 |
| EL-M18-S15-097 | card | visible-default | "Matematik" | FN-M18-2.9.8 |
| EL-M18-S15-098 | heading | visible-default | "Matematik" | FN-M18-2.9.8 |
| EL-M18-S15-099 | text | visible-default | "MATH" | FN-M18-2.9.8 |
| EL-M18-S15-100 | text | visible-default | "6" | FN-M18-2.9.8 |
| EL-M18-S15-101 | text | visible-default | "Pelajar" | FN-M18-2.9.8 |
| EL-M18-S15-102 | text | visible-default | "184" | FN-M18-2.9.8 |
| EL-M18-S15-103 | text | visible-default | "Soalan" | FN-M18-2.9.8 |
| EL-M18-S15-104 | text | visible-default | "45.6%" | FN-M18-2.9.8 |
| EL-M18-S15-105 | text | visible-default | "Accuracy" | FN-M18-2.9.8 |
| EL-M18-S15-106 | text | visible-default | "Sebelum" | FN-M18-2.9.8 |
| EL-M18-S15-107 | text | visible-default | "77.3%" | FN-M18-2.9.8 |
| EL-M18-S15-108 | text | visible-default | "Selepas" | FN-M18-2.9.8 |
| EL-M18-S15-109 | text | visible-default | "77.3%" | FN-M18-2.9.8 |
| EL-M18-S15-110 | text | visible-default | "Purata Level" | FN-M18-2.9.8 |
| EL-M18-S15-111 | text | visible-default | "0.7", fa-layer-group | FN-M18-2.9.8 |
| EL-M18-S15-112 | card | visible-default | "Kimia" | FN-M18-2.9.8 |
| EL-M18-S15-113 | heading | visible-default | "Kimia" | FN-M18-2.9.8 |
| EL-M18-S15-114 | text | visible-default | "CHEM" | FN-M18-2.9.8 |
| EL-M18-S15-115 | text | visible-default | "5" | FN-M18-2.9.8 |
| EL-M18-S15-116 | text | visible-default | "Pelajar" | FN-M18-2.9.8 |
| EL-M18-S15-117 | text | visible-default | "142" | FN-M18-2.9.8 |
| EL-M18-S15-118 | text | visible-default | "Soalan" | FN-M18-2.9.8 |
| EL-M18-S15-119 | text | visible-default | "48.5%" | FN-M18-2.9.8 |
| EL-M18-S15-120 | text | visible-default | "Accuracy" | FN-M18-2.9.8 |
| EL-M18-S15-121 | text | visible-default | "Purata Level" | FN-M18-2.9.8 |
| EL-M18-S15-122 | text | visible-default | "1", fa-layer-group | FN-M18-2.9.8 |
| EL-M18-S15-123 | card | visible-default | "Fizik" | FN-M18-2.9.8 |
| EL-M18-S15-124 | heading | visible-default | "Fizik" | FN-M18-2.9.8 |
| EL-M18-S15-125 | text | visible-default | "PHY" | FN-M18-2.9.8 |
| EL-M18-S15-126 | text | visible-default | "5" | FN-M18-2.9.8 |
| EL-M18-S15-127 | text | visible-default | "Pelajar" | FN-M18-2.9.8 |
| EL-M18-S15-128 | text | visible-default | "114" | FN-M18-2.9.8 |
| EL-M18-S15-129 | text | visible-default | "Soalan" | FN-M18-2.9.8 |
| EL-M18-S15-130 | text | visible-default | "43.5%" | FN-M18-2.9.8 |
| EL-M18-S15-131 | text | visible-default | "Accuracy" | FN-M18-2.9.8 |
| EL-M18-S15-132 | text | visible-default | "Purata Level" | FN-M18-2.9.8 |
| EL-M18-S15-133 | text | visible-default | "0.4", fa-layer-group | FN-M18-2.9.8 |
| EL-M18-S15-134 | card | visible-default | "Matematik Tambahan" | FN-M18-2.9.8 |
| EL-M18-S15-135 | heading | visible-default | "Matematik Tambahan" | FN-M18-2.9.8 |
| EL-M18-S15-136 | text | visible-default | "ADDMATH" | FN-M18-2.9.8 |
| EL-M18-S15-137 | text | visible-default | "2" | FN-M18-2.9.8 |
| EL-M18-S15-138 | text | visible-default | "Pelajar" | FN-M18-2.9.8 |
| EL-M18-S15-139 | text | visible-default | "97" | FN-M18-2.9.8 |
| EL-M18-S15-140 | text | visible-default | "Soalan" | FN-M18-2.9.8 |
| EL-M18-S15-141 | text | visible-default | "48.5%" | FN-M18-2.9.8 |
| EL-M18-S15-142 | text | visible-default | "Accuracy" | FN-M18-2.9.8 |
| EL-M18-S15-143 | text | visible-default | "Purata Level" | FN-M18-2.9.8 |
| EL-M18-S15-144 | text | visible-default | "1.5", fa-layer-group | FN-M18-2.9.8 |
| EL-M18-S15-145 | card | visible-default | "Sains Komputer" | FN-M18-2.9.8 |
| EL-M18-S15-146 | heading | visible-default | "Sains Komputer" | FN-M18-2.9.8 |
| EL-M18-S15-147 | text | visible-default | "SK" | FN-M18-2.9.8 |
| EL-M18-S15-148 | text | visible-default | "3" | FN-M18-2.9.8 |
| EL-M18-S15-149 | text | visible-default | "Pelajar" | FN-M18-2.9.8 |
| EL-M18-S15-150 | text | visible-default | "71" | FN-M18-2.9.8 |
| EL-M18-S15-151 | text | visible-default | "Soalan" | FN-M18-2.9.8 |
| EL-M18-S15-152 | text | visible-default | "56.8%" | FN-M18-2.9.8 |
| EL-M18-S15-153 | text | visible-default | "Accuracy" | FN-M18-2.9.8 |
| EL-M18-S15-154 | text | visible-default | "Purata Level" | FN-M18-2.9.8 |
| EL-M18-S15-155 | text | visible-default | "1", fa-layer-group | FN-M18-2.9.8 |
| EL-M18-S15-156 | card | visible-default | "Sejarah" | FN-M18-2.9.8 |
| EL-M18-S15-157 | heading | visible-default | "Sejarah" | FN-M18-2.9.8 |
| EL-M18-S15-158 | text | visible-default | "SEJ" | FN-M18-2.9.8 |
| EL-M18-S15-159 | text | visible-default | "3" | FN-M18-2.9.8 |
| EL-M18-S15-160 | text | visible-default | "Pelajar" | FN-M18-2.9.8 |
| EL-M18-S15-161 | text | visible-default | "68" | FN-M18-2.9.8 |
| EL-M18-S15-162 | text | visible-default | "Soalan" | FN-M18-2.9.8 |
| EL-M18-S15-163 | text | visible-default | "44.1%" | FN-M18-2.9.8 |
| EL-M18-S15-164 | text | visible-default | "Accuracy" | FN-M18-2.9.8 |
| EL-M18-S15-165 | text | visible-default | "Sebelum" | FN-M18-2.9.8 |
| EL-M18-S15-166 | text | visible-default | "84.6%" | FN-M18-2.9.8 |
| EL-M18-S15-167 | text | visible-default | "Selepas" | FN-M18-2.9.8 |
| EL-M18-S15-168 | text | visible-default | "84.6%" | FN-M18-2.9.8 |
| EL-M18-S15-169 | text | visible-default | "Purata Level" | FN-M18-2.9.8 |
| EL-M18-S15-170 | text | visible-default | "0.7", fa-layer-group | FN-M18-2.9.8 |
| EL-M18-S15-171 | card | visible-default | "Biologi" | FN-M18-2.9.8 |
| EL-M18-S15-172 | heading | visible-default | "Biologi" | FN-M18-2.9.8 |
| EL-M18-S15-173 | text | visible-default | "BIO" | FN-M18-2.9.8 |
| EL-M18-S15-174 | text | visible-default | "3" | FN-M18-2.9.8 |
| EL-M18-S15-175 | text | visible-default | "Pelajar" | FN-M18-2.9.8 |
| EL-M18-S15-176 | text | visible-default | "58" | FN-M18-2.9.8 |
| EL-M18-S15-177 | text | visible-default | "Soalan" | FN-M18-2.9.8 |
| EL-M18-S15-178 | text | visible-default | "45.5%" | FN-M18-2.9.8 |
| EL-M18-S15-179 | text | visible-default | "Accuracy" | FN-M18-2.9.8 |
| EL-M18-S15-180 | text | visible-default | "Purata Level" | FN-M18-2.9.8 |
| EL-M18-S15-181 | text | visible-default | "0.3", fa-layer-group | FN-M18-2.9.8 |
| EL-M18-S15-182 | card | visible-default | "Perniagaan" | FN-M18-2.9.8 |
| EL-M18-S15-183 | heading | visible-default | "Perniagaan" | FN-M18-2.9.8 |
| EL-M18-S15-184 | text | visible-default | "PERNIAGA" | FN-M18-2.9.8 |
| EL-M18-S15-185 | text | visible-default | "2" | FN-M18-2.9.8 |
| EL-M18-S15-186 | text | visible-default | "Pelajar" | FN-M18-2.9.8 |
| EL-M18-S15-187 | text | visible-default | "52" | FN-M18-2.9.8 |
| EL-M18-S15-188 | text | visible-default | "Soalan" | FN-M18-2.9.8 |
| EL-M18-S15-189 | text | visible-default | "55.4%" | FN-M18-2.9.8 |
| EL-M18-S15-190 | text | visible-default | "Accuracy" | FN-M18-2.9.8 |
| EL-M18-S15-191 | text | visible-default | "Purata Level" | FN-M18-2.9.8 |
| EL-M18-S15-192 | text | visible-default | "1", fa-layer-group | FN-M18-2.9.8 |
| EL-M18-S15-193 | card | visible-default | "Geografi" | FN-M18-2.9.8 |
| EL-M18-S15-194 | heading | visible-default | "Geografi" | FN-M18-2.9.8 |
| EL-M18-S15-195 | text | visible-default | "GEO" | FN-M18-2.9.8 |
| EL-M18-S15-196 | text | visible-default | "1" | FN-M18-2.9.8 |
| EL-M18-S15-197 | text | visible-default | "Pelajar" | FN-M18-2.9.8 |
| EL-M18-S15-198 | text | visible-default | "19" | FN-M18-2.9.8 |
| EL-M18-S15-199 | text | visible-default | "Soalan" | FN-M18-2.9.8 |
| EL-M18-S15-200 | text | visible-default | "47.4%" | FN-M18-2.9.8 |
| EL-M18-S15-201 | text | visible-default | "Accuracy" | FN-M18-2.9.8 |
| EL-M18-S15-202 | card | visible-default | "Ranking Pelajar" | FN-M18-2.9.9 |
| EL-M18-S15-203 | heading | visible-default | "Ranking Pelajar" | FN-M18-2.9.9 |
| EL-M18-S15-204 | text | visible-default | "Kedudukan pelajar berdasarkan prestasi" | FN-M18-2.9.9 |
| EL-M18-S15-205 | button | visible-default | "Ikut Kelas", fa-door-open | FN-M18-2.9.9 |
| EL-M18-S15-206 | button | visible-default | "Ikut Subjek", fa-book | FN-M18-2.9.9 |
| EL-M18-S15-207 | empty-state | visible-default | "Tiada data ranking" | FN-M18-2.9.9 |
| EL-M18-S15-208 | text | visible-default | "Data ranking dikemas kini setiap hari" | FN-M18-2.9.9 |
| EL-M18-S15-209 | text | hidden-only | "Pilih subjek dari filter di atas" | FN-M18-2.9.9 |
| EL-M18-S15-210 | text | hidden-only | "Ranking akan dipaparkan mengikut subjek yang dipilih" | FN-M18-2.9.9 |
| EL-M18-S15-211 | card | visible-default | "Prestasi Per Kelas" | FN-M18-2.9.10 |
| EL-M18-S15-212 | heading | visible-default | "Prestasi Per Kelas" | FN-M18-2.9.10 |
| EL-M18-S15-213 | text | visible-default | "0 kelas dipaparkan" | FN-M18-2.9.10 |
| EL-M18-S15-214 | empty-state | visible-default | "Tiada kelas dijumpai" | FN-M18-2.9.10 |
| EL-M18-S15-215 | text | visible-default | "Sila cipta kelas terlebih dahulu" | FN-M18-2.9.10 |
| EL-M18-S15-216 | card | visible-default | "Senarai Pelajar — Terperinci" | FN-M18-2.9.11 |
| EL-M18-S15-217 | heading | visible-default | "Senarai Pelajar — Terperinci" | FN-M18-2.9.11 |
| EL-M18-S15-218 | text | visible-default | "Klik pada kelas untuk lihat senarai pelajar" | FN-M18-2.9.11 |
| EL-M18-S15-219 | alert | visible-default | "PDPA Dilindungi", fa-shield-alt | FN-M18-2.9.12 |
| EL-M18-S15-220 | button | visible-default | "Tunjuk IC Penuh", fa-eye | FN-M18-2.9.12 |
| EL-M18-S15-221 | empty-state | visible-default | "Tiada data pelajar" | FN-M18-2.9.11 |
| EL-M18-S15-222 | empty-state | visible-default | "Tiada pelajar dalam sekolah ini buat masa ini" | FN-M18-2.9.11 |
| EL-M18-S15-223 | dropdown-trigger | visible-default | "Tiada Kelas 21 pelajar", fa-chevron-right | FN-M18-2.9.11 |
| EL-M18-S15-224 | table | hidden-only | table | FN-M18-2.9.11 |
| EL-M18-S15-225 | card | visible-default | "Senarai Guru" | FN-M18-2.9.13 |
| EL-M18-S15-226 | heading | visible-default | "Senarai Guru" | FN-M18-2.9.13 |
| EL-M18-S15-227 | text | visible-default | "Guru berdaftar di SEKOLAH MENENGAH KEBANGSAAN LAYANG-LAYANG" | FN-M18-2.9.13 |
| EL-M18-S15-228 | empty-state | visible-default | "Tiada guru berdaftar" | FN-M18-2.9.13 |
| EL-M18-S15-229 | text | visible-default | "Sekolah ini belum mempunyai guru yang berdaftar dalam sistem" | FN-M18-2.9.13 |

#### S16 — `/amaran` (6 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M18-S16-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S16-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S16-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S16-004 | link | visible-default | "5 CYBER Sains Rumah Tangga · 1 pelajar", → /amaran/kelas/1156, fa-exclamation-triangle | FN-M18-4.2.1 |
| EL-M18-S16-005 | link | visible-default | "sains rumah tangga Sains Rumah Tangga · 0 pelajar", → /amaran/kelas/1155, fa-exclamation-triangle | FN-M18-4.2.1 |
| EL-M18-S16-006 | link | visible-default | "Chaos Academy Sains Rumah Tangga · 0 pelajar", → /amaran/kelas/1154, fa-exclamation-triangle | FN-M18-4.2.1 |

#### S17 — `/amaran/kelas/{id}` (46 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M18-S17-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S17-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S17-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S17-004 | link | visible-default | "Kembali ke senarai kelas", → /amaran, fa-arrow-left | FN-M18-4.3.1 |
| EL-M18-S17-005 | text | visible-default | "1" | FN-M18-4.3.2 |
| EL-M18-S17-006 | text | visible-default | "Jumlah Pelajar" | FN-M18-4.3.2 |
| EL-M18-S17-007 | text | visible-default | "0" | FN-M18-4.3.2 |
| EL-M18-S17-008 | text | visible-default | "On Track" | FN-M18-4.3.2 |
| EL-M18-S17-009 | text | visible-default | "1" | FN-M18-4.3.2 |
| EL-M18-S17-010 | text | visible-default | "Perlu Perhatian" | FN-M18-4.3.2 |
| EL-M18-S17-011 | text | visible-default | "0" | FN-M18-4.3.2 |
| EL-M18-S17-012 | text | visible-default | "Berisiko Tinggi" | FN-M18-4.3.2 |
| EL-M18-S17-013 | card | visible-default | "Taburan Risiko" | FN-M18-4.3.3 |
| EL-M18-S17-014 | heading | visible-default | "Taburan Risiko" | FN-M18-4.3.3 |
| EL-M18-S17-015 | text | visible-default | "100%" | FN-M18-4.3.3 |
| EL-M18-S17-016 | text | visible-default | "Hijau (On Track)" | FN-M18-4.3.3 |
| EL-M18-S17-017 | text | visible-default | "Kuning (Perlu Perhatian)" | FN-M18-4.3.3 |
| EL-M18-S17-018 | text | visible-default | "Merah (Berisiko Tinggi)" | FN-M18-4.3.3 |
| EL-M18-S17-019 | link | visible-default | "Muat Turun CSV", → /amaran/export/class/1156, fa-download | FN-M18-4.9.1 |
| EL-M18-S17-020 | card | visible-default | "Senarai Pelajar Mengikut Risiko" | FN-M18-4.3.4 |
| EL-M18-S17-021 | heading | visible-default | "Senarai Pelajar Mengikut Risiko" | FN-M18-4.3.4 |
| EL-M18-S17-022 | table | visible-default | table | FN-M18-4.3.4 |
| EL-M18-S17-023 | link | visible-default | "<masked>", → /prestasi/4627 | FN-M18-4.3.4 |
| EL-M18-S17-024 | badge | visible-default | "Perlu Perhatian" | FN-M18-4.3.4 |
| EL-M18-S17-025 | link | visible-default | "Intervensi", → /amaran/intervensi/4627, fa-clipboard-list | FN-M18-4.3.4 |
| EL-M18-S17-026 | card | visible-default | "Analisis Risiko Mengikut Subjek" | FN-M18-4.3.5 |
| EL-M18-S17-027 | heading | visible-default | "Analisis Risiko Mengikut Subjek" | FN-M18-4.3.5 |
| EL-M18-S17-028 | text | visible-default | "Sejarah" | FN-M18-4.3.5 |
| EL-M18-S17-029 | text | visible-default | "1/1 pelajar lemah (100%)" | FN-M18-4.3.5 |
| EL-M18-S17-030 | text | visible-default | "Bahasa Melayu" | FN-M18-4.3.5 |
| EL-M18-S17-031 | text | visible-default | "0/1 pelajar lemah (0%)" | FN-M18-4.3.5 |
| EL-M18-S17-032 | text | visible-default | "Bahasa Inggeris" | FN-M18-4.3.5 |
| EL-M18-S17-033 | text | visible-default | "0/1 pelajar lemah (0%)" | FN-M18-4.3.5 |
| EL-M18-S17-034 | text | visible-default | "Matematik" | FN-M18-4.3.5 |
| EL-M18-S17-035 | text | visible-default | "0/1 pelajar lemah (0%)" | FN-M18-4.3.5 |
| EL-M18-S17-036 | text | visible-default | "Sains" | FN-M18-4.3.5 |
| EL-M18-S17-037 | text | visible-default | "0/1 pelajar lemah (0%)" | FN-M18-4.3.5 |
| EL-M18-S17-038 | text | visible-default | "Pendidikan Islam" | FN-M18-4.3.5 |
| EL-M18-S17-039 | text | visible-default | "0/1 pelajar lemah (0%)" | FN-M18-4.3.5 |
| EL-M18-S17-040 | text | conditional | "403" | FN-M18-1.2.8 |
| EL-M18-S17-041 | text | conditional | "🚫" | FN-M18-1.2.8 |
| EL-M18-S17-042 | heading | conditional | "Akses Ditolak" | FN-M18-1.2.8 |
| EL-M18-S17-043 | text | conditional | "Anda tidak mempunyai kebenaran untuk mengakses halaman ini. Sila log masuk denga …" | FN-M18-1.2.8 |
| EL-M18-S17-044 | link | conditional | "Halaman Utama", → / | FN-M18-1.2.8 |
| EL-M18-S17-045 | link | conditional | "Log Masuk", → /login | FN-M18-1.2.8 |
| EL-M18-S17-046 | text | conditional | "PRESTASIPLUS" | FN-M18-1.2.8 |

#### S18 — `/amaran/ppd` (30 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M18-S18-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S18-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S18-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S18-004 | text | visible-default | "33" | FN-M18-4.4.1 |
| EL-M18-S18-005 | text | visible-default | "Jumlah Pelajar" | FN-M18-4.4.1 |
| EL-M18-S18-006 | text | visible-default | "0" | FN-M18-4.4.1 |
| EL-M18-S18-007 | text | visible-default | "On Track" | FN-M18-4.4.1 |
| EL-M18-S18-008 | text | visible-default | "0" | FN-M18-4.4.1 |
| EL-M18-S18-009 | text | visible-default | "Perlu Perhatian" | FN-M18-4.4.1 |
| EL-M18-S18-010 | text | visible-default | "33" | FN-M18-4.4.1 |
| EL-M18-S18-011 | text | visible-default | "Berisiko Tinggi" | FN-M18-4.4.1 |
| EL-M18-S18-012 | card | visible-default | "Taburan Risiko Seluruh Daerah" | FN-M18-4.4.2 |
| EL-M18-S18-013 | heading | visible-default | "Taburan Risiko Seluruh Daerah" | FN-M18-4.4.2 |
| EL-M18-S18-014 | text | visible-default | "100%" | FN-M18-4.4.2 |
| EL-M18-S18-015 | text | visible-default | "Hijau: 0" | FN-M18-4.4.2 |
| EL-M18-S18-016 | text | visible-default | "Kuning: 0" | FN-M18-4.4.2 |
| EL-M18-S18-017 | text | visible-default | "Merah: 33" | FN-M18-4.4.2 |
| EL-M18-S18-018 | link | visible-default | "Keberkesanan Intervensi", → /amaran/keberkesanan/ppd, fa-chart-pie | FN-M18-4.4.3 |
| EL-M18-S18-019 | link | visible-default | "Ringkasan Eksekutif", → /amaran/ringkasan-eksekutif?scope=district&district=PPD%20BATANG%20PAD, fa-file-alt | FN-M18-4.4.3 |
| EL-M18-S18-020 | link | visible-default | "Muat Turun CSV", → /amaran/export/district/0, fa-download | FN-M18-4.9.2 |
| EL-M18-S18-021 | card | visible-default | "Perbandingan Sekolah" | FN-M18-4.4.4 |
| EL-M18-S18-022 | heading | visible-default | "Perbandingan Sekolah" | FN-M18-4.4.4 |
| EL-M18-S18-023 | table | visible-default | table | FN-M18-4.4.4 |
| EL-M18-S18-024 | link | visible-default | "SEKOLAH MENENGAH KEBANGSAAN HAMID KHAN", → /amaran/sekolah/7780 | FN-M18-4.4.4 |
| EL-M18-S18-025 | link | visible-default | "SEKOLAH KEBANGSAAN TOH TANDEWA SAKTI", → /amaran/sekolah/1 | FN-M18-4.4.4 |
| EL-M18-S18-026 | card | visible-default | "Pelajar Berisiko Tertinggi" | FN-M18-4.4.5 |
| EL-M18-S18-027 | heading | visible-default | "Pelajar Berisiko Tertinggi" | FN-M18-4.4.5 |
| EL-M18-S18-028 | text | visible-default | "Menunjukkan 33 dari 33 pelajar" | FN-M18-4.4.5 |
| EL-M18-S18-029 | table | visible-default | table | FN-M18-4.4.5 |
| EL-M18-S18-030 | badge | visible-default | "Berisiko Tinggi" | FN-M18-4.4.5 |

#### S19 — `/amaran/jpn` (40 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M18-S19-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S19-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S19-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S19-004 | link | visible-default | "Papan Pemuka", → /dashboard, fa-arrow-left | FN-M18-4.5.1 |
| EL-M18-S19-005 | text | visible-default | "/" | FN-M18-4.5.1 |
| EL-M18-S19-006 | text | visible-default | "Amaran Awal JPN" | FN-M18-4.5.1 |
| EL-M18-S19-007 | card | visible-default | "JPN Perak" | FN-M18-4.5.1 |
| EL-M18-S19-008 | heading | visible-default | "JPN Perak" | FN-M18-4.5.1 |
| EL-M18-S19-009 | text | visible-default | "Laporan Amaran Awal Jabatan Pendidikan Negeri — Data Seluruh Negeri" | FN-M18-4.5.1 |
| EL-M18-S19-010 | text | visible-default | "33" | FN-M18-4.5.1 |
| EL-M18-S19-011 | text | visible-default | "Pelajar" | FN-M18-4.5.1 |
| EL-M18-S19-012 | text | visible-default | "33" | FN-M18-4.5.2 |
| EL-M18-S19-013 | text | visible-default | "Jumlah Pelajar" | FN-M18-4.5.2 |
| EL-M18-S19-014 | text | visible-default | "0" | FN-M18-4.5.2 |
| EL-M18-S19-015 | text | visible-default | "On Track" | FN-M18-4.5.2 |
| EL-M18-S19-016 | text | visible-default | "0" | FN-M18-4.5.2 |
| EL-M18-S19-017 | text | visible-default | "Perlu Perhatian" | FN-M18-4.5.2 |
| EL-M18-S19-018 | text | visible-default | "33" | FN-M18-4.5.2 |
| EL-M18-S19-019 | text | visible-default | "Berisiko Tinggi" | FN-M18-4.5.2 |
| EL-M18-S19-020 | card | visible-default | "Taburan Risiko Seluruh Negeri" | FN-M18-4.5.3 |
| EL-M18-S19-021 | heading | visible-default | "Taburan Risiko Seluruh Negeri" | FN-M18-4.5.3 |
| EL-M18-S19-022 | text | visible-default | "100%" | FN-M18-4.5.3 |
| EL-M18-S19-023 | text | visible-default | "Hijau: 0" | FN-M18-4.5.3 |
| EL-M18-S19-024 | text | visible-default | "Kuning: 0" | FN-M18-4.5.3 |
| EL-M18-S19-025 | text | visible-default | "Merah: 33" | FN-M18-4.5.3 |
| EL-M18-S19-026 | link | visible-default | "Ringkasan Eksekutif", → /amaran/ringkasan-eksekutif?scope=state&state=Perak, fa-file-alt | FN-M18-4.5.4 |
| EL-M18-S19-027 | card | visible-default | "Perbandingan Daerah (PPD)" | FN-M18-4.5.5 |
| EL-M18-S19-028 | heading | visible-default | "Perbandingan Daerah (PPD)" | FN-M18-4.5.5 |
| EL-M18-S19-029 | text | visible-default | "Kedudukan daerah mengikut purata skor risiko" | FN-M18-4.5.5 |
| EL-M18-S19-030 | table | visible-default | table | FN-M18-4.5.5 |
| EL-M18-S19-031 | card | visible-default | "Perbandingan Sekolah" | FN-M18-4.5.6 |
| EL-M18-S19-032 | heading | visible-default | "Perbandingan Sekolah" | FN-M18-4.5.6 |
| EL-M18-S19-033 | text | visible-default | "Kedudukan semua sekolah dalam negeri" | FN-M18-4.5.6 |
| EL-M18-S19-034 | table | visible-default | table | FN-M18-4.5.6 |
| EL-M18-S19-035 | link | visible-default | "SEKOLAH KEBANGSAAN TOH TANDEWA SAKTI", → /amaran/sekolah/1 | FN-M18-4.5.6 |
| EL-M18-S19-036 | link | visible-default | "SEKOLAH KEBANGSAAN TOH TANDEWA SAKTI", → /amaran/sekolah/1 | FN-M18-4.5.6 |
| EL-M18-S19-037 | card | visible-default | "Pelajar Berisiko Tertinggi (Seluruh Negeri)" | FN-M18-4.5.7 |
| EL-M18-S19-038 | heading | visible-default | "Pelajar Berisiko Tertinggi (Seluruh Negeri)" | FN-M18-4.5.7 |
| EL-M18-S19-039 | text | visible-default | "Menunjukkan 33 dari 33" | FN-M18-4.5.7 |
| EL-M18-S19-040 | table | visible-default | table | FN-M18-4.5.7 |

#### S20 — `/amaran/keberkesanan/ppd` (51 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M18-S20-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S20-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S20-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S20-004 | link | visible-default | "Kembali ke Dashboard PPD", → /ppd/dashboard, fa-arrow-left | FN-M18-4.8.1 |
| EL-M18-S20-005 | form | visible-default | form | FN-M18-4.8.2 |
| EL-M18-S20-006 | label | visible-default | "Filter Sekolah:" | FN-M18-4.8.2 |
| EL-M18-S20-007 | select | visible-default | select, name=school_id, 119 options | FN-M18-4.8.2 |
| EL-M18-S20-008 | card | visible-default | "Jumlah Intervensi" | FN-M18-4.8.3 |
| EL-M18-S20-009 | text | visible-default | "2" | FN-M18-4.8.3 |
| EL-M18-S20-010 | text | visible-default | "Jumlah Intervensi" | FN-M18-4.8.3 |
| EL-M18-S20-011 | card | visible-default | "Kadar Berkesan" | FN-M18-4.8.3 |
| EL-M18-S20-012 | text | visible-default | "0%" | FN-M18-4.8.3 |
| EL-M18-S20-013 | text | visible-default | "Kadar Berkesan" | FN-M18-4.8.3 |
| EL-M18-S20-014 | text | visible-default | "0/0 dinilai" | FN-M18-4.8.3 |
| EL-M18-S20-015 | card | visible-default | "Perlu Tindakan" | FN-M18-4.8.3 |
| EL-M18-S20-016 | text | visible-default | "0" | FN-M18-4.8.3 |
| EL-M18-S20-017 | text | visible-default | "Perlu Tindakan" | FN-M18-4.8.3 |
| EL-M18-S20-018 | text | visible-default | "0 sederhana, 0 tidak berkesan" | FN-M18-4.8.3 |
| EL-M18-S20-019 | card | visible-default | "Belum Dinilai" | FN-M18-4.8.3 |
| EL-M18-S20-020 | text | visible-default | "2" | FN-M18-4.8.3 |
| EL-M18-S20-021 | text | visible-default | "Belum Dinilai" | FN-M18-4.8.3 |
| EL-M18-S20-022 | card | visible-default | "Pecahan Keberkesanan" | FN-M18-4.8.4 |
| EL-M18-S20-023 | heading | visible-default | "Pecahan Keberkesanan" | FN-M18-4.8.4 |
| EL-M18-S20-024 | card | visible-default | "Trend Bulanan (6 Bulan)" | FN-M18-4.8.4 |
| EL-M18-S20-025 | heading | visible-default | "Trend Bulanan (6 Bulan)" | FN-M18-4.8.4 |
| EL-M18-S20-026 | card | visible-default | "Intervensi Mengikut Jenis" | FN-M18-4.8.5 |
| EL-M18-S20-027 | heading | visible-default | "Intervensi Mengikut Jenis" | FN-M18-4.8.5 |
| EL-M18-S20-028 | text | visible-default | "Sesi Kaunseling" | FN-M18-4.8.5 |
| EL-M18-S20-029 | text | visible-default | "1 kali" | FN-M18-4.8.5 |
| EL-M18-S20-030 | text | visible-default | "Mentor Rakan Sebaya" | FN-M18-4.8.5 |
| EL-M18-S20-031 | text | visible-default | "1 kali" | FN-M18-4.8.5 |
| EL-M18-S20-032 | card | visible-default | "Statistik Guru" | FN-M18-4.8.6 |
| EL-M18-S20-033 | heading | visible-default | "Statistik Guru" | FN-M18-4.8.6 |
| EL-M18-S20-034 | table | visible-default | table | FN-M18-4.8.6 |
| EL-M18-S20-035 | badge | visible-default | "0" | FN-M18-4.8.6 |
| EL-M18-S20-036 | badge | visible-default | "2" | FN-M18-4.8.6 |
| EL-M18-S20-037 | card | visible-default | "Perlu Tindakan Susulan" | FN-M18-4.8.7 |
| EL-M18-S20-038 | heading | visible-default | "Perlu Tindakan Susulan" | FN-M18-4.8.7 |
| EL-M18-S20-039 | text | visible-default | "<masked>" | FN-M18-4.8.7 |
| EL-M18-S20-040 | text | visible-default | "Sesi Kaunseling · 13 Apr 2026" | FN-M18-4.8.7 |
| EL-M18-S20-041 | badge | visible-default | "Belum Dinilai" | FN-M18-4.8.7 |
| EL-M18-S20-042 | link | visible-default | link, → /amaran/intervensi/2229, fa-arrow-right | FN-M18-4.8.7 |
| EL-M18-S20-043 | text | visible-default | "<masked>" | FN-M18-4.8.7 |
| EL-M18-S20-044 | text | visible-default | "Mentor Rakan Sebaya · 13 Apr 2026" | FN-M18-4.8.7 |
| EL-M18-S20-045 | badge | visible-default | "Belum Dinilai" | FN-M18-4.8.7 |
| EL-M18-S20-046 | link | visible-default | link, → /amaran/intervensi/2229, fa-arrow-right | FN-M18-4.8.7 |
| EL-M18-S20-047 | card | visible-default | "Perbandingan Sekolah Daerah" | FN-M18-4.8.8 |
| EL-M18-S20-048 | heading | visible-default | "Perbandingan Sekolah Daerah" | FN-M18-4.8.8 |
| EL-M18-S20-049 | text | visible-default | "1 sekolah ada intervensi" | FN-M18-4.8.8 |
| EL-M18-S20-050 | table | visible-default | table | FN-M18-4.8.8 |
| EL-M18-S20-051 | filter | visible-default | "SEKOLAH MENENGAH KEBANGSAAN TINGGI KLUANG", → ?school_id=8880 | FN-M18-4.8.8 |

#### S21 — `/amaran/keberkesanan` (28 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M18-S21-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S21-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S21-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S21-004 | link | visible-default | "Kembali ke Amaran", → /amaran/sekolah/127, fa-arrow-left | FN-M18-4.8.9 |
| EL-M18-S21-005 | card | visible-default | "Jumlah Intervensi" | FN-M18-4.8.3 |
| EL-M18-S21-006 | text | visible-default | "0" | FN-M18-4.8.3 |
| EL-M18-S21-007 | text | visible-default | "Jumlah Intervensi" | FN-M18-4.8.3 |
| EL-M18-S21-008 | card | visible-default | "Kadar Berkesan" | FN-M18-4.8.3 |
| EL-M18-S21-009 | text | visible-default | "0%" | FN-M18-4.8.3 |
| EL-M18-S21-010 | text | visible-default | "Kadar Berkesan" | FN-M18-4.8.3 |
| EL-M18-S21-011 | text | visible-default | "0/0 dinilai" | FN-M18-4.8.3 |
| EL-M18-S21-012 | card | visible-default | "Perlu Tindakan" | FN-M18-4.8.3 |
| EL-M18-S21-013 | text | visible-default | "0" | FN-M18-4.8.3 |
| EL-M18-S21-014 | text | visible-default | "Perlu Tindakan" | FN-M18-4.8.3 |
| EL-M18-S21-015 | text | visible-default | "0 sederhana, 0 tidak berkesan" | FN-M18-4.8.3 |
| EL-M18-S21-016 | card | visible-default | "Belum Dinilai" | FN-M18-4.8.3 |
| EL-M18-S21-017 | text | visible-default | "0" | FN-M18-4.8.3 |
| EL-M18-S21-018 | text | visible-default | "Belum Dinilai" | FN-M18-4.8.3 |
| EL-M18-S21-019 | card | visible-default | "Pecahan Keberkesanan" | FN-M18-4.8.4 |
| EL-M18-S21-020 | heading | visible-default | "Pecahan Keberkesanan" | FN-M18-4.8.4 |
| EL-M18-S21-021 | empty-state | visible-default | "Tiada data intervensi lagi." | FN-M18-4.8.4 |
| EL-M18-S21-022 | card | visible-default | "Trend Bulanan (6 Bulan)" | FN-M18-4.8.4 |
| EL-M18-S21-023 | heading | visible-default | "Trend Bulanan (6 Bulan)" | FN-M18-4.8.4 |
| EL-M18-S21-024 | empty-state | visible-default | "Tiada data trend lagi." | FN-M18-4.8.4 |
| EL-M18-S21-025 | card | visible-default | "Belum Ada Intervensi" | FN-M18-4.8.10 |
| EL-M18-S21-026 | heading | visible-default | "Belum Ada Intervensi" | FN-M18-4.8.10 |
| EL-M18-S21-027 | empty-state | visible-default | "Tiada rekod intervensi ditemui untuk sekolah ini. Guru boleh mula merekod interv …" | FN-M18-4.8.10 |
| EL-M18-S21-028 | link | visible-default | "Lihat Senarai Risiko", → /amaran/sekolah/127, fa-exclamation-triangle | FN-M18-4.8.10 |

#### S22 — `/amaran/sekolah/{id}` (30 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M18-S22-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S22-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S22-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S22-004 | link | visible-default | "Semua Tingkatan", → /sekolah/7780/amaran | FN-M18-4.6.1 |
| EL-M18-S22-005 | link | visible-default | "Tingkatan 4", → /sekolah/7780/amaran?tingkatan=T4 | FN-M18-4.6.1 |
| EL-M18-S22-006 | link | visible-default | "Tingkatan 5", → /sekolah/7780/amaran?tingkatan=T5 | FN-M18-4.6.1 |
| EL-M18-S22-007 | text | visible-default | "17" | FN-M18-4.6.2 |
| EL-M18-S22-008 | text | visible-default | "Jumlah Pelajar" | FN-M18-4.6.2 |
| EL-M18-S22-009 | text | visible-default | "0" | FN-M18-4.6.2 |
| EL-M18-S22-010 | text | visible-default | "On Track" | FN-M18-4.6.2 |
| EL-M18-S22-011 | text | visible-default | "0" | FN-M18-4.6.2 |
| EL-M18-S22-012 | text | visible-default | "Perlu Perhatian" | FN-M18-4.6.2 |
| EL-M18-S22-013 | text | visible-default | "17" | FN-M18-4.6.2 |
| EL-M18-S22-014 | text | visible-default | "Berisiko Tinggi" | FN-M18-4.6.2 |
| EL-M18-S22-015 | card | visible-default | "Taburan Risiko Seluruh Sekolah" | FN-M18-4.6.3 |
| EL-M18-S22-016 | heading | visible-default | "Taburan Risiko Seluruh Sekolah" | FN-M18-4.6.3 |
| EL-M18-S22-017 | text | visible-default | "100%" | FN-M18-4.6.3 |
| EL-M18-S22-018 | text | visible-default | "Hijau: 0" | FN-M18-4.6.3 |
| EL-M18-S22-019 | text | visible-default | "Kuning: 0" | FN-M18-4.6.3 |
| EL-M18-S22-020 | text | visible-default | "Merah: 17" | FN-M18-4.6.3 |
| EL-M18-S22-021 | link | visible-default | "Keberkesanan Intervensi", → /amaran/keberkesanan, fa-chart-pie | FN-M18-4.6.4 |
| EL-M18-S22-022 | link | visible-default | "Ringkasan Eksekutif", → /amaran/ringkasan-eksekutif?scope=school&school_id=7780, fa-file-alt | FN-M18-4.6.4 |
| EL-M18-S22-023 | link | visible-default | "Muat Turun CSV", → /amaran/export/school/7780, fa-download | FN-M18-4.9.3 |
| EL-M18-S22-024 | card | visible-default | "Senarai Pelajar Berisiko" | FN-M18-4.6.5 |
| EL-M18-S22-025 | heading | visible-default | "Senarai Pelajar Berisiko" | FN-M18-4.6.5 |
| EL-M18-S22-026 | text | visible-default | "Disusun mengikut skor risiko tertinggi" | FN-M18-4.6.5 |
| EL-M18-S22-027 | table | visible-default | table | FN-M18-4.6.5 |
| EL-M18-S22-028 | badge | visible-default | "Berisiko Tinggi" | FN-M18-4.6.5 |
| EL-M18-S22-029 | badge | visible-default | "Berisiko Tinggi" | FN-M18-4.6.5 |
| EL-M18-S22-030 | badge | visible-default | "Berisiko Tinggi" | FN-M18-4.6.5 |

#### S23 — `/amaran/ringkasan-eksekutif` (57 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M18-S23-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S23-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S23-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S23-004 | button | visible-default | "Cetak / PDF", fa-print | FN-M18-4.7.1 |
| EL-M18-S23-005 | link | visible-default | "Kembali", → /notifikasi/unread-count, fa-arrow-left | FN-M18-4.7.1 |
| EL-M18-S23-006 | image | hidden-only | image | FN-M18-4.7.2 |
| EL-M18-S23-007 | text | visible-default | "PRESTASIPLUS · Ringkasan Eksekutif" | FN-M18-4.7.2 |
| EL-M18-S23-008 | heading | visible-default | "PPD PPD BATANG PADANG" | FN-M18-4.7.2 |
| EL-M18-S23-009 | text | visible-default | "Perak — Ringkasan Eksekutif" | FN-M18-4.7.2 |
| EL-M18-S23-010 | text | visible-default | "Dijana: 26 September 2026, 04:25" | FN-M18-4.7.2 |
| EL-M18-S23-011 | card | visible-default | "Jumlah Pelajar" | FN-M18-4.7.3 |
| EL-M18-S23-012 | text | visible-default | "33" | FN-M18-4.7.3 |
| EL-M18-S23-013 | text | visible-default | "Jumlah Pelajar" | FN-M18-4.7.3 |
| EL-M18-S23-014 | card | visible-default | "On Track (Hijau)" | FN-M18-4.7.3 |
| EL-M18-S23-015 | text | visible-default | "0%" | FN-M18-4.7.3 |
| EL-M18-S23-016 | text | visible-default | "On Track (Hijau)" | FN-M18-4.7.3 |
| EL-M18-S23-017 | text | visible-default | "0 pelajar" | FN-M18-4.7.3 |
| EL-M18-S23-018 | card | visible-default | "Perlu Perhatian" | FN-M18-4.7.3 |
| EL-M18-S23-019 | text | visible-default | "0%" | FN-M18-4.7.3 |
| EL-M18-S23-020 | text | visible-default | "Perlu Perhatian" | FN-M18-4.7.3 |
| EL-M18-S23-021 | text | visible-default | "0 pelajar" | FN-M18-4.7.3 |
| EL-M18-S23-022 | card | visible-default | "Berisiko Tinggi" | FN-M18-4.7.3 |
| EL-M18-S23-023 | text | visible-default | "100%" | FN-M18-4.7.3 |
| EL-M18-S23-024 | text | visible-default | "Berisiko Tinggi" | FN-M18-4.7.3 |
| EL-M18-S23-025 | text | visible-default | "33 pelajar" | FN-M18-4.7.3 |
| EL-M18-S23-026 | card | visible-default | "Taburan Risiko" | FN-M18-4.7.4 |
| EL-M18-S23-027 | heading | visible-default | "Taburan Risiko" | FN-M18-4.7.4 |
| EL-M18-S23-028 | text | visible-default | "100%" | FN-M18-4.7.4 |
| EL-M18-S23-029 | card | visible-default | "Penglibatan Latih Tubi (Kombo)" | FN-M18-4.7.5 |
| EL-M18-S23-030 | heading | visible-default | "Penglibatan Latih Tubi (Kombo)" | FN-M18-4.7.5 |
| EL-M18-S23-031 | text | visible-default | "6" | FN-M18-4.7.5 |
| EL-M18-S23-032 | text | visible-default | "Purata Kombo" | FN-M18-4.7.5 |
| EL-M18-S23-033 | text | visible-default | "15" | FN-M18-4.7.5 |
| EL-M18-S23-034 | text | visible-default | "Kombo Tertinggi" | FN-M18-4.7.5 |
| EL-M18-S23-035 | text | visible-default | "29" | FN-M18-4.7.5 |
| EL-M18-S23-036 | text | visible-default | "Pelajar Aktif Kombo" | FN-M18-4.7.5 |
| EL-M18-S23-037 | text | visible-default | "0" | FN-M18-4.7.5 |
| EL-M18-S23-038 | text | visible-default | "Aktif Hari Ini" | FN-M18-4.7.5 |
| EL-M18-S23-039 | card | visible-default | "Pecahan Mengikut Sekolah" | FN-M18-4.7.6 |
| EL-M18-S23-040 | heading | visible-default | "Pecahan Mengikut Sekolah" | FN-M18-4.7.6 |
| EL-M18-S23-041 | table | visible-default | table | FN-M18-4.7.6 |
| EL-M18-S23-042 | text | visible-default | "Laporan ini dijana secara automatik oleh PRESTASIPLUS · 26 September 2026, 04:25" | FN-M18-4.7.7 |
| EL-M18-S23-043 | text | visible-default | "Untuk maklumat lanjut, hubungi pentadbir sistem." | FN-M18-4.7.7 |
| EL-M18-S23-044 | link | conditional | "Kembali", → /chatbot/history?session_id=cb_1790394241305_xa1ssy7am, fa-arrow-left | FN-M18-4.7.1 |
| EL-M18-S23-045 | heading | conditional | "SEKOLAH MENENGAH KEBANGSAAN TINGGI KLUANG" | FN-M18-4.7.2 |
| EL-M18-S23-046 | text | conditional | "PPD KLUANG, Johor" | FN-M18-4.7.2 |
| EL-M18-S23-047 | text | conditional | "59 pelajar" | FN-M18-4.7.2 |
| EL-M18-S23-048 | card | conditional | "Analisis Risiko Mengikut Subjek" | FN-M18-4.7.8 |
| EL-M18-S23-049 | heading | conditional | "Analisis Risiko Mengikut Subjek" | FN-M18-4.7.8 |
| EL-M18-S23-050 | text | conditional | "Bahasa Melayu" | FN-M18-4.7.8 |
| EL-M18-S23-051 | text | conditional | "1/1 lemah (100%)" | FN-M18-4.7.8 |
| EL-M18-S23-052 | text | conditional | "Bahasa Inggeris" | FN-M18-4.7.8 |
| EL-M18-S23-053 | text | conditional | "1/1 lemah (100%)" | FN-M18-4.7.8 |
| EL-M18-S23-054 | text | conditional | "Matematik" | FN-M18-4.7.8 |
| EL-M18-S23-055 | text | conditional | "1/1 lemah (100%)" | FN-M18-4.7.8 |
| EL-M18-S23-056 | heading | conditional | "Negeri Perak" | FN-M18-4.7.2 |
| EL-M18-S23-057 | text | conditional | "Ringkasan Eksekutif Seluruh Negeri" | FN-M18-4.7.2 |

#### S24 — `/amaran/intervensi/{studentId}` (62 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M18-S24-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S24-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S24-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S24-004 | text | visible-default | "2" | FN-M18-4.10.1 |
| EL-M18-S24-005 | text | visible-default | "Jumlah Intervensi" | FN-M18-4.10.1 |
| EL-M18-S24-006 | text | visible-default | "0" | FN-M18-4.10.1 |
| EL-M18-S24-007 | text | visible-default | "Berkesan" | FN-M18-4.10.1 |
| EL-M18-S24-008 | text | visible-default | "2" | FN-M18-4.10.1 |
| EL-M18-S24-009 | text | visible-default | "Belum Dinilai" | FN-M18-4.10.1 |
| EL-M18-S24-010 | card | visible-default | "Rekod Intervensi Baru" | FN-M18-4.10.2 |
| EL-M18-S24-011 | heading | visible-default | "Rekod Intervensi Baru" | FN-M18-4.10.2 |
| EL-M18-S24-012 | form | visible-default | form | FN-M18-4.10.2 |
| EL-M18-S24-013 | hidden-field | hidden-only | hidden-field, name=_token | FN-M18-4.10.2 |
| EL-M18-S24-014 | hidden-field | hidden-only | hidden-field, name=student_id | FN-M18-4.10.2 |
| EL-M18-S24-015 | label | visible-default | "Jenis Intervensi" | FN-M18-4.10.2 |
| EL-M18-S24-016 | select | visible-default | select, name=type, 7 options | FN-M18-4.10.2 |
| EL-M18-S24-017 | label | visible-default | "Tarikh" | FN-M18-4.10.2 |
| EL-M18-S24-018 | input | visible-default | input, name=intervention_date | FN-M18-4.10.2 |
| EL-M18-S24-019 | label | visible-default | "Kelas (Pilihan)" | FN-M18-4.10.2 |
| EL-M18-S24-020 | select | visible-default | select, name=classroom_id, 751 options | FN-M18-4.10.2 |
| EL-M18-S24-021 | label | visible-default | "Status" | FN-M18-4.10.2 |
| EL-M18-S24-022 | select | visible-default | select, name=status, 2 options | FN-M18-4.10.2 |
| EL-M18-S24-023 | label | visible-default | "Catatan / Apa Yang Dilakukan" | FN-M18-4.10.2 |
| EL-M18-S24-024 | textarea | visible-default | textarea, name=notes, placeholder="Cth: Sesi kaunseling bersama pelajar tentang pengurusan masa..." | FN-M18-4.10.2 |
| EL-M18-S24-025 | label | visible-default | "Tindakan Susulan (Pilihan)" | FN-M18-4.10.2 |
| EL-M18-S24-026 | textarea | visible-default | textarea, name=follow_up, placeholder="Cth: Jumpa semula minggu depan untuk semak kemajuan..." | FN-M18-4.10.2 |
| EL-M18-S24-027 | button | visible-default | "Simpan Intervensi", fa-save | FN-M18-4.10.2 |
| EL-M18-S24-028 | card | visible-default | "Sejarah Intervensi" | FN-M18-4.10.3 |
| EL-M18-S24-029 | heading | visible-default | "Sejarah Intervensi" | FN-M18-4.10.3 |
| EL-M18-S24-030 | badge | visible-default | "Sesi Kaunseling", fa-comments | FN-M18-4.10.3 |
| EL-M18-S24-031 | text | visible-default | "13 Apr 2026" | FN-M18-4.10.3 |
| EL-M18-S24-032 | text | visible-default | "<masked>" | FN-M18-4.10.3 |
| EL-M18-S24-033 | text | visible-default | "<masked>" | FN-M18-4.10.3 |
| EL-M18-S24-034 | form | visible-default | form | FN-M18-4.10.4 |
| EL-M18-S24-035 | hidden-field | hidden-only | hidden-field, name=_token | FN-M18-4.10.4 |
| EL-M18-S24-036 | hidden-field | hidden-only | hidden-field, name=_method | FN-M18-4.10.4 |
| EL-M18-S24-037 | select | visible-default | select, name=effectiveness, 4 options | FN-M18-4.10.4 |
| EL-M18-S24-038 | textarea | conditional | textarea, name=follow_up, placeholder="Tindakan susulan..." | FN-M18-4.10.5 |
| EL-M18-S24-039 | button | conditional | "Simpan" | FN-M18-4.10.5 |
| EL-M18-S24-040 | toggle | visible-default | toggle, fa-pen | FN-M18-4.10.5 |
| EL-M18-S24-041 | form | visible-default | form | FN-M18-4.10.6 |
| EL-M18-S24-042 | hidden-field | hidden-only | hidden-field, name=_token | FN-M18-4.10.6 |
| EL-M18-S24-043 | hidden-field | hidden-only | hidden-field, name=_method | FN-M18-4.10.6 |
| EL-M18-S24-044 | button | visible-default | button, fa-trash | FN-M18-4.10.6 |
| EL-M18-S24-045 | badge | visible-default | "Mentor Rakan Sebaya", fa-user-friends | FN-M18-4.10.3 |
| EL-M18-S24-046 | text | visible-default | "13 Apr 2026" | FN-M18-4.10.3 |
| EL-M18-S24-047 | text | visible-default | "<masked>" | FN-M18-4.10.3 |
| EL-M18-S24-048 | text | visible-default | "<masked>" | FN-M18-4.10.3 |
| EL-M18-S24-049 | form | visible-default | form | FN-M18-4.10.4 |
| EL-M18-S24-050 | hidden-field | hidden-only | hidden-field, name=_token | FN-M18-4.10.4 |
| EL-M18-S24-051 | hidden-field | hidden-only | hidden-field, name=_method | FN-M18-4.10.4 |
| EL-M18-S24-052 | select | visible-default | select, name=effectiveness, 4 options | FN-M18-4.10.4 |
| EL-M18-S24-053 | textarea | hidden-only | textarea, name=follow_up, placeholder="Tindakan susulan..." | FN-M18-4.10.5 |
| EL-M18-S24-054 | button | hidden-only | "Simpan" | FN-M18-4.10.5 |
| EL-M18-S24-055 | toggle | visible-default | toggle, fa-pen | FN-M18-4.10.5 |
| EL-M18-S24-056 | form | visible-default | form | FN-M18-4.10.6 |
| EL-M18-S24-057 | hidden-field | hidden-only | hidden-field, name=_token | FN-M18-4.10.6 |
| EL-M18-S24-058 | hidden-field | hidden-only | hidden-field, name=_method | FN-M18-4.10.6 |
| EL-M18-S24-059 | button | visible-default | button, fa-trash | FN-M18-4.10.6 |
| EL-M18-S24-060 | link | visible-default | "Kembali", → /admin/server-status, fa-arrow-left | FN-M18-4.10.7 |
| EL-M18-S24-061 | link | conditional | "Kembali", → /chatbot/history?session_id=cb_1790394241305_xa1ssy7am, fa-arrow-left | FN-M18-4.10.7 |
| EL-M18-S24-062 | link | conditional | "Kembali", → /notifikasi/unread-count, fa-arrow-left | FN-M18-4.10.7 |

#### S25 — `/analisa-item/ppd` (111 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M18-S25-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S25-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S25-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S25-004 | link | visible-default | "Papan Pemuka", → /dashboard, fa-arrow-left | FN-M18-5.1.1 |
| EL-M18-S25-005 | text | visible-default | "/" | FN-M18-5.1.1 |
| EL-M18-S25-006 | text | visible-default | "Analisa Item PPD" | FN-M18-5.1.1 |
| EL-M18-S25-007 | card | visible-default | "PPD KLUANG" | FN-M18-5.1.1 |
| EL-M18-S25-008 | heading | visible-default | "PPD KLUANG" | FN-M18-5.1.1 |
| EL-M18-S25-009 | text | visible-default | "Johor" | FN-M18-5.1.1 |
| EL-M18-S25-010 | text | visible-default | "Laporan Analisa Item Pejabat Pendidikan Daerah — Data Keseluruhan Daerah" | FN-M18-5.1.1 |
| EL-M18-S25-011 | text | visible-default | "118" | FN-M18-5.1.1 |
| EL-M18-S25-012 | text | visible-default | "Sekolah" | FN-M18-5.1.1 |
| EL-M18-S25-013 | text | visible-default | "135" | FN-M18-5.1.1 |
| EL-M18-S25-014 | text | visible-default | "Pelajar" | FN-M18-5.1.1 |
| EL-M18-S25-015 | card | visible-default | "Jumlah Sekolah" | FN-M18-5.1.2 |
| EL-M18-S25-016 | text | visible-default | "Jumlah Sekolah" | FN-M18-5.1.2 |
| EL-M18-S25-017 | text | visible-default | "118" | FN-M18-5.1.2 |
| EL-M18-S25-018 | card | visible-default | "Jumlah Pelajar" | FN-M18-5.1.2 |
| EL-M18-S25-019 | text | visible-default | "Jumlah Pelajar" | FN-M18-5.1.2 |
| EL-M18-S25-020 | text | visible-default | "135" | FN-M18-5.1.2 |
| EL-M18-S25-021 | card | visible-default | "Soalan Dijawab" | FN-M18-5.1.2 |
| EL-M18-S25-022 | text | visible-default | "Soalan Dijawab" | FN-M18-5.1.2 |
| EL-M18-S25-023 | text | visible-default | "10,535" | FN-M18-5.1.2 |
| EL-M18-S25-024 | card | visible-default | "Ketepatan PPD" | FN-M18-5.1.2 |
| EL-M18-S25-025 | text | visible-default | "Ketepatan PPD" | FN-M18-5.1.2 |
| EL-M18-S25-026 | text | visible-default | "71.6%" | FN-M18-5.1.2 |
| EL-M18-S25-027 | card | visible-default | "Perbandingan Sekolah" | FN-M18-5.1.3 |
| EL-M18-S25-028 | heading | visible-default | "Perbandingan Sekolah" | FN-M18-5.1.3 |
| EL-M18-S25-029 | text | visible-default | "Kedudukan sekolah mengikut ketepatan jawapan pelajar" | FN-M18-5.1.3 |
| EL-M18-S25-030 | table | visible-default | table | FN-M18-5.1.3 |
| EL-M18-S25-031 | link | visible-default | "SEKOLAH MENENGAH KEBANGSAAN LAYANG-LAYANG", → /analisa-item/sekolah/8765 | FN-M18-5.1.3 |
| EL-M18-S25-032 | link | visible-default | "SEKOLAH MENENGAH KEBANGSAAN TINGGI KLUANG", → /analisa-item/sekolah/8880 | FN-M18-5.1.3 |
| EL-M18-S25-033 | link | visible-default | "SEKOLAH KEBANGSAAN KAMPONG CHAMEK", → /analisa-item/sekolah/2710 | FN-M18-5.1.3 |
| EL-M18-S25-034 | card | visible-default | "Prestasi Mengikut Subjek" | FN-M18-5.1.4 |
| EL-M18-S25-035 | heading | visible-default | "Prestasi Mengikut Subjek" | FN-M18-5.1.4 |
| EL-M18-S25-036 | text | visible-default | "Perbandingan ketepatan jawapan merentasi semua subjek dalam daerah" | FN-M18-5.1.4 |
| EL-M18-S25-037 | text | visible-default | "Sejarah" | FN-M18-5.1.4 |
| EL-M18-S25-038 | text | visible-default | "70.7%" | FN-M18-5.1.4 |
| EL-M18-S25-039 | text | visible-default | "31 pelajar", fa-users | FN-M18-5.1.4 |
| EL-M18-S25-040 | text | visible-default | "1,154 soalan", fa-list-check | FN-M18-5.1.4 |
| EL-M18-S25-041 | text | visible-default | "649 salah", fa-times-circle | FN-M18-5.1.4 |
| EL-M18-S25-042 | text | visible-default | "Sains" | FN-M18-5.1.4 |
| EL-M18-S25-043 | text | visible-default | "70.9%" | FN-M18-5.1.4 |
| EL-M18-S25-044 | text | visible-default | "29 pelajar", fa-users | FN-M18-5.1.4 |
| EL-M18-S25-045 | text | visible-default | "1,094 soalan", fa-list-check | FN-M18-5.1.4 |
| EL-M18-S25-046 | text | visible-default | "539 salah", fa-times-circle | FN-M18-5.1.4 |
| EL-M18-S25-047 | text | visible-default | "Bahasa Melayu" | FN-M18-5.1.4 |
| EL-M18-S25-048 | text | visible-default | "71.1%" | FN-M18-5.1.4 |
| EL-M18-S25-049 | text | visible-default | "32 pelajar", fa-users | FN-M18-5.1.4 |
| EL-M18-S25-050 | text | visible-default | "545 soalan", fa-list-check | FN-M18-5.1.4 |
| EL-M18-S25-051 | text | visible-default | "634 salah", fa-times-circle | FN-M18-5.1.4 |
| EL-M18-S25-052 | text | visible-default | "Bahasa Inggeris" | FN-M18-5.1.4 |
| EL-M18-S25-053 | text | visible-default | "71.9%" | FN-M18-5.1.4 |
| EL-M18-S25-054 | text | visible-default | "29 pelajar", fa-users | FN-M18-5.1.4 |
| EL-M18-S25-055 | text | visible-default | "851 soalan", fa-list-check | FN-M18-5.1.4 |
| EL-M18-S25-056 | text | visible-default | "539 salah", fa-times-circle | FN-M18-5.1.4 |
| EL-M18-S25-057 | text | visible-default | "Matematik" | FN-M18-5.1.4 |
| EL-M18-S25-058 | text | visible-default | "72.6%" | FN-M18-5.1.4 |
| EL-M18-S25-059 | text | visible-default | "37 pelajar", fa-users | FN-M18-5.1.4 |
| EL-M18-S25-060 | text | visible-default | "828 soalan", fa-list-check | FN-M18-5.1.4 |
| EL-M18-S25-061 | text | visible-default | "631 salah", fa-times-circle | FN-M18-5.1.4 |
| EL-M18-S25-062 | text | visible-default | "Pendidikan Islam" | FN-M18-5.1.4 |
| EL-M18-S25-063 | text | visible-default | "92.3%" | FN-M18-5.1.4 |
| EL-M18-S25-064 | text | visible-default | "1 pelajar", fa-users | FN-M18-5.1.4 |
| EL-M18-S25-065 | text | visible-default | "50 soalan", fa-list-check | FN-M18-5.1.4 |
| EL-M18-S25-066 | text | visible-default | "4 salah", fa-times-circle | FN-M18-5.1.4 |
| EL-M18-S25-067 | card | visible-default | "Soalan Kritikal — Majoriti Pelajar Salah" | FN-M18-5.1.5 |
| EL-M18-S25-068 | heading | visible-default | "Soalan Kritikal — Majoriti Pelajar Salah" | FN-M18-5.1.5 |
| EL-M18-S25-069 | text | visible-default | "Soalan yang perlu intervensi pengajaran segera di peringkat PPD" | FN-M18-5.1.5 |
| EL-M18-S25-070 | text | visible-default | "20 soalan kritikal dijumpai", fa-exclamation-circle | FN-M18-5.1.5 |
| EL-M18-S25-071 | text | visible-default | "1" | FN-M18-5.1.5 |
| EL-M18-S25-072 | text | visible-default | "Prinsip Pascal menyatakan bahawa:" | FN-M18-5.1.5 |
| EL-M18-S25-073 | text | visible-default | "Sains", fa-book-open | FN-M18-5.1.5 |
| EL-M18-S25-074 | text | visible-default | "Tekanan dalam bendalir", fa-bookmark | FN-M18-5.1.5 |
| EL-M18-S25-075 | text | visible-default | "Tekanan dalam bendalir", fa-tag | FN-M18-5.1.5 |
| EL-M18-S25-076 | text | visible-default | "Sukar" | FN-M18-5.1.5 |
| EL-M18-S25-077 | text | visible-default | "100.0% salah", fa-times-circle | FN-M18-5.1.5 |
| EL-M18-S25-078 | text | visible-default | "2 pelajar", fa-users | FN-M18-5.1.5 |
| EL-M18-S25-079 | text | visible-default | "1.5% terlibat", fa-percent | FN-M18-5.1.5 |
| EL-M18-S25-080 | text | visible-default | "2 cubaan", fa-rotate-right | FN-M18-5.1.5 |
| EL-M18-S25-081 | text | visible-default | "Pelajar salah:", fa-user-times | FN-M18-5.1.5 |
| EL-M18-S25-082 | link | visible-default | "<masked>", → /headcount/student/2227, fa-user-graduate | FN-M18-5.1.5 |
| EL-M18-S25-083 | link | visible-default | "<masked>", → /headcount/student/2228, fa-user-graduate | FN-M18-5.1.5 |
| EL-M18-S25-084 | text | visible-default | "2" | FN-M18-5.1.5 |
| EL-M18-S25-085 | text | visible-default | "Kesan rumah hijau disebabkan oleh peningkatan gas:" | FN-M18-5.1.5 |
| EL-M18-S25-086 | text | visible-default | "Sains", fa-book-open | FN-M18-5.1.5 |
| EL-M18-S25-087 | text | visible-default | "Teknologi Hijau untuk Kelestarian Alam Sekitar", fa-bookmark | FN-M18-5.1.5 |
| EL-M18-S25-088 | text | visible-default | "Teknologi hijau dan kehidupan", fa-tag | FN-M18-5.1.5 |
| EL-M18-S25-089 | text | visible-default | "Sukar" | FN-M18-5.1.5 |
| EL-M18-S25-090 | text | visible-default | "100.0% salah", fa-times-circle | FN-M18-5.1.5 |
| EL-M18-S25-091 | text | visible-default | "2 pelajar", fa-users | FN-M18-5.1.5 |
| EL-M18-S25-092 | text | visible-default | "1.5% terlibat", fa-percent | FN-M18-5.1.5 |
| EL-M18-S25-093 | text | visible-default | "2 cubaan", fa-rotate-right | FN-M18-5.1.5 |
| EL-M18-S25-094 | text | visible-default | "Pelajar salah:", fa-user-times | FN-M18-5.1.5 |
| EL-M18-S25-095 | link | visible-default | "<masked>", → /headcount/student/2215, fa-user-graduate | FN-M18-5.1.5 |
| EL-M18-S25-096 | link | visible-default | "<masked>", → /headcount/student/2232, fa-user-graduate | FN-M18-5.1.5 |
| EL-M18-S25-097 | text | visible-default | "3" | FN-M18-5.1.5 |
| EL-M18-S25-098 | text | visible-default | "Katod dalam sel elektrolisis disambungkan kepada terminal:" | FN-M18-5.1.5 |
| EL-M18-S25-099 | text | visible-default | "Sains", fa-book-open | FN-M18-5.1.5 |
| EL-M18-S25-100 | text | visible-default | "Sel elektrolisis", fa-bookmark | FN-M18-5.1.5 |
| EL-M18-S25-101 | text | visible-default | "Minyak sawit", fa-tag | FN-M18-5.1.5 |
| EL-M18-S25-102 | text | visible-default | "Sukar" | FN-M18-5.1.5 |
| EL-M18-S25-103 | text | visible-default | "100.0% salah", fa-times-circle | FN-M18-5.1.5 |
| EL-M18-S25-104 | text | visible-default | "2 pelajar", fa-users | FN-M18-5.1.5 |
| EL-M18-S25-105 | text | visible-default | "1.5% terlibat", fa-percent | FN-M18-5.1.5 |
| EL-M18-S25-106 | text | visible-default | "2 cubaan", fa-rotate-right | FN-M18-5.1.5 |
| EL-M18-S25-107 | text | visible-default | "Pelajar salah:", fa-user-times | FN-M18-5.1.5 |
| EL-M18-S25-108 | link | visible-default | "<masked>", → /headcount/student/2222, fa-user-graduate | FN-M18-5.1.5 |
| EL-M18-S25-109 | link | visible-default | "<masked>", → /headcount/student/2231, fa-user-graduate | FN-M18-5.1.5 |
| EL-M18-S25-110 | toggle | visible-default | "Lihat Semua (20 soalan)", fa-chevron-down | FN-M18-5.1.6 |
| EL-M18-S25-111 | toggle | conditional | "Sembunyikan", fa-chevron-up | FN-M18-5.1.6 |

#### S26 — `/analisa-item/jpn` (106 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M18-S26-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S26-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S26-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S26-004 | link | visible-default | "Papan Pemuka", → /dashboard, fa-arrow-left | FN-M18-5.1.1 |
| EL-M18-S26-005 | text | visible-default | "/" | FN-M18-5.1.1 |
| EL-M18-S26-006 | text | visible-default | "Analisa Item JPN" | FN-M18-5.1.1 |
| EL-M18-S26-007 | card | visible-default | "JPN Johor" | FN-M18-5.1.1 |
| EL-M18-S26-008 | heading | visible-default | "JPN Johor" | FN-M18-5.1.1 |
| EL-M18-S26-009 | text | visible-default | "Laporan Analisa Item Jabatan Pendidikan Negeri — Data Keseluruhan Negeri" | FN-M18-5.1.1 |
| EL-M18-S26-010 | text | visible-default | "1,189" | FN-M18-5.1.1 |
| EL-M18-S26-011 | text | visible-default | "Sekolah" | FN-M18-5.1.1 |
| EL-M18-S26-012 | text | visible-default | "135" | FN-M18-5.1.1 |
| EL-M18-S26-013 | text | visible-default | "Pelajar" | FN-M18-5.1.1 |
| EL-M18-S26-014 | card | visible-default | "Jumlah Sekolah" | FN-M18-5.1.2 |
| EL-M18-S26-015 | text | visible-default | "Jumlah Sekolah" | FN-M18-5.1.2 |
| EL-M18-S26-016 | text | visible-default | "1,189" | FN-M18-5.1.2 |
| EL-M18-S26-017 | card | visible-default | "Jumlah Pelajar" | FN-M18-5.1.2 |
| EL-M18-S26-018 | text | visible-default | "Jumlah Pelajar" | FN-M18-5.1.2 |
| EL-M18-S26-019 | text | visible-default | "135" | FN-M18-5.1.2 |
| EL-M18-S26-020 | card | visible-default | "Soalan Dijawab" | FN-M18-5.1.2 |
| EL-M18-S26-021 | text | visible-default | "Soalan Dijawab" | FN-M18-5.1.2 |
| EL-M18-S26-022 | text | visible-default | "10,535" | FN-M18-5.1.2 |
| EL-M18-S26-023 | card | visible-default | "Ketepatan Negeri" | FN-M18-5.1.2 |
| EL-M18-S26-024 | text | visible-default | "Ketepatan Negeri" | FN-M18-5.1.2 |
| EL-M18-S26-025 | text | visible-default | "71.6%" | FN-M18-5.1.2 |
| EL-M18-S26-026 | card | visible-default | "Perbandingan Daerah (PPD)" | FN-M18-5.1.7 |
| EL-M18-S26-027 | heading | visible-default | "Perbandingan Daerah (PPD)" | FN-M18-5.1.7 |
| EL-M18-S26-028 | text | visible-default | "Kedudukan daerah mengikut ketepatan jawapan pelajar" | FN-M18-5.1.7 |
| EL-M18-S26-029 | table | visible-default | table | FN-M18-5.1.7 |
| EL-M18-S26-030 | card | visible-default | "Prestasi Mengikut Subjek" | FN-M18-5.1.4 |
| EL-M18-S26-031 | heading | visible-default | "Prestasi Mengikut Subjek" | FN-M18-5.1.4 |
| EL-M18-S26-032 | text | visible-default | "Perbandingan ketepatan jawapan merentasi semua subjek dalam negeri" | FN-M18-5.1.4 |
| EL-M18-S26-033 | text | visible-default | "Sejarah" | FN-M18-5.1.4 |
| EL-M18-S26-034 | text | visible-default | "70.7%" | FN-M18-5.1.4 |
| EL-M18-S26-035 | text | visible-default | "31 pelajar", fa-users | FN-M18-5.1.4 |
| EL-M18-S26-036 | text | visible-default | "1,154 soalan", fa-list-check | FN-M18-5.1.4 |
| EL-M18-S26-037 | text | visible-default | "649 salah", fa-times-circle | FN-M18-5.1.4 |
| EL-M18-S26-038 | text | visible-default | "Sains" | FN-M18-5.1.4 |
| EL-M18-S26-039 | text | visible-default | "70.9%" | FN-M18-5.1.4 |
| EL-M18-S26-040 | text | visible-default | "29 pelajar", fa-users | FN-M18-5.1.4 |
| EL-M18-S26-041 | text | visible-default | "1,094 soalan", fa-list-check | FN-M18-5.1.4 |
| EL-M18-S26-042 | text | visible-default | "539 salah", fa-times-circle | FN-M18-5.1.4 |
| EL-M18-S26-043 | text | visible-default | "Bahasa Melayu" | FN-M18-5.1.4 |
| EL-M18-S26-044 | text | visible-default | "71.1%" | FN-M18-5.1.4 |
| EL-M18-S26-045 | text | visible-default | "32 pelajar", fa-users | FN-M18-5.1.4 |
| EL-M18-S26-046 | text | visible-default | "545 soalan", fa-list-check | FN-M18-5.1.4 |
| EL-M18-S26-047 | text | visible-default | "634 salah", fa-times-circle | FN-M18-5.1.4 |
| EL-M18-S26-048 | text | visible-default | "Bahasa Inggeris" | FN-M18-5.1.4 |
| EL-M18-S26-049 | text | visible-default | "71.9%" | FN-M18-5.1.4 |
| EL-M18-S26-050 | text | visible-default | "29 pelajar", fa-users | FN-M18-5.1.4 |
| EL-M18-S26-051 | text | visible-default | "851 soalan", fa-list-check | FN-M18-5.1.4 |
| EL-M18-S26-052 | text | visible-default | "539 salah", fa-times-circle | FN-M18-5.1.4 |
| EL-M18-S26-053 | text | visible-default | "Matematik" | FN-M18-5.1.4 |
| EL-M18-S26-054 | text | visible-default | "72.6%" | FN-M18-5.1.4 |
| EL-M18-S26-055 | text | visible-default | "37 pelajar", fa-users | FN-M18-5.1.4 |
| EL-M18-S26-056 | text | visible-default | "828 soalan", fa-list-check | FN-M18-5.1.4 |
| EL-M18-S26-057 | text | visible-default | "631 salah", fa-times-circle | FN-M18-5.1.4 |
| EL-M18-S26-058 | text | visible-default | "Pendidikan Islam" | FN-M18-5.1.4 |
| EL-M18-S26-059 | text | visible-default | "92.3%" | FN-M18-5.1.4 |
| EL-M18-S26-060 | text | visible-default | "1 pelajar", fa-users | FN-M18-5.1.4 |
| EL-M18-S26-061 | text | visible-default | "50 soalan", fa-list-check | FN-M18-5.1.4 |
| EL-M18-S26-062 | text | visible-default | "4 salah", fa-times-circle | FN-M18-5.1.4 |
| EL-M18-S26-063 | card | visible-default | "Soalan Kritikal — Seluruh Negeri" | FN-M18-5.1.5 |
| EL-M18-S26-064 | heading | visible-default | "Soalan Kritikal — Seluruh Negeri" | FN-M18-5.1.5 |
| EL-M18-S26-065 | text | visible-default | "Soalan yang perlu intervensi pengajaran segera di peringkat JPN" | FN-M18-5.1.5 |
| EL-M18-S26-066 | text | visible-default | "20 soalan kritikal dijumpai", fa-exclamation-circle | FN-M18-5.1.5 |
| EL-M18-S26-067 | text | visible-default | "1" | FN-M18-5.1.5 |
| EL-M18-S26-068 | text | visible-default | "Prinsip Pascal menyatakan bahawa:" | FN-M18-5.1.5 |
| EL-M18-S26-069 | text | visible-default | "Sains", fa-book-open | FN-M18-5.1.5 |
| EL-M18-S26-070 | text | visible-default | "Tekanan dalam bendalir", fa-bookmark | FN-M18-5.1.5 |
| EL-M18-S26-071 | text | visible-default | "Tekanan dalam bendalir", fa-tag | FN-M18-5.1.5 |
| EL-M18-S26-072 | text | visible-default | "Sukar" | FN-M18-5.1.5 |
| EL-M18-S26-073 | text | visible-default | "100.0% salah", fa-times-circle | FN-M18-5.1.5 |
| EL-M18-S26-074 | text | visible-default | "2 pelajar", fa-users | FN-M18-5.1.5 |
| EL-M18-S26-075 | text | visible-default | "1.5% terlibat", fa-percent | FN-M18-5.1.5 |
| EL-M18-S26-076 | text | visible-default | "2 cubaan", fa-rotate-right | FN-M18-5.1.5 |
| EL-M18-S26-077 | text | visible-default | "Pelajar salah:", fa-user-times | FN-M18-5.1.5 |
| EL-M18-S26-078 | link | visible-default | "<masked>", → /headcount/student/2227, fa-user-graduate | FN-M18-5.1.5 |
| EL-M18-S26-079 | link | visible-default | "<masked>", → /headcount/student/2228, fa-user-graduate | FN-M18-5.1.5 |
| EL-M18-S26-080 | text | visible-default | "2" | FN-M18-5.1.5 |
| EL-M18-S26-081 | text | visible-default | "Kesan rumah hijau disebabkan oleh peningkatan gas:" | FN-M18-5.1.5 |
| EL-M18-S26-082 | text | visible-default | "Sains", fa-book-open | FN-M18-5.1.5 |
| EL-M18-S26-083 | text | visible-default | "Teknologi Hijau untuk Kelestarian Alam Sekitar", fa-bookmark | FN-M18-5.1.5 |
| EL-M18-S26-084 | text | visible-default | "Teknologi hijau dan kehidupan", fa-tag | FN-M18-5.1.5 |
| EL-M18-S26-085 | text | visible-default | "Sukar" | FN-M18-5.1.5 |
| EL-M18-S26-086 | text | visible-default | "100.0% salah", fa-times-circle | FN-M18-5.1.5 |
| EL-M18-S26-087 | text | visible-default | "2 pelajar", fa-users | FN-M18-5.1.5 |
| EL-M18-S26-088 | text | visible-default | "1.5% terlibat", fa-percent | FN-M18-5.1.5 |
| EL-M18-S26-089 | text | visible-default | "2 cubaan", fa-rotate-right | FN-M18-5.1.5 |
| EL-M18-S26-090 | text | visible-default | "Pelajar salah:", fa-user-times | FN-M18-5.1.5 |
| EL-M18-S26-091 | link | visible-default | "<masked>", → /headcount/student/2215, fa-user-graduate | FN-M18-5.1.5 |
| EL-M18-S26-092 | link | visible-default | "<masked>", → /headcount/student/2232, fa-user-graduate | FN-M18-5.1.5 |
| EL-M18-S26-093 | text | visible-default | "3" | FN-M18-5.1.5 |
| EL-M18-S26-094 | text | visible-default | "Katod dalam sel elektrolisis disambungkan kepada terminal:" | FN-M18-5.1.5 |
| EL-M18-S26-095 | text | visible-default | "Sains", fa-book-open | FN-M18-5.1.5 |
| EL-M18-S26-096 | text | visible-default | "Sel elektrolisis", fa-bookmark | FN-M18-5.1.5 |
| EL-M18-S26-097 | text | visible-default | "Minyak sawit", fa-tag | FN-M18-5.1.5 |
| EL-M18-S26-098 | text | visible-default | "Sukar" | FN-M18-5.1.5 |
| EL-M18-S26-099 | text | visible-default | "100.0% salah", fa-times-circle | FN-M18-5.1.5 |
| EL-M18-S26-100 | text | visible-default | "2 pelajar", fa-users | FN-M18-5.1.5 |
| EL-M18-S26-101 | text | visible-default | "1.5% terlibat", fa-percent | FN-M18-5.1.5 |
| EL-M18-S26-102 | text | visible-default | "2 cubaan", fa-rotate-right | FN-M18-5.1.5 |
| EL-M18-S26-103 | text | visible-default | "Pelajar salah:", fa-user-times | FN-M18-5.1.5 |
| EL-M18-S26-104 | link | visible-default | "<masked>", → /headcount/student/2222, fa-user-graduate | FN-M18-5.1.5 |
| EL-M18-S26-105 | link | visible-default | "<masked>", → /headcount/student/2231, fa-user-graduate | FN-M18-5.1.5 |
| EL-M18-S26-106 | toggle | visible-default | "Lihat Semua (20 soalan)", fa-chevron-down | FN-M18-5.1.6 |

#### S27 — `/sekolah/{id}/prestasi` (96 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M18-S27-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S27-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S27-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S27-004 | card | visible-default | "←" | FN-M18-5.2.1 |
| EL-M18-S27-005 | link | visible-default | "←", → /prestasi/sekolah | FN-M18-5.2.1 |
| EL-M18-S27-006 | text | visible-default | "🏫" | FN-M18-5.2.1 |
| EL-M18-S27-007 | heading | visible-default | "SEKOLAH MENENGAH KEBANGSAAN TINGGI KLUANG" | FN-M18-5.2.1 |
| EL-M18-S27-008 | text | visible-default | "Dashboard Prestasi Sekolah · 9 kelas · 59 murid" | FN-M18-5.2.1 |
| EL-M18-S27-009 | card | visible-default | "59" | FN-M18-5.2.2 |
| EL-M18-S27-010 | text | visible-default | "59" | FN-M18-5.2.2 |
| EL-M18-S27-011 | text | visible-default | "Murid" | FN-M18-5.2.2 |
| EL-M18-S27-012 | card | visible-default | "2" | FN-M18-5.2.2 |
| EL-M18-S27-013 | text | visible-default | "2" | FN-M18-5.2.2 |
| EL-M18-S27-014 | text | visible-default | "Guru" | FN-M18-5.2.2 |
| EL-M18-S27-015 | card | visible-default | "9" | FN-M18-5.2.2 |
| EL-M18-S27-016 | text | visible-default | "9" | FN-M18-5.2.2 |
| EL-M18-S27-017 | text | visible-default | "Kelas" | FN-M18-5.2.2 |
| EL-M18-S27-018 | card | visible-default | "3" | FN-M18-5.2.2 |
| EL-M18-S27-019 | text | visible-default | "3" | FN-M18-5.2.2 |
| EL-M18-S27-020 | text | visible-default | "Subjek" | FN-M18-5.2.2 |
| EL-M18-S27-021 | card | visible-default | "60" | FN-M18-5.2.2 |
| EL-M18-S27-022 | text | visible-default | "60" | FN-M18-5.2.2 |
| EL-M18-S27-023 | text | visible-default | "Sesi Latihan" | FN-M18-5.2.2 |
| EL-M18-S27-024 | card | visible-default | "675" | FN-M18-5.2.2 |
| EL-M18-S27-025 | text | visible-default | "675" | FN-M18-5.2.2 |
| EL-M18-S27-026 | text | visible-default | "Soalan Dijawab" | FN-M18-5.2.2 |
| EL-M18-S27-027 | card | visible-default | "72.4%" | FN-M18-5.2.2 |
| EL-M18-S27-028 | text | visible-default | "72.4%" | FN-M18-5.2.2 |
| EL-M18-S27-029 | text | visible-default | "Purata Ketepatan" | FN-M18-5.2.2 |
| EL-M18-S27-030 | card | visible-default | "📊 GPS Anggaran" | FN-M18-5.2.3 |
| EL-M18-S27-031 | heading | visible-default | "📊 GPS Anggaran" | FN-M18-5.2.3 |
| EL-M18-S27-032 | text | visible-default | "Gred Purata Sekolah (lebih rendah = lebih baik)" | FN-M18-5.2.3 |
| EL-M18-S27-033 | text | visible-default | "2.49" | FN-M18-5.2.3 |
| EL-M18-S27-034 | text | visible-default | "GPS" | FN-M18-5.2.3 |
| EL-M18-S27-035 | text | visible-default | "Baik" | FN-M18-5.2.3 |
| EL-M18-S27-036 | text | visible-default | "Berdasarkan entri headcount" | FN-M18-5.2.3 |
| EL-M18-S27-037 | text | visible-default | "148" | FN-M18-5.2.3 |
| EL-M18-S27-038 | text | visible-default | "* Anggaran dari markah OTR, bukan SPM sebenar" | FN-M18-5.2.3 |
| EL-M18-S27-039 | card | visible-default | "📈 Taburan Gred (Anggaran)" | FN-M18-5.2.4 |
| EL-M18-S27-040 | heading | visible-default | "📈 Taburan Gred (Anggaran)" | FN-M18-5.2.4 |
| EL-M18-S27-041 | text | visible-default | "A+" | FN-M18-5.2.4 |
| EL-M18-S27-042 | text | visible-default | "4" | FN-M18-5.2.4 |
| EL-M18-S27-043 | text | visible-default | "2.7%" | FN-M18-5.2.4 |
| EL-M18-S27-044 | text | visible-default | "A" | FN-M18-5.2.4 |
| EL-M18-S27-045 | text | visible-default | "36" | FN-M18-5.2.4 |
| EL-M18-S27-046 | text | visible-default | "24.3%" | FN-M18-5.2.4 |
| EL-M18-S27-047 | text | visible-default | "A-" | FN-M18-5.2.4 |
| EL-M18-S27-048 | text | visible-default | "42" | FN-M18-5.2.4 |
| EL-M18-S27-049 | text | visible-default | "28.4%" | FN-M18-5.2.4 |
| EL-M18-S27-050 | text | visible-default | "B+" | FN-M18-5.2.4 |
| EL-M18-S27-051 | text | visible-default | "36" | FN-M18-5.2.4 |
| EL-M18-S27-052 | text | visible-default | "24.3%" | FN-M18-5.2.4 |
| EL-M18-S27-053 | text | visible-default | "B" | FN-M18-5.2.4 |
| EL-M18-S27-054 | text | visible-default | "18" | FN-M18-5.2.4 |
| EL-M18-S27-055 | text | visible-default | "12.2%" | FN-M18-5.2.4 |
| EL-M18-S27-056 | text | visible-default | "C+" | FN-M18-5.2.4 |
| EL-M18-S27-057 | text | visible-default | "6" | FN-M18-5.2.4 |
| EL-M18-S27-058 | text | visible-default | "4.1%" | FN-M18-5.2.4 |
| EL-M18-S27-059 | text | visible-default | "C" | FN-M18-5.2.4 |
| EL-M18-S27-060 | text | visible-default | "4" | FN-M18-5.2.4 |
| EL-M18-S27-061 | text | visible-default | "2.7%" | FN-M18-5.2.4 |
| EL-M18-S27-062 | text | visible-default | "D" | FN-M18-5.2.4 |
| EL-M18-S27-063 | text | visible-default | "1" | FN-M18-5.2.4 |
| EL-M18-S27-064 | text | visible-default | "0.7%" | FN-M18-5.2.4 |
| EL-M18-S27-065 | text | visible-default | "E" | FN-M18-5.2.4 |
| EL-M18-S27-066 | text | visible-default | "1" | FN-M18-5.2.4 |
| EL-M18-S27-067 | text | visible-default | "0.7%" | FN-M18-5.2.4 |
| EL-M18-S27-068 | text | visible-default | "G" | FN-M18-5.2.4 |
| EL-M18-S27-069 | text | visible-default | "0" | FN-M18-5.2.4 |
| EL-M18-S27-070 | text | visible-default | "0%" | FN-M18-5.2.4 |
| EL-M18-S27-071 | text | visible-default | "Jumlah: 148 rekod" | FN-M18-5.2.4 |
| EL-M18-S27-072 | card | visible-default | "📚 GPS Mengikut Subjek" | FN-M18-5.2.5 |
| EL-M18-S27-073 | heading | visible-default | "📚 GPS Mengikut Subjek" | FN-M18-5.2.5 |
| EL-M18-S27-074 | table | visible-default | table | FN-M18-5.2.5 |
| EL-M18-S27-075 | card | visible-default | "🎓 Perbandingan Tingkatan" | FN-M18-5.2.6 |
| EL-M18-S27-076 | heading | visible-default | "🎓 Perbandingan Tingkatan" | FN-M18-5.2.6 |
| EL-M18-S27-077 | link | visible-default | "Tingkatan 4 63.9% 4 kelas 143 murid 10 sesi latihan", → /prestasi/tingkatan/t4 | FN-M18-5.2.6 |
| EL-M18-S27-078 | link | visible-default | "Tingkatan 5 73.5% 5 kelas 113 murid 85 sesi latihan", → /prestasi/tingkatan/t5 | FN-M18-5.2.6 |
| EL-M18-S27-079 | card | visible-default | "👩‍🏫 Prestasi Guru" | FN-M18-5.2.7 |
| EL-M18-S27-080 | heading | visible-default | "👩‍🏫 Prestasi Guru" | FN-M18-5.2.7 |
| EL-M18-S27-081 | link | visible-default | "<masked>", → /prestasi/sekolah/8880/guru/13 | FN-M18-5.2.7 |
| EL-M18-S27-082 | text | visible-default | "5 kelas · 151 murid" | FN-M18-5.2.7 |
| EL-M18-S27-083 | text | visible-default | "Ketepatan:" | FN-M18-5.2.7 |
| EL-M18-S27-084 | text | visible-default | "75.7%" | FN-M18-5.2.7 |
| EL-M18-S27-085 | empty-state | visible-default | "Tiada data headcount" | FN-M18-5.2.7 |
| EL-M18-S27-086 | link | visible-default | "<masked>", → /prestasi/sekolah/8880/guru/197 | FN-M18-5.2.7 |
| EL-M18-S27-087 | text | visible-default | "4 kelas · 30 murid" | FN-M18-5.2.7 |
| EL-M18-S27-088 | text | visible-default | "Ketepatan:" | FN-M18-5.2.7 |
| EL-M18-S27-089 | text | visible-default | "72.1%" | FN-M18-5.2.7 |
| EL-M18-S27-090 | text | visible-default | "On Track:" | FN-M18-5.2.7 |
| EL-M18-S27-091 | text | visible-default | "42" | FN-M18-5.2.7 |
| EL-M18-S27-092 | text | visible-default | "Below:" | FN-M18-5.2.7 |
| EL-M18-S27-093 | text | visible-default | "37" | FN-M18-5.2.7 |
| EL-M18-S27-094 | card | visible-default | "🔗 Navigasi Pantas" | FN-M18-5.2.8 |
| EL-M18-S27-095 | heading | visible-default | "🔗 Navigasi Pantas" | FN-M18-5.2.8 |
| EL-M18-S27-096 | link | visible-default | "🔬 Analisa Item", → /sekolah/8880/analisa-item | FN-M18-5.2.8 |

#### S28 — `/sekolah/{id}/amaran` (39 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M18-S28-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S28-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S28-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S28-004 | link | visible-default | "Semua Tingkatan", → /sekolah/8880/amaran | FN-M18-4.6.1 |
| EL-M18-S28-005 | link | visible-default | "Tingkatan 4", → /sekolah/8880/amaran?tingkatan=T4 | FN-M18-4.6.1 |
| EL-M18-S28-006 | link | visible-default | "Tingkatan 5", → /sekolah/8880/amaran?tingkatan=T5 | FN-M18-4.6.1 |
| EL-M18-S28-007 | text | visible-default | "59" | FN-M18-4.6.2 |
| EL-M18-S28-008 | text | visible-default | "Jumlah Pelajar" | FN-M18-4.6.2 |
| EL-M18-S28-009 | text | visible-default | "0" | FN-M18-4.6.2 |
| EL-M18-S28-010 | text | visible-default | "On Track" | FN-M18-4.6.2 |
| EL-M18-S28-011 | text | visible-default | "0" | FN-M18-4.6.2 |
| EL-M18-S28-012 | text | visible-default | "Perlu Perhatian" | FN-M18-4.6.2 |
| EL-M18-S28-013 | text | visible-default | "59" | FN-M18-4.6.2 |
| EL-M18-S28-014 | text | visible-default | "Berisiko Tinggi" | FN-M18-4.6.2 |
| EL-M18-S28-015 | card | visible-default | "Taburan Risiko Seluruh Sekolah" | FN-M18-4.6.3 |
| EL-M18-S28-016 | heading | visible-default | "Taburan Risiko Seluruh Sekolah" | FN-M18-4.6.3 |
| EL-M18-S28-017 | text | visible-default | "100%" | FN-M18-4.6.3 |
| EL-M18-S28-018 | text | visible-default | "Hijau: 0" | FN-M18-4.6.3 |
| EL-M18-S28-019 | text | visible-default | "Kuning: 0" | FN-M18-4.6.3 |
| EL-M18-S28-020 | text | visible-default | "Merah: 59" | FN-M18-4.6.3 |
| EL-M18-S28-021 | link | visible-default | "Keberkesanan Intervensi", → /amaran/keberkesanan, fa-chart-pie | FN-M18-4.6.4 |
| EL-M18-S28-022 | link | visible-default | "Ringkasan Eksekutif", → /amaran/ringkasan-eksekutif?scope=school&school_id=8880, fa-file-alt | FN-M18-4.6.4 |
| EL-M18-S28-023 | link | visible-default | "Muat Turun CSV", → /amaran/export/school/8880, fa-download | FN-M18-4.9.3 |
| EL-M18-S28-024 | card | visible-default | "Analisis Risiko Mengikut Subjek" | FN-M18-4.6.6 |
| EL-M18-S28-025 | heading | visible-default | "Analisis Risiko Mengikut Subjek" | FN-M18-4.6.6 |
| EL-M18-S28-026 | text | visible-default | "Bahasa Melayu" | FN-M18-4.6.6 |
| EL-M18-S28-027 | text | visible-default | "1/1 pelajar lemah (100%)" | FN-M18-4.6.6 |
| EL-M18-S28-028 | text | visible-default | "Bahasa Inggeris" | FN-M18-4.6.6 |
| EL-M18-S28-029 | text | visible-default | "1/1 pelajar lemah (100%)" | FN-M18-4.6.6 |
| EL-M18-S28-030 | text | visible-default | "Matematik" | FN-M18-4.6.6 |
| EL-M18-S28-031 | text | visible-default | "1/1 pelajar lemah (100%)" | FN-M18-4.6.6 |
| EL-M18-S28-032 | card | visible-default | "Senarai Pelajar Berisiko" | FN-M18-4.6.5 |
| EL-M18-S28-033 | heading | visible-default | "Senarai Pelajar Berisiko" | FN-M18-4.6.5 |
| EL-M18-S28-034 | text | visible-default | "Disusun mengikut skor risiko tertinggi" | FN-M18-4.6.5 |
| EL-M18-S28-035 | table | visible-default | table | FN-M18-4.6.5 |
| EL-M18-S28-036 | badge | visible-default | "Berisiko Tinggi" | FN-M18-4.6.5 |
| EL-M18-S28-037 | badge | visible-default | "Berisiko Tinggi" | FN-M18-4.6.5 |
| EL-M18-S28-038 | badge | visible-default | "Berisiko Tinggi" | FN-M18-4.6.5 |
| EL-M18-S28-039 | text | conditional | "Merah: 15" | FN-M18-4.6.3 |

#### S29 — `/sekolah/{id}/kombo` (44 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M18-S29-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S29-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S29-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S29-004 | text | visible-default | "59" | FN-M18-6.2.1 |
| EL-M18-S29-005 | text | visible-default | "Jumlah Pelajar" | FN-M18-6.2.1 |
| EL-M18-S29-006 | text | visible-default | "0" | FN-M18-6.2.1 |
| EL-M18-S29-007 | text | visible-default | "Aktif Hari Ini" | FN-M18-6.2.1 |
| EL-M18-S29-008 | text | visible-default | "6.4" | FN-M18-6.2.1 |
| EL-M18-S29-009 | text | visible-default | "Purata Kombo" | FN-M18-6.2.1 |
| EL-M18-S29-010 | text | visible-default | "13" | FN-M18-6.2.1 |
| EL-M18-S29-011 | text | visible-default | "Kombo Tertinggi" | FN-M18-6.2.1 |
| EL-M18-S29-012 | text | visible-default | "14" | FN-M18-6.2.1 |
| EL-M18-S29-013 | text | visible-default | "Pelajar Aktif Kombo" | FN-M18-6.2.1 |
| EL-M18-S29-014 | card | visible-default | "Aktiviti Harian Sekolah" | FN-M18-6.2.2 |
| EL-M18-S29-015 | heading | visible-default | "Aktiviti Harian Sekolah" | FN-M18-6.2.2 |
| EL-M18-S29-016 | text | visible-default | "Sep" | FN-M18-6.2.2 |
| EL-M18-S29-017 | text | visible-default | "Okt" | FN-M18-6.2.2 |
| EL-M18-S29-018 | text | visible-default | "Nov" | FN-M18-6.2.2 |
| EL-M18-S29-019 | text | visible-default | "Dis" | FN-M18-6.2.2 |
| EL-M18-S29-020 | text | visible-default | "Jan" | FN-M18-6.2.2 |
| EL-M18-S29-021 | text | visible-default | "Feb" | FN-M18-6.2.2 |
| EL-M18-S29-022 | text | visible-default | "Mac" | FN-M18-6.2.2 |
| EL-M18-S29-023 | text | visible-default | "Apr" | FN-M18-6.2.2 |
| EL-M18-S29-024 | text | visible-default | "Mei" | FN-M18-6.2.2 |
| EL-M18-S29-025 | text | visible-default | "Jun" | FN-M18-6.2.2 |
| EL-M18-S29-026 | text | visible-default | "Jul" | FN-M18-6.2.2 |
| EL-M18-S29-027 | text | visible-default | "Ogs" | FN-M18-6.2.2 |
| EL-M18-S29-028 | text | visible-default | "Sep" | FN-M18-6.2.2 |
| EL-M18-S29-029 | text | visible-default | "Isn" | FN-M18-6.2.2 |
| EL-M18-S29-030 | text | visible-default | "Rab" | FN-M18-6.2.2 |
| EL-M18-S29-031 | text | visible-default | "Jum" | FN-M18-6.2.2 |
| EL-M18-S29-032 | text | visible-default | "Ahd" | FN-M18-6.2.2 |
| EL-M18-S29-033 | clickable | visible-default | clickable | FN-M18-6.2.2 |
| EL-M18-S29-034 | clickable | visible-default | clickable | FN-M18-6.2.2 |
| EL-M18-S29-035 | clickable | visible-default | clickable | FN-M18-6.2.2 |
| EL-M18-S29-036 | text | visible-default | "Kurang" | FN-M18-6.2.2 |
| EL-M18-S29-037 | text | visible-default | "Lebih" | FN-M18-6.2.2 |
| EL-M18-S29-038 | text | visible-default | "Warna menunjukkan bilangan soalan betul seluruh sekolah setiap hari" | FN-M18-6.2.2 |
| EL-M18-S29-039 | card | visible-default | "Perbandingan Kelas" | FN-M18-6.2.3 |
| EL-M18-S29-040 | heading | visible-default | "Perbandingan Kelas" | FN-M18-6.2.3 |
| EL-M18-S29-041 | table | visible-default | table | FN-M18-6.2.3 |
| EL-M18-S29-042 | card | visible-default | "Top 10 Kombo Sekolah" | FN-M18-6.2.4 |
| EL-M18-S29-043 | heading | visible-default | "Top 10 Kombo Sekolah" | FN-M18-6.2.4 |
| EL-M18-S29-044 | table | visible-default | table | FN-M18-6.2.4 |

#### S30 — `/sekolah/{id}/analisa-item` (93 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M18-S30-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S30-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S30-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S30-004 | link | visible-default | "Papan Pemuka", → /dashboard, fa-arrow-left | FN-M18-5.3.1 |
| EL-M18-S30-005 | text | visible-default | "/" | FN-M18-5.3.1 |
| EL-M18-S30-006 | text | visible-default | "Analisa Item Sekolah" | FN-M18-5.3.1 |
| EL-M18-S30-007 | card | visible-default | "SEKOLAH MENENGAH KEBANGSAAN TINGGI KLUANG" | FN-M18-5.3.1 |
| EL-M18-S30-008 | heading | visible-default | "SEKOLAH MENENGAH KEBANGSAAN TINGGI KLUANG" | FN-M18-5.3.1 |
| EL-M18-S30-009 | text | visible-default | "JEB2037" | FN-M18-5.3.1 |
| EL-M18-S30-010 | text | visible-default | "SMK" | FN-M18-5.3.1 |
| EL-M18-S30-011 | text | visible-default | "PPD KLUANG • Johor" | FN-M18-5.3.1 |
| EL-M18-S30-012 | text | visible-default | "59" | FN-M18-5.3.1 |
| EL-M18-S30-013 | text | visible-default | "Pelajar" | FN-M18-5.3.1 |
| EL-M18-S30-014 | text | visible-default | "10,194" | FN-M18-5.3.1 |
| EL-M18-S30-015 | text | visible-default | "Jawapan" | FN-M18-5.3.1 |
| EL-M18-S30-016 | text | visible-default | "Tingkatan:", fa-graduation-cap | FN-M18-5.3.2 |
| EL-M18-S30-017 | link | visible-default | "Semua", → /sekolah/8880/analisa-item | FN-M18-5.3.2 |
| EL-M18-S30-018 | link | visible-default | "Tingkatan 4", → /sekolah/8880/analisa-item?tingkatan=T4 | FN-M18-5.3.2 |
| EL-M18-S30-019 | link | visible-default | "Tingkatan 5", → /sekolah/8880/analisa-item?tingkatan=T5 | FN-M18-5.3.2 |
| EL-M18-S30-020 | card | visible-default | "Jumlah Pelajar" | FN-M18-5.3.3 |
| EL-M18-S30-021 | text | visible-default | "Jumlah Pelajar" | FN-M18-5.3.3 |
| EL-M18-S30-022 | text | visible-default | "59" | FN-M18-5.3.3 |
| EL-M18-S30-023 | card | visible-default | "Soalan Dijawab" | FN-M18-5.3.3 |
| EL-M18-S30-024 | text | visible-default | "Soalan Dijawab" | FN-M18-5.3.3 |
| EL-M18-S30-025 | text | visible-default | "10,194" | FN-M18-5.3.3 |
| EL-M18-S30-026 | card | visible-default | "Ketepatan Keseluruhan" | FN-M18-5.3.3 |
| EL-M18-S30-027 | text | visible-default | "Ketepatan Keseluruhan" | FN-M18-5.3.3 |
| EL-M18-S30-028 | text | visible-default | "71.7%" | FN-M18-5.3.3 |
| EL-M18-S30-029 | card | visible-default | "Profil Kesukaran" | FN-M18-5.3.4 |
| EL-M18-S30-030 | text | visible-default | "Profil Kesukaran" | FN-M18-5.3.4 |
| EL-M18-S30-031 | tooltip | visible-default | "Mudah: 0" | FN-M18-5.3.4 |
| EL-M18-S30-032 | tooltip | visible-default | "Sederhana: 0" | FN-M18-5.3.4 |
| EL-M18-S30-033 | tooltip | visible-default | "Sukar: 20" | FN-M18-5.3.4 |
| EL-M18-S30-034 | text | visible-default | "0" | FN-M18-5.3.4 |
| EL-M18-S30-035 | text | visible-default | "0" | FN-M18-5.3.4 |
| EL-M18-S30-036 | text | visible-default | "20" | FN-M18-5.3.4 |
| EL-M18-S30-037 | text | visible-default | "Mudah" | FN-M18-5.3.4 |
| EL-M18-S30-038 | text | visible-default | "Sederhana" | FN-M18-5.3.4 |
| EL-M18-S30-039 | text | visible-default | "Sukar" | FN-M18-5.3.4 |
| EL-M18-S30-040 | card | visible-default | "GPS Anggaran Sekolah" | FN-M18-5.3.5 |
| EL-M18-S30-041 | text | visible-default | "GPS Anggaran Sekolah" | FN-M18-5.3.5 |
| EL-M18-S30-042 | text | visible-default | "3.45" | FN-M18-5.3.5 |
| EL-M18-S30-043 | text | visible-default | "Baik" | FN-M18-5.3.5 |
| EL-M18-S30-044 | text | visible-default | "Berdasarkan 744 entri headcount • Lebih rendah = lebih baik" | FN-M18-5.3.5 |
| EL-M18-S30-045 | tooltip | visible-default | "2022: 5.20" | FN-M18-5.3.5 |
| EL-M18-S30-046 | text | visible-default | "22" | FN-M18-5.3.5 |
| EL-M18-S30-047 | tooltip | visible-default | "2023: 4.80" | FN-M18-5.3.5 |
| EL-M18-S30-048 | text | visible-default | "23" | FN-M18-5.3.5 |
| EL-M18-S30-049 | tooltip | visible-default | "2024: 4.50" | FN-M18-5.3.5 |
| EL-M18-S30-050 | text | visible-default | "24" | FN-M18-5.3.5 |
| EL-M18-S30-051 | link | visible-default | "Prestasi 360", → /sekolah/8880/prestasi, fa-chart-pie | FN-M18-5.3.5 |
| EL-M18-S30-052 | card | visible-default | "Prestasi Mengikut Subjek" | FN-M18-5.3.6 |
| EL-M18-S30-053 | heading | visible-default | "Prestasi Mengikut Subjek" | FN-M18-5.3.6 |
| EL-M18-S30-054 | text | visible-default | "Ringkasan ketepatan dan jawapan salah bagi setiap subjek" | FN-M18-5.3.6 |
| EL-M18-S30-055 | table | visible-default | table | FN-M18-5.3.6 |
| EL-M18-S30-056 | card | visible-default | "Soalan Paling Banyak Salah — Perlu Perhatian Khas" | FN-M18-5.3.7 |
| EL-M18-S30-057 | heading | visible-default | "Soalan Paling Banyak Salah — Perlu Perhatian Khas" | FN-M18-5.3.7 |
| EL-M18-S30-058 | text | visible-default | "Soalan yang majoriti pelajar jawab salah. Fokuskan pengajaran khas di sini." | FN-M18-5.3.7 |
| EL-M18-S30-059 | text | visible-default | "Tapis:", fa-filter | FN-M18-5.3.7 |
| EL-M18-S30-060 | button | visible-default | "Semua (20)" | FN-M18-5.3.7 |
| EL-M18-S30-061 | button | visible-default | "Bahasa Melayu (13)" | FN-M18-5.3.7 |
| EL-M18-S30-062 | button | visible-default | "Sains (6)" | FN-M18-5.3.7 |
| EL-M18-S30-063 | button | visible-default | "Sejarah (1)" | FN-M18-5.3.7 |
| EL-M18-S30-064 | clickable | visible-default | "1 Prinsip Pascal menyatakan bahawa: Sains Tekanan dalam bendalir Tekanan dalam b …", fa-frown | FN-M18-5.3.8 |
| EL-M18-S30-065 | clickable | conditional | "A Jawapan Betul Tekanan dalam cecair tertutup dipindahkan sama rata ke semua bah …", fa-exclamation-triangle | FN-M18-5.3.8 |
| EL-M18-S30-066 | link | conditional | "<masked> <masked> <masked>", → /prestasi/2227, fa-user | FN-M18-5.3.8 |
| EL-M18-S30-067 | link | conditional | "<masked> <masked> <masked>", → /prestasi/2228, fa-user | FN-M18-5.3.8 |
| EL-M18-S30-068 | clickable | visible-default | "2 Kesan rumah hijau disebabkan oleh peningkatan gas: Sains Teknologi Hijau untuk …", fa-frown | FN-M18-5.3.8 |
| EL-M18-S30-069 | clickable | hidden-only | "D Jawapan Betul Karbon dioksida dan metana B Jawapan Salah Paling Popular (1x di …", fa-exclamation-triangle | FN-M18-5.3.8 |
| EL-M18-S30-070 | link | hidden-only | "<masked> <masked> <masked>", → /prestasi/2215, fa-user | FN-M18-5.3.8 |
| EL-M18-S30-071 | link | hidden-only | "<masked> <masked> <masked>", → /prestasi/2232, fa-user | FN-M18-5.3.8 |
| EL-M18-S30-072 | clickable | visible-default | "3 Katod dalam sel elektrolisis disambungkan kepada terminal: Sains Sel elektroli …", fa-frown | FN-M18-5.3.8 |
| EL-M18-S30-073 | clickable | hidden-only | "B Jawapan Betul Negatif C Jawapan Salah Paling Popular (1x dipilih) Bumi Pelajar …", fa-exclamation-triangle | FN-M18-5.3.8 |
| EL-M18-S30-074 | link | hidden-only | "<masked> <masked> <masked>", → /prestasi/2222, fa-user | FN-M18-5.3.8 |
| EL-M18-S30-075 | link | hidden-only | "<masked> <masked> <masked>", → /prestasi/2231, fa-user | FN-M18-5.3.8 |
| EL-M18-S30-076 | card | conditional | "Sekolah Tidak Dinyatakan" | FN-M18-1.2.8 |
| EL-M18-S30-077 | heading | conditional | "Sekolah Tidak Dinyatakan" | FN-M18-1.2.8 |
| EL-M18-S30-078 | text | conditional | "Maklumat sekolah tidak tersedia" | FN-M18-1.2.8 |
| EL-M18-S30-079 | card | conditional | "Tiada Data Pelajar" | FN-M18-5.3.9 |
| EL-M18-S30-080 | heading | conditional | "Tiada Data Pelajar" | FN-M18-5.3.9 |
| EL-M18-S30-081 | empty-state | conditional | "Tiada data pelajar untuk sekolah ini. Pastikan pelajar telah berdaftar dan menja …" | FN-M18-5.3.9 |
| EL-M18-S30-082 | text | conditional | "76.3%" | FN-M18-5.3.3 |
| EL-M18-S30-083 | button | conditional | "Bahasa Inggeris (1)" | FN-M18-5.3.7 |
| EL-M18-S30-084 | button | conditional | "Bahasa Melayu (11)" | FN-M18-5.3.7 |
| EL-M18-S30-085 | button | conditional | "Sains (2)" | FN-M18-5.3.7 |
| EL-M18-S30-086 | button | conditional | "Sejarah (6)" | FN-M18-5.3.7 |
| EL-M18-S30-087 | clickable | conditional | "2 Awalan "pe-" dalam kata "penulis" bermaksud... Bahasa Melayu Kemahiran Bahasa  …", fa-frown | FN-M18-5.3.8 |
| EL-M18-S30-088 | clickable | hidden-only | "C Jawapan Betul orang yang melakukan B Jawapan Salah Paling Popular (4x dipilih) …", fa-exclamation-triangle | FN-M18-5.3.8 |
| EL-M18-S30-089 | clickable | conditional | "3 Awalan "se-" dalam kata "sebuku" bermakna... Bahasa Melayu Kemahiran Bahasa Ti …", fa-frown | FN-M18-5.3.8 |
| EL-M18-S30-090 | clickable | hidden-only | "D Jawapan Betul satu atau sama banyak A Jawapan Salah Paling Popular (2x dipilih …", fa-exclamation-triangle | FN-M18-5.3.8 |
| EL-M18-S30-091 | link | hidden-only | "<masked> <masked> <masked>", → /prestasi/2221, fa-user | FN-M18-5.3.8 |
| EL-M18-S30-092 | link | hidden-only | "<masked> <masked> <masked>", → /prestasi/2228, fa-user | FN-M18-5.3.8 |
| EL-M18-S30-093 | link | hidden-only | "<masked> <masked> <masked>", → /prestasi/2229, fa-user | FN-M18-5.3.8 |

#### S31 — `/kombo/ppd` (26 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M18-S31-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S31-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S31-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S31-004 | link | visible-default | "Papan Pemuka", → /dashboard, fa-arrow-left | FN-M18-6.1.1 |
| EL-M18-S31-005 | text | visible-default | "/" | FN-M18-6.1.1 |
| EL-M18-S31-006 | text | visible-default | "Kombo Harian PPD" | FN-M18-6.1.1 |
| EL-M18-S31-007 | card | visible-default | "Kombo Harian — PPD BATANG PADANG" | FN-M18-6.1.1 |
| EL-M18-S31-008 | heading | visible-default | "Kombo Harian — PPD BATANG PADANG" | FN-M18-6.1.1 |
| EL-M18-S31-009 | text | visible-default | "Gambaran keseluruhan aktiviti kombo latihan pelajar seluruh daerah" | FN-M18-6.1.1 |
| EL-M18-S31-010 | text | visible-default | "33" | FN-M18-6.1.1 |
| EL-M18-S31-011 | text | visible-default | "Jumlah Pelajar" | FN-M18-6.1.1 |
| EL-M18-S31-012 | text | visible-default | "0" | FN-M18-6.1.1 |
| EL-M18-S31-013 | text | visible-default | "Berlatih Hari Ini" | FN-M18-6.1.1 |
| EL-M18-S31-014 | text | visible-default | "29" | FN-M18-6.1.1 |
| EL-M18-S31-015 | text | visible-default | "Kombo Aktif" | FN-M18-6.1.1 |
| EL-M18-S31-016 | text | visible-default | "6" | FN-M18-6.1.1 |
| EL-M18-S31-017 | text | visible-default | "Purata Kombo" | FN-M18-6.1.1 |
| EL-M18-S31-018 | text | visible-default | "15" | FN-M18-6.1.1 |
| EL-M18-S31-019 | text | visible-default | "Kombo Tertinggi" | FN-M18-6.1.1 |
| EL-M18-S31-020 | card | visible-default | "Perbandingan Sekolah" | FN-M18-6.1.2 |
| EL-M18-S31-021 | heading | visible-default | "Perbandingan Sekolah" | FN-M18-6.1.2 |
| EL-M18-S31-022 | text | visible-default | "Kedudukan sekolah mengikut bilangan kombo aktif" | FN-M18-6.1.2 |
| EL-M18-S31-023 | table | visible-default | table | FN-M18-6.1.2 |
| EL-M18-S31-024 | link | visible-default | "SEKOLAH MENENGAH KEBANGSAAN HAMID KHAN", → /kombo/sekolah/7780 | FN-M18-6.1.2 |
| EL-M18-S31-025 | link | visible-default | "SEKOLAH KEBANGSAAN TOH TANDEWA SAKTI", → /kombo/sekolah/1 | FN-M18-6.1.2 |
| EL-M18-S31-026 | link | visible-default | "SEKOLAH KEBANGSAAN PENDITA ZA'BA", → /kombo/sekolah/2 | FN-M18-6.1.2 |

#### S32 — `/kombo/jpn` (26 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M18-S32-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S32-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S32-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S32-004 | link | visible-default | "Papan Pemuka", → /dashboard, fa-arrow-left | FN-M18-6.1.1 |
| EL-M18-S32-005 | text | visible-default | "/" | FN-M18-6.1.1 |
| EL-M18-S32-006 | text | visible-default | "Kombo Harian JPN" | FN-M18-6.1.1 |
| EL-M18-S32-007 | card | visible-default | "Kombo Harian — JPN Perak" | FN-M18-6.1.1 |
| EL-M18-S32-008 | heading | visible-default | "Kombo Harian — JPN Perak" | FN-M18-6.1.1 |
| EL-M18-S32-009 | text | visible-default | "Gambaran keseluruhan aktiviti kombo latihan pelajar seluruh negeri" | FN-M18-6.1.1 |
| EL-M18-S32-010 | text | visible-default | "33" | FN-M18-6.1.1 |
| EL-M18-S32-011 | text | visible-default | "Jumlah Pelajar" | FN-M18-6.1.1 |
| EL-M18-S32-012 | text | visible-default | "0" | FN-M18-6.1.1 |
| EL-M18-S32-013 | text | visible-default | "Berlatih Hari Ini" | FN-M18-6.1.1 |
| EL-M18-S32-014 | text | visible-default | "29" | FN-M18-6.1.1 |
| EL-M18-S32-015 | text | visible-default | "Kombo Aktif" | FN-M18-6.1.1 |
| EL-M18-S32-016 | text | visible-default | "6" | FN-M18-6.1.1 |
| EL-M18-S32-017 | text | visible-default | "Purata Kombo" | FN-M18-6.1.1 |
| EL-M18-S32-018 | text | visible-default | "15" | FN-M18-6.1.1 |
| EL-M18-S32-019 | text | visible-default | "Kombo Tertinggi" | FN-M18-6.1.1 |
| EL-M18-S32-020 | card | visible-default | "Perbandingan Sekolah" | FN-M18-6.1.2 |
| EL-M18-S32-021 | heading | visible-default | "Perbandingan Sekolah" | FN-M18-6.1.2 |
| EL-M18-S32-022 | text | visible-default | "Kedudukan sekolah mengikut bilangan kombo aktif" | FN-M18-6.1.2 |
| EL-M18-S32-023 | table | visible-default | table | FN-M18-6.1.2 |
| EL-M18-S32-024 | link | visible-default | "SEKOLAH MENENGAH KEBANGSAAN HAMID KHAN", → /kombo/sekolah/7780 | FN-M18-6.1.2 |
| EL-M18-S32-025 | link | visible-default | "SEKOLAH KEBANGSAAN TOH TANDEWA SAKTI", → /kombo/sekolah/1 | FN-M18-6.1.2 |
| EL-M18-S32-026 | link | visible-default | "SEKOLAH KEBANGSAAN PENDITA ZA'BA", → /kombo/sekolah/2 | FN-M18-6.1.2 |

#### S33 — `/kombo/sekolah/{id}` (51 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M18-S33-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S33-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S33-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M18-S33-004 | text | visible-default | "17" | FN-M18-6.2.1 |
| EL-M18-S33-005 | text | visible-default | "Jumlah Pelajar" | FN-M18-6.2.1 |
| EL-M18-S33-006 | text | visible-default | "0" | FN-M18-6.2.1 |
| EL-M18-S33-007 | text | visible-default | "Aktif Hari Ini" | FN-M18-6.2.1 |
| EL-M18-S33-008 | text | visible-default | "7" | FN-M18-6.2.1 |
| EL-M18-S33-009 | text | visible-default | "Purata Kombo" | FN-M18-6.2.1 |
| EL-M18-S33-010 | text | visible-default | "15" | FN-M18-6.2.1 |
| EL-M18-S33-011 | text | visible-default | "Kombo Tertinggi" | FN-M18-6.2.1 |
| EL-M18-S33-012 | text | visible-default | "15" | FN-M18-6.2.1 |
| EL-M18-S33-013 | text | visible-default | "Pelajar Aktif Kombo" | FN-M18-6.2.1 |
| EL-M18-S33-014 | card | visible-default | "Aktiviti Harian Sekolah" | FN-M18-6.2.2 |
| EL-M18-S33-015 | heading | visible-default | "Aktiviti Harian Sekolah" | FN-M18-6.2.2 |
| EL-M18-S33-016 | text | visible-default | "Sep" | FN-M18-6.2.2 |
| EL-M18-S33-017 | text | visible-default | "Okt" | FN-M18-6.2.2 |
| EL-M18-S33-018 | text | visible-default | "Nov" | FN-M18-6.2.2 |
| EL-M18-S33-019 | text | visible-default | "Dis" | FN-M18-6.2.2 |
| EL-M18-S33-020 | text | visible-default | "Jan" | FN-M18-6.2.2 |
| EL-M18-S33-021 | text | visible-default | "Feb" | FN-M18-6.2.2 |
| EL-M18-S33-022 | text | visible-default | "Mac" | FN-M18-6.2.2 |
| EL-M18-S33-023 | text | visible-default | "Apr" | FN-M18-6.2.2 |
| EL-M18-S33-024 | text | visible-default | "Mei" | FN-M18-6.2.2 |
| EL-M18-S33-025 | text | visible-default | "Jun" | FN-M18-6.2.2 |
| EL-M18-S33-026 | text | visible-default | "Jul" | FN-M18-6.2.2 |
| EL-M18-S33-027 | text | visible-default | "Ogs" | FN-M18-6.2.2 |
| EL-M18-S33-028 | text | visible-default | "Sep" | FN-M18-6.2.2 |
| EL-M18-S33-029 | text | visible-default | "Isn" | FN-M18-6.2.2 |
| EL-M18-S33-030 | text | visible-default | "Rab" | FN-M18-6.2.2 |
| EL-M18-S33-031 | text | visible-default | "Jum" | FN-M18-6.2.2 |
| EL-M18-S33-032 | text | visible-default | "Ahd" | FN-M18-6.2.2 |
| EL-M18-S33-033 | clickable | visible-default | clickable | FN-M18-6.2.2 |
| EL-M18-S33-034 | clickable | visible-default | clickable | FN-M18-6.2.2 |
| EL-M18-S33-035 | clickable | visible-default | clickable | FN-M18-6.2.2 |
| EL-M18-S33-036 | text | visible-default | "Kurang" | FN-M18-6.2.2 |
| EL-M18-S33-037 | text | visible-default | "Lebih" | FN-M18-6.2.2 |
| EL-M18-S33-038 | text | visible-default | "Warna menunjukkan bilangan soalan betul seluruh sekolah setiap hari" | FN-M18-6.2.2 |
| EL-M18-S33-039 | card | visible-default | "Perbandingan Kelas" | FN-M18-6.2.3 |
| EL-M18-S33-040 | heading | visible-default | "Perbandingan Kelas" | FN-M18-6.2.3 |
| EL-M18-S33-041 | table | visible-default | table | FN-M18-6.2.3 |
| EL-M18-S33-042 | card | visible-default | "Top 10 Kombo Sekolah" | FN-M18-6.2.4 |
| EL-M18-S33-043 | heading | visible-default | "Top 10 Kombo Sekolah" | FN-M18-6.2.4 |
| EL-M18-S33-044 | table | visible-default | table | FN-M18-6.2.4 |
| EL-M18-S33-045 | text | conditional | "500" | FN-M18-1.2.8 |
| EL-M18-S33-046 | text | conditional | "⚙️" | FN-M18-1.2.8 |
| EL-M18-S33-047 | heading | conditional | "Ralat Pelayan" | FN-M18-1.2.8 |
| EL-M18-S33-048 | text | conditional | "Sesuatu tidak kena di pihak kami. Pasukan teknikal telah dimaklumkan. Sila cuba  …" | FN-M18-1.2.8 |
| EL-M18-S33-049 | link | conditional | "Halaman Utama", → / | FN-M18-1.2.8 |
| EL-M18-S33-050 | link | conditional | "Cuba Semula", → javascript:location.reload() | FN-M18-1.2.8 |
| EL-M18-S33-051 | text | conditional | "PRESTASIPLUS" | FN-M18-1.2.8 |

### 6.2 Shell elements

The user-portal shell is chrome owned by the global shell / M23 (00-global-ui, design/shells.md). Its M18-relevant elements (the "PPD / JPN" menu entries, "Amaran Awal", and the header titles / subtitles of the M18 screens) are mapped below; every other shell element is excluded with the reason given in the summary (global shell / M23 chrome, M14 chips, M22 bell and chatbot, entries owned by other modules).

#### SHU — user-portal shell — 417 elements, 67 mapped, 350 excluded

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M18-SHU-104 | text | visible-default | "PPD / JPN" | FN-M18-1.1.1 |
| EL-M18-SHU-105 | link | visible-default | "Dashboard PPD", → /ppd/dashboard, fa-building-columns | FN-M18-1.1.1 |
| EL-M18-SHU-106 | link | visible-default | "Statistik PPD", → /ppd/statistik-penggunaan, fa-chart-pie | FN-M18-1.1.1 |
| EL-M18-SHU-107 | link | visible-default | "Ranking Kebangsaan", → /ppd/ranking-kebangsaan, fa-trophy | FN-M18-1.1.1 |
| EL-M18-SHU-108 | link | visible-default | "Dashboard JPN", → /jpn/dashboard, fa-building-flag | FN-M18-1.1.1 |
| EL-M18-SHU-109 | link | visible-default | "Ranking Kebangsaan JPN", → /jpn/ranking-kebangsaan, fa-trophy | FN-M18-1.1.1 |
| EL-M18-SHU-136 | heading | visible-default | "Dashboard PPD" | FN-M18-1.1.5 |
| EL-M18-SHU-137 | text | visible-default | "PPD KLUANG, Johor" | FN-M18-1.1.5 |
| EL-M18-SHU-178 | link | hidden-only | "Amaran Awal", → /amaran, fa-exclamation-triangle | FN-M18-1.1.3 |
| EL-M18-SHU-189 | link | hidden-only | "Command Center LIVE", → /ppd/command-center, fa-satellite-dish | FN-M18-1.1.2 |
| EL-M18-SHU-190 | badge | hidden-only | "LIVE" | FN-M18-1.1.2 |
| EL-M18-SHU-191 | link | hidden-only | "Dashboard PPD", → /ppd/dashboard, fa-building-columns | FN-M18-1.1.2 |
| EL-M18-SHU-192 | link | hidden-only | "Statistik Penggunaan", → /ppd/statistik-penggunaan, fa-chart-pie | FN-M18-1.1.2 |
| EL-M18-SHU-193 | link | hidden-only | "Ranking Kebangsaan", → /ppd/ranking-kebangsaan, fa-trophy | FN-M18-1.1.2 |
| EL-M18-SHU-194 | link | hidden-only | "Benchmark Sekolah", → /ppd/benchmark-sekolah, fa-ranking-star | FN-M18-1.1.2 |
| EL-M18-SHU-195 | link | hidden-only | "Peta Haba", → /ppd/peta-haba, fa-map-location-dot | FN-M18-1.1.2 |
| EL-M18-SHU-196 | link | hidden-only | "Export Laporan", → /ppd/export-laporan, fa-file-export | FN-M18-1.1.2 |
| EL-M18-SHU-197 | link | hidden-only | "Leaderboard Sekolah", → /ppd/leaderboard-sekolah, fa-trophy | FN-M18-1.1.2 |
| EL-M18-SHU-198 | link | hidden-only | "Dashboard JPN", → /jpn/dashboard, fa-building-flag | FN-M18-1.1.2 |
| EL-M18-SHU-199 | link | hidden-only | "Statistik Penggunaan", → /jpn/statistik-penggunaan, fa-chart-pie | FN-M18-1.1.2 |
| EL-M18-SHU-200 | link | hidden-only | "Ranking Kebangsaan", → /jpn/ranking-kebangsaan, fa-trophy | FN-M18-1.1.2 |
| EL-M18-SHU-264 | link | hidden-only | "Amaran Awal", → /amaran, fa-exclamation-triangle | FN-M18-1.1.3 |
| EL-M18-SHU-373 | heading | conditional | "Statistik Penggunaan Daerah" | FN-M18-1.1.5 |
| EL-M18-SHU-374 | heading | conditional | "Ranking Sekolah 1 Malaysia" | FN-M18-1.1.5 |
| EL-M18-SHU-375 | heading | conditional | "Benchmark Sekolah Daerah" | FN-M18-1.1.5 |
| EL-M18-SHU-376 | heading | conditional | "Peta Haba Prestasi Daerah" | FN-M18-1.1.5 |
| EL-M18-SHU-377 | heading | conditional | "Eksport Laporan Daerah" | FN-M18-1.1.5 |
| EL-M18-SHU-378 | heading | conditional | "Leaderboard Sekolah Daerah" | FN-M18-1.1.5 |
| EL-M18-SHU-379 | heading | conditional | "SEKOLAH MENENGAH KEBANGSAAN TINGGI KLUANG" | FN-M18-1.1.5 |
| EL-M18-SHU-380 | heading | conditional | "SEKOLAH MENENGAH KEBANGSAAN LAYANG-LAYANG" | FN-M18-1.1.5 |
| EL-M18-SHU-381 | heading | conditional | "Dashboard JPN" | FN-M18-1.1.5 |
| EL-M18-SHU-382 | text | conditional | "Johor" | FN-M18-1.1.5 |
| EL-M18-SHU-383 | heading | conditional | "Statistik Penggunaan Negeri" | FN-M18-1.1.5 |
| EL-M18-SHU-384 | heading | conditional | "Ranking Kebangsaan 1 Malaysia" | FN-M18-1.1.5 |
| EL-M18-SHU-385 | text | conditional | "JPN Johor" | FN-M18-1.1.5 |
| EL-M18-SHU-386 | heading | conditional | "PPD KLUANG" | FN-M18-1.1.5 |
| EL-M18-SHU-387 | heading | conditional | "Amaran Awal — Kelas" | FN-M18-1.1.5 |
| EL-M18-SHU-388 | text | conditional | "Pilih kelas untuk lihat status risiko pelajar" | FN-M18-1.1.5 |
| EL-M18-SHU-389 | text | conditional | "5 CYBER — Sains Rumah Tangga" | FN-M18-1.1.5 |
| EL-M18-SHU-390 | heading | conditional | "Amaran Awal — Daerah" | FN-M18-1.1.5 |
| EL-M18-SHU-391 | text | conditional | "PPD BATANG PADANG, Perak" | FN-M18-1.1.5 |
| EL-M18-SHU-392 | heading | conditional | "Amaran Awal — Negeri" | FN-M18-1.1.5 |
| EL-M18-SHU-393 | text | conditional | "Perak" | FN-M18-1.1.5 |
| EL-M18-SHU-394 | heading | conditional | "Keberkesanan Intervensi (Daerah)" | FN-M18-1.1.5 |
| EL-M18-SHU-395 | text | conditional | "PPD KLUANG, Johor · 118 sekolah" | FN-M18-1.1.5 |
| EL-M18-SHU-396 | heading | conditional | "Keberkesanan Intervensi" | FN-M18-1.1.5 |
| EL-M18-SHU-397 | text | conditional | "SEKOLAH KEBANGSAAN MERU RAYA" | FN-M18-1.1.5 |
| EL-M18-SHU-398 | heading | conditional | "Amaran Awal — Sekolah" | FN-M18-1.1.5 |
| EL-M18-SHU-399 | text | conditional | "SEKOLAH MENENGAH KEBANGSAAN HAMID KHAN" | FN-M18-1.1.5 |
| EL-M18-SHU-400 | heading | conditional | "Ringkasan Eksekutif" | FN-M18-1.1.5 |
| EL-M18-SHU-401 | text | conditional | "PPD PPD BATANG PADANG" | FN-M18-1.1.6 |
| EL-M18-SHU-402 | text | conditional | "SEKOLAH MENENGAH KEBANGSAAN TINGGI KLUANG" | FN-M18-1.1.5 |
| EL-M18-SHU-403 | text | conditional | "Negeri Perak" | FN-M18-1.1.5 |
| EL-M18-SHU-404 | heading | conditional | "Log Intervensi" | FN-M18-1.1.5 |
| EL-M18-SHU-405 | text | conditional | "<name>" | FN-M18-1.1.5 |
| EL-M18-SHU-406 | heading | conditional | "Analisa Item — PPD" | FN-M18-1.1.5 |
| EL-M18-SHU-407 | heading | conditional | "Analisa Item — JPN" | FN-M18-1.1.5 |
| EL-M18-SHU-408 | heading | conditional | "Dashboard" | FN-M18-1.1.6 |
| EL-M18-SHU-409 | text | conditional | "Selamat datang kembali" | FN-M18-1.1.6 |
| EL-M18-SHU-410 | text | conditional | "SEKOLAH MENENGAH KEBANGSAAN TINGGI KLUANG — Tingkatan 4" | FN-M18-1.1.5 |
| EL-M18-SHU-411 | text | conditional | "SEKOLAH MENENGAH KEBANGSAAN TINGGI KLUANG — Tingkatan 5" | FN-M18-1.1.5 |
| EL-M18-SHU-412 | heading | conditional | "Kombo Harian — SEKOLAH MENENGAH KEBANGSAAN TINGGI KLUANG" | FN-M18-1.1.5 |
| EL-M18-SHU-413 | heading | conditional | "Analisa Item — Sekolah" | FN-M18-1.1.5 |
| EL-M18-SHU-414 | text | conditional | "Analisis Item Seluruh Sekolah" | FN-M18-1.1.5 |
| EL-M18-SHU-415 | heading | conditional | "Kombo Harian — PPD" | FN-M18-1.1.5 |
| EL-M18-SHU-416 | heading | conditional | "Kombo Harian — JPN" | FN-M18-1.1.5 |
| EL-M18-SHU-417 | heading | conditional | "Kombo Harian — SEKOLAH MENENGAH KEBANGSAAN HAMID KHAN" | FN-M18-1.1.5 |


---

## 7. Fidelity deviations

These are the **only** intended differences from the live site. Anything not listed must match live (D7). Rule D9 (user, standing, pre-approved): where live is broken or contradictory, fix it minimally; where it works, replicate it exactly. D10: accessibility replicates live; a deliberate, consistent limit is not broken. CLAUDE.md §6: minimal fixes that create no new visible contradiction. Delivery Lead precedents applied: NaN / undefined / script errors → working panels; broken "Kembali" → fixed; 500 / 403 / 200 on unknown ids → global 404; overflow at 375 → in-card scroll; 🏋 → 🥇; unreadable contrast → fixed; duplicate / omitted school → fixed; "PPD PPD" → fixed; class list scoped; developer text removed; district id 0 → fixed. Rows "Rejected — replicate live" were considered and deliberately not changed.

| ID | Discovery | Category | Live behaviour (evidence) | Rebuild behaviour (specified) and alternatives | Status |
|---|---|---|---|---|---|
| DV-M18-01 | D-M18-6 | Wrong glyph | S5 table and S8 podium, table and mobile cards show "🏋" (weight lifter) for place 1; S4/S13 use 🥇 (`ppd-benchmark-desktop.png`, EL-M18-S8-029, S8-043). | 🥇 on S5 and S8 (every surface); legend texts unchanged. Alternatives: keep 🏋 — rejected (a visual bug contradicting "Tempat 1 — Emas"). | Approved (D9) |
| DV-M18-02 | D-M18-7 | Wrong figure | S5 header and S7 stat "Purata Ketepatan" 0.6% = 73.1 ÷ 116 (the mean includes 115 schools without any answer); subject 3 "0.7%" = 76.3 ÷ 116 (recon R3f/R3g). | Mean over the schools that have a "Ketepatan" value: 73.1% (subject 3: 76.3%); "0%" when no school has data. "Purata Aktif" keeps the mean over all listed schools (0%). Alternatives: (a) keep 0.6% — rejected (a mean that treats "no data" as 0% contradicts the row it averages); (b) pooled accuracy over all answers (83.8%) — rejected (changes the definition of the rows' metric). | Approved (D9) |
| DV-M18-03 | D-M18-4 | Contradictory figures | S10 district row KLUANG "Sekolah 7", "Pelajar 134", "134 (100%)" while the other rows count all schools (176, 146 …), the S10 cards say 135 and S26's KLUANG row says 118 · 135 (recon R2d/R2e). | KLUANG row 118 · 135 · "135 (100%)" · 71.6% — the column semantics of the other rows and of S26 (3 cells changed). Alternatives: count schools with pupils in every row (7 and 0 for the others) — rejected (changes 10 observed values). | Approved (D9) |
| DV-M18-04 | D-M18-10 | Wrong figure | S1/S10 Kombo and Tahap tables show "Pelajar 0" on every row while the same rows show 18, 14 … kombo-active pupils (R6c). | "Pelajar" = the school's pupil count (Q-M18-STU), e.g. LAYANG-LAYANG 21, TINGGI KLUANG 59. Alternatives: pupils with a kombo — rejected (the column heading and the S1 risk table use pupil counts). | Approved (D9) |
| DV-M18-05 | D-M18-11 | Developer text shown to users | S1 notice second line "Data agregat dijana oleh `php artisan correction:backfill`. Jika konsisten kosong, cron mungkin terhenti. Hubungi admin teknikal." (EL-M18-S1-209). | Line removed; the notice keeps "Tiada data pembetulan untuk bulan ini ({YYYY-MM})". Alternatives: replace with new copy — rejected (new copy; the first line already informs). | Approved (D9, DL precedent) |
| DV-M18-06 | D-M18-13 | Candidate — broken control | S5 "Eksport CSV" `href` is the page itself; its `onclick` downloads the district CSV; the subject filter is not passed. | **Rejected — replicate live.** The SPA always runs script, so the control works: it downloads the district CSV (S7 file) without the subject filter, as live. | Rejected — replicate live |
| DV-M18-07 | D-M18-14 | Wrong value | S7 "Dijana: 26 Sep 2026, 04:21" and S23 "Dijana: 26 September 2026, 04:25" / footer show UTC on an MYT page. | Times in Asia/Kuala_Lumpur (MYT), formats unchanged ("d MMM yyyy, HH:mm", "d MMMM yyyy, HH:mm"). | Approved (D9) |
| DV-M18-08 | D-M18-15 | Candidate — inert tab | S8 "Ikut Subjek" only changes its own highlight; both tabs show the same filter and lists. | **Rejected — replicate live.** Nothing is broken (the subject filter works on both tabs); giving the tab new content would be new scope. | Rejected — replicate live |
| DV-M18-09 | D-M18-16 | Candidate — contradictory scores | Same school, same formula text: S5 22.6, S8 21.9. | **Rejected — two definitions, replicated.** S8's "Soalan/Pelajar" column is "—" (last-30-days figure = 0) → 0.3 × 73.1 = 21.9; S5 uses the lifetime 10.6/pelajar → 21.93 + 0.3 × (10.57 ÷ 5) = 22.6 (normalisation INFERRED; recon R4a/R4b). Each page states its own inputs. | Rejected — replicate live |
| DV-M18-10 | D-M18-17 | Candidate — contradictory figures | S9 calendar "Jumlah Betul 7,307" vs the monthly table 485 betul (8880). | **Rejected — two definitions, replicated.** The calendar counts correct answers of the answer log (7,307 / 10,194 = 71.7% = S30, R3c); the monthly table counts questions of completed practice sessions (675 / 485 = S27 675, R7b). | Rejected — replicate live |
| DV-M18-11 | D-M18-18 | Inconsistent navigation (shell) | Desktop sidebar lacks Command Center, Benchmark, Peta Haba, Export and Leaderboard that the drawer has; at ≥ 1024 px these pages have no entry point. | One menu declaration rendered by sidebar and drawer (DV-SH-04, shells.md §6): the drawer set; "Amaran Awal" kept in both groups (not broken). | Approved (D9, via DV-SH-04) |
| DV-M18-12 | D-M18-19 | Candidate — label | S9 breadcrumb is always "Ranking Kebangsaan" → S4 whatever the entry page. | **Rejected — replicate live.** The link works and names a real parent page. | Rejected — replicate live |
| DV-M18-13 | D-M18-20 | Privacy defect | Full IC numbers are in the S9/S15 HTML (hidden spans); "Tunjuk IC Penuh" only toggles CSS; the "direkodkan untuk pematuhan PDPA" claim is not backed by any request. | Lists carry masked ICs only, in the live mask format "xxxxxx-xx-xx{last 2 digits}" (observed; audit AUD-M18-02); "Tunjuk IC Penuh" keeps the live confirm text and, on OK, requests the full ICs from the server, which writes a PDPA audit record (SEC-M18-01). Visible UI unchanged. Seeds hold fictitious IC-shaped numbers. Alternatives: drop the button — rejected (removes a working feature). | Approved (privacy override) |
| DV-M18-14 | D-M18-21 | Wrong figure | S10 filter counter adds the rows of every paginated table: "PPD KLUANG" → "479 sekolah dijumpai" (= 118 × 4 + 7), "KLUANG" → 43 (= 10 × 4 + 3) (R9c/R9d). | Counter = distinct matching schools: 118 and 10. Alternatives: count one table's rows — equivalent; chosen wording unchanged. | Approved (D9) |
| DV-M18-15 | D-M18-22 | Wrong figure (> 100%) | S10 mastery "(116.7%)", "(166.7%)", "(33.3%)" = records ÷ 12 pupils (R5c). | p = records ÷ 38 records as S1: 36.8% / 52.6% / 10.5%. | Approved (D9) |
| DV-M18-16 | D-M18-23 | Broken page | S11 "Soalan Dijawab NaN", top school "undefined" → `/jpn/sekolah/undefined`; `ReferenceError: eng` stops Live Feed, Pecahan Daerah and ALESA AI ("Memuatkan wawasan..." forever). | Working panels: the live-data API returns the fields the page reads (`total_answered_raw`, `top_schools[].school_id/school_name`, `recent_feed`, `top_students`, `districts`, `week_change`); "222", the school name and link, the district rows, the feed / top-student empty states and the AI sentence render; the orphan engagement code (no panel on the page) is dropped. Alternatives: hide the broken panels — rejected (DL precedent). | Approved (D9, DL precedent) |
| DV-M18-17 | D-M18-24 | Broken link | S18 "Muat Turun CSV" → `/amaran/export/district/0`. | → `/amaran/export/district/{key}` of the page's district. | Approved (D9, DL precedent) |
| DV-M18-18 | D-M18-25, N-M18-01 | Wrong data | S19 and S23 (state) list SK TOH TANDEWA SAKTI twice and omit SMK HAMID KHAN; **S10's risk table lists SMK TINGGI KLUANG twice and omits SMK TUN HUSSEIN ONN (rows sum 181 ≠ 135; found while writing, R9a)**. | Each school once: S19/S23 HAMID KHAN 17 · 97.6 and TOH TANDEWA SAKTI 16 · 97.5; S10 the 7 KLUANG schools (Σ 135). | Approved (D9, DL precedent) |
| DV-M18-19 | D-M18-26 | Layout breakage | S20 page 498 px wide at 375 px. | Wide content scrolls inside its card; no page overflow. | Approved (D9, DL precedent) |
| DV-M18-20 | D-M18-27 | Candidate — data | School 1 (SK) lists "Darjah n" pupils in "Tingkatan 4 4 Bestari - BM" classes. | **Rejected — data as observed.** The page shows the records faithfully; the inconsistency is in live records (class membership), not in a rule; seeds mirror observation. | Rejected — replicate live |
| DV-M18-21 | D-M18-28 | Broken link | S23/S24 "Kembali" = `url()->previous()`, observed as AJAX endpoints (`/notifikasi/unread-count`, `/admin/server-status`, `/chatbot/history?…`). | "Kembali" → the previous in-app page; without one → S23: the scope's Amaran page; S24: `/amaran`. Label and icon unchanged. | Approved (D9, DL precedent) |
| DV-M18-22 | D-M18-29 | Wrong label | S23 h1, shell subtitle and tab "PPD PPD BATANG PADANG". | "PPD BATANG PADANG" (prefix not doubled). | Approved (D9, DL precedent) |
| DV-M18-23 | D-M18-30 | Wrong data scope | S24 "Kelas (Pilihan)" lists all 750 classes of the system. | "— Tiada —" + the pupil's own classes (M10 enrolments). | Approved (D9, DL precedent) |
| DV-M18-24 | D-M18-31 | Wrong title | S27 shell header "Dashboard" / "Selamat datang kembali". | "Dashboard Prestasi Sekolah" / "{SEKOLAH}" (both strings are on the page; DV-SH-03 rule). | Approved (D9) |
| DV-M18-25 | D-M18-32 | Broken page | `/kombo/sekolah/{unknown}` → 500 "Ralat Pelayan". | Global 404. | Approved (D9, DL precedent) |
| DV-M18-26 | D-M18-33 | Inconsistent error | `/sekolah/{unknown}/analisa-item` → 200 "Sekolah Tidak Dinyatakan". | Global 404 ("Tiada Data Pelajar" stays for known schools without answers). | Approved (D9, DL precedent) |
| DV-M18-27 | D-M18-34 | Inconsistent error | `/amaran/kelas/{unknown}` → 403 "Akses Ditolak". | Global 404 for unknown ids; 403 stays for existing classes outside the viewer's scope. | Approved (D9, DL precedent) |
| DV-M18-28 | D-M18-35 | Candidate — contradictory figures | S12/S14 "Data belum tersedia" / 0 while S10 shows 135 pupils. | **Rejected — two sources, replicated.** S12/S14 read the daily usage snapshot ("Data ranking dikemas kini setiap hari"), empty for Johor; S10 counts live records. | Rejected — replicate live |
| DV-M18-29 | D-M18-36 | Candidate — redundant link | S1 breadcrumb and "Laporan Terperinci" tile "Papan Pemuka" link to the page itself. | **Rejected — replicate live** (works, harmless). | Rejected — replicate live |
| DV-M18-30 | D-M18-37 | Unreadable text | Content text 8.8–11.5 px on S1, S9/S15, S11, S20/S21, S23, S24, S25/S26, S30 (discovery §8.1). | Raised to 12 px (as M03 DV-06b, M08 DV-18, M11 DV-23); layout unchanged. | Approved (D9) |
| DV-M18-31 | D-M18-38 | Unreadable text | S25/S26 header h2 dark slate on the dark indigo card (`analisa-item-ppd-desktop.png`). | White h2, as S1/S10 on the same card. | Approved (D9, DL precedent) |
| DV-M18-32 | D-M18-8 | Contradictory figures | S27 "Perbandingan Tingkatan" 143 + 113 = 256 murid and teacher cards 151 + 30 murid in a 59-pupil school; the class counts 4 + 5 = 9 are school-scoped (R7h/R7i). | Level and teacher cards count only this school's pupils (and their sessions / accuracy); class counts unchanged. Values computed (unobserved). Alternatives: keep platform figures — rejected (visible contradiction with "59 murid" on the same page). | Approved (D9) |
| DV-M18-33 | D-M18-9 | Candidate — contradictory figures | Subject cards: Bahasa Melayu "545 soalan", "634 salah". | **Rejected — consistent definitions, replicated.** "soalan" = distinct questions, "salah" = wrong answers; the answers implied by "salah" ÷ (1 − accuracy) sum to 10,518–10,550 ∋ 10,535 (R3i). | Rejected — replicate live |
| DV-M18-34 | D-M18-12 | Candidate — stale data | S4/S13 "7 Hari" rows of JALAN TIGA / SAM MUHAMMADIAH equal their 30-day rows. | **Rejected — not a defect.** M11 counts SAM MUHAMMADIAH (8284) active in the last 7 days with 5 answers (R10e); JALAN TIGA is data. | Rejected — replicate live |
| DV-M18-35 | D-M18-5 | Candidate — label / target | S10 "Klik nama daerah untuk lihat dashboard PPD terperinci" opens S14 (district usage). | **Rejected — replicate live.** The link works and opens the district's page. | Rejected — replicate live |
| DV-M18-36 | D-M18-1, Q-M18-3 | Blocked content | `/ppd/command-center` → 403 for the admin although in the menu. | **Admin: replicate the 403** (Delivery Lead). **PPD officer:** provisional page = the S11 component at district scope with PROPOSED title "Command Center PPD" (§9). | Replicate (admin) / provisional (officer) |
| DV-M18-37 | D-M18-2, Q-M18-1 | Candidate — contradictory scope | Admin: PPD pages → PPD KLUANG / Johor, Amaran & Kombo officer pages → PPD BATANG PADANG / Perak, S21 → SK MERU RAYA; no picker. | **Rejected — replicate live** (Delivery Lead). Classified as a D9 "contradictory rule" candidate, but each page names its scope in the header and shows internally consistent figures; fixing it needs a scope live never showed. Implemented as documented admin preview scopes (SRS DATA-M18-05). Officers get one INFERRED scope (FN-M18-1.2.3). | Rejected — replicate live |
| DV-M18-38 | D-M18-3 | Candidate — contradictory figures | 118 vs 116 schools; 135 vs 72 pupils (same district). | **Rejected — two definitions, replicated.** S1 says "(termasuk inactive)": 118 = all, 116 = active; the 2 inactive schools are exactly 8880 and 2710 and hold the 63 extra pupils (R1b/R1c/R2c; XR-M18-01 sets `isActive = false` on them; M02 `/admin/schools` shows both as "Tidak Aktif", audit AUD-M18-12). | Rejected — replicate live |
| DV-M18-39 | Count conflict (§5.5, R7f) | Contradictory figures | S30 "GPS Anggaran Sekolah" for 8880 shows 3.45 "Berdasarkan 744 entri" = the platform headcount (M08), while S27 for the same school shows 2.49 / 148; S30 links "Prestasi 360" to S27. | S30 GPS card uses the school's entries (2.49 "Baik", 148); the sparkline shows the school's yearly points. Alternatives: keep the platform figure — rejected (contradiction one click apart). | Approved (D9) |
| DV-M18-40 | Count conflict (found while writing) | Candidate — contradictory figures | S6 heat map Pendidikan Islam for LAYANG-LAYANG "92.2%" while the district card shows the same single pupil at 48/52 = "92.3%". | **Rejected — two bases, replicate 92.2** (Delivery Lead on AUD-M18-03; audit top-up): the heat map and S5 read a stored per-pupil × subject accuracy, the subject cards the answer log (S30 8765 BM 83.7% vs cell 60.3%). Each figure is consistent with its own base. | Rejected — replicate live |
| DV-M18-41 | N-M18-02 (found while writing) | Contradictory figures | S29/S33 "Top 10 Kombo Sekolah" "Jumlah Hari" 0 on every row while "Kombo" is 4–15 (R6f). | **Rejected — replicate the stored field** (Delivery Lead on AUD-M18-04, corrected after the top-up). "Jumlah Hari" is a stored per-pupil counter that works: 2710 shows 13 and 4 while 2710 has only 3 calendar days with answers; the other 82 observed top-10 rows (80 at the other 8 schools + 2 at 2710) read 0. Replicated from M14 (`totalDays`, XR-M18-18). | Rejected — replicate live |
| DV-M18-42 | D-M18-23 (part) | Candidate — label | S11 "Sekolah Aktif 1,187" "dari 1187 sekolah negeri" (both the active-school count). | **Rejected — replicate live.** Both numbers are the state's active schools (1,189 − 2 inactive, R2g); consistent with its own definition. | Rejected — replicate live |

| DV-M18-43 | XL3-20 (cross-module) | Contradictory records | Live S22 / S28 (26 Sep) show 42 pupils of 8880 with "Tiada aktiviti" (never logged in), 27 of them T4 / T5 register pupils (15 of class 516, 12 of class 517), while M11 S2 / S3 (25 Sep 19:24, confirmed by M17) show 8880 "Belum login **8** (+0)". Under a single `lastLoginAt` the two observations would contradict each other. | **Withdrawn (v1.7) — two-field model, 0 visible changes.** Live keeps a stored activity date (`lastActiveAt`, SRS §6.1a) behind the risk "Terakhir aktif" and `lastLoginAt` behind M11 / M17; the 42 pupils have `lastActiveAt` null (XR-M18-21) while their login states stay as M02 places them, so every observed value holds (S1 86 / 49; S28 T4 15 × 80; T5 84.4 / 83.6 / twelve 80 / 66.8; 8880 average 84.0). Option (c) below, rejected at XL3-20, was adopted by the Delivery Lead once 7780 (DV-M18-45) showed the opposite direction. *Superseded v1.3 text, kept for history:* The M02 v1.12 placement wins (Delivery Lead): 8880 has 14 never-logged-in pupils (the register's 8 + the 6 lower-form pupils); 3201–3215 carry `lastLoginAt` 2026-03-10 and 4 of class 517 an old date. **Changed M18 values:** S1 KPI "86 akademik berisiko, 49 belum mula latih" → **114 / 21**; 8880 risk lists (S22 / S28 / S28 T4 / T5): the 15 class-516 pupils 80 → **100** ("Tiada data", "Terakhir aktif: 2026-03-10"), 4 class-517 pupils 80 → **100**, and 9 "Tiada Kelas" register pupils 80 → **100**: **28** of the 42 "Tiada aktiviti" rows become login-only (42 − 14 = 28 is the minimum: M11 allows 8 never-logged register pupils and M17 / M02 6 lower-form ones); 8880 average 84.0 → 93.5 (not displayed; order of the S1 / S10 risk tables unchanged). **Visible changes of the chosen fix:** 2 S1 KPI numbers + 28 pupil rows on S22 / S28 (score, "Ketepatan", "Penglibatan", "Penguasaan" texts; status stays "Berisiko Tinggi"), repeated in the S28 T4 / T5 views — no other screen. **Alternatives considered (visible changes):** (a) change M11's 8880 row to "Belum login 36 (+15)" and "Login sahaja" accordingly — about 6–8 visible values on M11 S2 / S3 and M17, fewer than the chosen fix, **rejected** (Delivery Lead, XL3-20): it overturns two modules' observed figures and the reconciled M02 register instead of the single later M18 observation; (b) give the 28 pupils login dates 10 days before the clock so their scores stay 80 — 28 "Penglibatan" cells change and it contradicts M17 (no 8880 login this month), rejected; (c) read "Terakhir aktif" from a separate per-pupil "last active" field so the 42 rows stay as live — 0 visible changes, **rejected**: it needs a new stored field that no screen evidences (the "Terakhir aktif" dates of login-only pupils match `lastLoginAt`), i.e. new data-model scope; (d) keep the 42 and leave the contradiction — rejected (D11: one dataset). No smaller change resolves the contradiction within the owners' decided records. | Withdrawn (v1.7) — two-field model, 0 visible changes |

| DV-M18-44 | XR-M14-10 (M14 v1.3), found by script (R23) | Candidate — contradictory figures | For 6 schools the observed "Purata Kombo" cannot be the mean `current` of the kombo-active pupils given the school's own top-10 rows (extras at streak ≥ 1): 8880 6.4 (feasible 6.6–7.4), 7780 7 (7.1–9.1), school 1 4.9 (5.2–6.1), 2700 6.8 (7.6–7.9), 8767 5.3 (6.2–6.3), 8772 6.4 (exactly 7.7). 2710, 3160 and 8765 fit. | **Rejected — keep the observed means as documented display values** (D11 exception). The school mean is a stored school figure (M14), never shown next to a contradicting computed mean: the top-10 rows are records, and the district means (7.2, "6") are computed from these school values weighted by the kombo-active counts and reproduce the observed figures (R6b, R6e). **Visible changes:** 0. **Alternative (computed from the rows):** 8880 6.4 → 6.6, 7780 7 → 7.1, school 1 4.9 → 5.2, 2700 6.8 → 7.6, 8767 5.3 → 6.2, 8772 6.4 → 7.7 on S1 / S10 kombo rows, S29 / S33 tiles, S23 school kombo and S31 / S32 rows (about 20 cells), and BATANG PADANG "6" → "6.1" on S31, S32 and S23 — rejected as the larger change. | Rejected — replicate live |

| DV-M18-45 | M02 v1.21 change request (F-23, DV-M02-15), M11 register (cross-module) | Contradictory records | Live S22 `/amaran/sekolah/7780` (26 Sep 12:36; also S18 / S19) shows 4 of 7780's 6 T4/T5 pupils (the two "Tingkatan 4" pupils in "4 Bestari - BM" and "-", the two "Tingkatan 5" pupils in "5 Cemerlang - BM" and "-") as login-only — 100 "Tiada data" "Terakhir aktif: 2026-02-26 … 28" "Tiada data" — and 2 as never active (80), i.e. BATANG PADANG 29 logged in / 4 never (7780 15 / 2, school 1 14 / 2; averages 97.6 / 97.5, district 97.6). M11 S3 for 7780 (25 Sep 19:24) shows the same six pupils (T4 3, T5 3) all "Belum login" without a "Login Terakhir". A February date cannot appear overnight, so under one login field the two observations would contradict each other — the reverse direction of DV-M18-43 at 8880. Definitions checked: active vs all and register vs all pupils (the same six pupils on both sides), a login window in M11 (refuted by 8880's February-dated risk rows vs its 45 M11 logins), district / level membership (unchanged) — none separates them; only two stored fields do. | **Withdrawn (v1.7) — two-field model, 0 visible changes.** The risk rows read the stored activity date `lastActiveAt` (SRS §6.1a; 7780: 15 dated 26–28 Feb, 2 null — XR-M18-21), M11 / M17 read `lastLoginAt` (7780's 6 register pupils null, as M02 v1.21 places them). Every observed value holds: BATANG PADANG 29 / 4, 7780 97.6, school 1 97.5, district 97.6, S18 / S19 / S23 order HAMID KHAN then TOH TANDEWA SAKTI, pupil lists 29 × 100 then 4 × 80. The v1.6 D9 fix (M02's 25 / 8; 7780 92.9, district 95.2) is void; its kombo side-effect note (4 re-set kombo-active pupils without a login) no longer applies, as no pupil is re-set. | Withdrawn (v1.7) — two-field model, 0 visible changes |
| DV-M18-46 | Build of the M18 `risk` read model (Session 8, 2026-10-09; commits dec0e77 / 3bcd70b), owner data M05 (mastery, sessions) | Owner data does not reproduce observed values | BR-M18-13 computed over the current owner data (M05 sessions and stored mastery via `practice.storedMastery`, M01 `lastActiveAt`) reproduces 44.7 / 45.7 (class 1156), BATANG PADANG 33 red with 29 × 100 / 4 × 80, 7780 97.6, school 1 97.5, KLUANG 135 red and 8880 59 red, but **not** three observed values: KLUANG score-80 split **109 / 26** (observed 86 / 49), 8880 score-80 count **19** (observed 42; 8767 2, 8772 2, 2700 2, 8765 1 do match) and 8880 average **87.6** (observed 84.0). The cause is the M05 seed (which pupils hold stored mastery rows and answer-log mastery; XL-R10-01, XR-M18-M05-01), not the BR-M18-13 formula. | **Accepted, temporary: show the computed values; no tuning.** Rows, tallies and averages stay computed from owner data (D11). Nothing is special-cased by id and no M18 constant overrides them. The three anchors remain `it.todo` in `risk-anchors.test.ts` and turn into real tests when M05 seeds the observed mastery placement. **Visible changes until then:** S1 KPI split (86 / 49 → 109 / 26), 8880 S22 / S28 rows (42 → 19 at score 80) and the 8880 average where shown (84.0 → 87.6). S0 / S4 of M27 read the same values. | Accepted (temporary, owner data gap) |
| DV-M18-47 | Build of S23/S21 (m18-amaran-summary, 2026-10-21; design `docs/design/m18-amaran-summary.md` section 2, lead decision 7) | Contradictory route | SRS BR-M18-31: S23 "Kembali" returns to `/amaran/sekolah/{id}` (S22) when there is no previous page. The school admin's S4 is the M27 alias `/amaran/sekolah` (no id in the URL); the SRS path does not exist for this role. | **Approved fix.** "Kembali" goes to `/amaran/sekolah`. The S23 page for the school admin also ignores `scope` / `school_id` in the URL and always reads its own school (no foreign id can be asked for). Alternative (rejected): keep `/amaran/sekolah/{id}` with the session school id. | Approved |
| DV-M18-48 | Build of S21 for the roles (AM-11, 2026-10-22; API `GET /amaran/effectiveness`, FN-M18-1.2.4, DV-M18-37) | Unavailable in v2 | Live S21 for the admin shows a fixed preview of the school SEKOLAH KEBANGSAAN MERU RAYA (id 127). The v2 API derives the school from the caller's school (school_admin, teacher) and answers 403 for the admin, who has no school. | **Not replicated.** S21 is for school_admin and teacher only (the teacher sees the interventions of own pupils; the server scopes it). The admin gets the in-place 403 page. Alternative (rejected): a client-side default school for the admin (an invented endpoint input). | Approved (API limit) |
| DV-M18-49 | Build of S23 for the admin (AM-11, 2026-10-22; design section 8; API `GET /amaran/summary`) | Unavailable in v2 | Live S23 for the admin without `scope` shows a fixed preview of PPD BATANG PADANG, Perak (DV-M18-37). The v2 API has no default scope for the admin and answers 403 without `scope`. | **Not replicated.** The admin page sends `scope`, `district`, `state` and the school id (`school_id` or `schoolId`) from the URL; with a valid scope it works (district / state add the card "Pecahan Mengikut Sekolah"); without `scope` the in-place 403 page; a bad query (422) shows the load error (the server message until DV-M18-52, then the generic BM line "Ralat berlaku. Sila cuba lagi."; superseded by DV-M18-52). Alternative (rejected): the page adds the BATANG PADANG scope itself. | Approved (API limit) |
| DV-M18-50 | Build of S21 / S23 for the teacher (AM-11, 2026-10-22; D9) | Dead link | The back link of S21 ("Kembali ke Amaran"), the S23 "Kembali" and the S21 zero-card link "Lihat Senarai Risiko" point to `/amaran/sekolah` (M27 S4), which is a school-admin page; the teacher gets a 403 there. | **Approved fix.** For the teacher the back links go to `/guru` (admin: `/admin` on S23) and "Lihat Senarai Risiko" is hidden. The school admin is unchanged. | Approved |
| DV-M18-51 | Build of S21 / S23 (AM-11, 2026-10-22) | Unavailable in v2 | The `ppd_officer` and `jpn_officer` roles of S21 / S23 (FN-M18-1.2.2) have no endpoints in the v2 API (the portals are not built). | **Not built.** S21 / S23 are not routed for the officers (in-place 403); the roles come back with the officer portals. | Approved (scope) |
| DV-M18-52 | SW11-08, SW11-05 (SW11 sweep, AM2, 2026-10-24) | Raw or English error copy (D9); layout bug (D9) | S23 and S21 show the raw message of a failed load next to "Cuba Semula": "The scope must be school, district or state." (API 422), "Internal server error" (500), "Failed to fetch" (network). S21 "Statistik Guru": a long teacher name does not wrap and pushes "Belum Nilai" and "Kadar" out of the card (the auto-layout table grows with its content). | The load error is chosen by status, never by the server's text (`loadErrorMessage`): a network failure (status 0 or a plain `Error`), a 5xx and a 400 / 422 show the existing generic line "Ralat berlaku. Sila cuba lagi."; a 429 shows "Terlalu banyak percubaan. Cuba sebentar lagi."; the 403 stays the in-place global page; another status (404, 409, 410) keeps the server message unless it is empty or the bare "HTTP {status}" (403 and 404 render the global page in place; a business message the user can act on is not hidden, so it may still be English: accepted). No new copy. The S21 teacher table uses `DsDataTable` `layout="fixed"` with `density="tight"` and a width per figure column, so the name column takes the rest and wraps. Alternatives rejected: matching English text (brittle), changing the DS cell wrapping (half AZ). | Fixed (D9) |

**Deviation count:** 25 approved (01–05, 07, 11, 13–19, 21–27, 30–32, 39), 17 rejected / replicate (06, 08, 09, 10, 12, 20, 28, 29, 33, 34, 35, 37, 38, 40, 41, 42, 44), 1 replicate-with-provisional (36), 2 withdrawn (43, 45 — two-field model, 0 visible changes), 1 accepted temporary owner-data gap (46 — build, 2026-10-09). Build rows added after this count: 47 (approved fix, 2026-10-21), 48, 49, 51 (not replicated / not built: v2 API limits, 2026-10-22), 50 (approved D9 fix, 2026-10-22), 52 (approved D9 fix, SW11 sweep, 2026-10-24).

### 7.1 Count reconciliation (summary)

Every count conflict of discovery §5 was recomputed by script (`recon.cjs`, 85 checks, 0 failures) and decided in SRS §6.9: **(a)** different definitions expressed as named queries — 118/116/7 schools, 135/72 pupils, 1,189/1,187, 71.6/83.8% accuracy, 22.6/21.9 score, 7,307/485, 10,535/222, 8880 59/53/256 pupils (256 → DV-M18-32), 675/10,194 answers, 116.7% (→ DV-M18-15); **(a)** also 8880's 10,194 vs M11's 10,196 (answers joined to M04 vs all rows, 2 orphan rows); **stored aggregate** — the national ranking (M18-owned daily snapshot, rows = the observed record, `generatedAt` ≤ the project clock); **(c)** D9 fixes — 0.6%, 7/134, 3.45 vs 2.49, duplicates; **(a)** also the risk activity dates vs the M11 / M17 login states of 8880 and 7780 — two stored fields (`lastActiveAt` vs `lastLoginAt`, SRS C31; DV-M18-43 / 45 withdrawn, BATANG PADANG 29 / 4 and KLUANG 86 / 49 as live); 92.2% vs 92.3% is now (a), two bases (DV-M18-40 rejected); **(d)** documented display data — none on owner totals; M18 stores only the aggregates the live system itself keeps (daily ranking / usage snapshot, correction aggregate).

---

## 8. Out of scope

| Item | Owner / reason |
|---|---|
| `/prestasi/*`, `/headcount/*`, `/analisa-item/sekolah*`, `/prestasi/sekolah/{id}/guru/{id}`, `/prestasi/tingkatan/*` (link targets) | M08 |
| `/kombo` (redirect) and the streak store itself | M14 |
| Users, schools, districts, states, IC numbers, officer fields | M01 / M02 (owners; M18 reads them) |
| Answers, sessions, mastery counters | M05 |
| Questions (stems, options, keys, topics, difficulty) | M04 |
| Headcount configs and marks, GPS | M08 |
| Classes and enrolment | M10 |
| Admin Command Center and its drill-downs | M17 |
| Global shells, header chips, notification bell, chatbot, tournament banner | global shell / M23, M14, M22, M16 |
| Real PDF generation, real CSV streaming, real cron jobs (`correction:backfill`, daily ranking) | backend phase; the mock serves seeded aggregates and a mock daily job |
| Real server-side authorisation, CSRF, PDPA audit storage | backend phase (SRS §11.1) |

---

## 9. Open questions

1. **OQ-M18-01 Officer accounts (non-blocking for G1; open for G5 verification of the provisional parts).** A live `ppd_officer` and `jpn_officer` session is needed to observe the real scope rule (Q-M18-1), shell and menu (Q-M18-2), `/ppd/command-center` (Q-M18-3), and whether officers reach S24 (Q-M18-8). Until then FN-M18-1.1.4 (filtering), 1.2.2–1.2.5, 2.2.2, 2.3.3, 3.3.4 and every officer AC are provisional.
2. **OQ-M18-02 Why the admin gets two scopes (Q-M18-1).** Replicated as documented admin preview scopes (DV-M18-37); the live cause is unobservable.
3. **OQ-M18-03 Filled usage statistics (Q-M18-4).** S3/S12/S14 filled layouts are PROPOSED (FN-M18-2.3.3, 3.3.4).
4. **OQ-M18-04 Export files (Q-M18-5).** Columns, order and encoding of the four CSVs are INFERRED from the page text or PROPOSED (FN-M18-2.7.2, 4.9.1–4.9.3).
5. **OQ-M18-05 Risk formula (Q-M18-6).** The weights 0.4 / 0.3 / 0.3 and the component rules reproduce every observed score (recon R8a–R8e); the status cut-offs (40 / 60), the weak-subject threshold (50%) and the 30-day engagement scale are PROPOSED.
6. **OQ-M18-06 Intervention results (Q-M18-7).** Validation messages, flash texts and redirects after save / evaluate / delete are INFERRED (no flash copy is invented: the page simply reloads with the new state).
7. **OQ-M18-07 Pupil ranking, trend icons, Sudah Guna badge (Q-M18-9, Q-M18-11).** PROPOSED / SOURCE-DERIVED, provisional.
8. **OQ-M18-08 S11 panels (Q-M18-10).** Rendered from the SOURCE-DERIVED templates; the AI sentence values ("{s}/{t} sekolah aktif", engagement share) are INFERRED.
9. **OQ-M18-09 Composite-score normalisation.** "(Soalan/Pelajar × 0.3, ternormal)" is fitted as min(100, soalan/pelajar ÷ 5) from the only non-zero row (22.6); INFERRED.
10. **OQ-M18-10 PROPOSED items to report at G1 (same list as SRS §8.2):** "Command Center PPD" title and the S2 officer "Pecahan Daerah" replaced by the district's schools (DV-M18-36, FN-M18-2.2.2); the filled usage tables (S3, S12, S14); the S9 filled pupil-ranking layout; the S16 empty-state reuse; the CSV columns of SRS §7.2; the risk cut-offs 40 / 60 and the weak-subject threshold 50%; the composite-score normalisation; the notes / follow-up limit of 2,000 characters; the seed intervention notes (fictitious text); the ranking `generatedAt` time; the test-only fixtures. (The IC mask is no longer PROPOSED: it is the observed live format, AUD-M18-02.)
11. **OQ-M18-11 Cross-module requests XR-M18-01…17 (SRS §6.14).** The M18 admin mirror depends on the owners placing the observed anchors (school registers of Johor and Perak, the 168 pupils of the 9 observed schools, answers and sessions of 8880 / 8765 / 2710, streaks, headcount of 8880, classes 516 / 517 and the 7780 / school-1 memberships). Until XL batch 3 applies them, the M18 admin-mirror E2E cannot pass.
