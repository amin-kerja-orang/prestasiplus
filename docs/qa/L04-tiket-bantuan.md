# L04 Tiket Bantuan (M22, S1 `/pusat-tuisyen/tiket`, S2 `/admin/tiket`) - G5 QA

Date: 2026-10-10. Branch: s8-m22-tickets (worktree `.claude/worktrees/s8-m22`), HEAD c3e838d before this commit. Slug: L04-tiket-bantuan (roles-matrix row L04, Murid, Guru, Admin Sekolah; plus the admin queue "Urus Tiket"). Inputs: SRS M22 v1.2 (FR-M22-01..51, BR-M22-01..18, sections 9, 10, 12 E2E-M22-01..45, CHK-M22-01/02), URS AC-M22-01.1 to 12.5 (58 ACs), D27 (admin queue read-only, Admin Sekolah cannot open `/admin/tiket`). G4 was Approved.

**Verdict: READY (G5 Pass), no open Critical/High/Medium bug.** Every AC that can be executed passed on mobile 375, tablet 768 and desktop 1280 (320 px checked on mobile). Seven ACs have a request-level part (raw API status codes, notification fan-out) that cannot be reached from a browser test in this project (the mock transport lives inside the app); they are covered by the handler unit test, which I executed (27 passed), and the browser-visible half was executed. These are recorded as "Pass (unit + e2e)" and listed under Deferrals, not hidden. Two Low observations (O-1, O-2) are noted, neither blocks.

## Environment
Own config `playwright.5144.config.mjs` (copy of `playwright.5142.config.mjs`, port, `dist-e2e-5144`, `test-results-5144`), `--workers=1`, `E2E_BOOT_TIMEOUT_MS=90000`. The build is very slow on this machine (the first attempt to let the Playwright webServer build timed out at my 10-minute command limit), so I ran `vite build --mode e2e --outDir dist-e2e-5144` and `vite preview --port 5144 --strictPort` myself and let Playwright reuse the server. 4173, 5173 and live untouched; only my own preview process (PID found by port 5144 and its command line) was stopped. No worktree, junction, install or stash was used. No source file was changed. After the runs the config, `dist-e2e-5144` and `test-results-5144` were deleted and port 5144 was confirmed free.

## Commands and counts
| Run | Command | Result |
|---|---|---|
| Existing suite, 3 projects | `E2E_BOOT_TIMEOUT_MS=90000 npx playwright test -c playwright.5144.config.mjs --workers=1` | 156 tests: **108 passed, 48 skipped, 0 failed** (1.2 h) |
| Regression spec, run 1 | same config, `e2e/m22-support-tickets/qa-l04.spec.ts` | 51 tests: 41 passed, 6 failed, 4 skipped (49.8 min) |
| Regression spec, run 2 (the 6 failures) | `... qa-l04.spec.ts --workers=1 -g "limits: 255\|loading state"` | 6 passed |
| M22 unit/integration | `npx vitest run src/modules/m22-support-tickets` | 3 files, 27 tests passed |
| Type-check | `npx tsc --noEmit -p tsconfig.e2e.json` | 0 errors in M22 files (3 pre-existing errors in `e2e/m14-gamification/student-b.spec.ts`, not M22) |

Net regression spec: 47 passed, 4 skipped by design, 0 failing on the final state.

### Skips of the existing suite (48), all by design
- 18 = 6 declared skips x 3 projects: E2E-M22-15, 16, 36 ("request only") and E2E-M22-38, 39, 40 (notification), covered by the handler unit test (see Deferrals).
- 30 = 15 viewport-specific tests x 2 projects: 1280-only tests skipped on mobile and tablet (E2E-M22-10, 22, 26, 27, 29, 32, 34, 37, 42, 01 sidebar part, 41 "3" and "5"), E2E-M22-43 "count row stacks" (375 only, skipped on tablet and desktop), the two 320 px tests (mobile project only).
- The `@provisional` tests were executed where their viewport applies (they are not skipped as provisional): all passed.

### The 6 run-1 failures were spec mistakes, not app defects (spec fixed, source untouched)
| Test (x3 projects) | Cause | Fix in `qa-l04.spec.ts` |
|---|---|---|
| limits 255/5000 | Playwright `fill` honours `maxlength` (Chromium `insertText`), so my 256-character subject was truncated to 255 and accepted. That is the expected behaviour of the PROPOSED `maxlength`, not an app bug. | remove the two `maxlength` attributes in the page before the over-limit submissions (an API caller bypasses them the same way) |
| loading state | on a tab switch S1 keeps the old list and does not show the spinner (see O-1); my test waited for a spinner after a tab click | enter S1 in-app from `/dashboard` with latency armed, so the first load shows the spinner |

## AC table
"Spec" = existing `tiket.spec.ts` (E2E-M22 id), "QA" = new `qa-l04.spec.ts`. Result is for mobile / tablet / desktop (all three Pass unless stated; desktop-only tests are noted).

| AC | Steps (summary) | Result | Evidence |
|---|---|---|---|
| 01.1 | pelajar2 at 1280: user shell, header "Tiket Bantuan", subtitle, tab title, sidebar item active | Pass (header x3; sidebar and title at 1280) | Spec E2E-01 and 01 provisional |
| 01.2 | "Jumlah tiket: 1", card `#1 — Tidak dapat log masuk ke akaun` | Pass x3 | Spec E2E-02 |
| 01.3 | body, clock + "1 hari yang lepas", red "Dibuka" badge, card has no link, click changes nothing | Pass x3 | Spec E2E-02 |
| 01.4 | tickets-extra: six cards #8..#3 with badge colours, no pagination | Pass x3 | Spec E2E-03 |
| 01.5 | #8 body clamped to 2 lines | Pass x3 | Spec E2E-04 |
| 01.6 | guru and adminsekolah: same anatomy, own tickets only | Pass x3 | Spec E2E-05, QA create tests |
| 02.1 | pelajar base seed: "Jumlah tiket: 0", icon, "Tiada tiket lagi.", "Buat Tiket Pertama", no card | Pass x3 | Spec E2E-06 |
| 02.2 | scroll down, press "Buat Tiket Pertama": form opens, page at top | Pass x3 | Spec E2E-06 |
| 02.3 | pelajar2, tab "Selesai": same empty text, count stays 1 | Pass x3 | Spec E2E-07 |
| 03.1 | six tabs, labels, order, hrefs, no counts | Pass x3 | Spec E2E-08 |
| 03.2 | tickets-extra, "Selesai": URL, only #6, active tab dark, count 6 | Pass x3 | Spec E2E-09 |
| 03.3 | `?status=xyz`: all tickets, "Semua" active | Pass (1280 only by design) | Spec E2E-10 |
| 03.4 | every tab keeps `/pusat-tuisyen/tiket`; also created-ticket tabs for murid, guru, school_admin (`?status=dibuka` holds it, `selesai` empty, count stays) | Pass x3 | Spec E2E-09, QA tabs |
| 04.1 | form hidden on load, button toggles | Pass x3 | Spec E2E-11 |
| 04.2 | title, labels, placeholders, required, 5 rows, button, `maxlength` 255 / 5000 attributes | Pass x3 | Spec E2E-12, QA limits |
| 04.3 | murid, guru, school_admin each create: stays on `/pusat-tuisyen/tiket` with no query, green banner text verbatim "Tiket dihantar. Pasukan sokongan akan membalas secepat mungkin.", form closed, count 1, first card with "Dibuka" | Pass x3 | Spec E2E-13, QA create x3 roles |
| 04.4 | reload: banner gone | Pass x3 | Spec E2E-13, QA banner |
| 04.5 | whitespace-only Subjek/Butiran: nothing stored, form open, values kept, one message | Pass x3 | Spec E2E-14 |
| 04.6 | 255 and 5000 accepted (201); 256 and 5001 refused (422) with "Subjek tidak boleh melebihi 255 aksara." and "Butiran tidak boleh melebihi 5000 aksara.", nothing stored; statuses read from the request log `[422, 422, 201]` | Pass x3 (through the real form and the request log) | QA limits |
| 04.7 | body keys `userId`, `status`, `adminReply` ignored | Pass (unit + e2e): the form never sends them; the handler test posts them and asserts they are ignored; created cards show `Dibuka` and no reply panel | handler test, QA create |
| 04.8 | guru and school_admin ticket stored under own id, shows on own S1 | Pass x3 | Spec E2E-17, QA create |
| 04.9 | Subjek `<b>x</b> & "y"` shown as text | Pass x3 | Spec E2E-18 |
| 05.1 | tickets-extra #6: panel "Balasan Sokongan", two lines; also a hook-made reply "Satu\nDua" for murid, guru, school_admin renders on two lines | Pass x3 | Spec E2E-19, QA create x3 roles |
| 05.2 | ticket without reply: no panel | Pass x3 | Spec E2E-19, QA (tk-reply count 0 before the hook) |
| 05.3 | panel shows no author, no time | Pass x3 | Spec E2E-19 |
| 06.1 | guest on S1 goes to `/login` | Pass x3 | Spec E2E-20 |
| 06.2 | pelajar2 never sees #2 (DOM, count), pelajarmaju the reverse | Pass x3 | Spec E2E-21 |
| 06.3 | `?userId=4` ignored | Pass (e2e on the URL; API form by unit test) | Spec E2E-21, handler test |
| 06.4 | admin, ppd, jpn, ibubapa, penaja open S1 with own (none) tickets | Pass (1280 only by design) | Spec E2E-22 |
| 06.5 | `/pusat-tuisyen/tiket/baru`, `/pusat-tuisyen/tiket/1`, `/tiket`, `/tiket/baru` show the 404 page | Pass x3 | Spec E2E-23, QA unbuilt paths |
| 07.1 | admin shell, heading "Tiket Sokongan", sub-line, tab title | Pass x3 | Spec E2E-24 |
| 07.2 | columns Tarikh, Pengguna, Subjek, Status, Dibalas (CSS uppercase), two rows, dates `2026-09-25 09:30:00` and `2026-09-24 10:12:00`; same dates with the browser in America/New_York | Pass x3 (MYT also proven independent of browser zone, desktop and others) | Spec E2E-25, QA S2 and time-zone test |
| 07.3 | tickets-extra: "Ya" only on #6, raw status pills | Pass (1280 only by design) | Spec E2E-26 |
| 07.4 | orphan owner shows "—" | Pass (1280) | Spec E2E-27 |
| 07.5 | no row link, no button, input, search, pagination other than the chips; no form, select, textarea inside the page (admin, read-only per D27) | Pass x3 | Spec E2E-28, QA S2 |
| 07.6 | tickets-many: 200 rows, "Semua (205)" | Pass (1280) | Spec E2E-29 |
| 07.7 | no ticket: "Belum ada tiket sokongan." | Pass x3 | Spec E2E-30 |
| 08.1 | chips "Semua (2)", "dibuka (2)", active indigo | Pass x3 | Spec E2E-31, QA S2 |
| 08.2 | tickets-extra chips: present statuses, vocabulary order, counts | Pass (1280) | Spec E2E-32 |
| 08.3 | chip `selesai`: URL, only #6, counts unchanged | Pass x3 | Spec E2E-33 |
| 08.4 | `?status=xyz`: `Tiada tiket berstatus “xyz”.`; also `selesai` (valid, none) and `<b>x</b>` (rendered as text, no element) | Pass (1280 for xyz; QA x3) | Spec E2E-34, QA S2 filter |
| 09.1 | guest on `/admin/tiket` goes to `/login` | Pass x3 | Spec E2E-35, QA access |
| 09.2 | school_admin, guru, murid on `/admin/tiket`: no `tq-page`, no row, no seed subject, URL leaves `/admin/tiket`, and the request log holds no `/api/admin/tiket` answered 200; ppd and jpn in the Spec | Pass x3 | Spec E2E-35, QA access |
| 09.3 | `GET /api/admin/tiket` and `/open-count`: 401 guest, 403 non-admin, 200 admin | Pass (unit + e2e): status codes asserted in the handler test; e2e: admin open-count answered 200 (request log), non-admins make no such request (see 11) | handler test, QA badge |
| 09.4 | "Urus Tiket" in the sidebar for admin only | Pass (1280): admin sees it; adminsekolah, pelajar, guru do not | Spec E2E-37, QA badge x3 roles |
| 09.5 | no reply/status/delete control on S2 | Pass x3 | Spec E2E-28, QA S2 |
| 10.1 | create notifies the active admin: type `new_ticket`, title "Tiket baru", body | Pass (unit) / not readable from the UI: the seeded admin inbox is large and the bell caps at 99+ | handler test; Spec E2E-38 declared skip |
| 10.2 | school admin, guru, creator get nothing | Pass (unit) | handler test; Spec E2E-39 declared skip |
| 10.3 | refused create notifies nobody | Pass (unit) | handler test; Spec E2E-39 declared skip |
| 10.4 | second admin gets one; inactive admin none | Pass (unit) | handler test; Spec E2E-40 declared skip |
| 11.1 | admin sidebar badge "2" on the base seed | Pass x3 (drawer on mobile and tablet) | Spec E2E-41, QA badge |
| 11.2 | "3" after a pupil creates a ticket; "5" under tickets-extra (also via `m22LoadProfile` at run time) | Pass (1280) | Spec E2E-41 provisional, QA badge |
| 11.3 | badge not rendered at 0 for "Urus Tiket" only | Pass (1280): after `clearTickets` the item is visible and holds no digit | Spec E2E-42, QA badge |
| 12.1 | no horizontal page scroll on S1 and S2 at 375, 768, 1280; S2 table scrolls inside its card; 320 px S1 and S2; 320 px with a 252-character unbroken subject, 2520-character body, long unbroken reply: no overflow, badge inside the card | Pass x3 (320 on mobile) | Spec E2E-43 and 320, QA 320 |
| 12.2 | every text node at least 12 px on S1 and S2 (also at 320 with the long ticket) | Pass x3 | Spec E2E-44, QA 320 |
| 12.3 | tabs and chips wrap, count row stacks at 375, long subjects wrap in the cards | Pass | Spec E2E-43, QA 320 |
| 12.4 | loading spinner on first load while `/api/tiket` is slow, then the data; 500 on a tab gives the error state with "Cuba lagi" and retry works; network error gives the error box, no cards, no h-scroll, retry works | Pass x3 | Spec E2E-45, QA states |
| 12.5 | no real person's name, only `@demo.test` | Pass: CHK-M22-01 static test (27 unit tests passed); the test data here uses fictitious names only | `src/modules/m22-support-tickets/__tests__/static/checks.test.ts` |

Count: 58 ACs. **Pass 58, Fail 0, Blocked 0.** Of these, AC-04.7, 06.3, 09.3, 10.1, 10.2, 10.3, 10.4 (seven) are "Pass (unit + e2e)" or "Pass (unit)": the request-level assertion was executed by the vitest handler test, not by a browser test. 3 items of the SRS E2E list (E2E-M22-15, 16, 36 request only) and E2E-M22-38..40 stay declared skips in the Spec for the same reason. See Deferrals.

## Exploratory checks beyond the spec (all Pass)
| Check | Result |
|---|---|
| Create at 255 / 5000 characters, refuse 256 / 5001 with the stored copy, statuses 422, 422, 201 | Pass x3 |
| Flash text verbatim, status "Dibuka", for murid, guru and school_admin | Pass x3 |
| Own tickets only (cross-user isolation, `?userId`) | Pass |
| "Balasan Sokongan" panel: heading, line break kept (two lines), no author, no time | Pass |
| S2 chips, MYT dates, read-only (no button, input, form, select, textarea in the page), table header capitals | Pass |
| S2 dates with the browser in America/New_York | Pass, still `2026-09-25 09:30:00` |
| `/admin/tiket` for school_admin, guru, murid: no queue data, URL leaves `/admin/tiket`, no queue request answered 200; guest goes to `/login` | Pass |
| Badge: admin only, live count (2, then 5 after loading a profile, then hidden at 0 for "Urus Tiket"); non-admins make zero requests to `/api/admin/tiket/open-count` and `/api/admin/tiket` (read from the mock request log) | Pass |
| Unbuilt paths `/tiket`, `/tiket/baru`, `/pusat-tuisyen/tiket/baru`, `/pusat-tuisyen/tiket/1` give the 404 page | Pass |
| 320 px, long unbroken text, no horizontal scroll, text at least 12 px | Pass |
| Loading and error (500, network) states | Pass |
| Console and page errors on the S1 flow (3 non-admin roles), and on the admin badge and S2 flows | None (asserted `[]`) |
| Privacy | Pass (static check; fictitious names only) |

## Bugs
No Critical, High, Medium or Low defect in the application. Two Low observations, neither a requirement violation:

| ID | Severity | Observation | Expected vs actual | Suspected owner |
|---|---|---|---|---|
| O-1 | Low (observation, no AC) | On S1, when a user switches tab (or the list is re-requested), `TicketsPage.vue` keeps the previous data on screen and shows no spinner until the response arrives, because the template tests `v-if="data"` before the loading state. The spinner shows only on the first load. FR-M22-46 asks for a loading state and does not say per navigation. | Expected: either; actual: stale list for the duration of the request. Not a defect against the SRS; reported for the owner's call. | frontend-developer |
| O-2 | Low (test quality, not app) | The existing spec test `E2E-M22-43 (320) long body and reply do not overflow` does not create long content (it only checks six seed cards). The long-content case is now covered by `qa-l04.spec.ts`. | n/a | qa (done) |

## Deferrals
- Request-level assertions that a browser test cannot reach (the mock transport lives inside the app): the 401 / 403 / 200 matrix of AC-09.3, the raw 422 bodies of AC-04.6, the ignored body keys of AC-04.7 and the `?userId` API form of AC-06.3, and the notification fan-out of AC-10.1 to 10.4. They are covered by `src/modules/m22-support-tickets/__tests__/mock/tickets.test.ts`, which I ran (27 passed in 3 files). When a real backend exists these become API tests (SEC-M22-01, 03, 04 in SRS 11.1).
- Screenshots: none taken, because no defect was found (nothing to evidence). Failure traces for the six spec mistakes were examined in `test-results-5144` and then deleted with the folder.
- AC with INFERRED / PROPOSED copy (validation messages, tab titles, sidebar-active, badge definition, hide at 0) pass as specified; they remain provisional until the user confirms the proposals (OQ-M22-08, 09, 11).

## Verdict
**Ready to release (G5 Pass).** Every AC was executed (browser or unit as listed) and passed; 0 open Critical/High/Medium/Low bugs; 108 + 47 browser tests and 27 unit tests pass across 375 / 768 / 1280 (and 320). The two Low observations need no action to pass the gate.
