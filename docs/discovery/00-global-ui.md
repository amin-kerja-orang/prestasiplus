# 00 — Global UI (shell, chrome, design tokens)

Source: live walk-through of https://prestasiplus.my on 2026-09-25, logged in as admin (read-only).
Screenshots: `docs/discovery/img/global/`. The UI copy is in Bahasa Melayu (BM) and is quoted exactly as it appears.

> Colour note: the site uses **Tailwind CSS v4**, which defines colours in `oklch()`. Hex values below are the matching Tailwind palette values (for example `indigo-500` = `#6366F1`). Hex values from custom CSS are exact.

---

## 1. Technology fingerprint (what the live site is built with)

| Aspect | Observation |
|---|---|
| Backend | **Laravel** (Blade server rendering). Signs: `<meta name="csrf-token">`, hidden `_token` in every form, `_method=PUT` spoofing, `XSRF-TOKEN` cookie, Laravel-style pagination ("Next »", `?page=N`), `/password/reset/{token}` and `/password/email` routes |
| Build | Vite (`/build/assets/app-<hash>.js`, `/build/assets/app-<hash>.css`) |
| CSS | Tailwind CSS v4 (uses `oklch` colours and rem breakpoints). Pages also have their own `<style>` blocks for custom classes such as `.float-icon`, `.role-card` and `.grade-btn` |
| JS | **Alpine.js** (`x-data`, `x-show`, `x-model`, `@click`). No Livewire, no Inertia, no Vue/React, no jQuery |
| Icons | **Font Awesome 6.5.1 Free**, from cdnjs (`fas` solid, some `far` regular). About 200 icons on the admin dashboard. Native emoji are used heavily as decoration and inside labels. **Rebuild: map to Lucide** (see §6) |
| Fonts | Google Fonts: **Inter** (body, 300–700), **Outfit** (headings, 400–800), **Scheherazade New** (Arabic text, 400/700; loaded in the app layouts) |
| CDN / analytics | Cloudflare (`/cdn-cgi/rum`, Cloudflare Insights beacon) |
| PWA hints | `<meta name="theme-color" content="#3B82F6">`, `viewport-fit=cover`, bottom nav uses `pb-[env(safe-area-inset-bottom)]` |
| Dark mode | A `prefers-color-scheme: dark` media query is in the CSS bundle, but no dark theme was seen. Treat it as **not supported** |

---

## 2. Breakpoints (from the CSS bundle's media queries)

| Name | Min width | Where it is used in the shell |
|---|---|---|
| `sm` | 640px (40rem) | Larger header padding (`sm:px-6 sm:py-4`), larger text, bottom-nav icon size |
| `md` | 768px (48rem) | Auth pages switch from 1 column to 2 columns (`grid md:grid-cols-2`) |
| `lg` | 1024px (64rem) | **Main shell switch**: fixed sidebar is shown (`hidden lg:block`), bottom nav is hidden (`lg:hidden`), full header (chips, avatar, logout) |
| `xl` | 1280px (80rem) | Minor widget layouts |
| `2xl` | 1536px (96rem) | Present in the bundle, but not significant in the shell |
| custom | `max-width: 1023px` | Mobile-only tweaks (same threshold as `lg`) |

**Summary for the rebuild:** use the Tailwind defaults. `< lg` is the "mobile/tablet shell" (bottom nav, drawer, compact header). `≥ lg` is the "desktop shell" (fixed 256px sidebar and full header). Note that **tablet (768px) uses the mobile shell**.

### Responsive defects on the live site (do NOT copy)
| # | Where | Defect |
|---|---|---|
| G-D1 | `/dashboard` at 768px | Page scrolls sideways (scrollWidth 762 vs 753 viewport). Cause: a decorative absolute `w-64 h-64` blob and a horizontally scrolling article carousel that is not clipped |
| G-D2 | Admin layout at <1024px | Header has no avatar or logout. Logout can only be reached through bottom nav → "Lagi" → "Log Keluar" (hard to find) |
| G-D3 | Admin layout on non-admin pages (e.g. `/tetapan`) | Header title stays "Dashboard / Selamat datang, Admin" instead of the page title |
| G-D4 | User drawer (<lg) vs desktop sidebar | The two menus have **different items and ordering** (for example the drawer has "Amaran Awal" and "Command Center"; the desktop sidebar has "Target SPM" and "Misi Harian" at the top). The rebuild should use one menu definition for both |
| G-D5 | Admin `/admin` sidebar | Very long single scroll list (~90 links) with section headers plus collapsible groups. The two ways of grouping are mixed |

---

## 3. Admin panel shell (`/admin/*`)

Screenshots: `img/global/admin-shell-desktop.png`, `admin-shell-tablet.png`, `admin-shell-mobile.png`, `admin-mobile-lagi-menu.png`.

### 3.1 Layout
- `body`: `font-body antialiased`, text colour slate-700 `#334155`, background `linear-gradient(135deg, #EFF6FF 0%, #E0E7FF 40%, #EDE9FE 60%, #F5F3FF 100%)`.
- **Sidebar** `<aside class="sidebar fixed left-0 top-0 h-screen w-64 z-40 hidden lg:block overflow-y-auto">`: 256px wide, white at 95% opacity, shadow `4px 0 16px rgba(99,102,241,0.08)`. Only shown at ≥1024px.
- **Header** `<header class="topbar sticky top-0 z-30 px-3 py-2 sm:px-6 sm:py-4">`: white at 95% opacity, shadow `0 2px 12px rgba(99,102,241,0.08)`, height ~87px on desktop.
- **Main** `<main class="flex-1 py-3 sm:py-6 mx-auto w-[95%] page-transition">`: fluid width (95%), no max width. The page fades in (`page-transition`).
- The browser tab title uses the format `<Page> - Admin Panel`.

### 3.2 Sidebar content (top to bottom)
1. Logo (`/images/logo-custom.png`, h-8/sm:h-10) linking to `/admin`, with the caption "Panel Pentadbir" below.
2. **Pinned items**:
   - "Command Center" card: gradient `135deg #312E81 → #4F46E5`, radius 12px, white text, satellite-dish icon, and a red **LIVE** pill (`bg-red-500 text-[8px] rounded-full animate-pulse`). Links to `/admin/command-center`.
   - "Aktiviti Harian" (emerald), "Audio KBAT" (amber). These are coloured text links.
3. **Section headers** (uppercase `text-xs font-extrabold tracking-wider`, each with a coloured gradient rule): `HARIAN` (teal), `ANALITIK` (indigo), `PENGURUSAN` (blue), `SISTEM` (slate), `🏆 BILIK DUTA` + **DEV** pill (`bg-amber-500 text-white text-[8px] rounded-full`), `🤖 PUSAT AI`, `✨ VISI & PERTANDINGAN`, `💎 KILLER FEATURES`.
4. **Collapsible groups** (a button with a coloured FA icon, uppercase label and chevron). Group keys: `kirkpatrick`, `kurikulum`, `soalan`, `pengguna`, `spm`, `premium`, `gamifikasi`, `battle`, `marketplace`, `kandungan`, `kewangan`, `sistem`. Open/closed state is saved in `localStorage["admin_sidebar"]` as a JSON map `{key: bool}`. The group of the active page opens by default.
5. The full link list is documented per module in TRACKER (M02–M26). It ends with "Tetapan Peribadi" → `/tetapan` and "Ke Dashboard" → `/dashboard` (emerald, arrow-left icon; this is the "student view" switch).
6. Footer user block: avatar initials, name (`text-sm font-semibold`), role label "Admin", and a logout icon → `/logout`.

**Nav item styles**
| State | Style |
|---|---|
| Default | `nav-item flex items-center space-x-3 px-4 py-2.5`, text slate-500 `#64748B`, radius 16px, icon `w-5` coloured by category |
| Active | White text, background `linear-gradient(135deg, #3B82F6 0%, #6366F1 50%, #8B5CF6 100%)`, radius 16px, shadow `0 4px 12px rgba(99,102,241,.3), 0 2px 6px rgba(139,92,246,.2)` |
| Sub-item (inside group) | Smaller `w-4 text-xs` slate-400 icon |

### 3.3 Header (≥lg)
- Left: page title `h1` (Outfit 700, 24px, slate-800 `#1E293B`; 16px on mobile) and a subtitle (`text-sm` slate-500), e.g. "Dashboard" / "Gambaran Keseluruhan Platform".
- Right:
  - **Server status pill** (`x-data="serverStatus()"`, `hidden lg:block`): `bg-slate-50 border border-slate-200 rounded-xl`, 11px text. It shows CPU %, RAM %, Disk %, Uptime (e.g. "204d 0h") with FA icons microchip / memory / hard-drive / clock. It polls `GET /admin/server-status` every 30s. Colour thresholds:
    - CPU: >80 red, >50 amber, otherwise emerald.
    - RAM: >85 red, >60 amber.
    - Disk: >90 red, >75 amber.
    - Tooltips: "Load: x / n cores", "used GB / total GB".
  - Avatar: `w-10 h-10 rounded-full avatar-ring`, initials ("AP") on an indigo background.
  - Logout icon button `w-9 h-9 rounded-lg`, slate-400, hover red-600 on red-50. It is a plain **link** to `/logout` (GET).
- There is **no global search** and **no notification bell** in the admin header.

### 3.4 Mobile/tablet (<1024px)
- The sidebar is hidden. The header shows only the title/subtitle and the logo on the right.
- **Bottom nav** (`lg:hidden fixed bottom-0 bg-white border-t shadow-lg`, ~45px high) has 5 items, each an icon over a label:
  - "Dashboard" (`fa-tachometer-alt`) → `/admin`
  - "Soalan" (`fa-question-circle`) → `/admin/questions`
  - "Penaja" (`fa-handshake`) → `/admin/sponsors`
  - "Pengguna" (`fa-users`) → `/admin/users`
  - "Lagi" (`fa-ellipsis-h`) opens a popover (`open = !open`)
  - The active item is indigo.
- **"Lagi" popover**: a white rounded card anchored bottom-right, max-height with its own scroll. It lists links with coloured icons, grouped by small uppercase headings (SPM, SOALAN, KURIKULUM, …). It ends with "Student View" → `/dashboard` and "Log Keluar" → `/logout`.
- Dashboard stat cards change from 4 columns (desktop) to 2 columns (tablet and mobile).

---

## 4. User portal shell (`/dashboard` and all learner/teacher pages)

Screenshots: `img/global/user-shell-desktop.png`, `user-shell-tablet.png`, `user-shell-tablet-drawer.png`, `user-shell-mobile.png`.

### 4.1 Layout
- `body` background `linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 35%, #E0E7FF 65%, #EDE9FE 100%)`.
- **Sidebar**: 256px wide, white, with two faint radial gradients (indigo/violet at 3%). Shadow `4px 0 16px rgba(99,102,241,.06)`. It slides (`transition-transform duration-300`). On desktop it can be collapsed with the hamburger (`sidebarOpen`, saved in `localStorage["sidebarOpen"]`).
- **Header**: same "topbar" style as admin. The tab title format is `<Page> - PRESTASIPLUS`.
- **Main**: `w-[95%] mx-auto` fluid width.
- **Footer** (white strip): "© 2026 PRESTASIPLUS. Hakcipta Terpelihara ✨" / "Didikan penuh ❤️ dari Malaysia 🇲🇾".

### 4.2 Sidebar (≥lg)
- Logo with the caption "Platform Latih Tubi Nasional".
- Nav items are larger than in admin: `text-lg` icons, `py-3`, radius 16px. The active item uses the same blue→indigo→violet gradient as admin.
- **Badges** on items:
  - "SPM" (amber pill), "NEW", "AI" (purple), "DEV" (amber), "PRO" (indigo).
  - Emoji badges (🎮 🎟️ 🏆 💎).
  - Count badges (e.g. "Gambar Rajah 6,144", "Urus Tiket 2", red).
- Section headings seen: `SPM`, `PUSAT AI`, `🤖 CIKGU ALESA AI`, `✨ VISI & PERTANDINGAN`, `🏆 BILIK DUTA · 🔒 PREVIEW`, `🤖 AI PINTAR (PELAJAR)`, `🎯 AI PINTAR (GURU)`, `🛡️ KAWALAN KUALITI`, `💎 KILLER FEATURES`, `PEMBELAJARAN`, `CIKGU ALESA TOOLS`, `PORTAL GURU`, `PPD / JPN`, `ADMIN`, `BANTUAN`. For admin, all of these show. INFERRED: each section is filtered by role.
- It ends with the admin-only "Ke Admin Panel" (→ `/admin`), plus "Profil Saya" → `/profile`, "Pakej 💎" → `/pricing`, "Invois Saya", "Panduan", "Tiket Bantuan", and a user block with logout.

### 4.3 Header (≥lg)
Left to right:
1. Hamburger (`fa-bars`, toggles the sidebar).
2. Page title and subtitle, e.g. "Dashboard" / "Selamat datang kembali".
3. **Gamification chips** (rounded-full pills with a 2px border):
   - "256 koin": amber/yellow, coins icon.
   - "8 mata": purple, star icon.
   - "1 hari 🔥": orange gradient, fire icon (the streak).
4. **Notification bell** (`fa-bell`) with a red count badge ("99+" is the cap). It links to `/notifikasi`. The count comes from `GET /notifikasi/unread-count` → `{count:number}`.
5. Avatar (initials, ring).
6. Logout icon → `/logout`.

### 4.4 Mobile/tablet (<1024px)
- **Header**: title/subtitle (the subtitle is truncated with an ellipsis), bell with badge, a hamburger in a square (`bg-indigo-50 rounded-xl`), and the logo.
- **Chips strip**: koin / mata / streak move to a thin cream-coloured bar under the header.
- **Drawer**: opened by the hamburger. It slides in from the left (~280px wide) with a blurred dark overlay. At the top are the logo, a close ✕, and a **user card** (avatar, name, role on a cream background). Then a scrolling nav list, with the active item in an indigo-50 pill. The "Command Center" item shows as a dark gradient card with LIVE.
- **Bottom nav** (`bottom-nav fixed bottom-0 z-50 lg:hidden`, safe-area padding) has 6 items:
  - "Home" → `/dashboard`
  - "SPM" → `/spm`
  - "Game" → `/permainan`
  - "Topik" → `/topics`
  - "Chat" (opens the chatbot widget)
  - "Lagi" (opens a menu)
  - Icons are coloured per item; the active item has an underline indicator.
- Content cards stack into 1 column. The right-hand "Artikel Terkini" panel becomes a horizontal carousel.

### 4.5 Global widgets (present on every user page)
- **Chatbot widget** (`chatbotWidget()`): a floating action button. It auto-hides after 30s of inactivity, and stays hidden for the rest of the tab session (`sessionStorage["chatbot_fab_hidden_session"]`). A session id is kept in `localStorage["chatbot_session_id"]`. History comes from `GET /chatbot/history?session_id=…`. Guests are first asked for their name and phone ("lead capture", stored in localStorage `chatbot_lead_name` / `chatbot_lead_phone`). Logged-in users skip that step. Streaming reply (EventSource). Details belong in the chatbot module.
- **Tournament banner** (`tournamentBanner()`): `GET /api/tournament/active` (Accept JSON, `X-Requested-With`) returns an array. It was empty at the time of the walk-through.

---

## 5. Shared pages

### 404 page (`img/global/404-desktop.png`)
- Full-screen diagonal gradient: indigo-800 → violet-600 → pink-500.
- A large translucent "404", a 🔍 emoji, the heading "Halaman Tidak Dijumpai" and the text "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?".
- Two pill buttons: "Halaman Utama" (white, links to `/`) and "Mula Latihan" (translucent, links to `/latih-tubi`). Small caption "PRESTASIPLUS".
- The page uses the system font, not Inter.

### Auth layout (used by login, register and the password pages)
See M01. There is no sidebar or header. The animated pastel gradient background shifts over 15s (`coolGradient`), with floating emoji (`floatBounce 6s`, opacity 0.6) and an SVG wave at the bottom.

---

## 6. Design tokens summary

### Colours
| Token (proposed) | Value | Where it is used |
|---|---|---|
| `primary` | `#6366F1` (indigo-500) | Focus rings, selected states, links, active tabs (indigo-600 `#4F46E5`) |
| `primary-gradient` | `linear-gradient(135deg, #3B82F6 0%, #6366F1 50%, #8B5CF6 100%)` | Active nav item; hero cards |
| `cta-gradient` | `linear-gradient(to right, #3B82F6, #6366F1, #9333EA)` (blue-500 → indigo-500 → purple-600) | Auth submit buttons |
| `save-gradient` | `linear-gradient(to right, #6366F1, #A855F7)` | "Simpan Profil" |
| `warn-gradient` | `linear-gradient(to right, #F59E0B, #F97316)` | "Tukar Kata Laluan" and streak chip |
| `teal-gradient` | teal-700 → cyan-500 (approximate) | "Simpan Tetapan" (`/tetapan`) |
| `command-gradient` | `linear-gradient(135deg, #312E81, #4F46E5)` | Command Center card |
| `theme-color` | `#3B82F6` | Browser UI colour |
| `text` | `#334155` (slate-700) | Body text |
| `text-strong` | `#1E293B` (slate-800); auth pages use gray-800 `#1F2937` | Headings |
| `text-muted` | `#64748B` (slate-500), `#94A3B8` (slate-400) | Subtitles, nav default, hints |
| `border` | `#E2E8F0` (slate-200) / `#E5E7EB` (gray-200) | 2px input borders, cards |
| `danger` | `#EF4444` (red-500); alert box `bg-red-50 border-red-200 text-red-700` | LIVE badge, errors, notification badge |
| `success` | emerald-500 `#10B981` | Server status OK, school chip |
| `warning` | amber-500 `#F59E0B` | DEV badge, koin chip |
| `bg-app` (admin) | `linear-gradient(135deg, #EFF6FF, #E0E7FF 40%, #EDE9FE 60%, #F5F3FF)` | Admin body |
| `bg-app` (user) | `linear-gradient(135deg, #EFF6FF, #DBEAFE 35%, #E0E7FF 65%, #EDE9FE)` | User body |
| `bg-auth` | `linear-gradient(135deg, #EFF6FF, #DBEAFE 25%, #E0E7FF 50%, #EDE9FE 75%, #EFF6FF)`, `background-size:400%`, animated over 15s | Auth pages |
| `surface` | `#FFFFFF` (cards); `rgba(255,255,255,.95)` (sidebar/header) | |

Category icon colours (sidebar) cycle through the Tailwind 500 shades: teal, amber, violet, rose, indigo, emerald, blue, orange, cyan, pink, purple, red, fuchsia.

### Typography
| Role | Font | Size / weight |
|---|---|---|
| Body | Inter | 16px / 400; labels 14px / 600; hints 12px |
| Headings (`font-heading`) | Outfit | Page title 24px / 700 (mobile 16px); auth H2 30px / 700 (mobile 20px); profile name 30px / 700 |
| Buttons (primary) | Outfit | 16–18px / 700 |
| Section labels | Inter | 12px / 800, uppercase, `tracking-wider` |
| Badges | Inter | 8–10px / 700 |
| Arabic | Scheherazade New | 400 / 700 |

### Radius, shadow, spacing
| Token | Value |
|---|---|
| Radius: input | 12px (app `rounded-xl`), 16px (auth `sm:rounded-2xl`) |
| Radius: card | 16px (`rounded-2xl`) app; 24px (`rounded-3xl`) auth card and hero |
| Radius: nav item | 16px |
| Radius: chips / badges | full |
| Shadow: sidebar | `4px 0 16px rgba(99,102,241,.06–.08)` |
| Shadow: header | `0 2px 12px rgba(99,102,241,.06–.08)` |
| Shadow: auth card | Tailwind `shadow-2xl` |
| Shadow: active nav | `0 4px 12px rgba(99,102,241,.3), 0 2px 6px rgba(139,92,246,.2)` |
| Input | `px-4 py-3`, 2px border, focus `border-indigo-400 ring-2 ring-indigo-100` (app) or a custom `.input-focus` (auth) |
| Spacing feel | Generous and playful: card padding 20–40px, gaps of 8–24px. Heavy use of emoji, pastel tints (`*-50` backgrounds), gradient buttons, and hover lift (`hover:-translate-y-0.5`, `.btn-bounce`) |

### Motion
- `coolGradient` (15s bg shift), `floatBounce` (6s floating emoji), `popIn`, `mascotBounce`, Tailwind `animate-pulse` (LIVE badge), `animate-spin` (loading spinners), `page-transition` (main content fade).
- Respect `prefers-reduced-motion`: the bundle has the query, so the rebuild should honour it.

### Icon mapping (Font Awesome → Lucide), shell-level
| FA | Lucide |
|---|---|
| `fa-bars` | `Menu` |
| `fa-bell` | `Bell` |
| `fa-sign-out-alt` | `LogOut` |
| `fa-home` | `Home` |
| `fa-tachometer-alt` | `Gauge` |
| `fa-question-circle` | `CircleHelp` |
| `fa-handshake` | `Handshake` |
| `fa-users` | `Users` |
| `fa-ellipsis-h` | `Ellipsis` |
| `fa-graduation-cap` | `GraduationCap` |
| `fa-gamepad` | `Gamepad2` |
| `fa-book-open` | `BookOpen` |
| `fa-comments` | `MessagesSquare` |
| `fa-satellite-dish` | `SatelliteDish` |
| `fa-cog` | `Settings` |
| `fa-arrow-left` | `ArrowLeft` |
| `fa-microchip` | `Cpu` |
| `fa-memory` | `MemoryStick` |
| `fa-hard-drive` | `HardDrive` |
| `fa-clock` | `Clock` |
| `fa-coins` | `Coins` |
| `fa-star` | `Star` |
| `fa-fire` | `Flame` |
| `fa-eye` | `Eye` / `EyeOff` |
| `fa-envelope` | `Mail` |
| `fa-lock` | `Lock` |
| `fa-id-card` | `IdCard` |
| `fa-user-plus` | `UserPlus` |
| `fa-sign-in-alt` | `LogIn` |
| `fa-paper-plane` | `Send` |
| `fa-unlock-alt` | `LockOpen` |
| `fa-check-double` | `CheckCheck` |
| `fa-trash-alt` | `Trash2` |
| `fa-exclamation-circle` | `CircleAlert` |
| `fa-circle-notch` (spinner) | `Loader2` |

---

## 7. Client-side storage keys seen
| Key | Store | Purpose |
|---|---|---|
| `admin_sidebar` | localStorage | Open/closed state of admin sidebar groups |
| `sidebarOpen` | localStorage | User sidebar collapsed or expanded |
| `chatbot_session_id` | localStorage | Chatbot session |
| `chatbot_lead_name`, `chatbot_lead_phone` | localStorage | Guest chatbot lead capture |
| `chatbot_fab_hidden_session` | sessionStorage | Chatbot button hidden for the rest of the tab session |
