# M22 — Support Tickets (L04 "Tiket Bantuan"), S1 `/pusat-tuisyen/tiket` and S2 `/admin/tiket` — Independent G1 Audit (round 1)

| Field | Value |
|---|---|
| Documents audited | `docs/requirements/urs/M22-support-tickets.md` v1.0 (13 stories, 38 FN, 58 AC, 11 DV, 11 OQ), `docs/requirements/srs/M22-support-tickets.md` v1.0 (51 FR, 18 BR, 4 endpoints, 5 XR, 45 E2E + 2 CHK) |
| Evidence | `docs/discovery/M22-support-tickets.md`; reference server in `D:\Dev Projects\prestasiplus-reference\backend` (read again for this audit: `ContentController.php` 31-38, 40-73, 408-510; `Admin/ChatbotSupportController.php` 100-122; `Support/StaffScope.php` 133-161; `Middleware/EnsureFeatureEnabled.php`; `routes/web.php` 182, 533, 804-808, 1437, 1494-1496, 1552-1553; `config/app.php:72`; `resources/views/content/tiket.blade.php`, `pelajar/pusat-tuisyen-tiket.blade.php`, `pelajar/pusat-tuisyen-tiket-baru.blade.php`, `admin/tiket.blade.php`; migration `2026_07_04_300001_create_support_tickets_table.php`); repository `src/shells/nav/user-nav.ts:572,575`, `src/shells/__tests__/user-shell.test.ts:141`, `user-nav.test.ts:224`, `src/modules/m01-authentication/mock/hooks/notifications.ts`, `mock/seeds/notifications.ts`, M01 SRS §6.8, `docs/design/shells.md` §1.2, `docs/architecture/overview.md:796`, `docs/ROLES-MATRIX-LINES.md:26`, `docs/requirements/SRS.md` (FR-G-04, FR-G-10), `src/lib/time/relative.ts` |
| Auditor | independent audit agent (not an author). Read-only except this report. |
| Date | 2026-10-09 |

## Verdict: **FAIL**

| Severity | Count |
|---|---|
| Critical | 0 |
| Major | 2 |
| Minor | 8 |
| Info | 4 |

Verdict rule (as in the M17 and M27 audits): any open Major = FAIL. Both Majors are fixable in the documents without new evidence; no code or live probe is needed.

## What is good (verified)

- **Counts are exact.** URS: 38 FN (EP-1 20 = 3+3+5+2+4+3; EP-2 10 = 2+2+4+2; EP-3 8 = 2+2+4); 58 AC (6+3+4+9+3+5+7+4+5+4+3+5). SRS: 51 FR, 18 BR, 45 E2E, 9 `@provisional` (14, 15, 22, 35, 38, 39, 40, 42, 45) plus 3 provisional sub-steps (01, 24, 41), 2 static checks. URS and SRS agree on every total.
- **Traceability is complete.** I mapped every one of the 58 AC to an E2E or CHK (AC-12.5 to CHK-M22-01, AC-09.5 to E2E-28); every FN is cited by an FR; every story has FR and E2E in SRS §3.1; no unknown FN, FR or AC is cited. Arithmetic in the fixture-dependent ACs holds (AC-11.2: 2 + #3, #8, #9 = 5; AC-07.6: 2 + 203 = 205; AC-01.4: six tickets of user 2, #8 down to #3).
- **S1 copy is verbatim.** Header and subheading, "Jumlah tiket: {N}", "Tiket Baru", both labels and placeholders, "Hantar Tiket", the six tab labels and keys and order, "Tiada tiket lagi.", "Buat Tiket Pertama", `#{id} — {subject}`, "Balasan Sokongan", the badge colours, `line-clamp-2`, `whitespace-pre-line`, first-error-only box, `old()` repopulation, form hidden unless `$errors->any()`, smooth scroll of the empty-state button: all match `content.tiket.blade.php`. Unknown `status` falls back to all (`ContentController.php:413-416`, 495-498). Own-scope `where user_id = auth id` is correct.
- **S2 copy is verbatim.** "Tiket Sokongan", the sub-line, "Semua ({n})" with `number_format(sum)`, raw status chips with `urlencode`, active chip indigo, both empty texts (curly quotes), five column titles, em dash for a missing user, "Ya"/"—" for Dibalas, grey pill with the raw status, `limit(200)`, `orderByDesc created_at`, counts not limited, no row link or action (`admin/tiket.blade.php`, `ChatbotSupportController.php:101-122`).
- **S2 access reading (DV-M22-07) is accurate.** Route group `role:admin,admin_sekolah,pegawai_ppd` (`web.php:533`) plus `StaffScope::openedScopeOrAbort` (`StaffScope.php:142-148`): admin all, school admin with a school scoped, school admin without a school and PPD 403. L04 in `ROLES-MATRIX-LINES.md:26` reads "M G AS" (Murid, Guru, Admin Sekolah), which agrees with the URS role table; `shells.md` §1.2 denies `/admin/*` to every role but the platform admin.
- **Repository anchors resolve.** `user-nav.ts:572` (Tiket Bantuan, no role list, `/pusat-tuisyen/tiket`), `:575` (Urus Tiket, `roles: A` = `['admin']`, badge "2", `/admin/tiket`), `user-shell.test.ts:141`, "Ke Admin Panel" cross-shell link, `overview.md:796` row "Sidebar count badges", FR-G-04 and FR-G-10, `diffForHumans` in `src/lib/time/relative.ts:82`, `pushNotification(userId, notification, {push})` with `category: null` accepted and default `type` overridable (`hooks/notifications.ts:38-63`), the M01 `new_ticket` seed copy "Tiket baru" / "Tiket sokongan baharu telah diterima." (`seeds/notifications.ts:66-71`), M01 users 3 and 4 with the cited names and e-mails.
- **Tags are mostly honest.** Unobserved items (tab titles, validation copy, recipients, badge definition, seed, banner persistence) are PROPOSED or INFERRED and listed in SRS §8.2; OQ-M22-05 states plainly that live page content was never captured; the `@provisional` split in the E2E list is sensible.
- **Privacy is clean.** Only M01 demo names and `@demo.test` e-mails; ticket texts are generic; no real person's name.
- **XR-M22-02 / 03 / 04 are accurate and concrete.**

## Findings

| ID | Severity | Doc and section | Issue | Required fix |
|---|---|---|---|---|
| AUD-M22-01 | **Major** | URS FN-M22-2.3.2, AC-M22-07.2, DV-M22-09; SRS FR-M22-33, BR-M22-14 | The S2 date is stated as "`YYYY-MM-DD HH:mm:ss` (Asia/Kuala_Lumpur)" and tagged SERVER. The server does not convert: `admin/tiket.blade.php` prints `{{ $r->created_at }}` from `DB::table(...)` (a raw stored string) and `config/app.php:72` is `'timezone' => 'UTC'`; nothing in `app/` sets another zone for this page (the discovery S3-04 says only "raw `created_at` string"). So the server shows UTC (09:30 +08:00 would print `01:30:00`). The URS therefore attributes to the server a behaviour it does not have, and AC-07.2 (`2026-09-25 09:30:00`) asserts a value the server would not print. DV-M22-09 says "replicated exactly", which is not true for the zone. | Retag the zone as PROPOSED (or INFERRED that live shows local time, unobserved). Either (a) record it as a deviation (D9 "wrong value": a Malaysian staff queue showing UTC) with the minimal fix "same format, Asia/Kuala_Lumpur" and the alternative "UTC as the server" listed, or (b) replicate UTC and change AC-07.2/E2E-25 to `01:30:00`/`02:12:00`. Correct DV-M22-09 to say the format is replicated and the zone is decided separately. Same wording in SRS FR-M22-33 and BR-M22-14. |
| AUD-M22-02 | **Major** | URS §7 DV-M22-02 and DV-M22-03, FN-M22-1.3.2/1.3.3, §0 Evidence; SRS FR-M22-06, 10; discovery §2 S1-08, §3, §4 | The two DVs misstate which server route S1 really uses. The S1 form posts to `/tiket` (`content.tiket.blade.php:47`, discovery S1-08: "POSTs to `/tiket` (R5), NOT to `/pusat-tuisyen/tiket`"), and `/tiket` is the route that is **reachable** from S1 (flag-gated, `web.php:1552-1553`; it stores `dibuka`, limits 255/5000, flash "Tiket dihantar. Pasukan sokongan akan membalas secepat mungkin."). The route that stores `open` (`pusatTuisyenTiketStore`, limits 160/4000, flash "Tiket anda telah dihantar.") is only posted to by the unlinked page `/pusat-tuisyen/tiket/baru`. Consequences: (1) DV-M22-02 says "the create on the page's own route stores `open` ... shows as 'Open'": that can never happen from S1, so no visible server behaviour is being corrected; (2) DV-M22-03 rejects "255/5000 and the longer flash" as "belonging to the unreachable `/tiket` route", which inverts the facts and also contradicts DV-M22-01 in the same table ("the page posts its form to `/tiket`"); (3) the verbatim banner "Tiket anda telah dihantar." and the 160/4000 limits come from the route S1 does not use, so a reader taking them as "what S1 does" is misled. The choice itself is allowed (two contradictory server routes, D9), but its justification is wrong. | Rewrite DV-M22-03: state that S1's own form reaches R5 (255/5000, longer flash) while the other create route R3 (160/4000, shorter flash, status `open`) is reachable only via the invented `/baru` page; then justify the pick (for example "the shorter copy and the explicit 160/4000 `maxlength` are the only ones tied to the `/pusat-tuisyen/tiket` URL; R5 is a duplicate of a route that DV-M22-01 does not build") and list "255/5000 + longer flash" as the rejected alternative with the right reason. Fold DV-M22-02 into DV-M22-04 (R3's `open` is another reason not to build `/baru` and its POST) or restate it as "no deviation for S1: the effective S1 flow already stores `dibuka`". Correct the "SERVER" tag on FN-M22-1.2.1 and FR-M22-06 to "SERVER R3 text, not reachable from S1 (DV-M22-03)". |
| AUD-M22-03 | Minor | URS FN-M22-1.3.2, AC-M22-04.2; SRS FR-M22-10, E2E-M22-12 | The `maxlength` 160/4000 attributes are asserted as part of the form anatomy and E2E-M22-12 is not `@provisional`, but the S1 server markup has **no** `maxlength` (discovery S1-06/S1-07). Only R3's `/baru` form has them, and that page has a different label ("Keterangan"), placeholder and 6 rows. The mixture (S1 labels and placeholders, `/baru` limits) is PROPOSED, not SERVER. | Tag `maxlength` explicitly PROPOSED in FN-1.3.2 and AC-04.2; tag E2E-M22-12 `@provisional` for the `maxlength` step only. |
| AUD-M22-04 | Minor | URS FN-M22-2.3.1, AC-M22-07.2; SRS FR-M22-32, §8.1 | The server table header row carries the class `uppercase` (`admin/tiket.blade.php`), so the visible headers read "TARIKH, PENGGUNA, SUBJEK, STATUS, DIBALAS". The docs give only the mixed-case text and say nothing about the transform. A rebuild that follows the docs will render mixed case; a test using text content will pass either way. | Add "header cells rendered in capitals (CSS `uppercase`, `text-xs`); DOM text as written" to FN-M22-2.3.1 / FR-M22-32 and to the §10 responsive notes. |
| AUD-M22-05 | Minor | URS DV-M22-11, OQ-M22-03, §1.5; SRS BR-M22-17, §6.3 | The seed justification is recorded (DV-M22-11 with the alternative and the user-decision flag), but it is thin against the rules. CLAUDE.md §6: "never invent records that don't exist on live and never tune values to make totals agree"; D11: computed counts, with a documented **display constant** as the sole exception for "observed figures no definition reproduces". Two invented tickets whose only purpose is to make the computed badge equal the observed "2" is exactly the tuning §6 warns about, and the rejection of the constant ("a visible contradiction with an empty queue") is an argument from convenience, not from the rule. The default is defensible only as a user-decision default, which the docs do say. | In DV-M22-11 and OQ-M22-03 quote the §6 and D11 wording, state that this is the trade-off, state that ticket rows, dates and texts are invented (fictitious, not observed) and that the badge "2" is the only observed fact, and spell out what changes if the user picks the constant (badge text from a documented constant, queue empty, AC-07.2/08.1/11.1 and E2E-25/31/41 change). Keep the default if the Lead wants, but the text must not read as if the two tickets were observed. |
| AUD-M22-06 | Minor | URS §1.5, DV-M22-11; M01 `seeds/notifications.ts:113-115` | Cross-module coherence not noted: the M01 admin inbox seed generates a `new_ticket` item every tenth position (about 17 of 167), i.e. many historical ticket notifications, while the M22 seed has only two tickets in total and none closed. A reviewer comparing the two sees 17 "new ticket" notifications for 2 tickets. The notifications carry no ticket link, so nothing breaks, but the coherence is not recorded. | Add one line (URS §1.5 or DV-M22-11): the M01 inbox items are historical live observations of the type and are not linked to M22 rows; M22 does not back-fill tickets for them. |
| AUD-M22-07 | Minor | URS FN-M22-3.3.2, DV-M22-06; SRS FR-M22-45 | Cited as "PROJECT RULE (CLAUDE.md §7)". CLAUDE.md §7 contains no 12 px rule. The real basis is D9 ("unreadable text") plus the precedent DV-M17-25 (M17 FN-M17-9.1.3, AC-M17-35.3). The 10 px badge and 11 px time are part of the server markup, so this is a D9 deviation, not a project rule. | Cite D9 "unreadable text" and DV-M17-25 in FN-3.3.2, DV-M22-06 and FR-M22-45; stop citing CLAUDE.md §7 for it. |
| AUD-M22-08 | Minor | URS DV table (11 rows) | Not all 11 "DV"s are D9 deviations from the server. DV-M22-04 (routes not built) and DV-M22-08 (gap) are omissions, DV-M22-05 fills an unspecified order, DV-M22-09 "replicated as is", DV-M22-10 adds behaviour the server lacks, DV-M22-11 is a seed. Counting them as "11 deviations" overstates the divergence and makes the list harder to review; only 01, 03, 06 (and 07 as a source conflict) are real contradiction fixes. | Keep the rows but add a "Type" column (D9 fix / decision / gap / replicated / PROPOSED) and state the number of true D9 fixes in the heading. No behaviour change. |
| AUD-M22-09 | Minor | URS US-M22-09 (and US-M22-06) | "As the owner, I want the queue closed to every role except the platform admin" uses "the owner" for what is a platform/product concern; in US-06 "owner" means the ticket author, so the same word has two meanings in adjacent stories. | Reword US-M22-09 to "As the platform owner" or "As a ticket author" (the intent is privacy of tickets), and keep "owner" for the ticket author in US-06. |
| AUD-M22-10 | Minor | URS FN-M22-1.1.3; SRS FR-M22-04, E2E-M22-01, AC-M22-01.1 | "Sidebar item active on this route" is INFERRED (the item is observed, its active state on this route is not) but E2E-M22-01 is not `@provisional` for that step, while the tab title (also PROPOSED) is. Same for AC-M22-01.1. | Mark the "item active" step provisional in E2E-M22-01 (or note that the shell's generic active-state test already covers it and drop the step). |
| AUD-M22-11 | Info | URS §2 (Parent, sponsor, PPD, JPN), OQ-M22-10; SRS FR-M22-01, §9 | S1 reachability for parent, sponsor and JPN is "INFERRED from SERVER", but the reference backend has only the roles `pelajar`, `guru`, `admin`, `admin_sekolah`, `pegawai_ppd`; it has no parent, sponsor or JPN. For the roles it does have, the route is `auth` only (`web.php:1437`, 1494) and the shell falls back to the pelajar layout (`ContentController::shell`, 56-73), so the inference holds for PPD and the staff roles but is an extrapolation for the other three. Already flagged by OQ-M22-10 and E2E-22 `@provisional`. | Adjust the tag to "SERVER for the five server roles, INFERRED for the rest". No behaviour change. |
| AUD-M22-12 | Info | URS §2, SRS §2.1 | Server `/admin/tiket` for the school admin is a real source fact (scoped queue). DV-M22-07 handles it correctly. For completeness: the PPD officer gets 403 on the server too, which agrees with the spec; the docs could say so in one clause. | Optional clause in DV-M22-07: "pegawai_ppd is 403 on the server as well". |
| AUD-M22-13 | Info | SRS §2.1, XR-M22-01(b) | XR-M22-01(b) asks M01 to "provide or confirm a read of active users by role". `AUD`: M01 has user repositories (`mock/repository`, handlers) but I did not find a documented, named "list active users by role" function in the M01 contract; the request is concrete enough, but the SRS should name the function it expects (or say "no such function exists yet; M22 will use `usersRepo` read access via the M01 contract"). | Name the expected function or state that none exists yet. |
| AUD-M22-14 | Info | SRS §6.6 XR-M22-01 / §6.2 | `pushNotification` lives at `src/modules/m01-authentication/mock/hooks/notifications.ts` (verified); the SRS writes `mock/hooks/notifications.ts` without the module prefix. Harmless but a reader may look in `src/mock/`. | Use the full path once. |

## Check-by-check result for the audit brief

| Check | Result |
|---|---|
| Every server-visible element, field and copy covered verbatim | Yes for S1 and S2 apart from the S2 header capitalisation (AUD-M22-04). The unreachable `/baru` page is listed and deliberately not built (coverage matrix row, DV-M22-04). |
| Tags correct, nothing unobserved stated as fact | Two misattributed SERVER claims: the S2 date zone (AUD-M22-01) and the S1-form-versus-R3 facts behind the success banner, limits and `open` status (AUD-M22-02); `maxlength` is PROPOSED not SERVER (AUD-M22-03). All other unobserved items are tagged PROPOSED/INFERRED. |
| DVs justified under D9 and minimal | 01 valid; 03 allowed but justified with inverted facts (AUD-M22-02); 02 corrects a route S1 never reaches (AUD-M22-02); 06 valid with a wrong citation (AUD-M22-07); 07 valid source conflict; 09 incomplete (AUD-M22-01); 04, 05, 08, 10, 11 are not D9 fixes (AUD-M22-08). |
| Traceability story to FR to AC to E2E; counts consistent | Complete and consistent (see "What is good"). |
| Role matrix vs L04, shells and nav | Consistent (L04 "M G AS"; `user-nav.ts` entries; `/admin/*` denial). |
| Seed justification (two `dibuka` tickets vs D11 display constant) | Recorded and flagged as a user decision with a default, but the rationale is weak against CLAUDE.md §6 and D11, and the M01 inbox relation is not noted (AUD-M22-05, 06). |
| Link targets resolve or flagged | Yes (SRS §2.1 lists each; routes `/pusat-tuisyen/tiket` and `/admin/tiket` correctly marked "not yet built"; `/pusat-tuisyen/panduan` exists in the same family). |
| XR requests concrete and accurate | XR-02, 03, 04, 05 verified against `user-nav.ts`, `user-shell.test.ts`, `overview.md`, M01 §6.8; XR-01 accurate on `pushNotification`, vague on the role read (AUD-M22-13). |
| Privacy | Pass. |
| Contradictions with M01, M02, shells | None found. The "Urus Tiket" admin-only nav rule, the router rule for `/admin/*`, notification contract, and user ids 3/4 all agree. |
| Responsive 375/768/1280 | Covered in URS AC-12.x, SRS §10 and E2E-43/44; layouts at 768/375 honestly marked PROPOSED. |

## Required before re-audit

Fix the two Majors (AUD-M22-01, AUD-M22-02) and apply the Minors where cheap (AUD-M22-03 to 10). A round-2 check can then be limited to URS §7 DV-M22-02/03/09/11, FN-M22-2.3.2, FR-M22-33 and the E2E counts after any renumbering.

---

# Round 2 (re-audit of URS/SRS v1.1, 2026-10-09)

## Verdict (round 2): **PASS**

No open Critical, Major or Minor finding. One residual Info note (below). Verified again against the reference server and the repository.

## Server facts re-checked for the DL decisions

- **R5 limits and flash.** `ContentController::tiketStore` (`ContentController.php`, `/tiket` POST): `subject required|string|max:255`, `body required|string|max:5000`, status `dibuka`, redirect `/tiket` with flash "Tiket dihantar. Pasukan sokongan akan membalas secepat mungkin." The docs (FN-1.2.1, FN-1.3.2, FR-06, FR-10, FR-13, BR-04, §5, §6.1, AC-04.6, E2E-15) now carry 255/5000 and that exact flash.
- **S1 posts to R5.** `content.tiket.blade.php` form `action="/tiket"`; the tabs link to `/tiket`. DV-M22-01 and DV-M22-03 state this correctly and as the only divergence (stay on `/pusat-tuisyen/tiket`, unfiltered).
- **`/tiket` renders the same view.** `ContentController::tiket` returns `content.tiket`; `/pusat-tuisyen/tiket` renders `pelajar.pusat-tuisyen-tiket`, which is `@include('content.tiket')`. The claim in DV-M22-01/03 holds. `/tiket` is behind `feature:tiket` (fail-open ON), as the URS says.
- **R3 (`open`, 160/4000, short flash)** is posted to only by the unlinked `/baru` page; DL-M22-02 and DL-M22-04 say so correctly. DV-M22-02 no longer exists.
- **UTC.** `config/app.php:72` is `'timezone' => 'UTC'`; DV-M22-09 cites it and the 09:30 versus 01:30 example is right.

## Closure of round 1 findings

| ID | Status | Evidence in v1.1 |
|---|---|---|
| AUD-M22-01 | Closed | FN-2.3.2, FR-33, BR-14, AC-07.2: local KL time as D9 fix DV-M22-09 with UTC cited and the alternative rejected. |
| AUD-M22-02 | Closed | DL-M22-02 and DV-M22-03 rewritten with the correct route facts; DV-M22-02 folded into DL-M22-02/04; banner and limits retagged to R5. |
| AUD-M22-03 | Closed | `maxlength` PROPOSED (SRS §8.2 row 3, DL-M22-02); E2E-12 provisional in part. |
| AUD-M22-04 | Closed | Uppercase headers in FN/FR-32, AC-07.2, §10. |
| AUD-M22-05 | Closed | DL-M22-11 quotes §6 and D11, states rows are fictitious and not tuned, gives the constant alternative and what changes. The reasoning (a definition reproduces "2") is defensible and the user can still reverse it. |
| AUD-M22-06 | Closed | M01 inbox ~17 `new_ticket` note in URS §1.5 and DL-M22-11; XR-M22-01(d). |
| AUD-M22-07 | Closed | DV-M22-06 cites D9 and DV-M17-25; NFR-M22-07 and FR-45 corrected. The remaining "CLAUDE.md §7" citations (FN-3.3.1, NFR-07) are for responsive layout, which is correct. |
| AUD-M22-08 | Closed | URS §7 holds 6 real divergences (4 D9 fixes: 01, 03, 06, 09; 07 and 10 source conflicts); DL-M22-xx rows hold the rest. |
| AUD-M22-09 | Closed | US-M22-06 and 09 now "As a ticket author". |
| AUD-M22-10 | Closed | Sidebar-active step provisional (FR-04, E2E-01). |
| AUD-M22-11 | Closed | Role row now says the server has only five roles; the rest is INFERRED (OQ-M22-10). |
| AUD-M22-12 | Closed | DV-M22-07 adds that `pegawai_ppd` and a school admin without a school get 403 on the server. |
| AUD-M22-13 | Closed | XR-M22-01(b) names `usersRepo.activeIdsByRole` as the proposed function and the existing fallback `usersRepo.adminList({role, isActive, pageSize})`; I confirmed `adminList` and `AdminUserFilter` (`role`, `isActive`, `pageSize`) exist in `mock/repository/users.ts`. |
| AUD-M22-14 | Closed | Full path used. |

## Regression check (counts and traceability)

Recounted from the files: URS 38 FN (20/10/8), 58 AC (6+3+4+9+3+5+7+4+5+4+3+5, unchanged), 13 stories; SRS 51 FR, 18 BR, 45 E2E, 10 tagged `@provisional` (12, 14, 15, 22, 35, 38, 39, 40, 42, 45) plus 3 provisional sub-steps (01, 24, 41), 2 CHK. URS and SRS totals agree and the SRS change log matches. Every AC still maps to an E2E or CHK; the changed ACs (04.3, 04.6, 07.2) keep their E2E (13, 15, 25). No unknown id is cited; remaining references to DV-M22-02/04/05/08/11 and OQ-M22-03 appear only in change logs and the "closed" rows.

## Residual Info

- AUD-R2-01 (Info): the S1 create now depends on the flag-gated route R5 (`feature:tiket`, fail-open ON). The URS mentions the flag in DV-M22-01 but not that a flag-off server would redirect S1's form to the role home. Not relevant to the prototype (no flag); optional one-line note.
