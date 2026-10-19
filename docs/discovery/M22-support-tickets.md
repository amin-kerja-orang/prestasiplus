# M22 Support Tickets (L04 "Tiket Bantuan", matrix A4) - code-based discovery

Scope: roles-matrix row L04 (Murid, Guru, Admin Sekolah) plus the admin processing side. Owner module M22 Notifications & Support.
Method: D24, server code is the specification, read from the LOCAL copy `D:\Dev Projects\prestasiplus-reference` (read-only). No browser used.
Date: 2026-10-03. Author: discovery agent (L04).

## 0. Provenance legend and source caveat

| Tag | Meaning |
|---|---|
| LIVE-OBSERVED | Seen on prestasiplus.my by our own earlier crawls (docs/discovery/**). Wins over everything. |
| SERVER | Read from reference backend code/migrations/tests (`backend/**`). Reconstruction, per D24 it is the spec where live is unobserved. |
| LIVE-CAPTURE | A `ripped/clone/**` HTML capture. **NONE AVAILABLE**, see below. |
| NOT FOUND | Searched, absent. |

**Critical caveat: the `ripped/` folder does not exist in the local copy.** `prestasiplus-reference/CLAUDE.md` line 15 and `README.md` mention `ripped/` (HTML clone, CSS, IA JSON) but the directory is not present (checked recursively; top level holds only `app, backend, components, database, docs, lib, scripts, tools, .planning`). So there is zero LIVE-CAPTURE evidence for this row. A code comment in `ContentController.php:31` says "Statuses per origin tiket.html tabs", proving a `tiket.html` capture existed on the author's machine, but it is not in our copy. Everything below tagged SERVER is a reconstruction by another team; wherever the live site differs, live wins (see section 9 probe list).

What IS live-observed (our crawls, M01/M05 `SHU-user-shell.json`, `_crawl.json`, `docs/discovery/00-global-ui.md`, `docs/design/shells.md`):
- Sidebar/drawer link "Tiket Bantuan", href `https://prestasiplus.my/pusat-tuisyen/tiket`, icon `fa-life-ring`, colour `text-emerald-500`, in the "Bantuan" section (red heading), shown for the admin capture and the guru / admin-sekolah screenshots; student crop inferred.
- Admin-only link "Urus Tiket" with red count badge "2", href `/admin/tiket`, icon `fa-headset`.
- Footer links in the user shell include "Tiket Bantuan".
- Notification type code `new_ticket` (title "Tiket baru", placeholder text) exists on the live admin's notification inbox (M01 SRS DATA-M01-04, OQ-8).
- docs/prd.md #60 and docs/prd-teacher.md #60 (derived from live walkthroughs, not our crawl): page `/pusat-tuisyen/tiket`, "Tiket Baru" button, status tabs Semua / Dibuka / Dalam Proses / Menunggu Balas / Selesai / Ditutup, ticket count display. Tagged LIVE-DERIVED (secondary), consistent with the server views.
- TRACKER 2026-09-27 note: M22 routes redirect guests to `/login`.
- The page contents of `/pusat-tuisyen/tiket` and `/admin/tiket` were never captured by our crawls (only the links).

## 1. Routes

All from `backend/routes/web.php` (SERVER). `auth` = Laravel session auth, guests redirected to `login`.

| # | Method + URL | Middleware / roles | Controller action | Notes |
|---|---|---|---|---|
| R1 | GET `/pusat-tuisyen/tiket` | `auth` only (group at line 1437, no role filter, so pelajar, guru, admin, admin_sekolah, pegawai_ppd all pass) | `ContentController@pusatTuisyenTiket` (line 490) | The L04 list page. Query `?status=`. Not behind a feature flag. |
| R2 | GET `/pusat-tuisyen/tiket/baru` | `auth` only | `ContentController@pusatTuisyenTiketBaru` (461) | Separate "new ticket" page. |
| R3 | POST `/pusat-tuisyen/tiket` | `auth` only | `ContentController@pusatTuisyenTiketStore` (470) | Creates ticket, redirect `/pusat-tuisyen/tiket`. |
| R4 | GET `/tiket` | `auth` + `feature:tiket` (flag, fail-open ON; if OFF redirect to role home with flash "Ciri ini tidak tersedia buat masa ini.") | `ContentController@tiket` (408) | Reconstruction's older duplicate of R1. Not in live nav. |
| R5 | POST `/tiket` | `auth` + `feature:tiket` | `ContentController@tiketStore` (430) | Redirect `/tiket`, flash differs from R3. |
| R6 | GET `/admin/tiket` | `auth` + `role:admin,admin_sekolah,pegawai_ppd` (group line 533) + school scope: `StaffScope::openedScopeOrAbort` (admin = all; admin_sekolah with school = own school's users only; admin_sekolah without school = 403; pegawai_ppd = 403) | `Admin\ChatbotSupportController@tiket` (101) | Admin queue, read-only. `?status=`. Opened to school admins 23 Sep 2026 (comment + `nav_school_scoped()` in helpers.php:171). |

**Not found (important gaps):**
- NOT FOUND: any route to view a single ticket (`/pusat-tuisyen/tiket/{id}`, `/admin/tiket/{id}`), any reply route (user or admin), any status-change/close route, any delete route, any attachment upload, any priority/category. Searched `routes/web.php`, `routes-v7.php` cache, all controllers, Filament resources (no SupportTicket resource among the 40 resources), grep of `admin_reply`, `support_tickets`, `SupportTicket` across `backend/app|routes|database|resources`.
- Consequence: in the server reconstruction the `admin_reply` column is READ (user page, admin "Dibalas" column) but **never written by any code**; statuses `dalam_proses`, `menunggu_balas`, `selesai`, `ditutup` can exist only if data is inserted by DB. So "admin processing" has no server specification beyond the list. See OQ-1.
- Admin sidebar in the reconstruction (`resources/views/admin/layout.blade.php`) has no "Urus Tiket" link; only the live site does (LIVE-OBSERVED badge "2").

## 2. Screens

### S1. Tiket Bantuan list (R1; R4 is the same markup) - SERVER

View: `resources/views/pelajar/pusat-tuisyen-tiket.blade.php` is a thin wrapper that `@include('content.tiket')`; real markup in `resources/views/content/tiket.blade.php`. Shell: `ContentController::shell()` picks `guru.layout` (with `$teacher`) for role guru, `pelajar.layout` (with `$student`, wallet stats syiling/mata/streak) for everyone else including admin, admin_sekolah, pegawai_ppd. Nav active key `tiket`.

Page chrome:
- `<title>` section: "Tiket Bantuan"; heading "Tiket Bantuan"; subheading "Senarai aduan dan permintaan anda".

Elements, top to bottom:

| ID | Element | Copy / behaviour |
|---|---|---|
| S1-01 | Flash success banner (green, check-circle icon) | Shown when session `status` set. Text from R3 or R5 (see section 5). |
| S1-02 | Ticket count line | "Jumlah tiket: **{N}**" where N = count of ALL the user's tickets (unfiltered). |
| S1-03 | Button "Tiket Baru" (red-to-rose gradient, `fa-plus`) | Toggles the `hidden` class of the inline form S1-04 (no navigation). |
| S1-04 | Inline new-ticket form card, hidden unless validation errors exist | Title "Tiket Baru" with `fa-ticket-alt` icon. |
| S1-05 | Validation error box (red, only when errors) | Shows `$errors->first()` only (single message). |
| S1-06 | Field "Subjek" | `input type=text name=subject required`, placeholder "Ringkasan masalah atau permintaan anda", old() repopulated. No maxlength attribute. |
| S1-07 | Field "Butiran" | `textarea name=body rows=5 required`, placeholder "Terangkan masalah anda dengan terperinci...". No maxlength attribute. |
| S1-08 | Submit "Hantar Tiket" (`fa-paper-plane`) | POSTs to `/tiket` (R5), NOT to `/pusat-tuisyen/tiket`, even when the page is R1. CSRF token. |
| S1-09 | Status filter tabs (links) | "Semua" -> `/tiket`; then one per status -> `/tiket?status={key}` with labels Dibuka, Dalam Proses, Menunggu Balas, Selesai, Ditutup. Active tab dark (`bg-slate-800 text-white`). Tab links go to `/tiket`, NOT `/pusat-tuisyen/tiket` (reconstruction quirk, the user is silently moved to R4 and its flag). No counts on tabs. |
| S1-10 | Empty state card | Icon `fa-ticket-alt`, text "Tiada tiket lagi.", link-button "Buat Tiket Pertama" (`fa-plus`, red) which unhides S1-04 and scrolls to top. Same text shown when a filter matches nothing (no separate filtered-empty copy). |
| S1-11 | Ticket cards (list) | One card per ticket, newest first (`orderByDesc id`), NO pagination, NO limit. Card: title `#{id} - {subject}` (the source uses an em dash between id and subject), body preview clamped to 2 lines (`line-clamp-2`), relative time with clock icon (`diffForHumans`, locale of app), status badge. |
| S1-12 | Status badge colours | dibuka red (`bg-red-100 text-red-700`), dalam_proses amber, menunggu_balas blue, selesai green, ditutup slate; label from status map; unknown status shows `ucfirst(status)` in slate-100 (this is what 'open' shows as "Open"). |
| S1-13 | Admin reply block (only when `admin_reply` non-empty) | Indigo panel, heading "Balasan Sokongan" with `fa-reply`, text preserves line breaks (`whitespace-pre-line`). Single reply only, no author, no timestamp. |

States: empty (S1-10); list (S1-11); filtered; error (S1-05, form auto-opens); success (S1-01). No loading state (server rendered). Ticket cards are not links (no detail page).

### S2. Tiket Baharu page (R2) - SERVER

View `pelajar/pusat-tuisyen-tiket-baru.blade.php`, always `pelajar.layout` (even for guru: no role branching, `$student = auth()->user()`), active key `pusat-tuisyen`. A comment says it exists because "the origin's new ticket URL 404'd", i.e. the reconstruction author invented this route; whether live has `/pusat-tuisyen/tiket/baru` is unknown (probe P4). Nothing in S1 links to it.

| ID | Element | Copy / behaviour |
|---|---|---|
| S2-01 | `<title>` "Tiket Baharu"; heading "Tiket Bantuan Baharu" | |
| S2-02 | Back link | `fa-arrow-left` + "Kembali ke Tiket Saya" -> `/pusat-tuisyen/tiket` |
| S2-03 | Error box (red, only on errors) | Bulleted list of ALL messages (differs from S1 which shows first only). |
| S2-04 | Label "Subjek" + input `name=subject maxlength=160 required` | placeholder "Contoh: Tidak boleh masuk kuiz Matematik" |
| S2-05 | Label "Keterangan" + textarea `name=body rows=6 maxlength=4000 required` | placeholder "Terangkan masalah anda..." (note label differs from S1: "Keterangan" vs "Butiran") |
| S2-06 | Submit "Hantar Tiket" (indigo) | POST `/pusat-tuisyen/tiket` (R3) |

### S3. Admin "Tiket Sokongan" queue (R6) - SERVER

View `admin/tiket.blade.php`, `admin.layout`, active `tiket`. Heading "Tiket Sokongan"; subtext "Permohonan bantuan daripada pengguna."

| ID | Element | Copy / behaviour |
|---|---|---|
| S3-01 | Filter chips | First "Semua ({total})" -> `/admin/tiket`; then one chip per DISTINCT status actually present in data (raw stored value, not the Malay label), "{status} ({count})" -> `/admin/tiket?status={urlencoded}`. Counts are school-scoped for school admin. Active chip indigo. |
| S3-02 | Empty state | "Belum ada tiket sokongan." (no filter) or `Tiada tiket berstatus "{status}".` (curly quotes) |
| S3-03 | Table columns | Tarikh, Pengguna, Subjek, Status, Dibalas |
| S3-04 | Row cells | Tarikh = raw `created_at` string (`Y-m-d H:i:s`); Pengguna = user name or em dash "-" when user missing; Subjek (escaped); Status = raw value in a pill (so shows `dibuka`, `open`, ...); Dibalas = "Ya" if `admin_reply` else em dash. |
| S3-05 | Limits | Newest first by `created_at`, hard `limit(200)`, no pagination, no search, no row link, no actions, no reply form, no status change. |
| S3-06 | Access | admin: all tickets. admin_sekolah: only tickets whose user belongs to own school (no cross-school confirmation). admin_sekolah without school and pegawai_ppd: HTTP 403. |

Because the admin screen is read-only in the reconstruction, S3 is the ONLY server spec for "Urus Tiket". Live "Urus Tiket" probably has more (reply/status). OQ-1.

## 3. Fields and validation (SERVER)

| Path | Field | Rules | Source line |
|---|---|---|---|
| R3 `/pusat-tuisyen/tiket` | subject | required, string, max:160 | ContentController 472-475 |
| R3 | body | required, string, max:4000 | |
| R5 `/tiket` | subject | required, string, max:255 | 433 |
| R5 | body | required, string, max:5000 | |
| R6 `/admin/tiket` | status (query) | free string, unvalidated, used in `where status =` | ChatbotSupportController 103 |
| R1/R4 | status (query) | must be a key of TICKET_STATUSES else treated as "" | 413, 495 |

Validation messages: framework default Laravel messages (BM translation file not inspected; unknown whether `lang/ms` exists, OQ-4). Test `FinalOriginGapsTest` asserts a POST with empty body gets validation errors.

Since the live form posts to which URL is unknown, the user-visible form on the live page `/pusat-tuisyen/tiket` has fields Subjek + Butiran (from S1) per server; the PRD only confirms "Tiket Baru" button.

## 4. Data model (SERVER)

Migration `2026_07_04_300001_create_support_tickets_table.php`, model `App\Models\SupportTicket` (`$guarded = ['id']`, `belongsTo User`).

| Column | Type | Notes |
|---|---|---|
| id | bigint PK | shown as `#id` |
| user_id | FK users, cascadeOnDelete | owner. School is reached only via users.school_id (no school_id column on ticket) |
| subject | string(255) | |
| body | text | |
| status | string, default `dibuka` | free string, no DB enum |
| admin_reply | text nullable | single reply, no author/time column |
| created_at, updated_at | timestamps | |

Status vocabulary (`ContentController::TICKET_STATUSES`, "per origin tiket.html tabs"):
`dibuka` Dibuka, `dalam_proses` Dalam Proses, `menunggu_balas` Menunggu Balas, `selesai` Selesai, `ditutup` Ditutup. Matches the live PRD tab list (LIVE-DERIVED), so these 5 are the best-supported values.

Inconsistencies in server data handling (record, do not replicate blindly; D9 candidates):
1. R3 inserts status `open` (English), not `dibuka`; the user list shows it as "Open" (fallback `ucfirst`) with a grey badge and it appears under "Semua" but under NO tab. R5 correctly inserts `dibuka`. Test `SokonganScopeTest` inserts status `baru`. So the queue chip labels depend on raw data.
2. Forms on S1 post to R5 while R3 exists for the same page.
3. Tab links and form on R1 point at R4 `/tiket`.

NOT FOUND: category, priority, assignee, attachments (so D22 not engaged), thread/messages table, ticket number format other than raw id, SLA, rating, closed_at.

Relations: user (name shown on admin side), school via user. Role scope in admin: see S3-06. Cross-user isolation on user side: `where user_id = auth id` (test `test_user_can_create_ticket_and_sees_only_own`).

## 5. Messages (exact BM copy) (SERVER)

| Where | Text |
|---|---|
| R3 success flash (shown on S1) | "Tiket anda telah dihantar." |
| R5 success flash | "Tiket dihantar. Pasukan sokongan akan membalas secepat mungkin." |
| Feature off redirect flash (R4/R5) | "Ciri ini tidak tersedia buat masa ini." |
| Empty list | "Tiada tiket lagi." / button "Buat Tiket Pertama" |
| Admin empty | "Belum ada tiket sokongan." / `Tiada tiket berstatus “{status}”.` |
| Admin 403 | framework default 403 page (copy not set by app) |
| Reply panel heading | "Balasan Sokongan" |

## 6. Notifications tied to tickets

- SERVER: NOT FOUND. No code creates a notification on ticket create, reply or status change. `grep new_ticket|chatbot_new_conversation|spaced_review` over `backend/app|database|routes` returns nothing; the reconstruction's `notifications` table is a broadcast table (`title, message, target, type nullable, recipients, sent_at`, no user_id), and per-user read state is a single `users.notifications_read_at` watermark. `/notifikasi` shows broadcasts whose target is `all|semua|{role}`.
- LIVE-OBSERVED: the live inbox of the admin account has per-user notifications with type code `new_ticket` (title "Tiket baru"), alongside `chatbot_new_conversation` and `spaced_review` (docs/discovery/M01-authentication.md line 510; SRS M01 DATA-M01-04 has `userId, type, category, title, body, readAt, createdAt`). So live notifies staff when a ticket is raised; recipient rule (which admins, school admin of the ticket owner's school?) and exact copy are not observed. The model differs from the server's broadcast table: live per-user rows vs server broadcast, so for this feature the LIVE evidence wins and the server cannot specify it. OQ-2.
- Our rebuild: `src/modules/m01-authentication/mock/seeds/notifications.ts` already seeds a `new_ticket` item with placeholder text; M22 must wire real generation on ticket create.

## 7. Our shell nav comparison (`src/shells/nav/user-nav.ts`)

| Item | Our code | Live / server | Verdict |
|---|---|---|---|
| Tiket Bantuan | line 572: id `tiket-bantuan`, `to: '/pusat-tuisyen/tiket'`, `fa-life-ring`, `text-emerald-500`, no `roles` (all roles), section "Bantuan" (red) | LIVE-OBSERVED href `/pusat-tuisyen/tiket`, same icon/colour; server guru nav uses `fa-ticket-alt` (reconstruction, ignore) | Match. |
| Urus Tiket | line 575: id `urus-tiket`, `to: '/admin/tiket'`, `fa-headset`, `text-red-400`, badge text "2" class `B_COUNT_RED`, `roles: A` (A = ['admin'] only) | LIVE-OBSERVED admin capture shows it. Server allows `admin_sekolah` into `/admin/tiket` (scoped), and `nav_school_scoped()` lists `admin/tiket`; the live admin-sekolah nav visibility of "Urus Tiket" is NOT observed (shells.md notes the school-admin screenshots show Tiket Bantuan; no Urus Tiket) | Match for admin. Decision needed on admin_sekolah (OQ-3): matrix L04 lists Admin Sekolah only for "Tiket Bantuan" (the user-side page), consistent with Urus Tiket staying admin-only in nav, yet server lets school admin open the queue by URL. |
| Badge "2" | static text; architecture/overview.md says static until M22 supplies a count | live count is dynamic, probably open-ticket count | M22 should compute it (probe P6 to see whether it changes). |
| Routes in our router | no M22 page exists yet (`src/` grep: no ticket module) | | M22 to build. |

## 8. Role matrix mapping (L04)

| Role | Entry | Server behaviour |
|---|---|---|
| Murid | sidebar/drawer Tiket Bantuan -> R1 | list own tickets, create (R3/R5) |
| Guru | same link; server renders inside guru shell | same, own tickets only |
| Admin Sekolah | same link (user-side page; shell = pelajar layout in server, our shell will decide) | can raise own tickets; separately may open R6 filtered to own school (not part of L04 nav) |
| Admin | R1 plus R6 all schools | |
| Pegawai PPD / JPN | R1 reachable; R6 403 | |

## 9. Live-probe checklist (GET-only, for the later agent; admin account unless noted)

Use only GET, no form submission, no state change, mask any personal names/emails in captures.

| ID | URL | What to capture |
|---|---|---|
| P1 | `/pusat-tuisyen/tiket` | Full page: heading/subheading, count line, "Tiket Baru" button, tabs (labels, hrefs, counts?), empty or list state, card anatomy, status badge colours, reply panel, pagination, whether form is inline or a modal; the form action URL and field names/labels/placeholders (read from DOM, do not submit). |
| P2 | `/pusat-tuisyen/tiket?status=dibuka`, `?status=dalam_proses`, `?status=menunggu_balas`, `?status=selesai`, `?status=ditutup` | tab hrefs/param name, filtered empty copy. |
| P3 | `/admin/tiket` and `/admin/tiket?status=...` | whether it is a table or cards, columns, actions (reply, change status, close), counters, search, pagination, filters, Urus Tiket badge meaning. |
| P4 | `/pusat-tuisyen/tiket/baru` | does it exist (200/404/redirect); copy if so. |
| P5 | `/tiket` | does it exist, redirect target. |
| P6 | `/admin/tiket/1`, `/pusat-tuisyen/tiket/1` | detail/thread page existence (GET only; 404 expected if none). Also look for ticket card hrefs in P1/P3 to find the real detail URL pattern. |
| P7 | `/notifikasi` | `new_ticket` item: exact title/body, type filter behaviour, link target of the item (if clickable it reveals the admin ticket URL). |
| P8 | `/admin/notifications` | any ticket-related notification types. |
| P9 | Network panel on P1/P3 (read-only observation of XHR GETs) | whether lists are fetched by JSON API (URL, shape) to match our mock API design. |
| P10 | Shell: sidebar Bantuan block, desktop and mobile drawer | already LIVE-OBSERVED; only confirm "Urus Tiket 2" badge value and whether it changes. |
| P11 | Guest GET of `/pusat-tuisyen/tiket` | redirect to `/login` (already noted in TRACKER) and whether a `redirect`/intended param is added. |

Murid, Guru and school-admin views are not observable (no accounts, D16/D24), so S1 stays SERVER for those roles.

## 10. Open questions

| ID | Question | Default if unanswered |
|---|---|---|
| OQ-1 | What does the live admin "Urus Tiket" screen do (reply, status change, close, assign)? The server has no write path at all; `admin_reply` is read-only. | Build S3 as server (read-only list) PLUS a minimal reply/status action flagged "Perlu pengesahan", only if P3 shows controls; otherwise read-only. |
| OQ-2 | Live `new_ticket` notification: who receives it, exact copy, link target, per-ticket or per-user? Is there a reverse notification to the ticket owner on reply? | Seed copy as already in M01 seeds; generate for admin users on ticket create. |
| OQ-3 | Should `admin_sekolah` see "Urus Tiket" in nav / open `/admin/tiket` (server opens it scoped to own school)? | Follow nav as observed (admin only); allow URL for school admin scoped, per SERVER. |
| OQ-4 | Validation messages in BM (lang file) not inspected; live form validation copy unknown. | Use Laravel default-equivalent BM text after probe P1 (required fields only). |
| OQ-5 | Server inconsistencies (status `open`, mixed POST/redirect targets, max 160/255 and 4000/5000) are reconstruction artefacts; propose D9 handling: new tickets always `dibuka`, one set of limits, tabs stay on `/pusat-tuisyen/tiket`. Needs live form `maxlength` from P1 before choosing 160/4000 vs 255/5000. | S2 limits (160/4000) have explicit HTML maxlength, so prefer them if P1 shows none. |
| OQ-6 | Is there a separate "Tiket Baharu" page live (P4), or only the inline toggle form? | Inline toggle (S1) only; S2 omitted if P4 is 404. |
| OQ-7 | Pagination/limit on the live list, and whether the count line is total or filtered. | Server: no pagination, total count. |
| OQ-8 | Seed data: no ticket rows observed on live; server seeds none (ReferenceSeeder has no tickets; "tiket" hits there are unrelated). D12 says never invent; seed 0 tickets (empty state "Tiada tiket lagi.") plus whatever P3 shows (admin badge "2" implies 2 open tickets exist live). | Seed exactly the number P3 shows with fictitious user names. |

## 11. Counts

- Routes: 6 (4 user-facing, 1 admin, plus the R4/R5 duplicate pair counted within); NOT FOUND routes: detail, reply, status change, delete, attachments (5 gaps).
- Screens: 3 (S1 list, S2 new page, S3 admin queue).
- Element IDs inventoried: S1 13, S2 6, S3 6 = 25.
- Fields: 2 (subject, body) x 2 forms + 1 query param on each list.
- Statuses: 5 (+ stray `open`, `baru`).
- Messages: 7.
- Tables: 1 (support_tickets, 8 columns); notifications table (broadcast) noted for context.
- Provenance split: LIVE-OBSERVED 7 facts (nav links, badge, `new_ticket` type, guest redirect), LIVE-DERIVED 1 (PRD tab list), LIVE-CAPTURE 0, SERVER all screen/field/validation/data items, NOT FOUND 5 routes + notification generation + attachments/category/priority.
- Probe URLs: 11 checklist rows.

Key source files (reference): `backend/routes/web.php` (lines 533, 805-808, 1437, 1494-1496, 1552-1553), `backend/app/Http/Controllers/ContentController.php`, `backend/app/Http/Controllers/Admin/ChatbotSupportController.php`, `backend/app/Support/StaffScope.php`, `backend/app/Http/Middleware/EnsureFeatureEnabled.php`, `backend/resources/views/content/tiket.blade.php`, `pelajar/pusat-tuisyen-tiket.blade.php`, `pelajar/pusat-tuisyen-tiket-baru.blade.php`, `admin/tiket.blade.php`, `backend/app/Models/SupportTicket.php`, `backend/database/migrations/2026_07_04_300001_create_support_tickets_table.php`, tests `ContentPagesTest`, `FinalOriginGapsTest`, `SokonganScopeTest`.
