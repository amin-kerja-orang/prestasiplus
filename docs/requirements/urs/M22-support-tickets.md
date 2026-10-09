# M22 — Support Tickets (Tiket Bantuan) — User Requirements Specification

## 0. Document control

| Field | Value |
|---|---|
| Document | URS — M22 Support Tickets. Row L04 "Tiket Bantuan" (matrix A4; roles Murid, Guru, Admin Sekolah) plus the admin processing side "Urus Tiket". Other M22 rows (notification inbox, push, chatbot) are separate rows and not in this document |
| Version | 1.2 |
| Date | 2026-10-09 |
| Status | **v1.1 — G1 approved (user, 2026-10-09, D27).** Audit round 2 PASS (`docs/qa/audit/M22-audit.md`). OQ-M22-01 decided: admin read-only (no reply or status write path). OQ-M22-02 decided: school admin has no access to the queue. |
| Author | product-analyst (agent) |
| Source discovery | [M22-support-tickets.md](../../discovery/M22-support-tickets.md) (code-based, 2026-10-03, no browser). Evidence in this document: LIVE-OBSERVED (nav links, badge, `new_ticket` type, guest redirect; copied from the discovery §0), SERVER (reference backend, read again on 2026-10-09: `ContentController.php` lines 408-510, `Admin/ChatbotSupportController.php` lines 100-122, `resources/views/content/tiket.blade.php`, `admin/tiket.blade.php`), SERVER-DECK (searched: `present.html` and `images/present/` hold no ticket image, nothing to adopt) |
| Companion SRS | [srs/M22-support-tickets.md](../srs/M22-support-tickets.md) |
| Format templates | [M27 URS](M27-school-admin.md), [M27 SRS](../srs/M27-school-admin.md) |
| Related (owners, D12) | M01 (session user, roles, notification store DATA-M01-04 and the `pushNotification` hook, global 403/404 pages, BR-07 landing), M02 (users and schools: display name of the ticket owner), shell owner F-19 (`user-nav.ts` entries "Tiket Bantuan" and "Urus Tiket"), [design/shells.md](../../design/shells.md) (user shell for `/pusat-tuisyen/*`, admin shell for `/admin/*`), M09 (`/pusat-tuisyen/panduan`, same URL family), M23 (not involved) |

**Tags.** **LIVE** = observed on prestasiplus.my by our own earlier crawls. **SERVER** = reference backend code (D24: the spec where live is unobservable; a reconstruction by another team, live wins when it differs). **SERVER-DECK** = deck image (none exist for this module). **INFERRED** = derived, not observed. **PROPOSED** = rebuild decision. **DL** = Delivery Lead decision. **UD** = user decision.

**Evidence summary.** The page contents of `/pusat-tuisyen/tiket` and `/admin/tiket` were never captured on live. Everything about the two screens is SERVER. LIVE facts are limited to the sidebar links, the badge "2" and the notification type `new_ticket`. The `ripped/` live capture mentioned by the reference repository does not exist in the local copy. No Murid, Guru or Admin Sekolah account is observable (D24), so S1 stays SERVER for those roles.

**Change log**

| Version | Date | Change |
|---|---|---|
| 1.2 | 2026-10-09 | Test-profile selection recorded in §1.5: the reset override `ticketsProfile` and the hook `m22LoadProfile(name)` replace `profile` (owned by M02). No behaviour, copy or count changed. |
| 1.1 | 2026-10-09 | **Audit round 1 fixes (`docs/qa/audit/M22-audit.md`: 2 Major, 8 Minor, 4 Info).** AUD-M22-01: S2 date zone is not SERVER (the server prints raw UTC, `config/app.php:72`); display in Asia/Kuala_Lumpur is the D9 fix DV-M22-09 (FN-2.3.2, AC-07.2). AUD-M22-02: S1's own form posts to `/tiket` (R5), so S1 now follows R5: status `dibuka`, limits 255/5000, flash "Tiket dihantar. Pasukan sokongan akan membalas secepat mungkin." verbatim (FN-1.2.1, 1.3.2, AC-04.x); DV-M22-02 folded into DL-M22-04; DV-M22-03 rewritten (only deviation: after submit the user stays on `/pusat-tuisyen/tiket`; `/tiket` renders the same view). AUD-M22-03: `maxlength` 255/5000 PROPOSED (S1 markup has none), E2E-12 provisional in part. AUD-M22-04: S2 header cells in capitals by CSS (FN-2.3.1). AUD-M22-05/06: seed is DL-M22-11 (justified by the live badge and D11), M01 inbox difference noted, OQ-M22-03 closed. AUD-M22-07: 12 px cites D9 + DV-M17-25. AUD-M22-08: DV table holds real divergences only, with a Type column; decisions and gaps moved to §7.1 (DL-M22-xx, same numeric suffix as the former DV id). AUD-M22-09: story wording. AUD-M22-10: sidebar-active step provisional. AUD-M22-11/12: role tags, PPD clause. AUD-M22-13/14: XR-M22-01 names functions and full path. Totals: 13 stories, 38 FN, 58 AC. |
| 1.0 | 2026-10-09 | First issue. |

---

## 1. Overview

A signed-in user raises a support request ("tiket") and follows its status; platform staff see the queue of all requests. The user page lists the user's own tickets, filtered by status tabs, with an inline "Tiket Baru" form. The admin page "Tiket Sokongan" is a read-only table of the queue. A raised ticket notifies the platform admins (type `new_ticket`) and moves the red badge on the admin's sidebar item "Urus Tiket".

### 1.1 Screens and routes

| # | Route | Shell | Header and title | Roles | Outcome |
|---|---|---|---|---|---|
| S1 | `/pusat-tuisyen/tiket` (query `?status=`) | user | "Tiket Bantuan" / "Senarai aduan dan permintaan anda" (SERVER) | every signed-in role; L04 names Murid, Guru, Admin Sekolah | 200 with the viewer's own tickets |
| S2 | `/admin/tiket` (query `?status=`) | admin | page heading "Tiket Sokongan" / "Permohonan bantuan daripada pengguna." (SERVER) | platform admin only (DV-M22-07) | 200 queue; other roles denied |

Not built on purpose (DL-M22-04, global 404 page): `/pusat-tuisyen/tiket/baru`, `/tiket`, `/tiket/baru`, any ticket detail route (`/pusat-tuisyen/tiket/{id}`, `/admin/tiket/{id}`).

Tab titles (PROPOSED): "Tiket Bantuan - PRESTASIPLUS", "Tiket Sokongan - PRESTASIPLUS".

### 1.2 S1 page, top to bottom (SERVER)

1. Shell header: title "Tiket Bantuan", subtitle "Senarai aduan dan permintaan anda".
2. Green flash banner (only right after a successful create): check icon + "Tiket dihantar. Pasukan sokongan akan membalas secepat mungkin."
3. Row: "Jumlah tiket: {N}" (N = all of the viewer's tickets, unfiltered) and the gradient button "Tiket Baru" (plus icon).
4. Inline form card, hidden until the button is pressed or an error exists: title "Tiket Baru" (ticket icon), red error box (first message only), field "Subjek", field "Butiran", button "Hantar Tiket" (paper-plane icon).
5. Status tabs: "Semua", "Dibuka", "Dalam Proses", "Menunggu Balas", "Selesai", "Ditutup"; active tab dark; no counts.
6. Either the empty card (ticket icon, "Tiada tiket lagi.", link-button "Buat Tiket Pertama") or the ticket cards, newest first, no pagination: `#{id} — {subject}`, body clamped to 2 lines, clock icon + relative time, status badge; below, when a reply exists, an indigo panel "Balasan Sokongan" with the reply text (line breaks kept).

### 1.3 S2 page, top to bottom (SERVER)

1. Heading "Tiket Sokongan", sub-line "Permohonan bantuan daripada pengguna."
2. Filter chips: "Semua ({total})" then one chip "{status} ({count})" per status present in the data (raw stored value).
3. Either the empty card ("Belum ada tiket sokongan." or `Tiada tiket berstatus “{status}”.`) or a table with columns Tarikh, Pengguna, Subjek, Status, Dibalas, newest first, at most 200 rows, no row link, no action, no search, no pagination.

### 1.4 Ownership and data

M22 **owns the store `support_tickets`** (D12: tickets are not one of the named stores of other modules; the module that owns "Notifications & Support" owns it). M22 **reads** users (name of the ticket owner: M01/M02) and **writes** notifications only through the M01 contract (`pushNotification`, DATA-M01-04 is owned by M01 and extended by M22). Ticket rows carry no school; the school of a ticket is reached through its owner (not needed: the school admin has no queue, DV-M22-07).

### 1.5 Fixtures (existing accounts, M01 SRS §6.8; checked 2026-10-09)

| Persona | User | Ticket state in the base seed |
|---|---|---|
| Empty pupil | 2 `pelajar@demo.test` (Murid) | no ticket |
| Pupil with one ticket | 3 `pelajar2@demo.test` | ticket #1 `dibuka` |
| Pupil with one ticket | 4 `pelajarmaju@demo.test` | ticket #2 `dibuka` |
| Teacher | 5 `guru@demo.test` | none |
| Parent, sponsor, PPD, JPN | 6 `ibubapa@demo.test`, 7 `penaja@demo.test`, 9 `ppd@demo.test`, 10 `jpn@demo.test` | none |
| School admin | 8 `adminsekolah@demo.test` | none |
| Platform admin | 1 `admin@demo.test` | sees both tickets in the queue; badge "2" |

Base seed (DL-M22-11): exactly two tickets, both `dibuka`. The observed fact is the badge "2" (LIVE); the count is computed from these rows (D11), so the badge equals "2" by definition, not by a constant. Ids, owners, dates and texts below are fictitious and not observed.

Observed-versus-seed difference, not tuned (note only): the M01 admin inbox seed holds about 17 historical `new_ticket` items among 167 (live observation of the type, `mock/seeds/notifications.ts`), against two tickets here. Those notifications carry no ticket link; M22 does not back-fill tickets for them and does not change the M01 inbox (XR-M22-01(d)).

| id | Owner | Subject | Body | createdAt |
|---|---|---|---|---|
| 1 | 3 | Tidak dapat log masuk ke akaun | Saya cuba log masuk tetapi sistem tidak menerima kata laluan saya. | 2026-09-24T10:12:00+08:00 |
| 2 | 4 | Soalan kuiz tidak dipaparkan | Soalan Matematik Darjah 1 tidak muncul selepas saya tekan butang mula. | 2026-09-25T09:30:00+08:00 |

Test-only profiles (never in the default seed, precedent `subscriptions-extra`): `tickets-extra` adds, for user 2, tickets #3 `dibuka`, #4 `dalam_proses`, #5 `menunggu_balas`, #6 `selesai` with a two-line reply, #7 `ditutup`, #8 `dibuka` with a long body (more than 2 lines), and for user 5 ticket #9 `dibuka`. `tickets-many` adds 203 tickets of user 3 (ids 3-205; 205 in total). Project clock: 2026-09-25T15:40:00+08:00. Selection (v1.2): the reset override `ticketsProfile` (`tickets-extra` | `tickets-many`) or the hook `m22LoadProfile(name)`; the key `profile` belongs to M02.

---

## 2. Actors

| Role | Involvement | Verified |
|---|---|---|
| Murid (`student`) | S1: own tickets, create | SERVER (`auth` only); L04 |
| Guru (`teacher`) | S1: same, in the teacher's user shell | SERVER; L04 |
| Admin Sekolah (`school_admin`) | S1: same. No queue (DV-M22-07) | SERVER (S1); L04; shells.md (no "Urus Tiket" in the school admin screenshots) |
| Admin (platform) | S1 as any user (own tickets); S2 the queue; receives `new_ticket` notifications; sees the badge | SERVER; LIVE (link, badge, notification type) |
| PPD officer | S1 reachable (server route is `auth` only); S2 denied (403 on the server too) | SERVER |
| Parent, sponsor, JPN officer | S1 reachable; S2 denied. The reference backend has no such roles (only `pelajar`, `guru`, `admin`, `admin_sekolah`, `pegawai_ppd`); extrapolated from the `auth`-only route and the role-free nav item | INFERRED (OQ-M22-10) |
| Guest | Redirected to `/login` | LIVE (TRACKER 2026-09-27) |

---

## 3. Functional breakdown (Epic → Feature → Function)

EL ids are the discovery element ids (S1-01…S1-13; the discovery's S3-01…S3-06 are written here as A-01…A-06 because this document names the admin queue S2; the discovery's "S2" new-ticket page is not built, DL-M22-04).

### EP-M22-1 — S1 Tiket Bantuan (user)

**FT-M22-1.1 Route, shell, titles**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M22-1.1.1 | Route `/pusat-tuisyen/tiket` renders S1 in the user shell for every signed-in role. | S1 | all | LIVE (URL, link) / SERVER (`auth` only for the five server roles) / INFERRED (user shell, shells.md; parent, sponsor, JPN) |
| FN-M22-1.1.2 | Header title "Tiket Bantuan", subtitle "Senarai aduan dan permintaan anda"; tab title "Tiket Bantuan - PRESTASIPLUS". | S1 | all | SERVER (header) / PROPOSED (tab) |
| FN-M22-1.1.3 | Sidebar item "Tiket Bantuan" (BANTUAN, `fa-life-ring`, emerald) is active on this route. | S1 | all | LIVE (item) / INFERRED (its active state on this route is not observed; E2E step provisional) |

**FT-M22-1.2 Count and create button**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M22-1.2.1 | Flash banner "Tiket dihantar. Pasukan sokongan akan membalas secepat mungkin." (green, check icon) after a successful create; shown once, gone on reload or next navigation. | S1-01 | all | SERVER (R5 flash, the route S1's own form posts to; DL-M22-02) |
| FN-M22-1.2.2 | Line "Jumlah tiket: {N}" with N = all tickets of the viewer, whatever the active tab. | S1-02 | all | SERVER |
| FN-M22-1.2.3 | Button "Tiket Baru" (plus icon) toggles the inline form open and closed; no navigation. | S1-03 | all | SERVER |

**FT-M22-1.3 New-ticket form**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M22-1.3.1 | Form card with title "Tiket Baru" (ticket icon), hidden by default, shown when the button is pressed or when a validation error exists. | S1-04 | all | SERVER |
| FN-M22-1.3.2 | Field "Subjek": text input, required, placeholder "Ringkasan masalah atau permintaan anda". Field "Butiran": textarea of 5 rows, required, placeholder "Terangkan masalah anda dengan terperinci...". Validation limits (enforced on submit): Subjek at most 255 characters, Butiran at most 5000. The inputs also carry `maxlength` 255 and 5000. | S1-06, S1-07 | all | SERVER (labels, placeholders, rows, required, limits 255/5000 of R5) / PROPOSED (`maxlength` attributes: the S1 markup has none) |
| FN-M22-1.3.3 | Button "Hantar Tiket" (paper-plane icon) creates the ticket for the signed-in user with status `dibuka`. | S1-08 | all | SERVER (R5) |
| FN-M22-1.3.4 | On a validation error the form stays open, the typed values are kept, and a red box shows the first error message only. | S1-05 | all | SERVER (first message) / PROPOSED (BM copy, OQ-M22-08) |
| FN-M22-1.3.5 | On success the user is on `/pusat-tuisyen/tiket` without a `status` (unfiltered list), the form is closed, the banner of FN-M22-1.2.1 shows, the count grows by one and the new card is first. | S1-01 | all | SERVER (R5 redirects to `/tiket`, which renders the same view; the URL stays on `/pusat-tuisyen/tiket`, DV-M22-03) |

**FT-M22-1.4 Status tabs**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M22-1.4.1 | Tabs in order: "Semua", "Dibuka", "Dalam Proses", "Menunggu Balas", "Selesai", "Ditutup", linking to `/pusat-tuisyen/tiket` and `/pusat-tuisyen/tiket?status={key}` (`dibuka`, `dalam_proses`, `menunggu_balas`, `selesai`, `ditutup`); the active tab is dark; no counts. | S1-09 | all | SERVER (labels, keys, order; the server links to `/tiket`) / PROPOSED (target path stays `/pusat-tuisyen/tiket`, DV-M22-01) |
| FN-M22-1.4.2 | A known status key shows only that status; an unknown or empty value shows all (tab "Semua" active). | S1-09 | all | SERVER |

**FT-M22-1.5 Ticket list**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M22-1.5.1 | Empty state (no ticket at all, or none for the chosen tab): ticket icon, "Tiada tiket lagi.", link-button "Buat Tiket Pertama" (plus icon) which opens the form and scrolls to the top. One text for both cases. | S1-10 | all | SERVER |
| FN-M22-1.5.2 | One card per ticket, newest first (id descending), no pagination and no limit: title `#{id} — {subject}`, body preview clamped to 2 lines, clock icon with the relative time of `createdAt`, status badge. The card is not a link. | S1-11 | all | SERVER (anatomy) / PROPOSED (relative-time wording from the project rule) |
| FN-M22-1.5.3 | Badge label and colour: Dibuka red, Dalam Proses amber, Menunggu Balas blue, Selesai green, Ditutup slate. | S1-12 | all | SERVER |
| FN-M22-1.5.4 | When the ticket has a reply, an indigo panel "Balasan Sokongan" (reply icon) shows the text with line breaks kept; one reply, no author, no time. | S1-13 | all | SERVER |

**FT-M22-1.6 Access and scope**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M22-1.6.1 | Guest on S1 or its API goes to `/login`. | — | Guest | LIVE (TRACKER) |
| FN-M22-1.6.2 | The list, the count and the create are confined to the signed-in user; no user id from the URL, query or body is honoured. | — | all | SERVER (`where user_id = auth id`) |
| FN-M22-1.6.3 | The routes of DL-M22-04 answer the global 404 page. | — | all | PROPOSED |

### EP-M22-2 — S2 Tiket Sokongan (admin queue)

**FT-M22-2.1 Route, shell, titles**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M22-2.1.1 | Route `/admin/tiket` renders S2 in the admin shell for the platform admin. Reached from the user-shell sidebar item "Urus Tiket" (`fa-headset`, red badge). | A | Admin | LIVE (link, badge) / SERVER (page) / shells.md (admin shell for `/admin/*`) |
| FN-M22-2.1.2 | Heading "Tiket Sokongan", sub-line "Permohonan bantuan daripada pengguna."; tab title "Tiket Sokongan - PRESTASIPLUS". | A | Admin | SERVER / PROPOSED (tab) |

**FT-M22-2.2 Filter chips**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M22-2.2.1 | First chip "Semua ({total})" → `/admin/tiket`; then one chip "{status} ({count})" per status present, showing the raw stored value (for example `dibuka`), → `/admin/tiket?status={status}`; the active chip is indigo. Counts cover all tickets. | A-01 | Admin | SERVER (raw value) / PROPOSED (order = status vocabulary order, DL-M22-05) |
| FN-M22-2.2.2 | `?status=` filters the table by exact equality on the stored value; an unknown value gives the empty state with that value. | A-01 | Admin | SERVER |

**FT-M22-2.3 Table**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M22-2.3.1 | Columns: Tarikh, Pengguna, Subjek, Status, Dibalas. The header cells are displayed in capitals by CSS (`uppercase`, small text); the DOM text is as written. | A-03 | Admin | SERVER |
| FN-M22-2.3.2 | Cells: Tarikh = `createdAt` as `YYYY-MM-DD HH:mm:ss` in Asia/Kuala_Lumpur local time (the server prints the raw stored UTC value, so the zone is a D9 fix, DV-M22-09); Pengguna = the owner's name, or an em dash "—" when the owner is missing; Subjek as text; Status = the raw stored value in a grey pill; Dibalas = "Ya" when a reply exists, else "—". | A-04 | Admin | SERVER (format, cells) / PROPOSED (zone, DV-M22-09) |
| FN-M22-2.3.3 | Empty state: "Belum ada tiket sokongan." (no filter) or `Tiada tiket berstatus “{status}”.` (filter). | A-02 | Admin | SERVER |
| FN-M22-2.3.4 | Newest first by `createdAt`, at most 200 rows, no pagination, no search, no row link, no button or input in the rows or above the table other than the chips. | A-05 | Admin | SERVER |

**FT-M22-2.4 Access**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M22-2.4.1 | Only the platform admin passes; a guest goes to `/login`; every other signed-in role is denied by the router rule for `/admin/*` (shells.md §1.2: the role is sent to its landing page). | A-06 | all | PROPOSED (DV-M22-07; SERVER also admits the school admin scoped to the own school) |
| FN-M22-2.4.2 | S2 is read-only. Reply, status change, close, assign and delete do not exist. | A | Admin | SERVER (no write route); OQ-M22-01 |

### EP-M22-3 — Cross-cutting

**FT-M22-3.1 Notification to staff**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M22-3.1.1 | Creating a ticket creates one unread notification (type `new_ticket`, title "Tiket baru", category none) for every active platform admin, through M01. | — | Admin | LIVE (type, title) / INFERRED (recipients, body "Tiket sokongan baharu telah diterima." from the M01 seed) |
| FN-M22-3.1.2 | No other user is notified: not the ticket owner, not school admins, not teachers. Nothing is sent when the create is refused. | — | all | INFERRED |

**FT-M22-3.2 Sidebar badge**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M22-3.2.1 | The red count badge of "Urus Tiket" shows the number of tickets with status `dibuka` (all users). It replaces the static "2" of the shell. | — | Admin | LIVE (badge "2") / INFERRED (definition) |
| FN-M22-3.2.2 | At 0 the badge is not rendered. | — | Admin | PROPOSED |

**FT-M22-3.3 Quality**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M22-3.3.1 | No horizontal page scroll at 375 / 768 / 1280; tabs and chips wrap; the S2 table scrolls inside its own card. | — | all | PROJECT RULE (CLAUDE.md §7) |
| FN-M22-3.3.2 | All text at least 12 px (the server's 10 px badge and 11 px time are raised: D9 "unreadable text", precedent DV-M17-25; DV-M22-06). | — | all | D9 fix (precedent DV-M17-25) |
| FN-M22-3.3.3 | Loading, error and retry states follow the shared convention (SRS.md FR-G-10); no M22-specific error copy. | — | all | PROJECT RULE |
| FN-M22-3.3.4 | User text (subject, body, reply, owner name) is always shown as plain text. No real person's name in docs, seeds or tests. | — | all | PROJECT RULE (CLAUDE.md §6) |

Total: **38 Functions** (EP-1: 20, EP-2: 10, EP-3: 8).

---

## 4. User stories

| ID | Feature | MoSCoW | Story | Functions |
|---|---|---|---|---|
| US-M22-01 | FT-1.1, 1.5 | Must | As a Murid, Guru or Admin Sekolah, I want a page "Tiket Bantuan" listing my support tickets with their status, so that I know what I asked and where it stands. | FN-M22-1.1.1–1.1.3, 1.5.2, 1.5.3 |
| US-M22-02 | FT-1.5 | Must | As a user with no ticket, I want a clear empty state with a way to start, so that I know what to do. | FN-M22-1.5.1, 1.2.2 |
| US-M22-03 | FT-1.4 | Must | As a user, I want to filter my tickets by status, so that I find open or finished ones quickly. | FN-M22-1.4.1, 1.4.2 |
| US-M22-04 | FT-1.2, 1.3 | Must | As a user, I want to raise a ticket with a subject and details, so that the support team can help me. | FN-M22-1.2.1, 1.2.3, 1.3.1–1.3.5 |
| US-M22-05 | FT-1.5 | Must | As a user, I want to read the support team's reply on my ticket, so that I get my answer. | FN-M22-1.5.4 |
| US-M22-06 | FT-1.6 | Must | As a ticket author, I want my tickets visible only to me (and platform admins), and the page closed to guests, so that my requests stay private. | FN-M22-1.6.1–1.6.3 |
| US-M22-07 | FT-2.1, 2.3 | Must | As a platform admin, I want a queue of all tickets with date, user, subject, status and whether answered, so that I see what needs attention. | FN-M22-2.1.1, 2.1.2, 2.3.1–2.3.4 |
| US-M22-08 | FT-2.2 | Should | As a platform admin, I want to filter the queue by status with counts, so that I focus on one status. | FN-M22-2.2.1, 2.2.2 |
| US-M22-09 | FT-2.4 | Must | As a ticket author, I want the queue closed to every role except the platform admin, so that no one else reads my request. | FN-M22-2.4.1, 2.4.2 |
| US-M22-10 | FT-3.1 | Should | As a platform admin, I want a notification when a ticket is raised, so that I do not miss it. | FN-M22-3.1.1, 3.1.2 |
| US-M22-11 | FT-3.2 | Should | As a platform admin, I want the sidebar badge of "Urus Tiket" to show how many tickets are open, so that I see the workload at a glance. | FN-M22-3.2.1, 3.2.2 |
| US-M22-12 | FT-3.3 | Must | As a user on a phone, tablet or desktop, I want both pages to fit and be readable in Bahasa Melayu, so that I can use them anywhere. | FN-M22-3.3.1–3.3.4 |
| US-M22-13 | — | Could | As a platform admin, I want to reply to a ticket and change its status, so that tickets get answered. **Not in the baseline: the server has no write path and live is unobserved. Decision OQ-M22-01. No acceptance criteria are written until the user decides.** | — |

### Acceptance criteria

Values use the clock 2026-09-25T15:40:00+08:00 and the fixtures of §1.5. E2E runs at 375x812, 768x1024 and 1280x800.

**US-M22-01 — List**
- **AC-M22-01.1** Given `pelajar2@demo.test` at 1280 px, when I open `/pusat-tuisyen/tiket`, then the page renders in the user shell, the header reads "Tiket Bantuan" with the subtitle "Senarai aduan dan permintaan anda", and the tab title is "Tiket Bantuan - PRESTASIPLUS" (PROPOSED); the sidebar item "Tiket Bantuan" is active (INFERRED, provisional).
- **AC-M22-01.2** Given the same user, then "Jumlah tiket: 1" shows and one card reads `#1 — Tidak dapat log masuk ke akaun`.
- **AC-M22-01.3** Given the card of ticket #1, then it shows the body text, a clock icon with the relative time of 2026-09-24T10:12:00+08:00 as the project rule gives it, and a red badge "Dibuka"; clicking the card changes nothing (no link, no detail page).
- **AC-M22-01.4** Given profile `tickets-extra` and `pelajar@demo.test`, then six cards show in the order #8, #7, #6, #5, #4, #3 with no pagination, and badges "Dibuka" (red), "Ditutup" (slate), "Selesai" (green), "Menunggu Balas" (blue), "Dalam Proses" (amber), "Dibuka" (red).
- **AC-M22-01.5** Given ticket #8 with a body of more than two lines, then the preview shows at most two lines (computed line clamp 2).
- **AC-M22-01.6** Given `guru@demo.test` and `adminsekolah@demo.test`, then S1 opens with the same anatomy inside their user shell and lists only their own tickets (none in the base seed).

**US-M22-02 — Empty state**
- **AC-M22-02.1** Given `pelajar@demo.test` in the base seed, then "Jumlah tiket: 0", a ticket icon, "Tiada tiket lagi." and the link-button "Buat Tiket Pertama" show, and no card.
- **AC-M22-02.2** Given the same page scrolled down, when I press "Buat Tiket Pertama", then the form "Tiket Baru" opens and the page scrolls to the top.
- **AC-M22-02.3** Given `pelajar2@demo.test` (one ticket, status `dibuka`) and the tab "Selesai", then the same text "Tiada tiket lagi." shows with "Jumlah tiket: 1" (no separate filtered-empty copy).

**US-M22-03 — Tabs**
- **AC-M22-03.1** Given S1, then six tabs show in the order "Semua", "Dibuka", "Dalam Proses", "Menunggu Balas", "Selesai", "Ditutup"; "Semua" targets `/pusat-tuisyen/tiket`, the others `/pusat-tuisyen/tiket?status=dibuka`, `…=dalam_proses`, `…=menunggu_balas`, `…=selesai`, `…=ditutup`; no tab shows a count.
- **AC-M22-03.2** Given `tickets-extra` and `pelajar@demo.test`, when I press "Selesai", then the URL is `/pusat-tuisyen/tiket?status=selesai`, only #6 shows, the tab is dark, and the line still reads "Jumlah tiket: 6".
- **AC-M22-03.3** Given `?status=xyz`, then all six tickets show and "Semua" is the active tab.
- **AC-M22-03.4** Given any tab, when I press it, then the URL stays under `/pusat-tuisyen/tiket` (never `/tiket`).

**US-M22-04 — Create**
- **AC-M22-04.1** Given S1 on load, then the form card is not visible; when I press "Tiket Baru" it shows, and when I press it again it hides.
- **AC-M22-04.2** Given the open form, then it shows the title "Tiket Baru", the label "Subjek" with a required text input (placeholder "Ringkasan masalah atau permintaan anda"), the label "Butiran" with a required 5-row textarea (placeholder "Terangkan masalah anda dengan terperinci...") and the button "Hantar Tiket"; both inputs carry `maxlength` 255 and 5000 respectively (PROPOSED: the server markup has none, the limits are the server's validation limits).
- **AC-M22-04.3** Given `pelajar@demo.test` with Subjek "Ujian tiket" and Butiran "Butiran ujian.", when I press "Hantar Tiket", then a ticket is stored with the next id, owner 2, status `dibuka`, no reply; the URL is `/pusat-tuisyen/tiket` (no `status`), the page shows the green banner "Tiket dihantar. Pasukan sokongan akan membalas secepat mungkin.", the form is closed, "Jumlah tiket: 1", and the first card reads `#{id} — Ujian tiket` with the red badge "Dibuka".
- **AC-M22-04.4** Given the banner of AC-M22-04.3, when I reload or open another page and return, then the banner is gone.
- **AC-M22-04.5** Given a Subjek of only spaces, when I submit, then nothing is stored, the form stays open with the typed values, and a red box shows exactly one message (PROPOSED copy "Subjek diperlukan."); likewise a Butiran of only spaces (PROPOSED copy "Butiran diperlukan."); when both are empty the box shows the Subjek message only.
- **AC-M22-04.6** Given an API call with a Subjek of 256 characters or a Butiran of 5001, then it answers 422 with the field message (PROPOSED copy "Subjek tidak boleh melebihi 255 aksara." / "Butiran tidak boleh melebihi 5000 aksara.") and stores nothing; 255 and 5000 characters are accepted.
- **AC-M22-04.7** Given an API call that adds `userId`, `status` or `adminReply`, then they are ignored: the stored owner is the session user, the status `dibuka`, the reply empty.
- **AC-M22-04.8** Given a Guru and an Admin Sekolah, when each creates a ticket, then it stores under their own id and shows on their own S1.
- **AC-M22-04.9** Given a Subjek `<b>x</b> & "y"`, then the card shows exactly those characters as text and no element is created.

**US-M22-05 — Reply**
- **AC-M22-05.1** Given `tickets-extra` and ticket #6 with the reply "Terima kasih. Isu anda telah dibetulkan." and "Sila cuba semula." on two lines, then its card shows a panel with the heading "Balasan Sokongan" (reply icon) and the two lines on two lines.
- **AC-M22-05.2** Given a ticket without a reply, then no panel shows.
- **AC-M22-05.3** Given the panel, then it shows no author and no time.

**US-M22-06 — Access and scope**
- **AC-M22-06.1** Given no session, when I open `/pusat-tuisyen/tiket`, then I am sent to `/login`.
- **AC-M22-06.2** Given `pelajar2@demo.test`, then the subject of ticket #2 (owner 4) appears nowhere in the DOM or in the API response, and the count line counts only my tickets; given `pelajarmaju@demo.test`, the reverse.
- **AC-M22-06.3** Given `GET /api/tiket?userId=4` as user 3, then the response still holds user 3's tickets only.
- **AC-M22-06.4** Given `admin@demo.test`, `ibubapa@demo.test`, `penaja@demo.test`, `ppd@demo.test` and `jpn@demo.test`, when each opens S1, then it renders (INFERRED) with that user's own tickets only; `admin@demo.test` does not see the two seed tickets on S1.
- **AC-M22-06.5** Given `/pusat-tuisyen/tiket/baru`, `/pusat-tuisyen/tiket/1`, `/tiket` and `/tiket/baru`, then the global 404 page shows ("404", "🔍", "Halaman Tidak Dijumpai", "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?", "Halaman Utama", "Mula Latihan", "PRESTASIPLUS").

**US-M22-07 — Admin queue**
- **AC-M22-07.1** Given `admin@demo.test` at 1280 px, when I open `/admin/tiket`, then the admin shell renders with the heading "Tiket Sokongan" and the sub-line "Permohonan bantuan daripada pengguna."; the tab title is "Tiket Sokongan - PRESTASIPLUS" (PROPOSED).
- **AC-M22-07.2** Given the base seed, then the table has the columns Tarikh, Pengguna, Subjek, Status, Dibalas (DOM text as written, displayed in capitals: computed `text-transform: uppercase`), and two rows (dates in Asia/Kuala_Lumpur local time, the same instants as the seed `createdAt`, DV-M22-09; the raw UTC strings would be `01:30:00` and `02:12:00`): first `2026-09-25 09:30:00`, "Pelajar Maju Demo", "Soalan kuiz tidak dipaparkan", pill `dibuka`, "—"; second `2026-09-24 10:12:00`, "Pelajar Dua Demo", "Tidak dapat log masuk ke akaun", pill `dibuka`, "—".
- **AC-M22-07.3** Given `tickets-extra`, then ticket #6 shows "Ya" in Dibalas and the others "—"; the Status pill shows the raw values `dalam_proses`, `menunggu_balas`, `selesai`, `ditutup`.
- **AC-M22-07.4** Given a ticket whose owner no longer exists (test hook), then Pengguna shows "—".
- **AC-M22-07.5** Given the page, then no row is a link and there is no button, input, search box or pagination other than the chips.
- **AC-M22-07.6** Given `tickets-many` (205 tickets), then 200 rows show, the newest first, and the first chip reads "Semua (205)".
- **AC-M22-07.7** Given no ticket at all (hook), then the empty card shows "Belum ada tiket sokongan." and no table.

**US-M22-08 — Chips**
- **AC-M22-08.1** Given the base seed, then the chips read "Semua (2)" and "dibuka (2)"; the active chip is indigo.
- **AC-M22-08.2** Given `tickets-extra`, then chips show only the statuses present, in the order `dibuka`, `dalam_proses`, `menunggu_balas`, `selesai`, `ditutup`, with counts equal to the data; "Semua" equals their sum.
- **AC-M22-08.3** Given I press the chip `selesai`, then the URL is `/admin/tiket?status=selesai`, only #6 shows, and the chip counts do not change.
- **AC-M22-08.4** Given `/admin/tiket?status=xyz`, then the empty card reads `Tiada tiket berstatus “xyz”.` and "Semua" is not active.

**US-M22-09 — Queue access**
- **AC-M22-09.1** Given no session, when I open `/admin/tiket`, then I am sent to `/login`.
- **AC-M22-09.2** Given `adminsekolah@demo.test`, `guru@demo.test`, `pelajar@demo.test`, `ibubapa@demo.test`, `penaja@demo.test`, `ppd@demo.test` or `jpn@demo.test`, when I open `/admin/tiket`, then no ticket data is shown and the router sends me away as it does for every `/admin/*` page (INFERRED rule, shells.md §1.2; OQ-M22-02).
- **AC-M22-09.3** Given `GET /api/admin/tiket` and `GET /api/admin/tiket/open-count`, then a guest gets 401, every non-admin gets 403, and the platform admin gets 200.
- **AC-M22-09.4** Given the sidebar, then "Urus Tiket" shows for `admin@demo.test` only.
- **AC-M22-09.5** Given S2, then no reply, status or delete control exists.

**US-M22-10 — Notification**
- **AC-M22-10.1** Given `admin@demo.test` with unread count U, when `pelajar@demo.test` creates a ticket, then the admin has one more unread notification: type `new_ticket`, title "Tiket baru", body "Tiket sokongan baharu telah diterima." (PROPOSED), category none, unread; the unread count is U+1.
- **AC-M22-10.2** Given the same create, then `adminsekolah@demo.test`, `guru@demo.test` and the creator receive no notification.
- **AC-M22-10.3** Given a refused create (AC-M22-04.5), then no notification is created.
- **AC-M22-10.4** Given a second platform admin account (hook), then it also receives one; an inactive admin receives none.

**US-M22-11 — Badge**
- **AC-M22-11.1** Given the base seed and `admin@demo.test`, then the item "Urus Tiket" carries a red count badge "2".
- **AC-M22-11.2** Given `pelajar@demo.test` creates a ticket, then after the admin's next page load the badge reads "3"; given `tickets-extra`, the badge also counts #3, #8 and #9 ("5" in total with the base two).
- **AC-M22-11.3** Given no `dibuka` ticket (hook), then the badge is not rendered (PROPOSED).

**US-M22-12 — Responsive, readable, clean**
- **AC-M22-12.1** Given S1 and S2 at 375, 768 and 1280 px, then the document has no horizontal scroll; at 375 the S2 table scrolls inside its card only.
- **AC-M22-12.2** Given the same, then every text node is at least 12 px.
- **AC-M22-12.3** Given 375 px, then the tabs (S1) and chips (S2) wrap onto further lines, the count line and "Tiket Baru" stack (S1), and long subjects wrap inside the cards.
- **AC-M22-12.4** Given an API failure, then the shared error state with a retry action shows (FR-G-10, PROPOSED); while loading, the shared loading state shows.
- **AC-M22-12.5** Given the M22-owned files (URS, SRS, `src/modules/m22-*`, `e2e/m22-*`), when scanned, then they contain no real person's name and only `@demo.test` e-mails.

Totals: **13 stories (12 with criteria), 38 Functions, 58 acceptance criteria** (AC-01: 6, 02: 3, 03: 4, 04: 9, 05: 3, 06: 5, 07: 7, 08: 4, 09: 5, 10: 4, 11: 3, 12: 5).

---

## 5. UI expectations

| Screen | Behaviour notes |
|---|---|
| S1 | User shell. Order: banner (if any), count line and "Tiket Baru" button (row), form card (if open), tabs, cards or empty card. 1280/768: the count row is one line; 375: it stacks. Cards full width. Design details belong to the design phase. |
| S2 | Admin shell. Order: heading, sub-line, chips, table card or empty card. The table card scrolls horizontally inside itself when narrower than the table. |

Loading, error: FN-M22-3.3.3.

---

## 6. Coverage matrix (completeness proof)

Every element of the discovery (§2 of the discovery) mapped to a Function. "Not built" rows are deliberate (DL-M22-04).

| EL | Element | Function | Status |
|---|---|---|---|
| S1-01 | Flash banner | FN-M22-1.2.1 | built |
| S1-02 | "Jumlah tiket: N" | FN-M22-1.2.2 | built |
| S1-03 | Button "Tiket Baru" | FN-M22-1.2.3 | built |
| S1-04 | Inline form card | FN-M22-1.3.1 | built |
| S1-05 | Error box | FN-M22-1.3.4 | built |
| S1-06 | Field "Subjek" | FN-M22-1.3.2 | built |
| S1-07 | Field "Butiran" | FN-M22-1.3.2 | built |
| S1-08 | Button "Hantar Tiket" | FN-M22-1.3.3, 1.3.5 | built (one create endpoint with the R5 behaviour; URL stays on S1, DV-M22-03) |
| S1-09 | Status tabs | FN-M22-1.4.1, 1.4.2 | built (target path fixed, DV-M22-01) |
| S1-10 | Empty state | FN-M22-1.5.1 | built |
| S1-11 | Ticket cards | FN-M22-1.5.2 | built |
| S1-12 | Status badges | FN-M22-1.5.3 | built |
| S1-13 | Reply panel | FN-M22-1.5.4 | built |
| (disc. S2) S2-01…S2-06 | Page `/pusat-tuisyen/tiket/baru` (title "Tiket Baharu", heading "Tiket Bantuan Baharu", back link "Kembali ke Tiket Saya", label "Keterangan") | — | not built (DL-M22-04) |
| A-01 | Filter chips | FN-M22-2.2.1, 2.2.2 | built |
| A-02 | Empty states | FN-M22-2.3.3 | built |
| A-03 | Table columns | FN-M22-2.3.1 | built |
| A-04 | Row cells | FN-M22-2.3.2 | built |
| A-05 | Limits, no actions | FN-M22-2.3.4, 2.4.2 | built |
| A-06 | Access | FN-M22-2.4.1 | built (admin only, DV-M22-07) |
| R4, R5 | `/tiket` pair | — | not built (DL-M22-04) |
| Nav | Sidebar "Tiket Bantuan" | FN-M22-1.1.3 | shell-owned, exists |
| Nav | Sidebar "Urus Tiket" with badge | FN-M22-2.1.1, 3.2.1, 3.2.2 | shell-owned; badge value from M22 (XR-M22-02) |
| Notif | `new_ticket` | FN-M22-3.1.1, 3.1.2 | built through M01 |
| Gaps | Detail, reply, status change, delete, attachments, category, priority | — | not in the server, not built; OQ-M22-01 |

Unmapped elements: none. Function count: **38** (EP-1: 20, EP-2: 10, EP-3: 8), as in §3.

---

## 7. Fidelity deviations

Only intended differences from live or from the server; anything else replicates the evidence (D7). D9 applies as in M27. Server inconsistencies are reconstruction artefacts of another team, not live observations. **The table holds 6 real divergences, 4 of them D9 fixes** (DV-M22-01, 03, 06, 09); DV-M22-07 and DV-M22-10 are source conflicts. Decisions, omissions, gaps and the seed are in §7.1.

| ID | Discovery | Type | Evidence | Rebuild behaviour and alternatives | Status |
|---|---|---|---|---|---|
| DV-M22-01 | §1 R1/R4, S1-09 | D9 fix (contradictory target) | SERVER: the tabs of `/pusat-tuisyen/tiket` link to `/tiket` (R4, behind the `tiket` feature flag, fail-open ON), so a click silently moves the user to another URL. `/tiket` renders the same view (`content.tiket`). | Tabs link to `/pusat-tuisyen/tiket` and `/pusat-tuisyen/tiket?status={key}`. Alternative: build `/tiket` as a page, rejected (not in nav, not observed live; DL-M22-04). | Approved (D9, DL) |
| DV-M22-03 | §1 R5, S1-08 | D9 fix (contradictory target) | SERVER: the S1 form posts to `/tiket` (R5), which redirects to `/tiket` (R4), the same view as S1 under another URL behind the feature flag. `/tiket` is not built as a page here. | The create runs with the R5 behaviour (status `dibuka`, limits 255/5000, flash "Tiket dihantar. Pasukan sokongan akan membalas secepat mungkin." verbatim) and the user stays on `/pusat-tuisyen/tiket`, unfiltered. Nothing else differs. Alternative: redirect to `/tiket`, rejected (the page is not built, DL-M22-04). | Approved (D9, DL) |
| DV-M22-06 | M17 DV-M17-25 | D9 fix (unreadable text) | SERVER markup uses 10 px (badge) and 11 px (relative time) text. | Text at least 12 px at every width, as the project precedent DV-M17-25. | Approved (D9, precedent DV-M17-25) |
| DV-M22-07 | §2 S3-06, OQ-3 | Source conflict (SERVER vs matrix / shells) | SERVER: `/admin/tiket` is open to a school admin, scoped to the own school's users (a change of 23 Sep 2026 in the reconstruction); `pegawai_ppd` and a school admin without a school get 403 there too. The roles matrix L04 lists the school admin only for "Tiket Bantuan"; the school admin screenshots show no "Urus Tiket" item; shells.md §1.2 denies `/admin/*` to every role but the platform admin. | Queue for the platform admin only. Alternative: scoped queue for the school admin (needs a nav item, an admin-shell exception and a school-scope rule), not built unless the user decides (OQ-M22-02). | Delivery Lead default; user decision OQ-M22-02 |
| DV-M22-09 | §2 S3-04 | D9 fix (wrong value: zone) | SERVER: the date cell prints the raw stored `created_at` (`{{ $r->created_at }}` from a plain query), and `config/app.php:72` is `'timezone' => 'UTC'`, so Malaysian staff see times 8 hours behind (09:30 +08:00 prints `01:30:00`). The format `YYYY-MM-DD HH:mm:ss` and the raw status value in the pill and chips are replicated as they are (readable, not broken). | Same format, Asia/Kuala_Lumpur local time. Alternative: print UTC as the server, rejected (visual bug for the only audience). | Approved (D9, DL) |
| DV-M22-10 | §6 | Source conflict (SERVER vs LIVE) | SERVER: no notification is created; the server stores broadcasts only. LIVE: the admin inbox holds per-user `new_ticket` items. | Live wins: per-user notification through M01 (FN-M22-3.1.1). | Approved (D24, live wins) |

### 7.1 Delivery Lead decisions, omissions, gaps and seed notes (not divergences)

Ids keep the numeric suffix of the former DV rows of v1.0.

| ID | Type | Decision |
|---|---|---|
| DL-M22-02 | Decision (replicate what S1 does) | S1's own form reaches R5 (`/tiket`): status `dibuka`, limits 255 and 5000, the longer flash. These are adopted verbatim. The other server create route R3 (`/pusat-tuisyen/tiket`, stores `open`, limits 160/4000, short flash "Tiket anda telah dihantar.") is posted to only by the unlinked page `/pusat-tuisyen/tiket/baru` and is not adopted (DL-M22-04). The `open` status therefore never occurs and no fallback badge exists. The S1 markup has no `maxlength`; adding 255/5000 is PROPOSED (AC-M22-04.2). |
| DL-M22-04 | Decision (omission) | Not built, global 404: `/pusat-tuisyen/tiket/baru` (invented by the reconstruction author because "the origin's new ticket URL 404'd"; its form has other copy: title "Tiket Baharu", heading "Tiket Bantuan Baharu", back link "Kembali ke Tiket Saya", label "Keterangan"; nothing links to it), `POST /pusat-tuisyen/tiket` (R3, stores `open`), `/tiket` as a page and `/tiket/baru`. Live existence unknown (probes P4, P5, OQ-M22-06); add if a probe shows them. |
| DL-M22-05 | Decision (unspecified order) | Server chip order comes from a grouped query with no `ORDER BY` and is undefined; chips follow the vocabulary order `dibuka`, `dalam_proses`, `menunggu_balas`, `selesai`, `ditutup`. |
| DL-M22-08 | Gap | The server has no route that writes `admin_reply` or changes a status; the user page and the admin column only read them. The baseline is read-only. Replies and non-`dibuka` statuses exist only through the test hook and the `tickets-extra` profile. OQ-M22-01. |
| DL-M22-11 | Decision (seed) | The observed fact is the live badge "2" next to "Urus Tiket". CLAUDE.md §6 and D11 ask that counts are computed from the dataset, and allow a display constant only for observed figures that no definition reproduces. The definition "number of `dibuka` tickets" reproduces "2" with two rows, so the badge is computed and no constant is used. The rows themselves are not observed: ids, owners, dates and texts are fictitious (privacy) and are not tuned to anything else. Alternative if the user prefers a constant: no ticket, empty queue, badge text from a documented constant "2"; AC-M22-07.2, 08.1, 11.1 and E2E-25, 31, 41 change. The M01 inbox shows about 17 `new_ticket` items against 2 tickets: an observed-versus-seed difference that is not tuned (note in §1.5). Closed (formerly OQ-M22-03). |

---

## 8. Out of scope ("not in this version")

| Item | Reason |
|---|---|
| Ticket detail page, threaded conversation, several replies, reply by the user | Not in the server, not observed. |
| Admin reply, status change, close, assign, delete | Not in the server; OQ-M22-01 (Could). |
| Attachments, category, priority, SLA, rating, closed date, ticket number format other than the id | Not found anywhere (D22 not engaged). |
| Pagination or search on either page | Not in the server (OQ-M22-07). |
| School admin queue | DV-M22-07, OQ-M22-02. |
| Notification inbox `/notifikasi`, push, `/admin/notifications` | Other M22 rows; M01 owns the inbox. |
| Chatbot, bell | Other M22 rows, shell. |
| Real e-mail or WhatsApp to the user | Prototype; none in the server. |

---

## 9. Open questions

| ID | Question | Blocks | Default used |
|---|---|---|---|
| OQ-M22-01 | **User decision.** The server has no way to answer a ticket or change its status; the live "Urus Tiket" probably does. Should the rebuild add a minimal admin reply and status change (new scope, unobserved), or stay read-only? | Nothing for G1 (default builds the read-only pages) | Read-only as the server; US-M22-13 stays Could without ACs |
| OQ-M22-02 | **User decision.** Should a school admin open the queue (scoped to the own school) as the server allows? | Nothing | No: platform admin only (DV-M22-07) |
| OQ-M22-03 | **Closed in v1.1** as Delivery Lead decision DL-M22-11 (two fictitious `dibuka` tickets; the live badge "2" is computed from them). | — | DL-M22-11 |
| OQ-M22-04 | Live `new_ticket` notification: recipients (only platform admins here), body text, link target, and whether the owner is notified on a reply (no reply exists in the baseline). | Nothing | FN-M22-3.1.1, body copy from the M01 seed |
| OQ-M22-05 | Live page contents were never captured (discovery probes P1-P11, GET only). Any difference found later overrides this document. Not a decision. | Nothing | SERVER |
| OQ-M22-06 | Do `/pusat-tuisyen/tiket/baru` and `/tiket` exist on live? | Nothing | Not built (DL-M22-04) |
| OQ-M22-07 | Live `maxlength` and limits (server R5: 255/5000, S1 markup without `maxlength`), pagination, and whether the count line is total or filtered. | Nothing | 255/5000, none, total |
| OQ-M22-08 | BM validation copy on live (the reference has no `lang/ms`). | Nothing | PROPOSED copy in AC-M22-04.5/04.6 |
| OQ-M22-09 | Badge: counts `dibuka` only? hidden at 0? | Nothing | `dibuka` only, hidden at 0 |
| OQ-M22-10 | Parent, sponsor and JPN reach S1: extrapolated (the server has no such roles; PPD is SERVER); L04 names Murid, Guru, Admin Sekolah. | Nothing | Allowed (INFERRED); E2E provisional |
| OQ-M22-11 | Relative-time wording of the card (server uses the framework's `diffForHumans`; locale unknown). | Nothing | Project relative-time rule (BM, "{n} {unit} yang lepas") |

No open question blocks G2. OQ-M22-01 and 02 are the decisions the user may take at G1 approval.
