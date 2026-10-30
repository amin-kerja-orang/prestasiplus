# Portal Pembelajaran - page templates (murid + guru, one design language, DS components only)

| Field | Value |
|---|---|
| Slug | `v2-learner-page-templates` |
| Version | 1.0, 2026-10-30 |
| Author | ui-ux-designer |
| Status | **Proposed - needs product-owner approval** (open questions in section 7) |
| Evidence | Learner audit 2026-10-29/30: code (446 files, 10,165 violations, 12,816 class tokens), guru visual (26 routes x 375/1280 x light/dark), murid visual (46 screens x 4). Practice question screen was not captured; it is designed from `v2-shells.md` 5.2 and `v2-learner-prototype.html`. |
| Builds on | `v2-admin-page-templates.md` (sections 0-4, 6; rule numbers 1.1-1.13 and R1-R14 are reused), `v2-shells.md` 5, `v2-design-language.md`, `v2-design-system.md`, `v2-copy-glossary.md`, `v2-learner-prototype.html`, tracker decisions D35-D38, D43, D45 |
| Scope | Portal Pembelajaran: murid (learner personality, dark default) and guru (staff look inside the learning shell, light/system). `m11`/`m12`/`m17` pages (Monitoring, Kirkpatrick, Command Center) are owned by the Pentadbiran redesign and are only referenced. Auth screens (`/login`, `/register`) are outside the shell and not covered. |
| Language | Doc English; every UI string is exact BM |
| Visual demo | Design canvas "Templat Pembelajaran Murid": Home 1280 and 390 (dark), Home 1280 (light, top part), Soalan latihan 390 and 1280, Topik 1280 and 390. Source files in the scratchpad `learner-canvas/project/`. |

## 0. Principles

1. **Look only (hard rule from the owner).** This document changes how existing pages look. It does **not** rename, merge, add or remove menu items, pages, tabs or sections, and does not reorder content. Every template below describes how an *existing* page family is composed from DS parts. Anything that smells structural is one line in section 7 and nothing more.
2. **One design language.** A page is a template filled with `src/ds` components (admin doc section 0, decisions 1-2). Strictness is the same as the admin portal: a page file composes only `Ds*` components and the Nuxt UI parts the DS sanctions (R7). No custom class, no `:ui`, no `<style>`.
3. **Two personalities, one rule set.** Murid = "Elektrik", dark default, neutral charcoal/white base, colour only at focus points, Phosphor Duotone glyphs, Fluent 3D art for rewards, the friend (Aiman/Aisyah) says "awak". Guru = calm staff B+ inside the learning shell (kobalt glyph chips, one theme colour). The personality is set by the shell (`data-personality`); a template never branches on it.
4. **ALESA AI stays hidden.** No floating Cikgu Alesa button, no "AI" pill or AI-tagged explanation, no `/cikgu*` surface (except `/cikgu/hadiah`, the digital shop). The quiz feedback sheet shows "Penjelasan" without an AI tag.
5. **Same content, same order.** Home keeps all 13 sections in their current order; hubs keep their cards. The demo restyles, it does not shorten.
6. **Fictitious names only** (Aina, Haziq, Aiman, Aisyah, "Pelajar Demo").
7. **Fix what is broken, replicate what works** (D9): fixes are listed in the "Visual fixes vs today" table (section 8); nothing else is touched.

### 0.1 Learner deltas from the admin doc (summary)

| Topic | Admin | Learner |
|---|---|---|
| Content gutter | 16 below `md`, 24 from `md` | same (today 16 at every width at 375, 16 at 1280: raised to 24 from `md`) |
| Section gap | 24 (>= `md`), 20 below | 24 (>= `md`), 16 below (Home reads as a stream of cards; today 32 and 24 mixed) |
| Width | fill, cap 1600 | fill, cap **1152**, never narrower (today 1152 / unbounded / 896 / 768 / standalone) |
| Page title | navbar h1 = menu label | same; plus the "headline" rule (1.1) for pages whose own title differs from the label |
| Header row | `DsPageHeader` subtitle + 2 tonal + 1 primary | murid: optional intro sentence + at most one primary; no header on Home (greeting card instead) |
| KPI strip | `DsStatRow roomy`, 2-5 tiles | `DsStatRow` learner density: icon chip + number + label; 3 across at 375 for 3 tiles |
| Table | `DsDataTable` flush + card list | murid has almost no tables (lists/cards); guru reuses the admin table spec as is |
| Surface | layers, shadow-xs | murid: layers, no border, `shadow-raised` only in light; dark = surface step only |
| Accents | one per KPI tile in fixed order | murid: max **4 accents per screen** (action blue, reward orange/amber, win lime, violet info) plus semantic success/error |
| Mode | system | murid dark default; guru system (light in the audit) |
| Mobile nav | none | murid and guru: bottom tab bar + "Lagi" drawer (shell, unchanged) |

## 1. Page anatomy (rules 1.1-1.13, adapted)

### 1.0 The one-line rules

| # | Item | Rule | Learner delta |
|---|---|---|---|
| 1.1 | Title | The shell navbar prints the one `h1` = the **sidebar/tab label exactly** (bare noun). A page never prints an `h1`. | **Delta.** Today the navbar shows three forms ("Dashboard", "SPM / Mod SPM", "Pembelajaran / Topik Pembelajaran") and about 20 pages add a second title. The navbar becomes the bare menu label ("SPM", "Topik", "Permainan", "Kedai Hadiah"); the page title is dropped when it repeats the label. When a page's own title differs from the label ("Persediaan SPM", "Zona Permainan", "Persediaan Kemasukan"), the text is kept as the page **headline**: `DsPage headline` (non-h1, `text-heading`, above the intro sentence). Q1. |
| 1.2 | Header and greeting | Intro sentence (max 1) left; optional actions right: at most two tonal, then exactly one primary last. | **Delta.** Murid pages use a *hero/intro* instead of a header row when they have one today (Hub 2.2, Home 2.1). The single primary is the gradient CTA; repeated card actions are tonal (1.7). Guru = admin 1.2 unchanged. |
| 1.3 | Count display | No "Jumlah: N" line. | Same. "31 subjek" on Home stays as the section's trailing meta (existing copy), not a header line. |
| 1.4 | Width and gutter | Fill the shell content area; pages never set width, centre or pad. | Cap 1152 (shell). Long reading text (Artikel, Panduan, Topik detail body) uses `DsProse` (65ch measure) inside the full-width page, never a narrower page. Today's 896 (Tiket), 768 (Profil), standalone 976 (Panduan) are removed. |
| 1.5 | Vertical rhythm | `DsPage` gap only. | 24 from `md`, 16 below. Inside a card: 16 (12 on compact tiles). No other spacing. |
| 1.6 | Back link | `DsPage backTo`, label "Kembali". | Same. "Kembali ke Senarai Subjek" and "Kembali ke senarai kelas" become "Kembali". |
| 1.7 | In-page navigation | `DsPillNav` in `#tabs`, at most one. | **Delta.** Murid adds `DsChipFilter` (gap L4) for filter chips (Topik: Tingkatan + Subjek, Artikel pills, Marketplace categories, history period). Active = filled gradient pill (same as the tab bar). One chip filter surface per page; two rows allowed inside it when the page has two filters today (Topik). Below `md` each row scrolls inside itself. |
| 1.8 | Naming | BM, bare noun. | Menu labels stay exactly as today (including the two "Kedai Hadiah" items, see section 7 notes). |
| 1.9 | Filter and search | One `DsFilterBar`, search + Cari, max 3 selects, drawer below `md`. | Murid pages with a search (Artikel, Marketplace, Video) use it. Chip-only filters use `DsChipFilter`, not a second bar. Never both on one page. |
| 1.10 | List vs card grid | Table for data lists. | **Delta.** Murid default is the **card grid** (catalogue) or **row list** (`DsListRow`); `DsDataTable` only on guru/analytics pages that are tables today (admin 1.10 spec, cards below `md` is mandatory: fixes Analisis Item and Headcount at 375). |
| 1.11 | KPI strip | 2-5 tiles, no orphan, formatted numbers. | Same layout rules (admin 1.7.1). Learner tile = 36-44px icon chip, number `text-kpi`, label <= 24 chars. Home's two strips (3 tiles, then 5 tiles) are separated by other sections, so they are allowed; they are not "stacked". |
| 1.12 | States | Skeleton, `DsEmptyState`, `DsLoadError`. | **Delta.** A murid empty state carries the friend: `DsEmptyState` with the `friend` option (LD2) shows the 56px friend avatar above the **existing** empty text. No new sentence is added. Error stays `DsLoadError`. Raw "Tiada data." strings (7 files) go through `DsEmptyState`. |
| 1.13 | Add wording | One verb per object type. | Same glossary. Learner-specific verbs already live (Mula, Main, Sambung); not renamed. |

### 1.1 Page frame wireframes (the model for every template)

```
1280 murid (sidebar 256 + main 1024)
+--------+-------------------------------------------------------------+
| brand  | navbar 64: [menu] TITLE(h1 = menu label)  [Cari menu] (2 hari)(372 Koin) [mode] (PD) |
| nav    +-------------------------------------------------------------+
| groups | gutter 24 -> content (fills, cap 1152)                      |
| active | [back link "Kembali"]            (only deeper than a menu)  |
| = grad | headline (only if differs) + intro sentence   [primary CTA] |
| pill   | [DsPillNav | DsChipFilter | DsFilterBar]   (at most one)    |
| user   | [DsStatRow]                                                 |
| card   | sections: DsSection (icon chip + h2 + "Lihat Semua") -> cards|
+--------+-------------------------------------------------------------+
375 murid
+-----------------------------------+
| [P+] TITLE            (2)(372)[m][PD] |  navbar 64, h1 = menu label
| gutter 16                         |
| intro / hero                      |
| [chips scroll inside itself ->]   |
| cards: 1 column (2 columns for small tiles) |
| ...                               |
| [Home][SPM][Game][Topik][Lagi]    |  bottom bar 76 (gradient pill = active)
+-----------------------------------+
```

Order is fixed: back link, headline/intro (+ primary), tabs or chips or filter bar, KPI strip, sections. A template omits a slot; it never reorders.

### 1.2 Title source (1.1) - details

- `DsPage` stays `layout="..."` with no `title`. The shell navbar already provides the `h1` from route meta; the fix is to feed it the **menu label** (`menu.ts` / `navFor` label), not the page's own title. For deeper pages (detail, quiz setup) the navbar keeps the parent label and the page headline carries the entity ("Fungsi dan Persamaan Kuadratik").
- Pages with two `h1` today (28 screens) lose the page one. The 54 files that print their own raw `h1` migrate to `DsPage headline` or nothing.
- Quiz and win screens own their own `h1` (route `meta.ownsH1`): the question text is the `h1`, the win title ("Sempurna, Aina!") is the `h1`.
- Navbar size: `text-heading` 20 from `lg`, `text-subheading` 18 below `lg` (the demo uses 18/20; Q-free technical default).

### 1.3 Header, intro, greeting (1.2) - details

| Element | Spec |
|---|---|
| Intro sentence | `DsPage subtitle`, one sentence or two short ones, `max-w-prose`. Existing copy kept ("Latihan lengkap untuk pelajar Tingkatan 4 & 5. ..."). |
| Headline | `DsPage headline`, only when 1.1 says so; no emoji (the emoji becomes a `DsIconChip` leading glyph). |
| Primary | One `UButton` (gradient, solid) last; label verbatim ("Mula", "Buka", "Mula Latihan"). A repeated card action is `UButton variant="soft"` ("Lihat Topik", "Mula Latihan" on subject cards, "Main!"). |
| Greeting (Home only) | `DsHeroCard` variant `greeting`: "Selamat Petang, Pelajar Demo" (`text-title`, display font) + "Jom teruskan latihan hari ini!" + `DsFriendAvatar` button with `DsSpeechBubble`. 24px radius, surface step, no gradient. |
| Mode chip | "MOD SPM" style chips stay (they are content), rendered with `DsBadge accent`. |
| Forbidden | Tinted per-page header cards (reward pages), emoji in `h1`/buttons/card headings (23 on Home), local `h1`, two primaries, white buttons on dark except the hero CTA (white on gradient is the DS hero button). |

### 1.4 Width, gutter, rhythm (1.4, 1.5)

| Property | Value | Owner |
|---|---|---|
| Content | shell main, cap 1152, left edge identical on every page (x=272 at 1280 with the 256 sidebar and 16 gutter today; becomes x=280 with 24) | `DsPage`, never the page |
| Gutter | 16 below `md`, 24 from `md` | shell |
| Section gap | 24 / 16 | `DsPage gap` |
| Card padding | 16 (tiles 12-16), hero 20-28 | `DsPanel` / `DsHeroCard` |
| Grid gaps | `DsGrid gap="md"` 16 desktop, 12 phone | primitives |
| Radii | tile 16, hero/greeting/sheet 24, button 12, chip 22 (pill), icon chip 8-12 | tokens `--ds-r-*` |
| Bottom space | below `lg` main reserves 96px for the tab bar | shell |
| Nesting | page -> section -> card. Never card in card, never a tile row in a card (a mission row inside the Misi Harian card is a list row on `bg-elevated`, which is allowed: it is a row, not a card) | R12 |

### 1.5 Cards and character cards (new)

| Card kind | Component | Anatomy |
|---|---|---|
| Plain card | `DsPanel` | `bg-default` (charcoal step 1), radius 16, no border, padding 16; optional header = `DsIconChip` 32 + `h2` 20/700 + trailing `moreTo` |
| Stat tile | `DsStatTile` | icon chip, number display font, label caption |
| Character card (meaning-coloured, D37a) | `DsCharacterCard` | a surface step + a 44-48px tinted icon chip in **one** meaning colour (Percubaan Percuma = amber, warning = orange, pengumuman = violet, pencapaian = lime). It is the only place a card carries colour, and the colour sits on the chip and a 12% tint, never as a border or a full fill |
| Catalogue card | `DsMediaCard` / `DsShopCard` / `DsGameTile` / topic card (`DsPanel` + chip) | thumbnail or 3D art, title 17/700, caption overline, meta chips, one soft action at the bottom, equal heights in a row |
| Hero | `DsHeroCard` | gradient (the one allowed), 24 radius, overline + title + sub + white CTA + ring or 3D art |
| Reward tile | `DsRewardChip` / `DsBadgeTile` | Fluent 3D `DsArt3D` + display number |

Rules: one surface level per card (page `bg-muted`, card `bg-default`, row-in-card `bg-elevated`); no card variant outside this table (the audit found 27 radius/shadow/padding combos); subject identity colours come from `--ds-cat-1..8` on the icon chip only.

### 1.6 Colour, type, icons, motion

| Item | Rule |
|---|---|
| Focus-point colour | Colour marks the thing to act on: the primary CTA, the active nav pill, progress fills, the one hero. Everything else is neutral charcoal/white. Max 4 accents per screen: action blue, reward orange/amber, win lime (win moments only), violet (info). Semantic success/error only for meaning (Betul/Salah, Mudah/Sederhana/Sukar). Subject chips use `--ds-cat-*` and are not counted. |
| Gradient | Only `gradient-primary` (#2F5BFF -> #6A4DFF): primary CTA, active nav/tab/chip pill, progress fill, hero. Never on a card background, never two primary CTAs in one viewport. |
| Text | Dark: highlighted #FFFFFF, text #E6E8EE, muted #A3A9B7 (7:1 on the card step), dimmed #7E8594 only for non-essential meta on `bg-default`. Light: #0B0D12 / #1E222B / #565C6B. |
| Type scale (murid) | display 28-56 (greeting, win), title 24-40 (page headline), heading 20 (section), subheading 17-18 (card title), body 14-16, label 14/600, caption 12-13, overline 11-12/700 +0.08em. Display face Bricolage Grotesque for greeting, numbers and question; UI face Plus Jakarta Sans. Guru uses the staff scale (admin 1.x: one face, 14 body, 24 title). |
| Icons | Phosphor Duotone through `DsIcon`/`DsIconChip` base names (R9). No emoji as UI glyph. 3D art only through `DsArt3D`/`DsFriendAvatar` (Fluent 3D for rewards). |
| Motion | Durations from tokens (fast 100, base 200, slow 400). Entrances `ds-rise`; win moments `ds-stamp`, `ds-floatup`, `ds-party`; quiz `ds-nudge`, `ds-flicker`, `ds-sheet`. `prefers-reduced-motion`: animations collapse to 1ms (tokens already do this); information is never motion-only (correct/wrong also by glyph and text). |
| Mode | Murid dark default, user can switch (mode button in the navbar, `aria-label` "Tukar ke mod cerah"/"Tukar ke mod gelap"). Guru follows the system, audited in light. The white boot splash in dark is a shell fix (8). |

### 1.7 Lists, filters, pills

| Kind | Component | Spec |
|---|---|---|
| Pill nav | `DsPillNav` | sibling views sharing a page frame (guru report tabs, Bijak SPM hub tabs); below `md` scrolls inside itself, active scrolled into view, counts via `count` (admin D5) |
| Chip filter | `DsChipFilter` (L4) | single or multi, count badge optional, 44px chips, wraps at >= `md`, scrolls inside itself below `md` |
| Filter bar | `DsFilterBar` | admin 1.9 |
| Row list | `DsListRow` | feed rows, ranked rows, settings rows, history lists, redemptions; 56-64px, leading chip/rank, trailing meta |
| Card grid | `DsGrid` | catalogue: 1 column at 375 (small tiles 2), 2 at 768, 3 at 1280 (4 for small tiles); equal heights, action pinned to the bottom |
| Table | `DsDataTable` | guru/analytics only |

### 1.8 States and copy

Reuse the admin table (1.8) with these learner rows.

| State | Component | Copy (exact BM) |
|---|---|---|
| Loading first | `DsStateView status="loading" skeleton="cards"` (never `USkeleton`, never a spinner, never `SkeletonCards`/`LoadSkeleton`) | sr-only "Memuatkan..." |
| Empty, never created | `DsEmptyState friend item="{benda}"` | the page's existing text, e.g. "Belum Ada Lencana Lagi!" + "Jom kumpul lencana pertama dengan menjawab soalan!" |
| Empty, no match | `DsEmptyState filtered friend` | "Tiada {benda} dijumpai." + "Cuba ubah atau set semula penapis." + "Set Semula" |
| Empty, arcade rooms | `DsEmptyState size="sm"` | "Tiada bilik terbuka buat masa ini." + "Cipta bilik permainan dan jemput rakan-rakan!" (existing) |
| Error | `DsLoadError` | "Tidak dapat memuatkan {benda}. Sila cuba semula." + "Cuba Semula" |
| Locked/PRO | `DsBadge` on the menu item and `DsCallout` on the page | existing copy |
| Success | toast 4s | "{Entiti} berjaya {disimpan}." ; friend toast "Rakan belajar: {nama}" |
| Forbidden | `DsErrorPage` | existing "Akses Ditolak" |

## 2. Templates

All templates are `DsPage layout="..."` roots unless stated. Slots and props are real `src/ds` names; **[gap]** marks a component or option that does not exist yet (section 3). `UButton`, `UInput`, `UTextarea`, `USwitch`, `UCheckbox`, `URadioGroup`, `USelectMenu`, `UTooltip`, `UDropdownMenu`, `UPopover` are the sanctioned Nuxt UI parts (R7) and carry props only. Breakpoints: 375 (base), 768 (`md`), 1280 (`xl`).

### Murid

### 2.1 M-Home (Home / Dashboard)

Screens: `/dashboard` (1 screen; 16 local `Home*` components, 316 violations).

```
1280                                                    375
[ greeting card: Selamat Petang, ...  (Aiman) bubble ]  [ greeting + (Aiman) bubble stacked ]
[stat][stat][stat]            3 across                  [stat][stat][stat]   3 across, 96px
[ HERO gradient: Sambung latihan ... ring 70% ]         [ HERO: text + ring, white CTA 52 full ]
[ Percubaan Percuma ][ info carousel (violet) ]         [ Percubaan Percuma ]
[stat x5 across]                                        [ carousel ]
[ Misi Harian (2 col rows) ........ ][ Lencana (lime) ] [stat tile 1 + 2x2 ... (5 tiles: 2 columns)]
[ Mula Latihan (gradient, full) ]                       [ Misi Harian: 10 rows ]
[Soalan Aku Salah 24][Kemajuan][Sejarah][Papan]         [ Lencana ]
Artikel Untuk Kamu            Lihat Semua               [ Mula Latihan ][2x2 tonal]
[a][a][a][a]                                            Artikel: strip scrolls inside itself
Subjek Tersedia   31 subjek                             Subjek: 2 columns
[s][s][s] x2   [Lihat semua]                            Statistik Platform: 2x2
Statistik Platform  [4]   Tahap Pendidikan              Tahap Pendidikan, Soalan Terkini,
Soalan Terkini | Tahap Kesukaran   Statistik Subjek     Tahap Kesukaran, Statistik Subjek
```

| Slot order (unchanged from today) | Component |
|---|---|
| 1 Greeting + friend | `DsHeroCard` greeting variant, `DsFriendAvatar`, `DsSpeechBubble` |
| 2 Three stats (Hari streak, Koin, Mata) | `DsStatRow` (3 tiles, `DsStatTile` accent: flame orange, coin amber, bolt blue) |
| 3 Hero "Sambung latihan / Teruskan Latih Tubi / 7 daripada 10 misi harian" + "Mula" | `DsHeroCard` + `DsScoreRing` |
| 4 Percubaan Percuma, info carousel ("Baca Selanjutnya", dots) | `DsCharacterCard` (amber), `DsCarousel` inside a violet `DsCharacterCard` |
| 5 Five stats (Syiling Kamu, Mata (Lvl 5), Hari Berturut, Sesi Minggu Ini, Ketepatan) | `DsStatRow` 5 tiles (1 + 2x2 at 375, 3 + 2 at 768, 5 across at 1280) |
| 6 Misi Harian 7 / 10 + "Belum Ada Lencana Lagi!" | `DsPanel` (+ `DsProgress`, `DsListRow` rows with `DsBadge` level and reward chip `DsRewardChip`), `DsCharacterCard` lime with `DsArt3D` |
| 7 Quick actions | `UButton` gradient "Mula Latihan" (the one primary), four `UButton soft` |
| 8 Artikel Untuk Kamu / Lihat Semua | `DsSection` + `DsMediaCard` strip (`DsCarousel` below `md`) |
| 9 Subjek Tersedia (31 subjek) + "Lihat semua" | `DsSection` + `DsSubjectStrip`/`DsGrid` of `DsCharacterCard` (cat chip, count, "Subjek Teras" `DsBadge`, soft "Mula Latihan") |
| 10 Statistik Platform | `DsSection` + `DsStatRow` 4 |
| 11 Tahap Pendidikan | `DsSection` + `DsPanel` + `DsChipFilter` (read-only chips, `Tingkatan 4 (575)`) |
| 12 Soalan Terkini, Tahap Kesukaran | `DsSplit 3-2`: `DsListRow` list; `DsProgress` rows + total |
| 13 Statistik Subjek | `DsSection` + `DsGrid` 3 columns of `DsPanel` |

States: skeleton per section (`cards`/`stats`); a failed section shows one `DsLoadError inline` in that section, the rest renders. Friend greeting falls back to the plain greeting if no friend chosen (friend picker opens first run).
Responsive: demo `Main.dc.html` (1280) and `Home390.dc.html`. Emoji in the 23 headings/buttons become `DsIconChip`.

### 2.2 M-Hub (landing with cards)

Screens (6): `/spm` (SpmHubPage 57 viol), `/spm/bijak` (BijakHubPage, 75), `/pksk` (PkskHubPage, 49), `/practice` (PracticeListPage, 32), `/practice/chapter` (ChapterIndexPage), `/practice/chapter/:code` (ChapterSubjectPage); also `/spm/latih-tubi`, `/spm/tahun-lepas`, `/latihan-berstruktur`, `/practice/revision` list pages as the "subject list" variant.

```
1280                                                    375
headline "Persediaan SPM" (non-h1) + intro              headline + intro (2 lines)
[MOD SPM] chip                                          [MOD SPM]
[ HERO gradient: Baharu / Bijak SPM / sub   (Buka) ]    [ HERO: text, white CTA 52 ]
[stat][stat][stat][stat]  (4 across)                    [stat][stat] / [stat][stat]
[card][card][card][card]  title+desc+meta chip+"Mula"   cards 1 column (equal)
[ Prestasi SPM Anda: 4 tiles ]  [ Sejarah Kuiz SPM ]    panel then tonal button
```

| Slot | Component |
|---|---|
| Headline + intro | `DsPage headline subtitle` (headline only when it differs from the menu label; `/spm` navbar = "SPM") |
| Badge | `DsBadge accent` ("Mod SPM") |
| Hero (one at most) | `DsHeroCard` + `DsArt3D` |
| KPI | `DsStatRow` 2-4 tiles |
| Cards | `DsGrid` of `DsCharacterCard`/`DsMediaCard`, identical anatomy; "Mula" = `UButton variant="link"`-style tonal text action, same on every card |
| Own results | `DsPanel` + `DsStatRow` is not nested: the 4 tiles are a `DsStatRow` placed under a `DsSection` (no panel wrapping tiles, rule 1.4) |
| Footer action | `UButton soft` ("Sejarah Kuiz SPM") centred |

States: skeleton cards; empty hub cards never occur. The "Tahun Tersedia 0" tile keeps its value (live data).
Responsive: 375 cards 1 column, KPI 2x2; 768 cards 2 columns; 1280 cards 4 (or 3 when 6 cards).

### 2.3 M-Catalogue (card list, incl. arcade)

Screens: Topik `/topics` (46), Artikel `/artikel`, Video `/video`, Permainan `/permainan` (18 `DsGameTile`), Tournament `/tournament`, Peta Belajar `/peta-belajar` (`DsLevelMap`), Set Soalan Guru `/set-soalan-saya`, Kelas Saya (murid) `/kelas-saya`, Audio KBAT `/audio-kbat`, Marketplace `/marketplace` (see M-Shop), Timeline `/timeline` (row list).

```
1280                                                    375
[ headline + intro (+ trophy 3D) ]   (Permainan only)   headline + intro
[ filter surface: chip row (Tingkatan) / chip row ]     [ chips scroll inside themselves ]
[card][card][card]   3 across, equal heights            [card]  1 column
[card][card][card]   icon chip | n Subtopik badge      [card]
                     title / caption / list / soft btn  ...
```

| Slot | Component |
|---|---|
| Headline/intro | as 1.1 (Permainan "Zona Permainan" + intro text, `DsArt3D` trophy at the right from `md`) |
| Filter | one `DsChipFilter` (Topik: Tingkatan row + Subjek row inside one surface) or one `DsFilterBar` (Artikel, Marketplace) |
| Cards | `DsGameTile` (Permainan: chip HOT/BARU/MULTIPLAYER/HARIAN as `DsBadge accent`, **max 3 accent families**: warning for HOT, primary for BARU, neutral for the rest), `DsMediaCard` (Artikel, Video, Audio), topic card (`DsPanel` + `DsIconChip cat` + `DsBadge` + `DsListRow` subtopics + soft button) |
| Pager | `DsPager` [gap] when the list is paged, else none (Topik shows all) |
| Empty | `DsEmptyState friend` |

Fixes: link rows 18px high become 44px rows; "Topik Pembelajaran" navbar = "Topik"; the 12-19 repeated gradient "Lihat Topik" buttons become soft. Demo: `Topik1280.dc.html`, `Topik390.dc.html`.

### 2.4 M-Reader / detail

Screens (3+): `/artikel/:slug` (96 viol), `/topics/:id`, `/panduan` and `/pusat-tuisyen/panduan`, `/video/:id`, `/audio-kbat/:id`, `/spm/bijak/kertas/:paperId`.

```
1280                                              375
[< Kembali]                                       [< Kembali]
headline (entity)   meta (DsBadge, date)          headline, meta wraps
[ DsSplit 8-4: DsProse article | aside card(s) ]  [ DsProse full ] then share card
[ share/aside: DsPanel (WhatsApp/Telegram via DsBrandIcon) ]
```

`DsPage layout="detail" backTo`; body `DsProse` (65ch, `DsRichText` [gap] for sanitised HTML); video = `DsMediaCard`-style player frame, audio = `DsAudioPlayer`. Panduan renders **inside the shell** (not standalone) as `DsSplit 8-4` with role panels. Back link always "Kembali". One `h1` (navbar).

### 2.5 M-Setup (quiz setup / config)

Screens: `/practice/:code` (PracticeConfigPage, 143 viol, the worst single page), `/spm/latih-tubi/:code`, `/practice/chapter/:code/...` config.

```
[< Kembali]  headline (subject)      
DsSplit 8-4:  DsFormSection "Tetapan": DsChipFilter (Darjah/Tingkatan) / difficulty DsChoiceCard[gap] / count chips
              aside DsPanel "Tips"
DsFormBar (sticky): [ Mula Kuiz ] (gradient)
```

Slots: `DsPage layout="form" backTo`, `DsFormSection` per group, choices as `DsChoiceCard` [gap] (single select, 44-60px), one primary "Mula Kuiz" in `DsFormBar` (sticky bottom <= `md`). "Darjah 1-4" chips follow the system decision (secondary only); see section 7 notes.

### 2.6 M-Quiz (full-screen question)

Screens: every `QuizRunner` route (`/practice/:code/quiz`, `/practice/revision/:code`, `/practice/chapter/.../quiz`, `/set-soalan-saya/:id/jawab`, `/spm/tahun-lepas/:code/quiz`, `/spm/latih-tubi/:code/quiz`, `/spm/ramalan/:code`, `/pksk/.../exam`, structured answer), Bijak SPM attempt `/spm/bijak/percubaan/:attemptId` (its own shell variant, `DsStepper` [gap]).

Root is **not** `DsPage`: it is the DS quiz frame (`layout="bare"` exempt in R12). Spec = `v2-shells.md` 5.2 with these visual details (demo `Quiz390.dc.html`, `Quiz1280.dc.html`).

```
390 (100dvh)                                  1280: column 640 centred on bg-muted
[X 44] [=== progress 10px ===]  [fire 3]      same column; sheet slides inside the column
[Sains] 4/10                    [0:42]
question (display 22/700, h1)  centred in the free space
[A] option 60px                (letter chip 40)
[B] option (selected: 20% blue tint + gradient chip + check)
[C] / [D]
[ Semak ] 52px, gradient, full width (enabled after a selection)
```

| Part | Component |
|---|---|
| Top | `DsQuizHeader` (close `aria-label="Keluar latihan"`, progress, combo chip) |
| Options | `DsQuizOption` x4 (60px, gap 10, letter chips; states default / selected / correct / wrong / dimmed) |
| Feedback | `DsFeedbackSheet` (title "Betul!"/"Hampir!", "Jawapan: B.", friend bubble, "Penjelasan" **without AI tag**, "Teruskan"), `DsFloatScore` "+10" lime |
| CTA | `UButton` gradient "Semak" -> "Teruskan" |

States: loading = skeleton (`QuizLoading` becomes `DsStateView`), error = `DsLoadError` with "Cuba Semula", wrong shows glyph + text + `nudge` (reduced motion: no nudge). Timer neutral, `text-error` + icon only in the last 10s. Keyboard 1-4/A-D, Enter, Esc (confirm). The hard-coded `#3B82F6` in `QuizRunner` becomes a token.

### 2.7 M-Result (win / result)

Screens: win screen after any quiz (`DsWinScreen`), `QuizResults`, solo game `ResultCard`s (m16), Bijak SPM `/spm/bijak/percubaan/:id/keputusan` (`PartResultCard`), prize/mystery modals.

Spec = `v2-shells.md` 5.3 (hero 3D, title "Sempurna, Aina!", `DsScoreRing`, friend dialog, "+Mata"/"+Koin" `DsRewardChip`, `DsSticker`, "Kongsi" tonal, "Kembali ke Home" gradient). Generalised for games and Bijak SPM through `DsResultCard` [gap]: same order (hero, title, ring/score, reward tiles, buttons), lime only at >= 3/5.

### 2.8 M-Reward (wallet, shop, rewards)

Screens (9): Syiling & Token `/gamification` (354 viol), Tukar Token `/gamification/convert`, Cabaran Harian `/gamification/challenges`, Kedai Hadiah `/gamification/rewards`, Kedai Hadiah DIGITAL `/cikgu/hadiah` (+ `/saya`), Kotak Misteri `/gamification/mystery-box`, Cabutan Bertuah `/cabutan`, Pencapaian `/gamification/achievements`, Rujuk Kawan `/gamification/referral`, Marketplace `/marketplace`.

```
1280                                              375
headline (when differs) + intro   [wallet chips]  headline + intro
[stat][stat][stat]  (Koin, Mata, Tahap)           [stat][stat][stat]
DsSection "..."                                   DsSection
[reward card][card][card][card]  3D art + price   [card] 1 col (2 for small badge tiles)
DsSplit 8-4: list (history) | tier / info panel   stacked
```

| Slot | Component |
|---|---|
| Wallet/tier | `DsStatRow`, `DsHeroCard` (S11Hero) at most one |
| Shop/rewards | `DsGrid` of `DsShopCard` (not yet adopted by any learner file), `DsBadgeTile` for achievements, `DsWheel` for Roda Nasib, `DsCharacterCard` for challenges with `DsProgress` |
| History/redemptions | `DsListRow` |
| Referral | `DsPanel` + `UInput` readonly + `UButton` + `DsBrandIcon` (WhatsApp/Telegram) [gap] |
| Share cards (Kad Kongsi) | `DsShareCard` [gap]: fixed light branded card on any mode |

The tinted per-page header card is removed (rule 1.3); the emoji `h1` is dropped (it duplicates the navbar title). Empty states carry the friend.

### 2.9 M-Leaderboard

Screens (3): Kedudukan `/ranking`, Papan Pendahulu `/gamification/leaderboard`, Battle `/battle/leaderboard`, `/battle/ranking-sekolah`, Papan Bijak top ten; also `/leaderboard` from Home.

```
1280                                              375
[ DsPillNav: tempoh (if present today) ]          [ pill nav scrolls ]
DsSplit 8-4                                       podium (top 3, 2-1-3)
  podium (top 3) / rank rows 4..N (DsLeaderRow)   rows 4..N
  aside: "Kedudukan Anda" tile                    "Kedudukan Anda" sticky above the tab bar
```

One header style for all three: navbar label + `DsPodium` [gap] + `DsLeaderRow` list. "You" row highlighted with `bg-primary-soft`, never a coloured border.

### 2.10 M-Report (charts, progress, history)

Screens (6): Prestasi `/prestasi/:userId`, Analitik Adaptif `/analitik/pelajar`, Heatmap Topik Lemah `/buku-nota/heatmap`, `/practice/progress`, `/practice/history`, `/practice/revision`, `/spm/history`, `/spm/bijak/sejarah`, Remedial `/remedial/saya`.

Skeleton = admin 2.E/2.F: optional `DsPillNav`/`DsChipFilter` (period), `DsStatRow`, then `DsGrid`/`DsSplit` of `DsPanel` holding `DsChart`, `DsHeatGrid`, `DsProgress`, `DsListRow`. Empty = one page-level `DsEmptyState friend` when every region is empty. Emoji panel headings become `DsIconChip`. Charts 220px high at 375.

### 2.11 M-Form (profile, settings, invite, ticket)

Screens (4): Profil `/profile`, `/profile/edit`, Tetapan `/tetapan`, Jemput Ibu Bapa `/jemput-ibu-bapa`, Tiket `/pusat-tuisyen/tiket`, Timeline create, Kelas Saya join form.

```
DsPage layout="form" [backTo on edit]
DsSplit 8-4 (aside optional)
  DsFormSection title icon : DsFormField label -> UInput | UTextarea | DsNativeSelect | DsSwitchField | DsFileField
DsFormBar "Simpan" (sticky)   -- the "Simpan Tetapan" ghost button becomes the primary
```

Settings rows = `DsSwitchField` (44px, switch 44x24; fixes 40x22). Profile header = `DsIdentity` (avatar [gap DsAvatar], name, crown badge as `DsBadge` beside the avatar, never over it). Both cards on Tetapan share one width (they sit in the same `DsSplit`). Tiket: `DsFormSection` + `DsDataTable`/`DsListRow` + one primary.

### 2.12 M-Empty (empty-only list)

Screens (8): Remedial, Kelas Saya, Set Soalan Guru, Audio KBAT, Timeline, Tournament, Cabutan, Bijak sejarah (list pages whose mock data is empty). Template = M-Catalogue or M-Report with the body replaced by `DsEmptyState friend`. Nothing new is invented; the bare centred text becomes the standard empty state (friend avatar, existing title and text, primary action only if the page has one today).

### Guru

The guru pages are staff-personality pages in the learning shell. They reuse the admin templates **as is** (A list, B form, D live board where applicable, E/F tabbed report, H detail) with the learner-shell frame (1.1) and the deltas below. Only the families the admin doc does not cover are specified here.

### 2.13 G-Dashboard

Screens: Dashboard Guru `/guru` (GuruDashboardPage 34 + TodayPanel 56 + ChecklistCard 29 + GuideCard 32), Dashboard Sekolah `/prestasi/sekolah`, Command Center `/guru/command-center` (m10, not owned: DsPage `dashboard` as admin 2.D).

```
DsPage layout="dashboard" subtitle
  DsStatRow density="roomy" (2-5, on the page, not inside a panel; fixes the nested tile row)
  DsSplit 8-4
    DsPanel "Hari Ini" -> DsListRow x N | DsEmptyState size="sm"
    #aside DsPanel "Senarai Semak" (checklist: DsListRow + DsProgress), DsCallout collapsible "Panduan" (GuideCard)
```

375: KPI 2 columns, panels stack, checklist after the main panel. Glyph chips = one kobalt `DsIconChip` colour (7+ colours today).

### 2.14 G-List / table

Screens: Headcount `/headcount`, Pelajar Saya `/guru/pelajar`, Analisis Item `/guru/analisis-item` (owned: spec only), Tiket Bantuan, Headcount table/summary. = admin **2.A** unchanged. Learner-shell fixes: primary always last (Headcount has primary in the middle; Tiket has two primaries), `cardTitle`/`cardFields` mandatory (Analisis Item 130 clipped elements and Headcount squeeze at 375), "Jumlah tiket:" line removed (count = first tile or pager summary), Pelajar "X" glyph buttons become `DsRowActions`, count-1 KPI strip removed.

### 2.15 G-Selector (class/subject picker tiles)

Screens: Prestasi `/prestasi/...`, Analisa Item `/analisa-item/kelas`, Soalan by Chapter `/practice/chapter` (teacher view), Kelas Saya `/guru/kelas`.

```
1280                                         375
DsPage layout="list" subtitle                [ subtitle ]
 [primary "Cipta Kelas"? only if today]      
 DsFilterBar (select Tingkatan/Subjek)       [Penapis] drawer
 DsGrid 3 cols of selector tiles             1 column (2 for small tiles)
   tile = DsCharacterCard: DsIconChip (kobalt, one colour) + title + 2 meta + chevron; whole tile is the link
```

All tiles are links (Kelas Saya cards are not links today). One glyph colour (kobalt); count chips `DsBadge`. Empty: `DsEmptyState icon="funnel"` "Sila pilih {penapis} untuk melihat {benda}."

### 2.16 G-Report / detail

Screens: Laporan `/guru/laporan` (owned, spec only), class detail `/prestasi/kelas/:id`, Remedial Progress `/guru/remedial-progress`, Analitik Adaptif `/analitik/pelajar` (renders 77px today), Prestasi 360 `/prestasi/:userId`, Analisa Item class/school, Headcount dashboard/summary. = admin **2.E/2.F/2.H**: `DsPillNav` for the section views, `DsStatRow` (<= 5 tiles: class detail has 6 with an orphan, reduce to the top five), `DsPanel` + `DsDataTable bare`/`DsChart`/`DsProgress`/`DsListRow`. "Remedial Progress Dashboard", "On Track", "Below Target" are copy issues (mixed BM/EN) listed in section 7 notes; unboxed tiles on Laporan become `DsStatRow`.

### 2.17 G-Form

Screens: Kelas cipta `/guru/kelas/cipta`, Sumbang Soalan cipta/edit `/guru/soalan/cipta` (QuestionForm 119 viol), Headcount create, Tetapan (shared with murid). = admin **2.B/2.C**: `DsFormSection` steps, `DsFormBar`; "Cipta" gradient CTA becomes the standard primary in the form bar; `SchoolPicker` = `DsEntityPicker`/`DsPicker` [gap].

### 2.18 G-Library (content / library)

Screens: Video `/video` (+ create), Panduan, Sumbang Soalan `/guru/soalan` (5 local cards: AudioKbatCard, ContributionSummary, HantarKertasCard, ImportCard, QuestionCard).

`DsPage layout="list"`: `DsStatRow` (ContributionSummary), then `DsSection` per card type with `DsMediaCard`/`DsPanel`; import card = admin 2.C (`DsFileField`, `DsFormBar`); video cards 44px links (18 links under 40px today); Panduan inside the shell (see 2.4). The flat text action on Soalan by Chapter becomes `UButton soft`.

### 2.19 G-Profile

Same as M-Form profile (shared `/profile`, `/tetapan`). Guru light mode.

## 3. DS gaps

Deduplicated against the admin doc section 3 (G1-G15, D1-D11). Admin gaps that the learner portal needs **as is** (build once): `DsBadge` (G1), `DsProgress` (G2), `DsDefinitionList` (G3), `DsCallout` (G4), `DsAccordion` (G5), `DsEntityPicker` (G6), `DsStatTile` upgrades (G7), `DsSwatch` (G8), `DsPager` (G9), `DsDrawer` (G10), `DsListRow` (G11), `DsAppShell` (G12 -> extended by LG1), `DsSwitchField` (G14); changes D1-D6, D9, D10 (`DsPillNav` scroll-into-view and `count`: D5). Audit items L12 (`UInput`/`UTextarea`) and L14 (feed rows) and L17 (adopt `DsLevelMap`) are **not** new gaps: `UInput`/`UTextarea` are already allowlisted (R7), feed rows are `DsListRow`, `DsLevelMap` exists.

**New learner gaps (15)**

| # | Name | Purpose | Props / slots sketch | Screens | Source |
|---|---|---|---|---|---|
| LG1 | `DsLearnerShell` + `DsBottomNav` | frame so `PembelajaranLayout.vue` (138 violations, 283 tokens) holds no classes: sidebar, drawer ("Lagi"), top bar, 5-tab bar, mode button, safe-area | slots `#brand #identity #nav #navbar-end #bottom`; props `title` (menu label), `variant: 'murid' \| 'guru' \| 'simple'`, `tabs[]`; active = gradient pill (murid) / tonal pill (guru) | every screen | L1, L2 (extends admin G12) |
| LG2 | `DsChipFilter` | single/multi chip row with counts, scrolls inside itself below `md`; also read-only chips | `items {id,label,count?}[]`, `v-model`, `multiple`, `label` (aria), `wrap: 'scroll' \| 'wrap'`, `readonly` | Topik, Artikel, Marketplace, history period, 26 UButton ternary toggles | L4 |
| LG3 | `DsPicker` | grade/darjah, school and subject-grid pickers with search | `kind`, `v-model`, `options`, `searchable`; shares logic with admin `DsEntityPicker` | ProfileSchoolPicker, SchoolPicker, GradeField, DarjahPicker, PracticeConfig | L5 |
| LG4 | `DsPodium` | top-3 podium + rows | `items`, `me?`, `metric`, slots `#row` | Kedudukan, Papan Pendahulu, Battle, Papan Bijak | L6 |
| LG5 | `DsChoiceCard` | selectable card/button for choices (difficulty, game answers, Betul/Salah) | `v-model`, `options {value,label,icon?,hint?}[]`, `columns`, `size` | Config pages, m16 Solo*, settings choices | L7 |
| LG6 | `DsGameHud` | timer, score, lives, combo, countdown for games | `timer`, `score`, `lives`, `combo`, `countdown` | m16 solo games | L8 |
| LG7 | `DsResultCard` (+ `DsRewardGrid`) | result layout for games, quiz, Bijak SPM parts, prize modals | `title`, `score`, `rewards[]`, slots `#actions` | m16, m05, m28, m15 | L9 |
| LG8 | `DsShareCard` | fixed light, branded, exportable card (any mode) | `variant`, slots; excluded from dark-mode rules by design | Kad Kongsi, AchievementShareModal | L10 |
| LG9 | `DsBrandIcon` | WhatsApp, Telegram marks | `brand` | Referral, Artikel share, Panduan, Marketplace | L11 |
| LG10 | `DsAvatar` | user avatar (replaces non-allowlisted `UAvatar`, 19 tags) | `src?`, `name`, `size`, `badge?` | Profil, Timeline, class lists | L13 |
| LG11 | `DsStepper` | multi-step flow indicator / navigator | `steps`, `current`, `v-model` | Bijak SPM navigator, PKSK domains, structured answers | L15 |
| LG12 | `DsMathInput` | open math answer + keyboard | `v-model`, `layout` | m28 PartInput/MathField | L16 |
| LG13 | `DsRichText` | sanitised HTML + math (R5 exception) | `html`, `math` | RichText (8 importers), ArtikelDetail, StimulusView | L19 |
| LG14 | `DsQrCode` | QR canvas with token colours | `value`, `size` | m10 QrModal | L20 |
| LG15 | `DsStreak` | daily-goal / streak dots | `days`, `goal`, `today` | HomeKombo, HomeQuests | L18 |

**Changes to existing components (6)**

| # | Component | Change | Why |
|---|---|---|---|
| LD1 | `DsPage` | learner mode set by the shell: `headline` prop (non-h1), gap 24/16, width cap 1152, `layout` values `hub`, `catalogue`, `reader`, `quiz` (bare) added to the admin set | title rule (L3), 4 widths |
| LD2 | `DsEmptyState` | `friend` option (shows `DsFriendAvatar` above the existing text) | murid empty states (8 empty-only screens plus all lists) |
| LD3 | `DsStatRow` / `DsStatTile` | learner density: icon chip left, 3 tiles stay 3 across at 375 | Home stats |
| LD4 | `DsHeroCard` | `variant: 'greeting' \| 'cta' \| 'wallet'`; ring slot | Home greeting, hubs, wallet |
| LD5 | `DsGameTile`, `DsShopCard`, `DsBadgeTile`, `DsLevelMap`, `DsWheel`, `DsSubjectStrip` | **adopt** (exist, 0 learner files use them): m16 `GameCard`, m20 `ProductCard`, m15 `MysteryBoxCard`/`DrawCard`, m03 `MapIsland`, m16 `WheelCanvas` | one-off card re-implementations |
| LD6 | `DsPillNav` / `DsFilterBar` / `DsDataTable` | as admin D3/D5 (mobile cards, pill scroll) | tables not becoming cards at 375 |

## 4. Lint

The learner portal **reuses R1-R14 as is** (same rule IDs, same ratchet and `enforce` mechanism, T1/T2 tests; scope globs extended to `src/modules/**/pages/**` of the learner modules, their `components/**`, and `src/shells/pembelajaran/**`; Auth pages stay out). Learner-specific allowances and additions:

| # | Item | Spec |
|---|---|---|
| A1 | R12 `ds-page-template` | learner layouts `hub`, `catalogue`, `reader`, `form`, `list`, `dashboard`, `detail`; `QuizRunner`/`AttemptShell` routes (`layout="bare"`/quiz frame) are exempt; **Home may hold two `DsStatRow`s** when another section sits between them; `DsChipFilter` counts as the one in-page nav (not combined with `DsPillNav` on the same page) |
| A2 | R5 raw HTML | `DsRichText` (sanitised HTML + math) and `DsShareCard` are the only raw-HTML hosts besides `DsProse`/`DsPrintSheet` |
| A3 | R2/R4 canvas | `WheelCanvas` and `QrCanvas` hex colours move into `DsWheel`/`DsQrCode`; no exemption in pages |
| A4 | 3D art | allowed **only** through `DsArt3D`, `DsFriendAvatar`, `DsRewardChip`, `DsBadgeTile`; a bare `<img>` remains forbidden (R5) |
| A5 | Motion | keyframes and durations only from tokens through DS components; pages cannot set `animate-*` (R1 already forbids `class`) |
| A6 | New R15 `pp/ds-no-emoji-glyph` | fails an emoji code point in a template or script string of a page/component (132 uses in 62 files today). Exceptions: menu labels in `menu.ts` ("Kedai Hadiah" emoji labels stay as copy per `v2-shells.md` 5.1), user content rendered from data |
| A7 | R11 copy | add "Kembali ke " (already), "Headcount"/"On Track"/"Below Target"/"Remedial Progress Dashboard" BM-vs-EN checks go in `copy-exceptions.json` with a reason until the owner confirms (Q-notes) |
| A8 | R7 allowlist | `UIcon`, `USkeleton`, `USelect`, `UAvatar`, `ULink`, `UProgress`, `UBadge` stay **off** the list (their Ds twins exist: `DsIcon`, `DsStateView`, `DsNativeSelect`, `DsAvatar`, `DsLink`, `DsProgress`, `DsBadge`) |

Baseline today (learner scope excluding owned m11/m12/m17): 362 files, 8,652 violations, 11,033 class tokens (R1 4,364, R5 3,413, R6 650, R9 562, R7 471, R2 239, R12 193, R14 117, R11 83).

## 5. Migration map

Order = value to the learner first: shell, Home, quiz. Each batch appends its glob to `enforce` and re-runs the 375/768/1280 screenshots (dark for murid, light for guru). Debt = violations (audit 2026-10-29).

| Batch | Scope | Debt | Needs |
|---|---|---|---|
| 0 | Prerequisites: admin MUST-1 set (G1, G2, G4, G7, G10, G11, G12, D1-D6, D9-D11) + LG1, LG2, LD1-LD4 and the lint infra (R15, A1) | - | - |
| 1 **Student core** | `src/shells/pembelajaran` (146; PembelajaranLayout 138), **Home** m05 `DashboardPage` + 16 `Home*` (316), **quiz**: `QuizRunner` 65, `QuizLoading` 10, `QuizResults` 100, win screen, `ChapterQuizPage`/`PracticeQuizPage`/`RevisionQuizPage` shells | ~640 | LG1, LG2, LD1-LD4 |
| 2 Hubs + setup | m06 SPM (491), m28 Bijak SPM (528), m07 PKSK (215), m05 practice list/config/chapter/structured (~520 excl. quiz), m25 Heatmap (75) | ~1,830 | LG3, LG5, LG11, LG12, LG13 |
| 3 Catalogue + content | m03 Topik/Peta Belajar (213), m09 Artikel/Video/Audio/Panduan (522), m20 Marketplace (219), m10 `SetSoalanSaya`/`KelasSayaPelajar` | ~1,000 | LG9, LG10, LD5 |
| 4 Rewards | m14 gamification (688), m15 shop (166), Cabutan/Kotak Misteri | ~860 | LG4, LG7, LG8, LG15, LD5 |
| 5 Forms + settings | m01 Profil/Tetapan (206), m02 Jemput Ibu Bapa (71), m22 Tiket (74) | ~350 | LG3, LG10 |
| 6 Reports + leaderboards | m08 student-performance (1,170, shared with guru), Kedudukan, Battle leaderboards | ~1,200 | LG4 |
| 7 Games | m16 battle-games (1,502) | 1,502 | LG5, LG6, LG7, LD5 |
| 8 Guru | m10 teacher-class (1,284: Sumbang Soalan 561, Kelas, Dashboard Guru 159, Command Center 309), m08 Headcount (343), Analisa Item (307), Prestasi (246), Profil | ~2,300 | admin G5, G6, D-list; LG14 |
| 9 Tidy-up | baseline removal, final audit, light/dark regression, owned pages (m11/m12/m17 = 1,513) handled by the Pentadbiran redesign | - | - |

The demo canvas (Home, quiz, Topik) is the visual target of batches 1 and 3.

## 6. Accessibility (WCAG 2.2 AA) and responsive

### 6.1 Checklist

| Item | Spec |
|---|---|
| Contrast | text >= 4.5:1, large/non-text >= 3:1 in dark and light; dark primary text is `#5B86FF` (5.8:1 on the page step), solid primary fills keep the `#2F5BFF` end with a white label (5.2:1); `text-dimmed` only on `bg-default` for non-essential meta |
| Landmarks | skip link "Langkau ke kandungan", `header`, `nav aria-label="Menu utama"`, `main#kandungan`, `nav aria-label="Navigasi bawah"`; one `h1` per page (navbar, or the quiz/win title); headline and section titles are `h2` |
| Focus | visible ring on every control (DS focus ring), logical DOM order = visual order, focus moves to the first heading after route change, sheet/drawer/dialog trap and return focus; the friend avatar button returns focus after the picker |
| Keyboard | everything reachable; quiz 1-4 / A-D, Enter, Esc; `DsChipFilter` arrow keys inside a `role="group"` with `aria-pressed`; podium and rows are links, not click-only divs |
| Touch targets | >= 44px: chips 44, tab-bar tabs 56, link rows 44 (fixes 18px rows on Topik, Artikel, Video: 11/9 targets under 40px), switches 44 x 24 hit area 44 (fixes 40x22), icon buttons 44 |
| Names | icon-only buttons have `aria-label` (close "Keluar latihan", prev/next "Sebelum"/"Seterusnya", mode "Tukar ke mod cerah", avatar "Tukar rakan belajar, sekarang Aiman"); chips with only numbers (streak, koin) have a label ("2 hari berturut-turut", "372 Koin") |
| Colour-only | correct/wrong = glyph + text + colour; level badges (Mudah/Sederhana/Sukar) = text; progress bars `role="progressbar"` with value; rings `aria-valuetext` "{n} daripada 5 betul" |
| Motion | reduced-motion collapses animations (token level); typing dots, confetti, float score skipped; no information is motion-only |
| Forms | visible `label` through `DsFormField`, errors linked (`aria-describedby`), summary callout takes focus |
| Live regions | quiz feedback sheet `role="status"`; toasts polite; no auto-moving carousel without a pause control (dots are buttons in the DS) |
| Images/art | decorative 3D `aria-hidden`; informative art has an `aria-label` ("Seni 3D piala" in the demo is a placeholder) |

### 6.2 Responsive matrix

| Width | Shell | Content |
|---|---|---|
| 375 (base) | top bar 64 (mark, h1 = menu label, streak/koin chips as numbers, mode, avatar), bottom tab bar (murid Home, SPM, Game, Topik, Lagi; guru Dashboard, Kelas, Command Center, Penilaian, Lagi), "Lagi" slide-over | gutter 16, gap 16, cards 1 column (small tiles 2), KPI 3 across for 3 tiles else 2 columns with the first full width for odd counts, chip rows scroll inside themselves, tables become card lists, hero CTA full width 52, sheets are bottom sheets, no horizontal page scroll down to 320 |
| 768 (`md`) | same chrome (tab bar until `lg`) | gutter 24, gap 24, cards 2 columns, KPI 3-5 across, `DsSplit` stacks |
| 1280 (`xl`) | sidebar 256 + top bar, no tab bar | content cap 1152, cards 3-4 columns, `DsSplit 8-4`, tables full columns, modals 480-560 centred |

## 7. Open questions for the owner

Plain BM; each has the default we will build unless told otherwise (technical defaults are listed as decisions in 7.2, not questions).

### 7.1 Questions

| # | Soalan | Contoh | Lalai |
|---|---|---|---|
| Q1 | Beberapa halaman ada tajuk sendiri yang lain daripada nama menu. Mahu tajuk itu dikekalkan atau dibuang? | Menu "SPM" tetapi halaman ada "Persediaan SPM"; menu "Permainan" tetapi halaman ada "Zona Permainan" | Kekalkan teks itu sebagai tajuk kecil di atas ayat pengenalan (bukan tajuk utama), dan bar atas hanya tunjuk nama menu ("SPM", "Permainan"). Jika sama dengan nama menu, dibuang. |
| Q2 | Emoji dalam tajuk dan butang (Home ada 23) diganti ikon duotone yang sama maksudnya? Emoji dalam label menu (cth. "Kedai Hadiah" dengan hadiah) dikekalkan sebagai teks. | "Misi Harian" dengan emoji petir menjadi ikon petir dalam kotak kecil | Ya, ganti dalam kandungan halaman; label menu tidak disentuh. |
| Q3 | Semua halaman guna satu lebar kandungan (penuh sehingga 1152px). Halaman yang sempit hari ini diluaskan. | Tiket (896px) dan Profil (768px) menjadi selebar halaman lain; teks bacaan panjang kekal 65 aksara | Ya, satu lebar untuk semua. |
| Q4 | Butang berulang dalam kad (Lihat Topik pada 19 kad, Mula Latihan pada setiap subjek) jadi butang lembut berwarna samar, dan hanya SATU butang biru gradien utama setiap skrin? | Home: hanya "Mula Latihan" yang gradien; "Mula Latihan" pada kad subjek jadi lembut | Ya. |
| Q5 | Penapis bentuk cip (Tingkatan, Subjek) guna cip aktif gradien biru, sama seperti tab bawah? | "Tingkatan 4" berwarna gradien apabila dipilih | Ya. |
| Q6 | Halaman kosong murid tunjuk avatar rakan (Aiman/Aisyah) di atas teks kosong yang sedia ada, tanpa ayat baharu? | "Belum Ada Lencana Lagi!" dengan Aiman di atasnya | Ya, avatar sahaja, teks tidak ditambah. |
| Q7 | Mod gelap lalai untuk murid, guru ikut sistem (cerah dalam audit). Betul? | Murid buka app terus gelap | Ya. |

### 7.2 Decisions made (not questions)

Gutter 24 from `md`; section gap 24/16; navbar title size 20/18; bottom bar 76px high with 56px tabs; chip height 44; tonal action on repeated card buttons; Aiman/Aisyah colours unchanged; demo uses CSS tokens' exact values (#2F5BFF, #6A4DFF, #C6F432, #FF7A1A, #9B6BFF, dark base #0B0D12 / #15181F / #1E222B); `DsEmptyState` friend option off in guru; `DsStatRow` learner density only for murid.

### 7.3 Notes for the owner (structural, not changed by this document)

- Two menu items are both called "Kedai Hadiah" (one with "DIGITAL"; truncated "Kedai Hadi..." in the sidebar).
- Three leaderboards exist (Kedudukan, Papan Pendahulu, `/leaderboard` from Home).
- `/prestasi` opens the school-level "Dashboard Sekolah" for a student.
- The PEMBELAJARAN group is a flat list of 27 items.
- Guru menu has "Laporan Mingguan" which returns "Akses Ditolak"; "Analitik Adaptif" renders an almost empty page.
- Quiz setup shows Darjah 1-4 although primary levels are hidden system-wide.
- Mixed BM/EN copy on guru pages ("Headcount", "On Track", "Below Target", "Remedial Progress Dashboard").

## 8. Visual fixes vs today (fidelity table)

| # | Today (evidence) | Fix (look only) | Screens |
|---|---|---|---|
| 1 | Duplicate titles: navbar `h1` plus page title on ~20 murid screens, 28 screens with two `h1` | One `h1` (navbar = menu label); page title dropped or demoted to headline (1.1) | permainan, gam-rewards, gam-referral, cikgu-hadiah, heatmap, tiket, artikel detail |
| 2 | Three navbar title forms ("Dashboard", "SPM / Mod SPM", "Pembelajaran / Kedai Hadiah"); guru "Kelas Saya" -> "Portal Guru", "Pelajar Saya" -> "Pelajar", "Analitik Adaptif" -> "Analitik Pembelajaran", "Topik" -> "Topik Pembelajaran" | Navbar = the menu label exactly | all |
| 3 | Mixed page frames: 1152 / unbounded (Home, Berstruktur, quiz setup) / 896 (Tiket) / 768 (Profil) / standalone 976 (Panduan); 4 widths on guru | One frame: shell content cap 1152, same left edge | tiket, profile, panduan, dashboard |
| 4 | Emoji-heavy headers/buttons (10 screens h1, Home 23) | `DsIconChip`/`DsIcon` glyphs | dashboard, rewards, jemput, tetapan |
| 5 | Ad-hoc headers (hero, tinted card, plain `h1`, intro only); guru: primary above subtitle, 3 actions with primary in the middle, two primaries, gradient CTA, flat text action | One header rule (1.2/1.3) | spm, tetapan, kelas, headcount, tiket, soalan by chapter |
| 6 | Tables do not become cards at 375 (Analisis Item 130 clipped elements, Headcount squeezed) | `cardTitle`/`cardFields` mandatory | guru-analisis-item, headcount |
| 7 | Tap targets < 40px at 375: Topik 11, Artikel 9 link rows 18px high, Video 18 links, Tetapan switch 22px high, Pelajar "X" glyph buttons | 44px rows/targets, `DsSwitchField`, `DsRowActions` | topics, artikel, video, tetapan, pelajar |
| 8 | Two primaries / gradient overload (19 gradient "Lihat Topik" buttons, gradient CTA on Kelas cipta, ghost "Simpan Tetapan") | One gradient primary per screen, soft for repeated actions, "Simpan" primary in `DsFormBar` | topics, tetapan, kelas cipta |
| 9 | 27 card variants, 32 button styles, 13 heading treatments, 61 button combos (guru), 18 heading treatments (guru) | Card table 1.5, button rules 1.3, type scale 1.6 | all |
| 10 | Rainbow glyph chips (7+ colours) on guru selector and KPI tiles; reward pages tinted header cards | One kobalt chip colour (guru), neutral surface + one meaning chip (murid) | guru, practice-chapter, rewards |
| 11 | Panduan renders standalone without the shell | Rendered inside the shell like every page | panduan |
| 12 | Bare centred empty states (8 murid screens), raw "Tiada data." (7 files) | `DsEmptyState friend` with existing text | remedial, kelas-saya, set-soalan-saya, audio-kbat, timeline, tournament, cabutan |
| 13 | Back link wording ("Kembali ke Senarai Subjek", "Kembali ke senarai kelas"); Kirkpatrick in-page crumb | "Kembali" via `backTo` | quiz setup, kelas |
| 14 | KPI strips: 1 tile (Pelajar), 6 tiles with an orphan (class detail), unboxed tiles (Laporan), tile row nested in a panel (dashboard) | 2-5 tiles on the page, no orphan | pelajar, class detail, laporan, guru |
| 15 | Light buttons in dark (Home, SPM) and a white boot splash in dark | DS buttons only (white allowed only as the hero CTA); splash uses the personality background | dashboard, spm, boot |
| 16 | Profil crown badge covers the avatar; "Cipta  Pelajar" spacing glitch | `DsIdentity` badge beside the avatar; DS button spacing | profile, pelajar |
| 17 | Home 4,700px tall stream with legacy blocks stacked | same sections and order, grouped into 2-column rows from `md` (Misi + Lencana, Terkini + Kesukaran) and 2-column tiles at 375; no section removed | dashboard |
| 18 | Dark-mode legacy palette on share cards (`bg-white`, `from-orange-500`) | `DsShareCard` fixed light card by design | kad kongsi |

Not changed (replicated): all menu items and labels, every page and tab, the order of Home sections, game list, copy.
