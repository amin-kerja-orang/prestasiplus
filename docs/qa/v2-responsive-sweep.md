# v2 Responsive Sweep (375 / 768 / 1280)

Date: 2026-10-17. Target: production preview http://localhost:5191 (not rebuilt). Tool: Playwright lane 2, light mode, client-side navigation (`history.pushState` + `popstate`), scripted per-route audit. Scripts: `.playwright-mcp/lane2/scripts/`. Screenshots: `.playwright-mcp/qa-responsive/`.

## Summary

- Routes audited: **~175 route x 3 sizes** (Student 49, Guru 33, Admin Sekolah 28, Admin 59 incl. 6 `/admin/p/*` placeholders sampled out of 70, public 8, plus `/nonexistent`/404 per portal). Every route was run at 375x812, 768x1024 and 1280x800.
- **No failure at 768 or 1280** on any route. No clipped or overlapping content at those sizes, no content hidden behind the bottom nav, no horizontal page scroll.
- **Two Major defects, both at 375 only** (both reproduce below 376 px; worse at 320):
  1. **RESP-01** Student (Pembelajaran frame) header overflows. The theme toggle is pushed past the right edge and the whole page scrolls horizontally. Hits every Pembelajaran-frame route (47 routes at 375).
  2. **RESP-02** Admin Command Center student detail: breadcrumb with long school name overflows (5 of 5 student ids tested, 8 to 68 px).
- Minor: small touch targets at 375 (aggregated, RESP-03), plus one Minor note on admin placeholder/Command Center link density.
- Public pages (`/login`, `/register`, `/password/reset*`, `/__ds`, 404) are clean at 375/768/1280, and `/login`, `/register`, `/password/reset` are also clean at 320 and 360.
- Guru and Admin Sekolah (staff frame) and Admin (Pentadbiran frame) are clean at all three sizes apart from RESP-02. Staff frame mobile nav ("Lagi" bottom bar) never hides the last element; Admin has a "Buka menu" button (44x44).
- Dark mode spot check at 375 (Student, Guru, Admin Sekolah, Admin dashboards): same results as light. Student dark still has the 2 px header overflow (RESP-01); the others have none. 768 dark Student dashboard: no overflow.

### Counts

| Severity | 375 | 768 | 1280 | Distinct routes |
|---|---|---|---|---|
| Major (horizontal scroll or unusable) | 52 route-sizes (47 RESP-01 + 5 RESP-02) | 0 | 0 | 52 |
| Minor (cosmetic / touch size) | aggregated (RESP-03) | 0 | 0 | see RESP-03 |

Measurement note: Chromium here renders a 15 px classic scrollbar. "Overflow px" below is `scrollWidth - innerWidth` (what an overlay-scrollbar phone sees). With the classic scrollbar the page scrolls 15 px more (e.g. RESP-01 shows 17 px instead of 2 px).

## Defects

| ID | Role | Screen | Path | Size | Issue | Overflow px | Offending element | Severity | Screenshot |
|---|---|---|---|---|---|---|---|---|---|
| RESP-01 | Student | All Pembelajaran-frame screens (47 routes, list below) | e.g. `/dashboard` | 375 | Header right cluster (streak chip, coin chip, avatar, theme toggle) needs about 376 px; at 375 the theme toggle is clipped at the right edge and the page scrolls horizontally. Measured: 2 px at 375, 17 px at 360, 57 px at 320. Also visible as a horizontal scrollbar under the sheet. | 2 (17 with scrollbar) | `div.ms-auto.flex.min-w-0.items-center.gap-1` (width 229, scrollWidth 253) containing `button[data-testid=pembelajaran-theme-toggle]` (right = 376); in `src/shells/pembelajaran/PembelajaranLayout.vue` | Major | `student_dashboard_375.png`, `student___dashboard__375.png` (one per route: `student___<route>__375.png`) |
| RESP-02 | Admin | Command Center, student detail | `/admin/command-center/student/{102,83,53,35,25}` | 375 | Breadcrumb crumb link `a[data-testid=cc-crumb]` holds a long school name in `span.truncate`, but the link is `inline-flex` with `min-width:auto`, so it never shrinks and truncation never happens. The crumb (385 px) is wider than its nav (328 px). | 27 / 8 / 51 / 27 / 68 (ids 102/83/53/35/25) | `a[data-testid=cc-crumb]` > `span.truncate` ("SEKOLAH MENENGAH KEBANGSAAN ..."), `src/modules/m17-admin-dashboard/components/command-center/CcFrame.vue` | Major | `admin___admin_command_center_student_102__375.png` (also `_83`, `_53`, `_35`, `_25`) |
| RESP-03 | All | Many screens | all | 375 | Interactive targets under 32 px (sampled). Examples: header logo link 111x24 (every Pembelajaran page); streak/carousel dot buttons 12x12 and 16x16 (Student dashboard, remedial); `/guru/monitoring` 28 links 240x24 and Command Center feed links 121x16; admin table select-all checkboxes 16 to 20 px (`/admin/users`, `/admin/comp-students`, `/admin/pksk/questions`); toggle switches 36x19 and 40x21 (`/admin/subjects`, `/admin/education-levels`, `/tetapan`); `/guru/kelas/cipta` 12 small targets; `/video` 11 to 13. | 0 | n/a | Minor | n/a (sampled) |

Other observations (not defects):
- `/headcount`, `/laporan-mingguan` render the 403 page; `/analisa-item` redirects (Student to Dashboard, Guru to `/analisa-item/kelas`, Admin Sekolah to `/analisa-item/sekolah`); `/prestasi` redirects to `/prestasi/sekolah`; `/admin` redirects to `/admin/command-center`. All as documented in `docs/AKAUN-DEMO.md`.
- Student `/panduan` (public-style frame) has no header overflow at 375, confirming the cause is the Pembelajaran header, not page content.
- Truncated headings with `text-overflow: ellipsis` (for example `h2.truncate[chapter-subject-name]` at 1280 on `/practice/chapter`) are intentional and were not counted as clipped.
- `student___nonexistent_page__375.png` was deleted by accident during cleanup; the 404 placeholder shows the same RESP-01 header issue.
- Not covered: `/admin/p/*` placeholders beyond 6 samples (single shared component), detail routes that do not exist for Guru/Admin Sekolah (`/guru/command-center/student/:id` and `/admin-sekolah/command-center/student/:id` render not-found or placeholder with no overflow), flows inside modals and drawers, and the Bijak SPM attempt/results routes (need an attempt id; only `/spm/bijak` and `/spm/bijak/sejarah` were audited).

## Per-module grouping (for fix assignment)

| Module / area | Folder | Failing routes | Defect |
|---|---|---|---|
| Pembelajaran shell (Student frame) | `src/shells/pembelajaran/PembelajaranLayout.vue` | All 47 Student routes at 375 (list below) | RESP-01 |
| M17 Admin dashboard, Command Center | `src/modules/m17-admin-dashboard/components/command-center/CcFrame.vue` | `/admin/command-center/student/:id` (5 of 5 tested) | RESP-02 |
| Small targets (shared design-system / per module) | `src/shells/pembelajaran` (logo link, dots), `m10-teacher-class`/`m11-teacher-analytics` (monitoring), `m02-users-schools`, `m03-curriculum` (admin tables, toggles), `m01` (`/tetapan`) | see RESP-03 | RESP-03 |

### RESP-01 route list (all fail at 375 only; 768 and 1280 pass)

By module folder inferred from route:
- Dashboard, shell: `/dashboard`, `/analisa-item` (redirect to dashboard)
- m05-practice: `/practice`, `/practice/chapter`, `/practice/revision`, `/practice/progress`, `/practice/history`, `/latihan-berstruktur`, `/remedial/saya`, `/topics`, `/peta-belajar`, `/set-soalan-saya`
- m06-spm / m28-bijak-spm: `/spm`, `/spm/bijak`, `/spm/bijak/sejarah`
- m07-pksk: `/pksk`
- m08-student-performance: `/prestasi` (redirect `/prestasi/sekolah`), `/analitik/pelajar`, `/buku-nota/heatmap`, `/ranking`, `/leaderboard`, `/timeline`
- m09-content: `/artikel`, `/artikel/5-tips-belajar-matematik`, `/video`, `/audio-kbat`
- m10-teacher-class: `/kelas-saya`, `/mohon-keluarga-angkat`, `/jemput-ibu-bapa`
- m14-gamification / m15-rewards-shop: `/gamification`, `/gamification/convert`, `/gamification/challenges`, `/gamification/rewards`, `/gamification/leaderboard`, `/gamification/achievements`, `/gamification/mystery-box`, `/gamification/referral`, `/cabutan`, `/marketplace` (m20)
- m13-cikgu-alesa: `/cikgu`, `/cikgu/hadiah`
- m16-battle-games: `/permainan`, `/tournament`
- m01 / shell: `/profile`, `/tetapan`
- m22-support-tickets: `/pusat-tuisyen/tiket`
- 404 placeholder: `/nonexistent-page`

Passing at 375 (no header overflow): `/headcount` (403), `/panduan`.

## Verdict

**Not ready for the responsive gate (G5).** Two Major defects remain, both at 375 only. The fixes are small: shrink or reflow the Pembelajaran header cluster so it fits at 320 px (RESP-01, one component, clears 47 routes), and add `min-w-0` and truncation on the Command Center crumb link (RESP-02). Re-run `.playwright-mcp/lane2/scripts/s1.js`, `s2.js`, `s3.js` and `d3.js`, `d4.js` after the fix.

## Re-test (after RESP-01 / RESP-02 fixes)

Date: 2026-10-17. Preview rebuilt by the coordinator; same method (lane 2, light mode, client-side navigation). Scripts: `.playwright-mcp/lane2/scripts/rs1.js`, `rs2.js`, `rs3.js` (Student at 320/375/768), `rd4.js` (Admin student detail at 320/375/768). Failure screenshots use the `re_` prefix in `.playwright-mcp/qa-responsive/`.

Method note: the Student "choose a study friend" sheet opens after every Student login and covers the new fixed bottom nav. The first run reported a false "content hidden behind nav, 52 px" at 320/375 because of that sheet. After dismissing it ("Batal"), and with a manual scroll-to-bottom check, the last content sits 60 px above the bottom nav (nav top 744, content bottom 684, main bottom padding 128 px). No overlap.

| Check | Size | Routes | Pass | Fail (Major) | Minor |
|---|---|---|---|---|---|
| Student, all routes (RESP-01) | 320 | 49 | 49 | 0 | 1 (`/cikgu`) |
| Student, all routes | 375 | 49 | 49 | 0 | 1 (`/cikgu`) |
| Student, all routes | 768 | 49 | 49 | 0 | 1 (`/cikgu`) |
| Admin `/admin/command-center/student/{102,83,53,35,25}` (RESP-02) | 320 | 5 | 5 | 0 | 0 |
| Admin student detail | 375 | 5 | 5 | 0 | 0 |
| Admin student detail | 768 | 5 | 5 | 0 | 0 |
| Dashboards, all 4 roles (Student `/dashboard`, Guru `/guru`, Admin Sekolah `/admin-sekolah`, Admin `/admin/command-center`) | 320 | 4 | 4 | 0 | 0 |

Result: **RESP-01 fixed, RESP-02 fixed.** Overflow at 375 is now at most 0 (was 2 px, 17 px with scrollbar), the theme toggle is fully visible, and no route fails at 320. Guru and Admin Sekolah Command Center pages also pass at 320/375/768.

### Remaining observations

| ID | Severity | Where | Detail |
|---|---|---|---|
| RESP-04 | Minor | Student `/cikgu`, 320/375/768 | `button.rounded-sm.ring.ring-inset.ring-accented` is 16x16 but its content is 28 px wide (`scrollWidth 28`, `clientWidth 16`, overflow hidden). Looks like a dot or swatch whose active state is wider than its box. Screenshot: `re_student___cikgu__375.png`. Not a layout break. |
| RESP-05 | Minor | Student `/dashboard` and `/prestasi/sekolah` at 320 | With Chromium's classic 15 px scrollbar the page scrolls 9 px sideways (`scrollWidth 314` vs `clientWidth 305`). Relative to the 320 px viewport (overlay scrollbars on phones) there is no overflow (-6). Other Student routes show no such scroll. Low risk; check the content min width if 320 with classic scrollbars matters. |

### RESP-03 touch targets, re-measured (375)

| Target | Before | After | Status |
|---|---|---|---|
| Student header logo link | 111x24 on every Student route | Not flagged on any Student route (all "small" counts dropped, for example `/remedial/saya` 3 to 0) | Fixed |
| Student carousel dots | 12x12 (dashboard), 16x16 (many pages) | 12x12 still on `/dashboard`; 16x16 only on `/cikgu`; gone from other pages | Partly fixed |
| Student `/tetapan` switches | 40x21 | 40x21 (`tetapan-spiritual_mode`), 4 targets | Not fixed |
| Student `/video` subject pills | 119x28 | 119x28 (10 targets) | Not fixed (28 px high) |
| Student `/artikel`, article text links | 17 px high | 17 px high (inline text links) | Unchanged, low value |
| Admin switches (`/admin/subjects`, `/admin/education-levels`) | 36x19 | 36x19, no label hit area | Not fixed |
| Admin checkboxes (`/admin/users`, `/admin/comp-students`, `/admin/pksk/questions`) | 16 to 20 px | 20x20 (users, comp-students), no larger hit area | Not fixed |
| Command Center logo (Guru, Admin Sekolah) | 111x24 | 111x24 at 320/375, 117x25 at 768 | Not fixed |

### Re-test verdict

Responsive layout gate: **Pass for Major issues** (0 horizontal scroll or clipped content on any Student route at 320/375/768, Admin student detail at 320/375/768, and all four dashboards at 320). The remaining items are Minor (RESP-03 partly open, RESP-04, RESP-05). Not covered in this re-test: Guru, Admin Sekolah and Admin routes other than the ones named above (they passed at 375/768/1280 in the first sweep; the fix touched only the Student shell and the Command Center crumb).
