# PrestasiPlus Rebuild — Design System (Foundation)

## 0. Document control

| Field | Value |
|---|---|
| Document | Design System — Foundation |
| Version | 1.12 |
| Date | 2026-10-09 |
| Status | Draft — awaiting user approval (G2) |
| Author | ui-ux-designer (agent) |
| Sources | `docs/discovery/00-global-ui.md`, `docs/discovery/img/global/*`, `docs/requirements/SRS.md` (NFR-RESP, NFR-02), `docs/requirements/srs/M01…M21-*.md` §10 + deviation tables, `docs/discovery/M01…M09-*.md` |
| Scope rule | **Replicate, don't redesign (D7).** Values below are observed on the live site unless marked **INFERRED**. Nothing is invented; INFERRED values are the closest reasonable default and are flagged for confirmation once the underlying screen is built/audited. |
| Fidelity rule | Only the approved D9 deviations (listed in each module's SRS "Fidelity deviations" table) change live behaviour. This document does not introduce any deviation beyond what those tables already approved. |
| Accessibility rule | Per NFR-02/D10: accessibility (ARIA, keyboard, focus, motion) **replicates live** — no enhancements. Only D9-broken items are fixed: text < 12px, controls unusable on touch, layout/responsive breakage. |

**Change log**

| Version | Date | Change |
|---|---|---|
| 1.12 | 2026-10-09 | M16 module rows (M16-T4 G4 finding: the two S6 hub icons rendered through the lazy same-name fallback because no row existed). Checked `docs/discovery/M16-battle-games.md` appendix A.3 rows 3 and 7 against §6.1–§6.8: neither FA name had a row. Added two rows to the §6.13 M16 sub-table: `fa-fist-raised` → `HandFist` and `fa-pencil-alt` → `Pencil`. Both are same-glyph matches. Also added the M12 module row `fa-project-diagram` → `Workflow` (approximation, DV-M12-30; only M12 uses it, so it is a §6.13 row, not global); it is listed in §6.10. Also added a new §6.13 M27 sub-table with `fa-user-secret` → `HatGlasses` (approximation; only M27 uses it: S6/S7 "Menyamar" button), also listed in §6.10, which now has 33 icons. All four Lucide names were checked to exist in `@lucide/vue` (`hand-fist`, `pencil`, `workflow`, `hat-glasses` in `dist/esm/icons`). The §6.13 intro sentence now says every sub-table is empty except M12, M16, M27. Totals: 276 global mapping rows (§6.1–§6.8) + 4 module rows (§6.13) + 4 brand rows (§6.9). No colour, type, spacing or component change. |
| 1.11 | 2026-09-30 | From the F-16 G4 review. (a) §7.2 app input spec replaced with the observed live string (blue focus `focus:ring-blue-300 focus:border-blue-400`, `rounded-xl px-3.5 py-2.5`, about 44px tall); the indigo spec is withdrawn. (b) §7.4 gains one line on the pager (live Laravel classes plus 44px hit area and `flex-wrap`, NFR-RESP-03, DV-M04-09). No other change. |
| 1.10 | 2026-09-30 | §6 icon rows for the shells (D-R1, `docs/design/shells.md` v1.2 §2.9). I checked every FA name in the admin menu (M01 admin-shell inventory `SHA-admin-shell.json`), the teacher menu and the other role menus of `src/shells/nav/user-nav.ts` against §6. 21 names had no row (the 18 that `src/shells/shared/shell-icons.ts` carries as INFERRED fallbacks, plus three admin-only names) and were added as global rows, because they are shell links: `fa-exchange-alt` → `ArrowLeftRight`, `fa-file-export` → `FileOutput` (§6.1); `fa-triangle-exclamation` → `TriangleAlert`, `fa-life-ring` → `LifeBuoy` (§6.2); `fa-headset` → `Headset`, `fa-hand-holding-medical` → `HandHelping` (approx) (§6.3); `fa-clipboard-question` → `FileQuestionMark` (approx), `fa-tasks` → `ListChecks` (§6.4); `fa-microphone` → `Mic`, `fa-pen-to-square` → `SquarePen` (§6.5); `fa-campground` → `Tent`, `fa-medal` → `Medal`, `fa-compass` → `Compass`, `fa-door-open` → `DoorOpen`, `fa-table-cells` → `Grid3x3`, `fa-map-location-dot` → `MapPinned`, `fa-crosshairs` → `Crosshair`, `fa-ranking-star` → `Award` (approx), `fa-building-flag` → `Landmark` (approx) (§6.6); `fa-dice` → `Dice5`, `fa-gauge-high` → `Gauge` (§6.8). The 18 shell-icons choices are kept as they are (already imported and built); the three new Lucide names (`Crosshair`, `Dice5`, `Gauge`) were checked to exist in `@lucide/vue` 1.48. §6.10 now lists 31 icons (adds the four approximations). Totals: 276 global mapping rows (§6.1–§6.8) + 0 module rows (§6.13) + 4 brand rows (§6.9). F-14 adds the same rows to `fa-to-lucide.ts`; `shell-icons.ts` then no longer needs its fallback table. No colour, type, spacing or component change. |
| 1.9 | 2026-09-27 | §6 icon rows for the M21 SRS (XR-M21-08). I re-scanned all 21 module SRS docs plus the SRS README with the guard-test regex `\bfa-([a-z0-9-]+)` and the same allow-lists. The three M21 names were the only gaps. All three were added as global §6.6 rows, because they are data-driven sponsor-category icons (S7 tiles), like the subject and product-category icons: `fa-hands-helping` → `HandHelping`, `fa-piggy-bank` → `PiggyBank`, `fa-utensils` → `Utensils`. All three are same-glyph matches, so §6.10 is unchanged (27 icons). `UtensilsCrossed` was rejected because FA `utensils` shows the fork and knife side by side, not crossed. §6.13 gets an empty M21 sub-table. Totals: 255 global mapping rows (§6.1–§6.8) + 0 module rows (§6.13) + 4 brand rows (§6.9). |
| 1.8 | 2026-09-27 | §6 icon rows for the M20 SRS (XR-M20-07). I re-scanned all 20 module SRS docs plus the SRS README with the guard-test regex `\bfa-([a-z0-9-]+)` and the same allow-lists. The eight M20 names were the only gaps, and all eight were added as global rows: `fa-user-tie` → `UserRound` (approx, §6.3; user-shell "Urus Penjual"); `fa-phone` → `Phone` (§6.4; S5); `fa-pencil-ruler` → `PencilRuler`, `fa-tshirt` → `Shirt`, `fa-tablet-alt` → `Tablet` (§6.6; product-category icons, like the subject icons); `fa-shopping-bag` → `ShoppingBag` (§6.8; admin-shell group "Marketplace" and user-shell link); `fa-hand-holding-usd` → `HandCoins` (approx, §6.8; S2/S3 "COD" tile); `fa-box` → `Package` (§6.8; pairs with `fa-box-open` → `PackageOpen`). Five are global because they are shell links or data-driven category icons. `fa-hand-holding-usd`, `fa-box` and `fa-phone` appear on M20 screens only, but they also go global so the guard passes before any M20 module map exists, as in v1.5 and v1.7 (Delivery Lead decision). The §6.13 M20 sub-table is added empty. `fa-whatsapp` stays in §6.9 (brand, deferred), unchanged. Approved by the Delivery Lead: `UserRound`, `HandCoins` and the v1.7 `fa-file-invoice` → `FileText` approximation, each with a visual check at build time. §6.10 now lists 27 icons (adds `fa-user-tie`, `fa-hand-holding-usd`). Totals: 252 global mapping rows (§6.1–§6.8) + 0 module rows (§6.13) + 4 brand rows (§6.9). |
| 1.7 | 2026-09-27 | §6 icon sweep after the M19 SRS landed (and M17 changed). I scanned all 19 module SRS docs plus the SRS README with the guard-test regex `\bfa-([a-z0-9-]+)` and the same allow-lists (FA utility/prefix classes, §6.9 brands). Three FA names had no row, all from M19, and all three were added as global rows: `fa-bell-slash` → `BellOff` (§6.4); `fa-file-invoice` → `FileText` (approx, §6.4); `fa-credit-card` → `CreditCard` (§6.8). They are global because each is a shell link: `fa-credit-card` and `fa-bell-slash` are in the admin-shell "Kewangan" sidebar group and "Lagi" drawer, and `fa-file-invoice` is in the user-shell account menu. No M19 module map exists yet, so global rows also let the guard pass (same reasoning as v1.5). `fa-file-invoice` uses `FileText` because it keeps the folded-corner page silhouette; `ReceiptText` has a zigzag receipt edge, which is a different shape. No other gaps: the current M17 SRS uses only `fa-satellite-dish`, which already has a row. §6.10 now lists 25 icons (adds `fa-file-invoice`). §6.13 gets an empty M19 sub-table. Totals: 244 mapping rows (§6.1–§6.8) + 4 brand rows (§6.9). |
| 1.6 | 2026-09-27 | Live measurements from F-21. (a) §1.3: `bg-404-403` replaced by two tokens. `bg-error-page` (404) is 135deg blue-900 → violet-600 → pink-500; the start colour was wrongly given as indigo-800. `bg-forbidden-page` (403) is new: 135deg red-800 → red-600 → orange-500. (b) §1.3 palette rule: live uses the Tailwind v3 hex palette, so `theme.css` overrides all 22 standard v4 scales (50–950) with the exact v3.4 hex values; class names are unchanged. (c) §7.15: the background line now names both tokens. |
| 1.5 | 2026-09-26 | §6 icon sweep after the M12, M14–M18 SRS docs landed. I scanned every `docs/requirements/srs/*.md` with the guard-test regex `\bfa-([a-z0-9-]+)` and the same allow-lists (FA utility/prefix classes, §6.9 brands). Five FA names had no row, and all five were added as global rows: `fa-broadcast-tower` → `RadioTower` (§6.4); `fa-store` → `Store`, `fa-ticket` → `Ticket`, `fa-boxes-stacked` → `Boxes` (approx), `fa-percent` → `Percent` (§6.8). They are global because `fa-broadcast-tower`, `fa-ticket` and `fa-store` belong to shell/sidebar links seen in several modules and `fa-percent` is used by M15 and M18. `fa-boxes-stacked` is used by M15 only, but it goes global too, so the guard passes before any M15 module map exists. §6.10 now lists 24 icons (adds `fa-boxes-stacked`). §6.13 gets empty sub-tables for M11–M18. Totals: 241 mapping rows (§6.1–§6.8) + 4 brand rows (§6.9). |
| 1.4 | 2026-09-26 | Corrections from live evidence found in F-15. (a) §7.8 rewritten. Timed toasts are observed on live: M02 S2 "Disalin!" (2 s, `x-transition.opacity`) and M10 S28 report toast (4 s, slide). The old claim that no toast exists is withdrawn. The F-15 default toast box is marked INFERRED. Inline "copied" labels and native `alert()` copy notices are separated from toasts. (b) §4 badge rows replaced with the exact class strings from `_raw/M05/work/page_dashboard.html`: LIVE, DEV (amber→orange gradient), the two NEW forms (indigo→purple section heading, amber-500 item), BARU (emerald, drawer), AI (purple→pink), PRO and SPM (10px sidebar / 9px drawer), bell count badge (display logic and `99+`), sidebar count pills and emoji pills (these have tinted backgrounds; the earlier "no background" was wrong). (c) §5 and §7.8 alert box: only the error box is observed (M01 S1). The F-15 AlertBox layout and the success variant are INFERRED, and no success flash exists in any raw capture. (d) §9.2 item 1 (NEW colour) resolved. |
| 1.3 | 2026-09-26 | New §6.13 "Module rows": one sub-table per module M01–M10 (all "none yet", since every current row is global), plus the rule that a module map (`maps/mXX-*.ts`) matches its sub-table exactly, never redefines a §6.1–§6.8 row, and that new module rows are added here by the ui-ux-designer first (build-plan v1.4 §S.3 rule 3, ADR-0010 Amendment 2). Row totals unchanged: 236 mapping rows + 4 brand rows. |
| 1.2 | 2026-09-26 | §6 icon mapping aligned after F-14 (`AppIcon` resolver, ADR-0010 amendment). (a) Declared §6 the single FA→Lucide mapping authority; module SRS tables must agree with it. FA6 prefixes `fa-solid`/`fa-regular` accepted alongside `fa`/`fas`/`far` (M03 BR-05). (b) 24 rows added for FA names used in module SRSs but missing here: `fa-arrow-down`, `fa-redo`, `fa-arrows-rotate`, `fa-rotate-left`, `fa-sort-alpha-down`, `fa-minus-circle`, `fa-pause`, `fa-bullhorn`, `fa-sitemap`, `fa-paste`, `fa-file-pen`, `fa-table`, `fa-bullseye`, `fa-gift`, `fa-futbol`, `fa-microscope`, `fa-seedling`, `fa-running`, `fa-binoculars`, `fa-balance-scale`, `fa-map-marker-alt`, `fa-magnifying-glass-chart`, `fa-beaker`, `fa-signal`. (c) Glyph corrections: `fa-edit` Pencil→SquarePen (FA pen-to-square glyph); `fa-square-root-alt` Sigma→Radical; `fa-variable` Sigma→Variable; `fa-flask-round` FlaskConical→FlaskRound (what the same-name fallback actually returns); `fa-chart-bar` → ChartBar (FA glyph is horizontal bars); `fa-building` → Building (single block, as FA). (d) Deprecated Lucide aliases replaced with @lucide/vue 1.48 canonical names (18 aliases, incl. §3.4). (e) §6.10 count corrected (it listed 21, said 24) and list updated. Conflicts with M03/M05 SRS resolved in favour of this table (see §6.12). Totals: 236 mapping rows (§6.1–§6.8) + 4 brand rows (§6.9). |
| 1.1 | 2026-09-25 | Delivery Lead decision recorded: no-sticky-column table rule confirmed (§7.4, §9 item 1 decided). Brand/social icon decision deferred to M09 G2, recommendation kept (§6.9, §9 item 5 decided). |
| 1.0 | 2026-09-25 | Initial foundation design system: tokens, icon mapping, component inventory. |

---

## 1. Colour tokens

The live site is Tailwind CSS v4 (`oklch()` internally); hex values below are the matching Tailwind v4 palette values, as recorded in discovery. Custom CSS values are exact. **Dark mode is not supported on live** (a `prefers-color-scheme: dark` media query exists in the CSS bundle but no dark theme was observed) — treat dark mode as **out of scope** for the prototype; do not invent one (D7/D9: nothing to fix, nothing observed).

### 1.1 Semantic tokens (light — the only theme)

| Token | Value | Tailwind equivalent | Where used |
|---|---|---|---|
| `color-primary` | `#6366F1` | `indigo-500` | Focus rings, links, selected states |
| `color-primary-strong` | `#4F46E5` | `indigo-600` | Active tab text, hover on primary links |
| `color-text` | `#334155` | `slate-700` | Body text |
| `color-text-strong` | `#1E293B` | `slate-800` | Headings (app shells) |
| `color-text-strong-auth` | `#1F2937` | `gray-800` | Headings on auth pages only (observed distinct from app shell) |
| `color-text-muted` | `#64748B` | `slate-500` | Subtitles, hints, default nav icon/text |
| `color-text-faint` | `#94A3B8` | `slate-400` | Placeholder-level hints, disabled text |
| `color-border` | `#E2E8F0` | `slate-200` | Card borders, 2px input borders |
| `color-border-alt` | `#E5E7EB` | `gray-200` | Auth-page borders |
| `color-danger` | `#EF4444` | `red-500` | Destructive actions, LIVE badge, error copy |
| `color-danger-bg` | `#FEF2F2` / border `#FECACA` / text `#B91C1C` | `red-50` / `red-200` / `red-700` | Error/validation alert box |
| `color-success` | `#10B981` | `emerald-500` | Success states, "on" toggle, server-status OK |
| `color-success-bg` | `#F0FDF4` / border `#BBF7D0` / text `#15803D` | `green-50` / `green-200` / `green-700` | Success flash box |
| `color-warning` | `#F59E0B` | `amber-500` | DEV badge, koin chip, "menunggu" states |
| `color-warning-bg` | `#FFFBEB` | `amber-50` | Warning/attention cards |
| `color-info` | `#3B82F6` | `blue-500` | Info tiles, theme-color |
| `color-surface` | `#FFFFFF` | `white` | Cards |
| `color-surface-translucent` | `rgba(255,255,255,.95)` | — | Sidebar, header ("topbar") |
| `color-theme` | `#3B82F6` | `blue-500` | Browser chrome `theme-color` meta |

### 1.2 Category icon colours (sidebar, cyclic)

Sidebar group/category icons cycle through the Tailwind **500** shade of: `teal`, `amber`, `violet`, `rose`, `indigo`, `emerald`, `blue`, `orange`, `cyan`, `pink`, `purple`, `red`, `fuchsia` — applied in the live order per module group (see `docs/design/shells.md` §2 for the exact per-group colour, carried over from TRACKER module notes as each module reaches design).

### 1.3 Background gradients (body backgrounds)

| Token | Value | Used on |
|---|---|---|
| `bg-app-admin` | `linear-gradient(135deg, #EFF6FF 0%, #E0E7FF 40%, #EDE9FE 60%, #F5F3FF 100%)` | Admin shell body |
| `bg-app-user` | `linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 35%, #E0E7FF 65%, #EDE9FE 100%)` | User portal shell body |
| `bg-auth` | `linear-gradient(135deg, #EFF6FF, #DBEAFE 25%, #E0E7FF 50%, #EDE9FE 75%, #EFF6FF)`, `background-size: 400%`, animates over 15s (`coolGradient`) | Login/register/password pages |
| `bg-error-page` | `linear-gradient(135deg, blue-900 #1E3A8A → violet-600 #7C3AED → pink-500 #EC4899)` (measured on live) | 404 full-screen page |
| `bg-forbidden-page` | `linear-gradient(135deg, red-800 #991B1B → red-600 #DC2626 → orange-500 #F97316)` (measured on live) | 403 full-screen page |

**Palette rule (v3 hex).** Live renders the **Tailwind v3** hex palette (measured on live: violet-600 = `#7C3AED`), not the more saturated v4 `oklch()` palette. The rebuild keeps Tailwind v4 but overrides every standard scale (slate, gray, zinc, neutral, stone, red, orange, amber, yellow, lime, green, emerald, teal, cyan, sky, blue, indigo, violet, purple, fuchsia, pink, rose; 50–950) with the exact Tailwind v3.4 hex values in `src/styles/theme.css`. Class names are unchanged, so live class lists still copy verbatim. `white` and `black` are unchanged. Hex values quoted in this document are therefore the values the rebuild renders.

### 1.4 Action / feature gradients

| Token | Value | Used on |
|---|---|---|
| `gradient-primary` | `linear-gradient(135deg, #3B82F6 0%, #6366F1 50%, #8B5CF6 100%)` | Active nav item (both shells), hero cards |
| `gradient-cta` | `linear-gradient(to right, #3B82F6, #6366F1, #9333EA)` | Auth submit buttons ("Log Masuk", "Daftar Sekarang") |
| `gradient-save` | `linear-gradient(to right, #6366F1, #A855F7)` | "Simpan Profil" and similar primary saves |
| `gradient-warn` | `linear-gradient(to right, #F59E0B, #F97316)` | "Tukar Kata Laluan", streak/fire chip |
| `gradient-teal` (INFERRED exact stops) | teal-700 → cyan-500 | "Simpan Tetapan" (`/tetapan`) |
| `gradient-command` | `linear-gradient(135deg, #312E81, #4F46E5)` | "Command Center" pinned card |
| `gradient-pink` | `from-pink-500 to-pink-600` (Tailwind utility, observed M03 S9–S11) | Secondary-section primary buttons (e.g. Tahap Pendidikan CRUD) — a section accent, not a global default |

---

## 2. Typography

| Role | Font family | Size / weight | Notes |
|---|---|---|---|
| Body | **Inter** | 16px / 400 | Base; NFR-RESP-08 minimum 16px on mobile |
| Labels | Inter | 14px / 600 | Form field labels |
| Hints / captions | Inter | 12px / 400–500 | Never smaller than 12px anywhere (D9 fix for any live text < 12px, e.g. DV-M03-06b) |
| Section labels (sidebar group headers) | Inter | 12px / 800, uppercase, `tracking-wider` | With a coloured gradient rule under/behind |
| Badges / pills | Inter | 8–10px / 700 | Never below 8px; body copy inside pills still ≥ 12px where the pill carries a sentence (not just a status word) |
| Page heading (H1) | **Outfit** 700 | 24px desktop / 16px mobile | Shell header title |
| Auth heading (H2) | Outfit 700 | 30px desktop / 20px mobile | "Selamat Kembali! 👋" |
| Profile name | Outfit 700 | 30px | `/profile` hero |
| Buttons (primary) | Outfit 700 | 16–18px | Gradient CTA buttons |
| Arabic script | Scheherazade New 400/700 | as needed | `/tetapan` spiritual copy |

Font stack fallback (INFERRED, standard practice): `Inter, ui-sans-serif, system-ui, sans-serif` for body; `Outfit, Inter, ui-sans-serif, sans-serif` for headings. 404 page uses the browser's system font (observed exception — do not apply Inter there).

---

## 3. Spacing, radii, shadows, motion

### 3.1 Spacing feel
Generous and playful: card padding 20–40px (`p-5` to `p-10` depending on breakpoint), gaps 8–24px. Heavy but structured use of emoji, pastel `*-50` tints, gradient buttons, and hover lift (`hover:-translate-y-0.5`, custom class `.btn-bounce`).

### 3.2 Radii
| Token | Value | Used on |
|---|---|---|
| `radius-input` | 12px (`rounded-xl`) app forms; 16px (`sm:rounded-2xl`) auth forms | Inputs, selects |
| `radius-card` | 16px (`rounded-2xl`) app; 24px (`rounded-3xl`) auth card, hero panels | Cards |
| `radius-nav-item` | 16px | Sidebar/drawer nav items |
| `radius-pill` | full (`rounded-full`) | Badges, chips, buttons that are pill-shaped |

### 3.3 Shadows
| Token | Value | Used on |
|---|---|---|
| `shadow-sidebar` | `4px 0 16px rgba(99,102,241,.06–.08)` | Sidebar (user: .06, admin: .08) |
| `shadow-header` | `0 2px 12px rgba(99,102,241,.06–.08)` | Header/topbar |
| `shadow-active-nav` | `0 4px 12px rgba(99,102,241,.3), 0 2px 6px rgba(139,92,246,.2)` | Active nav item |
| `shadow-auth-card` | Tailwind `shadow-2xl` | Login/register card |
| `shadow-card` (INFERRED, standard Tailwind) | `shadow-sm`/`shadow` | Generic content cards, stat cards |

### 3.4 Motion
| Name | Effect | Rule |
|---|---|---|
| `coolGradient` | 15s background-position shift | Auth background |
| `floatBounce` | 6s floating emoji, opacity 0.6 | Auth decorative emoji |
| `popIn`, `mascotBounce` | Entrance micro-animations | Various hero/mascot elements |
| `animate-pulse` | Tailwind pulse | "LIVE" badge |
| `animate-spin` | Tailwind spin | Loading spinners (`LoaderCircle` in the rebuild) |
| `page-transition` | Fade-in on route change | Main content area, both shells |

**Reduced motion (D10):** the live CSS bundle contains a `prefers-reduced-motion` query; the rebuild SHALL honour it the same way live does — i.e. do not add new motion-reduction handling beyond what is implied by that query being present. Do not strip animations outright; only respect the OS-level preference as live's bundle does.

---

## 4. Badges, pills, chips

| Badge | Style | Colour | Meaning / where |
|---|---|---|---|
| `LIVE` | `ml-auto text-[8px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold animate-pulse` | red | "Command Center" link (both shells) |
| `DEV` | `ml-auto text-[8px] bg-gradient-to-r from-amber-500 to-orange-500 text-white px-1.5 py-0.5 rounded-full font-bold` | amber → orange gradient | Item "Bilik Duta" (`fa-crown`) under the heading "🏆 Bilik Duta · 🔒 PREVIEW", in both sidebar and drawer. The heading itself carries no badge (in-development / preview feature, still in scope per D3) |
| `NEW` (section heading) | `text-[8px] bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-1.5 py-0.5 rounded-full font-bold` (no `ml-auto`: it is the last child of the heading row, after the `flex-1 h-[2px] bg-gradient-to-r from-purple-300 to-transparent rounded-full` divider line) | indigo → purple gradient | "Pusat AI" section heading, in both sidebar and drawer |
| `NEW` (nav item) | `ml-auto text-[8px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-bold` | amber (solid) | Item "Sekolah Bersaing" (`fa-trophy`, under "✨ Visi & Pertandingan"), in both sidebar and drawer |
| `BARU` | `ml-auto px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-bold rounded-full` | emerald | Drawer item "Kelas Saya". This is the only occurrence in the capture; it is not in the desktop sidebar there |
| `AI` | `ml-auto text-[8px] bg-gradient-to-r from-purple-500 to-pink-500 text-white px-1.5 py-0.5 rounded-full font-bold` | purple → pink gradient | Item "Cikgu Alesa" (main nav, sidebar and drawer) and item "Cikgu Alesa Chat" (Pusat AI › "🤖 Cikgu Alesa AI", sidebar and drawer). Same 8px size in both shells |
| `PRO` | Sidebar: `ml-auto px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full`. Drawer: the same with `text-[9px]` | indigo tint | Item "PKSK" (`fa-shield-halved`) |
| `SPM` | Sidebar: `ml-auto px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full`. Drawer: the same with `text-[9px]` | amber tint | Item "SPM" (`fa-graduation-cap`) |
| Bell count badge | `absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1` (`id="notif-badge"`, rendered with `style="display:none"`) | red | Top-bar bell link (`relative w-9 h-9 rounded-lg …`, → `/notifikasi`). The shell script polls `/notifikasi/unread-count`. When `count > 0` it sets `display:flex` and shows the count, or `99+` when the count is above 99. When `count` is 0 it sets `display:none` |
| Sidebar count pills | "Gambar Rajah": `ml-auto px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full` (text "6,144"). "Urus Tiket": `ml-auto px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-full` (text "2") | amber tint / red tint | Desktop sidebar (the only occurrence in the capture) |
| Emoji pills | Common classes: `ml-auto px-1.5 py-0.5 … text-[10px] font-bold rounded-full` in the sidebar, `text-[9px]` in the drawer. 🎮 "Permainan": `bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700`. 🎟️ "Cabutan Bertuah": `bg-gradient-to-r from-fuchsia-100 to-pink-100 text-fuchsia-700`. 🏆 "Syiling & Token" and 💎 "Pakej": `bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-700` | tinted gradients | Sidebar decoration, not a semantic status. The drawer shows 🎮 and 🎟️ only in the capture |

Source for every class string in the rows `LIVE` through Emoji pills: `docs/discovery/inventory/_raw/M05/work/page_dashboard.html`. The desktop sidebar uses `.nav-item` and the mobile drawer uses `.drawer-nav-item`. Copy each string exactly. Do not add a focus ring, ARIA or any other attribute (D10).
| Role badge (admin footer/header) | text pill, no strong colour observed | slate | "Admin" role label |
| Compliance badge (question bank) | uppercase text pill: `VERIFIED`, `QUARANTINED`, `PENDING_MAPPING`, `DRAFT`, `REJECTED`, `MISSING_SOURCE`, `VERIFIED_GENERATED` ("AI Verified") | **INFERRED** semantic colours: `VERIFIED`/`VERIFIED_GENERATED` emerald, `QUARANTINED`/`REJECTED` red, `PENDING_MAPPING` amber, `DRAFT` slate, `MISSING_SOURCE` orange — exact live colour classes were not captured in discovery (text/case only); confirm on M04 build/audit | `/admin/questions` list |
| Active flag | `ACTIVE` / `INACTIVE` small text under the status pill | emerald / slate | Question list rows |

**Convention for the rebuild:** every badge keeps its live label text exactly (including English words like `VERIFIED`, `LIVE`, `NEW`, `DEV`, `PRO`, `AI` — these are literal live copy, not to be translated). Badge text is never below 8px; if a badge must carry more than a single short word, raise it to ≥12px (touch/readability rule).

---

## 5. Status colour sets

| Domain | Status | Colour |
|---|---|---|
| Question workflow (M04) | `draft` "Draf" | slate |
| | `pending_review` "Menunggu Semakan" | amber |
| | `approved` "Diluluskan" | emerald/indigo (dashboard stat tile uses indigo `#6366F1` tile; list-row pill **INFERRED** emerald — confirm on M04 build) |
| | `rejected` "Ditolak" | red |
| | `archived` "Diarkibkan" / "Arkib" | slate/grey |
| Admin dashboard tiles | "Soalan Aktif" | blue |
| | "Diluluskan" | indigo/purple |
| | "Menunggu Review" | amber |
| | "Draf" | grey |
| | "Ditolak" | red |
| | "Digantung" | slate |
| Question report status (M04) | `pending` "Menunggu" | amber (default tab when `status` absent) |
| | "Disemak" | blue |
| | "Diperbaiki" | emerald |
| | "Dikeluarkan" | red |
| Reason-category badge | "Lain-lain" | slate |
| | "Tak Jelas" | amber |
| | "Jawapan Salah" | red |
| School subscription (M02) | "Aktif" | emerald |
| | "Batal" | red |
| | "Tamat" | slate |
| Server status pill thresholds | CPU >80 / RAM >85 / Disk >90 | red |
| | CPU >50 / RAM >60 / Disk >75 | amber |
| | otherwise | emerald |
| Toggle switch | on | emerald |
| | off | slate |
| Alert box | error/validation (**observed**, M01 S1) | `bg-red-50 border-2 border-red-200 text-red-700 rounded-2xl` + `fa-exclamation-circle` → `CircleAlert` |
| | success (**INFERRED**, never captured) | green-50 bg / green-200 border / green-700 text + `CircleCheck` icon, mirroring the observed error box. See §7.8 |
| | warning/info (**INFERRED**) | amber-50 / blue-50 tint, matching icon colour |

---

## 6. Icon mapping — Font Awesome 6.5.1 → Lucide

The live site uses Font Awesome 6.5.1 Free (`fas` solid, some `far` regular) plus heavy native-emoji decoration. The rebuild uses **Lucide** exclusively for functional/glyph icons; emoji stay as literal emoji characters in copy (they are content, not icons — e.g. "🎓", "👋", "🔥" are part of the live BM copy and are kept as-is).

Table below covers every distinct FA icon class found across `docs/discovery/00-global-ui.md` and the M01–M21 discovery/SRS docs (global shell + modules specified so far). Grouped by function for readability. **Bold** = no exact Lucide equivalent — approximate or flagged.

**Mapping authority (v1.2).** This section is the **single** FA → Lucide mapping authority for the rebuild. The code table `src/components/icon/fa-to-lucide.ts` (ADR-0010) and every module SRS "Visual fidelity" icon list must agree with it; where a module SRS disagrees, this table wins and the SRS is corrected. Rules:

- **Fidelity:** the Lucide icon must convey the same glyph meaning as the live Font Awesome icon; when two candidates exist, pick the one closest to the FA glyph shape.
- **Names:** Lucide names are the **canonical** component names exported by `@lucide/vue` 1.48 (verified against `node_modules/@lucide/vue/dist/lucide-vue.d.ts`). Deprecated aliases (`Loader2`, `Home`, `Trash2`, `Filter`, …) are not used.
- **Keys:** rows are keyed by the FA name without prefix. The prefix (`fa`, `fas`, `far`, `fa-solid`, `fa-regular`) does not change the mapping (BR-05, M03). `fa-spin` is an animation modifier, not an icon — render the mapped icon with `animate-spin`.
- **Explicit rows beat fallback:** BR-05's same-name Lucide fallback is a safety net; every FA name used in a module SRS or seed has an explicit row here.

### 6.1 Navigation / actions

| FA class | Lucide | Notes |
|---|---|---|
| `fa-bars` | `Menu` | |
| `fa-arrow-left` | `ArrowLeft` | |
| `fa-arrow-right` | `ArrowRight` | |
| `fa-arrow-up` | `ArrowUp` | |
| `fa-arrow-down` | `ArrowDown` | M05, M08, M12 |
| `fa-arrow-up-right-from-square` | `ExternalLink` | |
| `fa-external-link-alt` | `ExternalLink` | duplicate of above (FA6 renamed it) |
| `fa-arrow-trend-up` | `TrendingUp` | |
| `fa-chevron-down` | `ChevronDown` | |
| `fa-chevron-up` | `ChevronUp` | |
| `fa-chevron-left` | `ChevronLeft` | |
| `fa-chevron-right` | `ChevronRight` | |
| `fa-ellipsis-h` | `Ellipsis` | "Lagi" popover trigger |
| `fa-sign-in-alt` | `LogIn` | |
| `fa-sign-out-alt` | `LogOut` | |
| `fa-home` | `House` | |
| `fa-search` | `Search` | |
| `fa-search-minus` | `ZoomOut` | |
| `fa-filter` | `Funnel` | |
| `fa-sliders-h` | `SlidersHorizontal` | |
| `fa-sort` | `ArrowUpDown` | |
| `fa-sort-alpha-down` | `ArrowDownAZ` | M08 "A-Z" sort; FA glyph = down arrow + A/Z |
| `fa-plus` | `Plus` | |
| `fa-plus-circle` | `CirclePlus` | |
| `fa-minus` | `Minus` | |
| `fa-minus-circle` | `CircleMinus` | M08 |
| `fa-times` | `X` | |
| `fa-times-circle` | `CircleX` | |
| `fa-check` | `Check` | |
| `fa-check-circle` | `CircleCheck` | |
| `fa-check-double` | `CheckCheck` | |
| `fa-check-square` | `SquareCheckBig` | |
| `fa-circle-check` | `CircleCheckBig` | duplicate concept to `fa-check-circle`; keep distinct component if both appear same screen |
| `fa-circle` | `Circle` | decorative bullet/step marker |
| `fa-toggle-on` | `ToggleRight` | |
| `fa-toggle-off` | `ToggleLeft` | |
| `fa-random` | `Shuffle` | |
| `fa-sync-alt` | `RefreshCw` | |
| `fa-arrows-rotate` | `RefreshCw` | FA6 name of `fa-sync-alt` (M05) |
| `fa-redo-alt` | `RotateCw` | FA6 `rotate-right`: one clockwise circular arrow (M05) |
| `fa-redo` | `RotateCw` | FA6 `arrow-rotate-right`: clockwise arrow (M05) |
| `fa-rotate-left` | `RotateCcw` | counter-clockwise arrow (M08) |
| `fa-pause` | `Pause` | M11 |
| `fa-print` | `Printer` | |
| `fa-share-alt` | `Share2` | |
| `fa-link` | `Link` | |
| `fa-copy` | `Copy` | |
| `fa-download` | `Download` | |
| `fa-upload` | `Upload` | |
| `fa-cloud-upload-alt` | `CloudUpload` | |
| `fa-exchange-alt` | `ArrowLeftRight` | two opposite horizontal arrows; same glyph. User-shell "Tukar Token" (M14) |
| `fa-file-export` | `FileOutput` | page with an arrow leaving it; same glyph. User-shell PPD item "Export Laporan" (M18) |

### 6.2 Status / feedback

| FA class | Lucide | Notes |
|---|---|---|
| `fa-exclamation-circle` | `CircleAlert` | |
| `fa-exclamation-triangle` | `TriangleAlert` | |
| `fa-triangle-exclamation` | `TriangleAlert` | FA6 name of `fa-exclamation-triangle`: same glyph. Shell links "Wellbeing Alerts" (admin, teacher, school admin) |
| `fa-life-ring` | `LifeBuoy` | ring with four bands; same glyph. Sidebar "Tiket Bantuan" |
| `fa-info-circle` | `Info` | |
| `fa-question-circle` | `CircleQuestionMark` | |
| `fa-ban` | `Ban` | |
| `fa-lock` | `Lock` | |
| `fa-unlock` | `LockOpen` | |
| `fa-unlock-alt` | `LockOpen` | duplicate of `fa-unlock` in the rebuild |
| `fa-shield-alt` | `Shield` | |
| **`fa-shield-halved`** | `Shield` | no "halved" variant in Lucide; reuse plain `Shield`, differentiate by colour only if both appear on one screen |
| `fa-frown` | `FaceSlightlyFrowning` | canonical name of the former `Frown` |
| `fa-meh` | `FaceNeutral` | canonical name of the former `Meh` |
| `fa-smile` | `FaceSlightlySmiling` | canonical name of the former `Smile` |
| `fa-spinner` (+ `fa-spin`) | `LoaderCircle` (with CSS `animate-spin`) | |
| `fa-circle-notch` (spinner) | `LoaderCircle` | duplicate spinner concept |
| `fa-hourglass-half` | `Hourglass` | |
| `fa-fire` | `Flame` | |

### 6.3 People / roles

| FA class | Lucide | Notes |
|---|---|---|
| `fa-user` | `User` | |
| `fa-users` | `Users` | |
| `fa-user-plus` | `UserPlus` | |
| `fa-user-check` | `UserCheck` | |
| `fa-user-slash` | `UserX` | |
| `fa-user-circle` | `CircleUserRound` | |
| `fa-user-pen` | `UserPen` | |
| `fa-user-friends` | `Users` | duplicate of `fa-users` |
| **`fa-user-graduate`** | `GraduationCap` | no person+cap combo in Lucide; uses the cap icon alone (semantic, not literal) |
| **`fa-user-shield`** | `ShieldCheck` | approximate — no person+shield combo; consider pairing `User` + `Shield` as a two-icon composite if the design needs both concepts visible |
| **`fa-user-tag`** | `UserCog` | approximate — no person+tag combo |
| **`fa-user-tie`** | `UserRound` | approx: FA shows a person bust wearing a necktie, and Lucide has no person-with-tie glyph. `UserRound` keeps the bust silhouette and differs from `User` (`fa-user`) in shape. User-shell admin link "Urus Penjual" (M20) |
| **`fa-users-cog`** | `UsersRound` | approximate — no gear overlay in Lucide |
| **`fa-users-slash`** | `Users` | approximate — no slash variant; add a manual strike-through if the "disabled/no students" meaning must be visually explicit |
| `fa-child` | `Baby` | approximate — closest "child/anak" glyph in Lucide |
| `fa-chalkboard-teacher` | `Presentation` | |
| `fa-chalkboard` | `Presentation` | duplicate of teacher variant |
| `fa-graduation-cap` | `GraduationCap` | |
| `fa-id-card` | `IdCard` | |
| `fa-key` | `KeyRound` | |
| `fa-keyboard` | `Keyboard` | |
| `fa-robot` | `Bot` | |
| `fa-headset` | `Headset` | headset with microphone; same glyph. Sidebar "Urus Tiket" (admin) |
| **`fa-hand-holding-medical`** | `HandHelping` | approx: FA shows an open hand under a medical cross; Lucide has no medical-cross variant, so `HandHelping` (a hand offering support) keeps the "hand giving care" meaning. Kirkpatrick "Intervensi" item (admin and teacher menus, M12). `HandHeart` was considered; `HandHelping` is kept because `shell-icons.ts` already ships it |

### 6.4 Communication / content

| FA class | Lucide | Notes |
|---|---|---|
| `fa-bell` | `Bell` | |
| `fa-bell-slash` | `BellOff` | bell crossed by a diagonal slash; `BellOff` is the same glyph. Admin-shell "Kewangan" group link "Dunning Log" (M19) |
| `fa-envelope` | `Mail` | |
| `fa-phone` | `Phone` | telephone handset; same glyph. M20 S5 seller telephone |
| `fa-comment` | `MessageCircle` | |
| `fa-comments` | `MessagesSquare` | |
| `fa-paper-plane` | `Send` | |
| `fa-sticky-note` | `StickyNote` | |
| `fa-newspaper` | `Newspaper` | |
| `fa-scroll` | `ScrollText` | |
| `fa-file-alt` | `FileText` | |
| `fa-file-lines` | `FileText` | duplicate of `fa-file-alt` |
| `fa-file-circle-check` | `FileCheckCorner` | |
| `fa-file-contract` | `FilePenLine` | canonical name of the former `FileSignature` |
| `fa-file-pen` | `FilePen` | M06 |
| `fa-file-csv` | `FileSpreadsheet` | |
| `fa-file-excel` | `FileSpreadsheet` | duplicate |
| **`fa-file-pdf`** | `FileText` | no PDF-specific glyph in Lucide; pair with a small "PDF" text badge if the file type must be distinguishable |
| **`fa-file-word`** | `FileText` | no Word-specific glyph |
| **`fa-file-invoice`** | `FileText` | approx: FA shows a page with a folded corner, text lines and a small total box; Lucide has no invoice page, and `FileText` keeps the same folded-corner page with lines. `ReceiptText` was rejected because its zigzag-edged receipt is a different silhouette. User-shell account menu "Invois Saya" (M19) |
| `fa-file-import` | `FileInput` | |
| `fa-file-upload` | `FileUp` | |
| `fa-clipboard-check` | `ClipboardCheck` | |
| `fa-clipboard-list` | `ClipboardList` | |
| `fa-paste` | `ClipboardPaste` | M02 bulk import "paste" tab; FA glyph = clipboard with a sheet |
| `fa-list` | `List` | |
| `fa-list-ol` | `ListOrdered` | |
| `fa-list-check` | `ListChecks` | |
| `fa-tasks` | `ListChecks` | FA5 name of `fa-list-check`: same glyph. Teacher and admin item "PBD (Cikgu Alesa)" |
| **`fa-clipboard-question`** | `FileQuestionMark` | approx: FA shows a clipboard with a question mark; Lucide has no clipboard-question glyph, so `FileQuestionMark` (a page with a question mark) is used. "Whiteboard → Quiz" (Pusat AI, admin and teacher menus) |
| `fa-th-large` | `LayoutGrid` | |
| `fa-table` | `Table` | M08 "Lihat Table Penuh" |
| `fa-sitemap` | `Network` | M03; FA glyph = one box linked to three below (hierarchy) |
| `fa-bullhorn` | `Megaphone` | M05 announcement strip |
| `fa-broadcast-tower` | `RadioTower` | FA5 name of `fa-tower-broadcast` (mast sending waves); `RadioTower` is the same glyph. Teacher shell "Kelas Live" link (M10) and M16 live-match banner |
| `fa-tag` | `Tag` | |
| `fa-tags` | `Tags` | |
| `fa-hashtag` | `Hash` | |
| `fa-thumbtack` | `Pin` | |
| `fa-folder-open` | `FolderOpen` | |
| `fa-database` | `Database` | |
| `fa-history` | `RotateCcwClock` | canonical name of the former `History` |
| `fa-inbox` | `Inbox` | |
| `fa-code` | `CodeXml` | |
| `fa-delete-left` | `Delete` | backspace glyph |
| `fa-turn-down` | `CornerDownLeft` | "enter" glyph |

### 6.5 Media / editing

| FA class | Lucide | Notes |
|---|---|---|
| `fa-camera` | `Camera` | |
| `fa-image` | `Image` | |
| `fa-images` | `Images` | |
| `fa-headphones` | `Headphones` | |
| `fa-play` | `Play` | |
| `fa-play-circle` | `CirclePlay` | |
| `fa-edit` | `SquarePen` | FA6 alias of `fa-pen-to-square` (pen over a square); `SquarePen` is the same glyph. Changed from `Pencil` in v1.2 |
| `fa-pen` | `Pen` | |
| `fa-pen-fancy` | `PenLine` | approximate — decorative pen, no exact match |
| `fa-pen-nib` | `PenTool` | |
| **`fa-wand-magic-sparkles`** | `WandSparkles` | |
| `fa-magic` | `WandSparkles` | FA5 name of `fa-wand-magic-sparkles`, so same icon |
| `fa-trash` | `Trash` | canonical name of the former `Trash2` |
| `fa-trash-alt` | `Trash` | duplicate |
| `fa-save` | `Save` | |
| `fa-eye` | `Eye` | |
| `fa-eye-slash` | `EyeOff` | |
| `fa-microphone` | `Mic` | microphone on a stand; same glyph. "Cikgu Suara" (admin and student menus) |
| `fa-pen-to-square` | `SquarePen` | FA6 name of `fa-edit` (row above): same glyph. Pusat AI "SPM Walkthrough" |

### 6.6 Subjects, curriculum, misc content icons (data-driven `icon` field, BR-05 resolver)

| FA class | Lucide | Notes |
|---|---|---|
| `fa-book` | `Book` | |
| `fa-book-open` | `BookOpen` | |
| `fa-book-reader` | `BookOpenText` | |
| `fa-calculator` | `Calculator` | |
| `fa-square-root-alt` | `Radical` | FA glyph is the √ sign; Lucide `Radical` is the same sign. Changed from `Sigma` (Σ, a different symbol) in v1.2 |
| `fa-flask` | `FlaskConical` | |
| `fa-flask-round` (data string, FA-invalid) | `FlaskRound` | explicit row; equals what the BR-05 same-name fallback returns (v1.2: was `FlaskConical`, which the fallback could never produce) |
| `fa-beaker` (data string, FA-invalid) | `Beaker` | explicit row; equals the same-name fallback (§6.11) |
| `fa-microscope` | `Microscope` | M12 |
| `fa-seedling` | `Sprout` | M08/M14 badge "Pemula Rajin" |
| **`fa-running`** | `Footprints` | approximate — no running-person glyph in Lucide; footprints keep the "active / on the move" meaning (M08/M14 badge "Pelajar Aktif") |
| **`fa-futbol`** | `Volleyball` | approximate — no football glyph in Lucide; `Volleyball` is the closest ball-with-seams shape (M07 subject icon) |
| `fa-gift` | `Gift` | M02, M05 (explicit row; previously same-name fallback only) |
| `fa-bullseye` | `Target` | M05, M06; FA glyph = concentric rings |
| `fa-binoculars` | `Binoculars` | M11 |
| `fa-balance-scale` | `Scale` | FA5 name of `fa-scale-balanced` (M11) |
| `fa-map-marker-alt` | `MapPin` | FA5 name of `fa-location-dot` (M11) |
| **`fa-magnifying-glass-chart`** | `Search` | approximate — no magnifier-with-chart glyph in Lucide; magnifier kept (M08) |
| `fa-globe` | `Globe` | |
| **`fa-globe-asia`** | `Globe` | approximate — Lucide's `Globe` has no regional variants |
| **`fa-earth-asia`** | `Earth` | approximate, same limitation |
| `fa-leaf` | `Leaf` | |
| `fa-map` | `Map` | |
| `fa-map-pin` | `MapPin` | |
| `fa-map-marked-alt` | `MapPinned` | |
| `fa-palette` | `Palette` | |
| `fa-music` | `Music` | |
| `fa-moon` | `Moon` | |
| `fa-heart` | `Heart` | |
| `fa-heart-pulse` | `HeartPulse` | |
| `fa-heartbeat` | `Activity` | approximate |
| `fa-hand-holding-heart` | `HeartHandshake` | |
| `fa-wrench` | `Wrench` | |
| `fa-desktop` | `Monitor` | |
| `fa-monitor` (data string) | `Monitor` | direct match via BR-05 same-name lookup |
| `fa-language` | `Languages` | |
| `fa-languages` | `Languages` | duplicate |
| **`fa-laptop-code`** | `Laptop` | approximate — no code-overlay variant |
| `fa-receipt` | `Receipt` | |
| `fa-briefcase` | `Briefcase` | |
| `fa-chart-line` | `ChartLine` | |
| `fa-chart-bar` | `ChartBar` | FA `chart-bar` = axes with horizontal bars; `ChartBar` is the horizontal-bar glyph (v1.2: was alias `BarChart3` = vertical `ChartColumn`) |
| `fa-chart-pie` | `ChartPie` | |
| `fa-trending-up` (data string) | `TrendingUp` | direct match via BR-05 same-name lookup |
| `fa-variable` (data string, FA-invalid) | `Variable` | blank-on-live defect (§6.11); Lucide `Variable` is the "(x)" glyph the stored name asks for and equals the BR-05 same-name fallback. Changed from `Sigma` in v1.2 |
| `fa-zap` (data string) | `Zap` | direct match via BR-05 same-name lookup |
| `fa-bolt` | `Zap` | duplicate concept |
| `fa-layer-group` | `Layers` | |
| `fa-bookmark` | `Bookmark` | |
| `fa-lightbulb` | `Lightbulb` | |
| `fa-puzzle-piece` | `Puzzle` | |
| `fa-dumbbell` | `Dumbbell` | |
| `fa-brain` | `Brain` | |
| **`fa-hat-wizard`** | `WandSparkles` | approximate — no wizard-hat glyph |
| **`fa-crystal-ball`** (data string, FA-invalid) | `Sparkles` | approximate — blank-on-live defect (§6.11) |
| **`fa-stars`** (data string, FA-invalid) | `Star` | explicit table row (BR-05 has no singular fallback) — blank-on-live defect (§6.11) |
| `fa-star` | `Star` | |
| `fa-crown` | `Crown` | |
| `fa-rocket` | `Rocket` | |
| `fa-coins` | `Coins` | |
| `fa-infinity` | `Infinity` | |
| **`fa-quran`** | `BookOpenText` | approximate — no religious-text-specific icon in Lucide (BR-05 resolver already maps this) |
| **`fa-mosque`** | `Landmark` | approximate — no mosque glyph (BR-05 resolver already maps this) |
| `fa-landmark` | `Landmark` | |
| `fa-building-columns` | `Landmark` | duplicate |
| **`fa-monument`** | `Landmark` | approximate, no dedicated glyph |
| **`fa-university`** | `Landmark` | approximate reuse |
| `fa-school` | `School` | |
| `fa-building` | `Building` | FA glyph = one multi-storey block; `Building` matches (v1.2: was alias `Building2` = `BuildingComplex`, two blocks) |
| `fa-scale-balanced` | `Scale` | |
| `fa-pencil-ruler` | `PencilRuler` | crossed pencil and ruler; same glyph. M20 product category "Peralatan Sekolah" (data-driven category icon) |
| `fa-tshirt` | `Shirt` | FA5 name of `fa-shirt`; Lucide `Shirt` is the same short-sleeve T-shirt. M20 category "Uniform & Pakaian" |
| `fa-hands-helping` | `HandHelping` | FA5 name of `fa-handshake-angle`: a hand reaching to lift another hand. Lucide `HandHelping` (alias `helping-hand`) is the same helping-hand glyph. M21 sponsor category "Pertubuhan Bukan Kerajaan" (S7 tile) |
| `fa-piggy-bank` | `PiggyBank` | piggy bank with a coin slot; same glyph. M21 sponsor category "Bank / Institusi Kewangan" (S7 tile) |
| `fa-utensils` | `Utensils` | fork and knife standing side by side; same glyph. `UtensilsCrossed` was rejected because it crosses them. M21 sponsor category "Restoran / F&B" (S7 tile) |
| `fa-tablet-alt` | `Tablet` | FA5 name of `fa-tablet-screen-button`: an upright tablet with a home button; Lucide `Tablet` is the same upright tablet. M20 category "Digital & E-Book" |
| `fa-campground` | `Tent` | tent on a ground line; same glyph. Admin "Kem & Bootcamp" (Bilik Duta) |
| `fa-medal` | `Medal` | ribbon with a medal disc; same glyph. User-shell "Pencapaian" |
| `fa-compass` | `Compass` | circle with a compass needle; same glyph. Student "Pusat Nota Ringkas" |
| `fa-door-open` | `DoorOpen` | open door; same glyph. School-admin "Kelas Sekolah" |
| `fa-table-cells` | `Grid3x3` | 3 by 3 grid of cells; same glyph. School-admin "DSKP Heatmap" |
| `fa-map-location-dot` | `MapPinned` | map pin over a dot; same idea as `fa-map-marked-alt`. PPD "Peta Haba" |
| `fa-crosshairs` | `Crosshair` | circle with four ticks and a centre; same glyph. Admin SPM group "Tracking A" |
| **`fa-ranking-star`** | `Award` | approx: FA shows a star over a podium; Lucide has no podium-with-star glyph, and `Award` (a rosette) keeps the "ranking honour" meaning. PPD "Benchmark Sekolah" |
| **`fa-building-flag`** | `Landmark` | approx: FA shows a building with a flag; Lucide has no building-with-flag, and `Landmark` is the institution glyph already used for `fa-building-columns`. JPN "Dashboard JPN" |

### 6.7 Time / calendar

| FA class | Lucide | Notes |
|---|---|---|
| `fa-clock` | `Clock` | |
| `fa-calendar` | `Calendar` | |
| `fa-calendar-alt` | `CalendarDays` | FA6 `calendar-days`: calendar with a full day grid; `CalendarDays` has the grid |
| `fa-calendar-day` | `CalendarClock` | |
| `fa-calendar-plus` | `CalendarPlus` | |
| `fa-calendar-week` | `CalendarRange` | FA glyph = calendar with one highlighted row (a week); `CalendarRange` shows a range bar inside the calendar. Plain `Calendar` would be identical to `fa-calendar` |
| `fa-flag` | `Flag` | |
| **`fa-flag-checkered`** | `Flag` | approximate — no checkered-flag glyph in Lucide. `Flag` keeps the FA silhouette (rectangular waving flag on a pole); `FlagTriangleRight` is a pennant, a different shape. Where it sits next to `fa-flag` (M05 S7 "Lihat Keputusan" vs "Lapor Soalan") the button labels tell them apart |

### 6.8 System / dashboard

| FA class | Lucide | Notes |
|---|---|---|
| `fa-tachometer-alt` | `Gauge` | |
| `fa-cog` | `Settings` | |
| `fa-cogs` | `Settings2` | |
| `fa-microchip` | `Cpu` | |
| `fa-memory` | `MemoryStick` | |
| `fa-hard-drive` | `HardDrive` | |
| `fa-satellite-dish` | `SatelliteDish` | |
| `fa-gamepad` | `Gamepad2` | |
| `fa-handshake` | `Handshake` | |
| `fa-box-open` | `PackageOpen` | |
| `fa-box` | `Package` | FA `box` is a closed carton with a tape line; Lucide `Package` is the same closed carton and pairs with `fa-box-open` → `PackageOpen`. Lucide `Box` was rejected because it is a bare wireframe cube. M20 S8 "{n} produk", S9 "Senarai Produk" |
| **`fa-boxes-stacked`** | `Boxes` | approx: FA shows flat boxes stacked two below and one on top, and Lucide `Boxes` has the same 2+1 stack drawn as isometric cubes. M15 "Set Stok" |
| `fa-store` | `Store` | shop front with awning. M15 "Kembali ke Catalog" |
| `fa-shopping-bag` | `ShoppingBag` | FA5 name of `fa-bag-shopping`: a carrier bag with handles; same glyph. Admin-shell sidebar group "Marketplace" and its "Produk" link, plus the user-shell "Marketplace" link (M20) |
| `fa-ticket` | `Ticket` | ticket with notched sides. User-shell "Cabutan Bertuah" link (M15) |
| `fa-percent` | `Percent` | M15, M18 "{p}% terlibat" |
| `fa-credit-card` | `CreditCard` | card with a magnetic stripe; same glyph. Admin-shell sidebar group "Kewangan" and its "Pembayaran" link (M19) |
| **`fa-hand-holding-usd`** | `HandCoins` | approx: FA5 name of `fa-hand-holding-dollar`, an open hand holding a coin marked "$". Lucide has no hand-with-dollar glyph; `HandCoins` is an open hand under coins. M20 S2 / S3 payment tile "COD" |
| `fa-barcode` | `Barcode` | |
| `fa-trophy` | `Trophy` | |
| `fa-signal` | `Signal` | ascending bars (M05 difficulty); explicit row, previously same-name fallback only |
| `fa-dice` | `Dice5` | single die with pips; same glyph (Lucide has one icon per face, so the five-pip face is used). Admin Battle group "Tetapan Permainan" |
| `fa-gauge-high` | `Gauge` | FA6 name of `fa-tachometer-alt` (row above): a dial with a needle; same glyph. Admin Sistem group "Performance" |

### 6.9 Brand / social — no Lucide match

**DECIDED (Delivery Lead, 2026-09-25, D9/D10): deferred to M09 Build/G2.** Lucide is a generic glyph set, not a brand-logo library. These FA brand icons (`fab` prefix live) have **no equivalent** in Lucide. Recommendation carried forward for the M09 designer/developer to decide between: (a) a small dedicated brand-icon package (e.g. `simple-icons`), or (b) inline SVG brand assets. Do not fake brand marks with generic Lucide icons. This is the only open item in this table; it is not blocking for M01–M07.

| FA class | Where seen | Recommendation |
|---|---|---|
| `fa-facebook-f` | M09 article/content share links | Dedicated brand SVG, or omit if the social-share feature is stubbed |
| `fa-twitter` | M09 | Dedicated brand SVG |
| `fa-whatsapp` | M09 (contact/share) | Dedicated brand SVG |
| `fa-youtube` | M09 (video embed marker) | Dedicated brand SVG |

### 6.10 Icons without a good Lucide match (approximation flagged)

These are functional (non-brand) icons where Lucide has no direct equivalent; the mapping above already assigns the closest available icon, but confirm visually during build:

`fa-file-pdf`, `fa-file-word`, `fa-globe-asia`, `fa-earth-asia`, `fa-laptop-code`, `fa-hat-wizard`, `fa-crystal-ball`, `fa-stars`, `fa-quran`, `fa-mosque`, `fa-monument`, `fa-university`, `fa-flag-checkered`, `fa-user-graduate`, `fa-user-shield`, `fa-user-tag`, `fa-users-cog`, `fa-users-slash`, `fa-child`, `fa-shield-halved`, `fa-running`, `fa-futbol`, `fa-magnifying-glass-chart`, `fa-boxes-stacked`, `fa-file-invoice`, `fa-user-tie`, `fa-hand-holding-usd`, `fa-hand-holding-medical`, `fa-clipboard-question`, `fa-ranking-star`, `fa-building-flag`, `fa-project-diagram` (M12 module row, §6.13), `fa-user-secret` (M27 module row, §6.13) (33 icons).

v1.2: `fa-square-root-alt` (→ `Radical`) and `fa-variable` (→ `Variable`) left this list because Lucide 1.48 has the matching glyph. `fa-stars` was added (it was already approximate). The v1.1 count "(24 icons)" was wrong; the list had 21.

### 6.11 Broken/invalid icon strings observed in live data (D9)

M06 discovery (D-3) found subject `icon` values stored in the database that do **not** match any real Font Awesome class and therefore render **blank** on live: `fa-crystal-ball`, `fa-stars`, `fa-beaker`, `fa-flask-round`, `fa-trending-up`, `fa-variable`, `fa-languages`, `fa-monitor` (Sains, Kimia, Ekonomi, Matematik Tambahan, Bahasa Arab, Sains Komputer subjects). **D9 fix:** the icon resolver (BR-05, confirmed in M03 SRS) already does a same-name Lucide lookup as a fallback for any unresolved FA class, so these strings resolve to a visible icon instead of rendering blank (see §6.6 for the specific mappings: `fa-zap`→`Zap`, `fa-monitor`→`Monitor`, `fa-trending-up`→`TrendingUp`, `fa-variable`→`Variable`, `fa-flask-round`→`FlaskRound`, `fa-beaker`→`Beaker`, `fa-languages`→`Languages` match by name; `fa-crystal-ball`→`Sparkles` and `fa-stars`→`Star` are explicit approximations in §6.6/§6.10). v1.2: every one of these strings now has an explicit §6.6 row, so the result never depends on the fallback. This is a minimal, already-approved fix (blank icon = broken per D9's "visual bug" clause) and creates no new contradiction — the seed data keeps the same stored string, only the resolver's fallback path changes what renders.

### 6.12 Module SRS conflicts resolved (v1.2)

Module SRS icon lists that disagreed with this section were corrected to match it. Decisions, by closeness to the live FA glyph:

| FA name | Was (module SRS) | Decided (this table) | Why |
|---|---|---|---|
| `fa-redo-alt`, `fa-redo` | M05: `RotateCcw` | `RotateCw` | Both FA glyphs turn clockwise ("redo" = rotate right); `RotateCcw` turns the other way. |
| `fa-flag-checkered` | M05: `FlagTriangleRight` | `Flag` | No checkered flag in Lucide. `Flag` keeps the rectangular waving-flag silhouette; `FlagTriangleRight` is a pennant. |
| `fa-calendar-week` | M05: `CalendarDays` | `CalendarRange` | FA glyph highlights one row (a week); `CalendarRange` shows a bar inside the calendar. `CalendarDays` is the day-grid glyph, which belongs to `fa-calendar-alt`. |
| `fa-calendar-alt` | M05: `Calendar` | `CalendarDays` | FA6 `calendar-days` has the day grid; plain `Calendar` would duplicate `fa-calendar`. |
| `fa-edit` | design-system v1.1: `Pencil`; M03: `SquarePen` | `SquarePen` | FA `edit` = `pen-to-square` (pen over a square). This table changed; M03 was already right. |
| `fa-question-circle`, `fa-filter`, `fa-trash`, `fa-trash-alt`, `fa-spinner`, `fa-circle-notch` | M02/M03/M05: `CircleHelp`, `Filter`, `Trash2`, `Loader2` | `CircleQuestionMark`, `Funnel`, `Trash`, `LoaderCircle` | Same glyphs; deprecated alias names replaced by canonical ones. |

### 6.13 Module rows

**Rule.** §6.1–§6.8 are the global rows (`src/components/icon/fa-to-lucide.ts`). A module icon map (`src/components/icon/maps/mXX-*.ts`) must match its own sub-table below exactly and must never redefine a global §6.1–§6.8 row. A module that needs a new icon first asks the ui-ux-designer to add the row to its sub-table here, following the §6 rules (closest glyph, canonical `@lucide/vue` 1.48 name). The module then writes the row into its own map file. A row that more than one module needs goes into §6.1–§6.8, not here. (build-plan v1.4 §S.3 rule 3; ADR-0010 Amendment 2.)

Almost all current rows are global, so every module sub-table is empty except M12, M16, M27.

#### M01 — Authentication

| FA class | Lucide | Notes |
|---|---|---|
| none yet | | |

#### M02 — Users & schools

| FA class | Lucide | Notes |
|---|---|---|
| none yet | | |

#### M03 — Curriculum

| FA class | Lucide | Notes |
|---|---|---|
| none yet | | |

#### M04 — Question bank

| FA class | Lucide | Notes |
|---|---|---|
| none yet | | |

#### M05 — Practice

| FA class | Lucide | Notes |
|---|---|---|
| none yet | | |

#### M06 — SPM

| FA class | Lucide | Notes |
|---|---|---|
| none yet | | |

#### M07 — PKSK

| FA class | Lucide | Notes |
|---|---|---|
| none yet | | |

#### M08 — Student performance

| FA class | Lucide | Notes |
|---|---|---|
| none yet | | |

#### M09 — Content

| FA class | Lucide | Notes |
|---|---|---|
| none yet | | |

#### M10 — Teacher class

| FA class | Lucide | Notes |
|---|---|---|
| none yet | | |

#### M11 — Teacher analytics

| FA class | Lucide | Notes |
|---|---|---|
| none yet | | |

#### M12 — Kirkpatrick

| FA class | Lucide | Notes |
|---|---|---|
| `fa-project-diagram` | `Workflow` | approximation (DV-M12-30): FA glyph is three linked nodes in a tree, `Workflow` is two boxes joined by a connector. S1 card "Kirkpatrick Evaluation Flow" (FN-M12-2.3.1) |

#### M13 — Cikgu Alesa

| FA class | Lucide | Notes |
|---|---|---|
| none yet | | |

#### M14 — Gamification

| FA class | Lucide | Notes |
|---|---|---|
| none yet | | |

#### M15 — Rewards shop

| FA class | Lucide | Notes |
|---|---|---|
| none yet | | |

#### M16 — Battle games

| FA class | Lucide | Notes |
|---|---|---|
| `fa-fist-raised` | `HandFist` | raised clenched fist; same glyph. S6 hub card "Perang Fakta" "Main!" button |
| `fa-pencil-alt` | `Pencil` | diagonal pencil; same glyph. S6 hub card "Teka Silang Kata" "Main!" button |

#### M17 — Admin dashboard

| FA class | Lucide | Notes |
|---|---|---|
| none yet | | |

#### M18 — PPD / JPN

| FA class | Lucide | Notes |
|---|---|---|
| none yet | | |

#### M19 — Finance

| FA class | Lucide | Notes |
|---|---|---|
| none yet | | |

#### M20 — Marketplace

| FA class | Lucide | Notes |
|---|---|---|
| none yet | | |

#### M21 — Sponsorship

| FA class | Lucide | Notes |
|---|---|---|
| none yet | | |

#### M27 — School admin

| FA class | Lucide | Notes |
|---|---|---|
| `fa-user-secret` | `HatGlasses` | approximation: FA shows a person bust with a hat and glasses, `HatGlasses` shows only the hat and glasses. S6/S7 "Menyamar" button in the "Tindakan" cell, title "Log masuk sebagai pengguna ini" (FR-M27-121, FN-M27-8.5.1, EL-S6-22) |

---

## 7. Component inventory

Every component below replicates its live states. "Loading"/"empty"/"error" states are FR-G-10 requirements applied per component; exact BM copy is defined per screen in each module's SRS §8 — this section defines the **shared visual pattern**, not per-screen copy.

### 7.1 Buttons

| Variant | Style | States |
|---|---|---|
| Primary (auth) | `gradient-cta`, full width, `rounded-xl`/`rounded-2xl`, Outfit 700, min-height 48px mobile / 56px desktop, `.btn-bounce` hover lift | Default; **hover** `-translate-y-0.5`; **focus** ring `ring-2 ring-indigo-200` (INFERRED consistent with input focus ring); **loading** — icon swaps to `LoaderCircle` spin + label changes (e.g. "Sedang Memasuki..."), `:disabled`, opacity 50%; **disabled** opacity 50%, no pointer |
| Primary (app, indigo) | Solid indigo or `gradient-save`, `rounded-xl`, `fa-save`→`Save` icon | Same state machine as above, scoped per form |
| Primary (pink accent) | `from-pink-500 to-pink-600`, used only inside sections that use the pink accent (e.g. M03 Tahap Pendidikan) | Same |
| Secondary / outline | White bg, `border-2 border-slate-200`, slate text | **hover** border indigo-300, bg indigo-50 |
| Danger (icon button) | Slate-400 default, **hover** red-600 on red-50 bg, `rounded-lg` | Used for delete/logout icon buttons |
| Icon-only | `w-9 h-9`/`w-10 h-10 rounded-lg`, title tooltip for the action name (view/edit/delete) | Touch target ≥44×44px on mobile even if the visual box is smaller — pad the hit area, not the icon |
| Toggle-style button (S6/S9 "Aktif?" switch) | Emerald when on, slate when off, flips instantly on click, no confirm | **Error** (server 422 or network fail): flips back + native `alert()` with the exact BM copy from the module SRS (e.g. "Gagal kemaskini status" / "Ralat rangkaian") — DV-M03-07 pattern, replicate for all list-toggle buttons |

### 7.2 Inputs & selects

- App inputs (OBSERVED, `_raw/M05/work/page_dashboard.html` ~line 6549; built in `src/components/form/classes.ts`): `w-full px-3.5 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none transition`, about 44px tall. Auth pages: `rounded-2xl` and a custom `.input-focus` treatment.
- **Focus**: blue, `focus:border-blue-400 focus:ring-2 focus:ring-blue-300` (app). The earlier indigo spec (`px-4 py-3`, `ring-indigo-100`) is withdrawn; live is blue (D9/D10: replicate).
- **Validation**: client-side is **native HTML5 only** on the observed live forms (required, type=email, maxlength) — the browser's own bubble/message, not a custom BM message, except where a module SRS explicitly specifies a custom red-alert-box error (server-side `VALIDATION_ERROR`, §7.3 mock envelope). Replicate this split exactly: native browser validation stays native; only server-side errors get the custom red box.
- **Error** (server-rejected field): red border + red-700 helper text directly under the field (FR-G-09), and the full-form red alert box above the form listing every field error.
- **Disabled**: `bg-slate-50`, muted text, cursor not-allowed.
- Selects follow the same border/focus/error treatment; native `<select>` dropdown (no custom listbox component observed).
- Password fields: eye-toggle button inside the field (`Eye`/`EyeOff`), `autocomplete` set appropriately.
- Colour-picker fields (e.g. subject colour) pair a native `<input type=color">` with a read-only text mirror that updates live on every `input` event.

### 7.3 Checkboxes & toggles

| Type | Style | Notes |
|---|---|---|
| Checkbox (form field) | Native checkbox, label to the right, optional hint line below in `color-text-muted` | Used for "Aktif", role/level multi-select lists |
| Multi-select checkbox list | Bordered `rounded-xl` box, max-height 16rem (256px), internal vertical scroll, ~5 rows visible, hover row background | Observed on subject↔level linking (M03 S7/S8) — reusable pattern for any many-to-many picker |
| Toggle switch (list row) | Pill track, emerald = on / slate = off, thumb slides, **no confirm dialog**, immediate optimistic flip with server round-trip and revert-on-error (see §7.1) | Active/inactive flags across admin list screens |

### 7.4 Tables (with in-card scroll) and pagination

- **Container**: table lives inside a white `rounded-2xl` card. The table itself, not the page, scrolls horizontally when it doesn't fit: `overflow-x-auto` on a wrapper **inside** the card (NFR-RESP-05(b)).
- **No sticky columns — DECIDED (Delivery Lead, 2026-09-25, D9/D10).** In-card horizontal scroll only, no pinned/sticky column, at every width below the table's natural fit; at ≥1280px a table that fits with no scroll (e.g. M02's "all 10 columns fit") stays as-is. This confirms the foundation rule as final: it matches NFR-RESP-05(b) and the M07 audit precedent. `docs/requirements/srs/M02-users-schools.md` FR-M02-07 / DV-M02-01 (currently a sticky "Tindakan" column at 1024–1279px) will be aligned to this rule by the Delivery Lead routing it to the M02 owner — this designer does not edit M02's docs.
- Minimum text size inside a table cell: 12px at every width (never truncate a whole column to sub-12px "compact" text as a fix for overflow — scroll instead).
- Header cells are upper-case, `text-xs font-bold text-slate-500` (observed).
- Row actions (view/edit/delete) are icon buttons with `title` tooltips, right-aligned in a "Tindakan" column, always visible (not hover-only — DV-11 pattern: delete-type actions must be visible on touch and on keyboard focus, not just `:hover`).
- Pager controls keep the live Laravel classes plus a 44 px hit area and `flex-wrap` (NFR-RESP-03, DV-M04-09).
- **Empty state**: centered icon + BM message ("Tiada … dijumpai") + a relevant primary CTA button (e.g. "Tambah Soalan Pertama"); the table itself is not rendered.
- **Loading state**: skeleton rows (INFERRED — not observed on live due to read-only discovery; use 5 shimmering placeholder rows matching the column count).
- **Error state**: red alert box in place of the table + "Cuba Lagi" retry button (FR-G-10; INFERRED copy until a module confirms it).

**Pagination — exact live copy (Laravel default, English, not translated to BM — replicate exactly):**
- ≥640px (`sm` and up): `"Showing {from} to {to} of {total} results"` plus numbered page links (`1 … 10 … {n-1} {n}`), with `«` / `»` (`&laquo; Previous` / `Next &raquo;` in `aria-label`).
- <640px: compact text-only `"« Previous"` / `"Next »"` (no numbered links).
- Links preserve every active filter/sort in the query string (e.g. `?status=archived&page=2`).
- Page-size control where observed: a `select` "Tunjuk" with options like 25/50/100/200, defaulting per screen; changing it resets to page 1 and keeps other filters.

### 7.5 Filter strips

- A row of selects/inputs above a list table, inside its own card or inline with the page header.
- Submit is usually a single icon-only `Search` button (no visible "Tapis" label observed on some screens — replicate per-screen).
- **Responsive**: filter strip fields stack to 1 column below `md` (consistent with NFR-RESP-06's form rule) unless a module explicitly documents a 2-across compact layout for short selects (e.g. state + search side by side, M01 S2). No native horizontal scrollbar on a filter strip on mobile (DV-10 fix, generalised from M01 notifications filters to every filter strip: wrap instead of scroll).

### 7.6 Tabs

- Status-tab pattern (e.g. M04 question reports): a row of pill/segment links bound to a query param (`?status=`); the **active tab is solid-colour with white text**, inactive tabs are outline/tint. Each tab may carry a count, e.g. `"Menunggu (2)"`.
- An unrecognised query value shows the shared empty state and **no tab active** (not a fallback to the first tab).
- Below `md`, tabs that don't fit wrap to a second line or become a horizontally scrollable single-row strip **inside its own container** (never the page) — pick per-screen based on tab count (≤4 tabs: wrap; >4: in-strip scroll with visible partial next tab as an affordance).

### 7.7 Modals and native `confirm()`

- **Modal container**: below `md` (768px) modals are **full-width with small margins**, internal scroll capped at `90vh` (NFR-RESP-07). At `md` and above: centered, `max-w-lg` (or wider per content, e.g. report-question modal), backdrop click / `Esc` / explicit "Batal" / `X` close button all close it **without submitting**.
- **Native `confirm()`** is used pervasively on live for destructive or state-changing actions instead of a styled modal: delete row, bulk action, impersonate ("Login As"), toggle active status changes that need confirmation, subscription upgrade/cancel/extend. The rebuild replicates this **exactly** (D10 — no upgrade to a styled confirm dialog): call the browser's native `window.confirm(<exact BM text from the module SRS>)`; a dismiss sends nothing, an accept submits.
- **Native `alert()`** is used for simple blocking notices, e.g. "Sila pilih tindakan terlebih dahulu" (no action selected in a bulk bar) and the revert-on-error toggle messages. Replicate as native `alert()`, not a toast.

### 7.8 Toasts / flash messages

Live gives feedback in four ways. Use the one the module SRS names for each screen. Never swap one for another.

**1. Timed toast (`ToastMessage`, F-15; overview §9).** Live has Alpine `x-show` toasts on a few screens. Each shows one message, hides itself on a timer and has no queue. They are listed below.

| Module / screen | Trigger | Copy | Duration | Transition (live Alpine) | Source |
|---|---|---|---|---|---|
| M02 S2 create user | Copy button (`fa-copy`, title "Salin") next to the generated login id or password | "Disalin!" | 2 s | `x-transition.opacity` (fade). Toggled by `x-show="copiedToast"` | FR-M02-31, AC-M02-11.6, EL-M02-S2-104. Raw: `_raw/M02/S2-users-create__*.json` |
| M10 S28 databank (report modal) | "Hantar Laporan" result | Success shows the response `message`. Failure shows the response `error`, or "Gagal menghantar laporan." when there is none. A network failure shows "Ralat rangkaian. Sila cuba lagi." | 4 s (`setTimeout(…, 4000)`) | Slide + fade. Enter `transition ease-out duration-300`, `translate-y-4 opacity-0` → `translate-y-0 opacity-100`. Leave `transition ease-in duration-200`, `translate-y-0 opacity-100` → `translate-y-4 opacity-0`. Toggled by `x-show="toastMsg"` and `x-text="toastMsg"` | FR-M10-118, S28 copy row, AC-M10-43.3/43.4, EL-M10-S28-131. Raw: `_raw/M10/_scripts/guru_databank_BM.js` (`showToast(msg, success)`) |

- **Box style: INFERRED.** Discovery captured the element, its text, its Alpine state and its transitions. It did not capture the toast's classes or position. It also did not capture the colour tied to the M10 `toastSuccess` flag. F-15 uses this default box: `fixed bottom-6 left-1/2 z-50 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-xl bg-slate-800 px-4 py-2 text-center text-sm font-semibold text-white shadow-lg`. That is a fixed, bottom-centred slate-800 box with white semibold text. `w-max` sizes it to its text (without it the `left-1/2` box shrinks to half the viewport and wraps on mobile), and `max-w-[calc(100vw-2rem)]` keeps it inside a 320px viewport. There is no success or error colour variant, because none was observed. When a module captures its own toast classes, that screen passes them through `toastClass`.
- **Behaviour.** The toast is teleported to `body`. Showing it again, or changing its message while it is visible, restarts the timer. It has no ARIA live region (D10: live has none). The F-15 `fade` transition classes (150 ms in, 75 ms out) are INFERRED to match Alpine's `x-transition.opacity` defaults. The `slide` classes copy the M10 values above.

**2. Inline "copied" confirmations (not toasts).** These change or reveal text in place. Build them as described in their module SRS, not with `ToastMessage`:
- M09 S16: the `fa-link` button shows the badge "Link Disalin!" for 2 s (FR-M09-35).
- M09 S28: "Salin Pautan" changes to `fa-check` "Disalin!" (FR-M09-133).
- M14: "Salin Kod" changes to "✓ Disalin!" and "Salin Link" changes to "✓ Link Disalin!". Both labels stay until the page reloads (FN-M14-7.1.2/7.1.4).

**3. Flash / inline alert box (`AlertBox`, F-15).**
- **Observed, error only.** M01 S1 shows a failed login as `bg-red-50 border-2 border-red-200 text-red-700 rounded-2xl` with `fa-exclamation-circle` (→ `CircleAlert`) above the fields. The copy is "Email atau kata laluan tidak sah." (source: `docs/discovery/M01-authentication.md`).
- **INFERRED: the F-15 layout.** F-15 wraps the observed box as `flex items-start gap-3 p-4 text-sm` + the colour classes, with the icon `mt-0.5 h-5 w-5 shrink-0` and one `<p>` per message line. The padding, gap, text size and icon size were not captured.
- **INFERRED: the success variant.** F-15 uses `bg-green-50 border-2 border-green-200 text-green-700 rounded-2xl` + `CircleCheck`, which mirrors the error box. No success flash after a redirect was captured in any discovery. Every module lists it as unobserved: M04, M05 Q-M05-7, M07 L-5, M09 OQ-9, M10, M13, M14 and M15. All raw HTML captures (`_raw/M05/work/*.html`) were checked. The only green/emerald box found there is the M05 revision empty-state notice `bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4 text-emerald-700 font-semibold text-sm` ("Tiada soalan salah untuk subjek ini. Tahniah!"). It is an in-page notice, not a post-redirect flash, so it does not replace this inference. Replace the inference when a module captures a real success flash.
- **Persistence (INFERRED).** A flash stays until the next navigation. No auto-dismiss was observed, which fits a server-rendered Laravel flash session. Where discovery confirmed that no flash appears, render none: M01 logout, M01 guest redirect, M08 `/analisa-item` redirect, M09 unknown note id.

**4. Native `alert()` / `confirm()`** (see §7.7) gives immediate, blocking feedback. Live uses it for several copy actions: M10 S4 QR copy → `alert('Disalin!')`, and M08 S18 "Kongsi" fallback → `alert("Link disalin!")`. Keep these as native alerts. Do not turn them into toasts.

### 7.9 Stat cards

- White `rounded-2xl` card, `p-5`/`p-6`, containing: a small coloured label (top-left, `text-sm font-semibold`, tinted per metric), a large bold number (Outfit, ~28–32px), a coloured icon tile (top-right, `rounded-xl`, background = the metric's colour at full saturation, white icon), and an optional sub-caption line with a small icon + muted text (e.g. "Minggu ini: 0", "Aktif digunakan: 129,752").
- Grid: 4 columns desktop (`lg`+), 2 columns tablet and mobile (`< lg`) — confirmed from the admin dashboard screenshots at 1280/768/375.
- Some stat cards are full-width gradient "feature" cards (e.g. "Battle Arena — PvP Quiz Battles") spanning the full grid row with 2–3 inline stats and 2 icon buttons on the right — treat as a distinct "hero stat card" variant, not a 4-up grid card.

### 7.10 Cards (general content cards)

- White, `rounded-2xl`, `shadow` (subtle), `border` optional depending on section.
- Hover lift on clickable cards: `hover:-translate-y-0.5` (consistent with the button bounce feel).
- Subject/topic tile cards: coloured icon tile (background = subject colour at ~12.5% alpha, icon drawn in the full colour), title, optional description (never truncated per DV-M03-06a — wrap instead).

### 7.11 Avatars

- `w-10 h-10 rounded-full`, class `avatar-ring` (a subtle ring/border), background indigo, initials in white (e.g. "AP" for "Admin PRESTASI+").
- Sidebar/drawer identity card avatar may be larger (INFERRED same visual family, larger size, e.g. `w-12 h-12`).
- `alt="Avatar"` on the `<img>` variant when a real photo exists (profile upload) — otherwise the initials-on-colour fallback above.

### 7.12 Progress bars and rings

- **Linear bar**: `rounded-full`, track in a light tint of the subject/section colour, fill = the accent colour, width set inline via `style="width: n%"`. An inner percentage label is shown when non-zero and hidden at 0% (observed on M05 mastery bars). Colour bands by score (INFERRED, common pattern; confirm per module): red/low, amber/mid, emerald/high.
- **Level/XP progress bar**: shown inline inside a stat card next to a level number (header gamification chips, "Mata (Lvl 2)").
- **Circular/ring progress** (INFERRED — not explicitly captured with SVG detail in discovery so far; used conceptually for "Ketepatan"/accuracy-style metrics): implement as an SVG `<circle>` with `stroke-dasharray`/`stroke-dashoffset` driven by the same percentage value convention as the linear bar; colour bands identical to the linear bar. Flag as INFERRED until a module's discovery captures the exact SVG.

### 7.13 Chart containers

INFERRED (no chart screenshots with library fingerprints captured in M01–M09 discovery so far): charts render inside a white `rounded-2xl` card with a heading and optional legend row above the chart area. At `<md`, the chart area SHALL scale to the card's width (responsive SVG/canvas, not a fixed pixel width) and SHALL NOT cause page-level horizontal scroll — if a chart is inherently wide (e.g. a long time series), it scrolls horizontally **inside its own container**, same rule as tables (NFR-RESP-10). Revisit this section once a module with charts (M08, M17) reaches discovery/design.

### 7.14 Empty states

- Centered content: a large muted icon (Lucide, `text-slate-300`/`text-slate-400`, ~48–64px), a short BM message (e.g. "Tiada soalan dijumpai", "Tiada laporan buat masa ini"), and — where the empty state is actionable — a primary button (e.g. "Tambah Soalan Pertama", "Daftar baru.").
- Unknown/invalid filter values show the same empty state with **no** active tab/filter highlighted (not a silent fallback to a default).

### 7.15 404 and 403 pages

Both use the **same template** (only the background, emoji, code, heading, message, and button targets differ) — no shell (no sidebar/header), full-screen:
- Background (measured on live, §1.3): 404 uses `bg-error-page` (135deg blue-900 → violet-600 → pink-500); 403 uses `bg-forbidden-page` (135deg red-800 → red-600 → orange-500).
- Large translucent code number (404 or 403) — Outfit/system font per observation (404 uses the system font, not Inter — replicate exactly).
- An emoji matching the situation: 🔍 for 404, 🚫 for 403.
- Heading (white, bold) + one-line explanation (white/80% opacity).
- Two pill buttons: a white solid primary action and a translucent secondary action.
- Small caption "PRESTASIPLUS" at the bottom.

| Page | Heading | Message | Primary button | Secondary button |
|---|---|---|---|---|
| 404 | "Halaman Tidak Dijumpai" | "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?" | "Halaman Utama" → `/` | "Mula Latihan" → `/practice` (DV-02 fix; live links to `/latih-tubi`, which is broken — D9 fix) |
| 403 | "Akses Ditolak" | "Anda tidak mempunyai kebenaran untuk mengakses halaman ini. Sila log masuk dengan akaun yang betul atau hubungi pentadbir." | "Halaman Utama" → `/` | "Log Masuk" → `/login` |

---

## 8. Accessibility checklist (replicate-live baseline, D10)

Per NFR-02/D10, this is a **parity checklist**, not an enhancement target. Tick items are about not regressing below what live already does, plus the specific D9 fixes already approved in module SRS docs.

- [ ] Every interactive element has a visible focus state consistent with the indigo ring pattern used on inputs/buttons (replicate; do not add a new focus style live doesn't have).
- [ ] Icon-only buttons keep their `title` tooltip (view/edit/delete/toggle) as the accessible name — replicate, do not add `aria-label` beyond what a `title` already provides unless a module's SRS says the live DOM has no accessible name at all (then it's a D9 "unreadable/unusable" fix, not an enhancement).
- [ ] Native browser validation messages stay native (no custom ARIA live-region for HTML5 validation, matching live).
- [ ] Native `confirm()`/`alert()` stay native dialogs (keyboard-operable by default via the browser) — do not replace with a custom modal (that would be scope creep, D10).
- [ ] Text is never smaller than 12px anywhere in `main` content, at any viewport (D9 fix, e.g. DV-M03-06b).
- [ ] All touch targets ≥44×44px on touch/mobile viewports, even where the visual glyph is smaller (pad the hit area) — NFR-RESP-03.
- [ ] Row/action buttons that were hover-only on live (e.g. delete icon) are always visible on touch devices and on keyboard focus (DV-11 pattern, D9 fix — hover-only controls are "unusable on touch").
- [ ] `prefers-reduced-motion` is honoured the same way the live CSS bundle implies (present but not further enhanced).
- [ ] Colour is never the only signal for a status — every status pill/badge also carries a text label (already true of every observed live badge; keep it that way).
- [ ] No horizontal page scroll at any width 320–1920px on any screen (NFR-RESP-01); only tables/charts/wide content scroll inside their own container.

---

## 9. Decisions and open items

### 9.1 Decided (Delivery Lead, 2026-09-25, D9/D10)

1. **Table sticky column — DECIDED.** No sticky columns; in-card horizontal scroll only (see §7.4). Confirms the foundation rule as final, per NFR-RESP-05(b) and the M07 audit precedent. M02's FR-M02-07/DV-M02-01 will be aligned by the Delivery Lead routing it to the M02 owner; not edited here.
2. **Brand/social icons — DECIDED to defer.** No package/SVG choice made now; recommendation (§6.9: `simple-icons` package vs. inline SVG) carried forward, decision made at M09's own G2 design stage.

### 9.2 Still tracked — resolved when the owning module reaches design (confirmed fine as-is, 2026-09-25)

1. **NEW badge colour — RESOLVED (v1.4).** The badge was captured in `_raw/M05/work/page_dashboard.html` in two forms. The "Pusat AI" section heading uses an indigo → purple gradient. The "Sekolah Bersaing" item uses solid amber-500. The emerald proposal is withdrawn. The only emerald pill on live is the separate `BARU` badge on the drawer item "Kelas Saya". Exact strings are in §4.
2. **Compliance badge colours** (M04: VERIFIED / QUARANTINED / PENDING_MAPPING / DRAFT / REJECTED / MISSING_SOURCE / VERIFIED_GENERATED) — text/case observed, exact colour classes not captured; proposed semantic mapping in §5, to confirm at M04 design/build.
3. **Approved question-status pill colour** ("Diluluskan" in the list row) — dashboard tile uses indigo, but the row-level status pill colour wasn't explicitly recorded; proposed emerald for consistency with other "approved/success" pills, to confirm at M04 build.
4. **Circular/ring progress** and **chart containers** (§7.12–7.13) are INFERRED placeholders — no module discovery has captured their exact implementation yet (M08/M17 will). Treat as provisional until those modules reach design.
