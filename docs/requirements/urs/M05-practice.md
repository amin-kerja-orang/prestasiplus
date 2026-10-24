# M05 — Practice & Drills (Latih Tubi) and User-portal Home — User Requirements Specification

## 0. Document control

| Field | Value |
|---|---|
| Document | URS — M05 Practice & Drills (Latih Tubi) + `/dashboard` |
| Version | 1.16 |
| Date | 2026-09-25 |
| Status | Approved (G1). v1.2 applied the cross-module logic review (XL) fixes and D11/D12; v1.3 adds the M06 session list read, the dataset spec and the contributed anchors; v1.4 applies XL round 2 (query names, stale notes, no `dskpSpId` on anchors); v1.5 applies XL-40 (Q-DIFFICULTY, Q-PRACTICE); v1.6 applies XL batch 2 (answer-log dataset, teacher-assigned sessions, M09 content source, `addAnswer` hook); v1.7 applies the round-2 Minors (script types, Q4 teacher preview, empty mission pool, T5 placement); v1.8 applies the round-3 Minors (class key, BR-M10-35 citation, references); v1.9 is a wording fix (opaque generated session ids) and records the M14 v1.2 requests as pending XL3; v1.10 applies XL batch 3 (accuracy pin, M14 wallet handover, M12 segment store, M16/M17/M18 requests); v1.11 follows the M17 v1.4 session placement; v1.12 applies XL batch 3 round 2 (8765/2700 as M18 display data, mission sessions, `pksk` mode and its count policy); v1.13 follows the M10 v1.9 session placement; v1.14 applies the M10 v1.10 class swap (SQ-13 closed); v1.15 pins the exact T4 session lists of M10 v1.11; v1.16 applies the corrected lists of M10 v1.12 (R5-01); no approved live behaviour changes. Live-session states LS-1…LS-12 pending the user's practice-session approval. |
| Author | product-analyst (agent), with solution-architect input for the data rules |
| Source discovery | [M05-practice.md](../../discovery/M05-practice.md) (§9 LS-1…LS-12, defects D-1…D-16, Q-M05-1…11, Appendices A–C), element inventory [`inventory/M05/`](../../discovery/inventory/M05/) (`S1…S15-*.json` except S7, `SHU-user-shell.json`, `_crawl.json`, `_summary.md`, `_practice-data.json`), raw page sources `inventory/_raw/M05/work/*.html` (GET only, used for S7 and for markup details), global shell [00-global-ui.md](../../discovery/00-global-ui.md), screenshots `docs/discovery/img/M05/` (46) |
| Companion SRS | [srs/M05-practice.md](../srs/M05-practice.md) |
| Related | [urs/M03-curriculum.md](M03-curriculum.md) (subjects, levels, DSKP chapters, legacy topics, practice hand-off), [urs/M04-question-bank.md](M04-question-bank.md) (questions, report modal S14 — mounted by M05, SRS SQ-2), [urs/M01-authentication.md](M01-authentication.md) (seed accounts, 404 page, auth guard). M14 (coins, points, XP, streak pills, badges), M10 v1.5 (teacher missions, remedial tests, question sets; M05 owns their student side), M02 v1.11 (users and schools), M04 v1.9 (question fields), M09 (articles, banners), M19 (`/pricing`), M06 (SPM practice) are referenced for the rules they own. |

**Change log**

| Version | Date | Change |
|---|---|---|
| 1.3 | 2026-09-25 | **Revision history — v1.3, cross-module contracts.** M06 §13 Q8: new session list read by mode (SRS §7 #23), which serves M06 S10 `/spm/history` (M06 #11); new AC-M05-36.5. Architecture X-7: SRS §6.14 dataset spec for the M05 stores (all small seeded tables, not virtual). X-8: SRS §6.15 lists the 65 M05 practice anchors (ids 600001–600065) contributed to M04 through `questions.contributeAnchors`, with their count cells. No live behaviour changes; 163 Functions; coverage 860/860. |
| 1.4 | 2026-09-25 | **Revision history — v1.4, cross-module review round 2.** XL-24/25: stale notes removed (the #15 structured-sets alias note; the `pelajarmaju` grade note — M01 now lists grade 1, OQ-18 closed). XL-36: every count definition now cites the M04 SRS §4.1 named queries (Q-ELIGIBLE(subject), Q-ACTIVE(subject), Q-ACTIVE(level), Q-ACTIVE + Q-PKSK, Q-ELIGIBLE + Q-PKSK, Q-ARCHIVED-ACTIVE); rows with no named query say so. M08 claim on `dskpSpId`: **M05 anchors 600001–600065 carry no `dskpSpId` (null)**; M08 drops its 9101–9108 claim (SRS §6.15). No live behaviour changes; 163 Functions; coverage 860/860. |
| 1.5 | 2026-09-25 | **Revision history — v1.5, cross-module review round 3.** XL-40 (Major): the S1 "📈 Tahap Kesukaran" rows now cite M04 SRS §4.1 **Q-DIFFICULTY** (Q-ACTIVE + Q-PKSK by difficulty: 39,694 / 47,138 / 33,720 / 9,600 / 0, footer 130,152); the earlier definition left out the 763 PKSK rows and summed to 129,389. S3/S4/S5 pre-start counts cite **Q-PRACTICE**. AC-M05-10.3 now asserts the observed figures. No live behaviour changes; 163 Functions; coverage 860/860. |
| 1.6 | 2026-09-26 | **Revision history — v1.6, cross-module logic review batch 2** (`docs/qa/audit/cross-module-logic-M08-M11.md`) with the Delivery Lead decisions. **XL2-01 (Major):** the answer log and the practice sessions are D11 virtual datasets with the live totals (478,499 answers, 32,122 sessions, 79.8 % — M08; monitoring segment 472,371 with the M11 weekly and period cells); per-user records are anchors inside the totals; M08/M11 count them only through named queries (SRS §6.14; new FN-9.3.7, US-41). The two totals are a subset relation, not a conflict; the leaderboard coins cannot come from the log and stay M08 display data. **XL2-08 (Major):** M05 owns the student side of teacher missions, remedial tests and question sets — the read endpoints, `/remedial/{id}`, the mission and question-set quiz pages, the session modes `mission`, `remedial`, `question_set` with their link fields, and the mission reward 3 syiling per correct answer (FN-8.1.4/8.1.5, 8.2.3/8.2.4, new FT-8.4, US-40; LS-12 PROPOSED/provisional). **XL2-30 (Minor):** articles and banners are read from M09, no local seed. **XR-M13-03b:** test hook `mock.addAnswer`. No observed M05 behaviour changes; 167 Functions; coverage 860/860. |
| 1.7 | 2026-09-26 | **Revision history — v1.7, XL batch 2 round 2** (`docs/qa/audit/cross-module-logic-M08-M11.md` §R2.4, Minors). XL2-37: the question script type uses the M04 v1.8 values `rumi`, `arab`, `jawi`, `mixed`. XL2-40: `/remedial/{id}` opened by the test's teacher or by an admin shows a read-only preview (PROPOSED, provisional; FN-8.1.5, AC-31.4). XL2-41: a mission whose question pool is empty cannot start — the existing "Soalan tidak mencukupi." message (FN-8.2.4, AC-32.5). XL2-46: the T5 class members with sessions are grade-11 students of monitoring schools (SRS §6.14.1). References: M02 v1.10, M04 v1.8, M10 v1.5. No observed behaviour changes; 167 Functions; coverage 860/860. |
| 1.8 | 2026-09-26 | **Revision history — v1.8, XL round 3 Minors.** XL2-44: the class query keys on the pair (`classroomKind`, `classroomId`), as M10 v1.5. XL2-47: the mission start cites M10 BR-M10-35 (mission question pool); Related rows cite M02 v1.11 and M04 v1.9. No behaviour changes; 167 Functions; coverage 860/860. |
| 1.9 | 2026-09-26 | **Revision history — v1.9, wording (architecture overview v1.4 X-12).** Generated session ids are opaque (no fixed "g1"…"g32096" range). The M14 v1.2 requests to M05 (wallet repository handover, designed wallets pelajar 370/916 and pelajarmaju 267/432, `mock.addSession` hook) are recorded as pending XL batch 3 (§7.3), not applied. No behaviour changes; 167 Functions; coverage 860/860. |
| 1.10 | 2026-09-27 | **Revision history — v1.10, cross-module logic review batch 3** (`docs/qa/audit/cross-module-logic-M12-M18.md`) with the Delivery Lead decisions. **XL3-01:** correct answers raised so that live's 82.9 % (correct ÷ answered of the active pupils, M17) holds — active pupils 395,873 correct, whole log 396,391 (82.8 %); new session-mean accuracy query for M08. **XL3-03:** the wallet, streak, daily quests and badges are M14's repository; session completion calls M14; designed wallets pelajar 370 / 916 and pelajarmaju 267 / 432; `mock.addSession` replaces `addSessions`. **XL3-04:** the M12 Kirkpatrick segment is a separate M05 aggregate store outside the 32,122 sessions and the answer log. **XL3-05:** answers without a session for pupils 3201–3215 (8880, 6,563) and pupil 2022 (6); nullable session subject ("Latihan Bebas"); per-pupil subject accuracy set and mastery anchors (M18); weekly ranking, structured-attempt and activity pins (M16, M17). One request does not fit (8765 practice sessions, OQ-20). No observed M05 screen changes; 167 Functions; coverage 860/860. |
| 1.11 | 2026-09-27 | **Revision history — v1.11, M17 v1.4 session placement** (XR-M17-02; totals unchanged). The 25 Sep sessions of the M17 week pupils are pinned as M17 §6.7 B: pupil 2016 (W5) 4 sessions of 40 answers (its whole week); pupils 2017, 2018 and 2019 at 8106 answer in SPM modes, so the weekly ranking leaves them out (2018 and 2019: 6 sessions each on 25 Sep; weeks 159 answers, 125 correct); pupil 2022's 6 answers without a session are dated 4 May 2026. Canonical ids 2013–2016 = W2–W5. No M05 screen changes; 167 Functions; coverage 860/860. |
| 1.12 | 2026-09-27 | **Revision history — v1.12, XL batch 3 round 2** (Delivery Lead decisions). R2-02: the 8765 and 2700 practice-session figures are M18 documented display values, not M05 data (OQ-20 closed; the Kirkpatrick store keeps its T4/T5 scope). R2-03: 8 existing September sessions of class-813 pupils are teacher missions (7103 × 5 on 8 Sep, 7104 × 3 on 22 Sep). R2-04: new session mode `pksk` for M07 PKSK practice, completed outside the quiz flow. R2-10: `pksk` counts as a practice mode (M08), as "Kuiz" (M11), in every all-mode count (M17) and is labelled "PKSK" on the history pages. Canonical account 4 is at fixture school 900004 (M02 v1.16), outside the active-pupil population. No observed M05 screen changes; 167 Functions; coverage 860/860. |
| 1.13 | 2026-09-27 | **Revision history — v1.13, M10 v1.9 session placement (XL3 R3-01).** The 11 T4-class sessions belong to 4 no-school T4-pool pupils who stay in the T4 classes (classes 5/9: the "4 sesi · 60 soalan" and "3 sesi · 30 soalan" pupils; classes 6/10: two pupils with 2 sessions each). Two T5 leavers carry sessions identical to the 2 answering 8765 class members; the other 30 leavers and the 20 swapped-out pool pupils hold no session. T4 stays 11 sessions at 63.9 % and T5 29,971 at 79.7 %; no total changes. One M08 class figure does not fit this placement (SRS SQ-13). No M05 screen changes; 167 Functions; coverage 860/860. |
| 1.14 | 2026-09-27 | **Revision history — v1.14, SQ-13 decided (M10 v1.10): classes swapped.** The "4 sesi · 60 soalan" pupil is in classes 6/10 (49 / 60 = 81.7 %); classes 5/9 hold the "3 sesi · 30 soalan" pupil and the two pupils with 2 sessions each (7 sessions, 39 / 76 = 51.3 %). T4 stays 11 sessions at 63.9 %; no total changes. No M05 screen changes; 167 Functions; coverage 860/860. |
| 1.15 | 2026-09-27 | **Revision history — v1.15, M10 v1.11 exact T4 session lists (R4-01).** The 11 T4 sessions are now pinned session by session (correct / questions): H1 (6/10) 0/1, 1/1, 5/7, 43/51; H2 (5/9) 10/10, 9/10, 9/10; H3 (5/9) 3/5, 7/7; H4 (5/9) 1/14, 0/20. They give classes 5/9 39 / 76 = 51.3 %, classes 6/10 49 / 60 = 81.7 %, the top rows 64 % and 93.3 % and the T4 session mean 63.9 %. M08 v1.10 "Murid Terbaik" = the session mean per pupil, ties by user id: the 10 observed T5 top pupils have only fully correct sessions (100 %) with user ids ascending in the live order, and no other T5 pupil with 3 or more sessions reaches 100 %. No total changes; 167 Functions; coverage 860/860. |
| 1.16 | 2026-09-27 | **Revision history — v1.16, XL3 round 5 (R5-01; M10 v1.12).** Corrected T4 session lists (correct / questions): H1 (6/10) 0/7, 5/7, 11/13, 33/33; H2 (5/9) 10/10, 9/10, 9/10; H3 (5/9) 4/5, 4/6; H4 (5/9) 3/15, 0/20. The checks now compare the strings M08 displays: "64%", "93.3%", "51.3%", "81.7%" and "63.9%". No total changes; 167 Functions; coverage 860/860. |
| 1.2 | 2026-09-25 | **Revision history — v1.2, cross-module logic review** (`docs/qa/audit/cross-module-logic-M01-M07.md`) and decisions D11/D12. XL-02: counts restated per D11 — the M04 dataset reports the live totals, and the live figures reconcile under distinct definitions (card = approved Σ 128,989; "Statistik Subjek" = all Σ 129,389; Total 130,152 incl. 763 PKSK; Approved 129,752), so DV-05 is withdrawn; M05 fixture questions are anchors inside the dataset; chapter totals are the live ones (e.g. MATH D1 Bab 1 = 464). XL-03/04/10: one session and answer schema, a session-completion write contract and the reusable quiz component contract, owned by M05 (D12), specified in the SRS; M06 adopts them. XL-05: integer user ids (canonical ids 1–4). XL-16: trial rule vs school subscriptions and complimentary packages recorded as INFERRED interaction, OQ-17. XL-19: ineligible questions (M04 BR-M04-03) are not served or counted by revision. XL-20: DV-01 wording = header title from the route, no subtitle (DV-SH-03). XL-23: M05-only fields moved to M05-owned records. XL-25/27: stale references refreshed (chapter ids 1 and 3 kept by M03 v1.4), defaults for users without seed rows. FN-1.7.1, 1.7.2, 1.7.6, 2.1.4, 2.2.1, 4.1.1, 4.2.1, 4.2.14, 5.1.1, 5.3.2, 8.1.1, 9.3.1–9.3.3 and the ACs of §4 updated; 163 Functions; coverage 860/860. |
| 1.1 | 2026-09-25 | **Revision history — v1.1, audit fixes** (`docs/qa/audit/M05-audit.md`, round 1 FAIL 0 Critical / 5 Major / 10 Minor) with the Delivery Lead decisions recorded in §7.1. AUD-01: the invented 19 Feb session removed; the admin seed mirrors live (S8 4 sessions / 4m, S9 4 / 84 / 21.8% / 26, S12 BM 46/94; the 35 answers of 19/02 have no session); DV-05 narrowed to the one real contradiction (PM 15014 vs 15414). AUD-02: the admin sessions are the M06 SPM sessions (2 "Tahun Lepas", 2 "Latih Tubi", the 14/40 one is Sejarah), badge "Latihan" as live, the invented "SPM" badge removed, one session store shared with M06. AUD-03: S15 source rewritten from observation ("Belum mula" everywhere; SPM answers do not count), rule UNVERIFIED. AUD-04: new FT-M05-5.3 for `/latihan-berstruktur?scope=spm[&track=bahasa]` (owned by M05, mapped to the M06 inventory by cross-reference) and the `/jawab?scope=spm` entry. AUD-05: DV-04 withdrawn — live bank counts replicated. DV-03 `?level=` part withdrawn (ignored as live). DV-06 withdrawn (streak as live, OQ-14 to M14). AUD-06…15: report failure text under "Terima Kasih!", S7 failed-check and "Lapor Soalan" order, unknown `period` → no active chip (OBSERVED), malformed `bulan` → current month (new DV-M05-13), KBAT bands OBSERVED, min–max sparkline, DV-11 list completed and E2E aligned, PROPOSED COPY labels and provisional ACs/E2E, integer ids (M03 v1.3). Discovery §2.1/§2.7/§2.9/§2.10/§2.11/§2.15 corrected. 9 epics, 30 features, 163 Functions; coverage 860/860. |
| 1.0 | 2026-09-25 | First issue under D7 (fidelity), D8 (proven completeness), D9 (deviation rule) and D10 (accessibility and deliberate limits replicate live). §3 and §6 are generated by script from the inventory JSON (860/860 content elements covered; S7 mapped to the source narrative). Deviations DV-M05-01…12 applied under D9; discovery defects D-7, D-10, D-12, D-14, D-15 and D-16 are replicated as live. |

**Conventions** (as M01–M04)
- Quoted UI copy is the exact live text **as displayed**. Where CSS changes the casing, the displayed form is stated ("displayed upper-case"), e.g. S9 card labels "Jumlah Sesi" → "JUMLAH SESI", S11 "Ringkasan Keseluruhan" → "RINGKASAN KESELURUHAN", S1 quest chips "Mudah" → "MUDAH". English appears only where the live site uses it (Laravel pager "« Previous", "Next »", "Showing … results"; history dates "19 May 2026, 03:49"; "Soalan by Chapter", "Progressive Unlock", "(On Track)", "assign", "Failed to load revision quiz").
- **OBSERVED** = seen on the live site (walkthrough, inventory state, page markup or script). **SOURCE-DERIVED** = taken from live page source that was fetched with GET but never executed (S7 `/practice/revision/{CODE}`: its template and script are captured, but running it would start a session). **INFERRED** = the live site does it but it could not be observed read-only (every practice session, every POST, rules computed on the server). For INFERRED behaviour the most likely live behaviour is specified; no new UX is invented.
- **UNVERIFIED COPY** = text shown in a state that could not be captured. The prototype uses the placeholder in SRS §8 until verified (§9 OQ-1).
- **PROPOSED COPY** = new BM text that the live site does not have (a D9 fix or a placeholder for an unobserved state). Every PROPOSED COPY string is listed in §9 OQ-16 for the Delivery Lead to report at G1.
- **Provisional** (on ACs and E2E) = the behaviour is INFERRED for an unobserved live-session state; the check is replaced when the LS state is observed.
- **LS-n** = a live-session state from discovery §9 that needs the user's approval to observe (§5.1, §9 OQ-1).
- **DV-M05-nn** = a fidelity deviation decided under rule D9 (§7). Anything not listed there must match the live site.
- **Personal data:** the live evidence is the system account "Admin PRESTASI+" (own stats only). S10 teacher and school names were masked in discovery; the rebuild uses fictitious authors and schools. All seed accounts are fictitious (`@demo.test`).

---

## 1. Overview

M05 is the student-facing practice engine plus the user-portal home page (`/dashboard`). It has **four practice entry paths** and a set of tracking pages:

1. **Latih Tubi rawak (random drill):** `/practice` (subject list) → `/practice/{CODE}` (choose level, difficulty and number of questions) → `/practice/{CODE}/quiz?level=&difficulty=&count=`.
2. **Soalan by Chapter:** `/practice/chapter` → `/practice/chapter/{CODE}?level=` → `/practice/chapter/{CODE}/{chapterId}/quiz?count=5|10|15|20`. The next chapter unlocks only when the current one is complete and scored at least 70 %.
3. **Soalan Aku Salah (revision):** `/practice/revision` → `/practice/revision/{CODE}` (up to 20 previously-wrong questions in an in-page quiz; a correct answer removes the question from the list).
4. **Soalan Berstruktur (structured, Kertas 2):** `/latihan-berstruktur` → `/latihan-berstruktur/{id}/jawab`. The same route has SPM variants, `?scope=spm` ("Subjektif SPM") and `?scope=spm&track=bahasa` ("Tracking A Bahasa"), reached from M06; M05 owns the route and its answer page (FT-M05-5.3).

Tracking: progress (`/practice/progress`), history (`/practice/history`), corrections (`/pembetulan`), mastery (`/penguasaan`), remedial tests (`/remedial/saya`), teacher missions (`/misi-harian`) and SPM grade targets (`/target-spm`). The dashboard gathers a greeting, the free-trial status (0/50), an announcement carousel, a streak ("Kombo") reminder, gamification counters, 10 built-in daily quests with a daily chest, quick links, articles, subject cards, level pills, platform statistics and a difficulty chart.

The live pages are server-rendered (Laravel Blade + Alpine.js); the only live JSON calls are the practice-session calls (start revision quiz, check answer, submit quiz) and the question report. The rebuild replicates the live behaviour exactly (D7) as a front-end prototype with dummy data and a mock service layer (D1, D2), with the D9 fixes of §7.

**Routes covered** (`docs/TRACKER.md` §4 M05 plus the routes found by the crawl):

| # | Route | Screen (shell header title / subtitle, rebuild) | Tab title (exact, as live) |
|---|---|---|---|
| S1 | `/dashboard` | "Dashboard" / "Selamat datang kembali" | "Dashboard - PRESTASIPLUS" |
| S2 | `/practice` (`?subject=`, `?level=`, `?topic_id=` — DV-M05-03) | "Latih Tubi" / "Pilih subjek dan mula berlatih" | "Latih Tubi - PRESTASIPLUS" |
| S3 | `/practice/{CODE}` | "Latih Tubi", no subtitle (DV-M05-01; live "Dashboard" / "Selamat datang kembali") | "{subject name} - Latihan" |
| — | `/practice/{CODE}/quiz?level=&difficulty=&count=` | random-drill quiz (LS-1, LS-2; INFERRED) | UNVERIFIED |
| — | `/practice/{CODE}/subjektif` | subjective drill (LS-6; never offered on live; not built) | — |
| S4 | `/practice/chapter` | "Soalan by Chapter" / "Latihan tersusun ikut bab buku teks dan DSKP" | "Soalan by Chapter - PRESTASIPLUS" |
| S5 | `/practice/chapter/{CODE}` (`?level=`) | "Soalan by Chapter" / "{subject name}" | "Chapter {subject name} - PRESTASIPLUS" |
| — | `/practice/chapter/{CODE}/{chapterId}/quiz?count=` | chapter quiz (LS-3; INFERRED) | UNVERIFIED |
| S6 | `/practice/revision` | "Soalan Aku Salah", no subtitle (DV-M05-01) | "Soalan Aku Salah — PRESTASIPLUS" |
| S7 | `/practice/revision/{CODE}` | "Soalan Aku Salah", no subtitle (DV-M05-01) | "Ulang Kaji — {subject name}" |
| S8 | `/practice/progress` (`?period=7\|30\|90\|all`) | "Kemajuan Saya" / "Pantau prestasi dan kenal pasti topik lemah" | "Kemajuan Saya - PRESTASIPLUS" |
| S9 | `/practice/history` (`?period=week\|month\|year`) | "Sejarah Latihan" / "Rekod latihan dan prestasi anda" | "Sejarah Latihan - PRESTASIPLUS" |
| S10 | `/latihan-berstruktur` (`?subject_id=&kbat_level=&page=`) | "Soalan Berstruktur", no subtitle (DV-M05-01) | "Soalan Berstruktur - PRESTASIPLUS" |
| S10-SPM | `/latihan-berstruktur?scope=spm` / `?scope=spm&track=bahasa` (+ `subject_id`, `kbat_level`, `page`) | "Subjektif SPM" / "Tracking A Bahasa", no subtitle, per M06 DV-M06-07 and DV-SH-03 (live "Dashboard") | "Soalan Berstruktur - PRESTASIPLUS" |
| — | `/latihan-berstruktur/{id}/jawab` (`?scope=spm[&track=bahasa]`) | structured answer page (LS-7; INFERRED) | UNVERIFIED |
| S11 | `/pembetulan` (`?bulan=YYYY-MM`) | "Pembetulan" / "Lihat peningkatan selepas pembetulan jawapan" | "Pembetulan — Jejak Peningkatan" |
| S12 | `/penguasaan` | "Tahap Penguasaan" / "Jejak kemajuan anda dalam setiap subjek" | "Tahap Penguasaan" |
| S13 | `/remedial/saya` | "Ujian Remedial Saya", no subtitle (DV-M05-01) | "Ujian Remedial Saya" |
| S14 | `/misi-harian` | "Misi Harian" / "Selesaikan misi, kumpul syiling!" | "Misi Harian — PrestasiPlus" |
| — | `/remedial/{id}` | remedial quiz (LS-12; PROPOSED): "Ujian Remedial Saya", no subtitle | "Ujian Remedial Saya" (PROPOSED) |
| — | `/misi-harian/{id}` | mission quiz (LS-12; PROPOSED): "Misi Harian" / "Selesaikan misi, kumpul syiling!" | "Misi Harian — PrestasiPlus" (PROPOSED) |
| — | `/set-soalan-saya/{id}/jawab` | question-set quiz (LS-12; PROPOSED): "Set Soalan Guru", no subtitle | "Set Soalan Guru — PrestasiPlus" (PROPOSED) |
| S15 | `/target-spm` | "Target SPM Saya" / "Tetapkan target gred SPM dan pantau kemajuan anda" | "Target SPM Saya — PrestasiPlus" |

Tab-title suffixes differ between pages ("- PRESTASIPLUS", "— PRESTASIPLUS", "— PrestasiPlus", "- Latihan", none on S12/S13); they are replicated exactly (D-15, not a defect under D9). Unknown subject codes on S3, S5 and S7 show the global 404 page (M01). There are no detail pages for sessions (`/practice/history/{id}` etc. are 404 on live) and no JSON read endpoints on live; the mock service layer still exposes REST read endpoints (SRS §7) because the prototype has no server rendering (D2).

**Subject codes** (URL segment for S3, S5, S7): the 31 M03 subject codes — `BM BI MATH SCI SEJ PI PM` (core, "Teras") and `ADDMATH PHY CHEM BIO GEO PSV MUZ PJK RBT SK BA BC BT AKAUN EKON PERNIAGA PQS TI JAWI PSI SRT PPW PN SS` (discovery §1.1, Appendix B.1). Subject ids 1–31 are the M03 ids (e.g. BM 1, MATH 3, SEJ 5).

## 2. Actors

| Role | Involvement in M05 | Verified |
|---|---|---|
| Pelajar (student) | Main user of every screen: practises, revises, tracks progress, sets SPM targets, reports questions. | Inferred (menus and pages observed with the admin account in the user portal; no student account) |
| Admin | Sees every M05 page in the user portal with their own practice data (all discovery was done as admin); also sees the dashboard quick link "Panel Admin" → `/admin`. | Yes (admin account) |
| Guru, Ibu Bapa, Penaja, Admin Sekolah | Their landing page is `/dashboard` (M01 BR-07, INFERRED); whether their dashboard or menus differ is not known. | Inferred |
| Pegawai PPD / JPN | Land on their own dashboards (M01 BR-07); may open M05 pages through the shell. | Inferred |
| Guest | Any M05 route redirects to `/login` (M01 FR-M01-14). | Inferred |
| Other modules (system actors) | M03 (subjects, levels, chapters, legacy topics), M04 (questions, structured questions, report modal and triage), M14 (coins, points, XP level, streak, badges, leaderboard), M10 (teacher missions, remedial tests), M09 (articles, banners), M19 (pricing, subscriptions), M06 (SPM practice answers feeding the SPM target page). | Inferred (links observed; data flows inferred) |

URS.md §6: no correction needed.

---

## 3. Functional breakdown (Epic → Feature → Function)

Generated by script from the element inventory (`docs/discovery/inventory/M05/`) and the Function list (`fns.js` + `gen.js` in the author's scratchpad). "EL" lists inventory element IDs (prefix `EL-M05-`). S7 has no inventory (discovery §2.7, source only): its Functions carry the note "source: discovery §2.7" instead of EL IDs. Functions with "—" are behaviours (rules, post-action results, inferred states) with no element of their own. Roles: "Student" means any logged-in user of the user portal (INFERRED).

### EP-M05-1 — User-portal home (Dashboard)

**FT-M05-1.1 — Header, greeting and free-trial card** (S1 `/dashboard`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M05-1.1.1 | Shell header "Dashboard" / "Selamat datang kembali" on S1; tab title "Dashboard - PRESTASIPLUS". On live the same header also shows (wrongly) on S3, S6, S7, S10 and S13; those screens get their own header (DV-M05-01) | SHU-136–137 | Student | OBSERVED + DV-M05-01 |
| FN-M05-1.1.2 | Hero (gradient, full content width): h1 "Selamat {period}, {user name} 👋" (observed "Selamat Petang, Admin PRESTASI+ 👋"; the period word by time of day is INFERRED: Pagi / Tengah Hari / Petang / Malam), line "Jom teruskan latihan hari ini! 🚀", decorative 🎓 shown from `md` (768 px) only | S1-004–006 | Student | OBSERVED (layout, one greeting) / INFERRED (other periods) |
| FN-M05-1.1.3 | Free-trial card (amber): `fa-hourglass-half` tile, label "Percubaan Percuma" (displayed upper-case), "Baki {remaining} / 50 soalan", link "Langgan Sekarang" (`fa-rocket`) → `/pricing` (M19). Shown only to users without an active subscription | S1-007–009 | Student | OBSERVED (card) / INFERRED (condition) |

**FT-M05-1.2 — Announcement carousel** (S1)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M05-1.2.1 | 5 announcement slides in order: HERO "Selamat Datang ke PRESTASIPLUS", FEATURE "2,000+ Soalan Latihan Tersedia!", PROMOTIONAL "Cabaran Mingguan: Siapa Paling Rajin?", ANNOUNCEMENT "Tips untuk Ibu Bapa: Bimbing Anak Belajar", FEATURE "Kumpul Badge & Tunjukkan Kehebatan!" with their bodies (exact text, discovery §2.1). Each slide: type icon (HERO `fa-star`, FEATURE `fa-lightbulb`, PROMOTIONAL `fa-tag`, ANNOUNCEMENT `fa-bullhorn`), type badge (text as stored, upper-case), title, body clamped to 2 lines. Banner content is M09 data; the text is replicated as data (incl. "2,000+") | S1-010–013, S1-017–020, S1-024–027, S1-031–034, S1-038–041 | Student | OBSERVED |
| FN-M05-1.2.2 | Per-slide toggle "Baca Selanjutnya" (`fa-chevron-down`) ↔ "Tutup" (chevron rotated 180°) removes/restores the 2-line clamp of that slide only; each slide keeps its own state when the carousel moves | S1-014, S1-021, S1-028, S1-035, S1-042, S1-323 | Student | OBSERVED |
| FN-M05-1.2.3 | Prev/next arrow buttons (`fa-chevron-left` / `fa-chevron-right`) on every slide; wrap around (1 ← 5, 5 → 1) | S1-015–016, S1-022–023, S1-029–030, S1-036–037, S1-043–044 | Student | OBSERVED (script) |
| FN-M05-1.2.4 | 5 dot buttons (jump to slide; active dot wide with pink→amber gradient, others small slate) and counter "{n} / 5" | S1-045–050 | Student | OBSERVED |
| FN-M05-1.2.5 | Auto-advance every 5,000 ms; paused while the pointer is over the carousel, resumed on leave; slide change uses a slide/fade transition | — | Student | OBSERVED (script) |

**FT-M05-1.3 — Kombo reminder and gamification stat cards** (S1)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M05-1.3.1 | Kombo reminder banner: ⚠️ + `fa-exclamation-triangle`, h3 "Kombo {streak} hari akan putus!", "Jangan lepaskan! Buat sekurang-kurangnya 1 latihan hari ini.", link "Mula Latihan" (`fa-play`) → `/practice`. {streak} is the M14 streak value (observed "1" for the admin, whose last session was 19 May 2026). Shown when the streak is ≥1 and the user has no completed session today | S1-051–054 | Student | OBSERVED (banner, value) / INFERRED (condition; streak rule owned by M14, URS OQ-14) |
| FN-M05-1.3.2 | 5 stat cards (2 columns, 5 from `lg`): 🪙 {coins} "Syiling Kamu"; ⭐ {points} "Mata (Lvl {level})" with a violet level bar (width from M14; observed 7 %); 🔥 {streak} "Hari Berturut"; 📋 {sessions this week} "Sesi Minggu Ini"; 🎯 {accuracy this week}"%" "Ketepatan". Coins, points and level are M14 values | S1-055–070 | Student | OBSERVED (layout) / INFERRED (week values) |
| FN-M05-1.3.3 | Count-up: every stat number starts at 0 and climbs to its value (start delays 100/150/200/300/400 ms; coins and points add ceil(value/20) every 30 ms, streak +1 every 50 ms, sessions +1 every 60 ms, accuracy ceil(value/25) every 30 ms) | — | Student | OBSERVED (script) |

**FT-M05-1.4 — Misi Harian widget (10 daily quests) and Peti Harian** (S1)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M05-1.4.1 | Widget header: h2 "📱 Misi Harian", "Selesaikan semua misi → buka Peti Harian! 🎁", label "Progres" (displayed upper-case) and "{completed} / 10" | S1-071–077 | Student | OBSERVED |
| FN-M05-1.4.2 | 10 quest cards in the fixed catalogue order (discovery §2.1 table): emoji tile, title, difficulty chip (displayed upper-case; "Mudah" green, "Sederhana" amber, "Sukar" red), description, progress bar + "{progress}/{target}", reward 🪙 "+{coins}" | S1-078–147 | Student | OBSERVED |
| FN-M05-1.4.3 | Daily chest (locked): 🎁 (grey, faded), "Selesaikan {10 − completed} lagi misi untuk buka peti! 🔒" and 10 progress dots (grey = not completed) | S1-148–149 | Student | OBSERVED (locked, 0 done) |
| FN-M05-1.4.4 | Quest progress rules (computed by M14 `challenges.today` from v1.10; M05 renders them): progress per quest from today's practice (quizzes, correct answers, distinct topics, minutes, accuracy, streak), capped at the target; resets every day (Asia/Kuala_Lumpur); a quest is complete when progress ≥ target; the coin reward goes to the M14 wallet | — | Student | INFERRED |
| FN-M05-1.4.5 | Completed-quest styling, filled chest dots, the unlocked chest and the "Chest Reward Popup" block (present in the template, renders nothing when locked) | — | Student | INFERRED (UNVERIFIED COPY) — LS-9 |

**FT-M05-1.5 — Badge shelf, quick actions and conditional sections** (S1)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M05-1.5.1 | Recent-badges shelf, empty state: 🏆 "Belum Ada Lencana Lagi!" / "Jom kumpul lencana pertama dengan menjawab soalan! 🚀" | S1-150–152 | Student | OBSERVED |
| FN-M05-1.5.2 | Badge shelf with earned badges (badges are M14 data) | — | Student | INFERRED (UNVERIFIED) — LS-9 |
| FN-M05-1.5.3 | Quick actions (2 columns, 5 from `md`): "🚀 Mula Latihan" → `/practice`; "📈 Kemajuan" → `/practice/progress`; "📊 Sejarah Latihan" → `/practice/history`; "🏅 Papan Pendahulu" → `/leaderboard` (M14) | S1-153, S1-156–158 | Student | OBSERVED |
| FN-M05-1.5.4 | Quick action "🔄 Soalan Aku Salah" → `/practice/revision` with a red count badge = number of questions in the user's revision queue (observed 72) | S1-154–155 | Student | OBSERVED (badge) / INFERRED (hidden at 0) |
| FN-M05-1.5.5 | Full-width quick action "Panel Admin" (`fa-shield-alt`, `fa-arrow-right`) → `/admin`, only for the admin role | S1-159 | Admin | OBSERVED (admin) / INFERRED (role rule) |
| FN-M05-1.5.6 | Conditional sections present only as template comments and empty for the observed account: battle stats, parent daily target, weak-topic alert, teacher quiz sets, pending assignments, new rewards. Not rendered by the prototype until observed | — | Student | NOT OBSERVABLE (discovery Q-M05-8) |

**FT-M05-1.6 — Articles** (S1)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M05-1.6.1 | Section h2 "📚 Artikel Untuk Kamu" + link "Lihat Semua" (`fa-arrow-right`) → `/artikel`; horizontal scroll strip of the 5 latest articles: gradient thumbnail with `fa-newspaper`, category chip (displayed upper-case; "Tips Belajar", "Panduan Ibu Bapa"), title (2-line clamp), relative date ("7 bulan yang lepas"); card → `/artikel/{slug}` (M09) | S1-160–172 | Student | OBSERVED |
| FN-M05-1.6.2 | Right aside (≥1024 px only) "Artikel Terkini" with the same 5 articles (thumbnail `fa-newspaper`, title, relative date) and link "Lihat Semua Artikel" (`fa-arrow-right`) → `/artikel` | S1-315–322 | Student | OBSERVED |

**FT-M05-1.7 — Subjects, platform statistics, levels, latest questions, difficulty and subject statistics** (S1)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M05-1.7.1 | h2 "📖 Subjek Tersedia" + chip "{n} subjek"; one card per practice subject (31; grid 1 / `md` 2 / `lg` 3): subject icon (DV-M05-02), chip "{count} soalan" (no thousands separator; count = the subject's **eligible** questions, M04 SRS §4.1 Q-ELIGIBLE(subject), in the M04 D11 dataset, the same value as its S2 card — live sum 128,989), h3 name, English name, "⭐ Subjek Teras" for core subjects, link "Mula Latihan 🚀" → `/practice?subject={CODE}` (the parameter now opens the subject, DV-M05-03) | S1-173–198 | Student | OBSERVED + DV-M05-02/03 |
| FN-M05-1.7.2 | h2 "📊 Statistik Platform": 📚 {total} "Total Soalan" (M04 SRS §4.1 Q-ACTIVE + Q-PKSK; live 130152), 📖 {n} "Subjek Aktif", 🎯 {n} "Tahap Pendidikan", ✅ {approved} "Soalan Approved" (Q-ELIGIBLE + Q-PKSK; live 129752) (2 columns, 4 from `md`); numbers count up; values from the M04 D11 dataset | S1-199–211 | Student | OBSERVED |
| FN-M05-1.7.3 | h2 "🎓 Tahap Pendidikan": groups "🏫 Sekolah Rendah (KSSR)" (Darjah 1–6), "🎒 Sekolah Menengah Rendah (KSSM)" (Tingkatan 1–3), "🎓 Sekolah Menengah Atas (KSSM)" (Tingkatan 4–5); pills "{level name} ({count})" → `/practice?level={CODE}` (DV-M05-03) | S1-212–229 | Student | OBSERVED + DV-M05-03 |
| FN-M05-1.7.4 | h2 "⚡ Soalan Terkini" with a 📝 decoration; the 5 most recent questions (not links): subject chip (indigo, displayed upper-case), 5 stars (amber = difficulty, the rest slate), text cut at 100 characters + "..." (2-line clamp), relative time, level code chip in the subject colour ("T5") | S1-230–250 | Student | OBSERVED (layout, star fill) / INFERRED (ordering) |
| FN-M05-1.7.5 | h2 "📈 Tahap Kesukaran": one row per difficulty 1–5 (1–5 ⭐, "Sangat Mudah", "Mudah", "Sederhana", "Sukar", "Sangat Sukar", count badge = M04 SRS §4.1 Q-DIFFICULTY, PKSK rows included; live 39694 / 47138 / 33720 / 9600 / 0) with a bar whose width animates to count ÷ largest count (delays 150, 300, 450, 600, 750 ms); footer {total} (130152) "Jumlah Keseluruhan" (displayed upper-case) | S1-251–279 | Student | OBSERVED |
| FN-M05-1.7.6 | h2 "📊 Statistik Subjek": one card per subject sorted by question count descending: icon (DV-M05-02), name, "{n} soalan" (M04 SRS §4.1 Q-ACTIVE(subject) — live sum 129,389; differs from the card count only where a subject has Q-ARCHIVED-ACTIVE rows, e.g. Pendidikan Moral 15414 vs 15014), "Kesukaran:" 5 stars (amber = average difficulty, rounded; the rest slate), "Digunakan:" "{n}x" | S1-280–314 | Student | OBSERVED (layout, values) / INFERRED (star and usage formulas) |

### EP-M05-2 — Random drill (Latih Tubi)

**FT-M05-2.1 — Subject list** (S2 `/practice`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M05-2.1.1 | Shell header "Latih Tubi" / "Pilih subjek dan mula berlatih"; tab title "Latih Tubi - PRESTASIPLUS" | SHU-373–374 | Student | OBSERVED |
| FN-M05-2.1.2 | Hero h1 "Latih Tubi 🎯" (pink→purple→indigo gradient text), "Pilih subjek dan mula berlatih!" and 4 bouncing icon circles (`fa-graduation-cap`, `fa-star`, `fa-trophy`, `fa-rocket`) | S2-004–005 | Student | OBSERVED |
| FN-M05-2.1.3 | Chapter-mode banner (whole link → `/practice/chapter`): "Mode Baru" (displayed upper-case), h2 "Soalan by Chapter", "Jawab bab demi bab ikut buku teks dan DSKP. Bab seterusnya terkunci sehingga bab semasa lengkap.", "Mula" + `fa-arrow-right` | S2-006–007 | Student | OBSERVED |
| FN-M05-2.1.4 | 31 subject cards (grid 1 / `md` 2 / `lg` 3), each a whole-card link → `/practice/{CODE}`: icon circle in the subject colour (DV-M05-02), "Teras" badge (`fa-crown`) on the 7 core subjects, h3 name, English name, `fa-brain` "{count} soalan" (thousands separator; M04 SRS §4.1 Q-ELIGIBLE(subject), as live — it includes levels that S3 does not offer) | S2-008–012, S2-014–018, S2-020–024 | Student | OBSERVED + DV-M05-02 |
| FN-M05-2.1.5 | "Mula Latihan" button (`fa-play-circle` … `fa-arrow-right`, subject colour) inside each card; it has no action of its own, a click follows the card link (nested control replicated, D-14) | S2-013, S2-019, S2-025 | Student | OBSERVED |
| FN-M05-2.1.6 | Query parameters: `?subject={CODE}` opens `/practice/{CODE}` (replace) and `?topic_id={id}` opens `/practice/{code}` of the legacy topic's subject (M03 BR-16) (DV-M05-03); `?level={CODE}` is ignored and the plain list shows, as live (Delivery Lead decision, URS §7.1). Unknown values show the plain list | — | Student | OBSERVED (level ignored) + DV-M05-03 (subject, topic_id) |

**FT-M05-2.2 — Pre-start configuration** (S3 `/practice/{CODE}`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M05-2.2.1 | Shell header title "Latih Tubi" with no subtitle (DV-M05-01 / shell rule DV-SH-03; live "Dashboard" / "Selamat datang kembali"); tab title "{subject name} - Latihan" | — | Student | OBSERVED (tab) + DV-M05-01 |
| FN-M05-2.2.2 | Back link "Kembali ke Senarai Subjek" (`fa-arrow-left`) → `/practice` | S3-004 | Student | OBSERVED |
| FN-M05-2.2.3 | Blue trial notice (`fa-info-circle`): "Baki percubaan percuma: **{n}** soalan lagi." + link "Langgan untuk akses tanpa had" → `/pricing`; only for users without a subscription | S3-005–007 | Student | OBSERVED / INFERRED (condition) |
| FN-M05-2.2.4 | Hero: icon tile (DV-M05-02), h1 subject name, chip `fa-question-circle` "{total} soalan tersedia" (ms-MY separator) | S3-008–011, S3-050–051, S3-064–065, S3-083–084 | Student | OBSERVED |
| FN-M05-2.2.5 | "Pilih Tahap Pendidikan" (`fa-graduation-cap`): "Semua Tahap" (`fa-infinity`, "{total} soalan") then one button per offered level (code chip "D1", name "Darjah 1", "{n} soalan"); one selection; selected = indigo fill with ring; grid 2 / `sm` 3. Offered levels = the subject's M03 levels among Darjah 1–4 (live limit replicated; e.g. Sains Komputer offers only "D4", Matematik Tambahan none) | S3-012–014, S3-052–056, S3-066–067, S3-085 | Student | OBSERVED |
| FN-M05-2.2.6 | "Pilih Tahap Kesukaran" (`fa-signal`): "Semua" / "Campuran" with the current level total, then "Sgt Mudah" "Level 1" (green), "Mudah" "Level 2" (lime), "Sederhana" "Level 3" (yellow), "Sukar" "Level 4" (orange), "Sgt Sukar" "Level 5" (red), each with its live count; one selection; selected = filled in its colour; grid 2 | S3-015–022, S3-057–061, S3-068–070, S3-073–075, S3-077–080 | Student | OBSERVED |
| FN-M05-2.2.7 | "Bilangan Soalan" (`fa-list-ol`): 4 buttons 5 / 10 / 15 / 20 with "soalan"; default 10; grid 4 | S3-023–028 | Student | OBSERVED |
| FN-M05-2.2.8 | Sticky summary "Ringkasan" (`fa-info-circle`): "Tahap Pendidikan:" ("Semua Tahap" / level name / "Tahap {id}"), "Kesukaran:" ("Semua Tahap" / "Sangat Mudah" … "Sangat Sukar"), "Bilangan Soalan:", "Soalan Tersedia:" (ms-MY) | S3-029–038 | Student | OBSERVED |
| FN-M05-2.2.9 | When available < chosen count: amber box (`fa-exclamation-triangle`) "Soalan Tidak Mencukupi" / "Kurangkan bilangan soalan atau tukar tetapan penapisan."; the start button turns grey with a not-allowed cursor and a click does nothing | S3-039–040 | Student | OBSERVED |
| FN-M05-2.2.10 | Start "Mula Kuiz" (`fa-play-circle`): link to `/practice/{CODE}/quiz?` + `level={id}` (if chosen) + `&difficulty={1–5}` (if chosen) + `count={n}`; a click navigates only when available ≥ count | S3-041, S3-062, S3-071, S3-076, S3-081–082, S3-086 | Student | OBSERVED |
| FN-M05-2.2.11 | When startable: emerald pill `fa-check-circle` "Bersedia untuk bermula!" | S3-043 | Student | OBSERVED |
| FN-M05-2.2.12 | Card "Tips" (`fa-lightbulb`) with 4 lines (`fa-check`): "Mulakan dengan tahap mudah untuk biasakan diri", "Campurkan kesukaran untuk latihan menyeluruh", "Ambil masa untuk faham setiap soalan", "Ulang kaji soalan yang salah" | S3-044–049 | Student | OBSERVED |
| FN-M05-2.2.13 | Available count: no level and no difficulty → subject total; level + difficulty → count at that level and difficulty; level only → level count; difficulty only → count at that difficulty. Difficulty counts follow the chosen level; "Semua"/"Campuran" shows the level total | — | Student | OBSERVED (script) |
| FN-M05-2.2.14 | Unknown subject code → the global 404 page ("404 - Halaman Tidak Dijumpai \| PRESTASIPLUS") | — | Student | OBSERVED |

**FT-M05-2.3 — Random-drill quiz session (LS-1, LS-2, LS-8)** (`/practice/{CODE}/quiz?level=&difficulty=&count=`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M05-2.3.1 | Opening the quiz URL creates a session of `count` random approved, active MCQ questions matching subject, level and difficulty; a user with no subscription and no trial questions left is sent to `/pricing` instead | — | Student | INFERRED (not opened) — LS-1, LS-8 |
| FN-M05-2.3.2 | Quiz screen: the S7 quiz template (loading, header "Soalan {i} daripada {n}" with count-up timer "Masa" and progress bar, question card, option states, "Semak Jawapan", feedback, "Soalan Seterusnya" / "Lihat Keputusan") without the revision-only chips; titles are UNVERIFIED COPY | — | Student | INFERRED from S7 source — LS-1 |
| FN-M05-2.3.3 | Results: score, percentage colour bands, message, "Masa diambil:", rewards "Ganjaran Anda", "Semakan Semula Jawapan", retry and back links, as the S7 results template; titles and messages UNVERIFIED COPY | — | Student | INFERRED from S7 source — LS-2 |
| FN-M05-2.3.4 | "Lapor Soalan" after a checked answer opens the M04 report modal (MCQ variant) for the question | — | Student | INFERRED (M04 FN-M04-3.1.1) |

**FT-M05-2.4 — Subjective drill entry** (S3)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M05-2.4.1 | Link "Latihan Subjektif ({n} soalan)" (`fa-pen`) → `/practice/{CODE}/subjektif`, shown only when a level is chosen and it has subjective questions (never shown on live: every subject's subjective counts are empty; the prototype seeds none, so it stays hidden) | S3-042, S3-063, S3-072, S3-087 | Student | OBSERVED (template) — LS-6 |
| FN-M05-2.4.2 | Subjective drill page `/practice/{CODE}/subjektif`: content not observed; not built in the prototype (unreachable from the UI) | — | Student | NOT OBSERVABLE — LS-6 |

### EP-M05-3 — Chapter mode (Soalan by Chapter)

**FT-M05-3.1 — Chapter subject index** (S4 `/practice/chapter`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M05-3.1.1 | Shell header "Soalan by Chapter" with subtitle "Latihan tersusun ikut bab buku teks dan DSKP" on S4 and "{subject name}" on S5; tab titles "Soalan by Chapter - PRESTASIPLUS" (S4) and "Chapter {subject name} - PRESTASIPLUS" (S5) | SHU-375–379 | Student | OBSERVED |
| FN-M05-3.1.2 | Hero (emerald→teal→cyan): "Mode Sistematik" (displayed upper-case), h1 "Soalan by Chapter", "Pelajar jawab bab demi bab. Bab seterusnya hanya terbuka selepas bab sebelumnya lengkap dan mencapai sekurang-kurangnya 70%.", link "Latih Tubi Rawak" (`fa-random`) → `/practice` | S4-004–007 | Student | OBSERVED |
| FN-M05-3.1.3 | One card per subject that has chapter questions (live: BM, BI, MATH, SCI, SEJ, PI, PM, GEO, BA, JAWI; grid 1 / `sm` 2 / `xl` 3), whole-card link → `/practice/chapter/{CODE}`: icon tile in the subject colour (DV-M05-02), h3 name, "{n} bab tersedia", "{n} soalan chapter" (separator), `fa-chevron-right` | S4-008–027 | Student | OBSERVED + DV-M05-02 |

**FT-M05-3.2 — Chapter list with progressive unlock** (S5 `/practice/chapter/{CODE}?level=`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M05-3.2.1 | Dark teal hero: "Semua Subjek" (`fa-arrow-left`) → `/practice/chapter`, "Progressive Unlock" (displayed upper-case), h1 subject name, "Lengkapkan semua soalan bab semasa dan capai 70% untuk buka bab seterusnya." | S5-004–007, S5-011, S5-029 | Student | OBSERVED |
| FN-M05-3.2.2 | Level select (GET form to the same page, `name="level"`, submits on change): options "{level name} — {n} soalan" for the offered levels (Darjah 1–4 as S3), default the first; the select is not rendered when there is no option (DV-M05-07) | S5-008–009, S5-012, S5-030 | Student | OBSERVED + DV-M05-07 |
| FN-M05-3.2.3 | Empty level: `fa-layer-group` "Tiada bab tersedia untuk tahap ini." | S5-010 | Student | OBSERVED |
| FN-M05-3.2.4 | Open chapter card: teal number tile, h3 "Bab {n}: {name}" (wraps on narrow screens, DV-M05-09), line "{a}/{b} soalan unik · Skor {s}% · {r} baki", teal progress bar width a ÷ b | S5-013–016, S5-031–033 | Student | OBSERVED + DV-M05-09 |
| FN-M05-3.2.5 | Open chapter buttons "5 soalan", "10 soalan", "15 soalan", "20 soalan" → `/practice/chapter/{CODE}/{chapterId}/quiz?count={n}` | S5-017–020, S5-034–037 | Student | OBSERVED |
| FN-M05-3.2.6 | Locked chapter card: grey tile `fa-lock`, card at 75 % opacity, same title, stats line and bar (answers from other practice count), chip "Kunci bab sebelumnya" instead of the buttons | S5-021–028, S5-038–047 | Student | OBSERVED |
| FN-M05-3.2.7 | Rules: chapters in chapter-number order; the first chapter of a level is always open; chapter k opens when chapter k−1 has every question answered at least once and its score ≥ 70 %; Skor = correct ÷ unique answered (1 decimal, trailing ".0" dropped); progress counts unique questions answered in any mode | — | Student | OBSERVED (copy, values) / INFERRED (formula details) |
| FN-M05-3.2.8 | Completed chapter (all answered, ≥70 %): same card as an open chapter (no separate style observed); what follows the last chapter of a level | — | Student | INFERRED (UNVERIFIED) — LS-3 |
| FN-M05-3.2.9 | Unknown subject code → global 404 page | — | Student | OBSERVED |

**FT-M05-3.3 — Chapter quiz session (LS-3)** (`/practice/chapter/{CODE}/{chapterId}/quiz?count=`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M05-3.3.1 | Opening the URL creates a session of `count` questions of the chapter (unanswered questions first); a locked chapter opened by URL returns to its S5 page | — | Student | INFERRED (not opened) — LS-3 |
| FN-M05-3.3.2 | Quiz, results and report as FN-M05-2.3.2–2.3.4; the session's answers update the chapter progress and unlock state on S5 | — | Student | INFERRED — LS-3 |

### EP-M05-4 — Revision (Soalan Aku Salah)

**FT-M05-4.1 — Revision subject list** (S6 `/practice/revision`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M05-4.1.1 | Shell header title "Soalan Aku Salah" with no subtitle (DV-M05-01 / DV-SH-03); tab title "Soalan Aku Salah — PRESTASIPLUS" | — | Student | OBSERVED (tab) + DV-M05-01 |
| FN-M05-4.1.2 | Banner (red→orange→amber): `fa-redo-alt` tile, h1 "Soalan Aku Salah", "Ulang kaji soalan yang pernah dijawab salah", pill `fa-exclamation-circle` "{total} soalan perlu diulang kaji" | S6-004–006 | Student | OBSERVED |
| FN-M05-4.1.3 | One card per subject with ≥1 question in the queue (grid 1 / `sm` 2 / `lg` 3), link → `/practice/revision/{CODE}`: icon tile (subject colour gradient), h3 name, English name, red pill `fa-times-circle` "{n} soalan salah", `fa-arrow-right` | S6-007–012 | Student | OBSERVED |
| FN-M05-4.1.4 | Amber box "Tips Ulang Kaji" (`fa-lightbulb`): "Soalan yang paling kerap dijawab salah akan dipaparkan dahulu", "Apabila anda jawab betul, soalan itu akan dikeluarkan dari senarai ini", "Anda tetap mendapat syiling dan coin seperti latihan biasa" | S6-013–016 | Student | OBSERVED |
| FN-M05-4.1.5 | Link "Kembali ke Latihan" (`fa-arrow-left`) → `/practice` | S6-017 | Student | OBSERVED |
| FN-M05-4.1.6 | Info flash (`fa-check-circle`) "Tiada soalan salah untuk subjek ini. Tahniah!" after `/practice/revision/{CODE}` is opened for a subject with no queued question (redirect to S6); an unknown code → global 404 page | S6-018 | Student | OBSERVED |
| FN-M05-4.1.7 | No queued question at all: banner with "0 soalan perlu diulang kaji", no cards, tips and back link | — | Student | INFERRED (UNVERIFIED) — LS-11 |

**FT-M05-4.2 — Revision quiz** (S7 `/practice/revision/{CODE}` (source only))

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M05-4.2.1 | Shell header title "Soalan Aku Salah" with no subtitle (DV-M05-01 / DV-SH-03; live "Dashboard"); tab title "Ulang Kaji — {subject name}" | source: discovery §2.7 | Student | SOURCE-DERIVED + DV-M05-01 |
| FN-M05-4.2.2 | On page load the quiz starts (`POST` start with subject and 20 questions). Loading state: spinner ring in the subject colour with `fa-redo-alt`, "Memuat Soalan Ulang Kaji...", "Menyediakan soalan yang pernah dijawab salah". On failure: browser alert with the server message (fallback text per source), then back to `/practice/revision` | source: discovery §2.7 | Student | SOURCE-DERIVED |
| FN-M05-4.2.3 | Quiz header card: `fa-redo-alt` tile, "Ulang Kaji — {subject}", "Soalan {i} daripada {n}", timer MM:SS counting up every second with label "Masa", progress bar width i ÷ n | source: discovery §2.7 | Student | SOURCE-DERIVED |
| FN-M05-4.2.4 | Chips: `fa-redo-alt` "Mode Ulang Kaji — soalan ini pernah dijawab salah"; when the start response has revision meta, `fa-exclamation-circle` "{selected} daripada {total_wrong} soalan salah" | source: discovery §2.7 | Student | SOURCE-DERIVED |
| FN-M05-4.2.5 | Question card: pill `fa-redo-alt` "Soalan {i}"; `fa-times-circle` "Salah {n}x" when wrong count > 1; `fa-check-circle` "Mengikut DSKP" or `fa-book-open` "Latihan Tambahan"; question text (right-to-left and mixed-script aware); optional contributor `fa-chalkboard-teacher` "Soalan oleh:" + name (link to the profile in a new tab, or plain text) | source: discovery §2.7 | Student | SOURCE-DERIVED |
| FN-M05-4.2.6 | Option buttons (label + text) with states: idle, selected (orange ring), after checking correct = green + `fa-check-circle`, wrong pick = red + `fa-times-circle`, others dimmed to 50 % and disabled | source: discovery §2.7 | Student | SOURCE-DERIVED |
| FN-M05-4.2.7 | "Semak Jawapan" (`fa-check`), shown when an option is picked and not yet checked, sends the answer for checking. Any JSON response — including an error response — marks the answer checked with that response: with no `is_correct` the question shows red "Masih belum tepat" and the review keeps an empty correct-answer label. A correct answer adds 1 to the score and plays the coin animation (+1 syiling, +10 mata). Every checked answer is kept for the review. Only a network or non-JSON failure changes nothing on screen | source: discovery §2.7 | Student | SOURCE-DERIVED |
| FN-M05-4.2.8 | After checking, in this order below the question card: the button "Lapor Soalan" (`fa-flag`), then the feedback card "Betul! Kali ini berjaya!" (green, `fa-check`) or "Masih belum tepat" (red, `fa-times`) with the server feedback text and "Penjelasan:" (`fa-lightbulb`) + explanation when present | source: discovery §2.7 | Student | SOURCE-DERIVED |
| FN-M05-4.2.9 | "Soalan Seterusnya" (`fa-arrow-right`) moves on; on the last question "Lihat Keputusan" (`fa-flag-checkered`) shows the results, stops the timer, scrolls to the top and submits the session (answers + time) | source: discovery §2.7 | Student | SOURCE-DERIVED |
| FN-M05-4.2.10 | Results: `fa-redo-alt`, "Keputusan Ulang Kaji", subject name, "{score}/{n}", percentage (green ≥80, yellow 50–79, red <50), message (100 "Sempurna! Semua soalan salah berjaya diperbetulkan!", ≥80 "Cemerlang! Hampir semua berjaya diperbetulkan!", ≥50 "Bagus! Teruskan ulang kaji!", else "Jangan putus asa! Cuba ulang kaji lagi!"), `far fa-clock` "Masa diambil: MM:SS", when ≥50 % `fa-chart-line` "{score} soalan salah berjaya diperbetulkan!", animated bar (gradient per band) | source: discovery §2.7 | Student | SOURCE-DERIVED |
| FN-M05-4.2.11 | Buttons "Ulang Kaji Lagi" (`fa-redo`; reloads the page, starting a new session) and "Senarai Subjek" (`fa-arrow-left`) → `/practice/revision` | source: discovery §2.7 | Student | SOURCE-DERIVED |
| FN-M05-4.2.12 | "Ganjaran Anda" (`fa-gift`) when the submit response carries rewards: 🪙 {coins} "Syiling Diperoleh", 🔥 "{streak} hari" "Kombo Semasa", ⭐ {points} "Mata Diperoleh", "Baki syiling: {balance} 🪙"; bonus coins/points (server total minus what already flew per question) animate | source: discovery §2.7 | Student | SOURCE-DERIVED |
| FN-M05-4.2.13 | Collapsible "Semakan Semula Jawapan" (`fa-list-check`, chevron down/up, closed at first): one card per answer (green/red), number, question, "Jawapan anda:" "{label}. {text}", when wrong "\| Jawapan betul: {label}. {text}", "Penjelasan:" when present, link "Lapor soalan ini" (`fa-flag`) | source: discovery §2.7 | Student | SOURCE-DERIVED |
| FN-M05-4.2.14 | Queue rules: questions most often answered wrong come first (up to 20); a correct answer removes the question from the queue; a queued question that is not eligible under M04 BR-M04-03 (not approved, inactive or deactivated by a report) is neither served nor counted on S6 / the S1 badge while it stays ineligible; coins and points are earned as in normal practice | — | Student | OBSERVED (tips copy) / INFERRED (server, M04 BR-M04-03) |

**FT-M05-4.3 — Report a question (M04 modal hosted by M05)** (S7 and quiz pages)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M05-4.3.1 | "Lapor Soalan" / "Lapor soalan ini" opens the report modal for that question with reasons, comment and result cleared | source: discovery §2.7 | Student | SOURCE-DERIVED |
| FN-M05-4.3.2 | Modal (M04 component, MCQ variant): red `fa-flag`, "Lapor Soalan", "Soalan ini akan dinyahaktifkan sementara", × close; "Sebab Laporan *" 7 checkbox cards with descriptions and tints when ticked (red, amber, orange, yellow, blue, indigo, slate); "Komen Tambahan (pilihan)" (3 rows, max 500, placeholder "Terangkan masalah soalan ini...", counter "{n}/500"); "Batal"; "Hantar Laporan" (`fa-paper-plane`, disabled until one reason is ticked, "Menghantar..." with spinner while sending) | source: discovery §2.7 | Student | SOURCE-DERIVED |
| FN-M05-4.3.3 | Sending posts the report with source `revision` and the session id. After any JSON response the modal switches to the "Terima Kasih!" view (green `fa-check`) with the server `message` or "Laporan berjaya dihantar."; after a network failure the **same** "Terima Kasih!" view shows "Gagal menghantar laporan. Sila cuba lagi." (as live, and as M04 FR-M04-69). Button "Tutup". "Batal", ×, backdrop and Esc close without sending | source: discovery §2.7 | Student | SOURCE-DERIVED — LS-5 (server message) |

### EP-M05-5 — Structured practice (Soalan Berstruktur, Kertas 2)

**FT-M05-5.1 — Structured question list** (S10 `/latihan-berstruktur`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M05-5.1.1 | Shell header title "Soalan Berstruktur" with no subtitle (DV-M05-01 / DV-SH-03); tab title "Soalan Berstruktur - PRESTASIPLUS" | — | Student | OBSERVED (tab) + DV-M05-01 |
| FN-M05-5.1.2 | In-page h1 "Soalan Berstruktur" and "Latih tubi format Kertas 2 — jawab & semak secara automatik" | S10-004–005 | Student | OBSERVED |
| FN-M05-5.1.3 | Filter card (GET form to `/latihan-berstruktur`): "Subjek" (`subject_id`: "Semua Subjek" + 31 subjects A–Z by name), "Aras KBAT" (`kbat_level`: "Semua", "1. Mengingat" … "6. Mencipta"), button "Cari" (`fa-search`); selects show the current query. In the SPM variants the form also carries hidden `scope` (and `track`) inputs (FN-M05-5.3.3) | S10-006–012 | Student | OBSERVED |
| FN-M05-5.1.4 | Cards (grid 1 / `sm` 2 / `xl` 3, 20 per page): chips subject name, KBAT badge ("LOTS 1" green, "MOTS 3" amber, "HOTS 4" red), "{n}m" (cyan), "Trial" (emerald); preview text (3-line clamp); topic line `fa-book-open` when present; author line `fa-user-pen` "{author} · {school}"; footer `fa-list-ol` "{n} soalan · {level name}" | S10-013–021, S10-023–031, S10-033–041, S10-065–083 | Student | OBSERVED |
| FN-M05-5.1.5 | Button "Mula" (`fa-arrow-right`, at least 44×44 px) → `/latihan-berstruktur/{id}/jawab` | S10-022, S10-032, S10-042 | Student | OBSERVED |
| FN-M05-5.1.6 | Pagination (Laravel default, English): below 640 px "« Previous" / "Next »"; from 640 px "Showing {from} to {to} of {total} results" and page links with a window ("1 … 10 … 203 204") and arrow links; links keep the filter query | S10-043–062, S10-084–085 | Student | OBSERVED |
| FN-M05-5.1.7 | Empty: `fa-clipboard-list` "Tiada soalan berstruktur buat masa ini" / "Soalan akan ditambah oleh guru dan admin" | S10-063–064 | Student | OBSERVED |
| FN-M05-5.1.8 | List rule: published, active structured questions (M04), newest first (M04 BR-M04-26); filters combine with AND; KBAT badge by level: 1–2 "LOTS {n}" green, 3 "MOTS 3" amber, 4–6 "HOTS {n}" red | — | Student | OBSERVED (samples, bands 1–6) |

**FT-M05-5.2 — Structured answer page (LS-7)** (`/latihan-berstruktur/{id}/jawab`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M05-5.2.1 | Answer page `/latihan-berstruktur/{id}/jawab` (also with `?scope=spm` or `?scope=spm&track=bahasa`, the entry used by the SPM lists and by M04 "Buka Soalan Sama", M04 BR-M04-17): the known elements are the hint `fa-info-circle` "Jawab semua sub-soalan, kemudian klik Hantar." and the small "Lapor" button (M04 structured report variant); the question stimulus and sub-questions come from M04; its back link returns to the list it came from (plain S10, or the SPM list per `scope`/`track`, M06 FR-M06-47); inputs, "Hantar", marking and feedback are not observed | — | Student | OBSERVED (hint, Lapor via M04) / INFERRED — LS-7 |
| FN-M05-5.2.2 | Submitting an attempt and the automatic marking ("semak secara automatik") | — | Student | INFERRED (UNVERIFIED) — LS-7 |

**FT-M05-5.3 — SPM variants of the structured list (`scope=spm`, `track=bahasa`)** (`/latihan-berstruktur?scope=spm[&track=bahasa]` (M05 route; elements inventoried in M06 S7/S9))

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M05-5.3.1 | Route ownership: M05 owns `/latihan-berstruktur` with `scope` and `track` (list, answer page, API); with `scope=spm` the page renders the SPM variant instead of the plain S10 content; M06 documents the variant's screens and inventory (M06 S7 "Tracking A Bahasa", S9 "Subjektif SPM") and M05 maps them by cross-reference | cross-reference (M06 inventory): S7, S9 (cross-reference) | Student | OBSERVED |
| FN-M05-5.3.2 | `scope=spm` without `track`: back link "Kembali ke Subjektif SPM" (`fa-arrow-left`) → `/spm/subjektif`, h1 "Subjektif SPM", sub "Pilih set struktur dan esei Tingkatan 4 atau 5 mengikut subjek semasa"; `scope=spm&track=bahasa`: back link "Kembali ke Tracking A SPM" → `/spm/ramalan`, pill `fa-language` "TRACKING A BAHASA", h1 "Tracking A Bahasa", sub "Set bahasa dibuka ikut format kertas sebenar. BM dan BI tidak dipaksa menjadi 40 MCQ, dan dipaparkan mengikut susunan BM kemudian BI." and the info card with chips incl. `fa-layer-group` "{n} set ditemui". Shell header title "Subjektif SPM" / "Tracking A Bahasa" per M06 DV-M06-07 and the shell rule DV-SH-03 (title from the route, no subtitle) | cross-reference (M06 inventory): EL-M06-S9-004–006; EL-M06-S7-004–014, 077, 099 (cross-reference) | Student | OBSERVED (M06 inventory) + DV-M06-07 |
| FN-M05-5.3.3 | Filter form (GET) with hidden `scope=spm` (and hidden `track=bahasa` in the Tracking A variant); "Subjek" lists only the variant's subjects — Subjektif: "Semua Subjek" + Bahasa Melayu 1, Bahasa Inggeris 2, Matematik 3, Sains 4, Sejarah 5, Biologi 11, Ekonomi 22, Fizik 9, Geografi 12, Kimia 10, Matematik Tambahan 8, Perniagaan 23, Prinsip Perakaunan 21, Sains Komputer 17, Tasawwur Islam 25 (this order); Tracking A Bahasa: "Semua Subjek", Bahasa Melayu, Bahasa Inggeris; "Aras KBAT" as S10; "Cari" | cross-reference (M06 inventory): EL-M06-S9-007–014; EL-M06-S7-015–023 (cross-reference) | Student | OBSERVED (M06 inventory) |
| FN-M05-5.3.4 | Variant cards: the S10 card plus an indigo level chip "Tingkatan {n}" and the line `fa-layer-group` "{parts} bahagian · {marks} markah"; only Tingkatan 4–5 sets; Tracking A Bahasa lists BM sets before BI sets (M06 DV-M06-10) | cross-reference (M06 inventory): EL-M06-S9-015–024 …; EL-M06-S7-024–033 … (cross-reference) | Student | OBSERVED (M06 inventory, audit screenshot) |
| FN-M05-5.3.5 | "Mula" keeps the variant: `/latihan-berstruktur/{id}/jawab?scope=spm` (Subjektif) or `…/jawab?scope=spm&track=bahasa` (Tracking A Bahasa); the pager keeps `subject_id`, `scope`, `track` and `kbat_level`; the empty state is the S10 one | cross-reference (M06 inventory): EL-M06-S9-025, 036, 047, 048–067, 094–095; EL-M06-S7-034, 045, 056, 057–076 (cross-reference) | Student | OBSERVED (M06 inventory) |

### EP-M05-6 — Progress and history

**FT-M05-6.1 — Progress** (S8 `/practice/progress?period=`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M05-6.1.1 | Shell header "Kemajuan Saya" / "Pantau prestasi dan kenal pasti topik lemah"; tab title "Kemajuan Saya - PRESTASIPLUS" | SHU-380–381 | Student | OBSERVED |
| FN-M05-6.1.2 | Period chips "7 Hari", "30 Hari" (default), "3 Bulan", "Semua" → `?period=7\|30\|90\|all`; active chip indigo→violet gradient with white text, others slate. An unknown `period` (e.g. `?period=zzz`) shows no active chip and zero figures | S8-004–007 | Student | OBSERVED |
| FN-M05-6.1.3 | 4 tiles (2 columns, 4 from `lg`): 📝 {n} "Soalan Dijawab"; 🎯 "{x}%" "Ketepatan Keseluruhan" (1 decimal; "0%" with no data); 📋 {n} "Sesi Latihan"; ⏱️ "{m}m" "Masa Berlatih" | S8-008–019, S8-024–025 | Student | OBSERVED |
| FN-M05-6.1.4 | No answers in the period: 📊 "Belum Ada Data" / "Mula buat latihan untuk lihat kemajuan kamu di sini!" / link "Mula Latihan" (`fa-play`) → `/practice` (tiles still show zeros) | S8-020–023 | Student | OBSERVED |
| FN-M05-6.1.5 | Card "Trend Ketepatan" (`fa-chart-line`): line chart 250 px high, one point per day with answers (label dd/mm): "Ketepatan (%)" (indigo, filled) on the left axis 0–100 titled "Ketepatan (%)" and "Soalan" (amber, dashed) on the right axis titled "Jumlah Soalan" | S8-026–027 | Student | OBSERVED |
| FN-M05-6.1.6 | Red card (`fa-exclamation-triangle`) "Subjek Perlu Perhatian" (PROPOSED COPY, DV-M05-08; live "Topik Perlu Perhatian"): one row per subject with accuracy below 50 %: circle in the subject colour with the first 2 letters of the code, name, "{n} soalan", accuracy (red), button "Ulang Kaji" (subject colour) → `/practice/revision/{CODE}` (DV-M05-08; live `/practice/{CODE}`) | S8-028–038 | Student | OBSERVED + DV-M05-08 |
| FN-M05-6.1.7 | "Prestasi Mengikut Subjek" (`fa-book`), cards (grid 1 / `md` 2 / `lg` 3): tile with the 2-letter code, name, "{n} soalan dijawab", accuracy % and bar (red below 50 %), "Trend:" 120×30 sparkline (daily accuracy points, min–max scaled: x = i × 120 ÷ (n − 1), y = 2 + (max − v) ÷ (max − min) × 26) with ▼/▲ arrow when there are ≥2 day points, `fa-check` "{c} betul", `fa-times` "{w} salah" | S8-039–054 | Student | OBSERVED (red, sparkline) / INFERRED (other colours) |
| FN-M05-6.1.8 | Period windows (last 7/30/90 days incl. today, or all time); values from the answer log (SRS BR-06); time = total seconds of sessions in the period, shown as whole minutes | — | Student | INFERRED |

**FT-M05-6.2 — Practice history** (S9 `/practice/history?period=`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M05-6.2.1 | Shell header "Sejarah Latihan" / "Rekod latihan dan prestasi anda"; tab title "Sejarah Latihan - PRESTASIPLUS" | SHU-382–383 | Student | OBSERVED |
| FN-M05-6.2.2 | 4 achievement cards (2×2, 4 across from `lg`; labels displayed upper-case): `fa-clipboard-list` ✨ "Jumlah Sesi"; `fa-brain` 🎯 "Soalan Dijawab"; `fa-chart-line` 📊 "Purata Ketepatan" "{x}%"; `fa-coins` 💰 "Syiling Dikumpul". All-time totals over sessions only (answers without a session are not counted; live 84 vs S8 119), whatever the filter | S9-004–019 | Student | OBSERVED |
| FN-M05-6.2.3 | Filter pills "Semua" (`fa-infinity`), "Minggu Ini" (`fa-calendar-week`), "Bulan Ini" (`fa-calendar-alt`), "Tahun Ini" (`fa-calendar`) → `?period=week\|month\|year`; active pill indigo→violet gradient. An unknown `period` shows no active pill and lists all sessions | S9-020–023 | Student | OBSERVED |
| FN-M05-6.2.4 | Session cards, newest first, not clickable (one session store shared with M06 `/spm/history`): left border and type badge in the type colour — the SPM "Tahun Lepas" and "Latih Tubi" sessions show `fa-book` "Latihan", #6B7280 (the only observed badge); `far fa-clock` date "d MMM yyyy, HH:mm" (English month names, as live); score "{c} / {n}"; `fa-clock` time "MM:SS"; `fa-check-circle` "{c} betul", `fa-times-circle` "{w} salah"; grade label (displayed upper-case) + "{x}%"; bar with inner label "{rounded}%" (hidden at 0); pill "Ketepatan: {x}%"; coin badge 🪙 {n} "SYILING" | S9-024–058 | Student | OBSERVED |
| FN-M05-6.2.5 | Empty (no session in the filter): 📝 with ✨ and 🎯, "Belum Ada Rekod Latihan", "Anda belum melengkapkan sebarang latihan lagi. Mulakan latihan pertama anda sekarang dan kumpul syiling! 🚀", link "Mula Latihan" (`fa-play-circle` … `fa-arrow-right`) → `/practice` | S9-059–064 | Student | OBSERVED |
| FN-M05-6.2.6 | Pagination container under the list (Laravel pager, same markup as S10) when there are more sessions than one page | — | Student | OBSERVED (container) / INFERRED (page size) |
| FN-M05-6.2.7 | Grade labels for 50 % and above, and type badges for M05 random, chapter and revision sessions and M06 Tracking A sessions (PROPOSED COPY) | — | Student | INFERRED (UNVERIFIED COPY) — LS-11 |

### EP-M05-7 — Corrections and mastery

**FT-M05-7.1 — Pembetulan (corrections)** (S11 `/pembetulan?bulan=`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M05-7.1.1 | Shell header "Pembetulan" / "Lihat peningkatan selepas pembetulan jawapan"; tab title "Pembetulan — Jejak Peningkatan" | SHU-384–385 | Student | OBSERVED |
| FN-M05-7.1.2 | Month bar: "Bulan:", ‹ link → previous month (`?bulan=YYYY-MM`), label "{BM month name} {yyyy}" (e.g. "Mei 2026"), › link → next month; on the current month and later the › is a disabled grey span (DV-M05-10). A malformed `bulan` (e.g. `abc`, `2026-13`) shows the current month (DV-M05-13; live answers HTTP 500) | S11-004–007, S11-012–019 | Student | OBSERVED + DV-M05-10/13 |
| FN-M05-7.1.3 | Empty month: 🔄 "Tiada Data Pembetulan" / "Cuba buat pembetulan jawapan semasa sesi latih tubi untuk melihat peningkatan di sini." | S11-008–011 | Student | OBSERVED |
| FN-M05-7.1.4 | Card "Ringkasan Keseluruhan" (displayed upper-case) with 3 tiles "Sebelum" (red), "Selepas" (green), "Peningkatan" (grey "0.0%" when zero; green "+{x}%" when positive), tile labels displayed upper-case, and "Berdasarkan {n} soalan bulan ini" | S11-020–028 | Student | OBSERVED (zero) / INFERRED (positive style) |
| FN-M05-7.1.5 | Card "Mengikut Subjek" (displayed upper-case): per subject a colour dot, name, "{n} soalan", "Sebelum" bar (red) + %, "Selepas" bar (green) + %, delta pill | S11-029–044 | Student | OBSERVED |
| FN-M05-7.1.6 | Formulas: per month, "Sebelum" = accuracy of first answers, "Selepas" = accuracy after corrections (a later correct answer to a question first answered wrong), "Peningkatan" = Selepas − Sebelum; "{n} soalan" = questions first answered that month. Observed: May 2026 counts the admin's two SPM "Latih Tubi" sessions (74 questions) and not the two "Tahun Lepas" sessions of 19 May | — | Student | OBSERVED (values) / INFERRED (formula, exclusion of Tahun Lepas answers) |

**FT-M05-7.2 — Tahap Penguasaan (mastery)** (S12 `/penguasaan`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M05-7.2.1 | Shell header "Tahap Penguasaan" / "Jejak kemajuan anda dalam setiap subjek"; tab title "Tahap Penguasaan" | SHU-386–387 | Student | OBSERVED |
| FN-M05-7.2.2 | Card "Skala Penguasaan" (`fa-info-circle`, label displayed upper-case) with 11 chips "L0 Pemula" … "L10 Mythical" (grey → blue → green → amber → purple, L10 amber→pink gradient) | S12-004–016 | Student | OBSERVED |
| FN-M05-7.2.3 | One card per subject with answers (grid 1 / `sm` 2): icon tile in the subject colour (DV-M05-02), name + "({CODE})", level chip, 3 stats "Betul" / "Dijawab" / "Tepat" (% red below 50), "Menuju L{n+1}" + "{c}/{t} betul" + bar in the subject colour, "x{m} XP" (purple, from L2), "Terakhir: {relative time}" | S12-017–043 | Student | OBSERVED |
| FN-M05-7.2.4 | Mastery rules: per-subject counters "Betul" / "Dijawab" (live BM 46 / 94, which differ from S8's 32 / 79 — the source is not observable, so the counters are stored per subject); level from correct answers (L1 ≥10, L2 ≥25, L3 ≥50; higher thresholds unknown), bar = (correct − current threshold) ÷ (next − current); XP multiplier 1.05 at L2, +0.05 per level (INFERRED) | — | Student | OBSERVED (values, L1–L3 bars) / INFERRED (counter source, rules) |
| FN-M05-7.2.5 | No answers at all: only the scale card | — | Student | INFERRED (UNVERIFIED) — LS-11 |

### EP-M05-8 — Remedial tests, teacher missions, question sets and SPM target

**FT-M05-8.1 — Ujian Remedial Saya** (S13 `/remedial/saya`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M05-8.1.1 | Shell header title "Ujian Remedial Saya" with no subtitle (DV-M05-01 / DV-SH-03); tab title "Ujian Remedial Saya" | — | Student | OBSERVED (tab) + DV-M05-01 |
| FN-M05-8.1.2 | Page heading 🔬 h1 "Ujian Remedial Saya" + "Ujian khas untuk topik yang perlu diperbaiki" | S13-004–006 | Student | OBSERVED |
| FN-M05-8.1.3 | Empty: 🎯 "Tiada ujian remedial. Bagus — teruskan usaha!" | S13-007–008 | Student | OBSERVED |
| FN-M05-8.1.4 | List of the viewer's remedial tests (M10 RemedialTest records with status active or completed, newest first; M05 owns the read, XL2-08): one card per test with subject, "{n} soalan", teacher name, date, status and, for an active test, a start button → `/remedial/{id}` | — | Student | PROPOSED (layout, copy) / INFERRED (rules) — LS-12 |
| FN-M05-8.1.5 | Remedial quiz page `/remedial/{id}` (the target of the M10 "Lihat Quiz" link): the M05 quiz component with the test's questions in stored order; only the test's own student and only while the test is active (unknown, other student's or cancelled test → global 404 page; completed → back to `/remedial/saya`); the test's teacher and an admin see a read-only preview (questions and the correct options; nothing is recorded); completing it marks the test completed with `afterAccuracy` = the session accuracy (M10 BR-M10-12/13) | — | Student | PROPOSED (page) / INFERRED (rules) — LS-12 |

**FT-M05-8.2 — Misi Harian (teacher-assigned missions)** (S14 `/misi-harian`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M05-8.2.1 | Shell header "Misi Harian" / "Selesaikan misi, kumpul syiling!"; tab title "Misi Harian — PrestasiPlus" | SHU-388–389 | Student | OBSERVED |
| FN-M05-8.2.2 | Empty card: `fa-inbox` "Tiada misi hari ini" / "Misi baru akan muncul bila guru anda assign." | S14-004–006 | Student | OBSERVED |
| FN-M05-8.2.3 | Mission cards for today (M10 missions dated today whose recipients include the viewer; M05 owns the read, XL2-08): title, type label, subject, "{n} soalan", "3 syiling per jawapan betul", optional resource link and note, status and a start button → `/misi-harian/{id}`; separate from the dashboard quests (D-12 replicated) | — | Student | OBSERVED (reward text on live M10) / PROPOSED (layout) — LS-12 |
| FN-M05-8.2.4 | Mission quiz `/misi-harian/{id}`: the M05 quiz component with the questions M10 picks for the mission; one completed attempt per mission (an unfinished one resumes); a mission with no question to serve cannot start ("Soalan tidak mencukupi."); reward 3 syiling per correct answer (the mission rate) instead of 1 | — | Student | OBSERVED (rate, M10) / PROPOSED (page) / INFERRED (rules) — LS-12 |

**FT-M05-8.3 — Target SPM Saya** (S15 `/target-spm`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M05-8.3.1 | Shell header "Target SPM Saya" / "Tetapkan target gred SPM dan pantau kemajuan anda"; tab title "Target SPM Saya — PrestasiPlus" | SHU-390–391 | Student | OBSERVED |
| FN-M05-8.3.2 | Card header `fa-bullseye` "Target Gred SPM" + "Pilih target gred untuk setiap subjek. Sistem akan tunjuk kemajuan anda." | S15-006–008 | Student | OBSERVED |
| FN-M05-8.3.3 | 20 SPM subject rows A–Z (discovery B.5): name, status line "Belum mula", empty progress track, predicted grade "-", select `targets[{subject id}]` ("Target" + A+, A, A-, B+, B, C+, C, D, E) showing the saved target. Every row reads "Belum mula" for the admin although it has 84 answers in SPM "Tahun Lepas" and "Latih Tubi" sessions (BM, SEJ) | S15-010–025 | Student | OBSERVED |
| FN-M05-8.3.4 | Form (POST with hidden token) and button "Simpan" (`fa-save`) saving all 20 targets at once; a success message after saving | S15-004–005, S15-009 | Student | OBSERVED (form) / INFERRED (UNVERIFIED COPY) — LS-10 |
| FN-M05-8.3.5 | Legend: green dot "70%+ Ketepatan (On Track)", amber "50-69% (Perlu Usaha)", red "<50% (Perlu Fokus)", and `fa-lightbulb` "Tip: Jawab lebih banyak soalan untuk ramalan gred yang lebih tepat" | S15-026–029 | Student | OBSERVED |
| FN-M05-8.3.6 | Row with progress: status, bar in the legend colour and predicted grade. The data source is not observed: SPM "Tahun Lepas" and "Latih Tubi" answers do **not** start a row (OBSERVED); what does is unknown | — | Student | UNVERIFIED — LS-10 |

**FT-M05-8.4 — Teacher question sets (student side)** (`/set-soalan-saya/{id}/jawab`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M05-8.4.1 | Question-set quiz `/set-soalan-saya/{id}/jawab` (started from the M10 student page `/set-soalan-saya`): the M05 quiz component with the set's questions in set order; only sets visible to the student's classes (M10 BR-M10-18); attempts limited by the set's maximum (0 = unlimited); a set time limit counts down and submits the quiz at 0 | — | Student | PROPOSED (page) / INFERRED (rules) — LS-12 |

### EP-M05-9 — Navigation, shared presentation and practice data

**FT-M05-9.1 — M05 entries in the user-portal shell** (user shell (SHU))

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M05-9.1.1 | Desktop sidebar (≥1024 px), top items: "Dashboard" (`fa-home`) → `/dashboard`, "Target SPM" (`fa-bullseye`) → `/target-spm`, "Misi Harian" (`fa-rocket`) → `/misi-harian`, "Remedial" (`fa-flask`) → `/remedial/saya` | SHU-004–007 | Student | OBSERVED |
| FN-M05-9.1.2 | Desktop sidebar, group "💎 Killer Features": "Pembetulan" (`fa-arrows-rotate`) → `/pembetulan`, "Penguasaan" (`fa-layer-group`) → `/penguasaan` | SHU-055, SHU-057 | Student | OBSERVED |
| FN-M05-9.1.3 | Desktop sidebar, group "Pembelajaran": "Latih Tubi" (`fa-brain`) → `/practice`, "Soalan by Chapter" (`fa-layer-group`) → `/practice/chapter`, "Soalan Berstruktur" (`fa-list-ol`) → `/latihan-berstruktur`; group "Admin": "Soalan by Chapter" → `/practice/chapter` | SHU-062–064, SHU-112 | Student | OBSERVED |
| FN-M05-9.1.4 | Drawer (below 1024 px): "Dashboard", "Pembetulan", "Penguasaan", "Latih Tubi", "Soalan by Chapter", "Soalan Berstruktur", and "Soalan by Chapter" again in the "HARIAN" and admin groups; no "Target SPM", "Misi Harian" or "Remedial" item in the drawer (as live) | SHU-170, SHU-186–187, SHU-203–205, SHU-250, SHU-308 | Student | OBSERVED |
| FN-M05-9.1.5 | Mobile bottom nav "Home" (`fa-home`) → `/dashboard` | SHU-337 | Student | OBSERVED |
| FN-M05-9.1.6 | Active item: "Dashboard" on S1, "Latih Tubi" on S2, S3 and the random-drill quiz page, "Soalan by Chapter" on S4/S5, "Soalan Berstruktur" on S10, "Pembetulan" S11, "Penguasaan" S12, "Remedial" S13, "Misi Harian" S14, "Target SPM" S15; none on S6–S9 | — | Student | INFERRED |

**FT-M05-9.2 — Shared presentation rules** (all M05 screens)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M05-9.2.1 | Subject icons on S1, S2, S3, S4 and S12 are resolved from the M03 subject icon by M03 BR-05 and always show a glyph when the value is valid (DV-M05-02) | — | Student | DV-M05-02 |
| FN-M05-9.2.2 | No M05 text inside `main` is rendered below 12 px (DV-M05-11, full list in URS §7); decorative icons and emoji keep their live size; the global shell is M23 | — | Student | DV-M05-11 |
| FN-M05-9.2.3 | Number and date formats as live per screen: ms-MY thousands separators on S2, S3, S4, S5 and S8 values; none on S1 cards and statistics; percentages with 1 decimal (S8, S9, S11, S12), chapter Skor with trailing ".0" dropped; relative times "{n} {unit} yang lepas" | — | Student | OBSERVED |

**FT-M05-9.3 — Practice data rules** ((behaviour))

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M05-9.3.1 | Counts come from the M04 D11 dataset (live totals, deterministic rows; M05 anchors are rows inside it, not additions). The live figures are consistent under distinct definitions: with the M04 SRS §4.1 query names, subject card = Q-ELIGIBLE(subject) (Σ = Q-ELIGIBLE 128,989), "Statistik Subjek" = Q-ACTIVE(subject) (Σ = Q-ACTIVE 129,389; 400 Q-ARCHIVED-ACTIVE rows, all Pendidikan Moral), level pill = Q-ACTIVE(level), "Total Soalan" 130,152 = Q-ACTIVE + Q-PKSK, "Soalan Approved" 129,752 = Q-ELIGIBLE + Q-PKSK; difficulty rows = Q-DIFFICULTY (incl. PKSK; Σ 130,152); S3/S4/S5 = Q-PRACTICE (Q-ELIGIBLE at Darjah 1–4; Σ 32,204) | — | All | OBSERVED (values) / INFERRED (definitions) |
| FN-M05-9.3.2 | Answer log and session store (owned by M05, D12): every answer is stored with its session when it has one; live also has answers without a session (the admin's 35 answers of 19/02/2026). S8 counts all answers; S9 counts session answers only; S12 uses its own counters (replicated, different definitions). M06 SPM sessions use the same store and the same session-completion write contract (SRS BR-31) | — | All | OBSERVED (values) / INFERRED (model) |
| FN-M05-9.3.3 | Free trial: users counted as not subscribed have 50 free questions; each answered question uses one; remaining = 50 − used (never below 0). Only the individual subscription is observed; how school subscriptions (M02) and complimentary packages (M02/M19) count is not observed (INFERRED interaction, URS OQ-17) | — | Student | OBSERVED (copy) / INFERRED (rule) |
| FN-M05-9.3.4 | Kombo (streak): the value shown on S1 and in the header pill is M14's; its definition is server-side and unobserved (the admin shows 1 with no practice since May 2026). Replicated as live; the rule is deferred to M14 discovery with `/kombo` (URS OQ-14) | — | Student | OBSERVED (value) / UNOBSERVED (rule) |
| FN-M05-9.3.5 | Rewards: each correct answer is worth 1 syiling and 10 mata (client animation); in a teacher mission each correct answer is worth 3 syiling (the rate live M10 shows); the session totals go to M14 (`gamification.onSessionCompleted`), which credits the wallet, updates the streak and challenges, and returns the credited coins, streak and balance | — | Student | OBSERVED (client) / INFERRED (server) |
| FN-M05-9.3.6 | Access: every M05 route needs a session (guest → `/login`); any logged-in role can open them; "Panel Admin" only for admins | — | All | INFERRED |
| FN-M05-9.3.7 | Platform answer log and sessions (owned by M05, D11): one virtual dataset that reports the live platform totals — 478,499 answers, 32,122 completed sessions, 79.8 % correct (M08) — and, inside it, the T4/T5 monitoring segment of 472,371 answers with its weekly and period cells (M11); per-user records (admin, pelajar, pelajarmaju, the M08 and M11 records) are rows inside these totals, not additions; other modules read it only through named queries (SRS §6.14); the M12 Kirkpatrick session segment and the per-pupil subject accuracy set are separate M05 stores outside the log | — | All | OBSERVED (totals) / D11 (Delivery Lead, XL2-01) |

**Totals:** 9 epics · 31 features · 167 functions (95 cover inventory elements; 16 are mapped to the S7 source narrative §2.7 because S7 has no inventory: 4.2.1, 4.2.2, 4.2.3, 4.2.4, 4.2.5, 4.2.6, 4.2.7, 4.2.8, 4.2.9, 4.2.10, 4.2.11, 4.2.12, 4.2.13, 4.3.1, 4.3.2, 4.3.3; 5 map by cross-reference to the M06 inventory of the SPM variants (5.3.1, 5.3.2, 5.3.3, 5.3.4, 5.3.5), whose element IDs stay in M06 URS §6; 51 are behaviour-only: 1.2.5, 1.3.3, 1.4.4, 1.4.5, 1.5.2, 1.5.6, 2.1.6, 2.2.1, 2.2.13, 2.2.14, 2.3.1, 2.3.2, 2.3.3, 2.3.4, 2.4.2, 3.2.7, 3.2.8, 3.2.9, 3.3.1, 3.3.2, 4.1.1, 4.1.7, 4.2.14, 5.1.1, 5.1.8, 5.2.1, 5.2.2, 6.1.8, 6.2.6, 6.2.7, 7.1.6, 7.2.4, 7.2.5, 8.1.1, 8.1.4, 8.1.5, 8.2.3, 8.2.4, 8.3.6, 8.4.1, 9.1.6, 9.2.1, 9.2.2, 9.2.3, 9.3.1, 9.3.2, 9.3.3, 9.3.4, 9.3.5, 9.3.6, 9.3.7).

---

## 4. User stories

| ID | Feature | Priority | Story | Functions |
|---|---|---|---|---|
| US-M05-01 | FT-M05-1.1 | Must | As a student, I want the dashboard to greet me by name when I log in, so that I feel welcome and know I am on my home page. | FN-M05-1.1.1, 1.1.2 |
| US-M05-02 | FT-M05-1.1 | Must | As a student on the free trial, I want to see how many free questions I have left and a way to subscribe, so that I know when I must subscribe. | FN-M05-1.1.3, 9.3.3 |
| US-M05-03 | FT-M05-1.2 | Should | As a student, I want a rotating announcement carousel that I can pause, move and expand, so that I can read platform news. | FN-M05-1.2.1, 1.2.2, 1.2.3, 1.2.4, 1.2.5 |
| US-M05-04 | FT-M05-1.3 | Must | As a student with a streak, I want a reminder when I have not practised today, so that I do not lose my "Kombo". | FN-M05-1.3.1, 9.3.4 |
| US-M05-05 | FT-M05-1.3 | Must | As a student, I want my coins, points, streak, sessions this week and accuracy on the dashboard, so that I see my standing at a glance. | FN-M05-1.3.2, 1.3.3 |
| US-M05-06 | FT-M05-1.4 | Must | As a student, I want 10 daily quests with progress and coin rewards and a daily chest, so that I have goals for today. | FN-M05-1.4.1, 1.4.2, 1.4.3, 1.4.4, 1.4.5 |
| US-M05-07 | FT-M05-1.5 | Must | As a student, I want my badges and quick links to practice, revision, progress, history and the leaderboard, so that I can jump to them. | FN-M05-1.5.1, 1.5.2, 1.5.3, 1.5.4, 1.5.5, 1.5.6 |
| US-M05-08 | FT-M05-1.6 | Should | As a student, I want the latest articles on the dashboard, so that I can read study tips. | FN-M05-1.6.1, 1.6.2 |
| US-M05-09 | FT-M05-1.7 | Must | As a student, I want subject cards and level pills that take me into practice, so that I can start from the dashboard. | FN-M05-1.7.1, 1.7.3, 2.1.6 |
| US-M05-10 | FT-M05-1.7 | Should | As a student, I want platform statistics, the latest questions, the difficulty spread and per-subject statistics, so that I know what is available. | FN-M05-1.7.2, 1.7.4, 1.7.5, 1.7.6, 9.3.1 |
| US-M05-11 | FT-M05-2.1 | Must | As a student, I want to see every subject with its question count and open one to practise, so that I can choose what to drill. | FN-M05-2.1.1, 2.1.2, 2.1.3, 2.1.4, 2.1.5 |
| US-M05-12 | FT-M05-2.1 | Must | As a student following a dashboard subject card or a learning-map link, I want to land on the practice page of that subject, so that the link does what it says. | FN-M05-2.1.6 |
| US-M05-13 | FT-M05-2.2 | Must | As a student, I want to choose level, difficulty and number of questions and see how many questions are available, so that I get the drill I want. | FN-M05-2.2.1, 2.2.2, 2.2.4, 2.2.5, 2.2.6, 2.2.7, 2.2.8, 2.2.12, 2.2.13 |
| US-M05-14 | FT-M05-2.2 | Must | As a student, I want to start the quiz only when enough questions exist, and to see my trial balance, so that I am not sent into an empty quiz. | FN-M05-2.2.3, 2.2.9, 2.2.10, 2.2.11, 2.2.14 |
| US-M05-15 | FT-M05-2.3 | Must | As a student, I want to answer the drill one question at a time with instant checking and explanations, so that I learn from each answer. | FN-M05-2.3.1, 2.3.2, 2.3.4 |
| US-M05-16 | FT-M05-2.3 | Must | As a student, I want my result, rewards and an answer review at the end of a drill, so that I know how I did. | FN-M05-2.3.3, 9.3.5 |
| US-M05-17 | FT-M05-2.4 | Could | As a student, I want a subjective drill link when subjective questions exist for my level, so that I can practise written answers. | FN-M05-2.4.1, 2.4.2 |
| US-M05-18 | FT-M05-3.1 | Must | As a student, I want the list of subjects that have chapter practice, so that I can study chapter by chapter. | FN-M05-3.1.1, 3.1.2, 3.1.3 |
| US-M05-19 | FT-M05-3.2 | Must | As a student, I want each chapter's progress and score, with later chapters locked until I complete the current one at 70 %, so that I work through the textbook in order. | FN-M05-3.2.1, 3.2.2, 3.2.3, 3.2.4, 3.2.5, 3.2.6, 3.2.7, 3.2.8, 3.2.9 |
| US-M05-20 | FT-M05-3.3 | Must | As a student, I want to take a 5–20 question quiz on an open chapter, so that my chapter progress grows. | FN-M05-3.3.1, 3.3.2 |
| US-M05-21 | FT-M05-4.1 | Must | As a student, I want the subjects in which I have wrong answers, with counts, so that I can revise my mistakes. | FN-M05-4.1.1, 4.1.2, 4.1.3, 4.1.4, 4.1.5, 4.1.6, 4.1.7 |
| US-M05-22 | FT-M05-4.2 | Must | As a student, I want to re-answer my wrong questions with checking and explanations, so that I correct them. | FN-M05-4.2.1, 4.2.2, 4.2.3, 4.2.4, 4.2.5, 4.2.6, 4.2.7, 4.2.8, 4.2.9 |
| US-M05-23 | FT-M05-4.2 | Must | As a student, I want a revision result with rewards and a review, and corrected questions removed from my list, so that my list shrinks as I improve. | FN-M05-4.2.10, 4.2.11, 4.2.12, 4.2.13, 4.2.14 |
| US-M05-24 | FT-M05-4.3 | Must | As a student, I want to report a wrong or unclear question from the quiz, so that it gets fixed. | FN-M05-4.3.1, 4.3.2, 4.3.3 |
| US-M05-25 | FT-M05-5.1 | Must | As a student, I want to browse and filter structured (Kertas 2) questions by subject and KBAT level, page by page, so that I can pick one to answer. | FN-M05-5.1.1, 5.1.2, 5.1.3, 5.1.4, 5.1.5, 5.1.6, 5.1.7, 5.1.8 |
| US-M05-26 | FT-M05-5.2 | Should | As a student, I want to answer a structured question and have it marked, so that I practise Kertas 2. | FN-M05-5.2.1, 5.2.2 |
| US-M05-27 | FT-M05-6.1 | Must | As a student, I want my progress for a period (answers, accuracy, sessions, time, trend, weak subjects, per-subject results), so that I see where to improve. | FN-M05-6.1.1, 6.1.2, 6.1.3, 6.1.4, 6.1.5, 6.1.6, 6.1.7, 6.1.8 |
| US-M05-28 | FT-M05-6.2 | Must | As a student, I want a history of my practice sessions with scores, time and coins, filtered by week, month or year, so that I can review my effort. | FN-M05-6.2.1, 6.2.2, 6.2.3, 6.2.4, 6.2.5, 6.2.6, 6.2.7 |
| US-M05-29 | FT-M05-7.1 | Should | As a student, I want to see, month by month, how much my accuracy improved after corrections, so that I see the value of correcting. | FN-M05-7.1.1, 7.1.2, 7.1.3, 7.1.4, 7.1.5, 7.1.6 |
| US-M05-30 | FT-M05-7.2 | Should | As a student, I want my mastery level per subject with the next level's target, so that I have a long-term goal. | FN-M05-7.2.1, 7.2.2, 7.2.3, 7.2.4, 7.2.5 |
| US-M05-31 | FT-M05-8.1 | Should | As a student, I want a page for the remedial tests my teacher gives me, so that I can find them. | FN-M05-8.1.1, 8.1.2, 8.1.3, 8.1.4, 8.1.5 |
| US-M05-32 | FT-M05-8.2 | Should | As a student, I want a page for the daily missions my teacher assigns, so that I can do them. | FN-M05-8.2.1, 8.2.2, 8.2.3, 8.2.4 |
| US-M05-33 | FT-M05-8.3 | Must | As an SPM candidate, I want each SPM subject's progress and predicted grade next to my target grade, so that I know if I am on track. | FN-M05-8.3.1, 8.3.2, 8.3.3, 8.3.5, 8.3.6 |
| US-M05-34 | FT-M05-8.3 | Must | As an SPM candidate, I want to set and save a target grade for each SPM subject, so that the page tracks my goals. | FN-M05-8.3.4 |
| US-M05-35 | FT-M05-9.1 | Must | As a student, I want the practice pages in my menus on any device, so that I can reach them. | FN-M05-9.1.1, 9.1.2, 9.1.3, 9.1.4, 9.1.5, 9.1.6 |
| US-M05-36 | FT-M05-9.3 | Must | As a student, I want the same numbers on every page (question counts, answers, wrong questions), so that I can trust them. | FN-M05-9.2.3, 9.3.1, 9.3.2 |
| US-M05-37 | FT-M05-9.3 | Must | As the owner, I want every M05 page closed to guests, so that learner data is protected. | FN-M05-9.3.6 |
| US-M05-38 | cross-cutting | Must | As a student on a phone, tablet or desktop, I want every M05 screen to fit my screen with readable text and visible icons, so that I can practise anywhere. | FN-M05-9.2.1, 9.2.2; all screen FNs |
| US-M05-39 | FT-M05-5.3 | Must | As an SPM candidate coming from the SPM pages, I want the structured list in its SPM form (Subjektif SPM or Tracking A Bahasa) and answer pages that keep that context, so that I practise SPM Paper 2 sets. | FN-M05-5.3.1, 5.3.2, 5.3.3, 5.3.4, 5.3.5 |
| US-M05-40 | FT-M05-8.4 | Should | As a student in a teacher's class, I want to answer the question sets my teacher publishes, within their attempt and time limits, so that I can do the class work. | FN-M05-8.4.1 |
| US-M05-41 | FT-M05-9.3 | Must | As an admin or teacher reading the platform and school analytics (M08, M11), I want every practice figure counted from one answer log that reports the live totals, so that the figures agree across modules. | FN-M05-9.3.7 |

### Acceptance criteria

Unless stated, the mock clock is **Friday 25 September 2026, 15:40 (Asia/Kuala_Lumpur)** and the seed data is SRS §6.12 (`admin@demo.test` mirrors the live admin exactly; `pelajar@demo.test` T4 student with the 4 SPM sessions shared with M06; `pelajar2@demo.test` with no history; `pelajarmaju@demo.test` Darjah 1 subscriber with fictitious practice history). ACs marked **(provisional)** check INFERRED behaviour of an unobserved live-session state.

**US-M05-01 — Greeting**
- **AC-M05-01.1** Given I am logged in as `admin@demo.test`, when I open `/dashboard`, then the shell header shows "Dashboard" / "Selamat datang kembali" and the tab title is "Dashboard - PRESTASIPLUS".
- **AC-M05-01.2** Given the clock is 15:40, when S1 loads, then the hero h1 reads "Selamat Petang, Admin Demo 👋" and the line below reads "Jom teruskan latihan hari ini! 🚀"; at 768 and 1280 px a 🎓 is shown on the right of the hero and at 375 px it is not.
- **AC-M05-01.3** Given the clock is 09:00, 13:00 or 20:00, when S1 loads, then the period word is "Pagi", "Tengah Hari" or "Malam" (INFERRED thresholds, SRS BR-02).

**US-M05-02 — Free trial**
- **AC-M05-02.1** Given `admin@demo.test` (no subscription, 50 trial questions used), when S1 loads, then the trial card shows the hourglass tile, "PERCUBAAN PERCUMA" (source text "Percubaan Percuma"), "Baki 0 / 50 soalan" and "Langgan Sekarang" linking to `/pricing`.
- **AC-M05-02.2** Given `pelajar2@demo.test` (no subscription, nothing used), when S1 loads, then the card reads "Baki 50 / 50 soalan".
- **AC-M05-02.3** Given `pelajarmaju@demo.test` (active subscription), when S1 loads, then no trial card is shown (INFERRED).

**US-M05-03 — Announcement carousel**
- **AC-M05-03.1** Given S1, when it loads, then slide 1 shows the star icon, badge "HERO", "Selamat Datang ke PRESTASIPLUS", its body clamped to 2 lines, "Baca Selanjutnya", both arrows, 5 dots (the first wide) and "1 / 5".
- **AC-M05-03.2** Given slide 1, when I press the next arrow 4 times, then slides 2–5 appear in order with badges FEATURE, PROMOTIONAL, ANNOUNCEMENT, FEATURE and the exact titles and bodies of discovery §2.1, the counter follows ("2 / 5" … "5 / 5"), and one more press shows slide 1; the previous arrow on slide 1 shows slide 5.
- **AC-M05-03.3** Given any slide, when I press a dot, then that slide shows and its dot becomes the wide gradient dot.
- **AC-M05-03.4** Given a slide, when I press "Baca Selanjutnya", then the body shows in full and the button reads "Tutup" with the chevron turned; pressing "Tutup" restores the clamp; another slide keeps its own state.
- **AC-M05-03.5** Given the pointer is not over the carousel, when 5 seconds pass, then the next slide shows; given the pointer is over it, when 10 seconds pass, then the slide does not change; after the pointer leaves it advances again.

**US-M05-04 — Kombo reminder**
- **AC-M05-04.1** Given `admin@demo.test` (M14 streak 1 as live; last session 19 May 2026, none today), when S1 loads, then the banner shows ⚠️, "Kombo 1 hari akan putus!", "Jangan lepaskan! Buat sekurang-kurangnya 1 latihan hari ini." and "Mula Latihan" linking to `/practice` (as live).
- **AC-M05-04.2** Given `pelajarmaju@demo.test` or `pelajar@demo.test` (a session today), when S1 loads, then no Kombo banner is shown (INFERRED condition).
- **AC-M05-04.3** Given `pelajar2@demo.test` (M14 streak 0), when S1 loads, then no Kombo banner is shown and "Hari Berturut" is 0.

**US-M05-05 — Stat cards**
- **AC-M05-05.1** Given `pelajarmaju@demo.test`, when S1 has settled, then the 5 cards read 🪙 267 "Syiling Kamu", ⭐ 432 "Mata (Lvl 3)" with the violet bar at 100 % (M14 wallet, v1.10), 🔥 3 "Hari Berturut", 📋 4 "Sesi Minggu Ini", 🎯 70% "Ketepatan".
- **AC-M05-05.2** Given S1 has just loaded, when I read the numbers within the first 100 ms, then they show 0, and they climb to their final values (count-up).
- **AC-M05-05.3** Given `admin@demo.test`, when S1 has settled, then the cards read 256 "Syiling Kamu", 8 "Mata (Lvl 2)", 1 "Hari Berturut", 0 "Sesi Minggu Ini", 0% "Ketepatan" (as live).

**US-M05-06 — Daily quests**
- **AC-M05-06.1** Given `admin@demo.test`, when S1 loads, then the widget shows "📱 Misi Harian", "Selesaikan semua misi → buka Peti Harian! 🎁", "PROGRES" "0 / 10", and the 10 quests in order (Rajin Berlatih … Cabaran Kilat) with their difficulty chips displayed upper-case in green/amber/red, descriptions, "0/{target}" and rewards "+15", "+20", "+25", "+30", "+10", "+12", "+20", "+25", "+35", "+40".
- **AC-M05-06.2** Given `admin@demo.test`, when S1 loads, then the chest shows the grey 🎁, "Selesaikan 10 lagi misi untuk buka peti! 🔒" and 10 grey dots.
- **AC-M05-06.3** Given `pelajarmaju@demo.test` (today: 2 sessions, 9 correct, 7 min 40 s, best accuracy 60 %, best session 6 correct, questions from 3 chapters, streak 3), when S1 loads, then progress reads Rajin Berlatih "2/3", Si Tepat "60/80", Penjelajah Topik "3/3", Kilat Matematik "9/10", Mula Hari Ini "1/1", Jawab 5 Betul "5/5", Latihan 10 Minit "7/10", Kombo 2 Hari "2/2", Ketepatan 90% "60/90", Cabaran Kilat "6/20", "4 / 10" and "Selesaikan 6 lagi misi untuk buka peti! 🔒" (M14 `challenges.today`, M14 BR-M14-13; values unchanged).
- **AC-M05-06.4** Given a quest is complete, when S1 renders, then its bar is full; the completed-quest style, the filled dots and the open chest are UNVERIFIED (placeholder styling per SRS §8, LS-9).

**US-M05-07 — Badges and quick actions**
- **AC-M05-07.1** Given a user with no badges, when S1 loads, then the shelf shows 🏆 "Belum Ada Lencana Lagi!" and "Jom kumpul lencana pertama dengan menjawab soalan! 🚀".
- **AC-M05-07.2** Given S1, when it loads, then the quick actions are "🚀 Mula Latihan" → `/practice`, "🔄 Soalan Aku Salah" → `/practice/revision`, "📈 Kemajuan" → `/practice/progress`, "📊 Sejarah Latihan" → `/practice/history`, "🏅 Papan Pendahulu" → `/leaderboard`, in 2 columns at 375 px and 5 across from 768 px.
- **AC-M05-07.3** Given `admin@demo.test` with 72 queued wrong questions, when S1 loads, then "Soalan Aku Salah" carries the red badge "72"; given `pelajar2@demo.test` (none), then no badge is shown.
- **AC-M05-07.4** Given `admin@demo.test`, when S1 loads, then "Panel Admin" (shield icon, arrow) links to `/admin`; given any student account, it is not shown.
- **AC-M05-07.5** Given any account, when S1 loads, then none of the unobserved conditional sections (battle stats, parent target, weak-topic alert, teacher quiz sets, assignments, new rewards) is rendered.

**US-M05-08 — Articles**
- **AC-M05-08.1** Given S1, when it loads, then "📚 Artikel Untuk Kamu" shows "Lihat Semua" → `/artikel` and a horizontally scrollable strip of the 5 seeded articles, each with a newspaper thumbnail, category chip displayed upper-case ("TIPS BELAJAR" / "PANDUAN IBU BAPA"), title and relative date, linking to `/artikel/{slug}`.
- **AC-M05-08.2** Given 1280 px, when S1 loads, then the right aside "Artikel Terkini" lists the same 5 articles and "Lihat Semua Artikel" → `/artikel`; at 768 and 375 px the aside is not shown.

**US-M05-09 — Subject cards and level pills**
- **AC-M05-09.1** Given S1, when it loads, then "📖 Subjek Tersedia" shows "31 subjek" and 31 cards in M03 order; each card shows its icon (visible glyph where the M03 icon value is valid, DV-M05-02), "{count} soalan" without a thousands separator where count = the subject's eligible (approved and active) questions, M04 SRS §4.1 Q-ELIGIBLE(subject), in the M04 D11 dataset (live values, e.g. Matematik 13872, Pendidikan Moral 15014), the same number as its S2 card — name, English name, "⭐ Subjek Teras" on the 7 core subjects only, and "Mula Latihan 🚀" with href `/practice?subject={CODE}`.
- **AC-M05-09.2** Given I press "Mula Latihan 🚀" on the Matematik card, when the app navigates, then I land on `/practice/MATH` (S3) (DV-M05-03; live landed on the unfiltered list).
- **AC-M05-09.3** Given "🎓 Tahap Pendidikan", when it loads, then the three groups show "Darjah 1" … "Darjah 6", "Tingkatan 1" … "Tingkatan 3" and "Tingkatan 4", "Tingkatan 5", each as "{name} ({count})" linking to `/practice?level={CODE}`.
- **AC-M05-09.4** Given I press "Darjah 2 (…)" or "Tingkatan 4 (…)", when `/practice?level=…` opens, then the plain S2 list shows (the parameter is ignored, as live), the card links carry no level, and S3 opened from it has "Semua Tahap" selected.
- **AC-M05-09.5** Given M03 Peta Belajar links to `/practice?topic_id=7` (legacy topic, MATEMATIK), when I open it, then I land on `/practice/MATH`; `/practice?topic_id=99999` shows the plain S2 list.

**US-M05-10 — Platform statistics**
- **AC-M05-10.1** Given S1, when it has settled, then "📊 Statistik Platform" shows "Total Soalan" 130152, "Subjek Aktif" 31, "Tahap Pendidikan" 11 and "Soalan Approved" 129752 (M04 SRS §4.1 Q-ACTIVE + Q-PKSK and Q-ELIGIBLE + Q-PKSK over the M04 D11 dataset, as live), each counting up from 0.
- **AC-M05-10.2** Given "⚡ Soalan Terkini", when it loads, then it lists the 5 newest questions with subject chip (displayed upper-case), 5 stars, text cut to 100 characters + "..." when longer, relative time and level code, none of them a link.
- **AC-M05-10.3** Given "📈 Tahap Kesukaran", when it loads, then it shows 5 rows "Sangat Mudah" … "Sangat Sukar" with 1–5 stars and counts per difficulty (M04 SRS §4.1 Q-DIFFICULTY, PKSK rows included: 39694, 47138, 33720, 9600, 0, as live), the largest row's bar ("Mudah") reaches 100 % and the others are proportional, "Sangat Sukar" is 0 with an empty bar, and the footer shows the total 130152 (= "Total Soalan") with "JUMLAH KESELURUHAN".
- **AC-M05-10.4** Given "📊 Statistik Subjek", when it loads, then the 31 subject cards are sorted by question count descending, each with icon, name, "{n} soalan", "Kesukaran:" with 5 stars and "Digunakan:" "{n}x".

**US-M05-11 — Subject list**
- **AC-M05-11.1** Given I open `/practice`, when it loads, then the header is "Latih Tubi" / "Pilih subjek dan mula berlatih", the tab title is "Latih Tubi - PRESTASIPLUS", the hero shows "Latih Tubi 🎯", "Pilih subjek dan mula berlatih!" and the 4 bouncing icons.
- **AC-M05-11.2** Given S2, when it loads, then the banner shows "MODE BARU" (source "Mode Baru"), "Soalan by Chapter", its text and "Mula", and a click opens `/practice/chapter`.
- **AC-M05-11.3** Given S2, when it loads, then 31 cards appear in M03 order in 1 / 2 / 3 columns at 375 / 768 / 1280 px; Bahasa Melayu shows the crown "Teras", "Malay Language", "{count} soalan" (approved questions, ms-MY separators, e.g. "11,688"; equal to its S1 card) and "Mula Latihan"; non-core cards have no "Teras".
- **AC-M05-11.4** Given a card, when I click its name or its "Mula Latihan" button, then `/practice/{CODE}` opens (the button has no separate action).

**US-M05-12 — Entry parameters**
- **AC-M05-12.1** Given `/practice?subject=BM`, when it opens, then the app replaces the URL with `/practice/BM`; `/practice?subject=XYZ` shows the plain list.
- **AC-M05-12.2** Given `/practice?level=D3`, when it opens, then the plain list shows and the level is not carried to S3 (as live, Delivery Lead decision §7.1).

**US-M05-13 — Configure a drill**
- **AC-M05-13.1** Given `/practice/MATH`, when it loads, then the header title is "Latih Tubi" with no subtitle (DV-M05-01), the tab title is "Matematik - Latihan", the back link "Kembali ke Senarai Subjek" goes to `/practice`, and the hero shows the icon, "Matematik" and "{total} soalan tersedia".
- **AC-M05-13.2** Given S3 for Matematik, when it loads, then "Pilih Tahap Pendidikan" shows "Semua Tahap" (selected) and D1 "Darjah 1" … D4 "Darjah 4" with their counts; for Sains Komputer only "D4" is offered and for Matematik Tambahan only "Semua Tahap" (0 soalan).
- **AC-M05-13.3** Given I choose "Darjah 2", when the page updates, then that button is indigo with a ring, "Semua"/"Campuran" shows the Darjah 2 total, each difficulty shows its Darjah 2 count, "Sgt Sukar" shows 0, and the summary shows "Tahap Pendidikan:" "Darjah 2" and "Soalan Tersedia:" = the Darjah 2 total.
- **AC-M05-13.4** Given I choose difficulty "Sederhana" and count 20, when the page updates, then the summary shows "Kesukaran:" "Sederhana", "Bilangan Soalan:" "20" and "Soalan Tersedia:" = the Darjah 2 + level 3 count; with no level chosen it equals the level-3 count for all levels.
- **AC-M05-13.5** Given S3, when it loads, then "Bilangan Soalan" shows 5 / 10 / 15 / 20 with 10 selected, and the "Tips" card shows its 4 lines.

**US-M05-14 — Start or not**
- **AC-M05-14.1** Given available ≥ count, when the summary renders, then "Bersedia untuk bermula!" shows and "Mula Kuiz" (green gradient) has href `/practice/MATH/quiz?level=2&difficulty=3&count=20` for Darjah 2 + Sederhana + 20, and `/practice/MATH/quiz?count=10` with no choices.
- **AC-M05-14.2** Given difficulty "Sgt Sukar" (0 available), when the summary renders, then the amber box "Soalan Tidak Mencukupi" / "Kurangkan bilangan soalan atau tukar tetapan penapisan." shows, "Bersedia untuk bermula!" is hidden, "Mula Kuiz" is grey and clicking it does not navigate.
- **AC-M05-14.3** Given `admin@demo.test` (trial used up, no subscription), when S3 loads, then the blue notice reads "Baki percubaan percuma: 0 soalan lagi." with "Langgan untuk akses tanpa had" → `/pricing`; for `pelajarmaju@demo.test` it is not shown.
- **AC-M05-14.4** Given `/practice/XYZ`, when it opens, then the global 404 page is shown.

**US-M05-15 — Random-drill quiz (INFERRED, LS-1)**
- **AC-M05-15.1** **(provisional, LS-1)** Given `pelajarmaju@demo.test` presses "Mula Kuiz" for Matematik Darjah 1, 10 questions, when the quiz page opens, then after the loading state it shows "Soalan 1 daripada 10", a timer starting at "00:00" counting up, a progress bar at 10 %, the question and its options.
- **AC-M05-15.2** Given a question, when I pick an option, then it gets the orange ring and "Semak Jawapan" appears; when I press it, then the correct option turns green with a tick, a wrong pick turns red with a cross, the others dim and are disabled, and the feedback card, "Penjelasan:" (when the question has an explanation) and "Lapor Soalan" appear.
- **AC-M05-15.3** Given the last question is checked, when I look at the button, then it reads "Lihat Keputusan" (chequered flag); before that it reads "Soalan Seterusnya".
- **AC-M05-15.4** **(provisional, LS-8)** Given `admin@demo.test` (trial used up, no subscription), when "Mula Kuiz" is pressed, then the app goes to `/pricing` and no session is created.

**US-M05-16 — Drill results (INFERRED, LS-2)**
- **AC-M05-16.1** **(provisional, LS-2)** Given I finish a 10-question drill with 7 correct, when results show, then they read "7/10", "70%" in yellow, "Masa diambil: MM:SS", the 50–79 band bar and the rewards card with the coins, "{streak} hari", points and balance returned by the mock.
- **AC-M05-16.2** **(provisional, LS-2)** Given the results, when I open "Semakan Semula Jawapan", then one card per answer shows "Jawapan anda:" and, for wrong answers, "| Jawapan betul: …".
- **AC-M05-16.3** **(provisional, LS-2)** Given the session is submitted, when I open S9, then a new card for today with "7 / 10" is first (type badge PROPOSED COPY), and the answers count on S8 and the wrong questions on S6.

**US-M05-17 — Subjective link**
- **AC-M05-17.1** Given any subject and level in the seed (no subjective questions), when S3 renders, then no "Latihan Subjektif" link is present.
- **AC-M05-17.2** Given the mock is given subjective counts for Matematik Darjah 1 (test fixture), when Darjah 1 is selected, then "Latihan Subjektif ({n} soalan)" (pen icon) appears with href `/practice/MATH/subjektif`, and it disappears when "Semua Tahap" is selected.

**US-M05-18 — Chapter subject index**
- **AC-M05-18.1** Given `/practice/chapter`, when it loads, then the header is "Soalan by Chapter" / "Latihan tersusun ikut bab buku teks dan DSKP", the tab title "Soalan by Chapter - PRESTASIPLUS", the hero shows "MODE SISTEMATIK" (source "Mode Sistematik"), "Soalan by Chapter", its text and "Latih Tubi Rawak" → `/practice`.
- **AC-M05-18.2** Given S4, when it loads, then 10 cards (BM, BI, MATH, SCI, SEJ, PI, PM, GEO, BA, JAWI) show icon, name, "{n} bab tersedia" (BM 18, BI 14, MATH 25, SCI 18, SEJ 8, PI 14, PM 14, GEO 8, BA 17, JAWI 13) and "{n} soalan chapter" (BM "4,833", BI "3,521", MATH "6,538", SCI "4,903", SEJ "1,931", PI "3,371", PM "3,307", GEO "800", BA "1,700", JAWI "1,300", as live), linking to `/practice/chapter/{CODE}`.

**US-M05-19 — Chapter list and unlock**
- **AC-M05-19.1** Given `/practice/chapter/MATH`, when it loads as `pelajar2@demo.test`, then the header is "Soalan by Chapter" / "Matematik" (as live) and the h1 "Matematik", the tab title "Chapter Matematik - PRESTASIPLUS", "Semua Subjek" → `/practice/chapter`, "PROGRESSIVE UNLOCK", the unlock sentence, and the level select shows "Darjah 1 — 2,734 soalan", "Darjah 2 — 2,129 soalan", "Darjah 3 — 682 soalan", "Darjah 4 — 993 soalan" with Darjah 1 selected.
- **AC-M05-19.2** Given the same page, when it loads, then "Bab 1: Nombor Bulat hingga 100" is open (teal "1" tile, "0/464 soalan unik · Skor 0% · 464 baki", 4 buttons "5 soalan" … "20 soalan" linking to `/practice/chapter/MATH/{id}/quiz?count=5` … `20`, the live chapter id 1 kept by M03) and Bab 2–8 are locked (lock tile, faded, "Kunci bab sebelumnya", no buttons).
- **AC-M05-19.3** Given I choose "Darjah 2" in the select, when it changes, then the page reloads as `?level=2` with the Darjah 2 chapters and Darjah 2 selected.
- **AC-M05-19.4** Given `pelajarmaju@demo.test`, when `/practice/chapter/MATH` loads, then Bab 1 reads "20/464 soalan unik · Skor 95% · 444 baki" (open, not complete), and Bab 2 "5/302 soalan unik · Skor 60% · 297 baki" and Bab 3 "5/316 soalan unik · Skor 80% · 311 baki" are locked although they have progress (Bab 1 is not complete, D-7 replicated).
- **AC-M05-19.5** Given `admin@demo.test`, when `/practice/chapter/BM` loads, then Bab 1 "18/320 soalan unik · Skor 44.4% · 302 baki" is open and Bab 2 "5/317 soalan unik · Skor 60% · 312 baki" and Bab 3 "10/321 soalan unik · Skor 80% · 311 baki" are locked (as live, D-7).
- **AC-M05-19.6** Given `/practice/chapter/ADDMATH`, when it loads, then "Tiada bab tersedia untuk tahap ini." (layer icon) shows and no level select is rendered (DV-M05-07); `/practice/chapter/XYZ` shows the global 404 page.
- **AC-M05-19.7** Given 375 px, when a chapter list renders, then every chapter title is shown in full on one or more lines (no "…", DV-M05-09) and the 4 buttons wrap.

**US-M05-20 — Chapter quiz (INFERRED, LS-3)**
- **AC-M05-20.1** **(provisional, LS-3)** Given `pelajarmaju@demo.test` presses "5 soalan" on Matematik Bab 1, when the quiz opens, then it has 5 questions of Bab 1 that the user has not answered yet.
- **AC-M05-20.2** **(provisional, LS-3)** Given the test fixture completes Bab 1 for the user (`mock.answerChapter`, every question answered, 90 % correct), when I return to `/practice/chapter/MATH`, then Bab 1 reads "464/464 soalan unik · Skor 90% · 0 baki" and Bab 2 becomes open with its 4 buttons.
- **AC-M05-20.3** Given I open `/practice/chapter/MATH/{Bab 4 id}/quiz?count=5` while Bab 4 is locked, when the route resolves, then I am returned to `/practice/chapter/MATH?level=1` and no session is created.

**US-M05-21 — Revision list**
- **AC-M05-21.1** Given `admin@demo.test`, when `/practice/revision` loads, then the header title is "Soalan Aku Salah" with no subtitle (DV-M05-01), the tab title "Soalan Aku Salah — PRESTASIPLUS", the banner shows "72 soalan perlu diulang kaji", and two cards "Bahasa Melayu" / "Malay Language" / "46 soalan salah" and "Sejarah" / "History" / "26 soalan salah" link to `/practice/revision/BM` and `/SEJ`.
- **AC-M05-21.2** Given S6, when it loads, then "Tips Ulang Kaji" lists its 3 lines and "Kembali ke Latihan" links to `/practice`.
- **AC-M05-21.3** Given `/practice/revision/MATH` for `admin@demo.test` (no queued Matematik question), when it opens, then I am redirected to `/practice/revision` with the info flash "Tiada soalan salah untuk subjek ini. Tahniah!", which is gone after a reload; `/practice/revision/XYZ` shows the global 404 page.
- **AC-M05-21.4** Given `pelajar2@demo.test` (no wrong answers), when S6 loads, then the banner reads "0 soalan perlu diulang kaji" and no subject card is shown (INFERRED, LS-11).

**US-M05-22 — Revision quiz**
- **AC-M05-22.1** Given `admin@demo.test` opens `/practice/revision/BM`, when the page opens, then the header title is "Soalan Aku Salah" with no subtitle, the tab title "Ulang Kaji — Bahasa Melayu", the loading state shows "Memuat Soalan Ulang Kaji..." and "Menyediakan soalan yang pernah dijawab salah", and then the quiz shows "Ulang Kaji — Bahasa Melayu", "Soalan 1 daripada 20", the timer, "Mode Ulang Kaji — soalan ini pernah dijawab salah" and "20 daripada 46 soalan salah".
- **AC-M05-22.2** Given `pelajarmaju@demo.test` opens `/practice/revision/MATH` (each of its 4 queued questions was answered wrong twice), when a question shows, then its card has "Soalan {i}", "Salah 2x" and "Mengikut DSKP" or "Latihan Tambahan" per the question.
- **AC-M05-22.3** Given I pick an option and press "Semak Jawapan", when the answer is correct, then the feedback reads "Betul! Kali ini berjaya!" (green) with the feedback text and the coin animation plays; when wrong, "Masih belum tepat" (red).
- **AC-M05-22.4** Given the mock start call fails with a message, when the page opens, then a browser alert shows that message and the app returns to `/practice/revision`.
- **AC-M05-22.5** Given the check call returns a JSON error response, when I press "Semak Jawapan", then the answer is marked checked and shows red "Masih belum tepat" (as live); given a network failure, nothing changes on screen (the option stays selected, no feedback).

**US-M05-23 — Revision results**
- **AC-M05-23.1** Given I answer 20 questions with 17 correct, when I press "Lihat Keputusan", then the timer stops and the results read "Keputusan Ulang Kaji", "Bahasa Melayu", "17/20", "85%" in green, "Cemerlang! Hampir semua berjaya diperbetulkan!", "Masa diambil: MM:SS", "17 soalan salah berjaya diperbetulkan!" and a green bar at 85 %.
- **AC-M05-23.2** Given scores of 20/20, 10/20 and 6/20, when results show, then the messages are "Sempurna! Semua soalan salah berjaya diperbetulkan!" (green), "Bagus! Teruskan ulang kaji!" (yellow, line "10 soalan salah berjaya diperbetulkan!"), and "Jangan putus asa! Cuba ulang kaji lagi!" (red, no "berjaya diperbetulkan" line).
- **AC-M05-23.3** Given the submit returns rewards, when results show, then "Ganjaran Anda" shows "Syiling Diperoleh", "{n} hari" "Kombo Semasa", "Mata Diperoleh" and "Baki syiling: {n} 🪙"; given the submit fails, the card is not shown.
- **AC-M05-23.4** Given the results, when I open "Semakan Semula Jawapan", then each answer card shows its number, question, "Jawapan anda: {label}. {text}", "| Jawapan betul: …" for wrong ones, "Penjelasan:" when present and "Lapor soalan ini".
- **AC-M05-23.5** Given the 17 correct answers, when I open S6 and S1, then Bahasa Melayu shows 29 wrong questions and the dashboard badge 55; "Ulang Kaji Lagi" starts a new session and "Senarai Subjek" opens `/practice/revision`.

**US-M05-24 — Report a question**
- **AC-M05-24.1** Given a checked question, when I press "Lapor Soalan", then the modal shows "Lapor Soalan", "Soalan ini akan dinyahaktifkan sementara", the 7 reasons with descriptions, an empty comment with "0/500", and "Hantar Laporan" disabled.
- **AC-M05-24.2** Given I tick "Pilihan jawapan tidak lengkap" and "Soalan berulang / pendua", when they are ticked, then their cards are tinted yellow and blue, and "Hantar Laporan" is enabled.
- **AC-M05-24.3** Given I send, when it is sending, then the button reads "Menghantar..." with a spinner; on success the modal shows the green tick, "Terima Kasih!" and "Laporan berjaya dihantar." and the report is stored with source `revision`; with `mock.networkErrorNext` the **same** "Terima Kasih!" view with the green tick shows "Gagal menghantar laporan. Sila cuba lagi." (as live); "Tutup" closes it.
- **AC-M05-24.4** Given the modal is open, when I press "Batal", ×, the backdrop or Esc, then it closes and nothing is sent; reopening shows cleared reasons and comment.

**US-M05-25 — Structured list**
- **AC-M05-25.1** Given `/latihan-berstruktur`, when it loads, then the header title is "Soalan Berstruktur" with no subtitle (DV-M05-01), the tab title "Soalan Berstruktur - PRESTASIPLUS", and the page shows h1 "Soalan Berstruktur" and "Latih tubi format Kertas 2 — jawab & semak secara automatik".
- **AC-M05-25.2** Given the filter, when it loads, then "Subjek" lists "Semua Subjek" + 31 subjects A–Z and "Aras KBAT" lists "Semua", "1. Mengingat" … "6. Mencipta"; choosing Matematik and pressing "Cari" loads `?subject_id=3&kbat_level=` with Matematik still selected.
- **AC-M05-25.3** Given the list, when it loads, then 20 cards show subject chip, KBAT badge ("LOTS 1" green / "MOTS 3" amber / "HOTS 4" red), "{n}m", "Trial" where the question is a trial item, the 3-line preview, topic line when present, author line "{author} · {school}", "{n} soalan · Tingkatan {n}" and "Mula" → `/latihan-berstruktur/{id}/jawab`.
- **AC-M05-25.4** Given more than 20 results, when the page renders at 1280, then the pager shows "Showing 1 to 20 of {total} results" and page links; at 375 it shows "« Previous" (inactive on page 1) and "Next »"; page links keep `subject_id`.
- **AC-M05-25.5** Given Sains Sukan (no questions), when filtered, then the clipboard icon, "Tiada soalan berstruktur buat masa ini" and "Soalan akan ditambah oleh guru dan admin" show and no pager is shown.
- **AC-M05-25.6** Given `/latihan-berstruktur?subject_id=1&scope=spm`, when I press "Cari" or a pager link, then the URL still carries `scope=spm` (hidden input, pager links), and "Mula" links to `/latihan-berstruktur/{id}/jawab?scope=spm`.

**US-M05-26 — Structured answer (INFERRED, LS-7)**
- **AC-M05-26.1** Given I press "Mula" on a card, when `/latihan-berstruktur/{id}/jawab` opens, then the stimulus and each sub-question with its marks are shown, with the hint "Jawab semua sub-soalan, kemudian klik Hantar." and a "Lapor" button that opens the M04 structured report modal.
- **AC-M05-26.2** Given I answer and press "Hantar", when the mock marks the attempt, then a result with marks per sub-question and the model answers is shown (UNVERIFIED layout and copy, SRS §8).
- **AC-M05-26.3** **(provisional, LS-7)** Given the M04 "Buka Soalan Sama" link `/latihan-berstruktur/4454/jawab?scope=spm`, when it opens, then the answer page of set 4454 shows, and its back link returns to `/latihan-berstruktur?subject_id=23&scope=spm` (Subjektif SPM, as M06 FR-M06-47).

**US-M05-27 — Progress**
- **AC-M05-27.1** Given `/practice/progress` as `admin@demo.test`, when it loads, then the header is "Kemajuan Saya" / "Pantau prestasi dan kenal pasti topik lemah", "30 Hari" is active, the tiles read 0, "0%", 0, "0m" and the empty state "Belum Ada Data" / "Mula buat latihan untuk lihat kemajuan kamu di sini!" / "Mula Latihan" → `/practice` shows.
- **AC-M05-27.2** Given `?period=all` as `admin@demo.test`, when it loads, then "Semua" is active and the tiles read "119", "38.7%", "4", "4m" (as live: 119 answers incl. the 35 answers of 19/02 that have no session); the chart has points 19/02, 11/05, 19/05 with "Ketepatan (%)" 57.1, 33.8, 10.0 and "Soalan" 35, 74, 10 and axis titles "Ketepatan (%)" and "Jumlah Soalan".
- **AC-M05-27.3** Given the same, when it loads, then "Subjek Perlu Perhatian" (PROPOSED COPY, DV-M05-08) lists "BM" Bahasa Melayu "79 soalan" "40.5%" and "SE" Sejarah "40 soalan" "35.0%", each "Ulang Kaji" linking to `/practice/revision/BM` and `/practice/revision/SEJ`.
- **AC-M05-27.4** Given the same, when it loads, then "Prestasi Mengikut Subjek" shows Bahasa Melayu "79 soalan dijawab", "40.5%" red, a red bar at 40.5 %, "Trend:" with a falling line and ▼, "32 betul", "47 salah"; Sejarah "40 soalan dijawab", "35.0%", "14 betul", "26 salah" and no trend (one day).
- **AC-M05-27.5** Given `pelajarmaju@demo.test` (all accuracies ≥50 %), when `?period=30` loads, then no "Subjek Perlu Perhatian" card is shown and Matematik reads "37 soalan dijawab", "70.3%".
- **AC-M05-27.6** Given `/practice/progress?period=zzz`, when it loads, then no period chip is active and the tiles show zero figures (OBSERVED).

**US-M05-28 — History**
- **AC-M05-28.1** Given `/practice/history` as `admin@demo.test`, when it loads, then the header is "Sejarah Latihan" / "Rekod latihan dan prestasi anda", the cards read "JUMLAH SESI" 4, "SOALAN DIJAWAB" 84, "PURATA KETEPATAN" 21.8%, "SYILING DIKUMPUL" 26 (as live), and "Semua" is the active pill.
- **AC-M05-28.2** Given the same, when it loads, then the 4 SPM sessions are listed newest first, each with the badge "Latihan" (`fa-book`, #6B7280, as live); the first reads "19 May 2026, 03:49", "0 / 5", "00:14", "0 betul", "5 salah", "💪 CUBA LAGI", "0.0%", no inner bar label, "Ketepatan: 0.0%", 🪙 0 "SYILING"; the second "19 May 2026, 03:26", "1 / 5", "00:36", "20.0%", inner label "20%", 🪙 1; then "11 May 2026, 14:27" "11 / 34" "01:45" and "11 May 2026, 14:22" "14 / 40" "02:11".
- **AC-M05-28.3** Given `?period=week` as `admin@demo.test`, when it loads, then the 4 cards still show the all-time totals and the empty state "Belum Ada Rekod Latihan" with its text and "Mula Latihan" → `/practice` shows.
- **AC-M05-28.4** Given a session card, when I click it, then nothing happens (no detail page).
- **AC-M05-28.5** Given a user with more sessions than one page (test fixture), when S9 loads, then the Laravel pager shows under the list.
- **AC-M05-28.6** Given `/practice/history?period=zzz`, when it loads, then no pill is active and all 4 sessions are listed (OBSERVED).

**US-M05-29 — Corrections**
- **AC-M05-29.1** Given `/pembetulan` as `admin@demo.test`, when it loads, then the header is "Pembetulan" / "Lihat peningkatan selepas pembetulan jawapan", the bar reads "Bulan:" ‹ "September 2026" with › as a disabled grey control, and the empty state "Tiada Data Pembetulan" with its text shows.
- **AC-M05-29.2** Given `?bulan=2026-05`, when it loads, then "Mei 2026" shows with ‹ → `?bulan=2026-04` and › → `?bulan=2026-06`, "RINGKASAN KESELURUHAN" "33.8%" "SEBELUM", "33.8%" "SELEPAS", "0.0%" (grey) "PENINGKATAN", "Berdasarkan 74 soalan bulan ini", and "MENGIKUT SUBJEK" rows Sejarah "40 soalan" 35.0 % / 35.0 % / "0.0%" and Bahasa Melayu "34 soalan" 32.4 % / 32.4 % / "0.0%".
- **AC-M05-29.3** Given `?bulan=2026-10` (a future month), when it loads, then the › is disabled (DV-M05-10) and the empty state shows.
- **AC-M05-29.4** Given `pelajarmaju@demo.test`, when `/pembetulan` loads, then September 2026 shows "Sebelum" 76.7%, "Selepas" 86.7%, "Peningkatan" "+10.0%" (INFERRED positive style) and "Berdasarkan 30 soalan bulan ini".
- **AC-M05-29.5** Given `/pembetulan?bulan=abc` or `?bulan=2026-13`, when it loads, then the current month (September 2026) is shown (DV-M05-13; live answers HTTP 500).

**US-M05-30 — Mastery**
- **AC-M05-30.1** Given `/penguasaan`, when it loads, then the header is "Tahap Penguasaan" / "Jejak kemajuan anda dalam setiap subjek", the tab title "Tahap Penguasaan", and "SKALA PENGUASAAN" lists "L0 Pemula" … "L10 Mythical" in their colours.
- **AC-M05-30.2** Given `admin@demo.test`, when it loads, then Bahasa Melayu "(BM)" shows "L2 Aktif", "46" "Betul", "94" "Dijawab", "48.9%" "Tepat" (red), "Menuju L3", "46/50 betul", a blue bar at 84 %, "x1.05 XP", "Terakhir: 4 bulan yang lepas"; Sejarah "(SEJ)" shows "L1 Mula Belajar", 14 / 40 / "35.0%", "Menuju L2", "14/25 betul", bar 26.7 %, no XP line (as live).
- **AC-M05-30.3** Given `pelajar@demo.test`, when it loads, then Bahasa Melayu shows "L2 Aktif", "Menuju L3", "26/50 betul", a 4 % bar and "x1.05 XP", and Matematik shows "L0 Pemula", "Menuju L1", "4/10 betul" and a 40 % bar.
- **AC-M05-30.4** Given `pelajar2@demo.test`, when it loads, then only the scale card is shown (INFERRED, LS-11).

**US-M05-31 — Remedial**
- **AC-M05-31.1** Given `/remedial/saya`, when it loads, then the header title is "Ujian Remedial Saya" with no subtitle (DV-M05-01), the tab title "Ujian Remedial Saya", the heading 🔬 "Ujian Remedial Saya" with its subtitle, and 🎯 "Tiada ujian remedial. Bagus — teruskan usaha!".
- **AC-M05-31.2** *(provisional, LS-12)* Given student 3008 with the M10 remedial test 7601 (Kimia, 5 questions, active), when 3008 opens `/remedial/saya`, then one card shows "Kimia", "5 soalan", the teacher name, the date and the start button → `/remedial/7601`; a test with status `cancelled` is not listed; with no test the observed empty state shows (AC-31.1).
- **AC-M05-31.3** *(provisional, LS-12)* Given 3008 opens `/remedial/7601`, when the quiz loads, then it serves the test's 5 questions in stored order (session mode `remedial`, `remedialTestId` 7601); when 3008 submits with 2 correct, then test 7601 becomes `completed` with `afterAccuracy` 40.0, the card shows the completed status without a start button, and the coins are 2 (1 per correct). `/remedial/7602` (3007's test) opened by 3008, and `/remedial/999999`, show the global 404 page; `/remedial/7602` opened by 3007 (completed) returns to `/remedial/saya`.
- **AC-M05-31.4** *(provisional, LS-12; PROPOSED)* Given teacher 5 (the teacher of test 7601) or `admin@demo.test`, when they open `/remedial/7601` (the M10 "Lihat Quiz" link), then a read-only preview shows the test's 5 questions with their options and the correct option marked, with no check or submit button and no session or answer written; `guru2` (another teacher) gets the global 404 page.

**US-M05-32 — Teacher missions**
- **AC-M05-32.1** Given `/misi-harian`, when it loads, then the header is "Misi Harian" / "Selesaikan misi, kumpul syiling!", the tab title "Misi Harian — PrestasiPlus", and the card shows the inbox icon, "Tiada misi hari ini" and "Misi baru akan muncul bila guru anda assign.".
- **AC-M05-32.2** Given the dashboard quest widget, when I look at it, then it has no link to `/misi-harian` (two separate features, D-12 replicated).
- **AC-M05-32.3** *(provisional, LS-12)* Given teacher 5 launches today a Latih Tubi mission of Kimia with 10 questions for class 2001 (M10), when student 3001 opens `/misi-harian`, then a card shows the title, the type label, "Kimia", "10 soalan", "3 syiling per jawapan betul" and the start button → `/misi-harian/{id}`; missions dated another day (M10 7101, 7102) are not listed.
- **AC-M05-32.4** *(provisional, LS-12)* Given 3001 starts that mission and submits with 4 correct answers, when the result shows, then `coinsEarned` = 12 (3 × 4) and the wallet grows by 12, the session has mode `mission` and the `missionId`, the card shows the completed status, and a second start returns the "already completed" error (409).
- **AC-M05-32.5** *(provisional, LS-12)* Given a mission for today whose M10 question pool is empty (e.g. a chapter without tagged questions), when the student starts it, then the alert "Soalan tidak mencukupi." shows, no session is created and the student returns to `/misi-harian`.

**US-M05-33 — SPM targets view**
- **AC-M05-33.1** Given `/target-spm` as `admin@demo.test`, when it loads, then the header is "Target SPM Saya" / "Tetapkan target gred SPM dan pantau kemajuan anda", the card "Target Gred SPM" with its subtitle and "Simpan", and 20 rows from "Bahasa Arab" to "Tasawwur Islam", each "Belum mula", an empty grey bar, "-" and a select starting with "Target" followed by A+, A, A-, B+, B, C+, C, D, E.
- **AC-M05-33.2** Given the legend, when it loads, then it shows "70%+ Ketepatan (On Track)" (green dot), "50-69% (Perlu Usaha)" (amber), "<50% (Perlu Fokus)" (red) and "Tip: Jawab lebih banyak soalan untuk ramalan gred yang lebih tepat".
- **AC-M05-33.3** Given `admin@demo.test` (84 answers in SPM "Tahun Lepas" and "Latih Tubi" sessions, BM and SEJ) and `pelajar@demo.test` (4 SPM sessions), when S15 loads, then every row still reads "Belum mula" with an empty track and "-" (OBSERVED: SPM answers do not start a row); pelajar's saved targets are selected (Bahasa Melayu "A", Matematik "B+", Sejarah "A-"). **(provisional, LS-10)** With the test fixture `mock.setSpmProgress(pelajar, BM, {answered: 12, correct: 9})`, the Bahasa Melayu row shows a green bar at 75 % and a predicted grade per SRS BR-27.
- **AC-M05-33.4** Given 375 px, when S15 renders, then every row's progress bar is visible with a usable width (DV-M05-12).

**US-M05-34 — Save SPM targets**
- **AC-M05-34.1** Given I choose "A+" for Fizik and "" (Target) for Bahasa Melayu and press "Simpan", when the save succeeds, then the page reloads with the success message (UNVERIFIED COPY), Fizik shows "A+" and Bahasa Melayu shows "Target".
- **AC-M05-34.2** Given the save fails (`mock.failNext`), when I press "Simpan", then the error message (UNVERIFIED COPY) shows and the choices stay as I left them.

**US-M05-35 — Menus**
- **AC-M05-35.1** Given 1280 px, when any M05 page loads, then the sidebar shows "Dashboard", "Target SPM", "Misi Harian", "Remedial" at the top, "Pembetulan" and "Penguasaan" under "💎 Killer Features", and "Latih Tubi", "Soalan by Chapter", "Soalan Berstruktur" under "Pembelajaran", with the hrefs of FN-M05-9.1.1–9.1.3.
- **AC-M05-35.2** Given 375 or 768 px, when I open the drawer, then it contains "Dashboard", "Pembetulan", "Penguasaan", "Latih Tubi", "Soalan by Chapter", "Soalan Berstruktur" and no "Target SPM", "Misi Harian" or "Remedial"; the bottom nav "Home" links to `/dashboard`.
- **AC-M05-35.3** Given each M05 page, when it loads, then the menu item of FN-M05-9.1.6 is active.

**US-M05-36 — Consistent numbers**
- **AC-M05-36.1** Given the M04 D11 dataset, when I compare for each subject its S2 card, S1 subject card and S1 "Statistik Subjek" card, then S2 = S1 card (Q-ELIGIBLE(subject), M04 SRS §4.1) and "Statistik Subjek" = Q-ACTIVE(subject), so they differ only where the subject has active non-approved questions (Q-ARCHIVED-ACTIVE: Pendidikan Moral 15014 vs 15414, as live); Σ cards = Q-ELIGIBLE 128,989, Σ statistics = Q-ACTIVE 129,389; the S3 "Semua Tahap" total is Q-PRACTICE(subject) (Q-ELIGIBLE at Darjah 1–4) (e.g. Matematik 6,538).
- **AC-M05-36.2** Given `admin@demo.test`, when I compare pages, then S8 (`period=all`) "Sesi Latihan" = S9 "Jumlah Sesi" = 4, S8 answered 119 = S9 "Soalan Dijawab" 84 + the 35 answers without a session, and the S1 badge = S6 total = 72; S12 shows its own counters (BM 94 answered, as live).
- **AC-M05-36.3** Given S1 and S4/S5, when I compare, then "Total Soalan" (130152) = Q-ACTIVE + Q-PKSK (Σ "Statistik Subjek" 129,389 + 763), "Soalan Approved" (129752) = Q-ELIGIBLE + Q-PKSK (Σ subject cards 128,989 + 763), and each S4 "{n} soalan chapter" equals the sum of that subject's S5 level options.
- **AC-M05-36.4** Given S2, S3, S4, S5, S8 and S1, when they render numbers ≥1,000, then S2–S5 use ms-MY separators ("1,234") and S1 cards and statistics use none ("1234"), as live.
- **AC-M05-36.5** Given `admin@demo.test`, when M06 S10 (`/spm/history`) or the API `GET /api/practice/sessions?modes=past_year,latih_tubi,ramalan` reads the practice store, then it lists the same 4 SPM sessions as S9, newest first (A5 19 May 03:49, A4, A3, A2), with stats 4 sessions / 21.8% / 26 coins / 84 answers; `&type=past_year` lists A5 and A4 with the same stats; `&type=zzz` lists all 4 with no active type (as live).

**US-M05-37 — Access**
- **AC-M05-37.1** Given no session, when I open any M05 route (`/dashboard`, `/practice`, `/practice/MATH`, `/practice/chapter`, `/practice/revision`, `/practice/progress`, `/practice/history`, `/latihan-berstruktur`, `/pembetulan`, `/penguasaan`, `/remedial/saya`, `/misi-harian`, `/target-spm`), then I am sent to `/login`.
- **AC-M05-37.2** Given the mock API, when an M05 endpoint is called without a session, then it answers `401 UNAUTHORIZED`.

**US-M05-38 — Every device**
- **AC-M05-38.1** Given any M05 screen at 375, 768 or 1280 px, when it renders, then there is no horizontal page scroll and the layout matches SRS §10.
- **AC-M05-38.2** Given S1, S2, S3, S4 and S12, when they render, then every subject with a non-empty M03 icon value shows a visible icon glyph (DV-M05-02).
- **AC-M05-38.3** Given 375 px, when S1, S3, S9, S12 and S15 render, then no text inside `main` is smaller than 12 px, including the S3 hero chip "soalan tersedia" and the S9 coin label "SYILING" (DV-M05-11); decorative icons and emoji keep their live size.


**US-M05-39 — SPM variants of the structured list**
- **AC-M05-39.1** Given `/latihan-berstruktur?subject_id=3&scope=spm`, when it loads, then it shows "Kembali ke Subjektif SPM" → `/spm/subjektif`, h1 "Subjektif SPM", "Pilih set struktur dan esei Tingkatan 4 atau 5 mengikut subjek semasa", a filter with hidden `scope=spm` and "Subjek" options "Semua Subjek" + the 15 SPM subjects in the order of FN-M05-5.3.3, and set cards with the indigo "Tingkatan {n}" chip and "{n} bahagian · {m} markah"; the shell header is "Subjektif SPM" (M06 DV-M06-07).
- **AC-M05-39.2** Given `/latihan-berstruktur?subject_id=1&scope=spm&track=bahasa`, when it loads, then it shows "Kembali ke Tracking A SPM" → `/spm/ramalan`, the "TRACKING A BAHASA" pill, h1 "Tracking A Bahasa", its sub-line, the info card with "{n} set ditemui", hidden `scope=spm` and `track=bahasa`, and "Subjek" options "Semua Subjek", "Bahasa Melayu", "Bahasa Inggeris".
- **AC-M05-39.3** Given either variant, when I read "Mula" and the pager links, then "Mula" is `/latihan-berstruktur/{id}/jawab?scope=spm` (plus `&track=bahasa` in Tracking A) and every pager link keeps `subject_id`, `scope`, `track` and `kbat_level`.
- **AC-M05-39.4** Given `/latihan-berstruktur?subject_id=3&scope=spm&kbat_level=6`, when it loads, then the S10 empty state "Tiada soalan berstruktur buat masa ini" / "Soalan akan ditambah oleh guru dan admin" shows with no pager.

**US-M05-40 — Teacher question sets**
- **AC-M05-40.1** *(provisional, LS-12)* Given student 3001 (enrolled in class 2002) and the M10 set 7402 (published, 1 attempt, questions 700201–700210), when 3001 opens `/set-soalan-saya/7402/jawab`, then the quiz serves the 10 questions in set order (session mode `question_set`, `questionSetId` 7402); after submitting, a second start returns "no attempts left" (409); set 7401 (draft) and a set of a class 3001 is not in show the global 404 page; a set with a time limit shows a countdown and submits at 0.

**US-M05-41 — Platform answer log**
- **AC-M05-41.1** Given the default seed at the mock clock, when the named queries of SRS §6.14.2 run, then Q-ANS-ALL = 478,499, Q-ANS-CORRECT = 396,391 (82.8 %; the active pupils' 395,873 correct of 477,743 = 82.9 %, M17), Q-SESS-ALL = 32,122, Q-ANS-SEG = 472,371 (7d 7,651, 30d 22,207, 3m 86,697; each school-week cell as M11 §6.7, plus 12 answers before M1), Q-ANS-OTHER = 6,128; class 228 1,618 sessions / 34,882 answers / 77.6 %; T4 11 sessions and T5 29,971 sessions with a session-mean accuracy (Q-SESS-MEAN-ACC) of 63.9 % and 79.7 % (M08 targets, XL3-02); week participants 46 — the M08 and M11 observed figures.
- **AC-M05-41.2** Given the per-user anchors, when read through Q-ANS-USER and Q-SESS-USER, then admin 119 answers / 46 correct and 4 sessions, pelajar 94 answers, pelajarmaju 37, students 3001–3008 83 answers / 38 correct in 14 sessions — the values of SRS §6.12 and M08 §6.10, unchanged by the generated rows — and every M05 screen figure asserted by the other ACs is unchanged.
- **AC-M05-41.3** Given the test hook `mock.addAnswer({userId: 3008, questionId: 700001, isCorrect: true})`, when it runs, then one answer with an id ≥ 9,000,001, `subjectId` 10 (from M04), `sessionId` null and `answeredAt` = the mock clock is written; Q-ANS-USER(3008, Kimia) goes from 1/8 to 2/9, Q-ANS-ALL to 478,500, and 3008's Kimia mastery counters grow by 1 answered and 1 correct.
- **AC-M05-41.4** Given the answer log, when answers without a session are counted, then they are 6,604 — admin 35 (19/02), pupils 3201–3215 6,563 (school 8880, class 516) and pupil 2022 6 — so session answers are 471,895; class 516 and the T4 classes keep 0 and 11 sessions (M08); pupil 2022's 123 sessions have no subject ("Latihan Bebas"); the 2 orphan answers of 8880 (week M8) point to a question that no longer exists and keep their stored subject.
- **AC-M05-41.5** Given the M12 Kirkpatrick segment store, when its queries run, then it holds 20,991 sessions with 306,133 answered and 253,478 correct questions (M12 §6.5), and Q-SESS-ALL (32,122) and Q-ANS-ALL (478,499) are unchanged by it.
- **AC-M05-41.6** Given the M18 anchors, when the per-pupil subject accuracy set and the mastery counters are read, then the accuracy rows of M18 §6.11 C (8765 X / Y; "0%" rows at 3160 BI, 2700 BM / MT / SEJ, 8767 Sains / SEJ) come from the separate set, and the 38 SubjectMastery rows of the 12 KLUANG pupils give 14 Pemula, 20 Mula Belajar and 4 Aktif; neither changes the answer log.
- **AC-M05-41.7** Given `pelajar@demo.test` and `pelajarmaju@demo.test`, when S1 settles, then the wallet cards read 370 / "Mata (Lvl 1)" 916 and 267 / "Mata (Lvl 3)" 432, both bars at 100 % (M14); when any session is submitted, then M05 calls M14 `gamification.onSessionCompleted` once (with `coinsPerCorrect` 3 for a mission) and the results card shows the coins, streak and balance it returns.
- **AC-M05-41.8** Given `mock.addSession(3, {mode: 'random', correct: 5, total: 10, timeSpentSec: 300, at})`, when it runs, then one completed session without answers is stored: S9 for pelajar2 shows 1 session and Q-ANS-ALL is unchanged.
- **AC-M05-41.9** Given the week of the clock, when Q-WEEK-RANK runs, then each row has sessions, Σ correct and the mean session accuracy (M16 BR-M16-31), top 20 by correct then user id, pelajarmaju at its computed rank with 26 correct (the observed M16 rows provisional until XL3-16); and Q-STRUCT for the active pupils gives 3 / 13 / 954 structured attempts over 7 / 30 / 90 days (M17).
- **AC-M05-41.10** Given M07 completes a PKSK practice for pupil 3 through `practice.completeSession` with 5 answers (3 correct), when it returns, then one completed session with mode `pksk`, its domain and target level and `subjectId` null is stored with 5 answers (`subjectId` null), M14 `gamification.onSessionCompleted` is called with mode `pksk`, the revision queue, mastery counters and trial counter are unchanged, and S9 for pelajar2 lists the session with the label "PKSK"; with the seed alone, no `pksk` session exists and Q-SESS-LINK gives 7103: 5 and 7104: 3.

**Count:** 41 user stories · 164 acceptance criteria.

---

## 5. UI expectations

Behaviour and content match the live site, including its look (design tokens in `00-global-ui.md` §6; Font Awesome icons mapped to Lucide, SRS NFR-M05-06). Visual reference: `docs/discovery/img/M05/`.

| Screen | Key content and states | Screenshots |
|---|---|---|
| S1 | Header; hero greeting; trial card; carousel (5 slides, expand, arrows, dots); Kombo banner; 5 stat cards; Misi Harian (10 quests, chest); badge shelf (empty); quick actions (+ "Panel Admin" for admin); articles strip + aside (desktop); subject cards; platform statistics; level pills; latest questions; difficulty chart; subject statistics. | `dashboard-desktop/tablet/mobile.png`, `dashboard-top-desktop.png`, `dashboard-carousel-slide2-expanded.png` |
| S2 | Hero, chapter-mode banner, 31 subject cards. | `practice-desktop/tablet/mobile.png` |
| S3 | Back link, trial notice, hero, level / difficulty / count selectors, sticky summary with ready pill or insufficient warning, "Mula Kuiz", tips. | `subject-config-default/selected/insufficient-desktop.png`, `subject-config-addmath-empty.png`, `subject-config-tablet/mobile.png` |
| Quiz pages (random, chapter) | The S7 quiz and results template (INFERRED). | none (LS-1…LS-3) |
| S4 | Hero, 10 subject cards. | `chapter-index-desktop/mobile.png` |
| S5 | Hero with level select; open, locked (with progress) chapter cards; empty level. | `chapter-math-desktop/tablet/mobile.png` (mobile truncation = DV-M05-09), `chapter-bm-progress-desktop.png`, `chapter-addmath-empty.png` (empty select = DV-M05-07) |
| S6 | Banner with total, subject cards, tips, back link, info flash. | `revision-desktop.png`, `revision-flash-none.png`, `revision-mobile.png` |
| S7 | Loading; quiz (chips, question card, options, feedback, report); results (rewards, review); report modal. | none (source only; LS-4) |
| S8 | Period chips, 4 tiles, empty state; chart, weak subjects, per-subject cards. | `progress-empty-desktop.png`, `progress-all-desktop/tablet/mobile.png` |
| S9 | 4 cards, filter pills, session cards, empty state. | `history-desktop.png`, `history-empty-desktop.png`, `history-mobile.png` |
| S10 | Heading, filter, cards, pager (desktop numbers / mobile Previous-Next), empty state. | `berstruktur-desktop/tablet/mobile.png`, `berstruktur-empty.png` |
| S10 SPM variants | Back link, SPM heading (and Tracking A info card), reduced subject list, cards with level chip and "{n} bahagian · {m} markah", pager and "Mula" keeping `scope`/`track`. | `docs/qa/audit/img/M05/s10-scope-spm-1280.png`; M06 `img/M06/tracking-bahasa-*.png`, `subjektif-list-*.png` |
| S11 | Month bar, empty state, summary, per-subject bars. | `pembetulan-empty-desktop.png`, `pembetulan-may-desktop/mobile.png` |
| S12 | Scale card, subject cards. | `penguasaan-desktop/mobile.png` |
| S13, S14 | Heading and empty states. | `remedial-empty-desktop/mobile.png`, `misi-harian-empty-desktop/mobile.png` |
| S15 | Target card with 20 rows, legend. | `target-spm-desktop/mobile.png` (mobile bar = DV-M05-12) |

### 5.1 Live-session states (LS-1 … LS-12)

These states need a practice session (or teacher data) on the live site; the user has not yet approved creating one (discovery §9). They are specified from the captured page source where it exists (**SOURCE-DERIVED**) and otherwise as the most likely live behaviour (**INFERRED**, texts **UNVERIFIED COPY** with the SRS §8 placeholders). No new UX is added: every inferred state reuses a captured template.

| LS | State | How it is specified | Functions |
|---|---|---|---|
| LS-1 | Random-drill quiz (loading, question, selected, checked, feedback, last-question button, timer) | INFERRED: the S7 quiz template (SOURCE-DERIVED) without the revision-only chips; header/title texts PROPOSED COPY; ACs/E2E provisional | FN-M05-2.3.1, 2.3.2 |
| LS-2 | Random-drill results, rewards, review, retry | INFERRED: the S7 results template; heading and messages UNVERIFIED | FN-M05-2.3.3 |
| LS-3 | Chapter quiz + results; chapter card after completion and unlock | INFERRED: same template; unlock rule from the observed copy (FN-M05-3.2.7); completed card = open card | FN-M05-3.2.8, 3.3.1, 3.3.2 |
| LS-4 | Revision quiz rendered live (all S7 states) | SOURCE-DERIVED (template and script of `/practice/revision/{CODE}`) | FN-M05-4.2.1 … 4.2.14 |
| LS-5 | Report success/failure message from the server | SOURCE-DERIVED client texts; server message INFERRED ("Laporan berjaya dihantar.", M04 BR) | FN-M05-4.3.3 |
| LS-6 | Subjective drill | Not built (never offered on live) | FN-M05-2.4.1, 2.4.2 |
| LS-7 | Structured answer page (plain and `?scope=spm[&track=bahasa]`), marking, feedback | INFERRED minimal page from M04 structured-question data plus the observed hint and "Lapor" button; back link per `scope`/`track`; marking UNVERIFIED | FN-M05-5.2.1, 5.2.2 |
| LS-8 | Trial-exhausted gate at quiz start | INFERRED: redirect to `/pricing`; ACs/E2E provisional | FN-M05-2.3.1 |
| LS-9 | Quest progress, completed quests, open chest popup, badge shelf with badges | Progress by M14 `challenges.today` (M14 BR-M14-13; SRS BR-10) in the observed card; completed/open/badge styling UNVERIFIED | FN-M05-1.4.4, 1.4.5, 1.5.2 |
| LS-10 | S15 saved targets, success message, rows with progress and predicted grade | OBSERVED: SPM answers do not start a row (admin, 84 SPM answers, all "Belum mula"). The source that does is UNVERIFIED; the prototype shows progress only through a provisional test fixture (SRS BR-27); texts PROPOSED COPY | FN-M05-8.3.4, 8.3.6 |
| LS-11 | S11 positive improvement, S12 higher levels and no-data state, S9 other grade labels and session types, S6 with no wrong answers | INFERRED; texts UNVERIFIED | FN-M05-4.1.7, 6.2.7, 7.1.4, 7.2.5 |
| LS-12 | S13 remedial tests, S14 teacher missions, their quiz pages and the question-set quiz | M10 creates the data; M05 owns the student side (v1.6, XL2-08). Populated lists and quiz pages are PROPOSED (layout, copy), their rules INFERRED, the mission rate OBSERVED on live M10; ACs/E2E provisional; the observed empty states stay | FN-M05-8.1.4, 8.1.5, 8.2.3, 8.2.4, 8.4.1 |

---

## 6. Coverage matrix (completeness proof)

Source: `docs/discovery/inventory/M05/` (generated 2026-09-25). Generated by script (`gen.js` in the author's scratchpad, reproducible from `fns.js` + the inventory JSON): every M05 content element (S1–S6, S8–S15) is listed with the Function that covers it, or a concrete exclusion reason. Each element maps to exactly one Function. Data rows were inventoried with `repeat` limits (S1: 4 of 31 subject cards, 3 of 31 subject-stat cards, 2 of 5 recent questions; S2: 3 of 31 cards; S5: 3 chapter cards per state; S9: 2 session cards; S10: 3 of 20 cards; S15: 4 of 20 rows) — every row of the same kind is covered by the same Function. S7 has no inventory (never rendered; discovery §2.7): its 16 Functions are mapped to the source narrative in §3. Shell elements are layout chrome owned by the global shell / M23; only the M05-relevant ones are mapped individually, the rest are listed by ID range with their owner. "Content" quotes the DOM text as captured (source casing).

**Summary**

| Set | Elements | Mapped to an M05 Function | Excluded (with reason) | Unmapped |
|---|---|---|---|---|
| M05 content (S1–S6, S8–S15) | 860 | 818 | 42 (tournament banner, M16) | 0 |
| User-portal shell SHU | 391 | 40 | 351 (global shell / other modules) | 0 |
| S7 (no inventory; source only) | — | 16 Functions mapped to discovery §2.7 | — | — |

**860/860 M05 content elements covered (818 mapped to a Function, 42 excluded with a concrete reason), 0 unmapped.** Including the shell: 1251/1251 elements accounted for (858 mapped, 393 excluded with reason). 95 of the 167 Functions in §3 appear in this matrix; 16 map to the S7 source narrative, 5 to the M06 inventory by cross-reference, and 51 are behaviour-only.

### 6.1 M05 content elements

#### S1 — `/dashboard` (323 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M05-S1-001 | text | hidden-only | "LIVE:", fa-circle | Excluded: M16 tournament banner (global widget) |
| EL-M05-S1-002 | text | hidden-only | "MAIN" | Excluded: M16 tournament banner (global widget) |
| EL-M05-S1-003 | text | hidden-only | "DAFTAR" | Excluded: M16 tournament banner (global widget) |
| EL-M05-S1-004 | heading | visible-default | "Selamat Petang, Admin PRESTASI+ 👋" | FN-M05-1.1.2 |
| EL-M05-S1-005 | text | visible-default | "Jom teruskan latihan hari ini! 🚀" | FN-M05-1.1.2 |
| EL-M05-S1-006 | text | visible-default | "🎓" | FN-M05-1.1.2 |
| EL-M05-S1-007 | text | visible-default | "Percubaan Percuma" | FN-M05-1.1.3 |
| EL-M05-S1-008 | text | visible-default | "Baki 0 / 50 soalan" | FN-M05-1.1.3 |
| EL-M05-S1-009 | link | visible-default | "Langgan Sekarang", → /pricing, fa-rocket | FN-M05-1.1.3 |
| EL-M05-S1-010 | card | visible-default | "HERO" | FN-M05-1.2.1 |
| EL-M05-S1-011 | badge | visible-default | "HERO" | FN-M05-1.2.1 |
| EL-M05-S1-012 | text | visible-default | "Selamat Datang ke PRESTASIPLUS" | FN-M05-1.2.1 |
| EL-M05-S1-013 | text | visible-default | "Platform pembelajaran interaktif untuk pelajar sekolah. Jom mula belajar hari ini!" | FN-M05-1.2.1 |
| EL-M05-S1-014 | toggle | visible-default | "Baca Selanjutnya", fa-chevron-down | FN-M05-1.2.2 |
| EL-M05-S1-015 | button | visible-default | fa-chevron-left | FN-M05-1.2.3 |
| EL-M05-S1-016 | button | visible-default | fa-chevron-right | FN-M05-1.2.3 |
| EL-M05-S1-017 | card | conditional (state captured @1280 only) | "FEATURE" | FN-M05-1.2.1 |
| EL-M05-S1-018 | badge | conditional (state captured @1280 only) | "FEATURE" | FN-M05-1.2.1 |
| EL-M05-S1-019 | text | conditional (state captured @1280 only) | "2,000+ Soalan Latihan Tersedia!" | FN-M05-1.2.1 |
| EL-M05-S1-020 | text | conditional (state captured @1280 only) | "Latih diri dengan ribuan soalan Matematik, Sains, BM dan BI. Kumpul coins dan naik ranking…" | FN-M05-1.2.1 |
| EL-M05-S1-021 | toggle | hidden-only | "Baca Selanjutnya", fa-chevron-down | FN-M05-1.2.2 |
| EL-M05-S1-022 | button | conditional (state captured @1280 only) | fa-chevron-left | FN-M05-1.2.3 |
| EL-M05-S1-023 | button | conditional (state captured @1280 only) | fa-chevron-right | FN-M05-1.2.3 |
| EL-M05-S1-024 | card | hidden-only | "PROMOTIONAL" | FN-M05-1.2.1 |
| EL-M05-S1-025 | badge | hidden-only | "PROMOTIONAL" | FN-M05-1.2.1 |
| EL-M05-S1-026 | text | hidden-only | "Cabaran Mingguan: Siapa Paling Rajin?" | FN-M05-1.2.1 |
| EL-M05-S1-027 | text | hidden-only | "Sertai cabaran mingguan dan lihat nama kamu di papan pendahulu. Streak 7 hari = bonus coin…" | FN-M05-1.2.1 |
| EL-M05-S1-028 | toggle | hidden-only | "Baca Selanjutnya", fa-chevron-down | FN-M05-1.2.2 |
| EL-M05-S1-029 | button | hidden-only | fa-chevron-left | FN-M05-1.2.3 |
| EL-M05-S1-030 | button | hidden-only | fa-chevron-right | FN-M05-1.2.3 |
| EL-M05-S1-031 | card | hidden-only | "ANNOUNCEMENT" | FN-M05-1.2.1 |
| EL-M05-S1-032 | badge | hidden-only | "ANNOUNCEMENT" | FN-M05-1.2.1 |
| EL-M05-S1-033 | text | hidden-only | "Tips untuk Ibu Bapa: Bimbing Anak Belajar" | FN-M05-1.2.1 |
| EL-M05-S1-034 | text | hidden-only | "Panduan untuk ibu bapa membantu anak-anak cemerlang dalam pelajaran. Klik untuk baca lebih…" | FN-M05-1.2.1 |
| EL-M05-S1-035 | toggle | hidden-only | "Baca Selanjutnya", fa-chevron-down | FN-M05-1.2.2 |
| EL-M05-S1-036 | button | hidden-only | fa-chevron-left | FN-M05-1.2.3 |
| EL-M05-S1-037 | button | hidden-only | fa-chevron-right | FN-M05-1.2.3 |
| EL-M05-S1-038 | card | conditional (state captured @1280 only) | "FEATURE" | FN-M05-1.2.1 |
| EL-M05-S1-039 | badge | conditional (state captured @1280 only) | "FEATURE" | FN-M05-1.2.1 |
| EL-M05-S1-040 | text | conditional (state captured @1280 only) | "Kumpul Badge & Tunjukkan Kehebatan!" | FN-M05-1.2.1 |
| EL-M05-S1-041 | text | conditional (state captured @1280 only) | "15 badge istimewa menanti! Jawab soalan, kekalkan streak, dan jadi juara kelas." | FN-M05-1.2.1 |
| EL-M05-S1-042 | toggle | conditional (state captured @1280 only) | "Baca Selanjutnya", fa-chevron-down | FN-M05-1.2.2 |
| EL-M05-S1-043 | button | conditional (state captured @1280 only) | fa-chevron-left | FN-M05-1.2.3 |
| EL-M05-S1-044 | button | conditional (state captured @1280 only) | fa-chevron-right | FN-M05-1.2.3 |
| EL-M05-S1-045 | button | visible-default | (button) | FN-M05-1.2.4 |
| EL-M05-S1-046 | button | visible-default | (button) | FN-M05-1.2.4 |
| EL-M05-S1-047 | button | visible-default | (button) | FN-M05-1.2.4 |
| EL-M05-S1-048 | button | visible-default | (button) | FN-M05-1.2.4 |
| EL-M05-S1-049 | button | visible-default | (button) | FN-M05-1.2.4 |
| EL-M05-S1-050 | text | visible-default | "1 / 5" | FN-M05-1.2.4 |
| EL-M05-S1-051 | text | visible-default | "⚠️" | FN-M05-1.3.1 |
| EL-M05-S1-052 | heading | visible-default | "Kombo 1 hari akan putus!" | FN-M05-1.3.1 |
| EL-M05-S1-053 | text | visible-default | "Jangan lepaskan! Buat sekurang-kurangnya 1 latihan hari ini." | FN-M05-1.3.1 |
| EL-M05-S1-054 | link | visible-default | "Mula Latihan", → /practice, fa-play | FN-M05-1.3.1 |
| EL-M05-S1-055 | text | visible-default | "🪙" | FN-M05-1.3.2 |
| EL-M05-S1-056 | text | visible-default | "256" | FN-M05-1.3.2 |
| EL-M05-S1-057 | text | visible-default | "Syiling Kamu" | FN-M05-1.3.2 |
| EL-M05-S1-058 | text | visible-default | "⭐" | FN-M05-1.3.2 |
| EL-M05-S1-059 | text | visible-default | "8" | FN-M05-1.3.2 |
| EL-M05-S1-060 | text | visible-default | "Mata (Lvl 2)" | FN-M05-1.3.2 |
| EL-M05-S1-061 | text | visible-default | "🔥" | FN-M05-1.3.2 |
| EL-M05-S1-062 | text | visible-default | "1" | FN-M05-1.3.2 |
| EL-M05-S1-063 | text | visible-default | "Hari Berturut" | FN-M05-1.3.2 |
| EL-M05-S1-064 | text | visible-default | "📋" | FN-M05-1.3.2 |
| EL-M05-S1-065 | text | visible-default | "0" | FN-M05-1.3.2 |
| EL-M05-S1-066 | text | visible-default | "Sesi Minggu Ini" | FN-M05-1.3.2 |
| EL-M05-S1-067 | text | visible-default | "🎯" | FN-M05-1.3.2 |
| EL-M05-S1-068 | text | visible-default | "0" | FN-M05-1.3.2 |
| EL-M05-S1-069 | text | visible-default | "%" | FN-M05-1.3.2 |
| EL-M05-S1-070 | text | visible-default | "Ketepatan" | FN-M05-1.3.2 |
| EL-M05-S1-071 | card | visible-default | "📱 Misi Harian" | FN-M05-1.4.1 |
| EL-M05-S1-072 | heading | visible-default | "📱 Misi Harian" | FN-M05-1.4.1 |
| EL-M05-S1-073 | text | visible-default | "Selesaikan semua misi → buka Peti Harian! 🎁" | FN-M05-1.4.1 |
| EL-M05-S1-074 | text | visible-default | "Progres" | FN-M05-1.4.1 |
| EL-M05-S1-075 | text | visible-default | "0" | FN-M05-1.4.1 |
| EL-M05-S1-076 | text | visible-default | "/" | FN-M05-1.4.1 |
| EL-M05-S1-077 | text | visible-default | "10" | FN-M05-1.4.1 |
| EL-M05-S1-078 | text | visible-default | "📝" | FN-M05-1.4.2 |
| EL-M05-S1-079 | text | visible-default | "Rajin Berlatih" | FN-M05-1.4.2 |
| EL-M05-S1-080 | badge | visible-default | "Mudah" | FN-M05-1.4.2 |
| EL-M05-S1-081 | text | visible-default | "Selesaikan 3 kuiz hari ini" | FN-M05-1.4.2 |
| EL-M05-S1-082 | text | visible-default | "0/3" | FN-M05-1.4.2 |
| EL-M05-S1-083 | text | visible-default | "🪙" | FN-M05-1.4.2 |
| EL-M05-S1-084 | text | visible-default | "+15" | FN-M05-1.4.2 |
| EL-M05-S1-085 | text | visible-default | "🎯" | FN-M05-1.4.2 |
| EL-M05-S1-086 | text | visible-default | "Si Tepat" | FN-M05-1.4.2 |
| EL-M05-S1-087 | badge | visible-default | "Sederhana" | FN-M05-1.4.2 |
| EL-M05-S1-088 | text | visible-default | "Dapat 80% ketepatan dalam mana-mana kuiz" | FN-M05-1.4.2 |
| EL-M05-S1-089 | text | visible-default | "0/80" | FN-M05-1.4.2 |
| EL-M05-S1-090 | text | visible-default | "🪙" | FN-M05-1.4.2 |
| EL-M05-S1-091 | text | visible-default | "+20" | FN-M05-1.4.2 |
| EL-M05-S1-092 | text | visible-default | "🗺️" | FN-M05-1.4.2 |
| EL-M05-S1-093 | text | visible-default | "Penjelajah Topik" | FN-M05-1.4.2 |
| EL-M05-S1-094 | badge | visible-default | "Sederhana" | FN-M05-1.4.2 |
| EL-M05-S1-095 | text | visible-default | "Latih 3 topik berbeza hari ini" | FN-M05-1.4.2 |
| EL-M05-S1-096 | text | visible-default | "0/3" | FN-M05-1.4.2 |
| EL-M05-S1-097 | text | visible-default | "🪙" | FN-M05-1.4.2 |
| EL-M05-S1-098 | text | visible-default | "+25" | FN-M05-1.4.2 |
| EL-M05-S1-099 | text | visible-default | "⚡" | FN-M05-1.4.2 |
| EL-M05-S1-100 | text | visible-default | "Kilat Matematik" | FN-M05-1.4.2 |
| EL-M05-S1-101 | badge | visible-default | "Sukar" | FN-M05-1.4.2 |
| EL-M05-S1-102 | text | visible-default | "Jawab 10 soalan dengan betul" | FN-M05-1.4.2 |
| EL-M05-S1-103 | text | visible-default | "0/10" | FN-M05-1.4.2 |
| EL-M05-S1-104 | text | visible-default | "🪙" | FN-M05-1.4.2 |
| EL-M05-S1-105 | text | visible-default | "+30" | FN-M05-1.4.2 |
| EL-M05-S1-106 | text | visible-default | "🌟" | FN-M05-1.4.2 |
| EL-M05-S1-107 | text | visible-default | "Mula Hari Ini" | FN-M05-1.4.2 |
| EL-M05-S1-108 | badge | visible-default | "Mudah" | FN-M05-1.4.2 |
| EL-M05-S1-109 | text | visible-default | "Selesaikan 1 sesi latihan hari ini" | FN-M05-1.4.2 |
| EL-M05-S1-110 | text | visible-default | "0/1" | FN-M05-1.4.2 |
| EL-M05-S1-111 | text | visible-default | "🪙" | FN-M05-1.4.2 |
| EL-M05-S1-112 | text | visible-default | "+10" | FN-M05-1.4.2 |
| EL-M05-S1-113 | text | visible-default | "✅" | FN-M05-1.4.2 |
| EL-M05-S1-114 | text | visible-default | "Jawab 5 Betul" | FN-M05-1.4.2 |
| EL-M05-S1-115 | badge | visible-default | "Mudah" | FN-M05-1.4.2 |
| EL-M05-S1-116 | text | visible-default | "Jawab 5 soalan dengan betul" | FN-M05-1.4.2 |
| EL-M05-S1-117 | text | visible-default | "0/5" | FN-M05-1.4.2 |
| EL-M05-S1-118 | text | visible-default | "🪙" | FN-M05-1.4.2 |
| EL-M05-S1-119 | text | visible-default | "+12" | FN-M05-1.4.2 |
| EL-M05-S1-120 | text | visible-default | "⏱️" | FN-M05-1.4.2 |
| EL-M05-S1-121 | text | visible-default | "Latihan 10 Minit" | FN-M05-1.4.2 |
| EL-M05-S1-122 | badge | visible-default | "Sederhana" | FN-M05-1.4.2 |
| EL-M05-S1-123 | text | visible-default | "Berlatih sekurang-kurangnya 10 minit hari ini" | FN-M05-1.4.2 |
| EL-M05-S1-124 | text | visible-default | "0/10" | FN-M05-1.4.2 |
| EL-M05-S1-125 | text | visible-default | "🪙" | FN-M05-1.4.2 |
| EL-M05-S1-126 | text | visible-default | "+20" | FN-M05-1.4.2 |
| EL-M05-S1-127 | text | visible-default | "🔥" | FN-M05-1.4.2 |
| EL-M05-S1-128 | text | visible-default | "Kombo 2 Hari" | FN-M05-1.4.2 |
| EL-M05-S1-129 | badge | visible-default | "Sederhana" | FN-M05-1.4.2 |
| EL-M05-S1-130 | text | visible-default | "Kekalkan kombo latihan selama 2 hari berturut-turut" | FN-M05-1.4.2 |
| EL-M05-S1-131 | text | visible-default | "0/2" | FN-M05-1.4.2 |
| EL-M05-S1-132 | text | visible-default | "🪙" | FN-M05-1.4.2 |
| EL-M05-S1-133 | text | visible-default | "+25" | FN-M05-1.4.2 |
| EL-M05-S1-134 | text | visible-default | "🎯" | FN-M05-1.4.2 |
| EL-M05-S1-135 | text | visible-default | "Ketepatan 90%" | FN-M05-1.4.2 |
| EL-M05-S1-136 | badge | visible-default | "Sukar" | FN-M05-1.4.2 |
| EL-M05-S1-137 | text | visible-default | "Capai ketepatan 90% dalam sesi latihan" | FN-M05-1.4.2 |
| EL-M05-S1-138 | text | visible-default | "0/90" | FN-M05-1.4.2 |
| EL-M05-S1-139 | text | visible-default | "🪙" | FN-M05-1.4.2 |
| EL-M05-S1-140 | text | visible-default | "+35" | FN-M05-1.4.2 |
| EL-M05-S1-141 | text | visible-default | "⚡" | FN-M05-1.4.2 |
| EL-M05-S1-142 | text | visible-default | "Cabaran Kilat" | FN-M05-1.4.2 |
| EL-M05-S1-143 | badge | visible-default | "Sukar" | FN-M05-1.4.2 |
| EL-M05-S1-144 | text | visible-default | "Jawab 20 soalan betul dalam satu sesi" | FN-M05-1.4.2 |
| EL-M05-S1-145 | text | visible-default | "0/20" | FN-M05-1.4.2 |
| EL-M05-S1-146 | text | visible-default | "🪙" | FN-M05-1.4.2 |
| EL-M05-S1-147 | text | visible-default | "+40" | FN-M05-1.4.2 |
| EL-M05-S1-148 | text | visible-default | "🎁" | FN-M05-1.4.3 |
| EL-M05-S1-149 | text | visible-default | "Selesaikan 10 lagi misi untuk buka peti! 🔒" | FN-M05-1.4.3 |
| EL-M05-S1-150 | text | visible-default | "🏆" | FN-M05-1.5.1 |
| EL-M05-S1-151 | text | visible-default | "Belum Ada Lencana Lagi!" | FN-M05-1.5.1 |
| EL-M05-S1-152 | text | visible-default | "Jom kumpul lencana pertama dengan menjawab soalan! 🚀" | FN-M05-1.5.1 |
| EL-M05-S1-153 | link | visible-default | "🚀 Mula Latihan", → /practice | FN-M05-1.5.3 |
| EL-M05-S1-154 | link | visible-default | "🔄 Soalan Aku Salah 72", → /practice/revision | FN-M05-1.5.4 |
| EL-M05-S1-155 | badge | visible-default | "72" | FN-M05-1.5.4 |
| EL-M05-S1-156 | link | visible-default | "📈 Kemajuan", → /practice/progress | FN-M05-1.5.3 |
| EL-M05-S1-157 | link | visible-default | "📊 Sejarah Latihan", → /practice/history | FN-M05-1.5.3 |
| EL-M05-S1-158 | link | visible-default | "🏅 Papan Pendahulu", → /leaderboard | FN-M05-1.5.3 |
| EL-M05-S1-159 | link | visible-default | "Panel Admin", → /admin, fa-shield-alt | FN-M05-1.5.5 |
| EL-M05-S1-160 | card | visible-default | "📚 Artikel Untuk Kamu" | FN-M05-1.6.1 |
| EL-M05-S1-161 | heading | visible-default | "📚 Artikel Untuk Kamu" | FN-M05-1.6.1 |
| EL-M05-S1-162 | link | visible-default | "Lihat Semua", → /artikel, fa-arrow-right | FN-M05-1.6.1 |
| EL-M05-S1-163 | link | visible-default | "Tips Belajar AI Ini Apa Sebenarnya? Jom Fahami Bersama! 7 bulan yang lepas", → /artikel/ai-ini-apa-sebenarnya-jom-fahami-bersama, fa-newspaper | FN-M05-1.6.1 |
| EL-M05-S1-164 | badge | visible-default | "Tips Belajar" | FN-M05-1.6.1 |
| EL-M05-S1-165 | link | visible-default | "Tips Belajar 5 Tips Belajar Matematik yang Menyeronokkan 7 bulan yang lepas", → /artikel/5-tips-belajar-matematik, fa-newspaper | FN-M05-1.6.1 |
| EL-M05-S1-166 | badge | visible-default | "Tips Belajar" | FN-M05-1.6.1 |
| EL-M05-S1-167 | link | visible-default | "Tips Belajar Cara Baca Buku Cerita dalam Bahasa Inggeris 7 bulan yang lepas", → /artikel/cara-baca-buku-cerita-bahasa-inggeris, fa-newspaper | FN-M05-1.6.1 |
| EL-M05-S1-168 | badge | visible-default | "Tips Belajar" | FN-M05-1.6.1 |
| EL-M05-S1-169 | link | visible-default | "Tips Belajar Sains Menyeronokkan: Eksperimen Mudah di Rumah 7 bulan yang lepas", → /artikel/sains-menyeronokkan-eksperimen-di-rumah, fa-newspaper | FN-M05-1.6.1 |
| EL-M05-S1-170 | badge | visible-default | "Tips Belajar" | FN-M05-1.6.1 |
| EL-M05-S1-171 | link | visible-default | "Panduan Ibu Bapa Panduan Ibu Bapa: Jadual Belajar untuk Anak 7 bulan yang lepas", → /artikel/panduan-ibu-bapa-jadual-belajar, fa-newspaper | FN-M05-1.6.1 |
| EL-M05-S1-172 | badge | visible-default | "Panduan Ibu Bapa" | FN-M05-1.6.1 |
| EL-M05-S1-173 | heading | visible-default | "📖 Subjek Tersedia" | FN-M05-1.7.1 |
| EL-M05-S1-174 | badge | visible-default | "31 subjek" | FN-M05-1.7.1 |
| EL-M05-S1-175 | card | visible-default | "Bahasa Melayu" | FN-M05-1.7.1 |
| EL-M05-S1-176 | text | visible-default | "11688 soalan" | FN-M05-1.7.1 |
| EL-M05-S1-177 | heading | visible-default | "Bahasa Melayu" | FN-M05-1.7.1 |
| EL-M05-S1-178 | text | visible-default | "Malay Language" | FN-M05-1.7.1 |
| EL-M05-S1-179 | badge | visible-default | "⭐ Subjek Teras" | FN-M05-1.7.1 |
| EL-M05-S1-180 | link | visible-default | "Mula Latihan 🚀", → /practice?subject=BM | FN-M05-1.7.1 |
| EL-M05-S1-181 | card | visible-default | "Bahasa Inggeris" | FN-M05-1.7.1 |
| EL-M05-S1-182 | text | visible-default | "8039 soalan" | FN-M05-1.7.1 |
| EL-M05-S1-183 | heading | visible-default | "Bahasa Inggeris" | FN-M05-1.7.1 |
| EL-M05-S1-184 | text | visible-default | "English Language" | FN-M05-1.7.1 |
| EL-M05-S1-185 | badge | visible-default | "⭐ Subjek Teras" | FN-M05-1.7.1 |
| EL-M05-S1-186 | link | visible-default | "Mula Latihan 🚀", → /practice?subject=BI | FN-M05-1.7.1 |
| EL-M05-S1-187 | card | visible-default | "Matematik" | FN-M05-1.7.1 |
| EL-M05-S1-188 | text | visible-default | "13872 soalan" | FN-M05-1.7.1 |
| EL-M05-S1-189 | heading | visible-default | "Matematik" | FN-M05-1.7.1 |
| EL-M05-S1-190 | text | visible-default | "Mathematics" | FN-M05-1.7.1 |
| EL-M05-S1-191 | badge | visible-default | "⭐ Subjek Teras" | FN-M05-1.7.1 |
| EL-M05-S1-192 | link | visible-default | "Mula Latihan 🚀", → /practice?subject=MATH | FN-M05-1.7.1 |
| EL-M05-S1-193 | card | visible-default | "Sains" | FN-M05-1.7.1 |
| EL-M05-S1-194 | text | visible-default | "12165 soalan" | FN-M05-1.7.1 |
| EL-M05-S1-195 | heading | visible-default | "Sains" | FN-M05-1.7.1 |
| EL-M05-S1-196 | text | visible-default | "Science" | FN-M05-1.7.1 |
| EL-M05-S1-197 | badge | visible-default | "⭐ Subjek Teras" | FN-M05-1.7.1 |
| EL-M05-S1-198 | link | visible-default | "Mula Latihan 🚀", → /practice?subject=SCI | FN-M05-1.7.1 |
| EL-M05-S1-199 | heading | visible-default | "📊 Statistik Platform" | FN-M05-1.7.2 |
| EL-M05-S1-200 | text | visible-default | "📚" | FN-M05-1.7.2 |
| EL-M05-S1-201 | text | visible-default | "130152" | FN-M05-1.7.2 |
| EL-M05-S1-202 | text | visible-default | "Total Soalan" | FN-M05-1.7.2 |
| EL-M05-S1-203 | text | visible-default | "📖" | FN-M05-1.7.2 |
| EL-M05-S1-204 | text | visible-default | "31" | FN-M05-1.7.2 |
| EL-M05-S1-205 | text | visible-default | "Subjek Aktif" | FN-M05-1.7.2 |
| EL-M05-S1-206 | text | visible-default | "🎯" | FN-M05-1.7.2 |
| EL-M05-S1-207 | text | visible-default | "11" | FN-M05-1.7.2 |
| EL-M05-S1-208 | text | visible-default | "Tahap Pendidikan" | FN-M05-1.7.2 |
| EL-M05-S1-209 | text | visible-default | "✅" | FN-M05-1.7.2 |
| EL-M05-S1-210 | text | visible-default | "129752" | FN-M05-1.7.2 |
| EL-M05-S1-211 | text | visible-default | "Soalan Approved" | FN-M05-1.7.2 |
| EL-M05-S1-212 | heading | visible-default | "🎓 Tahap Pendidikan" | FN-M05-1.7.3 |
| EL-M05-S1-213 | card | visible-default | "🏫 Sekolah Rendah (KSSR)" | FN-M05-1.7.3 |
| EL-M05-S1-214 | heading | visible-default | "🏫 Sekolah Rendah (KSSR)" | FN-M05-1.7.3 |
| EL-M05-S1-215 | link | visible-default | "Darjah 1 (11396)", → /practice?level=D1 | FN-M05-1.7.3 |
| EL-M05-S1-216 | link | visible-default | "Darjah 2 (10245)", → /practice?level=D2 | FN-M05-1.7.3 |
| EL-M05-S1-217 | link | visible-default | "Darjah 3 (5776)", → /practice?level=D3 | FN-M05-1.7.3 |
| EL-M05-S1-218 | link | visible-default | "Darjah 4 (4787)", → /practice?level=D4 | FN-M05-1.7.3 |
| EL-M05-S1-219 | link | visible-default | "Darjah 5 (3874)", → /practice?level=D5 | FN-M05-1.7.3 |
| EL-M05-S1-220 | link | visible-default | "Darjah 6 (4464)", → /practice?level=D6 | FN-M05-1.7.3 |
| EL-M05-S1-221 | card | visible-default | "🎒 Sekolah Menengah Rendah (KSSM)" | FN-M05-1.7.3 |
| EL-M05-S1-222 | heading | visible-default | "🎒 Sekolah Menengah Rendah (KSSM)" | FN-M05-1.7.3 |
| EL-M05-S1-223 | link | visible-default | "Tingkatan 1 (19455)", → /practice?level=T1 | FN-M05-1.7.3 |
| EL-M05-S1-224 | link | visible-default | "Tingkatan 2 (15700)", → /practice?level=T2 | FN-M05-1.7.3 |
| EL-M05-S1-225 | link | visible-default | "Tingkatan 3 (13800)", → /practice?level=T3 | FN-M05-1.7.3 |
| EL-M05-S1-226 | card | visible-default | "🎓 Sekolah Menengah Atas (KSSM)" | FN-M05-1.7.3 |
| EL-M05-S1-227 | heading | visible-default | "🎓 Sekolah Menengah Atas (KSSM)" | FN-M05-1.7.3 |
| EL-M05-S1-228 | link | visible-default | "Tingkatan 4 (19113)", → /practice?level=T4 | FN-M05-1.7.3 |
| EL-M05-S1-229 | link | visible-default | "Tingkatan 5 (20770)", → /practice?level=T5 | FN-M05-1.7.3 |
| EL-M05-S1-230 | card | visible-default | "⚡ Soalan Terkini" | FN-M05-1.7.4 |
| EL-M05-S1-231 | heading | visible-default | "⚡ Soalan Terkini" | FN-M05-1.7.4 |
| EL-M05-S1-232 | text | visible-default | "📝" | FN-M05-1.7.4 |
| EL-M05-S1-233 | badge | visible-default | "Sains" | FN-M05-1.7.4 |
| EL-M05-S1-234 | text | visible-default | "⭐" | FN-M05-1.7.4 |
| EL-M05-S1-235 | text | visible-default | "⭐" | FN-M05-1.7.4 |
| EL-M05-S1-236 | text | visible-default | "⭐" | FN-M05-1.7.4 |
| EL-M05-S1-237 | text | visible-default | "⭐" | FN-M05-1.7.4 |
| EL-M05-S1-238 | text | visible-default | "⭐" | FN-M05-1.7.4 |
| EL-M05-S1-239 | text | visible-default | "Topup Sains T5 Bab 9 item 1: Apakah maksud satelit buatan? Pilih jawapan yang paling tepat…" | FN-M05-1.7.4 |
| EL-M05-S1-240 | text | visible-default | "4 bulan yang lepas" | FN-M05-1.7.4 |
| EL-M05-S1-241 | text | visible-default | "T5" | FN-M05-1.7.4 |
| EL-M05-S1-242 | badge | visible-default | "Sains" | FN-M05-1.7.4 |
| EL-M05-S1-243 | text | visible-default | "⭐" | FN-M05-1.7.4 |
| EL-M05-S1-244 | text | visible-default | "⭐" | FN-M05-1.7.4 |
| EL-M05-S1-245 | text | visible-default | "⭐" | FN-M05-1.7.4 |
| EL-M05-S1-246 | text | visible-default | "⭐" | FN-M05-1.7.4 |
| EL-M05-S1-247 | text | visible-default | "⭐" | FN-M05-1.7.4 |
| EL-M05-S1-248 | text | visible-default | "Topup Sains T5 Bab 9 item 2: Mengapakah satelit komunikasi diletakkan pada orbit tertentu?…" | FN-M05-1.7.4 |
| EL-M05-S1-249 | text | visible-default | "4 bulan yang lepas" | FN-M05-1.7.4 |
| EL-M05-S1-250 | text | visible-default | "T5" | FN-M05-1.7.4 |
| EL-M05-S1-251 | card | visible-default | "📈 Tahap Kesukaran" | FN-M05-1.7.5 |
| EL-M05-S1-252 | heading | visible-default | "📈 Tahap Kesukaran" | FN-M05-1.7.5 |
| EL-M05-S1-253 | text | visible-default | "⭐" | FN-M05-1.7.5 |
| EL-M05-S1-254 | text | visible-default | "Sangat Mudah" | FN-M05-1.7.5 |
| EL-M05-S1-255 | badge | visible-default | "39694" | FN-M05-1.7.5 |
| EL-M05-S1-256 | text | visible-default | "⭐" | FN-M05-1.7.5 |
| EL-M05-S1-257 | text | visible-default | "⭐" | FN-M05-1.7.5 |
| EL-M05-S1-258 | text | visible-default | "Mudah" | FN-M05-1.7.5 |
| EL-M05-S1-259 | badge | visible-default | "47138" | FN-M05-1.7.5 |
| EL-M05-S1-260 | text | visible-default | "⭐" | FN-M05-1.7.5 |
| EL-M05-S1-261 | text | visible-default | "⭐" | FN-M05-1.7.5 |
| EL-M05-S1-262 | text | visible-default | "⭐" | FN-M05-1.7.5 |
| EL-M05-S1-263 | text | visible-default | "Sederhana" | FN-M05-1.7.5 |
| EL-M05-S1-264 | badge | visible-default | "33720" | FN-M05-1.7.5 |
| EL-M05-S1-265 | text | visible-default | "⭐" | FN-M05-1.7.5 |
| EL-M05-S1-266 | text | visible-default | "⭐" | FN-M05-1.7.5 |
| EL-M05-S1-267 | text | visible-default | "⭐" | FN-M05-1.7.5 |
| EL-M05-S1-268 | text | visible-default | "⭐" | FN-M05-1.7.5 |
| EL-M05-S1-269 | text | visible-default | "Sukar" | FN-M05-1.7.5 |
| EL-M05-S1-270 | badge | visible-default | "9600" | FN-M05-1.7.5 |
| EL-M05-S1-271 | text | visible-default | "⭐" | FN-M05-1.7.5 |
| EL-M05-S1-272 | text | visible-default | "⭐" | FN-M05-1.7.5 |
| EL-M05-S1-273 | text | visible-default | "⭐" | FN-M05-1.7.5 |
| EL-M05-S1-274 | text | visible-default | "⭐" | FN-M05-1.7.5 |
| EL-M05-S1-275 | text | visible-default | "⭐" | FN-M05-1.7.5 |
| EL-M05-S1-276 | text | visible-default | "Sangat Sukar" | FN-M05-1.7.5 |
| EL-M05-S1-277 | badge | visible-default | "0" | FN-M05-1.7.5 |
| EL-M05-S1-278 | text | visible-default | "130152" | FN-M05-1.7.5 |
| EL-M05-S1-279 | text | visible-default | "Jumlah Keseluruhan" | FN-M05-1.7.5 |
| EL-M05-S1-280 | card | visible-default | "📊 Statistik Subjek" | FN-M05-1.7.6 |
| EL-M05-S1-281 | heading | visible-default | "📊 Statistik Subjek" | FN-M05-1.7.6 |
| EL-M05-S1-282 | card | visible-default | "15414 soalan" | FN-M05-1.7.6 |
| EL-M05-S1-283 | text | visible-default | "Pendidikan Moral" | FN-M05-1.7.6 |
| EL-M05-S1-284 | text | visible-default | "15414 soalan" | FN-M05-1.7.6 |
| EL-M05-S1-285 | text | visible-default | "Kesukaran:" | FN-M05-1.7.6 |
| EL-M05-S1-286 | text | visible-default | "⭐" | FN-M05-1.7.6 |
| EL-M05-S1-287 | text | visible-default | "⭐" | FN-M05-1.7.6 |
| EL-M05-S1-288 | text | visible-default | "⭐" | FN-M05-1.7.6 |
| EL-M05-S1-289 | text | visible-default | "⭐" | FN-M05-1.7.6 |
| EL-M05-S1-290 | text | visible-default | "⭐" | FN-M05-1.7.6 |
| EL-M05-S1-291 | text | visible-default | "Digunakan:" | FN-M05-1.7.6 |
| EL-M05-S1-292 | text | visible-default | "0x" | FN-M05-1.7.6 |
| EL-M05-S1-293 | card | visible-default | "13872 soalan" | FN-M05-1.7.6 |
| EL-M05-S1-294 | text | visible-default | "Matematik" | FN-M05-1.7.6 |
| EL-M05-S1-295 | text | visible-default | "13872 soalan" | FN-M05-1.7.6 |
| EL-M05-S1-296 | text | visible-default | "Kesukaran:" | FN-M05-1.7.6 |
| EL-M05-S1-297 | text | visible-default | "⭐" | FN-M05-1.7.6 |
| EL-M05-S1-298 | text | visible-default | "⭐" | FN-M05-1.7.6 |
| EL-M05-S1-299 | text | visible-default | "⭐" | FN-M05-1.7.6 |
| EL-M05-S1-300 | text | visible-default | "⭐" | FN-M05-1.7.6 |
| EL-M05-S1-301 | text | visible-default | "⭐" | FN-M05-1.7.6 |
| EL-M05-S1-302 | text | visible-default | "Digunakan:" | FN-M05-1.7.6 |
| EL-M05-S1-303 | text | visible-default | "0x" | FN-M05-1.7.6 |
| EL-M05-S1-304 | card | visible-default | "12165 soalan" | FN-M05-1.7.6 |
| EL-M05-S1-305 | text | visible-default | "Sains" | FN-M05-1.7.6 |
| EL-M05-S1-306 | text | visible-default | "12165 soalan" | FN-M05-1.7.6 |
| EL-M05-S1-307 | text | visible-default | "Kesukaran:" | FN-M05-1.7.6 |
| EL-M05-S1-308 | text | visible-default | "⭐" | FN-M05-1.7.6 |
| EL-M05-S1-309 | text | visible-default | "⭐" | FN-M05-1.7.6 |
| EL-M05-S1-310 | text | visible-default | "⭐" | FN-M05-1.7.6 |
| EL-M05-S1-311 | text | visible-default | "⭐" | FN-M05-1.7.6 |
| EL-M05-S1-312 | text | visible-default | "⭐" | FN-M05-1.7.6 |
| EL-M05-S1-313 | text | visible-default | "Digunakan:" | FN-M05-1.7.6 |
| EL-M05-S1-314 | text | visible-default | "0x" | FN-M05-1.7.6 |
| EL-M05-S1-315 | card | visible-default (state captured @1280 only) | "Artikel Terkini" | FN-M05-1.6.2 |
| EL-M05-S1-316 | heading | visible-default (state captured @1280 only) | "Artikel Terkini" | FN-M05-1.6.2 |
| EL-M05-S1-317 | link | visible-default (state captured @1280 only) | "AI Ini Apa Sebenarnya? Jom Fahami Bersama! 7 bulan yang lepas", → /artikel/ai-ini-apa-sebenarnya-jom-fahami-bersama, fa-newspaper | FN-M05-1.6.2 |
| EL-M05-S1-318 | link | visible-default (state captured @1280 only) | "5 Tips Belajar Matematik yang Menyeronokkan 7 bulan yang lepas", → /artikel/5-tips-belajar-matematik, fa-newspaper | FN-M05-1.6.2 |
| EL-M05-S1-319 | link | visible-default (state captured @1280 only) | "Cara Baca Buku Cerita dalam Bahasa Inggeris 7 bulan yang lepas", → /artikel/cara-baca-buku-cerita-bahasa-inggeris, fa-newspaper | FN-M05-1.6.2 |
| EL-M05-S1-320 | link | visible-default (state captured @1280 only) | "Sains Menyeronokkan: Eksperimen Mudah di Rumah 7 bulan yang lepas", → /artikel/sains-menyeronokkan-eksperimen-di-rumah, fa-newspaper | FN-M05-1.6.2 |
| EL-M05-S1-321 | link | visible-default (state captured @1280 only) | "Panduan Ibu Bapa: Jadual Belajar untuk Anak 7 bulan yang lepas", → /artikel/panduan-ibu-bapa-jadual-belajar, fa-newspaper | FN-M05-1.6.2 |
| EL-M05-S1-322 | link | visible-default (state captured @1280 only) | "Lihat Semua Artikel", → /artikel, fa-arrow-right | FN-M05-1.6.2 |
| EL-M05-S1-323 | toggle | conditional (state captured @1280 only) | "Tutup", fa-chevron-down | FN-M05-1.2.2 |

#### S2 — `/practice` (25 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M05-S2-001 | text | hidden-only | "LIVE:", fa-circle | Excluded: M16 tournament banner (global widget) |
| EL-M05-S2-002 | text | hidden-only | "MAIN" | Excluded: M16 tournament banner (global widget) |
| EL-M05-S2-003 | text | hidden-only | "DAFTAR" | Excluded: M16 tournament banner (global widget) |
| EL-M05-S2-004 | heading | visible-default | "Latih Tubi 🎯" | FN-M05-2.1.2 |
| EL-M05-S2-005 | text | visible-default | "Pilih subjek dan mula berlatih!" | FN-M05-2.1.2 |
| EL-M05-S2-006 | link | visible-default | "Mode Baru Soalan by Chapter Jawab bab demi bab ikut buku teks dan DSKP. Bab seterusnya ter…", → /practice/chapter, fa-arrow-right | FN-M05-2.1.3 |
| EL-M05-S2-007 | heading | visible-default | "Soalan by Chapter" | FN-M05-2.1.3 |
| EL-M05-S2-008 | link | visible-default | "Teras Bahasa Melayu Malay Language 11,688 soalan Mula Latihan", → /practice/BM, fa-book-open | FN-M05-2.1.4 |
| EL-M05-S2-009 | card | visible-default | "Teras" | FN-M05-2.1.4 |
| EL-M05-S2-010 | card | visible-default | "Teras" | FN-M05-2.1.4 |
| EL-M05-S2-011 | badge | visible-default | "Teras", fa-crown | FN-M05-2.1.4 |
| EL-M05-S2-012 | heading | visible-default | "Bahasa Melayu" | FN-M05-2.1.4 |
| EL-M05-S2-013 | button | visible-default | "Mula Latihan", fa-play-circle | FN-M05-2.1.5 |
| EL-M05-S2-014 | link | visible-default | "Teras Bahasa Inggeris English Language 8,039 soalan Mula Latihan", → /practice/BI, fa-globe | FN-M05-2.1.4 |
| EL-M05-S2-015 | card | visible-default | "Teras" | FN-M05-2.1.4 |
| EL-M05-S2-016 | card | visible-default | "Teras" | FN-M05-2.1.4 |
| EL-M05-S2-017 | badge | visible-default | "Teras", fa-crown | FN-M05-2.1.4 |
| EL-M05-S2-018 | heading | visible-default | "Bahasa Inggeris" | FN-M05-2.1.4 |
| EL-M05-S2-019 | button | visible-default | "Mula Latihan", fa-play-circle | FN-M05-2.1.5 |
| EL-M05-S2-020 | link | visible-default | "Teras Matematik Mathematics 13,872 soalan Mula Latihan", → /practice/MATH, fa-calculator | FN-M05-2.1.4 |
| EL-M05-S2-021 | card | visible-default | "Teras" | FN-M05-2.1.4 |
| EL-M05-S2-022 | card | visible-default | "Teras" | FN-M05-2.1.4 |
| EL-M05-S2-023 | badge | visible-default | "Teras", fa-crown | FN-M05-2.1.4 |
| EL-M05-S2-024 | heading | visible-default | "Matematik" | FN-M05-2.1.4 |
| EL-M05-S2-025 | button | visible-default | "Mula Latihan", fa-play-circle | FN-M05-2.1.5 |

#### S3 — `/practice/{CODE}` (87 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M05-S3-001 | text | hidden-only | "LIVE:", fa-circle | Excluded: M16 tournament banner (global widget) |
| EL-M05-S3-002 | text | hidden-only | "MAIN" | Excluded: M16 tournament banner (global widget) |
| EL-M05-S3-003 | text | hidden-only | "DAFTAR" | Excluded: M16 tournament banner (global widget) |
| EL-M05-S3-004 | link | visible-default | "Kembali ke Senarai Subjek", → /practice, fa-arrow-left | FN-M05-2.2.2 |
| EL-M05-S3-005 | text | visible-default | "Baki percubaan percuma: soalan lagi." | FN-M05-2.2.3 |
| EL-M05-S3-006 | text | visible-default | "0" | FN-M05-2.2.3 |
| EL-M05-S3-007 | link | visible-default | "Langgan untuk akses tanpa had", → /pricing | FN-M05-2.2.3 |
| EL-M05-S3-008 | card | visible-default (state captured @1280 only) | "Matematik Tambahan" | FN-M05-2.2.4 |
| EL-M05-S3-009 | heading | visible-default (state captured @1280 only) | "Matematik Tambahan" | FN-M05-2.2.4 |
| EL-M05-S3-010 | text | visible-default | "0" | FN-M05-2.2.4 |
| EL-M05-S3-011 | text | visible-default | "soalan tersedia" | FN-M05-2.2.4 |
| EL-M05-S3-012 | card | visible-default | "Pilih Tahap Pendidikan" | FN-M05-2.2.5 |
| EL-M05-S3-013 | heading | visible-default | "Pilih Tahap Pendidikan" | FN-M05-2.2.5 |
| EL-M05-S3-014 | button | visible-default (state captured @1280 only) | "Semua Tahap 0 soalan", fa-infinity | FN-M05-2.2.5 |
| EL-M05-S3-015 | card | visible-default | "Pilih Tahap Kesukaran" | FN-M05-2.2.6 |
| EL-M05-S3-016 | heading | visible-default | "Pilih Tahap Kesukaran" | FN-M05-2.2.6 |
| EL-M05-S3-017 | button | visible-default (state captured @1280 only) | "Semua Campuran 0", fa-infinity | FN-M05-2.2.6 |
| EL-M05-S3-018 | button | visible-default (state captured @1280 only) | "Sgt Mudah Level 1 0", fa-star | FN-M05-2.2.6 |
| EL-M05-S3-019 | button | visible-default (state captured @1280 only) | "Mudah Level 2 0", fa-star | FN-M05-2.2.6 |
| EL-M05-S3-020 | button | visible-default (state captured @1280 only) | "Sederhana Level 3 0", fa-star | FN-M05-2.2.6 |
| EL-M05-S3-021 | button | visible-default (state captured @1280 only) | "Sukar Level 4 0", fa-star | FN-M05-2.2.6 |
| EL-M05-S3-022 | button | visible-default | "Sgt Sukar Level 5 0", fa-star | FN-M05-2.2.6 |
| EL-M05-S3-023 | card | visible-default | "Bilangan Soalan" | FN-M05-2.2.7 |
| EL-M05-S3-024 | heading | visible-default | "Bilangan Soalan" | FN-M05-2.2.7 |
| EL-M05-S3-025 | button | visible-default | "5 soalan" | FN-M05-2.2.7 |
| EL-M05-S3-026 | button | visible-default | "10 soalan" | FN-M05-2.2.7 |
| EL-M05-S3-027 | button | visible-default | "15 soalan" | FN-M05-2.2.7 |
| EL-M05-S3-028 | button | visible-default | "20 soalan" | FN-M05-2.2.7 |
| EL-M05-S3-029 | card | visible-default | "Ringkasan" | FN-M05-2.2.8 |
| EL-M05-S3-030 | heading | visible-default | "Ringkasan" | FN-M05-2.2.8 |
| EL-M05-S3-031 | text | visible-default | "Tahap Pendidikan:" | FN-M05-2.2.8 |
| EL-M05-S3-032 | text | visible-default | "Semua Tahap" | FN-M05-2.2.8 |
| EL-M05-S3-033 | text | visible-default | "Kesukaran:" | FN-M05-2.2.8 |
| EL-M05-S3-034 | text | visible-default | "Semua Tahap" | FN-M05-2.2.8 |
| EL-M05-S3-035 | text | visible-default | "Bilangan Soalan:" | FN-M05-2.2.8 |
| EL-M05-S3-036 | text | visible-default | "10" | FN-M05-2.2.8 |
| EL-M05-S3-037 | text | visible-default | "Soalan Tersedia:" | FN-M05-2.2.8 |
| EL-M05-S3-038 | text | visible-default | "0" | FN-M05-2.2.8 |
| EL-M05-S3-039 | text | visible-default (state captured @1280 only) | "Soalan Tidak Mencukupi" | FN-M05-2.2.9 |
| EL-M05-S3-040 | text | visible-default (state captured @1280 only) | "Kurangkan bilangan soalan atau tukar tetapan penapisan." | FN-M05-2.2.9 |
| EL-M05-S3-041 | link | visible-default (state captured @1280 only) | "Mula Kuiz", → /practice/ADDMATH/quiz?count=10, fa-play-circle | FN-M05-2.2.10 |
| EL-M05-S3-042 | link | hidden-only | "Latihan Subjektif ( soalan)", → /practice/ADDMATH/subjektif, fa-pen | FN-M05-2.4.1 |
| EL-M05-S3-043 | badge | conditional | "Bersedia untuk bermula!", fa-check-circle | FN-M05-2.2.11 |
| EL-M05-S3-044 | card | visible-default | "Tips" | FN-M05-2.2.12 |
| EL-M05-S3-045 | heading | visible-default | "Tips" | FN-M05-2.2.12 |
| EL-M05-S3-046 | text | visible-default | "Mulakan dengan tahap mudah untuk biasakan diri" | FN-M05-2.2.12 |
| EL-M05-S3-047 | text | visible-default | "Campurkan kesukaran untuk latihan menyeluruh" | FN-M05-2.2.12 |
| EL-M05-S3-048 | text | visible-default | "Ambil masa untuk faham setiap soalan" | FN-M05-2.2.12 |
| EL-M05-S3-049 | text | visible-default | "Ulang kaji soalan yang salah" | FN-M05-2.2.12 |
| EL-M05-S3-050 | card | conditional (state captured @1280 only) | "Bahasa Melayu" | FN-M05-2.2.4 |
| EL-M05-S3-051 | heading | conditional (state captured @1280 only) | "Bahasa Melayu" | FN-M05-2.2.4 |
| EL-M05-S3-052 | button | conditional (state captured @1280 only) | "Semua Tahap 4,833 soalan", fa-infinity | FN-M05-2.2.5 |
| EL-M05-S3-053 | button | conditional (state captured @1280 only) | "D1 Darjah 1 958 soalan" | FN-M05-2.2.5 |
| EL-M05-S3-054 | button | conditional | "D2 Darjah 2 2,540 soalan" | FN-M05-2.2.5 |
| EL-M05-S3-055 | button | conditional | "D3 Darjah 3 805 soalan" | FN-M05-2.2.5 |
| EL-M05-S3-056 | button | conditional | "D4 Darjah 4 530 soalan" | FN-M05-2.2.5 |
| EL-M05-S3-057 | button | conditional (state captured @1280 only) | "Semua Campuran 4,833", fa-infinity | FN-M05-2.2.6 |
| EL-M05-S3-058 | button | conditional (state captured @1280 only) | "Sgt Mudah Level 1 792", fa-star | FN-M05-2.2.6 |
| EL-M05-S3-059 | button | conditional (state captured @1280 only) | "Mudah Level 2 1,868", fa-star | FN-M05-2.2.6 |
| EL-M05-S3-060 | button | conditional (state captured @1280 only) | "Sederhana Level 3 1,727", fa-star | FN-M05-2.2.6 |
| EL-M05-S3-061 | button | conditional | "Sukar Level 4 446", fa-star | FN-M05-2.2.6 |
| EL-M05-S3-062 | link | conditional (state captured @1280 only) | "Mula Kuiz", → /practice/BM/quiz?count=10, fa-play-circle | FN-M05-2.2.10 |
| EL-M05-S3-063 | link | hidden-only | "Latihan Subjektif ( soalan)", → /practice/BM/subjektif, fa-pen | FN-M05-2.4.1 |
| EL-M05-S3-064 | card | conditional | "Matematik" | FN-M05-2.2.4 |
| EL-M05-S3-065 | heading | conditional | "Matematik" | FN-M05-2.2.4 |
| EL-M05-S3-066 | button | conditional | "Semua Tahap 6,538 soalan", fa-infinity | FN-M05-2.2.5 |
| EL-M05-S3-067 | button | conditional | "D1 Darjah 1 2,734 soalan" | FN-M05-2.2.5 |
| EL-M05-S3-068 | button | conditional (state captured @1280 only) | "Semua Campuran 2,129", fa-infinity | FN-M05-2.2.6 |
| EL-M05-S3-069 | button | conditional (state captured @1280 only) | "Mudah Level 2 635", fa-star | FN-M05-2.2.6 |
| EL-M05-S3-070 | button | conditional (state captured @1280 only) | "Sederhana Level 3 780", fa-star | FN-M05-2.2.6 |
| EL-M05-S3-071 | link | conditional (state captured @1280 only) | "Mula Kuiz", → /practice/MATH/quiz?level=2&difficulty=3&count=20, fa-play-circle | FN-M05-2.2.10 |
| EL-M05-S3-072 | link | hidden-only | "Latihan Subjektif ( soalan)", → /practice/MATH/subjektif, fa-pen | FN-M05-2.4.1 |
| EL-M05-S3-073 | button | conditional (state captured @1280 only) | "Semua Campuran 682", fa-infinity | FN-M05-2.2.6 |
| EL-M05-S3-074 | button | conditional (state captured @1280 only) | "Sederhana Level 3 27", fa-star | FN-M05-2.2.6 |
| EL-M05-S3-075 | button | conditional (state captured @1280 only) | "Sukar Level 4 13", fa-star | FN-M05-2.2.6 |
| EL-M05-S3-076 | link | conditional (state captured @1280 only) | "Mula Kuiz", → /practice/MATH/quiz?level=3&count=5, fa-play-circle | FN-M05-2.2.10 |
| EL-M05-S3-077 | button | conditional | "Semua Campuran 6,538", fa-infinity | FN-M05-2.2.6 |
| EL-M05-S3-078 | button | conditional | "Sgt Mudah Level 1 1,340", fa-star | FN-M05-2.2.6 |
| EL-M05-S3-079 | button | conditional | "Mudah Level 2 2,130", fa-star | FN-M05-2.2.6 |
| EL-M05-S3-080 | button | conditional | "Sederhana Level 3 2,511", fa-star | FN-M05-2.2.6 |
| EL-M05-S3-081 | link | conditional | "Mula Kuiz", → /practice/MATH/quiz?count=10, fa-play-circle | FN-M05-2.2.10 |
| EL-M05-S3-082 | link | conditional (state captured @1280 only) | "Mula Kuiz", → /practice/MATH/quiz?difficulty=5&count=10, fa-play-circle | FN-M05-2.2.10 |
| EL-M05-S3-083 | card | conditional (state captured @1280 only) | "Sains Komputer" | FN-M05-2.2.4 |
| EL-M05-S3-084 | heading | conditional (state captured @1280 only) | "Sains Komputer" | FN-M05-2.2.4 |
| EL-M05-S3-085 | button | conditional (state captured @1280 only) | "D4 Darjah 4 0 soalan" | FN-M05-2.2.5 |
| EL-M05-S3-086 | link | conditional (state captured @1280 only) | "Mula Kuiz", → /practice/SK/quiz?count=10, fa-play-circle | FN-M05-2.2.10 |
| EL-M05-S3-087 | link | hidden-only | "Latihan Subjektif ( soalan)", → /practice/SK/subjektif, fa-pen | FN-M05-2.4.1 |

#### S4 — `/practice/chapter` (27 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M05-S4-001 | text | hidden-only | "LIVE:", fa-circle | Excluded: M16 tournament banner (global widget) |
| EL-M05-S4-002 | text | hidden-only | "MAIN" | Excluded: M16 tournament banner (global widget) |
| EL-M05-S4-003 | text | hidden-only | "DAFTAR" | Excluded: M16 tournament banner (global widget) |
| EL-M05-S4-004 | text | visible-default | "Mode Sistematik" | FN-M05-3.1.2 |
| EL-M05-S4-005 | heading | visible-default | "Soalan by Chapter" | FN-M05-3.1.2 |
| EL-M05-S4-006 | text | visible-default | "Pelajar jawab bab demi bab. Bab seterusnya hanya terbuka selepas bab sebelumnya lengkap da…" | FN-M05-3.1.2 |
| EL-M05-S4-007 | link | visible-default | "Latih Tubi Rawak", → /practice, fa-random | FN-M05-3.1.2 |
| EL-M05-S4-008 | link | visible-default | "Bahasa Melayu 18 bab tersedia 4,833 soalan chapter", → /practice/chapter/BM, fa-chevron-right | FN-M05-3.1.3 |
| EL-M05-S4-009 | heading | visible-default | "Bahasa Melayu" | FN-M05-3.1.3 |
| EL-M05-S4-010 | link | visible-default | "Bahasa Inggeris 14 bab tersedia 3,521 soalan chapter", → /practice/chapter/BI, fa-chevron-right | FN-M05-3.1.3 |
| EL-M05-S4-011 | heading | visible-default | "Bahasa Inggeris" | FN-M05-3.1.3 |
| EL-M05-S4-012 | link | visible-default | "Matematik 25 bab tersedia 6,538 soalan chapter", → /practice/chapter/MATH, fa-chevron-right | FN-M05-3.1.3 |
| EL-M05-S4-013 | heading | visible-default | "Matematik" | FN-M05-3.1.3 |
| EL-M05-S4-014 | link | visible-default | "Sains 18 bab tersedia 4,903 soalan chapter", → /practice/chapter/SCI, fa-chevron-right | FN-M05-3.1.3 |
| EL-M05-S4-015 | heading | visible-default | "Sains" | FN-M05-3.1.3 |
| EL-M05-S4-016 | link | visible-default | "Sejarah 8 bab tersedia 1,931 soalan chapter", → /practice/chapter/SEJ, fa-chevron-right | FN-M05-3.1.3 |
| EL-M05-S4-017 | heading | visible-default | "Sejarah" | FN-M05-3.1.3 |
| EL-M05-S4-018 | link | visible-default | "Pendidikan Islam 14 bab tersedia 3,371 soalan chapter", → /practice/chapter/PI, fa-chevron-right | FN-M05-3.1.3 |
| EL-M05-S4-019 | heading | visible-default | "Pendidikan Islam" | FN-M05-3.1.3 |
| EL-M05-S4-020 | link | visible-default | "Pendidikan Moral 14 bab tersedia 3,307 soalan chapter", → /practice/chapter/PM, fa-chevron-right | FN-M05-3.1.3 |
| EL-M05-S4-021 | heading | visible-default | "Pendidikan Moral" | FN-M05-3.1.3 |
| EL-M05-S4-022 | link | visible-default | "Geografi 8 bab tersedia 800 soalan chapter", → /practice/chapter/GEO, fa-chevron-right | FN-M05-3.1.3 |
| EL-M05-S4-023 | heading | visible-default | "Geografi" | FN-M05-3.1.3 |
| EL-M05-S4-024 | link | visible-default | "Bahasa Arab 17 bab tersedia 1,700 soalan chapter", → /practice/chapter/BA, fa-chevron-right | FN-M05-3.1.3 |
| EL-M05-S4-025 | heading | visible-default | "Bahasa Arab" | FN-M05-3.1.3 |
| EL-M05-S4-026 | link | visible-default | "Jawi 13 bab tersedia 1,300 soalan chapter", → /practice/chapter/JAWI, fa-pen-nib | FN-M05-3.1.3 |
| EL-M05-S4-027 | heading | visible-default | "Jawi" | FN-M05-3.1.3 |

#### S5 — `/practice/chapter/{CODE}?level={id}` (47 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M05-S5-001 | text | hidden-only | "LIVE:", fa-circle | Excluded: M16 tournament banner (global widget) |
| EL-M05-S5-002 | text | hidden-only | "MAIN" | Excluded: M16 tournament banner (global widget) |
| EL-M05-S5-003 | text | hidden-only | "DAFTAR" | Excluded: M16 tournament banner (global widget) |
| EL-M05-S5-004 | link | visible-default | "Semua Subjek", → /practice/chapter, fa-arrow-left | FN-M05-3.2.1 |
| EL-M05-S5-005 | text | visible-default | "Progressive Unlock" | FN-M05-3.2.1 |
| EL-M05-S5-006 | heading | visible-default (state captured @1280 only) | "Matematik Tambahan" | FN-M05-3.2.1 |
| EL-M05-S5-007 | text | visible-default | "Lengkapkan semua soalan bab semasa dan capai 70% untuk buka bab seterusnya." | FN-M05-3.2.1 |
| EL-M05-S5-008 | form | visible-default (state captured @1280 only) | GET /practice/chapter/ADDMATH | FN-M05-3.2.2 |
| EL-M05-S5-009 | select | visible-default | `level`, 0 options | FN-M05-3.2.2 |
| EL-M05-S5-010 | heading | visible-default (state captured @1280 only) | "Tiada bab tersedia untuk tahap ini." | FN-M05-3.2.3 |
| EL-M05-S5-011 | heading | conditional (state captured @1280 only) | "Bahasa Melayu" | FN-M05-3.2.1 |
| EL-M05-S5-012 | form | conditional (state captured @1280 only) | GET /practice/chapter/BM | FN-M05-3.2.2 |
| EL-M05-S5-013 | card | conditional (state captured @1280 only) | "Bab 1: Kemahiran Mendengar dan Bertutur" | FN-M05-3.2.4 |
| EL-M05-S5-014 | text | conditional | "1" | FN-M05-3.2.4 |
| EL-M05-S5-015 | heading | conditional (state captured @1280 only) | "Bab 1: Kemahiran Mendengar dan Bertutur" | FN-M05-3.2.4 |
| EL-M05-S5-016 | text | conditional (state captured @1280 only) | "18/320 soalan unik · Skor 44.4% · 302 baki" | FN-M05-3.2.4 |
| EL-M05-S5-017 | link | conditional (state captured @1280 only) | "5 soalan", → /practice/chapter/BM/35/quiz?count=5 | FN-M05-3.2.5 |
| EL-M05-S5-018 | link | conditional (state captured @1280 only) | "10 soalan", → /practice/chapter/BM/35/quiz?count=10 | FN-M05-3.2.5 |
| EL-M05-S5-019 | link | conditional (state captured @1280 only) | "15 soalan", → /practice/chapter/BM/35/quiz?count=15 | FN-M05-3.2.5 |
| EL-M05-S5-020 | link | conditional (state captured @1280 only) | "20 soalan", → /practice/chapter/BM/35/quiz?count=20 | FN-M05-3.2.5 |
| EL-M05-S5-021 | card | conditional (state captured @1280 only) | "Bab 2: Kemahiran Membaca" | FN-M05-3.2.6 |
| EL-M05-S5-022 | heading | conditional (state captured @1280 only) | "Bab 2: Kemahiran Membaca" | FN-M05-3.2.6 |
| EL-M05-S5-023 | text | conditional (state captured @1280 only) | "5/317 soalan unik · Skor 60% · 312 baki" | FN-M05-3.2.6 |
| EL-M05-S5-024 | text | conditional | "Kunci bab sebelumnya" | FN-M05-3.2.6 |
| EL-M05-S5-025 | card | conditional (state captured @1280 only) | "Bab 3: Kemahiran Menulis" | FN-M05-3.2.6 |
| EL-M05-S5-026 | heading | conditional (state captured @1280 only) | "Bab 3: Kemahiran Menulis" | FN-M05-3.2.6 |
| EL-M05-S5-027 | text | conditional (state captured @1280 only) | "10/321 soalan unik · Skor 80% · 311 baki" | FN-M05-3.2.6 |
| EL-M05-S5-028 | text | conditional | "Kunci bab sebelumnya" | FN-M05-3.2.6 |
| EL-M05-S5-029 | heading | conditional | "Matematik" | FN-M05-3.2.1 |
| EL-M05-S5-030 | form | conditional | GET /practice/chapter/MATH | FN-M05-3.2.2 |
| EL-M05-S5-031 | card | conditional | "Bab 1: Nombor Bulat hingga 100" | FN-M05-3.2.4 |
| EL-M05-S5-032 | heading | conditional | "Bab 1: Nombor Bulat hingga 100" | FN-M05-3.2.4 |
| EL-M05-S5-033 | text | conditional | "0/464 soalan unik · Skor 0% · 464 baki" | FN-M05-3.2.4 |
| EL-M05-S5-034 | link | conditional | "5 soalan", → /practice/chapter/MATH/1/quiz?count=5 | FN-M05-3.2.5 |
| EL-M05-S5-035 | link | conditional | "10 soalan", → /practice/chapter/MATH/1/quiz?count=10 | FN-M05-3.2.5 |
| EL-M05-S5-036 | link | conditional | "15 soalan", → /practice/chapter/MATH/1/quiz?count=15 | FN-M05-3.2.5 |
| EL-M05-S5-037 | link | conditional | "20 soalan", → /practice/chapter/MATH/1/quiz?count=20 | FN-M05-3.2.5 |
| EL-M05-S5-038 | card | conditional | "Bab 2: Sukatan dan Geometri" | FN-M05-3.2.6 |
| EL-M05-S5-039 | heading | conditional | "Bab 2: Sukatan dan Geometri" | FN-M05-3.2.6 |
| EL-M05-S5-040 | text | conditional | "0/302 soalan unik · Skor 0% · 302 baki" | FN-M05-3.2.6 |
| EL-M05-S5-041 | card | conditional | "Bab 3: Pecahan" | FN-M05-3.2.6 |
| EL-M05-S5-042 | heading | conditional | "Bab 3: Pecahan" | FN-M05-3.2.6 |
| EL-M05-S5-043 | text | conditional | "0/316 soalan unik · Skor 0% · 316 baki" | FN-M05-3.2.6 |
| EL-M05-S5-044 | card | conditional (state captured @1280 only) | "Bab 2: Sukatan dan Geometri D2" | FN-M05-3.2.6 |
| EL-M05-S5-045 | heading | conditional (state captured @1280 only) | "Bab 2: Sukatan dan Geometri D2" | FN-M05-3.2.6 |
| EL-M05-S5-046 | card | conditional (state captured @1280 only) | "Bab 3: Pecahan dan Perpuluhan" | FN-M05-3.2.6 |
| EL-M05-S5-047 | heading | conditional (state captured @1280 only) | "Bab 3: Pecahan dan Perpuluhan" | FN-M05-3.2.6 |

#### S6 — `/practice/revision` (18 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M05-S6-001 | text | hidden-only | "LIVE:", fa-circle | Excluded: M16 tournament banner (global widget) |
| EL-M05-S6-002 | text | hidden-only | "MAIN" | Excluded: M16 tournament banner (global widget) |
| EL-M05-S6-003 | text | hidden-only | "DAFTAR" | Excluded: M16 tournament banner (global widget) |
| EL-M05-S6-004 | heading | visible-default | "Soalan Aku Salah" | FN-M05-4.1.2 |
| EL-M05-S6-005 | text | visible-default | "Ulang kaji soalan yang pernah dijawab salah" | FN-M05-4.1.2 |
| EL-M05-S6-006 | text | visible-default | "72 soalan perlu diulang kaji", fa-exclamation-circle | FN-M05-4.1.2 |
| EL-M05-S6-007 | link | visible-default | "Bahasa Melayu Malay Language 46 soalan salah", → /practice/revision/BM, fa-book-open | FN-M05-4.1.3 |
| EL-M05-S6-008 | heading | visible-default | "Bahasa Melayu" | FN-M05-4.1.3 |
| EL-M05-S6-009 | badge | visible-default | "46 soalan salah", fa-times-circle | FN-M05-4.1.3 |
| EL-M05-S6-010 | link | visible-default | "Sejarah History 26 soalan salah", → /practice/revision/SEJ, fa-clock | FN-M05-4.1.3 |
| EL-M05-S6-011 | heading | visible-default | "Sejarah" | FN-M05-4.1.3 |
| EL-M05-S6-012 | badge | visible-default | "26 soalan salah", fa-times-circle | FN-M05-4.1.3 |
| EL-M05-S6-013 | text | visible-default | "Tips Ulang Kaji", fa-lightbulb | FN-M05-4.1.4 |
| EL-M05-S6-014 | text | visible-default | "Soalan yang paling kerap dijawab salah akan dipaparkan dahulu" | FN-M05-4.1.4 |
| EL-M05-S6-015 | text | visible-default | "Apabila anda jawab betul, soalan itu akan dikeluarkan dari senarai ini" | FN-M05-4.1.4 |
| EL-M05-S6-016 | text | visible-default | "Anda tetap mendapat syiling dan coin seperti latihan biasa" | FN-M05-4.1.4 |
| EL-M05-S6-017 | link | visible-default | "Kembali ke Latihan", → /practice, fa-arrow-left | FN-M05-4.1.5 |
| EL-M05-S6-018 | alert | conditional (state captured @1280 only) | "Tiada soalan salah untuk subjek ini. Tahniah!", fa-check-circle | FN-M05-4.1.6 |

#### S8 — `/practice/progress?period=` (54 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M05-S8-001 | text | hidden-only | "LIVE:", fa-circle | Excluded: M16 tournament banner (global widget) |
| EL-M05-S8-002 | text | hidden-only | "MAIN" | Excluded: M16 tournament banner (global widget) |
| EL-M05-S8-003 | text | hidden-only | "DAFTAR" | Excluded: M16 tournament banner (global widget) |
| EL-M05-S8-004 | filter | visible-default | "7 Hari", → ?period=7 | FN-M05-6.1.2 |
| EL-M05-S8-005 | filter | visible-default | "30 Hari", → ?period=30 | FN-M05-6.1.2 |
| EL-M05-S8-006 | filter | visible-default | "3 Bulan", → ?period=90 | FN-M05-6.1.2 |
| EL-M05-S8-007 | filter | visible-default | "Semua", → ?period=all | FN-M05-6.1.2 |
| EL-M05-S8-008 | text | visible-default | "📝" | FN-M05-6.1.3 |
| EL-M05-S8-009 | text | visible-default | "0" | FN-M05-6.1.3 |
| EL-M05-S8-010 | text | visible-default | "Soalan Dijawab" | FN-M05-6.1.3 |
| EL-M05-S8-011 | text | visible-default | "🎯" | FN-M05-6.1.3 |
| EL-M05-S8-012 | text | visible-default (state captured @1280 only) | "0%" | FN-M05-6.1.3 |
| EL-M05-S8-013 | text | visible-default | "Ketepatan Keseluruhan" | FN-M05-6.1.3 |
| EL-M05-S8-014 | text | visible-default | "📋" | FN-M05-6.1.3 |
| EL-M05-S8-015 | text | visible-default | "0" | FN-M05-6.1.3 |
| EL-M05-S8-016 | text | visible-default | "Sesi Latihan" | FN-M05-6.1.3 |
| EL-M05-S8-017 | text | visible-default | "⏱️" | FN-M05-6.1.3 |
| EL-M05-S8-018 | text | visible-default (state captured @1280 only) | "0m" | FN-M05-6.1.3 |
| EL-M05-S8-019 | text | visible-default | "Masa Berlatih" | FN-M05-6.1.3 |
| EL-M05-S8-020 | text | visible-default (state captured @1280 only) | "📊" | FN-M05-6.1.4 |
| EL-M05-S8-021 | heading | visible-default (state captured @1280 only) | "Belum Ada Data" | FN-M05-6.1.4 |
| EL-M05-S8-022 | text | visible-default (state captured @1280 only) | "Mula buat latihan untuk lihat kemajuan kamu di sini!" | FN-M05-6.1.4 |
| EL-M05-S8-023 | link | visible-default (state captured @1280 only) | "Mula Latihan", → /practice, fa-play | FN-M05-6.1.4 |
| EL-M05-S8-024 | text | conditional | "38.7%" | FN-M05-6.1.3 |
| EL-M05-S8-025 | text | conditional | "4m" | FN-M05-6.1.3 |
| EL-M05-S8-026 | card | conditional | "Trend Ketepatan" | FN-M05-6.1.5 |
| EL-M05-S8-027 | heading | conditional | "Trend Ketepatan" | FN-M05-6.1.5 |
| EL-M05-S8-028 | heading | conditional | "Topik Perlu Perhatian" | FN-M05-6.1.6 |
| EL-M05-S8-029 | text | conditional | "BM" | FN-M05-6.1.6 |
| EL-M05-S8-030 | text | conditional | "Bahasa Melayu" | FN-M05-6.1.6 |
| EL-M05-S8-031 | text | conditional | "79 soalan" | FN-M05-6.1.6 |
| EL-M05-S8-032 | text | conditional | "40.5%" | FN-M05-6.1.6 |
| EL-M05-S8-033 | link | conditional | "Ulang Kaji", → /practice/BM | FN-M05-6.1.6 |
| EL-M05-S8-034 | text | conditional | "SE" | FN-M05-6.1.6 |
| EL-M05-S8-035 | text | conditional | "Sejarah" | FN-M05-6.1.6 |
| EL-M05-S8-036 | text | conditional | "40 soalan" | FN-M05-6.1.6 |
| EL-M05-S8-037 | text | conditional | "35.0%" | FN-M05-6.1.6 |
| EL-M05-S8-038 | link | conditional | "Ulang Kaji", → /practice/SEJ | FN-M05-6.1.6 |
| EL-M05-S8-039 | heading | conditional | "Prestasi Mengikut Subjek" | FN-M05-6.1.7 |
| EL-M05-S8-040 | card | conditional | "BM" | FN-M05-6.1.7 |
| EL-M05-S8-041 | text | conditional | "BM" | FN-M05-6.1.7 |
| EL-M05-S8-042 | heading | conditional | "Bahasa Melayu" | FN-M05-6.1.7 |
| EL-M05-S8-043 | text | conditional | "79 soalan dijawab" | FN-M05-6.1.7 |
| EL-M05-S8-044 | text | conditional | "40.5%" | FN-M05-6.1.7 |
| EL-M05-S8-045 | text | conditional | "Trend:" | FN-M05-6.1.7 |
| EL-M05-S8-046 | text | conditional | "32 betul", fa-check | FN-M05-6.1.7 |
| EL-M05-S8-047 | text | conditional | "47 salah", fa-times | FN-M05-6.1.7 |
| EL-M05-S8-048 | card | conditional | "SE" | FN-M05-6.1.7 |
| EL-M05-S8-049 | text | conditional | "SE" | FN-M05-6.1.7 |
| EL-M05-S8-050 | heading | conditional | "Sejarah" | FN-M05-6.1.7 |
| EL-M05-S8-051 | text | conditional | "40 soalan dijawab" | FN-M05-6.1.7 |
| EL-M05-S8-052 | text | conditional | "35.0%" | FN-M05-6.1.7 |
| EL-M05-S8-053 | text | conditional | "14 betul", fa-check | FN-M05-6.1.7 |
| EL-M05-S8-054 | text | conditional | "26 salah", fa-times | FN-M05-6.1.7 |

#### S9 — `/practice/history?period=` (64 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M05-S9-001 | text | hidden-only | "LIVE:", fa-circle | Excluded: M16 tournament banner (global widget) |
| EL-M05-S9-002 | text | hidden-only | "MAIN" | Excluded: M16 tournament banner (global widget) |
| EL-M05-S9-003 | text | hidden-only | "DAFTAR" | Excluded: M16 tournament banner (global widget) |
| EL-M05-S9-004 | card | visible-default | "Jumlah Sesi" | FN-M05-6.2.2 |
| EL-M05-S9-005 | text | visible-default | "✨" | FN-M05-6.2.2 |
| EL-M05-S9-006 | text | visible-default | "Jumlah Sesi" | FN-M05-6.2.2 |
| EL-M05-S9-007 | text | visible-default | "4" | FN-M05-6.2.2 |
| EL-M05-S9-008 | card | visible-default | "Soalan Dijawab" | FN-M05-6.2.2 |
| EL-M05-S9-009 | text | visible-default | "🎯" | FN-M05-6.2.2 |
| EL-M05-S9-010 | text | visible-default | "Soalan Dijawab" | FN-M05-6.2.2 |
| EL-M05-S9-011 | text | visible-default | "84" | FN-M05-6.2.2 |
| EL-M05-S9-012 | card | visible-default | "Purata Ketepatan" | FN-M05-6.2.2 |
| EL-M05-S9-013 | text | visible-default | "📊" | FN-M05-6.2.2 |
| EL-M05-S9-014 | text | visible-default | "Purata Ketepatan" | FN-M05-6.2.2 |
| EL-M05-S9-015 | text | visible-default | "21.8%" | FN-M05-6.2.2 |
| EL-M05-S9-016 | card | visible-default | "Syiling Dikumpul" | FN-M05-6.2.2 |
| EL-M05-S9-017 | text | visible-default | "💰" | FN-M05-6.2.2 |
| EL-M05-S9-018 | text | visible-default | "Syiling Dikumpul" | FN-M05-6.2.2 |
| EL-M05-S9-019 | text | visible-default | "26" | FN-M05-6.2.2 |
| EL-M05-S9-020 | link | visible-default | "Semua", → /practice/history, fa-infinity | FN-M05-6.2.3 |
| EL-M05-S9-021 | link | visible-default | "Minggu Ini", → /practice/history?period=week, fa-calendar-week | FN-M05-6.2.3 |
| EL-M05-S9-022 | link | visible-default | "Bulan Ini", → /practice/history?period=month, fa-calendar-alt | FN-M05-6.2.3 |
| EL-M05-S9-023 | link | visible-default | "Tahun Ini", → /practice/history?period=year, fa-calendar | FN-M05-6.2.3 |
| EL-M05-S9-024 | card | visible-default | "Latihan" | FN-M05-6.2.4 |
| EL-M05-S9-025 | text | visible-default | "Latihan", fa-book | FN-M05-6.2.4 |
| EL-M05-S9-026 | text | visible-default | "19 May 2026, 03:49", fa-clock | FN-M05-6.2.4 |
| EL-M05-S9-027 | text | visible-default | "0" | FN-M05-6.2.4 |
| EL-M05-S9-028 | text | visible-default | "/" | FN-M05-6.2.4 |
| EL-M05-S9-029 | text | visible-default | "5" | FN-M05-6.2.4 |
| EL-M05-S9-030 | badge | visible-default | "00:14", fa-clock | FN-M05-6.2.4 |
| EL-M05-S9-031 | text | visible-default | "betul", fa-check-circle | FN-M05-6.2.4 |
| EL-M05-S9-032 | text | visible-default | "0" | FN-M05-6.2.4 |
| EL-M05-S9-033 | text | visible-default | "salah", fa-times-circle | FN-M05-6.2.4 |
| EL-M05-S9-034 | text | visible-default | "5" | FN-M05-6.2.4 |
| EL-M05-S9-035 | text | visible-default | "💪 Cuba Lagi" | FN-M05-6.2.4 |
| EL-M05-S9-036 | text | visible-default | "0.0%" | FN-M05-6.2.4 |
| EL-M05-S9-037 | text | visible-default | "Ketepatan: 0.0%" | FN-M05-6.2.4 |
| EL-M05-S9-038 | text | visible-default | "🪙" | FN-M05-6.2.4 |
| EL-M05-S9-039 | text | visible-default | "0" | FN-M05-6.2.4 |
| EL-M05-S9-040 | text | visible-default | "SYILING" | FN-M05-6.2.4 |
| EL-M05-S9-041 | card | visible-default | "Latihan" | FN-M05-6.2.4 |
| EL-M05-S9-042 | text | visible-default | "Latihan", fa-book | FN-M05-6.2.4 |
| EL-M05-S9-043 | text | visible-default | "19 May 2026, 03:26", fa-clock | FN-M05-6.2.4 |
| EL-M05-S9-044 | text | visible-default | "1" | FN-M05-6.2.4 |
| EL-M05-S9-045 | text | visible-default | "/" | FN-M05-6.2.4 |
| EL-M05-S9-046 | text | visible-default | "5" | FN-M05-6.2.4 |
| EL-M05-S9-047 | badge | visible-default | "00:36", fa-clock | FN-M05-6.2.4 |
| EL-M05-S9-048 | text | visible-default | "betul", fa-check-circle | FN-M05-6.2.4 |
| EL-M05-S9-049 | text | visible-default | "1" | FN-M05-6.2.4 |
| EL-M05-S9-050 | text | visible-default | "salah", fa-times-circle | FN-M05-6.2.4 |
| EL-M05-S9-051 | text | visible-default | "4" | FN-M05-6.2.4 |
| EL-M05-S9-052 | text | visible-default | "💪 Cuba Lagi" | FN-M05-6.2.4 |
| EL-M05-S9-053 | text | visible-default | "20.0%" | FN-M05-6.2.4 |
| EL-M05-S9-054 | text | visible-default | "20%" | FN-M05-6.2.4 |
| EL-M05-S9-055 | text | visible-default | "Ketepatan: 20.0%" | FN-M05-6.2.4 |
| EL-M05-S9-056 | text | visible-default | "🪙" | FN-M05-6.2.4 |
| EL-M05-S9-057 | text | visible-default | "1" | FN-M05-6.2.4 |
| EL-M05-S9-058 | text | visible-default | "SYILING" | FN-M05-6.2.4 |
| EL-M05-S9-059 | text | conditional (state captured @1280 only) | "📝" | FN-M05-6.2.5 |
| EL-M05-S9-060 | text | conditional (state captured @1280 only) | "✨" | FN-M05-6.2.5 |
| EL-M05-S9-061 | text | conditional (state captured @1280 only) | "🎯" | FN-M05-6.2.5 |
| EL-M05-S9-062 | heading | conditional (state captured @1280 only) | "Belum Ada Rekod Latihan" | FN-M05-6.2.5 |
| EL-M05-S9-063 | text | conditional (state captured @1280 only) | "Anda belum melengkapkan sebarang latihan lagi. Mulakan latihan pertama anda sekarang dan k…" | FN-M05-6.2.5 |
| EL-M05-S9-064 | link | conditional (state captured @1280 only) | "Mula Latihan", → /practice, fa-play-circle | FN-M05-6.2.5 |

#### S10 — `/latihan-berstruktur?subject_id=&kbat_level=&page=` (85 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M05-S10-001 | text | hidden-only | "LIVE:", fa-circle | Excluded: M16 tournament banner (global widget) |
| EL-M05-S10-002 | text | hidden-only | "MAIN" | Excluded: M16 tournament banner (global widget) |
| EL-M05-S10-003 | text | hidden-only | "DAFTAR" | Excluded: M16 tournament banner (global widget) |
| EL-M05-S10-004 | heading | visible-default | "Soalan Berstruktur" | FN-M05-5.1.2 |
| EL-M05-S10-005 | text | visible-default | "Latih tubi format Kertas 2 — jawab & semak secara automatik" | FN-M05-5.1.2 |
| EL-M05-S10-006 | card | visible-default | "Subjek" | FN-M05-5.1.3 |
| EL-M05-S10-007 | form | visible-default | GET (same URL) | FN-M05-5.1.3 |
| EL-M05-S10-008 | label | visible-default | "Subjek" | FN-M05-5.1.3 |
| EL-M05-S10-009 | select | visible-default | `subject_id`, 32 options (first "Semua Subjek") | FN-M05-5.1.3 |
| EL-M05-S10-010 | label | visible-default | "Aras KBAT" | FN-M05-5.1.3 |
| EL-M05-S10-011 | select | visible-default | `kbat_level`, 7 options (first "Semua") | FN-M05-5.1.3 |
| EL-M05-S10-012 | button | visible-default | "Cari", fa-search | FN-M05-5.1.3 |
| EL-M05-S10-013 | card | visible-default | "Perniagaan" | FN-M05-5.1.4 |
| EL-M05-S10-014 | badge | visible-default | "Perniagaan" | FN-M05-5.1.4 |
| EL-M05-S10-015 | text | visible-default | "MOTS 3" | FN-M05-5.1.4 |
| EL-M05-S10-016 | badge | visible-default | "8m" | FN-M05-5.1.4 |
| EL-M05-S10-017 | badge | visible-default | "Trial" | FN-M05-5.1.4 |
| EL-M05-S10-018 | text | visible-default | "<masked>" | FN-M05-5.1.4 |
| EL-M05-S10-019 | text | visible-default | "Merancang Pengendalian Perniagaan", fa-book-open | FN-M05-5.1.4 |
| EL-M05-S10-020 | text | visible-default | "<masked>", fa-user-pen | FN-M05-5.1.4 |
| EL-M05-S10-021 | text | visible-default | "1 soalan · Tingkatan 5", fa-list-ol | FN-M05-5.1.4 |
| EL-M05-S10-022 | link | visible-default | "Mula", → /latihan-berstruktur/4454/jawab, fa-arrow-right | FN-M05-5.1.5 |
| EL-M05-S10-023 | card | visible-default | "Perniagaan" | FN-M05-5.1.4 |
| EL-M05-S10-024 | badge | visible-default | "Perniagaan" | FN-M05-5.1.4 |
| EL-M05-S10-025 | text | visible-default | "MOTS 3" | FN-M05-5.1.4 |
| EL-M05-S10-026 | badge | visible-default | "7m" | FN-M05-5.1.4 |
| EL-M05-S10-027 | badge | visible-default | "Trial" | FN-M05-5.1.4 |
| EL-M05-S10-028 | text | visible-default | "<masked>" | FN-M05-5.1.4 |
| EL-M05-S10-029 | text | visible-default | "Merancang Pengendalian Perniagaan", fa-book-open | FN-M05-5.1.4 |
| EL-M05-S10-030 | text | visible-default | "<masked>", fa-user-pen | FN-M05-5.1.4 |
| EL-M05-S10-031 | text | visible-default | "1 soalan · Tingkatan 5", fa-list-ol | FN-M05-5.1.4 |
| EL-M05-S10-032 | link | visible-default | "Mula", → /latihan-berstruktur/4455/jawab, fa-arrow-right | FN-M05-5.1.5 |
| EL-M05-S10-033 | card | visible-default | "Perniagaan" | FN-M05-5.1.4 |
| EL-M05-S10-034 | badge | visible-default | "Perniagaan" | FN-M05-5.1.4 |
| EL-M05-S10-035 | text | visible-default | "MOTS 3" | FN-M05-5.1.4 |
| EL-M05-S10-036 | badge | visible-default | "6m" | FN-M05-5.1.4 |
| EL-M05-S10-037 | badge | visible-default | "Trial" | FN-M05-5.1.4 |
| EL-M05-S10-038 | text | visible-default | "<masked>" | FN-M05-5.1.4 |
| EL-M05-S10-039 | text | visible-default | "Merancang Pengendalian Perniagaan", fa-book-open | FN-M05-5.1.4 |
| EL-M05-S10-040 | text | visible-default | "<masked>", fa-user-pen | FN-M05-5.1.4 |
| EL-M05-S10-041 | text | visible-default | "1 soalan · Tingkatan 5", fa-list-ol | FN-M05-5.1.4 |
| EL-M05-S10-042 | link | visible-default | "Mula", → /latihan-berstruktur/4456/jawab, fa-arrow-right | FN-M05-5.1.5 |
| EL-M05-S10-043 | text | conditional | "« Previous" | FN-M05-5.1.6 |
| EL-M05-S10-044 | pagination | conditional | "Next »", → /latihan-berstruktur?page=2 | FN-M05-5.1.6 |
| EL-M05-S10-045 | text | visible-default | "Showing to of results" | FN-M05-5.1.6 |
| EL-M05-S10-046 | text | visible-default | "1" | FN-M05-5.1.6 |
| EL-M05-S10-047 | text | visible-default | "20" | FN-M05-5.1.6 |
| EL-M05-S10-048 | text | visible-default | "4061" | FN-M05-5.1.6 |
| EL-M05-S10-049 | text | visible-default | "1" | FN-M05-5.1.6 |
| EL-M05-S10-050 | pagination | visible-default | "2", → /latihan-berstruktur?page=2 | FN-M05-5.1.6 |
| EL-M05-S10-051 | pagination | visible-default | "3", → /latihan-berstruktur?page=3 | FN-M05-5.1.6 |
| EL-M05-S10-052 | pagination | visible-default | "4", → /latihan-berstruktur?page=4 | FN-M05-5.1.6 |
| EL-M05-S10-053 | pagination | visible-default | "5", → /latihan-berstruktur?page=5 | FN-M05-5.1.6 |
| EL-M05-S10-054 | pagination | visible-default | "6", → /latihan-berstruktur?page=6 | FN-M05-5.1.6 |
| EL-M05-S10-055 | pagination | visible-default | "7", → /latihan-berstruktur?page=7 | FN-M05-5.1.6 |
| EL-M05-S10-056 | pagination | visible-default | "8", → /latihan-berstruktur?page=8 | FN-M05-5.1.6 |
| EL-M05-S10-057 | pagination | visible-default | "9", → /latihan-berstruktur?page=9 | FN-M05-5.1.6 |
| EL-M05-S10-058 | pagination | visible-default | "10", → /latihan-berstruktur?page=10 | FN-M05-5.1.6 |
| EL-M05-S10-059 | text | visible-default | "..." | FN-M05-5.1.6 |
| EL-M05-S10-060 | pagination | visible-default | "203", → /latihan-berstruktur?page=203 | FN-M05-5.1.6 |
| EL-M05-S10-061 | pagination | visible-default | "204", → /latihan-berstruktur?page=204 | FN-M05-5.1.6 |
| EL-M05-S10-062 | pagination | visible-default | → /latihan-berstruktur?page=2, svg | FN-M05-5.1.6 |
| EL-M05-S10-063 | empty-state | conditional (state captured @1280 only) | "Tiada soalan berstruktur buat masa ini" | FN-M05-5.1.7 |
| EL-M05-S10-064 | text | conditional (state captured @1280 only) | "Soalan akan ditambah oleh guru dan admin" | FN-M05-5.1.7 |
| EL-M05-S10-065 | card | conditional (state captured @1280 only) | "Matematik" | FN-M05-5.1.4 |
| EL-M05-S10-066 | badge | conditional (state captured @1280 only) | "Matematik" | FN-M05-5.1.4 |
| EL-M05-S10-067 | text | conditional (state captured @1280 only) | "LOTS 1" | FN-M05-5.1.4 |
| EL-M05-S10-068 | badge | conditional (state captured @1280 only) | "4m" | FN-M05-5.1.4 |
| EL-M05-S10-069 | text | conditional (state captured @1280 only) | "2 soalan · Tingkatan 4", fa-list-ol | FN-M05-5.1.4 |
| EL-M05-S10-070 | card | conditional (state captured @1280 only) | "Matematik" | FN-M05-5.1.4 |
| EL-M05-S10-071 | badge | conditional (state captured @1280 only) | "Matematik" | FN-M05-5.1.4 |
| EL-M05-S10-072 | text | conditional (state captured @1280 only) | "LOTS 1" | FN-M05-5.1.4 |
| EL-M05-S10-073 | text | conditional (state captured @1280 only) | "3 soalan · Tingkatan 4", fa-list-ol | FN-M05-5.1.4 |
| EL-M05-S10-074 | card | conditional (state captured @1280 only) | "Matematik" | FN-M05-5.1.4 |
| EL-M05-S10-075 | badge | conditional (state captured @1280 only) | "Matematik" | FN-M05-5.1.4 |
| EL-M05-S10-076 | text | conditional (state captured @1280 only) | "LOTS 1" | FN-M05-5.1.4 |
| EL-M05-S10-077 | badge | conditional (state captured @1280 only) | "4m" | FN-M05-5.1.4 |
| EL-M05-S10-078 | text | conditional (state captured @1280 only) | "3 soalan · Tingkatan 4", fa-list-ol | FN-M05-5.1.4 |
| EL-M05-S10-079 | badge | conditional (state captured @1280 only) | "3m" | FN-M05-5.1.4 |
| EL-M05-S10-080 | text | conditional (state captured @1280 only) | "Kewangan Perniagaan", fa-book-open | FN-M05-5.1.4 |
| EL-M05-S10-081 | text | conditional (state captured @1280 only) | "Bahagian Fungsian Utama dalam Organisasi Perniagaan", fa-book-open | FN-M05-5.1.4 |
| EL-M05-S10-082 | text | conditional (state captured @1280 only) | "1 soalan · Tingkatan 4", fa-list-ol | FN-M05-5.1.4 |
| EL-M05-S10-083 | text | conditional (state captured @1280 only) | "Perniagaan Antarabangsa", fa-book-open | FN-M05-5.1.4 |
| EL-M05-S10-084 | pagination | hidden-only | "« Previous", → /latihan-berstruktur?page=1 | FN-M05-5.1.6 |
| EL-M05-S10-085 | pagination | conditional (state captured @1280 only) | → /latihan-berstruktur?page=3, svg | FN-M05-5.1.6 |

#### S11 — `/pembetulan?bulan=YYYY-MM` (44 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M05-S11-001 | text | hidden-only | "LIVE:", fa-circle | Excluded: M16 tournament banner (global widget) |
| EL-M05-S11-002 | text | hidden-only | "MAIN" | Excluded: M16 tournament banner (global widget) |
| EL-M05-S11-003 | text | hidden-only | "DAFTAR" | Excluded: M16 tournament banner (global widget) |
| EL-M05-S11-004 | card | visible-default (state captured @1280 only) | "September 2026" | FN-M05-7.1.2 |
| EL-M05-S11-005 | text | visible-default | "Bulan:" | FN-M05-7.1.2 |
| EL-M05-S11-006 | link | visible-default (state captured @1280 only) | → /pembetulan?bulan=2026-08, svg | FN-M05-7.1.2 |
| EL-M05-S11-007 | text | visible-default (state captured @1280 only) | "September 2026" | FN-M05-7.1.2 |
| EL-M05-S11-008 | card | visible-default (state captured @1280 only) | "Tiada Data Pembetulan" | FN-M05-7.1.3 |
| EL-M05-S11-009 | text | visible-default (state captured @1280 only) | "🔄" | FN-M05-7.1.3 |
| EL-M05-S11-010 | heading | visible-default (state captured @1280 only) | "Tiada Data Pembetulan" | FN-M05-7.1.3 |
| EL-M05-S11-011 | text | visible-default (state captured @1280 only) | "Cuba buat pembetulan jawapan semasa sesi latih tubi untuk melihat peningkatan di sini." | FN-M05-7.1.3 |
| EL-M05-S11-012 | card | conditional (state captured @1280 only) | "Oktober 2026" | FN-M05-7.1.2 |
| EL-M05-S11-013 | link | conditional (state captured @1280 only) | → /pembetulan?bulan=2026-09, svg | FN-M05-7.1.2 |
| EL-M05-S11-014 | text | conditional (state captured @1280 only) | "Oktober 2026" | FN-M05-7.1.2 |
| EL-M05-S11-015 | link | conditional (state captured @1280 only) | → /pembetulan?bulan=2026-11, svg | FN-M05-7.1.2 |
| EL-M05-S11-016 | card | conditional | "Mei 2026" | FN-M05-7.1.2 |
| EL-M05-S11-017 | link | conditional | → /pembetulan?bulan=2026-04, svg | FN-M05-7.1.2 |
| EL-M05-S11-018 | text | conditional | "Mei 2026" | FN-M05-7.1.2 |
| EL-M05-S11-019 | link | conditional | → /pembetulan?bulan=2026-06, svg | FN-M05-7.1.2 |
| EL-M05-S11-020 | card | conditional | "Ringkasan Keseluruhan" | FN-M05-7.1.4 |
| EL-M05-S11-021 | heading | conditional | "Ringkasan Keseluruhan" | FN-M05-7.1.4 |
| EL-M05-S11-022 | text | conditional | "33.8%" | FN-M05-7.1.4 |
| EL-M05-S11-023 | text | conditional | "Sebelum" | FN-M05-7.1.4 |
| EL-M05-S11-024 | text | conditional | "33.8%" | FN-M05-7.1.4 |
| EL-M05-S11-025 | text | conditional | "Selepas" | FN-M05-7.1.4 |
| EL-M05-S11-026 | text | conditional | "0.0%" | FN-M05-7.1.4 |
| EL-M05-S11-027 | text | conditional | "Peningkatan" | FN-M05-7.1.4 |
| EL-M05-S11-028 | text | conditional | "Berdasarkan 74 soalan bulan ini" | FN-M05-7.1.4 |
| EL-M05-S11-029 | card | conditional | "Mengikut Subjek" | FN-M05-7.1.5 |
| EL-M05-S11-030 | heading | conditional | "Mengikut Subjek" | FN-M05-7.1.5 |
| EL-M05-S11-031 | text | conditional | "Sejarah" | FN-M05-7.1.5 |
| EL-M05-S11-032 | text | conditional | "40 soalan" | FN-M05-7.1.5 |
| EL-M05-S11-033 | text | conditional | "Sebelum" | FN-M05-7.1.5 |
| EL-M05-S11-034 | text | conditional | "35.0%" | FN-M05-7.1.5 |
| EL-M05-S11-035 | text | conditional | "Selepas" | FN-M05-7.1.5 |
| EL-M05-S11-036 | text | conditional | "35.0%" | FN-M05-7.1.5 |
| EL-M05-S11-037 | badge | conditional | "0.0%" | FN-M05-7.1.5 |
| EL-M05-S11-038 | text | conditional | "Bahasa Melayu" | FN-M05-7.1.5 |
| EL-M05-S11-039 | text | conditional | "34 soalan" | FN-M05-7.1.5 |
| EL-M05-S11-040 | text | conditional | "Sebelum" | FN-M05-7.1.5 |
| EL-M05-S11-041 | text | conditional | "32.4%" | FN-M05-7.1.5 |
| EL-M05-S11-042 | text | conditional | "Selepas" | FN-M05-7.1.5 |
| EL-M05-S11-043 | text | conditional | "32.4%" | FN-M05-7.1.5 |
| EL-M05-S11-044 | badge | conditional | "0.0%" | FN-M05-7.1.5 |

#### S12 — `/penguasaan` (43 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M05-S12-001 | text | hidden-only | "LIVE:", fa-circle | Excluded: M16 tournament banner (global widget) |
| EL-M05-S12-002 | text | hidden-only | "MAIN" | Excluded: M16 tournament banner (global widget) |
| EL-M05-S12-003 | text | hidden-only | "DAFTAR" | Excluded: M16 tournament banner (global widget) |
| EL-M05-S12-004 | card | visible-default | "Skala Penguasaan" | FN-M05-7.2.2 |
| EL-M05-S12-005 | text | visible-default | "Skala Penguasaan" | FN-M05-7.2.2 |
| EL-M05-S12-006 | text | visible-default | "L0 Pemula" | FN-M05-7.2.2 |
| EL-M05-S12-007 | text | visible-default | "L1 Mula Belajar" | FN-M05-7.2.2 |
| EL-M05-S12-008 | text | visible-default | "L2 Aktif" | FN-M05-7.2.2 |
| EL-M05-S12-009 | text | visible-default | "L3 Tekun" | FN-M05-7.2.2 |
| EL-M05-S12-010 | text | visible-default | "L4 Mahir" | FN-M05-7.2.2 |
| EL-M05-S12-011 | text | visible-default | "L5 Pakar Muda" | FN-M05-7.2.2 |
| EL-M05-S12-012 | text | visible-default | "L6 Cemerlang" | FN-M05-7.2.2 |
| EL-M05-S12-013 | text | visible-default | "L7 Master" | FN-M05-7.2.2 |
| EL-M05-S12-014 | text | visible-default | "L8 Grandmaster" | FN-M05-7.2.2 |
| EL-M05-S12-015 | text | visible-default | "L9 Legend" | FN-M05-7.2.2 |
| EL-M05-S12-016 | text | visible-default | "L10 Mythical" | FN-M05-7.2.2 |
| EL-M05-S12-017 | card | visible-default | "Bahasa Melayu" | FN-M05-7.2.3 |
| EL-M05-S12-018 | text | visible-default | "Bahasa Melayu" | FN-M05-7.2.3 |
| EL-M05-S12-019 | text | visible-default | "(BM)" | FN-M05-7.2.3 |
| EL-M05-S12-020 | text | visible-default | "L2 Aktif" | FN-M05-7.2.3 |
| EL-M05-S12-021 | text | visible-default | "46" | FN-M05-7.2.3 |
| EL-M05-S12-022 | text | visible-default | "Betul" | FN-M05-7.2.3 |
| EL-M05-S12-023 | text | visible-default | "94" | FN-M05-7.2.3 |
| EL-M05-S12-024 | text | visible-default | "Dijawab" | FN-M05-7.2.3 |
| EL-M05-S12-025 | text | visible-default | "48.9%" | FN-M05-7.2.3 |
| EL-M05-S12-026 | text | visible-default | "Tepat" | FN-M05-7.2.3 |
| EL-M05-S12-027 | text | visible-default | "Menuju L3" | FN-M05-7.2.3 |
| EL-M05-S12-028 | text | visible-default | "46/50 betul" | FN-M05-7.2.3 |
| EL-M05-S12-029 | text | visible-default | "x1.05 XP" | FN-M05-7.2.3 |
| EL-M05-S12-030 | text | visible-default | "Terakhir: 4 bulan yang lepas" | FN-M05-7.2.3 |
| EL-M05-S12-031 | card | visible-default | "Sejarah" | FN-M05-7.2.3 |
| EL-M05-S12-032 | text | visible-default | "Sejarah" | FN-M05-7.2.3 |
| EL-M05-S12-033 | text | visible-default | "(SEJ)" | FN-M05-7.2.3 |
| EL-M05-S12-034 | text | visible-default | "L1 Mula Belajar" | FN-M05-7.2.3 |
| EL-M05-S12-035 | text | visible-default | "14" | FN-M05-7.2.3 |
| EL-M05-S12-036 | text | visible-default | "Betul" | FN-M05-7.2.3 |
| EL-M05-S12-037 | text | visible-default | "40" | FN-M05-7.2.3 |
| EL-M05-S12-038 | text | visible-default | "Dijawab" | FN-M05-7.2.3 |
| EL-M05-S12-039 | text | visible-default | "35.0%" | FN-M05-7.2.3 |
| EL-M05-S12-040 | text | visible-default | "Tepat" | FN-M05-7.2.3 |
| EL-M05-S12-041 | text | visible-default | "Menuju L2" | FN-M05-7.2.3 |
| EL-M05-S12-042 | text | visible-default | "14/25 betul" | FN-M05-7.2.3 |
| EL-M05-S12-043 | text | visible-default | "Terakhir: 4 bulan yang lepas" | FN-M05-7.2.3 |

#### S13 — `/remedial/saya` (8 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M05-S13-001 | text | hidden-only | "LIVE:", fa-circle | Excluded: M16 tournament banner (global widget) |
| EL-M05-S13-002 | text | hidden-only | "MAIN" | Excluded: M16 tournament banner (global widget) |
| EL-M05-S13-003 | text | hidden-only | "DAFTAR" | Excluded: M16 tournament banner (global widget) |
| EL-M05-S13-004 | text | visible-default | "🔬" | FN-M05-8.1.2 |
| EL-M05-S13-005 | heading | visible-default | "Ujian Remedial Saya" | FN-M05-8.1.2 |
| EL-M05-S13-006 | text | visible-default | "Ujian khas untuk topik yang perlu diperbaiki" | FN-M05-8.1.2 |
| EL-M05-S13-007 | text | visible-default | "🎯" | FN-M05-8.1.3 |
| EL-M05-S13-008 | empty-state | visible-default | "Tiada ujian remedial. Bagus — teruskan usaha!" | FN-M05-8.1.3 |

#### S14 — `/misi-harian` (6 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M05-S14-001 | text | hidden-only | "LIVE:", fa-circle | Excluded: M16 tournament banner (global widget) |
| EL-M05-S14-002 | text | hidden-only | "MAIN" | Excluded: M16 tournament banner (global widget) |
| EL-M05-S14-003 | text | hidden-only | "DAFTAR" | Excluded: M16 tournament banner (global widget) |
| EL-M05-S14-004 | card | visible-default | "Tiada misi hari ini" | FN-M05-8.2.2 |
| EL-M05-S14-005 | empty-state | visible-default | "Tiada misi hari ini" | FN-M05-8.2.2 |
| EL-M05-S14-006 | text | visible-default | "Misi baru akan muncul bila guru anda assign." | FN-M05-8.2.2 |

#### S15 — `/target-spm` (29 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M05-S15-001 | text | hidden-only | "LIVE:", fa-circle | Excluded: M16 tournament banner (global widget) |
| EL-M05-S15-002 | text | hidden-only | "MAIN" | Excluded: M16 tournament banner (global widget) |
| EL-M05-S15-003 | text | hidden-only | "DAFTAR" | Excluded: M16 tournament banner (global widget) |
| EL-M05-S15-004 | form | visible-default | POST /target-spm | FN-M05-8.3.4 |
| EL-M05-S15-005 | hidden-field | hidden-only | hidden `_token` | FN-M05-8.3.4 |
| EL-M05-S15-006 | card | visible-default | "Target Gred SPM" | FN-M05-8.3.2 |
| EL-M05-S15-007 | heading | visible-default | "Target Gred SPM" | FN-M05-8.3.2 |
| EL-M05-S15-008 | text | visible-default | "Pilih target gred untuk setiap subjek. Sistem akan tunjuk kemajuan anda." | FN-M05-8.3.2 |
| EL-M05-S15-009 | button | visible-default | "Simpan", fa-save | FN-M05-8.3.4 |
| EL-M05-S15-010 | text | visible-default | "Bahasa Arab" | FN-M05-8.3.3 |
| EL-M05-S15-011 | text | visible-default | "Belum mula" | FN-M05-8.3.3 |
| EL-M05-S15-012 | text | visible-default | "-" | FN-M05-8.3.3 |
| EL-M05-S15-013 | select | visible-default | `targets[18]`, 10 options (first "Target") | FN-M05-8.3.3 |
| EL-M05-S15-014 | text | visible-default | "Bahasa Inggeris" | FN-M05-8.3.3 |
| EL-M05-S15-015 | text | visible-default | "Belum mula" | FN-M05-8.3.3 |
| EL-M05-S15-016 | text | visible-default | "-" | FN-M05-8.3.3 |
| EL-M05-S15-017 | select | visible-default | `targets[2]`, 10 options (first "Target") | FN-M05-8.3.3 |
| EL-M05-S15-018 | text | visible-default | "Bahasa Melayu" | FN-M05-8.3.3 |
| EL-M05-S15-019 | text | visible-default | "Belum mula" | FN-M05-8.3.3 |
| EL-M05-S15-020 | text | visible-default | "-" | FN-M05-8.3.3 |
| EL-M05-S15-021 | select | visible-default | `targets[1]`, 10 options (first "Target") | FN-M05-8.3.3 |
| EL-M05-S15-022 | text | visible-default | "Biologi" | FN-M05-8.3.3 |
| EL-M05-S15-023 | text | visible-default | "Belum mula" | FN-M05-8.3.3 |
| EL-M05-S15-024 | text | visible-default | "-" | FN-M05-8.3.3 |
| EL-M05-S15-025 | select | visible-default | `targets[11]`, 10 options (first "Target") | FN-M05-8.3.3 |
| EL-M05-S15-026 | text | visible-default | "70%+ Ketepatan (On Track)" | FN-M05-8.3.5 |
| EL-M05-S15-027 | text | visible-default | "50-69% (Perlu Usaha)" | FN-M05-8.3.5 |
| EL-M05-S15-028 | text | visible-default | "<50% (Perlu Fokus)" | FN-M05-8.3.5 |
| EL-M05-S15-029 | text | visible-default | "Tip: Jawab lebih banyak soalan untuk ramalan gred yang lebih tepat", fa-lightbulb | FN-M05-8.3.5 |

### 6.2 Shell elements (M05-relevant only)

#### SHU — user-portal shell (chrome of S1–S15) — 391 elements, 40 M05-relevant

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M05-SHU-004 | link | visible-default (state captured @1280 only) | "Dashboard", → /dashboard, fa-home | FN-M05-9.1.1 |
| EL-M05-SHU-005 | link | visible-default (state captured @1280 only) | "Target SPM", → /target-spm, fa-bullseye | FN-M05-9.1.1 |
| EL-M05-SHU-006 | link | visible-default (state captured @1280 only) | "Misi Harian", → /misi-harian, fa-rocket | FN-M05-9.1.1 |
| EL-M05-SHU-007 | link | visible-default (state captured @1280 only) | "Remedial", → /remedial/saya, fa-flask | FN-M05-9.1.1 |
| EL-M05-SHU-055 | link | visible-default (state captured @1280 only) | "Pembetulan", → /pembetulan, fa-arrows-rotate | FN-M05-9.1.2 |
| EL-M05-SHU-057 | link | visible-default (state captured @1280 only) | "Penguasaan", → /penguasaan, fa-layer-group | FN-M05-9.1.2 |
| EL-M05-SHU-062 | link | visible-default (state captured @1280 only) | "Latih Tubi", → /practice, fa-brain | FN-M05-9.1.3 |
| EL-M05-SHU-063 | link | visible-default (state captured @1280 only) | "Soalan by Chapter", → /practice/chapter, fa-layer-group | FN-M05-9.1.3 |
| EL-M05-SHU-064 | link | visible-default (state captured @1280 only) | "Soalan Berstruktur", → /latihan-berstruktur, fa-list-ol | FN-M05-9.1.3 |
| EL-M05-SHU-112 | link | visible-default (state captured @1280 only) | "Soalan by Chapter", → /practice/chapter, fa-layer-group | FN-M05-9.1.3 |
| EL-M05-SHU-136 | heading | visible-default | "Dashboard" | FN-M05-1.1.1 |
| EL-M05-SHU-137 | text | visible-default | "Selamat datang kembali" | FN-M05-1.1.1 |
| EL-M05-SHU-170 | link | hidden-only | "Dashboard", → /dashboard, fa-home | FN-M05-9.1.4 |
| EL-M05-SHU-186 | link | hidden-only | "Pembetulan", → /pembetulan, fa-arrows-rotate | FN-M05-9.1.4 |
| EL-M05-SHU-187 | link | hidden-only | "Penguasaan", → /penguasaan, fa-layer-group | FN-M05-9.1.4 |
| EL-M05-SHU-203 | link | hidden-only | "Latih Tubi", → /practice, fa-brain | FN-M05-9.1.4 |
| EL-M05-SHU-204 | link | hidden-only | "Soalan by Chapter", → /practice/chapter, fa-layer-group | FN-M05-9.1.4 |
| EL-M05-SHU-205 | link | hidden-only | "Soalan Berstruktur", → /latihan-berstruktur, fa-list-ol | FN-M05-9.1.4 |
| EL-M05-SHU-250 | link | hidden-only | "Soalan by Chapter", → /practice/chapter, fa-layer-group | FN-M05-9.1.4 |
| EL-M05-SHU-308 | link | hidden-only | "Soalan by Chapter", → /practice/chapter, fa-layer-group | FN-M05-9.1.4 |
| EL-M05-SHU-337 | link | conditional | "Home", → /dashboard, fa-home | FN-M05-9.1.5 |
| EL-M05-SHU-373 | heading | conditional | "Latih Tubi" | FN-M05-2.1.1 |
| EL-M05-SHU-374 | text | conditional | "Pilih subjek dan mula berlatih" | FN-M05-2.1.1 |
| EL-M05-SHU-375 | heading | conditional | "Soalan by Chapter" | FN-M05-3.1.1 |
| EL-M05-SHU-376 | text | conditional | "Latihan tersusun ikut bab buku teks dan DSKP" | FN-M05-3.1.1 |
| EL-M05-SHU-377 | text | conditional (state captured @1280 only) | "Matematik Tambahan" | FN-M05-3.1.1 |
| EL-M05-SHU-378 | text | conditional (state captured @1280 only) | "Bahasa Melayu" | FN-M05-3.1.1 |
| EL-M05-SHU-379 | text | conditional | "Matematik" | FN-M05-3.1.1 |
| EL-M05-SHU-380 | heading | conditional | "Kemajuan Saya" | FN-M05-6.1.1 |
| EL-M05-SHU-381 | text | conditional | "Pantau prestasi dan kenal pasti topik lemah" | FN-M05-6.1.1 |
| EL-M05-SHU-382 | heading | conditional | "Sejarah Latihan" | FN-M05-6.2.1 |
| EL-M05-SHU-383 | text | conditional | "Rekod latihan dan prestasi anda" | FN-M05-6.2.1 |
| EL-M05-SHU-384 | heading | conditional | "Pembetulan" | FN-M05-7.1.1 |
| EL-M05-SHU-385 | text | conditional | "Lihat peningkatan selepas pembetulan jawapan" | FN-M05-7.1.1 |
| EL-M05-SHU-386 | heading | conditional | "Tahap Penguasaan" | FN-M05-7.2.1 |
| EL-M05-SHU-387 | text | conditional | "Jejak kemajuan anda dalam setiap subjek" | FN-M05-7.2.1 |
| EL-M05-SHU-388 | heading | conditional | "Misi Harian" | FN-M05-8.2.1 |
| EL-M05-SHU-389 | text | conditional | "Selesaikan misi, kumpul syiling!" | FN-M05-8.2.1 |
| EL-M05-SHU-390 | heading | conditional | "Target SPM Saya" | FN-M05-8.3.1 |
| EL-M05-SHU-391 | text | conditional | "Tetapkan target gred SPM dan pantau kemajuan anda" | FN-M05-8.3.1 |

Excluded SHU elements (prefix EL-M05-SHU-): 351 elements — IDs 001–003, 008–054, 056, 058–061, 065–111, 113–135, 138–169, 171–185, 188–202, 206–249, 251–307, 309–336, 338–372: **owned by the global shell (docs/discovery/00-global-ui.md) / M23 and the modules their links point to** — logo and tagline, sidebar/drawer section titles and every non-M05 link (classified per URL in `_crawl.json`), identity card and logout (M01), header coin/points/streak pills (M14), notification bell (M01/M22), hamburger and drawer chrome, footer, PWA install prompt, the other bottom-nav items (SPM, Game, Topik, Chat, Lagi) and the chatbot widget (M22).

---

## 7. Fidelity deviations

These are the **only** intended differences from the live site. Anything not listed here must match the live site (D7, D9, D10). Rule D9 (user, standing, pre-approved): where the live site is broken or contradictory, fix it; where it works, replicate it exactly. D10: accessibility replicates live, and a deliberate, consistent live limitation is not broken. Each discovery defect D-1…D-16 was checked against the evidence; v1.1 applies the Delivery Lead decisions on the audit (§7.1). Withdrawn IDs are kept so references stay stable.

| ID | Discovery | Category | Live behaviour (evidence) | Rebuild behaviour (specified) | Status |
|---|---|---|---|---|---|
| DV-M05-01 | D-1 | Wrong label/title | The shell header shows "Dashboard" / "Selamat datang kembali" on S3, S6, S7, S10 and S13 (EL-M05-SHU-136–137 in those states; S7 source h1 "Dashboard"; confirmed by the audit). | Per the shell rule DV-SH-03 (`docs/design/shells.md`, v1.2 alignment on XL-20): the header **title** comes from the route and there is **no subtitle**, because live shows no correct one on these pages. Titles: S3 "Latih Tubi"; S6 and S7 "Soalan Aku Salah"; S10 "Soalan Berstruktur"; S13 "Ujian Remedial Saya" (existing live copy of the same page or its parent). The SPM variants of S10 use M06 DV-M06-07 titles ("Subjektif SPM" / "Tracking A Bahasa") under the same rule. Tab titles unchanged. | Approved (user rule D9) |
| DV-M05-02 | D-2 | Visual bug (content invisible) | Subject icons are printed as Font Awesome classes built from the M03 icon value: Lucide names get "fa-" prefixed (`fa-zap`, `fa-variable`, `fa-flask-round`, `fa-monitor`, `fa-trending-up`), Font Awesome values get a double prefix (`fas fa-fas fa-quran`), emoji give `fa-🍽`, `fa-👗`, empty values `fa-` (S1 cards and statistics, S2, S3 hero). S4 cards and S12 tiles print the bare value as a class (`<i class="book-open">`, `<i class="clock">`), so no glyph shows (JAWI on S4 `fas fa-pen-nib` renders). | Every subject icon on S1, S2, S3, S4 and S12 is resolved from the M03 subject icon with M03 BR-05 (same fix as DV-M03-01): Lucide name → Lucide icon; Font Awesome class → mapped Lucide icon; emoji → the emoji; empty → empty tile. S6 prints the same Font Awesome classes (observed only for BM `fa-book-open` and SEJ `fa-clock`, which render) and resolves the same way. | Approved (user rule D9) |
| DV-M05-03 | D-3 (narrowed in v1.1) | Broken navigation (dead parameters) | S1 subject cards link to `/practice?subject={CODE}` and M03 Peta Belajar islands to `/practice?topic_id={id}`; the server ignores both (byte-identical page), so a link that promises a subject lands on the unfiltered S2 list. | Links keep their live hrefs. S2 honours `?subject={CODE}` (opens `/practice/{CODE}`, URL replaced) and `?topic_id={id}` (opens `/practice/{code}` of the legacy topic's subject, M03 BR-16 — the same target as M03 S13 "Mula Berlatih"). Unknown values show the plain list, as live. `?level=` is **not** honoured (replicated as live, §7.1). | Approved (user rule D9) |
| DV-M05-04 | D-4 | — | S3/S5 offer only Darjah 1–4; S2 and S1 cards show the whole bank per subject (e.g. "Fizik 1,261 soalan", no startable level). | **Withdrawn in v1.1** (Delivery Lead decision on AUD-M05-05, §7.1): the live counts are true question-bank counts and agree with S1 "Statistik Subjek"; the Darjah 1–4 reachability limit is deliberate and consistent (S3, S5, M03 Peta Belajar) under D10. Counts and limit are replicated. | Withdrawn |
| DV-M05-05 | D-5 | — | Discovery listed contradictory counts (Pendidikan Moral card 15014 vs "Statistik Subjek" 15414; S2 13,872 vs S3 6,538; S8/S9/S12 answer totals). | **Withdrawn in v1.2** (XL-02, decision D11): the live figures reconcile under distinct definitions — subject card and S2 = Q-ELIGIBLE(subject) (Σ = Q-ELIGIBLE 128,989), "Statistik Subjek" = Q-ACTIVE(subject) (Σ = Q-ACTIVE 129,389; the 400 extra rows are Q-ARCHIVED-ACTIVE, all Pendidikan Moral), "Total Soalan" 130,152 = Q-ACTIVE + Q-PKSK, "Soalan Approved" 129,752 = Q-ELIGIBLE + Q-PKSK, S1 difficulty rows = Q-DIFFICULTY (incl. PKSK, Σ 130,152), S3/S4/S5 = Q-PRACTICE (query names: M04 SRS §4.1); S8/S9/S12 as §7.1. The M04 D11 dataset reproduces every live figure, so nothing is changed. | Withdrawn |
| DV-M05-06 | D-8 | — | "Hari Berturut 1", header pill "1 hari 🔥" and "Kombo 1 hari akan putus!" although the admin's last session was 19 May 2026. | **Withdrawn in v1.1** (Delivery Lead decision on AUD-M05-14, §7.1): the live streak rule is server-side, unobserved and owned by M14 (`/kombo`). The value is replicated as live (admin seed 1); OQ-14 defers the rule to M14 discovery. | Withdrawn |
| DV-M05-07 | D-6 | Visual bug (empty control) | S5 for a subject with no chapter-mode level (e.g. ADDMATH, reachable by URL) renders an empty level `<select>` above "Tiada bab tersedia untuk tahap ini.". | When there is no level option the select is not rendered; the hero and the empty message stay as live. | Approved (user rule D9) |
| DV-M05-08 | D-9 | Wrong label and wrong target | S8 card "Topik Perlu Perhatian" lists subjects (not topics), and its "Ulang Kaji" (revise) button opens the random drill `/practice/{CODE}` instead of revision. | Heading "Subjek Perlu Perhatian" (**PROPOSED COPY**, built from the live words of the same page, "Prestasi Mengikut Subjek" and "Perlu Perhatian"). "Ulang Kaji" opens `/practice/revision/{CODE}`; when the subject has no queued question the live S6 flash "Tiada soalan salah untuk subjek ini. Tahniah!" applies. | Approved (user rule D9) |
| DV-M05-09 | D-13 (S5) | Unreadable text (truncation) | At 375 px S5 chapter titles are cut with "…" (`truncate`, e.g. "Bab 6: Panjang, Jisim dan Isi Padu C…") with no way to read them. | Chapter titles wrap onto more lines at every width; nothing else changes. (S4 and S8 subject names, which fit, keep `truncate` as live.) | Approved (user rule D9) |
| DV-M05-10 | D-11 | Contradictory rule | On the current month the › is disabled, but a future month typed in the URL (`?bulan=2026-10`, `2030-01`) shows an active › to the next month, and so on indefinitely. | The › is a disabled grey span on the current month **and** any later month; future months typed in the URL still render (empty state), as live. | Approved (user rule D9) |
| DV-M05-11 | — (NFR-02; completed in v1.1) | Unreadable text (< 12 px) | Text set below 12 px (computed at 375 px by the audit): S1 quest difficulty chips 10 px; S3 below 640 px — hero chip "soalan tersedia" 10 px, level code chips, level/difficulty sub-labels and counts, "soalan" under the count buttons and the summary labels 10 px, tips 11 px; S9 card labels 10 px below 640 px and the coin label "SYILING" 10.4 px; S12 scale chips, stat labels, "({CODE})", progress line, XP and "Terakhir:" 10 px; S15 status line 9 px. S5, S8, S10 and S11 have none. | These texts render at 12 px (`text-xs`) at every width; every other size stays as live; decorative icons and emoji keep their live size; the rule covers M05 content inside `main` (the global shell is M23, as M03 R2-24). | Approved (user rule D9 / master NFR-02) |
| DV-M05-12 | D-13 (S15) | Layout breakage | At 375 px each S15 row keeps name (144 px) + bar + grade + select (80 px) on one line, so the progress-bar track measures 0 px and names wrap to 2–3 lines (audit screenshot `s15-rows-375.png`). | Below 640 px the row wraps: name and status, grade and select on the first line, and the bar full width on a second line; from 640 px the live single-line row is kept. | Approved (user rule D9) |
| DV-M05-13 | — (audit AUD-M05-08) | Broken page (server error) | `/pembetulan?bulan=abc` or `?bulan=2026-13` returns HTTP 500 "500 - Ralat Pelayan". | A malformed `bulan` shows the current month (the page's own default, as `/pembetulan` without a parameter); valid past and future months as live. | Approved (user rule D9; Delivery Lead decision) |
| DV-M05-17 | — (S1 touch audit; Session 8, M05-T3, 2026-10-03) | Controls unusable on touch | On S1 the carousel arrows (32 × 32 px), the 10 px carousel dots, the "Baca Selanjutnya" / "Tutup" toggle (about 20 px high), the trial link "Langgan Sekarang" (36 px), the Kombo link "Mula Latihan" (32–40 px), "Lihat Semua" (24 px), the aside link "Lihat Semua Artikel" (36 px) and the subject card "Mula Latihan 🚀" below 640 px (40 px) are below 44 px. | Each keeps its live size, spacing and look; an invisible pseudo-element enlarges only the hit area to at least 44 px high (the arrows and dots only 4 px wider each side, so neighbouring areas never overlap). | Proposed (user rule D9; Session 8 to be confirmed at G4) |
| DV-M05-18 | — (S1 layout check; Session 8, M05-T3, 2026-10-03) | Layout breakage (rebuild only) | Live does not overflow at 768 px (discovery §7: no horizontal scroll). In the rebuild the 4-across "Statistik Platform" cards leave a ~97 px content box for 6-digit totals at `md:text-5xl`, and the last total ended 5 px past the page edge (E2E measured 5, 5, 5 px). Cause: the rebuild's font metrics. Live loads Outfit at 600/700/800 only, so its 900 draws as 800; the self-hosted variable font drew a true 900 (8 px), and weight 800 (set in `.number-display`) still leaves 5 px. | The live size is kept; the number box is widened by the card padding (`sm:-mx-8`) so the number is centred in its card and stays inside the page. The 1280 px look is unchanged. | Proposed (user rule D9; Session 8 to be confirmed at G4) |
| DV-M05-19 | - | Language (BM copy) | Chapter practice (`/practice/chapter`), revision, config and history screens: "Soalan by Chapter", "Mode Sistematik", "Mode Baru", "Mode Ulang Kaji", "Progressive Unlock", "Tips" / "Tips Ulang Kaji" / "Tip:", badge "Trial", "Total Soalan", "Soalan Approved", "Failed to load quiz", "Mata (Lvl n)", "syiling dan coin", history date "19 May 2026" | "Soalan Mengikut Bab", "Mod Sistematik", "Mod Baharu", "Mod Ulang Kaji", "Buka Kunci Berperingkat", "Petua" / "Petua Ulang Kaji" / "Petua:", "Percubaan", "Jumlah Soalan", "Soalan Diluluskan", "Gagal memuatkan kuiz", "Mata (Tahap n)", "syiling dan koin", "19 Mei 2026". | Approved: user decision 2026-10-24 (system audit FB-025) |
| DV-M05-20 | - | Language (BM copy) | Murid home (`/dashboard`) title and header, practice config difficulty chips: "Dashboard", "Dashboard - PRESTASIPLUS", "Level n" | "Papan Pemuka", "Papan Pemuka - PRESTASIPLUS", "Tahap n". | Approved: user decision 2026-10-24 (system audit FB-025) |

**Candidates evaluated and not deviations** (replicated as live):
- **D-4 / Darjah 1–4** S3 and S5 offer only Darjah 1–4, SK offers only "D4", and difficulty 5 has 0 questions; S2/S1 show bank counts (DV-M05-04 withdrawn); the Pendidikan Moral 15014 / 15414 difference (DV-M05-05 withdrawn, approved vs all questions).
- **D-7** S5 locked chapters show progress and scores, and a chapter at 80 % can stay locked while the previous one is incomplete. The rule is applied consistently and the copy explains it.
- **D-8** The streak value (DV-M05-06 withdrawn).
- **D-10** English copy in the BM UI: history dates "19 May 2026, 03:49", the Laravel pager, "assign", "Soalan by Chapter", "Mode Ulang Kaji", "Progressive Unlock", "(On Track)".
- **D-12** Two unrelated "Misi Harian" features (S1 built-in quests; S14 teacher missions), no link between them.
- **D-14** S2 "Mula Latihan" `<button>` nested in the card link (accessibility, D10).
- **D-15** Inconsistent tab-title suffixes; S12/S13 without suffix.
- **D-16** The S7 start-error fallback "Failed to load revision quiz" (the mock always sends the BM message of SRS §8).
- `?level=` on `/practice` is ignored (level pills land on the plain list).
- S9 shows the SPM "Tahun Lepas" / "Latih Tubi" sessions with the badge "Latihan"; S9 totals count sessions only while S8 counts every answer; S12 keeps its own counters.
- An unknown `period` on S8/S9 shows no active chip/pill.
- The report modal shows its failure text inside the "Terima Kasih!" view (as live and as M04).
- The dashboard's unobserved conditional sections are not rendered (OQ-6).
- No detail page for sessions; no pagination on S2, S4, S6, S8, S12, S15; S10 page size 20.
- S1 counts without thousands separators vs S2–S5 with separators; different decimal formats per page.
- Emoji and Font Awesome decorations, count-up and bar animations, bouncing icons, the coin-fly animation — kept, including when the user prefers reduced motion (D10).

### 7.1 Delivery Lead decisions on the audit (v1.1)

| Finding | Decision | Reasoning |
|---|---|---|
| AUD-M05-01 | The invented 19 Feb session is removed. Seeds use observed values only: S8 4 sessions / 4m; S9 4 / 84 / 21.8% / 26; S12 BM 46 / 94. The 35 answers of 19/02 are seeded as answers **without a session**, as live has them. DV-05 is narrowed to the one real contradiction (Pendidikan Moral 15014 vs 15414). | Live figures that do not contradict each other must be replicated; seeds must never be tuned to make numbers agree. S8 and S9 measure different things (all answers vs session answers). |
| AUD-M05-02 | The admin's 4 sessions are M06 SPM sessions (A2 Latih Tubi Sejarah 14/40, A3 Latih Tubi BM 11/34, A4 and A5 Tahun Lepas BM 1/5 and 0/5). M05 **owns** the practice session store; M06 references it; every SPM session appears on S9 with the observed "Latihan" badge. The invented "SPM" badge is removed. The student seed shares P1–P4 with M06. | One store is what live shows (`/practice/history` and `/spm/history` list the same sessions); the badge is observed. |
| AUD-M05-03 | BR-27 is rewritten from observation: SPM Tahun Lepas and Latih Tubi answers do **not** start an S15 row (all rows "Belum mula" for the admin despite 84 SPM answers); the counting rule is UNVERIFIED (LS-10). | Specify what live shows; do not assume a data source live contradicts. |
| AUD-M05-04 | M05 owns `/latihan-berstruktur?scope=spm[&track=bahasa]` and `/latihan-berstruktur/{id}/jawab?scope=spm[&track=bahasa]`; the variant is specified in FT-M05-5.3 from the audit evidence and the M06 inventory (S7, S9), mapped by cross-reference without duplicating EL IDs. | M06 and M04 depend on the route; M05 owns the list template, answer page and API. |
| AUD-M05-05 | DV-04 withdrawn: live bank counts replicated; the Darjah 1–4 reachability limit replicated (D10). Alternatives considered: (a) lift the limit — new scope under D10; (b) relabel counts — new copy for a working page; (c) rewrite counts to reachable — creates a new S1 contradiction. None is needed because the live counts are true bank counts. | Replicate what works; the limit is deliberate and consistent. |
| AUD-M05-13 | DV-03 keeps `?subject=` and `?topic_id=` (links that promise a subject and land nowhere); `?level=` is **not** honoured — the parameter is ignored as live. | Honouring `?level=` would leave 7 of 11 dashboard pills (Darjah 5–6, Tingkatan 1–5) pointing at levels S3 never offers, i.e. new dead UX under the Darjah 1–4 limit. |
| AUD-M05-14 | DV-06 withdrawn; the streak value is replicated as live; OQ-14 defers the rule to M14 discovery (with `/kombo`). | The live definition is server-side and unobserved; M14 owns it. |
| AUD-M05-06…12, 15 | Report failure text under "Terima Kasih!" (as live); S7 failed-check and "Lapor Soalan" order corrected; unknown `period` → no active chip (OBSERVED); malformed `bulan` → current month (DV-M05-13, live 500); KBAT bands OBSERVED; sparkline min–max (OBSERVED); DV-11 completed and E2E-54 limited to M05 text in `main`; new copy marked PROPOSED COPY and LS-1/2/3/8 ACs and E2E provisional; integer ids per M03 v1.3 (chapter ids from the M03 seed; the live ids 1 and 3 stay pending, OQ-13 c). | Audit fixes as required. |


### 7.2 Cross-module logic review decisions (v1.2, D11/D12)

| Finding | Decision | Where |
|---|---|---|
| XL-02 | Counts come from the M04 D11 virtual dataset reporting the live totals; M05 practice fixture questions are anchor rows inside it, not additions; DV-05 withdrawn (live figures reconcile); v1.4 (XL-36): counts cite the M04 SRS §4.1 queries. | FN-1.7.1/1.7.2/1.7.6/2.1.4/9.3.1; SRS BR-05, §6.12 |
| XL-03 | One practice session schema and one answer model, owned by M05 (D12), with a `mode` enum covering M05 and M06 types; M06 adopts it. | SRS DATA-M05-01/02, BR-06 |
| XL-04 | One session-completion write contract (answer log, revision queue, mastery counters, trial counter, M14 wallet hand-off) for M05 and M06 submits; FR-55 includes the counter update. | SRS BR-31, FR-55, §7 #6 |
| XL-05 | Integer user ids (canonical ids: 1 admin, 2 pelajar, 3 pelajar2, 4 pelajarmaju). | SRS §6 |
| XL-10 | Reusable quiz component contract (props, events, report modal, submit) and structured answer component (`scope`/`track`); closes M06 Q2. | SRS §7.1, FR-138 |
| XL-16 | Trial vs school subscriptions / complimentary packages: live behaviour kept (individual subscription observed), interaction INFERRED, OQ-17 for M19 and M02. | FN-9.3.3, SRS BR-07 |
| XL-19 | The revision queue serves and counts only questions eligible under M04 BR-M04-03. | FN-4.2.14, SRS BR-14 |
| XL-20 | DV-01 = title from the route, no subtitle (DV-SH-03). | DV-M05-01, FN headers, ACs |
| XL-23 | M05-only data lives in M05-owned records (PracticeProfile, SubjectUsage); `Question.curriculumChapterId` is the M04 contract. | SRS DATA-M05-07 |
| XL-25, XL-27 | Chapter ids 1 and 3 are kept by M03; stale totals removed; defaults for users without seed rows. | SRS §6.12, BR-25 |


### 7.3 Cross-module logic review batch 2 decisions (v1.6)

| Finding | Decision | Where |
|---|---|---|
| XL2-01 (Major) | The answer log and the practice sessions become D11 virtual datasets with the live totals: 478,499 answers and 32,122 sessions at 79.8 % (as M08 counts them) and, inside them, the monitoring segment of 472,371 answers (M11 snapshot) with its weekly and period cells. The two totals are a subset relation (6,128 answers by users outside the segment), so no D9 decision is needed. Admin, canonical, M08 and M11 records are anchors inside the totals. Every M08/M11 figure is a named query on the log. The leaderboard coins of M08 cannot come from the log under the 1-coin rule (they would need more correct answers in the week than the log holds), so M08 keeps them as its documented display data. | FN-9.3.7, US-41; SRS §6.14, BR-06, BR-33, FR-145 |
| XL2-08 (Major) | M05 owns the student side of teacher missions, remedial tests and question sets: the read endpoints `/api/missions/today` and `/api/remedial-tests/mine` (M10 drops its duplicates), the page `/remedial/{id}`, the mission and question-set quiz pages, the session modes `mission`, `remedial`, `question_set` with the fields `missionId`, `remedialTestId`, `questionSetId`. Mission reward = 3 × correct (observed on live M10), every other mode as live (1 × correct); handed to the M14 wallet through BR-31. | FN-8.1.4/8.1.5, 8.2.3/8.2.4, 8.4.1, US-31/32/40; SRS §6.1, §7 #4/#20/#21, BR-09, BR-31, BR-32 |
| XL2-30 (Minor) | Articles and banners are read from the M09 store (`articles.latest(5)`, `banners.activeFor(user)`); M05 seeds none. | SRS §6.9, §6.12 |
| XR-M13-03/03b (M13 request) | Read "answers of user U in subject S" = Q-ANS-USER; test hook `mock.addAnswer({userId, questionId, isCorrect, answeredAt?})`. | SRS §6.13, §6.14.2, FR-146 |
| M14 v1.2 requests (recorded in v1.9; **applied in v1.10**, XL3-03) | Wallet repository handover to M14; designed wallets pelajar 370 / 916 and pelajarmaju 267 / 432; new `mock.addSession` hook. | SRS BR-31 step (6), §6.12, §6.13, FR-149/150 |


### 7.4 Cross-module logic review batch 3 decisions (v1.10)

| Finding | Decision | Where |
|---|---|---|
| XL3-01 (Major) | Live's 82.9 % is correct ÷ answered of the active pupils (M17). Their correct answers are pinned at 395,873; with the 180 correct of the other anchors and 338 (PROPOSED, 80 %) of the 423 free non-pupil answers, the whole log has 396,391 correct (82.8 %; valid range 396,053–396,476). M08 moves its 79.8 % and level accuracies to the mean of session accuracies (new query). | SRS §6.14.1/§6.14.2, BR-33; AC-41.1 |
| XL3-03 (Major) | The wallet, streak, daily quests and badges belong to M14; M05 keeps the sessions and answers; session completion calls `gamification.onSessionCompleted`; designed wallets pelajar 370 / 916, pelajarmaju 267 / 432; `mock.addSession` replaces `addSessions`. | SRS BR-08/09/10/25/31, §6.5, §6.7, §6.12, §6.13; FN-1.4.4, 9.3.5; AC-05.1, 06.3, 41.7, 41.8 |
| XL3-04 (Major) | The M12 Kirkpatrick session segment is a separate M05-owned aggregate store, outside the 32,122 sessions and the answer log. | SRS §6.14.4; AC-41.5 |
| XL3-05 (Major) | Answers without a session for 3201–3215 (8880, 6,563) and pupil 2022 (6); nullable session subject ("Latihan Bebas"); per-pupil subject accuracy set and mastery anchors for M18; weekly ranking for M16; activity, structured-attempt and per-pupil pins for M17. The 8765 practice-session request does not fit (OQ-20). | SRS §6.1, §6.2, §6.14; AC-41.4, 41.6, 41.9 |
| R2-02 (round 2) | The 8765 and 2700 practice-session figures are M18 documented display values; the Kirkpatrick store keeps its T4/T5 scope. | SRS §6.14.1; OQ-20 closed |
| R2-03 (round 2) | 8 existing September sessions of class-813 pupils are missions 7103 (5, 8 Sep) and 7104 (3, 22 Sep). | SRS §6.14.1, §6.14.2 |
| R2-04 / R2-10 (round 2) | Mode `pksk` for M07 PKSK practice with its own completion path; classification: practice mode (M08, M16), "Kuiz" (M11), counted by M17, labelled "PKSK" on the history pages. | SRS §6.1, §6.2, BR-34, BR-35; AC-41.10 |

---

## 8. Out of scope

| Item | Owner / reason |
|---|---|
| Coin, point, XP level and **streak rules**; the wallet and header pills; badges; the daily quests (moved to M14 in v1.10); `/leaderboard`, `/kombo` | M14 (M05 shows the values and posts session results; OQ-14). |
| Teacher missions, remedial tests and question sets: creation and content (the teacher side) | M10. The student side — the S13/S14 lists, the quiz pages `/remedial/{id}`, `/misi-harian/{id}`, `/set-soalan-saya/{id}/jawab`, the session links and the mission reward — is M05 (v1.6, XL2-08; LS-12). |
| Articles and announcement banners (content and their pages) | M09. |
| `/pricing`, subscriptions, payment and the free-trial counter's rules | M19 (M05 shows the counter). |
| SPM practice pages (`/spm/tahun-lepas`, `/spm/latih-tubi`, `/spm/ramalan`, `/spm/subjektif`, `/spm/history`, mock exams); the SPM variants' screen documentation and inventory | M06 (it writes SPM sessions into the M05 store; M05 owns the `/latihan-berstruktur` route and answer page, FT-M05-5.3). |
| Question bank, structured questions, report triage and "my reports"; the report modal component itself | M04 (M05 mounts the modal, SRS SQ-2). |
| Subjects, levels, DSKP chapters, legacy topics and Peta Belajar | M03 (M05 reads them). |
| Tournament banner on every M05 page (`LIVE:`, `MAIN`, `DAFTAR`) | M16 / global widget. |
| Rest of the user shell (other menus, bell, avatar, chatbot, PWA prompt) | Global shell / M01 / M22 / M23. |
| Subjective drill page (`/practice/{CODE}/subjektif`) | Never offered on live; not built until observed (LS-6). |
| The dashboard's conditional sections (battle stats, parent daily target, weak-topic alert, teacher quiz sets, pending assignments, new rewards) | Not observable; not built until observed (OQ-6). |
| Real persistence, anti-cheat, server-side grading | Backend phase (D1); security notes SEC-M05-01…11 (SRS NFR-M05-04). |

---

## 9. Open questions

Only questions that cannot be answered by following the live site.

1. **OQ-1 Live-session states LS-1…LS-12 (pending the user's approval to practise).** Random and chapter quiz pages, their results, the trial gate, report server messages, the structured answer page (plain and SPM), quest completion and the chest, saved SPM targets and S15 progress, higher grade labels and mastery levels, positive corrections, and the S6/S12 no-data states could not be observed without creating practice records. They are specified from the S7 source or INFERRED, with UNVERIFIED / PROPOSED COPY placeholders (§5.1, SRS §8.3), and their ACs/E2E are provisional. Options: a throw-away student account on live, or permission to practise with the admin account. (Discovery §9, Q-M05-1, 2, 3, 5, 9.)
2. **OQ-2 Trial gate (Q-M05-2; INFERRED).** When a non-subscriber with 0 trial questions presses "Mula Kuiz", does live redirect to `/pricing`, block with a message, or let admins through? The prototype redirects to `/pricing` without a message (provisional).
3. **OQ-3 Grade labels and session types (Q-M05-3).** Only "💪 Cuba Lagi" (red, 0–35 %) was observed, and the badge "Latihan" on SPM "Tahun Lepas" / "Latih Tubi" sessions. Labels for higher scores and badges for M05 random/chapter/revision and M06 Tracking A sessions are PROPOSED COPY (SRS §8.3).
4. **OQ-4 Mastery thresholds L4–L10 and XP multipliers (Q-M05-4; INFERRED).** L1 ≥10, L2 ≥25, L3 ≥50 correct were derived from the observed bars; higher thresholds and multipliers are placeholders (SRS BR-20).
5. **OQ-5 Completed chapter and end of a level (Q-M05-5; INFERRED).** No completed chapter was observed; the prototype shows it as an open card.
6. **OQ-6 Dashboard conditional sections and greeting periods (Q-M05-8).** Six template sections were empty for the admin; not built. Greeting words other than "Petang" and their hours are INFERRED.
7. **OQ-7 SPM target rows with data (Q-M05-7; LS-10).** Observed: SPM Tahun Lepas and Latih Tubi answers do not start a row. Which answers do, the status text, bar colour, predicted-grade formula and the save message are unknown; the prototype shows progress only through a test fixture.
8. **OQ-8 Structured answer page (Q-M05-9; LS-7).** Inputs, "semak secara automatik" marking and feedback are unknown for the plain and SPM entries; the prototype page is minimal and marked UNVERIFIED.
9. **OQ-9 Revision queue and corrections (Q-M05-10; INFERRED).** SPM answers enter the queue (the admin's Sejarah wrong answers come only from an SPM session). Does a wrong answer on a question first answered correctly enter the queue? Does S11 exclude Tahun Lepas answers (May 2026 counts only the two Latih Tubi sessions)? The prototype follows SRS BR-14 and BR-18.
10. **OQ-10 Why only Darjah 1–4 (Q-M05-11).** Replicated as a deliberate limit (D10). If the owner confirms it is a bug, lifting it is a one-rule change (SRS BR-11) and a new deviation.
11. **OQ-11 Chapter score and daily quests (INFERRED).** Skor uses each question's latest answer; "Penjelajah Topik" counts distinct DSKP chapters; "Kilat Matematik" counts correct answers in any subject. Confirm with a session.
12. **OQ-12 "Digunakan: {n}x" on S1 subject statistics.** Always "0x" on live although the admin answered 119 questions; its source is unknown. The prototype shows the seeded value 0.
13. **OQ-13 Cross-module items** (v1.2 status): (a) M04 `ReportQuestionModal` props `source` (incl. `revision`), `failureText` and tints — being added by M04 (XL-09); (b) `Question.curriculumChapterId` and the SPM pool rows in the M04 D11 dataset — being added by M04 (XL-01, XL-08); M05 anchors are rows of that dataset; (c) chapter ids 1 and 3 are kept by M03 (closed); (d) M06 adopts the M05 session schema, write contract and quiz component (XL-03/04/10); (e) M14 must adopt or replace BR-08/BR-09 and the wallet credit hand-off.
14. **OQ-14 Streak rule (AUD-M05-14; deferred to M14 discovery).** The admin shows "1 hari" and "Kombo 1 hari akan putus!" with no practice since May 2026 (and a later M06 mock exam activity). What counts as a streak day, and when the reminder shows, is server-side; M14 (`/kombo`) will define it. The prototype shows the M14 seeded value and INFERS the reminder condition (streak ≥1 and no session today).
15. **OQ-15 S12 counters.** Live S12 BM "94 Dijawab / 46 Betul" differs from S8 BM "79 / 32" (15 more answers, 14 more correct). The source of the difference is not observable (perhaps activity outside the answer log M05 sees). The prototype stores the counters per subject and seeds the live values.
16. **OQ-16 PROPOSED COPY to report at G1.** "Subjek Perlu Perhatian" (DV-M05-08) and every placeholder of SRS §8.3: Q1/Q2 loading texts, titles, feedback titles "Betul!" / "Salah", "Keputusan Latihan", results messages, "Ulang Lagi" / "Kembali"; history labels "🏆 Cemerlang" / "👍 Bagus" and badges "Bab", "Ulang Kaji", "Tracking A"; completed-quest style and "Peti Harian dibuka! 🎉"; S11 positive/negative delta style; S15 status line and "Target berjaya disimpan." / "Gagal menyimpan target. Sila cuba lagi."; Q3 result texts and "[{n} markah]"; mock error messages "Baki percubaan percuma anda telah habis.", "Bab ini masih dikunci.", "Soalan tidak mencukupi.", "Gred target tidak sah.", "Jawapan tidak sah.".
17. **OQ-17 Trial vs school and complimentary entitlements (XL-16; INFERRED interaction).** Live observed only the individual case (a non-subscribed account shows "Percubaan Percuma" / "Baki n / 50 soalan"). Whether a student covered by a school subscription (M02 BR-22/27/31, e.g. `basic` 500 questions per month, `full` unlimited) or a complimentary package (M02 DATA-M02-09 until `packageExpiresAt`) counts as subscribed is not observed. The prototype keeps the observed rule (individual subscription only); M19 (packages) and M02 (school subscriptions, complimentary students) must define the entitlement sources. No UI is added.
18. **OQ-18 `pelajarmaju@demo.test` grade (XL-14).** Closed in v1.4: M01 lists grade 1 (Darjah 1), matching all M05 data for id 4.
19. **OQ-19 Teacher-assigned pages (LS-12, v1.6).** The populated `/remedial/saya` and `/misi-harian`, and the quiz pages for remedial tests, missions and question sets, were never observed on live (no teacher data reached the observed accounts). Their layouts and copy are PROPOSED and their start rules INFERRED (SRS BR-32); to be confirmed when a live teacher assigns work to a test student.
20. **OQ-20 8765 practice sessions (M18 XR-M18-05) — closed in v1.12 (Delivery Lead R2-02).** The 8765 figures (21 sessions, 309 answered, 242 correct) and the 2700 pupil's single session do not fit the answer log (8765 holds 222 answers, 186 correct) and are outside the Kirkpatrick store's T4/T5 scope, so M18 shows them as documented display values. They are not M05 data.
