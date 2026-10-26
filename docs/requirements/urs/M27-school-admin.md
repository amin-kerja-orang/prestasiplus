# M27 — School Admin Portal — User Requirements Specification

## 0. Document control

| Field | Value |
|---|---|
| Document | URS — M27 School Admin Portal. Part A (§0–§9): S0 Dashboard Sekolah `/admin-sekolah` (roles-matrix row L07, Admin Sekolah part). Part B (§10–§17): S1–S12, rows L51–L58 |
| Version | 1.8 (S0 content = v1.3; Part B = S1–S12, §10–§17, approved at G1 on 2026-10-09, D26) |
| Date | 2026-10-09 |
| Status | **Draft v1.3 (round 3 audit findings fixed, re-audit pending; scope grew under D24 in v1.2, user G1 re-approval needed for the items in §0.2)**. v1.1 was approved at G1 by the user (audit round 1 findings fixed). v1.2 replaces the four placeholder slots with the cards of the server deck and adds the "Ringkasan Prestasi" card. One part stays open: what lies **below the heading "Taburan Gred (Anggaran)"** is cut off in the deck (OQ-M27-11). |
| Author | product-analyst (agent) |
| Source discovery | [L07-dashboard-admin-sekolah.md](../../discovery/L07-dashboard-admin-sekolah.md), [M27-school-admin.md](../../discovery/M27-school-admin.md), [M27-admin-sekolah-screens.md](../../discovery/M27-admin-sekolah-screens.md) (Session 2; §5.3 Amaran cross-check, §9 findings for S0). Evidence: (1) LIVE-SCREENSHOT `roles-matrix/admin sekolah/WhatsApp Image 2026-09-26 at 12.04.10.jpeg` (25 Sep 2026, upper part only); (2) SERVER-DECK `prestasiplus-reference/backend/public/images/present/ss-admin.png` (the S0 below the banner) and `ss-prestasi-sekolah.png` (the "Lihat penuh →" target page), embedded in `backend/public/present.html` (line ~993, caption `prestasiplus.my/admin-sekolah`); the deck is undated, older than the live capture, and its sidebar differs. Server code has no `/admin-sekolah` route (L07 §0). |
| Companion SRS | [srs/M27-school-admin.md](../srs/M27-school-admin.md) |
| Format templates | [M17 URS](M17-admin-dashboard.md), [M17 SRS](../srs/M17-admin-dashboard.md) (Admin Sekolah alias: FR-M17-101…118, BR-M17-34, OQ-M17-15) |
| Related (owners, D12) | M01 (session user, role label, landing BR-07), M02 (schools; users; school subscriptions DATA-M02-07), M08 (performance: GPS, grade distribution, level accuracy, practice stats; S1 `/prestasi/sekolah`, S2 `/prestasi/tingkatan`), M09 (perutusan store, `/perutusan` routes S22–S25), M10 (classrooms), M18 (early-warning risk `Q-M18-RISK`, S22), M05 (practice sessions and answers, read through M08; `/dashboard` S1), M17 (Command Center alias, "← Dashboard" back link), [design/shells.md](../../design/shells.md) v1.2.1 §1.2 and §3 (user shell) |

**Tags.** **OBSERVED** = in the live screenshot. **SERVER-DECK** = in the server copy's deck images (D24: server is authoritative where live is unobservable; the live screenshot wins where both show something and they differ). **SERVER** = server code (scope rules, formulas; L07 §4, Session 2 §2.3). **INFERRED** = derived, not observed. **PROPOSED** = rebuild decision. **DL** = Delivery Lead decision; **UD** = user decision.

**Change log**

| Version | Date | Change |
|---|---|---|
| 1.8 | 2026-10-09 | **Part B only; S0 untouched. No requirement change; the SRS v1.8 carries the as-built clarifications.** New S12 form-data endpoint #22 (`GET /api/admin-sekolah/pelajar/form-options`, SRS §19); M08 S5 route built and opened for own-school classes (G-1); M05 school facet not filled, M27 reads per pupil (G-2); M17 `buildStatsReport(range, {schoolId})` added, S3 "Jumlah Soalan" tiles school-scoped (G-3); nested impersonation start answers 409 (G-5); S6/S7 order active first then id descending (G-6); inactive classes filtered on S6 (G-7); SRS §19 rows reordered (G-9). Counts unchanged. |
| 1.7 | 2026-10-09 | **Part B approved at G1 (user decision D26, 2026-10-09, "setuju semua").** G1-1…G1-9 of §17.1 marked "Approved (D26)"; Part B status set to "Approved (G1) 2026-10-09" (§10.0). **Lead decision (pretasiplus-app-3a, 2026-10-09):** the M18 pages `/amaran/keberkesanan` and `/amaran/ringkasan-eksekutif` are out of prototype 1.0 scope (M18 PPD/JPN not built); S4 still renders the buttons (FN-M27-6.2.1); new deferral DV-M27-23; FN-M27-6.2.1, AC-M27-22.1, OQ-M27-25 and the §16 row updated; the CSV link `/amaran/export/school/{id}` works (M18 #21/#22/#24/#30 provided by Session 8; S0 and S4 share one implementation, AC-M27-33.3). No S0 section (§0–§9) was edited except this row and the Version and Date cells. Counts unchanged (25 stories, 80 Functions, 112 AC, 105 matrix elements). |
| 1.6 | 2026-10-03 | **Round 3 minors (no bump):** R3-02 `@blocked-by XR-M27-21` on AC-M27-36.2–36.5; R3-01 and R3-03 are in the SRS. **Part B audit round 2 fixes (`docs/qa/audit/M27-partB-audit.md`, Round 2: 1 Major, 5 Minor).** R2-01 (Major): the server's "Menyamar" adopted (SERVER, D24): FT-M27-8.5, FN-M27-8.5.1, 8.5.2, US-M27-36, AC-M27-36.1–36.5, matrix EL-S6-22, §16 row corrected, DV-M27-21 and DV-M27-17 updated, G1-8; session switch with return path requested as XR-M27-21. R2-02: the one-time credential block of S12 named as the only exception to "no password in pages" (FN-M27-2.3.3, AC-M27-14.4; FR-M27-47, NFR-M27-10, E2E-M27-44 in the SRS). R2-03: the cards "Aktif" and "Tidak Aktif" removed (no source); one role card remains (FN-M27-8.1.1, 9.1.1, AC-M27-25.1, 28.1). R2-04: S12 password minimum 8 recorded in DV-M27-19, XR-M27-17 and G1-9. R2-05: Part A body line reverted (SRS §0.1), provisional total fixed. Totals: 25 stories, 80 Functions, 112 acceptance criteria, 105 matrix elements (55 M, 29 MD, 21 N). |
| 1.5 | 2026-10-03 | **Part B audit round 1 fixes (`docs/qa/audit/M27-partB-audit.md`: 2 Major, 14 Minor).** AUD-M27B-01: SERVER claims corrected (single-pupil create, "Eksport CSV", "Import Pengguna", `onlyRoles` belongs to `UserDirectory`, the server Panel lists fellow school admins); capabilities adopted and tagged SERVER: new S12 "Tambah Pelajar" and "Eksport CSV" on S6 and S7 (new US-M27-34, 35, FT-M27-8.3, 8.4, 9.4); server edit-view extras and "Import Pengguna" recorded as not adopted with the real reason; matrix gains EL-S6-13…21, EL-S7-11, EL-X-05. AUD-M27B-02: S8 lists `classroom` rows only (DV-M27-20, XR-M27-20). 03: reset label (DV-M27-18). 04: breadcrumb on S1–S3, S5–S8 (PROPOSED, S0 precedent). 05: FR-M17-94. 06: DV-M27-08, 13 rationales. 07: S1 tags. 08: S5 label and rule. 09: S2 level scope and demo data. 10: fixtures (empty-school persona P1). 11: EL-S8-09 reworded. 12: document control, FT renumbering (FT-M27-8.3 became 8.2, FT-M27-10.2 added). 13: responsive counts. 14: inactive on read endpoints. 15: new §17.1 G1 confirmation list. 16: S4 sub-line suffix, M18 citation. Header and Document rows now carry the module title; §8 row on other screens points to Part B. Totals now 24 stories, 78 Functions, 107 acceptance criteria, 104 matrix elements. |
| 1.4 | 2026-10-03 | **S1–S11 added (roles-matrix rows L51–L58; Session 2; D24).** New sections §10–§17 only; §0–§9 (S0, Session 8) are untouched except this row and the Version and Date cells. New ids: US-M27-12…33, FT/FN EP-M27-2…10, DV-M27-08…17, OQ-M27-15…25, QS8-01…05 (§17). Screens: S1 Statistik Penggunaan, S2 DSKP Heatmap, S3 Laporan Aktiviti, S4 Amaran Awal, S5 Laporan Bulanan, S6 Senarai Pelajar, S7 Senarai Guru, S8 Kelas Sekolah, plus S9 Edit Pelajar, S10 Edit Guru, S11 Cipta Pengguna (guru). Status of the extension: Draft v1.4, G1 pending (own status line in §10.0); the S0 status line above is unchanged. |
| 1.3 | 2026-10-03 | **Audit round 3 fixes.** R3-01 (Major): DV-M27-07 rewritten as observed server behaviour not reproduced (each card follows its own owner definition, no tuning, agreement with M08 S1 is only a consequence of shared owner stores); AC-M27-11.3 no longer requires "JUMLAH PELAJAR" to equal M08 S1; M08 described per FR-M08-12 (OQ-M27-12); FN-M27-1.6.3 / AC-M27-06.3 use `classrooms.list({isActive, schoolId})`. R3-03: LANGGANAN grace row exists only under test profile `subscriptions-extra` (default seed none); `cancelled` counts as none; labels follow M02 BR-23 ("Tamat"). Totals unchanged: 11 stories, 34 FN, 51 AC. |
| 1.2 | 2026-10-03 | **D24 amendment: SERVER-DECK evidence for the part below the banner.** (1) Four placeholder slots replaced by the cards "JUMLAH PELAJAR", "JUMLAH GURU", "KELAS AKTIF", "LANGGANAN" (value "Belum Ada" when none); fourth card **green** per the live screenshot (live wins), the deck's grey kept as the INFERRED no-subscription state (DV-M27-04 rewritten, DV-M27-06). (2) New card "Ringkasan Prestasi" with four panels (GPS SEKOLAH, AMARAN AWAL, LATIHAN, TINGKATAN), "Taburan Gred (Anggaran)" and "Lihat penuh →" (FT-M27-1.9, US-M27-10, 11). (3) Header: title "Dashboard Sekolah", subtitle = the school name (SERVER-DECK; the live capture's covered "D…" / "S…" fits), replacing the INFERRED "Dashboard" / "Selamat datang kembali" (FN-M27-1.1.2, AC-M27-01.3). (4) Data definitions mapped to owners (M02/M01, M10, M02 subscriptions, M08, M18, M05 through M08); owner requests XR-M27-06…10 in the SRS. (5) OQ-M27-01 closed as SERVER-DECK except the part below "Taburan Gred (Anggaran)" (OQ-M27-11); new OQ-M27-12…14. (6) UD-2 ("visible parts only, placeholders") superseded for the cards by D24 (UD-3). Totals: 11 stories, 34 FN, **51 AC** (v1.1: 9 / 25 / 37). No audit R2-01 text exists in these two files; nothing related was changed. |
| 1.1 | 2026-10-03 | **Audit round 1 fixes (SRS v1.1 carries the same).** AUD-M27-01 (Major): privacy rule and static check re-scoped to M27-owned files; owner-managed public anchors (school 8090, M09 seed #3 title) exempt (DL-7, FN-M27-1.7.3, AC-M27-08.6); L07 discovery line 55 title redacted. AUD-M27-02 (Major): `/dashboard` is a dependency on M05-T3 (not built; dev preview stub only), XR-M27-04 to M05, AC-M27-05.2 `@blocked-by M05-T3` (DL-3, OQ-M27-02). AUD-M27-03: chip icons stated (type PROPOSED). AUD-M27-04: slot tiles render four unlabeled decorative glyphs. AUD-M27-05: DV-M27-04, DV-M27-05 added. AUD-M27-06: SERVER tags corrected. AUD-M27-07: AC-M27-01.5 added. AUD-M27-08: avatar rule cites M01 BR-15. AUD-M27-09: AC-M27-02.4 made exact; banner name capitals by CSS only. AUD-M27-10: sidebar footer card in coverage matrix. AUD-M27-11: AC-M27-01.2 tagged PROPOSED. AUD-M27-12: cross-reference to M08 S1. AUD-M27-13: OQ-M27-09 (shells.md line 73 stale). AUD-M27-14: hook routed through XR-M27-05 to M02. Totals: 9 stories, 25 FN, 37 AC. |
| 1.0 | 2026-10-03 | First issue. Owner M27 (UD-1). Build only the visible parts (UD-2). DL decisions on OQ-L07-02…07 recorded in §0.1. |

### 0.1 Decisions applied (2026-10-03)

| ID | Decision | By | Tag |
|---|---|---|---|
| UD-1 | **Owner of S0 = M27** (not M17). Closes OQ-L07-03. The roles-matrix cell "M17 / M05" for the Admin Sekolah part is for the Delivery Lead to relabel. | User | decided |
| UD-2 | Build only the visible parts: user shell, "Perutusan Terkini" card, breadcrumb, red school banner; the four stat cards and below were then unreadable and specified as placeholders. | User | decided; **cards superseded by UD-3** |
| UD-3 | **D24 amendment (coordinator, 2026-10-03):** the server copy's deck is the spec for the part below the banner; the live screenshot wins where both show something and differ. The placeholders of UD-2 are replaced (cards, "Ringkasan Prestasi"). | User rule D24 | decided |
| DL-1 | **No `/admin-sekolah/pilih-sekolah` screen** (OQ-L07-02). The school comes from the session user's school. A user with no school, and the platform admin, get **403 "Akses Ditolak"** (D9 fix of the live 500, D-M27-01; DV-M27-01). | DL | decided |
| DL-2 | **No change to the M01 login redirect** (OQ-L07-04): `school_admin` still lands on `/dashboard` (M01 BR-07). | DL | decided |
| DL-3 | "← Papan Pemuka" target chosen from evidence: **`/dashboard`** (M05 S1, the M01 landing of `school_admin`; M08 pages already use it for their "Papan Pemuka" breadcrumb). `/admin-sekolah` is excluded because it would be a link to the page itself. **`/dashboard` is not built yet**: M05-T3 (Session 8) is in flight; today only a dev preview stub exists (`core-routes.ts`). M05 SRS §9 lists Admin Sekolah as "same as Pelajar (INFERRED)", so `school_admin` is expected to be admitted, but the route role list is unconfirmed: XR-M27-04 to M05, OQ-M27-02 stays open (non-blocking). | DL | INFERRED; dependency M05-T3 |
| DL-4 | "Perutusan Terkini" shows the latest visible perutusan rows from the M09 store (1 row observed): row = title, "{role} · {relative time}", initials avatar. Empty state copy unobserved: **no copy invented, the list is hidden** (OQ-L07-05). "Lihat semua →" links to the M09 list route `/perutusan` (M09 SRS FR-M09-93; route not built yet, M09-T4). | DL | INFERRED; OQ-M27-03 |
| DL-5 | Banner shows state, PPD name and "# Kod: {code}" as plain text, not clickable (OQ-L07-06). | DL | INFERRED |
| DL-6 | S0 uses the **user shell**, like the aliases `/admin-sekolah/command-center`, `/monitoring`, `/kirkpatrick` (OQ-L07-07). | DL | INFERRED (shells.md §1.2 provisional) |
| DL-7 | Privacy (CLAUDE.md §6 covers personal names only; public institutions may appear where they are observed public anchors): **no real person's name anywhere**. The screenshot's and the deck's school code, school name and post title are **not hard-coded in any M27-owned file** (M27 docs, `src/modules/m27-*`, `e2e/m27-*`); they reach the page only through owner seeds. Exempt, owner-managed: M02 school 8090 (observed public anchor; its banner name is acceptable) and the M09 seed #3 post title (seed content, not a personal name). **The deck's figures are never copied into seeds**: every figure is computed from the owner datasets for the fixture schools (§1.4). | DL | rule |

### 0.2 Changes in v1.2 that need the user's G1 re-approval (scope grew)

1. The four cards "JUMLAH PELAJAR", "JUMLAH GURU", "KELAS AKTIF", "LANGGANAN" with live data (was: empty placeholder slots).
2. The new card "Ringkasan Prestasi" with four panels and "Taburan Gred (Anggaran)" with "Lihat penuh →" (was: not in scope).
3. New dependencies on owners: M08 (GPS, grades, levels, practice stats), M18 (Amaran Awal tally; M18 is not built), M10 (active classes), M02 (school subscription), plus the links to M08 S1 and S2.
4. Header title/subtitle changed to "Dashboard Sekolah" / school name.
5. The API response grows (SRS §7 #1); AC count 37 to 51, E2E 25 to 34.

---

## 1. Overview

S0 is the **home page of the school admin** (sidebar item "Dashboard", first in the HARIAN section of the live capture). It shows the latest announcements, the school the admin runs, four school counts and a performance summary with a link to the full school performance page.

### 1.1 Screen

| # | Route | Shell | Header | Role | Outcome |
|---|---|---|---|---|---|
| S0 | `/admin-sekolah` | user | "Dashboard Sekolah" / "{school name}" (SERVER-DECK; the live capture shows "D…" and "S…" under a popup, consistent) | `school_admin` with a school | 200 |

Tab title (PROPOSED): "Dashboard Sekolah - PRESTASIPLUS" (not visible in any evidence; differs from M08 S1's "Dashboard Sekolah — Prestasi").

### 1.2 Page, top to bottom

1. Top bar (user shell): hamburger, title and subtitle, bell, avatar with initials, logout icon. (OBSERVED; title and subtitle SERVER-DECK)
2. Dark card **"Perutusan Terkini"**: gold icon, heading, link "Lihat semua →" (right), post rows: initials avatar, title, meta "Pengetua · {n} bulan yang lepas". (OBSERVED; absent from the older deck)
3. Breadcrumb **"← Papan Pemuka"** then "Dashboard Sekolah" (current, bold). (OBSERVED, same in the deck)
4. Red **school banner**: large building icon in a rounded square; school name in capitals; line "Admin Sekolah" **below** the name (live; the deck shows it as a pill beside the name, live wins); chips: state with a leading pin icon, PPD name with its own small leading icon, "# Kod: {code}". (OBSERVED)
5. **Four summary cards** in one row (OBSERVED colours and icon tiles; labels and values SERVER-DECK): "JUMLAH PELAJAR" (blue), "JUMLAH GURU" (teal/mint), "KELAS AKTIF" (pink/red), "LANGGANAN" (green on live; grey in the deck, see DV-M27-04). Each: tinted card, icon tile at top-left, label, large value, a thin bar at the foot in the card's colour.
6. White card **"Ringkasan Prestasi"** (blue icon tile; subtitle "GPS, risiko murid, ketepatan latihan & perbandingan tingkatan") with four panels in one row (SERVER-DECK):
   - "GPS SEKOLAH" (amber tint): value, "{grade} · {band}", "{n} entri headcount".
   - "AMARAN AWAL" (pink tint): "Selamat", "Berhati", "Berisiko" tallies, "{n} murid dinilai".
   - "LATIHAN" (lavender tint): "{p}%", "Purata Ketepatan", "{n} sesi · {n} soalan".
   - "TINGKATAN" (indigo tint): "Tingkatan 4" and "Tingkatan 5" with percentage and bar, "Click untuk detail".
7. Below the panels, inside the same card: sub-heading **"Taburan Gred (Anggaran)"** with the link **"Lihat penuh →"** on the right. What follows is cut off in the deck (INFERRED: the grade list of the linked page, OQ-M27-11).

Deck-only items not adopted (live wins or shell-owned): the deck sidebar order and entries ("Cipta Pengguna" etc.) and the deck top-bar subtitle position are superseded by the live screenshot; the deck has no "Perutusan Terkini" card because it predates it.

### 1.3 Ownership and data

S0 **owns no store** (D12). Reads: school and users (M02/M01), perutusan (M09), classes (M10), school subscription (M02), performance (M08), early-warning tally (M18). Nothing is written.

### 1.4 Fixtures used (existing records, read-only check on 2026-10-03)

| Use | Record | Value |
|---|---|---|
| Primary school (full banner) | M02 fixture school **900003** "SMK Demo Seri Putra" | state Selangor, district "PPD HULU LANGAT", code `DMO0003` |
| Primary school admin | M01/M09 anchor user **3102** `azlan@demo.test` "Azlan Demo", role `school_admin`, school 900003 | initials "AD" |
| Primary perutusan row | M09 perutusan **#4** (scope school 900003, pinned, author 3102) | visible to 3102 only (school scope) |
| Secondary | canonical user **8** `adminsekolah@demo.test` at M02 900001 "SMK DEMO" (Selangor, "PPD PETALING UTAMA", `BEA4001`); under the test profile `subscriptions-extra` only (`mock.reset({profile: 'subscriptions-extra'})`), M02 holds one grace subscription row at 900001; the default seed has none | sees M09 perutusan **#2** (author 3103 `salina@demo.test`, same school); "LANGGANAN" shows "Tempoh Ihsan" under that profile (PROPOSED label, M02 wording), "Belum Ada" under the default seed |
| Edge: no PPD, no code | M02 fixture school **900002** "SK Demo" (Johor, district null, code empty), school admin **3104** `suhaimi@demo.test` | sees M09 perutusan **#3** |
| Empty perutusan | the generated M02 school admin of school **8090** (exists, M01 users-store test); 8090 is an observed public M02 anchor, so its banner shows its real public school name (acceptable under DL-7) | no visible perutusan |
| Role refusals | canonical `admin@demo.test` (1), `guru@demo.test` (5), `pelajar@demo.test` (2) | 403 |

**Figures on the cards and panels are not pinned in this document.** For every fixture school they are computed from the owner datasets (M02 users, M10 classrooms, M02 subscription, M08 performance, M18 risk) and the E2E tests compare the page with the owner's own query for the same school (SRS §12 oracle); the deck's values are never used. The fixture schools hold few or no pupils, so most panels of these personas show zero or no-data states; the build task records the computed values in its test and may add an owner-side anchor through the owner's own process.

At the project clock 2026-09-25T15:40:00+08:00 the three posts read "6 bulan yang lepas" (computed with the project relative-time rule, M09 BR-M09-09).

---

## 2. Actors

| Role | Involvement | Verified |
|---|---|---|
| Admin Sekolah (`school_admin`, with a school) | Sees S0. | OBSERVED (page); SERVER (adjacent screens, scope rule) |
| Admin Sekolah without a school | 403, never national data. | SERVER (adjacent screens, `StaffScope.php:128-148`) / PROPOSED (DL-1) |
| Admin (platform) | 403 on S0. Live: redirect to a picker that returns 500 (D-M27-01). | OBSERVED (live behaviour); DL-1 |
| Teacher, pupil, parent, sponsor, PPD, JPN | 403 "Akses Ditolak", as the M17 alias routes. | INFERRED (consistent with FR-M17-102) |
| Guest | Redirected to `/login` (M01 guard). | INFERRED |

---

## 3. Functional breakdown (Epic → Feature → Function)

EL ids are the discovery element ids (L07 §5) plus EL-L07-09 (sidebar, discovery E6), EL-L07-10 (Ringkasan Prestasi card) and EL-L07-11 (Taburan Gred).

### EP-M27-1 — S0 Dashboard Sekolah

**FT-M27-1.1 — Route, shell, titles**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M27-1.1.1 | Route `/admin-sekolah` renders S0 in the user shell for a `school_admin` with a school. | EL-L07-09 | Admin Sekolah | OBSERVED (URL) / INFERRED (shell, DL-6) |
| FN-M27-1.1.2 | Header title "Dashboard Sekolah", subtitle = the school name (M02 `name`); tab title "Dashboard Sekolah - PRESTASIPLUS". | EL-L07-01 | Admin Sekolah | SERVER-DECK (header) / PROPOSED (tab) |
| FN-M27-1.1.3 | Top bar (hamburger or sidebar, bell, avatar with the initials of the session user per M01 BR-15 / shell `avatar.ts`, logout) is the user shell's; no gamification chips for this role. M27 supplies no content to it. | EL-L07-02 | Admin Sekolah | OBSERVED (shape) / shell-owned |
| FN-M27-1.1.4 | Sidebar item "Dashboard" (HARIAN) → `/admin-sekolah` is active on exactly that path (not on `/admin-sekolah/*`). | EL-L07-09 | Admin Sekolah | OBSERVED |

**FT-M27-1.2 — Access and scope**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M27-1.2.1 | Guest on `/admin-sekolah` → `/login`. | — | Guest | INFERRED |
| FN-M27-1.2.2 | Any signed-in role other than `school_admin` (platform admin included) → the global 403 page "Akses Ditolak". | — | all others | DL-1 / INFERRED |
| FN-M27-1.2.3 | A `school_admin` whose account has no school → 403; never platform or national figures. | — | Admin Sekolah | SERVER (adjacent screens, `StaffScope.php:128-148`; no server route for `/admin-sekolah`) / PROPOSED (DL-1) |
| FN-M27-1.2.4 | The school is the session user's school; no school id from the URL, query or body is honoured; every figure of S0 is confined to it. | — | Admin Sekolah | SERVER (adjacent screens) / PROPOSED (DL-1) |
| FN-M27-1.2.5 | `/admin-sekolah/pilih-sekolah` is not built: it answers the global 404 page. | — | all | DL-1 |

**FT-M27-1.3 — Perutusan Terkini**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M27-1.3.1 | Dark card with gold icon, heading "Perutusan Terkini" and link "Lihat semua →" on the right. | EL-L07-03 | Admin Sekolah | OBSERVED |
| FN-M27-1.3.2 | Rows = the latest visible perutusan from the M09 store, in M09's order, at most 3; row = initials avatar (M09 BR-M09-29), title, meta "{role label} · {relative time}" (e.g. "Pengetua · 6 bulan yang lepas"). | EL-L07-03 | Admin Sekolah | OBSERVED (1 row, format) / INFERRED (source, order) / PROPOSED (max 3) |
| FN-M27-1.3.3 | No visible post → the row list is hidden (card header stays); no empty-state copy is invented. | EL-L07-03, EL-L07-08 | Admin Sekolah | INFERRED |
| FN-M27-1.3.4 | "Lihat semua →" → `/perutusan` (M09 S22). | EL-L07-03 | Admin Sekolah | OBSERVED (link) / INFERRED (target) |
| FN-M27-1.3.5 | Only posts visible to the viewer under the M09 visibility rule (national, or own school) appear; another school's post never does. | EL-L07-03 | Admin Sekolah | INFERRED (M09 BR-M09-23) |

**FT-M27-1.4 — Breadcrumb**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M27-1.4.1 | "← Papan Pemuka" (link) → `/dashboard` (route built by M05-T3; dependency), a separator, "Dashboard Sekolah" (current, bold, not a link). | EL-L07-04 | Admin Sekolah | OBSERVED + SERVER-DECK (copy) / INFERRED (target, DL-3) |

**FT-M27-1.5 — School banner**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M27-1.5.1 | Red banner: building icon in a rounded square, school name displayed in capitals by **CSS only** (the stored case stays in the text, so `textContent` is the M02 `name`), line "Admin Sekolah" **below** the name (live wins over the deck's pill). | EL-L07-05 | Admin Sekolah | OBSERVED (capitals, line) / INFERRED (CSS only) |
| FN-M27-1.5.2 | Chips as plain text, not clickable: "{state}" with a leading pin icon, "{PPD name}" with its own small leading icon (icon types unreadable in the capture: PROPOSED, decorative), "# Kod: {code}" (text only). | EL-L07-05 | Admin Sekolah | OBSERVED + SERVER-DECK (copy) / INFERRED (not clickable, DL-5; PPD = M02 district) |
| FN-M27-1.5.3 | A school without a PPD name or without a code omits that chip (no placeholder text). | EL-L07-05 | Admin Sekolah | PROPOSED |

**FT-M27-1.6 — Summary cards**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M27-1.6.1 | Four cards in one row, in order "JUMLAH PELAJAR" (blue), "JUMLAH GURU" (teal/mint), "KELAS AKTIF" (pink/red), "LANGGANAN" (green when a subscription exists, grey when "Belum Ada"); each with a tinted background and border, a coloured icon tile at top-left (pupil/graduation cap, teacher at a board, door, ID card), the label (upper case by CSS), a large value in the card's dark hue, and a thin bar at the foot in the card's colour. Not links. | EL-L07-06 | Admin Sekolah | OBSERVED (colours, tile position, glyph shapes) + SERVER-DECK (labels, values, bar) / INFERRED (not links; grey state) |
| FN-M27-1.6.2 | "JUMLAH PELAJAR" = the students of the viewer's school; "JUMLAH GURU" = the teachers of the viewer's school; integer, `ms-MY` thousands separator. | EL-L07-06 | Admin Sekolah | SERVER-DECK (cards) / SERVER (`SchoolAggregates`: count of role pelajar / guru with `school_id` = school) |
| FN-M27-1.6.3 | "KELAS AKTIF" = the active classes of the viewer's school as M10 defines them (M10 `classrooms.list({isActive: true, schoolId})`, the read M08 uses). Which school link defines "of the school" (the class `schoolId` or the owning teacher's school) is for M10 to confirm (XR-M27-07). | EL-L07-06 | Admin Sekolah | SERVER-DECK (card) / INFERRED (definition) |
| FN-M27-1.6.4 | "LANGGANAN" shows "Belum Ada" when the school has no current subscription (no row, or only a `cancelled` row); otherwise the status of its current subscription ("Aktif", "Tempoh Ihsan", "Tamat", the M02 BR-23 badge wording). | EL-L07-06 | Admin Sekolah | SERVER-DECK ("Belum Ada") / PROPOSED (other values, unobserved) |

**FT-M27-1.7 — Layout and quality**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M27-1.7.1 | No horizontal page scroll at 375 / 768 / 1280; banner chips wrap; cards and panels reflow. | — | Admin Sekolah | PROJECT RULE (CLAUDE.md §7) |
| FN-M27-1.7.2 | Text at least 12 px. | — | Admin Sekolah | PROJECT RULE (M17 DV-M17-25 precedent) |
| FN-M27-1.7.3 | No real person's name anywhere. M27-owned files (M27 docs, `src/modules/m27-*`, `e2e/m27-*`) do not hard-code the screenshot's or the deck's school code, school name or post title, nor any deck figure; they come only from owner seeds. Owner-managed public anchors (M02 school 8090, the M09 seed #3 title) are exempt. | — | — | PROJECT RULE (CLAUDE.md §6; DL-7) |
| FN-M27-1.7.4 | While loading: the shell's loading state. Load failure other than 403: the global error convention of M01; no M27 copy. | EL-L07-08 | Admin Sekolah | PROPOSED |

**FT-M27-1.8 — Inbound links**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M27-1.8.1 | The sidebar "Dashboard" and the M17 Command Center "← Dashboard" (FR-M17-112) both resolve to S0. | EL-L07-09 | Admin Sekolah | OBSERVED (sidebar) / INFERRED (M17) |

**FT-M27-1.9 — Ringkasan Prestasi**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M27-1.9.1 | White card with a blue icon tile (bar-chart glyph), title "Ringkasan Prestasi" and subtitle "GPS, risiko murid, ketepatan latihan & perbandingan tingkatan", then four panels in one row. | EL-L07-10 | Admin Sekolah | SERVER-DECK |
| FN-M27-1.9.2 | Panel "GPS SEKOLAH" (amber tint at the observed band): the school GPS (2 decimals, in the band colour), the line "{grade} · {band}" (grade at round(GPS), M08 BR-M08-04; band per M08 BR-M08-03, e.g. "B · Sederhana"), and "{n} entri headcount" (graded entries). | EL-L07-10 | Admin Sekolah | SERVER-DECK (layout, copy) / SERVER-owner (M08 formulas) / INFERRED (tint follows band) |
| FN-M27-1.9.3 | Panel "AMARAN AWAL" (pink tint): three tallies "Selamat" (green), "Berhati" (amber), "Berisiko" (red) = the pupils of the school with risk status On Track / Perlu Perhatian / Berisiko Tinggi (M18 BR-M18-14), and "{n} murid dinilai" = their sum. | EL-L07-10 | Admin Sekolah | SERVER-DECK (layout, copy, cross-checked against the Amaran page, Session 2 §5.3) / owner M18 |
| FN-M27-1.9.4 | Panel "LATIHAN" (lavender tint): the school's mean session accuracy "{p}%" (1 decimal, purple), "Purata Ketepatan", and "{n} sesi · {n} soalan" (completed sessions · answered questions, `ms-MY` separator). | EL-L07-10 | Admin Sekolah | SERVER-DECK (layout, copy) / SERVER (`SchoolAggregates`: mean of session accuracy; "—" when no session) |
| FN-M27-1.9.5 | Panel "TINGKATAN" (indigo tint): a row per level "Tingkatan 4" and "Tingkatan 5" with the level's mean accuracy "{x}%" (1 decimal, colour amber 50–69.9 / emerald ≥ 70 / red < 50, M08 FR-M08-19) and a bar of that width; the foot text "Click untuk detail"; the whole panel links to `/prestasi/tingkatan` (M08 S2). | EL-L07-10 | Admin Sekolah | SERVER-DECK (layout, copy, amber) / INFERRED (panel is the link; other colours) |
| FN-M27-1.9.6 | Sub-heading "Taburan Gred (Anggaran)" with the link "Lihat penuh →" on its right → `/prestasi/sekolah` (M08 S1, the school Prestasi dashboard); under it the grade distribution (A+ … G: letter, bar, count, percentage; footer "Jumlah: {n} rekod"), the same data as M08 FR-M08-15. | EL-L07-11 | Admin Sekolah | SERVER-DECK (heading, link; distribution on the linked page) / INFERRED (the list on S0 is cut off in the deck, OQ-M27-11) |
| FN-M27-1.9.7 | No-data states: no headcount entries → GPS "—" with no "{grade} · {band}" line and "0 entri headcount"; no rated pupil → "0", "0", "0" and "0 murid dinilai"; no session → "—" and "0 sesi · 0 soalan"; the two level rows always shown; no entries → zero rows and "Jumlah: 0 rekod". All figures are confined to the viewer's school. | EL-L07-10, EL-L07-11 | Admin Sekolah | INFERRED (SERVER null convention "—") |

Total: **34 Functions** (v1.1: 25).

---

## 4. User stories

Values use the project clock 2026-09-25T15:40:00+08:00 and the fixtures of §1.4. E2E runs at 375x812, 768x1024 and 1280x800. "Oracle" = the page equals the owner's own query for the same school (SRS §12).

| ID | Feature | MoSCoW | Story | Functions |
|---|---|---|---|---|
| US-M27-01 | FT-M27-1.1 | Must | As a school admin, I want my home page "Dashboard Sekolah" in the portal shell with "Dashboard" highlighted, so that I know where I am. | FN-M27-1.1.1–1.1.4 |
| US-M27-02 | FT-M27-1.5 | Must | As a school admin, I want a banner with my school's name, my role, state, PPD and code, so that I see which school I am managing. | FN-M27-1.5.1–1.5.3 |
| US-M27-03 | FT-M27-1.3 | Must | As a school admin, I want the latest announcements on my home page, so that I do not miss management messages. | FN-M27-1.3.1, 1.3.2, 1.3.3, 1.3.5 |
| US-M27-04 | FT-M27-1.3 | Must | As a school admin, I want "Lihat semua →" to open all announcements, so that I can read older ones. | FN-M27-1.3.4 |
| US-M27-05 | FT-M27-1.4 | Must | As a school admin, I want a breadcrumb back to "Papan Pemuka", so that I can leave the page in one click. | FN-M27-1.4.1 |
| US-M27-06 | FT-M27-1.6 | Must | As a school admin, I want four cards with my school's pupils, teachers, active classes and subscription, so that I see the size of my school at a glance. | FN-M27-1.6.1–1.6.4 |
| US-M27-07 | FT-M27-1.2 | Must | As the owner, I want S0 closed to guests and other roles, shown only for the user's own school and never national figures, so that no school sees another's data. | FN-M27-1.2.1–1.2.5 |
| US-M27-08 | FT-M27-1.7 | Must | As a school admin on a phone, tablet or desktop, I want the page to fit and be readable in Bahasa Melayu, so that I can use it anywhere. | FN-M27-1.7.1–1.7.4 |
| US-M27-09 | FT-M27-1.8 | Should | As a school admin, I want "Dashboard" and the Command Center's "← Dashboard" to bring me to this page, so that navigation is consistent. | FN-M27-1.8.1 |
| US-M27-10 | FT-M27-1.9 | Must | As a school admin, I want a performance summary (GPS, early-warning counts, practice accuracy, level comparison, grade distribution) on my home page, so that I judge how my school is doing without opening other pages. | FN-M27-1.9.1–1.9.7 |
| US-M27-11 | FT-M27-1.9 | Should | As a school admin, I want to open the full school performance page and the level pages from the summary, so that I can look into a figure. | FN-M27-1.9.5, 1.9.6 |

### Acceptance criteria

**US-M27-01 — Shell, titles**
- **AC-M27-01.1** Given `azlan@demo.test` at 1280 px, when I open `/admin-sekolah`, then the page renders inside the user shell with the sidebar visible, "Dashboard" under HARIAN is shown active, and the sidebar links "Senarai Pelajar", "Senarai Guru" and "Kelas Sekolah" are present but not active.
- **AC-M27-01.2** (PROPOSED, shell-owned: the breakpoint is `shells.md` §3, below `lg` = 1024 px; the only capture is tablet-width with sidebar and hamburger together and its real width is unknown) Given the same user at 375 px and at 768 px, when I open `/admin-sekolah`, then no sidebar is rendered, the hamburger opens the drawer in which "Dashboard" is active, and the page has no horizontal scroll.
- **AC-M27-01.3** Given the same user, when the page loads, then the header title reads "Dashboard Sekolah" and its subtitle is the school name "SMK Demo Seri Putra" (SERVER-DECK), and the tab title is "Dashboard Sekolah - PRESTASIPLUS" (PROPOSED).
- **AC-M27-01.4** Given the same user, when the top bar renders, then the avatar shows "AD" (initials of "Azlan Demo", M01 BR-15), a bell and a logout control are present, and no coin, point or streak chip is shown.
- **AC-M27-01.5** Given `azlan@demo.test` at 1280 px on `/admin-sekolah/monitoring` (user shell, M11 alias), when the sidebar renders, then "Dashboard" is present but not active; on `/admin-sekolah` it is active (FR-M27-02, exact match).

**US-M27-02 — Banner**
- **AC-M27-02.1** Given `azlan@demo.test`, when S0 loads, then the banner shows the building icon, the name of M02 school 900003 (`textContent` "SMK Demo Seri Putra", computed style `text-transform: uppercase`, so it displays in capitals), the line "Admin Sekolah" below the name, and the chips: pin icon + "Selangor", icon + "PPD HULU LANGAT", and "# Kod: DMO0003" (icon types PROPOSED, decorative).
- **AC-M27-02.2** Given the banner, when I click or tap any chip, the school name or the banner, then nothing happens (no link, no navigation).
- **AC-M27-02.3** Given `suhaimi@demo.test` (school 900002 "SK Demo": Johor, no PPD, no code), when S0 loads, then the banner shows the name, "Admin Sekolah" and the state chip "Johor" only; no PPD chip, no "# Kod:" chip and no placeholder text such as "-" or "Tiada kod" appears (PROPOSED).
- **AC-M27-02.4** Given `azlan@demo.test`, when S0 loads, then, with the banner name element, the header subtitle, the "Perutusan Terkini" card and the "Taburan Gred" rows removed from the text, the remaining page text (case-sensitive) contains neither "SMK DEMO" nor "SK Demo" nor any other M02 school name as a whole string. Note: the perutusan row titles are M09 seed content outside M27 scope (the M09 #4 title names a school unlike the banner school; this is not an M27 defect and is excluded from this assertion).

**US-M27-03 — Perutusan Terkini**
- **AC-M27-03.1** Given `azlan@demo.test` at the project clock, when S0 loads, then the dark card shows the heading "Perutusan Terkini", the link "Lihat semua →", and exactly one row: initials "AD", the title of M09 perutusan #4 as seeded, and the meta line "Pengetua · 6 bulan yang lepas".
- **AC-M27-03.2** Given `suhaimi@demo.test`, then the card shows one row, M09 #3, initials "SM", "Pengetua · 6 bulan yang lepas"; given `adminsekolah@demo.test`, then one row, M09 #2, initials "SA", "Pengetua · 6 bulan yang lepas".
- **AC-M27-03.3** Given `azlan@demo.test`, when S0 loads, then the titles of M09 #2 and #3 do not appear anywhere on the page, and the response of the dashboard endpoint does not contain them.
- **AC-M27-03.4** Given the generated school admin of school 8090 (no visible perutusan), when S0 loads, then the card header ("Perutusan Terkini", "Lihat semua →") is shown, no row and no empty-state sentence is rendered (INFERRED; provisional).
- **AC-M27-03.5** Given the platform admin has created four national perutusan visible to `azlan@demo.test` in addition to #4, when S0 loads, then exactly 3 rows are shown, the first 3 of the M09 order (PROPOSED limit; provisional).

**US-M27-04 — "Lihat semua →"**
- **AC-M27-04.1** Given S0, when I inspect "Lihat semua →" in the Perutusan card, then it is a link whose target is `/perutusan`.
- **AC-M27-04.2** Given M09 S22 is built, when I click "Lihat semua →", then M09's "Perutusan" list opens for me (`@blocked-by M09-T4`; provisional until then).

**US-M27-05 — Breadcrumb**
- **AC-M27-05.1** Given S0, when it loads, then the breadcrumb reads "← Papan Pemuka", a separator, "Dashboard Sekolah", placed between the Perutusan card and the banner.
- **AC-M27-05.2** Given the breadcrumb, when I click "← Papan Pemuka", then I arrive at `/dashboard` and M05 S1 renders for `school_admin` without a redirect or 403 (INFERRED; provisional; `@blocked-by M05-T3`, route not built, XR-M27-04).
- **AC-M27-05.3** Given the breadcrumb, then "Dashboard Sekolah" is bold and is not a link.

**US-M27-06 — Summary cards**
- **AC-M27-06.1** Given `azlan@demo.test` at 1280 px, when S0 loads, then four cards sit in one row below the banner, in the order "JUMLAH PELAJAR", "JUMLAH GURU", "KELAS AKTIF", "LANGGANAN" (visible text, upper case), tinted blue, teal/mint, pink/red and (green or grey), each with a coloured icon tile at its top-left holding an icon element, a large value and a thin foot bar; none of the four is a link.
- **AC-M27-06.2** Given a fixture school S, when S0 loads, then "JUMLAH PELAJAR" equals the M02 count of users with role `student` and `schoolId` S, and "JUMLAH GURU" equals the M02 count of users with role `teacher` and `schoolId` S (oracle), both formatted with the `ms-MY` thousands separator.
- **AC-M27-06.3** Given the same school, then "KELAS AKTIF" equals the M10 count `classrooms.list({isActive: true, schoolId: S})` (oracle).
- **AC-M27-06.4** Given `azlan@demo.test` (school 900003, no subscription row), then "LANGGANAN" reads "Belum Ada" in the grey card (INFERRED grey); given `adminsekolah@demo.test` (school 900001) after `mock.reset({profile: 'subscriptions-extra'})` (the only profile with the grace row at 900001; the default seed has none, so without the profile it reads "Belum Ada"), then it reads "Tempoh Ihsan" in the green card (PROPOSED value, live colour); a school whose only row is `cancelled` reads "Belum Ada" (PROPOSED). Provisional until the owner confirms the rows.
- **AC-M27-06.5** Given the page for any school, then the four cards are not links and the cards contain no figure other than the one value each.

**US-M27-07 — Access and scope**
- **AC-M27-07.1** Given no session, when I open `/admin-sekolah`, then I am sent to `/login`.
- **AC-M27-07.2** Given `admin@demo.test` (platform admin), when I open `/admin-sekolah`, then the global 403 page shows "403", "🚫", "Akses Ditolak", "Anda tidak mempunyai kebenaran untuk mengakses halaman ini. Sila log masuk dengan akaun yang betul atau hubungi pentadbir.", "Halaman Utama" → `/`, "Log Masuk" → `/login`, "PRESTASIPLUS"; no redirect to a picker and no 500.
- **AC-M27-07.3** Given `guru@demo.test`, `pelajar@demo.test`, a parent, a sponsor, a PPD officer or a JPN officer, when I open `/admin-sekolah`, then the same 403 page shows (INFERRED).
- **AC-M27-07.4** Given a `school_admin` account whose school is null (test fixture), when I open `/admin-sekolah`, then the same 403 page shows and no school name, figure or perutusan appears.
- **AC-M27-07.5** Given `azlan@demo.test`, when I open `/admin-sekolah?school_id=900001`, then the banner still shows school 900003; and when I open `/admin-sekolah/pilih-sekolah`, then the global 404 page shows ("404", "🔍", "Halaman Tidak Dijumpai", "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?", "Halaman Utama", "Mula Latihan", "PRESTASIPLUS").
- **AC-M27-07.6** Given the dashboard endpoint `GET /api/admin-sekolah/dashboard`, when called by a guest, a non-`school_admin` or a `school_admin` without a school, then it answers 401, 403 and 403 respectively, with no data.

**US-M27-08 — Responsive, readable, clean**
- **AC-M27-08.1** Given `azlan@demo.test` at 375, 768 and 1280 px, when S0 loads, then the document has no horizontal scroll.
- **AC-M27-08.2** Given the same, then every text node on the page is at least 12 px.
- **AC-M27-08.3** Given 375 px, then the three banner chips wrap onto further lines without clipping, and long perutusan titles wrap inside the card.
- **AC-M27-08.4** Given the layout, then the four cards are 4 per row at 1280 and 768 px and 2 per row at 375 px, and the four panels of "Ringkasan Prestasi" are 4 per row at 1280 px, 2 per row at 768 px and 1 per row at 375 px (PROPOSED reflow; the deck shows only the 1280 layout).
- **AC-M27-08.5** Given the dashboard endpoint fails with a server error, when S0 loads, then the global error page of M01 shows (no M27-specific copy; provisional).
- **AC-M27-08.6** Given the M27-owned files after the build (M27 URS/SRS, `src/modules/m27-*`, `e2e/m27-*`), when scanned, then they contain no real person's name and do not hard-code the screenshot's or the deck's school code, school name or post title, nor any deck figure (the scan list is kept outside the repository). M02 school 8090 and the M09 seed #3 title in owner files are exempt (DL-7).

**US-M27-09 — Inbound links**
- **AC-M27-09.1** Given `azlan@demo.test` on any user-shell page, when I click the sidebar item "Dashboard" (HARIAN), then S0 opens.
- **AC-M27-09.2** Given `/admin-sekolah/command-center`, when I click "← Dashboard", then S0 opens.

**US-M27-10 — Ringkasan Prestasi**
- **AC-M27-10.1** Given a school admin, when S0 loads, then below the cards a white card shows the title "Ringkasan Prestasi" with the subtitle "GPS, risiko murid, ketepatan latihan & perbandingan tingkatan" and four panels, in order labelled "GPS SEKOLAH", "AMARAN AWAL", "LATIHAN", "TINGKATAN" (visible text, upper case), tinted amber, pink, lavender and indigo.
- **AC-M27-10.2** Given a school with graded headcount entries, then the "GPS SEKOLAH" panel shows the M08 school GPS with 2 decimals (oracle: M08 `schoolPerformance` for that school), the line "{grade} · {band}" where grade is the grade at round(GPS) (half up) and band the M08 band name (e.g. GPS between 4 and 6 gives "Sederhana"), and "{n} entri headcount" with n = M08 `gps.entries`.
- **AC-M27-10.3** Given a school with no graded headcount entry, then the panel shows "—", no "{grade} · {band}" line and "0 entri headcount" (INFERRED; provisional).
- **AC-M27-10.4** Given a school with rated pupils, then the "AMARAN AWAL" panel shows three numbers labelled "Selamat", "Berhati" and "Berisiko" equal to the M18 `Q-M18-RISK` counts On Track, Perlu Perhatian and Berisiko Tinggi for that school (oracle), and the line "{n} murid dinilai" with n = their sum; the sum equals the pupils the M18 school Amaran page (S22) lists for the same school (`@blocked-by M18`).
- **AC-M27-10.5** Given a school with completed practice sessions, then the "LATIHAN" panel shows "{p}%" (1 decimal) equal to the M08 school accuracy, the text "Purata Ketepatan", and "{n} sesi · {m} soalan" equal to M08 `stats.sessions` and `stats.answered`, with `ms-MY` thousands separators.
- **AC-M27-10.6** Given a school with no completed session, then the panel shows "—" instead of the percentage and "0 sesi · 0 soalan" (INFERRED; provisional).
- **AC-M27-10.7** Given any school, then the "TINGKATAN" panel shows exactly two rows, "Tingkatan 4" and "Tingkatan 5", each with the percentage equal to the M08 level accuracy (1 decimal; amber from 50 to 69.9, emerald from 70, red below 50) and a bar of that width, and the foot text "Click untuk detail".
- **AC-M27-10.8** Given a school with graded entries, then under the sub-heading "Taburan Gred (Anggaran)" the grade list shows A+, A, A-, B+, B, C+, C, D, E, G with count and percentage equal to M08 `distribution` and the footer "Jumlah: {n} rekod" (INFERRED layout; provisional).
- **AC-M27-10.9** Given a school with no graded entry, then every grade row shows 0 and "0%" and the footer reads "Jumlah: 0 rekod" (INFERRED; provisional).
- **AC-M27-10.10** Given `azlan@demo.test`, then every figure of the cards and panels equals the owner query for school 900003 only and changes when another school admin signs in; no figure is the platform total.

**US-M27-11 — Links to the detail pages**
- **AC-M27-11.1** Given S0, when I inspect "Lihat penuh →" next to "Taburan Gred (Anggaran)", then it is a link to `/prestasi/sekolah`, and clicking it opens M08 S1 for my school.
- **AC-M27-11.2** Given the "TINGKATAN" panel, when I click it (the foot text "Click untuk detail" or a row), then M08 S2 `/prestasi/tingkatan` opens (INFERRED: panel is the link; provisional).
- **AC-M27-11.3** Given the same school, when S0 and M08 S1 are both opened, then the GPS value, the number of headcount entries, the sessions, the questions and the school accuracy on S0 equal the values on M08 S1 (both read the same M08 query). The cards "JUMLAH PELAJAR", "JUMLAH GURU" and "KELAS AKTIF" are checked only against their own owner queries (AC-M27-06.2, 06.3), not against M08 S1.

Totals: **11 stories, 34 Functions, 51 acceptance criteria** (v1.2 adds AC-M27-06.4/06.5 changes, AC-M27-10.1–10.10, AC-M27-11.1–11.3; replaces AC-M27-06.1–06.4 of v1.1).

---

## 5. UI expectations

| Screen | Behaviour notes |
|---|---|
| S0 | User shell. Order top to bottom: Perutusan card, breadcrumb, banner, four cards, "Ringkasan Prestasi" (four panels, "Taburan Gred (Anggaran)"). Banner red, white text, name large, "Admin Sekolah" line below it. Cards tinted blue, teal/mint, pink/red, green or grey. 1280: cards 4 per row, panels 4 per row; 768: cards 4, panels 2 per row; 375: cards 2, panels 1 per row (PROPOSED; the evidence shows 1280 only). Design details belong to the design phase. |

Loading, error: see FN-M27-1.7.4.

---

## 6. Coverage matrix (completeness proof)

Elements of the evidence (live screenshots 1 and 2, deck images `ss-admin.png` and `ss-prestasi-sekolah.png`), mapped to Functions. "Readable" = visible in the evidence.

| EL | Element | Readable | Function | Status |
|---|---|---|---|---|
| EL-L07-01 | Title and subtitle in the top bar | live: first letters; deck: full | FN-M27-1.1.2 | mapped (SERVER-DECK) |
| EL-L07-02 | Bell, avatar (initials), logout icon | shapes | FN-M27-1.1.3 | shell-owned |
| EL-L07-03 | Card "Perutusan Terkini", "Lihat semua →", post row | yes (live only) | FN-M27-1.3.1–1.3.5 | mapped |
| EL-L07-04 | Breadcrumb "← Papan Pemuka" > "Dashboard Sekolah" | yes | FN-M27-1.4.1 | mapped (target INFERRED) |
| EL-L07-05 | Red banner: icon, name, "Admin Sekolah", state, PPD, "# Kod" | yes | FN-M27-1.5.1–1.5.3 | mapped |
| EL-L07-06 | Four summary cards (labels, values, colours, tiles, foot bar) | live: colours and tiles; deck: all | FN-M27-1.6.1–1.6.4 | **mapped (SERVER-DECK; closes the cards part of OQ-M27-01)** |
| EL-L07-07 | Content below the heading "Taburan Gred (Anggaran)" on S0 | none (cut off) | FN-M27-1.9.6 (INFERRED list) | **unknown (open, OQ-M27-11)** |
| EL-L07-08 | Empty, loading and error states | none | FN-M27-1.3.3, 1.7.4, 1.9.7 | PROPOSED / INFERRED |
| EL-L07-09 | Sidebar (screenshot 2), "Dashboard" active; footer card (school short name, code, logout icon) | yes | FN-M27-1.1.1, 1.1.4, 1.8.1 | mapped (shell-owned content; the footer card is shell-owned, its data is the M02 school of the session user, M27 adds nothing) |
| EL-L07-10 | Card "Ringkasan Prestasi" with its four panels | deck | FN-M27-1.9.1–1.9.5, 1.9.7 | mapped (SERVER-DECK) |
| EL-L07-11 | Sub-heading "Taburan Gred (Anggaran)" and "Lihat penuh →" | deck | FN-M27-1.9.6 | mapped (SERVER-DECK; list under it INFERRED) |

Summary: 11 elements, 10 mapped, 1 unknown (EL-L07-07). **0 unmapped.** Audit round 1 passed into G1 approval at v1.1; v1.2 needs a re-audit of the new elements. Completeness of the Admin Sekolah part stays open only for EL-L07-07 (OQ-M27-11).

---

## 7. Fidelity deviations

Only intended differences from live; anything else replicates the evidence (D7). D9 applies as in M17. D24: the live screenshot wins where it and the deck differ.

| ID | Discovery | Category | Live behaviour (evidence) | Rebuild behaviour and alternatives | Status |
|---|---|---|---|---|---|
| DV-M27-01 | D-M27-01; OQ-L07-02 | Broken (HTTP 500) | `/admin-sekolah` for a user with no chosen school (the platform admin) is a 302 to `/admin-sekolah/pilih-sekolah`, which answers 500 "Ralat Pelayan". | A user without a school, and every role other than `school_admin`, gets the global 403 "Akses Ditolak"; the picker route is not built (404). Alternatives: build a picker, rejected (content never observed, would be invention; DL-1); replicate the 500, rejected (broken); redirect to the landing page, rejected (the sibling alias routes answer 403). | Approved (D9, DL-1) |
| DV-M27-02 | L07 §2 "server quirk" | Defect not copied | Not a live observation: the server's `/admin` dashboard counts the whole platform for a school admin with no school (`DashboardController.php:49-56`). | Not adopted; a missing school is always 403 (FN-M27-1.2.3). | Rebuild rule |
| DV-M27-03 | CLAUDE.md §7; M17 DV-M17-25 | Project rule | The capture shows small meta text; sizes are not measurable. | Text at least 12 px, no horizontal scroll at the three widths. No live defect is claimed. | Project rule |
| DV-M27-04 | UD-3; D24 | Source conflict (live vs deck) | Live screenshot: the fourth card is tinted **green**. Deck: the fourth card "LANGGANAN" is **grey** with the value "Belum Ada". | Live wins: the card is green when the school has a subscription; the deck's grey is kept as the **INFERRED** state for "Belum Ada" (no subscription), because the live school may have had one. Alternatives: always green, rejected (the deck shows a visibly different no-subscription state); always grey, rejected (contradicts live). Replace when a live capture of the no-subscription state exists. | Approved (D24, live wins; grey INFERRED) |
| DV-M27-05 | DL-1, DL-4, DL-5 | Unobserved states (PROPOSED choices, not deviations from observed behaviour) | Not observed on live or in the deck: empty perutusan, more than one perutusan row, missing PPD or code, role handling of non-school-admin roles, the "LANGGANAN" values other than "Belum Ada", no-data states of the panels. | Empty perutusan hides the list (no copy); at most 3 rows; PPD or code chip omitted when empty; other roles get the global 403; "LANGGANAN" shows the M02 status wording; no-data panels show "—" or zeros. Listed for traceability and the G1 report; they carry `@provisional` E2E where asserted. | Delivery Lead decisions |
| DV-M27-06 | D24 | Source conflict (live vs deck) | Live: the role "Admin Sekolah" is a line below the school name in the banner. Deck: a pill beside the name. | Live wins: line below the name. | Approved (D24, live wins) |
| DV-M27-07 | Deck (observed); DL decision 2026-10-03 | Observed server behaviour, not reproduced | Deck (original server): for one school the S0 cards and the pupil, teacher and class tiles of the linked M08 S1 page show different figures. | Rebuild: each S0 card follows its own owner definition (M02 users by role and school; M10 active classes of the school; M02 subscription); no value is tuned or aligned. Any agreement with M08 S1 in the rebuild is a consequence of both reading the same owner stores (M08 FR-M08-12), not a requirement, and the deck's difference is not reproduced. No AC requires equality between the S0 cards and M08 S1. | Rebuild rule (DL); OQ-M27-12 |

Related, owned by the shell and not decided here: D-M27-02 (sidebar hrefs under `/admin-sekolah/*` that are 404 on live); the deck's older sidebar (OQ-M27-06).

---

## 8. Out of scope ("not in this version")

| Item | Reason |
|---|---|
| Whatever lies below the heading "Taburan Gred (Anggaran)" on S0 beyond the INFERRED grade list | Cut off in the deck (OQ-M27-11). |
| `/admin-sekolah/pilih-sekolah` school picker | Not built (DL-1). |
| Other M27 screens (INFERRED hrefs under `/admin-sekolah/`): Senarai Pelajar (`pelajar`), Senarai Guru (`guru`), Kelas Sekolah (`kelas`), Urus Pengguna (`pengguna`), Import Pelajar (`import-pelajar`), Aktiviti Guru (`aktiviti-guru`), Langganan (`langganan`), Invois (`invois`), Laporan Bulanan (`laporan-bulanan`), Statistik Penggunaan (`statistik-penggunaan`), DSKP Heatmap (`dskp-heatmap`), Laporan Aktiviti (`laporan-aktiviti`) | Contents unrevealed; hrefs INFERRED, several 404 on live (M27 discovery §1.2). Link-target status since v1.5: Senarai Pelajar, Senarai Guru, Kelas Sekolah, Laporan Bulanan, Statistik Penggunaan, DSKP Heatmap and Laporan Aktiviti are specified in Part B (§10–§17); Urus Pengguna, Import Pelajar, Aktiviti Guru, Langganan and Invois stay out of scope. |
| The full school performance page `/prestasi/sekolah`, the level pages `/prestasi/tingkatan*`, the Amaran Awal school page | Owned by M08 and M18; S0 only links to the first two. |
| Command Center `/admin-sekolah/command-center` and drill-downs, Monitoring, Kirkpatrick aliases | Owned by M17, M11, M12. |
| Perutusan list, detail, write | M09 S22–S25. |
| Notification bell content, avatar menu, logout | User shell. |
| M01 login redirect change | DL-2. |
| Write actions of any kind | S0 is read-only. |

---

## 9. Open questions

| ID | Question | Blocks | Default used |
|---|---|---|---|
| OQ-M27-01 | **Closed in v1.2 as SERVER-DECK** (cards and "Ringkasan Prestasi" from the deck). One part remains: see OQ-M27-11. | — | deck |
| OQ-M27-02 | Target of "← Papan Pemuka": `/dashboard` (DL-3). Does the live link go there? `/dashboard` (M05 S1) is not built (M05-T3 in flight, Session 8); M05 SRS §9 says Admin Sekolah is "same as Pelajar (INFERRED)" but does not confirm the route role list. XR-M27-04 asks M05 to admit `school_admin` (OQ-L07-04 stays open). | AC-M27-05.2 / E2E-M27-15 only (non-blocking for the build) | `/dashboard` |
| OQ-M27-03 | Perutusan card: maximum rows (3 PROPOSED), order (M09 order, pinned first, or strictly newest), whether a row is a link (rendered as plain text), unread state, empty-state copy (list hidden). | Nothing (non-blocking) | as FN-M27-1.3.x |
| OQ-M27-04 | Tab title (PROPOSED "Dashboard Sekolah - PRESTASIPLUS"); the header is now SERVER-DECK. M08 S1 uses "Dashboard Sekolah" as header and "Dashboard Sekolah — Prestasi" as tab; the M27 tab differs, so no collision. | Nothing (non-blocking) | as FN-M27-1.1.2 |
| OQ-M27-05 | Banner details: capitals by CSS only (decided, INFERRED); exact chip icon types (pin for state PROPOSED); chip omission for missing PPD or code (PROPOSED); card icon glyphs (deck shapes, exact icons PROPOSED). | Nothing (non-blocking) | as FN-M27-1.5.x, 1.6.1 |
| OQ-M27-06 | Sidebar entries to unbuilt M27 screens (D-M27-02) open the global 404 page until built; the deck's older sidebar differs (live wins); shell owner or Delivery Lead to decide whether to hide them. | Nothing (shell decision) | 404 page |
| OQ-M27-07 | "Lihat semua →" target `/perutusan` is not built yet (M09-T4, route fragment empty). | AC-M27-04.2 only (build order) | link rendered, AC provisional |
| OQ-M27-08 | Roles-matrix row L07 owner text "M17 / M05" and build-plan R.1.3 wording ("Deferred - needs school-admin account") need updating by the Delivery Lead. | Nothing | — |
| OQ-M27-09 | `docs/design/shells.md` line 73 says the `/admin-sekolah` routes "are in no SRS yet": stale once M27 is approved. Shell owner to refresh at the next revision. | Nothing | — |
| OQ-M27-10 | Test hook for a `school_admin` with a null school bypasses M02 FR-M02-27 (school required at creation): XR-M27-05 asks M02 to provide or approve it (writes through the M01 mock store only). | E2E-M27-19 / AC-M27-07.4 (build order) | hook `seedSchoolAdminWithoutSchool()` PROPOSED |
| OQ-M27-11 | What lies under the heading "Taburan Gred (Anggaran)" on S0: the deck is cut off there. INFERRED: the grade list of the linked page (A+ … G with bars, counts, percentages, "Jumlah: {n} rekod"); anything further (more cards, tables) is unknown and not invented. | Final completeness of the Admin Sekolah part (EL-L07-07) | grade list as M08 FR-M08-15 |
| OQ-M27-12 | Each S0 card follows its own owner definition (M02 users by role and school; M10 active classes of the school; M02 subscription). M08 S1 reads the same owner stores (M08 FR-M08-12; `performance.ts:218-230`: Murid and Guru from M02 counts by role and school, Kelas from active classrooms), so the two may coincide in the rebuild; this is a consequence, not a requirement. The deck showed different figures for one school (DV-M27-07). Open point for M10: which school link defines an active class (XR-M27-07). | Nothing (non-blocking) | owner definitions, never tuned |
| OQ-M27-13 | "LANGGANAN" value for a school with a subscription: not observed (live card is green, the deck only shows "Belum Ada"). PROPOSED: the M02 badge wording ("Aktif", "Tempoh Ihsan", "Tamat"); a `cancelled` row counts as none. Could be a package name or an end date. | Nothing (non-blocking) | status wording |
| OQ-M27-14 | M18 (Amaran Awal) is not built: until its `Q-M18-RISK(schoolId)` contract exists the "AMARAN AWAL" panel cannot be built or tested (E2E-M27-29 `@blocked-by M18`). XR-M27-08. | AC-M27-10.4 only (build order) | panel blocked by M18 |

---

# Part B — S1 to S11 (roles-matrix rows L51–L58, Admin Sekolah, Release 1.0)

Added in v1.4 and revised in v1.5 (audit round 1) by Session 2 under user decision D24. Part A (§0–§9) is S0, owned by Session 8, and is not changed. Ids continue after Part A: US-M27-12…, FN-M27-2.x.y…, DV-M27-08…, OQ-M27-15…. Shared rules of Part A that these screens reuse by reference: FN-M27-1.2.1–1.2.5 (access and scope), FN-M27-1.7.1–1.7.4 (layout, 12 px, privacy, loading), DL-1 (no picker, 403), DL-6 (user shell), DV-M27-01, DV-M27-02, DV-M27-03.

## 10. Overview of S1–S11

### 10.0 Status, evidence rule and tags

**Status:** **Approved (G1) 2026-10-09** (v1.7; user decision D26 "setuju semua": the G1 confirmation list §17.1, G1-1…G1-9, is approved as proposed). Audit rounds 1 and 2 fixes applied (`docs/qa/audit/M27-partB-audit.md`). The S0 status line in §0 is unchanged.

**Evidence rule (D24).** The live school-admin pages of L51–L58 cannot be observed; the server code and data and the deck screenshots are the specification. Where nothing exists at all, the screen is the minimal one consistent with its label and the closest analogue, tagged PROPOSED (D23 precedent, no invented data or totals).

| Tag | Meaning |
|---|---|
| LIVE | Observed live: the two roles-matrix screenshots (`roles-matrix/admin sekolah/`), route probes, and live pages of other roles that use the same template (called ANALOGUE when the page is not the school-admin page itself). |
| SERVER | Reference backend code or data (`D:\Dev Projects\prestasiplus-reference\backend`): scope rules, formulas, copy. |
| SERVER-DECK | Screenshot of a real school-admin page in the reference deck (`backend/public/images/present/ss-*.png`, `present.html`). Undated, older than the live screenshot; live wins where they differ. |
| ANALOGUE | Same-template live page of another role or scope: M18 S3, S9, S22 (PPD/JPN and school pages), M17 S9 and S11, M02 S1 to S3, M08 S3 and S7, M10 S4, M11 S3. |
| OWNER | The approved SRS of the module that owns the store or the page being reused (D12). |
| PROPOSED | Rebuild choice where no evidence exists. Listed in §17 and in the SRS §20.2. |

Precedence: LIVE, then SERVER-DECK, then SERVER, then ANALOGUE, then PROPOSED. Exact BM copy is quoted; copy not observed anywhere is marked PROPOSED.

### 10.1 Screens

| # | Row | Route | Title (header) | Sub-line | Tab title | Shell | Sidebar item | Evidence rank |
|---|---|---|---|---|---|---|---|---|
| S1 | L51 | `/admin-sekolah/statistik-penggunaan` | Statistik Penggunaan | school name | Statistik Penggunaan - PRESTASIPLUS (P) | user | ANALITIK "Statistik Penggunaan" | label LIVE; Panduan LIVE; layout ANALOGUE (M18 S3) + SERVER formulas |
| S2 | L52 | `/admin-sekolah/dskp-heatmap` | DSKP Heatmap | school name | DSKP Heatmap - PRESTASIPLUS (P) | user | ANALITIK "DSKP Heatmap" | label LIVE; content PROPOSED over ANALOGUE (M08 S7 map) and SERVER grouping |
| S3 | L53 | `/admin-sekolah/laporan-aktiviti` | Laporan Aktiviti | school name | Laporan Aktiviti - PRESTASIPLUS (P) | user | ANALITIK "Laporan Aktiviti" | label LIVE; content ANALOGUE (M17 S11) + SERVER scope |
| S4 | L54 | `/amaran/sekolah` | Amaran Awal — Sekolah | school name | Amaran Awal — Sekolah \| PRESTASIPLUS (M18) | user | PENILAIAN "Amaran Awal" | SERVER-DECK page + ANALOGUE M18 S22 + OWNER M18 |
| S5 | L55 | `/admin-sekolah/laporan-bulanan` | Laporan Bulanan | school name | Laporan Bulanan - PRESTASIPLUS (P) | user | PENILAIAN "Laporan Bulanan" | label LIVE; content PROPOSED over ANALOGUE (M17 S9, M18 S9) |
| S6 | L56 | `/admin-sekolah/pelajar` | Senarai Pelajar | school name | Senarai Pelajar - PRESTASIPLUS (P) | user | HARIAN "Senarai Pelajar" | label LIVE; Panduan LIVE; SERVER `/admin/users` for a school admin (buttons "Eksport CSV", "Tambah Pelajar", cards, filters, order); table ANALOGUE (M02 S1) |
| S7 | L57 | `/admin-sekolah/guru` | Senarai Guru | school name | Senarai Guru - PRESTASIPLUS (P) | user | HARIAN "Senarai Guru" | label LIVE; Panduan LIVE; SERVER `/admin/users` (button "Eksport CSV", cards, filters, order, `StaffScope` rules); table ANALOGUE (M02 S1, M18 S9, M11 S3) |
| S8 | L58 | `/admin-sekolah/kelas` | Kelas Sekolah | school name | Kelas Sekolah - PRESTASIPLUS (P) | user | HARIAN "Kelas Sekolah" | label LIVE; deck sidebar; content PROPOSED over ANALOGUE (M18 S9, M10 S4, M08 S3) |
| S9 | L56 | `/admin-sekolah/pelajar/{id}` | Edit Pengguna | "Kemaskini maklumat pengguna" | Edit Pengguna - PRESTASIPLUS (P) | user | HARIAN "Senarai Pelajar" (active) | Panduan LIVE ("klik nama pengguna ... Reset Kata Laluan") + ANALOGUE (M02 S3, live) + SERVER rules (the server's own edit view differs, DV-M27-21) |
| S10 | L57 | `/admin-sekolah/guru/{id}` | Edit Pengguna | "Kemaskini maklumat pengguna" | Edit Pengguna - PRESTASIPLUS (P) | user | HARIAN "Senarai Guru" (active) | as S9 |
| S11 | L57 | `/admin-sekolah/guru/baru` | Cipta Pengguna | "Daftarkan akaun guru ke sekolah anda" (P) | Cipta Pengguna - PRESTASIPLUS (P) | user | HARIAN "Senarai Guru" (active) | Panduan LIVE ("Senarai Guru" then "Cipta Pengguna") + ANALOGUE (M02 S2) + SERVER (`importableRoles`) |
| S12 | L56 | `/admin-sekolah/pelajar/baru` | Tambah Pelajar | "Cipta satu akaun pelajar" | Tambah Pelajar - PRESTASIPLUS (P) | user | HARIAN "Senarai Pelajar" (active) | SERVER (`UsersController::create/store`, `users-create.blade.php`, `new-credential` partial; copy exact) adapted by DV-M27-19 |

S9 to S11 carry the M02 S3 and S2 header copy ("Edit Pengguna" / "Kemaskini maklumat pengguna"), because the school admin edits the same record shape. Their sub-line differs from the pattern "school name" on purpose: the pattern would repeat the school name already visible in the locked school label of the form.

### 10.2 Provenance summary per screen

| Screen | LIVE | SERVER-DECK | SERVER | ANALOGUE / OWNER | PROPOSED |
|---|---|---|---|---|---|
| S1 | sidebar label and position; route exists; Panduan card sentence | header pattern (title, school sub-line) | `SchoolAggregates` formulas, "Mengikut Mod Latihan", footnote, summary strip labels | M18 S3 period pills, empty-state copy; M17 S3 sub-line "daripada {n}"; M05 S9 session labels (only "Latihan" observed there, the others are M05 PROPOSED COPY); deck Prestasi page labels "Sesi Latihan", "Soalan Dijawab", "Purata Ketepatan" (SERVER-DECK) | tab title; tile set and order; windowing by period and the "completed" filter (the server aggregate is all-time); no export |
| S2 | sidebar label and position; route exists | none | student heatmap grouping and `dskp` bands (adjacent, student level) | M08 FR-M08-52 legend, caption, colours; M08 SpRecord; M10 DSKP repo; R10 cell copy "{n} cuba · {p}% betul" | whole screen composition, level pills T4/T5, subject select (subjects with SPs at the chosen level), aggregation, rounding; demo data exists only for school 900001 (§10.3) |
| S3 | sidebar label and position; inferred href 404 (D9 fix) | none | school-confined report rules; "no platform wording" precedent | M17 S11 (all copy), M17 FR-M17-111 precedent | alias route, h1 and sub-line, hidden "Sekolah" tab and constants-only items |
| S4 | sidebar label and position | full page: header, pills, tiles, distribution, buttons, subject analysis; URL `/amaran/sekolah` | (teacher risk rule rejected) | M18 S22/S23/S21/#30 (live copy: "Keberkesanan Intervensi" button) | none beyond route binding |
| S5 | sidebar label and position; route exists | none | school-scoped focus report (`LaporanEksekutifController`): monthly activity, strongest and weakest subject | M17 S9 cards and footer, M17 S8 navigation, M18 S9 "Statistik Bulanan", M18 S23 "Cetak / PDF" | composition, month navigation, print |
| S6 | sidebar label and position; Panduan sentences (import, edit, reset) | sidebar item "Senarai Pelajar" (older order) | `UserDirectory` filters and order; `StaffScope` rules; page `/admin/users` for a school admin: "Eksport CSV", "Tambah Pelajar" (`UsersController::store`), one-time credential block, "Menyamar" (`ImpersonateController`); the page is role-fixed here (the server Panel lists pelajar, guru and fellow school admins, not adopted) | M02 S1 table, filters, empty copy, paginator; M02 S3 form; M10 enrolments (`source school_admin`) | columns "Tingkatan" and "Kelas", read-only status for pupils, no IC, reset-bar label |
| S7 | sidebar label and position; Panduan ("Cipta Pengguna", "aktif/nyahaktif akaun guru") | sidebar item and "Cipta Pengguna" item (older) | `StaffScope` (`importableRoles` for the bulk importer, `canManageAccount`, `canActivate`); "Eksport CSV" of `/admin/users` | M02 S1, S2, S3; M18 S9 and M11 S3 teacher tables | columns "Kelas" and "Login Terakhir", activation capability for school admin (DV-M27-10), create-active default (G1 list) |
| S8 | sidebar label and position | sidebar item "Kelas Sekolah" (door icon), "KELAS AKTIF" card | `classrooms` columns (adjacent, teacher page) | M18 S9 "Prestasi Per Kelas" copy and empty copy; M10 S4 card fields; M08 S3 "Kelas Sekolah" kind | whole table, `classroom` rows only (DV-M27-20), filters, link to M08 S5 |

### 10.3 Fixtures (existing records, shared with S0 §1.4; nothing is added)

| Persona | Record | Used for |
|---|---|---|
| P1 | school admin 3102 `azlan@demo.test`, school 900003. The school holds only this school admin: no pupil, teacher or class (M01 users-spec and users-anchors; pupils 3105–3109 carry no school) | every screen's **empty state** (S1, S4, S6, S7, S8), banner, header and shell tests, access tests |
| P2 | school admin 8 `adminsekolah@demo.test`, school 900001 "SMK DEMO": designed pupils 3001–3008 (grade 11, M08 anchors), teacher 5 `guru@demo.test` who owns classes 2001 and 2002 (M10 anchors) | S6, S7, S8, S12, S9, S10, S11 populated rows and writes; S2 (the only seeded SP records of a school, Kimia at Tingkatan 5: M08 SpRecords derived from the designed sessions of pupils 3001–3008); foreign-id tests |
| P3 | school admin 3104 `suhaimi@demo.test`, school 900002 (no PPD, no code) | locked school label without optional parts |
| P4 | the populated school chosen at S0 build (8090 by default) and its generated school admin | S1, S3, S5, S6 with real activity; S2 where every tile reads "Belum cuba" (no SpRecord outside the admin anchors and the designed pupils, M08 DATA-M08-04) |
| P5 | refused roles: 1 `admin@demo.test`, 5 `guru@demo.test`, 2 `pelajar@demo.test`; a `school_admin` with no school (S0 §6.4 hook) | access tests |

No figure is pinned in this document: every value is compared with the owner's own query for the same school (oracle). Exceptions are the **owner anchor facts** that the owners already document and that the fixtures cannot lose: teacher 5 owns classes 2001 "5 MARIKH - Kimia" and 2002 "5 MARIKH - Sejarah" (M10 §6.2.1), pupils 3001–3008 belong to school 900001 (M01 users-anchors), school 900003 holds no pupil, teacher or class. States that need arranging (a teacher or pupil moved to school 900003, an inactive account, a school with 26 or more rows) are arranged in the test through the M02 admin endpoints #5 and #8 as `admin@demo.test`. No real person's name, e-mail or IC is used; the persons above are the existing fictitious fixtures.

---

## 11. Functional breakdown (Epic, Feature, Function)

Source column: L = LIVE, D = SERVER-DECK, S = SERVER, A = ANALOGUE, O = OWNER, P = PROPOSED.

### EP-M27-2 — Rules common to S1–S12

**FT-M27-2.1 — Access and scope**

| FN | Function | Source |
|---|---|---|
| FN-M27-2.1.1 | A guest on any route of §10.1 or any `/api/admin-sekolah/*` endpoint is sent to `/login` (API 401). | A (S0 FN-M27-1.2.1) |
| FN-M27-2.1.2 | Every signed-in role other than `school_admin` (platform admin, teacher, pupil, parent, sponsor, PPD, JPN) gets the global 403 page "Akses Ditolak" in place on every route of §10.1, including S4 `/amaran/sekolah`; the endpoints answer 403. | P (DL-1, S0 FN-M27-1.2.2); L (platform admin: live gives 302 then 500, DV-M27-01) |
| FN-M27-2.1.3 | A `school_admin` with no school gets the same 403; a missing school never means "all schools". | S (adjacent, `StaffScope.php:128-148`) |
| FN-M27-2.1.4 | The school of every figure, list, report and write is the session user's school. No `school`, `school_id`, `schoolId`, `role` or `kelas` value from path, query or body widens it. | S (`listScopeSchoolId`, `resolveSchoolId`) |
| FN-M27-2.1.5 | An id of the M27 pages (S9, S10) that exists in another school, belongs to another role, or does not exist answers the global 404 page (existence is not revealed). | A (M17 FR-M17-114, OQ-M17-13 decision) |

**FT-M27-2.2 — Header, shell, navigation**

| FN | Function | Source |
|---|---|---|
| FN-M27-2.2.1 | Header title = the screen title of §10.1; sub-line = the school name (M02 `name`), except S9 to S12 (S9, S10: "Kemaskini maklumat pengguna"; S11: "Daftarkan akaun guru ke sekolah anda"; S12: "Cipta satu akaun pelajar"). | D (deck pages: "Amaran Awal — Sekolah" / school, "Dashboard Sekolah" / school) |
| FN-M27-2.2.2 | Tab title "{title} - PRESTASIPLUS" (S4: M18's "Amaran Awal — Sekolah \| PRESTASIPLUS"). | P (S0 FR-M27-03 precedent); O (M18) |
| FN-M27-2.2.3 | All screens render in the user shell; the sidebar item of the screen is active on its route and sub-routes (S9 keeps "Senarai Pelajar", S10 and S11 keep "Senarai Guru", S4 keeps "Amaran Awal"). | L (sidebar of the screenshot); P (sub-route rule) |
| FN-M27-2.2.4 | S1, S2, S3, S5, S6, S7 and S8 show the breadcrumb row "← Dashboard Sekolah" (link to `/admin-sekolah`), a separator and the screen title in bold as a non-link, between the header and the content; S4 shows none; S9 to S12 show no breadcrumb but the form footer action "Batal" with the back arrow to their list. | P: S0 precedent (live screenshot and deck S0 show "← Papan Pemuka / Dashboard Sekolah") and ANALOGUE M18 S3 ("Dashboard PPD" / "Statistik Penggunaan"); S4 follows its deck page, which has none (D); forms A (M02 S2/S3 footer) |

**FT-M27-2.3 — Quality**

| FN | Function | Source |
|---|---|---|
| FN-M27-2.3.1 | No horizontal page scroll at 375 / 768 / 1280 px; wide tables scroll inside their own card. | R (CLAUDE.md §7; M02 FR-M02-07 pattern) |
| FN-M27-2.3.2 | Text at least 12 px. | R (DV-M27-03) |
| FN-M27-2.3.3 | No real person's name, no IC number, no password appears in docs, seeds or pages, except the one-time credential block shown after an S12 create (SERVER `new-credential`, FN-M27-8.3.3, BR-M27-41); e-mail and phone are shown only for users of the viewer's school. | R (CLAUDE.md §6); S (`UserDirectory` scope) |
| FN-M27-2.3.4 | Loading uses the shell's loading state; a server error shows the M01 global error page; no M27 copy. | P (S0 FN-M27-1.7.4) |
| FN-M27-2.3.5 | Lists page 25 rows with the Laravel paginator wording of M02 FR-M02-18, hidden for one page; all query parameters are kept in the links. | A (M02 S1) |

**FT-M27-2.4 — Coherence with S0**

| FN | Function | Source |
|---|---|---|
| FN-M27-2.4.1 | The unfiltered total of S6 equals S0 "JUMLAH PELAJAR"; of S7 equals "JUMLAH GURU"; the active-class count of S8 equals "KELAS AKTIF"; the S4 tiles equal the S0 "AMARAN AWAL" panel (same queries). | P (D12, no tuning) |

### EP-M27-3 — S1 Statistik Penggunaan

**FT-M27-3.1 — Page and figures**

| FN | Function | Source |
|---|---|---|
| FN-M27-3.1.1 | Route `/admin-sekolah/statistik-penggunaan`, title "Statistik Penggunaan", sub-line school name. | L (label, route); D (header pattern) |
| FN-M27-3.1.2 | Period pills "Hari Ini" (`?period=today`), "7 Hari" (`7days`), "30 Hari" (`30days`, default; missing or unknown value gives 30days); the active pill is highlighted. | A (M18 S3, BR-M18-30) |
| FN-M27-3.1.3 | Seven tiles in order: "Pelajar", "Guru", "Pelajar Aktif" (sub-line "daripada {n}"), "Penglibatan" (sub-line "daripada pelajar daftar"), "Sesi Latihan", "Soalan Dijawab", "Purata Ketepatan". | L (Panduan: "Pelajar aktif, sesi latihan, soalan dijawab"); S (summary strip labels, `SchoolAggregates`); D (deck labels "Sesi Latihan", "Soalan Dijawab", "Purata Ketepatan"); A (M17 sub-lines) |
| FN-M27-3.1.4 | Definitions: Pelajar and Guru = users of the school by role (all, active or not); Pelajar Aktif = pupils with at least one answer in the period; Penglibatan = round(aktif ÷ pelajar × 100), 0 when no pupils; Sesi Latihan = completed sessions in the period; Soalan Dijawab = answers in the period; Purata Ketepatan = mean of the sessions' accuracy, one decimal, "—" without a session. | S (`SchoolAggregates`: counts by role and school, active = at least one answer, Penglibatan rule, accuracy one decimal and "—"); P (the period window and the "completed" filter: the server aggregate is all-time over all sessions); O (M05 queries) |

**FT-M27-3.2 — Breakdown, empty states, export**

| FN | Function | Source |
|---|---|---|
| FN-M27-3.2.1 | Card "Mengikut Mod Latihan": table "Mod", "Sesi", "Ketepatan Purata", one row per session label of M05 S9 ("Latihan", "Bab", "Ulang Kaji", "Tracking A", "PKSK") that has sessions in the period, ordered by sessions descending. | S (mode split structure; the server prints the raw `mode` string); O (M05 S9 labels: only "Latihan" is OBSERVED there, "Bab", "Ulang Kaji", "Tracking A", "PKSK" are M05 PROPOSED COPY and inherit that caveat) |
| FN-M27-3.2.2 | No session in the period: the card "Tiada data untuk tempoh ini" with "Tiada aktiviti latihan dalam tempoh 30 Hari yang lepas." (7 days: "… 7 Hari …"); today: "Belum ada pelajar buat latihan hari ini. Cuba lihat 7 Hari atau 30 Hari." (words are links); the tiles stay with zeros and "—"; the footnote "Ketepatan dipaparkan sebagai “—” kerana belum ada sesi latihan direkodkan dalam skop ini." | A (M18 S3 copy); S (footnote) |
| FN-M27-3.2.3 | No export on S1. | P |

### EP-M27-4 — S2 DSKP Heatmap

**FT-M27-4.1 — Map**

| FN | Function | Source |
|---|---|---|
| FN-M27-4.1.1 | Route `/admin-sekolah/dskp-heatmap`, title "DSKP Heatmap", sub-line school name; card heading "Peta DSKP — Standard Pembelajaran" and caption "KSSM {Subjek} Tingkatan {n}". | L (label); A (M08 FR-M08-52) |
| FN-M27-4.1.2 | One tile per Standard Pembelajaran (SP) of the chosen subject and level, grouped under a heading per Bidang ("{Bidang code} {Bidang name}"), in M10 code order; the tile shows the SP code and the percentage. | S (subject, strand, tile grouping); O (M10 DSKP repo) |
| FN-M27-4.1.3 | Tile value = pooled accuracy of the school's pupils on the SP: round(100 × correct ÷ answered); status "Mahir" (≥ 75), "Sederhana" (50–74), "Lemah" (< 50), "Belum cuba" (no answer); colours as M08 (green, yellow, red, slate). | A (M08 legend and colours); P (pooling, rounding) |
| FN-M27-4.1.4 | Legend "Mahir (75%+)", "Sederhana (50-74%)", "Lemah (<50%)", "Belum Cuba". | A (M08 FR-M08-52) |
| FN-M27-4.1.5 | Tile `title` "{code}: {title} — {Mahir\|Sederhana\|Lemah\|Belum cuba}" plus " · {n} cuba · {p}% betul" when answered. Tiles are not links. | A (M08, R10 cell copy); P (not links) |

**FT-M27-4.2 — Filters and states**

| FN | Function | Source |
|---|---|---|
| FN-M27-4.2.1 | Filter card (GET form, submits on change): select "Subjek" (subjects that have at least one SP at the chosen level; default the first by name; no "all" option) and level pills "Tingkatan 4" (default, `?tingkatan=T4`) and "Tingkatan 5" (`T5`). | P (M08 S8 submit-on-change pattern; M18 pill copy; D10 level limit) |
| FN-M27-4.2.2 | A subject and level without SPs: "Tiada Standard Pembelajaran untuk subjek dan tingkatan ini." (P). A school with no recorded answers shows every tile "Belum cuba" with no percentage. | P |

### EP-M27-5 — S3 Laporan Aktiviti

**FT-M27-5.1 — Overview**

| FN | Function | Source |
|---|---|---|
| FN-M27-5.1.1 | Route `/admin-sekolah/laporan-aktiviti` (built; the inferred href is a 404 on live), title "Laporan Aktiviti", sub-line school name; range pills "7 Hari" (`?range=7`), "30 Hari" (default), "3 Bulan" (`?range=90`); another value gives 30. | L (label, 404); A (M17 FN-M17-8.1.2) |
| FN-M27-5.1.2 | Tabs "Overview" (default), "Guru ({n})", "Murid ({n})"; the "Sekolah ({n})" tab of M17 is not rendered. | A (M17 FN-M17-8.1.1); P (one school) |
| FN-M27-5.1.3 | Overview cards "Murid Pernah Login", "Cikgu Pernah Login", "Murid Buat Latihan" (each "{p}%", "{n}", "/ {total}", "{n} belum pernah login" where M17 has it) and "Jumlah Aktiviti" ("{range} hari lepas"); the card "Skor Purata" and its chip "Struktur" are not rendered. | A (M17 FN-M17-8.2.1/8.2.2); P (constants-only items hidden, DC-M17-06) |
| FN-M27-5.1.4 | "Trend Aktiviti" (line chart), "Pecahan Aktiviti" ("Kuiz Objektif", "Soalan Berstruktur", "Battle Arena", "Permainan"), "Pelajar Paling Aktif" (top 10) and "Cikgu Belum Login" (first 20, name and e-mail) as M17, all confined to the school. | A (M17 FN-M17-8.2.3–8.2.6); S (school-confined queries, e-mails of own teachers) |
| FN-M27-5.1.5 | The words "keseluruhan platform" and "seluruh platform" never appear on S3. | A (M17 FR-M17-106 precedent); S (server test) |

**FT-M27-5.2 — Teacher and pupil tabs**

| FN | Function | Source |
|---|---|---|
| FN-M27-5.2.1 | Tab "Guru ({n})": heading "Senarai Guru ({n})", pills "Semua", "Pernah Login ({n})", "Belum Login ({n})", search "Cari guru...", tiles "Jumlah Guru", "Pernah Login", "Jumlah Soalan", "Jumlah Syiling"; table "#", "Nama" (with e-mail line), "Login", "MCQ", "Struktur", "Syiling", "Headcount", "Login Terakhir" (no "Sekolah" column, no school select). | A (M17 FN-M17-8.4.1); P (single-school columns hidden) |
| FN-M27-5.2.2 | Tab "Murid ({n})": heading "Senarai Murid ({n}) — Top 200", pills "Semua", "Aktif", "Login Sahaja", "Belum Login", search "Cari murid...", tiles "Jumlah Murid", "Pernah Latihan", "Jumlah Sesi", "Purata Ketepatan"; table "#", "Nama", "Kelas", "Sesi", "Ketepatan", "Masa", "Syiling", "Login Terakhir" (no "Sekolah" column, no school select); each pill lists its pupils (M17 DV-M17-18 rebuild behaviour). | A (M17 FN-M17-8.5.1); P (hidden column) |

### EP-M27-6 — S4 Amaran Awal

**FT-M27-6.1 — School overview bound to the own school**

| FN | Function | Source |
|---|---|---|
| FN-M27-6.1.1 | Route `/amaran/sekolah` (no id) renders the M18 S22 "Amaran Awal — Sekolah" content for the session school; the sidebar item "Amaran Awal" opens it; M18's own routes `/amaran/sekolah/{id}`, `/sekolah/{id}/amaran`, `/amaran` stay as M18 defines them. | D (URL label in the deck); O (M18 S22, S16) |
| FN-M27-6.1.2 | Header "Amaran Awal — Sekolah" with the school name as sub-line; level pills "Semua Tingkatan" (active), "Tingkatan 4", "Tingkatan 5" (`?tingkatan=T4\|T5`; with a level only pupils in classes of that level count, and the sub-line gets the suffix " — Tingkatan {n}"). | D; A (M18 FN-M18-4.6.1) |
| FN-M27-6.1.3 | Tiles "Jumlah Pelajar", "On Track", "Perlu Perhatian", "Berisiko Tinggi"; card "Taburan Risiko Seluruh Sekolah" with the stacked bar (integer % per segment) and "Hijau: {n}", "Kuning: {n}", "Merah: {n}". | D; A (M18 FN-M18-4.6.2/4.6.3) |
| FN-M27-6.1.4 | Card "Analisis Risiko Mengikut Subjek" (rows "{Subjek}" and "{w}/{m} pelajar lemah ({p}%)") when the school has data, and card "Senarai Pelajar Berisiko" ("Disusun mengikut skor risiko tertinggi"; columns "#", "Pelajar", "Tingkatan / Kelas", "Skor", "Status", "Ketepatan", "Penglibatan", "Penguasaan"). | D (subject card); A (M18 FN-M18-4.6.5/4.6.6) |

**FT-M27-6.2 — Buttons, scope**

| FN | Function | Source |
|---|---|---|
| FN-M27-6.2.1 | Buttons "Keberkesanan Intervensi" (to `/amaran/keberkesanan`), "Ringkasan Eksekutif" (to `/amaran/ringkasan-eksekutif?scope=school&school_id={own}`) and "Muat Turun CSV" (to `/amaran/export/school/{own}`), in that order. The deck shows the last two only; live M18 shows the first as well, live wins. **Deferral (DV-M27-23, 2026-10-09):** all three buttons are rendered, but the pages `/amaran/keberkesanan` and `/amaran/ringkasan-eksekutif` belong to M18 PPD/JPN, which is out of prototype 1.0 scope; those two links are tagged `@blocked-by M18` in E2E. The CSV link works. | D; L/A (M18 FN-M18-4.6.4) |
| FN-M27-6.2.2 | A foreign school id or class id on M18's own routes follows M18's rule for a school admin: own school only (M18 BR-M18-01 and §9 matrix), an object outside the scope answers 403 (M18 FR-M18-09); S4 itself takes no id. | O (M18) |
| FN-M27-6.2.3 | A school without pupils shows the tiles "0", the bar without segments and no list rows. | P (zeros, no invented copy) |

### EP-M27-7 — S5 Laporan Bulanan

**FT-M27-7.1 — Month report**

| FN | Function | Source |
|---|---|---|
| FN-M27-7.1.1 | Route `/admin-sekolah/laporan-bulanan`, title "Laporan Bulanan", sub-line school name; month heading "Laporan {Bulan} {yyyy}" (BM month names); links "← {Bulan} {yyyy}" (previous) and "{Bulan} {yyyy} →" (next, only while the shown month is before the current month); query `?bulan=YYYY-MM`, invalid or future value gives the current month. | L (label); A (M17 S8 year navigation, DV-M17-14); P |
| FN-M27-7.1.2 | KPI cards of the month: "Penglibatan" ("{p}%", "{n} aktif / {n} daftar"), "Soalan Dijawab" ("{n}", "{x} soalan/pelajar"), "Ketepatan" ("{p}%", "—" when no answer), "Sesi Latihan" ("{n}"). Differences from the cited M17 S9 cards: the label "Ketepatan" replaces "Ketepatan Akhir", and the card "Sesi Latihan" replaces "Konsistensi" ("{months}/12", a yearly figure with no monthly meaning). | A (M17 FN-M17-6.4.2 copy); P (set, the two label changes) |
| FN-M27-7.1.3 | A month without answers: the KPI values "0%", "0", "—", "0"; the sections below are omitted. | A (M17 FN-M17-6.3.11 rule); P |

**FT-M27-7.2 — Sections and print**

| FN | Function | Source |
|---|---|---|
| FN-M27-7.2.1 | Card "Statistik Bulanan" with the subtitle "12 bulan terakhir — pecahan prestasi mengikut bulan": table "Bulan", "Soalan Dijawab", "Soalan Betul", "Pelajar Aktif", "Purata/Pelajar", "Accuracy", one row per month with at least one completed session among the 12 months ending with the shown month (answers, correct and active pupils of such a month are counted from the answer log, including answers without a session), footer row "Jumlah" when more than one row; empty "Tiada data" / "Tiada aktiviti direkodkan buat masa ini". | A (M18 FN-M18-2.9.6, live copy) |
| FN-M27-7.2.2 | Card "Prestasi Mengikut Subjek" for the shown month: "SUBJEK TERKUAT" and "SUBJEK PERLU PERHATIAN" boxes ("{subjek}", "{p}% ({n} soalan)") and one row per subject ("{subjek}", "{p}% · {n} soalan · {n} pelajar"). | A (M17 FN-M17-6.4.4, 6.3.5); S (`LaporanEksekutifController` strongest/weakest) |
| FN-M27-7.2.3 | Footer "Laporan dijana: {d MMM yyyy, hh:mm AM\|PM} · PrestasiPlus" (request minute, MYT) and a button "Cetak / PDF" that calls `window.print()`. | A (M17 FN-M17-6.4.6; M18 FN-M18-4.7) |

### EP-M27-8 — S6 Senarai Pelajar, S9 Edit Pelajar

**FT-M27-8.1 — List**

| FN | Function | Source |
|---|---|---|
| FN-M27-8.1.1 | Route `/admin-sekolah/pelajar`, title "Senarai Pelajar", sub-line school name; one count card "Pelajar" (all pupils of the school, active or not, unaffected by the filters: the server's role card from `roleStats`; the v1.4 cards "Aktif" and "Tidak Aktif" are removed because neither the server nor M02 S1 has them, the "Status" filter and "{n} pengguna dijumpai" cover the need); a header-actions row with the text "{n} pengguna dijumpai" (rows matching the filters, `ms-MY`) and the buttons "Eksport CSV" (`fa-file-csv`, `title` "Muat turun senarai mengikut tapisan di atas", FN-M27-8.4.1) and "Tambah Pelajar" (`fa-user-plus`, to S12). | L (label, Panduan "pantau senarai seluruh sekolah"); S (`users.blade.php`: cards from `roleStats`, header actions, button copy); A (M02 FR-M02-02) |
| FN-M27-8.1.2 | Filter card (GET): "Status" ("Semua", "Aktif", "Tidak Aktif"; `?is_active=`), "Cari" (`?search=`, placeholder "Nama atau emel..."), submit "Cari". No role, school or class control. | A (M02 FR-M02-03); S (`UserDirectory`) |
| FN-M27-8.1.3 | Table "#", "Nama" (initials avatar, name as a link to S9 for an active pupil), "Emel", "Telefon" (or "-"), "Tingkatan" ("Tingkatan n" / "Darjah n" / "-"), "Kelas" (names of the active classes, "-" when none), "Aktif?" (read-only badge "Aktif" / "Tidak"), "Tarikh" (`dd/mm/yyyy`), "Tindakan" ("Edit" for an active pupil). | A (M02 FR-M02-06); P ("Tingkatan", "Kelas", read-only badge) |
| FN-M27-8.1.4 | Order: active first, then newest id first; 25 per page. | S (`UserDirectory::paginate`); A (M02) |
| FN-M27-8.1.5 | No row: "Tiada pengguna dijumpai" / "Cuba ubah kriteria carian anda". | A (M02 FR-M02-19) |
| FN-M27-8.1.6 | The "Tindakan" cell of S6 also holds "Menyamar" (FN-M27-8.5.1). S6 has no "Import Pelajar" or "Import Pengguna" link (the server offers "Import Pengguna" to `/admin/users/bulk-import`; the bulk-import screens are the PENGURUSAN item "Import Pelajar", outside rows L51–L58, whose href stays 404 until built; DV-M27-21), no delete, M02 admin "Login As", checkbox, role or school control, and no approval banner (pupils created here are active; the server banner exists for imports and self-registrations awaiting a national admin). | S (page inspected); P |

**FT-M27-8.2 — Edit pupil (S9)**

| FN | Function | Source |
|---|---|---|
| FN-M27-8.2.1 | Route `/admin-sekolah/pelajar/{id}`: profile card (avatar, name, e-mail, "Daftar: {dd/mm/yyyy}", "Kemaskini: {dd/mm/yyyy HH:mm}"), form "Nama *", "Emel *", "No. Telefon (Pilihan)", read-only line "Status" ("Aktif"), footer "Batal" (to S6) and "Kemaskini". No role, school, grade, IC or "Nota Keselamatan" card. | A (M02 FR-M02-37…44, live); P (subset, no IC; DV-M27-18, DV-M27-21) |
| FN-M27-8.2.2 | Amber bar "Reset Kata Laluan" ("Klik untuk buka bahagian reset kata laluan") toggles "Kata Laluan Baru" ("Minimum 6 aksara"), "Sahkan Kata Laluan Baru" ("Taip semula kata laluan baru") and the hint "Kosongkan jika tidak mahu tukar kata laluan. Kata laluan baru akan berkuat kuasa serta-merta." The bar title is the Panduan name "Reset Kata Laluan"; M02 FR-M02-43 titles the same bar "Tukar Kata Laluan" (both live copy). | L (Panduan FAQ, `M09-content.md:1156`: the title); A (M02 FR-M02-43: the rest); DV-M27-18 |
| FN-M27-8.2.3 | An inactive pupil cannot be edited or reset by the school admin: no "Edit" link and S9 answers 403. | S (`canManageAccount`, decision of 22 Sep) |
| FN-M27-8.2.4 | Save: success returns to S6 with "Pengguna berjaya dikemaskini."; validation as M02 S3. | A (M02 FR-M02-46, UNVERIFIED COPY) |

**FT-M27-8.3 — Tambah Pelajar (S12)**

| FN | Function | Source |
|---|---|---|
| FN-M27-8.3.1 | Route `/admin-sekolah/pelajar/baru`, title "Tambah Pelajar", sub-line "Cipta satu akaun pelajar"; form "Nama penuh *" (hint "Nama pengguna dijana automatik daripada nama ini dan dipaparkan selepas cipta." is not shown, DV-M27-19), the locked school label (school name with meta "{code} · {district} · {state}" without empty parts), "Kelas" (select of the school's `classroom` classes, first option "Tiada kelas"; hint none), "Emel *", "Kata laluan" (text, placeholder = the M02 default password of config S4, hint "Biarkan kosong untuk guna kata laluan lalai (minimum 8 aksara)."); buttons "Cipta Pelajar" (`fa-user-plus`) and "Batal" (to S6). | S (`users-create.blade.php`: title, sub-line, labels, buttons); DV-M27-19 (adaptations) |
| FN-M27-8.3.2 | "Cipta Pelajar" creates one pupil (role `student`, the viewer's school, active) with the validation of BR-M27-41; the school and role from the client are ignored; a chosen class gets an enrolment with source `school_admin`. | S (`UsersController::store`: role hard-restricted, school through `resolveSchoolId`, active); O (M10 DATA-M10-02 source `school_admin`) |
| FN-M27-8.3.3 | After creation S12 reloads empty with the flash `Pelajar "{name}" berjaya dicipta.` and a one-time block "Maklumat log masuk pelajar — catat sekarang, ia tidak akan dipaparkan semula." with "Nama:", "Sekolah:", "Emel:" (the server line "Nama pengguna:" is replaced, DV-M27-19) and "Kata laluan:"; the password is shown only in that response. | S (`new-credential` partial, flash text) |

**FT-M27-8.5 — Menyamar (S6, S7)**

| FN | Function | Source |
|---|---|---|
| FN-M27-8.5.1 | In the "Tindakan" cell of every S6 and S7 row a button "Menyamar" (`fa-user-secret`, `title` "Log masuk sebagai pengguna ini"): enabled for an active pupil (S6) or teacher (S7) of the school; otherwise present but disabled with the reason as `title`: "Akaun ini tidak aktif" (inactive; the server also has "Akaun ini telah digantung" for a suspended account, which has no M01 field and is not rendered). Pressing it asks the native `confirm('Log masuk sebagai {name}? Anda boleh kembali bila-bila masa.')`. | S (`users.blade.php`: `$canImpersonate`, `$impersonateWhyNot`, button copy, confirm) |
| FN-M27-8.5.2 | Accepting switches the session to the target's (`POST /api/admin-sekolah/users/:id/impersonate`), lands on the target's landing path, flashes "Anda kini menyamar sebagai {name}." and shows on every page a sticky amber banner "Mod menyamar — anda melihat sebagai {name}" with the button "Kembali ke Admin" (`fa-user-secret`, `fa-arrow-left-long`); the button calls `POST /api/admin-sekolah/impersonate/leave`, restores the school admin's own session, flashes "Anda telah kembali ke akaun pentadbir." and returns to S6 (S7 when the target was a teacher). Guards: only a `school_admin` of the target's school, never oneself, never a staff account (peer school admin, platform admin, PPD, JPN), never an inactive account, never nested; start and leave are written to an audit log. | S (`ImpersonateController::start/leave`, `impersonation-banner.blade.php`); P (return to S6 or S7 instead of `/admin/users`; session switch contract XR-M27-21) |

**FT-M27-8.4 — Eksport CSV (S6)**

| FN | Function | Source |
|---|---|---|
| FN-M27-8.4.1 | "Eksport CSV" downloads the school's pupils matching the current Status and Cari values, whether or not "Cari" was pressed first, as `users-pelajar-{yyyy-mm-dd}.csv`: UTF-8 with BOM, header `id,name,email,role,sekolah,kelas,is_active,created_at` (the server's `username` and `is_suspended` columns have no owner field, DV-M27-19), cells that start with `=`, `+`, `-`, `@`, tab or carriage return prefixed with `'`, ordered by id. No IC, no phone. | S (`ExportController::users`, confined to the school for `admin_sekolah`) |

### EP-M27-9 — S7 Senarai Guru, S10 Edit Guru, S11 Cipta Pengguna

**FT-M27-9.1 — List**

| FN | Function | Source |
|---|---|---|
| FN-M27-9.1.1 | Route `/admin-sekolah/guru`, title "Senarai Guru", sub-line school name; one count card "Guru" (all teachers of the school, unaffected by the filters; role card of `roleStats`); header-actions row "{n} pengguna dijumpai", the button "Eksport CSV" (FN-M27-9.4.1) and the button "Cipta Pengguna" (to S11). | L (label; Panduan "Senarai Guru" then "Cipta Pengguna"); S (`users.blade.php` header actions, cards); A (M02) |
| FN-M27-9.1.2 | Filter card as S6 (Status, Cari "Nama atau emel...", "Cari"). | A (M02 FR-M02-03) |
| FN-M27-9.1.3 | Table "#", "Nama" (link to S10 for an active teacher, otherwise plain), "Emel", "Telefon", "Kelas" ("{n} kelas" of the teacher's active classes, "-" when none), "Login Terakhir" (relative time, "Belum login"), "Aktif?" (toggle), "Tarikh", "Tindakan" ("Edit" for an active teacher). | A (M02 S1, M18 S9 "Kelas", M11 S3 "Login Terakhir"); P (set) |
| FN-M27-9.1.4 | The "Aktif?" cell is a button with the M02 confirm text; accepting switches the teacher's status. | L (Panduan: "aktif/nyahaktif akaun guru"); A (M02 FR-M02-08); S (conflict resolved, DV-M27-10) |
| FN-M27-9.1.5 | Order, pagination and empty state as S6. | S; A |

**FT-M27-9.2 — Edit teacher (S10)**

| FN | Function | Source |
|---|---|---|
| FN-M27-9.2.1 | Route `/admin-sekolah/guru/{id}`: profile card and form "Nama *", "Emel *", "No. Telefon (Pilihan)", switch "Status Aktif" is not shown (activation is on the list), footer "Batal", "Kemaskini"; the "Reset Kata Laluan" bar as S9. | A (M02 S3); L (Panduan) |
| FN-M27-9.2.2 | An inactive teacher cannot be edited or reset (no link, 403) but can be reactivated from S7. | S (`canManageAccount`); L (Panduan) |

**FT-M27-9.3 — Create teacher (S11)**

| FN | Function | Source |
|---|---|---|
| FN-M27-9.3.1 | Route `/admin-sekolah/guru/baru`, title "Cipta Pengguna"; card "Borang Pendaftaran Pengguna" / "Isi maklumat untuk mendaftarkan pengguna baru"; read-only role "Guru" and locked school label (school name, meta "{code} · {district} · {state}" without empty parts); fields "Nama *", "Emel *", "No. Telefon (Pilihan)", "Kata Laluan *" ("Minimum 6 aksara"), "Sahkan Kata Laluan *" ("Taip semula kata laluan"); footer "Batal" (to S7) and "Daftar Pengguna". | L (Panduan); A (M02 FR-M02-20…36); S (locked `SchoolPicker`, `importableRoles = ['guru']`) |
| FN-M27-9.3.2 | The created user is a teacher of the viewer's school, active; role and school from the client are ignored; success returns to S7 with "Pengguna berjaya didaftarkan.". | S (`resolveSchoolId`); P (active default) |

**FT-M27-9.4 — Eksport CSV (S7)**

| FN | Function | Source |
|---|---|---|
| FN-M27-9.4.1 | "Eksport CSV" on S7 downloads the school's teachers matching the current Status and Cari values as `users-guru-{yyyy-mm-dd}.csv` with the columns, BOM, injection guard and order of FN-M27-8.4.1 (`kelas` empty for a teacher, as the server's `users.kelas` is pupil-only). | S (`ExportController::users`) |

### EP-M27-10 — S8 Kelas Sekolah

**FT-M27-10.1 — List**

| FN | Function | Source |
|---|---|---|
| FN-M27-10.1.1 | Route `/admin-sekolah/kelas`, title "Kelas Sekolah", sub-line school name; tile "Kelas Aktif" (the S0 count) and the line "{n} kelas dipaparkan". | L (label); D (card "KELAS AKTIF"); A (M18 FN-M18-2.9.10) |
| FN-M27-10.1.2 | Table "#", "Kelas", "Subjek" ("Tiada Subjek" when none), "Tingkatan" ("Tingkatan n" / "Darjah n"), "Guru" (name), "Murid" (active members), "Kod Kelas"; an inactive class carries the badge "Tidak Aktif". | A (M18 S9, M10 S4, M08 S3); P (set) |
| FN-M27-10.1.3 | Only `classroom` rows whose `schoolId` is the viewer's school are listed (school scope = `classroom.schoolId`). `school_class` rows ("Kelas Sekolah" of M08 S3) are not listed: they carry no `schoolId` in M10 today (the two observed rows, 419 and 806, have `schoolId` null; M10 offers no way to create one). They join the list when M10 gives them a school link (XR-M27-20, non-blocking). | P (lead decision of 2026-10-03); O (M10 DATA-M10-01, `mock/data/spec.ts:325-343`); DV-M27-20 |
| FN-M27-10.1.4 | Filters: "Tingkatan / Darjah" ("Semua" and the levels the school has) and "Cari" ("Cari kelas..."); order by class name A to Z; 25 per page; empty "Tiada kelas dijumpai" / "Sila cipta kelas terlebih dahulu". | A (M18 FN-M18-2.9.3, 2.9.10); P |

**FT-M27-10.2 — Class link**

| FN | Function | Source |
|---|---|---|
| FN-M27-10.2.1 | The class name links to M08 S5 `/prestasi/kelas/{id}`. | A (M08 S3); XR-M27-13 |

Total new Functions: **80** (FN-M27-2.1.1 … 10.2.1, including the audit additions FN-M27-8.3.1–8.3.3, 8.4.1, 8.5.1, 8.5.2, 9.4.1).

---

## 12. User stories and acceptance criteria

Values use the project clock 2026-09-25T15:40:00+08:00, the fixtures of §10.3 and the oracle rule (the page equals the owner's own query for the same school). E2E runs at 375x812, 768x1024 and 1280x800. MoSCoW as in Part A.

| ID | Feature | MoSCoW | Story | Functions |
|---|---|---|---|---|
| US-M27-12 | FT-M27-2.1 | Must | As the owner, I want S1–S12 closed to guests and other roles and shown only for the user's own school, so that no school sees another's data. | FN-M27-2.1.1–2.1.5 |
| US-M27-13 | FT-M27-2.2 | Must | As a school admin, I want each page headed with its name and my school and its sidebar item highlighted, so that I know where I am. | FN-M27-2.2.1–2.2.4 |
| US-M27-14 | FT-M27-2.3 | Must | As a school admin on any device, I want readable, fitting pages in Bahasa Melayu without exposing personal data of other schools, so that I can use them anywhere. | FN-M27-2.3.1–2.3.5 |
| US-M27-15 | FT-M27-3.1 | Must | As a school admin, I want pupil, teacher, active-pupil, session and answer figures for my school by period, so that I see engagement. | FN-M27-3.1.1–3.1.4 |
| US-M27-16 | FT-M27-3.2 | Should | As a school admin, I want usage split by practice mode and clear empty states, so that I understand quiet periods. | FN-M27-3.2.1–3.2.3 |
| US-M27-17 | FT-M27-4.1 | Must | As a school admin, I want a DSKP heatmap of my pupils' mastery per Standard Pembelajaran, so that I see weak standards. | FN-M27-4.1.1–4.1.5 |
| US-M27-18 | FT-M27-4.2 | Should | As a school admin, I want to choose the subject and level and see empty states, so that I can inspect each subject. | FN-M27-4.2.1, 4.2.2 |
| US-M27-19 | FT-M27-5.1 | Must | As a school admin, I want my school's activity report (logins, practice, activity) over 7, 30 or 90 days, so that I measure use. | FN-M27-5.1.1–5.1.5 |
| US-M27-20 | FT-M27-5.2 | Should | As a school admin, I want my teachers and pupils listed with login and practice status, so that I follow up. | FN-M27-5.2.1, 5.2.2 |
| US-M27-21 | FT-M27-6.1 | Must | As a school admin, I want the school's early-warning page from the sidebar, so that I see at-risk pupils. | FN-M27-6.1.1–6.1.4 |
| US-M27-22 | FT-M27-6.2 | Should | As a school admin, I want the effectiveness page, the printable summary and the CSV from it, so that I can report and act. | FN-M27-6.2.1–6.2.3 |
| US-M27-23 | FT-M27-7.1 | Must | As a school admin, I want a monthly report of my school, so that I review each month. | FN-M27-7.1.1–7.1.3 |
| US-M27-24 | FT-M27-7.2 | Should | As a school admin, I want the 12-month table, subject performance and a print option, so that I can share the report. | FN-M27-7.2.1–7.2.3 |
| US-M27-25 | FT-M27-8.1 | Must | As a school admin, I want the list of my school's pupils, so that I monitor the whole school. | FN-M27-8.1.1–8.1.3, 8.1.5, 8.1.6 |
| US-M27-26 | FT-M27-8.1 | Should | As a school admin, I want to filter and search the pupils and page through them, so that I find one quickly. | FN-M27-8.1.2, 8.1.4, 2.3.5 |
| US-M27-27 | FT-M27-8.2 | Must | As a school admin, I want to edit a pupil's details and reset the password, so that I help pupils who are locked out. | FN-M27-8.2.1–8.2.4 |
| US-M27-28 | FT-M27-9.1 | Must | As a school admin, I want the list of my school's teachers with class count and last login, so that I manage them. | FN-M27-9.1.1–9.1.3, 9.1.5 |
| US-M27-29 | FT-M27-9.1, 9.2 | Must | As a school admin, I want to edit a teacher, reset the password, and activate or deactivate the account, so that access matches reality. | FN-M27-9.1.4, 9.2.1, 9.2.2 |
| US-M27-30 | FT-M27-9.3 | Should | As a school admin, I want "Cipta Pengguna" to register a teacher of my school, so that a new teacher can start. | FN-M27-9.3.1, 9.3.2 |
| US-M27-31 | FT-M27-10.1 | Must | As a school admin, I want the list of my school's classes with level, teacher and members, so that I see how the school is organised. | FN-M27-10.1.1–10.1.3 |
| US-M27-32 | FT-M27-10.1, 10.2 | Should | As a school admin, I want to filter and search classes and open a class's performance, so that I drill in. | FN-M27-10.1.4, 10.2.1 |
| US-M27-33 | FT-M27-2.4 | Must | As a school admin, I want the counts on my lists to agree with the dashboard cards, so that I can trust the numbers. | FN-M27-2.4.1 |
| US-M27-34 | FT-M27-8.3 | Should | As a school admin, I want "Tambah Pelajar" to create one pupil account for my school and see the login details once, so that a pupil can start at once. | FN-M27-8.3.1–8.3.3 |
| US-M27-35 | FT-M27-8.4, 9.4 | Should | As a school admin, I want "Eksport CSV" on the pupil and teacher lists, so that I can keep or share the list I filtered. | FN-M27-8.4.1, 9.4.1 |
| US-M27-36 | FT-M27-8.5 | Should | As a school admin, I want "Menyamar" on a pupil or teacher of my school and a way back, so that I can see what they see when I help them. | FN-M27-8.5.1, 8.5.2 |

### Acceptance criteria

**US-M27-12 — Access and scope**
- **AC-M27-12.1** Given no session, when I open any of `/admin-sekolah/statistik-penggunaan`, `/dskp-heatmap`, `/laporan-aktiviti`, `/laporan-bulanan`, `/pelajar`, `/guru`, `/guru/baru`, `/pelajar/baru`, `/kelas` or `/amaran/sekolah`, then I am sent to `/login`.
- **AC-M27-12.2** Given `admin@demo.test`, `guru@demo.test` or `pelajar@demo.test`, when I open each route of AC-12.1, then the global 403 page of S0 §8.3 shows in place (no redirect, no picker, no 500).
- **AC-M27-12.3** Given a `school_admin` with no school (S0 hook), when I open each route of AC-12.1, then the same 403 page shows and no school name, figure or row appears.
- **AC-M27-12.4** Given P2, when I open S6, S7 or S8 with `?school=900003`, `?school_id=900003` or `?role=teacher` added, then the data is still school 900001's and the role of the page.
- **AC-M27-12.5** Given P2, a pupil of another school (any M02 student with another `schoolId`) and an unknown id, when I open `/admin-sekolah/pelajar/{id}` and `/admin-sekolah/guru/{id}` with each, and teacher 5 on the pupil route and pupil 3001 on the teacher route, then the global 404 page shows every time.
- **AC-M27-12.6** Given `/api/admin-sekolah/*`, when called by a guest, a non-`school_admin` or a `school_admin` without a school, then it answers 401, 403 and 403 with no data.

**US-M27-13 — Header, shell, navigation**
- **AC-M27-13.1** Given P1, when each of S1 to S8 loads, then the header title is the title of §10.1 and the sub-line is the school name "SMK Demo Seri Putra"; S9 and S10 read "Edit Pengguna" / "Kemaskini maklumat pengguna", S11 "Cipta Pengguna" / "Daftarkan akaun guru ke sekolah anda" and S12 "Tambah Pelajar" / "Cipta satu akaun pelajar".
- **AC-M27-13.2** Given the same, then the tab titles are "{title} - PRESTASIPLUS" (PROPOSED) and, for S4, "Amaran Awal — Sekolah | PRESTASIPLUS".
- **AC-M27-13.3** Given P1 at 1280 px, when each route loads, then the user shell with the sidebar shows, and exactly its own item is active: ANALITIK "Statistik Penggunaan", "DSKP Heatmap" or "Laporan Aktiviti"; PENILAIAN "Amaran Awal" (also on `/amaran/sekolah?tingkatan=T4`) or "Laporan Bulanan"; HARIAN "Senarai Pelajar" (also on S9 and S12), "Senarai Guru" (also on S10 and S11) or "Kelas Sekolah"; "Dashboard" is not active on any of them.
- **AC-M27-13.4** Given S1, S2, S3, S5, S6, S7 and S8, then a breadcrumb row "← Dashboard Sekolah" (link to `/admin-sekolah`), a separator and the screen title in bold as a non-link shows under the header; on S4 no breadcrumb row is rendered; on S9 to S12 none is rendered and the form footer shows "Batal" with the back arrow to the list (PROPOSED for S1 to S3 and S5 to S8: S0 precedent).

**US-M27-14 — Responsive, readable, clean**
- **AC-M27-14.1** Given P1, P2 and P4 at 375, 768 and 1280 px, when each screen loads, then the document has no horizontal scroll.
- **AC-M27-14.2** Given the same, then every text node is at least 12 px.
- **AC-M27-14.3** Given 375 px, then each wide table scrolls inside its card and the card does not overflow the page.
- **AC-M27-14.4** Given the pages and the M27 files, then no real person's name, IC number or password appears, except the one-time credential block shown after an S12 create (BR-M27-41); no list shows a user of another school; no IC is rendered anywhere in S1–S12 or exported.
- **AC-M27-14.5** Given an endpoint forced to a server error, when its page loads, then the M01 global error page shows (provisional).
- **AC-M27-14.6** Given any list of 26 or more rows, then 25 rows show with the paginator wording of M02 FR-M02-18 and the links keep the other query parameters; with 25 rows or fewer no paginator shows.

**US-M27-15 — S1 figures**
- **AC-M27-15.1** Given P4 on S1, then seven tiles show in the order "Pelajar", "Guru", "Pelajar Aktif", "Penglibatan", "Sesi Latihan", "Soalan Dijawab", "Purata Ketepatan", and the pills "Hari Ini", "7 Hari", "30 Hari" with "30 Hari" active.
- **AC-M27-15.2** Given P4 and each period, then "Pelajar" and "Guru" equal the M02 counts, "Pelajar Aktif", "Sesi Latihan", "Soalan Dijawab" and "Purata Ketepatan" (one decimal) equal the M05 school queries for the window, "Penglibatan" equals round(aktif ÷ pelajar × 100) and the sub-line of "Pelajar Aktif" reads "daripada {pelajar}" (oracle).
- **AC-M27-15.3** Given `?period=bogus` or no period, then the page is the 30-day view; given `?period=7days`, the "7 Hari" pill is active.
- **AC-M27-15.4** Given P1 (school 900003 has no pupil), then "Pelajar" and "Pelajar Aktif" read "0", "Penglibatan" reads "0%", never "100%".

**US-M27-16 — S1 breakdown and empty states**
- **AC-M27-16.1** Given P4 and a period with sessions, then the card "Mengikut Mod Latihan" lists the session labels with sessions and "Ketepatan Purata", ordered by sessions descending, and the "Sesi" column sums to the tile "Sesi Latihan".
- **AC-M27-16.2** Given P1 (no pupil, so no session) in the 30 days, then the card shows "Tiada data untuk tempoh ini" and "Tiada aktiviti latihan dalam tempoh 30 Hari yang lepas."; for `7days` the text reads "… 7 Hari …".
- **AC-M27-16.3** Given `?period=today` and no session today, then the text "Belum ada pelajar buat latihan hari ini. Cuba lihat 7 Hari atau 30 Hari." shows with "7 Hari" and "30 Hari" as links to `?period=7days` and `?period=30days`.
- **AC-M27-16.4** Given no session in the period, then "Purata Ketepatan" reads "—" and the footnote "Ketepatan dipaparkan sebagai “—” kerana belum ada sesi latihan direkodkan dalam skop ini." shows; no export control exists on S1.

**US-M27-17 — S2 heatmap**
- **AC-M27-17.1** Given P2 on S2 with the subject Kimia and `?tingkatan=T5` (the only seeded SP records of a school: M08 SpRecords derived from the designed sessions of pupils 3001–3008; the build confirms the SP codes), then the card heading "Peta DSKP — Standard Pembelajaran", the caption "KSSM {Subjek} Tingkatan {n}" and the legend "Mahir (75%+)", "Sederhana (50-74%)", "Lemah (<50%)", "Belum Cuba" show.
- **AC-M27-17.2** Given the default subject and "Tingkatan 4", then the tiles are the SPs of the M10 DSKP store for that subject and level, grouped under Bidang headings in code order, each with its SP code.
- **AC-M27-17.3** Given P2 on Kimia at Tingkatan 5 and a tile with answers, then its value is round(100 × Σcorrect ÷ Σanswered) over the school's pupils (oracle: M08 SpRecord), its status follows 75 and 50 on the shown value, and its colour is green, yellow or red; a tile without answers is slate with no value.
- **AC-M27-17.4** Given a tile, then its `title` is "{code}: {title} — {status}" with " · {n} cuba · {p}% betul" added when answered, and tiles are not links.

**US-M27-18 — S2 filters and states**
- **AC-M27-18.1** Given S2, when I change the select "Subjek" or click the pill "Tingkatan 5", then the page reloads with `?subjectId=…&tingkatan=T5` and the tiles and caption follow; "Tingkatan 4" is active by default.
- **AC-M27-18.2** Given a level at which no subject has an SP (the select "Subjek" lists only subjects with at least one SP at the chosen level), or `?subjectId=` naming a subject without SP at the level, then the text "Tiada Standard Pembelajaran untuk subjek dan tingkatan ini." shows (provisional).
- **AC-M27-18.3** Given P4 (no SpRecord outside the admin anchors and the designed pupils) on any subject, then every tile reads "Belum cuba" and shows no percentage (no error).
- **AC-M27-18.4** Given P2 and P4 on Kimia at Tingkatan 5, then P2 shows values on the tiles with SpRecords and P4 shows none, and no value is a platform total.

**US-M27-19 — S3 overview**
- **AC-M27-19.1** Given P4 on S3, then the title "Laporan Aktiviti", the tabs "Overview", "Guru ({n})", "Murid ({n})" (no "Sekolah" tab) and the pills "7 Hari", "30 Hari" (active), "3 Bulan" show.
- **AC-M27-19.2** Given P4 and each range, then "Murid Pernah Login", "Cikgu Pernah Login", "Murid Buat Latihan" and "Jumlah Aktiviti" equal the M17 queries restricted to the school (oracle) with the M17 sub-lines.
- **AC-M27-19.3** Given S3, then no card "Skor Purata", no chip "Struktur", and neither "keseluruhan platform" nor "seluruh platform" appears in the page text.
- **AC-M27-19.4** Given P4, then "Trend Aktiviti", "Pecahan Aktiviti" (four rows), "Pelajar Paling Aktif" (at most 10) and "Cikgu Belum Login" (at most 20, with e-mail) contain only users of the school.
- **AC-M27-19.5** Given `?range=5`, then the 30-day view shows.

**US-M27-20 — S3 tabs**
- **AC-M27-20.1** Given the "Guru" tab, then the heading "Senarai Guru ({n})", the pills, the search "Cari guru...", the four tiles and the columns "#", "Nama", "Login", "MCQ", "Struktur", "Syiling", "Headcount", "Login Terakhir" show, with no "Sekolah" column and no school select; the pills filter the rows.
- **AC-M27-20.2** Given the "Murid" tab, then the heading "Senarai Murid ({n}) — Top 200", the pills "Semua", "Aktif", "Login Sahaja", "Belum Login", the search "Cari murid...", the four tiles and the columns "#", "Nama", "Kelas", "Sesi", "Ketepatan", "Masa", "Syiling", "Login Terakhir" show, each pill lists its pupils (never an always-empty list), at most 200 rows.
- **AC-M27-20.3** Given the "Sekolah" tab is absent and any search, then a search with no match shows no rows and no error.

**US-M27-21 — S4 school page**
- **AC-M27-21.1** Given P4 on `/amaran/sekolah`, then the header "Amaran Awal — Sekolah" with the school name, the pills "Semua Tingkatan" (active), "Tingkatan 4", "Tingkatan 5" and the four tiles "Jumlah Pelajar", "On Track", "Perlu Perhatian", "Berisiko Tinggi" show (`@blocked-by M18`).
- **AC-M27-21.2** Given the same, then the tiles, the card "Taburan Risiko Seluruh Sekolah" (integer %, "Hijau: {n}", "Kuning: {n}", "Merah: {n}") equal M18 `Q-M18-RISK(schoolId)` for the school (oracle) (`@blocked-by M18`).
- **AC-M27-21.3** Given pupils with answers, then "Analisis Risiko Mengikut Subjek" rows read "{w}/{m} pelajar lemah ({p}%)" and "Senarai Pelajar Berisiko" shows the eight columns ordered by score descending, as M18 S22 (`@blocked-by M18`).
- **AC-M27-21.4** Given P1 on any user-shell page, when I click the sidebar "Amaran Awal", then `/amaran/sekolah` opens.
- **AC-M27-21.5** Given `guru@demo.test` or `admin@demo.test`, when I open `/amaran/sekolah`, then the 403 page shows (M18's own `/amaran` and `/amaran/sekolah/{id}` keep their M18 access).

**US-M27-22 — S4 buttons and scope**
- **AC-M27-22.1** Given S4, then the buttons "Keberkesanan Intervensi", "Ringkasan Eksekutif" and "Muat Turun CSV" show in that order with the targets `/amaran/keberkesanan`, `/amaran/ringkasan-eksekutif?scope=school&school_id={own id}` and `/amaran/export/school/{own id}`. The targets of the first two buttons are not followed in prototype 1.0: those pages are deferred (DV-M27-23), so the E2E steps that open `/amaran/keberkesanan` and `/amaran/ringkasan-eksekutif` are tagged `@blocked-by M18`; the order, labels, icons and `href` values are asserted.
- **AC-M27-22.2** Given "Muat Turun CSV", then the file name is `amaran-sekolah-{own id}-{yyyymmdd}.csv`, the columns are M18's, and every row is a pupil of the school (no IC, e-mail or phone) (`@blocked-by M18`).
- **AC-M27-22.3** Given P1 opening `/amaran/sekolah/900001` or `/amaran/export/school/900001`, then M18 answers its refusal for a school outside the scope (403) (`@blocked-by M18`).
- **AC-M27-22.4** Given P1 (no pupil), then the tiles show "0", no list row shows and no error (provisional).
- **AC-M27-22.5** Given `?tingkatan=T4`, then the "Tingkatan 4" pill is active, only pupils in T4 classes count and the sub-line reads "{school name} — Tingkatan 4" (`@blocked-by M18`).

**US-M27-23 — S5 monthly report**
- **AC-M27-23.1** Given P4 on S5 at the clock, then the heading reads "Laporan September 2026", the previous-month link reads "← Ogos 2026" and no next-month link shows (the month is current). BM month names: Januari, Februari, Mac, April, Mei, Jun, Julai, Ogos, September, Oktober, November, Disember.
- **AC-M27-23.2** Given the shown month, then "Penglibatan", "Soalan Dijawab", "Ketepatan" and "Sesi Latihan" equal the M05 and M02 school queries for that calendar month (oracle) with the sub-lines "{n} aktif / {n} daftar" and "{x} soalan/pelajar".
- **AC-M27-23.3** Given `?bulan=2026-08`, then "Laporan Ogos 2026" shows with both "← Julai 2026" and "September 2026 →"; given `?bulan=2027-01` or `?bulan=x`, then the current month shows.
- **AC-M27-23.4** Given a month without answers, then the cards read "0%", "0", "—", "0" and the sections below are not rendered.

**US-M27-24 — S5 sections and print**
- **AC-M27-24.1** Given P4, then the card "Statistik Bulanan" with the subtitle "12 bulan terakhir — pecahan prestasi mengikut bulan" lists the months with at least one completed session among the 12 ending with the shown month, columns as FN-M27-7.2.1, values equal to the oracle; with more than one row the footer "Jumlah" sums answers and correct and shows the pooled accuracy.
- **AC-M27-24.2** Given no month with sessions, then "Tiada data" and "Tiada aktiviti direkodkan buat masa ini" show.
- **AC-M27-24.3** Given the shown month with answers, then "SUBJEK TERKUAT" and "SUBJEK PERLU PERHATIAN" name the subjects of highest and lowest accuracy with "{p}% ({n} soalan)", and one row per subject reads "{p}% · {n} soalan · {n} pelajar".
- **AC-M27-24.4** Given S5, then the footer reads "Laporan dijana: 25 Sep 2026, 03:40 PM · PrestasiPlus" at the clock and the button "Cetak / PDF" calls `window.print()` once when clicked (provisional).

**US-M27-25 — S6 list**
- **AC-M27-25.1** Given P4 on S6, then the single card "Pelajar" equals the M02 count of the school's pupils, active or not (oracle), does not change with the filters, and no card "Aktif" or "Tidak Aktif" exists.
- **AC-M27-25.2** Given the table, then the columns are "#", "Nama", "Emel", "Telefon", "Tingkatan", "Kelas", "Aktif?", "Tarikh", "Tindakan"; each row equals its M02 user (phone "-" when empty, date `dd/mm/yyyy`), the "Kelas" cell lists the active M10 classes or "-".
- **AC-M27-25.3** Given P2, then every row has `schoolId` 900001 and role student (pupils 3001–3008 among them), and no teacher, school admin or pupil of another school appears.
- **AC-M27-25.4** Given P1 (no pupil), then the row "Tiada pengguna dijumpai" and "Cuba ubah kriteria carian anda" shows and no paginator.
- **AC-M27-25.5** Given an active pupil, then the "Aktif?" badge reads "Aktif" and is not a control, the name is a link to S9 and the action "Edit" shows; given an inactive pupil, then the badge reads "Tidak" and neither link nor "Edit" shows. The header-actions row shows "{n} pengguna dijumpai", the buttons "Eksport CSV" and "Tambah Pelajar" (to `/admin-sekolah/pelajar/baru`); no "Import Pelajar", "Import Pengguna", delete, M02 admin "Login As" or checkbox control exists; the cell holds "Menyamar" (AC-M27-36.1).

**US-M27-26 — S6 filters, order, paging**
- **AC-M27-26.1** Given the filter "Status" "Aktif" or "Tidak Aktif" or a search text (name or e-mail, case-insensitive), then the rows narrow accordingly and the controls keep their values from the URL.
- **AC-M27-26.2** Given the unfiltered list, then active pupils come first and, inside each group, the newest id first.
- **AC-M27-26.3** Given 26 or more pupils, then 25 rows show on page 1 and the paginator reads "Showing 1 to 25 of {total} results" at 1280 px.

**US-M27-27 — S9 edit pupil**
- **AC-M27-27.1** Given P2 and an active pupil (3001), when I open S9, then the profile card, the form "Nama *", "Emel *", "No. Telefon (Pilihan)", the line "Status" "Aktif", and the footer "Batal" and "Kemaskini" show, with no role, school, grade or IC field.
- **AC-M27-27.2** Given I change the name and press "Kemaskini", then S6 shows with "Pengguna berjaya dikemaskini." and the M02 record holds the new name.
- **AC-M27-27.3** Given an empty name, an invalid e-mail or an e-mail of another user, then the M02 validation errors show above the form and nothing is saved.
- **AC-M27-27.4** Given I open "Reset Kata Laluan", then "Kata Laluan Baru" and "Sahkan Kata Laluan Baru" show; given a matching password of at least 6 characters, then it is saved and the pupil can sign in with it; given a mismatch or fewer than 6 characters, then the M02 error shows.
- **AC-M27-27.5** Given an inactive pupil, when I open S9 by URL, then the 403 page shows.
- **AC-M27-27.6** Given the request body adds `role`, `schoolId` or `isActive`, then they are ignored.

**US-M27-28 — S7 list**
- **AC-M27-28.1** Given P2 on S7, then the single card "Guru" equals the M02 count of the school's teachers and the header-actions row shows "{n} pengguna dijumpai" and the buttons "Eksport CSV" and "Cipta Pengguna".
- **AC-M27-28.2** Given the table, then the columns are "#", "Nama", "Emel", "Telefon", "Kelas", "Login Terakhir", "Aktif?", "Tarikh", "Tindakan", and only users with role teacher of school 900001 appear (teacher 5 included, no school admin).
- **AC-M27-28.3** Given teacher 5, then "Kelas" reads "2 kelas" (classes 2001 and 2002: owner anchor facts, M10 §6.2.1) and "Login Terakhir" is the M17 relative time of the user or "Belum login".
- **AC-M27-28.4** Given P1 (no teacher), then "Tiada pengguna dijumpai" shows.
- **AC-M27-28.5** Given the filters and paging, then they behave as AC-26.1 to AC-26.3.

**US-M27-29 — S10 and activation**
- **AC-M27-29.1** Given an active teacher, when I open S10, then the form "Nama *", "Emel *", "No. Telefon (Pilihan)" and the bar "Reset Kata Laluan" show, with no role, school or password field open.
- **AC-M27-29.2** Given I save, then S7 shows with "Pengguna berjaya dikemaskini." and the record changes; validation as AC-27.3.
- **AC-M27-29.3** Given the reset with a valid password, then the teacher can sign in with it.
- **AC-M27-29.4** Given the "Aktif?" button of an active teacher, when I press it, then the native confirm "Pasti untuk menukar status pengguna ini?" shows; cancel does nothing; accept switches the status to "Tidak" and the teacher can no longer sign in (M01 refusal).
- **AC-M27-29.5** Given an inactive teacher, then the name and "Edit" are not links, S10 by URL answers 403, and the button "Tidak" can switch the account back to "Aktif".
- **AC-M27-29.6** Given the body adds `role`, `schoolId`, a school admin id or a teacher of another school, then the role and school are ignored and the foreign id answers 404.

**US-M27-30 — S11 create teacher**
- **AC-M27-30.1** Given S7, when I click "Cipta Pengguna", then `/admin-sekolah/guru/baru` opens.
- **AC-M27-30.2** Given S11, then the card heading "Borang Pendaftaran Pengguna", the read-only role "Guru", the locked school label with the school name and the fields "Nama *", "Emel *", "No. Telefon (Pilihan)", "Kata Laluan *", "Sahkan Kata Laluan *" show, with no school search and no role select; the footer shows "Batal" and "Daftar Pengguna".
- **AC-M27-30.3** Given valid values, when I press "Daftar Pengguna", then S7 (P2) shows with "Pengguna berjaya didaftarkan." and the new teacher is listed, active, of school 900001.
- **AC-M27-30.4** Given an e-mail already used or a password mismatch, then the M02 errors show and nothing is created.
- **AC-M27-30.5** Given the body adds `role: 'admin'` or another `schoolId`, then the created user is still a teacher of the viewer's school.

**US-M27-31 — S8 list**
- **AC-M27-31.1** Given P2 on S8, then the tile "Kelas Aktif" equals the S0 card "KELAS AKTIF" and the line "{n} kelas dipaparkan" equals the M10 count for school 900001.
- **AC-M27-31.2** Given the table, then the columns "#", "Kelas", "Subjek", "Tingkatan", "Guru", "Murid", "Kod Kelas" show; classes 2001 and 2002 (owner anchor facts) read "5 MARIKH - Kimia" and "5 MARIKH - Sejarah", "Tingkatan 5", teacher 5's name, "Murid" = M10 active members and the M10 join codes.
- **AC-M27-31.3** Given the M10 `school_class` rows 419 and 806 (no `schoolId`), then they appear on no school's S8 and `GET /api/admin-sekolah/kelas` returns only `kind: 'classroom'` rows; a `classroom` row without a subject reads "Tiada Subjek". (The "school_class" inclusion is `@provisional` and waits for XR-M27-20.)
- **AC-M27-31.4** Given P1 (no class), then "0 kelas dipaparkan", "Tiada kelas dijumpai" and "Sila cipta kelas terlebih dahulu" show.
- **AC-M27-31.5** Given P2, then no class of another school appears.

**US-M27-32 — S8 filters and link**
- **AC-M27-32.1** Given the filter "Tingkatan / Darjah" (options "Semua" and the school's levels) and the search "Cari kelas...", then rows narrow by level and by class name (case-insensitive); order is name A to Z.
- **AC-M27-32.2** Given 26 or more classes, then 25 rows show with the paginator.
- **AC-M27-32.3** Given a `classroom` row, when I click its name, then M08 S5 `/prestasi/kelas/{id}` opens for the class (`@blocked-by XR-M27-13`, provisional).

**US-M27-33 — Coherence**
- **AC-M27-33.1** Given P4, then the unfiltered "Pelajar" card of S6 equals "JUMLAH PELAJAR" on S0.
- **AC-M27-33.2** Given P4, then the unfiltered "Guru" card of S7 equals "JUMLAH GURU" on S0, and the "Kelas Aktif" tile of S8 equals "KELAS AKTIF".
- **AC-M27-33.3** Given P4, then the S4 tiles "On Track", "Perlu Perhatian" and "Berisiko Tinggi" equal the S0 "Selamat", "Berhati" and "Berisiko" (`@blocked-by M18`).

**US-M27-34 — S12 Tambah Pelajar**
- **AC-M27-34.1** Given P2 on S6, when I click "Tambah Pelajar", then `/admin-sekolah/pelajar/baru` opens with the header "Tambah Pelajar" and the sub-line "Cipta satu akaun pelajar", and "Senarai Pelajar" is the active sidebar item.
- **AC-M27-34.2** Given S12, then the fields "Nama penuh *", the locked school label (name "SMK DEMO" with meta "BEA4001 · PPD PETALING UTAMA · Selangor"), the select "Kelas" (options "Tiada kelas", then the school's `classroom` classes 2001 and 2002), "Emel *" and "Kata laluan" show with the hint "Biarkan kosong untuk guna kata laluan lalai (minimum 8 aksara).", and the buttons "Cipta Pelajar" and "Batal"; there is no school search and no role field.
- **AC-M27-34.3** Given valid values and class 2001, when I press "Cipta Pelajar", then S12 reloads empty with the flash `Pelajar "{name}" berjaya dicipta.` and the block "Maklumat log masuk pelajar — catat sekarang, ia tidak akan dipaparkan semula." with "Nama:", "Sekolah:", "Emel:" and "Kata laluan:"; the M02 record is a student of school 900001, active; M10 holds an active enrolment in class 2001 with source `school_admin`; S6 lists the pupil; a reload of S12 shows no password.
- **AC-M27-34.4** Given a name shorter than 3 characters, an empty or already used e-mail, or a typed password shorter than 8 characters, then the errors show above the form and nothing is created.
- **AC-M27-34.5** Given the body adds `role`, `schoolId` or `isActive`, then they are ignored; given a `classId` that is not a `classroom` of the school, then the request is refused (422) and nothing is created.

**US-M27-35 — Eksport CSV**
- **AC-M27-35.1** Given P2 on S6 with Status "Aktif" and a search text typed but "Cari" not pressed, when I click "Eksport CSV", then the file `users-pelajar-2026-09-25.csv` downloads and holds the pupils matching those controls as they stand in the form (UTF-8 BOM, header `id,name,email,role,sekolah,kelas,is_active,created_at`, ordered by id).
- **AC-M27-35.2** Given the file, then every row is a pupil of school 900001, `sekolah` is its name, `kelas` lists the pupil's active classes, and no IC, phone, user of another school or non-pupil role appears; on S7 the file is `users-guru-2026-09-25.csv` with teachers of the school and an empty `kelas`.
- **AC-M27-35.3** Given a cell value that starts with `=`, `+`, `-`, `@`, a tab or a carriage return, then it is written with a leading `'`.

**US-M27-36 — Menyamar**
- **AC-M27-36.1** Given P2 on S6 and S7, then every row has a "Menyamar" button (`title` "Log masuk sebagai pengguna ini"), enabled for an active pupil or teacher and disabled with `title` "Akaun ini tidak aktif" for an inactive one; pressing an enabled one shows the confirm "Log masuk sebagai {name}? Anda boleh kembali bila-bila masa."; cancel does nothing.
- **AC-M27-36.2** Given P2 accepts for pupil 3001, then the session is 3001's, the page is the pupil's landing path, the flash "Anda kini menyamar sebagai {name}." shows and every page carries the banner "Mod menyamar — anda melihat sebagai {name}" with "Kembali ke Admin" (`@blocked-by XR-M27-21`; the banner is rendered by the shell, XR-M27-11(e)).
- **AC-M27-36.3** Given "Kembali ke Admin", then the session is P2's again, the flash "Anda telah kembali ke akaun pentadbir." shows, S6 opens (S7 when the target was teacher 5) and the banner is gone (`@blocked-by XR-M27-21`).
- **AC-M27-36.4** Given the endpoint, then a target that is another school's user, a school admin, the platform admin, an inactive account, oneself, or a second start while impersonating is refused (404 for another school or unknown, 403 for a staff or inactive target, 409 for nested), and no session switch happens (`@blocked-by XR-M27-21`).
- **AC-M27-36.5** Given a start and a leave, then each writes one audit row (actor, target, action `impersonate.start` or `impersonate.leave`, time) readable through the mock hook (`@blocked-by XR-M27-21`).

Totals: **25 stories, 80 Functions, 112 acceptance criteria** (US-M27-12…36).

---

## 13. UI expectations

| Screen | Behaviour notes |
|---|---|
| S1 | Header, breadcrumb, period pills, seven tiles (2 / 4 / 4 per row at 375 / 768 / 1280, the last row partly filled), card "Mengikut Mod Latihan"; empty card replaces the table. |
| S2 | Filter card, heading card with caption, legend, Bidang groups of tiles that wrap; tiles at least 12 px text. |
| S3 | Tabs and pills as M17 S11; overview cards 2 per row at 375 and 768, 4 at 1280 (M17's `grid-cols-2 lg:grid-cols-5` with one card fewer; the lg breakpoint is 1024); tables scroll inside their cards. |
| S4 | The M18 S22 layout: pills, four tiles, distribution bar, buttons right-aligned, subject card, risk table. |
| S5 | Month heading with the two navigation links, four cards, the table card, the subject card, footer with the print button. |
| S6, S7 | One count card, filter card, header-actions row ("{n} pengguna dijumpai" left, buttons right; at 375 the buttons wrap below the text), table card with paginator. S6 buttons "Eksport CSV", "Tambah Pelajar"; S7 buttons "Eksport CSV", "Cipta Pengguna". |
| S8 | Tile, count line, filter card, table card with paginator. |
| S9, S10, S11, S12 | M02 S3 and S2 form layout (S12: the server's `users-create` card, max width 2xl): profile card (S9, S10), form card, amber reset bar, footer actions. |

Design details belong to the design phase.

---

## 14. Coverage matrix (completeness proof)

Evidence elements of the discovery file (`docs/discovery/M27-admin-sekolah-screens.md`), the roles-matrix screenshots and the deck images, mapped to Functions. Status: mapped (M), mapped and adapted with a deviation (MD), deliberately not adopted with the reason (N).

| EL | Element | Provenance | Function | Status |
|---|---|---|---|---|
| EL-S1-01 | Sidebar label "Statistik Penggunaan" (ANALITIK, after "Analitik Adaptif") | LIVE | FN-M27-2.2.3, 3.1.1 | M |
| EL-S1-02 | Route exists (302 to picker for the platform admin) | LIVE | FN-M27-2.1.2, 3.1.1 | MD (DV-M27-01) |
| EL-S1-03 | Panduan card "Pelajar aktif, sesi latihan, soalan dijawab — gambaran engagement." | LIVE | FN-M27-3.1.3 | M |
| EL-S1-04 | Deck sidebar item under PENGURUSAN | SERVER-DECK | FN-M27-2.2.3 | N (live screenshot places it under ANALITIK, DV-M27-14) |
| EL-S1-05 | Header pattern title plus school sub-line | SERVER-DECK | FN-M27-2.2.1 | M |
| EL-S1-06 | Period pills "Hari Ini", "7 Hari", "30 Hari" | ANALOGUE (M18 S3) | FN-M27-3.1.2 | M |
| EL-S1-07 | Counters "Pelajar Aktif" and "Sekolah" | ANALOGUE (M18 S3) | FN-M27-3.1.3 | MD ("Sekolah" dropped: one school, DV-M27-11) |
| EL-S1-08 | Empty-state cards (30, 7, today) | ANALOGUE (M18 S3) | FN-M27-3.2.2 | M |
| EL-S1-09 | Summary strip "Sekolah / Guru / Pelajar / Pelajar Aktif / Penglibatan / Ketepatan" | SERVER | FN-M27-3.1.3 | MD ("Sekolah" dropped; "Ketepatan" labelled "Purata Ketepatan" as in the deck, DV-M27-11) |
| EL-S1-10 | Table "Mengikut Mod Latihan" | SERVER | FN-M27-3.2.1 | M |
| EL-S1-11 | Table "Mengikut Sekolah" | SERVER | none | N (one school only, DV-M27-11) |
| EL-S1-12 | Footnote on "—" accuracy | SERVER | FN-M27-3.2.2 | M |
| EL-S1-13 | Formulas (active, Penglibatan, accuracy, mode split) | SERVER | FN-M27-3.1.4 | M |
| EL-S1-14 | Server denies the PPD/JPN statistics page to a school admin | SERVER | none | N (live Panduan and sidebar win, DV-M27-11) |
| EL-S1-15 | Export | none | FN-M27-3.2.3 | M (none) |
| EL-S2-01 | Sidebar label "DSKP Heatmap" (ANALITIK) | LIVE | FN-M27-2.2.3, 4.1.1 | M |
| EL-S2-02 | Route exists (302) | LIVE | FN-M27-2.1.2 | MD (DV-M27-01) |
| EL-S2-03 | Student card "Peta DSKP — Standard Pembelajaran", caption, legend, tile colours, title format | ANALOGUE (M08 S7) | FN-M27-4.1.1, 4.1.4, 4.1.5 | M |
| EL-S2-04 | Cell copy "{n} cuba · {p}% betul" | ANALOGUE (R10 S1) | FN-M27-4.1.5 | M |
| EL-S2-05 | Student heatmap grouping subject, strand, tile; bands 50 and 80 | SERVER | FN-M27-4.1.2 | MD (grouping adopted, bands of M08 used because the label is DSKP, DV-M27-12) |
| EL-S2-06 | School by subject matrix (M18 S6) | ANALOGUE | none | N (other scope: districts) |
| EL-S2-07 | Tile grid per school coloured by participation (server `peta-haba`) | SERVER | none | N (district page, not DSKP) |
| EL-S2-08 | Page content (axes, filters, export, empty) | none | FN-M27-4.1.x, 4.2.x | M (PROPOSED, D23) |
| EL-S3-01 | Sidebar label "Laporan Aktiviti" (ANALITIK, last) | LIVE | FN-M27-2.2.3, 5.1.1 | M |
| EL-S3-02 | Inferred href `/admin-sekolah/laporan-aktiviti` answers 404 | LIVE | FN-M27-5.1.1 | MD (built, DV-M27-08) |
| EL-S3-03 | Admin drawer label "Laporan Aktiviti" opening `/admin/laporan` | LIVE | FN-M27-5.1.1 | M |
| EL-S3-04 | Tabs, range pills | ANALOGUE (M17 S11) | FN-M27-5.1.1, 5.1.2 | MD ("Sekolah" tab hidden, DV-M27-13) |
| EL-S3-05 | Overview cards "Murid Pernah Login", "Cikgu Pernah Login", "Murid Buat Latihan", "Jumlah Aktiviti", "Skor Purata" + "Struktur" | ANALOGUE | FN-M27-5.1.3 | MD ("Skor Purata" and chip hidden, DV-M27-13) |
| EL-S3-06 | "Trend Aktiviti", "Pecahan Aktiviti", "Pelajar Paling Aktif", "Cikgu Belum Login" | ANALOGUE | FN-M27-5.1.4 | M |
| EL-S3-07 | Sekolah tab table | ANALOGUE | none | N (one school, DV-M27-13) |
| EL-S3-08 | Guru and Murid tabs | ANALOGUE | FN-M27-5.2.1, 5.2.2 | MD (school column and select hidden) |
| EL-S3-09 | School-confined queries, one school figure, e-mails of own teachers | SERVER | FN-M27-2.1.4, 5.1.4 | M |
| EL-S3-10 | Server proxies "logged in = e-mail verified" | SERVER | none | N (M17 live definitions win) |
| EL-S3-11 | Platform sub-line "Penglibatan pengguna seluruh platform" | ANALOGUE | FN-M27-5.1.5 | N (never shown to a school admin) |
| EL-S4-01 | Sidebar label "Amaran Awal" (PENILAIAN) | LIVE | FN-M27-2.2.3, 6.1.1 | M |
| EL-S4-02 | URL `prestasiplus.my/amaran/sekolah` | SERVER-DECK | FN-M27-6.1.1 | M |
| EL-S4-03 | Header "Amaran Awal — Sekolah" and school sub-line | SERVER-DECK | FN-M27-6.1.2 | M |
| EL-S4-04 | Level pills | SERVER-DECK | FN-M27-6.1.2 | M |
| EL-S4-05 | Four tiles | SERVER-DECK | FN-M27-6.1.3 | M |
| EL-S4-06 | "Taburan Risiko Seluruh Sekolah" bar and legend | SERVER-DECK | FN-M27-6.1.3 | M |
| EL-S4-07 | Buttons "Ringkasan Eksekutif", "Muat Turun CSV" | SERVER-DECK | FN-M27-6.2.1 | M |
| EL-S4-08 | Button "Keberkesanan Intervensi" (live, not in the deck) | ANALOGUE (M18) | FN-M27-6.2.1 | M (live wins, DV-M27-15) |
| EL-S4-09 | "Analisis Risiko Mengikut Subjek" | SERVER-DECK | FN-M27-6.1.4 | M |
| EL-S4-10 | "Senarai Pelajar Berisiko" table | ANALOGUE (M18 S22) | FN-M27-6.1.4 | M |
| EL-S4-11 | Risk score, status cut-offs, weakness | OWNER (M18) | FN-M27-6.1.3, 6.1.4 | M |
| EL-S4-12 | Server teacher class risk rule (binary) | SERVER | none | N (M18 score is the live definition) |
| EL-S4-13 | CSV and print child pages | ANALOGUE (M18) | FN-M27-6.2.1 | M |
| EL-S4-14 | Foreign id behaviour | OWNER (M18 BR-M18-01, §9 matrix, FR-M18-09) | FN-M27-6.2.2 | M |
| EL-S5-01 | Sidebar label "Laporan Bulanan" (PENILAIAN, after "Amaran Awal") | LIVE | FN-M27-2.2.3, 7.1.1 | M |
| EL-S5-02 | Route exists (302) | LIVE | FN-M27-2.1.2 | MD (DV-M27-01) |
| EL-S5-03 | M17 S9 school KPI cards, subject performance, footer | ANALOGUE | FN-M27-7.1.2, 7.2.2, 7.2.3 | M |
| EL-S5-04 | M17 S8 year navigation | ANALOGUE | FN-M27-7.1.1 | M (month level) |
| EL-S5-05 | M18 S9 "Statistik Bulanan" table | ANALOGUE | FN-M27-7.2.1 | M |
| EL-S5-06 | M18 S23 "Cetak / PDF" | ANALOGUE | FN-M27-7.2.3 | M |
| EL-S5-07 | Server school focus report (monthly bars, strongest and weakest subject, headcount) | SERVER | FN-M27-7.2.2 | MD (headcount section not adopted: no month definition, DV-M27-16) |
| EL-S5-08 | Panduan print sentence ("Ringkasan Eksekutif") | LIVE | FN-M27-6.2.1 | M (belongs to S4) |
| EL-S5-09 | Page content (month picker, charts, export) | none | FN-M27-7.x | M (PROPOSED, D23) |
| EL-S6-01 | Sidebar label "Senarai Pelajar" (HARIAN) | LIVE | FN-M27-2.2.3, 8.1.1 | M |
| EL-S6-02 | Route exists (302) | LIVE | FN-M27-2.1.2 | MD (DV-M27-01) |
| EL-S6-03 | Panduan "Urus Pelajar": import, edit, monitor the whole school | LIVE | FN-M27-8.1.1, 8.2.1 | MD (bulk import not on S6, DV-M27-21) |
| EL-S6-04 | Panduan FAQ: click the user name, then "Reset Kata Laluan" | LIVE | FN-M27-8.1.3, 8.2.2 | MD (bar title from Panduan over M02 "Tukar Kata Laluan", DV-M27-18) |
| EL-S6-05 | Panduan FAQ: CSV columns name, email, grade | LIVE | none | N (Import Pelajar is outside rows L51–L58, XR-M27-11) |
| EL-S6-06 | M02 S1 columns, filters, empty copy, paginator | ANALOGUE | FN-M27-8.1.2–8.1.5, 2.3.5 | MD (role, school, checkbox, delete and the M02 admin "Login As" dropped; the server's "Menyamar" is adopted instead, EL-S6-22) |
| EL-S6-07 | M18 S9 and M11 S3 pupil tables (class, Tingkatan) | ANALOGUE | FN-M27-8.1.3 | M (columns "Tingkatan", "Kelas") |
| EL-S6-08 | `UserDirectory` filters, order, 25 per page | SERVER | FN-M27-8.1.2, 8.1.4 | M |
| EL-S6-09 | `StaffScope` edit and reset rules (own school, active only) | SERVER | FN-M27-8.2.3 | M |
| EL-S6-10 | Server activation by national admin only | SERVER | FN-M27-8.1.3 | M (pupils read-only, DV-M27-10) |
| EL-S6-11 | IC masking with PDPA reveal (M18 S9) | ANALOGUE | none | N (no IC on school-admin lists, FN-M27-2.3.3) |
| EL-S6-12 | Deck sidebar items "Senarai Pelajar", "Import Pelajar" | SERVER-DECK | FN-M27-2.2.3 | N (DV-M27-14) |
| EL-S6-13 | Button "Tambah Pelajar" (`fa-user-plus`) on the school admin's `/admin/users`, route `admin.users.create` | SERVER (`users.blade.php:144-149`) | FN-M27-8.1.1, 8.3.1 | MD (new S12, adapted: DV-M27-19) |
| EL-S6-14 | Single-pupil create form (`users-create.blade.php`) and `UsersController::store` (role fixed to pelajar, school pinned, username generated, default password, class text) | SERVER | FN-M27-8.3.1, 8.3.2 | MD (DV-M27-19) |
| EL-S6-15 | One-time credential block `new-credential` and flash `Pelajar "{name}" berjaya dicipta.` | SERVER | FN-M27-8.3.3 | MD ("Nama pengguna" line replaced by "Emel", DV-M27-19) |
| EL-S6-16 | Button "Eksport CSV" with `formaction="/admin/export/users"`, `ExportController::users` (confined to the school, filters from the form, BOM, `'` guard, columns `id,name,username,email,role,sekolah,kelas,is_active,is_suspended,created_at`, name `users-{role}-{date}.csv`) | SERVER | FN-M27-8.4.1, 9.4.1 | MD (columns `username`, `is_suspended` dropped: no owner field, DV-M27-19) |
| EL-S6-17 | Link "Import Pengguna" to `/admin/users/bulk-import` | SERVER (`users.blade.php:150-152`) | none | N (bulk import is the PENGURUSAN item "Import Pelajar", outside rows L51–L58, M02 admin screen S4; DV-M27-21) |
| EL-S6-18 | Server edit view `users-edit.blade.php`: title "Sunting {peranan}", fields "Nama pengguna", "Sekolah", "Kelas", teaching fields ("Mata pelajaran", "Pengalaman (tahun)", "Kelayakan"), checkboxes "Aktif" and "Digantung", card "Tetapkan semula kata laluan" with an amber button | SERVER | FN-M27-8.2.1, 8.2.2, 9.2.1 | N (no owner field for `username`, `kelas` text, `is_suspended` or teaching profile in M01 or M02, and the live M02 S3 form is the better evidence for the same record; S9 and S10 follow M02 S3, DV-M27-21) |
| EL-S6-19 | Banner "{n} akaun menunggu kelulusan — belum boleh log masuk." with "Lihat senarai" | SERVER | none | N (approval queue of imports and self-registrations; pupils created on S12 and teachers on S11 are active, DV-M27-21) |
| EL-S6-20 | Header text "{n} pengguna dijumpai" | SERVER | FN-M27-8.1.1, 9.1.1 | M |
| EL-S6-22 | Button "Menyamar" (`fa-user-secret`) with confirm "Log masuk sebagai {name}? Anda boleh kembali bila-bila masa.", disabled state with reason titles, `ImpersonateController::start/leave` (own school, non-staff, active, not nested, audit log), banner "Mod menyamar — anda melihat sebagai {name}" with "Kembali ke Admin" | SERVER (`users.blade.php`, `ImpersonateController.php`, `impersonation-banner.blade.php`) | FN-M27-8.5.1, 8.5.2 | MD (return to S6 or S7 instead of `/admin/users`; the "suspended" reason and `is_suspended` check dropped: no M01 field; session switch needs XR-M27-21; DV-M27-21) |
| EL-S6-21 | The server Panel users page lists pelajar, guru and fellow school admins (`SCHOOL_ROLES`, `Panel/UsersController.php:31,68`); `/admin/users` offers a role filter and the role column | SERVER | none | N (S6 and S7 are role-fixed by their labels; peers are not listed, DV-M27-21) |
| EL-S7-01 | Sidebar label "Senarai Guru" (HARIAN) | LIVE | FN-M27-2.2.3, 9.1.1 | M |
| EL-S7-02 | Route exists (302) | LIVE | FN-M27-2.1.2 | MD (DV-M27-01) |
| EL-S7-03 | Panduan "Daftar Guru": "Senarai Guru" then "Cipta Pengguna" | LIVE | FN-M27-9.1.1, 9.3.1 | M |
| EL-S7-04 | Panduan "Urus Guru": register, edit profile, activate or deactivate | LIVE | FN-M27-9.1.4, 9.2.1 | MD (conflict with server, DV-M27-10) |
| EL-S7-05 | M18 S9 "Senarai Guru" columns and empty copy | ANALOGUE | FN-M27-9.1.3 | MD (subject chips and "Kelayakan" not adopted: not in M02, DV-M27-17) |
| EL-S7-06 | M11 S3 teacher table ("Login Terakhir") | ANALOGUE | FN-M27-9.1.3 | M |
| EL-S7-07 | `importableRoles` of the bulk importer for a school admin = guru; school forced to own (`resolveSchoolId`) | SERVER | FN-M27-9.3.1, 9.3.2 | M (role guru on S11 follows Panduan "Cipta Pengguna"; school forcing follows `resolveSchoolId`) |
| EL-S7-08 | `canActivate` national admin only; imports land inactive | SERVER | FN-M27-9.1.4 | N (DV-M27-10) |
| EL-S7-09 | `SchoolPicker` locked label | SERVER | FN-M27-9.3.1 | M |
| EL-S7-10 | Deck sidebar items "Senarai Guru", "Cipta Pengguna" | SERVER-DECK | FN-M27-9.1.1 | MD ("Cipta Pengguna" kept as a button, DV-M27-14) |
| EL-S7-11 | "Eksport CSV" for the teachers of the school (same server export, role guru) | SERVER | FN-M27-9.4.1 | MD (DV-M27-19) |
| EL-S8-01 | Sidebar label "Kelas Sekolah" (HARIAN, last) | LIVE | FN-M27-2.2.3, 10.1.1 | M |
| EL-S8-02 | Route exists (302) | LIVE | FN-M27-2.1.2 | MD (DV-M27-01) |
| EL-S8-03 | Deck sidebar item "Kelas Sekolah" (door icon, first under PENGURUSAN) | SERVER-DECK | FN-M27-2.2.3 | N (live order wins, DV-M27-14) |
| EL-S8-04 | Deck S0 card "KELAS AKTIF" | SERVER-DECK | FN-M27-10.1.1, 2.4.1 | M |
| EL-S8-05 | M18 S9 "Prestasi Per Kelas" header, empty copy | ANALOGUE | FN-M27-10.1.1, 10.1.4 | M |
| EL-S8-06 | M10 S4 card fields (name, subject, level, join code, members) | ANALOGUE | FN-M27-10.1.2 | M |
| EL-S8-07 | M08 S3 "Kelas Sekolah" group, kind `school_class`, "Tiada Subjek", class link | ANALOGUE | FN-M27-10.1.2, 10.1.3, 10.2.1 | MD (`school_class` rows are not listed: no `schoolId`, DV-M27-20) |
| EL-S8-08 | Server `classrooms` columns joined to level, school, member counts | SERVER | FN-M27-10.1.2 | M |
| EL-S8-09 | Deck Prestasi page sub-line with a class total and a pupil total of one real school | SERVER-DECK | none | N (the figures are never copied; only the label pattern "{n} kelas" is used on S8) |
| EL-S8-10 | Create or edit class | none | none | N (no evidence; teachers create classes, Panduan) |
| EL-X-01 | Shell, sidebar of the live screenshot (Command Center, HARIAN, PENGURUSAN, PENILAIAN, ANALITIK) | LIVE | FN-M27-2.2.3 | M (shell-owned, XR-M27-11) |
| EL-X-02 | `/admin-sekolah/pilih-sekolah` (500) | LIVE | FN-M27-2.1.2, 2.1.3 | MD (DV-M27-01, not built) |
| EL-X-03 | Server defect: missing school treated as national | SERVER | FN-M27-2.1.3 | N (DV-M27-02) |
| EL-X-04 | Deck header pattern and avatar, logout | SERVER-DECK | FN-M27-2.2.1 | M (shell-owned) |
| EL-X-05 | Breadcrumb "← Papan Pemuka / Dashboard Sekolah" on the live S0 screenshot and deck S0; "Dashboard PPD / Statistik Penggunaan" on M18 S3; none on the deck Amaran page | LIVE (S0), SERVER-DECK, ANALOGUE | FN-M27-2.2.4 | MD (PROPOSED for S1–S3, S5–S8; S4 follows its deck page; DV-M27-22) |

Summary: **105 elements, 55 mapped, 29 mapped with a deviation, 21 not adopted with a stated reason, 0 unmapped** (v1.4: 93, 56, 20, 17; v1.5 added EL-S6-13…21, EL-S7-11, EL-X-05 and re-statused EL-S6-04, EL-S8-07; v1.6 adds EL-S6-22, adopted with adaptations, so it counts as mapped with a deviation). The three elements with provenance "none" (EL-S1-15, EL-S2-08, EL-S5-09) are the PROPOSED parts.

---

## 15. Fidelity deviations

D9 applies as in Part A. D24: live wins over deck, deck over server, server over analogue.

| ID | Discovery | Category | Live or source behaviour | Rebuild behaviour and alternatives | Status |
|---|---|---|---|---|---|
| DV-M27-08 | D-M27-02 | Broken (404) | The sidebar href `/admin-sekolah/laporan-aktiviti` answers 404 on live. The same label opens `/admin/laporan` for the platform admin. | The route is built (S3) and renders M17 S11 for the school. The server does serve a school admin exactly `/admin/laporan`, confined to the school (`LaporanController.php:17-26`), so pointing the sidebar there is a valid alternative; it is not chosen because the sidebar, the M17 alias precedent (`/admin-sekolah/command-center`, FR-M17-101) and the other M27 screens all live under `/admin-sekolah/*` in the user shell, while `/admin/laporan` is M17's admin-shell page (what it does for `school_admin` is M17's decision, XR-M27-15). Leaving the 404 is rejected (broken link). | Rule (D9) |
| DV-M27-09 | R10, discovery §1.1 | Broken (500, dead end) | The six routes `/statistik-penggunaan`, `/pelajar`, `/guru`, `/kelas`, `/dskp-heatmap`, `/laporan-bulanan` answer 302 then 500 for a user with no chosen school. | Built; a user without a school or with another role gets 403 (same as DV-M27-01). | Rule (D9) |
| DV-M27-10 | OQ-M27D-13 | Source conflict (live copy vs server) | Panduan: a school admin can "aktif/nyahaktif akaun guru". Server: only the national admin can activate (`canActivate`), school-admin imports land inactive. | Live copy wins on capability: the school admin switches teachers of the school (S7). Pupils stay read-only (Panduan names teachers only). The server rule that an inactive account cannot be edited or reset by the school admin is kept (S9, S10 refuse), so a deactivated teacher can be switched back but not edited. Alternatives: no activation (rejected: contradicts live copy); activation of pupils too (rejected: not named, new scope). | Approved by the brief (D24) |
| DV-M27-11 | OQ-M27D-05 | Server denies; analogue adapted | The server gives the PPD/JPN statistics page to officers only and refuses a school admin; live Panduan and sidebar show the item to the school admin. | Built for the school: "Sekolah" tile and the table "Mengikut Sekolah" dropped (one school), "Ketepatan" labelled "Purata Ketepatan", "Guru" kept. | Rule (live wins) |
| DV-M27-12 | OQ-M27D-07 | Two legends in live | Student SP map uses 75 and 50 (M08); the weak-topic heatmap of R10 uses 80 and 50 ("Mantap"). | S2 is labelled DSKP, so the M08 SP legend and bands are used. | Rule (D23 precedent, PROPOSED) |
| DV-M27-13 | OQ-M27D-09, 10 | One-school scope | M17 S11 is a platform page with a "Sekolah" tab, a school select, a "Sekolah" column, a card "Skor Purata" with chip "Struktur" (on live a platform display constant, DC-M17-06, 44.6% and 6.7% that no definition reproduces; the server does define "purata ketepatan sesi" for a school, `LaporanController.php:82-83`) and the sub-line "Penglibatan pengguna seluruh platform". | Tab, select, column, card, chip and the platform sub-line are not rendered on S3: the tab, select and column are meaningless for one school, the card and chip would show a live display constant of the platform (M17 FR-M17-111 precedent for DC-M17-03 and 05), and the sub-line says "platform". The server's school-scoped "purata ketepatan sesi" is not adopted because live's card is the constant. Every other element and copy is M17's. | Rule (precedent M17 FR-M17-106, 111) |
| DV-M27-14 | OQ-M27D-02 | Deck older than live | Deck sidebar: PENGURUSAN holds "Kelas Sekolah", "Senarai Pelajar", "Senarai Guru", "Statistik Penggunaan"; TINDAKAN holds "Cipta Pengguna", "Import Pelajar". | The live screenshot order wins (HARIAN, ANALITIK). "Cipta Pengguna" is kept as the button on S7 (Panduan path), "Import Pelajar" belongs to the PENGURUSAN item outside L51–L58. | Rule (live wins) |
| DV-M27-15 | OQ-M27D-04 | Deck older than live | The deck page has two buttons; live M18 S22 has "Keberkesanan Intervensi" first. | Three buttons (live wins). | Rule |
| DV-M27-16 | OQ-M27D-12 | Not adopted | The server school focus report has a headcount section. | S5 omits it: its definition by month is not evidenced. | PROPOSED |
| DV-M27-17 | OQ-M27D-14, 15 | Not adopted | Analogue columns "Subjek", "Kelayakan" (M18 S9, shown "-" on live), IC masking (M18 S9), delete, M02 admin "Login As" (M02 S1). | Not rendered on S6, S7: not in the M02 user record for this scope, or admin-only. The server's own "Menyamar" is adopted (DV-M27-21). | PROPOSED |
| DV-M27-18 | AUD-M27B-03 | Two live labels | M02 FR-M02-43 titles the amber password bar "Tukar Kata Laluan"; Panduan names the action "Reset Kata Laluan" (live FAQ); the server's own view says "Tetapkan semula kata laluan". | S9 and S10 use the Panduan name "Reset Kata Laluan" (the page the Panduan describes) over the M02 title; the sub-fields and hint are M02's. The M02 card "Nota Keselamatan" (FR-M02-44) is not rendered (admin security notes). | PROPOSED |
| DV-M27-19 | AUD-M27B-01 | SERVER capabilities adopted with adaptation | The server gives a school admin "Tambah Pelajar" (single pupil: name, school, class text, optional e-mail, optional password default, generated username, shown once) and "Eksport CSV" (columns including `username`, `is_suspended`). | Adopted as S12 and as the buttons on S6 and S7 (SERVER, D24). Adaptations, each minimal: the e-mail is required (the M01 sign-in key; the server allows none because pupils sign in with school plus username); no username is generated or shown and the credential block shows "Emel:" instead of "Nama pengguna:" (M01 users have no username); "Kelas" is a select of the school's `classroom` classes enrolled with source `school_admin` (M10 DATA-M10-02) instead of a free-text class; the default password is the M02 config default of the bulk import, never written in docs; the S12 password minimum stays the server's 8 while S9, S10 and S11 follow M02's 6 (M02 must accept the stricter rule for this entry point, XR-M27-17); the CSV drops the `username` and `is_suspended` columns (no owner field). Teacher "Cipta Pengguna" (S11) rests on Panduan, not on the server. | Approved (G1-3, G1-9, D26) |
| DV-M27-20 | AUD-M27B-02 | Owner premise | M08 S3 lists "Kelas Sekolah" rows (`school_class`); the server's school class list for a school admin does not exist. | S8 lists `classroom` rows whose `schoolId` is the school. `school_class` rows (419, 806) have `schoolId` null in M10 and M10 cannot create one, so no school would list them; they join when M10 gives them a school (XR-M27-20, non-blocking). | Approved (G1-6, D26; lead decision) |
| DV-M27-21 | AUD-M27B-01, R2-01 | Server extras not adopted; impersonation adopted | The server edit view has "Nama pengguna", "Kelas" text, teaching fields, "Digantung", "Sunting {peranan}"; `/admin/users` has "Import Pengguna", an approval banner and (in the Panel) lists fellow school admins. | Not rendered: no M01 or M02 owner field (username, class text, suspension, teaching profile), bulk import is the PENGURUSAN item outside L51–L58, there is no approval queue for rows created here, and S6 and S7 are role-fixed. S9 and S10 follow the live M02 S3 form. **Adopted instead (SERVER, D24): "Menyamar"** — the server lets a school admin impersonate an active own-school pupil or teacher (`ImpersonateController`, `users.blade.php`); it is specified as FN-M27-8.5.1, 8.5.2 with three adaptations: the return goes to S6 or S7 (the server goes to `/admin/users`), the "suspended" reason and check are dropped (no M01 suspension field), and the session switch with a return path is requested from M01 (XR-M27-21) because M02's admin "Login As" (#9) has no return path (M02 BR-07). | Approved (G1-8, D26) |
| DV-M27-22 | AUD-M27B-04 | Unknown, precedent used | The deck Amaran page has no breadcrumb; the live S0 screenshot, deck S0 and M18 S3 have one; S1–S3 and S5–S8 are unobserved. | A breadcrumb "← Dashboard Sekolah / {title}" on S1, S2, S3, S5, S6, S7, S8; none on S4 (its deck page) and none on the forms S9–S12. | Approved (G1-7, D26) |
| DV-M27-23 | Lead decision pretasiplus-app-3a, 2026-10-09 (FN-M27-6.2.1, OQ-M27-25, XR-M27-16) | Deferral (dependency out of prototype scope) | Live S4 shows the buttons "Keberkesanan Intervensi" (`/amaran/keberkesanan`) and "Ringkasan Eksekutif" (`/amaran/ringkasan-eksekutif?scope=school&school_id={id}`); both open M18 PPD/JPN pages. | The buttons are rendered exactly as FN-M27-6.2.1 (labels, icons, order, `href`). The two target pages are not built in prototype 1.0 (M18 PPD/JPN not built), so they are not followed or asserted: E2E tags those two links `@blocked-by M18`. This is a scope deferral, not a live defect; the pages join when M18 builds them. Not deferred: the CSV link `/amaran/export/school/{id}` (#30), which works because M18 data and endpoints #21, #22, #24, #30 are built by Session 8 as a public M18 export; S0 and S4 share one implementation (AC-M27-33.3). Alternatives rejected: hiding the two buttons (departs from live), pointing them elsewhere (invented target). L54 counts complete for its own scope. | Deferral (lead decision) |
| DV-M27-24 | SW6-01 (http-mode sweep, 2026-10-23) | Broken (layout, 768 and 1280) | S6 and S7 show all nine columns at 768 and 1280 in a ~696px (768) or ~952px (1280) card: the name is cut to about six characters, the row number overlaps the avatar, e-mails and dates break inside a word, and at 768 the table scrolls sideways with the last column cut. | Lower-priority columns drop out so each kept column is readable: below `xl` the table shows #, Nama, Emel, Aktif?, Tindakan; from `xl` also Tingkatan and Kelas (pupil) or Kelas (teacher); from `2xl` also Telefon (and Login Terakhir for the teacher). No field is removed, only moved: the value of every column hidden at a width shows as a small muted line under the name (`Tingkatan`, `Kelas`, `Telefon`, `Login Terakhir`, each exactly while its column is hidden). Tarikh never gets its own column (nine columns plus a 20-character name need ~1110px; the card is capped at ~1080px inside), so it is always that line. The 375 card list gains "Tarikh" too. Long names and e-mails end in an ellipsis with the full text as `title`. Alternatives: a horizontal scroll inside the card (clips the actions on touch), or a narrower name column (the six-character cut again). | Rule (D9, visual bug) |
| DV-M27-25 | SW7-04 (AM2, half-AM review), 2026-10-23 | Contradictory message (D9), new copy, http mode only | S1: with answers on the tiles and fewer than 5 active pupils, the real API (`K_COHORT` = 5, `usage.service.ts`) returns `tiles.accuracy: null`, and the footnote (FN-M27-3.2.2 / AC-M27-16.4) says "belum ada sesi latihan direkodkan" although sessions and answers are shown. S5: a month with answers but fewer than 5 answering pupils is left out of `months` (`monthly.service.ts`, `cards.accuracy: null`), so the table shows "Tiada aktiviti direkodkan buat masa ini" next to "{n} Sesi". Live never suppresses (observed data), so no live copy exists for either state. | In http mode only, when the API hides the figure (S1: `tiles.accuracy` null and `tiles.answers` > 0; S5: `cards.answers` > 0, `cards.accuracy` null and `months` empty), the footnote on S1 and the empty-state text on S5 read "Disembunyikan kerana kurang daripada 5 pelajar aktif." (new copy; the URS has no k-anonymity string). The genuine zero case keeps "belum ada sesi latihan direkodkan dalam skop ini" and "Tiada aktiviti direkodkan buat masa ini"; mock mode is unchanged (it replicates live and never suppresses). No contract field marks the suppression, so it is inferred from the figures. No layout change. Alternatives rejected: a new `suppressed` contract flag (backend change outside this fix), reusing the footnote sentence with the new reason appended (longer, repeats the dash explanation). | Fixed (D9) |
| DV-M27-26 | SW11-08, SW11-04 (SW11 sweep, AM2, 2026-10-24) | Raw or English error copy (D9); layout bug (D9, 768 and 1280) | S4 shows the raw message of a failed load next to "Cuba Semula": "Internal server error" (500), "Failed to fetch" (network), "HTTP 503" (an HTML 503), an API 422 text. The pupil table (eight columns) sits behind an inner scroll at 768 and 1280, hiding "Penglibatan" and "Penguasaan", and "Tingkatan / Kelas" does not wrap. | The load error follows the M18 rule (DV-M18-52, `loadErrorMessage` in `amaran-format.ts`): status 0, 5xx, 400 and 422 show "Ralat berlaku. Sila cuba lagi.", a 429 "Terlalu banyak percubaan. Cuba sebentar lagi."; another status (404, 409) keeps the server message unless it is empty or "HTTP {status}", so a business message may still be English (accepted); no new copy. The pupil table uses `layout="fixed"` and `density="tight"` with a width per column (the SW6-01 / DV-M27-24 pattern): nothing scrolls inside, cells wrap. The card is ~696px at 768 and ~952px at 1280 and the eight columns need ~740px plus a readable name, so "Ketepatan", "Penglibatan" and "Penguasaan" are columns from `xl` only; below it their values show as a small muted line under the name, each phrase alone as the API gives it ("Purata ketepatan: 64%", "Terakhir aktif: 2026-02-27", "Purata tahap: L1", "Tiada aktiviti"; the phrases describe themselves and the column header is hidden at that width, so no prefix is added); the hidden columns stay in the DOM, no field is dropped. Below `md` the cards are unchanged. Not fixed here (needs a DS change, half AZ): the third level pill "Tingkatan 5" is clipped at 375 and the four tiles sit 3 + 1 at 768 (SW11-14). | Fixed (D9) |
| DV-M27-27 | SWE (http mode; SWE-01, SWE-02) | Wrong language | The screens showed the server's own `message` for a failure that has no module message: the API's generic English defaults (500 "Server Error", 404 "Not Found.", 403 "This action is unauthorized.", 401 "Unauthenticated.", 409 "Conflict.", 422/400 "The given data was invalid.", 413 "Payload Too Large."), the transport text `HTTP <status>` or the fetch text of a lost connection ("Failed to fetch"), so English or raw text appeared in the BM UI. Rule: SWE (http mode): generic English server or transport text replaced with the module's BM copy; module BM messages kept. | The six read screens (S0, S1, S5, S6, S7a, S8: `KelasSekolahPage`, `LaporanAktivitiPage`, `StatistikPenggunaanPage`, `SchoolDashboardPage`, `DskpHeatmapPage`, `LaporanBulananPage`) no longer pass the server message to the load-error box, so it shows the shared BM line ("Tidak dapat memuatkan data. Sila cuba semula."); S4 `AmaranSekolahPage` keeps its status-based BM line (`loadErrorMessage`, DV-M27-26); the 403 handling (global 403 page) is unchanged. The user screens' `errorLines` return the generic BM line ("Ralat berlaku. Sila cuba lagi.") for a 5xx and for the generic English defaults; field texts and BM messages of the M27 services show as before. Same logic in mock mode; tests that sent a 500 with a BM text now expect the BM line. | Applied (D9) |
| DV-M27-28 | G5-M27 B1, B2, B4, B7 (PR #336, 2026-10-25) | Visual bugs (D9, layout and readability at 375 and 1280) | B1: the 375 cards of S4, S6 and S7 cut values with an ellipsis and put the row actions beside the fields, so a long e-mail, class list or status was unreadable. B2: after a failed submit the alert on S9, S10, S11 and S12 was scrolled to the top edge, under the page header. B4: the grade chart on S1 drew only some of its ten grade labels at 375. B7: the S6 pupil table did not fit the ~933px scroller at 1280 and broke "Tingkatan 5" and the Kelas cell over several lines. | B1: the three lists use one card body (`MobileCard`): the name as the title (#351: a `ULink` button with a `DsText` label, flush with the fields; it now uses the default text colour rgb(58,66,88) instead of the muted rgb(95,106,132) and has no hover colour, the same as the default `DsDataTable` card title), the label/value fields in two columns with long values wrapping, and the row actions in a row below the fields. B2: the alert scrolls into the middle of the viewport (`block: 'center'`). B4: the grade chart uses the tall plot height (`height="lg"`) so all ten labels show. B7: the pupil columns take their own widths (`PUPIL_WIDTHS`): from `xl` the `#` column 40px, Emel 160px, Tingkatan 128px and Kelas 144px, so the table fits 933px; the separate `PUPIL_WIDTHS` also narrow the Nama column from `xl` up (192px for the pupil, where the shared widths gave 256px; the teacher keeps its own widths), and below `xl` the widths are unchanged. No field, label or copy changes. B6 (a second DSKP legend on S7a) is not fixed: it needs a DS prop. Alternatives: a horizontal scroll inside the table (clips the actions on touch) or hiding more columns (DV-M27-24 already moved the minimum). | Applied (D9) |

---

## 16. Out of scope ("not in this version")

| Item | Reason |
|---|---|
| Sidebar items "Urus Pengguna", "Import Pelajar", "Aktiviti Guru", "Langganan", "Invois" and the routes `/admin-sekolah/pengguna`, `/import-pelajar`, `/aktiviti-guru`, `/langganan`, `/invois` | Not in rows L51–L58 (not Release 1.0 rows); their hrefs stay 404 until built. |
| Delete, bulk actions, role change, school change, the M02 admin "Login As" on S6, S7 | Delete and role change are not offered to a school admin on the server's `/admin/users` (`canChangeRole` is national-admin only). The server's "Menyamar" (impersonate an own-school pupil or teacher) IS offered and is adopted (FN-M27-8.5.1, 8.5.2, G1-8). |
| Bulk import ("Import Pengguna", "Import Pelajar") | Separate admin screens (M02 S4, S5) and the PENGURUSAN item "Import Pelajar", outside rows L51–L58 (DV-M27-21). |
| The approval queue banner and the national approval of imports | No import here; pupils (S12) and teachers (S11) are created active. |
| Server edit-view extras: username, class text, suspension, teaching profile | No owner field (DV-M27-21). |
| IC number display or edit | Personal data; no evidence for the school admin. |
| Pupil activation or deactivation | Not named in Panduan; server national-admin only (DV-M27-10). |
| Creating or editing classes | No evidence; teachers create classes (Panduan). |
| Exports of S1, S2, S3, S5 (CSV, PDF files) | Not evidenced. In scope: the S4 CSV (M18), the S5 print and the "Eksport CSV" of S6 and S7 (SERVER). |
| `/admin-sekolah/pilih-sekolah` | Not built (DL-1). |
| The M18 pages behind the S4 buttons, M08 S5, M17 S11 internals | Owned by M18, M08, M17. `/amaran/keberkesanan` and `/amaran/ringkasan-eksekutif` are deferred for prototype 1.0 (DV-M27-23). |

---

## 17. Open questions

None blocks G1. "Build order" marks a dependency on another module, not a missing decision.

| ID | Question | Blocks | Default used |
|---|---|---|---|
| OQ-M27-15 | S1: the tile set (seven tiles) is composed from Panduan, the server strip and the deck labels; the live layout is unseen. | Nothing | FN-M27-3.1.3 |
| OQ-M27-16 | S2: axes (SP tiles by Bidang), unit (pooled percentage), levels (T4, T5), no "all subjects" option. | Nothing | FN-M27-4.x |
| OQ-M27-17 | S3: does `/admin/laporan` also open for a school admin (server: yes)? Default: S3 is the school admin's page; the M17 route for `school_admin` is for M17 to decide (XR-M27-15). | Nothing | alias route only |
| OQ-M27-18 | S4: sidebar target `/amaran/sekolah` (deck URL) instead of `/amaran` (class gateway used by the shell today). | Nothing | `/amaran/sekolah` |
| OQ-M27-19 | S5: is "Laporan Bulanan" a distinct report or a month filter of "Ringkasan Eksekutif"? Default: distinct month report (M17 S9 cards, M18 S9 table). | Nothing | FN-M27-7.x |
| OQ-M27-20 | S6, S7: columns beyond M02 S1 ("Tingkatan", "Kelas", "Kelas" count, "Login Terakhir"); no IC. (The server's "Eksport CSV" and "Tambah Pelajar" are adopted, DV-M27-19.) | Nothing | FN-M27-8.1.3, 9.1.3 |
| OQ-M27-21 | S11 and S12: an account created by the school admin is active at once (server: only imports wait for national approval; the server creates pupils active). Listed in §17.1. | Nothing | FN-M27-9.3.2, 8.3.2 |
| OQ-M27-22 | S9, S10 deliver the Panduan flow "click the name, then Reset Kata Laluan" as a page, not a modal; the reset takes a typed password (M02 S3 pattern), not a generated one. | Nothing | FN-M27-8.2.2 |
| OQ-M27-23 | S2: the aggregation rule (pooled correct over answered per SP over the school's pupils). | Nothing | BR-M27-23 |
| OQ-M27-24 | S8: `classroom` rows only (`school_class` rows have no `schoolId`, XR-M27-20); columns; link to M08 S5 for a class of the school (needs M08 to admit the school admin). | Nothing | FN-M27-10.x |
| OQ-M27-25 | Build order: S4 and the S4-related ACs wait for the M18 build (`Q-M18-RISK(schoolId)`, S22 data); S2 needs the M08 school aggregate of SpRecord (XR-M27-13). **Update 2026-10-09:** M18 risk read model and #21, #22, #24, #30 are provided by Session 8 (public M18 export); the M18 pages `/amaran/keberkesanan` and `/amaran/ringkasan-eksekutif` are out of prototype 1.0 scope (DV-M27-23): S4 renders their buttons (FN-M27-6.2.1), E2E tags those two links `@blocked-by M18`. | Build of S2 only (S4 no longer waits, except the two deferred links) | tagged `@blocked-by` |

### 17.1 G1 confirmation list (policy decisions and PROPOSED screens the user confirmed)

These items changed an access-control policy or rest on no evidence beyond the label, so the user was asked to confirm them at G1 (as Part A §0.2 does for S0). None blocked the audit or the build order.

**Outcome (2026-10-09, user decision D26, "setuju semua"):** all nine items are approved as proposed. Each item below carries the status "Approved (D26)"; the "Default used" column is now the approved decision.

| # | Item | Default used (approved) | Basis | Status |
|---|---|---|---|---|
| G1-1 | **Teacher activation (DV-M27-10):** a school admin switches teachers of the own school on and off. Server: only the national admin can (`canActivate`). | School admin can (Panduan: "aktif/nyahaktif akaun guru"); pupils read-only | LIVE Panduan over SERVER | Approved (D26) |
| G1-2 | **Accounts created by a school admin are active at once (OQ-M27-21):** teacher on S11, pupil on S12. Server: pupils created by the form are active; only bulk imports wait for national approval; teacher creation by a school admin is Panduan-only. | active | SERVER (pupil), Panduan (teacher) | Approved (D26) |
| G1-3 | **S12 "Tambah Pelajar" and "Eksport CSV" adopted from the server with adaptations (DV-M27-19):** e-mail required, no username, class chosen from the school's classes, CSV columns without `username` and `is_suspended`. | adopted | SERVER, D24 | Approved (D26) |
| G1-4 | **S2 DSKP Heatmap is PROPOSED** (label only on live): SP tiles per Bidang, pooled accuracy, T4 and T5. Demo data exists for school 900001 only. | as FN-M27-4.x | D23 precedent | Approved (D26) |
| G1-5 | **S5 Laporan Bulanan is PROPOSED:** month report from M17 S9 and M18 S9 parts. | as FN-M27-7.x | D23 precedent | Approved (D26) |
| G1-6 | **S8 Kelas Sekolah is PROPOSED** and lists `classroom` rows only (DV-M27-20). | as FN-M27-10.x | D23 precedent, lead decision | Approved (D26) |
| G1-7 | **Breadcrumb on S1–S3, S5–S8 (DV-M27-22)**, S4 without. | as FN-M27-2.2.4 | S0 precedent | Approved (D26) |
| G1-8 | **"Menyamar" (impersonation) adopted for a school admin:** log in as an active own-school pupil or teacher, with a visible banner, a way back and an audit log (FN-M27-8.5.x, DV-M27-21, SEC-M27-11, 12). A privileged capability: the user may instead drop it. | adopted | SERVER, D24 | Approved (D26) |
| G1-9 | **S12 password minimum 8** (server) while S9–S11 use M02's 6 (DV-M27-19, XR-M27-17). | 8 on S12 | SERVER | Approved (D26) |

**Questions for Session 8 (S0 owner).** Session 8 allowed two edits in Part A: the document title, and rows that only state the link-target status of S1+ screens. QS8-01 and QS8-02 are therefore done (SRS §2.1 row, URS §8 row, titles); QS8-03 to 05 stay open.

| ID | Question |
|---|---|
| QS8-01 | Done in v1.5 (S0 SRS §2.1 row and URS §8 row now point to Part B). |
| QS8-02 | Done in v1.5 (the pointer is in the URS §8 row). |
| QS8-03 | Part B counts "Kelas Aktif" on S8 with the S0 call (`classrooms.list({isActive: true, schoolId})`) restricted to `kind: 'classroom'`; S0's call has no kind filter. The two agree while no `school_class` row carries a `schoolId` (true today, DV-M27-20). If M10 gives `school_class` rows a school (XR-M27-20), S0 and S8 must be aligned: please tell Session 2 which side changes. |
| QS8-04 | AC-M27-33.3 asserts the S0 panel "AMARAN AWAL" equals the S4 tiles; if the S0 panel changes its source, update both. |
| QS8-05 | Part B reuses the 403 and 404 pages of S0 §8.3 by reference; please keep those texts stable. |
