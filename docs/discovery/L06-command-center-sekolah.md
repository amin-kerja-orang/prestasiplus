# L06 — Command Center, Admin Sekolah variant (`/admin-sekolah/command-center`) — Discovery and requirement addendum (FINAL, audited)

- **Status:** FINAL after independent audit (section 7, verdict PASS). **Merged 2026-10-02 into M17 SRS v1.13 (§3.2) and URS v1.11 (EP-M17-10) as the "Admin Sekolah alias (school scope)" subsection.** The two audit Major items are decided (M-01 -> OQ-M17-12, M-02 -> OQ-M17-13, section 5.0); where this file and the merged M17 docs differ, the M17 docs win. Prepared 2026-10-02 (doc-only; no browser, no SSH).
- **Roles-matrix row:** L06 "Command Center (1)", ticks G★ AS★, owner column "M11", progress 40% (`docs/ROLES-MATRIX-LINES.md` line 28). Build-plan R.1.3 row 1 "P-SA-CC (parked)" (`docs/architecture/build-plan.md` line 114). Matrix/TRACKER owner change M11 -> M17 is for the lead.
- **User decision (2026-10-02):** use the server's code/data as the source for this screen. **Delivery Lead decisions (2026-10-02)** are recorded in section 5.0.
- **Decision D24 (user, 2026-10-02) — supersedes the REFERENCE / UNVERIFIED wording of this file:** where live cannot be observed, the server code/data (`/var/www/prestasiplus_cloud`, local copy `D:\Dev Projects\prestasiplus-reference\`) is the **authoritative** source. Every tag **REFERENCE** below now reads **SERVER** (same `path:line` citations, relative to `backend/`); the tag UNVERIFIED and the "no school-admin account" caveat are withdrawn, and no school-admin account is ever requested. **G1 approved by the user 2026-10-02.** The merged M17 SRS v1.13 §3.2 and URS v1.11 EP-M17-10 are authoritative where they differ from the older wording in this file (see 5.9).
- **Evidence tags:** **OBSERVED** = seen on live prestasiplus.my (wins wherever observed); **SERVER** = server code/data, authoritative where live is not observable; **INFERRED** = derived, neither live nor server defines it; **PROPOSED** = rebuild decision. The server's national page is itself a simplified adaptation of live, so its layout/copy is not adopted over observed live.
- **Privacy:** no personal name, username, password or e-mail from the reference is copied here. The reference seeder `backend/database/seeders/SchoolRosterSeeder.php` contains a real-looking school-admin name and a fixed default password; both are deliberately omitted. Fictitious names only below.
- **Language:** exact BM copy is quoted from the reference Blade files only where listed as REFERENCE; the rebuild copy is live M17 S2 copy.

---

## 1. Sources searched

| Source | Result |
|---|---|
| Live (our discovery) `docs/discovery/M27-school-admin.md` §1.2 row 3 (line 46), line 65, §2.4 (line 94), OQ-M27-02 (line 177) | `/admin-sekolah/command-center` = **403** "Akses Ditolak" for the platform-admin account; route exists (control path is 404). Other school-admin routes 302 to the picker instead, so the role gate here runs before the school-pick middleware (INFERRED). Content unrevealed. OBSERVED |
| Live sidebar (screenshots `roles-matrix/admin sekolah/*.jpeg`, via M27 §1.1, line 21) | First item "Command Center" with badge "LIVE", indigo button. OBSERVED. The href `/admin-sekolah/command-center` and `target=_blank` come from `src/shells/nav/user-nav.ts` line 222 (INFERRED, not observed in markup) |
| Live M17 S2 (URS FN-M17-3.1.1, line 155) | Header carries "← Dashboard" -> S1 and "📊 Aktiviti Harian" -> S3. OBSERVED (admin) |
| Reference `backend/routes/web.php` lines 533, 734-738, 740, 1048-1049 | The only Command Center routes **reachable by a school admin** are `/admin/command-center`, `/admin/command-center/live`, `/admin/command-center/daily-activity`, inside group `['auth','role:admin,admin_sekolah,pegawai_ppd']`. Lines 734-737 comment: scoped since 22 Sep; no extra role middleware, the controller refuses. Lines 1048-1049: legacy `/admin/command-center/school/{id}` and `/student/{id}` redirect to `/admin/command-center`. Separate Command Centers exist for teacher (`/guru/command-center`, line 1749) and PPD/JPN (`web.php:830-841`, `PpdJpnController::commandCenter`). REFERENCE |
| Reference `backend/app/Http/Controllers/Admin/CommandCenterController.php` (220 lines) | The controller. `scope()` lines 41-49; `index()` 51-88; `liveData()` 91-102; `dailyActivity()` 104-219. REFERENCE |
| Reference `backend/app/Support/Analytics/PlatformMetrics.php` (236 lines) | `forSchool(?int)` scoping and `confine()` (lines 26-57), KPIs 65-102, live feed 105-126, trend 133-152, top schools 155-165, top students 168-178, mood 185-226, report counts 229-235. REFERENCE |
| Reference `backend/app/Support/StaffScope.php:128-148` | `listScopeSchoolId()` = own `school_id` for `admin_sekolah`, else null; `openedScopeOrAbort()` refuses null for non-`admin`. REFERENCE |
| Reference `backend/resources/views/admin/command-center.blade.php`, `command-center-daily.blade.php`, `admin/layout.blade.php:51-55,196-206` | Views, copy, states, nav entries. Layout 51-55 = role label "Admin Sekolah"; 196-206 = sidebar entry, same tab, no `target`. REFERENCE |
| Reference `backend/app/helpers.php:16-20,164-170` | Staff landing is `/admin` (line 19); `nav_school_scoped()` lists `admin/command-center` ("23 Sep", line 167). REFERENCE |
| Reference `backend/tests/Feature/CommandCenterScopeTest.php` (181 lines) | The behavioural spec: school admin sees own numbers only; no ranking; district officer 403; feed never names another school's pupil. REFERENCE |
| Reference `backend/app/Filament/Pages/CommandCenter.php`, `resources/views/filament/pages/command-center.blade.php` | An older Filament version of the page. Superseded by the custom page; not used. REFERENCE |
| Reference `backend/resources/views/guru/command-center.blade.php`, `Parity/GuruAnalyticsController.php` (`commandCenter` line 177, `liveData` 342, `drill` 708) | Teacher Command Center (M10 S2 counterpart). Not school-admin. REFERENCE |
| Reference `lib/pages.ts:23-35`, `lib/nav.ts:11-19` | Next.js side lists only `/admin/command-center` and `/admin/command-center/daily-activity`. No `/admin-sekolah` route anywhere in the reference code. The only `admin-sekolah` string is `backend/public/present.html:993` (a slide, text `prestasiplus.my/admin-sekolah`). REFERENCE |
| Reference `docs/`, `.planning/`, `database/SCHEMA.md` | No school-admin Command Center spec. Role facts only. `.planning/phases/04-visual-fidelity/ORIGIN-SPEC.md:84-92` documents the **teacher** button. REFERENCE |
| Reference seeders / `database/data/` | No Command Center data. One school-admin account is seeded (`SchoolRosterSeeder.php`); content not copied. REFERENCE |
| Our SRS | M17 S2 (FR-M17-20…33), S3 (FR-M17-34…47), S4-S7 (FR-M17-48…60), BR-M17-30, §2 route table, §7 endpoints, §9 matrix; M10 S2 (FR-M10-14…20, route table line 63) |

## 2. What the reference contains (REFERENCE)

### 2.1 Routes and permissions

| Route | Handler | Gate |
|---|---|---|
| `GET /admin/command-center` | `index` | auth + role in {admin, admin_sekolah, pegawai_ppd}, then `scope()` |
| `GET /admin/command-center/live` | `liveData` (JSON, polled every 10 s) | same |
| `GET /admin/command-center/daily-activity?range=today\|week\|month` | `dailyActivity` | same |

- `scope()` (controller 41-49): school admin -> own `school_id`; national `admin` -> null (whole platform); anything else with null scope (district officer `pegawai_ppd`, or a school admin with no school, derived from `StaffScope.php:130`) -> **403**. Test 145-154 covers the district officer only; the no-school admin case is derived from the code, not tested.
- A district officer is not offered the link (`nav_school_scoped()` hides it, test 156-166).
- No separate school-admin URL exists. The school admin uses the same URL and views as the national admin; only the data and a few labels differ.
- Guest, teacher, pupil: refused by the `role:` middleware (`web.php:533`). Exact response page is not specified in the tests (INFERRED 403).

### 2.2 Screen "Command Center" (index) — school-admin rendering (not adopted as layout, see 5.0)

Title "Command Center"; subtitle `Pemantauan langsung sekolah anda` (national: `Pemantauan langsung platform`). Cards, in order:

| # | Block (copy as rendered) | Data (all confined to users of the viewer's school) |
|---|---|---|
| 1 | Header strip: red dot, "LIVE", "Data dikemaskini setiap 10 saat", clock `HH:MM:SS` (en-GB, browser time, 1 s tick) | — |
| 2 | KPI "Sekolah Berdaftar" with "{n} langganan aktif" | count of schools (= 1) and active subscriptions of that school (`school_subscriptions.status = 'aktif'`) |
| 3 | KPI "Pelajar Berdaftar" with "{n} pernah aktif menjawab" | pupils of the school; distinct pupils with at least one attempt |
| 4 | KPI "Soalan Dijawab" with "sepanjang masa" | all-time attempts of the school's users |
| 5 | KPI "Ketepatan Purata" with sub-line "sekolah anda" (national: "keseluruhan platform") | correct ÷ answered x 100, 1 decimal, 0 when none |
| 6 | "🏆 Top Sekolah" | **dropped for a school admin** (national only; code comment lines 58-62: "a ranking of one school ranks nothing"); the remaining cards use a 2-column grid instead of 3 (view line 56) |
| 7 | "📈 Aktiviti Hari Ini": "{n}" "soalan dijawab hari ini", "Minggu ini: {n}", link "Lihat Aktiviti Harian" -> daily-activity | attempts since start of day / ISO week start |
| 8 | "🤖 Wawasan": "Wawasan AI tidak disambung" / "Panel ini memerlukan perkhidmatan luaran" | static; no AI |
| 9 | "⚡ Live Feed" (max-h scroll) | 15 newest attempts: `HH:MM`, pupil name, subject name (BM) or "—", ✅/❌. Empty: "Tiada aktiviti terkini." |
| 10 | "⭐ Top Pelajar Minggu Ini" | top 8 pupils this week by answers: rank, name, "{correct}✓", answers. Empty: "Tiada aktiviti minggu ini." |
| 11 | "💚 Mood Pelajar" | four buckets Gembira 😄, Okay 🙂, Sedih 😔, Tertekan 😣 with count and bar (% of total); "{n} check-in direkod". Empty: "Tiada check-in mood lagi." |
| 12 | "🔄 Pembetulan Soalan": "Laporan Baru" / "Selesai" | `question_reports` with `status` baru / selesai, confined by reporter's school |
| 13 | "📊 Engagement (7 Hari)" | attempts per day, last 7 days, bars scaled to max (min height 4%), labels = weekday abbreviation (`translatedFormat('D')`, locale-dependent) |

- **Poll:** `GET /admin/command-center/live` every 10 s returns `kpis`, `feed`, `generated_at`; only cards 2-5, 7 and 9 refresh; a failed poll is silent (previous values stay). Cards 10-13 are rendered once on load.
- **Leak guard (test 98-106):** the feed must never contain another school's pupil. The scoped page must not contain the ranking, other school names, or the text "keseluruhan platform" (test 110-119).
- Note: the Blade file comment (view line 2) says it "mirrors ripped/clone/admin-live/raw/admin_command_center.html", i.e. the national admin page was copied from live by that team; the school-admin rendering is that team's own adaptation (code comments dated 22-23 Sep 2026).

### 2.3 Screen "Aktiviti Harian" (daily-activity), school-admin rendering

Title `Aktiviti Sekolah` (national `Aktiviti Platform`); subtitle `Ringkasan aktiviti — {Hari Ini|Minggu Ini|Bulan Ini}`. Tabs "📅 Hari Ini", "🗓️ Minggu Ini", "🗒️ Bulan Ini" (query `range`, anything else = today); back link "Command Center". Six KPI cards: "Sekolah Aktif" ("daripada {n}", n = 1), "Pelajar Aktif" ("Engagement {x}%"), "Soalan Dijawab" ("Ketepatan: {x}%"), "Sesi Latihan" ("Purata ketepatan: {x}%"), "Engagement" ("pelajar aktif / berdaftar"), "Login {range}" ("—", "Penjejakan login belum direkod"). Cards: "🏫 Aktiviti Mengikut Sekolah" (**dropped** for a school admin; test 137 asserts it is absent; view 92-111), "📚 Aktiviti Mengikut Subjek" (top 8), "⏰ Heatmap Jam (Hari Ini)", "⚡ Live Feed", "⭐ Top Pelajar" (top 8 in range), "💚 Mood Pelajar".

### 2.4 Not present in the reference

No drill-down pages for a school admin (legacy `/admin/command-center/school/{id}` redirects to the index, `web.php:1048`), no teacher or class or pupil Command Center pages, no Kirkpatrick or ALESA AI panels with data, no per-school ranking for a school admin, no login tracking, no badges.

## 3. Comparison with what we already specify

| Aspect | M17 S2 (admin, OBSERVED live) | M10 S2 (teacher, OBSERVED live) | Reference school-admin page (REFERENCE) |
|---|---|---|---|
| Route | `/admin/command-center` | `/guru/command-center` | `/admin/command-center` (shared; **no** `/admin-sekolah/…` route) |
| Shell | standalone, header "PRESTASIPLUS COMMAND CENTER", LIVE, clock | standalone dark, top links | admin layout shell (`admin.layout`), not standalone |
| Header links | "← Dashboard", "📊 Aktiviti Harian" | top links | none (sidebar only) |
| Counters | "Sekolah Berdaftar", "Pelajar Berdaftar" ("{n} aktif menjawab"), "Soalan Dijawab", "Ketepatan Purata" | teacher-class counters, "--" when 0 | same four labels; sub-lines differ |
| Top Sekolah | 5 schools | — | removed for school admin |
| Kirkpatrick / ALESA AI | live panels (FR-M17-25, 26) | panels (FR-M10-17) | absent / static "Wawasan AI tidak disambung" |
| Aktiviti Hari Ini | with bar and change line | with bar | number + week + link only |
| Live Feed | 10 rows, school link -> S4 | rows | 15 rows, no links |
| Top Pelajar Minggu Ini | 5 pupils, medals, name -> S7 | leaderboard | 8 pupils, "{n}✓", no links |
| Mood | per mood | per mood | four buckets with bars and total |
| Pembetulan | DC-M17-03 ("899", "+0.0%", "0%"), no list | — | "Laporan Baru" / "Selesai" counts |
| Engagement | DC-M17-05 bars | engagement rows | 7-day bars |
| Drill-downs | S4-S7 clickable | modal drills | none |
| Daily activity | S3, own page, tabs, drills | — | simple page, same three tabs |
| Scope | whole platform | own classes | own school only |

Reading: the **reference page is a different, simpler layout** than live M17 S2. It must not be used to redesign S2; it is evidence of **scope rules** only. Where it differs from OBSERVED M17 S2, M17 S2 wins.

## 4. Conflicts and unknowns

### 4.1 Conflicts with live

| ID | Conflict | Resolution |
|---|---|---|
| C-L06-01 | **URL.** Live (INFERRED href, 403) `/admin-sekolah/command-center`; reference serves school admins at `/admin/command-center`. | Keep the live URL as the school-admin entry (route exists, OBSERVED). The reference URL is not evidence of live behaviour. National admin keeps `/admin/command-center` (M17 S2) |
| C-L06-02 | **403 vs 200.** Live answers 403 on `/admin-sekolah/command-center` for the platform admin; the reference answers 200 for the national admin on `/admin/command-center`. | No conflict in outcome: platform admin on the school URL = 403 (OBSERVED); school admin on it = board with own-school scope (REFERENCE rule, UNVERIFIED on live) |
| C-L06-03 | **Layout.** Reference page is not the live M17 S2 board (section 3). | Decision D-L06-01: use M17 S2; reference only for scope rules |
| C-L06-04 | **New-tab behaviour** (`target=_blank`, `user-nav.ts`) vs reference same-tab sidebar link. | Follow `user-nav.ts` (INFERRED) |

### 4.2 Unknowns (cannot be resolved without a school-admin account)

| ID | Unknown | Status after decisions |
|---|---|---|
| U-L06-01 | Whether live shows a school admin the M17 S2 board scoped to one school, a reduced board, or a different page | Decided D-L06-01 (same board), UNVERIFIED |
| U-L06-02 | Live copy for school scope (subtitle, footer, header text or school name) | Decided: no new copy (FR-M17-106), UNVERIFIED |
| U-L06-03 | Whether "Top Sekolah" is hidden, shows one school, or is replaced | Decided: hidden (REFERENCE), UNVERIFIED |
| U-L06-04 | Whether pupil names link to a pupil page and whether S4-S7 open for a school admin | Decided D-L06-03: own school only, INFERRED |
| U-L06-05 | Whether S3 is reachable from the school-admin board and under which URL | Header link exists on S2 (OBSERVED for admin); URL PROPOSED (OQ-M17-14) |
| U-L06-06 | Shell: standalone or inside the school-admin shell; new tab or same tab | Decided D-L06-04: standalone, INFERRED |
| U-L06-07 | School picker (`/admin-sekolah/pilih-sekolah`, OQ-M27-05): does a school admin with one school skip it | Open, owned by M27 |
| U-L06-08 | Whether the 10 s poll and counter animation (FR-M17-21) apply unchanged | Assumed unchanged, INFERRED |
| U-L06-09 | Owner module | Decided D-L06-02: M17 |

---

## 5. Requirement addendum (FINAL) — "Admin Sekolah alias" subsection for M17

### 5.0 Decisions recorded (Delivery Lead, 2026-10-02)

| ID | Decision | Tag |
|---|---|---|
| D-L06-01 (was OQ-L06-01, Option A) | The Admin Sekolah sees the **same live M17 S2 Command Center board** at the live URL `/admin-sekolah/command-center`, every figure scoped to the viewer's own school (REFERENCE: `CommandCenterController::scope()`, `PlatformMetrics::forSchool()`); the cross-school cards "Top Sekolah" and "Aktiviti Mengikut Sekolah" are hidden (REFERENCE). Layout, copy and components otherwise replicate live M17 S2; the reference layout is not adopted. | UNVERIFIED (no school-admin account) |
| D-L06-02 (was OQ-L06-02) | Owner module **M17** (the board component's owner). The route is an alias with school scope, like the Admin Sekolah Monitoring / Kirkpatrick aliases (M11 / M12). Matrix and TRACKER mapping to be updated by the lead. | PROPOSED |
| D-L06-03 (was OQ-L06-03 and drill-downs, OQ-L06-06) | The Admin Sekolah may open S4-S7 drill-downs **only within their school**. ~~Out-of-school ids answer 403~~ **Superseded by D-L06-06: 404.** | INFERRED (mirrors teacher scope BR-M17-30) |
| D-L06-04 (was OQ-L06-04) | Shell and tab behaviour follow M17 S2 live: standalone page; the sidebar entry opens a new tab (`user-nav.ts`). | INFERRED |
| D-L06-05 (OQ-M17-12, audit M-01) | For the school scope "Engagement" (DC-M17-05) shows the school's own daily answers for 7 days (**SERVER**, `PlatformMetrics.php:133-152`); "Pembetulan" (DC-M17-03) shows zeros ("0", "+0.0%", "0%") (**INFERRED**: the server's panel is "Laporan Baru / Selesai", `PlatformMetrics.php:229-235`, unlike observed live "Rekod / Purata Naik / Kadar Baik", so live wins). Platform display constants are never shown to a school admin. Status: **DECIDED**. | SERVER / INFERRED |
| D-L06-06 (OQ-M17-13, audit M-02) | Out-of-school ids on drill-downs return **404**, not 403 (same rule as the teacher, BR-M17-30), so existence is not revealed; unknown and non-numeric ids also 404. Role refusals (not `school_admin`, §7 #5) stay 403; a school admin with no school is 403 (SERVER, controller 41-49). The server has no school-admin drill-downs (`web.php:1048-1049` redirects), so the 404 rule is not server-defined. Status: **DECIDED**. | INFERRED (404 rule) / SERVER (no school → 403) |
| D-L06-07 (OQ-M17-14) | S3 alias is `/admin-sekolah/command-center/daily-activity`, in release 1.0 as Should. The server serves the school admin at the shared `/admin/command-center/daily-activity`, contradicting the live `/admin-sekolah` prefix; live wins. Status: **DECIDED**. | PROPOSED |
| D-L06-08 (OQ-M17-15) | "← Dashboard" for a school admin goes to `/admin-sekolah`. The server lands every staff role on `/admin` (`helpers.php:16-20`), contradicting the live school-admin home; live wins. Status: **DECIDED**. | INFERRED |
| D-L06-09 (user D24, 2026-10-02) | Server code/data is authoritative where live is unobservable; server-defined school-admin copy is required ("Pemantauan langsung sekolah anda", "sekolah anda", "Aktiviti Sekolah", "daripada 1"; no "keseluruhan platform"); no school-admin account is requested; OQ-L06-07 removed; G1 approved. | SERVER |

### 5.1 Proposed placement and ids

- Mount: `/admin-sekolah/command-center` renders the M17 S2 component with a school-scope parameter taken from the session (never from the request). Same pattern as the M17 S4-S7 teacher mount (FR-M17-60, BR-M17-30); a third scope "own school".
- New M17 ids continue the current maxima (US-M17-35, FR-M17-100, BR-M17-33, SEC-M17-12, OQ-M17-11, E2E 99): **US-M17-36…42, FR-M17-101…118, BR-M17-34, SEC-M17-13, OQ-M17-12…15, AC-36.x…42.x (SRS AC column style), E2E-100…128 (one per AC, PROPOSED)**. URS FT/FN ids are assigned at merge.
- No new data store. Read-only on the owners' datasets (M02, M05, M12, M14, M08, M26); queries Q-M17-* gain a school restriction (existing `school` parameter, e.g. Q-M17-LOGINS(window[, role][, school])).
- Tracker/build-plan effect: R.1.3 row 1 "P-SA-CC" moves from "Deferred" to a buildable task after the SRS merge (Standard track).

### 5.2 User stories

| ID | Legacy | Story | Priority |
|---|---|---|---|
| US-M17-36 | US-L06-01 | As a school admin, I want to open the Command Center from my sidebar, so that I can watch my school's learning activity live. | Must |
| US-M17-37 | US-L06-02 | As a school admin, I want every figure on the Command Center to be about my school only, so that I never read another school's data. | Must |
| US-M17-38 | US-L06-03 | As a school admin, I want the counters and the live feed refreshed every 10 seconds, so that the board stays live. | Must |
| US-M17-39 | US-L06-04 | As a school admin, I want the same panels as the platform board (activity, feed, top pupils, mood, engagement, Kirkpatrick, insight) for my school, so that I see how pupils are engaging. | Should |
| US-M17-40 | US-L06-05 | As a school admin, I want a clear refusal if my account has no school or is the wrong role, so that no national figure is ever shown by mistake. | Must |
| US-M17-41 | (new) | As a school admin, I want to open the school, teacher, class and pupil drill-downs of my own school from the board, so that I can look into a figure. | Should |
| US-M17-42 | US-L06-06 | As a school admin, I want the daily-activity board (today / week / month) scoped to my school, so that I can see the period summary. | Should |

### 5.3 Functional requirements

| ID | Legacy | Requirement | Tag | Source |
|---|---|---|---|---|
| FR-M17-101 | FR-L06-01 | The route `/admin-sekolah/command-center` SHALL render the M17 S2 Command Center (FR-M17-20…33) for a signed-in school admin. | OBSERVED (route exists, 403 for platform admin) / INFERRED (school admin) | M27 §1.2 row 3 |
| FR-M17-102 | FR-L06-02 | The route and its poll SHALL answer the global 403 page "Akses Ditolak" (copy M27 §2.4) to the platform admin and to every other signed-in role that is not school admin (teacher, pupil, parent, PPD, JPN); a guest SHALL be redirected to `/login` (M01 guard). | OBSERVED (platform admin 403) / INFERRED (others) | M27 §2.4; FR-M17-05 |
| FR-M17-103 | FR-L06-03 | The shell SHALL show "Command Center" with the badge "LIVE" first in the school-admin sidebar, linking to the route in a new tab; M17 registers the route, the shell (`user-nav.ts`) renders the entry. | OBSERVED (label, badge, position) / INFERRED (href, new tab) | M27 §1.1; `user-nav.ts:222` |
| FR-M17-104 | FR-L06-04 | A school admin whose account has no school SHALL get 403 "Akses Ditolak", never platform figures: a missing scope MUST NOT mean "all schools". | REFERENCE | `CommandCenterController.php:41-49`; `StaffScope.php:128-148` |
| FR-M17-105 | FR-L06-05 | Every figure, list row and feed row on the board and in the poll response SHALL be confined to users of the viewer's school. The school SHALL be derived server-side from the session; no school id from the URL, query or body is honoured. The poll SHALL use the same scope as the page. | REFERENCE (rule); UNVERIFIED on live | `PlatformMetrics.php:49-57`; controller 93-95; test 78-106 |
| FR-M17-106 | FR-L06-06 | The board SHALL keep the M17 S2 header, footer, counters, panel order, labels and copy unchanged (no reference copy such as "sekolah anda" or "Pemantauan langsung sekolah anda" is added), with the named queries restricted to one school. "Sekolah Berdaftar" = Q-M17-SUBSCRIBED restricted to the school (1 when the school has a subscription, else 0). | INFERRED | M17 S2 + REFERENCE scope |
| FR-M17-107 | FR-L06-07 | The panel "Top Sekolah" SHALL NOT be rendered for a school admin and no school name other than the viewer's own SHALL appear on the board; the remaining panels SHALL reflow without an empty hole at 375 / 768 / 1280. | REFERENCE (hidden); PROPOSED (reflow) | controller 58-63; view 54-73 |
| FR-M17-108 | (new) | "Kirkpatrick" and "ALESA AI" SHALL use the S2 templates (FR-M17-25, 26) with every input restricted to the school: T1 = M12 Q-M12-T1 for the school's respondents, T2 accuracy, T3 engaged 30 d, T4 GPS and the insight inputs for the school. A school without data renders the template with zero values; exact empty copy UNVERIFIED. Requires owner request XR-M17-21 (M12 school filter). | INFERRED | M17 FR-M17-25/26 |
| FR-M17-109 | FR-L06-09 | The board SHALL poll `GET /api/admin/command-center/live-data` every 10 s (counter animation 800 ms, 1 s clock, failed poll keeps previous values) exactly as FR-M17-20/21, the endpoint admitting `school_admin` with the forced school scope (section 5.6). | OBSERVED (admin) / INFERRED (school admin) | M17 FR-M17-20/21 |
| FR-M17-110 | FR-L06-10 | "Live Feed" and "Top Pelajar Minggu Ini" SHALL never show a pupil of another school; the leak SHALL be tested on names and numbers, not on status codes. | REFERENCE | test 98-106, 18-23 |
| FR-M17-111 | FR-L06-11, 12 | "Aktiviti Hari Ini", "Live Feed", "Top Pelajar Minggu Ini" and "Mood Pelajar" SHALL be computed for the school's pupils with the M17 S2 rules (FR-M17-27…30) and S2 empty copy; a school with no activity renders zeros and empty states, not an error. "Pembetulan" and "Engagement" (display constants DC-M17-03 / DC-M17-05 are platform figures) follow D-L06-05 (OQ-M17-12, DECIDED provisional): zero values for "Pembetulan" ("0", "+0.0%", "0%") and the school's own computed daily answers for "Engagement"; platform constants are never shown. | INFERRED (decided, provisional) | M17 S2; reference `reportCounts`, `dailyTrend` |
| FR-M17-112 | (new) | The S2 header links SHALL work for a school admin: "← Dashboard" -> the school-admin dashboard `/admin-sekolah` (M27) and "📊 Aktiviti Harian" -> S3 alias (FR-M17-116). | OBSERVED (links for admin) / INFERRED (targets) | URS FN-M17-3.1.1; M27 §1.2 row 1 |
| FR-M17-113 | FR-L06-13 | The district officer (PPD/JPN) SHALL get 403 on the route and the poll; the national admin keeps `/admin/command-center` unchanged (whole platform, "Top Sekolah" shown); the teacher mount BR-M17-30 is unchanged. | REFERENCE (PPD 403) / OBSERVED (admin) | test 145-154; M17 §2 |
| FR-M17-114 | (new) | The school, teacher, class and pupil drill-downs S4-S7 (FR-M17-48…59) SHALL be reachable from the alias board (feed school link, pupil names, breadcrumbs) under `/admin-sekolah/command-center/school/{schoolId}`, `…/school/{schoolId}/teacher/{userId}`, `…/classroom/{classroomId}`, `…/student/{userId}`; every endpoint of §7 #6-#13 SHALL return only objects of the viewer's school (BR-M17-34); an existing id outside the school and an unknown or non-numeric id both answer 404 `NOT_FOUND` (D-L06-06; M01 global 404 page, FR-M17-07). Links and breadcrumbs stay inside the alias prefix. | INFERRED (scope, mirrors BR-M17-30); PROPOSED (paths) | M17 §7 #6-#13, §9 |
| FR-M17-115 | (new) | The page and every drill SHALL show only the school's own name and data; names of pupils and teachers are shown only for the school's own users. | REFERENCE (rule) | test 110-119 |
| FR-M17-116 | FR-L06-16 | The daily-activity board S3 SHALL be mounted at `/admin-sekolah/command-center/daily-activity` with tabs "Hari Ini / Minggu Ini / Bulan Ini" and every card computed for the school (FR-M17-35…47 with the school restriction); the school list "Sekolah" (FR-M17-41) and its drill (FR-M17-42, §7 #5) SHALL be hidden; "Sekolah Aktif" = "{0\|1} daripada 1". | REFERENCE (scope, hidden card); PROPOSED (URL) | view daily 92-111; test 130-141 |
| FR-M17-117 | FR-L06-14 | The alias screens SHALL meet FR-M17-33, 99 and 100 (no clipping, no horizontal page scroll at 375 / 768 / 1280, text at least 12 px). | PROPOSED (approved M17 deviations DV-M17-01, 25) | M17 §10 |
| FR-M17-118 | FR-L06-15 | Seeds and docs SHALL use fictitious school and person names only; no real person's name from the reference or live appears in docs, seeds or repo. | PROPOSED (CLAUDE.md §6 constraint) | CLAUDE.md §6 |

Count: **18 FRs** (FR-M17-101…118): 8 carried unchanged, 6 reworded, 4 new (108, 112, 114, 115). Dropped: FR-L06-08 (reference copy, see audit m-05).

### 5.4 Acceptance criteria (Given/When/Then)

Fixture: fictitious "SMK Contoh A" (3 answers by pupil "Pelajar Contoh A1", subscribed) and "SMK Contoh B" (5 answers by "Pelajar Contoh B1"); A's admin "Admin Contoh A". Pattern of REFERENCE test 38-74.

| ID | Story / FR | Criterion |
|---|---|---|
| AC-36.1 | US-36 / FR-101, 103 | Given a signed-in school admin, when the user clicks "Command Center" in the sidebar, then `/admin-sekolah/command-center` opens in a new tab with the header "PRESTASIPLUS COMMAND CENTER", the "LIVE" pill and a ticking clock. |
| AC-36.2 | US-36 / FR-103 | Given the school-admin sidebar, when it renders, then "Command Center" with the badge "LIVE" is the first item. |
| AC-36.3 | US-36 / FR-117 | Given 375, 768 and 1280 viewports, when the board renders, then there is no page-level horizontal scroll, no clipped panel and no text under 12 px. |
| AC-37.1 | US-37 / FR-105, 106 | Given the fixture, when A's admin opens the board, then "Soalan Dijawab" = 3, "Pelajar Berdaftar" = A's pupil count and "Sekolah Berdaftar" = 1. |
| AC-37.2 | US-37 / FR-110, 115 | Given the fixture, when A's admin loads the board and the poll, then no pupil name and no school name of B appears in the page, the feed or the top-pupils list. |
| AC-37.3 | US-37 / FR-105 | Given A's admin, when the poll runs after 10 s, then the counters still equal A's figures (not platform). |
| AC-37.4 | US-37 / FR-107 | Given A's admin, when the board renders, then "Top Sekolah" is absent and the remaining panels leave no empty hole at 375 / 768 / 1280. |
| AC-37.5 | US-37 / FR-108 | Given the fixture, when A's admin views "Kirkpatrick" and "ALESA AI", then every input equals A's figures (school count 1 or 0 per subscription, A's accuracy), not platform figures. |
| AC-37.6 | US-37 / FR-105 | Given A's admin, when the request carries `?schoolId=<B>` or `?school_id=<B>` (page or poll), then the parameter is ignored and A's figures are returned. |
| AC-38.1 | US-38 / FR-109 | Given the board is open, when 10 s pass, then `live-data` is requested again and counters and feed re-render. |
| AC-38.2 | US-38 / FR-109 | Given a poll fails, when the next render happens, then the previous values stay and no error page shows. |
| AC-39.1 | US-39 / FR-111 | Given pupils with answers this week, when the board renders, then "Top Pelajar Minggu Ini" lists A's pupils by answers (ties as FR-M17-29). |
| AC-39.2 | US-39 / FR-111 | Given a school with no activity, when the board renders, then counters show zero (or "--" per S2 copy), panels show their empty text and there is no error. |
| AC-39.3 | US-39 / FR-111 (OQ-M17-12, provisional) | Given A's admin, when "Pembetulan" renders, then it shows "0", "+0.0%", "0%" and not "899"; "Engagement" bars equal A's answers per day. |
| AC-39.4 | US-39 / FR-118 | Given the seeds and docs, when searched, then every school and person name is fictitious and no real name from the reference or live appears. |
| AC-40.1 | US-40 / FR-102 | Given the platform admin, when opening `/admin-sekolah/command-center`, then the global 403 page "Akses Ditolak" shows (as observed live). |
| AC-40.2 | US-40 / FR-104 | Given a school-admin account with no school, when opening the route or its poll, then 403 and no figure is shown. |
| AC-40.3 | US-40 / FR-113 | Given a district officer (PPD/JPN), when opening the route or its poll, then 403. |
| AC-40.4 | US-40 / FR-102 | Given a guest, when opening the route or its poll, then redirect to `/login` (401 for the API). |
| AC-40.5 | US-40 / FR-102 | Given a teacher or pupil, when opening the route, then the 403 page shows. |
| AC-40.6 | US-40 / FR-113 | Given the platform admin, when opening `/admin/command-center`, then the board shows platform figures with "Top Sekolah" (S2 unchanged). |
| AC-41.1 | US-41 / FR-114 | Given A's admin, when the user clicks A's school link in the feed, then S4 for A opens under `/admin-sekolah/command-center/school/{A}` with A's teachers. |
| AC-41.2 | US-41 / FR-114 | Given A's admin, when opening S4 of B (page or §7 #6), then the M01 global 404 page (API 404) and no B data (D-L06-06). |
| AC-41.3 | US-41 / FR-114 | Given A's admin, when opening S5 of a teacher of B (or of A's id with a B teacher), then 404. |
| AC-41.4 | US-41 / FR-114 | Given A's admin, when opening S6 of a class of B or S7 of B's pupil (page, §7 #8-#13), then 404. |
| AC-41.5 | US-41 / FR-114 | Given A's admin, when opening a drill with an unknown or non-numeric id, then the same M01 global 404 page, indistinguishable from AC-41.2. |
| AC-41.6 | US-41 / FR-112 | Given the board, when the user clicks "← Dashboard" and "📊 Aktiviti Harian", then `/admin-sekolah` and the S3 alias open. |
| AC-42.1 | US-42 / FR-116 | Given A's admin on S3, when the tab "Minggu Ini" is chosen, then figures cover A only, "Sekolah Aktif" reads "1 daripada 1" (or "0 daripada 1") and the school list is absent. |
| AC-42.2 | US-42 / FR-116 | Given A's admin, when calling `/api/command-center/daily-activity/school/{id}` (§7 #5), then 403. |

Count: **29 ACs** (AC-36.1 … AC-42.2). Each is automatable with the fixture above.

### 5.5 Non-functional

- **Security:** scope enforced server-side on page, poll and every drill endpoint; a missing scope is an error, never "all"; no school id is read from URL, query or body (SEC-M17-13). The district officer is refused. IDOR on sequential ids is closed by BR-M17-34.
- **Privacy:** minors' names appear only for the school's own pupils; seeds fictitious.
- **Performance:** poll every 10 s, aggregates only; no target figures observed (PROPOSED: follow M17).
- **Localisation:** all copy BM (live S2 copy); numbers `ms-MY` per M17; clock Asia/Kuala_Lumpur (FR-M17-20).
- **Accessibility:** replicate live (D10); no enhancements.
- **Responsive:** FR-M17-117.

### 5.6 M17 merge list (endpoint guards, §9, rules)

**BR-M17-34 (new):** school-admin scope of the Command Center component — school derived from the session user's school; a null school = 403; every object id (school, teacher, class, pupil, session, headcount config) must belong to that school else **404** (D-L06-06, same as teachers per BR-M17-30; unknown ids also 404; role refusals stay 403). INFERRED. Merged into SRS v1.13 as BR-M17-34.

**§7 endpoint guard changes** (new guard **AS** = admin, or school_admin with forced school; **ATS** = admin, teacher per BR-M17-30, or school_admin per BR-M17-34, out-of-school and unknown ids -> 404):

| # | Endpoint | Current | Proposed |
|---|---|---|---|
| 3 | `/api/admin/command-center/live-data` | A | **AS**: admit `school_admin`; ignore any client `school_id`; filter every field to the school; `topSchools` returned empty; `LiveData` shape unchanged; add 403 for no-school |
| 4 | `/api/command-center/daily-activity?period=` | A | **AS**: same forcing; school list omitted |
| 5 | `/api/command-center/daily-activity/school/{id}` | A | unchanged (A only); `school_admin` gets 403 |
| 6 | `…/school/{id}` | AT | **ATS**: `{id}` must equal the session school |
| 7 | `…/school/{sid}/teacher/{uid}` | AT | **ATS**: `{sid}` = session school and `{uid}` a teacher of it (DV-M17-22 rule) |
| 8 | `…/classroom/{id}` | AT | **ATS**: class owner belongs to the school |
| 9 | `…/student/{id}` | AT | **ATS**: pupil belongs to the school |
| 10, 11 | `…/student/{id}/week`, `/subject` | AT | **ATS**: pupil belongs to the school |
| 12 | `…/session/{sessionId}` | AT | **ATS**: session's pupil belongs to the school |
| 13 | `…/headcount/{configId}` | AT | **ATS**: config's pupil belongs to the school |

**Other M17 edits:**
- §2 route table: add alias rows S2-AS `/admin-sekolah/command-center`, S3-AS `…/daily-activity`, S4-AS…S7-AS (paths in FR-M17-114), primary actor "Admin Sekolah", standalone.
- FR-M17-05 / 06: `/api/admin/command-center/live-data` and `/api/command-center/*` also accept `school_admin` (scoped); other `/api/admin/*` stay admin-only (403).
- §9 matrix: add a column or rows for Admin Sekolah: alias routes and §7 #3, #4, #6-#13 allowed (own school); §7 #5, #1, #2, #14-#18 403; `/admin/command-center` -> M01 landing / 403 (unchanged, INFERRED).
- Owner request XR-M17-21: M12 Q-M12-T1 school filter (FR-M17-108). Queries of §6.4 gain the school parameter where missing.
- SEC-M17-13: scope leak and IDOR through the alias (client school id ignored, per-object checks, tests on numbers).
- Traceability: US-36…42 -> FR-101…118; E2E-100…128.

### 5.7 Scope

- **In:** the school-admin Command Center board, its poll, the S4-S7 drills and S3 daily-activity, all scoped to one school; role gate; sidebar entry; header links.
- **Out:** the `/admin-sekolah` dashboard, picker and other M27 pages; PPD/JPN Command Center; writes of any kind; AI generation; changing M17 S2, M10 S2 or the national admin routes; cross-school cards.
- **Assumptions:** a school admin has exactly one school (M27 reading, INFERRED); M17 queries can be parameterised by school; M05/M12/M14/M08/M26 owners expose per-school data.

### 5.8 Open questions

| ID | Legacy | Question | Blocks |
|---|---|---|---|
| OQ-M17-12 | (new) | "Pembetulan" (DC-M17-03 "899") and "Engagement" (DC-M17-05) for a school admin. **DECIDED, D-L06-05:** Engagement = school's 7-day daily answers (SERVER); Pembetulan = zeros (INFERRED); constants never shown. | No |
| OQ-M17-13 | (new) | Out-of-school id: 403 or 404? **DECIDED, D-L06-06:** 404 (as BR-M17-30; unknown ids also 404). | No |
| OQ-M17-14 | OQ-L06-05 | S3 alias URL and release 1.0. **DECIDED, D-L06-07:** `/admin-sekolah/command-center/daily-activity`, release 1.0 Should (PROPOSED). | No |
| OQ-M17-15 | (new) | Target of "← Dashboard". **DECIDED, D-L06-08:** `/admin-sekolah` (INFERRED; M27 picker behaviour OQ-M27-05). | No |

OQ-L06-07 (re-run discovery when a school-admin account exists) is **removed** by D24: the server is the authority and no account is needed.

Closed by the Delivery Lead: OQ-L06-01 (D-L06-01), OQ-L06-02 (D-L06-02), OQ-L06-03 and OQ-L06-06 (D-L06-03, amended by D-L06-06), OQ-L06-04 (D-L06-04), OQ-M17-12…15 (D-L06-05…08).

---

## 6. Summary for the lead

- Reference has **no `/admin-sekolah` route**; school admins use `/admin/command-center` (plus `/live`, `/daily-activity`) with a school scope, no Top Sekolah / Aktiviti Mengikut Sekolah, and PPD refused. Only scope rules are reused; live M17 S2 layout and copy are kept.
- Addendum: 7 stories (US-M17-36…42), 18 FRs (FR-M17-101…118), 29 ACs (AC-36.1…42.2), BR-M17-34, SEC-M17-13, XR-M17-21, 4 open questions (OQ-M17-12…15, all DECIDED 2026-10-02; OQ-L06-07 removed under D24). Out-of-school ids answer 404 (D-L06-06). G1 approved 2026-10-02.

### 5.9 D24 revision (2026-10-02) — differences from the wording above

- **Tags:** REFERENCE -> SERVER; "UNVERIFIED (no school-admin account)" withdrawn; E2E-M17-100…128 are provisional only where INFERRED / PROPOSED (E2E-100, 107, 113, 119, 121…128).
- **Server-defined school-admin copy is now required** (supersedes FR-M17-106's "no reference copy" and audit m-05): sub-line "Pemantauan langsung sekolah anda" (`command-center.blade.php:12`), "Ketepatan Purata" sub-line "sekolah anda" (line 50), no "keseluruhan platform" (test 110-119), S3 title "Aktiviti Sekolah" (`command-center-daily.blade.php:9`), "Sekolah Aktif … daripada 1" (line 36).
- **Server contradicts live (live wins, not adopted):** new-tab sidebar link (server same tab, `admin/layout.blade.php:196-206`); mood labels "Okay" / "Tertekan" vs live "OK" / "Tekanan"; "Wawasan AI tidak disambung" vs live Kirkpatrick / ALESA AI; "Pembetulan Soalan: Laporan Baru / Selesai" vs live "Rekod / Purata Naik / Kadar Baik"; "Engagement (7 Hari)" bars vs live five segments (data source adopted, layout hybrid); feed 15 rows vs live 10; top pupils 8 vs 5; no links vs live links; S3 "Login" placeholder "—" vs live login tracking; "Sekolah Berdaftar" always 1 vs live subscribed-school count; staff landing `/admin` vs live `/admin-sekolah`; shared URL `/admin/command-center*` vs live `/admin-sekolah/command-center`; legacy drill redirects vs live drill-downs.
- M17 §7 guard changes listed in 5.6 (admit `school_admin`, force the school from the session).

## 7. Audit (independent, 2026-10-02)

**Method:** every REFERENCE citation (path and line) was re-read against `D:\Dev Projects\prestasiplus-reference\`; our M17 SRS (§2, §3, §7, §9, BR-M17-30), URS FN-M17-3.1.1/3.1.3, M10 S2, M27 §1.2/§2.4, roles-matrix line 28, build-plan line 114 and `user-nav.ts` were re-read.

**Results by task**

| Task | Result |
|---|---|
| 1. Citations | All controller, `PlatformMetrics`, `StaffScope`, view, helpers and test line ranges verified exact (e.g. `scope()` 41-49, `confine()` 49-57, feed limit 15 at line 112, test 98-106 / 110-119 / 130-141 / 145-154 / 156-166). Four inaccuracies fixed (m-01, m-02, m-03, m-09). |
| 2. Privacy | No personal name, username, e-mail or password in the file. Reference fixture names ("SMK Sendiri", "SMK Jiran Jauh", "Pelajar Sendiri", "Pelajar Jiran") and the seeder content are not copied; the fixture uses "SMK Contoh A/B". The seeder is cited by path only. PASS. |
| 3. Tags | Four mis-tags or untagged items fixed (m-04, m-05, m-06, m-07). Nothing unobserved is written as fact; school-scope behaviour is tagged UNVERIFIED throughout. |
| 4. Consistency with M17 / M10 | Consistent with S2 (FR-M17-20…33), S3, S4-S7 (FR-M17-48…60), BR-M17-30, §7 #6-#13, §9. Gaps found and closed in the addendum (m-07, M-01, M-02). No conflict with M10 S2 (teacher mount untouched). |
| 5. Addendum | Rewritten (section 5) with M17 ids, endpoint guard list and merge list. |

**Findings fixed in the file (Minor)**

| ID | Finding | Fix |
|---|---|---|
| m-01 | `admin/layout.blade.php:53` cited for the nav entry; line 53 is the role label, the entry is 196-206. | Citation split to 51-55 and 196-206. |
| m-02 | `web.php:1048` redirect incomplete: line 1049 (`student/{id}`) redirects too. | Added. |
| m-03 | "The only Command Center routes are `/admin/command-center`…" was inaccurate: teacher (`web.php:1749`) and PPD/JPN (`web.php:830-841`) Command Centers also exist. | Reworded to "reachable by a school admin" and the others listed. |
| m-04 | FR-L06-14 tagged OBSERVED although it is an approved M17 deviation; FR-L06-15 untagged. | Re-tagged PROPOSED (FR-M17-117, 118). |
| m-05 | FR-L06-08 made reference copy ("sekolah anda", "Pemantauan langsung sekolah anda") a requirement, contradicting D-L06-01 (replicate live S2 copy; it is not observed on live). | Dropped; FR-M17-106 forbids adding it. |
| m-06 | FR-L06-06 said "Sekolah Berdaftar SHALL show 1"; M17 defines it as Q-M17-SUBSCRIBED (subscribed schools), so an unsubscribed school gives 0. | Reworded (1 when subscribed, else 0). |
| m-07 | The S2 header links "← Dashboard" and "📊 Aktiviti Harian" (URS FN-M17-3.1.1) were missed; S3 was "blocked" although S2 links to it. | FR-M17-112 and 116 added; S3 raised from Could to Should. |
| m-08 | Stale draft status, summary counts, "Won't until observed" for drills, unknown-status column. | Updated. |
| m-09 | `GuruAnalyticsController.php:170-470` range was loose; true anchors are 177 / 342 / 708. | Anchors cited. |
| m-10 | Reference `translatedFormat('D')` makes card 13 labels locale-dependent; stated as plain "weekday abbreviation". | Noted. |

**Major findings (open, need a Delivery Lead decision; not documentation errors)**

| ID | Finding | Where handled |
|---|---|---|
| M-01 | M17 S2 "Pembetulan" and "Engagement" are documented **platform** display constants (DC-M17-03 "899", DC-M17-05). Under "every figure scoped to the viewer's school" they cannot be shown unchanged without leaking platform data, and the reference computes different things. | OQ-M17-12 — **DECIDED (provisional) 2026-10-02, D-L06-05**: zeros / own daily answers (FR-M17-111, AC-39.3). |
| M-02 | D-L06-03 says out-of-school ids answer 403 "M17 §9 style", but §9 and BR-M17-30 give teachers 404 (no existence leak); 403 reveals that an id exists (SEC-M17-04 IDOR concern). | OQ-M17-13 — **DECIDED 2026-10-02, D-L06-06**: 404; FR-M17-114, BR-M17-34, AC-41.2–41.5 updated. |

**Verdict: PASS** for evidence integrity, privacy, tagging and consistency (all Minor items fixed). The addendum was merged into M17 once the lead answered M-01 and M-02 (done 2026-10-02: D-L06-05, D-L06-06). No Blocker found.
