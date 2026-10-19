# v2 Cloud Gap Matrix (slug: v2-cloud-gap)

Status: DRAFT for Delivery Lead review. Track: Full (input to the v2 G1). Date: 2026-10-16.
Owner: product-analyst. Language: English (docs rule). No code, no tech choices, no UI design.

## 1. Summary and goal

- Goal: list every prestasiplus.cloud feature family, compare it with the current prototype, and say what v2 does with it, so the prototype update (D29) and the v2 G1 can be planned module by module.
- Direction (TRACKER D28, D29, D30): new system, `.cloud` is the PRIMARY reference; `.my` only for what `.cloud` lacks. Unchanged flow = replicate; changed flow = redesign. Changed flows: (1) one Portal Pentadbiran vs Portal Pembelajaran, no admin to student-shell jumps; (2) one canonical question bank, teacher PDF to OCR+AI to review to publish, new question display; (3) Nuxt UI re-theme (layout/theme only, not a flow change).
- Anything not in `.cloud` is out of scope for new ideas (D28c).

### Method and limits (read first)
- Evidence is code only (no live site, no server, as instructed). Paths are in `D:\Dev Projects\prestasiplus-reference\backend`.
- Evidence tags: `W:n` = `routes/web.php` line n (host-less group unless marked `P:`); `P:n` = same file, inside the `admin.*` Panel host group (lines 176-377); `API:n` = `routes/api.php`; `FIL:` = `app/Filament/...`; `DOC:` = `docs/QUESTIONS-MENU-REORG.md` or `.planning/codebase/ROLE-PORTALS.md`.
- Roles: M murid, G guru, AS admin_sekolah, PPD pegawai_ppd (one role covers PPD and JPN in `.cloud`), A admin (Admin Pusat), IB ibu bapa.
- "In .my?" is INFERRED from `.cloud` code comments that say "origin" (= `.my`), from `DOC:` and from the tracker L-matrix. `Yes` = origin parity stated; `No` = `.cloud` graft (QUESTIONS-MENU-REORG calls Studio/Imports/Sets/Sumber Kertas "v2.1 grafts"); `?` = cannot tell from code.
- "In prototype?" is from `docs/TRACKER.md` board, `docs/SCOPE-STATUS.md`, `src/shells/nav/*.ts` and `src/modules/*/routes`. Values: `Built` (route exists), `Partial`, `Missing`, `Hidden-OOS` (in `out-of-scope.ts`), `Docs-only` (module has G1 docs; route fragments are empty files), `Unverified`.
- Treatment codes: Replicate, Redesign-portal, Redesign-question, Merge-duplicate, Drop-legacy-dead (full names in the table).
- Real person names and personal data in `.cloud` seeders were not copied.

## 2. Users / personas

| Persona | `.cloud` role | v2 portal |
|---|---|---|
| Murid | pelajar | Portal Pembelajaran |
| Guru | guru | Portal Pembelajaran |
| Ibu Bapa | none beyond invite acceptance (W:1429) | Portal Pembelajaran (scope undefined, see OQ-2) |
| Admin Pusat | admin | Portal Pentadbiran (all) |
| Pegawai PPD / JPN | pegawai_ppd | Portal Pentadbiran (scoped read-only, D30) |
| Admin Sekolah | admin_sekolah | Portal Pentadbiran (own school, D30) |

## 3. Feature matrix (user stories are deferred to v2 G1; this is a gap input, so story IDs are not used here)

Columns: ID | Feature | `.cloud` routes (evidence) | Roles | In .my? | In prototype? | v2 treatment | Owning module | Notes

### 3.1 Auth, account, portal entry

| ID | Feature | .cloud routes (evidence) | Roles | In .my? | In prototype? | v2 treatment | Owning module | Notes |
|---|---|---|---|---|---|---|---|---|
| F-01 | Login: school + username + password (email fallback), school picker, ambiguity / suspended / school-off messages | W:396-479 | M,G (any by email) | Yes | Built M01 `/login` (verify school picker + ambiguity copy) | Replicate | M01 | Keep exact BM messages (W:448, 456, 463, 478). |
| F-02 | Admin login (`/admin/login`, Panel `/login`, `/logout`) | W:483-515, P:177-180 | A,AS,PPD | Yes | Missing (one `/login` only) | Redesign-portal | M01 + new Portal Pentadbiran shell | One URL, one login at `admin.*`; the "bukan akaun pentadbir" redirect dance disappears. |
| F-03 | Self-registration with school join code, throttled | W:391-393 | M,G | Yes | Partial: M01 `/register` (.my form; join-code check unverified) | Replicate | M01 | Throttle 10/min is a backend rule. |
| F-04 | Google SSO sign-in, link, unlink | W:380-387 | all | ? | Missing | Replicate | M01 | External hand-off: simulate (D14). |
| F-05 | Logout (POST and GET) | W:936-950 | all | Yes | Built M01 | Replicate | M01 | POST only; GET logout is a CSRF-able convenience, not carried. |
| F-06 | Password reset (by e-mail / by IC) | none in `.cloud` routes | all | Yes | Built M01 `/password/reset*` | Replicate | M01 | `.my`-only, kept because `.cloud` lacks it (D29c). Confirm `.cloud` has no reset flow (OQ-8). |
| F-07 | Impersonate start / leave ("Login As") | W:758-759, 520-521 | A | Yes | Partial (XR-M27-21 pending from M01) | Redesign-portal | M01, M02 | Replace with "Pratonton sebagai Pelajar" (new tab + banner) plus audited impersonation; leave control always visible. |
| F-08 | Staff open student pages (`/dashboard`, `/kombo`, `/cita-cita`, `/profil-cerah`, `/cikgu-suara`, `/spm/latih-tubi`, Tracking A) | W:965-977, 1091-1099 | A,AS,PPD (G for Tracking A) | Yes (admin sidebar jumps) | Built (admin nav "Ke Dashboard", "Student View", Bilik Duta/Pusat AI/Killer Features sections) | Redesign-portal | Portal Pentadbiran | The shell-switch complaint (D28). Preview mode must be read-only (writes are `role:pelajar` only, W:1111). |
| F-09 | Role-based landing and redirect (`role_home`, `/` to `/admin`) | W:396-406, 1795-1805 | all | Yes | Partial | Redesign-portal | M01 | A/AS/PPD land on `admin.*`; M/G/IB on the learning portal. |
| F-10 | Public landing page and `/present` deck | W:1795-1814 | public | Yes | Out of tracker scope (landing excluded) | Drop-legacy-dead | n/a | Static mirrors of `.my`. |
| F-11 | Profil murid view/edit/save | W:1179-1182, 1224-1225 | M | Yes | Built M01 (`/profile`, `/profile/edit`) | Merge-duplicate | M01 | Three URLs for one function (`/profile`, `/profile/edit`, `/pelajar/profil`); one canonical path. |
| F-12 | Tetapan peribadi | W:1491 | all | Yes | Built M01 (`/tetapan`) | Replicate | M01 | Shared page branches by role. |
| F-13 | Profil guru edit, school search, public teacher profile | W:1768-1770, 1791 | G | Yes | Unverified | Replicate | M01 / M10 | Check M10 for a guru profile screen. |
| F-14 | Public student profile `/pelajar/{id}` | W:1425 | ? (route line has no auth middleware) | ? | Unverified | Replicate | M01 / M08 | Privacy risk: confirm auth + limited fields in v2. |
| F-15 | Accept parent invitation `/ibu-bapa/terima/{token}` | W:1429 | IB (public) | Yes | Built M01 | Replicate | M01 | Token shape `[A-Fa-f0-9]+`. |
| F-16 | Jemput Ibu Bapa (generate invite) | W:1239-1240 | M | Yes | Built M02 (L45) | Replicate | M02 | Parent portal content is undefined (OQ-2). |

### 3.2 Murid learning (Portal Pembelajaran)

| ID | Feature | .cloud routes (evidence) | Roles | In .my? | In prototype? | v2 treatment | Owning module | Notes |
|---|---|---|---|---|---|---|---|---|
| F-20 | Dashboard murid and aliases (`/dashboard`, `/pelajar`) | W:972, 1140 | M (+staff preview) | Yes | Built M05-T3 (L07) | Replicate | M05 | One canonical path. |
| F-21 | Mood check-in modal, Mood Saya | W:1190, 1212, 1565 | M | Yes | Missing (`/pusat-ai/mood` Hidden-OOS; modal unverified) | Replicate | M26 Wellbeing | Feeds Kirkpatrick / wellbeing alerts. |
| F-22 | Prestasi, Analitik Adaptif, Laporan Mingguan (+detail) and `/pelajar/*` twins | W:1147, 1151-1152, 1191, 1201-1203 | M | Yes | Built M08 (L09, L10, L48) | Merge-duplicate | M08 | `/prestasi` = `/pelajar/prestasi`; `/analitik/pelajar` = `/pelajar/analitik`; `/laporan-mingguan` = `/pelajar/laporan`. |
| F-23 | Misi Harian (murid) | W:1148, 1193 | M | Yes | Unverified (guru Misi Harian is Hidden-OOS) | Replicate | M14 / M08 | Two URLs (`/misi-harian`, `/pelajar/misi`). |
| F-24 | Target SPM (view + save) | W:1153, 1228-1229 | M | Yes | Missing | Replicate | M08 | Size S. |
| F-25 | Remedial saya | W:1150, 1199 | M | Yes | Built M05 (L17) | Replicate | M05 | Two URLs; one kept. |
| F-26 | Kombo / Streak | W:973, 1200 | M | Yes | Hidden-OOS (M26) | Replicate | M26 | Class variant is F-83. |
| F-27 | Cita-Cita, Universiti (+detail), Biasiswa (+detail) | W:974, 1186-1189, 1194-1195, 1219-1222 | M | Yes | Hidden-OOS (M26) | Merge-duplicate | M26 | Each page has two URL families (`/cita-cita/universiti`, `/pelajar/universiti`). Admin CRUD is F-178. |
| F-28 | Pusat Kerjaya (list + slug) | W:1232-1235 | M | Yes | Hidden-OOS (M26) | Replicate | M26 | |
| F-29 | Psikometrik (RIASEC etc.) | W:993, 1158, 1196 | M | Yes | Hidden-OOS (M26) | Replicate | M26 | Sensitive-data handling, see OQ-6. |
| F-30 | Profil Cerah, Cikgu Suara | W:975-976 | M (+staff) | Yes | Hidden-OOS (M26) | Replicate | M26 | AI voice simulated (D4). |
| F-31 | Pusat Ilmu Sekolah (+slug) | W:1237-1238 | M | Yes | Hidden-OOS (M26) | Replicate | M26 | |
| F-32 | Latih Tubi (setup, quiz, result) across `/latih-tubi`, `/practice`, `/spm/latih-tubi` | W:966-971, 1467-1477, 1507-1510, 1577-1580 | M (+staff view) | Yes | Built M05 / M06 | Merge-duplicate | M05 | Three URL families, one function. `.cloud` canonical = `/latih-tubi` (the `/spm/*` and `/practice/*` redirect to it); prototype uses `/spm/latih-tubi`. The question card inside is Redesign-question. Behind the `latih-tubi` feature flag (W:1465). |
| F-33 | Soalan by Chapter | W:1469-1470, 1771-1774 | M,G | Yes | Built M05 (L14) | Merge-duplicate | M05 | `/latih-tubi/bab` and `/practice/chapter` redirect together. |
| F-34 | Revision drill | W:1277-1279 | M | Yes | Built M05 | Replicate | M05 | |
| F-35 | Kemajuan and Sejarah | W:1198, 1226-1227, 1275-1276 | M | Yes | Partial (`/spm/history` only) | Merge-duplicate | M05 | Four URLs (`/pelajar/kemajuan`, `/practice/progress`, `/practice/history`, `/pelajar/sejarah`) plus `/spm/history`. |
| F-36 | Latihan Berstruktur (answer, mark, result) | W:1101-1107 | M,G,staff | Yes | Built M04 / M05 (L22) | Redesign-question | M04 | Structured answer UI becomes a question type in the canonical bank. |
| F-37 | Set Soalan from teacher (play, result), Set Soalan Saya | W:1206-1207, 1262 | M | Yes | Built M10 (L31) | Replicate | M10 | |
| F-38 | Topik browser, Peta Belajar | W:1252-1254, 1258 | M | Yes | Built M03 (L29, L30) | Replicate | M03 | |
| F-39 | Penguasaan, Pembetulan | W:1255-1257 | M | Yes | Hidden-OOS (M26) | Replicate | M26 | |
| F-40 | Buku Nota, Heatmap, Pusat Nota Ringkas | W:1248-1251 | M | Yes | Partial (Heatmap built M25; rest Hidden-OOS) | Replicate | M25 | |
| F-41 | Timeline Saya | W:1259-1261 | M | Yes | Built M08 (L44) | Replicate | M08 | |
| F-42 | Ranking / Papan Pendahulu / Leaderboard | W:1183-1184, 1213, 1223 | M | Yes | Built M08 (L23, L38) | Merge-duplicate | M08 | Four URLs. |
| F-43 | Kelas Saya (murid) | W:1214 | M | Yes | Built M10 (L13) | Replicate | M10 | |
| F-44 | Laporan Soalan (report a question) | W:1243 | M | Yes | Built M04 (L59) | Replicate | M04 | Admin side is F-132. |
| F-45 | Maklum balas (feedback POST) | W:1570 | all | ? | Missing | Replicate | M22 | Size S. |
| F-46 | Notification centre (list, read-all, unread count, mark, bulk read/delete) | W:1549-1550, 1566-1569 | all | Yes | Unverified (M22 covers tickets only) | Replicate | M22 | Size M. |
| F-47 | Panduan, Tiket (and Pusat Tuisyen Panduan/Tiket) | W:1241, 1494-1496, 1551-1553 | all | Yes | Built M09 / M22 | Merge-duplicate | M09 / M22 | `/tiket` vs `/pusat-tuisyen/tiket` are two entries to one function. |
| F-48 | Artikel (list, slug) | W:1557-1558 | all | Yes | Built M09 (L25) | Replicate | M09 | |
| F-49 | Video (list, guru POST) | W:1546-1547 | all (G post) | Yes | Built M09 (L12) | Replicate | M09 | |
| F-50 | Audio KBAT (listen) | W:1559 | all | Yes | Built M09 (L32) | Replicate | M09 | |
| F-51 | Perutusan | W:1548 | all | Yes | Hidden-OOS (M26) | Replicate | M26 | |
| F-52 | Invois saya | W:1216 | M | Yes | Hidden-OOS (M19) | Replicate | M19 | |
| F-53 | Pricing page | W:1293 | all | ? | Missing | Replicate | M19 | Size S. |
| F-54 | Marketplace (browse, order, product) | W:1088, 1177-1178 | M | Yes | Built M20 (L37) | Replicate | M20 | Order via WhatsApp is simulated (D14). |
| F-55 | Gamifikasi murid: hub, Tukar Token, Cabaran (+claim), Pencapaian, Rujuk Kawan, Leaderboard | W:1159-1172 | M | Yes | Built M14 (L33-L35, L39, L41) | Replicate | M14 | |
| F-56 | Kedai Hadiah (+redeem), Kotak Misteri, Cabutan, Kedai Hadiah Digital | W:1167-1171, 1176, 1244 | M | Yes | Built M15 (L27, L36, L40, L43) | Replicate | M15 | |
| F-57 | Permainan hub, Betul/Salah, solo games | W:1310-1323 | M | Yes | Built M16 (L26) | Replicate | M16 | Behind `permainan` feature flag (W:1310). |
| F-58 | Multiplayer lobbies: Papan Bijak, Kuiz Relay, Teka Silang Kata, Perang Fakta, Perlumbaan Matematik, Benteng Ilmu | W:1316-1394 | M | Yes | Built M16 | Replicate | M16 | `.cloud` polls `/state`; transport choice is a design concern, not a requirement change. |
| F-59 | Battle (index, arena, leaderboard, ranking sekolah, matchmaking and invite API) | W:1526-1530, 1585-1599 | M (+staff view) | Yes | Built M16 | Replicate | M16 | |
| F-60 | Tournament | W:1571, 1784 | M,G | Yes | Built M16 (L28) | Replicate | M16 | |
| F-61 | Liga (list, create, join, show) | W:1780-1783 | G (M?) | Yes | Hidden-OOS (M26) | Replicate | M26 | |
| F-62 | Sekolah Bersaing | W:1490, 1786 | M,G,AS | Yes | Built M16 (L50) | Replicate | M16 | |
| F-63 | Duta: Bilik Duta, Kem, Akademi, Dashboard, Jemput Duta | W:1538-1542 | M | Yes | Hidden-OOS (M24) | Replicate | M24 | Admin side is F-168. |
| F-64 | PKSK (student) | W:1215 | M | Yes | Built M07 (L24) | Replicate | M07 | |
| F-65 | Cikgu Alesa chat and floating chatbot (send, history, rate) | W:1504-1505, 1562-1564 | all | Yes | Built M13 (chat); floating widget Unverified | Replicate | M13 | AI simulated (D4). |
| F-66 | Pusat AI tools: Kamus, Aktiviti Advisor, Pendamping, Parent Whisperer, Doa, Whiteboard | W:1432, 1533-1534 | all | Yes | Hidden-OOS (M25) | Replicate | M25 | Six tools; size L in total. |
| F-67 | Pusat AI SPM Walkthrough (+solve) | W:1535 | all | Yes | Built M06 (`/pusat-ai/spm`) | Replicate | M06 | |
| F-68 | Mohon Keluarga Angkat | W:1245-1246 | M | Yes | Built M21 (L20) | Replicate | M21 | Admin side is F-167. |
| F-69 | Mod SPM hub and SPM history | W:1149, 1197-1198 | M | Yes | Built M06 (L18) | Merge-duplicate | M06 | `/spm` and `/pelajar/spm`. |
| F-70 | SPM Databank Tahun Lepas (browse, quiz, result) | W:1513-1515, 1581 | M | Yes | Built M06 | Redesign-question | M06 | New question display; shares the bank with F-99 (guru databank). |
| F-71 | Tracking A (hub, subject, result) | W:1405-1418, 1582 | M,G,staff | Yes | Built M06 (`/spm/ramalan` only) | Merge-duplicate | M06 | `.cloud` canonical `/spm/tracking-a/{code}`; `/spm/ramalan` is the origin alias. |
| F-72 | Subjektif (SPM) | W:1523 | M | Yes | Built M06 | Merge-duplicate | M06 | Overlaps with Kertas Subjektif viewer F-76. |
| F-73 | SPM Mock (kuiz, kertas 2, result) | W:1516-1521, 1583-1584 | M | Yes | Built M06 | Merge-duplicate | M06 | Overlaps with Bijak SPM Simulasi F-74 (OQ-3). |
| F-74 | Bijak SPM Simulasi: index, printed-paper view, autosave, hantar, semakan, self-mark (per part and per Bahagian), cuba lagi | W:1113-1135, 1441, 1453 | M (+staff view) | No (v2.1) | Missing | Redesign-question | M06 | Size L. Per-page instant mark was removed on purpose (W:1136-1138); keep that rule. |
| F-75 | Simulasi Kuiz mode (paper-scoped, paged by Bahagian) | W:1446-1450 | M | No | Missing | Redesign-question | M06 | Size M. |
| F-76 | Kertas Subjektif viewer (K2/K3/K4 page-image papers, scheme reveal) | W:1459-1462 | M,staff | No | Missing | Redesign-question | M06 | Size M. Feature flag `kertas-subjektif`. |

### 3.3 Guru (Portal Pembelajaran)

| ID | Feature | .cloud routes (evidence) | Roles | In .my? | In prototype? | v2 treatment | Owning module | Notes |
|---|---|---|---|---|---|---|---|---|
| F-80 | Dashboard guru | W:1604 | G | Yes | Built M10 (L07) | Replicate | M10 | |
| F-81 | Kelas: list, create, edit, add/remove/new student | W:1605-1615, 1031 | G | Yes | Built M10 (L13) | Replicate | M10 | |
| F-82 | Pelajar Saya (+detail) | W:1617-1621 | G | Yes | Built M10 (L46) | Replicate | M10 | |
| F-83 | Class analytics: Prestasi Kelas, Analitik Kelas, Analisa Item Kelas, Laporan, Laporan Mingguan, Amaran, Kombo Kelas, Perbandingan Kelas | W:1623-1624, 1696-1703, 1759-1762 | G | Yes | Partial: M11 built; Perbandingan Kelas (M11-T4) and `/amaran` Hidden-OOS | Replicate | M11 | `/guru/x` and root twins exist; keep one. |
| F-84 | Monitoring (guru) with school/student/teacher drill | W:1654, 1080-1083 | G | Yes | Built M11 (L15) | Replicate | M11 | Drill components shared with admin (D30). |
| F-85 | Command Center guru (live data, predictive, drill, evaluate) | W:1749-1754 | G | Yes | Built M10 / M11 (L06) | Replicate | M11 | Becomes the shared component set for Pemantauan > Langsung (D30). |
| F-86 | Remedial automation (scan, generate, cancel, remedial progress) | W:1755-1758 | G | ? | Unverified | Replicate | M11 | Size M. |
| F-87 | Headcount (set up, auto-setup, delete, dashboard, student view, PDF) | W:1019, 1282-1287, 1488, 1657-1659, 1663 | G,AS | Yes | Built M08 (L08) | Replicate | M08 | |
| F-88 | Kirkpatrick (guru) and Intervensi (record, review) | W:1018, 1664-1670, 1706-1710 | G | Yes | Built M12 (L16) | Replicate | M12 | Admin twin is F-126. |
| F-89 | Kehadiran Digital | W:1655-1656 | G | Yes | Hidden-OOS | Replicate | Portal Guru ext. (new module) | Size S. |
| F-90 | Misi Harian guru (list, create, store) | W:1673-1675 | G | Yes | Hidden-OOS | Replicate | Portal Guru ext. | Size M. |
| F-91 | Jadual Belajar | W:1678-1680 | G | Yes | Hidden-OOS | Replicate | Portal Guru ext. | Size S. |
| F-92 | Kelas Live (Bilik Darjah Langsung) | W:1681 | G | Yes | Hidden-OOS | Replicate | Portal Guru ext. | Size M. |
| F-93 | Broadcast Kelas | W:1682-1683 | G | Yes | Hidden-OOS | Replicate | Portal Guru ext. | Size S. |
| F-94 | Gamifikasi guru: syiling, Kedai, Tebus Tunai, Leaderboard, Kelulusan Hadiah | W:1684-1692 | G | Yes | Hidden-OOS | Replicate | M14 / M15 | Size M. Admin side is F-153. |
| F-95 | Sumbang Soalan: submit, template, import, hantar kertas | W:1625-1630 | G | Yes | Partial (M04, L49 submit only) | Redesign-question | M04 + intake pipeline | Becomes the teacher PDF intake (D28e). Size L. |
| F-96 | Soalan hub, Soalan and Rujukan, Soalan Guru cipta | W:1661, 1765-1767 | G | Yes | Hidden-OOS | Redesign-question | M04 | Fold into intake and bank. |
| F-97 | Verify Soalan Berstruktur / MCQ | W:1676-1677 | G | Yes | Hidden-OOS | Redesign-question | M04 | Likely the teacher review step of the new pipeline (OQ-4). |
| F-98 | Set Soalan guru: create, edit, copy, results, publish, delete | W:1631-1641 | G | Yes | Partial (student side built; guru pages Hidden-OOS) | Replicate | M10 | Size M. |
| F-99 | Databank guru (SPM, per subject) | W:1642-1653 | G | Yes | Hidden-OOS | Merge-duplicate | M06 | Same data as student Databank (F-70). |
| F-100 | Soalan Berstruktur guru, Soalan Gambar | W:1713-1716 | G | Yes | Hidden-OOS | Redesign-question | M04 | |
| F-101 | Audio KBAT upload and templates | W:1717-1722 | G | Yes | Hidden-OOS (admin side built) | Replicate | M09 | Size S. |
| F-102 | Kertas Peperiksaan guru | W:1723-1724 | G | Yes | Hidden-OOS | Redesign-question | M04 | Candidate intake channel. |
| F-103 | Cikgu AI: chat send, RPH, Marking Karangan, PBD (run, export) | W:1731-1738 | G | Yes | Built M13 (S2-S6) | Replicate | M13 | |
| F-104 | Penjana Peperiksaan (build, documents) | W:1739-1740, 1776-1777 | G | Yes | Hidden-OOS | Replicate | M13 | Size M. |
| F-105 | Sumbang Artikel | W:1744-1745 | G | Yes | Hidden-OOS | Replicate | M09 | Size S. |

### 3.4 Portal Pentadbiran: dashboards, monitoring, reports

| ID | Feature | .cloud routes (evidence) | Roles | In .my? | In prototype? | v2 treatment | Owning module | Notes |
|---|---|---|---|---|---|---|---|---|
| F-120 | Dashboard admin: `/admin` Blade, Panel `/`, Filament Dashboard | W:535, P:185, FIL:Pages/Dashboard | A,AS,PPD | Yes | Docs-only (M17 `routes/dashboard.ts` empty) | Merge-duplicate | M17 | Three dashboards, one Papan Pemuka. |
| F-121 | Analitik: `/admin/analytics`, Panel `/analitik`, Filament Analitik | W:727, P:187 | A (AS own school) | Yes | Docs-only (M17) | Merge-duplicate | M17 | Panel refuses PPD (P:186). |
| F-122 | Command Center admin (+live data, Aktiviti Harian) | W:738-740, FIL:Pages/CommandCenter, DailyActivity | A,AS (refuses PPD) | Yes | Partial (M17 `routes/command-center.ts`; teacher variant built) | Redesign-portal | M17 | Pemantauan > Langsung, full-screen mode (D30). |
| F-123 | Monitoring admin, drill-down, CSV and PDF export | W:731, 791, 798, 1046, 1078 | A,AS (exports A only) | Yes | Docs-only (M17) | Replicate | M17 | Exports stay national-only (W:728-730). |
| F-124 | Laporan Eksekutif | W:725 | A,AS | Yes | Docs-only (M17) | Replicate | M17 | |
| F-125 | Laporan (aktiviti) | W:726 | A,AS | Yes | Docs-only (M17) | Replicate | M17 | |
| F-126 | Kirkpatrick admin (overview, T1-T4, chain, interventions, PDF) | W:741-747, 797 | A,AS | Yes | Built M12 (admin/guru twin) | Merge-duplicate | M12 | Three surfaces (admin Blade, guru, Filament pages). |
| F-127 | Performance and Server Status | W:732-733 | A (national) | Yes | Missing (M23) | Replicate | M23 | |
| F-174 | Data exports: users, questions, payments, schools, audit CSV; PDF: monitoring, Kirkpatrick, headcount | W:787-792, 797-798, 862-864 | A | Yes | Missing | Replicate | owning module of each dataset | Size S each; streamed, never loaded whole. |

### 3.5 Portal Pentadbiran: curriculum, question bank, SPM papers

| ID | Feature | .cloud routes (evidence) | Roles | In .my? | In prototype? | v2 treatment | Owning module | Notes |
|---|---|---|---|---|---|---|---|---|
| F-128 | Curriculum overview, Subjects, Tahap Pendidikan, Bab (Blade + Filament CRUD) | W:748-750, 916-917, 570; FIL:Subjects, EducationLevels, Chapters | A (AS read) | Yes | Built M03 | Merge-duplicate | M03 | Blade list + Filament editor today. |
| F-129 | Senarai Soalan (legacy): list, create, archive/enable, bulk archive-all / enable-filtered | W:751-753, 918-924 | A | Yes | Built M04 | Merge-duplicate | M04 | Folds into Bank Soalan; bulk tools stay until Studio has them (DOC:114-117). |
| F-130 | Import CSV soalan (dead stub in Blade; working importer in Filament, different CSV contract) | W:751; FIL:Pages/QuestionImport; DOC:28 | A | Yes | Built M04 (import + history) | Redesign-question | M04 | Replaced by the PDF intake pipeline. Do not carry two CSV contracts (DOC:118-119). |
| F-131 | Kualiti Soalan | W:752 | A | Yes | Built M04 | Merge-duplicate | M04 | Becomes a tab of Bank Soalan. |
| F-132 | Laporan Soalan (admin triage) | W:754 | A | Yes | Built M04 | Merge-duplicate | M04 | Becomes a tab of Bank Soalan. |
| F-133 | Soalan Berstruktur admin + rubric/scheme editor | W:755, 818-819, P:253-256 | A | Yes | Built M04 (read) | Redesign-question | M04 | Rubric editing becomes a question type. Two editors today (Blade and Panel). |
| F-134 | Kertas Soalan Guru (submissions, file download) | W:756, 822 | A | Yes | Built M04 | Redesign-question | M04 | Becomes the intake queue of the new pipeline. |
| F-135 | Question Studio: list, wizard, edit, preview, submit, publish, archive, edit-as-draft, stimulus upload | W:590-607, P:305-334 | A (national) | No | Missing | Redesign-question | M04 (new tasks) | Size L. Two copies (Blade `admin.studio.*`, Panel `panel.studio.*`); one in v2. |
| F-136 | Studio import: DOCX set upload, BI comprehension upload, import review (accept / reject / edit / accept-all), paper review / publish / unpublish | W:612-648 | A | No | Missing | Redesign-question | M04 (new) | Replaced by teacher PDF to OCR+AI to review to publish (D28e). Keep the human publish gate (DOC:51-54). |
| F-137 | Set Builder: create, pool/random generate, bank, drag-drop add / reorder / remove, section edit, attach Bahagian B document, publish, rename | W:654-675, P:341-375 | A (national) | No | Missing | Redesign-question | M06 / M04 (new) | Size L. Panel and Blade duplicates share one payload (P:336-340). |
| F-138 | Sumber Kertas (source-paper provenance registry) | W:678-680 | A | No | Missing | Redesign-question | M04 (new) | Size S-M. Becomes provenance inside the intake pipeline. |
| F-139 | Kertas Subjektif admin: listing + publish toggle; Panel Kertas CRUD (create, edit, delete, publish) | W:683-686, P:237-246 | A | No | Missing | Merge-duplicate | M06 (new) | Size M. Two admin surfaces for one thing. |
| F-140 | SPM hub and lanes (databank, tracking-a, subjektif, simulasi, kertas, latih-tubi) | W:691-692, P:196, 304 | A,AS (read) | No | Missing | Merge-duplicate | M06 (new admin) | Size M. Blade hub and Panel hub. |
| F-141 | SPM Quick Edit and Panel Soalan edit / show / update / preview | W:716-721, P:212-229 | A (AS gets "diuruskan oleh Admin Pusat" notice) | No | Missing | Merge-duplicate | M04 / M06 | Size M. |
| F-142 | Tracking A set editor: fill, swap, save, inline editor workspace | W:704-714, P:201-208 | A | No | Missing | Merge-duplicate | M06 (new) | Size L. Blade and Panel versions. |
| F-143 | Kontrak Blueprint (per-subject paper contract that gates publish) | P:262-267 | A | No | Missing | Redesign-question | M06 (new) | Size M. Governs Simulasi publish (conformance check). |
| F-144 | Simulasi paper review / edit: paper, section text, shared passage, reference panels, publish / unpublish / duplicate, soalan tambahan | P:276-302 | A | No | Missing | Redesign-question | M06 (new) | Size L. |
| F-145 | Tanda Karangan: confirm or adjust AI-proposed essay marks | P:219-222 | A, AS (menu item shown to school staff), PPD? | No | Missing | Replicate | M13 / M06 (new) | Size M. Route has no `pusat:` gate; confirm role scope (OQ-5). |
| F-146 | PKSK Soalan and PKSK Akses | W:895-896, FIL:PkskQuestions, PkskAccesses | A (questions national; access scoped) | Yes | Built M07 (admin) | Replicate | M07 | Whether PKSK items move into the canonical bank is OQ-4. |

### 3.6 Portal Pentadbiran: users, schools, finance

| ID | Feature | .cloud routes (evidence) | Roles | In .my? | In prototype? | v2 treatment | Owning module | Notes |
|---|---|---|---|---|---|---|---|---|
| F-147 | Users: list, create, edit, reset password, activate, bulk activate | W:757, 769-773, 865, 869 | A, AS (own school) | Yes | Built M02 | Replicate | M02 | Panel `/pengguna` duplicates list + activate (P:188-189). |
| F-148 | Bulk import users and Import Pelajar | W:760-764, 877-881, FIL:Pages/UserBulkImport, ImportStudents | A,AS | Yes | Built M02 (both pages) | Merge-duplicate | M02 | Two importers (users bulk-import vs import-students) plus Filament copies. |
| F-149 | Pelajar Komplimen | W:812-813, 882 | A | Yes | Built M02 | Replicate | M02 | |
| F-150 | Schools: list, create, edit, toggle active, rotate join code, search | W:777-784, 876, P:193-195 | A (AS own school) | Yes | Built M02 | Merge-duplicate | M02 | Blade + Panel + Filament. |
| F-151 | Langganan Sekolah | W:872 | A,AS | Yes | Built M02 | Replicate | M02 | |
| F-166 | Pembayaran, Billing dashboard, Dunning log, Invoices | W:901-903, FIL:Payments, Invoices, DunningLogs | A (AS scoped; PPD refused) | Yes | Missing (M19) | Merge-duplicate | M19 | Size L. "Billing" vs Invoices resource overlap. Gateway simulated (D14). |

### 3.7 Portal Pentadbiran: engagement and content

| ID | Feature | .cloud routes (evidence) | Roles | In .my? | In prototype? | v2 treatment | Owning module | Notes |
|---|---|---|---|---|---|---|---|---|
| F-152 | Gamifikasi admin: overview, Tier Config, Cabaran, Pelajar, Transaksi | W:887-891, FIL:Challenges, GamificationTiers | A (some national) | Yes | Missing (student side only) | Replicate | M14 | Size M. |
| F-153 | Kedai Hadiah admin, Hadiah (Katalog), Lencana Guru, Gamifikasi Guru, tebusan / tunai | W:801-802, 892-893, FIL:Gifts, TeacherBadges | A | Yes | Missing | Merge-duplicate | M15 | "Hadiah" page and Gifts catalog are the same thing (W:572). |
| F-154 | Kawalan Reward | W:894 | A (national) | Yes | Missing | Replicate | M15 | Size S. |
| F-155 | Cabutan Bertuah admin (lucky draws) | FIL:LuckyDraws | A | ? | Missing | Replicate | M15 | Size S. |
| F-156 | Tetapan Permainan and Games resource | W:897, FIL:Games, Pages/TetapanPermainan | A (national) | Yes | Missing | Merge-duplicate | M16 | Size S. |
| F-157 | Banner | W:898 | A | Yes | Built M09 | Replicate | M09 | |
| F-158 | Artikel admin | W:899 | A | Yes | Built M09 | Replicate | M09 | |
| F-159 | Nota admin | W:904 | A | Yes | Built M09 | Replicate | M09 | |
| F-160 | Video admin (Filament only) | FIL:Videos | A | ? | Unverified (M09 admin routes list banners, audio, screenshots) | Replicate | M09 | Size S. |
| F-161 | Audio KBAT admin (+templates) | W:900 | A | Yes | Built M09 | Replicate | M09 | |
| F-162 | Upload Screenshot | W:915 | A (national) | Yes | Built M09 | Replicate | M09 | |
| F-163 | Push Notifikasi (list, create, send) | W:820-821, 911 | A (national) | Yes | Missing | Replicate | M22 | Size M. |
| F-164 | Tiket Bantuan admin queue | W:808 | A,AS scoped | Yes | Built M22 (read-only, D27) | Replicate | M22 | D27 says Admin Sekolah cannot open it; `.cloud` scopes it (W:808 "scoped 23 Sep"). Re-check (Section 5). |
| F-165 | Chatbot admin: overview, analytics, knowledge base, conversation | W:805-807, 912 | A (knowledge national) | Yes | Missing | Replicate | M25 | Size M. |
| F-167 | Penajaan, Anak Angkat, Permohonan | W:883-885, FIL:Sponsors, FosterSponsorships, FosterApplications | A | Yes | Missing (M21 admin fragment empty) | Replicate | M21 | Size M. |
| F-168 | Permohonan Duta | W:886 | A | Yes | Missing | Replicate | M24 | Size S. |
| F-169 | Marketplace admin: Produk, Penjual | W:913-914, FIL:MarketplaceProducts, MarketplaceSellers | A (products national) | Yes | Missing | Replicate | M20 | Size M. |
| F-178 | Career paths, Universities, Scholarships admin CRUD (Filament only) | FIL:CareerPaths, Universities, Scholarships | A | ? | Missing | Replicate | M26 | Size M. Feeds F-27, F-28. |

### 3.8 Portal Pentadbiran: system, portals, cross-cutting

| ID | Feature | .cloud routes (evidence) | Roles | In .my? | In prototype? | v2 treatment | Owning module | Notes |
|---|---|---|---|---|---|---|---|---|
| F-170 | Tetapan Sistem (+ Filament Settings) | W:905-909, FIL:Settings | A (national) | Yes | Missing (M23) | Merge-duplicate | M23 | |
| F-171 | Feature toggles (flag per feature, used as `feature:` middleware on many student/guru routes) | W:870-871, e.g. W:974, 1150, 1310, 1460 | A (national) | ? | Missing; prototype hard-codes visibility in `out-of-scope.ts` | Replicate | M23 | Size M. Cross-cutting: also decides which menu items show. |
| F-172 | Log Audit (+ CSV export, Filament AuditLogs, `/admin/audit-log` redirect) | W:585, 792, 910 | A,AS scoped | Yes | Missing (M23; AI audit Hidden-OOS under M25) | Merge-duplicate | M23 | |
| F-173 | PPD and JPN portals: PPD 8 pages (dashboard, statistik, ranking, benchmark, leaderboard, peta haba, command center, export), JPN 3 pages | W:825-861 | PPD (AS gets notice) | Yes | Docs-only (M18 `routes.ts` empty) | Redesign-portal | M18 | Size L. Scope (district / state) is undecided in `.cloud` (W:847-848); see OQ-1. |
| F-175 | Panel Pengguna / Sekolah / Analitik React pages | P:186-195 | A,AS | Yes | n/a | Merge-duplicate | M02 / M17 | Duplicates of F-121, F-147, F-150; no new function. |
| F-176 | Filament panel as a surface (`/admin-filament`, about 36 resources + 35 pages) | FIL:Providers/AdminPanelProvider.php:35; User.php:35-38 | A,AS,PPD | No | Missing | Drop-legacy-dead | n/a | Functions are mapped row by row; the surface itself is retired (D30). |
| F-177 | Origin redirect maps (CRUD to Filament, record to parent, headcount, `/spm/latih-tubi` and other aliases) | W:552-583, 979-1039, 1045-1088 | all | No | n/a | Drop-legacy-dead | n/a | One route per function in v2; no legacy URL compatibility needed in a new system. |
| F-179 | Filament-only SPM pages: Set Soalan (SpmSet), Ramalan, Ramalan Gred, SPM Databank | FIL:SpmSets, Pages/Ramalan, RamalanGred, SpmDatabank | A | No | Missing | Merge-duplicate | M06 | Same data as Set Builder (F-137) and Tracking A editor (F-142). |
| F-180 | National-only gating (`pusat:` middleware) with the "diuruskan oleh Admin Pusat" notice | W:196, 305, 700, 727, 732-733, 870, 883, 888-889, 894-897, 905, 911, 913, 915; User.php:35 | AS,PPD | No | Missing (no role filter in `ADMIN_NAV`) | Redesign-portal | Portal Pentadbiran | D30: filter the menu, no visible-but-forbidden items. About 20 gated pages, listed in Section 7. |
| F-181 | Admin Sekolah screens (Statistik, DSKP Heatmap, Laporan Aktiviti, Amaran Awal, Laporan Bulanan, Senarai Pelajar / Guru, Kelas Sekolah, Aktiviti Guru) | no `/admin-sekolah/*` routes in `.cloud`; school staff use scoped `/admin/*` and Panel (W:533, P:182) | AS | Yes | Built M27 under `/admin-sekolah/*` | Redesign-portal | M27 | Prototype followed `.my`; v2 re-homes these in Portal Pentadbiran with role scope. |
| F-182 | Mobile API v1 (health, login, logout, me, subjects, setup, questions, quiz submit) | API:9-22 | M | No | n/a | Drop-legacy-dead | n/a | The SPA talks to the new backend; no mobile client in D28 (OQ-9). |
| F-183 | Scheduled jobs (`routes/console.php`) | routes/console.php | n/a | n/a | n/a | Replicate | backend (later) | Not a screen; list for the backend phase (dunning, digests). Not inspected in detail. |

## 4. Acceptance criteria for this gap analysis (verifiable)

- AC-1: Every route family in `routes/web.php`, `routes/api.php`, `app/Filament`, and the Panel nav (`resources/js/panel/layouts/panel-layout.tsx:32-42`) maps to at least one row in Section 3. Given a reviewer picks any route in `web.php`, when they search this file for its path or family, then a row is found.
- AC-2: Every row has exactly one treatment from the five allowed values and one owning module.
- AC-3: Given a row marked Missing, when the owner plans the sprint, then Section 5 gives its size.
- AC-4: Section 6 maps every duplicate cluster to exactly one D30 menu group.

## 5. `.cloud` features missing from the prototype (size S / M / L)

| # | Feature | Rows | Size | Why it matters |
|---|---|---|---|---|
| 1 | Portal Pentadbiran shell: single login, role-filtered menu, role + scope topbar, preview mode (new tab + banner), dual-role switcher, Ctrl+K | F-02, F-07, F-08, F-09, F-180 | L | Core of D30; every admin page hangs on it. |
| 2 | Question intake pipeline + Question Studio (create / edit / preview / submit / publish / archive / edit-as-draft) + import review + provenance (Sumber Kertas) | F-95-F-97, F-130, F-134-F-136, F-138 | L | D28e; needs the exam schema from the user. |
| 3 | Bijak SPM Simulasi (`/simulasi`, attempt, autosave, hantar, semakan, self-mark, cuba lagi) + Kuiz mode | F-74, F-75 | L | Biggest student-facing `.cloud`-only feature; targets SPM 2027. |
| 4 | Set Builder (+ random generate, Bahagian B documents) | F-137 | L | Only way papers are assembled in `.cloud`. |
| 5 | Tracking A set editor (fill / swap / save, inline editor) | F-142 | L | |
| 6 | Simulasi paper review / edit / publish gate | F-144 | L | Publish safety (DOC:51-54). |
| 7 | Kontrak Blueprint | F-143 | M | Publish conformance rules per subject. |
| 8 | Tanda Karangan (AI essay mark confirmation) | F-145 | M | Closes the AI-marking loop for Bahasa essays. |
| 9 | Kertas Subjektif viewer (student) + Kertas CRUD (admin) | F-76, F-139 | M | K2/K3/K4 page-image papers. |
| 10 | SPM admin hub / lanes / quick edit | F-140, F-141, F-179 | M | Entry to all SPM admin work. |
| 11 | Admin dashboards and Pemantauan (Papan Pemuka, Analitik, Monitoring, Laporan, Laporan Eksekutif, Langsung) | F-120-F-125 | L | M17 route fragments are empty. |
| 12 | PPD / JPN portals | F-173 | L | M18 route fragment empty; scope undefined (OQ-1). |
| 13 | Finance: Pembayaran, Billing, Dunning, Invoices, student Invois, Pricing | F-52, F-53, F-166 | L | M19 not started. |
| 14 | System admin: Tetapan, Feature toggles, Log Audit, Performance, Server status | F-127, F-170-F-172 | M | Feature toggles drive menu visibility. |
| 15 | Engagement back office: gamification admin, Kedai Hadiah / Gifts / Lencana, Kawalan Reward, Cabutan, Tetapan Permainan | F-152-F-156 | M | Student side exists; no way to configure it. |
| 16 | Commerce and sponsorship back office: Marketplace admin, Penajaan / Anak Angkat | F-167, F-169 | M | |
| 17 | Push Notifikasi + notification centre + Maklum balas | F-45, F-46, F-163 | M | |
| 18 | Chatbot admin + Pusat AI tools (6) | F-65 (widget), F-66, F-165 | L | M25 only has the Heatmap. |
| 19 | Visi and wellbeing features (Kombo, Cita-Cita, Universiti, Biasiswa, Psikometrik, Penguasaan, Pembetulan, Liga, Perutusan, Mood, Target SPM) + their admin CRUD | F-21, F-24, F-26-F-31, F-39, F-51, F-61, F-178 | L | M26 not started. |
| 20 | Duta programme (student + admin) | F-63, F-168 | M | M24 not started. |
| 21 | Guru extension tools (Kehadiran, Misi Harian, Jadual, Kelas Live, Broadcast, Gamifikasi Guru, Set Soalan guru pages, Penjana, Artikel, Audio upload) | F-89-F-94, F-98, F-101, F-104, F-105 | L (S-M each) | All Hidden-OOS today. |
| 22 | Google SSO | F-04 | S | |
| 23 | Remedial automation (guru) | F-86 | M | Unverified in prototype. |

## 6. Duplicates to merge (single target place in the D30 menu groups)

D30 menu groups: Papan Pemuka, Pemantauan, Bank Soalan, Kertas & SPM, Kurikulum & Kandungan, Pengguna & Sekolah, Penglibatan, Kewangan, Sistem.

| Duplicate cluster (surfaces today) | Target place (single) |
|---|---|
| Dashboard: `/admin` Blade, Panel `/`, Filament Dashboard (F-120) | Papan Pemuka |
| Analitik: `/admin/analytics`, Panel `/analitik`, Filament Analitik (F-121) | Pemantauan > Analitik |
| Command Center + Aktiviti Harian, admin and guru variants (F-122, F-85) | Pemantauan > Langsung (shared components with teacher view) |
| Monitoring + Laporan + Laporan Eksekutif (F-123-F-125) | Pemantauan |
| Kirkpatrick: admin, guru and Filament pages (F-126, F-88) | Pemantauan > Kirkpatrick |
| Question banks: legacy Senarai Soalan, Studio (Blade), Studio (Panel), Filament Questions, PKSK, Berstruktur (F-129, F-133, F-135, F-146) | Bank Soalan (one bank) |
| Question intake: Kertas Soalan Guru, DOCX import, BI import, CSV importer (two contracts), Sumbang Soalan, Kertas Peperiksaan guru (F-95, F-102, F-130, F-134, F-136) | Bank Soalan > Import and Semakan (one pipeline) |
| Kualiti Soalan, Laporan Soalan (F-131, F-132) | Bank Soalan (tabs) |
| Set Builder, Filament SpmSet, Blade + Panel builder (F-137, F-179) | Kertas & SPM > Set Builder |
| Tracking A editor: Blade, Panel, Filament Ramalan pages (F-142, F-179) | Kertas & SPM > Tracking A |
| Kertas Subjektif: admin toggle, Panel Kertas CRUD, student viewer, `/spm/subjektif` (F-72, F-76, F-139) | Kertas & SPM > Kertas |
| SPM hub: Blade hub, Panel hub, quick edit, Panel soalan edit (F-140, F-141) | Kertas & SPM (hub is the group landing) |
| SPM Mock vs Bijak SPM Simulasi vs Databank (F-70, F-73, F-74) | Kertas & SPM (needs decision, OQ-3) |
| Subjects / Levels / Bab: Blade list + Filament CRUD (F-128) | Kurikulum & Kandungan > Kurikulum |
| Banner, Artikel, Nota, Video, Audio KBAT, Screenshots (F-157-F-162) | Kurikulum & Kandungan |
| Users list: `/admin/users`, Panel `/pengguna`, Filament Users (F-147) | Pengguna & Sekolah > Pengguna |
| Importers: users bulk-import, Import Pelajar, Filament copies (F-148) | Pengguna & Sekolah > Import |
| Schools: Blade, Panel `/sekolah`, Filament Schools, search (F-150) | Pengguna & Sekolah > Sekolah |
| Kedai Hadiah page vs Gifts catalog vs teacher gifts (F-153) | Penglibatan > Hadiah |
| Gamification overview, Cabaran, Tiers, Pelajar, Transaksi (F-152) | Penglibatan > Gamifikasi |
| Tetapan Permainan vs Games resource (F-156) | Penglibatan > Permainan |
| Billing dashboard vs Invoices resource vs Payments (F-166) | Kewangan |
| Tetapan Sistem vs Filament Settings; Audit Log vs `/admin/audit-log` (F-170, F-172) | Sistem |
| Student-side URL twins: `/profile`, `/pelajar/profil`; `/prestasi`, `/pelajar/prestasi`; four leaderboards; `/tiket` vs `/pusat-tuisyen/tiket`; `/spm` vs `/pelajar/spm`; Latih Tubi `/practice`, `/latih-tubi`, `/spm/latih-tubi`; Tracking A `/spm/ramalan` vs `/spm/tracking-a` (F-11, F-22, F-27, F-32, F-33, F-35, F-42, F-47, F-69, F-71) | One canonical path each in Portal Pembelajaran |

## 7. Prototype differs from `.cloud` (where it followed `.my`) and needs re-alignment

Flag only the important ones.

| # | Prototype today | `.cloud` behaviour | Action |
|---|---|---|---|
| 1 | Admin Sekolah lives at `/admin-sekolah/*` (M27) | No such prefix; school staff use the same `/admin/*` pages scoped to their school (W:533, P:182; "scoped 23 Sep" comments) | Re-home M27 screens in Portal Pentadbiran, role-filtered (D30). |
| 2 | `ADMIN_NAV` copies `.my`: HARIAN / ANALITIK / PENGURUSAN / SISTEM plus Bilik Duta, Pusat AI, Visi, Killer Features sections that open student pages; footer "Ke Dashboard"; "Student View" | `.cloud` Panel nav is 6 items + Tanda Karangan (panel-layout.tsx:32-42); student pages are only reachable as read-only preview | Replace with the D30 groups; remove student sections from the admin menu. |
| 3 | Soalan menu = the six `.my` items | `.cloud` target menu is Studio-first (DOC:58-70) | Superseded by D28e / Bank Soalan. |
| 4 | Role gating: `admin` full menu; teacher reuses user nav; other roles get Lagi only (`adminMenuFor`) | `pusat:` gates make about 20 pages national-only: Kandungan SPM, Question Studio, Sunting Kandungan SPM, Kadar Tukaran Syiling, Cabaran Harian, Kawalan Ganjaran, Bank Soalan PKSK, Permainan, Penajaan, Tetapan Sistem, Notifikasi, Hantar Notifikasi, Pangkalan Pengetahuan Chatbot, Togol Ciri, Produk Marketplace, Tangkap Skrin, Prestasi Sistem, Status Pelayan, Analitik Kandungan, Portal PPD/JPN | Encode as the role-to-menu matrix of D30. |
| 5 | Auth follows `.my`: `/register`, password reset by IC | `/daftar` with school join code; school picker on login; Google SSO; separate admin login | Keep `.my` reset (F-06); align register and login with F-01, F-03, F-04. |
| 6 | Latih Tubi canonical `/spm/latih-tubi`, Tracking A `/spm/ramalan` | Canonical `/latih-tubi` and `/spm/tracking-a/{code}`; the others redirect | Use `.cloud` canonical paths. |
| 7 | Feature visibility is a static file (`out-of-scope.ts`) | Runtime feature flags (`feature:` middleware, Togol Ciri page) | Model flags as data (F-171). |
| 8 | Admin Sekolah ticket queue blocked (D27) | `/admin/tiket` is "scoped 23 Sep" (W:808), i.e. open to school staff | Re-confirm with the user (OQ-10); `.cloud` is primary. |
| 9 | M12 Kirkpatrick shows the `/guru/*` twin | `.cloud` also has `/admin/kirkpatrick/*` with PDF export (W:741-747, 797) | Keep one component set, two scopes. |
| 10 | Practice answers saved as quiz results only | Simulasi uses autosave + attempt + self-mark states | New data model in F-74. |
| 11 | Impersonation planned as "Menyamar" (D26 G1-8) | `.cloud` has explicit start / leave with session flag (W:758, 520) | Align with D30 preview mode. |
| 12 | M17 / M18 / M21 admin / M23 route fragments are empty files although G1 docs exist | n/a | Treat as Missing for planning. |

## 8. Non-functional requirements (for v2 G1, not decided here)

- Localisation: all UI copy in Bahasa Melayu; keep exact `.cloud` BM messages where flows are replicated.
- Privacy: no real names in seeds; psikometrik and wellbeing data (PHQ-9 / GAD-7 are described in ROLE-PORTALS.md for `.my`) need an explicit access and retention rule before M26 build.
- Security: role plus scope enforced server-side, not only by menu; staff preview is read-only.
- Responsive: 375 / 768 / 1280 (CLAUDE.md section 7).
- Accessibility replicates live (D10); light and dark mode (D29f).

## 9. Scope and assumptions

In scope: all rows above. Out of scope: public landing, `/present`, mobile API v1, Filament as a surface, legacy URL redirects, anything not in `.cloud` (D28c).
Assumptions: (a) Filament-only resources (Videos, Lucky draws, Career / University / Scholarship, Teacher badges, Duta applications) are in scope under their menu group; (b) external hand-offs (payment, WhatsApp, Google) are simulated (D14); (c) `.cloud` code at the local copy is current; (d) one `pegawai_ppd` role stays one role with a level attribute.

## 10. Open questions (blocking only)

| ID | Question | Blocks |
|---|---|---|
| OQ-1 | How is a PPD / JPN officer's scope set? `.cloud` has one role `pegawai_ppd`, no district / state column, and scopes by the officer's own school (W:847-848, "still undecided"). D30 wants district / state scope. Need: a district and state attribute on schools and officers, and which of the PPD 8 / JPN 3 pages each level gets. | M18 and the PPD / JPN menu |
| OQ-2 | What does Ibu Bapa see in Portal Pembelajaran? `.cloud` has only invite acceptance (W:1429) and the "Parent Whisperer" tool; there is no parent screen. Options: none beyond acceptance, read-only child summary, or Parent Whisperer only. | Portal Pembelajaran menu for IB |
| OQ-3 | Keep both SPM Mock (`/spm-mock`, M06) and Bijak SPM Simulasi (`/simulasi`), or merge into one Simulasi under Kertas & SPM? | M06 scope and the student SPM menu |
| OQ-4 | Who reviews teacher-uploaded PDFs: Admin Pusat only, or the teacher verifies first (`.cloud` has Verify Soalan Berstruktur / MCQ tools for teachers)? Do PKSK, Berstruktur and Audio KBAT items live in the same canonical bank as extra question types? Depends on the exam schema the user will share. | Intake pipeline design (D28e) |
| OQ-5 | Tanda Karangan: who may confirm essay marks (Admin Pusat only, or guru and school staff)? `.cloud` route has no national-only gate (P:219) and the nav shows it to school staff. | F-145 menu and permission |
| OQ-6 | Are Psikometrik instruments (including PHQ-9 / GAD-7 as described for `.my`) in v2? If yes, who may see results (counsellor-only, consent)? Does not block other modules. | M26 only |
| OQ-7 | Can one user hold two roles (D30 role switcher)? `.cloud` has a single `role` column. | User and permission model |

Non-blocking, parked: OQ-8 confirm `.cloud` has no password-reset flow (assumed none, `.my` one kept); OQ-9 mobile client in scope? (assumed No); OQ-10 re-confirm D27 (Admin Sekolah and ticket queue) against `.cloud`.
