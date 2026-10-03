# M27 — School Admin Portal, screen S0 "Dashboard Sekolah" (`/admin-sekolah`) — User Requirements Specification

## 0. Document control

| Field | Value |
|---|---|
| Document | URS — M27 School Admin Portal, S0 Dashboard Sekolah (roles-matrix row L07, Admin Sekolah part) |
| Version | 1.4 (S0 content = v1.3; S1–S11 added in §10–§17) |
| Date | 2026-10-03 |
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
| Other M27 screens (INFERRED hrefs under `/admin-sekolah/`): Senarai Pelajar (`pelajar`), Senarai Guru (`guru`), Kelas Sekolah (`kelas`), Urus Pengguna (`pengguna`), Import Pelajar (`import-pelajar`), Aktiviti Guru (`aktiviti-guru`), Langganan (`langganan`), Invois (`invois`), Laporan Bulanan (`laporan-bulanan`), Statistik Penggunaan (`statistik-penggunaan`), DSKP Heatmap (`dskp-heatmap`), Laporan Aktiviti (`laporan-aktiviti`) | Contents unrevealed; hrefs INFERRED, several 404 on live (M27 discovery §1.2). |
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

Added in v1.4 by Session 2 under user decision D24. Part A (§0–§9) is S0, owned by Session 8, and is not changed. Ids continue after Part A: US-M27-12…, FN-M27-2.x.y…, DV-M27-08…, OQ-M27-15…. Shared rules of Part A that these screens reuse by reference: FN-M27-1.2.1–1.2.5 (access and scope), FN-M27-1.7.1–1.7.4 (layout, 12 px, privacy, loading), DL-1 (no picker, 403), DL-6 (user shell), DV-M27-01, DV-M27-02, DV-M27-03.

## 10. Overview of S1–S11

### 10.0 Status, evidence rule and tags

**Status:** Draft v1.4, ready for audit then G1. Not yet audited. The S0 status line in §0 is unchanged.

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
| S6 | L56 | `/admin-sekolah/pelajar` | Senarai Pelajar | school name | Senarai Pelajar - PRESTASIPLUS (P) | user | HARIAN "Senarai Pelajar" | label LIVE; Panduan LIVE; table ANALOGUE (M02 S1) + SERVER rules |
| S7 | L57 | `/admin-sekolah/guru` | Senarai Guru | school name | Senarai Guru - PRESTASIPLUS (P) | user | HARIAN "Senarai Guru" | label LIVE; Panduan LIVE; table ANALOGUE (M02 S1, M18 S9, M11 S3) + SERVER rules |
| S8 | L58 | `/admin-sekolah/kelas` | Kelas Sekolah | school name | Kelas Sekolah - PRESTASIPLUS (P) | user | HARIAN "Kelas Sekolah" | label LIVE; deck sidebar; content PROPOSED over ANALOGUE (M18 S9, M10 S4, M08 S3) |
| S9 | L56 | `/admin-sekolah/pelajar/{id}` | Edit Pengguna | "Kemaskini maklumat pengguna" | Edit Pengguna - PRESTASIPLUS (P) | user | HARIAN "Senarai Pelajar" (active) | Panduan LIVE ("klik nama pengguna ... Reset Kata Laluan") + ANALOGUE (M02 S3) + SERVER rules |
| S10 | L57 | `/admin-sekolah/guru/{id}` | Edit Pengguna | "Kemaskini maklumat pengguna" | Edit Pengguna - PRESTASIPLUS (P) | user | HARIAN "Senarai Guru" (active) | as S9 |
| S11 | L57 | `/admin-sekolah/guru/baru` | Cipta Pengguna | "Daftarkan akaun guru ke sekolah anda" (P) | Cipta Pengguna - PRESTASIPLUS (P) | user | HARIAN "Senarai Guru" (active) | Panduan LIVE ("Senarai Guru" then "Cipta Pengguna") + ANALOGUE (M02 S2) + SERVER (`importableRoles`) |

S9 to S11 carry the M02 S3 and S2 header copy ("Edit Pengguna" / "Kemaskini maklumat pengguna"), because the school admin edits the same record shape. Their sub-line differs from the pattern "school name" on purpose: the pattern would repeat the school name already visible in the locked school label of the form.

### 10.2 Provenance summary per screen

| Screen | LIVE | SERVER-DECK | SERVER | ANALOGUE / OWNER | PROPOSED |
|---|---|---|---|---|---|
| S1 | sidebar label and position; route exists; Panduan card sentence | header pattern (title, school sub-line) | `SchoolAggregates` formulas, "Mengikut Mod Latihan", footnote, summary strip labels | M18 S3 period pills, empty-state copy; M17 S3 sub-line "daripada {n}"; M05 S9 session labels | tab title; tile set and order; no export |
| S2 | sidebar label and position; route exists | none | student heatmap grouping and `dskp` bands (adjacent, student level) | M08 FR-M08-52 legend, caption, colours; M08 SpRecord; M10 DSKP repo; R10 cell copy "{n} cuba · {p}% betul" | whole screen composition, level pills T4/T5, subject select, aggregation, rounding |
| S3 | sidebar label and position; inferred href 404 (D9 fix) | none | school-confined report rules; "no platform wording" precedent | M17 S11 (all copy), M17 FR-M17-111 precedent | alias route, h1 and sub-line, hidden "Sekolah" tab and constants-only items |
| S4 | sidebar label and position | full page: header, pills, tiles, distribution, buttons, subject analysis; URL `/amaran/sekolah` | (teacher risk rule rejected) | M18 S22/S23/S21/#30 (live copy: "Keberkesanan Intervensi" button) | none beyond route binding |
| S5 | sidebar label and position; route exists | none | school-scoped focus report (`LaporanEksekutifController`): monthly activity, strongest and weakest subject | M17 S9 cards and footer, M17 S8 navigation, M18 S9 "Statistik Bulanan", M18 S23 "Cetak / PDF" | composition, month navigation, print |
| S6 | sidebar label and position; Panduan sentences (import, edit, reset) | sidebar item "Senarai Pelajar" (older order) | `UserDirectory` filters and order, `StaffScope` rules | M02 S1 table, filters, empty copy, paginator; M02 S3 form; M10 enrolments | columns "Tingkatan" and "Kelas", read-only status for pupils, no IC |
| S7 | sidebar label and position; Panduan ("Cipta Pengguna", "aktif/nyahaktif akaun guru") | sidebar item and "Cipta Pengguna" item (older) | `StaffScope` (`importableRoles`, `canManageAccount`, `canActivate`) | M02 S1, S2, S3; M18 S9 and M11 S3 teacher tables | columns "Kelas" and "Login Terakhir", activation capability for school admin, create-active default |
| S8 | sidebar label and position | sidebar item "Kelas Sekolah" (door icon), "KELAS AKTIF" card | `classrooms` columns (adjacent, teacher page) | M18 S9 "Prestasi Per Kelas" copy and empty copy; M10 S4 card fields; M08 S3 "Kelas Sekolah" kind | whole table, kinds, filters, link to M08 S5 |

### 10.3 Fixtures (existing records, shared with S0 §1.4; nothing is added)

| Persona | Record | Used for |
|---|---|---|
| P1 | school admin 3102 `azlan@demo.test`, school 900003 | every screen, banner, foreign-id tests |
| P2 | school admin 8 `adminsekolah@demo.test`, school 900001 (M10 anchors: classes 2001 and 2002, teacher 5 `guru@demo.test`) | S8 and S7 populated rows |
| P3 | school admin 3104 `suhaimi@demo.test`, school 900002 (no PPD, no code) | locked school label without optional parts |
| P4 | the populated school chosen at S0 build (8090 by default) and its generated school admin | S1, S2, S3, S5, S6 with real activity |
| P5 | refused roles: 1 `admin@demo.test`, 5 `guru@demo.test`, 2 `pelajar@demo.test`; a `school_admin` with no school (S0 §6.4 hook) | access tests |

No figure is pinned in this document: every value is compared with the owner's own query for the same school (oracle). No real person's name, e-mail or IC is used; the persons above are the existing fictitious fixtures.

---

## 11. Functional breakdown (Epic, Feature, Function)

Source column: L = LIVE, D = SERVER-DECK, S = SERVER, A = ANALOGUE, O = OWNER, P = PROPOSED.

### EP-M27-2 — Rules common to S1–S11

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
| FN-M27-2.2.1 | Header title = the screen title of §10.1; sub-line = the school name (M02 `name`), except S9 to S11. | D (deck pages: "Amaran Awal — Sekolah" / school, "Dashboard Sekolah" / school) |
| FN-M27-2.2.2 | Tab title "{title} - PRESTASIPLUS" (S4: M18's "Amaran Awal — Sekolah \| PRESTASIPLUS"). | P (S0 FR-M27-03 precedent); O (M18) |
| FN-M27-2.2.3 | All screens render in the user shell; the sidebar item of the screen is active on its route and sub-routes (S9 keeps "Senarai Pelajar", S10 and S11 keep "Senarai Guru", S4 keeps "Amaran Awal"). | L (sidebar of the screenshot); P (sub-route rule) |
| FN-M27-2.2.4 | The screens S1–S8 show no breadcrumb; S9 to S11 show the M02 footer action "Batal" with the back arrow to their list. | D (deck pages have none); A (M02 S2/S3 footer) |

**FT-M27-2.3 — Quality**

| FN | Function | Source |
|---|---|---|
| FN-M27-2.3.1 | No horizontal page scroll at 375 / 768 / 1280 px; wide tables scroll inside their own card. | R (CLAUDE.md §7; M02 FR-M02-07 pattern) |
| FN-M27-2.3.2 | Text at least 12 px. | R (DV-M27-03) |
| FN-M27-2.3.3 | No real person's name, no IC number, no password appears in docs, seeds or pages; e-mail and phone are shown only for users of the viewer's school. | R (CLAUDE.md §6); S (`UserDirectory` scope) |
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
| FN-M27-3.1.4 | Definitions: Pelajar and Guru = users of the school by role (all, active or not); Pelajar Aktif = pupils with at least one answer in the period; Penglibatan = round(aktif ÷ pelajar × 100), 0 when no pupils; Sesi Latihan = completed sessions in the period; Soalan Dijawab = answers in the period; Purata Ketepatan = mean of the sessions' accuracy, one decimal, "—" without a session. | S (`SchoolAggregates`); O (M05 queries) |

**FT-M27-3.2 — Breakdown, empty states, export**

| FN | Function | Source |
|---|---|---|
| FN-M27-3.2.1 | Card "Mengikut Mod Latihan": table "Mod", "Sesi", "Ketepatan Purata", one row per session label of M05 S9 ("Latihan", "Bab", "Ulang Kaji", "Tracking A", "PKSK") that has sessions in the period, ordered by sessions descending. | S (mode split); O (M05 S9 labels) |
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
| FN-M27-4.2.1 | Filter card (GET form, submits on change): select "Subjek" (subjects that have SPs; default the first by name; no "all" option) and level pills "Tingkatan 4" (default, `?tingkatan=T4`) and "Tingkatan 5" (`T5`). | P (M08 S8 submit-on-change pattern; M18 pill copy; D10 level limit) |
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
| FN-M27-6.1.2 | Header "Amaran Awal — Sekolah" with the school name as sub-line; level pills "Semua Tingkatan" (active), "Tingkatan 4", "Tingkatan 5" (`?tingkatan=T4\|T5`; with a level only pupils in classes of that level count). | D; A (M18 FN-M18-4.6.1) |
| FN-M27-6.1.3 | Tiles "Jumlah Pelajar", "On Track", "Perlu Perhatian", "Berisiko Tinggi"; card "Taburan Risiko Seluruh Sekolah" with the stacked bar (integer % per segment) and "Hijau: {n}", "Kuning: {n}", "Merah: {n}". | D; A (M18 FN-M18-4.6.2/4.6.3) |
| FN-M27-6.1.4 | Card "Analisis Risiko Mengikut Subjek" (rows "{Subjek}" and "{w}/{m} pelajar lemah ({p}%)") when the school has data, and card "Senarai Pelajar Berisiko" ("Disusun mengikut skor risiko tertinggi"; columns "#", "Pelajar", "Tingkatan / Kelas", "Skor", "Status", "Ketepatan", "Penglibatan", "Penguasaan"). | D (subject card); A (M18 FN-M18-4.6.5/4.6.6) |

**FT-M27-6.2 — Buttons, scope**

| FN | Function | Source |
|---|---|---|
| FN-M27-6.2.1 | Buttons "Keberkesanan Intervensi" (to `/amaran/keberkesanan`), "Ringkasan Eksekutif" (to `/amaran/ringkasan-eksekutif?scope=school&school_id={own}`) and "Muat Turun CSV" (to `/amaran/export/school/{own}`), in that order. The deck shows the last two only; live M18 shows the first as well, live wins. | D; L/A (M18 FN-M18-4.6.4) |
| FN-M27-6.2.2 | A foreign school id or class id on M18's own routes follows M18's rule for a school admin (403, M18 FR-M18-09); S4 itself takes no id. | O (M18) |
| FN-M27-6.2.3 | A school without pupils shows the tiles "0", the bar without segments and no list rows. | P (zeros, no invented copy) |

### EP-M27-7 — S5 Laporan Bulanan

**FT-M27-7.1 — Month report**

| FN | Function | Source |
|---|---|---|
| FN-M27-7.1.1 | Route `/admin-sekolah/laporan-bulanan`, title "Laporan Bulanan", sub-line school name; month heading "Laporan {Bulan} {yyyy}" (BM month names); links "← {Bulan} {yyyy}" (previous) and "{Bulan} {yyyy} →" (next, only while the shown month is before the current month); query `?bulan=YYYY-MM`, invalid or future value gives the current month. | L (label); A (M17 S8 year navigation, DV-M17-14); P |
| FN-M27-7.1.2 | KPI cards of the month: "Penglibatan" ("{p}%", "{n} aktif / {n} daftar"), "Soalan Dijawab" ("{n}", "{x} soalan/pelajar"), "Ketepatan" ("{p}%", "—" when no answer), "Sesi Latihan" ("{n}"). | A (M17 FN-M17-6.4.2 copy); P (set) |
| FN-M27-7.1.3 | A month without answers: the KPI values "0%", "0", "—", "0"; the sections below are omitted. | A (M17 FN-M17-6.3.11 rule); P |

**FT-M27-7.2 — Sections and print**

| FN | Function | Source |
|---|---|---|
| FN-M27-7.2.1 | Card "Statistik Bulanan" with the subtitle "12 bulan terakhir — pecahan prestasi mengikut bulan": table "Bulan", "Soalan Dijawab", "Soalan Betul", "Pelajar Aktif", "Purata/Pelajar", "Accuracy", one row per month with sessions in the 12 months ending with the shown month, footer row "Jumlah" when more than one row; empty "Tiada data" / "Tiada aktiviti direkodkan buat masa ini". | A (M18 FN-M18-2.9.6, live copy) |
| FN-M27-7.2.2 | Card "Prestasi Mengikut Subjek" for the shown month: "SUBJEK TERKUAT" and "SUBJEK PERLU PERHATIAN" boxes ("{subjek}", "{p}% ({n} soalan)") and one row per subject ("{subjek}", "{p}% · {n} soalan · {n} pelajar"). | A (M17 FN-M17-6.4.4, 6.3.5); S (`LaporanEksekutifController` strongest/weakest) |
| FN-M27-7.2.3 | Footer "Laporan dijana: {d MMM yyyy, hh:mm AM\|PM} · PrestasiPlus" (request minute, MYT) and a button "Cetak / PDF" that calls `window.print()`. | A (M17 FN-M17-6.4.6; M18 FN-M18-4.7) |

### EP-M27-8 — S6 Senarai Pelajar, S9 Edit Pelajar

**FT-M27-8.1 — List**

| FN | Function | Source |
|---|---|---|
| FN-M27-8.1.1 | Route `/admin-sekolah/pelajar`, title "Senarai Pelajar", sub-line school name; three count cards "Pelajar" (all pupils of the school), "Aktif", "Tidak Aktif" (unaffected by the filters). | L (label, Panduan "pantau senarai seluruh sekolah"); A (M02 FR-M02-02); S (`roleStats`) |
| FN-M27-8.1.2 | Filter card (GET): "Status" ("Semua", "Aktif", "Tidak Aktif"; `?is_active=`), "Cari" (`?search=`, placeholder "Nama atau emel..."), submit "Cari". No role, school or class control. | A (M02 FR-M02-03); S (`UserDirectory`) |
| FN-M27-8.1.3 | Table "#", "Nama" (initials avatar, name as a link to S9 for an active pupil), "Emel", "Telefon" (or "-"), "Tingkatan" ("Tingkatan n" / "Darjah n" / "-"), "Kelas" (names of the active classes, "-" when none), "Aktif?" (read-only badge "Aktif" / "Tidak"), "Tarikh" (`dd/mm/yyyy`), "Tindakan" ("Edit" for an active pupil). | A (M02 FR-M02-06); P ("Tingkatan", "Kelas", read-only badge) |
| FN-M27-8.1.4 | Order: active first, then newest id first; 25 per page. | S (`UserDirectory::paginate`); A (M02) |
| FN-M27-8.1.5 | No row: "Tiada pengguna dijumpai" / "Cuba ubah kriteria carian anda". | A (M02 FR-M02-19) |
| FN-M27-8.1.6 | No "Import Pelajar", "Tambah" or delete control on S6. | P (targets not built or admin-only) |

**FT-M27-8.3 — Edit pupil (S9)**

| FN | Function | Source |
|---|---|---|
| FN-M27-8.3.1 | Route `/admin-sekolah/pelajar/{id}`: profile card (avatar, name, e-mail, "Daftar: {dd/mm/yyyy}", "Kemaskini: {dd/mm/yyyy HH:mm}"), form "Nama *", "Emel *", "No. Telefon (Pilihan)", read-only line "Status" ("Aktif"), footer "Batal" (to S6) and "Kemaskini". No role, school, grade or IC field. | A (M02 FR-M02-37…44); P (subset, no IC) |
| FN-M27-8.3.2 | Amber bar "Reset Kata Laluan" ("Klik untuk buka bahagian reset kata laluan") toggles "Kata Laluan Baru" ("Minimum 6 aksara"), "Sahkan Kata Laluan Baru" ("Taip semula kata laluan baru") and the hint "Kosongkan jika tidak mahu tukar kata laluan. Kata laluan baru akan berkuat kuasa serta-merta." | L (Panduan: "Reset Kata Laluan"); A (M02 FR-M02-43) |
| FN-M27-8.3.3 | An inactive pupil cannot be edited or reset by the school admin: no "Edit" link and S9 answers 403. | S (`canManageAccount`, decision of 22 Sep) |
| FN-M27-8.3.4 | Save: success returns to S6 with "Pengguna berjaya dikemaskini."; validation as M02 S3. | A (M02 FR-M02-46, UNVERIFIED COPY) |

### EP-M27-9 — S7 Senarai Guru, S10 Edit Guru, S11 Cipta Pengguna

**FT-M27-9.1 — List**

| FN | Function | Source |
|---|---|---|
| FN-M27-9.1.1 | Route `/admin-sekolah/guru`, title "Senarai Guru", sub-line school name; count cards "Guru", "Aktif", "Tidak Aktif"; button "Cipta Pengguna" (to S11). | L (label; Panduan "Senarai Guru" then "Cipta Pengguna"); A (M02) |
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

### EP-M27-10 — S8 Kelas Sekolah

**FT-M27-10.1 — List**

| FN | Function | Source |
|---|---|---|
| FN-M27-10.1.1 | Route `/admin-sekolah/kelas`, title "Kelas Sekolah", sub-line school name; tile "Kelas Aktif" (the S0 count) and the line "{n} kelas dipaparkan". | L (label); D (card "KELAS AKTIF"); A (M18 FN-M18-2.9.10) |
| FN-M27-10.1.2 | Table "#", "Kelas", "Subjek" ("Tiada Subjek" when none), "Tingkatan" ("Tingkatan n" / "Darjah n"), "Guru" (name or "—"), "Murid" (active members), "Kod Kelas" (or "—"); an inactive class carries the badge "Tidak Aktif". | A (M18 S9, M10 S4, M08 S3); P (set) |
| FN-M27-10.1.3 | Both record kinds of M10 for the school are listed: teacher classes (`classroom`) and school classes (`school_class`, Guru "—", no code). | P (OQ-M27-24) |
| FN-M27-10.1.4 | Filters: "Tingkatan / Darjah" ("Semua" and the levels the school has) and "Cari" ("Cari kelas..."); order by class name A to Z; 25 per page; empty "Tiada kelas dijumpai" / "Sila cipta kelas terlebih dahulu". | A (M18 FN-M18-2.9.3, 2.9.10); P |
| FN-M27-10.2.1 | The class name of a `classroom` row links to M08 S5 `/prestasi/kelas/{id}`; a `school_class` row is plain text. | A (M08 S3); XR-M27-13 |

Total new Functions: **73** (FN-M27-2.1.1 … 10.2.1).

---

## 12. User stories and acceptance criteria

Values use the project clock 2026-09-25T15:40:00+08:00, the fixtures of §10.3 and the oracle rule (the page equals the owner's own query for the same school). E2E runs at 375x812, 768x1024 and 1280x800. MoSCoW as in Part A.

| ID | Feature | MoSCoW | Story | Functions |
|---|---|---|---|---|
| US-M27-12 | FT-M27-2.1 | Must | As the owner, I want S1–S11 closed to guests and other roles and shown only for the user's own school, so that no school sees another's data. | FN-M27-2.1.1–2.1.5 |
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
| US-M27-27 | FT-M27-8.3 | Must | As a school admin, I want to edit a pupil's details and reset the password, so that I help pupils who are locked out. | FN-M27-8.3.1–8.3.4 |
| US-M27-28 | FT-M27-9.1 | Must | As a school admin, I want the list of my school's teachers with class count and last login, so that I manage them. | FN-M27-9.1.1–9.1.3, 9.1.5 |
| US-M27-29 | FT-M27-9.1, 9.2 | Must | As a school admin, I want to edit a teacher, reset the password, and activate or deactivate the account, so that access matches reality. | FN-M27-9.1.4, 9.2.1, 9.2.2 |
| US-M27-30 | FT-M27-9.3 | Should | As a school admin, I want "Cipta Pengguna" to register a teacher of my school, so that a new teacher can start. | FN-M27-9.3.1, 9.3.2 |
| US-M27-31 | FT-M27-10.1 | Must | As a school admin, I want the list of my school's classes with level, teacher and members, so that I see how the school is organised. | FN-M27-10.1.1–10.1.3 |
| US-M27-32 | FT-M27-10.1, 10.2 | Should | As a school admin, I want to filter and search classes and open a class's performance, so that I drill in. | FN-M27-10.1.4, 10.2.1 |
| US-M27-33 | FT-M27-2.4 | Must | As a school admin, I want the counts on my lists to agree with the dashboard cards, so that I can trust the numbers. | FN-M27-2.4.1 |

### Acceptance criteria

**US-M27-12 — Access and scope**
- **AC-M27-12.1** Given no session, when I open any of `/admin-sekolah/statistik-penggunaan`, `/dskp-heatmap`, `/laporan-aktiviti`, `/laporan-bulanan`, `/pelajar`, `/guru`, `/guru/baru`, `/kelas` or `/amaran/sekolah`, then I am sent to `/login`.
- **AC-M27-12.2** Given `admin@demo.test`, `guru@demo.test` or `pelajar@demo.test`, when I open each route of AC-12.1, then the global 403 page of S0 §8.3 shows in place (no redirect, no picker, no 500).
- **AC-M27-12.3** Given a `school_admin` with no school (S0 hook), when I open each route of AC-12.1, then the same 403 page shows and no school name, figure or row appears.
- **AC-M27-12.4** Given P1, when I open any list route with `?school=900001`, `?school_id=900001` or `?role=teacher` added, then the data is still school 900003's and the role of the page.
- **AC-M27-12.5** Given P1 and a pupil of school 900001, a teacher of school 900003, and an unknown id, when I open `/admin-sekolah/pelajar/{id}` with each (the teacher id on the pupil route and the pupil id on the teacher route as well), then the global 404 page shows every time.
- **AC-M27-12.6** Given `/api/admin-sekolah/*`, when called by a guest, a non-`school_admin` or a `school_admin` without a school, then it answers 401, 403 and 403 with no data.

**US-M27-13 — Header, shell, navigation**
- **AC-M27-13.1** Given P1, when each of S1 to S8 loads, then the header title is the title of §10.1 and the sub-line is the school name "SMK Demo Seri Putra"; S9 and S10 read "Edit Pengguna" / "Kemaskini maklumat pengguna" and S11 "Cipta Pengguna".
- **AC-M27-13.2** Given the same, then the tab titles are "{title} - PRESTASIPLUS" (PROPOSED) and, for S4, "Amaran Awal — Sekolah | PRESTASIPLUS".
- **AC-M27-13.3** Given P1 at 1280 px, when each route loads, then the user shell with the sidebar shows, and exactly its own item is active: ANALITIK "Statistik Penggunaan", "DSKP Heatmap" or "Laporan Aktiviti"; PENILAIAN "Amaran Awal" (also on `/amaran/sekolah?tingkatan=T4`) or "Laporan Bulanan"; HARIAN "Senarai Pelajar" (also on S9), "Senarai Guru" (also on S10 and S11) or "Kelas Sekolah"; "Dashboard" is not active on any of them.
- **AC-M27-13.4** Given any of S1 to S8, then no breadcrumb row is rendered; on S9 to S11 the footer shows "Batal" with the back arrow to the list.

**US-M27-14 — Responsive, readable, clean**
- **AC-M27-14.1** Given P1 and the populated school at 375, 768 and 1280 px, when each screen loads, then the document has no horizontal scroll.
- **AC-M27-14.2** Given the same, then every text node is at least 12 px.
- **AC-M27-14.3** Given 375 px, then each wide table scrolls inside its card and the card does not overflow the page.
- **AC-M27-14.4** Given the pages and the M27 files, then no real person's name, IC number or password appears; no list shows a user of another school; no IC is rendered anywhere in S1–S11.
- **AC-M27-14.5** Given an endpoint forced to a server error, when its page loads, then the M01 global error page shows (provisional).
- **AC-M27-14.6** Given any list of 26 or more rows, then 25 rows show with the paginator wording of M02 FR-M02-18 and the links keep the other query parameters; with 25 rows or fewer no paginator shows.

**US-M27-15 — S1 figures**
- **AC-M27-15.1** Given P4 on S1, then seven tiles show in the order "Pelajar", "Guru", "Pelajar Aktif", "Penglibatan", "Sesi Latihan", "Soalan Dijawab", "Purata Ketepatan", and the pills "Hari Ini", "7 Hari", "30 Hari" with "30 Hari" active.
- **AC-M27-15.2** Given P4 and each period, then "Pelajar" and "Guru" equal the M02 counts, "Pelajar Aktif", "Sesi Latihan", "Soalan Dijawab" and "Purata Ketepatan" (one decimal) equal the M05 school queries for the window, "Penglibatan" equals round(aktif ÷ pelajar × 100) and the sub-line of "Pelajar Aktif" reads "daripada {pelajar}" (oracle).
- **AC-M27-15.3** Given `?period=bogus` or no period, then the page is the 30-day view; given `?period=7days`, the "7 Hari" pill is active.
- **AC-M27-15.4** Given a school with no pupils, then "Penglibatan" reads "0%", never "100%".

**US-M27-16 — S1 breakdown and empty states**
- **AC-M27-16.1** Given P4 and a period with sessions, then the card "Mengikut Mod Latihan" lists the session labels with sessions and "Ketepatan Purata", ordered by sessions descending, and the "Sesi" column sums to the tile "Sesi Latihan".
- **AC-M27-16.2** Given a school with no session in the 30 days, then the card shows "Tiada data untuk tempoh ini" and "Tiada aktiviti latihan dalam tempoh 30 Hari yang lepas."; for `7days` the text reads "… 7 Hari …".
- **AC-M27-16.3** Given `?period=today` and no session today, then the text "Belum ada pelajar buat latihan hari ini. Cuba lihat 7 Hari atau 30 Hari." shows with "7 Hari" and "30 Hari" as links to `?period=7days` and `?period=30days`.
- **AC-M27-16.4** Given no session in the period, then "Purata Ketepatan" reads "—" and the footnote "Ketepatan dipaparkan sebagai “—” kerana belum ada sesi latihan direkodkan dalam skop ini." shows; no export control exists on S1.

**US-M27-17 — S2 heatmap**
- **AC-M27-17.1** Given P4 on S2, then the card heading "Peta DSKP — Standard Pembelajaran", the caption "KSSM {Subjek} Tingkatan {n}" and the legend "Mahir (75%+)", "Sederhana (50-74%)", "Lemah (<50%)", "Belum Cuba" show.
- **AC-M27-17.2** Given the default subject and "Tingkatan 4", then the tiles are the SPs of the M10 DSKP store for that subject and level, grouped under Bidang headings in code order, each with its SP code.
- **AC-M27-17.3** Given a tile with answers, then its value is round(100 × Σcorrect ÷ Σanswered) over the school's pupils (oracle: M08 SpRecord), its status follows 75 and 50 on the shown value, and its colour is green, yellow or red; a tile without answers is slate with no value.
- **AC-M27-17.4** Given a tile, then its `title` is "{code}: {title} — {status}" with " · {n} cuba · {p}% betul" added when answered, and tiles are not links.

**US-M27-18 — S2 filters and states**
- **AC-M27-18.1** Given S2, when I change the select "Subjek" or click the pill "Tingkatan 5", then the page reloads with `?subjectId=…&tingkatan=T5` and the tiles and caption follow; "Tingkatan 4" is active by default.
- **AC-M27-18.2** Given a subject and level with no SP, then the text "Tiada Standard Pembelajaran untuk subjek dan tingkatan ini." shows (provisional).
- **AC-M27-18.3** Given a school without SP records for the chosen subject, then every tile reads "Belum cuba" and shows no percentage (no error).
- **AC-M27-18.4** Given P1 and P4, then the same subject and level give different tile values where the schools differ, and no value is a platform total.

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
- **AC-M27-22.1** Given S4, then the buttons "Keberkesanan Intervensi", "Ringkasan Eksekutif" and "Muat Turun CSV" show in that order with the targets `/amaran/keberkesanan`, `/amaran/ringkasan-eksekutif?scope=school&school_id={own id}` and `/amaran/export/school/{own id}`.
- **AC-M27-22.2** Given "Muat Turun CSV", then the file name is `amaran-sekolah-{own id}-{yyyymmdd}.csv`, the columns are M18's, and every row is a pupil of the school (no IC, e-mail or phone) (`@blocked-by M18`).
- **AC-M27-22.3** Given P1 opening `/amaran/sekolah/900001` or `/amaran/export/school/900001`, then M18 answers its refusal for a school outside the scope (403) (`@blocked-by M18`).
- **AC-M27-22.4** Given a school without pupils, then the tiles show "0", no list row shows and no error (provisional).
- **AC-M27-22.5** Given `?tingkatan=T4`, then the "Tingkatan 4" pill is active and only pupils in T4 classes count (`@blocked-by M18`).

**US-M27-23 — S5 monthly report**
- **AC-M27-23.1** Given P4 on S5 at the clock, then the heading reads "Laporan September 2026", the previous-month link reads "← Ogos 2026" and no next-month link shows (the month is current). BM month names: Januari, Februari, Mac, April, Mei, Jun, Julai, Ogos, September, Oktober, November, Disember.
- **AC-M27-23.2** Given the shown month, then "Penglibatan", "Soalan Dijawab", "Ketepatan" and "Sesi Latihan" equal the M05 and M02 school queries for that calendar month (oracle) with the sub-lines "{n} aktif / {n} daftar" and "{x} soalan/pelajar".
- **AC-M27-23.3** Given `?bulan=2026-08`, then "Laporan Ogos 2026" shows with both "← Julai 2026" and "September 2026 →"; given `?bulan=2027-01` or `?bulan=x`, then the current month shows.
- **AC-M27-23.4** Given a month without answers, then the cards read "0%", "0", "—", "0" and the sections below are not rendered.

**US-M27-24 — S5 sections and print**
- **AC-M27-24.1** Given P4, then the card "Statistik Bulanan" with the subtitle "12 bulan terakhir — pecahan prestasi mengikut bulan" lists the months with sessions among the 12 ending with the shown month, columns as FN-M27-7.2.1, values equal to the oracle; with more than one row the footer "Jumlah" sums answers and correct and shows the pooled accuracy.
- **AC-M27-24.2** Given no month with sessions, then "Tiada data" and "Tiada aktiviti direkodkan buat masa ini" show.
- **AC-M27-24.3** Given the shown month with answers, then "SUBJEK TERKUAT" and "SUBJEK PERLU PERHATIAN" name the subjects of highest and lowest accuracy with "{p}% ({n} soalan)", and one row per subject reads "{p}% · {n} soalan · {n} pelajar".
- **AC-M27-24.4** Given S5, then the footer reads "Laporan dijana: 25 Sep 2026, 03:40 PM · PrestasiPlus" at the clock and the button "Cetak / PDF" calls `window.print()` once when clicked (provisional).

**US-M27-25 — S6 list**
- **AC-M27-25.1** Given P4 on S6, then the cards "Pelajar", "Aktif", "Tidak Aktif" equal the M02 counts of the school's pupils (oracle) and do not change with the filters.
- **AC-M27-25.2** Given the table, then the columns are "#", "Nama", "Emel", "Telefon", "Tingkatan", "Kelas", "Aktif?", "Tarikh", "Tindakan"; each row equals its M02 user (phone "-" when empty, date `dd/mm/yyyy`), the "Kelas" cell lists the active M10 classes or "-".
- **AC-M27-25.3** Given P1, then every row has `schoolId` 900003, role student, and no teacher, school admin or pupil of another school appears.
- **AC-M27-25.4** Given a school with no pupils, then the row "Tiada pengguna dijumpai" and "Cuba ubah kriteria carian anda" shows and no paginator.
- **AC-M27-25.5** Given an active pupil, then the "Aktif?" badge reads "Aktif" and is not a control, the name is a link to S9 and the action "Edit" shows; given an inactive pupil, then the badge reads "Tidak" and neither link nor "Edit" shows. No "Import Pelajar", "Tambah", delete or checkbox control exists.

**US-M27-26 — S6 filters, order, paging**
- **AC-M27-26.1** Given the filter "Status" "Aktif" or "Tidak Aktif" or a search text (name or e-mail, case-insensitive), then the rows narrow accordingly and the controls keep their values from the URL.
- **AC-M27-26.2** Given the unfiltered list, then active pupils come first and, inside each group, the newest id first.
- **AC-M27-26.3** Given 26 or more pupils, then 25 rows show on page 1 and the paginator reads "Showing 1 to 25 of {total} results" at 1280 px.

**US-M27-27 — S9 edit pupil**
- **AC-M27-27.1** Given P4 and an active pupil, when I open S9, then the profile card, the form "Nama *", "Emel *", "No. Telefon (Pilihan)", the line "Status" "Aktif", and the footer "Batal" and "Kemaskini" show, with no role, school, grade or IC field.
- **AC-M27-27.2** Given I change the name and press "Kemaskini", then S6 shows with "Pengguna berjaya dikemaskini." and the M02 record holds the new name.
- **AC-M27-27.3** Given an empty name, an invalid e-mail or an e-mail of another user, then the M02 validation errors show above the form and nothing is saved.
- **AC-M27-27.4** Given I open "Reset Kata Laluan", then "Kata Laluan Baru" and "Sahkan Kata Laluan Baru" show; given a matching password of at least 6 characters, then it is saved and the pupil can sign in with it; given a mismatch or fewer than 6 characters, then the M02 error shows.
- **AC-M27-27.5** Given an inactive pupil, when I open S9 by URL, then the 403 page shows.
- **AC-M27-27.6** Given the request body adds `role`, `schoolId` or `isActive`, then they are ignored.

**US-M27-28 — S7 list**
- **AC-M27-28.1** Given P2 on S7, then the cards "Guru", "Aktif", "Tidak Aktif" equal the M02 counts of the school's teachers and the button "Cipta Pengguna" shows.
- **AC-M27-28.2** Given the table, then the columns are "#", "Nama", "Emel", "Telefon", "Kelas", "Login Terakhir", "Aktif?", "Tarikh", "Tindakan", and only users with role teacher of school 900001 appear (teacher 5 included, no school admin).
- **AC-M27-28.3** Given teacher 5, then "Kelas" reads "2 kelas" (classes 2001 and 2002, M10) and "Login Terakhir" is the M17 relative time of the user or "Belum login".
- **AC-M27-28.4** Given a school with no teacher, then "Tiada pengguna dijumpai" shows.
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
- **AC-M27-30.3** Given valid values, when I press "Daftar Pengguna", then S7 shows with "Pengguna berjaya didaftarkan." and the new teacher is listed, active, of school 900003.
- **AC-M27-30.4** Given an e-mail already used or a password mismatch, then the M02 errors show and nothing is created.
- **AC-M27-30.5** Given the body adds `role: 'admin'` or another `schoolId`, then the created user is still a teacher of the viewer's school.

**US-M27-31 — S8 list**
- **AC-M27-31.1** Given P2 on S8, then the tile "Kelas Aktif" equals the S0 card "KELAS AKTIF" and the line "{n} kelas dipaparkan" equals the M10 count for school 900001.
- **AC-M27-31.2** Given the table, then the columns "#", "Kelas", "Subjek", "Tingkatan", "Guru", "Murid", "Kod Kelas" show; classes 2001 and 2002 read "5 MARIKH - Kimia" and "5 MARIKH - Sejarah", "Tingkatan 5", teacher 5's name, "Murid" = M10 active members and the M10 join codes.
- **AC-M27-31.3** Given a `school_class` row of the school, then "Guru" and "Kod Kelas" read "—" and the name is not a link; a null subject reads "Tiada Subjek".
- **AC-M27-31.4** Given a school without classes, then "0 kelas dipaparkan", "Tiada kelas dijumpai" and "Sila cipta kelas terlebih dahulu" show.
- **AC-M27-31.5** Given P1, then no class of another school appears.

**US-M27-32 — S8 filters and link**
- **AC-M27-32.1** Given the filter "Tingkatan / Darjah" (options "Semua" and the school's levels) and the search "Cari kelas...", then rows narrow by level and by class name (case-insensitive); order is name A to Z.
- **AC-M27-32.2** Given 26 or more classes, then 25 rows show with the paginator.
- **AC-M27-32.3** Given a `classroom` row, when I click its name, then M08 S5 `/prestasi/kelas/{id}` opens for the class (`@blocked-by XR-M27-13`, provisional).

**US-M27-33 — Coherence**
- **AC-M27-33.1** Given P4, then the unfiltered "Pelajar" card of S6 equals "JUMLAH PELAJAR" on S0.
- **AC-M27-33.2** Given P4, then the unfiltered "Guru" card of S7 equals "JUMLAH GURU" on S0, and the "Kelas Aktif" tile of S8 equals "KELAS AKTIF".
- **AC-M27-33.3** Given P4, then the S4 tiles "On Track", "Perlu Perhatian" and "Berisiko Tinggi" equal the S0 "Selamat", "Berhati" and "Berisiko" (`@blocked-by M18`).

Totals: **22 stories, 73 Functions, 99 acceptance criteria** (US-M27-12…33).

---

## 13. UI expectations

| Screen | Behaviour notes |
|---|---|
| S1 | Header, period pills, seven tiles (2 / 4 / 4 per row at 375 / 768 / 1280), card "Mengikut Mod Latihan"; empty card replaces the table. |
| S2 | Filter card, heading card with caption, legend, Bidang groups of tiles that wrap; tiles at least 12 px text. |
| S3 | Tabs and pills as M17 S11; overview cards 2 / 4 / 4 per row; tables scroll inside their cards. |
| S4 | The M18 S22 layout: pills, four tiles, distribution bar, buttons right-aligned, subject card, risk table. |
| S5 | Month heading with the two navigation links, four cards, the table card, the subject card, footer with the print button. |
| S6, S7 | Count cards, filter card, table card with paginator; S7 adds the button "Cipta Pengguna" in the header row. |
| S8 | Tile, count line, filter card, table card with paginator. |
| S9, S10, S11 | M02 S3 and S2 form layout: profile card (S9, S10), form card, amber reset bar, footer actions. |

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
| EL-S4-14 | Foreign id behaviour | OWNER (M18 FR-M18-09) | FN-M27-6.2.2 | M |
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
| EL-S6-03 | Panduan "Urus Pelajar": import, edit, monitor the whole school | LIVE | FN-M27-8.1.1, 8.3.1 | MD (import not on S6, DV-M27-17) |
| EL-S6-04 | Panduan FAQ: click the user name, then "Reset Kata Laluan" | LIVE | FN-M27-8.1.3, 8.3.2 | M |
| EL-S6-05 | Panduan FAQ: CSV columns name, email, grade | LIVE | none | N (Import Pelajar is outside rows L51–L58, XR-M27-11) |
| EL-S6-06 | M02 S1 columns, filters, empty copy, paginator | ANALOGUE | FN-M27-8.1.2–8.1.5, 2.3.5 | MD (role, school, checkbox, delete and Login As dropped) |
| EL-S6-07 | M18 S9 and M11 S3 pupil tables (class, Tingkatan) | ANALOGUE | FN-M27-8.1.3 | M (columns "Tingkatan", "Kelas") |
| EL-S6-08 | `UserDirectory` filters, order, 25 per page | SERVER | FN-M27-8.1.2, 8.1.4 | M |
| EL-S6-09 | `StaffScope` edit and reset rules (own school, active only) | SERVER | FN-M27-8.3.3 | M |
| EL-S6-10 | Server activation by national admin only | SERVER | FN-M27-8.1.3 | M (pupils read-only, DV-M27-10) |
| EL-S6-11 | IC masking with PDPA reveal (M18 S9) | ANALOGUE | none | N (no IC on school-admin lists, FN-M27-2.3.3) |
| EL-S6-12 | Deck sidebar items "Senarai Pelajar", "Import Pelajar" | SERVER-DECK | FN-M27-2.2.3 | N (DV-M27-14) |
| EL-S7-01 | Sidebar label "Senarai Guru" (HARIAN) | LIVE | FN-M27-2.2.3, 9.1.1 | M |
| EL-S7-02 | Route exists (302) | LIVE | FN-M27-2.1.2 | MD (DV-M27-01) |
| EL-S7-03 | Panduan "Daftar Guru": "Senarai Guru" then "Cipta Pengguna" | LIVE | FN-M27-9.1.1, 9.3.1 | M |
| EL-S7-04 | Panduan "Urus Guru": register, edit profile, activate or deactivate | LIVE | FN-M27-9.1.4, 9.2.1 | MD (conflict with server, DV-M27-10) |
| EL-S7-05 | M18 S9 "Senarai Guru" columns and empty copy | ANALOGUE | FN-M27-9.1.3 | MD (subject chips and "Kelayakan" not adopted: not in M02, DV-M27-17) |
| EL-S7-06 | M11 S3 teacher table ("Login Terakhir") | ANALOGUE | FN-M27-9.1.3 | M |
| EL-S7-07 | `importableRoles` for school admin = guru; school forced to own | SERVER | FN-M27-9.3.1, 9.3.2 | M |
| EL-S7-08 | `canActivate` national admin only; imports land inactive | SERVER | FN-M27-9.1.4 | N (DV-M27-10) |
| EL-S7-09 | `SchoolPicker` locked label | SERVER | FN-M27-9.3.1 | M |
| EL-S7-10 | Deck sidebar items "Senarai Guru", "Cipta Pengguna" | SERVER-DECK | FN-M27-9.1.1 | MD ("Cipta Pengguna" kept as a button, DV-M27-14) |
| EL-S8-01 | Sidebar label "Kelas Sekolah" (HARIAN, last) | LIVE | FN-M27-2.2.3, 10.1.1 | M |
| EL-S8-02 | Route exists (302) | LIVE | FN-M27-2.1.2 | MD (DV-M27-01) |
| EL-S8-03 | Deck sidebar item "Kelas Sekolah" (door icon, first under PENGURUSAN) | SERVER-DECK | FN-M27-2.2.3 | N (live order wins, DV-M27-14) |
| EL-S8-04 | Deck S0 card "KELAS AKTIF" | SERVER-DECK | FN-M27-10.1.1, 2.4.1 | M |
| EL-S8-05 | M18 S9 "Prestasi Per Kelas" header, empty copy | ANALOGUE | FN-M27-10.1.1, 10.1.4 | M |
| EL-S8-06 | M10 S4 card fields (name, subject, level, join code, members) | ANALOGUE | FN-M27-10.1.2 | M |
| EL-S8-07 | M08 S3 "Kelas Sekolah" group, kind `school_class`, "Tiada Subjek", class link | ANALOGUE | FN-M27-10.1.2, 10.1.3, 10.2.1 | M |
| EL-S8-08 | Server `classrooms` columns joined to level, school, member counts | SERVER | FN-M27-10.1.2 | M |
| EL-S8-09 | Deck Prestasi page "26 kelas · 171 murid" | SERVER-DECK | none | N (a figure of one real school, never copied) |
| EL-S8-10 | Create or edit class | none | none | N (no evidence; teachers create classes, Panduan) |
| EL-X-01 | Shell, sidebar of the live screenshot (Command Center, HARIAN, PENGURUSAN, PENILAIAN, ANALITIK) | LIVE | FN-M27-2.2.3 | M (shell-owned, XR-M27-11) |
| EL-X-02 | `/admin-sekolah/pilih-sekolah` (500) | LIVE | FN-M27-2.1.2, 2.1.3 | MD (DV-M27-01, not built) |
| EL-X-03 | Server defect: missing school treated as national | SERVER | FN-M27-2.1.3 | N (DV-M27-02) |
| EL-X-04 | Deck header pattern and avatar, logout | SERVER-DECK | FN-M27-2.2.1 | M (shell-owned) |

Summary: **93 elements, 56 mapped, 20 mapped with a deviation, 17 not adopted with a stated reason, 0 unmapped.** The three elements with provenance "none" (EL-S1-15, EL-S2-08, EL-S5-09) are the PROPOSED parts.

---

## 15. Fidelity deviations

D9 applies as in Part A. D24: live wins over deck, deck over server, server over analogue.

| ID | Discovery | Category | Live or source behaviour | Rebuild behaviour and alternatives | Status |
|---|---|---|---|---|---|
| DV-M27-08 | D-M27-02 | Broken (404) | The sidebar href `/admin-sekolah/laporan-aktiviti` answers 404 on live. The same label opens `/admin/laporan` for the platform admin. | The route is built (S3) and renders M17 S11 for the school. Alternatives: point the sidebar to `/admin/laporan` (rejected: that path is the platform admin's page and its shell); leave the 404 (rejected: broken link). | Rule (D9) |
| DV-M27-09 | R10, discovery §1.1 | Broken (500, dead end) | The six routes `/statistik-penggunaan`, `/pelajar`, `/guru`, `/kelas`, `/dskp-heatmap`, `/laporan-bulanan` answer 302 then 500 for a user with no chosen school. | Built; a user without a school or with another role gets 403 (same as DV-M27-01). | Rule (D9) |
| DV-M27-10 | OQ-M27D-13 | Source conflict (live copy vs server) | Panduan: a school admin can "aktif/nyahaktif akaun guru". Server: only the national admin can activate (`canActivate`), school-admin imports land inactive. | Live copy wins on capability: the school admin switches teachers of the school (S7). Pupils stay read-only (Panduan names teachers only). The server rule that an inactive account cannot be edited or reset by the school admin is kept (S9, S10 refuse), so a deactivated teacher can be switched back but not edited. Alternatives: no activation (rejected: contradicts live copy); activation of pupils too (rejected: not named, new scope). | Approved by the brief (D24) |
| DV-M27-11 | OQ-M27D-05 | Server denies; analogue adapted | The server gives the PPD/JPN statistics page to officers only and refuses a school admin; live Panduan and sidebar show the item to the school admin. | Built for the school: "Sekolah" tile and the table "Mengikut Sekolah" dropped (one school), "Ketepatan" labelled "Purata Ketepatan", "Guru" kept. | Rule (live wins) |
| DV-M27-12 | OQ-M27D-07 | Two legends in live | Student SP map uses 75 and 50 (M08); the weak-topic heatmap of R10 uses 80 and 50 ("Mantap"). | S2 is labelled DSKP, so the M08 SP legend and bands are used. | Rule (D23 precedent, PROPOSED) |
| DV-M27-13 | OQ-M27D-09, 10 | One-school scope | M17 S11 is a platform page with a "Sekolah" tab, a school select, a "Sekolah" column, a card "Skor Purata" with chip "Struktur" (display constants without a definition, DC-M17-06) and the sub-line "Penglibatan pengguna seluruh platform". | Tab, select, column, card, chip and the platform sub-line are not rendered on S3; every other element and copy is M17's. | Rule (precedent M17 FR-M17-106, 111) |
| DV-M27-14 | OQ-M27D-02 | Deck older than live | Deck sidebar: PENGURUSAN holds "Kelas Sekolah", "Senarai Pelajar", "Senarai Guru", "Statistik Penggunaan"; TINDAKAN holds "Cipta Pengguna", "Import Pelajar". | The live screenshot order wins (HARIAN, ANALITIK). "Cipta Pengguna" is kept as the button on S7 (Panduan path), "Import Pelajar" belongs to the PENGURUSAN item outside L51–L58. | Rule (live wins) |
| DV-M27-15 | OQ-M27D-04 | Deck older than live | The deck page has two buttons; live M18 S22 has "Keberkesanan Intervensi" first. | Three buttons (live wins). | Rule |
| DV-M27-16 | OQ-M27D-12 | Not adopted | The server school focus report has a headcount section. | S5 omits it: its definition by month is not evidenced. | PROPOSED |
| DV-M27-17 | OQ-M27D-14, 15 | Not adopted | Analogue columns "Subjek", "Kelayakan" (M18 S9, shown "-" on live), IC masking (M18 S9), "Import Pelajar" link, "Tambah", delete, Login As (M02 S1). | Not rendered on S6, S7: not in the M02 user record for this scope, or admin-only, or targets not built. | PROPOSED |

---

## 16. Out of scope ("not in this version")

| Item | Reason |
|---|---|
| Sidebar items "Urus Pengguna", "Import Pelajar", "Aktiviti Guru", "Langganan", "Invois" and the routes `/admin-sekolah/pengguna`, `/import-pelajar`, `/aktiviti-guru`, `/langganan`, `/invois` | Not in rows L51–L58 (not Release 1.0 rows); their hrefs stay 404 until built. |
| Delete, Login As, bulk actions, role change, school change on S6, S7 | Admin-only on the server (`canChangeRole`, `canManageAccount`). |
| IC number display or edit | Personal data; no evidence for the school admin. |
| Pupil activation or deactivation | Not named in Panduan; server admin-only (DV-M27-10). |
| Creating a pupil one by one | Server: pupils come through import only (`importableRoles`). |
| Creating or editing classes | No evidence; teachers create classes (Panduan). |
| Exports of S1, S2, S3, S5 (CSV, PDF files) | Not evidenced; S4 CSV and S5 print only. |
| `/admin-sekolah/pilih-sekolah` | Not built (DL-1). |
| The M18 pages behind the S4 buttons, M08 S5, M17 S11 internals | Owned by M18, M08, M17. |

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
| OQ-M27-20 | S6, S7: columns beyond M02 S1 ("Tingkatan", "Kelas", "Kelas" count, "Login Terakhir"); no IC; no export. | Nothing | FN-M27-8.1.3, 9.1.3 |
| OQ-M27-21 | S11: a teacher created by the school admin is active at once (server: imports need national approval); "Import Pelajar" link not shown. | Nothing | FN-M27-9.3.2 |
| OQ-M27-22 | S9, S10 deliver the Panduan flow "click the name, then Reset Kata Laluan" as a page, not a modal; the reset takes a typed password (M02 S3 pattern), not a generated one. | Nothing | FN-M27-8.3.2 |
| OQ-M27-23 | S2: the aggregation rule (pooled correct over answered per SP over the school's pupils). | Nothing | BR-M27-23 |
| OQ-M27-24 | S8: both record kinds listed; columns; link to M08 S5 for a class of the school (needs M08 to admit the school admin). | Nothing | FN-M27-10.x |
| OQ-M27-25 | Build order: S4 and the S4-related ACs wait for the M18 build (`Q-M18-RISK(schoolId)`, S22 data); S2 needs the M08 school aggregate of SpRecord (XR-M27-13). | Build of S4 and S2 only | tagged `@blocked-by` |

**Questions for Session 8 (S0 owner; nothing edited here).**

| ID | Question |
|---|---|
| QS8-01 | S0 §2.1 (SRS), URS §8 and OQ-M27-06 call the routes `/admin-sekolah/pelajar`, `guru`, `kelas`, `statistik-penggunaan`, `dskp-heatmap`, `laporan-bulanan`, `laporan-aktiviti` "not built (404)". Once Part B passes G1 they are built; please refresh those rows at the S0 re-audit. |
| QS8-02 | URS §8 lists these screens as out of scope for S0; that stays true for S0 but the wording "contents unrevealed" is replaced by Part B. Please add a pointer. |
| QS8-03 | Part B counts "Kelas Aktif" with the same call as BR-M27-13 (`classrooms.list({isActive: true, schoolId})`, both record kinds). If you change that definition, S8 follows automatically; please tell Session 2. |
| QS8-04 | AC-M27-33.3 asserts the S0 panel "AMARAN AWAL" equals the S4 tiles; if the S0 panel changes its source, update both. |
| QS8-05 | Part B reuses the 403 and 404 pages of S0 §8.3 by reference; please keep those texts stable. |
