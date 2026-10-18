# v2 Portal Pentadbiran - backlog of hidden items

Slug: `v2-portals` · Date: 2026-10-18 · User decision: unbuilt menu items are not shown to users and have no route. They are kept here (and as data in `src/shells/pentadbiran/menu.ts`, `PENTADBIRAN_FULL_MENU`) for the next development round.

Source of each item: `docs/requirements/v2-portals.md` section 6 (Evidence column). Mapping: B = .my (Blade admin), P = .cloud (admin React panel), F = filament (`/admin-filament`).

To bring an item back: build its screen and route, then pass its route as the third value of its row in `menu.ts` (the item then becomes `built` and is rendered).

Hidden items: 70

| ID | Label (BM) | Group | Source | Status |
|---|---|---|---|---|
| PP-01 | Dashboard | Papan Pemuka | .my (Blade admin), .cloud (React panel), filament | Not built |
| PP-02 | Laporan Eksekutif | Papan Pemuka | .my (Blade admin) | Not built |
| PM-04 | Analitik | Pemantauan | .my (Blade admin), .cloud (React panel), filament | Not built |
| PM-12 | Laporan Aktiviti | Pemantauan | .my (Blade admin), .cloud (React panel) | Not built |
| PM-13 | Amaran Wellbeing | Pemantauan | .cloud (React panel) | Not built |
| PM-14 | Papan Pemuka Wilayah | Pemantauan | n/a | Not built |
| PM-15 | Statistik Penggunaan | Pemantauan | n/a | Not built |
| PM-16 | Ranking Kebangsaan | Pemantauan | n/a | Not built |
| PM-17 | Benchmark Sekolah | Pemantauan | n/a | Not built |
| PM-18 | Leaderboard Sekolah | Pemantauan | n/a | Not built |
| PM-19 | Peta Haba | Pemantauan | n/a | Not built |
| PM-20 | Export Laporan | Pemantauan | n/a | Not built |
| PM-21 | DSKP Heatmap | Pemantauan | n/a | Not built |
| PM-22 | Amaran Awal | Pemantauan | n/a | Not built |
| PM-23 | Laporan Bulanan | Pemantauan | n/a | Not built |
| PM-24 | Headcount | Pemantauan | n/a | Not built |
| PM-25 | Prestasi | Pemantauan | n/a | Not built |
| PM-26 | Analitik Adaptif | Pemantauan | n/a | Not built |
| PM-27 | Analisa Item | Pemantauan | n/a | Not built |
| PM-28 | Sekolah Bersaing | Pemantauan | n/a | Not built |
| BS-03 | Sumber Kertas | Bank Soalan | .my (Blade admin) | Not built |
| KS-01 | Gambaran SPM | Kertas & SPM | .my (Blade admin), .cloud (React panel) | Not built |
| KS-02 | Databank Soalan | Kertas & SPM | .my (Blade admin), filament | Not built |
| KS-03 | Latih Tubi | Kertas & SPM | .my (Blade admin) | Not built |
| KS-04 | Tracking A | Kertas & SPM | .my (Blade admin), .cloud (React panel), filament | Not built |
| KS-05 | Subjektif | Kertas & SPM | .my (Blade admin), .cloud (React panel) | Not built |
| KS-06 | Bijak SPM (Simulasi) | Kertas & SPM | .cloud (React panel) | Not built |
| KS-07 | Kertas Subjektif | Kertas & SPM | .my (Blade admin), .cloud (React panel) | Not built |
| KS-08 | Kontrak Simulasi | Kertas & SPM | .cloud (React panel) | Not built |
| KS-09 | Set Builder | Kertas & SPM | .my (Blade admin), .cloud (React panel), filament | Not built |
| KS-10 | Tanda Karangan | Kertas & SPM | .cloud (React panel) | Not built |
| KS-11 | Ramalan SPM | Kertas & SPM | filament | Not built |
| KS-12 | Set Soalan | Kertas & SPM | filament | Not built |
| KK-03 | Bab | Kurikulum & Kandungan | .my (Blade admin), .cloud (React panel), filament | Not built |
| KK-08 | Video | Kurikulum & Kandungan | filament | Not built |
| KK-09 | Laluan Kerjaya | Kurikulum & Kandungan | filament | Not built |
| KK-10 | Universiti | Kurikulum & Kandungan | filament | Not built |
| KK-11 | Biasiswa | Kurikulum & Kandungan | filament | Not built |
| KK-12 | Video Sekolah | Kurikulum & Kandungan | n/a | Not built |
| PS-03 | Kelas Sekolah | Pengguna & Sekolah | n/a | Not built |
| PS-05 | Import Pengguna | Pengguna & Sekolah | .my (Blade admin), filament | Not built |
| PG-01 | Overview | Penglibatan | .my (Blade admin), filament | Not built |
| PG-02 | Tier Config (Kadar Tukaran Syiling) | Penglibatan | .my (Blade admin), filament | Not built |
| PG-03 | Cabaran | Penglibatan | .my (Blade admin), filament | Not built |
| PG-04 | Pelajar | Penglibatan | .my (Blade admin), filament | Not built |
| PG-05 | Transaksi | Penglibatan | .my (Blade admin), filament | Not built |
| PG-06 | Kedai Hadiah | Penglibatan | .my (Blade admin), filament | Not built |
| PG-07 | Gamifikasi Guru | Penglibatan | .my (Blade admin), filament | Not built |
| PG-08 | Lencana Guru | Penglibatan | filament | Not built |
| PG-09 | Cabutan | Penglibatan | filament | Not built |
| PG-10 | Kawalan Reward | Penglibatan | .my (Blade admin), filament | Not built |
| PG-11 | Tetapan Permainan | Penglibatan | .my (Blade admin), filament | Not built |
| PG-12 | Ranking Sekolah (Battle) | Penglibatan | n/a | Not built |
| PG-13 | Leaderboard (Battle) | Penglibatan | n/a | Not built |
| PG-14 | Produk | Penglibatan | .my (Blade admin), filament | Not built |
| PG-15 | Penjual | Penglibatan | .my (Blade admin), filament | Not built |
| PG-16 | Penajaan | Penglibatan | .my (Blade admin), filament | Not built |
| PG-17 | Anak Angkat | Penglibatan | .my (Blade admin), filament | Not built |
| PG-18 | Permohonan Anak Angkat | Penglibatan | .my (Blade admin), filament | Not built |
| PG-19 | Permohonan Duta | Penglibatan | .my (Blade admin), filament | Not built |
| PG-20 | Push Notifikasi | Penglibatan | .my (Blade admin), filament | Not built |
| PG-21 | Chatbot | Penglibatan | .my (Blade admin), filament | Not built |
| KW-01 | Pembayaran | Kewangan | .my (Blade admin), filament | Not built |
| KW-02 | Billing Dashboard | Kewangan | .my (Blade admin), filament | Not built |
| KW-03 | Invois | Kewangan | .cloud (React panel), filament | Not built |
| KW-04 | Dunning Log | Kewangan | .my (Blade admin), filament | Not built |
| SY-01 | Tetapan | Sistem | .my (Blade admin), filament | Not built |
| SY-02 | Kawalan Ciri | Sistem | .my (Blade admin) | Not built |
| SY-03 | Prestasi Sistem | Sistem | .my (Blade admin) | Not built |
| SY-04 | Log Audit | Sistem | .my (Blade admin), filament | Not built |
