# Bijak SPM - UAT checklist (slug `e2e-bijak`)

Status: DRAFT for tonight's UAT (22:00) and go/no-go (23:00). Prepared from the code and the requirements doc `docs/requirements/v2-bijak-spm.md`, plus the existing e2e suite. No step below was executed by the author; the Result column is for the testers. Malay UI strings are quoted exactly as they appear in the app code.

Conventions
- Result: Pass / Fail / Blocked. A row marked "Blocked" in advance is a known gap, not a pass.
- 375 / 768 / 1280: the tester ticks `[x]` per width at which the row was executed and passed. A row is Pass only if all three boxes are ticked, unless the row says "desktop only".
- "Needs confirmation" means the label, route or behaviour was not verified in code or in a browser. Confirm before using it as a pass/fail criterion.
- Every row also implies: no horizontal page scroll, nothing clipped or overlapping, navigation reachable (CLAUDE.md section 7). A break at any width is a High-severity bug.

## 0. Build under test and prerequisites

| Item | Value |
|---|---|
| Build / URL | ______________________ (fill in) |
| Mode | [ ] mock (in-tab Bijak server persisted in localStorage; the suite default, scope-ON build, port 5191 via `playwright.bijak.config.mjs`)  [ ] http (real API; `BIJAK_API_BASE=<origin>`). Needs confirmation: the real-API switch is documented in the e2e helper as not built yet; UAT tonight is expected to be mock. |
| Commit / branch | be/e2e-bijak, commit: __________ |
| Tester(s) / date | ______________________ |
| Devices | Phone at 375, tablet at 768, desktop at 1280 (real devices or browser emulation; state which) |

Accounts (credentials from the UAT host; none are written here)

| Role in this checklist | Fixture role | Used in |
|---|---|---|
| Murid | `pelajar` (the demo student) | Objective A, and for B/C verification |
| Guru | `guru` | Objective B (403 check, expected Guru views) |
| Admin Sekolah | `admin_sekolah` fixture | Objective B |
| Admin Pusat | `admin` (national) | Objectives B and C |

Prerequisites
1. The scope-ON build is running (prototype scope on). Start command for the automated run: `npm run test:e2e:bijak` (it builds and previews on its own port). Needs confirmation of the exact manual-run command for the UAT host.
2. On a busy machine set `E2E_BOOT_TIMEOUT_MS=60000` before the automated run.
3. Fresh browser profile (empty localStorage) for each role, so seeds are fresh. Mock data persists per browser; clear site data between runs to reset.
4. Seeded papers present in the mock (ids used by the automated suite): `mat-k1-2025-a` (Matematik Kertas 1, includes the stimulus group "Rajah 1" at Q5-Q8), `mat-k2-2025-a` (Matematik Kertas 2, structured questions with the maths keyboard), `sej-k2-2025-a` (Sejarah Kertas 2, essay and letter bank). Sains Kertas 1 has an empty pool, which is expected to show the shortage list in Jana Kertas.
5. Student routes: hub `/spm/bijak`, history `/spm/bijak/sejarah`, cover `/spm/bijak/kertas/:paperId`, attempt `/spm/bijak/percubaan/:attemptId`, result `/spm/bijak/percubaan/:attemptId/keputusan`. Admin routes: `/admin/spm/kertas` (Pembina Kertas), `/admin/spm/kertas/baharu`, `/admin/spm/kertas/:id`, `/admin/spm/semakan` (Baris Gilir Semakan), `/admin/spm/soalan` (Bank Soalan SPM).

Route note for the lead: the brief mentions `/admin/bijak-spm`. In the code read, no such route exists (it appears only as a path in `src/app/__tests__/prototype-scope.test.ts`). The Admin Pusat paper list and publish flow is `/admin/spm/kertas`, reached from the Pentadbiran menu group "Kertas & SPM" -> "Pembina Kertas". The menu row "Bijak SPM (Simulasi)" (KS-06) in the same group has no link. Needs confirmation.

---

## Objective A - Murid uses Bijak SPM end to end

Flow: login -> SPM / Bijak hub -> paper list -> start attempt -> answer (stimulus group, structured question with maths keyboard) -> autosave -> Hantar -> result -> history.

| ID | Role | Step | Expected result / pass criteria | Fail criteria | 375 | 768 | 1280 | Result | Notes |
|---|---|---|---|---|---|---|---|---|---|
| UAT-A-01 | Murid | Log in as Murid; open the SPM section (`/spm`). | The SPM page loads with a link to Bijak SPM (test id `spm-bijak-link`; visible link text Needs confirmation). | Link missing, login fails, or horizontal scroll. | [ ] | [ ] | [ ] | | |
| UAT-A-02 | Murid | Tap the Bijak SPM link. | Hub opens at `/spm/bijak`. Subtitle reads "Duduki kertas SPM penuh dalam format kertas sebenar — bermasa, dengan skema." Tabs "Kertas Pilihan" and "Jana Kertas" are visible and each reachable in one tap. A "Sejarah Bijak SPM" link is present. | Wrong or missing subtitle, a tab missing, a different entry such as "Simulasi Peperiksaan" for the same function. | [ ] | [ ] | [ ] | | AC-01.1, AC-01.2 |
| UAT-A-03 | Murid | On "Kertas Pilihan", look at the list. Use the filters "Semua subjek" and "Semua kertas" (options include "Kertas 1", "Kertas 2"). | Papers grouped by subject; each card shows a status ("Belum cuba", "Sedang dijawab", or latest score) and an action button. The shown count (`paper-count`) equals the number of cards. Filters narrow the list and the count follows. | Count differs from cards; a draft or withdrawn paper listed; filter has no effect. | [ ] | [ ] | [ ] | | AC-02.1, AC-02.2. Card text such as "Kertas {k}", total marks and minutes: Needs confirmation of exact format. |
| UAT-A-04 | Murid | With no published paper (clear all via Admin Pusat first, or use an empty seed), open "Kertas Pilihan". | Empty state "Tiada kertas tersedia buat masa ini" with "Set simulasi sedang dalam penyediaan. Semak semula tidak lama lagi." | Blank page or error. | [ ] | [ ] | [ ] | | AC-01.3. Needs confirmation: requires withdrawing every paper; do last, or mark Not run. |
| UAT-A-05 | Murid | Open paper `mat-k1-2025-a` from the list. | Cover page shows title, numbered "Arahan", the section list with rule lines (for example "Jawab 1 daripada 2 soalan." for choose-N sections where present), foldable reference sheet if declared, and "Pilih mod" with "Mod Peperiksaan" and "Mod Latihan". | Cover missing parts, or mode choice unreachable. | [ ] | [ ] | [ ] | | AC-04.1, AC-04.2. Paper code/minutes on cover: Needs confirmation. |
| UAT-A-06 | Murid | Choose "Mod Peperiksaan" and tap "Mula". | Attempt screen opens at `/spm/bijak/percubaan/<id>` showing one question, the clock (count down in exam mode), the save indicator, and Sebelum / Seterusnya controls. | Attempt does not open, or a second attempt is created on double tap. | [ ] | [ ] | [ ] | | AC-05.1, AC-10.3 |
| UAT-A-07 | Murid | Answer an MCQ question by tapping an option. | The option shows as selected; within about 1 s the save indicator shows "Disimpan" (it may pass through "Menyimpan…"). | Indicator stays on "Menyimpan…", shows "Gagal simpan — cuba lagi", or the selection is lost. | [ ] | [ ] | [ ] | | AC-11.1, AC-11.2. Automated: yes |
| UAT-A-08 | Murid | Reload the attempt page. | Same URL, same question, the answer still selected (restored identically). | Answer lost, attempt reset, or a different attempt opened. | [ ] | [ ] | [ ] | | AC-08.1, AC-10.4, AC-11.6. Automated: yes (restored answer; position after reload Needs confirmation) |
| UAT-A-09 | Murid | Leave to the hub (`/spm/bijak`), check the card status, then open the attempt URL again. | Card shows "Sedang dijawab" with a "Sambung" action; reopening restores the answer. | Status still "Belum cuba", or the attempt is orphaned. | [ ] | [ ] | [ ] | | AC-02.1, AC-12.3. Automated: yes |
| UAT-A-10 | Murid | In `mat-k1-2025-a` move to Q5 (Seterusnya x4). | Heading reads "Soalan 5 · berdasarkan Rajah 1" (Q5-Q8 share Rajah 1). At 1280 the Rajah is pinned in a side panel (`pinned-stimulus`). At 375 and 768 a chip opens the Rajah as a bottom sheet (dialog) that closes with Escape; answers are kept. Moving to Q6 keeps the same Rajah. | Rajah not reachable while answering, group split or reordered, answer lost when the sheet closes. | [ ] | [ ] | [ ] | | AC-07.1. Code uses the `lg` breakpoint (1024) for the side panel; the requirement says 1280. Needs confirmation of expected behaviour at 768. Automated: yes (m06 spec, tagged @bijak) |
| UAT-A-11 | Murid | Rajah load failure (only if the tester can force it). | "Rajah tidak dapat dimuatkan." with "Cuba lagi" and "Lapor". | Silent blank. | [ ] | [ ] | [ ] | | AC-07.4. Needs confirmation: not in the code paths read; probably Not run. |
| UAT-A-12 | Murid | Open paper `mat-k2-2025-a` (structured). Q1 is "berdasarkan Rajah 1". Type a working line, then open the maths keyboard (toggle) and insert a fraction, type digits, then replace with a plain answer; fill the unit field. | Step lines accept text; the maths keyboard opens, the fraction key inserts a template such as "(1)/(2)", a preview renders, the student never sees LaTeX source (no backslash in any field). "Jawapan akhir" box and a unit field are present. At 375 the keyboard does not cover the field being edited and keys are tappable. | Keyboard covers the input, LaTeX shown, keys too small, input lost on blur. | [ ] | [ ] | [ ] | | AC-09.1, AC-09.3, AC-09.4. Automated: yes (m06 spec). Photo of working: not covered (AC-09.2), Needs confirmation. |
| UAT-A-13 | Murid | Use the question map (open at 375) and "Tanda soalan" on one question. | Map shows per question "Dijawab", "Ditanda" or "Belum" with counts ("Dijawab n · Ditanda n · Belum n") that add up to the number of questions. The flag button changes to "Ditanda". Tapping a number jumps to that question. | Counts wrong, flag not saved, map hides the question or scrolls horizontally. | [ ] | [ ] | [ ] | | AC-10.1, AC-10.2, AC-10.5 |
| UAT-A-14 | Murid | `sej-k2-2025-a`: type a short answer, go next, pick a letter in the match bank, go next, type an essay line. | Short text accepted; match bank letters selectable; essay shows a live "{w} patah perkataan" count (for example "4 patah perkataan" for a four-word line). | Control missing or not saved. | [ ] | [ ] | [ ] | | AC-08.1, AC-08.2. Automated: yes (m06 spec). Other answer modes (ordering, graph, drawing, code): Needs confirmation. |
| UAT-A-15 | Murid | On the last question tap "Hantar". | Dialog "Hantar jawapan anda sekarang?" lists "Belum dijawab: n soalan" and "Ditanda: n soalan", with "Kembali" and a confirm "Hantar". "Kembali" returns to the attempt with answers intact. | No summary, wrong counts, or Hantar works without confirmation. | [ ] | [ ] | [ ] | | AC-13.1. Automated: yes (summary shown) |
| UAT-A-16 | Murid | Confirm "Hantar". Also double-tap the confirm button once on a fresh attempt. | Lands on this attempt's result (win screen: friend line, section scores `section-score`, "Kembali ke Home", "Cuba lagi", share). Exactly one submission. | Lands on a blank sitting, error, or two records in history. | [ ] | [ ] | [ ] | | AC-13.2, AC-13.3, AC-13.5. Double tap: Needs confirmation (not automated). |
| UAT-A-17 | Murid | In the result open a question under "Semakan soalan" (for example result Q5, or Q1 of the maths paper). | Expands to show the mark scheme ("Skema Pemarkahan"), marks "x / y", and per-point hit marks for structured questions. Sums match the shown total. | Scheme missing after submit, totals disagree. | [ ] | [ ] | [ ] | | AC-14.x, AC-15 (exam mode scheme after Hantar). Automated: yes (m06 spec) |
| UAT-A-18 | Murid | Sejarah result: check the essay part. | Item waiting for a teacher is shown as provisional (`provisional` notice), F/C mark codes shown on points (for example F1). | Essay shown as final-zero without a pending note. | [ ] | [ ] | [ ] | | AC-14. Automated: yes (m06 spec). Exact notice text: Needs confirmation. |
| UAT-A-19 | Murid | Open "Sejarah Bijak SPM" (`/spm/bijak/sejarah`). | History lists the submitted attempt(s) with a status, a score, a "Semakan" action; unfinished ones show "Sambung". Summary block shown. | Submitted attempt missing from the list (this is the only place results show to a student). | [ ] | [ ] | [ ] | | AC-18.x. Automated: yes (list visible; row contents Needs confirmation) |
| UAT-A-20 | Murid | Open "Semakan" from a history row. | The same result as at submit, unchanged. | Different questions or marks. | [ ] | [ ] | [ ] | | AC-33.2. Not automated. |
| UAT-A-21 | Murid | On the result tap "Cuba lagi". | A fresh sitting starts (cover or new attempt); the earlier result stays in history. | Earlier result overwritten or removed. | [ ] | [ ] | [ ] | | AC-17. Not automated. Exact landing screen: Needs confirmation. |
| UAT-A-22 | Murid | Start a paper, answer one question, return to the cover of the same paper after more than 60 s. | Block "Percubaan belum dihantar" with "Sambung — teruskan jawapan & masa sedia ada" and "Mula Semula — kosongkan jawapan & masa". "Mula Semula" asks for confirmation (button "Mula Semula", cancel "Batal"); the old attempt is not left in progress. | No choice offered, or silent loss of answers. | [ ] | [ ] | [ ] | | AC-12.1, AC-12.2. Not automated. Confirmation sentence in the dialog: Needs confirmation. |
| UAT-A-23 | Murid | Start a paper in "Mod Latihan". | One question at a time; a "Semak" button gives instant feedback; the last step is "Selesai" with a "Selesai latihan?" dialog; no deadline. | Hantar shown instead of Selesai, or timer ends the sitting. | [ ] | [ ] | [ ] | | AC-04.3, AC-05.7, AC-13.6. Not automated. |
| UAT-A-24 | Murid | Tab "Jana Kertas": press "Jana Kertas" with defaults, then check the result; go back and choose Sains + "Kertas 1" and press "Jana Kertas". | Default subject: a generated paper cover opens (title contains "Kertas Jana"). Sains Kertas 1: no paper is created and the shortage line reads "Bahagian A: perlu 40 soalan, hanya 0 tersedia". | A silent under-filled paper, a duplicate question, no feedback. | [ ] | [ ] | [ ] | | AC-03.1, AC-03.2. Automated: yes (m06 spec). "Belum ada kontrak untuk subjek dan kertas ini" (AC-03.6): code has it; trigger Needs confirmation. |
| UAT-A-25 | Murid | In exam mode with a timer, let the remaining time pass the 5-minute mark (or advance mock time if the host allows). | Banner "Amaran: masa berbaki kurang 5 minit." appears once, not covering the answer area. At 0 the sitting is submitted without a confirmation. | No warning, or work lost at the deadline. | [ ] | [ ] | [ ] | | AC-05.2, AC-05.3. Not automated. Banner text in code: Needs confirmation. |
| UAT-A-26 | Murid | Go offline (browser offline switch), answer a question, then go back online. | While offline the indicator reads "Luar talian — jawapan disimpan pada peranti ini". After reconnect it returns to "Disimpan" without user action. | Answer lost, indicator stuck, or "Gagal simpan — cuba lagi" persists. | [ ] | [ ] | [ ] | | AC-11.2, AC-11.3. Not automated. Needs confirmation: whether the in-tab mock server can simulate offline. |
| UAT-A-27 | Murid | Cross-cutting: walk hub, cover, attempt (with sheet open), submit dialog, result and history at each width. | No horizontal page scroll, nothing clipped or overlapping, the primary action always reachable. | Any break (High severity). | [ ] | [ ] | [ ] | | NFR-01. Automated: no-horizontal-scroll check on every major screen in the student test. |

Rows in Objective A: 27.

---

## Objective B - Teacher and school admin see the student's Bijak results (US-33)

Intended behaviour (US-33, AC-33.4): every submitted or marked sitting writes one attempt record and one aggregate that feeds student history and the existing Guru modules (Prestasi, Analitik Adaptif, Analisa Item, Monitoring) and school analytics. D43: the Guru has no Bijak SPM screen; a Bijak route returns 403.

Update (build at 521903df): the school dashboard and the Guru class / pupil Prestasi views now carry a "Keputusan Bijak SPM" label with figures or "Tiada data" in http mode (B-06, B-09). Still not built: Guru Analitik/Analisa Item/Monitoring views, per-attempt drill-down and Admin Pusat analytics. Original gap text: no Guru module and no school view shows Bijak attempts, and no admin screen lists student attempts. The only place results show is the student's history (UAT-A-19), including inside Mod Pelajar. Rows below marked Blocked record the intended steps and pass criteria; they are not passes.

Precondition for every B row: Murid has submitted at least one attempt (UAT-A-16), and the tester knows which class/school that student belongs to. Needs confirmation: which class the demo student sits in.

| ID | Role | Step | Expected result / pass criteria | Fail criteria | 375 | 768 | 1280 | Result | Notes |
|---|---|---|---|---|---|---|---|---|---|
| UAT-B-01 | Guru | Log in as Guru; open `/spm/bijak` directly. | In-place 403: the browser tab title is "403 - Akses Ditolak &#124; PRESTASIPLUS", the main area shows "403", the URL stays `/spm/bijak`, no hub is rendered, no attempt is created. | Hub renders, redirect to somewhere else without a 403, or an attempt is created. | [ ] | [ ] | [ ] | | AC-01.4, D43. Automated: yes. |
| UAT-B-02 | Guru | Open `/spm/bijak/kertas/mat-k1-2025-a` directly. | Same 403 as B-01. | Cover renders. | [ ] | [ ] | [ ] | | Automated: yes. |
| UAT-B-03 | Guru | Open `/spm/bijak/sejarah` directly. | Same 403 as B-01. | History renders. | [ ] | [ ] | [ ] | | Automated: yes. |
| UAT-B-04 | Guru | Look through the Guru menu (the matrix row 13 "SPM" is Murid only). | No Bijak SPM entry for the Guru. | A Bijak SPM student entry is offered to the Guru. | [ ] | [ ] | [ ] | | role-access-matrix row 13. Not automated. Needs confirmation of the exact menu labels. |
| UAT-B-05 | Admin Sekolah | Log in as Admin Sekolah; open `/spm/bijak` directly. | Refused with a 403 (no Bijak SPM screen for Admin Sekolah). | Hub renders. | [ ] | [ ] | [ ] | | AC-01.4. Code route roles are `student` and `admin`, so 403 is expected. Not automated. Needs confirmation. |
| UAT-B-06 | Guru | HTTP mode only: open the class performance view `/prestasi/kelas/228` (Needs confirmation of the class for the UAT data) and a pupil's Prestasi 360 `/prestasi/<userId>`. | A section titled "Keputusan Bijak SPM" is shown. It holds either figures or the empty state "Tiada data", never both. In mock mode the section is not shown (old layout). | Section absent in http mode, or figures and "Tiada data" together, or figures that disagree with the pupil's history. | [ ] | [ ] | [ ] | | Label and empty state built (commits 8a55c244, fe4313c0); automated in `us33-http.spec.ts` (class view). Per-attempt rows (subject, score, date) are not promised by the UI; Needs confirmation. Mock regression: `us33-results.spec.ts`. |
| UAT-B-07 | Guru | Open Analitik Adaptif / Analisa Item / Monitoring for the same class. | Bijak attempt feeds the aggregates (units = marks, subject). | Aggregate unchanged after a submission. | [ ] | [ ] | [ ] | Blocked | Blocked (known, accepted): no Bijak view in Analitik Adaptif / Analisa Item / Monitoring was found in the code read (US-33 only covers the labelled sections of B-06 and B-09). Needs confirmation. |
| UAT-B-08 | Guru | Open a student's Bijak result from a Guru module to read per-question detail (and confirm AI-proposed essay marks, later surface). | Detail view for the student's attempt. | n/a | [ ] | [ ] | [ ] | Blocked | Blocked: UI not built yet (US-33, US-31). Marked as out of the D43 prototype in the requirements. |
| UAT-B-09 | Admin Sekolah | HTTP mode only: open the school dashboard `/admin-sekolah` and read the panel "Ringkasan Prestasi". | The badge "Keputusan Bijak SPM" is shown, with either figures or the empty state "Tiada data", never both. | Badge absent in http mode, or figures together with "Tiada data". | [ ] | [ ] | [ ] | | Built (commits 8a55c244, fe4313c0); automated in `us33-http.spec.ts` (school dashboard). Figures match the submitted attempts: Needs confirmation. |
| UAT-B-10 | Admin Pusat | Open Pentadbiran "Kertas & SPM" -> "Pembina Kertas" (`/admin/spm/kertas`) and look for per-paper attempts, scores, blank rate. | Per-paper analytics (US-30) and the marks-review queue (US-31) show the sitting. | No attempt data anywhere. | [ ] | [ ] | [ ] | Blocked | Blocked: UI not built yet (US-30, US-31, US-33). `/admin/spm/kertas` lists papers only (columns Kertas, Subjek, Soalan, Markah, Blueprint, Status, Dikemas kini, Tindakan). Automated: `test.fixme` in `admin-mod-pelajar.spec.ts`. |
| UAT-B-11 | Admin Pusat | In the Pentadbiran account menu choose "Masuk Mod Pelajar". | A persistent bar reads "Mod Pelajar: anda melihat portal pelajar sebagai {name}" with a "Keluar Mod Pelajar" button; the learner portal opens as the demo student. | Banner missing, admin session lost. | [ ] | [ ] | [ ] | | D31(c), D33(b). At widths below 1024 the account menu sits inside the sidebar drawer. Automated: yes. |
| UAT-B-12 | Admin Pusat (in Mod Pelajar) | Open `/spm/bijak`, start a paper, answer one question, check "Disimpan", Hantar and confirm. | The student flow works as for a Murid; the Mod Pelajar bar stays on every screen; result shows section scores. | Flow blocked for the admin, banner lost. | [ ] | [ ] | [ ] | | Automated: yes (use in-app navigation, a full reload would re-apply the login). |
| UAT-B-13 | Admin Pusat (in Mod Pelajar) | Open `/spm/bijak/sejarah` after B-12. | The attempt is listed in the student history. | Missing. | [ ] | [ ] | [ ] | | Not automated. |
| UAT-B-14 | Admin Pusat (in Mod Pelajar) | Tap "Keluar Mod Pelajar". | Returns to the admin portal (`/admin/command-center`) with the admin session restored. | Stays in the learner portal, or lands on `/login`. | [ ] | [ ] | [ ] | | Automated: yes. |
| UAT-B-15 | Admin Sekolah | Repeat B-11 to B-14 as Admin Sekolah: "Masuk Mod Pelajar" -> attempt -> result -> "Keluar Mod Pelajar". | Same as B-11 to B-14. | n/a | [ ] | [ ] | [ ] | Blocked | Blocked: accepted as a known gap for UAT (lead, 2026-10-20). Not built yet: `enterModPelajar` in `src/shells/shared/mod-pelajar.ts` accepts only role `admin`, though the requirement (section 2, D31c/D33b) lists Admin Sekolah. The e2e test is a `fixme` (`e2e/bijak/admin-mod-pelajar.spec.ts`). |
| UAT-B-16 | Admin Pusat / Admin Sekolah (in Mod Pelajar) | After B-12, check that this attempt is flagged as test data and is excluded from analytics, history ranking and rewards. | Test-data flag set; attempt not counted anywhere (AC-33.5). | Counted in analytics or rewards. | [ ] | [ ] | [ ] | Blocked | Blocked: UI not built yet (US-33, AC-33.5). No test-data flag or analytics consumer was found in the Bijak code read. Needs confirmation by the lead. |

Rows in Objective B: 16 (B-07, B-08, B-10, B-15 and B-16 pre-marked Blocked; B-06 and B-09 are built in http mode).

---

## Objective C - Admin Pusat publishes a paper

Flow: Pembina Kertas list -> new / open draft -> assemble from the bank -> edit -> publish gates -> publish -> the paper appears in the student paper list.

| ID | Role | Step | Expected result / pass criteria | Fail criteria | 375 | 768 | 1280 | Result | Notes |
|---|---|---|---|---|---|---|---|---|---|
| UAT-C-01 | Admin Pusat | Log in as Admin Pusat; in the Pentadbiran menu, under the "Kertas & SPM" section heading (always open, not a collapsible item), tap the "Pembina Kertas" link. | `/admin/spm/kertas` opens ("Pembina Kertas", subtitle "Bina dan terbitkan kertas SPM"). The summary shows "Jumlah kertas", "Draf", "Diterbitkan". Below 1024 the menu is reachable from the drawer button. | Menu item missing or unreachable at 375. | [ ] | [ ] | [ ] | | Automated: `e2e/bijak/admin-publish.spec.ts`. Menu row KS-09. Row KS-06 "Bijak SPM (Simulasi)" has no link (see section 0). |
| UAT-C-02 | Admin Pusat | Read the paper list. | Table "Senarai kertas" with columns Kertas, Subjek, Soalan, Markah (x / budget), Blueprint ("Sepadan" or "Belum sepadan"), Status (Draf / Diterbitkan), Dikemas kini, Tindakan ("Buka", delete icon on drafts). Below 768 px (375) the list shows card rows with the title, code and kertas, Subjek, Markah, Dikemas kini, the status and Blueprint badges, "Buka", and "Padam kertas" on drafts. Empty list reads "Belum ada kertas" / "Tekan Kertas Baharu untuk mula." | Overflow, clipped actions, wrong status. | [ ] | [ ] | [ ] | | Mobile cards fixed 2026-10-20 (`fix(m28-bijak-spm)` commit; before it the cards had no status, Blueprint or actions). Automated: `admin-publish.spec.ts` (C-02 test). |
| UAT-C-03 | Admin Pusat | Tap "Kertas Baharu"; choose a subject and "Kertas n"; optionally a title. | Blueprint summary shows (code, minutes, marks, source) and the list of sections with question count, marks and rule. "Cipta Kertas" is disabled until subject and kertas are chosen; without them "Pilih subjek dan kertas dahulu." | Create allowed without a blueprint. | [ ] | [ ] | [ ] | | Automated: `admin-publish.spec.ts`. |
| UAT-C-04 | Admin Pusat | Tap "Cipta Kertas". | A draft opens at `/admin/spm/kertas/:id` with status Draf, title field "Tajuk kertas" (on the Kertas Baharu form it reads "Tajuk kertas (pilihan)"), stats "Markah", "Soalan", "Minit", and the check panel "Belum sepadan dengan blueprint (n perkara)" listing each gap. Each section shows "Soalan x / n" and "Markah x / n". | Draft not created, check panel absent. | [ ] | [ ] | [ ] | | AC-23, AC-24 (title is editable; duration edit control: Needs confirmation, not seen in the editor template). Automated: `admin-publish.spec.ts`. |
| UAT-C-05 | Admin Pusat | In a section tap "Tambah soalan dari bank"; search; add a single question and a stimulus-group question. | Side panel "Tambah dari bank" lists only Terbit questions for this subject and kertas; a stimulus group is added whole ("Kumpulan rangsangan ... bergerak bersama"); added items leave the picker; counters update. | Non-Terbit question offered, group added in part, duplicate allowed. | [ ] | [ ] | [ ] | | AC-23.x, AC-07.3. Automated: `admin-publish.spec.ts`. |
| UAT-C-06 | Admin Pusat | Reorder with "Naik" / "Turun", remove with "Buang soalan" / "Buang kumpulan". | Items move as units; a group stays contiguous and complete; counters recompute. | A group split or reordered internally. | [ ] | [ ] | [ ] | | Not automated. |
| UAT-C-07 | Admin Pusat | Tap "Simpan draf". | Flash "Draf kertas disimpan."; the button is disabled again when nothing is unsaved; reload keeps the content. | Content lost on reload. | [ ] | [ ] | [ ] | | Automated: `admin-publish.spec.ts`. |
| UAT-C-08 | Admin Pusat | Tap "Pratonton sebagai pelajar". | Panel "Pratonton sebagai pelajar" ("Paparan kertas tanpa skema.") shows sections with rule line and "[n markah]", stimulus once per group, and no mark scheme visible. | Mark scheme shown, preview missing a section. | [ ] | [ ] | [ ] | | AC-28 (preview as a panel; full Mod Pelajar preview of drafts: Needs confirmation). Automated: `admin-publish.spec.ts`. |
| UAT-C-09 | Admin Pusat | On a draft that does not match its blueprint (missing questions, marks off budget, a non-Terbit question, split group) tap "Terbitkan". | The paper stays Draf. The check panel lists every failure; the message reads "Kertas belum boleh diterbitkan: selesaikan n perkara di atas." There is no way to bypass it in the UI. | Paper published, or a failure not listed, or a bypass control exists. | [ ] | [ ] | [ ] | | AC-26.1, AC-26.2. Hard gaps block. The override with a mandatory reason (AC-26.3) is not in the editor template read; Needs confirmation. Automated: `admin-publish.spec.ts`. |
| UAT-C-10 | Admin Pusat | In "Baris Gilir Semakan" (`/admin/spm/semakan`) try to publish ("Terbit") a question whose answer key or mark scheme is missing or inconsistent. | Publish is refused and lists the failing question, for example "skema jawapan belum ada", "skema markah belum ada", "pilihan jawapan betul tidak sah", or "topik DSKP belum dipilih". The question stays in the queue; there is no bypass. | A question with no key becomes Terbit. | [ ] | [ ] | [ ] | | Mandatory answer key (AC-26.1c) is enforced when a question becomes Terbit in the code read. Needs a seeded item without a key, Needs confirmation. Not automated. |
| UAT-C-11 | Admin Pusat | At paper level, confirm the answer-key gate on "Terbitkan" itself (paper made only of Terbit questions). | Paper-level publish re-checks that every leaf part has a key and also the other US-26 gates (a) at least one question, (e) marks, (f) duration for "Disahkan" blueprints, and answer modes with a working student control. | A paper can be published with a gate unmet. | [ ] | [ ] | [ ] | Blocked | Blocked: UI not built yet. In the code read, `publishPaper` checks the blueprint comparison and that every question is Terbit; the key gate runs at question approval, not again at paper publish. Whether this is enough for G5 is the lead's decision. Needs confirmation. |
| UAT-C-12 | Admin Pusat | Fix the draft so every gap is cleared (check panel shows "Sepadan dengan blueprint") and tap "Terbitkan". | Flash "Kertas diterbitkan. Ia kini ada dalam hab Bijak SPM pelajar." Status becomes Diterbitkan; editing controls are replaced by "Lihat di Bijak SPM" and "Tarik balik"; fields are read-only. | Publish fails with no reason, or editing still allowed. | [ ] | [ ] | [ ] | | AC-26.5, AC-27.3. Automated: `admin-publish.spec.ts`. |
| UAT-C-13 | Murid | Log in as Murid (separate browser profile, same build and data). Open `/spm/bijak`; filter to the paper's subject and kertas. | The newly published paper appears in "Kertas Pilihan" with "Belum cuba", and can be opened and started. Draft papers do not appear. | Paper absent, or a draft visible. | [ ] | [ ] | [ ] | | AC-02.1, AC-02.3. In the mock, Admin Pusat and Murid share one browser's localStorage; use the same profile (Mod Pelajar, "Lihat di Bijak SPM") or Needs confirmation that two profiles share data. Automated via "Lihat di Bijak SPM" in the same tab (`admin-publish.spec.ts`), not a separate Murid session. |
| UAT-C-14 | Admin Pusat | On the published paper tap "Tarik balik". | Flash "Kertas ditarik balik ke Draf."; status Draf; the paper disappears from the student list; past submitted results stay in history. | Still visible to students, or history entries lost. | [ ] | [ ] | [ ] | | AC-27.1. Automated: `admin-publish.spec.ts`. |
| UAT-C-15 | Admin Pusat | Delete a draft with the "Padam kertas" button. | Flash "Kertas dipadam." and the row disappears. The delete icon does not exist on published rows. | Published paper deletable. | [ ] | [ ] | [ ] | | Automated at all three sizes (`admin-publish.spec.ts`): card button at 375, table button at 768 and 1280. Mobile delete fixed with C-02. |
| UAT-C-16 | Admin Pusat | On a published paper use "Salin untuk sunting" (copy to edit) and "Digantikan" versioning. | Deep draft copy opens; publishing it marks the original "Digantikan". | n/a | [ ] | [ ] | [ ] | Blocked | Blocked: UI not built yet (US-27, AC-27.2). The editor offers "Tarik balik" only. |
| UAT-C-17 | Guru / Murid | While logged in as Guru, then as Murid, open `/admin/spm/kertas`. | The page is refused (Admin Pusat only); no list data is shown. | Paper list visible. | [ ] | [ ] | [ ] | | AC-32. Exact refusal screen (403 vs redirect): Needs confirmation. Not automated. |
| UAT-C-18 | Murid | Open the direct URL of a draft or withdrawn paper, `/spm/bijak/kertas/<id>`. | "Not found" outcome; no attempt can start. | Cover opens. | [ ] | [ ] | [ ] | | AC-02.3. Needs confirmation of the exact screen. Not automated. |
| UAT-C-19 | Admin Pusat | Responsive: list, Kertas Baharu, editor (with picker and preview panels open) at each width. | No horizontal page scroll; table becomes cards on small widths; action buttons are at least 44 px and reachable. | Any break (High severity). | [ ] | [ ] | [ ] | | NFR-01. Partly automated: `admin-publish.spec.ts` asserts no horizontal scroll on the list and editor at 375/768/1280. |

Rows in Objective C: 19 (C-11 and C-16 pre-marked Blocked).

---

## Mapping of automated tests to UAT rows

Run with `npm run test:e2e:bijak` (config `playwright.bijak.config.mjs`, script filter `--grep @bijak`), projects mobile 375x812, tablet 768x1024, desktop 1280x800. Results on the mock (2026-10-20, run per file, not one combined run): `student`/`teacher`/`admin-mod-pelajar` 18 passed, 6 fixme, 0 failed across the three sizes (before the Admin Sekolah fixme and the http spec were added; both skip on the mock); `m06-spm/bijak-spm` 4 passed on desktop; `admin-publish` 8 passed, 7 skipped (fixme), 0 failed across the three sizes. After the mobile-card fix, one full `--grep @bijak` run on the rebuilt mock: 42 passed, 18 skipped (fixme and http-only), 0 failed (14 passed per size). On a busy machine set `E2E_BOOT_TIMEOUT_MS=60000`. In http mode (`BIJAK_API_BASE` set) only `http-autosave.spec.ts` runs; it has not been run yet.

| Automated test | File | UAT rows covered |
|---|---|---|
| Murid: list, start, answer, autosave, reload keeps the answer, submit, result @bijak | `e2e/bijak/student.spec.ts` | A-01, A-02, A-03 (count visible), A-05, A-06, A-07, A-08, A-09, A-15, A-16, A-19 (list visible), A-27 |
| Murid: autosave sends no network request in the mock build @bijak (provisional) | `e2e/bijak/student.spec.ts` | A-07 (mock transport only; revisit in http mode) |
| Guru gets 403 on `/spm/bijak` @bijak | `e2e/bijak/teacher.spec.ts` | B-01 |
| Guru gets 403 on `/spm/bijak/kertas/mat-k1-2025-a` @bijak | `e2e/bijak/teacher.spec.ts` | B-02 |
| Guru gets 403 on `/spm/bijak/sejarah` @bijak | `e2e/bijak/teacher.spec.ts` | B-03 |
| Teacher sees a student's result in a Guru module (test.fixme) | `e2e/bijak/teacher.spec.ts` | B-07, B-08 (skipped by design: Blocked); B-06 is covered by `us33-results.spec.ts` / `us33-http.spec.ts` |
| Admin Pusat in Mod Pelajar: list, start, answer, submit, result, leave @bijak | `e2e/bijak/admin-mod-pelajar.spec.ts` | B-11, B-12, B-14 |
| Admin sees student results through an admin module (test.fixme) | `e2e/bijak/admin-mod-pelajar.spec.ts` | B-10 (skipped by design: Blocked) |
| School admin in Mod Pelajar (test.fixme) | `e2e/bijak/admin-mod-pelajar.spec.ts` | B-15 (skipped by design: Blocked) |
| HTTP autosave: PUT answers 2xx, answer comes back from the server after reload @bijak | `e2e/bijak/http-autosave.spec.ts` | A-07, A-08 in http mode only (skips without `BIJAK_API_BASE`) |
| Admin Pusat: menu, draft, assemble, save, preview, Terbitkan, visible to a student, Tarik balik @bijak | `e2e/bijak/admin-publish.spec.ts` | C-01, C-03, C-04, C-05, C-07, C-08, C-12, C-13 (same tab), C-14, C-19 (scroll) |
| Admin Pusat: Terbitkan on an empty draft is refused with the gap list @bijak | `e2e/bijak/admin-publish.spec.ts` | C-09 (blueprint gate) |
| Admin Pusat: a draft can be deleted from the list (card button at 375, table button above) @bijak | `e2e/bijak/admin-publish.spec.ts` | C-15 |
| Admin Pusat: C-02 list shows status, blueprint badge and actions; published has no delete @bijak | `e2e/bijak/admin-publish.spec.ts` | C-02 |
| C-11 paper-level key re-check, C-16 Salin untuk sunting (test.fixme) | `e2e/bijak/admin-publish.spec.ts` | C-11, C-16 (skipped by design: Blocked) |
| Hub from SPM, stimulus group with pinned Rajah, submit and per-point result | `e2e/m06-spm/bijak-spm.spec.ts` | A-02, A-10, A-15, A-16, A-17 |
| Structured question: maths keyboard, working lines, per-point marks | `e2e/m06-spm/bijak-spm.spec.ts` | A-12, A-17 |
| Jana Kertas generates a paper and shows a shortage list | `e2e/m06-spm/bijak-spm.spec.ts` | A-24 |
| Sejarah K2: F and C codes, letter bank, essay waiting for a teacher | `e2e/m06-spm/bijak-spm.spec.ts` | A-14, A-18 |

The four tests in `e2e/m06-spm/bijak-spm.spec.ts` are tagged `@bijak` (describe title), so `npm run test:e2e:bijak` runs them.

Rows with no automated coverage: A-04, A-11, A-13, A-20 to A-23, A-25, A-26, B-04, B-05, B-13, C-06, C-10, C-17, C-18. The "every question Terbit" part of C-09 is not automated: the bank picker offers only Terbit questions, so the mock cannot build that case.

---

## Go / no-go (proposed criteria, decided by the lead/user at 23:00)

Proposed criteria

| # | Criterion | Rule |
|---|---|---|
| 1 | Objective A | Every row Pass at all three widths, except rows explicitly accepted by the lead as Not run (candidates: A-04, A-11, A-25, A-26 where the mock cannot trigger the condition). |
| 2 | Objective C | Every row Pass at all three widths, except C-11 and C-16 (Blocked, see below) and C-17/C-18 if the lead confirms the refusal screens. |
| 3 | Objective B | Every built row Pass (B-01 to B-06, B-09, B-11 to B-14). B-07, B-08, B-10, B-15 and B-16 stay Blocked and are accepted as known US-33 gaps. |
| 4 | Defects | No open Critical or High bug (a layout break at any width is High). No answer lost, no secret mark scheme visible before Hantar in exam mode, no attempt missing from the student's history. |
| 5 | Automation | `npm run test:e2e:bijak` shows 0 failed at 375/768/1280 on the UAT build. |

Decision
- GO: criteria 1 to 5 all met.
- NO-GO: any of criteria 1, 2, 4 or 5 fails, or a Pass is claimed for a Blocked row.
- Conditional GO: only criterion 3's Blocked rows remain open, and the lead records the US-33 gap as a known issue with an owner and date.

Known gaps accepted if the lead agrees (not defects in this UAT)
1. US-33: no Guru Analitik/Analisa Item/Monitoring view, per-attempt drill-down or Admin Pusat analytics (B-07, B-08, B-10).
2. Test-data flag and exclusion from analytics for Mod Pelajar attempts (B-16, AC-33.5).
3. Admin Sekolah in Mod Pelajar (B-15): Blocked, accepted by the lead as a known gap for UAT. `enterModPelajar` accepts role `admin` only; D31c/D33b list `admin_sekolah` but it is not built. The main path for objective B is the school dashboard (BE-21), whose "Keputusan Bijak SPM" label is built in http mode (B-09; B-07, B-08 and B-10 remain Blocked).
4. Paper-level answer-key re-check at "Terbitkan" and the publish-override-with-reason flow (C-09, C-11); "Salin untuk sunting" (C-16).

Sign-off

| Name / role | Decision | Date and time |
|---|---|---|
| | | |
