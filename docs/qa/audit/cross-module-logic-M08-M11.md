# Cross-module logic review — M08–M11 (XL batch 2)

| Field | Value |
|---|---|
| Scope | Approved URS + SRS of M08 student-performance v1.4, M09 content v1.3, M10 teacher-class v1.2, M11 teacher-analytics v1.3, and their fit with the approved M01 v1.8, M02 v1.7, M03 v1.7, M04 v1.6, M05 v1.5, M06 v1.4 and M07 v1.6. Also read: TRACKER (D1–D13, canonical seed table, id policy, route owners), architecture overview v1.1 §6.6–§6.8, build-plan v1.2 (§S, F-29, F-30, M08-T1…T5, M09-T1…T5), and the batch-1 review `cross-module-logic-M01-M07.md` (method and severity scale). |
| Method | Docs only, no browser, no edits to requirement docs. Scripts in the scratchpad (`logic-review/batch2/`): `nav.js` (route-reference scan over the 11 SRS and the 4 URS under review against every SRS §2 route table plus TRACKER §4), `api.js` (every `/api/…` reference against every SRS §7 table), `articles.js` (M09 article seed vs the M10 and M05 anchors), `register.js` (M11 §6.7 register totals and feasibility checks), `m03chap.js`, `m03top.js`, `m03lab.js` (M03 curriculum data vs the chapter/topic labels M10 and M11 use). Then targeted reads of the data (§6), API (§7), rules (§4), permissions (§9) and deviation tables. |
| Rules applied | CLAUDE.md §6: D7 fidelity, D9 deviation rule, D10, privacy, "seeds mirror observation", D11 (virtual datasets, named queries, documented display constants), D12 (one owner per store), the XL gate. Fixes below align to observed live behaviour and add no feature. |
| Severity scale | As batch 1. **Critical**: an observed live flow cannot complete in the rebuild. **Major**: two approved docs contradict each other, or a module depends on a contract/record the owner does not define, so the module cannot be built correctly. **Minor**: stale reference, wording, local inconsistency without a wrong result. |
| Date | 2026-09-26 |

## Verdict

**FAIL — 0 Critical, 20 Major, 14 Minor.**

Each of M08–M11 passed its own audit, and a large part of the batch fits:
- routes resolve;
- the M08 designed data is reproduced exactly by M10 and M11 (83 answers, 38 correct, 14 sessions and every per-day figure);
- the M09 article store matches both the M10 "own articles" view (36 articles, 12,270 views) and the M05 dashboard (the five newest articles);
- the class dataset (750) is used the same way by M08, M10 and M11.

The requests these modules queued for their owners (M01, M02, M03, M04, M05) have not been taken up yet, and several of them cannot be taken up as written. The Majors fall into five groups:

1. **Answer log and users dataset.**
   - The answer-log and session dataset that M08 and M11 count from has no owner spec. M05 still declares small tables (XL2-01).
   - The users dataset must hold the M11 monitoring register, the M10 attendance selection and every module fixture at the same time, and the requested rules conflict (XL2-02…XL2-07).
2. **Teacher data paths.**
   - Teacher missions, remedial tests and question sets have no working path into the M05 session store (XL2-08).
   - The M10 DSKP store lacks the SP records that M08 reads (XL2-20).
3. **M04 contracts for M10 and M11.** M04 does not yet define:
   - the contribution and teacher-databank queries;
   - the teacher write contract;
   - the structured-question fields;
   - the report reason and source values;
   - the paper types;
   - the anchor questions (XL2-09…XL2-16).
4. **Id and path references.**
   - M10 relies on a chapter id that M03 does not keep (XL2-17).
   - Two modules call M10 endpoints under paths M10 does not have (XL2-18).
5. **M09 article store.** It lacks the fields M10 writes (XL2-19).

**Build impact (student slice, build-plan v1.2 §S):**
- M08-T1 (performance seeds and handlers) is blocked by XL2-01, XL2-02 and XL2-20.
- F-30 (classrooms/DSKP store) is blocked by XL2-06 and XL2-20.
- F-29 (content store) can proceed after the Minor XL2-30.
- M09-T1…T5 are not blocked by any Major.
- Every other Major concerns the teacher and admin slice (M10, M11 and the M04 admin side). Those Majors must be closed before the owning module's build starts.

| Severity | Count |
|---|---|
| Critical | 0 |
| Major | 20 |
| Minor | 14 |
| **Total** | **34** |

## 1. Navigation (script result)

- **Owner catalogue:** 328 route patterns. They come from the SRS §2 route tables of M01–M11 (M10 and M11 are now written, so their routes are SRS-owned) and from every route in TRACKER §4 for M12–M26.
- **Scan:** every backticked path in the 11 SRS and in the URS of M08–M11. That leaves 89 targets outside the catalogue: 76 are covered by an owned prefix and 13 by nothing.

**Covered by an owned prefix (76).** These are action endpoints and sub-resources, for example `/perutusan/{id}/react`, `/headcount/{id}/reset-ar`, `/guru/kelas/{id}/qr-data`, the live `/guru/api/*` JSON paths, and test values. Four prefix-only targets need an owner listing:
- `/admin/monitoring/sekolah/{id}`, `…/pelajar/{id}`, `…/guru/{id}` and `/admin/monitoring/export/{pdf|csv}`. M11 BR-M11-27 links there from every monitoring screen, and XR-M11-08 asks M17 to mount them. TRACKER §4 M17 lists only `/admin/monitoring` (XL2-27).
- `/admin/kirkpatrick/pelajar/{id}` (linked by M11 FR-M11-58). It is already in the TRACKER §0 M12 note; M12 discovery owns it.

**Dangling (13).** Twelve of them are documented non-routes:
- M08 FR-M08-07: `/analitik/guru`, `/analisa-item/pelajar` → 404.
- M10 FR-M10-26: `/classroom/{id}`, `/school/{sid}/teacher/{uid}` → 404, BLOCKED.
- Live POST targets and external URLs.
- Path fragments of a longer route (`/results/{n}`, `/sekolah/{id}/…`).

The one real dangling target is **`/remedial/{id}`**:
- M10 FR-M10-23 and AC-M10-09.2/09.3 link the teacher's "Lihat Quiz" to it, e.g. `/remedial/7601`.
- No module owns the page. M05 owns only `/remedial/saya`, and the M10 FN-M10-1.2.2 list of 404 routes does not include it.
- See XL2-08.

**Guards.** They are consistent:
- Guests are sent to `/login` (M01 FR-M01-14) in all four modules, except the documented public pages: M08 `/pelajar/{id}`, M09 `/artikel`, `/video` and `/perutusan/awam/{id}`.
- The `/guru/*` guard is now defined by M10 §7 (**T** endpoints: teacher or admin; other roles get 403 and the M01 landing page). M11 §9 still calls it "pending" (XL2-31).

## 2. Queued cross-module requests — evaluation

| Request | Necessary? | Consistent with the other docs? | Addressed by the owner? | Owner and fix |
|---|---|---|---|---|
| **M10 → M02 R-M02-01** `attendanceMirror` (137 students: 14 T4 / 123 T5; no answer 19–25 Sep) | Yes (M10 S7 admin mirror, BR-M10-07) | **No, as suggested.** The suggested "one generated SMK holding exactly these 137" is infeasible. BR-M11-08 makes every school with a T4/T5 student a row of the observed 33-school monitoring table. None of the 33 rows has 14 / 123, and a 34th row would change every observed S2 figure (`register.js`: 0 matching schools; the most T4 students at any one school is 26, at 8880). | No (M02 v1.7 silent) | **M02** (XL2-05). Define the selection over students **without a school** (grade 10: 14, grade 11: 123), or spread it over the monitoring schools without changing any per-school count. None of the 137 may have an answer 19–25 Sep, which constrains XL2-01. |
| **M10 → M04 R-M04-01** `createdBy` facet + Q-CONTRIB | Yes (S21, S1 via BR-M10-06) | Yes: the per-subject counts sum to 16,817 and each fits inside Q-ELIGIBLE(subject) | No: `createdBy` is a derived object, not a facet; no Q-CONTRIB in §4.1 | **M04** (XL2-09) |
| **M10 → M04 R-M04-02** Q-TEACHER-DATABANK | Yes (S28) | **Partly.** It needs 130 non-MCQ BM rows, but M04 §6.13.1 says "every row `mcq`". Placing them at BM T1–T5 keeps the M05 D1–D4 pins unchanged. | No | **M04** (XL2-10) |
| **M10 → M04 R-M04-03** anchors 522425…, 525431…, 700301–700302 and a non-approved cell | Yes | **700301 `pending_review` is not.** M04 observed "draft / pending_review / rejected 0" on the S1 status filters (§6.11), so a seeded pending row changes an observed admin figure. The rest fits: BM D6 / T1 / T3 and BM T5 have room. | No | **M04 + M10** (XL2-11) |
| **M10 → M04 R-M04-04** structured `visibility` | No data change needed (every stored value is `public` in both docs) | Yes | n/a | **M04** annotation only (XL2-34) |
| **M10 → M04 R-M04-05** reason `outdated`, source `teacher_databank`, `success:true` | Yes (M10 FR-M10-118, BR-M10-28) | Yes | No (BR-M04-11/15 and #15 unchanged) | **M04** (XL2-14) |
| **M10 → M04 R-M04-06** `paperType` (7 values), `levelCode` | Yes (M10 BR-M10-25, #60) | Yes | No (M04 enum has 3 codes) | **M04** (XL2-15) |
| **M10 → M05** mission / remedial item shapes; session links `missionId`, `remedialTestId`, `questionSetId` | Yes | **No.** M05 #20/#21 and M10 #76/#77 both declare the same two endpoints. The M05 schema has no link fields and no mode for these sessions. The mission reward (3 × correct) differs from BR-09 (1 × correct). | No | **M05 + M10** (XL2-08) |
| **M11 → M02 XR-M11-02** monitoring users (4,158 T4/T5 students + 522 teachers in the 33 + 13 schools; Student A = 2008) | Yes | **Feasible only with explicit placement of the fixtures:**<br>• 29 teacher fixtures 5301–5329 against 27 free slots outside the monitoring schools;<br>• schools of 3201–3215 and 5901–5990 unstated;<br>• the M08 T4 class members (58/53/54 per class) cannot be grade-10 users of a monitoring school, because no school has more than 26. | No | **M02** (XL2-03) |
| **M11 → M02 XR-M11-03** schools and subscriptions (12 schools with Active/Cancelled/Expired pills; fixtures 11–17) | Yes | **No.**<br>• Fixture 12 "8106, quota 50, 55 enrolled" contradicts the 553 T5 students M11 registers there, because BR-24 counts `used` as students at the package levels.<br>• 7 designed rows vs the 14 observed rows (9 active, quota Σ 5,738). | No | **M02** (XL2-04) |
| **M11 → M02** overlap of the 8080 live id range (students 1459–5572) with fixtures 5001–5990 | — | Yes, no conflict. M11 asserts only id 2008, which is free. The other 8080 anchors take ids assigned by M02 outside every fixture block. | n/a | M02 records 2008 and the 8080 anchor ids when it does XL2-03 |
| **M11 → M01 XR-M11-01** `User.lastLoginAt` | Yes (BR-M11-02/09/18/24; S1, S3, S5) | Yes | No (M01 v1.8 has no such field) | **M01** (+ M02 seeds) (XL2-07) |
| **M11 → M05 XR-M11-04** monitoring answers as a D11 segment (472,371 at the snapshot; 7,651 / 22,207 / 86,697) | Yes | Consistent with the M08 platform figure 478,499 (the segment is a subset). It needs a single M05 spec. | No: M05 §6.14 says "no live screen shows a platform-wide total" | **M05** (XL2-01) |
| **M11 → M04/M03 XR-M11-05** anchor questions with chapter label and topic | Yes (S4 topics, wrong answers, gaps) | **Partly.**<br>• The topic rows resolve in M03: SEJ T5 "Warisan Negara Bangsa", SEJ T3 Bab 6, BM T5 Bab 99 and others (`m03top.js`).<br>• 7 chapter labels do not exist in M03: "Bahasa Melayu Tingkatan 5", "Bahasa Inggeris Tingkatan 5", "Biologi Tingkatan 4/5", "Sains Tingkatan 1…5", "Sejarah Tingkatan 3" (`m03lab.js`).<br>• Adding them to M03 would change M03's observed 1,251 chapters. | No | **M04** (+ M03 constraint) (XL2-16) |
| **M08 → M02/M05/M10 OQ-M08-12** allocations | Yes | M02 part done (v1.7: 3001–3008, 3201–3215). M04 part done (v1.6 §6.13.2). **M05 part missing** (XL2-01). **M10 part:**<br>• 750 classes: done.<br>• "4,533 enrolled / 551 teachers of classes": infeasible, since M10 can only reach 4,529 / ≤ 550.<br>• DSKP SPs 9001–9004: missing (XL2-20). | Partly | **M08** reading (XL2-02); M05 (XL2-01); M10 (XL2-20) |
| **M08 4,533 / 551** vs M10's 4,529 / 550 | — | Both observed figures equal the M02 role facets exactly (student 4,533, teacher 551), and live S1 shows 310 teacher cards. So the live S1 cards count users by role, not enrolments. That reading reproduces everything without tuning. | No | **M08** (XL2-02) |
| **M09 → M05** banners and articles as the dashboard source | Yes (D12) | **Yes.**<br>• `articles.js`: M09 latest(5) by BR-M09-03 = #9, #1, #2, #3, #4, exactly the five observed on the M05 dashboard, all "7 bulan yang lepas".<br>• BR-M09-14 gives the admin all 5 banners and a student ALL + STUDENT = 5, as M05 observed. | M09 yes; M05 still says it seeds them "until M09 exists" | **M05** text (XL2-30); build-plan method names (XL2-29) |
| **M09 36 admin-authored articles** vs M08/M10 | — | **Consistent** (`articles.js`):<br>• 36 articles, views Σ 12,270;<br>• anchors #10 596, #13 448, #21 430, #36, #43, #47 all admin-authored;<br>• the page-1/page-2 split at 15 per page matches M10.<br>M08 makes no article assumption. | Yes | — |
| **M03 → M10** extra T5 chapters (id 1281 "Bab 7") | Yes (DV-M10-05 preload, S19 chip) | The chapters exist in M03 (Perniagaan T5 Bab 1–7, BM T5 Bab 99, Sains T5 Bab 1–9), but M03 assigns seed ids 1–1,251 and does not keep the live id 1281 | No | **M03** (XL2-17) |

Closed by v1.3/v1.4 of the requesting modules: M10 note 8 (M11's stale classes 2001–2003 / students 3001–3012; M11 v1.3 uses 2001–2002 and 3001–3008), and M11 XR-M11-06 (nothing to change in M08).

## 3. Findings

| ID | Sev | Modules | Doc IDs (side A ↔ side B) | Problem | Owner and fix |
|---|---|---|---|---|---|
| XL2-01 | **Major** | M05 ↔ M08, M11, M10 | M05 §6.14 ("none of them is a large collection … small seeded tables"; QuizAnswer 250 rows, PracticeSession 12) ↔ M08 §6.1 ("QuizAnswer (D11 dataset)"), §6.3 (32,122 sessions, 478,499 answers, 79.8 %; T4 11 sessions 63.9 %; T5 29,971 sessions 79.7 %; class 228 1,618 sessions / 34,882 answers), BR-M08-06/28 (leaderboard week 46, all ≥ 1,050), OQ-M08-12 ↔ M11 §6.5, §6.7, XR-M11-04 (472,371; 7d 7,651 / 30d 22,207 / 3m 86,697; 1,056 weekly cells; per-student anchors) ↔ M10 R-M02-01 (the 137 have no answer 19–25 Sep) | The session and answer store that M08 S1–S3, S5, S10, S11, S20 and M11 S2–S5 count from is owned by M05 (D12). M05 declares it small and materialised, while M08 calls it a D11 dataset. No document defines the one dataset that holds all of these at once:<br>• the M08 platform allocation;<br>• the M11 per-school, per-week segment;<br>• the M10 no-answer constraint;<br>• the M08 leaderboard participants;<br>• the seeded and designed anchors.<br>In particular, it is unstated whether the 250 M05 rows and the 83 M08 designed answers sit **inside** 478,499 (D11 anchors) or are added to it. M08-T1 (student slice) depends on it. | **M05** adds a §6.14 "answer-log and session dataset" spec that takes M08 §6.3 and M11 §6.7 as inputs. It covers:<br>• total 478,499 answers and 32,122 sessions at the mock clock;<br>• the segment of T4/T5 students with a non-fixture school = 472,371 with the M11 weekly cells and period totals (the other 6,128 answers by other users);<br>• the M08 level and class-228 figures;<br>• leaderboard participants (week 46, month ≥ 50, all ≥ 1,050), with the standings derived from these sessions, or else M08 declares the observed standings as documented display data;<br>• none of the R-M02-01 students with an answer 19–25 Sep;<br>• seeded and designed rows (admin, P1–P4, M1–M4, H01…, 3001–3008) as anchors inside the totals. The fixture-school users stay outside the M11 segment by BR-M11-34.<br>**M08** §6.1/§6.3 then cite the M05 names. |
| XL2-02 | **Major** | M08 ↔ M10, M02 | M08 FR-M08-11/12, §6.3 ("4,533 distinct enrolled students", "teachers of classes 551 (310 cards)"), AC-M08-04.2 ↔ M10 §6.2.1 B and OQ-M10-19 (4,529 reachable; ≤ 550) ↔ M02 §6.15 B (student 4,533, teacher 551) | M08 reads the S1 cards "4533 Murid" and "551 Guru" as enrolment-based. Every student would then have to be enrolled, but canonical 2, 3, 4 and 11 are not, and every teacher would have to own a class, but `guru2` 5301 owns none. The class dataset cannot compile to it without tuning. The same two numbers equal the M02 role facets exactly, and the 310 teacher cards on the same screen show that only 310 teachers own classes. | **M08:** S1 "Murid" and "Guru" (and the header "{studentCount} murid") = the M02 users named counts of role `student` / `teacher` in scope (admin: platform; school admin: own school), not enrolments. Level cards, S2/S3 and "Prestasi Guru" stay enrolment-based (T4 149, T5 3,911, 310 cards). Recompute the designed school-admin anchor "2 kelas · 8 murid · 1 guru" under the new definition (pelajar 2 is also at 900001); do not tune it. **M10:** §6.2.1 owners = 310 distinct teachers (observed cards), enrolled-distinct total unconstrained; close OQ-M10-19. |
| XL2-03 | **Major** | M02 ↔ M11, M08, M10, M09 | M02 §6.14/§6.15 B (60 schools with users; fixture blocks 5001–5210 at 8102, 5301–5329, 5901–5990; M08 3201–3215; M09 3101–3109; no per-school grade or login allocation) ↔ M11 XR-M11-02, §6.7 (4,158 T4/T5 students in 33 schools, 522 teachers in 13 schools, per-school status and login counts, Student A = 2008) ↔ M08 §6.3/§6.10 (T4 classes 4/5/6/8/9/10 with 58/53/54 members; 3201–3215 at level 10) | The users dataset has no joint `role × grade × schoolId × lastLoginAt` allocation. The requested register is feasible only if the fixtures are placed explicitly:<br>• **Teachers:** 551 − 522 = 29 teachers may sit outside the monitoring schools. Canonical 5 and M09 3101 take two of those slots, so only 27 of the 29 fixtures 5301–5329 fit outside. At least 2 must be placed inside monitoring teacher rows.<br>• **Unstated schools:** the schools of 3201–3215 and of the 90 complimentary students 5901–5990 are unstated.<br>• **T4 class members:** members of the M08 T4 classes (58 per class) cannot be grade-10 users of a monitoring school (the largest T4 count at one school is 26, `register.js`). They must be grade-11 users, or users without a school.<br>• **8102 fixtures:** 5001–5210 at 8102 fit (776 registered, 755 never logged in) only if they have no answers and no login. | **M02** extends §6.15 B with the monitoring allocation of M11 §6.7 (per school: T4/T5 split, aktif, login-only, never, answered without login, teachers registered and logged in) as generated rows plus anchors. It records Student A = 2008 and the other 8080 anchor ids (outside every fixture block). It states, for each fixture block, its school and grade and how it fits a monitoring row or stays outside it (no school, or a fixture school 900001–900099). It states the grade and school of the members of the observed T4 classes (M10 anchors 4–10). A build check asserts the M11 totals (4,158 / 522 / 57 schools). |
| XL2-04 | **Major** | M02 ↔ M11 | M02 §6.6/§6.14 (subscriptions 11–17: 12 at 8106 "quota 50 with 55 enrolled", 13 at 900001, 14 cancelled, 15 expired, 16 grace, 17 active), BR-24 (`used` = students at the package levels), FR-M02-82 (observed 9 active rows, Σ quota 5,738; live 14 rows) ↔ M11 XR-M11-03, BR-M11-33, §6.7 (Active: 8080, 8078, 8082, 8880, 8277, 8106, 8090, 10220, 8087; Cancelled: 8102, 8228; Expired: 8107; with end dates) | The designed subscription rows contradict observations of both modules:<br>• 8106 shows 55 used in M02, but it has 553 T5 students in M11, so BR-24 gives 553;<br>• 7 rows against the 14 observed on live;<br>• the grace, fixture and extra rows change the observed S12 counts. | **M02** seeds the observed subscription rows (the 12 schools and statuses and end dates of M11 §6.7 plus the 2 other live rows, 9 active with Σ quota 5,738, used per BR-24 from the XL2-03 allocation). Any extra designed row (grace, 900001) is only allowed in a test-only profile, or where it changes no observed S12 figure. The M02 E2E is updated accordingly. |
| XL2-05 | **Major** | M02 ↔ M10, M11 | M10 R-M02-01, BR-M10-07, FR-M10-41 (137 students, 14 T4 / 123 T5, "one generated SMK") ↔ M11 BR-M11-08, BR-M11-34, §6.7 | The suggested selection rule is infeasible. Every school with a T4/T5 student is a row of the observed monitoring table, no row is 14 / 123, and a new school row changes every observed S2 figure. | **M02** defines `attendanceMirror` as 137 generated students with `schoolId = null` (grade 10: 14, grade 11: 123), or another placement that leaves every M11 per-school count unchanged. **M10** R-M02-01 drops "one generated SMK". Linked constraint in XL2-01: no answers 19–25 Sep. |
| XL2-06 | **Major** | M02 ↔ M10, M08, M11 | M02 §6.14 ("Canonical 5 with 3 classrooms (e.g. "5 MARIKH" / "DMO101")"; complimentary 5901–5990, "one enrolled in 3 classes"), DATA-M02-09 `classLabel` "5 MARIKH", FR-M02-71 (#23 teacher classrooms) ↔ M10 §6.2.1/§6.11 (guru 5 owns exactly 2001 "5 MARIKH - Kimia" / DMO101 and 2002 / DMO102, members 3001–3008), M10 §13 note 2 ↔ M08 §6.10, M11 §6.8 (population 8 / 8) | The canonical teacher has two different class sets. If the complimentary students are enrolled in guru 5's classes, the observed-style anchors of M08 (8 members, class dashboards), M10 (S1 "Pelajar 8", S4, S7) and M11 (S1 8 / 8) all change. | **M02:** canonical 5 owns the M10 classes 2001 and 2002 only (S7 lists them). The complimentary fixture enrolments name classes of another (generated or fixture) teacher, never 2001 or 2002; the S7 empty case stays with 5301. **M10** records those classes in §6.2.1 (they sit inside the level cells; no total changes). |
| XL2-07 | **Major** | M01 ↔ M11, M02 | M01 DATA-M01-01 (no `lastLoginAt`), login FRs ↔ M11 XR-M11-01, BR-M11-02, BR-M11-09 (teacher %), BR-M11-18, BR-M11-24, §6.8 (3001–3008 values) | M11's login figures ("Pernah Login", "Login sahaja", "Belum login", teacher engagement) read a field its owner does not define, and no rule sets it. | **M01:** add `lastLoginAt: datetime \| null` to DATA-M01-01, set it on successful login (FR login step), return it where M11 reads users. Seed canonical values (2, 5; 3001–3008 per M11 §6.8). **M02:** generated rows get values that reproduce the XL2-03 allocation. |
| XL2-08 | **Major** | M05 ↔ M10 (M08, M11) | M05 §6.1 (mode enum `random\|chapter\|revision\|past_year\|latih_tubi\|ramalan`; no link fields), #4 request, BR-31, BR-09 (coins = correct), #20/#21 "envelope `{data:[]}` (M10 contract; prototype empty)", FR-M05-115/116 ↔ M10 DATA-M10-04/05/09, BR-M10-12 (completion sets `afterAccuracy`), BR-M10-17 (3 syiling × correct; `latih_tubi` → Q-SPM-POOL(subject[, chapter])), BR-M10-18, #76/#77 (same paths, "item shape owned by M10"), FR-M10-23 (`/remedial/{id}`), §13 note 4 ↔ M08 BR-M08-10/11 (practice modes only) ↔ M11 BR-M11-04 (type by mode) | The teacher-to-student path does not close:<br>• **Duplicate endpoints:** two modules declare `GET /api/missions/today` and `/api/remedial-tests/mine`, and M05's handler always returns `[]`. A launched mission never reaches the student.<br>• **No start contract:** M05 #4 has no parameter to start a mission, set or remedial session, and no field links the session back. So M10 S11 "completed", S13 attempts and remedial `afterAccuracy` cannot be computed.<br>• **Reward mismatch:** the mission reward rule contradicts BR-09.<br>• **Undefined mode:** the session mode is undefined, so M08 (practice modes only) and M11 (type by mode) may classify the same session differently.<br>• **Dangling route:** `/remedial/{id}` has no owner.<br>• **Empty pools:** a mission restricted to a chapter draws from the SPM pool, whose rows carry no `curriculumChapterId`, so the session is empty. | **One owner per endpoint:**<br>• **M10** owns #76/#77 (handler and shape);<br>• **M05** #20/#21 become "consumer of M10 #76/#77" (the page renders the M10 list; its empty-state E2E stay valid because nothing dated today reaches the canonical students).<br>**M05** adds to DATA-M05-01:<br>• `missionId`, `questionSetId`, `remedialTestId` (int \| null);<br>• the #4 variants `{mode, missionId}` / `{questionSetId}` / `{remedialTestId}`, with the question list taken from the M10 record;<br>• one mode for these sessions, recommended `random` (a practice mode, so M08 S5/S6/S11 and M11 "Kuiz" count them, like the M08 designed sessions);<br>• BR-31 branches: mission coins = 3 × correct (BR-M10-17); remedial completion writes `afterAccuracy` and `completed` through the M10 repository.<br>**M10:**<br>• names the owner of `/remedial/{id}` (M05 quiz page for the remedial session, or a documented 404 as live is unobserved);<br>• defines the chapter case of `latih_tubi` missions, e.g. eligible questions of the subject and chapter, since pool rows have no chapter. |
| XL2-09 | **Major** | M04 ↔ M10 | M04 DATA-M04-01 (`createdBy {id, name, schoolId}` derived; facet list §6.13.1 without it), §4.1 (no Q-CONTRIB) ↔ M10 R-M04-01, BR-M10-06/21, FR-M10-91/93/96 (ids ascending, 20 per page, page 2 starts at 522445) | S21 "16,817 / 16,817 / 0 / 0", its subject breakdown and the S1 teacher "Soalan" cannot be computed. The live list also pins an id layout: the smallest contributed id is 522425 and page 2 starts at 522445, so ids 522425–522444 are all `createdBy = 1`. | **M04:**<br>• add facet `createdBy` (user id), with the Q-CONTRIB(user) named query (objective, non-PKSK, by `status` and `subjectId`);<br>• allocate the 16,817 approved, active admin rows per the R-M04-01 subject counts;<br>• make ids 522425–522447 `createdBy = 1` BM D6 anchors (or an explicit layout block);<br>• teacher 5 = the two anchors of XL2-11. |
| XL2-10 | **Major** | M04 ↔ M10 | M04 §6.13.1 (`questionType`: "every row `mcq`"), §4.1 (no Q-TEACHER-DATABANK) ↔ M10 R-M04-02, BR-M10-27, FR-M10-115/117 | S28 needs a scope facet and 130 non-MCQ Bahasa Melayu rows (105 essay, 25 other types). The owner denies that any non-MCQ row exists. | **M04:**<br>• define Q-TEACHER-DATABANK(subject) on an existing or new facet (e.g. a `sourceSet` family), BM = 6,048;<br>• place 105 `essay` and 25 other-type BM rows inside the BM T1–T5 cells (outside the M05 D1–D4 pins, not eligible for MCQ practice);<br>• mcq difficulty 3 → 946–960 rows (64 pages of 15);<br>• anchors 525431–525433 and 3 BM T3 anchors (ids assigned);<br>• update "every row `mcq`" and the questionType facet. |
| XL2-11 | **Major** | M04 ↔ M10 | M04 §6.13.2 (no M10 rows; 700001–700999 labelled "M08"), §6.11 ("draft / pending_review / rejected 0 (S1 status filters)"), state profile (test-only) ↔ M10 R-M04-03, §6.11 contributions (700301 `pending_review` inactive, 700302 approved), anchors "S1 Soalan 2 / 1", "S21 2 / 1 / 1 / 0" | M10's anchors are not registered. Seeding 700301 as `pending_review` in the default data puts a live-zero admin figure at 1, which breaks "seeds mirror observation". | **M04** registers 522425–522427, 522445–522447, 525431–525433 and the 3 BM T3 rows, plus 700302 (BM T5 eligible non-pool), in §6.13.2, and relabels the reserved block "700001–700999: M08 700001–700299, M10 700300–700399" (M11 block per XL2-16). **M10** moves the pending contribution out of the default seed: either add it to the M04 test-only state profile, or create it at runtime in the E2E (`POST /api/guru/questions` → id ≥ 9,000,001). The S1 / S21 teacher anchors then read "1 / 1" in the default seed and "2 / 1" after the runtime create. |
| XL2-12 | **Major** | M04 ↔ M10, M05 (M11) | M04 DATA-M04-01 (no `curriculumTopicId`, `scriptType`, `textDirection`), §7 ("every mutating call needs an admin session"), §7.1 store contract (no create function for other modules; `questionStore.*` vs arch `questions.*`) ↔ M10 #53/#55/#56/#58 (teacher create, edit and import; `pending_review`; `createdBy`; `chapterId`, `curriculumTopicId`, `scriptType`, `textDirection`), BR-M10-24, anchor 700301 "inactive until approved" ↔ M05 #4 (returns `textDirection`, `scriptType`) ↔ M11 §6.1 (topic per question) | Flow B (teacher contribution → review → practice) has no owner contract:<br>• the teacher's create, edit, delete and import cannot write through M04;<br>• three fields that M10 writes and M05/M11 read do not exist;<br>• the `isActive` state of a teacher question is contradictory. If it is saved inactive, admin "Luluskan" (#7 or the S3 quick action) sets only `status`, so the approved question never becomes eligible (BR-M04-03). | **M04:**<br>• add `curriculumTopicId` (→ M03 topic), `scriptType` and `textDirection` to DATA-M04-01;<br>• add `questions.createFromTeacher / updateOwn / deleteOwn / importFromTeacher` to §7.1: status `pending_review`, **`isActive = true`**, `createdBy` = viewer, runtime ids ≥ 9,000,001; teacher auth for M10's calls;<br>• align the §7.1 names with the architecture's `questions.*` repository.<br>**M10** drops "inactive until approved". |
| XL2-13 | **Major** | M04 ↔ M10 | M04 §6.2 DATA-M04-02/03 (heading "owned by M10 for authoring; M04 reads" vs body "owned by M04"; fields: `topic` string, `visibility`, `status`, `createdAt`; sub-question `letter`, `text`, `marks`, `modelAnswer`), §7.1 `structuredStore` (query/get only), §6.13.3 ↔ M10 #45–#50, BR-M10-20 (order `updatedAt`), §6.11 (4454 chapter 1281, template), DV-M10-05 | M10 authors structured questions into the M04 store with fields the owner does not define:<br>• `chapterId`, `topicId`, `dskpSpId`, `scriptType`, `textDirection`, `questionTemplate`, `updatedAt`;<br>• sub `partLabel`, `answerType`, `expectedNumeric`, `numericTolerance`, `rubrics[] {konstruk, keyword, marks}`, `parentSubId`.<br>M04 also has no create, update, delete or toggle contract, and the §6.2 heading contradicts the architecture's owner (M04). | **M04** adds these fields (nullable for the generated rows), `structuredStore.create / update / delete / toggleStatus` (teacher or admin) with the runtime id policy, and fixes the §6.2 heading to "owned by M04; authored through M10". |
| XL2-14 | **Major** | M04 ↔ M10 | M04 BR-M04-11 (sources `spm`, `structured_attempt`, `latihan`, `revision`), BR-M04-15 (7 MCQ reasons), #15 response `{message}` ↔ M10 R-M04-05, BR-M10-28, FR-M10-118 (8 reasons incl. `outdated` "Soalan sudah tidak relevan", `source:'teacher_databank'`, script checks `success`) | A teacher's databank report carries a source value and a reason code that the owner does not accept or label. The S28 button logic expects a flag that the response lacks. | **M04:**<br>• add `teacher_databank` to BR-M04-11;<br>• add `outdated` "Soalan sudah tidak relevan" to the MCQ set of BR-M04-15 (category badge "Lain-lain" per the existing first-reason rule);<br>• #15 returns `{success:true, message}`;<br>• DATA-M04-10 updated. |
| XL2-15 | **Major** | M04 ↔ M10 | M04 DATA-M04-05 (`paperType` enum `buku_latihan`, `soalan_peperiksaan`, `lain_lain`; `levelCode` "T1"–"T5") ↔ M10 R-M04-06, BR-M10-25, #60 (7 values, value = label; `levelCode` may be null) | Four of the seven paper types that M10 submits are rejected or unlabelled by the owner, and the value formats differ (code vs label). | **M04:** `paperType` = the 7 observed M10 values (stored as the live value = label; the 3 observed admin rows map to their labels); `levelCode` nullable. |
| XL2-16 | **Major** | M04 (+M03) ↔ M11 | M04 §6.13 (no M11 anchors; chapter facet only for M05 chapters; no topic field) ↔ M11 XR-M11-05, §6.7 (Student A 18 topic rows; wrong-answer texts; chapter-label groups of Students A, B, C), BR-M11-19/21 ↔ M03 §6.10 (1,251 chapters, the whole observed tree) | M11 S4 cannot be built:<br>• the anchor questions do not exist;<br>• 7 of the chapter labels M11 groups by are not M03 chapters ("Bahasa Melayu Tingkatan 5", "Bahasa Inggeris Tingkatan 5", "Biologi Tingkatan 4", "Biologi Tingkatan 5", "Sains Tingkatan 1…5", "Sejarah Tingkatan 3", `m03lab.js`), while the topic rows do resolve to M03 topics;<br>• adding chapters to M03 would change its observed 1,251. | **M04:**<br>• assign an anchor block for the M11 questions (e.g. 700401–700699) with texts, options, keys and sources as M11 §6.7;<br>• link each to its M03 topic (`curriculumTopicId`, XL2-12);<br>• carry the observed chapter label as an M04 field for anchors only (e.g. `legacyChapterLabel`, null on generated rows), so the M03 chapter count stays 1,251;<br>• define "{n} soalan tersedia" (BR-M11-19) over that label.<br>**M11** BR-M11-19 cites the field. |
| XL2-17 | **Major** | M03 ↔ M10 | M03 §6.9/§6.10 (chapter ids 1–1,251 in dataset order; kept live ids 1, 3, 18, 35, 36, 57, 91, 92, 120, 142, 164, 179, 263, 325) ↔ M10 §6.11 (structured anchor 4454 chapter **1281** = Perniagaan T5 "Bab 7: Merancang Pengendalian Perniagaan"), DV-M10-05 (edit preselects 1281), §13 note 3 | The chapter exists in M03 (`m03chap.js`) but under a seed id. 1281 is outside M03's id range, so S19's chip and the approved DV-M10-05 preload resolve to nothing. | **M03** keeps the live id 1281 for Perniagaan T5 "Bab 7: Merancang Pengendalian Perniagaan" (anchor list (b); ids of other rows unchanged; runtime creates stay max + 1). |
| XL2-18 | **Major** | M11, M04 ↔ M10 | M11 §7 #2 `GET /api/teacher/classes` "M10 (referenced)", XR-M11-07 ↔ M10 #12 `GET /api/guru/classes`, §13 note 8 · M04 §7 #28–#30 `/api/dskp/bidang\|sk\|sp` "owned by M10" ↔ M10 #39–#41 `/api/guru/dskp/bidang\|sk\|sp` ("M04 #28 points here") | Two modules call M10 endpoints under paths M10 does not define (`api.js`: both are unresolved). When F-30 replaces M04's provisional DSKP store, the M04 calls break. | **M11** #2 → M10 #12 `GET /api/guru/classes` (own classes; the admin gets `[]`). **M04** #28–#30 → M10 #39–#41 `/api/guru/dskp/*`. |
| XL2-19 | **Major** | M09 ↔ M10 | M09 DATA-M09-01 (no `youtubeUrl`, no attachments; `isPublished`), §6.11 (`articles.createFromTeacher`) ↔ M10 #66–#70 (`youtubeUrl`, `attachments[] {file, label}`, `DELETE /api/guru/articles/attachments/:id`, `published:false`), BR-M10-29, FR-M10-121/123 | M10 writes article fields into the M09 store that the owner does not define (an attachment entity with ids; the YouTube link), and it names the status flag differently. | **M09:**<br>• add `youtubeUrl: string \| null` and an `ArticleAttachment {id, articleId, fileName, label, mime, size}` table (runtime ids) to DATA-M09-01;<br>• add repository methods for the M10 create, edit and attachment delete;<br>• S16 rendering stays as live, not shown.<br>**M10** uses `isPublished`. |
| XL2-20 | **Major** | M10 ↔ M08, M04 | M10 §6.9/§6.11 DSKP seed (BM T4/T5 Bidang and 8 SK only) ↔ M08 §6.1/§6.5 (DskpSpView "over the M10 SP data"; `available` = Q-ELIGIBLE with that `dskpSpId`), §6.10 (Kimia T5 SPs **9001–9004** "Sel Elektrolisis", "Polimer", "Siri Homolog", "Getah Asli"; admin SP records 221, 206, 222, 214, 179, 194, 418 with "avail" 16 / 16 / 7 / 12 / 13 / 50 / 13; maps KSSR BM D4 1.1/2.1/3.1, KSSR Sejarah D4 1.1/2.1) ↔ M04 §6.13.1 (facet `dskpTagged` only; `dskpSpId` of generated rows unspecified), build-plan F-30 | M08 S6/S7 (student slice) reads SP, SK and Bidang records that the DSKP owner does not seed. The "available" counts need a `dskpSpId` facet that M04 does not have. The SP ids that M04's generated `dskpTagged` rows point to are not defined, so a question's DSKP chain (M04 #4) may not resolve. | **M10** seeds the SP, SK and Bidang records M08 references: 9001–9004 under Kimia T5 and the admin's observed SPs and map tiles for BM and Sejarah Darjah 4. **M04** adds `dskpSpId` as a facet for those SPs, with the observed eligible counts (9001 = 2 + 28 anchors; 221 → 16, 206 → 16, 222 → 7, 214 → 12, 179 → 13, 194 → 50, 418 → 13), and states that generated `dskpTagged` rows point only to SPs in the M10 store. |
| XL2-21 | Minor | M10 ↔ M05 | M10 BR-M10-31 ("M05 status is `active`") ↔ M05 §6.1 (`in_progress \| completed`) | A non-existent enum value; the live-class list would always be empty. | **M10:** `status = in_progress`. |
| XL2-22 | Minor | M11 ↔ M05 | M11 §6.1, BR-M11-04 (structured attempt `completedAt`) ↔ M05 DATA-M05-06 (`submittedAt`) | Field-name mismatch. | **M11:** read `submittedAt`. |
| XL2-23 | Minor | M08 ↔ M10 | M08 §6.10 class 516 code "DEMO-4S" ↔ M10 BR-M10-02, §6.2.1 (6 upper-case letters or digits; S33 `maxlength=6`) | A fictitious join code that the owner's rule rejects. | **M08:** a 6-character code (e.g. "DMO516"), unless the live code was observed. |
| XL2-24 | Minor | M10 ↔ M08 | M10 DATA-M10-01 (`id int`) and §6.2.1 (school classes "in their own id space `sc-{n}`": sc-419 next to classroom 419) ↔ M08 DATA-M08-01, DV-06 | Two records share the id 419 in one integer-keyed store. | **M10:** key = (`kind`, `id`), or a separate `schoolClasses` table; the dataset count is unchanged. |
| XL2-25 | Minor | M08 ↔ M10 | M08 DATA-M08-01 (`levelId`, `levelSlug`, `color`) ↔ M10 DATA-M10-01 (`educationLevel` slug only; no colour) | The consumer declares fields that the owner does not have (XL-23 pattern). | **M08:** mark them derived (level id from the slug per BR-M10-03; colour from the M03 subject). |
| XL2-26 | Minor | M09 ↔ M10 | M09 E2E-M09-27 ("create a **published** article through the M10 mock endpoint … first on `/artikel`") ↔ M10 FR-M10-122, BR-M10-29 (`published: false`, published by M09 review) | The provisional E2E cannot pass through the M10 endpoint. | **M09:** E2E-27 = M10 create (unpublished, not on `/artikel`) → admin S3 publish → first on `/artikel`. |
| XL2-27 | Minor | TRACKER (M17) ↔ M11 | TRACKER §4 M17 (`/admin/monitoring` only) ↔ M11 BR-M11-27, XR-M11-08 | The drill-down and export routes are covered by prefix only (XL-28 pattern). | **Delivery Lead:** add `/admin/monitoring/sekolah/{id}`, `…/pelajar/{id}`, `…/guru/{id}` and `/admin/monitoring/export/{pdf\|csv}` to the M17 checklist. |
| XL2-28 | Minor | M11 ↔ M08, M10 (M03, M05) | M11 URS (live 9–10px text: bar labels, school codes, e-mails, chart ticks, S2 labels below `sm`), no DV ↔ M08 DV-18, M10 DV-28, M05 DV-11, M03 DV-06b (text < 12px raised to 12px) | The master NFR-02 rule is applied by the other modules but not by M11, whose component M17 reuses (XL-22 pattern). | **M11** adds the same deviation for S1–S5 (content text ≥ 12px; icons unchanged), or states per element why it is kept. |
| XL2-29 | Minor | build-plan ↔ M09, M08/M10 | build-plan F-29 (`content.latestArticles(limit)`, `content.activeBanners()`), F-30 ("the M08 designed classes 2001–2003") ↔ M09 §6.11 (`articles.latest(5)`, `banners.activeFor(user)`), M08 v1.4 / M10 v1.2 (2001–2002 only) | The build-plan names differ from the owner contract, and a class that no longer exists is listed; F-29 and F-30 are in the student slice. | **solution-architect:** F-29 uses the M09 method names; F-30 lists 2001–2002. |
| XL2-30 | Minor | M05 ↔ M09 | M05 §6.9 ("Article and Banner (M09; seeded here until M09 exists)"), §6.12 "Other seeds" (5 banners, 5 articles "M09 placeholder") ↔ M09 §6.9 ("the same 5 records M05 §6.12 seeds (OQ-M09-13a: one store)"), FR-M09-40/60 | Two modules seed one store (D12). The values agree (`articles.js`), but only the owner may seed. | **M05:** read `articles.latest(5)` and `banners.activeFor(user)` from M09; remove the local seeds. |
| XL2-31 | Minor | M08, M09, M11 (+M10) | M08 §0 Status "Draft v1.3 … ready for the targeted re-check"; M09 §0 "for re-audit"; M11 §0 "Draft v1.1 … ready for the round-2 re-audit"; M08 and M11 §0 Related "M10 … not yet written"; M08 Related M02 v1.6 / M04 v1.5 / M05 v1.4; M11 §9 "per M10 `/guru/*` guard (pending)"; M10 §0 "M08 v1.3"; M08 URS "Murid Demo 01…08 … (no login)" vs M11 §6.8 `lastLoginAt` values | Stale status lines and cross-references (XL-25 pattern); "no login" reads as never logged in. | **Each owner** refreshes them; M08 says "no demo credentials" instead of "no login". |
| XL2-32 | Minor | M10 ↔ architecture | M10 DATA-M10-11 (admin `questions` 20719, `questionsApproved` 19361, `gpsOverall` 4.69; DV-M10-12 replicated) ↔ overview §6.6 (documented display constants: `DISPLAY_CONSTANT` with their DV, listed by one unit test) | The figures are correctly treated as constants, but they are not declared in the D11 format. They sit on S1/S2, while S21 shows Q-CONTRIB 16,817 for the same user (a different definition on a different screen, so allowed). | **M10:** mark the three values `DISPLAY_CONSTANT` (DV-M10-12) in §6.10 and name the alternatives. |
| XL2-33 | Minor | M09 ↔ M05, M08, M10, M11 | M09 §6.9 clock `2026-09-25T10:00:00+08:00` ↔ every other module `2026-09-25T15:40:00+08:00` | Two default clocks. The relative ages hold at both (checked), but a cross-module E2E (dashboard strip) runs on the M05 clock. | **M09:** default to 15:40, or state that its E2E set 10:00 explicitly. |
| XL2-34 | Minor | M04 ↔ M10 | M04 DATA-M04-02 `visibility` `public \| private` ("`private` INFERRED") ↔ M10 R-M04-04 (source values `tingkatan \| class`, unreachable; stored `public` only) | No data conflict (every row is `public`); the INFERRED enum differs from the source code. | **M04:** note it for the backend phase; no change to data or UI. |

## 4. Seeds and id ranges — checked

| Range | Owner / use | Result |
|---|---|---|
| Users 1–11 | canonical (M01): names, grades, schools identical in M01 §6.8, M08 §6, M09 §6.9, M10 §6.11, M11 §6.8 | consistent |
| 3001–3008 | M08 "Murid Demo 01…08", SMK DEMO 900001, grade 11, members of 2001 and 2002 | consistent in M02, M08, M10, M11 |
| 3101–3109 | M09 (3101 teacher, 3102–3104 school admins at 900003/900001/900002, 3105–3109 students without a school) | recorded in M02 v1.6; no overlap |
| 3201–3215 | M08 class-516 pupils, grade 10 | recorded in M02 v1.7; **school unstated** (XL2-03) |
| 5001–5990 | M02 fixtures | disjoint from the others; teacher and complimentary placement open (XL2-03, XL2-06); 8080 live ids in this block are not asserted by M11 |
| 2008 | M11 Student A (live id) | free of every fixture block; to be recorded by M02 (XL2-03) |
| Users dataset 1–6,000, role cells | M02 §6.15 B | the per-role anchor check still fits (student 4,533 ≥ 332 anchors, teacher 551 ≥ 31). The new constraint is the M11 register: 27 free teacher slots vs 29 fixtures (XL2-03). |
| Schools 900001–900003 | M02 reserved range | excluded from monitoring by BR-M11-34, so "Jumlah Sekolah" 57 = 60 − 3; the students 3001–3008, canonical 2 and 4 and their answers stay out of the M11 segment, as intended |
| Runtime ≥ 9,000,001 | users (M02), questions (M04, incl. M10 teacher questions BR-M10-24), classes (M10 §6.2.1) | separate stores, same floor; no clash; runtime schools from 10,301 (M11 E2E-54 uses them) |
| Questions 600001–600065 / 700001–700215 / 700301–700302 / M11 block | M05 / M08 / M10 / M11 anchors | the M08 rows fit (M04 v1.6 §6.13.2); M10 and M11 rows are not registered (XL2-11, XL2-16) |
| Classes 1–1,156 + sc-419/sc-806 + 2001–2002 = 750 | M10 §6.2.1 | T4 13 = 11 + 2 school classes; T5 645 incl. 2001–2002; 15 observed anchors; the same in M08 §6.3 and M11 (ids 4 and 228) |
| Articles 1–72, banners 1–5 | M09 | runtime from 73 / 6; M10 anchors #10, #13, #21, #36, #43, #47 are admin-authored (`articles.js`) |
| M10 designed ids 7101–7602 | missions, sets, teacher questions, timetable, broadcasts, remedial tests | small M10 tables; no collision |
| Designed data 3001–3008 | M08 §6.10 → M10 §6.11 → M11 §6.8 | recomputed and identical: Kimia 68 + Sejarah 15 = **83** answers, **38** correct (46 %), **14** sessions; days 15/09 4, 18/09 3, 22/09 4, 24/09 3; M10 S7 22/09 Hadir 4, 18/09 Hadir 3, trend 50 % on 22/09 only; remedial before 12.5 (3008) and 33 → 60 (3007) = +27 %; leaderboard week rows of 3001, 3002, 3005–3008 as M08 |

## 5. Counts map (every figure → named query or display constant)

| Figure(s) | Screen | Source | Status |
|---|---|---|---|
| 750 classes; T4 13, T5 645; 27 subjects | M08 S1/S2/S3/S10/S11 | M10 `classrooms` dataset facets (§6.2.1) | OK |
| 4533 Murid, 551 Guru | M08 S1 | enrolment reading infeasible | XL2-02: → M02 role counts |
| 32,122 sessions, 478,499 answers, 79.8 %, level and class-228 figures | M08 S1–S3, S5 | M05 answer-log dataset (not specified) | XL2-01 |
| 472,371 / 7,651 / 22,207 / 86,697, weekly cells | M11 S2–S5 | M05 segment (not specified) | XL2-01 |
| 4,158 students, 522 teachers, 57 schools, statuses | M11 S2–S5 | M02 users dataset (allocation not specified) | XL2-03 |
| Subscription pills | M11 S3 | M02 subscriptions | XL2-04 |
| 137 / 0 / 137 / 0 % | M10 S7 (admin) | M02 `attendanceMirror` | XL2-05 |
| 16,817 (S21) | M10 S1, S21 | M04 Q-CONTRIB (missing) | XL2-09 |
| 6,048 / 5,918 / 105 | M10 S28 | M04 Q-TEACHER-DATABANK (missing) | XL2-10 |
| 21,033, 18 active subjects | M10 S27 | M04 Q-SPM-POOL | OK |
| 4,064 | M10 S17 | M04 Q-STRUCT-ALL | OK |
| 20719 / 19361 / 4.69 | M10 S1, S2 (admin) | DATA-M10-11 constants (DV-M10-12) | OK in substance; format XL2-32 |
| 72 articles, 21/14/10/6/7/7/7, 13 featured; 2,260 videos; 5 banners | M09 | M09 named queries Q-ART-*, Q-VID-*, Q-BANNER-* | OK |
| 36 / 36 / 0 / 12,270 | M10 S29 | M09 articles by author (`articles.js`) | OK |
| 5 newest articles, 5 banners | M05 S1 | M09 Q-ART-LATEST(5), Q-BANNER-ACTIVE | OK (`articles.js`) |
| Headcount 744 entries, GPS 3.45, grade counts | M08 S1 | M08 headcount store | OK (M08-owned) |
| DSKP "available" 16 / 16 / 7 / 12 / 13 / 50 / 13; 9001 → 30 | M08 S6/S7 | M04 `dskpSpId` facet (missing) | XL2-20 |

**Answer-log totals across M05, M08 and M11.**
- M05's own screens show per-user figures only (admin 119 answers, pelajar 94, pelajarmaju 37). These are anchors, not additions.
- M08's platform figure 478,499 and M11's segment 472,371 are compatible: the segment is a strict subset, and the difference of 6,128 answers comes from other users.
- The fixture-school users (2, 3001–3008) and the admin sit outside the M11 segment by BR-M11-34 and by role.
- They agree once M05 specifies the one dataset (XL2-01).

## 6. Entities, enums and API contracts — checked and consistent

- **Classroom.** M10 DATA-M10-01 is the owner. M02 ClassroomRef (`classCode` = `joinCode`) and M08 DATA-M08-01 are views of it (apart from XL2-24/25). Enrolment `status active | removed` is read the same way by M08 BR-M08-07/10, M10 BR-M10-04 and M11 BR-M11-01.
- **Own classes.** "Own classes" (`teacherId = viewer`) is the same rule in M08 BR-M08-26, M10 BR-M10-01 and M11 BR-M11-01. The admin owns none in all three.
- **Session and answer fields.** M08, M10 and M11 read the same M05 fields: `mode`, `status` (`in_progress` / `completed`), `questionCount`, `correctCount`, `timeSpent`, `completedAt`, and QuizAnswer `answeredAt`, `isCorrect`, `chapterId`. The exception is XL2-21/22.
- **Mode mapping.** M11 §6.6 maps every M05 mode (`past_year` → Kuiz; `latih_tubi`; `ramalan` → Tracking A). M08 BR-M08-11 excludes the SPM modes (DV-20, replicated).
- **Grade bands.** The grade band of M08 BR-M08-02 is reused by M10 BR-M10-14.
- **Monitoring component (for M17).** The M11 endpoints #3–#7 `/api/monitoring/*`, the read models of §6.4, BR-M11-27 (links always go to `/admin/monitoring…`) and BR-M11-34 are specified so that M17 can mount them unchanged (XR-M11-08). The contract is complete; M17 only has to mount the routes (XL2-27).
- **Content endpoints.** M09 #20 `GET /api/banners/active` and `GET /api/articles/latest?limit=5` feed M05 #1 `/api/dashboard` (FR-M09-40/60, FR-M05-04/21/22).
- **Endpoints declared by two modules** (`api.js`):
  - `/api/schools/search` (M01 + M02): identical contract; batch 1 accepted it.
  - `/api/questions/:id` (M04 + M07): PKSK detail; batch 1 accepted it.
  - `PUT /api/admin/users/:id` (M02 + M07): the PKSK flag, as batch 1.
  - `/api/missions/today` and `/api/remedial-tests/mine` (M05 + M10): **XL2-08**.

## 7. Roles and permissions — checked

- M08 §9, M10 §9 and M11 §9 give teachers their own classes and the admin every screen with no own class. They agree with BR-M08-26, BR-M10-01 and BR-M11-01.
- Students and parents reach M10 only through `/kelas-saya` and `/set-soalan-saya`. The **T** endpoints answer 403, and the page falls back to the M01 landing page.
- M09 writer roles for perutusan (admin: national; `school_admin` "Pengetua": school scope) match the fixture roles 3102–3104 in M02. Teacher articles go through M10 only, and the M09 admin routes send teachers to their landing page.
- M11 S2–S5 on `/guru/…` show platform data to a teacher (provisional, as live), and links go to `/admin/monitoring…`, which redirect a teacher (INFERRED). This is consistent with BR-M11-27 and M17's future guard. No change.

## 8. End-to-end flows

| Flow | Step | Owning IDs | Status |
|---|---|---|---|
| **A. Teacher creates a class → student joins → teacher assigns a mission → student completes it in M05 → M10 monitoring and M08/M11 analytics reflect it** | 1 Create a class (join code, level tiles, runtime id ≥ 9,000,001) | M10 FR-M10-31…34, BR-M10-02/03, #13, §6.2.1 | OK |
| | 2 Student joins with the code | M10 FR-M10-38/39, BR-M10-02, #74, DATA-M10-02 | OK |
| | 3 Class and student visible to the teacher (M10 S4/S6, M08 S4/S5, M11 S1 options) | M10 FR-M10-28/29, BR-M10-04; M08 BR-M08-26, #4/#5; M11 BR-M11-01, #2 | Gap XL2-18 (M11 #2 path) |
| | 4 Teacher launches a mission | M10 FR-M10-53…58, BR-M10-17, #28 | OK (chapter case: XL2-08) |
| | 5 Student sees today's mission on `/misi-harian` | M05 FR-M05-116, #21 ↔ M10 #76 | **Broken, XL2-08** (duplicate endpoint; M05 returns `[]`) |
| | 6 Student does the mission session | M05 #4–#6, BR-31, BR-09 ↔ M10 BR-M10-17 | **Broken, XL2-08** (no start variant, no `missionId`, reward 1× vs 3×) |
| | 7 M10 S11 "completed / recipients" | M10 FR-M10-52, DATA-M10-04 | **Broken, XL2-08** |
| | 8 M10 attendance, Command Center, live class | M10 FR-M10-41/15, BR-M10-07/08/31 | OK for any M05 answer; live class Gap XL2-21 |
| | 9 M08 class dashboard and item analysis | M08 BR-M08-10/11/18/19, #5/#11 | Gap XL2-08 (session mode) |
| | 10 M11 teacher report (login, practice, activity types) | M11 BR-M11-01…05, #1 | Gap XL2-07 (`lastLoginAt`), XL2-08 (mode) |
| | 11 M11/M17 platform monitoring | M11 BR-M11-08/09/34, #3 | OK (runtime schools counted, E2E-M11-54); register XL2-03 |
| **A′. Teacher remedial test → student** | Generate, open "Lihat Quiz", student takes it, `afterAccuracy` | M10 FR-M10-23, BR-M10-11/12/13, #5 ↔ M05 FR-M05-115, #20 | **Broken, XL2-08** (`/remedial/{id}` unowned; no completion write) |
| **A″. Teacher question set → student** | Publish a set, S34 lists it, student takes it | M10 BR-M10-18, FR-M10-73, #75 ↔ M05 quiz component (§7.1) | Gap XL2-08 (`questionSetId`, attempts); provisional on live |
| **B. Teacher contributes a question → M04 review → question appears in practice** | 1 Teacher creates (single or CSV) → M04 `pending_review`, `createdBy` | M10 FR-M10-99…105, FR-M10-94, BR-M10-22/24, #53/#58 ↔ M04 DATA-M04-01, §7.1 | Gap XL2-12 (no write contract, missing fields) |
| | 2 Teacher sees the counts on S21 | M10 FR-M10-91/93/96, BR-M10-21 ↔ M04 §4.1 | Gap XL2-09 (Q-CONTRIB) |
| | 3 Admin finds it (S1 status filter) and approves (S3 quick action or bulk "Luluskan") | M04 BR-M04-01/02, FR-M04-42, #7 | OK once XL2-12 fixes `isActive = true` |
| | 4 Eligible for practice; counts move together | M04 BR-M04-03, §4.1 Q-ELIGIBLE (overlay); M05 BR-04, FR-M05-51 | OK (D1–D4 subjects in random practice; T4/T5 through the SPM pool by BR-M04-32) |
| | 5 Teacher reports a databank question → admin queue | M10 FR-M10-118, BR-M10-28 ↔ M04 BR-M04-11/12/15, #15, #14 | Gap XL2-14 |
| | 6 Teacher submits a question paper → admin S12 | M10 BR-M10-25, #60 ↔ M04 DATA-M04-05, BR-M04-18, #20 | Gap XL2-15 |
| | 7 Teacher authors a structured question → M05 S10 / M06 | M10 #46–#50, BR-M10-20 ↔ M04 DATA-M04-02/03, §7.1 | Gap XL2-13 |
| **C. Admin publishes an article or banner → student dashboard** | 1 Admin creates or publishes an article (`publishedAt` on first publish) | M09 FR-M09-14/16, BR-M09-02/03, #3 | OK |
| | 2 Dashboard strip and aside show the 5 newest | M05 FR-M05-21/22 ← M09 FR-M09-40, Q-ART-LATEST(5) | OK (`articles.js`: seed = observed #9, #1–#4); stale M05 seed XL2-30 |
| | 3 Admin creates a banner (type, audience, dates) | M09 FR-M09-57, BR-M09-12, #17 | OK |
| | 4 Carousel shows the active banners for the role | M05 FR-M05-04 ← M09 FR-M09-60, BR-M09-14 | OK (admin 5; student ALL + STUDENT = 5; teacher ALL = 2) |
| | 5 Teacher submits an article → admin publishes → `/artikel` | M10 FR-M10-120…123, BR-M10-29, #67 → M09 FR-M09-41, S3 | Gap XL2-19 (fields), XL2-26 (E2E wording) |
| **D. Student practice → M08 analytics (student slice)** | Session completion → M08 S6 / S7 / S20 | M05 BR-31 → M08 BR-M08-11/12/14/28 | Gap XL2-01 (dataset), XL2-20 (SP records); the designed chain 3001–3008 is consistent (§4) |

## 9. Deviation coherence and logical soundness

- **Text ≥ 12px.** M08 DV-18, M10 DV-28 (S1, S2, S7, S21), M05 DV-11 and M03 DV-06b apply the same rule. M09 has no text below 12px. M11 is the exception (XL2-28).
- **Header titles.** M08 DV-01, M09 DV-08 and M10 DV-01 are all implemented by the shell rule DV-SH-03 (title from the route). The subtitles are each module's own copy or "Selamat datang kembali". This is uniform, and it closes the batch-1 XL-20 style.
- **405 → 404.** M08 DV-24 (`/timeline/{id}`) and M10 DV-26 (method-only routes) use the same global 404 page. M09 DV-17 and M10 DV-24 reuse M01 DV-02 ("Mula Latihan" → `/practice`). Consistent.
- **Icon resolver.** M10 DV-25 (databank tiles) uses the M06 DV-03 pattern through ADR-0010. Consistent.
- **Pagination copy.** M09 ("Showing 1 to 24 of 2260 results"), M10 BR-M10-34 and FR-M10-77 (window 1–10, "...", last two; "« Previous" / "Next »" below 640px), and the M04/M05 shared Laravel pager are the same live component. Consistent. M09 DV-03 (admin pager keeps its filters) matches the M02/M07 behaviour it cites.
- **Admin mirrors.** The admin mirrors are logically separate definitions and are replicated as live:
  - M10 S7 shows 137 students for the admin, while M10 S1/S2/S6 and M11 S1 show none (OQ-M10-03);
  - M10 S1 20719 vs S21 16,817 (XL2-32).
  - Neither is shown next to the other on one screen.
- **Designed seeds (logical soundness).**
  - M08's designed sessions are `random` sessions of Kimia T5 / Sejarah T4 questions. The M05 random mode offers only D1–D4 (BR-11), so no student can create such a session through M05 practice today. They become producible once teacher missions or sets create practice-mode sessions (XL2-08 recommends `random`). That keeps the designed data meaningful without changing it.

## 10. Critical and Major findings by owner

| Owner | Findings |
|---|---|
| M04 | XL2-09, XL2-10, XL2-11, XL2-12, XL2-13, XL2-14, XL2-15, XL2-16; co-owner XL2-18, XL2-20 |
| M02 | XL2-03, XL2-04, XL2-05, XL2-06; co-owner XL2-07 |
| M05 | XL2-01, XL2-08 (with M10) |
| M10 | XL2-20; co-owner XL2-08, XL2-11, XL2-06, XL2-02 |
| M08 | XL2-02 |
| M01 | XL2-07 |
| M03 | XL2-17 |
| M09 | XL2-19 |
| M11 | XL2-18 (with M04) |

**Suggested order.**
- **Student slice first:**
  1. M05 XL2-01 and M08 XL2-02 (unblock M08-T1);
  2. M10 and M04 XL2-20 and M02 XL2-06 (unblock F-30);
  3. the build-plan and M05 Minors XL2-29/30 before F-29.
- **Teacher and admin slice** (before M10, M11 and the M04 admin build): the remaining M04 contract items, M02 XL2-03/04/05, M01 XL2-07, M03 XL2-17, M11/M04 XL2-18, M09 XL2-19 and M05/M10 XL2-08.

After the fixes, re-run the scripts in `logic-review/batch2/` and do a targeted XL batch-2 round 2.

---

# Round 2 — re-check after the owner fixes

| Field | Value |
|---|---|
| Scope | M01 v1.9, M02 v1.9, M03 v1.8, M04 v1.8, M05 v1.6, M06 v1.4, M07 v1.6, M08 v1.6, M09 v1.4, M10 v1.4, M11 v1.6 (URS + SRS); M13 v1.1 as context only; TRACKER; architecture build-plan (F-29, F-30). |
| Method | Docs only, no browser, no edits to requirement docs or TRACKER. Scripts in the scratchpad `xl2-r2/`: the round-1 `nav.js` and `api.js` re-run against the new versions; `reg2.js` (M11 §6.7 register: login split, teachers, answers); `weekly.js` (M11 weekly cells vs register answers); `ranges.js` (id-block overlaps, reserved sub-blocks, DSKP id formula, Q-CONTRIB, subscriptions, M02 totals, M05 segments); `g.js` (cross-doc grep for names, enums and stale references). Then targeted reads of each owner section cited below. Line numbers refer to the SRS files unless marked URS. |
| Rules applied | As round 1 (CLAUDE.md §6: D9, D11, D12, seeds mirror observation, privacy, XL gate). Severity scale unchanged. |
| Date | 2026-09-26 |

## R2.1 Verdict

**FAIL — 0 Critical, 2 Major, 13 Minor open.**

All 20 round-1 Majors are resolved in the owner documents. The fixes hold together numerically (every total below was recomputed by script). Two new Majors come from the fixes themselves:

- **XL2-35:** M02 placed the class-516 pupils 3201–3215 at SMK DEMO 900001, which breaks the M08 school-admin anchor "9 murid". M08 wrote that the anchor holds only while M02 puts no other fixture student at 900001.
- **XL2-36:** a "Soalan & Rujukan" (`youtube`) mission hands M10 TeacherQuestion ids to the M05 quiz, which takes only M04 question ids. The ids also collide: 7501 and 7502 are generated M04 question ids too.

Both fixes are small (one placement line, one pool rule). No other flow is blocked.

**Build impact.**
- M08-T1 (performance seeds and handlers): not blocked by any Major. XL2-35 affects one provisional E2E (E2E-M08-61).
- F-30 (classroom and DSKP store): not blocked. Before F-30, fix the Minors XL2-44 and XL2-45 and the carried XL2-29.
- F-29 (content store): not blocked. Only the carried Minor XL2-29 (build-plan method names) remains.
- Teacher and admin slice: XL2-36 must be closed before M10 or M05 builds the mission quiz (Q5).

| Severity | New in round 2 | Carried from round 1 (still open) | Open total |
|---|---|---|---|
| Critical | 0 | 0 | 0 |
| Major | 2 | 0 | **2** |
| Minor | 11 | 2 (XL2-27, XL2-29) | **13** |

## R2.2 Status of the round-1 findings

"Resolved" means that the owner text now says what the round-1 fix asked for, or an equivalent that fits every other doc, checked at the cited lines.

| ID | Sev (R1) | Status | Evidence (section, line) | Note |
|---|---|---|---|---|
| XL2-01 | Major | **Resolved** | M05 §6.14 (L502–L544): QuizAnswer and PracticeSession are D11 datasets. Totals: 478,499 answers, 32,122 sessions (26 anchors + 32,096 generated). Segments: `monitoring` 472,371 and `other` 6,128 (333 anchors + 5,795). The level, class and participant cells are defined, and so is the R-M02-01 constraint. There are 11 named queries (§6.14.2, L528–L542). M08 cites them (L97, L267–L268, L285, L345). M11 §6.5.1 cites them (L290–L306). | Recomputed: 119 + 94 + 37 + 83 = 333; 472,371 + 6,128 = 478,499; weekly cells Σ 472,359 + 12 before M1 = 472,371 (`weekly.js`, 0 differences per school); 8082 cells 130,233 ≥ class 228's 34,882; week participants 5 + 33 + 8 = 46 (the 8 designed users all have a session between 21 and 25 Sep). The M08 leaderboard coins are M08 documented display data (BR-M08-28, L285), with the alternatives recorded, as the D11 exception allows. Residual placement point: XL2-46. |
| XL2-02 | Major | **Resolved** | M08 L97 and changelog L21: "Murid"/"Guru" = M02 role counts. M10 §6.2.1 L404 (310 owners) and L416 (enrolled count unconstrained); OQ-M10-19 closed (L864). | The recomputed school-admin anchor is now contradicted by the M02 placement: XL2-35. |
| XL2-03 | Major | **Resolved** | M02 §6.15 C (L535–L555). | `reg2.js`: 33 rows; 4,158 = T4 75 + T5 4,083; logged in 1,666 / never 2,492; teachers 521 + 5183's 1 = 522, logged in 276 + 1 = 277. Student total 4,158 + 25 + 7 + 137 + 134 + 72 = 4,533; teachers 522 + 29 = 551; anchors per role 343 / 32 (`ranges.js`). The placement of 3201–3215 at 900001 causes XL2-35. |
| XL2-04 | Major | **Resolved** | M02 §6.14 Subscriptions row (L488) and DATA-M02-07 (L390). | 9 active, Σ quota 1000 + 500 + 415 + 1000 + 1000 + 164 + 1000 + 354 + 305 = 5,738; 4 cancelled; 1 expired; 0 grace. The statuses and end dates match M11 §6.7 (L335–L352). `used` per BR-24 gives 8106 560 + 2 = 562, 8078 423 and 8277 150. The grace row sits only in the test-only profile. |
| XL2-05 | Major | **Resolved** | M02 L549; M10 L496 and R-M02-01 (L834), with "one generated SMK" dropped; M05 L521. | — |
| XL2-06 | Major | **Resolved (Minor residual)** | M02 L467, L490 and L423 (guru 5 owns exactly 2001/2002; complimentary students enrolled in fixture teacher 5302's classes DMO201–DMO203); M10 §6.2.1 L404. | M10 does not record 5302's three classes: XL2-45. |
| XL2-07 | Major | **Resolved (Minor residual)** | M01 DATA-M01-01 L299, BR-25 L224, API #1 L434, seed values L397–L411; M02 L336, L542; M11 L194, L300. | No owner seeds `lastLoginAt` for 3001–3008: XL2-43. |
| XL2-08 | Major | **Resolved (new issues from the fix)** | M05 DATA-M05-01 L350, L358–L361; BR-09 L299; BR-31 step (8) L321; BR-32 L322; #4 L584; #20/#21 L600–L601 (owned by M05); Q4–Q6 L79–L81 and FR-M05-141…144. M10: #76/#77 dropped (L609); repository methods (L443–L459, L862); BR-M10-17/18 read Q-SESS-LINK (L302–L303). M08 treats the new modes as practice modes (L267); M11 maps them to "Kuiz" (L313). | One owner per endpoint; start variants, link fields, 3 × reward and completion write are all defined. New: XL2-36 (Major, `youtube` pool), XL2-40 (teacher "Lihat Quiz"), XL2-41 (empty chapter pool), XL2-42 (mission recipients). |
| XL2-09 | Major | **Resolved (Minor residual)** | M04 §4.1 Q-CONTRIB L266; facet L603 (layout block from 522425); `questions.contributions` L745; FR-M04-123 L195. | Σ subject split = 16,817 (`ranges.js`). DATA-M04-01 L344 still says generated rows never use user 1: XL2-39. |
| XL2-10 | Major | **Resolved** | M04 L267 (Q-TEACHER-DATABANK), L601 (`questionType`: 130 non-MCQ rows in the BM databank), L602 (`teacherDatabank`), L314. | mcq difficulty 3 = 950 → 64 pages of 15, as M10 E2E-70 (L814). |
| XL2-11 | Major | **Resolved** | M04 §6.13.2 L666–L670 (522425–522447, 525428–525433, 700302; 700301 test-only via `questions.createFixture`); M10 §6.11 L515 and anchors L519 ("Soalan 1 / 1", "2 / 1" after the runtime insert). | The M10 BM T3 ids 525428–525430 are assigned by M04; M10 still writes "three BM T3 anchors" without the ids (covered by XL2-47). |
| XL2-12 | Major | **Resolved** | M04 DATA-M04-01 L310–L313; BR-M04-35 L239 (`pending_review`, `isActive = true`); §7.1 L744 (`questions.*` names); M10 BR-M10-21 L306, #53 L585. | — |
| XL2-13 | Major | **Resolved (Minor residual)** | M04 §6.2 L348–L351 (heading "owned by M04; authored through M10"; the M10 fields are added); `structured.create/update/delete/toggleStatus` L749; `structured.list` L750. | M10 BR-M10-20 (L305) names the fields `chapterId`/`topicId`, while M04 has `curriculumChapterId`/`curriculumTopicId`: XL2-38. |
| XL2-14 | Major | **Resolved (Minor residual)** | M04 BR-M04-11 L215; #15 L706 (`{success:true, message}`); DATA-M04-10 L392; FR-M04-124 L196. | The DATA-M04-04 `source` list (L363) still lacks `teacher_databank`: XL2-39. |
| XL2-15 | Major | **Resolved** | M04 DATA-M04-05 L372 (7 values, value = label; `levelCode` nullable). | Matches M10 BR-M10-25 (L310). |
| XL2-16 | Major | **Resolved** | M04 `chapterLabel` L311 and M11 anchors 700401–700931 L671; M11 L247, L286, L306 and changelog L21. | 71 + 195 + 265 = 531 = 700931 − 700401 + 1; the anchors sit inside the M11 sub-block 700400–700999 (`ranges.js`). The M03 total stays 1,251. |
| XL2-17 | Major | **Resolved** | M03 §6.9 L390 and §6.10 L407: 1281 and the other M10-select chapter ids are kept; the rest take "next free integer, skipping reserved ids" (L414). | Chapter total unchanged. |
| XL2-18 | Major | **Resolved** | M11 §7 #2 L523 → M10 #12 `/api/guru/classes`; M04 #28–#30 L719–L721 → `/api/guru/dskp/*` (M10 #39–#41, L571–L573). | `api.js`: no unresolved `/api/teacher/classes` or `/api/dskp/*`. The remaining hits are the live `/guru/api/*` paths. |
| XL2-19 | Major | **Resolved** | M09 DATA-M09-01 `youtubeUrl` L311; DATA-M09-14 ArticleAttachment L429–L431; repository methods L624; admin #3/#4 L646–L647; M10 BR-M10-29 L314 (`isPublished`), #67–#70 L599–L602. | — |
| XL2-20 | Major | **Resolved** | M10 §6.9 L465–L479 (SPs 9001–9004, 221/206/222/214/179/194, 418, 6191, map tiles, 183 generic SPs); M04 Q-SP-AVAILABLE L268, facet L604, FR-M04-125. | 183 pairs counted from the list; generic ids 8021–8551, disjoint from the named ids 9001–9004 and ≤ 6191 (`ranges.js`); 9001 = 700001–700002 + 700101–700128 = 30. |
| XL2-21 | Minor | **Resolved** | M10 BR-M10-31 L316 (`in_progress`). | — |
| XL2-22 | Minor | **Resolved** | M11 L249, L304, L306 (`submittedAt`). | — |
| XL2-23 | Minor | **Resolved (alternative fix)** | M08 L385 ("DEMO-4S" is the observed live code); M10 BR-M10-02 L287 and §6.2.1 L413 accept stored observed codes. | This follows the round-1 wording ("unless the live code was observed"). |
| XL2-24 | Minor | **Resolved (Minor residual)** | M10 DATA-M10-01 L382 (key (`kind`, `id`)). | Enrolments are still keyed by an int `classroomId`: XL2-44. |
| XL2-25 | Minor | **Resolved** | M08 DATA-M08-01 L334 (`levelId`, `color` derived). | — |
| XL2-26 | Minor | **Resolved** | M09 E2E-M09-27 L833 (unpublished → admin publishes → first on `/artikel`). | — |
| XL2-27 | Minor | **Open** | TRACKER L393 still lists only `/admin/monitoring` under M17. | Delivery Lead: add the drill-down and export routes. |
| XL2-28 | Minor | **Resolved** | M11 NFR-M11-08 L612; URS DV-M11-23 (URS L2186). | — |
| XL2-29 | Minor | **Open** | build-plan L444 (`content.latestArticles(limit)`, `content.activeBanners()`) and L450 ("classes 2001–2003", "the M02 complimentary classes"). | solution-architect: use the M09 names `articles.latest(5)` and `banners.activeFor(user)`, and "2001–2002"; F-30 names 5302's classes once M10 records them (XL2-45). |
| XL2-30 | Minor | **Resolved** | M05 §6.12 L494 ("none seeded by M05"; read from M09). | — |
| XL2-31 | Minor | **Partly resolved** | Statuses are refreshed and M11 §9 cites the M10 **T** guard. Cross-reference versions and "requested" wording are still stale. | See XL2-47. |
| XL2-32 | Minor | **Resolved** | M10 DATA-M10-11 L483 (`DISPLAY_CONSTANT`, alternatives named). | — |
| XL2-33 | Minor | **Resolved** | M09 §6.9 L439 (clock 15:40). | — |
| XL2-34 | Minor | **Resolved** | M04 §6.2 L350 (`visibility` note). | — |

**Summary:** 32 of 34 resolved (7 of them with a Minor residual logged below), 2 still open (XL2-27, XL2-29). XL2-31 is partly resolved; its residual is XL2-47.

## R2.3 Fresh cross-check (M01–M11)

**Navigation (`nav.js`, 331 owned patterns).**
- 12 dangling targets and 76 targets covered by a prefix. Every dangling target is a documented non-route, a live POST path, an external URL or a path fragment, as in round 1.
- The round-1 dangling `/remedial/{id}` is now M05 Q4.
- New links resolve:
  - M05 Q5 `/misi-harian/:id`;
  - Q6 `/set-soalan-saya/:id/jawab`, which is distinct from the live-404 `/set-soalan-saya/{id}` in M10 FN-M10-1.2.2;
  - M10 S34 "Mula" → Q6;
  - "Lihat Quiz" → Q4 (behaviour for the teacher: XL2-40).

**API contracts (`api.js`, 330 owned endpoints).** The only duplicates are the accepted batch-1 pairs and the M11 reference to M10 #12. The script's "(referenced)" tag misses that reference; it is not a duplicate. M05 #20/#21 now have one owner. The unresolved `/api/...` strings are live `/guru/api/*` paths or prose (`/api/structured-sets` is the documented invalid path).

**Id ranges (`ranges.js`).**

| Store | Checked | Result |
|---|---|---|
| Users | 14 anchor blocks (canonical 1–11, M11 2001–2012, 3001–3008, 3101–3109, 3201–3215, M02 5001–5990 sub-blocks) | no overlap; runtime ≥ 9,000,001 |
| Questions | 570001–570025, 600001–600065, 700001–700215 (M08), 700301–700302 (M10), 700401–700931 (M11); sub-blocks 700001–700299 / 700300–700399 / 700400–700999 | no overlap; every anchor inside its module's sub-block; 522425–522447 and 525428–525433 inside the live range as `createdBy`/databank anchors |
| DSKP (M10) | generic SP/SK/Bidang 8021–8551; named 9001–9112; observed ≤ 6191 | no overlap within each table |
| Classes (M10) | 1–1,156 + `sc-{n}` + 2001–2002 | 13 + 645 + 92 = 750 |
| **Cross-store id use** | M10 TeacherQuestion 7501/7502 vs M04 question ids 1–564,161 | **collision when a TeacherQuestion id is used as a question id** → XL2-36 |

**Counts.** Every figure the batch shows is one of:
- a named query of its owner (M04 §4.1, M05 §6.14.2, M09 Q-*, M02 role facets);
- an M11-local query on an owner dataset (§6.5.1);
- a documented display constant or display data: M10 DATA-M10-11; M08 LeaderboardStanding observed/generated rows; M11 `s3Snapshot`.

None of the display values sits on the same screen as a computed figure that contradicts it. The only contradicting computed figure is the M08 school-admin "9 murid" (XL2-35).

**Roles.** These agree:
- M10 **T** endpoints (teacher or admin);
- the M04 teacher write contract (teacher or admin session);
- M09 teacher articles through M10 only;
- the M05 Q4–Q6 viewer-owned rule (M05 §9) and the M05 #20/#21 viewer filter;
- M11 `/guru/*` under the M10 guard.

The one gap is the teacher's own "Lihat Quiz" link (XL2-40).

**End-to-end flows.**

| Flow | Steps checked | Status |
|---|---|---|
| **A. Mission:** teacher creates → student dashboard/list → quiz → M10 status → M14 coins | M10 BR-M10-17, #28 → M05 #21 via `missions.forStudent` → Q5, #4 `{mode:'mission', missionId}`, questions from `missions.questionIdsFor` → BR-31 (coins 3 × correct, BR-09; step 6 hands the coins to the M14 wallet; M14 not written yet, so the prototype increments the seeded wallet) → M10 S11 status via Q-SESS-LINK | **OK** for `latih_tubi` (all chapters) and `tracking_a`; **broken for `youtube`** (XL2-36); chapter case can be empty (XL2-41); recipients storage (XL2-42) |
| **A′. Remedial test** | M10 BR-M10-12 generate → M05 #20 → Q4 → BR-31 step (8) `remedialTests.complete` → M10 S3 progress (BR-M10-13; stored status + Q-SESS-LINK for tests in progress) | **OK** for the student (E2E-M05-58); teacher preview link undefined (XL2-40) |
| **A″. Question set** | M10 BR-M10-18, #75 → S34 "Mula" → Q6 → BR-32 visibility/attempts via `questionSets.visibleFor` and Q-SESS-LINK | **OK** |
| **B. Teacher question → admin review → practice** | M10 #53 → M04 `questions.createFromTeacher` (`pending_review`, active, id ≥ 9,000,001; E2E-M04-65) → admin S1 filter / "Luluskan" → Q-ELIGIBLE; T4/T5 SPM subjects enter the pool (BR-M04-32) → M05/M06 practice; M10 S21 via Q-CONTRIB | **OK** |
| **B′. Databank report, paper, structured** | M04 #15 (`teacher_databank`, `outdated`, `success`), DATA-M04-05, `structured.*` | **OK** (naming Minors XL2-38, XL2-39) |
| **C. Article create → publish → visible** | admin: M09 #3 → `/artikel` and M05 dashboard (`articles.latest(5)`); teacher: M10 #67 → `articles.createFromTeacher` (`isPublished = false`) → M09 S3 publish → `/artikel` (E2E-M09-27) | **OK** |
| **D. Practice → M08 analytics** | BR-31 → M05 datasets → M08 Q-SESS-*/Q-ANS-* and Q-SP-AVAILABLE; M10 SP records | **OK** |

## R2.4 New findings

| ID | Sev | Modules | Doc IDs (side A ↔ side B) | Problem | Owner and fix |
|---|---|---|---|---|---|
| XL2-35 | **Major** | M02 ↔ M08 | M02 §6.15 C L547 ("3201–3215 (grade 10) at **900001**"), L550, L555 ↔ M08 SRS L436 ("9 murid (M02 students of school 900001: canonical 2 and 3001–3008; valid as long as M02 places no other fixture student there, XL2-03)"), E2E-M08-61 L666, URS AC-M08-04.3 | Under the XL2-02 definition (M02 student role count in the school-admin's school), SMK DEMO now holds 1 + 8 + 15 = **24** students. The asserted "2 kelas · 9 murid" is wrong for the seeds as specified. | **M02 (recommended):** place 3201–3215 **without a school**, grade 10, like the other T4 class members (the pool of 134). This moves 15 from "fixture-school students" (25 → 10) to "students without a school" (7 → 22). Every total stays the same (4,533; T4 card 149; nothing in the M11 segment). Update the L555 check line. **Alternative (M08):** recompute to "24 murid" in L436, E2E-61 and AC-04.3. Record the choice in the owner's changelog. |
| XL2-36 | **Major** | M10 ↔ M05 (M04) | M10 BR-M10-17 L302 (`youtube` → "the viewer's teacher questions of the subject"), DATA-M10-06 L451–L453 (TeacherQuestion: M10 ids, options A–D, `correctAnswer` 'A'…'D'), §6.11 designed 7501/7502, DV-M10-23 step text ↔ M05 BR-32 L322 (questions = `missions.questionIdsFor`), DATA-M05-01 L362 (`questionIds` → **M04** Question), DATA-M05-02 L383/L387 (`questionId` → M04; `isCorrect` from M04 `correctAnswer`), #4 L584 | A "Soalan & Rujukan" mission's pool is M10 TeacherQuestion rows. The M05 session, answer log, revision queue, mastery and M08/M11 analytics accept only M04 question ids. The ids overlap: 7501/7502 are also generated M04 ids (1–564,161), so the quiz would serve and mark unrelated M04 questions. It is also a second question store outside M04 (D12). | **M10** (with M05 acknowledging it): `missions.questionIdsFor` returns **M04 eligible question ids only**. For `youtube`, use the teacher's eligible M04 rows of the subject (Q-CONTRIB(viewer, subject) ∩ eligible, i.e. the S22 "Soalan Guru" contributions) and keep the TeacherQuestion rows as the mission's reference material (INFERRED, provisional, OQ-M10-10). If the TeacherQuestion MCQs must be the quiz items, M10 writes them through M04 `questions.createFromTeacher` so that they get M04 ids. Either way, state the 0-question case (XL2-41). |
| XL2-37 | Minor | M05 ↔ M04 | M05 #4 L584 (`scriptType:'latin'\|'mixed'`) ↔ M04 DATA-M04-01 L312 (`rumi`, `arab`, `jawi`, `mixed`), BR-M04-35 | The consumer enum has a value (`latin`) that the owner never produces. | **M05:** return the M04 values (`rumi\|arab\|jawi\|mixed`), or state the mapping (`rumi` → `latin`; `arab`/`jawi` → rtl rendering). |
| XL2-38 | Minor | M10 ↔ M04 | M10 BR-M10-20 L305 ("field names `chapterId`, `topicId` …") ↔ M04 DATA-M04-02 L350 (`curriculumChapterId`, `curriculumTopicId`) | Field-name mismatch on the structured write contract. | **M10:** use the M04 names in BR-M10-20, or say that #46 maps `chapterId` → `curriculumChapterId` and `topicId` → `curriculumTopicId`. |
| XL2-39 | Minor | M04 (internal) | DATA-M04-01 L344 ("generated rows use generated teacher/admin ids other than 1 and 5") ↔ §4.1 L266 and §6.13.1 L603 (16,817 generated rows `createdBy = 1`); DATA-M04-04 L363 (`source` list without `teacher_databank`) ↔ BR-M04-11 L215, #15 L706 | Two entity notes contradict the dataset spec and the endpoint. | **M04:** L344 → "user 1: the 16,817 rows of the layout block (§6.13.1); user 5: 700302; other rows a generated user id"; L363: add `teacher_databank`. |
| XL2-40 | Minor | M10 ↔ M05 | M10 FR-M10-23 L117, AC-M10-09.2 (the teacher's "Lihat Quiz" → `/remedial/7601`, new tab) ↔ M05 FR-M05-141 L230, BR-32 L322, §9 (Q4 only for the viewer's own test, else the global 404) | The teacher's link opens the M05 404 page, and neither doc says so. | **M05 or M10:** either Q4 gives the test's teacher (and the admin) a read-only preview (PROPOSED, provisional), or M10 FR-23 states that the teacher lands on the global 404 page (the live behaviour is unobserved, L-M10-04). |
| XL2-41 | Minor | M10 ↔ M04, M05 | M10 BR-M10-17 L302 (with a chapter → Q-ELIGIBLE(subject) ∩ `curriculumChapterId`; the S12 select offers every chapter of the subject, URS FN-M10-5.2.2) ↔ M04 §6.13.1 (the `curriculumChapterId` row: set only for the M05 D1–D4 chapter counts, "the rest `null`") ↔ M05 BR-32 (no 0-question rule) | A mission on any chapter without tagged questions (every T4/T5 chapter in the seed) has an empty pool, and no doc defines the start of an empty mission. | **M10:** define the fallback (e.g. an empty chapter pool → the subject pool) or block the launch. **M05:** BR-32 → 422 `NOT_ENOUGH_QUESTIONS` with a PROPOSED message when `questionIdsFor` is empty. |
| XL2-42 | Minor | M10 ↔ M05 | M10 BR-M10-17 ("recipients = BR-M10-04 students at launch time"), DATA-M10-04 L443–L445 (no recipient field), #26 L558 (`recipients`) ↔ M05 BR-32 ("the viewer is one of its recipients"), `missions.forStudent` | The launch-time recipient set is not stored, so students who join a class later cannot be told apart. | **M10:** add `recipientIds int[]` (set at launch) to DATA-M10-04, or define recipients as current members (and change the BR wording). |
| XL2-43 | Minor | M02 ↔ M11, M01 | M01 v1.9 changelog L29 ("M02 seeds its fixtures, including 3001–3008 per M11 §6.8") ↔ M02 §6.14/§6.15 (no `lastLoginAt` for 3001–3008) ↔ M11 §6.8 L483 ("lastLoginAt (requested of M01/M02)"), anchor "Pernah Login 8 / 8" | The owner does not specify the login values that the M11 teacher-view anchor needs. | **M02:** add the M11 §6.8 values for 3001–3008 (and state null or a value for 3201–3215 and the other fixtures at fixture schools) in §6.14. |
| XL2-44 | Minor | M10 ↔ M05, M08, M02 | M10 DATA-M10-01 L382 (key (`kind`, `id`)) ↔ DATA-M10-02 L429 (`classroomId int`, unique (`classroomId`, `studentId`)), M02 DATA-M02-10, M05 Q-SESS-CLASS(classroomId) | The members of school class sc-419 and classroom 419 cannot be told apart. | **M10:** add `classroomKind` to ClassroomStudent (or keep school-class enrolments in their own table) and pass (`kind`, `id`) to Q-SESS-CLASS. |
| XL2-45 | Minor | M02 ↔ M10 (build-plan) | M02 L490–L491 (fixture teacher 5302 owns "5 BESTARI" DMO201, "5 CEMERLANG" DMO202, "5 GEMILANG" DMO203; the 90 complimentary students are enrolled there) ↔ M10 §6.2.1 L404/L411 (only "classes of other (generated or fixture) teachers … generated rows") ↔ build-plan L450 | The owner does not register the three classes: no ids, level, codes or anchor rows. Their join codes and S7 rows cannot be seeded from M10. | **M10:** add the three classes to the §6.2.1 designed anchors (ids, `tingkatan-5`, DMO201–203, school 8102, teacher 5302, members) inside the T5 cell. **solution-architect:** F-30 cites them. |
| XL2-46 | Minor | M05 ↔ M02, M10 | M05 §6.14.1 L518 (T5 level cell 29,971 sessions) and feasibility L524 ↔ M02 §6.15 C (only class 228's members are placed) | The 29,971 T5 sessions (≈ 28,300 outside class 228 and the designed rows) cannot fit in the 5,795 generated `other` answers. The T5-class members who have sessions must therefore be monitoring-school grade-11 students, and no doc says so. | **M05:** add this to the feasibility paragraph. **M02:** the matching placement line (the T5 class members with sessions are grade-11 students of the monitoring schools, inside each school's Aktif). No count changes. |
| XL2-47 | Minor | M08, M10, M11 (XL2-31 residual) | M08 Related L14 (M02 v1.7, M04 v1.6, M10 v1.2); M10 Related L14 (M08 v1.3); M11 Related L14 (M04 v1.7, M10 v1.2); M10 FR-10/91/115, BR-M10-06/21/27 and §6.11 ("requested M04 query … R-M04-01/02"), changelog L20 ("M04 lists three [scriptType] — request R-M04-07"), §7 L611 ("plus 4 referenced" while the list also names M05 #20/#21 and Q4); M11 §6.1 L244 and L247 ("requested", "§6.10 request"), §6.8 L483 | The referenced versions and the "requested" wording are stale: these contracts are now delivered by M02 v1.9, M04 v1.8 and M05 v1.6. | **Each owner** refreshes the references at its next edit (no behaviour change). |

Carried and still open from round 1: **XL2-27** (Delivery Lead, TRACKER M17 routes) and **XL2-29** (solution-architect, build-plan F-29/F-30 names and classes).

## R2.5 Notes (no finding)

- **Aliases.** M06 still calls the M04 store `questionStore.*` / `structuredStore.*`. M04 §7.1 (L730) declares them aliases of `questions.*` / `structured.*`, so there is no contract gap. Rename at the next M06 edit.
- **SP records.** The admin SP records on M08 S7 (221 3 answers, etc.) are M08-owned stored read models (SpRecord, L357), as accepted in round 1. The M04 `dskpSpId` rows sit in BM T4 non-pool cells and the M05 anchors carry `dskpSpId = null`. The two definitions do not meet on one screen.
- **Attendance.** On 24/09 the designed answers of 3001, 3002 and 3007 (1–2 each) stay below the attendance threshold of 5 answers (BR-M10-07, L292), so M10 S7 "0 % on 24/09" is consistent.
- **Accuracy range.** The PROPOSED correct-answer count 381,842 is inside the range for 79.8 %: 381,603 → 79.750 % and 382,081 → 79.8499 % both round to 79.8.

## R2.6 Findings by owner (open)

| Owner | Major | Minor |
|---|---|---|
| M02 | XL2-35 (or M08) | XL2-43, XL2-46 (with M05) |
| M10 | XL2-36 | XL2-38, XL2-40 (or M05), XL2-41 (with M05), XL2-42, XL2-44, XL2-45, XL2-47 (with M08, M11) |
| M05 | — | XL2-37, XL2-46 |
| M04 | — | XL2-39 |
| Delivery Lead / solution-architect | — | XL2-27, XL2-29 |

**Suggested order.**
1. M02 XL2-35 (one placement line), then M10 XL2-36 with XL2-41 (pool rule and empty case).
2. The M10 Minors before F-30: XL2-44 and XL2-45.
3. The remaining Minors at each owner's next edit.

After the two Majors are fixed, a targeted round 3 is needed only on XL2-35 and XL2-36. For each, confirm the changed lines and re-run `ranges.js` for the student totals.

---

# Round 3 — targeted re-check

| Field | Value |
|---|---|
| Scope | The 2 Majors and 13 Minors open after round 2, plus a regression scan of the changed lines. Versions on disk: M01 v1.9, M02 v1.10, M03 v1.8, M04 v1.9, M05 v1.7, M06 v1.4, M07 v1.6, M08 v1.7, M09 v1.4, M10 v1.5, M11 v1.7; build-plan v1.4; TRACKER. |
| Method | Docs only, no browser, no edits to requirement docs or TRACKER. Scripts in the scratchpad `xl2-r3/`: `g.js` for the cross-doc grep, `ranges.js` for the totals, and `vers.js`, which compares every cited "Mxx vN" with the `Version` row of the file. Line numbers refer to the SRS files. |
| Date | 2026-09-26 |

## R3.1 Verdict

**PASS — 0 Critical, 0 Major, 4 Minor open.**

Both Majors are closed. Of the 13 round-2 Minors, 10 are resolved and 3 are partly resolved: XL2-44, XL2-45 and XL2-47. The regression scan found 1 new Minor (XL2-48). No finding blocks a build.

The four open Minors should be fixed as follows:
- **XL2-44 and XL2-45:** before F-30.
- **XL2-47 and XL2-48:** at the owners' next edit.

| Severity | Open |
|---|---|
| Critical | 0 |
| Major | 0 |
| Minor | 4 (XL2-44, XL2-45, XL2-47 partly resolved; XL2-48 new) |

## R3.2 Status of the round-2 findings

| ID | Sev | Status | Evidence |
|---|---|---|---|
| XL2-35 | Major | **Resolved** | M02 §6.15 C: L567 lists 3201–3215 without a school (grade 10). L566 says SMK DEMO holds canonical 2 and 3001–3008 = exactly **9** students, with no other fixture student there. L569 puts class 516 without a school, giving the T4 card 134 + 15 = 149. The check line L575 reads 4,158 + 10 + 22 + 137 + 134 + 72 = **4,533**, "School 900001 = 9 students". M08 L437 cites M02 v1.10, and the anchor "2 kelas · 9 murid · 1 guru" is unchanged (E2E-M08-61, URS AC-M08-04.3). A grep finds no remaining text that places 3201–3215 at 900001. |
| XL2-36 | Major | **Resolved** | M10 DATA-M10-06 is now **ReferenceSet** (L454–L456): "M10 stores no question", each MCQ is written through M04 `questions.createFromTeacher`, and `questionIds` are M04 ids. Endpoints #32/#33 (L567–L568) read and write through M04. Seeds 7501/7502 are removed (§6.11 L514; E2E creates the MCQs at runtime with ids ≥ 9,000,001). No TeacherQuestion or 7501/7502 remains in M04, M05 or M10, apart from the changelog and the removal note. BR-M10-35 (L321) says `missions.questionIdsFor` returns **only eligible M04 ids**; for `youtube` these are the viewer's approved Soalan & Rujukan MCQs. M05 BR-32 (L323) acknowledges this: "it returns M04 eligible question ids only, XL2-36". |
| XL2-37 | Minor | **Resolved** | M05 #4 (L585): `scriptType:'rumi'\|'arab'\|'jawi'\|'mixed'`, the M04 enum (L312). |
| XL2-38 | Minor | **Resolved** | M10 BR-M10-20 (L306) uses the field names `curriculumChapterId` and `curriculumTopicId`. |
| XL2-39 | Minor | **Resolved** | M04 L345: `createdBy` user 1 = the 16,817 rows of the layout block, user 5 = 700302. M04 L364: `source` includes `teacher_databank`. |
| XL2-40 | Minor | **Resolved** | M05 BR-32 (L323), FR-M05-141 (L231) and the §9 note (L729): the test's teacher and any admin get a read-only preview on Q4; others get the global 404 page. M10 FR-M10-23 (L118) matches. |
| XL2-41 | Minor | **Resolved** | M10 BR-M10-35 (L321): an empty `latih_tubi` chapter pool falls back to Q-SPM-POOL(subject) (PROPOSED); any other empty pool returns `[]`. M05 BR-32 (L323) and FR-M05-143 (L233) then answer 422 `NOT_ENOUGH_QUESTIONS` "Soalan tidak mencukupi.", create no session and return to `/misi-harian` (E2E-M05-59, L831). |
| XL2-42 | Minor | **Resolved** | M10 DATA-M10-04 (L448) has `recipientIds int[]`. BR-M10-17 (L303) says recipients are stored at launch, and later joiners are not recipients. |
| XL2-43 | Minor | **Resolved** | M02 §6.14 `lastLoginAt` table (L480–L490): 3001, 3002 and 3007 → 2026-09-24; 3003 → 09-18; 3004 → 09-15; 3005, 3006 and 3008 → 09-22; all at 20:00; the other fixtures are null. M11 §6.8 (L484) and XR-M11-01 (L506) cite M02 v1.10. The values give M11's "Pernah Login 8 / 8". |
| XL2-44 | Minor | **Partly resolved** | M10 DATA-M10-02 (L432) now reads `{classroomKind, classroomId, studentId, …}`, unique on the triple, and states that "M02 Enrolment and M05 Q-SESS-CLASS take the same pair". The other two docs do not follow: M02 DATA-M02-10 (L430) still defines `Enrolment = {classroomId, studentId, status}`, and M05 Q-SESS-CLASS (L541) still takes `classroomId` alone. See R3.3. |
| XL2-45 | Minor | **Partly resolved** | M10 §6.2.1 L414 registers classes 2011 "5 BESTARI" (DMO201), 2012 "5 CEMERLANG" (DMO202) and 2013 "5 GEMILANG" (DMO203): T5, school 8102, teacher 5302, 5901 in all three (L410 and L863 agree). Two lines were not updated: the §6.2.1 id-range arithmetic (L411: "`tingkatan-5` 645 = 643 in 1–1,156 + 2001 + 2002", "+ 2 designed classes … = 750") and the designed-anchor row (L413, which lists only 2001/2002). Build-plan F-30 also still says the DMO201–203 classes "are seeded only once M10 registers them … until then F-30 cites them as pending". See R3.3. |
| XL2-46 | Minor | **Resolved** | M05 §6.14.1 feasibility (L525) and M02 §6.15 C (L571): T5-class members with sessions are grade-11 students of monitoring schools. |
| XL2-47 | Minor | **Partly resolved** | Most references are refreshed. Five citations are still stale, and M05 does not cite BR-M10-35. See R3.3. |
| XL2-27 | Minor | **Resolved** | TRACKER L397–L401 (M17) lists `/admin/monitoring/sekolah/{id}`, `…/pelajar/{id}`, `…/guru/{id}` and `/admin/monitoring/export/pdf\|csv`. |
| XL2-29 | Minor | **Resolved** | build-plan F-29 (L449) uses `articles.latest(5)` and `banners.activeFor(user)`. F-30 (L456) names classes 2001 and 2002 and says "there is no class 2003". The remaining "pending" wording for 5302's classes is recorded under XL2-45. |

## R3.3 Regression scan and open findings

**Totals.**
- M02 C (L566–L575), recomputed:
  - students: 4,158 + 10 + 22 + 137 + 134 + 72 = **4,533**;
  - teachers: 522 + 29 = **551**;
  - schools with users: 34 + 23 + 3 = 60, so "Jumlah Sekolah" = 60 − 3 = **57**;
  - anchors per role: 343 students and 32 teachers (L546).
- School 8102 still contains its fixtures within the observed counts:
  - 5001–5210 and 5901–5990 give 300 grade-11 students with `lastLoginAt` null (L566; table L480–L490) out of 776 T5, so 300 ≤ 755 "Belum login";
  - 5302 and 5303 sit inside the 118 teachers with `lastLoginAt` null, alongside 116 generated teachers of whom 42 are logged in (L563).
- The new classes 2011–2013 hold only the complimentary students, who have no answers. No M11 figure moves.
- Id stores are still disjoint. The M10 classes 2011–2013 and the M11 user anchors 2011–2012 share numbers but live in different stores.

**Versions (`vers.js` and grep; files on disk).**
- The Related rows of M08 are current (M01 v1.9, M02 v1.10, M04 v1.9, M05 v1.7, M10 v1.5).
- These citations are stale, all in XL2-47 below:
  - M05 Related (L14) cites M04 v1.8; the file is v1.9.
  - M10 Related (L14) cites M08 v1.6 and M11 v1.6; the files are v1.7.
  - M11 Related (L14) cites M04 v1.7; the file is v1.9.
- The older version numbers in the M08 and M10 status lines are revision history, not references.
- M06 Related (M04 v1.2, M05 v1.2) predates batch 2 and is outside this review.

**M05 ↔ BR-M10-35.** M05 BR-32 (L323) describes the pool contract ("M10 owns the pool, incl. the chapter case; … M04 eligible question ids only"), but it does not cite **BR-M10-35** anywhere, including FR-M05-143. M10 BR-M10-35 says it is "cited by M05 BR-32 / FR-M05-143".

| ID | Sev | Modules | Problem | Owner and fix |
|---|---|---|---|---|
| XL2-44 (residual) | Minor | M10 ↔ M02, M05 | M10 L432 claims that M02 Enrolment and M05 Q-SESS-CLASS take the (`classroomKind`, `classroomId`) pair. They do not: M02 L430 has `{classroomId, studentId, status}`, and M05 L541 has `Q-SESS-CLASS(classroomId[, subjectId])`. | **M02:** DATA-M02-10 Enrolment adds `classroomKind`. **M05:** Q-SESS-CLASS / Q-ANS-CLASS take (`classroomKind`, `classroomId`). **Timing:** before F-30. |
| XL2-45 (residual) | Minor | M10 (build-plan) | The M10 §6.2.1 arithmetic does not include the three new designed classes. The T5 cell should read 645 = 640 in 1–1,156 + 2001, 2002, 2011, 2012, 2013, and the row total should read "+ 5 designed classes" (so 743 in range + 2 school classes + 5 designed classes = 750). L413 lists only 2001/2002. Build-plan F-30 (L456) still calls DMO201–203 "pending". | **M10:** update L411 and L413. **solution-architect:** F-30 seeds 2011–2013. **Timing:** before F-30. |
| XL2-47 (residual) | Minor | M05, M10, M11 | Stale Related versions (M05 → M04 v1.8; M10 → M08 v1.6 and M11 v1.6; M11 → M04 v1.7). M05 BR-32 and FR-M05-143 do not cite BR-M10-35, although M10 says they do. | **M05:** cite BR-M10-35 in BR-32 and FR-M05-143, and refresh Related. **M10** and **M11:** refresh Related. No behaviour change. |
| **XL2-48 (new)** | Minor | M05 ↔ M10 (build-plan) | The M05 Q4 teacher/admin preview (BR-32, L323) reads "data from `remedialTests.get(id)`". The M10 repository does not expose that method: M05 SQ-5, M10 §6.8 and L862, and build-plan F-30 list only `remedialTests.forStudent` and `remedialTests.complete`. The preview therefore depends on a method its owner has not defined. | **M10:** add `remedialTests.get(id)` (record incl. `questionIds`, `teacherId`, `status`; read access for the test's teacher and admins) to the repository list and DATA-M10-09. **solution-architect:** add it to F-30. |

## R3.4 Final counts, batch 2 (M08–M11)

| Round | Critical | Major | Minor | Verdict |
|---|---|---|---|---|
| 1 | 0 | 20 | 14 | FAIL |
| 2 | 0 | 2 | 13 | FAIL |
| **3** | **0** | **0** | **4** | **PASS** |

**XL gate for batch 2: passed.** No Critical or Major finding is open.
