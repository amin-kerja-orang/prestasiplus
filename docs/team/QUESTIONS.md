# Product questions for the user (writer: team A lead)

| Q | Question (plain BM) | Recommendation | Answer | Unblocks |
|---|---|---|---|---|
| Q1 | Teks BM cadangan dalam handoff §7j (ditambah: murid "Kertas ini sedang dikemas kini dan tidak boleh dicuba buat masa ini."; admin selepas Arkib "Soalan ini ada dalam kertas yang telah diterbitkan. Murid tidak boleh memulakan percubaan baharu pada kertas itu sehingga soalan diganti."; 12 sebab "Dilihat murid di" dalam contract servability) (mesej ralat Cuba Lagi, markah kendiri, amaran tinggalkan halaman, Bab tidak sepadan) — boleh guna seperti dicadangkan? | Ya, guna seperti dicadangkan | **YES** (user, 2026-10-31): use the proposed BM copy as written | T15 |
| Q2 | Selepas murid menanda markah sendiri (self-mark) dan jumlah markah naik, adakah murid dapat Syiling dan XP tambahan? V2 beri tambahan (2 Syiling + 10 XP setiap markah naik). V3 sekarang bekukan ganjaran pada nilai semasa Hantar (supaya murid tak boleh "tanda penuh" untuk kumpul syiling). | Ikut V2 (tambahan hanya jika markah naik, satu kali bagi setiap bahagian, had markah maksimum), kerana pariti V2 ialah syarat lulus (D88) | **Follow V2 with a cap** (user, 2026-10-31): self-mark adds 2 Syiling + 10 XP per mark gained, positive delta only, once per part, never above the part's full marks; no claw-back on a lower mark. V1 has no self-mark | T38 |
| Q3 | UAT belum ada blueprint (Kontrak) langsung, jadi murid tak boleh Jana Kertas di UAT. Cara mana nak sediakan? (a) Admin cipta dan Sahkan sendiri dalam Kontrak di UAT, ikut aliran sebenar; (b) benarkan DevOps jalankan seed blueprint demo di UAT. | (a) Admin buat sendiri ikut aliran sebenar; mula dengan Matematik Tambahan K2 (3472/2) kerana itu satu-satunya yang ada bukti cukup. Seed demo hanya untuk local/E2E | **(a) Admin creates + Sahkan in Kontrak on UAT, real flow, NO seed** (product owner via user, 2026-10-31 18:15 MYT; supersedes the earlier seed answer): 3472/2 first; then 4 go-live K1 (Matematik 1449/1, Sejarah 1249/1, Fizik 4531/1, Sains K1) once 2+ body evidence is ready; team A prepares the evidence list (T39). Demo seeds local/E2E only | B1 Q-B1-1, UAT demo |
| Q4 | Senarai soalan ADMIN: soalan Darjah (D1–D6) patut kelihatan atau disembunyikan? Dokumen skop R1 (AC-R1-19.2, AC-02.7, R1-21.5) kata **kelihatan dan boleh diurus** (tetapi tak boleh dipilih untuk soalan/blueprint baru). Tetapi pembetulan secondary-only (D72, QA 8b) sekarang **menyembunyikannya** daripada admin juga. | Kelihatan kepada admin sahaja (dengan label Darjah, boleh arkib/urus), tetap tersembunyi daripada murid dan tak boleh dipilih untuk yang baru — supaya data lama masih boleh diurus | **Hide from admin too** (user, 2026-10-31): keep D72 behaviour; AC-R1-19.2 / AC-02.7 / R1-21.5 \"visible to admin\" superseded (D96). No code change | R1-19.2 / AC-02.7 / R1-21.5 |
| Q5 | Ganjaran Bijak SPM: murid dapat Syiling/XP untuk SETIAP percubaan yang dihantar (Cuba Lagi berulang kali = ganjaran berulang), atau sekali sahaja bagi setiap kertas, atau hanya untuk markah yang lebih tinggi daripada markah terbaik sebelum ini? Pasukan B (keselamatan) risau murid boleh 'kumpul' syiling dengan Cuba Lagi berulang. | Hanya untuk markah yang melebihi markah terbaik sebelum ini pada kertas yang sama (percubaan pertama dapat penuh), supaya Cuba Lagi tetap menggalakkan tetapi tak boleh dikumpul berulang | **DECIDED: follow V2** (user preference \"ikut V2\", relayed by the team A monitor session; the direct prompt was aborted). V2 check: BIJAK-SPM-cloud §4.5 — `ESC::syncAnalytics` writes one practice_sessions row per attempt (`client_uuid='exam-attempt-{id}'`), PracticeRecorder pays 2 Syiling + 10 XP per mark per attempt → every submitted attempt earns. V3 already does this (D93 second part, T28). No code change; the farming vector is the answer key exposed by per-paper Kuiz paperCheck → fix in REQ-B-009 / REQ-A-003 (C2) | REQ-B-004 |
| Q6 | Teks BM Studio yang tiada dalam V2 (pasukan C, REQ-C-014): "Kembali ke draf", "Pulihkan ke draf", ayat keadaan Disemak/Diarkib, sebab arkib tetap, tajuk penolakan hantar. Senarai penuh dalam status/C3.md (r1/t13b-studio-list @ d8a6596d1). Boleh guna? | Ya, guna (sama seperti kelulusan Q1/D94) | **YES if the copy fits its context** (user, 2026-10-31): team C uses it where the wording matches the screen state; C flags any line that doesn't | REQ-C-014 |
| Q7 | Kuiz Simulasi (REQ-C-015): (a) adakah "✓ Semak" dalam Kuiz menggunakan kuota semakan percubaan (BR-07) murid yang belum melanggan? (b) Kuiz ikut kertas memaparkan jawapan + penerangan walaupun murid sedang menjawab percubaan bermarkah kertas yang sama (V2 benarkan). Benarkan atau sekat? | (a) Ya, kira seperti semakan latihan lain (ikut V2/BR-07). (b) Sekat semasa murid ada percubaan bermarkah yang terbuka pada kertas itu (elak meniru); selepas hantar, benarkan | **Follow V2** (user, 2026-10-31). (a) V2 `/simulasi/kuiz/semak` (ExamQuizController, cloud-student-mechanism §1.8) is a server check that writes no practice_sessions and has no trial-quota gate in the documented code → Kuiz \"✓ Semak\" does NOT consume BR-07 trial checks (V2 parity; recorded as inferred from V2 source). (b) Allow: per-paper Kuiz may show key + explanation even while the pupil has an open scored sitting on that paper (V2 `/simulasi/{paper}/kuiz`); B3 M1 recorded as accepted risk by user decision | REQ-C-015 |
| Q8 | Lapor soalan: satu laporan murid terus matikan soalan untuk semua (B3, REQ-B-031). | Admin semak dulu | **Admin reviews first** (user, 2026-11-01): pupil reports only a question from their own attempt/practice session; a report never auto-deactivates; admin decides in Laporan Soalan (Arkib/Tolak); per-pupil daily cap (D98) | REQ-B-031 |
| Q9 | Soalan by Chapter: kunci bab 70% (V1) atau tiada kunci (V2)? (REQ-C-021) | Ikut V2 | **Follow V2: no chapter lock** (user, 2026-11-01); 70% rule text removed (D98) | REQ-C-021 |

## Q10 (DECIDED 2026-11-01 by the user via Mandor: FOLLOW V2) (asked 2026-10-31 23:20 UTC): migrated .cloud questions after an edit (B2 MAJOR on H-A18)
Every question migrated from .cloud has rights 'unclear', no owner and no source. With the new gate (H-A18 / T33-L1), editing one blocks it at submit ("Sila nyatakan sumber soalan.") and at Terbit, and no screen can declare the source. On BASE today the same flow publishes.
Options: (1) follow V2: the migration counts as the source declaration, so editing and republishing still works and the rights gate applies to new questions only; (2) add a "Sumber & hak" field to the edit form (A2 API + C3 UI) and allow republish only after it is filled in; (3) migrated questions cannot be republished after an edit.
Lead recommendation: (1).

**Q10 answer (user, 2026-11-01, relayed by Mandor):** "v3 over engineer bab ni since v2 tak ada pun". **Follow V2**: questions migrated from .cloud can be edited, submitted and published again; the migration counts as their source declaration, so the rights gate never blocks them.
V2 check (lead, docs):
- V2 asks for the source and rights **once, at intake batch upload**: "Pengisytiharan sumber diperlukan." / "Status hak cipta diperlukan." (docs/architecture/v2-api-catalogue/learning-exam.md:1483,1501; v2-data-model.md:1235, AC-17.1).
- V2 has **no per-question source/rights gate** at submit, approve or publish. The .cloud `complianceStatus` is not carried (v2-data-model.md:3402).
- The per-question block comes from exam D10 (v2-data-model.md:1089, v2-exam-schema.md:431: "third_party/unclear cannot reach published without a recorded decision") plus T33-L1 / REQ-B-017 (H-A18).
Lead proposal (pending the user's confirmation, because it reverses exam D10):
- Keep the V2 intake batch declaration.
- Drop the per-question submit "Sila nyatakan sumber soalan." and the publish rightsStatus block for every question.
- Keep provenance carry-forward (REQ-B-037), as data integrity only.
- B3 to be told: T33-L1 / REQ-B-017 closes as a product decision, not as a fix.
**Q10b answer (user, 2026-11-01, relayed by Mandor):** "ikut v2 termasuk soalan baharu melalui V3". **DECIDED: follow V2 for every question.** The per-question source/rights gate (submit, approve, Terbit) is removed for migrated and new questions alike. Only the intake batch declaration stays. Provenance carry-forward (REQ-B-037) stays. Recorded as **D99** (supersedes exam D10) on r1/d91-decisions.

## Q11 (DECIDED 2026-11-01 by the user via Mandor: FOLLOW V2 → keep, option 1) (asked 2026-11-01 14:55 UTC): Lapor on a structured question before any attempt (REQ-B-049, B2/B3)
D98 says a pupil may report only from an attempt or practice session of their own that holds the question. The structured-question page shows Lapor before the pupil's first submit, with no attempt id, so a first report was refused (B2 MAJOR REQ-B-046). The lead allowed it: a structured question that is visible to this pupil can be reported, still with the daily cap and admin review. This is slightly wider than D98.
Options: (1) keep the lead rule, narrowed to questions the pupil can actually open (getVisible: approved, structured, level allowed); (2) strict D98: Lapor for structured questions appears only after a submit.
Lead recommendation: (1). It matches V2: Lapor is on the question page, and the admin reviews every report first.

**Q11 answer (user, 2026-11-01, relayed by Mandor):** "ikut v2". V2 check (lead):
- The .cloud docs show a student "Lapor soalan" and the admin triage (v2-parity/student.md C19, admin.md A15). They have no rule that limits Lapor to after submit.
- The .my discovery (M04-question-bank.md S14, :578-587) shows "Lapor" on `/latihan-berstruktur/{id}/jawab` next to "Jawab semua sub-soalan, kemudian klik Hantar.", so a report before submit is allowed. Under CLAUDE.md §8, .my is the reference where .cloud has nothing.
**Decision:**
- Keep option (1): a pupil may report a question they can open, including before the first submit.
- It is narrowed by `getVisible`: approved, structured, level allowed (REQ-B-049).
- The daily cap and admin review stay (D98).

## Q12 (Q12a DECIDED 2026-11-02 by the user via Mandor: KEEP 1 syiling; Q12b/Q12c lead default) (asked 2026-11-01 20:00 UTC): practice rewards in Latih Tubi / Databank / Ulang Kaji (R1-10.1)
- AC R1-10.1 (v3-bijak-spm-scope.md:137) says "no amount is assumed", but V2's PracticeRecorder.php is not in the repo.
- Pinned: Bijak SPM paper submit pays 2 syiling + 10 XP per mark in V2 (BIJAK-SPM-cloud.md:347), and ours matches.
- Not pinned:
  - the V2 practice rate;
  - the kombo step;
  - whether practice XP reaches the wallet.
- Ours today:
  - practice pays 1 syiling per correct, which matches the latest observed V1 ledger (flat_quiz_reward = 1);
  - 10 points per correct are stored on the session but NOT added to wallet XP;
  - the streak is touched once a day.
- Evidence: A1b findings (scratchpad a1b/r1-10-1-findings.md); spec branch r1/r1-10-1-practice-spec.
- **Q12a:** practice syiling rate → recommended: keep 1 per correct (the only observed amount); 2 would be assumed.
- **Q12b:** practice XP into the wallet → recommended: leave as is until V2 evidence exists (crediting it would be new, unobserved behaviour).
- **Q12c:** can the user supply V2 PracticeRecorder.php or .cloud observations to close the kombo step?
**Decision (2026-11-02, the user via Mandor):** "Kekal 1 syiling (Disyorkan)".
- **R1:** Latih Tubi, Databank and Ulang Kaji keep paying 1 syiling + 10 points per correct answer.
- **Deviation row** "R1-10.1 practice reward rate (R1 limitation)": the V2 rate is unverified. Observed V1 = 1 + 10; Bijak paper = 2 + 10; the kombo rule is undocumented.
- **AC R1-10.1** stays partial. Confirm against .cloud in R2 (KIV register).
- **Q12b** (practice XP into the wallet) was not answered separately. Lead default = leave as is (the recommendation); revisit with Q12c in R2.

## Q13 (DECIDED 2026-11-02 by the user via Mandor: FOLLOW V2): choose-N section rule line (AC-10.6, copy-approval row 39)
- **Options:**
  - V2 .cloud .blade "Jawab {N} soalan sahaja.";
  - the API/AC-06.1 [PROPOSED] text "Jawab N daripada M soalan.".
- **Decision:** "Ikut V2". Choose-N sections read **"Jawab {N} soalan sahaja."**; compulsory sections keep **"Jawab semua soalan."**.
- **Implementation:** r1/rule-line-v2 (A3); both derivations change (rules.ts + exam-core paper-model.ts).
- **Accepted known limit:** authored instructions on the PoC seed and goldens keep "daripada" (the PoC is withdrawn).
- **FE copies (m28 mock/admin):** to team C, REQ-A-035.
- **Docs:** AC-06.1 and the standards design are updated on the branch.


## Q14 (DECIDED 2026-11-02 07:09 MYT by the user, via B1 / REQ-B-059): T38 retries and the syiling/XP cap
- **Decision:** T38 merges per D94. R1 has **no cross-attempt cap** on syiling or XP.
- **Accepted known risk:** a blank Cuba Lagi plus a full self-mark can pay up to 2 × max syiling and 10 × max XP per attempt.
- **Follow-up:** a per-day or per-paper cap is a KIV R2 item (ha24 r1-kiv-r2.md). The T38 deviation row records the accepted risk (A3 docs agent, small docs branch, because T38 is already merged as BASE-112).

## Delegation note (2026-11-02 09:10 MYT, user instruction relayed by Mandor)
- **While the user is away for a few hours,** product questions are decided by this rule: **follow V2 first; if V2 has no answer, take the best approach.**
- Each such decision is recorded here with its V2 reference (file/route) or its rationale, and marked **"decided under delegation"** for the user to review later.
- Team A sends product questions to Mandor, with the V2 evidence where there is any. Mandor decides. Team A does not stop to wait for the user.
- **Not decidable under the delegation (hold; other work continues):**
  - deploy or cutover to a real server;
  - any action on live;
  - secrets;
  - deleting data or branches.

## Q15 (DECIDED UNDER DELEGATION 2026-11-02 09:10 MYT by Mandor, V2 reference): REQ-C-027 Portal Pentadbiran menu entries
- **Decision, follow V2 (.cloud):**
  - (a) Add a sub-group **"Bank Lama (Legasi)"** under Bank Soalan, containing:
    - Senarai Soalan → /admin/questions;
    - Soalan Berstruktur → /admin/structured-questions;
    - Import CSV → /admin/questions/import (this also answers REQ-B-063).
  - (b) **Kertas Soalan Guru is NOT its own sidebar item.** In V2 it is the "Kiriman Guru" tab/link inside Import & Semakan → /admin/question-submissions. If the current BS-02 screen (V2 I1 batch list) lacks that link, add a "Kiriman Guru" link there.
- **V2 evidence:** docs/discovery/cloud-student-mechanism.md:318,360,366; docs/discovery/v2-parity/admin.md:46; docs/design/v2-admin-student-pipeline.md §2.1–2.2.
- **Owner:** C1 (menu.ts + menu.test.ts). E2E-M04-54 is re-opened (test.fixme removed), and both routes are tested through the menu/link at 375/768/1280.
- **User acceptance (11:31 MYT):** a Bab is not required at Semakan or Terbitkan; a question without a Bab is not served in Latihan Bab. Admin-facing notes must say that imported questions without a Bab do not appear in Latihan Bab.
- *Decided under delegation; accepted by the user.*

## Q16 (DECIDED UNDER DELEGATION 2026-11-02 09:12 MYT by Mandor, best approach; no V2 reference): R1E2E-10, bulk Terbitkan on already-Diterbitkan rows
- **Decision:** already-Diterbitkan rows in a bulk Terbitkan are an idempotent no-op:
  - no error, and not counted in `affected`;
  - the exact per-row reason "Soalan ini sudah diterbitkan.";
  - the other rows in the batch are still processed;
  - no audit or transition entry for no-op rows.
- **Rationale:** the action is idempotent. Mandor checked docs/discovery and v2-*; V2 has no reference for this bulk flow.
- **Tests:** a mixed batch (Lulus + Diterbitkan) publishes the Lulus rows and skips the Diterbitkan rows with the reason; an all-Diterbitkan batch gives affected 0 and no error.
- **Response shape (Mandor, under delegation, 09:28 MYT; option 2):** a new optional `skipped[]: {id, reason}` field in the bulk-action response. No-op rows go in `skipped[]`, **not** `failed[]`, so there is no error. Old clients ignore the new field.
- **Owner:** A2 (r1/r1e2e10-bulk-publish-noop). The C FE shows skipped[] as info (REQ-A-040). B4 re-runs S2e after the merge.
- *Decided under delegation; for user review.*

## Q17 (DECIDED UNDER DELEGATION 2026-11-02 10:10 MYT by Mandor; **ACCEPTED BY THE USER 2026-11-02 11:31 MYT**, relayed by the team B lead, REQ-B-075): REQ-B-071, is a Bab required at "Hantar untuk Semakan"?
- **Decision: NO.** A Bab (chapter) is not required when submitting to review.
- **V2 evidence:**
  - In .cloud the Bab is only a tag "untuk penapisan dan pelaporan" (docs/discovery/cloud-student-mechanism.md:338).
  - Chapterless questions exist and are just not counted in Soalan by Chapter (:224).
  - AC-03.2 (docs/design/v2-admin-student-pipeline.md:153): DSKP completeness (curriculum nodes) is checked **at Terbitkan/approval** with a .cloud-style issue list, not at submit to review.
- **Fix:**
  - A2 removes the chapterId condition from the H-A18 submit-to-review gate, and keeps the DSKP refusal at Terbitkan per AC-03.2. Branch r1/reqb071-bab-submit.
  - Spec updates: lifecycle-bulk and gate-facts (A2); chain-intake-to-pupil 3a (A3); release notes r1-nota-keluaran.md:20/72 (A3).
  - New tests: CSV/PDF rows without a Bab enter Semakan; Terbitkan without a curriculum node is refused with the issue list.
- **Follow-up (Mandor, 10:13 MYT, under delegation):** drop the Bab requirement at **Terbitkan/approve** too. Keep ONLY the AC-03.2 DSKP check: curriculum node + TP/cognitive level per leaf part (+ kertas for SPM), with the .cloud-style issue list.
  - If the node sits under a Bab in the curriculum tree, chapterId is derived/filled from the node (or read through it), so Soalan by Chapter / Peta Belajar still count the question.
  - Tests: with a node but no manual chapterId → passes; with no node → refused with the issue list.
  - **Derivation rule (lead, 10:46 MYT, implementation detail of the above):** chapterId is derived ONLY via `chapters.dskp_code = <unit code>` (same subject + level), only on a unique match, and never overwriting a manual Bab. There is no FK from a curriculum node to a chapter (curriculum.prisma:159-161; dskp_code :99 is the intended hook). With today's seed dskp_code is null, so nothing is derived: a chapterless approved question is simply not in Latihan Bab (V2 :224). No heuristics.
- **FE:** the bulk UI must show the per-row refusal reason from failed[]. A bulk 200 with affected 0 and no reason is not acceptable (REQ-A-041 to C).
- *Decided under delegation; for user review.*

## Q18 (**SUPERSEDED BY THE USER 2026-11-02 12:45 MYT**, relayed by team B in REQ-B-077; originally decided under delegation 12:28 MYT by Mandor): REQ-B-074, does a pupil's past sitting keep a taken-down question image?
- **Context:** REQ-B-074 (45a75f68) keeps taken-down images for ANY exam_attempts row on the paper (question-image-access.ts:104), as paperHeld, including submitted or abandoned ones and rights takedowns. No V2 reference exists for this behaviour, so it was decided on the best approach. Evidence: AC-17.3 (a rights complaint pulls every question from the source; "US-14 rules apply"), AC-14.1 (no longer served within 60 s), NFR-05 (copyright policy).
- **Decision (option B, refined):**
  1. **Rights takedown** (source_takedown / takedown_at): the image is NOT served in a submitted or abandoned attempt (history review). The UI shows a neutral placeholder; question text and historical marks remain.
  2. **An attempt in progress** keeps the image until it ends (consistent with known limit 4.1: a takedown does not cut a running attempt). After it ends, rule 1 applies.
  3. **Ordinary takedown** (not rights): the existing sitting exception stays (option A); history review keeps the image.
- **Mandatory tests:** (a) rights takedown + submitted → no image; (b) rights takedown + in progress → image, gone after submit; (c) ordinary takedown + submitted → image.
- **Owner:** A1b on r1/reqb074-takedown-lows (with the stale DSG spec fix). FE placeholder → team C (REQ-A-046).
- *Decided under delegation; for user review. To be added to the user decision pack.*
- **USER DECISION 12:45 MYT (REQ-B-077, overrides the delegated rule above):** takedown here is for **quality**, not a legal/copyright removal. A pupil with a sitting (any sitting) keeps a taken-down image, and a running sitting keeps its text. Accepted for R1, no strict change. This is the behaviour of REQ-B-074 @45a75f68 (BASE-195). The rights-vs-ordinary split is **not built**; REQ-A-046 (FE placeholder) is withdrawn. REQ-B-076 stays as a normal-priority fix (A1b, r1/reqb076-live-takedown).

## Q19 (USER DECISION 2026-11-02 ~17:00 MYT, relayed by Mandor): frontend ratchet raises for live
- **Approved by the user:** (1) raise the ds-admin / ds-debt eslint ratchet baselines with `--force` (about 500 rows of new R1 frontend debt; owner approval per frontend-dev-guide §2.3); (2) raise the demo bundle budget (entry js 340,000 → 383,000 bytes; all js 10.0M → 11.578M; gzip 2.846M → 3.338M).
- Merged as BASE-209 3acc2bc1 (r1/b1-reqb081-frontend-green @3c65fff5).
- **KIV R2 (2 items):** pay down the ds-admin/ds-debt debt back to the old baselines (the per-branch justification table from A4 is the pay-down list); reduce the bundle size (`sideEffects:false`, contract tree-shaking).

## Q20 (USER DECISION 2026-11-02 ~17:10 MYT, relayed by Mandor): integrator role
- **Lane A1 (team A lead) holds the B1 Integrator role** on the owner's instruction. Mandor only monitors. The procedure is docs/team/handover/team-b.md §1–2: merge only the exact reviewed SHA (a B2 verdict, or A4/A1b standing in for B2, recorded); merge --no-ff in an isolated worktree on the latest base; gate on the merge result with real output; push only if the base is unchanged; one BASE-n row in MERGE-LOG.md + status/B1.md.
- **The owner freeze still applies:** until release, docs only + owner-approved items. Other code (REQ-A-051 approve-gate, REQ-A-040/041, …) is not merged without the owner's "ya".
- After every code merge, B4/B run CI + E2E on the new candidate. No deploy, no server, no secrets.

## Q21 (USER DECISION 2026-11-02 ~18:2x MYT, relayed by Mandor): G6 deploy confirmation
- **User, exact words: "Proceed deploy".** This is the owner's G6 confirmation for R1.
- **Conditions (owner-set, still binding):**
  1. CI must be fully green first: e2e @api in run 41423614907 and the api verify re-run of 41417922017 (the solo.spec flake) are still running. Deploy only after both are green.
  2. The deploy is done by a HUMAN operator following docs/ops/r1-operator-checklist.md + docs/ops/r1-runbook.md, on candidate **BASE-212 62872d96**. Teams A/B do not touch any server.
  3. Before migrating, the operator confirms REQ-B-080 (THROTTLE_GLOBAL_PER_MINUTE, TRUST_PROXY_HOPS) and a full backup + restore test.
- **The M02 default passwords** are rotated on live by the owner. Signoff 6.8 stays unticked until that rotation is explicitly confirmed.
- **Pack items the user has not answered** (OCR AC-R1-14.2, limits 4.1–4.4, Q15/Q16 review, copy row 42) are marked **"deploy diteruskan atas arahan pemilik; penerimaan bertulis masih tertunggak"**, NOT accepted.
- Pre-live production DB checks from B3 stand (demo.test users = 0; the IC-hash pattern → owner decides).

## Q22 (USER DECISION 2026-11-02 ~19:3x MYT, relayed by Mandor): CI e2e@api failures (REQ-A-057)
- **The user chose (a): FIX ALL.** This covers the fix units needed for a fully green CI under the freeze: (1) the A3 e2e-profile seed step (D72 demo schools; groups 1–3); (2) the stale specs spm-hub "Semua Tahap" + CC-01 "Langsung" (design cites); (3) D-02 (Darjah 4 → Tingkatan 4, per A4's classification); (4) B4's fix for the 2 bijak specs (A1b reviews).
- The Kontrak fix REQ-B-090 was approved under the freeze and merged as **BASE-213 2fabf472** (r1/b1-kontrak-tabs-fix @881a0b06).
- Each unit: reviewer + A1 gate → Mandor pushes. Mandor dispatches frontend CI (verify + e2e@api) once, on the final candidate (no mid-way CI except to prove the bijak root cause). The deploy stays blocked until that CI is green (Q21).

## Q20 update (USER DECISION, REQ-B-102, relayed by Mandor 2026-11-02 ~22:30 MYT): integrator role back to team B
- **The B1 Integrator role is back with team B** (REQ-B-102 changes Q20). **Team A stops merging; A1 is no longer the integrator.** Team B merged BASE-218..221 (tip 43fef051) and dispatched frontend CI 41462039389 (api_ref=43fef051).
- Team A continues as a developer/reviewer lane. Docs updates go to B (B1 merges).

## Q23 (USER DECISIONS, 3 Nov ~00:0x MYT, relayed by Mandor)
1. **Unencrypted disk: "Terima + mitigasi"** (option (a) of REQ-A-063). Mitigations: the raw dump is deleted immediately after it is loaded; root-only access; no other copies kept. A3 adds these steps to the runbook / operator checklist (docs).
2. **Go-live: "Esok siang (3 Nov)"**, with the `.cloud` owner and the dump operator (a PC with no AI agent) present at the same time. The owner sets the exact time; team B prepares the runsheet.
3. **REQ-B-109: "fix sekarang utk go live!"** = the owner APPROVES the fix entering R1 under the freeze. A4 is priority #1 (red-first + 3 widths on the CI config); A1b reviews; then team B merges (B1) + a full CI with api_ref = the new SHA. The same pattern on other PUPIL pages (A2 sweep: MissionQuizPage) is fixed in the same unit.
4. **OCR: "Setuju mock, uji OCR kemudian"** = written acceptance of AC-R1-14.2 with mock OCR (an exception to D87 U5), recorded as a user decision.
- **Still pending from the user:** limits 4.1–4.4, the Q15/Q16 review, copy row 42, M02 after deploy.

## Q24 (USER DECISION 3 Nov ~00:3x MYT, asked by Mandor): REQ-B-109 coverage
- The chapter-quiz fix (r1/a4-chapter-quiz-id-fix @fd073ecd, A2 Approve) enters R1 **with** an e2e-profile-only seed that links existing approved questions to chapters, plus the e2e spec, in the same unit, so CI covers the chapter quiz. Built tonight by A4 (isolated worktree; registry-boot + seed owner tests green). Not poc/prod seeds.

## Q25 (USER DECISION 3 Nov ~00:3x MYT, asked by Mandor): PKSK admin id types (REQ-A-064)
- Question asked: "cipta/sunting soalan PKSK dan pemberian akses PKSK gagal (422) ... Perlu dibaiki sebelum go-live esok?" Answer: **"Ya, baiki sebelum go-live"**. PkskQuestionFormPage.vue:198/208 pkskDomainId, PkskAccessPage.vue:140-141 userId/packageId → string (wireId); bulk ids string[]. Enters R1 under the freeze although PKSK is KIV in the R1 scope doc, because the admin menu is live. Built by A3 (r1/pksk-id-types), reviewed by A1b/A2, merged by team B (B1) + a new CI.

## Q26 (USER DECISION 3 Nov ~00:4x MYT, asked by Mandor): Latih Tubi SPM trial exhausted mid-quiz
- Finding (A3 production-bundle hunt): a 402 TRIAL_EXHAUSTED mid-quiz shows no message; the question stays unmarked. Answer: **"Papar mesej + pautan langgan"**. On 402 TRIAL_EXHAUSTED mid-quiz show that the free trial is used up plus "Langgan untuk akses tanpa had" → /pricing (existing V2 M05 copy, docs/discovery/M05-practice.md:132); the current question is not scored wrong. Enters R1; built by A3 with tests; team B merges + CI.

## Q27 (USER DECISION 3 Nov ~00:3x MYT, asked by the team B lead; REQ-B-114): who fixes PKSK
- Answer: **"Ya, Team B baiki"**. Team B fixes the REQ-A-064 PKSK id items on `r1/b1-id-class-pksk` in the same batch. This supersedes the builder in Q25 (A3); A3 stops `r1/pksk-id-types` and acts as tester. Team A (A2) reviews B's head statically on request.

## Q28 (USER DECISION 3 Nov ~01:10 MYT, asked by Mandor): batch order and team C's unfinished work
- (1) Merge order: **"Merge B dulu"**. Team B merges its own approved units now (`r1/b1-id-class-pupil` @ c4f59bc8, `r1/b1-id-class-pksk` @ fc05ab40, m15 bulkHadiah fixed or KIV). Team A add-ons go on top as each is READY: docs `r1/reqb112-docs` @ db2b8e8f, Q26 `r1/trial-exhausted-midquiz`, A4 chapter seed/spec. Then ONE frontend+api dispatch with api_ref = the final SHA.
- (2) Team C (no R1 activity since 2 Nov 16:55 MYT): **"minta team A dan B ambil alih kerja2 yg belum selesai"**. Teams A and B take over team C's unfinished work. Mandor posts a triaged list (REQ-A-068) with owner per item: R1-blocking items now; the rest stays after release under the owner freeze. Team C: if you return, post at once what you hold so nothing is done twice.

## Q29 (USER DECISION 3 Nov ~01:30 MYT, asked by Mandor): deploy ASAP
- (1) Scope: **"Tunggu semua"**. The final candidate includes docs `r1/reqb112-docs` @ 72ec1e81, Q26 complete with its e2e fixture + spec, and the A4 chapter seed/spec. Nothing is cut. ETA all READY ~02:15 MYT.
- (2) Deploy timing: **"Malam ini sebaik CI hijau"**. The user wants the deploy tonight as soon as the final CI (frontend.yml with api_ref = final SHA, plus api.yml) is green, expected ~03:00 MYT. Operator, .cloud owner and dump operator (PC with no AI agent) to be ready from ~02:30 MYT. Deploy stays human-only, per docs/ops/r1-operator-checklist.md (table A can start now; table B after CI green; B0 backup right before migrate).
- Q29 item (2) SUPERSEDED 3 Nov 01:17 MYT by the user's answer to the team B lead (REQ-B-121, "Tangguh ke malam"): go-live is the night of 3 Nov; the owner sets T0; window estimated T0 + 4:20. Code work (final batch + one CI) continues tonight.

## Q30 (USER DECISION 3 Nov ~01:30 MYT, asked by Mandor): who merges the final batch
- Answer: **"Team A merge"**. Supersedes REQ-B-102 / Q20 for the remaining R1 merges. From now on team A is integrator: A1 prepares the merges and runs the B1 gate (vue-tsc after vite build, api tsc after prisma generate, eslint on changed files, unit + DB specs); Mandor pushes to `feature/v3-bijak-r1` (only if origin equals the merge parent) and dispatches ONE frontend.yml with `api_ref` = final SHA (step 4 checked). **Team B: please stop merging and pushing to the base now;** B2 review verdicts still count and are required before merge; B4/B3 test evidence welcome. Final batch: one combined team A code head (Q26 + chapter seed, A3), docs `r1/reqb112-docs` (A2), runsheet `r1/b1-go-live-runsheet` (B1 owns the content; team A merges it when B2 approves). One push.
