# M20 Marketplace (matrix row L37, student scope) - G5 QA

Slug: `m20-marketplace`. Role under test: Murid / pelajar (`pelajar@demo.test`). Date: 2026-10-09. Inputs: SRS M20 v1.2 (incl. section 1 "Release 1.0 deferral"), URS M20 v1.2 (ACs, section 7), discovery `docs/discovery/M20-marketplace.md` and live screenshots `docs/discovery/img/M20/` (main tree).

## Verdict

| Row | Screens | Verdict |
|---|---|---|
| L37 Marketplace (student) | S6 `/marketplace`, S7 `/marketplace/:slug`, S8 `/marketplace/penjual/:id`, W `/marketplace/:slug/whatsapp` | **Ready (functional), with 3 open Medium/Low fidelity bugs for the Delivery Lead to rule on** |

Reasons: all 30 in-scope ACs pass (E2E 57/57 plus 12 added QA legs, unit 66/66, exploratory at 320/375/768/1280). No Critical or High bug is open and no horizontal scroll was found at any width. Three visual differences from live that are not in URS section 7 are reported as bugs (BUG-M20-01 and 02 Medium, BUG-M20-03 Low). They change no flow, copy or state, so under the stated criterion they do not block "Ready", but strict fidelity (CLAUDE.md section 6) says they should be fixed or recorded as deviations before the row is closed. Admin S1-S5, seller S9-S12, registration R and FR-M20-79 are Deferred (release 1.0), not Fail.

## Environment

- Worktree branch `worktree-agent-ac523e463be960c73`, rebased on `feature/student-prototype`; base contains af310de (SRS deferral note).
- Build `vite build --mode e2e --outDir dist-e2e-5120`, preview on port 5120 (my own, stopped at the end). Scratch Playwright config (PORT 5120, webServer timeout 900000, `expect.timeout` 30 s, test timeout 120-180 s) was deleted, not committed. Port 4173/5173/live untouched.
- Exploratory browser: Playwright MCP lane 3 only (`mcp__playwright3__*`), logged in as pelajar through the login form. `wa.me` was aborted at context level, the real site was never reached. Screenshots in the scratchpad `m20-qa/` folder (paths below).
- Live site was not used; screenshots in `docs/discovery/img/M20/` were the fidelity reference.
- The machine was at 100% CPU from other sessions during the whole run (unit run 366 s; E2E about 1 h).

## Runs

| Run | Command | Result |
|---|---|---|
| Unit | `npx vitest run src/modules/m20-marketplace --pool=threads --maxWorkers=2` | 4 files, **66/66 pass** |
| E2E run 1 (`expect` 5 s, as in repo config) | `npx playwright test -c <scratch> e2e/m20-marketplace --workers=1 --timeout=120000` | 42 pass, **15 fail** (mobile 8, tablet 3, desktop 4). Every failure was a 5 s `expect` timeout on a screen that had rendered only the shell (`product-card` count 0, `shell-user-title`/`marketplace-empty` not found); error-context shows the page mid-load. Cause: CPU starvation. Not an app result. |
| E2E run 2 (started as full rerun, stopped by me after 8 tests under the same load) | same | mobile tests 1-8 reproduced 3 of the same timeouts at 5 s while CPU was still 100%; run aborted, no result counted. |
| E2E run 3 (`expect` 30 s in the scratch config only) | same, `--timeout=180000` | **57/57 pass** (mobile 19, tablet 19, desktop 19) in 56 min. |
| Extra QA legs `e2e/m20-marketplace/qa-l37.spec.ts` (new, committed test code) | 4 tests x 3 projects | 11/12 pass, the failure was my own test (innerText vs textContent whitespace in the wallet chip, "370\nkoin" vs "370koin"); test fixed, rerun of that test: 3/3 pass. Total 12/12. |
| Exploratory, lane 3 | see below | done at 320, 375, 768, 1280 |

Per-viewport E2E result (run 3 + QA legs): mobile 375x812 23/23, tablet 768x1024 23/23, desktop 1280x800 23/23.

## AC table (in scope)

Legend: E2E ids are the test titles in `smoke-marketplace.spec.ts` (M), `smoke-product.spec.ts` (P) and `qa-l37.spec.ts` (Q). EX = exploratory (section below). Scratch screenshots are under `C:\Users\hp\AppData\Local\Temp\claude\d--Dev-Projects-pretasiplus-app\3cab13af-f8cd-4424-9a30-02762f740563\scratchpad\m20-qa\` (abbreviated `SCR\`).

| AC | Scope here | Test cases | Result |
|---|---|---|---|
| AC-M20-01.3 | Pelajar sees "Marketplace" in the menu and no "Urus Produk" / "Urus Penjual" (admin/guru legs deferred or shell-owned) | EX: sidebar and mobile drawer link list shows `Marketplace -> /marketplace`, no `/admin` or `/seller` link | Pass |
| AC-M20-01.4 | Pelajar without a seller: no `/seller/*` link in menu or drawer | EX: link scan at 1280 and 375 | Pass |
| AC-M20-01.5 | S6-S8 in the user shell, no tournament banner | EX screenshots `SCR\s6-1280.png`, `s7-1280.png`, `shop-1280.png`, `list-375.png` | Pass |
| AC-M20-02.1 (S6) | S6 header and tab title | M "E2E-M20-06/49" | Pass |
| AC-M20-02.2 (S7 #1, #5, S8 #1) | Headers and tab titles | P "E2E-M20-07/55", P "E2E-M20-58/59", M "E2E-M20-07/64"; EX titles | Pass |
| AC-M20-03.1 | Guest to `/login` on S6, S7, S8, W | M "E2E-M20-08" (S6, S8), Q "AC-M20-03.1" (S7, W) | Pass |
| AC-M20-03.3 | Pelajar can open S6, S7, S8 | every E2E logs in as pelajar; EX | Pass |
| AC-M20-04.1 (buyer routes) | Unknown S7 slug, unknown/non-numeric S8 id show global 404 with exact copy | M "E2E-M20-12", P "E2E-M20-12/82"; EX `SCR\nf-375.png` | Pass |
| AC-M20-04.3 (buyer part) | Non-routes (cart, pesanan) show 404 | P "E2E-M20-12/82" | Pass |
| AC-M20-05.1 (S6) | Prices, discount badges, no badge on #5 | M "E2E-M20-50" | Pass |
| AC-M20-05.2 (S8) | "Bergabung 7 bulan yang lepas"; clock 2026-10-10 gives 8 | M "E2E-M20-07/64", Q "AC-M20-05.2" | Pass |
| AC-M20-05.3 (S6) | No pager with 10 products; 20 per page and pager with `m20-many` | M "E2E-M20-54" (page 2 empty), unit `__tests__/mock/buyer.test.ts` (`m20-many` fixture). No E2E for the pager UI. | Pass (pager UI by unit test only, see Observation 5) |
| AC-M20-05.5 (S6) | Loading state at 2 s latency; failed request shows error box and retry | Q "AC-M20-05.5", M "E2E-M20-19" | Pass |
| AC-M20-15.1 | S6 search card, selects, sort default, chips and hrefs | M "E2E-M20-06/49"; EX `SCR\s6-1280.png` | Pass |
| AC-M20-15.2 | 10 cards in id order, content of #1, #3, #5, #9, card opens S7 | M "E2E-M20-50" | Pass |
| AC-M20-15.3 | Sort orders Harga up/down, Popular | M "E2E-M20-51/52/53" | Pass |
| AC-M20-15.4 | Chips and condition filter results | M "E2E-M20-51/52/53" | Pass |
| AC-M20-15.5 | Search + category + condition + sort combined, values stay selected | M "E2E-M20-51/52/53" | Pass |
| AC-M20-15.6 | "🛒 Tiada Produk Dijumpai / Cuba tukar kata kunci atau kategori" for no match, Digital, page 2, combined | M "E2E-M20-54"; EX `SCR\search0-1280.png` matches live `marketplace-empty.png` | Pass |
| AC-M20-16.1 | S7 #1 first-visit content, WhatsApp link `target=_blank`, no `rel` | P "E2E-M20-07/55"; EX: anchor is `<a target="_blank" href="/marketplace/<slug>/whatsapp">`, no `rel` attribute | Pass (no-`rel` is the built behaviour; live cannot be re-checked, see Observation 4) |
| AC-M20-16.2 | Thumbnail swaps main image, no request | P "E2E-M20-56" | Pass |
| AC-M20-16.3 | Seller card (link to S8), "Ulasan (0)", "Belum ada ulasan untuk produk ini", no form | P "E2E-M20-57"; EX seller link opens `/marketplace/penjual/1` | Pass |
| AC-M20-16.4 | Related products on #1, #7, #5 | P "E2E-M20-58/59" | Pass |
| AC-M20-16.5 | #5 and #7 variants (no struck price, "Digital", 5 thumbnails, "Terpakai") | P "E2E-M20-58/59" | Pass |
| AC-M20-16.6 (S7/S6/S8) | Each S7 load adds a view, list pages do not | P "E2E-M20-60" (S1/S9 view legs deferred) | Pass |
| AC-M20-17.1 | New tab hands over to `wa.me/60100000000?text=...`, no screen in the tab, S7 stays open | P "E2E-M20-61/62"; EX: popup attempted `https://wa.me/60100000000?text=Salam%2C%20saya%20berminat%20dengan%20produk%20"Beg%20Sekolah%20Anti-Air%20Premium"%20di%20PRESTASIPLUS%20Marketplace.` (aborted by my route), original tab unchanged | Pass (S9 counter leg deferred) |
| AC-M20-17.2 | Second click opens a second tab and a second hand-off | P "E2E-M20-61/62" | Pass |
| AC-M20-17.3 | Unknown slug on W shows 404 | P "E2E-M20-63" | Pass |
| AC-M20-18.1 | S8 shop card content | M "E2E-M20-07/64"; EX `SCR\shop-1280.png`, `shop-375.png` | Pass |
| AC-M20-18.2 | S8 grid of 10 cards in id order, struck price, no badge, no shipping line; card opens S7 | M "E2E-M20-65" | Pass |
| AC-M20-24.3 (buyer part) | No buy button or coin price; wallet chip unchanged after a hand-off; cart/pesanan 404 | Q "AC-M20-24.3", P "E2E-M20-12/82" (M19 S1 "59 payments" leg is admin, deferred) | Pass |
| AC-M20-24.4 (S7, S8) | Stars "☆☆☆☆☆", "(0)" | P "E2E-M20-57", M "E2E-M20-07/64" | Pass |
| AC-M20-25.1 (S6-S8) | No horizontal scroll, no text under 12 px at 375 / 768 / 1280 | M "E2E-M20-85/84", P "E2E-M20-84/85"; EX at 320, 375, 768, 1280: `scrollWidth == clientWidth` on S6, S6 empty, S6 category, S7, S8 and both 404 pages; no content text under 12 px (only shell sidebar chips "SPM" 10 px and "NEW" 8 px, not M20) | Pass |
| AC-M20-25.2 (S6-S8) | Grids 2/3/4 (S6, S8), S7 stacked at 375 and two columns from 768 | M "E2E-M20-85/84", P "E2E-M20-84/85"; EX `SCR\list-375.png`, `p1-375.png`, `p1-768.png` | Pass |

Count (in scope): 30 ACs (AC-M20-01.3, 01.4, 01.5, 02.1, 02.2, 03.1, 03.3, 04.1, 04.3, 05.1, 05.2, 05.3, 05.5, 15.1-15.6, 16.1-16.6, 17.1-17.3, 18.1, 18.2, 24.3, 24.4, 25.1, 25.2). **Pass 30, Fail 0, Blocked 0.**

### Deferred (release 1.0), not tested

AC-M20-01.1, 01.2, 01.6 (admin menus, "Kedai Saya"), 02.1/02.2 admin and seller headers, 03.2, 03.4, 03.5, 04.2, 05.4, 06.1-06.5, 07.1-07.3, 08.1-08.5, 09.1-09.4, 10.1-10.4, 11.1-11.3, 12.1, 13.1-13.3, 14.1-14.3, 19.1-19.4, 20.1-20.4, 21.1-21.3, 22.1-22.3, 23.1-23.4, 24.1, 24.2 (S1 leg), and the admin/seller legs of 05.2, 05.3, 16.6, 17.1, 17.2, 24.3, 24.4, 25.1, 25.2. Observed: pelajar opening `/admin/marketplace/products` currently renders the global 404 (route not registered in this release); `/seller/dashboard` was not asserted.

## Bugs

All three were found by comparing the rebuild with the live screenshots (`docs/discovery/img/M20/`); none of them is listed in URS section 7, and the SRS section 10 and FN-M20-4.1.3 / 4.2.3 text does not describe the layout detail, so the cause is partly a spec gap.

### BUG-M20-01 - S7 layout and icons differ from live (Medium, fidelity)
- Steps: log in as pelajar, open `/marketplace/beg-sekolah-anti-air-premium-vH1Fj` at 1280 and 768.
- Expected (live `product-desktop.png`, `product-used.png`, `product-tablet.png`): the "PENJUAL" card (uppercase label, rounded-square gradient avatar "J") sits in the right column directly under the details card, so the page has a two-column block (gallery | details + seller). Eye icon before "N tontonan" and a box icon before "Ada Stok"; truck icon before the shipping line and map pin before the location. "Belum ada ulasan untuk produk ini" is centred and muted in the "Ulasan (0)" card.
- Actual (`SCR\s7-1280.png`, `p1-768.png`, `p1-375.png`): the seller card is a full-width card below the gallery block with a mixed-case "Penjual" heading and a flat avatar; no box icon, no truck icon; empty-review text left aligned.
- Owner: frontend-developer (layout, icons); product-analyst to add the placement and icons to FN-M20-4.2.3 / 4.2.6 or record each as a deviation. Note the design system maps icons to Lucide (SRS 10.1), so icon shapes may differ from FontAwesome; the missing truck and box icons are omissions, not substitutions.

### BUG-M20-02 - S6 / S8 / S7 related cards differ from live (Medium, fidelity)
- Steps: open `/marketplace` at 1280 (also `/marketplace/penjual/1`, related products on S7).
- Expected (live `marketplace-desktop.png`, `shop-desktop.png`): white card with inner padding, the photo inset inside the card with rounded corners, "Terpakai" amber badge stacked on the left directly under the red discount badge, an icon before every shipping line (truck for Pos / Kurier, gift for Penghantaran Percuma, hand for COD, pin for Ambil Sendiri), filled blue verified tick.
- Actual (`SCR\s6-1280.png`, `shop-1280.png`, `list-375.png`): photo runs edge to edge at the top of the card with no inset, "Terpakai" is top-right, no icon before the shipping lines, the verified tick is an outline.
- Owner: frontend-developer; product-analyst for the missing icon rows in FN-M20-4.1.3 (the discovery inventory captured only `fa-store` on the card).

### BUG-M20-03 - S6 search card layout at 375 differs from live (Low, fidelity)
- Steps: open `/marketplace` at 375.
- Expected (`marketplace-mobile.png`): search input full width; "Semua Kategori" on its own row; "Semua Keadaan" and "Terbaru" side by side; compact "Cari" button on the next row.
- Actual (`SCR\list-375.png`): all three selects and the "Cari" button are separate full-width rows, so the filter block is about 230 px taller. Fully usable, no overflow.
- Owner: frontend-developer.

## Observations (not bugs)

1. **S8 banner (undocumented D9 fix).** Live `shop-desktop.png` renders the shop name on a white card and the description, rating, "10 produk" and "Bergabung" lines are unreadable (white on white). The rebuild shows a purple gradient banner with readable text (`SCR\shop-1280.png`). This is a sensible D9 fix but it is not in URS section 7; product-analyst should add a DV row.
2. **Relative time.** With the real clock (2026-10-09) the shop shows "Bergabung 8 bulan yang lepas", consistent with AC-M20-05.2.
3. **Console.** Only `favicon.ico` 404 (project-wide, not M20) on `/login`; no console error on S6, S7, S8 during the exploratory walk.
4. **"No `rel`" (INFERRED, to confirm at G5).** The built WhatsApp anchor has `target="_blank"` and no `rel`, as specified. The live inventory (`S7-product.json`, discovery) records no `rel` attribute either way, and the live site must not be touched, so the INFERRED label cannot be confirmed or refuted by QA. Note for security-engineer: `target=_blank` without `rel` is covered by SEC-M20-02 (backend recommendation).
5. **Pager UI** (AC-M20-05.3) has unit coverage only (`m20-many` fixture in `buyer.test.ts`); there is no E2E that renders the pager. Suggest adding E2E-M20-17 when the fixture hook is exposed to E2E.
6. **Timing.** The repo `expect` budget (5 s) is too tight when the machine is saturated: 15 of 57 tests timed out in run 1 with identical symptoms on all three viewports. With a 30 s budget 57/57 pass. No retry or app change was needed, but CI on a loaded runner may flake.
7. Product views accumulate across page loads inside one browser profile during exploratory use (31 to 36 after repeated visits); E2E starts from a fresh state, so AC-M20-16.6 holds.
8. Hit areas and fonts: card text and chips are at least 12 px at 320 px; the bottom nav overlay seen in full-page screenshots is the fixed "Lagi" bar, not a layout defect.

## Exploratory log (lane 3)

| Step | Result |
|---|---|
| Login as pelajar through `/login` | lands on `/dashboard` |
| `/marketplace` at 1280, 768, 375, 320 | 10 cards, 4 / 3 / 2 / 2 columns, no horizontal scroll (`SCR\s6-1280.png`, `list-375.png`, `list-768.png`) |
| `/marketplace?q=zzqxv` | empty state "🛒 Tiada Produk Dijumpai / Cuba tukar kata kunci atau kategori" (`SCR\search0-1280.png`) |
| `/marketplace?category=buku-rujukan` | filtered list (`SCR\cat-1280.png`) |
| S7 #1 at 1280, 768, 375, 320 | 4 thumbnails, details, seller card, "Ulasan (0)", related (`SCR\s7-1280.png`, `p1-768.png`, `p1-375.png`, `p1-320.png`) |
| WhatsApp button at 375 | new tab opens, navigates to the `wa.me` URL above (aborted), original tab unchanged (`SCR\p1-after-wa-375.png`) |
| Seller card link | `/marketplace/penjual/1`, title "JomBelajar Official - Marketplace PRESTASIPLUS", "☆☆☆☆☆ (0)", "10 produk" (`SCR\shop-375b.png`, `shop-1280.png`) |
| `/marketplace/tiada-produk-zzqxv`, `/marketplace/penjual/999999` | global 404 with the exact M01 copy at all four widths (`SCR\nf-375.png`, `nf-1280.png`, `nfShop-1280.png`) |
| Product without reviews | all 10 seeded products have none; S7 shows the empty text and no form |

## Re-test notes

- After BUG-M20-01/02/03 are fixed or recorded as deviations: re-run `e2e/m20-marketplace` on three projects (use a 30 s `expect` budget on a loaded machine) and repeat the screenshot comparison for S6, S7, S8 at 375 / 768 / 1280.
- When the admin and seller screens enter scope, re-open the Deferred ACs; the admin legs of AC-M20-16.6, 17.1/17.2 (S9 counter), 24.3 (M19 payments) and 25.x still need to run.
- New test code kept for the next run: `e2e/m20-marketplace/qa-l37.spec.ts`.
