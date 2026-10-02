# M03 — Element inventory & link crawl: summary

- **Captured:** 2026-09-25, live https://prestasiplus.my, read-only, admin session (browser lane 1).
- **Method:** same pipeline as M01/M02 (`tools/inventory.js` → `tools/run-state.js` → `tools/split-batch.js` → `tools/merge-inventory.js` → `tools/diff-narrative.js`). Capture plan: `tools/jobs/M03.js` (71 UI states over 14 screens, groups A–G); screen map: `tools/jobs/M03.screens.json`; screenshots: `tools/jobs/M03.shots.js` + `tools/shoot.js` (37 PNG in `docs/discovery/img/M03/`). **No shared tool was modified.**
- **Privacy:** there is no personal data on M03 screens. `sanitize` was switched **off** because `tools/sanitize.js` treats the "Nama (BM)" column and `name` inputs as personal and would have masked subject names. The only account string is the system account "Admin PRESTASI+" (shell); emails are replaced by `<email>` by the inventory itself. Every job runs an in-page `SCRUB` action that replaces CSRF tokens inside attribute values (the "Aktif?" switch `fetch()` headers) with `CSRF`. A grep of all raw files for 40-character tokens and e-mail addresses found none.
- **Data rows:** list/tree rows are data-driven and were limited with `repeat` (S1 tree: 2 chapters, 3 topic blocks, 3 subtopic rows / edit forms; S6: first 8 of 31 subjects (covers the Teras→Elektif change); S12: 6 of 125 cards). Full data is in `_curriculum-data.json` (every level, subject, subject×level tree, and all 125 student topics), and the narrative's Appendix B.
- **Files:** `S1-curriculum.json` … `S14-peta-belajar.json`; `SHA-admin-shell.json`, `SHU-user-shell.json` (layout chrome, owned by the global doc); `_crawl.json`; `_curriculum-data.json`; raw captures `../_raw/M03/*.json` (71).
- **Status legend:** as M01/M02 (`visible-default`, `conditional`, `hidden-only`, `mobile-only`, `desktop-only`). `normalizeIds` is on.

## 1. Per-screen counts

M03 content totals **807 elements** over 14 screens and **71** captured states (1280 / 768 / 375). Shells add 229 (admin) + 378 (user portal) chrome elements.

| Screen (route) | Total | Visible default | Conditional | Hidden only | Mobile only | Desktop only | States | States captured |
|---|---|---|---|---|---|---|---|---|
| S1-curriculum `/admin/curriculum` | 160 | 10 | 95 | 55 | 0 | 0 | 17 | default (no filter), subject-only, math-t4, math-t4-topic-open, math-t4-add-subtopic, math-t4-chapter-collapsed, bm-d1-topic-open, bm-d1-edit-subtopic, empty-tree, level-not-offered, flash-chapter-id, flash-bab-404 (@1280); default@375, math-t4@375, bm-d1-topic-open@375, default@768, math-t4@768 |
| S2-chapter-create `/admin/curriculum/chapters/create` | 21 | 18 | 2 | 1 | 0 | 0 | 4 | default (pre-selected), no-params (@1280); default@375, default@768 |
| S3-chapter-edit `/admin/curriculum/chapters/{id}/edit` | 23 | 21 | 0 | 2 | 0 | 0 | 3 | default @1280/375/768 |
| S4-topic-create `/admin/curriculum/topics/create?chapter_id={id}` | 24 | 22 | 0 | 2 | 0 | 0 | 3 | default @1280/375/768 |
| S5-topic-edit `/admin/curriculum/topics/{id}/edit` | 27 | 25 | 0 | 2 | 0 | 0 | 3 | default @1280/375/768 |
| S6-subjects `/admin/subjects` | 62 | 45 | 1 | 16 | 0 | 0 | 4 | default, flash-404 (@1280); default@375, default@768 |
| S7-subject-create `/admin/subjects/create` | 49 | 48 | 0 | 1 | 0 | 0 | 3 | default @1280/375/768 |
| S8-subject-edit `/admin/subjects/{id}/edit` | 50 | 48 | 0 | 2 | 0 | 0 | 3 | default @1280/375/768 |
| S9-levels `/admin/education-levels` | 83 | 60 | 1 | 22 | 0 | 0 | 4 | default, flash-404 (@1280); default@375, default@768 |
| S10-level-create `/admin/education-levels/create` | 21 | 20 | 0 | 1 | 0 | 0 | 3 | default @1280/375/768 |
| S11-level-edit `/admin/education-levels/{id}/edit` | 22 | 20 | 0 | 2 | 0 | 0 | 3 | default @1280/375/768 |
| S12-topics `/topics` | 119 | 33 | 83 | 3 | 0 | 0 | 9 | default, grade-d1, subject-sains, d1-sains, grade-t4-hidden, subject-geografi-hidden, empty (@1280); default@375, default@768 |
| S13-topic-show `/topics/{id}` | 60 | 50 | 7 | 3 | 0 | 0 | 4 | default (topic 7), bm-t5 (topic 68) (@1280); default@375, default@768 |
| S14-peta-belajar `/peta-belajar` | 86 | 29 | 54 | 3 | 0 | 5 | 8 | default, math-d1, bm-d2, geografi-empty, unknown-subject, grade-d6-clamped (@1280); default@375, default@768 |
| SHA-admin-shell (chrome of S1–S11) | 229 | 78 | 39 | 112 | 7 | 73 | 50 | all admin states |
| SHU-user-shell (chrome of S12–S14) | 378 | 157 | 21 | 200 | 15 | 148 | 21 | all user-portal states |

S1's default state is the unfiltered prompt card, so most tree elements are `conditional`. Hidden-only elements are mainly `_token`/`_method` hidden fields, closed inline subtopic forms of non-first rows, and the tournament-banner templates (S12–S14). S14 "desktop-only" = the hero stat tiles (`hidden md:flex`).

Empty/error states captured: S1 prompt "Sila pilih subjek dan tahap pendidikan", S1 "Tiada bab dijumpai untuk subjek dan tahap ini.", S1 "Tiada subtopik", flash "Chapter ID diperlukan." and "Bab tidak dijumpai." (S1), "Subjek tidak dijumpai." (S6), "Tahap Pendidikan tidak dijumpai." (S9), S12 "Tiada topik tersedia buat masa ini.", S14 "Tiada Topik Dijumpai". No horizontal page overflow in any of the 71 states.

## 2. Not in the narrative discovery

`node tools/diff-narrative.js inventory/M03 docs/discovery/M03-curriculum.md` → **0 candidates on all 14 screens.** Appendix C of the narrative lists whole-card concatenations, emoji strings in the tool's normalised form, and shell script literals. Items found only by the scripted inventory, state captures, or crawl during reconciliation, and now in the narrative:
1. Subject icons render for only 4 of 31 subjects: stored values are Lucide names or emoji (D-2).
2. The subject and level "Aktif?" switches save immediately via `fetch()`. Only the level switch has error handling ("Gagal kemaskini status", "Ralat rangkaian") (D-8).
3. Error flashes from redirects: "Chapter ID diperlukan.", "Bab tidak dijumpai.", "Subjek tidak dijumpai.", "Tahap Pendidikan tidak dijumpai.".
4. The chapter/topic edit pages have an "Aktif" checkbox; the create pages do not. Subject and level forms have no active field.
5. `/topics` chip links keep the other filter. Tingkatan and GEOGRAFI topics exist but have no chips (D-4).
6. Peta Belajar: 4 island states in CSS, grade clamped to Darjah 4, first two topics unlocked, wrong header "Dashboard" (D-1, D-5).
7. Chapters are ordered by storage order, not chapter number (D-6). Topic numbers are duplicated.
8. `/topics/{id}` "Mula Berlatih" links to `/practice/<ADMIN CODE>` for every subtopic (D-9).

## 3. New routes found by the crawl

409 unique URLs (`_crawl.json`, 212 classified M03). Not in the TRACKER M03 checklist:

| URL | Kind | Found on | Note |
|---|---|---|---|
| `/admin/curriculum?subject_id=&education_level_id=` | query variant | S1 | tree view |
| **`/admin/curriculum/chapters/create`** (`?subject_id=&education_level_id=`) | screen | S1 | S2 |
| **`/admin/curriculum/chapters/{id}/edit`** | screen | S1 | S3 |
| **`/admin/curriculum/topics/create?chapter_id=`** | screen | S1 | S4 |
| **`/admin/curriculum/topics/{id}/edit`** | screen | S1 | S5 |
| `POST /admin/curriculum/chapters`, `PUT/DELETE /admin/curriculum/chapters/{id}` | form actions | S1–S3 | |
| `POST /admin/curriculum/topics`, `PUT/DELETE /admin/curriculum/topics/{id}` | form actions | S1, S4, S5 | |
| `POST /admin/curriculum/subtopics`, `PUT/DELETE /admin/curriculum/subtopics/{id}` | inline form actions | S1 | no separate subtopic pages |
| **`/admin/subjects/create`**, **`/admin/subjects/{id}/edit`** | screens | S6 | S7, S8 |
| `POST /admin/subjects`, `PUT/DELETE /admin/subjects/{id}`, JSON `PUT` toggle | form / fetch | S6–S8 | |
| **`/admin/education-levels/create`**, **`/admin/education-levels/{id}/edit`** | screens | S9 | S10, S11 |
| `POST /admin/education-levels`, `PUT/DELETE /admin/education-levels/{id}`, JSON `PUT` toggle (`_toggle_only`) | form / fetch | S9–S11 | |
| `/topics?grade_level=&subject=` | query variants | S12 | incl. URL-only `TINGKATAN_*`, `GEOGRAFI` |
| **`/topics/{id}`** | screen | S12 | S13 |
| `/peta-belajar?subject=&grade=` | query variants | S14 | 8 subjects × Darjah 1–4 |

Probed, absent: `/admin/curriculum/create`, `/admin/curriculum/subtopics/{id}/edit`, `/api/subjects`, `/api/education-levels`, `/api/chapters`, `/api/topics`, `/api/curriculum`, `/subjects`, `/levels`, `/topics/99999` (404). GET on `/admin/curriculum/chapters|topics|subtopics`, `…/{id}`, `/admin/curriculum/subtopics/create`, `/admin/subjects/{id}`, `/admin/education-levels/{id}` returns 405 (resource routes without index/show). M03 has **no JSON read endpoints**.

## 4. Out-of-module links (target module)

From the shells on M03 screens (classified in `_crawl.json`): M01 4, M01+M22 2, M02 7, M04 9, M05 17, M06 7, M07 3, M08 7, M09 11, M10 17, M11 6, M12 15, M13 4, M14 14, M15 5, M16 10, M17 7, M18 12, M19 5, M20 3, M21 4, M22 8, M23 4, M24 6, M25 6, M26 4 (unknown 0).

Found in M03 content (not the shell):
| URL | Found on | Target |
|---|---|---|
| `/practice/MATH`, `/practice/BM` ("Mula Berlatih") | S13 | M05 |
| `/practice?topic_id={id}` (BUKA islands: 1, 7, 22, 23, 38, 39 captured) | S14 | M05 |
| `https://fontawesome.com/icons` ("Font Awesome") | S7, S8 | external |
| `/api/tournament/active`, `/tournament/` (banner) | S12–S14 | M16 |
| `/admin/server-status` (header widget) | S1–S11 | M23 |

## 5. What could not be revealed read-only / safety notes

| Item | Why |
|---|---|
| Success flashes and validation errors after create/update/delete (chapters, topics, subtopics, subjects, levels), toggle responses | Would change data. Confirm texts were read from the DOM (`onsubmit` / Alpine source). |
| Inactive rendering (chapter/topic/subject/level with `is_active` = 0), student-side filtering of inactive records | No inactive records exist; toggling is forbidden. |
| Peta Belajar `mastered` / `started` island states, "Topik Selesai" > 0, progress bars > 0 %, the unlock rule beyond "first two open" | Admin account has no practice history; styles exist in CSS (documented). |
| `/topics/{id}` progress values ("Dijawab", "Kemajuan") for a real student | Same reason. |
| Practice codes for the other 6 legacy subjects | Limited to 2 topic detail pages. |
| Admin maintenance of the legacy student topic catalogue | No screen found in M03 (Q-M03-1). |

**Safety:** only GET requests and client-side reveals (Alpine tree/inline form toggles) were used. No form was submitted, and no "Aktif?" switch, delete, or other data-changing control was clicked. Error-flash states came from GET requests to non-existent ids or a missing query parameter; the server redirected with a session flash and no data changed. The complete curriculum was read with 194 + 24 throttled GET requests to `/admin/curriculum?subject_id=&education_level_id=` (≈350 ms apart), plus about 60 throttled GETs for the `/topics` and `/peta-belajar` filter matrices. Detail/edit pages opened: subject 3, level 10, chapter 91, topic 126, student topics 7 and 68 (1–2 per entity). On the subject create form, the colour picker was changed in the DOM to confirm the text-mirroring script. The page was then left without saving.

## 6. Tool notes

- No shared tool was changed. M03-specific files: `tools/jobs/M03.js`, `tools/jobs/M03.screens.json`, `tools/jobs/M03.shots.js`.
- `diff-narrative.js` strips U+FE0F (it is part of its emoji class `⚙️`) from inventory strings but not from the document. Strings with emoji variation selectors are therefore listed once more in their normalised form in narrative Appendix C.2. A future tool fix could normalise both sides.
