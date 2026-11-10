# Jurang Data — V2 Production lawan V3 UAT

**Tarikh:** 8 November 2026. **Kaedah:** baca sahaja (SELECT) pada MariaDB V2 `prestasi_plus` dan Postgres UAT (kod e34e0a52d, migrasi hingga 0110). Agregat sahaja; tiada data peribadi.
**Nota semasa:** V2 masih bergerak (login terakhir 7 Nov, sesi latihan terakhir 1 Nov, percubaan peperiksaan terakhir 3 Nov), manakala UAT diisi daripada snapshot 29 Okt (etl run 3–8). Sebahagian beza kecil (pengguna, sesi) datang daripada pergerakan ini dan bukan kehilangan.

## 1. Ringkasan eksekutif

**Penemuan paling penting:** V2 sendiri **tidak memetakan soalan ke bab/topik**. Di V2, `questions.chapter_id` dan `topic_id` kosong untuk **semua 451,518 soalan** (0 daripada 408,197 diluluskan), `exam_questions.chapter_id` 0 daripada 5,704, dan jadual `topics` kosong (0 baris). Jadi "0 soalan ada `chapter_id` di UAT" bukan kehilangan hasil ETL. Ia sama dengan V2. Bab (686, semuanya Tingkatan 5, 14 subjek) wujud di kedua-dua sistem. Jurang sebenar ialah **V3 mahu pemetaan DSKP tetapi sumbernya tidak wujud**; kerja penandaan (tagging) perlu dibuat, bukan dimigrasi.

Penarafan penghalang data (dari paling berat):

| # | Penghalang | V2 | UAT | Kesan |
|---|---|---|---|---|
| 1 | **Bijak SPM: tiada kertas/kontrak boleh guna.** V2 ada 60 set ramalan (`spm_sets`, 12 subjek, 1,744 baris `spm_set_question`), 175 `exam_papers`, 36 `paper_blueprints`. UAT: 2 blueprint (status `retired`, `serves_students=false`), 0 `papers`, 0 `paper_sections`. ETL memang sengaja tidak memuat set ini (`not-migrated.ts`: "SPM tracking sets are seeded, not migrated"; kertas ".cloud are archived, not loaded"). | 60 / 175 / 36 | 0 boleh guna | Bijak SPM kosong |
| 2 | **Soalan tidak dipetakan ke DSKP/bab/topik.** `chapter_id`, `topic_id`, `unit_node_id` = 0 pada 406,396 versi soalan. Pokok DSKP **sudah ada** (2,844 `curriculum_nodes`: 171 unit, 528 sk, 2,062 sp, 83 grouping, + 1,394 `curriculum_tp_descriptors`) tetapi tiada soalan menunjuk padanya. Sumber V2 pun 0, jadi perlu tagging (AI atau manual). | 0 dipetakan (90 `dskp_tagged` sahaja) | 0 | Peta Belajar, soalan mengikut bab, analitik bab, mastery bab |
| 3 | **Soalan figura/stimulus hilang gambar.** Soalan "Rajah n" diluluskan: V2 296 (cuma 31 ada `image_path`, 265 tanpa gambar); UAT 280 versi, **0 stimulus, 0 gambar** (`stimuli` 0, `question_version_stimuli` 0, `files` 8). V2 ada 408 soalan diluluskan berimej dan 1,931 `stimuli`; semuanya tidak dimuat. Tambahan: 8,601 soalan "Rajah" berstatus `diarkib` (6,331 ada gambar) tidak dimigrasi. | 296 (31 bergambar) | 280 (0 bergambar) | Paparan soalan figura salah/tidak lengkap |
| 4 | **Soalan subjektif/berstruktur tiada.** V2: 2,015 subjektif (`diarkib`) + 4,061 `structured_questions`, 10,296 sub-soalan, 6,052 `question_parts`. UAT: semua 406,396 bahagian soalan bermod `mcq`; 0 stimulus. Bendera V2 `kertas-subjektif` juga `0` (mati). | 4,061 + 10,296 | 0 | Kertas subjektif, Bijak SPM jenis esei |
| 5 | **Soalan diarkib/draf tidak dimigrasi.** V2: 43,165 `diarkib`, 155 `draf`, 1 `ditolak`. UAT hanya muat yang `diluluskan`. Selain itu 1,801 soalan diluluskan ditolak ETL (`DUPLICATE_KEY`, `INVALID_VALUE`): 408,197 lawan 406,396. | 451,518 jumlah | 406,396 | Kehilangan 1,801 soalan servable (0.44%); diarkib sengaja ditinggal |
| 6 | **Kandungan: artikel, nota ditolak ETL.** `articles` 92 sumber, 0 dimuat (92 ditolak: ORPHAN_PARENT / INVALID_VALUE). `notes` 10 sumber, 0 dimuat. `support_tickets` 3 sumber, 0 dimuat (UAT ada 1 baris seed). | 92 / 10 / 3 | 0 / 0 / 1 | Artikel, Buku Nota (nota guru), tiket sokongan |
| 7 | **Gamifikasi: hadiah/gifts tidak dimuat.** V2 `gifts` 50, `gift_redemptions` 7. UAT `rewards`, `reward_claims`, `reward_redemptions`, `syiling_rewards` semuanya 0 (ETL: "Q8: ... skipped until the lead fixes the values"). Lencana murid: V2 `achievement_user` 0 dan UAT 0 (sama). | 50 / 7 | 0 | Kedai hadiah/redeem |
| 8 | **Kelas guru: 20 daripada 33 `classrooms` V2 tidak layak ETL.** `eligible_count`=13, dimuat 12, 1 ditolak ORPHAN_PARENT. UAT `classrooms` = 13 (12 dari ETL + 1 tambahan). `enrolments` 12 = 12 sama. | 33 | 13 | Kelas guru, laporan kelas |
| 9 | **Aktiviti pembelajaran yatim ditolak:** 227 sesi latihan (daripada 791 snapshot) dan 1,965 jawapan (daripada 7,567) tidak dimuat (`ORPHAN_PARENT`). `wallets` 527 daripada 3,396 tidak dimuat. | 791 / 7,567 / 3,396 | 564–572 / 5,602–5,617 / 2,871 | Sejarah murid sedikit tidak lengkap |
| 10 | **Tahap murid (Tingkatan/Darjah) tidak boleh dikira di V2** kerana `users` tiada lajur tahap (hanya `kelas` teks bebas). UAT: `grade` kosong untuk 3,260 daripada 4,763 murid aktif (68%); 1,502 = Tingkatan 5 (grade 11), 1 = grade 7. | n/a | 68% kosong | Penapis tahap, soalan ikut tahap murid |

**Tiada jurang (sama):** pengguna aktif ikut peranan, sekolah (10,207 lawan 10,208), langganan sekolah (14), enrolmen (12), cabaran (15 dan 163 penyelesaian), tiers (4), banner (10), streak/dompet (selepas buang yatim), sejarah peperiksaan (102).

## 2. Jadual mengikut kawasan

### 2.1 Pengguna (aktif sahaja)

| Item | V2 | UAT | Verdict | Modul matriks |
|---|---|---|---|---|
| Murid (`pelajar`/`student`) | 4,806 | 4,763 | sama (-43: 7 ditolak UNKNOWN_ENUM + pergerakan) | Semua portal murid |
| Guru | 735 | 736 | sama | Portal guru |
| Admin sekolah | 20 | 20 | sama | Portal admin sekolah |
| Admin | 3 | 5 | berbeza (UAT +2 akaun uji) | Admin pusat |
| Ibu bapa | 36 | 37 | sama | Portal ibu bapa |
| Pegawai PPD | 5 | 6 | sama | |
| Penaja | 6 | 6 | sama (peranan `sponsor`) | |
| `agent` (7), `jpn_officer` (1) | 8 | 0 peranan | tiada | Peranan agen/JPN tiada di UAT |
| Tidak aktif (pelajar 1,356, guru 49, admin sek. 2) | | 1,381 / 49 / 2 | sama (dimigrasi sebagai tidak aktif) | |
| Murid mengikut tahap | tiada lajur; `kelas` bermula "5": 1,524 | grade 11: 1,502; 7: 1; kosong: 3,260 | berbeza bentuk / kurang | Penapis tahap |
| Murid log masuk 30 hari (V2) | 66 | n/a | n/a | |

### 2.2 Sekolah, kelas

| Item | V2 | UAT | Verdict |
|---|---|---|---|
| Sekolah | 10,207 | 10,208 | sama |
| Sekolah beraktiviti (pengguna aktif) | 59 | 60 | sama |
| `classrooms` | 33 | 13 | kurang (ETL hanya 13 layak) |
| `classroom_student` / `enrolments` | 12 | 12 | sama |
| `school_subscriptions` | 14 | 14 | sama |
| `headcounts` / `headcount_entries` | 12 | 0 (1 config) | tiada (ETL: "no ETL card", GAP-11) |
| JPN / PPD | 16 / 146 | 16 / 146 | sama |

### 2.3 Soalan

| Item | V2 | UAT | Verdict |
|---|---|---|---|
| Jumlah soalan | 451,518 | 451,518 dalam `archive_cloud`; 406,396 dalam bank hidup | kurang (hanya diluluskan dimuat) |
| Diluluskan (servable) | 408,197 | 406,396 | kurang 1,801 (0.44%) |
| Diarkib / draf / ditolak | 43,165 / 155 / 1 | 0 | tiada (sengaja) |
| Jenis | mcq 450,503; subjektif 2,015 | mcq 406,396 sahaja | tiada subjektif |
| Tingkatan 1 / 2 / 3 / 4 / 5 (diluluskan) | 73,333 / 77,931 / 102,117 / 46,993 / 40,539 | 73,328 / 77,930 / 102,082 / 46,843 / 38,929 | T5 kurang 1,610 (4.0%), T4 kurang 150 |
| Darjah 1–6 (diluluskan) | 12,004 / 12,055 / 10,194 / 10,408 / 10,439 / 12,184 | sama tepat | sama |
| Subjek terjejas (diluluskan V2 ke UAT) | PERNIAGA 5,328 ke 4,236 (-1,092); AKAUN 6,380 ke 6,217 (-163); SCI 37,032 ke 36,951; MATH 33,270 ke 33,204; BA 21,413 ke 21,403 | | kurang |
| Subjek lain (PSV, PM, BM, PI, BT, PJK, SK, GEO, JAWI dll) | | | sama atau beza <0.5% |
| Dipetakan ke `chapter_id` | 0 | 0 | sama (tiada sumber) |
| Dipetakan ke `topic_id` | 0 (`topics` kosong) | 0 | sama |
| Dipetakan ke `unit_node_id` (DSKP) | 90 `dskp_tagged` | 0 | kurang |
| "Rajah n" diluluskan | 296 (31 bergambar, 265 tidak) | 280 (0 bergambar) | kurang |
| "Rajah n" diarkib | 8,601 (6,331 bergambar) | tidak dimuat | tiada |
| Soalan berimej (diluluskan) | 408 | 0 | tiada |
| `stimuli` | 1,931 (arkib) | 0 | tiada |
| `media_assets` / `files` | 1,139 | 8 | tiada |

### 2.4 Kurikulum

| Item | V2 | UAT | Verdict |
|---|---|---|---|
| Subjek | 31 | 33 | sama (UAT +2) |
| Tahap pendidikan | 11 | 11 | sama |
| Bab | 686 (semua T5, 14 subjek) | 686 (semua T5) | sama; **tiada bab T1–T4 di kedua-dua sistem** |
| Topik | 0 | 0 | sama (kosong) |
| `curriculum_nodes` (DSKP) | tiada jadual (hanya `dskp_tagged` pada soalan) | 2,844 (171 unit, 528 sk, 2,062 sp, 83 grouping) | UAT lebih (baseline 4 Nov: 0) |
| `curriculum_tp_descriptors` | n/a | 1,394 | UAT sahaja |
| `dskp_bidang` / `dskp_sk` / `dskp_sp` | n/a | 0 / 0 / 0 | kosong |
| `legacy_topics` / `legacy_subtopics` | n/a | 0 / 0 | kosong |

### 2.5 Bijak SPM / kertas peperiksaan

| Item | V2 | UAT | Verdict |
|---|---|---|---|
| `spm_sets` (kind `ramalan`) | 60 (12 subjek; sasaran 2,400 soalan) | 0 | tiada |
| `spm_set_question` | 1,744 | 0 | tiada |
| `exam_papers` / `paper_documents` / `exam_questions` | 175 / 254 / 5,704 | `papers` 0 (hanya `archive_cloud`) | tiada |
| `paper_blueprints` / `blueprint_sections` | 36 / 23 | `blueprints` 2 (retired) / 2 | kurang, tak boleh guna |
| `source_papers` | 82 | 2 | kurang |
| `pksk_packages` / `pksk_questions` | 5 / 748 | 3 packages, 15 domain, 0 soalan | kurang |
| `spm_targets` | 49 | 49 | sama |
| `exam_attempts` / `spm_mock_exams` | 290 / n/a | 102 / 2 (60 item, `in_progress`) | kurang (ETL hanya 102 layak) |

### 2.6 Aktiviti latihan

| Item | V2 | UAT | Verdict |
|---|---|---|---|
| `practice_sessions` | 796 (476 dalam 30 hari; terakhir 1 Nov) | 572 (479 dalam 30 hari; terakhir 30 Okt) | kurang (227 yatim + sesi selepas snapshot) |
| `question_attempts` / `practice_answers` | 7,587 (5,542 dalam 30 hari) | 5,617 | kurang (1,965 yatim) |
| `exam_attempts` | 290 (71 dalam 30 hari) | 102 | kurang |
| `part_responses` | 1,346 | 0 (teks bebas, tidak dimigrasi) | tiada |
| `structured_attempts` | 13 | 0 | tiada |
| `review_schedules` / `revision_queue` | 25 | 6 | kurang (dibina semula) |
| `audit_logs` | 1,706 (0 dalam 30 hari) | tidak dimigrasi (`audit_events` 182 baharu) | tiada |
| **V2 masih aktif?** | **Ya**: 373 pengguna baharu dan 476 sesi dalam 30 hari, login terakhir 7 Nov | | Perlu migrasi delta sebelum cutover |

### 2.7 Gamifikasi dan lain-lain

| Item | V2 | UAT | Verdict | Modul matriks |
|---|---|---|---|---|
| Syiling (`coin_transactions` / `coin_ledger`) | 33,475 (terakhir 1 Nov) | 40,123 | berbeza (UAT lebih; V2 kini lebih rendah daripada snapshot 40,139; punca belum disiasat; 23 ditolak ETL) | Syiling |
| Dompet | 3,172 | 2,871 (527 ditolak) | kurang | Syiling |
| Pencapaian (`achievements`) | 3 (0 pemegang) | 3 (0) | sama | Lencana |
| Lencana murid (`learner_badges`) | n/a | 0 | tiada data | Lencana |
| Tiers | 4 | 4 | sama | |
| Hadiah (`gifts`) / tebusan | 50 / 7 | 0 / 0 | tiada | Hadiah/Kedai |
| Mystery box / spins | n/a | `mystery_box_openings` 0, `spins` 1 | tiada data di V2 juga | Mystery Box |
| Cabutan bertuah (`lucky_draws`, `draws`) | 0 | 0 | sama (kosong) | |
| Battles | 3 (terakhir Jun, 0 peserta) | 0 | tiada (nilai rendah) | Battle |
| Game rooms / games | 3 / 3 (0 sesi) | 0 / `game_settings` 1 | tiada (nilai rendah) | Permainan |
| Liga | 0 | 0 | sama | |
| Cabaran harian | 15 (163 selesai) | 15 (163) | sama | |
| Nota (`notes`) | 10 | 0 | tiada (ditolak) | Nota |
| Video | 0 | 1 | sama (kosong) | |
| Artikel | 92 | 0 | tiada (ditolak) | Artikel |
| Audio KBAT | 0 | 0 | sama | |
| Tiket sokongan | 3 | 1 | kurang | Tiket |
| Banner | 10 | 10 | sama | |
| Marketplace | 10 produk, 1 penjual | 0 | tiada (sengaja, B1) | |
| Pembayaran | 80 | 0 | tiada (sengaja, B1) | |
| Maklum balas (`feedback`) | 7 | 1 | kurang (5 ditolak) | |
| **Feature flags** | 15 (12 pelajar aktif; `latih-tubi`, `kertas-subjektif`, `permainan` = mati) | tiada jadual (`user_scopes` 5 sahaja; DB migrasi 0110) | tiada | Kawalan Ciri |
| Tetapan (`settings`) | 33 | tiada setara (`gamification_settings` 4, `game_settings` 1) | berbeza bentuk | Tetapan |

Catatan: V2 menutup `permainan` (games) dan `kertas-subjektif`, jadi ketiadaan data permainan di UAT bukan penghalang parity.

## 3. Liputan ETL

Sumber: `apps/api/src/migration/load/activity/not-migrated.ts`, jadual `etl_recon` (run 1–8) dan `etl_rejects` di UAT.

**Dimigrasi dan padan** (sumber = dimuat): education_levels 11, subjects 31, chapters 686, topics 0, subject_levels 14, jpns 16, ppds 146, schools 10,207, enrolments 12, school_subscriptions 14, tiers 4, achievements 3, challenges 15, gamification_settings 4, challenge_completions 163, referral_codes 4, spm_targets 49, banners 10, question_sets 1. `exam_attempts`: 279 sumber, 102 layak, 102 dimuat.

**Dimigrasi tetapi tidak padan:**

| Entiti | Sumber | Dimuat | Ditolak | Sebab |
|---|---|---|---|---|
| users | 7,006 | 6,999 | 7 | UNKNOWN_ENUM (peranan tidak dikenali) |
| classrooms | 33 | 12 | 1 (20 tidak layak) | ORPHAN_PARENT |
| wallets | 3,396 | 2,869 | 527 | ORPHAN_PARENT / UNSUPPORTED |
| coin_ledger | 40,139 | 40,116 | 23 | UNSUPPORTED / INVALID_VALUE |
| practice_sessions | 791 | 564 | 227 | ORPHAN_PARENT |
| practice_answers | 7,567 | 5,602 | 1,965 | ORPHAN_PARENT |
| questions (diluluskan) | 408,197 | 406,396 | 1,801 | DUPLICATE_KEY, INVALID_VALUE |
| articles | 92 | 0 | 92 | ORPHAN_PARENT / INVALID_VALUE |
| notes | 10 | 0 | 10 | INVALID_VALUE |
| support_tickets | 3 | 0 | 3 | INVALID_VALUE |
| feedback | 6 | 1 | 5 | INVALID_VALUE |

**Sengaja tidak dimigrasi** (mengikut `not-migrated.ts`): soalan bukan diluluskan, struktur/subjektif, `exam_*`, `paper_*`, `blueprint*`, `spm_sets`/`spm_set_question`, `pksk_*`, `stimuli`, `part_responses`, `structured_attempts`, `question_set_items`, `question_reports`, `review_schedules`, gifts/gift_redemptions/lucky_draws (Q8), battles, games, leagues, headcounts, chatbot, teacher_badges, payments/invoices, marketplace, duta, student_notes, settings/feature_flags/audit_logs, career_paths/universities/scholarships, notifications, ai_usage_logs, dan jadual sensitif (mood_checkins, wellbeing_alerts, psychometric_results, aspirations, foster, sponsors).

**Dalam `archive_cloud` sahaja** (disalin, belum dimuat ke bank hidup): 451,518 soalan, 1,800,588 question_options, 21,953 part_options, 4,061 structured_questions, 10,296 sub-soalan, exam_questions 5,704, stimuli 1,931, question_snapshots 8,092, paper_document_pages 7,424, spm_set_question 1,744, media_assets 1,139.

**Tindakan ETL berkaitan penghalang:** (a) muat set SPM dan kertas melalui intake atau kad ETL baharu; (b) muat stimuli dan gambar soalan figura; (c) sediakan tagging DSKP kerana sumber kosong; (d) siasat 20 kelas tidak layak serta 92 artikel dan 10 nota ditolak; (e) migrasi delta data V2 selepas 29 Okt sebelum cutover.

## 4. Tidak dapat disemak

- Tahap Tingkatan/Darjah setiap murid di V2 (tiada lajur; hanya `kelas` teks bebas).
- `question_tags.kind` dan pecahan bab/DSKP mengikut subjek di UAT (sambungan SSH ke UAT putus berulang kali; pertanyaan tidak selesai).
- Sebab tepat 20 `classrooms` V2 tidak layak, dan punca `coin_transactions` V2 turun daripada ±40k (snapshot) kepada 33,475.
- Hanya SELECT dibuat pada V2; tiada `.env` atau fail rahsia dibaca.

## 5. SQL yang digunakan (ringkas, tanpa rahsia)

V2 (MariaDB; `SET SESSION TRANSACTION READ ONLY` sebelum setiap sesi):

```sql
select table_name,table_rows from information_schema.tables where table_schema='prestasi_plus' order by 2 desc;
select role,is_active,count(*) from users group by 1,2;
select left(kelas,1),count(*) from users where role='pelajar' and is_active=1 group by 1;
select status,count(*),sum(chapter_id is not null),sum(topic_id is not null),sum(dskp_tagged),sum(image_path is not null and image_path<>'') from questions group by status;
select education_level_id,count(*),sum(status='diluluskan') from questions group by 1;
select s.code,count(*),sum(status='diluluskan') from questions q left join subjects s on s.id=q.subject_id group by 1;
select type,status,count(*) from questions group by 1,2;
select status,(image_path is not null and image_path<>''),count(*) from questions where body like '%Rajah %' group by 1,2;
select count(*),sum(chapter_id is not null) from exam_questions;
select education_level_id,count(*),count(distinct subject_id) from chapters group by 1;
select kind,count(*),sum(target_count) from spm_sets group by 1;
select count(*),max(created_at),sum(created_at>now()-interval 30 day) from practice_sessions; -- juga question_attempts, coin_transactions, exam_attempts, users
select * from feature_flags;
-- kiraan baris: select count(*) from <jadual gamifikasi/kandungan>
```

UAT (Postgres; `PGOPTIONS='-c default_transaction_read_only=on'`):

```sql
select r.role,u.is_active,count(*) from user_roles r join users u on u.id=r.user_id group by 1,2;
select grade,count(*) from users u where is_active and exists(select 1 from user_roles r where r.user_id=u.id and r.role='student') group by 1;
select status,count(*),sum((chapter_id is not null)::int),sum((topic_id is not null)::int),sum((unit_node_id is not null)::int) from question_versions group by 1;
select education_level_id,count(*) from question_versions group by 1;
select s.code,count(*) from question_versions v left join subjects s on s.id=v.subject_id group by 1;
select mode,count(*) from question_parts group by 1;
select (exists(select 1 from question_version_stimuli s where s.question_version_id=v.id) or exists(select 1 from question_parts p where p.question_version_id=v.id and p.stimulus_id is not null)),count(*) from question_versions v where stem_ms like '%Rajah %' group by 1;
select kind,count(*) from curriculum_nodes group by 1;
select * from etl_recon order by id;
select entity,reason,count(*) from etl_rejects group by 1,2;
select schemaname,relname,n_live_tup from pg_stat_user_tables where n_live_tup>0 order by 3 desc;
-- kiraan baris: blueprints, papers, spm_*, rewards, draws, battles, leagues, notes, articles dan lain-lain
```
