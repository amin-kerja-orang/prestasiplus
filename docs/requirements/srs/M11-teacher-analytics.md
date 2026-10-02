# M11 — Teacher Portal: Analytics & Reports — Software Requirements Specification

## 0. Document control

| Field | Value |
|---|---|
| Document | SRS — M11 Teacher Portal: Analytics & Reports |
| Version | 1.10 |
| Date | 2026-09-25 |
| Status | Approved (G1) — v1.10; independent audit PASS in round 3 (`docs/qa/audit/M11-audit.md`); v1.4–v1.10 apply the M11 items of the cross-module logic review batch 2 and the owner contracts (M01 v1.9, M02 v1.11, M04 v1.9, M05 v1.8, M08 v1.7, M10 v1.6) (`docs/qa/audit/cross-module-logic-M08-M11.md`) without changing any approved behaviour or observed value. |
| Author | product-analyst (agent) for §1–§5, §8–§10, §12–§13; solution-architect (agent) for §6 data entities, seeds and D11 datasets, §7 mock API, §11 |
| Source URS | [urs/M11-teacher-analytics.md](../urs/M11-teacher-analytics.md) v1.1 (85 FN, 29 stories, AC-M11-nn.m) |
| Source discovery | [M11-teacher-analytics.md](../../discovery/M11-teacher-analytics.md), inventory `docs/discovery/inventory/M11/`, screenshots `docs/discovery/img/M11/` |
| Related | [M01](M01-authentication.md) v1.9 (User, guest redirect, 403/404 pages, canonical accounts 1–11), [M02](M02-users-schools.md) v1.10 (School register D11 10,220 schools, users, subscriptions; integer ids), [M03](M03-curriculum.md) (subjects 1–31, levels 1–11, chapters), [M04](M04-question-bank.md) v1.7 (`questions.*` repository, D11; M11 anchors 700401–700931, `chapterLabel`, `curriculumTopicId`), [M05](M05-practice.md) v1.7 (PracticeSession DATA-M05-01, QuizAnswer DATA-M05-02 — the only activity source; mock clock), [M08](M08-student-performance.md) v1.7 (`/analisa-item/*` rules; designed classes 2001–2002, students 3001–3008, fixture questions 700001–700008), M10 v1.6 (Classroom, Enrolment, #12 `/api/guru/classes`, §7 **T** guard), M12, M16, M17 (mounts §7 #3–#7 on `/admin/monitoring*`), M18, [design/shells.md](../../design/shells.md) |

**Change log**

| Version | Date | Change |
|---|---|---|
| 1.10 | 2026-09-27 | **Revision history — v1.10, XL3 round 3 R3-04.** BR-M11-04 and §6.6: the M05 mode `pksk` is classified as "Kuiz" (M05 v1.12 BR-35). No other change. Status stays Approved (G1). |
| 1.9 | 2026-09-27 | **Revision history — v1.9, XL batch 3 XL3-13** (`docs/qa/audit/cross-module-logic-M12-M18.md`). (1) The 12 answers before M1 move from 8880 to **8765** (M05 v1.10 §6.14.1, M18 XR-M18-04): §6.7 rows 8880 = 10,196 and 8765 = 222 (Σ weekly 472,359 + 12 = 472,371, verified by script `gen-seed.js`; the moved value was `observed:false`, so no observed value changes). (2) 8080 students **4664** ("Login sahaja") and **4644** ("Belum login") are M02 v1.12 users inside 8080's 184 (§6.7); their S3 rows link to `/admin/kirkpatrick/pelajar/4664` and `/4644` (FR-58, M12 XR-06/10, no second id); new FR-M11-87 / AC-21.5 / E2E-M11-55 specify the S4 page of a student with 0 answers (PROPOSED). (3) S1 "Battle" / "Permainan" counts and the "Battle" score bar read M16 v1.3 `battles.countFor` / `gameResults.countFor` (§7.2, XR-M16-05; BR-M11-04/05). M16's Q-M16-BATTLES / Q-M16-BATTLES-WIN are M17 platform counts and are not shown by M11. (4) 3201–3215 at 8880 (M02 v1.12, sessionless 6,563 answers, M05 Q-ANS-NOSESSION; M18 v1.4 DV-43): 8880's row stays 53 · Aktif 31 · Login sahaja 14 · Belum login 8 (+0) — the 15 are T4, logged in, answered, inside the 26 T4 and the 31 Aktif. (5) XR-M17-08: M11 keeps its teacher-table rule (the review recommends rejecting the change; M17 keeps DV-M17-28). Status stays Approved (G1). |
| 1.8 | 2026-09-26 | **Revision history — v1.8, XL round 3 residual XL2-47.** Owner references refreshed to M01 v1.9, M02 v1.11, M04 v1.9, M05 v1.8, M08 v1.7, M10 v1.6 (Related rows, status, body; the SQ-M11-03 note no longer cites M04 v1.7). No behaviour or value change. Status stays Approved (G1). |
| 1.7 | 2026-09-26 | **Revision history — v1.7, XL round 2 residual XL2-47** (`docs/qa/audit/cross-module-logic-M08-M11.md` R2.4). Owner references refreshed to M01 v1.9, M02 v1.10, M04 v1.9, M05 v1.7, M08 v1.7, M10 v1.5; "requested" wording removed where delivered: §6.1 (`lastLoginAt` = M01 field; `chapterLabel` / `curriculumTopicId` = M04 FR-M04-126), §6.8 (`lastLoginAt` values seeded by M02, XL2-43), §6.10 retitled "Cross-module contracts (delivered)", SQ-M11-01 closed. No behaviour or value change. Status stays Approved (G1). |
| 1.6 | 2026-09-26 | **Revision history — v1.6, M05 v1.6 alignment.** §6.5.1 uses the M05 §6.14.2 named queries: Q-ANS-SEG (S2–S5), Q-ANS-USER (S4/S5), Q-SESS-USER (S1), Q-ANS-CLASS / Q-SESS-CLASS (S6), and M01 `lastLoginAt` for login figures. Four M11-local queries remain where M05 has none, each defined on an owner dataset: Q-M11-T45 and Q-M11-TEACHERS (M02 users), Q-M11-ACTIVE (distinct users over Q-ANS-SEG) and Q-M11-STRUCT (M05 StructuredAttempt `submittedAt`). XL2-22 confirmed: structured `submittedAt`, sessions `completedAt`, answers `answeredAt`. M05 modes `mission`, `remedial`, `question_set` → "Kuiz" (§6.6, BR-M11-04; M05 recommendation adopted). BR-M11-02/03/04/09, FR-M11-85 and XR-M11-04 cite the M05 names. Status stays Approved (G1). |
| 1.5 | 2026-09-26 | **Revision history — v1.5, M04 v1.7 alignment.** The anchors of Students A/B/C are the M04 block **700401–700931** (M04 §6.13.2, row "M11 anchors"): M11 needs exactly 531 (one question per observed answer; A 700401–700471, B 700472–700666, C 700667–700931), listed by M04 cell in §6.7. The label field is `chapterLabel` (was the placeholder `legacyChapterLabel`) with `curriculumTopicId` (FR-M04-126 `questions.get`) — BR-M11-19, BR-M11-21, §6.5.1, XR-M11-05. M04 stores are referenced by the repository names `questions.*` (M11 reads no `structured.*` or `reports.*` data). M05 v1.5 has not yet published §6.14 named queries, so the Q-M11-* names stay. Status stays Approved (G1). |
| 1.4 | 2026-09-26 | **Revision history — v1.4, cross-module logic review batch 2** (`docs/qa/audit/cross-module-logic-M08-M11.md`, M11 halves; no approved behaviour or observed value changes). XL2-18: #2 → M10 #12 `GET /api/guru/classes` (§7, XR-M11-07). XL2-01: answer, activity and engaged counts are named queries of the M05 answer-log dataset (the 472,371 segment at the snapshot) and login counts read M01 `User.lastLoginAt` (XL2-07) — new §6.5.1 lists each query and its owner definition (BR-M11-02/03/04/09, FR-85). XL2-03/04: the register and subscriptions come from the M02 v1.8 allocation; §6.7 is its target (XR-M11-02/03). XL2-16: the anchor questions of Students A/B/C and their chapter labels come from the M04 anchor block and question-level label field (`legacyChapterLabel`), topics from `curriculumTopicId` (BR-M11-19/21, §6.7, XR-M11-05). XL2-22: structured attempts read M05 `submittedAt`. XL2-28: DV-M11-23 (NFR-M11-08). XL2-31: status and M10 references refreshed; §9 and FR-08 cite the M10 §7 **T** guard. Status stays Approved (G1). |
| 1.3 | 2026-09-25 | **Revision history — v1.3, audit round 2** (FAIL 0 Critical / 1 Major / 3 Minor). AUD-M11-15: BR-M11-34 reworded as an exclusion of the reserved fixture range 900001–900099 only; live-range and runtime schools (ids ≥ 10,301, M02) are counted; new AC-M11-14.7 / E2E-M11-54 (runtime school appears) and hook `mock.addRuntimeSchool()`; v1.2 change-log wording corrected. AUD-M11-16: the 12 answers before M1 moved to Johor 8880 (observed:false); AC-13.4 / E2E-23 Selangor 460,858; Johor KPIs asserted. AUD-M11-17: a direct drill-down URL for a fixture school renders its detail page (INFERRED; drill-down unscoped as live, BR-29); rule added to XR-M11-08. AUD-M11-18: chapter-label groups of Students A, B and C pinned (chips 0 / 2 / 6; B's Fizik and Matematik answers without label). I4: E2E-53 reworded. 86 FRs, 34 BRs, 101 ACs, 54 E2E (14 provisional). |
| 1.2 | 2026-09-25 | **Revision history — v1.2, Delivery Lead decision on OQ-M11-09 (option a).** New BR-M11-34: the reserved fixture schools 900001–900099 (M02 SRS §6.15) are excluded from the platform monitoring rollups (S2 tables, KPIs, lists, weekly rows) — wording corrected in v1.3 to an exclusion of that range only, so every observed S2 figure stays exact and "Jumlah Sekolah" 57 = M02's 60 schools with users − 3 fixture schools (BR-M11-08). Fixture accounts keep appearing in their own teacher, class and student views (M08, M10, M13). FR-38/41/85 cite it; E2E-22/24/26/28/30/51 assert the observed values without dependency; new AC-M11-14.6 and E2E-M11-53 (SMK DEMO absent from S2). 53 E2E (14 provisional). |
| 1.1 | 2026-09-25 | **Revision history — v1.1, audit round 1** (FAIL 1 Critical / 9 Major / 4 Minor) and the discovery top-up snapshot `_snapshot-2026-09-25.json` (19:24). AUD-01: DV-M11-11 withdrawn — S2/S5 and S3 are two declared definitions (FR-50, FR-73, BR-09, BR-24); flags seeded at 7 schools as observed (DATA-M11-01). AUD-02/03/13/14: §6.7 rebuilt from the snapshot — live school ids, per-school registered / Aktif (all, 7d, 30d, 3m) / answers / teachers / status / flags / subscriptions, every weekly cell observed, Student A's 18 topic rows; a script re-derives every S2 view, list and order with 0 differences; new E2E-51 (30d); E2E-27 observed. AUD-04: weekly colour rule from the page script (equal week = blue; BR-15), 0 mismatches over 1,056 cells. AUD-05/06: S3 pill membership and status counts from the row expressions (BR-18, BR-24; 8080 4 / 6 / +2); top-up defect D-M11-19 fixed by DV-M11-21 (the "Aktif (n)" pill shows its n rows; FR-55). AUD-07: Cancelled/Expired pills and the one-sentence warning (BR-17, BR-33, FR-53, FR-57, E2E-52). AUD-08: teacher seed on M08 v1.4 (§6.8; anchors recomputed); the fixture school 900001 would add a 34th monitoring row — reported, not tuned (OQ-M11-09). AUD-09: v1.0 id blocks withdrawn; XR-M11-02 restated inside the users dataset 1–6,000 (Student A = 2008). AUD-10: DV-M11-08 withdrawn, gap rule < 60% (BR-19, FR-69). AUD-11: other S2↔S3 differences replicated (FR-86, BR-32). AUD-12: recomputed gap content recorded as DV-M11-20. 86 FRs, 33 BRs, 52 E2E (14 provisional). |
| 1.0 | 2026-09-25 | First issue. 85 FRs, 31 BRs, 2 owned entities + 10 read models, 9 mock endpoints (7 owned, 2 referenced), 50 E2E (16 provisional), 8 SEC items. Counts computed from the M02/M05 D11 datasets (D11/D12); cross-module requests in §6.10. |

### 0.1 Fidelity deviations referenced here

URS §7 is authoritative. Approved fixes: DV-M11-01 (one S1 population), 02 (Gap tab), 03 (guide legend), 06 (all wrong answers), 07 (one Tingkatan format), 12 (active menu item), 16 (S1 375 overflow), 17 (36px selects), 18 (name escaping), 20 (recomputed gap content). Provisional: DV-M11-13 (`/guru/perbandingan-kelas`), DV-M11-19 (teacher view of `/guru/laporan-mingguan-kelas`). Rejected — replicate live: DV-M11-04, 05, 09, 10, 14, 15, 21, 22. Withdrawn in v1.1: DV-M11-08, DV-M11-11.

---

## 1. Scope

The M11 prototype implements, against the mock service layer, the eight screens of URS §1: the teacher report S1, the **shared monitoring component** S2–S5 (mounted on `/guru/monitoring*` here and on `/admin/monitoring*` by M17), the item analysis S6 and the two blocked pages S7/S8. Every figure is **computed** from the owners' datasets (M02 users and schools, M05 sessions and answers, M04 questions, M10 classes) per D11/D12; M11 stores only the anomaly flags (DATA-M11-01) and constants (DATA-M11-02).

**Out of scope:** URS §8 — M08 pages, M17 route guard/menu, M10 classes and guard, real exports, real anomaly detection, the content of the blocked pages (OQ-M11-01), the backend.

---

## 2. Screens & routes

Query names are kept as on live (`range`, `classroom_id`, `period`, `state`, `tahap`, `subject_id`, `_token`) so bookmarked links work unchanged.

| # | Route | Screen | Primary actor(s) | Shell · header / tab title | API (§7) |
|---|---|---|---|---|---|
| S1 | `/guru/laporan` | Laporan Statistik | Guru (INFERRED); Admin | SHU · "Laporan Statistik" / "Laporan Statistik - Portal Guru" | #1, #2 |
| S2 | `/guru/monitoring` (also `/admin/monitoring`, M17) | Monitoring Penglibatan | Admin; Guru (UNVERIFIED) | SHA · "Monitoring Penglibatan" / "Monitoring Penglibatan Sekolah - Admin" | #3, #7 |
| S3 | `/guru/monitoring/sekolah/{schoolId}` (+ `/admin/…`) | Detail Sekolah | Admin | SHA · "Detail Sekolah" / "{sekolah} - Monitoring" | #4 |
| S4 | `/guru/monitoring/sekolah/{schoolId}/pelajar/{userId}` (+ `/admin/…`) | Detail Pelajar | Admin | SHA · "Detail Pelajar" / "{nama} - Detail Pelajar" | #5 |
| S5 | `/guru/monitoring/sekolah/{schoolId}/guru/{userId}` (+ `/admin/…`) | Detail Guru | Admin | SHA · "Detail Guru" / "{nama} - Detail Guru" | #6 |
| S6 | `/guru/analisis-item` | Analisis Item Soalan | Guru; Admin | SHU · "Analisis Item Soalan" / "Analisis Item Soalan - Portal Guru" | #8, #2, #9 |
| S7 | `/guru/perbandingan-kelas` | Perbandingan Kelas (provisional, DV-M11-13) | Guru; Admin | SHU · "Perbandingan Kelas" / "Perbandingan Kelas - Portal Guru" (PROPOSED) | — |
| S8 | `/guru/laporan-mingguan-kelas` (`?week=`, `/{id}`) | 403 (admin) / provisional (teacher, DV-M11-19) | Admin; Guru | standalone 403 · "403 - Akses Ditolak \| PRESTASIPLUS" / teacher: SHU "Laporan Mingguan" (PROPOSED) | — |

`{schoolId}` and `{userId}` are integers (M02 ids). Non-numeric or unknown ids → the M01 404 page.

---

## 3. Functional requirements

| ID | Requirement | FN | AC |
|---|---|---|---|
| FR-M11-01 | The user-portal menu SHALL hold, in the "Portal Guru" group, under "PENILAIAN" `fa-chart-pie` "Laporan" → `/guru/laporan` and under "ANALITIK" `fa-binoculars` "Monitoring" → `/guru/monitoring`, `fa-chart-pie` "Analisis Item" → `/guru/analisis-item`, `fa-balance-scale` "Perbandingan Kelas" → `/guru/perbandingan-kelas`, `fa-calendar-week` "Laporan Mingguan" → `/guru/laporan-mingguan-kelas`, in that order among the group's other items (owned by M08/M18/M12). For the admin the group is in the DOM and not displayed (as live); for the teacher it is displayed (INFERRED). Menu position per the shell's single menu definition (DV-SH-04). | 1.1.1 | 01.1, 01.2 |
| FR-M11-02 | Each screen SHALL set the live header title/subtitle and tab title of URS §1 (S1, S2, S6 as listed; S6 subtitle truncates with an ellipsis where it does not fit, as live). | 1.1.2 | 01.3 |
| FR-M11-03 | S3–S5 SHALL show the admin-panel header "Detail Sekolah" / "Detail Pelajar" / "Detail Guru" with the breadcrumb "`fa-arrow-left` Monitoring" → `/admin/monitoring` / "{sekolah}" (S4/S5: link → `/admin/monitoring/sekolah/{schoolId}`) / "{nama}" (S4/S5), whatever the route prefix. | 1.1.3 | 01.4 |
| FR-M11-04 | S1 and S6 SHALL render in the user-portal shell; S2–S5 in the admin-panel shell on both prefixes (for a teacher: same shell, provisional); S7/S8 per FR-81–83; 404 pages standalone. | 1.1.4 | 01.5 |
| FR-M11-05 | The admin-panel sidebar item "ANALITIK › Monitoring" and its "Lagi" twin SHALL be marked active on every route matching `/guru/monitoring*` or `/admin/monitoring*` (DV-M11-12). | 1.1.5 | 02.1, 02.2 |
| FR-M11-06 | Every M11 route SHALL require a session; a guest SHALL be redirected to `/login` by the M01 guard (INFERRED). | 1.2.1 | 03.1 |
| FR-M11-07 | Unknown `schoolId`/`userId` on S3–S5 (API 404) and unknown sub-paths (`/guru/laporan/{x}`, `/guru/analisis-item/{x}`, `/guru/perbandingan`) SHALL render the M01 global 404 page (exact copy URS FN-M11-1.2.2). A `userId` that exists but is not a T4/T5 student (S4) or a teacher (S5) SHALL also give 404 (INFERRED). A fixture school id (900001–900099) is a known school: its S3–S5 pages render (BR-M11-34). | 1.2.2 | 03.2 |
| FR-M11-08 | Access: admin → every screen (OBSERVED). Teacher → S1, S6, S7 stand-in, S8 stand-in, S2–S5 on `/guru/…` (provisional, OQ-M11-02); `/admin/monitoring*` for a non-admin follows the M17/M01 rule (redirect to the M01 landing page, INFERRED). Other roles → the M10 `/guru/*` guard (M10 §7 **T**: teacher or admin; other roles 403 and the M01 landing page). | 1.2.3 | 03.4 |
| FR-M11-09 | S4/S5 SHALL load the person by `userId` without checking that the person belongs to `schoolId`; the breadcrumb and back links use the URL's `schoolId` (as live; SEC-M11-02). | 1.2.4 | 03.3 |
| FR-M11-10 | S1 SHALL render the filter card: `fa-filter` "Tapis:", a GET form to `/guru/laporan` with hidden `range` = current range and select `classroom_id` ("Semua Kelas" '' + own classes from #2, current value selected, `onchange` submits). | 2.1.1 | 04.1, 04.3 |
| FR-M11-11 | S1 SHALL render range pills as links `?range=7` "7 Hari", `?range=30` "30 Hari", `?range=90` "3 Bulan" (active/inactive classes of FN-2.1.2); `range` not in {7, 30, 90} → 30 (BR-M11-06); the pill links carry no `classroom_id`. | 2.1.2 | 04.1, 04.2, 04.3 |
| FR-M11-12 | #1 SHALL compute every S1 figure over the single population of BR-M11-01 (DV-M11-01). | 2.2.1 | 05.1, 05.2, 05.3 |
| FR-M11-13 | Card "Pernah Login": icon, "{p}%" (BR-M11-02), "**{login}** / {n} pelajar", red line "{n − login} belum pernah login" only when > 0, "Klik untuk lihat senarai". | 2.2.2 | 05.1, 05.2, 05.3 |
| FR-M11-14 | Card "Pernah Buat Latihan": "{p}%" (BR-M11-03), "**{practised}** / {n} pelajar", "Klik untuk lihat senarai". | 2.2.3 | 05.1, 05.2 |
| FR-M11-15 | Card "Jumlah Aktiviti": total activities (BR-M11-04), "{range} hari lepas", an empty chip row, "Klik untuk lihat pecahan". | 2.2.4 | 05.1, 05.4 |
| FR-M11-16 | Card "Skor Purata": "{p}%" or "-%" (BR-M11-05), empty chip row, "Klik untuk lihat pecahan". | 2.2.5 | 05.1, 05.2 |
| FR-M11-17 | The four cards SHALL share one `expanded` state (null / login / latihan / aktiviti / skor): a click sets it to the card's key or back to null if already set; the open card shows `ring-2 ring-{colour}-400` and a rotated chevron; the panel expands below the card grid. | 2.2.6 | 06.1 |
| FR-M11-18 | Panel login SHALL show "Pelajar Belum Pernah Login ({n})" and either "Semua pelajar sudah pernah login!" (n = 0) or the students (row layout of FR-24, name A→Z, INFERRED). | 2.2.7 | 06.2, 06.4 |
| FR-M11-19 | Panel latihan SHALL show "Pelajar Belum Pernah Buat Latihan ({n})" and either "Semua pelajar sudah aktif buat latihan!" (n = 0) or the students (INFERRED). | 2.2.8 | 06.2 |
| FR-M11-20 | Panel aktiviti SHALL show "Pecahan Aktiviti ({range} Hari Lepas)" and the 7 tiles of FN-2.2.9 with the per-type counts of BR-M11-04 and "Jumlah" = their sum. | 2.2.9 | 06.3, 06.4 |
| FR-M11-21 | Panel skor SHALL show "Pecahan Skor Purata" with 5 bar cards (Kuiz, Struktur, Latih Tubi, Tracking A, Battle): "{p}%" / "-%" (BR-M11-05) and a bar of width p% (0 when "-%"); "-%" text red-500 with a red-400 bar (live); colours of values > 0 per BR-M11-22 (INFERRED). | 2.2.10 | 06.3, 06.4 |
| FR-M11-22 | S1 SHALL render "Trend Aktiviti" with the Chart.js 4 line chart of URS FN-M11-2.3.1 (config exact), labels `dd/mm` for each day of the range ending today, data = activities per day (BR-M11-04). | 2.3.1 | 07.1, 07.2 |
| FR-M11-23 | "Paling Aktif" SHALL show "Belum ada aktiviti" when no population student has activity in the range; otherwise (PROPOSED, provisional) up to 10 rows, activity count descending then name A→Z, row layout of FR-24 with right label "{n} aktiviti". | 2.4.1 | 08.1, 08.2 |
| FR-M11-24 | "Belum Pernah Buat Latihan" SHALL list up to 10 population students without any practice session (name A→Z): avatar (M01 initials image, background #94a3b8), name (semibold, truncate), e-mail (10px slate-400, truncate), right label "Belum pernah login" (10px red-400) when `lastLoginAt` is null (other label UNVERIFIED: none rendered); empty → "Semua pelajar sudah aktif buat latihan!" (PROPOSED reuse). | 2.4.2 | 08.1, 08.2 |
| FR-M11-25 | The two list cards SHALL sit in `grid md:grid-cols-2` with shrinkable items (`min-w-0`) so that no content widens the page (DV-M11-16). | 2.4.3 | 08.3, 29.1 |
| FR-M11-26 | S2 guide visibility SHALL be read from `localStorage['hideMonitoringGuide']` (`'true'` → hidden); ✕ hides and sets it; "`fa-question-circle` Tunjuk panduan penggunaan" shows and removes it. Storage failures fall back to "shown". | 3.1.1 | 09.2 |
| FR-M11-27 | The guide SHALL render the six tiles of URS FN-M11-3.1.2 (exact copy, bold parts, anchors `#section-ringkasan`, `#section-pelajar`, `#section-guru`, `#section-mingguan`, `#section-perhatian`, `#section-pelajar`); anchors scroll smoothly with an 80px top margin. | 3.1.2 | 09.1, 09.4 |
| FR-M11-28 | The "Table Pelajar" tile legend SHALL read "**Cemerlang** >60% \| **Sederhana** 20-60% \| **Rendah** 5-20% \| **Kritikal** <5% \| **Tiada** 0%" in green-600 / orange-600 / red-600 / #991b1b / slate-500 (DV-M11-03). | 3.1.3 | 09.3 |
| FR-M11-29 | The guide SHALL end with the tip bar "`fa-lightbulb` **Tip:** Guna Filter untuk tapis negeri/tempoh/tahap. Export PDF/CSV untuk pembentangan.". | 3.1.4 | 09.1 |
| FR-M11-30 | S2 SHALL render the GET form to `/admin/monitoring` with `period`, `state`, `tahap` selects (options, labels and values of FN-3.2.1, current values selected), a hidden `_token` (dummy value from the mock session; SEC-M11-01), submit "`fa-filter` Tapis"; no `required`; selects ≥ 36px tall (DV-M11-17). Submitting navigates to `/admin/monitoring?period=…&state=…&tahap=…&_token=…` (M17 mount of the same component). | 3.2.1 | 10.1, 10.2, 10.4 |
| FR-M11-31 | The "PDF" and "CSV" links SHALL have `href` `/admin/monitoring/export/pdf?{q}` and `/admin/monitoring/export/csv?{q}`, where `{q}` = the current `period`, `state`, `tahap` query parameters that are set, in that order, without `_token` (e.g. `?state=Selangor&tahap=Kritikal`; `?` when none). The prototype routes (provisional, UNVERIFIED content, PROPOSED): csv → a download `monitoring-penglibatan.csv` with one line per student-table row (columns #, Sekolah, Kod, Negeri, Daftar, Aktif, %, Tahap) from #7; pdf → the browser print dialog of a print view of S2 for the same query. | 3.2.3 | 11.1, 11.2, 11.3 |
| FR-M11-32 | "`fa-times` Reset" → `/admin/monitoring` SHALL be rendered only when at least one of `period`, `state`, `tahap` is non-empty. | 3.2.2 | 10.1, 10.2 |
| FR-M11-33 | "`fa-sync-alt` Refresh" SHALL be a second submit button of the same form. | 3.2.4 | 10.3 |
| FR-M11-34 | Auto-refresh SHALL count down 300 s from "5:00" (display `m:ss`), decrement once per second while running, and reload the current route at 0; the toggle switches running/paused (`fa-pause` ↔ `fa-play`); resuming at ≤ 0 restarts at 300 (BR-M11-25). | 3.2.5 | 12.1, 12.2, 12.3 |
| FR-M11-35 | KPI row 1 SHALL show Jumlah Sekolah, Pelajar T4/T5, Pernah Aktif, % Penglibatan, Soalan Dijawab, Purata/Pelajar (labels, sub-lines, icons, gradients of FN-3.3.1) from #3 `kpi`, formatted per BR-M11-11. | 3.3.1 | 13.1, 13.2, 13.3, 13.4, 13.5, 13.6 |
| FR-M11-36 | KPI row 2 SHALL show Guru Berdaftar, Guru Pernah Login, % Penglibatan Guru. | 3.3.2 | 13.1, 13.2, 13.3, 13.4, 13.5, 13.6 |
| FR-M11-37 | The student table card SHALL show "Analisis Penglibatan Pelajar T4/T5", "Mengikut sekolah — disusun mengikut % penglibatan tertinggi" and "{rows} sekolah". | 3.4.1 | 14.1, 14.4 |
| FR-M11-38 | The student table SHALL list `studentRows` of #3 (BR-M11-08/12/13/34) with the columns, link target `/admin/monitoring/sekolah/{id}`, "{kod} · {negeri}" / "- · {negeri}", tahap colours and the three bar variants of FN-3.4.2; headers upper case by CSS; scrolls inside its card with the right fade below `lg`. | 3.4.2 | 14.1, 14.2, 14.5, 14.6, 14.7 |
| FR-M11-39 | The student table legend SHALL read "Legenda:" "Cemerlang (> 60%)", "Sederhana (20-60%)", "Rendah (5-20%)", "Kritikal (< 5%)", "Tiada Langsung (0%)". | 3.4.3 | 14.1 |
| FR-M11-40 | The teacher table card SHALL show "Analisis Penglibatan Guru", the same subtitle and "{rows} sekolah". | 3.5.1 | 14.3, 14.4 |
| FR-M11-41 | The teacher table SHALL list `teacherRows` (BR-M11-34 applies) (# · Sekolah · Daftar · Login · % · Tahap · Bar), same rules as FR-38, filtered by `state` only. | 3.5.2 | 14.3, 14.4, 14.6, 14.7 |
| FR-M11-42 | The teacher legend SHALL be the FR-39 legend plus "Tiada Guru (0 daftar)". | 3.5.3 | 14.3 |
| FR-M11-43 | The weekly table SHALL render `weekly` of #3: sticky Sekolah column (name truncated, `title` full name, code under it), one column per week "M{k}" with `title` "dd/mm - dd/mm", Trend and Best, cell classes, trend icons/titles and Best per BR-M11-15; rows ordered per BR-M11-15; scrolls inside its card. | 3.6.1 | 15.1, 15.2, 15.3, 15.4 |
| FR-M11-44 | Under the weekly table a footer SHALL list every week as "**M{k}**: dd/mm - dd/mm". | 3.6.2 | 15.1 |
| FR-M11-45 | "Sekolah Terbaik" SHALL list `signals.best` (BR-M11-16) as "`fa-star` {sekolah} — {p}% penglibatan ({aktif}/{daftar} pelajar aktif)". | 3.7.1 | 16.1, 16.4 |
| FR-M11-46 | "Perhatian Segera" SHALL list `signals.attention` with the three templates and the "(Nota: {n} guru telah login)" suffix of FN-3.7.2 (BR-M11-16). | 3.7.2 | 16.2, 16.4 |
| FR-M11-47 | "Cadangan Tindakan" SHALL list `signals.suggestions` with the three templates of FN-3.7.3 (BR-M11-16). | 3.7.3 | 16.3, 16.4 |
| FR-M11-48 | When the three lists are all empty, `#section-perhatian` SHALL be one card "Tiada pemerhatian yang perlu diberi perhatian buat masa ini.". | 3.7.4 | 16.5 |
| FR-M11-49 | #3 SHALL apply the filter scopes of BR-M11-14 (state everywhere; period on the student measures; tahap on the student table only). | 3.8.1 | 13.2, 13.3, 13.4, 13.6, 14.4, 15.4 |
| FR-M11-50 | Engagement counts SHALL follow the two declared definitions of BR-M11-09: S2 and S5 count students with ≥ 1 answer (flags included); S3 "Pernah Aktif", "● Aktif ({n})" and the tahap pill exclude "ditapis" accounts (as live; DV-M11-11 withdrawn). | 3.8.2 | 13.1, 13.4, 14.1, 18.1, 25.1 |
| FR-M11-51 | An empty filter result SHALL render "0 sekolah", the table headers with an empty body and no message, the weekly headers without rows and the FR-48 card (as live). | 3.8.3 | 13.5, 17.2 |
| FR-M11-52 | One component set (S2–S5) SHALL serve both prefixes with the same data; links inside it always target `/admin/…` (as live). | 3.8.4 | 17.1 |
| FR-M11-53 | S3 header card SHALL show name, "`fa-hashtag` {kod}" (or "-" when no code, INFERRED), "`fa-map-marker-alt` {negeri}", the subscription pill of BR-M11-33 ("`fa-circle` Active — sehingga {d MMM yyyy}", "Cancelled — sehingga …", "Expired — sehingga …" or "Tiada langganan"; English words and month, as live), and the tahap pill "{Tahap} — {p}%". | 4.1.1 | 18.1, 18.2, 18.5 |
| FR-M11-54 | S3 SHALL show the 5 cards Pelajar T4/T5, Pernah Aktif (BR-M11-09), Soalan Dijawab, Guru Berdaftar, Guru Pernah Login. | 4.1.2 | 18.1, 18.2 |
| FR-M11-55 | S3 student pills SHALL filter client-side per BR-M11-18 ("Semua ({n})", "● Aktif ({S3 engaged})", "Login sahaja", "Belum login"; active styles of FN-4.1.3; default Semua): active shows the students the label counts (≥ 1 answer, not "ditapis"; DV-M11-21), login = 0 answers with a login, never = no login (any status, as live). | 4.1.3 | 19.1, 19.3 |
| FR-M11-56 | The S3 search SHALL hide rows whose lower-cased name does not contain the lower-cased input, combined with the active pill; no empty message. | 4.1.4 | 19.4 |
| FR-M11-57 | The warning box SHALL render when the school has ≥ 1 flagged account, with n = flagged accounts and m = "ditapis" accounts, in the two-sentence form when m > 0 and the one-sentence form when m = 0 (BR-M11-17). | 4.1.5 | 19.1, 18.2, 18.4 |
| FR-M11-58 | The S3 student table SHALL render every T4/T5 student of the school with the columns, link rules (answered → S4 twin; not answered → `/admin/kirkpatrick/pelajar/{id}`, row `opacity-60`), e-mail line, flag badges with exact titles, Tingkatan "T{n}" (DV-M11-07), status pills (BR-M11-18), dates, order (Tingkatan ascending, name A→Z) of FN-4.1.6. | 4.1.6 | 19.1, 19.2 |
| FR-M11-59 | S3 SHALL render "Senarai Guru ({n})" with pills Semua / Pernah Login / Belum Login (client-side) and the teacher table of FN-4.1.7 (link → S5 twin, status, "Login Terakhir", "Daftar" dd/mm/yyyy), no message when a pill matches nothing. | 4.1.7 | 20.1, 20.2 |
| FR-M11-60 | A school without teachers SHALL show "Senarai Guru (0)" and "Tiada guru berdaftar untuk sekolah ini.". | 4.1.8 | 18.2 |
| FR-M11-61 | Row filtering and search SHALL use each row's data values (never names interpolated into script expressions), so every name, including those with an apostrophe, filters correctly (DV-M11-18; SEC-M11-05). | 4.1.9 | 19.5 |
| FR-M11-62 | S4 header SHALL show the tile, name, "{e-mail} · T{n}" and "Aktiviti Terakhir: dd/mm/yyyy HH:mm" (latest `answeredAt`). | 4.2.1 | 21.1, 21.4 |
| FR-M11-63 | S4 SHALL show the cards Soalan Dijawab, Betul, Salah, Ketepatan (BR-M11-22 value colour). | 4.2.2 | 21.1, 21.4 |
| FR-M11-64 | S4 tabs SHALL switch one client-side `tab` state (subject / topic / all / wrong / gaps; default subject) with the labels, icons and count chips of FN-4.2.3; exactly one panel is visible at a time (DV-M11-02). | 4.2.3 | 21.1 |
| FR-M11-65 | "Mengikut Subjek" SHALL list each answered subject (order: as #5 returns, answered count descending, INFERRED) with bar, "{p}%" (1 decimal), "{b}/{j}" and the BR-M11-22 bar colour. | 4.2.4 | 21.2 |
| FR-M11-66 | "Mengikut Tajuk" SHALL group topics by subject (label upper case by CSS) with "Bab {n}" (blank for "Umum"), topic name, "{p}%", "{b}/{j}" and the BR-M11-23 badge. | 4.2.5 | 21.3 |
| FR-M11-67 | "Senarai Soalan" SHALL render the heading with available/total (BR-M11-21), the table of FN-4.2.6 newest first, 20 rows initially and "Papar lagi 20 ({shown}/{total})" adding 20 until all are shown; a row click opens FR-71. | 4.2.6 | 22.1 |
| FR-M11-68 | "Jawapan Salah" SHALL render the heading "({n} jawapan, {m} soalan unik)" and one card per wrong answer, newest first, with the content of FN-4.2.7; all n cards (DV-M11-06). | 4.2.7 | 23.1, 23.2 |
| FR-M11-69 | "Gap Analysis" SHALL render, when its tab is active, the panel of FN-4.2.8 from `gaps` of #5, recomputed by BR-M11-19 (DV-M11-02, DV-M11-20), with the live empty copy "Semua topik yang dicuba mempunyai ketepatan melebihi 60%.". | 4.2.8 | 24.1, 24.2 |
| FR-M11-70 | "Pemerhatian" SHALL list the sentences of BR-M11-20 per subject, under the tab panels, on every tab. | 4.2.9 | 24.3 |
| FR-M11-71 | The question modal SHALL show the content of FN-4.2.10 for the clicked row, close with ✕ or a click outside, and replace its content on the next row click; "Pilihan jawapan telah dipadam dari sistem." when the question has no options. | 4.2.10 | 22.2, 22.3 |
| FR-M11-72 | S5 header SHALL show the tile, name, e-mail, "Login Terakhir: dd/mm/yyyy HH:mm" and "Pernah Login" (a teacher who never logged in: "Login Terakhir: -" and pill "Belum Login", INFERRED). | 4.3.1 | 25.1 |
| FR-M11-73 | S5 SHALL show the cards Pelajar T4/T5, Pelajar Aktif (answered, BR-M11-09), % Aktif, Perlu Perhatian (BR-M11-24). | 4.3.2 | 25.1 |
| FR-M11-74 | S5 "Prestasi Pelajar" SHALL list every T4/T5 student of the school (name A→Z) with Tingkatan "T{n}", Soalan, Ketepatan (BR-M11-22 colours; "-" slate-300 without answers), status pill; linked name only for students with answers; others `opacity-50`. | 4.3.3 | 25.2 |
| FR-M11-75 | S5 "Cadangan Tindakan" SHALL render the three boxes of FN-4.3.4 with the counts of BR-M11-24, each only when its count > 0 (INFERRED). | 4.3.4 | 25.3 |
| FR-M11-76 | S6 SHALL render the GET form to `/guru/analisis-item` with "Mata Pelajaran" `subject_id` ("Semua Subjek" + #9 subjects sorted by name A→Z) and "Kelas" `classroom_id` ("Semua Kelas" + #2 own classes), both preloaded and `onchange` submit. | 5.1.1 | 26.1, 26.2 |
| FR-M11-77 | S6 SHALL render "`fa-times` Reset" → `/guru/analisis-item` when `subject_id` or `classroom_id` is non-empty. | 5.1.2 | 26.2 |
| FR-M11-78 | S6 SHALL render the legend of FN-5.1.3 (dots emerald-500, amber-400, red-500; `fa-info-circle` note). | 5.1.3 | 26.1 |
| FR-M11-79 | S6 SHALL render the empty card "Tiada data analisis item untuk paparan ini." / "Pelajar perlu membuat latihan dahulu." when #8 returns no rows (always for a viewer without own classes; a `classroom_id` that is not an own class is ignored → empty, INFERRED). | 5.1.4 | 26.1, 26.2 |
| FR-M11-80 | With rows (provisional, PROPOSED layout): a table Soalan · Subjek · Percubaan · % Betul (legend dot colour, BR-M11-28) · Diskriminasi (2 decimals; "baik" > 0.3, "semak semula" < 0), questions ordered by % betul ascending (INFERRED); scrolls inside its card. | 5.1.5 | 26.3 |
| FR-M11-81 | `/guru/perbandingan-kelas` (any query) SHALL render the provisional page of URS FN-M11-6.1.1 (SHU shell, header "Perbandingan Kelas", `fa-balance-scale` empty card "Tiada data perbandingan kelas untuk paparan ini.") for admin and teacher; never the 500 page (DV-M11-13). | 6.1.1, 6.1.2 | 27.1 |
| FR-M11-82 | `/guru/laporan-mingguan-kelas`, `?week=…` and `/{id}` SHALL render the M01/M08 standalone 403 page for the admin (exact copy URS FN-M11-6.2.1). | 6.2.1 | 28.1 |
| FR-M11-83 | For a teacher the same routes SHALL render the provisional stand-in of URS FN-M11-6.2.2 (DV-M11-19; 403 not asserted). | 6.2.2 | 28.2 |
| FR-M11-84 | Every M11 screen SHALL meet NFR-RESP at 375 / 768 / 1280 with the per-screen behaviour of §10: no page-level horizontal scroll; wide tables scroll inside their cards (NFR-RESP-05 b, no new sticky column; the weekly school column is sticky as live). | 2.4.3 | 29.1, 29.2, 29.3 |
| FR-M11-85 | Every count and list on S1–S6 SHALL be computed per request from the owners' datasets through the M05 v1.8 named queries and the M11-local queries of §6.5.1 (M02 users/schools D11 with the v1.8 monitoring allocation, M05 answer-log/session dataset, M01 `lastLoginAt`, M04 questions, M10 enrolment, DATA-M11-01 flags) after the fixture-school exclusion of BR-M11-34; no stored totals (D11/D12). | 3.8.1, 3.8.2 | 13.1, 14.1, 14.7, 17.1 |
| FR-M11-86 | S3 cards and teacher logins SHALL be the school's own observed S3 values where they differ from the S2 aggregates (8765, 8087, 8106, 8078, 8102; BR-M11-32); S2 keeps its own values. | 3.8.5 | 18.3 |
| FR-M11-87 | S4 for a student with 0 answers (e.g. 8080 students 4664 and 4644, M02 v1.12) SHALL render the page with the values of URS FN-M11-4.2.11 (header with "Aktiviti Terakhir: -", cards 0 · 0 · 0 · "0%", zero chips, empty panels with their headings, no "Papar lagi", Gap empty state, Pemerhatian card without sentences); never 404 for a T4/T5 student of the dataset (PROPOSED). | 4.2.11 | 21.5 |

### 3.1 Traceability (US → FR → E2E)

| US | FR | E2E |
|---|---|---|
| US-M11-01 | 01–04 | 01, 49 |
| US-M11-02 | 05 | 02 |
| US-M11-03 | 06–09 | 03, 04, 05, 06 |
| US-M11-04 | 10, 11 | 07, 08 |
| US-M11-05 | 12–16 | 09, 10 |
| US-M11-06 | 17–21 | 11, 12 |
| US-M11-07 | 22 | 13, 14 |
| US-M11-08 | 23–25 | 15, 16 |
| US-M11-09 | 26–29 | 17 |
| US-M11-10 | 30, 32, 33, 49 | 18, 22, 23, 51 |
| US-M11-11 | 31 | 19, 20, 51 |
| US-M11-12 | 34 | 21 |
| US-M11-13 | 35, 36, 50, 85 | 22, 23, 51 |
| US-M11-14 | 37–42 | 24, 25, 53, 54 |
| US-M11-15 | 43, 44 | 26, 27 |
| US-M11-16 | 45–48 | 28, 29 |
| US-M11-17 | 51, 52 | 23, 30 |
| US-M11-18 (S2↔S3) | 86 | 52 |
| US-M11-18 | 53, 54, 57, 60 | 31, 52 |
| US-M11-19 | 55–58, 61 | 32, 33 |
| US-M11-20 | 59, 60 | 34, 50 |
| US-M11-21 | 62–66, 87 | 35, 36, 55 |
| US-M11-22 | 67, 71 | 37, 38 |
| US-M11-23 | 68 | 39 |
| US-M11-24 | 69, 70 | 40, 41 |
| US-M11-25 | 72–75 | 42 |
| US-M11-26 | 76–80 | 43, 44 |
| US-M11-27 | 81 | 45 |
| US-M11-28 | 82, 83 | 46, 47 |
| US-M11-29 | 25, 84 | 48 |

---

## 4. Business rules

| ID | Rule | Source |
|---|---|---|
| BR-M11-01 | **S1 population (DV-M11-01).** The distinct students with an active M10 enrolment in the viewer's own classes (`Classroom.teacherId = viewer`), or in the selected class when `classroom_id` is one of them; a `classroom_id` that is not an own class is ignored (INFERRED). A viewer without classes (the admin) has an empty population. `n` = population size. | DV-M11-01 / INFERRED |
| BR-M11-02 | **Pernah Login** = population students with M01 `User.lastLoginAt` ≠ null (M01 field, XL2-07; §6.5.1); % = round(login ÷ n × 100) as an integer ("0%" when n = 0). | OBSERVED (54% = 1708/3152) / INFERRED |
| BR-M11-03 | **Pernah Buat Latihan** = population students with ≥ 1 completed M05 PracticeSession (any mode, any date; M05 Q-SESS-USER, §6.5.1); % as BR-02. | INFERRED |
| BR-M11-04 | **Activities** = completed M05 PracticeSessions of population students with `completedAt` from 00:00 of (today − (range − 1)) to now, plus M05 structured attempts ("Struktur", by M05 DATA-M05-06 `submittedAt`) and the M16 v1.3 counters `battles.countFor(userIds, {from, to})` → count ("Battle": finished and forfeited battles, both sides) and `gameResults.countFor(userIds, {from, to})` → count ("Permainan"). Counted with M05 Q-SESS-USER over the population and the M11-local Q-M11-STRUCT (§6.5.1). Mode → type: `random`, `chapter`, `revision`, `past_year`, `mission`, `remedial`, `question_set`, `pksk` → "Kuiz" (the M10 modes per M05 v1.8, `pksk` per M05 v1.12 BR-35; M05 recommendation adopted, INFERRED); `latih_tubi` → "Latih Tubi"; `ramalan` → "Tracking A". "Jumlah" = sum. Trend: count per day by `completedAt` (Asia/Kuala_Lumpur). | INFERRED |
| BR-M11-05 | **Skor Purata** = Σ `correctCount` ÷ Σ `questionCount` × 100 over the scored activities in the range (Kuiz, Latih Tubi, Tracking A; Battle = Σ `correct` ÷ Σ `answered` of M16 `battles.countFor`; Struktur scoring UNVERIFIED → "-%"), rounded to an integer; per type the same over that type; "-%" when there is none. | INFERRED |
| BR-M11-06 | **Range** ∈ {7, 30, 90}; missing or other → 30. | OBSERVED |
| BR-M11-07 | **S1 lists:** "Belum Pernah Buat Latihan" = population students without practice (BR-03), name A→Z, first 10; "Paling Aktif" = population students with ≥ 1 activity in the range, count descending then name A→Z, first 10 (PROPOSED). | INFERRED / PROPOSED |
| BR-M11-08 | **Monitoring population.** T4/T5 students = users with role `student`, `grade` 10 or 11 and a `schoolId`; teachers = users with role `teacher` and a `schoolId`. Student table = schools with ≥ 1 such student; teacher table = schools with ≥ 1 such teacher; "Jumlah Sekolah" = schools with ≥ 1 registered user of any role (INFERRED). All within the `state` filter and after BR-M11-34 (57 = M02's 60 schools with users − the 3 fixture schools). | INFERRED / Delivery Lead (BR-34) |
| BR-M11-09 | **Engagement — two declared definitions (as live; DV-M11-11 withdrawn).** *S2/S5:* a student is active with ≥ 1 QuizAnswer (in the period on S2 when set), flagged accounts included — Pernah Aktif, % Penglibatan = active ÷ Pelajar T4/T5 × 100, table Aktif/%/tahap, the lists, S5 "Pelajar Aktif" and "% Aktif". *S3:* "Pernah Aktif", "● Aktif ({n})" and the tahap pill exclude accounts flagged `excluded` ("nilai tulen selepas tapis"). Soalan Dijawab counts every answer. All counts are the queries of §6.5.1: M05 Q-ANS-SEG (the monitoring segment: 472,371 at the snapshot), the M11-local Q-M11-ACTIVE / Q-M11-T45 / Q-M11-TEACHERS on it and on the M02 users dataset, and M01 `lastLoginAt`. Purata/Pelajar = Soalan Dijawab ÷ S2 Pernah Aktif (0 when 0). % Penglibatan Guru = teachers with `lastLoginAt` ÷ teachers. | OBSERVED |
| BR-M11-10 | **Period windows:** '' = all time; `7d` = `answeredAt` ≥ now − 7 days; `30d` = ≥ now − 30 days; `3m` = ≥ now − 3 calendar months. Unknown value → all time (INFERRED). | INFERRED |
| BR-M11-11 | **Formats:** counts with thousands separators ("4,158"); monitoring percentages and averages with 1 decimal and ".0" dropped ("35.2%", "100%", "323", "172.4"); S1 percentages integers; S4/S5 accuracy with 1 decimal kept on S4 cards and subject/topic rows ("100.0%"), ".0" dropped on S5 ("100%", "55%"); dates `dd/mm/yyyy HH:mm` (Asia/Kuala_Lumpur); modal time raw `yyyy-mm-dd HH:mm:ss`; subscription date `d MMM yyyy` with English month ("12 May 2027"). | OBSERVED |
| BR-M11-12 | **Tahap** from p (%): Cemerlang p > 60; Sederhana 20 ≤ p ≤ 60; Rendah 5 ≤ p < 20; Kritikal 0 < p < 5; Tiada Langsung p = 0. Colours #15803d, #ea580c, #dc2626, #991b1b, #6b7280. Bars: Cemerlang/Sederhana label inside; Rendah/Kritikal label outside, width max(p, 3)%; 0 → empty track, "0%". | OBSERVED |
| BR-M11-13 | **Table order:** p descending, ties by school id ascending. | OBSERVED (reproduces the default, 7d, 30d and 3m orders with the live ids; audit claim 17 and `verify-rules.js`) |
| BR-M11-14 | **Filter scopes:** `state` → every section and KPI; `period` → Pernah Aktif, % Penglibatan, Soalan Dijawab, Purata, student table (Aktif/%/tahap) and the lists; `tahap` → student table rows only (lists, KPIs, teacher table and weekly table ignore it). | OBSERVED |
| BR-M11-15 | **Weekly tracking.** Weeks Monday–Sunday from `monitoringStartDate` 2026-02-16 (DATA-M11-02) up to the week containing today, the last one ending today; label "M{k}", `title` "dd/mm - dd/mm". Rows = student-table schools (state filter only), ordered by total answers descending, ties and zero rows by school id ascending (OBSERVED, §6.7). Cell = answers by the school's T4/T5 students in the week (all answers, flags included). Class (page script, OBSERVED): 0 → "-" slate; k = 1 and > 0 → blue; > previous week → green; < previous and > 0 → red; = previous and > 0 → blue; best week (maximum; ties → earliest, INFERRED) → amber ring. Trend: last week vs the week before → Meningkat / Menurun / Sama (equal, incl. both 0; INFERRED). Best: "M{k}" + count, "-" when the row has no answers. | OBSERVED / INFERRED (ties, trend) |
| BR-M11-16 | **Signals** (after filters, from the student table ignoring `tahap`): best = Cemerlang schools in table order, first 3; attention = Rendah, Kritikal and Tiada Langsung schools in table order; "(Nota: {n} guru telah login)" when a Tiada Langsung school has n > 0 logged-in teachers (the S2 teacher-table count, e.g. 8277 → 16 while its S3 card shows 17); suggestions in attention order: Kritikal → "Penglibatan sangat rendah…"; Tiada Langsung with n > 0 → "Guru telah login tetapi murid belum aktif…"; Tiada Langsung with n = 0 → "Hubungi pihak sekolah…"; Rendah → none. | OBSERVED (outputs of 4 states) / INFERRED (rule) |
| BR-M11-17 | **Anomaly flags** are stored per student (DATA-M11-01; the live detection rule is unobservable, Q-M11-4): `review` → badge "⚠ Perlu Semak"; `excluded` → "⚠ Perlu Semak · ditapis" and excluded from the S3 engagement figures. S3 box: n = review + excluded; when m = excluded > 0 the box has both sentences ("… **{m}** daripadanya dikecualikan dari peratus penglibatan kerana corak seperti automasi. Angka penglibatan …"), when m = 0 only "⚠ **{n} akaun** menunjukkan aktiviti luar biasa (kelajuan menjawab tidak munasabah — perlu semak). Angka penglibatan di atas ialah nilai tulen selepas tapis."; no box when n = 0. | OBSERVED |
| BR-M11-18 | **Student status** (all time): "Aktif" = ≥ 1 answer (flags ignored); "Login sahaja" = 0 answers and `lastLoginAt` set; "Belum login" = 0 answers and never logged in. **S3 pills:** all; active = ≥ 1 answer and not `excluded` (DV-M11-21; live row expression also includes `excluded` rows — D-M11-19); login = 0 answers and logged in; never = `lastLoginAt` null (any status, OBSERVED). Teacher status: "Pernah login" / "Belum login" (OBSERVED, e.g. 8082 17 "Belum login"). | OBSERVED (row expressions) + DV-M11-21 |
| BR-M11-19 | **Gap analysis (INFERRED; DV-M11-02/20).** Group = the question's chapter label — the M04 question field `chapterLabel` (M04 v1.9 DATA-M04-01, FR-M04-126 via `questions.get`; set on the M11 anchors 700401–700931, null on generated rows, so the M03 chapter count stays 1,251), shown after "·" in the wrong-answer cards (e.g. "Sejarah Tingkatan 5 KSSM"); answers without a chapter ("Umum") are ignored. Gap = group accuracy **< 60%** (fits every observed point and the live copy "melebihi 60%"): "Kritikal" p < 30 (#991b1b), "Lemah" 30 ≤ p < 50 (#dc2626), "Perlu Perhatian" 50 ≤ p < 60 (#ea580c); ordered by p ascending. "{n} soalan tersedia untuk latihan" = approved, active questions in `questions.*` with that `chapterLabel` (M04 definition). The Tajuk topic = `curriculumTopicId` → M03 topic. "Topik Kuat" = groups with p ≥ 80, first 3 by p ascending. "Subjek Belum Dicuba" = the M03 subjects offered at the student's level without any answer (live lists answered subjects too; DV-M11-20). Tab chip = number of gaps. | SOURCE-DERIVED (layout) / INFERRED (rule) |
| BR-M11-20 | **Pemerhatian** per answered subject: p ≥ 80 → "Kekuatan dalam {Subjek} ({p}% ketepatan). Boleh jadikan motivasi."; p < 50 → "Kerap salah dalam {Subjek} ({salah}/{jumlah} salah = {p}% ketepatan). Cadangan: Fokus latihan tambahan." (p 1 decimal); otherwise none; order as the subject list. | OBSERVED (outputs) / INFERRED (thresholds) |
| BR-M11-21 | **Senarai Soalan:** total = the student's answers; available = answers whose question still exists in `questions.*` (M04); rows = available answers, newest `answeredAt` first; "#" = position. Modal options come from `questions.get` (M04; none → deleted message); the chapter label shown = `chapterLabel`; the Tajuk topic of an answer = its question's M04 `curriculumTopicId` → M03 topic ("Bab n" + name; none → "Umum"). | OBSERVED / INFERRED |
| BR-M11-22 | **Accuracy colours:** ≥ 70 green; 50–69.9 amber; < 50 red (S4 cards 700 shades, S4 bars 500, S5 text 600). | OBSERVED (red on cards INFERRED) |
| BR-M11-23 | **Topic badge:** "Kuat" ≥ 80; "Sederhana" 50–79.9; "Lemah" < 50. | OBSERVED |
| BR-M11-24 | **S5:** Pelajar T4/T5 = the school's T4/T5 students; Pelajar Aktif = students with ≥ 1 answer (flags included); % Aktif = Pelajar Aktif ÷ students; Perlu Perhatian = students with 0 answers; red box 1 n = students with `lastLoginAt` null (any status; 8080 → 8); red box 2 n = answered students with accuracy < 50; green box n = answered students. The list is the whole school (not the teacher's classes) — as live. | OBSERVED |
| BR-M11-25 | **Auto-refresh:** 300 s countdown, 1 s tick, reload at 0; pause/resume; resume at ≤ 0 restarts at 300. | OBSERVED (script) |
| BR-M11-26 | **Guide storage key** `hideMonitoringGuide` (`'true'` = hidden); per browser. | OBSERVED |
| BR-M11-27 | **Link targets** inside the monitoring component are always `/admin/monitoring…` (filter action, Reset, exports, school/student/teacher links, breadcrumbs), whatever the mount prefix. | OBSERVED |
| BR-M11-28 | **S6 item analysis (teacher; provisional).** Scope = answers by BR-01 students to questions of the selected subject (all when "Semua Subjek"), with the answer-set, attempt and discrimination rules of M08's item analysis (M08 SRS BR on `/analisa-item/kelas/{id}`: p = correct ÷ attempts per question; D = upper-group p − lower-group p with the M08 group size); bands: p > 70 Mudah (emerald-500), 40 ≤ p ≤ 70 Sederhana (amber-400), p < 40 Sukar (red-500). | INFERRED |
| BR-M11-29 | **S4/S5 school segment** is not validated (SEC-M11-02); unknown ids → 404. | OBSERVED |
| BR-M11-30 | **Activity rows** in S1 and figures in S2–S5 never include users outside the dataset scope (deleted users/questions are skipped). | INFERRED |
| BR-M11-31 | **Name ordering** uses Malay collation of the full name, case-insensitive (INFERRED). | INFERRED |
| BR-M11-32 | **S2 vs S3 figures.** Where S2 and S3 differ for the same school beyond BR-09 (FN-3.8.5), each screen shows its own observed value: the school record carries `s3Snapshot` {engaged, teachersLoggedIn} for the anchor schools (§6.7); other schools compute S3 = S2 minus excluded accounts. | OBSERVED |
| BR-M11-33 | **Subscription pill (S3)** from the M02 subscription of the school with the latest `endsAt`: `active` → pill "Active — sehingga {d MMM yyyy}" (`bg-green-100 text-green-700`); `cancelled` → "Cancelled — sehingga {d MMM yyyy}"; `expired` → "Expired — sehingga {d MMM yyyy}" (both `bg-slate-100 text-slate-500`); no subscription → plain text "Tiada langganan" (`text-xs text-slate-400`, no pill). `grace` → UNVERIFIED (not observed). | OBSERVED / INFERRED (selection) |
| BR-M11-34 | **Fixture schools excluded from platform monitoring rollups (Delivery Lead, OQ-M11-09 option a).** Schools with ids **900001–900099** — the reserved fictitious range of M02 SRS §6.15 (900001 SMK DEMO, 900002 SK Demo, 900003 SMK Demo Seri Putra) — and their users are excluded from the S2 student and teacher tables, the KPI cards, Sekolah Terbaik / Perhatian Segera / Cadangan Tindakan and the weekly rows. **Every other school is counted**: the live-range register ids and the schools created at runtime (ids ≥ 10,301, M02 §6.15) appear whenever they have users (E2E-54). No S2 link targets a fixture school; a direct URL `/…/monitoring/sekolah/{fixture id}` (and its `/pelajar/{id}` and `/guru/{id}` pages) renders the detail page as for any school, because the drill-down is not scoped on live (BR-29) — INFERRED (no such school exists on live). The fixture accounts (e.g. pelajar 2, guru 5, M08 students 3001–3008) still appear in their own views (M08, M10, M13, S1/S6 of this module). M17 applies the same rule when it mounts the component (XR-M11-08). | Delivery Lead decision / INFERRED (direct URL) |

---

## 5. Validation rules

No M11 form has `required`, custom validation, alert or confirm (discovery §8.3). All filters are GET forms that submit on change or on "Tapis"/"Refresh". Invalid query values are tolerated: `range` → 30 (BR-06); unknown `period` → all time, unknown `state`/`tahap` → no match → empty result (FR-51, INFERRED); `classroom_id` or `subject_id` not in the viewer's options → ignored / empty result (FR-79). Non-numeric path ids → 404.

---

## 6. Data entities & fields

*(solution-architect)* JSON fields are camelCase. **All ids are integers** (users, schools, classes, subjects, levels, questions — live exposes them in URLs; master SRS §7.4). Seeded sessions keep the shared M05/M06 string ids. "Now" comes from the M05 mock clock (default `2026-09-25T15:40:00+08:00`). Everything lives in the in-memory store seeded from fixtures and reset per E2E test (`mock.reset()`).

### 6.1 Referenced entities (owners; not redefined — D12)

| Entity | Owner | Fields M11 reads |
|---|---|---|
| User | M01 DATA-M01-01 / M02 DATA-M02-01 (users dataset, ids 1–6,000, runtime ≥ 9,000,001) | `id`, `name`, `email`, `role`, `grade`, `schoolId`, `isActive`, `createdAt` ("Daftar"), **`lastLoginAt`** (M01 v1.9 DATA-M01-01; M02 v1.11 seeds) |
| School, SchoolSubscription | M02 DATA-M02-03 / 07 (D11 register, 10,220 schools; 14 live subscription rows) | `id`, `name`, `code`, `state`; subscription `status` (`active`, `cancelled`, `expired`, …), `endsAt` |
| Subject, EducationLevel, Chapter | M03 | subject `id`, `name`, level offer; chapter number/title |
| Question | M04 DATA-M04-01, repository `questions.*` (D11 dataset; M04 v1.9) | `id`, text (HTML), options, `correctAnswer`, explanation, `source` label, `difficultyLevel`, `subjectId`, `chapterLabel` and `curriculumTopicId` (M04 v1.9 FR-M04-126), `status`, `isActive` |
| PracticeSession, QuizAnswer | M05 DATA-M05-01 / 02 (single session and answer schema) | session `userId`, `mode`, `questionCount`, `correctCount`, `completedAt`, `status`; answer `userId`, `questionId`, `subjectId`, `chapterId`, `selectedOptionId`, `isCorrect`, `answeredAt` |
| Structured attempt | M05 DATA-M05-06 (structured practice) | `userId`, `submittedAt` ("Struktur") |
| Classroom, Enrolment | M10 (M02 DATA-M02-10 ClassroomRef) | `id`, `name`, `teacherId`, enrolment `studentId`, `status` |
| Battle/game records | M16 v1.3 (§7.2, XR-M16-05) | `battles.countFor(userIds, {from, to})` → `{count, correct, answered}`; `gameResults.countFor(userIds, {from, to})` → `{count}` ("Battle", "Permainan", Battle score bar). The seed battles' players are in no M10 class, so the observed and designed M11 figures stay 0 |

### 6.2 DATA-M11-01 — MonitoringFlag (owned by M11)

| Field | Type | Req | Notes |
|---|---|---|---|
| userId | int → User | yes | a T4/T5 student |
| level | `review` \| `excluded` | yes | "Perlu Semak" / "Perlu Semak · ditapis" |
| flaggedAt | datetime | yes | |

Server-computed on live from answer speed (rule unobservable, Q-M11-4); stored in the prototype. One row per flagged student. Seed: 7 schools as observed (§6.7) — 52 `review` + 35 `excluded` rows on the students of 8080, 8078, 8082, 8106, 8090, 8087 and 10220.

### 6.3 DATA-M11-02 — MonitoringSettings (constants, owned by M11)

`{ monitoringStartDate: '2026-02-16', refreshSeconds: 300, guideStorageKey: 'hideMonitoringGuide', tahapBands: [{key:'Cemerlang', min>60, colour:'#15803d'}, {key:'Sederhana', 20–60, '#ea580c'}, {key:'Rendah', 5–<20, '#dc2626'}, {key:'Kritikal', >0–<5, '#991b1b'}, {key:'Tiada Langsung', 0, '#6b7280'}], ranges: [7, 30, 90], periods: {'':'Semua Masa', '7d':'7 Hari', '30d':'30 Hari', '3m':'3 Bulan'}, states: [the 10 of FN-3.2.1] }`. The state list is the live option list (states that have schools with users, INFERRED; derived at runtime from the dataset gives the same 10).

### 6.4 Read models (response shapes; computed, not stored)

- `TeacherReport` (#1): `{range, classroomId|null, options:{classes:[{id,name}]}, population:{total, loggedIn, practised}, activity:{total, byType:{kuiz, struktur, latihTubi, trackingA, battle, permainan}}, score:{overall:int|null, byType:{kuiz, struktur, latihTubi, trackingA, battle: int|null}}, trend:[{date:'dd/mm', count}], notLoggedIn:[StudentLite], notPractised:[StudentLite] (≤10), mostActive:[StudentLite & {activities}] (≤10)}`; `StudentLite = {id, name, email, avatarUrl|null, neverLoggedIn:boolean}`.
- `MonitoringOverview` (#3): `{filters:{period, state, tahap}, kpi:{schools, students, engaged, engagementPct, answers, avgPerStudent, teachers, teachersLoggedIn, teacherPct}, studentRows:[SchoolEngagementRow], teacherRows:[TeacherEngagementRow], weeks:[{k, from:'dd/mm', to:'dd/mm'}], weekly:[WeeklyRow], signals:{best:[Signal], attention:[Signal], suggestions:[Signal]}}`.
- `SchoolEngagementRow = {schoolId, name, code|null, state, registered, engaged, pct, tahap}`; `TeacherEngagementRow = {schoolId, name, code|null, state, registered, loggedIn, pct, tahap}`.
- `WeeklyRow = {schoolId, name, code|null, cells:[{k, count, cls:'zero'|'first'|'up'|'down', best:boolean}], trend:'up'|'down'|'same', best:{k, count}|null}`.
- `Signal = {schoolId, name, kind:'best'|'rendah'|'kritikal'|'tiada'|'motivasi'|'hubungi'|'handsOn', registered, engaged, pct, teachersLoggedIn}` (the client renders the exact templates).
- `SchoolDetail` (#4): `{school:{id,name,code,state}, subscription:{status:'active'|'cancelled'|'expired', endsAt}|null, warning:{review, excluded}|null, tahap, pct, cards:{students, engaged, answers, teachers, teachersLoggedIn}, flags:{review, excluded}, students:[{id, name, email, level:'T4'|'T5', answers, status:'aktif'|'login'|'never', engaged:boolean, flag:null|'review'|'excluded', lastLoginAt|null, lastActivityAt|null}], teachers:[{id, name, email, loggedIn:boolean, lastLoginAt|null, createdAt}]}`.
- `StudentDetail` (#5): `{school:{id,name}, student:{id, name, email, level, lastActivityAt}, cards:{answered, correct, wrong, accuracy}, subjects:[{subjectId, name, correct, total, pct}], topics:[{subjectId, subjectName, rows:[{bab:int|null, name, correct, total, pct, badge}]}], answers:{available, total, rows:[AnswerRow]}, wrong:{count, unique, rows:[AnswerRow]}, gaps:{count, items:[{group, subjectName, pct, correct, total, severity, availableQuestions}], strong:[{group, subjectName, pct, answered}], untried:[subjectName]}, observations:[{kind:'strong'|'weak', subjectName, pct, wrong, total}]}`; `AnswerRow = {questionId, html, textPlain, subjectName, chapterLabel|null, source|null, difficulty, answeredAt, selectedLabel, correctLabel, isCorrect, options:[{label, text}], explanation|null}`.
- `TeacherDetail` (#6): `{school:{id,name}, teacher:{id, name, email, lastLoginAt|null}, cards:{students, engaged, pct, needAttention}, students:[{id, name, level, answers, accuracy|null, status}], suggestions:{neverLoggedIn, lowAccuracy, answered}}`.
- `ItemAnalysis` (#8): `{options:{subjects, classes}, rows:[{questionId, textPlain, subjectName, attempts, pct, band:'mudah'|'sederhana'|'sukar', discrimination|null}]}`.

### 6.5 D11 datasets used (all owned elsewhere; M11 reads through the owners' contracts)

| Dataset | Owner | Live totals that M11 figures must reproduce (computed, never stored) |
|---|---|---|
| Users (virtual) | M02 | 5,159 users (M02 §6.15); **monitoring rows**: 4,158 T4/T5 students with a school in the 33 observed schools and 522 teachers with a school in the 13 observed schools (§6.7), ids inside 1–6,000 (Student A = 2008); "Jumlah Sekolah" 57 (BR-M11-34: fixture schools 900001–900099 excluded); S1 admin population 0 |
| Schools (virtual) | M02 | 10,220; the monitoring schools of §6.9 carry their observed state and code presence |
| Answers (virtual segment of the answer log) | M05 | 472,371 answers by T4/T5 students with a school (all time; snapshot), 7,651 (7 days), 22,207 (30 days), 86,697 (3 months); per school and per week exactly as §6.7; anchors of Student A and the other 8080 anchors |
| Questions | M04 (`questions.*`) | the 531 M11 anchors 700401–700931 of Students A, B and C (§6.7); `availableQuestions` of gap groups computed over `chapterLabel` |

Generated rows are deterministic (stable hash of the id), use fictitious names ("Pelajar Demo 000123", `pelajar000123@demo.test`, "Guru Demo 0456"), carry `observed:false`, and never feed an asserted figure except through the observed totals they are built to. Anchors (observed records) override generated rows at their ids. School records carry `s3Snapshot` {engaged, answers, teachersLoggedIn} only where the observed S3 value differs from the value computed by BR-M11-09 (8090 answers 119,806, 8106 answers 59,201 and logins 16, 8765 engaged 1 and answers 209, 8078 logins 52, 8087 logins 13, 8102 logins 43, 8277 logins 17; BR-M11-32).

### 6.5.1 Named queries (owner definitions; XL2-01, XL2-03, XL2-07)

M11 stores no counts. Every figure is an **M05 v1.8 §6.14.2 named query** (the answer-log and session datasets), the M01 field `User.lastLoginAt`, or one of four **M11-local queries** defined only on top of the owners' datasets where no owner query matches (named below, with their base). §6.7 is the target these must reproduce.

| Query | Owner / base | Definition | M11 use |
|---|---|---|---|
| **Q-ANS-SEG(period[, schoolId][, week])** | M05 §6.14.2 | answers of the monitoring segment (T4/T5 students of non-fixture schools, BR-M11-34); `period` per BR-M11-10; `week` = Mk of BR-M11-15; flagged accounts included — 472,371 · 7,651 · 22,207 · 86,697 at the clock | S2 "Soalan Dijawab", Purata numerator, weekly cells; S3 "Soalan Dijawab" (with `s3Snapshot`, BR-32) |
| **Q-ANS-USER(userId[, subjectId][, period])** | M05 §6.14.2 | a user's answers (count, correct) | S4 cards and subject rows; S5 Soalan / Ketepatan per student; S3 "Soalan" column |
| **Q-SESS-USER(userId[, modes][, period])** | M05 §6.14.2 | a user's completed sessions (count, answers, correct, seconds) | S1 activity counts, types, score, trend and lists (BR-M11-03/04/05/07), summed over the BR-M11-01 population |
| **Q-ANS-CLASS(classroomId[, subjectId])** · **Q-SESS-CLASS** | M05 §6.14.2 | answers / sessions of the class's active members in the class subject | S6 item analysis (BR-M11-28); S1 is **not** class-subject scoped (it sums Q-SESS-USER over the members, so class 2001 and 2002 give the same 14 activities, §6.8) |
| **M01 `User.lastLoginAt`** | M01 DATA-M01-01 (XL2-07; M02 generated values) | logged in = not null | S1 "Pernah Login", S3/S5 statuses, S5 red box 1, teacher logins, "Login sahaja" / "Belum login" |
| Q-M11-T45(state?[, schoolId]) — **M11-local** | on the M02 users dataset (v1.8 allocation) | students (grade 10/11) with a `schoolId` outside 900001–900099, per school | "Pelajar T4/T5", table "Daftar", S3/S5 lists (no M05 query: user counts are not answers) |
| Q-M11-TEACHERS(state?[, schoolId]) — **M11-local** | on the M02 users dataset + M01 `lastLoginAt` | teachers with a non-fixture `schoolId`; logged in = `lastLoginAt` ≠ null | teacher table, KPI row 2, S3 teacher list |
| Q-M11-ACTIVE(period[, schoolId]) — **M11-local** | on M05 Q-ANS-SEG rows | distinct students with ≥ 1 row of Q-ANS-SEG(period, schoolId); S3 variant minus DATA-M11-01 `excluded` (M05 has no distinct-user count of the segment) | "Pernah Aktif", table "Aktif", tahap, lists, S3 "Aktif (n)" |
| Q-M11-STRUCT(userIds, range) — **M11-local** | on M05 DATA-M05-06 StructuredAttempt, `submittedAt` (XL2-22) | the population's structured attempts submitted in the range (Q-SESS-USER covers PracticeSessions only) | S1 "Struktur" tile and trend |

**Timestamps (XL2-22 confirmed):** structured attempts are read by `submittedAt` (M05 DATA-M05-06); practice sessions by `completedAt` (DATA-M05-01); answers by `answeredAt` (DATA-M05-02; the answer log has no `submittedAt`). S4 rows (question text, options, key, explanation, source, difficulty, `chapterLabel`, `curriculumTopicId`) are the rows behind Q-ANS-USER(userId) joined with `questions.get` (M04).

### 6.6 Activity-type map (BR-M11-04)

| M05 `mode` / record | S1 type |
|---|---|
| `random`, `chapter`, `revision`, `past_year` | Kuiz |
| `pksk` (M05 v1.12 BR-35) | Kuiz |
| `mission`, `remedial`, `question_set` (M05 v1.8 modes of M10 missions, remedial tests and question sets) | Kuiz (M05 SQ-10 recommendation, adopted; INFERRED — live types of these sessions unobserved) |
| structured attempt (`submittedAt`) | Struktur |
| `latih_tubi` | Latih Tubi |
| `ramalan` | Tracking A |
| M16 battle (`battles.countFor`) | Battle |
| M16 game (`gameResults.countFor`) | Permainan |

### 6.7 Seed — admin mirror (every value observed; pinned snapshot)

**Source and pin.** `docs/discovery/inventory/M11/_snapshot-2026-09-25.json` (captured 2026-09-25 19:24 +08:00, lane 2, read-only). Live figures drift during the day: the snapshot shows 472,371 answers (discovery at 18:04: 472,261), 7d 7,651 (7,586), 3m 86,697 (86,587). **The seed and every E2E value use the snapshot.** Mock clock 2026-09-25T15:40:00+08:00 (unchanged; the window boundaries of the snapshot's periods are reproduced by the answer timestamps).

**S1, S6 (admin):** no own class → empty population (DV-M11-01) and empty item analysis.

**Monitoring schools (S2 student table, default order = BR-M11-13 with the live ids; every value observed).** These rows are the **target of the M02 v1.11 monitoring allocation** (users, grades, schools, logins — XL2-03) and of the M02 subscription rows (XL2-04); M11 does not seed users or subscriptions itself. "S2 answers" = Σ of the school's weekly cells (+ answers before M1); the 12 answers before M1 (S2 KPI 472,371 − Σ weekly 472,359) are in **Johor** (state-filter evidence: Johor KPI 10,418 vs Σ weekly 10,406; Selangor 460,858 = Σ weekly) — the exact Johor school is not observable; they are placed on **8765** (M05 v1.10 §6.14.1, M18 XR-M18-04; XL3-13 — `observed:false`, the only generated value in this table): rows 8880 = 10,196 and 8765 = 222. S3 columns are the school's own S3 page; where they differ from S2 (FN-M11-3.8.5, BR-M11-32) the school record carries the S3 values as `s3Snapshot`.

| # | School id | State | T4/T5 (Tingkatan strings) | S2 Aktif all · 7d · 30d · 3m | S2 answers (Σ weekly + before M1) | Teachers S2 reg./login | S3 cards (students · Pernah Aktif · Soalan · guru · login) | S3 pills | Status Aktif · Login sahaja · Belum login (+ answered without login) | Flags review · ditapis | Subscription pill |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 940 | Selangor | 1 (T5 1) | 1 · 0 · 0 · 0 | 10 | — | 1 · 1 · 10 · 0 · 0 | "Semua (1)", "Aktif (1)" · "Cemerlang — 100%" | 1 · 0 · 0 (+1) | 0 · 0 | Tiada langganan |
| 2 | 987 | Selangor | 1 (Tingkatan 5 1) | 1 · 0 · 0 · 0 | 51 | — | 1 · 1 · 51 · 0 · 0 | "Semua (1)", "Aktif (1)" · "Cemerlang — 100%" | 1 · 0 · 0 (+0) | 0 · 0 | Tiada langganan |
| 3 | 995 | Selangor | 1 (Tingkatan 5 1) | 1 · 0 · 0 · 0 | 20 | — | 1 · 1 · 20 · 0 · 0 | "Semua (1)", "Aktif (1)" · "Cemerlang — 100%" | 1 · 0 · 0 (+0) | 0 · 0 | Tiada langganan |
| 4 | 8098 | Selangor | 1 (Tingkatan 5 1) | 1 · 0 · 0 · 1 | 30 | — | 1 · 1 · 30 · 0 · 0 | "Semua (1)", "Aktif (1)" · "Cemerlang — 100%" | 1 · 0 · 0 (+1) | 0 · 0 | Tiada langganan |
| 5 | 8284 | Selangor | 1 (Tingkatan 5 1) | 1 · 1 · 1 · 1 | 5 | — | 1 · 1 · 5 · 0 · 0 | "Semua (1)", "Aktif (1)" · "Cemerlang — 100%" | 1 · 0 · 0 (+0) | 0 · 0 | Tiada langganan |
| 6 | 8080 | Selangor | 184 (T5 152, Tingkatan 5 32) | 174 · 12 · 18 · 39 | 53,494 | 34 / 34 | 184 · 165 · 53,494 · 34 · 34 | "Semua (184)", "Aktif (165)" · "Cemerlang — 89.7%" | 174 · 4 · 6 (+2) | 10 · 9 | Active — sehingga 12 May 2027 |
| 7 | 8078 | Selangor | 423 (T5 373, Tingkatan 5 50) | 345 · 6 · 16 · 54 | 88,968 | 60 / 53 | 423 · 341 · 88,968 · 60 · 52 | "Semua (423)", "Aktif (341)" · "Cemerlang — 80.6%" | 345 · 40 · 38 (+11) | 14 · 4 | Active — sehingga 12 May 2027 |
| 8 | 8082 | Selangor | 549 (T5 497, Tingkatan 5 52) | 393 · 9 · 26 · 78 | 130,233 | 68 / 51 | 549 · 379 · 130,233 · 68 · 51 | "Semua (549)", "Aktif (379)" · "Cemerlang — 69%" | 393 · 67 · 89 (+5) | 6 · 14 | Active — sehingga 12 May 2027 |
| 9 | 8880 | Johor | 53 (T4 26, T5 27) | 31 · 0 · 0 · 0 | 10,196 | 2 / 1 | 53 · 31 · 10,196 · 2 · 1 | "Semua (53)", "Aktif (31)" · "Sederhana — 58.5%" | 31 · 14 · 8 (+0) | 0 · 0 | Active — sehingga 12 May 2027 |
| 10 | 8106 | Selangor | 560 (T5 374, Tingkatan 4 7, Tingkatan 5 179) | 306 · 14 · 23 · 99 | 59,211 | 60 / 18 | 560 · 303 · 59,201 · 60 · 16 | "Semua (560)", "Aktif (303)" · "Sederhana — 54.1%" | 306 · 69 · 185 (+22) | 13 · 3 | Active — sehingga 08 May 2027 |
| 11 | 8298 | Selangor | 2 (Tingkatan 5 2) | 1 · 0 · 0 · 0 | 10 | — | 2 · 1 · 10 · 0 · 0 | "Semua (2)", "Aktif (1)" · "Sederhana — 50%" | 1 · 0 · 1 (+1) | 0 · 0 | Tiada langganan |
| 12 | 10220 | Kuala Lumpur | 2 (T5 2) | 1 · 0 · 0 · 1 | 1,095 | 2 / 2 | 2 · 1 · 1,095 · 2 · 2 | "Semua (2)", "Aktif (1)" · "Sederhana — 50%" | 1 · 1 · 0 (+0) | 1 · 0 | Active — sehingga 11 May 2027 |
| 13 | 1014 | Selangor | 5 (Tingkatan 5 5) | 2 · 0 · 0 · 0 | 110 | — | 5 · 2 · 110 · 0 · 0 | "Semua (5)", "Aktif (2)" · "Sederhana — 40%" | 2 · 0 · 3 (+1) | 0 · 0 | Tiada langganan |
| 14 | 8765 | Johor | 16 (T4 12, T5 4) | 6 · 0 · 0 · 0 | 222 (incl. 12 before M1) | — | 16 · 1 · 209 · 0 · 0 | "Semua (16)", "Aktif (1)" · "Rendah — 6.3%" | 1 · 0 · 15 (+1) | 0 · 0 | Tiada langganan |
| 15 | 8090 | Selangor | 385 (T5 361, Tingkatan 4 1, Tingkatan 5 23) | 134 · 2 · 5 · 19 | 120,782 | 83 / 42 | 385 · 129 · 119,806 · 83 · 42 | "Semua (385)", "Aktif (129)" · "Sederhana — 33.5%" | 134 · 56 · 195 (+10) | 5 · 5 | Active — sehingga 08 May 2027 |
| 16 | 8087 | Selangor | 312 (T4 1, T5 301, Tingkatan 5 10) | 46 · 0 · 0 · 6 | 6,779 | 44 / 12 | 312 · 46 · 6,779 · 44 · 13 | "Semua (312)", "Aktif (46)" · "Rendah — 14.7%" | 46 · 14 · 252 (+5) | 3 · 0 | Active — sehingga 19 Apr 2027 |
| 17 | 8102 | Selangor | 776 (T5 770, Tingkatan 5 6) | 17 · 0 · 0 · 0 | 1,130 | 118 / 42 | 776 · 17 · 1,130 · 118 · 43 | "Semua (776)", "Aktif (17)" · "Kritikal — 2.2%" | 17 · 4 · 755 (+4) | 0 · 0 | Cancelled — sehingga 12 May 2027 |
| 18 | 8107 | Selangor | 675 (T5 675) | 1 · 0 · 0 · 0 | 25 | 20 / 4 | 675 · 1 · 25 · 20 · 4 | "Semua (675)", "Aktif (1)" · "Kritikal — 0.1%" | 1 · 0 · 674 (+0) | 0 · 0 | Expired — sehingga 22 May 2026 |
| 19 | 7780 | Perak | 6 (T4 3, T5 3) | 0 · 0 · 0 · 0 | 0 | — | 6 · 0 · 0 · 0 · 0 | "Semua (6)", "Aktif (0)" · "Tiada Langsung — 0%" | 0 · 0 · 6 (+0) | 0 · 0 | Tiada langganan |
| 20 | 8030 | Selangor | 8 (T4 4, T5 4) | 0 · 0 · 0 · 0 | 0 | — | 8 · 0 · 0 · 0 · 0 | "Semua (8)", "Aktif (0)" · "Tiada Langsung — 0%" | 0 · 0 · 8 (+0) | 0 · 0 | Tiada langganan |
| 21 | 8198 | Selangor | 1 (T5 1) | 0 · 0 · 0 · 0 | 0 | — | 1 · 0 · 0 · 0 · 0 | "Semua (1)", "Aktif (0)" · "Tiada Langsung — 0%" | 0 · 0 · 1 (+0) | 0 · 0 | Tiada langganan |
| 22 | 8228 | Selangor | 5 (T4 2, T5 3) | 0 · 0 · 0 · 0 | 0 | — | 5 · 0 · 0 · 0 · 0 | "Semua (5)", "Aktif (0)" · "Tiada Langsung — 0%" | 0 · 0 · 5 (+0) | 0 · 0 | Cancelled — sehingga 20 Feb 2027 |
| 23 | 8277 | Selangor | 150 (T5 150) | 0 · 0 · 0 · 0 | 0 | 29 / 16 | 150 · 0 · 0 · 29 · 17 | "Semua (150)", "Aktif (0)" · "Tiada Langsung — 0%" | 0 · 2 · 148 (+0) | 0 · 0 | Active — sehingga 12 May 2027 |
| 24 | 8300 | Selangor | 1 (Tingkatan 5 1) | 0 · 0 · 0 · 0 | 0 | 1 / 1 | 1 · 0 · 0 · 1 · 1 | "Semua (1)", "Aktif (0)" · "Tiada Langsung — 0%" | 0 · 1 · 0 (+0) | 0 · 0 | Tiada langganan |
| 25 | 8302 | Selangor | 1 (T4 1) | 0 · 0 · 0 · 0 | 0 | — | 1 · 0 · 0 · 0 · 0 | "Semua (1)", "Aktif (0)" · "Tiada Langsung — 0%" | 0 · 0 · 1 (+0) | 0 · 0 | Tiada langganan |
| 26 | 8308 | Pahang | 1 (T5 1) | 0 · 0 · 0 · 0 | 0 | — | 1 · 0 · 0 · 0 · 0 | "Semua (1)", "Aktif (0)" · "Tiada Langsung — 0%" | 0 · 0 · 1 (+0) | 0 · 0 | Tiada langganan |
| 27 | 8767 | Johor | 8 (T4 3, T5 5) | 0 · 0 · 0 · 0 | 0 | — | 8 · 0 · 0 · 0 · 0 | "Semua (8)", "Aktif (0)" · "Tiada Langsung — 0%" | 0 · 0 · 8 (+0) | 0 · 0 | Tiada langganan |
| 28 | 8772 | Johor | 7 (T4 3, T5 4) | 0 · 0 · 0 · 0 | 0 | — | 7 · 0 · 0 · 0 · 0 | "Semua (7)", "Aktif (0)" · "Tiada Langsung — 0%" | 0 · 0 · 7 (+0) | 0 · 0 | Tiada langganan |
| 29 | 8965 | Kedah | 7 (T4 3, T5 4) | 0 · 0 · 0 · 0 | 0 | — | 7 · 0 · 0 · 0 · 0 | "Semua (7)", "Aktif (0)" · "Tiada Langsung — 0%" | 0 · 0 · 7 (+0) | 0 · 0 | Tiada langganan |
| 30 | 9167 | Melaka | 8 (T4 4, T5 4) | 0 · 0 · 0 · 0 | 0 | — | 8 · 0 · 0 · 0 · 0 | "Semua (8)", "Aktif (0)" · "Tiada Langsung — 0%" | 0 · 0 · 8 (+0) | 0 · 0 | Tiada langganan |
| 31 | 9681 | Kuala Lumpur | 1 (Tingkatan 4 1) | 0 · 0 · 0 · 0 | 0 | — | 1 · 0 · 0 · 0 · 0 | "Semua (1)", "Aktif (0)" · "Tiada Langsung — 0%" | 0 · 1 · 0 (+0) | 0 · 0 | Tiada langganan |
| 32 | 9801 | Kuala Lumpur | 1 (Tingkatan 4 1) | 0 · 0 · 0 · 0 | 0 | — | 1 · 0 · 0 · 0 · 0 | "Semua (1)", "Aktif (0)" · "Tiada Langsung — 0%" | 0 · 0 · 1 (+0) | 0 · 0 | Tiada langganan |
| 33 | 9806 | Sabah | 6 (T4 3, T5 3) | 0 · 0 · 0 · 0 | 0 | — | 6 · 0 · 0 · 0 · 0 | "Semua (6)", "Aktif (0)" · "Tiada Langsung — 0%" | 0 · 0 · 6 (+0) | 0 · 0 | Tiada langganan |
| — | 5183 | Terengganu | 0 | — | 0 | 1 / 1 | 0 · 0 · 0 · 1 · 1 | — | — | — | Tiada langganan |

Totals (computed from the rows): 4,158 T4/T5 students; S2 Aktif 1,462 · 7d 44 · 30d 89 · 3m 298; answers 472,371; teachers 522 / 277.

Derived and checked by script (`gen-seed.js`): the rows reproduce every observed S2 view — default, 7d, 30d and 3m row orders and tahap counts (default 8 / 7 / 1 / 2 / 15), the Terbaik / Perhatian / Cadangan lists (default 3 / 18 / 17; 7d 1 / 32 / 31; 30d 1 / 32 / 31; 3m 2 / 29 / 26), "Selangor + Kritikal" (28 · 4,042 · 1,424 · 35.2% · 460,858 · 323.6 · 517 · 273 · 52.8%), "Johor" (7 · 84 · 37 · 44% · 10,418 · 281.6 · 2 · 1 · 50%) and the teacher table (5183, 8080, 8300, 10220, 8078, 8082, 8277, 8090, 8880, 8102, 8106, 8087, 8107). Period answer totals (7d 7,651, 30d 22,207, 3m 86,697) are distributed by the answers dataset inside the observed weekly cells (M28 partial … M32 for 30d; M31 partial + M32 for 7d; M19 partial … M32 for 3m; per-school split `observed:false`), with the observed per-school period Aktif counts (column 5).

**Weekly tracking (every cell observed; row order = total answers descending, ties by school id ascending, then the zero rows in table order — OBSERVED).** Checked by script against BR-M11-15: 0 colour-rule, trend or Best mismatches over 1,056 cells (890 "-", 80 green, 81 red, 5 blue — M1 ×4 at 8090, 8880, 8765 and 940, and one equal week, 8080 M29 150 = M28 150). Rows 31–32 are the two code-less Kuala Lumpur schools 9681 and 9801 (all zero).

| Order | School id | M1 … M32 (count:class — g green, r red, b blue, * best; bare = "-" slate) | Trend | Best |
|---|---|---|---|---|
| 1 | 8082 | 0 0 0 0 0 0 0 0 0 0 0 0 13516:g 7370:r 13087:g 29604:g* 16958:r 11391:r 10111:r 6294:r 2060:r 1672:r 2418:g 1654:r 2146:g 961:r 1157:g 1299:g 1108:r 4174:g 2259:r 994:r | Menurun | M16 29,604 |
| 2 | 8090 | 268:b 413:g 295:r 333:g 404:g 18:r 296:g 70:r 0 0 5177:g 2191:r 1944:r 6605:g 22705:g 37911:g* 20450:r 10257:r 4725:r 1693:r 1190:r 302:r 795:g 614:r 478:r 385:r 338:r 88:r 383:g 205:r 154:r 95:r | Menurun | M16 37,911 |
| 3 | 8078 | 0 0 0 0 0 0 0 0 693:g 13082:g 3330:r 1837:r 1129:r 21286:g* 17932:r 9002:r 5369:r 1290:r 2486:g 1598:r 3254:g 2534:r 1485:r 321:r 458:g 64:r 322:g 70:r 681:g 340:r 110:r 295:g | Meningkat | M14 21,286 |
| 4 | 8106 | 0 0 0 0 0 0 0 0 0 1696:g 674:r 726:g 3737:g 10554:g* 3653:r 1691:r 645:r 6026:g 8898:g 4799:r 2074:r 510:r 758:g 669:r 1756:g 1846:g 1216:r 1441:g 1840:g 1376:r 2119:g 507:r | Menurun | M14 10,554 |
| 5 | 8080 | 0 0 0 0 0 0 0 0 0 0 0 2637:g 315:r 1497:g 957:r 0 352:g 37748:g* 3290:r 1026:r 375:r 179:r 415:g 40:r 476:g 55:r 120:g 150:g 150:b 231:g 2929:g 552:r | Menurun | M18 37,748 |
| 6 | 8880 | 8:b 1355:g 2381:g 2538:g* 2265:r 1639:r 0 10:g 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 | Sama | M4 2,538 |
| 7 | 8087 | 0 0 0 0 0 0 0 0 2798:g* 258:r 340:g 120:r 137:g 509:g 125:r 1569:g 394:r 174:r 140:r 5:r 130:g 60:r 0 0 0 20:g 0 0 0 0 0 0 | Sama | M9 2,798 |
| 8 | 8102 | 0 0 0 0 0 0 0 0 0 0 0 0 1105:g* 25:r 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 | Sama | M13 1,105 |
| 9 | 10220 | 0 0 0 0 0 0 0 0 0 139:g 225:g 295:g 357:g* 15:r 0 5:g 0 49:g 0 0 0 0 5:g 0 5:g 0 0 0 0 0 0 0 | Sama | M13 357 |
| 10 | 8765 | 38:b 47:g 28:r 49:g* 48:r 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 | Sama | M4 49 |
| 11 | 1014 | 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 60:g* 0 0 50:g 0 0 0 0 0 0 0 0 0 0 0 0 0 | Sama | M16 60 |
| 12 | 987 | 0 0 0 0 0 0 0 0 0 20:g* 16:r 0 0 15:g 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 | Sama | M10 20 |
| 13 | 8098 | 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 30:g* 0 0 0 0 0 0 0 0 0 0 0 0 | Sama | M20 30 |
| 14 | 8107 | 0 0 0 25:g* 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 | Sama | M4 25 |
| 15 | 995 | 0 0 0 0 0 0 0 0 0 0 20:g* 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 | Sama | M11 20 |
| 16 | 940 | 10:b* 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 | Sama | M1 10 |
| 17 | 8298 | 0 0 0 0 0 0 0 0 0 0 0 10:g* 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 | Sama | M12 10 |
| 18 | 8284 | 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 5:g* | Meningkat | M32 5 |
| 19 | 7780 | 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 | Sama | - |
| 20 | 8030 | 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 | Sama | - |
| 21 | 8198 | 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 | Sama | - |
| 22 | 8228 | 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 | Sama | - |
| 23 | 8277 | 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 | Sama | - |
| 24 | 8300 | 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 | Sama | - |
| 25 | 8302 | 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 | Sama | - |
| 26 | 8308 | 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 | Sama | - |
| 27 | 8767 | 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 | Sama | - |
| 28 | 8772 | 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 | Sama | - |
| 29 | 8965 | 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 | Sama | - |
| 30 | 9167 | 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 | Sama | - |
| 31 | 9681 | 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 | Sama | - |
| 32 | 9801 | 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 | Sama | - |
| 33 | 9806 | 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 | Sama | - |

**School 8880 and pupils 3201–3215 (XL3-13 check).** M02 v1.12 places the M08 pupils 3201–3215 (grade 10, class 516 "4 Simulasi") at 8880 with `lastLoginAt` set (XL3-20); their 6,563 answers have no session (M05 v1.10 Q-ANS-NOSESSION) and sit inside 8880's observed weekly cells (Σ 10,196). The row still holds: 53 registered (T4 26 incl. the 15, T5 27), Aktif 31 (incl. the 15), Login sahaja 14, Belum login 8, answered without login 0; M18 v1.4 DV-43 records the resulting change to M18's own risk seed. M11's values are unchanged.

**Anomaly flags (DATA-M11-01, observed per school on S3):** 8080 review 10 / excluded 9; 8078 14 / 4; 8082 6 / 14; 8106 13 / 3; 8090 5 / 5; 8087 3 / 0; 10220 1 / 0; none elsewhere. The flagged students' answers are part of the observed totals (e.g. the 9 excluded 8080 accounts answered 26,507 of 53,494, the latest on 20/09/2026 — audit evidence).

**School 8080 anchors** (fictitious names; ids: Student A = **2008** as observed on live; the others are ids that M02 assigns inside the users dataset range 1–6,000, §6.10 XR-M11-02). S3 order after DV-M11-07 = Tingkatan, then name A→Z:

| Anchor | Name | Level | Answers · correct | Last login · last activity | Notes |
|---|---|---|---|---|---|
| Student A (id 2008) | Adam Haikal Demo | T5 | 71 · 53 (74.6%) | 16/06/2026 14:11 · 16/06/2026 14:19 | subjects BM 31/31, Sejarah 16/25, BI 6/15; 18 wrong (18 unique); topics below. **Chapter-label groups (pinned → chip 0):** BM "Bahasa Melayu Tingkatan 5" 31/31; Sejarah "Sejarah Tingkatan 5 KSSM" 16/25 (64%); BI "Bahasa Inggeris Tingkatan 5" 4/5 (the "Reading for main ideas" answers); the 10 BI "Umum" answers carry no label |
| F | Afiqah Demo | T5 (live "Tingkatan 5") | 100 · 100 | generated | S5 row 2 |
| Student B | Ahmad Danial Demo | T5 | 195 · 150 (76.9%) | 05/07/2026 05:57 · 05/07/2026 06:13 | Biologi 61/75, Sejarah 35/40, BM 28/35, Pendidikan Islam 19/20, Fizik 5/15, Matematik 2/10. **Chapter-label groups (pinned, BR-19 → chip 2):** BM "Kemahiran Bahasa Tingkatan 4" 0/1 and "Kemahiran Bahasa Tingkatan 5" 0/4 (the only groups < 60%), BM "Bahasa Melayu Tingkatan 5" 28/30; Biologi "Biologi Tingkatan 5" 61/75; Sejarah "Sejarah Tingkatan 5 KSSM" 35/40; Pendidikan Islam "Pendidikan Islam Tingkatan 5" 19/20; **Fizik and Matematik answers carry no chapter label ("Umum", ignored by the gap rule)** |
| D | Aina Sofea Demo | T5 | 40 · 21 (52.5%) | 16/06/2026 02:20 · 16/06/2026 02:32 | |
| G | Aisyah Demo | T5 (live "Tingkatan 5") | 171 · 108 (63.2%) | generated | |
| H | Akmal Demo | T5 (live "Tingkatan 5") | 0 | login set | "Login sahaja" |
| E | Alia Natasha Demo | T5 | 20 · 11 (55%) | 15/06/2026 18:20 · 21/05/2026 02:40 | |
| I | Amir Hakimi Demo | T5 | 190 · 142 (74.7%) | generated | |
| J | Amirah Demo | T5 | 258 · 196 (76%) | generated | |
| Student C | Nur Qistina Demo | T5 (live "Tingkatan 5") | 265 · 168 (63.4%) | generated · 27/06/2026 14:24 | Sejarah 63/105, Sains 33/50, Pendidikan Islam 42/50, BI 15/40, Biologi 10/15, Matematik 5/5; 97 wrong. **Chapter-label groups (pinned → chip 6):** Sejarah "Sejarah Tingkatan 5 KSSM" 7/18 (38.9%), "Sejarah Tingkatan 4" 6/12 (50.0%), "Sejarah Tingkatan 3" 50/75 (66.7%); Sains "Sains Tingkatan 5" 3/10 (30.0%), "Sains Tingkatan 4" 4/9 (44.4%), "Sains Tingkatan 3" 0/2 (0.0%), "Sains Tingkatan 2" 1/3 (33.3%), "Sains Tingkatan 1" 25/26 (96.2%); Pendidikan Islam "Pendidikan Islam Tingkatan 5" 42/50; Biologi "Biologi Tingkatan 4" 10/15 (66.7%); Matematik "Matematik Tingkatan 5" 5/5; BI answers carry no label → exactly 6 groups < 60% (values recomputed, DV-M11-20; C's hidden live gap texts are not reproduced) |
| apostrophe row | Nur'ain Demo | T5 | answered, login set | generated | DV-M11-18 (the live error row; status "Aktif") |
| 4664 (M02 v1.12, M12 XR-01) | generated name (M02) | T5 | 0 | logged in · - | one of the 4 "Login sahaja"; S3 row links to `/admin/kirkpatrick/pelajar/4664` (M12); S4 opens in the 0-answer state (FR-87) |
| 4644 (M02 v1.12, M12 XR-01) | generated name (M02) | T5 | 0 | - · - | one of the 6 "Belum login"; S3 row links to `/admin/kirkpatrick/pelajar/4644`; S4 0-answer state |
| Teacher T | Cikgu Rahimah Demo | teacher | — | 15/06/2026 12:37 | S5 anchor |

8080 anchor ids 2001–2012 are assigned by M02 v1.12 (Student A = 2008). The other 8080 students are generated to reach the observed status counts: Aktif 174 (153 plain + 10 review + 9 excluded + 2 without a login), Login sahaja 4, Belum login 6; 3 answered students below 50% accuracy, 57 between 50 and 69.9, 114 at 70 or more (S5 accuracy bands, snapshot); Tingkatan strings 152 "T5" / 32 "Tingkatan 5" on live (one format after DV-M11-07); 34 teachers, all logged in.

**M11 anchor questions in M04 (M04 SRS v1.7 §6.13.2, row "M11 anchors").** M11 needs **exactly 531** anchor questions — one question per observed answer of the three S4 students (Student A 71, B 195, C 265; every wrong answer is to a distinct question, as live: "18 soalan unik", "45 …", "97 …"). They are the whole M04 block **700401–700931**, all MCQ, approved, active, with `chapterLabel` and `curriculumTopicId` (FR-M04-126, `questions.get`). Ids by student: **A 700401–700471**, **B 700472–700666**, **C 700667–700931** (within each student, newest answer first, so Student A's row 1 is 700401). Allocation by M04 cell (subject · level; T4/T5 cells are `spmPool = true` rows, T1–T3 non-pool) — Σ = 531, equal to the M04 cells:

| M04 cell | Count | Student A | Student B | Student C | `chapterLabel` groups (§6.7 pins) |
|---|---|---|---|---|---|
| BM T5 | 65 | 31 | 34 | — | A "Bahasa Melayu Tingkatan 5" 31/31; B "Bahasa Melayu Tingkatan 5" 28/30, "Kemahiran Bahasa Tingkatan 5" 0/4 |
| BM T4 | 1 | — | 1 | — | B "Kemahiran Bahasa Tingkatan 4" 0/1 |
| SEJ T5 | 83 | 25 | 40 | 18 | "Sejarah Tingkatan 5 KSSM" (A 16/25, B 35/40, C 7/18) |
| SEJ T4 | 12 | — | — | 12 | C "Sejarah Tingkatan 4" 6/12 |
| SEJ T3 | 75 | — | — | 75 | C "Sejarah Tingkatan 3" 50/75 |
| BI T5 | 55 | 15 | — | 40 | A "Bahasa Inggeris Tingkatan 5" 4/5 + 10 without label ("Umum"); C 40 without label |
| BIO T5 | 75 | — | 75 | — | B "Biologi Tingkatan 5" 61/75 |
| BIO T4 | 15 | — | — | 15 | C "Biologi Tingkatan 4" 10/15 |
| PI T5 | 70 | — | 20 | 50 | "Pendidikan Islam Tingkatan 5" (B 19/20, C 42/50) |
| PHY T5 | 15 | — | 15 | — | B, no label |
| MATH T5 | 15 | — | 10 | 5 | B no label; C "Matematik Tingkatan 5" 5/5 |
| SCI T5 | 10 | — | — | 10 | C "Sains Tingkatan 5" 3/10 |
| SCI T4 | 9 | — | — | 9 | C "Sains Tingkatan 4" 4/9 |
| SCI T3 | 2 | — | — | 2 | C "Sains Tingkatan 3" 0/2 |
| SCI T2 | 3 | — | — | 3 | C "Sains Tingkatan 2" 1/3 |
| SCI T1 | 26 | — | — | 26 | C "Sains Tingkatan 1" 25/26 |
| **Σ** | **531** | **71** | **195** | **265** | |

The observed texts, options, keys, explanations and sources of Student A's rows (below) are those anchors' content; the other anchors carry generated content inside their cell (`observed:false`). The Tajuk topic of each answer = its question's `curriculumTopicId` → M03 topic (Student A's 18 observed rows, §6.7).

Student A anchor answers (M04 anchors 700401–700471, each with `chapterLabel` and `curriculumTopicId`; Sejarah, answered 16/06/2026 14:19; newest first; question text is not personal data): unchanged from v1.0 (rows 1–8: "Apakah ciri negara berdaulat? …" A/D, "Apakah ciri Moden Perlembangaan Persekutuan?" C/B, "Senarai Negeri memperuntukkan kuasa Kerajaan Negeri. A…" C/B, "Apakah faktor yang menamatkan konfrontasi Indonesia ter…" B/D, "OIC (Pertubuhan Kerjasama Islam) adalah pertubuhan yang" D/D, "Struktur organisasi berikut berkaitan dengan pentadbiran K…" B/A, "Apakah kepentingan perayaan bersama seperti Hari Raya, Tahun Baru Cina, dan Deep…" C/C, "Apakah ciri-ciri tradisional dalam Perlembagaan Persekutu…" A/A; row 1 options A "I dan IV", B "II dan III", C "III dan IV", D "I dan II", explanation "[AI-repaired 2026-04-22] Ciri negara berdaulat termasuk pentadbiran yang sistematik dan sempadan yang jelas. Rakyat berbilang kaum tidak semestinya menjadi ciri utama, dan naungan kerajaan lain menunjukkan ketidakberdaulatan.", chapter label "Sejarah Tingkatan 5 KSSM", source "Percubaan SPM 2025 Sejarah Melaka", difficulty 2, 2026-06-16 14:19:57; row 2 B "Sarawak dan Sabah diberi beberapa autonomi", C "Keberkesanan pentadbiran", source "Percubaan SPM 2025 Sejarah Johor Muar", explanation "Jawapan yang betul ialah Sarawak dan Sabah diberi beberapa autonomi. Pilihan ini paling tepat kerana sepadan dengan konsep yang diuji dalam soalan."). Truncated texts keep the observed 80-character prefix; the remainder is `observed:false`.

**Student A topics (all 18 rows observed, snapshot `s4.topics`, in live order):**

| Subject | Bab | Topic | % | Betul/Jumlah | Badge |
|---|---|---|---|---|---|
| Bahasa Inggeris | — | Umum | 20.0% | 2/10 | Lemah |
| Bahasa Inggeris | Bab 1 | Reading for main ideas | 80.0% | 4/5 | Kuat |
| Bahasa Melayu | Bab 1 | SULUH MASA DEPAN | 100.0% | 1/1 | Kuat |
| Bahasa Melayu | Bab 1 | Kemahiran Membaca dan Memahami | 100.0% | 21/21 | Kuat |
| Bahasa Melayu | Bab 1 | Penulisan karangan lanjutan | 100.0% | 1/1 | Kuat |
| Bahasa Melayu | Bab 3 | Tatabahasa | 100.0% | 1/1 | Kuat |
| Bahasa Melayu | Bab 3 | KECERDASAN MENINGKAT, | 100.0% | 1/1 | Kuat |
| Bahasa Melayu | Bab 4 | WASPADA SELALU! | 100.0% | 1/1 | Kuat |
| Bahasa Melayu | Bab 5 | Dunia Baharu Tani | 100.0% | 1/1 | Kuat |
| Bahasa Melayu | Bab 9 | INDAH SENI, ENDAH BUDAYA | 100.0% | 1/1 | Kuat |
| Bahasa Melayu | Bab 10 | SAINS DAN TEKNOLOGI PEMACU | 100.0% | 1/1 | Kuat |
| Bahasa Melayu | Bab 13 | Cergas Aktif | 100.0% | 1/1 | Kuat |
| Bahasa Melayu | Bab 99 | Mendengar, mengenal dan menyebut perkataan, rangkai kata, istilah dan ungkapan serta intonasi ayat dalam pelbagai ujaran. | 100.0% | 1/1 | Kuat |
| Sejarah | Bab 1 | Kemunculan tamadun awal | 0.0% | 0/1 | Lemah |
| Sejarah | Bab 1 | Persekutuan Tanah Melayu 1948 | 100.0% | 1/1 | Kuat |
| Sejarah | Bab 1 | Warisan Negara Bangsa | 60.0% | 12/20 | Sederhana |
| Sejarah | Bab 3 | Lokasi Zaman Prasejarah di Dunia | 100.0% | 2/2 | Kuat |
| Sejarah | Bab 6 | Pentadbiran Barat Berkaitan dengan Ekonomi | 100.0% | 1/1 | Kuat |

Row order inside a subject is the live order (INFERRED: Bab ascending, then as stored). Sums: BI 6/15, BM 31/31, Sejarah 16/25 = the subject rows.

### 6.8 Seed — teacher view (designed; M08 v1.7 classes and students)

`guru@demo.test` (id 5, school 900001 SMK DEMO) owns M08's classes **2001 "5 MARIKH - Kimia"** (Kimia, level 11, members 3001–3008) and **2002 "5 MARIKH - Sejarah"** (Sejarah, level 11, members 3001–3008) (M08 SRS v1.7 §6.10; class 2003 no longer exists). Population "Semua Kelas", 2001 or 2002 = the same 8 students ("Murid Demo 01…08", SMK DEMO, level 11).

| Student | `lastLoginAt` (M01 field; values seeded by M02 v1.11, XL2-43) | Sessions (M08 designed, M05 store, mode `random`) |
|---|---|---|
| 3001 | 2026-09-24 (last session) | Kimia 09-15 (8 q, 7 correct), 09-24 (1 q, 1); Sejarah 09-18 (5 q, 4) |
| 3002 | 2026-09-24 | Kimia 09-15 (8, 5), 09-24 (2, 0); Sejarah 09-18 (5, 3) |
| 3003 | 2026-09-18 | Kimia 09-15 (8, 3); Sejarah 09-18 (5, 2) |
| 3004 | 2026-09-15 | Kimia 09-15 (8, 3) |
| 3005, 3006 | 2026-09-22 | Kimia 09-22 (8, 3) |
| 3007 | 2026-09-24 | Kimia 09-22 (8, 2), 09-24 (1, 1) |
| 3008 | 2026-09-22 | Kimia 09-22 (8, 1) |

Resulting anchors (provisional E2E; recomputed on M08 v1.7): 30 days — "Pernah Login" 100% 8 / 8 (no red line), "Pernah Buat Latihan" 100% 8 / 8, "Jumlah Aktiviti" 14 = Kuiz 14 (Struktur, Latih Tubi, Tracking A, Battle, Permainan 0), "Skor Purata" 46% (38 / 83) — Kuiz 46%, the other four bars "-%"; trend 15/09 4, 18/09 3, 22/09 4, 24/09 3, other days 0; 7 days 7 activities; login and latihan panels "(0)" with their observed success copy; "Belum Pernah Buat Latihan" empty (PROPOSED reuse copy); "Paling Aktif" 8 rows: Murid Demo 01 and 02 (3 aktiviti), 03 and 07 (2), 04, 05, 06, 08 (1). The class filter gives the same figures for 2001 and 2002 (same members). S6 class 2001: M08 anchors Q1–Q8 (p 75.0, 50.0, 60.0, 25.0, 12.5, 12.5, 50.0, 50.0; D 1.000, 0.333, 0.250, 0.000, −0.500, 0.500, 1.000, 1.000).

**Fixture school 900001 and the monitoring register (decided, BR-M11-34).** With M08 v1.7 the students 3001–3008 (T5) and the canonical accounts 2 (grade 10) and 5 (teacher) are at SMK DEMO 900001. Under BR-M11-34 the reserved fixture schools 900001–900099 are excluded from the platform monitoring rollups, so SMK DEMO adds no row to the S2 tables, KPIs, lists or weekly rows and every observed S2 figure stays exact; these accounts appear only in their own views (M08, M10, M13, and this module's S1/S6 teacher view above).

### 6.9 Test hooks (dev/test builds only)

`mock.reset()`, `mock.setNow(iso)` (M05 clock), fake timers for the auto-refresh (`page.clock`), `mock.failNext(path, code)`, `mock.addQuestionWithoutOptions(userId)` (FR-71 deleted-options state), `mock.setGuideHidden(bool)`, `mock.addRuntimeSchool()` (creates a school via the M02 create contract, id ≥ 10,301, with one T5 student and one teacher; E2E-54). (The "Belum login" teacher rows are observed data now: e.g. 8082 has 17, 8106 44.)

### 6.10 Cross-module contracts (delivered by the owners; M11 uses no parallel schema — D12)

| # | Owner | Contract (as delivered) |
|---|---|---|
| XR-M11-01 | M01 | (Delivered by M01 v1.9.) `User.lastLoginAt: datetime \| null`, set at login; values for canonical 2, 5 and the M08 students 3001–3008 as §6.8, seeded by M02 v1.11 (XL2-43). |
| XR-M11-02 | M02 | (v1.12: 8080 anchors 2001–2012 and 4664 / 4644; 3201–3215 at 8880 inside its row.) (Delivered by M02 v1.11 §6.15 C, XL2-03; this text is its target.) **Monitoring rows of the users dataset (replaces the v1.0 id blocks 100001+/105001+, withdrawn).** Inside the users dataset of M02 §6.15 (5,159 users, generated ids 1–6,000, runtime ≥ 9,000,001), make the 4,158 T4/T5 students (role `student`, grade 10/11) and 522 teachers that have a `schoolId` belong to the 33 + 13 observed monitoring schools with the per-school counts of M11 SRS §6.7 (registered, Aktif all-time and per period, status counts Aktif / Login sahaja / Belum login and answered-without-login, teacher registered / logged in, Tingkatan split T4/T5), as generated rows plus anchors: **Student A = user 2008** at school 8080 (observed live id) and the other 8080 anchors of §6.7 (ids assigned by M02 inside 1–6,000, clear of the fixture blocks 1–11, 3001–3008, 3101–3109, 3201–3215, 5001–5990). Note: live 8080 student ids span 1459–5572 and teacher ids 2065–2363, so observed ids overlap M02's fixture block 5001–5990; M02 decides where the generated monitoring rows sit (M11 asserts only 2008). Existing M02 fixtures with a school must fit these counts (e.g. 5001–5210 inside 8102's 776, all "Belum login"); others must have no school or fit an observed row. Seed `lastLoginAt` accordingly. |
| XR-M11-03 | M02 | (Delivered by M02 v1.11 subscriptions, XL2-04; this text is its target.) **Monitoring schools and subscriptions.** The 34 observed schools of §6.7 (33 student-table schools + 5183) are in the register with their observed state and code presence (no code: 8300, 9681, 9801); 987, 995, 1014, 8078, 8090, 8106 and 8300 — already M02 anchors — **are monitoring schools** (v1.0 wrongly listed them as "other schools"; 8106 is row 10, 560 T4/T5). Subscriptions as observed on S3: Active — 8080, 8078, 8082, 8880, 8277 (until 12 May 2027), 8106, 8090 (08 May 2027), 10220 (11 May 2027), 8087 (19 Apr 2027); Cancelled — 8102 (12 May 2027), 8228 (20 Feb 2027); Expired — 8107 (22 May 2026); none at the other schools. Reconcile M02's fixture subscriptions 11–17 (e.g. 11 at 8277 ✓; 12 at 8106 with 55 enrolled vs 560 T4/T5 registered — M02 to state what "enrolled" counts). "Jumlah Sekolah" 57 = M02's 60 schools with users − the 3 fixture schools (BR-M11-34). |
| XR-M11-04 | M05 | (Delivered by M05 v1.8 §6.14 — Q-ANS-SEG, Q-ANS-USER, Q-SESS-USER, Q-ANS-CLASS / Q-SESS-CLASS; §6.5.1.) Host the monitoring answers as a D11 virtual segment of the answer log (M05 §6.14 today declares only small seeded tables): per school and week exactly the §6.7 weekly cells (+ 12 answers before M1), per-period totals 7,651 / 22,207 / 86,697 inside those cells, per-student totals for the anchors; expose per-(school, week) and per-student aggregates (NFR-M11-01). |
| XR-M11-05 | M04 / M03 | (Delivered by M04 v1.9 §6.13.2, FR-M04-126.) The 531 M11 anchor questions are the block **700401–700931** in `questions.*` (cells as §6.7: BM T5 65, BM T4 1, SEJ T5 83, SEJ T4 12, SEJ T3 75, BI T5 55, BIO T5 75, BIO T4 15, PI T5 70, PHY T5 15, MATH T5 15, SCI T5 10, SCI T4 9, SCI T3 2, SCI T2 3, SCI T1 26), MCQ, approved, active, each with `chapterLabel` (anchors only; M03 keeps 1,251 chapters) and `curriculumTopicId` → M03 topic; "{n} soalan tersedia" is defined over `chapterLabel` (BR-M11-19). M11 needs all 531 (one per observed answer). |
| XR-M11-06 | M08 | (v1.1) The teacher seed now follows M08 v1.7 (2001 Kimia, 2002 Sejarah, 3001–3008 at SMK DEMO level 11); nothing to change in M08. The fixture schools are excluded from platform monitoring rollups (BR-M11-34). |
| XR-M11-07 | M10 | Own classes via M10 #12 `GET /api/guru/classes` (§7 #2; admin `[]`) and the `/guru/*` guard of M10 §7 **T** endpoints (both exist in M10 v1.6); Enrolment used by BR-M11-01. |
| XR-M11-08 | M17 | Mount routes `/admin/monitoring`, `/admin/monitoring/sekolah/{id}[/pelajar/{id}\|/guru/{id}]`, `/admin/monitoring/export/{pdf\|csv}` on this component; admin sidebar active item (FR-05). Apply **BR-M11-34** unchanged: exclude only the reserved fixture schools 900001–900099 (and their users) from the platform rollups; every other school, including runtime schools ≥ 10,301, is counted; a direct drill-down URL for a fixture school renders its detail page as for any school. |

---

## 7. Mock API endpoints

All read-only (the module has no mutation). Errors use master SRS §7.3: 401 `UNAUTHORIZED` (guest), 403 `FORBIDDEN` (role), 404 `NOT_FOUND`.

| # | Method | Path | Owner | Query / params | Response | Errors | Live equivalent |
|---|---|---|---|---|---|---|---|
| 1 | GET | `/api/teacher/report` | M11 | `range` (7\|30\|90, other → 30), `classroomId?` | 200 `{data: TeacherReport}` | 401 | GET `/guru/laporan?range=&classroom_id=` (HTML) |
| 2 | GET | `/api/guru/classes` | M10 #12 (referenced; **T**) | — | 200 envelope `{data:[Classroom + {subjectName, levelLabel, studentCount}], meta}` own classes (admin `[]`); M11 uses `id`, `name` | 401, 403 | server-rendered select options |
| 3 | GET | `/api/monitoring/overview` | M11 (mounted by M17) | `period` (''\|7d\|30d\|3m), `state`, `tahap` | 200 `{data: MonitoringOverview}` | 401, 403 | GET `/guru/monitoring` · `/admin/monitoring` |
| 4 | GET | `/api/monitoring/schools/:schoolId` | M11 | — | 200 `{data: SchoolDetail}` | 401, 403, 404 | `/…/monitoring/sekolah/{id}` |
| 5 | GET | `/api/monitoring/schools/:schoolId/students/:userId` | M11 | — (school not checked, BR-29) | 200 `{data: StudentDetail}` | 401, 403, 404 | `/…/sekolah/{id}/pelajar/{id}` |
| 6 | GET | `/api/monitoring/schools/:schoolId/teachers/:userId` | M11 | — | 200 `{data: TeacherDetail}` | 401, 403, 404 | `/…/sekolah/{id}/guru/{id}` |
| 7 | GET | `/api/monitoring/export` | M11 | `format` (pdf\|csv), `period`, `state`, `tahap` | 200 `{data: {filename, rows:[SchoolEngagementRow]}}` (PROPOSED; the client builds the CSV / print view) | 401, 403 | GET `/admin/monitoring/export/{pdf\|csv}?…` (not opened) |
| 8 | GET | `/api/teacher/item-analysis` | M11 | `subjectId?`, `classroomId?` | 200 `{data: ItemAnalysis}` (rows `[]` for the admin) | 401 | GET `/guru/analisis-item?…` |
| 9 | GET | `/api/subjects` | M03 #28 (referenced) | — | 200 `{data: Subject[]}` | 401 | server-rendered options |

---

## 8. States & messages

### 8.1 Observed copy (exact)

| Screen | State | Copy |
|---|---|---|
| S1 | cards | "Pernah Login", "{n} belum pernah login", "Klik untuk lihat senarai", "Pernah Buat Latihan", "Jumlah Aktiviti", "{7\|30\|90} hari lepas", "Klik untuk lihat pecahan", "Skor Purata", "-%", "{a} / {n} pelajar" |
| S1 | panels | "Pelajar Belum Pernah Login ({n})", "Semua pelajar sudah pernah login!", "Pelajar Belum Pernah Buat Latihan ({n})", "Semua pelajar sudah aktif buat latihan!", "Pecahan Aktiviti ({7\|30\|90} Hari Lepas)", "Kuiz", "Struktur", "Latih Tubi", "Tracking A", "Battle", "Permainan", "Jumlah", "Pecahan Skor Purata" |
| S1 | lists / chart | "Trend Aktiviti", "Paling Aktif", "Belum ada aktiviti", "Belum Pernah Buat Latihan", "Belum pernah login", tooltip "{n} aktiviti", dataset "Aktiviti" |
| S2 | guide | FN-M11-3.1.2 texts, "Tunjuk panduan penggunaan", "Tip:", "Guna Filter untuk tapis negeri/tempoh/tahap. Export PDF/CSV untuk pembentangan." |
| S2 | filters / tools | "Tempoh", "Negeri", "Tahap", option labels, "Tapis", "Reset", "PDF", "CSV", "Refresh", "Auto-refresh dalam {m:ss}" |
| S2 | cards | "Jumlah Sekolah", "Berdaftar", "Pelajar T4/T5", "Pernah Aktif", "Min. 1 soalan", "% Penglibatan", "Keseluruhan", "Soalan Dijawab", "Total", "Purata/Pelajar", "Soalan/pelajar aktif", "Guru Berdaftar", "Guru Pernah Login", "% Penglibatan Guru" |
| S2 | tables | "Analisis Penglibatan Pelajar T4/T5", "Analisis Penglibatan Guru", "Mengikut sekolah — disusun mengikut % penglibatan tertinggi", "{n} sekolah", columns, "Legenda:", legend labels, "Tiada Guru (0 daftar)", "Tracking Mingguan", "Jumlah soalan dijawab mengikut minggu — warna menunjukkan trend naik/turun", "Meningkat", "Menurun", "Sama", "M{k}: dd/mm - dd/mm" |
| S2 | lists | "Sekolah Terbaik", "Perhatian Segera", "Cadangan Tindakan", the templates of FN-3.7.1–3.7.3, "Tiada pemerhatian yang perlu diberi perhatian buat masa ini." |
| S3 | | "Active — sehingga {d MMM yyyy}", "Cancelled — sehingga {d MMM yyyy}", "Expired — sehingga {d MMM yyyy}", "Tiada langganan", the warning box in its two forms (with and without "{m} daripadanya dikecualikan …"), "{Tahap} — {p}%", card labels, "Senarai Pelajar T4/T5", "Semua ({n})", "Aktif ({n})", "Login sahaja", "Belum login", "Cari nama pelajar...", the warning text, "Perlu Semak", "Perlu Semak · ditapis" and their titles, "Aktif", "Senarai Guru ({n})", "Semua", "Pernah Login", "Belum Login", "Pernah login", "Tiada guru berdaftar untuk sekolah ini." |
| S4 | | "Aktiviti Terakhir: …", "Soalan Dijawab", "Betul", "Salah", "Ketepatan", tab labels, "Mengikut Subjek", "Mengikut Tajuk", "Umum", "Bab {n}", "Kuat", "Sederhana", "Lemah", "Senarai Soalan ({a} tersedia daripada {t})", "Papar lagi 20 ({s}/{t})", "Jawapan Salah ({n} jawapan, {m} soalan unik)", "Jawapan betul", "Jawapan pelajar", "Sumber: …", "Gap Analysis & Cadangan Latihan", its subtitle, "Kritikal", "Lemah", "Perlu Perhatian", "{b}/{j} betul", "{n} soalan tersedia untuk latihan", "Topik Kuat", "{Subjek} · {n} soalan", "Tiada topik lemah dikesan!", "Semua topik yang dicuba mempunyai ketepatan melebihi 60%.", "Subjek Belum Dicuba", "Pemerhatian", sentence templates; modal "Betul"/"Salah", "Aras {n}", "Pilihan Jawapan", "Jawapan Betul", "Jawapan Pelajar", "Pilihan jawapan telah dipadam dari sistem.", "Penjelasan" |
| S5 | | "Login Terakhir: …", "Pernah Login", "Pelajar T4/T5", "Pelajar Aktif", "% Aktif", "Perlu Perhatian", "Prestasi Pelajar", column labels, the three Cadangan templates |
| S6 | | "Tapis:", "Mata Pelajaran", "Semua Subjek", "Kelas", "Semua Kelas", "Reset", "> 70% (Mudah)", "40–70% (Sederhana)", "< 40% (Sukar)", "Diskriminasi: >0.3 = baik, <0 = semak semula", "Tiada data analisis item untuk paparan ini.", "Pelajar perlu membuat latihan dahulu." |
| S8 / 404 | | M01 403 and 404 pages (URS FN-M11-6.2.1, FN-M11-1.2.2) |

### 8.2 PROPOSED COPY and PROPOSED layouts (report at G1; URS OQ-M11-06)

| Where | Text / layout | Basis |
|---|---|---|
| S1 list empty | "Semua pelajar sudah aktif buat latihan!" | reuse of observed copy (DV-M11-01) |
| S1 "Paling Aktif" populated | row layout of the other list, right label "{n} aktiviti" | tooltip copy "{n} aktiviti" (observed) |
| S6 populated table | columns Soalan · Subjek · Percubaan · % Betul · Diskriminasi, "baik" / "semak semula" | legend (observed) |
| S7 | header "Perbandingan Kelas", tab "Perbandingan Kelas - Portal Guru", "Tiada data perbandingan kelas untuk paparan ini." | menu label; S6 empty-card pattern (DV-M11-13) |
| S8 teacher | header "Laporan Mingguan", tab "Laporan Mingguan - Portal Guru", "Tiada data laporan mingguan untuk paparan ini." | menu label (DV-M11-19) |
| Exports | CSV `monitoring-penglibatan.csv`; PDF = print view | Q-M11-7 |
| S5 never-logged teacher | "Login Terakhir: -", pill "Belum Login" | S3 pill copy (INFERRED) |

### 8.3 Loading and errors

Server-rendered on live (no spinner). The prototype shows the shared shell loading state while the mock responds; a mock failure (`mock.failNext`) shows the M01 global error convention. No M11-specific error copy exists.

---

## 9. Permissions matrix

The module is read-only (no create/edit/delete); the only client-side write is the guide choice in `localStorage`.

| Role | S1 | S2–S5 on `/guru/…` | S2–S5 on `/admin/…` (M17) | Exports | S6 | S7 | S8 | Notes |
|---|---|---|---|---|---|---|---|---|
| Admin | view (empty population) | view (all schools) | view | yes | view (empty) | provisional page | 403 | OBSERVED (S7 fixed per DV-M11-13) |
| Guru | view own classes | view (same data, provisional) | redirect to the M01 landing page (INFERRED) | link present; target redirects (INFERRED) | view own classes | provisional page | provisional stand-in | INFERRED; OQ-M11-01/02 |
| Admin Sekolah, PPD, JPN | 403 + M01 landing page (M10 §7 **T** guard) | idem | M17 rule | — | idem | idem | idem | M10 rule |
| Pelajar, Ibu Bapa, Penaja | 403 + M01 landing page (M10 §7 **T** guard) | idem | M17 rule | — | idem | idem | idem | M10 rule |
| Guest | → `/login` | → `/login` | → `/login` | → `/login` | → `/login` | → `/login` | → `/login` | INFERRED |

---

## 10. Responsive behaviour

Shell switch at 1024px (sidebar → drawer; SHA bottom nav) per design/shells.md. Wide tables scroll inside their cards (NFR-RESP-05 b); no new sticky columns.

| Screen | 375 | 768 | 1280 |
|---|---|---|---|
| S1 | filter card stacks (`flex-col sm:flex-row`), select full width; cards 2 per row; panels full width, aktiviti tiles 2 per row; chart full width; lists stacked; e-mails truncate (DV-M11-16) | cards 2 per row; tiles 3 per row; lists side by side (`md`) | cards in a 5-column grid (4 cards); tiles 7 per row; lists side by side |
| S2 | guide tiles 1 column (guide fills the first screen, as live); filter wraps: Tempoh + Negeri / Tahap + Tapis / PDF · CSV · Refresh right; selects ≥ 36px (DV-M11-17); KPIs 2 per row, labels 10px; tables scroll in cards (student table right fade); weekly school column sticky; lists 1 column, Cadangan tiles 1 column | guide 2 columns; KPIs 2 per row (row 2: 3); lists 1 column; Cadangan 2 columns | guide 3 columns; KPIs 3 per row at `lg`, 6 at `xl`; attention lists 2 columns, Cadangan full width 2 columns |
| S3 | header stacks; cards 2 per row; pills wrap below the heading; search full width; tables scroll in cards | cards 2 per row; search `sm:w-64` | cards 5 per row |
| S4 | cards 2 per row; tabs wrap onto 3 lines; subject names `w-28` truncate; tables and wrong-answer cards scroll/wrap in the card; modal full width minus `p-4`, max height 85vh | cards 2 per row; tabs 2 lines | cards 4 per row; modal `max-w-2xl` centred |
| S5 | cards 2 per row; table scrolls in its card | idem | cards 4 per row |
| S6 | filter card stacks, selects full width; legend wraps, note under the dots | selects side by side | idem |
| S7 / S8 | centred card / provisional card full width | idem | idem |

---

## 11. Non-functional requirements

| ID | Requirement | Global |
|---|---|---|
| NFR-M11-01 | Performance: #3 answers from pre-aggregated per-(school, week) and per-student counters exposed by the M02/M05 datasets (never iterating the 472,371 answers per request); S2 interactive within the NFR-01 budget at 1280 and 375. | NFR-01 |
| NFR-M11-02 | Determinism: generated users, answers and weekly cells are seeded by stable hashes; the same figures on every run and viewport. | D11 |
| NFR-M11-03 | Privacy: only fictitious names/e-mails; screenshots and fixtures never contain live personal data; students are minors (SEC-M11-03/04). | NFR-05 |
| NFR-M11-04 | Accessibility replicates live (D10): tabs, pills and cards are the live button/`div` controls with no added ARIA; the chart has no text alternative (as live). | NFR-02 |
| NFR-M11-05 | Timers: the auto-refresh uses the page clock so that E2E can advance it; reload re-runs the route data load (full page reload acceptable). | — |
| NFR-M11-06 | Chart.js 4 with the exact config of FR-22; the canvas resizes inside its `h-64` card. | NFR-RESP-10 |
| NFR-M11-08 | Readability: content text on S1–S5 is at least 12px (DV-M11-23); icons unchanged. | NFR-02 |
| NFR-M11-07 | Locale: numbers with "," grouping as live; dates Asia/Kuala_Lumpur; the S3 subscription date keeps the live English month. | NFR-08 |

### 11.1 Security notes (backend phase)

| ID | Live risk (replicated with dummy data) | Backend requirement |
|---|---|---|
| SEC-M11-01 | CSRF token placed in a GET URL by the S2 filter form (`_token` in the query; appears in history, logs, referrers). | Never put CSRF tokens in GET forms; filters need no token. |
| SEC-M11-02 | IDOR: the school segment of `/sekolah/{id}/pelajar/{id}` and `/guru/{id}` is not checked, and any student/teacher opens by id. | Verify the person belongs to the school and that the viewer may see that school. |
| SEC-M11-03 | Minors' names and e-mail addresses are shown in teacher/admin views (S1 lists, S3/S5 tables, S4/S5 headers) and platform-wide on a `/guru` route. | Scope data to the viewer's classes/school; minimise e-mails; PDPA. |
| SEC-M11-04 | PDF/CSV exports of engagement data of minors (content unknown) via GET links. | Role check, data minimisation, audit log, no caching, rate limit. |
| SEC-M11-05 | Student names interpolated unescaped into Alpine expressions (script-injection vector; D-M11-18). | Escape/encode all user data in script contexts (rebuild passes data, DV-M11-18). |
| SEC-M11-06 | `/guru/monitoring*` renders platform-wide monitoring under a teacher prefix; teacher scope unknown. | Enforce role-based scoping server-side. |
| SEC-M11-07 | Anomaly flags ("corak seperti automasi") label identifiable minors. | Restrict to admins; document the rule; allow review. |
| SEC-M11-08 | Every 5 minutes the full page (personal data) reloads automatically. | Cache headers `no-store`; consider data-only refresh. |

---

## 12. E2E test scenarios

Every scenario runs on the three Playwright projects mobile 375×812, tablet 768×1024, desktop 1280×800 (master SRS §10) unless a step is width-specific, in which case the step states the width and the scenario still runs on all three. **Provisional** = asserts INFERRED/PROPOSED/UNVERIFIED behaviour (teacher view, populated states, exports, provisional pages); kept tagged `@provisional` until the teacher account / export observation (OQ-M11-01…03).

| ID | Scenario | FR | AC |
|---|---|---|---|
| E2E-M11-01 | Admin: "Portal Guru" group present but hidden; S1, S6, S2 headers/subtitles/tab titles; S3/S4/S5 of 8080 headers, breadcrumb targets and tab titles; S1/S6 user shell, S2–S5 admin shell on `/guru/…`. | 01, 02, 03, 04 | 01.2, 01.3, 01.4, 01.5 |
| E2E-M11-02 | Admin: "Monitoring" active in the sidebar (1280) and in "Lagi" (375) on `/guru/monitoring`, `/guru/monitoring/sekolah/8080`, `/admin/monitoring`. | 05 | 02.1, 02.2 |
| E2E-M11-03 | **Provisional.** Guest: every M11 route → `/login`. | 06 | 03.1 |
| E2E-M11-04 | Admin: 404 page (exact copy) for unknown school/student/teacher ids, `/guru/laporan/4`, `/guru/perbandingan`. | 07 | 03.2 |
| E2E-M11-05 | Admin: `/guru/monitoring/sekolah/940/pelajar/2008` renders Student A with the breadcrumb "school 940". | 09 | 03.3 |
| E2E-M11-06 | **Provisional.** Teacher: S1 and S6 render with classes 2001 and 2002 in "Kelas"; `/guru/monitoring` renders; a school link to `/admin/monitoring/sekolah/940` redirects to the M01 landing page. | 08 | 03.4 |
| E2E-M11-07 | Admin S1: "Tapis:", select only "Semua Kelas", pills with "30 Hari" active; `?range=999` → "30 Hari" active and "30 hari lepas". | 10, 11 | 04.1, 04.2 |
| E2E-M11-08 | **Provisional.** Teacher S1: choose class "5 MARIKH - Kimia" on `?range=7` → URL `?range=7&classroom_id=2001`, select kept; click "3 Bulan" → `?range=90`, select "Semua Kelas". | 10, 11 | 04.3 |
| E2E-M11-09 | Admin S1: cards "0%" "0 / 0 pelajar" (no red line) ×2, "0" "30 hari lepas", "-%"; `range=7`/`90` card labels. | 12, 13, 14, 15, 16 | 05.1, 05.4 |
| E2E-M11-10 | **Provisional.** Teacher S1 "Semua Kelas" 30 days: 100% "8 / 8 pelajar" (no red line), 100% 8 / 8, 14, 46%; class 2001 and 2002 the same; `range=7` total 7. | 12, 13, 14, 15, 16 | 05.2, 05.3, 05.4 |
| E2E-M11-11 | Admin S1: open/close/switch panels with ring; login and latihan panels "(0)" copy; `range=7` activity panel title and 7 zero tiles; score panel 5 bars "-%", no Permainan. | 17, 18, 19, 20, 21 | 06.1, 06.2, 06.3 |
| E2E-M11-12 | **Provisional.** Teacher S1 panels: tiles 14/0/0/0/0/0/14; score 46% / -% / -% / -% / -%; login and latihan panels "(0)" with the success copy. | 18, 20, 21 | 06.4 |
| E2E-M11-13 | Admin S1 chart: 30 labels "27/08"…"25/09", all 0, y from 0 step 1, no legend (Chart.js config read from the instance). | 22 | 07.1 |
| E2E-M11-14 | **Provisional.** Teacher chart values 15/09 4, 18/09 3, 22/09 4, 24/09 3, 0 elsewhere; tooltip "{n} aktiviti". | 22 | 07.2 |
| E2E-M11-15 | Admin S1: "Belum ada aktiviti" and "Semua pelajar sudah aktif buat latihan!"; at 375 with the long-e-mail fixture no page overflow and the e-mail truncates. | 23, 24, 25 | 08.1, 08.3 |
| E2E-M11-16 | **Provisional.** Teacher S1 lists: "Belum Pernah Buat Latihan" empty copy; "Paling Aktif" 8 rows, Murid Demo 01 and 02 first with "3 aktiviti". | 23, 24 | 08.2 |
| E2E-M11-17 | S2 guide: six tiles text/anchors, tip; ✕ → hidden + button, persists after reload; show again persists; legend line with Kritikal (DV-M11-03); tile click scrolls to `#section-mingguan`. | 26, 27, 28, 29 | 09.1, 09.2, 09.3, 09.4 |
| E2E-M11-18 | S2 filters: options and defaults, no Reset; choose "7 Hari" + "Tapis" → `/admin/monitoring?period=7d&state=&tahap=&_token=…` with preselection and Reset; "Refresh" re-submits; selects ≥ 36px at 375 and the wrap rows. | 30, 32, 33 | 10.1, 10.2, 10.3, 10.4 |
| E2E-M11-19 | S2 export hrefs for no query, `period=7d`, `period=3m`, `state=Selangor&tahap=Kritikal`. | 31 | 11.1, 11.2 |
| E2E-M11-20 | **Provisional.** CSV link starts a download named `monitoring-penglibatan.csv` with 33 data lines (default). | 31 | 11.3 |
| E2E-M11-21 | Auto-refresh with the page clock: "5:00" → "4:59"; pause stops, play resumes; at 0:00 the page reloads and shows "5:00". | 34 | 12.1, 12.2, 12.3 |
| E2E-M11-22 | S2 KPIs default (57 · 4,158 · 1,462 · 35.2% · 472,371 · 323.1 · 522 · 277 · 53.1%), `period=7d` (57 · 4,158 · 44 · 1.1% · 7,651 · 173.9 · …) and `period=3m` (… 298 · 7.2% · 86,697 · 290.9 · …). | 35, 36, 49, 50, 85 | 13.1, 13.2, 13.3 |
| E2E-M11-23 | S2 `state=Selangor&tahap=Kritikal` KPIs (28 · 4,042 · 1,424 · 35.2% · 460,858 · 323.6 · 517 · 273 · 52.8%); `state=Johor` KPIs (7 · 84 · 37 · 44% · 10,418 · 281.6 · 2 · 1 · 50%); `state=Kelantan&tahap=Cemerlang` KPIs, "0 sekolah" ×2, empty bodies without message, weekly headers only. | 35, 36, 49, 51 | 13.4, 13.5, 17.2 |
| E2E-M11-24 | S2 student table: "33 sekolah", 33 rows in the §6.7 order with ids, values and % (row 6 = 8080 184/174/94.6%), tahap counts 8/7/1/2/15, pill colours, bar variants (3% minimum), "- · {negeri}" for 8300/9681/9801, legend, first link `/admin/monitoring/sekolah/940`; headers upper case by CSS; table scrolls in its card at 375. | 37, 38, 39, 50 | 14.1, 14.2, 14.5 |
| E2E-M11-25 | S2 teacher table: "13 sekolah", rows of AC-14.3, legend with "Tiada Guru (0 daftar)"; `state=Selangor&tahap=Kritikal` → student table 2 rows, teacher table 10 rows. | 40, 41, 42, 49 | 14.3, 14.4 |
| E2E-M11-26 | Weekly table: columns M1…M32, 33 rows, footer week list, M1 `title`; trend counts 2/4/27; no-answer rows "-" and Best "-"; Selangor filter 21 rows 2/4/15. | 43, 44, 49 | 15.1, 15.2, 15.4 |
| E2E-M11-27 | Weekly cells of 8080 (observed): M12 2,637 green, M13 315 red, M16 "-", M17 352 green, M18 37,748 green + amber ring, M28 150 green, M29 150 **blue**, M32 552 red, Best "M18 37,748", Trend "Menurun"; 8090 M1 268 blue; 8284 M32 5 green, Trend "Meningkat". | 43 | 15.3 |
| E2E-M11-28 | Default lists: Terbaik 940, 987, 995; Perhatian 18 items in order (8087 Rendah, 8102 and 8107 Kritikal, then the 15 Tiada schools) with the Nota suffixes on 8277 (16) and 8300 (1); Cadangan 17 tiles 2/4/2/9 by template. | 45, 46, 47 | 16.1, 16.2, 16.3 |
| E2E-M11-29 | `period=7d` lists (1 / 32 / 31; Terbaik 8284; first Perhatian "… — 12/184 pelajar aktif (6.5%). Tahap rendah."); `period=30d` (1 / 32 / 31; "… — 18/184 … (9.8%)"); `period=3m` (2 / 29 / 26); Kelantan+Cemerlang → only the empty card. | 45, 46, 47, 48 | 16.4, 16.5 |
| E2E-M11-30 | `/guru/monitoring` and `/admin/monitoring` show identical KPIs, tables and lists. | 52 | 17.1 |
| E2E-M11-31 | S3 8080: header (kod, Selangor, "Active — sehingga 12 May 2027", "Cemerlang — 89.7%"), cards 184/165/53,494/34/34, two-sentence warning 19/9; S3 940: "Tiada langganan", "Cemerlang — 100%", 1/1/10/0/0, pills (1), no warning, "Senarai Guru (0)" + empty text. | 53, 54, 57, 60 | 18.1, 18.2 |
| E2E-M11-32 | S3 8080 students: pills "Semua (184)", "● Aktif (165)", 184 rows, headers upper case, Student A (2008) row values and link, faded "Belum login" row → `/admin/kirkpatrick/pelajar/{id}`, "T{n}" only, flag badges and titles; pill filters Aktif (165) → 165 rows, none "ditapis" (DV-M11-21), Login sahaja → 4, Belum login → 8 (6 + 2 answered without login), Semua → 184; search "zzzz" → no rows, header stays; part of Student B's name → matching rows. | 55, 56, 57, 58 | 19.1, 19.2, 19.3, 19.4 |
| E2E-M11-33 | S3 8080: "Nur'ain Demo" row filters with pills and search; no console error. | 61 | 19.5 |
| E2E-M11-34 | S3 8080 teachers: "Senarai Guru (34)", pills, 34 "Pernah login" rows with dates and S5 links; "Belum Login" → no row, no message. | 59 | 20.1, 20.2 |
| E2E-M11-35 | S4 Student A: header "· T5" and last activity; cards 71/53/18/74.6% green; tab chips 18 / 0; subject rows and colours; Tajuk: the 18 observed rows of §6.7 in order with %, counts and badges (subject labels upper case by CSS). | 62, 63, 64, 65, 66 | 21.1, 21.2, 21.3 |
| E2E-M11-36 | S4 Student B 195/150/45/76.9%; Student C 265/168/97/63.4% amber and "· T5". | 62, 63 | 21.4 |
| E2E-M11-37 | S4 Student A "Senarai Soalan": heading, 20 rows, row 1 values, "Papar lagi 20 (20/71)" → "(40/71)" → all 71 and no button; row 1 modal content, ✕ and outside click close; row 5 modal "Betul". | 67, 71 | 22.1, 22.2 |
| E2E-M11-38 | **Provisional.** Fixture question without options → modal "Pilihan jawapan telah dipadam dari sistem.". | 71 | 22.3 |
| E2E-M11-39 | S4 Jawapan Salah: Student A heading and card 1 content; Student C 97 cards, no "Papar lagi". | 68 | 23.1, 23.2 |
| E2E-M11-40 | **Provisional** (recomputed values, DV-M11-20). S4 Gap tab: Student B → only the gap panel visible, gap cards with severity pills and counts; Student A → "Tiada topik lemah dikesan!" + "Semua topik yang dicuba mempunyai ketepatan melebihi 60%." + untried chips (no answered subject listed). | 64, 69 | 24.1, 24.2 |
| E2E-M11-41 | S4 Pemerhatian sentences for Students A and B, visible under every tab. | 70 | 24.3 |
| E2E-M11-42 | S5 Teacher T: header, cards 184/174/94.6%/10, 184 rows by name with Student A values and link, faded "Login sahaja" row, the three Cadangan sentences (8 / 3 / 174); table scrolls in its card at 375. | 72, 73, 74, 75, 50 | 25.1, 25.2, 25.3 |
| E2E-M11-43 | S6 admin: 32 subject options in A→Z order, "Semua Kelas" only, legend, empty card, no Reset; choose "Bahasa Melayu" → URL `?subject_id=1&classroom_id=`, selection kept, Reset shown; `?classroom_id=228` empty. | 76, 77, 78, 79 | 26.1, 26.2 |
| E2E-M11-44 | **Provisional.** Teacher S6 class 2001: 8 rows, % betul and band colours, discrimination labels. | 80 | 26.3 |
| E2E-M11-45 | **Provisional.** `/guru/perbandingan-kelas` (+ `?classroom_id=4`) as admin and teacher: no 500; header and PROPOSED empty card. | 81 | 27.1 |
| E2E-M11-46 | Admin `/guru/laporan-mingguan-kelas`, `?week=1`, `/4` → 403 page with exact copy and tab title. | 82 | 28.1 |
| E2E-M11-47 | **Provisional.** Teacher `/guru/laporan-mingguan-kelas` → provisional stand-in. | 83 | 28.2 |
| E2E-M11-48 | Responsive sweep: every M11 screen at the three widths has `scrollWidth` ≤ viewport; S1 grid columns per width; S4 tabs wrap at 375 and the modal width; on S1–S5 no text node inside `main` has a computed font size below 12px (DV-M11-23). | 25, 84 | 29.1, 29.2, 29.3 |
| E2E-M11-49 | **Provisional.** Teacher menu: "Portal Guru" displayed with the five M11 links and icons. | 01 | 01.1 |
| E2E-M11-50 | S3 8082: "Senarai Guru (68)", pill "Belum Login" → 17 rows with "Belum login"; "Pernah Login" → 51. | 59 | 20.2 |

| E2E-M11-51 | S2 `period=30d`: KPIs 57 · 4,158 · 89 · 2.1% · 22,207 · 249.5 · 522 · 277 · 53.1%; first rows 8284 100%, 8080 18/184 9.8%; "Tempoh" shows "30 Hari"; export links carry `?period=30d`. | 35, 36, 49, 31 | 13.6, 11.2 |
| E2E-M11-52 | S3 variants and per-screen values: 8102 "Cancelled — sehingga 12 May 2027" and 8107 "Expired — sehingga 22 May 2026" (`bg-slate-100 text-slate-500`); 8087 and 10220 one-sentence warnings ("⚠ 3 akaun …" / "⚠ 1 akaun …" without "daripadanya dikecualikan"); 8765 cards 16 / 1 / 209 and pill "Rendah — 6.3%" while S2 shows 16 / 6 / 37.5%; 8087 S3 "Guru Pernah Login" 13 vs S2 12. | 53, 57, 86 | 18.3, 18.4, 18.5 |
| E2E-M11-53 | The seed has the fixture accounts at SMK DEMO 900001 (pelajar 2, students 3001–3008, guru 5; no generated teachers at 900001). S2 default, `period=7d` and `state=Selangor&tahap=Kritikal` show no student-table row, teacher-table row, list item or weekly row for school 900001 and no link to `/admin/monitoring/sekolah/900001`; the KPIs stay 57 · 4,158 · 1,462 · 35.2% · 472,371 · 323.1 · 522 · 277 · 53.1%. The teacher's own S1 still shows 3001–3008. A direct GET `/guru/monitoring/sekolah/900001` renders the S3 page of SMK DEMO (not 404). | 38, 41, 85 | 14.6 |
| E2E-M11-55 | **Provisional.** `/guru/monitoring/sekolah/8080/pelajar/4644` and `/admin/monitoring/sekolah/8080/pelajar/4664` render the 0-answer S4 state (FN-4.2.11); on S3 8080 the rows of 4664 ("Login sahaja") and 4644 ("Belum login") are faded and link to `/admin/kirkpatrick/pelajar/4664` and `/4644`. | 87, 58 | 21.5 |
| E2E-M11-54 | `mock.addRuntimeSchool()` creates a school through the M02 contract (id ≥ 10,301, Selangor) with one T5 student who answers 5 questions today and one teacher who logs in; S2 default then shows it in the student table (1/1 100%, Cemerlang, ordered after the 1/1 rows with lower ids) and the teacher table (1/1), "Jumlah Sekolah" 58, "Pelajar T4/T5" 4,159, "Pernah Aktif" 1,463, "Soalan Dijawab" 472,376, "Guru Berdaftar" 523, and its weekly row with M32 = 5; the link opens its S3 page. | 38, 41, 85 | 14.7 |

Provisional: E2E-M11-03, 06, 08, 10, 12, 14, 16, 20, 38, 40, 44, 45, 47, 49, 55 (15 of 55). E2E-M11-22/24/26/28/30/51 and 53 assert the observed S2 figures (non-provisional; BR-M11-34); E2E-54 checks that a runtime school is counted.

---

## 13. Open questions

URS §9 OQ-M11-01…08 apply unchanged. Additional SRS points:

1. **SQ-M11-01 Owner acceptance of §6.10 — closed (v1.7).** XR-M11-01…07 are delivered by M01 v1.9, M02 v1.11, M04 v1.9, M05 v1.8 and M10 v1.6; XR-M11-08 (M17 mount) is taken up when M17 is written.
2. **SQ-M11-02** (closed in v1.1) — M08 v1.7 uses the canonical ids; the teacher seed follows it.
3. **SQ-M11-03 Chapter label vs topic** (closed in v1.5: M04 v1.9 `chapterLabel` + `curriculumTopicId`). The live "chapter" label ("Sejarah Tingkatan 5 KSSM", "Operasi Set") and the Tajuk "Bab n + topic" come from different question fields; the M03/M04 mapping is INFERRED (XR-M11-05).
4. **SQ-M11-04** (moved to URS §7 DV-M11-20 in v1.1).
5. **SQ-M11-05 Three answer totals on live.** S2 KPI 472,371; Σ weekly cells 472,359 (12 answers before M1); Σ S3 "Soalan Dijawab" 471,372 (8090 −976, 8106 −10, 8765 −1 against their weekly sums). Replicated per screen (BR-M11-32); the cause is unobservable.
