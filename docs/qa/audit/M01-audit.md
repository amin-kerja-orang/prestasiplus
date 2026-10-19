# M01 — Authentication & Account — Independent Audit (AUD)

| Field | Value |
|---|---|
| Stage | AUD (TRACKER §6 step 4) |
| Date | 2026-09-25 |
| Privacy edit | 2026-09-30: the sample name and IC example in the rows below use the generic replacements (URS DV-17, DV-18) |
| Auditor | independent audit agent (did not author the URS/SRS) |
| Documents audited | `docs/requirements/urs/M01-authentication.md` v0.2 · `docs/requirements/srs/M01-authentication.md` v0.2 |
| Evidence | Live site https://prestasiplus.my (guest context + admin session, read-only), `docs/discovery/inventory/M01/*`, `docs/discovery/M01-authentication.md`, `docs/discovery/00-global-ui.md`, audit screenshots in `docs/qa/audit/img/M01/` |
| Safety | Read-only. Nothing was saved, submitted, deleted, marked read or sent. The only form submitted was one valid admin login in a separate throw-away browser context (to observe the landing page and cookies). No failed logins. The main browser session is still logged in as admin. |

## Verdict: **FAIL**

There are 0 Critical and 5 Major findings. Each Major finding either specifies behaviour the live site does not have, or leaves out live behaviour or copy. All of them are small document fixes. After they are fixed, a targeted re-audit of the affected items is enough. No full re-walk is needed.

## Summary counts

| Measure | Result |
|---|---|
| Inventory elements checked for coverage (script) | 363 content (S1–S11) + 571 shell (376 SHU + 195 SHA) = **934**. All 934 are in the URS §6 matrix, either individually or inside the declared ID ranges. There are no gaps or overlaps. |
| Matrix ↔ §3 FN "EL" columns consistency (script) | 389 mapping rows checked. **0 inconsistencies** in either direction. |
| Mapping semantics spot-checked by hand | 34 rows. 33 correct, 1 wrong (S2-007 🎒, see AUD-M01-05). |
| Live re-inventory (`inventory.js` + `run-state.js`, 11 saved states) | 2,508 elements. The **element totals match the saved raw captures exactly** in all 11 states. Visible-count drift: +4/+5 in the user-shell states comes only from the global PWA "Pasang PRESTASIPLUS" prompt (SHU-319–336, global shell, not M01). In S9, only the admin server-status values changed. **No M01 content drift.** |
| Claims verified against live | **56**: 47 correct, 9 incorrect (list below). |
| Traceability (script) | 110 FN → all have ≥1 FR · 97 AC → all have ≥1 E2E · 67 FR → all have ≥1 E2E · 26 US rows consistent with the FR "US" column · 48 E2E, each stated to run on 375/768/1280 · no orphan or dangling IDs · IDs follow URS.md §9. |
| Deviations DV-01…DV-15 | 14 of 15 live defects reproduced. **DV-09 not reproduced.** DV-11 to DV-15 are outside, or on the edge of, the D7 allowed categories and need an explicit user decision. |
| Findings | **Critical 0 · Major 5 · Minor 8** |

## Findings

| ID | Severity | Doc + section | What's wrong | Live evidence | Required fix |
|---|---|---|---|---|---|
| AUD-M01-01 | **Major** | URS FN-M01-2.2.7, AC-M01-16.1; SRS FR-M01-39, §8 "Bio counter", E2E-M01-28 (also discovery narrative line 350) | The docs specify a *live* counter ("Baki: {500 − length} aksara", "updates as I type") and label it OBSERVED. On live the counter **never changes**. It always reads "Baki: 500 aksara". This is invented behaviour, and it is not a listed deviation. | `/profile/edit`, 1280: typing "abc" into `#bio` (keyboard events) leaves the text "Baki: 500 aksara". Markup: `<p x-text="'Baki: ' + (500 - ($refs.bioInput?.value?.length \|\| 0)) + ' aksara'">`. The textarea has **no `x-ref="bioInput"`** (attributes: id, name, rows=2, maxlength=500, placeholder, class), so `$refs.bioInput` is undefined and the value is always 500. | Specify the live behaviour: a static "Baki: 500 aksara" that never updates, even when the bio has content. Alternatively, add a DV entry (broken behaviour) marked "needs user decision", because a non-working counter is not one of the D7 categories. Update AC-16.1, FR-39, §8 and E2E-28. |
| AUD-M01-02 | **Major** | URS §7 DV-09, AC-M01-26.4; SRS §10 row S8, FR-M01-65, E2E-M01-47 | DV-09 claims that at 375 the "Simpan Profil" button touches the viewport's right edge. **This could not be reproduced.** Live, the actions row sits inside the viewport and is aligned with the cards. The rebuild rule ("wrap, full-width stacked buttons below 640px") would change a layout that is not broken, which is a fidelity violation. | `/profile/edit` at 375×812: button right edge = 351px, parent row right edge = 351px, document clientWidth 360 (scrollWidth 360, so no overflow). Screenshot `docs/qa/audit/img/M01/profile-edit-375-actions.png`. The discovery screenshot `profile-edit-mobile.png` appears to be an artefact of the capture. | Re-verify on a real mobile viewport. If it is not reproduced, delete DV-09 and keep the live inline row (Kembali left, Simpan Profil right) at all widths. Update AC-26.4, the SRS §10 S8 row and the E2E-47 assertion. |
| AUD-M01-03 | **Major** | URS FN-M01-3.2.9, AC-M01-24.3; SRS FR-M01-61 | The notification item's delete button has the tooltip **`title="Padam"`**. The docs do not mention it (missing copy). | `/notifikasi`: delete button attributes `x-show="!selectMode"`, `@click="deleteSingle(id)"`, `style="opacity: 0;"`, `onmouseenter/onmouseleave`, **`title="Padam"`**. | Add the tooltip "Padam" to FN-3.2.9, AC-24.3 and FR-61. |
| AUD-M01-04 | **Major** | URS FN-M01-3.1.1, AC-M01-22.x; SRS FR-M01-53 (and FR-M01-59's "badge not changed until the next page load") | The unread badge refresh is incomplete. The docs say the count is fetched when each page loads. Live, `updateNotifBadge()` runs on load, **polls `/notifikasi/unread-count` every 60 s** (`setInterval(updateNotifBadge, 60000)`), and also runs when an FCM foreground push arrives. The 60 s polling state is missing, and FR-59's "not changed until the next page load" is wrong for the header badge. | Page script on `/profile`: `updateNotifBadge(); setInterval(updateNotifBadge, 60000);`, plus a call inside the FCM `onMessage` handler. The badge is server-rendered first (`#notif-badge`, "99+"). | Add the 60 s polling (and "refresh on push message; the push side is owned by M22") to FN-3.1.1 / FR-53. Correct FR-59: the item pill and filter counts stay until reload, but the header badge refreshes within 60 s. Add an E2E step (Playwright clock). |
| AUD-M01-05 | **Major** | URS FN-M01-1.1.1, FN-M01-1.4.1, AC-M01-06.1, §6 row EL-M01-S2-007; SRS FR-M01-01 | 🎒 is treated as a floating emoji that is visible at every width ("I see the floating emoji including 🎒"). On live it is the **welcome-panel mascot** (the same as 🎓 on `/login`), and it is hidden when the panel is hidden. AC-06.1 would make the rebuild show 🎒 on mobile, which live does not do. | `/register`: 🎒 is inside `div.mascot` (a "text-center mb-8" block above "Sertai Kami! 🌟"). Visible text at 375: floating emoji 📚 ✏️ ⭐ 🎨 🚀 💡 only, **no 🎒**. At 768 and 1280 🎒 is shown together with the panel. The inventory marks S2-007 as desktop-only. | Remap S2-007 to FN-1.4.1 (welcome panel mascot). Move 🎒 from FN-1.1.1 and FR-01 into FR-15 and AC-06.1's welcome-panel clause, so it follows the DV-07 panel visibility. |
| AUD-M01-06 | Minor | URS FN-1.4.7, FN-2.2.8, AC-07.2, AC-16.2, §6 S2-040/048, S8-030; SRS FR-20, FR-40 | The level-group sub-headings are displayed in **uppercase** ("SEKOLAH RENDAH", "SEKOLAH MENENGAH", via CSS `text-transform: uppercase`) on `/register` and `/profile/edit`. The docs quote only "Sekolah Rendah" / "Sekolah Menengah" (the discovery narrative has it right). | `getComputedStyle(...).textTransform === 'uppercase'` for both headings. innerText "SEKOLAH RENDAH". | State "displayed uppercase" in FR-20 and FR-40, and in the AC wording. |
| AUD-M01-07 | Minor | SRS §6.8 seed (admin row), E2E-M01-29; seed "types" | The admin seed is described as mirroring live with "grade 1 (Darjah 1, as the live admin's profile shows a Rendah level)". Live admin's checked level is **Darjah 4** (radio value 4 `checked`, gradient style). The admin seed types also omit `spaced_review`, which appears on live page 1. | `/profile/edit`: radios 1…6, value `4` checked. `/notifikasi` page 1 type badges include SPACED_REVIEW. | Set the admin seed grade to 4, or drop the "as live" claim. Update E2E-29's "Darjah 1 checked". Add `spaced_review` to the admin seed types. |
| AUD-M01-08 | Minor | URS FN-1.3.2, AC-03.2, OQ-9; SRS BR-06, §6.2 | Session lifetime is observable, not inferred. Without "Ingat saya", the `prestasiplus-session` and `XSRF-TOKEN` cookies expire **2 h** after the login response (120 min, so `SESSION_LIFETIME=120`). The docs say "expires in under 1 day (observed) / 120 min (INFERRED)". | Fresh-context admin login: cookies `XSRF-TOKEN exp=2h`, `prestasiplus-session exp=2h`. No remember cookie. | Relabel the 120 min lifetime as OBSERVED (cookie expiry), and narrow OQ-9 to the remember-me duration only. |
| AUD-M01-09 | Minor | URS AC-22.2, OQ-7 (badge part); SRS FR-53 | "Badge hidden when 0" is labelled INFERRED, but it is observable in the page script (`if (data.count > 0) {… '99+' …; display='flex'} else display='none'`). | Script `updateNotifBadge()` on the user shell. | Relabel as OBSERVED (code). Keep OQ-7 only for the S11 "Peti Masuk" pill. |
| AUD-M01-10 | Minor | URS §7 DV-06 "Live behaviour" column | The evidence is inaccurate. DV-06 says "`grade` is only required when the role is student". Live, after clicking "Ibu Bapa", the hidden `grade` input is still `required=true`, because the fallback script keeps it. It is `false` only for Guru. The rebuild decision is unaffected. | `/register`: role=parent → level picker visible, `grade.required === true`. role=teacher → hidden, `required === false`. | Correct the evidence text. |
| AUD-M01-11 | Minor (**needs user decision**) | URS §7 DV-11…DV-15; SRS FR-19/20/55/61/66, FR-38, FR-47, NFR-M01-05 | These deviations are real live defects, but they are **not in the D7 allowed categories** (broken links/404s, layout/responsive defects, contradictory rules). They are recorded as ordinary "Pending" deviations, and the SRS already builds them in: **DV-12** (active category pill not highlighted: visual state), **DV-13** (stale "Dashboard / Selamat datang, Admin" header: wrong copy), **DV-14** (name contrast: accessibility), **DV-15** (keyboard operability: accessibility). **DV-11** (delete button invisible on touch) is borderline: it could count as a responsive defect. | All confirmed live. `?type=system` / `?type=milestone`: no pill has `bg-indigo-600`. `/tetapan` header text "Dashboard ¶ Selamat datang, Admin". Profile H2 colour rgb(30,41,59) on the indigo→purple gradient. Role and grade cards are `div @click`. Delete button `onmouseenter` opacity. | Mark DV-11…DV-15 in §7 as "outside D7 categories — explicit user decision required (default = replicate live)". State in the SRS which live rule applies if each one is rejected (the SRS §0.1 note partly does this). |
| AUD-M01-12 | Minor | URS AC-08.2, SRS E2E-M01-15 | The register dropdown's third segment is `district`. For some schools it is "JPN PERLIS", not "PPD …". The AC and E2E wording "{PPD …}" is wrong (FR-22's `{district}` is right). | Search "kebangsaan" with state Perlis: rows "SK · Perlis · JPN PERLIS". | Change "{PPD …}" to "{district}" in AC-08.2 and E2E-15. |
| AUD-M01-13 | Minor | `docs/TRACKER.md` §4 M01 "URS/SRS" line (not under audit; reported for the Delivery Lead) | The line still states v0.1 figures ("23 stories, 86 ACs, 49 FRs, 20 mock endpoints, 56 E2E", "DN-01..17"). v0.2 has 26 / 97 / 67 / 21 endpoints / 48 E2E and DV-01..15. | — | The Delivery Lead updates the tracker. The auditor did not edit it. |

### Deviation verification (URS §7)

| DV | Category claimed | Live defect reproduced? | Category allowed by D7? |
|---|---|---|---|
| DV-01 | Broken link | Yes: drawer (375) "Tetapan" → `/settings` returns 404. | Yes |
| DV-02 | Broken link | Yes: "Mula Latihan" → `/latih-tubi` returns 404; `/practice` returns 200 "Latih Tubi". | Yes |
| DV-03 | Contradictory rule | Yes: register hint "Minimum 6 aksara", reset placeholder "Minimum 6 aksara", profile hint "Sekurang-kurangnya 8 aksara". | Yes |
| DV-04 | Contradictory rule | Yes: `ic_number` maxlength 14 on register, 20 on reset-ic. | Yes |
| DV-05 | Contradictory rule | Yes: login 128,989 vs `/admin` "Soalan Aktif 130,152". | Yes |
| DV-06 | Contradictory rule | Yes: level picker visible for Ibu Bapa (evidence text needs a fix, AUD-M01-10). | Yes |
| DV-07 | Responsive defect | Yes: two columns at 768; role subtitles on 3 lines; placeholder clipped "Taip nama seko"; stats strip wraps "11 Tahap" (`login-768.png`, `register-768.png`). | Yes |
| DV-08 | Responsive defect | Yes: `/tetapan` at 375 has scrollWidth 408 vs 360. | Yes |
| DV-09 | Responsive defect | **No** (AUD-M01-02). | n/a |
| DV-10 | Layout defect | Yes: strip scrollWidth 694 vs clientWidth 640 at 1280, with a 15px native scrollbar (310px wide at 375). | Yes |
| DV-11 | Touch defect | Yes | Borderline → user decision |
| DV-12 | Visual state defect | Yes | **No** → user decision |
| DV-13 | "Layout" defect (stale title) | Yes | **No** (copy) → user decision |
| DV-14 | Visual/contrast | Yes | **No** → user decision |
| DV-15 | Accessibility | Yes (cards are `div @click`) | **No** → user decision |

### Flows walked (up to, never including, a destructive or sending click)

| Flow | Result |
|---|---|
| Guest → protected route (`/notifikasi`, `/profile`, `/notifikasi/unread-count`) → `/login` with no message | Matches FN-1.3.3 / FR-14 |
| Login (admin, separate context): eye toggle (password↔text, fa-eye→fa-eye-slash) → submit → `/admin` "Dashboard - Admin Panel", no flash, intended URL ignored | Matches FN-1.2.4, 1.3.1 / FR-04, FR-12 (loading label confirmed from the `x-if` template "Sedang Memasuki...") |
| Logged-in `/login` and `/register` render the guest page | Matches FN-1.3.4 |
| Register, per type: Pelajar default (level + IC shown), Guru (both hidden), Ibu Bapa (IC hidden, level shown = DV-06), back to Pelajar; Ting. 4 → grade 10; `?role=teacher|parent` ignored | Matches FN-1.4.6–1.4.8, 1.4.16 |
| Register school: 1 char → no dropdown; "sekolah" → 15 rows `limit=15`; "zzzqx" → "Tiada sekolah dijumpai"; click outside closes; pick → chip "{type} · {state}" + ✕, select and search hidden; ✕ restores | Matches FR-22 (state-only-with-empty-query listing not reproduced in this pass: rows were rendered but not visible after focusing; left as in discovery) |
| Forgot → token reset form (`/password/reset/{any}` with and without `?email=`), IC reset | Forms, fields, constraints, actions and titles match FR-27–35 |
| Logout | Link targets verified at all control positions (user desktop ×2 with title "Log Keluar", drawer, admin desktop ×2, admin "Lagi" menu). The click itself was not performed on the main session (to keep it logged in). The redirect behaviour relies on the inventory re-verification. |
| Role landing / view switch | Admin → `/admin` confirmed. The view switch ("Ke Admin Panel", "Student View", "Ke Dashboard") is excluded to M23. This is consistent with TRACKER M23 "Admin ⇄ Student view switch". |
| Notifications: filters (all 6 pills + active states), pagination 1280 ("Showing 1 to 20 of 167 results", aria labels, page 9 = 161–167 with 7 items, `?filter=unread&page=2` kept), 375 ("« Previous" span / "Next »" link), empty state on `?type=system` (Pilih absent, Tanda semua dibaca present), select mode (header actions and bins hidden, 21 checkboxes, "1 dipilih" → Tanda Dibaca + Padam shown, Pilih Semua → "20 dipilih", untick clears, Batal restores and clears), delete button opacity 0 → 1 only when the button itself is hovered, confirm texts from script | Matches FN-3.2.x / 3.3.x, apart from the tooltip (AUD-M01-03). Mark-read, read-all, bulk and delete were not clicked. |

## Claims verified (56)

| # | Claim (doc) | Result |
|---|---|---|
| 1 | Tab titles for S1–S5, S7–S11 exactly as SRS §2 (incl. S9 "Tetapan Peribadi" with no suffix, S5 "Reset Kata Laluan (No IC) - PRESTASIPLUS") | Correct |
| 2 | Login email: type email, required, autocomplete email, ph `nama@email.com` | Correct |
| 3 | Login password: required, autocomplete current-password, ph `••••••••` | Correct |
| 4 | "Ingat saya" `remember`, unticked | Correct |
| 5 | Login links: /password/reset, /password/reset-ic, /register, / | Correct |
| 6 | Login form POST /login, no `novalidate` (native validation) | Correct |
| 7 | Loading label "Sedang Memasuki..." with fa-circle-notch | Correct (template) |
| 8 | Welcome text "Teruskan pembelajaran anda dengan lebih 128,989 soalan latihan dalam 31 subjek berbeza!" + 3 tiles | Correct |
| 9 | Stats strip "128,989+ Soalan · 31 Subjek · 11 Tahap" | Correct |
| 10 | Footer "© 2026 PRESTASIPLUS. Platform Pendidikan Malaysia." on S1–S5 | Correct |
| 11 | Eye toggle switches type and fa-eye → fa-eye-slash | Correct |
| 12 | Admin login → `/admin`, no flash, intended URL ignored | Correct |
| 13 | Session cookie "under 1 day" / 120 min INFERRED | **Incorrect** (observed 2 h, AUD-M01-08) |
| 14 | `/login` renders unchanged when logged in | Correct |
| 15 | Register `name` required, ph `Muhammad Fulan bin Fulan` (DV-17) | Correct |
| 16 | Register `phone` tel, maxlength 14, inputmode tel, ph `Cth: 0191234567` | Correct |
| 17 | Register `ic_number` maxlength 14, inputmode numeric, ph `Cth: 031215101234`, PDPA hint text | Correct |
| 18 | Role cards copy (Pelajar/Guru/Ibu Bapa + subtitles), default student | Correct |
| 19 | Guru hides level + IC; Ibu Bapa hides IC but shows level (DV-06 live) | Correct |
| 20 | `grade` required only for student (DV-06 evidence) | **Incorrect** (still required for parent, AUD-M01-10) |
| 21 | Ting. n submits n+6 | Correct (Ting. 4 → 10) |
| 22 | Stepper 1-2-3 static, step 1 active, no click handler | Correct |
| 23 | Register state select: "Negeri", KL, N.Sembilan, P.Pinang labels | Correct |
| 24 | Register search ph "Taip nama sekolah...", limit 15, ≥2 chars | Correct |
| 25 | Register empty state "Tiada sekolah dijumpai"; outside click closes | Correct |
| 26 | Register chip "{type} · {state}" + ✕, select/search hidden; ✕ restores | Correct |
| 27 | Row sub-line "{type} · {state} · {PPD …}" (AC-08.2) | **Incorrect** (district may be "JPN …", AUD-M01-12) |
| 28 | Password hint "Minimum 6 aksara"; two toggles | Correct |
| 29 | Register loading "Sedang Mendaftar..." | Correct (template) |
| 30 | `?role=teacher`/`?role=parent` ignored | Correct |
| 31 | 🎒 floating emoji shown at any width (AC-06.1) | **Incorrect** (welcome-panel mascot, hidden at 375, AUD-M01-05) |
| 32 | Links "Log Masuk 🔑" → /login, "Daftar sebagai Penaja" → /sponsor/register, "Kembali ke Laman Utama" → / | Correct |
| 33 | S3 copy, email autofocus, POST /password/email, no IC link | Correct |
| 34 | S4 renders for any token; email prefilled from `?email=`, empty without it; placeholders "Minimum 6 aksara" / "Taip semula kata laluan"; autocomplete new-password; POST /password/reset | Correct |
| 35 | S5 copy, `ic_number` required maxlength 20 live (DV-04), ph `000101010000` (DV-18), hint text, fa-unlock-alt, no inputmode | Correct |
| 36 | 404: copy, "Halaman Utama" → /, "Mula Latihan" → /latih-tubi (404), no shell, system font | Correct |
| 37 | `/profile` hero: avatar ui-avatars `#4f46e5` size 200, crown badge, "Ahli sejak 6 Februari 2026", "Kemaskini Profil" → /profile/edit, no other blocks | Correct |
| 38 | Profile name slate-800 on gradient (DV-14 evidence) | Correct |
| 39 | `/profile/edit` header "Kemaskini Profil" / "Maklumat peribadi & sekolah anda" | Correct |
| 40 | Picture: accept jpeg/png/webp, hidden "Simpan" `#uploadBtn` fa-check, overlay black/40 + fa-camera, hint text, avatar `#6366f1` size 120 | Correct |
| 41 | Email disabled, no name, "Email tidak boleh diubah"; phone ph `012-3456789` | Correct |
| 42 | Bio maxlength 500, placeholder, counter updates as you type | **Incorrect** (static counter, AUD-M01-01) |
| 43 | Tahap: only "Sekolah Rendah" Darjah 1–6 for admin, current checked + gradient | Correct |
| 44 | Seed/E2E: admin at Darjah 1 "as live" | **Incorrect** (Darjah 4, AUD-M01-07) |
| 45 | Profile school: chip "SK · Johor · PPD …", clear fa-times-circle, "Semua Negeri" + 16 full names, ph "(min. 2 huruf)", limit 20, fa-school rows, two-line empty state | Correct |
| 46 | Password card: no required, no toggles, autocomplete current/new, hint "Sekurang-kurangnya 8 aksara" (live), fa-shield-alt, POST /profile/password | Correct |
| 47 | `/profile/edit` 375 "Simpan Profil" touches the right edge (DV-09) | **Incorrect** (AUD-M01-02) |
| 48 | `/tetapan`: all copy, 4 checkboxes unticked, times 05:30/04:30, faith options + values, "💾 Simpan Tetapan", POST (PUT) /tetapan | Correct |
| 49 | `/tetapan` admin shell header "Dashboard / Selamat datang, Admin"; 375 overflow 408 | Correct |
| 50 | Bell title "Notifikasi" → /notifikasi, "99+" at all widths | Correct |
| 51 | Badge refreshed only on page load; hidden at 0 INFERRED | **Incorrect** (60 s polling + code-observed hide, AUD-M01-04/09) |
| 52 | Shell account links (desktop sidebar, drawer incl. "Tetapan" → /settings, admin sidebar, admin "Lagi" → Log Keluar), logout title "Log Keluar" | Correct |
| 53 | Notification filters, counts "Semua (167)", "Belum Dibaca (166)", "Sudah Dibaca" (no count), active pill style; no highlight on `?type=` | Correct |
| 54 | Pagination text, aria labels, 9 pages, filter kept in links, mobile «/» variants | Correct |
| 55 | Select mode behaviour (hide/show sets, counter, Pilih Semua = page only, Batal clears) | Correct |
| 56 | Confirm texts "Padam notifikasi ini?" / "Padam ${n} notifikasi yang dipilih?", reload after actions, item click `!selectMode && markRead` | Correct |

## Coverage-matrix spot-check (hand, 34 rows)

S1-008/010/022/029/033/036/047, S2-020/035/041/055/060/066/070/083/085, **S2-007 (wrong, AUD-M01-05)**, S3-004/014, S4-007/011, S5-009/016, S7-007, S8-007/012/028/052/055/069, S9-014/021, S10-006, S11-017/027/035/061. All the others describe their element correctly. The 9 exclusions (S7/S8/S11-001–003, tournament banner `tournamentBanner()` → M16) are justified (hidden templates of a global component). The SHU/SHA range exclusions (global shell / M23 / other modules) are justified. The M01-relevant shell items are all mapped.

## Not verifiable read-only (unchanged; correctly marked INFERRED / UNVERIFIED COPY in the docs)

Post-submit results and messages (register, forgot, token reset, IC reset, profile / picture / password / settings saves, read-all, bulk actions, delete), the login throttle and the invalid-credentials alert (a failed login was not allowed; the docs rely on the discovery screenshot `login-error-desktop.png`), and non-admin role views and landings.

---

## Round 2: targeted re-audit of URS/SRS v1.1 (2026-09-25)

**Scope.** I checked the v1.1 changes for AUD-M01-01 to AUD-M01-12 against the documents and, where relevant, against the live site. The same read-only rules applied: no submits except page loads, and one throw-away guest context. AUD-M01-13 (tracker) is handled by the Delivery Lead and is out of scope. The main session is still logged in as admin.

### Verdict: **PASS**

There are 0 Critical and 0 Major findings. All 12 findings in scope are closed. There is 1 new Minor finding (AUD-M01-14), a stale summary line that does not block G1.

### Sanity checks (script)

| Check | Result |
|---|---|
| Content elements covered in URS §6 | 363/363, **0 unmapped** (9 are justified exclusions: tournament banner, M16) |
| Matrix rows ↔ §3 FN "EL" columns | 398 rows, 0 inconsistencies in either direction |
| FN → FR | 110/110 |
| Active AC → E2E | 97/97. AC-M01-26.4 is withdrawn: its ID is kept and is correctly no longer referenced by any E2E. The new AC-M01-22.3 → E2E-M01-49. |
| FR → E2E | 67/67. There are 49 E2E scenarios, all on 375/768/1280 |
| US ↔ FR ↔ E2E table | consistent; no orphan or dangling IDs |

### Finding status

| ID | Status | Evidence (docs v1.1 + live) |
|---|---|---|
| AUD-M01-01 | **Closed** | FN-2.2.7, AC-16.1, matrix S8-028, FR-39, SRS §8 and E2E-28 now specify a static "Baki: 500 aksara" that never updates. "Not deviations" lists it as replicated. Live (re-checked earlier): the textarea has no `x-ref`, and the counter stays at 500 while typing. |
| AUD-M01-02 | **Closed** | DV-09 is marked Withdrawn (URS §7, SRS §0.1, Q3). AC-26.4 is withdrawn with its ID kept. SRS §10 S8 now reads "Actions row inline, as live … none (DV-09 withdrawn)". E2E-47 asserts the inline row within the viewport, and its AC list is now 26.1–26.3, 26.5. Matches live: right edge 351/360. |
| AUD-M01-03 | **Closed** | `title="Padam"` is now in FN-3.2.9, AC-24.3, matrix S11-027/032, FR-61 and E2E-43. Live: `title="Padam"`. |
| AUD-M01-04 | **Closed** | FN-3.1.1 and FR-53 now specify a server-rendered badge, then `updateNotifBadge()` on load, every 60 s, and on a foreground push (M22). FR-59 is corrected: the pill and filter counts update on reload, and the badge updates within 60 s or on push. AC-22.3 is new and E2E-49 is new; `mock.pushNotification` is defined in SRS §7 and NFR-02. Live script: `updateNotifBadge(); setInterval(updateNotifBadge, 60000);` plus the call inside the FCM `onMessage` handler. |
| AUD-M01-05 | **Closed** | FN-1.1.1 now covers S2-001–006 only, "visible at every width". FN-1.4.1 now covers the welcome-panel mascot 🎒 (S2-007–019). The **matrix row EL-M01-S2-007 → FN-M01-1.4.1** is correct. AC-06.1 and FR-15 put 🎒 inside the panel (≥1024px, DV-07), and FR-01 no longer lists it. Live: 🎒 is inside `div.mascot` and hidden at 375. |
| AUD-M01-06 | **Closed** | FN-1.4.7, FN-2.2.8, AC-07.2, AC-16.2, matrix S2-040/S8-030, FR-20, FR-40 and E2E-29 all state that "SEKOLAH RENDAH" / "SEKOLAH MENENGAH" is displayed via CSS uppercase. Live: `text-transform: uppercase`. Icons are `fa-school` / `fa-building` on register and `fa-school` on the profile, as FR-20/40 say. |
| AUD-M01-07 | **Closed** | SRS §6.8 admin seed: grade 4 "(Darjah 4, as the live admin)", types include `spaced_review`. E2E-29: "Darjah 4 checked". Live: radio value 4 checked; SPACED_REVIEW is on page 1. |
| AUD-M01-08 | **Closed** | FN-1.3.2, AC-03.2 and BR-06 are now "OBSERVED (120 min cookie expiry)". The remember duration stays INFERRED, and OQ-9 is narrowed to the remember-me duration. Live: both cookies expire 2 h after login. Laravel re-issues them on every response, so "after the last response" is correct. |
| AUD-M01-09 | **Closed** | AC-22.2 and FR-53 now say "OBSERVED, page script" for hiding the badge at 0. OQ-7 is narrowed to the S11 "Peti Masuk" pill, and FR-54 keeps that pill INFERRED. Correct. |
| AUD-M01-10 | **Closed** | The DV-06 live column now states that `grade` stays `required=true` for Ibu Bapa and becomes `false` only for Guru. Live matches. |
| AUD-M01-11 | **Closed** | DV-11…DV-15 each read "**Default: replicate live**" with a "*Proposed fix*" and "Needs user decision". Categories are marked outside D7 (DV-11 borderline). **The default is the one fully specified:**<br>• FR-61 and E2E-43 (hover-only);<br>• FR-55, AC-23.2 and E2E-38 (no pill highlighted);<br>• FR-47, AC-19.4 and E2E-33 ("Dashboard" / "Selamat datang, Admin");<br>• FR-38, AC-14.2 and E2E-26 (slate-800);<br>• FR-19/20/66, AC-26.6 and E2E-48 (click/tap only).<br>In each, the alternative appears only as an "If DV-nn is approved" clause. SRS §10 and NFR-05 are consistent, and US-26 names only DV-07/08/10 plus the conditional ones. |
| AUD-M01-12 | **Closed** | AC-08.2 now reads "{jenis} · {negeri} · {daerah}" with the district as stored (e.g. "PPD SEGAMAT", "JPN PERLIS"). E2E-15 reads "{type} · {state} · {district}" with the same examples. FR-22 was already correct. Live: "SK · Perlis · JPN PERLIS", "SK · Johor · PPD SEGAMAT". |

### Spot-check of 10 edited passages (for new inaccuracies)

| # | Passage | Result |
|---|---|---|
| 1 | FR-38: name "Outfit 30px/700, slate-800 `#1E293B`" | Correct (live: Outfit, 30px, 700, rgb(30,41,59)) |
| 2 | FR-53: badge "rendered with the page", 99+ cap, hidden at 0, load / 60 s / push | Correct |
| 3 | FR-59: pill and filter counts only on reload; badge ≤60 s | Correct (no count-update code on the item; badge polling) |
| 4 | FR-61 / E2E-43: title "Padam", opacity 0, `mouseenter`/`mouseleave` on the button itself | Correct |
| 5 | FR-20: school/building icons + CSS uppercase | Correct |
| 6 | AC-08.2 / E2E-15: district examples | Correct |
| 7 | DV-06 live evidence (required stays true for parent) | Correct |
| 8 | FN-1.3.2 / BR-06: 120 min session and XSRF cookies, no remember cookie | Correct |
| 9 | FR-15 / AC-06.1: 🎒 inside the welcome panel, floating emoji at every width | Correct (375 shows 📚 ✏️ ⭐ 🎨 🚀 💡 only) |
| 10 | FR-47 / AC-19.4 / E2E-33 default header "Dashboard" / "Selamat datang, Admin", tab title "Tetapan Peribadi" | Correct |

### New findings

| ID | Severity | Doc + section | What's wrong | Required fix |
|---|---|---|---|---|
| AUD-M01-14 | Minor | SRS §13 Q1 | The summary of URS OQ-1…OQ-9 still lists "zero-count badge" and "session durations" as inferred topics. After v1.1, OQ-7 covers only the S11 "Peti Masuk" pill and OQ-9 covers only the remember-me duration (both the badge and the 120 min session are now OBSERVED). | Reword Q1 to "Peti Masuk pill at zero" and "remember-me duration". |
