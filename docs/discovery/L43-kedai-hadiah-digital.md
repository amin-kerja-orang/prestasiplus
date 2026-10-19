# L43 Kedai Hadiah Digital (matrix #38, Murid) - discovery

Status: **Live probe DONE on 2026-10-02** (Playwright lane 2, admin session, GET only, no submits). Lane 1 was disconnected. Labels used below: OBSERVED = seen on live; NOT OBSERVED = could not be seen as admin; reference only = from `D:\Dev Projects\prestasiplus-reference` (secondary).

## 1. Routes and status (OBSERVED, admin session)
| URL | Status | Title / result |
|---|---|---|
| `/kedai-hadiah` (and `/hadiah`, `/kedai`) | **404** | "404 - Halaman Tidak Dijumpai \| PRESTASIPLUS". 404 body copy: "404", "🔍 Halaman Tidak Dijumpai", "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?", buttons "Halaman Utama", "Mula Latihan". Standalone page (no sidebar). |
| `/cikgu/hadiah` | **200** | Title "Kedai Hadiah Digital". Renders for admin in the **user shell** (sidebar + top bar), no redirect. |
| `/cikgu/hadiah?cat=all\|flagship\|ewallet\|telco\|gaming\|streaming\|food_beverage\|ecommerce\|education\|entertainment` | 200 | Same page, same empty copy for the cat values tried (all, gaming, flagship). |
| `/cikgu/hadiah/saya` | **200** | Title "Tebusan Saya" (user shell). |
| `/cikgu/hadiah/1` (item detail guess) | 404 | Standard 404 above. No item detail route found. |
| `/gamification/rewards` (M15 S5) | 200 | Title "Kedai Hadiah". |
| `/admin/hadiah` (M15 admin S1) | 200 | Title "Admin — Kedai Hadiah" (h1 "🎁 Admin — Kedai Hadiah Digital"). |

Conclusion: the inferred href `/kedai-hadiah` in `src/shells/nav/user-nav.ts:455` is **wrong for live (404)**. The reference spec (row 73, reference only) was right: the entry points to `/cikgu/hadiah`.

## 2. `/cikgu/hadiah` screen (OBSERVED, empty state only)
Shell: user shell for admin (left sidebar, top bar showing "Dashboard / Selamat datang kembali", coin/point/streak chips, bell, avatar initials, chat FAB). No admin-specific chrome. Page `<main>` content:
1. h1 "🎁 Kedai Hadiah Digital"; subtitle "Tukar token kepada hadiah digital — terus dihantar, tanpa pos."
2. Gradient (purple to pink) balance card: "TOKEN ANDA" value `0`; divider; "SYILING" value `256`; caption "100 syiling = 1 token"; white button link "Tebusan Saya" (clipboard icon) -> `/cikgu/hadiah/saya`.
3. Category chips (links, GET `?cat=`), active chip = purple filled "🌟 Semua" (default): 🌟 Semua (`all`), 🏆 Mahkota (`flagship`), 💳 E-Wallet (`ewallet`), 📱 Telco (`telco`), 🎮 Gaming (`gaming`), 🎬 Streaming (`streaming`), 🍔 Makan & Minum (`food_beverage`), 🛒 Shopping (`ecommerce`), 📚 Pembelajaran (`education`), 🎭 Hiburan (`entertainment`). At 1280 the chips wrap onto two rows.
4. Empty state text, centred, grey: "Tiada hadiah dalam kategori ini." (same copy for every cat tried; the page was never seen with cards).
- Card/grid, price, stock, redeem ("Tebus") button, confirm dialog, error copy: **NOT OBSERVED** (catalogue empty, as with admin Aktif = 0). Do not invent.
- Screenshots: `docs/discovery/img/L43/cikgu-hadiah-1280.png`, `-768.png`, `-375.png` (no personal names visible; avatar shows initials only).
- Network (page load, non-static): GET `/notifikasi/unread-count`, `/api/tournament/active`, `/chatbot/history?session_id=...`, `/api/offline/snapshot`, POST `/cdn-cgi/rum` (shell plumbing). **No shop-specific JSON/XHR endpoint**: the list is server-rendered, filters are plain GET links. Console: SW registered log only (plus shell errors recorded by the harness, unrelated).

## 3. `/cikgu/hadiah/saya` (OBSERVED)
Title "Tebusan Saya"; h1 "📋 Tebusan Saya"; link button "🎁 Kedai Hadiah" (back to shop); empty state "Belum ada tebusan. Kumpul syiling dulu, lepas tukar token dan tebus hadiah." with link "Layari Kedai Hadiah". Populated list/status chips: NOT OBSERVED.

## 4. Comparison
| | `/cikgu/hadiah` (L43) | `/gamification/rewards` (M15 S5) | `/admin/hadiah` (M15 S1) |
|---|---|---|---|
| Title / h1 | Kedai Hadiah Digital / "🎁 Kedai Hadiah Digital" | Kedai Hadiah / "🎁 Kedai Hadiah" | Admin — Kedai Hadiah / "🎁 Admin — Kedai Hadiah Digital" |
| Subtitle | "Tukar token kepada hadiah digital — terus dihantar, tanpa pos." | "Tebus token anda untuk hadiah menarik!" | "Urus catalog hadiah + proses tebusan pelajar." |
| Balance | Token Anda 0 + Syiling 256 ("100 syiling = 1 token") | "0 Baki Token 🎫" only | - |
| Filters | 10 category chips (GET `?cat=`) | none | category chips incl. "F&B", "E-Commerce" |
| Empty | "Tiada hadiah dalam kategori ini." | "🎁 Tiada Hadiah Tersedia / Hadiah akan ditambah tidak lama lagi. Tunggu ya!" | table of 59 rewards, all Off |
| Extra | "Tebusan Saya" page | none | Tebusan Queue, Tambah Hadiah, bulk actions |

- Different screens with different copy and layout: L43 is **not a byte-identical alias** of S5 (this contradicts the reference rebuild, which renders one view for both). Both read as empty, and the admin catalogue has 59 gift cards with Aktif = 0, with the same category names as the L43 chips (Mahkota, E-Wallet, Telco, Gaming, Streaming, F&B, E-Commerce, Pembelajaran, Hiburan). So L43 is the **student-facing front of the admin "Kedai Hadiah Digital" catalogue** (INFERRED from category parity, not provable read-only); S5 `/gamification/rewards` reads some other (or no) catalogue.
- Admin sidebar (OBSERVED) lists both "Kedai Hadiah" -> `/gamification/rewards` and "Kelulusan Hadiah" -> `/cikgu/kelulusan-hadiah`, "Admin Tebusan" and "Urus Hadiah" -> `/admin/hadiah`; no sidebar entry points to `/cikgu/hadiah` for admin. The murid nav entry "Kedai Hadiah 🎁 + DIGITAL" is the one that targets `/cikgu/hadiah` (reference spec row 73; live student nav not observable from admin).

## 5. Reference only
`prestasiplus-reference` ORIGIN-SPEC-PELAJAR row 73 -> `/cikgu/hadiah` (matches live); its code renders the same view as `/gamification/rewards` (differs from live copy). Its `gifts` table = "Kedai Hadiah Digital" catalogue, redeem `POST /gamification/rewards/{gift}/tebus` (not verified on live; no POST was made).

## 6. Recommendation
- **Separate screen, not an alias.** It needs its own URS/SRS screens: S-L43a `/cikgu/hadiah` (shop with category filter) and S-L43b `/cikgu/hadiah/saya` (Tebusan Saya), both in the user shell.
- **Owner: M15 (rewards shop)**, because the catalogue, redemptions and wallet contract (M14 wallet read: token + syiling) are M15's per D12. Not M13: the `/cikgu/*` prefix is only a path (Cikgu Alesa AI routes), the page is a reward shop.
- Fix `user-nav.ts:455` href to `/cikgu/hadiah` (nav class/badge styling still INFERRED for student shell).
- Build only the observed empty state plus the filter chips and balance card; follow the M15 precedent (OQ-M15-01) of not modelling unobserved populated cards/redeem unless the user decides otherwise. Mark `/kedai-hadiah`, `/hadiah`, `/kedai`, `/cikgu/hadiah/{id}` as 404.

## 7. Open questions
1. Q-L43-1: Populated card layout, redeem flow and the "Tebusan Saya" list are NOT OBSERVED (catalogue empty). Keep empty-state-only (like S5) or define PROPOSED states?
2. Q-L43-2: Are token/syiling values for a murid account identical in layout (admin shows 0 / 256)? Student view not observable from admin.
3. Q-L43-3: Does a murid see any different empty copy (live student nav not checked)? Request a murid-session probe if available.
4. Q-L43-4: Does Tebusan Saya belong to the same story or a separate row in the roles matrix?
