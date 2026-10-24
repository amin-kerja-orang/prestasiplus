# M11 — Teacher Portal: Analytics & Reports — User Requirements Specification

## 0. Document control

| Field | Value |
|---|---|
| Document | URS — M11 Teacher Portal: Analytics & Reports |
| Version | 1.12 |
| Date | 2026-10-03 |
| Status | Approved (G1) — v1.10; independent audit PASS in round 3 (`docs/qa/audit/M11-audit.md`); v1.4–v1.10 apply the M11 items of the cross-module logic review batch 2 and the owner contracts (M01 v1.9, M02 v1.11, M04 v1.9, M05 v1.8, M08 v1.7, M10 v1.6) (`docs/qa/audit/cross-module-logic-M08-M11.md`) without changing any approved behaviour or observed value. |
| Author | product-analyst (agent); data model and mock API of the companion SRS by solution-architect (agent) |
| Source discovery | [M11-teacher-analytics.md](../../discovery/M11-teacher-analytics.md) (§1–§8, defects D-M11-1…18 in §8.2, §8.3 audit-lesson checklist, Q-M11-1…7, Appendices A–B); inventory [`inventory/M11/`](../../discovery/inventory/M11/) (`S1…S8-*.json`, `SHU-user-shell.json`, `SHA-admin-shell.json`, `_crawl.json`, `_summary.md`; raw states `inventory/_raw/M11/`, 57 states); masked screenshots `docs/discovery/img/M11/` (31) |
| Companion SRS | [srs/M11-teacher-analytics.md](../srs/M11-teacher-analytics.md) |
| Related | M01 v1.9 (User, 403/404 pages, guest redirect, seed accounts 1–11), M02 v1.11 (School register D11, users, subscriptions — ids integer), M03 (subjects 1–31, levels 1–11, chapters/topics), M04 v1.9 (`questions.*` repository; M11 anchors 700401–700931 with `chapterLabel`: text, options, correct answer, explanation, source, difficulty), M05 v1.8 (PracticeSession DATA-M05-01 and answer log DATA-M05-02 — the only source of activity), M08 v1.7 (`/prestasi/kelas*`, `/analitik/kelas`, `/analisa-item/*` — a different item-analysis component; designed classes 2001–2002 and students 3001–3008), M10 v1.6 (classrooms and enrolment, own classes #12 `/api/guru/classes`, the `/guru/*` guard of M10 §7 **T** endpoints), M12 (`/admin/kirkpatrick/pelajar/{id}`), M16 (tournament banner; Battle and Permainan activity), M17 (`/admin/monitoring*` — mounts the monitoring component specified here), M18 (`/amaran`), M23/global shell ([design/shells.md](../../design/shells.md), DV-SH-03) |

**Change log**

| Version | Date | Change |
|---|---|---|
| 1.12 | 2026-10-03 | **Revision history — v1.12, Session 6 second pass (Standard track; see SRS v1.12; G1 approval kept).** New **DV-M11-27** (S1 / S6 touch targets: 44 px below `lg`, live size from `lg`; precedent DV-M03-11), **DV-M11-28** (monitoring links, filters, Reset, exports and breadcrumbs follow the mount prefix; reverses the "targets" part of DV-M11-04), **DV-M11-29** (auto-refresh without a full page reload, INFERRED), **DV-M11-30** (client-side CSV, `window.print()` PDF, in-page breadcrumb, no Kirkpatrick S8 link on the Admin Sekolah alias). **DV-M11-17** extended (S2–S5 controls 44 px below `lg`, 36 px from `lg`). S1 / S6 error "Ralat berlaku. Sila cuba lagi." (PROPOSED, OQ-M11-06). FN / AC texts that quote `/admin/monitoring…` hrefs are the live values; the rebuild applies DV-M11-28 (SRS BR-M11-27). No observed value changed. |
| 1.11 | 2026-10-02 | **Revision history — v1.11, Session 6 build decisions (Standard track; see SRS v1.11).** (1) **D9: S3 cards computed from the same screen's rows** — new DV-M11-24 (8765), DV-M11-25 (answers 8090, 8106), DV-M11-26 (teacher logins 8078, 8087, 8102, 8106, 8277) supersede DV-M11-22 ("Rejected — replicate live", v1.1); FN-M11-3.8.5, US-M11-17, AC-M11-18.3 and OQ-M11-10 updated. (2) **Admin Sekolah alias (INFERRED):** FN-M11-3.8.6, US-M11-30, AC-M11-30.1–30.3; OQ-M11-11 (another school's ids → 404, decided and closed). (3) FN-M11-5.1.x S6 with a selected class uses the class's own subject (SRS BR-M11-28). (4) OQ-M11-12 lists the open owner gaps (M02, M05, M03). No observed S2 value changed; no id renumbered. Status stays Approved (G1). |
| 1.10 | 2026-09-27 | **Revision history — v1.10, XL3 round 3 R3-04** (SRS only: mode `pksk` → "Kuiz", M05 v1.12 BR-35). Status stays Approved (G1). |
| 1.9 | 2026-09-27 | **Revision history — v1.9, XL batch 3 (XL3-13,** `docs/qa/audit/cross-module-logic-M12-M18.md`). New FN-M11-4.2.11 and AC-M11-21.5: the S4 page of a student with 0 answers (PROPOSED values, no live observation), reached from the M12 pages for the 8080 students 4664 ("Login sahaja") and 4644 ("Belum login"), which M11 lists with the observed kirkpatrick links (FN-4.1.6). SRS: the 12 answers before M1 at 8765 (rows 8880 10,196, 8765 222), M16 battle and game counters, 3201–3215 at 8880 confirmed. Status stays Approved (G1). |
| 1.8 | 2026-09-26 | **Revision history — v1.8, XL round 3 residual XL2-47.** Owner references refreshed to M01 v1.9, M02 v1.11, M04 v1.9, M05 v1.8, M08 v1.7, M10 v1.6 (Related rows, status, body; the SQ-M11-03 note no longer cites M04 v1.7). No behaviour or value change. Status stays Approved (G1). |
| 1.7 | 2026-09-26 | **Revision history — v1.7, XL round 2 residual XL2-47** (`docs/qa/audit/cross-module-logic-M08-M11.md` R2.4). Cross-references refreshed to the delivered owner versions M01 v1.9, M02 v1.10, M04 v1.9, M05 v1.7, M08 v1.7, M10 v1.5; "requested" wording removed where the owners have delivered (SRS §6.1, §6.8, §6.10). No behaviour or value change. Status stays Approved (G1). |
| 1.6 | 2026-09-26 | **Revision history — v1.6, M05 v1.6 alignment** (SRS only: M05 §6.14.2 named queries; modes `mission`, `remedial`, `question_set` shown as "Kuiz"). No URS behaviour change. Status stays Approved (G1). |
| 1.5 | 2026-09-26 | **Revision history — v1.5, M04 v1.7 alignment** (SRS only: anchors 700401–700931, `chapterLabel`, `curriculumTopicId`, `questions.*`). No URS behaviour change. Status stays Approved (G1). |
| 1.4 | 2026-09-26 | **Revision history — v1.4, cross-module logic review batch 2** (`docs/qa/audit/cross-module-logic-M08-M11.md`; M11 halves). XL2-28: new DV-M11-23 (content text below 12px raised to 12px on S1–S5, as M03 DV-06b / M05 DV-11 / M08 DV-18 / M10 DV-28; icons unchanged). XL2-31: status and cross-references refreshed (M10 v1.2 exists; the `/guru/*` guard is M10 §7 **T**: teacher or admin, other roles 403 and the M01 landing page). XL2-01/03/04/07/16/18/22: SRS only (named queries of the owners, M02 v1.8 allocation, M04 label field, `/api/guru/classes`, `submittedAt`). Status stays Approved (G1). |
| 1.3 | 2026-09-25 | **Revision history — v1.3, audit round 2** (FAIL 0/1/3). AUD-M11-15: the fixture rule is an exclusion of 900001–900099 only; runtime schools (ids ≥ 10,301) and every live-range school are counted (FN-3.3.1, 3.4.2, 3.5.2; new AC-M11-14.7). AUD-M11-16: AC-13.4 Selangor answers 460,858 and the Johor KPIs added (the 12 answers before M1 are in Johor). AUD-17/18 and I4: SRS only (direct fixture URL, pinned chapter groups, E2E-53 wording). |
| 1.2 | 2026-09-25 | **Revision history — v1.2, Delivery Lead decision on OQ-M11-09 (option a).** The reserved fixture schools 900001–900099 (M02 SRS §6.15) are excluded from the platform monitoring rollups (wording corrected in v1.3: only that range is excluded) (FN-3.4.2, 3.5.2, 3.3.1; SRS BR-M11-34); fixture accounts still appear in their own views (M08, M10, M13). New AC-M11-14.6. |
| 1.1 | 2026-09-25 | **Revision history — v1.1, audit round 1** (FAIL 1 Critical / 9 Major / 4 Minor) and the discovery top-up snapshot. AUD-01: DV-M11-11 **withdrawn** — S2/S5 and S3 are two declared engagement definitions, replicated (FN-3.3.1, 3.8.2, 4.1.2, 4.3.2; AC-13.x, 14.1, 25.1). AUD-02/03/13/14: ACs use the live school ids and the snapshot values (AC-13.1–13.6, 14.1, 14.3, 15.3 observed, 16.x, 21.3). AUD-04: weekly colour rule observed (equal week = blue; FN-3.6.1; §7 note corrected). AUD-05/06: S3 pill membership and status counts observed (FN-4.1.3, 4.3.4; AC-19.3, 25.3; DV-M11-21 rejected). AUD-07: Cancelled/Expired subscription pills and the one-sentence warning (FN-4.1.1, 4.1.5; AC-18.4, 18.5). AUD-08: teacher ACs on M08 v1.4 (2001 Kimia, 2002 Sejarah, 3001–3008). AUD-09: users are rows of the M02 dataset (ids 1–6,000; Student A = 2008). AUD-10: DV-M11-08 **withdrawn** (live copy "60%", gap rule < 60%). AUD-11: FN-3.8.5 and DV-M11-22 (other S2↔S3 differences replicated). AUD-12: DV-M11-20 (recomputed gap content). D-M11-19 (top-up): DV-M11-21 approved (Aktif pill rows = its count). Coverage re-run on the extended inventory: 937/937 content elements (118 appended IDs) plus 629 shell elements, 0 unmapped; trace check 0 errors. |
| 1.0 | 2026-09-25 | First issue under D7 (fidelity), D8 (proven completeness), D9/D10 (deviation rule, accessibility and scope), D11 (virtual datasets, every count computed) and D12 (one owner per store). §6 coverage matrix generated by script from the inventory JSON: 819/819 content elements covered, 0 unmapped. 19 deviations decided (v1.0). M11 owns the monitoring component (S2–S5) that M17 mounts on `/admin/monitoring*` (Delivery Lead decision). |

**Conventions** (same as M01–M08)
- Quoted UI copy is the exact live text. English words that live shows ("Active", "Tracking A", "Battle", "Gap Analysis", "Drill-Down", "Table Pelajar", "Table Guru", "Best", "Refresh", "hands-on", "Legenda", "Reset", "Tip:") are live copy and are kept. Where CSS upper-cases a text, this is stated ("upper case by CSS").
- **OBSERVED** = seen on the live site (walk-through, inventory state, screenshot, page script). **SOURCE-DERIVED** = taken from page markup or script captured read-only, but the state itself was never rendered on live (e.g. the S4 Gap Analysis panel, which is in the DOM but never visible). **INFERRED** = the most likely live behaviour, not observed; no new UX is invented. **UNVERIFIED** = live behaviour exists but could not be observed; nothing is asserted beyond the evidence. **PROPOSED** / **PROPOSED COPY** = a value, layout or text written for the rebuild; listed in §9 for the Delivery Lead to report at G1.
- **D-M11-n** = live defect of discovery §8.2. **Q-M11-n** = discovery open question. **DV-M11-nn** = fidelity deviation (§7); anything not listed there must match live. **SEC-M11-nn** = risk in live behaviour, replicated with dummy data (SRS §11.1).
- Personal data: students are minors. Discovery masked every person, e-mail, school name and code (`<name>`, `<person>`, `<email>`, `<masked>`, `<school>`, `<kod>`, `{id}`). Only structure, counts, percentages, subject names and question text are quoted. Seeds use clearly fictitious names.
- **Admin mirror vs designed data** (SRS §6.7–§6.8): values the admin account saw on live are reproduced exactly by the D11 datasets (no invented record changes an observed figure; nothing is tuned so that totals agree). Rows that live shows but whose values were not captured are generated deterministically and labelled `observed: false`; E2E never asserts them. The teacher view uses `guru@demo.test` (canonical id 5) and the M08 v1.7 designed classes 2001–2002 / students 3001–3008 — no new overlapping ranges. Monitoring students and teachers are rows of the M02 users dataset (ids 1–6,000; Student A = 2008).

---

## 1. Overview

M11 is the teacher **analytics and reporting** area. The TRACKER lists five M11 routes plus `/prestasi/kelas` (owned by M08). The crawl found **8 screens**, because `/guru/monitoring` opens a three-level drill-down:

1. **Laporan Statistik** (`/guru/laporan`): four expandable summary cards (login, practice, activity, score) over a date range and an optional own class, a 7/30/90-day activity trend chart, and two student lists.
2. **Monitoring Penglibatan** (`/guru/monitoring`, admin layout): engagement of T4/T5 students and teachers per school — guide, filters (period, state, level of engagement), PDF/CSV export links, 5-minute auto-refresh, 9 KPI cards, a student-engagement table, a teacher-login table, weekly tracking (M1…M32) and attention/suggestion lists.
3. **Drill-down** (new routes): school detail (`/guru/monitoring/sekolah/{id}`), student detail with five tabs and a question modal (`…/pelajar/{id}`), teacher detail (`…/guru/{id}`).
4. **Analisis Item Soalan** (`/guru/analisis-item`): subject/class filter and legend; empty for the admin.
5. **Perbandingan Kelas** (`/guru/perbandingan-kelas`): HTTP 500 on live; content not observable.
6. **Laporan Mingguan** (`/guru/laporan-mingguan-kelas`): HTTP 403 for the admin; content not observable.

**Routes covered**

| # | Route | Tab title (exact live) | Shell · header title / subtitle (live) | Admin outcome (observed) |
|---|---|---|---|---|
| S1 | `/guru/laporan` (`?range=7\|30\|90&classroom_id=`) | "Laporan Statistik - Portal Guru" | SHU · "Laporan Statistik" / "Pantau penglibatan dan prestasi pelajar" | 200 |
| S2 | `/guru/monitoring` (`?period=&state=&tahap=`) | "Monitoring Penglibatan Sekolah - Admin" | SHA · "Monitoring Penglibatan" / "Pantau penglibatan sekolah & pelajar T4/T5 dalam platform" | 200 |
| S3 | `/guru/monitoring/sekolah/{id}` | "{sekolah} - Monitoring" | SHA · "Detail Sekolah" + breadcrumb "Monitoring" / "{sekolah}" | 200; unknown id 404 |
| S4 | `/guru/monitoring/sekolah/{id}/pelajar/{id}` | "{nama} - Detail Pelajar" | SHA · "Detail Pelajar" + breadcrumb "Monitoring" / "{sekolah}" / "{nama}" | 200; unknown id 404 |
| S5 | `/guru/monitoring/sekolah/{id}/guru/{id}` | "{nama} - Detail Guru" | SHA · "Detail Guru" + breadcrumb as S4 | 200; unknown id 404 |
| S6 | `/guru/analisis-item` (`?subject_id=&classroom_id=`) | "Analisis Item Soalan - Portal Guru" | SHU · "Analisis Item Soalan" / "Kenal pasti soalan yang sukar dan indeks diskriminasi" | 200 (always empty) |
| S7 | `/guru/perbandingan-kelas` | "500 - Ralat Pelayan \| PRESTASIPLUS" | none (standalone error page) | **500** (also `?classroom_id=4`) |
| S8 | `/guru/laporan-mingguan-kelas` | "403 - Akses Ditolak \| PRESTASIPLUS" | none (standalone error page) | **403** (also `?week=1`, `/4`) |

Other access outcomes (states of the screens above): `/guru/laporan/4`, `/guru/analisis-item/1`, `/guru/perbandingan` → 404; unknown school/student/teacher ids → 404; `/guru/monitoring/sekolah/940/pelajar/{id of a student of school 8080}` → 200 showing that student (school segment not checked, D-M11-10, replicated, SEC-M11-02); `/guru/laporan?range=999` → 200 with "30 Hari" active.

**Cross-module ownership (Delivery Lead decision).** The monitoring tree S2–S5 renders **the same templates** as M17 `/admin/monitoring*` (identical normalised markup length on both prefixes, discovery §1.2). **M11 owns the shared monitoring component**; it is specified once here and mounts on both `/guru/monitoring*` (M11) and `/admin/monitoring*` (M17, which will reference this document). Every live link inside the component — filter form, "Reset", "Refresh", PDF/CSV, school/student/teacher links, breadcrumbs — points to the **`/admin/…` twin**; the rebuild replicates that exactly (DV-M11-04 rejected). `/guru/analisis-item` (S6) is **a different component** from M08 `/analisa-item/*` (S9–S11) with different rules and legends; both are kept (DV-M11-09). M11 references, and does not re-specify, `/prestasi/kelas*` and `/analitik/kelas` (M08), `/amaran` (M18) and `/admin/kirkpatrick/pelajar/{id}` (M12).

---

## 2. Actors

| Role | Involvement in M11 | Verified |
|---|---|---|
| Admin | Every screen. S1/S6 in the user-portal shell with no class of its own (class selects hold only "Semua Kelas"); S2–S5 in the admin-panel shell with platform-wide data (57 schools); S7 500; S8 403. The "Portal Guru" drawer group that holds the M11 links is present in the DOM but `display:none` for the admin. | OBSERVED (admin account) |
| Guru (teacher, canonical id 5) | Owner persona: S1 and S6 for own classes; the "Portal Guru" menu with the M11 links; S2–S5, S7 and S8 behaviour for a teacher is not observable (Q-M11-1, Q-M11-2). | INFERRED (no teacher account) |
| Admin Sekolah, PPD, JPN | No evidence of access to `/guru/*`; the M10 guard (M10 §7 **T** endpoints: teacher or admin) refuses other roles with 403 and the M01 landing page. | INFERRED (rule owned by M10) |
| Pelajar, Ibu Bapa, Penaja | Subjects of the data (students are minors); no access evidence. | INFERRED |
| Guest | Redirected to `/login` (M01 pattern, as every authenticated route). | INFERRED (not probed in M11 discovery) |

Correction for URS.md §6: a `/guru/*` route can render the **admin-panel** layout (S2–S5) — for the admin account at least.

---

## 3. Functional breakdown (Epic → Feature → Function)

Built from the element inventory (`docs/discovery/inventory/M11/`) and the Function catalogue used by the §6 script. "EL" lists inventory element IDs (prefix `EL-M11-`). Functions with EL "—" are behaviours (access, data rules, unobservable states) with no element of their own.

### EP-M11-1 — Navigation, shells and access

**FT-M11-1.1 — Menu entries, shells and headers**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M11-1.1.1 | User-portal "Portal Guru" group entries for M11: under "PENILAIAN" `fa-chart-pie` "Laporan" → `/guru/laporan`; under "ANALITIK" `fa-binoculars` "Monitoring" → `/guru/monitoring`, `fa-chart-pie` "Analisis Item" → `/guru/analisis-item`, `fa-balance-scale` "Perbandingan Kelas" → `/guru/perbandingan-kelas`, `fa-calendar-week` "Laporan Mingguan" → `/guru/laporan-mingguan-kelas` (group headings upper case in the source). The group is `display:none` for the admin (as live); for a teacher it is shown (INFERRED). The group's other items belong to M08 (Headcount, Prestasi), M18 (Amaran Awal) and M12 (Kirkpatrick) | SHU-259, 260, 263, 265–267, 276–278 | Guru (INFERRED); Admin hidden (OBSERVED) | OBSERVED / INFERRED |
| FN-M11-1.1.2 | Header title/subtitle and tab title per screen, all live and correct (no title deviation needed; DV-SH-03 changes nothing here): S1 "Laporan Statistik" / "Pantau penglibatan dan prestasi pelajar"; S6 "Analisis Item Soalan" / "Kenal pasti soalan yang sukar dan indeks diskriminasi" (subtitle truncated with an ellipsis at 1280, as live); S2 "Monitoring Penglibatan" / "Pantau penglibatan sekolah & pelajar T4/T5 dalam platform"; tab titles as §1 | SHU-136, 137, 373, 374; SHA-118, 119 | All | OBSERVED |
| FN-M11-1.1.3 | Drill-down header with breadcrumb: S3 "Detail Sekolah" + "`fa-arrow-left` Monitoring" → `/admin/monitoring` / "{sekolah}"; S4 "Detail Pelajar" + "Monitoring" → `/admin/monitoring` / "{sekolah}" → `/admin/monitoring/sekolah/{id}` / "{nama}"; S5 "Detail Guru" + the S4 pattern | SHA-197–200, 221–224, 250, 253 | Admin; Guru INFERRED | OBSERVED |
| FN-M11-1.1.4 | Shell by screen: S1, S6 in the user-portal shell (SHU); S2–S5 in the admin-panel shell (SHA: "Panel Pentadbir" sidebar, server-status chips) even on `/guru/*`; S7, S8 and 404 pages standalone. What a teacher gets on S2–S5 is UNVERIFIED (Q-M11-1); the prototype renders the same shell (provisional) | — | All | OBSERVED (admin) / INFERRED (teacher) |
| FN-M11-1.1.5 | Admin-panel sidebar item "ANALITIK › Monitoring" (`/admin/monitoring`) and its "Lagi" drawer twin are shown **active** on `/guru/monitoring*` as on `/admin/monitoring*` (DV-M11-12; live shows no active item on the `/guru` prefix) | SHA-013, 144 | Admin | OBSERVED + DV-M11-12 |

**FT-M11-1.2 — Access and error pages**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M11-1.2.1 | Every M11 route requires a session; a guest is sent to `/login` (M01 pattern) | — | Guest | INFERRED |
| FN-M11-1.2.2 | Global 404 page (M01): "404", "🔍", h1 "Halaman Tidak Dijumpai", "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?", "Halaman Utama" → `/`, "Mula Latihan" (target per M01 DV-02; live `/latih-tubi`), "PRESTASIPLUS"; for unknown ids on S3/S4/S5 and for `/guru/laporan/{x}`, `/guru/analisis-item/{x}`, `/guru/perbandingan` | S3-068–074; S4-133–139; S5-034–040 | All | OBSERVED + M01 DV-02 |
| FN-M11-1.2.3 | Role access: the admin opens every `/guru/*` M11 route (OBSERVED 200 except S7/S8); a teacher opens S1 and S6 (INFERRED); a teacher's access to S2–S5 and to their `/admin/…` link targets is UNVERIFIED (Q-M11-1): the prototype lets the teacher open `/guru/monitoring*`, while `/admin/monitoring*` follows the M17/M01 rule for non-admins (redirect to the M01 landing page, INFERRED) — all teacher steps provisional; other roles follow the `/guru/*` guard of M10 §7 (**T**: teacher or admin; other roles 403 and the M01 landing page) | — | All | OBSERVED / INFERRED |
| FN-M11-1.2.4 | The school segment of `/sekolah/{id}/pelajar/{id}` and `/sekolah/{id}/guru/{id}` is not checked: a student or teacher of another school opens, with the breadcrumb naming the URL's school (replicated, SEC-M11-02; DV-M11-10 rejected) | — | Admin | OBSERVED |

### EP-M11-2 — Laporan Statistik (S1 `/guru/laporan`)

**FT-M11-2.1 — Filter**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M11-2.1.1 | Filter card "`fa-filter` Tapis:" (indigo-500) with GET form `#filterForm` → `/guru/laporan`: hidden `range` (current value) and select `classroom_id` (`onchange="this.form.submit()"`, `sm:w-64`, `rounded-xl`, current value preloaded): "Semua Kelas" ('') + the viewer's own classes (admin: none → only "Semua Kelas"; teacher: 2001, 2002 INFERRED "own classes"). Changing the class keeps the range | S1-004–008 | Admin; Guru | OBSERVED / INFERRED (options for a teacher) |
| FN-M11-2.1.2 | Range pills (links, `bg-slate-100` track): "7 Hari" → `?range=7`, "30 Hari" → `?range=30`, "3 Bulan" → `?range=90`; active pill `bg-white shadow-sm text-indigo-700`, inactive `text-slate-500 hover:text-slate-700`; default 30; unknown value → 30 ("30 Hari" active). The pills link to `?range=N` only, so switching range **drops `classroom_id`** (working-but-odd, replicated) | S1-009–011 | Admin; Guru | OBSERVED |

**FT-M11-2.2 — Summary cards and expanded panels**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M11-2.2.1 | **One student population for the whole page** (DV-M11-01): the students of the viewer's own classes — all own classes for "Semua Kelas", or the selected class. The admin owns no class, so its population is empty and every card, panel and list shows its zero/empty state. Activity figures use that population's practice sessions (M05 store) inside the range | — | Admin; Guru | DV-M11-01 (live contradictory, D-M11-1) |
| FN-M11-2.2.2 | Card "Pernah Login" (`fa-sign-in-alt` on blue-500; blue-50→blue-100, border blue-200): "{p}%" (integer), "**{login}** / {n} pelajar", red-500 "`fa-exclamation-circle` {n − login} belum pernah login" shown only when > 0 (INFERRED from the zero case), "Klik untuk lihat senarai" | S1-012 | Admin; Guru | OBSERVED + DV-M11-01 |
| FN-M11-2.2.3 | Card "Pernah Buat Latihan" (`fa-pencil-alt` emerald-500): "{p}%", "**{practised}** / {n} pelajar", "Klik untuk lihat senarai" | S1-013 | Admin; Guru | OBSERVED |
| FN-M11-2.2.4 | Card "Jumlah Aktiviti" (`fa-chart-bar` purple-500): total activities in the range; line "{range} hari lepas" ("7 hari lepas", "30 hari lepas", "90 hari lepas"); a chip row that is empty on live when the total is 0 (its content when > 0 is UNVERIFIED and not rendered by the prototype); "Klik untuk lihat pecahan" | S1-014, 070, 073 | Admin; Guru | OBSERVED / UNVERIFIED (chips) |
| FN-M11-2.2.5 | Card "Skor Purata" (`fa-star` amber-500): "{p}%" or "-%" when no scored activity; chip row as FN-2.2.4 (UNVERIFIED); "Klik untuk lihat pecahan" | S1-015 | Admin; Guru | OBSERVED |
| FN-M11-2.2.6 | Expand behaviour (`x-data="{ expanded: null }"`): a card click opens its panel below the cards (`x-collapse`) and closes any other; clicking the same card again closes it; the open card gets `ring-2 ring-{colour}-400` and its chevron rotates 180°. Cards: `grid-cols-2 lg:grid-cols-5` (4 cards, one empty slot at `lg`) | S1-012–015 (click targets) | Admin; Guru | OBSERVED |
| FN-M11-2.2.7 | Panel login: h4 "`fa-user-slash` Pelajar Belum Pernah Login ({n})"; when 0 → "`fa-check-circle` Semua pelajar sudah pernah login!" (emerald-600); when > 0 → the students (row layout of FN-2.4.2, INFERRED) | S1-016–018 | Admin; Guru | OBSERVED (0) / INFERRED (> 0) |
| FN-M11-2.2.8 | Panel latihan: h4 "`fa-moon` Pelajar Belum Pernah Buat Latihan ({n})"; when 0 → "Semua pelajar sudah aktif buat latihan!"; when > 0 → the students (INFERRED, as FN-2.2.7) | S1-019–021 | Admin; Guru | OBSERVED (0) / INFERRED (> 0) |
| FN-M11-2.2.9 | Panel aktiviti: h4 "`fa-chart-pie` Pecahan Aktiviti ({range} Hari Lepas)" ("(7 Hari Lepas)", "(30 Hari Lepas)", "(90 Hari Lepas)"); 7 tiles (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-7`): "Kuiz" (`fa-question-circle`, indigo-600), "Struktur" (`fa-list-ol`, teal-600), "Latih Tubi" (`fa-dumbbell`, emerald-600), "Tracking A" (`fa-crosshairs`, blue-600), "Battle" (`fa-bolt`, rose-600), "Permainan" (`fa-gamepad`, amber-600), "Jumlah" (`fa-sigma`, purple-700) = sum of the six (INFERRED) | S1-022–037, 071, 074 | Admin; Guru | OBSERVED |
| FN-M11-2.2.10 | Panel skor: h4 "`fa-chart-bar` Pecahan Skor Purata"; 5 bar cards "Kuiz", "Struktur", "Latih Tubi", "Tracking A", "Battle" (**no Permainan**, as live), each "{p}%" or "-%" with a bar of width p%; live shows only the empty state ("-%" red-500, red-400 bar at 0%); band colours for values > 0 are UNVERIFIED (prototype: green ≥ 70, amber 50–69.9, red < 50, INFERRED from the S4 accuracy bands) | S1-038–049 | Admin; Guru | OBSERVED / INFERRED (colours) |

**FT-M11-2.3 — Trend chart**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M11-2.3.1 | Card "`fa-chart-line` Trend Aktiviti" (indigo-500) with the range label "{range} hari lepas" at the right; `h-64` Chart.js line chart: one dataset "Aktiviti" = activities per day for the last `range` days, labels "dd/mm" from today − (range − 1) to today (7, 30 or 90 labels); `borderColor #6366f1`, fill `rgba(99, 102, 241, 0.1)`, tension 0.3, point radius 2 (hover 5), border width 2; no legend; tooltip background #1e293b, label "{y} aktiviti"; x grid hidden, ticks 10px, at most 15 ticks; y from 0, step 1, ticks 10px | S1-050–052, 072, 075 | Admin; Guru | OBSERVED (config) |

**FT-M11-2.4 — Student lists**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M11-2.4.1 | Card "`fa-trophy` Paling Aktif" (amber-500): empty → "Belum ada aktiviti" (slate-400); populated list UNVERIFIED — prototype (PROPOSED layout, provisional): up to 10 students by activity count in the range (descending, then name A→Z), each row as FN-2.4.2 with the right label "{n} aktiviti" (PROPOSED COPY) | S1-053–055 | Admin; Guru | OBSERVED (empty) / PROPOSED (populated) |
| FN-M11-2.4.2 | Card "`fa-moon` Belum Pernah Buat Latihan" (slate-400): the first 10 students of the population with no practice session (INFERRED cap and order: name A→Z); each row: avatar (initials image, background #94a3b8), name (semibold, truncate), e-mail (10px slate-400, truncates per DV-M11-16), right label "Belum pernah login" (10px red-400) when the student never logged in (the label for a student who logged in but never practised is UNVERIFIED; no seed case); rows after the first `border-t border-slate-50`. Empty list → "Semua pelajar sudah aktif buat latihan!" (PROPOSED reuse of the observed latihan-panel copy; DV-M11-01) | S1-056–069 | Admin; Guru | OBSERVED + DV-M11-01 |
| FN-M11-2.4.3 | Layout: "Paling Aktif" and "Belum Pernah Buat Latihan" side by side from `md` (`grid md:grid-cols-2`), stacked below; grid items may shrink (`min-w-0`) so a long e-mail truncates instead of widening the page (DV-M11-16) | — | All | OBSERVED + DV-M11-16 |

### EP-M11-3 — Monitoring Penglibatan (S2; shared component, mounted on `/guru/monitoring` and `/admin/monitoring`)

**FT-M11-3.1 — Guide**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M11-3.1.1 | Guide card (indigo-50→blue-50) h3 "`fa-book-open` Panduan Monitoring Penglibatan" with close ✕ (`fa-times`, top right) → hides the card and stores `localStorage.hideMonitoringGuide = 'true'`; when hidden, a text button "`fa-question-circle` Tunjuk panduan penggunaan" → shows it and removes the key. The choice persists per browser; initial state = shown unless the key is `'true'` | S2-001–004 | Admin; Guru INFERRED | OBSERVED |
| FN-M11-3.1.2 | Six tiles (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`), each title an in-page anchor with dotted underline: "`fa-th-large` Kad Ringkasan" → `#section-ringkasan` "Gambaran keseluruhan — berapa sekolah, pelajar, yang aktif, dan soalan dijawab. **% Penglibatan** = berapa ramai pelajar yang pernah jawab sekurang-kurangnya 1 soalan."; "`fa-chart-bar` Table Pelajar" → `#section-pelajar` "Setiap sekolah mengikut **% pelajar aktif**. Klik nama sekolah untuk drill-down." + legend line (FN-3.1.3); "`fa-chalkboard-teacher` Table Guru" → `#section-guru` "Berapa guru yang **pernah login** ke platform mengikut sekolah."; "`fa-calendar-week` Tracking Mingguan" → `#section-mingguan` "Soalan dijawab setiap minggu. **Hijau** = naik. **Merah** = turun. **Best** = minggu paling aktif."; "`fa-exclamation-triangle` Perhatian & Cadangan" → `#section-perhatian` "Sekolah yang **perlu tindakan** — pelajar daftar tapi tak guna, guru login tapi murid tak aktif. Ada cadangan susulan."; "`fa-mouse-pointer` Drill-Down" → `#section-pelajar` "Klik **nama sekolah** → senarai pelajar & guru. Klik **nama pelajar aktif** → detail soalan, jawapan salah, subjek kuat/lemah.". Page style: smooth scrolling, `scroll-margin-top: 80px` on the sections | S2-005–010, 016–030 | Admin | OBSERVED |
| FN-M11-3.1.3 | Guide legend line of "Table Pelajar": live "**Cemerlang** >60% \| **Sederhana** 20-60% \| **Rendah** <20% \| **Tiada** 0%" (green-600 / orange-600 / red-600 / slate-500) omits Kritikal; rebuild "**Cemerlang** >60% \| **Sederhana** 20-60% \| **Rendah** 5-20% \| **Kritikal** <5% \| **Tiada** 0%" with Kritikal in the table's Kritikal colour #991b1b (DV-M11-03) | S2-011–015 | Admin | OBSERVED + DV-M11-03 |
| FN-M11-3.1.4 | Tip bar: "`fa-lightbulb` **Tip:** Guna Filter untuk tapis negeri/tempoh/tahap. Export PDF/CSV untuk pembentangan." | S2-031–032 | Admin | OBSERVED |

**FT-M11-3.2 — Filter bar, export and refresh**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M11-3.2.1 | Filter form `GET /admin/monitoring` (it leaves `/guru/monitoring`, as live; DV-M11-04 rejected) with selects preloaded from the query: "Tempoh" `period` ('' "Semua Masa", 7d "7 Hari", 30d "30 Hari", 3m "3 Bulan"); "Negeri" `state` ('' "Semua Negeri", Johor, Kedah, Kelantan, Kuala Lumpur, Melaka, Pahang, Perak, Sabah, Selangor, Terengganu — the states that have registered schools with users, INFERRED); "Tahap" `tahap` ('' "Semua Tahap", Cemerlang, Sederhana, Rendah, Kritikal, "Tiada Langsung"); submit "`fa-filter` Tapis" (indigo-600); a hidden `_token` input inside the GET form (so a submit puts it in the URL; replicated with a dummy value, SEC-M11-01). No `required`. The three selects get the height of the row's buttons (36px, DV-M11-17; live 18px) | S2-033–040, 043 | Admin | OBSERVED + DV-M11-17 |
| FN-M11-3.2.2 | "`fa-times` Reset" link → `/admin/monitoring`, shown only when a filter value is set | S2-223 | Admin | OBSERVED |
| FN-M11-3.2.3 | Export links in the right group (`ml-auto`): "`fa-file-pdf` PDF" (red-600) → `/admin/monitoring/export/pdf?{current query}` and "`fa-file-csv` CSV" (green-600) → `/admin/monitoring/export/csv?{current query}` (e.g. `?period=7d`, `?state=Selangor&tahap=Kritikal`; `?` alone when no filter). Targets OBSERVED; the files were never opened (safety): content and layout UNVERIFIED (Q-M11-7); prototype export PROPOSED and provisional (SRS FR-M11-31) | S2-041, 042, 224, 225, 240, 241, 269, 270, 289, 290, 296, 297 | Admin | OBSERVED (targets) / UNVERIFIED (files) |
| FN-M11-3.2.4 | "`fa-sync-alt` Refresh" (slate-500) = a second submit button of the same GET form (re-submits the current selections to `/admin/monitoring`) | S2-044 | Admin | OBSERVED |
| FN-M11-3.2.5 | Auto-refresh (right-aligned, slate-400): "`fa-clock` Auto-refresh dalam {m:ss}" counting down from "5:00" (300 s, one step per second) and reloading the page at 0; a pause/play toggle (`fa-pause` while running, `fa-play` while paused) stops/resumes the countdown; resuming at 0 restarts from 300 s | S2-045–047 | Admin | OBSERVED (script) |

**FT-M11-3.3 — KPI cards (`#section-ringkasan`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M11-3.3.1 | Row 1 (`grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6`), label + value + sub-line + gradient icon tile: "Jumlah Sekolah" (schools with ≥ 1 registered user, INFERRED, excluding only the fixture schools 900001–900099 — 57 = M02's 60 − 3; runtime schools count) "Berdaftar" `fa-school` blue→indigo; "Pelajar T4/T5" "Berdaftar" `fa-user-graduate` indigo→violet; "Pernah Aktif" "Min. 1 soalan" `fa-check-circle` emerald→green; "% Penglibatan" "Keseluruhan" `fa-chart-line` (tile `fa-percentage`) amber→orange; "Soalan Dijawab" "Total" `fa-pen` purple→fuchsia; "Purata/Pelajar" "Soalan/pelajar aktif" `fa-calculator` rose→pink. Values with thousands separators; % and Purata with 1 decimal and ".0" dropped. Labels 10px below `sm`, `sm:text-sm`; values `text-xl sm:text-3xl`. Pernah Aktif counts students with ≥ 1 answered question, flagged accounts included (S2 definition, FN-3.8.2) | S2-048–071, 226–232, 242–245, 271–275, 291, 298–302 | Admin | OBSERVED |
| FN-M11-3.3.2 | Row 2 (`grid-cols-2 sm:grid-cols-3`): "Guru Berdaftar" `fa-chalkboard-teacher` cyan→teal; "Guru Pernah Login" `fa-sign-in-alt` teal→emerald; "% Penglibatan Guru" `fa-percentage` emerald→green (= login ÷ registered; not affected by `period`) | S2-072–080, 233–236, 292, 293 | Admin | OBSERVED |

**FT-M11-3.4 — Student engagement table (`#section-pelajar`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M11-3.4.1 | Card h3 "`fa-chart-bar` Analisis Penglibatan Pelajar T4/T5" / "Mengikut sekolah — disusun mengikut % penglibatan tertinggi" / right "{n} sekolah" | S2-081–084, 237, 294 | Admin | OBSERVED |
| FN-M11-3.4.2 | Table (in `overflow-x-auto` with a right fade `w-8 bg-gradient-to-l from-white`, `lg:hidden`; headers upper case by CSS) # (mono) · Sekolah (link "{sekolah}" → `/admin/monitoring/sekolah/{id}`, under it "{kod} · {negeri}" 10px, "- · {negeri}" when no code) · Daftar · Aktif · % (bold `text-lg`, tahap colour) · Tahap (white pill on the tahap colour) · Bar (`min-w-[140px]`, h-4 track). One row per school with ≥ 1 registered T4/T5 student; only the reserved fixture schools 900001–900099 are excluded — live-range and runtime-created schools (ids ≥ 10,301) are listed (Delivery Lead, SRS BR-M11-34); sorted by % descending, ties by school id ascending (INFERRED; fits every observed order). Tahap bands: Cemerlang > 60 (#15803d), Sederhana 20–60 (#ea580c), Rendah 5–< 20 (#dc2626), Kritikal > 0 and < 5 (#991b1b), Tiada Langsung 0 (#6b7280). Bar variants: Cemerlang/Sederhana filled bar with the % inside (white 9px); Rendah/Kritikal bar with the % outside (10px, tahap colour) and a minimum width of 3%; 0% empty track + slate-400 "0%". The `tahap` filter applies to this table only | S2-085–090 | Admin | OBSERVED |
| FN-M11-3.4.3 | Legend "Legenda:" with dots "Cemerlang (> 60%)", "Sederhana (20-60%)", "Rendah (5-20%)", "Kritikal (< 5%)", "Tiada Langsung (0%)" | S2-091–096 | Admin | OBSERVED |

**FT-M11-3.5 — Teacher login table (`#section-guru`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M11-3.5.1 | Card h3 "`fa-chalkboard-teacher` Analisis Penglibatan Guru" (amber-500) / "Mengikut sekolah — disusun mengikut % penglibatan tertinggi" / "{n} sekolah" | S2-097–100, 238, 295 | Admin | OBSERVED |
| FN-M11-3.5.2 | Table # · Sekolah (link as FN-3.4.2) · Daftar · Login · % · Tahap · Bar, one row per school with ≥ 1 registered teacher (only the fixture schools 900001–900099 excluded; runtime schools counted), same bands, sort and bar variants as FN-3.4.2; filtered by `state` only (not by `period` or `tahap`) | S2-101–103 | Admin | OBSERVED |
| FN-M11-3.5.3 | Legend as FN-3.4.3 plus "Tiada Guru (0 daftar)" | S2-104–110 | Admin | OBSERVED |

**FT-M11-3.6 — Weekly tracking (`#section-mingguan`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M11-3.6.1 | Card h3 "`fa-calendar-week` Tracking Mingguan" / "Jumlah soalan dijawab mengikut minggu — warna menunjukkan trend naik/turun"; table: Sekolah (sticky left column as live, `max-w-[200px] truncate`, `title` = full name, code under it 9px) · M1 … Mn (`title="dd/mm - dd/mm"`) · Trend · Best; one row per school of the student table (filtered by `state`, not by `period` or `tahap`), ordered by total answers descending, ties and zero rows by school id ascending (OBSERVED); weeks Monday–Sunday from M1 = 16/02/2026 to the current week, the last one cut at today (M32 = 21/09 - 25/09 on 25/09/2026). Cells (mono, semibold, thousands separators): 0 → "-" `bg-slate-50 text-slate-300`; M1 with answers → `bg-blue-50 text-blue-700`; higher than the previous week → `bg-green-50 text-green-700`; lower (non-zero) → `bg-red-50 text-red-600`; **equal to the previous week (non-zero) → blue** (e.g. 8080 M28 150 green, M29 150 blue); a first week after zero weeks is green; the best week also `ring-2 ring-amber-400 ring-inset`. Trend icon (`text-lg`) compares the last week with the one before (INFERRED): `fa-arrow-up text-green-500` title "Meningkat", `fa-arrow-down text-red-500` "Menurun", `fa-minus text-slate-400` "Sama". Best: "M{k}" (amber-600 semibold) + the count (10px slate-400), "-" (slate-300) when the row has no answers | S2-111–114 | Admin | OBSERVED (page script and snapshot) / INFERRED (trend, row order) |
| FN-M11-3.6.2 | Footer listing every week: "**M1**: 16/02 - 22/02" … "**M32**: 21/09 - 25/09" | S2-115–178 | Admin | OBSERVED |

**FT-M11-3.7 — Attention and suggestions (`#section-perhatian`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M11-3.7.1 | "`fa-trophy` Sekolah Terbaik" (`border-l-4 border-green-500`): up to 3 Cemerlang schools in table order, each "`fa-star` {sekolah} — {p}% penglibatan ({aktif}/{daftar} pelajar aktif)" | S2-179–183 | Admin | OBSERVED |
| FN-M11-3.7.2 | "`fa-exclamation-triangle` Perhatian Segera" (`border-l-4 border-red-500`, items `fa-exclamation-circle` red-400): one item per Rendah, Kritikal and Tiada Langsung school in table order: Rendah "{sekolah} — {aktif}/{daftar} pelajar aktif ({p}%). Tahap rendah."; Kritikal "{sekolah} — Hanya {aktif}/{daftar} pelajar aktif ({p}%). Tahap kritikal."; Tiada Langsung "{sekolah} — {daftar} pelajar berdaftar tetapi tiada seorang pun yang menjawab soalan. Tiada sebarang tanda penggunaan platform." + " (Nota: {n} guru telah login)" when teachers of that school have logged in | S2-184–203, 246–259, 276–283, 303–308 | Admin | OBSERVED |
| FN-M11-3.7.3 | "`fa-lightbulb` Cadangan Tindakan" (`border-l-4 border-blue-500 lg:col-span-2`; tiles `grid-cols-1 sm:grid-cols-2`, `bg-blue-50/50`, `fa-arrow-right` blue-400), in Perhatian order: Kritikal → "{sekolah}: Penglibatan sangat rendah. Cadangan: Sesi motivasi dan demonstrasi penggunaan platform kepada pelajar."; Tiada Langsung without teacher login → "{sekolah}: Hubungi pihak sekolah secara langsung untuk mengenal pasti halangan dan memberi taklimat semula."; Tiada Langsung with teacher login → "{sekolah}: Guru telah login tetapi murid belum aktif. Cadangan: Adakan sesi hands-on dengan pelajar."; Rendah → no tile (rule derived from the four observed states: default 17 tiles, 7d 31, 3m 26, Selangor 8) | S2-204–222, 260–268, 284–288 | Admin | OBSERVED (texts, counts) / INFERRED (rule) |
| FN-M11-3.7.4 | When no school qualifies for any list, the section is one card "Tiada pemerhatian yang perlu diberi perhatian buat masa ini." | S2-239 | Admin | OBSERVED |

**FT-M11-3.8 — Data rules**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M11-3.8.1 | Filter scopes: `state` filters every section; `period` (7d, 30d, 3m; '' = all time) changes Pernah Aktif, % Penglibatan, Soalan Dijawab, Purata/Pelajar, the student table and the lists derived from it, not the teacher table or the weekly table; `tahap` filters only the student table (the lists keep every tahap) | — | Admin | OBSERVED |
| FN-M11-3.8.2 | Two declared engagement definitions, replicated as live (DV-M11-11 withdrawn): **S2 and S5** count a student as active with ≥ 1 answered question (period-bound on S2 when a period is set), flagged accounts included (S2 KPIs, both tables, lists; S5 "Pelajar Aktif", "% Aktif"); **S3** states its own rule — "Pernah Aktif", "● Aktif ({n})" and the tahap pill exclude accounts flagged "Perlu Semak · ditapis" ("Angka penglibatan di atas ialah nilai tulen selepas tapis."). So the same school can show two values (8080: S2/S5 174 / 94.6%, S3 165 / 89.7%). Other observed S2↔S3 differences that flags do not explain are replicated too (FN-3.8.5) | — | Admin | OBSERVED |
| FN-M11-3.8.3 | Empty filter result (e.g. `state=Kelantan&tahap=Cemerlang`): "0 sekolah", empty `tbody` with headers and no message (as live; DV-M11-15 rejected), weekly table without rows, the FN-3.7.4 card, zero KPIs (Jumlah Sekolah keeps its count) | — | Admin | OBSERVED |
| FN-M11-3.8.5 | **(v1.11, D9 — replaces the v1.1 "replicate each screen's own value" text.)** The S3 cards are computed from the same screen's rows, so a card never contradicts its table or the school's S2 row (apart from the declared flag exclusion of FN-3.8.2). Live differences are corrected: school 8765 S3 "Pernah Aktif" 1 / "Soalan Dijawab" 209 / "Rendah — 6.3%" → **6 / 222 / "Sederhana — 37.5%"** (DV-M11-24); 8090 answers 119,806 → 120,782 and 8106 59,201 → 59,211 (DV-M11-25); teacher logins 8106 16 → 18, 8078 52 → 53, 8087 13 → 12, 8102 43 → 42, 8277 17 → 16 (DV-M11-26). No S3 snapshot values are stored (SRS BR-M11-32) | — | Admin | OBSERVED (S2) + D9 |
| FN-M11-3.8.6 | **(v1.11, INFERRED.)** Admin Sekolah alias: `/admin-sekolah/monitoring` (live 200) is S2, and its school, pupil and teacher drill-downs are S3–S5, scoped to the viewer's own school (the school is forced from the session). Another school's ids → 404, the same as unknown ids (existence not revealed; one rule with M17 BR-M17-34, OQ-M11-11 closed); S1 and S6 → 403 for this role (role refusal) | — | Admin Sekolah | INFERRED |
| FN-M11-3.8.4 | One component, two mounts: `/guru/monitoring` (M11) and `/admin/monitoring` (M17) render the same screen and data; only the sidebar active state differs on live (fixed, DV-M11-12) | — | Admin | OBSERVED |

### EP-M11-4 — Monitoring drill-down (S3–S5; shared component)

**FT-M11-4.1 — Detail Sekolah (S3)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M11-4.1.1 | Header card: h2 school name; "`fa-hashtag` {kod}", "`fa-map-marker-alt` {negeri}", subscription pill "`fa-circle` Active — sehingga {d MMM yyyy}" (green-100/700), "Cancelled — sehingga {d MMM yyyy}" or "Expired — sehingga {d MMM yyyy}" (both `bg-slate-100 text-slate-500`; English labels and month, replicated — DV-M11-14 rejected) by the school's subscription status, else the plain text "Tiada langganan" (`text-xs text-slate-400`, not a pill); right: tahap pill "{Tahap} — {p}%" (white on the tahap colour, `px-4 py-2 rounded-full`) | S3-001–006, 056, 057, 075, 076, 085, 086, 092, 093, 102–104 | Admin | OBSERVED (Cancelled/Expired: snapshot 8102, 8107, 8228) |
| FN-M11-4.1.2 | 5 cards (`grid-cols-2 lg:grid-cols-5`): "Pelajar T4/T5", "Pernah Aktif" (S3 filtered definition, FN-3.8.2), "Soalan Dijawab", "Guru Berdaftar", "Guru Pernah Login" | S3-007–021, 058–062, 077–079, 087–089, 094–097, 105–107 | Admin | OBSERVED |
| FN-M11-4.1.3 | "`fa-user-graduate` Senarai Pelajar T4/T5" (`x-data="{ studentFilter: 'all', studentSearch: '' }"`) with pills "Semua ({n})" (active `bg-indigo-600 text-white`), "● Aktif ({n})" (green-100/700 → active green-600), "Login sahaja" (amber-100/700 → amber-600), "Belum login" (slate-100/500 → red-600) — counts only on the first two. Filters client-side. Live row expressions (OBSERVED): all; active = every student with ≥ 1 answer, **including "ditapis" rows**, while the label counts S3's engaged students (8080: 174 rows under "Aktif (165)" — live defect D-M11-19); login = no answer and logged in; never = **no login**, which also shows students with answers who never logged in (8080: 6 "Belum login" + 2 "Aktif" rows). Rebuild: active shows the students the label counts — ≥ 1 answer and not "ditapis" (8080: 165 rows; DV-M11-21); the "ditapis" rows stay listed under "Semua" with their badge; login and never as live | S3-022–027, 063, 064, 080, 098, 108 | Admin | OBSERVED (row expressions) + DV-M11-21 |
| FN-M11-4.1.4 | Search input "Cari nama pelajar..." (`x-model`, `sm:w-64`): client-side, lower-cased `includes` on the full name, combined with the pill; no "no result" message (every row hidden, header stays) | S3-028 | Admin | OBSERVED |
| FN-M11-4.1.5 | Warning box (amber-50/200/800) "⚠ **{n} akaun** menunjukkan aktiviti luar biasa (kelajuan menjawab tidak munasabah — perlu semak). **{m}** daripadanya dikecualikan dari peratus penglibatan kerana corak seperti automasi. Angka penglibatan di atas ialah nilai tulen selepas tapis." When no account is excluded (m = 0) the middle sentence is absent: "⚠ **{n} akaun** menunjukkan aktiviti luar biasa (kelajuan menjawab tidak munasabah — perlu semak). Angka penglibatan di atas ialah nilai tulen selepas tapis." (8087, 10220). Absent when the school has no flagged account | S3-029–032, 099, 109 | Admin | OBSERVED (variant: snapshot) |
| FN-M11-4.1.6 | Table (headers upper case by CSS) # · Nama · Tingkatan · Soalan · Status · Login Terakhir · Aktiviti Terakhir ("dd/mm/yyyy HH:mm", "-" when none). Nama: students with ≥ 1 answer link (indigo-600) → `/admin/monitoring/sekolah/{id}/pelajar/{id}`; students without answers (row `opacity-60`, slate-500) link → `/admin/kirkpatrick/pelajar/{id}` (M12); e-mail under the name (10px slate-400); flag badges (9px) "⚠ Perlu Semak" (amber-100/700, `title="Aktiviti luar biasa (kelajuan menjawab tidak munasabah) — perlu semak."`) and "⚠ Perlu Semak · ditapis" (rose-100/700, title adds " Dikecualikan dari peratus penglibatan."). Tingkatan in one format "T{n}" (DV-M11-07; live mixes "T5" and "Tingkatan 5"). Soalan indigo-600 (> 0) or slate-300 "0". Status pill "Aktif" (green-100/700; any student with ≥ 1 answer, flagged ones included), "Login sahaja" (amber-100/700), "Belum login" (slate-100/500). Order: Tingkatan ascending, then name A→Z (DV-M11-07). Not paginated | S3-033–045 | Admin | OBSERVED + DV-M11-07 |
| FN-M11-4.1.7 | "`fa-chalkboard-teacher` Senarai Guru ({n})" (`x-data="{ teacherFilter: 'all' }"`): pills "Semua", "Pernah Login", "Belum Login"; table (headers upper case by CSS) # · Nama (link → `/admin/monitoring/sekolah/{id}/guru/{id}` + e-mail) · Status ("Pernah login" green-100/700; "Belum login" slate-100/500 INFERRED) · Login Terakhir · Daftar ("dd/mm/yyyy"). A pill with no matching rows shows no row and no message | S3-046–055, 081–084, 090, 091, 100, 101, 110, 111 | Admin | OBSERVED / INFERRED (Belum login pill) |
| FN-M11-4.1.8 | No teacher: "Senarai Guru (0)" + "Tiada guru berdaftar untuk sekolah ini." (slate-400, centred) | S3-065–067 | Admin | OBSERVED |
| FN-M11-4.1.9 | Row filtering and search work for every student, including names that contain an apostrophe (DV-M11-18; live throws "Alpine Expression Error" for such a row, which then ignores pills and search) | — | Admin | DV-M11-18 |

**FT-M11-4.2 — Detail Pelajar (S4)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M11-4.2.1 | Header card: `fa-user-graduate` tile (indigo-100), h2 name, "{e-mail} · T{n}" (DV-M11-07), "Aktiviti Terakhir: dd/mm/yyyy HH:mm" | S4-001–004, 141, 209, 210 | Admin | OBSERVED + DV-M11-07 |
| FN-M11-4.2.2 | 4 cards: "Soalan Dijawab", "Betul", "Salah", "Ketepatan" (= Betul ÷ Soalan × 100, 1 decimal; value green-700 ≥ 70, amber-700 50–69.9, red-700 < 50 INFERRED) | S4-005–016, 142–146, 211–213 | Admin | OBSERVED / INFERRED (red) |
| FN-M11-4.2.3 | Tab bar (`x-data="{ tab: 'subject' }"`; active `bg-indigo-600 text-white shadow-md`, inactive white bordered; wraps on narrow screens): "`fa-book` Mengikut Subjek", "`fa-layer-group` Mengikut Tajuk", "`fa-list` Senarai Soalan", "`fa-times-circle` Jawapan Salah {n}" (red count chip), "`fa-crosshairs` Gap Analysis {n}" (amber count chip = number of gaps). Default "Mengikut Subjek"; reload resets the tab | S4-017–023, 147, 148, 214, 215 | Admin | OBSERVED |
| FN-M11-4.2.4 | Mengikut Subjek: one row per subject answered — name (`w-28 sm:w-36`, truncate), h-5 bar with "{p}%" inside (1 decimal), "{betul}/{jumlah}"; bar green-500 ≥ 70, amber-500 50–69.9, red-500 < 50 | S4-024–034, 149–155, 216–223 | Admin | OBSERVED |
| FN-M11-4.2.5 | Mengikut Tajuk: grouped by subject (indigo-600 label, upper case by CSS); rows "Bab {n}" (blank for "Umum") · topic name · "{p}%" (band colour) · "{b}/{j}" · badge "Kuat" (green-100/700, ≥ 80), "Sederhana" (amber-100/700, 50–79.9), "Lemah" (red-100/700, < 50) | S4-035–053, 156–168, 224–231, 305–372 | Admin | OBSERVED |
| FN-M11-4.2.6 | Senarai Soalan: h3 "Senarai Soalan ({available} tersedia daripada {total})" (`x-data="{ showAll: 20 }"`); table (headers not upper case) # · Soalan (indigo-700, first 80 characters + "...", `title` = full text, `fa-external-link-alt`) · Subjek · Jawapan (student's letter; red-600 wrong, green-600 right) · Betul (green-600) · Status (`fa-check-circle` green-500 / `fa-times-circle` red-500) · Tarikh ("dd/mm/yyyy HH:mm"); wrong rows `bg-red-50/30`; newest first; first 20 rows; button "`fa-chevron-down` Papar lagi 20 ({shown}/{total})" while rows remain adds 20; a row click opens the question modal (FN-4.2.10) | S4-054–061, 140, 169–174, 232–235 | Admin | OBSERVED |
| FN-M11-4.2.7 | Jawapan Salah: h3 "Jawapan Salah ({n} jawapan, {m} soalan unik)"; one card per wrong answer, newest first (red-200 border, red-50/30): "#{i} · {Subjek} · {Bab / topic group}" + date; question HTML; green box "{letter} {option}" + "Jawapan betul"; red box "{letter} {option}" + "Jawapan pelajar"; blue explanation box (`fa-lightbulb`) when present; "`fa-bookmark` Sumber: {source}". **All n cards are shown** (DV-M11-06; live shows only the first 10 with no control) | S4-062–085, 175–189, 236–263 | Admin | OBSERVED + DV-M11-06 |
| FN-M11-4.2.8 | Gap Analysis panel, shown when its tab is active (DV-M11-02; on live it is outside the tab scope and never visible — content SOURCE-DERIVED from the DOM): h3 "`fa-crosshairs` Gap Analysis & Cadangan Latihan" / "Topik lemah dikesan automatik berdasarkan jawapan pelajar. Soalan latihan dicadangkan untuk isi gap."; gap cards (border/background in the severity colour at 20/05 alpha): topic-group name + subject, severity pill "Kritikal" (#991b1b), "Lemah" (#dc2626), "Perlu Perhatian" (#ea580c), h-3 bar (min 3%) + "{p}%", "{b}/{j} betul", "`fa-book-open` {n} soalan tersedia untuk latihan"; "`fa-star` Topik Kuat" green tiles (round "{p}%" badge green-500, group name, "{Subjek} · {n} soalan"); none → "`fa-check-circle` Tiada topik lemah dikesan!" / "Semua topik yang dicuba mempunyai ketepatan melebihi 60%." (live copy; DV-M11-08 withdrawn); "`fa-exclamation-circle` Subjek Belum Dicuba": slate chips of every subject not tried. Gap rule INFERRED: group accuracy < 60% (SRS BR-M11-19, fits every observed point). The values are **recomputed** from the student's answers when the panel becomes visible and do not replicate the hidden live DOM (DV-M11-20) | S4-086–094, 190–202, 264–301 | Admin | SOURCE-DERIVED (layout) + DV-M11-02, DV-M11-20 |
| FN-M11-4.2.9 | "`fa-lightbulb` Pemerhatian" card (`border-l-4 border-blue-500`, always under the tabs): per subject "Kekuatan dalam {Subjek} ({p}% ketepatan). Boleh jadikan motivasi." (INFERRED ≥ 80) and "Kerap salah dalam {Subjek} ({salah}/{jumlah} salah = {p}% ketepatan). Cadangan: Fokus latihan tambahan." (INFERRED < 50) | S4-095–098, 203–208, 302–304 | Admin | OBSERVED / INFERRED (thresholds) |
| FN-M11-4.2.10 | Question modal (`questionModal()`, opened by the row event; closes with ✕ or a click outside; data replaced on the next row click): pill "Betul"/"Salah"; "{subject} · {chapter}"; meta "`fa-bookmark` {source}", "`fa-signal` Aras {difficulty}", "`fa-clock` {answered_at}" (raw "yyyy-mm-dd HH:mm:ss"); question HTML; "Pilihan Jawapan" option cards (correct `border-green-400 bg-green-50` + "`fa-check-circle` Jawapan Betul"; the student's wrong pick `border-red-400 bg-red-50` + "`fa-times-circle` Jawapan Pelajar"); "Pilihan jawapan telah dipadam dari sistem." when the question has no options; "`fa-lightbulb` Penjelasan" box when an explanation exists; `max-w-2xl max-h-[85vh] overflow-y-auto`, backdrop rgba(0,0,0,0.5) | S4-099–132; SHA-208–220, 226–246 | Admin | OBSERVED |
| FN-M11-4.2.11 | Student with 0 answers (not observed on live; reached by URL and from M12 S5/S8 for 8080 students 4664 and 4644, XR-M12-10): header as FN-4.2.1 with "Aktiviti Terakhir: -"; cards "0", "0", "0", "0%"; tab chips "Jawapan Salah 0", "Gap Analysis 0"; Mengikut Subjek and Mengikut Tajuk with their headings and no rows; "Senarai Soalan (0 tersedia daripada 0)" with an empty table and no "Papar lagi"; "Jawapan Salah (0 jawapan, 0 soalan unik)" with no cards; Gap panel "Tiada topik lemah dikesan!" + its live copy, "Subjek Belum Dicuba" = every subject of the level; "Pemerhatian" card with its heading and no sentence. All values PROPOSED (built only from the page's own observed templates; no new copy) | — | Admin | PROPOSED |

**FT-M11-4.3 — Detail Guru (S5)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M11-4.3.1 | Header card: `fa-chalkboard-teacher` tile (amber-100), h2 name, e-mail, "Login Terakhir: dd/mm/yyyy HH:mm", pill "Pernah Login" (green-100/700) | S5-001–005 | Admin | OBSERVED |
| FN-M11-4.3.2 | 4 cards: "Pelajar T4/T5", "Pelajar Aktif" (students with ≥ 1 answer, flags included), "% Aktif", "Perlu Perhatian" (students without any answer) | S5-006–017 | Admin | OBSERVED |
| FN-M11-4.3.3 | "`fa-user-graduate` Prestasi Pelajar": table (headers not upper case) # · Pelajar · Tingkatan (DV-M11-07) · Soalan · Ketepatan · Status — **every T4/T5 student of the school** (not the teacher's classes; replicated), name order A→Z (INFERRED); students with answers link → `/admin/monitoring/sekolah/{id}/pelajar/{id}`; others (`opacity-50`) plain name, Soalan "0", Ketepatan "-" (slate-300); Ketepatan green-600 ≥ 70, amber-600 50–69.9, red-600 < 50 | S5-018–028 | Admin | OBSERVED |
| FN-M11-4.3.4 | "`fa-lightbulb` Cadangan Tindakan": red box "`fa-exclamation-triangle` {n} pelajar belum pernah login. Cadangan: Adakan sesi pengenalan platform di kelas." (n = students without any login, whatever their status: 8080 → 8 = 6 "Belum login" + 2 "Aktif"); red box "{n} pelajar aktif mempunyai ketepatan bawah 50%. Cadangan: Beri perhatian khas kepada pelajar ini."; green box "`fa-check-circle` {n} pelajar telah mula menjawab soalan. Galakkan mereka kekalkan momentum." (n = students with ≥ 1 answer); each shown when n > 0 (INFERRED) | S5-029–033 | Admin | OBSERVED / INFERRED |

### EP-M11-5 — Analisis Item Soalan (S6 `/guru/analisis-item`)

**FT-M11-5.1 — Filter, legend and results**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M11-5.1.1 | Filter card "`fa-filter` Tapis:" with GET form `#filterForm` → `/guru/analisis-item`: "Mata Pelajaran" `subject_id` ("Semua Subjek" + the 31 M03 subjects A→Z, Appendix A.2 order) and "Kelas" `classroom_id` ("Semua Kelas" + own classes; admin none), both `onchange` submit and preloaded | S6-004–010 | Admin; Guru | OBSERVED |
| FN-M11-5.1.2 | "`fa-times` Reset" link → `/guru/analisis-item`, shown when a filter is set (observed with `subject_id=1`) | S6-017 | Admin; Guru | OBSERVED |
| FN-M11-5.1.3 | Legend row: emerald-500 dot "> 70% (Mudah)", amber-400 dot "40–70% (Sederhana)", red-500 dot "< 40% (Sukar)", "`fa-info-circle` Diskriminasi: >0.3 = baik, <0 = semak semula" (wraps; the note moves under the dots on narrow screens) | S6-011–014 | Admin; Guru | OBSERVED |
| FN-M11-5.1.4 | Empty card: `fa-chart-pie` (5xl slate-200) "Tiada data analisis item untuk paparan ini." / "Pelajar perlu membuat latihan dahulu." — always for the admin (also with `subject_id=1`, `classroom_id=4`, `classroom_id=228`: the filter accepts only own classes, INFERRED) | S6-015–016 | Admin; Guru | OBSERVED |
| FN-M11-5.1.5 | Populated results for a teacher with data: not observable (Q-M11-3). Prototype (provisional, PROPOSED layout): one row per question answered by the scoped students — question text (80 characters), Subjek, attempts, "% betul" with the legend dot colour (> 70 Mudah, 40–70 Sederhana, < 40 Sukar), discrimination index (2 decimals) with "baik" when > 0.3 and "semak semula" when < 0; the scope, answer set and discrimination formula reuse M08's item-analysis rules (M08 BR, INFERRED); the S6 legend bands are applied as shown (DV-M11-09 rejected). **(v1.11, INFERRED)** When a class is selected and no subject is chosen explicitly, the scope uses that class's own subject (class 2001 → 8 rows); an explicit "Mata Pelajaran" choice wins | — | Guru | INFERRED / PROPOSED |

### EP-M11-6 — Blocked pages

**FT-M11-6.1 — Perbandingan Kelas (S7)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M11-6.1.1 | Live: standalone 500 page "500", "⚙️", h1 "Ralat Pelayan", "Sesuatu tidak kena di pihak kami. Pasukan teknikal telah dimaklumkan. Sila cuba sebentar lagi.", "Halaman Utama" → `/`, "Cuba Semula" → `javascript:location.reload()`, "PRESTASIPLUS" (tab "500 - Ralat Pelayan \| PRESTASIPLUS"). Rebuild (DV-M11-13): the route no longer errors; it renders a **provisional page** in the user-portal shell: header "Perbandingan Kelas" (the live menu label), tab "Perbandingan Kelas - Portal Guru" (PROPOSED, S1/S6 pattern), and the S6 empty-card pattern with `fa-balance-scale` and PROPOSED COPY "Tiada data perbandingan kelas untuk paparan ini." — no comparison dimension, chart or control is asserted (content unknown, Q-M11-2) | S7-001–007 | Admin; Guru | OBSERVED + DV-M11-13 (provisional) |
| FN-M11-6.1.2 | Teacher content of `/guru/perbandingan-kelas`: BLOCKED pending a teacher account (OQ-M11-01); the provisional page of FN-6.1.1 stands in; replaced by the discovered content when observed | — | Guru | UNVERIFIED |

**FT-M11-6.2 — Laporan Mingguan Kelas (S8)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M11-6.2.1 | Admin: the standalone 403 page (same as M08 S21): "403", "🚫", h1 "Akses Ditolak", "Anda tidak mempunyai kebenaran untuk mengakses halaman ini. Sila log masuk dengan akaun yang betul atau hubungi pentadbir.", "Halaman Utama" → `/`, "Log Masuk" → `/login`, "PRESTASIPLUS"; tab "403 - Akses Ditolak \| PRESTASIPLUS"; also for `?week=1` and `/{id}` | S8-001–007 | Admin | OBSERVED |
| FN-M11-6.2.2 | Teacher: content UNVERIFIED (403 not asserted for teachers; OQ-M11-01). Prototype stand-in (provisional): user-portal shell, header "Laporan Mingguan" (menu label), tab "Laporan Mingguan - Portal Guru" (PROPOSED), S6 empty-card pattern with `fa-calendar-week` and PROPOSED COPY "Tiada data laporan mingguan untuk paparan ini." | — | Guru | UNVERIFIED / PROPOSED |

---

## 4. User stories

Values in the ACs come from the seed (SRS §6.7–§6.8; admin figures = the pinned snapshot of 2026-09-25 19:24). "The admin" = `admin@demo.test` (id 1; mirrors the live admin). "The teacher" = `guru@demo.test` (canonical id 5, SMK DEMO 900001; M08 v1.7 classes 2001 "5 MARIKH - Kimia" and 2002 "5 MARIKH - Sejarah", members 3001–3008 "Murid Demo 01…08"). "School 8080" = the observed Selangor school of the drill-down (184 T4/T5 students, 34 teachers). "Student A" = user 2008 (live id); "Student B/C" = its observed students with 195 / 265 answers. "Teacher T" = its observed teacher (last login 15/06/2026 12:37). Mock clock 2026-09-25T15:40:00+08:00. E2E run at 375×812, 768×1024 and 1280×800.

| ID | Feature | MoSCoW | Story | Functions |
|---|---|---|---|---|
| US-M11-01 | FT-M11-1.1 | Must | As a teacher, I want the M11 reports in my "Portal Guru" menu with the right page titles, so that I can find them and know where I am. | FN-M11-1.1.1–1.1.4 |
| US-M11-02 | FT-M11-1.1 | Should | As an admin, I want the "Monitoring" menu item highlighted on every monitoring page, so that I know which section I am in. | FN-M11-1.1.5 |
| US-M11-03 | FT-M11-1.2 | Must | As the owner, I want M11 closed to guests and wrong ids to show the standard 404 page, so that the area behaves predictably. | FN-M11-1.2.1–1.2.4 |
| US-M11-04 | FT-M11-2.1 | Must | As a teacher, I want to choose a date range and one of my classes, so that the report covers the students and period I care about. | FN-M11-2.1.1, 2.1.2 |
| US-M11-05 | FT-M11-2.2 | Must | As a teacher, I want four summary cards (login, practice, activity, score) computed over one student population, so that the figures agree with each other. | FN-M11-2.2.1–2.2.5 |
| US-M11-06 | FT-M11-2.2 | Must | As a teacher, I want to open a card to see who has not logged in or practised and the breakdown by activity type and score, so that I can follow up. | FN-M11-2.2.6–2.2.10 |
| US-M11-07 | FT-M11-2.3 | Should | As a teacher, I want a daily activity trend for the chosen range, so that I see when my students practise. | FN-M11-2.3.1 |
| US-M11-08 | FT-M11-2.4 | Must | As a teacher, I want the most active students and the students who never practised, so that I can praise or chase them. | FN-M11-2.4.1–2.4.3 |
| US-M11-09 | FT-M11-3.1 | Should | As an admin, I want a guide to the monitoring page that I can hide and show again, so that new users understand it without it getting in the way. | FN-M11-3.1.1–3.1.4 |
| US-M11-10 | FT-M11-3.2 | Must | As an admin, I want to filter monitoring by period, state and engagement level, reset the filters and refresh, so that I can focus on a group of schools. | FN-M11-3.2.1, 3.2.2, 3.2.4, 3.8.1 |
| US-M11-11 | FT-M11-3.2 | Should | As an admin, I want PDF and CSV export links that carry my filters, so that I can present the figures. | FN-M11-3.2.3 |
| US-M11-12 | FT-M11-3.2 | Should | As an admin, I want the page to refresh itself every 5 minutes unless I pause it, so that the figures stay current. | FN-M11-3.2.5 |
| US-M11-13 | FT-M11-3.3 | Must | As an admin, I want headline KPIs for schools, T4/T5 students, engagement, answers and teacher logins, so that I see adoption at a glance. | FN-M11-3.3.1, 3.3.2, 3.8.2 |
| US-M11-14 | FT-M11-3.4 / 3.5 | Must | As an admin, I want per-school student engagement and teacher login tables with engagement levels, so that I can compare schools. | FN-M11-3.4.1–3.4.3, 3.5.1–3.5.3 |
| US-M11-15 | FT-M11-3.6 | Should | As an admin, I want weekly answer counts per school with trend and best week, so that I see momentum. | FN-M11-3.6.1, 3.6.2 |
| US-M11-16 | FT-M11-3.7 | Must | As an admin, I want the best schools, the schools needing attention and suggested actions, so that I know where to act. | FN-M11-3.7.1–3.7.4 |
| US-M11-17 | FT-M11-3.8 | Must | As an admin, I want the same monitoring on the teacher and admin routes, consistent figures on every screen (an S3 card never contradicts its own table) and a clear state when a filter matches nothing, so that the data is consistent with live. | FN-M11-3.8.3, 3.8.4, 3.8.5 |
| US-M11-30 | FT-M11-3.8 | Should | As an Admin Sekolah, I want the monitoring screens for my own school only, so that I can follow my school's engagement without seeing other schools. (v1.11, INFERRED) | FN-M11-3.8.6 |
| US-M11-18 | FT-M11-4.1 | Must | As an admin, I want a school's header, subscription and engagement cards, so that I understand one school. | FN-M11-4.1.1, 4.1.2 |
| US-M11-19 | FT-M11-4.1 | Must | As an admin, I want the school's T4/T5 students with status filters, search and anomaly flags, so that I find inactive or suspicious accounts. | FN-M11-4.1.3–4.1.6, 4.1.9 |
| US-M11-20 | FT-M11-4.1 | Must | As an admin, I want the school's teachers with login status, so that I know who uses the platform. | FN-M11-4.1.7, 4.1.8 |
| US-M11-21 | FT-M11-4.2 | Must | As an admin, I want a student's totals and results by subject and by topic, so that I see strengths and weaknesses. | FN-M11-4.2.1–4.2.5, 4.2.11 |
| US-M11-22 | FT-M11-4.2 | Must | As an admin, I want the student's answered questions with details in a modal, so that I can inspect each answer. | FN-M11-4.2.6, 4.2.10 |
| US-M11-23 | FT-M11-4.2 | Must | As an admin, I want every wrong answer with the correct answer and explanation, so that I can plan remediation. | FN-M11-4.2.7 |
| US-M11-24 | FT-M11-4.2 | Should | As an admin, I want the gap analysis and observations, so that I get suggested focus areas. | FN-M11-4.2.8, 4.2.9 |
| US-M11-25 | FT-M11-4.3 | Should | As an admin, I want a teacher's page with the school's student performance and suggestions, so that I can advise the teacher. | FN-M11-4.3.1–4.3.4 |
| US-M11-26 | FT-M11-5.1 | Must | As a teacher, I want item analysis by subject and class with a legend, so that I find hard and poorly discriminating questions. | FN-M11-5.1.1–5.1.5 |
| US-M11-27 | FT-M11-6.1 | Could | As the owner, I want `/guru/perbandingan-kelas` not to crash and not to invent content until it is discovered, so that the menu item is safe. | FN-M11-6.1.1, 6.1.2 |
| US-M11-28 | FT-M11-6.2 | Could | As the owner, I want `/guru/laporan-mingguan-kelas` to behave as observed for the admin and to stay provisional for teachers, so that nothing is invented. | FN-M11-6.2.1, 6.2.2 |
| US-M11-29 | cross-cutting | Must | As a user on a phone, tablet or desktop, I want every M11 screen to fit without page scrolling sideways and with usable controls, so that I can use it anywhere. | All screen FNs; DV-M11-16, DV-M11-17 |

### Acceptance criteria

**US-M11-01 — Menu, shells and titles**
- **AC-M11-01.1** Given the teacher (provisional, teacher menu INFERRED), when I open the user-portal menu, then "PENILAIAN" has "Laporan" (`fa-chart-pie`) → `/guru/laporan` and "ANALITIK" has "Monitoring" (`fa-binoculars`) → `/guru/monitoring`, "Analisis Item" (`fa-chart-pie`) → `/guru/analisis-item`, "Perbandingan Kelas" (`fa-balance-scale`) → `/guru/perbandingan-kelas`, "Laporan Mingguan" (`fa-calendar-week`) → `/guru/laporan-mingguan-kelas`.
- **AC-M11-01.2** Given the admin, when a user-portal page loads, then the "Portal Guru" drawer group with those links exists but is not displayed (as live).
- **AC-M11-01.3** Given S1, S6 and S2, when each loads, then the header reads "Laporan Statistik" / "Pantau penglibatan dan prestasi pelajar", "Analisis Item Soalan" / "Kenal pasti soalan yang sukar dan indeks diskriminasi", "Monitoring Penglibatan" / "Pantau penglibatan sekolah & pelajar T4/T5 dalam platform", and the tab titles are "Laporan Statistik - Portal Guru", "Analisis Item Soalan - Portal Guru", "Monitoring Penglibatan Sekolah - Admin".
- **AC-M11-01.4** Given S3, S4, S5 of school 8080, when each loads, then the header is "Detail Sekolah", "Detail Pelajar", "Detail Guru" with the breadcrumb "Monitoring" → `/admin/monitoring` and (S4/S5) the school name → `/admin/monitoring/sekolah/8080` followed by the person's name; tabs "{sekolah} - Monitoring", "{nama} - Detail Pelajar", "{nama} - Detail Guru".
- **AC-M11-01.5** Given the admin, when S1 or S6 loads, then the user-portal shell renders; when S2–S5 load under `/guru/…`, then the admin-panel shell ("Panel Pentadbir") renders.

**US-M11-02 — Active menu item**
- **AC-M11-02.1** Given the admin at 1280px on `/guru/monitoring`, `/guru/monitoring/sekolah/8080` or `/admin/monitoring`, when the page loads, then the admin sidebar item "Monitoring" under "ANALITIK" is shown active (DV-M11-12).
- **AC-M11-02.2** Given 375px, when I open "Lagi" on `/guru/monitoring`, then "Monitoring" is shown active there too.

**US-M11-03 — Access and errors**
- **AC-M11-03.1** Given no session, when I open any M11 route, then I am sent to `/login` (INFERRED).
- **AC-M11-03.2** Given the admin, when I open `/guru/monitoring/sekolah/99999999`, `/guru/monitoring/sekolah/8080/pelajar/99999999`, `/guru/monitoring/sekolah/8080/guru/99999999`, `/guru/laporan/4` or `/guru/perbandingan`, then the global 404 page shows "404", "🔍", "Halaman Tidak Dijumpai", "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?", "Halaman Utama" → `/`, "Mula Latihan" and "PRESTASIPLUS".
- **AC-M11-03.3** Given the admin, when I open `/guru/monitoring/sekolah/940/pelajar/{Student A}`, then Student A's page renders and the breadcrumb names school 940 (as live; SEC-M11-02).
- **AC-M11-03.4** Given the teacher (provisional), when I open `/guru/laporan` and `/guru/analisis-item`, then both render with my classes in "Kelas"; when I follow a monitoring link to `/admin/monitoring…`, then the M17/M01 non-admin rule applies (redirect to the M01 landing page, INFERRED).

**US-M11-04 — Laporan filter**
- **AC-M11-04.1** Given the admin on `/guru/laporan`, when it loads, then "Tapis:" shows a select with only "Semua Kelas" and the pills "7 Hari", "30 Hari" (active, `text-indigo-700`), "3 Bulan".
- **AC-M11-04.2** Given `/guru/laporan?range=999`, when it loads, then "30 Hari" is active and the labels read "30 hari lepas".
- **AC-M11-04.3** Given the teacher on `?range=7` (provisional), when I choose class "5 MARIKH - Kimia", then the URL becomes `/guru/laporan?range=7&classroom_id=2001` and the select keeps the class; when I then click "3 Bulan", then the URL becomes `?range=90` and the select is back to "Semua Kelas".

**US-M11-05 — Summary cards**
- **AC-M11-05.1** Given the admin (no class), when S1 loads, then "Pernah Login" shows "0%" and "0 / 0 pelajar" with no red line, "Pernah Buat Latihan" "0%" "0 / 0 pelajar", "Jumlah Aktiviti" "0" "30 hari lepas", "Skor Purata" "-%" (DV-M11-01).
- **AC-M11-05.2** Given the teacher with "Semua Kelas" and 30 days, when S1 loads, then "Pernah Login" shows "100%" and "8 / 8 pelajar" with no red line; "Pernah Buat Latihan" "100%" "8 / 8 pelajar"; "Jumlah Aktiviti" "14"; "Skor Purata" "46%" (provisional: teacher view and formulas INFERRED).
- **AC-M11-05.3** Given the teacher with class 2001 or 2002, when S1 loads, then the cards equal the "Semua Kelas" values (both classes have the members 3001–3008) (provisional).
- **AC-M11-05.4** Given `range=7` and `range=90`, when S1 loads, then the activity card reads "7 hari lepas" / "90 hari lepas"; the teacher's 7-day total is "7" (provisional).

**US-M11-06 — Panels**
- **AC-M11-06.1** Given S1, when I click "Pernah Login", then its panel opens with a ring on the card; when I click "Jumlah Aktiviti", then the login panel closes and the activity panel opens; when I click "Jumlah Aktiviti" again, then no panel is open.
- **AC-M11-06.2** Given the admin, when I open the login and latihan panels, then they read "Pelajar Belum Pernah Login (0)" / "Semua pelajar sudah pernah login!" and "Pelajar Belum Pernah Buat Latihan (0)" / "Semua pelajar sudah aktif buat latihan!".
- **AC-M11-06.3** Given the admin on `range=7`, when I open the activity panel, then it reads "Pecahan Aktiviti (7 Hari Lepas)" with tiles Kuiz, Struktur, Latih Tubi, Tracking A, Battle, Permainan, Jumlah all "0"; the score panel "Pecahan Skor Purata" shows five bars Kuiz, Struktur, Latih Tubi, Tracking A, Battle, each "-%" with an empty bar, and no Permainan.
- **AC-M11-06.4** Given the teacher (30 days, provisional), when I open the activity panel, then Kuiz 14, Struktur 0, Latih Tubi 0, Tracking A 0, Battle 0, Permainan 0, Jumlah 14; the score panel shows Kuiz "46%" and "-%" for Struktur, Latih Tubi, Tracking A and Battle; the login and latihan panels read "(0)" with their success copy.

**US-M11-07 — Trend**
- **AC-M11-07.1** Given the admin on the default range, when S1 loads, then "Trend Aktiviti" shows a line chart with 30 labels from "27/08" to "25/09", all values 0, y axis from 0 in steps of 1, no legend.
- **AC-M11-07.2** Given the teacher (provisional), when S1 loads, then the chart values are 4 on 15/09, 3 on 18/09, 4 on 22/09, 3 on 24/09 and 0 elsewhere, and hovering a point shows "{n} aktiviti".

**US-M11-08 — Lists**
- **AC-M11-08.1** Given the admin, when S1 loads, then "Paling Aktif" shows "Belum ada aktiviti" and "Belum Pernah Buat Latihan" shows "Semua pelajar sudah aktif buat latihan!" (DV-M11-01).
- **AC-M11-08.2** Given the teacher (provisional), when S1 loads, then "Belum Pernah Buat Latihan" shows "Semua pelajar sudah aktif buat latihan!"; "Paling Aktif" lists 8 students, Murid Demo 01 and Murid Demo 02 first with "3 aktiviti" (PROPOSED label).
- **AC-M11-08.3** Given 375px and a student e-mail longer than the card, when S1 loads, then the e-mail truncates and the page has no horizontal scroll (DV-M11-16).

**US-M11-09 — Guide**
- **AC-M11-09.1** Given a browser without the key, when S2 loads, then "Panduan Monitoring Penglibatan" shows its six tiles with the exact texts and anchors of FN-M11-3.1.2 and the tip "Guna Filter untuk tapis negeri/tempoh/tahap. Export PDF/CSV untuk pembentangan.".
- **AC-M11-09.2** Given the guide, when I click ✕, then it disappears, "Tunjuk panduan penggunaan" appears and stays after a reload; when I click that button, then the guide returns and stays after a reload.
- **AC-M11-09.3** Given the guide, when it loads, then the "Table Pelajar" tile legend reads "Cemerlang >60% | Sederhana 20-60% | Rendah 5-20% | Kritikal <5% | Tiada 0%" (DV-M11-03).
- **AC-M11-09.4** Given the tile "Tracking Mingguan", when I click it, then the page scrolls to the weekly table.

**US-M11-10 — Filters, reset, refresh**
- **AC-M11-10.1** Given S2 without a query, when it loads, then "Tempoh" shows "Semua Masa" with options Semua Masa / 7 Hari / 30 Hari / 3 Bulan, "Negeri" "Semua Negeri" + the 10 states, "Tahap" "Semua Tahap" + Cemerlang, Sederhana, Rendah, Kritikal, Tiada Langsung, and no "Reset" link.
- **AC-M11-10.2** Given S2, when I choose "7 Hari" and press "Tapis", then the browser goes to `/admin/monitoring?period=7d&state=&tahap=&_token=…` and shows the 7-day figures with "7 Hari" preselected and a "Reset" link → `/admin/monitoring`.
- **AC-M11-10.3** Given `/guru/monitoring?state=Selangor&tahap=Kritikal`, when it loads, then "Refresh" re-submits the same selections to `/admin/monitoring`.
- **AC-M11-10.4** Given 375px, when S2 loads, then the three selects are at least 36px tall (DV-M11-17) and the filter wraps into rows (Tempoh + Negeri; Tahap + Tapis; PDF · CSV · Refresh right-aligned).

**US-M11-11 — Export links**
- **AC-M11-11.1** Given S2 without a query, when it loads, then "PDF" → `/admin/monitoring/export/pdf?` and "CSV" → `/admin/monitoring/export/csv?`.
- **AC-M11-11.2** Given `?period=7d`, `?period=3m` or `?state=Selangor&tahap=Kritikal`, when it loads, then both links carry that query (e.g. `/admin/monitoring/export/csv?state=Selangor&tahap=Kritikal`).
- **AC-M11-11.3** Given the CSV link (provisional, file content UNVERIFIED), when I click it, then a CSV file download starts.

**US-M11-12 — Auto-refresh**
- **AC-M11-12.1** Given S2, when it loads, then "Auto-refresh dalam 5:00" shows and counts down each second ("4:59" after 1 s).
- **AC-M11-12.2** Given the countdown, when I press pause, then the time stops and the icon becomes play; when I press play, then it continues.
- **AC-M11-12.3** Given the countdown reaches 0:00, then the page reloads and the countdown restarts at 5:00.

**US-M11-13 — KPIs**
- **AC-M11-13.1** Given S2 default, when it loads, then the cards read "Jumlah Sekolah" 57, "Pelajar T4/T5" 4,158, "Pernah Aktif" 1,462, "% Penglibatan" 35.2%, "Soalan Dijawab" 472,371, "Purata/Pelajar" 323.1, "Guru Berdaftar" 522, "Guru Pernah Login" 277, "% Penglibatan Guru" 53.1% (snapshot values).
- **AC-M11-13.2** Given `period=7d`, when it loads, then 57 · 4,158 · 44 · 1.1% · 7,651 · 173.9 · 522 · 277 · 53.1%.
- **AC-M11-13.3** Given `period=3m`, when it loads, then 57 · 4,158 · 298 · 7.2% · 86,697 · 290.9 · 522 · 277 · 53.1%.
- **AC-M11-13.4** Given `state=Selangor&tahap=Kritikal`, when it loads, then 28 · 4,042 · 1,424 · 35.2% · 460,858 · 323.6 · 517 · 273 · 52.8%; given `state=Johor`, then 7 · 84 · 37 · 44% · 10,418 · 281.6 · 2 · 1 · 50%.
- **AC-M11-13.5** Given `state=Kelantan&tahap=Cemerlang`, when it loads, then 2 · 0 · 0 · 0% · 0 · 0 · 0 · 0 · 0%.
- **AC-M11-13.6** Given `period=30d`, when it loads, then 57 · 4,158 · 89 · 2.1% · 22,207 · 249.5 · 522 · 277 · 53.1%, "30 Hari" preselected, and the student table starts 8284 100%, 8080 18/184 9.8%.

**US-M11-14 — Engagement tables**
- **AC-M11-14.1** Given S2 default, when it loads, then the student table says "33 sekolah" and its rows are, in order, 940, 987, 995, 8098, 8284 (1/1 100%), 8080 184/174 94.6%, 8078 423/345 81.6%, 8082 549/393 71.6%, 8880 53/31 58.5% (Johor), 8106 560/306 54.6%, 8298 2/1 50%, 10220 2/1 50% (Kuala Lumpur), 1014 5/2 40%, 8765 16/6 37.5% (Johor), 8090 385/134 34.8%, 8087 312/46 14.7%, 8102 776/17 2.2%, 8107 675/1 0.1%, then the 15 "Tiada Langsung" schools 7780, 8030, 8198, 8228, 8277, 8300, 8302, 8308, 8767, 8772, 8965, 9167, 9681, 9801, 9806; tahap counts 8 / 7 / 1 / 2 / 15.
- **AC-M11-14.2** Given those rows, then Cemerlang/Sederhana bars show the % inside, the Rendah/Kritikal bars show it outside with a width of at least 3% (0.1% and 2.2% render at 3%), and 0% rows an empty track with "0%"; the tahap pills use #15803d, #ea580c, #dc2626, #991b1b, #6b7280; a school without a code shows "- · {negeri}".
- **AC-M11-14.3** Given S2 default, when it loads, then the teacher table says "13 sekolah" with rows 5183 1/1, 8080 34/34, 8300 1/1, 10220 2/2 (100%), 8078 60/53 88.3%, 8082 68/51 75%, 8277 29/16 55.2%, 8090 83/42 50.6%, 8880 2/1 50%, 8102 118/42 35.6%, 8106 60/18 30%, 8087 44/12 27.3%, 8107 20/4 20% and the legend ends with "Tiada Guru (0 daftar)".
- **AC-M11-14.4** Given `state=Selangor&tahap=Kritikal`, when it loads, then the student table shows "2 sekolah" (8102 776/17 and 8107 675/1) and the teacher table "10 sekolah" (not filtered by tahap).
- **AC-M11-14.5** Given a school link, when I click it, then the browser goes to `/admin/monitoring/sekolah/{id}` (first row → `/admin/monitoring/sekolah/940`).
- **AC-M11-14.6** Given the fixture data (SMK DEMO 900001 with pelajar 2, students 3001–3008 and guru 5), when S2 loads in any period or filter, then SMK DEMO has no row in either table, no list item and no weekly row, and the KPIs keep their observed values (57 · 4,158 · 1,462 · 35.2% · 472,371 · 323.1 · 522 · 277 · 53.1%); the teacher's own S1 still lists 3001–3008 (BR-M11-34).
- **AC-M11-14.7** Given a school created at runtime through M02 (id ≥ 10,301) with one T5 student who has answered and one teacher who has logged in, when S2 loads, then that school appears in the student and teacher tables, its weekly row and "Jumlah Sekolah" (58), and the KPIs include its student, answers and teacher (only the fixture range 900001–900099 is excluded; BR-M11-34).

**US-M11-15 — Weekly tracking**
- **AC-M11-15.1** Given S2 default on 25/09/2026, when it loads, then the weekly table has columns Sekolah, M1…M32, Trend, Best, 33 rows, and the footer lists "M1: 16/02 - 22/02" … "M32: 21/09 - 25/09"; M1's header `title` is "16/02 - 22/02".
- **AC-M11-15.2** Given the weekly rows, then the trend icons count 2 "Meningkat", 4 "Menurun" and 27 "Sama"; a row without answers shows "-" cells and Best "-".
- **AC-M11-15.3** Given the observed weekly rows, then 8080 shows M12 2,637 green, M13 315 red, M16 "-", M17 352 green, M18 37,748 green with the amber ring, M28 150 green, M29 150 **blue** (equal to the previous week), M32 552 red, Best "M18 37,748" and Trend "Menurun"; 8090 M1 268 is blue; 8284 M32 5 is green with Trend "Meningkat".
- **AC-M11-15.4** Given `state=Selangor&tahap=Kritikal`, when it loads, then the weekly table has 21 rows (2 up, 4 down, 15 Sama).

**US-M11-16 — Attention and suggestions**
- **AC-M11-16.1** Given S2 default, when it loads, then "Sekolah Terbaik" lists 940, 987 and 995, each "{sekolah} — 100% penglibatan (1/1 pelajar aktif)".
- **AC-M11-16.2** Given S2 default, then "Perhatian Segera" lists 18 items in table order: 8087 "… — 46/312 pelajar aktif (14.7%). Tahap rendah.", 8102 "… — Hanya 17/776 pelajar aktif (2.2%). Tahap kritikal.", 8107 "… — Hanya 1/675 pelajar aktif (0.1%). Tahap kritikal.", then the 15 Tiada Langsung schools "… pelajar berdaftar tetapi tiada seorang pun yang menjawab soalan. Tiada sebarang tanda penggunaan platform.", 8277 ending " (Nota: 16 guru telah login)" and 8300 " (Nota: 1 guru telah login)".
- **AC-M11-16.3** Given S2 default, then "Cadangan Tindakan" shows 17 tiles: 2 "Penglibatan sangat rendah…", 4 "Hubungi pihak sekolah…", 2 "Guru telah login tetapi murid belum aktif…", 9 "Hubungi pihak sekolah…".
- **AC-M11-16.4** Given `period=7d`, then Terbaik 1 item (8284), Perhatian 32 items (first "… — 12/184 pelajar aktif (6.5%). Tahap rendah."), Cadangan 31 tiles (4 "Penglibatan sangat rendah…", 7 "Guru telah login…"); given `period=30d`, then 1 / 32 / 31 with the first Perhatian item "… — 18/184 pelajar aktif (9.8%). Tahap rendah."; given `period=3m`, then Terbaik 2 (8098, 8284), Perhatian 29 (first "… — 99/560 pelajar aktif (17.7%). Tahap rendah."), Cadangan 26 (2 "Penglibatan sangat rendah…", 5 "Guru telah login…", 19 "Hubungi pihak sekolah…").
- **AC-M11-16.5** Given `state=Kelantan&tahap=Cemerlang`, then the section shows only "Tiada pemerhatian yang perlu diberi perhatian buat masa ini.".

**US-M11-17 — Mounts and empty result**
- **AC-M11-17.1** Given the admin, when I open `/guru/monitoring` and `/admin/monitoring`, then both show the same KPIs, tables and lists.
- **AC-M11-17.2** Given `state=Kelantan&tahap=Cemerlang`, then both tables show "0 sekolah" with headers and no row or message, the weekly table has headers and no rows, and "Jumlah Sekolah" is 2 (DV-M11-15 rejected).

**US-M11-18 — School header and cards**
- **AC-M11-18.1** Given school 8080, when S3 loads, then the header shows the name, "# {kod}", "Selangor", "Active — sehingga 12 May 2027" (green pill) and the pill "Cemerlang — 89.7%"; cards 184, 165, 53,494, 34, 34 (S3's filtered definition; S2 shows 174 / 94.6% for the same school).
- **AC-M11-18.2** Given school 940, when S3 loads, then "Tiada langganan", "Cemerlang — 100%", cards 1, 1, 10, 0, 0, pills "Semua (1)", "Aktif (1)", no warning box, and "Senarai Guru (0)" / "Tiada guru berdaftar untuk sekolah ini.".
- **AC-M11-18.3** *(v1.11, D9; the v1.1 text "cards 16 · 1 · 209 · 0 · 0, pill Rendah — 6.3%, 8087 logins 13" is withdrawn.)* Given school 8765, when S3 loads, then cards 16 · 6 · 222 · 0 · 0 and the pill "Sederhana — 37.5%" (S2 shows 16 / 6 / 37.5% Sederhana); given 8087, then "Guru Pernah Login" 12 (= S2 12); given 8090, "Soalan Dijawab" 120,782; given 8106, 59,211 and "Guru Pernah Login" 18; given 8078, 8102, 8277, "Guru Pernah Login" 53, 42, 16 — every S3 card equals its S2 value (FN-3.8.5, DV-M11-24/25/26).
- **AC-M11-18.4** Given school 8087, when S3 loads, then the warning reads "⚠ 3 akaun menunjukkan aktiviti luar biasa (kelajuan menjawab tidak munasabah — perlu semak). Angka penglibatan di atas ialah nilai tulen selepas tapis." with no "daripadanya dikecualikan" sentence; 10220 shows the same form with "1 akaun".
- **AC-M11-18.5** Given school 8102, when S3 loads, then the subscription pill reads "Cancelled — sehingga 12 May 2027"; given 8107, then "Expired — sehingga 22 May 2026"; both `bg-slate-100 text-slate-500`.

**US-M11-19 — Student list**
- **AC-M11-19.1** Given school 8080, when S3 loads, then the pills read "Semua (184)" (active), "● Aktif (165)", "Login sahaja", "Belum login", the warning reads "⚠ 19 akaun … 9 daripadanya dikecualikan …", and the table has 184 rows with headers # · NAMA · TINGKATAN · SOALAN · STATUS · LOGIN TERAKHIR · AKTIVITI TERAKHIR (upper case by CSS); status pills Aktif 174, Login sahaja 4, Belum login 6.
- **AC-M11-19.2** Given the table, then Student A's row shows "T5", "71", "Aktif", "16/06/2026 14:11", "16/06/2026 14:19" and links to `/admin/monitoring/sekolah/8080/pelajar/2008`; a "Belum login" row is faded and links to `/admin/kirkpatrick/pelajar/{id}`; every Tingkatan cell uses the "T{n}" format (DV-M11-07); flagged rows show "⚠ Perlu Semak" (10) or "⚠ Perlu Semak · ditapis" (9) with the exact `title`.
- **AC-M11-19.3** Given the pills, when I click "● Aktif (165)", then 165 rows show and none of them carries "⚠ Perlu Semak · ditapis" (DV-M11-21; live shows 174 rows); "Login sahaja" → 4 rows; "Belum login" → 8 rows (6 "Belum login" + 2 "Aktif" without a login, as live); "Semua" → 184, including the 9 "ditapis" rows.
- **AC-M11-19.4** Given the search "zzzz", then no row shows, the header stays and no message appears; given a part of Student B's name, then only matching rows show within the active pill.
- **AC-M11-19.5** Given a student whose name contains an apostrophe, when I use the pills and the search, then that row filters like every other row and no script error occurs (DV-M11-18).

**US-M11-20 — Teacher list**
- **AC-M11-20.1** Given school 8080, when S3 loads, then "Senarai Guru (34)" shows pills "Semua", "Pernah Login", "Belum Login" and 34 rows with "Pernah login", the last login and "Daftar" dates; the name links to `/admin/monitoring/sekolah/8080/guru/{id}`.
- **AC-M11-20.2** Given "Belum Login" on school 8080, then no row and no message show; given school 8082 ("Senarai Guru (68)"), then "Belum Login" shows 17 rows with "Belum login" and "Pernah Login" 51 rows.

**US-M11-21 — Student detail**
- **AC-M11-21.1** Given Student A, when S4 loads, then "{e-mail} · T5", "Aktiviti Terakhir: 16/06/2026 14:19", cards 71 · 53 · 18 · 74.6% (green), tabs with "Jawapan Salah 18" and "Gap Analysis 0", "Mengikut Subjek" active.
- **AC-M11-21.2** Given Student A's "Mengikut Subjek", then rows Bahasa Melayu "100.0%" "31/31" (green), Sejarah "64.0%" "16/25" (amber), Bahasa Inggeris "40.0%" "6/15" (red).
- **AC-M11-21.3** Given "Mengikut Tajuk", then the subjects are grouped (label upper case by CSS) with the 18 observed rows in order: Bahasa Inggeris "Umum" 20.0% 2/10 Lemah, "Bab 1" "Reading for main ideas" 80.0% 4/5 Kuat; Bahasa Melayu Bab 1 "SULUH MASA DEPAN" 1/1, "Kemahiran Membaca dan Memahami" 21/21, "Penulisan karangan lanjutan" 1/1, Bab 3 "Tatabahasa", "KECERDASAN MENINGKAT,", Bab 4 "WASPADA SELALU!", Bab 5 "Dunia Baharu Tani", Bab 9 "INDAH SENI, ENDAH BUDAYA", Bab 10 "SAINS DAN TEKNOLOGI PEMACU", Bab 13 "Cergas Aktif", Bab 99 "Mendengar, mengenal dan menyebut perkataan, rangkai kata, istilah dan ungkapan serta intonasi ayat dalam pelbagai ujaran." (all 100.0% Kuat); Sejarah Bab 1 "Kemunculan tamadun awal" 0.0% 0/1 Lemah, "Persekutuan Tanah Melayu 1948" 100.0% 1/1 Kuat, "Warisan Negara Bangsa" 60.0% 12/20 Sederhana, Bab 3 "Lokasi Zaman Prasejarah di Dunia" 100.0% 2/2 Kuat, Bab 6 "Pentadbiran Barat Berkaitan dengan Ekonomi" 100.0% 1/1 Kuat.
- **AC-M11-21.4** Given Student B and Student C, when S4 loads, then the cards are 195 · 150 · 45 · 76.9% and 265 · 168 · 97 · 63.4% (amber), and Student C's header shows "· T5" (DV-M11-07; live "· Tingkatan 5").
- **AC-M11-21.5** Given the 8080 student 4644 (no answers, never logged in) or 4664 (no answers, logged in), when I open `/guru/monitoring/sekolah/8080/pelajar/4644` (or the `/admin/…` twin from M12), then the page renders (no 404) with "Aktiviti Terakhir: -", cards 0 · 0 · 0 · 0%, chips "Jawapan Salah 0" / "Gap Analysis 0", "Senarai Soalan (0 tersedia daripada 0)" without rows or "Papar lagi", "Jawapan Salah (0 jawapan, 0 soalan unik)" without cards, and a "Pemerhatian" card without sentences (PROPOSED, provisional).

**US-M11-22 — Question list and modal**
- **AC-M11-22.1** Given Student A's "Senarai Soalan", then "Senarai Soalan (71 tersedia daripada 71)", 20 rows newest first (row 1 "Apakah ciri negara berdaulat? I II III IV Pentadbiran yang sistematik Sempadan y...", Sejarah, "A" red, "D" green, red cross, "16/06/2026 14:19"), and "Papar lagi 20 (20/71)"; after one click "Papar lagi 20 (40/71)"; after three more clicks all 71 rows and no button.
- **AC-M11-22.2** Given row 1, when I click it, then the modal shows "Salah", "Sejarah · Sejarah Tingkatan 5 KSSM", "Sumber" "Percubaan SPM 2025 Sejarah Melaka", "Aras 2", "2026-06-16 14:19:57", the question, "Pilihan Jawapan" with A "I dan IV" marked "Jawapan Pelajar" and D "I dan II" marked "Jawapan Betul", and "Penjelasan"; ✕ or a click outside closes it.
- **AC-M11-22.3** Given a question without options (fixture), when its modal opens, then "Pilihan jawapan telah dipadam dari sistem." shows.

**US-M11-23 — Wrong answers**
- **AC-M11-23.1** Given Student A's "Jawapan Salah", then "Jawapan Salah (18 jawapan, 18 soalan unik)" and card 1 "#1 · Sejarah · Sejarah Tingkatan 5 KSSM", "16/06/2026 14:19", the green box "D I dan II" "Jawapan betul", the red box "A I dan IV" "Jawapan pelajar", the explanation and "Sumber: Percubaan SPM 2025 Sejarah Melaka".
- **AC-M11-23.2** Given Student C (97 wrong answers), when the tab opens, then all 97 cards are listed (DV-M11-06) and no "Papar lagi" control is added.

**US-M11-24 — Gap analysis and observations**
- **AC-M11-24.1** Given Student B, when I click "Gap Analysis 2", then the other panels hide and "Gap Analysis & Cadangan Latihan" shows gap cards with severity pills, bars, "{b}/{j} betul" and "{n} soalan tersedia untuk latihan" (DV-M11-02; values recomputed by the INFERRED rule, DV-M11-20; provisional).
- **AC-M11-24.2** Given Student A ("Gap Analysis 0"), when I click the tab, then "Tiada topik lemah dikesan!" / "Semua topik yang dicuba mempunyai ketepatan melebihi 60%." and "Subjek Belum Dicuba" chips show, none of them a subject Student A answered (DV-M11-20).
- **AC-M11-24.3** Given Student A, when S4 loads, then "Pemerhatian" reads "Kekuatan dalam Bahasa Melayu (100.0% ketepatan). Boleh jadikan motivasi." and "Kerap salah dalam Bahasa Inggeris (9/15 salah = 40.0% ketepatan). Cadangan: Fokus latihan tambahan."; given Student B, then four "Kekuatan…" lines (Biologi 81.3%, Sejarah 87.5%, Bahasa Melayu 80.0%, Pendidikan Islam 95.0%) and two "Kerap salah…" lines (Fizik 10/15 33.3%, Matematik 8/10 20.0%).

**US-M11-25 — Teacher detail**
- **AC-M11-25.1** Given Teacher T, when S5 loads, then the e-mail, "Login Terakhir: 15/06/2026 12:37", "Pernah Login", cards 184 · 174 · 94.6% · 10 (as live).
- **AC-M11-25.2** Given the table "Prestasi Pelajar", then 184 rows ordered by name; Student A "T5" "71" "74.6%" (green) "Aktif" linked to `/admin/monitoring/sekolah/8080/pelajar/{A}`; a "Login sahaja" row faded with "0", "-" and a plain name.
- **AC-M11-25.3** Given "Cadangan Tindakan", then "8 pelajar belum pernah login. Cadangan: Adakan sesi pengenalan platform di kelas." (8 = students without a login: 6 "Belum login" + 2 "Aktif"), "3 pelajar aktif mempunyai ketepatan bawah 50%. Cadangan: Beri perhatian khas kepada pelajar ini." and "174 pelajar telah mula menjawab soalan. Galakkan mereka kekalkan momentum.".

**US-M11-26 — Item analysis**
- **AC-M11-26.1** Given the admin, when S6 loads, then "Mata Pelajaran" lists "Semua Subjek" + 31 subjects A→Z starting "Bahasa Arab", "Bahasa Cina", "Bahasa Inggeris", "Kelas" only "Semua Kelas", the legend "> 70% (Mudah)", "40–70% (Sederhana)", "< 40% (Sukar)", "Diskriminasi: >0.3 = baik, <0 = semak semula", and the empty card "Tiada data analisis item untuk paparan ini." / "Pelajar perlu membuat latihan dahulu.", with no "Reset".
- **AC-M11-26.2** Given the admin, when I choose "Bahasa Melayu", then the URL is `/guru/analisis-item?subject_id=1&classroom_id=`, the subject stays selected, the empty card stays and "Reset" → `/guru/analisis-item` appears; `?classroom_id=228` also shows the empty card.
- **AC-M11-26.3** Given the teacher (provisional), when I choose class 2001, then rows for Kimia Q1–Q8 (M08 fixture questions 700001–700008) show % betul Q1 75.0 (Mudah, green dot); Q2 50.0, Q3 60.0, Q7 50.0, Q8 50.0 (Sederhana, amber); Q4 25.0, Q5 12.5, Q6 12.5 (Sukar, red), and discrimination "baik" for Q1, Q2, Q6, Q7, Q8 and "semak semula" for Q5.

**US-M11-27 — Perbandingan Kelas**
- **AC-M11-27.1** Given the admin or the teacher, when I open `/guru/perbandingan-kelas` (also `?classroom_id=4`), then no 500 page shows; the user-portal shell shows the header "Perbandingan Kelas" and the card "Tiada data perbandingan kelas untuk paparan ini." (DV-M11-13, PROPOSED, provisional).

**US-M11-28 — Laporan Mingguan Kelas**
- **AC-M11-28.1** Given the admin, when I open `/guru/laporan-mingguan-kelas`, `?week=1` or `/guru/laporan-mingguan-kelas/4`, then the standalone 403 page shows "403", "🚫", "Akses Ditolak", the exact text, "Halaman Utama" → `/`, "Log Masuk" → `/login`, tab "403 - Akses Ditolak | PRESTASIPLUS".
- **AC-M11-28.2** Given the teacher (provisional), when I open `/guru/laporan-mingguan-kelas`, then the user-portal shell shows the header "Laporan Mingguan" and "Tiada data laporan mingguan untuk paparan ini." (PROPOSED).

**US-M11-30 — Admin Sekolah alias (v1.11, INFERRED)**
- **AC-M11-30.1** Given a school admin of school 8080, when I open `/admin-sekolah/monitoring`, then S2 shows only school 8080 (its S2 figures), and its school link opens that school's S3 (and the pupil / teacher links S4 / S5) under `/admin-sekolah/monitoring/…`.
- **AC-M11-30.2** Given the same user, when I open the S3, S4 or S5 of another school (or of a pupil / teacher belonging to another school), then the 404 page shows, identical to an unknown id (existence not revealed); `/guru/laporan` and `/guru/analisis-item` (S1, S6) are 403.
- **AC-M11-30.3** Given the same user, when S2 is filtered by `period` or `tahap` (a `state` value or a `schoolId` of another school in the query is ignored), then no school other than 8080 appears in any list, KPI or weekly row.

**US-M11-29 — Responsive**
- **AC-M11-29.1** Given each M11 screen at 375, 768 and 1280, when it loads, then `document.documentElement.scrollWidth` ≤ the viewport width; the S2, S3, S5 tables, the weekly table and the S4 question table scroll inside their cards.
- **AC-M11-29.2** Given S1 at 375 and 768, then the cards are 2 per row and the two lists stack; at 1280 the cards sit in a 5-column grid and the lists side by side.
- **AC-M11-29.3** Given S4 at 375, then the tabs wrap onto several lines, subject names truncate and the question modal fills the width minus the page padding.

---

## 5. UI expectations

| Screen | Key states (screenshots in `docs/discovery/img/M11/`) | Behaviour notes |
|---|---|---|
| S1 | default (`laporan-desktop/-tablet/-mobile.png`), card panels (`laporan-card-login/-aktiviti/-skor.png`) | 2 / 5-column cards; lists stack below `md`; no page overflow at 375 (DV-M11-16). |
| S2 | default (`monitoring-desktop/-tablet/-mobile.png`), tables at 375 (`monitoring-mobile-tables.png`), guide hidden (`monitoring-guide-hidden.png`), empty filter (`monitoring-filter-empty.png`) | KPI 2 per row below `lg`, 6 at `xl`; tables scroll in their cards; weekly school column sticky (as live). |
| S3 | default (`sekolah-desktop/-mobile.png`), filter "Belum login" (`sekolah-filter-never.png`), no teacher (`sekolah-no-teacher.png`) | 5 cards in 2 columns below `lg`; pills wrap beside the heading; search full width below `sm`. |
| S4 | subject, topic, list, wrong answers, gaps blank (live defect), modal (`pelajar-*.png`) | tabs wrap at 375; modal full width minus `p-4`. |
| S5 | default (`guru-desktop/-mobile.png`) | 4 cards in 2 columns below `lg`; table scrolls in its card. |
| S6 | empty (`analisis-item-desktop/-tablet/-mobile.png`) | filters stack below `sm`; legend wraps. |
| S7 | live 500 (`perbandingan-kelas-500.png`) → provisional page (DV-M11-13) | — |
| S8 | 403 (`laporan-mingguan-kelas-403.png`) | standalone; centred card. |

Loading: every data view shows the shared shell loading behaviour while the mock responds (M01/M05 convention; live pages are server-rendered). A mock failure uses the global error convention of M01; no M11-specific error copy exists on live.

---

## 6. Coverage matrix (completeness proof)

Source: `docs/discovery/inventory/M11/` (generated 2026-09-25; v1.1 re-run after the audit top-up — 118 appended IDs S2-296…308, S3-075…111, S4-305…372 and SHA-253…255). Generated by script (`matrix.js` + `assemble.js` in the author's scratchpad `m11-writer/`; reproducible from the Function catalogue below and the inventory JSON). Every M11 content element (S1–S8) is listed with the Function that covers it or with a concrete exclusion reason; each element maps to exactly one entry. Shell elements (SHU, SHA) are chrome owned by the global shell / M23 and the modules their links target; M11-relevant ones are mapped individually, the others excluded with their owner. "Content" quotes the DOM text as captured (`<school>`, `<kod>`, `<name>`, `<person>`, `<email>`, `<masked>`, `{id}` = discovery privacy mask).

**Summary**

| Set | Elements | Mapped to an M11 Function | Excluded (with reason) | Unmapped |
|---|---|---|---|---|
| S1 — `/guru/laporan` | 75 | 72 | 3 | 0 |
| S2 — `/guru/monitoring` | 308 | 308 | 0 | 0 |
| S3 — `/guru/monitoring/sekolah/{id}` | 111 | 111 | 0 | 0 |
| S4 — `/guru/monitoring/sekolah/{id}/pelajar/{id}` | 372 | 372 | 0 | 0 |
| S5 — `/guru/monitoring/sekolah/{id}/guru/{id}` | 40 | 40 | 0 | 0 |
| S6 — `/guru/analisis-item` | 17 | 14 | 3 | 0 |
| S7 — `/guru/perbandingan-kelas` (500) | 7 | 7 | 0 | 0 |
| S8 — `/guru/laporan-mingguan-kelas` (403) | 7 | 7 | 0 | 0 |
| **M11 content (S1–S8)** | **937** | **931** | **6** (M16 tournament banner "LIVE:", "MAIN", "DAFTAR" — EL-M11-S1-001–003, EL-M11-S6-001–003) | **0** |
| User-portal shell SHU (chrome of S1, S6) | 374 | 13 | 361 (global shell / M23, logo/brand 001–003, links owned by M08/M12/M18 and other modules) | 0 |
| Admin-panel shell SHA (chrome of S2–S5) | 255 | 48 | 207 (global shell / M23, logo/brand 001–003, server-status widget, links owned by M12/M17 and other modules) | 0 |

**937/937 M11 content elements covered (931 mapped, 6 excluded with reason), 0 unmapped.** Including the shells: 1566/1566 elements accounted for (992 mapped, 574 excluded with reason), 0 unmapped. 69 of the 86 Functions in §3 appear in this matrix; the other 17 are behaviour-only Functions (access, data rules, deviations without an element, unobservable states). The SHA capture also holds the S4 question-modal elements (SHA-208–220, 226–246), mapped to FN-M11-4.2.10.

### 6.1 M11 content elements

#### S1 — `/guru/laporan` (75 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M11-S1-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M11-S1-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M11-S1-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M11-S1-004 | card | visible-default | "Tapis:" | FN-M11-2.1.1 |
| EL-M11-S1-005 | text | visible-default | "Tapis:", fa-filter | FN-M11-2.1.1 |
| EL-M11-S1-006 | form | visible-default | form | FN-M11-2.1.1 |
| EL-M11-S1-007 | hidden-field | hidden-only | `range` | FN-M11-2.1.1 |
| EL-M11-S1-008 | select | visible-default | `classroom_id` | FN-M11-2.1.1 |
| EL-M11-S1-009 | link | visible-default | "7 Hari", → /guru/laporan?range=7 | FN-M11-2.1.2 |
| EL-M11-S1-010 | link | visible-default | "30 Hari", → /guru/laporan?range=30 | FN-M11-2.1.2 |
| EL-M11-S1-011 | link | visible-default | "3 Bulan", → /guru/laporan?range=90 | FN-M11-2.1.2 |
| EL-M11-S1-012 | clickable | visible-default | "54% Pernah Login 1708 / 3152 pelajar 1444 belum pernah login Klik untuk lihat senarai", fa-sign-in-alt | FN-M11-2.2.2 |
| EL-M11-S1-013 | clickable | visible-default | "0% Pernah Buat Latihan 0 / 0 pelajar Klik untuk lihat senarai", fa-pencil-alt | FN-M11-2.2.3 |
| EL-M11-S1-014 | clickable | visible-default | "0 Jumlah Aktiviti 30 hari lepas Klik untuk lihat pecahan", fa-chart-bar | FN-M11-2.2.4 |
| EL-M11-S1-015 | clickable | visible-default | "-% Skor Purata Klik untuk lihat pecahan", fa-star | FN-M11-2.2.5 |
| EL-M11-S1-016 | card | conditional | "Pelajar Belum Pernah Login (0)" | FN-M11-2.2.7 |
| EL-M11-S1-017 | heading | conditional | "Pelajar Belum Pernah Login (0)" | FN-M11-2.2.7 |
| EL-M11-S1-018 | text | conditional | "Semua pelajar sudah pernah login!", fa-check-circle | FN-M11-2.2.7 |
| EL-M11-S1-019 | card | conditional | "Pelajar Belum Pernah Buat Latihan (0)" | FN-M11-2.2.8 |
| EL-M11-S1-020 | heading | conditional | "Pelajar Belum Pernah Buat Latihan (0)" | FN-M11-2.2.8 |
| EL-M11-S1-021 | text | conditional | "Semua pelajar sudah aktif buat latihan!", fa-check-circle | FN-M11-2.2.8 |
| EL-M11-S1-022 | card | conditional | "Pecahan Aktiviti (30 Hari Lepas)" | FN-M11-2.2.9 |
| EL-M11-S1-023 | heading | conditional | "Pecahan Aktiviti (30 Hari Lepas)" | FN-M11-2.2.9 |
| EL-M11-S1-024 | text | conditional | "0" | FN-M11-2.2.9 |
| EL-M11-S1-025 | text | conditional | "Kuiz", fa-question-circle | FN-M11-2.2.9 |
| EL-M11-S1-026 | text | conditional | "0" | FN-M11-2.2.9 |
| EL-M11-S1-027 | text | conditional | "Struktur", fa-list-ol | FN-M11-2.2.9 |
| EL-M11-S1-028 | text | conditional | "0" | FN-M11-2.2.9 |
| EL-M11-S1-029 | text | conditional | "Latih Tubi", fa-dumbbell | FN-M11-2.2.9 |
| EL-M11-S1-030 | text | conditional | "0" | FN-M11-2.2.9 |
| EL-M11-S1-031 | text | conditional | "Tracking A", fa-crosshairs | FN-M11-2.2.9 |
| EL-M11-S1-032 | text | conditional | "0" | FN-M11-2.2.9 |
| EL-M11-S1-033 | text | conditional | "Battle", fa-bolt | FN-M11-2.2.9 |
| EL-M11-S1-034 | text | conditional | "0" | FN-M11-2.2.9 |
| EL-M11-S1-035 | text | conditional | "Permainan", fa-gamepad | FN-M11-2.2.9 |
| EL-M11-S1-036 | text | conditional | "0" | FN-M11-2.2.9 |
| EL-M11-S1-037 | text | conditional | "Jumlah", fa-sigma | FN-M11-2.2.9 |
| EL-M11-S1-038 | card | conditional | "Pecahan Skor Purata" | FN-M11-2.2.10 |
| EL-M11-S1-039 | heading | conditional | "Pecahan Skor Purata" | FN-M11-2.2.10 |
| EL-M11-S1-040 | text | conditional | "Kuiz", fa-question-circle | FN-M11-2.2.10 |
| EL-M11-S1-041 | text | conditional | "-%" | FN-M11-2.2.10 |
| EL-M11-S1-042 | text | conditional | "Struktur", fa-list-ol | FN-M11-2.2.10 |
| EL-M11-S1-043 | text | conditional | "-%" | FN-M11-2.2.10 |
| EL-M11-S1-044 | text | conditional | "Latih Tubi", fa-dumbbell | FN-M11-2.2.10 |
| EL-M11-S1-045 | text | conditional | "-%" | FN-M11-2.2.10 |
| EL-M11-S1-046 | text | conditional | "Tracking A", fa-crosshairs | FN-M11-2.2.10 |
| EL-M11-S1-047 | text | conditional | "-%" | FN-M11-2.2.10 |
| EL-M11-S1-048 | text | conditional | "Battle", fa-bolt | FN-M11-2.2.10 |
| EL-M11-S1-049 | text | conditional | "-%" | FN-M11-2.2.10 |
| EL-M11-S1-050 | card | visible-default | "Trend Aktiviti" | FN-M11-2.3.1 |
| EL-M11-S1-051 | heading | visible-default | "Trend Aktiviti" | FN-M11-2.3.1 |
| EL-M11-S1-052 | text | visible-default | "30 hari lepas" | FN-M11-2.3.1 |
| EL-M11-S1-053 | card | visible-default | "Paling Aktif" | FN-M11-2.4.1 |
| EL-M11-S1-054 | heading | visible-default | "Paling Aktif" | FN-M11-2.4.1 |
| EL-M11-S1-055 | text | visible-default | "Belum ada aktiviti" | FN-M11-2.4.1 |
| EL-M11-S1-056 | card | visible-default | "Belum Pernah Buat Latihan" | FN-M11-2.4.2 |
| EL-M11-S1-057 | heading | visible-default | "Belum Pernah Buat Latihan" | FN-M11-2.4.2 |
| EL-M11-S1-058 | image | visible-default | image | FN-M11-2.4.2 |
| EL-M11-S1-059 | text | visible-default | "<masked>" | FN-M11-2.4.2 |
| EL-M11-S1-060 | text | visible-default | "<masked>" | FN-M11-2.4.2 |
| EL-M11-S1-061 | text | visible-default | "Belum pernah login" | FN-M11-2.4.2 |
| EL-M11-S1-062 | image | visible-default | image | FN-M11-2.4.2 |
| EL-M11-S1-063 | text | visible-default | "<masked>" | FN-M11-2.4.2 |
| EL-M11-S1-064 | text | visible-default | "<masked>" | FN-M11-2.4.2 |
| EL-M11-S1-065 | text | visible-default | "Belum pernah login" | FN-M11-2.4.2 |
| EL-M11-S1-066 | image | visible-default | image | FN-M11-2.4.2 |
| EL-M11-S1-067 | text | visible-default | "<masked>" | FN-M11-2.4.2 |
| EL-M11-S1-068 | text | visible-default | "<masked>" | FN-M11-2.4.2 |
| EL-M11-S1-069 | text | visible-default | "Belum pernah login" | FN-M11-2.4.2 |
| EL-M11-S1-070 | clickable | conditional | "0 Jumlah Aktiviti 7 hari lepas Klik untuk lihat pecahan", fa-chart-bar | FN-M11-2.2.4 |
| EL-M11-S1-071 | heading | hidden-only | "Pecahan Aktiviti (7 Hari Lepas)" | FN-M11-2.2.9 |
| EL-M11-S1-072 | text | conditional | "7 hari lepas" | FN-M11-2.3.1 |
| EL-M11-S1-073 | clickable | conditional | "0 Jumlah Aktiviti 90 hari lepas Klik untuk lihat pecahan", fa-chart-bar | FN-M11-2.2.4 |
| EL-M11-S1-074 | heading | hidden-only | "Pecahan Aktiviti (90 Hari Lepas)" | FN-M11-2.2.9 |
| EL-M11-S1-075 | text | conditional | "90 hari lepas" | FN-M11-2.3.1 |

#### S2 — `/guru/monitoring` (308 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M11-S2-001 | button | conditional | "Tunjuk panduan penggunaan", fa-question-circle | FN-M11-3.1.1 |
| EL-M11-S2-002 | card | visible-default | "Panduan Monitoring Penglibatan" | FN-M11-3.1.1 |
| EL-M11-S2-003 | button | visible-default | fa-times | FN-M11-3.1.1 |
| EL-M11-S2-004 | heading | visible-default | "Panduan Monitoring Penglibatan" | FN-M11-3.1.1 |
| EL-M11-S2-005 | link | visible-default | "Kad Ringkasan", → #section-ringkasan, fa-th-large | FN-M11-3.1.2 |
| EL-M11-S2-006 | text | visible-default | "Gambaran keseluruhan — berapa sekolah, pelajar, yang aktif, dan soalan dijawab. = berapa r…" | FN-M11-3.1.2 |
| EL-M11-S2-007 | text | visible-default | "% Penglibatan" | FN-M11-3.1.2 |
| EL-M11-S2-008 | link | visible-default | "Table Pelajar", → #section-pelajar, fa-chart-bar | FN-M11-3.1.2 |
| EL-M11-S2-009 | text | visible-default | "Setiap sekolah mengikut . Klik nama sekolah untuk drill-down." | FN-M11-3.1.2 |
| EL-M11-S2-010 | text | visible-default | "% pelajar aktif" | FN-M11-3.1.2 |
| EL-M11-S2-011 | text | visible-default | ">60% \| 20-60% \| <20% \| 0%" | FN-M11-3.1.3 |
| EL-M11-S2-012 | text | visible-default | "Cemerlang" | FN-M11-3.1.3 |
| EL-M11-S2-013 | text | visible-default | "Sederhana" | FN-M11-3.1.3 |
| EL-M11-S2-014 | text | visible-default | "Rendah" | FN-M11-3.1.3 |
| EL-M11-S2-015 | empty-state | visible-default | "Tiada" | FN-M11-3.1.3 |
| EL-M11-S2-016 | link | visible-default | "Table Guru", → #section-guru, fa-chalkboard-teacher | FN-M11-3.1.2 |
| EL-M11-S2-017 | text | visible-default | "Berapa guru yang ke platform mengikut sekolah." | FN-M11-3.1.2 |
| EL-M11-S2-018 | text | visible-default | "pernah login" | FN-M11-3.1.2 |
| EL-M11-S2-019 | link | visible-default | "Tracking Mingguan", → #section-mingguan, fa-calendar-week | FN-M11-3.1.2 |
| EL-M11-S2-020 | text | visible-default | "Soalan dijawab setiap minggu. = naik. = turun. = minggu paling aktif." | FN-M11-3.1.2 |
| EL-M11-S2-021 | text | visible-default | "Hijau" | FN-M11-3.1.2 |
| EL-M11-S2-022 | text | visible-default | "Merah" | FN-M11-3.1.2 |
| EL-M11-S2-023 | text | visible-default | "Best" | FN-M11-3.1.2 |
| EL-M11-S2-024 | link | visible-default | "Perhatian & Cadangan", → #section-perhatian, fa-exclamation-triangle | FN-M11-3.1.2 |
| EL-M11-S2-025 | text | visible-default | "Sekolah yang — pelajar daftar tapi tak guna, guru login tapi murid tak aktif. Ada cadangan…" | FN-M11-3.1.2 |
| EL-M11-S2-026 | text | visible-default | "perlu tindakan" | FN-M11-3.1.2 |
| EL-M11-S2-027 | link | visible-default | "Drill-Down", → #section-pelajar, fa-mouse-pointer | FN-M11-3.1.2 |
| EL-M11-S2-028 | text | visible-default | "Klik → senarai pelajar & guru. Klik → detail soalan, jawapan salah, subjek kuat/lemah." | FN-M11-3.1.2 |
| EL-M11-S2-029 | text | visible-default | "nama sekolah" | FN-M11-3.1.2 |
| EL-M11-S2-030 | text | visible-default | "nama pelajar aktif" | FN-M11-3.1.2 |
| EL-M11-S2-031 | text | visible-default | "Guna Filter untuk tapis negeri/tempoh/tahap. Export PDF/CSV untuk pembentangan.", fa-lightbulb | FN-M11-3.1.4 |
| EL-M11-S2-032 | text | visible-default | "Tip:" | FN-M11-3.1.4 |
| EL-M11-S2-033 | form | visible-default | form | FN-M11-3.2.1 |
| EL-M11-S2-034 | label | visible-default | "Tempoh" | FN-M11-3.2.1 |
| EL-M11-S2-035 | select | visible-default | `period` | FN-M11-3.2.1 |
| EL-M11-S2-036 | label | visible-default | "Negeri" | FN-M11-3.2.1 |
| EL-M11-S2-037 | select | visible-default | `state` | FN-M11-3.2.1 |
| EL-M11-S2-038 | label | visible-default | "Tahap" | FN-M11-3.2.1 |
| EL-M11-S2-039 | select | visible-default | `tahap` | FN-M11-3.2.1 |
| EL-M11-S2-040 | button | visible-default | "Tapis", fa-filter | FN-M11-3.2.1 |
| EL-M11-S2-041 | link | visible-default | "PDF", → /admin/monitoring/export/pdf?, fa-file-pdf | FN-M11-3.2.3 |
| EL-M11-S2-042 | link | visible-default | "CSV", → /admin/monitoring/export/csv?, fa-file-csv | FN-M11-3.2.3 |
| EL-M11-S2-043 | hidden-field | hidden-only | `_token` | FN-M11-3.2.1 |
| EL-M11-S2-044 | button | visible-default | "Refresh", fa-sync-alt | FN-M11-3.2.4 |
| EL-M11-S2-045 | text | visible-default | "Auto-refresh dalam", fa-clock | FN-M11-3.2.5 |
| EL-M11-S2-046 | text | visible-default | "4:58" | FN-M11-3.2.5 |
| EL-M11-S2-047 | toggle | visible-default | fa-pause | FN-M11-3.2.5 |
| EL-M11-S2-048 | card | visible-default | "57" | FN-M11-3.3.1 |
| EL-M11-S2-049 | text | visible-default | "Jumlah Sekolah" | FN-M11-3.3.1 |
| EL-M11-S2-050 | text | visible-default | "57" | FN-M11-3.3.1 |
| EL-M11-S2-051 | text | visible-default | "Berdaftar", fa-school | FN-M11-3.3.1 |
| EL-M11-S2-052 | card | visible-default | "4,158" | FN-M11-3.3.1 |
| EL-M11-S2-053 | text | visible-default | "Pelajar T4/T5" | FN-M11-3.3.1 |
| EL-M11-S2-054 | text | visible-default | "4,158" | FN-M11-3.3.1 |
| EL-M11-S2-055 | text | visible-default | "Berdaftar", fa-user-graduate | FN-M11-3.3.1 |
| EL-M11-S2-056 | card | visible-default | "1,462" | FN-M11-3.3.1 |
| EL-M11-S2-057 | text | visible-default | "Pernah Aktif" | FN-M11-3.3.1 |
| EL-M11-S2-058 | text | visible-default | "1,462" | FN-M11-3.3.1 |
| EL-M11-S2-059 | text | visible-default | "Min. 1 soalan", fa-check-circle | FN-M11-3.3.1 |
| EL-M11-S2-060 | card | visible-default | "35.2%" | FN-M11-3.3.1 |
| EL-M11-S2-061 | text | visible-default | "% Penglibatan" | FN-M11-3.3.1 |
| EL-M11-S2-062 | text | visible-default | "35.2%" | FN-M11-3.3.1 |
| EL-M11-S2-063 | text | visible-default | "Keseluruhan", fa-chart-line | FN-M11-3.3.1 |
| EL-M11-S2-064 | card | visible-default | "472,261" | FN-M11-3.3.1 |
| EL-M11-S2-065 | text | visible-default | "Soalan Dijawab" | FN-M11-3.3.1 |
| EL-M11-S2-066 | text | visible-default | "472,261" | FN-M11-3.3.1 |
| EL-M11-S2-067 | text | visible-default | "Total", fa-pen | FN-M11-3.3.1 |
| EL-M11-S2-068 | card | visible-default | "323" | FN-M11-3.3.1 |
| EL-M11-S2-069 | text | visible-default | "Purata/Pelajar" | FN-M11-3.3.1 |
| EL-M11-S2-070 | text | visible-default | "323" | FN-M11-3.3.1 |
| EL-M11-S2-071 | text | visible-default | "Soalan/pelajar aktif", fa-calculator | FN-M11-3.3.1 |
| EL-M11-S2-072 | card | visible-default | "522" | FN-M11-3.3.2 |
| EL-M11-S2-073 | text | visible-default | "Guru Berdaftar" | FN-M11-3.3.2 |
| EL-M11-S2-074 | text | visible-default | "522" | FN-M11-3.3.2 |
| EL-M11-S2-075 | card | visible-default | "277" | FN-M11-3.3.2 |
| EL-M11-S2-076 | text | visible-default | "Guru Pernah Login" | FN-M11-3.3.2 |
| EL-M11-S2-077 | text | visible-default | "277" | FN-M11-3.3.2 |
| EL-M11-S2-078 | card | visible-default | "53.1%" | FN-M11-3.3.2 |
| EL-M11-S2-079 | text | visible-default | "% Penglibatan Guru" | FN-M11-3.3.2 |
| EL-M11-S2-080 | text | visible-default | "53.1%" | FN-M11-3.3.2 |
| EL-M11-S2-081 | card | visible-default | "Analisis Penglibatan Pelajar T4/T5" | FN-M11-3.4.1 |
| EL-M11-S2-082 | heading | visible-default | "Analisis Penglibatan Pelajar T4/T5" | FN-M11-3.4.1 |
| EL-M11-S2-083 | text | visible-default | "Mengikut sekolah — disusun mengikut % penglibatan tertinggi" | FN-M11-3.4.1 |
| EL-M11-S2-084 | text | visible-default | "33 sekolah" | FN-M11-3.4.1 |
| EL-M11-S2-085 | table | visible-default | columns # · Sekolah · Daftar · Aktif · % · Tahap · Bar | FN-M11-3.4.2 |
| EL-M11-S2-086 | link | visible-default | "<school>", → /admin/monitoring/sekolah/940 | FN-M11-3.4.2 |
| EL-M11-S2-087 | link | visible-default | "<school>", → /admin/monitoring/sekolah/8880 | FN-M11-3.4.2 |
| EL-M11-S2-088 | link | visible-default | "<school>", → /admin/monitoring/sekolah/8087 | FN-M11-3.4.2 |
| EL-M11-S2-089 | link | visible-default | "<school>", → /admin/monitoring/sekolah/8102 | FN-M11-3.4.2 |
| EL-M11-S2-090 | link | visible-default | "<school>", → /admin/monitoring/sekolah/7780 | FN-M11-3.4.2 |
| EL-M11-S2-091 | text | visible-default | "Legenda:" | FN-M11-3.4.3 |
| EL-M11-S2-092 | text | visible-default | "Cemerlang (> 60%)" | FN-M11-3.4.3 |
| EL-M11-S2-093 | text | visible-default | "Sederhana (20-60%)" | FN-M11-3.4.3 |
| EL-M11-S2-094 | text | visible-default | "Rendah (5-20%)" | FN-M11-3.4.3 |
| EL-M11-S2-095 | text | visible-default | "Kritikal (< 5%)" | FN-M11-3.4.3 |
| EL-M11-S2-096 | empty-state | visible-default | "Tiada Langsung (0%)" | FN-M11-3.4.3 |
| EL-M11-S2-097 | card | visible-default | "Analisis Penglibatan Guru" | FN-M11-3.5.1 |
| EL-M11-S2-098 | heading | visible-default | "Analisis Penglibatan Guru" | FN-M11-3.5.1 |
| EL-M11-S2-099 | text | visible-default | "Mengikut sekolah — disusun mengikut % penglibatan tertinggi" | FN-M11-3.5.1 |
| EL-M11-S2-100 | text | visible-default | "13 sekolah" | FN-M11-3.5.1 |
| EL-M11-S2-101 | table | visible-default | columns # · Sekolah · Daftar · Login · % · Tahap · Bar | FN-M11-3.5.2 |
| EL-M11-S2-102 | link | visible-default | "<school>", → /admin/monitoring/sekolah/5183 | FN-M11-3.5.2 |
| EL-M11-S2-103 | link | visible-default | "<school>", → /admin/monitoring/sekolah/8277 | FN-M11-3.5.2 |
| EL-M11-S2-104 | text | visible-default | "Legenda:" | FN-M11-3.5.3 |
| EL-M11-S2-105 | text | visible-default | "Cemerlang (> 60%)" | FN-M11-3.5.3 |
| EL-M11-S2-106 | text | visible-default | "Sederhana (20-60%)" | FN-M11-3.5.3 |
| EL-M11-S2-107 | text | visible-default | "Rendah (5-20%)" | FN-M11-3.5.3 |
| EL-M11-S2-108 | text | visible-default | "Kritikal (< 5%)" | FN-M11-3.5.3 |
| EL-M11-S2-109 | empty-state | visible-default | "Tiada Langsung (0%)" | FN-M11-3.5.3 |
| EL-M11-S2-110 | empty-state | visible-default | "Tiada Guru (0 daftar)" | FN-M11-3.5.3 |
| EL-M11-S2-111 | card | visible-default | "Tracking Mingguan" | FN-M11-3.6.1 |
| EL-M11-S2-112 | heading | visible-default | "Tracking Mingguan" | FN-M11-3.6.1 |
| EL-M11-S2-113 | text | visible-default | "Jumlah soalan dijawab mengikut minggu — warna menunjukkan trend naik/turun" | FN-M11-3.6.1 |
| EL-M11-S2-114 | table | visible-default | columns Sekolah · M1 · M2 · M3 · M4 · M5 · M6 · M7 · M8 · M9 · M10 · M11 · M12 · M13 · M14 · M15 · M16 · M17 · M18 · M19 · M20 · M21 · M22 · M23 · M24 · M25 · M26 · M27 · M28 · M29 · M30 · M31 · M32 · Trend · Best | FN-M11-3.6.1 |
| EL-M11-S2-115 | text | visible-default | ": 16/02 - 22/02" | FN-M11-3.6.2 |
| EL-M11-S2-116 | text | visible-default | "M1" | FN-M11-3.6.2 |
| EL-M11-S2-117 | text | visible-default | ": 23/02 - 01/03" | FN-M11-3.6.2 |
| EL-M11-S2-118 | text | visible-default | "M2" | FN-M11-3.6.2 |
| EL-M11-S2-119 | text | visible-default | ": 02/03 - 08/03" | FN-M11-3.6.2 |
| EL-M11-S2-120 | text | visible-default | "M3" | FN-M11-3.6.2 |
| EL-M11-S2-121 | text | visible-default | ": 09/03 - 15/03" | FN-M11-3.6.2 |
| EL-M11-S2-122 | text | visible-default | "M4" | FN-M11-3.6.2 |
| EL-M11-S2-123 | text | visible-default | ": 16/03 - 22/03" | FN-M11-3.6.2 |
| EL-M11-S2-124 | text | visible-default | "M5" | FN-M11-3.6.2 |
| EL-M11-S2-125 | text | visible-default | ": 23/03 - 29/03" | FN-M11-3.6.2 |
| EL-M11-S2-126 | text | visible-default | "M6" | FN-M11-3.6.2 |
| EL-M11-S2-127 | text | visible-default | ": 30/03 - 05/04" | FN-M11-3.6.2 |
| EL-M11-S2-128 | text | visible-default | "M7" | FN-M11-3.6.2 |
| EL-M11-S2-129 | text | visible-default | ": 06/04 - 12/04" | FN-M11-3.6.2 |
| EL-M11-S2-130 | text | visible-default | "M8" | FN-M11-3.6.2 |
| EL-M11-S2-131 | text | visible-default | ": 13/04 - 19/04" | FN-M11-3.6.2 |
| EL-M11-S2-132 | text | visible-default | "M9" | FN-M11-3.6.2 |
| EL-M11-S2-133 | text | visible-default | ": 20/04 - 26/04" | FN-M11-3.6.2 |
| EL-M11-S2-134 | text | visible-default | "M10" | FN-M11-3.6.2 |
| EL-M11-S2-135 | text | visible-default | ": 27/04 - 03/05" | FN-M11-3.6.2 |
| EL-M11-S2-136 | text | visible-default | "M11" | FN-M11-3.6.2 |
| EL-M11-S2-137 | text | visible-default | ": 04/05 - 10/05" | FN-M11-3.6.2 |
| EL-M11-S2-138 | text | visible-default | "M12" | FN-M11-3.6.2 |
| EL-M11-S2-139 | text | visible-default | ": 11/05 - 17/05" | FN-M11-3.6.2 |
| EL-M11-S2-140 | text | visible-default | "M13" | FN-M11-3.6.2 |
| EL-M11-S2-141 | text | visible-default | ": 18/05 - 24/05" | FN-M11-3.6.2 |
| EL-M11-S2-142 | text | visible-default | "M14" | FN-M11-3.6.2 |
| EL-M11-S2-143 | text | visible-default | ": 25/05 - 31/05" | FN-M11-3.6.2 |
| EL-M11-S2-144 | text | visible-default | "M15" | FN-M11-3.6.2 |
| EL-M11-S2-145 | text | visible-default | ": 01/06 - 07/06" | FN-M11-3.6.2 |
| EL-M11-S2-146 | text | visible-default | "M16" | FN-M11-3.6.2 |
| EL-M11-S2-147 | text | visible-default | ": 08/06 - 14/06" | FN-M11-3.6.2 |
| EL-M11-S2-148 | text | visible-default | "M17" | FN-M11-3.6.2 |
| EL-M11-S2-149 | text | visible-default | ": 15/06 - 21/06" | FN-M11-3.6.2 |
| EL-M11-S2-150 | text | visible-default | "M18" | FN-M11-3.6.2 |
| EL-M11-S2-151 | text | visible-default | ": 22/06 - 28/06" | FN-M11-3.6.2 |
| EL-M11-S2-152 | text | visible-default | "M19" | FN-M11-3.6.2 |
| EL-M11-S2-153 | text | visible-default | ": 29/06 - 05/07" | FN-M11-3.6.2 |
| EL-M11-S2-154 | text | visible-default | "M20" | FN-M11-3.6.2 |
| EL-M11-S2-155 | text | visible-default | ": 06/07 - 12/07" | FN-M11-3.6.2 |
| EL-M11-S2-156 | text | visible-default | "M21" | FN-M11-3.6.2 |
| EL-M11-S2-157 | text | visible-default | ": 13/07 - 19/07" | FN-M11-3.6.2 |
| EL-M11-S2-158 | text | visible-default | "M22" | FN-M11-3.6.2 |
| EL-M11-S2-159 | text | visible-default | ": 20/07 - 26/07" | FN-M11-3.6.2 |
| EL-M11-S2-160 | text | visible-default | "M23" | FN-M11-3.6.2 |
| EL-M11-S2-161 | text | visible-default | ": 27/07 - 02/08" | FN-M11-3.6.2 |
| EL-M11-S2-162 | text | visible-default | "M24" | FN-M11-3.6.2 |
| EL-M11-S2-163 | text | visible-default | ": 03/08 - 09/08" | FN-M11-3.6.2 |
| EL-M11-S2-164 | text | visible-default | "M25" | FN-M11-3.6.2 |
| EL-M11-S2-165 | text | visible-default | ": 10/08 - 16/08" | FN-M11-3.6.2 |
| EL-M11-S2-166 | text | visible-default | "M26" | FN-M11-3.6.2 |
| EL-M11-S2-167 | text | visible-default | ": 17/08 - 23/08" | FN-M11-3.6.2 |
| EL-M11-S2-168 | text | visible-default | "M27" | FN-M11-3.6.2 |
| EL-M11-S2-169 | text | visible-default | ": 24/08 - 30/08" | FN-M11-3.6.2 |
| EL-M11-S2-170 | text | visible-default | "M28" | FN-M11-3.6.2 |
| EL-M11-S2-171 | text | visible-default | ": 31/08 - 06/09" | FN-M11-3.6.2 |
| EL-M11-S2-172 | text | visible-default | "M29" | FN-M11-3.6.2 |
| EL-M11-S2-173 | text | visible-default | ": 07/09 - 13/09" | FN-M11-3.6.2 |
| EL-M11-S2-174 | text | visible-default | "M30" | FN-M11-3.6.2 |
| EL-M11-S2-175 | text | visible-default | ": 14/09 - 20/09" | FN-M11-3.6.2 |
| EL-M11-S2-176 | text | visible-default | "M31" | FN-M11-3.6.2 |
| EL-M11-S2-177 | text | visible-default | ": 21/09 - 25/09" | FN-M11-3.6.2 |
| EL-M11-S2-178 | text | visible-default | "M32" | FN-M11-3.6.2 |
| EL-M11-S2-179 | card | visible-default | "Sekolah Terbaik" | FN-M11-3.7.1 |
| EL-M11-S2-180 | heading | visible-default | "Sekolah Terbaik" | FN-M11-3.7.1 |
| EL-M11-S2-181 | text | visible-default | "<school> — 100% penglibatan (1/1 pelajar aktif)" | FN-M11-3.7.1 |
| EL-M11-S2-182 | text | visible-default | "<school> — 100% penglibatan (1/1 pelajar aktif)" | FN-M11-3.7.1 |
| EL-M11-S2-183 | text | visible-default | "<school> — 100% penglibatan (1/1 pelajar aktif)" | FN-M11-3.7.1 |
| EL-M11-S2-184 | card | visible-default | "Perhatian Segera" | FN-M11-3.7.2 |
| EL-M11-S2-185 | heading | visible-default | "Perhatian Segera" | FN-M11-3.7.2 |
| EL-M11-S2-186 | text | visible-default | "<school> — 46/312 pelajar aktif (14.7%). Tahap rendah." | FN-M11-3.7.2 |
| EL-M11-S2-187 | text | visible-default | "<school> — Hanya 17/776 pelajar aktif (2.2%). Tahap kritikal." | FN-M11-3.7.2 |
| EL-M11-S2-188 | text | visible-default | "<school> — Hanya 1/675 pelajar aktif (0.1%). Tahap kritikal." | FN-M11-3.7.2 |
| EL-M11-S2-189 | text | visible-default | "<school> — 6 pelajar berdaftar tetapi tiada seorang pun yang menjawab soalan. Tiada sebara…" | FN-M11-3.7.2 |
| EL-M11-S2-190 | text | visible-default | "<school> — 8 pelajar berdaftar tetapi tiada seorang pun yang menjawab soalan. Tiada sebara…" | FN-M11-3.7.2 |
| EL-M11-S2-191 | text | visible-default | "<school> — 1 pelajar berdaftar tetapi tiada seorang pun yang menjawab soalan. Tiada sebara…" | FN-M11-3.7.2 |
| EL-M11-S2-192 | text | visible-default | "<school> — 5 pelajar berdaftar tetapi tiada seorang pun yang menjawab soalan. Tiada sebara…" | FN-M11-3.7.2 |
| EL-M11-S2-193 | text | visible-default | "<school> — 150 pelajar berdaftar tetapi tiada seorang pun yang menjawab soalan. Tiada seba…" | FN-M11-3.7.2 |
| EL-M11-S2-194 | text | visible-default | "<school> — 1 pelajar berdaftar tetapi tiada seorang pun yang menjawab soalan. Tiada sebara…" | FN-M11-3.7.2 |
| EL-M11-S2-195 | text | visible-default | "<school> — 1 pelajar berdaftar tetapi tiada seorang pun yang menjawab soalan. Tiada sebara…" | FN-M11-3.7.2 |
| EL-M11-S2-196 | text | visible-default | "<school> — 1 pelajar berdaftar tetapi tiada seorang pun yang menjawab soalan. Tiada sebara…" | FN-M11-3.7.2 |
| EL-M11-S2-197 | text | visible-default | "<school> — 8 pelajar berdaftar tetapi tiada seorang pun yang menjawab soalan. Tiada sebara…" | FN-M11-3.7.2 |
| EL-M11-S2-198 | text | visible-default | "<school> — 7 pelajar berdaftar tetapi tiada seorang pun yang menjawab soalan. Tiada sebara…" | FN-M11-3.7.2 |
| EL-M11-S2-199 | text | visible-default | "<school> — 7 pelajar berdaftar tetapi tiada seorang pun yang menjawab soalan. Tiada sebara…" | FN-M11-3.7.2 |
| EL-M11-S2-200 | text | visible-default | "<school> — 8 pelajar berdaftar tetapi tiada seorang pun yang menjawab soalan. Tiada sebara…" | FN-M11-3.7.2 |
| EL-M11-S2-201 | text | visible-default | "<school> — 1 pelajar berdaftar tetapi tiada seorang pun yang menjawab soalan. Tiada sebara…" | FN-M11-3.7.2 |
| EL-M11-S2-202 | text | visible-default | "<school> — 1 pelajar berdaftar tetapi tiada seorang pun yang menjawab soalan. Tiada sebara…" | FN-M11-3.7.2 |
| EL-M11-S2-203 | text | visible-default | "<school> — 6 pelajar berdaftar tetapi tiada seorang pun yang menjawab soalan. Tiada sebara…" | FN-M11-3.7.2 |
| EL-M11-S2-204 | card | visible-default | "Cadangan Tindakan" | FN-M11-3.7.3 |
| EL-M11-S2-205 | heading | visible-default | "Cadangan Tindakan" | FN-M11-3.7.3 |
| EL-M11-S2-206 | text | visible-default | "<school>: Penglibatan sangat rendah. Cadangan: Sesi motivasi dan demonstrasi penggunaan pl…" | FN-M11-3.7.3 |
| EL-M11-S2-207 | text | visible-default | "<school>: Penglibatan sangat rendah. Cadangan: Sesi motivasi dan demonstrasi penggunaan pl…" | FN-M11-3.7.3 |
| EL-M11-S2-208 | text | visible-default | "<school>: Hubungi pihak sekolah secara langsung untuk mengenal pasti halangan dan memberi …" | FN-M11-3.7.3 |
| EL-M11-S2-209 | text | visible-default | "<school>: Hubungi pihak sekolah secara langsung untuk mengenal pasti halangan dan memberi …" | FN-M11-3.7.3 |
| EL-M11-S2-210 | text | visible-default | "<school>: Hubungi pihak sekolah secara langsung untuk mengenal pasti halangan dan memberi …" | FN-M11-3.7.3 |
| EL-M11-S2-211 | text | visible-default | "<school>: Hubungi pihak sekolah secara langsung untuk mengenal pasti halangan dan memberi …" | FN-M11-3.7.3 |
| EL-M11-S2-212 | text | visible-default | "<school>: Guru telah login tetapi murid belum aktif. Cadangan: Adakan sesi hands-on dengan…" | FN-M11-3.7.3 |
| EL-M11-S2-213 | text | visible-default | "<school>: Guru telah login tetapi murid belum aktif. Cadangan: Adakan sesi hands-on dengan…" | FN-M11-3.7.3 |
| EL-M11-S2-214 | text | visible-default | "<school>: Hubungi pihak sekolah secara langsung untuk mengenal pasti halangan dan memberi …" | FN-M11-3.7.3 |
| EL-M11-S2-215 | text | visible-default | "<school>: Hubungi pihak sekolah secara langsung untuk mengenal pasti halangan dan memberi …" | FN-M11-3.7.3 |
| EL-M11-S2-216 | text | visible-default | "<school>: Hubungi pihak sekolah secara langsung untuk mengenal pasti halangan dan memberi …" | FN-M11-3.7.3 |
| EL-M11-S2-217 | text | visible-default | "<school>: Hubungi pihak sekolah secara langsung untuk mengenal pasti halangan dan memberi …" | FN-M11-3.7.3 |
| EL-M11-S2-218 | text | visible-default | "<school>: Hubungi pihak sekolah secara langsung untuk mengenal pasti halangan dan memberi …" | FN-M11-3.7.3 |
| EL-M11-S2-219 | text | visible-default | "<school>: Hubungi pihak sekolah secara langsung untuk mengenal pasti halangan dan memberi …" | FN-M11-3.7.3 |
| EL-M11-S2-220 | text | visible-default | "<school>: Hubungi pihak sekolah secara langsung untuk mengenal pasti halangan dan memberi …" | FN-M11-3.7.3 |
| EL-M11-S2-221 | text | visible-default | "<school>: Hubungi pihak sekolah secara langsung untuk mengenal pasti halangan dan memberi …" | FN-M11-3.7.3 |
| EL-M11-S2-222 | text | visible-default | "<school>: Hubungi pihak sekolah secara langsung untuk mengenal pasti halangan dan memberi …" | FN-M11-3.7.3 |
| EL-M11-S2-223 | link | conditional | "Reset", → /admin/monitoring, fa-times | FN-M11-3.2.2 |
| EL-M11-S2-224 | link | conditional | "PDF", → /admin/monitoring/export/pdf?state=Kelantan&tahap=Cemerlang, fa-file-pdf | FN-M11-3.2.3 |
| EL-M11-S2-225 | link | conditional | "CSV", → /admin/monitoring/export/csv?state=Kelantan&tahap=Cemerlang, fa-file-csv | FN-M11-3.2.3 |
| EL-M11-S2-226 | card | conditional | "2" | FN-M11-3.3.1 |
| EL-M11-S2-227 | card | conditional | "0" | FN-M11-3.3.1 |
| EL-M11-S2-228 | card | conditional | "0" | FN-M11-3.3.1 |
| EL-M11-S2-229 | card | conditional | "0%" | FN-M11-3.3.1 |
| EL-M11-S2-230 | text | conditional | "0%" | FN-M11-3.3.1 |
| EL-M11-S2-231 | card | conditional | "0" | FN-M11-3.3.1 |
| EL-M11-S2-232 | card | conditional | "0" | FN-M11-3.3.1 |
| EL-M11-S2-233 | card | conditional | "0" | FN-M11-3.3.2 |
| EL-M11-S2-234 | card | conditional | "0" | FN-M11-3.3.2 |
| EL-M11-S2-235 | card | conditional | "0%" | FN-M11-3.3.2 |
| EL-M11-S2-236 | text | conditional | "0%" | FN-M11-3.3.2 |
| EL-M11-S2-237 | text | conditional | "0 sekolah" | FN-M11-3.4.1 |
| EL-M11-S2-238 | text | conditional | "0 sekolah" | FN-M11-3.5.1 |
| EL-M11-S2-239 | empty-state | conditional | "Tiada pemerhatian yang perlu diberi perhatian buat masa ini." | FN-M11-3.7.4 |
| EL-M11-S2-240 | link | conditional | "PDF", → /admin/monitoring/export/pdf?period=3m, fa-file-pdf | FN-M11-3.2.3 |
| EL-M11-S2-241 | link | conditional | "CSV", → /admin/monitoring/export/csv?period=3m, fa-file-csv | FN-M11-3.2.3 |
| EL-M11-S2-242 | card | conditional | "7.2%" | FN-M11-3.3.1 |
| EL-M11-S2-243 | text | conditional | "7.2%" | FN-M11-3.3.1 |
| EL-M11-S2-244 | card | conditional | "86,587" | FN-M11-3.3.1 |
| EL-M11-S2-245 | card | conditional | "290.6" | FN-M11-3.3.1 |
| EL-M11-S2-246 | text | conditional | "<school> — 99/560 pelajar aktif (17.7%). Tahap rendah." | FN-M11-3.7.2 |
| EL-M11-S2-247 | text | conditional | "<school> — 78/549 pelajar aktif (14.2%). Tahap rendah." | FN-M11-3.7.2 |
| EL-M11-S2-248 | text | conditional | "<school> — 54/423 pelajar aktif (12.8%). Tahap rendah." | FN-M11-3.7.2 |
| EL-M11-S2-249 | text | conditional | "<school> — Hanya 19/385 pelajar aktif (4.9%). Tahap kritikal." | FN-M11-3.7.2 |
| EL-M11-S2-250 | text | conditional | "<school> — Hanya 6/312 pelajar aktif (1.9%). Tahap kritikal." | FN-M11-3.7.2 |
| EL-M11-S2-251 | text | conditional | "<school> — 675 pelajar berdaftar tetapi tiada seorang pun yang menjawab soalan. Tiada seba…" | FN-M11-3.7.2 |
| EL-M11-S2-252 | text | conditional | "<school> — 5 pelajar berdaftar tetapi tiada seorang pun yang menjawab soalan. Tiada sebara…" | FN-M11-3.7.2 |
| EL-M11-S2-253 | text | conditional | "<school> — 150 pelajar berdaftar tetapi tiada seorang pun yang menjawab soalan. Tiada seba…" | FN-M11-3.7.2 |
| EL-M11-S2-254 | text | conditional | "<school> — 2 pelajar berdaftar tetapi tiada seorang pun yang menjawab soalan. Tiada sebara…" | FN-M11-3.7.2 |
| EL-M11-S2-255 | text | conditional | "<school> — 1 pelajar berdaftar tetapi tiada seorang pun yang menjawab soalan. Tiada sebara…" | FN-M11-3.7.2 |
| EL-M11-S2-256 | text | conditional | "<school> — 16 pelajar berdaftar tetapi tiada seorang pun yang menjawab soalan. Tiada sebar…" | FN-M11-3.7.2 |
| EL-M11-S2-257 | text | conditional | "<school> — 53 pelajar berdaftar tetapi tiada seorang pun yang menjawab soalan. Tiada sebar…" | FN-M11-3.7.2 |
| EL-M11-S2-258 | text | conditional | "<school> — 1 pelajar berdaftar tetapi tiada seorang pun yang menjawab soalan. Tiada sebara…" | FN-M11-3.7.2 |
| EL-M11-S2-259 | text | conditional | "<school> — 1 pelajar berdaftar tetapi tiada seorang pun yang menjawab soalan. Tiada sebara…" | FN-M11-3.7.2 |
| EL-M11-S2-260 | text | conditional | "<school>: Guru telah login tetapi murid belum aktif. Cadangan: Adakan sesi hands-on dengan…" | FN-M11-3.7.3 |
| EL-M11-S2-261 | text | conditional | "<school>: Guru telah login tetapi murid belum aktif. Cadangan: Adakan sesi hands-on dengan…" | FN-M11-3.7.3 |
| EL-M11-S2-262 | text | conditional | "<school>: Hubungi pihak sekolah secara langsung untuk mengenal pasti halangan dan memberi …" | FN-M11-3.7.3 |
| EL-M11-S2-263 | text | conditional | "<school>: Guru telah login tetapi murid belum aktif. Cadangan: Adakan sesi hands-on dengan…" | FN-M11-3.7.3 |
| EL-M11-S2-264 | text | conditional | "<school>: Hubungi pihak sekolah secara langsung untuk mengenal pasti halangan dan memberi …" | FN-M11-3.7.3 |
| EL-M11-S2-265 | text | conditional | "<school>: Hubungi pihak sekolah secara langsung untuk mengenal pasti halangan dan memberi …" | FN-M11-3.7.3 |
| EL-M11-S2-266 | text | conditional | "<school>: Hubungi pihak sekolah secara langsung untuk mengenal pasti halangan dan memberi …" | FN-M11-3.7.3 |
| EL-M11-S2-267 | text | conditional | "<school>: Hubungi pihak sekolah secara langsung untuk mengenal pasti halangan dan memberi …" | FN-M11-3.7.3 |
| EL-M11-S2-268 | text | conditional | "<school>: Hubungi pihak sekolah secara langsung untuk mengenal pasti halangan dan memberi …" | FN-M11-3.7.3 |
| EL-M11-S2-269 | link | conditional | "PDF", → /admin/monitoring/export/pdf?period=7d, fa-file-pdf | FN-M11-3.2.3 |
| EL-M11-S2-270 | link | conditional | "CSV", → /admin/monitoring/export/csv?period=7d, fa-file-csv | FN-M11-3.2.3 |
| EL-M11-S2-271 | card | conditional | "44" | FN-M11-3.3.1 |
| EL-M11-S2-272 | card | conditional | "1.1%" | FN-M11-3.3.1 |
| EL-M11-S2-273 | text | conditional | "1.1%" | FN-M11-3.3.1 |
| EL-M11-S2-274 | card | conditional | "7,586" | FN-M11-3.3.1 |
| EL-M11-S2-275 | card | conditional | "172.4" | FN-M11-3.3.1 |
| EL-M11-S2-276 | text | conditional | "<school> — 12/184 pelajar aktif (6.5%). Tahap rendah." | FN-M11-3.7.2 |
| EL-M11-S2-277 | text | conditional | "<school> — Hanya 14/560 pelajar aktif (2.5%). Tahap kritikal." | FN-M11-3.7.2 |
| EL-M11-S2-278 | text | conditional | "<school> — Hanya 10/549 pelajar aktif (1.8%). Tahap kritikal." | FN-M11-3.7.2 |
| EL-M11-S2-279 | text | conditional | "<school> — Hanya 5/423 pelajar aktif (1.2%). Tahap kritikal." | FN-M11-3.7.2 |
| EL-M11-S2-280 | text | conditional | "<school> — Hanya 2/385 pelajar aktif (0.5%). Tahap kritikal." | FN-M11-3.7.2 |
| EL-M11-S2-281 | text | conditional | "<school> — 150 pelajar berdaftar tetapi tiada seorang pun yang menjawab soalan. Tiada seba…" | FN-M11-3.7.2 |
| EL-M11-S2-282 | text | conditional | "<school> — 1 pelajar berdaftar tetapi tiada seorang pun yang menjawab soalan. Tiada sebara…" | FN-M11-3.7.2 |
| EL-M11-S2-283 | text | conditional | "<school> — 2 pelajar berdaftar tetapi tiada seorang pun yang menjawab soalan. Tiada sebara…" | FN-M11-3.7.2 |
| EL-M11-S2-284 | text | conditional | "<school>: Penglibatan sangat rendah. Cadangan: Sesi motivasi dan demonstrasi penggunaan pl…" | FN-M11-3.7.3 |
| EL-M11-S2-285 | text | conditional | "<school>: Penglibatan sangat rendah. Cadangan: Sesi motivasi dan demonstrasi penggunaan pl…" | FN-M11-3.7.3 |
| EL-M11-S2-286 | text | conditional | "<school>: Guru telah login tetapi murid belum aktif. Cadangan: Adakan sesi hands-on dengan…" | FN-M11-3.7.3 |
| EL-M11-S2-287 | text | conditional | "<school>: Hubungi pihak sekolah secara langsung untuk mengenal pasti halangan dan memberi …" | FN-M11-3.7.3 |
| EL-M11-S2-288 | text | conditional | "<school>: Guru telah login tetapi murid belum aktif. Cadangan: Adakan sesi hands-on dengan…" | FN-M11-3.7.3 |
| EL-M11-S2-289 | link | conditional | "PDF", → /admin/monitoring/export/pdf?state=Selangor&tahap=Kritikal, fa-file-pdf | FN-M11-3.2.3 |
| EL-M11-S2-290 | link | conditional | "CSV", → /admin/monitoring/export/csv?state=Selangor&tahap=Kritikal, fa-file-csv | FN-M11-3.2.3 |
| EL-M11-S2-291 | card | conditional | "28" | FN-M11-3.3.1 |
| EL-M11-S2-292 | card | conditional | "52.8%" | FN-M11-3.3.2 |
| EL-M11-S2-293 | text | conditional | "52.8%" | FN-M11-3.3.2 |
| EL-M11-S2-294 | text | conditional | "2 sekolah" | FN-M11-3.4.1 |
| EL-M11-S2-295 | text | conditional | "10 sekolah" | FN-M11-3.5.1 |
| EL-M11-S2-296 | link | conditional | "PDF", → /admin/monitoring/export/pdf?period=30d, fa-file-pdf | FN-M11-3.2.3 |
| EL-M11-S2-297 | link | conditional | "CSV", → /admin/monitoring/export/csv?period=30d, fa-file-csv | FN-M11-3.2.3 |
| EL-M11-S2-298 | card | conditional | "89" | FN-M11-3.3.1 |
| EL-M11-S2-299 | card | conditional | "2.1%" | FN-M11-3.3.1 |
| EL-M11-S2-300 | text | conditional | "2.1%" | FN-M11-3.3.1 |
| EL-M11-S2-301 | card | conditional | "22,207" | FN-M11-3.3.1 |
| EL-M11-S2-302 | card | conditional | "249.5" | FN-M11-3.3.1 |
| EL-M11-S2-303 | text | conditional | "<school> — 18/184 pelajar aktif (9.8%). Tahap rendah." | FN-M11-3.7.2 |
| EL-M11-S2-304 | text | conditional | "<school> — Hanya 26/549 pelajar aktif (4.7%). Tahap kritikal." | FN-M11-3.7.2 |
| EL-M11-S2-305 | text | conditional | "<school> — Hanya 23/560 pelajar aktif (4.1%). Tahap kritikal." | FN-M11-3.7.2 |
| EL-M11-S2-306 | text | conditional | "<school> — Hanya 16/423 pelajar aktif (3.8%). Tahap kritikal." | FN-M11-3.7.2 |
| EL-M11-S2-307 | text | conditional | "<school> — Hanya 5/385 pelajar aktif (1.3%). Tahap kritikal." | FN-M11-3.7.2 |
| EL-M11-S2-308 | text | conditional | "<school> — 776 pelajar berdaftar tetapi tiada seorang pun yang menjawab soalan. Tiada seba…" | FN-M11-3.7.2 |

#### S3 — `/guru/monitoring/sekolah/{id}` (111 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M11-S3-001 | card | visible-default | "<school>" | FN-M11-4.1.1 |
| EL-M11-S3-002 | heading | visible-default | "<school>" | FN-M11-4.1.1 |
| EL-M11-S3-003 | text | visible-default | "<kod>", fa-hashtag | FN-M11-4.1.1 |
| EL-M11-S3-004 | text | visible-default | "Selangor", fa-map-marker-alt | FN-M11-4.1.1 |
| EL-M11-S3-005 | text | visible-default | "Active — sehingga 12 May 2027", fa-circle | FN-M11-4.1.1 |
| EL-M11-S3-006 | text | visible-default | "Cemerlang — 89.7%" | FN-M11-4.1.1 |
| EL-M11-S3-007 | card | visible-default | "184" | FN-M11-4.1.2 |
| EL-M11-S3-008 | text | visible-default | "Pelajar T4/T5" | FN-M11-4.1.2 |
| EL-M11-S3-009 | text | visible-default | "184" | FN-M11-4.1.2 |
| EL-M11-S3-010 | card | visible-default | "165" | FN-M11-4.1.2 |
| EL-M11-S3-011 | text | visible-default | "Pernah Aktif" | FN-M11-4.1.2 |
| EL-M11-S3-012 | text | visible-default | "165" | FN-M11-4.1.2 |
| EL-M11-S3-013 | card | visible-default | "53,494" | FN-M11-4.1.2 |
| EL-M11-S3-014 | text | visible-default | "Soalan Dijawab" | FN-M11-4.1.2 |
| EL-M11-S3-015 | text | visible-default | "53,494" | FN-M11-4.1.2 |
| EL-M11-S3-016 | card | visible-default | "34" | FN-M11-4.1.2 |
| EL-M11-S3-017 | text | visible-default | "Guru Berdaftar" | FN-M11-4.1.2 |
| EL-M11-S3-018 | text | visible-default | "34" | FN-M11-4.1.2 |
| EL-M11-S3-019 | card | visible-default | "34" | FN-M11-4.1.2 |
| EL-M11-S3-020 | text | visible-default | "Guru Pernah Login" | FN-M11-4.1.2 |
| EL-M11-S3-021 | text | visible-default | "34" | FN-M11-4.1.2 |
| EL-M11-S3-022 | card | visible-default | "Senarai Pelajar T4/T5" | FN-M11-4.1.3 |
| EL-M11-S3-023 | heading | visible-default | "Senarai Pelajar T4/T5" | FN-M11-4.1.3 |
| EL-M11-S3-024 | button | visible-default | "Semua (184)" | FN-M11-4.1.3 |
| EL-M11-S3-025 | button | visible-default | "Aktif (165)" | FN-M11-4.1.3 |
| EL-M11-S3-026 | button | visible-default | "Login sahaja" | FN-M11-4.1.3 |
| EL-M11-S3-027 | button | visible-default | "Belum login" | FN-M11-4.1.3 |
| EL-M11-S3-028 | input | visible-default | input | FN-M11-4.1.4 |
| EL-M11-S3-029 | text | visible-default | "⚠" | FN-M11-4.1.5 |
| EL-M11-S3-030 | text | visible-default | "menunjukkan aktiviti luar biasa (kelajuan menjawab tidak munasabah — perlu semak). daripad…" | FN-M11-4.1.5 |
| EL-M11-S3-031 | text | visible-default | "19 akaun" | FN-M11-4.1.5 |
| EL-M11-S3-032 | text | visible-default | "9" | FN-M11-4.1.5 |
| EL-M11-S3-033 | table | visible-default | columns # · Nama · Tingkatan · Soalan · Status · Login Terakhir · Aktiviti Terakhir | FN-M11-4.1.6 |
| EL-M11-S3-034 | link | visible-default | "<name>", → /admin/monitoring/sekolah/8080/pelajar/{id} | FN-M11-4.1.6 |
| EL-M11-S3-035 | badge | visible-default | "Aktif" | FN-M11-4.1.6 |
| EL-M11-S3-036 | link | visible-default | "<name>", → /admin/monitoring/sekolah/8080/pelajar/{id} | FN-M11-4.1.6 |
| EL-M11-S3-037 | badge | visible-default | "Aktif" | FN-M11-4.1.6 |
| EL-M11-S3-038 | link | visible-default | "<name>", → /admin/monitoring/sekolah/8080/pelajar/{id} | FN-M11-4.1.6 |
| EL-M11-S3-039 | badge | visible-default | "Aktif" | FN-M11-4.1.6 |
| EL-M11-S3-040 | link | visible-default | "<name>", → /admin/monitoring/sekolah/8080/pelajar/{id} | FN-M11-4.1.6 |
| EL-M11-S3-041 | badge | visible-default | "Aktif" | FN-M11-4.1.6 |
| EL-M11-S3-042 | link | visible-default | "<name>", → /admin/kirkpatrick/pelajar/{id} | FN-M11-4.1.6 |
| EL-M11-S3-043 | badge | visible-default | "Login sahaja" | FN-M11-4.1.6 |
| EL-M11-S3-044 | link | visible-default | "<name>", → /admin/kirkpatrick/pelajar/{id} | FN-M11-4.1.6 |
| EL-M11-S3-045 | badge | visible-default | "Belum login" | FN-M11-4.1.6 |
| EL-M11-S3-046 | card | visible-default | "Senarai Guru (34)" | FN-M11-4.1.7 |
| EL-M11-S3-047 | heading | visible-default | "Senarai Guru (34)" | FN-M11-4.1.7 |
| EL-M11-S3-048 | button | visible-default | "Semua" | FN-M11-4.1.7 |
| EL-M11-S3-049 | button | visible-default | "Pernah Login" | FN-M11-4.1.7 |
| EL-M11-S3-050 | button | visible-default | "Belum Login" | FN-M11-4.1.7 |
| EL-M11-S3-051 | table | visible-default | columns # · Nama · Status · Login Terakhir · Daftar | FN-M11-4.1.7 |
| EL-M11-S3-052 | link | visible-default | "<name>", → /admin/monitoring/sekolah/8080/guru/{id} | FN-M11-4.1.7 |
| EL-M11-S3-053 | badge | visible-default | "Pernah login" | FN-M11-4.1.7 |
| EL-M11-S3-054 | link | visible-default | "<name>", → /admin/monitoring/sekolah/8080/guru/{id} | FN-M11-4.1.7 |
| EL-M11-S3-055 | badge | visible-default | "Pernah login" | FN-M11-4.1.7 |
| EL-M11-S3-056 | empty-state | conditional | "Tiada langganan" | FN-M11-4.1.1 |
| EL-M11-S3-057 | text | conditional | "Cemerlang — 100%" | FN-M11-4.1.1 |
| EL-M11-S3-058 | card | conditional | "1" | FN-M11-4.1.2 |
| EL-M11-S3-059 | card | conditional | "1" | FN-M11-4.1.2 |
| EL-M11-S3-060 | card | conditional | "10" | FN-M11-4.1.2 |
| EL-M11-S3-061 | card | conditional | "0" | FN-M11-4.1.2 |
| EL-M11-S3-062 | card | conditional | "0" | FN-M11-4.1.2 |
| EL-M11-S3-063 | button | conditional | "Semua (1)" | FN-M11-4.1.3 |
| EL-M11-S3-064 | button | conditional | "Aktif (1)" | FN-M11-4.1.3 |
| EL-M11-S3-065 | card | conditional | "Senarai Guru (0)" | FN-M11-4.1.8 |
| EL-M11-S3-066 | heading | conditional | "Senarai Guru (0)" | FN-M11-4.1.8 |
| EL-M11-S3-067 | empty-state | conditional | "Tiada guru berdaftar untuk sekolah ini." | FN-M11-4.1.8 |
| EL-M11-S3-068 | text | conditional | "404" | FN-M11-1.2.2 |
| EL-M11-S3-069 | text | conditional | "🔍" | FN-M11-1.2.2 |
| EL-M11-S3-070 | heading | conditional | "Halaman Tidak Dijumpai" | FN-M11-1.2.2 |
| EL-M11-S3-071 | text | conditional | "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?" | FN-M11-1.2.2 |
| EL-M11-S3-072 | link | conditional | "Halaman Utama", → / | FN-M11-1.2.2 |
| EL-M11-S3-073 | link | conditional | "Mula Latihan", → /latih-tubi | FN-M11-1.2.2 |
| EL-M11-S3-074 | text | conditional | "PRESTASIPLUS" | FN-M11-1.2.2 |
| EL-M11-S3-075 | text | conditional | "Cancelled — sehingga 12 May 2027", fa-circle | FN-M11-4.1.1 |
| EL-M11-S3-076 | text | conditional | "Kritikal — 2.2%" | FN-M11-4.1.1 |
| EL-M11-S3-077 | card | conditional | "17" | FN-M11-4.1.2 |
| EL-M11-S3-078 | card | conditional | "1,130" | FN-M11-4.1.2 |
| EL-M11-S3-079 | card | conditional | "43" | FN-M11-4.1.2 |
| EL-M11-S3-080 | button | conditional | "Aktif (17)" | FN-M11-4.1.3 |
| EL-M11-S3-081 | card | conditional | "Senarai Guru (118)" | FN-M11-4.1.7 |
| EL-M11-S3-082 | heading | conditional | "Senarai Guru (118)" | FN-M11-4.1.7 |
| EL-M11-S3-083 | badge | conditional | "Belum login" | FN-M11-4.1.7 |
| EL-M11-S3-084 | badge | conditional | "Belum login" | FN-M11-4.1.7 |
| EL-M11-S3-085 | text | conditional | "Expired — sehingga 22 May 2026", fa-circle | FN-M11-4.1.1 |
| EL-M11-S3-086 | text | conditional | "Kritikal — 0.1%" | FN-M11-4.1.1 |
| EL-M11-S3-087 | card | conditional | "25" | FN-M11-4.1.2 |
| EL-M11-S3-088 | card | conditional | "20" | FN-M11-4.1.2 |
| EL-M11-S3-089 | card | conditional | "4" | FN-M11-4.1.2 |
| EL-M11-S3-090 | card | conditional | "Senarai Guru (20)" | FN-M11-4.1.7 |
| EL-M11-S3-091 | heading | conditional | "Senarai Guru (20)" | FN-M11-4.1.7 |
| EL-M11-S3-092 | text | conditional | "Active — sehingga 19 Apr 2027", fa-circle | FN-M11-4.1.1 |
| EL-M11-S3-093 | text | conditional | "Rendah — 14.7%" | FN-M11-4.1.1 |
| EL-M11-S3-094 | card | conditional | "46" | FN-M11-4.1.2 |
| EL-M11-S3-095 | card | conditional | "6,779" | FN-M11-4.1.2 |
| EL-M11-S3-096 | card | conditional | "44" | FN-M11-4.1.2 |
| EL-M11-S3-097 | card | conditional | "13" | FN-M11-4.1.2 |
| EL-M11-S3-098 | button | conditional | "Aktif (46)" | FN-M11-4.1.3 |
| EL-M11-S3-099 | text | conditional | "3 akaun" | FN-M11-4.1.5 |
| EL-M11-S3-100 | card | conditional | "Senarai Guru (44)" | FN-M11-4.1.7 |
| EL-M11-S3-101 | heading | conditional | "Senarai Guru (44)" | FN-M11-4.1.7 |
| EL-M11-S3-102 | text | conditional | "Kuala Lumpur", fa-map-marker-alt | FN-M11-4.1.1 |
| EL-M11-S3-103 | text | conditional | "Active — sehingga 11 May 2027", fa-circle | FN-M11-4.1.1 |
| EL-M11-S3-104 | text | conditional | "Sederhana — 50%" | FN-M11-4.1.1 |
| EL-M11-S3-105 | card | conditional | "2" | FN-M11-4.1.2 |
| EL-M11-S3-106 | card | conditional | "2" | FN-M11-4.1.2 |
| EL-M11-S3-107 | card | conditional | "2" | FN-M11-4.1.2 |
| EL-M11-S3-108 | button | conditional | "Semua (2)" | FN-M11-4.1.3 |
| EL-M11-S3-109 | text | conditional | "1 akaun" | FN-M11-4.1.5 |
| EL-M11-S3-110 | card | conditional | "Senarai Guru (2)" | FN-M11-4.1.7 |
| EL-M11-S3-111 | heading | conditional | "Senarai Guru (2)" | FN-M11-4.1.7 |

#### S4 — `/guru/monitoring/sekolah/{id}/pelajar/{id}` (372 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M11-S4-001 | card | visible-default | "<person>" | FN-M11-4.2.1 |
| EL-M11-S4-002 | heading | visible-default | "<person>" | FN-M11-4.2.1 |
| EL-M11-S4-003 | text | visible-default | "<email> · T5" | FN-M11-4.2.1 |
| EL-M11-S4-004 | text | visible-default | "Aktiviti Terakhir: 16/06/2026 14:19" | FN-M11-4.2.1 |
| EL-M11-S4-005 | card | visible-default | "71" | FN-M11-4.2.2 |
| EL-M11-S4-006 | text | visible-default | "Soalan Dijawab" | FN-M11-4.2.2 |
| EL-M11-S4-007 | text | visible-default | "71" | FN-M11-4.2.2 |
| EL-M11-S4-008 | card | visible-default | "53" | FN-M11-4.2.2 |
| EL-M11-S4-009 | text | visible-default | "Betul" | FN-M11-4.2.2 |
| EL-M11-S4-010 | text | visible-default | "53" | FN-M11-4.2.2 |
| EL-M11-S4-011 | card | visible-default | "18" | FN-M11-4.2.2 |
| EL-M11-S4-012 | text | visible-default | "Salah" | FN-M11-4.2.2 |
| EL-M11-S4-013 | text | visible-default | "18" | FN-M11-4.2.2 |
| EL-M11-S4-014 | card | visible-default | "74.6%" | FN-M11-4.2.2 |
| EL-M11-S4-015 | text | visible-default | "Ketepatan" | FN-M11-4.2.2 |
| EL-M11-S4-016 | text | visible-default | "74.6%" | FN-M11-4.2.2 |
| EL-M11-S4-017 | tab | visible-default | "Mengikut Subjek", fa-book | FN-M11-4.2.3 |
| EL-M11-S4-018 | tab | visible-default | "Mengikut Tajuk", fa-layer-group | FN-M11-4.2.3 |
| EL-M11-S4-019 | tab | visible-default | "Senarai Soalan", fa-list | FN-M11-4.2.3 |
| EL-M11-S4-020 | tab | visible-default | "Jawapan Salah 18", fa-times-circle | FN-M11-4.2.3 |
| EL-M11-S4-021 | badge | visible-default | "18" | FN-M11-4.2.3 |
| EL-M11-S4-022 | tab | visible-default | "Gap Analysis 0", fa-crosshairs | FN-M11-4.2.3 |
| EL-M11-S4-023 | badge | visible-default | "0" | FN-M11-4.2.3 |
| EL-M11-S4-024 | card | visible-default | "Mengikut Subjek" | FN-M11-4.2.4 |
| EL-M11-S4-025 | heading | visible-default | "Mengikut Subjek" | FN-M11-4.2.4 |
| EL-M11-S4-026 | text | visible-default | "Bahasa Melayu" | FN-M11-4.2.4 |
| EL-M11-S4-027 | badge | visible-default | "100.0%" | FN-M11-4.2.4 |
| EL-M11-S4-028 | text | visible-default | "31/31" | FN-M11-4.2.4 |
| EL-M11-S4-029 | text | visible-default | "Sejarah" | FN-M11-4.2.4 |
| EL-M11-S4-030 | badge | visible-default | "64.0%" | FN-M11-4.2.4 |
| EL-M11-S4-031 | text | visible-default | "16/25" | FN-M11-4.2.4 |
| EL-M11-S4-032 | text | visible-default | "Bahasa Inggeris" | FN-M11-4.2.4 |
| EL-M11-S4-033 | badge | visible-default | "40.0%" | FN-M11-4.2.4 |
| EL-M11-S4-034 | text | visible-default | "6/15" | FN-M11-4.2.4 |
| EL-M11-S4-035 | card | conditional | "Mengikut Tajuk" | FN-M11-4.2.5 |
| EL-M11-S4-036 | heading | conditional | "Mengikut Tajuk" | FN-M11-4.2.5 |
| EL-M11-S4-037 | text | conditional | "Bahasa Inggeris" | FN-M11-4.2.5 |
| EL-M11-S4-038 | text | conditional | "Umum" | FN-M11-4.2.5 |
| EL-M11-S4-039 | text | conditional | "20.0%" | FN-M11-4.2.5 |
| EL-M11-S4-040 | text | conditional | "2/10" | FN-M11-4.2.5 |
| EL-M11-S4-041 | badge | conditional | "Lemah" | FN-M11-4.2.5 |
| EL-M11-S4-042 | text | conditional | "Bab 1" | FN-M11-4.2.5 |
| EL-M11-S4-043 | text | conditional | "Reading for main ideas" | FN-M11-4.2.5 |
| EL-M11-S4-044 | text | conditional | "80.0%" | FN-M11-4.2.5 |
| EL-M11-S4-045 | text | conditional | "4/5" | FN-M11-4.2.5 |
| EL-M11-S4-046 | badge | conditional | "Kuat" | FN-M11-4.2.5 |
| EL-M11-S4-047 | text | conditional | "Bahasa Melayu" | FN-M11-4.2.5 |
| EL-M11-S4-048 | text | conditional | "Sejarah" | FN-M11-4.2.5 |
| EL-M11-S4-049 | text | conditional | "Bab 1" | FN-M11-4.2.5 |
| EL-M11-S4-050 | text | conditional | "Warisan Negara Bangsa" | FN-M11-4.2.5 |
| EL-M11-S4-051 | text | conditional | "60.0%" | FN-M11-4.2.5 |
| EL-M11-S4-052 | text | conditional | "12/20" | FN-M11-4.2.5 |
| EL-M11-S4-053 | badge | conditional | "Sederhana" | FN-M11-4.2.5 |
| EL-M11-S4-054 | card | conditional | "Senarai Soalan (71 tersedia daripada 71)" | FN-M11-4.2.6 |
| EL-M11-S4-055 | heading | conditional | "Senarai Soalan (71 tersedia daripada 71)" | FN-M11-4.2.6 |
| EL-M11-S4-056 | table | conditional | columns # · Soalan · Subjek · Jawapan · Betul · Status · Tarikh | FN-M11-4.2.6 |
| EL-M11-S4-057 | clickable | conditional | "1 Apakah ciri negara berdaulat? I II III IV Pentadbiran yang sistematik Sempadan y... Seja…", fa-external-link-alt | FN-M11-4.2.6 |
| EL-M11-S4-058 | clickable | conditional | "2 Apakah ciri Moden Perlembangaan Persekutuan? Sejarah C B 16/06/2026 14:19", fa-external-link-alt | FN-M11-4.2.6 |
| EL-M11-S4-059 | clickable | conditional | "5 OIC (Pertubuhan Kerjasama Islam) adalah pertubuhan yang Sejarah D D 16/06/2026 14:19", fa-external-link-alt | FN-M11-4.2.6 |
| EL-M11-S4-060 | clickable | conditional | "7 Apakah kepentingan perayaan bersama seperti Hari Raya, Tahun Baru Cina, dan Deep... Seja…", fa-external-link-alt | FN-M11-4.2.6 |
| EL-M11-S4-061 | button | conditional | "Papar lagi 20 (20/71)", fa-chevron-down | FN-M11-4.2.6 |
| EL-M11-S4-062 | card | conditional | "Jawapan Salah (18 jawapan, 18 soalan unik)" | FN-M11-4.2.7 |
| EL-M11-S4-063 | heading | conditional | "Jawapan Salah (18 jawapan, 18 soalan unik)" | FN-M11-4.2.7 |
| EL-M11-S4-064 | text | conditional | "#1 · Sejarah · Sejarah Tingkatan 5 KSSM" | FN-M11-4.2.7 |
| EL-M11-S4-065 | text | conditional | "16/06/2026 14:19" | FN-M11-4.2.7 |
| EL-M11-S4-066 | text | conditional | "Apakah ciri negara berdaulat? I II III IV Pentadbiran yang sistematik Sempadan yang jelas …" | FN-M11-4.2.7 |
| EL-M11-S4-067 | badge | conditional | "D" | FN-M11-4.2.7 |
| EL-M11-S4-068 | text | conditional | "I dan II" | FN-M11-4.2.7 |
| EL-M11-S4-069 | text | conditional | "Jawapan betul" | FN-M11-4.2.7 |
| EL-M11-S4-070 | badge | conditional | "A" | FN-M11-4.2.7 |
| EL-M11-S4-071 | text | conditional | "I dan IV" | FN-M11-4.2.7 |
| EL-M11-S4-072 | text | conditional | "Jawapan pelajar" | FN-M11-4.2.7 |
| EL-M11-S4-073 | text | conditional | "[AI-repaired 2026-04-22] Ciri negara berdaulat termasuk pentadbiran yang sistematik dan se…" | FN-M11-4.2.7 |
| EL-M11-S4-074 | text | conditional | "Sumber: Percubaan SPM 2025 Sejarah Melaka", fa-bookmark | FN-M11-4.2.7 |
| EL-M11-S4-075 | text | conditional | "#2 · Sejarah · Sejarah Tingkatan 5 KSSM" | FN-M11-4.2.7 |
| EL-M11-S4-076 | text | conditional | "16/06/2026 14:19" | FN-M11-4.2.7 |
| EL-M11-S4-077 | text | conditional | "Apakah ciri Moden Perlembangaan Persekutuan?" | FN-M11-4.2.7 |
| EL-M11-S4-078 | badge | conditional | "B" | FN-M11-4.2.7 |
| EL-M11-S4-079 | text | conditional | "Sarawak dan Sabah diberi beberapa autonomi" | FN-M11-4.2.7 |
| EL-M11-S4-080 | text | conditional | "Jawapan betul" | FN-M11-4.2.7 |
| EL-M11-S4-081 | badge | conditional | "C" | FN-M11-4.2.7 |
| EL-M11-S4-082 | text | conditional | "Keberkesanan pentadbiran" | FN-M11-4.2.7 |
| EL-M11-S4-083 | text | conditional | "Jawapan pelajar" | FN-M11-4.2.7 |
| EL-M11-S4-084 | text | conditional | "Jawapan yang betul ialah Sarawak dan Sabah diberi beberapa autonomi. Pilihan ini paling te…" | FN-M11-4.2.7 |
| EL-M11-S4-085 | text | conditional | "Sumber: Percubaan SPM 2025 Sejarah Johor Muar", fa-bookmark | FN-M11-4.2.7 |
| EL-M11-S4-086 | card | hidden-only | "Gap Analysis & Cadangan Latihan" | FN-M11-4.2.8 |
| EL-M11-S4-087 | heading | hidden-only | "Gap Analysis & Cadangan Latihan" | FN-M11-4.2.8 |
| EL-M11-S4-088 | text | hidden-only | "Topik lemah dikesan automatik berdasarkan jawapan pelajar. Soalan latihan dicadangkan untu…" | FN-M11-4.2.8 |
| EL-M11-S4-089 | empty-state | hidden-only | "Tiada topik lemah dikesan!" | FN-M11-4.2.8 |
| EL-M11-S4-090 | text | hidden-only | "Semua topik yang dicuba mempunyai ketepatan melebihi 60%." | FN-M11-4.2.8 |
| EL-M11-S4-091 | heading | hidden-only | "Subjek Belum Dicuba" | FN-M11-4.2.8 |
| EL-M11-S4-092 | badge | hidden-only | "Bahasa Melayu" | FN-M11-4.2.8 |
| EL-M11-S4-093 | badge | hidden-only | "Bahasa Inggeris" | FN-M11-4.2.8 |
| EL-M11-S4-094 | badge | hidden-only | "Matematik" | FN-M11-4.2.8 |
| EL-M11-S4-095 | card | visible-default | "Pemerhatian" | FN-M11-4.2.9 |
| EL-M11-S4-096 | heading | visible-default | "Pemerhatian" | FN-M11-4.2.9 |
| EL-M11-S4-097 | text | visible-default | "Kekuatan dalam Bahasa Melayu (100.0% ketepatan). Boleh jadikan motivasi." | FN-M11-4.2.9 |
| EL-M11-S4-098 | text | visible-default | "Kerap salah dalam Bahasa Inggeris (9/15 salah = 40.0% ketepatan). Cadangan: Fokus latihan …" | FN-M11-4.2.9 |
| EL-M11-S4-099 | modal | conditional | "A" | FN-M11-4.2.10 |
| EL-M11-S4-100 | card | conditional | "Salah" | FN-M11-4.2.10 |
| EL-M11-S4-101 | badge | conditional | "Salah" | FN-M11-4.2.10 |
| EL-M11-S4-102 | text | conditional | "Sejarah · Sejarah Tingkatan 5 KSSM" | FN-M11-4.2.10 |
| EL-M11-S4-103 | button | conditional | fa-times | FN-M11-4.2.10 |
| EL-M11-S4-104 | text | conditional | "Aras", fa-signal | FN-M11-4.2.10 |
| EL-M11-S4-105 | text | hidden-only | "undefined" | FN-M11-4.2.10 |
| EL-M11-S4-106 | text | conditional | "Pilihan Jawapan" | FN-M11-4.2.10 |
| EL-M11-S4-107 | text | hidden-only | "Jawapan Betul", fa-check-circle | FN-M11-4.2.10 |
| EL-M11-S4-108 | text | hidden-only | "Jawapan Pelajar", fa-times-circle | FN-M11-4.2.10 |
| EL-M11-S4-109 | text | hidden-only | "Pilihan jawapan telah dipadam dari sistem." | FN-M11-4.2.10 |
| EL-M11-S4-110 | text | conditional | "Penjelasan", fa-lightbulb | FN-M11-4.2.10 |
| EL-M11-S4-111 | text | hidden-only | "undefined" | FN-M11-4.2.10 |
| EL-M11-S4-112 | text | conditional | "Percubaan SPM 2025 Sejarah Melaka" | FN-M11-4.2.10 |
| EL-M11-S4-113 | text | conditional | "2" | FN-M11-4.2.10 |
| EL-M11-S4-114 | text | conditional | "2026-06-16 14:19:57" | FN-M11-4.2.10 |
| EL-M11-S4-115 | text | conditional | "Apakah ciri negara berdaulat? I II III IV Pentadbiran yang sistematik Sempadan yang jelas …" | FN-M11-4.2.10 |
| EL-M11-S4-116 | badge | conditional | "A" | FN-M11-4.2.10 |
| EL-M11-S4-117 | text | conditional | "I dan IV" | FN-M11-4.2.10 |
| EL-M11-S4-118 | text | hidden-only | "Jawapan Betul", fa-check-circle | FN-M11-4.2.10 |
| EL-M11-S4-119 | text | conditional | "Jawapan Pelajar", fa-times-circle | FN-M11-4.2.10 |
| EL-M11-S4-120 | badge | conditional | "B" | FN-M11-4.2.10 |
| EL-M11-S4-121 | text | conditional | "II dan III" | FN-M11-4.2.10 |
| EL-M11-S4-122 | text | hidden-only | "Jawapan Betul", fa-check-circle | FN-M11-4.2.10 |
| EL-M11-S4-123 | text | hidden-only | "Jawapan Pelajar", fa-times-circle | FN-M11-4.2.10 |
| EL-M11-S4-124 | badge | conditional | "C" | FN-M11-4.2.10 |
| EL-M11-S4-125 | text | conditional | "III dan IV" | FN-M11-4.2.10 |
| EL-M11-S4-126 | text | hidden-only | "Jawapan Betul", fa-check-circle | FN-M11-4.2.10 |
| EL-M11-S4-127 | text | hidden-only | "Jawapan Pelajar", fa-times-circle | FN-M11-4.2.10 |
| EL-M11-S4-128 | badge | conditional | "D" | FN-M11-4.2.10 |
| EL-M11-S4-129 | text | conditional | "I dan II" | FN-M11-4.2.10 |
| EL-M11-S4-130 | text | conditional | "Jawapan Betul", fa-check-circle | FN-M11-4.2.10 |
| EL-M11-S4-131 | text | hidden-only | "Jawapan Pelajar", fa-times-circle | FN-M11-4.2.10 |
| EL-M11-S4-132 | text | conditional | "[AI-repaired 2026-04-22] Ciri negara berdaulat termasuk pentadbiran yang sistematik dan se…" | FN-M11-4.2.10 |
| EL-M11-S4-133 | text | conditional | "404" | FN-M11-1.2.2 |
| EL-M11-S4-134 | text | conditional | "🔍" | FN-M11-1.2.2 |
| EL-M11-S4-135 | heading | conditional | "Halaman Tidak Dijumpai" | FN-M11-1.2.2 |
| EL-M11-S4-136 | text | conditional | "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?" | FN-M11-1.2.2 |
| EL-M11-S4-137 | link | conditional | "Halaman Utama", → / | FN-M11-1.2.2 |
| EL-M11-S4-138 | link | conditional | "Mula Latihan", → /latih-tubi | FN-M11-1.2.2 |
| EL-M11-S4-139 | text | conditional | "PRESTASIPLUS" | FN-M11-1.2.2 |
| EL-M11-S4-140 | button | conditional | "Papar lagi 20 (40/71)", fa-chevron-down | FN-M11-4.2.6 |
| EL-M11-S4-141 | text | conditional | "Aktiviti Terakhir: 05/07/2026 06:13" | FN-M11-4.2.1 |
| EL-M11-S4-142 | card | conditional | "195" | FN-M11-4.2.2 |
| EL-M11-S4-143 | card | conditional | "150" | FN-M11-4.2.2 |
| EL-M11-S4-144 | card | conditional | "45" | FN-M11-4.2.2 |
| EL-M11-S4-145 | card | conditional | "76.9%" | FN-M11-4.2.2 |
| EL-M11-S4-146 | text | conditional | "76.9%" | FN-M11-4.2.2 |
| EL-M11-S4-147 | tab | conditional | "Jawapan Salah 45", fa-times-circle | FN-M11-4.2.3 |
| EL-M11-S4-148 | tab | conditional | "Gap Analysis 2", fa-crosshairs | FN-M11-4.2.3 |
| EL-M11-S4-149 | text | hidden-only | "Biologi" | FN-M11-4.2.4 |
| EL-M11-S4-150 | badge | hidden-only | "81.3%" | FN-M11-4.2.4 |
| EL-M11-S4-151 | text | hidden-only | "61/75" | FN-M11-4.2.4 |
| EL-M11-S4-152 | badge | hidden-only | "87.5%" | FN-M11-4.2.4 |
| EL-M11-S4-153 | text | hidden-only | "35/40" | FN-M11-4.2.4 |
| EL-M11-S4-154 | badge | hidden-only | "80.0%" | FN-M11-4.2.4 |
| EL-M11-S4-155 | text | hidden-only | "28/35" | FN-M11-4.2.4 |
| EL-M11-S4-156 | text | conditional | "0.0%" | FN-M11-4.2.5 |
| EL-M11-S4-157 | text | conditional | "0/1" | FN-M11-4.2.5 |
| EL-M11-S4-158 | text | conditional | "Penulisan karangan lanjutan" | FN-M11-4.2.5 |
| EL-M11-S4-159 | text | hidden-only | "75.0%" | FN-M11-4.2.5 |
| EL-M11-S4-160 | text | hidden-only | "3/4" | FN-M11-4.2.5 |
| EL-M11-S4-161 | text | conditional | "Bab 3" | FN-M11-4.2.5 |
| EL-M11-S4-162 | text | hidden-only | "Kerjaya ke Mercu Impian" | FN-M11-4.2.5 |
| EL-M11-S4-163 | text | conditional | "100.0%" | FN-M11-4.2.5 |
| EL-M11-S4-164 | text | conditional | "1/1" | FN-M11-4.2.5 |
| EL-M11-S4-165 | text | hidden-only | "Biologi" | FN-M11-4.2.5 |
| EL-M11-S4-166 | text | hidden-only | "Fizik" | FN-M11-4.2.5 |
| EL-M11-S4-167 | text | hidden-only | "Matematik" | FN-M11-4.2.5 |
| EL-M11-S4-168 | text | hidden-only | "Pendidikan Islam" | FN-M11-4.2.5 |
| EL-M11-S4-169 | heading | hidden-only | "Senarai Soalan (195 tersedia daripada 195)" | FN-M11-4.2.6 |
| EL-M11-S4-170 | clickable | hidden-only | "1 Apakah yang dimaksudkan dengan "Ahlus Sunnah wal Jama'ah" (ASWJ)? Pendidikan Islam A A 0…", fa-external-link-alt | FN-M11-4.2.6 |
| EL-M11-S4-171 | clickable | hidden-only | "2 Apakah yang dimaksudkan dengan "haji mabrur" dan apakah tandanya? Pendidikan Islam C C 0…", fa-external-link-alt | FN-M11-4.2.6 |
| EL-M11-S4-172 | clickable | hidden-only | "8 Hadis "Sebaik-baik kamu ialah yang mempelajari al-Quran dan mengajarkannya" diri... Pend…", fa-external-link-alt | FN-M11-4.2.6 |
| EL-M11-S4-173 | clickable | hidden-only | "44 Kata kerja "mempercepatkan" mengandungi imbuhan... Bahasa Melayu C D 05/07/2026 05:58", fa-external-link-alt | FN-M11-4.2.6 |
| EL-M11-S4-174 | button | hidden-only | "Papar lagi 20 (20/195)", fa-chevron-down | FN-M11-4.2.6 |
| EL-M11-S4-175 | heading | hidden-only | "Jawapan Salah (45 jawapan, 45 soalan unik)" | FN-M11-4.2.7 |
| EL-M11-S4-176 | text | hidden-only | "#1 · Pendidikan Islam · Pendidikan Islam Tingkatan 5" | FN-M11-4.2.7 |
| EL-M11-S4-177 | text | hidden-only | "05/07/2026 06:13" | FN-M11-4.2.7 |
| EL-M11-S4-178 | text | hidden-only | "Hadis "Sebaik-baik kamu ialah yang mempelajari al-Quran dan mengajarkannya" diriwayatkan o…" | FN-M11-4.2.7 |
| EL-M11-S4-179 | text | hidden-only | "Saidina Uthman bin Affan r.a." | FN-M11-4.2.7 |
| EL-M11-S4-180 | text | hidden-only | "Saidina Umar r.a." | FN-M11-4.2.7 |
| EL-M11-S4-181 | text | hidden-only | "Hadis ini diriwayatkan oleh Saidina Uthman bin Affan r.a. dalam Sahih al-Bukhari." | FN-M11-4.2.7 |
| EL-M11-S4-182 | text | hidden-only | "#2 · Bahasa Melayu · Kemahiran Bahasa Tingkatan 4" | FN-M11-4.2.7 |
| EL-M11-S4-183 | text | hidden-only | "05/07/2026 05:58" | FN-M11-4.2.7 |
| EL-M11-S4-184 | text | hidden-only | "Kata kerja "mempercepatkan" mengandungi imbuhan..." | FN-M11-4.2.7 |
| EL-M11-S4-185 | badge | hidden-only | "D" | FN-M11-4.2.7 |
| EL-M11-S4-186 | text | hidden-only | "mem-, per-, -kan" | FN-M11-4.2.7 |
| EL-M11-S4-187 | badge | hidden-only | "C" | FN-M11-4.2.7 |
| EL-M11-S4-188 | text | hidden-only | "me-, -kan" | FN-M11-4.2.7 |
| EL-M11-S4-189 | text | hidden-only | ""Mempercepatkan" = me(m)- + per- + cepat + -kan. Tiga imbuhan pada kata dasar "cepat"." | FN-M11-4.2.7 |
| EL-M11-S4-190 | text | hidden-only | "Kemahiran Bahasa Tingkatan 4" | FN-M11-4.2.8 |
| EL-M11-S4-191 | text | hidden-only | "Bahasa Melayu" | FN-M11-4.2.8 |
| EL-M11-S4-192 | text | hidden-only | "Kritikal" | FN-M11-4.2.8 |
| EL-M11-S4-193 | text | hidden-only | "0.0%" | FN-M11-4.2.8 |
| EL-M11-S4-194 | text | hidden-only | "0/1 betul" | FN-M11-4.2.8 |
| EL-M11-S4-195 | text | hidden-only | "257 soalan tersedia untuk latihan", fa-book-open | FN-M11-4.2.8 |
| EL-M11-S4-196 | text | hidden-only | "Kemahiran Bahasa Tingkatan 5" | FN-M11-4.2.8 |
| EL-M11-S4-197 | text | hidden-only | "Bahasa Melayu" | FN-M11-4.2.8 |
| EL-M11-S4-198 | text | hidden-only | "Kritikal" | FN-M11-4.2.8 |
| EL-M11-S4-199 | text | hidden-only | "0.0%" | FN-M11-4.2.8 |
| EL-M11-S4-200 | text | hidden-only | "0/4 betul" | FN-M11-4.2.8 |
| EL-M11-S4-201 | text | hidden-only | "246 soalan tersedia untuk latihan", fa-book-open | FN-M11-4.2.8 |
| EL-M11-S4-202 | badge | hidden-only | "Sains" | FN-M11-4.2.8 |
| EL-M11-S4-203 | text | conditional | "Kekuatan dalam Biologi (81.3% ketepatan). Boleh jadikan motivasi." | FN-M11-4.2.9 |
| EL-M11-S4-204 | text | conditional | "Kekuatan dalam Sejarah (87.5% ketepatan). Boleh jadikan motivasi." | FN-M11-4.2.9 |
| EL-M11-S4-205 | text | conditional | "Kekuatan dalam Bahasa Melayu (80.0% ketepatan). Boleh jadikan motivasi." | FN-M11-4.2.9 |
| EL-M11-S4-206 | text | conditional | "Kekuatan dalam Pendidikan Islam (95.0% ketepatan). Boleh jadikan motivasi." | FN-M11-4.2.9 |
| EL-M11-S4-207 | text | conditional | "Kerap salah dalam Fizik (10/15 salah = 33.3% ketepatan). Cadangan: Fokus latihan tambahan." | FN-M11-4.2.9 |
| EL-M11-S4-208 | text | conditional | "Kerap salah dalam Matematik (8/10 salah = 20.0% ketepatan). Cadangan: Fokus latihan tambah…" | FN-M11-4.2.9 |
| EL-M11-S4-209 | text | conditional | "<email> · Tingkatan 5" | FN-M11-4.2.1 |
| EL-M11-S4-210 | text | conditional | "Aktiviti Terakhir: 27/06/2026 14:24" | FN-M11-4.2.1 |
| EL-M11-S4-211 | card | conditional | "97" | FN-M11-4.2.2 |
| EL-M11-S4-212 | card | conditional | "63.4%" | FN-M11-4.2.2 |
| EL-M11-S4-213 | text | conditional | "63.4%" | FN-M11-4.2.2 |
| EL-M11-S4-214 | tab | conditional | "Jawapan Salah 97", fa-times-circle | FN-M11-4.2.3 |
| EL-M11-S4-215 | tab | conditional | "Gap Analysis 6", fa-crosshairs | FN-M11-4.2.3 |
| EL-M11-S4-216 | badge | hidden-only | "60.0%" | FN-M11-4.2.4 |
| EL-M11-S4-217 | text | hidden-only | "63/105" | FN-M11-4.2.4 |
| EL-M11-S4-218 | text | hidden-only | "Sains" | FN-M11-4.2.4 |
| EL-M11-S4-219 | badge | hidden-only | "66.0%" | FN-M11-4.2.4 |
| EL-M11-S4-220 | text | hidden-only | "33/50" | FN-M11-4.2.4 |
| EL-M11-S4-221 | text | hidden-only | "Pendidikan Islam" | FN-M11-4.2.4 |
| EL-M11-S4-222 | badge | hidden-only | "84.0%" | FN-M11-4.2.4 |
| EL-M11-S4-223 | text | hidden-only | "42/50" | FN-M11-4.2.4 |
| EL-M11-S4-224 | text | hidden-only | "31.6%" | FN-M11-4.2.5 |
| EL-M11-S4-225 | text | conditional | "Bab 9" | FN-M11-4.2.5 |
| EL-M11-S4-226 | text | hidden-only | "9 Stand by Me" | FN-M11-4.2.5 |
| EL-M11-S4-227 | text | hidden-only | "Bab 12" | FN-M11-4.2.5 |
| EL-M11-S4-228 | text | hidden-only | "12 Prudent Lifestyles" | FN-M11-4.2.5 |
| EL-M11-S4-229 | text | hidden-only | "50.0%" | FN-M11-4.2.5 |
| EL-M11-S4-230 | text | hidden-only | "1/2" | FN-M11-4.2.5 |
| EL-M11-S4-231 | text | hidden-only | "Sains" | FN-M11-4.2.5 |
| EL-M11-S4-232 | clickable | hidden-only | "1 Refer to the gapped text. The Impact of Technology on Everyday Life Technology... Bahasa…", fa-external-link-alt | FN-M11-4.2.6 |
| EL-M11-S4-233 | clickable | hidden-only | "2 Refer to the gapped text. The Importance of Spending Money Wisely Spending mon... Bahasa…", fa-external-link-alt | FN-M11-4.2.6 |
| EL-M11-S4-234 | clickable | hidden-only | "3 When analysing an article about global food insecurity, a critical reader should... Baha…", fa-external-link-alt | FN-M11-4.2.6 |
| EL-M11-S4-235 | clickable | hidden-only | "4 Refer to the advertisement. Level Up Your Life. Let out Your Genius. Tired of h... Bahas…", fa-external-link-alt | FN-M11-4.2.6 |
| EL-M11-S4-236 | heading | hidden-only | "Jawapan Salah (97 jawapan, 97 soalan unik)" | FN-M11-4.2.7 |
| EL-M11-S4-237 | text | hidden-only | "#1 · Bahasa Inggeris · Umum" | FN-M11-4.2.7 |
| EL-M11-S4-238 | text | hidden-only | "27/06/2026 14:24" | FN-M11-4.2.7 |
| EL-M11-S4-239 | text | hidden-only | "Refer to the gapped text." | FN-M11-4.2.7 |
| EL-M11-S4-240 | text | hidden-only | "The Importance of Spending Money Wisely" | FN-M11-4.2.7 |
| EL-M11-S4-241 | text | hidden-only | "Spending money is something we all do, whether it is for food, clothes or entertainment. H…" | FN-M11-4.2.7 |
| EL-M11-S4-242 | text | hidden-only | "One of the first steps to spending money wisely is knowing the difference between needs an…" | FN-M11-4.2.7 |
| EL-M11-S4-243 | text | hidden-only | "Another good habit is making a budget. A budget is a plan that shows how much money you ge…" | FN-M11-4.2.7 |
| EL-M11-S4-244 | text | hidden-only | "It is a good idea to learn how to handle money from a young age. [29] For example, giving …" | FN-M11-4.2.7 |
| EL-M11-S4-245 | text | hidden-only | "Not spending money wisely can lead to many problems. [30] This can cause stress and even d…" | FN-M11-4.2.7 |
| EL-M11-S4-246 | text | hidden-only | "There are many ways to become a smart shopper. One tip is to compare prices before you buy…" | FN-M11-4.2.7 |
| EL-M11-S4-247 | text | hidden-only | "Saving money is just as important as spending wisely. [32] You can save for future needs l…" | FN-M11-4.2.7 |
| EL-M11-S4-248 | text | hidden-only | "Sentence options: A. Parents and teachers can help children understand the value of money.…" | FN-M11-4.2.7 |
| EL-M11-S4-249 | text | hidden-only | "Choose the best sentence for gap 31." | FN-M11-4.2.7 |
| EL-M11-S4-250 | text | hidden-only | "Sometimes, the same item is cheaper in another shop or online." | FN-M11-4.2.7 |
| EL-M11-S4-251 | text | hidden-only | "Parents and teachers can help children understand the value of money." | FN-M11-4.2.7 |
| EL-M11-S4-252 | text | hidden-only | "[AI-repaired 2026-04-22] Option B is the best choice as it directly relates to the advice …" | FN-M11-4.2.7 |
| EL-M11-S4-253 | text | hidden-only | "Sumber: Percubaan SPM 2025 Bahasa Inggeris Johor P1", fa-bookmark | FN-M11-4.2.7 |
| EL-M11-S4-254 | text | hidden-only | "#2 · Bahasa Inggeris · Umum" | FN-M11-4.2.7 |
| EL-M11-S4-255 | text | hidden-only | "27/06/2026 14:24" | FN-M11-4.2.7 |
| EL-M11-S4-256 | text | hidden-only | "Refer to the advertisement." | FN-M11-4.2.7 |
| EL-M11-S4-257 | text | hidden-only | "Level Up Your Life. Let out Your Genius. Tired of homework struggles? Want to create amazi…" | FN-M11-4.2.7 |
| EL-M11-S4-258 | text | hidden-only | "Stop dreaming, start doing. Get your Spark today and #InnovateYourFuture! Visit: GetSparkA…" | FN-M11-4.2.7 |
| EL-M11-S4-259 | text | hidden-only | "What does the advertisement say about Spark?" | FN-M11-4.2.7 |
| EL-M11-S4-260 | text | hidden-only | "It guarantees you personalized features." | FN-M11-4.2.7 |
| EL-M11-S4-261 | text | hidden-only | "It provides solutions for all your homework." | FN-M11-4.2.7 |
| EL-M11-S4-262 | text | hidden-only | "[AI-repaired 2026-04-22] The advertisement emphasizes that Spark learns about you and assi…" | FN-M11-4.2.7 |
| EL-M11-S4-263 | text | hidden-only | "Sumber: Percubaan SPM 2025 Bahasa Inggeris Kelantan P1", fa-bookmark | FN-M11-4.2.7 |
| EL-M11-S4-264 | text | hidden-only | "Fungsi dan Persamaan Kuadratik" | FN-M11-4.2.8 |
| EL-M11-S4-265 | text | hidden-only | "Matematik" | FN-M11-4.2.8 |
| EL-M11-S4-266 | text | hidden-only | "Matematik Pengguna: Pengurusan Kewangan" | FN-M11-4.2.8 |
| EL-M11-S4-267 | text | hidden-only | "Matematik" | FN-M11-4.2.8 |
| EL-M11-S4-268 | text | hidden-only | "0/2 betul" | FN-M11-4.2.8 |
| EL-M11-S4-269 | text | hidden-only | "Operasi Set" | FN-M11-4.2.8 |
| EL-M11-S4-270 | text | hidden-only | "Matematik" | FN-M11-4.2.8 |
| EL-M11-S4-271 | text | hidden-only | "Kritikal" | FN-M11-4.2.8 |
| EL-M11-S4-272 | text | hidden-only | "0/1 betul" | FN-M11-4.2.8 |
| EL-M11-S4-273 | text | hidden-only | "149 soalan tersedia untuk latihan", fa-book-open | FN-M11-4.2.8 |
| EL-M11-S4-274 | text | hidden-only | "Matematik Tingkatan 5" | FN-M11-4.2.8 |
| EL-M11-S4-275 | text | hidden-only | "Matematik" | FN-M11-4.2.8 |
| EL-M11-S4-276 | text | hidden-only | "Lemah" | FN-M11-4.2.8 |
| EL-M11-S4-277 | text | hidden-only | "33.3%" | FN-M11-4.2.8 |
| EL-M11-S4-278 | text | hidden-only | "1/3 betul" | FN-M11-4.2.8 |
| EL-M11-S4-279 | text | hidden-only | "287 soalan tersedia untuk latihan", fa-book-open | FN-M11-4.2.8 |
| EL-M11-S4-280 | text | hidden-only | "Sejarah Tingkatan 5 KSSM" | FN-M11-4.2.8 |
| EL-M11-S4-281 | text | hidden-only | "Sejarah" | FN-M11-4.2.8 |
| EL-M11-S4-282 | text | hidden-only | "Lemah" | FN-M11-4.2.8 |
| EL-M11-S4-283 | text | hidden-only | "38.9%" | FN-M11-4.2.8 |
| EL-M11-S4-284 | text | hidden-only | "7/18 betul" | FN-M11-4.2.8 |
| EL-M11-S4-285 | text | hidden-only | "728 soalan tersedia untuk latihan", fa-book-open | FN-M11-4.2.8 |
| EL-M11-S4-286 | text | hidden-only | "Sejarah Tingkatan 4" | FN-M11-4.2.8 |
| EL-M11-S4-287 | text | hidden-only | "Sejarah" | FN-M11-4.2.8 |
| EL-M11-S4-288 | text | hidden-only | "Perlu Perhatian" | FN-M11-4.2.8 |
| EL-M11-S4-289 | text | hidden-only | "50.0%" | FN-M11-4.2.8 |
| EL-M11-S4-290 | text | hidden-only | "6/12 betul" | FN-M11-4.2.8 |
| EL-M11-S4-291 | text | hidden-only | "750 soalan tersedia untuk latihan", fa-book-open | FN-M11-4.2.8 |
| EL-M11-S4-292 | heading | hidden-only | "Topik Kuat" | FN-M11-4.2.8 |
| EL-M11-S4-293 | badge | hidden-only | "86.8%" | FN-M11-4.2.8 |
| EL-M11-S4-294 | text | hidden-only | "Pendidikan Islam Tingkatan 5" | FN-M11-4.2.8 |
| EL-M11-S4-295 | text | hidden-only | "Pendidikan Islam · 38 soalan" | FN-M11-4.2.8 |
| EL-M11-S4-296 | badge | hidden-only | "88.1%" | FN-M11-4.2.8 |
| EL-M11-S4-297 | text | hidden-only | "Pendidikan Islam Tingkatan 4" | FN-M11-4.2.8 |
| EL-M11-S4-298 | text | hidden-only | "Pendidikan Islam · 42 soalan" | FN-M11-4.2.8 |
| EL-M11-S4-299 | badge | hidden-only | "91.7%" | FN-M11-4.2.8 |
| EL-M11-S4-300 | text | hidden-only | "Bahasa Melayu · 12 soalan" | FN-M11-4.2.8 |
| EL-M11-S4-301 | badge | hidden-only | "Pendidikan Moral" | FN-M11-4.2.8 |
| EL-M11-S4-302 | text | conditional | "Kekuatan dalam Pendidikan Islam (84.0% ketepatan). Boleh jadikan motivasi." | FN-M11-4.2.9 |
| EL-M11-S4-303 | text | conditional | "Kerap salah dalam Bahasa Inggeris (25/40 salah = 37.5% ketepatan). Cadangan: Fokus latihan…" | FN-M11-4.2.9 |
| EL-M11-S4-304 | text | conditional | "Kekuatan dalam Matematik (100.0% ketepatan). Boleh jadikan motivasi." | FN-M11-4.2.9 |
| EL-M11-S4-305 | text | conditional | "Kemahiran Membaca dan Memahami" | FN-M11-4.2.5 |
| EL-M11-S4-306 | text | conditional | "21/21" | FN-M11-4.2.5 |
| EL-M11-S4-307 | badge | conditional | "Kuat" | FN-M11-4.2.5 |
| EL-M11-S4-308 | text | conditional | "Bab 1" | FN-M11-4.2.5 |
| EL-M11-S4-309 | text | conditional | "100.0%" | FN-M11-4.2.5 |
| EL-M11-S4-310 | badge | conditional | "Kuat" | FN-M11-4.2.5 |
| EL-M11-S4-311 | text | conditional | "Bab 1" | FN-M11-4.2.5 |
| EL-M11-S4-312 | text | conditional | "SULUH MASA DEPAN" | FN-M11-4.2.5 |
| EL-M11-S4-313 | text | conditional | "100.0%" | FN-M11-4.2.5 |
| EL-M11-S4-314 | text | conditional | "1/1" | FN-M11-4.2.5 |
| EL-M11-S4-315 | badge | conditional | "Kuat" | FN-M11-4.2.5 |
| EL-M11-S4-316 | text | conditional | "Tatabahasa" | FN-M11-4.2.5 |
| EL-M11-S4-317 | text | conditional | "100.0%" | FN-M11-4.2.5 |
| EL-M11-S4-318 | text | conditional | "1/1" | FN-M11-4.2.5 |
| EL-M11-S4-319 | badge | conditional | "Kuat" | FN-M11-4.2.5 |
| EL-M11-S4-320 | text | conditional | "Bab 3" | FN-M11-4.2.5 |
| EL-M11-S4-321 | text | conditional | "KECERDASAN MENINGKAT," | FN-M11-4.2.5 |
| EL-M11-S4-322 | text | conditional | "100.0%" | FN-M11-4.2.5 |
| EL-M11-S4-323 | text | conditional | "1/1" | FN-M11-4.2.5 |
| EL-M11-S4-324 | badge | conditional | "Kuat" | FN-M11-4.2.5 |
| EL-M11-S4-325 | text | conditional | "Bab 4" | FN-M11-4.2.5 |
| EL-M11-S4-326 | text | conditional | "WASPADA SELALU!" | FN-M11-4.2.5 |
| EL-M11-S4-327 | text | conditional | "100.0%" | FN-M11-4.2.5 |
| EL-M11-S4-328 | text | conditional | "1/1" | FN-M11-4.2.5 |
| EL-M11-S4-329 | badge | conditional | "Kuat" | FN-M11-4.2.5 |
| EL-M11-S4-330 | text | conditional | "Bab 5" | FN-M11-4.2.5 |
| EL-M11-S4-331 | text | conditional | "Dunia Baharu Tani" | FN-M11-4.2.5 |
| EL-M11-S4-332 | text | conditional | "100.0%" | FN-M11-4.2.5 |
| EL-M11-S4-333 | text | conditional | "1/1" | FN-M11-4.2.5 |
| EL-M11-S4-334 | badge | conditional | "Kuat" | FN-M11-4.2.5 |
| EL-M11-S4-335 | text | conditional | "INDAH SENI, ENDAH BUDAYA" | FN-M11-4.2.5 |
| EL-M11-S4-336 | text | conditional | "100.0%" | FN-M11-4.2.5 |
| EL-M11-S4-337 | text | conditional | "1/1" | FN-M11-4.2.5 |
| EL-M11-S4-338 | badge | conditional | "Kuat" | FN-M11-4.2.5 |
| EL-M11-S4-339 | text | conditional | "Bab 10" | FN-M11-4.2.5 |
| EL-M11-S4-340 | text | conditional | "SAINS DAN TEKNOLOGI PEMACU" | FN-M11-4.2.5 |
| EL-M11-S4-341 | text | conditional | "100.0%" | FN-M11-4.2.5 |
| EL-M11-S4-342 | text | conditional | "1/1" | FN-M11-4.2.5 |
| EL-M11-S4-343 | badge | conditional | "Kuat" | FN-M11-4.2.5 |
| EL-M11-S4-344 | text | conditional | "Bab 13" | FN-M11-4.2.5 |
| EL-M11-S4-345 | text | conditional | "Cergas Aktif" | FN-M11-4.2.5 |
| EL-M11-S4-346 | text | conditional | "100.0%" | FN-M11-4.2.5 |
| EL-M11-S4-347 | text | conditional | "1/1" | FN-M11-4.2.5 |
| EL-M11-S4-348 | badge | conditional | "Kuat" | FN-M11-4.2.5 |
| EL-M11-S4-349 | text | conditional | "Bab 99" | FN-M11-4.2.5 |
| EL-M11-S4-350 | text | conditional | "Mendengar, mengenal dan menyebut perkataan, rangkai kata, istilah dan ungkapan serta inton…" | FN-M11-4.2.5 |
| EL-M11-S4-351 | text | conditional | "100.0%" | FN-M11-4.2.5 |
| EL-M11-S4-352 | text | conditional | "1/1" | FN-M11-4.2.5 |
| EL-M11-S4-353 | badge | conditional | "Kuat" | FN-M11-4.2.5 |
| EL-M11-S4-354 | text | conditional | "Bab 1" | FN-M11-4.2.5 |
| EL-M11-S4-355 | text | conditional | "Kemunculan tamadun awal" | FN-M11-4.2.5 |
| EL-M11-S4-356 | badge | conditional | "Lemah" | FN-M11-4.2.5 |
| EL-M11-S4-357 | text | conditional | "Bab 1" | FN-M11-4.2.5 |
| EL-M11-S4-358 | text | conditional | "Persekutuan Tanah Melayu 1948" | FN-M11-4.2.5 |
| EL-M11-S4-359 | text | conditional | "100.0%" | FN-M11-4.2.5 |
| EL-M11-S4-360 | text | conditional | "1/1" | FN-M11-4.2.5 |
| EL-M11-S4-361 | badge | conditional | "Kuat" | FN-M11-4.2.5 |
| EL-M11-S4-362 | text | conditional | "Bab 1" | FN-M11-4.2.5 |
| EL-M11-S4-363 | text | conditional | "Bab 3" | FN-M11-4.2.5 |
| EL-M11-S4-364 | text | conditional | "Lokasi Zaman Prasejarah di Dunia" | FN-M11-4.2.5 |
| EL-M11-S4-365 | text | conditional | "100.0%" | FN-M11-4.2.5 |
| EL-M11-S4-366 | text | conditional | "2/2" | FN-M11-4.2.5 |
| EL-M11-S4-367 | badge | conditional | "Kuat" | FN-M11-4.2.5 |
| EL-M11-S4-368 | text | conditional | "Bab 6" | FN-M11-4.2.5 |
| EL-M11-S4-369 | text | conditional | "Pentadbiran Barat Berkaitan dengan Ekonomi" | FN-M11-4.2.5 |
| EL-M11-S4-370 | text | conditional | "100.0%" | FN-M11-4.2.5 |
| EL-M11-S4-371 | text | conditional | "1/1" | FN-M11-4.2.5 |
| EL-M11-S4-372 | badge | conditional | "Kuat" | FN-M11-4.2.5 |

#### S5 — `/guru/monitoring/sekolah/{id}/guru/{id}` (40 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M11-S5-001 | card | visible-default | "<person>" | FN-M11-4.3.1 |
| EL-M11-S5-002 | heading | visible-default | "<person>" | FN-M11-4.3.1 |
| EL-M11-S5-003 | text | visible-default | "<email>" | FN-M11-4.3.1 |
| EL-M11-S5-004 | text | visible-default | "Login Terakhir: 15/06/2026 12:37" | FN-M11-4.3.1 |
| EL-M11-S5-005 | badge | visible-default | "Pernah Login" | FN-M11-4.3.1 |
| EL-M11-S5-006 | card | visible-default | "184" | FN-M11-4.3.2 |
| EL-M11-S5-007 | text | visible-default | "Pelajar T4/T5" | FN-M11-4.3.2 |
| EL-M11-S5-008 | text | visible-default | "184" | FN-M11-4.3.2 |
| EL-M11-S5-009 | card | visible-default | "174" | FN-M11-4.3.2 |
| EL-M11-S5-010 | text | visible-default | "Pelajar Aktif" | FN-M11-4.3.2 |
| EL-M11-S5-011 | text | visible-default | "174" | FN-M11-4.3.2 |
| EL-M11-S5-012 | card | visible-default | "94.6%" | FN-M11-4.3.2 |
| EL-M11-S5-013 | text | visible-default | "% Aktif" | FN-M11-4.3.2 |
| EL-M11-S5-014 | text | visible-default | "94.6%" | FN-M11-4.3.2 |
| EL-M11-S5-015 | card | visible-default | "10" | FN-M11-4.3.2 |
| EL-M11-S5-016 | text | visible-default | "Perlu Perhatian" | FN-M11-4.3.2 |
| EL-M11-S5-017 | text | visible-default | "10" | FN-M11-4.3.2 |
| EL-M11-S5-018 | card | visible-default | "Prestasi Pelajar" | FN-M11-4.3.3 |
| EL-M11-S5-019 | heading | visible-default | "Prestasi Pelajar" | FN-M11-4.3.3 |
| EL-M11-S5-020 | table | visible-default | columns # · Pelajar · Tingkatan · Soalan · Ketepatan · Status | FN-M11-4.3.3 |
| EL-M11-S5-021 | link | visible-default | "<person>", → /admin/monitoring/sekolah/8080/pelajar/{id} | FN-M11-4.3.3 |
| EL-M11-S5-022 | badge | visible-default | "Aktif" | FN-M11-4.3.3 |
| EL-M11-S5-023 | link | visible-default | "<person>", → /admin/monitoring/sekolah/8080/pelajar/{id} | FN-M11-4.3.3 |
| EL-M11-S5-024 | badge | visible-default | "Aktif" | FN-M11-4.3.3 |
| EL-M11-S5-025 | link | visible-default | "<person>", → /admin/monitoring/sekolah/8080/pelajar/{id} | FN-M11-4.3.3 |
| EL-M11-S5-026 | badge | visible-default | "Aktif" | FN-M11-4.3.3 |
| EL-M11-S5-027 | badge | visible-default | "Login sahaja" | FN-M11-4.3.3 |
| EL-M11-S5-028 | badge | visible-default | "Belum login" | FN-M11-4.3.3 |
| EL-M11-S5-029 | card | visible-default | "Cadangan Tindakan" | FN-M11-4.3.4 |
| EL-M11-S5-030 | heading | visible-default | "Cadangan Tindakan" | FN-M11-4.3.4 |
| EL-M11-S5-031 | text | visible-default | "8 pelajar belum pernah login. Cadangan: Adakan sesi pengenalan platform di kelas." | FN-M11-4.3.4 |
| EL-M11-S5-032 | text | visible-default | "3 pelajar aktif mempunyai ketepatan bawah 50%. Cadangan: Beri perhatian khas kepada pelaja…" | FN-M11-4.3.4 |
| EL-M11-S5-033 | text | visible-default | "174 pelajar telah mula menjawab soalan. Galakkan mereka kekalkan momentum." | FN-M11-4.3.4 |
| EL-M11-S5-034 | text | conditional | "404" | FN-M11-1.2.2 |
| EL-M11-S5-035 | text | conditional | "🔍" | FN-M11-1.2.2 |
| EL-M11-S5-036 | heading | conditional | "Halaman Tidak Dijumpai" | FN-M11-1.2.2 |
| EL-M11-S5-037 | text | conditional | "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?" | FN-M11-1.2.2 |
| EL-M11-S5-038 | link | conditional | "Halaman Utama", → / | FN-M11-1.2.2 |
| EL-M11-S5-039 | link | conditional | "Mula Latihan", → /latih-tubi | FN-M11-1.2.2 |
| EL-M11-S5-040 | text | conditional | "PRESTASIPLUS" | FN-M11-1.2.2 |

#### S6 — `/guru/analisis-item` (17 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M11-S6-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M11-S6-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M11-S6-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M11-S6-004 | card | visible-default | "Tapis:" | FN-M11-5.1.1 |
| EL-M11-S6-005 | form | visible-default | form | FN-M11-5.1.1 |
| EL-M11-S6-006 | text | visible-default | "Tapis:" | FN-M11-5.1.1 |
| EL-M11-S6-007 | label | visible-default | "Mata Pelajaran" | FN-M11-5.1.1 |
| EL-M11-S6-008 | select | visible-default | `subject_id` | FN-M11-5.1.1 |
| EL-M11-S6-009 | label | visible-default | "Kelas" | FN-M11-5.1.1 |
| EL-M11-S6-010 | select | visible-default | `classroom_id` | FN-M11-5.1.1 |
| EL-M11-S6-011 | text | visible-default | "> 70% (Mudah)" | FN-M11-5.1.3 |
| EL-M11-S6-012 | text | visible-default | "40–70% (Sederhana)" | FN-M11-5.1.3 |
| EL-M11-S6-013 | text | visible-default | "< 40% (Sukar)" | FN-M11-5.1.3 |
| EL-M11-S6-014 | text | visible-default | "Diskriminasi: >0.3 = baik, <0 = semak semula", fa-info-circle | FN-M11-5.1.3 |
| EL-M11-S6-015 | empty-state | visible-default | "Tiada data analisis item untuk paparan ini." | FN-M11-5.1.4 |
| EL-M11-S6-016 | text | visible-default | "Pelajar perlu membuat latihan dahulu." | FN-M11-5.1.4 |
| EL-M11-S6-017 | link | conditional | "Reset", → /guru/analisis-item, fa-times | FN-M11-5.1.2 |

#### S7 — `/guru/perbandingan-kelas` (500) (7 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M11-S7-001 | text | visible-default | "500" | FN-M11-6.1.1 |
| EL-M11-S7-002 | text | visible-default | "⚙️" | FN-M11-6.1.1 |
| EL-M11-S7-003 | heading | visible-default | "Ralat Pelayan" | FN-M11-6.1.1 |
| EL-M11-S7-004 | text | visible-default | "Sesuatu tidak kena di pihak kami. Pasukan teknikal telah dimaklumkan. Sila cuba sebentar l…" | FN-M11-6.1.1 |
| EL-M11-S7-005 | link | visible-default | "Halaman Utama", → / | FN-M11-6.1.1 |
| EL-M11-S7-006 | link | visible-default | "Cuba Semula", → javascript:location.reload() | FN-M11-6.1.1 |
| EL-M11-S7-007 | text | visible-default | "PRESTASIPLUS" | FN-M11-6.1.1 |

#### S8 — `/guru/laporan-mingguan-kelas` (403) (7 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M11-S8-001 | text | visible-default | "403" | FN-M11-6.2.1 |
| EL-M11-S8-002 | text | visible-default | "🚫" | FN-M11-6.2.1 |
| EL-M11-S8-003 | heading | visible-default | "Akses Ditolak" | FN-M11-6.2.1 |
| EL-M11-S8-004 | text | visible-default | "Anda tidak mempunyai kebenaran untuk mengakses halaman ini. Sila log masuk dengan akaun ya…" | FN-M11-6.2.1 |
| EL-M11-S8-005 | link | visible-default | "Halaman Utama", → / | FN-M11-6.2.1 |
| EL-M11-S8-006 | link | visible-default | "Log Masuk", → /login | FN-M11-6.2.1 |
| EL-M11-S8-007 | text | visible-default | "PRESTASIPLUS" | FN-M11-6.2.1 |

### 6.2 Shell elements

#### SHU — user-portal shell (chrome of S1, S6) — 374 elements, 13 M11-relevant

M11-relevant elements:

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M11-SHU-136 | heading | visible-default | "Laporan Statistik" | FN-M11-1.1.2 |
| EL-M11-SHU-137 | text | visible-default | "Pantau penglibatan dan prestasi pelajar" | FN-M11-1.1.2 |
| EL-M11-SHU-259 | modal | hidden-only | "PENILAIAN" | FN-M11-1.1.1 |
| EL-M11-SHU-260 | text | hidden-only | "PENILAIAN" | FN-M11-1.1.1 |
| EL-M11-SHU-263 | link | hidden-only | "Laporan", → /guru/laporan, fa-chart-pie | FN-M11-1.1.1 |
| EL-M11-SHU-265 | modal | hidden-only | "ANALITIK" | FN-M11-1.1.1 |
| EL-M11-SHU-266 | text | hidden-only | "ANALITIK" | FN-M11-1.1.1 |
| EL-M11-SHU-267 | link | hidden-only | "Monitoring", → /guru/monitoring, fa-binoculars | FN-M11-1.1.1 |
| EL-M11-SHU-276 | link | hidden-only | "Analisis Item", → /guru/analisis-item, fa-chart-pie | FN-M11-1.1.1 |
| EL-M11-SHU-277 | link | hidden-only | "Perbandingan Kelas", → /guru/perbandingan-kelas, fa-balance-scale | FN-M11-1.1.1 |
| EL-M11-SHU-278 | link | hidden-only | "Laporan Mingguan", → /guru/laporan-mingguan-kelas, fa-calendar-week | FN-M11-1.1.1 |
| EL-M11-SHU-373 | heading | conditional | "Analisis Item Soalan" | FN-M11-1.1.2 |
| EL-M11-SHU-374 | text | conditional | "Kenal pasti soalan yang sukar dan indeks diskriminasi" | FN-M11-1.1.2 |

Excluded elements (361), listed individually:

| Element | Kind | Status | Content / attributes | Reason |
|---|---|---|---|---|
| EL-M11-SHU-001 | link | visible-default | → /dashboard | Excluded — global shell (logo/brand) |
| EL-M11-SHU-002 | image | visible-default | image | Excluded — global shell (logo/brand) |
| EL-M11-SHU-003 | text | visible-default | "Platform Latih Tubi Nasional" | Excluded — global shell (logo/brand) |
| EL-M11-SHU-004 | link | visible-default | "Dashboard", → /dashboard, fa-home | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-005 | link | visible-default | "Target SPM", → /target-spm, fa-bullseye | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-006 | link | visible-default | "Misi Harian", → /misi-harian, fa-rocket | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-007 | link | visible-default | "Remedial", → /remedial/saya, fa-flask | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-008 | text | visible-default | "SPM" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-009 | link | visible-default | "SPM SPM", → /spm, fa-graduation-cap | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-010 | badge | visible-default | "SPM" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-011 | link | visible-default | "Headcount", → /headcount, fa-chart-line | Excluded — shell link owned by M08 |
| EL-M11-SHU-012 | link | visible-default | "Prestasi", → /prestasi, fa-chart-bar | Excluded — shell link owned by M08 |
| EL-M11-SHU-013 | link | visible-default | "Analitik Adaptif", → /analitik/pelajar, fa-brain | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-014 | link | visible-default | "Analisa Item", → /analisa-item, fa-magnifying-glass-chart | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-015 | link | visible-default | "Kombo", → /kombo, fa-fire | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-016 | link | visible-default | "Laporan Mingguan", → /laporan-mingguan, fa-file-lines | Excluded — shell link owned by M08 |
| EL-M11-SHU-017 | text | visible-default | "Pusat AI" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-018 | badge | visible-default | "NEW" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-019 | text | visible-default | "🤖 Cikgu Alesa AI" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-020 | link | visible-default | "Cikgu Alesa Chat AI", → /cikgu, fa-robot | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-021 | badge | visible-default | "AI" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-022 | text | visible-default | "✨ Visi & Pertandingan" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-023 | link | visible-default | "Sekolah Bersaing NEW", → /sekolah-bersaing, fa-trophy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-024 | badge | visible-default | "NEW" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-025 | link | visible-default | "Tetapan Peribadi", → /tetapan, fa-cog | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-026 | text | visible-default | "🏆 Bilik Duta · 🔒 PREVIEW" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-027 | link | visible-default | "Bilik Duta DEV", → /bilik-duta, fa-crown | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-028 | badge | visible-default | "DEV" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-029 | text | visible-default | "🤖 AI Pintar (Pelajar)" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-030 | link | visible-default | "Wellbeing Alerts", → /wellbeing/alerts, fa-triangle-exclamation | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-031 | link | visible-default | "Kamus AI", → /pusat-ai/kamus, fa-book-open | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-032 | link | visible-default | "Pendamping Motivasi", → /pusat-ai/pendamping, fa-heart | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-033 | link | visible-default | "Doa & Motivasi", → /pusat-ai/doa, fa-mosque | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-034 | text | visible-default | "🎯 AI Pintar (Guru)" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-035 | link | visible-default | "Aktiviti Advisor", → /pusat-ai/aktiviti, fa-lightbulb | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-036 | link | visible-default | "Whiteboard → Quiz", → /pusat-ai/whiteboard, fa-clipboard-question | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-037 | link | visible-default | "RPH (Cikgu Alesa)", → /cikgu/rph, fa-clipboard-list | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-038 | link | visible-default | "Semak Karangan (Cikgu Alesa)", → /cikgu/essay, fa-pen-fancy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-039 | link | visible-default | "PBD (Cikgu Alesa)", → /cikgu/pbd, fa-tasks | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-040 | text | visible-default | "🛡️ Kawalan Kualiti" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-041 | link | visible-default | "Semakan Nota Master", → /admin/master-notes, fa-shield-alt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-042 | link | visible-default | "Audit Log", → /admin/audit-log, fa-clipboard-check | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-043 | text | visible-default | "🏆 Bilik Duta" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-044 | link | visible-default | "Bilik Duta", → /bilik-duta, fa-crown | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-045 | link | visible-default | "Akademi Duta", → /akademi-duta, fa-graduation-cap | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-046 | link | visible-default | "Kem & Bootcamp", → /bilik-duta/kem, fa-campground | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-047 | text | visible-default | "✨ Visi & Pertandingan" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-048 | link | visible-default | "Profil Cerah", → /profil-cerah, fa-magic | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-049 | link | visible-default | "Sekolah Bersaing", → /sekolah-bersaing, fa-trophy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-050 | link | visible-default | "Cita-Cita Hijrah", → /cita-cita, fa-star | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-051 | text | visible-default | "💎 Killer Features" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-052 | link | visible-default | "Cikgu Suara", → /cikgu-suara, fa-microphone | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-053 | link | visible-default | "SPM Mock Exam", → /spm-mock, fa-file-pen | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-054 | link | visible-default | "Wellbeing Alerts", → /wellbeing/alerts, fa-triangle-exclamation | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-055 | link | visible-default | "Pembetulan", → /pembetulan, fa-arrows-rotate | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-056 | link | visible-default | "Mohon Keluarga Angkat", → /mohon-keluarga-angkat, fa-hand-holding-heart | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-057 | link | visible-default | "Penguasaan", → /penguasaan, fa-layer-group | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-058 | link | visible-default | "Laporan Soalan", → /laporan-soalan, fa-flag | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-059 | link | visible-default | "Liga Pertandingan", → /liga, fa-trophy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-060 | link | visible-default | "Perutusan", → /perutusan, fa-scroll | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-061 | text | visible-default | "Pembelajaran" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-062 | link | visible-default | "Latih Tubi", → /practice, fa-brain | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-063 | link | visible-default | "Soalan by Chapter", → /practice/chapter, fa-layer-group | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-064 | link | visible-default | "Soalan Berstruktur", → /latihan-berstruktur, fa-list-ol | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-065 | link | visible-default | "Kedudukan", → /ranking, fa-trophy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-066 | link | visible-default | "PKSK PRO", → /pksk, fa-shield-halved | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-067 | badge | visible-default | "PRO" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-068 | link | visible-default | "Artikel", → /artikel, fa-newspaper | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-069 | link | visible-default | "Video", → /video, fa-play-circle | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-070 | link | visible-default | "Permainan 🎮", → /permainan, fa-gamepad | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-071 | badge | visible-default | "🎮" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-072 | link | visible-default | "Cabutan Bertuah 🎟️", → /cabutan, fa-ticket | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-073 | badge | visible-default | "🎟️" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-074 | link | visible-default | "Tournament", → /tournament, fa-trophy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-075 | link | visible-default | "Topik", → /topics, fa-book-open | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-076 | link | visible-default | "Peta Belajar", → /peta-belajar, fa-map | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-077 | link | visible-default | "Kelas Saya", → /kelas-saya, fa-book-reader | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-078 | link | visible-default | "Set Soalan Guru", → /set-soalan-saya, fa-clipboard-list | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-079 | link | visible-default | "Audio KBAT", → /audio-kbat, fa-headphones | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-080 | link | visible-default | "Syiling & Token 🏆", → /gamification, fa-coins | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-081 | badge | visible-default | "🏆" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-082 | link | visible-default | "Tukar Token", → /gamification/convert, fa-exchange-alt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-083 | link | visible-default | "Cabaran Harian", → /gamification/challenges, fa-bullseye | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-084 | link | visible-default | "Kedai Hadiah", → /gamification/rewards, fa-gift | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-085 | link | visible-default | "Kelulusan Hadiah", → /cikgu/kelulusan-hadiah, fa-shield-halved | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-086 | link | visible-default | "Marketplace", → /marketplace, fa-shopping-bag | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-087 | link | visible-default | "Papan Pendahulu", → /gamification/leaderboard, fa-trophy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-088 | link | visible-default | "Pencapaian", → /gamification/achievements, fa-medal | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-089 | link | visible-default | "Kotak Misteri", → /gamification/mystery-box, fa-box-open | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-090 | link | visible-default | "Rujuk Kawan", → /gamification/referral, fa-user-plus | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-091 | link | visible-default | "Cikgu Alesa AI", → /cikgu, fa-robot | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-092 | badge | visible-default | "AI" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-093 | text | visible-default | "Cikgu Alesa Tools" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-094 | link | visible-default | "RPH (Rancangan Harian)", → /cikgu/rph, fa-file-alt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-095 | link | visible-default | "PBD Auto-Tag", → /cikgu/pbd, fa-clipboard-check | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-096 | link | visible-default | "Mark Karangan", → /cikgu/essay, fa-pen-fancy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-097 | link | visible-default | "Admin Tebusan", → /admin/hadiah, fa-cogs | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-098 | link | visible-default | "Timeline Saya", → /timeline, fa-camera | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-099 | text | visible-default | "Portal Guru" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-100 | link | visible-default | "Dashboard Guru", → /guru, fa-chart-pie | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-101 | link | visible-default | "Kelas Guru", → /guru/kelas, fa-chalkboard-teacher | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-102 | link | visible-default | "Sumbang Soalan", → /guru/soalan, fa-pen-fancy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-103 | link | visible-default | "Databank Soalan", → /guru/databank, fa-database | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-104 | text | visible-default | "PPD / JPN" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-105 | link | visible-default | "Dashboard PPD", → /ppd/dashboard, fa-building-columns | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-106 | link | visible-default | "Statistik PPD", → /ppd/statistik-penggunaan, fa-chart-pie | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-107 | link | visible-default | "Ranking Kebangsaan", → /ppd/ranking-kebangsaan, fa-trophy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-108 | link | visible-default | "Dashboard JPN", → /jpn/dashboard, fa-building-flag | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-109 | link | visible-default | "Ranking Kebangsaan JPN", → /jpn/ranking-kebangsaan, fa-trophy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-110 | text | visible-default | "Admin" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-111 | link | visible-default | "Ke Admin Panel", → /admin, fa-shield-halved | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-112 | link | visible-default | "Soalan by Chapter", → /practice/chapter, fa-layer-group | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-113 | link | visible-default | "Billing Dashboard", → /admin/billing, fa-chart-line | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-114 | link | visible-default | "Urus Produk", → /admin/marketplace/products, fa-store | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-115 | link | visible-default | "Urus Penjual", → /admin/marketplace/sellers, fa-user-tie | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-116 | link | visible-default | "Urus Hadiah", → /admin/hadiah, fa-gift | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-117 | link | visible-default | "Gamifikasi Guru", → /admin/gamifikasi/guru, fa-chalkboard-teacher | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-118 | link | visible-default | "Kertas Soalan Guru", → /admin/question-submissions, fa-file-upload | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-119 | link | visible-default | "Profil Saya", → /profile, fa-user-circle | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-120 | link | visible-default | "Pakej 💎", → /pricing, fa-crown | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-121 | badge | visible-default | "💎" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-122 | link | visible-default | "Invois Saya", → /billing/invoices, fa-file-invoice | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-123 | link | visible-default | "Panduan", → /panduan, fa-book | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-124 | text | visible-default | "Bantuan" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-125 | link | visible-default | "Tiket Bantuan", → /pusat-tuisyen/tiket, fa-life-ring | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-126 | link | visible-default | "Gambar Rajah 6,144", → /admin/soalan-gambar, fa-images | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-127 | badge | visible-default | "6,144" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-128 | link | visible-default | "Urus Tiket 2", → /admin/tiket, fa-headset | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-129 | badge | visible-default | "2" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-130 | card | visible-default | "<name>" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-131 | image | visible-default | image | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-132 | text | visible-default | "<name>" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-133 | text | visible-default | "<email>" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-134 | link | visible-default | → /logout, fa-sign-out-alt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-135 | toggle | visible-default | fa-bars | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-138 | text | visible-default | "256" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-139 | text | visible-default | "koin" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-140 | text | visible-default | "8" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-141 | text | visible-default | "mata" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-142 | text | visible-default | "1" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-143 | text | visible-default | "hari 🔥" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-144 | link | visible-default | "99+", → /notifikasi, fa-bell | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-145 | badge | visible-default | "99+" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-146 | image | visible-default | image | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-147 | link | visible-default | → /logout, fa-sign-out-alt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-148 | toggle | conditional | fa-bars | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-149 | link | conditional | → /dashboard | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-150 | image | conditional | image | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-151 | text | conditional | "256" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-152 | text | conditional | "koin" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-153 | text | conditional | "8" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-154 | text | conditional | "mata" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-155 | text | conditional | "1" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-156 | text | conditional | "🔥" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-157 | text | visible-default | "© 2026 PRESTASIPLUS. Hakcipta Terpelihara" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-158 | text | visible-default | "✨" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-159 | text | visible-default | "Didikan penuh dari Malaysia" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-160 | text | visible-default | "❤️" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-161 | text | visible-default | "🇲🇾" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-162 | clickable | hidden-only | clickable | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-163 | modal | hidden-only | "<name>" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-164 | image | hidden-only | image | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-165 | text | hidden-only | "Platform Latih Tubi Nasional" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-166 | button | hidden-only | fa-times | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-167 | image | hidden-only | image | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-168 | text | hidden-only | "<name>" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-169 | text | hidden-only | "admin" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-170 | link | hidden-only | "Dashboard", → /dashboard, fa-home | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-171 | modal | hidden-only | "SPM" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-172 | text | hidden-only | "SPM" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-173 | link | hidden-only | "SPM SPM", → /spm, fa-graduation-cap | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-174 | badge | hidden-only | "SPM" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-175 | link | hidden-only | "Headcount", → /headcount, fa-chart-line | Excluded — shell link owned by M08 |
| EL-M11-SHU-176 | link | hidden-only | "Prestasi", → /prestasi, fa-chart-bar | Excluded — shell link owned by M08 |
| EL-M11-SHU-177 | link | hidden-only | "Analisa Item", → /analisa-item, fa-magnifying-glass-chart | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-178 | link | hidden-only | "Amaran Awal", → /amaran, fa-exclamation-triangle | Excluded — shell link owned by M18 (`/amaran`) |
| EL-M11-SHU-179 | link | hidden-only | "Kombo", → /kombo, fa-fire | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-180 | link | hidden-only | "Cikgu Alesa AI", → /cikgu, fa-robot | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-181 | badge | hidden-only | "AI" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-182 | link | hidden-only | "RPH", → /cikgu/rph, fa-file-alt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-183 | link | hidden-only | "PBD Auto-Tag", → /cikgu/pbd, fa-clipboard-check | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-184 | link | hidden-only | "Mark Karangan", → /cikgu/essay, fa-pen-fancy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-185 | link | hidden-only | "Laporan Mingguan", → /laporan-mingguan, fa-file-lines | Excluded — shell link owned by M08 |
| EL-M11-SHU-186 | link | hidden-only | "Pembetulan", → /pembetulan, fa-arrows-rotate | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-187 | link | hidden-only | "Penguasaan", → /penguasaan, fa-layer-group | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-188 | link | hidden-only | "Laporan Soalan", → /laporan-soalan, fa-flag | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-189 | link | hidden-only | "Command Center LIVE", → /ppd/command-center, fa-satellite-dish | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-190 | badge | hidden-only | "LIVE" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-191 | link | hidden-only | "Dashboard PPD", → /ppd/dashboard, fa-building-columns | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-192 | link | hidden-only | "Statistik Penggunaan", → /ppd/statistik-penggunaan, fa-chart-pie | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-193 | link | hidden-only | "Ranking Kebangsaan", → /ppd/ranking-kebangsaan, fa-trophy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-194 | link | hidden-only | "Benchmark Sekolah", → /ppd/benchmark-sekolah, fa-ranking-star | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-195 | link | hidden-only | "Peta Haba", → /ppd/peta-haba, fa-map-location-dot | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-196 | link | hidden-only | "Export Laporan", → /ppd/export-laporan, fa-file-export | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-197 | link | hidden-only | "Leaderboard Sekolah", → /ppd/leaderboard-sekolah, fa-trophy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-198 | link | hidden-only | "Dashboard JPN", → /jpn/dashboard, fa-building-flag | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-199 | link | hidden-only | "Statistik Penggunaan", → /jpn/statistik-penggunaan, fa-chart-pie | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-200 | link | hidden-only | "Ranking Kebangsaan", → /jpn/ranking-kebangsaan, fa-trophy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-201 | modal | hidden-only | "Pembelajaran" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-202 | text | hidden-only | "Pembelajaran" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-203 | link | hidden-only | "Latih Tubi", → /practice, fa-brain | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-204 | link | hidden-only | "Soalan by Chapter", → /practice/chapter, fa-layer-group | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-205 | link | hidden-only | "Soalan Berstruktur", → /latihan-berstruktur, fa-list-ol | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-206 | link | hidden-only | "Kedudukan", → /ranking, fa-trophy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-207 | link | hidden-only | "PKSK PRO", → /pksk, fa-shield-halved | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-208 | badge | hidden-only | "PRO" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-209 | link | hidden-only | "Artikel", → /artikel, fa-newspaper | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-210 | link | hidden-only | "Video", → /video, fa-play-circle | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-211 | link | hidden-only | "Permainan 🎮", → /permainan, fa-gamepad | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-212 | badge | hidden-only | "🎮" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-213 | link | hidden-only | "Cabutan Bertuah 🎟️", → /cabutan, fa-ticket | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-214 | badge | hidden-only | "🎟️" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-215 | link | hidden-only | "Tournament", → /tournament, fa-trophy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-216 | link | hidden-only | "Topik", → /topics, fa-book-open | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-217 | link | hidden-only | "Peta Belajar", → /peta-belajar, fa-map | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-218 | link | hidden-only | "Command Center LIVE", → /guru/command-center, fa-satellite-dish | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-219 | badge | hidden-only | "LIVE" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-220 | text | hidden-only | "Pusat AI" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-221 | badge | hidden-only | "NEW" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-222 | text | hidden-only | "🤖 Cikgu Alesa AI" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-223 | link | hidden-only | "Cikgu Alesa Chat AI", → /cikgu, fa-robot | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-224 | badge | hidden-only | "AI" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-225 | text | hidden-only | "✨ Visi & Pertandingan" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-226 | link | hidden-only | "Sekolah Bersaing NEW", → /sekolah-bersaing, fa-trophy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-227 | badge | hidden-only | "NEW" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-228 | link | hidden-only | "Tetapan Peribadi", → /tetapan, fa-cog | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-229 | text | hidden-only | "🏆 Bilik Duta · 🔒 PREVIEW" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-230 | link | hidden-only | "Bilik Duta DEV", → /bilik-duta, fa-crown | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-231 | badge | hidden-only | "DEV" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-232 | text | hidden-only | "🤖 AI Pintar (Pelajar)" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-233 | link | hidden-only | "Wellbeing Alerts", → /wellbeing/alerts, fa-triangle-exclamation | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-234 | link | hidden-only | "Kamus AI", → /pusat-ai/kamus, fa-book-open | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-235 | link | hidden-only | "Pendamping Motivasi", → /pusat-ai/pendamping, fa-heart | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-236 | link | hidden-only | "Doa & Motivasi", → /pusat-ai/doa, fa-mosque | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-237 | text | hidden-only | "🎯 AI Pintar (Guru)" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-238 | link | hidden-only | "Aktiviti Advisor", → /pusat-ai/aktiviti, fa-lightbulb | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-239 | link | hidden-only | "Whiteboard → Quiz", → /pusat-ai/whiteboard, fa-clipboard-question | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-240 | link | hidden-only | "RPH (Cikgu Alesa)", → /cikgu/rph, fa-clipboard-list | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-241 | link | hidden-only | "Semak Karangan (Cikgu Alesa)", → /cikgu/essay, fa-pen-fancy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-242 | link | hidden-only | "PBD (Cikgu Alesa)", → /cikgu/pbd, fa-tasks | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-243 | text | hidden-only | "🛡️ Kawalan Kualiti" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-244 | link | hidden-only | "Semakan Nota Master", → /admin/master-notes, fa-shield-alt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-245 | link | hidden-only | "Audit Log", → /admin/audit-log, fa-clipboard-check | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-246 | modal | hidden-only | "HARIAN" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-247 | text | hidden-only | "HARIAN" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-248 | link | hidden-only | "Dashboard Guru", → /guru, fa-chart-pie | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-249 | link | hidden-only | "Misi Harian", → /guru/misi-harian, fa-rocket | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-250 | link | hidden-only | "Soalan by Chapter", → /practice/chapter, fa-layer-group | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-251 | link | hidden-only | "Kelas Saya", → /guru/kelas, fa-chalkboard-teacher | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-252 | link | hidden-only | "Pelajar Saya", → /guru/pelajar, fa-user-graduate | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-253 | link | hidden-only | "Kehadiran Digital", → /guru/kehadiran-digital, fa-clipboard-check | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-254 | modal | hidden-only | "PENGAJARAN" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-255 | text | hidden-only | "PENGAJARAN" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-256 | link | hidden-only | "Jadual Belajar", → /guru/jadual-belajar, fa-calendar-alt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-257 | link | hidden-only | "Broadcast", → /guru/broadcast, fa-bullhorn | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-258 | link | hidden-only | "Kelas Live", → /guru/live-kelas, fa-broadcast-tower | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-261 | link | hidden-only | "Headcount", → /headcount, fa-chart-line | Excluded — shell link owned by M08 |
| EL-M11-SHU-262 | link | hidden-only | "Prestasi", → /prestasi/kelas, fa-chart-bar | Excluded — shell link owned by M08 |
| EL-M11-SHU-264 | link | hidden-only | "Amaran Awal", → /amaran, fa-exclamation-triangle | Excluded — shell link owned by M18 (`/amaran`) |
| EL-M11-SHU-268 | toggle | hidden-only | "Kirkpatrick", fa-microscope | Excluded — shell link owned by M12 (Kirkpatrick) |
| EL-M11-SHU-269 | link | hidden-only | "Ringkasan", → /guru/kirkpatrick, fa-home | Excluded — shell link owned by M12 (Kirkpatrick) |
| EL-M11-SHU-270 | link | hidden-only | "T1: Reaksi", → /guru/kirkpatrick/reaction, fa-smile | Excluded — shell link owned by M12 (Kirkpatrick) |
| EL-M11-SHU-271 | link | hidden-only | "T2: Pembelajaran", → /guru/kirkpatrick/learning, fa-graduation-cap | Excluded — shell link owned by M12 (Kirkpatrick) |
| EL-M11-SHU-272 | link | hidden-only | "T3: Tingkah Laku", → /guru/kirkpatrick/behavior, fa-running | Excluded — shell link owned by M12 (Kirkpatrick) |
| EL-M11-SHU-273 | link | hidden-only | "T4: Hasil", → /guru/kirkpatrick/results, fa-trophy | Excluded — shell link owned by M12 (Kirkpatrick) |
| EL-M11-SHU-274 | link | hidden-only | "Rantaian Impak", → /guru/kirkpatrick/chain, fa-link | Excluded — shell link owned by M12 (Kirkpatrick) |
| EL-M11-SHU-275 | link | hidden-only | "Intervensi", → /guru/kirkpatrick/interventions, fa-hand-holding-medical | Excluded — shell link owned by M12 (Kirkpatrick) |
| EL-M11-SHU-279 | modal | hidden-only | "BANK SOALAN" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-280 | text | hidden-only | "BANK SOALAN" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-281 | link | hidden-only | "Sumbang Soalan", → /guru/soalan, fa-pen-fancy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-282 | link | hidden-only | "Soalan & Rujukan", → /guru/soalan-guru, fa-book-open | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-283 | link | hidden-only | "Soalan Berstruktur", → /guru/soalan-berstruktur, fa-list-ol | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-284 | link | hidden-only | "Databank Soalan", → /guru/databank, fa-database | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-285 | link | hidden-only | "Set Soalan", → /guru/set-soalan, fa-clipboard-list | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-286 | modal | hidden-only | "LAIN-LAIN" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-287 | text | hidden-only | "LAIN-LAIN" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-288 | link | hidden-only | "Syiling & Ganjaran", → /guru/gamifikasi, fa-coins | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-289 | link | hidden-only | "Sumbang Artikel", → /guru/artikel, fa-newspaper | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-290 | link | hidden-only | "Video", → /video, fa-play-circle | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-291 | link | hidden-only | "Kelas Saya BARU", → /kelas-saya, fa-book-reader | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-292 | badge | hidden-only | "BARU" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-293 | link | hidden-only | "Set Soalan Guru", → /set-soalan-saya, fa-clipboard-list | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-294 | modal | hidden-only | "Gamifikasi" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-295 | text | hidden-only | "Gamifikasi" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-296 | link | hidden-only | "Syiling & Token", → /gamification, fa-coins | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-297 | link | hidden-only | "Tukar Token", → /gamification/convert, fa-exchange-alt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-298 | link | hidden-only | "Cabaran Harian", → /gamification/challenges, fa-bullseye | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-299 | link | hidden-only | "Kedai Hadiah", → /gamification/rewards, fa-gift | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-300 | link | hidden-only | "Marketplace", → /marketplace, fa-shopping-bag | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-301 | link | hidden-only | "Papan Pendahulu", → /gamification/leaderboard, fa-trophy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-302 | link | hidden-only | "Pencapaian", → /gamification/achievements, fa-medal | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-303 | link | hidden-only | "Kotak Misteri", → /gamification/mystery-box, fa-box-open | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-304 | link | hidden-only | "Rujuk Kawan", → /gamification/referral, fa-user-plus | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-305 | link | hidden-only | "Timeline Saya", → /timeline, fa-camera | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-306 | link | hidden-only | "Invois Saya", → /billing/invoices, fa-file-invoice | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-307 | link | hidden-only | "Ke Admin Panel", → /admin, fa-shield-halved | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-308 | link | hidden-only | "Soalan by Chapter", → /practice/chapter, fa-layer-group | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-309 | link | hidden-only | "Billing Dashboard", → /admin/billing, fa-chart-line | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-310 | link | hidden-only | "Urus Produk", → /admin/marketplace/products, fa-store | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-311 | link | hidden-only | "Urus Penjual", → /admin/marketplace/sellers, fa-user-tie | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-312 | link | hidden-only | "Urus Hadiah", → /admin/hadiah, fa-gift | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-313 | link | hidden-only | "Gamifikasi Guru", → /admin/gamifikasi/guru, fa-chalkboard-teacher | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-314 | link | hidden-only | "Profil Saya", → /profile, fa-user-circle | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-315 | link | hidden-only | "Tetapan", → /settings, fa-cog | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-316 | link | hidden-only | "Panduan", → /pusat-tuisyen/panduan, fa-book | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-317 | link | hidden-only | "Log Keluar", → /logout, fa-sign-out-alt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-318 | text | hidden-only | "© 2026 PRESTASIPLUS 🇲🇾" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-319 | text | hidden-only | "Pasang PRESTASIPLUS" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-320 | text | hidden-only | "Akses pantas dari skrin utama" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-321 | button | hidden-only | "Pasang" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-322 | button | hidden-only | "10", fa-times | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-323 | card | hidden-only | "Pasang PRESTASIPLUS" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-324 | image | hidden-only | image | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-325 | heading | hidden-only | "Pasang PRESTASIPLUS" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-326 | text | hidden-only | "Ikuti langkah berikut:" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-327 | badge | hidden-only | "1" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-328 | text | hidden-only | "Tekan ikon Share" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-329 | text | hidden-only | "Ikon di bawah skrin Safari", fa-share-from-square | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-330 | badge | hidden-only | "2" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-331 | text | hidden-only | "Pilih "Add to Home Screen"" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-332 | text | hidden-only | "Scroll ke bawah, tekan Add to Home Screen", fa-plus-square | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-333 | badge | hidden-only | "3" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-334 | text | hidden-only | "Tekan "Add"" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-335 | text | hidden-only | "PRESTASIPLUS akan muncul di skrin utama anda" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-336 | button | hidden-only | "Faham!" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-337 | link | conditional | "Home", → /dashboard, fa-home | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-338 | link | conditional | "SPM", → /spm, fa-graduation-cap | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-339 | link | conditional | "Game", → /permainan, fa-gamepad | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-340 | link | conditional | "Topik", → /topics, fa-book-open | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-341 | toggle | conditional | "Chat", fa-comments | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-342 | toggle | conditional | "Lagi", fa-bars | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-343 | card | hidden-only | "Pembantu PrestasiPlus" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-344 | text | hidden-only | "Pembantu PrestasiPlus" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-345 | text | hidden-only | "Sedia membantu anda" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-346 | button | hidden-only | fa-times | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-347 | heading | hidden-only | "Selamat Datang!" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-348 | text | hidden-only | "Sila masukkan maklumat anda sebelum memulakan perbualan." | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-349 | form | hidden-only | form | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-350 | label | hidden-only | "Nama" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-351 | input | hidden-only | input | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-352 | label | hidden-only | "No. Telefon" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-353 | input | hidden-only | input | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-354 | button | hidden-only | "Mula Berbual", fa-comments | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-355 | card | hidden-only | card | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-356 | text | hidden-only | "Selamat datang, ! Saya Pembantu Maya PrestasiPlus. Bagaimana saya boleh membantu anda hari…" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-357 | button | hidden-only | "Apakah PrestasiPlus?" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-358 | button | hidden-only | "Cara mendaftar" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-359 | button | hidden-only | "Harga langganan" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-360 | card | hidden-only | "<name>" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-361 | text | hidden-only | "Selamat datang, ! Saya Pembantu Maya PrestasiPlus. Bagaimana saya boleh membantu anda hari…" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-362 | text | hidden-only | "<name>" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-363 | button | hidden-only | "Apakah PrestasiPlus?" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-364 | button | hidden-only | "Cara mendaftar" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-365 | button | hidden-only | "Harga langganan" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-366 | button | hidden-only | fa-thumbs-up | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-367 | button | hidden-only | fa-thumbs-down | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-368 | form | hidden-only | form | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-369 | textarea | hidden-only | textarea | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-370 | button | hidden-only | fa-paper-plane | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-371 | text | hidden-only | "Dikuasakan oleh AI · Jawapan mungkin tidak sentiasa tepat" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHU-372 | toggle | hidden-only | fa-comments | Excluded — global shell / M23 (or the module the link targets) |

#### SHA — admin-panel shell (chrome of S2–S5) — 255 elements, 48 M11-relevant

M11-relevant elements:

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M11-SHA-013 | link | visible-default | "Monitoring", → /admin/monitoring, fa-binoculars | FN-M11-1.1.5 |
| EL-M11-SHA-118 | heading | visible-default | "Monitoring Penglibatan" | FN-M11-1.1.2 |
| EL-M11-SHA-119 | text | visible-default | "Pantau penglibatan sekolah & pelajar T4/T5 dalam platform" | FN-M11-1.1.2 |
| EL-M11-SHA-144 | link | hidden-only | "Monitoring", → /admin/monitoring, fa-binoculars | FN-M11-1.1.5 |
| EL-M11-SHA-197 | tooltip | conditional | "16.8GB / 31.1GB", fa-memory | FN-M11-1.1.3 |
| EL-M11-SHA-198 | tooltip | conditional | "199.3GB / 398.7GB", fa-hard-drive | FN-M11-1.1.3 |
| EL-M11-SHA-199 | tooltip | conditional | "Load: 0.69 / 8 cores", fa-microchip | FN-M11-1.1.3 |
| EL-M11-SHA-200 | heading | conditional | "Detail Sekolah" | FN-M11-1.1.3 |
| EL-M11-SHA-208 | tooltip | conditional | "Load: 0.7 / 8 cores", fa-microchip | FN-M11-4.2.10 |
| EL-M11-SHA-209 | tooltip | hidden-only | "Load: 0.67 / 8 cores", fa-microchip | FN-M11-4.2.10 |
| EL-M11-SHA-210 | tooltip | conditional | "16.6GB / 31.1GB", fa-memory | FN-M11-4.2.10 |
| EL-M11-SHA-211 | modal | conditional | "A" | FN-M11-4.2.10 |
| EL-M11-SHA-212 | card | conditional | "Salah" | FN-M11-4.2.10 |
| EL-M11-SHA-213 | badge | conditional | "Salah" | FN-M11-4.2.10 |
| EL-M11-SHA-214 | text | conditional | "Sejarah · Sejarah Tingkatan 5 KSSM" | FN-M11-4.2.10 |
| EL-M11-SHA-215 | button | conditional | fa-times | FN-M11-4.2.10 |
| EL-M11-SHA-216 | text | conditional | "Aras", fa-signal | FN-M11-4.2.10 |
| EL-M11-SHA-217 | text | hidden-only | "undefined" | FN-M11-4.2.10 |
| EL-M11-SHA-218 | text | conditional | "Pilihan Jawapan" | FN-M11-4.2.10 |
| EL-M11-SHA-219 | text | hidden-only | "Jawapan Betul", fa-check-circle | FN-M11-4.2.10 |
| EL-M11-SHA-220 | text | hidden-only | "Jawapan Pelajar", fa-times-circle | FN-M11-4.2.10 |
| EL-M11-SHA-221 | text | hidden-only | "Pilihan jawapan telah dipadam dari sistem." | FN-M11-1.1.3 |
| EL-M11-SHA-222 | text | conditional | "Penjelasan", fa-lightbulb | FN-M11-1.1.3 |
| EL-M11-SHA-223 | text | hidden-only | "undefined" | FN-M11-1.1.3 |
| EL-M11-SHA-224 | heading | conditional | "Detail Pelajar" | FN-M11-1.1.3 |
| EL-M11-SHA-226 | link | conditional | "<school>", → /admin/monitoring/sekolah/8080 | FN-M11-4.2.10 |
| EL-M11-SHA-227 | text | conditional | "/" | FN-M11-4.2.10 |
| EL-M11-SHA-228 | tooltip | conditional | "Load: 0.33 / 8 cores", fa-microchip | FN-M11-4.2.10 |
| EL-M11-SHA-229 | text | conditional | "Percubaan SPM 2025 Sejarah Melaka" | FN-M11-4.2.10 |
| EL-M11-SHA-230 | text | conditional | "2" | FN-M11-4.2.10 |
| EL-M11-SHA-231 | text | conditional | "2026-06-16 14:19:57" | FN-M11-4.2.10 |
| EL-M11-SHA-232 | text | conditional | "Apakah ciri negara berdaulat? I II III IV Pentadbiran yang sistematik Sempadan yang jelas …" | FN-M11-4.2.10 |
| EL-M11-SHA-233 | badge | conditional | "A" | FN-M11-4.2.10 |
| EL-M11-SHA-234 | text | conditional | "I dan IV" | FN-M11-4.2.10 |
| EL-M11-SHA-235 | text | hidden-only | "Jawapan Betul", fa-check-circle | FN-M11-4.2.10 |
| EL-M11-SHA-236 | text | conditional | "Jawapan Pelajar", fa-times-circle | FN-M11-4.2.10 |
| EL-M11-SHA-237 | badge | conditional | "B" | FN-M11-4.2.10 |
| EL-M11-SHA-238 | text | conditional | "II dan III" | FN-M11-4.2.10 |
| EL-M11-SHA-239 | text | hidden-only | "Jawapan Betul", fa-check-circle | FN-M11-4.2.10 |
| EL-M11-SHA-240 | text | hidden-only | "Jawapan Pelajar", fa-times-circle | FN-M11-4.2.10 |
| EL-M11-SHA-241 | badge | conditional | "C" | FN-M11-4.2.10 |
| EL-M11-SHA-242 | text | conditional | "III dan IV" | FN-M11-4.2.10 |
| EL-M11-SHA-243 | text | hidden-only | "Jawapan Betul", fa-check-circle | FN-M11-4.2.10 |
| EL-M11-SHA-244 | text | hidden-only | "Jawapan Pelajar", fa-times-circle | FN-M11-4.2.10 |
| EL-M11-SHA-245 | badge | conditional | "D" | FN-M11-4.2.10 |
| EL-M11-SHA-246 | text | conditional | "I dan II" | FN-M11-4.2.10 |
| EL-M11-SHA-250 | tooltip | conditional | "Load: 0.28 / 8 cores", fa-microchip | FN-M11-1.1.3 |
| EL-M11-SHA-253 | heading | conditional | "Detail Guru" | FN-M11-1.1.3 |

Excluded elements (207), listed individually:

| Element | Kind | Status | Content / attributes | Reason |
|---|---|---|---|---|
| EL-M11-SHA-001 | link | visible-default | → /admin | Excluded — global shell (logo/brand) |
| EL-M11-SHA-002 | image | visible-default | image | Excluded — global shell (logo/brand) |
| EL-M11-SHA-003 | text | visible-default | "Panel Pentadbir" | Excluded — global shell (logo/brand) |
| EL-M11-SHA-004 | link | visible-default | "Command Center LIVE", → /admin/command-center, fa-satellite-dish | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-005 | badge | visible-default | "LIVE" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-006 | link | visible-default | "Aktiviti Harian", → /admin/command-center/daily-activity, fa-chart-line | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-007 | link | visible-default | "Audio KBAT", → /admin/audio-kbat, fa-headphones | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-008 | text | visible-default | "HARIAN" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-009 | link | visible-default | "Dashboard", → /admin, fa-tachometer-alt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-010 | link | visible-default | "Laporan Eksekutif", → /admin/laporan-eksekutif, fa-file-alt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-011 | text | visible-default | "ANALITIK" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-012 | link | visible-default | "Analitik", → /admin/analytics, fa-chart-pie | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-014 | toggle | visible-default | "Kirkpatrick", fa-microscope | Excluded — shell link owned by M12 (Kirkpatrick) |
| EL-M11-SHA-015 | link | hidden-only | "Overview", → /admin/kirkpatrick, fa-th-large | Excluded — shell link owned by M12 (Kirkpatrick) |
| EL-M11-SHA-016 | link | hidden-only | "T1: Reaksi", → /admin/kirkpatrick/reaction, fa-smile | Excluded — shell link owned by M12 (Kirkpatrick) |
| EL-M11-SHA-017 | link | hidden-only | "T2: Pembelajaran", → /admin/kirkpatrick/learning, fa-brain | Excluded — shell link owned by M12 (Kirkpatrick) |
| EL-M11-SHA-018 | link | hidden-only | "T3: Tingkah Laku", → /admin/kirkpatrick/behavior, fa-running | Excluded — shell link owned by M12 (Kirkpatrick) |
| EL-M11-SHA-019 | link | hidden-only | "T4: Hasil", → /admin/kirkpatrick/results, fa-trophy | Excluded — shell link owned by M12 (Kirkpatrick) |
| EL-M11-SHA-020 | link | hidden-only | "Rantaian Impak", → /admin/kirkpatrick/chain, fa-link | Excluded — shell link owned by M12 (Kirkpatrick) |
| EL-M11-SHA-021 | link | hidden-only | "Intervensi", → /admin/kirkpatrick/interventions, fa-hand-holding-medical | Excluded — shell link owned by M12 (Kirkpatrick) |
| EL-M11-SHA-022 | link | visible-default | "Laporan", → /admin/laporan, fa-chart-bar | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-023 | text | visible-default | "PENGURUSAN" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-024 | toggle | visible-default | "Kurikulum", fa-sitemap | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-025 | link | hidden-only | "Kurikulum", → /admin/curriculum, fa-sitemap | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-026 | link | hidden-only | "Subjek", → /admin/subjects, fa-book | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-027 | link | hidden-only | "Tahap Pendidikan", → /admin/education-levels, fa-graduation-cap | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-028 | toggle | visible-default | "Soalan", fa-question-circle | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-029 | link | hidden-only | "Senarai Soalan", → /admin/questions, fa-list | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-030 | link | hidden-only | "Import CSV", → /admin/questions/import, fa-file-csv | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-031 | link | hidden-only | "Kualiti Soalan", → /admin/questions/quality, fa-clipboard-check | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-032 | link | hidden-only | "Laporan Soalan", → /admin/question-reports, fa-flag | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-033 | link | hidden-only | "Soalan Berstruktur", → /admin/structured-questions, fa-list-ol | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-034 | link | hidden-only | "Kertas Soalan Guru", → /admin/question-submissions, fa-file-upload | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-035 | toggle | visible-default | "Pengguna", fa-users | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-036 | link | hidden-only | "Senarai Pengguna", → /admin/users, fa-users | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-037 | link | hidden-only | "Sekolah", → /admin/schools, fa-school | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-038 | link | hidden-only | "Langganan Sekolah", → /admin/school-subscriptions, fa-file-contract | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-039 | link | hidden-only | "Import Pelajar", → /admin/import-students, fa-user-plus | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-040 | link | hidden-only | "Pelajar Komplimen", → /admin/comp-students, fa-gift | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-041 | link | hidden-only | "Import Pengguna", → /admin/users/bulk-import, fa-users-cog | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-042 | link | hidden-only | "Penajaan", → /admin/sponsors, fa-handshake | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-043 | link | hidden-only | "Anak Angkat", → /admin/anak-angkat, fa-child | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-044 | link | hidden-only | "Permohonan", → /admin/anak-angkat/permohonan, fa-file-alt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-045 | toggle | visible-default | "SPM", fa-graduation-cap | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-046 | link | hidden-only | "Databank Soalan", → /spm/tahun-lepas, fa-database | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-047 | link | hidden-only | "Latih Tubi", → /spm/latih-tubi, fa-bolt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-048 | link | hidden-only | "Tracking A", → /spm/ramalan, fa-crosshairs | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-049 | link | hidden-only | "Subjektif", → /spm/subjektif, fa-pen-fancy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-050 | toggle | visible-default | "Premium", fa-shield-halved | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-051 | link | hidden-only | "PKSK Soalan", → /admin/pksk/questions, fa-shield-halved | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-052 | link | hidden-only | "PKSK Akses", → /admin/pksk/access, fa-key | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-053 | text | visible-default | "SISTEM" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-054 | toggle | visible-default | "Gamifikasi", fa-gamepad | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-055 | link | hidden-only | "Overview", → /admin/gamification, fa-gamepad | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-056 | link | hidden-only | "Tier Config", → /admin/gamification/tiers, fa-crown | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-057 | link | hidden-only | "Cabaran", → /admin/gamification/challenges, fa-bullseye | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-058 | link | hidden-only | "Pelajar", → /admin/gamification/students, fa-users | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-059 | link | hidden-only | "Transaksi", → /admin/gamification/transactions, fa-receipt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-060 | link | hidden-only | "Kedai Hadiah", → /admin/hadiah, fa-gift | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-061 | link | hidden-only | "Gamifikasi Guru", → /admin/gamifikasi/guru, fa-chalkboard-teacher | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-062 | link | hidden-only | "Kawalan Reward", → /admin/reward-control, fa-shield-halved | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-063 | toggle | visible-default | "Battle & Permainan", fa-bolt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-064 | link | hidden-only | "Battle Live", → /battle, fa-bolt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-065 | link | hidden-only | "Ranking Sekolah", → /battle/ranking-sekolah, fa-school | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-066 | link | hidden-only | "Leaderboard", → /battle/leaderboard, fa-trophy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-067 | link | hidden-only | "Tetapan Permainan", → /admin/permainan, fa-dice | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-068 | toggle | visible-default | "Marketplace", fa-shopping-bag | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-069 | link | hidden-only | "Produk", → /admin/marketplace/products, fa-shopping-bag | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-070 | link | hidden-only | "Penjual", → /admin/marketplace/sellers, fa-store | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-071 | toggle | visible-default | "Kandungan", fa-newspaper | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-072 | link | hidden-only | "Banner", → /admin/banners, fa-image | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-073 | link | hidden-only | "Artikel", → /admin/articles, fa-newspaper | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-074 | link | hidden-only | "Nota", → /admin/notes, fa-sticky-note | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-075 | link | hidden-only | "Push Notifikasi", → /admin/notifications, fa-bell | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-076 | link | hidden-only | "Upload Screenshot", → /admin/tools/screenshots, fa-cloud-upload-alt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-077 | toggle | visible-default | "Kewangan", fa-credit-card | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-078 | link | hidden-only | "Pembayaran", → /admin/payments, fa-credit-card | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-079 | link | hidden-only | "Billing Dashboard", → /admin/billing, fa-chart-line | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-080 | link | hidden-only | "Dunning Log", → /admin/dunning, fa-bell-slash | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-081 | toggle | visible-default | "Sistem", fa-cog | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-082 | link | hidden-only | "Performance", → /admin/performance, fa-gauge-high | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-083 | link | hidden-only | "Tetapan", → /admin/settings, fa-cog | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-084 | link | hidden-only | "Log Audit", → /admin/audit-logs, fa-clipboard-list | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-085 | link | hidden-only | "Chatbot", → /admin/chatbot, fa-robot | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-086 | text | visible-default | "🏆 Bilik Duta" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-087 | badge | visible-default | "DEV" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-088 | link | visible-default | "Bilik Duta", → /bilik-duta, fa-crown | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-089 | link | visible-default | "Akademi Duta", → /akademi-duta, fa-graduation-cap | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-090 | link | visible-default | "Permohonan Duta", → /admin/duta-applications, fa-clipboard-check | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-091 | link | visible-default | "Duta Dashboard", → /duta-dashboard, fa-user-tie | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-092 | link | visible-default | "Jemput Duta", → /jemput-duta, fa-school | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-093 | link | visible-default | "Kem & Bootcamp", → /bilik-duta/kem, fa-campground | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-094 | text | visible-default | "🤖 Pusat AI" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-095 | link | visible-default | "Kamus AI", → /pusat-ai/kamus, fa-book-open | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-096 | link | visible-default | "Aktiviti Advisor", → /pusat-ai/aktiviti, fa-lightbulb | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-097 | link | visible-default | "Pendamping Motivasi", → /pusat-ai/pendamping, fa-heart | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-098 | link | visible-default | "SPM Walkthrough", → /pusat-ai/spm, fa-pen-to-square | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-099 | link | visible-default | "Whiteboard → Quiz", → /pusat-ai/whiteboard, fa-clipboard-question | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-100 | link | visible-default | "Parent Whisperer", → /pusat-ai/parent-whisperer, fa-comments | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-101 | link | visible-default | "Doa & Motivasi", → /pusat-ai/doa, fa-mosque | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-102 | text | visible-default | "✨ Visi & Pertandingan" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-103 | link | visible-default | "Profil Cerah", → /profil-cerah, fa-magic | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-104 | link | visible-default | "Sekolah Bersaing", → /sekolah-bersaing, fa-trophy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-105 | link | visible-default | "Cita-Cita Hijrah", → /cita-cita, fa-star | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-106 | link | visible-default | "Streak / Kombo", → /kombo, fa-fire | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-107 | text | visible-default | "💎 Killer Features" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-108 | link | visible-default | "Cikgu Suara", → /cikgu-suara, fa-microphone | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-109 | link | visible-default | "SPM Mock Exam", → /spm-mock, fa-file-pen | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-110 | link | visible-default | "Wellbeing Alerts", → /wellbeing/alerts, fa-triangle-exclamation | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-111 | link | visible-default | "Tetapan Peribadi", → /tetapan, fa-cog | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-112 | link | visible-default | "Ke Dashboard", → /dashboard, fa-arrow-left | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-113 | card | visible-default | "Admin PRESTASI+" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-114 | image | visible-default | image | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-115 | text | visible-default | "Admin PRESTASI+" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-116 | text | visible-default | "Admin" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-117 | link | visible-default | → /logout, fa-sign-out-alt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-120 | tooltip | hidden-only | "Uptime", fa-clock | Excluded — global shell server-status widget |
| EL-M11-SHA-121 | tooltip | visible-default | "Load: 0.89 / 8 cores", fa-microchip | Excluded — global shell server-status widget |
| EL-M11-SHA-122 | text | visible-default | "11%" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-123 | tooltip | visible-default | "16.7GB / 31.1GB", fa-memory | Excluded — global shell server-status widget |
| EL-M11-SHA-124 | text | visible-default | "54%" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-125 | tooltip | visible-default | "199.4GB / 398.7GB", fa-hard-drive | Excluded — global shell server-status widget |
| EL-M11-SHA-126 | text | visible-default | "50%" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-127 | tooltip | visible-default | "Uptime", fa-clock | Excluded — global shell server-status widget |
| EL-M11-SHA-128 | text | visible-default | "204d 7h" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-129 | image | visible-default | image | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-130 | link | visible-default | → /logout, fa-sign-out-alt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-131 | link | conditional | → /admin | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-132 | image | conditional | image | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-133 | text | visible-default | "© 2026 PRESTASIPLUS. Hakcipta Terpelihara." | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-134 | text | visible-default | "Didikan penuh dari Malaysia 🇲🇾" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-135 | text | visible-default | "❤️" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-136 | link | conditional | "Dashboard", → /admin, fa-tachometer-alt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-137 | link | conditional | "Soalan", → /admin/questions, fa-question-circle | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-138 | link | conditional | "Penaja", → /admin/sponsors, fa-handshake | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-139 | link | conditional | "Pengguna", → /admin/users, fa-users | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-140 | dropdown-trigger | conditional | "Lagi", fa-ellipsis-h | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-141 | card | hidden-only | "SPM" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-142 | link | hidden-only | "Analitik", → /admin/analytics, fa-chart-pie | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-143 | link | hidden-only | "Laporan Aktiviti", → /admin/laporan, fa-chart-bar | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-145 | link | hidden-only | "Kirkpatrick", → /admin/kirkpatrick, fa-microscope | Excluded — shell link owned by M12 (Kirkpatrick) |
| EL-M11-SHA-146 | text | hidden-only | "SPM" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-147 | link | hidden-only | "Databank Soalan", → /spm/tahun-lepas, fa-database | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-148 | link | hidden-only | "Latih Tubi", → /spm/latih-tubi, fa-bolt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-149 | link | hidden-only | "Tracking A", → /spm/ramalan, fa-crosshairs | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-150 | link | hidden-only | "Subjektif", → /spm/subjektif, fa-pen-fancy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-151 | text | hidden-only | "Soalan" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-152 | link | hidden-only | "Import CSV", → /admin/questions/import, fa-file-csv | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-153 | link | hidden-only | "Kualiti Soalan", → /admin/questions/quality, fa-clipboard-check | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-154 | link | hidden-only | "Laporan Soalan", → /admin/question-reports, fa-flag | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-155 | link | hidden-only | "Soalan Berstruktur", → /admin/structured-questions, fa-list-ol | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-156 | link | hidden-only | "Kertas Soalan Guru", → /admin/question-submissions, fa-file-upload | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-157 | text | hidden-only | "Kurikulum" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-158 | link | hidden-only | "Kurikulum", → /admin/curriculum, fa-sitemap | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-159 | link | hidden-only | "Subjek", → /admin/subjects, fa-book | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-160 | link | hidden-only | "Tahap Pendidikan", → /admin/education-levels, fa-graduation-cap | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-161 | text | hidden-only | "Premium" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-162 | link | hidden-only | "PKSK Soalan", → /admin/pksk/questions, fa-shield-halved | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-163 | link | hidden-only | "PKSK Akses", → /admin/pksk/access, fa-key | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-164 | text | hidden-only | "Gamifikasi" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-165 | link | hidden-only | "Overview", → /admin/gamification, fa-gamepad | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-166 | link | hidden-only | "Tier Config", → /admin/gamification/tiers, fa-crown | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-167 | link | hidden-only | "Cabaran", → /admin/gamification/challenges, fa-bullseye | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-168 | link | hidden-only | "Kedai Hadiah", → /admin/hadiah, fa-gift | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-169 | link | hidden-only | "Gamifikasi Guru", → /admin/gamifikasi/guru, fa-chalkboard-teacher | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-170 | text | hidden-only | "Battle & Permainan" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-171 | link | hidden-only | "Battle Live", → /battle, fa-bolt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-172 | link | hidden-only | "Tetapan Permainan", → /admin/permainan, fa-dice | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-173 | text | hidden-only | "Kandungan" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-174 | link | hidden-only | "Banner", → /admin/banners, fa-image | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-175 | link | hidden-only | "Artikel", → /admin/articles, fa-newspaper | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-176 | link | hidden-only | "Nota", → /admin/notes, fa-sticky-note | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-177 | link | hidden-only | "Push Notifikasi", → /admin/notifications, fa-bell | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-178 | link | hidden-only | "Chatbot", → /admin/chatbot, fa-robot | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-179 | link | hidden-only | "Upload Screenshot", → /admin/tools/screenshots, fa-cloud-upload-alt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-180 | text | hidden-only | "Marketplace" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-181 | link | hidden-only | "Produk", → /admin/marketplace/products, fa-shopping-bag | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-182 | link | hidden-only | "Penjual", → /admin/marketplace/sellers, fa-store | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-183 | text | hidden-only | "Sistem" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-184 | link | hidden-only | "Sekolah", → /admin/schools, fa-school | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-185 | link | hidden-only | "Langganan Sekolah", → /admin/school-subscriptions, fa-file-contract | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-186 | link | hidden-only | "Tetapan", → /admin/settings, fa-cog | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-187 | link | hidden-only | "Pembayaran", → /admin/payments, fa-credit-card | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-188 | link | hidden-only | "Billing Dashboard", → /admin/billing, fa-chart-line | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-189 | link | hidden-only | "Dunning Log", → /admin/dunning, fa-bell-slash | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-190 | link | hidden-only | "Log Audit", → /admin/audit-logs, fa-clipboard-list | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-191 | link | hidden-only | "Performance", → /admin/performance, fa-gauge-high | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-192 | link | hidden-only | "Import Pelajar", → /admin/import-students, fa-user-plus | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-193 | link | hidden-only | "Import Pengguna", → /admin/users/bulk-import, fa-users-cog | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-194 | link | hidden-only | "Student View", → /dashboard, fa-arrow-left | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-195 | link | hidden-only | "Log Keluar", → /logout, fa-sign-out-alt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-196 | tooltip | conditional | "Load: 0.29 / 8 cores", fa-microchip | Excluded — global shell server-status widget |
| EL-M11-SHA-201 | text | conditional | "<school>", fa-arrow-left | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-202 | link | conditional | "Monitoring", → /admin/monitoring, fa-arrow-left | Excluded — shell link owned by M17 |
| EL-M11-SHA-203 | text | conditional | "/" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-204 | tooltip | conditional | "Load: 0.58 / 8 cores", fa-microchip | Excluded — global shell server-status widget |
| EL-M11-SHA-205 | tooltip | conditional | "Load: 0.56 / 8 cores", fa-microchip | Excluded — global shell server-status widget |
| EL-M11-SHA-206 | tooltip | conditional | "Load: 0.49 / 8 cores", fa-microchip | Excluded — global shell server-status widget |
| EL-M11-SHA-207 | tooltip | conditional | "17.3GB / 31.1GB", fa-memory | Excluded — global shell server-status widget |
| EL-M11-SHA-225 | text | conditional | "<person>" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-247 | text | conditional | "Jawapan Betul", fa-check-circle | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-248 | text | hidden-only | "Jawapan Pelajar", fa-times-circle | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-249 | text | conditional | "[AI-repaired 2026-04-22] Ciri negara berdaulat termasuk pentadbiran yang sistematik dan se…" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M11-SHA-251 | tooltip | conditional | "Load: 0.24 / 8 cores", fa-microchip | Excluded — global shell server-status widget |
| EL-M11-SHA-252 | tooltip | hidden-only | "Load: 0.2 / 8 cores", fa-microchip | Excluded — global shell server-status widget |
| EL-M11-SHA-254 | tooltip | conditional | "Load: 0.44 / 8 cores", fa-microchip | Excluded — global shell server-status widget |
| EL-M11-SHA-255 | tooltip | hidden-only | "Load: 0.37 / 8 cores", fa-microchip | Excluded — global shell server-status widget |

---

## 7. Fidelity deviations

These are the **only** intended differences from the live site. Anything not listed must match live (D7). Rule D9 (user, standing, pre-approved): where live is broken or contradictory, fix it minimally; where it works, replicate it exactly. D10: accessibility replicates live; a deliberate, consistent limit is not broken; adding options to a working feature is new scope. CLAUDE.md §6: minimal fixes that create no new visible contradiction. Rows "Rejected — replicate live" were candidates that turned out to work or could not be shown to be broken.

| ID | Discovery | Category | Live behaviour (evidence) | Rebuild behaviour (specified) and alternatives | Status |
|---|---|---|---|---|---|
| DV-M11-01 | D-M11-1 | Contradictory counts | S1 for the admin (no class): "Pernah Login" "54%" "**1708** / 3152 pelajar" "1444 belum pernah login", while its panel reads "Pelajar Belum Pernah Login (0)" / "Semua pelajar sudah pernah login!"; "Pernah Buat Latihan" "0 / 0 pelajar" (denominator 0 vs 3152 on the neighbouring card); the list "Belum Pernah Buat Latihan" shows 10 students while the latihan panel reads "(0)" / "Semua pelajar sudah aktif buat latihan!" (`laporan-card-login.png`, EL-M11-S1-012/013/016–021/056–069). Two populations are used on one page. | **One population for the whole page:** the students of the viewer's own classes (all own classes, or the selected class) — the population the class select, the latihan card, the panels and the activity figures already use. For the admin (no class) this changes only the login card ("0%", "0 / 0 pelajar", no red line) and the list (empty → "Semua pelajar sudah aktif buat latihan!", PROPOSED reuse of the observed latihan-panel copy); every other admin value stays as observed. Alternatives: (a) use the login card's population (3152 active students platform-wide, INFERRED) everywhere — rejected: it changes the latihan card, both panels, the activity and score cards, the trend chart and "Paling Aktif" from their observed zero state to large invented platform totals; (b) replicate — rejected (contradictory on one screen). | Approved (D9) |
| DV-M11-02 | D-M11-2 | Broken control | S4 "Gap Analysis" tab: its panel sits outside the Alpine `tab` scope and keeps `x-cloak`/`display:none`; clicking the tab hides every panel and shows nothing (`pelajar-gaps-blank.png`, EL-M11-S4-086–094 hidden-only in every state). | The Gap Analysis panel (already in the page, layout SOURCE-DERIVED) is the tab's panel: shown when the tab is active, hidden otherwise. Its values are recomputed (DV-M11-20). Alternatives: (a) remove the tab — rejected (removes a feature whose content exists); (b) replicate the blank tab — rejected (broken). | Approved (D9) |
| DV-M11-03 | D-M11-3 | Contradictory labels | Guide legend "Cemerlang >60% \| Sederhana 20-60% \| Rendah <20% \| Tiada 0%" omits Kritikal and gives Rendah "<20%", while the table legends read "Rendah (5-20%)" and "Kritikal (< 5%)" and the table uses a Kritikal band (EL-M11-S2-011–015 vs S2-091–096). | Guide line "**Cemerlang** >60% \| **Sederhana** 20-60% \| **Rendah** 5-20% \| **Kritikal** <5% \| **Tiada** 0%" — the table legend's values, Kritikal in #991b1b. Alternatives: (a) drop Kritikal from the table and filter — rejected (changes data, the filter and 2 observed rows); (b) replicate — rejected (contradiction on one screen). | Approved (D9) |
| DV-M11-04 | D-M11-4 | Candidate — link targets | "Tapis", "Refresh", "Reset", PDF/CSV and every drill-down link and breadcrumb inside `/guru/monitoring*` point to `/admin/monitoring*`. For the admin these targets work (same templates). What a teacher gets is not observable (Q-M11-1). | **Rejected — replicate live.** The targets work for the observed role; whether they fail for a teacher is UNVERIFIED, so no fix is justified. The teacher path is INFERRED (M17/M01 non-admin rule) and provisional; OQ-M11-02. | Rejected — replicate live (v1.1); **target part reversed in v1.12 by DV-M11-28** (links follow the mount prefix); the `_token` part stays rejected (DV-M11-05) |
| DV-M11-05 | D-M11-5 | Candidate — security | A hidden `_token` inside the GET filter form puts the CSRF token in the URL on "Tapis"/"Refresh". | **Rejected — replicate live** with a dummy token value (no visible change; the prototype has no real CSRF secret). Recorded as SEC-M11-01 for the backend phase. | Rejected — replicate live |
| DV-M11-06 | D-M11-6 | Unreachable content | S4 "Jawapan Salah (97 jawapan, 97 soalan unik)" renders only the first 10 cards (`x-data="{ wrongShow: 10 }"`) and has no control to show more (EL-M11-S4-062–085, 236–263). | **All n cards are listed**, as the heading promises; no new control or copy. Alternatives: (a) add "Papar lagi 10 ({shown}/{n})" modelled on "Papar lagi 20" — rejected (adds a control and new copy; not needed to make the content reachable); (b) change the heading to "(10 daripada 97)" — rejected (hides working data and invents copy); (c) replicate — rejected (content unreachable). | Approved (D9) |
| DV-M11-07 | D-M11-7 | Inconsistent labels | The Tingkatan column of S3 and S5 and the S4 header mix "T5" and "Tingkatan 5" for the same level, and S3 sorts by that raw string (all "T5" rows, then all "Tingkatan 5" rows) (`sekolah-desktop.png`, `guru-desktop.png`, EL-M11-S4-003 vs S4-209). | One format "T{n}" derived from the student's grade (the format used by the S2 labels "Pelajar T4/T5" and the M02 class levels); S3 order: Tingkatan ascending, then name A→Z. Alternatives: (a) "Tingkatan {n}" everywhere — rejected (wider column; the page labels already use "T4/T5"); (b) replicate — rejected (two labels for one value). | Approved (D9) |
| DV-M11-08 | D-M11-8 | Candidate — gap copy vs rule | Gap empty state "Semua topik yang dicuba mempunyai ketepatan melebihi 60%." The gap rule is not observable; observed gap groups are 0.0%, 33.3%, 38.9% (Kritikal/Lemah) and 50.0% (Perlu Perhatian); no observed group lies between 50% and 60%. | **Withdrawn — replicate live** (audit AUD-M11-10). The INFERRED rule "gap = group accuracy < 60%" (Kritikal < 30, Lemah 30–< 50, Perlu Perhatian 50–< 60) fits every observation and the live copy, so no contradiction is shown. v1.0 changed the copy to "50%" on an inferred ≤ 50 rule; removed with its PROPOSED COPY entry. | Withdrawn (v1.1) |
| DV-M11-09 | D-M11-9 | Candidate — two legends | S6 legend (% correct: > 70 Mudah, 40–70 Sederhana, < 40 Sukar; "Diskriminasi: >0.3 = baik, <0 = semak semula") differs from M08 S11 (difficulty index 1 − p, Sukar > 0.70; four discrimination bands). | **Rejected — replicate both.** They are two separate features on different pages; each states its own legend and applies it consistently, and no screen shows both. A consistent, deliberate difference is not a D9 contradiction (D10). | Rejected — replicate live |
| DV-M11-10 | D-M11-10 | Candidate — data scoping | `/guru/monitoring/sekolah/940/pelajar/{id of a student of school 8080}` → 200 with that student under the school-940 breadcrumb. No link on live produces such a URL. | **Rejected — replicate live** (the page works for every link-generated URL). Recorded as SEC-M11-02 (the backend must check that the student/teacher belongs to the school). | Rejected — replicate live |
| DV-M11-11 | D-M11-11 | Candidate — two engagement values | Same school 8080: S2 row "184 / 174 / 94.6%" and S5 "Pelajar Aktif 174", "% Aktif 94.6%" vs S3 "Pernah Aktif 165" and "Cemerlang — 89.7%". Flags exist at 6 schools (8080, 8078, 8082, 8090, 8106 with excluded accounts; 8087 and 10220 with "Perlu Semak" only) and the excluded accounts answered recently. | **Withdrawn — replicate live** (audit AUD-M11-01, Critical; Delivery Lead). S3 declares its own filtered rule in its note ("Angka penglibatan di atas ialah nilai tulen selepas tapis."), so S2/S5 and S3 are two declared definitions, not an undeclared contradiction (FN-M11-3.8.2). v1.0 recomputed the S2 KPIs (1,453 / 34.9% / 325) on false premises (flags at one school only, no recent answers) and created a new contradiction on S5 (165 + 10 ≠ 184 beside "174 pelajar telah mula menjawab soalan"); all of that is removed and the flags are seeded as observed (SRS DATA-M11-01, 6 schools). | Withdrawn (v1.1) |
| DV-M11-12 | D-M11-12 | Visual bug (active state) | On `/guru/monitoring*` no admin-sidebar item is active; on `/admin/monitoring` "Monitoring" is (`sekolah-desktop.png`, EL-M11-SHA-013). | "ANALITIK › Monitoring" (and its "Lagi" twin) is active on every monitoring route of both prefixes. | Approved (D9) |
| DV-M11-13 | D-M11-13 | Broken page | `/guru/perbandingan-kelas` (menu "Perbandingan Kelas") → HTTP 500 for the admin, also with `?classroom_id=4` (`perbandingan-kelas-500.png`). The page's content is not observable. | **Provisional page pending a teacher account** (M07/M08 precedent: no invented feature, no "belum tersedia" notice): user-portal shell, header "Perbandingan Kelas" (live menu label), tab "Perbandingan Kelas - Portal Guru" and the S6 empty-card pattern with PROPOSED COPY "Tiada data perbandingan kelas untuk paparan ini."; no comparison UI is asserted; every E2E step provisional. Alternatives: (a) replicate the 500 — rejected (broken page behind a menu item); (b) design a class comparison — rejected (content unknown, must not be invented); (c) hide the menu item — rejected (removes a live entry point; M08 AUD-03). Replaced by the discovered page when OQ-M11-01 is answered. | Approved (D9; temporary, OQ-M11-01) |
| DV-M11-14 | D-M11-14 | Candidate — language | S3 pill "Active — sehingga 12 May 2027" (English status and month) on a BM page. | **Rejected — replicate live.** The pill is readable and correct; mixed English copy is a consistent live style ("Tracking A", "Best", "Drill-Down", "Gap Analysis"), not a broken label. | Rejected — replicate live |
| DV-M11-15 | D-M11-15 | Candidate — empty state | An empty filter result shows "0 sekolah" and an empty table body with no message. | **Rejected — replicate live.** "0 sekolah" and the empty "Perhatian" card already tell the user nothing matched; a message would be new copy. | Rejected — replicate live |
| DV-M11-16 | D-M11-16 | Responsive breakage | `/guru/laporan` at 375: `scrollWidth` 450 > 375 — the untruncated e-mails of the "Belum Pernah Buat Latihan" rows widen both `grid md:grid-cols-2` cards to 440px (direct measurement on the unmasked page). | Grid items may shrink (`min-w-0`) and the e-mail line truncates like the name (single line, ellipsis); nothing else changes. | Approved (D9) |
| DV-M11-17 | D-M11-17 | Control unusable on touch | The S2 selects "Tempoh", "Negeri", "Tahap" have no padding and render 18px tall at every width. | The selects get the padding of the row's buttons: at least 36px tall (the "Tapis" button is 89×36). Options, labels and order unchanged. **(v1.12)** On S2–S5 the selects, buttons, the guide ✕ and the auto-refresh toggle are **44px tall below `lg` (1024px)** (touch rule, as DV-M11-27) and 36px from `lg`. | Approved (D9) |
| DV-M11-18 | D-M11-18 | Broken control | S3 row filter embeds the name unescaped in a JS string (`'{nama}'.includes(…)`); a name with an apostrophe throws "Alpine Expression Error: Unexpected identifier …" (school 8080, console), so that row ignores the pills and the search. | Names are passed as data, never as script text; every row filters and searches the same way. No visible change. (Also SEC-M11-05.) | Approved (D9) |
| DV-M11-19 | S8, Q-M11-2 | Blocked content | `/guru/laporan-mingguan-kelas` → 403 for the admin (also `?week=1`, `/4`) while the "Laporan Mingguan" menu item is present. | **Admin: replicate the 403** (observed; an access rule, not a crash). **Teacher:** content UNVERIFIED; 403 is not asserted; a provisional stand-in (header "Laporan Mingguan", PROPOSED COPY "Tiada data laporan mingguan untuk paparan ini.") until OQ-M11-01; E2E provisional. Alternatives: hide the item — rejected (M08 AUD-03); build a weekly class report — rejected (unknown). | Admin replicated; teacher provisional (OQ-M11-01) |
| DV-M11-20 | D-M11-2 (consequence), AUD-M11-12 | Content of a panel made visible | The hidden live Gap panel holds values that do not follow one rule over the visible data: Student C's hidden gaps are 4 Matematik groups (0/1, 0/2, 0/1, 1/3) and 2 Sejarah groups while the visible Pemerhatian says "Kekuatan dalam Matematik (100.0% ketepatan)"; "Subjek Belum Dicuba" lists subjects the student **has** answered (Student A: all 20 subjects, including Bahasa Melayu, Bahasa Inggeris and Sejarah). | With DV-M11-02 the panel becomes visible, so its values are **recomputed** from the student's answers by the INFERRED rules of SRS BR-M11-19 (gap < 60%, Topik Kuat ≥ 80%, untried = subjects of the student's level without any answer); the visible figures (cards, tabs, Pemerhatian, the gap count chip) stay as observed. Alternatives: (a) show the hidden live DOM values as stored text — rejected: it would show a visible contradiction (Matematik both strong and a gap; answered subjects listed as untried); (b) keep the panel hidden — rejected (broken tab, DV-M11-02). The recomputed values are provisional (E2E-M11-40). | Approved (D9) |
| DV-M11-21 | D-M11-19 (AUD-M11-05) | Contradictory label | S3 pill "● Aktif (165)" filters every row with ≥ 1 answer, including the 9 "ditapis" rows, so clicking it shows 174 rows under a label that says 165 (8080; row `x-show` `(studentFilter === 'active' && true)` for a ditapis row; audit `s3-aktif-pill-includes-ditapis.png`). "Belum login" shows every student without a login, including 2 "Aktif" rows — this label has no count and matches its rows. | **The "Aktif" pill shows the students its count describes:** ≥ 1 answer and not "ditapis" (8080: 165 rows). The 9 "ditapis" rows stay in the list under "Semua" with their badge; the label, the card "Pernah Aktif 165" and the rows now agree. "Belum login" and "Login sahaja" as live. Alternatives: (a) change the label count to 174 — rejected: it would contradict the card "Pernah Aktif 165" and the note "Angka penglibatan di atas ialah nilai tulen selepas tapis." on the same page; (b) replicate — rejected (a count label that does not match the rows it filters is contradictory, D9). | Approved (D9) |
| DV-M11-22 | AUD-M11-11, top-up notes | Candidate — S2↔S3 differences (decided per item) | (1) School 8765: S2 "16 / 6 / 37.5%" (Sederhana) vs S3 "Pernah Aktif 1", "Rendah — 6.3%", status Aktif 1 / Belum login 15, no flags. (2) Teacher logins S2 vs S3 cards: 8078 53 vs 52, 8106 18 vs 16, 8087 12 vs 13, 8102 42 vs 43, 8277 16 vs 17. (3) Weekly row sums vs S3 "Soalan Dijawab": 8090 120,782 vs 119,806, 8106 59,211 vs 59,201, 8765 210 vs 209. | **Rejected — replicate live, per item:** (1) each screen is internally consistent (S2 row and its lists; S3 cards, pill and table) and the values sit on different pages; making them equal would change either many observed S2 figures (tahap counts, order, Perhatian, KPIs) or 5 S3 student statuses with no evidence of which side is right — no minimal fix exists without creating new differences, so live is followed; (2) same reasoning (S2 teacher table and its Nota vs the S3 card and teacher list); (3) not visible on any screen (it needs summing the weekly cells). All are stored as observed per-screen values (FN-M11-3.8.5, SRS BR-M11-32). | Rejected — replicate live (v1.1); **superseded in v1.11 by DV-M11-24 / 25 / 26** |
| DV-M11-23 | XL2-28 (NFR-02; discovery §2/§8, audit) | Unreadable text | Live content text below 12px on the monitoring and report screens: **S1** list e-mails and the "Belum pernah login" label 10px, chart tick labels 10px; **S2** KPI labels 10px below `sm`, bar % labels 9px (inside) / 10px (outside), school code/state lines 10px, weekly school codes 9px, weekly Best counts 10px, chart-free; **S3** e-mail lines 10px, flag badges "⚠ Perlu Semak" / "⚠ Perlu Semak · ditapis" 9px; **S4/S5** e-mail lines under names 10px. | **Text only, inside `main`, on S1–S5:** content text below 12px is raised to 12px (S1 chart tick font 10 → 12); icons, layout, colours, truncation and every other screen are unchanged (M03 DV-06b, M05 DV-11, M08 DV-18, M10 DV-28 precedent; NFR-02). The same rule holds when M17 mounts S2–S5. Elements not listed stay as live. | Approved (D9) |
| DV-M11-24 | DV-M11-22 item (1), v1.11 | Contradictory counts (S2 vs S3, one school) | School 8765: S2 row "16 / 6 / 37.5%" (Sederhana) but S3 cards "Pernah Aktif 1", "Soalan Dijawab 209" and pill "Rendah — 6.3%" (observed on both pages). | S3 cards are computed from the same screen's rows and equal the S2 row: **Pernah Aktif 6, Soalan Dijawab 222 (incl. the 12 answers before M1, SRS §6.7), pill "Sederhana — 37.5%"**; 16 students unchanged. Alternatives rejected: (a) seed flags so S3 excludes 5 accounts — rejected: invents flags that live does not show (no warning box on live S3) and the "ditapis" rule; (b) cut the dataset to 1 active student — rejected: would change the observed S2 values (Aktif 6, 37.5%, the tahap counts, the Terbaik / Perhatian lists, KPIs); (c) change M01 logins — rejected: unrelated to answers. The S3 status split (Login sahaja / Belum login) of the 10 students without answers is an open owner item (SRS §13). INFERRED which side is right: S2 (every S2 value observed and many others depend on it). | Approved (D9, v1.11) |
| DV-M11-25 | DV-M11-22 item (3), v1.11 | Contradictory counts (S2 vs S3, answers) | S3 "Soalan Dijawab": 8090 **119,806** vs S2 weekly sum 120,782; 8106 **59,201** vs 59,211 (no screen shows both, but S2's KPI and weekly table and S3 are the same school's answers). | S3 shows the S2 value: **8090 120,782; 8106 59,211**. Alternatives rejected: cutting the dataset (answers) to the S3 value — would break observed weekly cells / the S2 KPI 472,371; seeding flags to hide answers — invents flags. | Approved (D9, v1.11) |
| DV-M11-26 | DV-M11-22 item (2), v1.11 | Contradictory counts (S2 vs S3, teacher logins) | "Guru Pernah Login" S3 card vs the S2 teacher table: 8106 16 vs **18**; 8078 52 vs **53**; 8087 13 vs **12**; 8102 43 vs **42**; 8277 17 vs **16** (S2 values also feed the Nota "(Nota: 16 guru telah login)" of 8277 and the % Penglibatan Guru). | S3 shows the S2 value (= the number of teacher rows with a login on S3): **8106 18; 8078 53; 8087 12; 8102 42; 8277 16**. Alternatives rejected: changing M01 `lastLoginAt` seeds to the S3 value — would break the S2 teacher table, KPI "Guru Pernah Login" 277 and the Nota; seeding teacher flags — teachers have none. | Approved (D9, v1.11) |
| DV-M11-27 | v1.12 (Session 6 second pass) | Control unusable on touch | S1: range pills 28 px tall, the class select 43 px; S6: both selects 43 px, "Reset" 20 px tall (live measured sizes, every width). | Below `lg` (1024 px) the S1 / S6 pills, selects and Reset are **44 px tall** (touch rule; precedent DV-M03-11); from `lg` they keep the live sizes (pill 28 px, S1 select 43 px, S6 select 43 px, Reset 20 px). Labels, options and order unchanged. Alternatives: 44 px at every width — rejected: changes the desktop look that works; replicate — rejected (controls unusable on touch). | Approved (D9) |
| DV-M11-28 | DV-M11-04 (reversed in part), v1.12 | Dead link (D9) | Filter action, "Reset", "Refresh", PDF / CSV, school / student / teacher links and breadcrumbs of `/guru/monitoring*` point to `/admin/monitoring*`; a teacher cannot open `/admin` and is redirected away. | All these targets use the **mount prefix** of the current route (`/guru`, `/admin`, `/admin-sekolah`). Admin behaviour unchanged. Alternatives: replicate (v1.1 "unverified, not provably broken") — rejected now: the teacher redirect is the rebuild's own rule (M10 §7 **T**, M17), so the link is dead by construction. | Approved (D9) |
| DV-M11-29 | v1.12 | Behaviour (INFERRED) | S2 auto-refresh reloads the whole page at 0:00. | The 300 s timer re-requests the S2 data and resets the counter to 5:00; no full page reload; pause / resume and the counter text as live. | Approved (D9; INFERRED) |
| DV-M11-30 | v1.12 | Provisional export / layout | PDF / CSV targets not opened on live (Q-M11-7); the S3–S5 breadcrumb is part of the admin shell header. | CSV generated **client-side** from #7 as `monitoring-penglibatan.csv`; PDF = `window.print()` (provisional); the breadcrumb is rendered **inside the page** so the Admin Sekolah user shell looks the same as the admin shell; on the Admin Sekolah alias no link to Kirkpatrick S8 is rendered (`school_admin` is 403 there, INFERRED). | Approved (D9; provisional) |
| DV-M11-31 | - | Language (BM copy) | Monitoring (school/teacher/student detail) and Laporan: Subscription status "Active" / "Cancelled" / "Expired", "Refresh", "Reset", "Best", "Gap Analysis", "Tracking Mingguan", "Tip:", "Export PDF/CSV", subscription date "12 May 2027" | "Aktif" / "Dibatalkan" / "Tamat Tempoh", "Muat Semula", "Set Semula", "Terbaik", "Analisis Jurang", "Penjejakan Mingguan", "Petua:", "Eksport PDF/CSV", "12 Mei 2027". | Approved: user decision 2026-10-24 (system audit FB-025) |

**Discovery notes corrected by evidence (not deviations; reported to the discovery owner):** (1) the weekly-cell colour rule, from the page script: blue = M1 with answers **or** a week equal to the previous non-zero week; a week after a zero week is green (audit `weekly-equal-week-blue.png`; v1.0 wrongly said "blue only in M1"); (2) "Cadangan Tindakan" — Rendah schools get no tile; only Kritikal schools get "Penglibatan sangat rendah…" (derived from the four captured lists, FN-M11-3.7.3); (3) S5 row order is by name, not grouped by the raw Tingkatan string (`guru-desktop.png`).

---

## 8. Out of scope

| Item | Owner / reason |
|---|---|
| `/prestasi/kelas`, `/prestasi/kelas/{id}`, `/analitik/kelas`, `/analisa-item/*` | M08 (referenced) |
| `/admin/monitoring*` route guard, sidebar and menu placement | M17 (mounts this module's monitoring component) |
| `/admin/kirkpatrick/pelajar/{id}` (S3 inactive-student link target) | M12 |
| `/amaran` (same menu group) | M18 |
| Classrooms, enrolment, the teacher's own-class list and the `/guru/*` guard | M10 v1.6 (#12 `/api/guru/classes`; §7 **T** endpoints) |
| Users, schools, subscriptions (incl. the monitoring rows of the users dataset and `lastLoginAt`) | M01 v1.9 / M02 v1.11 (owners; contracts listed in SRS §6.10) |
| Practice sessions and the answer log (the only activity source) | M05 (owner) |
| Battle and Permainan activity counts | M16 (0 until M16 defines them) |
| Content of `/guru/perbandingan-kelas` and the teacher view of `/guru/laporan-mingguan-kelas` | Blocked — OQ-M11-01 (provisional pages only) |
| Real PDF/CSV export layouts | Not observable (Q-M11-7); prototype export PROPOSED |
| Real anomaly detection (answer-speed / automation rules) | Server-side, unobservable (Q-M11-4); flags are seeded |
| Real server-side authorisation, CSRF, auditing | Backend phase (SRS §11.1) |
| Global shells, notification bell, server-status widget, chatbot, tournament banner | Global shell / M23, M22, M16 |

---

## 9. Open questions

1. **OQ-M11-01 Teacher account (blocking G5 for the provisional parts).** A live teacher session is needed to observe: `/guru/perbandingan-kelas` (500 for the admin), `/guru/laporan-mingguan-kelas` (403 for the admin), a populated `/guru/analisis-item`, the populated S1 cards/panels/"Paling Aktif" and the teacher's menu. Until then FN-M11-2.4.1 (populated), 5.1.5, 6.1.1/6.1.2, 6.2.2 and the teacher ACs are provisional (discovery Q-M11-2, Q-M11-3).
2. **OQ-M11-02 Teacher on monitoring (inferred).** What a teacher sees on `/guru/monitoring*` (admin layout? own school only?) and whether the `/admin/monitoring*` targets of its links work for a teacher (Q-M11-1). The prototype renders the same component and data for a teacher on `/guru/monitoring*` and applies the non-admin rule of M17/M01 to `/admin/*` — provisional.
3. **OQ-M11-03 Export files (inferred).** PDF/CSV content and layout (Q-M11-7). The prototype's CSV/PDF are PROPOSED (SRS FR-M11-31).
4. **OQ-M11-04 Anomaly thresholds (inferred).** The rule behind "Perlu Semak" / "ditapis" (Q-M11-4); flags are seeded data (DATA-M11-01).
5. **OQ-M11-05 Rules inferred from outcomes.** "Jumlah Sekolah" = schools with ≥ 1 registered user; "Pelajar T4/T5" = students of grade 10/11 with a school; table ties by school id; trend = last two weeks; Best ties → earliest week; gap rule and Pemerhatian thresholds (Q-M11-6); activity-type mapping of M05 modes; Skor Purata = correct ÷ answered; Pernah Login percentage rounded to an integer.
6. **OQ-M11-06 PROPOSED items to report at G1:** the empty-list copy of DV-M11-01 (reused observed copy), DV-M11-08 value "50%", the provisional pages and their copy (DV-M11-13, DV-M11-19), the populated "Paling Aktif" row label "{n} aktiviti", the S6 populated table layout, the export files.
7. **OQ-M11-07 Cross-module contracts — closed (v1.7).** Delivered by the owners and listed in SRS §6.10 (XR-M11-01…08): M01 v1.9 `lastLoginAt`; M02 v1.11 monitoring allocation (§6.15 C) and subscriptions; M04 v1.9 anchors 700401–700931 with `chapterLabel` / `curriculumTopicId`; M05 v1.8 named queries (§6.14.2); M10 v1.6 own classes and guard; M17 mounts pending its own module.
8. **OQ-M11-08 Pelajar population of S1 for "Semua Kelas" (Q-M11-5).** Resolved by DV-M11-01 for the rebuild (own classes); the live server's 3152 population stays unexplained.
9. **OQ-M11-09 Fixture school 900001 vs the observed monitoring register — closed (v1.2).** Delivery Lead decision, option (a): platform monitoring rollups exclude only the reserved fixture schools 900001–900099 (M02 SRS §6.15) — runtime schools (ids ≥ 10,301) and every live-range school are counted; every observed S2 figure stays exact; fixture accounts appear only in their own views (SRS BR-M11-34). M17 adopts the same rule.
10. **OQ-M11-10 Three answer totals on live** (S2 KPI 472,371; Σ weekly 472,359; Σ S3 471,372) — **v1.11:** the S3 part is resolved by D9 (DV-M11-24/25: Σ S3 = 472,371); the 12-answer gap between the KPI and the weekly cells stays as observed; cause on live unobservable.
11. **OQ-M11-11 Another school's ids for the Admin Sekolah alias (v1.11).** **DECIDED / CLOSED (Delivery Lead, 2026-10-02).** One rule for M11 and M17 (BR-M17-34, OQ-M17-13): a `school_admin` asking for another school's id, or an unknown id, gets **404** (existence not revealed); role refusals (S1, S6 for this role) stay **403**. (The first v1.11 text specified 403 for out-of-school ids; superseded.)
12. **OQ-M11-12 Open owner gaps (v1.11; not fact changes).** M02: Selangor 28 monitoring schools vs 25 built; school 8300 code. M05: 8080 statuses 174·4·6 vs 174·3·7, 8080 accuracy bands 3/57/114, 30-day active 89 vs 92 and 8080 18 vs 21. M03: four Student A "Tajuk" names that are chapter titles in M03. M02/M05: split of 8765's 10 students without answers (DV-M11-24). See SRS §13 item 6.
