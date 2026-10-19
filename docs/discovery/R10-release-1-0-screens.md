# R10 — Release 1.0 screens not yet discovered: "Heatmap Topik Lemah" (student), "DSKP Heatmap" and "Laporan Bulanan" (school admin) (Discovery)

- **Source:** live read-only walk-through of https://prestasiplus.my on **2026-09-27**, 12:32–12:45 MYT (04:32–04:45Z), admin account (the only account available), browser lane 3 (`playwright3`). Asked for by user decision D15 (TRACKER): the three Release 1.0 screens of `roles-matrix/Matriks-Akses-Peranan .xlsx` that no module had discovered.
- **Screens:** S1 "Heatmap Topik Lemah" (student sidebar, "Pusat AI"), S2 "DSKP Heatmap" (school-admin sidebar, "Analitik"), S3 "Laporan Bulanan" (school-admin sidebar, "Penilaian"). Sidebar positions come from `roles-matrix/murid/*.jpeg` and `roles-matrix/admin sekolah/*.jpeg`.
- **Screenshots:** `docs/discovery/img/R10/` (6 files, §10), masked in the DOM before capture. The user shell (`SHU`), the global error pages and the design tokens are in [00-global-ui.md](00-global-ui.md) and are not repeated here.
- **Language:** UI copy is quoted in its exact Bahasa Melayu. S1 is all BM except the tournament-banner words "LIVE:", "MAIN" and "DAFTAR" (shell partial).
- **Personal data:** S1 shows one "Cikgu Pakar" card. It is an ambassador profile (M24 Duta) whose display name is a person's name, with 2-letter avatar initials. `tools/jobs/R10.js` → `R10MASK` tags the card's name and initials, plus any e-mail-, phone- or BIN/BINTI-shaped leaf (class `.r10n`, masked and scrubbed globally). `tools/sanitize.js` then runs with `{selectors:['.r10n'], titleName:false}`. The name is not written anywhere in the repo. Topic names, subjects and figures are the admin account's own practice aggregates and are not personal. S2 and S3 show only the global 500 page.
- **Seed snapshot:** `docs/discovery/inventory/R10/_snapshot-2026-09-27.json`, captured **2026-09-27 12:39 MYT (04:39Z)** by `tools/jobs/R10-snapshot.js` (GET only, through the guard cache, ≥ 450 ms apart). It holds the following, and is **the seed source**:
  - the S1 legend, cells and card (non-personal fields), plus the derived checks;
  - the `/buku-nota` sibling-tab figures;
  - the M05 chapter figures of the same account;
  - the layout measurements;
  - the side-effect ledger (§5.4).
- **Element inventory:** **38 content elements** over 3 screens and **9 captured UI states**, IDs `EL-R10-S#-nnn`, in `docs/discovery/inventory/R10/<S#-key>.json`. The shell file `SHU-user-shell.json` (372, chrome of S1) comes with them. Counts, the crawl and the limits are in `docs/discovery/inventory/R10/_summary.md`.
- **Safety:**
  - A context-level guard (`tools/jobs/R10-guard.js`, adapted from M21's) was installed **before the first navigation** and re-installed on the first site page for its probes. It aborts:
    - every request whose method is not GET / HEAD / OPTIONS, except `POST /login`;
    - every external host, except static script / style / font / image GETs from a CDN allow-list the pages need to render (every AI-provider host is always blocked);
    - every download / export / print navigation or fetch;
    - every write-shaped GET (toggle / delete / mark / send / generate / logout / approve …);
    - **every AI endpoint**: `/ai…`, `/api/ai…`, any fetch / xhr with an "ai" path segment, `chat`, `generate` / `jana`, `analyze`, `openai`, `gpt`, `gemini`, `claude`, `llm`, `prompt`, `completion`, `ask` / `tanya`.
  - Probes, all blocked:
    - `POST` and `DELETE /__r10_probe`;
    - `GET /__r10_probe/toggle`, `/notifications/__r10_probe/mark-read`, `/__r10_probe/export?format=csv` and `/logout`;
    - `GET /api/ai/__r10_probe`, `/pusat-ai/__r10_probe/generate` and `/cikgu-alesa/chat`;
    - `https://api.openai.com/v1/models` and `https://example.com/`.
  - During the run the guard also blocked 31 Cloudflare beacon scripts, 12 shell chatbot-history fetches (`/chatbot/history?session_id=…`, AI rule) and 12 Firebase SDK loads. The only non-GET that passed was the login `POST /login`.
  - **Load-once cache:** after the login, every same-origin document / fetch GET reached the server once and was then served from memory (20 URLs cached). **Exception:** a redirect follow-up is not routed by Playwright. So each load of the S2 / S3 routes reached `/admin-sekolah/pilih-sekolah` on the server (a read-only GET → 500). This happened 16 times before the cause was found; the screenshots then used one direct, cached navigation (§5.4). The lesson is recorded in the guard header.
  - Nothing was submitted, generated, exported or downloaded. No AI prompt was sent, and no practice or quiz session was started (the S1 cells link to `/practice/chapter` and were never followed). No validation probes were run.
  - One browser, one request at a time, ≥ 350 ms between navigations (450 ms in the crawl and the snapshot). The browser was closed at the end.

Cross-references (owned elsewhere, not re-inventoried):
- **M05** owns the answers behind every S1 figure (session and answer store). The same account's M05 chapter figures agree (§5.3 C1).
- **M03** owns the chapter names shown as S1 "topics".
- **M24** (Duta, not yet discovered) owns the "Cikgu Pakar" card and its target `/bilik-duta/cikgu-maestro-math`.
- **M08** S6 Prestasi 360 has its own "topik lemah" list, which disagrees for the same account (§5.3 C2).
- **M25** owns `/pusat-nota-ringkas`. Its "🌡️ Heatmap Topik" tile ("Visual diagnosis") is how S1's route was found.
- **Global error pages** (404 "Halaman Tidak Dijumpai", 500 "Ralat Pelayan") belong to 00-global-ui.

---

## 1. Overview and route finding

| # | Sidebar label (role, section) | Live route | Tab title · header / h1 | Owner module | Status on the admin account |
|---|---|---|---|---|---|
| S1 | "Heatmap Topik Lemah" (student, Pusat AI) | **`/buku-nota/heatmap`** (new route) | "Heatmap Topik Lemah" · SHU header "Dashboard" / "Selamat datang kembali" (D-R10-01); page h1 "Heatmap Topik Lemah" | **M25 AI Centre (Pusat AI)** | 200, admin's own data |
| S2 | "DSKP Heatmap" (school admin, Analitik) | **`/admin-sekolah/dskp-heatmap`** | admin sees "500 - Ralat Pelayan \| PRESTASIPLUS" | **No owner in TRACKER.** Recommended: M18 (Perlu pengesahan, §1.2) | **302 → `/admin-sekolah/pilih-sekolah` → 500**; content not reachable |
| S3 | "Laporan Bulanan" (school admin, Penilaian) | **`/admin-sekolah/laporan-bulanan`** | admin sees "500 - Ralat Pelayan \| PRESTASIPLUS" | **No owner in TRACKER.** Recommended: M18 (Perlu pengesahan, §1.2) | **302 → `/admin-sekolah/pilih-sekolah` → 500**; content not reachable |

### 1.1 How the routes were found (no brute force; GET only; at most 3 probes per screen)

**Owner search in the repo:**
- None of the three labels appears in `docs/discovery/*.md` or `docs/requirements/srs/*.md`, or in any earlier `_crawl.json`.
- TRACKER mentions them only in D15. `docs/requirements/role-access-matrix.md` rows 14, 47 and 50 list them without routes.
- `src/shells/nav/user-nav.ts` (the brief says `src/shells/user/`; the file is in `src/shells/nav/`) has these hrefs, all **INFERRED**:
  - `/heatmap-topik-lemah` (`fa-fire`, student);
  - `/admin-sekolah/dskp-heatmap` (`fa-table-cells`);
  - `/admin-sekolah/laporan-bulanan` (`fa-calendar-alt`).

**Admin menu crawl:**
- `/dashboard` (user shell, 278 links) has **no** item for any of the three. The student-only sub-block of Pusat AI (Buku Nota Saya … Heatmap Topik Lemah) and the school-admin menu are not rendered for the admin.
- The admin panel `/admin` (154 links) has none either; its only related link is "Nota" → `/admin/notes`.
- `/sitemap.xml` has none of them. `/robots.txt` lists `Disallow: /admin`, `/admin-sekolah`, `/guru/`, `/murid/`, `/ibu-bapa/`, `/sponsor/`, `/api/`, `/login`, `/daftar`, `/password/`, `/sanctum/`, `/storage/`.

**Link crawl (read-only fetches of pages already linked from the admin menu):**
- `/panduan` and `/pusat-tuisyen/panduan` only mention "Heatmap 90 hari" (M08 Peta Aktiviti).
- **`/pusat-nota-ringkas`** (M25) has a tile "🌡️ Heatmap Topik" / "Visual diagnosis" → **`/buku-nota/heatmap`**. It also has "📚 Buku Nota Saya" / "Senarai semua nota" → `/buku-nota`, "🔍 Review Queue" / "Semak nota flagged" → `/admin/master-notes` and "📋 Guru Dashboard" / "Command center" → `/guru`.
- `/buku-nota` has two tabs, "Senarai" → `/buku-nota` and **"Heatmap Topik Lemah" → `/buku-nota/heatmap`**.

**Probes (GET, through the guard):**

| Screen | Probe | Result |
|---|---|---|
| S1 (2 of 3) | `/heatmap-topik-lemah` (user-nav INFERRED href) | **404** "Halaman Tidak Dijumpai" |
| S1 | `/buku-nota/heatmap` (crawl link) | **200**, `<title>` "Heatmap Topik Lemah" |
| S2 (2 of 3) | `/admin-sekolah/dskp-heatmap` | **302 → `/admin-sekolah/pilih-sekolah` → 500** |
| S2 | control `/admin-sekolah/r10-control-nonexistent` | **404**. So the 302 is route-specific (Laravel matches the route before its middleware): **the S2 route exists** |
| S3 (1 of 3) | `/admin-sekolah/laporan-bulanan` | **302 → `/admin-sekolah/pilih-sekolah` → 500**. The route exists (same control) |

`/admin-sekolah` itself (the school-admin Dashboard seen in the admin-sekolah screenshot) also gives 302 → `/admin-sekolah/pilih-sekolah` → 500.

**S1 route, Perlu pengesahan:** the student sidebar item's own href was not observed (the item is not rendered for the admin). That it opens `/buku-nota/heatmap` is **INFERRED** from three points:
- the identical `<title>` and h1;
- the "Heatmap Topik Lemah" tab label on `/buku-nota`;
- the item's position right after "Buku Nota Saya" in the same Pusat AI sub-block (murid screenshot).

The rebuild's `user-nav.ts` href `/heatmap-topik-lemah` is 404 on live and should point to `/buku-nota/heatmap` (for F-19).

### 1.2 Owner modules

- **S1 → M25 AI Centre (Pusat AI).** Reasons:
  - the sidebar section is "Pusat AI";
  - the route lives under `/buku-nota` ("Buku Nota Saya": "Semua nota AI dari soalan yang anda jawab salah"), and that page is linked from the M25 page `/pusat-nota-ringkas`.

  M25 is not discovered yet, so R10 is its first capture. Suggested TRACKER additions for M25: `/buku-nota` (Buku Nota Saya) and `/buku-nota/heatmap`. The figures read the M05 answer store and the M03 chapter names (D12: M25 uses their contracts and has no store of its own).
- **S2, S3 → no module owns `/admin-sekolah/*`.** TRACKER lists no `/admin-sekolah` route, and F-19 (TRACKER change log) says "route discovery for /admin-sekolah/* pending in its owner module". R10 **recommends M18** (PPD & JPN), because M18 already owns the school-tier analytics these items mirror:
  - the heat map `/ppd/peta-haba` (school × subject);
  - `/ppd/statistik-penggunaan` (cf. "Statistik Penggunaan");
  - `/amaran` (cf. "Amaran Awal");
  - the school dashboards `/sekolah/{id}/*`.

  The alternative is M17 (admin dashboard and reports: `/admin/laporan`, `/admin/laporan-eksekutif`). **Decision for the Delivery Lead.** The R10 crawl classifies `/admin-sekolah/*` as M18 provisionally.

## 2. Screens

### 2.1 S1 — `/buku-nota/heatmap` "Heatmap Topik Lemah" (owner M25)

**Shell:** SHU (user portal). The header shows "Dashboard" / "Selamat datang kembali" rather than the page title (D-R10-01), with the coin / point / streak pills, the bell and the avatar (all shell). There is no filter, no form, no API call of its own, no chart library and no client-side state: the page is fully server-rendered. The only script inside `<main>` is the shared tournament-banner partial.

Content, in DOM order:

1. **Tournament banner partial** (shell partial, `x-data="tournamentBanner()"`, `x-show="tournaments.length > 0"`, `x-cloak`): fetches `GET /api/tournament/active`. It is hidden here because no tournament is active. Its template strings are "LIVE:" (`fa-circle` pulse), "{school_a} vs {school_b}", "Pendaftaran dibuka" / "Sedang berlangsung", and the chips "MAIN" / "DAFTAR". Link `/tournament/{uuid}`. Owned by M16 / the shell, listed only for reconciliation.
2. **"Cikgu Pakar" block** (`.duta-recommend-block`, amber gradient `#fef3c7 → white`, border `#fde68a`, max width 920 px):
   - heading "🌟 Cikgu Pakar Untuk Topik Lemah" (0.78 rem, 800, `#92400e`, upper case);
   - one card `a.duta-card.tier-bintang` → `/bilik-duta/cikgu-maestro-math` (M24), which contains:
     - avatar initials `span.av-img.tier-bintang` (2 letters; masked);
     - name `h4.name` (masked; a fictitious name must be used in seeds);
     - tagline "Maestro Matematik · 22 tahun ajar pelajar B40 capai cita-cita.";
     - pills "🥇 Duta Bintang" (`tier-pill bintang`, `#fef3c7` / `#92400e`), "📚 Matematik", "📍 Johor" and "⭐ 4.92";
     - a decorative "⭐" from `.duta-card.tier-bintang::before` in the top-right corner.

   The card is a Matematik expert, although the account has no Matematik cell. The selection rule is not observable (§9 OQ-R10-04).
3. **Hero** (`.hm-hero`, red gradient `#b91c1c → #dc2626`, white text, radius 12):
   - h1 **"Heatmap Topik Lemah"** (1.4 rem, 700);
   - p **"Topik mana anda kuat, mana lemah — semua dalam satu paparan. Klik kotak merah untuk fokus belajar."**;
   - legend, 4 pills with a white background and a coloured border and text:
     - **"Lemah (< 50%)"**: `#b91c1c` on border `#fca5a5`;
     - **"Sederhana (50-79%)"**: `#92400e` on `#fcd34d`;
     - **"Mantap (≥ 80%)"**: `#047857` on `#6ee7b7`;
     - **"Belum cuba"**: `#475569` on `#cbd5e1`.
4. **One block per subject** (`.subj-block`, white card, border `#e2e8f0`, radius 10):
   - h2 = subject name (1.1 rem, `#1e3a8a`);
   - a grid `.topic-grid` (`repeat(auto-fill, minmax(200px, 1fr))`, gap 0.5 rem) of **topic cells**. Each cell is `a.topic-cell.{red|amber|green|gray}` with:
     - `.topic-name` (600) = the chapter name;
     - `.topic-acc` "**{n} cuba · {p}% betul**" (0.75 rem, `#475569`);
     - cell colours: red `#fee2e2` / border `#fca5a5`, amber `#fef3c7` / `#fcd34d`, green `#d1fae5` / `#6ee7b7`, gray `#f1f5f9` / `#cbd5e1` at opacity 0.7 (CSS only; no gray cell observed);
     - hover: lift 2 px with a shadow; cursor pointer.
   - **Every cell links to `/practice/chapter`** (the generic "Soalan by Chapter" subject list, M05 S4), whatever its colour or subject (D-R10-02).

Observed data (admin account, id 1):

| Subject block | Cell (topic) | Text | Class |
|---|---|---|---|
| Bahasa Melayu | Kemahiran Bahasa Tingkatan 4 | "5 cuba · 0% betul" | red |
| | Kemahiran Bahasa Tingkatan 5 | "38 cuba · 32% betul" | red |
| | Kemahiran Mendengar dan Bertutur | "18 cuba · 44% betul" | red |
| | Kemahiran Membaca | "5 cuba · 60% betul" | amber |
| | Kemahiran Menulis | "10 cuba · 80% betul" | green |
| Sejarah | Sejarah Tingkatan 5 KSSM | "40 cuba · 35% betul" | red |

Other states:
- **Hidden / conditional:** the tournament banner (none active).
- **Not observed:** gray "Belum cuba" cells, the empty state (an account with no answers), more than one or no Cikgu Pakar card, and the student's own view (§9).

### 2.2 S2 — `/admin-sekolah/dskp-heatmap` "DSKP Heatmap" (no owner; M18 recommended)

**Not reachable with the admin account.** `GET /admin-sekolah/dskp-heatmap` → **302** `Location: /admin-sekolah/pilih-sekolah` ("pilih sekolah" = choose a school) → **500**. The admin sees the global standalone 500 page:
- `<title>` "500 - Ralat Pelayan | PRESTASIPLUS";
- big "500" and "⚙️";
- h1 "Ralat Pelayan";
- "Sesuatu tidak kena di pihak kami. Pasukan teknikal telah dimaklumkan. Sila cuba sebentar lagi.";
- buttons "Halaman Utama" → `/` and "Cuba Semula" → `javascript:location.reload()`;
- footer "PRESTASIPLUS".

No shell, no sidebar. It is identical at 375 / 768 / 1280 (7 elements).

What the route implies:
- school-scoped middleware: a school must be chosen (INFERRED: a `school_admin` has one school; the platform admin must pick one, and that picker crashes for him);
- the page content (labels, filters, heat-map axes, figures) is **not observable** (§9 OQ-R10-01).

Nearest observed analogues, for the URS writer's reference only, **not** as S2 fact:
- M18 `/ppd/peta-haba` (school × 7 core subjects heat map);
- the DSKP chain Bidang → SK → SP (M10 databank filters, `/guru/api/dskp/*`);
- the M08 mastery "Tahap" per SP.

### 2.3 S3 — `/admin-sekolah/laporan-bulanan` "Laporan Bulanan" (no owner; M18 recommended)

**Not reachable with the admin account.** `GET /admin-sekolah/laporan-bulanan` → **302** → `/admin-sekolah/pilih-sekolah` → **500**, with the same global 500 page as S2 (7 elements, the same at all widths). The content is **not observable** (§9 OQ-R10-02).

Nearest observed analogues (reference only):
- M08 `/laporan-mingguan` (403 for admin, student / parent weekly report);
- M10 / M11 `/guru/laporan-mingguan-kelas` (teacher weekly report);
- M17 `/admin/laporan-eksekutif` (the executive report for the platform admin).

## 3. Flows

- **Student → S1 (INFERRED; the student menu was not observable):** sidebar Pusat AI item "Heatmap Topik Lemah" (`fa-fire`, red) → `/buku-nota/heatmap`. Other entries: the "Heatmap Topik Lemah" tab of `/buku-nota`, and the "🌡️ Heatmap Topik" tile of `/pusat-nota-ringkas`.
- **S1 → practice:** any cell → `/practice/chapter` (M05 S4 subject cards) → `/practice/chapter/{CODE}` → chapter quiz. The copy "Klik kotak merah untuk fokus belajar" promises a focus on the red topic, but the link carries no topic or subject (D-R10-02).
- **S1 → ambassador:** the Cikgu Pakar card → `/bilik-duta/{slug}` (M24).
- **School admin → S2 / S3 (INFERRED):** sidebar → `/admin-sekolah/dskp-heatmap` or `/admin-sekolah/laporan-bulanan`. The school-scoping middleware redirects to `/admin-sekolah/pilih-sekolah` when no school is selected. For the platform admin that picker returns 500 (D-R10-05), so the flow dead-ends.

## 4. Data entities implied

| Entity | Fields used by S1 | Owner |
|---|---|---|
| Answer (practice answer log) | user, question, correct | **M05** |
| Question → chapter | `curriculumChapterId` → chapter name, subject | **M04** (question) / **M03** (chapter, subject) |
| Heatmap cell (derived, not stored) | subject, chapter name, attempts, correct %, band | computed (M25 screen over M05 / M03 contracts) |
| Ambassador (Duta) profile | slug, display name, initials, tier (`bintang` …), subject, state, rating, tagline | **M24** |

S2 / S3 entities are not observable (§9).

## 5. Figures: sources, computation and cross-module conflicts

### 5.1 Figures and their probable source

| Screen · figure | Live value | Probable computation | Check |
|---|---|---|---|
| S1 cell "{n} cuba" | 5, 38, 18, 5, 10, 40 (Σ 116) | count(answers of the user) grouped by (subject, chapter of the question) | BM D1 chapters = M05 S5 "18/320", "5/317", "10/321" soalan unik ✓ |
| S1 cell "{p}% betul" | 0, 32, 44, 60, 80, 35 | `round(100 × correct / n)`, whole number. 38 cuba → 12 correct = 31.6 → "32" (so rounded, not floored); 18 → 8 = 44.4 → "44" | = M05 S5 "Skor 44.4%", "60%", "80%" ✓; SEJ 14/40 = 35.0 ✓ (M05 S12 "14/40/35.0 %") |
| S1 cell colour | red < 50, amber 50–79, green ≥ 80 | band on the whole-number % (legend copy) | 6/6 cells fit (`bandCheck` in the snapshot) |
| S1 cell order within a subject | BM: 0, 32, 44, 60, 80 | **INFERRED:** accuracy ascending (weakest first). Not alphabetical ("Mendengar" before "Membaca"); not chapter-id order (BM D1 Bab 1 = 35 before T5 = 413 would put 44 % first) | fits 5/5. Tie order not observable |
| S1 subject order | Bahasa Melayu, Sejarah | INFERRED: alphabetical, or weakest subject first (both fit) | Perlu pengesahan |
| S1 cells shown | 6 chapters with ≥ 1 answer; no gray cell | only chapters the user has answered (INFERRED); the gray "Belum cuba" class exists in the CSS but is unused here | Perlu pengesahan (OQ-R10-03) |
| S1 Cikgu Pakar card | 1 card, Matematik, "Duta Bintang", Johor, 4.92, "22 tahun" | M24 ambassador; selection rule unknown | OQ-R10-04 |
| `/buku-nota` (sibling tab) | "9" "Jumlah Nota", "0" "Dikuasai", "0" "Perlu Ulangkaji" | count(AI notes of the user) (M25) | not shown on S1 |

### 5.2 Seed values (snapshot)

**Admin account (M01 seed id 1).** S1 must render exactly the six cells of §2.1, in that order, under "Bahasa Melayu" then "Sejarah". The totals behind them:
- BM: 76 answers, ~31 correct (0 + 12 + 8 + 3 + 8);
- SEJ: 40 answers, 14 correct.

"Topics" are M03 chapter names without the "Bab n:" prefix:
- BM D1 Bab 1 "Kemahiran Mendengar dan Bertutur" (id 35), Bab 2 "Kemahiran Membaca" and Bab 3 "Kemahiran Menulis";
- BM T4 "Kemahiran Bahasa Tingkatan 4";
- BM T5 "Kemahiran Bahasa Tingkatan 5" (chapter 413, "Bab 99");
- SEJ T5 "Sejarah Tingkatan 5 KSSM" (the M04 `chapterLabel` already used by M11).

The Cikgu Pakar card seed uses a **fictitious** name and initials with the observed slug `cikgu-maestro-math`, tier "Duta Bintang", "📚 Matematik", "📍 Johor", "⭐ 4.92" and the tagline "Maestro Matematik · 22 tahun ajar pelajar B40 capai cita-cita." (M24 owns the record.)

### 5.3 Conflicts and questions for other modules

- **C1 — M05 totals (same account).** M05 records the admin at 119 answers (S8 `all`) with BM 79 / 32 correct and SEJ 40 / 14. S1 shows 116, with BM 76 (~31 correct) and SEJ 40 / 14. **3 BM answers (about 1 correct) do not appear in S1.**
  - M05 §6 seeds these admin answers: BM D1 Bab 1 × 18, Bab 2 × 5, Bab 3 × 10, **2 BM D2 answers** (19/02), and the BM T4 / T5 answers.
  - The 2 D2 answers would form a "Kemahiran Mendengar dan Bertutur D2" cell, which is absent.
  - INFERRED: S1 leaves out answers whose question has no chapter / topic link, or leaves out the D2 chapter. The exact rule is not observable.
  - Seeds must not be tuned to hide this (D11/D12). The M25 writer defines the grouping rule so that the M05 anchors give exactly 76 / 40, and records it. Perlu pengesahan → XR to M05.
- **C2 — M08 "Tiada topik lemah!" for the same account.** M08 S6 (`/prestasi/1`) shows the empty state "Tiada topik lemah! Teruskan usaha." and "Belum ada data latihan.", while S1 shows 4 "Lemah" cells.
  - The two use different definitions: M08 uses DSKP-SP weak topics within its window, with "Sudah 127 hari tiada latihan"; S1 uses all-time chapter accuracy.
  - They are on different pages, so there is no side-by-side contradiction. Replicate both, record the definitions, and do not align them.
- **C3 — M24 Duta.** The card's data (tier, rating, subject, slug) needs an M24 ambassador record; M24 is not discovered yet. XR to M24 (fictitious name).
- **C4 — Rebuild nav (F-19).** `src/shells/nav/user-nav.ts` `heatmap-topik-lemah.to = '/heatmap-topik-lemah'` is 404 on live and should be `/buku-nota/heatmap`. The `/admin-sekolah/dskp-heatmap` and `/admin-sekolah/laporan-bulanan` hrefs are confirmed to exist (302, not 404).
- **C5 — School-admin portal ownership.** `/admin-sekolah`, `/admin-sekolah/pilih-sekolah`, `/admin-sekolah/dskp-heatmap` and `/admin-sekolah/laporan-bulanan` have no owner (§1.2). The architecture sends `school_admin` to `/dashboard` (M01 BR-07, INFERRED), but live has a `/admin-sekolah` dashboard (the admin-sekolah screenshot shows the URL `prestasiplus.my/admin-sekolah`, "Dashboard Sekolah", the school banner and the PPD / code line). Perlu pengesahan.

### 5.4 Side-effect ledger (this discovery)

No R10 page shows a view or click counter. Server hits, all GET (the guard's `hits` in the snapshot):
- `/buku-nota/heatmap` 1 (17 more served from cache);
- `/buku-nota`, `/pusat-nota-ringkas` 1 each;
- `/heatmap-topik-lemah` 1 (404);
- `/admin-sekolah`, `/admin-sekolah/dskp-heatmap`, `/admin-sekolah/laporan-bulanan` 1 each (302; later loads served the cached 302);
- `/admin-sekolah/r10-control-nonexistent` 1 (404);
- `/practice/chapter/BM` 1 (list page, no session);
- `/dashboard`, `/panduan`, `/pusat-tuisyen/panduan`, `/sitemap.xml`, `/robots.txt` 1 each; `/admin` 2 (the login landing, then one fetch);
- shell fetches `/admin/server-status`, `/notifikasi/unread-count`, `/api/tournament/active`, `/api/offline/snapshot` 1 each.

**Exception:** `/admin-sekolah/pilih-sekolah` (500) was reached **about 16 times** as a redirect follow-up that the guard cache could not serve, plus 1 direct navigation (then cached, 2 cache hits). Each is a read-only GET, but the 500 page says "Pasukan teknikal telah dimaklumkan", so the site may have logged about 17 errors. No live value changed. The login itself (`POST /login`) updated the admin's last-login time (M17 "Login Terkini" shows it), as in every discovery.

## 6. Scripts

- S1 has no page script. Inside `<main>` there is only the tournament-banner partial (`tournamentBanner()` → `fetchActive()` → `GET /api/tournament/active`, headers `Accept: application/json`, `X-Requested-With: XMLHttpRequest`).
- Shell scripts on S1 (owned by 00-global-ui / M16 / M22; listed for reconciliation): "Accept", "translate(0, 0) scale(1)", "cubic-bezier(0.22, 0.85, 0.32, 1)", "(display-mode: standalone)", "Tekan Pasang untuk arahan pemasangan", "[App] SW registered, scope:", "[App] SW registration failed:", "[FCM] Token saved:", "[FCM] Save token failed:", "[FCM] Token error:", "[FCM] Foreground message:", "[FCM] SDK load failed:", "Maaf, berlaku ralat. Sila cuba semula.", "Pendaftaran dibuka", "Sedang berlangsung", chatbot "Apakah PrestasiPlus?", "Bagaimana cara mendaftar?", "Berapakah harga langganan?". The shell chatbot's `/chatbot/history` fetch was blocked by the AI rule.
- S2 / S3 500 page: the "Cuba Semula" link is `javascript:location.reload()`.

## 7. Endpoints observed

| Method | URL | Use | Opened? |
|---|---|---|---|
| GET | `/buku-nota/heatmap` | S1 | yes (200) |
| GET | `/buku-nota` (`?subject_id=&status=&group=`) | "Buku Nota Saya", tab "Senarai" (M25 sibling) | yes, default only (200) |
| GET | `/pusat-nota-ringkas` | M25 hub with the "Heatmap Topik" tile | yes (fetch, links only) |
| GET | `/heatmap-topik-lemah` | user-nav INFERRED href | 404 |
| GET | `/admin-sekolah` | school-admin dashboard | 302 → pilih-sekolah → 500 |
| GET | `/admin-sekolah/pilih-sekolah` | school picker (INFERRED from the name) | **500** for admin |
| GET | `/admin-sekolah/dskp-heatmap` | S2 | 302 → 500 |
| GET | `/admin-sekolah/laporan-bulanan` | S3 | 302 → 500 |
| GET | `/practice/chapter` | S1 cell target (M05 S4) | **not followed** from S1 |
| GET | `/bilik-duta/cikgu-maestro-math` | Cikgu Pakar card (M24) | **not opened** |
| GET | `/api/tournament/active` | shell partial | yes (cached) |

## 8. Responsive behaviour (375 / 768 / 1280) and live defects

### 8.1 Layout (measured by `tools/jobs/R10-measure.js`; SHU pages include a 15 px scrollbar)

| Screen | 375 | 768 | 1280 |
|---|---|---|---|
| S1 | no page overflow (scrollWidth 360 = viewport − scrollbar); content 342 px; topic grid **1 column** (276 px cells, 60 px high); legend wraps to 3 lines; Cikgu Pakar card 272 px with pills wrapping; the mobile bottom nav (Home · SPM · Game · Topik · Chat · Lagi) overlays the page bottom | no overflow; grid **3 columns** (211 px; two-line names make 77 px cells); card 645 px | no overflow; sidebar visible; `.hm` 958 px (max 1200); grid **4 columns** (217 px); card 850 px (block max 920) |
| S2 / S3 (500 page) | centred standalone page, no overflow | same | same |

Text under 12 px (S1, all widths): the 4 Cikgu Pakar pills at 11.52 px (0.72 rem). Topic names are 13.6 px, "{n} cuba · {p}% betul" 12 px, h1 22.4 px and h2 17.6 px.

### 8.2 Live defects (D9 class; the rebuild decision is the URS writer's)

| ID | Defect | Class | Suggested rebuild |
|---|---|---|---|
| D-R10-01 | S1 SHU header shows "Dashboard" / "Selamat datang kembali" instead of the page title (as D-M21-06) | wrong title | header title "Heatmap Topik Lemah" |
| D-R10-02 | S1 copy "Klik kotak merah untuk fokus belajar", but every cell (red, amber and green, any subject) links to the generic `/practice/chapter` subject list, not to the topic | contradictory (the promise is not kept; the link itself works) | minimal: link each cell to its subject's chapter page `/practice/chapter/{CODE}` (an existing M05 route); or follow live. Perlu pengesahan, URS writer's choice |
| D-R10-03 | Cikgu Pakar avatar initials render as plain unstyled text: the circle / gradient styles exist only under `.duta-av .av-img`, and `.duta-card .av-img` only sets 56 × 56 and the font size | visual bug | a 56 px round gradient avatar (the site's own `.duta-av` style) |
| D-R10-04 | Cikgu Pakar pills at 11.52 px | unreadable text | minimum 12 px |
| D-R10-05 | `/admin-sekolah/pilih-sekolah` → **500 "Ralat Pelayan"** for the platform admin, so every school-admin page (S2, S3, `/admin-sekolah`) is a dead end for this role | broken page | Perlu pengesahan: the observed behaviour for the real `school_admin` role is unknown. The minimal rebuild for other roles is a 403 / redirect instead of a 500 (the content of a working picker was never observed, so it must not be invented) |
| D-R10-06 | The "Belum cuba" legend pill is shown although no gray cell is ever rendered for this account | possible contradiction | Perlu pengesahan (OQ-R10-03); follow live |

Not defects (replicate): S1 has no filters, no pagination and no chart library (a CSS grid of links); the whole-number %; the tournament banner hidden when none is active; the mobile bottom nav overlay.

### 8.3 Audit-lesson checklist
- Every probe is listed with its result (§1.1): 2 for S1, 2 for S2 (one a control), 1 for S3, all ≤ 3.
- S1 was captured at 375 / 768 / 1280 (inventory, measurements, screenshots). S2 / S3 were captured in the only reachable state (the 500) at all three widths.
- There are no client-side reveals on S1 (no Alpine state, no tooltip, no `title`); the cells were not followed (a practice start is forbidden).
- The figures are cross-checked against M05 (same account) and M08; the conflicts are in §5.3.

## 9. Open questions and states that need another account or a live action

| # | Question | Why not observable |
|---|---|---|
| OQ-R10-01 | **S2 "DSKP Heatmap": all content**: title, filters (class, level, subject, DSKP Bidang / SK / SP?), axes, cell values and colour bands, legend, export, empty state. | Admin → 302 → `/admin-sekolah/pilih-sekolah` → 500; a `school_admin` account is needed |
| OQ-R10-02 | **S3 "Laporan Bulanan": all content**: month selector, sections, tables, charts, export / print, empty state. | Same |
| OQ-R10-03 | S1 gray "Belum cuba" cells: when do they appear (chapters of the student's level with no answer?), and what is the S1 empty state for a user with no answers? | The admin has only answered chapters; no student account |
| OQ-R10-04 | S1 Cikgu Pakar selection (by weakest subject? random? featured?), 0 or more than 1 cards, other tiers (`inspirasi`, `tetamu` styles exist). | One card observed; M24 undiscovered |
| OQ-R10-05 | The student sidebar href of "Heatmap Topik Lemah" (INFERRED `/buku-nota/heatmap`) and whether parents / teachers can open S1. | The student menu is not rendered for the admin |
| OQ-R10-06 | The rule that leaves 3 BM answers out of S1 (C1), and the tie order of cells. | Needs controlled data (writes forbidden) |
| OQ-R10-07 | `/admin-sekolah/pilih-sekolah` for a working role (a school list? a query parameter?), and the `/admin-sekolah` dashboard itself. | 500 for admin; no route guessing allowed |

## 10. Screenshot index (`docs/discovery/img/R10/`, all masked)

- S1: heatmap-topik-lemah-desktop (1280, full page), heatmap-topik-lemah-tablet (768), heatmap-topik-lemah-mobile (375). The Cikgu Pakar name and initials show `<masked>`.
- S2 / S3 (the page both routes redirect to): admin-sekolah-pilih-sekolah-500-desktop, admin-sekolah-pilih-sekolah-500-tablet, admin-sekolah-pilih-sekolah-500-mobile.

All are `.png`, 6 in total.

## 11. Privacy check

- `piiLeakCheck` = **0 leaks in all 9 states** (the sanitizer's 3 collected strings: name and initials).
- A scripted scan of every R10 file (narrative, inventory, raw states, snapshot, crawl, job scripts) for the ambassador's name tokens and initials returns **0 hits** (`_summary.md`).
- The masked screenshots were checked by eye.
- The only scratch file (`scratchpad/r10/crawl-struct.json`, structure only, no names) was deleted after `R10-crawl-post.js` ran. No unmasked dump was written to disk.
- School names: none appear on R10 pages. The admin-sekolah reference screenshot's school is not quoted here.

## Appendix A — Enumerations

| Enum | Values → label |
|---|---|
| S1 band (cell class → legend) | `red` "Lemah (< 50%)"; `amber` "Sederhana (50-79%)"; `green` "Mantap (≥ 80%)"; `gray` "Belum cuba" (CSS only) |
| Duta tier (card / pill classes) | `bintang` "🥇 Duta Bintang" (observed); `inspirasi`, `tetamu` (CSS only, labels not observed) |

## Appendix B — Exact DOM strings (inventory reconciliation)

- S1: "🌟 Cikgu Pakar Untuk Topik Lemah", "Maestro Matematik · 22 tahun ajar pelajar B40 capai cita-cita.", "🥇 Duta Bintang", "📚 Matematik", "📍 Johor", "⭐ 4.92", "Heatmap Topik Lemah", "Topik mana anda kuat, mana lemah — semua dalam satu paparan. Klik kotak merah untuk fokus belajar.", "Lemah (< 50%)", "Sederhana (50-79%)", "Mantap (≥ 80%)", "Belum cuba", "Bahasa Melayu", "Sejarah", and the cells "Kemahiran Bahasa Tingkatan 4 5 cuba · 0% betul", "Kemahiran Bahasa Tingkatan 5 38 cuba · 32% betul", "Kemahiran Mendengar dan Bertutur 18 cuba · 44% betul", "Kemahiran Membaca 5 cuba · 60% betul", "Kemahiran Menulis 10 cuba · 80% betul", "Sejarah Tingkatan 5 KSSM 40 cuba · 35% betul".
- S1 hidden (tournament partial): "LIVE:" (icon `fa-circle`), "MAIN", "DAFTAR".
- S2 / S3 (global 500): "500", "⚙️", "Ralat Pelayan", "Sesuatu tidak kena di pihak kami. Pasukan teknikal telah dimaklumkan. Sila cuba sebentar lagi.", "Halaman Utama", "Cuba Semula", "PRESTASIPLUS".
- Global 404 (probes): "404", "🔍", "Halaman Tidak Dijumpai", "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?", "Halaman Utama" (→ `/`), "Mula Latihan" (→ `/latih-tubi`).
- `/buku-nota` (sibling, not inventoried): h1 "Buku Nota Saya", "Semua nota AI dari soalan yang anda jawab salah — kumpul, baca, master, score.", stats "Jumlah Nota" / "Dikuasai" / "Perlu Ulangkaji", tabs "Senarai" / "Heatmap Topik Lemah", "Subjek:" "Semua" …, status chips "Semua" / "Belum dibaca" / "Sudah dibaca" / "Dikuasai".
