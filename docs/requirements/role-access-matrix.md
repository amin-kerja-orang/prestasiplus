# Role Access Matrix (student prototype scope)

Source: user-annotated screenshots in `roles-matrix/` (murid ×3, guru ×3, admin sekolah ×2), dated 2026-09-26, plus the user's answers of 2026-09-26 (see "Decisions").
A menu item is **allowed** when it carries a red tick in that role's screenshots, or when a decision below allows it. Menu labels are kept in exact BM copy.

✓ = allowed · — = not allowed (not ticked, or not in that role's sidebar)

## A. Account basics (all roles)

| Menu item | Murid | Guru | Admin Sekolah |
|---|:-:|:-:|:-:|
| Profil Saya | ✓ | ✓ | ✓ |
| Tetapan Peribadi | ✓ | ✓ | ✓ |
| Panduan | ✓ | ✓ | ✓ |
| Tiket Bantuan | ✓ | ✓ | ✓ |
| Log Keluar | ✓ | ✓ | ✓ |

## B. Modules

| # | Section (live sidebar) | Menu item | Murid | Guru | Admin Sekolah |
|---|---|---|:-:|:-:|:-:|
| 1 | (top) | Command Center | — | ✓ | ✓ |
| 2 | Harian | Dashboard / Dashboard Guru | ✓ | ✓ | ✓ |
| 3 | SPM / Harian / Penilaian | Headcount | ✓ | ✓ | ✓ |
| 4 | SPM / Penilaian | Prestasi | ✓ | ✓ | ✓ |
| 5 | SPM / Analitik | Analitik Adaptif | ✓ | ✓ | ✓ |
| 6 | SPM / Analitik / Lain-lain | Analisa Item (Guru: also "Analisis Item" under Lain-lain) | ✓ | ✓ | ✓ |
| 7 | Pembelajaran / Lain-lain | Video | ✓ | ✓ | ✓ |
| 8 | Pembelajaran / Harian | Kelas Saya | ✓ | ✓ | — |
| 9 | Pembelajaran / Harian | Soalan by Chapter | ✓ | ✓ | — |
| 10 | Analitik | Monitoring | — | ✓ | ✓ |
| 11 | Analitik | Kirkpatrick (incl. Ringkasan, T1: Reaksi, T2: Pembelajaran, T3: Tingkah Laku, T4: Hasil, Rantaian Impak, Intervensi) | — | ✓ | ✓ |
| 12 | (top) | Remedial | ✓ | — | — |
| 13 | SPM | SPM | ✓ | — | — |
| 14 | Pusat AI | Heatmap Topik Lemah | ✓ | — | — |
| 15 | — | Mohon Keluarga Angkat | ✓ | — | — |
| 16 | Pembelajaran | Latih Tubi | ✓ | — | — |
| 17 | Pembelajaran | Soalan Berstruktur | ✓ | — | — |
| 18 | Pembelajaran | Kedudukan | ✓ | — | — |
| 19 | Pembelajaran | PKSK | ✓ | — | — |
| 20 | Pembelajaran | Artikel | ✓ | — | — |
| 21 | Pembelajaran | Permainan | ✓ | — | — |
| 22 | Pembelajaran | Cabutan Bertuah | ✓ | — | — |
| 23 | Pembelajaran | Tournament | ✓ | — | — |
| 24 | Pembelajaran | Topik | ✓ | — | — |
| 25 | Pembelajaran | Peta Belajar | ✓ | — | — |
| 26 | Pembelajaran | Set Soalan Guru | ✓ | — | — |
| 27 | Pembelajaran | Audio KBAT | ✓ | — | — |
| 28 | Pembelajaran | Syiling & Token | ✓ | — | — |
| 29 | Pembelajaran | Tukar Token | ✓ | — | — |
| 30 | Pembelajaran | Cabaran Harian | ✓ | — | — |
| 31 | Pembelajaran | Kedai Hadiah | ✓ | — | — |
| 32 | Pembelajaran | Marketplace | ✓ | — | — |
| 33 | Pembelajaran | Papan Pendahulu | ✓ | — | — |
| 34 | Pembelajaran | Pencapaian | ✓ | — | — |
| 35 | Pembelajaran | Kotak Misteri | ✓ | — | — |
| 36 | Pembelajaran | Rujuk Kawan | ✓ | — | — |
| 37 | Pembelajaran | Cikgu Alesa | ✓ | — | — |
| 38 | Pembelajaran | Kedai Hadiah 🎁 (DIGITAL) | ✓ | — | — |
| 39 | Pembelajaran | Timeline Saya | ✓ | — | — |
| 40 | Pembelajaran | Jemput Ibu Bapa | ✓ | — | — |
| 41 | Harian | Pelajar Saya | — | ✓ | — |
| 42 | Penilaian | Laporan | — | ✓ | — |
| 43 | (Guru sidebar) | Laporan Mingguan | — | ✓ | — |
| 44 | Bank Soalan | Sumbang Soalan | — | ✓ | — |
| 45 | Visi & Pertandingan | Sekolah Bersaing | — | — | ✓ |
| 46 | Analitik | Statistik Penggunaan | — | — | ✓ |
| 47 | Analitik | DSKP Heatmap | — | — | ✓ |
| 48 | Analitik | Laporan Aktiviti | — | — | ✓ |
| 49 | Penilaian | Amaran Awal | — | — | ✓ |
| 50 | Penilaian | Laporan Bulanan | — | — | ✓ |
| 51 | Harian | Senarai Pelajar | — | — | ✓ |
| 52 | Harian | Senarai Guru | — | — | ✓ |
| 53 | Harian | Kelas Sekolah | — | — | ✓ |
| | | **Total modules allowed (excl. section A)** | **37** | **15** | **18** |

## Decisions (user, 2026-09-26)

| # | Question | Answer |
|---|---|---|
| D-RAM-1 | Murid: the "PEMBELAJARAN" section header is ticked — whole section or only the ticked items? | Whole section. |
| D-RAM-2 | Admin: Sekolah Bersaing (mark points at the NEW badge) — allowed? | Yes. |
| D-RAM-3 | Profil Saya, Tetapan Peribadi, Panduan, Tiket Bantuan, Log Keluar — available to every role? | Yes (section A). |
| D-RAM-4 | Guru: Kirkpatrick sub-pages included with Kirkpatrick? | Yes. |

## Notes

- **Pembelajaran membership (rows 7–9, 16–40)** is read from the murid screenshots: every item between the "PEMBELAJARAN" header and the footer links (Profil Saya, Invois Saya, Panduan), with no other section header visible in that range. If a screenshot crop hid a section header, the boundary must be re-checked against the live sidebar.
- **Invois Saya** (murid footer) was not ticked and is not in section A, so it stays not allowed.
- Kirkpatrick sub-pages were confirmed for Guru; the admin screenshot shows Kirkpatrick without expanded sub-items, so the same sub-pages are assumed to come with it.
