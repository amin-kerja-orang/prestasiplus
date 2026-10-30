# V1 baseline: questions, the activities that use them, and the outcomes they feed

Status: research baseline for V3 (the repo calls it "v2"). Written 2026-10-30 from the earlier rebuild's record of V1. No live login was made for this document.

Naming (user, 2026-10-30): V1 = prestasiplus.my (original live site); V2 = prestasiplus.cloud + admin.prestasiplus.cloud; V3 = the new system being built. V3 must be built on the CONTEXT, FEATURES, PROCESSES and OUTCOMES of V1 and V2.

## 0. How to read this document

Sources (all under `docs/`): `discovery/M04..M16, M09, M13, M25 (via URS), M27`, `requirements/urs/*`, `requirements/srs/M04`, `requirements/role-access-matrix.md`, `TRACKER.md` (D1-D45), `qa/audit/*`; V2 comparison from `discovery/cloud-student-mechanism.md` (V2, verified against production on 2026-10-30).

Evidence tags, kept from the source docs:
- **OBSERVED** = seen on the live V1 site with the platform admin account (2026-09-25/26 walk-through; read-only).
- **INFERRED** = derived from page markup, scripts or data, not proven.
- **SOURCE** = read from page scripts/server code in the earlier rebuild (TRACKER D24 allows server code as authority where live cannot be observed).
- **UNOBSERVED** = the docs say it could not be seen read-only (needs a session, or a role the admin account is not). Needs the live check in section 6.
- **V2 = same / different / none** compares with `cloud-student-mechanism.md`. "none (not in that doc)" means that doc does not mention it, which is not proof V2 lacks it.

Hard limits of the V1 record:
1. Only the platform admin account was used. Pelajar, guru, admin sekolah, PPD/JPN views are mostly INFERRED or from D24 server code.
2. No quiz, practice, mock, game, PKSK or set session was ever started (starting one writes records). So the question-answering screens of the random drill, chapter drill, structured answer page, SPM quizzes, SPM mock, PKSK practice/exam, Set Soalan, Audio KBAT player and the game rounds are UNOBSERVED. The one quiz UI that is fully described (Soalan Aku Salah) comes from the HTML source (M05 S7).
3. Counts on live pages contradict each other in places (section 5.2). They are recorded as shown.
4. No real person names are used here; roles only.

## 1. CONTEXT

### 1.1 What V1 is for

PRESTASIPLUS ("Platform Latih Tubi Nasional") is a Malaysian drill-and-assessment platform. Pupils practise multiple-choice and structured questions from Darjah 1 to Tingkatan 5, with a dedicated SPM mode for Tingkatan 4 and 5, an entrance-test mode (PKSK) for Darjah 6 and Tingkatan 3, teacher-made class sets and missions, games and competitions. Every answer feeds the same analytics chain that teachers, school admins and district/state officers (PPD/JPN) read: accuracy per subject and DSKP standard (SP), item analysis per question, early warning, Headcount (TOV/OTR/ETR targets), Kirkpatrick levels, and leaderboards. Gamification (syiling, XP, kombo, tiers) rewards the practice. A free trial gives 50 questions ("Baki 0 / 50 soalan"), then a subscription (M19) is needed (OBSERVED copy; the quiz-start gate is UNOBSERVED).

The question bank is huge and mostly imported: 465,278 questions in the admin list (all either `approved` 145,689 or `archived` 319,589; no draft/pending/rejected on live), plus 4,064 structured questions and 763 PKSK questions. Teachers contribute (16,817 own questions for the one teacher view observed). Admins approve, archive, fix reported questions and audit quality.

### 1.2 Who uses V1 for questions

| Role | What they do with questions in V1 | Evidence |
|---|---|---|
| Pelajar (murid) | Practise, sit SPM-style quizzes and mocks, take PKSK, class sets and missions, play games, report bad questions | OBSERVED menus (admin account sees the pelajar shell); behaviour mostly UNOBSERVED |
| Guru | Contribute questions (Sumbang Soalan), send paper files to admin, make structured questions, class sets, missions, "Soalan & Rujukan", audio sets, review databank and report problems, read class analytics | OBSERVED screens (admin account opens `/guru/*`); no teacher account used |
| Admin (platform) | Manage bank, approve/archive/delete, import CSV, quality audit, triage student reports, process teacher paper submissions, diagram audit, master-notes review, PKSK questions and access, audio sets, game and gamification settings | OBSERVED |
| Admin Sekolah | Reads school analytics (Monitoring, Kirkpatrick, Analisa Item, Prestasi, Headcount, Amaran Awal, DSKP Heatmap, Laporan Bulanan); no question-bank screens in the Release-1.0 matrix | role-access-matrix (user-annotated); most pages UNOBSERVED (403/302 on admin account) |
| Pegawai PPD / JPN | District/state Amaran Awal and intervention effectiveness | M18 discovery; not covered in depth here |
| Ibu bapa, Penaja | Landing page `/dashboard`; question use not observed | M05 URS, INFERRED |

#### Who can do what with questions (access matrix)

Basis: `role-access-matrix.md` (user-annotated screenshots, Release 1.0 scope only) plus discovery. It is NOT a full permission model; anything marked ⚠️ is not settled in the record.

| Role | Answer questions (practice, SPM, PKSK, games) | Contribute questions / paper files | Make class sets, missions, structured Qs | Approve / archive / delete bank questions | Report a question | See item analysis and class analytics | See school/state analytics |
|---|---|---|---|---|---|---|---|
| Pelajar | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ (own data only) | ❌ |
| Guru | ⚠️ not in the Release-1.0 menu, but the shell and `/guru/databank` exist | ✅ | ✅ | ❌ (own items go to review) | ✅ (Databank "Lapor Masalah") | ✅ own classes | ⚠️ Monitoring and Kirkpatrick are ticked |
| Admin Sekolah | ❌ | ❌ | ❌ | ❌ | ⚠️ UNOBSERVED | ✅ | ✅ own school |
| Pegawai PPD/JPN | ❌ | ❌ | ❌ | ❌ | ⚠️ UNOBSERVED | ⚠️ UNOBSERVED | ✅ district/state (Amaran Awal) |
| Admin (platform) | ✅ (sees pelajar shell) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

##### ✅ BOLEH
- **Pelajar**: Latih Tubi, Soalan by Chapter, Soalan Aku Salah, Soalan Berstruktur, PKSK, Set Soalan Guru, Audio KBAT, Permainan, Tournament, Remedial, SPM, Peta Belajar, Heatmap Topik Lemah; lapor soalan (modal "Lapor Soalan").
- **Guru**: Sumbang Soalan, Hantar Kertas Soalan, Cipta Soalan Berstruktur, Cipta Set Soalan, Soalan & Rujukan, Misi Harian, Set Audio KBAT, Databank Soalan (read + lapor), Analisis Item and Analisa Item, Prestasi, Headcount, Laporan, Monitoring, Kirkpatrick, Command Center.
- **Admin Sekolah**: Analitik Adaptif, Analisa Item, Prestasi, Headcount, Monitoring, Kirkpatrick, Amaran Awal, DSKP Heatmap, Laporan Bulanan, Statistik Penggunaan, Sekolah Bersaing.
- **Admin (platform)**: everything above plus `/admin/questions`, Import CSV, Kualiti Soalan, Laporan Soalan, Kertas Soalan Guru, Soalan Perlu Gambar Rajah, Master Notes, PKSK Soalan/Akses, Audio KBAT approval, Tetapan Permainan.

##### ⚠️ TERHAD
- **Guru** sees class-scoped data only (own classes); the exact scope of "Soalan Berstruktur" list (all 4,061 vs own) is UNOBSERVED (OQ-06 in M10).
- **Pelajar** PKSK: needs an active package grant (T1, T4 or Kombo); locked variant UNOBSERVED.
- **Pelajar** quizzes: 50-question free trial; the gate behaviour is UNOBSERVED.
- **Admin Sekolah / PPD** pages returned 302/403/404 for the admin account, so their contents are UNOBSERVED.

##### ❌ TIDAK BOLEH
- Pelajar cannot create or edit questions, see Analisa Item, Kirkpatrick or Monitoring.
- Guru cannot approve their own contributions into the live bank (admin does); cannot open the admin bank screens.
- Admin Sekolah has no Sumbang Soalan, no bank screens, no Latih Tubi (matrix).
- Nobody except the platform admin can bulk approve, reject, archive or delete bank questions.

##### 📌 Nota penting
- The matrix lists Guru without Latih Tubi but with "Soalan by Chapter"; Guru "Set Soalan" creation (`/guru/set-soalan`) is not in the matrix yet the route exists (OBSERVED with admin account).
- Who approves teacher contributions and whether imports are auto-approved is UNOBSERVED: Sumbang Soalan says "Hantar untuk Semakan" yet the teacher view shows "Diluluskan 16817 / Menunggu 0".

### 1.3 Content stores and the overall flow

```
                         ADMIN                               TEACHER                         SYSTEM
 CSV import (draft) ──┐                         Sumbang Soalan (Hantar untuk Semakan)           Imports (textbook/DSKP/
 Tambah Soalan (S2)  ─┤                         CSV import (Menunggu Semakan)                    trial/marking scheme)
                      ▼                         Hantar Kertas Soalan ──► Kertas Soalan Guru     AI: Penjelasan AI,
              QUESTION BANK (questions)  ◄──────  (admin keys in by hand, M04 S10)               Master Notes
   status: draft/pending_review/approved/rejected/archived ; is_active ; compliance ; DSKP tag
              + Structured bank (4,064)  + PKSK rows (763, same store, excluded from list)
              + Audio KBAT sets (approved only)   + Teacher sets/missions/Soalan & Rujukan
                      │ approved + active
                      ▼
 STUDENT ACTIVITIES: Latih Tubi · Chapter · Aku Salah · Berstruktur · SPM (Databank, Latih Tubi SPM,
 Tracking A, Subjektif, Mock) · PKSK · Set Guru · Misi · Audio KBAT · Battle · Games · Tournament/Liga
                      │ every answer = session + answer log (is_correct, question_id, subject, DSKP SP)
                      ▼
 OUTCOMES: scores/history · Aku Salah/Pembetulan/Remedial · Penguasaan · XP/syiling/kombo/quests ·
 Prestasi 360 · Analitik Adaptif · Analisa Item · Headcount (auto) · Monitoring · Kirkpatrick ·
 Amaran Awal · leaderboards/ranking · PKSK readiness
                      ▲
 STUDENT REPORT ("Lapor Soalan") ──► Laporan Soalan (admin) ──► question deactivated / fixed / re-enabled
```

Facts behind the picture:
- One question store owned by "M04" (rebuild decision D12). PKSK questions live in it with extra fields (`pksk_domain_id`, `pksk_target_level`) but are excluded from the admin list `/admin/questions` (OBSERVED).
- Status is separate from `is_active`, `compliance_status` (verified, pending_mapping, quarantined, rejected, draft) and `source_type` (textbook, dskp, trial, marking_scheme, ai_generated). Quarantined questions are archived and inactive in the samples (OBSERVED).
- DSKP tag (Bidang, Standard Kandungan, Standard Pembelajaran) is optional on a question. Only tagged questions can feed DSKP-level analytics (INFERRED; 14,933 untagged, badge "📖 Latihan Tambahan" vs "✓ DSKP").
- There is no rich-text or math editor: plain text, ASCII math, one image per question, one per MCQ option; a virtual Arab/Jawi keyboard only on admin create (OBSERVED).

## 2. FEATURES

Legend for V2 column: **same / different / none**. Counting rule: one row = one feature or activity with its own route group. Games are one row per family. Outcome screens are in table 2.7.

### 2.1 Student practice (Pembelajaran)

| # | BM name and route | Roles | Question types | Content from | Selection | Timer | Marking | Result / review | V2 |
|---|---|---|---|---|---|---|---|---|---|
| F01 | **Latih Tubi** `/practice` → `/practice/{CODE}` → `/practice/{CODE}/quiz?level&difficulty&count`. 31 subject cards, "Mode Baru" banner | Pelajar | MCQ (4 options) | Admin bank, `approved`; counts per subject from bank | Random from filter: Tahap (offers Darjah 1-4 only), Kesukaran 1-5 (5 has 0 questions), Bilangan 5/10/15/20 (default 10); start disabled when fewer available ("Soalan Tidak Mencukupi") | UNOBSERVED (INFERRED like revision: count-up "Masa") | INFERRED server per question via `POST /practice/check-answer`, then `submit-quiz` (SOURCE for revision) | UNOBSERVED; INFERRED like revision: score, "Ganjaran Anda", "Semakan Semula Jawapan", "Lapor Soalan" | **different**: V2 `/latih-tubi` has the same idea (subject, Tahap, Kesukaran, count 5/10/15/20, "Mula Kuiz", count-up "Masa") but marks in the browser (answer flags shipped in page JSON) and route flag `latih-tubi` is OFF in production (unreachable) |
| F02 | **Soalan by Chapter** `/practice/chapter` → `/practice/chapter/{CODE}?level=` → `/practice/chapter/{CODE}/{chapterId}/quiz?count=` | Pelajar, Guru (matrix) | MCQ | Bank questions linked to a chapter | Random inside chapter, count 5/10/15/20; **progressive unlock**: next bab opens only when all unique questions of current bab are answered and score ≥ 70% | UNOBSERVED | UNOBSERVED (INFERRED as F01) | Card shows "a/b soalan unik · Skor s% · r baki"; locked chip "Kunci bab sebelumnya" | **different**: V2 lists subjects/chapters with counts; "Mula" goes to the subject page, no unlock rule described; its destination is behind the OFF flag |
| F03 | **Soalan Aku Salah** `/practice/revision` → `/practice/revision/{CODE}` | Pelajar | MCQ | Questions the student previously answered wrong (72 for the admin: BM 46, SEJ 26) | Fixed session of 20 per subject, ordered by times wrong; a correct answer removes it from the list | Count-up "Masa" MM:SS | Server per question (`check-answer`: is_correct, correct_option_id, feedback, explanation), "Semak Jawapan" button | "Keputusan Ulang Kaji", message by %, "Ganjaran Anda" (syiling, "Kombo Semasa", mata), collapsible "Semakan Semula Jawapan", "Lapor soalan ini" | **different**: V2 lists "Soalan Aku Salah" by subject (latest attempt wrong, `diluluskan`); drill loads all those ids, marks client-side; only legacy ids feed it |
| F04 | **Soalan Berstruktur** `/latihan-berstruktur` → `/latihan-berstruktur/{id}/jawab` (variants `?scope=spm`, `&track=bahasa`) | Pelajar | Structured (Kertas 2: stimulus + sub-questions, marks, KBAT 1-6) | Structured bank (4,061 on pelajar list; 4,064 admin) | Student picks a set from a list (filters Subjek, Aras KBAT; 20 per page) | UNOBSERVED | Subtitle promises "jawab & semak secara automatik"; engine UNOBSERVED (Q-M05-9) | UNOBSERVED | **different**: V2 `StructuredMarker` (keyword/rubric, literal keyword matching), only items with a scheme or rubric are served (`markable`); 9 attempts in V2 production |
| F05 | **Latihan Subjektif** `/practice/{CODE}/subjektif` | Pelajar | Subjective | n/a | Link exists but never shown (`subjectiveCount` is 0 for all 31) | - | - | - | **none** |
| F06 | **Pembetulan** `/pembetulan` | Pelajar | n/a | Own answers | Month bar | - | - | "Sebelum" / "Selepas" / "Peningkatan" per month and subject | **same**: V2 `/pembetulan` monthly wrong answers; links to Latih Tubi (flag OFF) |
| F07 | **Tahap Penguasaan** `/penguasaan` | Pelajar | n/a | Own answers | L0-L10 scale | - | - | Level chip, "Menuju L{n+1}", "x1.05 XP" from L2 | **same** (route `/penguasaan` exists) |
| F08 | **Ujian Remedial Saya** `/remedial/saya` | Pelajar | MCQ (generated) | Teacher generates from weak topics (<50%) via Command Center | Per student/subject | UNOBSERVED | UNOBSERVED | Empty: "Tiada ujian remedial. Bagus — teruskan usaha!" | **different**: V2 lists weak subjects (accuracy < 60) and completed revision sessions with Sebelum/Selepas; flag `remedial` ON |
| F09 | **Misi Harian** (teacher missions) `/misi-harian` | Pelajar | MCQ from bank or "Soalan & Rujukan" | Teacher-created mission (subject, optional bab, 5-50 questions) | Bank draw by subject (+bab) | UNOBSERVED | 3 syiling per correct (fixed, stated) | Empty: "Tiada misi hari ini" | **different**: V2 `/misi-harian` = ChallengeProgress challenges; teacher creates at `/guru/misi-harian/cipta` |
| F10 | **Target SPM Saya** `/target-spm` | Pelajar | n/a | Own SPM-subject accuracy | 20 subjects; target grade per subject A+..E | - | - | Progress bar, predicted grade, legend "70%+ Ketepatan (On Track)" etc. | **none (not in that doc)** (V2 flag `target-spm` exists, state unverified) |
| F11 | **Kemajuan Saya** `/practice/progress`, **Sejarah Latihan** `/practice/history` | Pelajar | n/a | Own sessions | Period chips | - | - | Stats, "Trend Ketepatan" chart, "Topik Perlu Perhatian", "Prestasi Mengikut Subjek"; session cards with grade label and syiling | **none (not in that doc)** (V2 flags `kemajuan`, `sejarah` ON; screens not described) |
| F12 | **Peta Belajar** `/peta-belajar` | Pelajar | n/a | Curriculum (M03) | Chapter "islands" | - | - | Topik Selesai / Kemajuan | **same**: V2 unlocks islands when a chapter has approved questions; links to Latih Tubi (flag OFF) |
| F13 | **Heatmap Topik Lemah** `/buku-nota/heatmap` | Pelajar | n/a | Own answers per chapter | Cells coloured Lemah <50 / Sederhana 50-79 / Mantap >=80 | - | - | "{n} cuba · {p}% betul"; every cell links to `/practice/chapter` (live quirk) | **none (not in that doc)** |
| F14 | **Cabaran Harian** (10 daily quests, "Peti Harian") on dashboard and `/gamification/challenges` | Pelajar | n/a | Activity of the day | Fixed catalogue | - | Progress from sessions (quiz count, accuracy, topic variety, streak) | Syiling + XP per quest | **different**: V2 `misi-harian` flag; quest catalogue unverified |

### 2.2 SPM and PKSK

| # | BM name and route | Roles | Question types | Content from | Selection | Timer | Marking | Result / review | V2 |
|---|---|---|---|---|---|---|---|---|---|
| F15 | **Databank Soalan SPM** `/spm/tahun-lepas` → `/spm/tahun-lepas/{CODE}/quiz?count=` (18 subject cards, "Pilih set: 5 / 10 / 20") | Pelajar | MCQ | SPM pool (T4/T5 MCQ) | Random per subject; no year selector ("0 Tahun Tersedia") | UNOBSERVED | UNOBSERVED (V1 history logs it as "Tahun Lepas") | History row: %, "c/n betul", "+n 🪙" | **same** (V2 `/spm/tahun-lepas`, 5/10/20, random, "Penjelasan:" after Semak, result with letter grade and "Ganjaran Anda") but V2 marks client-side |
| F16 | **Latih Tubi SPM** `/spm/latih-tubi` → `/spm/latih-tubi/{CODE}` "Tetapan Kuiz" → `/quiz?count=&level=&difficulty=` | Pelajar | MCQ | SPM pool | Tingkatan 4/5 toggle; difficulty "Asas, Pertengahan, Sukar, Sangat Sukar" (keys 2-5); count = subject target (40 "Target SPM", 34 BM custom, 36 BI, 20 ADDMATH) or 5/10/20 | UNOBSERVED | UNOBSERVED | Logged as "Latih Tubi" in `/spm/history` | **different**: V2 folds this into `/latih-tubi` (flag OFF); V1 has a separate SPM Tingkatan 4/5 setup page |
| F17 | **Tracking A SPM (Objektif)** `/spm/ramalan` → `/spm/ramalan/{CODE}` → `?year=2026&set=N` | Pelajar | MCQ, fixed 40-question sets | Prebuilt sets (`Set Bersih`, `Ready Bank Besar`, `Belum Cukup` locked) | Fixed set; clean sets only start | UNOBSERVED | UNOBSERVED | "ADMIN READINESS" panel shows set readiness | **same concept, different build**: V2 legacy `spm_sets` kind `ramalan` (status locked/bersih/bank_besar) plus canonical composites; admin editor "Set Tracking A" |
| F18 | **Tracking A Bahasa** `/latihan-berstruktur?subject_id={1\|2}&scope=spm&track=bahasa` | Pelajar | Structured / real paper format | Structured bank (BM 559 sets, BI 773) | Student picks a set | UNOBSERVED | As F04 | As F04 | **same** (BM/BI go to this lane in V2) |
| F19 | **Subjektif SPM** `/spm/subjektif` → `/latihan-berstruktur?subject_id=&scope=spm` | Pelajar | Structured / essay | Structured bank, T4/T5, 15 subjects (4,059 sets) | Pick a set | UNOBSERVED | As F04; hub says "disemak oleh guru" (contradiction) | Stats: Set Dijawab, Subjek Dicuba, Skor Terbaik | **same** route; V2 can switch to canonical K2 papers by flag |
| F20 | **SPM Mock Exam** `/spm-mock` → POST `/spm-mock/jana` → `/spm-mock/{id}` → `/spm-mock/{id}/result` | Pelajar | Paper 1 (Objektif) or Paper 2 (Esei/Struktur) | Generated from bank for 10 subjects | System generates paper (item count/mix UNOBSERVED) | "timer akan jalan dan tak boleh stop" (copy); direction, length, auto-submit UNOBSERVED | "auto-grade"; rules UNOBSERVED | Result: grade letter, %, "x / y markah", "Topik Lemah", "Review Setiap Soalan", "Mock Lain", "Belajar Topik Lemah" | **different**: V2 K1 = random MCQ (5/10/20/40, client-marked), K2 = random `markable` structured with server keyword marker; letter grade A+ 90 ... E; plus the new Simulasi Peperiksaan (see F21) |
| F21 | **Simulasi Peperiksaan / Bijak SPM** | - | - | - | - | - | - | - | **none in V1; V2 only** (admin-curated real-format papers, cover page, autosave, countdown, Hantar, Semakan with scheme, "Cuba Lagi"; 69 published papers) |
| F22 | **Sejarah Kuiz SPM** `/spm/history` | Pelajar | n/a | SPM sessions | Filters Semua / Tahun Lepas / Latih Tubi / Tracking A | - | - | Rows with %, type badge, coins | **none (not in that doc)** |
| F23 | **SPM Walkthrough** `/pusat-ai/spm` ("Cikgu Alesa") | Pelajar | Free text/image of a question | AI | n/a | - | AI (simulated in rebuild, D4) | Plain-text walkthrough | **none (not in that doc)** |
| F24 | **PKSK PRO** `/pksk` → `/pksk/level/{T1\|T4}` → `/domains` → `/domain/{CODE}` ("Latih Sekarang"); `/exam` ("Peperiksaan Penuh"); `/history` (HTTP 500 on V1) | Pelajar with package grant | Bahagian A (situational MCQ, no right answer by UI note), B (MCQ, 13 domains), C (essay 150-200 words) | PKSK rows (763) | Practice per domain; full exam = 30 A + 70 B + 1 C per level, weights 20/70/10 | UNOBSERVED | B by "Betul" options; C rubric "kejelasan idea, susunan hujah, contoh relevan, ketepatan bahasa"; formulas UNOBSERVED | Dashboard "Skor Kesediaan Anda" %, grade, "Jumlah Peperiksaan", "Purata Bahagian B", "Penguasaan Domain" | **different**: V2 `/pksk` is a listing (counts by Bahagian/domain, first 50 questions if grant active); no answering flow found; 748 rows; separate `pksk_questions` table |

### 2.3 Teacher sets, missions and reference content

| # | BM name and route | Roles | Question types | Content from | Selection | Timer | Marking | Result / review | V2 |
|---|---|---|---|---|---|---|---|---|---|
| F25 | **Set Soalan Guru** teacher `/guru/set-soalan`, `/guru/set-soalan/cipta` ("Cipta Set & Tambah Soalan"); student `/set-soalan-saya` | Guru creates; Pelajar of that class plays | MCQ from bank | Teacher picks bank questions (adding step UNOBSERVED) | Fixed set; fields Kelas, Tajuk Set, Penerangan, **Kumpulan Set (TOV/AR tracking)**, Had Masa 1-360 min, Had Percubaan 0-99, status Draf/Jadual/Terbit | Optional "Had Masa" | UNOBSERVED | Student list empty on V1 ("Tiada Set Soalan"); play UNOBSERVED | **different**: V2 `/guru/set/cipta` has title, type, status `draf\|diterbitkan`, subject, level, question picker (50-row slice); no time limit, attempts, TOV/AR group; 0 sets in production |
| F26 | **Soalan & Rujukan** `/guru/soalan-guru` (+`/cipta`) | Guru; shown to pelajar only through Misi Harian | MCQ A-D, optional diagram | Teacher writes, with reference link (YouTube, Anyflip, Canva embeds, PDF, any URL); target classes | Assigned as mission | - | Client/server UNOBSERVED | Hidden from other classes | **same concept**: V2 "Soalan Guru (rujukan)" insert, written straight as `diluluskan` |
| F27 | **Misi Harian (teacher side)** `/guru/misi-harian` (+`/cipta` "Lancarkan Misi") | Guru | Bank draw "Latih Tubi SPM" or "Tracking A" or "Soalan & Rujukan" | Bank | Subject (required), Bab optional, 5-50 questions, date | - | 3 syiling per correct | Mission list, progress UNOBSERVED | **different**: V2 creates missions at `/guru/misi-harian/cipta`; type "Soalan & Rujukan" is broken on V1 (`toggleSource()` undefined, D-02) |
| F28 | **Audio KBAT** admin `/admin/audio-kbat`, teacher `/guru/audio-kbat`, student `/audio-kbat` | Guru/Admin create; Pelajar sees `approved` sets | 4 audio sections, 30 MCQ (Soalan 1-8, 9-16, 17-24, 25-30), transcript, KBAT level, marks 1-20 | Teacher/admin upload | Fixed sequence, "bukan rawak" | UNOBSERVED | UNOBSERVED | Student: "Belum ada set Audio KBAT yang approved." | **different**: V2 has `audio_kbat` table and a top-bar shortcut; production behaviour not described |
| F29 | **Databank Soalan (guru)** `/guru/databank`, `/guru/databank/{CODE}` | Guru | MCQ + essay | Bank | Filters Carian, Jenis, Sumber (Tahun Lepas, Latihan, Ramalan), Kesukaran, Bidang DSKP; 15 per page | - | - | Reading plus "Lapor Masalah Soalan" modal (8 reasons) | **different**: V2 Databank is the pelajar quiz; teacher read view not described |

### 2.4 Games and competitions

Games in V1 are reachable (200) and have a wallet link; in V2 the seven Zona Permainan games sit behind flag `permainan` (OFF) while Battle is reachable.

| # | BM name and route | Roles | Question types | Content from | Selection | Timer | Marking | Result | V2 |
|---|---|---|---|---|---|---|---|---|---|
| F30 | **Battle Arena** `/battle` (Quick Match, Battle Sekolah, Cabar Kawan; types biasa / spm / pksk) | Pelajar | MCQ (biasa/SPM) or PKSK domain items | Bank / PKSK | By grade; SPM type locked for non-T4/T5 ("Khas untuk pelajar Tingkatan 4 & 5 sahaja") | Rounds, per-question timer UNOBSERVED (matchmaking poll 3 s, 120 s timeout) | Scoring formula UNOBSERVED (scores 0-9,780 seen) | Ranking Pelajar Battle, Ranking Sekolah, Sejarah Battle | **different**: V2 Battle count 5/10/15/20, duration count x 12 s, two bot participants, `approved` MCQ; Cabar Kawan has no backend |
| F31 | **Papan Bijak, Perang Fakta, Benteng Ilmu, Perlumbaan Matematik, Kuiz Relay, Teka Silang Kata** (multiplayer lobbies `/papan-bijak` etc.) | Pelajar | MCQ board/quiz tiles | Bank (pool rules UNOBSERVED) | Room code of 6 characters; grade auto from profile | Lobby copy only (e.g. 5 minutes) | Rooms UNOBSERVED | Papan Bijak "Top 10 Juara" table | **different**: V2 pool `status != 'menunggu'` (includes non-approved), flag OFF |
| F32 | **Single-player games** `/permainan/betul-salah`, `cabaran-kilat`, `tembak-jawapan`, `susun-jawapan`, `kad-memori`, `roda-nasib`, `jutawan`, `pertandingan`, `uji-minda`, `sambung-kata` (500) | Pelajar | MCQ, true/false derived from MCQ, puzzles | Bank | Random per load; Darjah 1-4 picker (URL accepts 1-11) | Betul atau Salah 45 s; Cabaran Kilat 60 s; Tembak Jawapan 3 lives; Susun Jawapan none; Kad Memori count-up; Jutawan 15 rising questions | Computed in the browser (answer keys shipped, SEC-M16-1) and posted as numbers | Title bands, syiling shown even though wallet pays XP only | **same** (V2 `betul-salah` etc., same client-side marking and `betu`-derivation from MCQ), flag OFF |
| F33 | **Pertandingan Mingguan** `/permainan/pertandingan` | Pelajar | n/a | Weekly practice | Top 20 of the week by correct answers | Week Monday-Sunday | - | Prizes copy: +100 / +50 / +25 syiling | **same name** (V2 Liga/Tournament over `question_attempts`) |
| F34 | **Liga & Tournament** `/liga`, `/tournament` (+create forms) | Guru/Admin create; Pelajar joins | Mixed, quiz or multiplayer | Source rules in form (5-100 questions, SPM Kertas 1 counts per subject) | Invite code 8 chars; scopes school/district/state/national | Time window 10-180 min (form) | UNOBSERVED | Leaderboard per class level, "Data dikemas kini setiap jam" | **different**: V2 `tournaments` table has no migration in repo (unverified) |
| F35 | **Sekolah Bersaing** `/sekolah-bersaing` | Pelajar, Admin Sekolah | n/a | Weekly job over practice activity | - | Weekly | Score ~ % aktif + streak (INFERRED) | 49 schools, anonymous opt-out | **none (not in that doc)** |

### 2.5 Authoring and teacher contribution

| # | BM name and route | Roles | Question types | Content from | Selection | Timer | Marking | Result / review | V2 |
|---|---|---|---|---|---|---|---|---|---|
| F36 | **Sumbang Soalan** `/guru/soalan` (+`/cipta` "Tambah Soalan Baru", edit, detail; CSV "Import CSV") | Guru | MCQ, Betul/Salah, Jawapan Pendek, Isi Tempat Kosong, Esei on create; edit is MCQ only | Teacher | - | - | - | Stats Jumlah/Diluluskan/Menunggu/Digunakan, 8 badge tiers (10 ... 50,000), subject breakdown | **same concept**: teacher CSV/Sumbang writes `menunggu`; retired by flag `legacy-retirement` ("Bank soalan lama kini baca sahaja — gunakan Studio.") |
| F37 | **Hantar Kertas Soalan kepada Admin** (form on `/guru/soalan`, POST `/guru/soalan/hantar-kertas`) | Guru | Files: PDF (text), DOCX, XLSX; max 5 files, 20 MB each; scheme mandatory | Teacher files | - | - | Admin keys questions in by hand | Admin screen "Kertas Soalan Guru" with status pipeline | **same**: V2 tab "Kiriman Guru" (`/admin/question-submissions`), imports by hand |
| F38 | **Soalan Berstruktur (teacher)** `/guru/soalan-berstruktur` (+`/cipta`, show, edit) | Guru; admin list read-only | Structured (stimulus, subs with marks, text/numeric answer, rubric points, KBAT 1-6, template "Eksperimen Sains", visibility Public/Tingkatan/Class) | Teacher | - | - | - | "Simpan Draf" / "Simpan & Terbitkan"; status toggle | **different**: V2 `StructuredRubricEditor` (Panel), served only when a scheme or rubric exists |
| F39 | **Artikel / Nota / Video** (teacher "Sumbang Artikel") | Guru | n/a | Teacher | - | - | - | Out of scope for question baseline | not compared |

### 2.6 Admin (question management)

| # | BM name and route | Roles | Question types | Content from | Selection | Timer | Marking | Result / review | V2 |
|---|---|---|---|---|---|---|---|---|---|
| A01 | **Pengurusan Soalan** `/admin/questions` (summary tiles, 8 filters, bulk bar, table) | Admin | All | Bank | - | - | - | 20 per page | **same screen** as V2 "Bank Lama (Legasi) > Senarai Soalan" (same heading and summary); V2 adds the canonical **Studio** bank |
| A02 | **Tambah / Edit / Lihat Soalan** `/admin/questions/create`, `/{id}`, `/{id}/edit` (+ "Jana Penjelasan AI") | Admin | 5 types on create; edit MCQ-only | - | - | - | - | - | **different**: V2 legacy "Tambah Soalan" redirects to Studio ("Borang soalan lama telah dipindahkan ke Studio") |
| A03 | **Import CSV** `/admin/questions/import` ("Sejarah Import" = HTTP 500) | Admin | MCQ only | CSV | - | - | - | Saved as draft | **different**: V2 CSV import is a dead stub on the list; real import is Filament `/admin-filament/questions/import` (`body, option_a-d, correct`) plus Studio DOCX/OCR doors |
| A04 | **Kualiti Soalan** `/admin/questions/quality` ("Jalankan Audit Semula") | Admin | - | - | - | - | Score 0-100 | KPI cards, buckets, per-subject table | **same** (V2: tab "Kualiti" inside Senarai Soalan) |
| A05 | **Laporan Soalan** `/admin/question-reports` | Admin | - | Student reports | Tabs Menunggu/Disemak/Diperbaiki/Ditolak/Semua | - | - | Actions Tandakan Selesai / Tolak & Aktifkan Semula / Nyahaktif Segera | **same** (V2: tab "Laporan") |
| A06 | **Soalan Berstruktur (admin)** `/admin/structured-questions` | Admin | Structured | - | Read-only list/detail | - | - | - | **same-ish** |
| A07 | **Kertas Soalan Guru** `/admin/question-submissions` | Admin | Files | Teachers | - | - | - | pending / processing / done / rejected + admin_notes | **same** ("Kiriman Guru") |
| A08 | **Soalan Perlu Gambar Rajah** `/admin/soalan-gambar` (badge 6,144) | Admin | MCQ/structured needing a diagram | Audit | - | - | - | Upload image or dismiss | **none (not in that doc)** |
| A09 | **Master Notes review** `/admin/master-notes` | Admin | AI "misconception" notes per question | AI (gpt-4o-mini) | - | - | - | Approve / Regenerate / Clear Flag | **none (not in that doc)** |
| A10 | **PKSK Soalan / PKSK Akses** `/admin/pksk/questions`, `/admin/pksk/access` | Admin | PKSK A/B/C | Admin | - | - | - | Bulk Luluskan/Tolak/Padam; grant package to a user id with optional expiry; revoke "Tarik" | **same** (V2 same URLs; grant gates the list) |
| A11 | **Audio KBAT approval** `/admin/audio-kbat` | Admin | Audio sets | Teachers | - | - | - | draft / pending_review / approved / archived | **different** (see F28) |
| A12 | **Tetapan Permainan**, **Gamifikasi** (tiers, Cabaran Harian, reward control) | Admin | n/a | - | - | - | - | Configuration of syiling per correct, games, quests | **different**: V2 uses `Kawalan Ciri` flags; reward config not described |

Feature count (this document): 51 rows = 14 student practice (F01-F14) + 10 SPM/PKSK (F15-F24) + 5 teacher set/mission/reference (F25-F29) + 6 games and competitions (F30-F35) + 4 authoring (F36-F39) + 12 admin (A01-A12). F21 exists only in V2 and F39 (articles) is outside the question baseline, so **49 V1 question-related features** are compared, plus **14 outcome screens** (R01-R14) = 63 items. The game rows F31 and F32 cover 16 individual game pages (M16 S7-S22).

### 2.7 Outcome screens (reports and analytics fed by question activity)

| # | BM name and route | Roles | Data it reads | V2 |
|---|---|---|---|---|
| R01 | **Prestasi 360** `/prestasi/{userId}` | Pelajar, Guru, Admin Sekolah | Sessions, accuracy, subject mastery, 90-day heatmap, weak topics, "Cadangan", Headcount cards | none (not in that doc); flag `prestasi` exists |
| R02 | **Prestasi Sekolah / Tingkatan / Kelas** `/prestasi/sekolah`, `/tingkatan/{t4\|t5}`, `/kelas/{id}` | Guru, Admin Sekolah | Headcount GPS, class comparison, at-risk list | none (not in that doc) |
| R03 | **Analitik Adaptif** `/analitik/pelajar`, `/analitik/kelas` | Pelajar, Guru | Per-DSKP-SP accuracy, "Latihan Fokus", "Unjuran Gred" | none (not in that doc) |
| R04 | **Analisa Item** `/analisa-item/kelas/{id}`, `/analisa-item/sekolah`; **Analisis Item** `/guru/analisis-item` | Guru, Admin Sekolah | Per question: attempts, accuracy, difficulty index, discrimination, popular wrong option | none (not in that doc); flag `analisa-item` state unverified |
| R05 | **Headcount** `/headcount`, `/headcount/dashboard`, `/headcount/student/{id}` | Pelajar, Guru, Admin Sekolah | TOV/OTR/ETR targets; auto-mode uses SPM Latih Tubi + Tracking A answers | none (not in that doc) |
| R06 | **Laporan Statistik** `/guru/laporan` | Guru | Logins, practice, activity split Kuiz/Struktur/Latih Tubi/Tracking A/Battle/Permainan, trend, "Paling Aktif" | none (not in that doc) |
| R07 | **Monitoring Penglibatan** `/guru/monitoring` (`/admin/monitoring`) | Guru (shell), Admin Sekolah, PPD | Pernah Aktif, Soalan Dijawab, weekly cells | none (not in that doc) |
| R08 | **Kirkpatrick** T1 Reaksi, T2 Pembelajaran, T3 Tingkah Laku, T4 Hasil, Rantaian Impak, Intervensi | Guru, Admin Sekolah | T2 and T3 and T4 read answers; T1 reads `/maklum-balas` | none (not in that doc) |
| R09 | **Command Center** `/guru/command-center` | Guru | Live answers, accuracy, GPS, engagement; Remedial scan; Ramalan SPM; Evaluate | none (not in that doc) |
| R10 | **Kehadiran Digital** `/guru/kehadiran-digital` | Guru | "Pelajar jawab 5+ soalan = Hadir" | none (not in that doc) |
| R11 | **Amaran Awal** `/amaran`, `/amaran/ppd`, `/amaran/jpn`, `/keberkesanan` | Admin Sekolah, PPD, JPN | At-risk status from accuracy/GPS trend (rule UNOBSERVED) | none (not in that doc) |
| R12 | **Kedudukan** `/ranking`, **Papan Pendahulu** `/leaderboard`, `/gamification/leaderboard`, `/battle/leaderboard`, `/battle/ranking-sekolah` | Pelajar | Correct answers; coins; battle points | V2 has `leaderboard`, `liga`, `tournament` (flag `leaderboard` state unverified) |
| R13 | **Syiling, XP, kombo, tiers, pencapaian** `/gamification/*` | Pelajar | Per-correct reward, quests, streak | **different**: V2 `PracticeRecorder` returns letter grade and "Ganjaran Anda" (syiling, kombo, mata, baki) |
| R14 | **Laporan Soalan Saya** `/laporan-soalan` | Pelajar | Own reports by status | **same** (reports feed admin tab) |

## 3. PROCESSES

### 3.1 Admin process: add, import, approve, publish

Everything below is V1 as OBSERVED unless tagged. "Publish" in V1 has no separate step: a question becomes visible to students when `status = approved` (and `is_active`); the earlier rebuild states the eligibility rule as "approved + active" (rebuild rule BR-M04-03, derived, not seen directly on live).

**A. Add one question** (`/admin/questions` → button "Tambah Soalan" / "Tambah" → `/admin/questions/create`, title "Tambah Soalan Baru").
1. Card "Maklumat Soalan": Subjek * (31), Tahap Pendidikan * (Darjah 1-6, Tingkatan 1-5), optional "DSKP Tagging (Pilihan)" with three cascading selects Bidang → Standard Kandungan → Standard Pembelajaran ("✓ DSKP tagged"), "Tahap Kesukaran *" (5 radio cards, no default: Sangat Mudah ... Sangat Sukar), "Jenis Soalan *": `mcq` Objektif (MCQ), `true_false` Betul / Salah, `short_answer` Jawapan Pendek, `fill_blank` Isi Tempat Kosong, `essay` Esei / Subjektif.
2. "Teks Soalan *" (min 10 chars, Arab/Jawi virtual keyboard), optional image (JPG/PNG/WebP, max 2 MB).
3. Answer card by type: MCQ "Pilihan Jawapan" (exactly 4 options A-D, one correct radio, optional image per option); "Jawapan Betul / Salah"; "Jawapan Betul *" + "Jawapan Alternatif (pisahkan dengan koma)"; "Jawapan Contoh (Esei)".
4. Card "Maklumat Tambahan": Penjelasan, Bahasa (bm/en), Nilai Mata (default 1).
5. "Simpan Soalan". The status given to a new question and the redirect/flash are **UNOBSERVED** (Q: draft or approved?).
6. Edit `/admin/questions/{id}/edit` is MCQ-only (no type select), with "Buang tag DSKP".

**B. Import in bulk** (`/admin/questions/import`, "Import Soalan").
1. Download "Template CSV dengan contoh soalan" (link not fetched).
2. Choose `.csv`/`.txt` (UTF-8, max 5 MB). Required columns `question_text, option_a, option_b, correct_answer (A/B/C/D), subject_id, education_level_id`; optional `option_c, option_d, difficulty_level, marks, explanation`. Defaults (Subjek Lalai, Tahap Pendidikan, Kesukaran preset 2 "Mudah") fill empty columns.
3. "Mula Import". Footer: "Soalan disimpan sebagai draf". MCQ only.
4. "Sejarah Import" → HTTP 500 on live; result screen and flash UNOBSERVED.
5. Other doors in V1 (teacher side): teacher CSV import "Menunggu Semakan"; teacher paper submissions (3.1.F).

**C. Approve / reject / archive** (list `/admin/questions`):
1. Tick rows (selects page rows only) → bar "{n} soalan dipilih" → select "Pilih Tindakan": Luluskan (`approve`), Tolak (`reject`), Arkibkan (`archive`), Padam (`delete`) → "Laksanakan" → confirm "Adakah anda pasti mahu meluluskan/menolak/mengarkibkan/memadamkan {n} soalan?".
2. Show page `/admin/questions/{id}`: script `updateStatus()` to `pending_review` or `approved` (buttons not rendered in the observed state).
3. Status filter: Draf, Menunggu Semakan, Diluluskan, Ditolak, Diarkibkan. Row pill "Diluluskan"/"Arkib" + ACTIVE/INACTIVE.
4. Compliance filter: Verified, Pending Mapping, Quarantined, Rejected, Draft, Tiada Source PDF, AI Verified. Source filter: Textbook, DSKP, Trial, Skema.

**D. Quality and fixes**
- "Kualiti Soalan" dashboard: KPI "Jumlah Soalan", "Purata Skor", "Cemerlang (76-100)", "Perlu Tindakan Aktif (≤ 50)"; buckets 51-75, ≤50, "Legacy Generic"; table "Mengikut Subjek"; "Jalankan Audit Semula" recomputes the 0-100 score (formula UNOBSERVED).
- "Laporan Soalan": student reports (7 reasons). Reporting a MCQ deactivates it at once ("dinyahaktifkan sementara"); structured after 3 reports (copy; enforcement UNOBSERVED). Admin: Tandakan Selesai → `fixed`; Tolak & Aktifkan Semula → `dismissed` + reactivate; Nyahaktif Segera → `reviewed` + force deactivate. A fixed report on a removed question shows "Dikeluarkan".
- "Soalan Perlu Gambar Rajah": upload an image or dismiss the flag (6,144 in the badge).
- "Master Notes": AI misconception note per question: Approve, Regenerate, Clear Flag.
- "Penjelasan AI" card on the question page: "Jana Penjelasan AI" (`POST /admin/questions/{id}/generate-penjelasan-ai`, 5-15 s).

**E. Structured and PKSK**
- Structured questions are created in the teacher portal (`/guru/soalan-berstruktur/cipta`); the admin list `/admin/structured-questions` is read-only (button "Tambah Soalan" jumps to the teacher form).
- PKSK: `/admin/pksk/questions` (filters Bahagian A/B/C, Level T1/T4, Status Menunggu/Diluluskan/Ditolak; bulk Luluskan, Tolak, Padam; create/edit with domain and up to 6 options, any number correct) and `/admin/pksk/access` (grant package to user id, optional expiry, "Tarik" to revoke).

**F. Teacher paper submissions** (`/admin/question-submissions`, "Kertas Soalan Guru"): counters Jumlah, Pending, Processing, Selesai; download files; "Kemaskini" panel sets status `pending → processing → done | rejected` (any order) with "Nota admin" (≤1000 chars). There is no automated parser; the admin keys the questions in (INFERRED from "Admin extract soalan").

### 3.2 Teacher process

1. **Sumbang Soalan** (`/guru/soalan` → "Tambah Soalan Baru" or "Import CSV"):
   - Form: Tahap Pendidikan *, Mata Pelajaran *, Bab, Topik, Jenis Soalan *, DSKP mapping, "Soalan" (≤2000), image or "Galeri Rajah", answers by type, "Penerangan".
   - Submit "Hantar untuk Semakan" → admin review. CSV import: rows enter "Menunggu Semakan" (the template link `/guru/soalan/template` is dead on live).
   - Rewards: `coins_per_question = 10` ("Sumbang Soalan (+10 syiling)") and badge bonuses at thresholds; no +10 ledger row was seen (M14 Q5).
2. **Hantar Kertas Soalan kepada Admin**: Jenis Soalan (Soalan Umum, Trial Paper, Soalan DSKP, Buku Teks, Buku Latihan, Soalan Peperiksaan, Lain-lain), Matapelajaran, Tingkatan, Tahun, Disediakan Oleh, Catatan; rules: PDF (text, not scanned image), DOCX or XLSX, scheme mandatory, ≤5 files, ≤20 MB each. Admin processes (3.1.F).
3. **Cipta Soalan Berstruktur** (`/guru/soalan-berstruktur/cipta`): Subjek, Tingkatan, Aras KBAT (1 Mengingat ... 6 Mencipta), Bab/Topik, DSKP mapping, Jenis Tulisan, Template ("Eksperimen Sains" fixes 7 parts), Visibility, stimulus, sub-questions with marks and rubric; "Simpan Draf" or "Simpan & Terbitkan".
4. **Set Soalan** (`/guru/set-soalan/cipta`): Kelas *, Tajuk Set *, Penerangan, Kumpulan Set (first set = TOV baseline, later = AR progress), Had Masa, Had Percubaan, Status Draf/Jadual/Terbit (+ scheduled time) → "Cipta Set & Tambah Soalan". The question-adding step and student play are UNOBSERVED. Students see it at `/set-soalan-saya` only if they joined the class (`/kelas-saya`, 6-char code).
5. **Soalan & Rujukan** (`/guru/soalan-guru/cipta`): reference link with auto-embed (YouTube, Anyflip, Canva), subject, bab/topik, diagram, "Kelas Sasaran" (multi-class), 1+ MCQ; delete only (no edit).
6. **Misi Harian** (`/guru/misi-harian/cipta`): Nama Misi, Jenis Misi (Latih Tubi SPM / Tracking A / Soalan & Rujukan), Tarikh, Subjek, Bab, Bilangan Soalan (5-50), reward "3 syiling per soalan betul", optional reference; "Lancarkan Misi". No class selector (all of the teacher's students, INFERRED).
7. **Audio KBAT** (`/guru/audio-kbat/create`): 4 fixed sections (audio + transcript) and 30 MCQ.
8. **Review of the bank**: `/guru/databank` and the "Lapor Masalah Soalan" modal.
9. **Follow-up**: Command Center "Remedial" scans weak topics (<50% accuracy), "Jana" creates a remedial quiz for the student (scan returned HTTP 500 on live), progress at `/guru/remedial-progress`.

### 3.3 Student process per activity (step by step)

**Common entry**: login → `/dashboard` (greeting, free-trial card, daily quests, links) → sidebar "Pembelajaran". Class link: `/kelas-saya` → "Masukkan Kod Kelas" (6 chars) → "Sertai".

**Latih Tubi (F01)**
1. `/practice`: pick a subject card ("🧠 n soalan", "Mula Latihan →").
2. `/practice/{CODE}`: choose "Pilih Tahap Pendidikan" (Semua Tahap or Darjah 1-4), "Pilih Tahap Kesukaran" (Semua/Campuran or Level 1-5, live counts), "Bilangan Soalan" (5, 10, 15, 20). The "Ringkasan" card shows "Soalan Tersedia"; "Soalan Tidak Mencukupi" disables the start.
3. "Mula Kuiz" → quiz (UNOBSERVED; INFERRED same as F03: one question per screen, "Semak Jawapan", feedback, "Soalan Seterusnya →", last "Lihat Keputusan 🏁", "Lapor Soalan").
4. Results (INFERRED as F03).

**Soalan by Chapter (F02)**: `/practice/chapter` → subject → level select (Darjah 1-4) → open bab card → "5 soalan"/"10"/"15"/"20" → quiz. Locked bab chip "Kunci bab sebelumnya"; unlock at all-answered + ≥70%.

**Soalan Aku Salah (F03)** (OBSERVED from source)
1. `/practice/revision`: banner "Soalan Aku Salah", pill "{n} soalan perlu diulang kaji", subject cards "n soalan salah".
2. Open a subject: page POSTs `start-revision-quiz {subject_id, question_count:20}`; loading "Memuat Soalan Ulang Kaji...".
3. Per question: header "Ulang Kaji — {Subjek}", "Soalan i daripada n", "Masa" timer, chips ("Mode Ulang Kaji — soalan ini pernah dijawab salah", "Salah n x", "Mengikut DSKP"/"Latihan Tambahan", "Soalan oleh: {contributor}"), choose option → "Semak Jawapan" (server check) → green/red, "Betul! Kali ini berjaya!"/"Masih belum tepat", "Penjelasan:", coin animation +1 syiling +10 mata → "Soalan Seterusnya →" → "Lihat Keputusan 🏁".
4. "Lapor Soalan" modal (reasons, comment ≤500, "Hantar Laporan").
5. Results: "Keputusan Ulang Kaji", score, % colour, message ("Sempurna! ..."), "Masa diambil", "Ganjaran Anda", "Semakan Semula Jawapan", buttons "Ulang Kaji Lagi", "Senarai Subjek".

**Soalan Berstruktur (F04)**: `/latihan-berstruktur` → filters → card "Mula →" → `/latihan-berstruktur/{id}/jawab` (answer, marking and feedback UNOBSERVED).

**SPM modes (F15-F20)**: `/spm` hub ("Persediaan SPM", 4 module cards) → choose Databank (subject + set size), Latih Tubi SPM (Tetapan Kuiz), Tracking A (subject → set), Subjektif (subject → structured set), or Mock (subject + Paper 1/2 → "🎯 Jana Mock SPM"). Each run is logged in `/spm/history`. Mock result shows grade, weak topics and per-question review.

**PKSK (F24)**: `/pksk` (format A/B/C) → level card "AKTIF" → level dashboard → "Latih Tubi Domains" → domain "Latih Sekarang", or "Peperiksaan Penuh" (30 A + 70 B + 1 C), or "Sejarah" (HTTP 500). All answering is UNOBSERVED.

**Set Soalan Guru / Misi / Remedial (F25, F09, F08)**: appear on `/set-soalan-saya`, `/misi-harian`, `/remedial/saya` only after a teacher creates them for the student's class; play flows UNOBSERVED.

**Games (F30-F33)**: `/permainan` hub (17 cards) → game → picker Darjah 1-4 → play; multiplayer: create/join with 6-character room code; Battle: choose type and subject → Quick Match → poll every 3 s up to 120 s → match.

**After any activity**: gamification result (syiling, kombo, mata, baki), history entry, updated mastery.

## 4. OUTCOMES

### 4.1 What an answered question writes (V1)

- **Session** (QuizSession): id, user, subject, `mode` (random / chapter / revision / subjective plus SPM types `past_year`, `latih_tubi`, `ramalan` in the same store; M05 URS XL-03), level, difficulty, chapter, counts, score, correct, wrong, time_spent, `coins_earned`, `points_earned`, timestamps. Observed history: the 4 SPM sessions show as badge "Latihan".
- **Answer log** (QuizAnswer): session, question_id, selected option, `is_correct`, answered_at; analytics also need subject, DSKP SP and the answering student's class.
- Derived stores: revision queue (wrong, with wrong_times, resolved on a later correct answer), ChapterProgress, SubjectMastery (correct, answered, level, XP multiplier), SPM targets, DailyQuest progress, wallet ledger.
- Server returns `gamification {coins_earned, streak_count, points_earned, total_balance}` at `submit-quiz`.

### 4.2 Which outcome screen consumes which activity (matrix)

✓ = consumes (OBSERVED or SOURCE), ~ = INFERRED, ✗ = observed NOT to consume, ? = UNOBSERVED.

| Activity data | Aku Salah / Pembetulan | Penguasaan | XP, syiling, kombo, quests | Kemajuan / Sejarah | Prestasi 360 | Analitik Adaptif | Analisa Item | Headcount auto | Monitoring / Kirkpatrick T2-T4 | Kehadiran | Leaderboards | Target SPM |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Latih Tubi, Chapter | ✓ | ~ | ✓ | ✓ | ~ | ~ (needs DSKP tag) | ~ | ? | ✓ | ✓ | ✓ | ✗ (SPM only?) |
| Soalan Aku Salah | ✓ (removes on correct) | ~ | ✓ ("seperti latihan biasa") | ✓ | ~ | ~ | ~ | ? | ✓ | ✓ | ✓ | ? |
| SPM Databank / Latih Tubi SPM | ✓ (wrong answers enter the queue, INFERRED) | ? | ✓ (flat 1 syiling per correct) | ✓ (Sejarah Latihan) | ✗ (admin: 0 sessions) | ? | ? | ✓ (copy: "SPM latih tubi") | ✓ | ✓ | ✓ | ✗ (admin: "Belum mula" with 84 answers) |
| Tracking A | ~ | ? | ✓ | ✓ | ? | ? | ? | ✓ (copy) | ✓ | ✓ | ✓ | ? |
| Structured / Subjektif | ? | ? | ~ | ~ ("Skor Terbaik") | ? | ? | ✗ (MCQ-based) | ✓ (Tracking A Bahasa) | ✓ (Struktur split) | ✓ | ? | ? |
| SPM Mock | ? | ? | ? | ✗ (Mock not in `/spm/history`) | ? | ? | ? | ? | ? | ? | ? | ? |
| PKSK | ? | ? | ✓ `pksk_reward_correct` = 5 per tier (setting) | ? | ? | ? | ? | ✗ | ? | ? | ? | ✗ |
| Teacher set / mission | ~ | ~ | ✓ mission = 3 syiling per correct | ~ | ~ | ~ | ~ | ? | ~ | ✓ | ~ | ? |
| Games / Battle | ✗ | ✗ | XP only (`games_award_syiling` = 0); old rows 5-50 syiling per play/win | ✗ | ✗ | ✗ | ✗ | ✗ | Battle/Permainan counted as activity types in Laporan Statistik | ? | Battle ranking, school ranking | ✗ |
| Question report | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |

### 4.3 Outcome details and rules

**Scores and records**
- Result % colour: green ≥80, yellow 50-79, red <50. History grade "💪 Cuba Lagi" seen for 0-35%; other labels UNOBSERVED. Session cards carry score "c / n", time "MM:SS", syiling.
- `/practice/progress` periods 7 / 30 / 90 / Semua: Soalan Dijawab, Ketepatan Keseluruhan, Sesi Latihan, Masa Berlatih; "Trend Ketepatan" chart; "Topik Perlu Perhatian" lists weak subjects (not topics, D-9).
- SPM history rows: % tile, type badge ("Tahun Lepas", "Latih Tubi"), "c/n betul", "+n 🪙" (coins = correct count).

**XP and gamification (M14)**
- Coins: `flat_quiz_reward` = 1 per correct answer ("tiada beza difficulty"); older rows paid 2-3. Ledger text examples: "SPM Tahun Lepas: 18 betul — 90%" +18, "Latih Tubi: 5 betul" +5.
- Mastery multiplier "1.05x" at subject L2 (whether on coins or XP UNOBSERVED; M05 shows "x1.05 XP").
- Streak (kombo): +2 `daily_login`, +7 `spm` once a day; milestones 3 days +25, 10 days +50 (OBSERVED rows).
- Daily challenges (10 active, ids 1-10): types `quiz_count`, `accuracy`, `topic_variety`, `streak`, `time_spent`; e.g. "Rajin Berlatih" 3 quizzes → 15 syiling + 10 XP ... "Cabaran Kilat" 20 correct in a session → 40 + 35.
- Tiers by balance: Gangsa 0, Perak 500, Emas 2,000, Platinum 5,000. Titles by lifetime syiling (Permulaan <300, Pelajar from 300, ... Mitos ≥10,552, cut-offs INFERRED). Level is a stored value; no formula reproduces the rows (Q4).
- Games: `games_award_syiling` = 0 (XP only) yet result screens still display syiling (D-M16-24). Papan Bijak `board_game_reward_correct` 5, win 25.
- Teacher contribution: 10 syiling per question, badge bonus at thresholds; teacher ledger shows badge rows but no +10 rows (Q5).
- Token conversion and cash: out of scope here (M14/M15).

**"Soalan Aku Salah" and remedial feeds**
- The revision queue = questions answered wrong, ordered by times wrong; a correct answer removes them; 20 per session; mixed MCQ.
- "Pembetulan": per month and subject, "Sebelum" (first-attempt accuracy), "Selepas" (after correction), "Peningkatan".
- Remedial test: teacher Command Center scans topics with accuracy <50% → "Jana" → pelajar `/remedial/saya` and teacher `/guru/remedial-progress` (stat cards Jumlah Set, Selesai, Pelajar, Purata Peningkatan). Both are empty on V1 for the admin account and the scan returned HTTP 500.
- Heatmap Topik Lemah and Analitik Adaptif "Latihan Fokus" links go back to practice (`/practice/{CODE}/quiz?level=&dskp_sp_id=&count=`, count = min(available, 25)).

**Teacher analytics**
- Analisa Item (`/analisa-item/kelas/{id}`): per question p = correct ÷ attempts; "Ketepatan" p×100; difficulty index 1 − p; Tahap: Sukar index > 0.70, Sederhana 0.30-0.70, Mudah ≤ 0.25 (cut-offs INFERRED); expanded row: "Jawapan Betul", "Jawapan Salah Popular (Nx dipilih)", "Pelajar Yang Salah" chips linking to Prestasi 360; summary cards Mudah/Sederhana/Sukar with %. Discrimination D = p(top 27%) − p(bottom 27%) with guide ≥0.40 Sangat Baik, 0.30-0.39 Baik, 0.20-0.29 Sederhana, <0.20 Lemah; needs ≥4 students with finished sessions ("Data Tidak Mencukupi"). Sort and search boxes are not bound to the rows (D-15).
- `/guru/analisis-item` (legend ">70% Mudah, 40-70% Sederhana, <40% Sukar; Diskriminasi >0.3 = baik, <0 = semak semula") is always empty for the admin.
- Class performance: `/prestasi/kelas/{id}` (class trend, headcount on/below track), Analitik Kelas (risk level critical/high/medium/low), Laporan Statistik (activity split per type, trend).
- Kehadiran Digital: "Hadir" ⇔ ≥5 answers that day.
- `/guru/perbandingan-kelas` = HTTP 500 and `/guru/laporan-mingguan-kelas` = 403 on V1; contents UNOBSERVED.

**Prestasi 360 / student performance**
- Cards: Sesi Kuiz, Ketepatan, Soalan Dijawab, Masa Belajar; "Headcount — Prestasi SPM" chips TOV → OTR1..n → ETR; "Penguasaan Subjek"; "Aktiviti" (Kombo Hari, Rekod Terbaik, Koin, Hari Latihan); 90-day activity map; "Topik Perlu Perhatian" with "Fokus n" button; "Cadangan" (rules INFERRED: inactivity days, weak subject <~70%, weakest topic).
- Grades: A+ 90-100, A 80-89, A- 70-79, B+ 65-69, B 60-64, C+ 55-59, C 50-54, D 45-49, E 40-44, G <40 (S15 OBSERVED partly); GPS points A+ 0 ... G 9; GPS = mean over headcount entries (3.45 observed).
- Contradiction: Prestasi 360 shows "0 Sesi Kuiz" for the admin while Kemajuan Saya shows 119 answered and 4 sessions (D-10).

**Kirkpatrick** (read-only on V1; admin view)
- T1 Reaksi: monthly feedback `/maklum-balas` (not question data).
- T2 Pembelajaran: Soalan Dijawab 306,133, Ketepatan 82.8%, Skor Purata 80.3%, Sesi Selesai 20991/20991; subject bars with status Mastered ≥80 / Developing 50-79.9 / Beginning <50; Learning Gain needs pre/post test (not started; Hake g = (Post − Pre) / (100 − Pre)).
- T3 Tingkah Laku: engagement bands by questions answered per pupil: Champion >50, Konsisten 20-50, Berkembang 5-20, Minimum <5, Tidak Terlibat 0; weekday × hour heat map; teacher login ratio 277/522.
- T4 Hasil: Headcount GPS, grade distribution, "Anggaran Gred" from accuracy (A+ ≥90 ... G <30) and "ALESA Predictive Grade" = 0.4·Ketepatan + 0.2·Konsistensi + 0.2·Trend + 0.2·Volume.
- Rantaian Impak and Intervensi link the four levels.

**Leaderboards and ranking**
- `/leaderboard`: ranked by coins earned in period (all / week default / month), ≤50 rows, own rank shown even if below.
- `/ranking`: scope nasional / negeri / daerah / sekolah, filters subject and tingkatan; columns Betul, Tepat.
- `/gamification/leaderboard`: all students by `total_syiling_earned`.
- Pertandingan Mingguan: top 20 of the week by correct answers (INFERRED from M05 sessions), prizes +100 / +50 / +25.
- `/battle/ranking-sekolah` (10,218 schools) and Sekolah Bersaing (weekly job) rank schools by battle score / % aktif + streak.

**PKSK mastery**
- Level dashboard: "Skor Kesediaan Anda" % with letter grade (E at 0%), "Jumlah Peperiksaan", "Purata Bahagian B", "Penguasaan Domain" bars for 13 Bahagian B domains; full list of domains on `/domains` (A and C included). Formula and grade bands UNOBSERVED (all zero on V1).
- Battle accepts a PKSK domain and level as a match type.

### 4.4 Connections the V3 build must keep (and V1 contradictions to avoid copying blindly)

1. One answer log drives practice history, mastery, revision queue, XP, Prestasi 360, Analitik Adaptif, Analisa Item, Headcount auto, Monitoring, Kirkpatrick, attendance and leaderboards. In V1 the same admin shows different numbers on different screens (Kemajuan 119 answered vs Prestasi 360 0 sessions; Penguasaan BM 46/94 vs Kemajuan 32/79; Target SPM "Belum mula" despite 84 SPM answers). V3 needs one definition per figure.
2. DSKP tag on the question is the key for Analitik Adaptif and Peta DSKP; 14,933 untagged questions cannot feed it.
3. Question report → deactivate → revision queue and drills must skip inactive questions.
4. Class membership (`kelas-saya` join code) links a student's answers to the teacher's analytics, sets, missions and remedial.
5. PKSK sits in the same store but out of the admin list, with its own access grants (T1, T4, Kombo).
6. V2 difference to remember: V2 splits the data in two banks (legacy and canonical) and writes canonical sittings as one aggregate `practice_sessions` row so analytics still work (`syncAnalytics`).

## 5. NUMBERS observed on V1

All OBSERVED on the live pages unless stated, platform admin account, 2026-09-25/26.

### 5.1 Bank and authoring

| Item | Value | Page |
|---|---|---|
| Admin list total (no filter) | 465,278 questions (`approved` 145,689; `archived` 319,589; draft, pending_review, rejected 0) | `/admin/questions` |
| Header "Jumlah" | 439,478 soalan | same page (does not equal list total) |
| Per core subject (total / lulus) | BM 32,905 / 13,081; BI 18,902 / 8,879; Matematik 38,504 / 16,645; Sains 42,335 / 15,067; Sejarah 20,414 / 10,301; Pend. Islam 27,962 / 10,455; Pend. Moral 38,481 / 15,996 | same |
| Elective examples | Add Maths 7,580 / 2,579; Fizik 2,818 / 2,185; Kimia 7,303 / 2,670; Biologi 14,001 / 4,580; Geografi 21,318 / 6,886; PSV 48,360 / 4,910; four subjects with 0 | same |
| Compliance | quarantined 124,299; pending_mapping 2,756; draft 27,652; rejected 0; Tiada Source PDF 128,372 | same |
| DSKP | untagged 14,933 | same |
| Source | trial 19,219; dskp 35,401; marking_scheme 199 | same |
| Difficulty 1 (Sangat Mudah) | 45,686; level 1 (Darjah 1) 14,778 | same |
| Quality dashboard | Jumlah 466,041; Purata Skor 94.1; Cemerlang 146,275; ≤50: 2; 51-75: 749; Legacy Generic 373 | `/admin/questions/quality` |
| Question reports | 10 (Menunggu 2, Disemak 3, Diperbaiki 5, Ditolak 0) | `/admin/question-reports` |
| Structured bank | 4,064 (admin, all "Published"); 4,061 (teacher list, 204 pages). By subject: BI 774, BM 560, Biologi 219, Ekonomi 42, Fizik 246, Geografi 21, Kimia 232, Matematik 299, Add Maths 256, Perniagaan 763, Prinsip Perakaunan 76, Sains 204, Sains Komputer 22, Sejarah 328, Tasawwur 22 | `/admin/structured-questions` |
| Teacher paper submissions | 4 rows: Pending 0, Processing 3, Selesai 1 | `/admin/question-submissions` |
| Diagram audit | badge 6,144 | user sidebar |
| Teacher's own questions | 16,817 (Diluluskan 16,817, Menunggu 0, Digunakan 0); dashboard says 20,719 contributed / 19,361 approved (different definition, OQ-05); subjects: Matematik 3,287; Pend. Islam 2,516; BM 2,342; BI 2,214; Sains 1,935; Pend. Moral 1,823; Sejarah 795; Lain 763; PSV 510; Syariah 363; Geografi 269 | `/guru/soalan` |
| Contributor badge tiers | 10, 100, 500, 1,000, 2,500, 5,000, 10,000, 50,000 | same |
| Teacher databank | 21,033 soalan, 18 subjek aktif; BM 6,048 (5,918 objektif + 105 subjektif = 6,023, mismatch) vs 514 on pelajar Databank | `/guru/databank` |
| Audio KBAT | 0 sets | admin/teacher |
| PKSK | 763 (A 160, B 573, C 30); approved 763; T1 383, T4 380; 15 domains (1 + 13 + 1); filtered: T1+B 288, search "inovasi" 13; access grants: 3 Kombo | `/admin/pksk/questions` |

### 5.2 Practice and SPM

| Item | Value | Page |
|---|---|---|
| Subjects | 31; core 7; chapter mode 10 subjects (BM 18 bab / 4,833; BI 14 / 3,521) | `/practice`, `/practice/chapter` |
| Free trial | 50 questions; admin "Baki 0 / 50" | dashboard |
| Admin practice data | 72 wrong (BM 46, SEJ 26); mastery BM L2 46/94 (48.9%), SEJ L1 14/40 (35%); progress "Semua" 119 answered, 38.7%, 4 sessions, 4 min | M05 |
| Daily quests | 10, total coin reward 232 | dashboard |
| SPM hub | Jumlah Soalan 20,529; Subjek SPM 25; Tahun Tersedia 0; Tracking A 1,797; Databank 14,673; Subjektif 4,059 sets | `/spm` |
| Databank counts | BM 514; BI 1,114; Matematik 1,681; Sains 2,076; Sejarah 1,539; Biologi 1,999; Ekonomi 1,986; Fizik 1,261; Geografi 1,228; Kimia 1,009 (18 cards) | `/spm/tahun-lepas` |
| Latih Tubi SPM targets | 40 (MATH, SCI, SEJ, GEO, BIO, CHEM, PHY, PI, PM, EKON, BA, PSI), BM 34, BI 36, ADDMATH 20; locked card BA "0 soalan" | `/spm/latih-tubi` |
| Tracking A | Objektif: 3 subjects, 18 sets, 747 questions; readiness chips Set Bersih 1, Bank Besar 1, Locked 58; Bahasa: BM 559 sets, BI 773 (1,332) | `/spm/ramalan` |
| Subjektif cards | BI 773; BM 559; Matematik 298; Sains 204; Sejarah 328; Biologi 217; Ekonomi 42; Fizik 246; Geografi 21; Kimia 232; Add Maths 256; ... | `/spm/subjektif` |
| SPM history (admin) | 4 sessions, 21.8% average, 26 syiling, 84 answered | `/spm/history` |

### 5.3 Analytics and gamification

| Item | Value | Page |
|---|---|---|
| Item analysis class 228 | 93 pelajar, 596 soalan diuji; Mudah 381 (64%), Sederhana 78 (13%), Sukar 137 (23%); 750 classes in picker | `/analisa-item/kelas/228` |
| Laporan Statistik | Pernah Login 54% (1708 / 3152, "1444 belum pernah login" vs panel "(0)") | `/guru/laporan` |
| Monitoring | 57 schools; 33 with T4/T5 pupils; engagement 35.2% (1,462 / 4,158); 472,261 answered; teachers 277 / 522 = 53.1% | `/guru/monitoring` |
| Kirkpatrick T2 | 306,133 answered; 82.8% accuracy; 80.3% mean score; 20,991 sessions all finished; 26 subjects | `/admin/kirkpatrick/learning` |
| Kirkpatrick T3 | active 946-951 of 4,158; bands 513 / 259 / 169 / 5; Tidak Terlibat 3,207 | `/admin/kirkpatrick/behavior` |
| Headcount GPS | 3.45 (744 entries) on school dashboard; T4 GPS 4.30 (2025), 180 candidates, pass rate 90.6% | M08 / M12 |
| Gamification | 2,255 active pupils; tiers Gangsa 0, Perak 500, Emas 2,000, Platinum 5,000; 534 conversions; 10 challenges | `/admin/gamification` |
| Battle | 10,218 schools listed; 7 schools with battles (scores 738, 519, 367, 367, 340, 303, 87); Sekolah Bersaing 49 schools | M16 |

Note on contradictions inside V1 numbers: "Jumlah 439,478" vs 465,278 vs 466,041; teacher dashboard 20,719 vs 16,817; BM databank 514 vs 6,048; 4,061 vs 4,064; Pernah Login card vs panel. Record them as observed; do not seed the same contradiction in V3.

## 6. GAPS: live check checklist for a later read-only V1 login

Needs a throwaway pelajar, guru and admin sekolah account (or permission to practise on the admin account), because starting a session writes data. Tick when done.

Student activities
- [ ] Random drill `/practice/{CODE}/quiz`: one-question layout, timer direction, skip/back, check-answer endpoint, results screen, "Ganjaran Anda", review list (LS-1, LS-2).
- [ ] Chapter drill quiz and results; completed-bab card; what happens after all bab done (LS-3, Q-M05-5).
- [ ] Free-trial gate at 0/50: redirect to `/pricing`, block, or allow (LS-8, Q-M05-2).
- [ ] Structured answer page `/latihan-berstruktur/{id}/jawab`: input type, auto-marking engine, feedback, score (LS-7, Q-M05-9).
- [ ] Revision queue rules in practice: does a wrong SPM answer enter it; does a correction feed Pembetulan (Q-M05-10, OQ-9).
- [ ] Latihan Subjektif route `/practice/{CODE}/subjektif`: exists at all?
- [ ] SPM quizzes `/spm/tahun-lepas/{CODE}/quiz`, `/spm/latih-tubi/{CODE}/quiz`, Tracking A set run: layout, timer, "Penjelasan:", result and rewards.
- [ ] SPM Mock: `/spm-mock/{id}` layout, number/mix of items, timer direction and duration, auto-submit, what "Kalau pause, score akan jejas" does, grading rule (L-8, L-10, OQ-M06-05).
- [ ] Tracking A Bahasa and Subjektif: are they marked by system or by teacher ("disemak oleh guru")?
- [ ] PKSK with a granted account: domain practice, full exam (timer, sections, readiness formula, grade bands), history (HTTP 500), student without grant (locked card, gate, upsell) (L-1 to L-4, OQ-1 to OQ-8).
- [ ] How the M02 flag `has_pksk_subscription` (RM20) relates to `pksk_access` grants (OQ-1).
- [ ] Set Soalan Guru student list and play flow; Had Masa and Had Percubaan enforcement; TOV/AR group behaviour.
- [ ] Teacher missions and remedial tests as seen by the student (cards, statuses, actions) (LS-12).
- [ ] Audio KBAT player with an approved set.
- [ ] Games: pool rules (which status, level scope), round flow, scoring for the six multiplayer games, Jutawan Ilmu, Battle rounds and per-question timer, Cabar Kawan; whether `permainan` and `games_award_syiling` still apply today.
- [ ] Mastery thresholds L4-L10 and XP per level; kombo multiplier steps (Q-M05-4, Q4).
- [ ] Target SPM data source and predicted-grade formula (LS-10).
- [ ] Dashboard conditional sections (weak-topic alert, pending assignments, teacher quiz sets) (Q-M05-8).

Admin and bank
- [ ] Status given to a new question on `/admin/questions/create`; post-submit redirect and flash; validation messages (Q-M04-1, 2).
- [ ] CSV import result and "Sejarah Import" (HTTP 500); template contents.
- [ ] Bulk action result messages; whether delete is soft or permanent.
- [ ] How non-MCQ questions (true/false, short answer, essay) show on the show/edit pages and in student activities.
- [ ] "Used question" statistics card and Quick Actions on the show page.
- [ ] Quality score formula and the Lemah/Kritikal boundary; what sets `needs_diagram`.
- [ ] Question-report enforcement: MCQ immediate deactivation; structured "after 3 reports".
- [ ] Master Notes flagged/approved lifecycle.
- [ ] Teacher contribution review: who approves, what status Sumbang Soalan and CSV rows start with, and why teacher view shows Menunggu 0.
- [ ] Teacher paper submission: what the admin actually does after "processing" (any import tool?).
- [ ] Audio KBAT admin list rows and approval actions.
- [ ] Which statuses each student activity reads (BR-M04-03 is a rebuild rule, not seen directly): `approved` only, or also others for games and Set pickers (V2 uses `!= menunggu` for games and set picker).

Teacher
- [ ] Add-questions step after "Cipta Set & Tambah Soalan"; edit and publish; `GET /guru/set-soalan/{id}` is 405.
- [ ] Teacher scope of the structured list (own vs all) and Databank.
- [ ] Mission list, progress and delete; the `youtube` mission type fix.
- [ ] Command Center: Remedial scan (HTTP 500), Evaluate, Badges, Ramalan SPM with data.
- [ ] `/guru/perbandingan-kelas` (HTTP 500) and `/guru/laporan-mingguan-kelas` (403) contents.
- [ ] Analisis Item populated for a teacher class (`/guru/analisis-item`), and how it relates to `/analisa-item/kelas/{id}`.
- [ ] Sort and search boxes on Analisa Item (not bound on V1).

Outcomes and roles
- [ ] Why Prestasi 360 shows 0 sessions while Kemajuan shows 119 answered (D-10); which answer store each screen reads.
- [ ] Which activities feed Headcount auto, Penguasaan, Target SPM, Kehadiran, leaderboards.
- [ ] Amaran Awal risk rule; Monitoring "anomaly flag" speed threshold.
- [ ] Admin Sekolah and PPD/JPN views: DSKP Heatmap, Laporan Bulanan, Statistik Penggunaan, Laporan Aktiviti (302/404 for the admin account) (OQ-M27-01).
- [ ] Syiling per correct today (flat 1) vs old 2-3; whether XP +10 per correct is real; whether teacher +10 syiling is paid.
- [ ] Roles: Ibu bapa and Penaja question views; whether a guru can use Latih Tubi.

## Appendix A. Biggest V1 vs V2 differences (summary)

1. **Banks**: V1 has one MCQ store (465k, statuses approved/archived only) + structured + PKSK in the same store. V2 has two coexisting banks (legacy `questions`/`structured_*`/`pksk_questions`, and canonical `exam_*` tree with parts, stimuli, answer keys) and a bridge (`exam:unify`).
2. **Whole-paper exams**: V1 has no admin-curated real-format paper engine; its SPM Mock is generated. V2 has Simulasi Peperiksaan / Bijak SPM (fixed papers, cover, autosave, countdown, server marking, scheme, self-mark, "Cuba Lagi") and Kertas Subjektif page-image papers.
3. **Admin intake**: V1 = Tambah Soalan form + CSV + bulk status bar + teacher file submissions keyed by hand. V2 = Studio wizard (draft → Hantar untuk semakan → Terbitkan with PublishValidator), DOCX/OCR import with review, Set Builder, blueprints ("Kontrak Simulasi"); legacy form redirects to Studio; four gates and feature flags.
4. **Marking**: V1 revision/drill checks each answer on the server (`check-answer`); V2 legacy MCQ drills mark in the browser (answer flag in page JSON) and post a result; V2 canonical papers mark on the server at submit. Games are browser-marked in both.
5. **Availability**: V2 production has `latih-tubi`, `permainan` and `kertas-subjektif` flags OFF (Latih Tubi, Soalan by Chapter "Mula", Pembetulan and Peta Belajar links dead-end); V1 had them reachable.
6. **PKSK**: V1 has levels, domains, full exam, readiness score, history (500). V2 has a listing only; answering not found. Counts 763 vs 748.
7. **Teacher sets**: V1 form has class, TOV/AR group, time limit, attempts, scheduling. V2 form has title, type, draf/diterbitkan and a 50-row picker; 0 sets in production.
8. **Analytics, Kirkpatrick, Headcount, Amaran Awal, Prestasi 360**: described in depth for V1; not covered by the V2 mechanism doc (check the V2 inventory before assuming).
9. **Gamification of drills**: both reward per correct answer; V2 result includes letter grade and "Ganjaran Anda".
10. **Progressive chapter unlock (70%)** and **Darjah 1-4-only setup** are V1 behaviours; V2 setup offers all levels and has no documented unlock.

## Appendix B. Source index

- Bank/admin: `discovery/M04-question-bank.md`; `requirements/srs/M04-question-bank.md` (BR-M04-01..).
- Practice: `discovery/M05-practice.md`; SPM: `discovery/M06-spm.md`; PKSK: `discovery/M07-pksk.md`.
- Performance: `discovery/M08-student-performance.md`; teacher: `discovery/M10-teacher-class.md`, `M11-teacher-analytics.md`; Kirkpatrick: `M12-kirkpatrick.md`.
- Gamification: `M14-gamification.md`; games: `M16-battle-games.md`; content/Audio KBAT: `M09-content.md`; AI heatmap: `requirements/urs/M25-ai-centre.md`; school admin: `M27-school-admin.md`; Cikgu Alesa: `M13-cikgu-alesa.md`.
- Roles: `requirements/role-access-matrix.md`; decisions: `TRACKER.md` D7, D9, D11, D12, D24.
- Cross-module: `qa/audit/cross-module-logic-M08-M11.md`.
- V2: `discovery/cloud-student-mechanism.md`.
