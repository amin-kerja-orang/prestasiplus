# M12 — Kirkpatrick Evaluation — User Requirements Specification

## 0. Document control

| Field | Value |
|---|---|
| Document | URS — M12 Kirkpatrick Evaluation |
| Version | 1.7 |
| Date | 2026-10-03 |
| Status | Approved (G1) — approved 2026-09-26 (audit PASS round 3); v1.5 2026-09-27 aligned to XL batch 3 (no observed value changes) |
| Author | product-analyst (agent); data model and mock API of the companion SRS by solution-architect (agent) |
| Source discovery | [M12-kirkpatrick.md](../../discovery/M12-kirkpatrick.md) (§1–§11, defects D-M12-1…19 in §8.2, §8.3 audit-lesson checklist, Q-M12-1…9, Appendices A–B); inventory [`inventory/M12/`](../../discovery/inventory/M12/) (`S1…S10-*.json`, `SHA-admin-shell.json`, `SHU-user-shell.json`, `_crawl.json`, `_summary.md`; raw states `inventory/_raw/M12/`, 48 states); **top-up** `inventory/M12/_topup-2026-09-26.json` (TU-M12-01…08, masked; adoption rules §9.2); masked screenshots `docs/discovery/img/M12/` (29) |
| Companion SRS | [srs/M12-kirkpatrick.md](../srs/M12-kirkpatrick.md) |
| Related | M01 (User, `lastLoginAt`, guest redirect, 403/404 pages, canonical accounts 1–11), M02 (users dataset 5,159 / T4-T5 monitoring rows 4,158, schools register, fixture schools 900001–900099), M03 (subject names), M05 (PracticeSession DATA-M05-01 and QuizAnswer DATA-M05-02 — the practice source of T2/T3/T4), M08 (HeadcountEntry DATA-M08-03, SchoolSpmHistory DATA-M08-09, grade points BR-M08-01), M10 (teacher dashboard "🔬 Kirkpatrick" panel and "💚 Mood Pelajar"), M11 (monitoring component — owner of `/…/monitoring/sekolah/{id}` whose rows link to S8; snapshot `inventory/M11/_snapshot-2026-09-25.json`), M16 (tournament banner), M17 (`/admin/monitoring*` mount, `/admin/laporan`), M23/global shell ([design/shells.md](../../design/shells.md) DV-SH-03, [design/design-system.md](../../design/design-system.md) icon map) |

**Change log**

| Version | Date | Change |
|---|---|---|
| 1.7 | 2026-10-03 | **Revision history — v1.7, Session 6 second pass (Standard track; see SRS v1.8; G1 approval kept).** **DV-M12-04 reversed** (links, form actions, Reset, "← Kembali", export and POST follow the mount prefix; D9 dead link for a teacher); FN-M12-1.2.2 updated. **DV-M12-07** amended (selects and the S7 header button 44 px below `lg`, 36 px from `lg`). **FN-M12-4.3.1:** subject order = exact accuracy descending, then subject name A–Z. FN-M12-2.1.2: the alias includes the viewer's own fixture school and its S1 cards are non-links. New **DV-M12-30** (`fa-project-diagram` → Lucide `Workflow`) and **DV-M12-31** (S6 "Kesimpulan Model Kirkpatrick" heading dark on the gradient → white). No observed value changed. |
| 1.6 | 2026-10-02 | **Revision history — v1.6, Session 6 build decisions (Standard track; see SRS v1.7).** (1) **Admin Sekolah alias (INFERRED):** `/admin-sekolah/kirkpatrick` is an alias of S1 only, scoped to the viewer's school; new US-M12-35, FN-M12-2.1.2, AC-M12-35.1–35.2; §2 actor row; teacher twins keep the admin data (provisional). (2) **Ids 5571 / 5551:** DV-M12-25, FN-M12-9.1.2, AC-M12-30.5 — "not user ids" replaced by "exist as generated users; S8 refuses them with the 403 explicitly (permanent; M02 owner agreed)". (3) **D9 DV-M12-29** (school 8880: GPS 2.88 and 150 candidates from M08, no Taburan Gred card, Kadar Lulus / Pelajar Gred A "-"); FN-M12-6.1.3, AC-M12-19.4. (4) FN-M12-6.4.1 note: 2022–2025 subject trend from M08 `subjectTrend()`. (5) AC-M12-05.1: the 10 states stand (M02 moved school 1267 to Kedah). No observed value changed; no id renumbered. Status stays Approved (G1). |
| 1.5 | 2026-09-27 | **Revision history — v1.5.** XL3 round 2 (R2-12): mood check-in owner **decided: M26, provisional** (provisional contract recorded in M17 v1.4); XR-M12-08 and OQ-M12-06 updated. No other change. |
| 1.4 | 2026-09-27 | **Revision history — v1.4, XL batch 3 alignment (`docs/qa/audit/cross-module-logic-M12-M18.md`; owners M05 v1.11, M08 v1.8, M02 v1.15, M11 v1.9, M17 v1.4). XL3-04: the practice segment is the separate M05 store **KirkpatrickSessionAggregate (DATA-M05-12, M05 §6.14.4)**, outside Q-SESS-ALL and never joined to the answer log; every session query cites it. XL3-34: M08 does not host Q-M12-HC-RECORDS, so **DC-M12-02 (4378) is active** for "Rekod Headcount" (FN-2.2.1, 6.1.1; BR-16). XL3-33: the M12 intervention entity and repository are renamed **KirkpatrickIntervention** / `kirkpatrickInterventions` (M18 keeps its own). XL3-07: the 2026 subject rows are M08 SchoolSpmHistory rows stored at school 8880; M12 shows them as the platform subject table in every scope (DV-M12-26). XR statuses: XR-01, 02, 04, 06, 09, 10 applied; XR-05 applied except the record count (DC-02); XR-08 open (mood owner, recommended M26, XL3-23). No observed value changes. |
| 1.3 | 2026-09-26 | **Revision history — v1.3, audit round 3 PASS → Approved (G1).** R3-01: the no-history state is worded as observed — 8080 has a history row, 9167 was observed without one, other schools are not verified (M17 discovery reports SPM data for 8880; added to TU-M12-09). R3-02: §6.0 summary, functions-referenced count and the result line include the 10 §6.3 audit-observed elements. XR-M12-02, 05, 09, 10 remain open for the XL batch 3 gate. |
| 1.2 | 2026-09-26 | **Revision history — v1.2, audit round 2** (FAIL 0 Critical / 2 Major / 2 Minor). R2-01: the S8 alias is withdrawn — on live `/admin/kirkpatrick/pelajar/5571` and `/5551` return 403, which FR-M12-17 already gives once 4664/4644 are the only ids; only the S5 link change stays (DV-M12-25, FN-9.1.2, AC-30.5). R2-02: the "school without SPM history" state (every school filter except 8080) specified with the exact live copy (new FN-M12-2.2.5 and 6.1.2, AC-06.4 and 19.3, 10 audit-observed elements in §6.3); the dangling caption "41 rekod ·" becomes "41 rekod" (new DV-M12-28). R2-03: the platform heat grid is reference data except the two cells seen on both days (6253, 944); AC-17.1 narrowed. R2-04: XR-M12-10 asks M11 to confirm its student page for a zero-answer student. Build note: "Rekod Headcount" falls back to a display constant if M08 cannot reproduce 4,378. New TU-M12-09 (inventory of the no-history state). |
| 1.1 | 2026-09-26 | **Revision history — v1.1, audit round 1** (FAIL 0 Critical / 5 Major / 7 Minor) with the Delivery Lead decisions. AUD-M12-05: baseline = the 2026-09-25 snapshot and the M05 mock clock; top-up rows adopted only where provably unchanged; every drifted figure and the choice recorded (§9.2). AUD-M12-01: S4 alerts are three lists in fixed order (never-login red, "guru" red, active green), a school may appear twice, green needs **> 50 %**, the "2 guru" item is school 10220 (FN-5.6.1, AC-18.1, new AC-18.4). AUD-M12-02: the live S4/S5 table columns (Aktif Σ 951 = ≥ 1 served question; Soalan Σ 307,049 = served questions) are modelled as their own queries; DV-M12-08 re-decided with the whole footprint — one "answered" definition on KPIs, tables, bands and green alerts (FN-5.2.1, 5.4.1, 6.5.1, new AC-14.4). AUD-M12-03: ALESA is scoped by `school_id`: per-scope stored lists, tiles computed from the rows, id order within a grade (FN-6.7.2–6.7.4, AC-23.4). AUD-M12-04: S8 anchors are the 8080 prediction rows 19 and 50; one id per person (4664, 4644 — the ids M11 links), the second live ids 5571/5551 kept as S8-route aliases (new DV-M12-25, AC-30.5). Minors: AUD-06 growth with 1 decimal; AUD-07 S8 bar colours observed; AUD-08 prediction tie order not observable; AUD-09 `school_id` subject/trend tables are the platform rows — shown with the platform headings (new DV-M12-26); AUD-10 heat grid observed (Σ 218,070), zero style checked on 8080; AUD-11 M17 reads T1 (XR-M12-09); AUD-12 "Rekod Headcount" is a live M08 count. OQ-M12-04 closed. |
| 1.0 | 2026-09-26 | First issue under D7 (fidelity), D8 (proven completeness), D9/D10 (deviation rule, accessibility and scope), D11 (virtual datasets, every count a named query) and D12 (one owner per store). §6 coverage matrix generated by script from the inventory JSON: 755/755 content elements covered (6 excluded with a concrete reason), plus 591 shell elements (35 M12-relevant), 0 unmapped. 19 discovery defects decided (14 approved fixes, 5 replicated) plus 5 candidates found while writing (all replicated). 11 epics, 44 features, 93 functions, 34 stories, 115 ACs. M12 owns two new stores: monthly feedback responses and interventions. `/admin/laporan` is excluded (owner M17). |

**Conventions** (same as M01–M11)
- Quoted UI copy is the exact live text. English words that live shows ("Overview", "Kirkpatrick Evaluation Flow", "Learning Gain", "Mastered", "Developing", "Beginning", "Champion", "Consistent", "Minimal", "Disengaged", "Predictive Grade", "Streak", "High / Medium / Low", "Reset") are live copy and are kept.
- **OBSERVED** = seen on the live site (walk-through, inventory state, screenshot, page markup). **SOURCE-DERIVED** = taken from page markup captured read-only, but the state itself was never rendered on live (e.g. the S7 intervention form, revealed only by a DOM change). **INFERRED** = the most likely live behaviour, not observed; no new UX is invented. **UNVERIFIED** = live behaviour exists but could not be observed. **PROPOSED** / **PROPOSED COPY** = a value, layout or text written for the rebuild because live never showed it; listed in §9 for the Delivery Lead to report at G1. **Provisional** = an AC or E2E step that rests on INFERRED/PROPOSED behaviour; it is marked "(provisional)" and is re-checked when the open question is answered.
- **D-M12-n** = live defect of discovery §8.2. **Q-M12-n** = discovery open question. **DV-M12-nn** = fidelity deviation (§7); anything not listed there must match live. **SEC-M12-nn** = risk in live behaviour, replicated with dummy data (SRS §11.1). **OQ-M12-nn** = open question of this URS (§9). **TU-M12-nn** = discovery top-up request (§9.1): a value that is observable on live but was not captured.
- **Personal data (students are minors).** Discovery masked every person name, school name and school code (`<person>`, `<school>`, `<kod>`, `{id}`). No real name appears here or in the seeds. School ids (e.g. 8080) are public record ids visible in link URLs (M11 precedent). Student record ids 4664 and 4644 (the two observed S8 pages) are record ids only. Seeds use fictitious names ("Pelajar Demo 004664").
- **Baseline (Delivery Lead decision, AUD-M12-05).** Every asserted figure is the live state of **2026-09-25** (discovery snapshot) with the M05 mock clock `2026-09-25T15:40:00+08:00`. The audit top-up of 2026-09-26 13:00 is adopted only where a value is provably unchanged between the two captures (school 8080, rows with zero activity, cumulative counts whose platform total did not move, structure, order, colours, rules); every figure that moved is listed with the choice made in §9.2.
- **Admin mirror vs designed data** (SRS §6): every value the admin saw on live is reproduced exactly by a **named query** on the owners' datasets (D11/D12) or, where no definition reproduces it, by a documented display constant (`DISPLAY_CONSTANT`, one DV each). Values that live shows but that were not captured are listed as top-up requests (TU-M12-nn) and are generated deterministically with `observed:false` until then; E2E never asserts them. Mock clock `2026-09-25T15:40:00+08:00` (M05).
- **Format rules seen on live** (kept per element): some counts have a thousands separator ("306,133", "4,158", "20,991" on S6) and some do not ("20991", "4378", "3207", "4158" in "951/4158"); percentages are rounded to 1 decimal and printed without a trailing ".0" ("87%", "10%", "33.3%"), except the S3 subject bars and the S8 platform rows, which always show 1 decimal ("100.0%", "60.0%").

---

## 1. Overview

M12 is the **Kirkpatrick evaluation** of the platform: four levels — T1 Reaksi (user satisfaction), T2 Pembelajaran (learning: accuracy, subjects, schools), T3 Tingkah Laku (behaviour: engagement bands, heat map, alerts), T4 Hasil (results: headcount GPS, grade distribution, predictions) — plus an impact chain, intervention records, a student detail page, a student self-view and the monthly feedback page that feeds T1. The TRACKER lists 8 views × 2 prefixes; the crawl found **10 screens** (`/admin/laporan` belongs to **M17**, Delivery Lead decision; it is excluded here).

**Routes covered**

| # | Route (twin) | Tab title (exact live) | Shell · header title / subtitle (live) | Admin outcome (observed) |
|---|---|---|---|---|
| S1 | `/admin/kirkpatrick` (`/guru/kirkpatrick`); `?school_id=&state=` | "Kirkpatrick Evaluation Dashboard" | SHA · "Kirkpatrick Evaluation" / "Analisis Keberkesanan Platform — Model Penilaian 4 Tahap" | 200 |
| S2 | `/admin/kirkpatrick/reaction` (`/guru/…`) | "Tahap 1: Reaksi — Kirkpatrick" | SHA · "Tahap 1: Reaksi" / "Kepuasan dan persepsi pengguna terhadap platform" | 200; `?school_id=` ignored |
| S3 | `/admin/kirkpatrick/learning` (`/guru/…`); `?school_id=` (URL only) | "Tahap 2: Pembelajaran — Kirkpatrick" | SHA · "Tahap 2: Pembelajaran" / "Peningkatan pengetahuan, kemahiran, dan kefahaman pelajar" | 200 |
| S4 | `/admin/kirkpatrick/behavior` (`/guru/…`); `?school_id=` | "Tahap 3: Tingkah Laku — Kirkpatrick" | SHA · "Tahap 3: Tingkah Laku" / "Konsistensi penggunaan, engagement score, dan corak tingkah laku pelajar" | 200 |
| S5 | `/admin/kirkpatrick/results` (`/guru/…`); `?school_id=` (URL only) | "Tahap 4: Hasil — Kirkpatrick" | SHA · "Tahap 4: Hasil" / "Impak terhadap keputusan peperiksaan dan prestasi akademik" | 200 (1.17 MB page, 946-row table) |
| S6 | `/admin/kirkpatrick/chain` (`/guru/…`) | "Kirkpatrick Impact Chain" | SHA · live "Dashboard" / "Selamat datang, Admin" → "Rantaian Impak" (DV-M12-03) | 200; `?school_id=` ignored |
| S7 | `/admin/kirkpatrick/interventions` (`/guru/…`) | "Intervensi — Kirkpatrick" | SHA · "Intervensi Pelajar" / "Rekod tindakan intervensi berdasarkan amaran Kirkpatrick" | 200; GET `/…/interventions/{id}` → 405 (DV-M12-11) |
| S8 | `/admin/kirkpatrick/pelajar/{id}` (`/guru/kirkpatrick/pelajar/{id}`) | "Kirkpatrick — {nama}" | SHA · live "Dashboard" / "Selamat datang, Admin" → "Kirkpatrick — {nama}" (DV-M12-03) | 200; unknown id → 403 |
| S9 | `/kirkpatrick` | "Kirkpatrick — Prestasi Saya" | SHU · live "Dashboard" / "Selamat datang kembali" → "Kirkpatrick — Prestasi Saya" (DV-M12-03) | 200 (admin sees its own empty data) |
| S10 | `/maklum-balas` | "Maklum Balas — PrestasiPlus" | SHU · live "Dashboard" → "Maklum Balas" (DV-M12-03) | 200: thank-you state only |

Other access outcomes (all OBSERVED): `/admin/kirkpatrick/pelajar` → 404; `/admin/kirkpatrick/interventions/create` → 405 (so `/interventions/{id}` exists for other verbs); `/admin/kirkpatrick/interventions/1/edit` → 404; 404 also for `/admin/kirkpatrick/survey`, `/reaction/survey`, `/api`, `/data`, `/export`, `/nps`, `/sekolah/{id}`, `/survey`, `/tinjauan`, `/nps`, `/admin/nps`, `/admin/survey`, `/admin/surveys`, `/feedback`.

**One component set, two prefixes (Delivery Lead decision).** The `<main>` markup of every view is byte-identical under `/admin/kirkpatrick*` and `/guru/kirkpatrick*`, and every link, filter form, "Reset", "← Kembali", the export link and the intervention POST on the `/guru` twins point to **`/admin/kirkpatrick…`**. The rebuild mounts one component set on both prefixes and replicates the `/admin` targets exactly (DV-M12-04 rejected). What a teacher sees is not observable (Q-M12-1): the teacher view is **INFERRED and provisional**.

**Cross-module ownership.** M12 reads, and does not redefine: users/schools (M01/M02), practice sessions (M05), headcount entries and the school SPM/GPS history (M08), subject names (M03). M12 **owns two new stores**: monthly feedback responses (T1) and interventions (S7). The owner of the daily mood check-in is decided: M26, provisional (OQ-M12-06). S8 is reached from the M11 monitoring school page (rows of students without answers); M11 owns that link. The teacher-dashboard "🔬 Kirkpatrick" summary panel belongs to M10. M17 (`/admin` dashboard) also shows T1 figures ("Jumlah Respon 336 · Purata Kepuasan 4.6/5 · NPS Score 8.3" and a "4.7/10" panel) and must read them from M12's T1 query (XR-M12-09).

---

## 2. Actors

| Role | Involvement in M12 | Verified |
|---|---|---|
| Admin | Every screen. S1–S8 in the admin-panel shell on both prefixes with platform-wide data (57 schools, 4,158 T4/T5 students); S9 its own (empty) student view; S10 already answered this month. | OBSERVED (admin account) |
| Guru (teacher, canonical id 5) | Owner persona of `/guru/kirkpatrick*` (user-portal drawer "Kirkpatrick" submenu); answers the monthly feedback ("NPS Guru"). Scope of data, shell and the `/admin/…` link targets for a teacher are not observable (Q-M12-1). | INFERRED (no teacher account) |
| Pelajar (student) | Opens `/kirkpatrick` (own T2/T3/T4 view) and answers `/maklum-balas` ("NPS Pelajar"). Which menu links reach these pages is not observable. Students are the subjects of every T2–T4 figure (minors). | INFERRED |
| Admin Sekolah (v1.6) | `/admin-sekolah/kirkpatrick` (live answers 200) = S1 for the user's own school only; S2–S8 are refused (403). Not counted in T1 by role. | INFERRED (no school-admin account) |
| PPD, JPN, Ibu Bapa, Penaja | No evidence of access to any M12 page; not counted in T1 (only Pelajar / Guru / Admin NPS are shown). | INFERRED |
| Guest | Redirected to `/login` (M01 pattern). | INFERRED (not probed in M12 discovery) |

Correction for URS.md §6: `/guru/*` routes can render the **admin-panel** layout (S1–S8), at least for the admin account (same finding as M11).

---

## 3. Functional breakdown (Epic → Feature → Function)

Built from the element inventory (`docs/discovery/inventory/M12/`) and the Function catalogue used by the §6 script. "EL" lists inventory element IDs (prefix `EL-M12-`). Functions with EL "—" are behaviours (access, data rules, unobservable states) with no element of their own.

**Feature index** (44 features in 11 epics; FT-M12-n.n = the first two parts of its functions):

| Epic | Features |
|---|---|
| EP-M12-1 Navigation, shells and access | FT-1.1 Menu entries, headers and shells · FT-1.2 Access, routes and error pages |
| EP-M12-2 Overview (S1) | FT-2.1 Filter · FT-2.2 Level cards · FT-2.3 Evaluation flow · FT-2.4 Before/after comparison · FT-2.5 KPI row · FT-2.6 Engagement distribution · FT-2.7 Info card |
| EP-M12-3 T1 Reaksi (S2) | FT-3.1 Satisfaction cards |
| EP-M12-4 T2 Pembelajaran (S3) | FT-4.1 KPIs · FT-4.2 Learning Gain · FT-4.3 Subjects · FT-4.4 Schools |
| EP-M12-5 T3 Tingkah Laku (S4) | FT-5.1 Filter · FT-5.2 KPIs · FT-5.3 Engagement bands · FT-5.4 Schools · FT-5.5 Activity heat map · FT-5.6 Alerts · FT-5.7 Mood |
| EP-M12-6 T4 Hasil (S5) | FT-6.1 KPIs · FT-6.2 Grade distribution · FT-6.3 Subject GPS · FT-6.4 GPS trend · FT-6.5 Schools · FT-6.6 Predictions · FT-6.7 ALESA · FT-6.8 ROI · FT-6.9 Insights |
| EP-M12-7 Rantaian Impak (S6) | FT-7.1 Header and report · FT-7.2 Level cards · FT-7.3 Correlation · FT-7.4 Conclusion |
| EP-M12-8 Intervensi (S7) | FT-8.1 KPIs · FT-8.2 Record form · FT-8.3 List |
| EP-M12-9 Student detail (S8) | FT-9.1 Header and entry · FT-9.2 ALESA summary · FT-9.3 Head Count · FT-9.4 Platform accuracy · FT-9.5 No-answer state |
| EP-M12-10 Student view (S9) | FT-10.1 Prestasi Saya |
| EP-M12-11 Monthly feedback (S10) | FT-11.1 Maklum Balas |

### EP-M12-1 — Navigation, shells and access

**FT-M12-1.1 — Menu entries, headers and shells**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M12-1.1.1 | Admin-panel sidebar collapsible group (button `fa-microscope` cyan-500, label "Kirkpatrick" shown upper case "KIRKPATRICK", chevron, `toggle('kirkpatrick')`, open state in `localStorage["admin_sidebar"]` as the other groups, 00-global-ui §3.2) with 7 items, each with a `w-4` icon: "Overview" `fa-th-large` → `/admin/kirkpatrick`, "T1: Reaksi" `fa-smile` → `/reaction`, "T2: Pembelajaran" `fa-brain` → `/learning`, "T3: Tingkah Laku" `fa-running` → `/behavior`, "T4: Hasil" `fa-trophy` → `/results`, "Rantaian Impak" `fa-link` → `/chain`, "Intervensi" `fa-hand-holding-medical` → `/interventions` (all under `/admin/kirkpatrick`). On an `/admin/kirkpatrick*` route the matching item has the active style and the group is open. "Laporan" (`fa-chart-bar`) follows the group and is **not** part of it (M17) | SHA-014–021 | Admin | OBSERVED |
| FN-M12-1.1.2 | Admin-panel mobile "Lagi" drawer entry "Kirkpatrick" (`fa-microscope`) → `/admin/kirkpatrick` (in the drawer's analytics block, after "Monitoring") | SHA-145 | Admin | OBSERVED |
| FN-M12-1.1.3 | User-portal drawer (below 1024 px), "Portal Guru" › "ANALITIK": button "Kirkpatrick" (`fa-microscope` cyan-500, chevron, Alpine `kirkGuruOpen`) opening 7 items: "Ringkasan" `fa-home` → `/guru/kirkpatrick`, "T1: Reaksi" `fa-smile`, "T2: Pembelajaran" **`fa-graduation-cap`** (the admin sidebar uses `fa-brain`; kept, D10), "T3: Tingkah Laku" `fa-running`, "T4: Hasil" `fa-trophy`, "Rantaian Impak" `fa-link`, "Intervensi" `fa-hand-holding-medical` (all under `/guru/kirkpatrick`). The group is in the DOM but hidden for the admin (as live); shown for a teacher (INFERRED). The desktop user sidebar has no Kirkpatrick entry (as live) | SHU-268–275 | Guru (INFERRED); Admin hidden (OBSERVED) | OBSERVED / INFERRED |
| FN-M12-1.1.4 | On `/guru/kirkpatrick*` the admin-panel sidebar item of the current view (and the open group) is shown active, exactly as on the `/admin` twin (DV-M12-12; live shows no active item on the `/guru` prefix) | — | Admin | OBSERVED + DV-M12-12 |
| FN-M12-1.1.5 | Admin-panel header title / subtitle per screen, live and correct: S1 "Kirkpatrick Evaluation" / "Analisis Keberkesanan Platform — Model Penilaian 4 Tahap"; S2 "Tahap 1: Reaksi" / "Kepuasan dan persepsi pengguna terhadap platform"; S3 "Tahap 2: Pembelajaran" / "Peningkatan pengetahuan, kemahiran, dan kefahaman pelajar"; S4 "Tahap 3: Tingkah Laku" / "Konsistensi penggunaan, engagement score, dan corak tingkah laku pelajar"; S5 "Tahap 4: Hasil" / "Impak terhadap keputusan peperiksaan dan prestasi akademik"; S7 "Intervensi Pelajar" / "Rekod tindakan intervensi berdasarkan amaran Kirkpatrick". Tab titles as §1 | SHA-118, 119, 197–204, 207, 208, 216, 217 | All | OBSERVED |
| FN-M12-1.1.6 | S6 and S8 header: live shows the fallback "Dashboard" / "Selamat datang, Admin". Rebuild (DV-M12-03, shell rule DV-SH-03): title from the route, **no subtitle** — S6 "Rantaian Impak" (the live menu label of the route), S8 "Kirkpatrick — {nama}" (the live tab title of the page). Tab titles unchanged | SHA-213, 214 | Admin | OBSERVED + DV-M12-03 |
| FN-M12-1.1.7 | S9 and S10 user-portal header: live shows "Dashboard" / "Selamat datang kembali" (S9) and "Dashboard" (S10). Rebuild (DV-M12-03): S9 "Kirkpatrick — Prestasi Saya", S10 "Maklum Balas" (each the page's own live tab title without the site suffix), no subtitle | SHU-136, 137 | All | OBSERVED + DV-M12-03 |
| FN-M12-1.1.8 | Shell by screen: S1–S8 in the admin-panel shell (SHA: "Panel Pentadbir" sidebar, server-status chips) on **both** prefixes; S9, S10 in the user-portal shell (SHU: koin / mata / streak chips, the M16 `tournamentBanner()` block at the top of `<main>`, hidden when no tournament); 403/404 standalone. The shell a teacher gets on `/guru/kirkpatrick*` is UNVERIFIED; the prototype renders the admin-panel shell (provisional, as M11 FN-1.1.4) | — | All | OBSERVED (admin) / INFERRED (teacher) |
| FN-M12-1.1.9 | In-page tab strip on S2, S3, S4, S5, S7 (`flex flex-wrap gap-1 mb-4 sm:mb-6`, plain links): "Overview" `fa-th-large` → `/admin/kirkpatrick`, "T1: Reaksi" `fa-smile`, "T2: Pembelajaran" `fa-brain`, "T3: Tingkah Laku" `fa-running`, "T4: Hasil" `fa-trophy`, "Intervensi" `fa-hand-holding-medical` (all `/admin/kirkpatrick…`, also on the `/guru` twins). Tabs `px-3 py-2 rounded-lg text-xs sm:text-sm`; current `bg-indigo-600 text-white shadow-md`; others `bg-white text-slate-600 border border-slate-200 hover:bg-slate-100`. No "Rantaian Impak" tab; S1 and S6 have no strip (as live). Links always go to unfiltered URLs (filters do not carry across) | S2-001–006; S3-001–006; S4-001–006; S5-001–006; S7-001–006 | All | OBSERVED |
| FN-M12-1.1.10 | Responsive rules of every screen at 375 / 768 / 1280 (URS §5, SRS §10): shells switch at 1024 px; no page-level horizontal scroll (DV-M12-07); wide tables scroll inside their card; cards and tiles follow the observed grids | — | All | OBSERVED + DV-M12-07 |

**FT-M12-1.2 — Access, routes and error pages**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M12-1.2.1 | Every M12 route requires a session; a guest is sent to `/login` (M01 pattern) | — | Guest | INFERRED |
| FN-M12-1.2.2 | Twin mounting: each view is one component mounted on `/admin/kirkpatrick…` and `/guru/kirkpatrick…` with identical content; every in-page link, form action, "Reset", "← Kembali", export link and the intervention POST target the **mount prefix of the current route** (`/admin/kirkpatrick…`, `/guru/kirkpatrick…`, S1 alias `/admin-sekolah/kirkpatrick`); live targets `/admin/kirkpatrick…` from both prefixes (DV-M12-04, reversed in v1.7) | — | Admin; Guru (provisional) | OBSERVED + DV-M12-04 |
| FN-M12-1.2.3 | Role access: the admin opens every route (OBSERVED). A teacher opens `/guru/kirkpatrick*` and sees the same component and data (INFERRED; whether it is scoped to the teacher's school is UNVERIFIED, Q-M12-1); `/admin/kirkpatrick*` targets followed by a teacher apply the M17/M01 non-admin rule (redirect to the M01 landing page, INFERRED) — all teacher steps provisional. `/kirkpatrick` and `/maklum-balas` are open to every logged-in user (OBSERVED for the admin; INFERRED for others) | — | All | OBSERVED / INFERRED |
| FN-M12-1.2.4 | Global 404 page (M01) for the probed routes of §1 ("Other access outcomes") and for non-numeric ids | — | All | OBSERVED + M01 |
| FN-M12-1.2.5 | Query handling: `school_id` and `state` on S1; `school_id` on S4 (form) and on S3/S5 (URL only, no form); `school_id` accepted and ignored on S2 and S6 (identical output, D-M12-19 replicated); the S7 page ignores both. A `school_id` that matches no school gives the zero state of `?state=Kelantan` (INFERRED; not probed — provisional) | — | Admin | OBSERVED / INFERRED |
| FN-M12-1.2.6 | GET `/admin/kirkpatrick/interventions/{id}` (and `/interventions/create`): live shows the unbranded English framework page "Oops! An Error Occurred" / "The server returned a "405 Method Not Allowed"." / "Something is broken. Please let us know what you were doing when this error occurred. We will fix it as soon as possible. Sorry for any inconvenience caused." Rebuild: the global 404 page (DV-M12-11, M08 DV-24 / M10 DV-26 precedent) | S7-047–049 | All | OBSERVED + DV-M12-11 |
| FN-M12-1.2.7 | S8 with an unknown student id → standalone 403 page (as live; not D9): "403", "🚫", h1 (the page's heading line), "Anda tidak mempunyai kebenaran untuk mengakses halaman ini. Sila log masuk dengan akaun yang betul atau hubungi pentadbir.", "Halaman Utama" → `/`, "Log Masuk" → `/login`, "PRESTASIPLUS" (M01 403 page) | S8-074–080 | Admin | OBSERVED |

### EP-M12-2 — Overview (S1 `/admin/kirkpatrick`)

**FT-M12-2.1 — Filter**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M12-2.1.1 | Filter card: GET form → `/admin/kirkpatrick` (`flex flex-wrap items-end gap-3`): label "Sekolah" + select `school_id` ('' "Semua Sekolah" + the 57 schools with users, A→Z by name, value = school id); label "Negeri" + select `state` ('' "Semua Negeri", Johor, Kedah, Kelantan, Kuala Lumpur, Melaka, Pahang, Perak, Sabah, Selangor, Terengganu); submit "Tapis" (`fa-filter`, indigo-600). Both selects preload the query values. The selects are at least 36 px tall and never wider than the card (DV-M12-07; live 18 px tall, 466 px wide at 375). The 10 states stand (v1.6: Kedah included; M02 moved school 1267 to Kedah, which changes no list) | S1-001–006 | Admin | OBSERVED + DV-M12-07 |
| FN-M12-2.1.2 | **(v1.6, INFERRED.)** Admin Sekolah alias: `/admin-sekolah/kirkpatrick` (live 200) renders S1 for a school admin with the scope forced to the user's own school; figures are that school's only; a `school_id` / `state` of another school in the query is ignored; how the filter form looks for one school is PROPOSED; (v1.7, INFERRED) the viewer's own school is included even if it is a fixture school (900001) and the the level cards, flow pills and the KPIs leading to S2 / S3 render as non-links, while "Pelajar Berdaftar" and "Guru Aktif" keep their links to the alias monitoring page `/admin-sekolah/monitoring` (INFERRED). S2–S8 have no alias and are refused (403) for this role; the pages `/admin/kirkpatrick/*` and `/guru/kirkpatrick/*` redirect any role not allowed there (including this one) to its landing page, so the alias S1 is this role's only Kirkpatrick entry | — | Admin Sekolah | INFERRED |
| FN-M12-2.1.2 | "Reset" link (`fa-times`, `bg-slate-200 text-slate-700`) → `/admin/kirkpatrick`, shown only when `school_id` or `state` is set | S1-072 | Admin | OBSERVED |

**FT-M12-2.2 — Level cards** (`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`, order T4, T3, T2, T1; each an `<a>` with `border-l-4`, upper-case label, icon tile, value, caption and "Lihat detail →" `fa-arrow-right`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M12-2.2.1 | T4 card (amber, `fa-trophy`) → `/admin/kirkpatrick/results`: "Tahap 4: Hasil", GPS of the latest headcount year in scope (2 decimals: "4.30"; school 8080 "4.00", DV-M12-09; live "4"), caption "GPS Sekolah · {n} rekod headcount" (n = "4378", the documented display constant DC-M12-02 — M08 does not host a count of OTR headcount records (XL3-34); unchanged by `school_id`, as live; live read "4379" on 2026-09-26). With `?state=` the GPS stays the platform value (as live) | S1-007, 073 | Admin | OBSERVED + DV-M12-09 |
| FN-M12-2.2.2 | T3 card (blue, `fa-running`) → `/behavior`: "Tahap 3: Tingkah Laku", "{aktif}" + "/{T4/T5}" (slate-400), caption "Pelajar aktif · {sesi} sesi · {ketepatan}% ketepatan" — aktif = T4/T5 students with ≥ 1 answer (DV-M12-08: "946/4158"; live "951/4158"); 8080 "53/184" · "1002 sesi" · "75.6%"; Kelantan "0/0" · "0 sesi" · "0%" | S1-008, 074, 103 | Admin | OBSERVED + DV-M12-08 |
| FN-M12-2.2.3 | T2 card (green, `fa-brain`) → `/learning`: "Tahap 2: Pembelajaran", "{ketepatan}%", caption "Ketepatan · {n} soalan dijawab" ("82.8%", "306,133"; 8080 "75.6%", "15,007"; Kelantan "0%", "0") | S1-009, 075, 104 | Admin | OBSERVED |
| FN-M12-2.2.4 | T1 card (purple, `fa-smile`) → `/reaction`: "Tahap 1: Reaksi", "{kepuasan}" + "/5", caption "Kepuasan purata · {n} respon" ("4.6/5", "336 respon"); global — unchanged by `school_id` and `state` | S1-010 | Admin | OBSERVED |
| FN-M12-2.2.5 | **School without SPM history** (a `school_id` with no history row: OBSERVED on 9167, audit round 2; 8080 has a history row; other schools not verified — M17 discovery reports SPM data for 8880, TU-M12-09): the T4 card shows "Belum Ada Data" (`text-lg`, slate-400) and "Import keputusan peperiksaan" (`text-xs`, slate-400) instead of the GPS and its caption; the flow pill reads "GPS -" (desktop circles and mobile list). The other cards follow their own rules | S1-A01–A03 (audit-observed, §6.3) | Admin | OBSERVED |

**FT-M12-2.3 — Kirkpatrick Evaluation Flow**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M12-2.3.1 | Card "Kirkpatrick Evaluation Flow" (`fa-project-diagram`) with the hint "Klik mana-mana tahap untuk lihat detail" | S1-011, 012 | Admin | OBSERVED |
| FN-M12-2.3.2 | From `sm` (≥ 640 px): 4 circles T1 → T4 on a gradient line (purple → green → blue → amber); each a link with label, sub-label and pill: "T1: Reaksi" / "Kepuasan pengguna" / "{k}/5"; "T2: Pembelajaran" / "Peningkatan kemahiran" / "{a}% ketepatan"; "T3: Tingkah Laku" / "Konsistensi penggunaan" / "{aktif} pelajar aktif" (DV-M12-08); "T4: Hasil" / "Keputusan peperiksaan" / "GPS {gps}" (DV-M12-09) → reaction / learning / behavior / results | S1-013–020, 076–081, 105–108 | Admin | OBSERVED + DV-M12-08/09 |
| FN-M12-2.3.3 | Below `sm`: the same 4 entries as a vertical list of links with `fa-chevron-right` | S1-021–024, 082–084, 109, 110 | Admin | OBSERVED |

**FT-M12-2.4 — Perbandingan Sebelum & Selepas**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M12-2.4.1 | Card "Perbandingan Sebelum & Selepas" (`fa-exchange-alt`) with subtitle "{bulan sebelum} vs {bulan selepas}" in BM month names ("Januari 2026 vs September 2026"; 8080 "April 2026 vs September 2026"); no data → "Tiada Data vs Tiada Data" | S1-025–027, 085, 111 | Admin | OBSERVED |
| FN-M12-2.4.2 | Two panels: "SEBELUM" (slate) = the first calendar month with activity in scope, range "01 Jan 2026 - 31 Jan 2026"; "SELEPAS" (indigo) = the current month up to today, "01 Sep 2026 - 25 Sep 2026"; no data → "-". Each shows "Pelajar Aktif", "Ketepatan", "Jumlah Jawapan", "Champion" (students with > 50 answers in that month, INFERRED): 2 / 33.3% / 3 / 0 and 58 / 87% / 13,968 / 28; 8080 "01 Apr 2026 - 30 Apr 2026" 12 / 71.6% / 511 / 3 and 1 / 55% / 60 / 1 (top-up, unchanged) | S1-028–047, 086–088, 112–116 | Admin | OBSERVED / INFERRED (month rules) |
| FN-M12-2.4.3 | Four delta tiles (after − before) under the labels "Pelajar Aktif", "Ketepatan", "Jumlah Jawapan", "Champion": ≥ 0 → `border-green-200`, `fa-arrow-up` green-500, value green-600 with "+" ("+56", "+53.7%", "+13965", "+28"); < 0 → `border-red-200`, `fa-arrow-down` red-500, value red-600 ("-11", "-16.6%", "-451", "-2"). The accuracy delta is a difference in points shown with "%" (as live, D-M12-17 replicated); no data → "0%" tiles | S1-048–055, 089–092 | Admin | OBSERVED |
| FN-M12-2.4.4 | "Ringkasan:" box (`fa-chart-line`) with sentences in this order (INFERRED rules): accuracy up "Peningkatan {x}% dalam ketepatan jawapan." / down "Penurunan {x}% dalam ketepatan jawapan."; active up "{n} pelajar baru mula aktif." / down "{n} pelajar kurang aktif berbanding sebelumnya."; answers up "Jumlah jawapan meningkat {x}%." (x = (after − before) ÷ before × 100, 1 decimal with a trailing ".0" dropped: "465500%" at baseline, "467833.3%" on 2026-09-26 — AUD-M12-06); champions up "{n} pelajar naik ke tahap Champion."; no data → "Data tidak mencukupi untuk perbandingan." | S1-056, 057, 093, 117 | Admin | OBSERVED (4 texts) / INFERRED (rules) |

**FT-M12-2.5 / 2.6 / 2.7 — KPI row, engagement distribution, info card**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M12-2.5.1 | KPI row (`grid-cols-2 lg:grid-cols-4`, each an `<a>`): "Pelajar Berdaftar (T4/T5)" "4,158" → `/admin/monitoring`; "Soalan Dijawab" "306,133" → `/admin/kirkpatrick/learning`; "Guru Aktif" "277/522" → `/admin/monitoring`; "Ketepatan Keseluruhan" "82.8%" → `/learning` (8080: 184 / 15,007 / 34/34 / 75.6%; Kelantan: 0 / 0 / 0/0 / 0%) | S1-058–061, 094–097, 118–121 | Admin | OBSERVED |
| FN-M12-2.6.1 | "Taburan Engagement Pelajar" (`fa-chart-pie`), `grid-cols-5`, 5 links → `/admin/kirkpatrick/behavior`, each a round icon tile (background `{hex}15`), count, label and "%" of T4/T5: 513 Champion 12.3% (`fa-crown` #15803d), 259 Konsisten 6.2% (`fa-check-double` #2563eb), 169 Berkembang 4.1% (`fa-seedling` #ca8a04), 5 Minimum 0.1% (`fa-minus-circle` #ea580c), **3212 Tidak Terlibat 77.2%** (`fa-times-circle` #dc2626; DV-M12-08, live 3207 / 77.1%); 8080 36 / 8 / 9 / 0 / 131 (19.6% / 4.3% / 4.9% / 0% / 71.2%) | S1-062–068, 098–102, 122–125 | Admin | OBSERVED + DV-M12-08 |
| FN-M12-2.7.1 | Info card (cyan, `fa-info-circle`): "Model Kirkpatrick — 4 Tahap Penilaian Keberkesanan" and the static text "Dashboard ini mengukur keberkesanan platform PrestasiPlus berdasarkan model Kirkpatrick (1959). Data Tahap 2 (Pembelajaran) dan Tahap 3 (Tingkah Laku) dijana secara automatik daripada aktiviti pelajar. Tahap 1 (Reaksi) memerlukan data survey, dan Tahap 4 (Hasil) memerlukan keputusan peperiksaan sebenar." | S1-069–071 | Admin | OBSERVED |

### EP-M12-3 — T1 Reaksi (S2 `/admin/kirkpatrick/reaction`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M12-3.1.1 | Tab strip plus 4 cards (`grid-cols-2 lg:grid-cols-4`, `text-2xl`): "NPS Pelajar" "8.4/10" (purple), "NPS Guru" "6.5/10" (blue), "NPS Admin" "9.6/10" (amber), "Kepuasan Purata" "4.6/5" (emerald). NPS = mean 0–10 score of that role's feedback responses, 1 decimal; Kepuasan = mean 1–5 score of all responses (INFERRED means; values OBSERVED). No filter, no respondent count, no breakdown, no survey link (as live) | S2-007–018 | Admin | OBSERVED / INFERRED (formula) |
| FN-M12-3.1.2 | T1 is global: every T1 figure (S1 T1 card, S2, S6 T1) ignores `school_id` and `state` (D-M12-19 replicated) | — | Admin | OBSERVED |

### EP-M12-4 — T2 Pembelajaran (S3 `/admin/kirkpatrick/learning`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M12-4.1.1 | Six KPI cards (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-6`): "Soalan Dijawab" "306,133"; "Ketepatan" "82.8%"; "Skor Purata" "80.3%" (mean session score, DV-M12-15 rule); "Sesi Selesai" "20991" + "/20991"; "Kadar Penyelesaian" "100%"; "Learning Gain" "-" (slate-400) with "Perlu pre/post test". 8080: 15,007 / 75.6% / 73.3% / 1002/1002 / 100% | S3-007–026, 061–065 | Admin | OBSERVED |
| FN-M12-4.1.2 | `?school_id=` works by URL only (the page has no form, as live); without it the page is platform-wide | — | Admin | OBSERVED |
| FN-M12-4.2.1 | Dashed empty card (`fa-flask`): "Pre-Test / Post-Test belum dimulakan", "Apabila ujian diagnostik dimulakan, Hake's Normalized Learning Gain akan dikira secara automatik.", "g = (Post - Pre) / (100 - Pre) · High: g≥0.7 · Medium: 0.3≤g<0.7 · Low: g<0.3". There are no pre/post tests anywhere in the platform, so this state is permanent in the rebuild; the populated Learning Gain view is UNVERIFIED and not built | S3-027–029 | Admin | OBSERVED |
| FN-M12-4.3.1 | "Prestasi Mengikut Subjek" (`fa-book`): one row per subject with answers in scope (26 platform; 24 for 8080), sorted by **exact accuracy (correct ÷ answered) descending, then subject name A–Z** (v1.7; reproduces every observed list, including the 100 % rows of 8080: Bahasa Cina, Reka Bentuk & Teknologi, Sains Komputer): subject name (indigo-600, `w-32 sm:w-40 truncate`), bar `h-5` of width = accuracy with the label inside ("100.0%", 1 decimal), status pill "Mastered" (≥ 80%: bar green-500, pill `bg-green-100 text-green-700`), "Developing" (50–79.9%: amber-500, `bg-amber-100 text-amber-700`), "Beginning" (< 50%: red-500, `bg-red-100 text-red-700`) (bounds INFERRED; every one of the 50 captured rows fits), and "{n} soalan". All 26 platform rows and the 24 8080 rows are observed (top-up; the only platform row that moved between captures is Sejarah, whose baseline value 76.3% / 57695 is the discovery value — SRS §6.9) | S3-030, 031, 033–036, 038–041, 043–046, 048–051, 066–073, 075–077, 079–082, 084–087 | Admin | OBSERVED |
| FN-M12-4.3.2 | The subject rows are not clickable: live gives each row `cursor-pointer` and `title="Klik untuk lihat detail"` with no action; the rebuild renders them with the default cursor and **no** title (DV-M12-05) | S3-032, 037, 042, 047, 074, 078, 083 | Admin | OBSERVED + DV-M12-05 |
| FN-M12-4.4.1 | "Pembelajaran Mengikut Sekolah" (`fa-school`): table # · Sekolah (link → `/admin/monitoring/sekolah/{id}`) · Pelajar · Soalan (answered) · Ketepatan · Skor Purata · Subjek (a per-school subject count whose definition is not observable — 8080 shows 3 while its own subject list has 24 rows; stored, DV-M12-27 rejected); one row per school with T4/T5 students (33), sorted by Ketepatan descending, ties by school id ascending (observed); first row 8880; Ketepatan green-600 ≥ 70, amber-600 50–69.9, red-600 < 50 (16 / 7 / 10); schools with 0 answers show 0 / 0% / 0% — including school **940** ("Subjek 1", one session without questions), whose live "Skor Purata 90%" becomes 0% (DV-M12-15). 8080: 1 row. The table scrolls inside its card | S3-052–060 | Admin | OBSERVED + DV-M12-15 |

### EP-M12-5 — T3 Tingkah Laku (S4 `/admin/kirkpatrick/behavior`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M12-5.1.1 | Filter card: GET → `/admin/kirkpatrick/behavior`, label "Sekolah" + select `school_id` (as FN-2.1.1, no Negeri), submit "Tapis" (`fa-filter`); preloaded; select ≥ 36 px tall and within the card (DV-M12-07) | S4-007–010 | Admin | OBSERVED + DV-M12-07 |
| FN-M12-5.1.2 | "Reset" (`fa-times`) → `/admin/kirkpatrick/behavior` when filtered | S4-081 | Admin | OBSERVED |
| FN-M12-5.2.1 | Six KPI cards: "Pelajar T4/T5" "4,158"; "Pernah Aktif" "946" (DV-M12-08; live 951); "Jumlah Sesi" "20991"; "Soalan Dijawab" "306,133"; "Ketepatan" "82.8%"; "Guru Aktif" "53.1%" with "277/522" (teachers of non-fixture schools with a login ÷ all such teachers). 8080: 184 / 53 / 1002 / 15,007 / 75.6% / 100% "34/34". With a school filter, "Pernah Aktif" and "Soalan Dijawab" equal that school's table "Aktif" and "Soalan" (DV-M12-08) | S4-011–029, 082–088 | Admin | OBSERVED + DV-M12-08 |
| FN-M12-5.3.1 | "Taburan Tahap Engagement" (`fa-chart-pie`): 5 tiles (`grid-cols-5`), each an `<a>` → `/admin/monitoring` (unfiltered), background `{hex}08`, count (`text-2xl sm:text-3xl`), label, caption, mini bar `h-2` (width = %) and "%": Champion ">50 soalan" 513 12.3%; Konsisten "20-50 soalan" 259 6.2%; Berkembang "5-20 soalan" 169 4.1%; Minimum "<5 soalan" 5 0.1%; Tidak Terlibat "0 soalan" **3212 77.2%** (DV-M12-08). Band of a student by answers in scope: > 50 Champion; 20–50 Konsisten; 5–19 Berkembang; 1–4 Minimum; 0 Tidak Terlibat (INFERRED boundaries; captions replicated, DV-M12-10 rejected). 8080 36 / 8 / 9 / 0 / 131 | S4-030–036, 089–093 | Admin | OBSERVED / INFERRED (boundaries) |
| FN-M12-5.4.1 | "Engagement Mengikut Sekolah" (`fa-school`): table # · Sekolah (link → `/admin/monitoring/sekolah/{id}` + the school code line or "-") · Pelajar · Aktif · Soalan · Sesi · Purata/Aktif (Soalan ÷ Aktif, 1 decimal, trailing ".0" dropped; 0 when Aktif 0) · Skor (engagement score 0–100, coloured by tahap) · Tahap (pill, white text on the tahap hex); 33 rows sorted by Skor descending, ties by school id; first row 9681; tahap by Skor: Champion ≥ 80, Konsisten 60–79.9, Berkembang 40–59.9, Minimum 20–39.9, Tidak Terlibat < 20 (INFERRED; fits all 33 observed rows); split 8 / 7 / 2 / 4 / 3 + 9 rows with Aktif "0" (slate-300). **Aktif and Soalan use the answered definition of the KPI cards** (DV-M12-08): live shows students with ≥ 1 served question (Σ 951) and served questions (Σ 307,049), which differ from the KPIs at 10 schools. Sesi = all sessions (school 940: Sesi 1, Aktif 0, Soalan 0, Skor 2). Score formula unobservable (Q-M12-3): stored per school. Table scrolls in its card | S4-037–045 | Admin | OBSERVED + DV-M12-08 |
| FN-M12-5.5.1 | "Corak Masa Aktiviti" (`fa-clock`), "Bilangan soalan dijawab mengikut jam dan hari": heat table, columns 06 … 23, rows Isnin … Ahad; each cell `w-5 h-5 sm:w-6 sm:h-6`, `title="{Hari} {HH}:00 — {n} soalan"`, the number in white 8 px, background `rgba(99,102,241,α)` with α = max(0.15, n ÷ max cell); n = 0 → `#f1f5f9`, empty, `text-slate-200`. Hours 00–05 are not shown (as live); the grid covers a subset of the answers (Q-M12-4). Observed grids (top-up): platform 126 cells, max 6253 ("Selasa 14:00"), "Isnin 06:00" 944 (α 0.15), Σ 218,070, no zero cell; 8080 max 736, Σ 12,008, 43 zero cells. The table scrolls inside its card | S4-046–049 | Admin | OBSERVED |
| FN-M12-5.6.1 | "Amaran & Pemerhatian" (`fa-bell`), rendered only when there is at least one item (absent for 8080). **Three lists, concatenated in this order, each in school-id order; a school may appear in more than one** (OBSERVED): (1) red (`bg-red-50`, `fa-exclamation-triangle`) "{sekolah}: {n} pelajar tidak pernah login langsung." for every school where more than half of its T4/T5 students never logged in (22 items; threshold INFERRED between 37.0% and 53.2%, fits all 27 schools with such students); (2) red "{sekolah}: {n} guru telah login tetapi tiada pelajar yang menjawab soalan." for every school with ≥ 1 teacher login and 0 answers (1 item: school 10220, n = 2); (3) green (`bg-green-50`, `fa-check-circle`) "{sekolah}: {x}% pelajar aktif menjawab soalan. Tahniah!" for every school whose table Aktif ÷ Pelajar is **strictly greater than 50%** (12 items; 8298 at exactly 50% has none), x with 1 decimal, trailing ".0" dropped. Nine schools appear in list 1 and list 3. With DV-M12-08 the 9167 item reads "62.5%" (live "75%" = 6/8 served-question students). No item has an "Ambil Tindakan" button (as live; DV-M12-01) | S4-050–076 | Admin | OBSERVED + DV-M12-08 |
| FN-M12-5.7.1 | Mood card: "💭", "Data Mood Belum Mencukupi", "Pelajar perlu check-in mood harian untuk analisis kesejahteraan vs prestasi." — shown while there are no mood check-ins in scope; the populated mood analysis is UNVERIFIED and not built (OQ-M12-06) | S4-077–080 | Admin | OBSERVED |

### EP-M12-6 — T4 Hasil (S5 `/admin/kirkpatrick/results`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M12-6.1.1 | Six KPI cards: "GPS Headcount" "4.30" / "41 rekod · 2025" (8080 "4.00" (DV-M12-09) / "41 rekod · 2026"); "Kadar Lulus" "96.7%" / "174/180 calon" (DV-M12-16: grades A+…D; live "90.6%" / "163/180 calon"); "Pelajar Gred A" "52" / "28.9% daripada 180" (A+ + A + A-); "Ketepatan Platform" "82.8%" / "306,133 soalan"; "Pelajar Aktif" "946" / "22.8% daripada 4,158"; "Rekod Headcount" "4378" / "Data OTR" (display constant DC-M12-02, XL3-34; platform-wide, unchanged by `school_id`). 8080: "100%" "1/1 calon", "0" "0% daripada 1", 75.6% "15,007 soalan", 53 "28.8% daripada 184". `?school_id=` by URL only | S5-007–030, 147–157 | Admin | OBSERVED + DV-M12-09/16 |
| FN-M12-6.1.2 | **School without SPM history** on S5 (OBSERVED on 9167): "GPS Headcount" "-" with the caption "41 rekod" (live "41 rekod ·" with a dangling separator and no year — DV-M12-28); "Kadar Lulus" "0%" "0/0 calon"; "Pelajar Gred A" "0" "0% daripada 0"; the "Taburan Gred" card is **not rendered**; the ROI "GPS Headcount" reads "-"; "Pemerhatian & Insight" shows only the "Hanya …" and "Purata ketepatan …" rows (the "GPS keseluruhan … (tahun …)" sentence is omitted) and the disclaimer; the subject-GPS and trend tables show the platform rows (DV-M12-26). Other cards as FN-6.1.1 (e.g. 9167 "Pelajar Aktif 5" "62.5% daripada 8") | S5-A01–A07 (audit-observed, §6.3) | Admin | OBSERVED + DV-M12-28 |
| FN-M12-6.1.3 | **(v1.6, D9 DV-M12-29; INFERRED values.)** School with an M08 history row but **no grade counts** (8880; live has no display for it): S1 and S5 show GPS **2.88** (2026) and the M08 candidate count **150**; S5 does not render "Taburan Gred"; "Kadar Lulus" and "Pelajar Gred A" print "-" (not "0%" / "0/0 calon" / "0") with the caption "150 calon" (PROPOSED copy); ROI "GPS Headcount" 2.88; the "GPS keseluruhan" insight uses it. School 9167 (no history row) stays as FN-6.1.2 | — | Admin | INFERRED + DV-M12-29 |
| FN-M12-6.2.1 | "Taburan Gred ({tahun})" (`fa-chart-bar`), "Berdasarkan {n} calon — sumber: Headcount OTR": 10 rows A+ … G, `cursor-default`, each with `title="{g}: {n} pelajar ({p}%)"`, a bar `h-6` of width n ÷ max(n) × 100% in the grade colour (A+ #15803d, A #16a34a, A- #22c55e, B+ #2563eb, B #3b82f6, C+ #ca8a04, C #eab308, D #ea580c, E #dc2626, G #991b1b) with the count inside, and the "%" (n ÷ candidates). 2025: 10 / 18 / 24 / 32 / 32 / 26 / 21 / 11 / 5 / 1 of 180 (5.6% … 0.6%); 8080 2026: B+ 1 (100%), others "0 pelajar (0%)" | S5-031–073, 158–178 | Admin | OBSERVED |
| FN-M12-6.3.1 | "GPS Mengikut Subjek (2026)" (`fa-book`): table # · Subjek · GPS · Gred · Calon · Trend; sorted by GPS ascending: Matematik 2.50 A- 30 · Bahasa Melayu 2.80 A- 30 · Sains 2.90 A- 30 · Sejarah 3.00 A- 30 · Bahasa Inggeris 3.20 B+ 30; Gred = grade of point ⌈GPS⌉ − 1 (INFERRED; fits all 5 rows; differs from M08's rounding rule, DV-M12-20 rejected); Trend = `fa-arrow-up` green-500 + the previous-year GPS (4.45 / 4.00 / 4.70 / 4.50 / 4.30). The subject cell is plain text (DV-M12-05; live `cursor-pointer` + `title="Lihat detail {subjek}"` with no action). Note "GPS rendah = lebih baik. Trend: berbanding tahun sebelumnya." (`fa-info-circle`). **With `school_id` the table shows the same platform rows** (no school-specific subject GPS exists); live relabels the heading "(2025)", which contradicts the trend table on the same page — the rebuild keeps the platform heading "(2026)" (DV-M12-26) | S5-074–077 | Admin | OBSERVED + DV-M12-05/26 |
| FN-M12-6.4.1 | "Trend GPS (2022–2026)" (`fa-chart-line`): table Subjek · 2022 · 2023 · 2024 · 2025 · 2026 · Trend; row "Keseluruhan" (`bg-indigo-50/50 font-semibold`) 5.20 4.80 4.50 4.30 "-"; Bahasa Melayu 4.80 4.50 4.20 4.00 2.80; Bahasa Inggeris 5.20 4.90 4.55 4.30 3.20; Matematik 5.50 5.10 4.75 4.45 2.50; Sains 5.80 5.40 5.00 4.70 2.90; Sejarah 5.60 5.20 4.80 4.50 3.00; Pendidikan Islam 4.20 3.90 3.65 3.40 "-"; values green-600 ≤ 4.00, amber-600 > 4.00; "-" in slate-300 (DV-M12-14; live green in "Keseluruhan", amber in Pendidikan Islam); every Trend cell `fa-arrow-up` green (as live). Legend "↑ = GPS menurun (improving). Sumber: Headcount OTR & SPM sebenar." (the "↑" is the `fa-arrow-up` icon). With `school_id` the same platform table with the same heading and 2026 column (DV-M12-26; live "(2022–2025)" without the 2026 column). **(v1.6)** The 2022–2025 values of each subject row are read from the M08 series `schoolSpmHistory.subjectTrend()` (M08 owns the series — D12); the 2026 column is the subject-GPS table's 2026 value | S5-078–081 | Admin | OBSERVED + DV-M12-14/26 |
| FN-M12-6.5.1 | "Prestasi Mengikut Sekolah (Platform + Headcount)" (`fa-school`): table # · Sekolah (link) · Pelajar · Aktif · Ketepatan · Soalan · Engagement · Tahap; 33 rows by Engagement descending (ties by school id); Aktif and Soalan use the answered definition (DV-M12-08, as FN-5.4.1); Ketepatan green-600 ≥ 60, amber-600 below (fits all 24 active rows); schools with Aktif 0: row `opacity-50`, Ketepatan "-" slate-300, Soalan "-", Engagement "-" — except a school that has sessions, which shows its stored score (school 940: "2"; rule derived from the 9 faded rows). 8080: 1 row | S5-082–090 | Admin | OBSERVED |
| FN-M12-6.6.1 | "Ramalan Prestasi Pelajar Aktif" (`fa-magic`), "Berdasarkan ketepatan menjawab soalan dalam platform": table # · Pelajar (link → `/admin/monitoring/sekolah/{sid}/pelajar/{id}`) · Sekolah (link → `/admin/monitoring/sekolah/{sid}`) · Soalan · Ketepatan (coloured) · Anggaran Gred (pill); every active student (946; 8080 53), no pagination (observed pill split 512 A-band / 206 B-band / 104 C-band / 95 D-E / 29 G), sorted by Ketepatan descending. The order **within equal accuracies is not observable** (neither answers nor id order fits live); the rebuild uses user id ascending (PROPOSED) and nothing asserts it. Anggaran Gred from accuracy: A+ ≥ 90 · A ≥ 80 · A- ≥ 70 · B+ ≥ 65 · B ≥ 60 · C+ ≥ 55 · C ≥ 50 · D ≥ 40 · E ≥ 30 · G < 30 (OBSERVED min/max per grade; differs from M08 BR-M08-02, DV-M12-21 rejected); colour A band #15803d, B band #2563eb, C band #ca8a04, D/E #ea580c, G #dc2626. Footnote (`fa-info-circle`) "Ramalan ini berdasarkan ketepatan menjawab soalan dalam platform sahaja. Ramalan penuh memerlukan lebih banyak data termasuk keputusan peperiksaan terdahulu." | S5-091–105 | Admin | OBSERVED |
| FN-M12-6.7.1 | Card "Ramalan ALESA (Predictive Grade)" with the heading icon rendered (live `fa-crystal-ball` is not in Font Awesome Free and renders blank; rebuild resolves it to Lucide `Sparkles` per design-system §6.9 — DV-M12-06); subtitle "Berdasarkan ketepatan, konsistensi, trend mingguan, dan jumlah latihan pelajar" | S5-106–108 | Admin | OBSERVED + DV-M12-06 |
| FN-M12-6.7.2 | Three tiles computed from the listed rows of the current scope: "{n} Dijangka Lulus" (green; grades A+ … D), "{n} Dijangka Gagal" (red; E, G), "{n} Perlu Intervensi" (amber; D, E): platform 48 / 2 / 4; 8080 47 / 3 / 3 | S5-109–114 | Admin | OBSERVED |
| FN-M12-6.7.3 | Table # · Pelajar (name + school line, plain text) · Ketepatan (= the student's prediction-row accuracy) · Ramalan Gred (pill, per-grade colour A+ #15803d, A #16a34a, A- #22c55e, B+ #2563eb, B #3b82f6, C+ #ca8a04, C #eab308, D #ea580c, E #dc2626, G #991b1b INFERRED) · Keyakinan (pill "Rendah" `text-slate-500 bg-slate-100`, "Sederhana" `text-amber-600 bg-amber-50`, "Tinggi" `text-green-600 bg-green-50`) · Cadangan — A-band: "Teruskan konsistensi latihan. Fokus pada topik yang masih lemah untuk capai kecemerlangan."; B-band: "Tingkatkan latihan harian. Perlu tambah 20-30 soalan/minggu untuk naik ke gred A."; C-band: "Pelajar ini perlu meningkatkan jumlah latihan. Cadangan: minimum 10 soalan sehari."; D/E-band: "Pelajar memerlukan intervensi segera. Cadangan: bimbingan guru dan program pemulihan." (the band follows the grade in 99 of the 100 captured rows; the 8080 row of Student B is grade C with the D/E text, so the text band is stored per prediction). **Scoped by `school_id`**: the platform list and each school's list are separate stored predictions of at most 50 students (platform: 50 rows from 6 schools; 8080: 50 of its 53 active students); rows ordered by grade (best first), then **user id ascending** (observed, 0 violations in both states). The selection of the 50 is not observable (stored) | S5-115–124 | Admin | OBSERVED |
| FN-M12-6.7.4 | Footer (purple, `fa-info-circle`): "**{lulus} pelajar dijangka lulus**, {intervensi} pelajar perlu intervensi segera. Ramalan ini berdasarkan formula berwajaran: Ketepatan (40%), Konsistensi (20%), Trend (20%), Volume (20%)." — counts from the listed rows ("48 … 4"; 8080 "47 … 3"). ALESA score = 0.4·Ketepatan + 0.2·Konsistensi + 0.2·Trend + 0.2·Volume; component scaling and Keyakinan rule unobservable (Q-M12-3): grades are stored predictions (platform A+ 6, A 16, A- 9, B+ 9, B 3, C+ 1, C 2, D 2, E 2, Keyakinan 38 / 10 / 2; 8080 A+ 3, A 9, A- 11, B+ 13, B 7, C+ 3, C 1, E 3) | S5-125, 126, 179, 180 | Admin | OBSERVED / SOURCE-DERIVED (weights) |
| FN-M12-6.8.1 | "ROI Platform (Anggaran)" (`fa-coins`): "Pelajar Aktif" 946 · "Purata Soalan/Pelajar" 323.6 (answers ÷ active, 1 decimal) · "Ketepatan Aktif" 82.8% · "GPS Headcount" 4.30; amber box (`fa-calculator`) "ROI penuh akan dapat dikira apabila:" with the ordered list "Keputusan peperiksaan sebenar (SPM/dalaman) diimport", "Data kos langganan platform dimasukkan", "Perbandingan prestasi pelajar aktif vs tidak aktif dapat dibuat" (8080 "75.6%") | S5-127–140, 181 | Admin | OBSERVED |
| FN-M12-6.9.1 | "Pemerhatian & Insight" (`fa-lightbulb`, `border-l-4 border-blue-500`): "Hanya {aktif} daripada {T4T5} pelajar T4/T5 ({p}%) menggunakan platform. Data perbandingan terhad kepada pelajar aktif sahaja." (DV-M12-13: "(22.8%)"; live repeats "(946)"); "Purata ketepatan pelajar aktif dalam platform: {a}%. Ini bersamaan anggaran gred {g}." (grade by the FN-6.6.1 map: 82.8 → A, 75.6 → A-); "GPS keseluruhan dari headcount (tahun {y}): {gps}. Trend menunjukkan peningkatan dari tahun ke tahun." (static second sentence, as live; 8080 "(tahun 2026): 4.00", DV-M12-09); disclaimer (`fa-exclamation-triangle`) "Disclaimer: Data GPS Anggaran berdasarkan markah OTR headcount, bukan keputusan SPM sebenar." | S5-141–146, 182–184 | Admin | OBSERVED + DV-M12-09/13 |

### EP-M12-7 — Rantaian Impak (S6 `/admin/kirkpatrick/chain`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M12-7.1.1 | Header row (gray palette, `rounded-2xl border-2` cards, no tab strip): h1 "Model Kirkpatrick — Rantaian Impak", "Bukti keberkesanan Prestasi Plus berdasarkan 4 Tahap Kirkpatrick", link "← Kembali" → `/admin/kirkpatrick` | S6-001, 002, 004 | Admin | OBSERVED |
| FN-M12-7.1.2 | Button "Muat Turun Laporan" (inline download icon, indigo-600) → `/admin/kirkpatrick/export-pdf`, `target="_blank"`. The PDF content is unobservable (Q-M12-8): the prototype returns a PDF with the S6 figures (PROPOSED content, provisional) | S6-003 | Admin | OBSERVED (link) / PROPOSED (file) |
| FN-M12-7.2.1 | T1 card (badge "T1", green-300 border, green-500 badge): "Reaksi" / "Kepuasan pengguna terhadap Prestasi Plus": "NPS Purata" "8.3/10" (mean over all responses) · "Kepuasan" "4.6/5" · "Responden" "336" | S6-005–014 | Admin | OBSERVED |
| FN-M12-7.2.2 | T2 card (green): "Pembelajaran" / "Perkembangan akademik melalui Head Count": "Ketepatan" 82.8% · "Soalan Dijawab" 306,133 · "Skor Purata" 80.3% | S6-016–025 | Admin | OBSERVED |
| FN-M12-7.2.3 | T3 card (yellow-300 / yellow-500): "Tingkah Laku" / "Konsistensi penggunaan platform (Mastery Learning)": "Pelajar Aktif" "946/4158 (22.8%)" (DV-M12-08; live "951/4158 (22.9%)") · "Sesi Latihan" "20,991"; "Taburan Konsistensi:" Champion 513 · Consistent 259 · Developing 169 · Minimal 5 · Disengaged **3212** (English labels as live, DV-M12-18 rejected; DV-M12-08) | S6-027–045 | Admin | OBSERVED + DV-M12-08 |
| FN-M12-7.2.4 | T4 card (yellow): "Hasil / Impak" / "Korelasi penggunaan dengan pencapaian": "GPS" 4.30 · "Korelasi (r)" 0.1298 · "Kekuatan" "Lemah" (\|r\| < 0.3 Lemah, 0.3–< 0.7 Sederhana, ≥ 0.7 Kuat — INFERRED). Card status colours: T1/T2 green, T3/T4 yellow (fixed as observed; the status rule is INFERRED and not asserted beyond these values) | S6-047–056 | Admin | OBSERVED / INFERRED |
| FN-M12-7.2.5 | Cards `grid-cols-1 md:grid-cols-4`; "→" (gray-300) between cards only from `md` | S6-015, 026, 046 | Admin | OBSERVED |
| FN-M12-7.3.1 | "Analisis Korelasi: Penggunaan → Pencapaian": table Tahap Penggunaan · Bil. Pelajar · Purata Ketepatan · Visual (bar `h-3`, width = accuracy; `bg-yellow-500` < 60, `bg-green-500` otherwise): "1-20 soalan" 215 59.7% · "51-100 soalan" 149 68.7% · "100+ soalan" 348 75.2% (DV-M12-02: the duplicated "1-20 soalan" row is removed; the 21–50 band, never displayed on live, is not shown). Values are documented display constants (DV-M12-23) | S6-057–059 | Admin | OBSERVED + DV-M12-02 |
| FN-M12-7.3.2 | Box "**Kesimpulan ALESA:** Pelajar yang menjawab 100+ soalan mencapai ketepatan 75.2%, berbanding 59.7% bagi pelajar dengan kurang 20 soalan (perbezaan +15.5%). Korelasi Pearson antara penggunaan dan ketepatan: r = 0.1298 (Lemah)." | S6-060, 061 | Admin | OBSERVED |
| FN-M12-7.4.1 | Gradient card (indigo → purple, white text) "Kesimpulan Model Kirkpatrick" with the static text "Berdasarkan analisis empat tahap Model Kirkpatrick, Prestasi Plus menunjukkan keberkesanan sebagai platform pembelajaran digital. **Tahap 1 (Reaksi)** menunjukkan maklum balas positif daripada pengguna. **Tahap 2 (Pembelajaran)** melalui Head Count menunjukkan perkembangan akademik yang dapat dipantau. **Tahap 3 (Tingkah Laku)** menunjukkan pelajar yang konsisten menggunakan platform menunjukkan corak Mastery Learning. **Tahap 4 (Hasil)** korelasi antara penggunaan aktif dengan ketepatan jawapan membuktikan impak positif terhadap pencapaian. Empat-empat tahap Kirkpatrick dipenuhi dalam Prestasi Plus." (static, as live) | S6-062–067 | Admin | OBSERVED |

### EP-M12-8 — Intervensi (S7 `/admin/kirkpatrick/interventions`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M12-8.1.1 | Four KPI cards (`grid-cols-2 md:grid-cols-4`): "Jumlah Intervensi" (blue), "Menunggu Semakan" (amber), "Meningkat" (green), "Menurun" (red) — counts over the intervention store (0 on live). Status of a record (INFERRED): "Menunggu Semakan" when `after_accuracy` is empty; otherwise "Meningkat" when after > before, "Menurun" when after < before, neither when equal (counted only in Jumlah) | S7-007–018 | Admin | OBSERVED (0) / INFERRED (rules) |
| FN-M12-8.2.1 | Collapsible card "Rekod Intervensi Baru" (`fa-plus-circle`, chevron `fa-chevron-down`): closed on load; the header button opens / closes the form and rotates the chevron 180° (DV-M12-01; live `x-data="{ open:  }"` throws Alpine errors and the panel never opens). The header button is at least 36 px tall (DV-M12-07 rule; live 20 px) | S7-019–021 | Admin | OBSERVED + DV-M12-01 |
| FN-M12-8.2.2 | Form (SOURCE-DERIVED) POST → `/admin/kirkpatrick/interventions` with hidden `_token` (dummy) and: "Pelajar (ID)" `student_id` number required, placeholder "ID pelajar"; "Jenis Amaran" `alert_type` select required: `mood` "Mood / Kesejahteraan" (preselected), `inactive` "Tidak Aktif", `declining` "Prestasi Menurun"; "Tarikh Tindakan" `action_date` date required, default today ("2026-09-25"); "Penerangan Amaran" `alert_description` textarea rows 2 required, placeholder "Contoh: Pelajar tidak aktif selama 2 minggu"; "Tindakan Diambil" `action_taken` textarea rows 2 required, placeholder "Contoh: Hubungi pelajar melalui guru kelas"; "Ketepatan Sebelum (%)" `before_accuracy` number step 0.1, placeholder "0.0"; "Mood Sebelum" `before_mood` select ('' "-- Pilih --", `happy` "Gembira", `okay` "Okay", `sad` "Sedih", `stressed` "Tertekan"); "Ketepatan Selepas (%)" `after_accuracy` number step 0.1, placeholder "Isi selepas semakan"; "Mood Selepas" `after_mood` (same options). Layout: row 1 `grid-cols-1 md:grid-cols-3`; textareas full width; before/after `grid-cols-2 md:grid-cols-4`. `autocomplete=off` | S7-022–041 | Admin | SOURCE-DERIVED |
| FN-M12-8.2.3 | Submit "Simpan Intervensi" (`fa-save`, indigo-600). Validation is native `required` only (no custom alert, no "Batal", no reset — as the source) | S7-042 | Admin | SOURCE-DERIVED |
| FN-M12-8.2.4 | Save (INFERRED/provisional): a valid submit stores the record (recorded by the current user, timestamped) and reloads S7 with the panel closed, the KPIs and the list updated; no success message (none exists on live). Server validation beyond `required` (e.g. unknown student id) is UNVERIFIED: the prototype rejects an id that is not a T4/T5 student with the global error convention and PROPOSED COPY "Pelajar tidak dijumpai." (OQ-M12-09). There is no edit/update UI (live `…/{id}/edit` → 404; `{id}` GET → 405) | — | Admin | INFERRED / PROPOSED |
| FN-M12-8.3.1 | "Senarai Intervensi" (`fa-clipboard-list`): empty state `fa-clipboard-check`, "Tiada intervensi direkodkan lagi." The second live line "Klik "Ambil Tindakan" pada amaran di halaman Tingkah Laku untuk mula." points to a button that does not exist and is not rendered (DV-M12-01) | S7-043–046 | Admin | OBSERVED + DV-M12-01 |
| FN-M12-8.3.2 | Populated list (UNVERIFIED on live; PROPOSED layout, provisional): a table, newest first, with the form's own labels as headers — "Tarikh Tindakan", "Pelajar (ID)", "Jenis Amaran", "Penerangan Amaran", "Tindakan Diambil", "Ketepatan Sebelum (%)", "Ketepatan Selepas (%)" — and a status pill using the KPI labels ("Menunggu Semakan" amber, "Meningkat" green, "Menurun" red); moods shown after the accuracy as the option labels; scrolls inside its card | — | Admin | PROPOSED |

### EP-M12-9 — Student Kirkpatrick detail (S8 `/admin/kirkpatrick/pelajar/{id}`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M12-9.1.1 | Container `max-w-5xl mx-auto px-4 py-6` (gray palette). Header: h1 "{nama}", "{sekolah} · Tingkatan {n}", link "← Kembali ke Tahap 3" → `/admin/kirkpatrick/behavior` | S8-001–003 | Admin | OBSERVED |
| FN-M12-9.1.2 | Entry points and ids: linked from the M11 monitoring school page (`/…/monitoring/sekolah/{id}`) rows of students without M11 answers (M11 FR-58); no M12 screen links to S8 (as live). Live uses two ids for the observed students (S8 / M11 "kirkpatrick" link id 4664 and 4644; S5 monitoring-link id 5571 and 5551). The rebuild keeps **one M02 id per student** — the id M11 links (4664, 4644); the S5 links of those two rows use it (DV-M12-25). `/admin/kirkpatrick/pelajar/5571` and `/5551` give the 403 page, **as live** (FR-M12-17); **v1.6:** both ids exist as generated users in M01/M02 and S8 refuses them explicitly (permanent; the M02 owner agreed), not because they are unknown. The `/guru/kirkpatrick/pelajar/{id}` twin renders the same page | — | Admin | OBSERVED + DV-M12-25 |
| FN-M12-9.2.1 | Gradient card (indigo → purple, white): round "AI" badge, "ALESA — Analisis Tingkah Laku Kirkpatrick", generated paragraph: "Penggunaan Prestasi Plus oleh {nama} masih pada tahap minimum dengan hanya {d} hari aktif. Disarankan untuk meningkatkan kekerapan latihan bagi melihat peningkatan prestasi." + optional "Ketepatan jawapan pada {x}% menunjukkan pemahaman yang baik." (present at 73.1%, absent at 38.6%; threshold INFERRED, PROPOSED 70%) + "Subjek terkuat: {subjek} ({x}%)." (observed with 3 and 4 active days; the wording for other usage levels is UNVERIFIED — prototype keeps the observed sentence) | S8-004–006, 053 | Admin | OBSERVED / INFERRED |
| FN-M12-9.2.2 | Four tiles: "Soalan" (answers in scope), "Ketepatan" (1 decimal), "Konsistensi" (0–100 score, formula unobservable, stored), "Streak" ("{n}d", consecutive active days) — 219 / 73.1% / 22.5 / 1d and 70 / 38.6% / 21.1 / 1d | S8-007–014, 054 | Admin | OBSERVED |
| FN-M12-9.2.3 | Line "Terkuat: **{subjek} ({x}%)** · Perlu perhatian: **{subjek} ({x}%)**" = highest and lowest subject accuracy ("Sejarah (78.9%)" / "Matematik (16.7%)"; "Bahasa Melayu (60.0%)" / "Sejarah (0.0%)") | S8-015–017, 055, 056 | Admin | OBSERVED |
| FN-M12-9.3.1 | Card "Tahap 2 — Head Count" with heading "{tahun} — Head Count" (current year "2026") and one row per subject of the student's headcount (A→Z): "TOV:{mark}" (2 decimals) or "-" when no TOV (e.g. Pendidikan Islam "TOV:78.00"; the second student Bahasa Inggeris 20.00, Bahasa Melayu 60.00, Matematik 40.00, Pendidikan Islam 55.00, Sains 33.33, Sains Sukan 37.00) | S8-018–044, 057–064 | Admin | OBSERVED |
| FN-M12-9.4.1 | Card "Tahap 2 — Prestasi Platform": one row per practised subject, sorted by accuracy descending, "{x}% ({n})" (1 decimal) with a bar `h-2` of width x: `bg-green-500` at 78.9%, `bg-yellow-500` at 60.0% and 55.0%, `bg-red-400` at 40.0% and below (all 9 captured bars; bounds INFERRED: green ≥ 70, yellow 50–< 70, red < 50) | S8-045–052, 065–073 | Admin | OBSERVED / INFERRED (bounds) |
| FN-M12-9.5.1 | A student with no answers (the case M11 links to): header and cards render with "0" / "0%" / "0" / "0d", the Terkuat line and platform card empty, the Head Count card as data allows (UNVERIFIED; provisional — OQ-M12-04) | — | Admin | INFERRED |

### EP-M12-10 — Student view (S9 `/kirkpatrick`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M12-10.1.1 | `max-w-5xl` gray page inside the user-portal shell: h1 "Kirkpatrick — Prestasi Saya", "Perkembangan pembelajaran berdasarkan 4 Tahap Model Kirkpatrick"; no T1 card (as live) | S9-004, 005 | All logged-in | OBSERVED |
| FN-M12-10.1.2 | Card "Tahap 2 — Pembelajaran (Head Count)" / "Perkembangan gred mengikut subjek dari peperiksaan sekolah": with no headcount data, italic "Tiada data Head Count. Guru perlu muat naik keputusan peperiksaan." (OBSERVED). With data (UNVERIFIED): PROPOSED reuse of the S8 Head Count rows ("{subjek}" + "TOV:{mark}"), provisional | S9-006–009 | Pelajar; Admin | OBSERVED / PROPOSED |
| FN-M12-10.1.3 | Card "Tahap 3 — Rekod Aktiviti (30 Hari)": 30 day squares `w-6 h-6` (today − 29 … today), each `title="dd/mm: {n} soalan"` (answers of the viewer that day), colour by n: 0 gray-100; > 0 green-200 / green-400 / green-600 (thresholds unobservable, PROPOSED 1–9 / 10–29 / ≥ 30, OQ-M12-07); legend "Kurang" [gray-100, green-200, green-400, green-600] "Banyak"; squares wrap | S9-010–043 | All logged-in | OBSERVED / PROPOSED |
| FN-M12-10.1.4 | Card "Tahap 4 — Kesimpulan" (gray-50): "Mulakan latihan secara berkala di Prestasi Plus. Kajian Kirkpatrick menunjukkan pelajar yang konsisten berlatih mendapat keputusan yang lebih baik." (observed for no activity; other variants UNVERIFIED — the prototype shows this text for every viewer, provisional) | S9-044, 045 | All logged-in | OBSERVED |

### EP-M12-11 — Monthly feedback (S10 `/maklum-balas`, T1 data source)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M12-11.1.1 | Already answered this month: centred card, green circle with `fa-check`, "Terima Kasih!", "Anda sudah mengisi maklum balas untuk bulan ini. Sila kembali bulan depan.", button "Kembali ke Dashboard" → `/dashboard` | S10-004–007 | All logged-in | OBSERVED |
| FN-M12-11.1.2 | Form when not yet answered this month (UNVERIFIED on live; PROPOSED, provisional — OQ-M12-02): the same centred card with two required scales — NPS: 11 buttons "0" … "10" and satisfaction "1" … "5" — and a submit button; PROPOSED COPY: title "Maklum Balas Bulanan", questions "Berapa besar kemungkinan anda mengesyorkan PrestasiPlus kepada rakan? (0-10)" and "Tahap kepuasan anda terhadap PrestasiPlus (1-5)", button "Hantar". The scales are INFERRED from the T1 figures ("x/10", "x/5") | — | Pelajar; Guru; Admin | PROPOSED |
| FN-M12-11.1.3 | Submit (provisional): stores one FeedbackResponse (user, role, month, NPS, satisfaction); one response per user per calendar month (OBSERVED from the copy); afterwards the page shows the FN-11.1.1 state; T1 figures include the new response | — | Pelajar; Guru; Admin | INFERRED |

---

## 4. User stories

Values in the ACs come from the seed (SRS §6; admin figures = the live snapshot of 2026-09-25). "The admin" = `admin@demo.test` (id 1). "The teacher" = `guru@demo.test` (id 5). "The student" = `pelajar@demo.test` (id 2). "School 8080" = the observed Selangor school (184 T4/T5 students, 34 teachers). "Student A" = user 4664 (observed S8 default; T5 at school 8080; its second live id 5571 is the 8080 prediction row 19), "Student B" = user 4644 (observed S8 low state; 8080; second live id 5551, prediction row 50) — DV-M12-25. Mock clock 2026-09-25T15:40:00+08:00. Every AC runs at 375×812, 768×1024 and 1280×800 unless it names a width.

| ID | Feature | MoSCoW | Story | Functions |
|---|---|---|---|---|
| US-M12-01 | FT-M12-1.1 | Must | As an admin, I want the Kirkpatrick views in the admin menu, the "Lagi" drawer and the in-page tabs, with the right page titles, so that I can move between the four levels and know where I am. | FN-M12-1.1.1, 1.1.2, 1.1.5, 1.1.6, 1.1.7, 1.1.8, 1.1.9 |
| US-M12-02 | FT-M12-1.1 | Should | As an admin on a `/guru/kirkpatrick` page, I want the matching menu item highlighted, so that I know which view I am on. | FN-M12-1.1.4 |
| US-M12-03 | FT-M12-1.2 | Must | As the owner, I want M12 closed to guests, wrong URLs to show the standard error pages and unknown students to show the access page, so that the area behaves predictably. | FN-M12-1.2.1, 1.2.4, 1.2.5, 1.2.6, 1.2.7 |
| US-M12-04 | FT-M12-1.2 | Must | As a teacher, I want the same Kirkpatrick views under `/guru/kirkpatrick` from my "Kirkpatrick" menu, so that I can evaluate the platform too. (provisional) | FN-M12-1.1.3, 1.2.2, 1.2.3 |
| US-M12-05 | FT-M12-2.1 | Must | As an admin, I want to filter the overview by school and state and reset the filter, so that I can evaluate one school or state. | FN-M12-2.1.1, 2.1.2 |
| US-M12-06 | FT-M12-2.2 | Must | As an admin, I want one card per level with its headline figure and a link to its detail, so that I see the four levels at a glance. | FN-M12-2.2.1–2.2.5 |
| US-M12-07 | FT-M12-2.3 | Must | As an admin, I want the evaluation flow T1 → T4 with each level's figure, on desktop and phone, so that I understand the model and can open any level. | FN-M12-2.3.1–2.3.3 |
| US-M12-08 | FT-M12-2.4 | Must | As an admin, I want a before/after comparison of the first active month and the current month with a summary sentence, so that I can see the change since the platform started. | FN-M12-2.4.1–2.4.4 |
| US-M12-09 | FT-M12-2.5 | Must | As an admin, I want the headline KPIs, the engagement distribution and a short explanation of the model, so that I can read the platform's effectiveness. | FN-M12-2.5.1, 2.6.1, 2.7.1 |
| US-M12-10 | EP-M12-3 | Must | As an admin, I want the satisfaction (NPS by role and average satisfaction) of the platform, so that I can report Level 1. | FN-M12-3.1.1, 3.1.2 |
| US-M12-11 | EP-M12-4 | Must | As an admin, I want the learning KPIs and the Learning Gain explanation, for the platform or one school, so that I can report Level 2. | FN-M12-4.1.1, 4.1.2, 4.2.1 |
| US-M12-12 | EP-M12-4 | Must | As an admin, I want accuracy per subject with a mastery status, so that I can see strong and weak subjects. | FN-M12-4.3.1, 4.3.2 |
| US-M12-13 | EP-M12-4 | Must | As an admin, I want learning per school with a link to its monitoring page, so that I can compare schools. | FN-M12-4.4.1 |
| US-M12-14 | EP-M12-5 | Must | As an admin, I want the behaviour KPIs for the platform or one school, so that I can report Level 3. | FN-M12-5.1.1, 5.1.2, 5.2.1 |
| US-M12-15 | EP-M12-5 | Must | As an admin, I want the engagement bands of the T4/T5 students, so that I can see how many practise consistently. | FN-M12-5.3.1 |
| US-M12-16 | EP-M12-5 | Must | As an admin, I want engagement per school with its level, so that I can find schools that need help. | FN-M12-5.4.1 |
| US-M12-17 | EP-M12-5 | Must | As an admin, I want the activity pattern by weekday and hour, so that I know when students practise. | FN-M12-5.5.1 |
| US-M12-18 | EP-M12-5 | Must | As an admin, I want school alerts and the mood status, so that I can act on problems. | FN-M12-5.6.1, 5.7.1 |
| US-M12-19 | EP-M12-6 | Must | As an admin, I want the results KPIs (GPS, pass rate, grade A, accuracy, active students, records), so that I can report Level 4. | FN-M12-6.1.1, 6.1.2 |
| US-M12-20 | EP-M12-6 | Must | As an admin, I want the grade distribution of the latest headcount year, so that I see how candidates are spread. | FN-M12-6.2.1 |
| US-M12-21 | EP-M12-6 | Must | As an admin, I want GPS per subject and the GPS trend 2022–2026, so that I can see improvement. | FN-M12-6.3.1, 6.4.1 |
| US-M12-22 | EP-M12-6 | Must | As an admin, I want performance per school and an estimated grade for every active student, so that I can target support. | FN-M12-6.5.1, 6.6.1 |
| US-M12-23 | EP-M12-6 | Must | As an admin, I want the ALESA predicted grades with confidence and a recommendation, so that I know who needs intervention. | FN-M12-6.7.1–6.7.4 |
| US-M12-24 | EP-M12-6 | Must | As an admin, I want the ROI estimate and the insights with their disclaimer, so that I can present the results honestly. | FN-M12-6.8.1, 6.9.1 |
| US-M12-25 | EP-M12-7 | Must | As an admin, I want the impact chain across the four levels, so that I can show the evidence in one page. | FN-M12-7.1.1, 7.2.1–7.2.5 |
| US-M12-26 | EP-M12-7 | Must | As an admin, I want the usage-vs-accuracy correlation and the conclusions, so that I can support the claim of impact. | FN-M12-7.3.1, 7.3.2, 7.4.1 |
| US-M12-27 | EP-M12-7 | Should | As an admin, I want to download the chain as a report, so that I can share it. (provisional) | FN-M12-7.1.2 |
| US-M12-28 | EP-M12-8 | Must | As an admin, I want the intervention counts and the list of recorded interventions, so that I can follow up. | FN-M12-8.1.1, 8.3.1, 8.3.2 |
| US-M12-29 | EP-M12-8 | Must | As an admin, I want to record an intervention for a student with before/after accuracy and mood, so that its effect can be tracked. | FN-M12-8.2.1–8.2.4 |
| US-M12-30 | EP-M12-9 | Must | As an admin, I want a student's Kirkpatrick profile with the ALESA summary and key figures, so that I understand one student's behaviour. | FN-M12-9.1.1, 9.1.2, 9.2.1–9.2.3 |
| US-M12-31 | EP-M12-9 | Must | As an admin, I want the student's headcount marks and platform accuracy per subject, so that I can compare school and platform results. | FN-M12-9.3.1, 9.4.1, 9.5.1 |
| US-M12-32 | EP-M12-10 | Should | As a student, I want my own Kirkpatrick view (headcount, 30-day activity, conclusion), so that I can follow my progress. | FN-M12-10.1.1–10.1.4 |
| US-M12-33 | EP-M12-11 | Must | As a user, I want to give monthly feedback once a month and be thanked when I already did, so that the platform can measure satisfaction. (form provisional) | FN-M12-11.1.1–11.1.3 |
| US-M12-34 | FT-M12-1.1 | Must | As any user on a phone, tablet or desktop, I want every M12 screen to fit the screen without sideways page scrolling, so that I can use it anywhere. | FN-M12-1.1.10 |
| US-M12-35 | FT-M12-2.1 | Should | As an Admin Sekolah, I want the Kirkpatrick overview for my own school only, so that I can follow my school's results without seeing other schools. (v1.6, INFERRED) | FN-M12-2.1.2 |

### Acceptance criteria

**US-M12-01 — Menu, tabs and titles**
- **AC-M12-01.1** Given the admin at 1280 on `/admin/kirkpatrick/results`, when the page loads, then the sidebar group "KIRKPATRICK" (`fa-microscope`) is open with the 7 items "Overview", "T1: Reaksi", "T2: Pembelajaran", "T3: Tingkah Laku", "T4: Hasil", "Rantaian Impak", "Intervensi" (icons as FN-1.1.1) linking to the `/admin/kirkpatrick…` routes, "T4: Hasil" is active, and "Laporan" follows the group outside it.
- **AC-M12-01.2** Given the admin at 375, when I open "Lagi", then "Kirkpatrick" (`fa-microscope`) → `/admin/kirkpatrick` is listed.
- **AC-M12-01.3** Given S2, S3, S4, S5, S7, when each loads, then the tab strip shows "Overview", "T1: Reaksi", "T2: Pembelajaran", "T3: Tingkah Laku", "T4: Hasil", "Intervensi" (no "Rantaian Impak") with the current tab `bg-indigo-600 text-white`; S1 and S6 show no strip.
- **AC-M12-01.4** Given S1, S2, S3, S4, S5, S7, when each loads, then the header title/subtitle and tab title are exactly those of §1.
- **AC-M12-01.5** Given S6 and S8 (Student A), when each loads, then the header reads "Rantaian Impak" and "Kirkpatrick — Pelajar Demo 004664" with no subtitle, and the tab titles are "Kirkpatrick Impact Chain" and "Kirkpatrick — Pelajar Demo 004664" (DV-M12-03).
- **AC-M12-01.6** Given S9 and S10, when each loads, then the user-portal header reads "Kirkpatrick — Prestasi Saya" and "Maklum Balas" with no subtitle (DV-M12-03), and the tab titles are "Kirkpatrick — Prestasi Saya" and "Maklum Balas — PrestasiPlus".
- **AC-M12-01.7** Given the admin, when S1–S8 load on either prefix, then the admin-panel shell ("Panel Pentadbir") renders; when S9/S10 load, then the user-portal shell renders.

**US-M12-02 — Active item on the `/guru` twins**
- **AC-M12-02.1** Given the admin at 1280 on `/guru/kirkpatrick/behavior`, when the page loads, then the admin sidebar group is open and "T3: Tingkah Laku" is active, as on `/admin/kirkpatrick/behavior` (DV-M12-12).
- **AC-M12-02.2** Given `/guru/kirkpatrick`, when it loads, then "Overview" is active.

**US-M12-03 — Access and errors**
- **AC-M12-03.1** Given no session, when I open `/admin/kirkpatrick`, `/guru/kirkpatrick/chain`, `/kirkpatrick` or `/maklum-balas`, then I am sent to `/login` (INFERRED).
- **AC-M12-03.2** Given the admin, when I open `/admin/kirkpatrick/pelajar`, `/admin/kirkpatrick/interventions/1/edit`, `/admin/kirkpatrick/survey`, `/admin/kirkpatrick/sekolah/8080` or `/feedback`, then the global 404 page "Halaman Tidak Dijumpai" renders.
- **AC-M12-03.3** Given the admin, when I open `/admin/kirkpatrick/interventions/1` or `/admin/kirkpatrick/interventions/create`, then the global 404 page renders (DV-M12-11) and no English "405 Method Not Allowed" text appears.
- **AC-M12-03.4** Given the admin, when I open `/admin/kirkpatrick/pelajar/99999999`, then the 403 page shows "403", "🚫", "Anda tidak mempunyai kebenaran untuk mengakses halaman ini. Sila log masuk dengan akaun yang betul atau hubungi pentadbir.", "Halaman Utama" → `/`, "Log Masuk" → `/login` and "PRESTASIPLUS".
- **AC-M12-03.5** Given the admin, when I open `/admin/kirkpatrick/reaction?school_id=8080` and `/admin/kirkpatrick/chain?school_id=8080`, then the content is identical to the unfiltered pages.
- **AC-M12-03.6** Given the admin, when I open `/admin/kirkpatrick?school_id=99999999` (provisional), then the page shows the zero state of AC-M12-05.4.

**US-M12-04 — Teacher twin (provisional)**
- **AC-M12-04.1** Given the teacher at 375 (provisional), when I open the user-portal drawer, then "Portal Guru" › "ANALITIK" has "Kirkpatrick" (`fa-microscope`) opening "Ringkasan" → `/guru/kirkpatrick`, "T1: Reaksi", "T2: Pembelajaran" (`fa-graduation-cap`), "T3: Tingkah Laku", "T4: Hasil", "Rantaian Impak", "Intervensi" under `/guru/kirkpatrick`; for the admin the same group exists but is hidden.
- **AC-M12-04.2** Given the admin, when I open each `/guru/kirkpatrick…` view, then its content equals the `/admin` twin and every in-page link, form action, "Reset", "← Kembali", the export link and the intervention form action start with `/admin/kirkpatrick`.
- **AC-M12-04.3** Given the teacher (provisional), when I open `/guru/kirkpatrick`, then the overview renders with the platform figures of AC-M12-06.1; when I click a tab (target `/admin/kirkpatrick/…`), then the M17/M01 non-admin rule applies (redirect to the M01 landing page, INFERRED).

**US-M12-05 — Overview filter**
- **AC-M12-05.1** Given S1, when it loads, then "Sekolah" lists "Semua Sekolah" + 57 schools A→Z, "Negeri" lists "Semua Negeri" + Johor, Kedah, Kelantan, Kuala Lumpur, Melaka, Pahang, Perak, Sabah, Selangor, Terengganu (v1.6: the 10 states stand; M02 moved school 1267 to Kedah, which changes no list), there is a "Tapis" button and no "Reset".
- **AC-M12-05.2** Given S1, when I choose school 8080 and click "Tapis", then the URL is `/admin/kirkpatrick?school_id=8080&state=`, the select keeps the school and "Reset" → `/admin/kirkpatrick` appears.
- **AC-M12-05.3** Given `?school_id=8080`, then the page shows T4 "4.00" (DV-M12-09) / "4378 rekod headcount", T3 "53/184" "1002 sesi · 75.6% ketepatan", T2 "75.6%" "15,007 soalan dijawab", T1 "4.6/5" "336 respon" (unchanged), KPIs 184 / 15,007 / 34/34 / 75.6%, bands 36 / 8 / 9 / 0 / 131 with 19.6% / 4.3% / 4.9% / 0% / 71.2%.
- **AC-M12-05.4** Given `?state=Kelantan`, then T3 "0/0" "0 sesi · 0% ketepatan", T2 "0%" "0 soalan dijawab", T4 stays "4.30", the comparison reads "Tiada Data vs Tiada Data", KPIs 0 / 0 / 0/0 / 0%, bands all "0" "0%".
- **AC-M12-05.5** Given 375, when S1 loads, then the "Sekolah" select fits within the card, the page has no horizontal scroll, and both selects are at least 36 px tall (DV-M12-07).

**US-M12-06 — Level cards**
- **AC-M12-06.1** Given S1 unfiltered, then the level cards read, in order: "Tahap 4: Hasil" "4.30" "GPS Sekolah · 4378 rekod headcount"; "Tahap 3: Tingkah Laku" "946" "/4158" "Pelajar aktif · 20991 sesi · 82.8% ketepatan" (DV-M12-08); "Tahap 2: Pembelajaran" "82.8%" "Ketepatan · 306,133 soalan dijawab"; "Tahap 1: Reaksi" "4.6" "/5" "Kepuasan purata · 336 respon", each with "Lihat detail".
- **AC-M12-06.2** Given the cards, when I click each, then I reach `/admin/kirkpatrick/results`, `/behavior`, `/learning`, `/reaction`.
- **AC-M12-06.3** Given 375 the cards are 1 column; given 768, 2 columns; given 1280, 4 columns.
- **AC-M12-06.4** Given `/admin/kirkpatrick?school_id=9167` (a school without SPM history), then the T4 card shows "Belum Ada Data" and "Import keputusan peperiksaan" with no GPS value and no "rekod headcount" caption, and the flow pill reads "GPS -" (circles at 768/1280, list at 375).

**US-M12-07 — Evaluation flow**
- **AC-M12-07.1** Given 768 or 1280, then the flow shows 4 linked circles "T1: Reaksi" "Kepuasan pengguna" "4.6/5", "T2: Pembelajaran" "Peningkatan kemahiran" "82.8% ketepatan", "T3: Tingkah Laku" "Konsistensi penggunaan" "946 pelajar aktif", "T4: Hasil" "Keputusan peperiksaan" "GPS 4.30", and the hint "Klik mana-mana tahap untuk lihat detail".
- **AC-M12-07.2** Given 375, then the same 4 entries show as a vertical list with a chevron and link to the same pages.
- **AC-M12-07.3** Given `?school_id=8080` at 1280, then the pills read "75.6% ketepatan", "53 pelajar aktif", "GPS 4.00".

**US-M12-08 — Before / after**
- **AC-M12-08.1** Given S1 unfiltered, then the card reads "Januari 2026 vs September 2026"; "SEBELUM" "01 Jan 2026 - 31 Jan 2026" 2 / 33.3% / 3 / 0; "SELEPAS" "01 Sep 2026 - 25 Sep 2026" 58 / 87% / 13,968 / 28, under the labels "Pelajar Aktif", "Ketepatan", "Jumlah Jawapan", "Champion".
- **AC-M12-08.2** Given the delta tiles, then they read "+56", "+53.7%", "+13965", "+28" in green with `fa-arrow-up`.
- **AC-M12-08.3** Given the summary, then "Ringkasan:" reads "Peningkatan 53.7% dalam ketepatan jawapan. 56 pelajar baru mula aktif. Jumlah jawapan meningkat 465500%. 28 pelajar naik ke tahap Champion."
- **AC-M12-08.4** Given `?school_id=8080`, then the subtitle is "April 2026 vs September 2026", "SEBELUM" reads "01 Apr 2026 - 30 Apr 2026" with 12 / "71.6%" / 511 / 3, "SELEPAS" "01 Sep 2026 - 25 Sep 2026" with 1 / "55%" / 60 / 1, the tiles "-11", "-16.6%", "-451", "-2" are red with `fa-arrow-down`, and the summary is "Penurunan 16.6% dalam ketepatan jawapan. 11 pelajar kurang aktif berbanding sebelumnya."
- **AC-M12-08.5** Given `?state=Kelantan`, then the subtitle is "Tiada Data vs Tiada Data", both ranges "-", and the summary "Data tidak mencukupi untuk perbandingan."
- **AC-M12-08.6** Given 375, then the two panels stack and the delta tiles are 2 × 2.

**US-M12-09 — KPIs, distribution, info**
- **AC-M12-09.1** Given S1, then the KPI links read "Pelajar Berdaftar (T4/T5)" "4,158" → `/admin/monitoring`, "Soalan Dijawab" "306,133" → `/admin/kirkpatrick/learning`, "Guru Aktif" "277/522" → `/admin/monitoring`, "Ketepatan Keseluruhan" "82.8%" → `/admin/kirkpatrick/learning`.
- **AC-M12-09.2** Given "Taburan Engagement Pelajar", then the 5 links → `/admin/kirkpatrick/behavior` read "513 Champion 12.3%", "259 Konsisten 6.2%", "169 Berkembang 4.1%", "5 Minimum 0.1%", "3212 Tidak Terlibat 77.2%" (DV-M12-08), and the five counts sum to 4,158.
- **AC-M12-09.3** Given the info card, then it shows "Model Kirkpatrick — 4 Tahap Penilaian Keberkesanan" and the exact text of FN-2.7.1.
- **AC-M12-09.4** Given 375, then the engagement tiles stay 5 columns within the card and the page has no horizontal scroll.

**US-M12-10 — T1 Reaksi**
- **AC-M12-10.1** Given S2, then the cards read "NPS Pelajar" "8.4/10", "NPS Guru" "6.5/10", "NPS Admin" "9.6/10", "Kepuasan Purata" "4.6/5", and there is no filter, count, breakdown or survey link.
- **AC-M12-10.2** Given `?school_id=8080` or `?state=Kelantan` on S1, S2 or S6, then every T1 figure is unchanged.
- **AC-M12-10.3** Given the student submits feedback NPS 10 and satisfaction 5 (provisional, AC-M12-33.3), when the admin reopens S2, then "NPS Pelajar" is recomputed over 312 responses ("8.4/10") and S1 reads "337 respon".

**US-M12-11 — T2 KPIs and Learning Gain**
- **AC-M12-11.1** Given S3, then the KPIs read "Soalan Dijawab" "306,133", "Ketepatan" "82.8%", "Skor Purata" "80.3%", "Sesi Selesai" "20991" "/20991", "Kadar Penyelesaian" "100%", "Learning Gain" "-" with "Perlu pre/post test".
- **AC-M12-11.2** Given `/admin/kirkpatrick/learning?school_id=8080`, then the KPIs read 15,007 / 75.6% / 73.3% / 1002 "/1002" / 100%, and the page has no filter form.
- **AC-M12-11.3** Given S3, then the dashed card shows "Pre-Test / Post-Test belum dimulakan", the Hake sentence and the formula line of FN-4.2.1.
- **AC-M12-11.4** Given 375 the KPI cards are 2 columns; 768, 3; 1280, 6.

**US-M12-12 — Subjects**
- **AC-M12-12.1** Given S3, then "Prestasi Mengikut Subjek" has the 26 rows of SRS §6.9 in accuracy-descending order, each with name, bar label (1 decimal), status pill and "{n} soalan", the "{n}" values sum to 306,133, 15 rows are "Mastered" and 11 "Developing"; e.g. "Pendidikan Muzik" "100.0%" "Mastered" "20 soalan", "Reka Bentuk & Teknologi" "99.3%" "Mastered" "461 soalan", "Ekonomi" "79.1%" "Developing" "2333 soalan", "Sejarah" "76.3%" "Developing" "57695 soalan", "Fizik" "63.9%" "Developing" "5291 soalan" (last row).
- **AC-M12-12.2** Given `?school_id=8080`, then the 24 rows of SRS §6.9 show (11 Mastered, 10 Developing, 3 Beginning), first "Bahasa Cina" "100.0%" "10 soalan", including "Bahasa Melayu" "80.6%", "Matematik" "51.5%", and "Bahasa Arab" "45.0%" "20 soalan", "Matematik Tambahan" "40.0%" "10 soalan" and "Biologi" "33.3%" "30 soalan" as "Beginning" (red bar and pill).
- **AC-M12-12.3** Given a subject row, when I hover or click it, then the cursor is the default one, no "Klik untuk lihat detail" tooltip appears and nothing happens (DV-M12-05).

**US-M12-13 — Learning per school**
- **AC-M12-13.1** Given S3, then the table has the headers # · Sekolah · Pelajar · Soalan · Ketepatan · Skor Purata · Subjek and 33 rows by Ketepatan descending (ties by school id) with the first link `/admin/monitoring/sekolah/8880`; the links include `/8106`, `/8107`, `/8098`, `/8228`, `/940`; Ketepatan is green-600 at ≥ 70, amber-600 at 50–69.9, red-600 below 50; 16 green, 7 amber and 10 red rows; the 8080 row reads 184 · 15,007 · 75.6% · 73.3% · 3.
- **AC-M12-13.2** Given the schools with 0 answers (940, 987, 995, 8198, 8284, 8302, 8308, 9801, 10220), then each row shows 0 / 0% / 0% — school 940 included (DV-M12-15; live 90%) — and 940 shows "Subjek" 1.
- **AC-M12-13.3** Given 375, then the table scrolls inside its card and the page does not.

**US-M12-14 — T3 filter and KPIs**
- **AC-M12-14.1** Given S4, then the filter shows "Sekolah" and "Tapis" only; the KPIs read "Pelajar T4/T5" "4,158", "Pernah Aktif" "946" (DV-M12-08), "Jumlah Sesi" "20991", "Soalan Dijawab" "306,133", "Ketepatan" "82.8%", "Guru Aktif" "53.1%" "277/522".
- **AC-M12-14.2** Given S4 with school 8080 applied by "Tapis", then the URL is `/admin/kirkpatrick/behavior?school_id=8080`, "Reset" → `/admin/kirkpatrick/behavior` appears and the KPIs read 184 / 53 / 1002 / 15,007 / 75.6% / "100%" "34/34".
- **AC-M12-14.3** Given 375, then the select fits in the card, is at least 36 px tall and the page has no horizontal scroll (DV-M12-07).
- **AC-M12-14.4** Given `/admin/kirkpatrick/behavior?school_id=9167` (8 T4/T5 students, one of whom has only served-but-unanswered questions), then "Pernah Aktif" equals the table row's "Aktif" (5), "Soalan Dijawab" equals the row's "Soalan", and the five band tiles sum to 8 (DV-M12-08; live shows KPI 6 / 545 beside row 6 / 555 and bands summing to 7). On `/admin/kirkpatrick/results?school_id=9167`, "Pelajar Aktif" equals the row's "Aktif" and the prediction list has that many rows.

**US-M12-15 — Engagement bands**
- **AC-M12-15.1** Given S4, then the 5 tiles read "513 Champion >50 soalan 12.3%", "259 Konsisten 20-50 soalan 6.2%", "169 Berkembang 5-20 soalan 4.1%", "5 Minimum <5 soalan 0.1%", "3212 Tidak Terlibat 0 soalan 77.2%" (DV-M12-08), each → `/admin/monitoring`, with mini bars of the same width as the %.
- **AC-M12-15.2** Given `?school_id=8080`, then the tiles read 36 / 8 / 9 / 0 / 131 with 19.6% / 4.3% / 4.9% / 0% / 71.2%.
- **AC-M12-15.3** Given the band rule, when a student has exactly 20 answers, then the student counts as Konsisten; 5 → Berkembang; 0 → Tidak Terlibat (INFERRED, checked on the mock).

**US-M12-16 — Engagement per school**
- **AC-M12-16.1** Given S4, then the table has the headers # · Sekolah · Pelajar · Aktif · Soalan · Sesi · Purata/Aktif · Skor · Tahap and 33 rows sorted by Skor descending, the first row linking to `/admin/monitoring/sekolah/9681`; 8 rows Champion, 7 Konsisten, 2 Berkembang, 4 Minimum, 3 Tidak Terlibat with activity and 9 rows with Aktif "0" (slate-300); the Tahap pill is white text on the tahap colour; the Aktif column sums to 946 and the Soalan column to 306,133 (DV-M12-08); the 8080 row reads 184 · 53 · 15,007 · 1002 · 283.2 · 62.4 · Konsisten; the 940 row reads 1 · 0 · 0 · 1 · 0 · 2 · Tidak Terlibat.
- **AC-M12-16.2** Given 375, then the table scrolls inside its card.

**US-M12-17 — Heat map**
- **AC-M12-17.1** Given S4, then "Corak Masa Aktiviti" / "Bilangan soalan dijawab mengikut jam dan hari" shows columns 06–23 and rows Isnin … Ahad; each cell has `title="{Hari} {HH}:00 — {n} soalan"`; "Selasa 14:00 — 6253 soalan" has alpha 1 and "Isnin 06:00 — 944 soalan" alpha 0.15 (the two platform cells observed on both days; the other platform cells are reference values, not asserted); given `?school_id=8080` (unchanged between captures), then the 126 observed 8080 values show, the largest cell is 736 and the 43 zero cells are `#f1f5f9` and empty.
- **AC-M12-17.2** Given 375, then the heat table scrolls inside its card with 20 px cells.

**US-M12-18 — Alerts and mood**
- **AC-M12-18.1** Given S4, then "Amaran & Pemerhatian" lists exactly 35 items in this order: 22 red "{sekolah}: {n} pelajar tidak pernah login langsung." for schools 940, 1014, 7780, 8030, 8087, 8090, 8098, 8102, 8107, 8198, 8228, 8277, 8298, 8302, 8308, 8765, 8767, 8772, 8965, 9167, 9801, 9806 with n = 1, 4, 6, 8, 257, 205, 1, 759, 674, 1, 5, 148, 2, 1, 1, 16, 8, 7, 7, 8, 1, 6; then red "2 guru telah login tetapi tiada pelajar yang menjawab soalan." for school 10220; then 12 green "{x}% pelajar aktif menjawab soalan. Tahniah!" for 7780 83.3%, 8030 87.5%, 8098 100%, 8228 80%, 8300 100%, 8767 87.5%, 8772 71.4%, 8880 54.7%, 8965 85.7%, 9167 62.5% (DV-M12-08; live 75%), 9681 100%, 9806 83.3%; no item has a button; school 8298 (1 of 2 = 50%) has no green item.
- **AC-M12-18.2** Given `?school_id=8080`, then the alerts card is absent.
- **AC-M12-18.3** Given S4, then the mood card shows "💭", "Data Mood Belum Mencukupi" and "Pelajar perlu check-in mood harian untuk analisis kesejahteraan vs prestasi."
- **AC-M12-18.4** Given `?school_id=9167`, then the alerts card holds one red item "{sekolah}: 8 pelajar tidak pernah login langsung." followed by one green item "{sekolah}: 62.5% pelajar aktif menjawab soalan. Tahniah!".

**US-M12-19 — T4 KPIs**
- **AC-M12-19.1** Given S5, then the KPI cards read "GPS Headcount" "4.30" "41 rekod · 2025"; "Kadar Lulus" "96.7%" "174/180 calon" (DV-M12-16); "Pelajar Gred A" "52" "28.9% daripada 180"; "Ketepatan Platform" "82.8%" "306,133 soalan"; "Pelajar Aktif" "946" "22.8% daripada 4,158"; "Rekod Headcount" "4378" "Data OTR".
- **AC-M12-19.2** Given `/admin/kirkpatrick/results?school_id=8080`, then they read "4.00" "41 rekod · 2026" (DV-M12-09), "100%" "1/1 calon", "0" "0% daripada 1", "75.6%" "15,007 soalan", "53" "28.8% daripada 184", "4378".
- **AC-M12-19.3** Given `/admin/kirkpatrick/results?school_id=9167`, then "GPS Headcount" reads "-" with the caption "41 rekod" (DV-M12-28), "Kadar Lulus" "0%" "0/0 calon", "Pelajar Gred A" "0" "0% daripada 0", "Pelajar Aktif" "5" "62.5% daripada 8"; no "Taburan Gred" card is rendered; ROI "GPS Headcount" reads "-"; "Pemerhatian & Insight" has no "GPS keseluruhan" sentence and still shows the disclaimer.
- **AC-M12-19.4** *(v1.6, DV-M12-29; INFERRED)* Given `/admin/kirkpatrick/results?school_id=8880`, then "GPS Headcount" reads "2.88" with the year 2026, no "Taburan Gred" card is rendered, "Kadar Lulus" and "Pelajar Gred A" read "-" each with the caption "150 calon" (PROPOSED copy) and the text "0/0 calon" does not appear; ROI "GPS Headcount" reads "2.88".

**US-M12-20 — Grade distribution**
- **AC-M12-20.1** Given S5, then "Taburan Gred (2025)" / "Berdasarkan 180 calon — sumber: Headcount OTR" lists A+ 10 5.6%, A 18 10%, A- 24 13.3%, B+ 32 17.8%, B 32 17.8%, C+ 26 14.4%, C 21 11.7%, D 11 6.1%, E 5 2.8%, G 1 0.6%, each row `title` "A+: 10 pelajar (5.6%)" … "G: 1 pelajar (0.6%)", the B+ and B bars at full width.
- **AC-M12-20.2** Given `?school_id=8080`, then "Taburan Gred (2026)" / "Berdasarkan 1 calon — sumber: Headcount OTR" shows "B+: 1 pelajar (100%)" and every other grade "0 pelajar (0%)".

**US-M12-21 — Subject GPS and trend**
- **AC-M12-21.1** Given S5, then "GPS Mengikut Subjek (2026)" lists Matematik 2.50 A- 30, Bahasa Melayu 2.80 A- 30, Sains 2.90 A- 30, Sejarah 3.00 A- 30, Bahasa Inggeris 3.20 B+ 30 with the trend arrow and 4.45 / 4.00 / 4.70 / 4.50 / 4.30, the note "GPS rendah = lebih baik. Trend: berbanding tahun sebelumnya.", and the subject cells are not clickable and have no title (DV-M12-05).
- **AC-M12-21.2** Given "Trend GPS (2022–2026)", then the rows read exactly as FN-6.4.1, values ≤ 4.00 green-600 and > 4.00 amber-600, both "-" cells slate-300 (DV-M12-14), and the legend "= GPS menurun (improving). Sumber: Headcount OTR & SPM sebenar." follows the up-arrow icon.
- **AC-M12-21.3** Given `?school_id=8080`, then "GPS Mengikut Subjek (2026)" and "Trend GPS (2022–2026)" show the same platform rows and values as AC-M12-21.1/21.2, including the 2026 column (DV-M12-26; live headings "(2025)" / "(2022–2025)").
- **AC-M12-21.4** Given 375, then both tables scroll inside their cards.

**US-M12-22 — Schools and predictions**
- **AC-M12-22.1** Given S5, then "Prestasi Mengikut Sekolah (Platform + Headcount)" has 33 rows by Engagement descending with the first link `/admin/monitoring/sekolah/9681`, 24 active rows with Tahap pills 8 Champion / 7 Konsisten / 2 Berkembang / 4 Minimum / 3 Tidak Terlibat and 9 inactive rows; schools with Aktif 0 are faded (`opacity-50`) with "-" for Ketepatan, Soalan and Engagement.
- **AC-M12-22.2** Given "Ramalan Prestasi Pelajar Aktif", then the table has 946 rows (no pager) with accuracy non-increasing from top to bottom (the order within equal accuracies is not asserted); each Pelajar link → `/admin/monitoring/sekolah/{sid}/pelajar/{id}` and Sekolah link → `/admin/monitoring/sekolah/{sid}`; (v1.7: the former assertion "first row belongs to school 8090" is removed — the tie order is unobservable, live sorts ties by internal pupil id, SRS BR-M12-21); the grade pills split 512 A-band (A+/A/A-, #15803d), 206 B-band, 104 C-band, 95 D/E and 29 G; a row at 90.0% shows "A+", 89.9% "A", 70.0% "A-", 49.6% "D", 39.5% "E", 29.4% "G"; the footnote is shown.
- **AC-M12-22.3** Given `?school_id=8080`, then the school table has 1 row and the prediction table the 53 observed 8080 rows (SRS §6.9) in accuracy order, row 19 being Student A (219, 73.1%, A-) and row 50 Student B (70, 38.6%, E).

**US-M12-23 — ALESA**
- **AC-M12-23.1** Given S5, then "Ramalan ALESA (Predictive Grade)" shows a visible heading icon (DV-M12-06), the subtitle of FN-6.7.1, the tiles "48 Dijangka Lulus", "2 Dijangka Gagal", "4 Perlu Intervensi", and a 50-row table with 6 A+, 16 A, 9 A-, 9 B+, 3 B, 1 C+, 2 C, 2 D, 2 E rows in that grade order, Keyakinan 38 "Rendah" / 10 "Sederhana" / 2 "Tinggi".
- **AC-M12-23.2** Given the rows, then the Cadangan of an A-band row is "Teruskan konsistensi latihan. Fokus pada topik yang masih lemah untuk capai kecemerlangan.", B-band "Tingkatkan latihan harian. Perlu tambah 20-30 soalan/minggu untuk naik ke gred A.", C-band "Pelajar ini perlu meningkatkan jumlah latihan. Cadangan: minimum 10 soalan sehari.", D/E "Pelajar memerlukan intervensi segera. Cadangan: bimbingan guru dan program pemulihan."
- **AC-M12-23.3** Given the footer, then it reads "48 pelajar dijangka lulus, 4 pelajar perlu intervensi segera. Ramalan ini berdasarkan formula berwajaran: Ketepatan (40%), Konsistensi (20%), Trend (20%), Volume (20%)." with "48 pelajar dijangka lulus" in bold.
- **AC-M12-23.4** Given `?school_id=8080`, then the ALESA table lists the school's own 50 stored rows (50 of its 53 active students; Student A not among them, Student B row 47 with grade C and the D/E Cadangan), grade counts A+ 3, A 9, A- 11, B+ 13, B 7, C+ 3, C 1, E 3, rows within a grade by user id ascending, the tiles 47 / 3 / 3 computed from those rows and the footer "47 pelajar dijangka lulus, 3 pelajar perlu intervensi segera. …".

**US-M12-24 — ROI and insights**
- **AC-M12-24.1** Given S5, then "ROI Platform (Anggaran)" reads "Pelajar Aktif" 946, "Purata Soalan/Pelajar" 323.6, "Ketepatan Aktif" 82.8%, "GPS Headcount" 4.30 and the box "ROI penuh akan dapat dikira apabila:" with its 3 ordered items.
- **AC-M12-24.2** Given "Pemerhatian & Insight", then it reads "Hanya 946 daripada 4158 pelajar T4/T5 (22.8%) menggunakan platform. Data perbandingan terhad kepada pelajar aktif sahaja." (DV-M12-13), "Purata ketepatan pelajar aktif dalam platform: 82.8%. Ini bersamaan anggaran gred A.", "GPS keseluruhan dari headcount (tahun 2025): 4.30. Trend menunjukkan peningkatan dari tahun ke tahun." and the disclaimer.
- **AC-M12-24.3** Given `?school_id=8080`, then the insights read "Hanya 53 daripada 184 pelajar T4/T5 (28.8%) …", "… 75.6%. Ini bersamaan anggaran gred A-." and "… (tahun 2026): 4.00. Trend menunjukkan peningkatan dari tahun ke tahun."; ROI "Ketepatan Aktif" 75.6%.

**US-M12-25 — Chain levels**
- **AC-M12-25.1** Given S6, then the header shows "Model Kirkpatrick — Rantaian Impak", "Bukti keberkesanan Prestasi Plus berdasarkan 4 Tahap Kirkpatrick", "Muat Turun Laporan" and "← Kembali" → `/admin/kirkpatrick`, and no tab strip.
- **AC-M12-25.2** Given the cards, then T1 "Reaksi" "Kepuasan pengguna terhadap Prestasi Plus" NPS Purata "8.3/10", Kepuasan "4.6/5", Responden "336"; T2 "Pembelajaran" "Perkembangan akademik melalui Head Count" 82.8% / 306,133 / 80.3%; T3 "Tingkah Laku" "Konsistensi penggunaan platform (Mastery Learning)" "946/4158 (22.8%)", "Sesi Latihan" "20,991", "Taburan Konsistensi:" Champion 513, Consistent 259, Developing 169, Minimal 5, Disengaged 3212 (DV-M12-08); T4 "Hasil / Impak" "Korelasi penggunaan dengan pencapaian" GPS 4.30, "Korelasi (r)" 0.1298, "Kekuatan" "Lemah"; T1/T2 green, T3/T4 yellow.
- **AC-M12-25.3** Given 375, then the cards stack in 1 column and no "→" is shown; given 1280, 4 columns with "→" between them.

**US-M12-26 — Correlation and conclusions**
- **AC-M12-26.1** Given S6, then the correlation table has exactly 3 rows "1-20 soalan" 215 59.7% (yellow bar), "51-100 soalan" 149 68.7% (green), "100+ soalan" 348 75.2% (green) (DV-M12-02).
- **AC-M12-26.2** Given the boxes, then "Kesimpulan ALESA:" and the sentence of FN-7.3.2, and "Kesimpulan Model Kirkpatrick" with the static text of FN-7.4.1, render exactly.

**US-M12-27 — Report download (provisional)**
- **AC-M12-27.1** Given S6, when I click "Muat Turun Laporan", then `/admin/kirkpatrick/export-pdf` opens in a new tab and returns a PDF (PROPOSED content: the S6 figures; provisional).

**US-M12-28 — Intervention counts and list**
- **AC-M12-28.1** Given S7 with the seed (no interventions), then the KPIs read "Jumlah Intervensi" 0, "Menunggu Semakan" 0, "Meningkat" 0, "Menurun" 0, and "Senarai Intervensi" shows "Tiada intervensi direkodkan lagi." without the "Ambil Tindakan" sentence (DV-M12-01).
- **AC-M12-28.2** Given two recorded interventions (provisional), one without "Ketepatan Selepas (%)" and one with before 40.0 / after 55.5, then the KPIs read 2 / 1 / 1 / 0 and the list shows 2 rows, newest first, with the status pills "Meningkat" and "Menunggu Semakan" (PROPOSED layout).
- **AC-M12-28.3** Given 375, then the KPI cards are 2 × 2 and the list scrolls inside its card.

**US-M12-29 — Record an intervention**
- **AC-M12-29.1** Given S7, then the panel "Rekod Intervensi Baru" is closed; when I click its header, then the form opens and the chevron rotates; when I click again, then it closes (DV-M12-01); the header button is at least 36 px tall.
- **AC-M12-29.2** Given the open form, then it shows the 9 fields of FN-8.2.2 with their labels, placeholders, options ("Mood / Kesejahteraan" preselected, "-- Pilih --" first in the mood selects) and "Tarikh Tindakan" preset to 2026-09-25, and "Simpan Intervensi".
- **AC-M12-29.3** Given the open form, when I click "Simpan Intervensi" with "Pelajar (ID)" empty, then the browser's native required message blocks the submit and nothing is stored.
- **AC-M12-29.4** Given student id 4664, "Tidak Aktif", the two texts and before 73.1 (provisional), when I click "Simpan Intervensi", then S7 reloads with the panel closed, "Jumlah Intervensi" 1, "Menunggu Semakan" 1 and the new row in the list.
- **AC-M12-29.5** Given student id 99999999 (provisional), when I submit, then the record is not stored and the error "Pelajar tidak dijumpai." (PROPOSED COPY) shows next to "Pelajar (ID)".
- **AC-M12-29.6** Given 375, then the form is 1 column and the before/after fields 2 columns; given 1280, row 1 has 3 columns and before/after 4.

**US-M12-30 — Student detail**
- **AC-M12-30.1** Given `/admin/kirkpatrick/pelajar/4664`, then the page shows h1 "Pelajar Demo 004664", "{school 8080 name} · Tingkatan 5", "← Kembali ke Tahap 3" → `/admin/kirkpatrick/behavior`, the "AI" badge and "ALESA — Analisis Tingkah Laku Kirkpatrick".
- **AC-M12-30.2** Given Student A, then the paragraph reads "Penggunaan Prestasi Plus oleh Pelajar Demo 004664 masih pada tahap minimum dengan hanya 4 hari aktif. Disarankan untuk meningkatkan kekerapan latihan bagi melihat peningkatan prestasi. Ketepatan jawapan pada 73.1% menunjukkan pemahaman yang baik. Subjek terkuat: Sejarah (78.9%)."; the tiles 219 / 73.1% / 22.5 / "1d"; "Terkuat: Sejarah (78.9%) · Perlu perhatian: Matematik (16.7%)".
- **AC-M12-30.3** Given Student B (4644), then the paragraph has "3 hari aktif", no "Ketepatan jawapan pada …" sentence and "Subjek terkuat: Bahasa Melayu (60.0%)."; the tiles 70 / 38.6% / 21.1 / "1d"; "Terkuat: Bahasa Melayu (60.0%) · Perlu perhatian: Sejarah (0.0%)".
- **AC-M12-30.4** Given the M11 school page of Student A's school, when I click a row of a student without answers, then S8 of that student opens (M11 link).
- **AC-M12-30.5** Given the second live ids, when I open `/admin/kirkpatrick/pelajar/5571` or `/admin/kirkpatrick/pelajar/5551`, then the 403 page of AC-M12-03.4 renders (as live; v1.6: the two ids exist as generated users in M01/M02 and S8 refuses them explicitly); on S5 `?school_id=8080` the Pelajar links of rows 19 and 50 point to `/admin/monitoring/sekolah/8080/pelajar/4664` and `/4644` (DV-M12-25; live `/5571` and `/5551`).

**US-M12-31 — Head Count and platform**
- **AC-M12-31.1** Given Student A, then "Tahap 2 — Head Count" / "2026 — Head Count" lists Bahasa Inggeris, Bahasa Melayu, Matematik, Pendidikan Islam "TOV:78.00", Pendidikan Jasmani & Kesihatan, Pendidikan Moral, Perniagaan, Pertanian, Prinsip Perakaunan, Sains, Sains Komputer, Sejarah, each other value "-"; "Tahap 2 — Prestasi Platform" lists Sejarah "78.9% (190)" (`bg-green-500`), Sains "39.1% (23)" and Matematik "16.7% (6)" (`bg-red-400`).
- **AC-M12-31.2** Given Student B, then the Head Count rows read Bahasa Inggeris "TOV:20.00", Bahasa Melayu "TOV:60.00", Matematik "TOV:40.00", Pendidikan Islam "TOV:55.00", Pendidikan Jasmani & Kesihatan "-", Pendidikan Moral "-", Pertanian "-", Sains "TOV:33.33", Sains Rumah Tangga "-", Sains Sukan "TOV:37.00", Sejarah "-"; the platform rows "60.0% (5)" Bahasa Melayu and "55.0% (20)" Pendidikan Islam (`bg-yellow-500`), "40.0% (15)" Matematik, "33.3% (15)" Sains, "20.0% (10)" Bahasa Inggeris, "0.0% (5)" Sejarah (`bg-red-400`).
- **AC-M12-31.3** Given a T4/T5 student with no answers (provisional), then S8 renders with "0", "0%", "0" and "0d" and an empty platform card.
- **AC-M12-31.4** Given 375, then the header stacks, the tiles are 2 × 2 and the two cards stack.

**US-M12-32 — Student view**
- **AC-M12-32.1** Given the admin on `/kirkpatrick`, then the page shows "Kirkpatrick — Prestasi Saya", "Perkembangan pembelajaran berdasarkan 4 Tahap Model Kirkpatrick", the Head Count card with "Tiada data Head Count. Guru perlu muat naik keputusan peperiksaan.", 30 gray squares titled "27/08: 0 soalan" … "25/09: 0 soalan", the legend "Kurang" … "Banyak" and the "Tahap 4 — Kesimpulan" text; there is no T1 card.
- **AC-M12-32.2** Given the student (provisional), when `/kirkpatrick` loads, then each square's title shows the student's answers that day and non-zero days are green by the PROPOSED thresholds.
- **AC-M12-32.3** Given 375, then the squares wrap and the page has no horizontal scroll.

**US-M12-33 — Monthly feedback**
- **AC-M12-33.1** Given the admin (answered in September 2026), when `/maklum-balas` loads, then the card shows "Terima Kasih!", "Anda sudah mengisi maklum balas untuk bulan ini. Sila kembali bulan depan." and "Kembali ke Dashboard" → `/dashboard`.
- **AC-M12-33.2** Given the student (no response this month; provisional), when `/maklum-balas` loads, then the PROPOSED form of FN-11.1.2 shows; when I click "Hantar" without choosing both scores, then nothing is stored and the native required message shows.
- **AC-M12-33.3** Given the student chooses NPS 10 and satisfaction 5 (provisional), when I click "Hantar", then the thank-you state of AC-M12-33.1 shows, and reopening `/maklum-balas` in the same month shows it again.
- **AC-M12-33.4** Given 375, then the card is centred within the viewport with no horizontal scroll.

**US-M12-35 — Admin Sekolah alias (v1.6, INFERRED)**
- **AC-M12-35.1** Given a school admin of school 8080, when I open `/admin-sekolah/kirkpatrick`, then S1 renders with school 8080's figures only; a `?school_id=8078` or `?state=Johor` in the URL changes nothing.
- **AC-M12-35.2** Given the same user, when I request any other Kirkpatrick screen's data (S2–S7) or a student (S8, including 4664), then the response is 403; `/admin-sekolah/kirkpatrick/behavior` is not a route (404).

**US-M12-34 — Responsive**
- **AC-M12-34.1** Given each of S1–S10 at 375×812, 768×1024 and 1280×800, when the page loads, then `document.documentElement.scrollWidth` ≤ the viewport width.
- **AC-M12-34.2** Given S2 at 375, then the 4 cards are 2 × 2; given S7 at 375, then the KPI cards are 2 × 2; given S5 at 375, then the ALESA tiles stay 3 columns and every table scrolls inside its card.

---

## 5. UI expectations

| Screen | Key states (screenshots in `docs/discovery/img/M12/`) | Behaviour notes |
|---|---|---|
| S1 | default (`overview-desktop/-tablet/-mobile.png`), school (`overview-school-decline.png`), empty state (`overview-state-empty.png`) | Level cards 1 / 2 / 4 columns; flow circles from `sm`, list below; panels stack below `md`; engagement tiles 5 columns everywhere; select fits at 375 (DV-M12-07). |
| S2 | default (`reaction-desktop/-mobile.png`) | 2 × 2 cards below `lg`, 4 at `lg`. |
| S3 | default (`learning-desktop/-mobile.png`) | KPI 2 / 3 / 6 columns; subject names truncate at `w-32`; school table scrolls in its card. |
| S4 | default, school (`behavior-desktop/-mobile.png`, `behavior-school.png`) | select fits at 375; tiles 5 columns; heat table scrolls in its card (20 px cells below `sm`); alerts full width. |
| S5 | top, ALESA, ROI/insight, mobile (`results-*.png`) | every table scrolls in its card; ALESA tiles 3 columns; long page (946 + 50 rows), no pager. |
| S6 | default (`chain-desktop/-tablet/-mobile.png`) | cards 1 column below `md` without arrows; correlation table scrolls. |
| S7 | default, form forced open, 405 (`interventions-*.png`) | KPI 2 × 2 below `md`; the form opens by click (DV-M12-01); 1 column below `md`; 404 instead of 405. |
| S8 | default, low (`pelajar-desktop/-mobile.png`), 403 (`pelajar-403.png`) | header stacks; tiles 2 × 2; cards stack below `md`. |
| S9 | default (`prestasi-saya-desktop/-mobile.png`) | squares wrap. |
| S10 | submitted (`maklum-balas-submitted.png`) | centred card. |

Loading: every data view shows the shared shell loading behaviour while the mock responds (live pages are server-rendered). A mock failure uses the global error convention of M01; no M12-specific error copy exists on live.

---

## 6. Coverage matrix (completeness proof)

Generated by `m12-writer/matrix.js` (session scratchpad) from `docs/discovery/inventory/M12/*.json` and the Function catalogue of §3. Every content element maps to exactly one Function or has a concrete exclusion reason. Shell elements (SHA, SHU) are listed with the M12-relevant ones mapped; the rest are owned by the global shell / M23 or the module their link targets.

### 6.0 Summary

| Screen | Elements | Mapped to an FN | Excluded (reason in the row) | Unmapped |
|---|---|---|---|---|
| S1 | 125 | 125 | 0 | 0 |
| S2 | 18 | 18 | 0 | 0 |
| S3 | 87 | 87 | 0 | 0 |
| S4 | 93 | 93 | 0 | 0 |
| S5 | 184 | 184 | 0 | 0 |
| S6 | 67 | 67 | 0 | 0 |
| S7 | 49 | 49 | 0 | 0 |
| S8 | 80 | 80 | 0 | 0 |
| S9 | 45 | 42 | 3 | 0 |
| S10 | 7 | 4 | 3 | 0 |
| SHA | 219 | 25 | 194 | 0 |
| SHU | 372 | 10 | 362 | 0 |
| **M12 content (S1–S10)** | **755** | **749** | **6** | **0** |
| **Shells (SHA, SHU)** | **591** | **35** | **556** | **0** |
| **Audit-observed (§6.3)** | **10** | **10** | **0** | **0** |
| **All** | **1356** | **794** | **562** | **0** |

Functions referenced by the matrix: 79 (77 by inventory rows + FN-M12-2.2.5 and 6.1.2 by the §6.3 rows). Every FN of §3 that has no element is a behaviour (access, data rule, unobservable state) and is marked "EL —" there.

### 6.1 M12 content elements

#### S1 — `/admin/kirkpatrick` (125 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M12-S1-001 | form | visible-default | GET /admin/kirkpatrick | FN-M12-2.1.1 |
| EL-M12-S1-002 | label | visible-default | Sekolah | FN-M12-2.1.1 |
| EL-M12-S1-003 | select | visible-default | Sekolah, `school_id` (58 options) | FN-M12-2.1.1 |
| EL-M12-S1-004 | label | visible-default | Negeri | FN-M12-2.1.1 |
| EL-M12-S1-005 | select | visible-default | Negeri, `state` (11 options) | FN-M12-2.1.1 |
| EL-M12-S1-006 | button | visible-default | Tapis, fa-filter | FN-M12-2.1.1 |
| EL-M12-S1-007 | link | visible-default | Tahap 4: Hasil 4.30 GPS Sekolah · 4378 rekod headcount Lihat detail, → /admin/kirkpatrick/results, fa-trophy | FN-M12-2.2.1 |
| EL-M12-S1-008 | link | visible-default | Tahap 3: Tingkah Laku 951/4158 Pelajar aktif · 20991 sesi · 82.8% ketepatan Lihat detail, → /admin/kirkpatr… | FN-M12-2.2.2 |
| EL-M12-S1-009 | link | visible-default | Tahap 2: Pembelajaran 82.8% Ketepatan · 306,133 soalan dijawab Lihat detail, → /admin/kirkpatrick/learning,… | FN-M12-2.2.3 |
| EL-M12-S1-010 | link | visible-default | Tahap 1: Reaksi 4.6/5 Kepuasan purata · 336 respon Lihat detail, → /admin/kirkpatrick/reaction, fa-smile | FN-M12-2.2.4 |
| EL-M12-S1-011 | card | visible-default | Kirkpatrick Evaluation Flow Klik mana-mana tahap untuk lihat detail | FN-M12-2.3.1 |
| EL-M12-S1-012 | heading | visible-default | Kirkpatrick Evaluation Flow Klik mana-mana tahap untuk lihat detail | FN-M12-2.3.1 |
| EL-M12-S1-013 | link | visible-default · desktop-only | T1: Reaksi Kepuasan pengguna 4.6/5, → /admin/kirkpatrick/reaction, fa-smile | FN-M12-2.3.2 |
| EL-M12-S1-014 | badge | visible-default · desktop-only | 4.6/5 | FN-M12-2.3.2 |
| EL-M12-S1-015 | link | visible-default · desktop-only | T2: Pembelajaran Peningkatan kemahiran 82.8% ketepatan, → /admin/kirkpatrick/learning, fa-brain | FN-M12-2.3.2 |
| EL-M12-S1-016 | badge | visible-default · desktop-only | 82.8% ketepatan | FN-M12-2.3.2 |
| EL-M12-S1-017 | link | visible-default · desktop-only | T3: Tingkah Laku Konsistensi penggunaan 951 pelajar aktif, → /admin/kirkpatrick/behavior, fa-running | FN-M12-2.3.2 |
| EL-M12-S1-018 | badge | visible-default · desktop-only | 951 pelajar aktif | FN-M12-2.3.2 |
| EL-M12-S1-019 | link | visible-default · desktop-only | T4: Hasil Keputusan peperiksaan GPS 4.30, → /admin/kirkpatrick/results, fa-trophy | FN-M12-2.3.2 |
| EL-M12-S1-020 | badge | visible-default · desktop-only | GPS 4.30 | FN-M12-2.3.2 |
| EL-M12-S1-021 | link | conditional · mobile-only | T1: Reaksi Kepuasan pengguna 4.6/5, → /admin/kirkpatrick/reaction, fa-smile | FN-M12-2.3.3 |
| EL-M12-S1-022 | link | conditional · mobile-only | T2: Pembelajaran Peningkatan kemahiran 82.8% ketepatan, → /admin/kirkpatrick/learning, fa-brain | FN-M12-2.3.3 |
| EL-M12-S1-023 | link | conditional · mobile-only | T3: Tingkah Laku Konsistensi penggunaan 951 pelajar aktif, → /admin/kirkpatrick/behavior, fa-running | FN-M12-2.3.3 |
| EL-M12-S1-024 | link | conditional · mobile-only | T4: Hasil Keputusan peperiksaan GPS 4.30, → /admin/kirkpatrick/results, fa-trophy | FN-M12-2.3.3 |
| EL-M12-S1-025 | card | visible-default | Perbandingan Sebelum & Selepas | FN-M12-2.4.1 |
| EL-M12-S1-026 | heading | visible-default | Perbandingan Sebelum & Selepas | FN-M12-2.4.1 |
| EL-M12-S1-027 | text | visible-default | Januari 2026 vs September 2026 | FN-M12-2.4.1 |
| EL-M12-S1-028 | text | visible-default | SEBELUM | FN-M12-2.4.2 |
| EL-M12-S1-029 | text | visible-default | 01 Jan 2026 - 31 Jan 2026 | FN-M12-2.4.2 |
| EL-M12-S1-030 | text | visible-default | 2 | FN-M12-2.4.2 |
| EL-M12-S1-031 | text | visible-default | Pelajar Aktif | FN-M12-2.4.2 |
| EL-M12-S1-032 | text | visible-default | 33.3% | FN-M12-2.4.2 |
| EL-M12-S1-033 | text | visible-default | Ketepatan | FN-M12-2.4.2 |
| EL-M12-S1-034 | text | visible-default | 3 | FN-M12-2.4.2 |
| EL-M12-S1-035 | text | visible-default | Jumlah Jawapan | FN-M12-2.4.2 |
| EL-M12-S1-036 | text | visible-default | 0 | FN-M12-2.4.2 |
| EL-M12-S1-037 | text | visible-default | Champion | FN-M12-2.4.2 |
| EL-M12-S1-038 | text | visible-default | SELEPAS | FN-M12-2.4.2 |
| EL-M12-S1-039 | text | visible-default | 01 Sep 2026 - 25 Sep 2026 | FN-M12-2.4.2 |
| EL-M12-S1-040 | text | visible-default | 58 | FN-M12-2.4.2 |
| EL-M12-S1-041 | text | visible-default | Pelajar Aktif | FN-M12-2.4.2 |
| EL-M12-S1-042 | text | visible-default | 87% | FN-M12-2.4.2 |
| EL-M12-S1-043 | text | visible-default | Ketepatan | FN-M12-2.4.2 |
| EL-M12-S1-044 | text | visible-default | 13,968 | FN-M12-2.4.2 |
| EL-M12-S1-045 | text | visible-default | Jumlah Jawapan | FN-M12-2.4.2 |
| EL-M12-S1-046 | text | visible-default | 28 | FN-M12-2.4.2 |
| EL-M12-S1-047 | text | visible-default | Champion | FN-M12-2.4.2 |
| EL-M12-S1-048 | text | visible-default | +56 | FN-M12-2.4.3 |
| EL-M12-S1-049 | text | visible-default | Pelajar Aktif | FN-M12-2.4.3 |
| EL-M12-S1-050 | text | visible-default | +53.7% | FN-M12-2.4.3 |
| EL-M12-S1-051 | text | visible-default | Ketepatan | FN-M12-2.4.3 |
| EL-M12-S1-052 | text | visible-default | +13965 | FN-M12-2.4.3 |
| EL-M12-S1-053 | text | visible-default | Jumlah Jawapan | FN-M12-2.4.3 |
| EL-M12-S1-054 | text | visible-default | +28 | FN-M12-2.4.3 |
| EL-M12-S1-055 | text | visible-default | Champion | FN-M12-2.4.3 |
| EL-M12-S1-056 | text | visible-default | Peningkatan 53.7% dalam ketepatan jawapan. 56 pelajar baru mula aktif. Jumlah jawapan meningkat 465500%. 28… | FN-M12-2.4.4 |
| EL-M12-S1-057 | text | visible-default | Ringkasan: | FN-M12-2.4.4 |
| EL-M12-S1-058 | link | visible-default | Pelajar Berdaftar (T4/T5) 4,158, → /admin/monitoring | FN-M12-2.5.1 |
| EL-M12-S1-059 | link | visible-default | Soalan Dijawab 306,133, → /admin/kirkpatrick/learning | FN-M12-2.5.1 |
| EL-M12-S1-060 | link | visible-default | Guru Aktif 277/522, → /admin/monitoring | FN-M12-2.5.1 |
| EL-M12-S1-061 | link | visible-default | Ketepatan Keseluruhan 82.8%, → /admin/kirkpatrick/learning | FN-M12-2.5.1 |
| EL-M12-S1-062 | card | visible-default | Taburan Engagement Pelajar | FN-M12-2.6.1 |
| EL-M12-S1-063 | heading | visible-default | Taburan Engagement Pelajar | FN-M12-2.6.1 |
| EL-M12-S1-064 | link | visible-default | 513 Champion 12.3%, → /admin/kirkpatrick/behavior, fa-crown | FN-M12-2.6.1 |
| EL-M12-S1-065 | link | visible-default | 259 Konsisten 6.2%, → /admin/kirkpatrick/behavior, fa-check-double | FN-M12-2.6.1 |
| EL-M12-S1-066 | link | visible-default | 169 Berkembang 4.1%, → /admin/kirkpatrick/behavior, fa-seedling | FN-M12-2.6.1 |
| EL-M12-S1-067 | link | visible-default | 5 Minimum 0.1%, → /admin/kirkpatrick/behavior, fa-minus-circle | FN-M12-2.6.1 |
| EL-M12-S1-068 | link | visible-default | 3207 Tidak Terlibat 77.1%, → /admin/kirkpatrick/behavior, fa-times-circle | FN-M12-2.6.1 |
| EL-M12-S1-069 | card | visible-default | Model Kirkpatrick — 4 Tahap Penilaian Keberkesanan | FN-M12-2.7.1 |
| EL-M12-S1-070 | text | visible-default | Model Kirkpatrick — 4 Tahap Penilaian Keberkesanan | FN-M12-2.7.1 |
| EL-M12-S1-071 | text | visible-default | Dashboard ini mengukur keberkesanan platform PrestasiPlus berdasarkan model Kirkpatrick (1959). Data Tahap … | FN-M12-2.7.1 |
| EL-M12-S1-072 | link | conditional | Reset, → /admin/kirkpatrick, fa-times | FN-M12-2.1.2 |
| EL-M12-S1-073 | link | conditional | Tahap 4: Hasil 4 GPS Sekolah · 4378 rekod headcount Lihat detail, → /admin/kirkpatrick/results, fa-trophy | FN-M12-2.2.1 |
| EL-M12-S1-074 | link | conditional | Tahap 3: Tingkah Laku 53/184 Pelajar aktif · 1002 sesi · 75.6% ketepatan Lihat detail, → /admin/kirkpatrick… | FN-M12-2.2.2 |
| EL-M12-S1-075 | link | conditional | Tahap 2: Pembelajaran 75.6% Ketepatan · 15,007 soalan dijawab Lihat detail, → /admin/kirkpatrick/learning, … | FN-M12-2.2.3 |
| EL-M12-S1-076 | link | conditional | T2: Pembelajaran Peningkatan kemahiran 75.6% ketepatan, → /admin/kirkpatrick/learning, fa-brain | FN-M12-2.3.2 |
| EL-M12-S1-077 | badge | conditional | 75.6% ketepatan | FN-M12-2.3.2 |
| EL-M12-S1-078 | link | conditional | T3: Tingkah Laku Konsistensi penggunaan 53 pelajar aktif, → /admin/kirkpatrick/behavior, fa-running | FN-M12-2.3.2 |
| EL-M12-S1-079 | badge | conditional | 53 pelajar aktif | FN-M12-2.3.2 |
| EL-M12-S1-080 | link | conditional | T4: Hasil Keputusan peperiksaan GPS 4, → /admin/kirkpatrick/results, fa-trophy | FN-M12-2.3.2 |
| EL-M12-S1-081 | badge | conditional | GPS 4 | FN-M12-2.3.2 |
| EL-M12-S1-082 | link | hidden-only | T2: Pembelajaran Peningkatan kemahiran 75.6% ketepatan, → /admin/kirkpatrick/learning, fa-brain | FN-M12-2.3.3 |
| EL-M12-S1-083 | link | hidden-only | T3: Tingkah Laku Konsistensi penggunaan 53 pelajar aktif, → /admin/kirkpatrick/behavior, fa-running | FN-M12-2.3.3 |
| EL-M12-S1-084 | link | hidden-only | T4: Hasil Keputusan peperiksaan GPS 4, → /admin/kirkpatrick/results, fa-trophy | FN-M12-2.3.3 |
| EL-M12-S1-085 | text | conditional | April 2026 vs September 2026 | FN-M12-2.4.1 |
| EL-M12-S1-086 | text | conditional | 01 Apr 2026 - 30 Apr 2026 | FN-M12-2.4.2 |
| EL-M12-S1-087 | text | conditional | 71.6% | FN-M12-2.4.2 |
| EL-M12-S1-088 | text | conditional | 55% | FN-M12-2.4.2 |
| EL-M12-S1-089 | text | conditional | -11 | FN-M12-2.4.3 |
| EL-M12-S1-090 | text | conditional | -16.6% | FN-M12-2.4.3 |
| EL-M12-S1-091 | text | conditional | -451 | FN-M12-2.4.3 |
| EL-M12-S1-092 | text | conditional | -2 | FN-M12-2.4.3 |
| EL-M12-S1-093 | text | conditional | Penurunan 16.6% dalam ketepatan jawapan. 11 pelajar kurang aktif berbanding sebelumnya., fa-chart-line | FN-M12-2.4.4 |
| EL-M12-S1-094 | link | conditional | Pelajar Berdaftar (T4/T5) 184, → /admin/monitoring | FN-M12-2.5.1 |
| EL-M12-S1-095 | link | conditional | Soalan Dijawab 15,007, → /admin/kirkpatrick/learning | FN-M12-2.5.1 |
| EL-M12-S1-096 | link | conditional | Guru Aktif 34/34, → /admin/monitoring | FN-M12-2.5.1 |
| EL-M12-S1-097 | link | conditional | Ketepatan Keseluruhan 75.6%, → /admin/kirkpatrick/learning | FN-M12-2.5.1 |
| EL-M12-S1-098 | link | conditional | 36 Champion 19.6%, → /admin/kirkpatrick/behavior, fa-crown | FN-M12-2.6.1 |
| EL-M12-S1-099 | link | conditional | 8 Konsisten 4.3%, → /admin/kirkpatrick/behavior, fa-check-double | FN-M12-2.6.1 |
| EL-M12-S1-100 | link | conditional | 9 Berkembang 4.9%, → /admin/kirkpatrick/behavior, fa-seedling | FN-M12-2.6.1 |
| EL-M12-S1-101 | link | conditional | 0 Minimum 0%, → /admin/kirkpatrick/behavior, fa-minus-circle | FN-M12-2.6.1 |
| EL-M12-S1-102 | link | conditional | 131 Tidak Terlibat 71.2%, → /admin/kirkpatrick/behavior, fa-times-circle | FN-M12-2.6.1 |
| EL-M12-S1-103 | link | conditional | Tahap 3: Tingkah Laku 0/0 Pelajar aktif · 0 sesi · 0% ketepatan Lihat detail, → /admin/kirkpatrick/behavior… | FN-M12-2.2.2 |
| EL-M12-S1-104 | link | conditional | Tahap 2: Pembelajaran 0% Ketepatan · 0 soalan dijawab Lihat detail, → /admin/kirkpatrick/learning, fa-brain | FN-M12-2.2.3 |
| EL-M12-S1-105 | link | conditional | T2: Pembelajaran Peningkatan kemahiran 0% ketepatan, → /admin/kirkpatrick/learning, fa-brain | FN-M12-2.3.2 |
| EL-M12-S1-106 | badge | conditional | 0% ketepatan | FN-M12-2.3.2 |
| EL-M12-S1-107 | link | conditional | T3: Tingkah Laku Konsistensi penggunaan 0 pelajar aktif, → /admin/kirkpatrick/behavior, fa-running | FN-M12-2.3.2 |
| EL-M12-S1-108 | badge | conditional | 0 pelajar aktif | FN-M12-2.3.2 |
| EL-M12-S1-109 | link | hidden-only | T2: Pembelajaran Peningkatan kemahiran 0% ketepatan, → /admin/kirkpatrick/learning, fa-brain | FN-M12-2.3.3 |
| EL-M12-S1-110 | link | hidden-only | T3: Tingkah Laku Konsistensi penggunaan 0 pelajar aktif, → /admin/kirkpatrick/behavior, fa-running | FN-M12-2.3.3 |
| EL-M12-S1-111 | empty-state | conditional | Tiada Data vs Tiada Data | FN-M12-2.4.1 |
| EL-M12-S1-112 | text | conditional | - | FN-M12-2.4.2 |
| EL-M12-S1-113 | text | conditional | 0% | FN-M12-2.4.2 |
| EL-M12-S1-114 | text | conditional | - | FN-M12-2.4.2 |
| EL-M12-S1-115 | text | conditional | 0% | FN-M12-2.4.2 |
| EL-M12-S1-116 | text | conditional | 0% | FN-M12-2.4.2 |
| EL-M12-S1-117 | text | conditional | Data tidak mencukupi untuk perbandingan., fa-chart-line | FN-M12-2.4.4 |
| EL-M12-S1-118 | link | conditional | Pelajar Berdaftar (T4/T5) 0, → /admin/monitoring | FN-M12-2.5.1 |
| EL-M12-S1-119 | link | conditional | Soalan Dijawab 0, → /admin/kirkpatrick/learning | FN-M12-2.5.1 |
| EL-M12-S1-120 | link | conditional | Guru Aktif 0/0, → /admin/monitoring | FN-M12-2.5.1 |
| EL-M12-S1-121 | link | conditional | Ketepatan Keseluruhan 0%, → /admin/kirkpatrick/learning | FN-M12-2.5.1 |
| EL-M12-S1-122 | link | conditional | 0 Champion 0%, → /admin/kirkpatrick/behavior, fa-crown | FN-M12-2.6.1 |
| EL-M12-S1-123 | link | conditional | 0 Konsisten 0%, → /admin/kirkpatrick/behavior, fa-check-double | FN-M12-2.6.1 |
| EL-M12-S1-124 | link | conditional | 0 Berkembang 0%, → /admin/kirkpatrick/behavior, fa-seedling | FN-M12-2.6.1 |
| EL-M12-S1-125 | link | conditional | 0 Tidak Terlibat 0%, → /admin/kirkpatrick/behavior, fa-times-circle | FN-M12-2.6.1 |

#### S2 — `/admin/kirkpatrick/reaction` (18 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M12-S2-001 | link | visible-default | Overview, → /admin/kirkpatrick, fa-th-large | FN-M12-1.1.9 |
| EL-M12-S2-002 | link | visible-default | T1: Reaksi, → /admin/kirkpatrick/reaction, fa-smile | FN-M12-1.1.9 |
| EL-M12-S2-003 | link | visible-default | T2: Pembelajaran, → /admin/kirkpatrick/learning, fa-brain | FN-M12-1.1.9 |
| EL-M12-S2-004 | link | visible-default | T3: Tingkah Laku, → /admin/kirkpatrick/behavior, fa-running | FN-M12-1.1.9 |
| EL-M12-S2-005 | link | visible-default | T4: Hasil, → /admin/kirkpatrick/results, fa-trophy | FN-M12-1.1.9 |
| EL-M12-S2-006 | link | visible-default | Intervensi, → /admin/kirkpatrick/interventions, fa-hand-holding-medical | FN-M12-1.1.9 |
| EL-M12-S2-007 | card | visible-default | 8.4/10 | FN-M12-3.1.1 |
| EL-M12-S2-008 | text | visible-default | NPS Pelajar | FN-M12-3.1.1 |
| EL-M12-S2-009 | text | visible-default | 8.4/10 | FN-M12-3.1.1 |
| EL-M12-S2-010 | card | visible-default | 6.5/10 | FN-M12-3.1.1 |
| EL-M12-S2-011 | text | visible-default | NPS Guru | FN-M12-3.1.1 |
| EL-M12-S2-012 | text | visible-default | 6.5/10 | FN-M12-3.1.1 |
| EL-M12-S2-013 | card | visible-default | 9.6/10 | FN-M12-3.1.1 |
| EL-M12-S2-014 | text | visible-default | NPS Admin | FN-M12-3.1.1 |
| EL-M12-S2-015 | text | visible-default | 9.6/10 | FN-M12-3.1.1 |
| EL-M12-S2-016 | card | visible-default | 4.6/5 | FN-M12-3.1.1 |
| EL-M12-S2-017 | text | visible-default | Kepuasan Purata | FN-M12-3.1.1 |
| EL-M12-S2-018 | text | visible-default | 4.6/5 | FN-M12-3.1.1 |

#### S3 — `/admin/kirkpatrick/learning` (87 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M12-S3-001 | link | visible-default | Overview, → /admin/kirkpatrick, fa-th-large | FN-M12-1.1.9 |
| EL-M12-S3-002 | link | visible-default | T1: Reaksi, → /admin/kirkpatrick/reaction, fa-smile | FN-M12-1.1.9 |
| EL-M12-S3-003 | link | visible-default | T2: Pembelajaran, → /admin/kirkpatrick/learning, fa-brain | FN-M12-1.1.9 |
| EL-M12-S3-004 | link | visible-default | T3: Tingkah Laku, → /admin/kirkpatrick/behavior, fa-running | FN-M12-1.1.9 |
| EL-M12-S3-005 | link | visible-default | T4: Hasil, → /admin/kirkpatrick/results, fa-trophy | FN-M12-1.1.9 |
| EL-M12-S3-006 | link | visible-default | Intervensi, → /admin/kirkpatrick/interventions, fa-hand-holding-medical | FN-M12-1.1.9 |
| EL-M12-S3-007 | card | visible-default | 306,133 | FN-M12-4.1.1 |
| EL-M12-S3-008 | text | visible-default | Soalan Dijawab | FN-M12-4.1.1 |
| EL-M12-S3-009 | text | visible-default | 306,133 | FN-M12-4.1.1 |
| EL-M12-S3-010 | card | visible-default | 82.8% | FN-M12-4.1.1 |
| EL-M12-S3-011 | text | visible-default | Ketepatan | FN-M12-4.1.1 |
| EL-M12-S3-012 | text | visible-default | 82.8% | FN-M12-4.1.1 |
| EL-M12-S3-013 | card | visible-default | 80.3% | FN-M12-4.1.1 |
| EL-M12-S3-014 | text | visible-default | Skor Purata | FN-M12-4.1.1 |
| EL-M12-S3-015 | text | visible-default | 80.3% | FN-M12-4.1.1 |
| EL-M12-S3-016 | card | visible-default | 20991/20991 | FN-M12-4.1.1 |
| EL-M12-S3-017 | text | visible-default | Sesi Selesai | FN-M12-4.1.1 |
| EL-M12-S3-018 | text | visible-default | 20991 | FN-M12-4.1.1 |
| EL-M12-S3-019 | text | visible-default | /20991 | FN-M12-4.1.1 |
| EL-M12-S3-020 | card | visible-default | 100% | FN-M12-4.1.1 |
| EL-M12-S3-021 | text | visible-default | Kadar Penyelesaian | FN-M12-4.1.1 |
| EL-M12-S3-022 | text | visible-default | 100% | FN-M12-4.1.1 |
| EL-M12-S3-023 | card | visible-default | - | FN-M12-4.1.1 |
| EL-M12-S3-024 | text | visible-default | Learning Gain | FN-M12-4.1.1 |
| EL-M12-S3-025 | text | visible-default | - | FN-M12-4.1.1 |
| EL-M12-S3-026 | text | visible-default | Perlu pre/post test | FN-M12-4.1.1 |
| EL-M12-S3-027 | text | visible-default | Pre-Test / Post-Test belum dimulakan | FN-M12-4.2.1 |
| EL-M12-S3-028 | text | visible-default | Apabila ujian diagnostik dimulakan, Hake's Normalized Learning Gain akan dikira secara automatik. | FN-M12-4.2.1 |
| EL-M12-S3-029 | text | visible-default | g = (Post - Pre) / (100 - Pre) · High: g≥0.7 · Medium: 0.3≤g<0.7 · Low: g<0.3 | FN-M12-4.2.1 |
| EL-M12-S3-030 | card | visible-default | Prestasi Mengikut Subjek | FN-M12-4.3.1 |
| EL-M12-S3-031 | heading | visible-default | Prestasi Mengikut Subjek | FN-M12-4.3.1 |
| EL-M12-S3-032 | tooltip | visible-default | Klik untuk lihat detail | FN-M12-4.3.2 |
| EL-M12-S3-033 | text | visible-default | Pendidikan Muzik | FN-M12-4.3.1 |
| EL-M12-S3-034 | badge | visible-default | 100.0% | FN-M12-4.3.1 |
| EL-M12-S3-035 | badge | visible-default | Mastered | FN-M12-4.3.1 |
| EL-M12-S3-036 | text | visible-default | 20 soalan | FN-M12-4.3.1 |
| EL-M12-S3-037 | tooltip | visible-default | Klik untuk lihat detail | FN-M12-4.3.2 |
| EL-M12-S3-038 | text | visible-default | Reka Bentuk & Teknologi | FN-M12-4.3.1 |
| EL-M12-S3-039 | badge | visible-default | 99.3% | FN-M12-4.3.1 |
| EL-M12-S3-040 | badge | visible-default | Mastered | FN-M12-4.3.1 |
| EL-M12-S3-041 | text | visible-default | 461 soalan | FN-M12-4.3.1 |
| EL-M12-S3-042 | tooltip | visible-default | Klik untuk lihat detail | FN-M12-4.3.2 |
| EL-M12-S3-043 | text | visible-default | Ekonomi | FN-M12-4.3.1 |
| EL-M12-S3-044 | badge | visible-default | 79.1% | FN-M12-4.3.1 |
| EL-M12-S3-045 | badge | visible-default | Developing | FN-M12-4.3.1 |
| EL-M12-S3-046 | text | visible-default | 2333 soalan | FN-M12-4.3.1 |
| EL-M12-S3-047 | tooltip | visible-default | Klik untuk lihat detail | FN-M12-4.3.2 |
| EL-M12-S3-048 | text | visible-default | Sejarah | FN-M12-4.3.1 |
| EL-M12-S3-049 | badge | visible-default | 76.3% | FN-M12-4.3.1 |
| EL-M12-S3-050 | badge | visible-default | Developing | FN-M12-4.3.1 |
| EL-M12-S3-051 | text | visible-default | 57695 soalan | FN-M12-4.3.1 |
| EL-M12-S3-052 | card | visible-default | Pembelajaran Mengikut Sekolah | FN-M12-4.4.1 |
| EL-M12-S3-053 | heading | visible-default | Pembelajaran Mengikut Sekolah | FN-M12-4.4.1 |
| EL-M12-S3-054 | table | visible-default | table: # · Sekolah · Pelajar · Soalan · Ketepatan · Skor Purata · Subjek (33 rows) | FN-M12-4.4.1 |
| EL-M12-S3-055 | link | visible-default | <school>, → /admin/monitoring/sekolah/8880 | FN-M12-4.4.1 |
| EL-M12-S3-056 | link | visible-default | <school>, → /admin/monitoring/sekolah/8106 | FN-M12-4.4.1 |
| EL-M12-S3-057 | link | visible-default | <school>, → /admin/monitoring/sekolah/8107 | FN-M12-4.4.1 |
| EL-M12-S3-058 | link | visible-default | <school>, → /admin/monitoring/sekolah/8098 | FN-M12-4.4.1 |
| EL-M12-S3-059 | link | visible-default | <school>, → /admin/monitoring/sekolah/8228 | FN-M12-4.4.1 |
| EL-M12-S3-060 | link | visible-default | <school>, → /admin/monitoring/sekolah/940 | FN-M12-4.4.1 |
| EL-M12-S3-061 | card | conditional | 15,007 | FN-M12-4.1.1 |
| EL-M12-S3-062 | card | conditional | 75.6% | FN-M12-4.1.1 |
| EL-M12-S3-063 | text | conditional | 75.6% | FN-M12-4.1.1 |
| EL-M12-S3-064 | card | conditional | 73.3% | FN-M12-4.1.1 |
| EL-M12-S3-065 | text | conditional | 73.3% | FN-M12-4.1.1 |
| EL-M12-S3-066 | text | conditional | Bahasa Cina | FN-M12-4.3.1 |
| EL-M12-S3-067 | text | conditional | 10 soalan | FN-M12-4.3.1 |
| EL-M12-S3-068 | badge | conditional | 100.0% | FN-M12-4.3.1 |
| EL-M12-S3-069 | text | conditional | Pendidikan Syariah Islamiah | FN-M12-4.3.1 |
| EL-M12-S3-070 | badge | conditional | 75.0% | FN-M12-4.3.1 |
| EL-M12-S3-071 | text | conditional | 40 soalan | FN-M12-4.3.1 |
| EL-M12-S3-072 | text | conditional | Kimia | FN-M12-4.3.1 |
| EL-M12-S3-073 | badge | conditional | 73.5% | FN-M12-4.3.1 |
| EL-M12-S3-074 | tooltip | conditional | Klik untuk lihat detail | FN-M12-4.3.2 |
| EL-M12-S3-075 | text | conditional | Bahasa Arab | FN-M12-4.3.1 |
| EL-M12-S3-076 | badge | conditional | 45.0% | FN-M12-4.3.1 |
| EL-M12-S3-077 | badge | conditional | Beginning | FN-M12-4.3.1 |
| EL-M12-S3-078 | tooltip | conditional | Klik untuk lihat detail | FN-M12-4.3.2 |
| EL-M12-S3-079 | text | conditional | Matematik Tambahan | FN-M12-4.3.1 |
| EL-M12-S3-080 | badge | conditional | 40.0% | FN-M12-4.3.1 |
| EL-M12-S3-081 | badge | conditional | Beginning | FN-M12-4.3.1 |
| EL-M12-S3-082 | text | conditional | 10 soalan | FN-M12-4.3.1 |
| EL-M12-S3-083 | tooltip | conditional | Klik untuk lihat detail | FN-M12-4.3.2 |
| EL-M12-S3-084 | text | conditional | Biologi | FN-M12-4.3.1 |
| EL-M12-S3-085 | badge | conditional | 33.3% | FN-M12-4.3.1 |
| EL-M12-S3-086 | badge | conditional | Beginning | FN-M12-4.3.1 |
| EL-M12-S3-087 | text | conditional | 30 soalan | FN-M12-4.3.1 |

#### S4 — `/admin/kirkpatrick/behavior` (93 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M12-S4-001 | link | visible-default | Overview, → /admin/kirkpatrick, fa-th-large | FN-M12-1.1.9 |
| EL-M12-S4-002 | link | visible-default | T1: Reaksi, → /admin/kirkpatrick/reaction, fa-smile | FN-M12-1.1.9 |
| EL-M12-S4-003 | link | visible-default | T2: Pembelajaran, → /admin/kirkpatrick/learning, fa-brain | FN-M12-1.1.9 |
| EL-M12-S4-004 | link | visible-default | T3: Tingkah Laku, → /admin/kirkpatrick/behavior, fa-running | FN-M12-1.1.9 |
| EL-M12-S4-005 | link | visible-default | T4: Hasil, → /admin/kirkpatrick/results, fa-trophy | FN-M12-1.1.9 |
| EL-M12-S4-006 | link | visible-default | Intervensi, → /admin/kirkpatrick/interventions, fa-hand-holding-medical | FN-M12-1.1.9 |
| EL-M12-S4-007 | form | visible-default | GET /admin/kirkpatrick/behavior | FN-M12-5.1.1 |
| EL-M12-S4-008 | label | visible-default | Sekolah | FN-M12-5.1.1 |
| EL-M12-S4-009 | select | visible-default | Sekolah, `school_id` (58 options) | FN-M12-5.1.1 |
| EL-M12-S4-010 | button | visible-default | Tapis, fa-filter | FN-M12-5.1.1 |
| EL-M12-S4-011 | card | visible-default | 4,158 | FN-M12-5.2.1 |
| EL-M12-S4-012 | text | visible-default | Pelajar T4/T5 | FN-M12-5.2.1 |
| EL-M12-S4-013 | text | visible-default | 4,158 | FN-M12-5.2.1 |
| EL-M12-S4-014 | card | visible-default | 951 | FN-M12-5.2.1 |
| EL-M12-S4-015 | text | visible-default | Pernah Aktif | FN-M12-5.2.1 |
| EL-M12-S4-016 | text | visible-default | 951 | FN-M12-5.2.1 |
| EL-M12-S4-017 | card | visible-default | 20991 | FN-M12-5.2.1 |
| EL-M12-S4-018 | text | visible-default | Jumlah Sesi | FN-M12-5.2.1 |
| EL-M12-S4-019 | text | visible-default | 20991 | FN-M12-5.2.1 |
| EL-M12-S4-020 | card | visible-default | 306,133 | FN-M12-5.2.1 |
| EL-M12-S4-021 | text | visible-default | Soalan Dijawab | FN-M12-5.2.1 |
| EL-M12-S4-022 | text | visible-default | 306,133 | FN-M12-5.2.1 |
| EL-M12-S4-023 | card | visible-default | 82.8% | FN-M12-5.2.1 |
| EL-M12-S4-024 | text | visible-default | Ketepatan | FN-M12-5.2.1 |
| EL-M12-S4-025 | text | visible-default | 82.8% | FN-M12-5.2.1 |
| EL-M12-S4-026 | card | visible-default | 53.1% | FN-M12-5.2.1 |
| EL-M12-S4-027 | text | visible-default | Guru Aktif | FN-M12-5.2.1 |
| EL-M12-S4-028 | text | visible-default | 53.1% | FN-M12-5.2.1 |
| EL-M12-S4-029 | text | visible-default | 277/522 | FN-M12-5.2.1 |
| EL-M12-S4-030 | card | visible-default | Taburan Tahap Engagement | FN-M12-5.3.1 |
| EL-M12-S4-031 | heading | visible-default | Taburan Tahap Engagement | FN-M12-5.3.1 |
| EL-M12-S4-032 | link | visible-default | 513 Champion >50 soalan 12.3%, → /admin/monitoring | FN-M12-5.3.1 |
| EL-M12-S4-033 | link | visible-default | 259 Konsisten 20-50 soalan 6.2%, → /admin/monitoring | FN-M12-5.3.1 |
| EL-M12-S4-034 | link | visible-default | 169 Berkembang 5-20 soalan 4.1%, → /admin/monitoring | FN-M12-5.3.1 |
| EL-M12-S4-035 | link | visible-default | 5 Minimum <5 soalan 0.1%, → /admin/monitoring | FN-M12-5.3.1 |
| EL-M12-S4-036 | link | visible-default | 3207 Tidak Terlibat 0 soalan 77.1%, → /admin/monitoring | FN-M12-5.3.1 |
| EL-M12-S4-037 | card | visible-default | Engagement Mengikut Sekolah | FN-M12-5.4.1 |
| EL-M12-S4-038 | heading | visible-default | Engagement Mengikut Sekolah | FN-M12-5.4.1 |
| EL-M12-S4-039 | table | visible-default | table: # · Sekolah · Pelajar · Aktif · Soalan · Sesi · Purata/Aktif · Skor · Tahap (33 rows) | FN-M12-5.4.1 |
| EL-M12-S4-040 | link | visible-default | <school>, → /admin/monitoring/sekolah/9681 | FN-M12-5.4.1 |
| EL-M12-S4-041 | link | visible-default | <school>, → /admin/monitoring/sekolah/8078 | FN-M12-5.4.1 |
| EL-M12-S4-042 | link | visible-default | <school>, → /admin/monitoring/sekolah/7780 | FN-M12-5.4.1 |
| EL-M12-S4-043 | link | visible-default | <school>, → /admin/monitoring/sekolah/8228 | FN-M12-5.4.1 |
| EL-M12-S4-044 | link | visible-default | <school>, → /admin/monitoring/sekolah/8277 | FN-M12-5.4.1 |
| EL-M12-S4-045 | link | visible-default | <school>, → /admin/monitoring/sekolah/940 | FN-M12-5.4.1 |
| EL-M12-S4-046 | card | visible-default | Corak Masa Aktiviti | FN-M12-5.5.1 |
| EL-M12-S4-047 | heading | visible-default | Corak Masa Aktiviti | FN-M12-5.5.1 |
| EL-M12-S4-048 | text | visible-default | Bilangan soalan dijawab mengikut jam dan hari | FN-M12-5.5.1 |
| EL-M12-S4-049 | table | visible-default | table: (blank) · 06 · 07 · 08 · 09 · 10 · 11 · 12 · 13 · 14 · 15 · 16 · 17 · 18 · 19 · 20 · 21 · 22 · 23 (7… | FN-M12-5.5.1 |
| EL-M12-S4-050 | card | visible-default | Amaran & Pemerhatian | FN-M12-5.6.1 |
| EL-M12-S4-051 | heading | visible-default | Amaran & Pemerhatian | FN-M12-5.6.1 |
| EL-M12-S4-052 | text | visible-default | <school>: 1 pelajar tidak pernah login langsung. | FN-M12-5.6.1 |
| EL-M12-S4-053 | text | visible-default | <school>: 4 pelajar tidak pernah login langsung. | FN-M12-5.6.1 |
| EL-M12-S4-054 | text | visible-default | <school>: 6 pelajar tidak pernah login langsung. | FN-M12-5.6.1 |
| EL-M12-S4-055 | text | visible-default | <school>: 8 pelajar tidak pernah login langsung. | FN-M12-5.6.1 |
| EL-M12-S4-056 | text | visible-default | <school>: 257 pelajar tidak pernah login langsung. | FN-M12-5.6.1 |
| EL-M12-S4-057 | text | visible-default | <school>: 205 pelajar tidak pernah login langsung. | FN-M12-5.6.1 |
| EL-M12-S4-058 | text | visible-default | <school>: 1 pelajar tidak pernah login langsung. | FN-M12-5.6.1 |
| EL-M12-S4-059 | text | visible-default | <school>: 759 pelajar tidak pernah login langsung. | FN-M12-5.6.1 |
| EL-M12-S4-060 | text | visible-default | <school>: 674 pelajar tidak pernah login langsung. | FN-M12-5.6.1 |
| EL-M12-S4-061 | text | visible-default | <school>: 1 pelajar tidak pernah login langsung. | FN-M12-5.6.1 |
| EL-M12-S4-062 | text | visible-default | <school>: 5 pelajar tidak pernah login langsung. | FN-M12-5.6.1 |
| EL-M12-S4-063 | text | visible-default | <school>: 148 pelajar tidak pernah login langsung. | FN-M12-5.6.1 |
| EL-M12-S4-064 | text | visible-default | <school>: 2 pelajar tidak pernah login langsung. | FN-M12-5.6.1 |
| EL-M12-S4-065 | text | visible-default | <school>: 1 pelajar tidak pernah login langsung. | FN-M12-5.6.1 |
| EL-M12-S4-066 | text | visible-default | <school>: 1 pelajar tidak pernah login langsung. | FN-M12-5.6.1 |
| EL-M12-S4-067 | text | visible-default | <school>: 16 pelajar tidak pernah login langsung. | FN-M12-5.6.1 |
| EL-M12-S4-068 | text | visible-default | <school>: 8 pelajar tidak pernah login langsung. | FN-M12-5.6.1 |
| EL-M12-S4-069 | text | visible-default | <school>: 7 pelajar tidak pernah login langsung. | FN-M12-5.6.1 |
| EL-M12-S4-070 | text | visible-default | <school>: 7 pelajar tidak pernah login langsung. | FN-M12-5.6.1 |
| EL-M12-S4-071 | text | visible-default | <school>: 8 pelajar tidak pernah login langsung. | FN-M12-5.6.1 |
| EL-M12-S4-072 | text | visible-default | <school>: 1 pelajar tidak pernah login langsung. | FN-M12-5.6.1 |
| EL-M12-S4-073 | text | visible-default | <school>: 6 pelajar tidak pernah login langsung. | FN-M12-5.6.1 |
| EL-M12-S4-074 | text | visible-default | <school>: 2 guru telah login tetapi tiada pelajar yang menjawab soalan. | FN-M12-5.6.1 |
| EL-M12-S4-075 | text | visible-default | <school>: 83.3% pelajar aktif menjawab soalan. Tahniah! | FN-M12-5.6.1 |
| EL-M12-S4-076 | text | visible-default | <school>: 87.5% pelajar aktif menjawab soalan. Tahniah! | FN-M12-5.6.1 |
| EL-M12-S4-077 | card | visible-default | Data Mood Belum Mencukupi | FN-M12-5.7.1 |
| EL-M12-S4-078 | text | visible-default | 💭 | FN-M12-5.7.1 |
| EL-M12-S4-079 | heading | visible-default | Data Mood Belum Mencukupi | FN-M12-5.7.1 |
| EL-M12-S4-080 | text | visible-default | Pelajar perlu check-in mood harian untuk analisis kesejahteraan vs prestasi. | FN-M12-5.7.1 |
| EL-M12-S4-081 | link | conditional | Reset, → /admin/kirkpatrick/behavior, fa-times | FN-M12-5.1.2 |
| EL-M12-S4-082 | card | conditional | 53 | FN-M12-5.2.1 |
| EL-M12-S4-083 | card | conditional | 15,007 | FN-M12-5.2.1 |
| EL-M12-S4-084 | card | conditional | 75.6% | FN-M12-5.2.1 |
| EL-M12-S4-085 | text | conditional | 75.6% | FN-M12-5.2.1 |
| EL-M12-S4-086 | card | conditional | 100% | FN-M12-5.2.1 |
| EL-M12-S4-087 | text | conditional | 100% | FN-M12-5.2.1 |
| EL-M12-S4-088 | text | conditional | 34/34 | FN-M12-5.2.1 |
| EL-M12-S4-089 | link | conditional | 36 Champion >50 soalan 19.6%, → /admin/monitoring | FN-M12-5.3.1 |
| EL-M12-S4-090 | link | conditional | 8 Konsisten 20-50 soalan 4.3%, → /admin/monitoring | FN-M12-5.3.1 |
| EL-M12-S4-091 | link | conditional | 9 Berkembang 5-20 soalan 4.9%, → /admin/monitoring | FN-M12-5.3.1 |
| EL-M12-S4-092 | link | conditional | 0 Minimum <5 soalan 0%, → /admin/monitoring | FN-M12-5.3.1 |
| EL-M12-S4-093 | link | conditional | 131 Tidak Terlibat 0 soalan 71.2%, → /admin/monitoring | FN-M12-5.3.1 |

#### S5 — `/admin/kirkpatrick/results` (184 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M12-S5-001 | link | visible-default | Overview, → /admin/kirkpatrick, fa-th-large | FN-M12-1.1.9 |
| EL-M12-S5-002 | link | visible-default | T1: Reaksi, → /admin/kirkpatrick/reaction, fa-smile | FN-M12-1.1.9 |
| EL-M12-S5-003 | link | visible-default | T2: Pembelajaran, → /admin/kirkpatrick/learning, fa-brain | FN-M12-1.1.9 |
| EL-M12-S5-004 | link | visible-default | T3: Tingkah Laku, → /admin/kirkpatrick/behavior, fa-running | FN-M12-1.1.9 |
| EL-M12-S5-005 | link | visible-default | T4: Hasil, → /admin/kirkpatrick/results, fa-trophy | FN-M12-1.1.9 |
| EL-M12-S5-006 | link | visible-default | Intervensi, → /admin/kirkpatrick/interventions, fa-hand-holding-medical | FN-M12-1.1.9 |
| EL-M12-S5-007 | card | visible-default | 4.30 | FN-M12-6.1.1 |
| EL-M12-S5-008 | text | visible-default | GPS Headcount | FN-M12-6.1.1 |
| EL-M12-S5-009 | text | visible-default | 4.30 | FN-M12-6.1.1 |
| EL-M12-S5-010 | text | visible-default | 41 rekod · 2025 | FN-M12-6.1.1 |
| EL-M12-S5-011 | card | visible-default | 90.6% | FN-M12-6.1.1 |
| EL-M12-S5-012 | text | visible-default | Kadar Lulus | FN-M12-6.1.1 |
| EL-M12-S5-013 | text | visible-default | 90.6% | FN-M12-6.1.1 |
| EL-M12-S5-014 | text | visible-default | 163/180 calon | FN-M12-6.1.1 |
| EL-M12-S5-015 | card | visible-default | 52 | FN-M12-6.1.1 |
| EL-M12-S5-016 | text | visible-default | Pelajar Gred A | FN-M12-6.1.1 |
| EL-M12-S5-017 | text | visible-default | 52 | FN-M12-6.1.1 |
| EL-M12-S5-018 | text | visible-default | 28.9% daripada 180 | FN-M12-6.1.1 |
| EL-M12-S5-019 | card | visible-default | 82.8% | FN-M12-6.1.1 |
| EL-M12-S5-020 | text | visible-default | Ketepatan Platform | FN-M12-6.1.1 |
| EL-M12-S5-021 | text | visible-default | 82.8% | FN-M12-6.1.1 |
| EL-M12-S5-022 | text | visible-default | 306,133 soalan | FN-M12-6.1.1 |
| EL-M12-S5-023 | card | visible-default | 946 | FN-M12-6.1.1 |
| EL-M12-S5-024 | text | visible-default | Pelajar Aktif | FN-M12-6.1.1 |
| EL-M12-S5-025 | text | visible-default | 946 | FN-M12-6.1.1 |
| EL-M12-S5-026 | text | visible-default | 22.8% daripada 4,158 | FN-M12-6.1.1 |
| EL-M12-S5-027 | card | visible-default | 4378 | FN-M12-6.1.1 |
| EL-M12-S5-028 | text | visible-default | Rekod Headcount | FN-M12-6.1.1 |
| EL-M12-S5-029 | text | visible-default | 4378 | FN-M12-6.1.1 |
| EL-M12-S5-030 | text | visible-default | Data OTR | FN-M12-6.1.1 |
| EL-M12-S5-031 | card | visible-default | Taburan Gred (2025) | FN-M12-6.2.1 |
| EL-M12-S5-032 | heading | visible-default | Taburan Gred (2025) | FN-M12-6.2.1 |
| EL-M12-S5-033 | text | visible-default | Berdasarkan 180 calon — sumber: Headcount OTR | FN-M12-6.2.1 |
| EL-M12-S5-034 | tooltip | visible-default | A+: 10 pelajar (5.6%) | FN-M12-6.2.1 |
| EL-M12-S5-035 | text | visible-default | A+ | FN-M12-6.2.1 |
| EL-M12-S5-036 | text | visible-default | 10 | FN-M12-6.2.1 |
| EL-M12-S5-037 | text | visible-default | 5.6% | FN-M12-6.2.1 |
| EL-M12-S5-038 | tooltip | visible-default | A: 18 pelajar (10%) | FN-M12-6.2.1 |
| EL-M12-S5-039 | text | visible-default | A | FN-M12-6.2.1 |
| EL-M12-S5-040 | text | visible-default | 18 | FN-M12-6.2.1 |
| EL-M12-S5-041 | text | visible-default | 10% | FN-M12-6.2.1 |
| EL-M12-S5-042 | tooltip | visible-default | A-: 24 pelajar (13.3%) | FN-M12-6.2.1 |
| EL-M12-S5-043 | text | visible-default | A- | FN-M12-6.2.1 |
| EL-M12-S5-044 | text | visible-default | 24 | FN-M12-6.2.1 |
| EL-M12-S5-045 | text | visible-default | 13.3% | FN-M12-6.2.1 |
| EL-M12-S5-046 | tooltip | visible-default | B+: 32 pelajar (17.8%) | FN-M12-6.2.1 |
| EL-M12-S5-047 | text | visible-default | B+ | FN-M12-6.2.1 |
| EL-M12-S5-048 | text | visible-default | 32 | FN-M12-6.2.1 |
| EL-M12-S5-049 | text | visible-default | 17.8% | FN-M12-6.2.1 |
| EL-M12-S5-050 | tooltip | visible-default | B: 32 pelajar (17.8%) | FN-M12-6.2.1 |
| EL-M12-S5-051 | text | visible-default | B | FN-M12-6.2.1 |
| EL-M12-S5-052 | text | visible-default | 32 | FN-M12-6.2.1 |
| EL-M12-S5-053 | text | visible-default | 17.8% | FN-M12-6.2.1 |
| EL-M12-S5-054 | tooltip | visible-default | C+: 26 pelajar (14.4%) | FN-M12-6.2.1 |
| EL-M12-S5-055 | text | visible-default | C+ | FN-M12-6.2.1 |
| EL-M12-S5-056 | text | visible-default | 26 | FN-M12-6.2.1 |
| EL-M12-S5-057 | text | visible-default | 14.4% | FN-M12-6.2.1 |
| EL-M12-S5-058 | tooltip | visible-default | C: 21 pelajar (11.7%) | FN-M12-6.2.1 |
| EL-M12-S5-059 | text | visible-default | C | FN-M12-6.2.1 |
| EL-M12-S5-060 | text | visible-default | 21 | FN-M12-6.2.1 |
| EL-M12-S5-061 | text | visible-default | 11.7% | FN-M12-6.2.1 |
| EL-M12-S5-062 | tooltip | visible-default | D: 11 pelajar (6.1%) | FN-M12-6.2.1 |
| EL-M12-S5-063 | text | visible-default | D | FN-M12-6.2.1 |
| EL-M12-S5-064 | text | visible-default | 11 | FN-M12-6.2.1 |
| EL-M12-S5-065 | text | visible-default | 6.1% | FN-M12-6.2.1 |
| EL-M12-S5-066 | tooltip | visible-default | E: 5 pelajar (2.8%) | FN-M12-6.2.1 |
| EL-M12-S5-067 | text | visible-default | E | FN-M12-6.2.1 |
| EL-M12-S5-068 | text | visible-default | 5 | FN-M12-6.2.1 |
| EL-M12-S5-069 | text | visible-default | 2.8% | FN-M12-6.2.1 |
| EL-M12-S5-070 | tooltip | visible-default | G: 1 pelajar (0.6%) | FN-M12-6.2.1 |
| EL-M12-S5-071 | text | visible-default | G | FN-M12-6.2.1 |
| EL-M12-S5-072 | text | visible-default | 1 | FN-M12-6.2.1 |
| EL-M12-S5-073 | text | visible-default | 0.6% | FN-M12-6.2.1 |
| EL-M12-S5-074 | card | visible-default | GPS Mengikut Subjek (2026) | FN-M12-6.3.1 |
| EL-M12-S5-075 | heading | visible-default | GPS Mengikut Subjek (2026) | FN-M12-6.3.1 |
| EL-M12-S5-076 | table | visible-default | table: # · Subjek · GPS · Gred · Calon · Trend (5 rows) | FN-M12-6.3.1 |
| EL-M12-S5-077 | text | visible-default | GPS rendah = lebih baik. Trend: berbanding tahun sebelumnya., fa-info-circle | FN-M12-6.3.1 |
| EL-M12-S5-078 | card | visible-default | Trend GPS (2022–2026) | FN-M12-6.4.1 |
| EL-M12-S5-079 | heading | visible-default | Trend GPS (2022–2026) | FN-M12-6.4.1 |
| EL-M12-S5-080 | table | visible-default | table: Subjek · 2022 · 2023 · 2024 · 2025 · 2026 · Trend (7 rows) | FN-M12-6.4.1 |
| EL-M12-S5-081 | text | visible-default | = GPS menurun (improving). Sumber: Headcount OTR & SPM sebenar., fa-arrow-up | FN-M12-6.4.1 |
| EL-M12-S5-082 | card | visible-default | Prestasi Mengikut Sekolah (Platform + Headcount) | FN-M12-6.5.1 |
| EL-M12-S5-083 | heading | visible-default | Prestasi Mengikut Sekolah (Platform + Headcount) | FN-M12-6.5.1 |
| EL-M12-S5-084 | table | visible-default | table: # · Sekolah · Pelajar · Aktif · Ketepatan · Soalan · Engagement · Tahap (33 rows) | FN-M12-6.5.1 |
| EL-M12-S5-085 | link | visible-default | <school>, → /admin/monitoring/sekolah/9681 | FN-M12-6.5.1 |
| EL-M12-S5-086 | link | visible-default | <school>, → /admin/monitoring/sekolah/8078 | FN-M12-6.5.1 |
| EL-M12-S5-087 | link | visible-default | <school>, → /admin/monitoring/sekolah/7780 | FN-M12-6.5.1 |
| EL-M12-S5-088 | link | visible-default | <school>, → /admin/monitoring/sekolah/8228 | FN-M12-6.5.1 |
| EL-M12-S5-089 | link | visible-default | <school>, → /admin/monitoring/sekolah/8277 | FN-M12-6.5.1 |
| EL-M12-S5-090 | link | visible-default | <school>, → /admin/monitoring/sekolah/940 | FN-M12-6.5.1 |
| EL-M12-S5-091 | card | visible-default | Ramalan Prestasi Pelajar Aktif | FN-M12-6.6.1 |
| EL-M12-S5-092 | heading | visible-default | Ramalan Prestasi Pelajar Aktif | FN-M12-6.6.1 |
| EL-M12-S5-093 | text | visible-default | Berdasarkan ketepatan menjawab soalan dalam platform | FN-M12-6.6.1 |
| EL-M12-S5-094 | table | visible-default | table: # · Pelajar · Sekolah · Soalan · Ketepatan · Anggaran Gred (946 rows) | FN-M12-6.6.1 |
| EL-M12-S5-095 | link | visible-default | <person>, → /admin/monitoring/sekolah/8090/pelajar/{id} | FN-M12-6.6.1 |
| EL-M12-S5-096 | link | visible-default | <school>, → /admin/monitoring/sekolah/8090 | FN-M12-6.6.1 |
| EL-M12-S5-097 | link | visible-default | <person>, → /admin/monitoring/sekolah/8078/pelajar/{id} | FN-M12-6.6.1 |
| EL-M12-S5-098 | link | visible-default | <school>, → /admin/monitoring/sekolah/8078 | FN-M12-6.6.1 |
| EL-M12-S5-099 | link | visible-default | <person>, → /admin/monitoring/sekolah/8078/pelajar/{id} | FN-M12-6.6.1 |
| EL-M12-S5-100 | link | visible-default | <school>, → /admin/monitoring/sekolah/8078 | FN-M12-6.6.1 |
| EL-M12-S5-101 | link | visible-default | <person>, → /admin/monitoring/sekolah/8106/pelajar/{id} | FN-M12-6.6.1 |
| EL-M12-S5-102 | link | visible-default | <school>, → /admin/monitoring/sekolah/8106 | FN-M12-6.6.1 |
| EL-M12-S5-103 | link | visible-default | <person>, → /admin/monitoring/sekolah/8090/pelajar/{id} | FN-M12-6.6.1 |
| EL-M12-S5-104 | link | visible-default | <school>, → /admin/monitoring/sekolah/8090 | FN-M12-6.6.1 |
| EL-M12-S5-105 | text | visible-default | Ramalan ini berdasarkan ketepatan menjawab soalan dalam platform sahaja. Ramalan penuh memerlukan lebih ban… | FN-M12-6.6.1 |
| EL-M12-S5-106 | card | visible-default | Ramalan ALESA (Predictive Grade) | FN-M12-6.7.1 |
| EL-M12-S5-107 | heading | visible-default | Ramalan ALESA (Predictive Grade) | FN-M12-6.7.1 |
| EL-M12-S5-108 | text | visible-default | Berdasarkan ketepatan, konsistensi, trend mingguan, dan jumlah latihan pelajar | FN-M12-6.7.1 |
| EL-M12-S5-109 | text | visible-default | 48 | FN-M12-6.7.2 |
| EL-M12-S5-110 | text | visible-default | Dijangka Lulus | FN-M12-6.7.2 |
| EL-M12-S5-111 | text | visible-default | 2 | FN-M12-6.7.2 |
| EL-M12-S5-112 | text | visible-default | Dijangka Gagal | FN-M12-6.7.2 |
| EL-M12-S5-113 | text | visible-default | 4 | FN-M12-6.7.2 |
| EL-M12-S5-114 | text | visible-default | Perlu Intervensi | FN-M12-6.7.2 |
| EL-M12-S5-115 | table | visible-default | table: # · Pelajar · Ketepatan · Ramalan Gred · Keyakinan · Cadangan (50 rows) | FN-M12-6.7.3 |
| EL-M12-S5-116 | badge | visible-default | Rendah | FN-M12-6.7.3 |
| EL-M12-S5-117 | badge | visible-default | Tinggi | FN-M12-6.7.3 |
| EL-M12-S5-118 | badge | visible-default | Rendah | FN-M12-6.7.3 |
| EL-M12-S5-119 | badge | visible-default | Rendah | FN-M12-6.7.3 |
| EL-M12-S5-120 | badge | visible-default | Rendah | FN-M12-6.7.3 |
| EL-M12-S5-121 | badge | visible-default | Rendah | FN-M12-6.7.3 |
| EL-M12-S5-122 | badge | visible-default | Rendah | FN-M12-6.7.3 |
| EL-M12-S5-123 | badge | visible-default | Rendah | FN-M12-6.7.3 |
| EL-M12-S5-124 | badge | visible-default | Rendah | FN-M12-6.7.3 |
| EL-M12-S5-125 | text | visible-default | , 4 pelajar perlu intervensi segera. Ramalan ini berdasarkan formula berwajaran: Ketepatan (40%), Konsisten… | FN-M12-6.7.4 |
| EL-M12-S5-126 | text | visible-default | 48 pelajar dijangka lulus | FN-M12-6.7.4 |
| EL-M12-S5-127 | card | visible-default | ROI Platform (Anggaran) | FN-M12-6.8.1 |
| EL-M12-S5-128 | heading | visible-default | ROI Platform (Anggaran) | FN-M12-6.8.1 |
| EL-M12-S5-129 | text | visible-default | Pelajar Aktif | FN-M12-6.8.1 |
| EL-M12-S5-130 | text | visible-default | 946 | FN-M12-6.8.1 |
| EL-M12-S5-131 | text | visible-default | Purata Soalan/Pelajar | FN-M12-6.8.1 |
| EL-M12-S5-132 | text | visible-default | 323.6 | FN-M12-6.8.1 |
| EL-M12-S5-133 | text | visible-default | Ketepatan Aktif | FN-M12-6.8.1 |
| EL-M12-S5-134 | text | visible-default | 82.8% | FN-M12-6.8.1 |
| EL-M12-S5-135 | text | visible-default | GPS Headcount | FN-M12-6.8.1 |
| EL-M12-S5-136 | text | visible-default | 4.30 | FN-M12-6.8.1 |
| EL-M12-S5-137 | text | visible-default | ROI penuh akan dapat dikira apabila: | FN-M12-6.8.1 |
| EL-M12-S5-138 | text | visible-default | Keputusan peperiksaan sebenar (SPM/dalaman) diimport | FN-M12-6.8.1 |
| EL-M12-S5-139 | text | visible-default | Data kos langganan platform dimasukkan | FN-M12-6.8.1 |
| EL-M12-S5-140 | text | visible-default | Perbandingan prestasi pelajar aktif vs tidak aktif dapat dibuat | FN-M12-6.8.1 |
| EL-M12-S5-141 | card | visible-default | Pemerhatian & Insight | FN-M12-6.9.1 |
| EL-M12-S5-142 | heading | visible-default | Pemerhatian & Insight | FN-M12-6.9.1 |
| EL-M12-S5-143 | text | visible-default | Hanya 946 daripada 4158 pelajar T4/T5 (946) menggunakan platform. Data perbandingan terhad kepada pelajar a… | FN-M12-6.9.1 |
| EL-M12-S5-144 | text | visible-default | Purata ketepatan pelajar aktif dalam platform: 82.8%. Ini bersamaan anggaran gred A. | FN-M12-6.9.1 |
| EL-M12-S5-145 | text | visible-default | GPS keseluruhan dari headcount (tahun 2025): 4.30. Trend menunjukkan peningkatan dari tahun ke tahun. | FN-M12-6.9.1 |
| EL-M12-S5-146 | text | visible-default | Disclaimer: Data GPS Anggaran berdasarkan markah OTR headcount, bukan keputusan SPM sebenar., fa-exclamatio… | FN-M12-6.9.1 |
| EL-M12-S5-147 | card | conditional | 4 | FN-M12-6.1.1 |
| EL-M12-S5-148 | card | conditional | 100% | FN-M12-6.1.1 |
| EL-M12-S5-149 | text | conditional | 100% | FN-M12-6.1.1 |
| EL-M12-S5-150 | text | conditional | 1/1 calon | FN-M12-6.1.1 |
| EL-M12-S5-151 | card | conditional | 0 | FN-M12-6.1.1 |
| EL-M12-S5-152 | text | conditional | 0% daripada 1 | FN-M12-6.1.1 |
| EL-M12-S5-153 | card | conditional | 75.6% | FN-M12-6.1.1 |
| EL-M12-S5-154 | text | conditional | 75.6% | FN-M12-6.1.1 |
| EL-M12-S5-155 | text | conditional | 15,007 soalan | FN-M12-6.1.1 |
| EL-M12-S5-156 | card | conditional | 53 | FN-M12-6.1.1 |
| EL-M12-S5-157 | text | conditional | 28.8% daripada 184 | FN-M12-6.1.1 |
| EL-M12-S5-158 | text | conditional | Berdasarkan 1 calon — sumber: Headcount OTR | FN-M12-6.2.1 |
| EL-M12-S5-159 | tooltip | conditional | A+: 0 pelajar (0%) | FN-M12-6.2.1 |
| EL-M12-S5-160 | text | conditional | 0% | FN-M12-6.2.1 |
| EL-M12-S5-161 | tooltip | conditional | A: 0 pelajar (0%) | FN-M12-6.2.1 |
| EL-M12-S5-162 | text | conditional | 0% | FN-M12-6.2.1 |
| EL-M12-S5-163 | tooltip | conditional | A-: 0 pelajar (0%) | FN-M12-6.2.1 |
| EL-M12-S5-164 | text | conditional | 0% | FN-M12-6.2.1 |
| EL-M12-S5-165 | tooltip | conditional | B+: 1 pelajar (100%) | FN-M12-6.2.1 |
| EL-M12-S5-166 | text | conditional | 100% | FN-M12-6.2.1 |
| EL-M12-S5-167 | tooltip | conditional | B: 0 pelajar (0%) | FN-M12-6.2.1 |
| EL-M12-S5-168 | text | conditional | 0% | FN-M12-6.2.1 |
| EL-M12-S5-169 | tooltip | conditional | C+: 0 pelajar (0%) | FN-M12-6.2.1 |
| EL-M12-S5-170 | text | conditional | 0% | FN-M12-6.2.1 |
| EL-M12-S5-171 | tooltip | conditional | C: 0 pelajar (0%) | FN-M12-6.2.1 |
| EL-M12-S5-172 | text | conditional | 0% | FN-M12-6.2.1 |
| EL-M12-S5-173 | tooltip | conditional | D: 0 pelajar (0%) | FN-M12-6.2.1 |
| EL-M12-S5-174 | text | conditional | 0% | FN-M12-6.2.1 |
| EL-M12-S5-175 | tooltip | conditional | E: 0 pelajar (0%) | FN-M12-6.2.1 |
| EL-M12-S5-176 | text | conditional | 0% | FN-M12-6.2.1 |
| EL-M12-S5-177 | tooltip | conditional | G: 0 pelajar (0%) | FN-M12-6.2.1 |
| EL-M12-S5-178 | text | conditional | 0% | FN-M12-6.2.1 |
| EL-M12-S5-179 | text | conditional | , 3 pelajar perlu intervensi segera. Ramalan ini berdasarkan formula berwajaran: Ketepatan (40%), Konsisten… | FN-M12-6.7.4 |
| EL-M12-S5-180 | text | conditional | 47 pelajar dijangka lulus | FN-M12-6.7.4 |
| EL-M12-S5-181 | text | conditional | 75.6% | FN-M12-6.8.1 |
| EL-M12-S5-182 | text | conditional | Hanya 53 daripada 184 pelajar T4/T5 (53) menggunakan platform. Data perbandingan terhad kepada pelajar akti… | FN-M12-6.9.1 |
| EL-M12-S5-183 | text | conditional | Purata ketepatan pelajar aktif dalam platform: 75.6%. Ini bersamaan anggaran gred A-. | FN-M12-6.9.1 |
| EL-M12-S5-184 | text | conditional | GPS keseluruhan dari headcount (tahun 2026): 4. Trend menunjukkan peningkatan dari tahun ke tahun. | FN-M12-6.9.1 |

#### S6 — `/admin/kirkpatrick/chain` (67 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M12-S6-001 | heading | visible-default | Model Kirkpatrick — Rantaian Impak | FN-M12-7.1.1 |
| EL-M12-S6-002 | text | visible-default | Bukti keberkesanan Prestasi Plus berdasarkan 4 Tahap Kirkpatrick | FN-M12-7.1.1 |
| EL-M12-S6-003 | link | visible-default | Muat Turun Laporan, → /admin/kirkpatrick/export-pdf, svg | FN-M12-7.1.2 |
| EL-M12-S6-004 | link | visible-default | ← Kembali, → /admin/kirkpatrick | FN-M12-7.1.1 |
| EL-M12-S6-005 | card | visible-default | T1 | FN-M12-7.2.1 |
| EL-M12-S6-006 | badge | visible-default | T1 | FN-M12-7.2.1 |
| EL-M12-S6-007 | text | visible-default | Reaksi | FN-M12-7.2.1 |
| EL-M12-S6-008 | text | visible-default | Kepuasan pengguna terhadap Prestasi Plus | FN-M12-7.2.1 |
| EL-M12-S6-009 | text | visible-default | NPS Purata | FN-M12-7.2.1 |
| EL-M12-S6-010 | text | visible-default | 8.3/10 | FN-M12-7.2.1 |
| EL-M12-S6-011 | text | visible-default | Kepuasan | FN-M12-7.2.1 |
| EL-M12-S6-012 | text | visible-default | 4.6/5 | FN-M12-7.2.1 |
| EL-M12-S6-013 | text | visible-default | Responden | FN-M12-7.2.1 |
| EL-M12-S6-014 | text | visible-default | 336 | FN-M12-7.2.1 |
| EL-M12-S6-015 | text | visible-default · desktop-only | → | FN-M12-7.2.5 |
| EL-M12-S6-016 | card | visible-default | T2 | FN-M12-7.2.2 |
| EL-M12-S6-017 | badge | visible-default | T2 | FN-M12-7.2.2 |
| EL-M12-S6-018 | text | visible-default | Pembelajaran | FN-M12-7.2.2 |
| EL-M12-S6-019 | text | visible-default | Perkembangan akademik melalui Head Count | FN-M12-7.2.2 |
| EL-M12-S6-020 | text | visible-default | Ketepatan | FN-M12-7.2.2 |
| EL-M12-S6-021 | text | visible-default | 82.8% | FN-M12-7.2.2 |
| EL-M12-S6-022 | text | visible-default | Soalan Dijawab | FN-M12-7.2.2 |
| EL-M12-S6-023 | text | visible-default | 306,133 | FN-M12-7.2.2 |
| EL-M12-S6-024 | text | visible-default | Skor Purata | FN-M12-7.2.2 |
| EL-M12-S6-025 | text | visible-default | 80.3% | FN-M12-7.2.2 |
| EL-M12-S6-026 | text | visible-default · desktop-only | → | FN-M12-7.2.5 |
| EL-M12-S6-027 | card | visible-default | T3 | FN-M12-7.2.3 |
| EL-M12-S6-028 | badge | visible-default | T3 | FN-M12-7.2.3 |
| EL-M12-S6-029 | text | visible-default | Tingkah Laku | FN-M12-7.2.3 |
| EL-M12-S6-030 | text | visible-default | Konsistensi penggunaan platform (Mastery Learning) | FN-M12-7.2.3 |
| EL-M12-S6-031 | text | visible-default | Pelajar Aktif | FN-M12-7.2.3 |
| EL-M12-S6-032 | text | visible-default | 951/4158 (22.9%) | FN-M12-7.2.3 |
| EL-M12-S6-033 | text | visible-default | Sesi Latihan | FN-M12-7.2.3 |
| EL-M12-S6-034 | text | visible-default | 20,991 | FN-M12-7.2.3 |
| EL-M12-S6-035 | text | visible-default | Taburan Konsistensi: | FN-M12-7.2.3 |
| EL-M12-S6-036 | text | visible-default | Champion | FN-M12-7.2.3 |
| EL-M12-S6-037 | text | visible-default | 513 | FN-M12-7.2.3 |
| EL-M12-S6-038 | text | visible-default | Consistent | FN-M12-7.2.3 |
| EL-M12-S6-039 | text | visible-default | 259 | FN-M12-7.2.3 |
| EL-M12-S6-040 | text | visible-default | Developing | FN-M12-7.2.3 |
| EL-M12-S6-041 | text | visible-default | 169 | FN-M12-7.2.3 |
| EL-M12-S6-042 | text | visible-default | Minimal | FN-M12-7.2.3 |
| EL-M12-S6-043 | text | visible-default | 5 | FN-M12-7.2.3 |
| EL-M12-S6-044 | text | visible-default | Disengaged | FN-M12-7.2.3 |
| EL-M12-S6-045 | text | visible-default | 3207 | FN-M12-7.2.3 |
| EL-M12-S6-046 | text | visible-default · desktop-only | → | FN-M12-7.2.5 |
| EL-M12-S6-047 | card | visible-default | T4 | FN-M12-7.2.4 |
| EL-M12-S6-048 | badge | visible-default | T4 | FN-M12-7.2.4 |
| EL-M12-S6-049 | text | visible-default | Hasil / Impak | FN-M12-7.2.4 |
| EL-M12-S6-050 | text | visible-default | Korelasi penggunaan dengan pencapaian | FN-M12-7.2.4 |
| EL-M12-S6-051 | text | visible-default | GPS | FN-M12-7.2.4 |
| EL-M12-S6-052 | text | visible-default | 4.30 | FN-M12-7.2.4 |
| EL-M12-S6-053 | text | visible-default | Korelasi (r) | FN-M12-7.2.4 |
| EL-M12-S6-054 | text | visible-default | 0.1298 | FN-M12-7.2.4 |
| EL-M12-S6-055 | text | visible-default | Kekuatan | FN-M12-7.2.4 |
| EL-M12-S6-056 | text | visible-default | Lemah | FN-M12-7.2.4 |
| EL-M12-S6-057 | card | visible-default | Analisis Korelasi: Penggunaan → Pencapaian | FN-M12-7.3.1 |
| EL-M12-S6-058 | heading | visible-default | Analisis Korelasi: Penggunaan → Pencapaian | FN-M12-7.3.1 |
| EL-M12-S6-059 | table | visible-default | table: Tahap Penggunaan · Bil. Pelajar · Purata Ketepatan · Visual (4 rows) | FN-M12-7.3.1 |
| EL-M12-S6-060 | text | visible-default | Pelajar yang menjawab 100+ soalan mencapai ketepatan 75.2%, berbanding 59.7% bagi pelajar dengan kurang 20 … | FN-M12-7.3.2 |
| EL-M12-S6-061 | text | visible-default | Kesimpulan ALESA: | FN-M12-7.3.2 |
| EL-M12-S6-062 | heading | visible-default | Kesimpulan Model Kirkpatrick | FN-M12-7.4.1 |
| EL-M12-S6-063 | text | visible-default | Berdasarkan analisis empat tahap Model Kirkpatrick, Prestasi Plus menunjukkan keberkesanan sebagai platform… | FN-M12-7.4.1 |
| EL-M12-S6-064 | text | visible-default | Tahap 1 (Reaksi) | FN-M12-7.4.1 |
| EL-M12-S6-065 | text | visible-default | Tahap 2 (Pembelajaran) | FN-M12-7.4.1 |
| EL-M12-S6-066 | text | visible-default | Tahap 3 (Tingkah Laku) | FN-M12-7.4.1 |
| EL-M12-S6-067 | text | visible-default | Tahap 4 (Hasil) | FN-M12-7.4.1 |

#### S7 — `/admin/kirkpatrick/interventions` (49 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M12-S7-001 | link | visible-default | Overview, → /admin/kirkpatrick, fa-th-large | FN-M12-1.1.9 |
| EL-M12-S7-002 | link | visible-default | T1: Reaksi, → /admin/kirkpatrick/reaction, fa-smile | FN-M12-1.1.9 |
| EL-M12-S7-003 | link | visible-default | T2: Pembelajaran, → /admin/kirkpatrick/learning, fa-brain | FN-M12-1.1.9 |
| EL-M12-S7-004 | link | visible-default | T3: Tingkah Laku, → /admin/kirkpatrick/behavior, fa-running | FN-M12-1.1.9 |
| EL-M12-S7-005 | link | visible-default | T4: Hasil, → /admin/kirkpatrick/results, fa-trophy | FN-M12-1.1.9 |
| EL-M12-S7-006 | link | visible-default | Intervensi, → /admin/kirkpatrick/interventions, fa-hand-holding-medical | FN-M12-1.1.9 |
| EL-M12-S7-007 | card | visible-default | 0 | FN-M12-8.1.1 |
| EL-M12-S7-008 | text | visible-default | Jumlah Intervensi | FN-M12-8.1.1 |
| EL-M12-S7-009 | text | visible-default | 0 | FN-M12-8.1.1 |
| EL-M12-S7-010 | card | visible-default | 0 | FN-M12-8.1.1 |
| EL-M12-S7-011 | text | visible-default | Menunggu Semakan | FN-M12-8.1.1 |
| EL-M12-S7-012 | text | visible-default | 0 | FN-M12-8.1.1 |
| EL-M12-S7-013 | card | visible-default | 0 | FN-M12-8.1.1 |
| EL-M12-S7-014 | text | visible-default | Meningkat | FN-M12-8.1.1 |
| EL-M12-S7-015 | text | visible-default | 0 | FN-M12-8.1.1 |
| EL-M12-S7-016 | card | visible-default | 0 | FN-M12-8.1.1 |
| EL-M12-S7-017 | text | visible-default | Menurun | FN-M12-8.1.1 |
| EL-M12-S7-018 | text | visible-default | 0 | FN-M12-8.1.1 |
| EL-M12-S7-019 | card | visible-default | Rekod Intervensi Baru | FN-M12-8.2.1 |
| EL-M12-S7-020 | dropdown-trigger | visible-default | Rekod Intervensi Baru, fa-plus-circle | FN-M12-8.2.1 |
| EL-M12-S7-021 | heading | visible-default | Rekod Intervensi Baru | FN-M12-8.2.1 |
| EL-M12-S7-022 | form | conditional | POST /admin/kirkpatrick/interventions | FN-M12-8.2.2 |
| EL-M12-S7-023 | hidden-field | hidden-only | `_token` | FN-M12-8.2.2 |
| EL-M12-S7-024 | label | conditional | Pelajar (ID) | FN-M12-8.2.2 |
| EL-M12-S7-025 | input | conditional | Pelajar (ID), `student_id` | FN-M12-8.2.2 |
| EL-M12-S7-026 | label | conditional | Jenis Amaran | FN-M12-8.2.2 |
| EL-M12-S7-027 | select | conditional | Jenis Amaran, `alert_type` (3 options) | FN-M12-8.2.2 |
| EL-M12-S7-028 | label | conditional | Tarikh Tindakan | FN-M12-8.2.2 |
| EL-M12-S7-029 | input | conditional | Tarikh Tindakan, `action_date` | FN-M12-8.2.2 |
| EL-M12-S7-030 | label | conditional | Penerangan Amaran | FN-M12-8.2.2 |
| EL-M12-S7-031 | textarea | conditional | Penerangan Amaran, `alert_description` | FN-M12-8.2.2 |
| EL-M12-S7-032 | label | conditional | Tindakan Diambil | FN-M12-8.2.2 |
| EL-M12-S7-033 | textarea | conditional | Tindakan Diambil, `action_taken` | FN-M12-8.2.2 |
| EL-M12-S7-034 | label | conditional | Ketepatan Sebelum (%) | FN-M12-8.2.2 |
| EL-M12-S7-035 | input | conditional | Ketepatan Sebelum (%), `before_accuracy` | FN-M12-8.2.2 |
| EL-M12-S7-036 | label | conditional | Mood Sebelum | FN-M12-8.2.2 |
| EL-M12-S7-037 | select | conditional | Mood Sebelum, `before_mood` (5 options) | FN-M12-8.2.2 |
| EL-M12-S7-038 | label | conditional | Ketepatan Selepas (%) | FN-M12-8.2.2 |
| EL-M12-S7-039 | input | conditional | Ketepatan Selepas (%), `after_accuracy` | FN-M12-8.2.2 |
| EL-M12-S7-040 | label | conditional | Mood Selepas | FN-M12-8.2.2 |
| EL-M12-S7-041 | select | conditional | Mood Selepas, `after_mood` (5 options) | FN-M12-8.2.2 |
| EL-M12-S7-042 | button | conditional | Simpan Intervensi, fa-save | FN-M12-8.2.3 |
| EL-M12-S7-043 | card | visible-default | Senarai Intervensi | FN-M12-8.3.1 |
| EL-M12-S7-044 | heading | visible-default | Senarai Intervensi | FN-M12-8.3.1 |
| EL-M12-S7-045 | empty-state | visible-default | Tiada intervensi direkodkan lagi. | FN-M12-8.3.1 |
| EL-M12-S7-046 | text | visible-default | Klik "Ambil Tindakan" pada amaran di halaman Tingkah Laku untuk mula. | FN-M12-8.3.1 |
| EL-M12-S7-047 | heading | conditional | Oops! An Error Occurred | FN-M12-1.2.6 |
| EL-M12-S7-048 | heading | conditional | The server returned a "405 Method Not Allowed". | FN-M12-1.2.6 |
| EL-M12-S7-049 | text | conditional | Something is broken. Please let us know what you were doing when this error occurred. We will fix it as soo… | FN-M12-1.2.6 |

#### S8 — `/admin/kirkpatrick/pelajar/{id}` (80 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M12-S8-001 | heading | visible-default | <person> | FN-M12-9.1.1 |
| EL-M12-S8-002 | text | visible-default | <school> · Tingkatan 5 | FN-M12-9.1.1 |
| EL-M12-S8-003 | link | visible-default | ← Kembali ke Tahap 3, → /admin/kirkpatrick/behavior | FN-M12-9.1.1 |
| EL-M12-S8-004 | badge | visible-default | AI | FN-M12-9.2.1 |
| EL-M12-S8-005 | text | visible-default | ALESA — Analisis Tingkah Laku Kirkpatrick | FN-M12-9.2.1 |
| EL-M12-S8-006 | text | visible-default | Penggunaan Prestasi Plus oleh <person> masih pada tahap minimum dengan hanya 4 hari aktif. Disarankan untuk… | FN-M12-9.2.1 |
| EL-M12-S8-007 | text | visible-default | 219 | FN-M12-9.2.2 |
| EL-M12-S8-008 | text | visible-default | Soalan | FN-M12-9.2.2 |
| EL-M12-S8-009 | text | visible-default | 73.1% | FN-M12-9.2.2 |
| EL-M12-S8-010 | text | visible-default | Ketepatan | FN-M12-9.2.2 |
| EL-M12-S8-011 | text | visible-default | 22.5 | FN-M12-9.2.2 |
| EL-M12-S8-012 | text | visible-default | Konsistensi | FN-M12-9.2.2 |
| EL-M12-S8-013 | text | visible-default | 1d | FN-M12-9.2.2 |
| EL-M12-S8-014 | text | visible-default | Streak | FN-M12-9.2.2 |
| EL-M12-S8-015 | text | visible-default | Terkuat: · Perlu perhatian: | FN-M12-9.2.3 |
| EL-M12-S8-016 | text | visible-default | Sejarah (78.9%) | FN-M12-9.2.3 |
| EL-M12-S8-017 | text | visible-default | Matematik (16.7%) | FN-M12-9.2.3 |
| EL-M12-S8-018 | card | visible-default | Tahap 2 — Head Count | FN-M12-9.3.1 |
| EL-M12-S8-019 | heading | visible-default | Tahap 2 — Head Count | FN-M12-9.3.1 |
| EL-M12-S8-020 | heading | visible-default | 2026 — Head Count | FN-M12-9.3.1 |
| EL-M12-S8-021 | text | visible-default | Bahasa Inggeris | FN-M12-9.3.1 |
| EL-M12-S8-022 | text | visible-default | - | FN-M12-9.3.1 |
| EL-M12-S8-023 | text | visible-default | Bahasa Melayu | FN-M12-9.3.1 |
| EL-M12-S8-024 | text | visible-default | - | FN-M12-9.3.1 |
| EL-M12-S8-025 | text | visible-default | Matematik | FN-M12-9.3.1 |
| EL-M12-S8-026 | text | visible-default | - | FN-M12-9.3.1 |
| EL-M12-S8-027 | text | visible-default | Pendidikan Islam | FN-M12-9.3.1 |
| EL-M12-S8-028 | text | visible-default | TOV:78.00 | FN-M12-9.3.1 |
| EL-M12-S8-029 | text | visible-default | Pendidikan Jasmani & Kesihatan | FN-M12-9.3.1 |
| EL-M12-S8-030 | text | visible-default | - | FN-M12-9.3.1 |
| EL-M12-S8-031 | text | visible-default | Pendidikan Moral | FN-M12-9.3.1 |
| EL-M12-S8-032 | text | visible-default | - | FN-M12-9.3.1 |
| EL-M12-S8-033 | text | visible-default | Perniagaan | FN-M12-9.3.1 |
| EL-M12-S8-034 | text | visible-default | - | FN-M12-9.3.1 |
| EL-M12-S8-035 | text | visible-default | Pertanian | FN-M12-9.3.1 |
| EL-M12-S8-036 | text | visible-default | - | FN-M12-9.3.1 |
| EL-M12-S8-037 | text | visible-default | Prinsip Perakaunan | FN-M12-9.3.1 |
| EL-M12-S8-038 | text | visible-default | - | FN-M12-9.3.1 |
| EL-M12-S8-039 | text | visible-default | Sains | FN-M12-9.3.1 |
| EL-M12-S8-040 | text | visible-default | - | FN-M12-9.3.1 |
| EL-M12-S8-041 | text | visible-default | Sains Komputer | FN-M12-9.3.1 |
| EL-M12-S8-042 | text | visible-default | - | FN-M12-9.3.1 |
| EL-M12-S8-043 | text | visible-default | Sejarah | FN-M12-9.3.1 |
| EL-M12-S8-044 | text | visible-default | - | FN-M12-9.3.1 |
| EL-M12-S8-045 | card | visible-default | Tahap 2 — Prestasi Platform | FN-M12-9.4.1 |
| EL-M12-S8-046 | heading | visible-default | Tahap 2 — Prestasi Platform | FN-M12-9.4.1 |
| EL-M12-S8-047 | text | visible-default | Sejarah | FN-M12-9.4.1 |
| EL-M12-S8-048 | text | visible-default | 78.9% (190) | FN-M12-9.4.1 |
| EL-M12-S8-049 | text | visible-default | Sains | FN-M12-9.4.1 |
| EL-M12-S8-050 | text | visible-default | 39.1% (23) | FN-M12-9.4.1 |
| EL-M12-S8-051 | text | visible-default | Matematik | FN-M12-9.4.1 |
| EL-M12-S8-052 | text | visible-default | 16.7% (6) | FN-M12-9.4.1 |
| EL-M12-S8-053 | text | conditional | Penggunaan Prestasi Plus oleh <person> masih pada tahap minimum dengan hanya 3 hari aktif. Disarankan untuk… | FN-M12-9.2.1 |
| EL-M12-S8-054 | text | conditional | 38.6% | FN-M12-9.2.2 |
| EL-M12-S8-055 | text | conditional | Bahasa Melayu (60.0%) | FN-M12-9.2.3 |
| EL-M12-S8-056 | text | conditional | Sejarah (0.0%) | FN-M12-9.2.3 |
| EL-M12-S8-057 | text | conditional | TOV:20.00 | FN-M12-9.3.1 |
| EL-M12-S8-058 | text | conditional | TOV:60.00 | FN-M12-9.3.1 |
| EL-M12-S8-059 | text | conditional | TOV:40.00 | FN-M12-9.3.1 |
| EL-M12-S8-060 | text | conditional | TOV:55.00 | FN-M12-9.3.1 |
| EL-M12-S8-061 | text | conditional | TOV:33.33 | FN-M12-9.3.1 |
| EL-M12-S8-062 | text | conditional | Sains Rumah Tangga | FN-M12-9.3.1 |
| EL-M12-S8-063 | text | conditional | Sains Sukan | FN-M12-9.3.1 |
| EL-M12-S8-064 | text | conditional | TOV:37.00 | FN-M12-9.3.1 |
| EL-M12-S8-065 | text | conditional | Bahasa Melayu | FN-M12-9.4.1 |
| EL-M12-S8-066 | text | conditional | 60.0% (5) | FN-M12-9.4.1 |
| EL-M12-S8-067 | text | conditional | Pendidikan Islam | FN-M12-9.4.1 |
| EL-M12-S8-068 | text | conditional | 55.0% (20) | FN-M12-9.4.1 |
| EL-M12-S8-069 | text | conditional | 40.0% (15) | FN-M12-9.4.1 |
| EL-M12-S8-070 | text | conditional | 33.3% (15) | FN-M12-9.4.1 |
| EL-M12-S8-071 | text | conditional | Bahasa Inggeris | FN-M12-9.4.1 |
| EL-M12-S8-072 | text | conditional | 20.0% (10) | FN-M12-9.4.1 |
| EL-M12-S8-073 | text | conditional | 0.0% (5) | FN-M12-9.4.1 |
| EL-M12-S8-074 | text | conditional | 403 | FN-M12-1.2.7 |
| EL-M12-S8-075 | text | conditional | 🚫 | FN-M12-1.2.7 |
| EL-M12-S8-076 | heading | conditional | <person> | FN-M12-1.2.7 |
| EL-M12-S8-077 | text | conditional | Anda tidak mempunyai kebenaran untuk mengakses halaman ini. Sila log masuk dengan akaun yang betul atau hub… | FN-M12-1.2.7 |
| EL-M12-S8-078 | link | conditional | Halaman Utama, → / | FN-M12-1.2.7 |
| EL-M12-S8-079 | link | conditional | Log Masuk, → /login | FN-M12-1.2.7 |
| EL-M12-S8-080 | text | conditional | PRESTASIPLUS | FN-M12-1.2.7 |

#### S9 — `/kirkpatrick` (45 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M12-S9-001 | text | hidden-only | LIVE:, fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M12-S9-002 | text | hidden-only | MAIN | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M12-S9-003 | text | hidden-only | DAFTAR | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M12-S9-004 | heading | visible-default | Kirkpatrick — Prestasi Saya | FN-M12-10.1.1 |
| EL-M12-S9-005 | text | visible-default | Perkembangan pembelajaran berdasarkan 4 Tahap Model Kirkpatrick | FN-M12-10.1.1 |
| EL-M12-S9-006 | card | visible-default | Tahap 2 — Pembelajaran (Head Count) | FN-M12-10.1.2 |
| EL-M12-S9-007 | heading | visible-default | Tahap 2 — Pembelajaran (Head Count) | FN-M12-10.1.2 |
| EL-M12-S9-008 | text | visible-default | Perkembangan gred mengikut subjek dari peperiksaan sekolah | FN-M12-10.1.2 |
| EL-M12-S9-009 | empty-state | visible-default | Tiada data Head Count. Guru perlu muat naik keputusan peperiksaan. | FN-M12-10.1.2 |
| EL-M12-S9-010 | card | visible-default | Tahap 3 — Rekod Aktiviti (30 Hari) | FN-M12-10.1.3 |
| EL-M12-S9-011 | heading | visible-default | Tahap 3 — Rekod Aktiviti (30 Hari) | FN-M12-10.1.3 |
| EL-M12-S9-012 | tooltip | visible-default | 27/08: 0 soalan | FN-M12-10.1.3 |
| EL-M12-S9-013 | tooltip | visible-default | 28/08: 0 soalan | FN-M12-10.1.3 |
| EL-M12-S9-014 | tooltip | visible-default | 29/08: 0 soalan | FN-M12-10.1.3 |
| EL-M12-S9-015 | tooltip | visible-default | 30/08: 0 soalan | FN-M12-10.1.3 |
| EL-M12-S9-016 | tooltip | visible-default | 31/08: 0 soalan | FN-M12-10.1.3 |
| EL-M12-S9-017 | tooltip | visible-default | 01/09: 0 soalan | FN-M12-10.1.3 |
| EL-M12-S9-018 | tooltip | visible-default | 02/09: 0 soalan | FN-M12-10.1.3 |
| EL-M12-S9-019 | tooltip | visible-default | 03/09: 0 soalan | FN-M12-10.1.3 |
| EL-M12-S9-020 | tooltip | visible-default | 04/09: 0 soalan | FN-M12-10.1.3 |
| EL-M12-S9-021 | tooltip | visible-default | 05/09: 0 soalan | FN-M12-10.1.3 |
| EL-M12-S9-022 | tooltip | visible-default | 06/09: 0 soalan | FN-M12-10.1.3 |
| EL-M12-S9-023 | tooltip | visible-default | 07/09: 0 soalan | FN-M12-10.1.3 |
| EL-M12-S9-024 | tooltip | visible-default | 08/09: 0 soalan | FN-M12-10.1.3 |
| EL-M12-S9-025 | tooltip | visible-default | 09/09: 0 soalan | FN-M12-10.1.3 |
| EL-M12-S9-026 | tooltip | visible-default | 10/09: 0 soalan | FN-M12-10.1.3 |
| EL-M12-S9-027 | tooltip | visible-default | 11/09: 0 soalan | FN-M12-10.1.3 |
| EL-M12-S9-028 | tooltip | visible-default | 12/09: 0 soalan | FN-M12-10.1.3 |
| EL-M12-S9-029 | tooltip | visible-default | 13/09: 0 soalan | FN-M12-10.1.3 |
| EL-M12-S9-030 | tooltip | visible-default | 14/09: 0 soalan | FN-M12-10.1.3 |
| EL-M12-S9-031 | tooltip | visible-default | 15/09: 0 soalan | FN-M12-10.1.3 |
| EL-M12-S9-032 | tooltip | visible-default | 16/09: 0 soalan | FN-M12-10.1.3 |
| EL-M12-S9-033 | tooltip | visible-default | 17/09: 0 soalan | FN-M12-10.1.3 |
| EL-M12-S9-034 | tooltip | visible-default | 18/09: 0 soalan | FN-M12-10.1.3 |
| EL-M12-S9-035 | tooltip | visible-default | 19/09: 0 soalan | FN-M12-10.1.3 |
| EL-M12-S9-036 | tooltip | visible-default | 20/09: 0 soalan | FN-M12-10.1.3 |
| EL-M12-S9-037 | tooltip | visible-default | 21/09: 0 soalan | FN-M12-10.1.3 |
| EL-M12-S9-038 | tooltip | visible-default | 22/09: 0 soalan | FN-M12-10.1.3 |
| EL-M12-S9-039 | tooltip | visible-default | 23/09: 0 soalan | FN-M12-10.1.3 |
| EL-M12-S9-040 | tooltip | visible-default | 24/09: 0 soalan | FN-M12-10.1.3 |
| EL-M12-S9-041 | tooltip | visible-default | 25/09: 0 soalan | FN-M12-10.1.3 |
| EL-M12-S9-042 | text | visible-default | Kurang | FN-M12-10.1.3 |
| EL-M12-S9-043 | text | visible-default | Banyak | FN-M12-10.1.3 |
| EL-M12-S9-044 | heading | visible-default | Tahap 4 — Kesimpulan | FN-M12-10.1.4 |
| EL-M12-S9-045 | text | visible-default | Mulakan latihan secara berkala di Prestasi Plus. Kajian Kirkpatrick menunjukkan pelajar yang konsisten berl… | FN-M12-10.1.4 |

#### S10 — `/maklum-balas` (7 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M12-S10-001 | text | hidden-only | LIVE:, fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M12-S10-002 | text | hidden-only | MAIN | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M12-S10-003 | text | hidden-only | DAFTAR | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M12-S10-004 | card | visible-default | Terima Kasih! | FN-M12-11.1.1 |
| EL-M12-S10-005 | heading | visible-default | Terima Kasih! | FN-M12-11.1.1 |
| EL-M12-S10-006 | text | visible-default | Anda sudah mengisi maklum balas untuk bulan ini. Sila kembali bulan depan. | FN-M12-11.1.1 |
| EL-M12-S10-007 | link | visible-default | Kembali ke Dashboard, → /dashboard | FN-M12-11.1.1 |

### 6.2 Shell elements

The shells are specified by the global shell doc (`docs/design/shells.md`, 00-global-ui); they are listed here so that every captured element is accounted for. Rows mapped to an M12 FN are the Kirkpatrick menu entries and the header title/subtitle of M12 screens.

#### SHA — admin-panel shell (chrome of S1–S8) — 219 elements, 25 M12-relevant

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M12-SHA-001 | link | visible-default · desktop-only | → /admin | Excluded — global shell: logo and brand (SHA-001–003) |
| EL-M12-SHA-002 | image | visible-default · desktop-only | — | Excluded — global shell: logo and brand (SHA-001–003) |
| EL-M12-SHA-003 | text | visible-default · desktop-only | Panel Pentadbir | Excluded — global shell: logo and brand (SHA-001–003) |
| EL-M12-SHA-004 | link | visible-default · desktop-only | Command Center LIVE, → /admin/command-center, fa-satellite-dish | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-005 | badge | visible-default · desktop-only | LIVE | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-006 | link | visible-default · desktop-only | Aktiviti Harian, → /admin/command-center/daily-activity, fa-chart-line | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-007 | link | visible-default · desktop-only | Audio KBAT, → /admin/audio-kbat, fa-headphones | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-008 | text | visible-default · desktop-only | HARIAN | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-009 | link | visible-default · desktop-only | Dashboard, → /admin, fa-tachometer-alt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-010 | link | visible-default · desktop-only | Laporan Eksekutif, → /admin/laporan-eksekutif, fa-file-alt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-011 | text | visible-default · desktop-only | ANALITIK | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-012 | link | visible-default · desktop-only | Analitik, → /admin/analytics, fa-chart-pie | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-013 | link | visible-default · desktop-only | Monitoring, → /admin/monitoring, fa-binoculars | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-014 | toggle | visible-default · desktop-only | Kirkpatrick, fa-microscope | FN-M12-1.1.1 |
| EL-M12-SHA-015 | link | hidden-only | Overview, → /admin/kirkpatrick, fa-th-large | FN-M12-1.1.1 |
| EL-M12-SHA-016 | link | hidden-only | T1: Reaksi, → /admin/kirkpatrick/reaction, fa-smile | FN-M12-1.1.1 |
| EL-M12-SHA-017 | link | hidden-only | T2: Pembelajaran, → /admin/kirkpatrick/learning, fa-brain | FN-M12-1.1.1 |
| EL-M12-SHA-018 | link | hidden-only | T3: Tingkah Laku, → /admin/kirkpatrick/behavior, fa-running | FN-M12-1.1.1 |
| EL-M12-SHA-019 | link | hidden-only | T4: Hasil, → /admin/kirkpatrick/results, fa-trophy | FN-M12-1.1.1 |
| EL-M12-SHA-020 | link | hidden-only | Rantaian Impak, → /admin/kirkpatrick/chain, fa-link | FN-M12-1.1.1 |
| EL-M12-SHA-021 | link | hidden-only | Intervensi, → /admin/kirkpatrick/interventions, fa-hand-holding-medical | FN-M12-1.1.1 |
| EL-M12-SHA-022 | link | visible-default · desktop-only | Laporan, → /admin/laporan, fa-chart-bar | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-023 | text | visible-default · desktop-only | PENGURUSAN | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-024 | toggle | visible-default · desktop-only | Kurikulum, fa-sitemap | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-025 | link | hidden-only | Kurikulum, → /admin/curriculum, fa-sitemap | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-026 | link | hidden-only | Subjek, → /admin/subjects, fa-book | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-027 | link | hidden-only | Tahap Pendidikan, → /admin/education-levels, fa-graduation-cap | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-028 | toggle | visible-default · desktop-only | Soalan, fa-question-circle | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-029 | link | hidden-only | Senarai Soalan, → /admin/questions, fa-list | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-030 | link | hidden-only | Import CSV, → /admin/questions/import, fa-file-csv | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-031 | link | hidden-only | Kualiti Soalan, → /admin/questions/quality, fa-clipboard-check | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-032 | link | hidden-only | Laporan Soalan, → /admin/question-reports, fa-flag | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-033 | link | hidden-only | Soalan Berstruktur, → /admin/structured-questions, fa-list-ol | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-034 | link | hidden-only | Kertas Soalan Guru, → /admin/question-submissions, fa-file-upload | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-035 | toggle | visible-default · desktop-only | Pengguna, fa-users | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-036 | link | hidden-only | Senarai Pengguna, → /admin/users, fa-users | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-037 | link | hidden-only | Sekolah, → /admin/schools, fa-school | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-038 | link | hidden-only | Langganan Sekolah, → /admin/school-subscriptions, fa-file-contract | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-039 | link | hidden-only | Import Pelajar, → /admin/import-students, fa-user-plus | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-040 | link | hidden-only | Pelajar Komplimen, → /admin/comp-students, fa-gift | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-041 | link | hidden-only | Import Pengguna, → /admin/users/bulk-import, fa-users-cog | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-042 | link | hidden-only | Penajaan, → /admin/sponsors, fa-handshake | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-043 | link | hidden-only | Anak Angkat, → /admin/anak-angkat, fa-child | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-044 | link | hidden-only | Permohonan, → /admin/anak-angkat/permohonan, fa-file-alt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-045 | toggle | visible-default · desktop-only | SPM, fa-graduation-cap | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-046 | link | hidden-only | Databank Soalan, → /spm/tahun-lepas, fa-database | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-047 | link | hidden-only | Latih Tubi, → /spm/latih-tubi, fa-bolt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-048 | link | hidden-only | Tracking A, → /spm/ramalan, fa-crosshairs | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-049 | link | hidden-only | Subjektif, → /spm/subjektif, fa-pen-fancy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-050 | toggle | visible-default · desktop-only | Premium, fa-shield-halved | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-051 | link | hidden-only | PKSK Soalan, → /admin/pksk/questions, fa-shield-halved | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-052 | link | hidden-only | PKSK Akses, → /admin/pksk/access, fa-key | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-053 | text | visible-default · desktop-only | SISTEM | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-054 | toggle | visible-default · desktop-only | Gamifikasi, fa-gamepad | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-055 | link | hidden-only | Overview, → /admin/gamification, fa-gamepad | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-056 | link | hidden-only | Tier Config, → /admin/gamification/tiers, fa-crown | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-057 | link | hidden-only | Cabaran, → /admin/gamification/challenges, fa-bullseye | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-058 | link | hidden-only | Pelajar, → /admin/gamification/students, fa-users | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-059 | link | hidden-only | Transaksi, → /admin/gamification/transactions, fa-receipt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-060 | link | hidden-only | Kedai Hadiah, → /admin/hadiah, fa-gift | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-061 | link | hidden-only | Gamifikasi Guru, → /admin/gamifikasi/guru, fa-chalkboard-teacher | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-062 | link | hidden-only | Kawalan Reward, → /admin/reward-control, fa-shield-halved | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-063 | toggle | visible-default · desktop-only | Battle & Permainan, fa-bolt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-064 | link | hidden-only | Battle Live, → /battle, fa-bolt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-065 | link | hidden-only | Ranking Sekolah, → /battle/ranking-sekolah, fa-school | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-066 | link | hidden-only | Leaderboard, → /battle/leaderboard, fa-trophy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-067 | link | hidden-only | Tetapan Permainan, → /admin/permainan, fa-dice | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-068 | toggle | visible-default · desktop-only | Marketplace, fa-shopping-bag | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-069 | link | hidden-only | Produk, → /admin/marketplace/products, fa-shopping-bag | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-070 | link | hidden-only | Penjual, → /admin/marketplace/sellers, fa-store | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-071 | toggle | visible-default · desktop-only | Kandungan, fa-newspaper | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-072 | link | hidden-only | Banner, → /admin/banners, fa-image | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-073 | link | hidden-only | Artikel, → /admin/articles, fa-newspaper | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-074 | link | hidden-only | Nota, → /admin/notes, fa-sticky-note | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-075 | link | hidden-only | Push Notifikasi, → /admin/notifications, fa-bell | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-076 | link | hidden-only | Upload Screenshot, → /admin/tools/screenshots, fa-cloud-upload-alt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-077 | toggle | visible-default · desktop-only | Kewangan, fa-credit-card | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-078 | link | hidden-only | Pembayaran, → /admin/payments, fa-credit-card | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-079 | link | hidden-only | Billing Dashboard, → /admin/billing, fa-chart-line | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-080 | link | hidden-only | Dunning Log, → /admin/dunning, fa-bell-slash | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-081 | toggle | visible-default · desktop-only | Sistem, fa-cog | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-082 | link | hidden-only | Performance, → /admin/performance, fa-gauge-high | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-083 | link | hidden-only | Tetapan, → /admin/settings, fa-cog | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-084 | link | hidden-only | Log Audit, → /admin/audit-logs, fa-clipboard-list | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-085 | link | hidden-only | Chatbot, → /admin/chatbot, fa-robot | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-086 | text | visible-default · desktop-only | 🏆 Bilik Duta | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-087 | badge | visible-default · desktop-only | DEV | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-088 | link | visible-default · desktop-only | Bilik Duta, → /bilik-duta, fa-crown | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-089 | link | visible-default · desktop-only | Akademi Duta, → /akademi-duta, fa-graduation-cap | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-090 | link | visible-default · desktop-only | Permohonan Duta, → /admin/duta-applications, fa-clipboard-check | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-091 | link | visible-default · desktop-only | Duta Dashboard, → /duta-dashboard, fa-user-tie | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-092 | link | visible-default · desktop-only | Jemput Duta, → /jemput-duta, fa-school | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-093 | link | visible-default · desktop-only | Kem & Bootcamp, → /bilik-duta/kem, fa-campground | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-094 | text | visible-default · desktop-only | 🤖 Pusat AI | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-095 | link | visible-default · desktop-only | Kamus AI, → /pusat-ai/kamus, fa-book-open | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-096 | link | visible-default · desktop-only | Aktiviti Advisor, → /pusat-ai/aktiviti, fa-lightbulb | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-097 | link | visible-default · desktop-only | Pendamping Motivasi, → /pusat-ai/pendamping, fa-heart | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-098 | link | visible-default · desktop-only | SPM Walkthrough, → /pusat-ai/spm, fa-pen-to-square | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-099 | link | visible-default · desktop-only | Whiteboard → Quiz, → /pusat-ai/whiteboard, fa-clipboard-question | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-100 | link | visible-default · desktop-only | Parent Whisperer, → /pusat-ai/parent-whisperer, fa-comments | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-101 | link | visible-default · desktop-only | Doa & Motivasi, → /pusat-ai/doa, fa-mosque | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-102 | text | visible-default · desktop-only | ✨ Visi & Pertandingan | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-103 | link | visible-default · desktop-only | Profil Cerah, → /profil-cerah, fa-magic | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-104 | link | visible-default · desktop-only | Sekolah Bersaing, → /sekolah-bersaing, fa-trophy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-105 | link | visible-default · desktop-only | Cita-Cita Hijrah, → /cita-cita, fa-star | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-106 | link | visible-default · desktop-only | Streak / Kombo, → /kombo, fa-fire | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-107 | text | visible-default · desktop-only | 💎 Killer Features | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-108 | link | visible-default · desktop-only | Cikgu Suara, → /cikgu-suara, fa-microphone | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-109 | link | visible-default · desktop-only | SPM Mock Exam, → /spm-mock, fa-file-pen | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-110 | link | visible-default · desktop-only | Wellbeing Alerts, → /wellbeing/alerts, fa-triangle-exclamation | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-111 | link | visible-default · desktop-only | Tetapan Peribadi, → /tetapan, fa-cog | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-112 | link | visible-default · desktop-only | Ke Dashboard, → /dashboard, fa-arrow-left | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-113 | card | visible-default · desktop-only | Admin PRESTASI+ | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-114 | image | visible-default · desktop-only | — | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-115 | text | visible-default · desktop-only | Admin PRESTASI+ | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-116 | text | visible-default · desktop-only | Admin | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-117 | link | visible-default · desktop-only | → /logout, fa-sign-out-alt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-118 | heading | visible-default | Kirkpatrick Evaluation | FN-M12-1.1.5 |
| EL-M12-SHA-119 | text | visible-default | Analisis Keberkesanan Platform — Model Penilaian 4 Tahap | FN-M12-1.1.5 |
| EL-M12-SHA-120 | tooltip | hidden-only | Uptime, fa-clock | Excluded — global shell server-status widget |
| EL-M12-SHA-121 | tooltip | visible-default · desktop-only | Load: 0.23 / 8 cores, fa-microchip | Excluded — global shell server-status widget |
| EL-M12-SHA-122 | text | visible-default · desktop-only | 3% | Excluded — global shell server-status widget |
| EL-M12-SHA-123 | tooltip | visible-default · desktop-only | 16.7GB / 31.1GB, fa-memory | Excluded — global shell server-status widget |
| EL-M12-SHA-124 | text | visible-default · desktop-only | 54% | Excluded — global shell server-status widget |
| EL-M12-SHA-125 | tooltip | visible-default · desktop-only | 199.3GB / 398.7GB, fa-hard-drive | Excluded — global shell server-status widget |
| EL-M12-SHA-126 | text | visible-default · desktop-only | 50% | Excluded — global shell server-status widget |
| EL-M12-SHA-127 | tooltip | visible-default · desktop-only | Uptime, fa-clock | Excluded — global shell server-status widget |
| EL-M12-SHA-128 | text | visible-default · desktop-only | 204d 8h | Excluded — global shell server-status widget |
| EL-M12-SHA-129 | image | visible-default · desktop-only | — | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-130 | link | visible-default · desktop-only | → /logout, fa-sign-out-alt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-131 | link | conditional · mobile-only | → /admin | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-132 | image | conditional · mobile-only | — | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-133 | text | visible-default | © 2026 PRESTASIPLUS. Hakcipta Terpelihara. | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-134 | text | visible-default | Didikan penuh dari Malaysia 🇲🇾 | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-135 | text | visible-default | ❤️ | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-136 | link | conditional · mobile-only | Dashboard, → /admin, fa-tachometer-alt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-137 | link | conditional · mobile-only | Soalan, → /admin/questions, fa-question-circle | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-138 | link | conditional · mobile-only | Penaja, → /admin/sponsors, fa-handshake | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-139 | link | conditional · mobile-only | Pengguna, → /admin/users, fa-users | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-140 | dropdown-trigger | conditional · mobile-only | Lagi, fa-ellipsis-h | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-141 | card | hidden-only | SPM | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-142 | link | hidden-only | Analitik, → /admin/analytics, fa-chart-pie | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-143 | link | hidden-only | Laporan Aktiviti, → /admin/laporan, fa-chart-bar | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-144 | link | hidden-only | Monitoring, → /admin/monitoring, fa-binoculars | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-145 | link | hidden-only | Kirkpatrick, → /admin/kirkpatrick, fa-microscope | FN-M12-1.1.2 |
| EL-M12-SHA-146 | text | hidden-only | SPM | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-147 | link | hidden-only | Databank Soalan, → /spm/tahun-lepas, fa-database | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-148 | link | hidden-only | Latih Tubi, → /spm/latih-tubi, fa-bolt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-149 | link | hidden-only | Tracking A, → /spm/ramalan, fa-crosshairs | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-150 | link | hidden-only | Subjektif, → /spm/subjektif, fa-pen-fancy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-151 | text | hidden-only | Soalan | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-152 | link | hidden-only | Import CSV, → /admin/questions/import, fa-file-csv | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-153 | link | hidden-only | Kualiti Soalan, → /admin/questions/quality, fa-clipboard-check | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-154 | link | hidden-only | Laporan Soalan, → /admin/question-reports, fa-flag | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-155 | link | hidden-only | Soalan Berstruktur, → /admin/structured-questions, fa-list-ol | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-156 | link | hidden-only | Kertas Soalan Guru, → /admin/question-submissions, fa-file-upload | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-157 | text | hidden-only | Kurikulum | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-158 | link | hidden-only | Kurikulum, → /admin/curriculum, fa-sitemap | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-159 | link | hidden-only | Subjek, → /admin/subjects, fa-book | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-160 | link | hidden-only | Tahap Pendidikan, → /admin/education-levels, fa-graduation-cap | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-161 | text | hidden-only | Premium | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-162 | link | hidden-only | PKSK Soalan, → /admin/pksk/questions, fa-shield-halved | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-163 | link | hidden-only | PKSK Akses, → /admin/pksk/access, fa-key | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-164 | text | hidden-only | Gamifikasi | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-165 | link | hidden-only | Overview, → /admin/gamification, fa-gamepad | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-166 | link | hidden-only | Tier Config, → /admin/gamification/tiers, fa-crown | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-167 | link | hidden-only | Cabaran, → /admin/gamification/challenges, fa-bullseye | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-168 | link | hidden-only | Kedai Hadiah, → /admin/hadiah, fa-gift | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-169 | link | hidden-only | Gamifikasi Guru, → /admin/gamifikasi/guru, fa-chalkboard-teacher | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-170 | text | hidden-only | Battle & Permainan | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-171 | link | hidden-only | Battle Live, → /battle, fa-bolt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-172 | link | hidden-only | Tetapan Permainan, → /admin/permainan, fa-dice | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-173 | text | hidden-only | Kandungan | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-174 | link | hidden-only | Banner, → /admin/banners, fa-image | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-175 | link | hidden-only | Artikel, → /admin/articles, fa-newspaper | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-176 | link | hidden-only | Nota, → /admin/notes, fa-sticky-note | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-177 | link | hidden-only | Push Notifikasi, → /admin/notifications, fa-bell | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-178 | link | hidden-only | Chatbot, → /admin/chatbot, fa-robot | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-179 | link | hidden-only | Upload Screenshot, → /admin/tools/screenshots, fa-cloud-upload-alt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-180 | text | hidden-only | Marketplace | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-181 | link | hidden-only | Produk, → /admin/marketplace/products, fa-shopping-bag | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-182 | link | hidden-only | Penjual, → /admin/marketplace/sellers, fa-store | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-183 | text | hidden-only | Sistem | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-184 | link | hidden-only | Sekolah, → /admin/schools, fa-school | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-185 | link | hidden-only | Langganan Sekolah, → /admin/school-subscriptions, fa-file-contract | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-186 | link | hidden-only | Tetapan, → /admin/settings, fa-cog | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-187 | link | hidden-only | Pembayaran, → /admin/payments, fa-credit-card | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-188 | link | hidden-only | Billing Dashboard, → /admin/billing, fa-chart-line | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-189 | link | hidden-only | Dunning Log, → /admin/dunning, fa-bell-slash | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-190 | link | hidden-only | Log Audit, → /admin/audit-logs, fa-clipboard-list | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-191 | link | hidden-only | Performance, → /admin/performance, fa-gauge-high | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-192 | link | hidden-only | Import Pelajar, → /admin/import-students, fa-user-plus | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-193 | link | hidden-only | Import Pengguna, → /admin/users/bulk-import, fa-users-cog | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-194 | link | hidden-only | Student View, → /dashboard, fa-arrow-left | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-195 | link | hidden-only | Log Keluar, → /logout, fa-sign-out-alt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHA-196 | tooltip | conditional | Load: 0.2 / 8 cores, fa-microchip | Excluded — global shell server-status widget |
| EL-M12-SHA-197 | heading | conditional | Tahap 1: Reaksi | FN-M12-1.1.5 |
| EL-M12-SHA-198 | text | conditional | Kepuasan dan persepsi pengguna terhadap platform | FN-M12-1.1.5 |
| EL-M12-SHA-199 | heading | conditional | Tahap 2: Pembelajaran | FN-M12-1.1.5 |
| EL-M12-SHA-200 | text | conditional | Peningkatan pengetahuan, kemahiran, dan kefahaman pelajar | FN-M12-1.1.5 |
| EL-M12-SHA-201 | tooltip | conditional | Load: 0.35 / 8 cores, fa-microchip | FN-M12-1.1.5 |
| EL-M12-SHA-202 | tooltip | conditional | Load: 0.66 / 8 cores, fa-microchip | FN-M12-1.1.5 |
| EL-M12-SHA-203 | heading | conditional | Tahap 3: Tingkah Laku | FN-M12-1.1.5 |
| EL-M12-SHA-204 | text | conditional | Konsistensi penggunaan, engagement score, dan corak tingkah laku pelajar | FN-M12-1.1.5 |
| EL-M12-SHA-205 | tooltip | hidden-only | Load: 0.73 / 8 cores, fa-microchip | Excluded — global shell server-status widget |
| EL-M12-SHA-206 | tooltip | conditional | 16.8GB / 31.1GB, fa-memory | Excluded — global shell server-status widget |
| EL-M12-SHA-207 | heading | conditional | Tahap 4: Hasil | FN-M12-1.1.5 |
| EL-M12-SHA-208 | text | conditional | Impak terhadap keputusan peperiksaan dan prestasi akademik | FN-M12-1.1.5 |
| EL-M12-SHA-209 | tooltip | conditional | Load: 0.7 / 8 cores, fa-microchip | Excluded — global shell server-status widget |
| EL-M12-SHA-210 | tooltip | conditional | Load: 0.75 / 8 cores, fa-microchip | Excluded — global shell server-status widget |
| EL-M12-SHA-211 | tooltip | hidden-only | Load: 0.59 / 8 cores, fa-microchip | Excluded — global shell server-status widget |
| EL-M12-SHA-212 | tooltip | hidden-only | Load: 0.89 / 8 cores, fa-microchip | Excluded — global shell server-status widget |
| EL-M12-SHA-213 | heading | conditional | Dashboard | FN-M12-1.1.6 |
| EL-M12-SHA-214 | text | conditional | Selamat datang, Admin | FN-M12-1.1.6 |
| EL-M12-SHA-215 | tooltip | conditional | Load: 0.79 / 8 cores, fa-microchip | Excluded — global shell server-status widget |
| EL-M12-SHA-216 | heading | conditional | Intervensi Pelajar | FN-M12-1.1.5 |
| EL-M12-SHA-217 | text | conditional | Rekod tindakan intervensi berdasarkan amaran Kirkpatrick | FN-M12-1.1.5 |
| EL-M12-SHA-218 | tooltip | conditional | Load: 0.85 / 8 cores, fa-microchip | Excluded — global shell server-status widget |
| EL-M12-SHA-219 | tooltip | hidden-only | Load: 0.8 / 8 cores, fa-microchip | Excluded — global shell server-status widget |

#### SHU — user-portal shell (chrome of S9, S10) — 372 elements, 10 M12-relevant

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M12-SHU-001 | link | visible-default · desktop-only | → /dashboard | Excluded — global shell: logo and brand (SHU-001–003) |
| EL-M12-SHU-002 | image | visible-default · desktop-only | — | Excluded — global shell: logo and brand (SHU-001–003) |
| EL-M12-SHU-003 | text | visible-default · desktop-only | Platform Latih Tubi Nasional | Excluded — global shell: logo and brand (SHU-001–003) |
| EL-M12-SHU-004 | link | visible-default · desktop-only | Dashboard, → /dashboard, fa-home | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-005 | link | visible-default · desktop-only | Target SPM, → /target-spm, fa-bullseye | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-006 | link | visible-default · desktop-only | Misi Harian, → /misi-harian, fa-rocket | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-007 | link | visible-default · desktop-only | Remedial, → /remedial/saya, fa-flask | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-008 | text | visible-default · desktop-only | SPM | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-009 | link | visible-default · desktop-only | SPM SPM, → /spm, fa-graduation-cap | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-010 | badge | visible-default · desktop-only | SPM | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-011 | link | visible-default · desktop-only | Headcount, → /headcount, fa-chart-line | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-012 | link | visible-default · desktop-only | Prestasi, → /prestasi, fa-chart-bar | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-013 | link | visible-default · desktop-only | Analitik Adaptif, → /analitik/pelajar, fa-brain | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-014 | link | visible-default · desktop-only | Analisa Item, → /analisa-item, fa-magnifying-glass-chart | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-015 | link | visible-default · desktop-only | Kombo, → /kombo, fa-fire | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-016 | link | visible-default · desktop-only | Laporan Mingguan, → /laporan-mingguan, fa-file-lines | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-017 | text | visible-default · desktop-only | Pusat AI | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-018 | badge | visible-default · desktop-only | NEW | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-019 | text | visible-default · desktop-only | 🤖 Cikgu Alesa AI | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-020 | link | visible-default · desktop-only | Cikgu Alesa Chat AI, → /cikgu, fa-robot | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-021 | badge | visible-default · desktop-only | AI | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-022 | text | visible-default · desktop-only | ✨ Visi & Pertandingan | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-023 | link | visible-default · desktop-only | Sekolah Bersaing NEW, → /sekolah-bersaing, fa-trophy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-024 | badge | visible-default · desktop-only | NEW | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-025 | link | visible-default · desktop-only | Tetapan Peribadi, → /tetapan, fa-cog | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-026 | text | visible-default · desktop-only | 🏆 Bilik Duta · 🔒 PREVIEW | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-027 | link | visible-default · desktop-only | Bilik Duta DEV, → /bilik-duta, fa-crown | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-028 | badge | visible-default · desktop-only | DEV | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-029 | text | visible-default · desktop-only | 🤖 AI Pintar (Pelajar) | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-030 | link | visible-default · desktop-only | Wellbeing Alerts, → /wellbeing/alerts, fa-triangle-exclamation | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-031 | link | visible-default · desktop-only | Kamus AI, → /pusat-ai/kamus, fa-book-open | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-032 | link | visible-default · desktop-only | Pendamping Motivasi, → /pusat-ai/pendamping, fa-heart | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-033 | link | visible-default · desktop-only | Doa & Motivasi, → /pusat-ai/doa, fa-mosque | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-034 | text | visible-default · desktop-only | 🎯 AI Pintar (Guru) | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-035 | link | visible-default · desktop-only | Aktiviti Advisor, → /pusat-ai/aktiviti, fa-lightbulb | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-036 | link | visible-default · desktop-only | Whiteboard → Quiz, → /pusat-ai/whiteboard, fa-clipboard-question | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-037 | link | visible-default · desktop-only | RPH (Cikgu Alesa), → /cikgu/rph, fa-clipboard-list | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-038 | link | visible-default · desktop-only | Semak Karangan (Cikgu Alesa), → /cikgu/essay, fa-pen-fancy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-039 | link | visible-default · desktop-only | PBD (Cikgu Alesa), → /cikgu/pbd, fa-tasks | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-040 | text | visible-default · desktop-only | 🛡️ Kawalan Kualiti | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-041 | link | visible-default · desktop-only | Semakan Nota Master, → /admin/master-notes, fa-shield-alt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-042 | link | visible-default · desktop-only | Audit Log, → /admin/audit-log, fa-clipboard-check | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-043 | text | visible-default · desktop-only | 🏆 Bilik Duta | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-044 | link | visible-default · desktop-only | Bilik Duta, → /bilik-duta, fa-crown | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-045 | link | visible-default · desktop-only | Akademi Duta, → /akademi-duta, fa-graduation-cap | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-046 | link | visible-default · desktop-only | Kem & Bootcamp, → /bilik-duta/kem, fa-campground | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-047 | text | visible-default · desktop-only | ✨ Visi & Pertandingan | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-048 | link | visible-default · desktop-only | Profil Cerah, → /profil-cerah, fa-magic | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-049 | link | visible-default · desktop-only | Sekolah Bersaing, → /sekolah-bersaing, fa-trophy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-050 | link | visible-default · desktop-only | Cita-Cita Hijrah, → /cita-cita, fa-star | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-051 | text | visible-default · desktop-only | 💎 Killer Features | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-052 | link | visible-default · desktop-only | Cikgu Suara, → /cikgu-suara, fa-microphone | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-053 | link | visible-default · desktop-only | SPM Mock Exam, → /spm-mock, fa-file-pen | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-054 | link | visible-default · desktop-only | Wellbeing Alerts, → /wellbeing/alerts, fa-triangle-exclamation | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-055 | link | visible-default · desktop-only | Pembetulan, → /pembetulan, fa-arrows-rotate | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-056 | link | visible-default · desktop-only | Mohon Keluarga Angkat, → /mohon-keluarga-angkat, fa-hand-holding-heart | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-057 | link | visible-default · desktop-only | Penguasaan, → /penguasaan, fa-layer-group | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-058 | link | visible-default · desktop-only | Laporan Soalan, → /laporan-soalan, fa-flag | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-059 | link | visible-default · desktop-only | Liga Pertandingan, → /liga, fa-trophy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-060 | link | visible-default · desktop-only | Perutusan, → /perutusan, fa-scroll | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-061 | text | visible-default · desktop-only | Pembelajaran | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-062 | link | visible-default · desktop-only | Latih Tubi, → /practice, fa-brain | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-063 | link | visible-default · desktop-only | Soalan by Chapter, → /practice/chapter, fa-layer-group | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-064 | link | visible-default · desktop-only | Soalan Berstruktur, → /latihan-berstruktur, fa-list-ol | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-065 | link | visible-default · desktop-only | Kedudukan, → /ranking, fa-trophy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-066 | link | visible-default · desktop-only | PKSK PRO, → /pksk, fa-shield-halved | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-067 | badge | visible-default · desktop-only | PRO | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-068 | link | visible-default · desktop-only | Artikel, → /artikel, fa-newspaper | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-069 | link | visible-default · desktop-only | Video, → /video, fa-play-circle | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-070 | link | visible-default · desktop-only | Permainan 🎮, → /permainan, fa-gamepad | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-071 | badge | visible-default · desktop-only | 🎮 | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-072 | link | visible-default · desktop-only | Cabutan Bertuah 🎟️, → /cabutan, fa-ticket | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-073 | badge | visible-default · desktop-only | 🎟️ | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-074 | link | visible-default · desktop-only | Tournament, → /tournament, fa-trophy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-075 | link | visible-default · desktop-only | Topik, → /topics, fa-book-open | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-076 | link | visible-default · desktop-only | Peta Belajar, → /peta-belajar, fa-map | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-077 | link | visible-default · desktop-only | Kelas Saya, → /kelas-saya, fa-book-reader | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-078 | link | visible-default · desktop-only | Set Soalan Guru, → /set-soalan-saya, fa-clipboard-list | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-079 | link | visible-default · desktop-only | Audio KBAT, → /audio-kbat, fa-headphones | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-080 | link | visible-default · desktop-only | Syiling & Token 🏆, → /gamification, fa-coins | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-081 | badge | visible-default · desktop-only | 🏆 | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-082 | link | visible-default · desktop-only | Tukar Token, → /gamification/convert, fa-exchange-alt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-083 | link | visible-default · desktop-only | Cabaran Harian, → /gamification/challenges, fa-bullseye | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-084 | link | visible-default · desktop-only | Kedai Hadiah, → /gamification/rewards, fa-gift | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-085 | link | visible-default · desktop-only | Kelulusan Hadiah, → /cikgu/kelulusan-hadiah, fa-shield-halved | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-086 | link | visible-default · desktop-only | Marketplace, → /marketplace, fa-shopping-bag | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-087 | link | visible-default · desktop-only | Papan Pendahulu, → /gamification/leaderboard, fa-trophy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-088 | link | visible-default · desktop-only | Pencapaian, → /gamification/achievements, fa-medal | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-089 | link | visible-default · desktop-only | Kotak Misteri, → /gamification/mystery-box, fa-box-open | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-090 | link | visible-default · desktop-only | Rujuk Kawan, → /gamification/referral, fa-user-plus | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-091 | link | visible-default · desktop-only | Cikgu Alesa AI, → /cikgu, fa-robot | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-092 | badge | visible-default · desktop-only | AI | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-093 | text | visible-default · desktop-only | Cikgu Alesa Tools | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-094 | link | visible-default · desktop-only | RPH (Rancangan Harian), → /cikgu/rph, fa-file-alt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-095 | link | visible-default · desktop-only | PBD Auto-Tag, → /cikgu/pbd, fa-clipboard-check | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-096 | link | visible-default · desktop-only | Mark Karangan, → /cikgu/essay, fa-pen-fancy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-097 | link | visible-default · desktop-only | Admin Tebusan, → /admin/hadiah, fa-cogs | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-098 | link | visible-default · desktop-only | Timeline Saya, → /timeline, fa-camera | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-099 | text | visible-default · desktop-only | Portal Guru | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-100 | link | visible-default · desktop-only | Dashboard Guru, → /guru, fa-chart-pie | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-101 | link | visible-default · desktop-only | Kelas Guru, → /guru/kelas, fa-chalkboard-teacher | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-102 | link | visible-default · desktop-only | Sumbang Soalan, → /guru/soalan, fa-pen-fancy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-103 | link | visible-default · desktop-only | Databank Soalan, → /guru/databank, fa-database | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-104 | text | visible-default · desktop-only | PPD / JPN | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-105 | link | visible-default · desktop-only | Dashboard PPD, → /ppd/dashboard, fa-building-columns | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-106 | link | visible-default · desktop-only | Statistik PPD, → /ppd/statistik-penggunaan, fa-chart-pie | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-107 | link | visible-default · desktop-only | Ranking Kebangsaan, → /ppd/ranking-kebangsaan, fa-trophy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-108 | link | visible-default · desktop-only | Dashboard JPN, → /jpn/dashboard, fa-building-flag | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-109 | link | visible-default · desktop-only | Ranking Kebangsaan JPN, → /jpn/ranking-kebangsaan, fa-trophy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-110 | text | visible-default · desktop-only | Admin | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-111 | link | visible-default · desktop-only | Ke Admin Panel, → /admin, fa-shield-halved | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-112 | link | visible-default · desktop-only | Soalan by Chapter, → /practice/chapter, fa-layer-group | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-113 | link | visible-default · desktop-only | Billing Dashboard, → /admin/billing, fa-chart-line | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-114 | link | visible-default · desktop-only | Urus Produk, → /admin/marketplace/products, fa-store | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-115 | link | visible-default · desktop-only | Urus Penjual, → /admin/marketplace/sellers, fa-user-tie | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-116 | link | visible-default · desktop-only | Urus Hadiah, → /admin/hadiah, fa-gift | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-117 | link | visible-default · desktop-only | Gamifikasi Guru, → /admin/gamifikasi/guru, fa-chalkboard-teacher | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-118 | link | visible-default · desktop-only | Kertas Soalan Guru, → /admin/question-submissions, fa-file-upload | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-119 | link | visible-default · desktop-only | Profil Saya, → /profile, fa-user-circle | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-120 | link | visible-default · desktop-only | Pakej 💎, → /pricing, fa-crown | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-121 | badge | visible-default · desktop-only | 💎 | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-122 | link | visible-default · desktop-only | Invois Saya, → /billing/invoices, fa-file-invoice | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-123 | link | visible-default · desktop-only | Panduan, → /panduan, fa-book | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-124 | text | visible-default · desktop-only | Bantuan | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-125 | link | visible-default · desktop-only | Tiket Bantuan, → /pusat-tuisyen/tiket, fa-life-ring | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-126 | link | visible-default · desktop-only | Gambar Rajah 6,144, → /admin/soalan-gambar, fa-images | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-127 | badge | visible-default · desktop-only | 6,144 | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-128 | link | visible-default · desktop-only | Urus Tiket 2, → /admin/tiket, fa-headset | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-129 | badge | visible-default · desktop-only | 2 | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-130 | card | visible-default · desktop-only | <name> | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-131 | image | visible-default · desktop-only | — | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-132 | text | visible-default · desktop-only | <name> | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-133 | text | visible-default · desktop-only | <email> | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-134 | link | visible-default · desktop-only | → /logout, fa-sign-out-alt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-135 | toggle | visible-default · desktop-only | fa-bars | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-136 | heading | visible-default | Dashboard | FN-M12-1.1.7 |
| EL-M12-SHU-137 | text | visible-default | Selamat datang kembali | FN-M12-1.1.7 |
| EL-M12-SHU-138 | text | visible-default · desktop-only | 256 | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-139 | text | visible-default · desktop-only | koin | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-140 | text | visible-default · desktop-only | 8 | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-141 | text | visible-default · desktop-only | mata | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-142 | text | visible-default · desktop-only | 1 | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-143 | text | visible-default · desktop-only | hari 🔥 | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-144 | link | visible-default | 99+, → /notifikasi, fa-bell | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-145 | badge | visible-default | 99+ | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-146 | image | visible-default · desktop-only | — | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-147 | link | visible-default · desktop-only | → /logout, fa-sign-out-alt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-148 | toggle | conditional · mobile-only | fa-bars | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-149 | link | conditional · mobile-only | → /dashboard | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-150 | image | conditional · mobile-only | — | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-151 | text | conditional · mobile-only | 256 | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-152 | text | conditional · mobile-only | koin | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-153 | text | conditional · mobile-only | 8 | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-154 | text | conditional · mobile-only | mata | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-155 | text | conditional · mobile-only | 1 | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-156 | text | conditional · mobile-only | 🔥 | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-157 | text | visible-default · desktop-only | © 2026 PRESTASIPLUS. Hakcipta Terpelihara | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-158 | text | visible-default · desktop-only | ✨ | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-159 | text | visible-default · desktop-only | Didikan penuh dari Malaysia | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-160 | text | visible-default · desktop-only | ❤️ | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-161 | text | visible-default · desktop-only | 🇲🇾 | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-162 | clickable | hidden-only | — | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-163 | modal | hidden-only | <name> | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-164 | image | hidden-only | — | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-165 | text | hidden-only | Platform Latih Tubi Nasional | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-166 | button | hidden-only | fa-times | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-167 | image | hidden-only | — | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-168 | text | hidden-only | <name> | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-169 | text | hidden-only | admin | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-170 | link | hidden-only | Dashboard, → /dashboard, fa-home | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-171 | modal | hidden-only | SPM | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-172 | text | hidden-only | SPM | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-173 | link | hidden-only | SPM SPM, → /spm, fa-graduation-cap | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-174 | badge | hidden-only | SPM | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-175 | link | hidden-only | Headcount, → /headcount, fa-chart-line | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-176 | link | hidden-only | Prestasi, → /prestasi, fa-chart-bar | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-177 | link | hidden-only | Analisa Item, → /analisa-item, fa-magnifying-glass-chart | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-178 | link | hidden-only | Amaran Awal, → /amaran, fa-exclamation-triangle | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-179 | link | hidden-only | Kombo, → /kombo, fa-fire | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-180 | link | hidden-only | Cikgu Alesa AI, → /cikgu, fa-robot | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-181 | badge | hidden-only | AI | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-182 | link | hidden-only | RPH, → /cikgu/rph, fa-file-alt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-183 | link | hidden-only | PBD Auto-Tag, → /cikgu/pbd, fa-clipboard-check | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-184 | link | hidden-only | Mark Karangan, → /cikgu/essay, fa-pen-fancy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-185 | link | hidden-only | Laporan Mingguan, → /laporan-mingguan, fa-file-lines | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-186 | link | hidden-only | Pembetulan, → /pembetulan, fa-arrows-rotate | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-187 | link | hidden-only | Penguasaan, → /penguasaan, fa-layer-group | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-188 | link | hidden-only | Laporan Soalan, → /laporan-soalan, fa-flag | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-189 | link | hidden-only | Command Center LIVE, → /ppd/command-center, fa-satellite-dish | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-190 | badge | hidden-only | LIVE | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-191 | link | hidden-only | Dashboard PPD, → /ppd/dashboard, fa-building-columns | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-192 | link | hidden-only | Statistik Penggunaan, → /ppd/statistik-penggunaan, fa-chart-pie | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-193 | link | hidden-only | Ranking Kebangsaan, → /ppd/ranking-kebangsaan, fa-trophy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-194 | link | hidden-only | Benchmark Sekolah, → /ppd/benchmark-sekolah, fa-ranking-star | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-195 | link | hidden-only | Peta Haba, → /ppd/peta-haba, fa-map-location-dot | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-196 | link | hidden-only | Export Laporan, → /ppd/export-laporan, fa-file-export | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-197 | link | hidden-only | Leaderboard Sekolah, → /ppd/leaderboard-sekolah, fa-trophy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-198 | link | hidden-only | Dashboard JPN, → /jpn/dashboard, fa-building-flag | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-199 | link | hidden-only | Statistik Penggunaan, → /jpn/statistik-penggunaan, fa-chart-pie | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-200 | link | hidden-only | Ranking Kebangsaan, → /jpn/ranking-kebangsaan, fa-trophy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-201 | modal | hidden-only | Pembelajaran | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-202 | text | hidden-only | Pembelajaran | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-203 | link | hidden-only | Latih Tubi, → /practice, fa-brain | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-204 | link | hidden-only | Soalan by Chapter, → /practice/chapter, fa-layer-group | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-205 | link | hidden-only | Soalan Berstruktur, → /latihan-berstruktur, fa-list-ol | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-206 | link | hidden-only | Kedudukan, → /ranking, fa-trophy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-207 | link | hidden-only | PKSK PRO, → /pksk, fa-shield-halved | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-208 | badge | hidden-only | PRO | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-209 | link | hidden-only | Artikel, → /artikel, fa-newspaper | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-210 | link | hidden-only | Video, → /video, fa-play-circle | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-211 | link | hidden-only | Permainan 🎮, → /permainan, fa-gamepad | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-212 | badge | hidden-only | 🎮 | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-213 | link | hidden-only | Cabutan Bertuah 🎟️, → /cabutan, fa-ticket | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-214 | badge | hidden-only | 🎟️ | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-215 | link | hidden-only | Tournament, → /tournament, fa-trophy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-216 | link | hidden-only | Topik, → /topics, fa-book-open | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-217 | link | hidden-only | Peta Belajar, → /peta-belajar, fa-map | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-218 | link | hidden-only | Command Center LIVE, → /guru/command-center, fa-satellite-dish | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-219 | badge | hidden-only | LIVE | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-220 | text | hidden-only | Pusat AI | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-221 | badge | hidden-only | NEW | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-222 | text | hidden-only | 🤖 Cikgu Alesa AI | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-223 | link | hidden-only | Cikgu Alesa Chat AI, → /cikgu, fa-robot | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-224 | badge | hidden-only | AI | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-225 | text | hidden-only | ✨ Visi & Pertandingan | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-226 | link | hidden-only | Sekolah Bersaing NEW, → /sekolah-bersaing, fa-trophy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-227 | badge | hidden-only | NEW | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-228 | link | hidden-only | Tetapan Peribadi, → /tetapan, fa-cog | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-229 | text | hidden-only | 🏆 Bilik Duta · 🔒 PREVIEW | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-230 | link | hidden-only | Bilik Duta DEV, → /bilik-duta, fa-crown | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-231 | badge | hidden-only | DEV | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-232 | text | hidden-only | 🤖 AI Pintar (Pelajar) | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-233 | link | hidden-only | Wellbeing Alerts, → /wellbeing/alerts, fa-triangle-exclamation | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-234 | link | hidden-only | Kamus AI, → /pusat-ai/kamus, fa-book-open | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-235 | link | hidden-only | Pendamping Motivasi, → /pusat-ai/pendamping, fa-heart | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-236 | link | hidden-only | Doa & Motivasi, → /pusat-ai/doa, fa-mosque | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-237 | text | hidden-only | 🎯 AI Pintar (Guru) | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-238 | link | hidden-only | Aktiviti Advisor, → /pusat-ai/aktiviti, fa-lightbulb | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-239 | link | hidden-only | Whiteboard → Quiz, → /pusat-ai/whiteboard, fa-clipboard-question | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-240 | link | hidden-only | RPH (Cikgu Alesa), → /cikgu/rph, fa-clipboard-list | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-241 | link | hidden-only | Semak Karangan (Cikgu Alesa), → /cikgu/essay, fa-pen-fancy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-242 | link | hidden-only | PBD (Cikgu Alesa), → /cikgu/pbd, fa-tasks | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-243 | text | hidden-only | 🛡️ Kawalan Kualiti | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-244 | link | hidden-only | Semakan Nota Master, → /admin/master-notes, fa-shield-alt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-245 | link | hidden-only | Audit Log, → /admin/audit-log, fa-clipboard-check | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-246 | modal | hidden-only | HARIAN | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-247 | text | hidden-only | HARIAN | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-248 | link | hidden-only | Dashboard Guru, → /guru, fa-chart-pie | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-249 | link | hidden-only | Misi Harian, → /guru/misi-harian, fa-rocket | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-250 | link | hidden-only | Soalan by Chapter, → /practice/chapter, fa-layer-group | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-251 | link | hidden-only | Kelas Saya, → /guru/kelas, fa-chalkboard-teacher | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-252 | link | hidden-only | Pelajar Saya, → /guru/pelajar, fa-user-graduate | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-253 | link | hidden-only | Kehadiran Digital, → /guru/kehadiran-digital, fa-clipboard-check | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-254 | modal | hidden-only | PENGAJARAN | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-255 | text | hidden-only | PENGAJARAN | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-256 | link | hidden-only | Jadual Belajar, → /guru/jadual-belajar, fa-calendar-alt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-257 | link | hidden-only | Broadcast, → /guru/broadcast, fa-bullhorn | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-258 | link | hidden-only | Kelas Live, → /guru/live-kelas, fa-broadcast-tower | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-259 | modal | hidden-only | PENILAIAN | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-260 | text | hidden-only | PENILAIAN | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-261 | link | hidden-only | Headcount, → /headcount, fa-chart-line | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-262 | link | hidden-only | Prestasi, → /prestasi/kelas, fa-chart-bar | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-263 | link | hidden-only | Laporan, → /guru/laporan, fa-chart-pie | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-264 | link | hidden-only | Amaran Awal, → /amaran, fa-exclamation-triangle | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-265 | modal | hidden-only | ANALITIK | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-266 | text | hidden-only | ANALITIK | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-267 | link | hidden-only | Monitoring, → /guru/monitoring, fa-binoculars | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-268 | toggle | hidden-only | Kirkpatrick, fa-microscope | FN-M12-1.1.3 |
| EL-M12-SHU-269 | link | hidden-only | Ringkasan, → /guru/kirkpatrick, fa-home | FN-M12-1.1.3 |
| EL-M12-SHU-270 | link | hidden-only | T1: Reaksi, → /guru/kirkpatrick/reaction, fa-smile | FN-M12-1.1.3 |
| EL-M12-SHU-271 | link | hidden-only | T2: Pembelajaran, → /guru/kirkpatrick/learning, fa-graduation-cap | FN-M12-1.1.3 |
| EL-M12-SHU-272 | link | hidden-only | T3: Tingkah Laku, → /guru/kirkpatrick/behavior, fa-running | FN-M12-1.1.3 |
| EL-M12-SHU-273 | link | hidden-only | T4: Hasil, → /guru/kirkpatrick/results, fa-trophy | FN-M12-1.1.3 |
| EL-M12-SHU-274 | link | hidden-only | Rantaian Impak, → /guru/kirkpatrick/chain, fa-link | FN-M12-1.1.3 |
| EL-M12-SHU-275 | link | hidden-only | Intervensi, → /guru/kirkpatrick/interventions, fa-hand-holding-medical | FN-M12-1.1.3 |
| EL-M12-SHU-276 | link | hidden-only | Analisis Item, → /guru/analisis-item, fa-chart-pie | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-277 | link | hidden-only | Perbandingan Kelas, → /guru/perbandingan-kelas, fa-balance-scale | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-278 | link | hidden-only | Laporan Mingguan, → /guru/laporan-mingguan-kelas, fa-calendar-week | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-279 | modal | hidden-only | BANK SOALAN | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-280 | text | hidden-only | BANK SOALAN | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-281 | link | hidden-only | Sumbang Soalan, → /guru/soalan, fa-pen-fancy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-282 | link | hidden-only | Soalan & Rujukan, → /guru/soalan-guru, fa-book-open | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-283 | link | hidden-only | Soalan Berstruktur, → /guru/soalan-berstruktur, fa-list-ol | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-284 | link | hidden-only | Databank Soalan, → /guru/databank, fa-database | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-285 | link | hidden-only | Set Soalan, → /guru/set-soalan, fa-clipboard-list | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-286 | modal | hidden-only | LAIN-LAIN | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-287 | text | hidden-only | LAIN-LAIN | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-288 | link | hidden-only | Syiling & Ganjaran, → /guru/gamifikasi, fa-coins | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-289 | link | hidden-only | Sumbang Artikel, → /guru/artikel, fa-newspaper | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-290 | link | hidden-only | Video, → /video, fa-play-circle | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-291 | link | hidden-only | Kelas Saya BARU, → /kelas-saya, fa-book-reader | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-292 | badge | hidden-only | BARU | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-293 | link | hidden-only | Set Soalan Guru, → /set-soalan-saya, fa-clipboard-list | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-294 | modal | hidden-only | Gamifikasi | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-295 | text | hidden-only | Gamifikasi | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-296 | link | hidden-only | Syiling & Token, → /gamification, fa-coins | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-297 | link | hidden-only | Tukar Token, → /gamification/convert, fa-exchange-alt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-298 | link | hidden-only | Cabaran Harian, → /gamification/challenges, fa-bullseye | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-299 | link | hidden-only | Kedai Hadiah, → /gamification/rewards, fa-gift | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-300 | link | hidden-only | Marketplace, → /marketplace, fa-shopping-bag | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-301 | link | hidden-only | Papan Pendahulu, → /gamification/leaderboard, fa-trophy | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-302 | link | hidden-only | Pencapaian, → /gamification/achievements, fa-medal | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-303 | link | hidden-only | Kotak Misteri, → /gamification/mystery-box, fa-box-open | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-304 | link | hidden-only | Rujuk Kawan, → /gamification/referral, fa-user-plus | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-305 | link | hidden-only | Timeline Saya, → /timeline, fa-camera | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-306 | link | hidden-only | Invois Saya, → /billing/invoices, fa-file-invoice | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-307 | link | hidden-only | Ke Admin Panel, → /admin, fa-shield-halved | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-308 | link | hidden-only | Soalan by Chapter, → /practice/chapter, fa-layer-group | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-309 | link | hidden-only | Billing Dashboard, → /admin/billing, fa-chart-line | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-310 | link | hidden-only | Urus Produk, → /admin/marketplace/products, fa-store | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-311 | link | hidden-only | Urus Penjual, → /admin/marketplace/sellers, fa-user-tie | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-312 | link | hidden-only | Urus Hadiah, → /admin/hadiah, fa-gift | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-313 | link | hidden-only | Gamifikasi Guru, → /admin/gamifikasi/guru, fa-chalkboard-teacher | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-314 | link | hidden-only | Profil Saya, → /profile, fa-user-circle | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-315 | link | hidden-only | Tetapan, → /settings, fa-cog | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-316 | link | hidden-only | Panduan, → /pusat-tuisyen/panduan, fa-book | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-317 | link | hidden-only | Log Keluar, → /logout, fa-sign-out-alt | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-318 | text | hidden-only | © 2026 PRESTASIPLUS 🇲🇾 | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-319 | text | hidden-only | Pasang PRESTASIPLUS | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-320 | text | hidden-only | Akses pantas dari skrin utama | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-321 | button | hidden-only | Pasang | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-322 | button | hidden-only | 10, fa-times | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-323 | card | hidden-only | Pasang PRESTASIPLUS | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-324 | image | hidden-only | — | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-325 | heading | hidden-only | Pasang PRESTASIPLUS | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-326 | text | hidden-only | Ikuti langkah berikut: | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-327 | badge | hidden-only | 1 | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-328 | text | hidden-only | Tekan ikon Share | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-329 | text | hidden-only | Ikon di bawah skrin Safari, fa-share-from-square | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-330 | badge | hidden-only | 2 | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-331 | text | hidden-only | Pilih "Add to Home Screen" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-332 | text | hidden-only | Scroll ke bawah, tekan Add to Home Screen, fa-plus-square | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-333 | badge | hidden-only | 3 | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-334 | text | hidden-only | Tekan "Add" | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-335 | text | hidden-only | PRESTASIPLUS akan muncul di skrin utama anda | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-336 | button | hidden-only | Faham! | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-337 | link | conditional · mobile-only | Home, → /dashboard, fa-home | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-338 | link | conditional · mobile-only | SPM, → /spm, fa-graduation-cap | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-339 | link | conditional · mobile-only | Game, → /permainan, fa-gamepad | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-340 | link | conditional · mobile-only | Topik, → /topics, fa-book-open | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-341 | toggle | conditional · mobile-only | Chat, fa-comments | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-342 | toggle | conditional · mobile-only | Lagi, fa-bars | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-343 | card | hidden-only | Pembantu PrestasiPlus | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-344 | text | hidden-only | Pembantu PrestasiPlus | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-345 | text | hidden-only | Sedia membantu anda | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-346 | button | hidden-only | fa-times | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-347 | heading | hidden-only | Selamat Datang! | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-348 | text | hidden-only | Sila masukkan maklumat anda sebelum memulakan perbualan. | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-349 | form | hidden-only | — | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-350 | label | hidden-only | Nama | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-351 | input | hidden-only | Nama | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-352 | label | hidden-only | No. Telefon | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-353 | input | hidden-only | No. Telefon | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-354 | button | hidden-only | Mula Berbual, fa-comments | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-355 | card | hidden-only | — | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-356 | text | hidden-only | Selamat datang, ! Saya Pembantu Maya PrestasiPlus. Bagaimana saya boleh membantu anda hari ini? | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-357 | button | hidden-only | Apakah PrestasiPlus? | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-358 | button | hidden-only | Cara mendaftar | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-359 | button | hidden-only | Harga langganan | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-360 | card | hidden-only | <name> | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-361 | text | hidden-only | Selamat datang, ! Saya Pembantu Maya PrestasiPlus. Bagaimana saya boleh membantu anda hari ini? | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-362 | text | hidden-only | <name> | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-363 | button | hidden-only | Apakah PrestasiPlus? | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-364 | button | hidden-only | Cara mendaftar | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-365 | button | hidden-only | Harga langganan | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-366 | button | hidden-only | fa-thumbs-up | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-367 | button | hidden-only | fa-thumbs-down | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-368 | form | hidden-only | — | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-369 | textarea | hidden-only | Taip mesej anda... | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-370 | button | hidden-only | fa-paper-plane | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-371 | text | hidden-only | Dikuasakan oleh AI · Jawapan mungkin tidak sentiasa tepat | Excluded — global shell / M23 (or the module the link targets) |
| EL-M12-SHU-372 | toggle | hidden-only | fa-comments | Excluded — global shell / M23 (or the module the link targets) |

### 6.3 Audit-observed elements (not yet in the inventory; TU-M12-09)

Observed by the independent audit on 2026-09-26 (round 2) on `?school_id=9167`, a school without SPM history. They get regular ids when the discovery owner adds the state to the inventory (TU-M12-09).

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M12-S1-A01 | text | conditional (school without history) | Belum Ada Data (T4 card) | FN-M12-2.2.5 |
| EL-M12-S1-A02 | text | conditional (school without history) | Import keputusan peperiksaan (T4 card) | FN-M12-2.2.5 |
| EL-M12-S1-A03 | badge | conditional (school without history) | GPS - (flow pill, circles and list) | FN-M12-2.2.5 |
| EL-M12-S5-A01 | text | conditional (school without history) | - (GPS Headcount value) | FN-M12-6.1.2 |
| EL-M12-S5-A02 | text | conditional (school without history) | 41 rekod · (GPS Headcount caption; DV-M12-28) | FN-M12-6.1.2 |
| EL-M12-S5-A03 | text | conditional (school without history) | 0% (Kadar Lulus) | FN-M12-6.1.2 |
| EL-M12-S5-A04 | text | conditional (school without history) | 0/0 calon | FN-M12-6.1.2 |
| EL-M12-S5-A05 | text | conditional (school without history) | 0 (Pelajar Gred A) | FN-M12-6.1.2 |
| EL-M12-S5-A06 | text | conditional (school without history) | 0% daripada 0 | FN-M12-6.1.2 |
| EL-M12-S5-A07 | text | conditional (school without history) | - (ROI GPS Headcount) | FN-M12-6.1.2 |

**Result: 755/755 M12 content elements covered (749 mapped to an FN, 6 excluded with a reason); 591/591 shell elements accounted for (35 mapped, 556 excluded); 10/10 audit-observed elements (§6.3) mapped; 1356/1356 covered, 0 unmapped.**

---

## 7. Fidelity deviations

These are the **only** intended differences from the live site. Anything not listed must match live (D7). Rule D9 (user, standing, pre-approved): where live is broken or contradictory, fix it minimally; where it works, replicate it exactly. D10: accessibility replicates live; a deliberate, consistent limit is not broken; adding options to a working feature is new scope. CLAUDE.md §6: minimal fixes that create no new visible contradiction. Rows "Rejected — replicate live" were candidates that turned out to work, could not be shown to be broken, or have no minimal fix. Every claim below was checked against the inventory states, the raw captures (`inventory/_raw/M12/`), the screenshots and — for cross-module figures — the M11 snapshot and the M08 SRS.

| ID | Discovery | Category | Live behaviour (evidence) | Rebuild behaviour (specified) and alternatives | Status |
|---|---|---|---|---|---|
| DV-M12-01 | D-M12-1 | Broken control + dead instruction | S7 panel "Rekod Intervensi Baru" is rendered with `x-data="{ open:  }"` (empty server value): console "Alpine Expression Error: Unexpected token '}'", "Unexpected token '-'" (`:class="{ rotate-180: open }"`), "Illegal invocation"; the panel stays `hidden` / `height: 0px` before, after one and after two clicks (states `default`, `toggle`; `interventions-desktop.png`). The form exists in the DOM (state `forced-open`, `interventions-form-forced.png`). The empty list says "Klik "Ambil Tindakan" pada amaran di halaman Tingkah Laku untuk mula." but no S4 alert (35 items in state `default`: 23 red, 12 green, raw S4) has any button. | **(1) The panel works:** closed on load (as live renders it), the header button toggles it and rotates the chevron; the form is the source form, unchanged (FN-8.2.1–8.2.3). **(2) The dead sentence is not rendered;** "Tiada intervensi direkodkan lagi." stays. Alternatives: (a) add "Ambil Tindakan" buttons to the S4 alerts — rejected: invents a control and a flow never observed, and the S4 alerts are per school while the form needs one student id; (b) new copy such as "Klik "Rekod Intervensi Baru" untuk mula." — rejected: invented copy; (c) replicate — rejected: recording an intervention is impossible and the instruction is false. Consequence: records can now be created, so the populated list and KPIs appear; their layout is PROPOSED (FN-8.3.2, OQ-M12-09). | Approved (D9) |
| DV-M12-02 | D-M12-2 | Broken content | S6 correlation table rows: "1-20 soalan" 215 59.7%, **"1-20 soalan" 215 59.7% (repeated)**, "51-100 soalan" 149 68.7%, "100+ soalan" 348 75.2% (EL-M12-S6-059, `chain-desktop.png`). The 21–50 band is never shown. | **The repeated row is removed**; the table shows the 3 observed bands. Alternatives: (a) show a 21–50 row with a computed value — rejected: its value was never displayed on live (the page is broken there) and no dataset definition reproduces the correlation bands (DV-M12-23), so any value would be invented; (b) replicate the duplicate — rejected (a repeated band reads as data). If the owner supplies the 21–50 values (OQ-M12-10), the row is added as a display constant. | Approved (D9) |
| DV-M12-03 | D-M12-3 (+ SHU) | Wrong title | S6 and S8: admin header "Dashboard" / "Selamat datang, Admin" (EL-M12-SHA-213/214). S9: user header "Dashboard" / "Selamat datang kembali"; S10: "Dashboard" (EL-M12-SHU-136/137). | Shell rule DV-SH-03 (title from the route, no subtitle; M05 XL-20 pattern): S6 "Rantaian Impak" (the live menu label of the route), S8 "Kirkpatrick — {nama}" (live tab title), S9 "Kirkpatrick — Prestasi Saya" (live tab title and h1), S10 "Maklum Balas" (live tab title without the site suffix). Tab titles unchanged. Alternatives: the tab title "Kirkpatrick Impact Chain" for S6 — rejected (English, while the sidebar item and the in-page h1 use "Rantaian Impak"); replicate — rejected (wrong title). | Approved (D9) |
| DV-M12-04 | D-M12-4 | Candidate — link targets | On every `/guru/kirkpatrick*` twin, links, filters, "Reset", "← Kembali", export and the POST target `/admin/kirkpatrick*`. For the admin these work (same content). A teacher's result is not observable (Q-M12-1). | **Rejected — replicate live** (M11 DV-M11-04 precedent). The targets work for the observed role; a failure for a teacher is UNVERIFIED. Teacher path provisional (FN-1.2.3); SEC-M12-01. **Reversed in v1.7 (D9, as M11 DV-M11-28):** every link, form action, "Reset", "← Kembali", export and the POST follows the mount prefix (`/admin/kirkpatrick`, `/guru/kirkpatrick`, `/admin-sekolah/kirkpatrick`) — a teacher redirected away from `/admin` would meet a dead link; admin behaviour unchanged. | Approved (D9, v1.7); v1.1 "Rejected — replicate live" superseded |
| DV-M12-05 | D-M12-5 | Broken control | S3 subject rows: `cursor-pointer` + `title="Klik untuk lihat detail"`, no handler (clicking does nothing; EL-M12-S3-032…). S5 subject cells: `cursor-pointer` + `title="Lihat detail {subjek}"`, no handler. | **No false affordance:** default cursor and no title on those rows/cells; nothing else changes. Alternatives: (a) build a subject detail view — rejected: new feature, content unknown; (b) link to another page (e.g. `/admin/monitoring`) — rejected: invented target; (c) replicate — rejected (a control that says "click" and does nothing). | Approved (D9) |
| DV-M12-06 | D-M12-6 | Visual bug | S5 "Ramalan ALESA (Predictive Grade)" heading icon `fa-crystal-ball` is not in Font Awesome Free 6.5.1; `::before` content is none, so the icon renders blank (`results-alesa.png`). | The icon resolver maps it to Lucide `Sparkles` (design-system §6.9 / icon table, already approved for blank FA strings). Alternative: replicate the blank slot — rejected (visual bug). | Approved (D9) |
| DV-M12-07 | D-M12-7 (+ §8.1 S7) | Layout / touch | S1 and S4 at 375: the `school_id` select sizes to its longest option (466 px) → `scrollWidth` 487 > 375 (direct measurement; `overview-mobile.png`, `behavior-mobile.png`). The S1/S4 selects have no padding and render 18 px tall at every width. The S7 panel header button is 332 × 20 px at 375. | Selects: `max-width: 100%` of the filter card (the chosen option truncates) and at least 36 px tall (the height of the "Tapis" button, 89 × 36; M11 DV-M11-17 precedent) — **v1.7: 44 px tall below `lg` (1024 px), 36 px from `lg`**. S7 header button likewise (44 px below `lg`, 36 px from `lg`). Options, labels and order unchanged. Alternatives: shorten option labels — rejected (changes data). | Approved (D9) |
| DV-M12-08 | D-M12-8, AUD-M12-02 | Contradictory numbers | Live uses two "active" definitions and two question counts. (1) **Served** (≥ 1 served question in the segment): KPI "Pelajar aktif" 951/4158 on S1, "Pernah Aktif" 951 on S4, "Pelajar Aktif" 951/4158 (22.9%) on S6, the S4/S5 table column "Aktif" (Σ 951), the green-alert percentages; "Tidak Terlibat" 3207 = 4158 − 951; the S4/S5 table column "Soalan" (Σ 307,049 on 2026-09-26 = served questions). (2) **Answered**: S5 "Pelajar Aktif" 946 "22.8% daripada 4,158", the 946 prediction rows, the four answered bands (513 + 259 + 169 + 5 = 946), every "Soalan Dijawab" KPI and the S3 table "Soalan" (Σ 306,203 on 2026-09-26). Five students (at 9167, 8082, 8106, 8765, 8107) have served but unanswered questions, so they are in no band (tiles sum 4,153). Visible results: same label, two values across pages (S5 946 vs S6 951); on `/admin/kirkpatrick/behavior?school_id=9167` the KPI "Soalan Dijawab 545" sits above the row "Soalan 555" and the bands sum to 7 of 8; on `/results?school_id=9167` "Pelajar Aktif 5" sits above the row "Aktif 6"; the same school shows "Soalan" 545 on S3 and 555 on S4. School 8080 shows no gap (53 / 15,007 everywhere). | **One definition on every M12 screen: "aktif" = ≥ 1 answered question; "Soalan" = answered questions.** Footprint (complete): S1 T3 card and flow pills "946"; S4 "Pernah Aktif" 946; S6 "946/4158 (22.8%)"; "Tidak Terlibat"/"Disengaged" 3212 (77.2%) on S1, S4, S6; S4 and S5 table "Aktif" −1 at 9167, 8082, 8106, 8765, 8107; S4 and S5 table "Soalan" = answered at the 10 schools where served ≠ answered (8880, 8078, 8082, 8106, 8772, 8102, 8765, 8087, 8107, 9167) and "Purata/Aktif" of those rows; the green alert of 9167 "62.5%" (5/8; still > 50%). Unchanged: S5 (already answered), every KPI "Soalan Dijawab", S3, sessions 20991, the Skor/Engagement/Tahap values and order (stored), every 8080 value. After the fix every screen agrees and the bands partition 4,158 (9167: 4 / 1 / 0 / 0 / 3). The live served figures stay modelled as named queries (SRS Q-M12-TBL-AKTIF, Q-M12-TBL-SOALAN) for the backend phase. Alternatives: (a) **served everywhere** (S5 946 → 951, 22.9%, ROI 321.9, insight 951; tables unchanged) — rejected: the S5 prediction list would still list only answered students under "Pelajar Aktif 6" (9167: 5 rows), the KPI "Soalan Dijawab" still differs from the row "Soalan" on filtered S4/S5 unless the "Dijawab" KPIs change to served counts (wrong for the label), and 5 students stay in no band; (b) **KPI only** (v1.0) — rejected: creates a new visible contradiction on filtered S4/S5 (KPI 5 beside row 6); (c) keep two definitions and relabel the table columns — rejected: needs new copy; (d) replicate — rejected (same label, different values on one screen). | Approved (D9) |
| DV-M12-09 | D-M12-9 | Wrong format | School-level GPS prints "4" (S1 T4 card, flow "GPS 4", S5 "GPS Headcount", insight "(tahun 2026): 4") while the platform prints "4.30". | Every GPS on M12 prints 2 decimals: "4.00". Nothing else changes. Alternative: replicate — rejected (same metric in two formats). | Approved (D9) |
| DV-M12-10 | D-M12-10 | Candidate — band captions | Captions ">50 soalan", "20-50 soalan", "5-20 soalan", "<5 soalan", "0 soalan" (S4). **Correction of the discovery claim:** the captions share only the value **20** ("20-50" and "5-20"); 5 belongs only to "5-20" ("<5" excludes it); "<5" and "0" both describe 0. | **Rejected — replicate the captions.** They are range summaries, not rules the user applies; every displayed count is the server's (observed) and no screen shows a student with exactly 20 answers next to a band. The rebuild's band rule is defined without overlap (> 50 / 20–50 / 5–19 / 1–4 / 0, INFERRED; FN-5.3.1). Alternative: change "5-20" to "5-19" — rejected: it asserts an unobserved server boundary as copy. | Rejected — replicate live |
| DV-M12-11 | D-M12-11 | Wrong page | GET `/admin/kirkpatrick/interventions/{id}` and `/interventions/create` → unbranded English framework page "Oops! An Error Occurred" / "…405 Method Not Allowed…" (`interventions-405.png`); nothing links there. | The global 404 page (M08 DV-M08-24, M10 DV-M10-26 precedent). Alternative: replicate — rejected (English, unbranded, leaks the framework: SEC-M12-04). | Approved (D9) |
| DV-M12-12 | D-M12-12 | Visual bug (active state) | On `/guru/kirkpatrick*` no admin-sidebar item is active; on `/admin/kirkpatrick*` the current item is. | The current view's item (and the open group) is active on both prefixes (M11 DV-M11-12 precedent). | Approved (D9) |
| DV-M12-13 | D-M12-13 | Wrong label | S5 insight "Hanya 946 daripada 4158 pelajar T4/T5 (946) menggunakan platform." (8080 "…184 pelajar T4/T5 (53)…") repeats the count in the brackets. | The brackets show the share already shown by the "Pelajar Aktif" card: "(22.8%)"; 8080 "(28.8%)". Alternative: remove the brackets — rejected (the template clearly intends a figure). | Approved (D9) |
| DV-M12-14 | D-M12-14 | Visual inconsistency | Trend GPS: the "-" of "Keseluruhan" 2026 is green-600 and the "-" of Pendidikan Islam 2026 is amber-600 (a "no data" mark coloured as good / bad). | Both "-" cells use slate-300, the page's own "no data" colour (S5 school table "-"). Values unchanged. | Approved (D9) |
| DV-M12-15 | D-M12-15, AUD-M12-15 | Contradictory numbers | S3 school table: school **940** shows "Soalan" 0 and Ketepatan 0% but "Skor Purata" 90% (its only session has no served question); other 0-answer schools show 0 / 0% / 0%. | "Skor Purata" = mean score of the sessions that have ≥ 1 answer; school 940 shows 0%, like the other such schools. Platform and 8080 values stay 80.3% / 73.3% (the dataset is built to this rule, SRS BR-M12-04). Its S4 row (Sesi 1, Skor 2) and S5 "Engagement 2" are the stored score and stay. Alternative: replicate — rejected (row contradicts itself). | Approved (D9) |
| DV-M12-16 | D-M12-16 | Contradictory rules | S5 "Kadar Lulus" 90.6% "163/180 calon" = A+…C (D and E fail), while on the same page ALESA "Dijangka Lulus" 48 = 50 − 2 E, i.e. A+…D (the 2 D rows count as a pass). The 8080 ALESA state confirms the ALESA rule from its own rows: A+ 3, A 9, A- 11, B+ 13, B 7, C+ 3, C 1, E 3 → 47 / 3 / 3 (audit top-up). "Lulus" means two grade sets on one page. | **One pass rule on the page: A+ … D pass (E, G fail)**, the ALESA rule. "Kadar Lulus" becomes "96.7%" "174/180 calon" (163 + 11 D). ALESA unchanged. 8080 unchanged ("100%" "1/1"). Alternatives: (a) A+ … C (ALESA → 46 / 4 / 4 and footer "46 pelajar dijangka lulus") — rejected: changes three ALESA strings per scope; (b) replicate — rejected (contradiction on one screen). | Approved (D9) |
| DV-M12-17 | D-M12-17 | Candidate — odd figures | The accuracy delta "+53.7%" is a point difference shown with "%"; "Jumlah jawapan meningkat 465500%." | **Rejected — replicate live** (working, arithmetically correct; not D9). | Rejected — replicate live |
| DV-M12-18 | D-M12-18 | Candidate — language | S6 uses "Consistent / Developing / Minimal / Disengaged" where S1/S4 use "Konsisten / Berkembang / Minimum / Tidak Terlibat". | **Rejected — replicate live.** Readable translations of the same bands; mixed English is a consistent live style ("Mastered", "Overview", "Learning Gain"; M11 DV-M11-14 precedent). | Rejected — replicate live |
| DV-M12-19 | D-M12-19 | Candidate — ignored parameter | `?school_id=` on S2 and S6 is accepted and ignored (T1 and the chain are global). | **Rejected — replicate live** (no form offers it; the pages are global by design). | Rejected — replicate live |
| DV-M12-20 | new (writer) | Candidate — two GPS→grade rules | S5 "GPS Mengikut Subjek" maps 2.50 / 2.80 / 2.90 / 3.00 → A- and 3.20 → B+ (point ⌈GPS⌉ − 1); M08 S1 maps 2.50 → B+ (round half up, M08 BR-M08-04). | **Rejected — replicate both.** Separate pages and data, each applying its own rule consistently; no screen shows both (M11 DV-M11-09 precedent). Reported to M08 (XR-M12-05). | Rejected — replicate live |
| DV-M12-21 | new (writer) | Candidate — two %→grade maps | S5 "Anggaran Gred": D ≥ 40, E ≥ 30, G < 30 (observed row ranges D 40–49.6, E 30–39.5, G 0–29.4). M08 BR-M08-02 (INFERRED below B+): D 45–49.99, E 40–44.99, G < 40. | **Rejected — replicate the M12 map** (observed on this page). M08's lower bounds are INFERRED; the M12 observation is reported to M08 (XR-M12-05) without changing M08. | Rejected — replicate live |
| DV-M12-22 | new (writer) | Candidate — GPS vs distribution | "GPS Headcount 4.30" (2025, 180 candidates) is not the SPM-point mean of the shown distribution ((0·10 + 1·18 + 2·24 + 3·32 + 4·32 + 5·26 + 6·21 + 7·11 + 8·5 + 9·1) ÷ 180 = 672 ÷ 180 = 3.73); 8080 shows "4" with one B+ candidate (3). The 4.30 equals the M08 SchoolSpmHistory 2025 value (4.30, 180 candidates, "SPM Sebenar"). | **Rejected — replicate live.** The GPS is the stored yearly value (M08 DATA-M08-09) and the distribution a stored grade count of the same year; the mismatch is visible only by arithmetic. Not recomputed. | Rejected — replicate live |
| DV-M12-23 | new (writer) | Candidate — correlation vs bands | S6 correlation bands: 149 + 348 = 497 students with > 50 answers, but "Champion" (> 50 soalan) = 513 on the same page; "1-20 soalan" 215 vs Minimum + Berkembang 174. No single per-student count reproduces both. | **Rejected — replicate live** as documented display constants (`DISPLAY_CONSTANT`, SRS DC-M12-03): the correlation uses a server definition that is not observable (Q-M12-3). The mismatch needs cross-page definitions and arithmetic to see. | Rejected — replicate live |
| DV-M12-24 | new (writer), AUD-M12-04 | Candidate — M11 vs M12 figures | Same admin, same day: M11 monitoring "Pernah Aktif" 1,462 and "Soalan Dijawab" 472,371 vs M12 946/951 and 306,133; school 8080 has M12 activity in April 2026 (S1 "SEBELUM 01 Apr 2026 - 30 Apr 2026", 12 active, 511 answers) while its M11 weekly cells M1–M11 (16 Feb – 3 May) are all 0 (M11 snapshot); the top M12 engagement school (9681) has no M11 answers; Students A and B (M12 219 and 70 answers) are M11 "kirkpatrick" rows with M11 Soalan 0 ("Login sahaja", "Belum login"). Live uses two practice sources. | **Rejected — replicate live** (M11 DV-M11-22 precedent): the pages belong to different modules and state their own scope; equalising them would change hundreds of observed figures on one side with no evidence which is right. Both are named queries on the M05 store with different definitions (SRS §6.5, XR-M12-02). | Rejected — replicate live |
| DV-M12-25 | AUD-M12-04, R2-01 | Contradictory data (two ids for one person) | Students A and B each have two live ids: the S8 / M11 "kirkpatrick" link id (4664, 4644) and the monitoring-link id used by the S5 prediction rows (`/admin/monitoring/sekolah/8080/pelajar/5571` and `/5551`); name hash, school (8080) and every figure match (audit top-up TU-M12-07). On live, `/admin/kirkpatrick/pelajar/5571` and `/5551` return **403** (the S8 route accepts only its own id space; audit round 2). D12: one user = one M02 id. | **One M02 id per person: 4664 and 4644** — the ids M11 links on its 8080 page, outside M02's reserved block 5001–5999 (where 5551 and 5571 fall). The only visible change: the S5 prediction links of those two rows point to `/…/pelajar/4664` and `/4644`. **(v1.6, amended)** 5571 and 5551 **exist as generated users in M01/M02** (M02's block 5001–5999, ordinary users, not aliases of 4664/4644); S8 refuses these two ids explicitly with the 403 page (FR-M12-17), exactly as live — permanent, the M02 owner agreed; no alias. *(v1.0–v1.5 said they are "not user ids" / "not created"; withdrawn.)* Alternatives: (a) one id = 5571/5551 — rejected: reserved M02 block, and M11's kirkpatrick links would change; (b) keep 5571/5551 as S8 aliases (v1.1) — withdrawn: live answers 403, so an alias would add behaviour; (c) a second key on every M02 user — rejected: new cross-module field for two observed rows; (d) two users — rejected (D12, double counting at 8080). The changed links now open M11's student page for a student with 0 M11 answers — XR-M12-10 asks M11 to confirm that state. | Approved (D9) |
| DV-M12-26 | AUD-M12-09 | Wrong label | With `school_id` (8080) S5 shows the platform subject-GPS rows under "GPS Mengikut Subjek (**2025**)" and the platform trend rows under "Trend GPS (2022–**2025**)" without the 2026 column; the platform page shows the same values under "(2026)" / "(2022–2026)". On the 8080 page, "Matematik 2.50 … (2025)" contradicts the trend row "Matematik … 2025 4.45" just below, and "Taburan Gred (2026)" sits above "(2025)". | With `school_id`, both tables render exactly as on the platform page (headings "(2026)" and "(2022–2026)", 2026 column shown); no school-specific subject or trend data exists (XR-M12-05 request withdrawn). Alternatives: (a) replicate — rejected (same values under two years on one screen); (b) hide the tables for a school — rejected (removes live content). | Approved (D9) |
| DV-M12-27 | writer (top-up) | Candidate — "Subjek" column | S3 table column "Subjek": 8080 shows 3 while `?school_id=8080` lists 24 subjects with answers; school 940 shows 1 with 0 answers. | **Rejected — replicate live.** The column counts something else per school (not observable, e.g. subjects set up for the school); the label does not say "answered" and no other figure on the page states the same quantity. Stored per school (SRS DATA-M12-03). | Rejected — replicate live |
| DV-M12-28 | R2-02 | Broken label | On a school without SPM history (e.g. `?school_id=9167`) the S5 "GPS Headcount" card reads "-" with the caption **"41 rekod ·"** — the "·" separator is left dangling because the year is missing. | The caption reads **"41 rekod"** (the separator only appears when a year follows). Nothing else changes: the "-", "41" (DC-M12-01) and every other card stay as live. Alternatives: (a) replicate — rejected (a dangling separator is a visual/format defect of the template); (b) drop the whole caption — rejected: removes the live figure "41 rekod"; (c) show "0 rekod" or "Tiada data" — rejected: invents a value / copy. | Approved (D9) |
| DV-M12-29 | v1.6 (Session 6 build) | Missing live state (D9, INFERRED) | School 8880: M08 holds a 2026 history row (GPS 2.88, 150 candidates) but no grade counts; live has no display for it (the school was not observed on S1 / S5 with a school filter). The existing no-history rule (9167: "-", "0%", "0/0 calon", "0") would print a false "0/0 calon" for a school with 150 candidates. | S1 / S5 show **GPS 2.88 (2026) and 150 candidates from M08; no "Taburan Gred" card; "Kadar Lulus" and "Pelajar Gred A" print "-"** (FN-M12-6.1.3). Alternative not taken: GPS "-" as well, i.e. treat 8880 like 9167 — rejected: M08 stores the GPS and "-" would hide it. School 9167 (no history row) stays as observed (FN-6.1.2, DV-M12-28). | Approved (D9, v1.6; INFERRED) |
| DV-M12-30 | v1.7 (Session 6 second pass) | Visual bug (icon) | S1 flow card heading uses `fa-project-diagram`, which the icon set of the rebuild does not carry as such. | Rendered with Lucide `Workflow` (approximation; design-system icon resolver, as DV-M12-06). | Approved (D9; approximation) |
| DV-M12-31 | v1.7 (build); `docs/discovery/img/M12/chain-desktop.png` | Unreadable text (D9) | S6 "Kesimpulan Model Kirkpatrick": the heading renders **dark** on the indigo → purple gradient card (the paragraph below is white); the heading is hard to read. | The heading renders **white**; the card, the gradient and the paragraph unchanged. | Approved (D9) |
| DV-M12-32 | SWEEP-23OCT D4 | Dead link (D9) | S1, S4 and S6 links to `/admin/monitoring`, `/admin/monitoring/sekolah/{id}` and (S6 predictions) `/admin/monitoring/sekolah/{id}/pelajar/{id}` open the SPA 404 for the admin because the M17 mount of the monitoring component was empty. | No change to the link builders (`kirkpatrick-paths.ts`): the targets are correct; M17 now registers `/admin/monitoring*` (DV-M17-46), so every generated link resolves. S8 `/admin/kirkpatrick/pelajar/{id}` was already registered. | Approved (user rule D9) |
| DV-M12-33 | G5-M12 BUG-02 | Visual bug (overlap, D9) | S1 "Taburan Engagement Pelajar" and S4 "Taburan Tahap Engagement": five band tiles side by side at every width; at 320 and 375 the labels ("Champion", "Konsisten", "Berkembang", "Minimum") overlap their neighbours (measured: 3 overlapping label pairs at both widths). | Below `sm` (640 px) the tiles are 2 columns and the last tile (Tidak Terlibat) spans both; from `sm` they stay 5 across exactly as live (768 and 1280 unchanged, no overlap measured). Texts, order, colours and links unchanged. Alternatives: (a) 3 columns below `sm` — rejected: "Berkembang" (84 px) does not fit a third of the panel at 320; (b) a smaller label size — rejected: unreadable and still tight at 320. | Approved (user rule D9) |
| DV-M12-34 | G5-M12 BUG-04 | Visual bug (overlap, D9) | S1 "Kirkpatrick Evaluation Flow" list below `sm`: at 320 the right-hand pill ("73.3% ketepatan") overlaps the label "T2: Pembelajaran" and its sub-line. | The row wraps: when the label column (at least 10 rem) and the pill with its caret do not fit on one line, the pill and caret move to a second line, right-aligned. Texts unchanged; at 375 and wider the layout is as before where it fitted. | Approved (user rule D9) |
| DV-M12-35 | G5-M12 BUG-05 | Visual bug (truncated text, D9) | S3 "Prestasi Mengikut Subjek": the subject name sits in a fixed column (6 rem, 10 rem from `sm`) and a long name is cut with an ellipsis ("…") at every width; most visibly below `sm`, where "Bahasa Melayu" is cut at 320 and 375. | The name wraps at word boundaries ("Bahasa / Melayu") in the same column; no ellipsis at any width. Bar, %, badge and count unchanged. | Approved (user rule D9) |
| DV-M12-36 | G5-M12 BUG-08 | Wrong label (D9) | When there is no data (`subjectGps.year` 0, no trend years) S5 would print "GPS Mengikut Subjek (0)" and "Trend GPS (–)"; the year / range is not observed on live for that state. | The headings drop the bracket part: "GPS Mengikut Subjek" and "Trend GPS". With data they read "GPS Mengikut Subjek (2026)" and "Trend GPS (2022–2026)" as before (AC-M12-21.1, 21.2). The empty-state heading is not defined in the SRS; no new copy is added. | Approved (user rule D9) |
| DV-M12-37 | G5-M12 BUG-09 | Visual bug (clipped text, D9) | `{prefix}/export-pdf` (print view of S6): the four level cards sit 4 across (from `lg`) inside the 768 px sheet, so at a 1280 viewport the card text is clipped ("Pembelajara"). | On the print page the cards are stacked in one column at every width, without the arrows between them; the S6 screen keeps 4 across from `lg` with arrows. Texts and values unchanged. Alternative: 2 columns from `sm` — rejected: it needs new layout classes that raise the design-system debt baseline (`config/ds-debt.baseline.json`, ChainCards), which this fix must not do. | Approved (user rule D9) |
| DV-M12-38 | G5-M12 BUG-11 | Contradictory state (D9, INFERRED alias) | On the school-administrator alias `/admin-sekolah/kirkpatrick?school_id=2&state=Johor` the API forces the own school, but "Penapis aktif" still lists "Sekolah: 2" and "Negeri: Johor" taken from the URL. | On the alias the `school_id` and `state` query values are ignored: no chips, the selects stay at "Semua Sekolah" / "Semua Negeri" and no scope is sent (the data is the own school's, as before). `/admin` and `/guru` mounts are unchanged. | Approved (user rule D9) |
| DV-M12-39 | G5-M12 sweep F-C | Visual bug (clipped text, D9) | S3, S4 and S5 "per school" tables: the school-name link is hard-clipped mid-letter with no ellipsis and no tooltip ("…KEBANGSAAN TING") at 1280, because the table cell does not wrap. | The name wraps to at most two lines and ends with an ellipsis when longer; the full name is the link's tooltip (`title`). Link target, order and columns unchanged; no new copy. The card view (below `md`) is the design-system card title, unchanged. | Approved (user rule D9) |

**Discovery notes corrected by evidence (not deviations; reported to the discovery owner):** (5) the S4 alerts are three lists in fixed order, not one entry per school, and 9 schools appear twice (AUD-M12-01); (6) the 5 served-but-unanswered students and school 940's question-less session explain 951 vs 946 (AUD-M12-02); (7) the heat-map total is 218,070 at the top-up capture and the platform grid has no zero cell (AUD-M12-10); (1) the S4 band captions overlap only at 20 (and "<5" / "0" at 0), not at 5 (DV-M12-10); (2) the green alert count is 12 in the raw capture (`main .space-y-2 > div.bg-green-50`), not 13 as the narrative says (TU-M12-03); (3) the heat-map cell values are **not** in the S4 raw inventory (the narrative says they are); only 944, 6253 and the sum 218,000 are recorded (TU-M12-01); (4) the "GPS = Σ(points × candidates) ÷ candidates" formula of discovery §5.4 does not reproduce 4.30 (DV-M12-22).

---

## 8. Out of scope

| Item | Owner / reason |
|---|---|
| `/admin/laporan` "Laporan Statistik" (admin) | M17 (Delivery Lead decision; not a Kirkpatrick view) |
| `/admin/monitoring*` and `/guru/monitoring*` (link targets of S1, S3, S4, S5) and the link from their school page to S8 | M11 component, mounted by M17 |
| Users, schools, `lastLoginAt`, the T4/T5 monitoring rows | M01/M02 (owners; M12 requests in SRS §6.8) |
| Practice sessions and answers (T2/T3/T4 source) | M05 (owner; M12 reads a named segment, XR-M12-02) |
| Headcount entries, TOV marks, school SPM/GPS history | M08 (owner; XR-M12-04/05) |
| Daily mood check-in store and the populated mood analysis | M26 (decided, provisional; OQ-M12-06); M12 shows only the empty card |
| Teacher-dashboard "🔬 Kirkpatrick" summary panel | M10 |
| Admin-dashboard T1 blocks ("Jumlah Respon 336 · Purata Kepuasan 4.6/5 · NPS Score 8.3", "4.7/10") | M17 (reads M12 Q-M12-T1, XR-M12-09; "4.7" is not derivable from the M12 store) |
| Pre/post diagnostic tests and the populated Learning Gain | Not a live feature (permanent empty state) |
| Real PDF layout of `/admin/kirkpatrick/export-pdf` | Not observable (Q-M12-8); prototype PROPOSED |
| Intervention edit/update UI | Absent on live (edit → 404; GET `{id}` → 405); the update endpoint is INFERRED only |
| Real server-side authorisation, scoping, CSRF, auditing | Backend phase (SRS §11.1) |
| Global shells, notification bell, server-status widget, chatbot, FCM, the tournament banner in S9/S10 | Global shell / M23, M22, M16 |

---

## 9. Open questions

1. **OQ-M12-01 Teacher account (blocking G5 for the provisional parts; Q-M12-1).** What a teacher sees on `/guru/kirkpatrick*` (shell, data scope — whole platform or own school?), whether the `/admin/…` targets work for a teacher, and which menu links reach `/kirkpatrick` and `/maklum-balas` for students. Until then FN-1.1.3 (teacher), 1.2.3 and US-M12-04 are provisional.
2. **OQ-M12-02 Monthly feedback form (Q-M12-2).** Questions, scales, copy, validation, success message, which roles are asked and how users are invited. The form of FN-11.1.2 is PROPOSED; only the thank-you state is observed. Whether "336 respon" counts all months (assumed) or the current month.
3. **OQ-M12-03 Server formulas (Q-M12-3).** School engagement "Skor", ALESA component scaling, Keyakinan rule, S8 "Konsistensi", the correlation definition (DV-M12-23). All are stored/observed values in the prototype, not formulas.
4. **OQ-M12-04 S8 entry — closed (v1.1).** The observed S8 students are M11 "kirkpatrick" rows (M11 Soalan 0) and M12 active students at 8080 with two live ids (DV-M12-25, DV-M12-24). Remaining: what S8 shows for a student with no answers at all (FN-9.5.1, provisional).
5. **OQ-M12-05 SPM / GPS source (Q-M12-5).** 2022–2025 values = M08 SchoolSpmHistory ("SPM Sebenar"); the 2026 subject GPS rows (30 candidates each), the 2025 grade distribution (180) and school 8080's 2026 row (GPS 4, 1 B+ candidate) have no visible import. Meaning of "41 rekod" (unchanged across scopes, DC-M12-01).
6. **OQ-M12-06 Mood check-in owner (Q-M12-6) — decided: M26, provisional** (XL batch 3, XL3-23 / R2-12; provisional contract recorded in M17 v1.4). The daily mood (4 values: Gembira, Okay, Sedih, Tertekan) appears in S4 (empty card), in the S7 form and on the M10 teacher dashboard ("💚 Mood Pelajar"). M12 creates no store; it will read a count of check-ins per scope through the M26 contract; until M26 is built the count is 0 and S4 shows the empty card.
7. **OQ-M12-07 S9 populated states (Q-M12-7).** Activity-square thresholds (PROPOSED 1–9 / 10–29 / ≥ 30), the populated Head Count card (PROPOSED reuse of the S8 rows) and other "Kesimpulan" variants.
8. **OQ-M12-08 PDF content (Q-M12-8).** Prototype returns a PROPOSED one-page PDF with the S6 figures.
9. **OQ-M12-09 Interventions (Q-M12-9).** List columns, status transitions, server validation copy and the update flow. PROPOSED: FN-8.2.4 error "Pelajar tidak dijumpai.", FN-8.3.2 list layout, status rule of FN-8.1.1 (equal accuracy counts in no status card).
10. **OQ-M12-10 Correlation band 21–50.** Its values were never displayed (DV-M12-02); to be supplied by the owner if the row is wanted.
11. **OQ-M12-11 Heat-map scope (Q-M12-4).** Period covered and the hours 00–05: the platform grid sums to 218,070 of 306,203 answers (top-up), and at 9167 the grid holds 116 answers against the KPI's 545 — the grid covers a subset of the answers.
12. **OQ-M12-12 PROPOSED items to report at G1:** FN-7.1.2 PDF, FN-8.2.4 error copy, FN-8.3.2 list layout, FN-9.2.1 70% threshold, FN-10.1.2 populated Head Count rows, FN-10.1.3 square thresholds, FN-11.1.2 form and its copy (title, two questions, "Hantar"), the T1 respondent split (SRS §6.6), the S5 prediction tie order (user id ascending, FN-6.6.1). (v1.1: the S8 bar colours are observed, no longer PROPOSED.)
13. **OQ-M12-13 Two practice sources (cross-module, for the XL gate).** Live M12 and M11 figures come from different sources (DV-M12-24). The rebuild keeps one M05 store with two named segments (SRS §6.3); M05 must confirm it can host a session-level segment whose answers are not all in the answer-log segment M11 counts (XR-M12-02).
14. **OQ-M12-14 M17 T1 "4.7/10" (AUD-M12-11).** M17 shows a T1 figure "★★☆☆☆ 4.7/10" with 336 responses that no aggregate of the M12 feedback store reproduces (NPS 8.3, satisfaction 4.6). M17 must record its own DV or display constant (XR-M12-09).
15. **OQ-M12-15 Admin Sekolah alias and 8880 (v1.6).** `/admin-sekolah/kirkpatrick` (S1 only, own school) and the 8880 display (DV-M12-29) are INFERRED; no school-admin account and no observation of 8880 with a school filter exist. Teacher twins keep the admin data (provisional; teacher scoping = backend phase, SRS SEC-M12-01/02).

### 9.1 Discovery top-up requests (observable on live, not captured)

v1.1: all eight were captured by the audit on 2026-09-26 (`_topup-2026-09-26.json`); what is adopted under the 2026-09-25 baseline is stated per row and in §9.2. Non-adopted values stay generated with `observed:false` and no E2E asserts them.

| ID | What to capture (read-only, admin, lane with login) | Used by |
|---|---|---|
| TU-M12-01 | **Captured (audit top-up). 8080 grid adopted (8080 unchanged); platform grid = reference values except the two cells seen on both days (6253, 944): its Σ grew 218,000 → 218,070 with the answer growth (R2-03).** — S4 heat map: all 7 × 18 cell values (`title` of each cell), default and `?school_id=8080` | FN-5.5.1, AC-M12-17.1 |
| TU-M12-02 | **Captured. Adopted: every 8080 row, the 10 zero-answer rows (incl. 940), the Aktif column of every row, order, colours, Tahap split. Other rows: reference only (see §9.2).** — Every row of the three school tables (S3 33 rows, S4 33 rows incl. the code line, S5 33 rows) with school id and every cell; which school shows "Skor Purata 90%" with 0 answers (DV-M12-15) and which shows Engagement "2" with Aktif 0 | FN-4.4.1, 5.4.1, 6.5.1, 5.6.1 |
| TU-M12-03 | **Captured and adopted in full (35 items; 10220; 12 green).** — S4 alert list in order with the school id of each item (the order matches the table links), the texts of all green items (raw count 12 vs narrative 13) and the school of the "2 guru" item | FN-5.6.1, AC-M12-18.1 |
| TU-M12-04 | **Captured and adopted in full (Sejarah at its baseline value).** — S3 all 26 subject rows (name, %, count) and the 24 rows of `?school_id=8080` | FN-4.3.1, AC-M12-12.1 |
| TU-M12-05 | **Captured and adopted (8080 unchanged).** — S1 comparison of `?school_id=8080`: both panels' four values and range labels (only the differing strings were captured) | FN-2.4.2 |
| TU-M12-06 | **Captured: the platform rows relabelled (DV-M12-26).** — S5 `?school_id=8080`: the 5 subject-GPS rows (2025) and the 7 trend rows (2022–2025) | FN-6.3.1, 6.4.1, AC-M12-21.3 |
| TU-M12-07 | **Captured and adopted (colours; school 8080; second ids, DV-M12-25).** — S8 Student B: bar colours of 60.0%, 55.0%, 40.0%, 33.3%, 20.0% and 0.0%; the school ids of 4664 and 4644; whether either appears as a "kirkpatrick" link on its M11 school page | FN-9.4.1, OQ-M12-04 |
| TU-M12-08 | **Captured. Adopted: 8080 prediction rows (53) and 8080 ALESA (50); platform ALESA school/grade/Keyakinan/Cadangan/order; platform prediction per-row values reference only.** — S5 prediction table: per-row answers, accuracy and school (no names; the colour-band split 512 / 206 / 104 / 95 / 29 is already observed); ALESA rows: accuracy, grade and Keyakinan per row (no names) | FN-6.6.1, 6.7.3 |
| TU-M12-09 | **New (R2-02).** Inventory top-up of the "school without SPM history" state on S1 and S5 (`?school_id=9167`), and a check of which schools have a history row (at least 8080; M17 discovery reports SPM data for **8880**; the others are not verified), so that the 10 audit-observed elements of §6.3 get regular `EL-M12-S#-nnn` ids | FN-2.2.5, 6.1.2 |

### 9.2 Baseline and top-up adoption (Delivery Lead decision, AUD-M12-05)

**Baseline:** the live state of 2026-09-25 (discovery snapshot) and the M05 mock clock `2026-09-25T15:40:00+08:00`. The audit top-up (2026-09-26 13:00–13:10) is adopted only where a value is **provably unchanged** between the two captures. The proof used: cumulative counts only grow, so (a) a row that is 0 on 26 Sep was 0 on 25 Sep; (b) when a platform total is equal on both days, every per-row count that adds up to it is unchanged; (c) school 8080 showed identical figures on both days. Rows that fail these tests are kept as **reference values** (`observed:false`), generated under the 25-Sep totals, and never asserted.

**Figures that moved between the captures, and the choice made**

| Figure | 2026-09-25 (baseline, kept) | 2026-09-26 13:00 (top-up) | Choice |
|---|---|---|---|
| Soalan Dijawab (platform) | 306,133 | 306,203 | 25-Sep; the +70 are all in Sejarah (57,695 → 57,765; every other subject row equal), so all other subject rows are adopted |
| Sessions (platform) | 20991 | 20998 | 25-Sep |
| SELEPAS panel | "01 Sep 2026 - 25 Sep 2026" 58 / 87% / 13,968 / 28; deltas "+56" "+53.7%" "+13965" "+28"; "meningkat 465500%" | "01 Sep 2026 - 26 Sep 2026" 60 / 86.9% / 14,038 / 28; "+58" "+53.6%" "+14035"; "467833.3%" | 25-Sep (mock clock); the 26-Sep sentence fixes only the format rule (1 decimal, AUD-M12-06) |
| ROI "Purata Soalan/Pelajar" | 323.6 | 323.7 | 25-Sep |
| "Rekod Headcount" | 4378 | 4379 | 25-Sep; display constant DC-M12-02 (M08 does not host the count, XL3-34) |
| Sejarah subject row | 76.3% / 57695 | 76.3% / 57765 | 25-Sep |
| S9 day squares | 27/08 … 25/09 | 28/08 … 26/09 | mock clock |
| Platform heat grid | Σ ≈ 218,000 (narrative), cells not captured; 6253 and 944 recorded | 126 cells, Σ 218,070 | reference values except 6253 and 944 (R2-03) |
| Per-school answers / sessions / scores of the 23 active non-8080 schools | not captured | captured | reference only (the +70 answers and +7 sessions fall in unknown schools) |
| Platform prediction rows (answers, accuracy) of non-8080 students | not captured | captured | reference only; counts per school and the band split (equal on both days) adopted |

**Adopted without change (provably equal):** every 8080 figure (S1 panels 12 / 71.6% / 511 / 3 and 1 / 55% / 60 / 1, S3 24 subject rows, S3/S4/S5 rows, 53 prediction rows, 50 ALESA rows, heat grid); the zero-answer school rows (940, 987, 995, 8198, 8284, 8302, 8308, 9801, 10220); the table "Aktif" of every school (Σ unchanged); the 35 alert items (red counts from login data equal to the M11 25-Sep snapshot; green shares from the unchanged Aktif); the 26 platform subject rows (Sejarah at its 25-Sep value); the platform ALESA grades, Keyakinan, Cadangan band, school and order (the grade and Keyakinan counts are equal on both days); S8 bar colours; the 8080 heat grid (8080 unchanged) and, of the platform grid, only the cells "Selasa 14:00 — 6253" and "Isnin 06:00 — 944" recorded on both days; the other platform cells are reference values (the grid total grew 218,000 → 218,070 with the answer growth, so cells changed — R2-03). Structure, order, colours and rules are adopted from the top-up in full.
