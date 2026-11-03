# R1 User Requirements Specification (URS)

**Slug:** `r1-prd-devplan`. **Status:** For user review (G1). **Date:** 2026-11-04. **Owner:** Product Analyst.
**Position in the document set:** [00-index](00-index.md) → [01-product-overview](01-product-overview.md) → **02-urs (this file)** → SRS per portal ([10](10-murid.md), [20](20-guru-admin-sekolah.md), [30](30-admin-pusat.md)) → [40](40-cross-cutting.md) → 50 data model and ERD → 60 API contract → [plan](../../plan/r1-development-plan.md) → [traceability](../../plan/r1-traceability.md).

## 0. How to read this file

- A URS says **what a user must be able to do and why**. It does not say how. The "how" (screens, exact BM copy, rules, states) is in the SRS FRs and ACs it points to.
- ID format: `URS-MUR-nn` (pupil), `URS-GUR-nn` (teacher), `URS-AS-nn` (school admin), `URS-ADM-nn` (central admin), `URS-ALL-nn` (all roles; cross-cutting).
- **Matrix row** = the row number in `docs/Matriks-Akses-Peranan .xlsx` (sheet "Matriks Akses"; A1–A5 are the account rows). `1.0` = ticked in the "requirement 1.0" column of that role. `1.0 (linked)` = not in the 1.0 column but a 1.0 screen links to it, so it ships with 1.0 (D106). `Later` = rest of the matrix, delivered after the 1.0 columns, same bar (D100). `Feed` = an admin capability that supplies a matrix module.
- **Satisfied by** lists the SRS requirement IDs exactly as written in the SRS. Notation: `FR-MUR-2-1..11` means FR-MUR-2-1 to FR-MUR-2-11; `FR-ADM-Q04.*` means every FR of screen R1-ADM-Q-04 (FR-ADM-Q04.1, Q04.2, …). Each FR has the matching AC with the same number (`AC-…`), listed in the SRS.
- The pupil, teacher, school-admin and admin parts of the SRS are [10-murid.md](10-murid.md), [20-guru-admin-sekolah.md](20-guru-admin-sekolah.md) and [30-admin-pusat.md](30-admin-pusat.md). Cross-cutting rules (FR-X…, NFR-…) are in [40-cross-cutting.md](40-cross-cutting.md).
- Every user requirement applies D100 (fully working, no placeholder), D72/D96/D101 (Tingkatan 1–5 only, T1–T5 served), D106 (no dead link) and the responsive rule (URS-ALL-01) even where not repeated.

---

## 1. Murid (pupil)

### 1.1 Account and shell

| ID | User requirement | Matrix row | Priority | Satisfied by |
|---|---|---|---|---|
| URS-MUR-01 | As a pupil I can see my profile (identity, coins, streak, level, badges, 30-day calendar, last 10 sessions), write my bio and ambition, and copy a public profile link, so that I can track myself and share progress without exposing private data. | A1 | 1.0 P1 | FR-MUR-A1-1..8 |
| URS-MUR-02 | As a pupil I can see my account details read-only, change my password and keep my "Mod Rohani" preferences (a password has at least 8 characters; I cannot change my Tingkatan, school or role myself), so that I can keep my account safe. | A2 | 1.0 P1 | FR-MUR-A2-1..6 |
| URS-MUR-03 | As a pupil I can read Panduan (steps and FAQ for pupils) and see the support contact, so that I can solve simple problems myself. | A3 | 1.0 P2 | FR-MUR-A3-1..4 |
| URS-MUR-04 | As a pupil I can log out in one tap at any screen width, so that nobody else can use my session on a shared device. | A5 | 1.0 P0 | FR-MUR-A5-1..3, FR-MUR-SH-6 |
| URS-MUR-05 | As a pupil I get one menu (sidebar, drawer, search) in a fixed order where every item opens a working screen and nothing from another role or from a hidden module appears, so that I never meet a dead end. | all rows | 1.0 P0 | FR-MUR-SH-1..5, FR-MUR-SH-7..9, FR-MUR-SH-11, FR-MUR-SH-12 |
| URS-MUR-06 | As a pupil I can read all text on my phone without zooming, so that I can study comfortably. | all rows | 1.0 P0 | FR-MUR-SH-10, AC-MUR-RS-1..18 (SRS 10 §4.9), FR-X6-1..5 |

### 1.2 Home and performance (Dashboard, Headcount, Prestasi, Analitik, Analisa Item, Heatmap, Remedial)

| ID | User requirement | Matrix row | Priority | Satisfied by |
|---|---|---|---|---|
| URS-MUR-07 | As a pupil I get a start page with greeting, active package, streak ("Kombo") and warning, five key figures, daily missions and mood check-in, so that I know where I stand today. | 2 | 1.0 P1 | FR-MUR-2-1..5 |
| URS-MUR-08 | As a pupil I see which topics to strengthen, which subjects I can practise (counts equal the Latih Tubi counts), the newest questions, platform statistics and the latest articles, so that I can choose my next practice. | 2 | 1.0 P1 | FR-MUR-2-6..11 |
| URS-MUR-09 | As a pupil I can see the targets my teacher set (TOV, RS) against my own achievement (AR) with forecast and checkpoints, so that I know whether I am on track, using the same single Headcount computation (HC-SPEC) as my teacher. | 3 | 1.0 P0 | FR-MUR-3-1..9 |
| URS-MUR-10 | As a pupil I open Prestasi and see only my own performance (accuracy, sessions, trend, activity map, weak topics, advice, subject mastery), computed from every activity I did (one answer store) and never school figures, so that my data is private and useful. | 4 | 1.0 P0 | FR-MUR-4-1..12 |
| URS-MUR-11 | As a pupil I can see my mastery of each Standard Pembelajaran (SP) per subject and start a focused drill on a weak SP, so that I can improve exactly where I am weak. | 5 | 1.0 P1 | FR-MUR-5-1..7 |
| URS-MUR-12 | As a pupil I can review the items I answered wrongly or only sometimes right, per subject, with the question, figure and scheme, and start a revision drill, so that I learn from mistakes. | 6 | 1.0 P0 | FR-MUR-6-1..9 |
| URS-MUR-13 | As a pupil I can see a heatmap of my accuracy per chapter and open practice for a weak chapter, so that I find weak topics at a glance. | 14 | 1.0 P1 | FR-MUR-14-1..6 |
| URS-MUR-14 | As a pupil I can see subjects where I need remedial work, start a remedial drill built from my wrong answers and see my before and after accuracy, so that I recover weak subjects. | 12 | 1.0 P1 | FR-MUR-12-1..6 |

### 1.3 Practice and exams (Latih Tubi, Soalan by Chapter, SPM, Soalan Berstruktur, Laporan Soalan)

| ID | User requirement | Matrix row | Priority | Satisfied by |
|---|---|---|---|---|
| URS-MUR-15 | As a pupil of Tingkatan 1 to 5 I can practise any subject in Latih Tubi (choose subject, level, difficulty, 5/10/15/20 questions), see the result, and retry, so that I get daily practice that follows the DSKP. | 16 | 1.0 P0 | FR-MUR-16-1..12 |
| URS-MUR-16 | As a pupil I can practise by chapter (Bab) in textbook order for my own form, with progress per chapter, so that I revise what the class is studying. | 9 | 1.0 P0 | FR-MUR-9-1..11 |
| URS-MUR-17 | As a pupil I can see the SPM hub (my SPM results, years available, paper lists grouped by subject) and open published Bijak SPM papers, so that I can find a paper to sit. | 13 | 1.0 P0 | FR-MUR-13-1..5, FR-MUR-13-22 |
| URS-MUR-18 | As a pupil I can sit a Bijak SPM paper (timed, one question or one stimulus group per screen, sections "Jawab semua" and "Pilih N", autosave, navigator), submit once, review the scheme after submit and retry, so that I rehearse a real exam. | 13 | 1.0 P0 | FR-MUR-13-6..15, FR-MUR-13-23..25 |
| URS-MUR-19 | As a pupil I can use the other SPM modes (Simulasi Kuiz, Databank by year, Tracking A, Jana Kertas) and have every answer of every sitting recorded in the single answer store (it counts in my performance and my teacher's reports), so that I can practise in the format I need. | 13 | 1.0 P0 | FR-MUR-13-16..18, FR-MUR-13-20, FR-MUR-13-21 |
| URS-MUR-20 | As a pupil I can answer SPM Subjektif and read Kertas Subjektif papers, reveal the marking scheme and mark myself, with no switch hiding them, so that I can practise written answers. | 13 | 1.0 P0 | FR-MUR-13-19, FR-MUR-13-26..30 |
| URS-MUR-21 | As a pupil I can practise structured (Kertas 2 style) questions with parts, working and final answer, then see the scheme and self-mark, so that I train for written papers. | 17 | 1.0 (linked from 13) P1 | FR-MUR-17-1..5 |
| URS-MUR-22 | As a pupil I can report a wrong question from any question card and follow the status of my reports, so that errors get fixed. | 54 | 1.0 P0 | FR-MUR-54-1..8, FR-MUR-16-8 |

### 1.4 Question display contract (applies to every pupil surface that shows questions)

| ID | User requirement | Matrix row | Priority | Satisfied by |
|---|---|---|---|---|
| URS-MUR-23 | As a pupil I see a shared figure, passage or table once, above all the questions that refer to it, and it stays visible while I answer them, and I never get a question whose figure is missing or a stem shown twice, so that questions follow the DSKP and the real paper. | 9, 13, 16, 6, 12, 17 | 1.0 P0 | FR-MUR-QP-1..7, FR-X1-4a..f |
| URS-MUR-24 | As a pupil on a phone I can zoom a figure, use full-width answer inputs with the keyboard open, move between questions with a compact navigator and always reach "Hantar", without losing my place when I rotate, so that sitting a paper on a phone works. | 9, 13, 16 | 1.0 P0 | FR-MUR-QP-8..17, FR-X6-6..10 |
| URS-MUR-25 | As a pupil I see the DSKP level that fits each screen (Bab for chapter screens, SP for mastery screens) and never an invented label for unmapped content, so that what I see is true to the curriculum. | 5, 9, 14, 24, 25 | 1.0 P1 | FR-MUR-DK-1..5 |

### 1.5 Learning and class (Kelas Saya, Video, Permainan, Artikel, Set Soalan Guru)

| ID | User requirement | Matrix row | Priority | Satisfied by |
|---|---|---|---|---|
| URS-MUR-26 | As a pupil I can see the classes my teacher added me to (there is no join-by-code), see classmates (first name and coins only) and open the teacher's question sets and the class leaderboard, so that I belong to my class. | 8 | 1.0 P1 | FR-MUR-8-1..6 |
| URS-MUR-27 | As a pupil I can browse and search learning videos by category and subject, so that I can watch explanations. | 7 | 1.0 P2 | FR-MUR-7-1..5 |
| URS-MUR-28 | As a pupil I can play the learning games that work with the question bank, join a room by a 6-character code and earn coins, so that practice is fun. | 21 | 1.0 P1 | FR-MUR-21-1..7 |
| URS-MUR-29 | As a pupil I can read articles and open an article from the Dashboard, so that no link is dead. | 20 | 1.0 (linked from 2) P1 | FR-MUR-20-1..4 |
| URS-MUR-30 | As a pupil I can open and answer the question sets my teacher assigned to my class (and only mine), so that I do my teacher's homework in the app. | 26 | 1.0 (linked from 2, 8) P1 | FR-MUR-26-1..5 |

### 1.6 Coins, rewards and ranking (linked from the header and Dashboard, then the rest)

| ID | User requirement | Matrix row | Priority | Satisfied by |
|---|---|---|---|---|
| URS-MUR-31 | As a pupil I can see my coins and tokens, my transactions and the digital shop from the coin pill, so that I understand my balance. | 28 | 1.0 (linked from header, 2) P1 | FR-MUR-28-1..5, FR-MUR-SH-4, FR-MUR-SH-11 |
| URS-MUR-32 | As a pupil I can convert coins to tokens (50, 250 or all), so that I can use my coins. | 29 | 1.0 (linked from 28, 31) P1 | FR-MUR-29-1..4 |
| URS-MUR-33 | As a pupil I can see today's daily challenges with real progress and rewards, so that I have goals each day. | 30 | 1.0 (linked from 2, 28) P1 | FR-MUR-30-1..5 |
| URS-MUR-34 | As a pupil I can redeem rewards from Kedai Hadiah and see my redemptions fulfilled or cancelled, so that my coins have value. | 31 | 1.0 (linked from 28) P1 | FR-MUR-31-1..5 |
| URS-MUR-35 | As a pupil I can see the leaderboard with period and scope filters and my own rank, and see my standing (class, school, state, national) with the pupils just above and below me, so that I know where I stand. | 33, 18 | 1.0 (linked from 8, 18) P1 | FR-MUR-33-1..5, FR-MUR-18-1..5 |
| URS-MUR-36 | As a pupil I can see a tournament banner and enter an active tournament, so that I can compete. | 23 | 1.0 (linked from banner) P2 | FR-MUR-23-1..4, FR-MUR-SH-12 |
| URS-MUR-37 | As a pupil I can see my achievements (badges), so that I am rewarded for effort. | 34 | Later P2 | FR-MUR-34-1..4 |
| URS-MUR-38 | As a pupil I can join a lucky draw (Cabutan Bertuah) and open a Kotak Misteri, so that I get surprise rewards under the rules the admin sets. | 22, 35 | Later P1/P2 | FR-MUR-22-1..5, FR-MUR-35-1..5 |
| URS-MUR-39 | As a pupil I can refer a friend and receive the referral reward, so that I can invite classmates. | 36 | Later P2 | FR-MUR-36-1..5 |
| URS-MUR-40 | As a pupil I can browse the marketplace and the digital reward shop (Kedai Hadiah DIGITAL), so that I can spend what I earned. | 32, 38 | Later P2 | FR-MUR-32-1..5, FR-MUR-38-1..4 |

### 1.7 Rest of the learning menu (later)

| ID | User requirement | Matrix row | Priority | Satisfied by |
|---|---|---|---|---|
| URS-MUR-41 | As a pupil I can practise PKSK questions when my school has granted access, and see a clear message when it has not, so that I use the access I have. | 19 | Later P1 | FR-MUR-19-1..6 |
| URS-MUR-42 | As a pupil I can browse topics and the learning map of my own form and start practice from them, with T1–T3 served like T4–T5, so that I follow the syllabus. | 24, 25 | Later P1 | FR-MUR-24-1..5, FR-MUR-25-1..5 |
| URS-MUR-43 | As a pupil I can listen to KBAT audio items, so that I can train higher-order thinking by ear. | 27 | Later P2 | FR-MUR-27-1..4 |
| URS-MUR-44 | As a pupil I can see my timeline of achievements and my own posts, so that I can look back on my progress. | 39 | Later P2 | FR-MUR-39-1..5 |
| URS-MUR-45 | As a pupil I can invite a parent and manage the link, so that my parent can follow my progress. | 40 | Later P2 | FR-MUR-40-1..5 |
| URS-MUR-46 | As a pupil I can open a support ticket (subject and details) and read the single admin reply and status, so that I get help. | A4 | Later P2 | FR-MUR-A4-1..5 |
| URS-MUR-47 | As a pupil I can use every later module with real data, own-data-only access, BM messages and no dead control, so that nothing feels unfinished. | rows 17–40, A4 | Later P1 | FR-MUR-P2-1..5 |

### 1.8 Hidden modules

| ID | User requirement | Matrix row | Priority | Satisfied by |
|---|---|---|---|---|
| URS-MUR-48 | As a pupil I never see Mohon Keluarga Angkat (row 15) or Cikgu Alesa (row 37) in any menu, link or banner, and a typed URL shows the standard 404 page, so that unfinished features do not confuse me. | 15, 37 | 1.0 (exception D102) | FR-MUR-SH-9, FR-X2-1a, FR-X2-2, NFR-6 |

---

## 2. Guru (teacher)

| ID | User requirement | Matrix row | Priority | Satisfied by |
|---|---|---|---|---|
| URS-GUR-01 | As a teacher I get a shell whose sidebar, drawer, bottom tabs and search show the same teacher items, each opening a working page, so that I can reach every tool. | all rows | 1.0 | FR-SH-1..5 |
| URS-GUR-02 | As a teacher I can see and edit my profile (including school), and view other teachers' public profile pages, so that colleagues can identify me. | A1 | 1.0 | FR-GUR-A1-1..7 |
| URS-GUR-03 | As a teacher I can see my account details read-only and keep my preferences, so that I know what my account holds. | A2 | 1.0 | FR-GUR-A2-1..3 |
| URS-GUR-04 | As a teacher I can read Panduan for teachers and see the support contact, so that I can get started alone. | A3 | 1.0 | FR-GUR-A3-1..4 |
| URS-GUR-05 | As a teacher I can open, reply to and track my own support tickets, so that I get help. | A4 | Later | FR-GUR-A4-1..5 |
| URS-GUR-06 | As a teacher I can log out in one tap, so that my account is safe on shared devices. | A5 | 1.0 | FR-GUR-A5-1..2 |
| URS-GUR-07 | As a teacher I see a live board for my classes (KPIs, remedial, SPM forecast, classes, evaluation, badges) that updates itself and drills into detail, so that I act on what is happening now. | 1 | 1.0 | FR-GUR-1-1..12 |
| URS-GUR-08 | As a teacher I get a dashboard with my class figures, quick actions, a getting-started guide and today's actions, so that I start my day quickly. | 2 | 1.0 | FR-GUR-2-1..5 |
| URS-GUR-09 | As a teacher I can create, apply to a class and delete daily missions for pupils, so that I motivate pupils. | 2 (child of Dashboard) | 1.0 (linked) | FR-GUR-2b-1..4 |
| URS-GUR-10 | As a teacher I can set up Headcount (TOV, ETR, key in AR, forecast, export) for my classes, so that I track targets against achievement. | 3 | 1.0 | FR-GUR-3-1..7 |
| URS-GUR-11 | As a teacher I can see Prestasi per class and open a pupil's Prestasi 360 for my own pupils, so that I see who needs help. | 4 | 1.0 | FR-GUR-4-1..5 |
| URS-GUR-12 | As a teacher I can see Analitik Adaptif per class (weak SPs, pupils at risk), open a pupil's analytics and record an intervention, so that I can intervene. | 5 | 1.0 | FR-GUR-5-1..6 |
| URS-GUR-13 | As a teacher I can see Analisa Item per class (item difficulty tiers, sorted and searchable, with who answered wrongly), so that I know which questions the class finds hard. | 6 | 1.0 | FR-GUR-6-1..7 |
| URS-GUR-14 | As a teacher I can browse videos and add one, so that I share learning material. | 7 | 1.0 | FR-GUR-7-1..3 |
| URS-GUR-15 | As a teacher I can create and edit classes, add existing and new pupils, so that pupils see the class in their Kelas Saya. | 8 | 1.0 | FR-GUR-8-1..5 |
| URS-GUR-16 | As a teacher I can build, publish, copy, review the results of and delete question sets for my class, so that pupils get my homework (it shows in their Set Soalan Guru). | 8 (child) | 1.0 (linked, D108(3)) | FR-GUR-8b-1..7 |
| URS-GUR-17 | As a teacher I can preview Soalan by Chapter for every subject and chapter exactly as pupils see it, so that I know what pupils practise. | 9 | 1.0 | FR-GUR-9-1..5 |
| URS-GUR-18 | As a teacher I can monitor my school (five cards, pupil and teacher lists, pupil detail), so that I see who is active. | 10 | 1.0 | FR-GUR-10-1..7 |
| URS-GUR-19 | As a teacher I can see Kirkpatrick (seven tabs: overview, reaction, learning, behaviour, results, impact chain, interventions) for my scope, so that I can judge the programme's impact. | 11 | 1.0 | FR-GUR-11-1..10 |
| URS-GUR-20 | As a teacher I can list my pupils and my school's pupils, create a pupil and open a pupil's summary, so that I manage my class. | 41 | 1.0 | FR-GUR-41-1..5 |
| URS-GUR-21 | As a teacher I can see a report of my classes (cards, trend, panels) for a chosen class or all, with numbers that agree with every other screen, so that I can report progress. | 42 | 1.0 | FR-GUR-42-1..5 |
| URS-GUR-22 | As a teacher I can open and print a weekly report per class, so that I can share the week's results. | 43 | 1.0 | FR-GUR-43-1..7 |
| URS-GUR-23 | As a teacher I can submit questions (one by one, by CSV or a paper PDF) to the admin through a real intake, with DSKP tags and stimulus groups, and track their status, so that my questions can reach the bank. | 44 | 1.0 | FR-GUR-44-1..7, FR-ADM-Q12.* |
| URS-GUR-25 | As a teacher I can use the six "Alat Soalan" tools of Sumbang Soalan: my personal questions with a reference link for my pupils' Misi Harian, the structured-question list, the diagram-needed list with image upload, a read-only Databank, Set Soalan and my own exam papers, so that every tool the V2 teacher has works and none is a dead tile. | 44 (tools) | 1.0 | FR-GUR-44-8, FR-GUR-44a-1..6, FR-GUR-44b-1..7, FR-GUR-44c-1..5, FR-GUR-44d-1..6, FR-GUR-44e-1..5 |
| URS-GUR-24 | As a teacher I see the same numbers for the same thing on every screen (XS rules), and every page works at 375, 768 and 1280 px. | all rows | 1.0 | XS-1.. (SRS 20 §5), FR-X4-1..3, FR-X6-1..5 |

---

## 3. Admin Sekolah (school admin)

| ID | User requirement | Matrix row | Priority | Satisfied by |
|---|---|---|---|---|
| URS-AS-01 | As a school admin I get a shell with a working account, with every figure confined to my own school and a demo account that exists, so that my data is isolated. | all rows | 1.0 | FR-SH-1..5, FR-AS-0-1..4 |
| URS-AS-02 | As a school admin I can log out in one tap, so that my account is safe. | A5 | 1.0 | FR-AS-A5-1..2 |
| URS-AS-03 | As a school admin I see a live Command Center of my school (pupils, teachers, active pupils, answers) and drill into detail, so that I know how the school is doing. | 1 | 1.0 | FR-AS-1-1..6 |
| URS-AS-04 | As a school admin I can see all Headcount configurations of my school read-only, so that I can follow targets without changing the teacher's data. | 3 | 1.0 | FR-AS-3-1..6 |
| URS-AS-05 | As a school admin I can see Prestasi by Tingkatan and class with GPS bands, so that I compare groups in my school. | 4 | 1.0 | FR-AS-4-1..5 |
| URS-AS-06 | As a school admin I can see Analitik Adaptif for my school, so that I find weak SPs school-wide. | 5 | 1.0 | FR-AS-5-1..5 |
| URS-AS-07 | As a school admin I can see Analisa Item for my school, so that I find the items the school finds hard. | 6 | 1.0 | FR-AS-6-1..4 |
| URS-AS-08 | As a school admin I can browse videos, so that I know the learning material. | 7 | 1.0 | FR-AS-7-1..2 |
| URS-AS-09 | As a school admin I can use Monitoring for my school, so that I see activity of teachers and pupils. | 10 | 1.0 | FR-AS-10-1..5 |
| URS-AS-10 | As a school admin I can see all seven Kirkpatrick screens and the PDF for my school, so that I judge impact for my school. | 11 | 1.0 | FR-AS-11-1..5 |
| URS-AS-11 | As a school admin I can see how my school ranks among competing schools (Sekolah Bersaing), so that I know my standing. | 45 | 1.0 | FR-AS-45-1..5 |
| URS-AS-12 | As a school admin I can see usage statistics for 7, 30 and 90 days, so that I know adoption. | 46 | 1.0 | FR-AS-46-1..4 |
| URS-AS-13 | As a school admin I can see a DSKP heatmap of mastery by subject and level, so that I see curriculum gaps. | 47 | 1.0 | FR-AS-47-1..5 |
| URS-AS-14 | As a school admin I can see an activity report of teachers and pupils (who accessed, trend), so that I follow engagement. | 48 | 1.0 | FR-AS-48-1..5 |
| URS-AS-15 | As a school admin I can see early warnings for at-risk pupils, treating "no data" as no data, and download the CSV, so that I help pupils early. | 49 | 1.0 | FR-AS-49-1..6 |
| URS-AS-16 | As a school admin I can see and print a monthly report with month navigation, so that I report to the principal. | 50 | 1.0 | FR-AS-50-1..5 |
| URS-AS-17 | As a school admin I can list, search, add, edit, import, export and preview pupils of my school, so that I manage my pupils. | 51 | 1.0 | FR-AS-51-1..8 |
| URS-AS-18 | As a school admin I can list, create, edit, reset the password of, approve and export teachers of my school, so that I manage teachers. | 52 | 1.0 | FR-AS-52-1..6 |
| URS-AS-19 | As a school admin I can list the classes of my school and open each class's performance and pupils, so that I manage classes. | 53 | 1.0 | FR-AS-53-1..4 |
| URS-AS-20 | As a school admin I get a dashboard with school figures and the latest message, with working links, so that I start from one page. | 2 | Later | FR-AS-2-1..5 |
| URS-AS-21 | As a school admin I can see and edit my profile and see my account details and Panduan, so that my account is correct. | A1, A2, A3 | Later | FR-AS-A1-1..3, FR-AS-A2-1..3, FR-AS-A3-1..4 |
| URS-AS-22 | As a school admin I can open and track support tickets, so that I get help. | A4 | Later | FR-AS-A4-1..3 |
| URS-AS-23 | As a school admin I see the same number for the same thing on every screen (pupils, teachers, answers) and every page works at 375, 768 and 1280 px, so that I can trust the reports. | all rows | 1.0 | XS-1.. (SRS 20 §5), FR-X4-1..3, FR-X6-1..5 |

---

## 4. Admin Pusat (central admin)

The central admin is not a matrix column: these requirements are the admin capabilities needed to **feed, manage and monitor** the matrix modules (feed map in 30 §2). Matrix row = the module(s) fed.

### 4.1 Question authoring that follows the DSKP (manual and paper)

| ID | User requirement | Feeds | Priority | Satisfied by |
|---|---|---|---|---|
| URS-ADM-01 | As an admin I can treat a figure, passage, table or graph as a **stimulus group** that holds 1..n questions, never as a question, so that a figure never separates from the questions that refer to it. | 6, 9, 13, 16 | 1.0 P0 | FR-ADM-QE1.1..5, FR-X1-4a, FR-X1-4b |
| URS-ADM-02 | As an admin entering questions by hand I create the stimulus group first and then add question 1, 2, 3 … to it without re-uploading the figure, and I can reorder or remove members, so that entry is quick and correct. | 9, 13, 16 | 1.0 P0 | FR-ADM-QE2.1..4, FR-ADM-Q05.1..3, FR-ADM-Q10.1..2 |
| URS-ADM-03 | As an admin I fill a question form that is correct to the DSKP (question type, parts, mode, marks, key, TP, Aras pemikiran, Tingkatan 1–5, provenance, Unit/Bab and SP), so that every question is tagged properly. | 5, 9, 13, 14, 16 | 1.0 P0 | FR-ADM-QE3.1..6, FR-ADM-Q04.1..6, FR-ADM-Q24.1..2 |
| URS-ADM-04 | As an admin I see at entry what is missing and why Terbitkan is blocked, and I cannot type a tag that is not in the curriculum, so that I do not meet a late error. | 13, 16 | 1.0 P0 | FR-ADM-QE4.1..4 |
| URS-ADM-05 | As an admin I can upload a paper PDF (once per batch: subject, Tingkatan, paper, section), let it be extracted with stimuli kept with **all** their questions (for example Rajah 3 → questions 5–8), fix the group range and approve items into drafts carrying the paper and DSKP tags, so that paper upload follows the DSKP. | 13, 16 | 1.0 P0 | FR-ADM-QE5.1..6, FR-ADM-Q08.1..4, FR-ADM-Q09.1..5, FR-X1-4c |
| URS-ADM-06 | As an admin I can import questions by CSV with DSKP and group columns and a real template, and see rejected rows with the reason, so that bulk entry follows the DSKP. | 9, 13, 16 | 1.0 P0 | FR-ADM-QE6.1..3, FR-ADM-Q11.1 |
| URS-ADM-07 | As an admin I can assemble and generate papers and drill pools so that a stimulus group is always used as one unit, never split, and figure questions and groups are served by every drill, so that papers and drills are true to the DSKP. | 9, 13, 16, 21 | 1.0 P0 | FR-ADM-QE7.1..4, FR-X1-4e |
| URS-ADM-08 | As an admin I get a regroup work-list of migrated questions that are a bare figure, say "Rajah n" with no figure, or repeat their stem, can attach a figure or form a group, and flagged questions are never served to pupils, so that old broken data is repaired without inventing content. | 6, 9, 13, 16 | 1.0 P0 | FR-ADM-QE8.1..4, FR-ADM-G7.1..6, FR-X1-4f, U-OP-05, U-OP-06, U-OP-17 |
| URS-ADM-09 | As an admin I can see an indicator of where a question is shown to pupils ("Dilihat murid di") with the reason when it is not, the same rule the pupil query uses, so that the count I see equals what pupils get. | 9, 13, 16 | 1.0 P0 | FR-ADM-Q06.1..3, FR-ADM-Q03.1..6, FR-X4-2 |
| URS-ADM-10 | As an admin I can open the SPM hub and its lanes (Databank, Latih Tubi, Bijak SPM, Tracking A, Subjektif) with filters and attention counts, so that I manage every pupil-facing question lane. | 13, 16 | 1.0 P0 | FR-ADM-Q01.1..5, FR-ADM-Q02.1..4 |
| URS-ADM-11 | As an admin I can import and review (Import & Semakan: Kelompok Item, Kertas Diimport, Kiriman Guru), including teacher submissions, with an extraction that completes or times out with an error, so that intake always ends. | 13, 44 | 1.0 P0 | FR-ADM-Q07.1..5, FR-ADM-Q12.1..5, FR-ADM-Q19.1..2, FR-ADM-Q20.1..3 |
| URS-ADM-12 | As an admin I can define and verify a Kontrak Simulasi (blueprint) per subject and paper, with every failing check listed, so that pupil papers follow the real exam structure. | 13 | 1.0 P0 | FR-ADM-Q16.1..6, FR-ADM-Q15.2 |
| URS-ADM-13 | As an admin I can build a paper in Set Builder under a verified contract, review it and publish (Terbit) it with a gate that lists every blocker, so that pupils can sit it. | 13 | 1.0 P0 | FR-ADM-Q13.1..5, FR-ADM-Q14.1..6, FR-ADM-Q15.1..4 |
| URS-ADM-14 | As an admin I can fill Tracking A sets from the servable bank, so that Tracking A shows sets to pupils. | 13 | 1.0 P0 | FR-ADM-Q17.1..6 |
| URS-ADM-15 | As an admin I can author a Kertas Subjektif (upload, OCR, edit, scheme, Terbit) and manage structured questions and the Subjektif lane, with DSKP tags and stimulus groups, so that pupil Subjektif is fully working. | 13, 17 | 1.0 P0 | FR-ADM-Q18.1..8, FR-ADM-Q23.1..5 |
| URS-ADM-16 | As an admin I can list, filter and bulk-act on questions (old bank, quality, source papers) and handle pupil reports, so that quality stays high. | 54, 9, 16 | 1.0 P0/P1 | FR-ADM-Q20.1..3, FR-ADM-Q21.1, FR-ADM-Q22.1..3, FR-ADM-Q19.1..2 |

### 4.2 Curriculum and DSKP

| ID | User requirement | Feeds | Priority | Satisfied by |
|---|---|---|---|---|
| URS-ADM-17 | As an admin I can browse and maintain Subjek, Tingkatan 1–5, Bab, Topik and the loaded DSKP (Bidang, SK, SP, TP), with question counts per Bab and refusal to delete a Bab that has questions, so that the curriculum is correct. | 5, 9, 14, 24, 25 | 1.0 P0 | FR-ADM-C01.1..7, FR-ADM-C02.1 |
| URS-ADM-18 | As an admin I can activate or deactivate education levels so that only Tingkatan 1–5 show everywhere (Darjah hidden), so that the app is secondary-only. | all | 1.0 P0 | FR-ADM-C03.1..3, FR-X3-1, FR-X3-2 |
| URS-ADM-19 | As an admin I can load and verify the DSKP for Tingkatan 1–5 (T4–T5 now; T1–T3 once the DSKP source PDFs are supplied), so that SP/TP tags exist. | 5, 9, 14, 24, 25 | 1.0 P0 | FR-ADM-C04.1..4, U-OP-01 |
| URS-ADM-20 | As an admin I can set the Bab of a question one by one or in bulk by filter, and see progress per Bab, so that Soalan by Chapter has content. | 9, 14, 24, 25 | 1.0 P0 | FR-ADM-C05.1..5, U-OP-07, U-OP-15 |

### 4.3 Content, settings and flags

| ID | User requirement | Feeds | Priority | Satisfied by |
|---|---|---|---|---|
| URS-ADM-21 | As an admin I can manage videos (list, filters, hide), so that pupils, teachers and school admins see correct videos. | 7 | 1.0 P0 | FR-ADM-N01.1..2 |
| URS-ADM-22 | As an admin I can manage articles, banners and notes (publish state, dates), so that the Dashboard and Artikel show current content. | 2, 20 | 1.0 (linked) P1/P2 | FR-ADM-N02.1, FR-ADM-N03.1, FR-ADM-N04.1, FR-ADM-P2-18.* |
| URS-ADM-23 | As an admin I can enable or disable each game and set the Papan Bijak and game settings, so that pupils only get working games. | 21 | 1.0 P0 | FR-ADM-N05.1..3 |
| URS-ADM-24 | As an admin I can switch modules on and off (Kawalan Ciri) where the matrix allows, with no switch for Subjektif or Kertas Subjektif, so that rollout is controlled. | all | 1.0 P1 | FR-ADM-N06.1..4, FR-ADM-P2-19.* |
| URS-ADM-25 | As an admin I can set the support contact in Tetapan so that Panduan shows it for every role. | A3 | 1.0 P1 | FR-ADM-N07.1..3 |

### 4.4 Users, schools and classes

| ID | User requirement | Feeds | Priority | Satisfied by |
|---|---|---|---|---|
| URS-ADM-26 | As an admin I can list, create, edit, reset the password of and (de)activate users of every role (pupil Tingkatan 1–5 only), so that every portal has accounts. | all | 1.0 P0 | FR-ADM-U01.1..3, FR-ADM-U02.1..5, FR-ADM-U03.1..3 |
| URS-ADM-27 | As an admin I can manage schools and generate the Admin Sekolah account, so that each school has its own admin. | AS rows | 1.0 P0 | FR-ADM-U04.1..2, U-OP-12 |
| URS-ADM-28 | As an admin I can import pupils and users in bulk, manage complimentary pupils, classes and school subscriptions, so that onboarding is fast. | 8, 51, 52, 53 | 1.0/Later P1/P2 | FR-ADM-U05.*, FR-ADM-U06.1, FR-ADM-U07.1, FR-ADM-U08.1..2, FR-ADM-U09.1 |

### 4.5 Monitoring and reports

| ID | User requirement | Feeds | Priority | Satisfied by |
|---|---|---|---|---|
| URS-ADM-29 | As an admin I get a dashboard, the live Command Center and Daily Activity, so that I see the whole platform. | 1 | 1.0 P1 | FR-ADM-M01.1..4, FR-ADM-M02.1 |
| URS-ADM-30 | As an admin I can use Monitoring, Kirkpatrick (seven screens), Analitik and Laporan, so that I can judge the programme. | 10, 11 | 1.0 P1 | FR-ADM-M03.1..2, FR-ADM-M04.1..3, FR-ADM-M05.1..3, FR-ADM-M06.1..2 |
| URS-ADM-31 | As an admin I can open the school-admin reports and the executive report centrally with a school picker, so that I can support schools. | AS rows | Later P2 | FR-ADM-M07.1..2, FR-ADM-M08.1 |

### 4.6 Menu, quality and responsive rules

| ID | User requirement | Feeds | Priority | Satisfied by |
|---|---|---|---|---|
| URS-ADM-32 | As an admin I get one menu that follows the V2 groups and order, with one "Soalan" group and no duplicate entries, and an item appears only when its screen works, so that the admin area is easy to learn. | all | 1.0 P0 | SRS 30 §3 (menu tables 3.1–3.4), FR-ADM-H0.1..4 |
| URS-ADM-33 | As an admin I can use every admin screen, including the question editor, the PDF review pane and Set Builder, on a tablet and a phone without sideways page scroll, so that I can work anywhere. | all | 1.0 P0 | FR-ADM-R0.1, AC-ADM-R1..R11, FR-X6-11 |

### 4.7 Rest of the matrix: admin screens that feed the later pupil modules

| ID | User requirement | Feeds | Priority | Satisfied by |
|---|---|---|---|---|
| URS-ADM-34 | As an admin I can manage the gamification economy (overview, tiers, challenges, pupils, transactions, settings), so that coins and challenges are controlled. | 28, 29, 30, 33, 36 | Later P1 | FR-ADM-P2-01.*, P2-02.*, P2-03.*, P2-04.1, P2-05.1, P2-06.1 |
| URS-ADM-35 | As an admin I can manage the digital reward catalogue and redemption queue and the reward controls, so that pupils' redemptions are fulfilled. | 31, 38 | Later P1 | FR-ADM-P2-07.*, P2-08.*, P2-09.* |
| URS-ADM-36 | As an admin I can run lucky draws and Kotak Misteri, so that those pupil modules have an operator. | 22, 35 | Later P1 | FR-ADM-P2-10.1, FR-ADM-P2-11.1 |
| URS-ADM-37 | As an admin I can manage marketplace products and sellers, so that the pupil marketplace has real items. | 32 | Later P1 | FR-ADM-P2-12.1, FR-ADM-P2-13.1 |
| URS-ADM-38 | As an admin I can create and run tournaments and see school and pupil rankings, so that competitions work. | 23, 18, 33 | Later P1 | FR-ADM-P2-14.1, FR-ADM-P2-15.1 |
| URS-ADM-39 | As an admin I can see and manage parent links, so that "Jemput Ibu Bapa" works end to end. | 40 | Later P1 | FR-ADM-P2-16.1 |
| URS-ADM-40 | As an admin I can manage KBAT audio items, so that Audio KBAT has content. | 27 | Later P1 | FR-ADM-P2-17.1 |
| URS-ADM-41 | As an admin I can read and reply to support tickets from pupils, teachers and school admins and set their status, so that Tiket Bantuan works for every role. | A4 | Later P1 | FR-ADM-P2-20.1..4 |

### 4.8 Data operations on UAT

| ID | User requirement | Feeds | Priority | Satisfied by |
|---|---|---|---|---|
| URS-ADM-42 | As the product owner I want the UAT data brought to the state the pupil modules need (levels, DSKP, contracts, papers, Bab mapping, accounts, catalogues, flags, support contact), executed only with my explicit approval and in the stated order, so that correct code does not look broken. | all | 1.0 P0 | U-OP-01..17, FR-X5-1..3 |

---

## 5. All roles (cross-cutting)

| ID | User requirement | Priority | Satisfied by |
|---|---|---|---|
| URS-ALL-01 | As any user I can use every screen on phone (375 px), tablet (768 px) and desktop (1280 px) with no sideways page scroll, readable text, touch targets of at least 44 px and forms that the keyboard does not hide. | 1.0 P0 | FR-X6-1..5, AC-X6-1, NFR-1, FR-MUR-SH-10, FR-ADM-R0.1 |
| URS-ALL-02 | As any user I never meet "Pratonton", "akan datang", "belum tersedia", a prototype note, mock data or a dead button on a module ticked in the matrix. | 1.0 P0 | FR-X2-0, FR-X2-1, FR-X2-3, FR-ADM-H0.1..4, FR-MUR-P2-1..5 |
| URS-ALL-03 | As any user I see Tingkatan 1–5 only (Darjah hidden) and a Tingkatan 1–3 pupil gets practice like Tingkatan 4–5 wherever questions exist. | 1.0 P0 | FR-X3-1..3, FR-MUR-SH-8 |
| URS-ALL-04 | As any user I see the same number for the same concept on every screen, every count shows what the surface can serve, and "no data" is never shown as a bad result. | 1.0 P0 | FR-X4-1..3, XS-1.. (SRS 20 §5) |
| URS-ALL-05 | As a pupil I see only my own data, and no real person's data is exposed to another user or written in documents, seeds or code. | 1.0 P0 | FR-X4-4, NFR-5, FR-MUR-A1-5 |
| URS-ALL-06 | As any user I read all UI in exact Bahasa Melayu, get defined loading, empty and error states, and am not blocked by rate limits during normal use. | 1.0 P1 | NFR-2, NFR-3, NFR-4, NFR-7 |
| URS-ALL-07 | As the product owner I want the existing V3 improved, never rebuilt, with replicate-what-works behaviour (V2 first, V1 second) except question structure, which follows the DSKP, so that effort goes to the gaps. | 1.0 P0 | FR-X1-1..5, FR-X1-4a..f |
| URS-ALL-08 | As the product owner I want delivery verified on UAT-like data with the AC ledger at 100% Pass and the local stack starting without manual steps. | 1.0 P0 | FR-X5-1..3, X7 (SRS 40) |

---

## 6. Coverage check

| Check | Result |
|---|---|
| URS count per role | Murid 48, Guru 24, Admin Sekolah 23, Admin Pusat 42, All roles 8 (total 145) |
| Every Murid 1.0 row (A1, A2, A3, A5, 2, 3, 4, 5, 6, 7, 8, 9, 12, 13, 14, 16, 21, 54) has at least one URS | yes (URS-MUR-01..22, 26..28) |
| Every other ticked Murid row (A4, 17–36 except 15 and 37, 38–40) has a URS | yes (URS-MUR-21, 29..47). Rows 15 and 37: URS-MUR-48 (hidden, D102) |
| Every Guru row (A1–A5, 1–11, 41–44) and every Admin Sekolah row (A1–A5, 1–7, 10, 11, 45–53, 2) has a URS | yes |
| Every FR of the three SRS parts and part 40 is reachable from a URS | yes, by the ranges above |
| Admin Pusat DSKP authoring stories (manual, paper upload, stimulus 1..n, DSKP tags) | URS-ADM-01..08 |
| Responsive stories | URS-MUR-06, URS-MUR-24, URS-GUR-24, URS-AS-23, URS-ADM-33, URS-ALL-01 |

Open points: none that block the next phase. The role split Murid / Guru / Admin Sekolah / Admin Pusat is final; Ibu Bapa has no matrix column (see [01-product-overview](01-product-overview.md) §3).
