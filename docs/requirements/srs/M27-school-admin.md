# M27 — School Admin Portal, screen S0 "Dashboard Sekolah" (`/admin-sekolah`) — Software Requirements Specification

## 0. Document control

| Field | Value |
|---|---|
| Document | SRS — M27 School Admin Portal, S0 Dashboard Sekolah (roles-matrix row L07, Admin Sekolah part) |
| Version | 1.4 (S0 content = v1.3; S1–S11 added in §14–§25) |
| Date | 2026-10-03 |
| Status | **Draft v1.3 (round 3 audit findings fixed, re-audit pending; scope grew under D24 in v1.2, user G1 re-approval needed, URS §0.2)**. v1.1 was approved at G1. One part stays open: what lies below "Taburan Gred (Anggaran)" (OQ-M27-11). |
| Author | product-analyst (agent) |
| Source URS | [urs/M27-school-admin.md](../urs/M27-school-admin.md) v1.3 (11 stories, 34 FN, 51 AC) |
| Source discovery | [L07-dashboard-admin-sekolah.md](../../discovery/L07-dashboard-admin-sekolah.md), [M27-school-admin.md](../../discovery/M27-school-admin.md), [M27-admin-sekolah-screens.md](../../discovery/M27-admin-sekolah-screens.md) (§2.3 formulas, §5.3, §9); evidence: LIVE-SCREENSHOT `roles-matrix/admin sekolah/WhatsApp Image 2026-09-26 at 12.04.10.jpeg`; SERVER-DECK `prestasiplus-reference/backend/public/images/present/ss-admin.png`, `ss-prestasi-sekolah.png`, `backend/public/present.html` (~line 993) |
| Related | M01 SRS (session user, `UserMe.school`, BR-07, BR-15, global 403/404 pages), M02 SRS (schools; users; subscriptions DATA-M02-07, FR-M02-82 status wording), M08 SRS (BR-M08-01…04, FR-M08-11/14/15/19, S1 `/prestasi/sekolah`, S2 `/prestasi/tingkatan`, §7 #1), M09 SRS (perutusan), M10 SRS (classrooms, FR-M10-28 "kelas aktif"), M18 SRS (BR-M18-13/14, S22 `/amaran/sekolah/{id}`, `Q-M18-RISK`), M05 SRS (S1 `/dashboard`; sessions via M08), M17 SRS §3.2 (alias rules), [design/shells.md](../../design/shells.md) v1.2.1 |

**Change log**

| Version | Date | Change |
|---|---|---|
| 1.4 | 2026-10-03 | **S1–S11 added (roles-matrix rows L51–L58; Session 2; D24).** New sections §14–§25 only; §0–§13 (S0, Session 8) are untouched except this row and the Version and Date cells. New ids: FR-M27-38…116 (79), BR-M27-19…39 (21), E2E-M27-35…99 (65, plus CHK-M27-02), XR-M27-11…19 (9), SEC-M27-06…10 (5), NFR-M27-07…12 (6), mock endpoints #2…#16 (15); counts in §15, §16, §24. Source URS = [urs/M27-school-admin.md](../urs/M27-school-admin.md) v1.4 §10–§17. The extension has its own status line (§14.0); the S0 status line is unchanged. |
| 1.3 | 2026-10-03 | **Audit round 3 fixes.** R3-01 (Major): DV-M27-07 as observed server behaviour not reproduced (URS §7); BR-M27-13 and OQ-M27-12 describe M08 per FR-M08-12 (`performance.ts:218-230`); the pupil-equality requirement dropped from AC-M27-11.3 and E2E-M27-34 (GPS, entries, sessions, questions, accuracy kept); KELAS AKTIF = M10 `classrooms.list({isActive, schoolId})`. R3-02: XR-M27-07 and XR-M27-09 reworded to the new definitions only (`classrooms.forSchool` / `list` and `subscriptions.forSchool` exist). R3-03: LANGGANAN seed claim corrected (grace row only under test profile `subscriptions-extra`; default seed none), `cancelled` = none in BR-M27-14, labels per M02 BR-23. R3-04: neutral format example. Totals unchanged: 37 FR, 18 BR, 34 E2E, 51 AC. |
| 1.2 | 2026-10-03 | **D24 amendment** (SERVER-DECK evidence). FR-M27-03 (header "Dashboard Sekolah" / school name); FR-M27-23, 24 rewritten (four cards replace the placeholder slots); new FR-M27-30…37 (Langganan, Ringkasan Prestasi head, GPS, Amaran Awal, Latihan, Tingkatan, Taburan Gred and "Lihat penuh →", no-data states); BR-M27-07 rewritten (source precedence), new BR-M27-12…18 (definitions per figure); §6 owner mapping, seeds approach, named query Q-M27-S0 extended, XR-M27-06…10; §7 `SchoolDashboard` grows; §10 responsive rows for cards, panels, grade list; E2E 25 to 34; DV-M27-04 rewritten, DV-M27-06, 07; OQ-M27-01 closed, OQ-M27-11…14. Totals: 37 FR, 18 BR, 34 E2E (10 `@provisional`), 51 AC. |
| 1.1 | 2026-10-03 | **Audit round 1 fixes** (finding ids as in `docs/qa/audit/M27-audit.md`). AUD-M27-01 (Major): FR-M27-27, NFR-M27-04, CHK-M27-01 re-scoped to M27-owned files, owner-managed anchors exempt (school 8090, M09 #3 title), L07 discovery line 55 redacted. AUD-M27-02 (Major): §2.1 corrected (`/dashboard` not built, M05-T3 dependency), XR-M27-04 to M05, AC-M27-05.2 and E2E-M27-15 `@blocked-by M05-T3`. AUD-M27-03/04: FR-M27-20, 23 (chip icons, tile glyphs, PROPOSED). AUD-M27-06: FR-M27-08, 09, BR-M27-01 tags. AUD-M27-07: AC-M27-01.5, E2E-M27-01 negative step. AUD-M27-08: FR-M27-04 cites M01 BR-15. AUD-M27-09: FR-M27-19, 22 (capitals by CSS only), E2E-M27-06 exact. AUD-M27-10: footer card in §6 note. AUD-M27-11: AC-M27-01.2 PROPOSED (E2E-M27-02 `@provisional`). AUD-M27-12: M08 cross-reference §1, §8.2. AUD-M27-13/14: OQ-M27-09, 10, XR-M27-05. |
| 1.0 | 2026-10-03 | First issue. Owner M27 (UD-1); visible parts only (UD-2); DL decisions of 2026-10-03 in URS §0.1. |

### 0.1 Fidelity deviations referenced here

URS §7 is authoritative: DV-M27-01 (D9: 403 instead of the live picker and its 500), DV-M27-02 (server defect not copied), DV-M27-03 (project rule: 12 px, no horizontal scroll), DV-M27-04 (fourth card green on live, grey in the deck), DV-M27-05 (unobserved states, PROPOSED choices), DV-M27-06 (role line below the name, live wins), DV-M27-07 (deck figures differed between S0 and M08 S1; the rebuild follows each owner definition, nothing tuned or aligned). Anything else replicates the evidence.

---

## 1. Scope

**In scope:** S0 `/admin-sekolah` for the Admin Sekolah in the user shell, top to bottom: Perutusan Terkini card, breadcrumb, red school banner, four summary cards, the "Ringkasan Prestasi" card (four panels, "Taburan Gred (Anggaran)", "Lihat penuh →"), access and scope rules, one read-only mock endpoint (§7).

**Not in this version:** whatever lies below the heading "Taburan Gred (Anggaran)" beyond the INFERRED grade list (OQ-M27-11); the school picker `/admin-sekolah/pilih-sekolah`; the other M27 screens `/admin-sekolah/pelajar`, `/guru`, `/kelas`, `/pengguna`, `/import-pelajar`, `/aktiviti-guru`, `/langganan`, `/invois`, `/laporan-bulanan`, `/statistik-penggunaan`, `/dskp-heatmap`, `/laporan-aktiviti` (all INFERRED hrefs, unrevealed); the M08 pages `/prestasi/sekolah`, `/prestasi/tingkatan*` and the M18 Amaran pages (S0 only links to the first two); aliases owned by M17 (`command-center`), M11 (`monitoring`), M12 (`kirkpatrick`); perutusan list, detail and write (M09); any change to the M01 login redirect.

**Owned data:** none (D12). M27 reads M02 (schools, users, subscriptions), M01 (session), M09 (perutusan), M10 (classrooms), M08 (performance), M18 (risk).

**Assumptions:** (1) the project clock is 2026-09-25T15:40:00+08:00 (M09 §6.9, M17 BR-M17-01); (2) the user shell and its sidebar for `school_admin` exist (F-19, `user-nav.ts` entry "Dashboard" → `/admin-sekolah`); (3) the global 403 and 404 pages exist (M01); (4) `/dashboard` (M05 S1) is built by M05-T3 (in flight); until then only a dev preview stub exists; (5) M08 S1 and S2 routes are built (`m08-student-performance/routes/prestasi.ts`) and admit any logged-in role (the own-school view for non-admins, M08 FR-M08-13); (6) M18 has no mock yet (dependency, OQ-M27-14).

**Source precedence (D24).** Server-copy deck images and code are the spec where live is unobservable; the live screenshot wins where both show something and differ (card 4 colour, role line position, sidebar). The deck is undated and older than the live capture.

**Cross-reference:** M08 S1 `/prestasi/sekolah` is also headed "Dashboard Sekolah" (M08 FR-M08-04, FR-M08-11; tab "Dashboard Sekolah — Prestasi"). M27 S0 is a different screen with tab "Dashboard Sekolah - PRESTASIPLUS"; no conflict.

---

## 2. Screens & routes

| # | Route | Screen | Actor | Shell · header / tab | API (§7) |
|---|---|---|---|---|---|
| S0 | `/admin-sekolah` | Dashboard Sekolah | Admin Sekolah | user · "Dashboard Sekolah" / "{school name}" (SERVER-DECK) · tab "Dashboard Sekolah - PRESTASIPLUS" (PROPOSED) | #1 |

### 2.1 Link targets resolved against the repository (checked 2026-10-03)

| From (element) | Target | Exists? | Note |
|---|---|---|---|
| Sidebar "Dashboard" (user shell, HARIAN) | `/admin-sekolah` | **S0, new** (nav entry exists: `src/shells/nav/user-nav.ts`, exact-active path `admin-nav.ts` `EXACT_PATHS`) | this screen |
| M17 Command Center "← Dashboard" (`board-copy.ts`, `board.test.ts`) | `/admin-sekolah` | resolves once S0 is built | FR-M17-112 |
| "← Papan Pemuka" | `/dashboard` | **No M05 route yet**: `m05-practice/routes/dashboard.ts` is an empty fragment (task M05-T3, Session 8, in flight); today only the dev PreviewHub stub answers (`core-routes.ts`, `access: 'auth'`, no role list). M01 lands `school_admin` there (BR-07); M08 pages already link to it. M05 SRS §9: Admin Sekolah "same as Pelajar (INFERRED)", route role list unconfirmed | INFERRED (DL-3); dependency M05-T3; XR-M27-04 |
| "Lihat semua →" (Perutusan card) | `/perutusan` | **No route yet**: `m09-content/routes/perutusan.ts` is an empty fragment (task M09-T4, build-plan W9) | path defined by M09 FR-M09-93; dependency, OQ-M27-07 |
| "Lihat penuh →" (Taburan Gred) | `/prestasi/sekolah` | **yes** (M08 S1, `m08-student-performance/routes/prestasi.ts`, `access: 'auth'`, tab "Dashboard Sekolah — Prestasi"; own-school view for non-admins, M08 FR-M08-13). The deck shows the linked page with the head "Dashboard Sekolah", "Tingkatan" / "Kelas" pills, a GPS ring and the grade bars: that is M08 S1 (and M18 S27 for officers) | SERVER-DECK (target page), INFERRED (route = M08 S1) |
| "TINGKATAN" panel ("Click untuk detail") | `/prestasi/tingkatan` | **yes** (M08 S2, same route file) | INFERRED (panel is the link) |
| 403 page "Halaman Utama" / "Log Masuk" | `/` / `/login` | yes (M01) | copy from M27 discovery §2.4 |
| 404 page "Halaman Utama" / "Mula Latihan" | `/` / `/practice` | yes (M01 DV-02; `/practice` in M05) | |
| Guest redirect | `/login` | yes (M01) | |
| Sidebar items other than "Dashboard" | various | `/admin-sekolah/command-center`, `/monitoring`, `/kirkpatrick` built (M17, M11, M12); `/headcount`, `/prestasi`, `/analitik/pelajar`, `/analisa-item`, `/latihan-berstruktur`, `/panduan`, `/profile` built; `/admin-sekolah/pelajar`, `guru`, `kelas`, `pengguna`, `import-pelajar`, `aktiviti-guru`, `langganan`, `invois`, `laporan-bulanan`, `statistik-penggunaan`, `dskp-heatmap`, `laporan-aktiviti` not built (global 404 until built) | shell-owned; OQ-M27-06 |
| `/admin-sekolah/pilih-sekolah` | none | not built on purpose | 404 (FR-M27-10) |

---

## 3. Functional requirements

Tags: O = OBSERVED (live), D = SERVER-DECK, S = SERVER, I = INFERRED, P = PROPOSED, R = PROJECT RULE.

| ID | Requirement | FN | AC |
|---|---|---|---|
| FR-M27-01 | The route `/admin-sekolah` SHALL render S0 in the user shell for a signed-in `school_admin` whose account has a school. (O route; I shell) | 1.1.1 | 01.1, 01.2 |
| FR-M27-02 | The sidebar item "Dashboard" (HARIAN) SHALL be active on exactly `/admin-sekolah` and not on `/admin-sekolah/*`. (O) | 1.1.4 | 01.1, 01.2, 01.5 |
| FR-M27-03 | The header title SHALL read "Dashboard Sekolah" and its subtitle SHALL be the school name (M02 `name`) (D); the tab title SHALL be "Dashboard Sekolah - PRESTASIPLUS" (P). | 1.1.2 | 01.3 |
| FR-M27-04 | The top bar SHALL be the user shell's: avatar initials = the shell rule (M01 BR-15, `src/shells/shared/avatar.ts`; the perutusan row initials use M09 BR-M09-29), bell, logout; no gamification chips for `school_admin`. M27 adds nothing to it. (O shape; shell-owned) | 1.1.3 | 01.4 |
| FR-M27-05 | S0 SHALL load its data with `GET /api/admin-sekolah/dashboard` (§7 #1). | 1.2.4 | 07.5 |
| FR-M27-06 | A guest on S0 or on the endpoint SHALL be sent to `/login` (API 401). (I) | 1.2.1 | 07.1, 07.6 |
| FR-M27-07 | A signed-in user whose role is not `school_admin` (platform admin, teacher, student, parent, sponsor, PPD, JPN) SHALL get the global 403 page "Akses Ditolak" in place; the endpoint answers 403. (DL-1; I for roles other than the platform admin) | 1.2.2 | 07.2, 07.3, 07.6 |
| FR-M27-08 | A `school_admin` with no school SHALL get the same 403 page and 403 from the endpoint; a missing school MUST NOT mean "all schools" and no platform figure may be shown. (SERVER on adjacent screens, `StaffScope.php:128-148`, no server route for `/admin-sekolah` / PROPOSED, DL-1; same rule as FR-M17-104) | 1.2.3 | 07.4, 07.6 |
| FR-M27-09 | The school SHALL be the session user's school. No school id from the path, query (`school_id`, `schoolId`) or body SHALL be honoured. (SERVER on adjacent screens / PROPOSED, DL-1; as FR-M17-105) | 1.2.4 | 07.5 |
| FR-M27-10 | `/admin-sekolah/pilih-sekolah` SHALL NOT exist: it answers the global 404 page. (DL-1, DV-M27-01) | 1.2.5 | 07.5 |
| FR-M27-11 | The endpoint SHALL answer 401 (guest), 403 (other role, or no school), else 200; it SHALL never include another school's data. | 1.2.2, 1.2.3 | 07.6 |
| FR-M27-12 | The Perutusan card SHALL render the gold icon, the heading "Perutusan Terkini" and the link "Lihat semua →" on the right of the heading row, on a dark card. (O) | 1.3.1 | 03.1 |
| FR-M27-13 | The rows SHALL be the first N visible perutusan of the viewer taken from the M09 store in M09's order (M09 BR-M09-24: pinned first, then effective publish time descending), N = 3 (P; the evidence shows 1 row). (I source, P limit) | 1.3.2 | 03.1, 03.2, 03.5 |
| FR-M27-14 | A row SHALL show an initials avatar (initials of the author's name, M09 BR-M09-29), the post title, and the meta line "{role label} · {relative time}" where the role label is the author's M09 role label (`school_admin` → "Pengetua", `admin` → "Admin") and the relative time is the project rule of M09 BR-M09-09 ("{n} bulan yang lepas"). The row is plain text, not a link. (O format; I not a link) | 1.3.2 | 03.1, 03.2 |
| FR-M27-15 | Only perutusan visible to the viewer under M09 BR-M09-23 (published or due, and national or the viewer's own school) SHALL appear; the endpoint SHALL not return any other post. (I) | 1.3.5 | 03.3 |
| FR-M27-16 | With no visible perutusan the row list SHALL be hidden; the card header stays; no empty-state sentence is shown. (I) | 1.3.3 | 03.4 |
| FR-M27-17 | "Lihat semua →" in the Perutusan card SHALL be a link to `/perutusan`. (O link; I target) | 1.3.4 | 04.1, 04.2 |
| FR-M27-18 | The breadcrumb SHALL render "← Papan Pemuka" as a link to `/dashboard`, a separator and "Dashboard Sekolah" in bold as a non-link, positioned between the Perutusan card and the banner. (O + D copy; I target) | 1.4.1 | 05.1, 05.2, 05.3 |
| FR-M27-19 | The banner SHALL render a large building icon in a rounded square, the school name (M02 `name`, stored case kept in the text) displayed in capitals by CSS only (`text-transform: uppercase`; I), and the line "Admin Sekolah" (M01 role label of `school_admin`) below the name (O; live wins over the deck's pill, DV-M27-06). | 1.5.1 | 02.1 |
| FR-M27-20 | The banner SHALL render three chips as plain text: "{state}" (M02 `state`) with a leading pin icon, the PPD name (M02 `district`, printed as stored, e.g. "PPD HULU LANGAT") with its own small leading icon (both icon types unreadable in the capture, P, decorative), and "# Kod: {code}" (M02 `code`). None is clickable and the banner is not clickable. (O + D copy; I mapping, DL-5) | 1.5.2 | 02.1, 02.2 |
| FR-M27-21 | A null or empty `district` SHALL omit the PPD chip; an empty `code` SHALL omit the "# Kod:" chip; no placeholder text SHALL be shown. (P) | 1.5.3 | 02.3 |
| FR-M27-22 | S0 SHALL show no school name other than the viewer's own except inside M09 post titles the viewer may see (M09 seed content, outside M27 scope; the M09 #4 title names a school unlike the banner school, not an M27 defect). | 1.5.1, 1.2.4 | 02.4 |
| FR-M27-23 | Below the banner S0 SHALL render four cards in one row, in order "JUMLAH PELAJAR" (blue), "JUMLAH GURU" (teal/mint), "KELAS AKTIF" (pink/red), "LANGGANAN" (green when a subscription exists, grey when "Belum Ada"; DV-M27-04), each with a tinted background and border, a coloured icon tile at its top-left corner (pupil/graduation cap, teacher at a board, door, ID card), the label (visible text upper case, by CSS), a large value in the card's dark hue and a thin foot bar in the card's colour. The cards are not links. (O colours, tile position, glyph shapes; D labels, values, bar; I not links, grey state) | 1.6.1 | 06.1, 06.5, 08.4 |
| FR-M27-24 | "JUMLAH PELAJAR" SHALL be the count of M02 users with role `student` and the viewer's `schoolId` (BR-M27-12), "JUMLAH GURU" the count with role `teacher` (BR-M27-12), "KELAS AKTIF" the M10 count of active classes of the school, `classrooms.list({isActive: true, schoolId})` (BR-M27-13); integers with the `ms-MY` thousands separator. (D cards; S for the two counts, `SchoolAggregates`; I for KELAS AKTIF) | 1.6.2, 1.6.3 | 06.2, 06.3 |
| FR-M27-25 | S0 SHALL have no horizontal page scroll at 375 / 768 / 1280 px; banner chips and long titles wrap; cards are 4 per row at 1280 and 768 px and 2 per row at 375 px; the four panels of "Ringkasan Prestasi" are 4 per row at 1280, 2 per row at 768 and 1 per row at 375; the grade list stays inside its card. (R; P layout) | 1.7.1 | 08.1, 08.3, 08.4 |
| FR-M27-26 | Every text on S0 SHALL be at least 12 px. (R, DV-M27-03) | 1.7.2 | 08.2 |
| FR-M27-27 | No real person's name SHALL appear anywhere. M27-owned files (M27 docs, `src/modules/m27-*`, `e2e/m27-*`) SHALL NOT hard-code the screenshot's or the deck's school code, school name or post title, nor any deck figure; they reach the page only through owner seeds. Owner-managed public anchors (M02 school 8090, the M09 seed #3 title) are exempt. (R; DL-7) | 1.7.3 | 08.6 |
| FR-M27-28 | While loading S0 SHALL show the shell's loading state; a server error SHALL show the M01 global error page; no M27-specific copy. (P) | 1.7.4 | 08.5 |
| FR-M27-29 | The sidebar "Dashboard" and the M17 "← Dashboard" link SHALL open S0. | 1.8.1 | 09.1, 09.2 |
| FR-M27-30 | "LANGGANAN" SHALL read "Belum Ada" when the school has no M02 subscription row; otherwise the status of its current subscription with the M02 BR-23 badge wording "Aktif", "Tempoh Ihsan" or "Tamat" (BR-M27-14); a school whose only row is `cancelled` reads "Belum Ada". (D "Belum Ada"; P other values) | 1.6.4 | 06.4 |
| FR-M27-31 | Below the cards S0 SHALL render a white card with a blue icon tile (bar-chart glyph), the title "Ringkasan Prestasi" and the subtitle "GPS, risiko murid, ketepatan latihan & perbandingan tingkatan", then four panels in one row. (D) | 1.9.1 | 10.1 |
| FR-M27-32 | The panel "GPS SEKOLAH" (label upper case, amber) SHALL show the school GPS with 2 decimals in the band colour, the line "{grade} · {band}" and "{n} entri headcount". GPS, band and n are M08's (BR-M27-15); grade = the grade at round(GPS) half up (M08 BR-M08-04), e.g. "B · Sederhana". (D layout and copy; I tint follows band) | 1.9.2 | 10.2, 10.3 |
| FR-M27-33 | The panel "AMARAN AWAL" (pink) SHALL show three numbers labelled "Selamat" (green), "Berhati" (amber), "Berisiko" (red) and the line "{n} murid dinilai" (BR-M27-16). (D) | 1.9.3 | 10.4 |
| FR-M27-34 | The panel "LATIHAN" (lavender) SHALL show "{p}%" with 1 decimal in purple, "Purata Ketepatan", and "{n} sesi · {n} soalan" with `ms-MY` separators (BR-M27-17). (D) | 1.9.4 | 10.5, 10.6 |
| FR-M27-35 | The panel "TINGKATAN" (indigo) SHALL show the rows "Tingkatan 4" and "Tingkatan 5", each with "{x}%" (1 decimal; amber 50–69.9, emerald ≥ 70, red < 50, M08 FR-M08-19) and a bar of that width, the foot text "Click untuk detail"; the panel SHALL link to `/prestasi/tingkatan`. (D layout, copy, amber; I link, other colours) | 1.9.5 | 10.7, 11.2 |
| FR-M27-36 | Under the panels S0 SHALL show the sub-heading "Taburan Gred (Anggaran)" with the link "Lihat penuh →" to `/prestasi/sekolah` on its right, and under it the grade list A+, A, A-, B+, B, C+, C, D, E, G (letter, bar in the M08 grade colour, count, percentage) with the footer "Jumlah: {n} rekod" (M08 FR-M08-15). (D heading, link; I the list on S0, OQ-M27-11) | 1.9.6 | 10.8, 11.1, 11.3 |
| FR-M27-37 | No-data states (BR-M27-18): GPS "—" without the "{grade} · {band}" line and "0 entri headcount"; AMARAN AWAL "0", "0", "0" and "0 murid dinilai"; LATIHAN "—" and "0 sesi · 0 soalan"; TINGKATAN both rows always shown; grade list zero rows and "Jumlah: 0 rekod". Every figure SHALL be confined to the viewer's school. (I) | 1.9.7 | 10.3, 10.6, 10.9, 10.10 |

Count: **37 FRs** (FR-M27-01…37).

### 3.1 Traceability (US → FR → E2E)

| Story | FR | E2E |
|---|---|---|
| US-M27-01 | 01, 02, 03, 04 | 01, 02, 03 (AC-01.5 in E2E-01) |
| US-M27-02 | 19, 20, 21, 22 | 04, 05, 06 |
| US-M27-03 | 12, 13, 14, 15, 16 | 07, 08, 09, 10, 11 |
| US-M27-04 | 17 | 12, 13 |
| US-M27-05 | 18 | 14, 15 |
| US-M27-06 | 23, 24, 30 | 16, 26, 27 |
| US-M27-07 | 05, 06, 07, 08, 09, 10, 11 | 17, 18, 19, 20, 21 |
| US-M27-08 | 25, 26, 27, 28 | 22, 23, 24 (08.6 = static check CHK-M27-01) |
| US-M27-09 | 29 | 25 |
| US-M27-10 | 31, 32, 33, 34, 35, 36, 37 | 28, 29, 30, 31, 32, 33, 34 |
| US-M27-11 | 35, 36 | 31, 32, 34 |

---

## 4. Business rules

| ID | Rule | Source |
|---|---|---|
| BR-M27-01 | **Scope.** The school of S0 is the session user's `schoolId`; a null school is an error (403), never "all"; no request parameter overrides it. | SERVER on adjacent screens (`StaffScope.php:128-148`; no server route for `/admin-sekolah`) / PROPOSED (DL-1); BR-M17-34 |
| BR-M27-02 | **Access.** Only role `school_admin` passes. Every other signed-in role gets 403 in place (not a redirect to its landing page), the rule of the M17 alias routes (FR-M17-102, M17 SRS §9). Guest goes to `/login`. | DL-1 / I |
| BR-M27-03 | **Banner mapping.** name = M02 `name`; state = M02 `state`; PPD = M02 `district` (fixtures store "PPD …" already, printed as stored, no prefix added); code = M02 `code`; role line = M01 role label "Admin Sekolah" (M01 §6.7). | I (live and deck print "PPD …"; M02 holds it in `district`) |
| BR-M27-04 | **Perutusan selection.** Rows come from the M09 read contract for the viewer (M09 BR-M09-23 visibility, BR-M09-24 order), first 3. Pinned posts therefore come first. | I / P |
| BR-M27-05 | **Row fields.** Initials = first letters of the first two words of the author's name, upper case (BR-M09-29); role label = M09 label of the author's role; relative time = "{n} {unit} yang lepas" using the project calendar rule (largest non-zero unit; days of 7 or more become weeks) from `createdAt` to the project clock. At the clock: M09 #2, #3, #4 all read "6 bulan yang lepas". | O format / I rule |
| BR-M27-06 | **Empty perutusan.** No copy exists on the evidence, so none is shown; the list is hidden. | I |
| BR-M27-07 | **Source precedence (D24).** The deck is the spec for the cards and "Ringkasan Prestasi"; the live screenshot wins where both show something and differ (card 4 colour, role line below the name, sidebar). Nothing outside the evidence is invented; unobserved states are PROPOSED or INFERRED and listed in §8.2. | UD-3 |
| BR-M27-08 | **Landing.** M01 BR-07 is unchanged: `school_admin` still lands on `/dashboard`. S0 is reached from the sidebar. | DL-2 |
| BR-M27-09 | **Clock.** All times use the project clock (ADR-0006); no seeded time is dated after it. | project rule |
| BR-M27-10 | **Read-only.** S0 changes no data; opening it records no M09 read (M09 BR-M09-07 counts reads of S23 only). | P |
| BR-M27-11 | **Breadcrumb target.** "← Papan Pemuka" goes to `/dashboard`; it is never a link to S0 itself. | DL-3 / I |
| BR-M27-12 | **Pupils and teachers.** "JUMLAH PELAJAR" = count of M02 users with role `student` and `schoolId` = the school, every student active or not (as M17 BR-M17-03; M08 reads the same counts, M08 FR-M08-11/12); "JUMLAH GURU" = count with role `teacher` and `schoolId` = the school. The server counts `users` by role and `school_id` (`SchoolAggregates`: "Pelajar (daftar)", "Guru"). Values are computed from the owner dataset, never copied from the deck. | S / D12 |
| BR-M27-13 | **Kelas aktif.** Active classes (M10 `isActive = true`) of the school as M10 defines them: `classrooms.list({isActive: true, schoolId})`, the read M08 uses (`classesOf`). The deck shows 0 for a school with 0 teachers, which fits this or the alternative "owned by a teacher of the school"; which school link M10 uses is to be confirmed (XR-M27-07). M08 S1 (FR-M08-12; `performance.ts:218-230`) takes Murid and Guru from M02 counts by role and school and Kelas from active classrooms of the school, so in the rebuild its tiles may coincide with the S0 cards because both read the same owner stores; that is a consequence, not a requirement, and no value is tuned (DV-M27-07, OQ-M27-12). | I |
| BR-M27-14 | **Langganan.** The school's current M02 SchoolSubscription: the row with status `active` whose period contains now; else `grace`; else `expired`; a `cancelled` row is not a current subscription (PROPOSED, M02 BR-23 status set `active`, `grace`, `expired`, `cancelled`); none → "Belum Ada". Labels "Aktif", "Tempoh Ihsan", "Tamat" (M02 BR-23 badge wording). Card colour: green when a current subscription exists, grey when "Belum Ada". | D ("Belum Ada") / P (values, order) / INFERRED (grey, DV-M27-04) |
| BR-M27-15 | **GPS panel.** GPS, band and entries are the M08 school values: GPS = Σ(grade points) ÷ graded entries, 2 decimals (BR-M08-01); band ≤ 2 "Cemerlang", ≤ 4 "Baik", ≤ 6 "Sederhana", else "Perlu Perhatian" (BR-M08-03); grade = grade at round(GPS) half up on A+ 0 … G 9 (BR-M08-04); entries = graded headcount entries of the school. Same values as M08 S1 (AC-M27-11.3). | D / owner M08 |
| BR-M27-16 | **Amaran Awal panel.** Tallies = the school's pupils by M18 risk status: "Selamat" = Hijau "On Track" (score < 40), "Berhati" = Kuning "Perlu Perhatian" (40–59.9), "Berisiko" = Merah "Berisiko Tinggi" (≥ 60) (M18 BR-M18-13/14, `Q-M18-RISK(schoolId)`); "murid dinilai" = the sum. The deck page of the school's Amaran Awal shows the same four numbers under the labels On Track / Perlu Perhatian / Berisiko Tinggi / Jumlah Pelajar (Session 2 §5.3); the S0 labels "Selamat", "Berhati", "Berisiko" are the S0 copy. The server's binary teacher-class risk rule is not used. | D / owner M18 |
| BR-M27-17 | **Latihan and Tingkatan.** "Purata Ketepatan" = mean of the school's completed-session accuracies, 1 decimal (M08 BR-M08-07 / `SchoolAggregates` `AVG(practice_sessions.accuracy)`); sessions = completed sessions; soalan = answered questions of the school's pupils (M05 through M08 `stats`). Level rows: the two levels T4 and T5 of M08 (D10 limit), accuracy = the level's mean session accuracy (M08 FR-M08-19). | D / S / owner M08 |
| BR-M27-18 | **No-data and formats.** "—" for an accuracy or GPS with no source row (a school with no sessions is "no data", never 0 %; SERVER convention `SchoolAggregates`); integers `ms-MY` ("1,234"); accuracy 1 decimal ("53.9%"), GPS 2 decimals; separators "·" and "→" as in the copy. | S / I |

---

## 5. Validation rules

S0 has no form. Inputs:

| Input | Rule | Invalid, unknown → |
|---|---|---|
| Query string on `/admin-sekolah` | ignored (including `school_id`) | page for the session school |
| Path below `/admin-sekolah/` not defined by any module (e.g. `pilih-sekolah`) | no route | global 404 page |
| Session role / school | see BR-M27-01, 02 | 403 |

---

## 6. Data entities & fields

### 6.1 Referenced entities (owners; not redefined — D12)

| Figure on S0 | Entity and contract | Owner | Tag |
|---|---|---|---|
| Session user, role label | User (`id`, `name`, `role`, `schoolId`) | M01 | read |
| School name, state, PPD, code | School (`name`, `state`, `district`, `code`), by the session `schoolId` | M02 | read |
| JUMLAH PELAJAR, JUMLAH GURU | users with role `student` / `teacher` and `schoolId` | M02 / M01 | S (`SchoolAggregates`) |
| KELAS AKTIF | active classrooms of the school: `classrooms.list({isActive: true, schoolId})` (exists, used by M08) | M10 | I; XR-M27-07 (confirm the school link) |
| LANGGANAN | SchoolSubscription of the school via `subscriptions.forSchool(schoolId)` (exists; DATA-M02-07: `schoolId`, `status`, `endsAt`) | M02 (M19 reads the same rows) | P; XR-M27-09 (current-status rule) |
| GPS SEKOLAH, grade, band, entries; grade distribution; level accuracy; sessions, questions, accuracy | `schoolPerformance(scope, year)` = M08 §7 #1 (`gps {value, band, entries}`, `distribution`, `levels`, `stats {sessions, answered, accuracy}`) | M08 (practice facts from M05) | S / owner; XR-M27-06 |
| AMARAN AWAL tallies | `Q-M18-RISK(schoolId)` over M05 sessions, M02/M01 `lastActiveAt`, M05 mastery | M18 | owner; XR-M27-08; M18 not built |
| Perutusan rows | `perutusanRepo.list(viewer)`: `id`, `title`, `createdAt`, `author {name, initials, roleLabel}` | M09 | read, viewer-scoped |

M27 owns no table, dataset or display constant: every figure is computed per request from the owners' datasets (D11, D12). The deck's values are an observation of one real school and are never copied (privacy, DL-7; seed rule of CLAUDE.md §6: values mirror observation only where observed for a record that exists in this app).

The S0 cards for the deck school are not seeded (that school is not a fixture); the fixture schools below take whatever the owner datasets compute.

### 6.2 Seeds (existing records; M27 adds none, so no shared-store edit and no worktree is needed)

| Persona | User (M01) | School (M02) | Banner | Perutusan row (M09), at clock | Cards and panels |
|---|---|---|---|---|---|
| Primary | 3102 `azlan@demo.test` "Azlan Demo" | 900003 "SMK Demo Seri Putra", state Selangor, district "PPD HULU LANGAT", code `DMO0003` | all three chips | #4 (pinned, school 900003): "AD", "Pengetua · 6 bulan yang lepas" | computed from the owners for 900003; LANGGANAN "Belum Ada" expected (no M02 row; verify at build) |
| Secondary | canonical 8 `adminsekolah@demo.test` | 900001 "SMK DEMO", Selangor, "PPD PETALING UTAMA", `BEA4001` | all three chips | #2 (author 3103): "SA", "Pengetua · 6 bulan yang lepas" | computed for 900001; LANGGANAN "Tempoh Ihsan" only after `mock.reset({profile: 'subscriptions-extra'})` (the test-only profile that adds one grace row at 900001, `seeds/billing.ts`, `overrides.test.ts`); under the default seed "Belum Ada" |
| No PPD, no code | 3104 `suhaimi@demo.test` | 900002 "SK Demo", Johor, district null, code empty | state chip only | #3 (author 3104): "SM", "Pengetua · 6 bulan yang lepas" | computed for 900002 |
| Empty perutusan | generated M02 school admin of school 8090 (M01 users-store test); 8090 is an observed public M02 anchor (owner-managed, exempt under DL-7) | 8090 (M02 anchor) | per M02 record | none: list hidden | computed for 8090; candidate "populated school": 8090 and 8078 hold sessions and answers (M17 / M11 anchors, each with a generated school admin, M01 users-spec); whether M08 holds graded headcount entries for them is not verified: the build task picks the populated school (8090, 8078 or 8102) by the M08 and M18 oracles |
| Refused roles | 1 `admin@demo.test`, 5 `guru@demo.test`, 2 `pelajar@demo.test` | — | — | 403 | — |
| No school | a `school_admin` with `schoolId` null, created for tests through the M01 mock store (test hook, §6.4; XR-M27-05) | — | — | 403 | — |

The fixture schools 900001–900003 hold few or no pupils, so their panels are mostly zero or no-data states; the E2E scenarios below call the school with populated panels "the populated school" (chosen at build as above, 8090 by default). The build task records the computed values of each persona in its test; the E2E compare with the owner's query for the same school (oracle, §12) instead of pinned numbers, so owner dataset changes do not break M27. No real name, school code or post title from the screenshot or the deck is used; the three perutusan titles are the existing M09 seed content, referred to here by id.

### 6.3 Named query (M27)

| Name | Definition |
|---|---|
| Q-M27-S0(user) | `{ school: M02.schools.get(user.schoolId) → {id, name, state, ppd: district or null, code or null}, roleLabel: "Admin Sekolah", perutusan: M09.list(viewer).slice(0, 3) → {id, title, createdAt, author: {initials, roleLabel}}, cards: {pupils: M02 count(student, schoolId), teachers: M02 count(teacher, schoolId), activeClasses: M10 classrooms.list({isActive: true, schoolId}).total, subscription: M02 current row or none}, performance: {gps: M08.gps + grade at round(value), risk: M18 Q-M18-RISK(schoolId) tally or null while M18 is absent, practice: {accuracy, sessions, questions}: M08.stats, levels: M08.levels, distribution: M08.distribution, total} }`; throws 403 when the role is not `school_admin` or `schoolId` is null. |

### 6.4 Test hooks (dev and test builds only)

`seedSchoolAdminWithoutSchool()` (PROPOSED name): creates one `school_admin` with `schoolId` null through the M01 mock store and returns its e-mail; reset by `mock.reset()`. It bypasses M02 FR-M02-27 (school required at creation) and must write through the M01 mock store only; it is PROPOSED until M02 provides or approves it (XR-M27-05). All other fixtures exist.

### 6.5 Requests to owner modules (XR-M27-nn)

| ID | To | Request | Status |
|---|---|---|---|
| XR-M27-01 | M09 | Provide the route `/perutusan` (S22, task M09-T4) so that "Lihat semua →" resolves; S0 reads `perutusanRepo.list(viewer)` as it is (no change). | dependency, OQ-M27-07 |
| XR-M27-02 | M01 / shell | None: landing unchanged (DL-2); sidebar entry and role label exist. | none |
| XR-M27-03 | M17 | None: "← Dashboard" already points to `/admin-sekolah`. | none |
| XR-M27-04 | M05 | M05-T3 (S1 `/dashboard`) SHALL admit `school_admin` (no redirect, no 403), in line with M05 SRS §9 "Admin Sekolah same as Pelajar (INFERRED)", so that "← Papan Pemuka" works. | dependency; OQ-M27-02 |
| XR-M27-05 | M02 | Provide or approve a test hook that creates a `school_admin` with a null school (M02 FR-M02-27 forbids it at creation); writes through the M01 mock store only. | OQ-M27-10 |
| XR-M27-06 | M08 | (a) Confirm that `schoolPerformance(scope, year)` (§7 #1) can be called with the school of a `school_admin` and returns `gps`, `distribution`, `levels` and `stats {sessions, answered, accuracy}` for that school only; (b) add `gps.grade` (grade at round(GPS) half up, BR-M08-04) additively, so that M27 does not recompute it (until then M27 derives it from `gps.value` with the same rule). No M08 change to S1 itself. | request |
| XR-M27-07 | M10 | Confirm which school link defines an active class for a school (the class `schoolId` or the owning teacher's school); S0 uses the existing `classrooms.forSchool(schoolId)` / `classrooms.list({isActive, schoolId})`, no new read. | request (confirm) |
| XR-M27-08 | M18 | Expose `Q-M18-RISK(schoolId)` as a read returning `{onTrack, watch, high, total}` for a school (BR-M18-14 statuses), identical to the M18 S22 school page tallies. M18 has no mock yet. | dependency; OQ-M27-14 |
| XR-M27-09 | M02 | Add the "current status" rule of BR-M27-14 (active in period, else grace, else expired; `cancelled` is none) on top of the existing `subscriptions.forSchool(schoolId)`, as a named query or helper. | request |
| XR-M27-10 | M02 / M01 | Confirm named counts of users by `role` and `schoolId` (students, teachers), every student active or not (BR-M27-12), consistent with M17 BR-M17-03 and M08 FR-M08-11/12. | request (confirm) |

---

## 7. Mock API endpoints

Conventions: master SRS §7 (JSON envelope `{data}`; errors `{error:{code, message}}`: 401 `UNAUTHORIZED`, 403 `FORBIDDEN`). Guard **SA** = `school_admin` only, school forced from the session (client school id ignored; no school → 403).

| # | Method | Path | Guard | Request | Response `data` | Errors |
|---|---|---|---|---|---|---|
| 1 | GET | `/api/admin-sekolah/dashboard` | SA | none (no parameters; any `school_id` ignored) | `SchoolDashboard` | 401, 403 |

`SchoolDashboard` = `{ school: { id, name, state, ppd: string | null, code: string | null }, roleLabel: "Admin Sekolah", perutusan: [ { id, title, createdAt, author: { initials, roleLabel } } ] (0 to 3), cards: { pupils: number, teachers: number, activeClasses: number, subscription: { status: 'none' | 'active' | 'grace' | 'expired', label: string } }, performance: { gps: { value: number | null, grade: string | null, band: string | null, entries: number }, risk: { safe: number, watch: number, high: number, total: number } | null, practice: { accuracy: number | null, sessions: number, questions: number }, levels: [ { code: 't4' | 't5', name: string, accuracy: number } ], distribution: [ { grade: string, count: number, pct: number } ], total: number } }`. `risk` is `null` only while M18 is not built (dependency, not a runtime state of the product). `subscription.label` is "Belum Ada" for `none`. The page computes the relative time from `createdAt` and the project clock; GPS, accuracy and percentages are rounded as BR-M27-15/17/18.

---

## 8. States & messages

### 8.1 Observed copy (exact)

Live: "Perutusan Terkini", "Lihat semua →", "Pengetua · {n} bulan yang lepas" (pattern "{role label} · {relative time}"), "← Papan Pemuka", "Dashboard Sekolah", "Admin Sekolah", "{state}" (pin icon before it), "{PPD name}" (small icon before it), "# Kod: {code}".

SERVER-DECK: header "Dashboard Sekolah" / "{school name}"; cards "JUMLAH PELAJAR", "JUMLAH GURU", "KELAS AKTIF", "LANGGANAN", value "Belum Ada"; card title "Ringkasan Prestasi", subtitle "GPS, risiko murid, ketepatan latihan & perbandingan tingkatan"; panels "GPS SEKOLAH" ("{grade} · {band}", "{n} entri headcount"), "AMARAN AWAL" ("Selamat", "Berhati", "Berisiko", "{n} murid dinilai"), "LATIHAN" ("{p}%", "Purata Ketepatan", "{n} sesi · {n} soalan"), "TINGKATAN" ("Tingkatan 4", "Tingkatan 5", "Click untuk detail"); "Taburan Gred (Anggaran)", "Lihat penuh →". Grade list copy of the linked page (M08): "A+ … G", "Jumlah: {n} rekod".

### 8.2 PROPOSED / INFERRED (report at G1)

| # | Where | Text or behaviour | Tag |
|---|---|---|---|
| 1 | Tab title | "Dashboard Sekolah - PRESTASIPLUS" | P |
| 2 | Perutusan row | plain text (not a link); max 3 rows; M09 order | I / P |
| 3 | Empty perutusan | list hidden, no copy | I |
| 4 | Banner chips | omitted when PPD or code is empty; leading icons (types PROPOSED) | P |
| 5 | "← Papan Pemuka" | target `/dashboard` (route by M05-T3) | I |
| 6 | Banner name | capitals by CSS only | I |
| 7 | Load error | M01 global error page | P |
| 8 | Card 4 | green when a subscription exists, grey (deck) for "Belum Ada" | live wins / I |
| 9 | LANGGANAN values other than "Belum Ada" | M02 status wording | P |
| 10 | KELAS AKTIF definition | `classrooms.list({isActive: true, schoolId})` (M10; school link to be confirmed, XR-M27-07) | I |
| 11 | Cards | not links | I |
| 12 | Panels | no-data states ("—", zeros); tint follows the GPS band; TINGKATAN panel is the link; level colours red below 50 and emerald from 70 | I |
| 13 | Grade list on S0 | the M08 list (cut off in the deck) | I |
| 14 | Reflow | cards 4/4/2; panels 4/2/1 per row at 1280/768/375 | P |

### 8.3 Global pages used

- 403: "403", "🚫", "Akses Ditolak", "Anda tidak mempunyai kebenaran untuk mengakses halaman ini. Sila log masuk dengan akaun yang betul atau hubungi pentadbir.", "Halaman Utama" → `/`, "Log Masuk" → `/login`, "PRESTASIPLUS" (M27 discovery §2.4).
- 404: "404", "🔍", "Halaman Tidak Dijumpai", "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?", "Halaman Utama" → `/`, "Mula Latihan" → `/practice`, "PRESTASIPLUS".

---

## 9. Permissions matrix

| Route / endpoint | Admin Sekolah (with school) | Admin Sekolah (no school) | Admin (platform) | Guru, Pelajar, Ibu Bapa, Penaja, PPD, JPN | Guest |
|---|---|---|---|---|---|
| S0 `/admin-sekolah` | yes (own school) | 403 page | 403 page (live: 302 then 500, DV-M27-01) | 403 page (INFERRED) | `/login` |
| `/admin-sekolah/pilih-sekolah` | 404 | 404 | 404 | 404 | `/login` or 404 per the router guard order |
| `GET /api/admin-sekolah/dashboard` | 200 | 403 | 403 | 403 | 401 |
| Links from S0: `/prestasi/sekolah`, `/prestasi/tingkatan` | open (own-school view, M08 FR-M08-13) | n/a | n/a | n/a | n/a |

Consistent with the M17 alias rule (M17 SRS §9, row "Alias routes").

---

## 10. Responsive behaviour (375 / 768 / 1280)

| Area | 1280 | 768 | 375 |
|---|---|---|---|
| Shell | sidebar (256 px), user-shell header | below `lg`: no sidebar, hamburger drawer, bottom nav of the user shell | same as 768 |
| Header | title and school-name subtitle on two lines | same | subtitle ellipsis on one line |
| Perutusan card | full width of main | full width | full width; titles wrap |
| Breadcrumb | one line | one line | may wrap |
| Banner | icon, name and chips on one row | same, chips may wrap | icon above or beside the name; chips wrap on their own lines (P) |
| Summary cards | 4 per row | 4 per row (P) | 2 per row (P) |
| "Ringkasan Prestasi" head | icon tile, title, subtitle on one block | same | subtitle wraps |
| Four panels | 4 per row (deck) | 2 per row (P) | 1 per row (P) |
| "Taburan Gred (Anggaran)" row | heading left, "Lihat penuh →" right | same | heading and link may wrap onto two lines |
| Grade list | 10 rows, bar fills the row | same | rows keep letter, bar, count and percentage without horizontal scroll (the bar shrinks) |

No horizontal page scroll at any size; text at least 12 px. Layout for 768 and 375 is PROPOSED: the evidence is one live capture of unknown real width plus deck images at 1280, and the school-admin shell was never rendered at 375 / 768 (M27 discovery §7).

---

## 11. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-M27-01 | Performance: the endpoint answers from the owners' stores (M02, M09, M10, M08, M18) in under 100 ms in the mock; M08 and M18 aggregates come from the owners' own counters (no iteration over the answer log). |
| NFR-M27-02 | Localisation: all copy in Bahasa Melayu exactly as quoted; relative time in BM; numbers `ms-MY`; school and perutusan content as stored. |
| NFR-M27-03 | Accessibility replicates live (D10): no ARIA, focus or motion enhancements are added. Text at least 12 px. |
| NFR-M27-04 | Privacy: no real person's name anywhere; M27-owned files do not hard-code the screenshot's or the deck's school code, school name or post title, nor any deck figure. Owner-managed public anchors (M02 school 8090, M09 seed #3 title) are exempt (DL-7). |
| NFR-M27-05 | Determinism: the same clock and seed give the same page. |
| NFR-M27-06 | Test hooks in dev and test builds only. |

### 11.1 Security notes (backend phase; security-engineer review required because the change touches an access-controlled, school-scoped view with pupil-level aggregates)

| ID | Risk | Prototype | Backend requirement |
|---|---|---|---|
| SEC-M27-01 | A missing school read as "all" would show platform data (server defect, DV-M27-02). | school null gives 403 | scope from the session, a missing scope is an error; test on content, not only on status |
| SEC-M27-02 | A client-supplied school id would leak another school. | ignored | ignore and test `school_id` in query and body |
| SEC-M27-03 | The perutusan teaser could expose another school's posts. | M09 visibility rule | one visibility function shared with M09 S22; leak test on titles |
| SEC-M27-04 | Role confusion: platform admin opening the page (live gave a 500 through the picker). | 403 | role gate before any data access |
| SEC-M27-05 | The performance and risk aggregates of another school (or national totals) could leak through the owners' reads if the school argument were client-supplied or defaulted. | school forced from the session in every owner call | every owner call takes the session school only; test the cards, panels and grade list for school A against school B; counts are aggregates only, no pupil names on S0 |

---

## 12. E2E test scenarios

Projects: mobile 375x812, tablet 768x1024, desktop 1280x800; every scenario runs on all three unless stated. Clock `mockInit.now` = 2026-09-25T15:40:00+08:00. Session by the test fixture `loginAs(email)` (no UI login). **Oracle:** where a scenario says "oracle" the test reads the owner's own query for the same school (M02, M10, M08, M18) and asserts that the page equals it; no figure is pinned in M27. `@provisional` = asserts an INFERRED or PROPOSED item; excluded from the G5 gate until confirmed. `@blocked-by M09-T4` = needs `/perutusan`; `@blocked-by M05-T3` = needs `/dashboard`; `@blocked-by M18` = needs the M18 risk contract.

| ID | Scenario | FR | AC | Projects |
|---|---|---|---|---|
| E2E-M27-01 | `azlan@demo.test` at 1280: S0 in the user shell, "Dashboard" active, other HARIAN items not active; then on `/admin-sekolah/monitoring` the "Dashboard" item is present but not active. | 01, 02 | 01.1, 01.5 | 1280 |
| E2E-M27-02 `@provisional` | (PROPOSED, shell-owned breakpoint) At 375 and 768: no sidebar, hamburger opens the drawer with "Dashboard" active, no horizontal scroll. | 01, 02 | 01.2 | 375, 768 |
| E2E-M27-03 `@provisional` | Header title "Dashboard Sekolah" and subtitle "SMK Demo Seri Putra", tab "Dashboard Sekolah - PRESTASIPLUS"; avatar "AD", bell, logout, no chips. | 03, 04 | 01.3, 01.4 | 375, 768, 1280 |
| E2E-M27-04 | Banner of school 900003: name `textContent` "SMK Demo Seri Putra" with computed `text-transform: uppercase`, "Admin Sekolah" below the name, state chip "Selangor" and PPD chip "PPD HULU LANGAT" each with a leading icon, "# Kod: DMO0003"; chips and banner are not links (click changes nothing). | 19, 20 | 02.1, 02.2 | 375, 768, 1280 |
| E2E-M27-05 `@provisional` | `suhaimi@demo.test`: banner shows the state chip "Johor" only; no PPD chip, no "# Kod:", no placeholder text. | 21 | 02.3 | 375, 768, 1280 |
| E2E-M27-06 | `azlan@demo.test`: with the banner name element, the header subtitle, the Perutusan card and the grade rows removed, the remaining page text (case-sensitive) contains no other school name as a whole string ("SMK DEMO", "SK Demo"); `?school_id=900001` still shows 900003. | 09, 22 | 02.4, 07.5 | 375, 768, 1280 |
| E2E-M27-07 | `azlan@demo.test`: card heading and link; one row: "AD", title of M09 #4, "Pengetua · 6 bulan yang lepas". | 12, 13, 14 | 03.1 | 375, 768, 1280 |
| E2E-M27-08 | `suhaimi@demo.test`: one row #3, "SM"; `adminsekolah@demo.test`: one row #2, "SA"; both "Pengetua · 6 bulan yang lepas". | 13, 14 | 03.2 | 375, 768, 1280 |
| E2E-M27-09 | `azlan@demo.test`: titles of #2 and #3 absent from the DOM and from the endpoint response. | 15 | 03.3 | 375, 768, 1280 |
| E2E-M27-10 `@provisional` | School admin of school 8090: card header present, no row, no empty sentence. | 16 | 03.4 | 375, 768, 1280 |
| E2E-M27-11 `@provisional` | Admin posts four national perutusan (M09 endpoint #37): `azlan@demo.test` sees exactly 3 rows in M09 order. | 13 | 03.5 | 1280 |
| E2E-M27-12 | The Perutusan card's "Lihat semua →" is a link with target `/perutusan`. | 17 | 04.1 | 375, 768, 1280 |
| E2E-M27-13 `@provisional` `@blocked-by M09-T4` | Click "Lihat semua →": M09 list opens. | 17 | 04.2 | 375, 768, 1280 |
| E2E-M27-14 | Breadcrumb text, order between card and banner, "Dashboard Sekolah" bold and not a link. | 18 | 05.1, 05.3 | 375, 768, 1280 |
| E2E-M27-15 `@provisional` `@blocked-by M05-T3` | Click "← Papan Pemuka": URL `/dashboard` and M05 S1 renders for `school_admin` (no redirect, no 403). | 18 | 05.2 | 375, 768, 1280 |
| E2E-M27-16 | Four cards below the banner: order and visible labels "JUMLAH PELAJAR", "JUMLAH GURU", "KELAS AKTIF", "LANGGANAN", tints blue / teal / pink / (green or grey), icon tile at top-left with an icon element, foot bar, none is a link. | 23 | 06.1, 06.5 | 375, 768, 1280 |
| E2E-M27-17 | Guest on `/admin-sekolah` goes to `/login`. | 06 | 07.1 | 375, 768, 1280 |
| E2E-M27-18 | `admin@demo.test`, `guru@demo.test`, `pelajar@demo.test`: 403 page with the exact copy; no picker, no 500. | 07 | 07.2, 07.3 | 375, 768, 1280 |
| E2E-M27-19 | (hook per XR-M27-05) `school_admin` with null school: 403 page; no school name or perutusan in the DOM. | 08 | 07.4 | 375, 768, 1280 |
| E2E-M27-20 | `/admin-sekolah/pilih-sekolah` shows the 404 page copy. | 10 | 07.5 | 375, 768, 1280 |
| E2E-M27-21 | `GET /api/admin-sekolah/dashboard`: 401 guest, 403 admin, 403 no-school, 200 `azlan@demo.test` with school 900003, `cards`, `performance` and no other school's data. | 05, 06, 07, 08, 11 | 07.6 | request only (run once) |
| E2E-M27-22 | `azlan@demo.test`: no horizontal scroll; chips wrap at 375; cards 4 / 4 / 2 per row; panels 4 / 2 / 1 per row; grade list inside its card. | 23, 25 | 08.1, 08.3, 08.4 | 375, 768, 1280 |
| E2E-M27-23 | Every text node at least 12 px. | 26 | 08.2 | 375, 768, 1280 |
| E2E-M27-24 `@provisional` | Endpoint forced to 500: the M01 global error page shows. | 28 | 08.5 | 375, 768, 1280 |
| E2E-M27-25 | Sidebar "Dashboard" from another user-shell page opens S0; `/admin-sekolah/command-center` "← Dashboard" opens S0. | 29 | 09.1, 09.2 | 375, 768, 1280 |
| E2E-M27-26 | Cards values for the populated school and 900003: "JUMLAH PELAJAR", "JUMLAH GURU", "KELAS AKTIF" equal the M02 and M10 owner counts (oracle), `ms-MY` format; a second school admin of another school sees different values. | 24 | 06.2, 06.3 | 375, 768, 1280 |
| E2E-M27-27 `@provisional` | "LANGGANAN": `azlan@demo.test` "Belum Ada" in the grey card; `adminsekolah@demo.test` "Tempoh Ihsan" in the green card under test profile `subscriptions-extra` (`mock.reset({profile: 'subscriptions-extra'})`; default seed shows "Belum Ada"). | 30 | 06.4 | 375, 768, 1280 |
| E2E-M27-28 | Populated school: "GPS SEKOLAH" panel equals M08 GPS (2 decimals), the line "{grade} · {band}" with grade at round(GPS) and the M08 band, and "{n} entri headcount" = M08 `gps.entries` (oracle); panel label and tint. | 31, 32 | 10.1, 10.2 | 375, 768, 1280 |
| E2E-M27-29 `@blocked-by M18` | Populated school: "AMARAN AWAL" shows "Selamat", "Berhati", "Berisiko" equal to the M18 `Q-M18-RISK` tallies and "{n} murid dinilai" = the sum = the M18 S22 total (oracle). | 33 | 10.4 | 375, 768, 1280 |
| E2E-M27-30 | Populated school: "LATIHAN" shows "{p}%" (1 decimal), "Purata Ketepatan", "{n} sesi · {m} soalan" equal to M08 `stats` (oracle), with `ms-MY` separators. | 34 | 10.5 | 375, 768, 1280 |
| E2E-M27-31 | Populated school: "TINGKATAN" two rows "Tingkatan 4", "Tingkatan 5" with M08 level accuracy, colour per band and bar width, foot "Click untuk detail"; clicking the panel opens `/prestasi/tingkatan` (the click part `@provisional`). | 35 | 10.7, 11.2 | 375, 768, 1280 |
| E2E-M27-32 | Populated school: "Taburan Gred (Anggaran)" heading, grade list A+ … G with counts and percentages equal to M08 `distribution`, footer "Jumlah: {n} rekod" (list part `@provisional`, INFERRED); "Lihat penuh →" has target `/prestasi/sekolah` and opens M08 S1 for the school. | 36 | 10.8, 11.1 | 375, 768, 1280 |
| E2E-M27-33 `@provisional` | No-data school (a fixture with no headcount, no session): GPS "—" without the grade line and "0 entri headcount"; AMARAN "0", "0", "0", "0 murid dinilai" (after M18); LATIHAN "—" and "0 sesi · 0 soalan"; both level rows shown; grade list zeros and "Jumlah: 0 rekod". | 37 | 10.3, 10.6, 10.9 | 375, 768, 1280 |
| E2E-M27-34 | Consistency and scope: for the populated school the S0 GPS, entries, sessions, questions and accuracy equal the values on M08 S1 (same M08 query); the three count cards are not compared with M08 S1; signing in as a school admin of another school changes every figure; no figure is a platform total. | 36, 37 | 10.10, 11.3 | 375, 768, 1280 |

Static check **CHK-M27-01** (unit test, not E2E): scans M27-owned files only (M27 URS/SRS, `src/modules/m27-*`, `e2e/m27-*`). (a) No e-mail other than `@demo.test`, and fixtures are referenced by id, so no real person's name is present. (b) The screenshot's and the deck's school code, school name, post title and any deck figure are not hard-coded in those files: the scan list lives outside the repository (local file or environment variable; the check is skipped where it is absent), so the strings are never written to the repo. M02 school 8090 and the M09 seed #3 title in owner files are exempt and are not scanned (FR-M27-27, AC-M27-08.6, DL-7).

Totals: **34 E2E scenarios** (E2E-M27-21 is request-only; E2E-M27-01, 02 and 11 run on a subset of widths), of which **10 are `@provisional`** (02, 03, 05, 10, 11, 13, 15, 24, 27, 33; 13 is also blocked by M09-T4, 15 by M05-T3) and one is blocked by M18 (29), plus 1 static check.

---

## 13. Open questions

URS §9 is authoritative. Status:

| ID | Topic | Blocks |
|---|---|---|
| OQ-M27-01 | **Closed in v1.2 as SERVER-DECK** (cards, Ringkasan Prestasi); the part below "Taburan Gred (Anggaran)" remains: OQ-M27-11. | — |
| OQ-M27-02 | "← Papan Pemuka" target `/dashboard` (INFERRED); route not built (M05-T3, Session 8); M05 SRS §9 does not confirm the role list; XR-M27-04 (OQ-L07-04 stays open). | AC-M27-05.2 / E2E-M27-15 only (non-blocking) |
| OQ-M27-03 | Perutusan card: max rows (3 PROPOSED), order, row link, unread state, empty copy. | none |
| OQ-M27-04 | Tab title (PROPOSED); header is now SERVER-DECK. | none |
| OQ-M27-05 | Banner: capitals by CSS only (decided, INFERRED), chip and tile icon types (PROPOSED), chip omission. | none |
| OQ-M27-06 | Sidebar entries to unbuilt M27 screens open the 404 page until built (D-M27-02); the deck's older sidebar differs (live wins): shell decision. | none |
| OQ-M27-07 | `/perutusan` not built (M09-T4). | AC-M27-04.2 / E2E-M27-13 only |
| OQ-M27-08 | Delivery Lead to relabel L07 owner "M17 / M05" and build-plan R.1.3 wording. | none |
| OQ-M27-09 | `docs/design/shells.md` line 73 ("routes are in no SRS yet") is stale once M27 is approved: shell owner to refresh. | none |
| OQ-M27-10 | Null-school test hook (XR-M27-05, M02 FR-M02-27 bypass). | AC-M27-07.4 / E2E-M27-19 (build order) |
| OQ-M27-11 | What lies under "Taburan Gred (Anggaran)" on S0 (cut off in the deck); INFERRED: the M08 grade list. Anything further is unknown and not invented. | Final completeness of the Admin Sekolah part (EL-L07-07) |
| OQ-M27-12 | Each card follows its own owner definition; M08 S1 reads the same owner stores (M08 FR-M08-12; `performance.ts:218-230`), so values may coincide, never by tuning (DV-M27-07). Open for M10: which school link defines an active class (XR-M27-07). | none |
| OQ-M27-13 | "LANGGANAN" value for a subscribed school (live green, deck shows only "Belum Ada"): PROPOSED status wording; could be a package or a date. | none |
| OQ-M27-14 | M18 not built: the "AMARAN AWAL" panel is blocked by `Q-M18-RISK(schoolId)` (XR-M27-08). | AC-M27-10.4 / E2E-M27-29 only (build order) |

No open question blocks G2 design for the parts that are not behind a dependency; the AMARAN AWAL panel is built when M18 exposes its contract.

---

# Part B — S1 to S11 (roles-matrix rows L51–L58) — Software Requirements Specification

Added in v1.4 by Session 2 under D24. Part A (§0–§13) is S0 and is not changed. Ids continue after Part A. Source: [urs/M27-school-admin.md](../urs/M27-school-admin.md) Part B (§10–§17: 22 stories, 73 Functions, 99 acceptance criteria). Provenance tags as URS §10.0: LIVE (L), SERVER (S), SERVER-DECK (D), ANALOGUE (A), OWNER (O), PROPOSED (P), PROJECT RULE (R).

## 14. Scope, screens, routes

### 14.0 Status

Draft v1.4, ready for audit then G1; not yet audited. Part A keeps its own status. Discovery: [M27-admin-sekolah-screens.md](../../discovery/M27-admin-sekolah-screens.md).

### 14.1 Scope

**In scope:** S1 Statistik Penggunaan, S2 DSKP Heatmap, S3 Laporan Aktiviti, S4 Amaran Awal (route binding of the M18 school page), S5 Laporan Bulanan, S6 Senarai Pelajar, S7 Senarai Guru, S8 Kelas Sekolah, S9 Edit Pelajar, S10 Edit Guru, S11 Cipta Pengguna (guru); the read models and writes behind them (§19).

**Not in scope:** see URS §16 (other PENGURUSAN items, delete, Login As, IC, pupil activation, pupil creation, class creation, file exports other than S4 CSV and the S5 print, the picker).

**Owned data:** none (D12). M27 owns query code (`Q-M27-*`, §18.3) and the route layer; every store belongs to its owner: users and schools M01 and M02, classes and enrolments and DSKP M10, answers and sessions M05, SP records M08, activity report builders M17, early warning M18.

**Assumptions:** (1) clock 2026-09-25T15:40:00+08:00 (M09 §6.9, M17 BR-M17-01); (2) the user shell and the school-admin sidebar exist (`user-nav.ts`); (3) the global 403 and 404 pages exist (M01) and keep the texts of Part A §8.3; (4) M18 has only a route stub today, so S4 is built when M18 exposes its contracts (OQ-M27-25); (5) M08 S5 `/prestasi/kelas/{id}` is defined in the M08 SRS but its route is not yet in `prestasi.ts`.

### 14.2 Screens and routes

| # | Route | Screen | Actor | Shell · header | API (§19) |
|---|---|---|---|---|---|
| S1 | `/admin-sekolah/statistik-penggunaan` (`?period=today\|7days\|30days`) | Statistik Penggunaan | school admin | user · "Statistik Penggunaan" / school name | #2 |
| S2 | `/admin-sekolah/dskp-heatmap` (`?subjectId=&tingkatan=T4\|T5`) | DSKP Heatmap | school admin | user · "DSKP Heatmap" / school name | #3 |
| S3 | `/admin-sekolah/laporan-aktiviti` (`?range=7\|30\|90`) | Laporan Aktiviti | school admin | user · "Laporan Aktiviti" / school name | #4 |
| S4 | `/amaran/sekolah` (`?tingkatan=T4\|T5`) | Amaran Awal — Sekolah | school admin | user · "Amaran Awal — Sekolah" / school name | M18 #21, #22, #24, #30 |
| S5 | `/admin-sekolah/laporan-bulanan` (`?bulan=YYYY-MM`) | Laporan Bulanan | school admin | user · "Laporan Bulanan" / school name | #5 |
| S6 | `/admin-sekolah/pelajar` (`?is_active=&search=&page=`) | Senarai Pelajar | school admin | user · "Senarai Pelajar" / school name | #6 |
| S7 | `/admin-sekolah/guru` (`?is_active=&search=&page=`) | Senarai Guru | school admin | user · "Senarai Guru" / school name | #10, #14 |
| S8 | `/admin-sekolah/kelas` (`?level=&search=&page=`) | Kelas Sekolah | school admin | user · "Kelas Sekolah" / school name | #16 |
| S9 | `/admin-sekolah/pelajar/{id}` | Edit Pelajar | school admin | user · "Edit Pengguna" / "Kemaskini maklumat pengguna" | #7, #8, #9 |
| S10 | `/admin-sekolah/guru/{id}` | Edit Guru | school admin | user · "Edit Pengguna" / "Kemaskini maklumat pengguna" | #11, #13, #15 |
| S11 | `/admin-sekolah/guru/baru` | Cipta Pengguna | school admin | user · "Cipta Pengguna" / "Daftarkan akaun guru ke sekolah anda" (P) | #12 |

`{id}` is the M01 user integer id, digits only; any other string is the global 404. S11's path is registered before `{id}` so "baru" is never read as an id.

### 14.3 Link targets (checked 2026-10-03)

| From | Target | Exists? | Note |
|---|---|---|---|
| Sidebar items L51–L58 | the eight routes above | built by this part (the routes answered 302 or 404 on live; DV-M27-08, 09) | XR-M27-11 for the S4 href |
| Sidebar "Amaran Awal" | `/amaran/sekolah` | alias built by this part; M18 content not built | `user-nav.ts` today `/amaran` (M18 S16 class gateway); XR-M27-11, OQ-M27-18 |
| S4 "Keberkesanan Intervensi", "Ringkasan Eksekutif", "Muat Turun CSV" | `/amaran/keberkesanan`, `/amaran/ringkasan-eksekutif?scope=school&school_id={own}`, `/amaran/export/school/{own}` | M18 (not built) | dependency, OQ-M27-25 |
| S4 level pills | `/amaran/sekolah?tingkatan=T4\|T5` | this part | M18's own pills point to `/sekolah/{id}/amaran`; the alias keeps the school admin on the alias (P) |
| S6 name, "Edit" | `/admin-sekolah/pelajar/{id}` | this part | |
| S7 "Cipta Pengguna" | `/admin-sekolah/guru/baru` | this part | |
| S7 name, "Edit" | `/admin-sekolah/guru/{id}` | this part | |
| S8 class name | `/prestasi/kelas/{id}` | defined in M08 SRS S5, route not built | XR-M27-13, AC-M27-32.3 provisional |
| S9 to S11 "Batal" | S6 or S7 | this part | |
| 403 and 404 pages | `/`, `/login`, `/practice` | yes (M01) | Part A §8.3 |

---

## 15. Functional requirements

Columns: FN = URS function, AC = acceptance criterion numbers (AC-M27-{story}.{n}).

| ID | Requirement | FN | AC |
|---|---|---|---|
| FR-M27-38 | The eleven routes of §14.2 SHALL render in the user shell for a signed-in `school_admin` whose account has a school. (L route labels; D shell; P routes) | 2.2.3 | 13.3 |
| FR-M27-39 | A guest on any route of §14.2 SHALL be sent to `/login`; a guest on any `/api/admin-sekolah/*` endpoint SHALL get 401 `UNAUTHORIZED`. (A, Part A FR-M27-06) | 2.1.1 | 12.1, 12.6 |
| FR-M27-40 | A signed-in user whose role is not `school_admin` (platform admin, teacher, pupil, parent, sponsor, PPD, JPN) SHALL get the global 403 page "Akses Ditolak" in place on every route of §14.2, including `/amaran/sekolah`, and 403 `FORBIDDEN` from the endpoints. M18's own routes keep M18's access. (P, DL-1; L platform admin DV-M27-01) | 2.1.2 | 12.2, 12.6, 21.5 |
| FR-M27-41 | A `school_admin` with no school SHALL get the same 403 page and 403 from the endpoints; a missing school MUST NOT mean "all schools". (S `StaffScope.php:128-148`, `openedScopeOrAbort`) | 2.1.3 | 12.3, 12.6 |
| FR-M27-42 | The school of every query and write SHALL be the session user's `schoolId`. No `school`, `school_id`, `schoolId`, `role`, `kelas` or `isActive` value from path, query or body SHALL widen or change it; the role of S6 to S11 and the school of every write are fixed by the server. (S `listScopeSchoolId`, `resolveSchoolId`) | 2.1.4 | 12.4, 27.6, 29.6, 30.5 |
| FR-M27-43 | `GET`, `PUT` and `POST` on `/admin-sekolah/pelajar/{id}` and `/admin-sekolah/guru/{id}` (and endpoints #7 to #15 with `:id`) SHALL answer the global 404 page (API 404 `NOT_FOUND`) when the id does not exist, is not a user of the viewer's school, or is not of the page's role (a pupil id on the teacher route and a teacher id on the pupil route included). No 403 for object checks. (A M17 FR-M17-114, OQ-M17-13) | 2.1.5 | 12.5 |
| FR-M27-44 | The header title and sub-line SHALL be those of §14.2 (sub-line = M02 `name` of the school for S1 to S8); the tab title SHALL be "{title} - PRESTASIPLUS" (S4: "Amaran Awal — Sekolah \| PRESTASIPLUS"); S1 to S8 SHALL show no breadcrumb; S9 to S11 SHALL show "Batal" with the back arrow to their list as the form footer. (D header pattern; P tab title; A M02 footer) | 2.2.1, 2.2.2, 2.2.4 | 13.1, 13.2, 13.4 |
| FR-M27-45 | The sidebar item of a screen SHALL be active on its route and sub-routes: S1, S2, S3 their ANALITIK items; S4 "Amaran Awal" (also with `?tingkatan=`); S5 "Laporan Bulanan"; S6 and S9 "Senarai Pelajar"; S7, S10, S11 "Senarai Guru"; S8 "Kelas Sekolah"; "Dashboard" SHALL NOT be active on any of them. (L sidebar; P prefix rule) | 2.2.3 | 13.3 |
| FR-M27-46 | No screen SHALL scroll horizontally at 375 / 768 / 1280 px; every table SHALL scroll inside its card; no text below 12 px. (R, DV-M27-03; A M02 FR-M02-07) | 2.3.1, 2.3.2 | 14.1, 14.2, 14.3 |
| FR-M27-47 | No real person's name, IC number or password SHALL appear in docs, seeds, fixtures or pages; the pages SHALL render no IC; e-mail and phone SHALL appear only for users of the viewer's school. (R CLAUDE.md §6; S `UserDirectory` scope) | 2.3.3 | 14.4 |
| FR-M27-48 | While loading the screens SHALL show the shell's loading state; a server error SHALL show the M01 global error page; no M27 copy. (P, Part A FR-M27-28) | 2.3.4 | 14.5 |
| FR-M27-49 | Lists S6, S7 and S8 SHALL page 25 rows with the Laravel paginator wording of M02 FR-M02-18 ("Showing {from} to {to} of {total} results" at 640 px and above, "« Previous" / "Next »" below), hidden for one page, keeping the other query parameters. (A M02 S1) | 2.3.5 | 14.6, 26.3, 32.2 |
| FR-M27-50 | The unfiltered "Pelajar" total of S6, the unfiltered "Guru" total of S7 and the "Kelas Aktif" tile of S8 SHALL equal S0 "JUMLAH PELAJAR", "JUMLAH GURU" and "KELAS AKTIF" (BR-M27-12, 13), and the S4 tiles SHALL equal the S0 "AMARAN AWAL" panel, because they call the same owner queries. (P, D12) | 2.4.1 | 31.1, 33.1, 33.2, 33.3 |
| FR-M27-51 | S1 SHALL render the header, the pills "Hari Ini" (`period=today`), "7 Hari" (`7days`) and "30 Hari" (`30days`, default); a missing or unknown `period` SHALL give `30days`; the active pill is highlighted and every pill is a link. (L route, label; D header; A M18 S3, BR-M18-30) | 3.1.1, 3.1.2 | 15.1, 15.3 |
| FR-M27-52 | S1 SHALL show seven tiles in order "Pelajar", "Guru", "Pelajar Aktif" (sub-line "daripada {Pelajar}"), "Penglibatan" (sub-line "daripada pelajar daftar"), "Sesi Latihan", "Soalan Dijawab", "Purata Ketepatan". Counts use the `ms-MY` separator, "Penglibatan" an integer percent, "Purata Ketepatan" one decimal or "—". (L Panduan; S strip; D labels; A M17 sub-lines) | 3.1.3 | 15.1, 15.2 |
| FR-M27-53 | The S1 values SHALL follow BR-M27-21, 22: they are computed from the owners' stores for the window and equal the M05 and M02 school queries; a school without pupils SHALL show "Penglibatan" "0%". (S `SchoolAggregates`) | 3.1.4 | 15.2, 15.4 |
| FR-M27-54 | S1 SHALL show the card "Mengikut Mod Latihan" with the table "Mod", "Sesi", "Ketepatan Purata", one row per session label of BR-M27-23 with sessions in the window, ordered by sessions descending; "Sesi" sums to the tile "Sesi Latihan". (S mode split; O M05 S9 labels) | 3.2.1 | 16.1 |
| FR-M27-55 | With no completed session in the window S1 SHALL replace the card by the empty card: "Tiada data untuk tempoh ini" and "Tiada aktiviti latihan dalam tempoh 30 Hari yang lepas." (`7days`: "… 7 Hari …"); for `today` the text "Belum ada pelajar buat latihan hari ini. Cuba lihat 7 Hari atau 30 Hari." with "7 Hari" and "30 Hari" as links to `?period=7days` and `?period=30days`; the tiles stay (zeros, "—"). (A M18 S3 copy) | 3.2.2 | 16.2, 16.3 |
| FR-M27-56 | With no session in the window "Purata Ketepatan" SHALL read "—" and the footnote "Ketepatan dipaparkan sebagai “—” kerana belum ada sesi latihan direkodkan dalam skop ini." SHALL show; S1 SHALL have no export. (S footnote; P no export) | 3.2.2, 3.2.3 | 16.4 |
| FR-M27-57 | S1 SHALL load its data with `GET /api/admin-sekolah/usage?period=` (§19 #2). | 3.1.1 | 15.2 |
| FR-M27-58 | S2 SHALL show the header, the card heading "Peta DSKP — Standard Pembelajaran" with the `fa-map` icon and the caption "KSSM {Subjek} Tingkatan {n}". (L label; A M08 FR-M08-52) | 4.1.1 | 17.1 |
| FR-M27-59 | S2 SHALL show a GET filter card, submitting on change: select "Subjek" (`subjectId`; subjects with at least one SP at the chosen level; default the first by name; no "all" option) and level pills "Tingkatan 4" (default, `tingkatan=T4`) and "Tingkatan 5" (`T5`); an unknown value falls back to the default. (P; A M08 S8 pattern, M18 pill copy; D10 limit) | 4.2.1 | 18.1 |
| FR-M27-60 | S2 SHALL show one tile per SP of the chosen subject and level under a heading per Bidang ("{Bidang code} {Bidang name}"), Bidang and SP in M10 code order; a tile shows the SP code and, when answered, the percentage. (S grouping; O M10 `dskp`) | 4.1.2 | 17.2 |
| FR-M27-61 | A tile's value SHALL follow BR-M27-24 (pooled accuracy of the school's pupils); status "Mahir" (green) at 75 and above, "Sederhana" (yellow) from 50 to 74, "Lemah" (red) below 50, "Belum cuba" (slate, no value) without answers, judged on the shown integer. (A M08 colours; P pooling) | 4.1.3 | 17.3 |
| FR-M27-62 | S2 SHALL show the legend "Mahir (75%+)", "Sederhana (50-74%)", "Lemah (<50%)", "Belum Cuba". (A M08 FR-M08-52) | 4.1.4 | 17.1 |
| FR-M27-63 | A tile SHALL have `title` "{code}: {title} — {Mahir\|Sederhana\|Lemah\|Belum cuba}" followed by " · {n} cuba · {p}% betul" when answered; tiles are not links. (A M08 FR-M08-52, R10 cell copy; P) | 4.1.5 | 17.4 |
| FR-M27-64 | A subject and level without SP SHALL show "Tiada Standard Pembelajaran untuk subjek dan tingkatan ini."; a school with no SP record for the subject SHALL show every tile "Belum cuba" without a percentage and without an error. (P) | 4.2.2 | 18.2, 18.3 |
| FR-M27-65 | S2 SHALL load its data with `GET /api/admin-sekolah/dskp-heatmap` (§19 #3); the values change with the school and are never a platform total. | 4.1.3 | 18.4 |
| FR-M27-66 | S3 SHALL show the header, the range pills "7 Hari" (`range=7`), "30 Hari" (`range=30`, default) and "3 Bulan" (`range=90`); any other value gives 30. | 5.1.1 | 19.1, 19.5 |
| FR-M27-67 | S3 SHALL show the tabs "Overview" (default), "Guru ({n})" and "Murid ({n})" with `fa-chart-pie`, `fa-chalkboard-teacher` and `fa-user-graduate`, switching client-side; the tab "Sekolah ({n})" SHALL NOT be rendered. (A M17 FR-M17-86; DV-M27-13) | 5.1.2 | 19.1 |
| FR-M27-68 | The Overview SHALL show the cards "Murid Pernah Login", "Cikgu Pernah Login", "Murid Buat Latihan" and "Jumlah Aktiviti" with the M17 values and sub-lines restricted to the school (M17 FR-M17-88, 89); the card "Skor Purata" and its chip "Struktur" SHALL NOT be rendered; the card row is 2 per row at 375 and 4 at 768 and 1280. (A M17; DV-M27-13) | 5.1.3 | 19.2, 19.3 |
| FR-M27-69 | The Overview SHALL show "Trend Aktiviti", "Pecahan Aktiviti" ("Kuiz Objektif", "Soalan Berstruktur", "Battle Arena", "Permainan"), "Pelajar Paling Aktif" (at most 10) and "Cikgu Belum Login" (at most 20, name A to Z with e-mail), computed by the M17 builders (M17 FR-M17-90…92) and confined to the school. (A M17; S) | 5.1.4 | 19.4 |
| FR-M27-70 | The words "keseluruhan platform" and "seluruh platform" SHALL NOT appear on S3. (A M17 FR-M17-106; S server test) | 5.1.5 | 19.3 |
| FR-M27-71 | The Guru tab SHALL show the heading "Senarai Guru ({n})", the pills "Semua", "Pernah Login ({n})", "Belum Login ({n})", the search "Cari guru...", the tiles "Jumlah Guru", "Pernah Login", "Jumlah Soalan", "Jumlah Syiling" and the table "#", "Nama" (with e-mail line), "Login" ("Ya" / "Belum"), "MCQ", "Struktur", "Syiling", "Headcount", "Login Terakhir"; no "Sekolah" column and no school select. (A M17 FR-M17-93; P) | 5.2.1 | 20.1 |
| FR-M27-72 | The Murid tab SHALL show the heading "Senarai Murid ({n}) — Top 200", the pills "Semua", "Aktif", "Login Sahaja", "Belum Login" (each lists its pupils, up to 200), the search "Cari murid...", the tiles "Jumlah Murid", "Pernah Latihan", "Jumlah Sesi", "Purata Ketepatan" and the table "#", "Nama", "Kelas", "Sesi", "Ketepatan", "Masa", "Syiling", "Login Terakhir"; no "Sekolah" column and no school select; a search with no match shows no rows. (A M17 FR-M17-95; P) | 5.2.2 | 20.2, 20.3 |
| FR-M27-73 | S3 SHALL load its data with `GET /api/admin-sekolah/laporan-aktiviti?range=` (§19 #4), the M17 `StatsReport` builders with the school restriction (BR-M27-26). | 5.1.1 | 19.2 |
| FR-M27-74 | `/amaran/sekolah` SHALL render the M18 S22 content (FR-M18-82) for the session school and be the target of the sidebar item "Amaran Awal" for `school_admin`; M18's own routes (`/amaran`, `/amaran/sekolah/{id}`, `/sekolah/{id}/amaran`) are unchanged. (D URL; O M18) | 6.1.1 | 21.1, 21.4 |
| FR-M27-75 | S4 SHALL show the pills "Semua Tingkatan" (active, `/amaran/sekolah`), "Tingkatan 4" (`?tingkatan=T4`), "Tingkatan 5" (`T5`), the tiles "Jumlah Pelajar", "On Track", "Perlu Perhatian", "Berisiko Tinggi" and the card "Taburan Risiko Seluruh Sekolah" (stacked bar with integer percent per segment; "Hijau: {n}", "Kuning: {n}", "Merah: {n}"), all equal to `Q-M18-RISK(schoolId)`; with a level only pupils in classes of that level count. (D; A M18 FN-M18-4.6.1–4.6.3) | 6.1.2, 6.1.3 | 21.1, 21.2, 22.5 |
| FR-M27-76 | S4 SHALL show the card "Analisis Risiko Mengikut Subjek" (rows "{Subjek}" and "{w}/{m} pelajar lemah ({p}%)", BR-M18-16) when the school has data, and the card "Senarai Pelajar Berisiko" ("Disusun mengikut skor risiko tertinggi"; columns "#", "Pelajar", "Tingkatan / Kelas", "Skor", "Status", "Ketepatan", "Penglibatan", "Penguasaan"; order BR-M18-22). (D; A M18 FN-M18-4.6.5, 4.6.6) | 6.1.4 | 21.3 |
| FR-M27-77 | S4 SHALL show the buttons "Keberkesanan Intervensi" (`fa-chart-pie`, `/amaran/keberkesanan`), "Ringkasan Eksekutif" (`fa-file-alt`, `/amaran/ringkasan-eksekutif?scope=school&school_id={own id}`) and "Muat Turun CSV" (`fa-download`, `/amaran/export/school/{own id}`), in that order. (D; L/A M18 FN-M18-4.6.4) | 6.2.1 | 22.1 |
| FR-M27-78 | The CSV SHALL be named `amaran-sekolah-{id}-{yyyymmdd}.csv`, hold M18's columns for the school's pupils only (no IC, e-mail or phone, CSV-injection guard) and a foreign school id or class id on M18's routes SHALL be refused as M18 FR-M18-09 defines for a school admin (403). (O M18 §7.2) | 6.2.2 | 22.2, 22.3 |
| FR-M27-79 | A school without pupils SHALL show the tiles "0", the bar without segments and no list rows, without an error. (P) | 6.2.3 | 22.4 |
| FR-M27-80 | S4 SHALL call M18 #21, #22, #24 and #30 with the session school id and add no M27 endpoint (D12). | 6.1.1 | 21.2 |
| FR-M27-81 | S5 SHALL show the header, the heading "Laporan {Bulan} {yyyy}" (BM month names), the previous-month link "← {Bulan} {yyyy}" and, only while the shown month is before the current month, the next-month link "{Bulan} {yyyy} →"; `?bulan=YYYY-MM`, an invalid or future value gives the current month. (L label; A M17 FN-M17-6.1.3, DV-M17-14; P) | 7.1.1 | 23.1, 23.3 |
| FR-M27-82 | S5 SHALL show four cards for the shown month: "Penglibatan" ("{p}%", sub-line "{n} aktif / {n} daftar"), "Soalan Dijawab" ("{n}", "{x} soalan/pelajar", rounded integer), "Ketepatan" ("{p}%" one decimal, or "—"), "Sesi Latihan" ("{n}"), per BR-M27-28. (A M17 FN-M17-6.4.2; P) | 7.1.2 | 23.2 |
| FR-M27-83 | A month without answers SHALL show the cards "0%", "0", "—", "0" and omit every section below the cards. (A M17 FN-M17-6.3.11; P) | 7.1.3 | 23.4 |
| FR-M27-84 | S5 SHALL show the card "Statistik Bulanan" with the subtitle "12 bulan terakhir — pecahan prestasi mengikut bulan" and the table "Bulan", "Soalan Dijawab", "Soalan Betul", "Pelajar Aktif", "Purata/Pelajar", "Accuracy": one row per month with sessions among the 12 months ending with the shown month; with more than one row the footer "Jumlah" (sums, "—", "—", pooled accuracy); empty "Tiada data" / "Tiada aktiviti direkodkan buat masa ini". (A M18 FN-M18-2.9.6) | 7.2.1 | 24.1, 24.2 |
| FR-M27-85 | S5 SHALL show the card "Prestasi Mengikut Subjek" for the shown month: the boxes "SUBJEK TERKUAT" and "SUBJEK PERLU PERHATIAN" ("{subjek}", "{p}% ({n} soalan)") and one row per subject ("{subjek}", "{p}% · {n} soalan · {n} pelajar"), per BR-M27-29. (A M17 FN-M17-6.4.4, 6.3.5; S) | 7.2.2 | 24.3 |
| FR-M27-86 | S5 SHALL show the footer "Laporan dijana: {d MMM yyyy, hh:mm AM\|PM} · PrestasiPlus" (request minute, MYT) and the button "Cetak / PDF" (`window.print()`). (A M17 FN-M17-6.4.6, M18 FN-M18-4.7; P) | 7.2.3 | 24.4 |
| FR-M27-87 | S5 SHALL load its data with `GET /api/admin-sekolah/laporan-bulanan?bulan=` (§19 #5). | 7.1.1 | 23.2 |
| FR-M27-88 | S6 SHALL show the header and three cards "Pelajar", "Aktif", "Tidak Aktif" (M02 counts of the school's pupils, unaffected by the filters). (L label; A M02 FR-M02-02; S `roleStats`) | 8.1.1 | 25.1 |
| FR-M27-89 | S6 SHALL show a GET filter card with "Status" (`is_active`: "Semua", `1` "Aktif", `0` "Tidak Aktif"), "Cari" (`search`, placeholder "Nama atau emel...", name or e-mail, case-insensitive) and the submit "Cari"; no role, school or class control; controls initialised from the URL. (A M02 FR-M02-03; S) | 8.1.2, 2.1.4 | 26.1, 12.4 |
| FR-M27-90 | The S6 table SHALL have the columns "#", "Nama" (initials avatar, name), "Emel", "Telefon" (or "-"), "Tingkatan", "Kelas", "Aktif?", "Tarikh" (`dd/mm/yyyy`), "Tindakan", with the values of BR-M27-36; the row number is `meta.from` + index. (A M02 FR-M02-06; P) | 8.1.3 | 25.2, 25.3 |
| FR-M27-91 | S6 SHALL order active pupils first, then newest id first, 25 per page. (S `UserDirectory::paginate`) | 8.1.4 | 26.2, 26.3 |
| FR-M27-92 | The "Aktif?" cell of S6 SHALL be a read-only badge ("Aktif" emerald, "Tidak" red); for an active pupil the name SHALL link to S9 and "Edit" (`fa-edit`, `title="Edit"`) SHALL show; for an inactive pupil neither SHALL show; no row with no pupil: one full-width row "Tiada pengguna dijumpai" and "Cuba ubah kriteria carian anda"; S6 SHALL have no "Import Pelajar", "Tambah", delete, Login As or checkbox control. (A M02 FR-M02-08/19; S `canManageAccount`; P) | 8.1.5, 8.1.6 | 25.4, 25.5 |
| FR-M27-93 | S6 SHALL load its data with `GET /api/admin-sekolah/pelajar` (§19 #6). | 8.1.1 | 25.1 |
| FR-M27-94 | S9 SHALL show the profile card (generated initials avatar, name, e-mail, "Daftar: {dd/mm/yyyy}", "Kemaskini: {dd/mm/yyyy HH:mm}") and the form "Nama *", "Emel *", "No. Telefon (Pilihan)", the read-only line "Status" "Aktif", the footer "Batal" and "Kemaskini"; no role, school, grade or IC field. (A M02 FR-M02-37…44; P) | 8.3.1 | 27.1 |
| FR-M27-95 | S9 SHALL show the amber bar "Reset Kata Laluan" / "Klik untuk buka bahagian reset kata laluan" (`fa-key`) toggling "Kata Laluan Baru" ("Minimum 6 aksara"), "Sahkan Kata Laluan Baru" ("Taip semula kata laluan baru") and the hint "Kosongkan jika tidak mahu tukar kata laluan. Kata laluan baru akan berkuat kuasa serta-merta."; a valid new password SHALL be stored by M02 at once (BR-M27-34). (L Panduan label; A M02 FR-M02-43) | 8.3.2 | 27.4 |
| FR-M27-96 | S9 for an inactive pupil SHALL answer the 403 page and the endpoints 403; the school admin cannot edit or reset an inactive account. (S `canManageAccount`, decision of 22 Sep) | 8.3.3 | 27.5 |
| FR-M27-97 | "Kemaskini" on S9 SHALL save through the M02 validation (name, e-mail unique, phone, password rules of M02 §5); success returns to S6 with the flash "Pengguna berjaya dikemaskini." (UNVERIFIED COPY of M02); `role`, `schoolId`, `isActive`, `grade` and `icNumber` in the body SHALL be ignored. (A M02 FR-M02-46) | 8.3.4 | 27.2, 27.3, 27.6 |
| FR-M27-98 | S9 SHALL use `GET /api/admin-sekolah/pelajar/:id`, `PUT …/:id` and `POST …/:id/reset-password` (§19 #7 to #9). | 8.3.1 | 27.2 |
| FR-M27-99 | S7 SHALL show the header, three cards "Guru", "Aktif", "Tidak Aktif" (M02 counts of the school's teachers, unaffected by the filters) and the button "Cipta Pengguna" (`fa-user-plus`) to `/admin-sekolah/guru/baru`. (L label, Panduan; A M02 FR-M02-05) | 9.1.1 | 28.1, 30.1 |
| FR-M27-100 | S7 SHALL have the filter card, order, 25 per page, empty row and paginator of S6 (FR-M27-89, 91, 92 empty row, 49). | 9.1.2, 9.1.5 | 28.4, 28.5 |
| FR-M27-101 | The S7 table SHALL have the columns "#", "Nama" (initials avatar, name), "Emel", "Telefon", "Kelas", "Login Terakhir", "Aktif?", "Tarikh", "Tindakan", with the values of BR-M27-36; the name links to S10 and "Edit" shows only for an active teacher. (A M02 S1, M18 S9, M11 S3; P) | 9.1.3 | 28.2, 28.3 |
| FR-M27-102 | The "Aktif?" cell of S7 SHALL be a form button as M02 FR-M02-08 (active: emerald "Aktif" with `fa-check-circle`; inactive: red "Tidak" with `fa-times-circle`); on submit the native `confirm('Pasti untuk menukar status pengguna ini?')`; accept switches the status of that teacher through `POST /api/admin-sekolah/guru/:id/toggle-active` and reloads the list at the same URL with the flash "Status pengguna berjaya dikemaskini." (UNVERIFIED COPY of M02); an inactive teacher can be switched back to "Aktif". (L Panduan; A M02; DV-M27-10) | 9.1.4 | 29.4, 29.5 |
| FR-M27-103 | S7 SHALL load its data with `GET /api/admin-sekolah/guru` (§19 #10). | 9.1.1 | 28.1 |
| FR-M27-104 | S10 SHALL show the profile card and the form "Nama *", "Emel *", "No. Telefon (Pilihan)", the "Reset Kata Laluan" bar of FR-M27-95 and the footer "Batal", "Kemaskini"; no role, school, password-open or switch control. (A M02 S3; L Panduan) | 9.2.1 | 29.1, 29.3 |
| FR-M27-105 | S10 for an inactive teacher SHALL answer 403 and the list SHALL show no link or "Edit" for it; the teacher can be reactivated from S7. (S `canManageAccount`; L Panduan) | 9.2.2 | 29.5 |
| FR-M27-106 | "Kemaskini" on S10 SHALL save as FR-M27-97 and return to S7; `role`, `schoolId`, `isActive` in the body SHALL be ignored; a school admin id or a teacher of another school SHALL answer 404 (FR-M27-43). | 9.2.1 | 29.2, 29.6 |
| FR-M27-107 | S10 SHALL use endpoints #11, #13, #14 and #15 (§19). | 9.2.1 | 29.2 |
| FR-M27-108 | S11 SHALL show the card "Borang Pendaftaran Pengguna" / "Isi maklumat untuk mendaftarkan pengguna baru", the read-only role "Guru", the locked school label (school name and meta "{code} · {district} · {state}" without empty parts), the fields "Nama *", "Emel *", "No. Telefon (Pilihan)", "Kata Laluan *" ("Minimum 6 aksara"), "Sahkan Kata Laluan *" ("Taip semula kata laluan") and the footer "Batal" and "Daftar Pengguna"; no school search, no role select. (L Panduan; A M02 FR-M02-20…36; S locked `SchoolPicker`) | 9.3.1 | 30.2 |
| FR-M27-109 | "Daftar Pengguna" SHALL create through M02 a user with role `teacher`, the viewer's school and `isActive = true`, with the M02 validation (name, e-mail unique, passwords); success returns to S7 with "Pengguna berjaya didaftarkan." (UNVERIFIED COPY of M02) and the teacher listed; `role`, `schoolId`, `isActive` in the body SHALL be ignored. (S `importableRoles`, `resolveSchoolId`; P active) | 9.3.2 | 30.3, 30.4, 30.5 |
| FR-M27-110 | S11 SHALL use `POST /api/admin-sekolah/guru` (§19 #12). | 9.3.2 | 30.3 |
| FR-M27-111 | S8 SHALL show the header, the tile "Kelas Aktif" (BR-M27-35, equal to the S0 card) and the line "{n} kelas dipaparkan" (rows matching the filters). (L label; D card; A M18 FN-M18-2.9.10) | 10.1.1 | 31.1 |
| FR-M27-112 | The S8 table SHALL have the columns "#", "Kelas" (name), "Subjek" ("Tiada Subjek" when none), "Tingkatan" ("Tingkatan n" / "Darjah n"), "Guru" (name or "—"), "Murid", "Kod Kelas" (or "—"); an inactive class carries the badge "Tidak Aktif". (A M18 S9, M10 S4, M08 S3; P) | 10.1.2 | 31.2 |
| FR-M27-113 | S8 SHALL list the M10 classes of the viewer's school of both kinds (`classroom` and `school_class`); a `school_class` row has Guru "—" and Kod Kelas "—"; no class of another school appears. (P; O M10 DATA-M10-01) | 10.1.3 | 31.3, 31.5 |
| FR-M27-114 | S8 SHALL have the filter card with "Tingkatan / Darjah" (`level`: "Semua" and the levels the school has) and "Cari" (`search`, placeholder "Cari kelas...", class name, case-insensitive); order by class name A to Z; 25 per page; empty "0 kelas dipaparkan", "Tiada kelas dijumpai" and "Sila cipta kelas terlebih dahulu". (A M18 FN-M18-2.9.3, 2.9.10; P) | 10.1.4 | 31.4, 32.1, 32.2 |
| FR-M27-115 | The class name of a `classroom` row SHALL link to `/prestasi/kelas/{id}` (M08 S5); a `school_class` row SHALL be plain text. (A M08 S3) | 10.2.1 | 32.3 |
| FR-M27-116 | S8 SHALL load its data with `GET /api/admin-sekolah/kelas` (§19 #16). | 10.1.1 | 31.2 |

Count: **79 FRs** (FR-M27-38…116). Every Function of URS §11 is covered by at least one FR.

### 15.1 Traceability (US to FR to E2E)

| Story | FR | E2E |
|---|---|---|
| US-M27-12 | 39, 40, 41, 42, 43 | 35, 36, 37, 38, 39, 40 |
| US-M27-13 | 38, 44, 45 | 41, 42 |
| US-M27-14 | 46, 47, 48, 49 | 43, 44, 45, 46 |
| US-M27-15 | 51, 52, 53, 57 | 48, 49, 50, 51 |
| US-M27-16 | 54, 55, 56 | 52, 53, 54, 55 |
| US-M27-17 | 58, 60, 61, 62, 63 | 56, 57, 58, 59 |
| US-M27-18 | 59, 64, 65 | 60, 61, 62 |
| US-M27-19 | 66, 67, 68, 69, 70, 73 | 63, 64, 65, 66 |
| US-M27-20 | 71, 72 | 67, 68 |
| US-M27-21 | 74, 75, 76, 80 | 69, 70, 71, 72 |
| US-M27-22 | 77, 78, 79 | 73, 74, 75, 76 |
| US-M27-23 | 81, 82, 83, 87 | 77, 78, 79 |
| US-M27-24 | 84, 85, 86 | 80, 81, 82 |
| US-M27-25 | 88, 90, 92, 93 | 83, 84 |
| US-M27-26 | 89, 91, 49 | 85, 46 |
| US-M27-27 | 94, 95, 96, 97, 98 | 86, 87, 88, 89 |
| US-M27-28 | 99, 100, 101, 103 | 90, 91 |
| US-M27-29 | 102, 104, 105, 106, 107 | 92, 93, 94 |
| US-M27-30 | 108, 109, 110 | 95 |
| US-M27-31 | 111, 112, 113, 116 | 96, 97 |
| US-M27-32 | 114, 115, 49 | 98, 99, 46 |
| US-M27-33 | 50 | 47 |

---

## 16. Business rules

| ID | Rule | Source |
|---|---|---|
| BR-M27-19 | **School scope.** The school of S1 to S11 is the session user's `schoolId`; null is a 403, never "all"; no request parameter overrides it (same as BR-M27-01). Users are those with that `schoolId`, whatever their enrolment. | S (`StaffScope.php:128-148`) / BR-M27-01 |
| BR-M27-20 | **Access.** Only role `school_admin` passes on S1 to S11 and on `/amaran/sekolah`; every other signed-in role gets 403 in place; a guest goes to `/login` (same as BR-M27-02). | DL-1 / I |
| BR-M27-21 | **Periods (S1).** `today` = 00:00 MYT to now; `7days` = the last 7 × 24 h; `30days` = the last 30 × 24 h (default); missing or unknown gives `30days` (M18 BR-M18-30). | A / O |
| BR-M27-22 | **S1 definitions.** Pelajar = users with role `student` and the school, active or not (BR-M27-12); Guru = role `teacher` and the school; Pelajar Aktif = distinct pupils with at least one answer whose `answeredAt` is in the window (M17 BR-M17-05 engaged; "logging in is not activity", `SchoolAggregates`); Penglibatan = `Pelajar > 0 ? round(aktif ÷ Pelajar × 100) : 0`; Sesi Latihan = completed sessions with `completedAt` in the window; Soalan Dijawab = answers in the window; Purata Ketepatan = mean over those sessions of `correctCount ÷ questionCount × 100` (sessions with `questionCount` 0 skipped, M05 Q-SESS-MEAN-ACC) with one decimal, "—" without a session. | S `SchoolAggregates`; O M05 |
| BR-M27-23 | **Mode rows (S1).** Sessions are grouped by the M05 S9 label of their `mode`: `random`, `past_year`, `latih_tubi`, `mission`, `remedial`, `question_set` "Latihan"; `chapter` "Bab"; `revision` "Ulang Kaji"; `ramalan` "Tracking A"; `pksk` "PKSK"; "Ketepatan Purata" = mean of the group's session accuracies, one decimal; rows with sessions only, by sessions descending, ties by label. | S mode split; O M05 §6 (S9 types) |
| BR-M27-24 | **DSKP value (S2).** For SP `p`, answered = Σ `answered` and correct = Σ `correct` of the M08 SpRecords of the school's pupils (role `student`, `schoolId`, active or not) for `p`; percent = `answered > 0 ? round_half_up(100 × correct ÷ answered) : null`; status on the rounded integer: `null` "Belum cuba", `≥ 75` "Mahir", `≥ 50` "Sederhana", else "Lemah" (the number shown and the label never contradict). Pooled over answers, not the mean of pupil percentages. | P (D23); O M08 DATA-M08-04, FR-M08-52 |
| BR-M27-25 | **DSKP structure (S2).** Bidang, SK and SP come from the M10 `dskp` repository (`bidang({subjectId, educationLevelId})`, `sk`, `sp`); levels are T4 and T5 (D10, as M08 S2); subjects = those with at least one SP at the level; default subject = first by name; a pupil's SpRecord for an SP outside the chosen level is ignored. | O M10 DATA-M10-10; P |
| BR-M27-26 | **Activity report (S3).** Every figure, list and count is the M17 definition (M17 BR-M17-04, 05, 20, 22 and Q-M17-*) restricted to the school's pupils P and teachers T: P = students of the school, T = teachers of the school; "Pernah Login" = `lastLoginAt` not null; "Buat Latihan" = P with a completed session or structured attempt in the range; lists use the M17 orders and limits (top 10, first 20, up to 200). Fixture-school exclusion of M17 BR-M17-02 does not apply when the school is the session school. Items whose only source is a platform display constant (DC-M17-06 "Skor Purata", "Struktur") are not rendered; the "Syiling" and "Headcount" cells use M17's row builder for the user. | O M17; P |
| BR-M27-27 | **Amaran Awal (S4).** Risk score, status, weakness and order are M18 BR-M18-13, 14, 16, 22 evaluated for `schoolId` from the session; the server's binary teacher-class rule is not used; `/amaran/sekolah` takes no id; foreign ids on M18 routes follow M18 FR-M18-09 (403). | O M18; D |
| BR-M27-28 | **Month report (S5).** The month is a calendar month in Asia/Kuala_Lumpur; `bulan` must match `YYYY-MM` and not be after the current month, else the current month. Penglibatan = round(distinct pupils with an answer in the month ÷ Pelajar × 100), 0 with no pupil, sub-line "{aktif} aktif / {Pelajar} daftar"; Soalan Dijawab = answers in the month, "{x} soalan/pelajar" = round(answers ÷ aktif), 0 with no active pupil; Ketepatan = correct ÷ answers × 100, one decimal, "—" without an answer; Sesi Latihan = completed sessions in the month. "Statistik Bulanan" per month: answers, correct, distinct pupils with an answer, Purata/Pelajar = answers ÷ active pupils (one decimal), Accuracy = correct ÷ answers (one decimal); months with no answer are not listed; footer "Jumlah" = Σ answers, Σ correct, "—", "—", pooled accuracy. | A M17 S9, M18 S9; P |
| BR-M27-29 | **Subject performance (S5).** Per subject with answers in the month: accuracy = correct ÷ answers, one decimal, `n` = answers, pupils = distinct pupils. "SUBJEK TERKUAT" = highest accuracy, "SUBJEK PERLU PERHATIAN" = lowest; ties by more answers, then subject id; with one subject both boxes show it. Rows ordered by accuracy descending. | A M17 FN-M17-6.4.4; S `LaporanEksekutifController` |
| BR-M27-30 | **User lists (S6, S7).** Role is fixed (`student` on S6, `teacher` on S7), school fixed; a school admin never lists peers or other roles; `is_active` accepts `1` and `0`, anything else = all; `search` matches name or e-mail, case-insensitive substring; counts of the cards ignore the filters; order active first, then id descending; 25 per page. | S `UserDirectory`, `StaffScope` `onlyRoles` |
| BR-M27-31 | **Account management (S9, S10).** The school admin may edit name, e-mail and phone and reset the password of a pupil (S9) or teacher (S10) of the own school only while the account is active; never a peer school admin or any other role; no change of role or school. | S `canManageAccount` (lines 195-215), `canChangeRole` |
| BR-M27-32 | **Teacher activation.** The school admin may switch `isActive` of a teacher of the own school in either direction (Panduan: "aktif/nyahaktif akaun guru"); pupils' status is read-only; an inactive account cannot sign in (M01 BR-23). The server rule "national admin only" is not followed (DV-M27-10). | L Panduan; S conflict, live wins |
| BR-M27-33 | **Teacher creation (S11).** Role `teacher`, `schoolId` = the session school, `isActive = true`, name, e-mail, optional phone and the password pair validated as M02 S2 (e-mail unique, password at least 6 characters and equal to its confirmation); no IC, no grade, no package. | S `importableRoles`, `resolveSchoolId`; P active |
| BR-M27-34 | **Password reset.** A valid new password replaces the stored hash through M01 at once; it is never shown again; the previous password stops working; no e-mail is sent. | A M02 FR-M02-43; P |
| BR-M27-35 | **Classes (S8).** The rows are `classrooms.list({schoolId})` of M10 (both kinds); "Kelas Aktif" = `classrooms.list({isActive: true, schoolId})` count (BR-M27-13); Murid = `memberCount(kind, id)` (active enrolments, which may include pupils of another school; no equality with S6 is required); Guru = the owner's name for `classroom`, none for `school_class`; Kod Kelas = `joinCode` for `classroom`; level label from `educationLevel` ("tingkatan-n" to "Tingkatan n", "tahun-n" to "Darjah n"); level filter options = levels present. | O M10 DATA-M10-01/02; P |
| BR-M27-36 | **Column values (S6, S7).** Tingkatan (S6) = `grade` 7 to 11 "Tingkatan 1…5", 1 to 6 "Darjah 1…6", null "-"; Kelas (S6) = names of the pupil's active enrolments of both kinds joined by ", ", "-" when none; Kelas (S7) = "{n} kelas" with n = active classes owned by the teacher (M10 `forTeacher`), "-" when 0; Login Terakhir (S7) = the M17 relative time of `lastLoginAt` (BR-M17-20) or "Belum login"; Tarikh = `createdAt` as `dd/mm/yyyy`; phone "-" when empty. | A M02 FR-M02-06, M17 BR-M17-20, M10 |
| BR-M27-37 | **Coherence with S0.** Totals of S6, S7, S8 and S4 use the same owner calls as BR-M27-12, 13, 16; no value is tuned or cached separately. | D12 |
| BR-M27-38 | **Writes.** Only S9, S10 and S11 write, and only through the M02 and M01 contracts (XR-M27-17, 18); M27 handlers never touch the users store directly. Every other screen is read-only and opening it records nothing. | D12 |
| BR-M27-39 | **Formats.** Dates `dd/mm/yyyy`; times in Asia/Kuala_Lumpur; relative time per M17 BR-M17-20; counts `ms-MY`; BM month names Januari, Februari, Mac, April, Mei, Jun, Julai, Ogos, September, Oktober, November, Disember. | R / O |

Count: **21 BRs** (BR-M27-19…39).

---

## 17. Validation rules

| Input | Rule | Invalid or unknown gives |
|---|---|---|
| `period` (S1) | `today`, `7days`, `30days` | `30days` |
| `subjectId`, `tingkatan` (S2) | a subject with SP at the level; `T4` or `T5` | the default subject and level |
| `range` (S3) | `7`, `30`, `90` | `30` |
| `tingkatan` (S4) | `T4`, `T5` | all levels |
| `bulan` (S5) | `YYYY-MM`, not after the current month | the current month |
| `is_active` (S6, S7) | `1`, `0` | all |
| `search` (S6, S7, S8) | any text, trimmed, case-insensitive | no rows if no match |
| `level` (S8) | one of the school's levels | all |
| `page` (lists) | integer ≥ 1 | page 1 (beyond the last page: the last page) |
| `{id}` (S9, S10, #7 to #15) | digits, user of the school and of the page's role | 404 |
| `school`, `school_id`, `schoolId`, `role` on any request | ignored | — |
| S9, S10 form | `name` required, at most 255; `email` required, valid, unique among users except itself; `phone` optional, at most 14; new password at least 6 characters and equal to its confirmation (M02 §5 messages) | red alert above the form with one line per error, values kept, passwords cleared |
| S11 form | the same, plus `password` required | as above |
| Body keys `role`, `schoolId`, `isActive`, `grade`, `icNumber` | ignored | — |

---

## 18. Data entities, queries, seeds, requests to owners

### 18.1 Referenced entities (owners, not redefined)

| Figure or list | Entity and contract | Owner |
|---|---|---|
| Session user, school, role label | `UserMe` (`id`, `role`, `schoolId`, `school`) | M01 |
| School name, code, state, district | School by `schoolId` | M02 |
| Pupils and teachers, status, phone, grade, dates, `lastLoginAt` | `UserRow` filtered by `schoolId`, `role`, `isActive`, search (`users` repository) | M01 / M02 |
| User writes, validation | M02 `PUT/POST /api/admin/users` rules (BR-M02-08…12) | M02 (XR-M27-17) |
| Password and login refusal | M01 hash and BR-23 | M01 (XR-M27-18) |
| Classes, enrolments, teacher, join code | `classrooms.list`, `forTeacher`, `memberCount`, `enrolmentsOf` | M10 |
| DSKP Bidang, SK, SP | `dskp.bidang`, `sk`, `sp`, `spPath` | M10 |
| SP answers per pupil | `SpRecord {userId, subjectId, dskpSpId, answered, correct}` | M08 (XR-M27-13) |
| Sessions and answers by school and window | M05 named queries (Q-SESS-USER, Q-ANS-USER, Q-SESS-MEAN-ACC) over the school's users | M05 (XR-M27-12) |
| Activity report rows and charts | M17 `StatsReport` builders (#18) | M17 (XR-M27-15) |
| Early warning | `Q-M18-RISK(schoolId)`, M18 #21, #22, #24, #30 | M18 (XR-M27-16) |

### 18.2 Seeds

M27 adds none (no shared-store edit, no worktree). Personas and oracles are URS §10.3. Computed values are recorded by the build tests, never pinned here. States that need arranging (inactive pupil, inactive teacher, a school with no pupils or no class) are arranged in the test through the M02 admin endpoint #8 as `admin@demo.test`, the S0 hook `seedSchoolAdminWithoutSchool()`, or a fixture school without such rows (900002 "SK Demo" is expected to be empty; verify at build, otherwise the test creates one through M02 as admin). No real name, school code or figure from the deck is used.

### 18.3 Named queries (M27; no stored schema)

| Name | Definition |
|---|---|
| Q-M27-USAGE(user, period) | `{school, period, label, tiles: {pupils: M02 count(student, schoolId), teachers: M02 count(teacher, schoolId), activePupils: M05 distinct answerers of the school in the window, participationPct, sessions: M05 completed sessions of the school in the window, answers: M05 answers of the school in the window, accuracy: mean session accuracy or null}, modes: [{label, sessions, accuracy}]}`; throws 403 per BR-M27-19, 20. |
| Q-M27-DSKP(user, subjectId?, level?) | `{school, subjects, subject, level, caption, bidang: [{id, code, name, sp: [{id, code, title, answered, correct, pct, status}]}]}` from M10 `dskp` and the M08 SpRecords of the school's pupils (BR-M27-24, 25). |
| Q-M27-ACTIVITY(user, range) | M17 `StatsReport(range, school)` with `schools` omitted and `overview.score` omitted. |
| Q-M27-MONTH(user, bulan) | `MonthlyReport` of §19 #5 from M05 answers and sessions and M02 counts (BR-M27-28, 29). |
| Q-M27-USERS(user, role, isActive?, search?, page) | M02 users of the school with the fixed role, plus derived `gradeLabel`, `classNames`, `classCount`, `canEdit` (BR-M27-30, 31, 36). |
| Q-M27-CLASSES(user, level?, search?, page) | M10 classes of the school with derived label, teacher name, members, code (BR-M27-35). |

### 18.4 Requests to owner modules (XR-M27-nn)

| ID | To | Request | Status |
|---|---|---|---|
| XR-M27-11 | Shell (`user-nav.ts`) | (a) Change the href of `sa-amaran-awal` from `/amaran` to `/amaran/sekolah` for `school_admin` (the entry for teachers stays `/amaran`). (b) Active-state rule for the school-admin items: exact for "Dashboard", prefix for the eight items of rows L51–L58 and for `/amaran/sekolah`, so S9 keeps "Senarai Pelajar" and S10, S11 keep "Senarai Guru". (c) The other hrefs of `sa-statistik-penggunaan`, `sa-dskp-heatmap`, `sa-laporan-aktiviti`, `sa-laporan-bulanan`, `sa-senarai-pelajar`, `sa-senarai-guru`, `sa-kelas-sekolah` stay as they are (the routes now exist); the hrefs of the PENGURUSAN items stay. | request |
| XR-M27-12 | M05 | Provide school-scoped variants of the named queries with a window and per-mode grouping: `Q-SESS-SCHOOL(schoolId, window)` (completed sessions with mode, correct, question counts), `Q-ANS-SCHOOL(schoolId, window)` (answers, correct, distinct pupils, by subject) and the distinct answering pupils of the window; read from the pre-aggregated counters, never an iteration of the answer log. | request |
| XR-M27-13 | M08 | (a) Provide `spRecords.forSchool(schoolId, {subjectId, levelId})` returning per SP the Σ `answered` and Σ `correct` over the school's pupils. (b) Admit `school_admin` on S5 `/prestasi/kelas/{id}` for the classes of the own school (and answer 404 for others) so that the S8 link resolves; the route is defined in the M08 SRS but not yet built. | request, dependency |
| XR-M27-14 | M10 | (a) Confirm that `classrooms.list({schoolId})` returns the `school_class` rows of the school (they carry `schoolId`) and that `memberCount(kind, id)` is the active enrolment count. (b) Expose a read returning the owner's display name for a class without a per-row user lookup. (c) Confirm `forTeacher(teacherId)` counts `classroom` rows only, active. (d) Confirm `dskp.bidang/sk/sp` as the DSKP source for S2. | request (confirm) |
| XR-M27-15 | M17 | (a) Let the S11 builders (`StatsReport`, §7 #18) take a `school` restriction as M17 already does for the Command Center (FR-M17-105), returning no `schools` table and no `overview.score`. (b) Decide what `/admin/laporan` does for `school_admin` (server: renders the school-confined page). M27 does not need it; a redirect to `/admin-sekolah/laporan-aktiviti` is suggested. | request |
| XR-M27-16 | M18 | (a) Accept `/amaran/sekolah` as the M27 alias binding of S22 for `school_admin` (school from the session). (b) Expose `Q-M18-RISK(schoolId)` and endpoints #21, #22, #24, #30 for a school admin of the own school (M18 §9 already lists them). (c) M18 has no mock yet (stub only). | dependency (OQ-M27-25) |
| XR-M27-17 | M02 | Expose a school-admin write contract reusing the admin validation (BR-M02-08…12) and the users store: `updateUser(id, {name, email, phone})`, `createTeacher(schoolId, {name, email, phone, password})`, `setActive(id, isActive)`, `resetPassword(id, password)`, each refusing a target outside the given school or role. Also confirm the list read with `schoolId`, `role`, `isActive`, `search`. | request |
| XR-M27-18 | M01 | Confirm that a password reset and `isActive = false` take effect at the next login attempt (BR-23) and that `lastLoginAt` is the "Login Terakhir" source. | request (confirm) |
| XR-M27-19 | Delivery Lead | Roles-matrix rows L51–L58 name the owner "M27 (perlu pengesahan)": relabel to M27 and update build-plan rows #46 to #53. | request |

---

## 19. Mock API endpoints

Conventions: master SRS §7 (JSON envelope `{data}` / `{data, meta}`; errors `{error:{code, message, fields?}}`). Guard **SA** = `school_admin` with a school, school forced from the session (401 guest, 403 other role or no school, 404 object checks of BR-M27-31). Numbering continues Part A's #1.

| # | Method | Path | Guard | Request | Response `data` | Errors |
|---|---|---|---|---|---|---|
| 2 | GET | `/api/admin-sekolah/usage` | SA | `period` | `SchoolUsage` | 401, 403 |
| 3 | GET | `/api/admin-sekolah/dskp-heatmap` | SA | `subjectId?`, `tingkatan?` | `SchoolDskpHeatmap` | 401, 403 |
| 4 | GET | `/api/admin-sekolah/laporan-aktiviti` | SA | `range` | `StatsReport` (M17 §7 #18) for the school | 401, 403 |
| 5 | GET | `/api/admin-sekolah/laporan-bulanan` | SA | `bulan` | `MonthlyReport` | 401, 403 |
| 6 | GET | `/api/admin-sekolah/pelajar` | SA | `is_active?`, `search?`, `page?` | envelope list of `SchoolPupilRow` | 401, 403 |
| 7 | GET | `/api/admin-sekolah/pelajar/:id` | SA | — | `SchoolUserDetail` | 401, 403, 404 |
| 8 | PUT | `/api/admin-sekolah/pelajar/:id` | SA | `{name, email, phone?}` | `{data: SchoolUserDetail, status}` | 401, 403, 404, 422 |
| 9 | POST | `/api/admin-sekolah/pelajar/:id/reset-password` | SA | `{newPassword, newPasswordConfirmation}` | `{data:{reset:true}, status}` | 401, 403, 404, 422 |
| 10 | GET | `/api/admin-sekolah/guru` | SA | `is_active?`, `search?`, `page?` | envelope list of `SchoolTeacherRow` | 401, 403 |
| 11 | GET | `/api/admin-sekolah/guru/:id` | SA | — | `SchoolUserDetail` | 401, 403, 404 |
| 12 | POST | `/api/admin-sekolah/guru` | SA | `{name, email, phone?, password, passwordConfirmation}` | 201 `{data: SchoolUserDetail, status}` | 401, 403, 422 |
| 13 | PUT | `/api/admin-sekolah/guru/:id` | SA | `{name, email, phone?}` | `{data: SchoolUserDetail, status}` | 401, 403, 404, 422 |
| 14 | POST | `/api/admin-sekolah/guru/:id/toggle-active` | SA | — | `{data:{isActive}, status}` | 401, 403, 404 |
| 15 | POST | `/api/admin-sekolah/guru/:id/reset-password` | SA | `{newPassword, newPasswordConfirmation}` | `{data:{reset:true}, status}` | 401, 403, 404, 422 |
| 16 | GET | `/api/admin-sekolah/kelas` | SA | `level?`, `search?`, `page?` | envelope list of `SchoolClassRow` plus `tiles` | 401, 403 |

S4 has no M27 endpoint: it calls M18 #21 (`GET /api/amaran/schools/:id`), #22, #24 and #30 with the session school id.

Shapes:

- `SchoolUsage` = `{ school: {id, name}, period: 'today'|'7days'|'30days', label: 'Hari Ini'|'7 Hari'|'30 Hari', tiles: { pupils, teachers, activePupils, participationPct, sessions, answers, accuracy: number | null }, modes: [ {label, sessions, accuracy: number | null} ] }`.
- `SchoolDskpHeatmap` = `{ school: {id, name}, subjects: [{id, name}], subject: {id, name} | null, level: {code: 't4'|'t5', name}, caption: string | null, bidang: [ {id, code, name, sp: [ {id, code, title, answered, correct, pct: number | null, status: 'mahir'|'sederhana'|'lemah'|'belum'} ] } ] }`.
- `MonthlyReport` = `{ school: {id, name}, month: 'YYYY-MM', label: 'September 2026', prev: 'YYYY-MM', next: 'YYYY-MM' | null, cards: { participationPct, active, registered, answers, perPupil, accuracy: number | null, sessions }, months: [ {month, label, answers, correct, activePupils, perPupil, accuracy} ], total: {answers, correct, accuracy} | null, subjects: { strongest: SubjectRow | null, weakest: SubjectRow | null, rows: [ {name, accuracy, answers, pupils} ] }, generatedAt }` (`months` and `subjects` empty for a month without answers).
- `SchoolPupilRow` = `{ id, name, initials, email, phone: string | null, gradeLabel: string | null, classNames: string[], isActive, createdAt, canEdit }`; `meta` = `{page, pageSize: 25, totalItems, totalPages, from, to, counts: {total, active, inactive}}`.
- `SchoolTeacherRow` = `{ id, name, initials, email, phone, classCount, lastLoginAt: string | null, isActive, createdAt, canEdit }`, same `meta`.
- `SchoolUserDetail` = `{ id, name, email, phone, isActive, createdAt, updatedAt, role: 'student'|'teacher', school: {id, name, code, district, state} }`.
- `SchoolClassRow` = `{ key: 'classroom:{id}'|'school_class:{id}', kind, id, name, subject: {id, name} | null, levelLabel, teacherName: string | null, members, joinCode: string | null, isActive, link: string | null }`; the response adds `tiles: {activeClasses}`, `levels: [{code, label}]` and `meta` with `displayed`.

`pelajar` and `guru` endpoints return only the users of the session school; `:id` outside it, of another role, or unknown answers 404 (BR-M27-31); #8, #9, #13, #15 answer 403 for an inactive account (BR-M27-31); `status` carries the UNVERIFIED COPY flash of M02.

---

## 20. States and messages

### 20.1 Copy by screen (exact)

| Screen | Copy |
|---|---|
| All | Header titles of §14.2; 403 and 404 pages per Part A §8.3 |
| S1 | Pills "Hari Ini", "7 Hari", "30 Hari"; tiles "Pelajar", "Guru", "Pelajar Aktif" ("daripada {n}"), "Penglibatan" ("daripada pelajar daftar"), "Sesi Latihan", "Soalan Dijawab", "Purata Ketepatan"; card "Mengikut Mod Latihan" with "Mod", "Sesi", "Ketepatan Purata"; empty: "Tiada data untuk tempoh ini", "Tiada aktiviti latihan dalam tempoh 30 Hari yang lepas.", "Tiada aktiviti latihan dalam tempoh 7 Hari yang lepas.", "Belum ada pelajar buat latihan hari ini. Cuba lihat 7 Hari atau 30 Hari."; footnote "Ketepatan dipaparkan sebagai “—” kerana belum ada sesi latihan direkodkan dalam skop ini." |
| S2 | "Peta DSKP — Standard Pembelajaran", "KSSM {Subjek} Tingkatan {n}", "Subjek", "Tingkatan 4", "Tingkatan 5", "Mahir (75%+)", "Sederhana (50-74%)", "Lemah (<50%)", "Belum Cuba", "Fokus" is not used; tile title "{code}: {title} — {Mahir\|Sederhana\|Lemah\|Belum cuba}" and " · {n} cuba · {p}% betul"; empty "Tiada Standard Pembelajaran untuk subjek dan tingkatan ini." (P) |
| S3 | As M17 S11: "Overview", "Guru ({n})", "Murid ({n})", "Tempoh:", "7 Hari", "30 Hari", "3 Bulan", "Murid Pernah Login", "Cikgu Pernah Login", "Murid Buat Latihan", "Jumlah Aktiviti", "{n} belum pernah login", "{range} hari lepas", "Trend Aktiviti", "Pecahan Aktiviti", "Kuiz Objektif", "Soalan Berstruktur", "Battle Arena", "Permainan", "Pelajar Paling Aktif", "Cikgu Belum Login", "Senarai Guru ({n})", "Semua", "Pernah Login ({n})", "Belum Login ({n})", "Cari guru...", "Jumlah Guru", "Pernah Login", "Jumlah Soalan", "Jumlah Syiling", "Senarai Murid ({n}) — Top 200", "Aktif", "Login Sahaja", "Belum Login", "Cari murid...", "Jumlah Murid", "Pernah Latihan", "Jumlah Sesi", "Purata Ketepatan", column heads of FR-M27-71, 72 |
| S4 | "Amaran Awal — Sekolah", "Semua Tingkatan", "Tingkatan 4", "Tingkatan 5", "Jumlah Pelajar", "On Track", "Perlu Perhatian", "Berisiko Tinggi", "Taburan Risiko Seluruh Sekolah", "Hijau: {n}", "Kuning: {n}", "Merah: {n}", "Keberkesanan Intervensi", "Ringkasan Eksekutif", "Muat Turun CSV", "Analisis Risiko Mengikut Subjek", "{w}/{m} pelajar lemah ({p}%)", "Senarai Pelajar Berisiko", "Disusun mengikut skor risiko tertinggi", the eight column heads |
| S5 | "Laporan {Bulan} {yyyy}", "← {Bulan} {yyyy}", "{Bulan} {yyyy} →", "Penglibatan", "{n} aktif / {n} daftar", "Soalan Dijawab", "{x} soalan/pelajar", "Ketepatan", "Sesi Latihan", "Statistik Bulanan", "12 bulan terakhir — pecahan prestasi mengikut bulan", "Bulan", "Soalan Betul", "Pelajar Aktif", "Purata/Pelajar", "Accuracy", "Jumlah", "Tiada data", "Tiada aktiviti direkodkan buat masa ini", "Prestasi Mengikut Subjek", "SUBJEK TERKUAT", "SUBJEK PERLU PERHATIAN", "Laporan dijana: {d MMM yyyy, hh:mm AM\|PM} · PrestasiPlus", "Cetak / PDF" |
| S6 | "Pelajar", "Aktif", "Tidak Aktif", "Status", "Semua", "Cari", "Nama atau emel...", column heads "#", "Nama", "Emel", "Telefon", "Tingkatan", "Kelas", "Aktif?", "Tarikh", "Tindakan", "Aktif", "Tidak", "Edit", "Tiada pengguna dijumpai", "Cuba ubah kriteria carian anda" |
| S7 | As S6 with "Guru", "Kelas" ("{n} kelas"), "Login Terakhir" ("Belum login"), "Cipta Pengguna"; confirm "Pasti untuk menukar status pengguna ini?" |
| S8 | "Kelas Aktif", "{n} kelas dipaparkan", "Tingkatan / Darjah", "Semua", "Cari kelas...", column heads "#", "Kelas", "Subjek", "Tingkatan", "Guru", "Murid", "Kod Kelas", "Tiada Subjek", "—", "Tidak Aktif", "Tiada kelas dijumpai", "Sila cipta kelas terlebih dahulu" |
| S9, S10 | "Edit Pengguna", "Kemaskini maklumat pengguna", "Daftar: {dd/mm/yyyy}", "Kemaskini: {dd/mm/yyyy HH:mm}", "Nama *", "Emel *", "No. Telefon (Pilihan)", "Status", "Reset Kata Laluan", "Klik untuk buka bahagian reset kata laluan", "Kata Laluan Baru", "Minimum 6 aksara", "Sahkan Kata Laluan Baru", "Taip semula kata laluan baru", "Kosongkan jika tidak mahu tukar kata laluan. Kata laluan baru akan berkuat kuasa serta-merta.", "Batal", "Kemaskini", flash "Pengguna berjaya dikemaskini." |
| S11 | "Cipta Pengguna", "Borang Pendaftaran Pengguna", "Isi maklumat untuk mendaftarkan pengguna baru", "Guru", "Nama *", "Emel *", "No. Telefon (Pilihan)", "Kata Laluan *", "Minimum 6 aksara", "Sahkan Kata Laluan *", "Taip semula kata laluan", "Batal", "Daftar Pengguna", flash "Pengguna berjaya didaftarkan." |

### 20.2 PROPOSED or INFERRED (report at G1)

| # | Where | Text or behaviour | Tag |
|---|---|---|---|
| 1 | Tab titles | "{title} - PRESTASIPLUS" | P |
| 2 | S1 | tile set and order; no export; "Pelajar" and "Guru" tiles | P |
| 3 | S2 | whole screen: level pills T4 and T5, subject select, pooled rounding, empty copy, tiles not links | P (D23) |
| 4 | S3 | h1 "Laporan Aktiviti" and school sub-line; hidden "Sekolah" tab, school select and column, "Skor Purata" and chip | P |
| 5 | S4 | route `/amaran/sekolah` as sidebar target; alias pills | D / P |
| 6 | S5 | whole composition, month navigation, subject boxes, print button | P (D23) |
| 7 | S6, S7 | columns "Tingkatan", "Kelas", "Login Terakhir"; read-only pupil status; no IC | P |
| 8 | S9, S10 | page instead of modal; typed password; fields subset | P |
| 9 | S11 | sub-line "Daftarkan akaun guru ke sekolah anda"; created active | P |
| 10 | S8 | whole table, both kinds, filters, link | P (D23) |
| 11 | S2, S3, S5, S6, S7, S8 | responsive layouts of §22 | P |
| 12 | Flash messages | M02's UNVERIFIED COPY constants | P |

### 20.3 Loading and errors

Loading: the shell's loading state. Errors: the M01 global error page for a server failure; 403 and 404 pages per Part A §8.3; form validation as M02 (alert above the form). Unknown-state copy is never invented.

---

## 21. Permissions matrix

| Route or endpoint | Admin Sekolah (with school) | Admin Sekolah (no school) | Admin (platform) | Guru, Pelajar, Ibu Bapa, Penaja, PPD, JPN | Guest |
|---|---|---|---|---|---|
| S1, S2, S3, S5, S6, S7, S8 | yes (own school) | 403 page | 403 page (live: 302 then 500, DV-M27-01) | 403 page | `/login` |
| S4 `/amaran/sekolah` | yes (own school) | 403 page | 403 page | 403 page (their M18 routes unchanged) | `/login` |
| S9, S10 with id | yes (own school, active, right role) | 403 page | 403 page | 403 page | `/login` |
| S9, S10 with a foreign, unknown or wrong-role id | 404 page | 403 page | 403 page | 403 page | `/login` |
| S11 | yes | 403 page | 403 page | 403 page | `/login` |
| S9, S10 with an inactive account | 403 page (S10 reactivation is on S7) | 403 page | 403 page | 403 page | `/login` |
| `GET /api/admin-sekolah/*` (#2 to #7, #10, #11, #16) | 200 | 403 | 403 | 403 | 401 |
| `PUT`, `POST` #8, #9, #12 to #15 | 200 or 201 (own school) | 403 | 403 | 403 | 401 |
| M18 own routes (CSV, effectiveness, summary) for a foreign school | 403 (M18) | 403 | admin: M18 | per M18 | `/login` |

Consistent with S0 §9 and the M17 alias rule (M17 SRS §9, "Alias routes").

---

## 22. Responsive behaviour (375 / 768 / 1280)

Common: user shell below `lg`: no sidebar, hamburger drawer and bottom nav; at 1280 the sidebar. No horizontal page scroll; wide tables scroll inside their card; text at least 12 px. Layouts for 768 and 375 are PROPOSED (the evidence shows 1280 only).

| Screen | 1280 | 768 | 375 |
|---|---|---|---|
| S1 | pills in one row; 7 tiles as 4 + 3 per row; mode table in a card | same | pills wrap; tiles 2 per row; table scrolls inside its card |
| S2 | select and level pills in one row; tiles wrap inside Bidang groups; legend in one row | same | filters stack; legend wraps; tiles wrap, text 12 px |
| S3 | tabs and pills in one row; overview cards 4 per row; lists 3 columns (M17 `md:grid-cols-3`) | cards 4 per row; lists 1 to 3 columns as M17 | cards 2 per row; tables scroll inside cards (M17 DV-M17-04) |
| S4 | M18 S22: pills, 4 tiles, bar, buttons right-aligned, tables | same | pills wrap; tiles 2 per row; buttons stack; risk table scrolls inside its card |
| S5 | heading with the two links on one row; 4 cards in a row; tables and boxes in cards | same | links wrap on two lines; cards 2 per row; the 6-column table scrolls inside its card |
| S6, S7 | 3 count cards in a row; filter card in one row; 9-column table without scroll when it fits, else inside the card (M02 DV-M02-01 pattern) | table scrolls inside its card | cards 1 to 3 per row; filters stack; table scrolls; "Cipta Pengguna" button full width under the heading |
| S8 | tile, count line, filters in one row; 7-column table | table scrolls inside its card | tile and line stack; filters stack; table scrolls |
| S9, S10, S11 | two-column form as M02 S3 and S2 | one column | one column; footer buttons stacked |

---

## 23. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-M27-07 | Performance: every endpoint answers in under 100 ms in the mock; counts and windows come from the owners' counters (M05, M08 SpRecord sums), never by iterating the answer log; lists return 25 rows. |
| NFR-M27-08 | Localisation: BM copy exactly as quoted; BM month names; numbers `ms-MY`; dates `dd/mm/yyyy`; times MYT. |
| NFR-M27-09 | Accessibility replicates live (D10): no ARIA, focus or motion enhancements added; text at least 12 px. |
| NFR-M27-10 | Privacy: no real person's name, IC, e-mail or password in docs, seeds or pages; lists show only users of the viewer's school; M27-owned files do not hard-code any observed school code, name or deck figure. |
| NFR-M27-11 | Determinism: same clock and seed give the same page; no random values. |
| NFR-M27-12 | Responsive: 375 / 768 / 1280 without horizontal page scroll (CLAUDE.md §7); E2E runs at all three. |

### 23.1 Security notes (backend phase; security-engineer review required: school-scoped personal data of minors, password resets, a privileged create)

| ID | Risk | Prototype | Backend requirement |
|---|---|---|---|
| SEC-M27-06 | Another school's pupil or teacher names, e-mails or phones leak on a list or detail. | school forced from the session | one scope function shared with M02; leak tests on content (rows and e-mails) for school A against B, not on status codes |
| SEC-M27-07 | A client-supplied `role`, `schoolId` or `isActive` raises privilege or moves a user. | body keys ignored | allow-list the body; test each ignored key |
| SEC-M27-08 | Reset or edit of a peer school admin, platform admin, teacher of another school, or an inactive account. | 404 for foreign, 403 for inactive | check school, role and status server-side before any write; audit log of resets |
| SEC-M27-09 | Exports and lists expose IC, e-mail or phone, or inject formulas (S4 CSV). | no IC anywhere; M18 CSV guard | no IC in any M27 response; CSV values starting `=`, `+`, `-`, `@` are prefixed with `'` (M18 SEC-M18-03) |
| SEC-M27-10 | Object enumeration through ids on S9, S10 and #7 to #15. | 404 for any object not of the school and role | same body and status for "other school", "other role" and "unknown"; rate limit in the backend |

---

## 24. E2E test scenarios

Projects: mobile 375x812, tablet 768x1024, desktop 1280x800; every scenario runs on all three unless stated. Clock 2026-09-25T15:40:00+08:00. Session by the fixture `loginAs(email)`. Oracle = the owner's own query for the same school; no figure is pinned. Personas P1 to P5 are URS §10.3. `@provisional` asserts a PROPOSED or INFERRED item (excluded from the G5 gate until confirmed). `@blocked-by M18` needs the M18 contracts; `@blocked-by XR-M27-13` needs M08 S5.

| ID | Scenario | FR | AC | Projects |
|---|---|---|---|---|
| E2E-M27-35 | Guest opens each of the nine route families of AC-12.1: `/login`. | 39 | 12.1 | all |
| E2E-M27-36 | `admin@demo.test`, `guru@demo.test`, `pelajar@demo.test` open each route: the 403 page with the exact copy; `guru@demo.test` on `/amaran/sekolah` the same; no picker, no 500. | 40 | 12.2, 21.5 | all |
| E2E-M27-37 | (hook) `school_admin` with a null school: 403 on every route; no school name or row in the DOM. | 41 | 12.3 | all |
| E2E-M27-38 | P1 adds `?school=900001`, `?school_id=900001`, `?role=teacher` to S6 and S7: school 900003 and the page's role. | 42, 89 | 12.4 | 1280 |
| E2E-M27-39 | P1 opens S9 and S10 with a pupil of 900001, a teacher of 900003 on the pupil route, a pupil on the teacher route, and an unknown id: the 404 page each time. | 43 | 12.5 | 1280 |
| E2E-M27-40 | Every `/api/admin-sekolah/*` endpoint: 401 guest, 403 admin, 403 no-school, 200 or 404 for P1. | 39, 40, 41 | 12.6 | request only |
| E2E-M27-41 | P1 on S1 to S11: header title, sub-line, tab title, no breadcrumb on S1 to S8, "Batal" on S9 to S11. | 44 | 13.1, 13.2, 13.4 | all |
| E2E-M27-42 | P1 at 1280 on each route: exactly the expected sidebar item active, "Dashboard" not active; S9 keeps "Senarai Pelajar", S10 and S11 "Senarai Guru", `/amaran/sekolah?tingkatan=T4` "Amaran Awal" (S4 part `@blocked-by M18`). | 38, 45 | 13.3 | 1280 |
| E2E-M27-43 | P1 and P4 on every screen: no horizontal scroll, text at least 12 px, tables inside their card at 375. | 46 | 14.1, 14.2, 14.3 | all |
| E2E-M27-44 | DOM scan of every screen for P1 and P4: no IC pattern, no password, no user of another school; static check CHK-M27-02. | 47 | 14.4 | 1280 |
| E2E-M27-45 `@provisional` | Endpoint forced to 500 on S1 and S6: the M01 error page. | 48 | 14.5 | all |
| E2E-M27-46 | A school with 26 or more rows on S6, S7, S8 (P4 or a generated school): 25 rows, paginator wording, links keep the query. | 49, 91 | 14.6, 26.3, 32.2 | all |
| E2E-M27-47 | P4: S6 total equals S0 "JUMLAH PELAJAR", S7 total "JUMLAH GURU", S8 tile "KELAS AKTIF"; S4 tiles equal the S0 "AMARAN AWAL" panel (S4 part `@blocked-by M18`). | 50 | 31.1, 33.1, 33.2, 33.3 | all |
| E2E-M27-48 | P4 on S1: seven tiles in order, pills with "30 Hari" active. | 51, 52 | 15.1 | all |
| E2E-M27-49 | P4 on S1 for each period: every tile equals the owner queries (oracle); sub-lines; `ms-MY`. | 52, 53, 57 | 15.2 | all |
| E2E-M27-50 | S1 `?period=bogus` gives 30 days; `?period=7days` activates "7 Hari". | 51 | 15.3 | 1280 |
| E2E-M27-51 `@provisional` | A school with no pupil: "Penglibatan" "0%". | 53 | 15.4 | 1280 |
| E2E-M27-52 | P4 on S1: "Mengikut Mod Latihan" rows, order, sum equals "Sesi Latihan". | 54 | 16.1 | all |
| E2E-M27-53 | A school with no session: the empty card for 30 and 7 days with exact copy. | 55 | 16.2 | all |
| E2E-M27-54 | The same school at `today`: the sentence with the two links. | 55 | 16.3 | all |
| E2E-M27-55 | No session: "—" and the footnote; no export control on S1. | 56 | 16.4 | all |
| E2E-M27-56 | P4 on S2: heading, caption, legend. | 58, 62 | 17.1 | all |
| E2E-M27-57 | P4 on S2: Bidang groups and SP tiles equal the M10 store, code order. | 60 | 17.2 | all |
| E2E-M27-58 | P4 on S2: tile percent and status equal the oracle (M08 SpRecord sums), colour per status, no value for "Belum cuba". | 61 | 17.3 | all |
| E2E-M27-59 | S2 tile `title` format and tiles are not links. | 63 | 17.4 | 1280 |
| E2E-M27-60 | S2 select and level pills reload with the query and update tiles and caption; "Tingkatan 4" default. | 59 | 18.1 | all |
| E2E-M27-61 `@provisional` | S2 empty states: a subject and level without SP; a school without records shows all "Belum cuba". | 64 | 18.2, 18.3 | 1280 |
| E2E-M27-62 | P1 and P4 on S2: different values, no platform total. | 65, 42 | 18.4 | 1280 |
| E2E-M27-63 | P4 on S3: title, tabs without "Sekolah", range pills, `?range=5` gives 30. | 66, 67 | 19.1, 19.5 | all |
| E2E-M27-64 | P4 on S3 for each range: four overview cards equal the M17 queries restricted to the school (oracle). | 68, 73 | 19.2 | all |
| E2E-M27-65 | S3: no "Skor Purata", no "Struktur", no "platform" wording. | 68, 70 | 19.3 | all |
| E2E-M27-66 | S3: trend, breakdown, top pupils, never-logged-in teachers contain school users only. | 69 | 19.4 | all |
| E2E-M27-67 | S3 Guru tab: heading, pills, search, tiles, columns, no school column or select. | 71 | 20.1 | all |
| E2E-M27-68 | S3 Murid tab: heading, pills each listing rows, search, tiles, columns, at most 200 rows, empty search. | 72 | 20.2, 20.3 | all |
| E2E-M27-69 `@blocked-by M18` | P4 on `/amaran/sekolah`: header, pills, tiles. | 74, 75 | 21.1 | all |
| E2E-M27-70 `@blocked-by M18` | S4 tiles and distribution equal `Q-M18-RISK(schoolId)` (oracle). | 75, 80 | 21.2 | all |
| E2E-M27-71 `@blocked-by M18` | S4 subject analysis and risk list as M18 S22. | 76 | 21.3 | all |
| E2E-M27-72 | Sidebar "Amaran Awal" opens `/amaran/sekolah` for P1 (route; content part `@blocked-by M18`). | 74 | 21.4 | all |
| E2E-M27-73 `@blocked-by M18` | S4 buttons order and targets. | 77 | 22.1 | all |
| E2E-M27-74 `@blocked-by M18` | S4 CSV download name, columns, own-school rows only. | 78 | 22.2 | 1280 |
| E2E-M27-75 `@blocked-by M18` | P1 opens `/amaran/sekolah/900001` and `/amaran/export/school/900001`: M18's 403. | 78 | 22.3 | 1280 |
| E2E-M27-76 `@provisional` `@blocked-by M18` | A school without pupils: zeros; `?tingkatan=T4` activates the pill and filters. | 75, 79 | 22.4, 22.5 | 1280 |
| E2E-M27-77 | P4 on S5: heading, previous and next links, `?bulan=2026-08`, invalid and future values. | 81 | 23.1, 23.3 | all |
| E2E-M27-78 | S5 cards equal the oracle for the month. | 82, 87 | 23.2 | all |
| E2E-M27-79 | A month without answers: "0%", "0", "—", "0"; no sections. | 83 | 23.4 | all |
| E2E-M27-80 | S5 "Statistik Bulanan": subtitle, columns, rows, footer "Jumlah", empty copy. | 84 | 24.1, 24.2 | all |
| E2E-M27-81 | S5 "Prestasi Mengikut Subjek": strongest, weakest, rows. | 85 | 24.3 | all |
| E2E-M27-82 `@provisional` | S5 footer text at the clock and "Cetak / PDF" calls `window.print()` once. | 86 | 24.4 | 1280 |
| E2E-M27-83 | P4 on S6: cards, columns, rows equal M02, school scope only. | 88, 90, 93 | 25.1, 25.2, 25.3 | all |
| E2E-M27-84 | S6: empty school row; active pupil has link and "Edit", inactive none; no import, add, delete, checkbox control. | 92 | 25.4, 25.5 | all |
| E2E-M27-85 | S6 status filter, search, order (active first, newest first). | 89, 91 | 26.1, 26.2 | all |
| E2E-M27-86 | S9: profile card, form fields, status line, footer. | 94 | 27.1 | all |
| E2E-M27-87 | S9: save, return to S6 with the flash, M02 record changed; validation errors; ignored body keys. | 97 | 27.2, 27.3, 27.6 | 1280 |
| E2E-M27-88 | S9: reset bar, valid and invalid passwords, the pupil signs in with the new password. | 95, 98 | 27.4 | 1280 |
| E2E-M27-89 | S9 for an inactive pupil: 403 page. | 96 | 27.5 | 1280 |
| E2E-M27-90 | P2 on S7: cards, "Cipta Pengguna", columns, only teachers of 900001, teacher 5 shows "2 kelas" and the login text. | 99, 101, 103 | 28.1, 28.2, 28.3 | all |
| E2E-M27-91 | S7: empty school, filters, order and paging as S6. | 100 | 28.4, 28.5 | all |
| E2E-M27-92 | S10: form, save, flash, ignored body keys, foreign id 404. | 104, 106, 107 | 29.1, 29.2, 29.6 | 1280 |
| E2E-M27-93 | S10: reset password, the teacher signs in. | 104 | 29.3 | 1280 |
| E2E-M27-94 | S7 "Aktif?": confirm text, cancel, accept deactivates and sign-in is refused; inactive teacher has no link, S10 gives 403, button reactivates. | 102, 105 | 29.4, 29.5 | 1280 |
| E2E-M27-95 | S11: button opens the form, copy, locked school label, create, listed active, errors, ignored body keys. | 108, 109, 110 | 30.1, 30.2, 30.3, 30.4, 30.5 | all |
| E2E-M27-96 | P2 on S8: tile equals the S0 card, line, columns, rows of classes 2001 and 2002. | 111, 112, 116 | 31.1, 31.2 | all |
| E2E-M27-97 | S8: a `school_class` row, null subject, empty school copy, no foreign class. | 113, 114 | 31.3, 31.4, 31.5 | all |
| E2E-M27-98 | S8 level filter, search, order. | 114 | 32.1 | all |
| E2E-M27-99 `@provisional` `@blocked-by XR-M27-13` | S8 class name opens M08 S5 for a `classroom` row; a `school_class` row is plain text. | 115 | 32.3 | 1280 |

Static check **CHK-M27-02** (unit test): extends CHK-M27-01 to the Part B files (M27 docs, `src/modules/m27-*`, `e2e/m27-*`): no e-mail other than `@demo.test`, no hard-coded observed school code, name or deck figure (scan list outside the repository), and no M27 handler imports a store directly (D12, BR-M27-38).

Totals: **65 E2E scenarios** (E2E-M27-35…99; #40 request-only; #38, #39, #50, #59, #62, #74, #75, #76, #82, #87, #88, #89, #92, #93, #94, #99 run on a subset of widths), of which **6 are `@provisional`** (45, 51, 61, 76, 82, 99) and **7 are blocked by M18** (69, 70, 71, 73, 74, 75, 76; the S4 parts of 42, 47 and 72 also wait for M18), plus 1 static check.

---

## 25. Open questions

URS §17 is authoritative (OQ-M27-15…25, QS8-01…05). None blocks G1; OQ-M27-25 is a build-order dependency (S4 waits for M18; S2 for XR-M27-13).

| ID | Topic | Blocks |
|---|---|---|
| OQ-M27-15 | S1 tile set composed from Panduan, server strip and deck labels. | none |
| OQ-M27-16 | S2 axes, unit, levels, no "all subjects". | none |
| OQ-M27-17 | S3 and the M17 route `/admin/laporan` for a school admin (XR-M27-15). | none |
| OQ-M27-18 | S4 sidebar target `/amaran/sekolah` (XR-M27-11). | none |
| OQ-M27-19 | S5 distinct report or month filter of "Ringkasan Eksekutif". | none |
| OQ-M27-20 | S6, S7 extra columns, no IC, no export. | none |
| OQ-M27-21 | S11 created active; no "Import Pelajar" link. | none |
| OQ-M27-22 | S9, S10 as pages with a typed password. | none |
| OQ-M27-23 | S2 pooled aggregation rule (BR-M27-24). | none |
| OQ-M27-24 | S8 kinds, columns, link (XR-M27-13). | none |
| OQ-M27-25 | Build order: M18 for S4, M08 aggregate for S2 (XR-M27-13, 16). | build of S4 and S2 only |
