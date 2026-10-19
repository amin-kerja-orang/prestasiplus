# M01 Authentication - G5 QA (L01 Profil Saya, L02 Tetapan Peribadi, L05 Log Keluar; user shell)

Date: 2026-10-02. Branch: feature/student-prototype. Slug: m01-authentication.
Scope: roles-matrix rows L01 (S7 `/profile`, S8 `/profile/edit`, M01-T6), L02 (S9 `/tetapan`, user-shell variant, M01-T7a), L05 (S6 `/logout` and user-shell account integration, M01-T5a) for Murid (pelajar@demo.test), Guru (guru@demo.test), Admin Sekolah (adminsekolah@demo.test). Admin-shell variants (T5b/T7b), login/register/password/notifications pages are out of scope.

## Verdict: READY (after re-run, 2026-10-02)

The initial run was Not ready because of BUG-M01-01 (High). The lead fixed it (and BUG-M01-03); the targeted re-run at the end of this document is fully green, so no Critical/High bug is open. BUG-M01-04 and BUG-M01-05 are Low platform items outside M01 and do not affect the verdict.

## Test runs (real tree, built with `vite build --mode e2e`, preview on port 4721)

| Run | Result |
|---|---|
| smoke-account + smoke-profile + smoke-tetapan, 3 projects, `--workers=2` | 90 tests: 83 passed, 7 failed. All 7 were the 30 s default test timeout inside `gotoApp` (profile specs 28, 30, 31; machine was loaded, run took 16 min). |
| Re-run of the 3 slow profile tests (28, 30, 31) x 3 projects, `--workers=1`, default 30 s | 7 passed, 2 failed (mobile 28 and 31 timed out at 30 s while the assertions had already reached the last step). |
| Same 9 with `--timeout=120000`, `--workers=1` | 9/9 passed (durations 20-34 s). Net: 90/90 functionally pass; the timeouts are a budget problem (see BUG-M01-03). |
| New `e2e/m01-authentication/qa-account.spec.ts` (QA additions), 3 projects, `--workers=2` | 15 tests: 11 passed, 1 skipped (drawer test on desktop, by design), 3 failed = the hero heading contrast test (BUG-M01-01) on mobile/tablet/desktop. |
| Unit: `src/app src/shells src/modules/m01-authentication/__tests__/lib`, run twice | Run 1: 194/195 passed, 1 failed (`registry.test.ts` "lazy-load one mock plugin per module", 30 s timeout). Run 2: 195/195. |
| `registry.test.ts` alone, 3 runs | 4/4 each; whole file takes 15-24 s, the lazy-load test alone 8-16 s. The flake is a time budget (see BUG-M01-04). |
| Unit: all `src/modules/m01-authentication` | 11 files, 203 tests, all passed. |
| `npm run typecheck` | Clean, no errors (no M09 errors present any more). |

Workers: 2 for the main run, 1 for the re-runs. Temp config, `dist-e2e-s2-qa`, `test-results-s2-qa` removed and the 4721 server stopped.

## Exploratory (Playwright MCP lane 3, local build; screenshots in `.playwright-mcp/lane3/`)

- Murid at 375: `/profile` hero, drawer (Profil Saya, Tetapan Peribadi, Tetapan, "Log Keluar" 44 px), logout lands on `/login`, Back stays on `/login`, direct `/profile/edit` and `/logout` while logged out end on `/login`. No horizontal scroll (scrollWidth equals clientWidth).
- Guru at 320/375/768/1280: `/profile/edit` (Tahap 3 columns at 320, cards 81 px wide, row aligned with cards, no overflow), picture choose plus Simpan (preview, then new avatar in hero, header and drawer after reload), `/tetapan` at 320 and 1280, save shows "Tetapan berjaya disimpan.", header logout at 1280 lands on `/login`.
- Admin Sekolah at 1280: `/profile` has no stats block, sidebar card name/email, links to /tetapan and /profile, sidebar logout icon (title "Log Keluar") lands on `/login`.
- Touch targets: header bell 36 px, hamburger 40 px, drawer close 32 px render 48/44/44 px effective via the `pp-hit` 6 px pseudo-element; tetapan checkboxes are 20 px but their label rows are clickable (verified by clicking the label text). Pass.
- Console: only `/favicon.ico` 404 (BUG-M01-05).
- Screenshots: `m01-profile-375.png`, `m01-drawer-375.png`, `m01-edit-375.png`, `m01-edit-768.png`, `m01-tetapan-320.png`, `m01-tetapan-1280.png`, `m01-tetapan-hero-1280.png` (bug).

## Test plan: AC to result

Spec abbreviations: ACC = smoke-account, PRO = smoke-profile, TET = smoke-tetapan, QA = qa-account (added by QA). M = manual browser check above. All E2E rows ran on mobile/tablet/desktop.

| AC | Test cases | Result |
|---|---|---|
| 13.1 logout controls (user shell: sidebar icon, header icon with tooltip, drawer text) | ACC identity/logout x3 accounts; M | Pass |
| 13.2 logout lands on `/login`, no message, no confirm | ACC; M | Pass |
| 13.3 protected page and Back after logout end on `/login` | ACC (protected page); QA Back test; M | Pass |
| 14.1 header "Profil Saya" / "Statistik & Pencapaian Anda" | PRO E2E-26; M | Pass |
| 14.2 hero (avatar, crown, white name, email, "Ahli sejak", Kemaskini Profil) | PRO E2E-26 (incl. white name AA); M | Pass |
| 14.3 admin: no stats block (checked for Admin Sekolah) | PRO E2E-26; M | Pass (OQ-4 other roles not specified) |
| 15.1 picture card, hint, overlay, accept list | PRO E2E-27; M | Pass |
| 15.2 preview and "Simpan" appear, no upload yet | PRO E2E-27; M | Pass |
| 15.3 upload persists; invalid file shows error | PRO (save, reject type, size); M (PNG save, reload) | Pass |
| 16.1 S8 header, prefill, disabled email, placeholders, static counter | PRO E2E-28 | Pass |
| 16.2 Tahap (Darjah, Tingkatan variant) | PRO E2E-29, 47 (320 px) | Pass |
| 16.3 Kembali to /profile, Simpan Profil submits | PRO E2E-28 | Pass (needs 120 s budget on slow machine, BUG-M01-03) |
| 16.4 save shows saved values and flash; empty name blocked | PRO E2E-28 | Pass (same note) |
| 17.1-17.5 school chip, clear, picker, empty, failing search, pick and save | PRO E2E-30, 47 | Pass (same note for the save test) |
| 18.1 password card labels, hint, no toggles | PRO E2E-31 | Pass |
| 18.2 wrong current shows error, valid change succeeds, new password logs in | PRO E2E-31 | Pass (same note) |
| 19.1 hero, cards, copy, faith options, button | TET E2E-32; QA contrast test | **Fail** (copy passes; hero heading unreadable, BUG-M01-01) |
| 19.2 defaults (unticked, 05:30, 04:30, faith blank) | TET E2E-32 (guru) | Pass |
| 19.3 controls independent, times always editable | TET E2E-32 | Pass |
| 19.4 admin shell variant | out of scope (T7b) | Not executed |
| 19.5 save round trip (pelajar, adminsekolah; guru manual) | TET save x2; M | Pass |
| 20.1 account links in sidebar and drawer | ACC; M | Pass |
| 20.2 admin sidebar | out of scope (T5b) | Not executed |
| 20.3 identity blocks (sidebar card, header avatar, drawer card with lowercase role code) | ACC x3 accounts; M | Pass (drawer shows "Student" via CSS `capitalize`, DOM is lowercase `student`; documented in `UserDrawer.vue` as live behaviour) |
| 21.1 drawer "Tetapan" opens `/tetapan` | QA drawer test (mobile, tablet); M | Pass |
| 21.2 404 page for `/settings` | not in this scope (L-row 404) | Not executed |
| 22.1 bell link, badge count, "99+" | ACC 99+ test; M | Pass |
| 22.2 no badge at 0 | ACC (ibubapa) | Pass |
| 22.3 refresh without reload (push event; 60 s poll) | ACC push test; QA 60 s clock test; unit user-shell.test | Pass |
| 05.1 guest redirect for /profile, /profile/edit, /tetapan | QA guest test; M | Pass (/notifikasi, /dashboard, /admin not in scope) |
| 26.1 no horizontal scroll, /profile, /profile/edit, /tetapan at 375/768/1280 (and 320 manual) | PRO, TET layout, ACC; M | Pass |
| 26.3 /tetapan stacked below 640 px, faith select fits | TET layout test; M at 320 | Pass |
| 26.6 cards click/tap select (level cards) | PRO E2E-29 | Pass |
| 26.7 no content text below 12 px (page content, excluding shell chrome) | M (script over main content at 375) | Pass |
| 26.4 withdrawn | n/a | n/a |

Counts: in-scope ACs executed 38 (Pass 37, Fail 1); not executed (out of scope): 19.4, 20.2, 21.2.

## Bugs

| ID | Severity | Description | Owner |
|---|---|---|---|
| BUG-M01-01 | High (FIXED, verified in re-run) | `/tetapan` hero heading "⚙️ Tetapan Peribadi" renders in dark slate (`rgb(30,41,59)`) on the slate gradient `#475569 to #64748B` (contrast about 1.9:1 at the dark end, 3.07:1 at the light end) instead of white as on live (`docs/discovery/img/M01/tetapan-mobile.png`). Same cause as DV-14 on the profile name: the user shell's heading colour overrides the inherited `text-white`. Hit by Murid, Guru and Admin Sekolah at every width. Steps: log in as guru@demo.test, open `/tetapan`. Expected white heading. Actual dark heading. Screenshots: `.playwright-mcp/lane3/m01-tetapan-hero-1280.png`, `.playwright-mcp/lane3/m01-tetapan-320.png`. Failing test: `qa-account.spec.ts` "AC-19.1 hero heading is readable" (3/3 projects). Suggested fix: put `text-white` on the `<h1>` in `TetapanPage.vue` (line 100), as done for the profile name. | M01-T7a (frontend-developer) |
| BUG-M01-03 | Low (FIXED, verified in re-run) | Three profile specs (E2E-28 save, E2E-30 pick school and save, E2E-31 password) do several `gotoApp` boots and take 20-34 s here; they hit the 30 s default and fail under load (2 mobile failures even with 1 worker). Tetapan spec already calls `test.slow()`. Fix: add `test.slow()` to these tests. | M01-T6 test code |
| BUG-M01-04 | Low (OPEN, routed to platform) | `src/app/__tests__/registry.test.ts` "lazy-load one mock plugin per module" is the reported flake: it imports every module mock plugin, 8-16 s alone, and exceeded the 30 s timeout once under parallel load. Fix: give that test a larger timeout (for example 60 s). | platform (F-31) |
| BUG-M01-05 | Low (OPEN, routed to platform) | `/favicon.ico` returns 404 on every page (console error); `index.html` has no icon link and `public/` has none. Not M01-specific. | platform / devops |
| OBS-M01-06 | Info | Shell header title truncates at 320 px ("Tetapan P...", subtitle ellipsised); for Guru the sidebar identity card and logout sit about 4400 px down the sidebar scroll (card uses `mt-auto` in a long scrolling aside); the header logout icon is always reachable. Both look like live shell behaviour; not logged as defects ("Perlu pengesahan" against live). | user shell |

Not logged (known decisions): tetapan loading/error "Cuba lagi", Darjah 3 columns below 360 px, white email/"Ahli sejak" on the hero, initials avatar SVG, `/dashboard` not built (login lands on the 404 page).

## Tests added by QA

`e2e/m01-authentication/qa-account.spec.ts` (5 tests x 3 projects): AC-13.3 Back after logout, AC-21.1 drawer Tetapan, AC-22.3 60 s bell refresh (mock clock), AC-05.1 guest redirect, AC-19.1 hero heading contrast (currently red, validates BUG-M01-01). It uses only existing fixtures; no media files were created (the picture check used an existing image under `docs/discovery/img/M01/`).

## Re-run after fixes (fresh `vite build --mode e2e`, port 4721, `--workers=2`, no fallback to 1 needed)

- `text-white` added to the `/tetapan` h1 (BUG-M01-01); `test.slow()` added to the profile describe (BUG-M01-03).
- E2E, 3 projects: qa-account + smoke-account + smoke-profile + smoke-tetapan = 105 tests: 104 passed, 1 skipped (drawer test on desktop, by design), 0 failed (6.6 min). This includes the heading contrast test and the three previously timing-out profile tests.
- eslint on TetapanPage.vue, smoke-profile.spec.ts and qa-account.spec.ts: clean.
- Lane 3 visual check: h1 computed colour rgb(255,255,255) at 320 and 1280; screenshots `.playwright-mcp/lane3/m01-tetapan-fixed-320.png`, `m01-tetapan-fixed-1280.png`, `m01-tetapan-fixed-1280b.png`. A screenshot taken straight after a live 320 to 1280 resize showed a transient mid-transition layout; after 2 s and on a fresh load the layout is normal with no overflow.
- Unit and typecheck results above are unchanged (only one CSS class changed in product code).
- Cleanup done: temp config, dist and results removed; 4721 server stopped.
