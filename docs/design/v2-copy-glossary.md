# PrestasiPlus v2 - Copy and Terminology Glossary (Bahasa Melayu)

| Field | Value |
|---|---|
| Slug | `v2-design-system` (copy part) |
| Version | 1.0, 2026-10-18 |
| Author | ui-ux-designer |
| Status | Proposed, needs user approval of the choices marked **(D)** |
| Companions | `v2-design-language.md`, `v2-ds-consolidation.md` |
| Language | Doc English; all UI strings BM |

## 0. The rule

1. **Live wins where it works (D9).** If the live page (prestasiplus.cloud first, .my second) had working copy for this element, keep it verbatim, even when it differs from this glossary. Record it as a **live exception** in `config/copy-exceptions.json` (see consolidation doc, lint L5) with the module and the live URL or SRS reference.
2. **Glossary everywhere else**: new v2 elements, shared `Ds*` defaults, and anything live had in English by mistake or wrongly worded (D9 "wrong labels").
3. **Unsure whether a string is live?** Treat it as live and keep it; the owning module's SRS decides. The glossary is not a licence to reword observed copy.
4. `Ds*` components own the default copy (`src/ds/copy.ts`, one file); pages pass labels only for live exceptions or domain nouns.
5. Style: Title Case for buttons, menu items, headings and table headers; sentence case for hints, descriptions, toasts, errors. Address the user as **awak** in learner copy, **anda** in staff/admin copy (matches live). No exclamation marks in staff copy except live ones. No English in new copy (the live words "optional", "approved", "Post", "Table" are flagged below).

## 1. Actions

| Concept | Canonical BM | Where | Notes |
|---|---|---|---|
| Search (text) submit | **Cari** | `DsFilterBar` default, search box button | Matches the nav command "Cari" |
| Filter apply (inline bar) | **Cari** | same button | One button does search + filters |
| Filter apply (mobile sheet) **(D)** | **Guna** | drawer footer | Was "Guna" in Bank Soalan; keep. "Tapis"/"Terapkan" are not used |
| Open filters (mobile button / popover) | **Penapis** | button; popover "Lagi Penapis" | `Penapis` = noun; chip shows the count |
| Reset filters | **Set Semula** | filter bar, sheet, empty-no-match | Title Case, always two words capitalised. Not "Reset", "Set semula", "Kosongkan" |
| Remove one active filter | aria "Buang penapis {nama}" | chip | Visible chip text is the value |
| Active filters label | **Penapis aktif:** | `DsActiveFilters` | |
| Save (create or any generic form) | **Simpan** | `DsFormBar` | Primary, `loading` while saving |
| Save (edit) | **Kemaskini** only if live said so; otherwise **Simpan** | | Live: M02 user edit "Kemaskini" stays |
| Create submit | **Simpan**; live "Cipta X" keeps ("Cipta Langganan", "Cipta Headcount", "Cipta Set") | | New forms: Simpan |
| Add (entry button on list) | **Tambah {entiti}** | page header primary | Live "Cipta Kelas", "Buat Baru" keep |
| Cancel / leave a form or dialog | **Batal** | `DsFormBar`, dialogs | |
| Cancel an entity (subscription, booking) | **Batalkan {entiti}** | confirm only | Different meaning; do not use for dialogs |
| Edit (row action) | **Edit** | `DsRowActions` | Live word; keep |
| View (row action) | **Lihat** | `DsRowActions`; arrow is a trailing icon, not text | Live "Lihat →" keeps the arrow only where observed |
| Delete (row action) | **Padam** | `DsRowActions`, danger group | Never "Hapus", "Buang" for records |
| Delete confirm - title | **Padam {entiti}?** | `useConfirm` | e.g. "Padam Pengguna?" |
| Delete confirm - body **(D)** | **Anda pasti mahu memadam {nama}? Tindakan ini tidak boleh dibatalkan.** | `useConfirm` | PROPOSED. Live variants ("Anda pasti ...", "Adakah anda pasti ...") keep when observed |
| Delete confirm - buttons | **Batal** (tonal) / **Padam** (error, solid) | | Confirm label repeats the verb, never "Ya" |
| Retry after load error | **Cuba Semula** | `DsLoadError`, table error | Not "Cuba Lagi", "Muat Semula" (reserved for reloading the page) |
| Close | **Tutup** | modals, banners | |
| Back | **Kembali** | back link | |
| Next / previous (pager, stepper) | **Seterusnya** / **Sebelum** | `UPagination` | |
| Download / export | **Muat Turun** (file), **Cetak** (print), **Eksport** only if live | | |
| Show more | **Lihat Semua** (list), **Baca lagi** (text) | | |
| Row actions menu | aria **Tindakan** | `DsRowActions` | |
| Select all | **Pilih semua** | checkbox aria | |
| Bulk | "**{n} dipilih**" + action select + **Laksana** | bulk bar | Live word for the bulk confirm button if different keeps |

## 2. Pager and tables

| Element | Canonical | Notes |
|---|---|---|
| Pager summary | **Menunjukkan {dari}-{hingga} daripada {jumlah} hasil** | Hyphen with no spaces (as `DsDataTable`). Empty set: "Menunjukkan 0 daripada 0 hasil". Replaces English "Showing x to y of z results" **(D)** |
| Page-size select | **{n} / halaman** | aria "Baris setiap halaman" |
| Pager buttons | aria **Sebelum**, **Seterusnya**; page buttons aria "Halaman {n}" | |
| Sort select (mobile) | **Isih** | |
| Caption (sr-only) | "Jadual {benda}" | |

## 3. Search and filter fields

| Element | Canonical |
|---|---|
| Search placeholder | "Cari {benda}..." (e.g. "Cari soalan...") |
| Select blank option | "Semua {benda}" for filters (e.g. "Semua Subjek"); "Pilih {benda}" for form selects |
| Date range | "Dari" / "Hingga" |
| Required marker | `*` + sr-only "wajib" |
| Optional field | "(pilihan)", not "(optional)" |

## 4. Status words

One word per state, same everywhere; every badge shows icon + word.

| Concept | Canonical | Colour | Not |
|---|---|---|---|
| Active | **Aktif** | success | "ACTIVE", "Active" |
| Inactive | **Tidak Aktif** | neutral | "INACTIVE", "Nyahaktif", "Tidak aktif" |
| Approved | **Diluluskan** | success | "Approved", "Lulus" |
| Not yet approved | **Belum Diluluskan** | warning | "Pending" |
| Awaiting review | **Menunggu Semakan** | warning | "Pending", "Menunggu" alone |
| Rejected | **Ditolak** | error | "Rejected" |
| Draft | **Draf** | neutral | "Draft" |
| Published | **Diterbitkan** | success | |
| Complete / done | **Selesai** | success | |
| In progress | **Sedang Berjalan** | info | |
| Expired | **Tamat Tempoh** | error | |
| Risk | **Rendah / Sederhana / Tinggi** | success / warning / error | "Low/Mid/High" |
| New content | **Baharu** (live uses "BARU"/"NEW" badges on some, keep as observed) | secondary | |
| Live | **LIVE** (live word) | error + pulse | |

Live exceptions already known: Bank Soalan prints "ACTIVE/INACTIVE" under the badge (design doc `v2-admin-pages.md` section 3). Keep only if observed on live; otherwise change to Aktif / Tidak Aktif.

## 5. Empty states

| Case | Canonical | Example |
|---|---|---|
| Never created | **Belum ada {benda}.** | "Belum ada tiket sokongan." |
| Filter/search no match | **Tiada {benda} dijumpai.** + "Cuba ubah atau set semula penapis." | "Tiada soalan dijumpai." |
| No data for a chart/period | **Tiada data untuk tempoh ini.** | |
| No data at all in a widget | **Tiada data.** | only for tiny widgets |
| Not yet attempted (learner, friend voice) | "Belum ada {benda} lagi. Jom mula!" | learner only |

Not used: "Tiada rekod ditemui" (use *dijumpai*), "Tidak ada", "Belum ada data" for a filtered result.

## 6. Errors

| Case | Canonical |
|---|---|
| Load failure | **Tidak dapat memuatkan {benda}. Sila cuba semula.** + button "Cuba Semula" (PROPOSED default; modules keep their SRS text where live) |
| Generic server error | **Sesuatu tidak kena. Sila cuba semula sebentar lagi.** |
| Network | **Sambungan terputus. Semak internet anda dan cuba semula.** |
| Required field | **{Medan} wajib diisi.** |
| Invalid format | **Format {medan} tidak sah.** |
| Forbidden (inline) | **Anda tidak mempunyai kebenaran untuk tindakan ini.** (page-level 403 keeps the existing text) |
| Not found (inline) | **{Benda} tidak ditemui.** |
| Submit blocked summary | **Sila betulkan {n} medan di bawah.** |

## 7. Success toasts (4s)

Pattern: **{Entiti} berjaya {kata kerja}.** Verbs: disimpan, dikemaskini, dipadam, dicipta, dihantar, disalin, dimuat naik, diluluskan, ditolak.
Examples: "Pengguna berjaya dikemaskini.", "Soalan berjaya dipadam.", "Pautan berjaya disalin." (copy toast 2s). Live flash texts keep verbatim (the flash outlet shows them).

## 8. Loading and misc

| Element | Canonical |
|---|---|
| Button loading | "Menyimpan..." (save), "Memuat naik..." (upload), "Menghantar..." (send). Live "Sedang ..." copy keeps |
| Page loading (sr-only) | "Memuatkan..." |
| Skip link | "Langkau ke kandungan utama" |
| Search nav | "Cari halaman atau rekod..." |
| Theme | "Cerah / Gelap / Ikut Sistem" |

## 9. Inconsistencies found today (with files)

Verified by grep on 2026-10-18. Live-exception candidates are marked **L?**: confirm against the module SRS before changing.

| # | Inconsistency | Where | Action |
|---|---|---|---|
| C1 | Reset button: "Reset" vs "Set Semula" vs "Set semula" | "Reset": `src/modules/m04-question-bank/pages/SubmissionListPage.vue:175`, `m11-teacher-analytics/components/monitoring/MonitoringFilters.vue:123,147`, `m12-kirkpatrick/components/kirkpatrick/common/KirkpatrickFilterBar.vue:103`. "Set semula": `m09-content/components/admin-kit/AdminActiveFilters.vue:32`, `m07-pksk/components/admin/AdminActiveFilters.vue:32`. "Set Semula": `src/ds/DsFilterBar.vue`, `m04 .../QuestionListPage.vue:501,546` | Canonical Set Semula. M04 Submission, M11, M12: L? (likely live English); others fix |
| C2 | Filter apply: "Tapis" vs "Cari" vs "Guna" | "Tapis": `m04 .../SubmissionListPage.vue:174`, `DiagramAuditPage.vue:181`, `m09 .../AudioSetListPage.vue:212`, `AudioKbatListPage.vue:113`, `m11 .../MonitoringFilters.vue:113,179`, `m12 .../KirkpatrickFilterBar.vue:93`. "Cari": `DsFilterBar` default. "Guna": `DsFilterBar.sheetApplyLabel`, `m04 .../QuestionListPage.vue:491,540` | Canonical Cari (inline) / Guna (sheet). M11, M12 "Tapis": L? |
| C3 | Retry button: "Cuba Lagi" vs "Cuba Semula" | "Cuba Lagi": `src/ds/DsDataTable.vue:57` (`retryLabel` default). "Cuba Semula": `m05 .../quiz/LoadError.vue`, `m06/m07/m15/m20 LoadError.vue`, `m16 .../PageLoadError.vue`, `m08 .../shared/PageLoadError.vue` | DsDataTable default to Cuba Semula |
| C4 | Pager: BM `Menunjukkan x-y daripada z hasil` vs English `Showing x to y of z results` | BM: `src/ds/DsDataTable.vue:83`, `DsPagedTable.vue:96`. English: `src/components/data/LaravelPager.vue:92,97` (legacy pages, M13 RPH tests) | Move to `DsDataTable` pager text; legacy screens migrate (D-5) |
| C5 | Page-size label: "{n} / halaman" vs "{n} baris" and two aria labels | `DsDataTable.vue:115,214` vs `DsPagedTable.vue:43,104` ("Baris setiap halaman" vs "Bilangan baris setiap halaman") | One `src/ds/copy.ts` |
| C6 | Empty: "Tiada rekod ditemui" / "Tiada soalan dijumpai" / "Tiada soalan berstruktur ditemui" / "Tiada data" / "Belum ada ..." used for the same filtered-empty case | `m04 .../SubmissionListPage.vue:8,215,219`, `StructuredListPage.vue:11,288,293`, `QuestionListPage.vue:590,645`; "Tiada data" in `m27 .../MonthlyTable.vue:5`, `m11 .../MonitoringEngagementTable.vue:79`, `m08 .../GpsTrendCard.vue:42`, `m17 .../DailyHeatmapPanel.vue:4` | Apply section 5; filtered vs never-created split |
| C7 | Delete confirm body: "Anda pasti" vs "Adakah anda pasti" | `m02 .../UserDeleteModals.vue:37,64`, `m08 .../HeadcountConfirmModals.vue:66` vs `m02 .../SubscriptionDetailPage.vue:206`, `m03 .../CurriculumBrowserPage.vue:118-130` | Keep per live (L?); new dialogs use section 1 |
| C8 | View/add/create verbs: "Lihat" vs "Lihat →" vs "Lihat Penuh" vs "Lihat penuh →" vs "Lihat semua →" vs "Lihat Table Penuh" (BM + English) | `m08 .../TingkatanPage.vue:229,239`, `PrestasiKelasDetailPage.vue:278,287`, `HeadcountSummaryPage.vue:150`, `m27 .../GradeList.vue:36`, `PerutusanCard.vue:31`, `m08 .../HeadcountCards.vue:75` | Arrow becomes a trailing icon; "Table" to "Jadual" (L? on the English word) |
| C9 | Add verbs: "Tambah" / "Tambah Sekolah" / "Tambah Post" / "Cipta Kelas" / "Cipta Set" / "Buat Baru" | `m09 .../BannerListPage.vue:121`, `m02 .../SchoolListPage.vue:174`, `m08 .../TimelinePage.vue:55`, `PrestasiKelasPilihPage.vue:39`, `HeadcountListPage.vue:79` | New = Tambah {entiti}; live ones keep |
| C10 | Status vocabulary: Approved / Aktif / ACTIVE / Tidak aktif / Inactive / Pending / Menunggu / Draft mixed (191 hits in 87 files) | `m28 .../AttemptPage.vue` (7), `m02 .../UserListPage.vue` (7), `m09 .../AudioKbatListPage.vue:5` ("approved"), `m04 .../QuestionListPage.vue` | Apply section 4 by module task |
| C11 | English in BM UI: "(optional)", "Post", "Table", "approved" | `m10 .../SumbangSoalanEditPage.vue:178`, `m08 .../TimelinePage.vue:55,72`, `m09 .../AudioKbatListPage.vue:5` | L? (live words); otherwise "(pilihan)", "Hantaran", "Jadual", "diluluskan" |
| C12 | Active filters link: "Set semula" (lower-case s) | `m07 .../admin/AdminActiveFilters.vue:32`, `m09 .../admin-kit/AdminActiveFilters.vue:32` | Canonical Set Semula |

## Tab title (user decision 2026-10-29)

Every browser tab title is exactly `{Page Name} | PRESTASIPLUS`: one space either side of `|`, brand in uppercase, nothing else. `{Page Name}` is the name the user sees on the page: the shell header title (menu label or page header title) in the two v2 shells, the entity or page name for detail pages, the page heading for auth, public and error pages (for example `Log Masuk | PRESTASIPLUS`, `Halaman Tidak Dijumpai | PRESTASIPLUS`, `Akses Ditolak | PRESTASIPLUS`). The brand alone is never a title.

This supersedes the per-SRS exact tab titles for v2. It is implemented once in `src/composables/tabTitle.ts` (`formatTabTitle`, which also strips legacy `- PRESTASIPLUS` / `| PRESTASIPLUS` / `— Kirkpatrick` affixes); the router guard, the in-place outcome, `usePageMeta().setTitle` and the shells' `useShellTabTitle` all go through it.
