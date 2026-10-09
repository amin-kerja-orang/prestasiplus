# M22 — Support Tickets (Tiket Bantuan) — Software Requirements Specification

## 0. Document control

| Field | Value |
|---|---|
| Document | SRS — M22 Support Tickets. Row L04 "Tiket Bantuan" (matrix A4; Murid, Guru, Admin Sekolah) and the admin queue "Urus Tiket". Other M22 rows (notification inbox, push, chatbot) are not covered |
| Version | 1.2 |
| Date | 2026-10-09 |
| Status | **v1.1 — G1 approved (user, 2026-10-09, D27).** Audit round 2 PASS (`docs/qa/audit/M22-audit.md`). OQ-M22-01 decided: admin read-only (no reply or status write path). OQ-M22-02 decided: school admin has no access to the queue. |
| Author | product-analyst (agent) |
| Source URS | [urs/M22-support-tickets.md](../urs/M22-support-tickets.md) v1.1 (13 stories, 38 Functions, 58 acceptance criteria) |
| Source discovery | [M22-support-tickets.md](../../discovery/M22-support-tickets.md); SERVER files re-read 2026-10-09: `backend/app/Http/Controllers/ContentController.php` (408-510), `Admin/ChatbotSupportController.php` (100-122), `resources/views/content/tiket.blade.php`, `admin/tiket.blade.php`. No SERVER-DECK image exists for tickets |
| Related | M01 SRS (§6.4 DATA-M01-04 notification, §6.8 seed users, `pushNotification` hook, BR-07, global 403/404), M02 (users), SRS.md (§7 envelope and errors, FR-G-04, FR-G-10), [design/shells.md](../../design/shells.md) v1.2.1 (§1.2 shell per route, §3 user shell), `src/lib/time/relative.ts` (`diffForHumans`), M27 SRS (format) |

**Tags.** O = LIVE-OBSERVED, S = SERVER, I = INFERRED, P = PROPOSED, R = PROJECT RULE. D24: the server is the spec where live is unobservable; live wins when both exist.

**Change log**

| Version | Date | Change |
|---|---|---|
| 1.2 | 2026-10-09 | **Test-profile selector (build finding).** The override key `profile` is already declared by M02 (`subscriptions-extra`) and the mock composer refuses a key declared by two plugins, so M22 profiles use the override `ticketsProfile` (`tickets-extra` or `tickets-many`) and the hook `m22LoadProfile(name)` (adds the profile rows at run time). §6.3, §6.4 and the §12 header changed; no behaviour, copy or count changed. |
| 1.1 | 2026-10-09 | **Audit round 1 fixes (`docs/qa/audit/M22-audit.md`).** AUD-M22-01: FR-33, BR-14: S2 date in Asia/Kuala_Lumpur is the D9 fix DV-M22-09 (server prints raw UTC). AUD-M22-02: S1 follows the R5 behaviour the form posts to: limits 255/5000 (FR-10, 13, BR-04, §5, §6.1, §8.2, E2E-15), flash "Tiket dihantar. Pasukan sokongan akan membalas secepat mungkin." (FR-06), stay on `/pusat-tuisyen/tiket` after submit (FR-14, DV-M22-03); DV-M22-02 folded into DL-M22-02/04. AUD-M22-03: `maxlength` PROPOSED, E2E-12 provisional in part. AUD-M22-04: S2 headers in capitals by CSS (FR-32, §10). AUD-M22-05/06: seed = DL-M22-11 (BR-17, §6.3), M01 inbox note, OQ-M22-03 closed. AUD-M22-07: 12 px cites D9 + DV-M17-25 (FR-45, NFR-07). AUD-M22-08: URS §7 holds real divergences only; the rest are DL-M22-xx. AUD-M22-10: sidebar-active step provisional (FR-04, E2E-01). AUD-M22-11/12: role tags. AUD-M22-13/14: XR-M22-01 names functions, full path. Totals: 51 FR, 18 BR, 45 E2E (10 tagged `@provisional`), 2 CHK. |
| 1.0 | 2026-10-09 | First issue. |

### 0.1 Deviations and decisions referenced here

URS §7 is authoritative. Real divergences (6): DV-M22-01 (tabs stay on `/pusat-tuisyen/tiket`), 03 (create runs the R5 behaviour, user stays on `/pusat-tuisyen/tiket`), 06 (12 px), 07 (queue for the platform admin only), 09 (S2 date in Malaysian time), 10 (per-user `new_ticket` notification, live wins). Decisions and gaps (URS §7.1): DL-M22-02 (create = R5), 04 (routes not built), 05 (chip order), 08 (no write path), 11 (two seed tickets, badge computed). Anything else replicates the evidence.

---

## 1. Scope

**In scope:** S1 `/pusat-tuisyen/tiket` (list, status tabs, inline create form, reply panel) for every signed-in role; S2 `/admin/tiket` (read-only queue with chips) for the platform admin; the store `support_tickets`; the `new_ticket` notification on create; the count behind the "Urus Tiket" badge; four mock endpoints (§7); test hooks and two test profiles.

**Not in this version:** reply, status change, close, assign, delete, detail page, thread, attachments, category, priority (OQ-M22-01); school admin queue (OQ-M22-02); pagination and search; `/pusat-tuisyen/tiket/baru`, `/tiket`, `/tiket/baru` (DL-M22-04); the notification inbox, push, broadcast and chatbot rows of M22; e-mail or WhatsApp to the user.

**Owned data:** `support_tickets` (DATA-M22-01), one owner (D12).

**Assumptions:** (1) project clock 2026-09-25T15:40:00+08:00; (2) the user shell items "Tiket Bantuan" and "Urus Tiket" exist in `src/shells/nav/user-nav.ts` (lines 572 and 575; "Urus Tiket" `roles: A` = admin only; static badge "2"); (3) the global 403/404 pages and the `/admin/*` router rule exist (M01, shells.md §1.2); (4) `pushNotification` exists (M01, `src/modules/m01-authentication/mock/hooks/notifications.ts`); (5) users 1-10 of M01 §6.8 exist with the names used here.

---

## 2. Screens & routes

| # | Route | Screen | Actor | Shell · header / tab | API (§7) |
|---|---|---|---|---|---|
| S1 | `/pusat-tuisyen/tiket` (`?status=`) | Tiket Bantuan | all signed-in roles | user · "Tiket Bantuan" / "Senarai aduan dan permintaan anda" (S) · tab "Tiket Bantuan - PRESTASIPLUS" (P) | #1, #2 |
| S2 | `/admin/tiket` (`?status=`) | Tiket Sokongan | platform admin | admin · page heading "Tiket Sokongan" / "Permohonan bantuan daripada pengguna." (S) · tab "Tiket Sokongan - PRESTASIPLUS" (P) | #3, #4 |

### 2.1 Link targets resolved against the repository (checked 2026-10-09)

| From (element) | Target | Exists? | Note |
|---|---|---|---|
| Sidebar, drawer and footer "Tiket Bantuan" (BANTUAN, `fa-life-ring`) | `/pusat-tuisyen/tiket` | nav entry yes (`user-nav.ts:572`, no role list); **route no** (no M22 module in `src/`) | S1, new |
| Sidebar "Urus Tiket" (`fa-headset`, red badge) | `/admin/tiket` | nav entry yes (`user-nav.ts:575`, admin only, static badge text "2", test `user-shell.test.ts:141`); **route no** | S2, new; badge value XR-M22-02 |
| Tabs of S1 | `/pusat-tuisyen/tiket`, `/pusat-tuisyen/tiket?status={key}` | S1 | same page |
| Chips of S2 | `/admin/tiket`, `/admin/tiket?status={status}` | S2 | same page |
| Form of S1 | none (no navigation; API call, stay on S1; the server posts to `/tiket` and redirects to `/tiket`, the same view) | — | DV-M22-03 |
| 403 / 404 page "Halaman Utama", "Mula Latihan", "Log Masuk" | `/`, `/practice`, `/login` | yes (M01, M05) | |
| Guest redirect | `/login` | yes (M01) | |
| Router rule for `/admin/*` (non-admin) | role landing page | yes (shells.md §1.2; BR-M01-07) | AC-M22-09.2 |
| Same URL family | `/pusat-tuisyen/panduan` | built (M09 S27, standalone) | no link between the two |
| `/tiket`, `/tiket/baru`, `/pusat-tuisyen/tiket/baru`, `/pusat-tuisyen/tiket/{id}`, `/admin/tiket/{id}` | none | not built on purpose | global 404 |

---

## 3. Functional requirements

| ID | Requirement | FN | AC |
|---|---|---|---|
| FR-M22-01 | The route `/pusat-tuisyen/tiket` SHALL render S1 in the user shell for every signed-in role (student, teacher, school admin, admin, PPD, parent, sponsor, JPN). (O route and link; S `auth` only for the five server roles `pelajar`, `guru`, `admin`, `admin_sekolah`, `pegawai_ppd`; I shell, and parent, sponsor, JPN, which the server does not have) | 1.1.1 | 01.1, 01.6, 06.4 |
| FR-M22-02 | The header SHALL read "Tiket Bantuan" with the subtitle "Senarai aduan dan permintaan anda". (S) | 1.1.2 | 01.1 |
| FR-M22-03 | The tab title SHALL be "Tiket Bantuan - PRESTASIPLUS". (P) | 1.1.2 | 01.1 |
| FR-M22-04 | The sidebar item "Tiket Bantuan" SHALL be active on `/pusat-tuisyen/tiket` (any query). (O item; I active state, provisional) | 1.1.3 | 01.1 |
| FR-M22-05 | S1 SHALL load with `GET /api/tiket` (§7 #1), passing `status` only when the URL has a known one. | 1.4.2 | 03.2, 03.3 |
| FR-M22-06 | After a successful create S1 SHALL show once a green banner with a check icon and the text "Tiket dihantar. Pasukan sokongan akan membalas secepat mungkin."; it SHALL NOT persist across reload or navigation. (S R5, the route S1's own form posts to; DL-M22-02) | 1.2.1 | 04.3, 04.4 |
| FR-M22-07 | S1 SHALL show "Jumlah tiket: {N}" with N the number of all tickets of the viewer, unaffected by the tab. (S) | 1.2.2 | 01.2, 02.1, 03.2 |
| FR-M22-08 | The button "Tiket Baru" (plus icon) SHALL toggle the visibility of the inline form without navigation. (S) | 1.2.3 | 04.1 |
| FR-M22-09 | The form card SHALL carry the title "Tiket Baru" (ticket icon), be hidden on load, and be visible when the button is pressed or after a validation error. (S) | 1.3.1 | 04.1, 04.2 |
| FR-M22-10 | The form SHALL hold: label "Subjek" + text input (required, placeholder "Ringkasan masalah atau permintaan anda"); label "Butiran" + textarea (5 rows, required, placeholder "Terangkan masalah anda dengan terperinci..."); button "Hantar Tiket" (paper-plane icon). Both inputs also carry `maxlength` 255 and 5000. (S labels, placeholders, rows, required; P `maxlength`: the S1 markup has none, the values are the R5 validation limits) | 1.3.2, 1.3.3 | 04.2 |
| FR-M22-11 | "Hantar Tiket" SHALL call `POST /api/tiket` (§7 #2), creating a ticket for the session user. (S) | 1.3.3 | 04.3, 04.8 |
| FR-M22-12 | On a 422 the form SHALL stay open with the typed values and a red box SHALL show the first message only, in the order Subjek then Butiran. (S first message; P BM copy, §8.2) | 1.3.4 | 04.5 |
| FR-M22-13 | The endpoint SHALL enforce BR-M22-04 (trim, required, 255 and 5000) whatever the client does. | 1.3.2 | 04.6 |
| FR-M22-14 | On success S1 SHALL be on `/pusat-tuisyen/tiket` without `status` in the URL (unfiltered list), close the form, show the banner, update the count and put the new card first. (S: R5 redirects to `/tiket`, the same view; the URL stays on S1, DV-M22-03) | 1.3.5 | 04.3 |
| FR-M22-15 | The endpoint SHALL ignore any `userId`, `status`, `adminReply`, `id`, `createdAt` in the body. (S "never trust a client-supplied status"; R) | 1.6.2 | 04.7 |
| FR-M22-16 | S1 SHALL show six tabs "Semua", "Dibuka", "Dalam Proses", "Menunggu Balas", "Selesai", "Ditutup" linking to `/pusat-tuisyen/tiket` and `/pusat-tuisyen/tiket?status={dibuka\|dalam_proses\|menunggu_balas\|selesai\|ditutup}`; the active tab dark; no counts. (S labels, keys, order; DV-M22-01) | 1.4.1 | 03.1, 03.4 |
| FR-M22-17 | A `status` in the vocabulary SHALL filter the list; any other value SHALL be treated as no filter (tab "Semua" active). (S) | 1.4.2 | 03.2, 03.3 |
| FR-M22-18 | With no ticket to show (none at all, or none for the tab) S1 SHALL show the empty card: ticket icon, "Tiada tiket lagi.", link-button "Buat Tiket Pertama" (plus icon) which opens the form and scrolls to the top. (S) | 1.5.1 | 02.1, 02.2, 02.3 |
| FR-M22-19 | Each ticket SHALL be a card, ordered by id descending, without pagination or limit: title `#{id} — {subject}` (em dash), body, clock icon + relative time, status badge. The card is not a link. (S) | 1.5.2 | 01.2, 01.3, 01.4 |
| FR-M22-20 | The body preview SHALL be clamped to 2 lines. (S) | 1.5.2 | 01.5 |
| FR-M22-21 | The relative time SHALL be the project rule `diffForHumans(createdAt, clock)` (BM, "{n} {unit} yang lepas"). (P, OQ-M22-11) | 1.5.2 | 01.3 |
| FR-M22-22 | The badge SHALL read Dibuka (red), Dalam Proses (amber), Menunggu Balas (blue), Selesai (green), Ditutup (slate). (S) | 1.5.3 | 01.4 |
| FR-M22-23 | A ticket with a non-empty `adminReply` SHALL show under its body an indigo panel with a reply icon, the heading "Balasan Sokongan" and the reply, line breaks kept, without author or time. (S) | 1.5.4 | 05.1–05.3 |
| FR-M22-24 | A guest on S1, S2 or any ticket endpoint SHALL be redirected to `/login` (API 401). (O) | 1.6.1 | 06.1, 09.1, 09.3 |
| FR-M22-25 | The list, count and create SHALL be confined to the session user; `userId` in the query or body SHALL be ignored. (S) | 1.6.2 | 06.2, 06.3 |
| FR-M22-26 | Another user's ticket SHALL NOT appear in the DOM, the API response or the count. | 1.6.2 | 06.2 |
| FR-M22-27 | `/pusat-tuisyen/tiket/baru`, `/pusat-tuisyen/tiket/{id}`, `/tiket`, `/tiket/baru` SHALL answer the global 404 page. (P, DL-M22-04) | 1.6.3 | 06.5 |
| FR-M22-28 | The route `/admin/tiket` SHALL render S2 in the admin shell for the platform admin. (O link; S page; shells.md) | 2.1.1 | 07.1 |
| FR-M22-29 | S2 SHALL show the heading "Tiket Sokongan" and the sub-line "Permohonan bantuan daripada pengguna."; tab title "Tiket Sokongan - PRESTASIPLUS" (P). (S) | 2.1.2 | 07.1 |
| FR-M22-30 | S2 SHALL show a chip "Semua ({total})" and one chip "{status} ({count})" per status present, the raw stored value, in the vocabulary order; counts SHALL cover all tickets, not the filter and not the 200 limit; the active chip indigo. (S; P order, DL-M22-05) | 2.2.1 | 08.1, 08.2 |
| FR-M22-31 | A chip SHALL link to `/admin/tiket?status={status}` (URL-encoded); the table SHALL filter by exact equality on the stored value; an unknown value SHALL give the empty state. (S) | 2.2.2 | 08.3, 08.4 |
| FR-M22-32 | The table SHALL have the columns Tarikh, Pengguna, Subjek, Status, Dibalas; the header cells are displayed in capitals by CSS (`uppercase`, small text) while the DOM text is as written. (S) | 2.3.1 | 07.2 |
| FR-M22-33 | Cells: Tarikh `YYYY-MM-DD HH:mm:ss` in Asia/Kuala_Lumpur local time; Pengguna the owner's name or "—" when missing; Subjek as text; Status the raw value in a grey pill; Dibalas "Ya" or "—". (S format and cells; P zone: the server prints the raw UTC value, `config/app.php:72`, so the zone is the D9 fix DV-M22-09) | 2.3.2 | 07.2, 07.3, 07.4 |
| FR-M22-34 | Without rows S2 SHALL show "Belum ada tiket sokongan." (no filter) or `Tiada tiket berstatus “{status}”.` (curly quotes; filter) instead of the table. (S) | 2.3.3 | 07.7, 08.4 |
| FR-M22-35 | Rows SHALL be ordered by `createdAt` descending (ties by id descending, P), at most 200; no pagination, search, row link, button or input in rows. (S) | 2.3.4 | 07.5, 07.6 |
| FR-M22-36 | Only the platform admin SHALL open S2; any other signed-in role SHALL be denied as for every `/admin/*` page. (P; DV-M22-07, OQ-M22-02) | 2.4.1 | 09.2 |
| FR-M22-37 | S2 SHALL offer no reply, status change, close, assign or delete. (S; OQ-M22-01) | 2.4.2 | 09.5 |
| FR-M22-38 | `GET /api/admin/tiket` and `GET /api/admin/tiket/open-count` SHALL answer 401 to a guest, 403 to any role but `admin`, 200 to the platform admin. | 2.4.1 | 09.3 |
| FR-M22-39 | The sidebar item "Urus Tiket" SHALL show for the platform admin only (shell rule, hidden not disabled, FR-G-04). (O; exists) | 2.1.1 | 09.4 |
| FR-M22-40 | A successful create SHALL, in the same operation, create for every active user with role `admin` one unread notification through `pushNotification`: type `new_ticket`, category null, title "Tiket baru", body "Tiket sokongan baharu telah diterima.". (O type and title; I recipients; P body from the M01 seed) | 3.1.1 | 10.1, 10.4 |
| FR-M22-41 | No other user SHALL be notified (not the creator, not school admins, not teachers), and a refused create SHALL notify nobody. (I) | 3.1.2 | 10.2, 10.3 |
| FR-M22-42 | The red count badge of "Urus Tiket" SHALL show the number of tickets with status `dibuka`, read from `GET /api/admin/tiket/open-count`, refreshed on each page load. (O badge; I definition) | 3.2.1 | 11.1, 11.2 |
| FR-M22-43 | At count 0 the badge SHALL NOT render. (P) | 3.2.2 | 11.3 |
| FR-M22-44 | S1 and S2 SHALL have no horizontal page scroll at 375 / 768 / 1280; tabs and chips wrap; the S2 table scrolls inside its card. (R) | 3.3.1 | 12.1, 12.3 |
| FR-M22-45 | Every text SHALL be at least 12 px. (D9 "unreadable text", precedent DV-M17-25; DV-M22-06) | 3.3.2 | 12.2 |
| FR-M22-46 | Loading, empty, error with retry SHALL follow FR-G-10; no M22-specific error copy. (R/P) | 3.3.3 | 12.4 |
| FR-M22-47 | Subject, body, reply and owner name SHALL render as plain text (escaped). (R; S "Escaped: user-submitted") | 3.3.4 | 04.9 |
| FR-M22-48 | No real person's name in M22 docs, seeds, tests; e-mails only `@demo.test`. (R, CLAUDE.md §6) | 3.3.4 | 12.5 |
| FR-M22-49 | Accessibility replicates the server markup (D10): labels, tabs and badges exactly as specified; no ARIA, focus or motion enhancements are added (the smooth scroll of "Buat Tiket Pertama" is the server's own). (R) | 1.3.2, 1.5.1 | — (CHK-M22-02) |
| FR-M22-50 | The same clock and seed SHALL give the same page (the relative time and dates derive from the project clock). (R) | 1.5.2 | 01.3 |
| FR-M22-51 | Test hooks and test profiles (§6.4) SHALL exist in dev and test builds only. (R, architecture C9) | — | — |

Count: **51 FRs** (FR-M22-01…51).

### 3.1 Traceability (US → FR → E2E)

| Story | FR | E2E |
|---|---|---|
| US-M22-01 | 01, 02, 03, 04, 19, 20, 21, 22, 26, 50 | 01, 02, 03, 04, 05 |
| US-M22-02 | 07, 18 | 06, 07 |
| US-M22-03 | 05, 16, 17 | 08, 09, 10 |
| US-M22-04 | 06, 08, 09, 10, 11, 12, 13, 14, 15, 47 | 11, 12, 13, 14, 15, 16, 17, 18 |
| US-M22-05 | 23 | 19 |
| US-M22-06 | 24, 25, 26, 27 | 20, 21, 22, 23 |
| US-M22-07 | 28, 29, 32, 33, 34, 35 | 24, 25, 26, 27, 28, 29, 30 |
| US-M22-08 | 30, 31, 34 | 31, 32, 33, 34 |
| US-M22-09 | 24, 36, 37, 38, 39 | 28, 35, 36, 37 |
| US-M22-10 | 40, 41 | 38, 39, 40 |
| US-M22-11 | 42, 43 | 41, 42 |
| US-M22-12 | 44, 45, 46, 48, 49 | 43, 44, 45, CHK-M22-01, CHK-M22-02 |
| US-M22-13 | — | — (no criteria) |

---

## 4. Business rules

| ID | Rule | Source |
|---|---|---|
| BR-M22-01 | **Ownership.** M22 is the only writer and reader of `support_tickets`; no other module reads or writes it. Others reach tickets only through the endpoints of §7. | D12 |
| BR-M22-02 | **Status vocabulary.** Five values: `dibuka` "Dibuka", `dalam_proses` "Dalam Proses", `menunggu_balas` "Menunggu Balas", `selesai` "Selesai", `ditutup` "Ditutup". Default and only value at creation: `dibuka` (R5; the `open` of the unreachable R3 is not adopted). No other value can be stored. | S `TICKET_STATUSES` ("per origin tiket.html tabs"); DL-M22-02 |
| BR-M22-03 | **Create.** `userId` = session user; `status` = `dibuka`; `adminReply` = null; `id` = the next integer after the highest existing id; `createdAt` = `updatedAt` = clock now. The school is not stored. | S; P (id source) |
| BR-M22-04 | **Validation.** Both values are trimmed. `subject`: required (not empty after trimming), at most 255 characters. `body`: required, at most 5000 characters. Checked in the order subject, body; the response lists the messages of §8.2; the page shows the first. | S (`required|string|max`; framework trims; R5 limits 255/5000); DL-M22-02 |
| BR-M22-05 | **Own scope (S1).** The list, the count and the create use the session user only. | S |
| BR-M22-06 | **Count line.** "Jumlah tiket" counts all of the viewer's tickets; the status filter does not change it. | S; OQ-M22-07 |
| BR-M22-07 | **Order.** S1: id descending. S2: `createdAt` descending, ties id descending. | S; P (tie) |
| BR-M22-08 | **Filters.** S1: a `status` that is a key of BR-M22-02 filters, otherwise all. S2: any non-empty `status` filters by exact equality on the stored value. | S |
| BR-M22-09 | **Admin counts.** Per-status counts and the total cover all tickets, grouped by stored status; only statuses with at least one ticket get a chip; chips follow the vocabulary order. | S; P (order, DL-M22-05) |
| BR-M22-10 | **Admin limit.** At most 200 rows are returned; the counts are not limited. | S |
| BR-M22-11 | **Queue access.** Role `admin` only (DV-M22-07). | P; S differs |
| BR-M22-12 | **Notification.** On every successful create, one `new_ticket` notification per active `admin` user, through M01 `pushNotification` with `push: true` so the bell refreshes. Failure to notify does not undo the ticket. | O type; I |
| BR-M22-13 | **Badge.** Number of tickets with status `dibuka`, all users; hidden at 0. | O; I; P |
| BR-M22-14 | **Time.** Relative time on S1 per `src/lib/time/relative.ts`; S2 dates as `YYYY-MM-DD HH:mm:ss` in Asia/Kuala_Lumpur local time (DV-M22-09); numbers with the `ms-MY` separator (chips). | P; S (format) |
| BR-M22-15 | **Text.** Subject, body, reply and names are stored as typed (after trimming) and rendered as plain text with line breaks kept only for the reply. The body preview ignores line breaks beyond the 2-line clamp. | S |
| BR-M22-16 | **Read-only after create.** The baseline has no code path that edits, deletes, replies to or re-statuses a ticket. `adminReply` and statuses other than `dibuka` exist only through seeds, profiles and the test hook (§6.4). | S gap; OQ-M22-01 |
| BR-M22-17 | **Seed.** The default seed is the two tickets of URS §1.5, nothing else; no deck or live figure is copied; user names are the M01 demo names. | CLAUDE.md §6, D11; DL-M22-11 (the badge "2" is the only observed fact; rows, dates and texts are fictitious; the count is computed) |
| BR-M22-18 | **Privacy.** A ticket is visible to its author and to the platform admin only. | S; P |

Count: **18 BRs**.

---

## 5. Validation rules

| Input | Rule | Invalid gives |
|---|---|---|
| `status` on S1 | key of BR-M22-02 | all tickets |
| `status` on S2 | any string | empty state with that value |
| `subject` | trimmed, required, ≤ 255 | 422 `fields.subject` |
| `body` | trimmed, required, ≤ 5000 | 422 `fields.body` |
| Body keys `userId`, `status`, `adminReply`, `id`, `createdAt` | ignored | — |
| `userId`, `school`, `schoolId` in any query | ignored | — |

---

## 6. Data entities & fields

### 6.1 DATA-M22-01 SupportTicket (owner M22; store `support_tickets`)

| Field | Type | Required | Notes |
|---|---|---|---|
| id | integer | yes | shown as `#{id}`; seeds 1, 2; new = max + 1 |
| userId | integer | yes | owner → User.id (M01/M02); the ticket is deleted with its user (S `cascadeOnDelete`; the mock has no user deletion, the orphan hook covers the display rule) |
| subject | string ≤ 255 | yes | |
| body | string ≤ 5000 | yes | |
| status | enum of BR-M22-02 | yes | default `dibuka` (S column is a free string; closed to five values here, DL-M22-02) |
| adminReply | string \| null | no | one reply, no author, no time (S) |
| createdAt, updatedAt | datetime (ISO +08:00) | yes | |

Not stored (not found on the server): school, category, priority, assignee, attachments, closed date, thread.

### 6.2 Referenced entities (owners, not redefined)

| Use | Contract | Owner |
|---|---|---|
| Session user, role | `User {id, role, isActive}` | M01 |
| Owner name on S2 | `User.name` by id | M01 / M02 |
| Recipients of `new_ticket` | active users with role `admin` | M01 / M02 (XR-M22-01) |
| Notification write | `pushNotification(userId, {type, category, title, body}, {push})` | M01 (DATA-M01-04) |
| Relative time | `diffForHumans` | shared `src/lib/time` |

### 6.3 Seeds and profiles (M22-owned store; no shared-store edit of another module)

Default seed: tickets #1 and #2 of URS §1.5 (DL-M22-11: the live badge "2" is computed from them; rows, dates and texts are fictitious; the ~17 `new_ticket` items of the M01 inbox are historical, unlinked and not back-filled, XR-M22-01(d)). Profile `tickets-extra`: URS §1.5 (adds #3-#9; #6 has `adminReply` = "Terima kasih. Isu anda telah dibetulkan." + line break + "Sila cuba semula."; #8 has a body of four sentences, more than two lines at 375 px; createdAt of #3-#9 between 2026-09-20 and 2026-09-25, ascending with id). Profile `tickets-many`: 203 more tickets for user 3 (ids 3-205), createdAt spaced one minute apart before 2026-09-25T09:00:00+08:00, ascending with id. Selected with `mock.reset({ticketsProfile: 'tickets-extra' | 'tickets-many'})` (v1.2: the key `profile` is owned by M02, so M22 declares its own override key), or at run time with the hook `m22LoadProfile(name)`; registering the table touches the shared mock registry, so the shared-tree rule applies: run `src/mock/server/__tests__/registry-boot.test.ts` and the M22 tests before merging; no half-done registry edit stays in the tree.

### 6.4 Test hooks (dev and test builds only, FR-M22-51)

| Hook (PROPOSED names) | Purpose |
|---|---|
| `setTicketState(id, {status?, adminReply?})` | Give a ticket a reply or another status (the baseline has no write path, BR-M22-16). Test builds only. |
| `orphanTicketOwner(id)` | Point a ticket to a missing user, to test the "—" cell (AC-M22-07.4). |
| `clearTickets()` | Remove all tickets (AC-M22-07.7, 11.3). |
| `addAdminUser({isActive})` | Create another `admin` user through the M01 mock store (AC-M22-10.4); writes through M01 only. |
| `m22LoadProfile(name)` | Add the rows of `tickets-extra` or `tickets-many` at run time (v1.2); an unknown name throws. |

### 6.5 Named queries (M22)

| Name | Definition |
|---|---|
| Q-M22-USER(userId, status?) | tickets of `userId`, filtered by a vocabulary `status`, id descending; plus `total` = all tickets of `userId`. |
| Q-M22-QUEUE(status?) | rows of all tickets filtered by exact `status`, `createdAt` descending then id descending, first 200, each with the owner's name or null; plus `counts` = grouped by status over all tickets, in vocabulary order; `total` = their sum. |
| Q-M22-OPEN | count of tickets with status `dibuka`. |

### 6.6 Requests to owner modules (XR-M22-nn)

| ID | To | Request | Status |
|---|---|---|---|
| XR-M22-01 | M01 | (a) Confirm `pushNotification` as the only write path for `new_ticket` and that the entity needs no link field (the M01 notification has none); (b) provide the read for the recipient list: `usersRepo.activeIdsByRole(role: UserRole): number[]` (ids of users with `isActive` true and the given role) in `src/modules/m01-authentication/mock/repository/users.ts`. No such named function exists today; until M01 adds it M22 calls the existing `usersRepo.adminList({ role: 'admin', isActive: true, pageSize })` and maps the rows to ids; (c) keep type `new_ticket` shown uppercased and category null (DATA-M01-04, OQ-8): M22 adds no new type; (d) confirm that the historical `new_ticket` items of the M01 admin inbox seed (about 17 of 167) stay as they are: they carry no ticket link and M22 does not back-fill tickets for them (observed-versus-seed difference, not tuned). | request (confirm) |
| XR-M22-02 | Shell owner (F-19) | Replace the static badge text "2" of `urus-tiket` (`user-nav.ts:575`, test `user-shell.test.ts:141`) by the value of `GET /api/admin/tiket/open-count`, hidden at 0 (FR-M22-42, 43). Until M22 is built the static "2" stays; with the default seed both agree. Update `docs/architecture/overview.md` §5 row "Sidebar count badges" when done. | request |
| XR-M22-03 | Shell owner / router | `/pusat-tuisyen/tiket` guard `auth` (every role), layout user shell; `/admin/tiket` guard `admin`, admin shell with no active menu entry (the admin shell has no "Urus Tiket" item; the item sits in the user-shell sidebar, a cross-shell link as "Ke Admin Panel"). Confirm the admin-shell header shows no title (the page carries its own heading). | request (confirm) |
| XR-M22-04 | M01 | Confirm users 3 (`pelajar2@demo.test`, "Pelajar Dua Demo") and 4 (`pelajarmaju@demo.test`, "Pelajar Maju Demo") as owners of the seed tickets and that their names stay as in M01 §6.8. | none expected |
| XR-M22-05 | Delivery Lead | Relabel the roles-matrix row L04 owner and TRACKER M22 route checklist after approval (this document covers `/pusat-tuisyen/tiket` and `/admin/tiket` only). | request |

---

## 7. Mock API endpoints

Conventions: SRS.md §7 (`{data}` envelope, lists with `meta`, errors `{error:{code, message, fields?}}`: 401 `UNAUTHORIZED`, 403 `FORBIDDEN`, 422 `VALIDATION_ERROR`). Guards: **AU** = any signed-in user, user forced from the session; **AD** = role `admin`.

| # | Method | Path | Guard | Request | Response `data` | Errors |
|---|---|---|---|---|---|---|
| 1 | GET | `/api/tiket` | AU | query `status?` (vocabulary key; other values ignored) | `Ticket[]` (id descending); `meta {total}` = all tickets of the user | 401 |
| 2 | POST | `/api/tiket` | AU | `{subject, body}` (other keys ignored) | 201 `Ticket` | 401, 422 `fields.subject` / `fields.body` |
| 3 | GET | `/api/admin/tiket` | AD | query `status?` (any string) | `QueueRow[]` (max 200); `meta {total, counts: [{status, count}]}` | 401, 403 |
| 4 | GET | `/api/admin/tiket/open-count` | AD | none | `{count}` | 401, 403 |

`Ticket` = `{ id, subject, body, status, statusLabel, adminReply: string | null, createdAt }`. `QueueRow` = `{ id, createdAt, userName: string | null, subject, status, replied: boolean }` (no body, no e-mail, no user id: data minimisation). A create also calls `pushNotification` for each active admin (BR-M22-12); it is not a separate endpoint.

---

## 8. States & messages

### 8.1 Observed copy (exact, SERVER unless marked)

S1: "Tiket Bantuan", "Senarai aduan dan permintaan anda", "Jumlah tiket: {N}", "Tiket Baru" (button and form title), "Subjek", "Butiran", placeholders "Ringkasan masalah atau permintaan anda" and "Terangkan masalah anda dengan terperinci...", "Hantar Tiket", tabs "Semua", "Dibuka", "Dalam Proses", "Menunggu Balas", "Selesai", "Ditutup", "Tiada tiket lagi.", "Buat Tiket Pertama", `#{id} — {subject}`, "Balasan Sokongan", flash "Tiket dihantar. Pasukan sokongan akan membalas secepat mungkin.". Nav (LIVE): "Tiket Bantuan", "Urus Tiket". Notification (LIVE): title "Tiket baru".

S2: "Tiket Sokongan", "Permohonan bantuan daripada pengguna.", "Semua ({total})", "{status} ({count})", "Belum ada tiket sokongan.", `Tiada tiket berstatus “{status}”.`, "Tarikh", "Pengguna", "Subjek", "Status", "Dibalas", "Ya", "—".

### 8.2 PROPOSED / INFERRED (report at G1)

| # | Where | Text or behaviour | Tag |
|---|---|---|---|
| 1 | Tab titles | "Tiket Bantuan - PRESTASIPLUS", "Tiket Sokongan - PRESTASIPLUS" | P |
| 2 | Validation messages | subject empty "Subjek diperlukan."; body empty "Butiran diperlukan."; subject long "Subjek tidak boleh melebihi 255 aksara."; body long "Butiran tidak boleh melebihi 5000 aksara." (the reference has no BM language file) | P |
| 3 | `maxlength` attributes 255 and 5000 | the S1 markup has none; the limits themselves are SERVER (R5) | P |
| 4 | Relative time wording | project rule, BM | P |
| 5 | Chip order on S2 | vocabulary order | P |
| 6 | Tie order on S2 | id descending | P |
| 7 | Queue access | platform admin only | P (DV-M22-07) |
| 8 | S1 for parent, sponsor, JPN | allowed (the server has no such roles; PPD is SERVER) | I |
| 9 | Notification | recipients active admins only; body "Tiket sokongan baharu telah diterima." | I / P |
| 10 | Badge | count of `dibuka`; hidden at 0 | I / P |
| 11 | Seed | two fictitious `dibuka` tickets | P |
| 12 | Banner persistence | once; gone on reload | I |
| 13 | Errors and loading | shared convention | P |
| 14 | `/tiket`, `/pusat-tuisyen/tiket/baru`, detail routes | global 404 | P |

### 8.3 Global pages used

- 404: "404", "🔍", "Halaman Tidak Dijumpai", "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?", "Halaman Utama" → `/`, "Mula Latihan" → `/practice`, "PRESTASIPLUS" (M27 SRS §8.3).
- 403 page: not used by M22 (a denied `/admin/*` request follows the router rule, shells.md §1.2).

---

## 9. Permissions matrix

| Route / endpoint | Murid | Guru | Admin Sekolah | Admin (platform) | Parent, sponsor, PPD, JPN | Guest |
|---|---|---|---|---|---|---|
| S1 `/pusat-tuisyen/tiket` | yes (own) | yes (own) | yes (own) | yes (own) | yes (own, I) | `/login` |
| Create a ticket (`POST /api/tiket`) | yes | yes | yes | yes | yes (I) | 401 |
| S2 `/admin/tiket` | denied | denied | denied (OQ-M22-02) | yes (all) | denied | `/login` |
| `GET /api/admin/tiket`, `/open-count` | 403 | 403 | 403 | 200 | 403 | 401 |
| Sidebar "Tiket Bantuan" | shown | shown | shown | shown | shown | n/a |
| Sidebar "Urus Tiket" and badge | hidden | hidden | hidden | shown | hidden | n/a |
| `new_ticket` notification | no | no | no | yes (active admins) | no | n/a |
| Any other ticket route (DL-M22-04) | 404 | 404 | 404 | 404 | 404 | `/login` or 404 per the router guard order |

---

## 10. Responsive behaviour (375 / 768 / 1280)

| Area | 1280 | 768 | 375 |
|---|---|---|---|
| Shell (S1) | sidebar + header | below `lg`: hamburger drawer, bottom nav (shells.md §3) | same as 768 |
| Shell (S2) | admin shell, sidebar | admin shell below `lg` as the admin shell defines | same |
| S1 count row | "Jumlah tiket" left, "Tiket Baru" right on one line | same (server breakpoint `sm` = 640) | stacked: count above, button below |
| S1 form | full width of the content | same | same; inputs full width |
| S1 tabs | one row | wrap if needed | wrap onto several lines |
| S1 cards | full width; badge right of the title | same | same; badge keeps its size, title wraps (`min-width: 0`) |
| S1 reply panel | inside the card | same | same |
| S2 chips | one row | wrap | wrap |
| S2 table | fits in the card; header cells in capitals (CSS `uppercase`, small text) | same | scrolls inside the card only (no page scroll) |
| S2 empty card | centred | same | same |

No horizontal page scroll at any size; text at least 12 px. Layouts at 768 and 375 are PROPOSED from the server breakpoints: the server markup was never observed at those widths.

---

## 11. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-M22-01 | Performance: every endpoint answers from the mock store in under 100 ms; the queue reads at most 200 rows plus grouped counts. |
| NFR-M22-02 | Localisation: all copy in Bahasa Melayu exactly as quoted; dates and numbers per BR-M22-14. |
| NFR-M22-03 | Accessibility replicates the server (D10, FR-M22-49); text at least 12 px. |
| NFR-M22-04 | Privacy: no real person's name anywhere; seeds use the M01 demo names; ticket text of real users is never copied into the repository. |
| NFR-M22-05 | Determinism: same clock and seed, same page. |
| NFR-M22-06 | Test hooks and profiles in dev and test builds only. |
| NFR-M22-07 | Responsive: S1 and S2 pass at 375 / 768 / 1280 (CLAUDE.md §7, which covers responsive layout only; the 12 px floor rests on D9 and DV-M17-25). |

### 11.1 Security notes (backend phase; security-engineer review required: user-submitted free text rendered to staff, personal data, admin-only queue, notification fan-out)

| ID | Risk | Prototype | Backend requirement |
|---|---|---|---|
| SEC-M22-01 | Reading another user's tickets by changing an id or sending `userId` (S1 list and any future detail route). | session user forced, parameter ignored | ownership enforced in the query, test on content not only status |
| SEC-M22-02 | Stored XSS: subject, body and reply are user or staff text shown to staff. | plain-text rendering | output escaping everywhere; length limits; no HTML or markdown |
| SEC-M22-03 | Queue exposure to non-admin roles (the reference opened it to school admins by URL). | role gate on route and API | role check before any data access; test with school admin, teacher, PPD, JPN |
| SEC-M22-04 | Mass assignment of `status`, `adminReply`, `userId` on create. | keys ignored | allow-list of `subject` and `body` |
| SEC-M22-05 | Spam: unlimited creates and one notification per admin per ticket (fan-out). | none (not in the reference) | throttle per user, cap open tickets per user, aggregate notifications if the volume grows; PROPOSED for the backend |
| SEC-M22-06 | Personal data in tickets (a minor may describe an incident or include contact details). | none stored beyond text | retention rule and access log for staff reads; CSRF protection on the create |
| SEC-M22-07 | Queue payload minimisation. | `QueueRow` has the owner's name only | keep the body and e-mail out of the list response; add a detail view only with its own access rule |

---

## 12. E2E test scenarios

Projects: mobile 375x812, tablet 768x1024, desktop 1280x800; every scenario runs on all three unless stated. Clock `mockInit.now` = 2026-09-25T15:40:00+08:00. Session by the fixture `loginAs(email)`; profiles by `mock.reset({ticketsProfile})` (v1.2). `@provisional` = asserts an INFERRED or PROPOSED item; excluded from the G5 gate until confirmed. "Request only" = API test, run once.

| ID | Scenario | FR | AC | Projects |
|---|---|---|---|---|
| E2E-M22-01 | `pelajar2@demo.test` opens S1: user shell, header and subtitle; the steps "Tiket Bantuan" sidebar item active (INFERRED) and tab title (PROPOSED) are `@provisional`. | 01, 02, 03, 04 | 01.1 | 1280 (shell); header at all |
| E2E-M22-02 | Same user: "Jumlah tiket: 1", card `#1 — Tidak dapat log masuk ke akaun`, body, relative time equals `diffForHumans`, red "Dibuka" badge, card not clickable. | 07, 19, 21, 22, 50 | 01.2, 01.3 | 375, 768, 1280 |
| E2E-M22-03 | Profile `tickets-extra`, `pelajar@demo.test`: six cards #8…#3, badges and colours, no pagination. | 19, 22 | 01.4 | 375, 768, 1280 |
| E2E-M22-04 | Ticket #8: preview clamped to 2 lines. | 20 | 01.5 | 375, 768, 1280 |
| E2E-M22-05 | `guru@demo.test` and `adminsekolah@demo.test` open S1: same anatomy, own tickets only. | 01, 26 | 01.6 | 375, 768, 1280 |
| E2E-M22-06 | `pelajar@demo.test`, base seed: "Jumlah tiket: 0", empty card, "Buat Tiket Pertama" opens the form and scrolls to top. | 07, 18 | 02.1, 02.2 | 375, 768, 1280 |
| E2E-M22-07 | `pelajar2@demo.test`, tab "Selesai": "Tiada tiket lagi." and "Jumlah tiket: 1". | 17, 18 | 02.3 | 375, 768, 1280 |
| E2E-M22-08 | Tabs: order, labels, hrefs, no counts. | 16 | 03.1 | 375, 768, 1280 |
| E2E-M22-09 | `tickets-extra`: press "Selesai": URL, only #6, active tab, count still 6; every tab keeps the path. | 16, 17 | 03.2, 03.4 | 375, 768, 1280 |
| E2E-M22-10 | `?status=xyz`: all tickets, "Semua" active. | 17 | 03.3 | 1280 |
| E2E-M22-11 | The form is hidden on load; the button toggles it. | 08, 09 | 04.1 | 375, 768, 1280 |
| E2E-M22-12 `@provisional` (the `maxlength` step only) | Form anatomy: title, labels, placeholders, `required`, 5 rows, button; `maxlength` 255 and 5000 (PROPOSED). | 09, 10 | 04.2 | 375, 768, 1280 |
| E2E-M22-13 | `pelajar@demo.test` creates "Ujian tiket": URL `/pusat-tuisyen/tiket`, banner "Tiket dihantar. Pasukan sokongan akan membalas secepat mungkin.", form closed, count 1, first card with "Dibuka"; reload: banner gone; stored row owner 2, `dibuka`. | 06, 11, 14 | 04.3, 04.4 | 375, 768, 1280 |
| E2E-M22-14 `@provisional` | Whitespace-only Subjek, then Butiran, then both: nothing stored, form open, values kept, one message (PROPOSED copy). | 12 | 04.5 | 375, 768, 1280 |
| E2E-M22-15 `@provisional` | Request only: Subjek 255/256 and Butiran 5000/5001 characters; 422 messages (PROPOSED copy). | 13 | 04.6 | request only |
| E2E-M22-16 | Request only: body with `userId`, `status`, `adminReply` is ignored. | 15 | 04.7 | request only |
| E2E-M22-17 | Guru and school admin each create a ticket; it shows on their own S1 only. | 11, 25 | 04.8 | 375, 768, 1280 |
| E2E-M22-18 | Subjek `<b>x</b> & "y"` shows as text; no element created. | 47 | 04.9 | 375, 768, 1280 |
| E2E-M22-19 | `tickets-extra`, ticket #6: panel "Balasan Sokongan", two lines, no author or time; a ticket without reply shows no panel. | 23 | 05.1, 05.2, 05.3 | 375, 768, 1280 |
| E2E-M22-20 | Guest on S1 goes to `/login`. | 24 | 06.1 | 375, 768, 1280 |
| E2E-M22-21 | Isolation: user 3 never sees ticket #2 (DOM and API), `?userId=4` ignored; user 4 the reverse. | 25, 26 | 06.2, 06.3 | 375, 768, 1280 |
| E2E-M22-22 `@provisional` | `admin@demo.test`, `ppd@` (SERVER roles) and `ibubapa@`, `penaja@`, `jpn@` (INFERRED roles) open S1: it renders with their own tickets (none); the admin does not see tickets #1 and #2 there. | 01, 25 | 06.4 | 1280 |
| E2E-M22-23 | `/pusat-tuisyen/tiket/baru`, `/pusat-tuisyen/tiket/1`, `/tiket`, `/tiket/baru` show the 404 page copy. | 27 | 06.5 | 375, 768, 1280 |
| E2E-M22-24 | `admin@demo.test` opens S2: admin shell, heading, sub-line; tab title `@provisional`. | 28, 29 | 07.1 | 375, 768, 1280 |
| E2E-M22-25 | Base seed table: columns and the two rows in order with dates, names, pills, "—". | 32, 33, 35 | 07.2 | 375, 768, 1280 |
| E2E-M22-26 | `tickets-extra`: "Ya" only on #6; raw pill values. | 33 | 07.3 | 1280 |
| E2E-M22-27 | Hook `orphanTicketOwner`: Pengguna shows "—". | 33 | 07.4 | 1280 |
| E2E-M22-28 | S2 has no row link, button, input, search or pagination other than the chips; no reply, status, delete control. | 35, 37 | 07.5, 09.5 | 375, 768, 1280 |
| E2E-M22-29 | `tickets-many`: 200 rows, newest first, chip "Semua (205)". | 30, 35 | 07.6 | 1280 |
| E2E-M22-30 | Hook `clearTickets`: "Belum ada tiket sokongan." | 34 | 07.7 | 375, 768, 1280 |
| E2E-M22-31 | Base seed chips "Semua (2)", "dibuka (2)"; active indigo. | 30 | 08.1 | 375, 768, 1280 |
| E2E-M22-32 | `tickets-extra` chips: present statuses only, vocabulary order, counts equal the data, total equals the sum. | 30 | 08.2 | 1280 |
| E2E-M22-33 | Press chip `selesai`: URL, only #6, counts unchanged. | 31 | 08.3 | 375, 768, 1280 |
| E2E-M22-34 | `?status=xyz`: `Tiada tiket berstatus “xyz”.` | 31, 34 | 08.4 | 1280 |
| E2E-M22-35 `@provisional` | Guest to `/login`; the seven non-admin accounts get no data and are sent away per the `/admin/*` router rule. | 24, 36 | 09.1, 09.2 | 375, 768, 1280 |
| E2E-M22-36 | Request only: `GET /api/admin/tiket` and `/open-count`: 401 guest, 403 non-admin, 200 admin. | 38 | 09.3 | request only |
| E2E-M22-37 | "Urus Tiket" visible for the admin only. | 39 | 09.4 | 1280 |
| E2E-M22-38 `@provisional` | `pelajar@demo.test` creates a ticket; the admin's unread count grows by one; the item has type `new_ticket`, title "Tiket baru", the PROPOSED body. | 40 | 10.1 | 1280 |
| E2E-M22-39 `@provisional` | The school admin, the teacher and the creator get nothing; a refused create notifies nobody. | 41 | 10.2, 10.3 | 1280 |
| E2E-M22-40 `@provisional` | Hook `addAdminUser`: an active second admin gets one, an inactive one none. | 40 | 10.4 | 1280 |
| E2E-M22-41 | Admin sidebar badge "2" on the base seed; `@provisional` part: "3" after a pupil creates a ticket, "5" under `tickets-extra`. | 42 | 11.1, 11.2 | 375, 768, 1280 |
| E2E-M22-42 `@provisional` | Hook `clearTickets`: badge not rendered. | 43 | 11.3 | 1280 |
| E2E-M22-43 | No horizontal page scroll on S1 and S2; tabs and chips wrap; count row stacks at 375; table scrolls inside its card. | 44 | 12.1, 12.3 | 375, 768, 1280 |
| E2E-M22-44 | Every text node at least 12 px on S1 and S2 (cards, badges, time, chips, table). | 45 | 12.2 | 375, 768, 1280 |
| E2E-M22-45 `@provisional` | Endpoint forced to 500: the shared error state with retry. | 46 | 12.4 | 375, 768, 1280 |

Static checks (unit tests, not E2E): **CHK-M22-01** scans M22-owned files (M22 URS/SRS, `src/modules/m22-*`, `e2e/m22-*`): no e-mail other than `@demo.test`, no real person's name (the scan list lives outside the repository). **CHK-M22-02** (FR-M22-49): the S1 and S2 templates carry no `aria-*` attribute that the server markup lacks.

Totals: **45 E2E scenarios** (15, 16, 36 are request only and run once; several others run on 1280 only as listed), of which **10 are tagged `@provisional`** (12 in part, 14, 15, 22, 35, 38, 39, 40, 42, 45) and 3 carry a provisional sub-step (01 sidebar-active and tab title, 24 tab title, 41 the "3" and "5" values), plus 2 static checks.

---

## 13. Open questions

URS §9 is authoritative. Status:

| ID | Topic | Blocks |
|---|---|---|
| OQ-M22-01 | **User decision.** Admin reply and status change: add (new, unobserved scope) or stay read-only. Default read-only. | nothing |
| OQ-M22-02 | **User decision.** School admin on the queue. Default no. | nothing |
| OQ-M22-03 | **Closed in v1.1** as Delivery Lead decision DL-M22-11 (two fictitious `dibuka` tickets, badge computed). | — |
| OQ-M22-04 | `new_ticket` recipients, body, link, reply notification. | nothing |
| OQ-M22-05 | Live contents never captured; a later GET-only probe overrides this document. | nothing |
| OQ-M22-06 | Existence of `/pusat-tuisyen/tiket/baru` and `/tiket` on live. | nothing |
| OQ-M22-07 | Live limits, pagination, count line meaning. | nothing |
| OQ-M22-08 | BM validation copy. | nothing |
| OQ-M22-09 | Badge definition and zero state. | nothing |
| OQ-M22-10 | Other roles on S1. | nothing |
| OQ-M22-11 | Relative-time wording. | nothing |

No open question blocks G2. If OQ-M22-01 is answered "add", the story US-M22-13 gets acceptance criteria, two endpoints (reply, status), an admin-side control design and a notification to the ticket owner; that is a Standard-track amendment to this document.
