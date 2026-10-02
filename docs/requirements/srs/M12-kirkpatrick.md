# M12 — Kirkpatrick Evaluation — Software Requirements Specification

## 0. Document control

| Field | Value |
|---|---|
| Document | SRS — M12 Kirkpatrick Evaluation |
| Version | 1.6 |
| Date | 2026-09-30 |
| Status | Approved (G1) — approved 2026-09-26 (audit PASS round 3); v1.5 2026-09-27 aligned to XL batch 3 |
| Author | product-analyst (agent) for §1–§5, §8–§10, §12–§13; solution-architect (agent) for §6 data entities, named queries, dataset specs and seeds, §7 mock API, §11 |
| Source URS | [urs/M12-kirkpatrick.md](../urs/M12-kirkpatrick.md) v1.0 (EP-M12-1…11, FN-M12-n.n.n, US-M12-01…34, AC-M12-nn.m) |
| Source discovery | [M12-kirkpatrick.md](../../discovery/M12-kirkpatrick.md), inventory `docs/discovery/inventory/M12/` (+ raw `inventory/_raw/M12/`), screenshots `docs/discovery/img/M12/`; cross-check `docs/discovery/inventory/M11/_snapshot-2026-09-25.json` |
| Related | [M01](M01-authentication.md) (User, `lastLoginAt` XR-M11-01, guest redirect, 403/404 pages, canonical accounts 1–11), [M02](M02-users-schools.md) (users dataset 5,159, schools register, fixture schools 900001–900099, runtime ids), [M03](M03-curriculum.md) (subjects), [M05](M05-practice.md) (PracticeSession DATA-M05-01, QuizAnswer DATA-M05-02, mock clock), [M08](M08-student-performance.md) (HeadcountConfig/Entry DATA-M08-02/03, SchoolSpmHistory DATA-M08-09, BR-M08-01/02/04), [M11](M11-teacher-analytics.md) (monitoring component, BR-M11-34, XR-M11-01/02/04), M10, M16, M17, [design/shells.md](../../design/shells.md), [design/design-system.md](../../design/design-system.md), ADR-0013 (virtual datasets, `DISPLAY_CONSTANT`), ADR-0014 (store ownership) |

**Change log**

| Version | Date | Change |
|---|---|---|
| 1.6 | 2026-09-30 | **Revision history — v1.6, F-26c build and G4 review.** BR-M12-06 and BR-M12-08 bands ≥ 50 / 20–49; 8080 correct 11,339 (Q-M12-CORRECT); 8880 accuracy INFERRED (DV-M12-F26c-03); S4 "Sesi" deviations; heat grid INFERRED and ≈ 218,000 (BR-M12-13, Q-M12-HEAT); new §0.2 and NFR-M12-06 (lazy aggregate). No other observed value changes. |
| 1.5 | 2026-09-27 | **Revision history — v1.5.** 93 FRs, 33 BRs, 6 M12 data entities (2 stores, 3 stored score tables, 1 display-constant set) + 8 read models, 14 mock endpoints (all owned), 65 E2E (10 provisional), 9 SEC items. XL3 round 2 (R2-12): mood check-in owner **decided: M26, provisional** (provisional contract recorded in M17 v1.4); XR-M12-08 and OQ-M12-06 updated. No other change. |
| 1.4 | 2026-09-27 | **Revision history — v1.4, XL batch 3 alignment (`docs/qa/audit/cross-module-logic-M12-M18.md`; owners M05 v1.11, M08 v1.8, M02 v1.15, M11 v1.9, M17 v1.4). XL3-04: the practice segment is the separate M05 store **KirkpatrickSessionAggregate (DATA-M05-12, M05 §6.14.4)**, outside Q-SESS-ALL and never joined to the answer log; every session query cites it. XL3-34: M08 does not host Q-M12-HC-RECORDS, so **DC-M12-02 (4378) is active** for "Rekod Headcount" (FN-2.2.1, 6.1.1; BR-16). XL3-33: the M12 intervention entity and repository are renamed **KirkpatrickIntervention** / `kirkpatrickInterventions` (M18 keeps its own). XL3-07: the 2026 subject rows are M08 SchoolSpmHistory rows stored at school 8880; M12 shows them as the platform subject table in every scope (DV-M12-26). XR statuses: XR-01, 02, 04, 06, 09, 10 applied; XR-05 applied except the record count (DC-02); XR-08 open (mood owner, recommended M26, XL3-23). No observed value changes. |
| 1.3 | 2026-09-26 | **Revision history — v1.3, audit round 3 PASS → Approved (G1).** R3-01: BR-M12-16 no-history state worded as observed (8080 with history, 9167 without, others not verified; 8880 in TU-M12-09). R3-02: URS §6 counts include the §6.3 elements. XR-M12-02, 05, 09, 10 open for the XL batch 3 gate. |
| 1.2 | 2026-09-26 | **Revision history — v1.2, audit round 2** (FAIL 0/2/2). R2-01: DATA-M12-07 (S8 alias) removed; FR-78 without alias; 5571/5551 → 403 via FR-17 (E2E-63). R2-02: new FR-M12-92/93, BR-16/17/18/23/24 no-history state, DV-M12-28 ("41 rekod"), §8.1 copy, new E2E-65. R2-03: Q-M12-HEAT platform grid reference except 6253/944; E2E-35 narrowed. R2-04: XR-M12-10 extended (M11 zero-answer student page). Build note: DC-M12-02 fallback for "Rekod Headcount". |
| 1.1 | 2026-09-26 | **Revision history — v1.1, audit round 1** (FAIL 0/5/7). AUD-01: BR-M12-14 three alert lists (FR-46, E2E-36, E2E-62 now observed, new E2E-64). AUD-02: Q-M12-TBL-AKTIF (951) and Q-M12-TBL-SOALAN (served) modelled; DV-M12-08 applied to KPIs, tables, bands and green alerts (BR-02/06/10/11, FR-44/52, new AC-14.4 / E2E-64). AUD-03: DATA-M12-04 per-scope stored lists, `schoolOverrides` removed (BR-22, FR-55–57, E2E-42). AUD-04: DATA-M12-07 S8 route alias 5571 → 4664, 5551 → 4644 (DV-M12-25, FR-78, new E2E-63); Students A/B are 8080 rows. AUD-05: baseline 2026-09-25 (URS §9.2; §6.9 pins the adopted top-up rows). AUD-06 BR-08 growth 1 decimal; AUD-07 BR-28 bar colours observed; AUD-08 BR-21 tie order PROPOSED, not asserted; AUD-09 BR-19/20 school scope = platform tables (DV-M12-26), XR-05 narrowed; AUD-10 Q-M12-HEAT observed grid, E2E-35 zero style on 8080; AUD-11 XR-M12-09 to M17; AUD-12 DC-M12-02 withdrawn → Q-M12-HC-RECORDS (M08 live count). |
| 1.0 | 2026-09-26 | First issue. 91 FRs, 33 BRs, 14 endpoints, 62 E2E (12 provisional), 9 SEC items. Every figure is a named query on the owners' datasets (M02, M05, M08) or on the two new M12 stores, except three documented display constants (DC-M12-01…03, DV-M12-22/23). Cross-module requests in §6.10; discovery top-ups in URS §9.1. |

### 0.1 Fidelity deviations referenced here

URS §7 is authoritative. Approved fixes: DV-M12-01 (intervention panel works; dead instruction removed), 02 (duplicate correlation row removed), 03 (header titles S6, S8, S9, S10), 05 (no false click affordance), 06 (ALESA icon), 07 (selects fit and ≥ 36 px; S7 header button ≥ 36 px), 08 (one "aktif" definition, 946; bands partition 4,158), 09 (GPS 2 decimals), 11 (405 → 404), 12 (active item on `/guru` twins), 13 ("(22.8%)"), 14 ("-" slate-300), 15 (Skor Purata over answered sessions), 16 (one pass rule A+…D), 08 re-decided in v1.1 (answered definition on KPIs, tables, bands, alerts), 25 (one id per student; S5 links use it; 5571/5551 → 403 as live), 28 ("41 rekod" without the dangling separator), 26 (platform headings for `school_id` subject/trend tables). Rejected — replicate live: DV-M12-04, 10, 17, 18, 19, 20, 21, 22, 23, 24, 27.

### 0.2 F-26c build deviations and INFERRED notes (v1.6)

Recorded from the F-26c build and its G4 review. No observed value changes except where stated.

| ID | Item | Decision / status |
|---|---|---|
| DV-M12-F26c-01 | BR-M12-06 bands | ≥ 50 / 20–49 / 5–19 / 1–4 (was > 50 / 20–50). The observed 946 rows give 513 / 259 / 169 / 5 only with these bounds; 16 students have exactly 50. Month "Champion" (BR-M12-08) also uses ≥ 50. INFERRED boundaries. |
| DV-M12-F26c-02 | 8080 correct answers | 11,339, not 11,345. The 53 observed student rows allow at most 11,339; "75.6%" displays either way. SRS 11,345 was an unobserved fit. |
| DV-M12-F26c-03 | 8880 accuracy (Delivery Lead decision) | 8880's 25-Sep accuracy 90.1% is INFERRED (date unobserved). The 26-Sep 89.9% is not reproduced: the drift model cannot reach both it and the observed platform correct total 253,478. Rejected: (b) platform correct 253,467 (changes an observed total); (c) raising another school's displayed accuracy by 0.1. |
| DV-M12-F26c-04 | S4 "Sesi" (Q-M12-SESSIONS) | 8107 shows 5 (live 1); 8228 shows 4 (live 3): every student with a served question needs a session (model invariant). 8880 shows 3,935 (live, 26-Sep, 3,947); platform stays 20,991. Alternatives: (a) keep live per-school values and break the invariant; (b) keep the live 8880 value, making the platform KPI a visible 20,996. Chosen: as first stated. |
| DV-M12-F26c-05 | Heat grid (BR-M12-13, Q-M12-HEAT) | Stored table covering about 71% of answers (OQ-M12-11). The 9167 cell positions and the residual split are INFERRED. BR-M12-13 said Σ 218,070 and Q-M12-HEAT said ≈ 218,000; the build uses ≈ 218,000. |

---

## 1. Scope

The M12 prototype implements, against the mock service layer, the ten screens of URS §1 — S1–S8 mounted once and routed on both `/admin/kirkpatrick*` and `/guru/kirkpatrick*`, S9 `/kirkpatrick`, S10 `/maklum-balas` — with every figure computed from the owners' datasets (M02 users and schools, M05 practice sessions, M08 headcount and SPM history) per D11/D12. M12 stores only: FeedbackResponse (DATA-M12-01), Intervention (DATA-M12-02), the server-computed scores it cannot derive (DATA-M12-03/04/05) and three display constants (DATA-M12-06).

**Out of scope:** URS §8 — `/admin/laporan` (M17), the monitoring pages (M11/M17), mood check-in storage (open owner), pre/post tests, real PDF layout, intervention editing, the backend.

---

## 2. Screens & routes

Query names are kept as on live (`school_id`, `state`) so bookmarked links work unchanged. `{id}` is an integer.

| # | Route (both prefixes unless noted) | Screen | Primary actor(s) | Shell · header / tab title | API (§7) |
|---|---|---|---|---|---|
| S1 | `/admin/kirkpatrick`, `/guru/kirkpatrick` (`?school_id=&state=`) | Overview | Admin; Guru (provisional) | SHA · "Kirkpatrick Evaluation" / "Kirkpatrick Evaluation Dashboard" | #1, #14 |
| S2 | `…/reaction` | T1 Reaksi | Admin; Guru (prov.) | SHA · "Tahap 1: Reaksi" / "Tahap 1: Reaksi — Kirkpatrick" | #2 |
| S3 | `…/learning` (`?school_id=`) | T2 Pembelajaran | Admin; Guru (prov.) | SHA · "Tahap 2: Pembelajaran" / "Tahap 2: Pembelajaran — Kirkpatrick" | #3 |
| S4 | `…/behavior` (`?school_id=`) | T3 Tingkah Laku | Admin; Guru (prov.) | SHA · "Tahap 3: Tingkah Laku" / "Tahap 3: Tingkah Laku — Kirkpatrick" | #4, #14 |
| S5 | `…/results` (`?school_id=`) | T4 Hasil | Admin; Guru (prov.) | SHA · "Tahap 4: Hasil" / "Tahap 4: Hasil — Kirkpatrick" | #5 |
| S6 | `…/chain` | Rantaian Impak | Admin; Guru (prov.) | SHA · "Rantaian Impak" (DV-M12-03) / "Kirkpatrick Impact Chain" | #6, #7 |
| S7 | `…/interventions` | Intervensi | Admin; Guru (prov.) | SHA · "Intervensi Pelajar" / "Intervensi — Kirkpatrick" | #8, #9 |
| S8 | `…/pelajar/{id}` | Student Kirkpatrick detail | Admin | SHA · "Kirkpatrick — {nama}" (DV-M12-03) / "Kirkpatrick — {nama}" | #10 |
| S9 | `/kirkpatrick` | Prestasi Saya | Pelajar; any logged-in user | SHU · "Kirkpatrick — Prestasi Saya" (DV-M12-03) / same | #11 |
| S10 | `/maklum-balas` | Maklum Balas | Pelajar, Guru, Admin | SHU · "Maklum Balas" (DV-M12-03) / "Maklum Balas — PrestasiPlus" | #12, #13 |

`/admin/kirkpatrick/export-pdf` (#7) opens in a new tab. `/admin/kirkpatrick/interventions/{id}` and `/interventions/create` (GET) → the M01 404 page (DV-M12-11). The probed paths of URS §1 → 404.

---

## 3. Functional requirements

| ID | Requirement | FN | AC |
|---|---|---|---|
| FR-M12-01 | The admin-panel sidebar SHALL hold the collapsible group "Kirkpatrick" (`fa-microscope` cyan-500, upper case by CSS, chevron, state in `localStorage["admin_sidebar"]`) with the 7 items of FN-1.1.1 in that order, with their icons and `/admin/kirkpatrick…` targets; on an `/admin/kirkpatrick*` route the group is open and the route's item active. "Laporan" follows the group, outside it. | 1.1.1 | 01.1 |
| FR-M12-02 | The admin-panel "Lagi" drawer (below `lg`) SHALL list "Kirkpatrick" (`fa-microscope`) → `/admin/kirkpatrick`. | 1.1.2 | 01.2 |
| FR-M12-03 | The user-portal drawer (below `lg`) SHALL hold, under "Portal Guru" › "ANALITIK", the button "Kirkpatrick" (`fa-microscope`, chevron) toggling the 7 items of FN-1.1.3 with `/guru/kirkpatrick…` targets and "T2: Pembelajaran" using `fa-graduation-cap`; the group renders for a teacher (INFERRED) and is present but not displayed for the admin; the desktop user sidebar has no Kirkpatrick entry. | 1.1.3 | 04.1 |
| FR-M12-04 | On `/guru/kirkpatrick*` the admin-panel sidebar SHALL open the group and mark the item of the current view active, as on the `/admin` twin (DV-M12-12). | 1.1.4 | 02.1, 02.2 |
| FR-M12-05 | The shell header SHALL show, and the document title SHALL be, for S1–S5 and S7, the exact title/subtitle and tab title of URS §1. | 1.1.5 | 01.4 |
| FR-M12-06 | The header SHALL show "Rantaian Impak" on S6 and "Kirkpatrick — {nama}" on S8, with no subtitle (DV-M12-03, DV-SH-03); tab titles unchanged. | 1.1.6 | 01.5 |
| FR-M12-07 | The user-portal header SHALL show "Kirkpatrick — Prestasi Saya" on S9 and "Maklum Balas" on S10, with no subtitle (DV-M12-03). | 1.1.7 | 01.6 |
| FR-M12-08 | S1–S8 SHALL render in the admin-panel layout on both prefixes; S9–S10 in the user-portal layout (with the M16 banner slot); 403/404 standalone. | 1.1.8 | 01.7 |
| FR-M12-09 | S2, S3, S4, S5 and S7 SHALL show the tab strip of FN-1.1.9 (6 plain links to unfiltered `/admin/kirkpatrick…` URLs, current tab highlighted); S1 and S6 SHALL NOT. | 1.1.9 | 01.3 |
| FR-M12-10 | Every M12 screen SHALL meet §10 at 375 / 768 / 1280 with no page-level horizontal scroll. | 1.1.10 | 34.1, 34.2 |
| FR-M12-11 | Every M12 route SHALL require a session; a guest SHALL be redirected to `/login` (M01). | 1.2.1 | 03.1 |
| FR-M12-12 | Each view SHALL be one component mounted on both prefixes with identical content; every in-page link, form action, "Reset", "← Kembali", the export link and the intervention POST SHALL target `/admin/kirkpatrick…` (DV-M12-04 rejected). | 1.2.2 | 04.2 |
| FR-M12-13 | Access: admin → all routes; teacher → `/guru/kirkpatrick*` with the same data (provisional), and the M17/M01 non-admin rule on `/admin/*`; any logged-in user → `/kirkpatrick`, `/maklum-balas`. | 1.2.3 | 04.3 |
| FR-M12-14 | The probed paths of URS §1 and non-numeric ids SHALL render the M01 404 page. | 1.2.4 | 03.2 |
| FR-M12-15 | Query handling SHALL follow BR-M12-01: `school_id`/`state` on S1, `school_id` on S3/S4/S5, ignored on S2/S6/S7; an unknown `school_id` gives the zero state (provisional). | 1.2.5 | 03.5, 03.6 |
| FR-M12-16 | GET on `/admin/kirkpatrick/interventions/{id}` and `/interventions/create` SHALL render the M01 404 page (DV-M12-11). | 1.2.6 | 03.3 |
| FR-M12-17 | S8 with an id that is not a user SHALL render the M01 403 page with the copy of FN-1.2.7. | 1.2.7 | 03.4 |
| FR-M12-18 | S1 SHALL show the filter form of FN-2.1.1 (GET `/admin/kirkpatrick`, `school_id` options from #14: "Semua Sekolah" + the 57 schools A→Z; `state` options: "Semua Negeri" + the 10 states), preloaded from the query; submit "Tapis" navigates with both parameters; each select ≥ 36 px tall and `max-width: 100%` of the card (DV-M12-07). | 2.1.1 | 05.1, 05.2, 05.5 |
| FR-M12-19 | S1 SHALL show "Reset" (`fa-times`) → `/admin/kirkpatrick` only when `school_id` or `state` is non-empty. | 2.1.2 | 05.2 |
| FR-M12-20 | The T4 card SHALL show the GPS of BR-M12-16 (2 decimals, DV-M12-09) and "GPS Sekolah · {DC-M12-02} rekod headcount", linking to `/results`; `state` and `school_id` do not change the record count. | 2.2.1 | 06.1, 05.3, 05.4 |
| FR-M12-21 | The T3 card SHALL show "{active}" + "/{T4T5}" and "Pelajar aktif · {sessions} sesi · {accuracy}% ketepatan" (BR-M12-02/03/05; counts without thousands separator), linking to `/behavior`. | 2.2.2 | 06.1, 05.3, 05.4 |
| FR-M12-22 | The T2 card SHALL show "{accuracy}%" and "Ketepatan · {answers} soalan dijawab" (answers with separator), linking to `/learning`. | 2.2.3 | 06.1, 05.3 |
| FR-M12-23 | The T1 card SHALL show "{satisfaction}" + "/5" and "Kepuasan purata · {responses} respon" (BR-M12-32, global), linking to `/reaction`; cards `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` in the order T4, T3, T2, T1. | 2.2.4 | 06.1, 06.2, 06.3, 10.2 |
| FR-M12-24 | The flow card SHALL show the title, hint and, from `sm`, the 4 linked circles with the labels, sub-labels and pills of FN-2.3.2 (T3 pill = active students, T4 pill = "GPS {gps}"). | 2.3.1, 2.3.2 | 07.1, 07.3 |
| FR-M12-25 | Below `sm` the flow SHALL render as the vertical linked list of FN-2.3.3. | 2.3.3 | 07.2 |
| FR-M12-26 | The comparison card SHALL show the subtitle and the SEBELUM/SELEPAS panels of BR-M12-08 (BM month names, "dd Mmm yyyy - dd Mmm yyyy" ranges, "-" when no data), panels side by side from `md`. | 2.4.1, 2.4.2 | 08.1, 08.4, 08.5, 08.6 |
| FR-M12-27 | The four delta tiles SHALL show after − before with sign, green/`fa-arrow-up` when ≥ 0 and red/`fa-arrow-down` when < 0 (accuracy with "%"), 2 × 2 below `md`. | 2.4.3 | 08.2, 08.4 |
| FR-M12-28 | "Ringkasan:" SHALL show the sentences of BR-M12-08 in the fixed order. | 2.4.4 | 08.3, 08.4, 08.5 |
| FR-M12-29 | The KPI row SHALL show the 4 links of FN-2.5.1 with the scoped values (BR-M12-01/02/03/07). | 2.5.1 | 09.1, 05.3, 05.4 |
| FR-M12-30 | "Taburan Engagement Pelajar" SHALL show the 5 band links (BR-M12-06; counts without separator, "%" 1 decimal of T4/T5) with the icons and tints of FN-2.6.1, 5 columns at every width. | 2.6.1 | 09.2, 09.4, 05.3 |
| FR-M12-31 | S1 SHALL show the static info card of FN-2.7.1. | 2.7.1 | 09.3 |
| FR-M12-32 | S2 SHALL show the 4 cards of FN-3.1.1 from #2 (BR-M12-32), no filter. | 3.1.1 | 10.1, 10.3 |
| FR-M12-33 | Every T1 figure SHALL ignore `school_id` and `state`. | 3.1.2 | 10.2 |
| FR-M12-34 | S3 SHALL show the 6 KPI cards of FN-4.1.1 (BR-M12-03/04/05; "Learning Gain" "-" permanently). | 4.1.1 | 11.1, 11.4 |
| FR-M12-35 | S3 SHALL read `school_id` from the URL (no form). | 4.1.2 | 11.2 |
| FR-M12-36 | S3 SHALL show the static Learning Gain card of FN-4.2.1. | 4.2.1 | 11.3 |
| FR-M12-37 | S3 SHALL list one row per subject with answers in scope, by accuracy descending (ties: answers descending, then subject id), with the bar, 1-decimal label, status of BR-M12-09 and "{n} soalan" (no separator). | 4.3.1 | 12.1, 12.2 |
| FR-M12-38 | Subject rows (S3) and subject cells (S5) SHALL have the default cursor, no `title` and no action (DV-M12-05). | 4.3.2 | 12.3 |
| FR-M12-39 | S3 SHALL show "Pembelajaran Mengikut Sekolah" per BR-M12-10 (33 rows; colours; Skor Purata per DV-M12-15), scrolling inside its card. | 4.4.1 | 13.1, 13.2, 13.3 |
| FR-M12-40 | S4 SHALL show the filter of FN-5.1.1 (GET `/admin/kirkpatrick/behavior`, `school_id` only), select as FR-M12-18. | 5.1.1 | 14.1, 14.2, 14.3 |
| FR-M12-41 | S4 SHALL show "Reset" → `/admin/kirkpatrick/behavior` only when filtered. | 5.1.2 | 14.2 |
| FR-M12-42 | S4 SHALL show the 6 KPI cards of FN-5.2.1 (BR-M12-02/03/05/07); with a school filter "Pernah Aktif" and "Soalan Dijawab" equal the row's "Aktif" and "Soalan". | 5.2.1 | 14.1, 14.2, 14.4 |
| FR-M12-43 | S4 SHALL show the 5 band tiles of FN-5.3.1 → `/admin/monitoring`, computed by BR-M12-06, with captions as live and mini bars of width = %. | 5.3.1 | 15.1, 15.2, 15.3 |
| FR-M12-44 | S4 SHALL show "Engagement Mengikut Sekolah" per BR-M12-11/12 (33 rows by Skor descending, ties school id; Aktif and Soalan answered, DV-M12-08), scrolling in its card. | 5.4.1 | 16.1, 16.2, 14.4 |
| FR-M12-45 | S4 SHALL show the heat table of BR-M12-13 (7 × 18 cells, titles, alpha rule, zero style), scrolling in its card. | 5.5.1 | 17.1, 17.2 |
| FR-M12-46 | S4 SHALL show "Amaran & Pemerhatian" per BR-M12-14 — three lists in fixed order (never-login red, teacher-login-without-answers red, active > 50% green), each in school-id order, a school possibly in several — only when it has ≥ 1 item; no item has a button. | 5.6.1 | 18.1, 18.2, 18.4 |
| FR-M12-47 | S4 SHALL show the mood empty card while the mood count in scope is 0 (always, in the prototype; BR-M12-15). | 5.7.1 | 18.3 |
| FR-M12-48 | S5 SHALL show the 6 KPI cards of FN-6.1.1 (BR-M12-16/18, DV-M12-09/16). | 6.1.1 | 19.1, 19.2 |
| FR-M12-49 | S5 SHALL show "Taburan Gred ({year})" per BR-M12-17. | 6.2.1 | 20.1, 20.2 |
| FR-M12-50 | S5 SHALL show "GPS Mengikut Subjek (2026)" per BR-M12-19 (platform rows in every scope, DV-M12-26), subject cells plain (FR-M12-38), with the note. | 6.3.1 | 21.1, 21.3, 21.4 |
| FR-M12-51 | S5 SHALL show "Trend GPS (2022–2026)" per BR-M12-20 (platform rows in every scope, DV-M12-26) with "-" in slate-300 (DV-M12-14) and the legend. | 6.4.1 | 21.2, 21.3, 21.4 |
| FR-M12-52 | S5 SHALL show "Prestasi Mengikut Sekolah (Platform + Headcount)" per BR-M12-10/11 (answered Aktif/Soalan, DV-M12-08; inactive rows faded with "-", Engagement shown when the school has sessions). | 6.5.1 | 22.1, 22.3, 14.4 |
| FR-M12-53 | S5 SHALL show "Ramalan Prestasi Pelajar Aktif" per BR-M12-21: all active students by accuracy descending (tie order PROPOSED, not asserted), no pager, links to the monitoring pages with the one user id (DV-M12-25), grade pills and footnote. | 6.6.1 | 22.2, 22.3, 30.5 |
| FR-M12-54 | The ALESA card SHALL render its heading icon via the resolver (`fa-crystal-ball` → Lucide `Sparkles`, DV-M12-06) and the subtitle. | 6.7.1 | 23.1 |
| FR-M12-55 | The ALESA tiles SHALL be computed from the listed rows of the current scope: "Dijangka Lulus" (A+…D), "Dijangka Gagal" (E, G), "Perlu Intervensi" (D, E) (BR-M12-22). | 6.7.2 | 23.1, 23.4 |
| FR-M12-56 | The ALESA table SHALL list the stored prediction list of the current scope (platform, or the filtered school; ≤ 50 rows) by grade (best first), then user id ascending, with the pills and the stored Cadangan band of BR-M12-22. | 6.7.3 | 23.1, 23.2, 23.4 |
| FR-M12-57 | The ALESA footer SHALL show "**{lulus} pelajar dijangka lulus**, {intervensi} pelajar perlu intervensi segera." from the listed rows + the weights sentence. | 6.7.4 | 23.3, 23.4 |
| FR-M12-58 | S5 SHALL show "ROI Platform (Anggaran)" per BR-M12-23 and the static amber box. | 6.8.1 | 24.1, 24.3 |
| FR-M12-59 | S5 SHALL show "Pemerhatian & Insight" per BR-M12-24 (DV-M12-13) and the disclaimer. | 6.9.1 | 24.2, 24.3 |
| FR-M12-60 | S6 SHALL show the header row of FN-7.1.1 and no tab strip. | 7.1.1 | 25.1 |
| FR-M12-61 | "Muat Turun Laporan" SHALL open `/admin/kirkpatrick/export-pdf` in a new tab; the route SHALL return a PDF built from #6 (PROPOSED content; provisional). | 7.1.2 | 27.1 |
| FR-M12-62 | The S6 T1 card SHALL show NPS Purata (mean over all responses), Kepuasan and Responden (BR-M12-32), green. | 7.2.1 | 25.2 |
| FR-M12-63 | The S6 T2 card SHALL show Ketepatan, Soalan Dijawab and Skor Purata (platform), green. | 7.2.2 | 25.2 |
| FR-M12-64 | The S6 T3 card SHALL show "{active}/{T4T5} ({p}%)", "Sesi Latihan" (with separator) and "Taburan Konsistensi:" with the English labels and BR-M12-06 counts (DV-M12-08), yellow. | 7.2.3 | 25.2 |
| FR-M12-65 | The S6 T4 card SHALL show GPS (BR-M12-16), "Korelasi (r)" and "Kekuatan" from DC-M12-03 / BR-M12-25, yellow. | 7.2.4 | 25.2 |
| FR-M12-66 | The S6 cards SHALL be 1 column below `md` and 4 from `md`, with "→" between them only from `md`. | 7.2.5 | 25.3 |
| FR-M12-67 | The correlation table SHALL show the 3 constant rows of DC-M12-03 with the bar colour rule (DV-M12-02). | 7.3.1 | 26.1 |
| FR-M12-68 | The "Kesimpulan ALESA:" box SHALL render the sentence of FN-7.3.2 from DC-M12-03 (difference = 100+ − 1-20, 1 decimal, signed). | 7.3.2 | 26.2 |
| FR-M12-69 | S6 SHALL show the static gradient conclusion of FN-7.4.1. | 7.4.1 | 26.2 |
| FR-M12-70 | S7 SHALL show the 4 KPI cards over the intervention store (BR-M12-26). | 8.1.1 | 28.1, 28.2, 28.3 |
| FR-M12-71 | The "Rekod Intervensi Baru" header button SHALL toggle the form panel (closed on load; chevron rotates 180° when open), ≥ 36 px tall (DV-M12-01, DV-M12-07). | 8.2.1 | 29.1 |
| FR-M12-72 | The form SHALL have the fields, types, options, defaults, placeholders and layout of FN-8.2.2. | 8.2.2 | 29.2, 29.6 |
| FR-M12-73 | "Simpan Intervensi" SHALL submit; the 5 `required` fields SHALL be enforced natively (browser message), with no custom alert. | 8.2.3 | 29.3 |
| FR-M12-74 | On submit the prototype SHALL POST #9; on success reload S7 (panel closed, KPIs and list updated, no message); on `VALIDATION_ERROR` keep the panel open with the values and show the field error under "Pelajar (ID)" (PROPOSED COPY, BR-M12-27). | 8.2.4 | 29.4, 29.5 |
| FR-M12-75 | With no records, "Senarai Intervensi" SHALL show `fa-clipboard-check` and "Tiada intervensi direkodkan lagi." only (DV-M12-01). | 8.3.1 | 28.1 |
| FR-M12-76 | With records, the list SHALL render the PROPOSED table of FN-8.3.2, newest first (provisional). | 8.3.2 | 28.2, 28.3 |
| FR-M12-77 | S8 SHALL show the header of FN-9.1.1 ("{nama}", "{sekolah} · Tingkatan {n}", "← Kembali ke Tahap 3" → `/admin/kirkpatrick/behavior`), stacking below `sm`. | 9.1.1 | 30.1, 31.4 |
| FR-M12-78 | S8 SHALL be reachable by URL on both prefixes and from the M11 school page rows of students without answers; ids that are not users (incl. the live second ids 5571, 5551) give the 403 page of FR-M12-17 (DV-M12-25). | 9.1.2 | 30.4, 30.5, 04.2 |
| FR-M12-79 | S8 SHALL show the ALESA card with the paragraph composed per BR-M12-29. | 9.2.1 | 30.2, 30.3 |
| FR-M12-80 | S8 SHALL show the 4 tiles of FN-9.2.2 (BR-M12-28), 2 × 2 below `sm`. | 9.2.2 | 30.2, 30.3 |
| FR-M12-81 | S8 SHALL show "Terkuat: … · Perlu perhatian: …" from the highest and lowest subject accuracy (ties: more answers first, then subject id). | 9.2.3 | 30.2, 30.3 |
| FR-M12-82 | S8 SHALL show "Tahap 2 — Head Count" per BR-M12-30. | 9.3.1 | 31.1, 31.2 |
| FR-M12-83 | S8 SHALL show "Tahap 2 — Prestasi Platform" rows "{x}% ({n})" by accuracy descending with the bar colour of BR-M12-28 (`bg-green-500` / `bg-yellow-500` / `bg-red-400`). | 9.4.1 | 31.1, 31.2 |
| FR-M12-84 | S8 for a student without answers SHALL render the zero state of FN-9.5.1 (provisional). | 9.5.1 | 31.3 |
| FR-M12-85 | S9 SHALL show the heading and subtitle of FN-10.1.1 and no T1 card. | 10.1.1 | 32.1 |
| FR-M12-86 | S9 SHALL show the Head Count card: the empty text when the viewer has no headcount TOV in the current year, else the PROPOSED S8-style rows (provisional). | 10.1.2 | 32.1 |
| FR-M12-87 | S9 SHALL show 30 squares for today − 29 … today with titles "dd/mm: {n} soalan" and the colour of BR-M12-31, the legend, wrapping. | 10.1.3 | 32.1, 32.2, 32.3 |
| FR-M12-88 | S9 SHALL show the "Tahap 4 — Kesimpulan" text of FN-10.1.4. | 10.1.4 | 32.1 |
| FR-M12-89 | S10 SHALL show the thank-you card when the viewer has a response for the current month (BR-M12-32). | 11.1.1 | 33.1, 33.4 |
| FR-M12-90 | S10 SHALL show the PROPOSED form of FN-11.1.2 otherwise; both scales required (provisional). | 11.1.2 | 33.2 |
| FR-M12-91 | Submitting S10 SHALL POST #13, store one response and show the thank-you card; T1 figures include it (provisional). | 11.1.3 | 33.3, 10.3 |
| FR-M12-92 | With a `school_id` that has no SPM history row (BR-M12-16), the S1 T4 card SHALL show "Belum Ada Data" (`text-lg` slate-400) and "Import keputusan peperiksaan" (`text-xs` slate-400) in place of the GPS and caption, and the flow pill SHALL read "GPS -". | 2.2.5 | 06.4 |
| FR-M12-93 | With a `school_id` that has no SPM history row, S5 SHALL show "GPS Headcount" "-" / "41 rekod" (DV-M12-28), "Kadar Lulus" "0%" "0/0 calon", "Pelajar Gred A" "0" "0% daripada 0", no "Taburan Gred" card, ROI "GPS Headcount" "-", and no "GPS keseluruhan" insight sentence (BR-M12-16/17/18/23/24). | 6.1.2 | 19.3 |

### 3.1 Traceability (US → FR → E2E)

| Story | ACs | FRs | E2E |
|---|---|---|---|
| US-M12-01 | 01.1, 01.2, 01.3, 01.4, 01.5, 01.6, 01.7 | 01, 02, 05, 06, 07, 08, 09 | 01, 02, 03, 04, 05, 06, 07 |
| US-M12-02 | 02.1, 02.2 | 04 | 08 |
| US-M12-03 | 03.1, 03.2, 03.3, 03.4, 03.5, 03.6 | 11, 14, 15, 16, 17 | 09, 10, 11, 12, 13, 61* |
| US-M12-04 | 04.1, 04.2, 04.3 | 03, 12, 13, 78 | 14*, 15 |
| US-M12-05 | 05.1, 05.2, 05.3, 05.4, 05.5 | 18, 19, 20, 21, 22, 29, 30 | 16, 17, 18, 19 |
| US-M12-06 | 06.1, 06.2, 06.3, 06.4 | 20, 21, 22, 23, 92 | 20, 65 |
| US-M12-07 | 07.1, 07.2, 07.3 | 24, 25 | 21 |
| US-M12-08 | 08.1, 08.2, 08.3, 08.4, 08.5, 08.6 | 26, 27, 28 | 22, 23 |
| US-M12-09 | 09.1, 09.2, 09.3, 09.4 | 29, 30, 31 | 24 |
| US-M12-10 | 10.1, 10.2, 10.3 | 23, 32, 33, 91 | 25, 26* |
| US-M12-11 | 11.1, 11.2, 11.3, 11.4 | 34, 35, 36 | 27, 28 |
| US-M12-12 | 12.1, 12.2, 12.3 | 37, 38 | 28, 29 |
| US-M12-13 | 13.1, 13.2, 13.3 | 39 | 30 |
| US-M12-14 | 14.1, 14.2, 14.3, 14.4 | 40, 41, 42, 44, 52 | 31, 64 |
| US-M12-15 | 15.1, 15.2, 15.3 | 43 | 32, 33* |
| US-M12-16 | 16.1, 16.2 | 44 | 34 |
| US-M12-17 | 17.1, 17.2 | 45 | 35 |
| US-M12-18 | 18.1, 18.2, 18.3, 18.4 | 46, 47 | 36, 62, 64 |
| US-M12-19 | 19.1, 19.2, 19.3 | 48, 93 | 37, 65 |
| US-M12-20 | 20.1, 20.2 | 49 | 38 |
| US-M12-21 | 21.1, 21.2, 21.3, 21.4 | 50, 51 | 39, 40 |
| US-M12-22 | 22.1, 22.2, 22.3 | 52, 53 | 41 |
| US-M12-23 | 23.1, 23.2, 23.3, 23.4 | 54, 55, 56, 57 | 42 |
| US-M12-24 | 24.1, 24.2, 24.3 | 58, 59 | 43 |
| US-M12-25 | 25.1, 25.2, 25.3 | 60, 62, 63, 64, 65, 66 | 44 |
| US-M12-26 | 26.1, 26.2 | 67, 68, 69 | 45 |
| US-M12-27 | 27.1 | 61 | 46* |
| US-M12-28 | 28.1, 28.2, 28.3 | 70, 75, 76 | 47, 50* |
| US-M12-29 | 29.1, 29.2, 29.3, 29.4, 29.5, 29.6 | 71, 72, 73, 74 | 48, 49, 50*, 51* |
| US-M12-30 | 30.1, 30.2, 30.3, 30.4, 30.5 | 53, 77, 78, 79, 80, 81 | 52, 53, 54, 63 |
| US-M12-31 | 31.1, 31.2, 31.3, 31.4 | 77, 82, 83, 84 | 52, 53, 55* |
| US-M12-32 | 32.1, 32.2, 32.3 | 85, 86, 87, 88 | 56, 57* |
| US-M12-33 | 33.1, 33.2, 33.3, 33.4 | 89, 90, 91 | 58, 59* |
| US-M12-34 | 34.1, 34.2 | 10 | 60 |

`*` = provisional scenario. Generated by `m12-writer/trace.js` (session scratchpad); 0 errors.

---

## 4. Business rules

| ID | Rule | Source |
|---|---|---|
| BR-M12-01 | **Scope.** Population "T4/T5" = users with role `student`, grade 10 or 11, a `schoolId`, and the school **not** in the reserved fixture range 900001–900099 (M11 BR-M11-34 adopted, so the canonical/fixture students of SMK DEMO never enter platform rollups). `school_id` narrows to that school; `state` narrows to schools of that state (S1 only). T1 figures ignore both (BR-M12-32). The T4 GPS/history ignores `state` (BR-M12-16). Teachers "Guru" = role `teacher` with a non-fixture school in scope. An unknown `school_id` → empty scope (zero state; provisional). | OBSERVED / INFERRED |
| BR-M12-02 | **Active student** = a T4/T5 student in scope with ≥ 1 answered question in the segment (DV-M12-08) — on every KPI, table column, band and alert. Shown as "Pelajar aktif", "Pernah Aktif", "Pelajar Aktif", "Aktif". Live's second definition (≥ 1 served question, Q-M12-TBL-AKTIF) is modelled but not displayed. | DV-M12-08 |
| BR-M12-03 | **Answers and accuracy.** Answers = Σ `answeredCount` of the completed sessions of the practice segment (XR-M12-02) in scope; correct = Σ `correctCount`; accuracy = correct ÷ answers × 100, rounded half-up to 1 decimal, printed without a trailing ".0" (bars of S3 and rows of S8 always 1 decimal); 0 answers → "0%". | OBSERVED (values) / INFERRED (source) |
| BR-M12-04 | **Skor Purata** = mean of `scorePct` over completed sessions in scope with `answeredCount` ≥ 1, 1 decimal; none → 0% (DV-M12-15). | OBSERVED + DV-M12-15 |
| BR-M12-05 | **Sessions.** "Sesi Selesai" = completed / all sessions of the segment in scope; "Kadar Penyelesaian" = that ratio × 100 (1 decimal, "100%"); "sesi" = all sessions (includes sessions without answers). | OBSERVED |
| BR-M12-06 | **Engagement bands** per T4/T5 student by answered questions in scope: ≥ 50 Champion; 20–49 Konsisten; 5–19 Berkembang; 1–4 Minimum; 0 Tidak Terlibat (INFERRED boundaries, corrected in v1.6: the observed 946 rows give 513 / 259 / 169 / 5 only with ≥ 50 and 20–49, and 16 students have exactly 50 answers; captions as live, DV-M12-10). "%" = count ÷ T4/T5 × 100, 1 decimal (0 → "0%"). The five counts sum to T4/T5 (the 5 served-but-unanswered students are "Tidak Terlibat", DV-M12-08). Colours/icons of URS FN-2.6.1. | OBSERVED (counts) / INFERRED (boundaries) |
| BR-M12-07 | **Guru Aktif** = teachers in scope with `lastLoginAt` ≠ null / teachers in scope; % 1 decimal ("53.1%", "100%"). | OBSERVED |
| BR-M12-08 | **Before/after.** SEBELUM = the first calendar month (Asia/Kuala_Lumpur) with ≥ 1 answer in scope, whole month; SELEPAS = the current month from day 1 to today (mock clock). Per panel: active students (≥ 1 answer in the month), accuracy, answers, Champion = students with ≥ 50 answers in the month (INFERRED; same boundary as BR-M12-06, v1.6). Subtitle "{Bulan} {yyyy} vs {Bulan} {yyyy}" (Januari … Disember). No month with answers → "Tiada Data vs Tiada Data", ranges "-", panel values 0 / "0%", sentence "Data tidak mencukupi untuk perbandingan.". Deltas = after − before (accuracy in points, 1 decimal, with "%"; "+" when ≥ 0). Sentences, in order, each only when its condition holds: accuracy Δ > 0 "Peningkatan {Δ}% dalam ketepatan jawapan." / Δ < 0 "Penurunan {\|Δ\|}% dalam ketepatan jawapan."; active Δ > 0 "{Δ} pelajar baru mula aktif." / Δ < 0 "{\|Δ\|} pelajar kurang aktif berbanding sebelumnya."; answers Δ > 0 "Jumlah jawapan meningkat {(after − before) ÷ before × 100, 1 decimal, trailing ".0" dropped}%." (before > 0; "465500%", "467833.3%"); champions Δ > 0 "{Δ} pelajar naik ke tahap Champion.". | OBSERVED (3 texts) / INFERRED (conditions) |
| BR-M12-09 | **Subject status**: accuracy ≥ 80 "Mastered"; 50–< 80 "Developing"; < 50 "Beginning" (INFERRED bounds, fit 80.6 / 79.1 / 51.5 / 45.0). | INFERRED |
| BR-M12-10 | **School tables** (S3, S5): one row per school with ≥ 1 T4/T5 student in scope (33 platform). S3: Pelajar = T4/T5, Soalan (answered), Ketepatan (green-600 ≥ 70, amber-600 ≥ 50, red-600 < 50), Skor Purata (BR-M12-04), Subjek = stored per-school count (DATA-M12-03; definition not observable, DV-M12-27); order Ketepatan desc, ties school id asc (observed). S5: Pelajar, Aktif (BR-M12-02), Ketepatan (green-600 ≥ 60, else amber-600; "-" slate-300 when Aktif 0), Soalan (answered; "-" when Aktif 0), Engagement = stored score (DATA-M12-03), shown as "-" when the school has Aktif 0 **and** no session (940, with 1 session, shows "2" — fits all 9 faded rows), Tahap (BR-M12-12); order Engagement desc, ties school id; Aktif 0 rows `opacity-50`. | OBSERVED + DV-M12-08/15 |
| BR-M12-11 | **S4 school table**: Aktif (BR-M12-02), Soalan (answered), Sesi (all sessions), Purata/Aktif = Soalan ÷ Aktif (1 decimal, trailing ".0" dropped; 0 when Aktif 0), Skor = DATA-M12-03 school score (0–100), Tahap by BR-M12-12; order Skor desc, ties school id; code line = school code or "-". With a school filter the KPI cards equal the row (DV-M12-08). | OBSERVED + DV-M12-08 |
| BR-M12-12 | **Tahap by score**: ≥ 80 Champion #15803d; 60–< 80 Konsisten #2563eb; 40–< 60 Berkembang #ca8a04; 20–< 40 Minimum #ea580c; < 20 Tidak Terlibat #dc2626 (INFERRED). | INFERRED |
| BR-M12-13 | **Heat map**: counts of answers in scope by weekday (Isnin … Ahad) × hour 06–23 (the segment's hour grid, XR-M12-02; it covers a subset of the answers, OQ-M12-11); α = max(0.15, n ÷ max n); n = 0 → `#f1f5f9`, no number. Hours 00–05 are not displayed. Seeded grids §6.9 (platform Σ 218,070, 8080 Σ 12,008). **v1.6 (F-26c):** the grid is a stored table covering about 71 % of answers (OQ-M12-11); the 9167 cell positions and the residual split are INFERRED. This BR (Σ 218,070, a 26-Sep reference value) and Q-M12-HEAT (≈ 218,000 on 25 Sep) disagree; **the build uses ≈ 218,000** (DV-M12-F26c-05). | OBSERVED / INFERRED (9167 cells, residual split) |
| BR-M12-14 | **Alerts** — three lists, concatenated in this order, each in school-id order over the schools with ≥ 1 T4/T5 student in scope; a school may appear in several: (1) never-logged-in students (`lastLoginAt` = null) > 50% of the school's T4/T5 → red "{sekolah}: {n} pelajar tidak pernah login langsung."; (2) teachers with a login ≥ 1 and answers = 0 → red "{sekolah}: {n} guru telah login tetapi tiada pelajar yang menjawab soalan."; (3) Aktif ÷ T4/T5 **> 50%** → green "{sekolah}: {p}% pelajar aktif menjawab soalan. Tahniah!" (1 decimal, trailing ".0" dropped). Observed platform: 22 + 1 (10220) + 12 = 35 items, 9 schools in lists 1 and 3, 8298 (exactly 50%) not green; Aktif per BR-M12-02 (9167 "62.5%", DV-M12-08; live "75%"). | OBSERVED + DV-M12-08 |
| BR-M12-15 | **Mood**: the mood card shows while mood check-ins in scope = 0; no mood store exists in M12; owner M26 (decided, provisional; OQ-M12-06), so the prototype always shows it. | OBSERVED |
| BR-M12-16 | **GPS**: platform → the latest year of M08 SchoolSpmHistory (2025: 4.30, 180 candidates); `school_id` → that school's latest history row (8080: 2026, 4.00); 2 decimals everywhere (DV-M12-09); caption "{n} rekod · {year}" with n = DC-M12-01 (41). **A school without a history row** (observed on 9167; which schools have one is not verified beyond 8080 — M17 reports SPM data for 8880, TU-M12-09): S1 T4 card "Belum Ada Data" / "Import keputusan peperiksaan", flow pill "GPS -"; S5 GPS "-" with the caption "{n} rekod" (no separator, DV-M12-28; live "41 rekod ·"). "Rekod Headcount" = **DC-M12-02 (4378)**, active since v1.4: M08 does not host a count of OTR headcount records (M08 v1.8, XL3-34); a live count on live (4379 on 2026-09-26), a constant in the prototype; unchanged by `school_id`. | OBSERVED + DV-M12-09/28 |
| BR-M12-17 | **Grade distribution** of the same history row: 10 grades A+ … G, counts, % = n ÷ candidates (1 decimal, trailing ".0" dropped: "10%"), bar width n ÷ max n × 100%, colours of FN-6.2.1, row `title` "{g}: {n} pelajar ({p}%)". No history row → the card is not rendered (OBSERVED, 9167). | OBSERVED |
| BR-M12-18 | **Kadar Lulus** = (A+ … D) ÷ candidates (DV-M12-16), "{n}/{candidates} calon"; **Pelajar Gred A** = A+ + A + A-, "{p}% daripada {candidates}"; no history row → "0%" "0/0 calon" and "0" "0% daripada 0" (OBSERVED); "Pelajar Aktif" "{p}% daripada {T4T5 with separator}". | OBSERVED + DV-M12-16 |
| BR-M12-19 | **Subject GPS rows** = the platform subject rows of the history's latest subject year (2026, 30 candidates each), by GPS ascending, **in every scope** (with `school_id` too; heading "(2026)", DV-M12-26); Gred = grade of point ⌈GPS⌉ − 1 (points A+ 0 … G 9, M08 BR-M08-01); Trend = `fa-arrow-up` green-500 + previous-year GPS when GPS < previous (the only observed case; any other case PROPOSED `fa-arrow-down` red-500). | OBSERVED + DV-M12-26 |
| BR-M12-20 | **Trend GPS table**: the platform history, years 2022 … 2026, in every scope (DV-M12-26); row "Keseluruhan" then subjects in history order; value colour green-600 ≤ 4.00, amber-600 > 4.00; missing value "-" slate-300 (DV-M12-14); Trend cell `fa-arrow-up` green (as live, all rows). | OBSERVED + DV-M12-14/26 |
| BR-M12-21 | **Anggaran Gred** from a student's accuracy: A+ ≥ 90, A ≥ 80, A- ≥ 70, B+ ≥ 65, B ≥ 60, C+ ≥ 55, C ≥ 50, D ≥ 40, E ≥ 30, G < 30; colour A+/A/A- #15803d, B+/B #2563eb, C+/C #ca8a04, D/E #ea580c, G #dc2626; rows = active students in scope, accuracy desc. The order within equal accuracies is not observable on live (577 tie pairs fit neither answers nor id order): rebuild user id ascending (PROPOSED), never asserted. Insight grade uses the same map. | OBSERVED / PROPOSED (ties) |
| BR-M12-22 | **ALESA** rows = the stored prediction list of the scope (DATA-M12-04): platform (50 observed rows from 8090 28, 8277 11, 8080 4, 8107 4, 8228 2, 8880 1) or the filtered school (8080: 50 observed rows of its 53 active students; any other school: generated from its active students, ≤ 50, `observed:false`); the selection of the rows is not observable. Order: grade (best first), then user id ascending (observed). Ketepatan = the student's Q-M12-PRED accuracy. Tiles and footer computed from the listed rows: Lulus = A+ … D, Gagal = E + G, Intervensi = D + E (platform 48 / 2 / 4; 8080 47 / 3 / 3). Pill colours per grade (FN-6.7.3); Keyakinan and Cadangan band stored per row (the band follows the grade except the observed 8080 row of Student B: grade C, D/E text). | OBSERVED |
| BR-M12-23 | **ROI**: Pelajar Aktif (BR-M12-02), Purata Soalan/Pelajar = answers ÷ active (1 decimal, trailing ".0" dropped: 9167 "109"), Ketepatan Aktif (BR-M12-03), GPS (BR-M12-16; "-" without a history row). | OBSERVED |
| BR-M12-24 | **Insights**: "Hanya {active} daripada {T4T5 without separator} pelajar T4/T5 ({active ÷ T4T5 %, 1 decimal}%) menggunakan platform. …" (DV-M12-13); grade by BR-M12-21 of the scope accuracy; "GPS keseluruhan dari headcount (tahun {year}): {gps}. Trend menunjukkan peningkatan dari tahun ke tahun." (BR-M12-16) — **omitted** when the scope has no history row (OBSERVED, 9167); fixed sentences and the disclaimer as FN-6.9.1. | OBSERVED + DV-M12-13 |
| BR-M12-25 | **Chain**: T1 NPS Purata = mean NPS over all responses (1 decimal); T3 "{active}/{T4T5} ({p}%)"; T4 r and bands from DC-M12-03; Kekuatan from \|r\|: < 0.3 "Lemah", 0.3–< 0.7 "Sederhana", ≥ 0.7 "Kuat" (INFERRED); card colours fixed as observed (T1, T2 green; T3, T4 yellow); conclusion static. | OBSERVED / INFERRED |
| BR-M12-26 | **Intervention status**: `afterAccuracy` null → "Menunggu Semakan"; after > before → "Meningkat"; after < before → "Menurun"; equal, or before null with after set → counted only in "Jumlah Intervensi" (INFERRED/PROPOSED). KPIs count the whole store (no scope). List newest first (`createdAt` desc). | INFERRED |
| BR-M12-27 | **Intervention save**: `studentId` must be a user with role `student` (PROPOSED check; error PROPOSED COPY "Pelajar tidak dijumpai."); accuracies 0–100 with 1 decimal when present (browser `step 0.1`); `createdBy` = current user; no edit/delete. | SOURCE-DERIVED / PROPOSED |
| BR-M12-28 | **S8 figures**: Soalan and Ketepatan from the student's segment sessions (all time); "hari aktif" = distinct days with ≥ 1 completed session; Streak = consecutive active days ending at the last active day, "{n}d"; Konsistensi = DATA-M12-05 (stored; 0 when none); platform rows per subject; bar colour `bg-green-500` ≥ 70, `bg-yellow-500` 50–< 70, `bg-red-400` < 50 (observed colours on all 9 captured bars; bounds INFERRED). | OBSERVED / INFERRED (bounds) |
| BR-M12-29 | **S8 paragraph** = "Penggunaan Prestasi Plus oleh {nama} masih pada tahap minimum dengan hanya {hari aktif} hari aktif. Disarankan untuk meningkatkan kekerapan latihan bagi melihat peningkatan prestasi." + (accuracy ≥ 70, PROPOSED threshold) " Ketepatan jawapan pada {x}% menunjukkan pemahaman yang baik." + (≥ 1 subject) " Subjek terkuat: {subjek} ({x}%)." (1 decimal). | OBSERVED / PROPOSED |
| BR-M12-30 | **S8 Head Count** = the student's M08 HeadcountEntry rows of the current academic year, one row per subject (A→Z), "TOV:{tov, 2 decimals}" or "-" when TOV is null; heading "{year} — Head Count". No rows → the card shows only its headings (INFERRED). | OBSERVED |
| BR-M12-31 | **S9 squares**: n = the viewer's answers per day (M05 answer log, all modes); 0 gray-100; 1–9 green-200; 10–29 green-400; ≥ 30 green-600 (PROPOSED thresholds, OQ-M12-07). | OBSERVED (0) / PROPOSED |
| BR-M12-32 | **Feedback**: one response per user per calendar month (Asia/Kuala_Lumpur); NPS integer 0–10, satisfaction integer 1–5; "NPS {Pelajar\|Guru\|Admin}" = mean NPS of responses by role `student` / `teacher` / `admin`; "Kepuasan Purata" = mean satisfaction of all responses; "respon"/"Responden" = number of responses; all-time (INFERRED); 1 decimal. | OBSERVED (values) / INFERRED |
| BR-M12-33 | **Formats**: thousands separator exactly where live shows it (URS conventions); percent 1 decimal without trailing ".0" except S3 bars / S8 rows; GPS 2 decimals; month names in BM; dates "dd Mmm yyyy" with English 3-letter months as live ("01 Jan 2026", "01 Sep 2026"). | OBSERVED |

---

## 5. Validation rules

| Form | Field | Rule | Message (trigger) |
|---|---|---|---|
| S1 filter | `school_id`, `state` | optional; unknown values ignored → zero state | none (live has none) |
| S4 filter | `school_id` | optional | none |
| S7 intervention | `student_id` | required, number | browser native (on submit); server: must be a student → "Pelajar tidak dijumpai." (PROPOSED COPY, on submit, under the field) |
| S7 | `alert_type` | required, one of `mood`, `inactive`, `declining` | native |
| S7 | `action_date` | required, date (default today) | native |
| S7 | `alert_description`, `action_taken` | required, text | native |
| S7 | `before_accuracy`, `after_accuracy` | optional, number, step 0.1 (0–100 PROPOSED) | native step/range message |
| S7 | `before_mood`, `after_mood` | optional, one of '' / `happy` / `okay` / `sad` / `stressed` | — |
| S10 (PROPOSED) | `nps`, `satisfaction` | required, 0–10 / 1–5 | native (radio `required`) |
| S10 | monthly rule | a second response in the same month → `CONFLICT`; the page shows the thank-you state | — |

---

## 6. Data entities & fields

*(solution-architect)* JSON fields are camelCase; ids are integers where live exposes them (users, schools, subjects, interventions). "Now" = the M05 mock clock (`2026-09-25T15:40:00+08:00`). In-memory stores seeded from fixtures, reset per E2E test (`mock.reset()`).

### 6.1 Referenced entities (owners; not redefined — D12)

| Entity | Owner | Fields M12 reads |
|---|---|---|
| User | M01 DATA-M01-01 / M02 (users dataset, 5,159, ids 1–6,000; runtime ≥ 9,000,001) | `id`, `name`, `role`, `grade`, `schoolId`, `lastLoginAt` (XR-M11-01) |
| School | M02 (register 10,220; fixtures 900001–900099; runtime ≥ 10,301) | `id`, `name`, `code`, `state` |
| Subject | M03 | `id`, `name` |
| KirkpatrickSessionAggregate | M05 **DATA-M05-12** (§6.14.4; XL3-04) — separate from PracticeSession / Q-SESS-ALL and never joined to QuizAnswer | `userId`, `schoolId`, `subjectId`, `completedAt`, `questionCount`, `answeredCount`, `correctCount`, `scorePct` |
| QuizAnswer | M05 DATA-M05-02 | `userId`, `answeredAt` (S9 squares only) |
| HeadcountEntry / HeadcountConfig | M08 DATA-M08-03 / 02 | `studentId`, `tov`, config `subjectId`, `academicYear` |
| SchoolSpmHistory | M08 DATA-M08-09 (+ XR-M12-05) | per scope: `year`, `gps`, `candidates`, `gradeCounts`, subject rows `{subjectName, gps, candidates}` |

### 6.2 DATA-M12-01 — FeedbackResponse (owned by M12)

| Field | Type | Req | Notes |
|---|---|---|---|
| id | int | yes | seeded 1–336; runtime from 1,001 |
| userId | int → User | yes | |
| role | enum = User.role at response time | yes | T1 uses `student`, `teacher`, `admin` |
| month | string `YYYY-MM` | yes | unique with `userId` (BR-M12-32) |
| nps | int 0–10 | yes | |
| satisfaction | int 1–5 | yes | |
| createdAt | datetime | yes | |

### 6.3 DATA-M12-02 — KirkpatrickIntervention (owned by M12; repository `kirkpatrickInterventions`; distinct from M18 DATA-M18-01 AmaranIntervention — XL3-33)

| Field | Type | Req | Notes |
|---|---|---|---|
| id | int | yes | runtime from 1 (live list empty) |
| studentId | int → User | yes | form `student_id` |
| alertType | enum `mood\|inactive\|declining` | yes | labels "Mood / Kesejahteraan", "Tidak Aktif", "Prestasi Menurun" |
| actionDate | date | yes | |
| alertDescription, actionTaken | string | yes | |
| beforeAccuracy, afterAccuracy | number(1 dp) \| null | no | |
| beforeMood, afterMood | enum `happy\|okay\|sad\|stressed` \| null | no | labels "Gembira", "Okay", "Sedih", "Tertekan" |
| createdBy | int → User | yes | |
| createdAt, updatedAt | datetime | yes | |

Status is derived (BR-M12-26), never stored.

### 6.4 DATA-M12-03 — SchoolEngagementScore, DATA-M12-04 — AlesaPrediction, DATA-M12-05 — StudentConsistency (owned by M12; server-computed on live, stored here)

- `SchoolEngagementScore {schoolId, score: number (0–100, 1 dp), subjectCount: int, observed: boolean}` — one row per table school (33). Live formula unobservable (Q-M12-3). Seed = the top-up S4 "Skor" and S3 "Subjek" values (`_topup-2026-09-26.json` › `TU-M12-02_schoolTables`); `observed:true` for 8080 (62.4, 3) and the 10 zero-answer rows (940: 2, 1; others 0, 0), `observed:false` (26-Sep reference values) for the other 22 rows. Observed structure asserted: tahap split 8 / 7 / 2 / 4 / 3 + 9 inactive, first row 9681.
- `AlesaPrediction {scope: 'platform'|schoolId, userId, grade, confidence: 'rendah'|'sederhana'|'tinggi', cadanganBand: 'A'|'B'|'C'|'D/E', observed}` — **per-scope stored lists, ≤ 50 rows each** (`schoolOverrides` withdrawn, AUD-M12-03). `platform`: the 50 observed rows (grades A+ 6, A 16, A- 9, B+ 9, B 3, C+ 1, C 2, D 2, E 2; Keyakinan 38 / 10 / 2; schools and bands as captured, top-up › `TU-M12-08_alesa.default`, students = the matching prediction rows); `8080`: the 50 observed rows (A+ 3, A 9, A- 11, B+ 13, B 7, C+ 3, C 1, E 3; top-up › `school8080`; excludes 8080 prediction rows 19, 38, 46 — Student A is row 19; Student B is ALESA row 47, grade C, band D/E); any other school: generated deterministically from its active students (≤ 50, `observed:false`). Accuracy is not stored; it is read from Q-M12-PRED.
- `StudentConsistency {userId, konsistensi: number}` — anchors 4664 → 22.5, 4644 → 21.1; others generated deterministically in 0–100 (`observed:false`).
- ~~DATA-M12-07 KirkpatrickRouteAlias~~ — **withdrawn in v1.2** (R2-01): live answers 403 for 5571/5551, which the rebuild gives because they are not user ids.

### 6.5 Named queries (every displayed count; D11)

"Segment" = the Kirkpatrick practice segment hosted by M05 (XR-M12-02). "Scope" = BR-M12-01.

| Query | Definition | Owner store | Observed values (platform · 8080 · Kelantan) |
|---|---|---|---|
| Q-M12-T4T5 | T4/T5 students in scope | M02 users | 4,158 · 184 · 0 |
| Q-M12-GURU / Q-M12-GURU-LOGIN | teachers in scope / with `lastLoginAt` | M02 / M01 | 522 / 277 · 34 / 34 · 0 / 0 |
| Q-M12-SCH-OPTIONS | non-fixture schools with ≥ 1 user, A→Z | M02 | 57 (= M11 "Jumlah Sekolah", BR-M11-08) |
| Q-M12-SCH-TABLE | non-fixture schools with ≥ 1 T4/T5 student | M02 | 33 (= M11 student table) · 1 |
| Q-M12-NEVER-LOGIN(school) | T4/T5 of the school with `lastLoginAt` null | M01/M02 | per school = M11 snapshot "Belum login" + "answeredWithoutLogin" (e.g. 8102 759, 8107 674, 8087 257) |
| Q-M12-SESSIONS | sessions of the segment in scope (all completed) | M05 DATA-M05-12 | 20,991 (20,998 on 26 Sep) · 1,002 · 0 |
| Q-M12-ANSWERS / Q-M12-CORRECT | Σ answeredCount / Σ correctCount | M05 DATA-M05-12 | 306,133 / 253,478 (fit to "82.8%"; exact count unobserved) · 15,007 / 11,339 (8080; v1.6, was 11,345 — the 53 observed student rows allow at most 11,339, and "75.6%" displays either way; DV-M12-F26c-02) · 0 |
| Q-M12-ACTIVE | T4/T5 with ≥ 1 answered question (every displayed "aktif", DV-M12-08) | M05 DATA-M05-12 × M02 | 946 · 53 · 0; per school = the S5 prediction rows per school (e.g. 9167 5, 8082 225, 8106 142, 8765 4, 8107 4) |
| Q-M12-TBL-AKTIF | T4/T5 with Σ `questionCount` > 0 (≥ 1 served question) — live KPI "951" and S4/S5 table "Aktif"; **not displayed** after DV-M12-08 | M05 DATA-M05-12 × M02 | 951 = 946 + 5 served-but-unanswered students (9167, 8082, 8106, 8765, 8107); school 940's student has a session with no served question → 0, which fits its row (Sesi 1, Aktif 0) |
| Q-M12-TBL-SOALAN | Σ `questionCount` (served questions) — live S4/S5 table "Soalan"; **not displayed** after DV-M12-08 | M05 DATA-M05-12 | 307,049 on 26 Sep (25-Sep value not captured); ≠ answered at 10 schools (e.g. 8880 71,432 vs 71,408; 9167 555 vs 545); 8080 15,007 = answered |
| Q-M12-SESSION-STUDENTS | T4/T5 with ≥ 1 session (not displayed) | M05 DATA-M05-12 × M02 | 952 (951 + school 940's student) · 53 |
| Q-M12-BANDS | BR-M12-06 counts | M05 DATA-M05-12 × M02 | 513 / 259 / 169 / 5 / 3,212 · 36 / 8 / 9 / 0 / 131 |
| Q-M12-SKOR | BR-M12-04 | M05 DATA-M05-12 | 80.3% · 73.3% |
| Q-M12-SUBJECTS | per subject answers/correct | M05 DATA-M05-12 | 26 rows, Σ 306,133, 15 Mastered / 11 Developing · 24 rows (11 / 10 / 3) |
| Q-M12-MONTH(m) | per calendar month: active, answers, correct, champions | M05 DATA-M05-12 | Jan 2026: 2 / 3 / 1 / 0; Sep 2026 (1–25): 58 / 13,968 / 87.0% / 28 · 8080 Apr 2026 71.6%, Sep 55.0%, Δ −11 / −451 / −2 |
| Q-M12-HEAT | answers by weekday × hour 06–23 (a subset of the answers) | M05 DATA-M05-12 | platform: cells "Selasa 14:00" 6,253 (max) and "Isnin 06:00" 944 observed on both days; the other 124 cells are 26-Sep reference values (`TU-M12-01_heatmap.default`, Σ 218,070 vs ≈ 218,000 on 25 Sep; `observed:false`; **the build uses ≈ 218,000**, see BR-M12-13 and DV-M12-F26c-05), generated under the baseline; 8080 grid adopted (max 736, Σ 12,008, 43 zeros); 9167 4 non-zero cells Σ 116 |
| Q-M12-PRED | active students with answers and accuracy (BR-M12-21) | M05 DATA-M05-12 | 946 rows: 512 A-band / 206 B / 104 C / 95 D-E / 29 G; first row at 8090; 8080: the 53 observed rows (Student A row 19: 219 / 73.1% / A-; Student B row 50: 70 / 38.6% / E) |
| Q-M12-T1 | feedback aggregates | M12 DATA-M12-01 | 336; 8.4 / 6.5 / 9.6; 4.6; 8.3 |
| Q-M12-HIST | latest history row in scope | M08 | 2025 · 4.30 · 180 · 10/18/24/32/32/26/21/11/5/1 · 8080: 2026 · 4 · 1 (B+) |
| Q-M12-INT | intervention KPIs | M12 DATA-M12-02 | 0 / 0 / 0 / 0 |
| ~~Q-M12-HC-RECORDS~~ | withdrawn (v1.4): not hosted by M08 (M08 v1.8, XL3-34) | — | "Rekod Headcount" = DC-M12-02 |

### 6.6 Dataset specs for the M12-owned stores (overview X-7, ADR-0013)

| Store | Kind, total and source | Count-relevant fields | Observed counts (evidence) | Ids | Anchors | D9 value |
|---|---|---|---|---|---|---|
| FeedbackResponse | Small seeded table, **336 rows** (S1 "336 respon", S6 "Responden 336") | `role`, `nps`, `satisfaction`, `month`, `userId` | NPS by role 8.4 / 6.5 / 9.6 (S2), satisfaction 4.6 (S1, S2, S6), NPS overall 8.3 (S6) | 1–336; runtime ≥ 1,001 | admin (id 1) responses 2026-07, 2026-08, **2026-09** (the observed thank-you state); admin 5801 (M02's second admin) 2026-08, 2026-09 | none |
| KirkpatrickIntervention | Small table, **0 rows** (S7 all KPIs 0, empty list) | `afterAccuracy`, `beforeAccuracy` | 0 / 0 / 0 / 0 | runtime from 1 | none | none |

**Designed split of the 336 responses** (the per-role counts are not shown anywhere on live; `observed:false`, only the displayed means are asserted): `student` 311 responses, NPS Σ 2,612 (8.399 → "8.4"); `teacher` 20, Σ 130 ("6.5"); `admin` 5, Σ 48 = 10, 10, 9, 10, 9 ("9.6"; ids 1 ×3, 5801 ×2); overall (2,612 + 130 + 48) ÷ 336 = 8.304 → "8.3"; satisfaction Σ 1,546 ÷ 336 = 4.601 → "4.6". Months 2026-02 … 2026-09, at most one per user per month; student and teacher respondents are generated users of the M02 dataset of those roles (the canonical accounts 2, 3, 4, 5, 11 have **no** response, so their S10 shows the form). Adding one student response of NPS 10 / satisfaction 5 gives 8.404 → "8.4" and "337 respon" (AC-M12-10.3).

### 6.7 DATA-M12-06 — Display constants (DC-M12-01, DC-M12-02, DC-M12-03) (ADR-0013 `DISPLAY_CONSTANT`)

| ID | Value | Where | Why no definition | DV |
|---|---|---|---|---|
| DC-M12-01 | `41` ("41 rekod · {year}") | S5 GPS card | unchanged between platform (2025) and 8080 (2026); no store count matches | DV-M12-22 |
| DC-M12-02 | `4378` | S1 T4 caption, S5 "Rekod Headcount" | **Active (v1.4).** M08 cannot hold 4,378 OTR records without changing its own observed headcount figures (6 configs · 48 pupils · 744 graded entries; XL3-34). Valid under D11/ADR-0013: neither place shows another headcount-record figure that could contradict it | DV-M12-22 |
| DC-M12-03 | correlation `{bands: [{label:'1-20 soalan', n:215, acc:59.7}, {label:'51-100 soalan', n:149, acc:68.7}, {label:'100+ soalan', n:348, acc:75.2}], r: 0.1298}` | S6 T4 card, table, "Kesimpulan ALESA" | 149 + 348 = 497 ≠ Champion 513; no per-student count reproduces both (DV-M12-23) | DV-M12-23 |

Each constant appears only on its own card/table; none sits next to a computed figure that contradicts it on the same card.

### 6.8 Read models (response shapes; computed, not stored)

- `Overview` (#1): `{scope:{schoolId|null, state|null}, t4:{gps:number, gpsYear, recordsLabel:int}, t3:{active, t4t5, sessions, accuracy}, t2:{accuracy, answers}, t1:{satisfaction, responses}, comparison:{before:Panel|null, after:Panel|null, delta:{active, accuracy, answers, champions}|null, sentences:[string]}, kpi:{t4t5, answers, teachersLoggedIn, teachers, accuracy}, bands:[{key, count, pct}]}`; `Panel = {month:'YYYY-MM', from, to, active, accuracy, answers, champions}`.
- `Reaction` (#2): `{npsStudent, npsTeacher, npsAdmin, satisfaction}` (numbers 1 dp).
- `Learning` (#3): `{kpi:{answers, accuracy, avgScore, sessionsCompleted, sessions, completionPct}, subjects:[{subjectId, name, answers, accuracy, status}], schools:[{schoolId, name, students, answers, accuracy, avgScore, subjects}]}`.
- `Behavior` (#4): `{kpi:{t4t5, active, sessions, answers, accuracy, teacherPct, teachersLoggedIn, teachers}, bands, schools:[{schoolId, name, code|null, students, active, answers, sessions, perActive, score, tahap}], heat:{max, cells:[[n×18]×7]}, alerts:[{list:1|2|3, schoolId, name, kind:'never'|'teacher'|'good', n|pct}] (list 1, then 2, then 3; each by schoolId), moodCount:0}`.
- `Results` (#5): `{kpi:{gps, gpsYear, recordsLabel, passPct, pass, candidates, gradeA, gradeAPct, accuracy, answers, active, activePct, t4t5, records}, distribution:{year, candidates, rows:[{grade, n, pct}]}, subjectGps:{year, rows:[{name, gps, grade, candidates, prev}]}, trend:{years, rows:[{name, values:(number|null)[]}]}, schools:[…], predictions:[{userId, name, schoolId, schoolName, answers, accuracy, grade}], alesa:{lulus, gagal, intervensi, rows:[{userId, name, schoolName, accuracy, grade, confidence}]}, roi:{active, perStudent, accuracy, gps}, insights:{active, t4t5, pct, accuracy, grade, year, gps}}`.
- `Chain` (#6): `{t1:{nps, satisfaction, responses}, t2:{accuracy, answers, avgScore}, t3:{active, t4t5, pct, sessions, bands}, t4:{gps, r, strength}, correlation:DC-M12-03}`.
- `InterventionList` (#8): `{kpi:{total, pending, up, down}, rows:[KirkpatrickIntervention & {status, studentName|null}]}`.
- `StudentKirkpatrick` (#10): `{student:{id, name, schoolName, grade}, activeDays, answers, accuracy, konsistensi, streak, strongest|null, weakest|null, headcount:{year, rows:[{subjectName, tov|null}]}, platform:[{subjectName, accuracy, answers}]}`.
- `MyKirkpatrick` (#11): `{headcount:{year, rows}|null, days:[{date:'dd/mm', answers}]×30}`.

### 6.9 Seed — admin mirror (observed) and designed data

- **Scope data (M02/M01):** the monitoring rows already requested by M11 (XR-M11-02/03) are the T4/T5 and teacher populations of M12 — no new users. The 22 red alert counts are the M11 per-school never-logged-in counts (§6.5). School 8080: 184 T4/T5, 34 teachers all logged in (M11 snapshot).
- **Pinned source.** The 2026-09-25 figures of the discovery doc and `docs/discovery/inventory/M12/_topup-2026-09-26.json` for the rows adopted in URS §9.2 (8080, zero-answer rows, Aktif per school, alerts, subjects, ALESA, heat grids, S8). Non-adopted top-up values are reference only (`observed:false`).
- **Practice segment (M05, XR-M12-02):** totals of §6.5 (25-Sep). **Platform subjects (26, adopted; Σ 306,133):** Pendidikan Muzik 100.0% M 20 · Reka Bentuk & Teknologi 99.3% M 461 · Pendidikan Jasmani & Kesihatan 98.7% M 3571 · Sains Komputer 97.5% M 513 · Tasawwur Islam 96.6% M 24917 · Bahasa Cina 95.7% M 46 · Pendidikan Al-Quran & As-Sunnah 95.3% M 190 · Pendidikan Moral 93.9% M 4370 · Bahasa Tamil 93.4% M 317 · Pendidikan Islam 92.9% M 53828 · Pendidikan Syariah Islamiah 92.8% M 1885 · Bahasa Arab 91.5% M 686 · Pendidikan Seni Visual 87.9% M 2944 · Bahasa Melayu 87.6% M 69893 · Prinsip Perakaunan 83.2% M 2939 · Ekonomi 79.1% D 2333 · Sejarah 76.3% D 57695 · Bahasa Inggeris 74.6% D 17985 · Biologi 72.4% D 6836 · Matematik 70.5% D 19026 · Matematik Tambahan 68.9% D 1645 · Sains 67.9% D 17138 · Perniagaan 67.7% D 5497 · Geografi 66.6% D 2119 · Kimia 65.5% D 3988 · Fizik 63.9% D 5291. **8080 subjects (24, adopted):** Bahasa Cina 100.0% M 10 · Reka Bentuk & Teknologi 100.0% M 160 · Sains Komputer 100.0% M 40 · Pendidikan Jasmani & Kesihatan 99.5% M 185 · Tasawwur Islam 94.4% M 738 · Pendidikan Moral 94.4% M 302 · Pendidikan Al-Quran & As-Sunnah 93.3% M 30 · Pendidikan Islam 89.4% M 1892 · Fizik 81.0% M 179 · Pendidikan Seni Visual 80.9% M 215 · Bahasa Melayu 80.6% M 1972 · Pendidikan Syariah Islamiah 75.0% D 40 · Kimia 73.5% D 155 · Ekonomi 72.5% D 265 · Bahasa Inggeris 72.1% D 840 · Sejarah 71.0% D 3138 · Geografi 68.8% D 1528 · Sains 67.9% D 2143 · Perniagaan 66.4% D 375 · Prinsip Perakaunan 63.3% D 60 · Matematik 51.5% D 680 · Bahasa Arab 45.0% B 20 · Matematik Tambahan 40.0% B 10 · Biologi 33.3% B 30. Per-school rows: 8080 and the zero rows as observed; the other 22 active schools generated under the 25-Sep totals from the 26-Sep reference with the platform +70 answers (all Sejarah) and +7 sessions removed deterministically; Aktif per school as observed (answered). 5 served-but-unanswered students (one each at 9167, 8082, 8106, 8765, 8107) and one question-less session at 940 (score 90%). **Students A and B are existing 8080 active students** (prediction rows 19 and 50, inside 8080's 53 active / 15,007 answers): A (4664) Sejarah 190 answers / 150 correct, Sains 23 / 9, Matematik 6 / 1 on 4 distinct days (streak 1); B (4644) Bahasa Melayu 5 / 3, Pendidikan Islam 20 / 11, Matematik 15 / 6, Sains 15 / 5, Bahasa Inggeris 10 / 2, Sejarah 5 / 0 on 3 days (streak 1). Both T5; M11 shows them with 0 monitoring answers (4664 "Login sahaja", 4644 "Belum login"; DV-M12-24). Names "Pelajar Demo 004664" / "Pelajar Demo 004644" (fictitious). Monthly: Jan 2026 2 / 3 / 1 / 0; Sep 1–25 58 / 13,968 / 87.0% / 28; 8080 Apr 2026 12 / 511 / 71.6% / 3, Sep 1 / 60 / 55.0% / 1. Heat grids as Q-M12-HEAT.
- **Headcount (M08, XR-M12-04):** Student A 2026 entries for the 12 subjects of AC-M12-31.1 with Pendidikan Islam TOV 78.00 and no other TOV; Student B the 11 subjects of AC-M12-31.2 with TOV 20.00 / 60.00 / 40.00 / 55.00 / 33.33 / 37.00.
- **History (M08, XR-M12-05):** 2025 grade counts; the 2026 platform subject rows (Matematik 2.50, Bahasa Melayu 2.80, Sains 2.90, Sejarah 3.00, Bahasa Inggeris 3.20; 30 candidates each), shown in every scope (DV-M12-26); 8080: 2026 GPS 4.00 with one B+ candidate. No school-level subject or trend rows are needed.
- **Feedback / interventions:** §6.6.
- **Designed personas:** `pelajar@demo.test` (2) sees S9 with its M05 answers (no M08 TOV → empty Head Count card) and the S10 form; `guru@demo.test` (5) sees the `/guru` twins (provisional) and the S10 form; `admin@demo.test` (1) sees S9 empty and the S10 thank-you state.

### 6.10 Cross-module requests (to the owners; M12 uses no parallel schema — D12)

| # | Owner | Request |
|---|---|---|
| XR-M12-01 | M01 / M02 | Reuse XR-M11-01/02/03 unchanged (T4/T5 rows, teachers, `lastLoginAt`, fixture exclusion). Confirm the admin count (1 and 5801) used by the feedback seed. **Place users 4664 and 4644 as T5 students of school 8080** (inside its 184; `lastLoginAt` set for 4664, null for 4644 as M11 shows "Login sahaja" / "Belum login"); no users 5571 or 5551 are created (not user ids in the rebuild; S8 with them gives 403 as live, DV-M12-25; both fall in M02's reserved block 5001–5999). **Status (v1.4): Applied — M02 v1.15 (4664 with a login, 4644 without, at 8080; no 5571/5551).** |
| XR-M12-02 | M05 | **Host the Kirkpatrick practice segment as a D11 virtual segment of PracticeSession**: 20,991 completed sessions of T4/T5 students (non-fixture schools) with `answeredCount`, `correctCount`, `scorePct`, `subjectId`, `completedAt`; totals, per-school, per-subject, per-month, weekday×hour and per-student aggregates of §6.5 exact; 5 students with sessions but 0 answers; anchors 4664/4644. The segment is **not** required to be a subset of the M11 monitoring answer segment (XR-M11-04): live shows M12 activity where M11 shows none (DV-M12-24), so its detail answers need not exist as QuizAnswer rows (sessions carry the aggregates). **Status (v1.4): Applied — M05 v1.11 KirkpatrickSessionAggregate (DATA-M05-12, §6.14.4), separate store (XL3-04).** |
| XR-M12-03 | M03 | Subject names used by the 26 platform subject rows (incl. Pendidikan Muzik, Reka Bentuk & Teknologi, Ekonomi, Sejarah, Bahasa Cina, Pendidikan Syariah Islamiah, Kimia, Bahasa Arab, Matematik Tambahan, Biologi, Sains Rumah Tangga, Sains Sukan). **Status (v1.4): No change needed — the subject names exist in M03.** |
| XR-M12-04 | M08 | Headcount entries (TOV, current year) for Students A and B as §6.9. **Status (v1.4): Applied — M08 v1.8 request table (4664/4644 2026 entries, not graded).** |
| XR-M12-05 | M08 | Extend SchoolSpmHistory with `gradeCounts` for the 2025 platform row and the 8080 2026 row (GPS 4, one B+); the 2026 platform subject rows. **Expose Q-M12-HC-RECORDS**, a platform count of OTR headcount records = 4,378 at the 25-Sep baseline (DC-M12-02 withdrawn; priority raised). The v1.0 request for 8080 subject/trend rows is withdrawn (they are the platform rows, DV-M12-26). For information: M12 maps subject GPS → grade by ⌈GPS⌉ − 1 and %→grade with D ≥ 40 / E ≥ 30 / G < 30 (DV-M12-20/21, no change asked). **Status (v1.4): Applied except the record count — M08 v1.8 §6.8 (gradeCounts 2025, 8080 2026 row, 2026 subject rows stored at 8880); Q-M12-HC-RECORDS not hosted → DC-M12-02 active (XL3-34).** |
| XR-M12-06 | M11 | S8 is the target of the M11 rows of students without answers (M11 FR-58). On the 8080 page the "kirkpatrick" links of Students A and B use **4664 and 4644** (their one M02 id); M11 must not create a second id for them (DV-M12-25). **Status (v1.4): Applied — M11 v1.9 (8080 kirkpatrick links 4664/4644; zero-answer student page defined).** |
| XR-M12-07 | M17 | Kirkpatrick group placement in the admin sidebar (FR-M12-01) and "Lagi" (FR-M12-02); `/admin/laporan` stays with M17. **Status (v1.4): Open for M17 build (sidebar placement; no conflict found at XL batch 3).** |
| XR-M12-08 | M26 (decided, provisional; contract recorded in M17 v1.4) | Mood check-in ownership (OQ-M12-06): M12 reads a count of check-ins per scope through the M26 provisional contract; 0 until M26 is built (S4 empty card). **Status (v1.5): Decided — M26, provisional (XL3-23, R2-12).** |
| XR-M12-09 | M17 | M17's admin dashboard shows T1 ("Jumlah Respon 336 · Purata Kepuasan 4.6/5 · NPS Score 8.3" and "★★☆☆☆ 4.7/10", D-M17-08): read Q-M12-T1 (responses, mean satisfaction, mean NPS, endpoint #2 plus the count) instead of copying values. "4.7" is not derivable from DATA-M12-01 (satisfaction 4.601, NPS 8.304): M17 must record its own DV or display constant. **Status (v1.4): Applied — M17 v1.4 reads Q-M12-T1 (4.6/5; DV-M17-08).** |
| XR-M12-10 | M02, M11 (XL batch 3 gate) | Two live ids for one student (DV-M12-25): agree the model "one M02 id = the id M11 links (4664, 4644)"; 5571/5551 are not created and S8 with them gives 403 (as live). Check that no other module seeds 5571/5551 or a second id for 4664/4644. **M11 (R2-04):** the S5 links changed by DV-25 now open `/admin/monitoring/sekolah/8080/pelajar/4664` and `/4644` — the M11 student page (S4) for students whom M11 lists with 0 answers; M11 must confirm or define that zero-answer page state (live never rendered it for these ids). **Status (v1.4): Applied — M02 v1.15 / M11 v1.9 (XL3-08, XL3-13).** |

### 6.11 Test hooks (dev/test builds only)

`mock.reset()`, `mock.setNow(iso)` (M05 clock), `mock.failNext(path, code)`, `mock.addFeedback({userId, nps, satisfaction})`, `mock.addIntervention({...})`, `mock.addSegmentStudent({schoolId, answers, correct})` (band-boundary checks of AC-M12-15.3; provisional), `mock.loginAs(id)` (M01).

---

## 7. Mock API endpoints

Envelope and errors per master SRS §7. All GETs are read-only; #9 and #13 mutate. `schoolId`/`state` are passed through from the page query (`school_id`, `state`).

| # | Method | Path | Request | Response | Notes |
|---|---|---|---|---|---|
| 1 | GET | `/api/kirkpatrick/overview` | `?schoolId&state` | `{data: Overview}` | S1 |
| 2 | GET | `/api/kirkpatrick/reaction` | — | `{data: Reaction}` | S2; ignores scope |
| 3 | GET | `/api/kirkpatrick/learning` | `?schoolId` | `{data: Learning}` | S3 |
| 4 | GET | `/api/kirkpatrick/behavior` | `?schoolId` | `{data: Behavior}` | S4 |
| 5 | GET | `/api/kirkpatrick/results` | `?schoolId` | `{data: Results}` | S5; 946 prediction rows in one response |
| 6 | GET | `/api/kirkpatrick/chain` | — | `{data: Chain}` | S6 |
| 7 | GET | `/api/kirkpatrick/export-pdf` | — | `application/pdf` blob, file name `laporan-kirkpatrick.pdf` (PROPOSED) | route `/admin/kirkpatrick/export-pdf` renders it in a new tab |
| 8 | GET | `/api/kirkpatrick/interventions` | — | `{data: InterventionList}` | S7 |
| 9 | POST | `/api/kirkpatrick/interventions` | `{studentId, alertType, actionDate, alertDescription, actionTaken, beforeAccuracy?, beforeMood?, afterAccuracy?, afterMood?}` | `201 {data: KirkpatrickIntervention}`; `422 VALIDATION_ERROR {fields:{studentId:'Pelajar tidak dijumpai.'}}` | admin (and teacher, provisional) |
| 10 | GET | `/api/kirkpatrick/students/:id` | — | `{data: StudentKirkpatrick}`; `403 FORBIDDEN` when `:id` is not a user | S8 |
| 11 | GET | `/api/kirkpatrick/me` | — | `{data: MyKirkpatrick}` | S9, current user |
| 12 | GET | `/api/feedback/status` | — | `{data:{month:'YYYY-MM', answered:boolean}}` | S10 |
| 13 | POST | `/api/feedback` | `{nps, satisfaction}` | `201 {data: FeedbackResponse}`; `409 CONFLICT` when already answered this month; `422` out of range | S10 (provisional) |
| 14 | GET | `/api/kirkpatrick/filter-options` | — | `{data:{schools:[{id, name}], states:[string]}}` | S1, S4 selects |

Referenced (owners): M02 users/schools repositories, M05 `practiceSegment('kirkpatrick')` aggregates, M08 `schoolSpmHistory(scope)` and `headcountEntries(studentId, year)`, M01 session.

---

## 8. States & messages

### 8.1 Observed copy (exact)

| Screen | Copy |
|---|---|
| S1 | "Sekolah", "Negeri", "Semua Sekolah", "Semua Negeri", "Tapis", "Reset", "Tahap 4: Hasil", "GPS Sekolah · {n} rekod headcount", "Tahap 3: Tingkah Laku", "Pelajar aktif · {n} sesi · {x}% ketepatan", "Tahap 2: Pembelajaran", "Ketepatan · {n} soalan dijawab", "Tahap 1: Reaksi", "Kepuasan purata · {n} respon", "Lihat detail", "Kirkpatrick Evaluation Flow", "Klik mana-mana tahap untuk lihat detail", "Kepuasan pengguna", "Peningkatan kemahiran", "Konsistensi penggunaan", "Keputusan peperiksaan", "{n} pelajar aktif", "{x}% ketepatan", "GPS {g}", "Perbandingan Sebelum & Selepas", "SEBELUM", "SELEPAS", "Pelajar Aktif", "Ketepatan", "Jumlah Jawapan", "Champion", "Ringkasan:", "Tiada Data vs Tiada Data", the sentences of BR-M12-08, "Pelajar Berdaftar (T4/T5)", "Soalan Dijawab", "Guru Aktif", "Ketepatan Keseluruhan", "Taburan Engagement Pelajar", "Konsisten", "Berkembang", "Minimum", "Tidak Terlibat", info card text (FN-2.7.1) |
| S2 | "NPS Pelajar", "NPS Guru", "NPS Admin", "Kepuasan Purata" |
| S3 | "Soalan Dijawab", "Ketepatan", "Skor Purata", "Sesi Selesai", "Kadar Penyelesaian", "Learning Gain", "Perlu pre/post test", "Pre-Test / Post-Test belum dimulakan", Hake sentence and formula (FN-4.2.1), "Prestasi Mengikut Subjek", "Mastered", "Developing", "Beginning", "{n} soalan", "Pembelajaran Mengikut Sekolah" |
| S4 | "Pelajar T4/T5", "Pernah Aktif", "Jumlah Sesi", "Taburan Tahap Engagement", ">50 soalan", "20-50 soalan", "5-20 soalan", "<5 soalan", "0 soalan", "Engagement Mengikut Sekolah", "Corak Masa Aktiviti", "Bilangan soalan dijawab mengikut jam dan hari", "{Hari} {HH}:00 — {n} soalan", "Amaran & Pemerhatian", alert templates (BR-M12-14), "💭", "Data Mood Belum Mencukupi", "Pelajar perlu check-in mood harian untuk analisis kesejahteraan vs prestasi." |
| S1 / S5 (no history) | "Belum Ada Data", "Import keputusan peperiksaan", "GPS -", "-", "{n} rekod" (live "41 rekod ·", DV-M12-28), "0/0 calon", "0% daripada 0" |
| S5 | card labels and captions (FN-6.1.1), "Taburan Gred ({y})", "Berdasarkan {n} calon — sumber: Headcount OTR", "{g}: {n} pelajar ({p}%)", "GPS Mengikut Subjek ({y})", "GPS rendah = lebih baik. Trend: berbanding tahun sebelumnya.", "Trend GPS ({a}–{b})", "Keseluruhan", "= GPS menurun (improving). Sumber: Headcount OTR & SPM sebenar.", "Prestasi Mengikut Sekolah (Platform + Headcount)", "Ramalan Prestasi Pelajar Aktif", "Berdasarkan ketepatan menjawab soalan dalam platform", footnote, "Ramalan ALESA (Predictive Grade)", subtitle, "Dijangka Lulus", "Dijangka Gagal", "Perlu Intervensi", "Rendah", "Sederhana", "Tinggi", Cadangan texts, footer, "ROI Platform (Anggaran)", "Purata Soalan/Pelajar", "Ketepatan Aktif", "GPS Headcount", "ROI penuh akan dapat dikira apabila:" + 3 items, "Pemerhatian & Insight", insight templates, disclaimer |
| S6 | FN-7.1.1–7.4.1 copy ("Muat Turun Laporan", "← Kembali", "NPS Purata", "Responden", "Sesi Latihan", "Taburan Konsistensi:", "Consistent", "Developing", "Minimal", "Disengaged", "Hasil / Impak", "Korelasi (r)", "Kekuatan", "Lemah", "Analisis Korelasi: Penggunaan → Pencapaian", "Kesimpulan ALESA:", "Kesimpulan Model Kirkpatrick") |
| S7 | KPI labels, "Rekod Intervensi Baru", form labels/placeholders/options (FN-8.2.2), "Simpan Intervensi", "Senarai Intervensi", "Tiada intervensi direkodkan lagi." |
| S8 | "← Kembali ke Tahap 3", "AI", "ALESA — Analisis Tingkah Laku Kirkpatrick", paragraph template, "Soalan", "Ketepatan", "Konsistensi", "Streak", "Terkuat:", "Perlu perhatian:", "Tahap 2 — Head Count", "{y} — Head Count", "TOV:{x}", "Tahap 2 — Prestasi Platform"; 403 copy (FN-1.2.7) |
| S9 | FN-10.1.1–10.1.4 copy, "Kurang", "Banyak" |
| S10 | "Terima Kasih!", "Anda sudah mengisi maklum balas untuk bulan ini. Sila kembali bulan depan.", "Kembali ke Dashboard" |

### 8.2 PROPOSED COPY and PROPOSED layouts (report at G1; URS OQ-M12-12)

| Item | Text / layout |
|---|---|
| S7 server error (FR-M12-74) | "Pelajar tidak dijumpai." |
| S7 populated list (FR-M12-76) | table with the form labels as headers + status pill with the KPI labels |
| S10 form (FR-M12-90) | title "Maklum Balas Bulanan"; "Berapa besar kemungkinan anda mengesyorkan PrestasiPlus kepada rakan? (0-10)"; "Tahap kepuasan anda terhadap PrestasiPlus (1-5)"; button "Hantar" |
| S6 PDF (FR-M12-61) | one A4 page: title "Model Kirkpatrick — Rantaian Impak", the four level cards' label/value rows, the correlation table and the two conclusion texts (all observed copy) |
| S9 squares / Head Count (FR-M12-86/87) | thresholds 1–9 / 10–29 / ≥ 30; S8 row pattern |
| S5 prediction tie order (BR-M12-21) | user id ascending within equal accuracy; not asserted |
| S8 threshold (BR-M12-29) | paragraph accuracy sentence at ≥ 70 (the S8 bar colours are observed since v1.1, BR-M12-28) |

### 8.3 Loading and errors

Loading: the shell loading indicator while the mock responds. `SERVER_ERROR` on any GET: the M01 global error convention (no M12-specific copy on live). 403/404 pages per FR-M12-14/16/17.

---

## 9. Permissions matrix

| Role | S1–S7 (`/admin/…`) | S1–S7 (`/guru/…`) | S8 | S9 | S10 | Create intervention | Submit feedback | Notes |
|---|---|---|---|---|---|---|---|---|
| Admin | view | view (admin shell) | view | view (own, empty) | view (thank-you) | yes | yes (monthly) | OBSERVED (view) |
| Guru | M17/M01 non-admin rule (INFERRED) | view (provisional) | via `/guru/kirkpatrick/pelajar/{id}` (provisional) | view (own) | view / submit | provisional (the form posts to `/admin/…`) | yes (INFERRED) | Q-M12-1 |
| Pelajar | non-admin rule | `/guru/*` guard of M10 (not asserted) | no | view (own) | view / submit | no | yes (INFERRED) | |
| Admin Sekolah, PPD, JPN, Ibu Bapa, Penaja | non-admin rule | `/guru/*` guard (not asserted) | no | view (own, INFERRED) | view / submit, not counted in T1 NPS by role | no | stored (INFERRED) | OQ-M12-02 |
| Guest | → `/login` | → `/login` | → `/login` | → `/login` | → `/login` | no | no | INFERRED |

---

## 10. Responsive behaviour

Shells switch at `lg` (1024 px): below, the admin sidebar is the "Lagi" drawer and the user sidebar the drawer (global shell). No page-level horizontal scroll at any width (NFR-RESP-01; DV-M12-07). Tables use NFR-RESP-05 option (b): they scroll inside their own card.

| Screen | < `sm` (375) | `sm`–< `lg` (768) | ≥ `lg` (1280) |
|---|---|---|---|
| S1 | filter wraps (Sekolah row, then Negeri + Tapis + Reset), selects ≤ card width, ≥ 36 px; level cards 1 column; flow = vertical list; comparison panels stacked, deltas 2 × 2; KPI 2 columns; engagement 5 columns (compact) | level cards 2 columns; flow circles; panels stacked below `md`, side by side from `md`; KPI 2 columns | level cards 4; KPI 4 |
| S2 | cards 2 × 2 | 2 × 2 | 4 in a row |
| S3 | KPI 2 columns; subject names truncate (`w-32`); school table scrolls | KPI 3 columns | KPI 6 |
| S4 | filter select ≤ card width; KPI 2 columns; band tiles 5 columns; tables and heat map scroll (20 px cells); alerts full width | KPI 3; heat cells 24 px | KPI 6 |
| S5 | KPI 2 columns; all tables scroll; ALESA tiles 3 columns | KPI 3 | KPI 6 |
| S6 | cards 1 column, no "→"; correlation table scrolls; header buttons stay on the header row (wrap below the title if needed) | 4 columns from `md` with "→" | 4 columns |
| S7 | KPI 2 × 2; panel header full width ≥ 36 px; form 1 column, before/after 2 columns; list scrolls | form row 1 3 columns and before/after 4 from `md` | same |
| S8 | header stacks; tiles 2 × 2; cards stacked | cards stacked below `md`, 2 columns from `md` | 2 columns |
| S9 | squares wrap | wrap | one or two rows |
| S10 | centred card, full width minus gutter | centred | centred |

---

## 11. Non-functional requirements

| ID | Requirement | Specialises |
|---|---|---|
| NFR-M12-01 | S5 renders all 946 prediction rows and 50 ALESA rows without a pager (fidelity; live has no pager) and SHALL become interactive within 2 s on the dev build (rows are plain text; no per-row components with watchers). This overrides NFR-01's pagination guidance for this one table. | NFR-01 |
| NFR-M12-02 | Every M12 endpoint SHALL compute from aggregates (ADR-0013 O(cells) group counts; the M05 segment exposes pre-aggregated per-school, per-subject, per-month, per-hour and per-student cells) within 50 ms. | NFR-01 |
| NFR-M12-03 | Accessibility replicates live (NFR-02, D10): no ARIA or keyboard additions beyond the fixes of DV-M12-05/07. | NFR-02 |
| NFR-M12-04 | Privacy: no real person or school name in seeds; student names are "Pelajar Demo {id6}"; school names from the M02 register (fictitious for fixtures). | NFR-05 |
| NFR-M12-05 | Formats per BR-M12-33, `ms-MY` where live has no special form. | NFR-08 |
| NFR-M12-06 | (v1.6, F-26c) The M05 Kirkpatrick aggregate (KirkpatrickSessionAggregate, DATA-M05-12) is built lazily on its first read; M12 is its only reader, so no other module pays the build cost. The first M12 read after a cold start may exceed NFR-M12-02's 50 ms; later reads are within it. | NFR-M12-02 |

### 11.1 Security notes (backend phase)

| ID | Risk in live behaviour (replicated with dummy data) | Backend requirement |
|---|---|---|
| SEC-M12-01 | `/guru/kirkpatrick*` pages post and link to `/admin/kirkpatrick*`; teacher authorisation and data scoping are unknown. | Enforce role and school scope on every Kirkpatrick endpoint, independent of the URL prefix. |
| SEC-M12-02 | S8 shows any student's name, school, marks and accuracy by sequential id (IDOR); an unknown id returns 403, revealing which ids exist. | Authorise per student (admin, or teacher of the student's school); return one uniform response for "not allowed" and "not found". |
| SEC-M12-03 | Intervention POST takes a free numeric `student_id` and free text; CSRF token in the form. | Validate the student and scope server-side; CSRF; escape the stored texts on output (stored XSS); audit who recorded what. |
| SEC-M12-04 | The 405 framework page discloses the framework (Symfony/Laravel) in English. | Uniform branded error pages; no framework banners (DV-M12-11). |
| SEC-M12-05 | S5 is a 1.17 MB page listing all 946 active minors with school and accuracy (and 50 ALESA rows with names). | Data minimisation, admin-only access, pagination or export controls; audit access. |
| SEC-M12-06 | `/admin/kirkpatrick/export-pdf` produces a report of minors' data. | Admin-only, audit log, no caching by intermediaries. |
| SEC-M12-07 | The "one response per month" feedback rule is enforced only by the page state as far as observed. | Enforce uniqueness (user, month) server-side; rate-limit; derive role server-side. |
| SEC-M12-08 | S8 puts the student's full name in `<title>` (browser history, shared devices). | Consider a non-identifying title in the backend phase (the prototype replicates the title with fictitious names). |
| SEC-M12-09 | `school_id` and `state` are free query parameters. | Validate types and allowed values; never interpolate into queries. |

---

## 12. E2E test scenarios

Every scenario runs on the three Playwright projects **mobile** (375×812), **tablet** (768×1024) and **desktop** (1280×800) (NFR-RESP); where a step depends on the width, the step states the expected result for each width. "(provisional)" = rests on INFERRED/PROPOSED behaviour (URS §0); such steps are re-checked when the open question is answered. Values not yet observed (TU-M12-nn) are never asserted.

| ID | Scenario | AC | FR |
|---|---|---|---|
| E2E-M12-01 | Admin on `/admin/kirkpatrick/results`: at 1280 the sidebar group "KIRKPATRICK" is open with the 7 items, icons and targets, "T4: Hasil" active, "Laporan" after the group; at 375/768 the same items in the sidebar drawer. | 01.1 | 01 |
| E2E-M12-02 | Admin at 375 and 768 opens "Lagi": "Kirkpatrick" → `/admin/kirkpatrick`; at 1280 the sidebar entry of E2E-01 is used instead. | 01.2 | 02 |
| E2E-M12-03 | Tab strip on S2, S3, S4, S5, S7 (6 tabs, current highlighted, no "Rantaian Impak"); none on S1 and S6; tabs link to unfiltered URLs from `?school_id=8080`. | 01.3 | 09 |
| E2E-M12-04 | Header title/subtitle and `document.title` of S1, S2, S3, S4, S5, S7 exactly as URS §1. | 01.4 | 05 |
| E2E-M12-05 | S6 header "Rantaian Impak", S8 (4664) "Kirkpatrick — Pelajar Demo 004664", no subtitle; tab titles unchanged. | 01.5 | 06 |
| E2E-M12-06 | S9 header "Kirkpatrick — Prestasi Saya", S10 "Maklum Balas", no subtitle; tab titles. | 01.6 | 07 |
| E2E-M12-07 | S1–S8 on both prefixes render the admin-panel shell; S9, S10 the user-portal shell. | 01.7 | 08 |
| E2E-M12-08 | `/guru/kirkpatrick/behavior` → "T3: Tingkah Laku" active; `/guru/kirkpatrick` → "Overview" active (at 1280 sidebar; at 375/768 in the drawer). | 02.1, 02.2 | 04 |
| E2E-M12-09 | Guest opens `/admin/kirkpatrick`, `/guru/kirkpatrick/chain`, `/kirkpatrick`, `/maklum-balas` → `/login`. | 03.1 | 11 |
| E2E-M12-10 | Admin opens the probed paths of AC-03.2 → M01 404 page. | 03.2 | 14 |
| E2E-M12-11 | Admin opens `/admin/kirkpatrick/interventions/1` and `/create` → 404 page, no "405" text. | 03.3 | 16 |
| E2E-M12-12 | Admin opens `/admin/kirkpatrick/pelajar/99999999` → 403 page with the exact copy and links. | 03.4 | 17 |
| E2E-M12-13 | `?school_id=8080` on S2 and S6 gives the same content as without it. | 03.5 | 15 |
| E2E-M12-14 | **(provisional)** Teacher at 375 opens the drawer "Kirkpatrick" submenu (7 items, `fa-graduation-cap` on T2); admin: group present but hidden; teacher opens `/guru/kirkpatrick` (platform figures) and a tab → M01 landing redirect. | 04.1, 04.3 | 03, 13 |
| E2E-M12-15 | Admin: each `/guru/kirkpatrick…` view equals its `/admin` twin; every in-page link / form action / export / POST starts with `/admin/kirkpatrick`. | 04.2 | 12, 78 |
| E2E-M12-16 | S1 filter: 58 school options ("Semua Sekolah" + 57 A→Z), 11 state options, "Tapis", no "Reset". | 05.1 | 18 |
| E2E-M12-17 | S1: choose 8080 + "Tapis" → URL, preloaded select, "Reset"; values of AC-05.3 on level cards, KPIs, bands (GPS "4.00"); "Reset" returns to the base URL. | 05.2, 05.3 | 18, 19, 20, 21, 22, 29, 30 |
| E2E-M12-18 | S1 `?state=Kelantan`: zero values of AC-05.4, GPS "4.30". | 05.4 | 20, 21, 29 |
| E2E-M12-19 | S1 at 375: select box inside the card, both selects ≥ 36 px, `scrollWidth` ≤ 375; at 768/1280 the selects ≥ 36 px. | 05.5 | 18 |
| E2E-M12-20 | S1 level cards: texts of AC-06.1 in order, links of AC-06.2, 1 / 2 / 4 columns at 375 / 768 / 1280. | 06.1, 06.2, 06.3 | 20, 21, 22, 23 |
| E2E-M12-21 | Flow: at 768/1280 circles with labels, pills and links; at 375 the vertical list with the same links; with `?school_id=8080` (1280) pills "75.6% ketepatan", "53 pelajar aktif", "GPS 4.00". | 07.1, 07.2, 07.3 | 24, 25 |
| E2E-M12-22 | Comparison default: subtitle, ranges, panel values, green deltas, the Ringkasan sentence; panels stacked and deltas 2 × 2 at 375. | 08.1, 08.2, 08.3, 08.6 | 26, 27, 28 |
| E2E-M12-23 | Comparison with `?school_id=8080` (texts of AC-08.4) and `?state=Kelantan` (AC-08.5). | 08.4, 08.5 | 26, 27, 28 |
| E2E-M12-24 | KPI links and targets, engagement tiles (3212 / 77.2%, sum 4,158), info card; tiles 5 columns at 375 without page overflow. | 09.1, 09.2, 09.3, 09.4 | 29, 30, 31 |
| E2E-M12-25 | S2 cards; S1/S2/S6 T1 values unchanged under `?school_id=8080` and `?state=Kelantan`. | 10.1, 10.2 | 32, 33, 23 |
| E2E-M12-26 | **(provisional)** Student submits NPS 10 / 5 via S10; admin S2 "8.4/10", S1 "337 respon". | 10.3 | 32, 91 |
| E2E-M12-27 | S3 KPIs, Learning Gain card; KPI columns 2 / 3 / 6. | 11.1, 11.3, 11.4 | 34, 36 |
| E2E-M12-28 | S3 `?school_id=8080`: KPIs of AC-11.2, no form; 24 subject rows (11 / 10 / 3) with the observed Beginning rows. | 11.2, 12.2 | 35, 37 |
| E2E-M12-29 | S3 subjects: 26 rows, descending order, Σ counts 306,133, 15 Mastered / 11 Developing, the 4 observed rows; hover/click a row → default cursor, no title, no navigation. | 12.1, 12.3 | 37, 38 |
| E2E-M12-30 | S3 school table: headers, 33 rows, the 6 observed links, 16 / 7 / 10 colour split, 0-answer rows 0 / 0% / 0%; scrolls inside its card at 375. | 13.1, 13.2, 13.3 | 39 |
| E2E-M12-31 | S4 filter and KPIs (946), apply 8080 → KPIs of AC-14.2 and "Reset"; select fit at 375. | 14.1, 14.2, 14.3 | 40, 41, 42 |
| E2E-M12-32 | S4 band tiles default (3212 / 77.2%) and 8080, targets `/admin/monitoring`, bar widths. | 15.1, 15.2 | 43 |
| E2E-M12-33 | **(provisional)** Band boundaries on the mock: `mock.addSegmentStudent` with 20, 5 and 0 answers → Konsisten, Berkembang, Tidak Terlibat counts +1. | 15.3 | 43 |
| E2E-M12-34 | S4 school table: headers, 33 rows, first link 9681, tahap split 8 / 7 / 2 / 4 / 3 + 9 inactive, pill style; scrolls at 375. | 16.1, 16.2 | 44 |
| E2E-M12-35 | S4 heat map: 7 rows × 18 columns, titles format, "Selasa 14:00 — 6253 soalan" alpha 1, "Isnin 06:00 — 944 soalan" alpha 0.15 (other platform cells not asserted, R2-03); with `?school_id=8080` the 126 observed values, max 736 and the 43 zero cells `#f1f5f9` and empty; scrolls in its card at 375 (20 px cells). | 17.1, 17.2 | 45 |
| E2E-M12-36 | S4 alerts: exactly 35 items — the 22 red "tidak pernah login" items in school-id order with their counts, then the 10220 "2 guru …" item, then the 12 green items in school-id order with their percentages (9167 "62.5%"); 8298 has no green item; no buttons; absent with `?school_id=8080`; mood card copy. | 18.1, 18.2, 18.3 | 46, 47 |
| E2E-M12-37 | S5 KPI cards default (incl. "96.7%" "174/180 calon") and `?school_id=8080` ("4.00" "41 rekod · 2026", "28.8% daripada 184"). | 19.1, 19.2 | 48 |
| E2E-M12-38 | S5 grade distribution 2025 (rows, %, titles, bar widths) and 8080 2026. | 20.1, 20.2 | 49 |
| E2E-M12-39 | S5 subject GPS rows, grades, trend values; subject cells plain; trend table values and colours, "-" slate-300, legend; both tables scroll at 375. | 21.1, 21.2, 21.4 | 50, 51 |
| E2E-M12-40 | S5 `?school_id=8080`: "GPS Mengikut Subjek (2026)" and "Trend GPS (2022–2026)" with the platform rows and values, incl. the 2026 column (DV-M12-26). | 21.3 | 50, 51 |
| E2E-M12-41 | S5 school table (33, first 9681, 8/7/2/4/3 + 9 faded with "-", 940 Engagement "2"), prediction table (946 rows, accuracy non-increasing — ties not asserted — first row at 8090, band split, grade boundaries of AC-22.2, links, footnote); 8080: 1 row and the 53 observed prediction rows with Students A (row 19) and B (row 50). | 22.1, 22.2, 22.3 | 52, 53 |
| E2E-M12-42 | ALESA platform: visible icon, tiles 48 / 2 / 4, 50 rows in grade order then user id, grade and Keyakinan counts, Cadangan texts, footer; `?school_id=8080`: its own 50 rows (A+ 3 … E 3, Student B row 47 grade C with the D/E text, Student A absent), tiles and footer 47 / 3 / 3 computed from the rows. | 23.1, 23.2, 23.3, 23.4 | 54, 55, 56, 57 |
| E2E-M12-43 | ROI values and box; insights with "(22.8%)"; 8080 insights "(28.8%)", "gred A-", "(tahun 2026): 4.00", ROI 75.6%. | 24.1, 24.2, 24.3 | 58, 59 |
| E2E-M12-44 | S6 header row and "← Kembali" target; 4 cards with the values of AC-25.2 (946/4158 (22.8%), Disengaged 3212), colours; 1 column without arrows at 375, 4 columns with arrows at 768/1280. | 25.1, 25.2, 25.3 | 60, 62, 63, 64, 65, 66 |
| E2E-M12-45 | S6 correlation table exactly 3 rows with bar colours; "Kesimpulan ALESA:" sentence; conclusion text. | 26.1, 26.2 | 67, 68, 69 |
| E2E-M12-46 | **(provisional)** "Muat Turun Laporan" opens a new tab at `/admin/kirkpatrick/export-pdf` returning `application/pdf`. | 27.1 | 61 |
| E2E-M12-47 | S7 default: KPIs 0 / 0 / 0 / 0, empty list text without the "Ambil Tindakan" sentence; KPI 2 × 2 at 375. | 28.1 | 70, 75 |
| E2E-M12-48 | S7 panel closed on load; click opens (chevron rotated), click closes; header ≥ 36 px; form fields, options, defaults, placeholders; layout 1 column at 375, 3 / 4 columns at 1280. | 29.1, 29.2, 29.6 | 71, 72 |
| E2E-M12-49 | S7 submit with "Pelajar (ID)" empty → blocked by the native required check (`validity.valueMissing`), store unchanged. | 29.3 | 73 |
| E2E-M12-50 | **(provisional)** Create an intervention for 4664 (no after value) → KPIs 1 / 1 / 0 / 0 and a list row "Menunggu Semakan"; create a second with before 40.0 / after 55.5 → 2 / 1 / 1 / 0, newest first; list scrolls at 375. | 29.4, 28.2, 28.3 | 74, 76, 70 |
| E2E-M12-51 | **(provisional)** Submit with student id 99999999 → "Pelajar tidak dijumpai." under the field, nothing stored, panel stays open. | 29.5 | 74 |
| E2E-M12-52 | S8 Student A: header, back link, ALESA paragraph, tiles, Terkuat line, Head Count rows, platform rows and bar colours (78.9% green, ≤ 39.1% red); stacking at 375. | 30.1, 30.2, 31.1, 31.4 | 77, 79, 80, 81, 82, 83 |
| E2E-M12-53 | S8 Student B: paragraph without the accuracy sentence, tiles, Terkuat line, Head Count and platform rows with bar classes `bg-yellow-500` (60.0%, 55.0%) and `bg-red-400` (40.0% and below). | 30.3, 31.2 | 79, 80, 81, 82, 83 |
| E2E-M12-54 | From the M11 school page (`/admin/monitoring/sekolah/{id}`) click a row of a student without answers → S8 of that student renders. | 30.4 | 78 |
| E2E-M12-55 | **(provisional)** S8 of a T4/T5 student without answers → "0", "0%", "0", "0d", empty platform card. | 31.3 | 84 |
| E2E-M12-56 | Admin on S9: headings, empty Head Count text, 30 gray squares titled "27/08: 0 soalan" … "25/09: 0 soalan", legend, conclusion text, no T1 card; squares wrap at 375 without overflow. | 32.1, 32.3 | 85, 86, 87, 88 |
| E2E-M12-57 | **(provisional)** Student on S9: square titles equal the student's M05 answers per day; non-zero squares green by the PROPOSED thresholds. | 32.2 | 87 |
| E2E-M12-58 | Admin on S10: thank-you card, copy, "Kembali ke Dashboard" → `/dashboard`; centred at 375. | 33.1, 33.4 | 89 |
| E2E-M12-59 | **(provisional)** Student on S10: PROPOSED form; "Hantar" without scores blocked; with NPS 10 / 5 → thank-you; reopen → thank-you. | 33.2, 33.3 | 90, 91 |
| E2E-M12-60 | Responsive sweep: S1–S10 at the three sizes have `scrollWidth` ≤ viewport; S2 2 × 2 and S7 KPI 2 × 2 at 375; S5 ALESA tiles 3 columns and tables scrolling in their cards. | 34.1, 34.2 | 10 |
| E2E-M12-61 | **(provisional)** S1 `?school_id=99999999` → the zero state of AC-05.4. | 03.6 | 15 |
| E2E-M12-62 | S4 alerts on filtered pages: `?school_id=10220` shows only "{sekolah}: 2 guru telah login tetapi tiada pelajar yang menjawab soalan."; `?school_id=8298` shows only the red "2 pelajar …" item (no green at 50%). | 18.1 | 46 |
| E2E-M12-63 | `/admin/kirkpatrick/pelajar/5571` and `/5551` render the 403 page of E2E-12 (as live); on S5 `?school_id=8080` rows 19 and 50 link to `/admin/monitoring/sekolah/8080/pelajar/4664` and `/4644`. | 30.5 | 78, 53 |
| E2E-M12-64 | `/admin/kirkpatrick/behavior?school_id=9167`: "Pernah Aktif" = row "Aktif" = 5, "Soalan Dijawab" = row "Soalan", bands sum to 8, alerts one red (8) then one green "62.5%"; `/admin/kirkpatrick/results?school_id=9167`: "Pelajar Aktif" = row "Aktif" = prediction row count. | 14.4, 18.4 | 42, 44, 46, 52 |
| E2E-M12-65 | School without SPM history `?school_id=9167`: S1 T4 card "Belum Ada Data" / "Import keputusan peperiksaan", flow pill "GPS -" (circles at 768/1280, list at 375); S5 "GPS Headcount" "-" / "41 rekod" (no "·"), "Kadar Lulus" "0%" "0/0 calon", "Pelajar Gred A" "0" "0% daripada 0", "Pelajar Aktif" "5" "62.5% daripada 8", no "Taburan Gred" card, ROI GPS "-", no "GPS keseluruhan" insight, disclaimer shown. | 06.4, 19.3 | 92, 93 |

---

## 13. Open questions

URS §9 (OQ-M12-01…13) and the top-up requests of URS §9.1 (TU-M12-01…08) apply. SRS-specific:

1. **SQ-M12-01** Closed (v1.4): M05 hosts KirkpatrickSessionAggregate (DATA-M05-12, XL3-04). Original question: M05 must accept the session-level segment of XR-M12-02 (sessions carrying `answeredCount`/`scorePct` aggregates without QuizAnswer rows for generated data). If M05 declines, the fallback is that every segment answer is a QuizAnswer row, which forces the M11 weekly/answer segment to contain M12's April 2026 activity at 8080 — contradicting observed M11 cells (DV-M12-24). Decision needed at the XL gate.
2. **SQ-M12-02** Closed (v1.4): "Rekod Headcount" = DC-M12-02 (XL3-34).
3. **SQ-M12-04** Two live ids (DV-M12-25) — XR-M12-10 for the XL batch 3 gate.
4. **SQ-M12-03** Teacher intervention POST to `/admin/kirkpatrick/interventions` (provisional allow) — confirm with OQ-M12-01.
