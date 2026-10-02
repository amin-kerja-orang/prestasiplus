# Cross-module logic review — M01–M07

| Field | Value |
|---|---|
| Scope | Approved URS + SRS of M01 authentication, M02 users-schools, M03 curriculum, M04 question-bank, M05 practice, M06 spm, M07 pksk. M08 student-performance was used as draft input only and is not graded. |
| Method | Docs only, no browser. A route-reference scan (script) and an entity/API/seed comparison of SRS §2, §6 and §7 for every module, plus targeted reads of the business rules, FRs, E2E and deviation tables they cite. |
| Rules applied | CLAUDE.md §6 (D7 fidelity, D9 deviation rule, D10), "seeds mirror observation", master SRS §7.4 (integer ids where live shows them), TRACKER canonical seed accounts 1–11. Fixes below align to observed live behaviour and add no features. |
| Date | 2026-09-25 |

## Verdict

**FAIL.** There is 1 Critical and 18 Major findings. Each module passed its own audit, but the modules do not yet fit together in five areas:
- the SPM question pool sits outside the question store;
- the shared practice-session store has two different schemas;
- question and structured-question counts contradict each other;
- entity changes that were requested of M04 are still missing;
- seed values conflict for the canonical accounts 4 and 8.

| Severity | Count |
|---|---|
| Critical | 1 |
| Major | 18 |
| Minor | 9 |
| **Total** | **28** |

## 1. Navigation integrity (script result)

- **Owner catalogue.** 273 route patterns: the SRS §2 route tables of M01–M08, plus every route in TRACKER §4 for M09–M26.
- **Scan.** Every backticked path in the 14 approved docs: about 2,485 code spans, of which 241 point to a target outside the catalogue (109 unique).
- **Resolved by an owned prefix (208 refs).** These are action endpoints (`/admin/users/:id/toggle-active`), sub-resources and E2E test values (`/practice/XYZ`, `/pksk/level/T9`).
- **Documented non-routes.** These are allowed:
  - live POST targets: `/password/email`, `/report-question`, `/question-reports/{id}/update`;
  - pages that are 404 on live and documented as such: `/email/verify`, `/packages`, `/practice/{CODE}/subjektif`;
  - `/latih-tubi`, a dead link fixed by M01 DV-02;
  - M10 routes: `/guru/soalan-berstruktur/cipta` and `/guru/api/dskp`.
- **Dangling: 1 target.** `/pusat-nota-ringkas` (see XL-18).
- **Covered by prefix only: 1 target.** `/bilik-duta/{slug}` (see XL-28).

Guest redirects are consistent: every module sends guests to `/login` through M01 FR-M01-14. Non-admin handling of `/admin/*` is also consistent: M02 FR-M02-99, M03 FR-M03-94, M04 FR-M04-109 and M07 FR-M07-59 all redirect to the M01 BR-07 landing page, and the API returns 403. Landing pages (M01 BR-07) match their owners: `/dashboard` (M05, open to all roles per M05 §9), `/admin` (M17), `/ppd/dashboard` and `/jpn/dashboard` (M18).

## 2. Findings

| ID | Sev | Modules | Doc IDs (side A ↔ side B) | Problem | Recommended owner and fix |
|---|---|---|---|---|---|
| XL-01 | **Critical** | M06, M04, M05 | M06 DATA-M06-02, §6.12 `genQuestion` (virtual ids `9_000_000 + hash`), E2E-M06-41 ↔ M04 BR-M04-03, BR-M04-12, BR-M04-17, BR-M04-30, FR-M04-70 ↔ M05 BR-14, §6.12 ("questions of A2–A5/P1–P4 come from the M06 pools") | The SPM objective pool is created on demand outside the M04 question store, so the report flow cannot complete for SPM questions:<br>(a) A student reports from Q1–Q3 (`source:'spm'`, the main live report source). The question id is not in M04, so the admin queue shows "Soalan tidak dijumpai" (BR-M04-30). There is no auto-deactivation (BR-M04-12), no reactivate/deactivate action and no "Buka Soalan Sama" link.<br>(b) BR-M04-03 says only `approved` + active questions are served to M06, but E2E-M06-41 serves 136891, which M04 seeds as inactive.<br>(c) A T4/T5 question that an admin creates in M04 never reaches SPM practice.<br>(d) SPM pool counts are larger than the whole bank for the same subject (MATH pool 1,681 vs a few dozen MATH questions in M04).<br>(e) "Buka Soalan Sama" for a question outside the pool (e.g. a reported M05 D1 question) returns 422 → S4, or 404 for non-SPM codes such as JAWI.<br>(f) M05 revision (BR-14) has to serve admin BM questions that exist only in the M06 pool. | **M06** (with M04). Seed the SPM pool as real rows in the M04 store (M04 ids, `subjectId`, `educationLevelId` 10/11, `difficultyLevel`, `status`, `isActive`, a `sourceSet` tag). Make the S2–S4 pool a filter over the store with BR-M04-03 applied. Keep the hub constants of BR-M06-01 as they are. The count impact is handled in XL-02. |
| XL-02 | Major | M01, M03, M04, M05, (M07, M08) | M01 FR-M01-11, BR-21, §6.8 `questionCount 128989`, E2E-M01-01 ↔ M03 FR-M03-98, §6.9 (129,389 / 129,380), E2E "13872 soalan" ↔ M04 BR-M04-20, FR-M04-110 (DV-M04-04: "M01 landing and M03 columns read the same objective count"), §6.11 "508 → 26 pages", E2E-M04-05 ↔ M05 BR-05 ("Total Soalan = M04 total"), §6.12 (+541 into the M04 store; SQ-3 says 577; "M04's 505") ↔ M07 (763 PKSK rows in the same store), M08 draft (+51) | One count has to equal several different values at once. M04 DV-04 makes M01 and M03 read the store count, but M01 and M03 seed and assert live constants. The M05, M08 and PKSK rows appended to the store break the M04 literal 508 / 26 pages. M05 itself gives both 541 and 577, and quotes M04 as 505 (M04 says 508). | **Delivery Lead decision, then M04 / M01 / M03 / M05.** Recommended: apply DV-M04-04 everywhere (one derived count). Then (1) the M01 stats come from the store and E2E-M01-01 asserts the derived value; (2) M03 FR-98 always derives, and its E2E stops asserting 13872; (3) M04 sets its totals, or its tests load only the M04 fixture; (4) PKSK rows are excluded (XL-07); (5) M05 corrects 541/577/505. Alternative: keep M01 PlatformStats as the observed login constant and remove "M01 landing" from BR-M04-20. |
| XL-03 | Major | M05, M06 | M05 DATA-M05-01/02, BR-06, API #12 ↔ M06 DATA-M06-04, §6.4 note ("owner is a Delivery Lead decision", "M05 reads … `mode = spm`") | The two modules define one store with two schemas:<br>• `mode` vs `type`<br>• `subjectId` (int) vs `subjectCode`<br>• `status` `active\|submitted` vs `in_progress\|completed`<br>• `questionCount/correctCount` vs `total/correct`<br>• `timeSpent` vs `durationSec`<br>• `coinsEarned` vs `coins`<br>• an embedded `answers[]` vs the M05 QuizAnswer log<br>M06 cites a `mode = spm` value that does not exist, and it leaves ownership open while M05 claims it. M06 says "the contract is identical either way", which is not true. | **M06** adopts M05 DATA-M05-01/02 as the single owner schema. M06 maps its screen fields: `type` = `mode`, `total` = `questionCount`, `durationSec` = `timeSpent`. Remove "`mode = spm`". |
| XL-04 | Major | M06, M05 | M06 FR-M06-21, BR-M06-19, API #10 ↔ M05 BR-06, BR-14, BR-20, FR-M05-55, §6.12 anchors (admin revision BM 46 from A3–A5; S12 SEJ 14/40 from A2) | M06 submit only stores the session totals. M05 relies on SPM answers being in the answer log, the revision queue, the S12 mastery counters and the M14 wallet and streak (M06 #10 returns `gamification`, but no rule writes it). A new SPM session therefore never shows up in M05 S5, S6, S8, S11 or S12, while the seed says it should. M05 FR-M05-55 also leaves out the SubjectMastery update that its own BR-20 requires. | **M06** states that SPM submit applies M05 BR-06, BR-09, BR-14 and BR-20 (write QuizAnswer rows, queue, counters, wallet). **M05** adds the BR-20 counter update to FR-M05-55. |
| XL-05 | Major | M05 ↔ M01, M02, M07, (M08) | M05 DATA-M05-01 `userId: string`, DATA-M05-02 `userId: string` ↔ M01 DATA-M01-01 `id integer` (v1.5), M02 DATA-M02-01, M07 DATA-M07-04, M08 draft | The practice store keys users by string, but every other module uses the canonical integer ids. | **M05**: `userId: int` in DATA-M05-01/02/03/04/05/06/11. |
| XL-06 | Major | M02 ↔ M01, (M08) | M02 DATA-M02-03 `School.id string`, DATA-M02-07 `schoolId string`, DATA-M02-04 Jpn/Ppd ids string ↔ M01 DATA-M01-06 `SchoolSummary.id integer` ("as live `id:number`"), M02 API #38 "same contract as M01", M02 §6.2 projection | The owning module types the school id as a string, while its own projection and the public API return integers. School ids appear in URLs (`/admin/schools/{id}/edit`, `?school=`), so the master §7.4 integer rule applies. | **M02**: School, SchoolSubscription.schoolId (and Jpn/Ppd if live shows numeric ids) → `int`. |
| XL-07 | Major | M04 ↔ M07 | M04 DATA-M04-01 (`subjectId`, `educationLevelId` required; no PKSK fields), BR-M04-01 status enum, BR-M04-20, API #1/#4 ↔ M07 DATA-M07-02 (change request OQ-M07-09a), BR-M07-02 `pending`, BR-M07-21, FR-M07-60, API #19 | M07 stores 763 PKSK questions (ids 177698–178460) in the M04 store. M04 still lacks:<br>• `pkskDomainId`, `pkskTargetLevel`, `pkskOptions`;<br>• nullable subject, level, options and correctAnswer;<br>• the status `pending` (M04 only has `pending_review`);<br>• exclusion from lists and counts;<br>• the PKSK detail rendering.<br>This is TRACKER queued item M07 OQ-09. | **M04**: add the fields and the null rules. Either add `pending` to the enum or document the M07 `pending` ↔ M04 `pending_review` mapping (M07 observed `pending`). Exclude `pkskDomainId ≠ null` rows from BR-M04-20 counts, S1 filters and tiles. Make #4 return the PKSK fields. |
| XL-08 | Major | M04 ↔ M05 | M04 DATA-M04-01 (no chapter field) ↔ M05 DATA-M05-07 `Question.curriculumChapterId` ("new, nullable"), BR-04, API #4 chapter mode, DATA-M05-02 `chapterId` | Chapter mode needs a field that the owning entity does not define (TRACKER queued item 13b). | **M04**: add `curriculumChapterId: int \| null` (→ M03 CurriculumChapter) to DATA-M04-01. It is not on the S2/S4 forms (live has no field), so admin-created questions stay out of chapter mode, as live. |
| XL-09 | Major | M04 ↔ M05, M06 | M04 §2 S14 props `{questionId, variant, quizSessionId?}`, FN-M04-3.1.9 (MCQ `source "spm"`), BR-M04-11 value set (`spm`, `structured_attempt`, legacy `quiz`, `latihan`, `papan_bijak`) ↔ M05 FR-M05-56/88/89, API #22 `source:'latihan'\|'revision'`, SQ-2 (props `source`, `failureText`, S7 tints) ↔ M06 FR-M06-20 `source:'spm'` | The shared modal cannot do what its host modules specify: it has no `source` prop (the source is hard-coded "spm"), no failure-text prop and no tint variant. `revision` is not in the M04 value set. TRACKER queued item M05 OQ-13a. | **M04**: add props `source` (default `'spm'`), `failureText` and a `tint` set to S14. Add `revision` to BR-M04-11 (observed on the M05 S7 page). |
| XL-10 | Major | M05 ↔ M06 | M06 FR-M06-20 (Q1–Q3 "render the M05 quiz component"), §13 Q2 (props `session`, `onAnswer`, `onSubmit`, report `source`) ↔ M05 FR-M05-52 (component defined only for M05 pages, bound to `/api/practice/sessions/*`) | M06 depends on a reusable quiz component whose interface M05 never defines. The M06 open question was left for "when the M05 SRS is written" and is still unresolved. | **M05**: specify the quiz component contract (session data in; answer, submit and report callbacks, or an endpoint set passed in; header and result labels). **M06** closes its Q2 against it. |
| XL-11 | Major | M04, M05, M06 | M04 §6.11 (structured anchors 2509, 3698–3700, 3703, 4454 + 4455–4508; total 60 → 3 pages), BR-M04-20 S8 counts, E2E S8 ↔ M06 §6.10 ("M04 anchors kept 3701, 3702, 3704–3706, 2505, 2510, 2511"; generator ids 10001+ to 4,059 sets), BR-M06-12, §13 Q3 ↔ M05 §6.12 (structured = M04 anchors + M04 generated set), BR-23 | The structured store is defined three ways. M06 cites M04 anchors that M04 does not have. The M06 generator adds about 4,000 rows to the store behind M04 S8 (total 60) and M05 S10 (the M04 set). The "same generator" alignment (M06 Q3) is still open. | **M04** (owner) adopts the M06 generator and anchors in §6.11 and updates the S8 totals and E2E. **M05** §6.12 points to it. **M06** closes Q3. |
| XL-12 | Major | M04 ↔ M05, M06 | M04 DATA-M04-02 `kbatLevel 2–5`, BR-M04-28 (labels 2–5) ↔ M05 DATA-M05-10 KBAT filter 1–6, BR-23 badges LOTS 1–2 / HOTS 4–6 ↔ M06 DATA-M06-09, §6.10 (KBAT 1–5 spread, 3 BM sets at KBAT 6) | The KBAT value set of the owning entity (2–5) is narrower than the data and filters observed in M05 and M06 (1–6). M04 S8 has no label for 1 or 6. | **M04**: `kbatLevel` 1–6, with labels for 1 and 6 taken from the observed M05 filter ("1. Mengingat", "6. Mencipta"). BR-M04-28 notes that "5 Menilai/Mencipta" is the live admin label. |
| XL-13 | Major | M04 ↔ M02 | M04 API #31 `GET /api/schools?all=1` "owned by M02" (S11 school filter, BR-M04-19) ↔ M02 §7 (only `/api/admin/schools` paginated 30, `/api/schools/search` limit 20) | Dangling API reference: the owner does not specify the endpoint. | **M02**: add the read-only lookup `GET /api/admin/schools/options` (`[{id, name}]`, alphabetical, as the live S11 select). **M04** #31 points to it. |
| XL-14 | Major | M01 ↔ M03, M05, (M08) | M01 §6.8 id 4 `pelajarmaju`: grade 11 (Ting. 5), SMK Demo ↔ M03 §6.9 "New: pelajarmaju … grade 1" ↔ M05 §6.12 grade 1 (MATH D1 chapters, sessions M1–M4) ↔ M08 draft (MATH D1 analytics) | The canonical account has two grades. All the data that uses it is Darjah 1, and M03 still describes it as "new" (it predates the canonical table). | **M01**: set id 4 to grade 1 (Darjah 1) with a primary school (SK Demo). **M03**: say "canonical id 4 (M01)" instead of "New". |
| XL-15 | Major | M01 ↔ M02 | M01 §6.8 id 8 `adminsekolah`: school SK Demo (Johor) ↔ M02 §6.14 id 8 "School admin of a coded SMK with no S16 package" | Two different schools for the same account. S16 assigns SPM T4/T5 packages, which do not fit an SK (primary) school. | **M01**: set id 8's school to the coded SMK used by M02 (or M02 names it). |
| XL-16 | Major | M02 ↔ M05 (M19) | M02 BR-22, BR-27, BR-31 (`basic` 500 questions/month/student, `full` unlimited), BR-15 (DELIMa import requires an active subscription), FR-M02-70 and DATA-M02-09 (complimentary "pakej penuh percuma", `packageExpiresAt`) ↔ M05 BR-07 (subscribed = `User.subscriptionExpiresAt` only; otherwise 50-question trial) | The rules contradict each other. A student imported into a subscribed school, or a complimentary student, is still limited by the 50-question trial and sees "Percubaan Percuma" and "Langgan Sekarang". The school `questionLimit` is never read. | **M05** BR-07, with a dependency note for M19: record which entitlement sources count as subscribed (individual package, a school subscription covering the student's `classLevel`, complimentary until `packageExpiresAt`) as INFERRED and open question for M19. Do not add new UI. |
| XL-17 | Major | M03 ↔ M05, (M08) | M03 DATA-M03-07 LearnerTopicProgress ("owned by M05/M08 … seeded until M05 writes them"), BR-14/15 Peta Belajar states ↔ M05 FR-M05-55 and §7 (no writer) | Nothing writes topic progress. The "started" and "mastered" Peta Belajar and `/topics/{id}` states can only come from seed data, and the owner named by M03 does not accept the ownership. | **M03**: state that the records are a read-only seeded mirror, with the live writer UNOBSERVED (as live, D7), and drop "until M05 writes them". Alternatively M05 declares the write rule if one is observed. |
| XL-18 | Major | M06 → M25 | M06 URS FN-M06-6.3.3 (S12 link "jana nota ringkas" → `/pusat-nota-ringkas`, "M25") ↔ TRACKER §4 M25 route list (not present) | Dangling link target: no module lists the route. | **Delivery Lead**: add `/pusat-nota-ringkas` to the TRACKER §4 M25 checklist so that M25 discovery owns it. |
| XL-19 | Major | M05 ↔ M04 | M05 BR-14 (the queue keeps any wrongly answered question; revision serves up to 20 queued), BR-04 (eligibility) ↔ M04 BR-M04-03 ("only `approved` + active questions are served to practice (M05/M06)"), BR-M04-12 | After a report deactivates a question, M05 revision still serves it. The eligibility rule and the queue rule contradict each other. | **M05** BR-14: queued questions are served only while eligible under BR-M04-03 (S6 and the badge count the same set). Check the admin anchors (S6 BM 46) after XL-01. |
| XL-20 | Minor | M01, M03, M04, M05, M06, (M08) | M01 DV-13, M03 DV-04 (title, no subtitle) ↔ M04 DV-02, M05 DV-01 (the page's own subtitle) ↔ M06 DV-07 (title + "Selamat datang kembali" in the user shell; none in the admin shell) | The same live defect (stale "Dashboard" header) is fixed with three different subtitle policies. Each screen has explicit copy, so behaviour does not conflict, but the shell rule is not uniform. | **Delivery Lead / M23 global shell**: write the rule down once ("own live subtitle when the page has one; otherwise none / 'Selamat datang kembali'"). The modules keep their per-screen copy. |
| XL-21 | Minor | M02 ↔ M03, M07 | M02 DV-M02-01 (sticky "Tindakan" at 1024–1279) ↔ M03 DV-M03-03 and M07 DV-M07-07 (in-card scroll, no sticky column; M07 cites M02 DV-01 as its precedent) | Two treatments of the same wide-table case, and M07 cites M02 as a precedent for a treatment M02 does not use. | **Delivery Lead**: accept both as per-screen choices (NFR-RESP-05 b) and correct the precedent wording in M07 DV-07. Alternatively drop the sticky column in M02. |
| XL-22 | Minor | M01, M04, M06, M07 ↔ M02, M03, M05 | M03 DV-06, M05 DV-11, M02 DV-01 (text < 12 px raised to 12 px) ↔ no text-size statement in M01, M04, M06, M07 | The master NFR-02 rule (text < 12 px is unreadable) is applied in three modules. The other four modules have no evidence either way. | **M04/M06/M07 (and M01)** at their next audit: confirm that no content text is < 12 px, or add the same deviation. |
| XL-23 | Minor | M05 ↔ M03, M01/M02 | M05 DATA-M05-07 `Subject.usedCount`, `User.trialQuestionsUsed` ↔ M03 DATA-M03-02, M01 DATA-M01-01, M02 DATA-M02-01 | Consumer modules declare fields that the owning entities do not define. | **M03** and **M01/M02**: add the fields (or mark them derived by M05/M19). |
| XL-24 | Minor | M06 ↔ M05 | M06 API #18/#19 `/api/structured-sets[/:id[/attempts]]` ↔ M05 API #15–17 `/api/practice/structured…` | The same endpoints appear under two paths. M05 notes the alias, but only one path should exist. | **M06** uses the M05 paths. |
| XL-25 | Minor | M02, M05, M06, TRACKER | M05 DATA intro, §6.12, FR-M05-* ("Matematik D1 Bab 1 = 1, D2 = 3 pending M03"); M03 v1.4 keeps them ↔ M05 SQ-3 "577" vs §6.12 "541", "M04's 505" vs M04 508 ↔ M06 §0 line 14 "M05 SRS not yet written", §13 Q2/Q7 ↔ M02 §13 cross-module (a) landing pages, (d) search limit, both already resolved in M01 ↔ TRACKER §0 "DATA-M02-01 still lists duta/seller/tuition_centre" (M02 now has the 8 codes) | Stale cross-references and numbers. | **Each owner**: refresh the references. **Delivery Lead**: update the TRACKER §0 note. |
| XL-26 | Minor | M01 ↔ M02, (M08) | M01 §6.8 id 5 `guru`: SK Demo (Johor) ↔ M02 §6.14 (id 5 owns classrooms "5 MARIKH" / DMO101 with Form-5 complimentary students); M08 draft guru at "SMK Demo" | A primary-school teacher owns Form-5 classes. | **M01**: give id 5 the secondary school used by M02/M08 (SMK Demo, Selangor). |
| XL-27 | Minor | M01, M02 ↔ M05 | M01 BR-05 and §6.8 (runtime users from 1000), M02 BR-14/15 (imports) ↔ M05 §6.12 (wallet, streak, trial and mastery seeded for 4 accounts only), API #1 | The dashboard state of a newly registered or imported user is not specified (wallet, streak, level, `trialQuestionsUsed`). The register → dashboard step depends on it. | **M05**: state the defaults for users without a seed row (coins 0, points 0, level 1, 0 %, streak 0, used 0), as the `pelajar2` empty-state seed shows. |
| XL-28 | Minor | M06 → M24 | M06 FR-M06-15 (Duta card link `/bilik-duta/{slug}`) ↔ TRACKER §4 M24 (`/bilik-duta`, `/bilik-duta/kem` only) | The target is covered by prefix only. | **Delivery Lead**: add `/bilik-duta/{slug}` to the M24 checklist. |

## 3. Seed coherence — checked and consistent

- **Admin SPM and practice figures.** M05 S9 (4 / 84 / 21.8 % / 26) = M06 S10 (4 / 21.8 % / 26 / 84). This is also the source of the M08 draft figures (26 coins, 4 sessions, 21.8 %).
- **Shared sessions.** A2 is SEJ 40·14 in both M05 and M06. P1–P4 match (M06 Q7 proposal adopted in M05).
- **Student 2.** Grade 10 and SMK Demo in M01; PKSK Kombo in M07; parent link to 6 in M02.
- **Canonical integer ids.** Used the same way in M02, M07 and M08 (draft). M07 grants take numeric ids that resolve to canonical accounts.
- **Id ranges do not collide.**
  - Users: 1–11 canonical; 5001–5999 M02; runtime ≥ 1000.
  - Questions: M04 anchors plus 400001–400480; M05 600001+; M08 700001+; PKSK 177698–178460.
  - Structured questions: 2505–4508 and 10001+.
  - Other records: reports 1–11, subscriptions 11–17, access rows 1–5, mocks 16 and 317–327.
- **Admin grade.** Darjah 4 in M01 / M03 / M05 and in M08 S7 ("level id 4"). The M08 S18 "Darjah 6" reads a separate, documented field (`profileLevelId`, M08 OQ-05), so it is a documented different definition, not a contradiction.
- **For M08's own audit (not graded here).** M08 draft §6.10 maps canonical accounts to 1001–1007. That duplicates canonical ids 2–8 and overlaps the runtime range from 1000. TRACKER already queues this for "M08 after its audit".

## 4. Entity and API consistency — checked and consistent

- Role codes: the same 8 codes in M01 BR-07 / DATA-M01-01, M02 BR-01 and M07 §6.8.
- Levels: D1–D6 / T1–T5 = M03 ids 1–11 = M01 `grade` 1–11 (M02 `classLevel` is derived from `grade`).
- Subjects: ids 1–31 and codes (M03 live data) are used unchanged by M04, M05, M06 and M08.
- Difficulty: the 1–5 scale is the same in M04, M05, M06 and M07. M06 buttons use keys 2–5, as live.
- `/api/schools/search`: default 20, no maximum, active schools only — identical in M01 #20 and M02 #38.
- `/api/subjects` and `/api/education-levels` (fields including `isCore`, `grade`): identical in M03 #28/#29 and M04 #32/#33, and consumed by M05.
- "Buka Soalan Sama" URLs (M04 BR-M04-17) match the M06 Q2 `question_id` + `count=1` form (FR-M06-87) and the M05 Q3 structured answer route. Their behaviour for non-pool questions is covered by XL-01.

## 5. End-to-end flows

| Flow | Step | Owning IDs | Status |
|---|---|---|---|
| **A. Register → login → dashboard → practice → results → history/progress → mastery** | 1 Register (student, grade, optional school) | M01 FR-M01-16…26, BR-05, API #2 | OK |
| | 2 Land on role page | M01 BR-07, FR-M01-12/25 → M05 S1 | OK (INFERRED landing) |
| | 3 Dashboard for a new user | M05 FR-M05-01…24, API #1 | Gap XL-27 |
| | 4 Choose subject / configure | M05 FR-M05-29…37, FR-M05-33 | OK |
| | 5 Start session (trial check) | M05 FR-M05-51, BR-07 | Gap XL-16 |
| | 6 Answer / check / report | M05 FR-M05-52, API #5, FR-M05-56/87–89 | Gap XL-09 |
| | 7 Submit, rewards, results | M05 FR-M05-54/55, FR-M05-82…85, BR-09 | Gap XL-04 (mastery counter) |
| | 8 History S9 (M05 + M06 sessions) | M05 FR-M05-104…108, BR-06 | Gap XL-03 |
| | 9 Progress S8 | M05 FR-M05-98…103 | OK |
| | 10 Mastery S12 | M05 FR-M05-112…114, BR-20 | Gap XL-04 |
| | 11 Topic progress / Peta Belajar | M03 DATA-M03-07, BR-14/15 | Gap XL-17 |
| **B. Admin creates question → appears in practice** | 1 Create (saved `approved`, active) | M04 FR-M04-17…23, BR-M04-09 | OK |
| | 2 Counts update | M04 BR-M04-20, FR-M04-110 | Gap XL-02 |
| | 3 Eligible in random drill (D1–D4, as live) | M05 BR-04, BR-11, FR-M05-51 | OK |
| | 4 Chapter mode | M05 BR-04 ↔ M04 DATA-M04-01 | Gap XL-08 (field undefined; not reachable, as live) |
| | 5 SPM practice (T4/T5) | M06 DATA-M06-02, BR-M06-02 | **Broken, XL-01** |
| **C. Student reports question → admin queue → question state change** | 1 Open modal from M05 / M06 | M05 FR-M05-87…89; M06 FR-M06-20, BR-M06-16; M04 FR-M04-65…69 | Gap XL-09 |
| | 2 Save `pending`, auto-deactivate | M04 FR-M04-70, BR-M04-11/12 | **Broken for SPM questions, XL-01** |
| | 3 Admin triage (fixed / dismissed + reactivate / force-deactivate) | M04 FR-M04-72…80, BR-M04-13/14 | OK for M04-store questions |
| | 4 Effect on practice | M05 BR-04, BR-14; M06 pool | Gaps XL-19, XL-01 |
| | 5 "Buka Soalan Sama" | M04 BR-M04-17 → M06 FR-M06-87 / M05 Q3 | Gap XL-01 |
| | 6 Reporter sees own report | M04 S13, API #17 | OK |
| **D. Admin grants PKSK → student level access** | 1 Grant by numeric user id / revoke | M07 FR-M07-49…53, BR-M07-14/15, API #16/#17 | OK (canonical ids) |
| | 2 Alternative: M02 flag | M02 FR-M02-40 → M07 BR-M07-07 (b) | OK |
| | 3 Access rule on hub, gate and endpoints | M07 FR-M07-05, FR-M07-19, FR-M07-54 | OK |
| | 4 Level pages load PKSK questions from the M04 store | M07 DATA-M07-02, FR-M07-60 ↔ M04 DATA-M04-01 | Gap XL-07 |
| **E. School subscription / quota → student import** | 1 Create subscription (tier, package, quota) | M02 FR-M02-84…86, BR-31 | OK |
| | 2 Pick school → quota check | M02 FR-M02-58…60, API #14 | OK |
| | 3 Import (refused without an active subscription or over quota) | M02 FR-M02-61…64, BR-15 | OK |
| | 4 `used` / S14 usage | M02 BR-24/25, FR-M02-88 | OK |
| | 5 Imported student logs in | M01 FR-M01-12, BR-07 (school ids: XL-06) | OK after XL-06 |
| | 6 Student's practice entitlement | M05 BR-07 ↔ M02 BR-22 | Gap XL-16 |

## 6. Critical and Major findings by owner

| Owner | Findings |
|---|---|
| M04 | XL-07, XL-08, XL-09, XL-11, XL-12 (and co-owner of XL-01, XL-02) |
| M05 | XL-05, XL-10, XL-16, XL-19 (and co-owner of XL-02, XL-04) |
| M06 | XL-01, XL-03, XL-04 |
| M02 | XL-06, XL-13 |
| M01 | XL-14, XL-15 (and co-owner of XL-02) |
| M03 | XL-17 (and co-owner of XL-02, XL-14) |
| Delivery Lead | XL-02 (definition decision), XL-18 |


---

# Round 2 — re-review after owner fixes

| Field | Value |
|---|---|
| Docs reviewed | M01 v1.7, M02 v1.4, M03 v1.6, M04 v1.4, M05 v1.3, M06 v1.3, M07 v1.3 (URS + SRS). Also read: TRACKER D11/D12 and the canonical seed table; CLAUDE.md §6; architecture overview §6.6–6.8 (ADR-0013/0014). M08 was read as a consumer only and is not graded. |
| Method | Docs only, no browser. A scratchpad script (`logic-review/r2_tables.js`) did the following: rebuilt M04 §6.13 Tables A/B/C (row, column and grand totals; M03 subject–level links; C ≤ A+B); checked the M06 §6.10 pool cells (T4+T5, difficulty sums, room inside the Table A T4/T5 cells); compared Table A with the M03 live per-subject/per-level counts and with the M05 observed S3/S4 figures. Then targeted reads of every round-1 fix. |
| Script results | Tables A/B/C are internally consistent: 0 arithmetic errors, links respected, grand totals 129,380 / 335,889 / 147,026, Table A matches M03 live subject and level counts exactly. The pool (Σ 21,033) fits every T4/T5 cell (0 room left in BI T5, MATH T4, SCI T4, SEJ T5, GEO T5, PHY T4/T5; SEJ T4 has exactly the 15 M08 anchors). **But** Table A D1–D4 contradicts the M05 observed S3/S4 totals (XL-30). |

## R2 verdict

**FAIL — 0 Critical, 6 Major, 8 Minor.** 24 of the 28 round-1 findings are closed. XL-02 stays open as a Major (M01 residual) and XL-22/24/25 stay open as Minors. The architecture adds one new Major, and the new dataset specs add four more. The new Majors are narrower than round 1: all of them are data-spec or wording fixes, and no store or flow has to be redesigned.

| Severity | Open from round 1 | New in round 2 | Total open |
|---|---|---|---|
| Critical | 0 | 0 | 0 |
| Major | 1 (XL-02) | 5 (XL-29…33) | **6** |
| Minor | 3 (XL-22, XL-24, XL-25) | 5 (XL-34…38) | **8** |

## R2.1 Round-1 findings — status

| ID | Status | Evidence (side A ↔ side B) |
|---|---|---|
| XL-01 | Closed | M04 BR-M04-03/32, FR-M04-113/114, §7.1 `spmPool`/`getEligible` ↔ M06 §6.2, FR-M06-87/89, E2E-M06-41 (now uses active 570024). The pool **definition** still conflicts internally → new XL-29. |
| XL-02 | **Open (M01 residual)** | M04 §4.1 and BR-M04-20: M01 login = Q-ELIGIBLE 128,989; M04 S1 "Jumlah" = Q-ALL 465,278; M17 live 130,152 = Q-ACTIVE + Q-PKSK (reconciled by M04/M05 v1.2, so no contradiction). ↔ M01 FR-M01-11, BR-21, §6.6, E2E-M01-01 and URS DV-05 still say the login count = "M04 dataset total" = "M04 S1 Jumlah" = "M17 Soalan Aktif". E2E-M01-01 asserts that M04 S1 "Jumlah" shows 128,989, which contradicts E2E-M04-05 / BR-M04-20 (465,278), and the M04 dataset total is 466,041. M03 FR-98, M05 BR-05 and M04 §4.1 are otherwise consistent: M03 S6/S9 = Q-ACTIVE; M05 cards = Q-ELIGIBLE; dashboard total = Q-ACTIVE + Q-PKSK = 130,152. |
| XL-03 | Closed | M05 DATA-M05-01 (one schema; `status in_progress\|completed`; field map) ↔ M06 §6.4 (a view with the same map; no `mode = spm`). |
| XL-04 | Closed | M05 BR-31 and FR-M05-55 (answer log, queue, mastery, trial, wallet) ↔ M06 §7 #8–#10 = M05 #4–#6. M06 §6.5 keeps mock exams outside the store, as live (OBSERVED: mock 16 is in no history). |
| XL-05 | Closed | M05 §6 intro and DATA-M05-01…11: `userId int`. |
| XL-06 | Closed | M02 §6 intro and DATA-M02-03 (`id int`, fixtures 900001–900099, runtime ≥ 10,301) ↔ M01 DATA-M01-06. |
| XL-07 | Closed | M04 DATA-M04-01 (`pkskDomainId`, `pkskTargetLevel`, `pkskOptions`, nullable fields), BR-M04-01/02 (`pending` "Menunggu"), BR-M04-33, FR-M04-116/117, §7 #4 ↔ M07 DATA-M07-02, BR-M07-02/21. |
| XL-08 | Closed | M04 DATA-M04-01 `curriculumChapterId` and the §6.13 facet ↔ M05 BR-04, §6.15. |
| XL-09 | Closed | M04 §2 S14 props `source`/`failureText`/`tints`, FR-M04-118, BR-M04-11 (includes `revision`) ↔ M05 §7.1 `report`. Residue: the DATA-M04-04 `source` note (XL-25). |
| XL-10 | Closed | M05 §7.1 `<PracticeQuiz>` / `<StructuredAnswer>` ↔ M06 FR-M06-87; M06 §13 Q2 closed. |
| XL-11 | Closed | M04 §6.11 and §6.13.3 (4,064 / 4,059; anchors include 3701, 3702, 3704–3706, 2505, 2510, 2511; "ids from 10001 do not exist") ↔ M06 §6.10 (same anchors; per-subject student counts match BI 773, BM 559, MATH 298, BIO 217; the pills add up to 4,064, checked). |
| XL-12 | Closed | M04 BR-M04-28 (`kbatLevel` 1–6, two live scales) ↔ M05 DATA-M05-10, M06 §6.9. |
| XL-13 | Closed | M02 §7 #43 `GET /api/schools?all=1` (AD, 10,220 schools including inactive) ↔ M04 §7 #31. |
| XL-14 | Closed | M01 §6.8 id 4 = grade 1, SK Demo ↔ M03 v1.5, TRACKER. The stale M05 note is listed in XL-25. |
| XL-15 | Closed | M01 §6.8 id 8 = SMK DEMO (900001) ↔ M02 §6.14. |
| XL-16 | Closed (as open question) | M05 BR-07 keeps the observed individual-subscription rule. It records the school-subscription and complimentary interaction as INFERRED, URS OQ-17 for M19/M02. This follows D7 and adds no UI. |
| XL-17 | Closed in the SRS | M03 BR-19 and DATA-M03-07 derive progress on read from the M05 answer log. **The architecture still says the opposite** (overview §6.7 "read-only mirror"; §6.8 "not written … read-only seeded mirror") → XL-33. |
| XL-18 | Closed | TRACKER §4 M25 lists `/pusat-nota-ringkas`. |
| XL-19 | Closed | M05 BR-14 (queued questions served only while eligible, M04 BR-M04-03) ↔ architecture §6.8. |
| XL-20 | Closed | Shell rule DV-SH-03/07 (`docs/design/shells.md`), cited by M01 DV-13, M03 DV-04, M04 FR-M04-107, M05 DV-01 and M06 FR-M06-10. |
| XL-21 | Closed | M02 v1.3 DV-M02-01 / FR-M02-07 without the sticky column. |
| XL-22 | **Open (Minor)** | M01 DV-16, M04 DV-M04-17 / FR-M04-120 and M06 DV-M06-17 now apply the 12 px rule ↔ M07 SRS v1.3 (unchanged) has no text-size statement or evidence. |
| XL-23 | Closed | M05 DATA-M05-07 (M05-owned `PracticeProfile`, `SubjectUsage`); M03 §6.7 note. |
| XL-24 | **Open (Minor)** | M04 §7.1 says "`/api/structured-sets` is not a valid path", and M06 §7 #18/#19 use the M05 paths ↔ the M05 §7 #15 response still says "(M06 `/api/structured-sets` = this endpoint)". |
| XL-25 | **Open (Minor)** | Stale references remain:<br>• M05 §6.12: "`pelajarmaju` grade 1 pending the M01 XL-14 fix, URS OQ-18".<br>• M02 §6.15: "M01 impact … must change" (done in M01 v1.7).<br>• M06 §6.10: cites "M05 A1 (2026-02-19)" (M05 has no A1; those are answers without a session) and "M05 SPM fixtures" as pool anchors (M05 §6.15 contributes none).<br>• M04 DATA-M04-04: the `source` note.<br>• TRACKER §0: "DATA-M02-01 still lists duta/seller/tuition_centre" (M02 has had the 8 codes since v1.3). |
| XL-26 | Closed | M01 §6.8 id 5 = SMK DEMO ↔ M02 §6.14. |
| XL-27 | Closed | M01 BR-24, E2E-M01-17 ↔ M05 BR-25. |
| XL-28 | Closed | TRACKER §4 M24 lists `/bilik-duta/{slug}`. |

## R2.2 Checks re-run

1. **Navigation.** There are no new route targets. XL-18 and XL-28 are resolved in TRACKER. Guest and non-admin guards are unchanged and consistent.
2. **Entities.**
   - Integer ids are used everywhere (users, schools, questions, subjects, levels, chapters).
   - There is one session schema.
   - Question status (including PKSK `pending`), KBAT 1–6 and difficulty 1–5 are aligned.
   - The open issues are in the dataset specs, not the schemas (XL-29…32).
3. **API contracts.**
   - Consistent: `/api/schools/search` (M01 #20 = M02 #38); `/api/schools?all=1` (M02 #43 = M04 #31); `/api/subjects` and `/api/education-levels`; M05 #4–#6 for all six modes; the `ReportQuestionModal` props; the `<PracticeQuiz>` and `<StructuredAnswer>` contracts; the M04 store functions (§7.1).
   - Remaining: M06 #11 vs M05 #23 (XL-35) and the M05 #15 note (XL-24).
4. **Counts (D11 named queries).**
   - One dataset reconciles the admin screens (Q-ALL / Q-APPROVED / Q-ARCHIVED), M03 (Q-ACTIVE), the M05 cards (Q-ELIGIBLE) and the M05 dashboard total (Q-ACTIVE + Q-PKSK = 130,152).
   - Still open: M01 (XL-02), the M05 S3/S4 D1–D4 figures (XL-30), the M05 S1 difficulty rows (XL-31), and figures with no named query (XL-36).
   - **M06 hub constants 20,529 / 14,673: judged acceptable (Minor XL-34).**
     - S1 has no visible contradiction: both chips are ≤ the total, and E2E-M06-03 asserts it.
     - The difference from the S2 sum (21,033) appears only across pages, and live has the same state.
     - DV-M06-01 records the alternatives. Setting the chips to 21,033 was rejected because it would create a same-screen contradiction (AUD-M06-17).
     - No named query reproduces the values.
     - Keeping them follows the "seeds mirror observation / minimal D9 fix" rule, but the D11 wording "every count is computed from the dataset" needs a named exception.
5. **Dataset specs.**
   - These fit:
     - Tables A/B/C and the M06 pool cells.
     - The M05 anchors 600001–600065 (their chapter caps sit inside BM D1 1,022 and MATH D1 2,734).
     - The M07 PKSK family: exactly 763 rows, the contiguous ids 177698–178460.
     - The M08 anchors 700001–700215 (CHEM T5 room 757 ≥ 36; SEJ T4 room exactly 15).
     - The structured pills (Σ 4,064 = the id range 393–4456).
   - These don't fit:
     - The users `admin` cell (XL-32).
     - Table A D1–D4 against M05 (XL-30).
     - Difficulty (XL-31).
     - The `spmPool` facet against its definition (XL-29).
6. **Session store.** M06 uses the M05 schema, field map, #4–#6 and BR-31. Mock exams stay M06 records. The only duplicate is the history read path (XL-35). The status enum and the handler text in architecture §6.8 disagree with the SRS (XL-33).
7. **Id policy.**
   - Canonical ids 1–11 are identical in TRACKER, M01, M02 and M07.
   - Users: generated ids 1–6,000, with the M02 fixtures 5001–5990 and M08 3001–3012 inside that range; runtime ids from 9,000,001 (M01 BR-24, M02 §6.15).
   - Schools: generated ids 1–10,300; fixtures 900001–900099; runtime ids from 10,301.
   - Questions: generated ids 1–564,161, excluding the PKSK block; coverage anchors 570001–570025; M05 600001–699999; M08 700001–700999.
   - There is no collision today. One is latent: runtime question ids use max + 1 with no floor (XL-37).
8. **Deviation coherence.** Titles follow DV-SH-03 everywhere. The 12 px rule applies everywhere except M07 (XL-22). The no-sticky-column rule is consistent.
9. **Logical soundness.**
   - XL-29: the pool size depends on which definition is used.
   - XL-30: the observed D1–D4 totals equal the M03 D1–D4 column sum (32,204). That forces every other subject to 0 at D1–D4, but Table A spreads them across those levels.
   - XL-32: the build fails.

## R2.3 Findings table (open)

| ID | Sev | Modules | Doc IDs (side A ↔ side B) | Problem | Recommended owner and fix |
|---|---|---|---|---|---|
| XL-02 | Major | M01 ↔ M04 | see R2.1 | The login count is "M04 dataset total = M04 S1 Jumlah = M17 Soalan Aktif", but these are three different named queries (128,989 / 465,278 / 130,152). | **M01**: `questionCount` = `namedCount('Q-ELIGIBLE')`. Remove "same as M04 S1 Jumlah / M17 Soalan Aktif" from FR-11, BR-21, §6.6 and E2E-01. Withdraw DV-05 or reword it per the M04 §4.1 reconciliation, as M05 v1.2 did. |
| XL-29 | Major | M04, M06 (M08) | M04 BR-M04-32, FR-M04-113, E2E-M04-60 ("`spmPool` count = eligible MATH T4/T5 MCQ count"), §7.1; M06 §6.2, BR-M06-02, FR-M06-89 ↔ M04 §6.13.1 facet `spmPool` ("INFERRED SPM scope attribute"; exact cells Σ 21,033; `false` elsewhere) and §6.13.2 (M05/M08 anchors `spmPool = false`) | The pool is defined two ways:<br>• **Rule definition (BR-M04-32: every eligible T4/T5 MCQ).** Table A gives MATH 976 + 836 = 1,812 (observed 1,681) and Bahasa Arab 439 + 469 = 908 (observed 0, which removes the live S3 lock "0/40"), so E2E-M04-60 and E2E-M06-03 cannot both pass.<br>• **Facet definition.** The `spmPool` value of a question created or imported on M04 S2/S5 is not specified, so FR-M06-89 / E2E-M06-03 ("create an approved Matematik T5 MCQ → S2/S3/S4 +1") are not guaranteed.<br>• Separately, M06 Tracking A sets draw from `query({educationLevelIds:[10,11]})`, not from the pool. | **M04**: make BR-M04-32, FR-M04-113, §7.1 and E2E-60 use the `spmPool` facet. Specify the value for rows created or imported and approved at T4/T5: `true` keeps M06 FR-89 (INFERRED; record as OQ). **M06**: §6.2 and BR-M06-02 cite the facet; Tracking A draws via `spmPool`. |
| XL-30 | Major | M04 ↔ M05 | M04 §6.13.1 Table A (pins only Matematik D1 2,734 and D1–D4 6,538; the rest PROPOSED proportional) ↔ M05 URS AC S4 "soalan chapter" (BM 4,833, BI 3,521, MATH 6,538, SCI 4,903, SEJ 1,931, PI 3,371, PM 3,307, GEO 800, BA 1,700, JAWI 1,300); EL-M05-S3-052…056 (BM "Semua Tahap 4,833", D1 958, D2 2,540, D3 805, D4 530); EL-M05-S3-085 (SK "D4 0"); M05 BR-05 (S3 = eligible D1–D4; Σ chapter counts = S3 total); M05 §6.15 "BM D2 2,540" vs M04 §6.13.2 "BM D2 987" | Table A's D1–D4 totals differ from the observed ones:<br>• BM 3,021 (observed 4,833)<br>• BI 2,064 (3,521)<br>• SCI 3,096 (4,903)<br>• SEJ 1,540 (1,931)<br>• PI 2,368 (3,371)<br>• BA 1,396 (1,700)<br>• PM 3,986 (3,307)<br>• GEO 1,422 (800)<br>• JAWI 1,624 (1,300)<br>• SK D4 55 (0)<br>The ten observed D1–D4 totals add up to **32,204**, which equals the M03 D1–D4 level total (11,396 + 10,245 + 5,776 + 4,787). So every other subject (PSV, MUZ, PJK, RBT, SK, BT) must be 0 at D1–D4, and MUZ's 1,800 must sit in D5–D6. The M04 feasibility check covers only the Matematik "M05 S3 pins", so M05 FR-M05-128 ("every live figure reproduced") fails for 9 subjects. | **M04**: pin every observed M05 S3/S4 cell (the ten D1–D4 totals, the BM per-level values, SK D4 = 0, all other D1–D4 cells 0) and re-run `fit2d` against the M03 marginals. **M05**: confirm that the chapter totals of each subject add up to these values. |
| XL-31 | Major | M04 ↔ M05, M07 | M04 §6.13.1 layer 3 `difficultyLevel` ("every other cell split 1:2:3:4:5 … 2–5 share the rest evenly", PROPOSED; only Q-ALL difficulty 1 = 45,686 observed) ↔ M05 URS EL-M05-S1-253…278 and AC-M05-10.3 (S1 "Tahap Kesukaran" 39,694 / 47,138 / 33,720 / 9,600 / **0**, total 130,152 = Q-ACTIVE + Q-PKSK); M05 §6.15 and M06 §6.10 ("difficulty 5 = 0, as live") ↔ M07 §6.8 (PKSK "difficulty 1–5 seed-assigned") | The observed per-difficulty distribution is not modelled as a facet, although architecture §6.6 requires it ("a number observed on live must be modelled as a facet"). The PROPOSED spread puts difficulty-5 rows among active questions, and PKSK rows may carry difficulty 5, so S1 "Sangat Sukar" and the S3 difficulty-5 buttons would not be 0. BR-05 and M04 §4.1 name no query for these rows. | **M04**: add the observed active + PKSK difficulty marginals (39,694 / 47,138 / 33,720 / 9,600 / 0) as an `exact` constraint on the active cells, and name the query (e.g. Q-ACTIVE+PKSK by difficulty). **M07**: seed PKSK difficulties within 1–4 (the live anchors 2 and 3 are unaffected). |
| XL-32 | Major | M02 (M01) | M02 §6.15 B, facet `role`: admin **2** (observed S1 card) ↔ M02 §6.14 anchors: canonical 1 (admin) + fixture admins 5801–5802 = **3** admin anchors | A cell with more anchors than its count fails the build (M04 §6.13.2 rule; architecture §6.6 step 4), so the users dataset cannot compile. | **M02**: keep at most one fixture admin (e.g. 5801) so that admins = 2 (canonical 1 plus one). The other role cells fit: teacher 30 ≤ 551, parent 12 ≤ 38, sponsor 3 ≤ 6, school_admin 6 ≤ 16, ppd 4 ≤ 5, jpn 2 = 2. |
| XL-33 | Major | Architecture ↔ M03, M05, M06 | Overview §6.8: "session → submitted"; an abandoned session "keeps status `active`"; M06 session calls go through "thin handlers" at `/api/spm/sessions…`. §6.7/§6.8: M03 topic progress is a "read-only mirror … not written". §6.6: questions `idRange` max 580,000, and "128,989 on login vs 130,152 in admin" given as a live contradiction. ↔ M05 DATA-M05-01 `status in_progress\|completed`; M06 §7 #8–#10 = M05 paths (no `/api/spm/sessions`); M03 BR-19 / DATA-M03-07 (derived on read from the M05 answer log); M04 §6.13.1 id range 1–564,161; M04 §4.1 / M05 v1.2 (128,989 vs 130,152 reconciled; DV-05 withdrawn in M05) | The build input contradicts the approved SRS on four points: the session status enum, the M06 session endpoints, whether Peta Belajar progress changes after practice, and the question id range. | **solution-architect**: align overview §6.6–6.8 with M05 v1.3, M06 v1.3, M03 v1.6 and M04 v1.4. |
| XL-22 | Minor | M07 | see R2.1 | The 12 px rule has no evidence for M07. | **M07**: confirm that no content text is < 12 px, or add the DV. |
| XL-24 | Minor | M05 | see R2.1 | Stale alias note. | **M05**: delete the note in #15. |
| XL-25 | Minor | M02, M04, M05, M06, TRACKER | see R2.1 | Stale cross-references. | Each owner fixes its own; the Delivery Lead fixes TRACKER §0. |
| XL-34 | Minor | M06 ↔ D11 | M06 BR-M06-01, FR-M06-06, DV-M06-01 ↔ TRACKER D11 / CLAUDE.md §6 ("every count is computed from the dataset") | The hub constants are acceptable: there is no same-screen contradiction, and the live cross-page difference is documented with alternatives. But D11 has no exception clause. | **Delivery Lead**: add to D11 that observed constants no named query reproduces (the M06 hub 20,529 / 14,673) are allowed when the owner's DV lists the alternatives. |
| XL-35 | Minor | M06 ↔ M05 | M06 §7 #11 `/api/spm/history` (an M06-owned "projection") ↔ M05 §7 #23 and SQ-8 ("M06 #11 is served by this endpoint") | Two contracts for one list, and M06 never mentions #23. | **M06**: state that #11 is served by M05 #23 (`modes=past_year,latih_tubi,ramalan`), or drop #11 as an HTTP path. |
| XL-36 | Minor | M03, M05, M04 | M03 FR-M03-98 ("number of questions per subject/level"); M05 BR-05 ("all the subject's objective questions", "approved incl. PKSK") ↔ M04 §4.1 (Q-ACTIVE, Q-ELIGIBLE, Q-ACTIVE + Q-PKSK) | The wording does not cite the named queries: "all" means active and "approved" means eligible. M04 §4.1 also has no names for the M05 S1 difficulty rows (XL-31), the S3/S4 D1–D4 counts (XL-30) or the M06 S2–S4 pool counts. | **M03, M05**: cite the query names. **M04**: add the missing names to §4.1. |
| XL-37 | Minor | M04, M07 (architecture) | M04 DATA-M04-01 "new ids = max + 1", M07 BR-M07-24, overview §6.6 `maxPlusOne` ↔ M04 §6.13.1 reserved anchor ranges 600001–699999 (M05) and 700001–700999 (M08) | The first runtime question id would be 700,216, inside the M08 reserved range. A later M08 anchor at 700,216 or above would collide with persisted runtime rows. | **M04**: give runtime question ids a floor above every reserved range, as users (9,000,001) and schools (10,301) already have. |
| XL-38 | Minor | M01 ↔ M02 | M01 §6.8 "Schools: at least 25 fictitious schools … ≥ 10 states" ↔ M02 §6.14/§6.15 (the school register is the 10,220-row D11 dataset; the only fixtures are 900001/900002) | A leftover school fixture in a module that does not own schools. | **M01**: replace the line with a reference to the M02 dataset (the profile limit of 20 is exercised by M02's ≥ 25 Selangor schools). |

## R2.4 Contracts M01–M07 must offer M08 (M08 not graded)

| M08 need (draft) | Offered by | Gap to fix in M08 or its provider |
|---|---|---|
| Designed users (draft: pelajar 1001 … adminsekolah 1007; students 3001–3012) | M01/M02 users id policy | The canonical accounts must keep ids 2–8, not 1001–1007. Ids 3001–3012 fit inside the generated range 1–6,000 as student anchors (the student cell has ample room). |
| Question anchors 700001–700215 (Kimia T5 × 36, Sejarah T4 × 15) with `dskpSpId` 9001–9004 | M04 §6.13.2 (the cells fit) | Whether they are in the SPM pool depends on XL-29: BR-M04-32 would include them, the facet says no. |
| `dskpSpId` 9101–9108 on the M05 MATH D1 practice anchors | M05 §6.15 does not list `dskpSpId`; M04 §6.13.2 says "M05 and M08 fixtures also carry `dskpSpId`" | M05 must declare the values on 600036–600065, or M08 drops the claim. |
| Answer log and sessions by mode (S6 "no practice-mode session"; S20 all-time coins / sessions / accuracy) | M05 practice repository (`practice.answers`, #12, #23) | Offered. For "practice-mode" figures, M08 must read `mode` ∈ `random\|chapter\|revision`. |
| Admin school for S9 | M01 §6.8 / M02 900002 "SK Demo" | Offered. |
| Wallet, streak, `profileLevelId` | M14 (provisional in M05); `profileLevelId` is an M08-owned field | `profileLevelId` stays M08-owned. The Darjah 6 chip vs the account grade Darjah 4 is documented. |

## R2.5 End-to-end flows (re-run)

| Flow | Step | Owning IDs | Status |
|---|---|---|---|
| **A. Register → login → dashboard → practice → results → history/progress → mastery** | 1 Register (id ≥ 9,000,001) | M01 FR-M01-24/25, BR-05, BR-24; M02 §6.15; E2E-M01-17 | OK |
| | 2 Landing | M01 BR-07, FR-M01-12 → M05 S1 | OK (landing page INFERRED) |
| | 3 Dashboard (new-user defaults; counts) | M05 FR-M05-01…27, BR-05, BR-25 | Defaults OK; difficulty rows XL-31 |
| | 4 Choose subject / configure (S2/S3) | M05 FR-M05-29…37, FR-M05-128 | S3 counts XL-30 |
| | 5 Start session (trial) | M05 FR-M05-51, BR-07 (OQ-17), §7 #4 | OK |
| | 6 Check answer / report | M05 §7 #5, §7.1 `report`, FR-M05-87…89 → M04 FR-M04-118 | OK |
| | 7 Complete | M05 FR-M05-55, BR-31, §7 #6 | OK |
| | 8 History S9 | M05 FR-M05-104…108, #12 | OK |
| | 9 Progress S8 | M05 FR-M05-98…103 | OK |
| | 10 Mastery S12 | M05 FR-M05-112…114, BR-20 (via BR-31) | OK |
| | 11 Topic progress / Peta Belajar | M03 BR-14, BR-19, FR-M03-89 | OK in the SRS; architecture conflict XL-33 |
| **B. Admin creates question → appears in practice** | 1 Create (approved, active) | M04 FR-M04-23, BR-M04-09, BR-M04-34 (overlay) | OK (runtime id policy XL-37) |
| | 2 Counts update | M04 BR-M04-20, §4.1 | OK |
| | 3 M05 random drill (D1–D4, as live) | M05 BR-04, BR-11, FR-M05-51 | OK |
| | 4 Chapter mode | M04 `curriculumChapterId` is null for questions created on S2 (as live) | OK (not reachable, as live) |
| | 5 SPM pool (T4/T5) | M04 FR-M04-113 ↔ `spmPool` facet; M06 FR-M06-89 | **Gap XL-29** |
| **C. Report → admin queue → question state change** | 1 Report modal from M05 / M06 | M05 §7.1, FR-M05-87…89; M06 FR-M06-20, §7 #20; M04 FR-M04-118 | OK |
| | 2 Save + auto-deactivate | M04 FR-M04-70, BR-M04-11/12; architecture `questions.deactivate` | OK (SPM questions are now store rows) |
| | 3 Admin triage | M04 FR-M04-72…80, BR-M04-13/14 | OK |
| | 4 Effect on practice | M04 BR-M04-03, FR-M04-114; M05 BR-04, BR-14; M06 FR-M06-89, `getEligible` | OK |
| | 5 "Buka Soalan Sama" | M04 BR-M04-17 → M06 FR-M06-87 (non-pool → 422 → S4); structured → M05 `<StructuredAnswer>` | OK (fallback documented) |
| | 6 Reporter's own list | M04 S13, §7 #17 | OK |
| **D. Admin grants PKSK → level access** | 1 Grant / revoke by integer user id | M07 FR-M07-49…53, BR-M07-14/15, §7 #16/#17 | OK |
| | 2 M02 flag | M02 FR-M02-40 → M07 BR-M07-07 (b) | OK |
| | 3 Access checks | M07 FR-M07-05/19/54 | OK |
| | 4 PKSK questions from the M04 store | M04 BR-M04-33, FR-M04-116/117, §7.1 `pksk.*`; M07 FR-M07-60 | OK (difficulty seed XL-31) |
| **E. School subscription / quota → student import** | 1 Create subscription | M02 FR-M02-84…86, BR-31 | OK |
| | 2 Quota check | M02 FR-M02-58…60, #14 | OK |
| | 3 Import (ids ≥ 9,000,001) | M02 FR-M02-61…64, BR-15, §6.15 | OK |
| | 4 Quota usage | M02 BR-24/25, FR-M02-88 | OK |
| | 5 Imported student logs in | M01 FR-M01-12, BR-07 | OK |
| | 6 Entitlement in practice | M05 BR-07 (observed rule; OQ-17 to M19) | OK, as a documented open question |

## R2.6 Open Major findings by owner

| Owner | Findings |
|---|---|
| M04 | XL-29 (with M06), XL-30 (with M05), XL-31 (with M07) |
| M01 | XL-02 |
| M02 | XL-32 |
| solution-architect | XL-33 |


---

# Round 3 — re-review after round-2 fixes

| Field | Value |
|---|---|
| Docs reviewed | M01 v1.8, M02 v1.6, M03 v1.6, M04 v1.5, M05 v1.4, M06 v1.4, M07 v1.5, architecture overview / build-plan v1.1, TRACKER D11 (display-constant exception), CLAUDE.md §6. M08/M09 were read only as anchor contributors. |
| Scripts (scratchpad `logic-review/`) | `r3_tables.js`: M04 Tables A/B/C (row, column and grand totals; M03 links; C ≤ A+B; room for the M06 pool in each T4/T5 cell). `r3_m05.js`: Table A D1–D4 compared cell by cell with the live M05 `_practice-data.json` `config_levels`, plus the `difficultyByLevel` totals. The M06 pool difficulty sums. `routes.js`: navigation re-scan. Manual checks: the Q-DIFFICULTY arithmetic, the anchor-per-cell checks (questions and users), and the id floors. |
| Script results | Tables A/B/C: **0 errors** (grand totals 129,380 / 335,889 / 147,026; pinned zeros are written "–"). All 40 Table A D1–D4 cells equal live M05 (Σ 32,204). The difficulty totals of the D1–D4 cells = 10,128 / 11,646 / 8,852 / 1,578. The pool by difficulty = 2,289 / 9,450 / 6,728 / 2,566 (Σ 21,033). Q-DIFFICULTY checks out: 10,128 + 2,289 + 190 + 27,087 = 39,694, and likewise 47,138 / 33,720 / 9,600 / 0; the remainder 76,152 = 129,389 − 32,204 − 21,033. Inactive difficulty 1 = 6,182 = 45,686 − (39,694 − 190). The pool fits every T4/T5 cell. Navigation: no undocumented targets. |

## R3 verdict

**FAIL — 0 Critical, 2 Major, 2 Minor.** All six round-2 Majors (XL-02, XL-29…33) are closed. Two new Majors turned up:
- **XL-39:** two M04 coverage anchors no longer fit their cells after the D1–D4 pins, so the build fails.
- **XL-40:** M05 BR-05 still defines the dashboard difficulty rows and the S3 counts differently from the new M04 named queries.

Both need only small, local fixes.

| Severity | Open from round 2 | New in round 3 | Total open |
|---|---|---|---|
| Critical | 0 | 0 | 0 |
| Major | 0 | 2 (XL-39, XL-40) | **2** |
| Minor | 2 (XL-36 M03 part, XL-37 M07 part) | 0 | **2** |

## R3.1 Round-2 open items — status

| ID | Status | Evidence (side A ↔ side B) |
|---|---|---|
| XL-02 | Closed | M01 FR-M01-11, BR-21, §6.6 `questionCount`, E2E-M01-01, URS DV-05: `namedCount('Q-ELIGIBLE')` = 128,989. Other figures are other queries (Q-ALL, Q-ACTIVE + Q-PKSK). ↔ M04 §4.1 Q-ELIGIBLE "M01 login stat". |
| XL-22 | Closed | M07 v1.4 DV-M07-13, FR-M07-62, E2E-M07-44 (≥ 12 px inside `main`) ↔ M01 DV-16, M04 FR-M04-120, M06 DV-M06-17, M03 DV-06, M05 DV-11. |
| XL-24 | Closed | M05 v1.4 §7 #15 alias note removed ↔ M04 §7.1 "`/api/structured-sets` is not a valid path"; M06 #18/#19 use the M05 paths. |
| XL-25 | Closed | M05 §6.12 grade note removed; M02 §6.15 "M01 alignment: done in M01 v1.7"; M06 v1.4 drops "M05 A1" and "M05 SPM fixtures"; M04 DATA-M04-04 `source` note corrected; the TRACKER §0 "still lists duta…" line is gone. |
| XL-29 | Closed | M04 BR-M04-32 / Q-SPM-POOL (facet `spmPool = true`, default cells = M06 §6.10, Σ 21,033, MATH 1,681, BA 0; runtime T4/T5 rows of the 19 pool subjects get `true`, BR-M04-09/10) ↔ M06 §6.2, BR-M06-02, FR-M06-89; Tracking A draws via `spmPool` (§6.10). |
| XL-30 | Closed | M04 §6.13.1 Table A pins every D1–D4 cell. The script confirms that all 40 practice-subject cells equal live M05 `config_levels`, every other subject is 0 at D1–D4, and Q-PRACTICE is added to §4.1. ↔ M05 URS S3/S4 figures; M05 §6.15 "BM D2 2,540" = M04 §6.13.2. |
| XL-31 | Closed (M04/M07) | M04 Q-DIFFICULTY (39,694 / 47,138 / 33,720 / 9,600 / 0), modelled exactly; arithmetic verified. M07 v1.5 PKSK split 190/191/191/191, with the observed anchors (2, 3) kept. The M05 wording of BR-05 still uses the old definition → **XL-40**. |
| XL-32 | Closed | M02 v1.5/1.6 §6.15 B: admin cell 2 = anchors 1 + 5801 (5802 removed). Per-role anchor check verified: student 321 = 4 + 210 + 90 + 12 + 5 ≤ 4,533; teacher 31 ≤ 551; parent 12 ≤ 38; sponsor 3 ≤ 6; school_admin 9 ≤ 16; ppd 4 ≤ 5; jpn 2 = 2; complimentary 90 = 90. The M09 anchors 3101–3109 don't overlap M08 3001–3012 or M02 5001–5990. |
| XL-33 | Closed | Architecture overview v1.1: status `in_progress \| completed` (§6.7, §6.8); M06 through M05 #4–#6 and #23; topic progress "derived on read" (§6.7); `idRange` max 564,161; 128,989 vs 130,152 explained as named queries (§6.6); runtime id strategy `floor` above the reserved ranges. build-plan v1.1 matches. |
| XL-34 | Closed | TRACKER D11 and architecture C11 / §6.6 "documented display constants" ↔ M06 v1.4 BR-M06-01, DV-M06-01 (hub 20,529 / 14,673; chips ≤ total, E2E-M06-03). |
| XL-35 | Closed | M06 v1.4 FR-M06-64, §7 #11 = M05 #23 `?modes=past_year,latih_tubi,ramalan&type=` (owned by M05), §13 Q8 closed ↔ M05 §7 #23 (meta `activeType`, `stats{sessions, avgAccuracyPct, coins, answered}`). |
| XL-36 | **Open (Minor, M03 part)** | M05 BR-05 and FR-M05-128 now cite the §4.1 names; M04 adds Q-PRACTICE, Q-DIFFICULTY, Q-SPM-POOL and Q-STRUCT-*. ↔ M03 FR-M03-98 is unchanged: "the number of questions per subject / per level", with no Q-ACTIVE(subject/level) named, although the example values are Q-ACTIVE. |
| XL-37 | **Open (Minor, M07 part)** | M04 §6.13.1 runtime range ≥ 9,000,001 (BR-M04-09/10); architecture `floor` strategy. ↔ M07 BR-M07-24 still says "new PKSK questions take the next id of the shared M04 sequence (max id + 1)". |
| XL-38 | Closed | M01 §6.8 "Schools: M01 seeds none" → M02 dataset (900001/900002). |

## R3.2 Checks re-run

1. **M04 dataset fit.** Tables A/B/C are consistent, and the D1–D4 pins equal live. Q-DIFFICULTY and Q-SPM-POOL are exact and verified (see Script results). Q-ALL(subject) = A + B (e.g. BM 32,896 + 9 null-level = 32,905).
2. **Contributed anchors.**
   - Fit:
     - M05 600001–600065: BM D1 cell 958 = chapters 320 + 317 + 321; MATH D1 2,734; anchor difficulties fit the live D1 per-difficulty counts.
     - M07 177698–178460: exactly 763; difficulties 190/191/191/191; the observed anchor difficulties 2/3 are inside.
     - M08 700001–700215: CHEM T5 non-pool room 758 ≥ 36; SEJ T4 room exactly 15.
     - The pool anchors (564157–564161, 561050, 563393, 570021–570024) are pool rows of their cells.
   - **Don't fit: M04's own coverage anchors 570025 (Bahasa Tamil D2) and 570006 (Sains T4, non-pool) → XL-39.**
3. **Users cells.** Canonical 1–11, M02 5001–5990, M08 3001–3012 and M09 3101–3109 all fit (XL-32 above).
4. **Schools anchors.** 900001 "SMK DEMO" (accounts 2, 5, 8), 900002 "SK Demo" (1, 4) and 900003 "SMK Demo Seri Putra" (M09) are in the reserved range 900001–900099. Each replaces one generated row of its own type/state cell, so totals stay 10,220 / 10,212 / SMK 2,441. M01 references 900001/900002.
5. **Id floors.**
   - Users: runtime from 9,000,001 (M01 BR-24, M02 §6.15).
   - Questions: runtime from 9,000,001 (M04 §6.13.1, BR-M04-09/10; architecture `floor`), except that M07 BR-M07-24 still says max + 1 (XL-37).
   - Schools: runtime from 10,301.
   - Other M02 small tables: runtime from 1000 (no live range, so no collision).
   - No id collision between any ranges.
6. **Navigation.** The re-scan finds only documented non-routes: live POST targets, 404s documented as live, `/latih-tubi` fixed by DV-02, and API fragments. `/pusat-nota-ringkas` and `/bilik-duta/{slug}` are in the TRACKER.
7. **Entities and API.**
   - One session schema; integer ids; KBAT 1–6; PKSK `pending`.
   - Shared paths match: `/api/schools/search`, `/api/schools?all=1`, `/api/subjects`, `/api/education-levels`, the report modal props, `<PracticeQuiz>` / `<StructuredAnswer>`.
   - M06 S10 → M05 #23 matches (fields `activeType`, `stats`, filter-independent stats).
8. **Counts map.**
   - Every M01/M03/M04/M05/M06 figure is a §4.1 named query, a small-table count (M03 stores, M05 per-user tables) or a documented display constant (M06 hub).
   - Two definitions still disagree with the query they should use: M05 BR-05 on the S1 difficulty rows and S3 (XL-40), and the M03 FR-98 wording (XL-36).
9. **Architecture v1.1 vs SRS.** Consistent on the points above; no new drift found.

## R3.3 Findings table (open)

| ID | Sev | Modules | Doc IDs (side A ↔ side B) | Problem | Recommended owner and fix |
|---|---|---|---|---|---|
| XL-39 | Major | M04 | M04 §6.11 coverage anchors "570025 Bahasa Tamil D2 … All approved and active" and "570006 Sains T4 … no source file" (non-pool: not in the §6.13.2 pool-anchor list 570021–570024), §6.13.2 "M04 coverage anchors … ≥ 1 each" ↔ M04 §6.13.1 Table A: Bahasa Tamil D2 = 0 (pinned, live M05 BT D1–D4 = 0), Sains T4 = 1,172 = the M06 pool T4 (all `spmPool = true`, script room 0 for non-pool rows) | Each anchor must claim a slot in its own cell, and "a cell with more anchors than its count fails the build". The approved-active BT D2 cell has 0 slots, and the non-pool SCI T4 cell has 0 slots, so the `questions` dataset cannot compile. (The original purpose of 570025, making the BT tile non-zero, is moot: BT has 25,800.) | **M04**: move 570025 to a Bahasa Tamil cell with room (e.g. T1, D5) or make it inactive (Table B). Either mark 570006 `spmPool = true` (a pool anchor, like 570021–570024) or move it to a Sains cell with room (e.g. T1). Re-run the anchor-per-cell check for all M04 anchors, including the six master-note anchors 129732 … 559916, whose subject/level cells aren't stated. |
| XL-40 | Major | M05 ↔ M04 | M05 BR-05 "S1 difficulty row = active objective questions of that difficulty (no M04 named query yet)"; "S3 … = Q-ELIGIBLE filtered … (no M04 named query yet)"; FR-M05-128 "S3/S4/S5 … no named query yet" ↔ M04 §4.1 **Q-DIFFICULTY(d) = (Q-ACTIVE ∪ Q-PKSK) by difficulty** (Σ 130,152) and **Q-PRACTICE(subject, level)** | M05 defines the S1 "Tahap Kesukaran" rows without the 763 PKSK rows, so the rows would add up to 129,389, not the observed footer 130,152 (M05 AC-M05-10.3, EL-M05-S1-278). For example, "Sangat Mudah" would be 39,504 instead of 39,694. M04 includes PKSK. The same M05 text says named queries are missing, but M04 v1.5 now provides them. | **M05**: BR-05 and FR-M05-128 cite Q-DIFFICULTY (including PKSK) for the S1 rows and Q-PRACTICE for S3/S4 (and S5 per chapter), and drop "no named query yet". |
| XL-36 | Minor | M03 ↔ M04 | M03 FR-M03-98 ↔ M04 §4.1 Q-ACTIVE(subject), Q-ACTIVE(level) | The wording does not name the query; the values already match. | **M03**: cite Q-ACTIVE(subject) / Q-ACTIVE(level). |
| XL-37 | Minor | M07 ↔ M04 | M07 BR-M07-24 "max id + 1" ↔ M04 §6.13.1 runtime floor 9,000,001, architecture `floor` | M07 still states the old id rule for new PKSK rows. | **M07**: new PKSK question ids follow the M04 runtime range (≥ 9,000,001). |

## R3.4 End-to-end flows (re-run)

| Flow | Step | Owning IDs | Status |
|---|---|---|---|
| **A. Register → login → dashboard → practice → results → history/progress → mastery** | 1 Register (id ≥ 9,000,001) | M01 FR-M01-24/25, BR-05, BR-24; M02 §6.15; E2E-M01-17 | OK |
| | 2 Landing | M01 BR-07, FR-M01-12 → M05 S1 | OK (landing page INFERRED) |
| | 3 Dashboard counts and defaults | M05 FR-M05-01…27, BR-05, BR-25, FR-M05-128; M04 §4.1 | Difficulty rows **XL-40** |
| | 4 Subject / configure (S2/S3/S4) | M05 FR-M05-29…37; M04 Q-PRACTICE (Table A pins) | OK in the data; wording XL-40 |
| | 5 Start / check / report | M05 §7 #4/#5, §7.1, FR-M05-51, FR-M05-87…89; M04 FR-M04-118 | OK |
| | 6 Complete | M05 FR-M05-55, BR-31, #6; architecture §6.8 (`in_progress → completed`) | OK |
| | 7 History / progress / mastery | M05 FR-M05-104…108, FR-M05-98…103, FR-M05-112…114, BR-20 | OK |
| | 8 Topic progress | M03 BR-19, FR-M03-89; architecture §6.7 "derived on read" | OK |
| **B. Admin creates question → appears in practice** | 1 Create (approved, active, id ≥ 9,000,001, `spmPool` at T4/T5) | M04 FR-M04-23, BR-M04-09, BR-M04-34 | OK |
| | 2 Counts | M04 BR-M04-20, §4.1 | OK |
| | 3 M05 drill (D1–D4) | M05 BR-04, BR-11, FR-M05-51 | OK |
| | 4 SPM pool (T4/T5) | M04 BR-M04-32 (Q-SPM-POOL) → M06 BR-M06-02, FR-M06-89 | OK |
| | 5 Dataset compiles | M04 §6.13 anchors | **XL-39** |
| **C. Report → admin queue → state change** | 1 Report modal (M05 / M06 hosts) | M05 §7.1, FR-M05-87…89; M06 FR-M06-20; M04 FR-M04-118 | OK |
| | 2 Save + auto-deactivate | M04 FR-M04-70, BR-M04-11/12 | OK |
| | 3 Admin triage | M04 FR-M04-72…80, BR-M04-13/14 | OK |
| | 4 Effect on M05 / M06 | M04 BR-M04-03, FR-M04-114; M05 BR-04, BR-14; M06 FR-M06-89 | OK |
| | 5 "Buka Soalan Sama" | M04 BR-M04-17 → M06 FR-M06-87 / M05 `<StructuredAnswer>` | OK |
| **D. Admin grants PKSK → level access** | 1 Grant / revoke by integer user id | M07 FR-M07-49…53, BR-M07-14/15 | OK |
| | 2 Access rule (grant / M02 flag / admin) | M07 BR-M07-07, FR-M07-54; M02 FR-M02-40 | OK |
| | 3 PKSK rows in the M04 store | M04 BR-M04-33, FR-M04-116/117; M07 FR-M07-60, §6.8 (190/191/191/191) | OK (new-id wording XL-37) |
| **E. School subscription / quota → student import** | 1 Subscription → quota check → import | M02 FR-M02-84…86, FR-M02-58…64, BR-15, BR-31 | OK |
| | 2 Imported ids / login | M02 §6.15 (≥ 9,000,001); M01 FR-M01-12 | OK |
| | 3 Practice entitlement | M05 BR-07 (observed rule; OQ-17 to M19) | OK, as a documented open question |

## R3.5 Open Major findings by owner

| Owner | Findings |
|---|---|
| M04 | XL-39 |
| M05 | XL-40 |


---

# Round 4 — targeted re-check of the round-3 open items

| Field | Value |
|---|---|
| Docs | M03 v1.7, M04 v1.6, M05 v1.5, M07 v1.6. Unchanged: M01 v1.8, M02 v1.6, M06 v1.4, architecture v1.1. |
| Scripts (scratchpad `logic-review/`) | `r4_tables.js`: Tables A/B/C of M04 v1.6 (totals, links, C ≤ A+B, pool room). `r4_m05.js`: D1–D4 pins against the live M05 `_practice-data.json`. Every row of the new §6.13.1 anchor-cell table was checked by hand against the Table A/B cells and the M06 pool cells (§6.10), by level and difficulty. Grep for references to the moved anchors and for id-floor regressions. |

## R4 verdict

**PASS — 0 Critical, 0 Major, 0 Minor open.** All four round-3 items are closed and no regression was found. The M01–M07 batch meets the XL gate.

## R4.1 Dataset fit and anchor cells

- **Tables.** Tables A/B/C: 0 errors. Grand totals are unchanged at 129,380 / 335,889 / 147,026. The pool (Σ 21,033) fits every T4/T5 cell. All 40 D1–D4 pins equal live (Σ 32,204). The D1–D4 difficulty totals are 10,128 / 11,646 / 8,852 / 1,578, so Q-DIFFICULTY still gives 39,694 / 47,138 / 33,720 / 9,600 / 0.
- **Pool anchors.** Checked against the M06 pool cells (level × difficulty); all fit:
  - Sains T5: difficulty 3 has room 293 for 3 anchors; difficulty 4 has 86 for 1; difficulty 2 has 498 for 2.
  - Biologi T5 difficulty 2: 531.
  - Pendidikan Moral T5 difficulty 2: 402 for 2 anchors.
  - Bahasa Inggeris T5 difficulty 2: 313 for 3 anchors.
  - Fizik T5: difficulty 2 has 268; difficulty 3 has 332.
  - Matematik T4: difficulty 2 has 309 for 2 anchors; difficulty 3 has 410 for 570024.
  - Kimia T4 difficulty 2: 442.
- **Non-pool and inactive anchors.** All fit:
  - Matematik T5 inactive: 2,562 for 3 anchors.
  - Sejarah T5 inactive: 1,446.
  - Biologi T4 non-pool: 969.
  - Sejarah D6: 170.
  - **Sains T1: 1,845 for 570006.**
  - Bahasa Arab T3: 723.
  - **Bahasa Tamil T1: 1,735 for 570025.**
- **Contributed anchors.** All fit:
  - M05: BM D1 958 / BM D2 2,540 / Matematik D1 2,734.
  - M08: Kimia T5 non-pool ≥ 757 (the script gives 758) for 36 anchors; Sejarah T4 exactly 15 for 15.
  - M07: exactly 763.
  - The state profile has its own count-1 override cells and is test-only, so the default dataset keeps the live zeros.
- **Knock-ons.**
  - 570024 score 30 → 55 (`baik`): the `le50` count stays 2 (129114, 129216), which matches the S6 "Skor ≤ 50" / action list. With score 30 it would have been 3, so this also removes a latent contradiction. 570024 stays a legacy row, so E2E-M04 still excludes it from the action list. M06 E2E-41 / AC-M06-10.4 still use 570024 as an active Matematik T4 pool question, which is valid.
  - 570006 is still the `missing_source` example (E2E-M04 compliance filter); its level is not asserted.
  - No other module references 570006 or 570025.

## R4.2 Round-3 items

| ID | Status | Evidence |
|---|---|---|
| XL-39 | Closed | M04 v1.6 §6.11 (570006 → Sains T1, 570025 → Bahasa Tamil T1; master-note anchors 129732/129650/129614 in BI T5, 122411 in Fizik T5, 560001/559916 in MATH T4 — all pool rows at difficulty 2) and the §6.13.1 anchor-cell table. Checked by hand as above: every anchor fits. |
| XL-40 | Closed | M05 v1.5 BR-05 and FR-M05-128: S1 difficulty rows = Q-DIFFICULTY (PKSK included, Σ 130,152); S3/S4/S5 = Q-PRACTICE (Σ 32,204); no "no named query yet" text left (grep count 0) ↔ M04 §4.1. |
| XL-36 | Closed | M03 v1.7 FR-M03-98 (and FR-40/58, BR-12, §6.10): Q-ACTIVE(subject) / Q-ACTIVE(level) ↔ M04 §4.1. |
| XL-37 | Closed | M07 v1.6 BR-M07-24 and DATA-M07-02: runtime PKSK ids from 9,000,001, never max + 1 (first #9000001, E2E-M07-29) ↔ M04 §6.1 / §6.13.1. |

## R4.3 Regression checks

- **Counts map.** Unchanged, and every figure is a named query: M01 = Q-ELIGIBLE; M03 = Q-ACTIVE; M04 = §4.1 queries; M05 = Q-ELIGIBLE / Q-ACTIVE / Q-DIFFICULTY / Q-PRACTICE; M06 = Q-SPM-POOL plus the documented hub constants; M07 = Q-PKSK.
- **Id floors.** Runtime users and runtime questions (including PKSK) start at 9,000,001 (M01, M02, M04, M07). Schools start at 10,301. The remaining max + 1 rules are only on materialised tables with no reserved range above them (M03 curriculum; M02 subscriptions, links and package rows from 1000). No collision.
