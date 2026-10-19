# v2 Final Visual and Responsive Sweep

Slug: v2-frontend. Target: production preview http://localhost:5191 (Docker `pretasiplus-preview`, not touched). Date: 2026-10-18. Tester: qa-engineer, Playwright lane 2 only.
Screenshots: `D:\Dev Projects\pretasiplus-app\.playwright-mcp\qa-final\`. Scripts: `D:\Dev Projects\pretasiplus-app\.playwright-mcp\lane2\qa-final-scripts\`.

## Summary

Verdict: **Not ready for the user's review until the 8 Major items below are fixed.** No Blocker was found.

Counts: Blocker 0, Major 8, Minor 12 (rows in the table).

What was executed:
- All sidebar routes read live per role: student 45, teacher 19, school admin 22, admin 32 (admin groups expanded to read all 30 links). Also the account menu links (Profil, Tetapan, Panduan, Tiket, Log Keluar) and the public auth pages (/login, /register, /password/reset, /password/reset-ic, 404).
- Sizes: 375x812 light, 768x1024 light, 1280x800 dark, 1440x900 light, for every route and role (about 450 route-size loads).
- Student portal defaults to dark even when the OS is light (see m-09). I therefore re-ran student at 375 and 1440 in light mode by setting `pp.theme=light` (scripts `studentL_*`).
- Automated checks per load: legacy-island element, white card on dark shell, horizontal scroll (px and element), truncated or clipped text, monotone icon chips, blank page, console errors, duplicate titles, "Belum tersedia", dark-mode text contrast. I then looked at the screenshots to confirm each finding.

Clean results (all executed):
- Horizontal page scroll: none at any size, any role.
- `legacy-island`: none. White card on dark shell: none (the two detector hits were the lime podium and auth tile, which are intentional).
- "Belum tersedia": none reachable from any menu link. Console errors: none on any route. 404 only for non-existent URLs.
- Log Keluar: 1 click on desktop (Menu akaun) and 2 clicks on mobile (menu drawer, then account block) in all four portals.
- Account-menu links all resolve to built pages for student, teacher and school. The admin account menu has only Tetapan, theme, Masuk Mod Pelajar, Log Keluar (no Profil, Panduan or Tiket there; Tiket is in the admin sidebar).

Not covered or caveats (be aware):
- 320px was not tested (only 375, 768, 1280, 1440). Dark mode was tested at 1280 only, as briefed; student is dark by default at all sizes, so it was also seen dark at 375, 768 and 1440.
- Pages were audited about 1.8 s after the h1 appeared. `/practice/progress` needs about 4 s to fill (m-12), and `/guru/command-center` shows a faded loading state for a few seconds. A slow page could have been audited mid-load.
- Only first-paint states were checked, not modals, dropdown contents, forms or empty/error states.
- One harness artefact: after a role switch inside one session, a reload restored the previous (student) session because only localStorage/sessionStorage were cleared. I believe this is test-harness only (IndexedDB or similar not cleared) and did not reproduce after a clean login; it is not logged as a bug.

## Issues

Severity: Major = visible defect on a main screen or unreadable/clipped important text; Minor = polish or accessibility.

| ID | Role | Screen | Path | Size | Issue | Sev | Screenshot |
|---|---|---|---|---|---|---|---|
| M-01 | admin | Kirkpatrick T3 Tingkah Laku, heatmap "Corak Masa Aktiviti" | /admin/kirkpatrick/behavior | 1280 dark | Dark navy numbers on mid-blue heat cells (e.g. 4147, 4210, 4479, 6253) are unreadable, contrast about 1.1 to 2:1. Number colour does not adapt to the cell shade in dark mode. | Major | admin_behavior_lowcontrast_1280d.png |
| M-02 | public | Daftar (step 1) | /register | 1280 dark | "Darjah 1 to 6" tiles and the Pelajar/Guru emoji labels are near invisible (about 1.5:1, slate text on dark card). User cannot see the level choices. | Major | sw_public_1280d__register.png |
| M-03 | all four | Sidebar labels (shell) | every route | 1280 and 1440 | Menu labels clipped with ellipsis: "Command ..." (+LIVE badge, teacher and school), "Sekolah Be..." (+NEW), "Soalan by Chap...", "Heatmap Topik Lem...", "Mohon Keluarga An...", admin "T2: Pembelaja...", "T3: Tingkah L...", "Kurikulum ...", "Pengguna ...", and account block "Pentadbir Seko...", "Admin Pusat . Sel...". Important navigation text cannot be read in full. | Major | dash_school_1440.png, dash_admin_1440.png, admin_behavior_lowcontrast_1280d.png, dash_student_1440_lightmode.png |
| M-04 | admin | Command Center, Top Sekolah list | /admin/command-center | 375, 1440 | Every school name is cut at the same prefix ("SEKOLAH MENENGAH K...", "SEKOLAH MENENGAH KE...", "SEKOLAH MENENGAH ..." at 375), so rows are indistinguishable. | Major | dash_admin_1440.png, dash_admin_375.png |
| M-05 | admin | Shell header, all admin pages | all /admin/* | 375 | Two hamburger buttons side by side in the top bar before the title ("two menu icons then Langsung"). Ambiguous duplicate control. | Major | dash_admin_375.png |
| M-06 | teacher | Mobile bottom nav | /guru and all teacher pages | 375 | Bottom-nav label "Dashboard" breaks mid-word ("Dashboar / d"), label is clipped in its pill. | Major | sw_teacher_375l__guru.png |
| M-07 | student | Sidebar item "Analisa Item" | /analisa-item (link from sidebar) | all | The menu link silently redirects to /dashboard. Student has no such page, so the menu entry is a dead link that lands on Dashboard (header then shows the Dashboard title). Must be removed or built. | Major | sw_student_1280d__analisa_item.png |
| M-08 | admin, school | Command Center KPI row and section chips | /admin/command-center, /admin/command-center/daily-activity, /admin-sekolah/command-center | all | Every icon chip is the same colour: 13 or 14 chips on admin pages (all blue, rgb 98,131,255 dark / 36,64,240 light), 12 chips on the school Command Center. The user requires varied accents. | Major | sw_admin_1280d__admin_command_center.png, sw_school_1280d__admin_sekolah_command_center.png |
| m-01 | school | Mobile bottom nav | /admin-sekolah and all school pages | 375 | Bottom nav has a single tab ("Lagi"); every other destination is hidden behind it. Reachable but looks unfinished next to the teacher (5 tabs) and student (5 tabs). | Minor | sw_school_375l__admin_sekolah.png |
| m-02 | admin | Import Pelajar (ID Delima) | /admin/import-students | all | 4 icon chips all one colour. | Minor | sw_admin_1280d__admin_import_students.png |
| m-03 | teacher | Laporan | /guru/laporan | all | 4 icon chips all one colour. | Minor | sw_teacher_375l__guru_laporan.png |
| m-04 | student | Topik Pembelajaran | /topics | all | 125 identical blue book chips on every topic card; grey filter chips. Monotone catalogue. | Minor | swL_student_1440l__topics.png |
| m-05 | student, teacher, school, admin | Duplicate titles (shell title and page h1 show the same text) | student: /dashboard, /remedial/saya, /practice/revision, /practice/progress, /practice/history, /leaderboard; teacher: /guru/command-center; teacher, school, student: /pusat-tuisyen/tiket; admin: /tetapan; school /admin-sekolah repeats "Dashboard Sekolah" as a body heading under the shell title | 1280, 1440 | Same title shown twice within 200 px. | Minor | swL_student_1440l__practice_progress.png, teacher_1280d_cc.png, dash_school_1440.png |
| m-06 | student, teacher, school, admin | Heading structure | 37 student, 17 teacher, 20 school, 32 admin pages at 1280/1440 | 1280, 1440 | Shell header has an h1 nested inside an h1 plus a second page h1 (admin command center has 3). At 375/768 teacher, school and most student pages have no h1 and no visible shell title at all. | Minor | dash_admin_1440.png, sw_teacher_375l__guru.png |
| m-07 | admin | Page titles in the mobile header | /guru/monitoring, /admin/kirkpatrick, /admin/kirkpatrick/learning, /admin/kirkpatrick/behavior, /admin/questions/import, /admin/questions/quality, /admin/curriculum, /admin/education-levels, /admin/users, /admin/import-students | 375 | Header h1 ellipsised ("Pengurusan Tahap Pendidikan" is cut at about 190 px). | Minor | sw_admin_375l__admin_users.png |
| m-08 | admin, teacher, school, student | Tap targets under 24 px | /admin/subjects (14), /admin/education-levels (11), /admin/import-students (11), /tetapan (4 on every role), /video (3), student /dashboard (2), /mohon-keluarga-angkat (1), /artikel (1), /guru/monitoring (1) | 375 | Small controls (icon buttons, checkboxes). | Minor | sw_admin_375l__admin_import_students.png |
| m-09 | student | Theme default | all student routes | all | Student shell is dark by default even when the OS prefers light; teacher, school and admin default to light. First paint of the student portal therefore disagrees with the other portals. | Minor | dash_student_1440.png |
| m-10 | student | First login on /dashboard | /dashboard | 375, 1440 | The "Pilih rakan belajar awak" bottom sheet covers the dashboard on every fresh login and intercepts clicks until "Batal" or "Pilih". | Minor | dash_student_375.png |
| m-11 | student | Sidebar group "Pusat AI" | all student routes | 1280, 1440 | Group heading with no items under it. | Minor | dash_student_1440_lightmode.png |
| m-12 | student | Kemajuan Saya | /practice/progress | 375, 768, 1440 | Only title and range tabs for about 4 s (no skeleton), then content appears; on first audit it read as blank (0 chars) on several loads. Header stats showed 0 hari / 0 Koin in the slow loads. | Minor | student_768_progress.png |

## Grouped by module

| Module | Issues |
|---|---|
| Shell / navigation (portal layouts, all roles) | M-03, M-05, M-06, M-07 (menu entry), m-01, m-06, m-08, m-09, m-10, m-11 |
| M01 Authentication (/register) | M-02 |
| M08 Student performance (student menu link "Analisa Item") | M-07 |
| M12 Kirkpatrick (admin) | M-01, m-07 (kirkpatrick titles) |
| M17 Command Center (admin, school, teacher) | M-04, M-08, m-05 (teacher CC) |
| M03 Curriculum / admin CRUD screens | m-07, m-08 (subjects, education-levels) |
| M02 Users and schools (import students) | m-02, m-07, m-08 |
| M10 Teacher class and reports | m-03, m-05 (tiket) |
| M05 Practice | m-05 (revision, progress, history), m-12 |
| M09 Content (topics) | m-04 |
| M14 Gamification / leaderboard | m-05 (/leaderboard) |
| Remedial | m-05 (/remedial/saya) |

## Blocker and Major list (each with its module)

1. M-01, M12 Kirkpatrick: T3 heatmap numbers unreadable in dark mode.
2. M-02, M01 Authentication: /register dark mode, Darjah tiles unreadable.
3. M-03, Shell/navigation (all portals): sidebar labels and account block clipped.
4. M-04, M17 Command Center (admin): Top Sekolah names truncated identically.
5. M-05, Shell (admin): duplicate hamburger buttons on mobile.
6. M-06, Shell (teacher): bottom-nav "Dashboard" breaks mid-word at 375.
7. M-07, M08/Shell (student): sidebar "Analisa Item" is a dead link redirecting to Dashboard.
8. M-08, M17 Command Center (admin and school): all KPI icon chips the same colour.

Blockers: none.

## Suggested owners

Frontend-developer for all items; M-07 also needs a product decision (remove the student menu entry or build the page).
