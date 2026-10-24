# M17 — Admin Dashboard & Analytics — User Requirements Specification

## 0. Document control

| Field | Value |
|---|---|
| Document | URS — M17 Admin Dashboard & Analytics |
| Version | 1.13 |
| Date | 2026-10-03 |
| Status | **Approved (G1)** 2026-09-27 — independent audit PASS in round 3 (`docs/qa/audit/M17-audit.md`); v1.11 merges the audited L06 "Admin Sekolah alias" addendum (EP-M17-10; school-scope items tagged SERVER under D24, otherwise INFERRED / PROPOSED; **G1 approved by the user 2026-10-02 (D24)**; Standard track; no observed value or approved admin behaviour changed); v1.10 records DV-M17-32 (XL3 Addendum B, B-01); v1.4–v1.9 apply XL batch 3 (`docs/qa/audit/cross-module-logic-M12-M18.md`) without changing any approved behaviour or observed value. Mood owner M26 (provisional contract). |
| Author | product-analyst (agent); data model, reconciliation and mock API of the companion SRS by solution-architect (agent) |
| Source discovery | [M17-admin-dashboard.md](../../discovery/M17-admin-dashboard.md) (§1–§10, figure table §5.1, formulas §5.2, scripts §6, endpoints §7, layout and defects D-M17-01…24 in §8, OQ-M17-01…10 in §9, Appendices A–B); inventory [`inventory/M17/`](../../discovery/inventory/M17/) (`S1…S11-*.json`, 1,851 content elements; `SHA-admin-shell.json`, 233; `_crawl.json`; `_summary.md`; seed snapshot `_snapshot-2026-09-26.json`, captured 2026-09-26 12:33 MYT; 77 raw states in `inventory/_raw/M17/`); masked screenshots `docs/discovery/img/M17/` (44) |
| Companion SRS | [srs/M17-admin-dashboard.md](../srs/M17-admin-dashboard.md) |
| Related | M01 v1.9 (User, `lastLoginAt`, `isActive`, landing pages, 404 page, canonical accounts 1–11); M02 v1.12 (§6.15 D M17 pins; XR-M17-08 rejected), M05 v1.10 (accuracy pin, Q-WEEK-RANK, Q-STRUCT, sessionless answers, `mock.addAnswer` object signature), M14 v1.3 (teacher coins 63,459), M16 (S20 week ranking with M17 ids); earlier: M02 v1.11 (users dataset 5,159 and schools register, §6.15 monitoring allocation, subscriptions); M03 (subjects 1–31, levels 1–11, curriculum chapters); M04 v1.9 (question dataset, §4.1 named queries, §6.13, ImportRun); M05 v1.8 (answer log and sessions §6.14, Q-ANS-*/Q-SESS-*, structured attempts, mock clock); M07 (PKSK rows); M08 v1.7 (headcount, SchoolSpmHistory); M09 (banners, articles, notes); M10 v1.6 (classrooms and enrolment; mounts the S4–S7 component on `/guru/command-center/*`); M11 v1.8 (monitoring component mounted on `/admin/monitoring*`, XR-M11-08, BR-M11-27, BR-M11-34); M12 (Kirkpatrick feedback Q-M12-T1); M14 (teacher and pupil wallets, badges); M16 (battles, games); M19 (payments export); M21 (sponsors); M23 / global shell ([design/shells.md](../../design/shells.md)); M26 (tuition centres; mood check-in owner candidate) |

**Change log**

| Version | Date | Change |
|---|---|---|
| 1.13 | 2026-10-03 | **Revision history — v1.13, Session 6 second pass (Standard track; see SRS v1.15; G1 approval kept).** New **DV-M17-38** (S2 T3 "aktif 30h": live 91, rebuild computed ≥ 94; month 86 and M11 30-day 89 are both observed and M05 confirmed infeasible — D9 observed-vs-observed), **DV-M17-39** (S6 "Senarai Pelajar" table fits its card at 768 px; live overflows — D9 responsive), **DV-M17-40** (display constant DC-M17-03 "Pembetulan" 899 / +0.0% / 0% gets its own id). School-scope JSON responses carry `scope`, `school` and `dailyTrend` (additive, SRS §7 #3 / #4). Owner items listed (SRS OQ-M17-17); only the logins 13 / 31 / 95 (M01 / M02) stay open — session time, week change, active schools, the 25 Sep feed / heatmap (M05 v7) and "{n} GURU" (M10 mock v5) are resolved. New **DV-M17-42** (alias S3 hides "Laporan Eksekutif"), **DV-M17-43** (Top Sekolah names wrap below `xl`), **DV-M17-44** (alias S2 reflow). New **DV-M17-41**: 8284 "{n} GURU" shows 1 in both rows (week live 0), superseding DV-M17-29. AC-M17-12.3 and AC-M17-39.3 cite DV-M17-40. No observed value changed. |
| 1.12 | 2026-10-02 | **Revision history — v1.12, Session 6 build decisions (Standard track; see SRS v1.14; G1 approval kept).** (1) **New DV-M17-33 (D9):** S4 8082 shows 393 engaged / 130,233 answers and 8080 53,494 answers — M11's observed weekly cells win over the live M17 values (392 / 130,002 at the clock, 53,431); AC-M17-10.1, 18.1 (8082 cards) and 18.3 updated; DV-M17-30's "53,431 stays exact" is superseded; OQ-M17-09 closed — Lead decision: M11 wins uniformly for all five schools (8078, 8106, 8090 included; AC-M17-10.1 shows 393 / 345 / 306). (2) **S4 / S5 "Aktif (30h)"** from the last completed-session time (INFERRED); S6 "Terakhir Aktif" exact; **teacher scope on S4** counts only members of the teacher's own active classes (AC-M17-23.2 extended; the server has no teacher drill-down). (3) **UI deviations of M17-T3a:** DV-M17-34 (design tokens / mono font), 35 (mood-day "no session" line only when the week bar is 0), 36 (S7 week labels stack below 640 px), 37 ("Ralat memuatkan data" for non-404 load errors, PROPOSED); the 12 px rule stays DV-M17-25. SRS v1.14 also resolves AUD-04 (8078 83.75 %, 8106 83.84 %, 8102 83.7 %) and relabels the month figures "1,618 · 98.1 %" from pupil 2021 to pupil 2022. No id renumbered. |
| 1.11 | 2026-10-02 | **Revision history — v1.11, L06 Admin Sekolah alias — source: live M17 S2 + REFERENCE reconstruction; school-scoped behaviour UNVERIFIED (no school-admin account).** Merged the audited addendum (`docs/discovery/L06-command-center-sekolah.md` §5) as "Admin Sekolah alias (school scope)": new epic EP-M17-10 (FT-M17-10.1…10.3, 11 FN, ids assigned at merge), US-M17-36…42, AC-M17-36.1…42.2 (29), §2 actor row, §8 out-of-scope row, OQ-M17-12…15 (decided) and standing OQ-L06-07. SRS v1.13 holds FR-M17-101…118, BR-M17-34, SEC-M17-13, XR-M17-21, E2E-M17-100…128 and the guard / permission changes. Totals: 142 FN, 42 stories, 151 ACs. Delivery Lead decisions applied: OQ-M17-12 zeros for "Pembetulan" and own daily answers for "Engagement" (provisional, INFERRED); OQ-M17-13 out-of-school and unknown ids → **404** (not 403; as the teacher rule, existence not revealed); OQ-M17-14 S3 alias `/admin-sekolah/command-center/daily-activity` (INFERRED); OQ-M17-15 "← Dashboard" → `/admin-sekolah` (INFERRED). No existing id renumbered; no existing AC changed. *(The first sentence's "UNVERIFIED" tag and the "OQ-L06-07 standing" item are superseded by the D24 revision below.)* **D24 revision (user decision 2026-10-02; G1 approved for the L06 alias):** the server code/data (`/var/www/prestasiplus_cloud`, local copy `prestasiplus-reference`) is authoritative where live cannot be observed; no school-admin account is requested and OQ-L06-07 is removed. REFERENCE / UNVERIFIED tags replaced by SERVER (`path:line`) on EP-M17-10 and the actor row; server-defined school-admin copy ("Pemantauan langsung sekolah anda", "sekolah anda", no "keseluruhan platform", S3 title "Aktiviti Sekolah", "daripada 1") is now required (AC-37.1, 42.1; SRS FR-M17-106, 116). INFERRED / PROPOSED where the server does not define the item or contradicts live (live wins): drill-down 404 rule and paths, S3 alias URL, "← Dashboard" target, new-tab link, "Pembetulan" zeros, Kirkpatrick / ALESA AI; OQ-M17-12 "Engagement" now SERVER (7-day answers). Status: **Approved (G1)** incl. EP-M17-10, 2026-10-02. |
| 1.10 | 2026-09-27 | **Revision history — v1.10, XL3 Addendum B, B-01 (Delivery Lead).** S11 Guru tab: the observed contributor rows are reproduced — `<teacher:101>` (no school, "Belum", MCQ 5,547, Struktur 0, Syiling 42,600) on M02 teacher 5316 and `<teacher:137>` (SMK JALAN REKO, "Ya", 497 / 1,062 / 0, "04/06/2026 05:47") on M14 / M02 teacher 4202 (SRS v1.10–v1.11; M02 v1.25, M04 v1.16, M14 v1.7). "Jumlah Soalan" = the platform count of teacher contributions (SRS FR-M17-94). New **DV-M17-32** (cross-module constraint): the listed rows sum to 9,396 beside the tile 11,414, because 2,018 contributions belong to teachers whose live rows were not captured (389 of 551 rows captured); no displayed total contradicts the tile. No AC value changes. Status stays Approved (G1). |
| 1.9 | 2026-09-27 | **Revision history — v1.9, M02 v1.23.** S11 "Murid" totals: 51 of 57 rows computed exact; display constant DC-M17-09 for 5441, 3390, 853, 3931, 8030 (no contradicting computed total in the same view or one click away); new DV-M17-31 (D9): 2418 shows the computed 4 because its S4 page is one click from the S3 drill. OQ-M17-11 closed. Rebuild-only: the "Belum Login" list shows school names for the moved pupils. Status stays Approved (G1). |
| 1.8 | 2026-09-27 | **Revision history — v1.8, M02 v1.22.** New DV-M17-30 (D9): 8080 "Pelajar Aktif" / "plj" shows the computed 174 (live 175) — no definition reproduces 175 with 53,431 and the other schools' values; AC-10.1, AC-18.3 restated. OQ-M17-11 narrowed to the S11 "Murid" totals of 8 schools (93 pupils short, M02 v1.23 pending). Status stays Approved (G1). |
| 1.7 | 2026-09-27 | **Revision history — v1.7, M02 v1.21 (DV-M02-15).** Per-school pupil counts count every student of the school, active or not (BR-M17-03, FR-M17-93); P stays active-only. New OQ-M17-11 reports the two figures M02 v1.21 no longer reproduces (8080 engaged 175 → computed 174; S11 "Murid" totals of non-`used` schools, ≈ 105 pupils short). No AC changed. Status stays Approved (G1). |
| 1.6 | 2026-09-27 | **Revision history — v1.6, XL3 Addendum A-01** (SRS only): C-05 and XR-M17-06 state that the M02 `isActive` pins are on P and T, which exclude the fixture schools 900001–900099 (3,152 / 1,371 pupils, 502 / 48 teachers, logged in 1,708 / 269; M02 v1.20). No behaviour or observed value changes. Status stays Approved (G1). |
| 1.5 | 2026-09-27 | **Revision history — v1.5, XL batch 3 round 2** (M10 v1.8 R2-06). New DV-M17-29 (D9): S3 "Bulan Ini" 8284 "1 GURU" → computed "0 GURU" (contradicted the week's 0 for the same pupil); AC-16.2 restated. The "{n} GURU" enrolments are M10 v1.8 §6.2.1; session and activity counts include `pksk` per M05 v1.12 BR-35 (SRS). Status stays Approved (G1). |
| 1.4 | 2026-09-27 | **Revision history — v1.4, XL batch 3 round 1** (M17 items XL3-16, XL3-19, XL3-23, XL3-31; owner updates M05 v1.10, M02 v1.12, M14 v1.3). XL3-16: the PROPOSED 25 Sep sessions are re-placed on canonical ids shared with M16 S20 (XR-M16-09 confirmed: W2–W5 = 2013 / 2014 / 2015 / 2016; W5 = 4 × 40; the week sessions of 8106 pupils 2017, 2018, 2019 in SPM modes); all "today", week and month figures unchanged. Battles and games read M16 v1.3 Q-M16-BATTLES / Q-M16-BATTLES-WIN. XL3-19: S11 pupil "Syiling" column = display constant DC-M17-08 (AC-34.1, FN-8.5.1). XL3-23: mood owner M26 (OQ-M17-01 decided), sponsors M21, tuition M26 as provisional owner contracts. XR-M17-08 rejected by M02 v1.12 → DV-M17-28 final. Status stays Approved (G1). |
| 1.3 | 2026-09-27 | **Revision history — v1.3, G1 approval** after audit round 3 PASS. R3-01 and R3-02 are SRS-only (§6.7 B today login roles; new R-49 for the S11 row-35 date). No behaviour or value change. Status Approved (G1). |
| 1.2 | 2026-09-27 | **Audit round 2 fixes (Delivery Lead decisions).** R2-01: the 16 PROPOSED sessions of 25 Sep re-placed (8 by the 8082 week pupil with 160 · 73.8 %, its whole week; 4 + 4 by two 8106 pupils whose week stays at 159) — AC-15.1, AC-16.1 restated (today 340 · 77.6 % · 4 pupils); a script check proves that the clock state plus the post-clock record reproduces the 12:33 week and month top fives, accuracies and school weeks (SRS C-17). R2-02: the post-clock logins are re-dated to 25 Sep before 15:40 in the same order (no 24 h shift; S11 "Login Terakhir" dates stay as observed except row 35, 26/09 → 25/09); 3 unlisted 25/09 pupils placed; "today" logins computed = 13 (AC-15.1, AC-17.3, AC-32.1). R2-03: accuracy band 395,811–396,287, value 395,873 (OQ-M17-02). Coverage 1,851/1,851; trace 0 errors. |
| 1.1 | 2026-09-26 | **Audit round 1 fixes with the Delivery Lead decisions.** AUD-M17-01: the single project clock 2026-09-25T15:40:00+08:00 applies (M14 precedent); every AC is restated at it; the 26 Sep 12:33 readings are kept as the observed record (SRS §6.6); rows observed after the clock are not seeded (XR-M17-01 withdrawn); users whose login was observed after the clock keep a login 24 h earlier, so the "ever logged in" and per-period login counts stay. AUD-M17-02: the S8/S9 footer is the build time of the request minute (FN-6.1.2, 6.1.4, 6.3.10, 6.4.6; AC-24.3, 27.5, 28.3). AUD-M17-03: OQ-M17-02 becomes a mandatory owner fix (XR-M17-03) at the XL batch 3 gate. AUD-M17-05: new DV-M17-28 (cross-module constraint, S11 values; XR-M17-08 preferred to restore them). AUD-M17-06: DC-M17-04 scoped to 2026 (FN-6.2.2, AC-27.6). AUD-M17-07: the AI ratio is derived from DC-M17-05 (FN-3.3.3). AUD-M17-08: §9 OQ-M17-08 = SRS §8.2 (one list). Coverage re-run 1,851/1,851; trace 0 errors. |
| 1.0 | 2026-09-26 | First issue under D7 (fidelity), D8 (proven completeness), D9/D10 (deviation rule, accessibility and scope), D11 (virtual datasets, every count computed; display-constant exception) and D12 (one owner per store). §6 coverage matrix generated by script from the inventory JSON: 1,851/1,851 content elements covered, 0 unmapped (plus the 233 shell elements: 24 mapped, 209 excluded with owner). 27 fidelity deviations decided (§7: 22 approved fixes — two of them with a rejected part — and 5 rejected, replicate live); v1.1 adds DV-M17-28. The cross-module count conflicts of discovery §5.1 are decided one by one in SRS §6.5 (reconciliation table) with owner requests XR-M17-01…20 (SRS §6.8). |

**Conventions** (same as M01–M15)
- Quoted UI copy is the exact live text. English or mixed words that live shows ("Overview", "Engagement", "Champion", "Disengaged", "Live Feed", "Top Sekolah", "Headcount", "HeadCount", "NPS Score", "Refresh", "Fokus →", "Lvl 1", "Powered by ALESA AI", "Rule-based Analysis", English month names on S8/S9/S10) are live copy and are kept. Where CSS upper-cases a text, this is stated ("upper case by CSS").
- **OBSERVED** = seen on the live site (walk-through, inventory state, screenshot, captured JSON). **SOURCE-DERIVED** = taken from page script or markup captured read-only, but the state was never rendered on live (e.g. S3 subject bars, S7 mood-day modal, S2 "Top Improvers"). **INFERRED** = the most likely live behaviour, not observed; no new UX is invented. **UNVERIFIED** = live behaviour exists but could not be observed. **PROPOSED** / **PROPOSED COPY** = a value, layout or text written for the rebuild, listed in §9 for the Delivery Lead to report at G1.
- **D-M17-n** = live defect of discovery §8.2. **OQ-M17-n** here = this document's open questions (§9; the discovery questions are cited as "disc. OQ-M17-n"). **DV-M17-nn** = fidelity deviation (§7); anything not listed there must match live. **DC-M17-nn** = documented display constant (D11 exception; SRS §6.3). **Q-M17-*** = M17 named queries on the owners' datasets (SRS §6.4). **XR-M17-nn** = request to an owner module (SRS §6.8). **SEC-M17-nn** = risk in live behaviour, replicated with dummy data (SRS §11.1).
- **Personal data:** pupils are minors. Discovery replaced every person by `<name>` / `<person:n>` / `<student:n>` / `<teacher:n>` / `<masked>` and every e-mail by a domain class. School names are observed public anchors and are kept. Seeds use clearly fictitious names ("Murid Demo …", "Cikgu Demo …"). No real person's name appears in this document.
- **Mock clock:** every M17 value in this document is stated at the single project clock **2026-09-25T15:40:00+08:00** (architecture §6.12; Delivery Lead decision on AUD-M17-01, as M14). The live readings of 2026-09-26 12:33 are the observed record (SRS §6.6); where they include activity after the project clock, the value at the clock is computed and marked "computed; live …". No record is dated after the clock.
- **Times:** live prints UTC under an "MYT" label (D-M17-06). This document quotes every time in MYT (DV-M17-06); where a live UTC reading is quoted it says so.

---

## 1. Overview

M17 is the admin's **platform-level view**: a dashboard of the question bank and platform counts, a live dark "Command Center" with a four-level drill-down (school → teacher → class → pupil), a daily-activity board, a yearly executive report with a per-school focus page, a question-bank analytics page and a platform statistics report. The TRACKER lists 8 M17 routes; the crawl found **11 screens** (5 new routes).

**Routes covered**

| # | Route | Tab title (exact live) | Shell · header title / subtitle | Admin outcome (observed) |
|---|---|---|---|---|
| S1 | `/admin` | "Dashboard - Admin Panel" | SHA · "Dashboard" / "Gambaran Keseluruhan Platform" | 200 |
| S2 | `/admin/command-center` | "PRESTASIPLUS COMMAND CENTER" | standalone dark page; heading "PrestasiPlus Command Center" (upper case by CSS) | 200; polls live data every 10 s |
| S3 | `/admin/command-center/daily-activity` | "AKTIVITI PLATFORM — PRESTASIPLUS" | standalone; "⚡ AKTIVITI PLATFORM" | 200; reloads every 30 s |
| S4 | `/admin/command-center/school/{id}` (new) | "{sekolah} - Command Center" | standalone | 200; unknown id 404 |
| S5 | `/admin/command-center/school/{sid}/teacher/{uid}` (new) | "{guru} - Command Center" | standalone | 200; unknown id 404 |
| S6 | `/admin/command-center/classroom/{id}` (new) | "{kelas} - Command Center" | standalone | 200; unknown id 404 |
| S7 | `/admin/command-center/student/{id}` (new) | "{pelajar} - Command Center" | standalone | 200; unknown id 404 |
| S8 | `/admin/laporan-eksekutif` (`?year=`) | "Laporan Eksekutif {tahun}" | SHA · "Laporan Eksekutif Platform" / "Selamat datang, Admin" | 200; `?year=abc` → 500 on live (DV-M17-05) |
| S9 | `/admin/laporan-eksekutif/sekolah/{id}` (new) | "Fokus: {sekolah}" | SHA · "Laporan Fokus Sekolah" / "Selamat datang, Admin" | 200; unknown id 404 |
| S10 | `/admin/analytics` | "Analitik & Statistik - Admin Panel" | SHA · "Analitik & Statistik" / "Analisis mendalam data platform" | 200; query strings ignored |
| S11 | `/admin/laporan` (`?range=7\|30\|90`) | "Laporan Statistik - Admin Panel" | SHA · "Laporan Statistik" / "Penglibatan pengguna seluruh platform" | 200; other range → 30 |

Other access outcomes: `/admin/dashboard`, `/admin/statistics`, `/admin/reports`, `/admin/command-center/school` (no id) and `/admin/laporan-eksekutif/sekolah` (no id) → global 404 (OBSERVED).

**Drill-down chain.** S2 / S3 → S4 school (teachers) → S5 teacher (classes) → S6 class (pupils) → S7 pupil (stats and modals); each level has "← Kembali ke …" and a breadcrumb.

**Ownership (Delivery Lead decisions, binding for this document).**
- **M17 owns the Command Center** S2–S7, including the drill-down component set S4–S7. M10 mounts the same component under `/guru/command-center/{school|classroom|student}/…` (discovery §1: `/guru/command-center/student/2022` returned the same title and page text), the way M17 mounts M11's monitoring. M10 v1.6 today lists those pages as BLOCKED (FR-M10-26); XR-M17-12 asks M10 to mount this component.
- **`/admin/monitoring*` is the M11 monitoring component** (identity re-verified: `/admin/monitoring` and `/guru/monitoring` return the same 221,357-character `<main>`). M17 only mounts it with its drill-down and export routes (FN-M17-1.2.6; M11 XR-M11-08).
- **`/admin/performance` → M23** (system performance and security, not academic analytics). Out of scope here.
- **Stores:** M17 owns no count-bearing store. Every figure is a named query of the owners' datasets (questions M04, answers and sessions M05, users and schools M01/M02, curriculum M03, classes M10, headcount and SPM history M08, Kirkpatrick feedback M12, wallets and badges M14, battles M16, sponsors M21, tuition centres M26) or a documented display constant DC-M17-01…07 (D11 exception). M17 stores only the executive-report cache (SRS DATA-M17-01).

---

## 2. Actors

| Role | Involvement in M17 | Verified |
|---|---|---|
| Admin | Every screen, platform-wide data; the only role observed. | OBSERVED (admin account) |
| Guru (teacher) | The S4–S7 drill-down component through M10's `/guru/command-center/*` mount, scoped to own schools/classes/pupils; no access to `/admin/*`. | INFERRED (no teacher account; OQ-M17-06) |
| Admin Sekolah (school admin) | **v1.11:** the Command Center at `/admin-sekolah/command-center` (route OBSERVED, 403 for the platform admin), its daily-activity board and the S4–S7 drill-downs, every figure and object scoped to the viewer's own school (EP-M17-10). Elsewhere under `/admin/*` no access: sent to its own M01 landing page. | OBSERVED (route) / SERVER (scope, access; D24) / INFERRED (drill-down rules) |
| PPD, JPN, other roles | No evidence of access to M17 routes. `/admin/*` sends a signed-in non-admin to its own M01 landing page (the rule M11 already relies on for `/admin/monitoring*`). PPD/JPN have their own Command Center pages in M18 and get 403 on the school-admin alias. | INFERRED (OQ-M17-06) |
| Pelajar (pupil) | Subject of the data (minors); no access. | INFERRED |
| Guest | Redirected to `/login` (M01 guard). | INFERRED (not probed) |

---

## 3. Functional breakdown (Epic → Feature → Function)

Built from the element inventory (`docs/discovery/inventory/M17/`) and the Function catalogue used by the §6 script. "EL" lists inventory element ids (prefix `EL-M17-`). Functions with EL "—" are behaviours (access, polling, cache, mounts, layout, cross-cutting rules, unobservable states) with no element of their own. Figures in braces `{…}` are defined in SRS §6.4 (named queries) or §6.3 (display constants).

### EP-M17-1 — Navigation, access and shells

**FT-M17-1.1 — Menu entries, headers and titles**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M17-1.1.1 | Sidebar pinned card "`fa-satellite-dish` Command Center LIVE" with the red pulsing "LIVE" pill → S2 `/admin/command-center` (global admin shell renders it; M17 owns the target). Not in the mobile "Lagi" drawer (as live). | SHA-004–005 | Admin | OBSERVED |
| FN-M17-1.1.2 | Sidebar entries to M17 screens in the "HARIAN" area: pinned "`fa-chart-line` Aktiviti Harian" (emerald) → S3; group "HARIAN": "`fa-tachometer-alt` Dashboard" → S1, "`fa-file-alt` Laporan Eksekutif" → S8. "Audio KBAT" in the same area belongs to M09. | SHA-006, SHA-008–010 | Admin | OBSERVED |
| FN-M17-1.1.3 | Group "ANALITIK": "`fa-chart-pie` Analitik" → S10, "`fa-binoculars` Monitoring" → `/admin/monitoring` (M11 component, FN-1.2.6), "`fa-chart-bar` Laporan" (orange-500) → S11. The KIRKPATRICK submenu in the same group belongs to M12. | SHA-011–013, SHA-022 | Admin | OBSERVED |
| FN-M17-1.1.4 | Mobile bottom navigation (below `lg`): "`fa-tachometer-alt` Dashboard" → S1 and "`fa-ellipsis-h` Lagi"; the "Lagi" drawer repeats "`fa-chart-pie` Analitik" → S10, "`fa-chart-bar` Laporan Aktiviti" → S11 and "`fa-binoculars` Monitoring"; Command Center and Aktiviti Harian are not in the drawer (as live, DV-SH-05 style: replicated). | SHA-136, SHA-140, SHA-142–144 | Admin | OBSERVED |
| FN-M17-1.1.5 | Admin-shell header title / subtitle and tab title per SHA screen, all correct on live: S1 "Dashboard" / "Gambaran Keseluruhan Platform", tab "Dashboard - Admin Panel"; S8 "Laporan Eksekutif Platform" / "Selamat datang, Admin", tab "Laporan Eksekutif {tahun}"; S9 "Laporan Fokus Sekolah" / "Selamat datang, Admin", tab "Fokus: {sekolah}"; S10 "Analitik & Statistik" / "Analisis mendalam data platform", tab "Analitik & Statistik - Admin Panel"; S11 "Laporan Statistik" / "Penglibatan pengguna seluruh platform", tab "Laporan Statistik - Admin Panel". Standalone tab titles: S2 "PRESTASIPLUS COMMAND CENTER", S3 "AKTIVITI PLATFORM — PRESTASIPLUS", S4–S7 "{sekolah\|guru\|kelas\|pelajar} - Command Center". | SHA-118–119, SHA-198–199, SHA-206, SHA-209–210, SHA-213–214 | Admin | OBSERVED |
| FN-M17-1.1.6 | The sidebar item of the current M17 SHA screen is shown active (S1 "Dashboard", S8/S9 "Laporan Eksekutif", S10 "Analitik", S11 "Laporan"); S2–S7 have no shell (standalone dark pages). | — | Admin | OBSERVED |

**FT-M17-1.2 — Access, errors and mounted routes**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M17-1.2.1 | Guest on any M17 route or endpoint → redirected to `/login` by the M01 guard. | — | Guest | INFERRED |
| FN-M17-1.2.2 | A signed-in non-admin on `/admin/*` (M17 routes, including `/admin/monitoring*`) is sent to its own M01 landing page; `/api/admin/*` answers 403. The shared drill-down endpoints `/api/command-center/*` also serve the M10 teacher mount, scoped to the teacher (FN-5.5.1). **v1.11:** the exceptions for `school_admin` (live-data, daily-activity, drill endpoints; own school only) are in EP-M17-10. | — | All non-admin roles | INFERRED |
| FN-M17-1.2.3 | Unknown or non-numeric id on S4, S5, S6, S7 or S9 → the global 404 page: "404", "🔍", "Halaman Tidak Dijumpai", "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?", "Halaman Utama" → `/`, "Mula Latihan" (→ `/practice` per M01 DV-02; live `/latih-tubi`), "PRESTASIPLUS". | S4-020–025, S5-019–025, S6-025–031, S7-066–071, S9-107–113 | Admin | OBSERVED |
| FN-M17-1.2.4 | Probed paths without a page → global 404: `/admin/dashboard`, `/admin/statistics`, `/admin/reports`, `/admin/command-center/school` (no id), `/admin/laporan-eksekutif/sekolah` (no id); a non-POST request to `/admin/laporan-eksekutif/clear-cache` also → 404 (INFERRED; 405 → 404 precedent). | — | Admin | OBSERVED / INFERRED |
| FN-M17-1.2.5 | S8 with a non-numeric `?year=` (live: HTTP 500 "500", "⚙️", "Ralat Pelayan", "Sesuatu tidak kena di pihak kami. Pasukan teknikal telah dimaklumkan. Sila cuba sebentar lagi.", "Halaman Utama", "Cuba Semula", "PRESTASIPLUS") → the report of the current year renders instead (DV-M17-05). | S8-321–327 | Admin | OBSERVED + DV-M17-05 |
| FN-M17-1.2.6 | Mount the M11 monitoring component on `/admin/monitoring`, `/admin/monitoring/sekolah/{id}`, `…/pelajar/{id}`, `…/guru/{id}` and the exports `/admin/monitoring/export/pdf`, `/admin/monitoring/export/csv` unchanged (M11 XR-M11-08, BR-M11-27, BR-M11-34); the admin sidebar "Monitoring" is active there (M11 FR-M11-05). | — | Admin | OBSERVED (identity re-verified) |
| FN-M17-1.2.7 | `/admin/performance` is system performance (M23), not part of M17; the sidebar link belongs to the global shell. | — | Admin | OBSERVED |

### EP-M17-2 — Dashboard (S1 `/admin`)

**FT-M17-2.1 — Question, curriculum and user cards**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M17-2.1.1 | Card "Soalan Aktif" {Q-ACTIVE + Q-PKSK} with "`fa-calendar-week` Minggu ini: {questions created since Monday 00:00}". | S1-001–004 | Admin | OBSERVED |
| FN-M17-2.1.2 | Card "Diluluskan" {DC-M17-01} with "`fa-check-circle` Aktif digunakan: {Q-ELIGIBLE + Q-PKSK}". | S1-005–008 | Admin | OBSERVED |
| FN-M17-2.1.3 | Cards "Menunggu Review" {pending_review} / "`fa-clock` Perlu tindakan" and "Draf" {draft} / "`fa-edit` Belum siap" (M04 statuses, PKSK included). | S1-009–016 | Admin | OBSERVED |
| FN-M17-2.1.4 | Cards "Subjek" {M03 subjects} / "`fa-circle` {active} Aktif" and "Tahap Pendidikan" {M03 levels} / "`fa-graduation-cap` Darjah & Tingkatan". | S1-017–024 | Admin | OBSERVED |
| FN-M17-2.1.5 | Card "Pengguna" {M02 users} / "`fa-user` {students} Pelajar" (no thousands separator in the sub-line, as live). | S1-025–028 | Admin | OBSERVED |

**FT-M17-2.2 — Battle and sponsor cards**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M17-2.2.1 | Card "Battle Arena" / "PvP Quiz Battles": "`fa-gamepad` {n} Total", "`fa-circle` {n} Aktif", "`fa-flag-checkered` {n} Selesai" (M16 battle store) and icon links `fa-school` → `/battle/ranking-sekolah`, `fa-trophy` → `/battle/leaderboard`. | S1-029–036 | Admin | OBSERVED (values: M16 owner, XR-M17-15) |
| FN-M17-2.2.2 | Sponsor cards (M21): "Jumlah Penaja" {n} / "`fa-check-circle` {active} Aktif"; "Menunggu Kelulusan" {n} / "`fa-check` Tiada yang menunggu" when 0; "Ditolak" {n} / "`fa-times-circle` Permohonan ditolak"; "Digantung" {n} / "`fa-pause-circle` Akaun digantung". | S1-037–052 | Admin | OBSERVED (values: M21 owner, XR-M17-16) |

**FT-M17-2.3 — Quick actions, latest questions, status distribution**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M17-2.3.1 | Three quick-action tiles, each captioned "Tindakan Pantas": "`fa-plus` Tambah Soalan Baru" → `/admin/questions/create`, "`fa-book-medical` Tambah Subjek Baru" → `/admin/subjects/create`, "`fa-file-csv` Import CSV Soalan" → `/admin/questions/import` (M04/M03 pages). | S1-053–055 | Admin | OBSERVED |
| FN-M17-2.3.2 | Card "Soalan Terkini" / "10 soalan terbaru" with "Lihat Semua `fa-arrow-right`" → `/admin/questions`; table "Soalan", "Subjek", "Tahap", "Status", "Tarikh"; the 10 newest questions (M04 order `createdAt` desc, id asc): text cut to 60 characters + "...", type chip ("Mcq") and "Kesukaran: {n}/5", subject chip, level name, status chip, date `dd/mm/yyyy`. | S1-056–063 | Admin | OBSERVED |
| FN-M17-2.3.3 | Card "Taburan Status Soalan": "Draf", "Menunggu", "Diluluskan" {DC-M17-01}, "Ditolak", "Diarkib" {DC-M17-02}. | S1-064–075 | Admin | OBSERVED |

**FT-M17-2.4 — Quick links and CSV exports**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M17-2.4.1 | Card "Pautan Pantas": "`fa-book-open` Kurikulum" → `/admin/curriculum`, "`fa-chart-pie` Analitik" → S10, "`fa-image` Banner" → `/admin/banners`, "`fa-newspaper` Artikel" → `/admin/articles`. | S1-076–081 | Admin | OBSERVED |
| FN-M17-2.4.2 | Card "Muat Turun Data (CSV)": "`fa-users` Pengguna" → `/admin/export/users`, "`fa-question-circle` Soalan" → `…/questions`, "`fa-credit-card` Pembayaran" → `…/payments`, "`fa-school` Sekolah" → `…/schools`; plain links that download a CSV (file content UNVERIFIED; prototype columns PROPOSED, SEC-M17-01). | S1-082–087 | Admin | OBSERVED (links) / PROPOSED (file) |

### EP-M17-3 — Command Center LIVE (S2 `/admin/command-center`)

**FT-M17-3.1 — Page frame and live polling**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M17-3.1.1 | Standalone dark header: "PrestasiPlus Command Center" (upper case by CSS), "← Dashboard" → S1 and "📊 Aktiviti Harian" → S3 (hover background change), pulsing "LIVE" pill, clock `HH:MM:SS` ticking every second in Asia/Kuala_Lumpur and "MYT". | S2-001–006, S2-107–108 | Admin | OBSERVED |
| FN-M17-3.1.2 | Before the first `live-data` response the page shows the server placeholders ("--:--:--", "--", "0 soalan", "Memuatkan wawasan...", "Memuatkan..."); each response re-renders every panel, the three big counters animate from the previous value (800 ms cubic ease-out); the page polls every 10 s; a failed poll keeps the previous values and logs "Fetch error:" (SOURCE-DERIVED). | — | Admin | OBSERVED / SOURCE-DERIVED |
| FN-M17-3.1.3 | Footer "Powered by ALESA AI · PrestasiPlus © 2026 · Dijana automatik · Data dikemaskini setiap 10 saat". | S2-106 | Admin | OBSERVED |

**FT-M17-3.2 — Headline counters**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M17-3.2.1 | KPI "Sekolah Berdaftar" {schools with an active subscription} / "langganan aktif". | S2-007–009 | Admin | OBSERVED |
| FN-M17-3.2.2 | KPI "Pelajar Berdaftar" {Q-M17-PUPILS} / "{Q-M17-ENGAGED} aktif menjawab". | S2-010–013 | Admin | OBSERVED |
| FN-M17-3.2.3 | KPI "Soalan Dijawab" {Q-M17-ANS} / "sepanjang masa". | S2-014–016 | Admin | OBSERVED |
| FN-M17-3.2.4 | KPI "Ketepatan Purata" {Q-M17-ACC}% / "keseluruhan platform". | S2-017–019 | Admin | OBSERVED |

**FT-M17-3.3 — Panels**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M17-3.3.1 | Panel "🏆 Top Sekolah": up to 5 rows — rank badge (colours r1–r5), school name link → S4, "{n} plj" (engaged pupils of the school); empty "Tiada data". | S2-020–027 | Admin | OBSERVED |
| FN-M17-3.3.2 | Panel "🔬 Kirkpatrick": T1 bar + stars "{★…☆} {v}/5" from the M12 satisfaction mean (DV-M17-08); T2 bar + "{acc}% ketepatan"; T3 bar (n ÷ 500) + "{n} aktif 30h"; T4 bar (gps ÷ 5) + "GPS {gps 3 decimals}". | S2-028–037 | Admin | OBSERVED + DV-M17-08 |
| FN-M17-3.3.3 | Panel "🤖 ALESA AI": template text "Platform menunjukkan **{peningkatan\|penurunan\|stabil}** {\|change\|}% minggu ini. {activeRatio}% pelajar terlibat aktif. Ketepatan purata {acc}% dengan {n} sekolah aktif. GPS keseluruhan: {gps}." with the GPS of T4 (DV-M17-09); activeRatio = (Champion + Konsisten + Berkembang) ÷ Σ buckets of DC-M17-05 (a display constant, not the "aktif menjawab" population); "Memuatkan wawasan..." before data. | S2-038–042 | Admin | SOURCE-DERIVED + DV-M17-09 |
| FN-M17-3.3.4 | Panel "📈 Aktiviti Hari Ini": bar (width = today ÷ max(today, week ÷ 5, 100)), "{n} soalan", "Minggu ini: {week}", change line "▼ -{n}% vs minggu lepas" (rose) / "▲ +{n}% vs minggu lepas" (emerald) / "Sama dengan minggu lepas" (muted). | S2-043–049 | Admin | OBSERVED / SOURCE-DERIVED (other branches) |
| FN-M17-3.3.5 | Panel "⚡ Live Feed": the 10 latest pupil answers of the log (DV-M17-27) — time `HH:MM` (MYT, DV-M17-06), pupil name, subject short name, school name cut to 15 characters linking to S4 (full name in `title`), "✓" / "✗"; empty "Tiada aktiviti terkini". Names are escaped (DV-M17-26). | S2-050–063 | Admin | OBSERVED + DV-M17-06/26/27 |
| FN-M17-3.3.6 | Panel "⭐ Top Pelajar Minggu Ini": up to 5 rows — medal 🥇 🥈 🥉 then "⚬", pupil link → S7, "{n} jwb · {acc}%"; empty "Tiada data". | S2-064–071 | Admin | OBSERVED |
| FN-M17-3.3.7 | Panel "💚 Mood Pelajar": 😊 "Gembira", 😐 "OK", 😢 "Sedih", 😩 "Tekanan" with all-time check-in counts (mood owner OQ-M17-01). | S2-072–085 | Admin | OBSERVED (owner pending) |
| FN-M17-3.3.8 | Panel "🔄 Pembetulan": "{n}" "Rekod", "{+x.x}%" "Purata Naik", "{n}%" "Kadar Baik" (DC-M17-03); list "Top Improvers" ("{before}% → {after}% (+{n}%)") only when present — never present in the prototype (SOURCE-DERIVED, not observed). | S2-086–093 | Admin | OBSERVED + DC-M17-03 / SOURCE-DERIVED (improvers) |
| FN-M17-3.3.9 | Panel "📊 Engagement": horizontal bars "Champion" (emerald), "Konsisten" (cyan), "Berkembang" (amber), "Minimum" (#fb923c), "Disengaged" (rose), width = n ÷ max (DC-M17-05). | S2-094–105 | Admin | OBSERVED + DC-M17-05 |

**FT-M17-3.4 — Layout**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M17-3.4.1 | S2 layout: 3-column board filling the viewport at ≥ 1280 with in-panel scrolling (as live); at 768 two columns and at 375 one column, header wrapping, page scrolls vertically, nothing clipped (DV-M17-01). | — | Admin | OBSERVED + DV-M17-01 |

### EP-M17-4 — Aktiviti Harian (S3 `/admin/command-center/daily-activity`)

**FT-M17-4.1 — Header, period tabs and refresh**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M17-4.1.1 | Header "⚡ AKTIVITI PLATFORM", "◀ Command Center" → S2, "Laporan Eksekutif" → S8, clock `HH:MM:SS` + "MYT" ticking every second. | S3-001–005, S3-090, S3-143, S3-359–364 | Admin | OBSERVED |
| FN-M17-4.1.2 | Period tabs "📅 Hari Ini" (default), "📆 Minggu Ini", "🗓️ Bulan Ini": a click reloads `GET /api/command-center/daily-activity?period={today\|week\|month}`, closes the school drill; the heatmap shows only on "Hari Ini". `?period=` in the page URL is ignored; the API treats an unknown period as today and echoes it (as live). | S3-006–008 | Admin | OBSERVED |
| FN-M17-4.1.3 | The page reloads the current period every 30 s; while loading a list shows the spinner; a failed load shows "Gagal memuatkan"; a failed drill shows "Gagal" (SOURCE-DERIVED). | — | Admin | SOURCE-DERIVED |

**FT-M17-4.2 — Pulse cards**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M17-4.2.1 | Pulse card 🏫 "Sekolah Aktif" {schools with ≥ 1 pupil answer in the period} / "daripada {Jumlah Sekolah}" (DV-M17-13). | S3-009–013 | Admin | OBSERVED + DV-M17-13 |
| FN-M17-4.2.2 | Pulse card 👤 login count of the period with the label "Login Hari Ini" / "Login Minggu Ini" / "Login Bulan Ini" (DV-M17-10) and the role line "{role}: {n} · …" (roles with ≥ 1 login, live role order). | S3-014–019, S3-144–147 | Admin | OBSERVED + DV-M17-10 |
| FN-M17-4.2.3 | Pulse card 🎓 "Pelajar Aktif" {distinct pupils with an answer in the period} / "daripada {Q-M17-PUPILS}". | S3-020–024 | Admin | OBSERVED |
| FN-M17-4.2.4 | Pulse card 📝 "Soalan Dijawab" {answers in the period} / "Ketepatan: {acc}%". | S3-025–029 | Admin | OBSERVED |
| FN-M17-4.2.5 | Pulse card 🕐 "Sesi Latihan" "{completed}/{started}" / "Purata: {m}m {s}s" (mean `timeSpent`). | S3-030–034, S3-148–149 | Admin | OBSERVED |
| FN-M17-4.2.6 | Pulse card 🔥 "Engagement" {mood check-ins + missions completed + badges + question sets created} / "Mood:{n} Badge:{n} Misi:{n}". | S3-035–038, S3-150 | Admin | OBSERVED / SOURCE-DERIVED (formula) |

**FT-M17-4.3 — School list and drill**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M17-4.3.1 | Card "Sekolah": one clickable row per school with activity in the period ("{i}. {sekolah}", then "{n} GURU" when the school has answers or "{n} LOGIN" when it has only logins, "{n} PELAJAR", "{n} SOALAN", accuracy "{n}%" / "-%" coloured `acc-g` ≥ 70, `acc-m` ≥ 50, else `acc-l`); rows without answers at 50 % opacity; order: schools with answers by active pupils desc (ties: answers desc, INFERRED), then login-only schools by id (INFERRED); empty "😴 Tiada aktiviti". | S3-039–041, S3-151, S3-339–347 | Admin | OBSERVED |
| FN-M17-4.3.2 | School drill (row click toggles; `GET /api/command-center/daily-activity/school/{id}?period=`): "👨‍🏫 Guru Aktif ({n})" rows — teacher link → S5, "{n} pelajar", accuracy, "{time ago}". | S3-091–134, S3-152–209 | Admin | OBSERVED |
| FN-M17-4.3.3 | Drill section "🎓 Pelajar ({n})": pupil link → S7, "{n} soalan", accuracy, last activity "{time ago}". | S3-135–138, S3-210–298 | Admin | OBSERVED |
| FN-M17-4.3.4 | Drill section "👤 Login ({n})": name, role chip, "{time ago}"; empty drill "Tiada data terperinci". | S3-299–338 | Admin | OBSERVED |
| FN-M17-4.3.5 | Drill footer "Lihat penuh →" → S4 of that school. | S3-139 | Admin | OBSERVED |

**FT-M17-4.4 — Activity panels**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M17-4.4.1 | Card "Subjek": one bar per subject with answers in the period, short names (MATEMATIK → "Matematik", BAHASA_MELAYU → "BM", BAHASA_INGGERIS → "BI", SAINS → "Sains", PENDIDIKAN_ISLAM → "P.Islam", SEJARAH → "Sejarah", GEOGRAFI → "Geo", PENDIDIKAN_MORAL → "Moral", other subjects by name); empty "-" (DV-M17-11: filled from the period's answers). | S3-042–043 | Admin | OBSERVED (empty) + DV-M17-11 / SOURCE-DERIVED (bars) |
| FN-M17-4.4.2 | Card "Heatmap Jam (Hari Ini)" (today only): 24 cells, tooltip "{h}:00 — {n} soalan", hour of `answeredAt` in MYT (DV-M17-06); empty "Tiada data". | S3-044–068 | Admin | OBSERVED + DV-M17-06 |
| FN-M17-4.4.3 | Card "Live Feed": the latest answers of the period — time, name, subject, ✓/✗ (DV-M17-11); empty "Tiada aktiviti". | S3-069–070 | Admin | OBSERVED (empty) + DV-M17-11 |
| FN-M17-4.4.4 | Card "Login Terkini": the 10 latest logins of the period — role tag (`role-{role}`: "admin", "student", "teacher", "school_admin", "parent"), name (pupils → S7, teachers → S5), school name or "Pelajar Luar" (rose) for a pupil without a school, package chip (AKTIF / PKSK / SEKOLAH / FREE / BEBAS / ADMIN / PARENT, coloured), "{n} minit/jam/hari/minggu yang lepas"; empty "Tiada login". | S3-071–079, S3-140, S3-348–349, S3-365–376 | Admin | OBSERVED |
| FN-M17-4.4.5 | Card "Top Pelajar": up to 5 rows — rank (rank-1..3 / rank-n), pupil link → S7, school, "{n} jwb", accuracy; empty "Tiada data". | S3-080–085, S3-141–142, S3-350–358 | Admin | OBSERVED |
| FN-M17-4.4.6 | Card "Mood Pelajar": 4 emoji tiles with the period's check-in counts; empty "Tiada data". | S3-086–087 | Admin | OBSERVED (empty) / SOURCE-DERIVED (tiles) |
| FN-M17-4.4.7 | Card "Badge Terkini": icon · name · badge name of badges earned in the period; empty "Tiada badge baru". | S3-088–089 | Admin | OBSERVED (empty) / SOURCE-DERIVED (rows) |

### EP-M17-5 — Command Center drill-down (S4–S7; shared with M10)

**FT-M17-5.1 — S4 school**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M17-5.1.1 | S4 header "PrestasiPlus Command Center", "← Kembali ke Overview" → S2, breadcrumb "Command Center" (→ S2) ▸ "{sekolah}"; tab "{sekolah} - Command Center". | S4-001–005, S4-026 | Admin | OBSERVED |
| FN-M17-5.1.2 | S4 stat cards "Jumlah Pelajar", "Pelajar Aktif", "Jumlah Jawapan", "Ketepatan". | S4-006–013, S4-027 | Admin | OBSERVED |
| FN-M17-5.1.3 | S4 "👤 Senarai Guru ({n})" table "#", "Nama Guru", "Subjek" (free text or "-"), "Kelas", "Pelajar", "Aktif (30h)"; rows clickable → S5; the owners of the school's classes who are not among its teachers are listed too (DV-M17-22). | S4-014–019, S4-028–029 | Admin | OBSERVED + DV-M17-22 |

**FT-M17-5.2 — S5 teacher**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M17-5.2.1 | S5 header, "← Kembali ke Sekolah" → S4, breadcrumb "Command Center" ▸ "{sekolah}" (link) ▸ "{guru}", info bar "Sekolah:" {sekolah}; tab "{guru} - Command Center". | S5-001–009, S5-016–017 | Admin | OBSERVED |
| FN-M17-5.2.2 | S5 "📚 Senarai Kelas ({n})" table "#", "Nama Kelas", "Tahap", "Pelajar", "Aktif (30h)", "Jumlah Jawapan", "Ketepatan" (bar + %); rows → S6; zero classes → "Senarai Kelas (0)" and one table row "Tiada kelas aktif" (OBSERVED in `cc-teacher-empty.png` and the snapshot; discovery §2.5 said "no message" — corrected, see §7 note). | S5-010–015, S5-018, S5-026–027 | Admin | OBSERVED |

**FT-M17-5.3 — S6 class**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M17-5.3.1 | S6 header, "← Kembali ke Guru" → S5, breadcrumb "Command Center" ▸ school ▸ teacher ▸ "{kelas}", info bar "Sekolah:" · "Guru:" · "Tahap:" ("T{n}"); tab "{kelas} - Command Center". | S6-001–015 | Admin | OBSERVED |
| FN-M17-5.3.2 | S6 "👤 Senarai Pelajar ({n})" table "#", "Nama Pelajar", "Jumlah Jawapan", "Ketepatan" (bar), "Terakhir Aktif" (`dd/mm HH:MM` MYT), "Status" ("Aktif" `status-active` / "Tidak Aktif" `status-inactive`), "Mood" (emoji or "-"); rows → S7. | S6-016–024 | Admin | OBSERVED |

**FT-M17-5.4 — S7 pupil and modals**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M17-5.4.1 | S7 header, "← Kembali ke Kelas" → S6, breadcrumb "Command Center" ▸ school ▸ teacher ▸ class ▸ "{pelajar}"; tab "{pelajar} - Command Center". | S7-001–011 | Admin | OBSERVED |
| FN-M17-5.4.2 | S7 stat cards "Jumlah Jawapan 🔍" (click → all-sessions modal, `title` "Klik untuk lihat semua sesi"), "Ketepatan", "Hari Aktif", "Streak", "Konsistensi". | S7-012–020 | Admin | OBSERVED |
| FN-M17-5.4.3 | S7 "📊 Pecahan Subjek": rows "{subjek} 🔍" + bar + "{correct}/{total}" (click → subject modal, `title` "Klik untuk lihat sesi"); code UMUM labelled "Latihan Bebas" (DV-M17-21). | S7-021–023 | Admin | OBSERVED |
| FN-M17-5.4.4 | S7 "📈 Aktiviti Mingguan (8 Minggu)": 8 bars (count above, `dd/mm` of the Monday below, height = n ÷ max); a 0 bar ignores clicks; others open the week modal. | S7-024–033 | Admin | OBSERVED |
| FN-M17-5.4.5 | S7 "💚 Trend Mood (30 Hari)": one dot per day with a check-in (click → mood-day modal); empty "Tiada data mood". | S7-034–036 | Admin | OBSERVED (empty) / SOURCE-DERIVED (dots) |
| FN-M17-5.4.6 | S7 "📋 HeadCount" table "Subjek", "TOV", "ETR", "RS", "Gred", "Tarikh"; rows "{subjek} 🔍" (click → headcount modal, `title` "Klik untuk lihat semua pelajar"); "-" for missing values. | S7-037–042 | Admin | OBSERVED |
| FN-M17-5.4.7 | S7 "🤖 ALESA AI Insight": "Analisis ALESA", rule-based text (observed branches "Ketepatan cemerlang ({acc}%)." and "Konsistensi rendah ({n}%) - perlu usaha lebih."), "Sumber: Rule-based Analysis". | S7-043–047 | Admin | OBSERVED / INFERRED (other branches) |
| FN-M17-5.4.8 | S7 sessions modal (`#weekModal`; × or backdrop closes): titles "Minggu {dd/mm} ({start} ~ {end})", "Semua Sesi Latihan", "{subjek} — Semua Sesi"; "Memuatkan..."; summary "Jawapan", "Sesi", "Ketepatan", "Masa"/"Jumlah Masa"; table "Tarikh", "Subjek"/"Topik", "Soalan" ("{n} 🔍"), "Betul", "Ketepatan", "Masa"; row → session modal; empties "Tiada sesi minggu ini", "Tiada sesi"; error "Ralat memuatkan data". | S7-048–051, S7-056–062, S7-075–086 | Admin | OBSERVED |
| FN-M17-5.4.9 | S7 headcount modal "HeadCount: {subjek}": summary "Pelajar", "Purata TOV", "Purata ETR", "Kadar Lulus"; table "#", "Pelajar", "TOV", "ETR", "RS", "Gred" (A+/A/A- emerald, D/E/G rose, else amber); error "Ralat". | S7-063–065 | Admin | OBSERVED |
| FN-M17-5.4.10 | S7 session modal (`#sessionModal`): title "{subjek} — {topik}", subtitle "{date} \| Kesukaran: {n\|-} \| Masa: {m}m {s}s", stats "Soalan", "Betul", "Salah", "Ketepatan" (≥ 70 emerald, < 50 rose, else amber), question rows (no · ✓/✗ · text cut at 150 · "Jawapan anda: …" rose / "Jawapan betul: …" emerald · time); "Memuatkan soalan..."; empty "Tiada data soalan"; error "Ralat memuatkan data". | S7-052–055, S7-072–074 | Admin | OBSERVED |
| FN-M17-5.4.11 | S7 mood-day modal "{emoji} {date} — Mood: {label}" with cards "Mood", "Sebab" and "Tiada sesi latihan pada hari ini. Pelajar hanya checkin mood." when the day has no session (SOURCE-DERIVED; never observed). | — | Admin | SOURCE-DERIVED |

**FT-M17-5.5 — Mount for teachers (M10)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M17-5.5.1 | The same drill-down component serves M10 `/guru/command-center/{school\|classroom\|student}/…`: for a teacher it shows only the teacher's own schools/classes/pupils (INFERRED, OQ-M17-10); M10 mounts it (M17 owns it). | — | Guru | INFERRED |

**FT-M17-5.6 — Layout**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M17-5.6.1 | S4–S7 layout: tables scroll inside their card and panels stack below `md`; no page-level horizontal scroll at 375 (DV-M17-02); no sticky column. | — | Admin | OBSERVED + DV-M17-02 |

### EP-M17-6 — Laporan Eksekutif (S8 `/admin/laporan-eksekutif`, S9 `…/sekolah/{id}`)

**FT-M17-6.1 — S8 header, refresh, year and cache**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M17-6.1.1 | S8 hero "Ringkasan Eksekutif {tahun}" / "Laporan prestasi keseluruhan platform PrestasiPlus". | S8-001–002 | Admin | OBSERVED |
| FN-M17-6.1.2 | S8 "`fa-sync-alt` Refresh" = submit of the POST form `/admin/laporan-eksekutif/clear-cache` (`_token`, hidden `year`): drops the report cache of that year and reloads it, so the footer shows the current minute (effect INFERRED; feedback UNVERIFIED — no flash in the prototype). | S8-003–006 | Admin | OBSERVED (form) / INFERRED (effect) |
| FN-M17-6.1.3 | Year navigation "← {tahun-1}" → `?year={tahun-1}`; plus "{tahun+1} →" when the shown year is before the current year (DV-M17-14). | S8-007 | Admin | OBSERVED + DV-M17-14 |
| FN-M17-6.1.4 | The report is built at request time; the footer shows the build minute, which on live equals the request minute on every load (6 loads observed without Refresh). A cache of at most about 60 s is possible (INFERRED; TTL UNVERIFIED); no build time is seeded. | — | Admin | INFERRED |

**FT-M17-6.2 — S8 KPI cards**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M17-6.2.1 | KPI cards "Jumlah Sekolah" {n} / "sekolah aktif"; "Pelajar Berdaftar" {Q-M17-PUPILS} / "{engaged in year} aktif {tahun}"; "Kadar Penglibatan" {engaged ÷ pupils}% / "daripada pelajar daftar"; "Soalan Dijawab" {answers in year} / "sepanjang {tahun}". | S8-008–023 | Admin | OBSERVED |
| FN-M17-6.2.2 | KPI cards "Ketepatan" {acc in year}% / "{v}% selepas pembetulan" (v = DC-M17-04 82.8 for 2026 only; "0%" for a year without answers, observed; INFERRED 0 for any other year); "Guru" {Q-M17-TEACHERS}; "Soalan / Pelajar Aktif" {answers ÷ engaged, 1 decimal} / "purata kedalaman penggunaan". | S8-024–034 | Admin | OBSERVED + DC-M17-04 |
| FN-M17-6.2.3 | KPI cards "Sekolah Paling Aktif" {school name} and "Bulan Paling Aktif" {BM month short name, "-" when none}. | S8-035–040 | Admin | OBSERVED + DV-M17-14 |

**FT-M17-6.3 — S8 sections**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M17-6.3.1 | "Trend Penggunaan Bulanan {tahun}": 12 bars Jan…Dec — answers above the bar, "{n}p" (distinct pupils) inside, English month abbreviations below ("Jan" … "May" … "Aug" … "Oct" … "Dec"); months without answers drawn empty. | S8-041–072 | Admin | OBSERVED |
| FN-M17-6.3.2 | "Analisis Perbandingan Sekolah": two bar lists "Kadar Penglibatan Pelajar (%)" and "Ketepatan Akhir (%)" (schools with activity, descending). | S8-073–082 | Admin | OBSERVED |
| FN-M17-6.3.3 | "Lencana Pencapaian {tahun}": one tile per school of "Jumlah Sekolah" with badges "★ Paling Aktif", "★ Paling Tepat", "★ Paling Rajin", "★ Penglibatan Tertinggi", else "Tiada lencana khas". | S8-083–199 | Admin | OBSERVED |
| FN-M17-6.3.4 | "5 Sekolah Paling Aktif": rank · school · state · "Soalan:" · "Pelajar:" "{aktif}/{daftar}" · "Penglibatan:" · "Ketepatan:" · "Fokus →" → S9. | S8-200–261 | Admin | OBSERVED |
| FN-M17-6.3.5 | "Prestasi Mengikut Subjek": one row per subject with answers "{subjek}" / "{acc}% · {n} soalan · {n} pelajar". | S8-262–263 | Admin | OBSERVED |
| FN-M17-6.3.6 | "Headcount TOV → RS ({tahun})" table "Sekolah", "Rekod", "Purata TOV", "Purata ETR", "Purata RS", "Perubahan" ("-" when missing). | S8-264–266 | Admin | OBSERVED |
| FN-M17-6.3.7 | "Kirkpatrick Evaluation": "Jumlah Respon" {n}, "Purata Kepuasan" {v} "/5", "NPS Score" {v} (M12 Q-M12-T1). | S8-267–275 | Admin | OBSERVED |
| FN-M17-6.3.8 | "GPS Perbandingan Sekolah ({tahun})": one row per school with SPM subject results "{sekolah}" / "GPS {gps} · {n} subjek · {n} calon"; note "GPS lebih rendah = lebih baik. GPS 1.0 = semua A.". | S8-276–278 | Admin | OBSERVED |
| FN-M17-6.3.9 | "Pusat Tuisyen" (M26): per centre name, "{city}, {state}", "{n}" "pelajar aktif". | S8-279–288 | Admin | OBSERVED (values: M26 owner, XR-M17-17) |
| FN-M17-6.3.10 | Footer "Laporan dijana automatik oleh PrestasiPlus · {d MMM yyyy, hh:mm AM\|PM}" (build time = request minute, MYT, DV-M17-06) and "Menyeluruh. Berasaskan Data. Berdaya Maju.". | S8-289–290 | Admin | OBSERVED + DV-M17-06 |
| FN-M17-6.3.11 | Another year (`?year=2025`, `2024`, `2027` …): same page with that year's figures ("0 aktif {y}", "0%", "0% selepas pembetulan", "Bulan Paling Aktif" "-"); the monthly, comparison, subject, headcount and GPS sections omitted when the year has no answers; "Sekolah Paling Aktif" "-", no badge and no "5 Sekolah Paling Aktif" when it has none (DV-M17-14). "Jumlah Sekolah", "Pelajar Berdaftar" and "Guru" do not depend on the year (as live). | S8-291–320 | Admin | OBSERVED + DV-M17-14 |

**FT-M17-6.4 — S9 school focus**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M17-6.4.1 | S9 "`fa-arrow-left` Kembali ke Laporan Eksekutif" → S8, school name heading, "Negeri: {negeri}". | S9-001–003, S9-100–101 | Admin | OBSERVED |
| FN-M17-6.4.2 | S9 KPI cards "Penglibatan" {pct}% / "{n} aktif / {n} daftar"; "Soalan Dijawab" {n} / "{n} soalan/pelajar" (rounded integer, no separator); "Ketepatan Akhir" {pct}%; "Konsistensi" "{months}/12" / "bulan aktif {tahun}". | S9-004–018, S9-102–106 | Admin | OBSERVED |
| FN-M17-6.4.3 | S9 "Trend Aktiviti Bulanan": 12 bars with the month's answers. | S9-019–041 | Admin | OBSERVED |
| FN-M17-6.4.4 | S9 "Prestasi Mengikut Subjek": "▲ SUBJEK TERKUAT" {subject} "{acc}% ({n} soalan)", "▼ SUBJEK PERLU PERHATIAN" {subject} "{acc}% ({n} soalan)", then every subject with an accuracy bar. | S9-042–095 | Admin | OBSERVED |
| FN-M17-6.4.5 | S9 "Headcount TOV → RS" table "Subjek", "Rekod", "Purata TOV", "Purata RS", "Perubahan". | S9-096–098 | Admin | OBSERVED |
| FN-M17-6.4.6 | S9 footer "Laporan dijana: {d MMM yyyy, hh:mm AM\|PM} · PrestasiPlus" (request minute, MYT, DV-M17-06); the year is always the current year. | S9-099 | Admin | OBSERVED |

**FT-M17-6.5 — Layout**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M17-6.5.1 | S8/S9 layout: KPI grid 2 → `md:grid-cols-5`; the 12-month chart and headcount tables scroll inside their cards at 375 with month labels at 12px (DV-M17-03). | — | Admin | OBSERVED + DV-M17-03 |

### EP-M17-7 — Analitik & Statistik (S10 `/admin/analytics`)

**FT-M17-7.1 — Imports, status distribution and content**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M17-7.1.1 | Import cards: "Jumlah Import" {runs} / "`fa-upload` Keseluruhan"; "Import Bulan Ini" {runs this month} / "`fa-calendar-check` {Month yyyy}" (English month); "Import Lepas" {runs last month} / "`fa-history` {Month yyyy}"; "Soalan Diimport" {Σ imported} / "`fa-check-double` Berjaya" (M04 ImportRun). | S10-001–016 | Admin | OBSERVED |
| FN-M17-7.1.2 | "Taburan Status Soalan": "Draf", "Menunggu Review", "Diluluskan", "Ditolak", "Diarkib" each "{n} ({p}%)" with a bar, over the coverage population + PKSK (Q-M17-COV-STATUS). | S10-017–029 | Admin | OBSERVED |
| FN-M17-7.1.3 | Content cards (M09): "Banner" {n}; "Artikel" "Terbit" {n} / "Draf" {n}; "Nota" "Terbit" {n} / "Draf" {n}. | S10-030–044 | Admin | OBSERVED |

**FT-M17-7.2 — Coverage by subject, level, difficulty and curriculum**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M17-7.2.1 | "Top 10 Subjek Aktif": bars of the 10 subjects with most coverage questions. | S10-045–076 | Admin | OBSERVED |
| FN-M17-7.2.2 | "Matriks Liputan Subjek" / "Bilangan soalan mengikut subjek dan tahap pendidikan": table "Subjek", "D1" … "D6", "T1" … "T5", "Jumlah" (31 subjects in M03 order; "-" for 0; row total bold); scrolls inside its card at every width (as live). | S10-077–115 | Admin | OBSERVED |
| FN-M17-7.2.3 | "Taburan Kesukaran Mengikut Subjek": one tile per subject with coverage questions — name, "{n} soalan", "Lvl 1" … "Lvl 5" counts. | S10-116–429 | Admin | OBSERVED |
| FN-M17-7.2.4 | "Status Kurikulum" / "Subjek yang mempunyai bab vs subjek tanpa bab": 31 tiles "{subjek}" + "{n} bab" or "Tiada bab". | S10-430–494 | Admin | OBSERVED |

### EP-M17-8 — Laporan Statistik (S11 `/admin/laporan`)

**FT-M17-8.1 — Tabs and range**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M17-8.1.1 | Tabs "`fa-chart-pie` Overview" (default), "`fa-school` Sekolah ({n})", "`fa-chalkboard-teacher` Guru ({n})", "`fa-user-graduate` Murid ({n})" — client-side, no request (DV-M17-17 populations). | S11-001–004 | Admin | OBSERVED + DV-M17-17 |
| FN-M17-8.1.2 | "`fa-calendar-alt` Tempoh:" pills "7 Hari" → `?range=7`, "30 Hari" → `?range=30` (default; active pill white), "3 Bulan" → `?range=90`; any other value → 30; a pill is a full reload and the tab resets to Overview. | S11-005–008 | Admin | OBSERVED |

**FT-M17-8.2 — Overview**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M17-8.2.1 | Overview cards "Murid Pernah Login" {%} "{n}" "/ {pupils}" "`fa-exclamation-circle` {n} belum pernah login"; "Cikgu Pernah Login" {%} "{n}" "/ {teachers}" "{n} belum pernah login"; "Murid Buat Latihan" {%} "{n}" "/ {pupils}". | S11-009–025 | Admin | OBSERVED |
| FN-M17-8.2.2 | Cards "Jumlah Aktiviti" {Σ activities in range} / "{7\|30\|90} hari lepas" (DV-M17-16) and "Skor Purata" {DC-M17-06} with chip "Struktur: {DC-M17-06}". | S11-026–033, S11-170–173 | Admin | OBSERVED + DV-M17-16 + DC-M17-06 |
| FN-M17-8.2.3 | "Trend Aktiviti": Chart.js line (`#trendChart`, label "Aktiviti", border #6366f1, fill rgba(99,102,241,0.1), tension 0.3, point radius 2, no legend, x ticks max 15, y from 0), labels `dd/mm` per day of the range. | S11-034–035 | Admin | OBSERVED |
| FN-M17-8.2.4 | "Pecahan Aktiviti": "Kuiz Objektif" {practice sessions}, "Soalan Berstruktur" {structured attempts}, "Battle Arena" {battles}, "Permainan" {games} in the range (DV-M17-16). | S11-036–045 | Admin | OBSERVED + DV-M17-16 |
| FN-M17-8.2.5 | "`fa-trophy` Pelajar Paling Aktif": 10 rows rank badge · name · activity count (all-time). | S11-046–077 | Admin | OBSERVED |
| FN-M17-8.2.6 | "Cikgu Belum Login": the first 20 teachers (A→Z) of the teacher population who never logged in — name + e-mail line. | S11-078–119 | Admin | OBSERVED |

**FT-M17-8.3 — Sekolah tab**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M17-8.3.1 | Tab Sekolah "Aktiviti Mengikut Sekolah": pills "Semua ({n})", "Aktif ({n})", "Kurang ({n})", "Tidak Aktif ({n})", search "Cari sekolah..." (name); tiles "{n} Aktif (7 hari)", "{n} Kurang Aktif", "{n} Tidak Aktif"; table "#", "Sekolah", "Guru" ("{login}/{jumlah}"), "Murid" ("{login}/{jumlah}"), "Latihan", "Soalan" ("{n} {mcq}M + {str}S" or 0), with the "Murid" totals of 5441, 3390, 853, 3931, 8030 from DC-M17-09 and 2418 computed (DV-M17-31), "Langganan" ("Aktif"/"Tiada"), "Status" ("Aktif"/"Tidak" badge), "Login Terakhir" ("{n} jam/hari/bulan yang lepas", "Belum login"); no empty-state row (as live). | S11-120–136 | Admin | OBSERVED |

**FT-M17-8.4 — Guru tab**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M17-8.4.1 | Tab Guru "Senarai Guru ({n})": pills "Semua", "Pernah Login ({n})", "Belum Login ({n})", search "Cari guru...", school select "Semua Sekolah" + schools of the listed teachers; tiles "Jumlah Guru", "Pernah Login", "Jumlah Soalan", "Jumlah Syiling"; table "#", "Nama" (+ e-mail line), "Sekolah", "Login" ("Ya"/"Belum"), "MCQ", "Struktur", "Syiling", "Headcount" (icon), "Login Terakhir"; no empty-state row. | S11-137–152 | Admin | OBSERVED |

**FT-M17-8.5 — Murid tab**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M17-8.5.1 | Tab Murid "Senarai Murid ({n}) — Top 200": pills "Semua", "Aktif", "Login Sahaja", "Belum Login" (each lists up to 200 matching pupils, DV-M17-18), search "Cari murid...", school select; tiles "Jumlah Murid", "Pernah Latihan", "Jumlah Sesi", "Purata Ketepatan"; table "#", "Nama", "Sekolah", "Kelas", "Sesi", "Ketepatan" (≤ 100 %, DV-M17-19), "Masa" ("{h}j {m}m"), "Syiling" (DC-M17-08, observed values), "Login Terakhir". | S11-153–169 | Admin | OBSERVED + DV-M17-18/19 |

**FT-M17-8.6 — Layout**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M17-8.6.1 | S11 layout: overview cards `grid-cols-2 lg:grid-cols-5` fit at 375 (DV-M17-04); lists `md:grid-cols-3`; tables scroll inside their card. | — | Admin | OBSERVED + DV-M17-04 |

### EP-M17-9 — Cross-cutting rules

**FT-M17-9.1 — Time, data, text size and responsiveness**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M17-9.1.1 | All displayed times, days, weeks, months and hour buckets are Asia/Kuala_Lumpur (MYT), matching the "MYT" label (DV-M17-06); relative times ("{n} minit/jam/hari/minggu/bulan yang lepas") are computed from the mock clock. | — | All | DV-M17-06 |
| FN-M17-9.1.2 | Every count is a named query of the owners' datasets (§ SRS 6.4) or one of the documented display constants DC-M17-01…07; M17 stores only the executive-report cache (DATA-M17-01) and constants. | — | All | D11/D12 |
| FN-M17-9.1.3 | Content text below 12px on M17 screens is raised to 12px (icons, layout, colours unchanged) (DV-M17-25). | — | All | DV-M17-25 |
| FN-M17-9.1.4 | No M17 screen scrolls sideways at 375 / 768 / 1280; wide tables scroll inside their cards (NFR-RESP-05 b), no sticky column. | — | All | NFR-RESP |

### EP-M17-10 — Admin Sekolah alias (school scope) — v1.11

Source: audited addendum `docs/discovery/L06-command-center-sekolah.md` §5. The Admin Sekolah sees the live S2 board (same layout and components; live copy plus the server-defined school-admin copy) at `/admin-sekolah/command-center`, every figure scoped to the viewer's own school, with the cross-school cards hidden. **Decision D24 (user, 2026-10-02): where live cannot be observed, the server code/data (`/var/www/prestasiplus_cloud`, local copy `D:\Dev Projects\prestasiplus-reference\`) is authoritative — tag SERVER; no school-admin account is needed.** Live wins where observed (the server's national page is a simplified adaptation of live). Items neither live nor the server define stay INFERRED / PROPOSED. **G1 approved by the user 2026-10-02 (D24).** Requirements: SRS §3.2 (FR-M17-101…118). FN ids assigned at this merge; EL "—" (no inventory element: no school-admin rendering exists on live to capture).

**FT-M17-10.1 — Entry, access and header links**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M17-10.1.1 | Route `/admin-sekolah/command-center` renders S2 for a signed-in school admin; the school-admin sidebar shows "Command Center" with the "LIVE" badge first, opening the route in a new tab (shell renders the entry, M17 registers the route). | — | Admin Sekolah | OBSERVED (route, label, badge, position) / INFERRED (href, new tab) |
| FN-M17-10.1.2 | Refusals: platform admin, teacher, pupil, parent, PPD, JPN → global 403 "Akses Ditolak" on route and poll; guest → `/login` (API 401); a school admin without a school → 403, never platform figures. | — | All other roles | OBSERVED (platform admin 403) / SERVER (no school → 403, PPD 403, other roles refused; `CommandCenterController.php:41-49`, `web.php:533`) / INFERRED (refusal page for teacher, pupil, parent) |
| FN-M17-10.1.3 | S2 header links for a school admin: "← Dashboard" → `/admin-sekolah` (OQ-M17-15) and "📊 Aktiviti Harian" → the S3 alias (FN-10.3.2). | — | Admin Sekolah | OBSERVED (links for admin) / INFERRED (targets; the server lands staff on `/admin`, live wins) |

**FT-M17-10.2 — School-scoped board**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M17-10.2.1 | School derived server-side from the session; no school id from URL, query or body honoured; page, poll and drills show only the school's own name, pupils and teachers. | — | Admin Sekolah | SERVER (`PlatformMetrics.php:26-57`, controller 91-102) |
| FN-M17-10.2.2 | S2 header, footer, counters, panel order, labels and copy as live, plus the server-defined school-admin copy: sub-line "Pemantauan langsung sekolah anda", "Ketepatan Purata" sub-line "sekolah anda", never "keseluruhan platform"; queries restricted to one school; "Sekolah Berdaftar" = 1 when the school is subscribed, else 0. | — | Admin Sekolah | SERVER (copy, `command-center.blade.php:12, 50`; test 110-119) / INFERRED ("Sekolah Berdaftar" per live; the server shows 1) |
| FN-M17-10.2.3 | Panel "Top Sekolah" not rendered; no other school's name appears; remaining panels reflow without a hole. | — | Admin Sekolah | SERVER (hidden, controller 58-63, view 54-59) / PROPOSED (reflow at 375 / 768 / 1280) |
| FN-M17-10.2.4 | Panels computed for the school with S2 rules and live panel layout: "Aktiviti Hari Ini", "Live Feed", "Top Pelajar Minggu Ini", "Mood Pelajar" (SERVER scope), "Kirkpatrick", "ALESA AI" (XR-M17-21; "Sekolah anda" instead of "Platform" in the sentence), no cross-school pupil in feed or top pupils; "Engagement" = the school's own answers per day for 7 days (OQ-M17-12); "Pembetulan" zeros (the server's "Laporan Baru / Selesai" panel differs from live, live wins); platform display constants never shown. | — | Admin Sekolah | SERVER (scope, feed, top pupils, mood, 7-day trend, `PlatformMetrics.php:105-226`) / INFERRED (Pembetulan, Kirkpatrick, ALESA AI) / PROPOSED (sentence wording) |
| FN-M17-10.2.5 | 10 s poll of `live-data` (800 ms counter animation, 1 s clock, failed poll keeps values) with the forced school scope. | — | Admin Sekolah | OBSERVED (admin) / SERVER (same scope as page, silent failure; controller 91-102, view 204-214) |
| FN-M17-10.2.6 | Responsive (no clipping, no horizontal page scroll at 375 / 768 / 1280, text ≥ 12 px) and fictitious names only in seeds and docs (no server names, passwords or personal data). | — | Admin Sekolah | PROJECT RULE (CLAUDE.md §6, §7) |

**FT-M17-10.3 — Drill-downs and daily activity**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M17-10.3.1 | S4–S7 under `/admin-sekolah/command-center/school/{schoolId}[/teacher/{userId}]`, `…/classroom/{classroomId}`, `…/student/{userId}`, reachable from the board, only for objects of the viewer's school; an object outside the school and an unknown or non-numeric id both → the M01 global 404 page (API 404), so existence is not revealed (OQ-M17-13); links stay inside the alias prefix. | — | Admin Sekolah | INFERRED (scope, as BR-M17-30) / PROPOSED (paths) |
| FN-M17-10.3.2 | S3 at `/admin-sekolah/command-center/daily-activity` (OQ-M17-14), tabs "Hari Ini / Minggu Ini / Bulan Ini", cards for the school; the "Sekolah" list and its drill hidden; "Sekolah Aktif" "{0\|1} daripada 1"; page title "Aktiviti Sekolah" (header and tab "AKTIVITI SEKOLAH — PRESTASIPLUS"); the school's logins shown (the server's "Login" placeholder is not adopted, live tracks logins); `daily-activity/school/{id}` → 403 for school admin. | — | Admin Sekolah | SERVER (scope, hidden card, title, "daripada 1"; `CommandCenterController.php:104-219`, `command-center-daily.blade.php:9, 36, 92-111`) / PROPOSED (URL) / INFERRED (header composition, 403 of the school-drill endpoint) |

---

## 4. User stories

Values in the ACs are the seed at the single project clock **2026-09-25T15:40:00+08:00** (SRS §6.6–§6.7): observed values where the dataset reproduces them at that clock, and the computed value where the 26 Sep 12:33 reading includes rows observed after the clock or where a decision of SRS §6.5 says so (marked "computed; live …"). "The admin" = `admin@demo.test` (id 1), signed in through the test fixture (no UI login, so its `lastLoginAt` stays the seeded 2026-09-25 12:09:43, SRS §6.6). "School 8082" = SMK ENGKU HUSAIN, "8080" = SMK KHIR JOHARI, "8880" = SMK TINGGI KLUANG (observed public anchors). "Pupil 2022" = the observed S7 pupil (live id 2022, fictitious name "Murid Demo 2022"). E2E run at 375×812, 768×1024 and 1280×800.

| ID | Feature | MoSCoW | Story | Functions |
|---|---|---|---|---|
| US-M17-01 | FT-M17-1.1 | Must | As an admin, I want the M17 screens in my sidebar and mobile menu with the right titles, so that I can reach them and know where I am. | FN-M17-1.1.1–1.1.6 |
| US-M17-02 | FT-M17-1.2 | Must | As the owner, I want M17 closed to guests and other roles and wrong ids or bad input to end on the standard pages, so that the area is safe and predictable. | FN-M17-1.2.1–1.2.5, 1.2.7 |
| US-M17-03 | FT-M17-1.2 | Must | As an admin, I want `/admin/monitoring` and its drill-downs and exports to work from my menu, so that I can use the monitoring tool in the admin area. | FN-M17-1.2.6 |
| US-M17-04 | FT-M17-2.1 | Must | As an admin, I want headline question, curriculum and user counts on my dashboard, so that I see the size of the platform at a glance. | FN-M17-2.1.1–2.1.5 |
| US-M17-05 | FT-M17-2.2 | Should | As an admin, I want the battle and sponsor status on my dashboard, so that I notice activity and pending approvals. | FN-M17-2.2.1, 2.2.2 |
| US-M17-06 | FT-M17-2.3 | Must | As an admin, I want quick actions, the latest questions and the question status distribution, so that I can act on the bank quickly. | FN-M17-2.3.1–2.3.3 |
| US-M17-07 | FT-M17-2.4 | Should | As an admin, I want quick links and CSV downloads of users, questions, payments and schools, so that I can work with the data elsewhere. | FN-M17-2.4.1, 2.4.2 |
| US-M17-08 | FT-M17-3.1 | Must | As an admin, I want the Command Center to update itself every 10 seconds with a live clock, so that I can leave it on a screen. | FN-M17-3.1.1–3.1.3 |
| US-M17-09 | FT-M17-3.2 | Must | As an admin, I want the subscribed schools, registered and engaged pupils, answers and accuracy as big counters, so that I see platform health. | FN-M17-3.2.1–3.2.4 |
| US-M17-10 | FT-M17-3.3 | Must | As an admin, I want the top schools, the week's top pupils and a live answer feed with links into the drill-down, so that I can follow activity. | FN-M17-3.3.1, 3.3.5, 3.3.6 |
| US-M17-11 | FT-M17-3.3 | Should | As an admin, I want the Kirkpatrick levels and an automatic insight sentence, so that I read impact at a glance. | FN-M17-3.3.2, 3.3.3 |
| US-M17-12 | FT-M17-3.3 | Should | As an admin, I want today's activity against the week, pupil mood, corrections and engagement groups, so that I see trends and wellbeing. | FN-M17-3.3.4, 3.3.7–3.3.9 |
| US-M17-13 | FT-M17-3.4 | Must | As an admin on a phone or tablet, I want the Command Center to fit my screen, so that no panel is cut off. | FN-M17-3.4.1 |
| US-M17-14 | FT-M17-4.1 | Must | As an admin, I want the daily-activity board with Today / This week / This month tabs that refreshes itself, so that I can compare periods. | FN-M17-4.1.1–4.1.3 |
| US-M17-15 | FT-M17-4.2 | Must | As an admin, I want six pulse cards per period (schools, logins, pupils, answers, sessions, engagement), so that I see the period in numbers. | FN-M17-4.2.1–4.2.6 |
| US-M17-16 | FT-M17-4.3 | Must | As an admin, I want the active schools of the period and a drill into their teachers, pupils and logins, so that I find who is active. | FN-M17-4.3.1–4.3.5 |
| US-M17-17 | FT-M17-4.4 | Should | As an admin, I want subject, hour, feed, login, top pupil, mood and badge panels for the period, so that I understand the activity pattern. | FN-M17-4.4.1–4.4.7 |
| US-M17-18 | FT-M17-5.1 | Must | As an admin, I want a school page with pupil, activity and accuracy cards and its teachers, so that I can drill into a school. | FN-M17-5.1.1–5.1.3 |
| US-M17-19 | FT-M17-5.2 | Must | As an admin, I want a teacher page with the teacher's classes and their activity, so that I can compare classes. | FN-M17-5.2.1, 5.2.2 |
| US-M17-20 | FT-M17-5.3 | Must | As an admin, I want a class page with every pupil's answers, accuracy, last activity and status, so that I find inactive pupils. | FN-M17-5.3.1, 5.3.2 |
| US-M17-21 | FT-M17-5.4 | Must | As an admin, I want a pupil page with totals, subject split, weekly activity, mood, headcount and an insight, so that I understand one pupil. | FN-M17-5.4.1–5.4.7 |
| US-M17-22 | FT-M17-5.4 | Must | As an admin, I want to open a week, all sessions, a subject, a session's questions, a headcount or a mood day in a modal, so that I see the details behind a figure. | FN-M17-5.4.8–5.4.11 |
| US-M17-23 | FT-M17-5.5 / 5.6 | Should | As a teacher (through M10) and as an admin on any device, I want the drill-down pages scoped to me and readable on a phone, so that the same pages serve both. | FN-M17-5.5.1, 5.6.1 |
| US-M17-24 | FT-M17-6.1 | Must | As an admin, I want the executive report of a year with a refresh and year navigation, so that I can present the platform's year. | FN-M17-6.1.1–6.1.4 |
| US-M17-25 | FT-M17-6.2 | Must | As an admin, I want the year's KPIs (schools, pupils, engagement, answers, accuracy, teachers, depth, most active school and month), so that I summarise the year. | FN-M17-6.2.1–6.2.3 |
| US-M17-26 | FT-M17-6.3 | Must | As an admin, I want the monthly trend, school comparison, badges, top five schools and subject performance, so that I can compare schools and subjects. | FN-M17-6.3.1–6.3.5 |
| US-M17-27 | FT-M17-6.3 | Should | As an admin, I want headcount progress, Kirkpatrick, SPM GPS and tuition-centre figures, the generation time and other years, so that the report is complete. | FN-M17-6.3.6–6.3.11 |
| US-M17-28 | FT-M17-6.4 / 6.5 | Must | As an admin, I want a focus page per school from the report, readable on a phone, so that I can discuss one school. | FN-M17-6.4.1–6.4.6, 6.5.1 |
| US-M17-29 | FT-M17-7.1 | Should | As an admin, I want import, status and content counts, so that I track the content pipeline. | FN-M17-7.1.1–7.1.3 |
| US-M17-30 | FT-M17-7.2 | Must | As an admin, I want question coverage by subject, level, difficulty and curriculum, so that I find gaps in the bank. | FN-M17-7.2.1–7.2.4 |
| US-M17-31 | FT-M17-8.1 / 8.2 | Must | As an admin, I want the statistics report with login, practice and activity figures over 7/30/90 days, so that I measure usage. | FN-M17-8.1.1, 8.1.2, 8.2.1–8.2.6 |
| US-M17-32 | FT-M17-8.3 | Should | As an admin, I want every school's teachers, pupils, practice and status with filters and search, so that I find inactive schools. | FN-M17-8.3.1 |
| US-M17-33 | FT-M17-8.4 | Should | As an admin, I want the teacher list with login status, contributions and coins, so that I follow up teachers. | FN-M17-8.4.1 |
| US-M17-34 | FT-M17-8.5 / 8.6 | Should | As an admin, I want the most active pupils with filters that each show their pupils, on any device, so that I can find pupils by status. | FN-M17-8.5.1, 8.6.1 |
| US-M17-35 | FT-M17-9.1 | Must | As an admin, I want every figure to agree with the rest of the platform, in Malaysian time and readable text, on any device, so that I can trust the numbers. | FN-M17-9.1.1–9.1.4 |
| US-M17-36 | FT-M17-10.1 | Must | As a school admin, I want to open the Command Center from my sidebar, so that I can watch my school's learning activity live. | FN-M17-10.1.1, 10.2.6 |
| US-M17-37 | FT-M17-10.2 | Must | As a school admin, I want every figure on the Command Center to be about my school only, so that I never read another school's data. | FN-M17-10.2.1–10.2.4, 10.2.6 |
| US-M17-38 | FT-M17-10.2 | Must | As a school admin, I want the counters and the live feed refreshed every 10 seconds, so that the board stays live. | FN-M17-10.2.5 |
| US-M17-39 | FT-M17-10.2 | Should | As a school admin, I want the same panels as the platform board (activity, feed, top pupils, mood, engagement, Kirkpatrick, insight) for my school, so that I see how pupils are engaging. | FN-M17-10.2.4, 10.2.6 |
| US-M17-40 | FT-M17-10.1 | Must | As a school admin, I want a clear refusal if my account has no school or is the wrong role, so that no national figure is ever shown by mistake. | FN-M17-10.1.2 |
| US-M17-41 | FT-M17-10.1 / 10.3 | Should | As a school admin, I want to open the school, teacher, class and pupil drill-downs of my own school from the board, so that I can look into a figure. | FN-M17-10.1.3, 10.3.1 |
| US-M17-42 | FT-M17-10.3 | Should | As a school admin, I want the daily-activity board (today / week / month) scoped to my school, so that I can see the period summary. | FN-M17-10.3.2 |

**Admin Sekolah alias (US-M17-36…42, v1.11).** Fixture (PROPOSED, fictitious): "SMK Contoh A" (subscribed; 3 answers by "Pelajar Contoh A1") and "SMK Contoh B" (5 answers by "Pelajar Contoh B1"); "Admin Sekolah A" = the school admin of A, signed in through the test fixture. Evidence per D24: SERVER where the server defines the behaviour (G1 approved 2026-10-02); the ACs resting on INFERRED / PROPOSED items (AC-36.1 new tab, 37.5, 39.3 "Pembetulan", 40.5, 41.x, 42.x) are `@provisional` in the SRS E2E (E2E-M17-100, 107, 113, 119, 121…128).

### Acceptance criteria

**US-M17-01 — Menu, titles, active item**
- **AC-M17-01.1** Given the admin at 1280px on any SHA page, when the sidebar renders, then it shows the pinned "Command Center LIVE" card (`fa-satellite-dish`, red "LIVE" pill) → `/admin/command-center`, pinned "Aktiviti Harian" → `/admin/command-center/daily-activity`, group "HARIAN" with "Dashboard" → `/admin` and "Laporan Eksekutif" → `/admin/laporan-eksekutif`, and group "ANALITIK" with "Analitik" → `/admin/analytics`, "Monitoring" → `/admin/monitoring` and "Laporan" → `/admin/laporan`.
- **AC-M17-01.2** Given the admin at 375px on S1, when I open "Lagi", then the drawer holds "Analitik" → `/admin/analytics`, "Laporan Aktiviti" → `/admin/laporan` and "Monitoring" → `/admin/monitoring`, and the bottom bar's "Dashboard" → `/admin`; "Command Center" and "Aktiviti Harian" are not in the drawer (as live).
- **AC-M17-01.3** Given each M17 screen, when it loads, then the tab title and header are those of URS §1 (e.g. S10 "Analitik & Statistik - Admin Panel" with header "Analitik & Statistik" / "Analisis mendalam data platform"; S8 for 2026 "Laporan Eksekutif 2026" with "Laporan Eksekutif Platform" / "Selamat datang, Admin"; S4 of 8082 "SEKOLAH MENENGAH KEBANGSAAN ENGKU HUSAIN - Command Center").
- **AC-M17-01.4** Given the admin at 1280px on S1, S8, S9, S10 and S11, when each loads, then the sidebar item "Dashboard", "Laporan Eksekutif", "Laporan Eksekutif", "Analitik" and "Laporan" respectively is shown active; S2–S7 render without the admin shell.

**US-M17-02 — Access and errors**
- **AC-M17-02.1** Given no session, when I open any M17 route, then I am sent to `/login` (INFERRED).
- **AC-M17-02.2** Given the teacher `guru@demo.test`, when I open `/admin/command-center` or `/admin/laporan`, then I land on my M01 landing page `/dashboard` and `/api/admin/*` answers 403 (INFERRED; provisional).
- **AC-M17-02.3** Given the admin, when I open `/admin/command-center/school/99999999`, `/admin/command-center/school/8080/teacher/99999999`, `/admin/command-center/classroom/99999999`, `/admin/command-center/student/99999999`, `/admin/laporan-eksekutif/sekolah/99999999` or `/admin/command-center/student/abc`, then the global 404 page shows "404", "🔍", "Halaman Tidak Dijumpai", "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?", "Halaman Utama" → `/`, "Mula Latihan" and "PRESTASIPLUS".
- **AC-M17-02.4** Given the admin, when I open `/admin/dashboard`, `/admin/statistics`, `/admin/reports`, `/admin/command-center/school` or `/admin/laporan-eksekutif/sekolah`, then the global 404 page shows.
- **AC-M17-02.5** Given the admin, when I open `/admin/laporan-eksekutif?year=abc`, then no error page appears and the 2026 report renders with the heading "Ringkasan Eksekutif 2026" (DV-M17-05; live showed HTTP 500 "Ralat Pelayan").

**US-M17-03 — Monitoring mount**
- **AC-M17-03.1** Given the admin, when I click "Monitoring" in the sidebar, then `/admin/monitoring` renders the M11 monitoring component (tab "Monitoring Penglibatan Sekolah - Admin", header "Monitoring Penglibatan" / "Pantau penglibatan sekolah & pelajar T4/T5 dalam platform") with "Monitoring" active.
- **AC-M17-03.2** Given the admin, when `/admin/monitoring`, `/admin/monitoring/sekolah/8080`, `/admin/monitoring/sekolah/8080/pelajar/2008` and `/admin/monitoring/sekolah/8080/guru/2012` (Teacher T) load, then they show the M11 values at the project clock (e.g. "Pelajar T4/T5" 4,158, "Pernah Aktif" 1,462, "Soalan Dijawab" 472,371) and the export links `/admin/monitoring/export/pdf` and `/admin/monitoring/export/csv` respond as M11 specifies.
- **AC-M17-03.3** Given the admin, when `/admin/monitoring` loads with "Tempoh" = 7 Hari, then it shows M11's 7-day values at the project clock (44 · 7,651); M17 adds no clock of its own (the 12:33 readings 472,516 / 41 / 5,913 are the observed record only, SRS §6.6).

**US-M17-04 — Dashboard counts**
- **AC-M17-04.1** Given S1, when it loads, then the cards read "Soalan Aktif" "130,152" / "Minggu ini: 0"; "Diluluskan" "150,683" / "Aktif digunakan: 129,752"; "Menunggu Review" "0" / "Perlu tindakan"; "Draf" "0" / "Belum siap"; "Subjek" "31" / "31 Aktif"; "Tahap Pendidikan" "11" / "Darjah & Tingkatan"; "Pengguna" "5,159" / "4533 Pelajar".
- **AC-M17-04.2** Given the admin creates one approved, active question through M04 (runtime id ≥ 9,000,001), when S1 reloads, then "Soalan Aktif" is 130,153, "Minggu ini: 1" and "Aktif digunakan: 129,753", while "Diluluskan" stays "150,683" (DC-M17-01).
- **AC-M17-04.3** Given the admin creates a pupil account through M02, when S1 reloads, then "Pengguna" is 5,160 and "4534 Pelajar".

**US-M17-05 — Battle and sponsors**
- **AC-M17-05.1** Given S1, when it loads, then "Battle Arena" / "PvP Quiz Battles" shows "168 Total", "0 Aktif", "66 Selesai", and the icons link to `/battle/ranking-sekolah` and `/battle/leaderboard` (values provisional until XR-M17-15).
- **AC-M17-05.2** Given S1, when it loads, then "Jumlah Penaja" "6" / "0 Aktif", "Menunggu Kelulusan" "0" / "Tiada yang menunggu", "Ditolak" "0" / "Permohonan ditolak", "Digantung" "6" / "Akaun digantung" (provisional until XR-M17-16).

**US-M17-06 — Quick actions, latest questions, distribution**
- **AC-M17-06.1** Given S1, when it loads, then three tiles "Tindakan Pantas" link "Tambah Soalan Baru" → `/admin/questions/create`, "Tambah Subjek Baru" → `/admin/subjects/create`, "Import CSV Soalan" → `/admin/questions/import`.
- **AC-M17-06.2** Given S1, when "Soalan Terkini" loads, then it shows "10 soalan terbaru", "Lihat Semua" → `/admin/questions` and 10 rows; the first row reads "Topup Sains T5 Bab 9 item 1: Apakah maksud satelit buatan? P..." with "Mcq", "Kesukaran: 3/5", "Sains", "Tingkatan 5", "Diluluskan", "18/05/2026".
- **AC-M17-06.3** Given S1, when "Taburan Status Soalan" loads, then it reads "Draf" 0, "Menunggu" 0, "Diluluskan" 150,683, "Ditolak" 0, "Diarkib" 323,184.

**US-M17-07 — Quick links and exports**
- **AC-M17-07.1** Given S1, when it loads, then "Pautan Pantas" links "Kurikulum" → `/admin/curriculum`, "Analitik" → `/admin/analytics`, "Banner" → `/admin/banners`, "Artikel" → `/admin/articles`.
- **AC-M17-07.2** Given S1, when I click "Pengguna", "Soalan", "Pembayaran" or "Sekolah" under "Muat Turun Data (CSV)", then a CSV file downloads with the PROPOSED columns of SRS §7 #2 and fictitious data only (provisional; OQ-M17-04).

**US-M17-08 — Command Center frame**
- **AC-M17-08.1** Given S2, when it loads, then the header shows "PRESTASIPLUS COMMAND CENTER" (upper case by CSS), "← Dashboard" → `/admin`, "📊 Aktiviti Harian" → S3, the "LIVE" pill and the clock "15:40:00" with "MYT", and the clock reads "15:40:05" five seconds later.
- **AC-M17-08.2** Given S2 before the first data response, when the page renders, then it shows "--:--:--", "--", "0 soalan", "Memuatkan wawasan..." and "Memuatkan..."; after the response every panel is filled.
- **AC-M17-08.3** Given S2 open, when 10 seconds pass and a new answer has been added (`mock.addAnswer`), then the next poll shows "Soalan Dijawab" 477,744 and the new answer first in "Live Feed"; when a poll fails, the previous values stay.
- **AC-M17-08.4** Given S2, when it loads, then the footer reads "Powered by ALESA AI · PrestasiPlus © 2026 · Dijana automatik · Data dikemaskini setiap 10 saat".

**US-M17-09 — Headline counters**
- **AC-M17-09.1** Given S2, when it loads, then "Sekolah Berdaftar" "9" / "langganan aktif" and "Pelajar Berdaftar" "3,152" / "1,563 aktif menjawab".
- **AC-M17-09.2** Given S2, when it loads, then "Soalan Dijawab" "477,743" / "sepanjang masa" (computed at the project clock; live 477,888 at 12:33 on 26 Sep, SRS §6.6) and "Ketepatan Purata" "82.9%" / "keseluruhan platform" (the accuracy needs the owner fix XR-M17-03).
- **AC-M17-09.3** Given M02 cancels the subscription of school 10220, when S2 polls, then "Sekolah Berdaftar" is 8.

**US-M17-10 — Top schools, top pupils, live feed**
- **AC-M17-10.1** Given S2, when "🏆 Top Sekolah" loads, then it lists 1 "SEKOLAH MENENGAH KEBANGSAAN ENGKU HUSAIN" "393 plj" (v1.12, DV-M17-33; live 392) → `/admin/command-center/school/8082`, 2 "…BANDAR BARU BANGI" "345 plj" (8078; v1.12 DV-M17-33, live 341), 3 "…BANDAR RINCHING" "306 plj" (8106; live 307), 4 "…KHIR JOHARI" "174 plj" (8080; DV-M17-30, live 175), 5 "…PANDAN INDAH" "134 plj" (8090).
- **AC-M17-10.2** Given S2, when "⭐ Top Pelajar Minggu Ini" loads, then it lists 🥇 "452 jwb · 99.6%", 🥈 "330 jwb · 99.7%", 🥉 "234 jwb · 62.0%", "⚬" "200 jwb · 93.5%", "⚬" "160 jwb · 73.8%", each name linking to `/admin/command-center/student/{id}` (the first is pupil 2022; the second is computed at the project clock, live 405 · 99.0% at 12:33).
- **AC-M17-10.3** Given S2, when "⚡ Live Feed" loads, then it shows the 10 latest pupil answers before the clock, newest first, each with the MYT time, the pupil name, the subject short name, the school name cut to 15 characters linking to S4 with the full name in `title`, and "✓" or "✗"; they are the last 10 answers of the 8082 session that ends at 14:59 (§6.7 B, PROPOSED placement).
- **AC-M17-10.4** Given no pupil answer exists (`mock.reset({answers: []})`), when S2 loads, then "Top Sekolah" and "Top Pelajar Minggu Ini" show "Tiada data" and "Live Feed" shows "Tiada aktiviti terkini" (provisional).

**US-M17-11 — Kirkpatrick and insight**
- **AC-M17-11.1** Given S2, when "🔬 Kirkpatrick" loads, then it reads "T1" "★★★★★ 4.6/5" (DV-M17-08), "T2" "82.9% ketepatan", "T3" "91 aktif 30h", "T4" "GPS 2.880", with bars 92 %, 82.9 %, 18.2 % and 57.6 %.
- **AC-M17-11.2** Given S2, when "🤖 ALESA AI" loads, then it reads "Platform menunjukkan **penurunan** 67% minggu ini. 3.6% pelajar terlibat aktif. Ketepatan purata 82.9% dengan 9 sekolah aktif. GPS keseluruhan: 2.88." (DV-M17-09; 67 % computed at the project clock, live 65 % at 12:33).
- **AC-M17-11.3** Given this week's answers exceed last week's (`mock.setNow` to a clock where they do), when S2 loads, then the sentence says "peningkatan" and "Aktiviti Hari Ini" shows "▲ +{n}% vs minggu lepas" (emerald); with equal weeks "stabil" and "Sama dengan minggu lepas" (SOURCE-DERIVED; provisional).

**US-M17-12 — Today, mood, corrections, engagement**
- **AC-M17-12.1** Given S2, when "📈 Aktiviti Hari Ini" loads, then it reads "340 soalan", "Minggu ini: 2,508" and "▼ -67% vs minggu lepas" (rose) (computed at the project clock; live 60 / 2,653 / -65% at 12:33 on 26 Sep).
- **AC-M17-12.2** Given S2 and the mood owner's store (XR-M17-18), when "💚 Mood Pelajar" loads, then it reads 😊 "Gembira" 307, 😐 "OK" 280, 😢 "Sedih" 72, 😩 "Tekanan" 91 (provisional until OQ-M17-01).
- **AC-M17-12.3** Given S2, when "🔄 Pembetulan" loads, then it reads "899" "Rekod", "+0.0%" "Purata Naik", "0%" "Kadar Baik" and no "Top Improvers" list (DC-M17-03; own deviation id DV-M17-40, v1.13).
- **AC-M17-12.4** Given S2, when "📊 Engagement" loads, then the bars read "Champion" 29, "Konsisten" 11, "Berkembang" 43, "Minimum" 3, "Disengaged" 2,229, the Disengaged bar full width (DC-M17-05).

**US-M17-13 — Command Center on small screens**
- **AC-M17-13.1** Given S2 at 375px, when it loads, then the page has no horizontal scroll, the header clock and "LIVE" pill are visible, and the four counters and all eleven panels are reachable by vertical scrolling (one column) (DV-M17-01).
- **AC-M17-13.2** Given S2 at 768px, when it loads, then the panels flow in two columns without clipping; at 1280px the three-column board fills the viewport and long panels scroll inside themselves (as live).

**US-M17-14 — Daily-activity board**
- **AC-M17-14.1** Given S3, when it loads, then the header shows "⚡ AKTIVITI PLATFORM", "◀ Command Center" → S2, "Laporan Eksekutif" → S8, the ticking clock and "MYT", and "📅 Hari Ini" is the active tab.
- **AC-M17-14.2** Given S3 opened as `/admin/command-center/daily-activity?period=week`, when it loads, then "📅 Hari Ini" is still active (as live).
- **AC-M17-14.3** Given S3 on "📆 Minggu Ini" with a school drill open, when 30 seconds pass, then the week figures reload and the drill closes only when I change tab (the timer keeps the current period).
- **AC-M17-14.4** Given the daily-activity endpoint fails (`mock.failNext`), when S3 loads, then the lists show "Gagal memuatkan"; a failed drill shows "Gagal" (SOURCE-DERIVED; provisional).

**US-M17-15 — Pulse cards**
- **AC-M17-15.1** Given S3 on "Hari Ini" (25 Sep until 15:40), when it loads, then the cards read "Sekolah Aktif" "3" "daripada 57"; "Login Hari Ini" "13" "student: 9 · teacher: 1 · admin: 1 · school_admin: 2"; "Pelajar Aktif" "4" "daripada 3,152"; "Soalan Dijawab" "340" "Ketepatan: 77.6%"; "Sesi Latihan" "17/17" "Purata: 2m 48s"; "Engagement" "0" "Mood:0 Badge:0 Misi:0" (computed at the clock; SRS §6.6–§6.7 B).
- **AC-M17-15.2** Given "📆 Minggu Ini", when it loads, then "7" "daripada 57"; "Login Minggu Ini" "31" "student: 25 · teacher: 3 · admin: 1 · school_admin: 2"; "32" "daripada 3,152"; "2,508" "Ketepatan: 84.6%"; "152/152" "Purata: 2m 48s"; "3" "Mood:0 Badge:0 Misi:3".
- **AC-M17-15.3** Given "🗓️ Bulan Ini", when it loads, then "7" "daripada 57"; "Login Bulan Ini" "95" "student: 84 · teacher: 4 · parent: 1 · admin: 1 · school_admin: 5"; "86" "daripada 3,152"; "20,206" "Ketepatan: 87.4%"; "1,250/1,250" "Purata: 1m 54s"; "8" "Mood:0 Badge:0 Misi:8".

**US-M17-16 — School list and drill**
- **AC-M17-16.1** Given "Hari Ini", when "Sekolah" loads, then it lists "1. SEKOLAH MENENGAH KEBANGSAAN BANDAR RINCHING" "2 GURU" "2 PELAJAR" "160 SOALAN" "78.8%", "2. SEKOLAH MENENGAH KEBANGSAAN ENGKU HUSAIN" "1 GURU" "1 PELAJAR" "160 SOALAN" "73.8%", "3. SEKOLAH MENENGAH KEBANGSAAN KHIR JOHARI" "1 GURU" "1 PELAJAR" "20 SOALAN" "100.0%", then the login-only rows "4. SEKOLAH MENENGAH KEBANGSAAN BANDAR BARU BANGI" "4 LOGIN", "5. SEKOLAH MENENGAH KEBANGSAAN PANDAN INDAH" "2 LOGIN", "6. SMK Leqoe" "1 LOGIN", each "0 PELAJAR" "0 SOALAN" "-%" at 50 % opacity (computed; PROPOSED placement of 25 Sep, SRS §6.7 B).
- **AC-M17-16.2** Given "Bulan Ini", when "Sekolah" loads, then it lists 10 rows in this order: BANDAR RINCHING 18 GURU 23 PELAJAR 5,419 SOALAN 82.9%; ENGKU HUSAIN 61 / 22 / 8,298 / 90.9%; KHIR JOHARI 8 / 16 / 3,822 / 88.6%; BANDAR BARU BANGI 37 / 15 / 1,426 / 86.5%; PANDAN INDAH 23 / 5 / 837 / 84.6%; JALAN TIGA 0 / 1 / 20 / 75.0%; SAM MUHAMMADIAH 1 / 1 / 5 / 60.0% (v1.13: month GURU 1 = live; DV-M17-29 superseded by DV-M17-41, which covers the week row 1 vs live 0); then the login-only rows SEKOLAH KEBANGSAAN JELI (1), KOLEJ ISLAM SULTAN ALAM SHAH and SMK Leqoe with "1 LOGIN" "0 PELAJAR" "0 SOALAN" "-%".
- **AC-M17-16.3** Given "Bulan Ini", when I click the BANDAR RINCHING row, then the drill shows "👨‍🏫 Guru Aktif (18)", "🎓 Pelajar (23)" (first row "1,701 soalan" "90.2%"), "👤 Login (20)" and "Lihat penuh →" → `/admin/command-center/school/8106`; clicking the row again closes it.
- **AC-M17-16.4** Given a drill for a school with no detail rows, when it opens, then it shows "Tiada data terperinci"; a period without any school activity shows "😴 Tiada aktiviti" (provisional).

**US-M17-17 — Activity panels**
- **AC-M17-17.1** Given "Hari Ini", when the heatmap loads, then 24 cells render with "9:00 — 20 soalan", "13:00 — 160 soalan", "14:00 — 160 soalan" and every other "{h}:00 — 0 soalan" (MYT, DV-M17-06; PROPOSED hours of the 8106/8082 sessions); on "Minggu Ini" the heatmap card is hidden.
- **AC-M17-17.2** Given "Hari Ini", when "Subjek" and "Live Feed" load, then "Subjek" shows one bar per subject of today's 60 answers with the short names of FN-M17-4.4.1 and "Live Feed" lists today's answers newest first (DV-M17-11; provisional layout).
- **AC-M17-17.3** Given "Hari Ini", when "Login Terkini" loads, then the rows are, in this order, "admin" · "ADMIN" · "1 minit yang lepas" (15:39), "student" · KHIR JOHARI · "SEKOLAH" · "2 minit yang lepas" (15:38), "student" · BANDAR RINCHING · "11 minit yang lepas" (15:29), then the school admin and teacher of PANDAN INDAH, the pupil of SMK Leqoe ("AKTIF"), the school admin and a pupil of BANDAR BARU BANGI, pupils of KHIR JOHARI and ENGKU HUSAIN (the observed order, re-dated to 25 Sep before the clock, SRS §6.6); the list stops at 10 rows.
- **AC-M17-17.4** Given "Bulan Ini", when "Top Pelajar" loads, then the rows are ENGKU HUSAIN "3,637 jwb" "92.6%", ENGKU HUSAIN "2,893 jwb" "99.2%", BANDAR RINCHING "1,701 jwb" "90.2%", KHIR JOHARI "1,618 jwb" "98.1%", BANDAR RINCHING "1,179 jwb" "87.9%", names linking to S7.
- **AC-M17-17.5** Given "Hari Ini", when "Mood Pelajar" and "Badge Terkini" load, then they show "Tiada data" and "Tiada badge baru".

**US-M17-18 — School page**
- **AC-M17-18.1** Given S4 of 8082, when it loads, then "← Kembali ke Overview" → S2, breadcrumb "Command Center" ▸ "SEKOLAH MENENGAH KEBANGSAAN ENGKU HUSAIN", cards "Jumlah Pelajar" 549, "Pelajar Aktif" 393, "Jumlah Jawapan" 130,233 (v1.12, DV-M17-33: M11's observed cells; live S4 392 and 130,077 at 12:33, i.e. 130,002 at the clock), "Ketepatan" 82.3%, and "👤 Senarai Guru (68)" with columns "#", "Nama Guru", "Subjek", "Kelas", "Pelajar", "Aktif (30h)".
- **AC-M17-18.2** Given S4 of 8082, when I click a teacher row, then S5 of that teacher opens.
- **AC-M17-18.3** Given S4 of 8080, when it loads, then 185 · 174 (DV-M17-30; live 175) · 53,494 (v1.12, DV-M17-33; live 53,431) · 81.7% and "Senarai Guru (35)": the 34 teachers of 8080 with 0 classes and the class owner of the 8080 classes (teacher 1919, 7 classes) (DV-M17-22).

**US-M17-19 — Teacher page**
- **AC-M17-19.1** Given S5 of teacher 1919 at 8080, when it loads, then "← Kembali ke Sekolah" → S4 8080, breadcrumb "Command Center" ▸ "SEKOLAH MENENGAH KEBANGSAAN KHIR JOHARI" ▸ {guru}, "Sekolah:" KHIR JOHARI and "📚 Senarai Kelas (7)" whose first rows are "5 SAINS TULEN" "T5" 19 · 2 · 5,041 · 78.4%, "5 KAA" 15 · 1 · 2,188 · 76.3%, "5 PRINSIP AKAUN" 33 · 0 · 3,024 · 71.3%.
- **AC-M17-19.2** Given S5 of teacher 4402 at 8082, when it loads, then "Senarai Kelas (1)" with "5 CYBER" "T5" 44 · 5 · 26,161 · 85.1%.
- **AC-M17-19.3** Given S5 of teacher 4418 at 8082, when it loads, then "Senarai Kelas (0)" with the single row "Tiada kelas aktif" (as live, `cc-teacher-empty.png`).

**US-M17-20 — Class page**
- **AC-M17-20.1** Given S6 of class 370, when it loads, then "← Kembali ke Guru" → S5 of teacher 1919, breadcrumb to the school, teacher and "5 PERNIAGAAN", info "Sekolah:" KHIR JOHARI · "Guru:" · "Tahap:" "T5", and "👤 Senarai Pelajar (30)".
- **AC-M17-20.2** Given S6 of class 370, when the table loads, then row 1 is pupil 2022 with "2,378", "93.5%", "25/09 09:22", "Aktif", "-"; 3 rows are "Aktif" and 27 "Tidak Aktif"; clicking a row opens S7.

**US-M17-21 — Pupil page**
- **AC-M17-21.1** Given S7 of pupil 2022, when it loads, then the breadcrumb reads "Command Center" ▸ KHIR JOHARI ▸ {guru} ▸ "5 PERNIAGAAN" ▸ {pelajar}, "← Kembali ke Kelas" → S6 370, and the cards read "Jumlah Jawapan 🔍" 2,378, "Ketepatan" 93.5%, "Hari Aktif" 15, "Streak" 1, "Konsistensi" 27%.
- **AC-M17-21.2** Given S7 of pupil 2022, when the panels load, then "📊 Pecahan Subjek" shows "Latihan Bebas 🔍" 93.5% "2223/2378"; "📈 Aktiviti Mingguan (8 Minggu)" shows 0 for 03/08, 10/08, 17/08, 24/08, 31/08, 07/09, 1166 for 14/09 and 452 for 21/09; "💚 Trend Mood (30 Hari)" shows "Tiada data mood".
- **AC-M17-21.3** Given S7 of pupil 2022, when "📋 HeadCount" loads, then it has rows "Sains 🔍" "-" "-" "-" "-" "16/06/2026", "Perniagaan 🔍" "40.00" "-" "-" "-" "16/06/2026", "Matematik 🔍" "-" "-" "-" "-" "16/06/2026".
- **AC-M17-21.4** Given S7 of pupil 2022, when "🤖 ALESA AI Insight" loads, then it reads "Analisis ALESA", "Ketepatan cemerlang (93.5%). Konsistensi rendah (27%) - perlu usaha lebih." and "Sumber: Rule-based Analysis".

**US-M17-22 — Pupil modals**
- **AC-M17-22.1** Given S7 of pupil 2022, when I click "Jumlah Jawapan 🔍", then the modal "Semua Sesi Latihan" shows "Memuatkan..." then "2372" "Jawapan", "123" "Sesi", "93.7%" "Ketepatan", "141m" "Jumlah Masa" and the first row "04/05 11:13" "Latihan Bebas" "10 🔍" "8" "80.00%" "0m" (DV-M17-06, DV-M17-21); × or a backdrop click closes it.
- **AC-M17-22.2** Given S7, when I click the 21/09 bar, then the modal "Minggu 21/09 (2026-09-21 ~ 2026-09-27)" shows 452 · 23 · 99.6% · 14m; clicking a 0 bar opens nothing.
- **AC-M17-22.3** Given the all-sessions modal, when I click the first row, then the session modal "Latihan Bebas — Latihan Bebas" shows "04/05/2026 11:13 | Kesukaran: - | Masa: 0m 23s", "10" "Soalan", "8" "Betul", "2" "Salah", "80.00%" "Ketepatan" and 10 question rows; row 1 "✗" with "Jawapan anda: B) objek dan keterangan sahaja" and "Jawapan betul: D) subjek dan predikat sahaja".
- **AC-M17-22.4** Given S7, when I click "Perniagaan 🔍" in HeadCount, then the modal "HeadCount: Perniagaan" shows "30" "Pelajar", "29.7" "Purata TOV", "0" "Purata ETR", "0%" "Kadar Lulus" and 30 rows (row 1 TOV "25.00", ETR/RS/Gred "-").
- **AC-M17-22.5** Given S7, when I click "Latihan Bebas 🔍", then the modal "Latihan Bebas — Semua Sesi" shows the same summary and a "Topik" column, newest first ("25/09 09:21" …).
- **AC-M17-22.6** Given a pupil with a mood check-in on a day without a session (designed seed, XR-M17-18), when I click its dot, then the modal "{emoji} {date} — Mood: {label}" shows "Mood", "Sebab" and "Tiada sesi latihan pada hari ini. Pelajar hanya checkin mood." (SOURCE-DERIVED; provisional). **(v1.12, DV-M17-35)** That "no session" line shows only when the day's week bar is 0; a day with sessions shows no such line.
- **AC-M17-22.7** Given an API failure in a modal (`mock.failNext`), when it loads, then it shows "Ralat memuatkan data" (headcount: "Ralat") (SOURCE-DERIVED; provisional).

**US-M17-23 — Teacher mount and drill-down layout**
- **AC-M17-23.1** Given S4–S7 at 375px, when each loads, then the page does not scroll sideways; the teacher, class and pupil tables scroll inside their cards and the S7 panels stack in one column (DV-M17-02).
- **AC-M17-23.2** Given the teacher `guru@demo.test` (id 5) through M10, when `/guru/command-center/classroom/2001` loads, then it shows class 2001 "5 MARIKH - Kimia" with its 8 pupils; `/guru/command-center/classroom/370` (not the teacher's class) → 404 (INFERRED; provisional, OQ-M17-06). **(v1.12, INFERRED)** On the S4 page of the teacher's school the cards count only the members of the teacher's own active classes at that school (the server has no teacher drill-down); S4 / S5 "Aktif (30h)" is computed from each member's last completed-session time (M05 answer facts carry no timestamp), while S6 "Terakhir Aktif" is exact.

**US-M17-24 — Executive report frame**
- **AC-M17-24.1** Given S8, when it loads, then the hero reads "Ringkasan Eksekutif 2026" / "Laporan prestasi keseluruhan platform PrestasiPlus" with "Refresh" and "← 2025" → `?year=2025`, and no forward link.
- **AC-M17-24.2** Given S8 of 2025, when it loads, then it shows "← 2024" and "2026 →" → `?year=2026` (DV-M17-14).
- **AC-M17-24.3** Given S8, when it loads, then the footer shows the build time of the request minute ("25 Sep 2026, 03:40 PM" at the clock); when I click "Refresh", then a POST with the year is sent and the page reloads, and after the clock advances one minute the footer reads "03:41 PM" (INFERRED effect; provisional).

**US-M17-25 — Executive KPIs**
- **AC-M17-25.1** Given S8 of 2026, when it loads, then "Jumlah Sekolah" 57 / "sekolah aktif", "Pelajar Berdaftar" 3,152 / "1,563 aktif 2026", "Kadar Penglibatan" 49.6% / "daripada pelajar daftar", "Soalan Dijawab" 477,743 / "sepanjang 2026" (computed at the clock; live 477,888).
- **AC-M17-25.2** Given S8 of 2026, when it loads, then "Ketepatan" 82.9% / "82.8% selepas pembetulan", "Guru" 502, "Soalan / Pelajar Aktif" 305.7 / "purata kedalaman penggunaan" (live 305.8), "Sekolah Paling Aktif" "SEKOLAH MENENGAH KEBANGSAAN TINGGI KLUANG", "Bulan Paling Aktif" "Jun".

**US-M17-26 — Trend, comparison, badges, top five, subjects**
- **AC-M17-26.1** Given S8 of 2026, when "Trend Penggunaan Bulanan 2026" loads, then the bars read Jan 5 (3p), Feb 1,885 (51p), Mar 10,357 (48p), Apr 22,762 (333p), May 143,760 (1178p), Jun 229,467 (535p), Jul 32,010 (202p), Aug 17,291 (80p), Sep 20,206 (86p) (live 20,351 at 12:33), Oct–Dec empty.
- **AC-M17-26.2** Given S8, when "Analisis Perbandingan Sekolah" loads, then "Kadar Penglibatan Pelajar (%)" starts with SMK JALAN TIGA 100% and ends with SMK BANDAR SERI PUTRA 0.6% (41 rows), and "Ketepatan Akhir (%)" starts with SJK(C) CHONG HWA I 96.1% and ends with SK BANDAR BARU DARULAMAN 47.5% (41 rows).
- **AC-M17-26.3** Given S8, when "Lencana Pencapaian 2026" loads, then it has 57 tiles; TINGGI KLUANG "★ Paling Aktif", SJK(C) CHONG HWA I "★ Paling Tepat" and "★ Paling Rajin", SMK JALAN TIGA "★ Penglibatan Tertinggi", every other tile "Tiada lencana khas".
- **AC-M17-26.4** Given S8, when "5 Sekolah Paling Aktif" loads, then row 1 reads "SEKOLAH MENENGAH KEBANGSAAN TINGGI KLUANG" "Johor" "Soalan:" 72,332 "Pelajar:" 33/59 "Penglibatan:" 55.9% "Ketepatan:" 89.8% "Fokus →" → `/admin/laporan-eksekutif/sekolah/8880`, and rows 2–5 are BANDAR RINCHING, BANDAR BARU BANGI, ENGKU HUSAIN, BANDAR TASIK KESUMA as observed.
- **AC-M17-26.5** Given S8, when "Prestasi Mengikut Subjek" loads, then it has 26 rows from "Bahasa Melayu" "87.5% · 116,028 soalan · 1045 pelajar" (live 116,173; the 145 post-clock answers are placed in Bahasa Melayu, PROPOSED) to "Pendidikan Muzik" "100.0% · 20 soalan · 1 pelajar", and the "soalan" values sum to 477,743.

**US-M17-27 — Headcount, Kirkpatrick, GPS, tuition, footer, other years**
- **AC-M17-27.1** Given S8, when "Headcount TOV → RS (2026)" loads, then it has 11 rows; the KHIR JOHARI row reads 325 · 50.1 · 68.6 · 65.0 · +14.9 and the PANDAN INDAH row 979 · 51.2 · "-" · "-" · "-".
- **AC-M17-27.2** Given S8, when "Kirkpatrick Evaluation" loads, then "Jumlah Respon" 336, "Purata Kepuasan" 4.6 "/5", "NPS Score" 8.3.
- **AC-M17-27.3** Given S8, when "GPS Perbandingan Sekolah (2026)" loads, then it shows "SEKOLAH MENENGAH KEBANGSAAN TINGGI KLUANG" / "GPS 2.88 · 5 subjek · 150 calon" and the note "GPS lebih rendah = lebih baik. GPS 1.0 = semua A.".
- **AC-M17-27.4** Given S8, when "Pusat Tuisyen" loads, then "Pusat Tuisyen Demo PrestasiPlus" "Johor Bahru, Johor" 18 "pelajar aktif" and "Alesa IT Tuisyen" "KLUANG, Johor" 0 "pelajar aktif" (provisional until XR-M17-17).
- **AC-M17-27.5** Given S8, when it loads at the clock, then the footer reads "Laporan dijana automatik oleh PrestasiPlus · 25 Sep 2026, 03:40 PM" (request minute, MYT, DV-M17-06) and "Menyeluruh. Berasaskan Data. Berdaya Maju.".
- **AC-M17-27.6** Given S8 of 2025, when it loads, then "0 aktif 2025", "Kadar Penglibatan" 0%, "Soalan Dijawab" 0, "Ketepatan" 0% / "0% selepas pembetulan" (DC-M17-04 is scoped to 2026), "Sekolah Paling Aktif" "-", "Bulan Paling Aktif" "-", 57 badge tiles all "Tiada lencana khas", and no monthly, comparison, "5 Sekolah Paling Aktif", subject, headcount or GPS section, while "Jumlah Sekolah" 57, "Pelajar Berdaftar" 3,152 and "Guru" 502 stay (DV-M17-14).
- **AC-M17-27.7** Given S8 of 2027, when it loads, then it renders the empty-year report of AC-27.6 for 2027 with "← 2026" and no forward link.

**US-M17-28 — School focus**
- **AC-M17-28.1** Given S9 of 8880, when it loads, then "Kembali ke Laporan Eksekutif" → S8, "SEKOLAH MENENGAH KEBANGSAAN TINGGI KLUANG", "Negeri: Johor", "Penglibatan" 55.9% / "33 aktif / 59 daftar", "Soalan Dijawab" 72,332 / "2192 soalan/pelajar", "Ketepatan Akhir" 89.8%, "Konsistensi" "9/12" / "bulan aktif 2026".
- **AC-M17-28.2** Given S9 of 8880, when the trend and subjects load, then the bars read Jan 1, Feb 729, Mar 1,148, Apr 1,056, May 16,200, Jun 52,059, Jul 1,074, Aug 30, Sep 35; "▲ SUBJEK TERKUAT" "Pendidikan Al-Quran & As-Sunnah" "100.0% (35 soalan)"; "▼ SUBJEK PERLU PERHATIAN" "Kimia" "64.1% (744 soalan)".
- **AC-M17-28.3** Given S9 of 8880, when "Headcount TOV → RS" loads, then row 1 reads "Matematik" 41 · 61.3 · 73.4 · +12.2, and the footer "Laporan dijana: 25 Sep 2026, 03:40 PM · PrestasiPlus" (request minute).
- **AC-M17-28.4** Given S9 of 5183, when it loads, then "Negeri: Terengganu", "0%", "0 aktif / 1 daftar", "0 soalan/pelajar", "0%", "0/12" and no chart values.
- **AC-M17-28.5** Given S8 and S9 at 375px, when they load, then the page does not scroll sideways; the monthly chart and the headcount tables scroll inside their cards and the month labels are 12px (DV-M17-03).

**US-M17-29 — Imports, status, content**
- **AC-M17-29.1** Given S10, when it loads, then "Jumlah Import" 1,123 / "Keseluruhan", "Import Bulan Ini" 0 / "September 2026", "Import Lepas" 0 / "August 2026", "Soalan Diimport" 31,101 / "Berjaya" (XR-M17-11).
- **AC-M17-29.2** Given S10, when "Taburan Status Soalan" loads, then "Draf" "0 (0.0%)", "Menunggu Review" "0 (0.0%)", "Diluluskan" "128,006 (99.7%)", "Ditolak" "0 (0.0%)", "Diarkib" "400 (0.3%)".
- **AC-M17-29.3** Given S10, when the content cards load, then "Banner" 5, "Artikel" "Terbit" 72 / "Draf" 0, "Nota" "Terbit" 10 / "Draf" 0; after an admin deletes a banner in M09, "Banner" is 4.

**US-M17-30 — Coverage**
- **AC-M17-30.1** Given S10, when "Top 10 Subjek Aktif" loads, then it lists Pendidikan Moral 15,414, Matematik 13,354, Sains 12,128, Bahasa Melayu 11,688, Pendidikan Islam 9,152, Bahasa Inggeris 8,039, Sejarah 6,468, Bahasa Tamil 6,300, Geografi 5,692, Bahasa Arab 5,400.
- **AC-M17-30.2** Given S10, when "Matriks Liputan Subjek" loads, then the Bahasa Melayu row reads 958 · 2,540 · 805 · 530 · 407 · 400 · 2,104 · 1,800 · 1,500 · 257 · 387 · 11,688, "-" marks empty cells, the column sums are 11,387 · 10,212 · 5,771 · 4,726 · 3,848 · 4,442 · 19,455 · 15,700 · 13,800 · 19,085 · 19,217 and the total 127,643; the table scrolls inside its card at 375, 768 and 1280.
- **AC-M17-30.3** Given S10, when "Taburan Kesukaran Mengikut Subjek" loads, then it shows 27 tiles (e.g. "Bahasa Arab" "5,400 soalan" "Lvl 1" 2826 "Lvl 2" 1287 "Lvl 3" 1287 "Lvl 4" 0 "Lvl 5" 0) and the levels sum to 38,968 / 46,154 / 32,987 / 9,534 / 0.
- **AC-M17-30.4** Given S10, when "Status Kurikulum" loads, then it shows 31 tiles with "Bahasa Melayu" "84 bab" … "Sains Rumah Tangga" "1 bab" and "Pembuatan Pakaian Wanita", "Pertanian", "Sains Sukan" "Tiada bab"; the "bab" values sum to 1,311 (XR-M17-19).

**US-M17-31 — Statistics overview**
- **AC-M17-31.1** Given S11, when it loads, then "Overview" is the active tab and "30 Hari" the active pill; the cards read "Murid Pernah Login" 54% 1,708 "/ 3,152" "1,444 belum pernah login"; "Cikgu Pernah Login" 54% 269 "/ 502" "233 belum pernah login"; "Murid Buat Latihan" 52% 1,642 "/ 3,152".
- **AC-M17-31.2** Given S11 on 30 days, when it loads, then "Jumlah Aktiviti" 1,431 / "30 hari lepas" (DV-M17-16; window 27/08–25/09 at the clock; live 3,522), "Skor Purata" 44.6% with "Struktur: 6.7%", the trend has 30 points labelled 27/08 … 25/09 (the observed daily values, 25/09 = 17 before the clock) whose values sum to 1,431, and "Pecahan Aktiviti" reads "Kuiz Objektif" 1,409, "Soalan Berstruktur" 13, "Battle Arena" 4, "Permainan" 5.
- **AC-M17-31.3** Given `?range=7`, when it loads, then "Jumlah Aktiviti" 423 / "7 hari lepas", trend 19/09 … 25/09 = 87, 181, 56, 36, 21, 25, 17, Pecahan 420 / 3 / 0 / 0; given `?range=90`, 5,931 / "90 hari lepas" (28/06 … 25/09; 28/06 = 0, not captured), Pecahan 4,907 / 954 / 23 / 47; given `?range=999`, the 30-day view.
- **AC-M17-31.4** Given S11, when it loads, then "Pelajar Paling Aktif" lists 10 rows with counts 923, 38, 23, 22, 21, 19, 19, 18, 16, 15 on every range, and "Cikgu Belum Login" lists 20 teachers A→Z with their e-mail lines.

**US-M17-32 — Sekolah tab**
- **AC-M17-32.1** Given the "Sekolah" tab, when it opens, then the tab reads "Sekolah (57)" (DV-M17-28; live 61; XR-M17-08 rejected), pills "Semua (57)", "Aktif (9)", "Kurang (0)", "Tidak Aktif (48)", tiles 9 "Aktif (7 hari)", 0 "Kurang Aktif", 48 "Tidak Aktif", and row 1 "SEKOLAH MENENGAH KEBANGSAAN KHIR JOHARI" with "Murid" 177/185, "Latihan" 3477, "Soalan" 0, "Langganan" "Aktif", "Status" "Aktif", "Login Terakhir" "2 minit yang lepas".
- **AC-M17-32.2** Given the "Sekolah" tab, when I click "Tidak Aktif (48)" and type "jalan" in "Cari sekolah...", then only inactive schools whose name contains "jalan" are listed; a search with no match shows an empty table without a message (as live).

**US-M17-33 — Guru tab**
- **AC-M17-33.1** Given the "Guru" tab, when it opens, then "Guru (502)" / "Senarai Guru (502)", pills "Semua", "Pernah Login (269)", "Belum Login (233)", tiles "Jumlah Guru" 502, "Pernah Login" 269, "Jumlah Soalan" 11,414, "Jumlah Syiling" 63,459 (DV-M17-17; XR-M17-14, XR-M17-20).
- **AC-M17-33.2** Given the "Guru" tab, when I pick "Belum Login" and a school in the select, then only teachers of that school with "Login" "Belum" are shown.

**US-M17-34 — Murid tab and S11 layout**
- **AC-M17-34.1** Given the "Murid" tab, when it opens, then "Murid (3,152)" / "Senarai Murid (3,152) — Top 200" (DV-M17-17), tiles "Jumlah Murid" 3,152, "Pernah Latihan" 200, "Jumlah Sesi" 24,076, "Purata Ketepatan" 76.1%, and 200 rows; row 1 "SEKOLAH MENENGAH KEBANGSAAN PANDAN INDAH" "SEJARAH 5 NEPTUN" 2537 88.5% "53j 59m" 65,304 "20/06/2026"; no row shows a "Ketepatan" above 100.0% (DV-M17-19); the "Syiling" column shows the observed values (DC-M17-08).
- **AC-M17-34.2** Given the "Murid" tab, when I click "Login Sahaja" or "Belum Login", then the table lists up to 200 pupils of that status (DV-M17-18); "Aktif" lists the top-200 rows.
- **AC-M17-34.3** Given S11 at 375px, when it loads, then the overview cards fit without horizontal page scroll and the tables scroll inside their cards (DV-M17-04).

**US-M17-35 — Consistency, time, text, devices**
- **AC-M17-35.1** Given the project clock, when S2, S3 (month), S8 and S11 load, then the shared figures agree: "Pelajar Berdaftar" 3,152 on S2, S3 ("daripada 3,152"), S8 and S11 ("/ 3,152", "Murid (3,152)"); "Soalan Dijawab" 477,743 on S2 and S8 = Σ of the S8 monthly bars; S3 "Bulan Ini" 20,206 = the S8 Sep bar; S2 "Minggu ini: 2,508" = S3 week.
- **AC-M17-35.2** Given every time shown on S2, S3, S6, S7, S8 and S9, when compared with the clock, then it is Malaysian time (e.g. the heatmap bucket of pupil 2022's answers at 09:21 is 9:00; the S6 "Terakhir Aktif" of pupil 2022 is "25/09 09:22"; the S8 footer "03:40 PM").
- **AC-M17-35.3** Given each M17 screen at 375, 768 and 1280, when it loads, then no content text is smaller than 12px and the page does not scroll sideways (DV-M17-25, NFR-RESP).

**US-M17-36 — Open the school Command Center (v1.11; route OBSERVED, board SERVER, new-tab behaviour INFERRED)**
- **AC-M17-36.1** Given a signed-in school admin, when the user clicks "Command Center" in the sidebar, then `/admin-sekolah/command-center` opens in a new tab with the header "PRESTASIPLUS COMMAND CENTER", the "LIVE" pill and a ticking clock.
- **AC-M17-36.2** Given the school-admin sidebar, when it renders, then "Command Center" with the badge "LIVE" is the first item.
- **AC-M17-36.3** Given 375, 768 and 1280 viewports, when the board renders, then there is no page-level horizontal scroll, no clipped panel and no text under 12 px.

**US-M17-37 — Own-school figures only**
- **AC-M17-37.1** Given the fixture, when Admin Sekolah A opens the board, then "Soalan Dijawab" = 3, "Pelajar Berdaftar" = A's pupil count and "Sekolah Berdaftar" = 1; the board shows the sub-line "Pemantauan langsung sekolah anda" and "Ketepatan Purata" reads "sekolah anda", and the text "keseluruhan platform" appears nowhere (SERVER copy).
- **AC-M17-37.2** Given the fixture, when Admin Sekolah A loads the board and the poll, then no pupil name and no school name of B appears in the page, the feed or the top-pupils list.
- **AC-M17-37.3** Given Admin Sekolah A, when the poll runs after 10 s, then the counters still equal A's figures (not platform).
- **AC-M17-37.4** Given Admin Sekolah A, when the board renders, then "Top Sekolah" is absent and the remaining panels leave no empty hole at 375 / 768 / 1280.
- **AC-M17-37.5** Given the fixture, when Admin Sekolah A views "Kirkpatrick" and "ALESA AI", then every input equals A's figures (school count 1 or 0 per subscription, A's accuracy), not platform figures.
- **AC-M17-37.6** Given Admin Sekolah A, when the request carries `?schoolId=<B>` or `?school_id=<B>` (page or poll), then the parameter is ignored and A's figures are returned.

**US-M17-38 — Live refresh**
- **AC-M17-38.1** Given the board is open, when 10 s pass, then `live-data` is requested again and counters and feed re-render.
- **AC-M17-38.2** Given a poll fails, when the next render happens, then the previous values stay and no error page shows.

**US-M17-39 — Same panels for the school**
- **AC-M17-39.1** Given pupils with answers this week, when the board renders, then "Top Pelajar Minggu Ini" lists A's pupils by answers (ties as FR-M17-29).
- **AC-M17-39.2** Given a school with no activity, when the board renders, then counters show zero (or "--" per S2 copy), panels show their empty text and there is no error.
- **AC-M17-39.3** Given Admin Sekolah A (OQ-M17-12), when "Pembetulan" renders, then it shows "0", "+0.0%", "0%" and not "899" (INFERRED; the platform value 899 is DV-M17-40); "Engagement" shows A's answers per day for the last 7 days, bars scaled to the maximum (SERVER), not the platform display constants.
- **AC-M17-39.4** Given the seeds and docs, when searched, then every school and person name is fictitious and no real name from the reference or live appears.

**US-M17-40 — Refusals**
- **AC-M17-40.1** Given the platform admin, when opening `/admin-sekolah/command-center`, then the global 403 page "Akses Ditolak" shows (OBSERVED live).
- **AC-M17-40.2** Given a school-admin account with no school, when opening the route or its poll, then 403 and no figure is shown.
- **AC-M17-40.3** Given a district officer (PPD/JPN), when opening the route or its poll, then 403.
- **AC-M17-40.4** Given a guest, when opening the route or its poll, then redirect to `/login` (401 for the API).
- **AC-M17-40.5** Given a teacher or pupil, when opening the route, then the 403 page shows.
- **AC-M17-40.6** Given the platform admin, when opening `/admin/command-center`, then the board shows platform figures with "Top Sekolah" (S2 unchanged).

**US-M17-41 — Own-school drill-downs (OQ-M17-13 decided: 404)**
- **AC-M17-41.1** Given Admin Sekolah A, when the user clicks A's school link in the feed, then S4 for A opens under `/admin-sekolah/command-center/school/{A}` with A's teachers.
- **AC-M17-41.2** Given Admin Sekolah A, when opening S4 of B (page or API #6), then the M01 global 404 page shows (API 404 `NOT_FOUND`) and no B data.
- **AC-M17-41.3** Given Admin Sekolah A, when opening S5 of a teacher of B (or of A's id with a B teacher), then 404 as in AC-M17-41.2.
- **AC-M17-41.4** Given Admin Sekolah A, when opening S6 of a class of B or S7 of B's pupil (page, API #8–#13), then 404 as in AC-M17-41.2.
- **AC-M17-41.5** Given Admin Sekolah A, when opening a drill with an unknown or non-numeric id, then the same M01 global 404 page shows, indistinguishable from AC-M17-41.2 (existence not revealed).
- **AC-M17-41.6** Given the board, when the user clicks "← Dashboard" and "📊 Aktiviti Harian", then `/admin-sekolah` and the S3 alias open.

**US-M17-42 — School daily activity**
- **AC-M17-42.1** Given Admin Sekolah A on S3, when the page loads, then its header and tab title read "AKTIVITI SEKOLAH — PRESTASIPLUS" (SERVER: "Aktiviti Sekolah"); when the tab "Minggu Ini" is chosen, then figures cover A only, "Sekolah Aktif" reads "1 daripada 1" (or "0 daripada 1") and the school list is absent.
- **AC-M17-42.2** Given Admin Sekolah A, when calling `/api/command-center/daily-activity/school/{id}` (SRS §7 #5), then 403 (admin-only endpoint).

---

## 5. UI expectations

| Screen | Key states (screenshots in `docs/discovery/img/M17/`) | Behaviour notes |
|---|---|---|
| S1 | default (`dashboard-desktop/-tablet/-mobile.png`) | Stat grid; lower area 2 columns from `lg`; "Soalan Terkini" table scrolls inside its card at 375 (as live); labels ≥ 12px (DV-M17-25). |
| S2 | default after the first poll (`command-center-desktop/-tablet/-mobile.png`) | Dark standalone board (JetBrains Mono numerals, CSS variables `--emerald`, `--cyan`, `--amber`, `--rose`, `--violet`, `--indigo`, `--sky`, `--text-muted`); 3 columns at 1280 with in-panel scroll; 2 columns at 768; 1 column at 375 (DV-M17-01). |
| S3 | today / week / month / drill (`daily-activity-*.png`, `daily-activity-month-drill.png`) | 6 pulse cards in a row at 1280, 2–3 per row at 768, 1 column at 375; heatmap only on "Hari Ini". |
| S4 | 8082, 8080 (`cc-school-*.png`) | Teacher table scrolls inside its card at 375 (DV-M17-02). |
| S5 | 7 classes, 1 class, 0 classes (`cc-teacher-*.png`, `cc-teacher-empty.png`) | Row "Tiada kelas aktif" for 0 classes (as live). |
| S6 | class 370 (`cc-classroom-*.png`) | Pupil table scrolls inside its card at 375. |
| S7 | default, week / session / headcount modals (`cc-student-*.png`, `cc-student-modal-*.png`) | 5 stat cards (2 per row at 375); panels stack at 375; modals full width minus the page padding. |
| S8 | 2026, 2025, invalid year (`laporan-eksekutif-*.png`, `laporan-eksekutif-2025.png`; `laporan-eksekutif-500.png` is the live defect) | KPI grid `md:grid-cols-5`; monthly chart and headcount table scroll inside their cards at 375 (DV-M17-03). |
| S9 | 8880, 5183 (`eksekutif-sekolah-*.png`) | As S8. |
| S10 | default (`analytics-*.png`) | Matrix scrolls inside its card at every width (as live); difficulty tiles wrap. |
| S11 | overview, tabs, filters (`laporan-*.png`, `laporan-tab-*.png`, `laporan-murid-belum-empty.png` — the live defect DV-M17-18) | Cards `grid-cols-2 lg:grid-cols-5` fitting 375 (DV-M17-04); tables in `overflow-x-auto`. |

Loading: SHA pages use the shared shell loading behaviour while the mock responds; S2 shows its server placeholders until the first poll; S3 lists show the spinner; S7 modals show "Memuatkan..." / "Memuatkan soalan...". Errors: S2 keeps the last values; S3 "Gagal memuatkan" / "Gagal"; S7 "Ralat memuatkan data" / "Ralat"; SHA pages use the global error convention of M01.

---

## 6. Coverage matrix (completeness proof)

Source: `docs/discovery/inventory/M17/` (generated 2026-09-26). Generated by script (`fns.cjs` + `matrix.cjs` in the author's scratchpad `m17-writer/`; reproducible from the Function catalogue of §3 and the inventory JSON). Every M17 content element (S1–S11) is listed with the Function that covers it; each element maps to exactly one entry. Shell elements (SHA) are chrome of the global admin shell / M23: the 24 entries whose targets or titles are M17's are mapped to FT-M17-1.1, the other 209 are excluded with their owner. "Content" quotes the DOM text as captured (`<name>`, `<person>`, `<masked>`, `{id}` = discovery privacy mask).

**Summary**

| Set | Elements | Mapped to an M17 Function | Excluded (with reason) | Unmapped |
|---|---|---|---|---|
| S1 — `/admin` | 87 | 87 | 0 | 0 |
| S2 — `/admin/command-center` | 108 | 108 | 0 | 0 |
| S3 — `/admin/command-center/daily-activity` | 376 | 376 | 0 | 0 |
| S4 — `/admin/command-center/school/{id}` | 29 | 29 | 0 | 0 |
| S5 — `/admin/command-center/school/{sid}/teacher/{uid}` | 27 | 27 | 0 | 0 |
| S6 — `/admin/command-center/classroom/{id}` | 31 | 31 | 0 | 0 |
| S7 — `/admin/command-center/student/{id}` | 86 | 86 | 0 | 0 |
| S8 — `/admin/laporan-eksekutif` | 327 | 327 | 0 | 0 |
| S9 — `/admin/laporan-eksekutif/sekolah/{id}` | 113 | 113 | 0 | 0 |
| S10 — `/admin/analytics` | 494 | 494 | 0 | 0 |
| S11 — `/admin/laporan` | 173 | 173 | 0 | 0 |
| **M17 content (S1–S11)** | **1851** | **1851** | **0** | **0** |
| Admin-panel shell SHA (chrome of S1, S8–S11) | 233 | 24 | 209 | 0 |
| **All** | **2084** | **1875** | **209** | **0** |

**1851/1851 M17 content elements covered (1851 mapped, 0 excluded), 0 unmapped.** Including the admin-panel shell: 2084/2084 elements accounted for (1875 mapped, 209 excluded with reason), 0 unmapped. 112 of the 131 Functions in §3 appear in this matrix; the other 19 are behaviour-only Functions (access, polling, cache, mounts, layout, cross-cutting rules, unobservable states).

### 6.1 Element tables

#### S1 — `/admin` (87 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M17-S1-001 | card | visible-default | "130,152" | FN-M17-2.1.1 |
| EL-M17-S1-002 | text | visible-default | "Soalan Aktif" | FN-M17-2.1.1 |
| EL-M17-S1-003 | text | visible-default | "130,152" | FN-M17-2.1.1 |
| EL-M17-S1-004 | text | visible-default | "Minggu ini: 0", fa-calendar-week | FN-M17-2.1.1 |
| EL-M17-S1-005 | card | visible-default | "150,683" | FN-M17-2.1.2 |
| EL-M17-S1-006 | text | visible-default | "Diluluskan" | FN-M17-2.1.2 |
| EL-M17-S1-007 | text | visible-default | "150,683" | FN-M17-2.1.2 |
| EL-M17-S1-008 | text | visible-default | "Aktif digunakan: 129,752", fa-check-circle | FN-M17-2.1.2 |
| EL-M17-S1-009 | card | visible-default | "0" | FN-M17-2.1.3 |
| EL-M17-S1-010 | text | visible-default | "Menunggu Review" | FN-M17-2.1.3 |
| EL-M17-S1-011 | text | visible-default | "0" | FN-M17-2.1.3 |
| EL-M17-S1-012 | text | visible-default | "Perlu tindakan", fa-clock | FN-M17-2.1.3 |
| EL-M17-S1-013 | card | visible-default | "0" | FN-M17-2.1.3 |
| EL-M17-S1-014 | text | visible-default | "Draf" | FN-M17-2.1.3 |
| EL-M17-S1-015 | text | visible-default | "0" | FN-M17-2.1.3 |
| EL-M17-S1-016 | text | visible-default | "Belum siap", fa-edit | FN-M17-2.1.3 |
| EL-M17-S1-017 | card | visible-default | "31" | FN-M17-2.1.4 |
| EL-M17-S1-018 | text | visible-default | "Subjek" | FN-M17-2.1.4 |
| EL-M17-S1-019 | text | visible-default | "31" | FN-M17-2.1.4 |
| EL-M17-S1-020 | text | visible-default | "31 Aktif", fa-circle | FN-M17-2.1.4 |
| EL-M17-S1-021 | card | visible-default | "11" | FN-M17-2.1.4 |
| EL-M17-S1-022 | text | visible-default | "Tahap Pendidikan" | FN-M17-2.1.4 |
| EL-M17-S1-023 | text | visible-default | "11" | FN-M17-2.1.4 |
| EL-M17-S1-024 | text | visible-default | "Darjah & Tingkatan", fa-graduation-cap | FN-M17-2.1.4 |
| EL-M17-S1-025 | card | visible-default | "5,159" | FN-M17-2.1.5 |
| EL-M17-S1-026 | text | visible-default | "Pengguna" | FN-M17-2.1.5 |
| EL-M17-S1-027 | text | visible-default | "5,159" | FN-M17-2.1.5 |
| EL-M17-S1-028 | text | visible-default | "4533 Pelajar", fa-user | FN-M17-2.1.5 |
| EL-M17-S1-029 | card | visible-default | "PvP Quiz Battles" | FN-M17-2.2.1 |
| EL-M17-S1-030 | text | visible-default | "Battle Arena" | FN-M17-2.2.1 |
| EL-M17-S1-031 | text | visible-default | "PvP Quiz Battles" | FN-M17-2.2.1 |
| EL-M17-S1-032 | text | visible-default | "168 Total", fa-gamepad | FN-M17-2.2.1 |
| EL-M17-S1-033 | text | visible-default | "0 Aktif", fa-circle | FN-M17-2.2.1 |
| EL-M17-S1-034 | text | visible-default | "66 Selesai", fa-flag-checkered | FN-M17-2.2.1 |
| EL-M17-S1-035 | link | visible-default | link, fa-school, → /battle/ranking-sekolah | FN-M17-2.2.1 |
| EL-M17-S1-036 | link | visible-default | link, fa-trophy, → /battle/leaderboard | FN-M17-2.2.1 |
| EL-M17-S1-037 | card | visible-default | "6" | FN-M17-2.2.2 |
| EL-M17-S1-038 | text | visible-default | "Jumlah Penaja" | FN-M17-2.2.2 |
| EL-M17-S1-039 | text | visible-default | "6" | FN-M17-2.2.2 |
| EL-M17-S1-040 | text | visible-default | "0 Aktif", fa-check-circle | FN-M17-2.2.2 |
| EL-M17-S1-041 | card | visible-default | "0" | FN-M17-2.2.2 |
| EL-M17-S1-042 | text | visible-default | "Menunggu Kelulusan" | FN-M17-2.2.2 |
| EL-M17-S1-043 | text | visible-default | "0" | FN-M17-2.2.2 |
| EL-M17-S1-044 | empty-state | visible-default | "Tiada yang menunggu", fa-check | FN-M17-2.2.2 |
| EL-M17-S1-045 | card | visible-default | "0" | FN-M17-2.2.2 |
| EL-M17-S1-046 | text | visible-default | "Ditolak" | FN-M17-2.2.2 |
| EL-M17-S1-047 | text | visible-default | "0" | FN-M17-2.2.2 |
| EL-M17-S1-048 | text | visible-default | "Permohonan ditolak", fa-times-circle | FN-M17-2.2.2 |
| EL-M17-S1-049 | card | visible-default | "6" | FN-M17-2.2.2 |
| EL-M17-S1-050 | text | visible-default | "Digantung" | FN-M17-2.2.2 |
| EL-M17-S1-051 | text | visible-default | "6" | FN-M17-2.2.2 |
| EL-M17-S1-052 | text | visible-default | "Akaun digantung", fa-pause-circle | FN-M17-2.2.2 |
| EL-M17-S1-053 | link | visible-default | "Tindakan Pantas Tambah Soalan Baru", fa-plus, → /admin/questions/create | FN-M17-2.3.1 |
| EL-M17-S1-054 | link | visible-default | "Tindakan Pantas Tambah Subjek Baru", fa-book-medical, → /admin/subjects/create | FN-M17-2.3.1 |
| EL-M17-S1-055 | link | visible-default | "Tindakan Pantas Import CSV Soalan", fa-file-csv, → /admin/questions/import | FN-M17-2.3.1 |
| EL-M17-S1-056 | card | visible-default | "Soalan Terkini" | FN-M17-2.3.2 |
| EL-M17-S1-057 | heading | visible-default | "Soalan Terkini" | FN-M17-2.3.2 |
| EL-M17-S1-058 | text | visible-default | "10 soalan terbaru" | FN-M17-2.3.2 |
| EL-M17-S1-059 | link | visible-default | "Lihat Semua", fa-arrow-right, → /admin/questions | FN-M17-2.3.2 |
| EL-M17-S1-060 | table | visible-default | table | FN-M17-2.3.2 |
| EL-M17-S1-061 | badge | visible-default | "Diluluskan" | FN-M17-2.3.2 |
| EL-M17-S1-062 | badge | visible-default | "Diluluskan" | FN-M17-2.3.2 |
| EL-M17-S1-063 | badge | visible-default | "Diluluskan" | FN-M17-2.3.2 |
| EL-M17-S1-064 | card | visible-default | "Taburan Status Soalan" | FN-M17-2.3.3 |
| EL-M17-S1-065 | heading | visible-default | "Taburan Status Soalan" | FN-M17-2.3.3 |
| EL-M17-S1-066 | text | visible-default | "Draf" | FN-M17-2.3.3 |
| EL-M17-S1-067 | text | visible-default | "0" | FN-M17-2.3.3 |
| EL-M17-S1-068 | text | visible-default | "Menunggu" | FN-M17-2.3.3 |
| EL-M17-S1-069 | text | visible-default | "0" | FN-M17-2.3.3 |
| EL-M17-S1-070 | text | visible-default | "Diluluskan" | FN-M17-2.3.3 |
| EL-M17-S1-071 | text | visible-default | "150,683" | FN-M17-2.3.3 |
| EL-M17-S1-072 | text | visible-default | "Ditolak" | FN-M17-2.3.3 |
| EL-M17-S1-073 | text | visible-default | "0" | FN-M17-2.3.3 |
| EL-M17-S1-074 | text | visible-default | "Diarkib" | FN-M17-2.3.3 |
| EL-M17-S1-075 | text | visible-default | "323,184" | FN-M17-2.3.3 |
| EL-M17-S1-076 | card | visible-default | "Pautan Pantas" | FN-M17-2.4.1 |
| EL-M17-S1-077 | heading | visible-default | "Pautan Pantas" | FN-M17-2.4.1 |
| EL-M17-S1-078 | link | visible-default | "Kurikulum", fa-book-open, → /admin/curriculum | FN-M17-2.4.1 |
| EL-M17-S1-079 | link | visible-default | "Analitik", fa-chart-pie, → /admin/analytics | FN-M17-2.4.1 |
| EL-M17-S1-080 | link | visible-default | "Banner", fa-image, → /admin/banners | FN-M17-2.4.1 |
| EL-M17-S1-081 | link | visible-default | "Artikel", fa-newspaper, → /admin/articles | FN-M17-2.4.1 |
| EL-M17-S1-082 | card | visible-default | "Muat Turun Data (CSV)" | FN-M17-2.4.2 |
| EL-M17-S1-083 | heading | visible-default | "Muat Turun Data (CSV)" | FN-M17-2.4.2 |
| EL-M17-S1-084 | link | visible-default | "Pengguna", fa-users, → /admin/export/users | FN-M17-2.4.2 |
| EL-M17-S1-085 | link | visible-default | "Soalan", fa-question-circle, → /admin/export/questions | FN-M17-2.4.2 |
| EL-M17-S1-086 | link | visible-default | "Pembayaran", fa-credit-card, → /admin/export/payments | FN-M17-2.4.2 |
| EL-M17-S1-087 | link | visible-default | "Sekolah", fa-school, → /admin/export/schools | FN-M17-2.4.2 |

#### S2 — `/admin/command-center` (108 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M17-S2-001 | link | visible-default | "← Dashboard", → /admin | FN-M17-3.1.1 |
| EL-M17-S2-002 | link | visible-default | "📊 Aktiviti Harian", → /admin/command-center/daily-activity | FN-M17-3.1.1 |
| EL-M17-S2-003 | heading | visible-default | "PrestasiPlus Command Center" | FN-M17-3.1.1 |
| EL-M17-S2-004 | text | visible-default | "LIVE" | FN-M17-3.1.1 |
| EL-M17-S2-005 | text | visible-default | "12:20:45" | FN-M17-3.1.1 |
| EL-M17-S2-006 | text | visible-default | "MYT" | FN-M17-3.1.1 |
| EL-M17-S2-007 | text | visible-default | "Sekolah Berdaftar" | FN-M17-3.2.1 |
| EL-M17-S2-008 | text | visible-default | "9" | FN-M17-3.2.1 |
| EL-M17-S2-009 | text | visible-default | "langganan aktif" | FN-M17-3.2.1 |
| EL-M17-S2-010 | text | visible-default | "Pelajar Berdaftar" | FN-M17-3.2.2 |
| EL-M17-S2-011 | text | visible-default | "3,152" | FN-M17-3.2.2 |
| EL-M17-S2-012 | text | visible-default | "aktif menjawab" | FN-M17-3.2.2 |
| EL-M17-S2-013 | text | visible-default | "1,563" | FN-M17-3.2.2 |
| EL-M17-S2-014 | text | visible-default | "Soalan Dijawab" | FN-M17-3.2.3 |
| EL-M17-S2-015 | text | visible-default | "477,888" | FN-M17-3.2.3 |
| EL-M17-S2-016 | text | visible-default | "sepanjang masa" | FN-M17-3.2.3 |
| EL-M17-S2-017 | text | visible-default | "Ketepatan Purata" | FN-M17-3.2.4 |
| EL-M17-S2-018 | text | visible-default | "82.9%" | FN-M17-3.2.4 |
| EL-M17-S2-019 | text | visible-default | "keseluruhan platform" | FN-M17-3.2.4 |
| EL-M17-S2-020 | text | visible-default | "Top Sekolah" | FN-M17-3.3.1 |
| EL-M17-S2-021 | text | visible-default | "🏆" | FN-M17-3.3.1 |
| EL-M17-S2-022 | text | visible-default | "1" | FN-M17-3.3.1 |
| EL-M17-S2-023 | link | visible-default | "SEKOLAH MENENGAH KEBANGSAAN ENGKU HUSAIN", → /admin/command-center/school/8082 | FN-M17-3.3.1 |
| EL-M17-S2-024 | text | visible-default | "392 plj" | FN-M17-3.3.1 |
| EL-M17-S2-025 | text | visible-default | "2" | FN-M17-3.3.1 |
| EL-M17-S2-026 | link | visible-default | "SEKOLAH MENENGAH KEBANGSAAN BANDAR BARU BANGI", → /admin/command-center/school/8078 | FN-M17-3.3.1 |
| EL-M17-S2-027 | text | visible-default | "341 plj" | FN-M17-3.3.1 |
| EL-M17-S2-028 | text | visible-default | "Kirkpatrick" | FN-M17-3.3.2 |
| EL-M17-S2-029 | text | visible-default | "🔬" | FN-M17-3.3.2 |
| EL-M17-S2-030 | text | visible-default | "T1" | FN-M17-3.3.2 |
| EL-M17-S2-031 | text | visible-default | "★★☆☆☆ 4.7/10" | FN-M17-3.3.2 |
| EL-M17-S2-032 | text | visible-default | "T2" | FN-M17-3.3.2 |
| EL-M17-S2-033 | text | visible-default | "82.9% ketepatan" | FN-M17-3.3.2 |
| EL-M17-S2-034 | text | visible-default | "T3" | FN-M17-3.3.2 |
| EL-M17-S2-035 | text | visible-default | "91 aktif 30h" | FN-M17-3.3.2 |
| EL-M17-S2-036 | text | visible-default | "T4" | FN-M17-3.3.2 |
| EL-M17-S2-037 | text | visible-default | "GPS 2.880" | FN-M17-3.3.2 |
| EL-M17-S2-038 | card | visible-default | "penurunan" | FN-M17-3.3.3 |
| EL-M17-S2-039 | text | visible-default | "ALESA AI" | FN-M17-3.3.3 |
| EL-M17-S2-040 | text | visible-default | "🤖" | FN-M17-3.3.3 |
| EL-M17-S2-041 | text | visible-default | ""Platform menunjukkan 65% minggu ini. 3.6% pelajar terlibat aktif. Ketepatan pur" | FN-M17-3.3.3 |
| EL-M17-S2-042 | text | visible-default | "penurunan" | FN-M17-3.3.3 |
| EL-M17-S2-043 | card | visible-default | "2,653" | FN-M17-3.3.4 |
| EL-M17-S2-044 | text | visible-default | "Aktiviti Hari Ini" | FN-M17-3.3.4 |
| EL-M17-S2-045 | text | visible-default | "📈" | FN-M17-3.3.4 |
| EL-M17-S2-046 | text | visible-default | "60 soalan" | FN-M17-3.3.4 |
| EL-M17-S2-047 | text | visible-default | "Minggu ini:" | FN-M17-3.3.4 |
| EL-M17-S2-048 | text | visible-default | "2,653" | FN-M17-3.3.4 |
| EL-M17-S2-049 | text | visible-default | "▼ -65% vs minggu lepas" | FN-M17-3.3.4 |
| EL-M17-S2-050 | text | visible-default | "Live Feed" | FN-M17-3.3.5 |
| EL-M17-S2-051 | text | visible-default | "⚡" | FN-M17-3.3.5 |
| EL-M17-S2-052 | text | visible-default | "20:16" | FN-M17-3.3.5 |
| EL-M17-S2-053 | text | visible-default | "P.Islam" | FN-M17-3.3.5 |
| EL-M17-S2-054 | link | visible-default | "SEKOLAH MENENGA", → /admin/command-center/school/8087 | FN-M17-3.3.5 |
| EL-M17-S2-055 | text | visible-default | "✓" | FN-M17-3.3.5 |
| EL-M17-S2-056 | text | visible-default | "20:16" | FN-M17-3.3.5 |
| EL-M17-S2-057 | text | visible-default | "P.Islam" | FN-M17-3.3.5 |
| EL-M17-S2-058 | link | visible-default | "SEKOLAH MENENGA", → /admin/command-center/school/8087 | FN-M17-3.3.5 |
| EL-M17-S2-059 | text | visible-default | "✓" | FN-M17-3.3.5 |
| EL-M17-S2-060 | text | visible-default | "20:16" | FN-M17-3.3.5 |
| EL-M17-S2-061 | text | visible-default | "P.Islam" | FN-M17-3.3.5 |
| EL-M17-S2-062 | link | visible-default | "SEKOLAH MENENGA", → /admin/command-center/school/8087 | FN-M17-3.3.5 |
| EL-M17-S2-063 | text | visible-default | "✓" | FN-M17-3.3.5 |
| EL-M17-S2-064 | text | visible-default | "Top Pelajar Minggu Ini" | FN-M17-3.3.6 |
| EL-M17-S2-065 | text | visible-default | "⭐" | FN-M17-3.3.6 |
| EL-M17-S2-066 | text | visible-default | "🥇" | FN-M17-3.3.6 |
| EL-M17-S2-067 | link | visible-default | "<name>", → /admin/command-center/student/{id} | FN-M17-3.3.6 |
| EL-M17-S2-068 | text | visible-default | "452 jwb · 99.6%" | FN-M17-3.3.6 |
| EL-M17-S2-069 | text | visible-default | "🥈" | FN-M17-3.3.6 |
| EL-M17-S2-070 | link | visible-default | "<name>", → /admin/command-center/student/{id} | FN-M17-3.3.6 |
| EL-M17-S2-071 | text | visible-default | "405 jwb · 99.0%" | FN-M17-3.3.6 |
| EL-M17-S2-072 | text | visible-default | "Mood Pelajar" | FN-M17-3.3.7 |
| EL-M17-S2-073 | text | visible-default | "💚" | FN-M17-3.3.7 |
| EL-M17-S2-074 | text | visible-default | "😊" | FN-M17-3.3.7 |
| EL-M17-S2-075 | text | visible-default | "Gembira" | FN-M17-3.3.7 |
| EL-M17-S2-076 | text | visible-default | "307" | FN-M17-3.3.7 |
| EL-M17-S2-077 | text | visible-default | "😐" | FN-M17-3.3.7 |
| EL-M17-S2-078 | text | visible-default | "OK" | FN-M17-3.3.7 |
| EL-M17-S2-079 | text | visible-default | "280" | FN-M17-3.3.7 |
| EL-M17-S2-080 | text | visible-default | "😢" | FN-M17-3.3.7 |
| EL-M17-S2-081 | text | visible-default | "Sedih" | FN-M17-3.3.7 |
| EL-M17-S2-082 | text | visible-default | "72" | FN-M17-3.3.7 |
| EL-M17-S2-083 | text | visible-default | "😩" | FN-M17-3.3.7 |
| EL-M17-S2-084 | text | visible-default | "Tekanan" | FN-M17-3.3.7 |
| EL-M17-S2-085 | text | visible-default | "91" | FN-M17-3.3.7 |
| EL-M17-S2-086 | text | visible-default | "Pembetulan" | FN-M17-3.3.8 |
| EL-M17-S2-087 | text | visible-default | "🔄" | FN-M17-3.3.8 |
| EL-M17-S2-088 | text | visible-default | "899" | FN-M17-3.3.8 |
| EL-M17-S2-089 | text | visible-default | "Rekod" | FN-M17-3.3.8 |
| EL-M17-S2-090 | text | visible-default | "+0.0%" | FN-M17-3.3.8 |
| EL-M17-S2-091 | text | visible-default | "Purata Naik" | FN-M17-3.3.8 |
| EL-M17-S2-092 | text | visible-default | "0%" | FN-M17-3.3.8 |
| EL-M17-S2-093 | text | visible-default | "Kadar Baik" | FN-M17-3.3.8 |
| EL-M17-S2-094 | text | visible-default | "Engagement" | FN-M17-3.3.9 |
| EL-M17-S2-095 | text | visible-default | "📊" | FN-M17-3.3.9 |
| EL-M17-S2-096 | text | visible-default | "Champion" | FN-M17-3.3.9 |
| EL-M17-S2-097 | text | visible-default | "29" | FN-M17-3.3.9 |
| EL-M17-S2-098 | text | visible-default | "Konsisten" | FN-M17-3.3.9 |
| EL-M17-S2-099 | text | visible-default | "11" | FN-M17-3.3.9 |
| EL-M17-S2-100 | text | visible-default | "Berkembang" | FN-M17-3.3.9 |
| EL-M17-S2-101 | text | visible-default | "43" | FN-M17-3.3.9 |
| EL-M17-S2-102 | text | visible-default | "Minimum" | FN-M17-3.3.9 |
| EL-M17-S2-103 | text | visible-default | "3" | FN-M17-3.3.9 |
| EL-M17-S2-104 | text | visible-default | "Disengaged" | FN-M17-3.3.9 |
| EL-M17-S2-105 | text | visible-default | "2,229" | FN-M17-3.3.9 |
| EL-M17-S2-106 | text | visible-default | "Powered by ALESA AI · PrestasiPlus © 2026 · Dijana automatik · Data dikemaskini " | FN-M17-3.1.3 |
| EL-M17-S2-107 | text | hidden-only | "12:20:49" | FN-M17-3.1.1 |
| EL-M17-S2-108 | text | conditional | "12:20:54" | FN-M17-3.1.1 |

#### S3 — `/admin/command-center/daily-activity` (376 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M17-S3-001 | heading | visible-default | "⚡ AKTIVITI PLATFORM" | FN-M17-4.1.1 |
| EL-M17-S3-002 | link | visible-default | "◀ Command Center", → /admin/command-center | FN-M17-4.1.1 |
| EL-M17-S3-003 | link | visible-default | "Laporan Eksekutif", → /admin/laporan-eksekutif | FN-M17-4.1.1 |
| EL-M17-S3-004 | text | visible-default | "MYT" | FN-M17-4.1.1 |
| EL-M17-S3-005 | text | visible-default | "12:21:02" | FN-M17-4.1.1 |
| EL-M17-S3-006 | clickable | visible-default | "📅 Hari Ini" | FN-M17-4.1.2 |
| EL-M17-S3-007 | clickable | visible-default | "📆 Minggu Ini" | FN-M17-4.1.2 |
| EL-M17-S3-008 | clickable | visible-default | "🗓️ Bulan Ini" | FN-M17-4.1.2 |
| EL-M17-S3-009 | text | visible-default | "🏫" | FN-M17-4.2.1 |
| EL-M17-S3-010 | text | visible-default | "Sekolah Aktif" | FN-M17-4.2.1 |
| EL-M17-S3-011 | text | visible-default | "1" | FN-M17-4.2.1 |
| EL-M17-S3-012 | text | visible-default | "daripada" | FN-M17-4.2.1 |
| EL-M17-S3-013 | text | visible-default | "9" | FN-M17-4.2.1 |
| EL-M17-S3-014 | text | visible-default | "👤" | FN-M17-4.2.2 |
| EL-M17-S3-015 | text | visible-default | "Login Hari Ini" | FN-M17-4.2.2 |
| EL-M17-S3-016 | text | visible-default | "2" | FN-M17-4.2.2 |
| EL-M17-S3-017 | text | visible-default | "student: · admin:" | FN-M17-4.2.2 |
| EL-M17-S3-018 | text | visible-default | "1" | FN-M17-4.2.2 |
| EL-M17-S3-019 | text | visible-default | "1" | FN-M17-4.2.2 |
| EL-M17-S3-020 | text | visible-default | "🎓" | FN-M17-4.2.3 |
| EL-M17-S3-021 | text | visible-default | "Pelajar Aktif" | FN-M17-4.2.3 |
| EL-M17-S3-022 | text | visible-default | "1" | FN-M17-4.2.3 |
| EL-M17-S3-023 | text | visible-default | "daripada" | FN-M17-4.2.3 |
| EL-M17-S3-024 | text | visible-default | "3,152" | FN-M17-4.2.3 |
| EL-M17-S3-025 | text | visible-default | "📝" | FN-M17-4.2.4 |
| EL-M17-S3-026 | text | visible-default | "Soalan Dijawab" | FN-M17-4.2.4 |
| EL-M17-S3-027 | text | visible-default | "60" | FN-M17-4.2.4 |
| EL-M17-S3-028 | text | visible-default | "Ketepatan: %" | FN-M17-4.2.4 |
| EL-M17-S3-029 | text | visible-default | "95" | FN-M17-4.2.4 |
| EL-M17-S3-030 | text | visible-default | "🕐" | FN-M17-4.2.5 |
| EL-M17-S3-031 | text | visible-default | "Sesi Latihan" | FN-M17-4.2.5 |
| EL-M17-S3-032 | text | visible-default | "3/3" | FN-M17-4.2.5 |
| EL-M17-S3-033 | text | visible-default | "Purata:" | FN-M17-4.2.5 |
| EL-M17-S3-034 | text | visible-default | "1m 0s" | FN-M17-4.2.5 |
| EL-M17-S3-035 | text | visible-default | "🔥" | FN-M17-4.2.6 |
| EL-M17-S3-036 | text | visible-default | "Engagement" | FN-M17-4.2.6 |
| EL-M17-S3-037 | text | visible-default | "0" | FN-M17-4.2.6 |
| EL-M17-S3-038 | text | visible-default | "Mood:0 Badge:0 Misi:0" | FN-M17-4.2.6 |
| EL-M17-S3-039 | text | visible-default | "Sekolah" | FN-M17-4.3.1 |
| EL-M17-S3-040 | clickable | visible-default | "1. SEKOLAH MENENGAH KEBANGSAAN ENGKU HUSAIN 11GURU 1PELAJAR 60SOALAN 95.0%" | FN-M17-4.3.1 |
| EL-M17-S3-041 | clickable | visible-default | "2. SEKOLAH MENENGAH KEBANGSAAN KHIR JOHARI 1LOGIN 0PELAJAR 0SOALAN -%" | FN-M17-4.3.1 |
| EL-M17-S3-042 | text | visible-default | "Subjek" | FN-M17-4.4.1 |
| EL-M17-S3-043 | text | visible-default | "-" | FN-M17-4.4.1 |
| EL-M17-S3-044 | text | visible-default | "Heatmap Jam (Hari Ini)" | FN-M17-4.4.2 |
| EL-M17-S3-045 | text | hidden-only | "0:00 — 0 soalan" | FN-M17-4.4.2 |
| EL-M17-S3-046 | text | hidden-only | "1:00 — 0 soalan" | FN-M17-4.4.2 |
| EL-M17-S3-047 | text | hidden-only | "2:00 — 0 soalan" | FN-M17-4.4.2 |
| EL-M17-S3-048 | text | hidden-only | "3:00 — 60 soalan" | FN-M17-4.4.2 |
| EL-M17-S3-049 | text | hidden-only | "4:00 — 0 soalan" | FN-M17-4.4.2 |
| EL-M17-S3-050 | text | hidden-only | "5:00 — 0 soalan" | FN-M17-4.4.2 |
| EL-M17-S3-051 | text | hidden-only | "6:00 — 0 soalan" | FN-M17-4.4.2 |
| EL-M17-S3-052 | text | hidden-only | "7:00 — 0 soalan" | FN-M17-4.4.2 |
| EL-M17-S3-053 | text | hidden-only | "8:00 — 0 soalan" | FN-M17-4.4.2 |
| EL-M17-S3-054 | text | hidden-only | "9:00 — 0 soalan" | FN-M17-4.4.2 |
| EL-M17-S3-055 | text | hidden-only | "10:00 — 0 soalan" | FN-M17-4.4.2 |
| EL-M17-S3-056 | text | hidden-only | "11:00 — 0 soalan" | FN-M17-4.4.2 |
| EL-M17-S3-057 | text | hidden-only | "12:00 — 0 soalan" | FN-M17-4.4.2 |
| EL-M17-S3-058 | text | hidden-only | "13:00 — 0 soalan" | FN-M17-4.4.2 |
| EL-M17-S3-059 | text | hidden-only | "14:00 — 0 soalan" | FN-M17-4.4.2 |
| EL-M17-S3-060 | text | hidden-only | "15:00 — 0 soalan" | FN-M17-4.4.2 |
| EL-M17-S3-061 | text | hidden-only | "16:00 — 0 soalan" | FN-M17-4.4.2 |
| EL-M17-S3-062 | text | hidden-only | "17:00 — 0 soalan" | FN-M17-4.4.2 |
| EL-M17-S3-063 | text | hidden-only | "18:00 — 0 soalan" | FN-M17-4.4.2 |
| EL-M17-S3-064 | text | hidden-only | "19:00 — 0 soalan" | FN-M17-4.4.2 |
| EL-M17-S3-065 | text | hidden-only | "20:00 — 0 soalan" | FN-M17-4.4.2 |
| EL-M17-S3-066 | text | hidden-only | "21:00 — 0 soalan" | FN-M17-4.4.2 |
| EL-M17-S3-067 | text | hidden-only | "22:00 — 0 soalan" | FN-M17-4.4.2 |
| EL-M17-S3-068 | text | hidden-only | "23:00 — 0 soalan" | FN-M17-4.4.2 |
| EL-M17-S3-069 | text | visible-default | "Live Feed" | FN-M17-4.4.3 |
| EL-M17-S3-070 | empty-state | visible-default | "Tiada aktiviti" | FN-M17-4.4.3 |
| EL-M17-S3-071 | text | visible-default | "Login Terkini" | FN-M17-4.4.4 |
| EL-M17-S3-072 | text | visible-default | "admin" | FN-M17-4.4.4 |
| EL-M17-S3-073 | text | visible-default | "ADMIN" | FN-M17-4.4.4 |
| EL-M17-S3-074 | text | visible-default | "11 minit yang lepas" | FN-M17-4.4.4 |
| EL-M17-S3-075 | text | visible-default | "student" | FN-M17-4.4.4 |
| EL-M17-S3-076 | link | hidden-only | link, → /admin/command-center/student/{id} | FN-M17-4.4.4 |
| EL-M17-S3-077 | text | visible-default | "SEKOLAH MENENGAH KEBANGSAAN KHIR JOHARI" | FN-M17-4.4.4 |
| EL-M17-S3-078 | text | visible-default | "SEKOLAH" | FN-M17-4.4.4 |
| EL-M17-S3-079 | text | visible-default | "2 jam yang lepas" | FN-M17-4.4.4 |
| EL-M17-S3-080 | text | visible-default | "Top Pelajar" | FN-M17-4.4.5 |
| EL-M17-S3-081 | text | visible-default | "1" | FN-M17-4.4.5 |
| EL-M17-S3-082 | link | hidden-only | link, → /admin/command-center/student/{id} | FN-M17-4.4.5 |
| EL-M17-S3-083 | text | visible-default | "SEKOLAH MENENGAH KEBANGSAAN ENGKU HUSAIN" | FN-M17-4.4.5 |
| EL-M17-S3-084 | text | visible-default | "60 jwb" | FN-M17-4.4.5 |
| EL-M17-S3-085 | text | visible-default | "95.0%" | FN-M17-4.4.5 |
| EL-M17-S3-086 | text | visible-default | "Mood Pelajar" | FN-M17-4.4.6 |
| EL-M17-S3-087 | empty-state | visible-default | "Tiada data" | FN-M17-4.4.6 |
| EL-M17-S3-088 | text | visible-default | "Badge Terkini" | FN-M17-4.4.7 |
| EL-M17-S3-089 | empty-state | visible-default | "Tiada badge baru" | FN-M17-4.4.7 |
| EL-M17-S3-090 | text | conditional | "12:21:41" | FN-M17-4.1.1 |
| EL-M17-S3-091 | text | conditional | "👨‍🏫 Guru Aktif (11)" | FN-M17-4.3.2 |
| EL-M17-S3-092 | link | hidden-only | link, → /admin/command-center/school/8082/teacher/{id} | FN-M17-4.3.2 |
| EL-M17-S3-093 | text | conditional | "1 pelajar" | FN-M17-4.3.2 |
| EL-M17-S3-094 | text | conditional | "49 minit yang lepas" | FN-M17-4.3.2 |
| EL-M17-S3-095 | link | hidden-only | link, → /admin/command-center/school/8082/teacher/{id} | FN-M17-4.3.2 |
| EL-M17-S3-096 | text | conditional | "1 pelajar" | FN-M17-4.3.2 |
| EL-M17-S3-097 | text | conditional | "95.0%" | FN-M17-4.3.2 |
| EL-M17-S3-098 | text | conditional | "49 minit yang lepas" | FN-M17-4.3.2 |
| EL-M17-S3-099 | link | hidden-only | link, → /admin/command-center/school/8082/teacher/{id} | FN-M17-4.3.2 |
| EL-M17-S3-100 | text | conditional | "1 pelajar" | FN-M17-4.3.2 |
| EL-M17-S3-101 | text | conditional | "95.0%" | FN-M17-4.3.2 |
| EL-M17-S3-102 | text | conditional | "49 minit yang lepas" | FN-M17-4.3.2 |
| EL-M17-S3-103 | link | hidden-only | link, → /admin/command-center/school/8082/teacher/{id} | FN-M17-4.3.2 |
| EL-M17-S3-104 | text | conditional | "1 pelajar" | FN-M17-4.3.2 |
| EL-M17-S3-105 | text | conditional | "95.0%" | FN-M17-4.3.2 |
| EL-M17-S3-106 | text | conditional | "49 minit yang lepas" | FN-M17-4.3.2 |
| EL-M17-S3-107 | link | hidden-only | link, → /admin/command-center/school/8082/teacher/{id} | FN-M17-4.3.2 |
| EL-M17-S3-108 | text | conditional | "1 pelajar" | FN-M17-4.3.2 |
| EL-M17-S3-109 | text | conditional | "95.0%" | FN-M17-4.3.2 |
| EL-M17-S3-110 | text | conditional | "49 minit yang lepas" | FN-M17-4.3.2 |
| EL-M17-S3-111 | link | hidden-only | link, → /admin/command-center/school/8082/teacher/{id} | FN-M17-4.3.2 |
| EL-M17-S3-112 | text | conditional | "1 pelajar" | FN-M17-4.3.2 |
| EL-M17-S3-113 | text | conditional | "95.0%" | FN-M17-4.3.2 |
| EL-M17-S3-114 | text | conditional | "49 minit yang lepas" | FN-M17-4.3.2 |
| EL-M17-S3-115 | link | hidden-only | link, → /admin/command-center/school/8082/teacher/{id} | FN-M17-4.3.2 |
| EL-M17-S3-116 | text | conditional | "1 pelajar" | FN-M17-4.3.2 |
| EL-M17-S3-117 | text | conditional | "95.0%" | FN-M17-4.3.2 |
| EL-M17-S3-118 | text | conditional | "49 minit yang lepas" | FN-M17-4.3.2 |
| EL-M17-S3-119 | link | hidden-only | link, → /admin/command-center/school/8082/teacher/{id} | FN-M17-4.3.2 |
| EL-M17-S3-120 | text | conditional | "1 pelajar" | FN-M17-4.3.2 |
| EL-M17-S3-121 | text | conditional | "95.0%" | FN-M17-4.3.2 |
| EL-M17-S3-122 | text | conditional | "49 minit yang lepas" | FN-M17-4.3.2 |
| EL-M17-S3-123 | link | hidden-only | link, → /admin/command-center/school/8082/teacher/{id} | FN-M17-4.3.2 |
| EL-M17-S3-124 | text | conditional | "1 pelajar" | FN-M17-4.3.2 |
| EL-M17-S3-125 | text | conditional | "95.0%" | FN-M17-4.3.2 |
| EL-M17-S3-126 | text | conditional | "49 minit yang lepas" | FN-M17-4.3.2 |
| EL-M17-S3-127 | link | hidden-only | link, → /admin/command-center/school/8082/teacher/{id} | FN-M17-4.3.2 |
| EL-M17-S3-128 | text | conditional | "1 pelajar" | FN-M17-4.3.2 |
| EL-M17-S3-129 | text | conditional | "95.0%" | FN-M17-4.3.2 |
| EL-M17-S3-130 | text | conditional | "49 minit yang lepas" | FN-M17-4.3.2 |
| EL-M17-S3-131 | link | hidden-only | link, → /admin/command-center/school/8082/teacher/{id} | FN-M17-4.3.2 |
| EL-M17-S3-132 | text | conditional | "1 pelajar" | FN-M17-4.3.2 |
| EL-M17-S3-133 | text | conditional | "95.0%" | FN-M17-4.3.2 |
| EL-M17-S3-134 | text | conditional | "49 minit yang lepas" | FN-M17-4.3.2 |
| EL-M17-S3-135 | text | conditional | "🎓 Pelajar (1)" | FN-M17-4.3.3 |
| EL-M17-S3-136 | text | conditional | "60 soalan" | FN-M17-4.3.3 |
| EL-M17-S3-137 | text | conditional | "95.0%" | FN-M17-4.3.3 |
| EL-M17-S3-138 | text | conditional | "49 minit yang lepas" | FN-M17-4.3.3 |
| EL-M17-S3-139 | link | conditional | "Lihat penuh →", → /admin/command-center/school/8082 | FN-M17-4.3.5 |
| EL-M17-S3-140 | text | conditional | "12 minit yang lepas" | FN-M17-4.4.4 |
| EL-M17-S3-141 | link | hidden-only | link, → /admin/command-center/student/{id} | FN-M17-4.4.5 |
| EL-M17-S3-142 | text | conditional | "95.0%" | FN-M17-4.4.5 |
| EL-M17-S3-143 | text | conditional | "12:23:24" | FN-M17-4.1.1 |
| EL-M17-S3-144 | text | conditional | "student: · teacher: · parent: · admin: · school_admin:" | FN-M17-4.2.2 |
| EL-M17-S3-145 | text | conditional | "1" | FN-M17-4.2.2 |
| EL-M17-S3-146 | text | conditional | "1" | FN-M17-4.2.2 |
| EL-M17-S3-147 | text | conditional | "5" | FN-M17-4.2.2 |
| EL-M17-S3-148 | text | conditional | "1,258/1,258" | FN-M17-4.2.5 |
| EL-M17-S3-149 | text | conditional | "1m 54s" | FN-M17-4.2.5 |
| EL-M17-S3-150 | text | conditional | "Mood:0 Badge:0 Misi:8" | FN-M17-4.2.6 |
| EL-M17-S3-151 | clickable | conditional | "1. SEKOLAH MENENGAH KEBANGSAAN BANDAR RINCHING 18GURU 23PELAJAR 5,479SOALAN 82.9" | FN-M17-4.3.1 |
| EL-M17-S3-152 | text | conditional | "👨‍🏫 Guru Aktif (18)" | FN-M17-4.3.2 |
| EL-M17-S3-153 | text | conditional | "9 pelajar" | FN-M17-4.3.2 |
| EL-M17-S3-154 | text | conditional | "80.2%" | FN-M17-4.3.2 |
| EL-M17-S3-155 | text | conditional | "2 hari yang lepas" | FN-M17-4.3.2 |
| EL-M17-S3-156 | text | conditional | "9 pelajar" | FN-M17-4.3.2 |
| EL-M17-S3-157 | text | conditional | "81.3%" | FN-M17-4.3.2 |
| EL-M17-S3-158 | text | conditional | "15 jam yang lepas" | FN-M17-4.3.2 |
| EL-M17-S3-159 | text | conditional | "7 pelajar" | FN-M17-4.3.2 |
| EL-M17-S3-160 | text | conditional | "87.1%" | FN-M17-4.3.2 |
| EL-M17-S3-161 | text | conditional | "14 jam yang lepas" | FN-M17-4.3.2 |
| EL-M17-S3-162 | text | conditional | "7 pelajar" | FN-M17-4.3.2 |
| EL-M17-S3-163 | text | conditional | "87.1%" | FN-M17-4.3.2 |
| EL-M17-S3-164 | text | conditional | "14 jam yang lepas" | FN-M17-4.3.2 |
| EL-M17-S3-165 | text | conditional | "6 pelajar" | FN-M17-4.3.2 |
| EL-M17-S3-166 | text | conditional | "76.2%" | FN-M17-4.3.2 |
| EL-M17-S3-167 | text | conditional | "14 jam yang lepas" | FN-M17-4.3.2 |
| EL-M17-S3-168 | text | conditional | "5 pelajar" | FN-M17-4.3.2 |
| EL-M17-S3-169 | text | conditional | "82.6%" | FN-M17-4.3.2 |
| EL-M17-S3-170 | text | conditional | "2 hari yang lepas" | FN-M17-4.3.2 |
| EL-M17-S3-171 | text | conditional | "5 pelajar" | FN-M17-4.3.2 |
| EL-M17-S3-172 | text | conditional | "82.6%" | FN-M17-4.3.2 |
| EL-M17-S3-173 | text | conditional | "2 hari yang lepas" | FN-M17-4.3.2 |
| EL-M17-S3-174 | text | conditional | "5 pelajar" | FN-M17-4.3.2 |
| EL-M17-S3-175 | text | conditional | "82.6%" | FN-M17-4.3.2 |
| EL-M17-S3-176 | text | conditional | "2 hari yang lepas" | FN-M17-4.3.2 |
| EL-M17-S3-177 | text | conditional | "4 pelajar" | FN-M17-4.3.2 |
| EL-M17-S3-178 | text | conditional | "89.0%" | FN-M17-4.3.2 |
| EL-M17-S3-179 | text | conditional | "14 jam yang lepas" | FN-M17-4.3.2 |
| EL-M17-S3-180 | text | conditional | "4 pelajar" | FN-M17-4.3.2 |
| EL-M17-S3-181 | text | conditional | "74.2%" | FN-M17-4.3.2 |
| EL-M17-S3-182 | text | conditional | "15 jam yang lepas" | FN-M17-4.3.2 |
| EL-M17-S3-183 | text | conditional | "3 pelajar" | FN-M17-4.3.2 |
| EL-M17-S3-184 | text | conditional | "80.5%" | FN-M17-4.3.2 |
| EL-M17-S3-185 | text | conditional | "14 jam yang lepas" | FN-M17-4.3.2 |
| EL-M17-S3-186 | link | hidden-only | link, → /admin/command-center/school/8106/teacher/{id} | FN-M17-4.3.2 |
| EL-M17-S3-187 | text | conditional | "3 pelajar" | FN-M17-4.3.2 |
| EL-M17-S3-188 | text | conditional | "71.2%" | FN-M17-4.3.2 |
| EL-M17-S3-189 | text | conditional | "15 jam yang lepas" | FN-M17-4.3.2 |
| EL-M17-S3-190 | link | hidden-only | link, → /admin/command-center/school/8106/teacher/{id} | FN-M17-4.3.2 |
| EL-M17-S3-191 | text | conditional | "3 pelajar" | FN-M17-4.3.2 |
| EL-M17-S3-192 | text | conditional | "79.1%" | FN-M17-4.3.2 |
| EL-M17-S3-193 | text | conditional | "3 hari yang lepas" | FN-M17-4.3.2 |
| EL-M17-S3-194 | link | hidden-only | link, → /admin/command-center/school/8106/teacher/{id} | FN-M17-4.3.2 |
| EL-M17-S3-195 | text | conditional | "2 pelajar" | FN-M17-4.3.2 |
| EL-M17-S3-196 | text | conditional | "71.4%" | FN-M17-4.3.2 |
| EL-M17-S3-197 | text | conditional | "14 jam yang lepas" | FN-M17-4.3.2 |
| EL-M17-S3-198 | link | hidden-only | link, → /admin/command-center/school/8106/teacher/{id} | FN-M17-4.3.2 |
| EL-M17-S3-199 | text | conditional | "60.0%" | FN-M17-4.3.2 |
| EL-M17-S3-200 | text | conditional | "3 hari yang lepas" | FN-M17-4.3.2 |
| EL-M17-S3-201 | link | hidden-only | link, → /admin/command-center/school/8106/teacher/{id} | FN-M17-4.3.2 |
| EL-M17-S3-202 | text | conditional | "82.5%" | FN-M17-4.3.2 |
| EL-M17-S3-203 | text | conditional | "3 hari yang lepas" | FN-M17-4.3.2 |
| EL-M17-S3-204 | link | hidden-only | link, → /admin/command-center/school/8106/teacher/{id} | FN-M17-4.3.2 |
| EL-M17-S3-205 | text | conditional | "60.0%" | FN-M17-4.3.2 |
| EL-M17-S3-206 | text | conditional | "2 minggu yang lepas" | FN-M17-4.3.2 |
| EL-M17-S3-207 | link | hidden-only | link, → /admin/command-center/school/8106/teacher/{id} | FN-M17-4.3.2 |
| EL-M17-S3-208 | text | conditional | "82.5%" | FN-M17-4.3.2 |
| EL-M17-S3-209 | text | conditional | "3 hari yang lepas" | FN-M17-4.3.2 |
| EL-M17-S3-210 | text | conditional | "🎓 Pelajar (23)" | FN-M17-4.3.3 |
| EL-M17-S3-211 | text | conditional | "1,761 soalan" | FN-M17-4.3.3 |
| EL-M17-S3-212 | text | conditional | "89.8%" | FN-M17-4.3.3 |
| EL-M17-S3-213 | text | conditional | "14 jam yang lepas" | FN-M17-4.3.3 |
| EL-M17-S3-214 | text | conditional | "1,179 soalan" | FN-M17-4.3.3 |
| EL-M17-S3-215 | text | conditional | "87.9%" | FN-M17-4.3.3 |
| EL-M17-S3-216 | text | conditional | "4 hari yang lepas" | FN-M17-4.3.3 |
| EL-M17-S3-217 | text | conditional | "1,091 soalan" | FN-M17-4.3.3 |
| EL-M17-S3-218 | text | conditional | "77.2%" | FN-M17-4.3.3 |
| EL-M17-S3-219 | text | conditional | "6 hari yang lepas" | FN-M17-4.3.3 |
| EL-M17-S3-220 | link | hidden-only | link, → /admin/command-center/student/{id} | FN-M17-4.3.3 |
| EL-M17-S3-221 | text | conditional | "687 soalan" | FN-M17-4.3.3 |
| EL-M17-S3-222 | text | conditional | "74.2%" | FN-M17-4.3.3 |
| EL-M17-S3-223 | text | conditional | "4 hari yang lepas" | FN-M17-4.3.3 |
| EL-M17-S3-224 | link | hidden-only | link, → /admin/command-center/student/{id} | FN-M17-4.3.3 |
| EL-M17-S3-225 | text | conditional | "135 soalan" | FN-M17-4.3.3 |
| EL-M17-S3-226 | text | conditional | "67.4%" | FN-M17-4.3.3 |
| EL-M17-S3-227 | text | conditional | "15 jam yang lepas" | FN-M17-4.3.3 |
| EL-M17-S3-228 | link | hidden-only | link, → /admin/command-center/student/{id} | FN-M17-4.3.3 |
| EL-M17-S3-229 | text | conditional | "84 soalan" | FN-M17-4.3.3 |
| EL-M17-S3-230 | text | conditional | "82.1%" | FN-M17-4.3.3 |
| EL-M17-S3-231 | text | conditional | "2 minggu yang lepas" | FN-M17-4.3.3 |
| EL-M17-S3-232 | link | hidden-only | link, → /admin/command-center/student/{id} | FN-M17-4.3.3 |
| EL-M17-S3-233 | text | conditional | "80 soalan" | FN-M17-4.3.3 |
| EL-M17-S3-234 | text | conditional | "82.5%" | FN-M17-4.3.3 |
| EL-M17-S3-235 | text | conditional | "3 hari yang lepas" | FN-M17-4.3.3 |
| EL-M17-S3-236 | link | hidden-only | link, → /admin/command-center/student/{id} | FN-M17-4.3.3 |
| EL-M17-S3-237 | text | conditional | "65 soalan" | FN-M17-4.3.3 |
| EL-M17-S3-238 | text | conditional | "76.9%" | FN-M17-4.3.3 |
| EL-M17-S3-239 | text | conditional | "1 minggu yang lepas" | FN-M17-4.3.3 |
| EL-M17-S3-240 | link | hidden-only | link, → /admin/command-center/student/{id} | FN-M17-4.3.3 |
| EL-M17-S3-241 | text | conditional | "78.3%" | FN-M17-4.3.3 |
| EL-M17-S3-242 | text | conditional | "3 minggu yang lepas" | FN-M17-4.3.3 |
| EL-M17-S3-243 | link | hidden-only | link, → /admin/command-center/student/{id} | FN-M17-4.3.3 |
| EL-M17-S3-244 | text | conditional | "40 soalan" | FN-M17-4.3.3 |
| EL-M17-S3-245 | text | conditional | "100.0%" | FN-M17-4.3.3 |
| EL-M17-S3-246 | text | conditional | "2 minggu yang lepas" | FN-M17-4.3.3 |
| EL-M17-S3-247 | link | hidden-only | link, → /admin/command-center/student/{id} | FN-M17-4.3.3 |
| EL-M17-S3-248 | text | conditional | "40 soalan" | FN-M17-4.3.3 |
| EL-M17-S3-249 | text | conditional | "65.0%" | FN-M17-4.3.3 |
| EL-M17-S3-250 | text | conditional | "2 hari yang lepas" | FN-M17-4.3.3 |
| EL-M17-S3-251 | link | hidden-only | link, → /admin/command-center/student/{id} | FN-M17-4.3.3 |
| EL-M17-S3-252 | text | conditional | "40 soalan" | FN-M17-4.3.3 |
| EL-M17-S3-253 | text | conditional | "62.5%" | FN-M17-4.3.3 |
| EL-M17-S3-254 | text | conditional | "5 hari yang lepas" | FN-M17-4.3.3 |
| EL-M17-S3-255 | link | hidden-only | link, → /admin/command-center/student/{id} | FN-M17-4.3.3 |
| EL-M17-S3-256 | text | conditional | "40 soalan" | FN-M17-4.3.3 |
| EL-M17-S3-257 | text | conditional | "77.5%" | FN-M17-4.3.3 |
| EL-M17-S3-258 | text | conditional | "3 hari yang lepas" | FN-M17-4.3.3 |
| EL-M17-S3-259 | link | hidden-only | link, → /admin/command-center/student/{id} | FN-M17-4.3.3 |
| EL-M17-S3-260 | text | conditional | "40 soalan" | FN-M17-4.3.3 |
| EL-M17-S3-261 | text | conditional | "72.5%" | FN-M17-4.3.3 |
| EL-M17-S3-262 | text | conditional | "5 hari yang lepas" | FN-M17-4.3.3 |
| EL-M17-S3-263 | link | hidden-only | link, → /admin/command-center/student/{id} | FN-M17-4.3.3 |
| EL-M17-S3-264 | text | conditional | "27 soalan" | FN-M17-4.3.3 |
| EL-M17-S3-265 | text | conditional | "74.1%" | FN-M17-4.3.3 |
| EL-M17-S3-266 | text | conditional | "4 hari yang lepas" | FN-M17-4.3.3 |
| EL-M17-S3-267 | link | hidden-only | link, → /admin/command-center/student/{id} | FN-M17-4.3.3 |
| EL-M17-S3-268 | text | conditional | "25 soalan" | FN-M17-4.3.3 |
| EL-M17-S3-269 | text | conditional | "64.0%" | FN-M17-4.3.3 |
| EL-M17-S3-270 | text | conditional | "14 jam yang lepas" | FN-M17-4.3.3 |
| EL-M17-S3-271 | link | hidden-only | link, → /admin/command-center/student/{id} | FN-M17-4.3.3 |
| EL-M17-S3-272 | text | conditional | "20 soalan" | FN-M17-4.3.3 |
| EL-M17-S3-273 | text | conditional | "100.0%" | FN-M17-4.3.3 |
| EL-M17-S3-274 | text | conditional | "2 minggu yang lepas" | FN-M17-4.3.3 |
| EL-M17-S3-275 | link | hidden-only | link, → /admin/command-center/student/{id} | FN-M17-4.3.3 |
| EL-M17-S3-276 | text | conditional | "15 soalan" | FN-M17-4.3.3 |
| EL-M17-S3-277 | text | conditional | "46.7%" | FN-M17-4.3.3 |
| EL-M17-S3-278 | text | conditional | "6 hari yang lepas" | FN-M17-4.3.3 |
| EL-M17-S3-279 | link | hidden-only | link, → /admin/command-center/student/{id} | FN-M17-4.3.3 |
| EL-M17-S3-280 | text | conditional | "10 soalan" | FN-M17-4.3.3 |
| EL-M17-S3-281 | text | conditional | "60.0%" | FN-M17-4.3.3 |
| EL-M17-S3-282 | text | conditional | "5 hari yang lepas" | FN-M17-4.3.3 |
| EL-M17-S3-283 | link | hidden-only | link, → /admin/command-center/student/{id} | FN-M17-4.3.3 |
| EL-M17-S3-284 | text | conditional | "10 soalan" | FN-M17-4.3.3 |
| EL-M17-S3-285 | text | conditional | "60.0%" | FN-M17-4.3.3 |
| EL-M17-S3-286 | text | conditional | "2 minggu yang lepas" | FN-M17-4.3.3 |
| EL-M17-S3-287 | link | hidden-only | link, → /admin/command-center/student/{id} | FN-M17-4.3.3 |
| EL-M17-S3-288 | text | conditional | "10 soalan" | FN-M17-4.3.3 |
| EL-M17-S3-289 | text | conditional | "60.0%" | FN-M17-4.3.3 |
| EL-M17-S3-290 | text | conditional | "3 hari yang lepas" | FN-M17-4.3.3 |
| EL-M17-S3-291 | link | hidden-only | link, → /admin/command-center/student/{id} | FN-M17-4.3.3 |
| EL-M17-S3-292 | text | conditional | "10 soalan" | FN-M17-4.3.3 |
| EL-M17-S3-293 | text | conditional | "90.0%" | FN-M17-4.3.3 |
| EL-M17-S3-294 | text | conditional | "2 minggu yang lepas" | FN-M17-4.3.3 |
| EL-M17-S3-295 | link | hidden-only | link, → /admin/command-center/student/{id} | FN-M17-4.3.3 |
| EL-M17-S3-296 | text | conditional | "10 soalan" | FN-M17-4.3.3 |
| EL-M17-S3-297 | text | conditional | "60.0%" | FN-M17-4.3.3 |
| EL-M17-S3-298 | text | conditional | "3 minggu yang lepas" | FN-M17-4.3.3 |
| EL-M17-S3-299 | text | conditional | "👤 Login (20)" | FN-M17-4.3.4 |
| EL-M17-S3-300 | text | conditional | "12 jam yang lepas" | FN-M17-4.3.4 |
| EL-M17-S3-301 | text | conditional | "student" | FN-M17-4.3.4 |
| EL-M17-S3-302 | text | conditional | "3 hari yang lepas" | FN-M17-4.3.4 |
| EL-M17-S3-303 | text | conditional | "student" | FN-M17-4.3.4 |
| EL-M17-S3-304 | text | conditional | "3 hari yang lepas" | FN-M17-4.3.4 |
| EL-M17-S3-305 | text | conditional | "student" | FN-M17-4.3.4 |
| EL-M17-S3-306 | text | conditional | "5 hari yang lepas" | FN-M17-4.3.4 |
| EL-M17-S3-307 | text | conditional | "student" | FN-M17-4.3.4 |
| EL-M17-S3-308 | text | conditional | "5 hari yang lepas" | FN-M17-4.3.4 |
| EL-M17-S3-309 | text | conditional | "student" | FN-M17-4.3.4 |
| EL-M17-S3-310 | text | conditional | "5 hari yang lepas" | FN-M17-4.3.4 |
| EL-M17-S3-311 | text | conditional | "student" | FN-M17-4.3.4 |
| EL-M17-S3-312 | text | conditional | "6 hari yang lepas" | FN-M17-4.3.4 |
| EL-M17-S3-313 | text | conditional | "student" | FN-M17-4.3.4 |
| EL-M17-S3-314 | text | conditional | "6 hari yang lepas" | FN-M17-4.3.4 |
| EL-M17-S3-315 | text | conditional | "student" | FN-M17-4.3.4 |
| EL-M17-S3-316 | text | conditional | "6 hari yang lepas" | FN-M17-4.3.4 |
| EL-M17-S3-317 | text | conditional | "student" | FN-M17-4.3.4 |
| EL-M17-S3-318 | text | conditional | "6 hari yang lepas" | FN-M17-4.3.4 |
| EL-M17-S3-319 | text | conditional | "student" | FN-M17-4.3.4 |
| EL-M17-S3-320 | text | conditional | "6 hari yang lepas" | FN-M17-4.3.4 |
| EL-M17-S3-321 | text | conditional | "student" | FN-M17-4.3.4 |
| EL-M17-S3-322 | text | conditional | "1 minggu yang lepas" | FN-M17-4.3.4 |
| EL-M17-S3-323 | text | conditional | "student" | FN-M17-4.3.4 |
| EL-M17-S3-324 | text | conditional | "1 minggu yang lepas" | FN-M17-4.3.4 |
| EL-M17-S3-325 | text | conditional | "student" | FN-M17-4.3.4 |
| EL-M17-S3-326 | text | conditional | "2 minggu yang lepas" | FN-M17-4.3.4 |
| EL-M17-S3-327 | text | conditional | "student" | FN-M17-4.3.4 |
| EL-M17-S3-328 | text | conditional | "2 minggu yang lepas" | FN-M17-4.3.4 |
| EL-M17-S3-329 | text | conditional | "student" | FN-M17-4.3.4 |
| EL-M17-S3-330 | text | conditional | "2 minggu yang lepas" | FN-M17-4.3.4 |
| EL-M17-S3-331 | text | conditional | "student" | FN-M17-4.3.4 |
| EL-M17-S3-332 | text | conditional | "2 minggu yang lepas" | FN-M17-4.3.4 |
| EL-M17-S3-333 | text | conditional | "student" | FN-M17-4.3.4 |
| EL-M17-S3-334 | text | conditional | "3 minggu yang lepas" | FN-M17-4.3.4 |
| EL-M17-S3-335 | text | conditional | "student" | FN-M17-4.3.4 |
| EL-M17-S3-336 | text | conditional | "3 minggu yang lepas" | FN-M17-4.3.4 |
| EL-M17-S3-337 | text | conditional | "school_admin" | FN-M17-4.3.4 |
| EL-M17-S3-338 | text | conditional | "3 minggu yang lepas" | FN-M17-4.3.4 |
| EL-M17-S3-339 | clickable | conditional | "2. SEKOLAH MENENGAH KEBANGSAAN ENGKU HUSAIN 61GURU 22PELAJAR 8,373SOALAN 90.9%" | FN-M17-4.3.1 |
| EL-M17-S3-340 | clickable | conditional | "3. SEKOLAH MENENGAH KEBANGSAAN KHIR JOHARI 8GURU 16PELAJAR 3,822SOALAN 88.6%" | FN-M17-4.3.1 |
| EL-M17-S3-341 | clickable | conditional | "4. SEKOLAH MENENGAH KEBANGSAAN BANDAR BARU BANGI 37GURU 15PELAJAR 1,436SOALAN 86" | FN-M17-4.3.1 |
| EL-M17-S3-342 | clickable | conditional | "5. SEKOLAH MENENGAH KEBANGSAAN PANDAN INDAH 23GURU 5PELAJAR 837SOALAN 84.6%" | FN-M17-4.3.1 |
| EL-M17-S3-343 | clickable | conditional | "6. SEKOLAH MENENGAH KEBANGSAAN JALAN TIGA 0GURU 1PELAJAR 20SOALAN 75.0%" | FN-M17-4.3.1 |
| EL-M17-S3-344 | clickable | conditional | "7. SAM MUHAMMADIAH 1GURU 1PELAJAR 5SOALAN 60.0%" | FN-M17-4.3.1 |
| EL-M17-S3-345 | clickable | conditional | "8. SEKOLAH KEBANGSAAN JELI (1) 1LOGIN 0PELAJAR 0SOALAN -%" | FN-M17-4.3.1 |
| EL-M17-S3-346 | clickable | conditional | "9. KOLEJ ISLAM SULTAN ALAM SHAH 1LOGIN 0PELAJAR 0SOALAN -%" | FN-M17-4.3.1 |
| EL-M17-S3-347 | clickable | conditional | "10. SMK Leqoe 1LOGIN 0PELAJAR 0SOALAN -%" | FN-M17-4.3.1 |
| EL-M17-S3-348 | text | conditional | "13 minit yang lepas" | FN-M17-4.4.4 |
| EL-M17-S3-349 | text | conditional | "student" | FN-M17-4.4.4 |
| EL-M17-S3-350 | link | hidden-only | link, → /admin/command-center/student/{id} | FN-M17-4.4.5 |
| EL-M17-S3-351 | link | hidden-only | link, → /admin/command-center/student/{id} | FN-M17-4.4.5 |
| EL-M17-S3-352 | text | conditional | "3,637 jwb" | FN-M17-4.4.5 |
| EL-M17-S3-353 | text | conditional | "92.6%" | FN-M17-4.4.5 |
| EL-M17-S3-354 | text | conditional | "2" | FN-M17-4.4.5 |
| EL-M17-S3-355 | link | hidden-only | link, → /admin/command-center/student/{id} | FN-M17-4.4.5 |
| EL-M17-S3-356 | text | conditional | "SEKOLAH MENENGAH KEBANGSAAN ENGKU HUSAIN" | FN-M17-4.4.5 |
| EL-M17-S3-357 | text | conditional | "2,968 jwb" | FN-M17-4.4.5 |
| EL-M17-S3-358 | text | conditional | "99.1%" | FN-M17-4.4.5 |
| EL-M17-S3-359 | text | conditional | "12:21:28" | FN-M17-4.1.1 |
| EL-M17-S3-360 | text | conditional | "12:22:11" | FN-M17-4.1.1 |
| EL-M17-S3-361 | text | conditional | "12:21:14" | FN-M17-4.1.1 |
| EL-M17-S3-362 | text | conditional | "12:22:22" | FN-M17-4.1.1 |
| EL-M17-S3-363 | text | conditional | "12:22:48" | FN-M17-4.1.1 |
| EL-M17-S3-364 | text | conditional | "12:22:34" | FN-M17-4.1.1 |
| EL-M17-S3-365 | text | conditional | "50 minit yang lepas" | FN-M17-4.4.4 |
| EL-M17-S3-366 | text | conditional | "50 minit yang lepas" | FN-M17-4.4.4 |
| EL-M17-S3-367 | text | conditional | "50 minit yang lepas" | FN-M17-4.4.4 |
| EL-M17-S3-368 | text | conditional | "50 minit yang lepas" | FN-M17-4.4.4 |
| EL-M17-S3-369 | text | conditional | "50 minit yang lepas" | FN-M17-4.4.4 |
| EL-M17-S3-370 | text | conditional | "50 minit yang lepas" | FN-M17-4.4.4 |
| EL-M17-S3-371 | text | conditional | "50 minit yang lepas" | FN-M17-4.4.4 |
| EL-M17-S3-372 | text | conditional | "50 minit yang lepas" | FN-M17-4.4.4 |
| EL-M17-S3-373 | text | conditional | "50 minit yang lepas" | FN-M17-4.4.4 |
| EL-M17-S3-374 | text | conditional | "50 minit yang lepas" | FN-M17-4.4.4 |
| EL-M17-S3-375 | text | conditional | "50 minit yang lepas" | FN-M17-4.4.4 |
| EL-M17-S3-376 | text | conditional | "50 minit yang lepas" | FN-M17-4.4.4 |

#### S4 — `/admin/command-center/school/{id}` (29 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M17-S4-001 | heading | visible-default | "PrestasiPlus Command Center" | FN-M17-5.1.1 |
| EL-M17-S4-002 | link | visible-default | "← Kembali ke Overview", → /admin/command-center | FN-M17-5.1.1 |
| EL-M17-S4-003 | link | visible-default | "Command Center", → /admin/command-center | FN-M17-5.1.1 |
| EL-M17-S4-004 | text | visible-default | "▸" | FN-M17-5.1.1 |
| EL-M17-S4-005 | text | visible-default | "SEKOLAH MENENGAH KEBANGSAAN ENGKU HUSAIN" | FN-M17-5.1.1 |
| EL-M17-S4-006 | text | visible-default | "Jumlah Pelajar" | FN-M17-5.1.2 |
| EL-M17-S4-007 | text | visible-default | "549" | FN-M17-5.1.2 |
| EL-M17-S4-008 | text | visible-default | "Pelajar Aktif" | FN-M17-5.1.2 |
| EL-M17-S4-009 | text | visible-default | "392" | FN-M17-5.1.2 |
| EL-M17-S4-010 | text | visible-default | "Jumlah Jawapan" | FN-M17-5.1.2 |
| EL-M17-S4-011 | text | visible-default | "130,077" | FN-M17-5.1.2 |
| EL-M17-S4-012 | text | visible-default | "Ketepatan" | FN-M17-5.1.2 |
| EL-M17-S4-013 | text | visible-default | "82.3%" | FN-M17-5.1.2 |
| EL-M17-S4-014 | text | visible-default | "Senarai Guru (68)" | FN-M17-5.1.3 |
| EL-M17-S4-015 | text | visible-default | "👤" | FN-M17-5.1.3 |
| EL-M17-S4-016 | table | visible-default | table | FN-M17-5.1.3 |
| EL-M17-S4-017 | clickable | visible-default | "1 <person> - 0 0 0" | FN-M17-5.1.3 |
| EL-M17-S4-018 | clickable | visible-default | "2 <person> - 0 0 0" | FN-M17-5.1.3 |
| EL-M17-S4-019 | clickable | visible-default | "3 <person> KIMIA 0 0 0" | FN-M17-5.1.3 |
| EL-M17-S4-020 | text | conditional | "🔍" | FN-M17-1.2.3 |
| EL-M17-S4-021 | heading | conditional | "Halaman Tidak Dijumpai" | FN-M17-1.2.3 |
| EL-M17-S4-022 | text | conditional | "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL sal" | FN-M17-1.2.3 |
| EL-M17-S4-023 | link | conditional | "Halaman Utama", → / | FN-M17-1.2.3 |
| EL-M17-S4-024 | link | conditional | "Mula Latihan", → /latih-tubi | FN-M17-1.2.3 |
| EL-M17-S4-025 | text | conditional | "PRESTASIPLUS" | FN-M17-1.2.3 |
| EL-M17-S4-026 | text | conditional | "SEKOLAH MENENGAH KEBANGSAAN KHIR JOHARI" | FN-M17-5.1.1 |
| EL-M17-S4-027 | text | conditional | "81.7%" | FN-M17-5.1.2 |
| EL-M17-S4-028 | text | conditional | "Senarai Guru (34)" | FN-M17-5.1.3 |
| EL-M17-S4-029 | clickable | conditional | "3 <person> - 0 0 0" | FN-M17-5.1.3 |

#### S5 — `/admin/command-center/school/{sid}/teacher/{uid}` (27 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M17-S5-001 | heading | visible-default | "PrestasiPlus Command Center" | FN-M17-5.2.1 |
| EL-M17-S5-002 | link | visible-default | "← Kembali ke Sekolah", → /admin/command-center/school/8080 | FN-M17-5.2.1 |
| EL-M17-S5-003 | link | visible-default | "Command Center", → /admin/command-center | FN-M17-5.2.1 |
| EL-M17-S5-004 | text | visible-default | "▸" | FN-M17-5.2.1 |
| EL-M17-S5-005 | link | visible-default | "SEKOLAH MENENGAH KEBANGSAAN KHIR JOHARI", → /admin/command-center/school/8080 | FN-M17-5.2.1 |
| EL-M17-S5-006 | text | visible-default | "▸" | FN-M17-5.2.1 |
| EL-M17-S5-007 | text | visible-default | "<masked>" | FN-M17-5.2.1 |
| EL-M17-S5-008 | text | visible-default | "Sekolah:" | FN-M17-5.2.1 |
| EL-M17-S5-009 | text | visible-default | "SEKOLAH MENENGAH KEBANGSAAN KHIR JOHARI" | FN-M17-5.2.1 |
| EL-M17-S5-010 | text | visible-default | "Senarai Kelas (7)" | FN-M17-5.2.2 |
| EL-M17-S5-011 | text | visible-default | "📚" | FN-M17-5.2.2 |
| EL-M17-S5-012 | table | visible-default | table | FN-M17-5.2.2 |
| EL-M17-S5-013 | clickable | visible-default | "1 5 SAINS TULEN T5 19 2 5,041 78.4%" | FN-M17-5.2.2 |
| EL-M17-S5-014 | clickable | visible-default | "2 5 KAA T5 15 1 2,188 76.3%" | FN-M17-5.2.2 |
| EL-M17-S5-015 | clickable | visible-default | "3 5 PRINSIP AKAUN T5 33 0 3,024 71.3%" | FN-M17-5.2.2 |
| EL-M17-S5-016 | link | conditional | "SEKOLAH MENENGAH KEBANGSAAN ENGKU HUSAIN", → /admin/command-center/school/8082 | FN-M17-5.2.1 |
| EL-M17-S5-017 | text | conditional | "SEKOLAH MENENGAH KEBANGSAAN ENGKU HUSAIN" | FN-M17-5.2.1 |
| EL-M17-S5-018 | text | conditional | "Senarai Kelas (0)" | FN-M17-5.2.2 |
| EL-M17-S5-019 | text | conditional | "404" | FN-M17-1.2.3 |
| EL-M17-S5-020 | text | conditional | "🔍" | FN-M17-1.2.3 |
| EL-M17-S5-021 | heading | conditional | "Halaman Tidak Dijumpai" | FN-M17-1.2.3 |
| EL-M17-S5-022 | text | conditional | "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL sal" | FN-M17-1.2.3 |
| EL-M17-S5-023 | link | conditional | "Halaman Utama", → / | FN-M17-1.2.3 |
| EL-M17-S5-024 | link | conditional | "Mula Latihan", → /latih-tubi | FN-M17-1.2.3 |
| EL-M17-S5-025 | text | conditional | "PRESTASIPLUS" | FN-M17-1.2.3 |
| EL-M17-S5-026 | text | conditional | "Senarai Kelas (1)" | FN-M17-5.2.2 |
| EL-M17-S5-027 | clickable | conditional | "1 5 CYBER T5 44 5 26,161 85.1%" | FN-M17-5.2.2 |

#### S6 — `/admin/command-center/classroom/{id}` (31 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M17-S6-001 | heading | visible-default | "PrestasiPlus Command Center" | FN-M17-5.3.1 |
| EL-M17-S6-002 | link | visible-default | "← Kembali ke Guru", → /admin/command-center/school/8080/teacher/{id} | FN-M17-5.3.1 |
| EL-M17-S6-003 | link | visible-default | "Command Center", → /admin/command-center | FN-M17-5.3.1 |
| EL-M17-S6-004 | text | visible-default | "▸" | FN-M17-5.3.1 |
| EL-M17-S6-005 | link | visible-default | "SEKOLAH MENENGAH KEBANGSAAN KHIR JOHARI", → /admin/command-center/school/8080 | FN-M17-5.3.1 |
| EL-M17-S6-006 | text | visible-default | "▸" | FN-M17-5.3.1 |
| EL-M17-S6-007 | link | visible-default | "<masked>", → /admin/command-center/school/8080/teacher/{id} | FN-M17-5.3.1 |
| EL-M17-S6-008 | text | visible-default | "▸" | FN-M17-5.3.1 |
| EL-M17-S6-009 | text | visible-default | "5 PERNIAGAAN" | FN-M17-5.3.1 |
| EL-M17-S6-010 | text | visible-default | "Sekolah:" | FN-M17-5.3.1 |
| EL-M17-S6-011 | text | visible-default | "SEKOLAH MENENGAH KEBANGSAAN KHIR JOHARI" | FN-M17-5.3.1 |
| EL-M17-S6-012 | text | visible-default | "Guru:" | FN-M17-5.3.1 |
| EL-M17-S6-013 | text | visible-default | "<masked>" | FN-M17-5.3.1 |
| EL-M17-S6-014 | text | visible-default | "Tahap:" | FN-M17-5.3.1 |
| EL-M17-S6-015 | text | visible-default | "T5" | FN-M17-5.3.1 |
| EL-M17-S6-016 | text | visible-default | "Senarai Pelajar (30)" | FN-M17-5.3.2 |
| EL-M17-S6-017 | text | visible-default | "👤" | FN-M17-5.3.2 |
| EL-M17-S6-018 | table | visible-default | table | FN-M17-5.3.2 |
| EL-M17-S6-019 | clickable | visible-default | "1 <person> 2,378 93.5% 25/09 01:22 Aktif -" | FN-M17-5.3.2 |
| EL-M17-S6-020 | badge | visible-default | "Aktif" | FN-M17-5.3.2 |
| EL-M17-S6-021 | clickable | visible-default | "2 <person> 2,204 73.2% 19/09 13:53 Aktif -" | FN-M17-5.3.2 |
| EL-M17-S6-022 | badge | visible-default | "Aktif" | FN-M17-5.3.2 |
| EL-M17-S6-023 | clickable | visible-default | "3 <person> 1,836 77.8% 10/09 16:19 Tidak Aktif -" | FN-M17-5.3.2 |
| EL-M17-S6-024 | badge | visible-default | "Tidak Aktif" | FN-M17-5.3.2 |
| EL-M17-S6-025 | text | conditional | "404" | FN-M17-1.2.3 |
| EL-M17-S6-026 | text | conditional | "🔍" | FN-M17-1.2.3 |
| EL-M17-S6-027 | heading | conditional | "Halaman Tidak Dijumpai" | FN-M17-1.2.3 |
| EL-M17-S6-028 | text | conditional | "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL sal" | FN-M17-1.2.3 |
| EL-M17-S6-029 | link | conditional | "Halaman Utama", → / | FN-M17-1.2.3 |
| EL-M17-S6-030 | link | conditional | "Mula Latihan", → /latih-tubi | FN-M17-1.2.3 |
| EL-M17-S6-031 | text | conditional | "PRESTASIPLUS" | FN-M17-1.2.3 |

#### S7 — `/admin/command-center/student/{id}` (86 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M17-S7-001 | heading | visible-default | "PrestasiPlus Command Center" | FN-M17-5.4.1 |
| EL-M17-S7-002 | link | visible-default | "← Kembali ke Kelas", → /admin/command-center/classroom/370 | FN-M17-5.4.1 |
| EL-M17-S7-003 | link | visible-default | "Command Center", → /admin/command-center | FN-M17-5.4.1 |
| EL-M17-S7-004 | text | visible-default | "▸" | FN-M17-5.4.1 |
| EL-M17-S7-005 | link | visible-default | "SEKOLAH MENENGAH KEBANGSAAN KHIR JOHARI", → /admin/command-center/school/8080 | FN-M17-5.4.1 |
| EL-M17-S7-006 | text | visible-default | "▸" | FN-M17-5.4.1 |
| EL-M17-S7-007 | link | visible-default | "<masked>", → /admin/command-center/school/8080/teacher/{id} | FN-M17-5.4.1 |
| EL-M17-S7-008 | text | visible-default | "▸" | FN-M17-5.4.1 |
| EL-M17-S7-009 | link | visible-default | "5 PERNIAGAAN", → /admin/command-center/classroom/370 | FN-M17-5.4.1 |
| EL-M17-S7-010 | text | visible-default | "▸" | FN-M17-5.4.1 |
| EL-M17-S7-011 | text | visible-default | "<masked>" | FN-M17-5.4.1 |
| EL-M17-S7-012 | clickable | visible-default | "Jumlah Jawapan 🔍 2,378" | FN-M17-5.4.2 |
| EL-M17-S7-013 | text | visible-default | "Ketepatan" | FN-M17-5.4.2 |
| EL-M17-S7-014 | text | visible-default | "93.5%" | FN-M17-5.4.2 |
| EL-M17-S7-015 | text | visible-default | "Hari Aktif" | FN-M17-5.4.2 |
| EL-M17-S7-016 | text | visible-default | "15" | FN-M17-5.4.2 |
| EL-M17-S7-017 | text | visible-default | "Streak" | FN-M17-5.4.2 |
| EL-M17-S7-018 | text | visible-default | "1" | FN-M17-5.4.2 |
| EL-M17-S7-019 | text | visible-default | "Konsistensi" | FN-M17-5.4.2 |
| EL-M17-S7-020 | text | visible-default | "27%" | FN-M17-5.4.2 |
| EL-M17-S7-021 | text | visible-default | "Pecahan Subjek" | FN-M17-5.4.3 |
| EL-M17-S7-022 | text | visible-default | "📊" | FN-M17-5.4.3 |
| EL-M17-S7-023 | clickable | visible-default | "Latihan Bebas 🔍 93.5% 2223/2378" | FN-M17-5.4.3 |
| EL-M17-S7-024 | text | visible-default | "Aktiviti Mingguan (8 Minggu)" | FN-M17-5.4.4 |
| EL-M17-S7-025 | text | visible-default | "📈" | FN-M17-5.4.4 |
| EL-M17-S7-026 | clickable | visible-default | "0 03/08" | FN-M17-5.4.4 |
| EL-M17-S7-027 | clickable | visible-default | "0 10/08" | FN-M17-5.4.4 |
| EL-M17-S7-028 | clickable | visible-default | "0 17/08" | FN-M17-5.4.4 |
| EL-M17-S7-029 | clickable | visible-default | "0 24/08" | FN-M17-5.4.4 |
| EL-M17-S7-030 | clickable | visible-default | "0 31/08" | FN-M17-5.4.4 |
| EL-M17-S7-031 | clickable | visible-default | "0 07/09" | FN-M17-5.4.4 |
| EL-M17-S7-032 | clickable | visible-default | "1166 14/09" | FN-M17-5.4.4 |
| EL-M17-S7-033 | clickable | visible-default | "452 21/09" | FN-M17-5.4.4 |
| EL-M17-S7-034 | text | visible-default | "Trend Mood (30 Hari)" | FN-M17-5.4.5 |
| EL-M17-S7-035 | text | visible-default | "💚" | FN-M17-5.4.5 |
| EL-M17-S7-036 | empty-state | visible-default | "Tiada data mood" | FN-M17-5.4.5 |
| EL-M17-S7-037 | text | visible-default | "HeadCount" | FN-M17-5.4.6 |
| EL-M17-S7-038 | text | visible-default | "📋" | FN-M17-5.4.6 |
| EL-M17-S7-039 | table | visible-default | table | FN-M17-5.4.6 |
| EL-M17-S7-040 | clickable | visible-default | "Sains 🔍 - - - - 16/06/2026" | FN-M17-5.4.6 |
| EL-M17-S7-041 | clickable | visible-default | "Perniagaan 🔍 40.00 - - - 16/06/2026" | FN-M17-5.4.6 |
| EL-M17-S7-042 | clickable | visible-default | "Matematik 🔍 - - - - 16/06/2026" | FN-M17-5.4.6 |
| EL-M17-S7-043 | text | visible-default | "ALESA AI Insight" | FN-M17-5.4.7 |
| EL-M17-S7-044 | text | visible-default | "🤖" | FN-M17-5.4.7 |
| EL-M17-S7-045 | text | visible-default | "Ketepatan cemerlang (93.5%). Konsistensi rendah (27%) - perlu usaha lebih." | FN-M17-5.4.7 |
| EL-M17-S7-046 | text | visible-default | "Analisis ALESA" | FN-M17-5.4.7 |
| EL-M17-S7-047 | text | visible-default | "Sumber: Rule-based Analysis" | FN-M17-5.4.7 |
| EL-M17-S7-048 | clickable | hidden-only | "× Minggu Memuatkan..." | FN-M17-5.4.8 |
| EL-M17-S7-049 | modal | hidden-only | "Minggu" | FN-M17-5.4.8 |
| EL-M17-S7-050 | button | conditional | "×" | FN-M17-5.4.8 |
| EL-M17-S7-051 | heading | hidden-only | "Minggu" | FN-M17-5.4.8 |
| EL-M17-S7-052 | clickable | hidden-only | "× Sesi Latihan Memuatkan..." | FN-M17-5.4.10 |
| EL-M17-S7-053 | modal | hidden-only | "Sesi Latihan" | FN-M17-5.4.10 |
| EL-M17-S7-054 | button | conditional | "×" | FN-M17-5.4.10 |
| EL-M17-S7-055 | heading | hidden-only | "Sesi Latihan" | FN-M17-5.4.10 |
| EL-M17-S7-056 | clickable | conditional | "× Semua Sesi Latihan 2372Jawapan123Sesi93.7%Ketepatan141mJumlah Masa TarikhSubje" | FN-M17-5.4.8 |
| EL-M17-S7-057 | modal | conditional | "Semua Sesi Latihan" | FN-M17-5.4.8 |
| EL-M17-S7-058 | heading | conditional | "Semua Sesi Latihan" | FN-M17-5.4.8 |
| EL-M17-S7-059 | table | conditional | table | FN-M17-5.4.8 |
| EL-M17-S7-060 | clickable | conditional | "04/05 03:13Umum10 🔍880.00%0m" | FN-M17-5.4.8 |
| EL-M17-S7-061 | clickable | conditional | "06/05 04:53Umum20 🔍630.00%2m" | FN-M17-5.4.8 |
| EL-M17-S7-062 | clickable | conditional | "20/05 07:28Umum10 🔍550.00%0m" | FN-M17-5.4.8 |
| EL-M17-S7-063 | clickable | conditional | "× HeadCount: Perniagaan 30Pelajar29.7Purata TOV0Purata ETR0%Kadar Lulus #Pelajar" | FN-M17-5.4.9 |
| EL-M17-S7-064 | modal | conditional | "HeadCount: Perniagaan" | FN-M17-5.4.9 |
| EL-M17-S7-065 | heading | conditional | "HeadCount: Perniagaan" | FN-M17-5.4.9 |
| EL-M17-S7-066 | text | conditional | "🔍" | FN-M17-1.2.3 |
| EL-M17-S7-067 | heading | conditional | "Halaman Tidak Dijumpai" | FN-M17-1.2.3 |
| EL-M17-S7-068 | text | conditional | "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL sal" | FN-M17-1.2.3 |
| EL-M17-S7-069 | link | conditional | "Halaman Utama", → / | FN-M17-1.2.3 |
| EL-M17-S7-070 | link | conditional | "Mula Latihan", → /latih-tubi | FN-M17-1.2.3 |
| EL-M17-S7-071 | text | conditional | "PRESTASIPLUS" | FN-M17-1.2.3 |
| EL-M17-S7-072 | clickable | conditional | "× Latihan Bebas — Latihan Bebas 04/05/2026 03:13 \| Kesukaran: - \| Masa: 0m 23s 1" | FN-M17-5.4.10 |
| EL-M17-S7-073 | modal | conditional | "Latihan Bebas — Latihan Bebas" | FN-M17-5.4.10 |
| EL-M17-S7-074 | heading | conditional | "Latihan Bebas — Latihan Bebas" | FN-M17-5.4.10 |
| EL-M17-S7-075 | clickable | conditional | "× Latihan Bebas — Semua Sesi 2372Jawapan123Sesi93.7%Ketepatan141mMasa TarikhTopi" | FN-M17-5.4.8 |
| EL-M17-S7-076 | modal | conditional | "Latihan Bebas — Semua Sesi" | FN-M17-5.4.8 |
| EL-M17-S7-077 | heading | conditional | "Latihan Bebas — Semua Sesi" | FN-M17-5.4.8 |
| EL-M17-S7-078 | clickable | conditional | "25/09 01:21Latihan Bebas20 🔍20100.00%0m" | FN-M17-5.4.8 |
| EL-M17-S7-079 | clickable | conditional | "24/09 04:20Latihan Bebas20 🔍20100.00%0m" | FN-M17-5.4.8 |
| EL-M17-S7-080 | clickable | conditional | "24/09 04:19Latihan Bebas20 🔍20100.00%0m" | FN-M17-5.4.8 |
| EL-M17-S7-081 | clickable | conditional | "× Minggu 21/09 (2026-09-21 ~ 2026-09-27) 452Jawapan23Sesi99.6%Ketepatan14mMasa T" | FN-M17-5.4.8 |
| EL-M17-S7-082 | modal | conditional | "Minggu 21/09 (2026-09-21 ~ 2026-09-27)" | FN-M17-5.4.8 |
| EL-M17-S7-083 | heading | conditional | "Minggu 21/09 (2026-09-21 ~ 2026-09-27)" | FN-M17-5.4.8 |
| EL-M17-S7-084 | clickable | conditional | "21/09 00:36Umum20 🔍20100.00%0m" | FN-M17-5.4.8 |
| EL-M17-S7-085 | clickable | conditional | "21/09 12:06Umum20 🔍20100.00%0m" | FN-M17-5.4.8 |
| EL-M17-S7-086 | clickable | conditional | "21/09 12:07Umum20 🔍20100.00%0m" | FN-M17-5.4.8 |

#### S8 — `/admin/laporan-eksekutif` (327 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M17-S8-001 | heading | visible-default | "Ringkasan Eksekutif 2026" | FN-M17-6.1.1 |
| EL-M17-S8-002 | text | visible-default | "Laporan prestasi keseluruhan platform PrestasiPlus" | FN-M17-6.1.1 |
| EL-M17-S8-003 | form | visible-default | form | FN-M17-6.1.2 |
| EL-M17-S8-004 | hidden-field | hidden-only | "_token" | FN-M17-6.1.2 |
| EL-M17-S8-005 | hidden-field | hidden-only | "year" | FN-M17-6.1.2 |
| EL-M17-S8-006 | button | visible-default | "Refresh", fa-sync-alt | FN-M17-6.1.2 |
| EL-M17-S8-007 | filter | visible-default | "← 2025", → ?year=2025 | FN-M17-6.1.3 |
| EL-M17-S8-008 | card | visible-default | "Jumlah Sekolah" | FN-M17-6.2.1 |
| EL-M17-S8-009 | text | visible-default | "Jumlah Sekolah" | FN-M17-6.2.1 |
| EL-M17-S8-010 | text | visible-default | "57" | FN-M17-6.2.1 |
| EL-M17-S8-011 | text | visible-default | "sekolah aktif" | FN-M17-6.2.1 |
| EL-M17-S8-012 | card | visible-default | "Pelajar Berdaftar" | FN-M17-6.2.1 |
| EL-M17-S8-013 | text | visible-default | "Pelajar Berdaftar" | FN-M17-6.2.1 |
| EL-M17-S8-014 | text | visible-default | "3,152" | FN-M17-6.2.1 |
| EL-M17-S8-015 | text | visible-default | "1,563 aktif 2026" | FN-M17-6.2.1 |
| EL-M17-S8-016 | card | visible-default | "Kadar Penglibatan" | FN-M17-6.2.1 |
| EL-M17-S8-017 | text | visible-default | "Kadar Penglibatan" | FN-M17-6.2.1 |
| EL-M17-S8-018 | text | visible-default | "49.6%" | FN-M17-6.2.1 |
| EL-M17-S8-019 | text | visible-default | "daripada pelajar daftar" | FN-M17-6.2.1 |
| EL-M17-S8-020 | card | visible-default | "Soalan Dijawab" | FN-M17-6.2.1 |
| EL-M17-S8-021 | text | visible-default | "Soalan Dijawab" | FN-M17-6.2.1 |
| EL-M17-S8-022 | text | visible-default | "477,888" | FN-M17-6.2.1 |
| EL-M17-S8-023 | text | visible-default | "sepanjang 2026" | FN-M17-6.2.1 |
| EL-M17-S8-024 | card | visible-default | "Ketepatan" | FN-M17-6.2.2 |
| EL-M17-S8-025 | text | visible-default | "Ketepatan" | FN-M17-6.2.2 |
| EL-M17-S8-026 | text | visible-default | "82.9%" | FN-M17-6.2.2 |
| EL-M17-S8-027 | text | visible-default | "82.8% selepas pembetulan" | FN-M17-6.2.2 |
| EL-M17-S8-028 | card | visible-default | "Guru" | FN-M17-6.2.2 |
| EL-M17-S8-029 | text | visible-default | "Guru" | FN-M17-6.2.2 |
| EL-M17-S8-030 | text | visible-default | "502" | FN-M17-6.2.2 |
| EL-M17-S8-031 | card | visible-default | "Soalan / Pelajar Aktif" | FN-M17-6.2.2 |
| EL-M17-S8-032 | text | visible-default | "Soalan / Pelajar Aktif" | FN-M17-6.2.2 |
| EL-M17-S8-033 | text | visible-default | "305.8" | FN-M17-6.2.2 |
| EL-M17-S8-034 | text | visible-default | "purata kedalaman penggunaan" | FN-M17-6.2.2 |
| EL-M17-S8-035 | card | visible-default | "Sekolah Paling Aktif" | FN-M17-6.2.3 |
| EL-M17-S8-036 | text | visible-default | "Sekolah Paling Aktif" | FN-M17-6.2.3 |
| EL-M17-S8-037 | text | visible-default | "SEKOLAH MENENGAH KEBANGSAAN TINGGI KLUANG" | FN-M17-6.2.3 |
| EL-M17-S8-038 | card | visible-default | "Bulan Paling Aktif" | FN-M17-6.2.3 |
| EL-M17-S8-039 | text | visible-default | "Bulan Paling Aktif" | FN-M17-6.2.3 |
| EL-M17-S8-040 | text | visible-default | "Jun" | FN-M17-6.2.3 |
| EL-M17-S8-041 | card | visible-default | "Trend Penggunaan Bulanan 2026" | FN-M17-6.3.1 |
| EL-M17-S8-042 | heading | visible-default | "Trend Penggunaan Bulanan 2026" | FN-M17-6.3.1 |
| EL-M17-S8-043 | text | visible-default | "5" | FN-M17-6.3.1 |
| EL-M17-S8-044 | text | visible-default | "3p" | FN-M17-6.3.1 |
| EL-M17-S8-045 | text | visible-default | "Jan" | FN-M17-6.3.1 |
| EL-M17-S8-046 | text | visible-default | "1,885" | FN-M17-6.3.1 |
| EL-M17-S8-047 | text | visible-default | "51p" | FN-M17-6.3.1 |
| EL-M17-S8-048 | text | visible-default | "Feb" | FN-M17-6.3.1 |
| EL-M17-S8-049 | text | visible-default | "10,357" | FN-M17-6.3.1 |
| EL-M17-S8-050 | text | visible-default | "48p" | FN-M17-6.3.1 |
| EL-M17-S8-051 | text | visible-default | "Mar" | FN-M17-6.3.1 |
| EL-M17-S8-052 | text | visible-default | "22,762" | FN-M17-6.3.1 |
| EL-M17-S8-053 | text | visible-default | "333p" | FN-M17-6.3.1 |
| EL-M17-S8-054 | text | visible-default | "Apr" | FN-M17-6.3.1 |
| EL-M17-S8-055 | text | visible-default | "143,760" | FN-M17-6.3.1 |
| EL-M17-S8-056 | text | visible-default | "1178p" | FN-M17-6.3.1 |
| EL-M17-S8-057 | text | visible-default | "May" | FN-M17-6.3.1 |
| EL-M17-S8-058 | text | visible-default | "229,467" | FN-M17-6.3.1 |
| EL-M17-S8-059 | text | visible-default | "535p" | FN-M17-6.3.1 |
| EL-M17-S8-060 | text | visible-default | "Jun" | FN-M17-6.3.1 |
| EL-M17-S8-061 | text | visible-default | "32,010" | FN-M17-6.3.1 |
| EL-M17-S8-062 | text | visible-default | "202p" | FN-M17-6.3.1 |
| EL-M17-S8-063 | text | visible-default | "Jul" | FN-M17-6.3.1 |
| EL-M17-S8-064 | text | visible-default | "17,291" | FN-M17-6.3.1 |
| EL-M17-S8-065 | text | visible-default | "80p" | FN-M17-6.3.1 |
| EL-M17-S8-066 | text | visible-default | "Aug" | FN-M17-6.3.1 |
| EL-M17-S8-067 | text | visible-default | "20,351" | FN-M17-6.3.1 |
| EL-M17-S8-068 | text | visible-default | "86p" | FN-M17-6.3.1 |
| EL-M17-S8-069 | text | visible-default | "Sep" | FN-M17-6.3.1 |
| EL-M17-S8-070 | text | visible-default | "Oct" | FN-M17-6.3.1 |
| EL-M17-S8-071 | text | visible-default | "Nov" | FN-M17-6.3.1 |
| EL-M17-S8-072 | text | visible-default | "Dec" | FN-M17-6.3.1 |
| EL-M17-S8-073 | card | visible-default | "Analisis Perbandingan Sekolah" | FN-M17-6.3.2 |
| EL-M17-S8-074 | heading | visible-default | "Analisis Perbandingan Sekolah" | FN-M17-6.3.2 |
| EL-M17-S8-075 | heading | visible-default | "Kadar Penglibatan Pelajar (%)" | FN-M17-6.3.2 |
| EL-M17-S8-076 | text | visible-default | "SEKOLAH MENENGAH KEBANGSAAN JALAN TIGA" | FN-M17-6.3.2 |
| EL-M17-S8-077 | text | visible-default | "100%" | FN-M17-6.3.2 |
| EL-M17-S8-078 | text | visible-default | "SEKOLAH KEBANGSAAN JELI (1)" | FN-M17-6.3.2 |
| EL-M17-S8-079 | text | visible-default | "100%" | FN-M17-6.3.2 |
| EL-M17-S8-080 | text | visible-default | "SEKOLAH KEBANGSAAN TEMAI" | FN-M17-6.3.2 |
| EL-M17-S8-081 | text | visible-default | "100%" | FN-M17-6.3.2 |
| EL-M17-S8-082 | heading | visible-default | "Ketepatan Akhir (%)" | FN-M17-6.3.2 |
| EL-M17-S8-083 | card | visible-default | "Lencana Pencapaian 2026" | FN-M17-6.3.3 |
| EL-M17-S8-084 | heading | visible-default | "Lencana Pencapaian 2026" | FN-M17-6.3.3 |
| EL-M17-S8-085 | text | visible-default | "SEKOLAH MENENGAH KEBANGSAAN TINGGI KLUANG" | FN-M17-6.3.3 |
| EL-M17-S8-086 | badge | visible-default | "★ Paling Aktif" | FN-M17-6.3.3 |
| EL-M17-S8-087 | text | visible-default | "SEKOLAH MENENGAH KEBANGSAAN BANDAR RINCHING" | FN-M17-6.3.3 |
| EL-M17-S8-088 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-089 | text | visible-default | "SEKOLAH MENENGAH KEBANGSAAN BANDAR BARU BANGI" | FN-M17-6.3.3 |
| EL-M17-S8-090 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-091 | text | visible-default | "SEKOLAH MENENGAH KEBANGSAAN ENGKU HUSAIN" | FN-M17-6.3.3 |
| EL-M17-S8-092 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-093 | text | visible-default | "SEKOLAH MENENGAH KEBANGSAAN BANDAR TASIK KESUMA" | FN-M17-6.3.3 |
| EL-M17-S8-094 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-095 | text | visible-default | "SEKOLAH JENIS KEBANGSAAN (CINA) CHONG HWA I" | FN-M17-6.3.3 |
| EL-M17-S8-096 | badge | visible-default | "★ Paling Tepat" | FN-M17-6.3.3 |
| EL-M17-S8-097 | badge | visible-default | "★ Paling Rajin" | FN-M17-6.3.3 |
| EL-M17-S8-098 | text | visible-default | "SEKOLAH MENENGAH KEBANGSAAN KHIR JOHARI" | FN-M17-6.3.3 |
| EL-M17-S8-099 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-100 | text | visible-default | "SEKOLAH MENENGAH KEBANGSAAN PANDAN INDAH" | FN-M17-6.3.3 |
| EL-M17-S8-101 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-102 | text | visible-default | "SEKOLAH KEBANGSAAN KLANG" | FN-M17-6.3.3 |
| EL-M17-S8-103 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-104 | text | visible-default | "SEKOLAH MENENGAH KEBANGSAAN BALING" | FN-M17-6.3.3 |
| EL-M17-S8-105 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-106 | text | visible-default | "SEKOLAH KEBANGSAAN MASJID TANAH" | FN-M17-6.3.3 |
| EL-M17-S8-107 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-108 | text | visible-default | "SEKOLAH MENENGAH KEBANGSAAN GHAFAR BABA" | FN-M17-6.3.3 |
| EL-M17-S8-109 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-110 | text | visible-default | "SEKOLAH MENENGAH KEBANGSAAN LAYANG-LAYANG" | FN-M17-6.3.3 |
| EL-M17-S8-111 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-112 | text | visible-default | "SEKOLAH MENENGAH KEBANGSAAN TINGGI KLANG" | FN-M17-6.3.3 |
| EL-M17-S8-113 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-114 | text | visible-default | "SEKOLAH KEBANGSAAN BALING" | FN-M17-6.3.3 |
| EL-M17-S8-115 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-116 | text | visible-default | "SEKOLAH KEBANGSAAN AMBUAL" | FN-M17-6.3.3 |
| EL-M17-S8-117 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-118 | text | visible-default | "SAM HULU LANGAT" | FN-M17-6.3.3 |
| EL-M17-S8-119 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-120 | text | visible-default | "SEKOLAH MENENGAH KEBANGSAAN KENINGAU" | FN-M17-6.3.3 |
| EL-M17-S8-121 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-122 | text | visible-default | "SEKOLAH MENENGAH KEBANGSAAN TUN HUSSEIN ONN" | FN-M17-6.3.3 |
| EL-M17-S8-123 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-124 | text | visible-default | "SEKOLAH MENENGAH KEBANGSAAN HAMID KHAN" | FN-M17-6.3.3 |
| EL-M17-S8-125 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-126 | text | visible-default | "SEKOLAH MENENGAH KEBANGSAAN RAJA MAHADI" | FN-M17-6.3.3 |
| EL-M17-S8-127 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-128 | text | visible-default | "SEKOLAH KEBANGSAAN TOH TANDEWA SAKTI" | FN-M17-6.3.3 |
| EL-M17-S8-129 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-130 | text | visible-default | "SEKOLAH MENENGAH KEBANGSAAN TAMAN KLUANG BARAT" | FN-M17-6.3.3 |
| EL-M17-S8-131 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-132 | text | visible-default | "SEKOLAH MENENGAH KEBANGSAAN JALAN REKO" | FN-M17-6.3.3 |
| EL-M17-S8-133 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-134 | text | visible-default | "SEKOLAH KEBANGSAAN SERI KENCANA" | FN-M17-6.3.3 |
| EL-M17-S8-135 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-136 | text | visible-default | "SEKOLAH MENENGAH KEBANGSAAN JALAN TIGA" | FN-M17-6.3.3 |
| EL-M17-S8-137 | badge | visible-default | "★ Penglibatan Tertinggi" | FN-M17-6.3.3 |
| EL-M17-S8-138 | text | visible-default | "SEKOLAH KEBANGSAAN JELI (1)" | FN-M17-6.3.3 |
| EL-M17-S8-139 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-140 | text | visible-default | "KOLEJ VOKASIONAL KAJANG" | FN-M17-6.3.3 |
| EL-M17-S8-141 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-142 | text | visible-default | "SEKOLAH KEBANGSAAN TEMAI" | FN-M17-6.3.3 |
| EL-M17-S8-143 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-144 | text | visible-default | "SEKOLAH MENENGAH KEBANGSAAN AMINUDDIN BAKI" | FN-M17-6.3.3 |
| EL-M17-S8-145 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-146 | text | visible-default | "SEKOLAH MENENGAH KEBANGSAAN BANDAR SERI PUTRA" | FN-M17-6.3.3 |
| EL-M17-S8-147 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-148 | text | visible-default | "SEKOLAH MENENGAH KEBANGSAAN JALAN EMPAT" | FN-M17-6.3.3 |
| EL-M17-S8-149 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-150 | text | visible-default | "SEKOLAH KEBANGSAAN SAUJANA IMPIAN" | FN-M17-6.3.3 |
| EL-M17-S8-151 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-152 | text | visible-default | "SEKOLAH KEBANGSAAN BANDAR BARU DARULAMAN" | FN-M17-6.3.3 |
| EL-M17-S8-153 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-154 | text | visible-default | "KOLEJ ISLAM SULTAN ALAM SHAH" | FN-M17-6.3.3 |
| EL-M17-S8-155 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-156 | text | visible-default | "SEKOLAH KEBANGSAAN BANDAR RINCHING" | FN-M17-6.3.3 |
| EL-M17-S8-157 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-158 | text | visible-default | "SEKOLAH KEBANGSAAN CHUKAI" | FN-M17-6.3.3 |
| EL-M17-S8-159 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-160 | text | visible-default | "SEKOLAH KEBANGSAAN CONVENT" | FN-M17-6.3.3 |
| EL-M17-S8-161 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-162 | text | visible-default | "SEKOLAH KEBANGSAAN BERANANG" | FN-M17-6.3.3 |
| EL-M17-S8-163 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-164 | text | visible-default | "SEKOLAH MENENGAH KEBANGSAAN TAMBULION" | FN-M17-6.3.3 |
| EL-M17-S8-165 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-166 | text | visible-default | "SEKOLAH MENENGAH SAINS ALAM SHAH" | FN-M17-6.3.3 |
| EL-M17-S8-167 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-168 | text | visible-default | "SEKOLAH KEBANGSAAN TOK JEMBAL" | FN-M17-6.3.3 |
| EL-M17-S8-169 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-170 | text | visible-default | "SEKOLAH MENENGAH KEBANGSAAN AGAMA MAAHAD HAMIDIAH" | FN-M17-6.3.3 |
| EL-M17-S8-171 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-172 | text | visible-default | "SEKOLAH KEBANGSAAN TUANKU FATIMAH" | FN-M17-6.3.3 |
| EL-M17-S8-173 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-174 | text | visible-default | "SEKOLAH KEBANGSAAN BANDAR BARU BANGI" | FN-M17-6.3.3 |
| EL-M17-S8-175 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-176 | text | visible-default | "SEKOLAH KEBANGSAAN PEKAN TUARAN" | FN-M17-6.3.3 |
| EL-M17-S8-177 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-178 | text | visible-default | "SEKOLAH MENENGAH SAINS TENGKU MUHAMMAD FARIS PETRA" | FN-M17-6.3.3 |
| EL-M17-S8-179 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-180 | text | visible-default | "SAM MUHAMMADIAH" | FN-M17-6.3.3 |
| EL-M17-S8-181 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-182 | text | visible-default | "SEKOLAH KEBANGSAAN TELOK GADONG" | FN-M17-6.3.3 |
| EL-M17-S8-183 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-184 | text | visible-default | "SMK Leqoe" | FN-M17-6.3.3 |
| EL-M17-S8-185 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-186 | text | visible-default | "SEKOLAH KEBANGSAAN KAMPONG CHAMEK" | FN-M17-6.3.3 |
| EL-M17-S8-187 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-188 | text | visible-default | "SEKOLAH MENENGAH KEBANGSAAN SUBANG BESTARI" | FN-M17-6.3.3 |
| EL-M17-S8-189 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-190 | text | visible-default | "SMT CHERAS" | FN-M17-6.3.3 |
| EL-M17-S8-191 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-192 | text | visible-default | "SEKOLAH MENENGAH KEBANGSAAN BENTONG" | FN-M17-6.3.3 |
| EL-M17-S8-193 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-194 | text | visible-default | "SEKOLAH KEBANGSAAN PANDAN INDAH" | FN-M17-6.3.3 |
| EL-M17-S8-195 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-196 | text | visible-default | "SEKOLAH KEBANGSAAN KUALA SELANGOR" | FN-M17-6.3.3 |
| EL-M17-S8-197 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-198 | text | visible-default | "SEKOLAH MENENGAH KEBANGSAAN BUKIT JELUTONG" | FN-M17-6.3.3 |
| EL-M17-S8-199 | empty-state | visible-default | "Tiada lencana khas" | FN-M17-6.3.3 |
| EL-M17-S8-200 | card | visible-default | "5 Sekolah Paling Aktif" | FN-M17-6.3.4 |
| EL-M17-S8-201 | heading | visible-default | "5 Sekolah Paling Aktif" | FN-M17-6.3.4 |
| EL-M17-S8-202 | text | visible-default | "1" | FN-M17-6.3.4 |
| EL-M17-S8-203 | text | visible-default | "SEKOLAH MENENGAH KEBANGSAAN TINGGI KLUANG" | FN-M17-6.3.4 |
| EL-M17-S8-204 | text | visible-default | "Johor" | FN-M17-6.3.4 |
| EL-M17-S8-205 | text | visible-default | "Soalan:" | FN-M17-6.3.4 |
| EL-M17-S8-206 | text | visible-default | "72,332" | FN-M17-6.3.4 |
| EL-M17-S8-207 | text | visible-default | "Pelajar:" | FN-M17-6.3.4 |
| EL-M17-S8-208 | text | visible-default | "33/59" | FN-M17-6.3.4 |
| EL-M17-S8-209 | text | visible-default | "Penglibatan:" | FN-M17-6.3.4 |
| EL-M17-S8-210 | text | visible-default | "55.9%" | FN-M17-6.3.4 |
| EL-M17-S8-211 | text | visible-default | "Ketepatan:" | FN-M17-6.3.4 |
| EL-M17-S8-212 | text | visible-default | "89.8%" | FN-M17-6.3.4 |
| EL-M17-S8-213 | link | visible-default | "Fokus →", → /admin/laporan-eksekutif/sekolah/8880 | FN-M17-6.3.4 |
| EL-M17-S8-214 | text | visible-default | "2" | FN-M17-6.3.4 |
| EL-M17-S8-215 | text | visible-default | "SEKOLAH MENENGAH KEBANGSAAN BANDAR RINCHING" | FN-M17-6.3.4 |
| EL-M17-S8-216 | text | visible-default | "Selangor" | FN-M17-6.3.4 |
| EL-M17-S8-217 | text | visible-default | "Soalan:" | FN-M17-6.3.4 |
| EL-M17-S8-218 | text | visible-default | "67,853" | FN-M17-6.3.4 |
| EL-M17-S8-219 | text | visible-default | "Pelajar:" | FN-M17-6.3.4 |
| EL-M17-S8-220 | text | visible-default | "142/562" | FN-M17-6.3.4 |
| EL-M17-S8-221 | text | visible-default | "Penglibatan:" | FN-M17-6.3.4 |
| EL-M17-S8-222 | text | visible-default | "25.3%" | FN-M17-6.3.4 |
| EL-M17-S8-223 | text | visible-default | "Ketepatan:" | FN-M17-6.3.4 |
| EL-M17-S8-224 | text | visible-default | "87.6%" | FN-M17-6.3.4 |
| EL-M17-S8-225 | link | visible-default | "Fokus →", → /admin/laporan-eksekutif/sekolah/8106 | FN-M17-6.3.4 |
| EL-M17-S8-226 | text | visible-default | "3" | FN-M17-6.3.4 |
| EL-M17-S8-227 | text | visible-default | "SEKOLAH MENENGAH KEBANGSAAN BANDAR BARU BANGI" | FN-M17-6.3.4 |
| EL-M17-S8-228 | text | visible-default | "Selangor" | FN-M17-6.3.4 |
| EL-M17-S8-229 | text | visible-default | "Soalan:" | FN-M17-6.3.4 |
| EL-M17-S8-230 | text | visible-default | "60,644" | FN-M17-6.3.4 |
| EL-M17-S8-231 | text | visible-default | "Pelajar:" | FN-M17-6.3.4 |
| EL-M17-S8-232 | text | visible-default | "179/423" | FN-M17-6.3.4 |
| EL-M17-S8-233 | text | visible-default | "Penglibatan:" | FN-M17-6.3.4 |
| EL-M17-S8-234 | text | visible-default | "42.3%" | FN-M17-6.3.4 |
| EL-M17-S8-235 | text | visible-default | "Ketepatan:" | FN-M17-6.3.4 |
| EL-M17-S8-236 | text | visible-default | "79.4%" | FN-M17-6.3.4 |
| EL-M17-S8-237 | link | visible-default | "Fokus →", → /admin/laporan-eksekutif/sekolah/8078 | FN-M17-6.3.4 |
| EL-M17-S8-238 | text | visible-default | "4" | FN-M17-6.3.4 |
| EL-M17-S8-239 | text | visible-default | "SEKOLAH MENENGAH KEBANGSAAN ENGKU HUSAIN" | FN-M17-6.3.4 |
| EL-M17-S8-240 | text | visible-default | "Selangor" | FN-M17-6.3.4 |
| EL-M17-S8-241 | text | visible-default | "Soalan:" | FN-M17-6.3.4 |
| EL-M17-S8-242 | text | visible-default | "49,813" | FN-M17-6.3.4 |
| EL-M17-S8-243 | text | visible-default | "Pelajar:" | FN-M17-6.3.4 |
| EL-M17-S8-244 | text | visible-default | "225/549" | FN-M17-6.3.4 |
| EL-M17-S8-245 | text | visible-default | "Penglibatan:" | FN-M17-6.3.4 |
| EL-M17-S8-246 | text | visible-default | "41%" | FN-M17-6.3.4 |
| EL-M17-S8-247 | text | visible-default | "Ketepatan:" | FN-M17-6.3.4 |
| EL-M17-S8-248 | text | visible-default | "77.4%" | FN-M17-6.3.4 |
| EL-M17-S8-249 | link | visible-default | "Fokus →", → /admin/laporan-eksekutif/sekolah/8082 | FN-M17-6.3.4 |
| EL-M17-S8-250 | text | visible-default | "5" | FN-M17-6.3.4 |
| EL-M17-S8-251 | text | visible-default | "SEKOLAH MENENGAH KEBANGSAAN BANDAR TASIK KESUMA" | FN-M17-6.3.4 |
| EL-M17-S8-252 | text | visible-default | "Selangor" | FN-M17-6.3.4 |
| EL-M17-S8-253 | text | visible-default | "Soalan:" | FN-M17-6.3.4 |
| EL-M17-S8-254 | text | visible-default | "25,247" | FN-M17-6.3.4 |
| EL-M17-S8-255 | text | visible-default | "Pelajar:" | FN-M17-6.3.4 |
| EL-M17-S8-256 | text | visible-default | "192/776" | FN-M17-6.3.4 |
| EL-M17-S8-257 | text | visible-default | "Penglibatan:" | FN-M17-6.3.4 |
| EL-M17-S8-258 | text | visible-default | "24.7%" | FN-M17-6.3.4 |
| EL-M17-S8-259 | text | visible-default | "Ketepatan:" | FN-M17-6.3.4 |
| EL-M17-S8-260 | text | visible-default | "76.9%" | FN-M17-6.3.4 |
| EL-M17-S8-261 | link | visible-default | "Fokus →", → /admin/laporan-eksekutif/sekolah/8102 | FN-M17-6.3.4 |
| EL-M17-S8-262 | card | visible-default | "Prestasi Mengikut Subjek" | FN-M17-6.3.5 |
| EL-M17-S8-263 | heading | visible-default | "Prestasi Mengikut Subjek" | FN-M17-6.3.5 |
| EL-M17-S8-264 | card | visible-default | "Headcount TOV → RS (2026)" | FN-M17-6.3.6 |
| EL-M17-S8-265 | heading | visible-default | "Headcount TOV → RS (2026)" | FN-M17-6.3.6 |
| EL-M17-S8-266 | table | visible-default | table | FN-M17-6.3.6 |
| EL-M17-S8-267 | card | visible-default | "Kirkpatrick Evaluation" | FN-M17-6.3.7 |
| EL-M17-S8-268 | heading | visible-default | "Kirkpatrick Evaluation" | FN-M17-6.3.7 |
| EL-M17-S8-269 | text | visible-default | "Jumlah Respon" | FN-M17-6.3.7 |
| EL-M17-S8-270 | text | visible-default | "336" | FN-M17-6.3.7 |
| EL-M17-S8-271 | text | visible-default | "Purata Kepuasan" | FN-M17-6.3.7 |
| EL-M17-S8-272 | text | visible-default | "4.6" | FN-M17-6.3.7 |
| EL-M17-S8-273 | text | visible-default | "/5" | FN-M17-6.3.7 |
| EL-M17-S8-274 | text | visible-default | "NPS Score" | FN-M17-6.3.7 |
| EL-M17-S8-275 | text | visible-default | "8.3" | FN-M17-6.3.7 |
| EL-M17-S8-276 | card | visible-default | "GPS Perbandingan Sekolah (2026)" | FN-M17-6.3.8 |
| EL-M17-S8-277 | heading | visible-default | "GPS Perbandingan Sekolah (2026)" | FN-M17-6.3.8 |
| EL-M17-S8-278 | text | visible-default | "GPS lebih rendah = lebih baik. GPS 1.0 = semua A." | FN-M17-6.3.8 |
| EL-M17-S8-279 | card | visible-default | "Pusat Tuisyen" | FN-M17-6.3.9 |
| EL-M17-S8-280 | heading | visible-default | "Pusat Tuisyen" | FN-M17-6.3.9 |
| EL-M17-S8-281 | text | visible-default | "Pusat Tuisyen Demo PrestasiPlus" | FN-M17-6.3.9 |
| EL-M17-S8-282 | text | visible-default | "Johor Bahru, Johor" | FN-M17-6.3.9 |
| EL-M17-S8-283 | text | visible-default | "18" | FN-M17-6.3.9 |
| EL-M17-S8-284 | text | visible-default | "pelajar aktif" | FN-M17-6.3.9 |
| EL-M17-S8-285 | text | visible-default | "Alesa IT Tuisyen" | FN-M17-6.3.9 |
| EL-M17-S8-286 | text | visible-default | "KLUANG, Johor" | FN-M17-6.3.9 |
| EL-M17-S8-287 | text | visible-default | "0" | FN-M17-6.3.9 |
| EL-M17-S8-288 | text | visible-default | "pelajar aktif" | FN-M17-6.3.9 |
| EL-M17-S8-289 | text | visible-default | "Laporan dijana automatik oleh PrestasiPlus · 26 Sep 2026, 04:26 AM" | FN-M17-6.3.10 |
| EL-M17-S8-290 | text | visible-default | "Menyeluruh. Berasaskan Data. Berdaya Maju." | FN-M17-6.3.10 |
| EL-M17-S8-291 | text | conditional | "0 aktif 2025" | FN-M17-6.3.11 |
| EL-M17-S8-292 | text | conditional | "0%" | FN-M17-6.3.11 |
| EL-M17-S8-293 | text | conditional | "0%" | FN-M17-6.3.11 |
| EL-M17-S8-294 | text | conditional | "0% selepas pembetulan" | FN-M17-6.3.11 |
| EL-M17-S8-295 | text | conditional | "SEKOLAH MENENGAH KEBANGSAAN BANDAR BARU BANGI" | FN-M17-6.3.11 |
| EL-M17-S8-296 | text | conditional | "-" | FN-M17-6.3.11 |
| EL-M17-S8-297 | empty-state | conditional | "Tiada lencana khas" | FN-M17-6.3.11 |
| EL-M17-S8-298 | empty-state | conditional | "Tiada lencana khas" | FN-M17-6.3.11 |
| EL-M17-S8-299 | text | conditional | "0/423" | FN-M17-6.3.11 |
| EL-M17-S8-300 | text | conditional | "0%" | FN-M17-6.3.11 |
| EL-M17-S8-301 | text | conditional | "0%" | FN-M17-6.3.11 |
| EL-M17-S8-302 | text | conditional | "SEKOLAH KEBANGSAAN TOK JEMBAL" | FN-M17-6.3.11 |
| EL-M17-S8-303 | text | conditional | "Terengganu" | FN-M17-6.3.11 |
| EL-M17-S8-304 | text | conditional | "0/1" | FN-M17-6.3.11 |
| EL-M17-S8-305 | text | conditional | "0%" | FN-M17-6.3.11 |
| EL-M17-S8-306 | text | conditional | "0%" | FN-M17-6.3.11 |
| EL-M17-S8-307 | text | conditional | "SEKOLAH MENENGAH SAINS ALAM SHAH" | FN-M17-6.3.11 |
| EL-M17-S8-308 | text | conditional | "Kuala Lumpur" | FN-M17-6.3.11 |
| EL-M17-S8-309 | text | conditional | "0/1" | FN-M17-6.3.11 |
| EL-M17-S8-310 | text | conditional | "0%" | FN-M17-6.3.11 |
| EL-M17-S8-311 | text | conditional | "0%" | FN-M17-6.3.11 |
| EL-M17-S8-312 | text | conditional | "SEKOLAH MENENGAH KEBANGSAAN TAMAN KLUANG BARAT" | FN-M17-6.3.11 |
| EL-M17-S8-313 | text | conditional | "0/12" | FN-M17-6.3.11 |
| EL-M17-S8-314 | text | conditional | "0%" | FN-M17-6.3.11 |
| EL-M17-S8-315 | text | conditional | "0%" | FN-M17-6.3.11 |
| EL-M17-S8-316 | text | conditional | "SEKOLAH JENIS KEBANGSAAN (CINA) CHONG HWA I" | FN-M17-6.3.11 |
| EL-M17-S8-317 | text | conditional | "Johor" | FN-M17-6.3.11 |
| EL-M17-S8-318 | text | conditional | "0/12" | FN-M17-6.3.11 |
| EL-M17-S8-319 | text | conditional | "0%" | FN-M17-6.3.11 |
| EL-M17-S8-320 | text | conditional | "0%" | FN-M17-6.3.11 |
| EL-M17-S8-321 | text | conditional | "500" | FN-M17-1.2.5 |
| EL-M17-S8-322 | text | conditional | "⚙️" | FN-M17-1.2.5 |
| EL-M17-S8-323 | heading | conditional | "Ralat Pelayan" | FN-M17-1.2.5 |
| EL-M17-S8-324 | text | conditional | "Sesuatu tidak kena di pihak kami. Pasukan teknikal telah dimaklumkan. Sila cuba " | FN-M17-1.2.5 |
| EL-M17-S8-325 | link | conditional | "Halaman Utama", → / | FN-M17-1.2.5 |
| EL-M17-S8-326 | link | conditional | "Cuba Semula", → javascript:location.reload() | FN-M17-1.2.5 |
| EL-M17-S8-327 | text | conditional | "PRESTASIPLUS" | FN-M17-1.2.5 |

#### S9 — `/admin/laporan-eksekutif/sekolah/{id}` (113 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M17-S9-001 | link | visible-default | "Kembali ke Laporan Eksekutif", fa-arrow-left, → /admin/laporan-eksekutif | FN-M17-6.4.1 |
| EL-M17-S9-002 | heading | visible-default | "SEKOLAH MENENGAH KEBANGSAAN TINGGI KLUANG" | FN-M17-6.4.1 |
| EL-M17-S9-003 | text | visible-default | "Negeri: Johor" | FN-M17-6.4.1 |
| EL-M17-S9-004 | card | visible-default | "Penglibatan" | FN-M17-6.4.2 |
| EL-M17-S9-005 | text | visible-default | "Penglibatan" | FN-M17-6.4.2 |
| EL-M17-S9-006 | text | visible-default | "55.9%" | FN-M17-6.4.2 |
| EL-M17-S9-007 | text | visible-default | "33 aktif / 59 daftar" | FN-M17-6.4.2 |
| EL-M17-S9-008 | card | visible-default | "Soalan Dijawab" | FN-M17-6.4.2 |
| EL-M17-S9-009 | text | visible-default | "Soalan Dijawab" | FN-M17-6.4.2 |
| EL-M17-S9-010 | text | visible-default | "72,332" | FN-M17-6.4.2 |
| EL-M17-S9-011 | text | visible-default | "2192 soalan/pelajar" | FN-M17-6.4.2 |
| EL-M17-S9-012 | card | visible-default | "Ketepatan Akhir" | FN-M17-6.4.2 |
| EL-M17-S9-013 | text | visible-default | "Ketepatan Akhir" | FN-M17-6.4.2 |
| EL-M17-S9-014 | text | visible-default | "89.8%" | FN-M17-6.4.2 |
| EL-M17-S9-015 | card | visible-default | "Konsistensi" | FN-M17-6.4.2 |
| EL-M17-S9-016 | text | visible-default | "Konsistensi" | FN-M17-6.4.2 |
| EL-M17-S9-017 | text | visible-default | "9/12" | FN-M17-6.4.2 |
| EL-M17-S9-018 | text | visible-default | "bulan aktif 2026" | FN-M17-6.4.2 |
| EL-M17-S9-019 | card | visible-default | "Trend Aktiviti Bulanan" | FN-M17-6.4.3 |
| EL-M17-S9-020 | heading | visible-default | "Trend Aktiviti Bulanan" | FN-M17-6.4.3 |
| EL-M17-S9-021 | text | visible-default | "1" | FN-M17-6.4.3 |
| EL-M17-S9-022 | text | visible-default | "Jan" | FN-M17-6.4.3 |
| EL-M17-S9-023 | text | visible-default | "729" | FN-M17-6.4.3 |
| EL-M17-S9-024 | text | visible-default | "Feb" | FN-M17-6.4.3 |
| EL-M17-S9-025 | text | visible-default | "1,148" | FN-M17-6.4.3 |
| EL-M17-S9-026 | text | visible-default | "Mar" | FN-M17-6.4.3 |
| EL-M17-S9-027 | text | visible-default | "1,056" | FN-M17-6.4.3 |
| EL-M17-S9-028 | text | visible-default | "Apr" | FN-M17-6.4.3 |
| EL-M17-S9-029 | text | visible-default | "16,200" | FN-M17-6.4.3 |
| EL-M17-S9-030 | text | visible-default | "May" | FN-M17-6.4.3 |
| EL-M17-S9-031 | text | visible-default | "52,059" | FN-M17-6.4.3 |
| EL-M17-S9-032 | text | visible-default | "Jun" | FN-M17-6.4.3 |
| EL-M17-S9-033 | text | visible-default | "1,074" | FN-M17-6.4.3 |
| EL-M17-S9-034 | text | visible-default | "Jul" | FN-M17-6.4.3 |
| EL-M17-S9-035 | text | visible-default | "30" | FN-M17-6.4.3 |
| EL-M17-S9-036 | text | visible-default | "Aug" | FN-M17-6.4.3 |
| EL-M17-S9-037 | text | visible-default | "35" | FN-M17-6.4.3 |
| EL-M17-S9-038 | text | visible-default | "Sep" | FN-M17-6.4.3 |
| EL-M17-S9-039 | text | visible-default | "Oct" | FN-M17-6.4.3 |
| EL-M17-S9-040 | text | visible-default | "Nov" | FN-M17-6.4.3 |
| EL-M17-S9-041 | text | visible-default | "Dec" | FN-M17-6.4.3 |
| EL-M17-S9-042 | card | visible-default | "Prestasi Mengikut Subjek" | FN-M17-6.4.4 |
| EL-M17-S9-043 | heading | visible-default | "Prestasi Mengikut Subjek" | FN-M17-6.4.4 |
| EL-M17-S9-044 | text | visible-default | "▲ SUBJEK TERKUAT" | FN-M17-6.4.4 |
| EL-M17-S9-045 | text | visible-default | "Pendidikan Al-Quran & As-Sunnah" | FN-M17-6.4.4 |
| EL-M17-S9-046 | text | visible-default | "100.0% (35 soalan)" | FN-M17-6.4.4 |
| EL-M17-S9-047 | text | visible-default | "▼ SUBJEK PERLU PERHATIAN" | FN-M17-6.4.4 |
| EL-M17-S9-048 | text | visible-default | "Kimia" | FN-M17-6.4.4 |
| EL-M17-S9-049 | text | visible-default | "64.1% (744 soalan)" | FN-M17-6.4.4 |
| EL-M17-S9-050 | text | visible-default | "Pendidikan Islam" | FN-M17-6.4.4 |
| EL-M17-S9-051 | text | visible-default | "97.1%" | FN-M17-6.4.4 |
| EL-M17-S9-052 | text | visible-default | "Bahasa Melayu" | FN-M17-6.4.4 |
| EL-M17-S9-053 | text | visible-default | "93.4%" | FN-M17-6.4.4 |
| EL-M17-S9-054 | text | visible-default | "Sejarah" | FN-M17-6.4.4 |
| EL-M17-S9-055 | text | visible-default | "86.1%" | FN-M17-6.4.4 |
| EL-M17-S9-056 | text | visible-default | "Matematik" | FN-M17-6.4.4 |
| EL-M17-S9-057 | text | visible-default | "88.5%" | FN-M17-6.4.4 |
| EL-M17-S9-058 | text | visible-default | "Fizik" | FN-M17-6.4.4 |
| EL-M17-S9-059 | text | visible-default | "65.4%" | FN-M17-6.4.4 |
| EL-M17-S9-060 | text | visible-default | "Pendidikan Jasmani & Kesihatan" | FN-M17-6.4.4 |
| EL-M17-S9-061 | text | visible-default | "99.3%" | FN-M17-6.4.4 |
| EL-M17-S9-062 | text | visible-default | "Tasawwur Islam" | FN-M17-6.4.4 |
| EL-M17-S9-063 | text | visible-default | "95.2%" | FN-M17-6.4.4 |
| EL-M17-S9-064 | text | visible-default | "Biologi" | FN-M17-6.4.4 |
| EL-M17-S9-065 | text | visible-default | "70.3%" | FN-M17-6.4.4 |
| EL-M17-S9-066 | text | visible-default | "Bahasa Inggeris" | FN-M17-6.4.4 |
| EL-M17-S9-067 | text | visible-default | "81.8%" | FN-M17-6.4.4 |
| EL-M17-S9-068 | text | visible-default | "Sains" | FN-M17-6.4.4 |
| EL-M17-S9-069 | text | visible-default | "73.5%" | FN-M17-6.4.4 |
| EL-M17-S9-070 | text | visible-default | "Kimia" | FN-M17-6.4.4 |
| EL-M17-S9-071 | text | visible-default | "64.1%" | FN-M17-6.4.4 |
| EL-M17-S9-072 | text | visible-default | "Pendidikan Syariah Islamiah" | FN-M17-6.4.4 |
| EL-M17-S9-073 | text | visible-default | "91.7%" | FN-M17-6.4.4 |
| EL-M17-S9-074 | text | visible-default | "Matematik Tambahan" | FN-M17-6.4.4 |
| EL-M17-S9-075 | text | visible-default | "81.7%" | FN-M17-6.4.4 |
| EL-M17-S9-076 | text | visible-default | "Reka Bentuk & Teknologi" | FN-M17-6.4.4 |
| EL-M17-S9-077 | text | visible-default | "99.6%" | FN-M17-6.4.4 |
| EL-M17-S9-078 | text | visible-default | "Prinsip Perakaunan" | FN-M17-6.4.4 |
| EL-M17-S9-079 | text | visible-default | "71.1%" | FN-M17-6.4.4 |
| EL-M17-S9-080 | text | visible-default | "Geografi" | FN-M17-6.4.4 |
| EL-M17-S9-081 | text | visible-default | "66.7%" | FN-M17-6.4.4 |
| EL-M17-S9-082 | text | visible-default | "Pendidikan Seni Visual" | FN-M17-6.4.4 |
| EL-M17-S9-083 | text | visible-default | "95.3%" | FN-M17-6.4.4 |
| EL-M17-S9-084 | text | visible-default | "Ekonomi" | FN-M17-6.4.4 |
| EL-M17-S9-085 | text | visible-default | "78.8%" | FN-M17-6.4.4 |
| EL-M17-S9-086 | text | visible-default | "Sains Komputer" | FN-M17-6.4.4 |
| EL-M17-S9-087 | text | visible-default | "88.5%" | FN-M17-6.4.4 |
| EL-M17-S9-088 | text | visible-default | "Bahasa Arab" | FN-M17-6.4.4 |
| EL-M17-S9-089 | text | visible-default | "67.5%" | FN-M17-6.4.4 |
| EL-M17-S9-090 | text | visible-default | "Pendidikan Al-Quran & As-Sunnah" | FN-M17-6.4.4 |
| EL-M17-S9-091 | text | visible-default | "100.0%" | FN-M17-6.4.4 |
| EL-M17-S9-092 | text | visible-default | "Bahasa Tamil" | FN-M17-6.4.4 |
| EL-M17-S9-093 | text | visible-default | "90.0%" | FN-M17-6.4.4 |
| EL-M17-S9-094 | text | visible-default | "Pendidikan Moral" | FN-M17-6.4.4 |
| EL-M17-S9-095 | text | visible-default | "100.0%" | FN-M17-6.4.4 |
| EL-M17-S9-096 | card | visible-default | "Headcount TOV → RS" | FN-M17-6.4.5 |
| EL-M17-S9-097 | heading | visible-default | "Headcount TOV → RS" | FN-M17-6.4.5 |
| EL-M17-S9-098 | table | visible-default | table | FN-M17-6.4.5 |
| EL-M17-S9-099 | text | visible-default | "Laporan dijana: 26 Sep 2026, 04:26 AM · PrestasiPlus" | FN-M17-6.4.6 |
| EL-M17-S9-100 | heading | conditional | "SEKOLAH KEBANGSAAN TOK JEMBAL" | FN-M17-6.4.1 |
| EL-M17-S9-101 | text | conditional | "Negeri: Terengganu" | FN-M17-6.4.1 |
| EL-M17-S9-102 | text | conditional | "0%" | FN-M17-6.4.2 |
| EL-M17-S9-103 | text | conditional | "0 aktif / 1 daftar" | FN-M17-6.4.2 |
| EL-M17-S9-104 | text | conditional | "0 soalan/pelajar" | FN-M17-6.4.2 |
| EL-M17-S9-105 | text | conditional | "0%" | FN-M17-6.4.2 |
| EL-M17-S9-106 | text | conditional | "0/12" | FN-M17-6.4.2 |
| EL-M17-S9-107 | text | conditional | "404" | FN-M17-1.2.3 |
| EL-M17-S9-108 | text | conditional | "🔍" | FN-M17-1.2.3 |
| EL-M17-S9-109 | heading | conditional | "Halaman Tidak Dijumpai" | FN-M17-1.2.3 |
| EL-M17-S9-110 | text | conditional | "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL sal" | FN-M17-1.2.3 |
| EL-M17-S9-111 | link | conditional | "Halaman Utama", → / | FN-M17-1.2.3 |
| EL-M17-S9-112 | link | conditional | "Mula Latihan", → /latih-tubi | FN-M17-1.2.3 |
| EL-M17-S9-113 | text | conditional | "PRESTASIPLUS" | FN-M17-1.2.3 |

#### S10 — `/admin/analytics` (494 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M17-S10-001 | card | visible-default | "1,123" | FN-M17-7.1.1 |
| EL-M17-S10-002 | text | visible-default | "Jumlah Import" | FN-M17-7.1.1 |
| EL-M17-S10-003 | text | visible-default | "1,123" | FN-M17-7.1.1 |
| EL-M17-S10-004 | text | visible-default | "Keseluruhan", fa-upload | FN-M17-7.1.1 |
| EL-M17-S10-005 | card | visible-default | "0" | FN-M17-7.1.1 |
| EL-M17-S10-006 | text | visible-default | "Import Bulan Ini" | FN-M17-7.1.1 |
| EL-M17-S10-007 | text | visible-default | "0" | FN-M17-7.1.1 |
| EL-M17-S10-008 | text | visible-default | "September 2026", fa-calendar-check | FN-M17-7.1.1 |
| EL-M17-S10-009 | card | visible-default | "0" | FN-M17-7.1.1 |
| EL-M17-S10-010 | text | visible-default | "Import Lepas" | FN-M17-7.1.1 |
| EL-M17-S10-011 | text | visible-default | "0" | FN-M17-7.1.1 |
| EL-M17-S10-012 | text | visible-default | "August 2026", fa-history | FN-M17-7.1.1 |
| EL-M17-S10-013 | card | visible-default | "31,101" | FN-M17-7.1.1 |
| EL-M17-S10-014 | text | visible-default | "Soalan Diimport" | FN-M17-7.1.1 |
| EL-M17-S10-015 | text | visible-default | "31,101" | FN-M17-7.1.1 |
| EL-M17-S10-016 | text | visible-default | "Berjaya", fa-check-double | FN-M17-7.1.1 |
| EL-M17-S10-017 | card | visible-default | "Taburan Status Soalan" | FN-M17-7.1.2 |
| EL-M17-S10-018 | heading | visible-default | "Taburan Status Soalan" | FN-M17-7.1.2 |
| EL-M17-S10-019 | text | visible-default | "Draf" | FN-M17-7.1.2 |
| EL-M17-S10-020 | text | visible-default | "0 (0.0%)" | FN-M17-7.1.2 |
| EL-M17-S10-021 | text | visible-default | "Menunggu Review" | FN-M17-7.1.2 |
| EL-M17-S10-022 | text | visible-default | "0 (0.0%)" | FN-M17-7.1.2 |
| EL-M17-S10-023 | text | visible-default | "Diluluskan" | FN-M17-7.1.2 |
| EL-M17-S10-024 | text | visible-default | "128,006 (99.7%)" | FN-M17-7.1.2 |
| EL-M17-S10-025 | badge | visible-default | "128,006" | FN-M17-7.1.2 |
| EL-M17-S10-026 | text | visible-default | "Ditolak" | FN-M17-7.1.2 |
| EL-M17-S10-027 | text | visible-default | "0 (0.0%)" | FN-M17-7.1.2 |
| EL-M17-S10-028 | text | visible-default | "Diarkib" | FN-M17-7.1.2 |
| EL-M17-S10-029 | text | visible-default | "400 (0.3%)" | FN-M17-7.1.2 |
| EL-M17-S10-030 | card | visible-default | "5" | FN-M17-7.1.3 |
| EL-M17-S10-031 | text | visible-default | "Banner" | FN-M17-7.1.3 |
| EL-M17-S10-032 | text | visible-default | "5" | FN-M17-7.1.3 |
| EL-M17-S10-033 | card | visible-default | "72" | FN-M17-7.1.3 |
| EL-M17-S10-034 | text | visible-default | "Artikel" | FN-M17-7.1.3 |
| EL-M17-S10-035 | text | visible-default | "Terbit" | FN-M17-7.1.3 |
| EL-M17-S10-036 | text | visible-default | "72" | FN-M17-7.1.3 |
| EL-M17-S10-037 | text | visible-default | "Draf" | FN-M17-7.1.3 |
| EL-M17-S10-038 | text | visible-default | "0" | FN-M17-7.1.3 |
| EL-M17-S10-039 | card | visible-default | "10" | FN-M17-7.1.3 |
| EL-M17-S10-040 | text | visible-default | "Nota" | FN-M17-7.1.3 |
| EL-M17-S10-041 | text | visible-default | "Terbit" | FN-M17-7.1.3 |
| EL-M17-S10-042 | text | visible-default | "10" | FN-M17-7.1.3 |
| EL-M17-S10-043 | text | visible-default | "Draf" | FN-M17-7.1.3 |
| EL-M17-S10-044 | text | visible-default | "0" | FN-M17-7.1.3 |
| EL-M17-S10-045 | card | visible-default | "Top 10 Subjek Aktif" | FN-M17-7.2.1 |
| EL-M17-S10-046 | heading | visible-default | "Top 10 Subjek Aktif" | FN-M17-7.2.1 |
| EL-M17-S10-047 | text | visible-default | "Pendidikan Moral" | FN-M17-7.2.1 |
| EL-M17-S10-048 | text | visible-default | "15,414" | FN-M17-7.2.1 |
| EL-M17-S10-049 | text | visible-default | "15,414" | FN-M17-7.2.1 |
| EL-M17-S10-050 | text | visible-default | "Matematik" | FN-M17-7.2.1 |
| EL-M17-S10-051 | text | visible-default | "13,354" | FN-M17-7.2.1 |
| EL-M17-S10-052 | text | visible-default | "13,354" | FN-M17-7.2.1 |
| EL-M17-S10-053 | text | visible-default | "Sains" | FN-M17-7.2.1 |
| EL-M17-S10-054 | text | visible-default | "12,128" | FN-M17-7.2.1 |
| EL-M17-S10-055 | text | visible-default | "12,128" | FN-M17-7.2.1 |
| EL-M17-S10-056 | text | visible-default | "Bahasa Melayu" | FN-M17-7.2.1 |
| EL-M17-S10-057 | text | visible-default | "11,688" | FN-M17-7.2.1 |
| EL-M17-S10-058 | text | visible-default | "11,688" | FN-M17-7.2.1 |
| EL-M17-S10-059 | text | visible-default | "Pendidikan Islam" | FN-M17-7.2.1 |
| EL-M17-S10-060 | text | visible-default | "9,152" | FN-M17-7.2.1 |
| EL-M17-S10-061 | text | visible-default | "9,152" | FN-M17-7.2.1 |
| EL-M17-S10-062 | text | visible-default | "Bahasa Inggeris" | FN-M17-7.2.1 |
| EL-M17-S10-063 | text | visible-default | "8,039" | FN-M17-7.2.1 |
| EL-M17-S10-064 | text | visible-default | "8,039" | FN-M17-7.2.1 |
| EL-M17-S10-065 | text | visible-default | "Sejarah" | FN-M17-7.2.1 |
| EL-M17-S10-066 | text | visible-default | "6,468" | FN-M17-7.2.1 |
| EL-M17-S10-067 | text | visible-default | "6,468" | FN-M17-7.2.1 |
| EL-M17-S10-068 | text | visible-default | "Bahasa Tamil" | FN-M17-7.2.1 |
| EL-M17-S10-069 | text | visible-default | "6,300" | FN-M17-7.2.1 |
| EL-M17-S10-070 | text | visible-default | "6,300" | FN-M17-7.2.1 |
| EL-M17-S10-071 | text | visible-default | "Geografi" | FN-M17-7.2.1 |
| EL-M17-S10-072 | text | visible-default | "5,692" | FN-M17-7.2.1 |
| EL-M17-S10-073 | text | visible-default | "5,692" | FN-M17-7.2.1 |
| EL-M17-S10-074 | text | visible-default | "Bahasa Arab" | FN-M17-7.2.1 |
| EL-M17-S10-075 | text | visible-default | "5,400" | FN-M17-7.2.1 |
| EL-M17-S10-076 | text | visible-default | "5,400" | FN-M17-7.2.1 |
| EL-M17-S10-077 | card | visible-default | "Matriks Liputan Subjek" | FN-M17-7.2.2 |
| EL-M17-S10-078 | heading | visible-default | "Matriks Liputan Subjek" | FN-M17-7.2.2 |
| EL-M17-S10-079 | text | visible-default | "Bilangan soalan mengikut subjek dan tahap pendidikan" | FN-M17-7.2.2 |
| EL-M17-S10-080 | table | visible-default | table | FN-M17-7.2.2 |
| EL-M17-S10-081 | badge | visible-default | "958" | FN-M17-7.2.2 |
| EL-M17-S10-082 | badge | visible-default | "2,540" | FN-M17-7.2.2 |
| EL-M17-S10-083 | badge | visible-default | "805" | FN-M17-7.2.2 |
| EL-M17-S10-084 | badge | visible-default | "530" | FN-M17-7.2.2 |
| EL-M17-S10-085 | badge | visible-default | "407" | FN-M17-7.2.2 |
| EL-M17-S10-086 | badge | visible-default | "400" | FN-M17-7.2.2 |
| EL-M17-S10-087 | badge | visible-default | "2,104" | FN-M17-7.2.2 |
| EL-M17-S10-088 | badge | visible-default | "1,800" | FN-M17-7.2.2 |
| EL-M17-S10-089 | badge | visible-default | "1,500" | FN-M17-7.2.2 |
| EL-M17-S10-090 | badge | visible-default | "257" | FN-M17-7.2.2 |
| EL-M17-S10-091 | badge | visible-default | "387" | FN-M17-7.2.2 |
| EL-M17-S10-092 | badge | visible-default | "11,688" | FN-M17-7.2.2 |
| EL-M17-S10-093 | badge | visible-default | "926" | FN-M17-7.2.2 |
| EL-M17-S10-094 | badge | visible-default | "1,225" | FN-M17-7.2.2 |
| EL-M17-S10-095 | badge | visible-default | "846" | FN-M17-7.2.2 |
| EL-M17-S10-096 | badge | visible-default | "524" | FN-M17-7.2.2 |
| EL-M17-S10-097 | badge | visible-default | "403" | FN-M17-7.2.2 |
| EL-M17-S10-098 | badge | visible-default | "992" | FN-M17-7.2.2 |
| EL-M17-S10-099 | badge | visible-default | "1,609" | FN-M17-7.2.2 |
| EL-M17-S10-100 | badge | visible-default | "400" | FN-M17-7.2.2 |
| EL-M17-S10-101 | badge | visible-default | "362" | FN-M17-7.2.2 |
| EL-M17-S10-102 | badge | visible-default | "752" | FN-M17-7.2.2 |
| EL-M17-S10-103 | badge | visible-default | "8,039" | FN-M17-7.2.2 |
| EL-M17-S10-104 | badge | visible-default | "2,725" | FN-M17-7.2.2 |
| EL-M17-S10-105 | badge | visible-default | "2,096" | FN-M17-7.2.2 |
| EL-M17-S10-106 | badge | visible-default | "677" | FN-M17-7.2.2 |
| EL-M17-S10-107 | badge | visible-default | "932" | FN-M17-7.2.2 |
| EL-M17-S10-108 | badge | visible-default | "573" | FN-M17-7.2.2 |
| EL-M17-S10-109 | badge | visible-default | "633" | FN-M17-7.2.2 |
| EL-M17-S10-110 | badge | visible-default | "1,300" | FN-M17-7.2.2 |
| EL-M17-S10-111 | badge | visible-default | "1,300" | FN-M17-7.2.2 |
| EL-M17-S10-112 | badge | visible-default | "900" | FN-M17-7.2.2 |
| EL-M17-S10-113 | badge | visible-default | "1,500" | FN-M17-7.2.2 |
| EL-M17-S10-114 | badge | visible-default | "718" | FN-M17-7.2.2 |
| EL-M17-S10-115 | badge | visible-default | "13,354" | FN-M17-7.2.2 |
| EL-M17-S10-116 | card | visible-default | "Taburan Kesukaran Mengikut Subjek" | FN-M17-7.2.3 |
| EL-M17-S10-117 | heading | visible-default | "Taburan Kesukaran Mengikut Subjek" | FN-M17-7.2.3 |
| EL-M17-S10-118 | heading | visible-default | "Bahasa Arab" | FN-M17-7.2.3 |
| EL-M17-S10-119 | text | visible-default | "5,400 soalan" | FN-M17-7.2.3 |
| EL-M17-S10-120 | text | visible-default | "Lvl 1" | FN-M17-7.2.3 |
| EL-M17-S10-121 | text | visible-default | "2826" | FN-M17-7.2.3 |
| EL-M17-S10-122 | text | visible-default | "Lvl 2" | FN-M17-7.2.3 |
| EL-M17-S10-123 | text | visible-default | "1287" | FN-M17-7.2.3 |
| EL-M17-S10-124 | text | visible-default | "Lvl 3" | FN-M17-7.2.3 |
| EL-M17-S10-125 | text | visible-default | "1287" | FN-M17-7.2.3 |
| EL-M17-S10-126 | text | visible-default | "Lvl 4" | FN-M17-7.2.3 |
| EL-M17-S10-127 | text | visible-default | "0" | FN-M17-7.2.3 |
| EL-M17-S10-128 | text | visible-default | "Lvl 5" | FN-M17-7.2.3 |
| EL-M17-S10-129 | text | visible-default | "0" | FN-M17-7.2.3 |
| EL-M17-S10-130 | heading | visible-default | "Bahasa Inggeris" | FN-M17-7.2.3 |
| EL-M17-S10-131 | text | visible-default | "8,039 soalan" | FN-M17-7.2.3 |
| EL-M17-S10-132 | text | visible-default | "Lvl 1" | FN-M17-7.2.3 |
| EL-M17-S10-133 | text | visible-default | "2105" | FN-M17-7.2.3 |
| EL-M17-S10-134 | text | visible-default | "Lvl 2" | FN-M17-7.2.3 |
| EL-M17-S10-135 | text | visible-default | "2587" | FN-M17-7.2.3 |
| EL-M17-S10-136 | text | visible-default | "Lvl 3" | FN-M17-7.2.3 |
| EL-M17-S10-137 | text | visible-default | "2581" | FN-M17-7.2.3 |
| EL-M17-S10-138 | text | visible-default | "Lvl 4" | FN-M17-7.2.3 |
| EL-M17-S10-139 | text | visible-default | "766" | FN-M17-7.2.3 |
| EL-M17-S10-140 | text | visible-default | "Lvl 5" | FN-M17-7.2.3 |
| EL-M17-S10-141 | text | visible-default | "0" | FN-M17-7.2.3 |
| EL-M17-S10-142 | heading | visible-default | "Bahasa Melayu" | FN-M17-7.2.3 |
| EL-M17-S10-143 | text | visible-default | "11,688 soalan" | FN-M17-7.2.3 |
| EL-M17-S10-144 | text | visible-default | "Lvl 1" | FN-M17-7.2.3 |
| EL-M17-S10-145 | text | visible-default | "3018" | FN-M17-7.2.3 |
| EL-M17-S10-146 | text | visible-default | "Lvl 2" | FN-M17-7.2.3 |
| EL-M17-S10-147 | text | visible-default | "4608" | FN-M17-7.2.3 |
| EL-M17-S10-148 | text | visible-default | "Lvl 3" | FN-M17-7.2.3 |
| EL-M17-S10-149 | text | visible-default | "2880" | FN-M17-7.2.3 |
| EL-M17-S10-150 | text | visible-default | "Lvl 4" | FN-M17-7.2.3 |
| EL-M17-S10-151 | text | visible-default | "1182" | FN-M17-7.2.3 |
| EL-M17-S10-152 | text | visible-default | "Lvl 5" | FN-M17-7.2.3 |
| EL-M17-S10-153 | text | visible-default | "0" | FN-M17-7.2.3 |
| EL-M17-S10-154 | heading | visible-default | "Bahasa Tamil" | FN-M17-7.2.3 |
| EL-M17-S10-155 | text | visible-default | "6,300 soalan" | FN-M17-7.2.3 |
| EL-M17-S10-156 | text | visible-default | "Lvl 1" | FN-M17-7.2.3 |
| EL-M17-S10-157 | text | visible-default | "2142" | FN-M17-7.2.3 |
| EL-M17-S10-158 | text | visible-default | "Lvl 2" | FN-M17-7.2.3 |
| EL-M17-S10-159 | text | visible-default | "2079" | FN-M17-7.2.3 |
| EL-M17-S10-160 | text | visible-default | "Lvl 3" | FN-M17-7.2.3 |
| EL-M17-S10-161 | text | visible-default | "2079" | FN-M17-7.2.3 |
| EL-M17-S10-162 | text | visible-default | "Lvl 4" | FN-M17-7.2.3 |
| EL-M17-S10-163 | text | visible-default | "0" | FN-M17-7.2.3 |
| EL-M17-S10-164 | text | visible-default | "Lvl 5" | FN-M17-7.2.3 |
| EL-M17-S10-165 | text | visible-default | "0" | FN-M17-7.2.3 |
| EL-M17-S10-166 | heading | visible-default | "Biologi" | FN-M17-7.2.3 |
| EL-M17-S10-167 | text | visible-default | "4,232 soalan" | FN-M17-7.2.3 |
| EL-M17-S10-168 | text | visible-default | "Lvl 1" | FN-M17-7.2.3 |
| EL-M17-S10-169 | text | visible-default | "10" | FN-M17-7.2.3 |
| EL-M17-S10-170 | text | visible-default | "Lvl 2" | FN-M17-7.2.3 |
| EL-M17-S10-171 | text | visible-default | "2429" | FN-M17-7.2.3 |
| EL-M17-S10-172 | text | visible-default | "Lvl 3" | FN-M17-7.2.3 |
| EL-M17-S10-173 | text | visible-default | "1119" | FN-M17-7.2.3 |
| EL-M17-S10-174 | text | visible-default | "Lvl 4" | FN-M17-7.2.3 |
| EL-M17-S10-175 | text | visible-default | "674" | FN-M17-7.2.3 |
| EL-M17-S10-176 | text | visible-default | "Lvl 5" | FN-M17-7.2.3 |
| EL-M17-S10-177 | text | visible-default | "0" | FN-M17-7.2.3 |
| EL-M17-S10-178 | heading | visible-default | "Ekonomi" | FN-M17-7.2.3 |
| EL-M17-S10-179 | text | visible-default | "2,625 soalan" | FN-M17-7.2.3 |
| EL-M17-S10-180 | text | visible-default | "Lvl 1" | FN-M17-7.2.3 |
| EL-M17-S10-181 | text | visible-default | "269" | FN-M17-7.2.3 |
| EL-M17-S10-182 | text | visible-default | "Lvl 2" | FN-M17-7.2.3 |
| EL-M17-S10-183 | text | visible-default | "861" | FN-M17-7.2.3 |
| EL-M17-S10-184 | text | visible-default | "Lvl 3" | FN-M17-7.2.3 |
| EL-M17-S10-185 | text | visible-default | "983" | FN-M17-7.2.3 |
| EL-M17-S10-186 | text | visible-default | "Lvl 4" | FN-M17-7.2.3 |
| EL-M17-S10-187 | text | visible-default | "512" | FN-M17-7.2.3 |
| EL-M17-S10-188 | text | visible-default | "Lvl 5" | FN-M17-7.2.3 |
| EL-M17-S10-189 | text | visible-default | "0" | FN-M17-7.2.3 |
| EL-M17-S10-190 | heading | visible-default | "Fizik" | FN-M17-7.2.3 |
| EL-M17-S10-191 | text | visible-default | "1,251 soalan" | FN-M17-7.2.3 |
| EL-M17-S10-192 | text | visible-default | "Lvl 1" | FN-M17-7.2.3 |
| EL-M17-S10-193 | text | visible-default | "66" | FN-M17-7.2.3 |
| EL-M17-S10-194 | text | visible-default | "Lvl 2" | FN-M17-7.2.3 |
| EL-M17-S10-195 | text | visible-default | "447" | FN-M17-7.2.3 |
| EL-M17-S10-196 | text | visible-default | "Lvl 3" | FN-M17-7.2.3 |
| EL-M17-S10-197 | text | visible-default | "540" | FN-M17-7.2.3 |
| EL-M17-S10-198 | text | visible-default | "Lvl 4" | FN-M17-7.2.3 |
| EL-M17-S10-199 | text | visible-default | "198" | FN-M17-7.2.3 |
| EL-M17-S10-200 | text | visible-default | "Lvl 5" | FN-M17-7.2.3 |
| EL-M17-S10-201 | text | visible-default | "0" | FN-M17-7.2.3 |
| EL-M17-S10-202 | heading | visible-default | "Geografi" | FN-M17-7.2.3 |
| EL-M17-S10-203 | text | visible-default | "5,692 soalan" | FN-M17-7.2.3 |
| EL-M17-S10-204 | text | visible-default | "Lvl 1" | FN-M17-7.2.3 |
| EL-M17-S10-205 | text | visible-default | "3480" | FN-M17-7.2.3 |
| EL-M17-S10-206 | text | visible-default | "Lvl 2" | FN-M17-7.2.3 |
| EL-M17-S10-207 | text | visible-default | "1659" | FN-M17-7.2.3 |
| EL-M17-S10-208 | text | visible-default | "Lvl 3" | FN-M17-7.2.3 |
| EL-M17-S10-209 | text | visible-default | "383" | FN-M17-7.2.3 |
| EL-M17-S10-210 | text | visible-default | "Lvl 4" | FN-M17-7.2.3 |
| EL-M17-S10-211 | text | visible-default | "170" | FN-M17-7.2.3 |
| EL-M17-S10-212 | text | visible-default | "Lvl 5" | FN-M17-7.2.3 |
| EL-M17-S10-213 | text | visible-default | "0" | FN-M17-7.2.3 |
| EL-M17-S10-214 | heading | visible-default | "Jawi" | FN-M17-7.2.3 |
| EL-M17-S10-215 | text | visible-default | "2,100 soalan" | FN-M17-7.2.3 |
| EL-M17-S10-216 | text | visible-default | "Lvl 1" | FN-M17-7.2.3 |
| EL-M17-S10-217 | text | visible-default | "2016" | FN-M17-7.2.3 |
| EL-M17-S10-218 | text | visible-default | "Lvl 2" | FN-M17-7.2.3 |
| EL-M17-S10-219 | text | visible-default | "42" | FN-M17-7.2.3 |
| EL-M17-S10-220 | text | visible-default | "Lvl 3" | FN-M17-7.2.3 |
| EL-M17-S10-221 | text | visible-default | "21" | FN-M17-7.2.3 |
| EL-M17-S10-222 | text | visible-default | "Lvl 4" | FN-M17-7.2.3 |
| EL-M17-S10-223 | text | visible-default | "21" | FN-M17-7.2.3 |
| EL-M17-S10-224 | text | visible-default | "Lvl 5" | FN-M17-7.2.3 |
| EL-M17-S10-225 | text | visible-default | "0" | FN-M17-7.2.3 |
| EL-M17-S10-226 | heading | visible-default | "Kimia" | FN-M17-7.2.3 |
| EL-M17-S10-227 | text | visible-default | "2,223 soalan" | FN-M17-7.2.3 |
| EL-M17-S10-228 | text | visible-default | "Lvl 1" | FN-M17-7.2.3 |
| EL-M17-S10-229 | text | visible-default | "42" | FN-M17-7.2.3 |
| EL-M17-S10-230 | text | visible-default | "Lvl 2" | FN-M17-7.2.3 |
| EL-M17-S10-231 | text | visible-default | "1557" | FN-M17-7.2.3 |
| EL-M17-S10-232 | text | visible-default | "Lvl 3" | FN-M17-7.2.3 |
| EL-M17-S10-233 | text | visible-default | "492" | FN-M17-7.2.3 |
| EL-M17-S10-234 | text | visible-default | "Lvl 4" | FN-M17-7.2.3 |
| EL-M17-S10-235 | text | visible-default | "132" | FN-M17-7.2.3 |
| EL-M17-S10-236 | text | visible-default | "Lvl 5" | FN-M17-7.2.3 |
| EL-M17-S10-237 | text | visible-default | "0" | FN-M17-7.2.3 |
| EL-M17-S10-238 | heading | visible-default | "Matematik" | FN-M17-7.2.3 |
| EL-M17-S10-239 | text | visible-default | "13,354 soalan" | FN-M17-7.2.3 |
| EL-M17-S10-240 | text | visible-default | "Lvl 1" | FN-M17-7.2.3 |
| EL-M17-S10-241 | text | visible-default | "3614" | FN-M17-7.2.3 |
| EL-M17-S10-242 | text | visible-default | "Lvl 2" | FN-M17-7.2.3 |
| EL-M17-S10-243 | text | visible-default | "4398" | FN-M17-7.2.3 |
| EL-M17-S10-244 | text | visible-default | "Lvl 3" | FN-M17-7.2.3 |
| EL-M17-S10-245 | text | visible-default | "4460" | FN-M17-7.2.3 |
| EL-M17-S10-246 | text | visible-default | "Lvl 4" | FN-M17-7.2.3 |
| EL-M17-S10-247 | text | visible-default | "882" | FN-M17-7.2.3 |
| EL-M17-S10-248 | text | visible-default | "Lvl 5" | FN-M17-7.2.3 |
| EL-M17-S10-249 | text | visible-default | "0" | FN-M17-7.2.3 |
| EL-M17-S10-250 | heading | visible-default | "Matematik Tambahan" | FN-M17-7.2.3 |
| EL-M17-S10-251 | text | visible-default | "2,078 soalan" | FN-M17-7.2.3 |
| EL-M17-S10-252 | text | visible-default | "Lvl 1" | FN-M17-7.2.3 |
| EL-M17-S10-253 | text | visible-default | "0" | FN-M17-7.2.3 |
| EL-M17-S10-254 | text | visible-default | "Lvl 2" | FN-M17-7.2.3 |
| EL-M17-S10-255 | text | visible-default | "985" | FN-M17-7.2.3 |
| EL-M17-S10-256 | text | visible-default | "Lvl 3" | FN-M17-7.2.3 |
| EL-M17-S10-257 | text | visible-default | "976" | FN-M17-7.2.3 |
| EL-M17-S10-258 | text | visible-default | "Lvl 4" | FN-M17-7.2.3 |
| EL-M17-S10-259 | text | visible-default | "117" | FN-M17-7.2.3 |
| EL-M17-S10-260 | text | visible-default | "Lvl 5" | FN-M17-7.2.3 |
| EL-M17-S10-261 | text | visible-default | "0" | FN-M17-7.2.3 |
| EL-M17-S10-262 | heading | visible-default | "Pendidikan Al-Quran & As-Sunnah" | FN-M17-7.2.3 |
| EL-M17-S10-263 | text | visible-default | "1,000 soalan" | FN-M17-7.2.3 |
| EL-M17-S10-264 | text | visible-default | "Lvl 1" | FN-M17-7.2.3 |
| EL-M17-S10-265 | text | visible-default | "340" | FN-M17-7.2.3 |
| EL-M17-S10-266 | text | visible-default | "Lvl 2" | FN-M17-7.2.3 |
| EL-M17-S10-267 | text | visible-default | "330" | FN-M17-7.2.3 |
| EL-M17-S10-268 | text | visible-default | "Lvl 3" | FN-M17-7.2.3 |
| EL-M17-S10-269 | text | visible-default | "330" | FN-M17-7.2.3 |
| EL-M17-S10-270 | text | visible-default | "Lvl 4" | FN-M17-7.2.3 |
| EL-M17-S10-271 | text | visible-default | "0" | FN-M17-7.2.3 |
| EL-M17-S10-272 | text | visible-default | "Lvl 5" | FN-M17-7.2.3 |
| EL-M17-S10-273 | text | visible-default | "0" | FN-M17-7.2.3 |
| EL-M17-S10-274 | heading | visible-default | "Pendidikan Islam" | FN-M17-7.2.3 |
| EL-M17-S10-275 | text | visible-default | "9,152 soalan" | FN-M17-7.2.3 |
| EL-M17-S10-276 | text | visible-default | "Lvl 1" | FN-M17-7.2.3 |
| EL-M17-S10-277 | text | visible-default | "4614" | FN-M17-7.2.3 |
| EL-M17-S10-278 | text | visible-default | "Lvl 2" | FN-M17-7.2.3 |
| EL-M17-S10-279 | text | visible-default | "1907" | FN-M17-7.2.3 |
| EL-M17-S10-280 | text | visible-default | "Lvl 3" | FN-M17-7.2.3 |
| EL-M17-S10-281 | text | visible-default | "1937" | FN-M17-7.2.3 |
| EL-M17-S10-282 | text | visible-default | "Lvl 4" | FN-M17-7.2.3 |
| EL-M17-S10-283 | text | visible-default | "694" | FN-M17-7.2.3 |
| EL-M17-S10-284 | text | visible-default | "Lvl 5" | FN-M17-7.2.3 |
| EL-M17-S10-285 | text | visible-default | "0" | FN-M17-7.2.3 |
| EL-M17-S10-286 | heading | visible-default | "Pendidikan Jasmani & Kesihatan" | FN-M17-7.2.3 |
| EL-M17-S10-287 | text | visible-default | "2,900 soalan" | FN-M17-7.2.3 |
| EL-M17-S10-288 | text | visible-default | "Lvl 1" | FN-M17-7.2.3 |
| EL-M17-S10-289 | text | visible-default | "2372" | FN-M17-7.2.3 |
| EL-M17-S10-290 | text | visible-default | "Lvl 2" | FN-M17-7.2.3 |
| EL-M17-S10-291 | text | visible-default | "264" | FN-M17-7.2.3 |
| EL-M17-S10-292 | text | visible-default | "Lvl 3" | FN-M17-7.2.3 |
| EL-M17-S10-293 | text | visible-default | "264" | FN-M17-7.2.3 |
| EL-M17-S10-294 | text | visible-default | "Lvl 4" | FN-M17-7.2.3 |
| EL-M17-S10-295 | text | visible-default | "0" | FN-M17-7.2.3 |
| EL-M17-S10-296 | text | visible-default | "Lvl 5" | FN-M17-7.2.3 |
| EL-M17-S10-297 | text | visible-default | "0" | FN-M17-7.2.3 |
| EL-M17-S10-298 | heading | visible-default | "Pendidikan Moral" | FN-M17-7.2.3 |
| EL-M17-S10-299 | text | visible-default | "15,414 soalan" | FN-M17-7.2.3 |
| EL-M17-S10-300 | text | visible-default | "Lvl 1" | FN-M17-7.2.3 |
| EL-M17-S10-301 | text | visible-default | "2763" | FN-M17-7.2.3 |
| EL-M17-S10-302 | text | visible-default | "Lvl 2" | FN-M17-7.2.3 |
| EL-M17-S10-303 | text | visible-default | "6686" | FN-M17-7.2.3 |
| EL-M17-S10-304 | text | visible-default | "Lvl 3" | FN-M17-7.2.3 |
| EL-M17-S10-305 | text | visible-default | "3959" | FN-M17-7.2.3 |
| EL-M17-S10-306 | text | visible-default | "Lvl 4" | FN-M17-7.2.3 |
| EL-M17-S10-307 | text | visible-default | "2006" | FN-M17-7.2.3 |
| EL-M17-S10-308 | text | visible-default | "Lvl 5" | FN-M17-7.2.3 |
| EL-M17-S10-309 | text | visible-default | "0" | FN-M17-7.2.3 |
| EL-M17-S10-310 | heading | visible-default | "Pendidikan Muzik" | FN-M17-7.2.3 |
| EL-M17-S10-311 | text | visible-default | "1,800 soalan" | FN-M17-7.2.3 |
| EL-M17-S10-312 | text | visible-default | "Lvl 1" | FN-M17-7.2.3 |
| EL-M17-S10-313 | text | visible-default | "1008" | FN-M17-7.2.3 |
| EL-M17-S10-314 | text | visible-default | "Lvl 2" | FN-M17-7.2.3 |
| EL-M17-S10-315 | text | visible-default | "396" | FN-M17-7.2.3 |
| EL-M17-S10-316 | text | visible-default | "Lvl 3" | FN-M17-7.2.3 |
| EL-M17-S10-317 | text | visible-default | "396" | FN-M17-7.2.3 |
| EL-M17-S10-318 | text | visible-default | "Lvl 4" | FN-M17-7.2.3 |
| EL-M17-S10-319 | text | visible-default | "0" | FN-M17-7.2.3 |
| EL-M17-S10-320 | text | visible-default | "Lvl 5" | FN-M17-7.2.3 |
| EL-M17-S10-321 | text | visible-default | "0" | FN-M17-7.2.3 |
| EL-M17-S10-322 | heading | visible-default | "Pendidikan Seni Visual" | FN-M17-7.2.3 |
| EL-M17-S10-323 | text | visible-default | "4,910 soalan" | FN-M17-7.2.3 |
| EL-M17-S10-324 | text | visible-default | "Lvl 1" | FN-M17-7.2.3 |
| EL-M17-S10-325 | text | visible-default | "1914" | FN-M17-7.2.3 |
| EL-M17-S10-326 | text | visible-default | "Lvl 2" | FN-M17-7.2.3 |
| EL-M17-S10-327 | text | visible-default | "1191" | FN-M17-7.2.3 |
| EL-M17-S10-328 | text | visible-default | "Lvl 3" | FN-M17-7.2.3 |
| EL-M17-S10-329 | text | visible-default | "1490" | FN-M17-7.2.3 |
| EL-M17-S10-330 | text | visible-default | "Lvl 4" | FN-M17-7.2.3 |
| EL-M17-S10-331 | text | visible-default | "315" | FN-M17-7.2.3 |
| EL-M17-S10-332 | text | visible-default | "Lvl 5" | FN-M17-7.2.3 |
| EL-M17-S10-333 | text | visible-default | "0" | FN-M17-7.2.3 |
| EL-M17-S10-334 | heading | visible-default | "Pendidikan Syariah Islamiah" | FN-M17-7.2.3 |
| EL-M17-S10-335 | text | visible-default | "1,228 soalan" | FN-M17-7.2.3 |
| EL-M17-S10-336 | text | visible-default | "Lvl 1" | FN-M17-7.2.3 |
| EL-M17-S10-337 | text | visible-default | "0" | FN-M17-7.2.3 |
| EL-M17-S10-338 | text | visible-default | "Lvl 2" | FN-M17-7.2.3 |
| EL-M17-S10-339 | text | visible-default | "384" | FN-M17-7.2.3 |
| EL-M17-S10-340 | text | visible-default | "Lvl 3" | FN-M17-7.2.3 |
| EL-M17-S10-341 | text | visible-default | "522" | FN-M17-7.2.3 |
| EL-M17-S10-342 | text | visible-default | "Lvl 4" | FN-M17-7.2.3 |
| EL-M17-S10-343 | text | visible-default | "322" | FN-M17-7.2.3 |
| EL-M17-S10-344 | text | visible-default | "Lvl 5" | FN-M17-7.2.3 |
| EL-M17-S10-345 | text | visible-default | "0" | FN-M17-7.2.3 |
| EL-M17-S10-346 | heading | visible-default | "Perniagaan" | FN-M17-7.2.3 |
| EL-M17-S10-347 | text | visible-default | "2,732 soalan" | FN-M17-7.2.3 |
| EL-M17-S10-348 | text | visible-default | "Lvl 1" | FN-M17-7.2.3 |
| EL-M17-S10-349 | text | visible-default | "475" | FN-M17-7.2.3 |
| EL-M17-S10-350 | text | visible-default | "Lvl 2" | FN-M17-7.2.3 |
| EL-M17-S10-351 | text | visible-default | "1532" | FN-M17-7.2.3 |
| EL-M17-S10-352 | text | visible-default | "Lvl 3" | FN-M17-7.2.3 |
| EL-M17-S10-353 | text | visible-default | "641" | FN-M17-7.2.3 |
| EL-M17-S10-354 | text | visible-default | "Lvl 4" | FN-M17-7.2.3 |
| EL-M17-S10-355 | text | visible-default | "84" | FN-M17-7.2.3 |
| EL-M17-S10-356 | text | visible-default | "Lvl 5" | FN-M17-7.2.3 |
| EL-M17-S10-357 | text | visible-default | "0" | FN-M17-7.2.3 |
| EL-M17-S10-358 | heading | visible-default | "Prinsip Perakaunan" | FN-M17-7.2.3 |
| EL-M17-S10-359 | text | visible-default | "2,329 soalan" | FN-M17-7.2.3 |
| EL-M17-S10-360 | text | visible-default | "Lvl 1" | FN-M17-7.2.3 |
| EL-M17-S10-361 | text | visible-default | "240" | FN-M17-7.2.3 |
| EL-M17-S10-362 | text | visible-default | "Lvl 2" | FN-M17-7.2.3 |
| EL-M17-S10-363 | text | visible-default | "1526" | FN-M17-7.2.3 |
| EL-M17-S10-364 | text | visible-default | "Lvl 3" | FN-M17-7.2.3 |
| EL-M17-S10-365 | text | visible-default | "384" | FN-M17-7.2.3 |
| EL-M17-S10-366 | text | visible-default | "Lvl 4" | FN-M17-7.2.3 |
| EL-M17-S10-367 | text | visible-default | "179" | FN-M17-7.2.3 |
| EL-M17-S10-368 | text | visible-default | "Lvl 5" | FN-M17-7.2.3 |
| EL-M17-S10-369 | text | visible-default | "0" | FN-M17-7.2.3 |
| EL-M17-S10-370 | heading | visible-default | "Reka Bentuk & Teknologi" | FN-M17-7.2.3 |
| EL-M17-S10-371 | text | visible-default | "200 soalan" | FN-M17-7.2.3 |
| EL-M17-S10-372 | text | visible-default | "Lvl 1" | FN-M17-7.2.3 |
| EL-M17-S10-373 | text | visible-default | "68" | FN-M17-7.2.3 |
| EL-M17-S10-374 | text | visible-default | "Lvl 2" | FN-M17-7.2.3 |
| EL-M17-S10-375 | text | visible-default | "66" | FN-M17-7.2.3 |
| EL-M17-S10-376 | text | visible-default | "Lvl 3" | FN-M17-7.2.3 |
| EL-M17-S10-377 | text | visible-default | "66" | FN-M17-7.2.3 |
| EL-M17-S10-378 | text | visible-default | "Lvl 4" | FN-M17-7.2.3 |
| EL-M17-S10-379 | text | visible-default | "0" | FN-M17-7.2.3 |
| EL-M17-S10-380 | text | visible-default | "Lvl 5" | FN-M17-7.2.3 |
| EL-M17-S10-381 | text | visible-default | "0" | FN-M17-7.2.3 |
| EL-M17-S10-382 | heading | visible-default | "Sains" | FN-M17-7.2.3 |
| EL-M17-S10-383 | text | visible-default | "12,128 soalan" | FN-M17-7.2.3 |
| EL-M17-S10-384 | text | visible-default | "Lvl 1" | FN-M17-7.2.3 |
| EL-M17-S10-385 | text | visible-default | "3846" | FN-M17-7.2.3 |
| EL-M17-S10-386 | text | visible-default | "Lvl 2" | FN-M17-7.2.3 |
| EL-M17-S10-387 | text | visible-default | "4363" | FN-M17-7.2.3 |
| EL-M17-S10-388 | text | visible-default | "Lvl 3" | FN-M17-7.2.3 |
| EL-M17-S10-389 | text | visible-default | "3176" | FN-M17-7.2.3 |
| EL-M17-S10-390 | text | visible-default | "Lvl 4" | FN-M17-7.2.3 |
| EL-M17-S10-391 | text | visible-default | "743" | FN-M17-7.2.3 |
| EL-M17-S10-392 | text | visible-default | "Lvl 5" | FN-M17-7.2.3 |
| EL-M17-S10-393 | text | visible-default | "0" | FN-M17-7.2.3 |
| EL-M17-S10-394 | heading | visible-default | "Sains Komputer" | FN-M17-7.2.3 |
| EL-M17-S10-395 | text | visible-default | "1,100 soalan" | FN-M17-7.2.3 |
| EL-M17-S10-396 | text | visible-default | "Lvl 1" | FN-M17-7.2.3 |
| EL-M17-S10-397 | text | visible-default | "374" | FN-M17-7.2.3 |
| EL-M17-S10-398 | text | visible-default | "Lvl 2" | FN-M17-7.2.3 |
| EL-M17-S10-399 | text | visible-default | "363" | FN-M17-7.2.3 |
| EL-M17-S10-400 | text | visible-default | "Lvl 3" | FN-M17-7.2.3 |
| EL-M17-S10-401 | text | visible-default | "363" | FN-M17-7.2.3 |
| EL-M17-S10-402 | text | visible-default | "Lvl 4" | FN-M17-7.2.3 |
| EL-M17-S10-403 | text | visible-default | "0" | FN-M17-7.2.3 |
| EL-M17-S10-404 | text | visible-default | "Lvl 5" | FN-M17-7.2.3 |
| EL-M17-S10-405 | text | visible-default | "0" | FN-M17-7.2.3 |
| EL-M17-S10-406 | heading | visible-default | "Sejarah" | FN-M17-7.2.3 |
| EL-M17-S10-407 | text | visible-default | "6,468 soalan" | FN-M17-7.2.3 |
| EL-M17-S10-408 | text | visible-default | "Lvl 1" | FN-M17-7.2.3 |
| EL-M17-S10-409 | text | visible-default | "1075" | FN-M17-7.2.3 |
| EL-M17-S10-410 | text | visible-default | "Lvl 2" | FN-M17-7.2.3 |
| EL-M17-S10-411 | text | visible-default | "4015" | FN-M17-7.2.3 |
| EL-M17-S10-412 | text | visible-default | "Lvl 3" | FN-M17-7.2.3 |
| EL-M17-S10-413 | text | visible-default | "1158" | FN-M17-7.2.3 |
| EL-M17-S10-414 | text | visible-default | "Lvl 4" | FN-M17-7.2.3 |
| EL-M17-S10-415 | text | visible-default | "220" | FN-M17-7.2.3 |
| EL-M17-S10-416 | text | visible-default | "Lvl 5" | FN-M17-7.2.3 |
| EL-M17-S10-417 | text | visible-default | "0" | FN-M17-7.2.3 |
| EL-M17-S10-418 | heading | visible-default | "Tasawwur Islam" | FN-M17-7.2.3 |
| EL-M17-S10-419 | text | visible-default | "1,300 soalan" | FN-M17-7.2.3 |
| EL-M17-S10-420 | text | visible-default | "Lvl 1" | FN-M17-7.2.3 |
| EL-M17-S10-421 | text | visible-default | "291" | FN-M17-7.2.3 |
| EL-M17-S10-422 | text | visible-default | "Lvl 2" | FN-M17-7.2.3 |
| EL-M17-S10-423 | text | visible-default | "192" | FN-M17-7.2.3 |
| EL-M17-S10-424 | text | visible-default | "Lvl 3" | FN-M17-7.2.3 |
| EL-M17-S10-425 | text | visible-default | "500" | FN-M17-7.2.3 |
| EL-M17-S10-426 | text | visible-default | "Lvl 4" | FN-M17-7.2.3 |
| EL-M17-S10-427 | text | visible-default | "317" | FN-M17-7.2.3 |
| EL-M17-S10-428 | text | visible-default | "Lvl 5" | FN-M17-7.2.3 |
| EL-M17-S10-429 | text | visible-default | "0" | FN-M17-7.2.3 |
| EL-M17-S10-430 | card | visible-default | "Status Kurikulum" | FN-M17-7.2.4 |
| EL-M17-S10-431 | heading | visible-default | "Status Kurikulum" | FN-M17-7.2.4 |
| EL-M17-S10-432 | text | visible-default | "Subjek yang mempunyai bab vs subjek tanpa bab" | FN-M17-7.2.4 |
| EL-M17-S10-433 | text | visible-default | "Bahasa Melayu" | FN-M17-7.2.4 |
| EL-M17-S10-434 | text | visible-default | "84 bab" | FN-M17-7.2.4 |
| EL-M17-S10-435 | text | visible-default | "Bahasa Inggeris" | FN-M17-7.2.4 |
| EL-M17-S10-436 | text | visible-default | "46 bab" | FN-M17-7.2.4 |
| EL-M17-S10-437 | text | visible-default | "Matematik" | FN-M17-7.2.4 |
| EL-M17-S10-438 | text | visible-default | "94 bab" | FN-M17-7.2.4 |
| EL-M17-S10-439 | text | visible-default | "Sains" | FN-M17-7.2.4 |
| EL-M17-S10-440 | text | visible-default | "109 bab" | FN-M17-7.2.4 |
| EL-M17-S10-441 | text | visible-default | "Sejarah" | FN-M17-7.2.4 |
| EL-M17-S10-442 | text | visible-default | "40 bab" | FN-M17-7.2.4 |
| EL-M17-S10-443 | text | visible-default | "Pendidikan Islam" | FN-M17-7.2.4 |
| EL-M17-S10-444 | text | visible-default | "69 bab" | FN-M17-7.2.4 |
| EL-M17-S10-445 | text | visible-default | "Pendidikan Moral" | FN-M17-7.2.4 |
| EL-M17-S10-446 | text | visible-default | "91 bab" | FN-M17-7.2.4 |
| EL-M17-S10-447 | text | visible-default | "Matematik Tambahan" | FN-M17-7.2.4 |
| EL-M17-S10-448 | text | visible-default | "18 bab" | FN-M17-7.2.4 |
| EL-M17-S10-449 | text | visible-default | "Fizik" | FN-M17-7.2.4 |
| EL-M17-S10-450 | text | visible-default | "2 bab" | FN-M17-7.2.4 |
| EL-M17-S10-451 | text | visible-default | "Kimia" | FN-M17-7.2.4 |
| EL-M17-S10-452 | text | visible-default | "14 bab" | FN-M17-7.2.4 |
| EL-M17-S10-453 | text | visible-default | "Biologi" | FN-M17-7.2.4 |
| EL-M17-S10-454 | text | visible-default | "41 bab" | FN-M17-7.2.4 |
| EL-M17-S10-455 | text | visible-default | "Geografi" | FN-M17-7.2.4 |
| EL-M17-S10-456 | text | visible-default | "50 bab" | FN-M17-7.2.4 |
| EL-M17-S10-457 | text | visible-default | "Pendidikan Seni Visual" | FN-M17-7.2.4 |
| EL-M17-S10-458 | text | visible-default | "155 bab" | FN-M17-7.2.4 |
| EL-M17-S10-459 | text | visible-default | "Pendidikan Muzik" | FN-M17-7.2.4 |
| EL-M17-S10-460 | text | visible-default | "56 bab" | FN-M17-7.2.4 |
| EL-M17-S10-461 | text | visible-default | "Pendidikan Jasmani & Kesihatan" | FN-M17-7.2.4 |
| EL-M17-S10-462 | text | visible-default | "48 bab" | FN-M17-7.2.4 |
| EL-M17-S10-463 | text | visible-default | "Reka Bentuk & Teknologi" | FN-M17-7.2.4 |
| EL-M17-S10-464 | text | visible-default | "48 bab" | FN-M17-7.2.4 |
| EL-M17-S10-465 | text | visible-default | "Sains Komputer" | FN-M17-7.2.4 |
| EL-M17-S10-466 | text | visible-default | "122 bab" | FN-M17-7.2.4 |
| EL-M17-S10-467 | text | visible-default | "Bahasa Arab" | FN-M17-7.2.4 |
| EL-M17-S10-468 | text | visible-default | "55 bab" | FN-M17-7.2.4 |
| EL-M17-S10-469 | text | visible-default | "Bahasa Cina" | FN-M17-7.2.4 |
| EL-M17-S10-470 | text | visible-default | "1 bab" | FN-M17-7.2.4 |
| EL-M17-S10-471 | text | visible-default | "Bahasa Tamil" | FN-M17-7.2.4 |
| EL-M17-S10-472 | text | visible-default | "79 bab" | FN-M17-7.2.4 |
| EL-M17-S10-473 | text | visible-default | "Prinsip Perakaunan" | FN-M17-7.2.4 |
| EL-M17-S10-474 | text | visible-default | "14 bab" | FN-M17-7.2.4 |
| EL-M17-S10-475 | text | visible-default | "Ekonomi" | FN-M17-7.2.4 |
| EL-M17-S10-476 | text | visible-default | "10 bab" | FN-M17-7.2.4 |
| EL-M17-S10-477 | text | visible-default | "Perniagaan" | FN-M17-7.2.4 |
| EL-M17-S10-478 | text | visible-default | "14 bab" | FN-M17-7.2.4 |
| EL-M17-S10-479 | text | visible-default | "Pendidikan Al-Quran & As-Sunnah" | FN-M17-7.2.4 |
| EL-M17-S10-480 | text | visible-default | "10 bab" | FN-M17-7.2.4 |
| EL-M17-S10-481 | text | visible-default | "Tasawwur Islam" | FN-M17-7.2.4 |
| EL-M17-S10-482 | text | visible-default | "10 bab" | FN-M17-7.2.4 |
| EL-M17-S10-483 | text | visible-default | "Jawi" | FN-M17-7.2.4 |
| EL-M17-S10-484 | text | visible-default | "21 bab" | FN-M17-7.2.4 |
| EL-M17-S10-485 | text | visible-default | "Pendidikan Syariah Islamiah" | FN-M17-7.2.4 |
| EL-M17-S10-486 | text | visible-default | "9 bab" | FN-M17-7.2.4 |
| EL-M17-S10-487 | text | visible-default | "Sains Rumah Tangga" | FN-M17-7.2.4 |
| EL-M17-S10-488 | text | visible-default | "1 bab" | FN-M17-7.2.4 |
| EL-M17-S10-489 | text | visible-default | "Pembuatan Pakaian Wanita" | FN-M17-7.2.4 |
| EL-M17-S10-490 | empty-state | visible-default | "Tiada bab" | FN-M17-7.2.4 |
| EL-M17-S10-491 | text | visible-default | "Pertanian" | FN-M17-7.2.4 |
| EL-M17-S10-492 | empty-state | visible-default | "Tiada bab" | FN-M17-7.2.4 |
| EL-M17-S10-493 | text | visible-default | "Sains Sukan" | FN-M17-7.2.4 |
| EL-M17-S10-494 | empty-state | visible-default | "Tiada bab" | FN-M17-7.2.4 |

#### S11 — `/admin/laporan` (173 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M17-S11-001 | tab | visible-default | "Overview", fa-chart-pie | FN-M17-8.1.1 |
| EL-M17-S11-002 | tab | visible-default | "Sekolah (61)", fa-school | FN-M17-8.1.1 |
| EL-M17-S11-003 | tab | visible-default | "Guru (551)", fa-chalkboard-teacher | FN-M17-8.1.1 |
| EL-M17-S11-004 | tab | visible-default | "Murid (4,533)", fa-user-graduate | FN-M17-8.1.1 |
| EL-M17-S11-005 | text | visible-default | "Tempoh:", fa-calendar-alt | FN-M17-8.1.2 |
| EL-M17-S11-006 | link | visible-default | "7 Hari", → /admin/laporan?range=7 | FN-M17-8.1.2 |
| EL-M17-S11-007 | link | visible-default | "30 Hari", → /admin/laporan?range=30 | FN-M17-8.1.2 |
| EL-M17-S11-008 | link | visible-default | "3 Bulan", → /admin/laporan?range=90 | FN-M17-8.1.2 |
| EL-M17-S11-009 | card | visible-default | "54%" | FN-M17-8.2.1 |
| EL-M17-S11-010 | text | visible-default | "54%" | FN-M17-8.2.1 |
| EL-M17-S11-011 | text | visible-default | "Murid Pernah Login" | FN-M17-8.2.1 |
| EL-M17-S11-012 | text | visible-default | "/ 3,152" | FN-M17-8.2.1 |
| EL-M17-S11-013 | text | visible-default | "1,708" | FN-M17-8.2.1 |
| EL-M17-S11-014 | text | visible-default | "1,444 belum pernah login", fa-exclamation-circle | FN-M17-8.2.1 |
| EL-M17-S11-015 | card | visible-default | "54%" | FN-M17-8.2.1 |
| EL-M17-S11-016 | text | visible-default | "54%" | FN-M17-8.2.1 |
| EL-M17-S11-017 | text | visible-default | "Cikgu Pernah Login" | FN-M17-8.2.1 |
| EL-M17-S11-018 | text | visible-default | "/ 502" | FN-M17-8.2.1 |
| EL-M17-S11-019 | text | visible-default | "269" | FN-M17-8.2.1 |
| EL-M17-S11-020 | text | visible-default | "233 belum pernah login", fa-exclamation-circle | FN-M17-8.2.1 |
| EL-M17-S11-021 | card | visible-default | "52%" | FN-M17-8.2.1 |
| EL-M17-S11-022 | text | visible-default | "52%" | FN-M17-8.2.1 |
| EL-M17-S11-023 | text | visible-default | "Murid Buat Latihan" | FN-M17-8.2.1 |
| EL-M17-S11-024 | text | visible-default | "/ 3,152" | FN-M17-8.2.1 |
| EL-M17-S11-025 | text | visible-default | "1,642" | FN-M17-8.2.1 |
| EL-M17-S11-026 | card | visible-default | "3,522" | FN-M17-8.2.2 |
| EL-M17-S11-027 | text | visible-default | "3,522" | FN-M17-8.2.2 |
| EL-M17-S11-028 | text | visible-default | "Jumlah Aktiviti" | FN-M17-8.2.2 |
| EL-M17-S11-029 | text | visible-default | "30 hari lepas" | FN-M17-8.2.2 |
| EL-M17-S11-030 | card | visible-default | "44.6%" | FN-M17-8.2.2 |
| EL-M17-S11-031 | text | visible-default | "44.6%" | FN-M17-8.2.2 |
| EL-M17-S11-032 | text | visible-default | "Skor Purata" | FN-M17-8.2.2 |
| EL-M17-S11-033 | badge | visible-default | "Struktur: 6.7%" | FN-M17-8.2.2 |
| EL-M17-S11-034 | card | visible-default | "Trend Aktiviti" | FN-M17-8.2.3 |
| EL-M17-S11-035 | heading | visible-default | "Trend Aktiviti" | FN-M17-8.2.3 |
| EL-M17-S11-036 | card | visible-default | "Pecahan Aktiviti" | FN-M17-8.2.4 |
| EL-M17-S11-037 | heading | visible-default | "Pecahan Aktiviti" | FN-M17-8.2.4 |
| EL-M17-S11-038 | text | visible-default | "Kuiz Objektif" | FN-M17-8.2.4 |
| EL-M17-S11-039 | text | visible-default | "0" | FN-M17-8.2.4 |
| EL-M17-S11-040 | text | visible-default | "Soalan Berstruktur" | FN-M17-8.2.4 |
| EL-M17-S11-041 | text | visible-default | "13" | FN-M17-8.2.4 |
| EL-M17-S11-042 | text | visible-default | "Battle Arena" | FN-M17-8.2.4 |
| EL-M17-S11-043 | text | visible-default | "4" | FN-M17-8.2.4 |
| EL-M17-S11-044 | text | visible-default | "Permainan" | FN-M17-8.2.4 |
| EL-M17-S11-045 | text | visible-default | "5" | FN-M17-8.2.4 |
| EL-M17-S11-046 | card | visible-default | "Pelajar Paling Aktif" | FN-M17-8.2.5 |
| EL-M17-S11-047 | heading | visible-default | "Pelajar Paling Aktif" | FN-M17-8.2.5 |
| EL-M17-S11-048 | badge | visible-default | "1" | FN-M17-8.2.5 |
| EL-M17-S11-049 | text | visible-default | "<masked>" | FN-M17-8.2.5 |
| EL-M17-S11-050 | text | visible-default | "923" | FN-M17-8.2.5 |
| EL-M17-S11-051 | badge | visible-default | "2" | FN-M17-8.2.5 |
| EL-M17-S11-052 | text | visible-default | "<masked>" | FN-M17-8.2.5 |
| EL-M17-S11-053 | text | visible-default | "38" | FN-M17-8.2.5 |
| EL-M17-S11-054 | badge | visible-default | "3" | FN-M17-8.2.5 |
| EL-M17-S11-055 | text | visible-default | "<masked>" | FN-M17-8.2.5 |
| EL-M17-S11-056 | text | visible-default | "23" | FN-M17-8.2.5 |
| EL-M17-S11-057 | badge | visible-default | "4" | FN-M17-8.2.5 |
| EL-M17-S11-058 | text | visible-default | "<masked>" | FN-M17-8.2.5 |
| EL-M17-S11-059 | text | visible-default | "22" | FN-M17-8.2.5 |
| EL-M17-S11-060 | badge | visible-default | "5" | FN-M17-8.2.5 |
| EL-M17-S11-061 | text | visible-default | "<masked>" | FN-M17-8.2.5 |
| EL-M17-S11-062 | text | visible-default | "21" | FN-M17-8.2.5 |
| EL-M17-S11-063 | badge | visible-default | "6" | FN-M17-8.2.5 |
| EL-M17-S11-064 | text | visible-default | "<masked>" | FN-M17-8.2.5 |
| EL-M17-S11-065 | text | visible-default | "19" | FN-M17-8.2.5 |
| EL-M17-S11-066 | badge | visible-default | "7" | FN-M17-8.2.5 |
| EL-M17-S11-067 | text | visible-default | "<masked>" | FN-M17-8.2.5 |
| EL-M17-S11-068 | text | visible-default | "19" | FN-M17-8.2.5 |
| EL-M17-S11-069 | badge | visible-default | "8" | FN-M17-8.2.5 |
| EL-M17-S11-070 | text | visible-default | "<masked>" | FN-M17-8.2.5 |
| EL-M17-S11-071 | text | visible-default | "18" | FN-M17-8.2.5 |
| EL-M17-S11-072 | badge | visible-default | "9" | FN-M17-8.2.5 |
| EL-M17-S11-073 | text | visible-default | "<masked>" | FN-M17-8.2.5 |
| EL-M17-S11-074 | text | visible-default | "16" | FN-M17-8.2.5 |
| EL-M17-S11-075 | badge | visible-default | "10" | FN-M17-8.2.5 |
| EL-M17-S11-076 | text | visible-default | "<masked>" | FN-M17-8.2.5 |
| EL-M17-S11-077 | text | visible-default | "15" | FN-M17-8.2.5 |
| EL-M17-S11-078 | card | visible-default | "Cikgu Belum Login" | FN-M17-8.2.6 |
| EL-M17-S11-079 | heading | visible-default | "Cikgu Belum Login" | FN-M17-8.2.6 |
| EL-M17-S11-080 | text | visible-default | "." | FN-M17-8.2.6 |
| EL-M17-S11-081 | text | visible-default | "<masked>" | FN-M17-8.2.6 |
| EL-M17-S11-082 | text | visible-default | "<masked>" | FN-M17-8.2.6 |
| EL-M17-S11-083 | text | visible-default | "<masked>" | FN-M17-8.2.6 |
| EL-M17-S11-084 | text | visible-default | "<masked>" | FN-M17-8.2.6 |
| EL-M17-S11-085 | text | visible-default | "<masked>" | FN-M17-8.2.6 |
| EL-M17-S11-086 | text | visible-default | "<masked>" | FN-M17-8.2.6 |
| EL-M17-S11-087 | text | visible-default | "<masked>" | FN-M17-8.2.6 |
| EL-M17-S11-088 | text | visible-default | "<masked>" | FN-M17-8.2.6 |
| EL-M17-S11-089 | text | visible-default | "<masked>" | FN-M17-8.2.6 |
| EL-M17-S11-090 | text | visible-default | "<masked>" | FN-M17-8.2.6 |
| EL-M17-S11-091 | text | visible-default | "<masked>" | FN-M17-8.2.6 |
| EL-M17-S11-092 | text | visible-default | "<masked>" | FN-M17-8.2.6 |
| EL-M17-S11-093 | text | visible-default | "<masked>" | FN-M17-8.2.6 |
| EL-M17-S11-094 | text | visible-default | "<masked>" | FN-M17-8.2.6 |
| EL-M17-S11-095 | text | visible-default | "<masked>" | FN-M17-8.2.6 |
| EL-M17-S11-096 | text | visible-default | "<masked>" | FN-M17-8.2.6 |
| EL-M17-S11-097 | text | visible-default | "<masked>" | FN-M17-8.2.6 |
| EL-M17-S11-098 | text | visible-default | "<masked>" | FN-M17-8.2.6 |
| EL-M17-S11-099 | text | visible-default | "<masked>" | FN-M17-8.2.6 |
| EL-M17-S11-100 | text | visible-default | "<masked>" | FN-M17-8.2.6 |
| EL-M17-S11-101 | text | visible-default | "<masked>" | FN-M17-8.2.6 |
| EL-M17-S11-102 | text | visible-default | "<masked>" | FN-M17-8.2.6 |
| EL-M17-S11-103 | text | visible-default | "<masked>" | FN-M17-8.2.6 |
| EL-M17-S11-104 | text | visible-default | "<masked>" | FN-M17-8.2.6 |
| EL-M17-S11-105 | text | visible-default | "<masked>" | FN-M17-8.2.6 |
| EL-M17-S11-106 | text | visible-default | "<masked>" | FN-M17-8.2.6 |
| EL-M17-S11-107 | text | visible-default | "<masked>" | FN-M17-8.2.6 |
| EL-M17-S11-108 | text | visible-default | "<masked>" | FN-M17-8.2.6 |
| EL-M17-S11-109 | text | visible-default | "<masked>" | FN-M17-8.2.6 |
| EL-M17-S11-110 | text | visible-default | "<masked>" | FN-M17-8.2.6 |
| EL-M17-S11-111 | text | visible-default | "<masked>" | FN-M17-8.2.6 |
| EL-M17-S11-112 | text | visible-default | "<masked>" | FN-M17-8.2.6 |
| EL-M17-S11-113 | text | visible-default | "<masked>" | FN-M17-8.2.6 |
| EL-M17-S11-114 | text | visible-default | "<masked>" | FN-M17-8.2.6 |
| EL-M17-S11-115 | text | visible-default | "<masked>" | FN-M17-8.2.6 |
| EL-M17-S11-116 | text | visible-default | "<masked>" | FN-M17-8.2.6 |
| EL-M17-S11-117 | text | visible-default | "<masked>" | FN-M17-8.2.6 |
| EL-M17-S11-118 | text | visible-default | "<masked>" | FN-M17-8.2.6 |
| EL-M17-S11-119 | text | visible-default | "<masked>" | FN-M17-8.2.6 |
| EL-M17-S11-120 | card | conditional | "Aktiviti Mengikut Sekolah" | FN-M17-8.3.1 |
| EL-M17-S11-121 | heading | conditional | "Aktiviti Mengikut Sekolah" | FN-M17-8.3.1 |
| EL-M17-S11-122 | button | conditional | "Semua (61)" | FN-M17-8.3.1 |
| EL-M17-S11-123 | button | conditional | "Aktif (9)" | FN-M17-8.3.1 |
| EL-M17-S11-124 | button | conditional | "Kurang (0)" | FN-M17-8.3.1 |
| EL-M17-S11-125 | button | conditional | "Tidak Aktif (52)" | FN-M17-8.3.1 |
| EL-M17-S11-126 | input | conditional | "Cari sekolah..." | FN-M17-8.3.1 |
| EL-M17-S11-127 | text | conditional | "9" | FN-M17-8.3.1 |
| EL-M17-S11-128 | text | conditional | "Aktif (7 hari)" | FN-M17-8.3.1 |
| EL-M17-S11-129 | text | conditional | "0" | FN-M17-8.3.1 |
| EL-M17-S11-130 | text | conditional | "Kurang Aktif" | FN-M17-8.3.1 |
| EL-M17-S11-131 | text | conditional | "52" | FN-M17-8.3.1 |
| EL-M17-S11-132 | text | conditional | "Tidak Aktif" | FN-M17-8.3.1 |
| EL-M17-S11-133 | table | conditional | table | FN-M17-8.3.1 |
| EL-M17-S11-134 | badge | conditional | "Aktif" | FN-M17-8.3.1 |
| EL-M17-S11-135 | badge | conditional | "Aktif" | FN-M17-8.3.1 |
| EL-M17-S11-136 | badge | conditional | "Aktif" | FN-M17-8.3.1 |
| EL-M17-S11-137 | card | conditional | "Senarai Guru (551)" | FN-M17-8.4.1 |
| EL-M17-S11-138 | heading | conditional | "Senarai Guru (551)" | FN-M17-8.4.1 |
| EL-M17-S11-139 | button | conditional | "Semua" | FN-M17-8.4.1 |
| EL-M17-S11-140 | button | conditional | "Pernah Login (289)" | FN-M17-8.4.1 |
| EL-M17-S11-141 | button | conditional | "Belum Login (262)" | FN-M17-8.4.1 |
| EL-M17-S11-142 | input | conditional | "Cari guru..." | FN-M17-8.4.1 |
| EL-M17-S11-143 | select | conditional | select | FN-M17-8.4.1 |
| EL-M17-S11-144 | text | conditional | "551" | FN-M17-8.4.1 |
| EL-M17-S11-145 | text | conditional | "Jumlah Guru" | FN-M17-8.4.1 |
| EL-M17-S11-146 | text | conditional | "289" | FN-M17-8.4.1 |
| EL-M17-S11-147 | text | conditional | "Pernah Login" | FN-M17-8.4.1 |
| EL-M17-S11-148 | text | conditional | "11,414" | FN-M17-8.4.1 |
| EL-M17-S11-149 | text | conditional | "Jumlah Soalan" | FN-M17-8.4.1 |
| EL-M17-S11-150 | text | conditional | "63,459" | FN-M17-8.4.1 |
| EL-M17-S11-151 | text | conditional | "Jumlah Syiling" | FN-M17-8.4.1 |
| EL-M17-S11-152 | table | conditional | table | FN-M17-8.4.1 |
| EL-M17-S11-153 | card | conditional | "Senarai Murid (4,533) — Top 200" | FN-M17-8.5.1 |
| EL-M17-S11-154 | heading | conditional | "Senarai Murid (4,533) — Top 200" | FN-M17-8.5.1 |
| EL-M17-S11-155 | button | conditional | "Semua" | FN-M17-8.5.1 |
| EL-M17-S11-156 | button | conditional | "Aktif" | FN-M17-8.5.1 |
| EL-M17-S11-157 | button | conditional | "Login Sahaja" | FN-M17-8.5.1 |
| EL-M17-S11-158 | button | conditional | "Belum Login" | FN-M17-8.5.1 |
| EL-M17-S11-159 | input | conditional | "Cari murid..." | FN-M17-8.5.1 |
| EL-M17-S11-160 | select | conditional | select | FN-M17-8.5.1 |
| EL-M17-S11-161 | text | conditional | "4,533" | FN-M17-8.5.1 |
| EL-M17-S11-162 | text | conditional | "Jumlah Murid" | FN-M17-8.5.1 |
| EL-M17-S11-163 | text | conditional | "200" | FN-M17-8.5.1 |
| EL-M17-S11-164 | text | conditional | "Pernah Latihan" | FN-M17-8.5.1 |
| EL-M17-S11-165 | text | conditional | "24,076" | FN-M17-8.5.1 |
| EL-M17-S11-166 | text | conditional | "Jumlah Sesi" | FN-M17-8.5.1 |
| EL-M17-S11-167 | text | conditional | "76.1%" | FN-M17-8.5.1 |
| EL-M17-S11-168 | text | conditional | "Purata Ketepatan" | FN-M17-8.5.1 |
| EL-M17-S11-169 | table | conditional | table | FN-M17-8.5.1 |
| EL-M17-S11-170 | card | conditional | "1,124" | FN-M17-8.2.2 |
| EL-M17-S11-171 | text | conditional | "7 hari lepas" | FN-M17-8.2.2 |
| EL-M17-S11-172 | card | conditional | "14,472" | FN-M17-8.2.2 |
| EL-M17-S11-173 | text | conditional | "90 hari lepas" | FN-M17-8.2.2 |

#### SHA — admin-panel shell (chrome of S1, S8–S11) — 233 elements, 24 M17-relevant

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M17-SHA-001 | link | visible-default | link, → /admin | Excluded — global admin shell chrome (logo, brand, mobile header, copyright footer; shells.md / M23) |
| EL-M17-SHA-002 | image | visible-default | image | Excluded — global admin shell chrome (logo, brand, mobile header, copyright footer; shells.md / M23) |
| EL-M17-SHA-003 | text | visible-default | "Panel Pentadbir" | Excluded — global admin shell chrome (logo, brand, mobile header, copyright footer; shells.md / M23) |
| EL-M17-SHA-004 | link | visible-default | "Command Center LIVE", fa-satellite-dish, → /admin/command-center | FN-M17-1.1.1 |
| EL-M17-SHA-005 | badge | visible-default | "LIVE" | FN-M17-1.1.1 |
| EL-M17-SHA-006 | link | visible-default | "Aktiviti Harian", fa-chart-line, → /admin/command-center/daily-activity | FN-M17-1.1.2 |
| EL-M17-SHA-007 | link | visible-default | "Audio KBAT", fa-headphones, → /admin/audio-kbat | Excluded — "Audio KBAT" (M09) |
| EL-M17-SHA-008 | text | visible-default | "HARIAN" | FN-M17-1.1.2 |
| EL-M17-SHA-009 | link | visible-default | "Dashboard", fa-tachometer-alt, → /admin | FN-M17-1.1.2 |
| EL-M17-SHA-010 | link | visible-default | "Laporan Eksekutif", fa-file-alt, → /admin/laporan-eksekutif | FN-M17-1.1.2 |
| EL-M17-SHA-011 | text | visible-default | "ANALITIK" | FN-M17-1.1.3 |
| EL-M17-SHA-012 | link | visible-default | "Analitik", fa-chart-pie, → /admin/analytics | FN-M17-1.1.3 |
| EL-M17-SHA-013 | link | visible-default | "Monitoring", fa-binoculars, → /admin/monitoring | FN-M17-1.1.3 |
| EL-M17-SHA-014 | toggle | visible-default | "Kirkpatrick", fa-microscope | Excluded — KIRKPATRICK submenu (M12) |
| EL-M17-SHA-015 | link | hidden-only | "Overview", fa-th-large, → /admin/kirkpatrick | Excluded — KIRKPATRICK submenu (M12) |
| EL-M17-SHA-016 | link | hidden-only | "T1: Reaksi", fa-smile, → /admin/kirkpatrick/reaction | Excluded — KIRKPATRICK submenu (M12) |
| EL-M17-SHA-017 | link | hidden-only | "T2: Pembelajaran", fa-brain, → /admin/kirkpatrick/learning | Excluded — KIRKPATRICK submenu (M12) |
| EL-M17-SHA-018 | link | hidden-only | "T3: Tingkah Laku", fa-running, → /admin/kirkpatrick/behavior | Excluded — KIRKPATRICK submenu (M12) |
| EL-M17-SHA-019 | link | hidden-only | "T4: Hasil", fa-trophy, → /admin/kirkpatrick/results | Excluded — KIRKPATRICK submenu (M12) |
| EL-M17-SHA-020 | link | hidden-only | "Rantaian Impak", fa-link, → /admin/kirkpatrick/chain | Excluded — KIRKPATRICK submenu (M12) |
| EL-M17-SHA-021 | link | hidden-only | "Intervensi", fa-hand-holding-medical, → /admin/kirkpatrick/interventions | Excluded — KIRKPATRICK submenu (M12) |
| EL-M17-SHA-022 | link | visible-default | "Laporan", fa-chart-bar, → /admin/laporan | FN-M17-1.1.3 |
| EL-M17-SHA-023 | text | visible-default | "PENGURUSAN" | Excluded — admin-shell group label / toggle of other modules (global shell / M23) |
| EL-M17-SHA-024 | toggle | visible-default | "Kurikulum", fa-sitemap | Excluded — admin-shell group label / toggle of other modules (global shell / M23) |
| EL-M17-SHA-025 | link | hidden-only | "Kurikulum", fa-sitemap, → /admin/curriculum | Excluded — admin-shell link owned by M03 (global shell renders it) |
| EL-M17-SHA-026 | link | hidden-only | "Subjek", fa-book, → /admin/subjects | Excluded — admin-shell link owned by M03 (global shell renders it) |
| EL-M17-SHA-027 | link | hidden-only | "Tahap Pendidikan", fa-graduation-cap, → /admin/education-levels | Excluded — admin-shell link owned by M03 (global shell renders it) |
| EL-M17-SHA-028 | toggle | visible-default | "Soalan", fa-question-circle | Excluded — admin-shell group label / toggle of other modules (global shell / M23) |
| EL-M17-SHA-029 | link | hidden-only | "Senarai Soalan", fa-list, → /admin/questions | Excluded — admin-shell link owned by M04/M07 (global shell renders it) |
| EL-M17-SHA-030 | link | hidden-only | "Import CSV", fa-file-csv, → /admin/questions/import | Excluded — admin-shell link owned by M04/M07 (global shell renders it) |
| EL-M17-SHA-031 | link | hidden-only | "Kualiti Soalan", fa-clipboard-check, → /admin/questions/quality | Excluded — admin-shell link owned by M04/M07 (global shell renders it) |
| EL-M17-SHA-032 | link | hidden-only | "Laporan Soalan", fa-flag, → /admin/question-reports | Excluded — admin-shell link owned by M04/M07 (global shell renders it) |
| EL-M17-SHA-033 | link | hidden-only | "Soalan Berstruktur", fa-list-ol, → /admin/structured-questions | Excluded — admin-shell link owned by M04/M07 (global shell renders it) |
| EL-M17-SHA-034 | link | hidden-only | "Kertas Soalan Guru", fa-file-upload, → /admin/question-submissions | Excluded — admin-shell link owned by M04/M07 (global shell renders it) |
| EL-M17-SHA-035 | toggle | visible-default | "Pengguna", fa-users | Excluded — admin-shell group label / toggle of other modules (global shell / M23) |
| EL-M17-SHA-036 | link | hidden-only | "Senarai Pengguna", fa-users, → /admin/users | Excluded — admin-shell link owned by M02 (global shell renders it) |
| EL-M17-SHA-037 | link | hidden-only | "Sekolah", fa-school, → /admin/schools | Excluded — admin-shell link owned by M02 (global shell renders it) |
| EL-M17-SHA-038 | link | hidden-only | "Langganan Sekolah", fa-file-contract, → /admin/school-subscriptions | Excluded — admin-shell link owned by M02 (global shell renders it) |
| EL-M17-SHA-039 | link | hidden-only | "Import Pelajar", fa-user-plus, → /admin/import-students | Excluded — admin-shell link owned by M02 (global shell renders it) |
| EL-M17-SHA-040 | link | hidden-only | "Pelajar Komplimen", fa-gift, → /admin/comp-students | Excluded — admin-shell link owned by M02 (global shell renders it) |
| EL-M17-SHA-041 | link | hidden-only | "Import Pengguna", fa-users-cog, → /admin/users/bulk-import | Excluded — admin-shell link owned by M02 (global shell renders it) |
| EL-M17-SHA-042 | link | hidden-only | "Penajaan", fa-handshake, → /admin/sponsors | Excluded — admin-shell link owned by M21 (global shell renders it) |
| EL-M17-SHA-043 | link | hidden-only | "Anak Angkat", fa-child, → /admin/anak-angkat | Excluded — admin-shell link owned by M21 (global shell renders it) |
| EL-M17-SHA-044 | link | hidden-only | "Permohonan", fa-file-alt, → /admin/anak-angkat/permohonan | Excluded — admin-shell link owned by M21 (global shell renders it) |
| EL-M17-SHA-045 | toggle | visible-default | "SPM", fa-graduation-cap | Excluded — admin-shell group label / toggle of other modules (global shell / M23) |
| EL-M17-SHA-046 | link | hidden-only | "Databank Soalan", fa-database, → /spm/tahun-lepas | Excluded — admin-shell link owned by M06 (global shell renders it) |
| EL-M17-SHA-047 | link | hidden-only | "Latih Tubi", fa-bolt, → /spm/latih-tubi | Excluded — admin-shell link owned by M06 (global shell renders it) |
| EL-M17-SHA-048 | link | hidden-only | "Tracking A", fa-crosshairs, → /spm/ramalan | Excluded — admin-shell link owned by M06 (global shell renders it) |
| EL-M17-SHA-049 | link | hidden-only | "Subjektif", fa-pen-fancy, → /spm/subjektif | Excluded — admin-shell link owned by M06 (global shell renders it) |
| EL-M17-SHA-050 | toggle | visible-default | "Premium", fa-shield-halved | Excluded — admin-shell group label / toggle of other modules (global shell / M23) |
| EL-M17-SHA-051 | link | hidden-only | "PKSK Soalan", fa-shield-halved, → /admin/pksk/questions | Excluded — admin-shell link owned by M04/M07 (global shell renders it) |
| EL-M17-SHA-052 | link | hidden-only | "PKSK Akses", fa-key, → /admin/pksk/access | Excluded — admin-shell link owned by M04/M07 (global shell renders it) |
| EL-M17-SHA-053 | text | visible-default | "SISTEM" | Excluded — admin-shell group label / toggle of other modules (global shell / M23) |
| EL-M17-SHA-054 | toggle | visible-default | "Gamifikasi", fa-gamepad | Excluded — admin-shell group label / toggle of other modules (global shell / M23) |
| EL-M17-SHA-055 | link | hidden-only | "Overview", fa-gamepad, → /admin/gamification | Excluded — admin-shell link owned by M14/M15 (global shell renders it) |
| EL-M17-SHA-056 | link | hidden-only | "Tier Config", fa-crown, → /admin/gamification/tiers | Excluded — admin-shell link owned by M14/M15 (global shell renders it) |
| EL-M17-SHA-057 | link | hidden-only | "Cabaran", fa-bullseye, → /admin/gamification/challenges | Excluded — admin-shell link owned by M14/M15 (global shell renders it) |
| EL-M17-SHA-058 | link | hidden-only | "Pelajar", fa-users, → /admin/gamification/students | Excluded — admin-shell link owned by M14/M15 (global shell renders it) |
| EL-M17-SHA-059 | link | hidden-only | "Transaksi", fa-receipt, → /admin/gamification/transactions | Excluded — admin-shell link owned by M14/M15 (global shell renders it) |
| EL-M17-SHA-060 | link | hidden-only | "Kedai Hadiah", fa-gift, → /admin/hadiah | Excluded — admin-shell link owned by M14/M15 (global shell renders it) |
| EL-M17-SHA-061 | link | hidden-only | "Gamifikasi Guru", fa-chalkboard-teacher, → /admin/gamifikasi/guru | Excluded — admin-shell link owned by M14/M15 (global shell renders it) |
| EL-M17-SHA-062 | link | hidden-only | "Kawalan Reward", fa-shield-halved, → /admin/reward-control | Excluded — admin-shell link owned by M14/M15 (global shell renders it) |
| EL-M17-SHA-063 | toggle | visible-default | "Battle & Permainan", fa-bolt | Excluded — admin-shell group label / toggle of other modules (global shell / M23) |
| EL-M17-SHA-064 | link | hidden-only | "Battle Live", fa-bolt, → /battle | Excluded — admin-shell link owned by M16 (global shell renders it) |
| EL-M17-SHA-065 | link | hidden-only | "Ranking Sekolah", fa-school, → /battle/ranking-sekolah | Excluded — admin-shell link owned by M16 (global shell renders it) |
| EL-M17-SHA-066 | link | hidden-only | "Leaderboard", fa-trophy, → /battle/leaderboard | Excluded — admin-shell link owned by M16 (global shell renders it) |
| EL-M17-SHA-067 | link | hidden-only | "Tetapan Permainan", fa-dice, → /admin/permainan | Excluded — admin-shell link owned by M16 (global shell renders it) |
| EL-M17-SHA-068 | toggle | visible-default | "Marketplace", fa-shopping-bag | Excluded — admin-shell group label / toggle of other modules (global shell / M23) |
| EL-M17-SHA-069 | link | hidden-only | "Produk", fa-shopping-bag, → /admin/marketplace/products | Excluded — admin-shell link owned by M20 (global shell renders it) |
| EL-M17-SHA-070 | link | hidden-only | "Penjual", fa-store, → /admin/marketplace/sellers | Excluded — admin-shell link owned by M20 (global shell renders it) |
| EL-M17-SHA-071 | toggle | visible-default | "Kandungan", fa-newspaper | Excluded — admin-shell group label / toggle of other modules (global shell / M23) |
| EL-M17-SHA-072 | link | hidden-only | "Banner", fa-image, → /admin/banners | Excluded — admin-shell link owned by M09 (global shell renders it) |
| EL-M17-SHA-073 | link | hidden-only | "Artikel", fa-newspaper, → /admin/articles | Excluded — admin-shell link owned by M09 (global shell renders it) |
| EL-M17-SHA-074 | link | hidden-only | "Nota", fa-sticky-note, → /admin/notes | Excluded — admin-shell link owned by M09 (global shell renders it) |
| EL-M17-SHA-075 | link | hidden-only | "Push Notifikasi", fa-bell, → /admin/notifications | Excluded — admin-shell link owned by M22 (global shell renders it) |
| EL-M17-SHA-076 | link | hidden-only | "Upload Screenshot", fa-cloud-upload-alt, → /admin/tools/screenshots | Excluded — admin-shell link owned by M09 (global shell renders it) |
| EL-M17-SHA-077 | toggle | visible-default | "Kewangan", fa-credit-card | Excluded — admin-shell group label / toggle of other modules (global shell / M23) |
| EL-M17-SHA-078 | link | hidden-only | "Pembayaran", fa-credit-card, → /admin/payments | Excluded — admin-shell link owned by M19 (global shell renders it) |
| EL-M17-SHA-079 | link | hidden-only | "Billing Dashboard", fa-chart-line, → /admin/billing | Excluded — admin-shell link owned by M19 (global shell renders it) |
| EL-M17-SHA-080 | link | hidden-only | "Dunning Log", fa-bell-slash, → /admin/dunning | Excluded — admin-shell link owned by M19 (global shell renders it) |
| EL-M17-SHA-081 | toggle | visible-default | "Sistem", fa-cog | Excluded — admin-shell group label / toggle of other modules (global shell / M23) |
| EL-M17-SHA-082 | link | hidden-only | "Performance", fa-gauge-high, → /admin/performance | Excluded — "Performance" (M23 system performance) |
| EL-M17-SHA-083 | link | hidden-only | "Tetapan", fa-cog, → /admin/settings | Excluded — admin-shell link owned by M23 (global shell renders it) |
| EL-M17-SHA-084 | link | hidden-only | "Log Audit", fa-clipboard-list, → /admin/audit-logs | Excluded — admin-shell link owned by M23 (global shell renders it) |
| EL-M17-SHA-085 | link | hidden-only | "Chatbot", fa-robot, → /admin/chatbot | Excluded — admin-shell link owned by M22 (global shell renders it) |
| EL-M17-SHA-086 | text | visible-default | "🏆 Bilik Duta" | Excluded — admin-shell group label / toggle of other modules (global shell / M23) |
| EL-M17-SHA-087 | badge | visible-default | "DEV" | Excluded — admin-shell group label / toggle of other modules (global shell / M23) |
| EL-M17-SHA-088 | link | visible-default | "Bilik Duta", fa-crown, → /bilik-duta | Excluded — admin-shell link owned by M24 (global shell renders it) |
| EL-M17-SHA-089 | link | visible-default | "Akademi Duta", fa-graduation-cap, → /akademi-duta | Excluded — admin-shell link owned by M24 (global shell renders it) |
| EL-M17-SHA-090 | link | visible-default | "Permohonan Duta", fa-clipboard-check, → /admin/duta-applications | Excluded — admin-shell link owned by M24 (global shell renders it) |
| EL-M17-SHA-091 | link | visible-default | "Duta Dashboard", fa-user-tie, → /duta-dashboard | Excluded — admin-shell link owned by M24 (global shell renders it) |
| EL-M17-SHA-092 | link | visible-default | "Jemput Duta", fa-school, → /jemput-duta | Excluded — admin-shell link owned by M24 (global shell renders it) |
| EL-M17-SHA-093 | link | visible-default | "Kem & Bootcamp", fa-campground, → /bilik-duta/kem | Excluded — admin-shell link owned by M24 (global shell renders it) |
| EL-M17-SHA-094 | text | visible-default | "🤖 Pusat AI" | Excluded — admin-shell group label / toggle of other modules (global shell / M23) |
| EL-M17-SHA-095 | link | visible-default | "Kamus AI", fa-book-open, → /pusat-ai/kamus | Excluded — admin-shell link owned by M25 (global shell renders it) |
| EL-M17-SHA-096 | link | visible-default | "Aktiviti Advisor", fa-lightbulb, → /pusat-ai/aktiviti | Excluded — admin-shell link owned by M25 (global shell renders it) |
| EL-M17-SHA-097 | link | visible-default | "Pendamping Motivasi", fa-heart, → /pusat-ai/pendamping | Excluded — admin-shell link owned by M25 (global shell renders it) |
| EL-M17-SHA-098 | link | visible-default | "SPM Walkthrough", fa-pen-to-square, → /pusat-ai/spm | Excluded — admin-shell link owned by M06 (global shell renders it) |
| EL-M17-SHA-099 | link | visible-default | "Whiteboard → Quiz", fa-clipboard-question, → /pusat-ai/whiteboard | Excluded — admin-shell link owned by M25 (global shell renders it) |
| EL-M17-SHA-100 | link | visible-default | "Parent Whisperer", fa-comments, → /pusat-ai/parent-whisperer | Excluded — admin-shell link owned by M25 (global shell renders it) |
| EL-M17-SHA-101 | link | visible-default | "Doa & Motivasi", fa-mosque, → /pusat-ai/doa | Excluded — admin-shell link owned by M25 (global shell renders it) |
| EL-M17-SHA-102 | text | visible-default | "✨ Visi & Pertandingan" | Excluded — admin-shell group label / toggle of other modules (global shell / M23) |
| EL-M17-SHA-103 | link | visible-default | "Profil Cerah", fa-magic, → /profil-cerah | Excluded — admin-shell link owned by M26 / other module (global shell renders it) |
| EL-M17-SHA-104 | link | visible-default | "Sekolah Bersaing", fa-trophy, → /sekolah-bersaing | Excluded — admin-shell link owned by M16 (global shell renders it) |
| EL-M17-SHA-105 | link | visible-default | "Cita-Cita Hijrah", fa-star, → /cita-cita | Excluded — admin-shell link owned by M26 / other module (global shell renders it) |
| EL-M17-SHA-106 | link | visible-default | "Streak / Kombo", fa-fire, → /kombo | Excluded — admin-shell link owned by M14 (global shell renders it) |
| EL-M17-SHA-107 | text | visible-default | "💎 Killer Features" | Excluded — admin-shell group label / toggle of other modules (global shell / M23) |
| EL-M17-SHA-108 | link | visible-default | "Cikgu Suara", fa-microphone, → /cikgu-suara | Excluded — admin-shell link owned by M26 / other module (global shell renders it) |
| EL-M17-SHA-109 | link | visible-default | "SPM Mock Exam", fa-file-pen, → /spm-mock | Excluded — admin-shell link owned by M06 (global shell renders it) |
| EL-M17-SHA-110 | link | visible-default | "Wellbeing Alerts", fa-triangle-exclamation, → /wellbeing/alerts | Excluded — admin-shell link owned by M26 / other module (global shell renders it) |
| EL-M17-SHA-111 | link | visible-default | "Tetapan Peribadi", fa-cog, → /tetapan | Excluded — global admin shell user block, "Tetapan Peribadi", "Ke Dashboard", logout (global shell / M01) |
| EL-M17-SHA-112 | link | visible-default | "Ke Dashboard", fa-arrow-left, → /dashboard | Excluded — global admin shell user block, "Tetapan Peribadi", "Ke Dashboard", logout (global shell / M01) |
| EL-M17-SHA-113 | card | visible-default | "Admin PRESTASI+" | Excluded — global admin shell user block, "Tetapan Peribadi", "Ke Dashboard", logout (global shell / M01) |
| EL-M17-SHA-114 | image | visible-default | image | Excluded — global admin shell user block, "Tetapan Peribadi", "Ke Dashboard", logout (global shell / M01) |
| EL-M17-SHA-115 | text | visible-default | "Admin PRESTASI+" | Excluded — global admin shell user block, "Tetapan Peribadi", "Ke Dashboard", logout (global shell / M01) |
| EL-M17-SHA-116 | text | visible-default | "Admin" | Excluded — global admin shell user block, "Tetapan Peribadi", "Ke Dashboard", logout (global shell / M01) |
| EL-M17-SHA-117 | link | visible-default | link, fa-sign-out-alt, → /logout | Excluded — global admin shell user block, "Tetapan Peribadi", "Ke Dashboard", logout (global shell / M01) |
| EL-M17-SHA-118 | heading | visible-default | "Dashboard" | FN-M17-1.1.5 |
| EL-M17-SHA-119 | text | visible-default | "Gambaran Keseluruhan Platform" | FN-M17-1.1.5 |
| EL-M17-SHA-120 | tooltip | hidden-only | "Uptime", fa-clock | Excluded — server-status widget of the admin shell (`GET /admin/server-status`, global shell / M23) |
| EL-M17-SHA-121 | tooltip | visible-default | "Load: 0.66 / 8 cores", fa-microchip | Excluded — server-status widget of the admin shell (`GET /admin/server-status`, global shell / M23) |
| EL-M17-SHA-122 | text | visible-default | "8%" | Excluded — server-status widget of the admin shell (`GET /admin/server-status`, global shell / M23) |
| EL-M17-SHA-123 | tooltip | visible-default | "18.2GB / 31.1GB", fa-memory | Excluded — server-status widget of the admin shell (`GET /admin/server-status`, global shell / M23) |
| EL-M17-SHA-124 | text | visible-default | "58%" | Excluded — server-status widget of the admin shell (`GET /admin/server-status`, global shell / M23) |
| EL-M17-SHA-125 | tooltip | visible-default | "201.4GB / 398.7GB", fa-hard-drive | Excluded — server-status widget of the admin shell (`GET /admin/server-status`, global shell / M23) |
| EL-M17-SHA-126 | text | visible-default | "51%" | Excluded — server-status widget of the admin shell (`GET /admin/server-status`, global shell / M23) |
| EL-M17-SHA-127 | tooltip | visible-default | "Uptime", fa-clock | Excluded — server-status widget of the admin shell (`GET /admin/server-status`, global shell / M23) |
| EL-M17-SHA-128 | text | visible-default | "205d 1h" | Excluded — server-status widget of the admin shell (`GET /admin/server-status`, global shell / M23) |
| EL-M17-SHA-129 | image | visible-default | image | Excluded — global admin shell chrome (logo, brand, mobile header, copyright footer; shells.md / M23) |
| EL-M17-SHA-130 | link | visible-default | link, fa-sign-out-alt, → /logout | Excluded — global admin shell user block, "Tetapan Peribadi", "Ke Dashboard", logout (global shell / M01) |
| EL-M17-SHA-131 | link | conditional | link, → /admin | Excluded — global admin shell chrome (logo, brand, mobile header, copyright footer; shells.md / M23) |
| EL-M17-SHA-132 | image | conditional | image | Excluded — global admin shell chrome (logo, brand, mobile header, copyright footer; shells.md / M23) |
| EL-M17-SHA-133 | text | visible-default | "© 2026 PRESTASIPLUS. Hakcipta Terpelihara." | Excluded — global admin shell chrome (logo, brand, mobile header, copyright footer; shells.md / M23) |
| EL-M17-SHA-134 | text | visible-default | "Didikan penuh dari Malaysia 🇲🇾" | Excluded — global admin shell chrome (logo, brand, mobile header, copyright footer; shells.md / M23) |
| EL-M17-SHA-135 | text | visible-default | "❤️" | Excluded — global admin shell chrome (logo, brand, mobile header, copyright footer; shells.md / M23) |
| EL-M17-SHA-136 | link | conditional | "Dashboard", fa-tachometer-alt, → /admin | FN-M17-1.1.4 |
| EL-M17-SHA-137 | link | conditional | "Soalan", fa-question-circle, → /admin/questions | Excluded — admin-shell link owned by M04/M07 (global shell renders it) |
| EL-M17-SHA-138 | link | conditional | "Penaja", fa-handshake, → /admin/sponsors | Excluded — admin-shell link owned by M21 (global shell renders it) |
| EL-M17-SHA-139 | link | conditional | "Pengguna", fa-users, → /admin/users | Excluded — admin-shell link owned by M02 (global shell renders it) |
| EL-M17-SHA-140 | dropdown-trigger | conditional | "Lagi", fa-ellipsis-h | FN-M17-1.1.4 |
| EL-M17-SHA-141 | card | hidden-only | "SPM" | Excluded — admin-shell group label / toggle of other modules (global shell / M23) |
| EL-M17-SHA-142 | link | hidden-only | "Analitik", fa-chart-pie, → /admin/analytics | FN-M17-1.1.4 |
| EL-M17-SHA-143 | link | hidden-only | "Laporan Aktiviti", fa-chart-bar, → /admin/laporan | FN-M17-1.1.4 |
| EL-M17-SHA-144 | link | hidden-only | "Monitoring", fa-binoculars, → /admin/monitoring | FN-M17-1.1.4 |
| EL-M17-SHA-145 | link | hidden-only | "Kirkpatrick", fa-microscope, → /admin/kirkpatrick | Excluded — KIRKPATRICK submenu (M12) |
| EL-M17-SHA-146 | text | hidden-only | "SPM" | Excluded — admin-shell group label / toggle of other modules (global shell / M23) |
| EL-M17-SHA-147 | link | hidden-only | "Databank Soalan", fa-database, → /spm/tahun-lepas | Excluded — admin-shell link owned by M06 (global shell renders it) |
| EL-M17-SHA-148 | link | hidden-only | "Latih Tubi", fa-bolt, → /spm/latih-tubi | Excluded — admin-shell link owned by M06 (global shell renders it) |
| EL-M17-SHA-149 | link | hidden-only | "Tracking A", fa-crosshairs, → /spm/ramalan | Excluded — admin-shell link owned by M06 (global shell renders it) |
| EL-M17-SHA-150 | link | hidden-only | "Subjektif", fa-pen-fancy, → /spm/subjektif | Excluded — admin-shell link owned by M06 (global shell renders it) |
| EL-M17-SHA-151 | text | hidden-only | "Soalan" | Excluded — admin-shell group label / toggle of other modules (global shell / M23) |
| EL-M17-SHA-152 | link | hidden-only | "Import CSV", fa-file-csv, → /admin/questions/import | Excluded — admin-shell link owned by M04/M07 (global shell renders it) |
| EL-M17-SHA-153 | link | hidden-only | "Kualiti Soalan", fa-clipboard-check, → /admin/questions/quality | Excluded — admin-shell link owned by M04/M07 (global shell renders it) |
| EL-M17-SHA-154 | link | hidden-only | "Laporan Soalan", fa-flag, → /admin/question-reports | Excluded — admin-shell link owned by M04/M07 (global shell renders it) |
| EL-M17-SHA-155 | link | hidden-only | "Soalan Berstruktur", fa-list-ol, → /admin/structured-questions | Excluded — admin-shell link owned by M04/M07 (global shell renders it) |
| EL-M17-SHA-156 | link | hidden-only | "Kertas Soalan Guru", fa-file-upload, → /admin/question-submissions | Excluded — admin-shell link owned by M04/M07 (global shell renders it) |
| EL-M17-SHA-157 | text | hidden-only | "Kurikulum" | Excluded — admin-shell group label / toggle of other modules (global shell / M23) |
| EL-M17-SHA-158 | link | hidden-only | "Kurikulum", fa-sitemap, → /admin/curriculum | Excluded — admin-shell link owned by M03 (global shell renders it) |
| EL-M17-SHA-159 | link | hidden-only | "Subjek", fa-book, → /admin/subjects | Excluded — admin-shell link owned by M03 (global shell renders it) |
| EL-M17-SHA-160 | link | hidden-only | "Tahap Pendidikan", fa-graduation-cap, → /admin/education-levels | Excluded — admin-shell link owned by M03 (global shell renders it) |
| EL-M17-SHA-161 | text | hidden-only | "Premium" | Excluded — admin-shell group label / toggle of other modules (global shell / M23) |
| EL-M17-SHA-162 | link | hidden-only | "PKSK Soalan", fa-shield-halved, → /admin/pksk/questions | Excluded — admin-shell link owned by M04/M07 (global shell renders it) |
| EL-M17-SHA-163 | link | hidden-only | "PKSK Akses", fa-key, → /admin/pksk/access | Excluded — admin-shell link owned by M04/M07 (global shell renders it) |
| EL-M17-SHA-164 | text | hidden-only | "Gamifikasi" | Excluded — admin-shell group label / toggle of other modules (global shell / M23) |
| EL-M17-SHA-165 | link | hidden-only | "Overview", fa-gamepad, → /admin/gamification | Excluded — admin-shell link owned by M14/M15 (global shell renders it) |
| EL-M17-SHA-166 | link | hidden-only | "Tier Config", fa-crown, → /admin/gamification/tiers | Excluded — admin-shell link owned by M14/M15 (global shell renders it) |
| EL-M17-SHA-167 | link | hidden-only | "Cabaran", fa-bullseye, → /admin/gamification/challenges | Excluded — admin-shell link owned by M14/M15 (global shell renders it) |
| EL-M17-SHA-168 | link | hidden-only | "Kedai Hadiah", fa-gift, → /admin/hadiah | Excluded — admin-shell link owned by M14/M15 (global shell renders it) |
| EL-M17-SHA-169 | link | hidden-only | "Gamifikasi Guru", fa-chalkboard-teacher, → /admin/gamifikasi/guru | Excluded — admin-shell link owned by M14/M15 (global shell renders it) |
| EL-M17-SHA-170 | text | hidden-only | "Battle & Permainan" | Excluded — admin-shell group label / toggle of other modules (global shell / M23) |
| EL-M17-SHA-171 | link | hidden-only | "Battle Live", fa-bolt, → /battle | Excluded — admin-shell link owned by M16 (global shell renders it) |
| EL-M17-SHA-172 | link | hidden-only | "Tetapan Permainan", fa-dice, → /admin/permainan | Excluded — admin-shell link owned by M16 (global shell renders it) |
| EL-M17-SHA-173 | text | hidden-only | "Kandungan" | Excluded — admin-shell group label / toggle of other modules (global shell / M23) |
| EL-M17-SHA-174 | link | hidden-only | "Banner", fa-image, → /admin/banners | Excluded — admin-shell link owned by M09 (global shell renders it) |
| EL-M17-SHA-175 | link | hidden-only | "Artikel", fa-newspaper, → /admin/articles | Excluded — admin-shell link owned by M09 (global shell renders it) |
| EL-M17-SHA-176 | link | hidden-only | "Nota", fa-sticky-note, → /admin/notes | Excluded — admin-shell link owned by M09 (global shell renders it) |
| EL-M17-SHA-177 | link | hidden-only | "Push Notifikasi", fa-bell, → /admin/notifications | Excluded — admin-shell link owned by M22 (global shell renders it) |
| EL-M17-SHA-178 | link | hidden-only | "Chatbot", fa-robot, → /admin/chatbot | Excluded — admin-shell link owned by M22 (global shell renders it) |
| EL-M17-SHA-179 | link | hidden-only | "Upload Screenshot", fa-cloud-upload-alt, → /admin/tools/screenshots | Excluded — admin-shell link owned by M09 (global shell renders it) |
| EL-M17-SHA-180 | text | hidden-only | "Marketplace" | Excluded — admin-shell group label / toggle of other modules (global shell / M23) |
| EL-M17-SHA-181 | link | hidden-only | "Produk", fa-shopping-bag, → /admin/marketplace/products | Excluded — admin-shell link owned by M20 (global shell renders it) |
| EL-M17-SHA-182 | link | hidden-only | "Penjual", fa-store, → /admin/marketplace/sellers | Excluded — admin-shell link owned by M20 (global shell renders it) |
| EL-M17-SHA-183 | text | hidden-only | "Sistem" | Excluded — admin-shell group label / toggle of other modules (global shell / M23) |
| EL-M17-SHA-184 | link | hidden-only | "Sekolah", fa-school, → /admin/schools | Excluded — admin-shell link owned by M02 (global shell renders it) |
| EL-M17-SHA-185 | link | hidden-only | "Langganan Sekolah", fa-file-contract, → /admin/school-subscriptions | Excluded — admin-shell link owned by M02 (global shell renders it) |
| EL-M17-SHA-186 | link | hidden-only | "Tetapan", fa-cog, → /admin/settings | Excluded — admin-shell link owned by M23 (global shell renders it) |
| EL-M17-SHA-187 | link | hidden-only | "Pembayaran", fa-credit-card, → /admin/payments | Excluded — admin-shell link owned by M19 (global shell renders it) |
| EL-M17-SHA-188 | link | hidden-only | "Billing Dashboard", fa-chart-line, → /admin/billing | Excluded — admin-shell link owned by M19 (global shell renders it) |
| EL-M17-SHA-189 | link | hidden-only | "Dunning Log", fa-bell-slash, → /admin/dunning | Excluded — admin-shell link owned by M19 (global shell renders it) |
| EL-M17-SHA-190 | link | hidden-only | "Log Audit", fa-clipboard-list, → /admin/audit-logs | Excluded — admin-shell link owned by M23 (global shell renders it) |
| EL-M17-SHA-191 | link | hidden-only | "Performance", fa-gauge-high, → /admin/performance | Excluded — "Performance" (M23 system performance) |
| EL-M17-SHA-192 | link | hidden-only | "Import Pelajar", fa-user-plus, → /admin/import-students | Excluded — admin-shell link owned by M02 (global shell renders it) |
| EL-M17-SHA-193 | link | hidden-only | "Import Pengguna", fa-users-cog, → /admin/users/bulk-import | Excluded — admin-shell link owned by M02 (global shell renders it) |
| EL-M17-SHA-194 | link | hidden-only | "Student View", fa-arrow-left, → /dashboard | Excluded — global admin shell user block, "Tetapan Peribadi", "Ke Dashboard", logout (global shell / M01) |
| EL-M17-SHA-195 | link | hidden-only | "Log Keluar", fa-sign-out-alt, → /logout | Excluded — global admin shell user block, "Tetapan Peribadi", "Ke Dashboard", logout (global shell / M01) |
| EL-M17-SHA-196 | tooltip | hidden-only | "Load: 0.78 / 8 cores", fa-microchip | Excluded — server-status widget of the admin shell (`GET /admin/server-status`, global shell / M23) |
| EL-M17-SHA-197 | tooltip | hidden-only | "18.5GB / 31.1GB", fa-memory | Excluded — server-status widget of the admin shell (`GET /admin/server-status`, global shell / M23) |
| EL-M17-SHA-198 | heading | conditional | "Laporan Eksekutif Platform" | FN-M17-1.1.5 |
| EL-M17-SHA-199 | text | conditional | "Selamat datang, Admin" | FN-M17-1.1.5 |
| EL-M17-SHA-200 | tooltip | conditional | "Load: 1.04 / 8 cores", fa-microchip | Excluded — server-status widget of the admin shell (`GET /admin/server-status`, global shell / M23) |
| EL-M17-SHA-201 | tooltip | conditional | "201.2GB / 398.7GB", fa-hard-drive | Excluded — server-status widget of the admin shell (`GET /admin/server-status`, global shell / M23) |
| EL-M17-SHA-202 | tooltip | conditional | "Load: 1.11 / 8 cores", fa-microchip | Excluded — server-status widget of the admin shell (`GET /admin/server-status`, global shell / M23) |
| EL-M17-SHA-203 | tooltip | conditional | "18.1GB / 31.1GB", fa-memory | Excluded — server-status widget of the admin shell (`GET /admin/server-status`, global shell / M23) |
| EL-M17-SHA-204 | tooltip | conditional | "Load: 0.94 / 8 cores", fa-microchip | Excluded — server-status widget of the admin shell (`GET /admin/server-status`, global shell / M23) |
| EL-M17-SHA-205 | tooltip | conditional | "18.3GB / 31.1GB", fa-memory | Excluded — server-status widget of the admin shell (`GET /admin/server-status`, global shell / M23) |
| EL-M17-SHA-206 | heading | conditional | "Laporan Fokus Sekolah" | FN-M17-1.1.5 |
| EL-M17-SHA-207 | tooltip | conditional | "Load: 0.95 / 8 cores", fa-microchip | Excluded — server-status widget of the admin shell (`GET /admin/server-status`, global shell / M23) |
| EL-M17-SHA-208 | tooltip | hidden-only | "Load: 0.8 / 8 cores", fa-microchip | Excluded — server-status widget of the admin shell (`GET /admin/server-status`, global shell / M23) |
| EL-M17-SHA-209 | heading | conditional | "Analitik & Statistik" | FN-M17-1.1.5 |
| EL-M17-SHA-210 | text | conditional | "Analisis mendalam data platform" | FN-M17-1.1.5 |
| EL-M17-SHA-211 | tooltip | conditional | "Load: 0.84 / 8 cores", fa-microchip | Excluded — server-status widget of the admin shell (`GET /admin/server-status`, global shell / M23) |
| EL-M17-SHA-212 | tooltip | conditional | "Load: 1.02 / 8 cores", fa-microchip | Excluded — server-status widget of the admin shell (`GET /admin/server-status`, global shell / M23) |
| EL-M17-SHA-213 | heading | conditional | "Laporan Statistik" | FN-M17-1.1.5 |
| EL-M17-SHA-214 | text | conditional | "Penglibatan pengguna seluruh platform" | FN-M17-1.1.5 |
| EL-M17-SHA-215 | tooltip | conditional | "Load: 0.72 / 8 cores", fa-microchip | Excluded — server-status widget of the admin shell (`GET /admin/server-status`, global shell / M23) |
| EL-M17-SHA-216 | tooltip | conditional | "Load: 0.85 / 8 cores", fa-microchip | Excluded — server-status widget of the admin shell (`GET /admin/server-status`, global shell / M23) |
| EL-M17-SHA-217 | tooltip | conditional | "Load: 0.73 / 8 cores", fa-microchip | Excluded — server-status widget of the admin shell (`GET /admin/server-status`, global shell / M23) |
| EL-M17-SHA-218 | tooltip | conditional | "Load: 1.17 / 8 cores", fa-microchip | Excluded — server-status widget of the admin shell (`GET /admin/server-status`, global shell / M23) |
| EL-M17-SHA-219 | tooltip | conditional | "Load: 0.89 / 8 cores", fa-microchip | Excluded — server-status widget of the admin shell (`GET /admin/server-status`, global shell / M23) |
| EL-M17-SHA-220 | tooltip | conditional | "Load: 1.06 / 8 cores", fa-microchip | Excluded — server-status widget of the admin shell (`GET /admin/server-status`, global shell / M23) |
| EL-M17-SHA-221 | tooltip | conditional | "Load: 0.75 / 8 cores", fa-microchip | Excluded — server-status widget of the admin shell (`GET /admin/server-status`, global shell / M23) |
| EL-M17-SHA-222 | tooltip | conditional | "Load: 0.86 / 8 cores", fa-microchip | Excluded — server-status widget of the admin shell (`GET /admin/server-status`, global shell / M23) |
| EL-M17-SHA-223 | tooltip | conditional | "18.4GB / 31.1GB", fa-memory | Excluded — server-status widget of the admin shell (`GET /admin/server-status`, global shell / M23) |
| EL-M17-SHA-224 | tooltip | conditional | "Load: 0.88 / 8 cores", fa-microchip | Excluded — server-status widget of the admin shell (`GET /admin/server-status`, global shell / M23) |
| EL-M17-SHA-225 | tooltip | conditional | "Load: 0.69 / 8 cores", fa-microchip | Excluded — server-status widget of the admin shell (`GET /admin/server-status`, global shell / M23) |
| EL-M17-SHA-226 | tooltip | conditional | "Load: 0.71 / 8 cores", fa-microchip | Excluded — server-status widget of the admin shell (`GET /admin/server-status`, global shell / M23) |
| EL-M17-SHA-227 | tooltip | conditional | "Load: 0.67 / 8 cores", fa-microchip | Excluded — server-status widget of the admin shell (`GET /admin/server-status`, global shell / M23) |
| EL-M17-SHA-228 | tooltip | conditional | "Load: 0.68 / 8 cores", fa-microchip | Excluded — server-status widget of the admin shell (`GET /admin/server-status`, global shell / M23) |
| EL-M17-SHA-229 | tooltip | conditional | "Load: 0.65 / 8 cores", fa-microchip | Excluded — server-status widget of the admin shell (`GET /admin/server-status`, global shell / M23) |
| EL-M17-SHA-230 | tooltip | conditional | "Load: 0.77 / 8 cores", fa-microchip | Excluded — server-status widget of the admin shell (`GET /admin/server-status`, global shell / M23) |
| EL-M17-SHA-231 | tooltip | conditional | "Load: 0.82 / 8 cores", fa-microchip | Excluded — server-status widget of the admin shell (`GET /admin/server-status`, global shell / M23) |
| EL-M17-SHA-232 | tooltip | hidden-only | "Load: 0.64 / 8 cores", fa-microchip | Excluded — server-status widget of the admin shell (`GET /admin/server-status`, global shell / M23) |
| EL-M17-SHA-233 | tooltip | hidden-only | "Load: 0.63 / 8 cores", fa-microchip | Excluded — server-status widget of the admin shell (`GET /admin/server-status`, global shell / M23) |

---

## 7. Fidelity deviations

These are the **only** intended differences from the live site. Anything not listed must match live (D7). Rule D9 (user, standing, pre-approved): where live is broken or contradictory, fix it minimally; where it works, replicate it exactly. D10: accessibility replicates live; a deliberate, consistent limit is not broken; adding options to a working feature is new scope. CLAUDE.md §6: minimal fixes that create no new visible contradiction. Rows "Rejected — replicate live" were candidates that turned out to work or have no minimal fix. Count conflicts with other modules' datasets are decided in SRS §6.5 (reconciliation), not here; DV rows that depend on them cite the R-row.

| ID | Discovery | Category | Live behaviour (evidence) | Rebuild behaviour (specified) and alternatives | Status |
|---|---|---|---|---|---|
| DV-M17-01 | D-M17-01 | Responsive breakage | S2 at 375 and 768: the 3-column board does not collapse, `body` clips, the clock / "LIVE" (x = 565) and 60 elements are cut off (`command-center-mobile.png`, measurement). | Grid collapses: 3 columns ≥ `xl`, 2 columns at `md`, 1 column below `md`; the header wraps; the page scrolls vertically at 375/768 (in-panel scroll kept ≥ `xl`, as live). Nothing else changes. Alternatives: horizontal page scroll at 375 — rejected (NFR-RESP-01); hide panels on mobile — rejected (removes content). | Approved (D9) |
| DV-M17-02 | D-M17-02 | Responsive breakage | S4–S7 at 375: page width 554 / 588 / 652 / 395 px; tables in non-scrolling wrappers. | Tables scroll inside their card (NFR-RESP-05 b), no sticky column; S7 panels stack in one column below `md`. Alternatives: card layout per row (NFR-RESP-05 a) — rejected (larger change than needed). | Approved (D9) |
| DV-M17-03 | D-M17-03 | Responsive breakage; unreadable text | S8/S9 at 375: page width 525 / 429 px (12-month chart, headcount table 491 / 395 px not scrollable); month labels 8 px. | The 12-month chart and both headcount tables scroll inside their cards; month labels 12 px. Alternatives: shrink bars to fit 343 px — rejected (labels would overlap at 12 px). | Approved (D9) |
| DV-M17-04 | D-M17-04 | Layout | S11 overview cards overflow by 13 px at 375 (`scrollWidth` 388). | Grid items may shrink (`min-w-0`) and long numbers wrap inside the card; 2 columns kept. | Approved (D9) |
| DV-M17-05 | D-M17-05 | Broken (HTTP 500) | `/admin/laporan-eksekutif?year=abc` → HTTP 500 "Ralat Pelayan" (`laporan-eksekutif-500.png`). | A `year` that is not an integer 2000–2100 is ignored and the current year (mock clock) renders; the URL stays as typed. Alternatives: 404 — rejected (the route exists); replicate 500 — rejected (broken). M05 DV-M05-13 precedent (malformed month → current month). | Approved (D9) |
| DV-M17-06 | D-M17-06 | Wrong label / contradictory | Times are UTC under an "MYT" label: S2 feed "20:16" at 04:16 MYT, S3 heatmap "3:00" for answers at 11:32 MYT, S8/S9 footers "04:26 AM" at 12:26 MYT, S6 "Terakhir Aktif", S7 session times, S3 "{n} … yang lepas" (relative values are right). | Every time, date, week, month, day window and hour bucket is Asia/Kuala_Lumpur (the label stays "MYT"); the observed UTC readings shift by +8 h (e.g. the 26 Sep answers at 03:xx UTC fall in the 11:00 bucket, footer 04:26 AM UTC = 12:26 PM MYT, S6 "25/09 09:22"); at the project clock the footer reads "25 Sep 2026, 03:40 PM". Alternatives: relabel "UTC" — rejected (users are in Malaysia; the S2/S3 clocks already show MYT). | Approved (D9) |
| DV-M17-07 | D-M17-07 | Candidate — label | S2 "Sekolah Berdaftar" 9 / "langganan aktif" vs S8 "Jumlah Sekolah" 57 / "sekolah aktif"; the S2 AI sentence calls the 9 "sekolah aktif". | **Rejected — replicate live.** The S2 card states its own definition in its sub-line ("langganan aktif") and the value equals the subscribed schools of S11 ("Langganan" "Aktif" = 9); S8 is another page with another stated scope; the AI sentence is template copy. A new label would be new copy (M11 DV-M11-22 precedent for per-screen definitions). | Rejected — replicate live |
| DV-M17-08 | D-M17-08 | Wrong label / contradictory value | S2 T1 "★★☆☆☆ 4.7/10" from `kirk_t1` 4.7 with `kirk_t1_count` 336, while the same 336 responses give "4.6/5" on S8 and on M12. | T1 shows the M12 satisfaction mean on its 1–5 scale: "★★★★★ 4.6/5" (stars = round(v ÷ 5 × 5)), bar = v ÷ 5 (Q-M12-T1). Alternatives: keep 4.7 and relabel "/5" — rejected (4.7 contradicts 4.6 over the same 336 responses); show NPS "8.3/10" — rejected (M12's T1 card is the satisfaction mean). | Approved (D9) |
| DV-M17-09 | D-M17-09 | Contradictory | S2 AI sentence "GPS keseluruhan: 4.47" in the same panel column as T4 "GPS 2.880"; no owner figure is 4.47 (M12 platform 4.30, M10 mirror 4.69, M08 headcount 3.45). | The sentence uses the T4 GPS with 2 decimals ("GPS keseluruhan: 2.88."). Alternatives: T4 = 4.47 — rejected (no definition; T4 2.880 = the SPM subject GPS of TINGGI KLUANG, also on S8); drop the clause — rejected (changes the template). | Approved (D9) |
| DV-M17-10 | D-M17-10 | Wrong label | S3 card label stays "Login Hari Ini" on "Minggu Ini" / "Bulan Ini". | Label follows the tab: "Login Hari Ini" / "Login Minggu Ini" / "Login Bulan Ini" (PROPOSED COPY built from the live tab words). Alternatives: neutral "Login" — rejected (changes the observed today label). | Approved (D9) |
| DV-M17-11 | D-M17-11 | Broken panel / contradictory | S3 "Subjek" "-" and "Live Feed" "Tiada aktiviti" in every period (API `subject_breakdown: []`, `live_feed: []`) while the same response has 60 / 2,653 / 20,351 answers; "Mood Pelajar" "Tiada data" while S2 shows 750 moods. | "Subjek" shows the period's answers per subject and "Live Feed" the period's latest answers, with the layouts of the page script (SOURCE-DERIVED; provisional E2E). Mood part **rejected**: S2 counts all time, S3 the period; no check-in exists in September (consistent, not contradictory). Alternatives: remove the two panels — rejected (removes live features). | Approved (D9) — mood part rejected |
| DV-M17-12 | D-M17-12 | Candidate — contradictory | JSON `summary.active_teachers` 0 today while the school row shows "11 GURU"; one pupil listed under 11 teachers. | **Rejected — replicate live.** `summary.active_teachers` is not displayed; a pupil enrolled in 11 teachers' classes correctly appears under each (M10 enrolment). No visible contradiction. | Rejected — replicate live |
| DV-M17-13 | D-M17-13 | Contradictory | S3 "Sekolah Aktif" "7" "daripada 9" (week, month) while 2 of the 7 active schools (JALAN TIGA, SAM MUHAMMADIAH) have no subscription and the list shows 10 schools. | Denominator = "Jumlah Sekolah" of S8 (57, schools with ≥ 1 pupil, fixtures excluded): "7 daripada 57". Alternatives: numerator = subscribed active schools (5) — rejected (changes three observed numerators); replicate — rejected (a part larger than its stated whole is contradictory). | Approved (D9) |
| DV-M17-14 | D-M17-14 | Navigation dead end; contradictory | S8: only "← {tahun-1}"; no way forward except the sidebar; a year with 0 answers still names "Sekolah Paling Aktif" (BANDAR BARU BANGI), gives "★ Paling Aktif" and lists "5 Sekolah Paling Aktif" with "0" answers. | "{tahun+1} →" (PROPOSED COPY mirroring "← {tahun-1}") when the year is before the current year; with 0 answers in the year "Sekolah Paling Aktif" shows "-" (as "Bulan Paling Aktif"), no tile gets a badge and "5 Sekolah Paling Aktif" is omitted like the other sections. Future years stay accepted (as live). Alternatives: year select — rejected (new control); replicate — rejected (dead end, contradiction). | Approved (D9) |
| DV-M17-15 | D-M17-15 | Candidate — contradictory across screens | Per-school answers and active pupils differ between S2/S4 (e.g. ENGKU HUSAIN 130,077 / 392) and S8/S9 (49,813 / 225); TINGGI KLUANG 72,332 on S8 vs 10,208 in M11 monitoring. | **Rejected — replicate per screen.** Each screen is internally consistent; S2/S4 use the pupil's current school (the M11 attribution; S3 week and month per-school figures fit the M11 cells exactly, SRS §6.10), S8/S9 use another attribution that no owner dataset reproduces; making them equal would change about 300 observed S8/S9 figures. S8/S9 per-school figures are the documented display data DC-M17-07 (SRS §6.3, R-24; M11 BR-M11-32 precedent). | Rejected — replicate live |
| DV-M17-16 | D-M17-16 | Contradictory | S11 "Jumlah Aktiviti" 3,522 ≠ trend Σ 1,428 ≠ "Pecahan Aktiviti" Σ 22 ("Kuiz Objektif" 0) (30 days; 7 days 1,124 / 344 / 3; 90 days 14,472 / 5,939 / 1,024). Evidence that the trend counts practice sessions + other activities: from 21 Sep the 7-day trend = 163 = 160 S3 sessions + 3 structured. | One definition: activity = completed practice session + structured attempt + battle + game. "Kuiz Objektif" = completed practice sessions of the range; "Jumlah Aktiviti" = Σ "Pecahan" = Σ trend: on the 12:33 snapshot this gives 30 days 1,428 (1,406 + 13 + 4 + 5), 7 days 344 (341 + 3), 90 days 5,939 (4,915 + 954 + 23 + 47); at the project clock (windows ending 25 Sep) 1,431 (1,409 + 13 + 4 + 5), 423 (420 + 3), 5,931 (4,907 + 954 + 23 + 47); the trend is unchanged. Alternatives: keep "Pecahan" and set "Jumlah" = 22 — rejected (contradicts the trend); only "Jumlah" = Σ trend — rejected (leaves "Kuiz Objektif" 0 beside 1,406 sessions). | Approved (D9) |
| DV-M17-17 | D-M17-17, D-M17-20 | Contradictory | S11 on one page: overview "/ 3,152" pupils and "/ 502" teachers vs tabs "Murid (4,533)", "Guru (551)", "Pernah Login (289)", "Belum Login (262)". | One population per role on S11: the active accounts (pupils 3,152, teachers 502; SRS Q-M17-PUPILS / Q-M17-TEACHERS) — tabs "Guru (502)", "Murid (3,152)", headings, pills "Pernah Login (269)", "Belum Login (233)", tiles "Jumlah Guru" 502 / "Pernah Login" 269, "Jumlah Murid" 3,152; the lists hold active accounts only. Alternatives: overview on 4,533 / 551 — rejected (breaks the 3,152 / 502 shared with S2, S3, S8); replicate — rejected (two unlabelled totals on one page). | Approved (D9) |
| DV-M17-18 | D-M17-18 | Broken filter | S11 Murid pills "Login Sahaja" and "Belum Login" can never show a row (only the top 200 active pupils are in the page) and show no message (`laporan-murid-belum-empty.png`). | Each pill lists up to 200 pupils of its status (Aktif: top 200 by sessions, as live; Login Sahaja: logged in without practice, latest login first; Belum Login: never logged in, name A→Z — INFERRED orders); heading "— Top 200" kept. Sekolah "Kurang (0)" is consistent (count 0) and stays. Alternatives: hide the two pills — rejected (removes controls); add an empty message — rejected (does not fix the filter; new copy). | Approved (D9) |
| DV-M17-19 | D-M17-19 | Contradictory | S11 Murid rows with "Ketepatan" 101.2 % and 101.4 %. | Accuracy = correct ÷ answered from the M05 log, never above 100 %; only those rows change. | Approved (D9) |
| DV-M17-20 | D-M17-20 | Contradictory | Overview "/ 3,152" vs "Murid (4,533)". | Covered by DV-M17-17 (same fix). | Approved (D9) |
| DV-M17-21 | D-M17-21 | Wrong label; candidate contradictory | S7: "Jumlah Jawapan" 2,378 vs all-sessions modal "2372 Jawapan"; subject row "Latihan Bebas" (code UMUM) while the session tables say "Umum"; session title "Latihan Bebas — Latihan Bebas". | Label "Latihan Bebas" for code UMUM in every S7 table. **2,378 vs 2,372 rejected — replicate:** card = all answers, modal = answers in sessions (6 answers without a session), the M05 S8/S9 precedent (119 vs 84, both replicated). Session title kept (subject — topic). | Approved (label) / Rejected (counts) |
| DV-M17-22 | D-M17-22 | Dead drill path / contradictory | S4 8080: 185 pupils, 175 active, all 34 listed teachers have 0 classes; its classes 366–372 belong to teacher 1919, not listed, so S4 cannot drill to them. | S4 also lists the owners of the school's classes who are not among its teachers (8080: teacher 1919 with 7 classes) → "Senarai Guru (35)". Alternatives: attach 1919 to 8080 as a teacher — rejected (changes the M11-pinned 34 teachers); replicate — rejected (the drill chain is the page's purpose). | Approved (D9) |
| DV-M17-23 | D-M17-23 | Candidate — contradictory | S1 "Diluluskan" 150,683 / "Diarkib" 323,184 vs S10 "Diluluskan" 128,006 / "Diarkib" 400 on two admin pages. | **Rejected — replicate live.** Different pages with different populations: S1 = the DC-M17-01/02 display constants, S10 = the coverage population (active rows + PKSK, R-12); each page is internally consistent. | Rejected — replicate live |
| DV-M17-24 | D-M17-24 | Candidate — contradictory | S2 Engagement buckets total 2,315, not the 3,152 registered pupils. | **Rejected — replicate live.** The panel does not state that it covers the registered pupils; the bucket rules are unobservable, so the values are DC-M17-05. | Rejected — replicate live |
| DV-M17-25 | NFR-02, disc. §8.1 | Unreadable text | Content text below 12 px: S1 114 labels (9–11 px), S8 113 texts at 10 px and 8 px month labels, S10 848 texts < 12 px (matrix, difficulty tiles), S2–S7 small captions. | Content text below 12 px on M17 screens is raised to 12 px; icons, layout, colours and truncation unchanged (M03 DV-06b, M05 DV-11, M08 DV-18, M11 DV-23 precedent). | Approved (D9) |
| DV-M17-26 | disc. §6.1 | Security (no visible change) | S2 inserts live-feed names without escaping (top pupils use `esc()`). | Names are always escaped; no visible change (SEC-M17-05). | Approved (D9) |
| DV-M17-27 | snapshot (new evidence) | Contradictory | S2 "Live Feed" shows 10 answers at SMK JALAN REKO (8087) at "20:16" (UTC) while S3 reports no answer at 8087 this week and the only answers today are 60 at ENGKU HUSAIN at 11:32 (M11 cell 8087 M32 = 0). | The feed lists the 10 latest pupil answers of the log (newest first); at the project clock these are the last 10 answers of the 8082 session ending 14:59 (SRS §6.7 B, PROPOSED placement). Alternatives: seed the observed 8087 rows as latest answers — rejected (would contradict S3 and M11 counts). | Approved (D9) |
| DV-M17-28 | AUD-M17-05; SRS §6.5 R-31, R-32 | Cross-module constraint (definitional) | S11 (live, re-observed in the audit): tab "Sekolah (61)" and pills "Semua (61)" / "Tidak Aktif (52)" (4 schools hold only teacher-type users and no pupil); per-school "Guru" totals 8080 35, 8078 61, 8106 62, 8102 120 and 8106 "Murid" logins 358. These are working, internally consistent live values. | Not a D9 defect: the owners' pinned datasets cannot hold them. M11 §6.7 fixes the teacher count of each school (8080 34, 8078 60, 8106 60, 8102 118) and its teacher table has 13 rows, so extra teachers at those schools or at the 4 pupil-less schools would change observed M11 figures; M02's users dataset allocates the 8106 logins. **XR-M17-08 (restore every value) was rejected by M02 v1.12 at XL batch 3** (definition "Guru" = active teachers + active school admins of the school; placement of school admins and of fixture teachers checked against M11's teacher table, arithmetic in SRS §6.8). **Final spec:** "Sekolah (57)", "Semua (57)", "Tidak Aktif (48)", tiles 48; "Guru" 8080 "34/34", 8078 "53/60", 8106 "18/60", 8102 "42/118"; 8106 "Murid" "355/562". Alternatives: invent teachers at those schools — rejected (changes M11's observed teacher table); a display constant for the S11 table — rejected (the rest of the table is computed and the tab counts would contradict the list). | Approved (cross-module constraint; XR-M17-08 rejected) |
| DV-M17-29 | M10 v1.8 R2-06 (XL batch 3 round 2) | Contradictory | S3 SAM MUHAMMADIAH (8284): "Bulan Ini" row "1 GURU" while "Minggu Ini" row "0 GURU"; the school's only pupil this month is the same pupil as this week, so the "{n} GURU" rule (teachers owning a class with an active enrolment of that pupil, BR-M17-11) cannot give different values. | Month row shows the computed **"0 GURU"** (enrolments of M10 v1.8 §6.2.1); nothing else changes. Alternatives: display constant "1" — rejected (it would stand beside the computed week 0 for the same pupil); enrol the pupil so both read 1 — rejected (changes the observed week 0). | Approved (D9); **superseded in v1.13 by DV-M17-41** |
| DV-M17-30 | M02 v1.21–v1.22 proof (§6.15 D); OQ-M17-11 (a) | Contradictory | School 8080 (SMK KHIR JOHARI): live S2 "175 plj" and S4 "Pelajar Aktif 175" with "Jumlah Jawapan 53,431" and "Jumlah Pelajar 185", while M11 pins 8080 at 184 register pupils, 174 answering and 53,494 answers. Definitions tested on all five schools (script `anchor.cjs`, v1.8): (i) engaged and answers on active pupils (current) — 8080 174 / 53,431, the others hold; (ii) engaged on every answering pupil, answers on active pupils — 8080 175 / 53,431 but 8082 393 (live 392), 8078 345 (341), 8106 308 (307) and 8090 135 (134); (iii) engaged and answers on every pupil — 8080 175 / 53,514, 8082 393, 8078 345; (iv) engaged on active pupils, answers on every pupil — 8080 174 / 53,514; a window (30 days, year) changes the all-time 392 / 341 / 307 / 134 too. No definition reproduces 175 and 53,431 together with 392 / 341 / 307 / 134 and M11's 8080 register (184 · 174 answering · 53,494 answers; M02 v1.22 §6.15 D proof). | **8080 "Pelajar Aktif" / "plj" shows the computed 174** (one value; S2 and S4); answers 53,431 and pupils 185 stay exact; the Top Sekolah order is unchanged. Alternatives: (a) a D11 display constant 175 — rejected: 175 would stand on S4 beside computed figures of the same pupils that give 174 (the S4 "Jumlah Jawapan" 53,431 sums exactly 174 answering active pupils plus the extra, and the S5/S6 drill rows of the school list the answering pupils), and it would not move when a pupil answers; (b) a definition change — none holds on all schools (above); (c) change 53,431 or 185 instead — rejected: two observed values instead of one; (d) change M11's register — rejected: M11's observed values. *(v1.12: "answers 53,431 stay exact" is superseded by DV-M17-33 — S4 shows M11's 53,494; the 174 stands.)* | Approved (D9) |
| DV-M17-31 | M02 v1.23 (OQ-M17-11) | Unreachable value (cross-module) | S11 Sekolah tab row "SEKOLAH KEBANGSAAN JELI (1)" (2418) "Murid" "3/5"; the users dataset holds 4 students at 2418 after every movable student was placed (M02 v1.23). | The row shows the computed **"3/4"** (D9); the school's S4 page (reachable from the S3 "Minggu Ini" / "Bulan Ini" drill, "Lihat penuh →") shows the same computed "Jumlah Pelajar" 4. Alternatives: (a) a D11 display constant 5 — rejected: the S4 page of 2418 is one click from the S3 drill, shows the computed 4 and was not observed on live, so the constant would stand beside a contradicting computed total; (b) place another student at 2418 — impossible (no movable student left, M02 v1.23); (c) apply the constant on S4 too — rejected: S4 of 2418 was never observed. **Also recorded (DC-M17-09, not a deviation):** the "Murid" totals of 5441 14, 3390 15, 853 18, 3931 16, 8030 18 are documented display constants because no screen in the same view or one click away shows a computed total for them; alternatives rejected: D9 to the computed 1 / 1 / 1 / 1 / 8 (changes five working observed values), further placement (none possible). | Approved (D9) |
| DV-M17-32 | XL3 Addendum B, B-01; SRS §6.5 R-43 | Cross-module constraint (unobserved composition) | S11 Guru tab: tile "Jumlah Soalan" 11,414 (OBSERVED). Live's 551 rows presumably add up to it, but only 389 rows were captured; the contributions of the captured rows are 5,547 (`<teacher:101>`) and 1,559 (`<teacher:137>`), and the S11 school rows give 3,849 at four schools. The remaining **2,018** contributions (all by teachers without a school) belong to teachers among the 162 uncaptured rows, whose identities and split are not observed. | The tile shows the platform count **11,414** (M04 Q-TEACHER-CONTRIB); each row shows that teacher's own contributions from M04. The 2,018 stay on M04's documented placeholder creator, which is not a teacher, so they appear on **no listed row**: the 502 listed rows (DV-M17-17) sum to **9,396** (4202 1,559 + 4501 873 + 4502 1,403 + 4503 13 + 4504 1 + 5316 5,547). The tab shows no row total and no other screen shows a per-teacher sum, so **no displayed figure contradicts the tile**; every observed row value holds. Alternatives: (a) tile = Σ of the rows (9,396) — rejected: changes an observed value; (b) spread the 2,018 over chosen generated teachers — rejected: invents per-teacher values that were not observed (D11 anchors only where observed); (c) a display constant for the tile — rejected: 11,414 is computed exactly from the owner's dataset. Resolves when the missing rows are observed (M04 SQ-8). | Approved (cross-module constraint; Delivery Lead, XL3 Addendum B) |
| DV-M17-33 | v1.12 (Session 6 build; M05 / M11 reconciliation); extends DV-M17-30 | Contradictory (observed vs observed, two modules) | S4 (and S2 "Top Sekolah" for the pupil count): school 8082 shows "Pelajar Aktif" **392** (S2 "392 plj") and "Jumlah Jawapan" **130,077** at 12:33 (**130,002** at the project clock after the 75 post-clock answers); school 8080 shows "Jumlah Jawapan" **53,431**. M11's observed weekly cells give 8082 **393** engaged / **130,233** answers and 8080 **53,494** answers (and 174 engaged). Every M11 cell is observed and the M05 ladders (the per-school answer log) depend on them, so the live M17 values cannot all be reproduced with M11's. | **M11's values win:** S4 8082 shows **393 / 130,233**, S2 "Top Sekolah" 8082 "393 plj", S4 8080 "Jumlah Jawapan" **53,494**; 8080 engaged stays 174 (DV-M17-30) and the accuracies 82.3 % and 81.7 % stay. Alternatives rejected: keep 392 / 130,002 / 53,431 — would force M05 / M11 to change observed M11 weekly cells (many observed values) to fit one M17 value each; a display constant for the live values — rejected: they would sit next to the computed M11-based school totals in the same drill. **Applies uniformly to all five schools (Delivery Lead, 2026-10-02; OQ-M17-09 closed):** 8078 shows **345 / 88,968** (live JSON 341 / 88,255), 8106 **306 / 59,211** (live JSON 307 / 59,086), 8090 **134 / 120,782** (live JSON 134 / 120,623); the S4 pages of these three were not observed on live (JSON only), so the live values recorded here are the observed JSON values. Rebuild-side, the earlier computed values (341 / 88,888, 307 / 59,216, 134 / 120,782) are superseded. | Approved (D9, v1.12) |
| DV-M17-34 | M17-T3a build (v1.12) | Visual equivalence (not a behaviour change) | The live S2–S7 pages use CSS variables and the JetBrains Mono face. | The rebuild uses the Tailwind slate / indigo palette and the `font-mono` stack of the design system: the same colours and weights to the eye, no new colours, no new font file. Layout, copy and behaviour unchanged. | Approved (D9; visual equivalent) |
| DV-M17-35 | M17-T3a build (v1.12) | Contradictory state (D9) | S7 mood-day modal (SOURCE-DERIVED): the line "Tiada sesi latihan pada hari ini. Pelajar hanya checkin mood." is part of the modal for any mood dot. | The line shows **only when the day's week bar is 0** (a day with sessions never says "no session"); the modal otherwise unchanged. | Approved (D9; SOURCE-DERIVED layout) |
| DV-M17-36 | M17-T3a build (v1.12) | Responsive breakage (D9) | S7 week labels ("dd/mm") overlap at 320 px because the 8 bar columns are narrower than the label. | Below 640 px each week label stacks "dd" over "/mm"; at 640 px and above the label is one line as live. Bars, order and values unchanged. | Approved (D9) |
| DV-M17-38 | v1.13 (M05 feasibility); extends R-30 | Contradictory (observed vs observed) | S2 T3 "aktif 30h" **91** on live; the month figure 86 (S3 / S2 month) and M11's 30-day "Pernah Aktif" 89 are also observed. M05 confirmed that no answer-log placement gives 91 together with those two (M05's analysis; its reasoning is not restated here). The rebuild's computed 30-day set is ≥ 94. | S2 T3 shows the **computed** Q-M17-ENGAGED(30d) (≥ 94); 86 and 89 stay exact. Alternatives rejected: display constant 91 — it would sit beside the computed 30-day figures of M11 / S3 in the same session and contradict the M05 placement; change month 86 or M11 89 — two observed values instead of one. | Approved (D9, v1.13) |
| DV-M17-39 | v1.13 (M17-T3a / E2E) | Responsive breakage (D9) | S6 "Senarai Pelajar" at 768 px overflows its card (the table is wider than the card). | The table fits its card at 768 px: headers may wrap, cell padding 8 px, minimum width 560 px; below 640 px it scrolls inside the card (DV-M17-02). Columns, order and values unchanged. | Approved (D9) |
| DV-M17-40 | v1.13; was covered only by DC-M17-03 in SRS §6.3 | Display constant (replicated) | S2 "Pembetulan": "899" Rekod · "+0.0%" Purata Naik · "0%" Kadar Baik (observed; definition unobservable, no platform correction record exists in M05). | **Replicated** as the documented display constant DC-M17-03 for the admin; school admins see zeros (OQ-M17-12). No computed correction figure on S2 beside it. Registered under its own id (previously only DC-M17-03, with DV-M17-24 cited for the neighbouring "Engagement" constant DC-M17-05). | Rejected — replicate live (definition UNVERIFIED) |
| DV-M17-42 | v1.13 (alias build) | Dead link (D9) | S3 carries a "Laporan Eksekutif" link; S8 is admin-only. | On the Admin Sekolah alias S3 the link is **not rendered** (it would be a dead link for a school admin); admin S3 keeps it. | Approved (D9) |
| DV-M17-43 | v1.13 (S2 build) | Layout (D9, minimal) | S2 "Top Sekolah" school names truncate at every width; in the single column at 375 px the truncation hides the name. | Names **wrap below `xl`** (1280 px) and **truncate from `xl`**; nothing else changes. | Approved (D9) |
| DV-M17-44 | v1.13 (alias build); FR-M17-107 | Layout (D9) | S2 has no alias layout on live (Top Sekolah is shown to the admin). | With Top Sekolah hidden for a school admin, "Mood Pelajar" moves into the freed column so no column ends in a hole; the admin layout keeps live's column placement. | Approved (D9; alias reflow PROPOSED) |
| DV-M17-41 | v1.13 (M10 mock v5 enrolments); supersedes DV-M17-29 | Contradictory (observed vs rebuild; D9) | S3 school 8284: live "Bulan Ini" "1 GURU" and "Minggu Ini" "0 GURU" for the same single pupil. M10's designed enrolments are now built; the only answering pupil (5994) is a generated T5 member of class 36. All other observed "{n} GURU" values match (8106 2 / 17 / 18, 8082 1 / 50 / 61, 8080 1 / 6 / 8, 8078 22 / 37, 8090 9 / 23, 8088 0). | 8284 shows **1 in both rows** (month 1 = live; **week 1, live 0**). Alternative rejected: move pupil 5994 out of class 36 to get week 0 — it would break M05's T5 ladder (M05 `prime.ts` depends on the T5 set). DV-M17-29's month 0 is withdrawn. | Approved (D9, v1.13) |
| DV-M17-37 | M17-T3a build (v1.12) | Missing state (PROPOSED) | A page-level load failure of S4–S7 (non-404) has no live observation. | The pages show "Ralat memuatkan data" (the S7 modal copy observed live); 404 stays the global 404 page. | PROPOSED (provisional) |
| DV-M17-45 | - | Language (BM copy) | Command Center (board, daily, drill-downs): "Top Pelajar" / "Top Sekolah", "Engagement", "ALESA AI Insight", "Kembali ke Overview", "Badge Terkini", raw role words "admin/student/teacher" on the login rows, "checkin mood" | "Pelajar Teratas" / "Sekolah Teratas", "Penglibatan", "Wawasan ALESA AI", "Kembali ke Gambaran Keseluruhan", "Lencana Terkini", "Admin/Murid/Guru", "mendaftar masuk mood". | Approved: user decision 2026-10-24 (system audit FB-025) |

**Discovery notes corrected by evidence (not deviations; reported to the discovery owner):** (1) S5 with no class shows the table row "Tiada kelas aktif" (`cc-teacher-empty.png`, snapshot `S5_teacher…classTable.rows`), not "an empty table and no message" (discovery §2.5); the inventory did not capture that row as an element. (2) The S2 feed rows at 8087 are not today's activity (DV-M17-27). (3) S3 school order is by active pupils, not by answers (week and month lists).

**Replicated as working (not deviations):** S2 panels scroll internally at 1280; S3 rows without answers at 50 % opacity; S3 `?period=` ignored and unknown API periods echoed; S5 "Senarai Kelas (0)" with the row "Tiada kelas aktif"; S8 empty months without values; S8 future years accepted; S8/S9 subtitle "Selamat datang, Admin"; S10 matrix scrolls at every width; S11 filters client-side without an empty-state row; "Command Center" and "Aktiviti Harian" missing from the mobile drawer.

---

## 8. Out of scope

| Item | Owner / reason |
|---|---|
| `/admin/monitoring*` screens and exports (content) | M11 (mounted here, FN-M17-1.2.6) |
| `/admin/performance` | M23 (system performance & security) |
| KIRKPATRICK submenu and `/admin/kirkpatrick/*` | M12 |
| "Audio KBAT" (`/admin/audio-kbat`) | M09 |
| Targets of S1 quick actions and quick links (question create/import, subject create, curriculum, banners, articles) | M04, M03, M09 |
| `/battle/ranking-sekolah`, `/battle/leaderboard` | M16 |
| `/guru/command-center` (S2 of M10) and its own panels | M10 (it mounts the S4–S7 component of this module) |
| `/ppd/command-center`, `/jpn/command-center` | M18 |
| `/admin-sekolah` dashboard, school picker and other school-admin pages (v1.11) | M27 (M17 owns only the Command Center alias, EP-M17-10) |
| Cross-school cards ("Top Sekolah", "Aktiviti Mengikut Sekolah") for the school admin; writes of any kind from the alias (v1.11) | Hidden / not applicable (L06 §5.7) |
| Stores behind the figures (questions, answers, sessions, users, schools, classes, headcount, SPM history, Kirkpatrick feedback, wallets, badges, battles, sponsors, tuition centres, mood check-ins) | Their owners (D12; SRS §6.1) |
| Global admin shell (sidebar, header, server-status widget, mobile nav) | Global shell / M23 (M17 owns only the targets of its entries) |
| Real CSV export content, real cache infrastructure, real server-side authorisation and auditing | Backend phase (SRS §11.1) |

---

## 9. Open questions

1. **OQ-M17-01 Mood check-in owner — decided: M26** (Delivery Lead, XL3-23). S2 "Mood Pelajar", S3 "Mood Pelajar", S6 "Mood" column and S7 "Trend Mood" read M26's mood check-in store through a provisional owner contract (SRS XR-M17-18: 750 check-ins, all before 1 Sep 2026) until M26 is specified; the mood E2E stay provisional until then. It never blocked G1.
2. **OQ-M17-02 Platform accuracy — owner fix, not a user question (XR-M17-03, mandatory at the XL batch 3 gate).** 82.9 % is correct ÷ answered over the pupils' answers: the 26 S8 subject rows alone (Σ 477,888 answers) give 395,762–396,240 correct = 82.86 % (auditor; the M17 script gives 395,771–396,229), and the S3 JSON `correct_answers` confirm correct ÷ answered per period. M05's PROPOSED Q-ANS-CORRECT 381,842 (derived by reading M08's "79.8 %" as correct ÷ answered) must rise so that Q-M17-ACC = 82.9 % at the project clock (band 395,811–396,287 correct of 477,743; value to use 395,873); M08's 79.8 % needs another definition (recommended: mean of completed-session accuracies) or an M08 display constant. M17 keeps 82.9 % as the computed value.
3. **OQ-M17-03 Executive per-school attribution.** S8/S9 per-school figures are kept as documented display data DC-M17-07 (no owner definition reproduces them). Delivery Lead to confirm the D11 exception for this block (alternatives in SRS §6.5 R-24).
4. **OQ-M17-04 CSV exports (disc. OQ-M17-01).** Columns and content of `/admin/export/{users,questions,payments,schools}` are unobserved; the prototype's columns are PROPOSED (SRS §7 #2).
5. **OQ-M17-05 Refresh (disc. OQ-M17-02).** Live rebuilds the report at the request minute on every load (AUD-M17-02); what `clear-cache` adds (e.g. a longer cache) and whether a message shows are unobserved. The prototype builds at request time (≤ 60 s cache, INFERRED), and Refresh drops the entry and reloads without a flash (INFERRED; E2E-72 provisional).
6. **OQ-M17-06 Other roles (disc. OQ-M17-08, OQ-M17-10).** What PPD/JPN/school-admin/teacher accounts see on `/admin/*`, and whether the teacher drill-down is scoped to own classes; prototype rules INFERRED, E2E provisional.
7. **OQ-M17-07 Inferred definitions to confirm with the owner:** "Pelajar Berdaftar" = active pupil accounts (3,152); "Guru" = active teachers (502); "aktif menjawab" = active pupils with ≥ 1 answer; "Murid Buat Latihan" = active pupils with a session or structured attempt; S6 "Aktif" = activity in the last 7 days; S3 "{n} GURU" = teachers with an active pupil in their classes; S7 "Konsistensi" = active days ÷ 56; S7 "Streak"; S11 "Latihan" = sessions; S11 "Pelajar Paling Aktif" = all-time activities.
8. **OQ-M17-08 PROPOSED items to report at G1 (same list as SRS §8.2):** (1) "Login Minggu Ini" / "Login Bulan Ini" (DV-M17-10); (2) "{tahun+1} →" (DV-M17-14); (3) S1 sponsor sub-line "Perlu tindakan" when pending > 0; (4) API message "Julat tarikh tidak sah."; (5) CSV export columns (SRS §7 #2); (6) Refresh behaviour (drop cache, reload, no flash); (7) S3 subject bars, S3 live feed with rows, S3 badges, S7 mood dots and mood-day modal (SOURCE-DERIVED layouts, DV-M17-11); (8) the S11 Murid filter orders (DV-M17-18); (9) the new "Kuiz Objektif" values from DV-M17-16 (7 / 30 / 90 days: 420 / 1,409 / 4,907 at the project clock); (10) the per-day placement of structured, battle and game activities in the S11 series and the 28/06 point (0) of the 90-day window; (11) the placement of the 25 Sep sessions before the clock (4 × 40 by the 8082 week pupil 2016, 6 + 6 by the 8106 pupils 2018 / 2019, the week sessions of 2017, 2018, 2019 in SPM modes, pupil 2022's sessionless answers on 2026-05-04; S3 "today", heatmap, live feed; SRS §6.7 B), the correct counts of the 85 post-clock answers without observed accuracy, the 145 post-clock answers removed from Bahasa Melayu (S8), the 28/06 point (0), and the re-dated login times (the post-clock logins on 25 Sep before 15:40 in the same order; 3 unlisted 25/09 pupils at 09:00–11:00; SRS §6.6).
9. **OQ-M17-09 Values held by other modules' pins.** S11 "Sekolah (61)", the per-school "Guru" totals and the 8106 login count are DV-M17-28 (cross-module constraint); XR-M17-08 was rejected by M02 v1.12, so the fallback values are final. The live S2/S4 answer totals of 8078, 8106 and 8090 (JSON only; their S4 pages were not observed) cannot all hold together with M05's fixed answer log (SRS §6.5 R-23, C-12) and are computed. **v1.12 (DV-M17-33):** 8082 (393 / 130,233) and 8080 (53,494) now take M11's observed weekly cells over the live M17 values; the Delivery Lead then decided (same day) that "M11 wins" applies uniformly to all five schools (8078 345 / 88,968, 8106 306 / 59,211, 8090 134 / 120,782) — OQ-M17-09 closed. New SRS OQ-M17-16 asks M05 how S6 "Terakhir Aktif" stays exact while S4 / S5 "Aktif (30h)" uses the last completed-session time.
10. **OQ-M17-10 Unobservable states (disc. OQ-M17-05).** S3 subjects/feed with data, badges and mood; S7 mood dots and mood-day modal; S2 "Top Improvers" (never shown); positive and zero week change; API error states — SOURCE-DERIVED layouts, provisional E2E.
11. **OQ-M17-11 — closed (v1.9).** After M02 v1.23, 51 of 57 S11 "Murid" totals are computed exact; 5441, 3390, 853, 3931 and 8030 use the display constant DC-M17-09; 2418 shows the computed 4 (DV-M17-31).
12. **OQ-M17-12 — decided (Delivery Lead, 2026-10-02; checked against the server, D24).** For the school scope "Engagement" (DC-M17-05) shows the school's own answers per day for 7 days (SERVER `PlatformMetrics.php:133-152`); "Pembetulan" (DC-M17-03) shows zeros (INFERRED: the server's "Laporan Baru / Selesai" panel differs from observed live, live wins); platform display constants are never shown to a school admin.
13. **OQ-M17-13 — decided (Delivery Lead, 2026-10-02).** Out-of-school ids on drill-downs answer **404** (not 403), the same as the teacher rule BR-M17-30, so existence is not revealed; unknown ids also 404 (INFERRED; the server has no school-admin drill-downs).
14. **OQ-M17-14 — decided (INFERRED / PROPOSED).** The S3 alias URL is `/admin-sekolah/command-center/daily-activity`, in release 1.0 as Should (the server's shared `/admin/command-center/daily-activity` contradicts the live `/admin-sekolah` prefix; live wins).
15. **OQ-M17-15 — decided (INFERRED).** "← Dashboard" for a school admin → `/admin-sekolah` (M27; picker behaviour OQ-M27-05); the server's staff landing `/admin` contradicts the live school-admin home, live wins.
