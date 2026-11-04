# R1 PRD + dev plan: role-matrix coverage audit against V1/V2 (2026-11-04)

**Question (product owner):** do the R1 PRD (`docs/prd/r1/*`) and dev plan (`docs/plan/r1-development-plan.md`) cover every process, function, feature and user journey of V2 (prestasiplus.cloud) and V1 (prestasiplus.my), with `docs/Matriks-Akses-Peranan .xlsx` as the scope?

**Docs audited:** branch `docs/r1-prd-devplan` at `561499c`, read-only.

**Sources for V1/V2 behaviour:**
- `docs/discovery/*.md`, the observed element and flow inventories;
- `docs/requirements/urs|srs/*.md`;
- `docs/requirements/v2-*.md`;
- the decisions in `docs/TRACKER.md`.

**Not used:** live V1/V2. This environment has no login for either site, so behaviour that was never recorded in discovery was not checked.

**Method:** three independent audit agents ran:
- **M1:** every matrix cell mapped to its URS, FR/AC and plan card, plus role gating.
- **M2:** Murid, in depth.
- **M3:** Guru and Admin Sekolah, in depth.

The Delivery Lead re-checked each Major finding marked "verified" below against the file.

**Status codes:** each item is classed as one of:
- COVERED: the item has an FR, an AC and a card, with enough detail to build it.
- THIN: the item is mentioned, but a developer would have to ask about fields, rules, states or copy.
- MISSING: the PRD or a card is missing for the item.
- CONFLICT: two docs disagree, or V1/V2 behaviour is dropped or changed without a decision from the user.
- OUT-OF-SCOPE-RECORDED: the item is excluded by a cited decision.

## 1. Verdict

**Coverage is broad and almost complete at the row level. It is not yet complete at the journey level.**

At the row level:
- Every ticked matrix cell for every role has a URS, an FR/AC and an owning plan card:
  - 55 rows are COVERED;
  - 1 row is THIN (row 19, PKSK);
  - 2 rows are OUT-OF-SCOPE-RECORDED (rows 15 and 37, user decision D102).
- No un-ticked cell is granted by the PRD, apart from two API-level exceptions (G-02 and G-11 below).
- The totals 37 / 15 / 18 / 13 / 15 / 17 recount correctly from the ticks.
- D-RAM-1..4 are honoured.

At the journey level, **8 Major gaps** remain:
- 4 are conflicts between PRD files;
- 2 are journeys with no specification;
- 2 are V1/V2 functions dropped on a Delivery Lead decision (D113) instead of a decision by the user.

Teams can build most modules from the docs today. The items in §3 should be fixed before the cards that own them start.

## 2. Counts

| Audit | Items | COVERED | THIN | MISSING | CONFLICT | OUT-OF-SCOPE-RECORDED | Major | Minor |
|---|---|---|---|---|---|---|---|---|
| M1 matrix cells (59 rows × 6 columns) | 59 rows | 55 | 1 | 0 | 0 (row level) | 2 | 4 | 10 |
| M2 Murid depth | ~57 | ~33 | ~9 | 2 | 4 | ~9 | 4 | 9 |
| M3 Guru + Admin Sekolah depth | ~49 | ~41 | 3 | 2 | 2 | 1 group | 3 | 5 |

Some items overlap between audits. They are merged into one list in §3.

**Depth not verified.** M2 checked these Murid rows only at function level: A1–A3, A5, 3–9, 13, 16–18, 20, 21, 25–30, 32–36 and 54. M3 checked the FRs of GUR-5/6/7/9 and AS-3..7/49/50/53 only through the summary tables and the traceability file.

## 3. Major gaps (fix before the owning card starts)

| # | Rows | Status | PRD / plan claim | V1/V2 truth, or the conflicting doc | Evidence | Fix |
|---|---|---|---|---|---|---|
| MX-1 | 40 Jemput Ibu Bapa | MISSING-PRD + MISSING-CARD | The route `/ibu-bapa/terima/:token` is named, and nothing else about it | V1 parent-accept page states: "Link Tidak Sah", identity card, guest CTA, switch-account for a non-parent, linked state "Lihat Profil Kemajuan", 403 for a non-student | `10-murid.md:1730` (route only, verified); `docs/requirements/urs/L45-jemput-ibu-bapa.md:68-69,112-125`; S6-T15 covers only link, regenerate and remove | Add the accept-page states and copy to R1-MUR-40, and add them to S6-T15. Without this, AC-MUR-40-2 cannot be tested end to end. |
| MX-2 | 36 Rujuk Kawan, A (register) | CONFLICT | 48 GAME-24 says an invalid code shows "Kod rujukan tidak sah." and the registration still succeeds | 10-murid says an unknown referral code is ignored silently. The registration form has no referral or school-code field. V1 `?ref=` adds no field. The link is `/daftar?rujuk=` but the app route is `/register`. | `48-…:205,955,966` and `10-murid.md:1762` (both verified); `10-murid.md:1750-1758`; `docs/discovery/M01-authentication.md:182` | Pick one behaviour, then add the form field (or drop the message) and the route in both files. AC-GM-24.1 and AC-MUR-36-1 cannot pass until then. |
| MX-3 | 19 PKSK | CONFLICT + THIN | FR-MUR-19-7 says sets of 10 | 46 D6 says sets of 5. V1 has Format A 30 / B 70 / C 1 essay, a readiness score and grade, 13 Bahagian B domains, and a timed Peperiksaan Penuh; R1 cuts these on D113, a Delivery Lead decision. 46:81 still says timed. Marking for A and C is unspecified. Access is granted by "pentadbir sekolah", but Admin Sekolah has no PKSK screen, and the Admin Pusat screen "PKSK Akses" (`/admin/pksk/access`) has no R1-ADM id, FR or card. | `10-murid.md:1299,1302`; `46-…:727` (both verified); `docs/requirements/urs/M07-pksk.md:117-151`; `30-admin-pusat.md:149,184` | User decision: is the V1 exam format in R1? Then align 10 and 46, and add a spec and card for the grant screen. |
| MX-4 | 2 Dashboard, 16 Latih Tubi | CONFLICT + MISSING-CARD | 10-murid and 01 hide the pupil Misi Harian page and `/practice/revision` | 46 serves `/misi`, `/misi/:id`, `/practice/revision` and `/practice/revision/:code`. 48 GAME-20 requires `GET /api/missions/today`. No doc gives the pupil an entry point to a teacher mission, so teachers can create missions that pupils never reach. Global missions have no admin authoring screen. | `10-murid.md:148,169`; `01-product-overview.md:65`; `46-…:78-80,119`; `48-…:824-836`; `20-…:607,626` | Decide hidden or served. If served, add the pupil entry point and the card. |
| MX-5 | 2 Dashboard; 1 Command Center (Guru) | CONFLICT | URS-MUR-07 promises a mood check-in | FR-MUR-2-12 and OQ-MUR-10 drop it (D113). Yet the Guru panel "Mood Pelajar" and the Admin Sekolah Aktiviti Harian panel still read a mood that R1 never records, so they would always show 0. | `02-urs.md:34` (verified); `10-murid.md:465-466,2158`; `20-…:462,517,1817` | User decision: build the mood check-in (V2 behaviour), or remove it from URS-MUR-07 and remove the Guru and Admin Sekolah panels. |
| MX-6 | A, all routes | MISSING-AC | FR-MUR-SH-7 says a pupil who types another role's URL gets 403 | It has no AC: the ACs stop at AC-MUR-SH-6. SC-AS "other roles get 403" has no AC either. S0-T05 and S0-T06 test only hidden modules and sidebar items. FR-SH-1 says 403 but 40/60 say 404. | `10-murid.md:210,220-221` (verified); `20-…:215`; `40-…:350`; `60-…:1078` | Add role-denial ACs to S0-T05/S0-T06 and fix one status code (403 or 404). This is the main control on un-ticked cells. |
| MX-7 | 2 Dashboard (Admin Sekolah) | MISSING (scope) | Perutusan (`/perutusan`, `/:id`, `/tulis`, `/saya`) appears only inside FR-AS-2-2/2-6 and AC-AS-2-2/2-7 | It has no matrix row, no D-number, no module spec (who writes, who reads, visibility) and no card. S5-T09 and S6-T13 do not name it. If it is not built, the dashboard link "Lihat semua" is dead. | `20-…:2563-2576`; `60-…:1049`; plan S5-T09 (line 955) | Give it a card and a spec, or drop the link (D106 forbids dead links). |
| MX-8 | 11 Kirkpatrick (D-RAM-4) | THIN | The pupil detail page `/guru\|admin-sekolah/kirkpatrick/pelajar/:id` is given as a route plus an isolation AC | Discovery M12 S8 records about 80 elements (tiles, copy, entry points). S6-T02 does not mention the page. | `20-…:1234`; `docs/discovery/M12-kirkpatrick.md` (S8) | Add a screen spec to GUR-11 and name the page in S6-T02. |

**Also needs a decision from the user (Major for the architecture, not for coverage):**
- **MX-9, Admin Sekolah portal placement.** `docs/requirements/v2-portals.md` (US-13, AC-03.3) puts Admin Sekolah in Portal Pentadbiran. The PRD keeps `/admin-sekolah/*` in the learning shell. OQ-AS-1 (`20-…:2792`) records this "by principle", not as a decision by the user.

## 4. Minor gaps

**Murid**

| # | Item | Status | Gap | Evidence |
|---|---|---|---|---|
| mn-1 | "Peti Harian" | THIN | The dashboard copy promises a daily chest, but there is no rule, reward or screen for it. V1 had one. | `10-murid.md:442,477` (verified); `urs/M05-practice.md:148-150` |
| mn-2 | Row 38 Kedai Hadiah DIGITAL | THIN | FD-MUR-33 merges rows 31 and 38 because "V2 has no page". L43 observed `/cikgu/hadiah/saya`, "100 syiling = 1 token", and 10 category chips including "Mahkota" against 7 in the PRD. L43 was probed as an admin, so the FD must reconcile the two. | `10-murid.md:1677`; `discovery/L43-kedai-hadiah-digital.md:9-29` |
| mn-3 | Row 39 Timeline manual post | CONFLICT (silent) | V1 has a title, 5 categories, a date, 2000 characters and 1–5 photos. The PRD has 500 characters and 3 types, records "FD: none", and uses route `/timeline/baru` instead of `/timeline/create`. | `10-murid.md:1715` |
| mn-4 | Row 2 dashboard | CONFLICT | The banner carousel and mascot are dropped on D113. Confirm once with the user. | `10-murid.md` R1-MUR-2 |
| mn-5 | Row 14 Heatmap | CONFLICT | The working V2 tile link is changed (FD-MUR-25), which goes against D9. The "Cikgu Pakar" block is not named as hidden. | `10-murid.md` R1-MUR-14 |
| mn-6 | Row 40 | THIN | The strings "Disalin!" (2 s) and "Link jemputan baru telah dijana!" are missing, and so are the loading and error states. | `urs/L45-jemput-ibu-bapa.md` |
| mn-7 | Sejarah Battle | THIN | It has an API row but no screen spec. | 48 |
| mn-8 | AC-CHAIN | THIN | No chain covers referral, Cabutan, Kotak Misteri or Jemput Ibu Bapa. | `40-…` X9 |
| mn-9 | Notifikasi | THIN | The bell is hidden. Each module's ACs should say whether its outcome is shown as a toast or a status. | 10, 48 |

**Guru and Admin Sekolah**

| # | Item | Status | Gap | Evidence |
|---|---|---|---|---|
| mn-10 | Row 11 Kirkpatrick | CONFLICT | The Guru route list has `/export-pdf`, but FR-GUR-11-7 says the PDF is Admin Sekolah only. The route is spelled both `/intervention` and `/interventions`. | `20-…:1206,1234` |
| mn-11 | Row 48 Laporan Aktiviti | THIN | AC-AS-48-2 uses pills and a search box that the field table does not list. The V1 columns (MCQ, Struktur, Syiling, Headcount) are replaced with no FD. | `20-…` R1-AS-48 |
| mn-12 | Row 52 Senarai Guru | CONFLICT | The V2 "Import Pengguna" button is dropped. A teacher created by the school admin is active at once, against v2-portals AC-05.4. Both are recorded only as [PRINCIPLE]. | `20-…` R1-AS-52; `v2-portals.md` |
| mn-13 | Role switch (Guru + Admin Sekolah) | MISSING | There is no UI requirement for switching role (v2-portals Q1, US-08). The API exists (API-AUTH-04). | `v2-portals.md` |
| mn-14 | Rows 49 and 45, API gating | CONFLICT | The API keeps Guru allowed on Amaran Awal although the matrix says "—" (OQ-API-09). Sekolah Bersaing is marked ⚠️ for Murid and Guru. | `60-…:1042-1043,1092-1093` |
| mn-15 | "Mod Pelajar" | Scope | It lets Admin Sekolah reach pupil rows that the matrix leaves "—", and no decision is cited. | `60-…:1067` |
| mn-16 | Guru school change | CONFLICT | FR-GUR-A1-6 and URS-GUR-02 allow it, but S5-T05 and D-A15 make `PUT /api/me` ignore `schoolId`. | `20-…`; plan S5-T05 |
| mn-17 | Guru "Analisis Item" (second sidebar entry) | MISSING-CARD | It is specified, but no card or AC names it. | `20-…:189,857` |

**Docs**

| # | Item | Status | Gap | Evidence |
|---|---|---|---|---|
| mn-18 | Labels | Drift | The Kirkpatrick tabs carry three label sets: matrix "T1: Reaksi", PRD "Tahap 1: Reaksi", admin "Overview". Matrix row 13 "SPM" maps to two sidebar entries, "SPM" and "Bijak SPM". | `20-…:121`; `30-…:179`; `10-murid.md:170-171` |
| mn-19 | Traceability | Drift | `r1-traceability.md:122-123` gives `10-murid.md` as the source of GUR-2b and GUR-3. The GUR-2b AC count is 7, 8 or 9 depending on the file. | `docs/plan/r1-traceability.md` |
| mn-20 | Matrix | Drift | The PRD never cites the totals 37/15/18/13/15/17 or D-RAM-1..4, so they cannot be traced. Matrix row 54 is ticked for Murid 1.0 but blank for Murid. | `01-product-overview.md` §3 |
| mn-21 | Video admin | CONFLICT | URS-ADM-21 says "list, filters, hide", but FR-ADM-N01.1 has add, edit and delete. | `02-urs.md`; `30-…` |

## 5. Out of scope, recorded (no action)

- Rows 15 Mohon Keluarga Angkat and 37 Cikgu Alesa (D102).
- Pupil Jana Kertas (D112(6)).
- The 70% chapter lock (D98).
- The Pertandingan, Uji Minda and Sambung Kata pages (S-23).
- Join-by-code for Tournament and Liga (D-GAME-3).
- The Guru tools with no linking 1.0 screen (D106/D108(6)).
- No admin screen for Pencapaian or Timeline (OQ-H3).
- The extras over the matrix recorded under D106, D108(3), OQ-G-15, D77(b) and D107.

## 6. What must change in the docs

1. **Decisions from the user:** MX-3 (PKSK V1 format), MX-5 (mood check-in), MX-9 (Admin Sekolah portal), mn-4 (carousel and mascot). These are V1/V2 functions currently dropped or moved on D113 or [PRINCIPLE]. Under CLAUDE.md §6, they need a decision from the user.
2. **Conflicts the Delivery Lead can fix:** MX-2, MX-4, MX-6, mn-10, mn-14, mn-16 and mn-21. Align the PRD files and give each one rule.
3. **Missing specs or cards:** MX-1, MX-7, MX-8, the PKSK grant screen (MX-3), and mn-1, mn-13 and mn-17.
4. **Drift:** mn-18 to mn-20, a mechanical clean-up.

Agent working files (outside the repo): the scratchpad folders `m1-matrix-map`, `m2-murid-depth` and `m3-guru-as-depth`.
