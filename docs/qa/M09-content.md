# QA report: M09 Content, reader scope (G5)

Scope: L03 Panduan (S26, S27), L12 Video (S17-S20), L25 Artikel (S15, S16), L32 Audio KBAT (S21 and the provisional player). Out of scope: M09 admin screens (parked), perutusan S22-S25 and S28 (M09-T4b).
Date: 2026-10-02. Branch `feature/student-prototype`. Tester: qa-engineer.

## Verdict: READY (reader scope)

- No Critical or High bug. No Medium or Low product bug found.
- Every in-scope AC is Pass, either by an executed E2E/unit test or by a manual check, with the exceptions listed under "Caveats" (provisional ACs and two items checked at unit level only).
- One E2E flake (passed on re-run), see Runs. The perf test file did not fail this time.

| Row | Screens | Verdict |
|---|---|---|
| L03 Panduan | S26, S27 | Ready |
| L12 Video | S17, S18, S19, S20 | Ready |
| L25 Artikel | S15, S16 | Ready |
| L32 Audio KBAT | S21 + provisional player | Ready (player ACs are provisional, L-3) |

## Environment

- Build: `npx vite build --mode e2e --outDir dist-e2e-4805`, served by `vite preview --port 4805 --strictPort` (stopped afterwards). Ports 4173/5173 not used.
- Scratch Playwright config (copy of `playwright.config.ts`): port 4805, outputDir `test-results-m09qa`, testDir `e2e`, 2 workers, 120 s timeout. Deleted afterwards together with `dist-e2e-4805`.
- Chromium, projects mobile 375x812, tablet 768x1024, desktop 1280x800. Manual checks used Playwright MCP lane 3 against the local preview only (never the live site).
- Machine shared and loaded: E2E run took 17.5 min.

## Runs

| Run | Command | Result |
|---|---|---|
| E2E, 4 specs (`artikel`, `smoke-video`, `audio-kbat`, `smoke-panduan`), 195 tests = 65 per project | `npx playwright test -c <scratch config> <4 specs>` | mobile 65 pass / 0 fail; tablet 65 pass / 0 fail; desktop 64 pass / 1 fail. Total 194 pass, 1 fail |
| Re-run of the single failure (`smoke-video.spec.ts` "SRS §12 #49", desktop, 3 account variants) | `-g "SRS §12 #49" --project=desktop` | 3 / 3 pass. Classified as a load flake |
| Unit | `npx vitest run --project unit src/modules/m09-content --pool=threads --maxWorkers=1` | 21 files, 428 tests, 428 pass, 0 fail, 0 skipped (includes `content-store.perf.test.ts`, which did not fail this run) |

Flake detail: first run, desktop, account "Murid", `/video?page=95` showed 0 `video-card` for the 5 s expect budget (expected 4). The same test passed for Murid, Guru and Admin Sekolah on re-run (14-21 s each). The app boot is slow on this machine under 2 workers, so this is environmental. Not reproduced, no bug raised. Recommend the owner keep an eye on it (see Observations).

## AC table

Method key: E = E2E spec test (name given by SRS §12 number; all 3 projects executed), U = unit test (`src/modules/m09-content/__tests__`), M = manual check on the local preview (lane 3). The AC-to-test mapping for E rows is by test title and scope; I did not re-audit each assertion line.

### L25 Artikel (S15, S16)

| AC | How verified | Result |
|---|---|---|
| 06.1 header, subtitle, tab | E #15 (logged in); M title "PRESTASIPLUS - Platform Latih Tubi Nasional", h1 "Artikel" | Pass |
| 06.2 18 cards, first 5, card anatomy, HOT | E #15; M first 3 cards ("Tips Belajar", "Cikgu Demo 01", "👁️ 310", "7 bulan yang lepas", HOT on the 2nd) | Pass |
| 06.3 category pill, 7 Berita, hot hidden | E #16 | Pass |
| 06.4 search keeps in pills | E #16 | Pass |
| 06.5 pager keeps category | E #17 | Pass |
| 06.6 empty state | E #17 | Pass |
| 06.7 6 columns at 1280, no wrap in meta | E #15 (1 / 2 / 3 / 6 columns, meta no wrap) | Pass |
| 07.1 hot section, 6 cards, PILIHAN / POPULAR | E #18, U reader-handlers (6 distinct from featured + top-10) | Pass |
| 07.2 differs per seed (provisional) | E #18 new seed (`@provisional`) | Pass (provisional) |
| 07.3 hot hidden with filter | E #16, #18 | Pass |
| 08.1 guest public layout and hero | E #19 | Pass |
| 08.2 guest hot, search, pills, grid, pager | E #19 | Pass |
| 08.3 guest CTA and footer | E #19 | Pass |
| 09.1 header, breadcrumb, chips | E #20 | Pass |
| 09.2 author card, Pembaca 597, no like button | E #20 | Pass |
| 09.3 body rendered as HTML | E #20 | Pass |
| 09.4 share links, "Link Disalin!" 2 s | E #21 | Pass |
| 09.5 related cards | E #22 | Pass |
| 09.6 aside from lg only | E #22 | Pass |
| 09.7 Pembaca +1 per open | E #23 (provisional part: no dedup) | Pass |
| 10.1 unknown slug is standalone 404 | E #24; M 404 page at all three widths (title "404 - Halaman Tidak Dijumpai \| PRESTASIPLUS") | Pass |
| 10.2 guest detail in public layout (provisional) | E #19 guest detail (`@provisional`) | Pass (provisional) |
| 11.1 dashboard feed reads the M09 store | U `getLatestArticles` = first 5 of list (reader-handlers). Dashboard page `/dashboard` is not built in this build (shows 404, M05), so the UI side could not be exercised | Pass (unit), UI Blocked by M05 |
| 11.2 teacher article flow (provisional, M10) | Not in reader scope (needs M10 `/guru/artikel`) | Blocked (out of scope) |

### L12 Video (S17-S20)

| AC | How verified | Result |
|---|---|---|
| 24.1 header, tab, pills, counts, Tambah Video | E #47 (all 3 projects, accounts Murid, Guru, Admin Sekolah); M tab "Video Pembelajaran - PRESTASIPLUS" | Pass |
| 24.2 24 cards in live order, card 1, pager | E #47; M 24 thumbnails all `img.youtube.com/vi/...` | Pass |
| 24.3 "Lain-lain (0)" inert, `?category=lain-lain` | E #48 | Pass |
| 24.4 `?category=motivasi` | E #48 | Pass |
| 24.5 `?subject=5` pills, Reset Subjek, order, total 97 | E #48, #49 | Pass |
| 24.6 no-match zero pills and empty state | E #48 | Pass |
| 24.7 `?page=95`, pager keeps filters | E #49 (flaked once under load, passed on re-run) | Pass |
| 25.1 guest `/video` public layout, no Tambah | E #50 | Pass |
| 25.2 guest CTA and footer | E #50 | Pass |
| 26.1 S18 #2224 header, tab, iframe, meta, chips, +1 view, guest variant | E #51 and guest S18 test; M iframe `https://www.youtube.com/embed/iqtUCV6AHuI`, tab "Sejarah Tingkatan 1: Bab 1 - Mengenali Sejarah - Video PRESTASIPLUS" | Pass |
| 26.2 related videos highest id first | E #51 | Pass |
| 26.3 `/video/999999` is the 404 page | E (S18 and S19 unknown id, admin; guest test); M all widths | Pass |
| 27.1 S20 header, labels, uploader strip, footer row | E #52 (admin) | Pass |
| 27.2 platform detection and thumbnail | E #52 | Pass |
| 27.3 admin school disabled; guru SMK DEMO (provisional) | E #52 and `@provisional` tests | Pass (provisional part) |
| 27.4 required fields, Batal | E #52 | Pass |
| 27.5 publish as pelajar (provisional) | E S20 `@provisional` tests (lines 490-590 of the spec) | Pass (provisional) |
| 28.1 Edit / Padam for admin, confirm dismiss | E #54 | Pass |
| 28.2 S19 preloaded form and button order | E #54 | Pass |
| 28.3 save edit (provisional) | E S19 provisional test | Pass (provisional) |
| 28.4 delete (provisional) | E S19 provisional test; U reader-handlers DELETE | Pass (provisional) |
| 28.5 non-owner has no Edit/Padam, S19 redirects, API 403 (provisional) | E #55; M pelajar `/video/2224/edit` lands on `/dashboard`; U PUT/DELETE 403 | Pass (provisional) |
| 42.2 (S19/S20 guest to `/login`) | E "S19 and S20 send a guest to /login" | Pass |

### L32 Audio KBAT (S21, player)

| AC | How verified | Result |
|---|---|---|
| 22.1 shell header without subtitle, tab "Audio KBAT" | E #45; M title "Audio KBAT", h1 "Audio KBAT" | Pass |
| 22.2 hero gradient and text colours | E #45 | Pass |
| 22.3 filter button visible, empty copy "Belum ada set Audio KBAT yang approved." | E #45 | Pass |
| 22.4 only approved set listed (provisional) | E #46 `@provisional` | Pass (provisional) |
| 23.1 player page, 4 sections, 8/8/8/6 questions, Hantar, 404 for draft/unknown (provisional) | E #46 (two tests) | Pass (provisional) |
| 23.2 submit, score, form locked (provisional) | E #46; U attempt handler (422 on bad attempt, 404 unknown/draft) | Pass (provisional) |
| 42.2 guest `/audio-kbat` to `/login` | E #71 | Pass |
| 42.1 admin sees S21 in user shell | E #45 admin | Pass |

### L03 Panduan (S26, S27)

| AC | How verified | Result |
|---|---|---|
| 36.1 standalone layout, title, hero, 5 tabs, footer | E smoke-panduan guest test; M title "Panduan Pengguna — PRESTASIPLUS", h1 | Pass |
| 36.2 hash routing for all roles, unknown hash, tab click replaces hash | E hash tests (5 roles), unknown hash, tab click | Pass |
| 36.3 FAQ items independent | E "FAQ items open and close independently" | Pass |
| 36.4 top bar logged in / guest, menu below lg | E guest, logged-in and menu-toggle tests | Pass |
| 37.1 help box mailto and WhatsApp | E guest test | Pass |
| 37.2 register button for guest only | E guest and logged-in tests | Pass |
| 38.1 S27 renders the same page when logged in | E; M `/pusat-tuisyen/panduan` h1 identical at 3 widths | Pass |
| 38.2 S27 guest to `/login`, `/panduan` open | E "guest: redirected to /login" | Pass |

### Shared (nav, access, responsive)

| AC | How verified | Result |
|---|---|---|
| 40.1 sidebar at 1280 | M sidebar links: Perutusan `/perutusan`, Artikel `/artikel`, Video `/video`, Audio KBAT `/audio-kbat`, Panduan `/panduan` | Pass |
| 40.2 drawer below 1024 | M at 375: Perutusan, Artikel, Video, Audio KBAT, Panduan `/pusat-tuisyen/panduan` (pelajar account) | Pass |
| 42.1 admin uses user shell for reader pages | E #15 admin, E #45 admin | Pass |
| 42.2 guests: `/audio-kbat`, `/video/tambah`, `/video/2224/edit`, `/pusat-tuisyen/panduan` to login; `/artikel`, `/video`, `/panduan` open | E (guest tests of all four specs) | Pass (reader routes only; perutusan and admin routes out of scope) |
| 42.3 pelajar `/admin/articles` lands on `/dashboard`, API 403 | M redirect confirmed; U admin-handlers 403 | Pass (provisional) |
| 43.1 no horizontal scroll, 375 / 768 / 1280 | E (responsive tests in `smoke-video`, `smoke-panduan` "every role panel fits"; grid tests in `artikel`); M sweep of 11 routes x 3 widths: `scrollWidth <= clientWidth` on every route (artikel, artikel detail, 404, video, video detail, tambah, audio-kbat, panduan, tuisyen panduan; `/video/2224/edit` as pelajar redirects) | Pass |
| 43.3 grid columns | E #15 (articles 1 / 2 / 3 / 6), E responsive (video grid), E panduan tabs 2 / 3 / 5 | Pass |
| 43.4 S19 / S20 footer buttons on one row at 375 | E #52, #54 | Pass |
| 43.2 table cards (S1, S5, S9) | Admin screens, out of scope | Not applicable |

## D22 spot-check (manual)

- `/video`: 24 thumbnails, all `https://img.youtube.com/vi/<id>/hqdefault.jpg`. `/video/2224` embeds `https://www.youtube.com/embed/iqtUCV6AHuI`. No placeholder or generated media on S17/S18.
- `/artikel`: cards use the 📰 emoji, no images; the page images are only the shell logo (`/images/logo-custom.png`) and the shell's initials avatar (SVG data URI, the logged-in demo user, not M09 content).
- Names on the screens: only "Admin Demo", "Cikgu Demo 01", "Pelajar Demo" (fictitious). The live video data (`_live-videos.json`) records the uploader as "platform" for all 2260 rows; no person names found on these screens.
- Console on the pages visited: 0 errors. Only report-only CSP info messages from the YouTube embed and one GPU warning.

## Bugs

None open for the reader scope. No Critical, High, Medium or Low product bug was found.

## Observations (not bugs)

1. O-1: `/dashboard` renders the 404 page in this build (M05 dashboard not built). Affects the "land on session landing page" redirects (AC-28.5, AC-42.3) and AC-11.1 UI check: the redirect itself works, but the destination is currently a 404. Owner: M05. Re-check the redirect target when M05 ships.
2. O-2: E2E flake of `smoke-video` "#49" on desktop (see Runs). It looks load-related (`/video?page=95` rendered no cards within 5 s while the app was booting under 2 workers). If it recurs on a normal machine, raise the cards' expect timeout in that test or have it wait for the grid. Owner: frontend (test code).
3. O-3: The provisional ACs (07.2, 10.2, 22.4, 23.x, 27.3 guru part, 27.5, 28.3-28.5, 42.3) pass against INFERRED / PROPOSED behaviour. They cannot be proven against the live site (L-3, L-7).
4. O-4: Tablet/mobile run with `isMobile`; the page `scrollWidth` reads 15 px lower than the viewport when the vertical scrollbar is present on the desktop engine. Not an issue.

## Caveats on coverage

- E rows are mapped by test title and SRS §12 number; I did not audit each assertion. Manual re-checks were done for titles, headings, shell links, thumbnails, overflow and redirects.
- AC-11.1 UI and AC-11.2 are not exercisable from the reader scope (M05 dashboard, M10 teacher flow).
- AC-42.3 API 403 and AC-28.5 API 403 verified at unit level only (mock handlers), not through the browser.

## Files

- Specs executed: `e2e/m09-content/artikel.spec.ts`, `smoke-video.spec.ts`, `audio-kbat.spec.ts`, `smoke-panduan.spec.ts` (unchanged, no test code written).
- Scratch logs: `C:\Users\hp\AppData\Local\Temp\claude\d--Dev-Projects-pretasiplus-app\3cab13af-f8cd-4424-9a30-02762f740563\scratchpad\m09-qa\` (`e2e1.log`, `preview.log`).
- Cleanup done: preview on 4805 stopped, `dist-e2e-4805`, `test-results-m09qa` and the scratch Playwright config removed.
