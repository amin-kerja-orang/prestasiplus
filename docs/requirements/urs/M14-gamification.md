# M14 — Gamification (Coins, Tokens, Challenges) — User Requirements Specification

## 0. Document control

| Field | Value |
|---|---|
| Document | URS — M14 Gamification (syiling, tokens, XP, tiers, challenges, achievements, streak/kombo, referral, teacher wallet and cash-out, reward control and cabutan admin) |
| Version | 1.7 |
| Date | 2026-10-03 |
| Status | **Approved (G1)** — 2026-09-26, after audit round 2 PASS (`docs/qa/audit/M14-audit.md`). Fidelity deviations decided under user rule D9 (standing, pre-approved) and D10. Every result of a POST on live was not observed; those states stay INFERRED or PROPOSED and provisional (discovery §9). |
| Author | product-analyst (agent); data entities, datasets and mock API of the companion SRS by solution-architect (agent) |
| Source discovery | [M14-gamification.md](../../discovery/M14-gamification.md) (§1–§10, defects D-1…D-10 in §8.2, §8.3 audit checklist, §9 open questions Q1–Q7, Appendices A–B); inventory [`inventory/M14/`](../../discovery/inventory/M14/) (`S1…S22-*.json`, 1,759 content elements over 118 states; `SHA-admin-shell.json`, `SHU-user-shell.json`; `_crawl.json` 367 URLs; `_summary.md`); dated seed snapshot `_snapshot-2026-09-26.json` (35 page states with live ids, 400-row ledger sample, the admin account on every coin/streak screen, 375 px layout); masked screenshots `docs/discovery/img/M14/` (55) |
| Companion SRS | [srs/M14-gamification.md](../srs/M14-gamification.md) |
| Related | M01 (User, guard, 404 page, canonical accounts 1–11, login, `/register` ignores `?ref=` — FR-M01-18, BR-24 defaults), M02 (users dataset §6.15 — wallet and teacher anchors are registered there; `coinsEnabled` of complimentary students), M03 (curriculum chapters for "Penjelajah Topik"), M04 (question store; `questions.createFromTeacher`), M05 (session store and BR-31 completion contract, BR-08/09/10/20/25, dashboard Kombo banner and quest widget), M06 (SPM session modes `past_year` / `latih_tubi` / `ramalan`), M07 (PKSK), M08 (S6 Prestasi 360 "Aktiviti", S18 public profile, S20 leaderboard, FR-M08-126 badges), M10 (teacher contributions, S1 "Soalan", Command Center badges BR-M10-16, `mission` sessions), M15 (hadiah catalogue, redemptions, mystery box, `/cabutan` — spends M14 tokens and syiling), M16 (mini-games, tournament banner), global shell / M23 ([design/shells.md](../../design/shells.md) DV-SH-03) |

**Change log**

| Version | Date | Change |
|---|---|---|
| 1.7 | 2026-10-03 | **User decision D25 (doc only; status stays Approved (G1)).** "Muat Turun" captures the user's own on-screen card with html2canvas 1.4.1 (scale 2, lazy-loaded) and downloads a PNG — allowed, not generated media under D22. OQ-M14-20 closed; the "as built: nothing is downloaded" notes removed from FN-M14-6.1.6 / 6.2.6, AC-M14-13.2 and AC-M14-15.4. As built: S15 `pencapaian-{name lower-case, whitespace → hyphen}.png`; S18 `prestasiplus-{profil\|kombo\|penguasaan-{i}\|kedudukan}.png` (i 0-based); `downloading` guard reset on success or failure. No story or AC added or removed. |
| 1.6 | 2026-10-03 | **As-built update after the G4 review (doc only; status stays Approved (G1); no observed value changed).** (1) FN-M14-4.2.1: the `streak` challenge metric (Kombo 2 Hari) is today-only (current streak if the last activity is today, else 0) — consistent with live (admin Kombo 0/2), AC-09.1 and AC-10.3; the earlier wording read the stored streak. (2) §5 responsive rows for S11 (stat cards 2 / 4 / 4, tier grid 2 / 2 / 4), S12 (rate list stacked) and S13 (1 column at every width) restated per live. (3) New **DV-M14-15** (D9, unreadable text): tier label text of gold, silver, platinum on S11/S12 → slate-800 (FN-M14-2.1.9, 3.1.6, AC-05.4, AC-07.3). (4) FN-M14-11.4.4 / AC-35.2: teacher-redemption transitions are forward only and the debit happens once on DELIVERED; FN-M14-11.3.3 / AC-34.2: reward image png / jpeg / webp, at most 5 MB. (5) FN-M14-7.1.3 / AC-16.3: share hrefs encode only spaces, as live. (6) FN-M14-6.1.6 / 6.2.6, AC-13.2, AC-15.4: "Muat Turun" PNG as built downloads nothing — **new OQ-M14-20** (user decision under D22; not blocking G4). (7) OQ-M14-18 text unchanged. Backend-only security notes: SRS §11.1 SEC-M14-11…20. No story added; ACs amended in place (no AC added or removed). |
| 1.5 | 2026-09-27 | **XL3 round 3, R3-02; status stays Approved (G1).** pelajarmaju (account 4) is at fixture school 900004 "SK Demo Bestari" (M02 v1.16), outside the M11 and M17 populations (§6.11.7); the remaining 900002 references are the admin's seed school and stay. Traceability 0 errors. |
| 1.4 | 2026-09-27 | **XL3 round 2, R2-09 (M07 XR-M07-03); status stays Approved (G1).** BR-M14-03 states the rate for session mode `pksk` (M05 v1.12 mode) with the same precedence as every other mode: a passed `coinsPerCorrect` first, then `flat_quiz_reward` when > 0 (seed 1), then the tier `pksk_reward_correct` (S2 "🛡️ PKSK — Syiling per Jawab Betul", seed 5) — INFERRED: no PKSK ledger row was observed on live, and the flat setting ("tiada beza difficulty") is observed to override the other tier per-answer fields. Ledger source `quiz_pksk` recorded. Traceability 0 errors. |
| 1.3 | 2026-09-27 | **XL batch 3 round 1 fixes** (`docs/qa/audit/cross-module-logic-M12-M18.md`; status stays Approved (G1)). XL3-14: teachers 4207 and 4208 are **inactive** (M02 v1.12 places them as school 8277's two inactive teachers); three new materialised zero-question wallets on generated active teachers carry 42,617, so Σ balance over active non-fixture teachers = 20,842 + 42,617 = **63,459** (M17 Q-M17-TEACHER-COINS) and both S22 tabs stay exactly as observed (script-checked); "Sekolah Saya" lists every teacher for a viewer who is not a teacher (the admin at 900002 needs none of the 8082 teachers). XL3-15: DATA-M14-08 gains the stored counter `totalDays` (2710: 13 and 4; all others 0) and §6.11.7 seeds the M18 / M17 streak anchors (KLUANG 81, BATANG PADANG 29, the 8880 / 7780 / school 1 top-10 rows, pupil 2022 streak 1); XR-M14-10 to M18 on two means that its own top-10 rows cannot reproduce. Minors: "minggu" step in BR-M14-35 (XL3-28); `onGameResult` accepts `correct`, `total`, `detail` (XL3-29); `canEarnSyiling(userId)` (XL3-26); post-login values 372 / 269 stated (XL3-30). M02 v1.12 placements recorded (4001–4108 at 8082 / 8078 / 8106; 4201–4206 at 8082). Names checked with M05 (`mock.addSession`, `onSessionCompleted`), M08 (`wallet.summary.currentSyiling`), M16 (`onGameResult → {coinsCredited, xpAdded}`, `canEarnSyiling`). Coverage 1,759/1,759; traceability 0 errors. |
| 1.2 | 2026-09-26 | **Approved (G1).** Audit round 2 PASS. R2-01: the 10 unseeded post-clock rows are 4 `quiz_spm` (#53678, #53677, #53676, #53673) and 6 `daily_login`. R2-02: the materialised-store row now lists the designed challenge completions and pelajarmaju's 3 achievements (§6.11.3). User decision on the shop source ("ikut macam mana ada sekarang"): the student shop S5 (M15) replicates live and stays empty for every account; no shop catalogue source is modelled (aligned with M15 v1.3); OQ-M14-05 closed. "Siap Hari Ini" definition stays INFERRED (OQ-M14-12; non-blocking, both definitions read 0 at the clock). Traceability re-run 0 errors. |
| 1.1 | 2026-09-26 | **Revision history — v1.1, audit round 1** (FAIL 0/3/9; Delivery Lead decisions). AUD-01: the designed replay applies BR-16 — pelajarmaju 267 syiling / 432 XP with 3 achievements (Langkah Pertama, Pengumpul Syiling, Streak 3 Hari); the runtime-unlock ACs move to pelajar2 (AC-13.1/13.2, 14.1; new AC-14.3). AUD-02: new DV-M14-14 — the S4 sort select is ignored on live (OBSERVED); each option now sorts by its field (FN-9.4.2, new AC-26.6). AUD-03: the separate mirror clock is removed; everything runs at the single project clock 2026-09-25T15:40 MYT; the 10 observed ledger rows dated after it are not seeded (their dataset slots are generated rows dated before it, so every total stays exact) and "Siap Hari Ini" counts users who completed every active challenge today (0 at the clock, as observed) — AC-04.4, 05.2, 06.1, 09.1, 23.1, 23.4, 27.1 restated. Minors: DV-06 reduced to the text colour (live `min-width: 40px` replicated, AUD-04); session-coin precedence and the M05/wallet difference (AUD-05); runtime ids continue the live tables (AUD-06); M15/M16 contract names and `onGameResult` return value (AUD-07); xp ≥ xpNeeded display PROPOSED (AUD-09); DV-09 evidence corrected and S6 "Koin" = `currentSyiling` (AUD-10); upper case by CSS on S10/S15/S22 and two references fixed (AUD-11); deletion rule for contributions (AUD-12). Coverage re-run 1,759/1,759, 0 unmapped. |
| 1.0 | 2026-09-26 | First issue under D7 (fidelity), D8 (proven completeness), D9/D10 (deviation rule, accessibility and scope), D11/D12 (virtual datasets, one owner per store) and the privacy-over-fidelity rule. §6 coverage matrix generated by script from the inventory JSON: 1,759/1,759 content elements covered (1,723 mapped, 36 excluded with reason), 0 unmapped; shells 600/600 accounted for. 13 deviation decisions (10 approved fixes, 3 rejected — replicate live). |

**Conventions** (same as M01–M13)
- Quoted UI copy is the exact live text. English or mixed words shown on live ("Tier Config", "Tier Configuration", "Level", "Token", "Threshold", "Bonus", the raw keys "earn / spend / convert / bonus / refund" and "bronze / silver / gold / platinum" on admin screens, "🥉 Bronze" on Kad Kongsi, "Streak activity (…)", "PENDING / APPROVED / PROCESSING / PAID / REJECTED", "Tips:", "Perks", "Master / Grandmaster / Legenda / Mitos", the Laravel pager "Showing … to … of … results", "« Previous", "Next »") are live copy and are kept. Where CSS upper-cases text, this is stated.
- **OBSERVED** = seen on the live site (walk-through, inventory state, snapshot, screenshot, page script). **SOURCE-DERIVED** = read from page markup or script, but the state was never rendered (e.g. the unlocked achievement card). **INFERRED** = the most likely live behaviour, not observed. **UNVERIFIED** = exists on live but could not be observed. **PROPOSED** / **PROPOSED COPY** = a value, text or layout written for the rebuild; listed in §9 (OQ-M14-12) for the Delivery Lead to report at G1.
- **Provisional** = a requirement, AC or E2E that asserts INFERRED/PROPOSED/UNVERIFIED behaviour (every POST result, the teacher and student views of non-admin accounts, the earning rules). It stays provisional until a live run with test accounts is approved (OQ-M14-01).
- **D-n** = live defect of discovery §8.2. **Qn** = discovery open question. **DV-M14-nn** = fidelity deviation (§7); anything not listed there must match live. **SEC-M14-nn** = risk in live behaviour, replicated with dummy data (SRS §11.1). **XR-M14-nn** = cross-module request (SRS §6.12).
- **Personal data.** Students are minors. Discovery masked every name (Top 10, leaderboards, S4/S5 rows, S8 teacher and bank holder, S22 teachers and schools). The rebuild seeds **fictitious** names only (from the M02 users dataset); the S8 bank account number and holder are masked in the UI (SEC-M14-04). "Admin PRESTASI+" is the live admin display name, not a person; the canonical seed uses "Admin Demo" (M01). The admin's referral code "4JURJTT" is an account code, not personal data, and is kept.
- **Admin mirror vs designed data** (SRS §6.11). `admin@demo.test` (id 1) mirrors live exactly: student wallet 256 syiling / 0 token / 8 XP / level 2 / Gangsa, 14 ledger rows, streak 1 (best 5), 0 achievements, referral code 4JURJTT with 0 referrals, teacher wallet 92,683 with 18 rows and 20,719 contributed questions (7/8 badges). The platform lists (S1, S4, S5, S14, S22) are D11 virtual datasets with the snapshot rows as anchors. `pelajar@demo.test` (2) and `pelajarmaju@demo.test` (4) have **designed** wallets obtained by replaying their M05 seeded sessions through the M14 rules (SRS §6.11); `guru@demo.test` (5) has a small designed teacher wallet. Assertions on designed data are provisional where they depend on INFERRED rules.
- **Clock.** One project mock clock for every module and build: **`2026-09-25T15:40:00+08:00`** (architecture §6.12). Live ledger times are displayed as stored (e.g. "26/09/2026 03:32"; they appear to be UTC, OQ-M14-16) and the rebuild displays stored values unchanged, as M05 does for the same sessions. The 10 observed ledger rows stored after the clock (#53669–#53678, 25/09 16:11 → 26/09 03:32) are recorded in SRS §6.11.1 but not seeded; their dataset slots are generated rows dated before the clock, so every observed total (52,964 rows, 52,426 earn, 534 conversions, 7,801 tokens, the wallet figures) stays exact and nothing shown contradicts the clock.

---

## 1. Overview

M14 is the **gamification economy** of PrestasiPlus. Students earn **syiling** (coins) for correct answers, daily challenges and activity, convert syiling into **tokens** at a tier-dependent rate (tokens are spent in M15), gain **XP**, move up **tiers** (Gangsa, Perak, Emas, Platinum) and **titles** (gelaran), keep a **kombo** (streak), collect **achievements** and refer friends. Teachers have a **separate wallet** fed by question contributions and badge bonuses, can ask for a **cash payout** (10 syiling = 8 sen) and use a teacher reward shop. Admins configure tiers, challenges, teacher badges, rewards and rates, award bonus syiling, watch the ledger, process cash requests and set up **cabutan** (lucky draws).

The TRACKER lists 15 routes; the crawl found **22 screens** (8 new routes) and the redirecting `/kombo`:

| # | Route | Tab title (exact live) | Shell · header title / subtitle (live → rebuild) | Admin outcome (observed) |
|---|---|---|---|---|
| S1 | `/admin/gamification` | "Gamifikasi Overview" | SHA · "Dashboard" / "Selamat datang, Admin" → "Gamifikasi Overview" / "Selamat datang, Admin" (DV-M14-01) | 200 |
| S2 | `/admin/gamification/tiers` | "Tier Config" | SHA · → "Tier Configuration" / "Selamat datang, Admin" | 200; 4 tiers |
| S3 | `/admin/gamification/challenges` | "Cabaran Harian — Admin" | SHA · → "Cabaran Harian" / "Selamat datang, Admin" | 200; 10 challenges |
| S4 | `/admin/gamification/students` (`?search=&tier=&sort=&page=`) | "Pelajar Gamifikasi" | SHA · → "Pelajar Gamifikasi" / "Selamat datang, Admin" | 200; 2,255 rows, 20 a page |
| S5 | `/admin/gamification/transactions` (`?type=&date_from=&date_to=&page=`) | "Transaksi Syiling" | SHA · → "Transaksi Syiling" / "Selamat datang, Admin" | 200; 52,964 rows, 25 a page |
| S6 | `/admin/gamifikasi/guru` | "Gamifikasi Guru — Admin" | SHA · "Gamifikasi Guru" / "Urus ganjaran, lencana & tebusan guru" (live, kept) | 200 |
| S7 | `/admin/gamifikasi/guru/tebusan` (`?status=`) **new** | "Tebusan Guru — Admin" | SHA · "Tebusan Guru" / "Urus permohonan tebusan ganjaran guru" | 200; empty in every status |
| S8 | `/admin/gamifikasi/guru/tunai` (`?status=`) **new** | "Tebus Tunai Guru — Admin" | SHA · "Tebus Tunai Guru" / "Urus permohonan pengeluaran tunai guru" | 200; 2 PENDING |
| S9 | `/admin/gamifikasi/pengaturan` **new** | "Tetapan Gamifikasi — Admin" | SHA · "Tetapan Gamifikasi" / "Urus kadar syiling, penukaran tunai & tetapan lain" | 200 |
| S10 | `/admin/reward-control` | "Kawalan Reward — Admin" | SHA · "Kawalan Ekonomi Reward" / "Tetapan kewangan, kos hadiah & cabutan" | 200 |
| S11 | `/gamification` | "Gamifikasi Dashboard" | SHU · "Dashboard" / "Selamat datang kembali" → "Gamifikasi Dashboard" / "Selamat datang kembali" (DV-M14-01) | 200 |
| S12 | `/gamification/convert` | "Tukar Token" | SHU · → "Tukar Syiling → Token" | 200 |
| S13 | `/gamification/challenges` | "Cabaran Harian" | SHU · → "Cabaran Harian" | 200 |
| S14 | `/gamification/leaderboard` (`?period=` ignored) | "Papan Pendahulu" | SHU · → "Papan Pendahulu" | 200 |
| S15 | `/gamification/achievements` (`?rarity=`) | "Pencapaian — PRESTASIPLUS" | SHU · → "Pencapaian Anda" | 200 |
| S16 | `/gamification/referral` | "Rujuk Kawan — PRESTASIPLUS" | SHU · → "Rujuk Kawan, Dapat Syiling!" | 200 |
| S17 | `/gamification/history` (`?type=`) **new** | "Sejarah Transaksi" | SHU · → "Sejarah Transaksi" | 200 |
| S18 | `/gamification/kad-kongsi` **new** | "Kad Kongsi — PRESTASIPLUS" | SHU · "Kad Kongsi" / "Kongsi pencapaian anda" (live, kept) | 200 |
| S19 | `/guru/gamifikasi` | "Gamifikasi Guru" | SHU · "Syiling & Ganjaran" / "Sumbang soalan, kumpul syiling, tebus ganjaran!" | 200 |
| S20 | `/guru/gamifikasi/tebus-tunai` **new** | "Tebus Tunai" | SHU · "Tebus Tunai" / "Tukar syiling anda kepada wang tunai" | 200 |
| S21 | `/guru/gamifikasi/kedai` **new** | "Kedai Hadiah Guru" | SHU · "Kedai Hadiah" / "Tebus syiling untuk hadiah menarik!" | 200; empty |
| S22 | `/guru/gamifikasi/leaderboard` (`?tab=sekolah\|global`) **new** | "Papan Pendahulu Guru" | SHU · "Papan Pendahulu" / "Siapa penyumbang soalan terbanyak?" | 200 |
| — | `/kombo` (sidebar "Kombo" / "Streak / Kombo") | — | — | **302 → `/dashboard`** (no page) |

### 1.1 One wallet, one streak (reconciliation of the live figures; DV-M14-08, DV-M14-09)

The admin account shows four coin figures and two streak values on live (discovery §1.1). The rebuild has **one student wallet and one streak store, owned by M14** (D12), and every screen reads them:

| Figure on live | Value | Rebuild |
|---|---|---|
| M14 S11/S12/S17, header chip "256 koin", M05 "Syiling Kamu", S4 admin row | 256 | `wallet.currentSyiling` = Σ of the 14 ledger rows (OBSERVED) |
| M08 `/pelajar/1` "🪙 Syiling 103", "397 syiling lagi ke Silver" | 103 | **derived:** `currentSyiling` 256 → "244 syiling lagi ke Silver" (DV-M14-09; request XR-M14-03 to M08) |
| M08 `/prestasi/1` "Koin" (beside the header chip "256 koin") | 342,703 | **derived:** `currentSyiling` 256, the same value and word as the header chip on that page (DV-M14-09; XR-M14-03) |
| M08 `/leaderboard` own card "26 Koin" | 26 | **unchanged:** the M08 period sum of session coins (BR-M08-28; A2–A5 = 14 + 11 + 1 + 0), a different named figure, not a wallet balance |
| M14 S19 teacher "Baki Syiling" | 92,683 | `teacherWallet.balance` — a separate teacher ledger (7 badge bonuses 92,600 + 11 activity rows 83) |
| Streak: header "1 hari 🔥", M05 banner and card, M08 Prestasi 360 "Kombo Hari 1" / "Rekod Terbaik 5" | 1 / best 5 | `streak.current` / `streak.best` |
| Streak: S15 "0 Hari berturut-turut", "Terbaik: 0 hari"; S18 Kad Kombo 0 / 0; M08 profile "0 Kombo" | 0 / 0 | **the same store:** 1 / 5 (DV-M14-08) |

### 1.2 Which module feeds the M14 ledger

| Event | Owner of the event | M14 effect (SRS §4) |
|---|---|---|
| Practice / SPM session completed (M05 BR-31) | M05 (M06 modes through M05) | +correct × rate (mission 3 from M05 BR-09, else `flat_quiz_reward` 1), XP, streak, "Streak activity (spm)" +7, challenge rewards, achievements (practice modes) |
| Student password login | M01 | first of the day: "Streak activity (daily_login)" +2, streak |
| Registration with `?ref=` | M01 | referral +50 / +25 (INFERRED, provisional) |
| Token conversion | M14 S12 | −syiling, +tokens |
| Reward redemption, mystery box, cabutan ticket, legacy claim | M15 | −tokens / ±syiling, +XP |
| Mini-game result | M16 | XP only while `games_award_syiling` = 0 |
| Admin award | M14 S4 | +1…10,000 (`bonus`) |
| Teacher question contribution | M10 | teacher wallet +`coins_per_question`, badge bonuses |
| Teacher cash request / status change | M14 S20 / S8 | hold, debit at PAID (INFERRED) |

**Cross-module notes.** `/gamification/rewards`, `/gamification/mystery-box`, `/cabutan`, `/admin/hadiah`, `/cikgu/kelulusan-hadiah` are **M15**; `/leaderboard`, `/ranking`, `/pelajar/{id}`, `/prestasi/{id}` are **M08**; `/battle*`, `/permainan`, `/liga`, `/tournament`, `/sekolah-bersaing` and the tournament banner are **M16**; `/guru/soalan/cipta` is **M10**; `/dashboard` (Kombo banner, quest widget, stat cards) is **M05**. The admin side of the cabutan (S10) and the 11-row syiling-priced reward catalogue with its real cost (S10) are **M14**; the student view of the cabutan is M15 S7.

---

## 2. Actors

| Role | Involvement in M14 | Verified |
|---|---|---|
| Admin | Every screen S1–S22. Has a student wallet (256), a streak (1 / best 5) and a teacher wallet (92,683) at the same time; the same session wrote to both ledgers (discovery §1.2). | OBSERVED (admin account) |
| Pelajar (student) | Owner persona of S11–S18: wallet, conversion, challenges, leaderboard, achievements, share cards, referral, history. Earns through M05/M06 sessions and logins. | INFERRED (no student account; screens observed as admin) |
| Guru (teacher) | Owner persona of S19–S22: teacher wallet, contribution coins, badges, cash-out, teacher shop, teacher leaderboard; also has a student-side view (S11–S18) with default values unless a wallet row exists. | INFERRED (no teacher account) |
| Ibu Bapa, Penaja, Admin Sekolah, PPD, JPN | No evidence of access to M14 screens; the user-portal screens S11–S18 render for any logged-in role with default values (INFERRED, provisional). | UNVERIFIED |
| Guest | Redirected to `/login` (M01 pattern). | INFERRED |
| Referred friend | A new registrant using a referral code (+25, INFERRED). | INFERRED |

---

## 3. Functional breakdown (Epic → Feature → Function)

Built from the element inventory (`docs/discovery/inventory/M14/`) and the Function catalogue used by the §6 script. "EL" lists inventory element IDs (prefix `EL-M14-`; `SHA`/`SHU` = shell files). Functions with EL "—" are behaviours (access, earning and spending rules, unobservable or PROPOSED states, cross-cutting rules) with no element of their own.

### EP-M14-1 — Navigation, shell, access and shared wallet contracts


**FT-M14-1.1 — Menu entries, header titles and tab titles**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M14-1.1.1 | User-portal sidebar entry **"Syiling & Token 🏆"** (`fa-coins`) → `/gamification` (S11) with the sub-entries **"Tukar Token"** (`fa-exchange-alt`) → S12, **"Cabaran Harian"** (`fa-bullseye`) → S13, **"Papan Pendahulu"** (`fa-trophy`) → S14, **"Pencapaian"** (`fa-medal`) → S15, **"Rujuk Kawan"** (`fa-user-plus`) → S16; the mobile drawer group "Gamifikasi" repeats them ("Syiling & Token" without the emoji). The neighbouring "Kedai Hadiah", "Kelulusan Hadiah" and "Kotak Misteri" entries belong to M15 and "Cabutan Bertuah 🎟️" to M15 | SHU-080, 082–083, 087–088, 090, 294–298, 301–302, 304 | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M14-1.1.2 | Sidebar entry **"Kombo"** (`fa-fire`) → `/kombo` in the user portal (sidebar and drawer) and **"Streak / Kombo"** (`fa-fire`) → `/kombo` in the admin panel; the route redirects (FN-M14-1.2.3) | SHA-106; SHU-015, 179 | All | OBSERVED |
| FN-M14-1.1.3 | Teacher entry **"Syiling & Ganjaran"** (`fa-coins`) → `/guru/gamifikasi` (S19) in the user-portal drawer; admin links **"Gamifikasi Guru"** (`fa-chalkboard-teacher`) → `/admin/gamifikasi/guru` (S6) in the user-portal sidebar and drawer ("Urus Hadiah" / "Admin Tebusan" → `/admin/hadiah` belong to M15) | SHU-117, 288, 313 | Guru, Admin | OBSERVED |
| FN-M14-1.1.4 | Admin panel group toggle **"Gamifikasi"** (`fa-gamepad`) with **"Overview"** → S1, **"Tier Config"** (`fa-crown`) → S2, **"Cabaran"** (`fa-bullseye`) → S3, **"Pelajar"** (`fa-users`) → S4, **"Transaksi"** (`fa-receipt`) → S5, **"Gamifikasi Guru"** (`fa-chalkboard-teacher`) → S6, **"Kawalan Reward"** (`fa-shield-halved`) → S10; the mobile "Lagi" list repeats "Gamifikasi", "Overview", "Tier Config", "Cabaran", "Gamifikasi Guru" (as live; "Kedai Hadiah" → `/admin/hadiah` is M15) | SHA-054–059, 061–062, 164–167, 169 | Admin | OBSERVED |
| FN-M14-1.1.5 | Shell header title and subtitle. Live shows the generic "Dashboard" / "Selamat datang, Admin" (S1–S5) and "Dashboard" / "Selamat datang kembali" (S11–S17); the rebuild shows the page title with the live subtitle kept (DV-M14-01, DV-SH-03): S1 "Gamifikasi Overview", S2 "Tier Configuration", S3 "Cabaran Harian", S4 "Pelajar Gamifikasi", S5 "Transaksi Syiling" (subtitle "Selamat datang, Admin"); S11 "Gamifikasi Dashboard", S12 "Tukar Syiling → Token", S13 "Cabaran Harian", S14 "Papan Pendahulu", S15 "Pencapaian Anda", S16 "Rujuk Kawan, Dapat Syiling!", S17 "Sejarah Transaksi" (subtitle "Selamat datang kembali"). Screens with a correct live title keep it: S6 "Gamifikasi Guru" / "Urus ganjaran, lencana & tebusan guru", S7 "Tebusan Guru" / "Urus permohonan tebusan ganjaran guru", S8 "Tebus Tunai Guru" / "Urus permohonan pengeluaran tunai guru", S9 "Tetapan Gamifikasi" / "Urus kadar syiling, penukaran tunai & tetapan lain", S10 "Kawalan Ekonomi Reward" / "Tetapan kewangan, kos hadiah & cabutan", S18 "Kad Kongsi" / "Kongsi pencapaian anda", S19 "Syiling & Ganjaran" / "Sumbang soalan, kumpul syiling, tebus ganjaran!", S20 "Tebus Tunai" / "Tukar syiling anda kepada wang tunai", S21 "Kedai Hadiah" / "Tebus syiling untuk hadiah menarik!", S22 "Papan Pendahulu" / "Siapa penyumbang soalan terbanyak?" | SHA-118–119, 203–204, 207–208, 211–212, 215–218; SHU-136–137, 373–382 | All | OBSERVED + DV-M14-01 |
| FN-M14-1.1.6 | Tab titles (exact live): S1 "Gamifikasi Overview", S2 "Tier Config", S3 "Cabaran Harian — Admin", S4 "Pelajar Gamifikasi", S5 "Transaksi Syiling", S6 "Gamifikasi Guru — Admin", S7 "Tebusan Guru — Admin", S8 "Tebus Tunai Guru — Admin", S9 "Tetapan Gamifikasi — Admin", S10 "Kawalan Reward — Admin", S11 "Gamifikasi Dashboard", S12 "Tukar Token", S13 "Cabaran Harian", S14 "Papan Pendahulu", S15 "Pencapaian — PRESTASIPLUS", S16 "Rujuk Kawan — PRESTASIPLUS", S17 "Sejarah Transaksi", S18 "Kad Kongsi — PRESTASIPLUS", S19 "Gamifikasi Guru", S20 "Tebus Tunai", S21 "Kedai Hadiah Guru", S22 "Papan Pendahulu Guru" (with and without the suffix, as live) | — | All | OBSERVED |
| FN-M14-1.1.7 | Shells: S1–S10 render in the admin panel shell (SHA); S11–S22 in the user-portal shell (SHU) for every role, the admin included, with drawer and bottom nav below 1024 px (00-global-ui, design/shells.md) | — | All | OBSERVED |

**FT-M14-1.2 — Access, redirects and error outcomes**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M14-1.2.1 | Every M14 route requires a session; a guest is sent to `/login` (M01 guard) | — | Guest | INFERRED |
| FN-M14-1.2.2 | Role access: the admin opens all 22 screens (OBSERVED). S1–S10 are admin-only (other roles → their M01 landing page; endpoints 403); S11–S18 are open to every logged-in role (the wallet of a user without a row reads the defaults of FN-M14-1.3.2); S19–S22 are for `teacher` and `admin` (others → landing page) — non-admin rules INFERRED, provisional | — | All | OBSERVED (admin) / INFERRED |
| FN-M14-1.2.3 | `/kombo` answers **302 → `/dashboard`** (M05 S1, where the Kombo banner lives); no kombo page exists (OBSERVED for the admin; the same redirect for every role, INFERRED) | — | All | OBSERVED / INFERRED |
| FN-M14-1.2.4 | Query tolerance (OBSERVED): S14 ignores `?period=` (same list); S22 `?tab=` other than `sekolah`/`global` renders the default tab; S15 `?rarity=` with an unknown value shows the pills and **no card and no message**; S17 `?type=` with an unknown value shows the empty state; S4 `?search=` without a match shows the empty text | — | All | OBSERVED |
| FN-M14-1.2.5 | Unknown paths under `/gamification/*`, `/guru/gamifikasi/*`, `/admin/gamification/*`, `/admin/gamifikasi/*` and `/admin/reward-control/*` render the global 404 page of M01 (INFERRED: not probed in discovery) | — | All | INFERRED |

**FT-M14-1.3 — Shared wallet and streak contracts (one source of truth, D12)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M14-1.3.1 | Header chips of the user-portal shell: "{currentSyiling} koin", "{xp} mata", "{streak.current} hari 🔥" (desktop header) and the same three values in the mobile chips strip ("🔥" alone after the streak) read the M14 summary; admin 256 / 8 / 1 (OBSERVED) | SHU-138–143, 151–156 | All logged-in | OBSERVED |
| FN-M14-1.3.2 | One **student wallet** per user (M14 owner): `currentSyiling`, `totalSyilingEarned`, `tokenBalance`, `xp`, `level`, `tier`, derived `title`; a user without a wallet row reads 0 / 0 / 0 / 0, level 1, tier Gangsa (M01 BR-24, M05 BR-25); the first credit creates the row | — | All | OBSERVED (fields) / INFERRED (defaults) |
| FN-M14-1.3.3 | One **streak store** (M14 owner; DV-M14-08): `current`, `best`, `lastActivityDate`; the header chip, M05 S1 banner and card, M08 Prestasi 360 and public profile, M17 S7, M18 Kombo views, S15 and S18 all read it (admin 1 / best 5); a stored `totalDays` counter serves M18 "Jumlah Hari" | — | All | OBSERVED + DV-M14-08 |
| FN-M14-1.3.4 | Coin figures outside M14 are derived from the wallet (DV-M14-09): M08 S18 "Syiling" = `currentSyiling` (tier progress from it), M08 S6 "Koin" = `currentSyiling` (the same value as the header chip "koin" on that page); the M08 S20 leaderboard "Koin" stays the M08 period sum of session coins (BR-M08-28), a different named figure | — | All | OBSERVED + DV-M14-09 |
| FN-M14-1.3.5 | Other modules change wallets only through the M14 contract (SRS §7.1): M05/M06 session completion (BR-31), M15 token debits and credits, mystery-box and cabutan transactions, M16 game rewards, M10 teacher contributions, M01 logins and referrals | — | System | INFERRED (D12) |

### EP-M14-2 — Student wallet dashboard and history


**FT-M14-2.1 — Dashboard S11 `/gamification`**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M14-2.1.1 | Hero identity: tier emoji badge ("🥉"), title chip "{emoji} {title}" ("📚 Permulaan"), h1 "{labelMs} Tier" ("Gangsa Tier"), "Level {level}" ("Level 2") | S11-004–007 | Pelajar; Admin | OBSERVED |
| FN-M14-2.1.2 | Hero figures "{currentSyiling}" "Syiling 💰" and "{tokenBalance}" "Token 🎫" (256 / 0) | S11-008–011 | Pelajar; Admin | OBSERVED |
| FN-M14-2.1.3 | Next-tier progress: "⬆️ Naik ke **{next labelMs}**", bar, "{pct}%" = currentSyiling ÷ next `min_syiling` × 100 with 1 decimal ("51.2%"), "Perlu {next min − currentSyiling} syiling lagi" ("Perlu 244 syiling lagi"); at the highest active tier the block is not rendered (INFERRED; not observed) | S11-012–015 | Pelajar; Admin | OBSERVED / INFERRED |
| FN-M14-2.1.4 | Hero buttons "Tukar Token" (`fa-exchange-alt`) → S12, "Cabaran Harian" (`fa-bullseye`) → S13, "Kedai Hadiah" (`fa-gift`) → `/gamification/rewards` (M15) | S11-016–018 | Pelajar; Admin | OBSERVED |
| FN-M14-2.1.5 | Four stat cards: "{currentSyiling}" "Baki Syiling" "+{earned today} hari ini"; "{tokenBalance}" "Baki Token" "{rate} syiling = 1 token"; "{level}" "Level" "{xp}/{xpNeeded} XP" with a bar; "{totalSyilingEarned}" "Jumlah Syiling" "+{earned this week} minggu ini" (admin "+0 hari ini", "50 syiling = 1 token", "8/110 XP", "+0 minggu ini") | S11-019–034 | Pelajar; Admin | OBSERVED / INFERRED (sums) |
| FN-M14-2.1.6 | "Cabaran Hari Ini" (`fa-bullseye`) + "Lihat semua →" → S13, then the first 4 active challenges in sort order: icon, title, difficulty badge upper case by CSS ("MUDAH"/"SEDERHANA"/"SUKAR"), description, "{progress}/{target}", "+{reward_syiling} 💰" | S11-035–065 | Pelajar; Admin | OBSERVED |
| FN-M14-2.1.7 | "Transaksi Terkini" (`fa-history`) + "Semua →" → S17, then the latest 6 ledger rows of the user: type icon ("💰" for earn), description, relative time ("4 bulan yang lepas"), signed amount ("+25") | S11-066–092 | Pelajar; Admin | OBSERVED |
| FN-M14-2.1.8 | "Tahap Penguasaan Subjek" (`fa-layer-group`): one row per M05 subject-mastery record — "L{n}", subject, stage label ("Aktif", "Mula Belajar"), "{correct} betul / {next target}", "{accuracy}% tepat" (2 decimals, trailing zeros dropped) and " · {mult}x bonus" when the M05 multiplier is above 1 (admin: "L2" Bahasa Melayu "Aktif" "46 betul / 50" "48.94% tepat · 1.05x bonus"; "L1" Sejarah "Mula Belajar" "14 betul / 25" "35% tepat") — read-only M05 data (BR-20) | S11-093–104 | Pelajar; Admin | OBSERVED |
| FN-M14-2.1.9 | "Sistem Tier" (`fa-crown`): one card per active tier in sort order — emoji, label, "{min}+ syiling", "{rate} syiling = 1 token"; the viewer's tier card has "✨ ANDA DI SINI"; the label text of gold, silver and platinum is slate-800 `#1e293b` instead of live `#ffd700` / `#c0c0c0` / `#e5e4e2` (DV-M14-15; swatches, borders, tints and bronze as live) | S11-105–127 | Pelajar; Admin | OBSERVED + DV-M14-15 |
| FN-M14-2.1.10 | "Gelaran Seterusnya" (`fa-medal`): emoji and name of the next title ("🎓" "Pelajar") and "Perlu {n} syiling lagi untuk gelaran ini" ("Perlu 44 syiling lagi untuk gelaran ini"), n = next title threshold − totalSyilingEarned | S11-128–132 | Pelajar; Admin | OBSERVED |
| FN-M14-2.1.11 | Link card "Kad Kongsi" / "Kongsi pencapaian anda di WhatsApp!" (`fa-share-nodes`) → S18 | S11-133 | Pelajar; Admin | OBSERVED |

**FT-M14-2.2 — Transaction history S17 `/gamification/history`**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M14-2.2.1 | h1 "📋 Sejarah Transaksi", "Baki semasa: **{currentSyiling}** syiling", link "← Dashboard" → S11 | S17-004–007 | Pelajar; Admin | OBSERVED |
| FN-M14-2.2.2 | Filter pills (links): "Semua", "💰 Dapat" `?type=earn`, "🛍️ Belanja" `?type=spend`, "🔄 Tukar" `?type=convert`, "🎁 Bonus" `?type=bonus` (no refund pill, as live); the active pill is highlighted | S17-008–012 | Pelajar; Admin | OBSERVED |
| FN-M14-2.2.3 | Rows (newest first, all rows, no pager — admin 14): type icon ("💰" for earn, OBSERVED; 🛍️ / 🔄 / 🎁 for spend / convert / bonus, PROPOSED from the pill icons), description, "dd/mm/yyyy HH:mm · {relative}", signed amount (green "+n" / red "−n"), "Baki: {balanceAfter}" | S17-013–028 | Pelajar; Admin | OBSERVED / PROPOSED (icons) |
| FN-M14-2.2.4 | Empty state (no row for the filter or an unknown `type`): "📋", "Belum ada transaksi", "Mula latih tubi untuk dapatkan syiling!" | S17-029–032 | Pelajar; Admin | OBSERVED |

### EP-M14-3 — Token conversion (S12 `/gamification/convert`)


**FT-M14-3.1 — Convert syiling to tokens**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M14-3.1.1 | h1 "🔄 Tukar Syiling → Token", "Tukar syiling anda kepada token untuk tebus hadiah", tiles "{currentSyiling}" "Baki Syiling" and "{tokenBalance}" "Baki Token" | S12-004–009 | Pelajar; Admin | OBSERVED |
| FN-M14-3.1.2 | Card "💱 Penukaran" with form `#convertForm`: label "Syiling untuk ditukar", number input `syiling_amount` (placeholder "0", `required`, **min = tier rate**, **max = currentSyiling**, initial value = rate) | S12-010–015 | Pelajar; Admin | OBSERVED |
| FN-M14-3.1.3 | Quick buttons "{rate} syiling", "{5 × rate} syiling", "Semua ({currentSyiling})" (admin "50 syiling", "250 syiling", "Semua (256)") set the amount and mark themselves active; the second value is 5 × rate (INFERRED from one tier) | S12-016–018 | Pelajar; Admin | OBSERVED / INFERRED |
| FN-M14-3.1.4 | Preview "Anda akan terima" `#tokenPreview` = floor(amount ÷ rate) with ms-MY separators, "Token 🎫", and "Kadar: {rate} syiling = 1 token ({tier labelMs})"; updated on every input | S12-019–022 | Pelajar; Admin | OBSERVED |
| FN-M14-3.1.5 | "Tukar Sekarang" (`fa-exchange-alt`) is disabled when amount < rate or amount > currentSyiling (typing 30 → 0 token, disabled; 300 → 6 token, disabled); otherwise it submits the conversion | S12-023 | Pelajar; Admin | OBSERVED |
| FN-M14-3.1.6 | Card "📊 Kadar Penukaran Mengikut Tier": one card per active tier — emoji, label, "{min}+ syiling", "{rate}" "syiling/token", badge "ANDA" on the viewer's tier; label text of gold, silver and platinum slate-800 as on S11 (DV-M14-15) | S12-024–050 | Pelajar; Admin | OBSERVED + DV-M14-15 |
| FN-M14-3.1.7 | Tip "💡 **Tips:** Naik tier untuk dapatkan kadar penukaran yang lebih baik! Semakin tinggi tier, semakin sedikit syiling diperlukan untuk 1 token." | S12-051–052 | Pelajar; Admin | OBSERVED |
| FN-M14-3.1.8 | Conversion effect: the server re-checks rate ≤ s ≤ currentSyiling (s integer), deducts **the typed amount s** (remainder not refunded), adds t = floor(s ÷ rate) tokens, writes a `convert` row "Tukar {s} syiling → {t} token" (source `token_conversion`, amount −s, `tokens` t) and returns to S12 with the new balances and a success message (PROPOSED COPY); `totalSyilingEarned` is unchanged | — | Pelajar; Admin | OBSERVED (row format) / INFERRED (effect) |

### EP-M14-4 — Daily challenges


**FT-M14-4.1 — Student challenges S13 `/gamification/challenges`**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M14-4.1.1 | h1 "🎯 Cabaran Harian", "Selesaikan cabaran untuk dapatkan syiling & XP bonus!", counter "{completed today}/{active challenges}" "Selesai" ("0/10") | S13-004–007 | Pelajar; Admin | OBSERVED |
| FN-M14-4.1.2 | One card per active challenge in sort order (sort_order, then id): icon, h3 title, difficulty badge (Mudah / Sederhana / Sukar, upper case by CSS), description, "💰 +{reward_syiling} Syiling", "⭐ +{reward_xp} XP", "Progres: {progress}/{target}", bar and "{pct}%"; a completed card keeps the layout with a full bar and the completed styling of SRS §8.2 (PROPOSED; not observed) | S13-008–097 | Pelajar; Admin | OBSERVED / PROPOSED (completed style) |

**FT-M14-4.2 — Challenge engine (behaviour)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M14-4.2.1 | Progress per challenge for today (00:00–24:00 Asia/Kuala_Lumpur) from the M05 session store, using the M05 BR-10 metric of each live challenge: 1 Rajin Berlatih = sessions; 2 Si Tepat and 9 Ketepatan 90% = best session accuracy (floor); 3 Penjelajah Topik = distinct curriculum chapters answered; 4 Kilat Matematik and 6 Jawab 5 Betul = correct answers; 5 Mula Hari Ini = sessions; 7 Latihan 10 Minit = floor(minutes); 8 Kombo 2 Hari = the M14 streak **today only** (the current streak when the last activity is today, else 0; v1.6 — the admin, last active 19/05/2026, reads 0/2; the stored streak shown in the header chip, S15 and S18 is unchanged); 10 Cabaran Kilat = best correct count in one session; progress is capped at the target. A challenge created on S3 uses the default metric of its type (SRS BR-M14-12) | — | Pelajar; Admin | INFERRED (M05 BR-10) |
| FN-M14-4.2.2 | Completion: when progress ≥ target after a session, the challenge completes once per day; the wallet gets +reward_syiling (row "Cabaran selesai: {title}", source `daily_challenge`) and +reward_xp; several completions are written in sort order | — | Pelajar; Admin | OBSERVED (row) / INFERRED (trigger) |
| FN-M14-4.2.3 | Reset: progress and completion restart at 00:00 Asia/Kuala_Lumpur (S1 "Siap Hari Ini" counts the users who completed every active challenge today) | — | System | INFERRED |
| FN-M14-4.2.4 | Inactive challenges (S3 toggle) are hidden from S13, S11 and the M05 dashboard widget and are not counted in "Cabaran Aktif" | — | System | INFERRED |

### EP-M14-5 — Student leaderboard (S14 `/gamification/leaderboard`)


**FT-M14-5.1 — Leaderboard by lifetime syiling**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M14-5.1.1 | h1 "🏆 Papan Pendahulu", "Siapa paling rajin belajar?" | S14-004–005 | Pelajar; Admin | OBSERVED |
| FN-M14-5.1.2 | Podium `lb-top-card` in the order silver (🥈 #2), gold (🥇 #1, raised), bronze (🥉 #3): medal, avatar (initials), name, "{totalSyilingEarned} syiling", "{tier emoji} {tier labelMs}" ("💎 Platinum") | S14-006–023 | Pelajar; Admin | OBSERVED |
| FN-M14-5.1.3 | Rows `.lb-row` #4–#50: "#{rank}", avatar, name, "{title} · Level {level}" ("Mitos · Level 39"), "{totalSyilingEarned}" "syiling", tier emoji | S14-024–045 | Pelajar; Admin | OBSERVED |
| FN-M14-5.1.4 | Ranking: every wallet by `totalSyilingEarned` descending (ties: wallet creation order), top 50, all time; `?period=` is ignored; no own-rank card and no period filter (as live) | — | Pelajar; Admin | OBSERVED |
| FN-M14-5.1.5 | Names are the users' display names from M02 (fictitious in every seed); avatars are initials (live avatar images carry names) | — | All | OBSERVED + privacy rule |

### EP-M14-6 — Achievements, streak card and share cards


**FT-M14-6.1 — Achievements S15 `/gamification/achievements`**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M14-6.1.1 | h1 "🏅 Pencapaian Anda", "Kumpul lencana dan capai pencapaian — {unlocked}/25 dicapai" ("0/25 dicapai") | S15-004–005 | Pelajar; Admin | OBSERVED |
| FN-M14-6.1.2 | Streak card: "🔥" "{streak.current}" "Hari berturut-turut", badge "{multiplier}x Bonus" ("1.0x Bonus"), "Terbaik: {streak.best} hari" — from the single streak store (DV-M14-08; live showed 0 / 0 from a second store) | S15-006–010 | Pelajar; Admin | OBSERVED + DV-M14-08 |
| FN-M14-6.1.3 | Rarity pills (links): "Semua", "Biasa" `?rarity=common` (6), "Jarang" `?rarity=rare` (8), "Epik" `?rarity=epic` (6), "Legenda" `?rarity=legendary` (5); active pill purple-600; an unknown value shows no card and no message | S15-011–015 | Pelajar; Admin | OBSERVED |
| FN-M14-6.1.4 | Badge cards (25, live order): icon, name, description, rarity tag (upper case by CSS: "BIASA", "JARANG", "EPIK", "LEGENDA"), reward line "🪙 {syiling} · ⭐ {xp} XP" and, for the 5 kuiz-count badges only, a progress bar with "{n}/{target}"; locked cards are greyed (`badge-card locked`) with the rarity colour `--rarity-color` | S15-016–145 | Pelajar; Admin | OBSERVED |
| FN-M14-6.1.5 | An unlocked card (full colour, PROPOSED styling) opens the share modal `#shareModal`: card `#shareCardCanvas` on the rarity gradient with icon, name, description, rarity label, the user's name, "🎓 PRESTASIPLUS", "{syiling} 🪙 Syiling", "{xp} ⭐ XP"; a click on the backdrop closes it | S15-146, 150 | Pelajar; Admin | SOURCE-DERIVED / PROPOSED (unlocked style) |
| FN-M14-6.1.6 | "Muat Turun" (`fa-download`) saves the card as PNG `pencapaian-{name lower-case, spaces → hyphens}.png` (scale 2). **As built (v1.7, D25):** the browser captures the user's own on-screen card (html2canvas 1.4.1, scale 2, lazy-loaded) and downloads the PNG; the S15 file name is `pencapaian-{name lower-case, whitespace → hyphen}.png` | S15-147 | Pelajar; Admin | SOURCE-DERIVED |
| FN-M14-6.1.7 | "WhatsApp" (`fa-whatsapp`) opens `https://wa.me/?text=` with "🏅 Saya baru capai "{name}" di PRESTASIPLUS! 🎉\n\nJom latih tubi sama-sama:\nhttps://prestasiplus.my/pelajar/{viewer id}" (DV-M14-02; live hard-codes `/pelajar/3`, a 404) | S15-148 | Pelajar; Admin | SOURCE-DERIVED + DV-M14-02 |
| FN-M14-6.1.8 | "Tutup" closes the modal | S15-149 | Pelajar; Admin | SOURCE-DERIVED |
| FN-M14-6.1.9 | Unlock rules (INFERRED, provisional): achievements are evaluated when an M05 practice-mode session (random, chapter, revision) completes — this explains the admin at 0/25 with 256 lifetime syiling and a best streak of 5. Criteria per SRS BR-M14-16; on unlock the wallet gets +syiling (row "Pencapaian: {name}", PROPOSED COPY, source `achievement`) and +XP | — | Pelajar; Admin | INFERRED / PROPOSED |

**FT-M14-6.2 — Kad Kongsi S18 `/gamification/kad-kongsi`**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M14-6.2.1 | Tabs "Profil" (`fa-id-card`, default), "Kombo" (`fa-fire`), "Penguasaan" (`fa-brain`), "Kedudukan" (`fa-trophy`); one card set visible at a time | S18-004–007 | Pelajar; Admin | OBSERVED |
| FN-M14-6.2.2 | "Kad Profil Pelajar": initial ("A"), name, "PRESTASIPLUS", "{answered}" "Soalan", "{accuracy}%" "Ketepatan", "{sessions}" "Sesi" (M05 all-time: 119 / 38.7% / 4), "🥉 Bronze" (tier emoji + English tier key capitalised, as live), "Lvl {level}", "🪙 {currentSyiling}", "🎓 PRESTASIPLUS.MY" | S18-008–022 | Pelajar; Admin | OBSERVED |
| FN-M14-6.2.3 | "Kad Kombo": "🔥" "{streak.current}" "Hari Berturut-turut!", "{streak.best}" "Rekod Terbaik", "{multiplier}x" "Pengganda", name, "🎓 PRESTASIPLUS.MY" — single streak store (DV-M14-08) | S18-025–035 | Pelajar; Admin | OBSERVED + DV-M14-08 |
| FN-M14-6.2.4 | "Kad Penguasaan Subjek": one card per M05 mastery subject — "Penguasaan Subjek", subject, "Lvl {n} — {stage}", "{accuracy}%" (1 decimal, trailing ".0" dropped) "Ketepatan", "{correct}" "Betul", name, "🎓 PRESTASIPLUS.MY" | S18-038–049, 052–060 | Pelajar; Admin | OBSERVED |
| FN-M14-6.2.5 | "Kad Kedudukan": "🏆" "Kedudukan Terkini", "{accuracy}%" (strong), "Ketepatan · {correct}/{answered} betul", name, "🎓 PRESTASIPLUS.MY" | S18-063–071 | Pelajar; Admin | OBSERVED |
| FN-M14-6.2.6 | "Muat Turun" (`fa-download`) on every card saves it as PNG `prestasiplus-{card key}.png` (profil, kombo, penguasaan-{i}, kedudukan); a `downloading` guard ignores clicks until the file is written. **As built (v1.7, D25):** html2canvas 1.4.1 capture (scale 2, lazy-loaded) and real PNG download; file names `prestasiplus-{profil|kombo|penguasaan-{i}|kedudukan}.png` (i 0-based); the `downloading` guard is reset on success or failure; colours are converted for html2canvas (unparseable colours left unchanged) | S18-023, 036, 050, 061, 072 | Pelajar; Admin | SOURCE-DERIVED |
| FN-M14-6.2.7 | "WhatsApp" / "Kongsi" (`fa-whatsapp`) open `wa.me` with the card text + "\n\nhttps://prestasiplus.my/pelajar/{viewer id}" (DV-M14-02): profile "Lihat profil saya di PRESTASIPLUS! {accuracy}% ketepatan dengan {answered} soalan dijawab."; kombo "🔥 Kombo {current} hari berturut-turut di PRESTASIPLUS! Rekod terbaik: {best} hari. Jom cabaran!"; mastery "🧠 Saya sudah capai Level {n} ({stage}) dalam {subject} di PRESTASIPLUS! Ketepatan {accuracy}%. Jom bersaing!"; ranking "🏆 Kedudukan saya di PRESTASIPLUS: {accuracy}%! Jom latih tubi!" (DV-M14-03; live leaves the value empty) | S18-024, 037, 051, 062, 073 | Pelajar; Admin | SOURCE-DERIVED + DV-M14-02, DV-M14-03 |

### EP-M14-7 — Referral (S16 `/gamification/referral`)


**FT-M14-7.1 — Refer a friend**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M14-7.1.1 | h1 "🤝 Rujuk Kawan, Dapat Syiling!", "Jemput kawan anda ke PRESTASIPLUS — dua-dua dapat ganjaran!", tiles "🎁" "**50**" "Syiling untuk ANDA" and "👋" "**25**" "Syiling untuk KAWAN" | S16-004–011 | Pelajar; Admin | OBSERVED |
| FN-M14-7.1.2 | "Kod Rujukan Anda": the user's 7-character code (upper case and digits; admin "4JURJTT") and "Salin Kod" (`fa-copy`): copies the code and the label becomes "✓ Disalin!" (stays until reload) | S16-012–014, 026 | Pelajar; Admin | OBSERVED |
| FN-M14-7.1.3 | Links "WhatsApp" → `https://wa.me/?text=Jom belajar matematik di PRESTASIPLUS! Guna kod {CODE} untuk dapat 25 syiling PERCUMA! https://prestasiplus.my/register?ref={CODE}` and "Telegram" (`fa-telegram`) → `https://t.me/share/url?url=https://prestasiplus.my/register?ref={CODE}&text=Jom belajar matematik di PRESTASIPLUS! Guna kod {CODE}` (new tab); as live, only spaces are encoded (`%20`) — `:`, `/`, `?`, `=`, `&` and `!` stay raw (v1.6) | S16-015–016 | Pelajar; Admin | OBSERVED |
| FN-M14-7.1.4 | "Salin Link" (`fa-link`) copies `https://prestasiplus.my/register?ref={CODE}`; label "✓ Link Disalin!" | S16-017 | Pelajar; Admin | OBSERVED |
| FN-M14-7.1.5 | "📊 Statistik Rujukan": "{n}" "Rujukan" (referred users), "{n}" "Ganjaran Dicapai" (rewarded referrals), "{n}" "Syiling Diperolehi" (Σ referral syiling earned) — admin 0 / 0 / 0 | S16-018–025 | Pelajar; Admin | OBSERVED / INFERRED (definitions) |
| FN-M14-7.1.6 | Referral reward (INFERRED, provisional): a new user who registers after opening `/register?ref={CODE}` of an existing user gets +25 and the referrer +50 (type `bonus`, source `referral`, PROPOSED descriptions); once per new user; an unknown code, the user's own code or a second registration give nothing (the M01 form stays as live, M01 FR-18) | — | Pelajar | INFERRED / PROPOSED |

### EP-M14-8 — Earning and spending rules (behaviour, no element of their own)


**FT-M14-8.1 — Session credit, XP and streak**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M14-8.1.1 | Session credit (M05 BR-31 step 6): coins = correct × the rate — a `coinsPerCorrect` passed by M05 overrides everything (missions: 3, M05 BR-09), else `flat_quiz_reward` (1), else (setting 0) the tier `quiz_reward_l{difficulty}` per correct answer (INFERRED); the wallet credit may differ from the M05 session `coinsEarned`, as on live (A2: session 14, ledger +42), and M05 S7 "Ganjaran Anda" shows the credited amount; one `earn` row per session with the observed wording — practice modes "Latih Tubi: {n} betul — {pct}%" (`quiz_practice`), `past_year` "SPM Tahun Lepas: {n} betul — {pct}%" and `latih_tubi` "Latih Tubi SPM: {n} betul — {pct}%" (`quiz_spm`), `ramalan` "Ramalan SPM: {n} betul — {pct}%" (PROPOSED COPY); pct with at most 2 decimals, trailing zeros dropped; no row when coins = 0; complimentary students (M02 `coinsEnabled = false`) earn nothing | — | Pelajar; Admin | OBSERVED (rows, flat 1) / INFERRED |
| FN-M14-8.1.2 | XP: the wallet adds the session `pointsEarned` handed over by M05 (BR-09), challenge and achievement XP and M15 mystery-box XP; the header "mata" is `xp`. `level` is a stored value with no observed formula (Q4): the prototype never changes it at runtime (provisional); the S11 bar shows `xp` over xpNeeded(level) = 100 + 10 × (level − 1), capped at 100 % (INFERRED from "8/110 XP"); when xp ≥ xpNeeded the text still reads "{xp}/{xpNeeded} XP" (e.g. "916/100 XP") with a full bar (PROPOSED; not observed) | — | Pelajar; Admin | OBSERVED (values) / INFERRED |
| FN-M14-8.1.3 | Streak rule (INFERRED, provisional): a day counts when the user completes a session of any mode or a student logs in with a password; the next counted day after the last one adds 1, a later day restarts at 1; `best` = the highest `current`; reading never decays the value (OBSERVED: admin 1 although inactive since May); multiplier "1.0x" (the only observed step) | — | Pelajar; Admin | OBSERVED (values) / INFERRED (rule) |
| FN-M14-8.1.4 | Streak activity rows: the first SPM session (`past_year`, `latih_tubi`, `ramalan`) of a day adds +7 "Streak activity (spm)" (source `spm`); a student's first password login of a day adds +2 "Streak activity (daily_login)" (source `daily_login`; admin logins add nothing, OBSERVED absence) | — | Pelajar | OBSERVED (amounts) / INFERRED (triggers) |
| FN-M14-8.1.5 | Kombo bonus rows ("Bonus Kombo 3 Hari" +25, "Bonus Kombo 10 Hari!" +50, type `bonus`, source `streak_bonus`) are historical data only (2 rows in 52,964, both 27/02/2026); the prototype awards no streak bonus (INFERRED from their rarity) | — | System | OBSERVED (rows) / INFERRED |
| FN-M14-8.1.6 | Teacher mirror: when the user also has a teacher wallet (role `teacher` or `admin`), a completed session also writes "{Latih Tubi SPM \| SPM Tahun Lepas \| Latihan} - {pct}% ketepatan" with +correct (a 0 row is written) and the first SPM session of the day "Aktiviti harian: spm" +7 to the teacher ledger (OBSERVED on the admin: +22 / +11 for the same session) | — | Guru; Admin | OBSERVED (rows) / INFERRED |

**FT-M14-8.2 — Tiers, titles and tier reward fields**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M14-8.2.1 | Tier assignment (INFERRED, Q3, provisional): after each credit the wallet moves up to the highest active tier whose `min_syiling` ≤ `currentSyiling`; it never moves down (explains platinum with balance 129 and bronze with lifetime 609); seeds keep the observed tiers | — | System | INFERRED |
| FN-M14-8.2.2 | Titles (gelaran) by `totalSyilingEarned` (INFERRED cut-offs inside the observed gaps, Q4): 📚 Permulaan 0, 🎓 Pelajar 300 (OBSERVED), Master 2,000, Grandmaster 3,500, Legenda 5,000, Mitos 10,000 — every observed leaderboard row matches | — | System | OBSERVED (anchors) / INFERRED (cut-offs) |
| FN-M14-8.2.3 | Tier reward fields: `quiz_reward_l1…l5` apply only when `flat_quiz_reward` = 0 (FN-M14-8.1.1); `pksk_reward_correct` per correct PKSK answer only when `flat_quiz_reward` = 0 and no rate is passed (mode `pksk`, M05 v1.12; ledger source `quiz_pksk`; INFERRED — no PKSK row observed); `board_game_reward_correct` / `board_game_reward_win` for Papan Bijak (M16) only when `games_award_syiling` = 1 | — | System | OBSERVED (fields) / INFERRED |

**FT-M14-8.3 — Other credits and debits**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M14-8.3.1 | Admin award (S4): +amount (1–10,000) to the user's wallet, a `bonus` row with the reason as description (source `admin_award`, INFERRED) | — | Admin | OBSERVED (form) / INFERRED (row) |
| FN-M14-8.3.2 | Mini-games (M16): `onGameResult(userId, {game, event, coins?, xp})` returns `{coinsCredited, xpAdded}`; with `games_award_syiling` = 0 (live) a game result adds XP only (coinsCredited 0); with 1 it also adds the syiling with the M16 row wording (sample rows, discovery §1.2) | — | System | OBSERVED (setting) / INFERRED |
| FN-M14-8.3.3 | Tokens (M15, XR-M15-02): redeeming a hadiah (source `hadiah_redeem`) and opening a mystery box (`mystery_box`) debit tokens; a cancelled redemption credits them back once (`hadiah_refund`, INFERRED); a debit larger than the balance is refused (`INSUFFICIENT_BALANCE`) and writes nothing, so no runtime balance goes below 0 (the observed negative balances stay as seed data, DV-M14-10). Token movements are not listed in the coin ledger (as live); M14 keeps an internal token log for reconciliation | — | Pelajar | INFERRED |
| FN-M14-8.3.4 | Mystery box (M15): +syiling and +XP from the box range; row "Kotak Misteri: {box name}" (source `mystery_box`) | — | Pelajar | OBSERVED (row) / INFERRED |
| FN-M14-8.3.5 | Cabutan ticket (M15 S7, XR-M15-03): one ticket per purchase, −`ticket_cost_syiling` from `currentSyiling`, row "Tiket Cabutan: {title}" (type `spend`, source `cabutan_ticket`, PROPOSED COPY); refused when the draw is not open, the student already holds `max_tickets_per_student` tickets, or the balance is too low | — | Pelajar | INFERRED / PROPOSED |
| FN-M14-8.3.6 | Legacy reward claim: "Tuntut: {reward}" (type `spend`, source `reward_claim`, −price in syiling) — the one observed row #42; runtime claims only if M15 lists this catalogue (Q-M15-2) | — | Pelajar | OBSERVED (row) / INFERRED |
| FN-M14-8.3.7 | Integrity: every wallet change is one transaction (balance, ledger row with `balanceAfter`, tier/title) — no debit makes `currentSyiling` or `tokenBalance` negative at runtime | — | System | INFERRED |

### EP-M14-9 — Admin gamification (S1–S5)


**FT-M14-9.1 — Overview S1 `/admin/gamification`**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M14-9.1.1 | h1 "🎮 Gamifikasi Overview", "Pantau sistem gamifikasi PRESTASIPLUS" | S1-001–002 | Admin | OBSERVED |
| FN-M14-9.1.2 | Six stat cards (icon tile + coloured top border): "Pelajar Aktif" (users, blue) = wallets; "Syiling Dijana" (coins, amber) = Σ `totalSyilingEarned`; "Token Ditukar" (ticket, purple) = Σ tokens of `token_conversion` rows; "Penukaran" (exchange, emerald) = count of `token_conversion` rows (the one legacy `token_convert` row excluded); "Cabaran Aktif" (bullseye, red) = active challenges; "Siap Hari Ini" (check, teal) = users who completed every active challenge today (INFERRED, §6.10) — snapshot 2,255 / 3,124,192 / 7,801 / 534 / 10 / 0 | S1-003–014 | Admin | OBSERVED (values) / INFERRED (definitions) |
| FN-M14-9.1.3 | "Taburan Tier" (`fa-crown`): one row per tier key in **alphabetical** order (bronze, gold, platinum, silver; as live), key capitalised by CSS, bar width = count ÷ wallets in the tier colour with `min-width: 40px` (live; the gold, platinum and silver bars are 40 px wide and the count fits inside), the count inside the bar, and "{pct}%" (integer): 1889 / 84%, 41 / 2%, 33 / 1%, 292 / 13%; the count text is slate-800 on the light fills gold, silver and platinum (DV-M14-06; live white with a drop shadow) | S1-015–028 | Admin | OBSERVED + DV-M14-06 |
| FN-M14-9.1.4 | "Top 10 Pelajar" (`fa-trophy`): "#{rank}", name, "{tier key} · Level {level}", amber "{totalSyilingEarned}" over "syiling", ranked by lifetime syiling | S1-029–045 | Admin | OBSERVED |
| FN-M14-9.1.5 | "Transaksi Terkini" (`fa-history`) + "Lihat semua →" → S5; table "Pelajar \| Jenis \| Jumlah \| Sumber \| Masa" with the 10 newest ledger rows: name, raw type capitalised ("Earn"), green "+n" / red "−n", raw source key, relative time ("13 minit yang lepas") | S1-046–049 | Admin | OBSERVED |

**FT-M14-9.2 — Tier configuration S2 `/admin/gamification/tiers`**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M14-9.2.1 | h1 "👑 Tier Configuration", "Urus tier sistem gamifikasi — termasuk ganjaran Syiling per soalan", card "Senarai Tier" | S2-001–004 | Admin | OBSERVED |
| FN-M14-9.2.2 | Per tier a PUT form (`/tiers/{id}`): large emoji, "Label BM" `label_ms`, "Icon" `icon`, "Warna" `color` (colour input), "Min Syiling" `min_syiling`, "Kadar" `conversion_rate`, "Urutan" `sort_order` (all `required` except colour) and an icon-only save button (`fa-save`) | S2-005–021, 045–061, 085–101, 125–141 | Admin | OBSERVED |
| FN-M14-9.2.3 | Sub-block "📝 Latih Tubi — Syiling per Jawab Betul" with "L1"…"L5" (`quiz_reward_l1…l5`, number, min 0, required) | S2-022–032, 062–072, 102–112, 142–152 | Admin | OBSERVED |
| FN-M14-9.2.4 | Sub-block "🛡️ PKSK — Syiling per Jawab Betul" `pksk_reward_correct` (min 0, required) with "Semua soalan PKSK (tiada level)" | S2-033–035, 073–075, 113–115, 153–155 | Admin | OBSERVED |
| FN-M14-9.2.5 | Sub-block "🎲 Papan Bijak — Syiling" with "Jawab Betul" `board_game_reward_correct` and "Menang" `board_game_reward_win` (min 0, required) | S2-036–040, 076–080, 116–120, 156–160 | Admin | OBSERVED |
| FN-M14-9.2.6 | Hidden `perks` (JSON array) re-posted unchanged: perks of an existing tier cannot be edited (as live) | S2-041, 081, 121, 161 | Admin | OBSERVED |
| FN-M14-9.2.7 | Toggle form (`/tiers/{id}/toggle`) "🔴 Nyahaktif" (active tier; all 4 live tiers are active); an inactive tier shows "🟢 Aktifkan" (PROPOSED COPY) and leaves the student tier grids, conversion and assignment (INFERRED) | S2-042–044, 082–084, 122–124, 162–164 | Admin | OBSERVED / INFERRED |
| FN-M14-9.2.8 | Card "➕ Tambah Tier Baru" (POST `/tiers`): "Nama Tier (eng)" `tier_name` (placeholder "diamond"), "Label BM" ("Berlian"), "Icon" ("💎"), "Warna" (default #3b82f6), "Min Syiling" ("10000"), "Kadar Penukaran" ("15"), "Urutan" (default 4), "Perks" (text, "Bonus 2x XP", optional), L1–L5 (defaults 1–5), PKSK (5), Papan Bijak (5 / 25), button "Tambah Tier" (`fa-plus`) | S2-165–204 | Admin | OBSERVED |

**FT-M14-9.3 — Challenge administration S3 `/admin/gamification/challenges`**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M14-9.3.1 | h1 "🎯 Cabaran Harian", "Urus cabaran harian untuk pelajar", card "Senarai Cabaran ({n})" (10) | S3-001–004 | Admin | OBSERVED |
| FN-M14-9.3.2 | Per challenge a PUT form (`/challenges/{id}`) headed by the icon, the title and a difficulty badge "Mudah" / "Sederhana" / "Sukar" | S3-005–010, 037–042, 069–074, 101–106, 133–138, 165–170, 197–202, 229–234, 261–266, 293–298 | Admin | OBSERVED |
| FN-M14-9.3.3 | Fields (all `required`): "Tajuk" `title`, "Keterangan" `description`, "Icon" `icon`, "Sasaran" `target_value`, "Ganjaran Syiling" `reward_syiling`, "Ganjaran XP" `reward_xp`, "Kesukaran" `difficulty` (easy "Mudah" / medium "Sederhana" / hard "Susah"; the card badge says "Sukar", as live), "Urutan" `sort_order`, and "Simpan" (`fa-save`) | S3-011–016, 019–029, 043–048, 051–061, 075–080, 083–093, 107–112, 115–125, 139–144, 147–157, 171–176, 179–189, 203–208, 211–221, 235–240, 243–253, 267–272, 275–285, 299–304, 307–317 | Admin | OBSERVED |
| FN-M14-9.3.4 | "Jenis" `challenge_type` select ("Bilangan Kuiz" `quiz_count`, "Ketepatan (%)" `accuracy`, "Topik Berbeza" `topic_variety`, "Kombo" `streak`, "Masa (min)" `time_spent`); stored types follow the challenge meaning (DV-M14-04: 2 and 9 `accuracy`, 7 `time_spent`, 8 `streak`; live shows "Bilangan Kuiz") | S3-017–018, 049–050, 081–082, 113–114, 145–146, 177–178, 209–210, 241–242, 273–274, 305–306 | Admin | OBSERVED + DV-M14-04 |
| FN-M14-9.3.5 | Toggle form (`/challenges/{id}/toggle`) "🔴 Nyahaktif"; an inactive challenge shows "🟢 Aktifkan" (PROPOSED COPY) and leaves the student lists (FN-M14-4.2.4) | S3-030–032, 062–064, 094–096, 126–128, 158–160, 190–192, 222–224, 254–256, 286–288, 318–320 | Admin | OBSERVED / INFERRED |
| FN-M14-9.3.6 | Delete form (`DELETE /challenges/{id}`) "Padam" (`fa-trash`) with the confirm "Padam cabaran ini?"; confirmed → the challenge is removed; its past ledger rows stay | S3-033–036, 065–068, 097–100, 129–132, 161–164, 193–196, 225–228, 257–260, 289–292, 321–324 | Admin | OBSERVED (confirm) / INFERRED |
| FN-M14-9.3.7 | Card "➕ Tambah Cabaran Baru" (POST `/challenges`): the same fields, "Icon" placeholder "📝", defaults Jenis `quiz_count`, Ganjaran Syiling 10, Ganjaran XP 5, Kesukaran `easy`, Urutan 10; button "Tambah Cabaran" (`fa-plus`) | S3-325–347 | Admin | OBSERVED |

**FT-M14-9.4 — Students and bonus award S4 `/admin/gamification/students`**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M14-9.4.1 | h1 "👥 Pelajar Gamifikasi", "Pantau progress pelajar & berikan bonus syiling" | S4-001–002 | Admin | OBSERVED |
| FN-M14-9.4.2 | GET filter form: `search` (placeholder "Cari nama/email..."), `tier` ("Semua Tier", "🥉 Gangsa" bronze, "🥈 Perak" silver, "🥇 Emas" gold, "💎 Platinum" platinum), `sort` ("Jumlah Syiling" `total_syiling_earned` default, "Baki Syiling" `current_syiling`, "Baki Token" `token_balance`, "Level" `level`), "Cari" (`fa-search`). Live (OBSERVED, audit 2026-09-26): the select keeps the chosen value and the page links carry `sort`, but every value lists rows by lifetime syiling. Rebuild: each option sorts descending by the field its label names, ties by lifetime syiling then wallet creation (DV-M14-14) | S4-003–007 | Admin | OBSERVED (form) + DV-M14-14 (sort) |
| FN-M14-9.4.3 | Card "🎁 Berikan Bonus Syiling" (POST `award-syiling`): "User ID" `user_id` (number, placeholder "ID", required), "Jumlah" `amount` (min 1, max 10000, placeholder "100", required), "Sebab" `reason` (placeholder "Bonus khas / Pertandingan", required), "Berikan" (`fa-gift`) | S4-008–018 | Admin | OBSERVED |
| FN-M14-9.4.4 | Table "Pelajar \| Tier \| Level \| Syiling \| Token \| Jumlah Syiling \| XP", 20 rows a page: name over e-mail, `tier-badge` with the lower-case key in the tier colour on the colour + "20" alpha, level, balance, tokens (negative seed values shown as stored, DV-M14-10), lifetime, XP | S4-019–021, 042, 046 | Admin | OBSERVED |
| FN-M14-9.4.5 | Laravel pager: "Showing {from} to {to} of {total} results", numbered links with "..." and arrows from 640 px; "« Previous" / "Next »" only below 640 px; filters kept in the page links | S4-022–041, 043–044 | Admin | OBSERVED |
| FN-M14-9.4.6 | Empty text "Belum ada pelajar dalam sistem gamifikasi" | S4-045 | Admin | OBSERVED |

**FT-M14-9.5 — Coin transactions S5 `/admin/gamification/transactions`**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M14-9.5.1 | h1 "📋 Transaksi Syiling", "Log semua transaksi syiling dalam sistem" | S5-001–002 | Admin | OBSERVED |
| FN-M14-9.5.2 | GET filter form: `type` ("Semua Jenis", "💰 Dapat" earn, "🛍️ Belanja" spend, "🔄 Tukar" convert, "🎁 Bonus" bonus, "↩️ Refund" refund), `date_from` ("Dari"), `date_to` ("Hingga"), "Tapis" (`fa-filter`); "Reset" → S5 shown only while a filter is set | S5-003–007, 031 | Admin | OBSERVED |
| FN-M14-9.5.3 | Table "ID \| Pelajar \| Jenis \| Jumlah \| Baki Selepas \| Sumber \| Keterangan \| Tarikh", 25 rows a page, newest first: "#{id}", name over "ID:{userId}", `type-badge` raw key, green "+n" / red "−n", balance after, raw source key, description, "dd/mm/yyyy HH:mm" | S5-008–010, 035–037 | Admin | OBSERVED |
| FN-M14-9.5.4 | Laravel pager as FN-M14-9.4.5 (52,964 rows → 2,119 pages) | S5-011–030, 033–034 | Admin | OBSERVED |
| FN-M14-9.5.5 | Empty text "Tiada transaksi ditemui" (e.g. refund) | S5-032 | Admin | OBSERVED |

### EP-M14-10 — Teacher gamification (S19–S22)


**FT-M14-10.1 — Teacher dashboard S19 `/guru/gamifikasi`**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M14-10.1.1 | Four cards: "{balance}" "Baki Syiling", "{totalEarned}" "Jumlah Diperolehi", "{questionsCount}" "Soalan Disumbang", "{earned}/{active badges}" "Lencana" (admin 92,683 / 92,683 / 20,719 / 7/8) | S19-004–015 | Guru; Admin | OBSERVED |
| FN-M14-10.1.2 | "Lencana Pencapaian": one tile per active teacher badge — name, "{threshold} soalan", "+{bonus} syiling"; earned tiles emerald (`bg-emerald-50`), not-earned tiles red-50 | S19-016–041 | Guru; Admin | OBSERVED |
| FN-M14-10.1.3 | Next badge: "Seterusnya: {name}" (`fa-crown`), "{questionsCount} / {threshold}" with a bar, "{threshold − questionsCount} soalan lagi untuk bonus {bonus} syiling" (admin "29,281 soalan lagi untuk bonus 250,000 syiling"); hidden when every badge is earned (INFERRED) | S19-042–044 | Guru; Admin | OBSERVED / INFERRED |
| FN-M14-10.1.4 | "Katalog Ganjaran": with no active reward "Tiada ganjaran tersedia buat masa ini" / "Admin akan menambah ganjaran tidak lama lagi!"; with rewards, one card per active reward (PROPOSED layout, provisional) | S19-045–048 | Guru; Admin | OBSERVED / PROPOSED |
| FN-M14-10.1.5 | "Sejarah Transaksi": teacher ledger rows newest first — description, "dd MMM yyyy, HH:mm" (English month, as live: "19 May 2026, 03:49"), signed amount ("0", "+7", "+50,000") | S19-049–059 | Guru; Admin | OBSERVED |
| FN-M14-10.1.6 | Buttons "Tebus Tunai" → S20, "Kedai Hadiah" → S21, "Papan Pendahulu" (`fa-ranking-star`) → S22, "Sumbang Soalan (+10 syiling)" → `/guru/soalan/cipta` (M10); the "+10" follows `coins_per_question` | S19-060–063 | Guru; Admin | OBSERVED |

**FT-M14-10.2 — Cash-out S20 `/guru/gamifikasi/tebus-tunai`**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M14-10.2.1 | Cards "{balance}" "Jumlah Syiling", "{available}" "Boleh Ditebus", "{held}" "Dalam Proses", "RM{value}" "Nilai Tunai" (admin 92,683 / 92,683 / 0 / RM741.46); available = balance − held, held = Σ coins of own PENDING / APPROVED / PROCESSING requests (INFERRED, Q6); value = balance ÷ `cash_rate_coins` × `cash_rate_sen` ÷ 100 | S20-004–015 | Guru; Admin | OBSERVED / INFERRED |
| FN-M14-10.2.2 | "Maklumat": "Tukar syiling anda kepada wang tunai", "Minimum tebus: {min_cash_withdrawal} syiling" | S20-016–019 | Guru; Admin | OBSERVED |
| FN-M14-10.2.3 | "Borang Tebus Tunai" `#tebusTunaiForm`: "Jumlah Syiling" `coins_amount` (placeholder "Masukkan jumlah syiling...", min = `min_cash_withdrawal`, max = available, step 1, required) with "Min: 100" and "Max: {available}" | S20-020–027 | Guru; Admin | OBSERVED |
| FN-M14-10.2.4 | Quick buttons "100 syiling", "500 syiling", "1,000 syiling", "5,000 syiling", "Semua ({available})" set the amount; they stay enabled above the maximum (the submit is then disabled, as live) | S20-028–032 | Guru; Admin | OBSERVED |
| FN-M14-10.2.5 | Preview `#cashPreview` "Anda akan menerima" "RM{cash}" (2 decimals) shown only when min ≤ coins ≤ max (500 → "RM4.00"; 50 → hidden) | S20-033–034, 047 | Guru; Admin | OBSERVED |
| FN-M14-10.2.6 | "Maklumat Akaun Bank" (`fa-university`): "Nama Bank" `bank_name` (required; "-- Pilih Bank --" + 24 banks and e-wallets of discovery A.6, duplicates kept as live), "No. Akaun Bank" `bank_account` (placeholder "Cth: 1234567890", required), "Nama Pemilik Akaun" `account_holder` (placeholder "Nama seperti dalam akaun bank", required) | S20-035–041 | Guru; Admin | OBSERVED |
| FN-M14-10.2.7 | "Hantar Permohonan Tebus Tunai" (`fa-paper-plane`): disabled unless min ≤ coins ≤ max; on submit the confirm "Sahkan tebus tunai?\n\n{coins} syiling = RM{cash}\n\nTeruskan?"; confirmed → a PENDING request, the S20 history row and a success message (PROPOSED COPY); refused when `cash_withdrawal_enabled` = 0 (PROPOSED message) | S20-042 | Guru; Admin | OBSERVED (confirm) / INFERRED / PROPOSED |
| FN-M14-10.2.8 | "Sejarah Tebus Tunai": own requests newest first (PROPOSED row layout: date, syiling, RM, bank name, status pill as S8); empty "Tiada rekod tebus tunai lagi" | S20-043–045 | Guru; Admin | OBSERVED / PROPOSED |
| FN-M14-10.2.9 | "Kembali ke Dashboard" → S19 | S20-046 | Guru; Admin | OBSERVED |

**FT-M14-10.3 — Teacher reward shop S21 `/guru/gamifikasi/kedai`**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M14-10.3.1 | h1 "🎁 Kedai Hadiah Guru", "Tebus syiling anda untuk hadiah menarik!", "{balance}" "Baki Syiling" (`fa-coins`), link "Dashboard" → S19 | S21-004–008 | Guru; Admin | OBSERVED |
| FN-M14-10.3.2 | Empty state (no active reward): "🎁", "Tiada Hadiah Tersedia", "Admin akan menambah hadiah tidak lama lagi. Tunggu ya!", "Dashboard Gamifikasi" → S19 | S21-009–012 | Guru; Admin | OBSERVED |
| FN-M14-10.3.3 | Reward cards and redemption (PROPOSED, provisional; no live item): one card per active reward (name, category, "{cost} syiling", stock); "Tebus" (PROPOSED) creates a PENDING redemption, holds the cost until DELIVERED (debit) or CANCELLED (release), refused above stock, `max_per_user`, `max_per_month` or the balance | — | Guru | PROPOSED / INFERRED |

**FT-M14-10.4 — Teacher leaderboard S22 `/guru/gamifikasi/leaderboard`**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M14-10.4.1 | Tabs "Sekolah Saya" `?tab=sekolah` (`fa-school`, default) and "Seluruh Malaysia" `?tab=global` (`fa-globe`); active tab indigo-600 | S22-004–005 | Guru; Admin | OBSERVED |
| FN-M14-10.4.2 | Table "# \| Guru \| Soalan \| Syiling" ("# \| Guru \| Sekolah \| Soalan \| Syiling" on the global tab; headers upper case by CSS), at most 50 rows; ranks 1–3 are 🥇🥈🥉 | S22-006–007, 009 | Guru; Admin | OBSERVED |
| FN-M14-10.4.3 | "Kembali ke Dashboard" (`fa-arrow-left`) → S19 | S22-008 | Guru; Admin | OBSERVED |
| FN-M14-10.4.4 | Ranking: users with role `teacher` (the admin is not listed, INFERRED) by `questionsCount` descending, ties by user id; "Syiling" = teacher balance; "Sekolah Saya" = teachers of the viewer's school when the viewer is a teacher; for any other viewer (the admin, whose seed school is 900002) every teacher, as the live admin view shows (OBSERVED for the admin; INFERRED rule) | — | Guru; Admin | OBSERVED / INFERRED |

**FT-M14-10.5 — Teacher earning rules (behaviour)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M14-10.5.1 | Contribution: each question a teacher creates through M10 adds +1 to `questionsCount` and +`coins_per_question` (10) to the teacher wallet (row "Sumbang Soalan #{questionId}", PROPOSED COPY; INFERRED from the button "+10 syiling" and the S22 row 1 soalan / 10 syiling, Q5); deleting a question never decrements `questionsCount` or takes coins back (INFERRED: live keeps 20,719; provisional) | — | Guru | INFERRED / PROPOSED |
| FN-M14-10.5.2 | Badge bonus: when `questionsCount` reaches an active badge threshold, the badge is earned once and the wallet gets +bonus_coins with the row "Badge: {name} ({threshold} soalan)" (OBSERVED rows) | — | Guru | OBSERVED (rows) / INFERRED (trigger) |
| FN-M14-10.5.3 | Cash request lifecycle (INFERRED, provisional): PENDING, APPROVED and PROCESSING hold the coins (not debited); PAID debits them (row "Tebus Tunai #{id}", PROPOSED COPY); REJECTED releases them | — | Guru; Admin | INFERRED / PROPOSED |

### EP-M14-11 — Admin teacher gamification (S6–S9)


**FT-M14-11.1 — Teacher gamification summary S6 `/admin/gamifikasi/guru`**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M14-11.1.1 | Four cards "Jumlah Ganjaran" (catalogue rows), "Aktif" (active rewards), "Lencana" (badges), "Tebusan Pending" (PENDING redemptions) — 0 / 0 / 8 / 0 | S6-001–012 | Admin | OBSERVED |
| FN-M14-11.1.2 | Links "Tebusan Hadiah" (`fa-receipt`) → S7 and "Tebus Tunai" (`fa-money-bill-wave`) → S8 with a red count badge = PENDING cash requests ("2") | S6-013–015 | Admin | OBSERVED |

**FT-M14-11.2 — Teacher badges**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M14-11.2.1 | Card "Lencana Guru ({n})", table "Lencana \| Ikon \| Threshold \| Bonus \| Status \| Tindakan": name, Font Awesome icon (amber), threshold, "+{bonus}", status pill "Aktif" (emerald; "Tidak Aktif" slate for inactive, PROPOSED COPY) | S6-016–020, 036–037, 053–054, 070–071, 087–088, 104–105, 121–122, 138–139 | Admin | OBSERVED |
| FN-M14-11.2.2 | "Edit" (`fa-edit`) toggles the row's edit form (`editing`); a second click hides it and **keeps** typed values (x-show; INFERRED); there is no "Batal" | S6-021, 038, 055, 072, 089, 106, 123, 140 | Admin | OBSERVED / INFERRED |
| FN-M14-11.2.3 | Edit form (PUT `/lencana/{id}`): "Nama" `name`, "Ikon CSS" `icon`, "Threshold" `threshold`, "Bonus Syiling" `bonus_coins`, "Aktif" `is_active` checkbox, "Simpan" | S6-022–035, 039–052, 056–069, 073–086, 090–103, 107–120, 124–137, 141–154 | Admin | OBSERVED |

**FT-M14-11.3 — Teacher reward catalogue**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M14-11.3.1 | Card "Katalog Ganjaran ({n})"; empty text "Tiada ganjaran. Tambah ganjaran pertama!" | S6-155–156, 179 | Admin | OBSERVED |
| FN-M14-11.3.2 | "Tambah Ganjaran" (`fa-plus`) toggles the create form (`showForm`; values kept when hidden) | S6-157 | Admin | OBSERVED |
| FN-M14-11.3.3 | Create form (POST multipart `/guru/ganjaran`): "Nama *" `name` (required), "Kategori *" `category` ("Am" general / "Digital" / "Fizikal" physical / "Baucar" voucher), "Kos Syiling *" `cost_coins` (min 1, required), "Stok (kosong = tiada had)" `stock` (min 0), "Had/Pengguna" `max_per_user` (min 1), "Had/Bulan" `max_per_month` (min 1), "Penerangan" (textarea, 2 rows), "Gambar" `image` (`accept="image/*"`; **v1.6, prototype validation:** only png, jpeg or webp up to 5 MB are accepted by the mock, SVG and other types are refused), "Aktif" (checked), "Simpan" | S6-158–178 | Admin | OBSERVED |
| FN-M14-11.3.4 | Catalogue rows after a create (PROPOSED layout, provisional): name, category label, cost, stock ("∞" when empty), limits, status pill | — | Admin | PROPOSED |

**FT-M14-11.4 — Teacher redemption queue S7 `/admin/gamifikasi/guru/tebusan`**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M14-11.4.1 | Status pills "Menunggu" `?status=PENDING` (default, indigo active), "Diproses" PROCESSING, "Dihantar" DELIVERED, "Dibatal" CANCELLED, "Semua" all | S7-001–005 | Admin | OBSERVED |
| FN-M14-11.4.2 | Empty texts: "Tiada tebusan pending" / "Tiada tebusan processing" / "Tiada tebusan delivered" / "Tiada tebusan cancelled" (status lower-cased into the text) and "Tiada tebusan" (all) | S7-006, 008–011 | Admin | OBSERVED |
| FN-M14-11.4.3 | "Kembali ke Gamifikasi Guru" (`fa-arrow-left`) → S6 | S7-007 | Admin | OBSERVED |
| FN-M14-11.4.4 | Redemption rows and actions (PROPOSED, provisional; no live row): teacher, reward, cost, status, date; status changes are forward only — PENDING → PROCESSING → DELIVERED, or PENDING / PROCESSING → CANCELLED; DELIVERED and CANCELLED are final and any other move is refused (v1.6); the cost is debited and the stock reduced once, on DELIVERED, after the balance and the stock are checked | — | Admin | PROPOSED |

**FT-M14-11.5 — Teacher cash requests S8 `/admin/gamifikasi/guru/tunai`**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M14-11.5.1 | Cards "Menunggu" (PENDING count), "Diluluskan" (APPROVED count), "Dibayar" (PAID count), "Jumlah Dibayar" (Σ cash of PAID, "RM0.00") — 2 / 0 / 0 / RM0.00 | S8-001–012 | Admin | OBSERVED |
| FN-M14-11.5.2 | Status pills `?status=` "Menunggu" PENDING (default), "Diluluskan" APPROVED, "Dalam Proses" PROCESSING, "Dibayar" PAID, "Ditolak" REJECTED, "Semua" all (active blue-600) | S8-013–018 | Admin | OBSERVED |
| FN-M14-11.5.3 | Table "Guru \| Syiling \| Tunai \| Bank \| Status \| Tarikh \| Tindakan": teacher name, coins, "RM{cash}", bank name over the **masked** account number and holder (SEC-M14-04), status pill (PENDING yellow-100/700; other colours PROPOSED), "d MMM yyyy HH:mm" ("15 Apr 2026 13:15"); empty statuses show no row (live) | S8-019–021 | Admin | OBSERVED + SEC |
| FN-M14-11.5.4 | Row form (PATCH `/tunai/{id}`): `status` select (PENDING, APPROVED, PROCESSING, PAID, REJECTED; any value may be chosen, as live), `admin_note` (placeholder "Nota..."), ✓ (`fa-check`) with the confirm "Kemaskini status?"; the note is shown under the status after saving (PROPOSED) | S8-022–027 | Admin | OBSERVED / PROPOSED |
| FN-M14-11.5.5 | Links "Tetapan" (`fa-cog`) → S9 and "Ganjaran" (`fa-gift`) → S6 | S8-028–029 | Admin | OBSERVED |

**FT-M14-11.6 — Gamification settings S9 `/admin/gamifikasi/pengaturan`**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M14-11.6.1 | One POST form with the card "Tetapan Gamifikasi Guru" | S9-001–004 | Admin | OBSERVED |
| FN-M14-11.6.2 | Ten setting rows, each label, "Key: {key}" (code) and an input `settings[i][value]` (number, min 0, step 1) or an "Aktif" (1) / "Tidak Aktif" (0) select, with hidden `settings[i][key]`: coins_per_question 10, cash_rate_coins 10, min_cash_withdrawal 100, cash_withdrawal_enabled Aktif, reward_budget_sen_session 1000 ("Had nilai-kos tebus per pelajar per sesi (sen) — RM10"), reward_budget_sen_month 300 ("Sub-had nilai-kos tebus per pelajar per bulan (sen) — RM3"), current_session_year 2026, flat_quiz_reward 1, games_award_syiling Tidak Aktif | S9-005–014, 020–054 | Admin | OBSERVED |
| FN-M14-11.6.3 | Row `cash_rate_sen` 8 with the label "Nilai sen bagi setiap unit syiling (cth: 10 syiling = 8 sen)" (DV-M14-05; live "(cth: 100 syiling = 8 sen)") | S9-015–019 | Admin | OBSERVED + DV-M14-05 |
| FN-M14-11.6.4 | "Pratonton Kadar" (`fa-calculator`) `#ratePreview`, rebuilt on input: "**{coins_per_question} syiling** per soalan sumbangan", "**{cash_rate_coins} syiling = {cash_rate_sen} sen** (RM{sen ÷ 100})", "100 syiling = RM{…} · 1000 syiling = RM{…}", "Minimum tebus: **{min} syiling**"; a 0 or empty value falls back to 10 / 100 / 8 / 100 (live script) | S9-055–059 | Admin | OBSERVED |
| FN-M14-11.6.5 | "Simpan Tetapan" (`fa-save`) saves the ten values; S10 shows the same five shared keys | S9-060 | Admin | OBSERVED / INFERRED |
| FN-M14-11.6.6 | Links "Ganjaran Guru" (`fa-gift`) → S6, "Tebus Tunai" (`fa-money-bill-wave`) → S8, "Tebusan" (`fa-receipt`) → S7 | S9-061–063 | Admin | OBSERVED |

### EP-M14-12 — Reward economy control and cabutan admin (S10 `/admin/reward-control`)


**FT-M14-12.1 — Liability tiles**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M14-12.1.1 | Tiles (labels upper case by CSS: "LIABILITI SESI 2026", "PELAJAR MENEBUS", "JUMLAH TEBUSAN") "Liabiliti sesi {current_session_year}" "RM{Σ real cost}" "jumlah kos hadiah ditebus", "Pelajar menebus" (distinct students), "Jumlah tebusan" (count) over the claims of the syiling-priced reward catalogue in the session year, using `cost_value_sen` (INFERRED from the same page and unit, XR-M15-07; the legacy ledger row #42 is not a claim record): RM0.00 / 0 / 0; OQ-M14-05 closed | S10-001–007 | Admin | OBSERVED (values) / INFERRED |

**FT-M14-12.2 — Finance settings**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M14-12.2.1 | "⚙️ Tetapan Kewangan" (POST `settings`): "Bajet tebus / sesi (sen) — RM10 = 1000" `reward_budget_sen_session`, "Sub-had tebus / bulan (sen) — RM3 = 300" `reward_budget_sen_month`, "Syiling flat / soalan betul" `flat_quiz_reward`, "Tahun sesi semasa" `current_session_year`, checkbox "Mini-games beri syiling? (jika tidak: XP sahaja — tutup exploit)" `games_award_syiling` (unchecked), "Simpan Tetapan"; no field is required; the keys are shared with S9 | S10-008–021 | Admin | OBSERVED |

**FT-M14-12.3 — Real reward cost**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M14-12.3.1 | "🎁 Kos Sebenar Hadiah (sen) — digital = 0, tak makan bajet": table "Hadiah \| Jenis \| Harga syiling \| Kos sebenar (sen) \| " over the 11-row syiling-priced reward catalogue (ids 1–11): per row a form (POST `reward/{id}/cost`) with `cost_value_sen`, the "RM" equivalent and "Simpan" | S10-022–035 | Admin | OBSERVED |

**FT-M14-12.4 — Cabutan (lucky draw) administration**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M14-12.4.1 | "🎟️ Cabutan": table "# \| Tajuk \| Status \| Tiket \| Kolam \| Pemenang \| " with "Tiada cabutan lagi." when no draw exists | S10-036–037 | Admin | OBSERVED |
| FN-M14-12.4.2 | `<details>` "➕ Cipta Cabutan Baru" (closed by default; values kept when closed) | S10-038 | Admin | OBSERVED |
| FN-M14-12.4.3 | Create form (POST `draw`): "Tajuk" `title` (required), "Penerangan", "Harga tiket (syiling)" (50), "Max tiket / pelajar" (10), "Kolam hadiah (JSON)" textarea (placeholder `[{"label":"Baucar Topup RM50","value_sen":5000,"qty":1},{"label":"Baucar RM5","value_sen":500,"qty":10}]`), "Tarikh tutup" (date), "Buka serta-merta" checkbox, "Cipta Cabutan" | S10-039–055 | Admin | OBSERVED |
| FN-M14-12.4.4 | Draw rows after a create (PROPOSED, provisional): "#{id}", title, status key (`draft` / `open` / `closed`), tickets sold, prize units (Σ qty), winners ("—"); the last column stays empty (no live action observed) | — | Admin | PROPOSED |
| FN-M14-12.4.5 | Open draws (status `open` and `closes_at` today or later, Asia/Kuala_Lumpur) are listed to students by M15 S7 through the M14 draw contract (XR-M15-03); tickets are bought with syiling (FN-M14-8.3.5); winner drawing is not observable and not built (Q-M15-5) | — | Pelajar; Admin | INFERRED |

### EP-M14-13 — Cross-cutting (responsive, readability, formats, privacy)


**FT-M14-13.1 — Cross-cutting rules**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M14-13.1.1 | Every M14 screen fits 320–1920 px without horizontal page scroll; wide tables (S1, S4, S5, S6, S8, S10, S22) scroll inside their card below 768 px (as live); S14 at 375 px no longer overflows by 1 px (DV-M14-07) | — | All | OBSERVED + DV-M14-07 |
| FN-M14-13.1.2 | Text under 12 px on live (S2 L1–L5 and "Jawab Betul"/"Menang", S3/S4/S5 badges, S6 table, S11 difficulty badges, S13, S15 reward/rarity/progress, S18 card labels, S19 tiles) is raised to 12 px (DV-M14-11) | — | All | OBSERVED + DV-M14-11 |
| FN-M14-13.1.3 | Small controls keep their live visual size (S6 "Edit" 37×16, S8 select/note/✓, S10 "Simpan" 66×24 and checkbox, S1/S11 "Lihat semua →"); NFR-RESP-03 applies through a 44 px hit area (M07/M09 precedent) | — | All | OBSERVED |
| FN-M14-13.1.4 | Formats: ms-MY thousands separators on figures (as live); S5/S17 "dd/mm/yyyy HH:mm"; S8 "d MMM yyyy HH:mm" and S19 "dd MMM yyyy, HH:mm" with English month abbreviations (as live); relative times "{n} minit/jam/hari/bulan yang lepas"; RM with 2 decimals | — | All | OBSERVED |
| FN-M14-13.1.5 | Privacy: every person name in seeds is fictitious; avatars are initials; bank account numbers and holders are masked on S8 (SEC-M14-04); share cards use the viewer's own name and id only | — | All | privacy rule |
| FN-M14-13.1.6 | Accessibility replicates live (D10): no ARIA, keyboard or motion behaviour beyond the live markup | — | All | D10 |

---

## 4. User stories

Values in the ACs come from the seed (SRS §6.11). "The admin" = `admin@demo.test` (id 1; mirrors live). "The student" = `pelajar@demo.test` (id 2; designed wallet 370 syiling, 916 XP, level 1, streak 2 / best 2). "pelajarmaju" = id 4 (designed wallet 267 syiling, 432 XP, level 3, streak 3 / best 3, 3 achievements unlocked). "pelajar2" = id 3 (no wallet row → defaults). "The teacher" = `guru@demo.test` (id 5; teacher wallet 0, 1 contributed question). Every AC runs at the single project clock `2026-09-25T15:40:00+08:00` unless it moves the clock itself (`advanceTime`). E2E run at 375×812, 768×1024 and 1280×800. **(provisional)** marks an AC that asserts INFERRED/PROPOSED behaviour.

| ID | Feature | MoSCoW | Story | Functions |
|---|---|---|---|---|
| US-M14-01 | FT-M14-1.1 | Must | As a user, I want the gamification entries in my menu and the right page titles, so that I can find each screen and know where I am. | FN-M14-1.1.1–1.1.7 |
| US-M14-02 | FT-M14-1.2 | Must | As the owner, I want M14 closed to guests and to the wrong roles, `/kombo` to lead to the dashboard and bad addresses to behave like live, so that the area is predictable. | FN-M14-1.2.1–1.2.5 |
| US-M14-03 | FT-M14-1.3 | Must | As a student, I want my coins, points and streak to show the same numbers everywhere, so that I trust the reward system. | FN-M14-1.3.1–1.3.5 |
| US-M14-04 | FT-M14-2.1 | Must | As a student, I want my tier, level, balances and progress to the next tier on the gamification dashboard, so that I know where I stand. | FN-M14-2.1.1–2.1.5 |
| US-M14-05 | FT-M14-2.1 | Must | As a student, I want today's challenges, my latest transactions, my subject mastery, the tier system and my next title on the dashboard, so that I see what to do next. | FN-M14-2.1.6–2.1.11 |
| US-M14-06 | FT-M14-2.2 | Must | As a student, I want the full history of my coin transactions with a type filter, so that I can check every change to my balance. | FN-M14-2.2.1–2.2.4 |
| US-M14-07 | FT-M14-3.1 | Must | As a student, I want a conversion screen that previews how many tokens I will get at my tier rate, so that I can decide how much to convert. | FN-M14-3.1.1–3.1.4, 3.1.6, 3.1.7 |
| US-M14-08 | FT-M14-3.1 | Must | As a student, I want the convert button enabled only for a valid amount and my balances updated after converting, so that I cannot convert more than I have. | FN-M14-3.1.5, 3.1.8 |
| US-M14-09 | FT-M14-4.1 | Must | As a student, I want to see today's challenges with their rewards and my progress, so that I know which ones I can still finish. | FN-M14-4.1.1, 4.1.2 |
| US-M14-10 | FT-M14-4.2 | Must | As a student, I want my practice to move challenge progress and pay the reward once a day, so that challenges are fair. | FN-M14-4.2.1–4.2.4 |
| US-M14-11 | FT-M14-5.1 | Must | As a student, I want a leaderboard of the top 50 by lifetime syiling, so that I can compare myself with the best. | FN-M14-5.1.1–5.1.5 |
| US-M14-12 | FT-M14-6.1 | Must | As a student, I want to see my streak and all 25 achievements with their rewards, filterable by rarity, so that I know what to aim for. | FN-M14-6.1.1–6.1.4 |
| US-M14-13 | FT-M14-6.1 | Should | As a student, I want to share an unlocked achievement as an image or on WhatsApp, so that I can show my friends. | FN-M14-6.1.5–6.1.8 |
| US-M14-14 | FT-M14-6.1 | Should | As a student, I want achievements to unlock and pay their reward when I reach them, so that my effort is recognised. | FN-M14-6.1.9 |
| US-M14-15 | FT-M14-6.2 | Should | As a student, I want share cards for my profile, streak, mastery and standing that I can download or send on WhatsApp, so that I can share my progress. | FN-M14-6.2.1–6.2.7 |
| US-M14-16 | FT-M14-7.1 | Should | As a student, I want my referral code with copy and share buttons and my referral statistics, so that I can invite friends. | FN-M14-7.1.1–7.1.5 |
| US-M14-17 | FT-M14-7.1 | Could | As a student, I want my friend and me to receive the promised syiling when my friend registers with my code, so that inviting is worthwhile. | FN-M14-7.1.6 |
| US-M14-18 | FT-M14-8.1 | Must | As a student, I want syiling and points for every completed session, recorded in my history, so that practice is rewarded. | FN-M14-8.1.1, 8.1.2 |
| US-M14-19 | FT-M14-8.1 | Must | As a student, I want my kombo to count the days I study in a row, with the daily activity bonus, so that I keep my habit. | FN-M14-8.1.3–8.1.5 |
| US-M14-20 | FT-M14-8.1 | Should | As a teacher who also practises, I want my practice recorded in my teacher wallet too, so that my teacher history is complete. | FN-M14-8.1.6 |
| US-M14-21 | FT-M14-8.2 | Must | As a student, I want my tier and title to follow my syiling, so that my progress is visible. | FN-M14-8.2.1–8.2.3 |
| US-M14-22 | FT-M14-8.3 | Must | As the owner, I want awards, game rewards, token spending, mystery boxes, cabutan tickets and claims to change the wallet safely, so that balances never go wrong. | FN-M14-8.3.1–8.3.7 |
| US-M14-23 | FT-M14-9.1 | Must | As an admin, I want an overview of students, coins, tokens, conversions, challenges, the tier distribution, the top 10 and the latest transactions, so that I can monitor the economy. | FN-M14-9.1.1–9.1.5 |
| US-M14-24 | FT-M14-9.2 | Must | As an admin, I want to edit, deactivate and add tiers with their thresholds, rates and per-answer rewards, so that I can tune the economy. | FN-M14-9.2.1–9.2.8 |
| US-M14-25 | FT-M14-9.3 | Must | As an admin, I want to edit, deactivate, delete and add daily challenges, so that students get fresh goals. | FN-M14-9.3.1–9.3.7 |
| US-M14-26 | FT-M14-9.4 | Must | As an admin, I want to search and filter students' wallets and give a bonus with a reason, so that I can reward special cases. | FN-M14-9.4.1–9.4.6 |
| US-M14-27 | FT-M14-9.5 | Must | As an admin, I want the full coin ledger with type and date filters, so that I can audit transactions. | FN-M14-9.5.1–9.5.5 |
| US-M14-28 | FT-M14-10.1 | Must | As a teacher, I want my coin balance, contributions, badges, rewards and history on one page, so that I see what my contributions earned. | FN-M14-10.1.1–10.1.6 |
| US-M14-29 | FT-M14-10.2 | Must | As a teacher, I want to request a cash payout of my syiling to my bank account with a live preview, so that I can cash out safely. | FN-M14-10.2.1–10.2.9 |
| US-M14-30 | FT-M14-10.3 | Should | As a teacher, I want a reward shop where I can spend syiling, so that I have another use for my coins. | FN-M14-10.3.1–10.3.3 |
| US-M14-31 | FT-M14-10.4 | Should | As a teacher, I want a leaderboard of contributors in my school and nationwide, so that I can compare contributions. | FN-M14-10.4.1–10.4.4 |
| US-M14-32 | FT-M14-10.5 | Should | As a teacher, I want coins for each contributed question, badge bonuses at thresholds and a clear payout lifecycle, so that my balance is predictable. | FN-M14-10.5.1–10.5.3 |
| US-M14-33 | FT-M14-11.1 / 11.2 | Must | As an admin, I want the teacher gamification summary and to edit the teacher badges, so that I can manage teacher incentives. | FN-M14-11.1.1, 11.1.2, 11.2.1–11.2.3 |
| US-M14-34 | FT-M14-11.3 | Should | As an admin, I want to add teacher rewards to the catalogue, so that teachers can redeem them. | FN-M14-11.3.1–11.3.4 |
| US-M14-35 | FT-M14-11.4 | Should | As an admin, I want a queue of teacher reward redemptions by status, so that I can process them. | FN-M14-11.4.1–11.4.4 |
| US-M14-36 | FT-M14-11.5 | Must | As an admin, I want to review and update teacher cash requests by status with a note, so that payouts are tracked. | FN-M14-11.5.1–11.5.5 |
| US-M14-37 | FT-M14-11.6 | Must | As an admin, I want to set the coin, cash-out and budget settings with a live rate preview, so that I control the rates. | FN-M14-11.6.1–11.6.6 |
| US-M14-38 | FT-M14-12.1 / 12.2 | Must | As an admin, I want the reward liability of the school year and the finance settings on one screen, so that I control the reward budget. | FN-M14-12.1.1, 12.2.1 |
| US-M14-39 | FT-M14-12.3 | Should | As an admin, I want to record the real cost of each syiling-priced reward, so that liability is correct. | FN-M14-12.3.1 |
| US-M14-40 | FT-M14-12.4 | Should | As an admin, I want to create lucky draws with ticket price, limit, prize pool and closing date, so that students can join them. | FN-M14-12.4.1–12.4.5 |
| US-M14-41 | FT-M14-13.1 | Must | As a user on a phone, tablet or desktop, I want every M14 screen to fit, be readable and be usable by touch, with correct formats and no real names, so that I can use it anywhere. | FN-M14-13.1.1–13.1.6 |

### Acceptance criteria

**US-M14-01 — Menu, titles and shells**
- **AC-M14-01.1** Given the admin at 1280px on a user-portal page, when the sidebar renders, then "Syiling & Token 🏆" (`fa-coins`) → `/gamification`, "Tukar Token" → `/gamification/convert`, "Cabaran Harian" → `/gamification/challenges`, "Papan Pendahulu" → `/gamification/leaderboard`, "Pencapaian" → `/gamification/achievements`, "Rujuk Kawan" → `/gamification/referral` and "Kombo" (`fa-fire`) → `/kombo` are present with their icons; at 375px the drawer group "Gamifikasi" lists "Syiling & Token", "Tukar Token", "Cabaran Harian", "Papan Pendahulu", "Pencapaian", "Rujuk Kawan", and the drawer has "Syiling & Ganjaran" → `/guru/gamifikasi`.
- **AC-M14-01.2** Given the admin panel at 1280px, when the group "Gamifikasi" is open, then it lists "Overview", "Tier Config", "Cabaran", "Pelajar", "Transaksi", "Kedai Hadiah", "Gamifikasi Guru", "Kawalan Reward" with the targets of FN-M14-1.1.4, and "Streak / Kombo" → `/kombo` is in the sidebar; below 1024px the "Lagi" list shows "Overview", "Tier Config", "Cabaran", "Kedai Hadiah", "Gamifikasi Guru".
- **AC-M14-01.3** Given S1–S5, when each loads, then the header reads "Gamifikasi Overview", "Tier Configuration", "Cabaran Harian", "Pelajar Gamifikasi", "Transaksi Syiling" with "Selamat datang, Admin" (DV-M14-01), never "Dashboard".
- **AC-M14-01.4** Given S11–S17, when each loads, then the header reads "Gamifikasi Dashboard", "Tukar Syiling → Token", "Cabaran Harian", "Papan Pendahulu", "Pencapaian Anda", "Rujuk Kawan, Dapat Syiling!", "Sejarah Transaksi" with "Selamat datang kembali" (DV-M14-01).
- **AC-M14-01.5** Given S6–S10 and S18–S22, when each loads, then the header shows the live title and subtitle of FN-M14-1.1.5 (e.g. S8 "Tebus Tunai Guru" / "Urus permohonan pengeluaran tunai guru", S22 "Papan Pendahulu" / "Siapa penyumbang soalan terbanyak?").
- **AC-M14-01.6** Given each of S1–S22, when it loads, then the tab title is the exact text of FN-M14-1.1.6 and S1–S10 render in the admin panel shell, S11–S22 in the user-portal shell.

**US-M14-02 — Access, redirects and errors**
- **AC-M14-02.1** Given no session, when I open `/gamification`, `/gamification/convert`, `/guru/gamifikasi` or `/admin/gamification`, then I am sent to `/login` (provisional).
- **AC-M14-02.2** Given the student, when I open `/admin/gamification` or `/admin/reward-control`, then I land on my M01 landing page; when I open `/guru/gamifikasi`, then I land on my M01 landing page (provisional).
- **AC-M14-02.3** Given the admin (and the student, provisional), when I open `/kombo`, then I end on `/dashboard` (M05 S1) without an M14 page.
- **AC-M14-02.4** Given the admin, when I open `/gamification/leaderboard?period=week`, then the list is identical to `/gamification/leaderboard`; `/guru/gamifikasi/leaderboard?tab=zzz` renders as the "Sekolah Saya" tab; `/gamification/achievements?rarity=zzz` shows the pills and no card and no message; `/gamification/history?type=zzz` shows the empty state.
- **AC-M14-02.5** Given the admin, when I open `/gamification/xyz` or `/admin/gamifikasi/xyz`, then the global 404 page renders (provisional).

**US-M14-03 — One wallet, one streak**
- **AC-M14-03.1** Given the admin at 1280px, when any user-portal page loads, then the header chips read "256" "koin", "8" "mata", "1" "hari 🔥"; at 375px the chips strip shows 256 / 8 / 1 with "🔥".
- **AC-M14-03.2** Given the admin, when I open S11, S12, S17, M05 `/dashboard` and S4 filtered to the admin, then each shows 256 syiling; S15 and S18 "Kombo" show streak **1** and best **5** (DV-M14-08), equal to the header and to M08 `/prestasi/1` "Kombo Hari 1" / "Rekod Terbaik 5".
- **AC-M14-03.3** Given the admin, when I open M08 `/pelajar/1` and `/prestasi/1`, then the syiling is 256 with "244 syiling lagi ke Silver" and the "Koin" is 256 (DV-M14-09; provisional until M08 applies XR-M14-03).
- **AC-M14-03.4** Given pelajar2 (no wallet row), when I open S11, then it shows 0 syiling, 0 token, "Level 1", "Gangsa Tier", "📚 Permulaan", "Perlu 500 syiling lagi" and the header chips 0 / 0 / 0.
- **AC-M14-03.5** Given the student completes an M05 session with 5 correct answers, when the result shows, then the M05 "Ganjaran Anda" tiles, the header chip, S11 and S17 show the same new balance (provisional).
- **AC-M14-03.6** Given the seed, when M18 and M17 read the streak store, then KLUANG has 81 kombo-active pupils (8765 18, 8880 14, 2700 12, 3160 12, 8767 11, 8772 10, 2710 4), BATANG PADANG 29 (7780 15, school 1 14), the two 2710 pupils have `totalDays` 13 and 4 (every other anchor 0), and pupil 2022 has streak 1.

**US-M14-04 — Dashboard hero and cards**
- **AC-M14-04.1** Given the admin, when S11 loads, then the hero shows "🥉", "📚 Permulaan", h1 "Gangsa Tier", "Level 2", "256" "Syiling 💰", "0" "Token 🎫".
- **AC-M14-04.2** Given the admin, when S11 loads, then the progress block reads "⬆️ Naik ke **Perak**", "51.2%" and "Perlu 244 syiling lagi" with the bar at 51.2%.
- **AC-M14-04.3** Given the admin, when I click "Tukar Token", "Cabaran Harian" and "Kedai Hadiah", then I reach `/gamification/convert`, `/gamification/challenges` and `/gamification/rewards` (M15).
- **AC-M14-04.4** Given the admin, when S11 loads, then the cards read "256" "Baki Syiling" "+0 hari ini", "0" "Baki Token" "50 syiling = 1 token", "2" "Level" "8/110 XP" (bar 7 %), "256" "Jumlah Syiling" "+0 minggu ini".
- **AC-M14-04.5** Given the student at 15:40 on 25/09, when S11 loads, then "Baki Syiling" is 370 with "+198 hari ini" and "Jumlah Syiling" 370 with "+370 minggu ini" (the designed rows of 22–25/09; provisional: sums INFERRED).

**US-M14-05 — Dashboard sections**
- **AC-M14-05.1** Given the admin, when S11 loads, then "Cabaran Hari Ini" lists 📝 Rajin Berlatih "MUDAH" "Selesaikan 3 kuiz hari ini" "0/3" "+15 💰", 🎯 Si Tepat "SEDERHANA" "0/80" "+20 💰", 🗺️ Penjelajah Topik "SEDERHANA" "0/3" "+25 💰", ⚡ Kilat Matematik "SUKAR" "0/10" "+30 💰", and "Lihat semua →" → S13.
- **AC-M14-05.2** Given the admin, when S11 loads, then "Transaksi Terkini" lists, newest first, "Cabaran selesai: Penjelajah Topik" +25, "Streak activity (spm)" +7, "SPM Tahun Lepas: 1 betul — 20%" +3, "Cabaran selesai: Cabaran Kilat" +40, "Cabaran selesai: Rajin Berlatih" +15, "Latih Tubi SPM: 11 betul — 32.35%" +22, each with 💰 and "4 bulan yang lepas", and "Semua →" → S17.
- **AC-M14-05.3** Given the admin, when S11 loads, then "Tahap Penguasaan Subjek" shows "L2" "Bahasa Melayu" "Aktif" "46 betul / 50" "48.94% tepat · 1.05x bonus" and "L1" "Sejarah" "Mula Belajar" "14 betul / 25" "35% tepat".
- **AC-M14-05.4** Given the admin, when S11 loads, then "Sistem Tier" shows 🥉 Gangsa "0+ syiling" "50 syiling = 1 token" "✨ ANDA DI SINI", 🥈 Perak "500+ syiling" "40 syiling = 1 token", 🥇 Emas "2,000+ syiling" "30 syiling = 1 token", 💎 Platinum "5,000+ syiling" "20 syiling = 1 token"; the label text of Emas, Perak and Platinum is slate-800 `#1e293b` (DV-M14-15; contrast ≥ 4.5:1), Gangsa as live.
- **AC-M14-05.5** Given the admin, when S11 loads, then "Gelaran Seterusnya" shows "🎓" "Pelajar" "Perlu 44 syiling lagi untuk gelaran ini" and the card "Kad Kongsi" "Kongsi pencapaian anda di WhatsApp!" links to S18.

**US-M14-06 — History**
- **AC-M14-06.1** Given the admin, when S17 loads, then it shows "Baki semasa: **256** syiling", "← Dashboard" → S11 and 14 rows newest first ending with "Cabaran Kilat: 3 betul, combo 2x" "11/02/2026 05:23 · 7 bulan yang lepas" "+4" "Baki: 4"; the first row is "Cabaran selesai: Penjelajah Topik" "19/05/2026 03:26 · 4 bulan yang lepas" "+25" "Baki: 256"; no pager.
- **AC-M14-06.2** Given the admin, when I click "💰 Dapat", then the URL has `?type=earn` and the same 14 rows show; when I click "🛍️ Belanja", "🔄 Tukar" or "🎁 Bonus", then "📋" "Belum ada transaksi" "Mula latih tubi untuk dapatkan syiling!" shows.
- **AC-M14-06.3** Given the admin after converting 250 syiling, when S17 loads with "🔄 Tukar", then one row "Tukar 250 syiling → 5 token" "−250" "Baki: 6" shows with the icon 🔄 (provisional: icon PROPOSED).

**US-M14-07 — Conversion screen**
- **AC-M14-07.1** Given the admin, when S12 loads, then it shows h1 "🔄 Tukar Syiling → Token", the subtitle, "256" "Baki Syiling", "0" "Baki Token", the input with value 50, "Anda akan terima" "1" "Token 🎫" and "Kadar: 50 syiling = 1 token (Gangsa)".
- **AC-M14-07.2** Given the admin, when I click "250 syiling", then the input reads 250, the preview 5 and the button is active; "Semua (256)" → 256 and 5.
- **AC-M14-07.3** Given the admin, when S12 loads, then "📊 Kadar Penukaran Mengikut Tier" shows Gangsa 50 with "ANDA", Perak 40, Emas 30, Platinum 20, each with "{min}+ syiling" and "syiling/token" (label text of Emas, Perak and Platinum slate-800, DV-M14-15), and the tip starting "💡 **Tips:** Naik tier untuk dapatkan kadar penukaran yang lebih baik!".

**US-M14-08 — Conversion rules and effect**
- **AC-M14-08.1** Given the admin, when I type 30, then the preview shows 0 and "Tukar Sekarang" is disabled; when I type 300, then the preview shows 6 and the button is disabled; when I type 50, then it is enabled.
- **AC-M14-08.2** Given the admin, when I convert 250 syiling, then S12 shows 6 syiling and 5 tokens with the success message (PROPOSED COPY), S11 shows 6 / 5 with "+0 hari ini" unchanged, "Jumlah Syiling" stays 256 and the tier stays Gangsa (provisional).
- **AC-M14-08.3** Given the admin, when a conversion of 251 syiling is posted directly (bypassing the form), then 251 syiling are deducted and 5 tokens added (remainder not refunded); when 300 is posted, then the server refuses it and nothing changes (provisional).

**US-M14-09 — Challenges screen**
- **AC-M14-09.1** Given the admin, when S13 loads, then it shows "0/10" "Selesai" and 10 cards in order Rajin Berlatih, Si Tepat, Penjelajah Topik, Kilat Matematik, Mula Hari Ini, Jawab 5 Betul, Latihan 10 Minit, Kombo 2 Hari, Ketepatan 90%, Cabaran Kilat, each with its icon, difficulty, description, "💰 +{s} Syiling", "⭐ +{x} XP", "Progres: 0/{target}" and "0%".
- **AC-M14-09.2** Given the student at 15:40 on 25/09, when S13 loads, then it shows "7/10" "Selesai" with Si Tepat "Progres: 80/80" "100%", Kombo 2 Hari "2/2", Cabaran Kilat "20/20", Rajin Berlatih "1/3" "33%" and Ketepatan 90% "85/90" (provisional).

**US-M14-10 — Challenge engine**
- **AC-M14-10.1** Given pelajar2 at 09:00 on 26/09, when a `random` session of pelajar2 with 6 of 10 correct in 5 minutes completes (test hook `gamificationSession`, no answers written), then S13 shows Mula Hari Ini and Jawab 5 Betul complete ("2/10"), S17 shows "Latih Tubi: 6 betul — 60%" +6, "Cabaran selesai: Mula Hari Ini" +10, "Cabaran selesai: Jawab 5 Betul" +12 and "Pencapaian: Langkah Pertama" +5 (PROPOSED COPY), and the balance is 33 (provisional).
- **AC-M14-10.2** Given pelajar2 after AC-10.1, when a second session of pelajar2 completes the same day with 5 correct, then Kilat Matematik completes (11 correct today, +30) and Mula Hari Ini is not paid again (provisional).
- **AC-M14-10.3** Given the clock moves to 00:05 the next day, when S13 loads, then every progress is 0 again and the counter is "0/10" (provisional).
- **AC-M14-10.4** Given the admin deactivates challenge 10 on S3, when S13 and S11 load, then Cabaran Kilat is absent, the counter reads "{n}/9" and S1 "Cabaran Aktif" reads 9 (provisional).

**US-M14-11 — Leaderboard**
- **AC-M14-11.1** Given the admin, when S14 loads, then the podium shows 🥈 686,730, 🥇 1,018,083 (raised) and 🥉 135,760, each "💎 Platinum", with fictitious names and initials avatars.
- **AC-M14-11.2** Given the admin, when S14 loads, then 47 rows #4–#50 follow: #4 "Mitos · Level 39" 65,129 💎 … #21 "Mitos · Level 20" 10,552 💎, #22 "Legenda · Level 19" 8,720 💎, #34 "Grandmaster · Level 13" 4,937 🥇, #41 "Master · Level 11" 3,464 🥇, #50 "Master · Level 10" 2,930 🥇.
- **AC-M14-11.3** Given the admin, when I open `?period=week`, then the same list shows and no period filter or own-rank card exists.

**US-M14-12 — Achievements page**
- **AC-M14-12.1** Given the admin, when S15 loads, then it shows "Kumpul lencana dan capai pencapaian — 0/25 dicapai" and the streak card "🔥" "1" "Hari berturut-turut" "1.0x Bonus" "Terbaik: 5 hari" (DV-M14-08).
- **AC-M14-12.2** Given the admin, when S15 loads, then 25 locked cards show in the live order from "👣 Langkah Pertama" "Jawab kuiz pertama anda" "Biasa" "🪙 5 · ⭐ 3 XP" "0/1" to "🦸 Wira JomBelajar" "Legenda" "🪙 400 · ⭐ 300 XP", with progress only on Langkah Pertama 0/1, Pelajar Rajin 0/10, Cendiakawan 0/50, Pakar Matematik 0/200, Legenda JomBelajar 0/500.
- **AC-M14-12.3** Given the admin, when I click "Biasa", "Jarang", "Epik", "Legenda", then 6, 8, 6, 5 cards show and the active pill is purple; `?rarity=zzz` shows none and no message.

**US-M14-13 — Share an achievement**
- **AC-M14-13.1** Given pelajar2 after unlocking "Langkah Pertama" (AC-14.1), when I click its card, then the modal shows the grey gradient card with "👣", "Langkah Pertama", "Jawab kuiz pertama anda", "Biasa", the user's name, "🎓 PRESTASIPLUS", "5 🪙 Syiling", "3 ⭐ XP" and "Muat Turun", "WhatsApp", "Tutup" (provisional: unlocked style PROPOSED).
- **AC-M14-13.2** Given the modal, when I click "Muat Turun", then a PNG named `pencapaian-langkah-pertama.png` is downloaded (D25); when I click "WhatsApp", then `wa.me` opens with "🏅 Saya baru capai "Langkah Pertama" di PRESTASIPLUS! 🎉" and "https://prestasiplus.my/pelajar/3" (the viewer's own id, DV-M14-02); the same card of pelajarmaju (seeded unlock) links "https://prestasiplus.my/pelajar/4"; "Tutup" or a backdrop click closes it (provisional).

**US-M14-14 — Unlock achievements**
- **AC-M14-14.1** Given pelajar2 (no session, 0 unlocked), when a `random` session of pelajar2 with 6 of 10 correct completes (hook `gamificationSession`), then the evaluation unlocks "Langkah Pertama" only (lifetime 28 < 100, streak 1), adds 5 syiling and 3 XP with the row "Pencapaian: Langkah Pertama" (PROPOSED COPY) and S15 shows "1/25 dicapai" (provisional).
- **AC-M14-14.2** Given the admin (256 lifetime, best streak 5, no practice-mode session), when S15 loads, then nothing is unlocked (0/25), as live.
- **AC-M14-14.3** Given pelajarmaju (seed replayed with BR-16), when S15 and S17 load, then S15 shows "3/25 dicapai" with Langkah Pertama, Pengumpul Syiling and Streak 3 Hari unlocked, and S17 shows "Pencapaian: Langkah Pertama" +5 (23/09), "Pencapaian: Pengumpul Syiling" +10 (24/09), "Pencapaian: Streak 3 Hari" +10 (25/09) with the balance 267 (provisional).

**US-M14-15 — Kad Kongsi**
- **AC-M14-15.1** Given the admin, when S18 loads, then tab "Profil" shows "A", the name, "PRESTASIPLUS", "119" "Soalan", "38.7%" "Ketepatan", "4" "Sesi", "🥉 Bronze", "Lvl 2", "🪙 256", "🎓 PRESTASIPLUS.MY", "Muat Turun" and "WhatsApp".
- **AC-M14-15.2** Given the admin, when I open "Kombo", then "🔥" "1" "Hari Berturut-turut!", "5" "Rekod Terbaik", "1.0x" "Pengganda" show (DV-M14-08); "Penguasaan" shows Bahasa Melayu "Lvl 2 — Aktif" "48.9%" "46" and Sejarah "Lvl 1 — Mula Belajar" "35%" "14"; "Kedudukan" shows "🏆" "Kedudukan Terkini" "38.7%" "Ketepatan · 46/119 betul".
- **AC-M14-15.3** Given the admin, when I click "WhatsApp" on the Kedudukan card, then the text is "🏆 Kedudukan saya di PRESTASIPLUS: 38.7%! Jom latih tubi!" + "\n\nhttps://prestasiplus.my/pelajar/1" (DV-M14-02, DV-M14-03); on the Profil card "Lihat profil saya di PRESTASIPLUS! 38.7% ketepatan dengan 119 soalan dijawab." + the same link.
- **AC-M14-15.4** Given the admin, when I click "Muat Turun" on the Profil card, then `prestasiplus-profil.png` is downloaded and a second click during the download is ignored (D25).

**US-M14-16 — Referral page**
- **AC-M14-16.1** Given the admin, when S16 loads, then it shows the h1, subtitle, "🎁" "50" "Syiling untuk ANDA", "👋" "25" "Syiling untuk KAWAN", "Kod Rujukan Anda" "4JURJTT" and "📊 Statistik Rujukan" 0 "Rujukan", 0 "Ganjaran Dicapai", 0 "Syiling Diperolehi".
- **AC-M14-16.2** Given the admin, when I click "Salin Kod", then the clipboard holds "4JURJTT" and the button reads "✓ Disalin!"; "Salin Link" copies "https://prestasiplus.my/register?ref=4JURJTT" and reads "✓ Link Disalin!".
- **AC-M14-16.3** Given the admin, when S16 loads, then "WhatsApp" → `https://wa.me/?text=Jom belajar matematik di PRESTASIPLUS! Guna kod 4JURJTT untuk dapat 25 syiling PERCUMA! https://prestasiplus.my/register?ref=4JURJTT` and "Telegram" → `https://t.me/share/url?url=https://prestasiplus.my/register?ref=4JURJTT&text=Jom belajar matematik di PRESTASIPLUS! Guna kod 4JURJTT` (URL-encoded as live: only spaces become `%20`; `:`, `/`, `?`, `=`, `&` and `!` stay raw).

**US-M14-17 — Referral reward**
- **AC-M14-17.1** Given a guest opens `/register?ref=4JURJTT` and registers a student, when the account is created, then the new user has 25 syiling and the admin has 306 syiling, and S16 for the admin shows 1 / 1 / 50 (provisional).
- **AC-M14-17.2** Given a guest opens `/register?ref=ZZZZZZZ` (unknown) and registers, when the account is created, then nobody receives syiling (provisional).

**US-M14-18 — Session credit and XP**
- **AC-M14-18.1** Given pelajar2, when pelajar2 completes an M06 "SPM Tahun Lepas" session with 4 of 10 correct, then S17 shows "SPM Tahun Lepas: 4 betul — 40%" +4 followed by "Streak activity (spm)" +7 and the M05 result shows 4 coins (provisional).
- **AC-M14-18.2** Given pelajar2, when pelajar2 completes a session with 0 correct, then no coin row is written and the balance is unchanged (provisional).
- **AC-M14-18.3** Given a complimentary student (M02 fixture 5901, `coinsEnabled` false), when the student completes a session with 8 correct, then no syiling is added and no row is written (provisional).
- **AC-M14-18.4** Given a `past_year` session of pelajar2 with 6 of 10 correct (60 points) completes, when S11 loads, then "Level" reads "1" and "73/100 XP" (60 + Mula Hari Ini 5 + Jawab 5 Betul 8; bar 73 %) and the header shows "73" "mata" (provisional: level never changes at runtime, Q4).

**US-M14-19 — Streak**
- **AC-M14-19.1** Given pelajarmaju (streak 3, last 25/09) at 26/09, when a session completes, then the streak is 4 and best 4; given pelajar (streak 2, last 25/09) at 27/09, when a session completes, then the streak restarts at 1 and best stays 2 (provisional).
- **AC-M14-19.2** Given pelajar2 logs in with the password at 08:00, when the second login of the day happens, then only one "Streak activity (daily_login)" +2 row exists; given the admin logs in, then no such row is written; a form login as pelajar or pelajarmaju at the clock therefore shows 372 / 269 syiling, while scenarios that assert the designed 370 / 267 use `setUser` (provisional).
- **AC-M14-19.3** Given any account, when a 3rd or 10th consecutive day is reached, then no "Bonus Kombo" row is written; the seed rows #51 and #44 remain the only `bonus` rows of `streak_bonus` (provisional).

**US-M14-20 — Teacher mirror of practice**
- **AC-M14-20.1** Given the admin completes an SPM "Latih Tubi SPM" session with 11 correct of 34, when S19 loads, then the teacher history starts with "Latih Tubi SPM - 32.35% ketepatan" +11 and, on the first SPM session of that day, "Aktiviti harian: spm" +7, while S17 shows "Latih Tubi SPM: 11 betul — 32.35%" +11 (provisional).

**US-M14-21 — Tiers and titles**
- **AC-M14-21.1** Given the admin receives an award of 250 syiling (balance 506), when S11 loads, then the tier is "Perak" (🥈 badge, "Perak Tier"), "Naik ke **Emas**", the conversion rate 40 on S12, and the title "🎓 Pelajar" (lifetime 506) with "Gelaran Seterusnya" "Master" (provisional: cut-offs INFERRED).
- **AC-M14-21.2** Given the admin then converts 400 syiling (balance 106), when S11 loads, then the tier stays "Perak" (no downgrade) (provisional).
- **AC-M14-21.3** Given S4 filtered by tier, when it loads, then the observed tiers of the seeded wallets are unchanged, including the platinum row with balance 129 and lifetime 65,129.

**US-M14-22 — Other credits and debits**
- **AC-M14-22.1** Given the admin awards 100 syiling to user 3 with "Pertandingan", when S5 is filtered by "🎁 Bonus", then a row "bonus" "+100" "Baki Selepas 100" "admin_award" "Pertandingan" is first and pelajar2's S17 shows it under "🎁 Bonus" (provisional).
- **AC-M14-22.2** Given the student with 0 tokens, when M15 asks to debit 2 tokens for a mystery box, then the debit is refused (`INSUFFICIENT_BALANCE`), nothing is written and the balance stays 0 (provisional).
- **AC-M14-22.3** Given the admin converts 250 syiling (5 tokens), when M15 debits 2 tokens and credits a mystery box of 12 syiling and 5 XP, then the tokens are 3, the balance 18, and S17 shows "Kotak Misteri: Kotak Gangsa" +12 (provisional).
- **AC-M14-22.4** Given an open draw with ticket 50 and max 10, when the admin buys 1 ticket through M15, then 50 syiling are debited with "Tiket Cabutan: {title}" (PROPOSED COPY, source `cabutan_ticket`); an 11th ticket, a closed draw or a balance below 50 is refused and nothing is written (provisional).

- **AC-M14-22.5** Given `games_award_syiling` = 0 (live), when M16 reports a correct Papan Bijak answer for pelajar2, then the wallet gets XP only and no ledger row; with the setting set to 1, then +5 syiling "Jawab betul dalam Papan Bijak 🎲" (source `papan_bijak`) is written (provisional).

**US-M14-23 — Overview**
- **AC-M14-23.1** Given the admin, when S1 loads, then the cards read "2,255" "Pelajar Aktif", "3,124,192" "Syiling Dijana", "7,801" "Token Ditukar", "534" "Penukaran", "10" "Cabaran Aktif" and "0" "Siap Hari Ini" (no user has completed all 10 challenges today; pelajar 7/10, pelajarmaju 4/10).
- **AC-M14-23.2** Given the admin, when S1 loads, then "Taburan Tier" lists Bronze 1889 84%, Gold 41 2%, Platinum 33 1%, Silver 292 13% (alphabetical), with every count readable (DV-M14-06).
- **AC-M14-23.3** Given the admin, when S1 loads, then "Top 10 Pelajar" starts "#1" "platinum · Level 66" "1,018,083" "syiling" and ends "#10" "platinum · Level 30" "30,269".
- **AC-M14-23.4** Given the admin, when S1 loads, then "Transaksi Terkini" lists the 10 newest rows at the clock: "Earn" "+2" "daily_login" "11 minit yang lepas" (#53668, 15:29), "+12" "quiz_spm" "1 jam yang lepas", "+3" "1 jam yang lepas", "+2" "1 jam yang lepas", "+4" "2 jam yang lepas", "Convert" "-400" "token_conversion" "2 jam yang lepas", "+2" "2 jam yang lepas", "+2" "2 jam yang lepas", "+2" "2 jam yang lepas", "+10" "quiz_practice" "2 jam yang lepas" (#53659), and "Lihat semua →" → S5; no row dated after the clock is listed.
- **AC-M14-23.5** Given the admin converts 250 syiling, when S1 loads, then "Penukaran" reads 535 and "Token Ditukar" 7,806 (provisional).

**US-M14-24 — Tiers administration**
- **AC-M14-24.1** Given the admin, when S2 loads, then 4 tier forms show 🥉 Gangsa #cd7f32 0 / 50 / 1, 🥈 Perak #c0c0c0 500 / 40 / 2, 🥇 Emas #ffd700 2000 / 30 / 3, 💎 Platinum #e5e4e2 5000 / 20 / 4, each with L1–L5 1–5, PKSK 5, Papan Bijak 5 / 25 and "🔴 Nyahaktif".
- **AC-M14-24.2** Given the admin changes Perak "Kadar" to 35 and saves, when S12 loads for a Perak user, then the rate is 35 and "Kadar: 35 syiling = 1 token (Perak)" (provisional).
- **AC-M14-24.3** Given the admin clears "Min Syiling" and saves, then the browser's required bubble blocks the submit; the perks of an existing tier have no input.
- **AC-M14-24.4** Given the admin adds tier "diamond" "Berlian" "💎" min 10000 rate 15 order 5, when S11 loads, then "Sistem Tier" shows 5 cards with "Berlian" last and S2 shows 5 forms (provisional).
- **AC-M14-24.5** Given the admin clicks "🔴 Nyahaktif" on Platinum, when S11 and S12 load, then Platinum is absent from both grids and the S2 button reads "🟢 Aktifkan" (provisional, PROPOSED COPY).

**US-M14-25 — Challenges administration**
- **AC-M14-25.1** Given the admin, when S3 loads, then "Senarai Cabaran (10)" lists the 10 challenges of discovery §2.3 with their values and badges; challenge 2 "Si Tepat" shows "Jenis" "Ketepatan (%)", 7 "Masa (min)", 8 "Kombo", 9 "Ketepatan (%)" (DV-M14-04) and the others "Bilangan Kuiz" except 3 "Topik Berbeza".
- **AC-M14-25.2** Given the admin changes "Rajin Berlatih" reward to 20 and saves, when S13 loads, then its card shows "💰 +20 Syiling" (provisional).
- **AC-M14-25.3** Given the admin clicks "Padam" on challenge 10, when the confirm "Padam cabaran ini?" is dismissed, then nothing changes; when it is accepted, then S3 shows "Senarai Cabaran (9)" and S13 9 cards (provisional).
- **AC-M14-25.4** Given the admin adds "Ulang Kaji Ringkas" with the defaults (Bilangan Kuiz, 10 syiling, 5 XP, Mudah, Urutan 10), when S13 loads, then the card is last with "💰 +10 Syiling" "⭐ +5 XP" "MUDAH" (provisional).

**US-M14-26 — Students and award**
- **AC-M14-26.1** Given the admin, when S4 loads at 1280px, then the pager reads "Showing 1 to 20 of 2255 results" with pages 1–10, "...", 112, 113, and the first row is "platinum" 66 / 1,018,033 / 1 / 1,018,083 / 19,794; the tier badges use the tier colour.
- **AC-M14-26.2** Given the admin, when I filter "🥈 Perak", then "of 292 results" shows and the first row is silver 11 / 1,916 / 4 / 2,423 / 1,058; "🥇 Emas" → 41, "💎 Platinum" → 33, "🥉 Gangsa" → 1889, where a bronze row shows token "−2" (DV-M14-10).
- **AC-M14-26.3** Given the admin, when I search "zzzq", then "Belum ada pelajar dalam sistem gamifikasi" shows; at 375px the pager shows only "« Previous" / "Next »".
- **AC-M14-26.4** Given the admin fills "User ID" 3, "Jumlah" 100, "Sebab" "Pertandingan" and clicks "Berikan", then pelajar2 has 100 syiling, a `bonus` row exists and S4 counts 2,256 wallets (provisional: success message PROPOSED).
- **AC-M14-26.5** Given the admin types "Jumlah" 0 or 10001 or leaves "Sebab" empty, then the browser blocks the submit; a "User ID" that does not exist is refused with "Pengguna tidak dijumpai." (PROPOSED COPY; provisional).
- **AC-M14-26.6** Given the admin, when I choose "Baki Token" and "Cari", then the URL has `sort=token_balance`, the select keeps "Baki Token" and the first row is the platinum student with token 1,764 (lifetime 65,129); "Baki Syiling" → first row 1,018,033; "Level" → first row level 66 (DV-M14-14; live ignores the sort).

**US-M14-27 — Transactions**
- **AC-M14-27.1** Given the admin, when S5 loads, then "Showing 1 to 25 of 52964 results" and the first row "#53668" "earn" "+2" "1,058" "daily_login" "Streak activity (daily_login)" "25/09/2026 15:29", followed by the observed rows down to "#53654" (row 15); page 2118 starts with "#44" "bonus" "+50" "Bonus Kombo 10 Hari!".
- **AC-M14-27.2** Given the admin, when I filter "🛍️ Belanja", then one row "#42" "spend" "-100" "365" "reward_claim" "Tuntut: Lencana Super Learner" "28/02/2026 08:00" and "Reset" shows; "🔄 Tukar" → "of 535 results" starting "#53663" "Tukar 400 syiling → 8 token"; "🎁 Bonus" → #51 and #44; "↩️ Refund" → "Tiada transaksi ditemui"; "💰 Dapat" → "of 52426 results".
- **AC-M14-27.3** Given the admin filters Dari 2026-02-26 to Hingga 2026-02-27, when "Tapis" is clicked, then only rows of those two days show, newest first, and "Reset" clears the filter (provisional: date bounds inclusive, INFERRED).

**US-M14-28 — Teacher dashboard**
- **AC-M14-28.1** Given the admin, when S19 loads, then the cards read "92,683" "Baki Syiling", "92,683" "Jumlah Diperolehi", "20,719" "Soalan Disumbang", "7/8" "Lencana".
- **AC-M14-28.2** Given the admin, when S19 loads, then 8 badge tiles show from "Penyumbang Baru" "10 soalan" "+100 syiling" to "Legenda Terulung" "50,000 soalan" "+250,000 syiling", the first 7 emerald and the last red-50, and "Seterusnya: Legenda Terulung" "20,719 / 50,000" "29,281 soalan lagi untuk bonus 250,000 syiling".
- **AC-M14-28.3** Given the admin, when S19 loads, then "Katalog Ganjaran" shows "Tiada ganjaran tersedia buat masa ini" / "Admin akan menambah ganjaran tidak lama lagi!" and "Sejarah Transaksi" lists 18 rows from "SPM Tahun Lepas - 0% ketepatan" "19 May 2026, 03:49" "0" to "Latihan - 60% ketepatan" "06 Feb 2026, 16:26" "+3", including "Badge: Guru Maestro (10000 soalan)" "+50,000".
- **AC-M14-28.4** Given the admin, when I click "Tebus Tunai", "Kedai Hadiah", "Papan Pendahulu", "Sumbang Soalan (+10 syiling)", then I reach S20, S21, S22 and `/guru/soalan/cipta`.
- **AC-M14-28.5** Given the teacher, when S19 loads, then it shows 0 / 0 / 1 / "0/8", "Seterusnya: Penyumbang Baru" "1 / 10" "9 soalan lagi untuk bonus 100 syiling" and "Belum ada transaksi" (provisional: empty copy reused from S17).

**US-M14-29 — Cash-out**
- **AC-M14-29.1** Given the admin, when S20 loads, then the cards read "92,683" "Jumlah Syiling", "92,683" "Boleh Ditebus", "0" "Dalam Proses", "RM741.46" "Nilai Tunai"; "Minimum tebus: 100 syiling"; "Min: 100" "Max: 92,683"; the bank select has "-- Pilih Bank --" and 24 options; "Sejarah Tebus Tunai" shows "Tiada rekod tebus tunai lagi".
- **AC-M14-29.2** Given the admin, when I click "500 syiling", then "Anda akan menerima" "RM4.00" shows and the button is enabled once the bank fields are filled; when I type 50, then the preview hides and the button is disabled; "5,000 syiling" stays clickable.
- **AC-M14-29.3** Given the admin fills 500, "Maybank", "1234567890", "Admin Demo" and submits, when the confirm "Sahkan tebus tunai?\n\n500 syiling = RM4.00\n\nTeruskan?" is accepted, then S20 shows "Dalam Proses" 500, "Boleh Ditebus" 92,183 and one history row "PENDING" 500 RM4.00 Maybank, and S8 "Menunggu" reads 3 (provisional).
- **AC-M14-29.4** Given the admin dismisses the confirm, then nothing is created; given `cash_withdrawal_enabled` is "Tidak Aktif", when the admin submits, then the request is refused with "Tebus tunai tidak aktif buat masa ini." (PROPOSED COPY; provisional).
- **AC-M14-29.5** Given "Kembali ke Dashboard", when clicked, then S19 opens.

**US-M14-30 — Teacher shop**
- **AC-M14-30.1** Given the admin, when S21 loads, then it shows "🎁 Kedai Hadiah Guru", "Tebus syiling anda untuk hadiah menarik!", "92,683" "Baki Syiling", "Dashboard" → S19 and the empty state "🎁" "Tiada Hadiah Tersedia" "Admin akan menambah hadiah tidak lama lagi. Tunggu ya!" "Dashboard Gamifikasi".
- **AC-M14-30.2** Given the admin created an active reward "Baucar Buku RM20" (Baucar, 200 syiling, stock 5), when S21 loads, then its card shows and "Tebus" creates a PENDING redemption visible on S7 "Menunggu"; the S21 balance shows 92,483 available (provisional, PROPOSED layout).

**US-M14-31 — Teacher leaderboard**
- **AC-M14-31.1** Given the admin (seed school 900002, not a teacher), when S22 loads, then "Sekolah Saya" is active and the table "# | Guru | Soalan | Syiling" lists 50 rows starting 🥇 3,906 / 20,720, 🥈 1,559 / 0, 🥉 256 / 0; the admin is not listed.
- **AC-M14-31.2** Given the admin, when I click "Seluruh Malaysia", then the table has the "Sekolah" column and the same first three rows; "Kembali ke Dashboard" → S19.
- **AC-M14-31.3** Given the teacher (school 900001), when S22 "Sekolah Saya" loads, then only teachers of SMK DEMO are listed, the teacher first with 1 / 0 (provisional).
- **AC-M14-31.4** Given the seed, when the teacher wallets are summed over active teachers outside the fixture schools, then the total is 63,459 (M17 "Jumlah Syiling"), teachers 4207 and 4208 are inactive, and both S22 tabs still start 3,906 / 20,720, 1,559 / 0, 256 / 0 with no added wallet among the 50 rows.

**US-M14-32 — Teacher earning**
- **AC-M14-32.1** Given the teacher creates a question on M10 S22, when S19 loads, then "Soalan Disumbang" is 2, "Baki Syiling" 10 and the history shows "Sumbang Soalan #{id}" +10 (provisional, PROPOSED COPY).
- **AC-M14-32.2** Given the teacher reaches 10 contributed questions, when the 10th is created, then "Penyumbang Baru" turns emerald and the history shows "Badge: Penyumbang Baru (10 soalan)" +100 (provisional).
- **AC-M14-32.3** Given the admin's PENDING request of 500 (AC-29.3), when the admin sets it to PAID on S8, then S19 shows 92,183 with "Tebus Tunai #3" −500 and S8 "Dibayar" 1, "Jumlah Dibayar" "RM4.00"; when a request is set to REJECTED, then its coins are available again (provisional).

**US-M14-33 — Teacher summary and badges (admin)**
- **AC-M14-33.1** Given the admin, when S6 loads, then the cards read 0 "Jumlah Ganjaran", 0 "Aktif", 8 "Lencana", 0 "Tebusan Pending", and the links "Tebusan Hadiah" → S7 and "Tebus Tunai" with the badge "2" → S8.
- **AC-M14-33.2** Given the admin, when S6 loads, then "Lencana Guru (8)" lists Penyumbang Baru `fa-seedling` 10 +100 … Legenda Terulung `fa-crown` 50,000 +250,000, each "Aktif" with "Edit".
- **AC-M14-33.3** Given the admin clicks "Edit" on "Penyumbang Baru", then the form shows Nama, Ikon CSS, Threshold, Bonus Syiling, Aktif (checked) and "Simpan"; after typing in "Nama" and clicking "Edit" twice, the typed value is still there; saving "Bonus Syiling" 150 shows "+150" in the row and on S19 (provisional).

**US-M14-34 — Teacher reward catalogue (admin)**
- **AC-M14-34.1** Given the admin, when S6 loads, then "Katalog Ganjaran (0)" shows "Tiada ganjaran. Tambah ganjaran pertama!"; "Tambah Ganjaran" shows the form with the fields of FN-M14-11.3.3 and "Kategori" options Am, Digital, Fizikal, Baucar.
- **AC-M14-34.2** Given the admin submits the form empty, then the browser blocks it at "Nama *"; given a valid reward "Baucar Buku RM20" is saved, then S6 shows "Katalog Ganjaran (1)", "Jumlah Ganjaran" 1 and "Aktif" 1, and the row (PROPOSED layout); given an `image` that is SVG or larger than 5 MB, the save is refused and nothing is created; png, jpeg and webp up to 5 MB are accepted (provisional).

**US-M14-35 — Teacher redemption queue (admin)**
- **AC-M14-35.1** Given the admin, when S7 loads, then the pills "Menunggu" (active), "Diproses", "Dihantar", "Dibatal", "Semua" and "Tiada tebusan pending" show; each other pill shows "Tiada tebusan processing", "Tiada tebusan delivered", "Tiada tebusan cancelled", "Tiada tebusan"; "Kembali ke Gamifikasi Guru" → S6.
- **AC-M14-35.2** Given the redemption of AC-30.2, when the admin moves it to "Diproses" and then "Dihantar", then it leaves "Menunggu", the reward cost is debited from the admin's teacher wallet at DELIVERED, and S6 "Tebusan Pending" drops to 0; the cost is debited and the stock reduced exactly once (a repeated "Dihantar" is refused); a DELIVERED or CANCELLED redemption cannot be moved again, and DELIVERED when the balance or the stock is too low is refused with nothing changed (provisional; v1.6).

**US-M14-36 — Cash requests (admin)**
- **AC-M14-36.1** Given the admin, when S8 loads, then the cards read 2 "Menunggu", 0 "Diluluskan", 0 "Dibayar", "RM0.00" "Jumlah Dibayar", and the table lists request 2 (18,140, RM145.12, Bank Rakyat, masked account and holder, "PENDING", "15 Apr 2026 13:15") then request 1 (163,445, RM1,307.56, Maybank, "14 Apr 2026 23:04").
- **AC-M14-36.2** Given the admin, when I open "Diluluskan", "Dalam Proses", "Dibayar", "Ditolak", then no row shows; "Semua" shows both; "Tetapan" → S9, "Ganjaran" → S6.
- **AC-M14-36.3** Given the admin selects APPROVED for request 2 with note "Semak akaun" and clicks ✓, when the confirm "Kemaskini status?" is accepted, then the row shows under "Diluluskan" with the note, "Menunggu" reads 1 and "Diluluskan" 1; dismissing the confirm changes nothing (provisional).

**US-M14-37 — Settings**
- **AC-M14-37.1** Given the admin, when S9 loads, then 10 rows show their labels, "Key: {key}" and values 10, 10, 8, 100, Aktif, 1000, 300, 2026, 1, Tidak Aktif, the `cash_rate_sen` label reading "(cth: 10 syiling = 8 sen)" (DV-M14-05).
- **AC-M14-37.2** Given the admin, when S9 loads, then "Pratonton Kadar" reads "10 syiling per soalan sumbangan", "10 syiling = 8 sen (RM0.08)", "100 syiling = RM0.80 · 1000 syiling = RM8.00", "Minimum tebus: 100 syiling"; typing 16 in `cash_rate_sen` updates it to "10 syiling = 16 sen (RM0.16)" and "100 syiling = RM1.60 · 1000 syiling = RM16.00"; typing 0 falls back to 8.
- **AC-M14-37.3** Given the admin saves `min_cash_withdrawal` 200, when S20 loads, then "Minimum tebus: 200 syiling", "Min: 200" and the input min is 200 (provisional).
- **AC-M14-37.4** Given the admin saves `flat_quiz_reward` 2 on S9, when S10 loads, then "Syiling flat / soalan betul" shows 2, and a session with 5 correct pays +10 (provisional).
- **AC-M14-37.5** Given "Ganjaran Guru", "Tebus Tunai", "Tebusan", when clicked, then S6, S8, S7 open.

**US-M14-38 — Reward liability and finance settings**
- **AC-M14-38.1** Given the admin, when S10 loads, then the tiles read "Liabiliti sesi 2026" "RM0.00" "jumlah kos hadiah ditebus", "Pelajar menebus" 0, "Jumlah tebusan" 0 (no claim of the syiling-priced catalogue exists in 2026; the ledger row #42 is not a claim record).
- **AC-M14-38.2** Given the admin, when S10 loads, then "⚙️ Tetapan Kewangan" shows 1000, 300, 1, 2026 and the unchecked "Mini-games beri syiling?" checkbox; saving `current_session_year` 2027 changes the tile to "Liabiliti sesi 2027" and S9 shows 2027 (provisional).

**US-M14-39 — Real reward cost**
- **AC-M14-39.1** Given the admin, when S10 loads, then "🎁 Kos Sebenar Hadiah (sen) — digital = 0, tak makan bajet" lists 11 rows from "Baucar Buku RM10" VOUCHER 500 1000 "RM10.00" to "testing" PHYSICAL 100 1000 "RM10.00", with DIGITAL rows at 0; saving 1500 on row 1 shows "RM15.00" (provisional).

**US-M14-40 — Cabutan administration**
- **AC-M14-40.1** Given the admin, when S10 loads, then "🎟️ Cabutan" shows the table headers and "Tiada cabutan lagi." and "➕ Cipta Cabutan Baru" is closed; opening it shows "Tajuk", "Penerangan", "Harga tiket (syiling)" 50, "Max tiket / pelajar" 10, "Kolam hadiah (JSON)" with the placeholder, "Tarikh tutup", "Buka serta-merta" and "Cipta Cabutan".
- **AC-M14-40.2** Given the admin creates "Cabutan Merdeka" with the placeholder pool, closing 2026-10-31 and "Buka serta-merta", when S10 reloads, then a row "#1" "Cabutan Merdeka" "open" 0 tickets 11 prize units "—" shows and M15 `/cabutan` lists the draw (provisional, PROPOSED layout).
- **AC-M14-40.3** Given the admin submits without "Tajuk", then the browser blocks it; with an invalid JSON pool, then "Format JSON kolam hadiah tidak sah." shows (PROPOSED COPY; provisional).

**US-M14-41 — Responsive, readability, formats, privacy**
- **AC-M14-41.1** Given every M14 route at 375, 768 and 1280px, when it loads, then `document.documentElement.scrollWidth ≤ innerWidth` (S14 included, DV-M14-07) and the S1, S4, S5, S6, S8, S10 and S22 tables scroll inside their cards below 768px.
- **AC-M14-41.2** Given S2, S3, S4, S5, S6, S11, S13, S15, S18, S19 at 375px, when they load, then no visible text is smaller than 12px (DV-M14-11).
- **AC-M14-41.3** Given S6, S8, S10, S1 and S11 at 375px, when a small control is tapped at the edge of its 44px hit area, then it activates; its visual size is the live one.
- **AC-M14-41.4** Given S4, S5, S1, S14, S8, S22, when they load, then every person name is a fictitious seed name, avatars are initials, and S8 shows the bank name with the account number and holder masked.

---

## 5. UI expectations

| Screen | Key states (screenshots in `docs/discovery/img/M14/`) | Behaviour notes |
|---|---|---|
| S1 | default (`admin-overview-desktop/-mobile.png`) | 6 cards in one row at 1280, wrapping at 768, 2 a row at 375; tier and top-10 cards side by side at 1280, stacked below; transactions table scrolls in its card below 768; tier counts readable (DV-M14-06). |
| S2 | default (`admin-tiers-desktop/-mobile.png`) | tier fields in a multi-column grid at 1280, fewer columns at 768, one column at 375; text ≥12px (DV-M14-11). |
| S3 | default (`admin-challenges-desktop/-mobile.png`) | as S2; delete confirm "Padam cabaran ini?". |
| S4 | default, empty (`admin-students-*.png`, `admin-students-empty.png`) | filter + award card; table scrolls in its card below 768; pager "« Previous / Next »" below 640. |
| S5 | default, refund empty (`admin-transactions-*.png`, `admin-transactions-empty.png`) | as S4; "Reset" only with a filter. |
| S6 | default, badge edit, reward form (`admin-guru-*.png`) | 4 cards (2 a row at 375); badge table scrolls in its card; "Edit" toggles an inline form. |
| S7 | `admin-guru-tebusan.png` | pills wrap; empty text per status. |
| S8 | `admin-guru-tunai-desktop/-mobile.png` | 4 cards; pills; table scrolls in its card; bank details masked. |
| S9 | `admin-pengaturan-desktop/-mobile.png` | settings rows full width; live rate preview. |
| S10 | `admin-reward-control-desktop.png` (draw form open), `-mobile.png` | 3 tiles stacked at 375; cost table scrolls in its card; `<details>` form. |
| S11 | `gamification-desktop/-tablet/-mobile.png` | hero, 4 stat cards (2 a row at 375, 4 across from 768), two columns (challenges / transactions) at 1280, one column below; tier grid 2 / 2 / 4 (v1.6, per live). |
| S12 | `convert-desktop.png`, `convert-below-min.png`, `convert-mobile.png` | form card; the tier-rate list is stacked (one tier per row) at every width; the page is two columns from `lg` (v1.6, per live; not a 2 / 2 / 4 grid). |
| S13 | `challenges-desktop/-mobile.png` | card grid, one column at 375, 768 and 1280 (v1.6). |
| S14 | `leaderboard-desktop/-mobile.png` | podium of 3 narrow cards at 375 without page overflow (DV-M14-07). |
| S15 | `achievements-desktop/-mobile.png`, `achievements-share-modal.png` | badge grid 4–5 / 3 / 2 columns; share modal centred (full width at 375). |
| S16 | `referral-desktop/-mobile.png` | tiles and share buttons stack at 375. |
| S17 | `history-desktop.png`, `history-empty.png`, `history-mobile.png` | rows full width; pills wrap. |
| S18 | `kad-kongsi-profil/-kombo/-penguasaan/-ranking/-mobile.png` | tabs; one card set at a time; labels ≥12px (DV-M14-11). |
| S19 | `guru-gamifikasi-desktop/-mobile.png` | cards, badge tiles (≥12px), catalogue, history, buttons stacked at 375. |
| S20 | `guru-tebus-tunai-desktop.png`, `-preview.png`, `-mobile.png` | cards; form one column at 375; preview appears only for a valid amount. |
| S21 | `guru-kedai.png` | empty state card. |
| S22 | `guru-leaderboard-sekolah.png`, `-global.png`, `-mobile.png` | tabs; table scrolls in its card at 375. |

Loading: every screen shows the shared shell loading behaviour while the mock responds (live pages are server-rendered). Errors outside the observed validation use the global error convention of M01. Success and error messages after a POST were never observed on live; they are PROPOSED COPY (SRS §8.2) and every AC asserting them is provisional.

---

## 6. Coverage matrix (completeness proof)

Source: `docs/discovery/inventory/M14/` (generated 2026-09-25/26). Generated by script (`matrix.cjs` in the author's scratchpad `m14-writer/`, from the Function catalogue `fns.cjs` and the inventory JSON). Every M14 content element (S1–S22) is listed with the Function that covers it or with a concrete exclusion reason; each element maps to exactly one entry. The shells (SHA, SHU) belong to the global shell / M23; their M14-relevant elements (M14 menu entries, header titles, the koin / mata / hari chips) are mapped, and every other shell element is excluded with its owner. "Content" quotes the DOM text as captured (`<masked>`, `<person>`, `<name>` = discovery privacy mask).

**Summary**

| Set | Elements | Mapped to an M14 Function | Excluded (with reason) | Unmapped |
|---|---|---|---|---|
| S1 — `/admin/gamification` | 49 | 49 | 0 | 0 |
| S2 — `/admin/gamification/tiers` | 204 | 204 | 0 | 0 |
| S3 — `/admin/gamification/challenges` | 347 | 347 | 0 | 0 |
| S4 — `/admin/gamification/students` | 46 | 46 | 0 | 0 |
| S5 — `/admin/gamification/transactions` | 37 | 37 | 0 | 0 |
| S6 — `/admin/gamifikasi/guru` | 179 | 179 | 0 | 0 |
| S7 — `/admin/gamifikasi/guru/tebusan` | 11 | 11 | 0 | 0 |
| S8 — `/admin/gamifikasi/guru/tunai` | 29 | 29 | 0 | 0 |
| S9 — `/admin/gamifikasi/pengaturan` | 63 | 63 | 0 | 0 |
| S10 — `/admin/reward-control` | 55 | 55 | 0 | 0 |
| S11 — `/gamification` | 133 | 130 | 3 | 0 |
| S12 — `/gamification/convert` | 52 | 49 | 3 | 0 |
| S13 — `/gamification/challenges` | 97 | 94 | 3 | 0 |
| S14 — `/gamification/leaderboard` | 45 | 42 | 3 | 0 |
| S15 — `/gamification/achievements` | 150 | 147 | 3 | 0 |
| S16 — `/gamification/referral` | 26 | 23 | 3 | 0 |
| S17 — `/gamification/history` | 32 | 29 | 3 | 0 |
| S18 — `/gamification/kad-kongsi` | 73 | 70 | 3 | 0 |
| S19 — `/guru/gamifikasi` | 63 | 60 | 3 | 0 |
| S20 — `/guru/gamifikasi/tebus-tunai` | 47 | 44 | 3 | 0 |
| S21 — `/guru/gamifikasi/kedai` | 12 | 9 | 3 | 0 |
| S22 — `/guru/gamifikasi/leaderboard` | 9 | 6 | 3 | 0 |
| **M14 content (S1–S22)** | **1759** | **1723** | **36** (M16 tournament banner "LIVE:", "MAIN", "DAFTAR" on S11–S22, EL-M14-S11…S22-001–003) | **0** |
| Admin panel shell SHA (chrome of S1–S10) | 218 | 26 | 192 (global shell / M23, M15 entries, M22 bell and chatbot, M16) | 0 |
| User-portal shell SHU (chrome of S11–S22) | 382 | 43 | 339 (global shell / M23, M15 entries, M22 bell and chatbot, M16) | 0 |

**1759/1759 M14 content elements covered (1723 mapped, 36 excluded with reason), 0 unmapped.** Including the shells: 2359/2359 elements accounted for (1792 mapped, 567 excluded with reason), 0 unmapped. 132 Functions appear in this matrix; the other 51 are behaviour-only Functions (access rules, earning and spending rules, unobservable or PROPOSED states, cross-cutting rules) with no element of their own.

### 6.1 M14 content elements

#### S1 — `/admin/gamification` (49 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M14-S1-001 | heading | visible-default | "🎮 Gamifikasi Overview" | FN-M14-9.1.1 |
| EL-M14-S1-002 | text | visible-default | "Pantau sistem gamifikasi PRESTASIPLUS" | FN-M14-9.1.1 |
| EL-M14-S1-003 | text | visible-default | "2,255" | FN-M14-9.1.2 |
| EL-M14-S1-004 | text | visible-default | "Pelajar Aktif" | FN-M14-9.1.2 |
| EL-M14-S1-005 | text | visible-default | "3,124,046" | FN-M14-9.1.2 |
| EL-M14-S1-006 | text | visible-default | "Syiling Dijana" | FN-M14-9.1.2 |
| EL-M14-S1-007 | text | visible-default | "7,793" | FN-M14-9.1.2 |
| EL-M14-S1-008 | text | visible-default | "Token Ditukar" | FN-M14-9.1.2 |
| EL-M14-S1-009 | text | visible-default | "533" | FN-M14-9.1.2 |
| EL-M14-S1-010 | text | visible-default | "Penukaran" | FN-M14-9.1.2 |
| EL-M14-S1-011 | text | visible-default | "10" | FN-M14-9.1.2 |
| EL-M14-S1-012 | text | visible-default | "Cabaran Aktif" | FN-M14-9.1.2 |
| EL-M14-S1-013 | text | visible-default | "0" | FN-M14-9.1.2 |
| EL-M14-S1-014 | text | visible-default | "Siap Hari Ini" | FN-M14-9.1.2 |
| EL-M14-S1-015 | card | visible-default | "bronze" | FN-M14-9.1.3 |
| EL-M14-S1-016 | text | visible-default | "Taburan Tier", fa-crown | FN-M14-9.1.3 |
| EL-M14-S1-017 | text | visible-default | "bronze" | FN-M14-9.1.3 |
| EL-M14-S1-018 | text | visible-default | "1889" | FN-M14-9.1.3 |
| EL-M14-S1-019 | text | visible-default | "84%" | FN-M14-9.1.3 |
| EL-M14-S1-020 | text | visible-default | "gold" | FN-M14-9.1.3 |
| EL-M14-S1-021 | text | visible-default | "41" | FN-M14-9.1.3 |
| EL-M14-S1-022 | text | visible-default | "2%" | FN-M14-9.1.3 |
| EL-M14-S1-023 | text | visible-default | "platinum" | FN-M14-9.1.3 |
| EL-M14-S1-024 | text | visible-default | "33" | FN-M14-9.1.3 |
| EL-M14-S1-025 | text | visible-default | "1%" | FN-M14-9.1.3 |
| EL-M14-S1-026 | text | visible-default | "silver" | FN-M14-9.1.3 |
| EL-M14-S1-027 | text | visible-default | "292" | FN-M14-9.1.3 |
| EL-M14-S1-028 | text | visible-default | "13%" | FN-M14-9.1.3 |
| EL-M14-S1-029 | card | visible-default | "#1" | FN-M14-9.1.4 |
| EL-M14-S1-030 | text | visible-default | "Top 10 Pelajar", fa-trophy | FN-M14-9.1.4 |
| EL-M14-S1-031 | text | visible-default | "#1" | FN-M14-9.1.4 |
| EL-M14-S1-032 | text | visible-default | "<masked>" | FN-M14-9.1.4 |
| EL-M14-S1-033 | text | visible-default | "platinum · Level 66" | FN-M14-9.1.4 |
| EL-M14-S1-034 | text | visible-default | "1,018,083" | FN-M14-9.1.4 |
| EL-M14-S1-035 | text | visible-default | "syiling" | FN-M14-9.1.4 |
| EL-M14-S1-036 | text | visible-default | "#2" | FN-M14-9.1.4 |
| EL-M14-S1-037 | text | visible-default | "<masked>" | FN-M14-9.1.4 |
| EL-M14-S1-038 | text | visible-default | "platinum · Level 62" | FN-M14-9.1.4 |
| EL-M14-S1-039 | text | visible-default | "686,730" | FN-M14-9.1.4 |
| EL-M14-S1-040 | text | visible-default | "syiling" | FN-M14-9.1.4 |
| EL-M14-S1-041 | text | visible-default | "#3" | FN-M14-9.1.4 |
| EL-M14-S1-042 | text | visible-default | "<masked>" | FN-M14-9.1.4 |
| EL-M14-S1-043 | text | visible-default | "platinum · Level 45" | FN-M14-9.1.4 |
| EL-M14-S1-044 | text | visible-default | "135,760" | FN-M14-9.1.4 |
| EL-M14-S1-045 | text | visible-default | "syiling" | FN-M14-9.1.4 |
| EL-M14-S1-046 | card | visible-default | "Lihat semua →" | FN-M14-9.1.5 |
| EL-M14-S1-047 | text | visible-default | "Transaksi Terkini", fa-history | FN-M14-9.1.5 |
| EL-M14-S1-048 | link | visible-default | "Lihat semua →", → /admin/gamification/transactions | FN-M14-9.1.5 |
| EL-M14-S1-049 | table | visible-default | table | FN-M14-9.1.5 |

#### S2 — `/admin/gamification/tiers` (204 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M14-S2-001 | heading | visible-default | "👑 Tier Configuration" | FN-M14-9.2.1 |
| EL-M14-S2-002 | text | visible-default | "Urus tier sistem gamifikasi — termasuk ganjaran Syiling per soalan" | FN-M14-9.2.1 |
| EL-M14-S2-003 | card | visible-default | "Senarai Tier" | FN-M14-9.2.1 |
| EL-M14-S2-004 | heading | visible-default | "Senarai Tier" | FN-M14-9.2.1 |
| EL-M14-S2-005 | form | visible-default | form | FN-M14-9.2.2 |
| EL-M14-S2-006 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-9.2.2 |
| EL-M14-S2-007 | hidden-field | hidden-only | hidden-field, name=_method, type=hidden | FN-M14-9.2.2 |
| EL-M14-S2-008 | text | visible-default | "🥉" | FN-M14-9.2.2 |
| EL-M14-S2-009 | label | visible-default | "Label BM" | FN-M14-9.2.2 |
| EL-M14-S2-010 | input | visible-default | input, name=label_ms, type=text | FN-M14-9.2.2 |
| EL-M14-S2-011 | label | visible-default | "Icon" | FN-M14-9.2.2 |
| EL-M14-S2-012 | input | visible-default | input, name=icon, type=text | FN-M14-9.2.2 |
| EL-M14-S2-013 | label | visible-default | "Warna" | FN-M14-9.2.2 |
| EL-M14-S2-014 | input | visible-default | input, name=color, type=color | FN-M14-9.2.2 |
| EL-M14-S2-015 | label | visible-default | "Min Syiling" | FN-M14-9.2.2 |
| EL-M14-S2-016 | input | visible-default | input, name=min_syiling, type=number | FN-M14-9.2.2 |
| EL-M14-S2-017 | label | visible-default | "Kadar" | FN-M14-9.2.2 |
| EL-M14-S2-018 | input | visible-default | input, name=conversion_rate, type=number | FN-M14-9.2.2 |
| EL-M14-S2-019 | label | visible-default | "Urutan" | FN-M14-9.2.2 |
| EL-M14-S2-020 | input | visible-default | input, name=sort_order, type=number | FN-M14-9.2.2 |
| EL-M14-S2-021 | button | visible-default | button, type=submit, fa-save | FN-M14-9.2.2 |
| EL-M14-S2-022 | text | visible-default | "📝 Latih Tubi — Syiling per Jawab Betul" | FN-M14-9.2.3 |
| EL-M14-S2-023 | text | visible-default | "L1" | FN-M14-9.2.3 |
| EL-M14-S2-024 | input | visible-default | input, name=quiz_reward_l1, type=number | FN-M14-9.2.3 |
| EL-M14-S2-025 | text | visible-default | "L2" | FN-M14-9.2.3 |
| EL-M14-S2-026 | input | visible-default | input, name=quiz_reward_l2, type=number | FN-M14-9.2.3 |
| EL-M14-S2-027 | text | visible-default | "L3" | FN-M14-9.2.3 |
| EL-M14-S2-028 | input | visible-default | input, name=quiz_reward_l3, type=number | FN-M14-9.2.3 |
| EL-M14-S2-029 | text | visible-default | "L4" | FN-M14-9.2.3 |
| EL-M14-S2-030 | input | visible-default | input, name=quiz_reward_l4, type=number | FN-M14-9.2.3 |
| EL-M14-S2-031 | text | visible-default | "L5" | FN-M14-9.2.3 |
| EL-M14-S2-032 | input | visible-default | input, name=quiz_reward_l5, type=number | FN-M14-9.2.3 |
| EL-M14-S2-033 | text | visible-default | "🛡️ PKSK — Syiling per Jawab Betul" | FN-M14-9.2.4 |
| EL-M14-S2-034 | input | visible-default | input, name=pksk_reward_correct, type=number | FN-M14-9.2.4 |
| EL-M14-S2-035 | text | visible-default | "Semua soalan PKSK (tiada level)" | FN-M14-9.2.4 |
| EL-M14-S2-036 | text | visible-default | "🎲 Papan Bijak — Syiling" | FN-M14-9.2.5 |
| EL-M14-S2-037 | label | visible-default | "Jawab Betul" | FN-M14-9.2.5 |
| EL-M14-S2-038 | input | visible-default | input, name=board_game_reward_correct, type=number | FN-M14-9.2.5 |
| EL-M14-S2-039 | label | visible-default | "Menang" | FN-M14-9.2.5 |
| EL-M14-S2-040 | input | visible-default | input, name=board_game_reward_win, type=number | FN-M14-9.2.5 |
| EL-M14-S2-041 | hidden-field | hidden-only | hidden-field, name=perks, type=hidden | FN-M14-9.2.6 |
| EL-M14-S2-042 | form | visible-default | form | FN-M14-9.2.7 |
| EL-M14-S2-043 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-9.2.7 |
| EL-M14-S2-044 | button | visible-default | "🔴 Nyahaktif", type=submit | FN-M14-9.2.7 |
| EL-M14-S2-045 | form | visible-default | form | FN-M14-9.2.2 |
| EL-M14-S2-046 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-9.2.2 |
| EL-M14-S2-047 | hidden-field | hidden-only | hidden-field, name=_method, type=hidden | FN-M14-9.2.2 |
| EL-M14-S2-048 | text | visible-default | "🥈" | FN-M14-9.2.2 |
| EL-M14-S2-049 | label | visible-default | "Label BM" | FN-M14-9.2.2 |
| EL-M14-S2-050 | input | visible-default | input, name=label_ms, type=text | FN-M14-9.2.2 |
| EL-M14-S2-051 | label | visible-default | "Icon" | FN-M14-9.2.2 |
| EL-M14-S2-052 | input | visible-default | input, name=icon, type=text | FN-M14-9.2.2 |
| EL-M14-S2-053 | label | visible-default | "Warna" | FN-M14-9.2.2 |
| EL-M14-S2-054 | input | visible-default | input, name=color, type=color | FN-M14-9.2.2 |
| EL-M14-S2-055 | label | visible-default | "Min Syiling" | FN-M14-9.2.2 |
| EL-M14-S2-056 | input | visible-default | input, name=min_syiling, type=number | FN-M14-9.2.2 |
| EL-M14-S2-057 | label | visible-default | "Kadar" | FN-M14-9.2.2 |
| EL-M14-S2-058 | input | visible-default | input, name=conversion_rate, type=number | FN-M14-9.2.2 |
| EL-M14-S2-059 | label | visible-default | "Urutan" | FN-M14-9.2.2 |
| EL-M14-S2-060 | input | visible-default | input, name=sort_order, type=number | FN-M14-9.2.2 |
| EL-M14-S2-061 | button | visible-default | button, type=submit, fa-save | FN-M14-9.2.2 |
| EL-M14-S2-062 | text | visible-default | "📝 Latih Tubi — Syiling per Jawab Betul" | FN-M14-9.2.3 |
| EL-M14-S2-063 | text | visible-default | "L1" | FN-M14-9.2.3 |
| EL-M14-S2-064 | input | visible-default | input, name=quiz_reward_l1, type=number | FN-M14-9.2.3 |
| EL-M14-S2-065 | text | visible-default | "L2" | FN-M14-9.2.3 |
| EL-M14-S2-066 | input | visible-default | input, name=quiz_reward_l2, type=number | FN-M14-9.2.3 |
| EL-M14-S2-067 | text | visible-default | "L3" | FN-M14-9.2.3 |
| EL-M14-S2-068 | input | visible-default | input, name=quiz_reward_l3, type=number | FN-M14-9.2.3 |
| EL-M14-S2-069 | text | visible-default | "L4" | FN-M14-9.2.3 |
| EL-M14-S2-070 | input | visible-default | input, name=quiz_reward_l4, type=number | FN-M14-9.2.3 |
| EL-M14-S2-071 | text | visible-default | "L5" | FN-M14-9.2.3 |
| EL-M14-S2-072 | input | visible-default | input, name=quiz_reward_l5, type=number | FN-M14-9.2.3 |
| EL-M14-S2-073 | text | visible-default | "🛡️ PKSK — Syiling per Jawab Betul" | FN-M14-9.2.4 |
| EL-M14-S2-074 | input | visible-default | input, name=pksk_reward_correct, type=number | FN-M14-9.2.4 |
| EL-M14-S2-075 | text | visible-default | "Semua soalan PKSK (tiada level)" | FN-M14-9.2.4 |
| EL-M14-S2-076 | text | visible-default | "🎲 Papan Bijak — Syiling" | FN-M14-9.2.5 |
| EL-M14-S2-077 | label | visible-default | "Jawab Betul" | FN-M14-9.2.5 |
| EL-M14-S2-078 | input | visible-default | input, name=board_game_reward_correct, type=number | FN-M14-9.2.5 |
| EL-M14-S2-079 | label | visible-default | "Menang" | FN-M14-9.2.5 |
| EL-M14-S2-080 | input | visible-default | input, name=board_game_reward_win, type=number | FN-M14-9.2.5 |
| EL-M14-S2-081 | hidden-field | hidden-only | hidden-field, name=perks, type=hidden | FN-M14-9.2.6 |
| EL-M14-S2-082 | form | visible-default | form | FN-M14-9.2.7 |
| EL-M14-S2-083 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-9.2.7 |
| EL-M14-S2-084 | button | visible-default | "🔴 Nyahaktif", type=submit | FN-M14-9.2.7 |
| EL-M14-S2-085 | form | visible-default | form | FN-M14-9.2.2 |
| EL-M14-S2-086 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-9.2.2 |
| EL-M14-S2-087 | hidden-field | hidden-only | hidden-field, name=_method, type=hidden | FN-M14-9.2.2 |
| EL-M14-S2-088 | text | visible-default | "🥇" | FN-M14-9.2.2 |
| EL-M14-S2-089 | label | visible-default | "Label BM" | FN-M14-9.2.2 |
| EL-M14-S2-090 | input | visible-default | input, name=label_ms, type=text | FN-M14-9.2.2 |
| EL-M14-S2-091 | label | visible-default | "Icon" | FN-M14-9.2.2 |
| EL-M14-S2-092 | input | visible-default | input, name=icon, type=text | FN-M14-9.2.2 |
| EL-M14-S2-093 | label | visible-default | "Warna" | FN-M14-9.2.2 |
| EL-M14-S2-094 | input | visible-default | input, name=color, type=color | FN-M14-9.2.2 |
| EL-M14-S2-095 | label | visible-default | "Min Syiling" | FN-M14-9.2.2 |
| EL-M14-S2-096 | input | visible-default | input, name=min_syiling, type=number | FN-M14-9.2.2 |
| EL-M14-S2-097 | label | visible-default | "Kadar" | FN-M14-9.2.2 |
| EL-M14-S2-098 | input | visible-default | input, name=conversion_rate, type=number | FN-M14-9.2.2 |
| EL-M14-S2-099 | label | visible-default | "Urutan" | FN-M14-9.2.2 |
| EL-M14-S2-100 | input | visible-default | input, name=sort_order, type=number | FN-M14-9.2.2 |
| EL-M14-S2-101 | button | visible-default | button, type=submit, fa-save | FN-M14-9.2.2 |
| EL-M14-S2-102 | text | visible-default | "📝 Latih Tubi — Syiling per Jawab Betul" | FN-M14-9.2.3 |
| EL-M14-S2-103 | text | visible-default | "L1" | FN-M14-9.2.3 |
| EL-M14-S2-104 | input | visible-default | input, name=quiz_reward_l1, type=number | FN-M14-9.2.3 |
| EL-M14-S2-105 | text | visible-default | "L2" | FN-M14-9.2.3 |
| EL-M14-S2-106 | input | visible-default | input, name=quiz_reward_l2, type=number | FN-M14-9.2.3 |
| EL-M14-S2-107 | text | visible-default | "L3" | FN-M14-9.2.3 |
| EL-M14-S2-108 | input | visible-default | input, name=quiz_reward_l3, type=number | FN-M14-9.2.3 |
| EL-M14-S2-109 | text | visible-default | "L4" | FN-M14-9.2.3 |
| EL-M14-S2-110 | input | visible-default | input, name=quiz_reward_l4, type=number | FN-M14-9.2.3 |
| EL-M14-S2-111 | text | visible-default | "L5" | FN-M14-9.2.3 |
| EL-M14-S2-112 | input | visible-default | input, name=quiz_reward_l5, type=number | FN-M14-9.2.3 |
| EL-M14-S2-113 | text | visible-default | "🛡️ PKSK — Syiling per Jawab Betul" | FN-M14-9.2.4 |
| EL-M14-S2-114 | input | visible-default | input, name=pksk_reward_correct, type=number | FN-M14-9.2.4 |
| EL-M14-S2-115 | text | visible-default | "Semua soalan PKSK (tiada level)" | FN-M14-9.2.4 |
| EL-M14-S2-116 | text | visible-default | "🎲 Papan Bijak — Syiling" | FN-M14-9.2.5 |
| EL-M14-S2-117 | label | visible-default | "Jawab Betul" | FN-M14-9.2.5 |
| EL-M14-S2-118 | input | visible-default | input, name=board_game_reward_correct, type=number | FN-M14-9.2.5 |
| EL-M14-S2-119 | label | visible-default | "Menang" | FN-M14-9.2.5 |
| EL-M14-S2-120 | input | visible-default | input, name=board_game_reward_win, type=number | FN-M14-9.2.5 |
| EL-M14-S2-121 | hidden-field | hidden-only | hidden-field, name=perks, type=hidden | FN-M14-9.2.6 |
| EL-M14-S2-122 | form | visible-default | form | FN-M14-9.2.7 |
| EL-M14-S2-123 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-9.2.7 |
| EL-M14-S2-124 | button | visible-default | "🔴 Nyahaktif", type=submit | FN-M14-9.2.7 |
| EL-M14-S2-125 | form | visible-default | form | FN-M14-9.2.2 |
| EL-M14-S2-126 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-9.2.2 |
| EL-M14-S2-127 | hidden-field | hidden-only | hidden-field, name=_method, type=hidden | FN-M14-9.2.2 |
| EL-M14-S2-128 | text | visible-default | "💎" | FN-M14-9.2.2 |
| EL-M14-S2-129 | label | visible-default | "Label BM" | FN-M14-9.2.2 |
| EL-M14-S2-130 | input | visible-default | input, name=label_ms, type=text | FN-M14-9.2.2 |
| EL-M14-S2-131 | label | visible-default | "Icon" | FN-M14-9.2.2 |
| EL-M14-S2-132 | input | visible-default | input, name=icon, type=text | FN-M14-9.2.2 |
| EL-M14-S2-133 | label | visible-default | "Warna" | FN-M14-9.2.2 |
| EL-M14-S2-134 | input | visible-default | input, name=color, type=color | FN-M14-9.2.2 |
| EL-M14-S2-135 | label | visible-default | "Min Syiling" | FN-M14-9.2.2 |
| EL-M14-S2-136 | input | visible-default | input, name=min_syiling, type=number | FN-M14-9.2.2 |
| EL-M14-S2-137 | label | visible-default | "Kadar" | FN-M14-9.2.2 |
| EL-M14-S2-138 | input | visible-default | input, name=conversion_rate, type=number | FN-M14-9.2.2 |
| EL-M14-S2-139 | label | visible-default | "Urutan" | FN-M14-9.2.2 |
| EL-M14-S2-140 | input | visible-default | input, name=sort_order, type=number | FN-M14-9.2.2 |
| EL-M14-S2-141 | button | visible-default | button, type=submit, fa-save | FN-M14-9.2.2 |
| EL-M14-S2-142 | text | visible-default | "📝 Latih Tubi — Syiling per Jawab Betul" | FN-M14-9.2.3 |
| EL-M14-S2-143 | text | visible-default | "L1" | FN-M14-9.2.3 |
| EL-M14-S2-144 | input | visible-default | input, name=quiz_reward_l1, type=number | FN-M14-9.2.3 |
| EL-M14-S2-145 | text | visible-default | "L2" | FN-M14-9.2.3 |
| EL-M14-S2-146 | input | visible-default | input, name=quiz_reward_l2, type=number | FN-M14-9.2.3 |
| EL-M14-S2-147 | text | visible-default | "L3" | FN-M14-9.2.3 |
| EL-M14-S2-148 | input | visible-default | input, name=quiz_reward_l3, type=number | FN-M14-9.2.3 |
| EL-M14-S2-149 | text | visible-default | "L4" | FN-M14-9.2.3 |
| EL-M14-S2-150 | input | visible-default | input, name=quiz_reward_l4, type=number | FN-M14-9.2.3 |
| EL-M14-S2-151 | text | visible-default | "L5" | FN-M14-9.2.3 |
| EL-M14-S2-152 | input | visible-default | input, name=quiz_reward_l5, type=number | FN-M14-9.2.3 |
| EL-M14-S2-153 | text | visible-default | "🛡️ PKSK — Syiling per Jawab Betul" | FN-M14-9.2.4 |
| EL-M14-S2-154 | input | visible-default | input, name=pksk_reward_correct, type=number | FN-M14-9.2.4 |
| EL-M14-S2-155 | text | visible-default | "Semua soalan PKSK (tiada level)" | FN-M14-9.2.4 |
| EL-M14-S2-156 | text | visible-default | "🎲 Papan Bijak — Syiling" | FN-M14-9.2.5 |
| EL-M14-S2-157 | label | visible-default | "Jawab Betul" | FN-M14-9.2.5 |
| EL-M14-S2-158 | input | visible-default | input, name=board_game_reward_correct, type=number | FN-M14-9.2.5 |
| EL-M14-S2-159 | label | visible-default | "Menang" | FN-M14-9.2.5 |
| EL-M14-S2-160 | input | visible-default | input, name=board_game_reward_win, type=number | FN-M14-9.2.5 |
| EL-M14-S2-161 | hidden-field | hidden-only | hidden-field, name=perks, type=hidden | FN-M14-9.2.6 |
| EL-M14-S2-162 | form | visible-default | form | FN-M14-9.2.7 |
| EL-M14-S2-163 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-9.2.7 |
| EL-M14-S2-164 | button | visible-default | "🔴 Nyahaktif", type=submit | FN-M14-9.2.7 |
| EL-M14-S2-165 | card | visible-default | "➕ Tambah Tier Baru" | FN-M14-9.2.8 |
| EL-M14-S2-166 | heading | visible-default | "➕ Tambah Tier Baru" | FN-M14-9.2.8 |
| EL-M14-S2-167 | form | visible-default | form | FN-M14-9.2.8 |
| EL-M14-S2-168 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-9.2.8 |
| EL-M14-S2-169 | label | visible-default | "Nama Tier (eng)" | FN-M14-9.2.8 |
| EL-M14-S2-170 | input | visible-default | input, name=tier_name, type=text | FN-M14-9.2.8 |
| EL-M14-S2-171 | label | visible-default | "Label BM" | FN-M14-9.2.8 |
| EL-M14-S2-172 | input | visible-default | input, name=label_ms, type=text | FN-M14-9.2.8 |
| EL-M14-S2-173 | label | visible-default | "Icon" | FN-M14-9.2.8 |
| EL-M14-S2-174 | input | visible-default | input, name=icon, type=text | FN-M14-9.2.8 |
| EL-M14-S2-175 | label | visible-default | "Warna" | FN-M14-9.2.8 |
| EL-M14-S2-176 | input | visible-default | input, name=color, type=color | FN-M14-9.2.8 |
| EL-M14-S2-177 | label | visible-default | "Min Syiling" | FN-M14-9.2.8 |
| EL-M14-S2-178 | input | visible-default | input, name=min_syiling, type=number | FN-M14-9.2.8 |
| EL-M14-S2-179 | label | visible-default | "Kadar Penukaran" | FN-M14-9.2.8 |
| EL-M14-S2-180 | input | visible-default | input, name=conversion_rate, type=number | FN-M14-9.2.8 |
| EL-M14-S2-181 | label | visible-default | "Urutan" | FN-M14-9.2.8 |
| EL-M14-S2-182 | input | visible-default | input, name=sort_order, type=number | FN-M14-9.2.8 |
| EL-M14-S2-183 | label | visible-default | "Perks" | FN-M14-9.2.8 |
| EL-M14-S2-184 | input | visible-default | input, name=perks, type=text | FN-M14-9.2.8 |
| EL-M14-S2-185 | text | visible-default | "📝 Latih Tubi — Syiling per Jawab Betul" | FN-M14-9.2.8 |
| EL-M14-S2-186 | text | visible-default | "L1" | FN-M14-9.2.8 |
| EL-M14-S2-187 | input | visible-default | input, name=quiz_reward_l1, type=number | FN-M14-9.2.8 |
| EL-M14-S2-188 | text | visible-default | "L2" | FN-M14-9.2.8 |
| EL-M14-S2-189 | input | visible-default | input, name=quiz_reward_l2, type=number | FN-M14-9.2.8 |
| EL-M14-S2-190 | text | visible-default | "L3" | FN-M14-9.2.8 |
| EL-M14-S2-191 | input | visible-default | input, name=quiz_reward_l3, type=number | FN-M14-9.2.8 |
| EL-M14-S2-192 | text | visible-default | "L4" | FN-M14-9.2.8 |
| EL-M14-S2-193 | input | visible-default | input, name=quiz_reward_l4, type=number | FN-M14-9.2.8 |
| EL-M14-S2-194 | text | visible-default | "L5" | FN-M14-9.2.8 |
| EL-M14-S2-195 | input | visible-default | input, name=quiz_reward_l5, type=number | FN-M14-9.2.8 |
| EL-M14-S2-196 | text | visible-default | "🛡️ PKSK — Syiling per Jawab Betul" | FN-M14-9.2.8 |
| EL-M14-S2-197 | input | visible-default | input, name=pksk_reward_correct, type=number | FN-M14-9.2.8 |
| EL-M14-S2-198 | text | visible-default | "Semua soalan PKSK (tiada level)" | FN-M14-9.2.8 |
| EL-M14-S2-199 | text | visible-default | "🎲 Papan Bijak — Syiling" | FN-M14-9.2.8 |
| EL-M14-S2-200 | label | visible-default | "Jawab Betul" | FN-M14-9.2.8 |
| EL-M14-S2-201 | input | visible-default | input, name=board_game_reward_correct, type=number | FN-M14-9.2.8 |
| EL-M14-S2-202 | label | visible-default | "Menang" | FN-M14-9.2.8 |
| EL-M14-S2-203 | input | visible-default | input, name=board_game_reward_win, type=number | FN-M14-9.2.8 |
| EL-M14-S2-204 | button | visible-default | "Tambah Tier", type=submit, fa-plus | FN-M14-9.2.8 |

#### S3 — `/admin/gamification/challenges` (347 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M14-S3-001 | heading | visible-default | "🎯 Cabaran Harian" | FN-M14-9.3.1 |
| EL-M14-S3-002 | text | visible-default | "Urus cabaran harian untuk pelajar" | FN-M14-9.3.1 |
| EL-M14-S3-003 | card | visible-default | "Senarai Cabaran (10)" | FN-M14-9.3.1 |
| EL-M14-S3-004 | heading | visible-default | "Senarai Cabaran (10)" | FN-M14-9.3.1 |
| EL-M14-S3-005 | form | visible-default | form | FN-M14-9.3.2 |
| EL-M14-S3-006 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-9.3.2 |
| EL-M14-S3-007 | hidden-field | hidden-only | hidden-field, name=_method, type=hidden | FN-M14-9.3.2 |
| EL-M14-S3-008 | text | visible-default | "📝" | FN-M14-9.3.2 |
| EL-M14-S3-009 | text | visible-default | "Rajin Berlatih" | FN-M14-9.3.2 |
| EL-M14-S3-010 | badge | visible-default | "Mudah" | FN-M14-9.3.2 |
| EL-M14-S3-011 | label | visible-default | "Tajuk" | FN-M14-9.3.3 |
| EL-M14-S3-012 | input | visible-default | input, name=title, type=text | FN-M14-9.3.3 |
| EL-M14-S3-013 | label | visible-default | "Keterangan" | FN-M14-9.3.3 |
| EL-M14-S3-014 | input | visible-default | input, name=description, type=text | FN-M14-9.3.3 |
| EL-M14-S3-015 | label | visible-default | "Icon" | FN-M14-9.3.3 |
| EL-M14-S3-016 | input | visible-default | input, name=icon, type=text | FN-M14-9.3.3 |
| EL-M14-S3-017 | label | visible-default | "Jenis" | FN-M14-9.3.4 |
| EL-M14-S3-018 | select | visible-default | select, name=challenge_type | FN-M14-9.3.4 |
| EL-M14-S3-019 | label | visible-default | "Sasaran" | FN-M14-9.3.3 |
| EL-M14-S3-020 | input | visible-default | input, name=target_value, type=number | FN-M14-9.3.3 |
| EL-M14-S3-021 | label | visible-default | "Ganjaran Syiling" | FN-M14-9.3.3 |
| EL-M14-S3-022 | input | visible-default | input, name=reward_syiling, type=number | FN-M14-9.3.3 |
| EL-M14-S3-023 | label | visible-default | "Ganjaran XP" | FN-M14-9.3.3 |
| EL-M14-S3-024 | input | visible-default | input, name=reward_xp, type=number | FN-M14-9.3.3 |
| EL-M14-S3-025 | label | visible-default | "Kesukaran" | FN-M14-9.3.3 |
| EL-M14-S3-026 | select | visible-default | select, name=difficulty | FN-M14-9.3.3 |
| EL-M14-S3-027 | label | visible-default | "Urutan" | FN-M14-9.3.3 |
| EL-M14-S3-028 | input | visible-default | input, name=sort_order, type=number | FN-M14-9.3.3 |
| EL-M14-S3-029 | button | visible-default | "Simpan", type=submit, fa-save | FN-M14-9.3.3 |
| EL-M14-S3-030 | form | visible-default | form | FN-M14-9.3.5 |
| EL-M14-S3-031 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-9.3.5 |
| EL-M14-S3-032 | button | visible-default | "🔴 Nyahaktif", type=submit | FN-M14-9.3.5 |
| EL-M14-S3-033 | form | visible-default | form | FN-M14-9.3.6 |
| EL-M14-S3-034 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-9.3.6 |
| EL-M14-S3-035 | hidden-field | hidden-only | hidden-field, name=_method, type=hidden | FN-M14-9.3.6 |
| EL-M14-S3-036 | button | visible-default | "Padam", type=submit, fa-trash | FN-M14-9.3.6 |
| EL-M14-S3-037 | form | visible-default | form | FN-M14-9.3.2 |
| EL-M14-S3-038 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-9.3.2 |
| EL-M14-S3-039 | hidden-field | hidden-only | hidden-field, name=_method, type=hidden | FN-M14-9.3.2 |
| EL-M14-S3-040 | text | visible-default | "🎯" | FN-M14-9.3.2 |
| EL-M14-S3-041 | text | visible-default | "Si Tepat" | FN-M14-9.3.2 |
| EL-M14-S3-042 | badge | visible-default | "Sederhana" | FN-M14-9.3.2 |
| EL-M14-S3-043 | label | visible-default | "Tajuk" | FN-M14-9.3.3 |
| EL-M14-S3-044 | input | visible-default | input, name=title, type=text | FN-M14-9.3.3 |
| EL-M14-S3-045 | label | visible-default | "Keterangan" | FN-M14-9.3.3 |
| EL-M14-S3-046 | input | visible-default | input, name=description, type=text | FN-M14-9.3.3 |
| EL-M14-S3-047 | label | visible-default | "Icon" | FN-M14-9.3.3 |
| EL-M14-S3-048 | input | visible-default | input, name=icon, type=text | FN-M14-9.3.3 |
| EL-M14-S3-049 | label | visible-default | "Jenis" | FN-M14-9.3.4 |
| EL-M14-S3-050 | select | visible-default | select, name=challenge_type | FN-M14-9.3.4 |
| EL-M14-S3-051 | label | visible-default | "Sasaran" | FN-M14-9.3.3 |
| EL-M14-S3-052 | input | visible-default | input, name=target_value, type=number | FN-M14-9.3.3 |
| EL-M14-S3-053 | label | visible-default | "Ganjaran Syiling" | FN-M14-9.3.3 |
| EL-M14-S3-054 | input | visible-default | input, name=reward_syiling, type=number | FN-M14-9.3.3 |
| EL-M14-S3-055 | label | visible-default | "Ganjaran XP" | FN-M14-9.3.3 |
| EL-M14-S3-056 | input | visible-default | input, name=reward_xp, type=number | FN-M14-9.3.3 |
| EL-M14-S3-057 | label | visible-default | "Kesukaran" | FN-M14-9.3.3 |
| EL-M14-S3-058 | select | visible-default | select, name=difficulty | FN-M14-9.3.3 |
| EL-M14-S3-059 | label | visible-default | "Urutan" | FN-M14-9.3.3 |
| EL-M14-S3-060 | input | visible-default | input, name=sort_order, type=number | FN-M14-9.3.3 |
| EL-M14-S3-061 | button | visible-default | "Simpan", type=submit, fa-save | FN-M14-9.3.3 |
| EL-M14-S3-062 | form | visible-default | form | FN-M14-9.3.5 |
| EL-M14-S3-063 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-9.3.5 |
| EL-M14-S3-064 | button | visible-default | "🔴 Nyahaktif", type=submit | FN-M14-9.3.5 |
| EL-M14-S3-065 | form | visible-default | form | FN-M14-9.3.6 |
| EL-M14-S3-066 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-9.3.6 |
| EL-M14-S3-067 | hidden-field | hidden-only | hidden-field, name=_method, type=hidden | FN-M14-9.3.6 |
| EL-M14-S3-068 | button | visible-default | "Padam", type=submit, fa-trash | FN-M14-9.3.6 |
| EL-M14-S3-069 | form | visible-default | form | FN-M14-9.3.2 |
| EL-M14-S3-070 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-9.3.2 |
| EL-M14-S3-071 | hidden-field | hidden-only | hidden-field, name=_method, type=hidden | FN-M14-9.3.2 |
| EL-M14-S3-072 | text | visible-default | "🗺️" | FN-M14-9.3.2 |
| EL-M14-S3-073 | text | visible-default | "Penjelajah Topik" | FN-M14-9.3.2 |
| EL-M14-S3-074 | badge | visible-default | "Sederhana" | FN-M14-9.3.2 |
| EL-M14-S3-075 | label | visible-default | "Tajuk" | FN-M14-9.3.3 |
| EL-M14-S3-076 | input | visible-default | input, name=title, type=text | FN-M14-9.3.3 |
| EL-M14-S3-077 | label | visible-default | "Keterangan" | FN-M14-9.3.3 |
| EL-M14-S3-078 | input | visible-default | input, name=description, type=text | FN-M14-9.3.3 |
| EL-M14-S3-079 | label | visible-default | "Icon" | FN-M14-9.3.3 |
| EL-M14-S3-080 | input | visible-default | input, name=icon, type=text | FN-M14-9.3.3 |
| EL-M14-S3-081 | label | visible-default | "Jenis" | FN-M14-9.3.4 |
| EL-M14-S3-082 | select | visible-default | select, name=challenge_type | FN-M14-9.3.4 |
| EL-M14-S3-083 | label | visible-default | "Sasaran" | FN-M14-9.3.3 |
| EL-M14-S3-084 | input | visible-default | input, name=target_value, type=number | FN-M14-9.3.3 |
| EL-M14-S3-085 | label | visible-default | "Ganjaran Syiling" | FN-M14-9.3.3 |
| EL-M14-S3-086 | input | visible-default | input, name=reward_syiling, type=number | FN-M14-9.3.3 |
| EL-M14-S3-087 | label | visible-default | "Ganjaran XP" | FN-M14-9.3.3 |
| EL-M14-S3-088 | input | visible-default | input, name=reward_xp, type=number | FN-M14-9.3.3 |
| EL-M14-S3-089 | label | visible-default | "Kesukaran" | FN-M14-9.3.3 |
| EL-M14-S3-090 | select | visible-default | select, name=difficulty | FN-M14-9.3.3 |
| EL-M14-S3-091 | label | visible-default | "Urutan" | FN-M14-9.3.3 |
| EL-M14-S3-092 | input | visible-default | input, name=sort_order, type=number | FN-M14-9.3.3 |
| EL-M14-S3-093 | button | visible-default | "Simpan", type=submit, fa-save | FN-M14-9.3.3 |
| EL-M14-S3-094 | form | visible-default | form | FN-M14-9.3.5 |
| EL-M14-S3-095 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-9.3.5 |
| EL-M14-S3-096 | button | visible-default | "🔴 Nyahaktif", type=submit | FN-M14-9.3.5 |
| EL-M14-S3-097 | form | visible-default | form | FN-M14-9.3.6 |
| EL-M14-S3-098 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-9.3.6 |
| EL-M14-S3-099 | hidden-field | hidden-only | hidden-field, name=_method, type=hidden | FN-M14-9.3.6 |
| EL-M14-S3-100 | button | visible-default | "Padam", type=submit, fa-trash | FN-M14-9.3.6 |
| EL-M14-S3-101 | form | visible-default | form | FN-M14-9.3.2 |
| EL-M14-S3-102 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-9.3.2 |
| EL-M14-S3-103 | hidden-field | hidden-only | hidden-field, name=_method, type=hidden | FN-M14-9.3.2 |
| EL-M14-S3-104 | text | visible-default | "⚡" | FN-M14-9.3.2 |
| EL-M14-S3-105 | text | visible-default | "Kilat Matematik" | FN-M14-9.3.2 |
| EL-M14-S3-106 | badge | visible-default | "Sukar" | FN-M14-9.3.2 |
| EL-M14-S3-107 | label | visible-default | "Tajuk" | FN-M14-9.3.3 |
| EL-M14-S3-108 | input | visible-default | input, name=title, type=text | FN-M14-9.3.3 |
| EL-M14-S3-109 | label | visible-default | "Keterangan" | FN-M14-9.3.3 |
| EL-M14-S3-110 | input | visible-default | input, name=description, type=text | FN-M14-9.3.3 |
| EL-M14-S3-111 | label | visible-default | "Icon" | FN-M14-9.3.3 |
| EL-M14-S3-112 | input | visible-default | input, name=icon, type=text | FN-M14-9.3.3 |
| EL-M14-S3-113 | label | visible-default | "Jenis" | FN-M14-9.3.4 |
| EL-M14-S3-114 | select | visible-default | select, name=challenge_type | FN-M14-9.3.4 |
| EL-M14-S3-115 | label | visible-default | "Sasaran" | FN-M14-9.3.3 |
| EL-M14-S3-116 | input | visible-default | input, name=target_value, type=number | FN-M14-9.3.3 |
| EL-M14-S3-117 | label | visible-default | "Ganjaran Syiling" | FN-M14-9.3.3 |
| EL-M14-S3-118 | input | visible-default | input, name=reward_syiling, type=number | FN-M14-9.3.3 |
| EL-M14-S3-119 | label | visible-default | "Ganjaran XP" | FN-M14-9.3.3 |
| EL-M14-S3-120 | input | visible-default | input, name=reward_xp, type=number | FN-M14-9.3.3 |
| EL-M14-S3-121 | label | visible-default | "Kesukaran" | FN-M14-9.3.3 |
| EL-M14-S3-122 | select | visible-default | select, name=difficulty | FN-M14-9.3.3 |
| EL-M14-S3-123 | label | visible-default | "Urutan" | FN-M14-9.3.3 |
| EL-M14-S3-124 | input | visible-default | input, name=sort_order, type=number | FN-M14-9.3.3 |
| EL-M14-S3-125 | button | visible-default | "Simpan", type=submit, fa-save | FN-M14-9.3.3 |
| EL-M14-S3-126 | form | visible-default | form | FN-M14-9.3.5 |
| EL-M14-S3-127 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-9.3.5 |
| EL-M14-S3-128 | button | visible-default | "🔴 Nyahaktif", type=submit | FN-M14-9.3.5 |
| EL-M14-S3-129 | form | visible-default | form | FN-M14-9.3.6 |
| EL-M14-S3-130 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-9.3.6 |
| EL-M14-S3-131 | hidden-field | hidden-only | hidden-field, name=_method, type=hidden | FN-M14-9.3.6 |
| EL-M14-S3-132 | button | visible-default | "Padam", type=submit, fa-trash | FN-M14-9.3.6 |
| EL-M14-S3-133 | form | visible-default | form | FN-M14-9.3.2 |
| EL-M14-S3-134 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-9.3.2 |
| EL-M14-S3-135 | hidden-field | hidden-only | hidden-field, name=_method, type=hidden | FN-M14-9.3.2 |
| EL-M14-S3-136 | text | visible-default | "🌟" | FN-M14-9.3.2 |
| EL-M14-S3-137 | text | visible-default | "Mula Hari Ini" | FN-M14-9.3.2 |
| EL-M14-S3-138 | badge | visible-default | "Mudah" | FN-M14-9.3.2 |
| EL-M14-S3-139 | label | visible-default | "Tajuk" | FN-M14-9.3.3 |
| EL-M14-S3-140 | input | visible-default | input, name=title, type=text | FN-M14-9.3.3 |
| EL-M14-S3-141 | label | visible-default | "Keterangan" | FN-M14-9.3.3 |
| EL-M14-S3-142 | input | visible-default | input, name=description, type=text | FN-M14-9.3.3 |
| EL-M14-S3-143 | label | visible-default | "Icon" | FN-M14-9.3.3 |
| EL-M14-S3-144 | input | visible-default | input, name=icon, type=text | FN-M14-9.3.3 |
| EL-M14-S3-145 | label | visible-default | "Jenis" | FN-M14-9.3.4 |
| EL-M14-S3-146 | select | visible-default | select, name=challenge_type | FN-M14-9.3.4 |
| EL-M14-S3-147 | label | visible-default | "Sasaran" | FN-M14-9.3.3 |
| EL-M14-S3-148 | input | visible-default | input, name=target_value, type=number | FN-M14-9.3.3 |
| EL-M14-S3-149 | label | visible-default | "Ganjaran Syiling" | FN-M14-9.3.3 |
| EL-M14-S3-150 | input | visible-default | input, name=reward_syiling, type=number | FN-M14-9.3.3 |
| EL-M14-S3-151 | label | visible-default | "Ganjaran XP" | FN-M14-9.3.3 |
| EL-M14-S3-152 | input | visible-default | input, name=reward_xp, type=number | FN-M14-9.3.3 |
| EL-M14-S3-153 | label | visible-default | "Kesukaran" | FN-M14-9.3.3 |
| EL-M14-S3-154 | select | visible-default | select, name=difficulty | FN-M14-9.3.3 |
| EL-M14-S3-155 | label | visible-default | "Urutan" | FN-M14-9.3.3 |
| EL-M14-S3-156 | input | visible-default | input, name=sort_order, type=number | FN-M14-9.3.3 |
| EL-M14-S3-157 | button | visible-default | "Simpan", type=submit, fa-save | FN-M14-9.3.3 |
| EL-M14-S3-158 | form | visible-default | form | FN-M14-9.3.5 |
| EL-M14-S3-159 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-9.3.5 |
| EL-M14-S3-160 | button | visible-default | "🔴 Nyahaktif", type=submit | FN-M14-9.3.5 |
| EL-M14-S3-161 | form | visible-default | form | FN-M14-9.3.6 |
| EL-M14-S3-162 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-9.3.6 |
| EL-M14-S3-163 | hidden-field | hidden-only | hidden-field, name=_method, type=hidden | FN-M14-9.3.6 |
| EL-M14-S3-164 | button | visible-default | "Padam", type=submit, fa-trash | FN-M14-9.3.6 |
| EL-M14-S3-165 | form | visible-default | form | FN-M14-9.3.2 |
| EL-M14-S3-166 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-9.3.2 |
| EL-M14-S3-167 | hidden-field | hidden-only | hidden-field, name=_method, type=hidden | FN-M14-9.3.2 |
| EL-M14-S3-168 | text | visible-default | "✅" | FN-M14-9.3.2 |
| EL-M14-S3-169 | text | visible-default | "Jawab 5 Betul" | FN-M14-9.3.2 |
| EL-M14-S3-170 | badge | visible-default | "Mudah" | FN-M14-9.3.2 |
| EL-M14-S3-171 | label | visible-default | "Tajuk" | FN-M14-9.3.3 |
| EL-M14-S3-172 | input | visible-default | input, name=title, type=text | FN-M14-9.3.3 |
| EL-M14-S3-173 | label | visible-default | "Keterangan" | FN-M14-9.3.3 |
| EL-M14-S3-174 | input | visible-default | input, name=description, type=text | FN-M14-9.3.3 |
| EL-M14-S3-175 | label | visible-default | "Icon" | FN-M14-9.3.3 |
| EL-M14-S3-176 | input | visible-default | input, name=icon, type=text | FN-M14-9.3.3 |
| EL-M14-S3-177 | label | visible-default | "Jenis" | FN-M14-9.3.4 |
| EL-M14-S3-178 | select | visible-default | select, name=challenge_type | FN-M14-9.3.4 |
| EL-M14-S3-179 | label | visible-default | "Sasaran" | FN-M14-9.3.3 |
| EL-M14-S3-180 | input | visible-default | input, name=target_value, type=number | FN-M14-9.3.3 |
| EL-M14-S3-181 | label | visible-default | "Ganjaran Syiling" | FN-M14-9.3.3 |
| EL-M14-S3-182 | input | visible-default | input, name=reward_syiling, type=number | FN-M14-9.3.3 |
| EL-M14-S3-183 | label | visible-default | "Ganjaran XP" | FN-M14-9.3.3 |
| EL-M14-S3-184 | input | visible-default | input, name=reward_xp, type=number | FN-M14-9.3.3 |
| EL-M14-S3-185 | label | visible-default | "Kesukaran" | FN-M14-9.3.3 |
| EL-M14-S3-186 | select | visible-default | select, name=difficulty | FN-M14-9.3.3 |
| EL-M14-S3-187 | label | visible-default | "Urutan" | FN-M14-9.3.3 |
| EL-M14-S3-188 | input | visible-default | input, name=sort_order, type=number | FN-M14-9.3.3 |
| EL-M14-S3-189 | button | visible-default | "Simpan", type=submit, fa-save | FN-M14-9.3.3 |
| EL-M14-S3-190 | form | visible-default | form | FN-M14-9.3.5 |
| EL-M14-S3-191 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-9.3.5 |
| EL-M14-S3-192 | button | visible-default | "🔴 Nyahaktif", type=submit | FN-M14-9.3.5 |
| EL-M14-S3-193 | form | visible-default | form | FN-M14-9.3.6 |
| EL-M14-S3-194 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-9.3.6 |
| EL-M14-S3-195 | hidden-field | hidden-only | hidden-field, name=_method, type=hidden | FN-M14-9.3.6 |
| EL-M14-S3-196 | button | visible-default | "Padam", type=submit, fa-trash | FN-M14-9.3.6 |
| EL-M14-S3-197 | form | visible-default | form | FN-M14-9.3.2 |
| EL-M14-S3-198 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-9.3.2 |
| EL-M14-S3-199 | hidden-field | hidden-only | hidden-field, name=_method, type=hidden | FN-M14-9.3.2 |
| EL-M14-S3-200 | text | visible-default | "⏱️" | FN-M14-9.3.2 |
| EL-M14-S3-201 | text | visible-default | "Latihan 10 Minit" | FN-M14-9.3.2 |
| EL-M14-S3-202 | badge | visible-default | "Sederhana" | FN-M14-9.3.2 |
| EL-M14-S3-203 | label | visible-default | "Tajuk" | FN-M14-9.3.3 |
| EL-M14-S3-204 | input | visible-default | input, name=title, type=text | FN-M14-9.3.3 |
| EL-M14-S3-205 | label | visible-default | "Keterangan" | FN-M14-9.3.3 |
| EL-M14-S3-206 | input | visible-default | input, name=description, type=text | FN-M14-9.3.3 |
| EL-M14-S3-207 | label | visible-default | "Icon" | FN-M14-9.3.3 |
| EL-M14-S3-208 | input | visible-default | input, name=icon, type=text | FN-M14-9.3.3 |
| EL-M14-S3-209 | label | visible-default | "Jenis" | FN-M14-9.3.4 |
| EL-M14-S3-210 | select | visible-default | select, name=challenge_type | FN-M14-9.3.4 |
| EL-M14-S3-211 | label | visible-default | "Sasaran" | FN-M14-9.3.3 |
| EL-M14-S3-212 | input | visible-default | input, name=target_value, type=number | FN-M14-9.3.3 |
| EL-M14-S3-213 | label | visible-default | "Ganjaran Syiling" | FN-M14-9.3.3 |
| EL-M14-S3-214 | input | visible-default | input, name=reward_syiling, type=number | FN-M14-9.3.3 |
| EL-M14-S3-215 | label | visible-default | "Ganjaran XP" | FN-M14-9.3.3 |
| EL-M14-S3-216 | input | visible-default | input, name=reward_xp, type=number | FN-M14-9.3.3 |
| EL-M14-S3-217 | label | visible-default | "Kesukaran" | FN-M14-9.3.3 |
| EL-M14-S3-218 | select | visible-default | select, name=difficulty | FN-M14-9.3.3 |
| EL-M14-S3-219 | label | visible-default | "Urutan" | FN-M14-9.3.3 |
| EL-M14-S3-220 | input | visible-default | input, name=sort_order, type=number | FN-M14-9.3.3 |
| EL-M14-S3-221 | button | visible-default | "Simpan", type=submit, fa-save | FN-M14-9.3.3 |
| EL-M14-S3-222 | form | visible-default | form | FN-M14-9.3.5 |
| EL-M14-S3-223 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-9.3.5 |
| EL-M14-S3-224 | button | visible-default | "🔴 Nyahaktif", type=submit | FN-M14-9.3.5 |
| EL-M14-S3-225 | form | visible-default | form | FN-M14-9.3.6 |
| EL-M14-S3-226 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-9.3.6 |
| EL-M14-S3-227 | hidden-field | hidden-only | hidden-field, name=_method, type=hidden | FN-M14-9.3.6 |
| EL-M14-S3-228 | button | visible-default | "Padam", type=submit, fa-trash | FN-M14-9.3.6 |
| EL-M14-S3-229 | form | visible-default | form | FN-M14-9.3.2 |
| EL-M14-S3-230 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-9.3.2 |
| EL-M14-S3-231 | hidden-field | hidden-only | hidden-field, name=_method, type=hidden | FN-M14-9.3.2 |
| EL-M14-S3-232 | text | visible-default | "🔥" | FN-M14-9.3.2 |
| EL-M14-S3-233 | text | visible-default | "Kombo 2 Hari" | FN-M14-9.3.2 |
| EL-M14-S3-234 | badge | visible-default | "Sederhana" | FN-M14-9.3.2 |
| EL-M14-S3-235 | label | visible-default | "Tajuk" | FN-M14-9.3.3 |
| EL-M14-S3-236 | input | visible-default | input, name=title, type=text | FN-M14-9.3.3 |
| EL-M14-S3-237 | label | visible-default | "Keterangan" | FN-M14-9.3.3 |
| EL-M14-S3-238 | input | visible-default | input, name=description, type=text | FN-M14-9.3.3 |
| EL-M14-S3-239 | label | visible-default | "Icon" | FN-M14-9.3.3 |
| EL-M14-S3-240 | input | visible-default | input, name=icon, type=text | FN-M14-9.3.3 |
| EL-M14-S3-241 | label | visible-default | "Jenis" | FN-M14-9.3.4 |
| EL-M14-S3-242 | select | visible-default | select, name=challenge_type | FN-M14-9.3.4 |
| EL-M14-S3-243 | label | visible-default | "Sasaran" | FN-M14-9.3.3 |
| EL-M14-S3-244 | input | visible-default | input, name=target_value, type=number | FN-M14-9.3.3 |
| EL-M14-S3-245 | label | visible-default | "Ganjaran Syiling" | FN-M14-9.3.3 |
| EL-M14-S3-246 | input | visible-default | input, name=reward_syiling, type=number | FN-M14-9.3.3 |
| EL-M14-S3-247 | label | visible-default | "Ganjaran XP" | FN-M14-9.3.3 |
| EL-M14-S3-248 | input | visible-default | input, name=reward_xp, type=number | FN-M14-9.3.3 |
| EL-M14-S3-249 | label | visible-default | "Kesukaran" | FN-M14-9.3.3 |
| EL-M14-S3-250 | select | visible-default | select, name=difficulty | FN-M14-9.3.3 |
| EL-M14-S3-251 | label | visible-default | "Urutan" | FN-M14-9.3.3 |
| EL-M14-S3-252 | input | visible-default | input, name=sort_order, type=number | FN-M14-9.3.3 |
| EL-M14-S3-253 | button | visible-default | "Simpan", type=submit, fa-save | FN-M14-9.3.3 |
| EL-M14-S3-254 | form | visible-default | form | FN-M14-9.3.5 |
| EL-M14-S3-255 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-9.3.5 |
| EL-M14-S3-256 | button | visible-default | "🔴 Nyahaktif", type=submit | FN-M14-9.3.5 |
| EL-M14-S3-257 | form | visible-default | form | FN-M14-9.3.6 |
| EL-M14-S3-258 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-9.3.6 |
| EL-M14-S3-259 | hidden-field | hidden-only | hidden-field, name=_method, type=hidden | FN-M14-9.3.6 |
| EL-M14-S3-260 | button | visible-default | "Padam", type=submit, fa-trash | FN-M14-9.3.6 |
| EL-M14-S3-261 | form | visible-default | form | FN-M14-9.3.2 |
| EL-M14-S3-262 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-9.3.2 |
| EL-M14-S3-263 | hidden-field | hidden-only | hidden-field, name=_method, type=hidden | FN-M14-9.3.2 |
| EL-M14-S3-264 | text | visible-default | "🎯" | FN-M14-9.3.2 |
| EL-M14-S3-265 | text | visible-default | "Ketepatan 90%" | FN-M14-9.3.2 |
| EL-M14-S3-266 | badge | visible-default | "Sukar" | FN-M14-9.3.2 |
| EL-M14-S3-267 | label | visible-default | "Tajuk" | FN-M14-9.3.3 |
| EL-M14-S3-268 | input | visible-default | input, name=title, type=text | FN-M14-9.3.3 |
| EL-M14-S3-269 | label | visible-default | "Keterangan" | FN-M14-9.3.3 |
| EL-M14-S3-270 | input | visible-default | input, name=description, type=text | FN-M14-9.3.3 |
| EL-M14-S3-271 | label | visible-default | "Icon" | FN-M14-9.3.3 |
| EL-M14-S3-272 | input | visible-default | input, name=icon, type=text | FN-M14-9.3.3 |
| EL-M14-S3-273 | label | visible-default | "Jenis" | FN-M14-9.3.4 |
| EL-M14-S3-274 | select | visible-default | select, name=challenge_type | FN-M14-9.3.4 |
| EL-M14-S3-275 | label | visible-default | "Sasaran" | FN-M14-9.3.3 |
| EL-M14-S3-276 | input | visible-default | input, name=target_value, type=number | FN-M14-9.3.3 |
| EL-M14-S3-277 | label | visible-default | "Ganjaran Syiling" | FN-M14-9.3.3 |
| EL-M14-S3-278 | input | visible-default | input, name=reward_syiling, type=number | FN-M14-9.3.3 |
| EL-M14-S3-279 | label | visible-default | "Ganjaran XP" | FN-M14-9.3.3 |
| EL-M14-S3-280 | input | visible-default | input, name=reward_xp, type=number | FN-M14-9.3.3 |
| EL-M14-S3-281 | label | visible-default | "Kesukaran" | FN-M14-9.3.3 |
| EL-M14-S3-282 | select | visible-default | select, name=difficulty | FN-M14-9.3.3 |
| EL-M14-S3-283 | label | visible-default | "Urutan" | FN-M14-9.3.3 |
| EL-M14-S3-284 | input | visible-default | input, name=sort_order, type=number | FN-M14-9.3.3 |
| EL-M14-S3-285 | button | visible-default | "Simpan", type=submit, fa-save | FN-M14-9.3.3 |
| EL-M14-S3-286 | form | visible-default | form | FN-M14-9.3.5 |
| EL-M14-S3-287 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-9.3.5 |
| EL-M14-S3-288 | button | visible-default | "🔴 Nyahaktif", type=submit | FN-M14-9.3.5 |
| EL-M14-S3-289 | form | visible-default | form | FN-M14-9.3.6 |
| EL-M14-S3-290 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-9.3.6 |
| EL-M14-S3-291 | hidden-field | hidden-only | hidden-field, name=_method, type=hidden | FN-M14-9.3.6 |
| EL-M14-S3-292 | button | visible-default | "Padam", type=submit, fa-trash | FN-M14-9.3.6 |
| EL-M14-S3-293 | form | visible-default | form | FN-M14-9.3.2 |
| EL-M14-S3-294 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-9.3.2 |
| EL-M14-S3-295 | hidden-field | hidden-only | hidden-field, name=_method, type=hidden | FN-M14-9.3.2 |
| EL-M14-S3-296 | text | visible-default | "⚡" | FN-M14-9.3.2 |
| EL-M14-S3-297 | text | visible-default | "Cabaran Kilat" | FN-M14-9.3.2 |
| EL-M14-S3-298 | badge | visible-default | "Sukar" | FN-M14-9.3.2 |
| EL-M14-S3-299 | label | visible-default | "Tajuk" | FN-M14-9.3.3 |
| EL-M14-S3-300 | input | visible-default | input, name=title, type=text | FN-M14-9.3.3 |
| EL-M14-S3-301 | label | visible-default | "Keterangan" | FN-M14-9.3.3 |
| EL-M14-S3-302 | input | visible-default | input, name=description, type=text | FN-M14-9.3.3 |
| EL-M14-S3-303 | label | visible-default | "Icon" | FN-M14-9.3.3 |
| EL-M14-S3-304 | input | visible-default | input, name=icon, type=text | FN-M14-9.3.3 |
| EL-M14-S3-305 | label | visible-default | "Jenis" | FN-M14-9.3.4 |
| EL-M14-S3-306 | select | visible-default | select, name=challenge_type | FN-M14-9.3.4 |
| EL-M14-S3-307 | label | visible-default | "Sasaran" | FN-M14-9.3.3 |
| EL-M14-S3-308 | input | visible-default | input, name=target_value, type=number | FN-M14-9.3.3 |
| EL-M14-S3-309 | label | visible-default | "Ganjaran Syiling" | FN-M14-9.3.3 |
| EL-M14-S3-310 | input | visible-default | input, name=reward_syiling, type=number | FN-M14-9.3.3 |
| EL-M14-S3-311 | label | visible-default | "Ganjaran XP" | FN-M14-9.3.3 |
| EL-M14-S3-312 | input | visible-default | input, name=reward_xp, type=number | FN-M14-9.3.3 |
| EL-M14-S3-313 | label | visible-default | "Kesukaran" | FN-M14-9.3.3 |
| EL-M14-S3-314 | select | visible-default | select, name=difficulty | FN-M14-9.3.3 |
| EL-M14-S3-315 | label | visible-default | "Urutan" | FN-M14-9.3.3 |
| EL-M14-S3-316 | input | visible-default | input, name=sort_order, type=number | FN-M14-9.3.3 |
| EL-M14-S3-317 | button | visible-default | "Simpan", type=submit, fa-save | FN-M14-9.3.3 |
| EL-M14-S3-318 | form | visible-default | form | FN-M14-9.3.5 |
| EL-M14-S3-319 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-9.3.5 |
| EL-M14-S3-320 | button | visible-default | "🔴 Nyahaktif", type=submit | FN-M14-9.3.5 |
| EL-M14-S3-321 | form | visible-default | form | FN-M14-9.3.6 |
| EL-M14-S3-322 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-9.3.6 |
| EL-M14-S3-323 | hidden-field | hidden-only | hidden-field, name=_method, type=hidden | FN-M14-9.3.6 |
| EL-M14-S3-324 | button | visible-default | "Padam", type=submit, fa-trash | FN-M14-9.3.6 |
| EL-M14-S3-325 | card | visible-default | "➕ Tambah Cabaran Baru" | FN-M14-9.3.7 |
| EL-M14-S3-326 | heading | visible-default | "➕ Tambah Cabaran Baru" | FN-M14-9.3.7 |
| EL-M14-S3-327 | form | visible-default | form | FN-M14-9.3.7 |
| EL-M14-S3-328 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-9.3.7 |
| EL-M14-S3-329 | label | visible-default | "Tajuk" | FN-M14-9.3.7 |
| EL-M14-S3-330 | input | visible-default | input, name=title, type=text | FN-M14-9.3.7 |
| EL-M14-S3-331 | label | visible-default | "Keterangan" | FN-M14-9.3.7 |
| EL-M14-S3-332 | input | visible-default | input, name=description, type=text | FN-M14-9.3.7 |
| EL-M14-S3-333 | label | visible-default | "Icon" | FN-M14-9.3.7 |
| EL-M14-S3-334 | input | visible-default | input, name=icon, type=text | FN-M14-9.3.7 |
| EL-M14-S3-335 | label | visible-default | "Jenis" | FN-M14-9.3.7 |
| EL-M14-S3-336 | select | visible-default | select, name=challenge_type | FN-M14-9.3.7 |
| EL-M14-S3-337 | label | visible-default | "Sasaran" | FN-M14-9.3.7 |
| EL-M14-S3-338 | input | visible-default | input, name=target_value, type=number | FN-M14-9.3.7 |
| EL-M14-S3-339 | label | visible-default | "Ganjaran Syiling" | FN-M14-9.3.7 |
| EL-M14-S3-340 | input | visible-default | input, name=reward_syiling, type=number | FN-M14-9.3.7 |
| EL-M14-S3-341 | label | visible-default | "Ganjaran XP" | FN-M14-9.3.7 |
| EL-M14-S3-342 | input | visible-default | input, name=reward_xp, type=number | FN-M14-9.3.7 |
| EL-M14-S3-343 | label | visible-default | "Kesukaran" | FN-M14-9.3.7 |
| EL-M14-S3-344 | select | visible-default | select, name=difficulty | FN-M14-9.3.7 |
| EL-M14-S3-345 | label | visible-default | "Urutan" | FN-M14-9.3.7 |
| EL-M14-S3-346 | input | visible-default | input, name=sort_order, type=number | FN-M14-9.3.7 |
| EL-M14-S3-347 | button | visible-default | "Tambah Cabaran", type=submit, fa-plus | FN-M14-9.3.7 |

#### S4 — `/admin/gamification/students` (46 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M14-S4-001 | heading | visible-default | "👥 Pelajar Gamifikasi" | FN-M14-9.4.1 |
| EL-M14-S4-002 | text | visible-default | "Pantau progress pelajar & berikan bonus syiling" | FN-M14-9.4.1 |
| EL-M14-S4-003 | form | visible-default | form | FN-M14-9.4.2 |
| EL-M14-S4-004 | input | visible-default | input, name=search, type=text | FN-M14-9.4.2 |
| EL-M14-S4-005 | select | visible-default | select, name=tier | FN-M14-9.4.2 |
| EL-M14-S4-006 | select | visible-default | select, name=sort | FN-M14-9.4.2 |
| EL-M14-S4-007 | button | visible-default | "Cari", type=submit, fa-search | FN-M14-9.4.2 |
| EL-M14-S4-008 | card | visible-default | "🎁 Berikan Bonus Syiling" | FN-M14-9.4.3 |
| EL-M14-S4-009 | heading | visible-default | "🎁 Berikan Bonus Syiling" | FN-M14-9.4.3 |
| EL-M14-S4-010 | form | visible-default | form | FN-M14-9.4.3 |
| EL-M14-S4-011 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-9.4.3 |
| EL-M14-S4-012 | label | visible-default | "User ID" | FN-M14-9.4.3 |
| EL-M14-S4-013 | input | visible-default | input, name=user_id, type=number | FN-M14-9.4.3 |
| EL-M14-S4-014 | label | visible-default | "Jumlah" | FN-M14-9.4.3 |
| EL-M14-S4-015 | input | visible-default | input, name=amount, type=number | FN-M14-9.4.3 |
| EL-M14-S4-016 | label | visible-default | "Sebab" | FN-M14-9.4.3 |
| EL-M14-S4-017 | input | visible-default | input, name=reason, type=text | FN-M14-9.4.3 |
| EL-M14-S4-018 | button | visible-default | "Berikan", type=submit, fa-gift | FN-M14-9.4.3 |
| EL-M14-S4-019 | card | visible-default | "<person>" | FN-M14-9.4.4 |
| EL-M14-S4-020 | table | visible-default | table | FN-M14-9.4.4 |
| EL-M14-S4-021 | badge | visible-default | "platinum" | FN-M14-9.4.4 |
| EL-M14-S4-022 | text | conditional | "« Previous" | FN-M14-9.4.5 |
| EL-M14-S4-023 | pagination | conditional | "Next »", → /admin/gamification/students?page=2 | FN-M14-9.4.5 |
| EL-M14-S4-024 | text | visible-default | "Showing to of results" | FN-M14-9.4.5 |
| EL-M14-S4-025 | text | visible-default | "1" | FN-M14-9.4.5 |
| EL-M14-S4-026 | text | visible-default | "20" | FN-M14-9.4.5 |
| EL-M14-S4-027 | text | visible-default | "2255" | FN-M14-9.4.5 |
| EL-M14-S4-028 | text | visible-default | "1" | FN-M14-9.4.5 |
| EL-M14-S4-029 | pagination | visible-default | "2", → /admin/gamification/students?page=2 | FN-M14-9.4.5 |
| EL-M14-S4-030 | pagination | visible-default | "3", → /admin/gamification/students?page=3 | FN-M14-9.4.5 |
| EL-M14-S4-031 | pagination | visible-default | "4", → /admin/gamification/students?page=4 | FN-M14-9.4.5 |
| EL-M14-S4-032 | pagination | visible-default | "5", → /admin/gamification/students?page=5 | FN-M14-9.4.5 |
| EL-M14-S4-033 | pagination | visible-default | "6", → /admin/gamification/students?page=6 | FN-M14-9.4.5 |
| EL-M14-S4-034 | pagination | visible-default | "7", → /admin/gamification/students?page=7 | FN-M14-9.4.5 |
| EL-M14-S4-035 | pagination | visible-default | "8", → /admin/gamification/students?page=8 | FN-M14-9.4.5 |
| EL-M14-S4-036 | pagination | visible-default | "9", → /admin/gamification/students?page=9 | FN-M14-9.4.5 |
| EL-M14-S4-037 | pagination | visible-default | "10", → /admin/gamification/students?page=10 | FN-M14-9.4.5 |
| EL-M14-S4-038 | text | visible-default | "..." | FN-M14-9.4.5 |
| EL-M14-S4-039 | pagination | visible-default | "112", → /admin/gamification/students?page=112 | FN-M14-9.4.5 |
| EL-M14-S4-040 | pagination | visible-default | "113", → /admin/gamification/students?page=113 | FN-M14-9.4.5 |
| EL-M14-S4-041 | pagination | visible-default | pagination, → /admin/gamification/students?page=2, svg | FN-M14-9.4.5 |
| EL-M14-S4-042 | badge | conditional | "bronze" | FN-M14-9.4.4 |
| EL-M14-S4-043 | pagination | hidden-only | "« Previous", → /admin/gamification/students?page=112 | FN-M14-9.4.5 |
| EL-M14-S4-044 | text | hidden-only | "Next »" | FN-M14-9.4.5 |
| EL-M14-S4-045 | text | conditional | "Belum ada pelajar dalam sistem gamifikasi" | FN-M14-9.4.6 |
| EL-M14-S4-046 | badge | conditional | "silver" | FN-M14-9.4.4 |

#### S5 — `/admin/gamification/transactions` (37 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M14-S5-001 | heading | visible-default | "📋 Transaksi Syiling" | FN-M14-9.5.1 |
| EL-M14-S5-002 | text | visible-default | "Log semua transaksi syiling dalam sistem" | FN-M14-9.5.1 |
| EL-M14-S5-003 | form | visible-default | form | FN-M14-9.5.2 |
| EL-M14-S5-004 | select | visible-default | select, name=type | FN-M14-9.5.2 |
| EL-M14-S5-005 | input | visible-default | input, name=date_from, type=date | FN-M14-9.5.2 |
| EL-M14-S5-006 | input | visible-default | input, name=date_to, type=date | FN-M14-9.5.2 |
| EL-M14-S5-007 | button | visible-default | "Tapis", type=submit, fa-filter | FN-M14-9.5.2 |
| EL-M14-S5-008 | card | visible-default | "<person>" | FN-M14-9.5.3 |
| EL-M14-S5-009 | table | visible-default | table | FN-M14-9.5.3 |
| EL-M14-S5-010 | badge | visible-default | "earn" | FN-M14-9.5.3 |
| EL-M14-S5-011 | text | conditional | "« Previous" | FN-M14-9.5.4 |
| EL-M14-S5-012 | pagination | conditional | "Next »", → /admin/gamification/transactions?page=2 | FN-M14-9.5.4 |
| EL-M14-S5-013 | text | visible-default | "Showing to of results" | FN-M14-9.5.4 |
| EL-M14-S5-014 | text | visible-default | "1" | FN-M14-9.5.4 |
| EL-M14-S5-015 | text | visible-default | "25" | FN-M14-9.5.4 |
| EL-M14-S5-016 | text | visible-default | "52936" | FN-M14-9.5.4 |
| EL-M14-S5-017 | text | visible-default | "1" | FN-M14-9.5.4 |
| EL-M14-S5-018 | pagination | visible-default | "2", → /admin/gamification/transactions?page=2 | FN-M14-9.5.4 |
| EL-M14-S5-019 | pagination | visible-default | "3", → /admin/gamification/transactions?page=3 | FN-M14-9.5.4 |
| EL-M14-S5-020 | pagination | visible-default | "4", → /admin/gamification/transactions?page=4 | FN-M14-9.5.4 |
| EL-M14-S5-021 | pagination | visible-default | "5", → /admin/gamification/transactions?page=5 | FN-M14-9.5.4 |
| EL-M14-S5-022 | pagination | visible-default | "6", → /admin/gamification/transactions?page=6 | FN-M14-9.5.4 |
| EL-M14-S5-023 | pagination | visible-default | "7", → /admin/gamification/transactions?page=7 | FN-M14-9.5.4 |
| EL-M14-S5-024 | pagination | visible-default | "8", → /admin/gamification/transactions?page=8 | FN-M14-9.5.4 |
| EL-M14-S5-025 | pagination | visible-default | "9", → /admin/gamification/transactions?page=9 | FN-M14-9.5.4 |
| EL-M14-S5-026 | pagination | visible-default | "10", → /admin/gamification/transactions?page=10 | FN-M14-9.5.4 |
| EL-M14-S5-027 | text | visible-default | "..." | FN-M14-9.5.4 |
| EL-M14-S5-028 | pagination | visible-default | "2117", → /admin/gamification/transactions?page=2117 | FN-M14-9.5.4 |
| EL-M14-S5-029 | pagination | visible-default | "2118", → /admin/gamification/transactions?page=2118 | FN-M14-9.5.4 |
| EL-M14-S5-030 | pagination | visible-default | pagination, → /admin/gamification/transactions?page=2, svg | FN-M14-9.5.4 |
| EL-M14-S5-031 | link | conditional | "Reset", → /admin/gamification/transactions | FN-M14-9.5.2 |
| EL-M14-S5-032 | empty-state | conditional | "Tiada transaksi ditemui" | FN-M14-9.5.5 |
| EL-M14-S5-033 | pagination | hidden-only | "« Previous", → /admin/gamification/transactions?page=2117 | FN-M14-9.5.4 |
| EL-M14-S5-034 | text | hidden-only | "Next »" | FN-M14-9.5.4 |
| EL-M14-S5-035 | badge | conditional | "bonus" | FN-M14-9.5.3 |
| EL-M14-S5-036 | badge | conditional | "convert" | FN-M14-9.5.3 |
| EL-M14-S5-037 | badge | conditional | "spend" | FN-M14-9.5.3 |

#### S6 — `/admin/gamifikasi/guru` (179 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M14-S6-001 | card | visible-default | "0" | FN-M14-11.1.1 |
| EL-M14-S6-002 | text | visible-default | "0" | FN-M14-11.1.1 |
| EL-M14-S6-003 | text | visible-default | "Jumlah Ganjaran" | FN-M14-11.1.1 |
| EL-M14-S6-004 | card | visible-default | "0" | FN-M14-11.1.1 |
| EL-M14-S6-005 | text | visible-default | "0" | FN-M14-11.1.1 |
| EL-M14-S6-006 | text | visible-default | "Aktif" | FN-M14-11.1.1 |
| EL-M14-S6-007 | card | visible-default | "8" | FN-M14-11.1.1 |
| EL-M14-S6-008 | text | visible-default | "8" | FN-M14-11.1.1 |
| EL-M14-S6-009 | text | visible-default | "Lencana" | FN-M14-11.1.1 |
| EL-M14-S6-010 | card | visible-default | "0" | FN-M14-11.1.1 |
| EL-M14-S6-011 | text | visible-default | "0" | FN-M14-11.1.1 |
| EL-M14-S6-012 | text | visible-default | "Tebusan Pending" | FN-M14-11.1.1 |
| EL-M14-S6-013 | link | visible-default | "Tebusan Hadiah", → /admin/gamifikasi/guru/tebusan, fa-receipt | FN-M14-11.1.2 |
| EL-M14-S6-014 | link | visible-default | "Tebus Tunai 2", → /admin/gamifikasi/guru/tunai, fa-money-bill-wave | FN-M14-11.1.2 |
| EL-M14-S6-015 | badge | visible-default | "2" | FN-M14-11.1.2 |
| EL-M14-S6-016 | card | visible-default | "Lencana Guru (8)" | FN-M14-11.2.1 |
| EL-M14-S6-017 | heading | visible-default | "Lencana Guru (8)" | FN-M14-11.2.1 |
| EL-M14-S6-018 | table | visible-default | table | FN-M14-11.2.1 |
| EL-M14-S6-019 | text | hidden-only | "Penyumbang Baru" | FN-M14-11.2.1 |
| EL-M14-S6-020 | badge | visible-default | "Aktif" | FN-M14-11.2.1 |
| EL-M14-S6-021 | toggle | visible-default | "Edit", type=submit, fa-edit | FN-M14-11.2.2 |
| EL-M14-S6-022 | form | conditional | form | FN-M14-11.2.3 |
| EL-M14-S6-023 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-11.2.3 |
| EL-M14-S6-024 | hidden-field | hidden-only | hidden-field, name=_method, type=hidden | FN-M14-11.2.3 |
| EL-M14-S6-025 | label | conditional | "Nama" | FN-M14-11.2.3 |
| EL-M14-S6-026 | input | conditional | input, name=name, type=text | FN-M14-11.2.3 |
| EL-M14-S6-027 | label | conditional | "Ikon CSS" | FN-M14-11.2.3 |
| EL-M14-S6-028 | input | conditional | input, name=icon, type=text | FN-M14-11.2.3 |
| EL-M14-S6-029 | label | conditional | "Threshold" | FN-M14-11.2.3 |
| EL-M14-S6-030 | input | conditional | input, name=threshold, type=number | FN-M14-11.2.3 |
| EL-M14-S6-031 | label | conditional | "Bonus Syiling" | FN-M14-11.2.3 |
| EL-M14-S6-032 | input | conditional | input, name=bonus_coins, type=number | FN-M14-11.2.3 |
| EL-M14-S6-033 | checkbox | conditional | checkbox, name=is_active, type=checkbox | FN-M14-11.2.3 |
| EL-M14-S6-034 | label | conditional | "Aktif" | FN-M14-11.2.3 |
| EL-M14-S6-035 | button | conditional | "Simpan", type=submit | FN-M14-11.2.3 |
| EL-M14-S6-036 | text | hidden-only | "Penyumbang Aktif" | FN-M14-11.2.1 |
| EL-M14-S6-037 | badge | visible-default | "Aktif" | FN-M14-11.2.1 |
| EL-M14-S6-038 | toggle | visible-default | "Edit", type=submit, fa-edit | FN-M14-11.2.2 |
| EL-M14-S6-039 | form | hidden-only | form | FN-M14-11.2.3 |
| EL-M14-S6-040 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-11.2.3 |
| EL-M14-S6-041 | hidden-field | hidden-only | hidden-field, name=_method, type=hidden | FN-M14-11.2.3 |
| EL-M14-S6-042 | label | hidden-only | "Nama" | FN-M14-11.2.3 |
| EL-M14-S6-043 | input | hidden-only | input, name=name, type=text | FN-M14-11.2.3 |
| EL-M14-S6-044 | label | hidden-only | "Ikon CSS" | FN-M14-11.2.3 |
| EL-M14-S6-045 | input | hidden-only | input, name=icon, type=text | FN-M14-11.2.3 |
| EL-M14-S6-046 | label | hidden-only | "Threshold" | FN-M14-11.2.3 |
| EL-M14-S6-047 | input | hidden-only | input, name=threshold, type=number | FN-M14-11.2.3 |
| EL-M14-S6-048 | label | hidden-only | "Bonus Syiling" | FN-M14-11.2.3 |
| EL-M14-S6-049 | input | hidden-only | input, name=bonus_coins, type=number | FN-M14-11.2.3 |
| EL-M14-S6-050 | checkbox | hidden-only | checkbox, name=is_active, type=checkbox | FN-M14-11.2.3 |
| EL-M14-S6-051 | label | hidden-only | "Aktif" | FN-M14-11.2.3 |
| EL-M14-S6-052 | button | hidden-only | "Simpan", type=submit | FN-M14-11.2.3 |
| EL-M14-S6-053 | text | hidden-only | "Penyumbang Dedikasi" | FN-M14-11.2.1 |
| EL-M14-S6-054 | badge | visible-default | "Aktif" | FN-M14-11.2.1 |
| EL-M14-S6-055 | toggle | visible-default | "Edit", type=submit, fa-edit | FN-M14-11.2.2 |
| EL-M14-S6-056 | form | hidden-only | form | FN-M14-11.2.3 |
| EL-M14-S6-057 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-11.2.3 |
| EL-M14-S6-058 | hidden-field | hidden-only | hidden-field, name=_method, type=hidden | FN-M14-11.2.3 |
| EL-M14-S6-059 | label | hidden-only | "Nama" | FN-M14-11.2.3 |
| EL-M14-S6-060 | input | hidden-only | input, name=name, type=text | FN-M14-11.2.3 |
| EL-M14-S6-061 | label | hidden-only | "Ikon CSS" | FN-M14-11.2.3 |
| EL-M14-S6-062 | input | hidden-only | input, name=icon, type=text | FN-M14-11.2.3 |
| EL-M14-S6-063 | label | hidden-only | "Threshold" | FN-M14-11.2.3 |
| EL-M14-S6-064 | input | hidden-only | input, name=threshold, type=number | FN-M14-11.2.3 |
| EL-M14-S6-065 | label | hidden-only | "Bonus Syiling" | FN-M14-11.2.3 |
| EL-M14-S6-066 | input | hidden-only | input, name=bonus_coins, type=number | FN-M14-11.2.3 |
| EL-M14-S6-067 | checkbox | hidden-only | checkbox, name=is_active, type=checkbox | FN-M14-11.2.3 |
| EL-M14-S6-068 | label | hidden-only | "Aktif" | FN-M14-11.2.3 |
| EL-M14-S6-069 | button | hidden-only | "Simpan", type=submit | FN-M14-11.2.3 |
| EL-M14-S6-070 | text | hidden-only | "Penyumbang Cemerlang" | FN-M14-11.2.1 |
| EL-M14-S6-071 | badge | visible-default | "Aktif" | FN-M14-11.2.1 |
| EL-M14-S6-072 | toggle | visible-default | "Edit", type=submit, fa-edit | FN-M14-11.2.2 |
| EL-M14-S6-073 | form | hidden-only | form | FN-M14-11.2.3 |
| EL-M14-S6-074 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-11.2.3 |
| EL-M14-S6-075 | hidden-field | hidden-only | hidden-field, name=_method, type=hidden | FN-M14-11.2.3 |
| EL-M14-S6-076 | label | hidden-only | "Nama" | FN-M14-11.2.3 |
| EL-M14-S6-077 | input | hidden-only | input, name=name, type=text | FN-M14-11.2.3 |
| EL-M14-S6-078 | label | hidden-only | "Ikon CSS" | FN-M14-11.2.3 |
| EL-M14-S6-079 | input | hidden-only | input, name=icon, type=text | FN-M14-11.2.3 |
| EL-M14-S6-080 | label | hidden-only | "Threshold" | FN-M14-11.2.3 |
| EL-M14-S6-081 | input | hidden-only | input, name=threshold, type=number | FN-M14-11.2.3 |
| EL-M14-S6-082 | label | hidden-only | "Bonus Syiling" | FN-M14-11.2.3 |
| EL-M14-S6-083 | input | hidden-only | input, name=bonus_coins, type=number | FN-M14-11.2.3 |
| EL-M14-S6-084 | checkbox | hidden-only | checkbox, name=is_active, type=checkbox | FN-M14-11.2.3 |
| EL-M14-S6-085 | label | hidden-only | "Aktif" | FN-M14-11.2.3 |
| EL-M14-S6-086 | button | hidden-only | "Simpan", type=submit | FN-M14-11.2.3 |
| EL-M14-S6-087 | text | hidden-only | "Penyumbang Terbilang" | FN-M14-11.2.1 |
| EL-M14-S6-088 | badge | visible-default | "Aktif" | FN-M14-11.2.1 |
| EL-M14-S6-089 | toggle | visible-default | "Edit", type=submit, fa-edit | FN-M14-11.2.2 |
| EL-M14-S6-090 | form | hidden-only | form | FN-M14-11.2.3 |
| EL-M14-S6-091 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-11.2.3 |
| EL-M14-S6-092 | hidden-field | hidden-only | hidden-field, name=_method, type=hidden | FN-M14-11.2.3 |
| EL-M14-S6-093 | label | hidden-only | "Nama" | FN-M14-11.2.3 |
| EL-M14-S6-094 | input | hidden-only | input, name=name, type=text | FN-M14-11.2.3 |
| EL-M14-S6-095 | label | hidden-only | "Ikon CSS" | FN-M14-11.2.3 |
| EL-M14-S6-096 | input | hidden-only | input, name=icon, type=text | FN-M14-11.2.3 |
| EL-M14-S6-097 | label | hidden-only | "Threshold" | FN-M14-11.2.3 |
| EL-M14-S6-098 | input | hidden-only | input, name=threshold, type=number | FN-M14-11.2.3 |
| EL-M14-S6-099 | label | hidden-only | "Bonus Syiling" | FN-M14-11.2.3 |
| EL-M14-S6-100 | input | hidden-only | input, name=bonus_coins, type=number | FN-M14-11.2.3 |
| EL-M14-S6-101 | checkbox | hidden-only | checkbox, name=is_active, type=checkbox | FN-M14-11.2.3 |
| EL-M14-S6-102 | label | hidden-only | "Aktif" | FN-M14-11.2.3 |
| EL-M14-S6-103 | button | hidden-only | "Simpan", type=submit | FN-M14-11.2.3 |
| EL-M14-S6-104 | text | hidden-only | "Legenda Soalan" | FN-M14-11.2.1 |
| EL-M14-S6-105 | badge | visible-default | "Aktif" | FN-M14-11.2.1 |
| EL-M14-S6-106 | toggle | visible-default | "Edit", type=submit, fa-edit | FN-M14-11.2.2 |
| EL-M14-S6-107 | form | hidden-only | form | FN-M14-11.2.3 |
| EL-M14-S6-108 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-11.2.3 |
| EL-M14-S6-109 | hidden-field | hidden-only | hidden-field, name=_method, type=hidden | FN-M14-11.2.3 |
| EL-M14-S6-110 | label | hidden-only | "Nama" | FN-M14-11.2.3 |
| EL-M14-S6-111 | input | hidden-only | input, name=name, type=text | FN-M14-11.2.3 |
| EL-M14-S6-112 | label | hidden-only | "Ikon CSS" | FN-M14-11.2.3 |
| EL-M14-S6-113 | input | hidden-only | input, name=icon, type=text | FN-M14-11.2.3 |
| EL-M14-S6-114 | label | hidden-only | "Threshold" | FN-M14-11.2.3 |
| EL-M14-S6-115 | input | hidden-only | input, name=threshold, type=number | FN-M14-11.2.3 |
| EL-M14-S6-116 | label | hidden-only | "Bonus Syiling" | FN-M14-11.2.3 |
| EL-M14-S6-117 | input | hidden-only | input, name=bonus_coins, type=number | FN-M14-11.2.3 |
| EL-M14-S6-118 | checkbox | hidden-only | checkbox, name=is_active, type=checkbox | FN-M14-11.2.3 |
| EL-M14-S6-119 | label | hidden-only | "Aktif" | FN-M14-11.2.3 |
| EL-M14-S6-120 | button | hidden-only | "Simpan", type=submit | FN-M14-11.2.3 |
| EL-M14-S6-121 | text | hidden-only | "Guru Maestro" | FN-M14-11.2.1 |
| EL-M14-S6-122 | badge | visible-default | "Aktif" | FN-M14-11.2.1 |
| EL-M14-S6-123 | toggle | visible-default | "Edit", type=submit, fa-edit | FN-M14-11.2.2 |
| EL-M14-S6-124 | form | hidden-only | form | FN-M14-11.2.3 |
| EL-M14-S6-125 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-11.2.3 |
| EL-M14-S6-126 | hidden-field | hidden-only | hidden-field, name=_method, type=hidden | FN-M14-11.2.3 |
| EL-M14-S6-127 | label | hidden-only | "Nama" | FN-M14-11.2.3 |
| EL-M14-S6-128 | input | hidden-only | input, name=name, type=text | FN-M14-11.2.3 |
| EL-M14-S6-129 | label | hidden-only | "Ikon CSS" | FN-M14-11.2.3 |
| EL-M14-S6-130 | input | hidden-only | input, name=icon, type=text | FN-M14-11.2.3 |
| EL-M14-S6-131 | label | hidden-only | "Threshold" | FN-M14-11.2.3 |
| EL-M14-S6-132 | input | hidden-only | input, name=threshold, type=number | FN-M14-11.2.3 |
| EL-M14-S6-133 | label | hidden-only | "Bonus Syiling" | FN-M14-11.2.3 |
| EL-M14-S6-134 | input | hidden-only | input, name=bonus_coins, type=number | FN-M14-11.2.3 |
| EL-M14-S6-135 | checkbox | hidden-only | checkbox, name=is_active, type=checkbox | FN-M14-11.2.3 |
| EL-M14-S6-136 | label | hidden-only | "Aktif" | FN-M14-11.2.3 |
| EL-M14-S6-137 | button | hidden-only | "Simpan", type=submit | FN-M14-11.2.3 |
| EL-M14-S6-138 | text | hidden-only | "Legenda Terulung" | FN-M14-11.2.1 |
| EL-M14-S6-139 | badge | visible-default | "Aktif" | FN-M14-11.2.1 |
| EL-M14-S6-140 | toggle | visible-default | "Edit", type=submit, fa-edit | FN-M14-11.2.2 |
| EL-M14-S6-141 | form | hidden-only | form | FN-M14-11.2.3 |
| EL-M14-S6-142 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-11.2.3 |
| EL-M14-S6-143 | hidden-field | hidden-only | hidden-field, name=_method, type=hidden | FN-M14-11.2.3 |
| EL-M14-S6-144 | label | hidden-only | "Nama" | FN-M14-11.2.3 |
| EL-M14-S6-145 | input | hidden-only | input, name=name, type=text | FN-M14-11.2.3 |
| EL-M14-S6-146 | label | hidden-only | "Ikon CSS" | FN-M14-11.2.3 |
| EL-M14-S6-147 | input | hidden-only | input, name=icon, type=text | FN-M14-11.2.3 |
| EL-M14-S6-148 | label | hidden-only | "Threshold" | FN-M14-11.2.3 |
| EL-M14-S6-149 | input | hidden-only | input, name=threshold, type=number | FN-M14-11.2.3 |
| EL-M14-S6-150 | label | hidden-only | "Bonus Syiling" | FN-M14-11.2.3 |
| EL-M14-S6-151 | input | hidden-only | input, name=bonus_coins, type=number | FN-M14-11.2.3 |
| EL-M14-S6-152 | checkbox | hidden-only | checkbox, name=is_active, type=checkbox | FN-M14-11.2.3 |
| EL-M14-S6-153 | label | hidden-only | "Aktif" | FN-M14-11.2.3 |
| EL-M14-S6-154 | button | hidden-only | "Simpan", type=submit | FN-M14-11.2.3 |
| EL-M14-S6-155 | card | visible-default | "Katalog Ganjaran (0)" | FN-M14-11.3.1 |
| EL-M14-S6-156 | heading | visible-default | "Katalog Ganjaran (0)" | FN-M14-11.3.1 |
| EL-M14-S6-157 | toggle | visible-default | "Tambah Ganjaran", type=submit, fa-plus | FN-M14-11.3.2 |
| EL-M14-S6-158 | form | conditional | form | FN-M14-11.3.3 |
| EL-M14-S6-159 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-11.3.3 |
| EL-M14-S6-160 | label | conditional | "Nama *" | FN-M14-11.3.3 |
| EL-M14-S6-161 | input | conditional | input, name=name, type=text | FN-M14-11.3.3 |
| EL-M14-S6-162 | label | conditional | "Kategori *" | FN-M14-11.3.3 |
| EL-M14-S6-163 | select | conditional | select, name=category | FN-M14-11.3.3 |
| EL-M14-S6-164 | label | conditional | "Kos Syiling *" | FN-M14-11.3.3 |
| EL-M14-S6-165 | input | conditional | input, name=cost_coins, type=number | FN-M14-11.3.3 |
| EL-M14-S6-166 | label | conditional | "Stok (kosong = tiada had)" | FN-M14-11.3.3 |
| EL-M14-S6-167 | input | conditional | input, name=stock, type=number | FN-M14-11.3.3 |
| EL-M14-S6-168 | label | conditional | "Had/Pengguna" | FN-M14-11.3.3 |
| EL-M14-S6-169 | input | conditional | input, name=max_per_user, type=number | FN-M14-11.3.3 |
| EL-M14-S6-170 | label | conditional | "Had/Bulan" | FN-M14-11.3.3 |
| EL-M14-S6-171 | input | conditional | input, name=max_per_month, type=number | FN-M14-11.3.3 |
| EL-M14-S6-172 | label | conditional | "Penerangan" | FN-M14-11.3.3 |
| EL-M14-S6-173 | textarea | conditional | textarea, name=description | FN-M14-11.3.3 |
| EL-M14-S6-174 | label | conditional | "Gambar" | FN-M14-11.3.3 |
| EL-M14-S6-175 | input | conditional | input, name=image, type=file | FN-M14-11.3.3 |
| EL-M14-S6-176 | label | conditional | "Aktif" | FN-M14-11.3.3 |
| EL-M14-S6-177 | checkbox | conditional | checkbox, name=is_active, type=checkbox | FN-M14-11.3.3 |
| EL-M14-S6-178 | button | conditional | "Simpan", type=submit | FN-M14-11.3.3 |
| EL-M14-S6-179 | empty-state | visible-default | "Tiada ganjaran. Tambah ganjaran pertama!" | FN-M14-11.3.1 |

#### S7 — `/admin/gamifikasi/guru/tebusan` (11 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M14-S7-001 | filter | visible-default | "Menunggu", → /admin/gamifikasi/guru/tebusan?status=PENDING | FN-M14-11.4.1 |
| EL-M14-S7-002 | filter | visible-default | "Diproses", → /admin/gamifikasi/guru/tebusan?status=PROCESSING | FN-M14-11.4.1 |
| EL-M14-S7-003 | filter | visible-default | "Dihantar", → /admin/gamifikasi/guru/tebusan?status=DELIVERED | FN-M14-11.4.1 |
| EL-M14-S7-004 | filter | visible-default | "Dibatal", → /admin/gamifikasi/guru/tebusan?status=CANCELLED | FN-M14-11.4.1 |
| EL-M14-S7-005 | filter | visible-default | "Semua", → /admin/gamifikasi/guru/tebusan?status=all | FN-M14-11.4.1 |
| EL-M14-S7-006 | empty-state | visible-default | "Tiada tebusan pending" | FN-M14-11.4.2 |
| EL-M14-S7-007 | link | visible-default | "Kembali ke Gamifikasi Guru", → /admin/gamifikasi/guru, fa-arrow-left | FN-M14-11.4.3 |
| EL-M14-S7-008 | empty-state | conditional | "Tiada tebusan cancelled" | FN-M14-11.4.2 |
| EL-M14-S7-009 | empty-state | conditional | "Tiada tebusan delivered" | FN-M14-11.4.2 |
| EL-M14-S7-010 | empty-state | conditional | "Tiada tebusan processing" | FN-M14-11.4.2 |
| EL-M14-S7-011 | empty-state | conditional | "Tiada tebusan" | FN-M14-11.4.2 |

#### S8 — `/admin/gamifikasi/guru/tunai` (29 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M14-S8-001 | card | visible-default | "2" | FN-M14-11.5.1 |
| EL-M14-S8-002 | text | visible-default | "2" | FN-M14-11.5.1 |
| EL-M14-S8-003 | text | visible-default | "Menunggu" | FN-M14-11.5.1 |
| EL-M14-S8-004 | card | visible-default | "0" | FN-M14-11.5.1 |
| EL-M14-S8-005 | text | visible-default | "0" | FN-M14-11.5.1 |
| EL-M14-S8-006 | text | visible-default | "Diluluskan" | FN-M14-11.5.1 |
| EL-M14-S8-007 | card | visible-default | "0" | FN-M14-11.5.1 |
| EL-M14-S8-008 | text | visible-default | "0" | FN-M14-11.5.1 |
| EL-M14-S8-009 | text | visible-default | "Dibayar" | FN-M14-11.5.1 |
| EL-M14-S8-010 | card | visible-default | "RM0.00" | FN-M14-11.5.1 |
| EL-M14-S8-011 | text | visible-default | "RM0.00" | FN-M14-11.5.1 |
| EL-M14-S8-012 | text | visible-default | "Jumlah Dibayar" | FN-M14-11.5.1 |
| EL-M14-S8-013 | filter | visible-default | "Menunggu", → ?status=PENDING | FN-M14-11.5.2 |
| EL-M14-S8-014 | filter | visible-default | "Diluluskan", → ?status=APPROVED | FN-M14-11.5.2 |
| EL-M14-S8-015 | filter | visible-default | "Dalam Proses", → ?status=PROCESSING | FN-M14-11.5.2 |
| EL-M14-S8-016 | filter | visible-default | "Dibayar", → ?status=PAID | FN-M14-11.5.2 |
| EL-M14-S8-017 | filter | visible-default | "Ditolak", → ?status=REJECTED | FN-M14-11.5.2 |
| EL-M14-S8-018 | filter | visible-default | "Semua", → ?status=all | FN-M14-11.5.2 |
| EL-M14-S8-019 | card | visible-default | "Guru" | FN-M14-11.5.3 |
| EL-M14-S8-020 | table | visible-default | table | FN-M14-11.5.3 |
| EL-M14-S8-021 | badge | visible-default | "PENDING" | FN-M14-11.5.3 |
| EL-M14-S8-022 | form | visible-default | form | FN-M14-11.5.4 |
| EL-M14-S8-023 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-11.5.4 |
| EL-M14-S8-024 | hidden-field | hidden-only | hidden-field, name=_method, type=hidden | FN-M14-11.5.4 |
| EL-M14-S8-025 | select | visible-default | select, name=status | FN-M14-11.5.4 |
| EL-M14-S8-026 | input | visible-default | input, name=admin_note, type=text | FN-M14-11.5.4 |
| EL-M14-S8-027 | button | visible-default | button, type=submit, fa-check | FN-M14-11.5.4 |
| EL-M14-S8-028 | link | visible-default | "Tetapan", → /admin/gamifikasi/pengaturan, fa-cog | FN-M14-11.5.5 |
| EL-M14-S8-029 | link | visible-default | "Ganjaran", → /admin/gamifikasi/guru, fa-gift | FN-M14-11.5.5 |

#### S9 — `/admin/gamifikasi/pengaturan` (63 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M14-S9-001 | form | visible-default | form | FN-M14-11.6.1 |
| EL-M14-S9-002 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-11.6.1 |
| EL-M14-S9-003 | card | visible-default | "Tetapan Gamifikasi Guru" | FN-M14-11.6.1 |
| EL-M14-S9-004 | heading | visible-default | "Tetapan Gamifikasi Guru" | FN-M14-11.6.1 |
| EL-M14-S9-005 | hidden-field | hidden-only | hidden-field, name=settings[0][key], type=hidden | FN-M14-11.6.2 |
| EL-M14-S9-006 | label | visible-default | "Syiling per soalan sumbangan" | FN-M14-11.6.2 |
| EL-M14-S9-007 | text | visible-default | "Key:" | FN-M14-11.6.2 |
| EL-M14-S9-008 | text | visible-default | "coins_per_question" | FN-M14-11.6.2 |
| EL-M14-S9-009 | input | visible-default | input, name=settings[0][value], type=number | FN-M14-11.6.2 |
| EL-M14-S9-010 | hidden-field | hidden-only | hidden-field, name=settings[1][key], type=hidden | FN-M14-11.6.2 |
| EL-M14-S9-011 | label | visible-default | "Jumlah syiling untuk penukaran tunai" | FN-M14-11.6.2 |
| EL-M14-S9-012 | text | visible-default | "Key:" | FN-M14-11.6.2 |
| EL-M14-S9-013 | text | visible-default | "cash_rate_coins" | FN-M14-11.6.2 |
| EL-M14-S9-014 | input | visible-default | input, name=settings[1][value], type=number | FN-M14-11.6.2 |
| EL-M14-S9-015 | hidden-field | hidden-only | hidden-field, name=settings[2][key], type=hidden | FN-M14-11.6.3 |
| EL-M14-S9-016 | label | visible-default | "Nilai sen bagi setiap unit syiling (cth: 100 syiling = 8 sen)" | FN-M14-11.6.3 |
| EL-M14-S9-017 | text | visible-default | "Key:" | FN-M14-11.6.3 |
| EL-M14-S9-018 | text | visible-default | "cash_rate_sen" | FN-M14-11.6.3 |
| EL-M14-S9-019 | input | visible-default | input, name=settings[2][value], type=number | FN-M14-11.6.3 |
| EL-M14-S9-020 | hidden-field | hidden-only | hidden-field, name=settings[3][key], type=hidden | FN-M14-11.6.2 |
| EL-M14-S9-021 | label | visible-default | "Minimum syiling untuk tebus tunai" | FN-M14-11.6.2 |
| EL-M14-S9-022 | text | visible-default | "Key:" | FN-M14-11.6.2 |
| EL-M14-S9-023 | text | visible-default | "min_cash_withdrawal" | FN-M14-11.6.2 |
| EL-M14-S9-024 | input | visible-default | input, name=settings[3][value], type=number | FN-M14-11.6.2 |
| EL-M14-S9-025 | hidden-field | hidden-only | hidden-field, name=settings[4][key], type=hidden | FN-M14-11.6.2 |
| EL-M14-S9-026 | label | visible-default | "Aktifkan tebus tunai untuk guru" | FN-M14-11.6.2 |
| EL-M14-S9-027 | text | visible-default | "Key:" | FN-M14-11.6.2 |
| EL-M14-S9-028 | text | visible-default | "cash_withdrawal_enabled" | FN-M14-11.6.2 |
| EL-M14-S9-029 | select | visible-default | select, name=settings[4][value] | FN-M14-11.6.2 |
| EL-M14-S9-030 | hidden-field | hidden-only | hidden-field, name=settings[5][key], type=hidden | FN-M14-11.6.2 |
| EL-M14-S9-031 | label | visible-default | "Had nilai-kos tebus per pelajar per sesi (sen) — RM10" | FN-M14-11.6.2 |
| EL-M14-S9-032 | text | visible-default | "Key:" | FN-M14-11.6.2 |
| EL-M14-S9-033 | text | visible-default | "reward_budget_sen_session" | FN-M14-11.6.2 |
| EL-M14-S9-034 | input | visible-default | input, name=settings[5][value], type=number | FN-M14-11.6.2 |
| EL-M14-S9-035 | hidden-field | hidden-only | hidden-field, name=settings[6][key], type=hidden | FN-M14-11.6.2 |
| EL-M14-S9-036 | label | visible-default | "Sub-had nilai-kos tebus per pelajar per bulan (sen) — RM3" | FN-M14-11.6.2 |
| EL-M14-S9-037 | text | visible-default | "Key:" | FN-M14-11.6.2 |
| EL-M14-S9-038 | text | visible-default | "reward_budget_sen_month" | FN-M14-11.6.2 |
| EL-M14-S9-039 | input | visible-default | input, name=settings[6][value], type=number | FN-M14-11.6.2 |
| EL-M14-S9-040 | hidden-field | hidden-only | hidden-field, name=settings[7][key], type=hidden | FN-M14-11.6.2 |
| EL-M14-S9-041 | label | visible-default | "Tahun sesi persekolahan semasa (kitar bajet)" | FN-M14-11.6.2 |
| EL-M14-S9-042 | text | visible-default | "Key:" | FN-M14-11.6.2 |
| EL-M14-S9-043 | text | visible-default | "current_session_year" | FN-M14-11.6.2 |
| EL-M14-S9-044 | input | visible-default | input, name=settings[7][value], type=number | FN-M14-11.6.2 |
| EL-M14-S9-045 | hidden-field | hidden-only | hidden-field, name=settings[8][key], type=hidden | FN-M14-11.6.2 |
| EL-M14-S9-046 | label | visible-default | "Syiling flat per soalan akademik betul (tiada beza difficulty)" | FN-M14-11.6.2 |
| EL-M14-S9-047 | text | visible-default | "Key:" | FN-M14-11.6.2 |
| EL-M14-S9-048 | text | visible-default | "flat_quiz_reward" | FN-M14-11.6.2 |
| EL-M14-S9-049 | input | visible-default | input, name=settings[8][value], type=number | FN-M14-11.6.2 |
| EL-M14-S9-050 | hidden-field | hidden-only | hidden-field, name=settings[9][key], type=hidden | FN-M14-11.6.2 |
| EL-M14-S9-051 | label | visible-default | "Mini-games beri syiling? (0 = XP sahaja, tutup exploit)" | FN-M14-11.6.2 |
| EL-M14-S9-052 | text | visible-default | "Key:" | FN-M14-11.6.2 |
| EL-M14-S9-053 | text | visible-default | "games_award_syiling" | FN-M14-11.6.2 |
| EL-M14-S9-054 | select | visible-default | select, name=settings[9][value] | FN-M14-11.6.2 |
| EL-M14-S9-055 | text | visible-default | "Pratonton Kadar", fa-calculator | FN-M14-11.6.4 |
| EL-M14-S9-056 | text | visible-default | "per soalan sumbangan (RM0.08)100 syiling = RM0.80 · 1000 syiling = RM8.00Minimum …" | FN-M14-11.6.4 |
| EL-M14-S9-057 | text | visible-default | "10 syiling" | FN-M14-11.6.4 |
| EL-M14-S9-058 | text | visible-default | "10 syiling = 8 sen" | FN-M14-11.6.4 |
| EL-M14-S9-059 | text | visible-default | "100 syiling" | FN-M14-11.6.4 |
| EL-M14-S9-060 | button | visible-default | "Simpan Tetapan", type=submit, fa-save | FN-M14-11.6.5 |
| EL-M14-S9-061 | link | visible-default | "Ganjaran Guru", → /admin/gamifikasi/guru, fa-gift | FN-M14-11.6.6 |
| EL-M14-S9-062 | link | visible-default | "Tebus Tunai", → /admin/gamifikasi/guru/tunai, fa-money-bill-wave | FN-M14-11.6.6 |
| EL-M14-S9-063 | link | visible-default | "Tebusan", → /admin/gamifikasi/guru/tebusan, fa-receipt | FN-M14-11.6.6 |

#### S10 — `/admin/reward-control` (55 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M14-S10-001 | text | visible-default | "Liabiliti sesi 2026" | FN-M14-12.1.1 |
| EL-M14-S10-002 | text | visible-default | "RM0.00" | FN-M14-12.1.1 |
| EL-M14-S10-003 | text | visible-default | "jumlah kos hadiah ditebus" | FN-M14-12.1.1 |
| EL-M14-S10-004 | text | visible-default | "Pelajar menebus" | FN-M14-12.1.1 |
| EL-M14-S10-005 | text | visible-default | "0" | FN-M14-12.1.1 |
| EL-M14-S10-006 | text | visible-default | "Jumlah tebusan" | FN-M14-12.1.1 |
| EL-M14-S10-007 | text | visible-default | "0" | FN-M14-12.1.1 |
| EL-M14-S10-008 | heading | visible-default | "⚙️ Tetapan Kewangan" | FN-M14-12.2.1 |
| EL-M14-S10-009 | form | visible-default | form | FN-M14-12.2.1 |
| EL-M14-S10-010 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-12.2.1 |
| EL-M14-S10-011 | label | visible-default | "Bajet tebus / sesi (sen) — RM10 = 1000" | FN-M14-12.2.1 |
| EL-M14-S10-012 | input | visible-default | input, name=reward_budget_sen_session, type=number | FN-M14-12.2.1 |
| EL-M14-S10-013 | label | visible-default | "Sub-had tebus / bulan (sen) — RM3 = 300" | FN-M14-12.2.1 |
| EL-M14-S10-014 | input | visible-default | input, name=reward_budget_sen_month, type=number | FN-M14-12.2.1 |
| EL-M14-S10-015 | label | visible-default | "Syiling flat / soalan betul" | FN-M14-12.2.1 |
| EL-M14-S10-016 | input | visible-default | input, name=flat_quiz_reward, type=number | FN-M14-12.2.1 |
| EL-M14-S10-017 | label | visible-default | "Tahun sesi semasa" | FN-M14-12.2.1 |
| EL-M14-S10-018 | input | visible-default | input, name=current_session_year, type=number | FN-M14-12.2.1 |
| EL-M14-S10-019 | label | visible-default | "Mini-games beri syiling? (jika tidak: XP sahaja — tutup exploit)" | FN-M14-12.2.1 |
| EL-M14-S10-020 | checkbox | visible-default | checkbox, name=games_award_syiling, type=checkbox | FN-M14-12.2.1 |
| EL-M14-S10-021 | button | visible-default | "Simpan Tetapan", type=submit | FN-M14-12.2.1 |
| EL-M14-S10-022 | heading | visible-default | "🎁 Kos Sebenar Hadiah (sen) — digital = 0, tak makan bajet" | FN-M14-12.3.1 |
| EL-M14-S10-023 | table | visible-default | table | FN-M14-12.3.1 |
| EL-M14-S10-024 | form | visible-default | form | FN-M14-12.3.1 |
| EL-M14-S10-025 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-12.3.1 |
| EL-M14-S10-026 | input | visible-default | input, name=cost_value_sen, type=number | FN-M14-12.3.1 |
| EL-M14-S10-027 | button | visible-default | "Simpan", type=submit | FN-M14-12.3.1 |
| EL-M14-S10-028 | form | visible-default | form | FN-M14-12.3.1 |
| EL-M14-S10-029 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-12.3.1 |
| EL-M14-S10-030 | input | visible-default | input, name=cost_value_sen, type=number | FN-M14-12.3.1 |
| EL-M14-S10-031 | button | visible-default | "Simpan", type=submit | FN-M14-12.3.1 |
| EL-M14-S10-032 | form | visible-default | form | FN-M14-12.3.1 |
| EL-M14-S10-033 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-12.3.1 |
| EL-M14-S10-034 | input | visible-default | input, name=cost_value_sen, type=number | FN-M14-12.3.1 |
| EL-M14-S10-035 | button | visible-default | "Simpan", type=submit | FN-M14-12.3.1 |
| EL-M14-S10-036 | heading | visible-default | "🎟️ Cabutan" | FN-M14-12.4.1 |
| EL-M14-S10-037 | table | visible-default | table | FN-M14-12.4.1 |
| EL-M14-S10-038 | accordion-trigger | visible-default | "➕ Cipta Cabutan Baru" | FN-M14-12.4.2 |
| EL-M14-S10-039 | form | conditional | form | FN-M14-12.4.3 |
| EL-M14-S10-040 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-12.4.3 |
| EL-M14-S10-041 | label | conditional | "Tajuk" | FN-M14-12.4.3 |
| EL-M14-S10-042 | input | conditional | input, name=title, type=text | FN-M14-12.4.3 |
| EL-M14-S10-043 | label | conditional | "Penerangan" | FN-M14-12.4.3 |
| EL-M14-S10-044 | input | conditional | input, name=description, type=text | FN-M14-12.4.3 |
| EL-M14-S10-045 | label | conditional | "Harga tiket (syiling)" | FN-M14-12.4.3 |
| EL-M14-S10-046 | input | conditional | input, name=ticket_cost_syiling, type=number | FN-M14-12.4.3 |
| EL-M14-S10-047 | label | conditional | "Max tiket / pelajar" | FN-M14-12.4.3 |
| EL-M14-S10-048 | input | conditional | input, name=max_tickets_per_student, type=number | FN-M14-12.4.3 |
| EL-M14-S10-049 | label | conditional | "Kolam hadiah (JSON)" | FN-M14-12.4.3 |
| EL-M14-S10-050 | textarea | conditional | textarea, name=prize_pool | FN-M14-12.4.3 |
| EL-M14-S10-051 | label | conditional | "Tarikh tutup" | FN-M14-12.4.3 |
| EL-M14-S10-052 | input | conditional | input, name=closes_at, type=date | FN-M14-12.4.3 |
| EL-M14-S10-053 | label | conditional | "Buka serta-merta" | FN-M14-12.4.3 |
| EL-M14-S10-054 | checkbox | conditional | checkbox, name=open_now, type=checkbox | FN-M14-12.4.3 |
| EL-M14-S10-055 | button | conditional | "Cipta Cabutan", type=submit | FN-M14-12.4.3 |

#### S11 — `/gamification` (133 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M14-S11-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M14-S11-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M14-S11-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M14-S11-004 | badge | visible-default | "🥉" | FN-M14-2.1.1 |
| EL-M14-S11-005 | badge | visible-default | "📚 Permulaan" | FN-M14-2.1.1 |
| EL-M14-S11-006 | heading | visible-default | "Gangsa Tier" | FN-M14-2.1.1 |
| EL-M14-S11-007 | text | visible-default | "Level 2" | FN-M14-2.1.1 |
| EL-M14-S11-008 | text | visible-default | "256" | FN-M14-2.1.2 |
| EL-M14-S11-009 | text | visible-default | "Syiling 💰" | FN-M14-2.1.2 |
| EL-M14-S11-010 | text | visible-default | "0" | FN-M14-2.1.2 |
| EL-M14-S11-011 | text | visible-default | "Token 🎫" | FN-M14-2.1.2 |
| EL-M14-S11-012 | text | visible-default | "⬆️ Naik ke" | FN-M14-2.1.3 |
| EL-M14-S11-013 | text | visible-default | "Perak" | FN-M14-2.1.3 |
| EL-M14-S11-014 | text | visible-default | "51.2%" | FN-M14-2.1.3 |
| EL-M14-S11-015 | text | visible-default | "Perlu 244 syiling lagi" | FN-M14-2.1.3 |
| EL-M14-S11-016 | link | visible-default | "Tukar Token", → /gamification/convert, fa-exchange-alt | FN-M14-2.1.4 |
| EL-M14-S11-017 | link | visible-default | "Cabaran Harian", → /gamification/challenges, fa-bullseye | FN-M14-2.1.4 |
| EL-M14-S11-018 | link | visible-default | "Kedai Hadiah", → /gamification/rewards, fa-gift | FN-M14-2.1.4 |
| EL-M14-S11-019 | card | visible-default | "+0 hari ini" | FN-M14-2.1.5 |
| EL-M14-S11-020 | text | visible-default | "256" | FN-M14-2.1.5 |
| EL-M14-S11-021 | text | visible-default | "Baki Syiling" | FN-M14-2.1.5 |
| EL-M14-S11-022 | text | visible-default | "+0 hari ini" | FN-M14-2.1.5 |
| EL-M14-S11-023 | card | visible-default | "50 syiling = 1 token" | FN-M14-2.1.5 |
| EL-M14-S11-024 | text | visible-default | "0" | FN-M14-2.1.5 |
| EL-M14-S11-025 | text | visible-default | "Baki Token" | FN-M14-2.1.5 |
| EL-M14-S11-026 | text | visible-default | "50 syiling = 1 token" | FN-M14-2.1.5 |
| EL-M14-S11-027 | card | visible-default | "8/110 XP" | FN-M14-2.1.5 |
| EL-M14-S11-028 | text | visible-default | "2" | FN-M14-2.1.5 |
| EL-M14-S11-029 | text | visible-default | "Level" | FN-M14-2.1.5 |
| EL-M14-S11-030 | text | visible-default | "8/110 XP" | FN-M14-2.1.5 |
| EL-M14-S11-031 | card | visible-default | "+0 minggu ini" | FN-M14-2.1.5 |
| EL-M14-S11-032 | text | visible-default | "256" | FN-M14-2.1.5 |
| EL-M14-S11-033 | text | visible-default | "Jumlah Syiling" | FN-M14-2.1.5 |
| EL-M14-S11-034 | text | visible-default | "+0 minggu ini" | FN-M14-2.1.5 |
| EL-M14-S11-035 | card | visible-default | "Lihat semua →" | FN-M14-2.1.6 |
| EL-M14-S11-036 | text | visible-default | "Cabaran Hari Ini", fa-bullseye | FN-M14-2.1.6 |
| EL-M14-S11-037 | link | visible-default | "Lihat semua →", → /gamification/challenges | FN-M14-2.1.6 |
| EL-M14-S11-038 | card | visible-default | "Rajin Berlatih" | FN-M14-2.1.6 |
| EL-M14-S11-039 | text | visible-default | "📝" | FN-M14-2.1.6 |
| EL-M14-S11-040 | text | visible-default | "Rajin Berlatih" | FN-M14-2.1.6 |
| EL-M14-S11-041 | badge | visible-default | "Mudah" | FN-M14-2.1.6 |
| EL-M14-S11-042 | text | visible-default | "Selesaikan 3 kuiz hari ini" | FN-M14-2.1.6 |
| EL-M14-S11-043 | text | visible-default | "0/3" | FN-M14-2.1.6 |
| EL-M14-S11-044 | text | visible-default | "+15 💰" | FN-M14-2.1.6 |
| EL-M14-S11-045 | card | visible-default | "Si Tepat" | FN-M14-2.1.6 |
| EL-M14-S11-046 | text | visible-default | "🎯" | FN-M14-2.1.6 |
| EL-M14-S11-047 | text | visible-default | "Si Tepat" | FN-M14-2.1.6 |
| EL-M14-S11-048 | badge | visible-default | "Sederhana" | FN-M14-2.1.6 |
| EL-M14-S11-049 | text | visible-default | "Dapat 80% ketepatan dalam mana-mana kuiz" | FN-M14-2.1.6 |
| EL-M14-S11-050 | text | visible-default | "0/80" | FN-M14-2.1.6 |
| EL-M14-S11-051 | text | visible-default | "+20 💰" | FN-M14-2.1.6 |
| EL-M14-S11-052 | card | visible-default | "Penjelajah Topik" | FN-M14-2.1.6 |
| EL-M14-S11-053 | text | visible-default | "🗺️" | FN-M14-2.1.6 |
| EL-M14-S11-054 | text | visible-default | "Penjelajah Topik" | FN-M14-2.1.6 |
| EL-M14-S11-055 | badge | visible-default | "Sederhana" | FN-M14-2.1.6 |
| EL-M14-S11-056 | text | visible-default | "Latih 3 topik berbeza hari ini" | FN-M14-2.1.6 |
| EL-M14-S11-057 | text | visible-default | "0/3" | FN-M14-2.1.6 |
| EL-M14-S11-058 | text | visible-default | "+25 💰" | FN-M14-2.1.6 |
| EL-M14-S11-059 | card | visible-default | "Kilat Matematik" | FN-M14-2.1.6 |
| EL-M14-S11-060 | text | visible-default | "⚡" | FN-M14-2.1.6 |
| EL-M14-S11-061 | text | visible-default | "Kilat Matematik" | FN-M14-2.1.6 |
| EL-M14-S11-062 | badge | visible-default | "Sukar" | FN-M14-2.1.6 |
| EL-M14-S11-063 | text | visible-default | "Jawab 10 soalan dengan betul" | FN-M14-2.1.6 |
| EL-M14-S11-064 | text | visible-default | "0/10" | FN-M14-2.1.6 |
| EL-M14-S11-065 | text | visible-default | "+30 💰" | FN-M14-2.1.6 |
| EL-M14-S11-066 | card | visible-default | "Semua →" | FN-M14-2.1.7 |
| EL-M14-S11-067 | text | visible-default | "Transaksi Terkini", fa-history | FN-M14-2.1.7 |
| EL-M14-S11-068 | link | visible-default | "Semua →", → /gamification/history | FN-M14-2.1.7 |
| EL-M14-S11-069 | text | visible-default | "💰" | FN-M14-2.1.7 |
| EL-M14-S11-070 | text | visible-default | "Cabaran selesai: Penjelajah Topik" | FN-M14-2.1.7 |
| EL-M14-S11-071 | text | visible-default | "4 bulan yang lepas" | FN-M14-2.1.7 |
| EL-M14-S11-072 | text | visible-default | "+25" | FN-M14-2.1.7 |
| EL-M14-S11-073 | text | visible-default | "💰" | FN-M14-2.1.7 |
| EL-M14-S11-074 | text | visible-default | "Streak activity (spm)" | FN-M14-2.1.7 |
| EL-M14-S11-075 | text | visible-default | "4 bulan yang lepas" | FN-M14-2.1.7 |
| EL-M14-S11-076 | text | visible-default | "+7" | FN-M14-2.1.7 |
| EL-M14-S11-077 | text | visible-default | "💰" | FN-M14-2.1.7 |
| EL-M14-S11-078 | text | visible-default | "SPM Tahun Lepas: 1 betul — 20%" | FN-M14-2.1.7 |
| EL-M14-S11-079 | text | visible-default | "4 bulan yang lepas" | FN-M14-2.1.7 |
| EL-M14-S11-080 | text | visible-default | "+3" | FN-M14-2.1.7 |
| EL-M14-S11-081 | text | visible-default | "💰" | FN-M14-2.1.7 |
| EL-M14-S11-082 | text | visible-default | "Cabaran selesai: Cabaran Kilat" | FN-M14-2.1.7 |
| EL-M14-S11-083 | text | visible-default | "4 bulan yang lepas" | FN-M14-2.1.7 |
| EL-M14-S11-084 | text | visible-default | "+40" | FN-M14-2.1.7 |
| EL-M14-S11-085 | text | visible-default | "💰" | FN-M14-2.1.7 |
| EL-M14-S11-086 | text | visible-default | "Cabaran selesai: Rajin Berlatih" | FN-M14-2.1.7 |
| EL-M14-S11-087 | text | visible-default | "4 bulan yang lepas" | FN-M14-2.1.7 |
| EL-M14-S11-088 | text | visible-default | "+15" | FN-M14-2.1.7 |
| EL-M14-S11-089 | text | visible-default | "💰" | FN-M14-2.1.7 |
| EL-M14-S11-090 | text | visible-default | "Latih Tubi SPM: 11 betul — 32.35%" | FN-M14-2.1.7 |
| EL-M14-S11-091 | text | visible-default | "4 bulan yang lepas" | FN-M14-2.1.7 |
| EL-M14-S11-092 | text | visible-default | "+22" | FN-M14-2.1.7 |
| EL-M14-S11-093 | card | visible-default | "L2" | FN-M14-2.1.8 |
| EL-M14-S11-094 | text | visible-default | "Tahap Penguasaan Subjek", fa-layer-group | FN-M14-2.1.8 |
| EL-M14-S11-095 | text | visible-default | "L2" | FN-M14-2.1.8 |
| EL-M14-S11-096 | text | visible-default | "Bahasa Melayu" | FN-M14-2.1.8 |
| EL-M14-S11-097 | text | visible-default | "Aktif" | FN-M14-2.1.8 |
| EL-M14-S11-098 | text | visible-default | "46 betul / 50" | FN-M14-2.1.8 |
| EL-M14-S11-099 | text | visible-default | "48.94% tepat · 1.05x bonus" | FN-M14-2.1.8 |
| EL-M14-S11-100 | text | visible-default | "L1" | FN-M14-2.1.8 |
| EL-M14-S11-101 | text | visible-default | "Sejarah" | FN-M14-2.1.8 |
| EL-M14-S11-102 | text | visible-default | "Mula Belajar" | FN-M14-2.1.8 |
| EL-M14-S11-103 | text | visible-default | "14 betul / 25" | FN-M14-2.1.8 |
| EL-M14-S11-104 | text | visible-default | "35% tepat" | FN-M14-2.1.8 |
| EL-M14-S11-105 | card | visible-default | "Gangsa" | FN-M14-2.1.9 |
| EL-M14-S11-106 | text | visible-default | "Sistem Tier", fa-crown | FN-M14-2.1.9 |
| EL-M14-S11-107 | card | visible-default | "Gangsa" | FN-M14-2.1.9 |
| EL-M14-S11-108 | text | visible-default | "🥉" | FN-M14-2.1.9 |
| EL-M14-S11-109 | text | visible-default | "Gangsa" | FN-M14-2.1.9 |
| EL-M14-S11-110 | text | visible-default | "0+ syiling" | FN-M14-2.1.9 |
| EL-M14-S11-111 | text | visible-default | "50 syiling = 1 token" | FN-M14-2.1.9 |
| EL-M14-S11-112 | text | visible-default | "✨ ANDA DI SINI" | FN-M14-2.1.9 |
| EL-M14-S11-113 | card | visible-default | "Perak" | FN-M14-2.1.9 |
| EL-M14-S11-114 | text | visible-default | "🥈" | FN-M14-2.1.9 |
| EL-M14-S11-115 | text | visible-default | "Perak" | FN-M14-2.1.9 |
| EL-M14-S11-116 | text | visible-default | "500+ syiling" | FN-M14-2.1.9 |
| EL-M14-S11-117 | text | visible-default | "40 syiling = 1 token" | FN-M14-2.1.9 |
| EL-M14-S11-118 | card | visible-default | "Emas" | FN-M14-2.1.9 |
| EL-M14-S11-119 | text | visible-default | "🥇" | FN-M14-2.1.9 |
| EL-M14-S11-120 | text | visible-default | "Emas" | FN-M14-2.1.9 |
| EL-M14-S11-121 | text | visible-default | "2,000+ syiling" | FN-M14-2.1.9 |
| EL-M14-S11-122 | text | visible-default | "30 syiling = 1 token" | FN-M14-2.1.9 |
| EL-M14-S11-123 | card | visible-default | "Platinum" | FN-M14-2.1.9 |
| EL-M14-S11-124 | text | visible-default | "💎" | FN-M14-2.1.9 |
| EL-M14-S11-125 | text | visible-default | "Platinum" | FN-M14-2.1.9 |
| EL-M14-S11-126 | text | visible-default | "5,000+ syiling" | FN-M14-2.1.9 |
| EL-M14-S11-127 | text | visible-default | "20 syiling = 1 token" | FN-M14-2.1.9 |
| EL-M14-S11-128 | card | visible-default | "Pelajar" | FN-M14-2.1.10 |
| EL-M14-S11-129 | text | visible-default | "Gelaran Seterusnya", fa-medal | FN-M14-2.1.10 |
| EL-M14-S11-130 | text | visible-default | "🎓" | FN-M14-2.1.10 |
| EL-M14-S11-131 | text | visible-default | "Pelajar" | FN-M14-2.1.10 |
| EL-M14-S11-132 | text | visible-default | "Perlu 44 syiling lagi untuk gelaran ini" | FN-M14-2.1.10 |
| EL-M14-S11-133 | link | visible-default | "Kad Kongsi Kongsi pencapaian anda di WhatsApp!", → /gamification/kad-kongsi, fa-share-nodes | FN-M14-2.1.11 |

#### S12 — `/gamification/convert` (52 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M14-S12-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M14-S12-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M14-S12-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M14-S12-004 | heading | visible-default | "🔄 Tukar Syiling → Token" | FN-M14-3.1.1 |
| EL-M14-S12-005 | text | visible-default | "Tukar syiling anda kepada token untuk tebus hadiah" | FN-M14-3.1.1 |
| EL-M14-S12-006 | text | visible-default | "256" | FN-M14-3.1.1 |
| EL-M14-S12-007 | text | visible-default | "Baki Syiling" | FN-M14-3.1.1 |
| EL-M14-S12-008 | text | visible-default | "0" | FN-M14-3.1.1 |
| EL-M14-S12-009 | text | visible-default | "Baki Token" | FN-M14-3.1.1 |
| EL-M14-S12-010 | card | visible-default | "💱 Penukaran" | FN-M14-3.1.2 |
| EL-M14-S12-011 | heading | visible-default | "💱 Penukaran" | FN-M14-3.1.2 |
| EL-M14-S12-012 | form | visible-default | form | FN-M14-3.1.2 |
| EL-M14-S12-013 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-3.1.2 |
| EL-M14-S12-014 | label | visible-default | "Syiling untuk ditukar" | FN-M14-3.1.2 |
| EL-M14-S12-015 | input | visible-default | input, name=syiling_amount, type=number | FN-M14-3.1.2 |
| EL-M14-S12-016 | button | visible-default | "50 syiling", type=button | FN-M14-3.1.3 |
| EL-M14-S12-017 | button | visible-default | "250 syiling", type=button | FN-M14-3.1.3 |
| EL-M14-S12-018 | button | visible-default | "Semua (256)", type=button | FN-M14-3.1.3 |
| EL-M14-S12-019 | text | visible-default | "Anda akan terima" | FN-M14-3.1.4 |
| EL-M14-S12-020 | text | visible-default | "1" | FN-M14-3.1.4 |
| EL-M14-S12-021 | text | visible-default | "Token 🎫" | FN-M14-3.1.4 |
| EL-M14-S12-022 | text | visible-default | "Kadar: 50 syiling = 1 token (Gangsa)" | FN-M14-3.1.4 |
| EL-M14-S12-023 | button | visible-default | "Tukar Sekarang", type=submit, fa-exchange-alt | FN-M14-3.1.5 |
| EL-M14-S12-024 | card | visible-default | "📊 Kadar Penukaran Mengikut Tier" | FN-M14-3.1.6 |
| EL-M14-S12-025 | heading | visible-default | "📊 Kadar Penukaran Mengikut Tier" | FN-M14-3.1.6 |
| EL-M14-S12-026 | card | visible-default | "Gangsa" | FN-M14-3.1.6 |
| EL-M14-S12-027 | text | visible-default | "🥉" | FN-M14-3.1.6 |
| EL-M14-S12-028 | text | visible-default | "Gangsa" | FN-M14-3.1.6 |
| EL-M14-S12-029 | text | visible-default | "0+ syiling" | FN-M14-3.1.6 |
| EL-M14-S12-030 | text | visible-default | "50" | FN-M14-3.1.6 |
| EL-M14-S12-031 | text | visible-default | "syiling/token" | FN-M14-3.1.6 |
| EL-M14-S12-032 | badge | visible-default | "ANDA" | FN-M14-3.1.6 |
| EL-M14-S12-033 | card | visible-default | "Perak" | FN-M14-3.1.6 |
| EL-M14-S12-034 | text | visible-default | "🥈" | FN-M14-3.1.6 |
| EL-M14-S12-035 | text | visible-default | "Perak" | FN-M14-3.1.6 |
| EL-M14-S12-036 | text | visible-default | "500+ syiling" | FN-M14-3.1.6 |
| EL-M14-S12-037 | text | visible-default | "40" | FN-M14-3.1.6 |
| EL-M14-S12-038 | text | visible-default | "syiling/token" | FN-M14-3.1.6 |
| EL-M14-S12-039 | card | visible-default | "Emas" | FN-M14-3.1.6 |
| EL-M14-S12-040 | text | visible-default | "🥇" | FN-M14-3.1.6 |
| EL-M14-S12-041 | text | visible-default | "Emas" | FN-M14-3.1.6 |
| EL-M14-S12-042 | text | visible-default | "2,000+ syiling" | FN-M14-3.1.6 |
| EL-M14-S12-043 | text | visible-default | "30" | FN-M14-3.1.6 |
| EL-M14-S12-044 | text | visible-default | "syiling/token" | FN-M14-3.1.6 |
| EL-M14-S12-045 | card | visible-default | "Platinum" | FN-M14-3.1.6 |
| EL-M14-S12-046 | text | visible-default | "💎" | FN-M14-3.1.6 |
| EL-M14-S12-047 | text | visible-default | "Platinum" | FN-M14-3.1.6 |
| EL-M14-S12-048 | text | visible-default | "5,000+ syiling" | FN-M14-3.1.6 |
| EL-M14-S12-049 | text | visible-default | "20" | FN-M14-3.1.6 |
| EL-M14-S12-050 | text | visible-default | "syiling/token" | FN-M14-3.1.6 |
| EL-M14-S12-051 | text | visible-default | "💡 Naik tier untuk dapatkan kadar penukaran yang lebih baik! Semakin tinggi tier …" | FN-M14-3.1.7 |
| EL-M14-S12-052 | text | visible-default | "Tips:" | FN-M14-3.1.7 |

#### S13 — `/gamification/challenges` (97 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M14-S13-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M14-S13-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M14-S13-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M14-S13-004 | heading | visible-default | "🎯 Cabaran Harian" | FN-M14-4.1.1 |
| EL-M14-S13-005 | text | visible-default | "Selesaikan cabaran untuk dapatkan syiling & XP bonus!" | FN-M14-4.1.1 |
| EL-M14-S13-006 | text | visible-default | "0/10" | FN-M14-4.1.1 |
| EL-M14-S13-007 | text | visible-default | "Selesai" | FN-M14-4.1.1 |
| EL-M14-S13-008 | card | visible-default | "Rajin Berlatih" | FN-M14-4.1.2 |
| EL-M14-S13-009 | text | visible-default | "📝" | FN-M14-4.1.2 |
| EL-M14-S13-010 | heading | visible-default | "Rajin Berlatih" | FN-M14-4.1.2 |
| EL-M14-S13-011 | badge | visible-default | "Mudah" | FN-M14-4.1.2 |
| EL-M14-S13-012 | text | visible-default | "Selesaikan 3 kuiz hari ini" | FN-M14-4.1.2 |
| EL-M14-S13-013 | text | visible-default | "💰 +15 Syiling" | FN-M14-4.1.2 |
| EL-M14-S13-014 | text | visible-default | "⭐ +10 XP" | FN-M14-4.1.2 |
| EL-M14-S13-015 | text | visible-default | "Progres: 0/3" | FN-M14-4.1.2 |
| EL-M14-S13-016 | text | visible-default | "0%" | FN-M14-4.1.2 |
| EL-M14-S13-017 | card | visible-default | "Si Tepat" | FN-M14-4.1.2 |
| EL-M14-S13-018 | text | visible-default | "🎯" | FN-M14-4.1.2 |
| EL-M14-S13-019 | heading | visible-default | "Si Tepat" | FN-M14-4.1.2 |
| EL-M14-S13-020 | badge | visible-default | "Sederhana" | FN-M14-4.1.2 |
| EL-M14-S13-021 | text | visible-default | "Dapat 80% ketepatan dalam mana-mana kuiz" | FN-M14-4.1.2 |
| EL-M14-S13-022 | text | visible-default | "💰 +20 Syiling" | FN-M14-4.1.2 |
| EL-M14-S13-023 | text | visible-default | "⭐ +15 XP" | FN-M14-4.1.2 |
| EL-M14-S13-024 | text | visible-default | "Progres: 0/80" | FN-M14-4.1.2 |
| EL-M14-S13-025 | text | visible-default | "0%" | FN-M14-4.1.2 |
| EL-M14-S13-026 | card | visible-default | "Penjelajah Topik" | FN-M14-4.1.2 |
| EL-M14-S13-027 | text | visible-default | "🗺️" | FN-M14-4.1.2 |
| EL-M14-S13-028 | heading | visible-default | "Penjelajah Topik" | FN-M14-4.1.2 |
| EL-M14-S13-029 | badge | visible-default | "Sederhana" | FN-M14-4.1.2 |
| EL-M14-S13-030 | text | visible-default | "Latih 3 topik berbeza hari ini" | FN-M14-4.1.2 |
| EL-M14-S13-031 | text | visible-default | "💰 +25 Syiling" | FN-M14-4.1.2 |
| EL-M14-S13-032 | text | visible-default | "⭐ +20 XP" | FN-M14-4.1.2 |
| EL-M14-S13-033 | text | visible-default | "Progres: 0/3" | FN-M14-4.1.2 |
| EL-M14-S13-034 | text | visible-default | "0%" | FN-M14-4.1.2 |
| EL-M14-S13-035 | card | visible-default | "Kilat Matematik" | FN-M14-4.1.2 |
| EL-M14-S13-036 | text | visible-default | "⚡" | FN-M14-4.1.2 |
| EL-M14-S13-037 | heading | visible-default | "Kilat Matematik" | FN-M14-4.1.2 |
| EL-M14-S13-038 | badge | visible-default | "Sukar" | FN-M14-4.1.2 |
| EL-M14-S13-039 | text | visible-default | "Jawab 10 soalan dengan betul" | FN-M14-4.1.2 |
| EL-M14-S13-040 | text | visible-default | "💰 +30 Syiling" | FN-M14-4.1.2 |
| EL-M14-S13-041 | text | visible-default | "⭐ +25 XP" | FN-M14-4.1.2 |
| EL-M14-S13-042 | text | visible-default | "Progres: 0/10" | FN-M14-4.1.2 |
| EL-M14-S13-043 | text | visible-default | "0%" | FN-M14-4.1.2 |
| EL-M14-S13-044 | card | visible-default | "Mula Hari Ini" | FN-M14-4.1.2 |
| EL-M14-S13-045 | text | visible-default | "🌟" | FN-M14-4.1.2 |
| EL-M14-S13-046 | heading | visible-default | "Mula Hari Ini" | FN-M14-4.1.2 |
| EL-M14-S13-047 | badge | visible-default | "Mudah" | FN-M14-4.1.2 |
| EL-M14-S13-048 | text | visible-default | "Selesaikan 1 sesi latihan hari ini" | FN-M14-4.1.2 |
| EL-M14-S13-049 | text | visible-default | "💰 +10 Syiling" | FN-M14-4.1.2 |
| EL-M14-S13-050 | text | visible-default | "⭐ +5 XP" | FN-M14-4.1.2 |
| EL-M14-S13-051 | text | visible-default | "Progres: 0/1" | FN-M14-4.1.2 |
| EL-M14-S13-052 | text | visible-default | "0%" | FN-M14-4.1.2 |
| EL-M14-S13-053 | card | visible-default | "Jawab 5 Betul" | FN-M14-4.1.2 |
| EL-M14-S13-054 | text | visible-default | "✅" | FN-M14-4.1.2 |
| EL-M14-S13-055 | heading | visible-default | "Jawab 5 Betul" | FN-M14-4.1.2 |
| EL-M14-S13-056 | badge | visible-default | "Mudah" | FN-M14-4.1.2 |
| EL-M14-S13-057 | text | visible-default | "Jawab 5 soalan dengan betul" | FN-M14-4.1.2 |
| EL-M14-S13-058 | text | visible-default | "💰 +12 Syiling" | FN-M14-4.1.2 |
| EL-M14-S13-059 | text | visible-default | "⭐ +8 XP" | FN-M14-4.1.2 |
| EL-M14-S13-060 | text | visible-default | "Progres: 0/5" | FN-M14-4.1.2 |
| EL-M14-S13-061 | text | visible-default | "0%" | FN-M14-4.1.2 |
| EL-M14-S13-062 | card | visible-default | "Latihan 10 Minit" | FN-M14-4.1.2 |
| EL-M14-S13-063 | text | visible-default | "⏱️" | FN-M14-4.1.2 |
| EL-M14-S13-064 | heading | visible-default | "Latihan 10 Minit" | FN-M14-4.1.2 |
| EL-M14-S13-065 | badge | visible-default | "Sederhana" | FN-M14-4.1.2 |
| EL-M14-S13-066 | text | visible-default | "Berlatih sekurang-kurangnya 10 minit hari ini" | FN-M14-4.1.2 |
| EL-M14-S13-067 | text | visible-default | "💰 +20 Syiling" | FN-M14-4.1.2 |
| EL-M14-S13-068 | text | visible-default | "⭐ +15 XP" | FN-M14-4.1.2 |
| EL-M14-S13-069 | text | visible-default | "Progres: 0/10" | FN-M14-4.1.2 |
| EL-M14-S13-070 | text | visible-default | "0%" | FN-M14-4.1.2 |
| EL-M14-S13-071 | card | visible-default | "Kombo 2 Hari" | FN-M14-4.1.2 |
| EL-M14-S13-072 | text | visible-default | "🔥" | FN-M14-4.1.2 |
| EL-M14-S13-073 | heading | visible-default | "Kombo 2 Hari" | FN-M14-4.1.2 |
| EL-M14-S13-074 | badge | visible-default | "Sederhana" | FN-M14-4.1.2 |
| EL-M14-S13-075 | text | visible-default | "Kekalkan kombo latihan selama 2 hari berturut-turut" | FN-M14-4.1.2 |
| EL-M14-S13-076 | text | visible-default | "💰 +25 Syiling" | FN-M14-4.1.2 |
| EL-M14-S13-077 | text | visible-default | "⭐ +20 XP" | FN-M14-4.1.2 |
| EL-M14-S13-078 | text | visible-default | "Progres: 0/2" | FN-M14-4.1.2 |
| EL-M14-S13-079 | text | visible-default | "0%" | FN-M14-4.1.2 |
| EL-M14-S13-080 | card | visible-default | "Ketepatan 90%" | FN-M14-4.1.2 |
| EL-M14-S13-081 | text | visible-default | "🎯" | FN-M14-4.1.2 |
| EL-M14-S13-082 | heading | visible-default | "Ketepatan 90%" | FN-M14-4.1.2 |
| EL-M14-S13-083 | badge | visible-default | "Sukar" | FN-M14-4.1.2 |
| EL-M14-S13-084 | text | visible-default | "Capai ketepatan 90% dalam sesi latihan" | FN-M14-4.1.2 |
| EL-M14-S13-085 | text | visible-default | "💰 +35 Syiling" | FN-M14-4.1.2 |
| EL-M14-S13-086 | text | visible-default | "⭐ +30 XP" | FN-M14-4.1.2 |
| EL-M14-S13-087 | text | visible-default | "Progres: 0/90" | FN-M14-4.1.2 |
| EL-M14-S13-088 | text | visible-default | "0%" | FN-M14-4.1.2 |
| EL-M14-S13-089 | card | visible-default | "Cabaran Kilat" | FN-M14-4.1.2 |
| EL-M14-S13-090 | text | visible-default | "⚡" | FN-M14-4.1.2 |
| EL-M14-S13-091 | heading | visible-default | "Cabaran Kilat" | FN-M14-4.1.2 |
| EL-M14-S13-092 | badge | visible-default | "Sukar" | FN-M14-4.1.2 |
| EL-M14-S13-093 | text | visible-default | "Jawab 20 soalan betul dalam satu sesi" | FN-M14-4.1.2 |
| EL-M14-S13-094 | text | visible-default | "💰 +40 Syiling" | FN-M14-4.1.2 |
| EL-M14-S13-095 | text | visible-default | "⭐ +35 XP" | FN-M14-4.1.2 |
| EL-M14-S13-096 | text | visible-default | "Progres: 0/20" | FN-M14-4.1.2 |
| EL-M14-S13-097 | text | visible-default | "0%" | FN-M14-4.1.2 |

#### S14 — `/gamification/leaderboard` (45 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M14-S14-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M14-S14-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M14-S14-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M14-S14-004 | heading | visible-default | "🏆 Papan Pendahulu" | FN-M14-5.1.1 |
| EL-M14-S14-005 | text | visible-default | "Siapa paling rajin belajar?" | FN-M14-5.1.1 |
| EL-M14-S14-006 | card | visible-default | "<masked>" | FN-M14-5.1.2 |
| EL-M14-S14-007 | text | visible-default | "🥇" | FN-M14-5.1.2 |
| EL-M14-S14-008 | image | visible-default | image | FN-M14-5.1.2 |
| EL-M14-S14-009 | text | visible-default | "<masked>" | FN-M14-5.1.2 |
| EL-M14-S14-010 | text | visible-default | "1,018,083 syiling" | FN-M14-5.1.2 |
| EL-M14-S14-011 | text | visible-default | "💎 Platinum" | FN-M14-5.1.2 |
| EL-M14-S14-012 | card | visible-default | "<masked>" | FN-M14-5.1.2 |
| EL-M14-S14-013 | text | visible-default | "🥈" | FN-M14-5.1.2 |
| EL-M14-S14-014 | image | visible-default | image | FN-M14-5.1.2 |
| EL-M14-S14-015 | text | visible-default | "<masked>" | FN-M14-5.1.2 |
| EL-M14-S14-016 | text | visible-default | "686,730 syiling" | FN-M14-5.1.2 |
| EL-M14-S14-017 | text | visible-default | "💎 Platinum" | FN-M14-5.1.2 |
| EL-M14-S14-018 | card | visible-default | "<masked>" | FN-M14-5.1.2 |
| EL-M14-S14-019 | text | visible-default | "🥉" | FN-M14-5.1.2 |
| EL-M14-S14-020 | image | visible-default | image | FN-M14-5.1.2 |
| EL-M14-S14-021 | text | visible-default | "<masked>" | FN-M14-5.1.2 |
| EL-M14-S14-022 | text | visible-default | "135,760 syiling" | FN-M14-5.1.2 |
| EL-M14-S14-023 | text | visible-default | "💎 Platinum" | FN-M14-5.1.2 |
| EL-M14-S14-024 | card | visible-default | "<masked>" | FN-M14-5.1.3 |
| EL-M14-S14-025 | text | visible-default | "#4" | FN-M14-5.1.3 |
| EL-M14-S14-026 | image | visible-default | image | FN-M14-5.1.3 |
| EL-M14-S14-027 | text | visible-default | "<masked>" | FN-M14-5.1.3 |
| EL-M14-S14-028 | text | visible-default | "Mitos · Level 39" | FN-M14-5.1.3 |
| EL-M14-S14-029 | text | visible-default | "65,127" | FN-M14-5.1.3 |
| EL-M14-S14-030 | text | visible-default | "syiling" | FN-M14-5.1.3 |
| EL-M14-S14-031 | text | visible-default | "💎" | FN-M14-5.1.3 |
| EL-M14-S14-032 | text | visible-default | "#5" | FN-M14-5.1.3 |
| EL-M14-S14-033 | image | visible-default | image | FN-M14-5.1.3 |
| EL-M14-S14-034 | text | visible-default | "<masked>" | FN-M14-5.1.3 |
| EL-M14-S14-035 | text | visible-default | "Mitos · Level 37" | FN-M14-5.1.3 |
| EL-M14-S14-036 | text | visible-default | "60,305" | FN-M14-5.1.3 |
| EL-M14-S14-037 | text | visible-default | "syiling" | FN-M14-5.1.3 |
| EL-M14-S14-038 | text | visible-default | "💎" | FN-M14-5.1.3 |
| EL-M14-S14-039 | text | visible-default | "#6" | FN-M14-5.1.3 |
| EL-M14-S14-040 | image | visible-default | image | FN-M14-5.1.3 |
| EL-M14-S14-041 | text | visible-default | "<masked>" | FN-M14-5.1.3 |
| EL-M14-S14-042 | text | visible-default | "Mitos · Level 36" | FN-M14-5.1.3 |
| EL-M14-S14-043 | text | visible-default | "57,783" | FN-M14-5.1.3 |
| EL-M14-S14-044 | text | visible-default | "syiling" | FN-M14-5.1.3 |
| EL-M14-S14-045 | text | visible-default | "💎" | FN-M14-5.1.3 |

#### S15 — `/gamification/achievements` (150 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M14-S15-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M14-S15-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M14-S15-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M14-S15-004 | heading | visible-default | "🏅 Pencapaian Anda" | FN-M14-6.1.1 |
| EL-M14-S15-005 | text | visible-default | "Kumpul lencana dan capai pencapaian — 0/25 dicapai" | FN-M14-6.1.1 |
| EL-M14-S15-006 | text | visible-default | "🔥" | FN-M14-6.1.2 |
| EL-M14-S15-007 | text | visible-default | "0" | FN-M14-6.1.2 |
| EL-M14-S15-008 | text | visible-default | "Hari berturut-turut" | FN-M14-6.1.2 |
| EL-M14-S15-009 | badge | visible-default | "1.0x Bonus" | FN-M14-6.1.2 |
| EL-M14-S15-010 | text | visible-default | "Terbaik: 0 hari" | FN-M14-6.1.2 |
| EL-M14-S15-011 | link | visible-default | "Semua", → /gamification/achievements | FN-M14-6.1.3 |
| EL-M14-S15-012 | link | visible-default | "Biasa", → /gamification/achievements?rarity=common | FN-M14-6.1.3 |
| EL-M14-S15-013 | link | visible-default | "Jarang", → /gamification/achievements?rarity=rare | FN-M14-6.1.3 |
| EL-M14-S15-014 | link | visible-default | "Epik", → /gamification/achievements?rarity=epic | FN-M14-6.1.3 |
| EL-M14-S15-015 | link | visible-default | "Legenda", → /gamification/achievements?rarity=legendary | FN-M14-6.1.3 |
| EL-M14-S15-016 | badge | visible-default | "👣" | FN-M14-6.1.4 |
| EL-M14-S15-017 | badge | visible-default | "Langkah Pertama" | FN-M14-6.1.4 |
| EL-M14-S15-018 | badge | visible-default | "Jawab kuiz pertama anda" | FN-M14-6.1.4 |
| EL-M14-S15-019 | text | visible-default | "Biasa" | FN-M14-6.1.4 |
| EL-M14-S15-020 | badge | visible-default | "🪙 5 · ⭐ 3 XP" | FN-M14-6.1.4 |
| EL-M14-S15-021 | text | visible-default | "0/1" | FN-M14-6.1.4 |
| EL-M14-S15-022 | badge | visible-default | "📚" | FN-M14-6.1.4 |
| EL-M14-S15-023 | badge | visible-default | "Pelajar Rajin" | FN-M14-6.1.4 |
| EL-M14-S15-024 | badge | visible-default | "Jawab 10 kuiz" | FN-M14-6.1.4 |
| EL-M14-S15-025 | text | visible-default | "Biasa" | FN-M14-6.1.4 |
| EL-M14-S15-026 | badge | visible-default | "🪙 15 · ⭐ 10 XP" | FN-M14-6.1.4 |
| EL-M14-S15-027 | text | visible-default | "0/10" | FN-M14-6.1.4 |
| EL-M14-S15-028 | badge | visible-default | "🔥" | FN-M14-6.1.4 |
| EL-M14-S15-029 | badge | visible-default | "Streak 3 Hari" | FN-M14-6.1.4 |
| EL-M14-S15-030 | badge | visible-default | "Login 3 hari berturut-turut" | FN-M14-6.1.4 |
| EL-M14-S15-031 | text | visible-default | "Biasa" | FN-M14-6.1.4 |
| EL-M14-S15-032 | badge | visible-default | "🪙 10 · ⭐ 5 XP" | FN-M14-6.1.4 |
| EL-M14-S15-033 | badge | visible-default | "🎓" | FN-M14-6.1.4 |
| EL-M14-S15-034 | badge | visible-default | "Cendiakawan" | FN-M14-6.1.4 |
| EL-M14-S15-035 | badge | visible-default | "Jawab 50 kuiz" | FN-M14-6.1.4 |
| EL-M14-S15-036 | text | visible-default | "Jarang" | FN-M14-6.1.4 |
| EL-M14-S15-037 | badge | visible-default | "🪙 50 · ⭐ 30 XP" | FN-M14-6.1.4 |
| EL-M14-S15-038 | text | visible-default | "0/50" | FN-M14-6.1.4 |
| EL-M14-S15-039 | badge | visible-default | "💰" | FN-M14-6.1.4 |
| EL-M14-S15-040 | badge | visible-default | "Pengumpul Syiling" | FN-M14-6.1.4 |
| EL-M14-S15-041 | badge | visible-default | "Kumpul 100 syiling pertama anda" | FN-M14-6.1.4 |
| EL-M14-S15-042 | text | visible-default | "Biasa" | FN-M14-6.1.4 |
| EL-M14-S15-043 | badge | visible-default | "🪙 10 · ⭐ 5 XP" | FN-M14-6.1.4 |
| EL-M14-S15-044 | badge | visible-default | "🎯" | FN-M14-6.1.4 |
| EL-M14-S15-045 | badge | visible-default | "Tepat Sasaran" | FN-M14-6.1.4 |
| EL-M14-S15-046 | badge | visible-default | "Capai 90% ketepatan dalam 10 kuiz" | FN-M14-6.1.4 |
| EL-M14-S15-047 | text | visible-default | "Jarang" | FN-M14-6.1.4 |
| EL-M14-S15-048 | badge | visible-default | "🪙 40 · ⭐ 25 XP" | FN-M14-6.1.4 |
| EL-M14-S15-049 | badge | visible-default | "🧭" | FN-M14-6.1.4 |
| EL-M14-S15-050 | badge | visible-default | "Penjelajah" | FN-M14-6.1.4 |
| EL-M14-S15-051 | badge | visible-default | "Cuba latihan dari 5 subjek berbeza" | FN-M14-6.1.4 |
| EL-M14-S15-052 | text | visible-default | "Biasa" | FN-M14-6.1.4 |
| EL-M14-S15-053 | badge | visible-default | "🪙 15 · ⭐ 10 XP" | FN-M14-6.1.4 |
| EL-M14-S15-054 | badge | visible-default | "💪" | FN-M14-6.1.4 |
| EL-M14-S15-055 | badge | visible-default | "Streak 7 Hari" | FN-M14-6.1.4 |
| EL-M14-S15-056 | badge | visible-default | "Login 7 hari berturut-turut" | FN-M14-6.1.4 |
| EL-M14-S15-057 | text | visible-default | "Jarang" | FN-M14-6.1.4 |
| EL-M14-S15-058 | badge | visible-default | "🪙 30 · ⭐ 15 XP" | FN-M14-6.1.4 |
| EL-M14-S15-059 | badge | visible-default | "🌅" | FN-M14-6.1.4 |
| EL-M14-S15-060 | badge | visible-default | "Pelajar Awal" | FN-M14-6.1.4 |
| EL-M14-S15-061 | badge | visible-default | "Log masuk 7 hari berturut-turut" | FN-M14-6.1.4 |
| EL-M14-S15-062 | text | visible-default | "Biasa" | FN-M14-6.1.4 |
| EL-M14-S15-063 | badge | visible-default | "🪙 20 · ⭐ 10 XP" | FN-M14-6.1.4 |
| EL-M14-S15-064 | badge | visible-default | "🧠" | FN-M14-6.1.4 |
| EL-M14-S15-065 | badge | visible-default | "Pakar Matematik" | FN-M14-6.1.4 |
| EL-M14-S15-066 | badge | visible-default | "Jawab 200 kuiz" | FN-M14-6.1.4 |
| EL-M14-S15-067 | text | visible-default | "Epik" | FN-M14-6.1.4 |
| EL-M14-S15-068 | badge | visible-default | "🪙 150 · ⭐ 75 XP" | FN-M14-6.1.4 |
| EL-M14-S15-069 | text | visible-default | "0/200" | FN-M14-6.1.4 |
| EL-M14-S15-070 | badge | visible-default | "⚡" | FN-M14-6.1.4 |
| EL-M14-S15-071 | badge | visible-default | "Streak 30 Hari" | FN-M14-6.1.4 |
| EL-M14-S15-072 | badge | visible-default | "Login 30 hari berturut-turut" | FN-M14-6.1.4 |
| EL-M14-S15-073 | text | visible-default | "Epik" | FN-M14-6.1.4 |
| EL-M14-S15-074 | badge | visible-default | "🪙 100 · ⭐ 50 XP" | FN-M14-6.1.4 |
| EL-M14-S15-075 | badge | visible-default | "👑" | FN-M14-6.1.4 |
| EL-M14-S15-076 | badge | visible-default | "Legenda JomBelajar" | FN-M14-6.1.4 |
| EL-M14-S15-077 | badge | visible-default | "Jawab 500 kuiz" | FN-M14-6.1.4 |
| EL-M14-S15-078 | text | visible-default | "Legenda" | FN-M14-6.1.4 |
| EL-M14-S15-079 | badge | visible-default | "🪙 500 · ⭐ 200 XP" | FN-M14-6.1.4 |
| EL-M14-S15-080 | text | visible-default | "0/500" | FN-M14-6.1.4 |
| EL-M14-S15-081 | badge | visible-default | "🎁" | FN-M14-6.1.4 |
| EL-M14-S15-082 | badge | visible-default | "Ahli Kotak Misteri" | FN-M14-6.1.4 |
| EL-M14-S15-083 | badge | visible-default | "Buka 10 kotak misteri" | FN-M14-6.1.4 |
| EL-M14-S15-084 | text | visible-default | "Jarang" | FN-M14-6.1.4 |
| EL-M14-S15-085 | badge | visible-default | "🪙 30 · ⭐ 20 XP" | FN-M14-6.1.4 |
| EL-M14-S15-086 | badge | visible-default | "🏆" | FN-M14-6.1.4 |
| EL-M14-S15-087 | badge | visible-default | "Streak 100 Hari" | FN-M14-6.1.4 |
| EL-M14-S15-088 | badge | visible-default | "Login 100 hari berturut-turut" | FN-M14-6.1.4 |
| EL-M14-S15-089 | text | visible-default | "Legenda" | FN-M14-6.1.4 |
| EL-M14-S15-090 | badge | visible-default | "🪙 300 · ⭐ 150 XP" | FN-M14-6.1.4 |
| EL-M14-S15-091 | badge | visible-default | "🎯" | FN-M14-6.1.4 |
| EL-M14-S15-092 | badge | visible-default | "Cabaran Selesai" | FN-M14-6.1.4 |
| EL-M14-S15-093 | badge | visible-default | "Selesaikan 20 cabaran harian" | FN-M14-6.1.4 |
| EL-M14-S15-094 | text | visible-default | "Jarang" | FN-M14-6.1.4 |
| EL-M14-S15-095 | badge | visible-default | "🪙 35 · ⭐ 25 XP" | FN-M14-6.1.4 |
| EL-M14-S15-096 | badge | visible-default | "🔢" | FN-M14-6.1.4 |
| EL-M14-S15-097 | badge | visible-default | "Tokoh Matematik" | FN-M14-6.1.4 |
| EL-M14-S15-098 | badge | visible-default | "Jawab 100 soalan Matematik dengan betul" | FN-M14-6.1.4 |
| EL-M14-S15-099 | text | visible-default | "Jarang" | FN-M14-6.1.4 |
| EL-M14-S15-100 | badge | visible-default | "🪙 40 · ⭐ 30 XP" | FN-M14-6.1.4 |
| EL-M14-S15-101 | badge | visible-default | "⚡" | FN-M14-6.1.4 |
| EL-M14-S15-102 | badge | visible-default | "Si Pantas" | FN-M14-6.1.4 |
| EL-M14-S15-103 | text | visible-default | "Jawab 50 soalan dalam masa kurang 10 saat setiap satu" | FN-M14-6.1.4 |
| EL-M14-S15-104 | text | visible-default | "Jarang" | FN-M14-6.1.4 |
| EL-M14-S15-105 | badge | visible-default | "🪙 35 · ⭐ 25 XP" | FN-M14-6.1.4 |
| EL-M14-S15-106 | badge | visible-default | "🤝" | FN-M14-6.1.4 |
| EL-M14-S15-107 | badge | visible-default | "Sahabat Belajar" | FN-M14-6.1.4 |
| EL-M14-S15-108 | badge | visible-default | "Jemput 3 rakan menggunakan kod rujukan" | FN-M14-6.1.4 |
| EL-M14-S15-109 | text | visible-default | "Jarang" | FN-M14-6.1.4 |
| EL-M14-S15-110 | badge | visible-default | "🪙 50 · ⭐ 30 XP" | FN-M14-6.1.4 |
| EL-M14-S15-111 | badge | visible-default | "🏦" | FN-M14-6.1.4 |
| EL-M14-S15-112 | badge | visible-default | "Hartawan Syiling" | FN-M14-6.1.4 |
| EL-M14-S15-113 | badge | visible-default | "Kumpul 1,000 syiling sepanjang masa" | FN-M14-6.1.4 |
| EL-M14-S15-114 | text | visible-default | "Epik" | FN-M14-6.1.4 |
| EL-M14-S15-115 | badge | visible-default | "🪙 100 · ⭐ 75 XP" | FN-M14-6.1.4 |
| EL-M14-S15-116 | badge | visible-default | "🏆" | FN-M14-6.1.4 |
| EL-M14-S15-117 | badge | visible-default | "Penakluk Cabaran" | FN-M14-6.1.4 |
| EL-M14-S15-118 | badge | visible-default | "Selesaikan 100 cabaran harian" | FN-M14-6.1.4 |
| EL-M14-S15-119 | text | visible-default | "Epik" | FN-M14-6.1.4 |
| EL-M14-S15-120 | badge | visible-default | "🪙 80 · ⭐ 60 XP" | FN-M14-6.1.4 |
| EL-M14-S15-121 | badge | visible-default | "🔬" | FN-M14-6.1.4 |
| EL-M14-S15-122 | badge | visible-default | "Pakar Sains" | FN-M14-6.1.4 |
| EL-M14-S15-123 | badge | visible-default | "Jawab 200 soalan Sains dengan betul" | FN-M14-6.1.4 |
| EL-M14-S15-124 | text | visible-default | "Epik" | FN-M14-6.1.4 |
| EL-M14-S15-125 | badge | visible-default | "🪙 80 · ⭐ 60 XP" | FN-M14-6.1.4 |
| EL-M14-S15-126 | badge | visible-default | "🎖️" | FN-M14-6.1.4 |
| EL-M14-S15-127 | badge | visible-default | "Pengumpul Lencana" | FN-M14-6.1.4 |
| EL-M14-S15-128 | badge | visible-default | "Kumpul 15 lencana pencapaian" | FN-M14-6.1.4 |
| EL-M14-S15-129 | text | visible-default | "Epik" | FN-M14-6.1.4 |
| EL-M14-S15-130 | badge | visible-default | "🪙 75 · ⭐ 50 XP" | FN-M14-6.1.4 |
| EL-M14-S15-131 | badge | visible-default | "👑" | FN-M14-6.1.4 |
| EL-M14-S15-132 | badge | visible-default | "Raja Syiling" | FN-M14-6.1.4 |
| EL-M14-S15-133 | badge | visible-default | "Kumpul 5,000 syiling sepanjang masa" | FN-M14-6.1.4 |
| EL-M14-S15-134 | text | visible-default | "Legenda" | FN-M14-6.1.4 |
| EL-M14-S15-135 | badge | visible-default | "🪙 500 · ⭐ 250 XP" | FN-M14-6.1.4 |
| EL-M14-S15-136 | badge | visible-default | "🧠" | FN-M14-6.1.4 |
| EL-M14-S15-137 | badge | visible-default | "Ilmuwan Sejati" | FN-M14-6.1.4 |
| EL-M14-S15-138 | badge | visible-default | "Jawab 1,000 soalan dengan ketepatan 85%+" | FN-M14-6.1.4 |
| EL-M14-S15-139 | text | visible-default | "Legenda" | FN-M14-6.1.4 |
| EL-M14-S15-140 | badge | visible-default | "🪙 300 · ⭐ 200 XP" | FN-M14-6.1.4 |
| EL-M14-S15-141 | badge | visible-default | "🦸" | FN-M14-6.1.4 |
| EL-M14-S15-142 | badge | visible-default | "Wira JomBelajar" | FN-M14-6.1.4 |
| EL-M14-S15-143 | text | visible-default | "Lengkapkan semua cabaran dalam 30 hari berturut" | FN-M14-6.1.4 |
| EL-M14-S15-144 | text | visible-default | "Legenda" | FN-M14-6.1.4 |
| EL-M14-S15-145 | badge | visible-default | "🪙 400 · ⭐ 300 XP" | FN-M14-6.1.4 |
| EL-M14-S15-146 | clickable | hidden-only | "<name> 🎓 PRESTASIPLUS 🪙 Syiling ⭐ XP Muat Turun WhatsApp Tutup", fa-download | FN-M14-6.1.5 |
| EL-M14-S15-147 | button | conditional | "Muat Turun", type=submit, fa-download | FN-M14-6.1.6 |
| EL-M14-S15-148 | button | conditional | "WhatsApp", type=submit, fa-whatsapp | FN-M14-6.1.7 |
| EL-M14-S15-149 | button | conditional | "Tutup", type=submit | FN-M14-6.1.8 |
| EL-M14-S15-150 | clickable | conditional | "👣 Langkah Pertama Jawab kuiz pertama anda Biasa <name> 🎓 PRESTASIPLUS 5 🪙 Syi …", fa-download | FN-M14-6.1.5 |

#### S16 — `/gamification/referral` (26 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M14-S16-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M14-S16-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M14-S16-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M14-S16-004 | heading | visible-default | "🤝 Rujuk Kawan, Dapat Syiling!" | FN-M14-7.1.1 |
| EL-M14-S16-005 | text | visible-default | "Jemput kawan anda ke PRESTASIPLUS — dua-dua dapat ganjaran!" | FN-M14-7.1.1 |
| EL-M14-S16-006 | text | visible-default | "🎁" | FN-M14-7.1.1 |
| EL-M14-S16-007 | text | visible-default | "50" | FN-M14-7.1.1 |
| EL-M14-S16-008 | text | visible-default | "Syiling untuk ANDA" | FN-M14-7.1.1 |
| EL-M14-S16-009 | text | visible-default | "👋" | FN-M14-7.1.1 |
| EL-M14-S16-010 | text | visible-default | "25" | FN-M14-7.1.1 |
| EL-M14-S16-011 | text | visible-default | "Syiling untuk KAWAN" | FN-M14-7.1.1 |
| EL-M14-S16-012 | text | visible-default | "Kod Rujukan Anda" | FN-M14-7.1.2 |
| EL-M14-S16-013 | text | visible-default | "4JURJTT" | FN-M14-7.1.2 |
| EL-M14-S16-014 | button | visible-default | "Salin Kod", type=submit, fa-copy | FN-M14-7.1.2 |
| EL-M14-S16-015 | link | visible-default | "WhatsApp", → https://wa.me/?text=Jom%20belajar%20matematik%20di%20PRESTASIPLUS!%20G, fa-whatsapp | FN-M14-7.1.3 |
| EL-M14-S16-016 | link | visible-default | "Telegram", → https://t.me/share/url?url=/register?ref=4JURJTT&text=Jom%20belajar%20, fa-telegram | FN-M14-7.1.3 |
| EL-M14-S16-017 | button | visible-default | "Salin Link", type=submit, fa-link | FN-M14-7.1.4 |
| EL-M14-S16-018 | card | visible-default | "📊 Statistik Rujukan" | FN-M14-7.1.5 |
| EL-M14-S16-019 | heading | visible-default | "📊 Statistik Rujukan" | FN-M14-7.1.5 |
| EL-M14-S16-020 | text | visible-default | "0" | FN-M14-7.1.5 |
| EL-M14-S16-021 | text | visible-default | "Rujukan" | FN-M14-7.1.5 |
| EL-M14-S16-022 | text | visible-default | "0" | FN-M14-7.1.5 |
| EL-M14-S16-023 | text | visible-default | "Ganjaran Dicapai" | FN-M14-7.1.5 |
| EL-M14-S16-024 | text | visible-default | "0" | FN-M14-7.1.5 |
| EL-M14-S16-025 | text | visible-default | "Syiling Diperolehi" | FN-M14-7.1.5 |
| EL-M14-S16-026 | button | conditional | "✓ Disalin!", type=submit | FN-M14-7.1.2 |

#### S17 — `/gamification/history` (32 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M14-S17-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M14-S17-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M14-S17-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M14-S17-004 | heading | visible-default | "📋 Sejarah Transaksi" | FN-M14-2.2.1 |
| EL-M14-S17-005 | text | visible-default | "Baki semasa: syiling" | FN-M14-2.2.1 |
| EL-M14-S17-006 | text | visible-default | "256" | FN-M14-2.2.1 |
| EL-M14-S17-007 | link | visible-default | "← Dashboard", → /gamification | FN-M14-2.2.1 |
| EL-M14-S17-008 | link | visible-default | "Semua", → /gamification/history | FN-M14-2.2.2 |
| EL-M14-S17-009 | filter | visible-default | "💰 Dapat", → /gamification/history?type=earn | FN-M14-2.2.2 |
| EL-M14-S17-010 | filter | visible-default | "🛍️ Belanja", → /gamification/history?type=spend | FN-M14-2.2.2 |
| EL-M14-S17-011 | filter | visible-default | "🔄 Tukar", → /gamification/history?type=convert | FN-M14-2.2.2 |
| EL-M14-S17-012 | filter | visible-default | "🎁 Bonus", → /gamification/history?type=bonus | FN-M14-2.2.2 |
| EL-M14-S17-013 | card | visible-default | "Cabaran selesai: Penjelajah Topik" | FN-M14-2.2.3 |
| EL-M14-S17-014 | text | visible-default | "💰" | FN-M14-2.2.3 |
| EL-M14-S17-015 | text | visible-default | "Cabaran selesai: Penjelajah Topik" | FN-M14-2.2.3 |
| EL-M14-S17-016 | text | visible-default | "19/05/2026 03:26 · 4 bulan yang lepas" | FN-M14-2.2.3 |
| EL-M14-S17-017 | text | visible-default | "+25" | FN-M14-2.2.3 |
| EL-M14-S17-018 | text | visible-default | "Baki: 256" | FN-M14-2.2.3 |
| EL-M14-S17-019 | text | visible-default | "💰" | FN-M14-2.2.3 |
| EL-M14-S17-020 | text | visible-default | "Streak activity (spm)" | FN-M14-2.2.3 |
| EL-M14-S17-021 | text | visible-default | "19/05/2026 03:26 · 4 bulan yang lepas" | FN-M14-2.2.3 |
| EL-M14-S17-022 | text | visible-default | "+7" | FN-M14-2.2.3 |
| EL-M14-S17-023 | text | visible-default | "Baki: 231" | FN-M14-2.2.3 |
| EL-M14-S17-024 | text | visible-default | "💰" | FN-M14-2.2.3 |
| EL-M14-S17-025 | text | visible-default | "SPM Tahun Lepas: 1 betul — 20%" | FN-M14-2.2.3 |
| EL-M14-S17-026 | text | visible-default | "19/05/2026 03:26 · 4 bulan yang lepas" | FN-M14-2.2.3 |
| EL-M14-S17-027 | text | visible-default | "+3" | FN-M14-2.2.3 |
| EL-M14-S17-028 | text | visible-default | "Baki: 224" | FN-M14-2.2.3 |
| EL-M14-S17-029 | card | conditional | "Belum ada transaksi" | FN-M14-2.2.4 |
| EL-M14-S17-030 | text | conditional | "📋" | FN-M14-2.2.4 |
| EL-M14-S17-031 | text | conditional | "Belum ada transaksi" | FN-M14-2.2.4 |
| EL-M14-S17-032 | text | conditional | "Mula latih tubi untuk dapatkan syiling!" | FN-M14-2.2.4 |

#### S18 — `/gamification/kad-kongsi` (73 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M14-S18-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M14-S18-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M14-S18-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M14-S18-004 | tab | visible-default | "Profil", type=submit, fa-id-card | FN-M14-6.2.1 |
| EL-M14-S18-005 | tab | visible-default | "Kombo", type=submit, fa-fire | FN-M14-6.2.1 |
| EL-M14-S18-006 | tab | visible-default | "Penguasaan", type=submit, fa-brain | FN-M14-6.2.1 |
| EL-M14-S18-007 | tab | visible-default | "Kedudukan", type=submit, fa-trophy | FN-M14-6.2.1 |
| EL-M14-S18-008 | card | visible-default | "Kad Profil Pelajar" | FN-M14-6.2.2 |
| EL-M14-S18-009 | heading | visible-default | "Kad Profil Pelajar" | FN-M14-6.2.2 |
| EL-M14-S18-010 | text | visible-default | "A" | FN-M14-6.2.2 |
| EL-M14-S18-011 | text | visible-default | "<name>" | FN-M14-6.2.2 |
| EL-M14-S18-012 | text | visible-default | "PRESTASIPLUS" | FN-M14-6.2.2 |
| EL-M14-S18-013 | text | visible-default | "119" | FN-M14-6.2.2 |
| EL-M14-S18-014 | text | visible-default | "Soalan" | FN-M14-6.2.2 |
| EL-M14-S18-015 | text | visible-default | "38.7%" | FN-M14-6.2.2 |
| EL-M14-S18-016 | text | visible-default | "Ketepatan" | FN-M14-6.2.2 |
| EL-M14-S18-017 | text | visible-default | "4" | FN-M14-6.2.2 |
| EL-M14-S18-018 | text | visible-default | "Sesi" | FN-M14-6.2.2 |
| EL-M14-S18-019 | text | visible-default | "🥉 Bronze" | FN-M14-6.2.2 |
| EL-M14-S18-020 | text | visible-default | "Lvl 2" | FN-M14-6.2.2 |
| EL-M14-S18-021 | text | visible-default | "🪙 256" | FN-M14-6.2.2 |
| EL-M14-S18-022 | text | visible-default | "🎓 PRESTASIPLUS.MY" | FN-M14-6.2.2 |
| EL-M14-S18-023 | button | visible-default | "Muat Turun", type=submit, fa-download | FN-M14-6.2.6 |
| EL-M14-S18-024 | button | visible-default | "WhatsApp", type=submit, fa-whatsapp | FN-M14-6.2.7 |
| EL-M14-S18-025 | card | conditional | "Kad Kombo" | FN-M14-6.2.3 |
| EL-M14-S18-026 | heading | conditional | "Kad Kombo" | FN-M14-6.2.3 |
| EL-M14-S18-027 | text | conditional | "🔥" | FN-M14-6.2.3 |
| EL-M14-S18-028 | text | conditional | "0" | FN-M14-6.2.3 |
| EL-M14-S18-029 | text | conditional | "Hari Berturut-turut!" | FN-M14-6.2.3 |
| EL-M14-S18-030 | text | conditional | "0" | FN-M14-6.2.3 |
| EL-M14-S18-031 | text | conditional | "Rekod Terbaik" | FN-M14-6.2.3 |
| EL-M14-S18-032 | text | conditional | "1.0x" | FN-M14-6.2.3 |
| EL-M14-S18-033 | text | conditional | "Pengganda" | FN-M14-6.2.3 |
| EL-M14-S18-034 | text | conditional | "<name>" | FN-M14-6.2.3 |
| EL-M14-S18-035 | text | conditional | "🎓 PRESTASIPLUS.MY" | FN-M14-6.2.3 |
| EL-M14-S18-036 | button | conditional | "Muat Turun", type=submit, fa-download | FN-M14-6.2.6 |
| EL-M14-S18-037 | button | conditional | "WhatsApp", type=submit, fa-whatsapp | FN-M14-6.2.7 |
| EL-M14-S18-038 | card | conditional | "Kad Penguasaan Subjek" | FN-M14-6.2.4 |
| EL-M14-S18-039 | heading | conditional | "Kad Penguasaan Subjek" | FN-M14-6.2.4 |
| EL-M14-S18-040 | card | conditional | "Muat Turun" | FN-M14-6.2.4 |
| EL-M14-S18-041 | text | conditional | "Penguasaan Subjek" | FN-M14-6.2.4 |
| EL-M14-S18-042 | text | conditional | "Bahasa Melayu" | FN-M14-6.2.4 |
| EL-M14-S18-043 | text | conditional | "Lvl 2 — Aktif" | FN-M14-6.2.4 |
| EL-M14-S18-044 | text | conditional | "48.9%" | FN-M14-6.2.4 |
| EL-M14-S18-045 | text | conditional | "Ketepatan" | FN-M14-6.2.4 |
| EL-M14-S18-046 | text | conditional | "46" | FN-M14-6.2.4 |
| EL-M14-S18-047 | text | conditional | "Betul" | FN-M14-6.2.4 |
| EL-M14-S18-048 | text | conditional | "<name>" | FN-M14-6.2.4 |
| EL-M14-S18-049 | text | conditional | "🎓 PRESTASIPLUS.MY" | FN-M14-6.2.4 |
| EL-M14-S18-050 | button | conditional | "Muat Turun", type=submit, fa-download | FN-M14-6.2.6 |
| EL-M14-S18-051 | button | conditional | "Kongsi", type=submit, fa-whatsapp | FN-M14-6.2.7 |
| EL-M14-S18-052 | text | conditional | "Penguasaan Subjek" | FN-M14-6.2.4 |
| EL-M14-S18-053 | text | conditional | "Sejarah" | FN-M14-6.2.4 |
| EL-M14-S18-054 | text | conditional | "Lvl 1 — Mula Belajar" | FN-M14-6.2.4 |
| EL-M14-S18-055 | text | conditional | "35%" | FN-M14-6.2.4 |
| EL-M14-S18-056 | text | conditional | "Ketepatan" | FN-M14-6.2.4 |
| EL-M14-S18-057 | text | conditional | "14" | FN-M14-6.2.4 |
| EL-M14-S18-058 | text | conditional | "Betul" | FN-M14-6.2.4 |
| EL-M14-S18-059 | text | conditional | "<name>" | FN-M14-6.2.4 |
| EL-M14-S18-060 | text | conditional | "🎓 PRESTASIPLUS.MY" | FN-M14-6.2.4 |
| EL-M14-S18-061 | button | conditional | "Muat Turun", type=submit, fa-download | FN-M14-6.2.6 |
| EL-M14-S18-062 | button | conditional | "Kongsi", type=submit, fa-whatsapp | FN-M14-6.2.7 |
| EL-M14-S18-063 | card | conditional | "Kad Kedudukan" | FN-M14-6.2.5 |
| EL-M14-S18-064 | heading | conditional | "Kad Kedudukan" | FN-M14-6.2.5 |
| EL-M14-S18-065 | card | conditional | "38.7%" | FN-M14-6.2.5 |
| EL-M14-S18-066 | text | conditional | "🏆" | FN-M14-6.2.5 |
| EL-M14-S18-067 | text | conditional | "Kedudukan Terkini" | FN-M14-6.2.5 |
| EL-M14-S18-068 | text | conditional | "Ketepatan · 46/119 betul" | FN-M14-6.2.5 |
| EL-M14-S18-069 | text | conditional | "38.7%" | FN-M14-6.2.5 |
| EL-M14-S18-070 | text | conditional | "<name>" | FN-M14-6.2.5 |
| EL-M14-S18-071 | text | conditional | "🎓 PRESTASIPLUS.MY" | FN-M14-6.2.5 |
| EL-M14-S18-072 | button | conditional | "Muat Turun", type=submit, fa-download | FN-M14-6.2.6 |
| EL-M14-S18-073 | button | conditional | "WhatsApp", type=submit, fa-whatsapp | FN-M14-6.2.7 |

#### S19 — `/guru/gamifikasi` (63 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M14-S19-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M14-S19-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M14-S19-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M14-S19-004 | card | visible-default | "92,683" | FN-M14-10.1.1 |
| EL-M14-S19-005 | text | visible-default | "92,683" | FN-M14-10.1.1 |
| EL-M14-S19-006 | text | visible-default | "Baki Syiling" | FN-M14-10.1.1 |
| EL-M14-S19-007 | card | visible-default | "92,683" | FN-M14-10.1.1 |
| EL-M14-S19-008 | text | visible-default | "92,683" | FN-M14-10.1.1 |
| EL-M14-S19-009 | text | visible-default | "Jumlah Diperolehi" | FN-M14-10.1.1 |
| EL-M14-S19-010 | card | visible-default | "20,719" | FN-M14-10.1.1 |
| EL-M14-S19-011 | text | visible-default | "20,719" | FN-M14-10.1.1 |
| EL-M14-S19-012 | text | visible-default | "Soalan Disumbang" | FN-M14-10.1.1 |
| EL-M14-S19-013 | card | visible-default | "7/8" | FN-M14-10.1.1 |
| EL-M14-S19-014 | text | visible-default | "7/8" | FN-M14-10.1.1 |
| EL-M14-S19-015 | text | visible-default | "Lencana" | FN-M14-10.1.1 |
| EL-M14-S19-016 | card | visible-default | "Lencana Pencapaian" | FN-M14-10.1.2 |
| EL-M14-S19-017 | heading | visible-default | "Lencana Pencapaian" | FN-M14-10.1.2 |
| EL-M14-S19-018 | text | visible-default | "Penyumbang Baru" | FN-M14-10.1.2 |
| EL-M14-S19-019 | text | visible-default | "10 soalan" | FN-M14-10.1.2 |
| EL-M14-S19-020 | text | visible-default | "+100 syiling" | FN-M14-10.1.2 |
| EL-M14-S19-021 | text | visible-default | "Penyumbang Aktif" | FN-M14-10.1.2 |
| EL-M14-S19-022 | text | visible-default | "100 soalan" | FN-M14-10.1.2 |
| EL-M14-S19-023 | text | visible-default | "+500 syiling" | FN-M14-10.1.2 |
| EL-M14-S19-024 | text | visible-default | "Penyumbang Dedikasi" | FN-M14-10.1.2 |
| EL-M14-S19-025 | text | visible-default | "500 soalan" | FN-M14-10.1.2 |
| EL-M14-S19-026 | text | visible-default | "+2,000 syiling" | FN-M14-10.1.2 |
| EL-M14-S19-027 | text | visible-default | "Penyumbang Cemerlang" | FN-M14-10.1.2 |
| EL-M14-S19-028 | text | visible-default | "1,000 soalan" | FN-M14-10.1.2 |
| EL-M14-S19-029 | text | visible-default | "+5,000 syiling" | FN-M14-10.1.2 |
| EL-M14-S19-030 | text | visible-default | "Penyumbang Terbilang" | FN-M14-10.1.2 |
| EL-M14-S19-031 | text | visible-default | "2,500 soalan" | FN-M14-10.1.2 |
| EL-M14-S19-032 | text | visible-default | "+10,000 syiling" | FN-M14-10.1.2 |
| EL-M14-S19-033 | text | visible-default | "Legenda Soalan" | FN-M14-10.1.2 |
| EL-M14-S19-034 | text | visible-default | "5,000 soalan" | FN-M14-10.1.2 |
| EL-M14-S19-035 | text | visible-default | "+25,000 syiling" | FN-M14-10.1.2 |
| EL-M14-S19-036 | text | visible-default | "Guru Maestro" | FN-M14-10.1.2 |
| EL-M14-S19-037 | text | visible-default | "10,000 soalan" | FN-M14-10.1.2 |
| EL-M14-S19-038 | text | visible-default | "+50,000 syiling" | FN-M14-10.1.2 |
| EL-M14-S19-039 | text | visible-default | "Legenda Terulung" | FN-M14-10.1.2 |
| EL-M14-S19-040 | text | visible-default | "50,000 soalan" | FN-M14-10.1.2 |
| EL-M14-S19-041 | text | visible-default | "+250,000 syiling" | FN-M14-10.1.2 |
| EL-M14-S19-042 | text | visible-default | "Seterusnya: Legenda Terulung", fa-crown | FN-M14-10.1.3 |
| EL-M14-S19-043 | text | visible-default | "20,719 / 50,000" | FN-M14-10.1.3 |
| EL-M14-S19-044 | text | visible-default | "29,281 soalan lagi untuk bonus 250,000 syiling" | FN-M14-10.1.3 |
| EL-M14-S19-045 | card | visible-default | "Katalog Ganjaran" | FN-M14-10.1.4 |
| EL-M14-S19-046 | heading | visible-default | "Katalog Ganjaran" | FN-M14-10.1.4 |
| EL-M14-S19-047 | empty-state | visible-default | "Tiada ganjaran tersedia buat masa ini" | FN-M14-10.1.4 |
| EL-M14-S19-048 | text | visible-default | "Admin akan menambah ganjaran tidak lama lagi!" | FN-M14-10.1.4 |
| EL-M14-S19-049 | card | visible-default | "Sejarah Transaksi" | FN-M14-10.1.5 |
| EL-M14-S19-050 | heading | visible-default | "Sejarah Transaksi" | FN-M14-10.1.5 |
| EL-M14-S19-051 | text | visible-default | "SPM Tahun Lepas - 0% ketepatan" | FN-M14-10.1.5 |
| EL-M14-S19-052 | text | visible-default | "19 May 2026, 03:49" | FN-M14-10.1.5 |
| EL-M14-S19-053 | text | visible-default | "0" | FN-M14-10.1.5 |
| EL-M14-S19-054 | text | visible-default | "Aktiviti harian: spm" | FN-M14-10.1.5 |
| EL-M14-S19-055 | text | visible-default | "19 May 2026, 03:26" | FN-M14-10.1.5 |
| EL-M14-S19-056 | text | visible-default | "+7" | FN-M14-10.1.5 |
| EL-M14-S19-057 | text | visible-default | "SPM Tahun Lepas - 20% ketepatan" | FN-M14-10.1.5 |
| EL-M14-S19-058 | text | visible-default | "19 May 2026, 03:26" | FN-M14-10.1.5 |
| EL-M14-S19-059 | text | visible-default | "+1" | FN-M14-10.1.5 |
| EL-M14-S19-060 | link | visible-default | "Tebus Tunai", → /guru/gamifikasi/tebus-tunai, fa-money-bill-wave | FN-M14-10.1.6 |
| EL-M14-S19-061 | link | visible-default | "Kedai Hadiah", → /guru/gamifikasi/kedai, fa-gift | FN-M14-10.1.6 |
| EL-M14-S19-062 | link | visible-default | "Papan Pendahulu", → /guru/gamifikasi/leaderboard, fa-ranking-star | FN-M14-10.1.6 |
| EL-M14-S19-063 | link | visible-default | "Sumbang Soalan (+10 syiling)", → /guru/soalan/cipta, fa-plus | FN-M14-10.1.6 |

#### S20 — `/guru/gamifikasi/tebus-tunai` (47 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M14-S20-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M14-S20-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M14-S20-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M14-S20-004 | card | visible-default | "92,683" | FN-M14-10.2.1 |
| EL-M14-S20-005 | text | visible-default | "92,683" | FN-M14-10.2.1 |
| EL-M14-S20-006 | text | visible-default | "Jumlah Syiling" | FN-M14-10.2.1 |
| EL-M14-S20-007 | card | visible-default | "92,683" | FN-M14-10.2.1 |
| EL-M14-S20-008 | text | visible-default | "92,683" | FN-M14-10.2.1 |
| EL-M14-S20-009 | text | visible-default | "Boleh Ditebus" | FN-M14-10.2.1 |
| EL-M14-S20-010 | card | visible-default | "0" | FN-M14-10.2.1 |
| EL-M14-S20-011 | text | visible-default | "0" | FN-M14-10.2.1 |
| EL-M14-S20-012 | text | visible-default | "Dalam Proses" | FN-M14-10.2.1 |
| EL-M14-S20-013 | card | visible-default | "RM741.46" | FN-M14-10.2.1 |
| EL-M14-S20-014 | text | visible-default | "RM741.46" | FN-M14-10.2.1 |
| EL-M14-S20-015 | text | visible-default | "Nilai Tunai" | FN-M14-10.2.1 |
| EL-M14-S20-016 | card | visible-default | "Maklumat" | FN-M14-10.2.2 |
| EL-M14-S20-017 | text | visible-default | "Maklumat" | FN-M14-10.2.2 |
| EL-M14-S20-018 | text | visible-default | "Tukar syiling anda kepada wang tunai" | FN-M14-10.2.2 |
| EL-M14-S20-019 | text | visible-default | "Minimum tebus: 100 syiling" | FN-M14-10.2.2 |
| EL-M14-S20-020 | card | visible-default | "Borang Tebus Tunai" | FN-M14-10.2.3 |
| EL-M14-S20-021 | heading | visible-default | "Borang Tebus Tunai" | FN-M14-10.2.3 |
| EL-M14-S20-022 | form | visible-default | form | FN-M14-10.2.3 |
| EL-M14-S20-023 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M14-10.2.3 |
| EL-M14-S20-024 | label | visible-default | "Jumlah Syiling" | FN-M14-10.2.3 |
| EL-M14-S20-025 | input | visible-default | input, name=coins_amount, type=number | FN-M14-10.2.3 |
| EL-M14-S20-026 | text | visible-default | "Min: 100" | FN-M14-10.2.3 |
| EL-M14-S20-027 | text | visible-default | "Max: 92,683" | FN-M14-10.2.3 |
| EL-M14-S20-028 | button | visible-default | "100 syiling", type=button | FN-M14-10.2.4 |
| EL-M14-S20-029 | button | visible-default | "500 syiling", type=button | FN-M14-10.2.4 |
| EL-M14-S20-030 | button | visible-default | "1,000 syiling", type=button | FN-M14-10.2.4 |
| EL-M14-S20-031 | button | visible-default | "5,000 syiling", type=button | FN-M14-10.2.4 |
| EL-M14-S20-032 | button | visible-default | "Semua (92,683)", type=button | FN-M14-10.2.4 |
| EL-M14-S20-033 | text | conditional | "Anda akan menerima" | FN-M14-10.2.5 |
| EL-M14-S20-034 | text | hidden-only | "RM0.00" | FN-M14-10.2.5 |
| EL-M14-S20-035 | text | visible-default | "Maklumat Akaun Bank", fa-university | FN-M14-10.2.6 |
| EL-M14-S20-036 | label | visible-default | "Nama Bank" | FN-M14-10.2.6 |
| EL-M14-S20-037 | select | visible-default | select, name=bank_name | FN-M14-10.2.6 |
| EL-M14-S20-038 | label | visible-default | "No. Akaun Bank" | FN-M14-10.2.6 |
| EL-M14-S20-039 | input | visible-default | input, name=bank_account, type=text | FN-M14-10.2.6 |
| EL-M14-S20-040 | label | visible-default | "Nama Pemilik Akaun" | FN-M14-10.2.6 |
| EL-M14-S20-041 | input | visible-default | input, name=account_holder, type=text | FN-M14-10.2.6 |
| EL-M14-S20-042 | button | visible-default | "Hantar Permohonan Tebus Tunai", type=submit, fa-paper-plane | FN-M14-10.2.7 |
| EL-M14-S20-043 | card | visible-default | "Sejarah Tebus Tunai" | FN-M14-10.2.8 |
| EL-M14-S20-044 | heading | visible-default | "Sejarah Tebus Tunai" | FN-M14-10.2.8 |
| EL-M14-S20-045 | empty-state | visible-default | "Tiada rekod tebus tunai lagi" | FN-M14-10.2.8 |
| EL-M14-S20-046 | link | visible-default | "Kembali ke Dashboard", → /guru/gamifikasi, fa-arrow-left | FN-M14-10.2.9 |
| EL-M14-S20-047 | text | conditional | "RM4.00" | FN-M14-10.2.5 |

#### S21 — `/guru/gamifikasi/kedai` (12 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M14-S21-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M14-S21-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M14-S21-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M14-S21-004 | heading | visible-default | "🎁 Kedai Hadiah Guru" | FN-M14-10.3.1 |
| EL-M14-S21-005 | text | visible-default | "Tebus syiling anda untuk hadiah menarik!" | FN-M14-10.3.1 |
| EL-M14-S21-006 | text | visible-default | "92,683" | FN-M14-10.3.1 |
| EL-M14-S21-007 | text | visible-default | "Baki Syiling" | FN-M14-10.3.1 |
| EL-M14-S21-008 | link | visible-default | "Dashboard", → /guru/gamifikasi, fa-coins | FN-M14-10.3.1 |
| EL-M14-S21-009 | text | visible-default | "🎁" | FN-M14-10.3.2 |
| EL-M14-S21-010 | heading | visible-default | "Tiada Hadiah Tersedia" | FN-M14-10.3.2 |
| EL-M14-S21-011 | text | visible-default | "Admin akan menambah hadiah tidak lama lagi. Tunggu ya!" | FN-M14-10.3.2 |
| EL-M14-S21-012 | link | visible-default | "Dashboard Gamifikasi", → /guru/gamifikasi, fa-arrow-left | FN-M14-10.3.2 |

#### S22 — `/guru/gamifikasi/leaderboard` (9 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M14-S22-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M14-S22-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M14-S22-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M14-S22-004 | filter | visible-default | "Sekolah Saya", → /guru/gamifikasi/leaderboard?tab=sekolah, fa-school | FN-M14-10.4.1 |
| EL-M14-S22-005 | filter | visible-default | "Seluruh Malaysia", → /guru/gamifikasi/leaderboard?tab=global, fa-globe | FN-M14-10.4.1 |
| EL-M14-S22-006 | card | visible-default | "# Guru Soalan Syiling" | FN-M14-10.4.2 |
| EL-M14-S22-007 | table | visible-default | table | FN-M14-10.4.2 |
| EL-M14-S22-008 | link | visible-default | "Kembali ke Dashboard", → /guru/gamifikasi, fa-arrow-left | FN-M14-10.4.3 |
| EL-M14-S22-009 | card | conditional | "# Guru Sekolah Soalan Syiling" | FN-M14-10.4.2 |

### 6.2 Shell elements

The shells are chrome owned by the global shell / M23 (00-global-ui, design/shells.md). Their M14-relevant elements (M14 menu entries, header titles and the koin / mata / hari chips) are mapped below; every other shell element is excluded with the reason in the summary (global shell / M23 chrome, M15 entries, M22 bell and chatbot, M16).

#### SHA — admin panel shell (chrome of S1–S10) — 218 elements, 26 mapped, 192 excluded

M14-relevant and M15-owned entries (listed individually):

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M14-SHA-054 | toggle | visible-default | "Gamifikasi", type=submit, fa-gamepad | FN-M14-1.1.4 |
| EL-M14-SHA-055 | link | visible-default | "Overview", → /admin/gamification, fa-gamepad | FN-M14-1.1.4 |
| EL-M14-SHA-056 | link | visible-default | "Tier Config", → /admin/gamification/tiers, fa-crown | FN-M14-1.1.4 |
| EL-M14-SHA-057 | link | visible-default | "Cabaran", → /admin/gamification/challenges, fa-bullseye | FN-M14-1.1.4 |
| EL-M14-SHA-058 | link | visible-default | "Pelajar", → /admin/gamification/students, fa-users | FN-M14-1.1.4 |
| EL-M14-SHA-059 | link | visible-default | "Transaksi", → /admin/gamification/transactions, fa-receipt | FN-M14-1.1.4 |
| EL-M14-SHA-060 | link | visible-default | "Kedai Hadiah", → /admin/hadiah, fa-gift | Excluded — M15 entry (link owned by M15) |
| EL-M14-SHA-061 | link | visible-default | "Gamifikasi Guru", → /admin/gamifikasi/guru, fa-chalkboard-teacher | FN-M14-1.1.4 |
| EL-M14-SHA-062 | link | visible-default | "Kawalan Reward", → /admin/reward-control, fa-shield-halved | FN-M14-1.1.4 |
| EL-M14-SHA-106 | link | visible-default | "Streak / Kombo", → /kombo, fa-fire | FN-M14-1.1.2 |
| EL-M14-SHA-118 | heading | visible-default | "Dashboard" | FN-M14-1.1.5 |
| EL-M14-SHA-119 | text | visible-default | "Selamat datang, Admin" | FN-M14-1.1.5 |
| EL-M14-SHA-164 | text | hidden-only | "Gamifikasi" | FN-M14-1.1.4 |
| EL-M14-SHA-165 | link | hidden-only | "Overview", → /admin/gamification, fa-gamepad | FN-M14-1.1.4 |
| EL-M14-SHA-166 | link | hidden-only | "Tier Config", → /admin/gamification/tiers, fa-crown | FN-M14-1.1.4 |
| EL-M14-SHA-167 | link | hidden-only | "Cabaran", → /admin/gamification/challenges, fa-bullseye | FN-M14-1.1.4 |
| EL-M14-SHA-168 | link | hidden-only | "Kedai Hadiah", → /admin/hadiah, fa-gift | Excluded — M15 entry (link owned by M15) |
| EL-M14-SHA-169 | link | hidden-only | "Gamifikasi Guru", → /admin/gamifikasi/guru, fa-chalkboard-teacher | FN-M14-1.1.4 |
| EL-M14-SHA-203 | heading | conditional | "Gamifikasi Guru" | FN-M14-1.1.5 |
| EL-M14-SHA-204 | text | conditional | "Urus ganjaran, lencana & tebusan guru" | FN-M14-1.1.5 |
| EL-M14-SHA-207 | heading | conditional | "Tebusan Guru" | FN-M14-1.1.5 |
| EL-M14-SHA-208 | text | conditional | "Urus permohonan tebusan ganjaran guru" | FN-M14-1.1.5 |
| EL-M14-SHA-211 | heading | conditional | "Tebus Tunai Guru" | FN-M14-1.1.5 |
| EL-M14-SHA-212 | text | conditional | "Urus permohonan pengeluaran tunai guru" | FN-M14-1.1.5 |
| EL-M14-SHA-215 | heading | conditional | "Tetapan Gamifikasi" | FN-M14-1.1.5 |
| EL-M14-SHA-216 | text | conditional | "Urus kadar syiling, penukaran tunai & tetapan lain" | FN-M14-1.1.5 |
| EL-M14-SHA-217 | heading | conditional | "Kawalan Ekonomi Reward" | FN-M14-1.1.5 |
| EL-M14-SHA-218 | text | conditional | "Tetapan kewangan, kos hadiah & cabutan" | FN-M14-1.1.5 |

#### SHU — user-portal shell (chrome of S11–S22) — 382 elements, 43 mapped, 339 excluded

M14-relevant and M15-owned entries (listed individually):

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M14-SHU-015 | link | visible-default | "Kombo", → /kombo, fa-fire | FN-M14-1.1.2 |
| EL-M14-SHU-072 | link | visible-default | "Cabutan Bertuah 🎟️", → /cabutan, fa-ticket | Excluded — M15 entry (link owned by M15) |
| EL-M14-SHU-080 | link | visible-default | "Syiling & Token 🏆", → /gamification, fa-coins | FN-M14-1.1.1 |
| EL-M14-SHU-082 | link | visible-default | "Tukar Token", → /gamification/convert, fa-exchange-alt | FN-M14-1.1.1 |
| EL-M14-SHU-083 | link | visible-default | "Cabaran Harian", → /gamification/challenges, fa-bullseye | FN-M14-1.1.1 |
| EL-M14-SHU-084 | link | visible-default | "Kedai Hadiah", → /gamification/rewards, fa-gift | Excluded — M15 entry (link owned by M15) |
| EL-M14-SHU-085 | link | visible-default | "Kelulusan Hadiah", → /cikgu/kelulusan-hadiah, fa-shield-halved | Excluded — M15 entry (link owned by M15) |
| EL-M14-SHU-087 | link | visible-default | "Papan Pendahulu", → /gamification/leaderboard, fa-trophy | FN-M14-1.1.1 |
| EL-M14-SHU-088 | link | visible-default | "Pencapaian", → /gamification/achievements, fa-medal | FN-M14-1.1.1 |
| EL-M14-SHU-089 | link | visible-default | "Kotak Misteri", → /gamification/mystery-box, fa-box-open | Excluded — M15 entry (link owned by M15) |
| EL-M14-SHU-090 | link | visible-default | "Rujuk Kawan", → /gamification/referral, fa-user-plus | FN-M14-1.1.1 |
| EL-M14-SHU-097 | link | visible-default | "Admin Tebusan", → /admin/hadiah, fa-cogs | Excluded — M15 entry (link owned by M15) |
| EL-M14-SHU-116 | link | visible-default | "Urus Hadiah", → /admin/hadiah, fa-gift | Excluded — M15 entry (link owned by M15) |
| EL-M14-SHU-117 | link | visible-default | "Gamifikasi Guru", → /admin/gamifikasi/guru, fa-chalkboard-teacher | FN-M14-1.1.3 |
| EL-M14-SHU-136 | heading | visible-default | "Dashboard" | FN-M14-1.1.5 |
| EL-M14-SHU-137 | text | visible-default | "Selamat datang kembali" | FN-M14-1.1.5 |
| EL-M14-SHU-138 | text | visible-default | "256" | FN-M14-1.3.1 |
| EL-M14-SHU-139 | text | visible-default | "koin" | FN-M14-1.3.1 |
| EL-M14-SHU-140 | text | visible-default | "8" | FN-M14-1.3.1 |
| EL-M14-SHU-141 | text | visible-default | "mata" | FN-M14-1.3.1 |
| EL-M14-SHU-142 | text | visible-default | "1" | FN-M14-1.3.1 |
| EL-M14-SHU-143 | text | visible-default | "hari 🔥" | FN-M14-1.3.1 |
| EL-M14-SHU-151 | text | conditional | "256" | FN-M14-1.3.1 |
| EL-M14-SHU-152 | text | conditional | "koin" | FN-M14-1.3.1 |
| EL-M14-SHU-153 | text | conditional | "8" | FN-M14-1.3.1 |
| EL-M14-SHU-154 | text | conditional | "mata" | FN-M14-1.3.1 |
| EL-M14-SHU-155 | text | conditional | "1" | FN-M14-1.3.1 |
| EL-M14-SHU-156 | text | conditional | "🔥" | FN-M14-1.3.1 |
| EL-M14-SHU-179 | link | hidden-only | "Kombo", → /kombo, fa-fire | FN-M14-1.1.2 |
| EL-M14-SHU-213 | link | hidden-only | "Cabutan Bertuah 🎟️", → /cabutan, fa-ticket | Excluded — M15 entry (link owned by M15) |
| EL-M14-SHU-288 | link | hidden-only | "Syiling & Ganjaran", → /guru/gamifikasi, fa-coins | FN-M14-1.1.3 |
| EL-M14-SHU-294 | modal | hidden-only | "Gamifikasi" | FN-M14-1.1.1 |
| EL-M14-SHU-295 | text | hidden-only | "Gamifikasi" | FN-M14-1.1.1 |
| EL-M14-SHU-296 | link | hidden-only | "Syiling & Token", → /gamification, fa-coins | FN-M14-1.1.1 |
| EL-M14-SHU-297 | link | hidden-only | "Tukar Token", → /gamification/convert, fa-exchange-alt | FN-M14-1.1.1 |
| EL-M14-SHU-298 | link | hidden-only | "Cabaran Harian", → /gamification/challenges, fa-bullseye | FN-M14-1.1.1 |
| EL-M14-SHU-299 | link | hidden-only | "Kedai Hadiah", → /gamification/rewards, fa-gift | Excluded — M15 entry (link owned by M15) |
| EL-M14-SHU-301 | link | hidden-only | "Papan Pendahulu", → /gamification/leaderboard, fa-trophy | FN-M14-1.1.1 |
| EL-M14-SHU-302 | link | hidden-only | "Pencapaian", → /gamification/achievements, fa-medal | FN-M14-1.1.1 |
| EL-M14-SHU-303 | link | hidden-only | "Kotak Misteri", → /gamification/mystery-box, fa-box-open | Excluded — M15 entry (link owned by M15) |
| EL-M14-SHU-304 | link | hidden-only | "Rujuk Kawan", → /gamification/referral, fa-user-plus | FN-M14-1.1.1 |
| EL-M14-SHU-312 | link | hidden-only | "Urus Hadiah", → /admin/hadiah, fa-gift | Excluded — M15 entry (link owned by M15) |
| EL-M14-SHU-313 | link | hidden-only | "Gamifikasi Guru", → /admin/gamifikasi/guru, fa-chalkboard-teacher | FN-M14-1.1.3 |
| EL-M14-SHU-373 | heading | conditional | "Kad Kongsi" | FN-M14-1.1.5 |
| EL-M14-SHU-374 | text | conditional | "Kongsi pencapaian anda" | FN-M14-1.1.5 |
| EL-M14-SHU-375 | heading | conditional | "Syiling & Ganjaran" | FN-M14-1.1.5 |
| EL-M14-SHU-376 | text | conditional | "Sumbang soalan, kumpul syiling, tebus ganjaran!" | FN-M14-1.1.5 |
| EL-M14-SHU-377 | heading | conditional | "Tebus Tunai" | FN-M14-1.1.5 |
| EL-M14-SHU-378 | text | conditional | "Tukar syiling anda kepada wang tunai" | FN-M14-1.1.5 |
| EL-M14-SHU-379 | heading | conditional | "Kedai Hadiah" | FN-M14-1.1.5 |
| EL-M14-SHU-380 | text | conditional | "Tebus syiling untuk hadiah menarik!" | FN-M14-1.1.5 |
| EL-M14-SHU-381 | heading | conditional | "Papan Pendahulu" | FN-M14-1.1.5 |
| EL-M14-SHU-382 | text | conditional | "Siapa penyumbang soalan terbanyak?" | FN-M14-1.1.5 |


---

## 7. Fidelity deviations

These are the **only** intended differences from the live site. Anything not listed must match live (D7). Rule D9 (user, standing, pre-approved): where live is broken or contradictory, fix it minimally; where it works, replicate it exactly. D10: accessibility replicates live; a deliberate, consistent limit is not broken; adding options to a working feature is new scope. CLAUDE.md §6: minimal fixes that create no new visible contradiction; seeds mirror observation. Every fact cited below is in discovery §1–§8, the inventory or the dated snapshot.

| ID | Discovery | Category | Live behaviour (evidence) | Rebuild behaviour (specified) and alternatives | Status |
|---|---|---|---|---|---|
| DV-M14-01 | D-1 | Wrong title | The shell header reads "Dashboard" / "Selamat datang, Admin" on S1–S5 and "Dashboard" / "Selamat datang kembali" on S11–S17 (inventory SHA-118/119, SHU-136/137; every screenshot), while S6–S10 and S18–S22 show their own titles. | Shell rule DV-SH-03 (title from the route): the page title of FN-M14-1.1.5 — the h1 without its leading emoji (S2 "Tier Configuration", S12 "Tukar Syiling → Token", …), and for S11, whose h1 is the dynamic "{tier} Tier", the tab title "Gamifikasi Dashboard"; the live subtitle is kept ("Selamat datang, Admin" / "Selamat datang kembali"), as M08 DV-01 and M13 DV-M13-08. Alternatives: (a) tab titles everywhere ("Tier Config", "Cabaran Harian — Admin") — rejected: differ from the visible h1 and carry admin suffixes; (b) drop the subtitle (M04/M05 pattern) — rejected: the greeting is not wrong, only the title is; (c) keep emojis — rejected: shell titles are plain on every other module. | Approved (D9) |
| DV-M14-02 | D-2 | Dead link | Every share text ends with the hard-coded `https://prestasiplus.my/pelajar/3` (S15 `shareWhatsApp()`, S18 `whatsapp()`); `/pelajar/3` is 404 and the admin's profile is `/pelajar/1` (M08 DV-M08-19 is the same defect on M08 S16). | The link is the viewer's own public profile `https://prestasiplus.my/pelajar/{viewer id}` (same fix as M08 DV-M08-19). Alternatives: (a) drop the link — rejected: removes live content; (b) link to `/register` — rejected: changes the meaning. | Approved (D9) |
| DV-M14-03 | D-3 | Broken copy | S18 "Kedudukan" share text "🏆 Kedudukan saya di PRESTASIPLUS: ! Jom latih tubi!" — the value is empty (the template variable is undefined). | Insert the value the card itself shows: "🏆 Kedudukan saya di PRESTASIPLUS: {accuracy}%! Jom latih tubi!" (admin "38.7%"). Alternatives: (a) remove ": !" — rejected: the sentence then promises a standing without stating it; (b) the M08 national rank ("#1050") — rejected: not shown on the card, and a cross-module read for a share text; (c) replicate — rejected: broken copy. | Approved (D9) |
| DV-M14-04 | D-4 | Contradictory rule | S3 stores `challenge_type` `quiz_count` ("Bilangan Kuiz") for Si Tepat (80 % accuracy), Latihan 10 Minit (minutes), Kombo 2 Hari (streak) and Ketepatan 90% (accuracy); the select offers the matching types. A save would persist a type that contradicts the description and target. | Seed the four types by meaning: 2 and 9 `accuracy`, 7 `time_spent`, 8 `streak`; every other field (targets 80, 10, 2, 90, rewards, order) stays as observed; the other six keep their observed types. Progress uses the per-challenge metric either way (FN-M14-4.2.1), so no visible student value changes. Alternatives: (a) replicate — rejected: the admin form shows a contradictory type; (b) change the descriptions to counts — rejected: changes student copy. | Approved (D9) |
| DV-M14-05 | D-5 | Wrong label | S9 label "Nilai sen bagi setiap unit syiling (cth: 100 syiling = 8 sen)" while the setting, the preview ("10 syiling = 8 sen (RM0.08)") and S20 (92,683 → RM741.46) all use 10 syiling = 8 sen. | Label "… (cth: 10 syiling = 8 sen)" — only "100" → "10". Alternatives: (a) remove the example — rejected: more change than needed; (b) replicate — rejected: contradicts the rule. | Approved (D9) |
| DV-M14-06 | D-6 (re-decided after audit AUD-M14-04) | Unreadable text | S1 "Taburan Tier": the bars carry `min-width: 40px` (live; gold, platinum and silver bars are 40 px, so the counts 41 / 33 / 292 fit inside and nothing overflows), but the count is `text-white` with a drop shadow on the light fills gold #ffd700, silver #c0c0c0 and platinum #e5e4e2 (contrast about 1.1–1.4 : 1). | Replicate the bars, widths, `min-width: 40px`, placement inside the bar, order and percentages; only the count text is slate-800 on the three light fills (bronze keeps white). Alternatives: (a) replicate — rejected: white on near-white is unreadable text (D9, NFR-02); (b) place the count outside short bars (v1.0) — rejected: the live `min-width` already fits it, so that changed working layout. | Approved (D9) |
| DV-M14-07 | D-7 | Layout breakage | S14 at 375 px: page `scrollWidth` 376 (1 px horizontal overflow) from the podium row (snapshot `layout375`). | The podium row fits the viewport (three narrow cards, no page overflow); 768/1280 unchanged. Alternative: hide the podium below 640 — rejected: removes content. | Approved (D9) |
| DV-M14-08 | D-8 | Contradictory values | One account shows two streaks: 1 day / best 5 (header "1 hari 🔥", M05 banner "Kombo 1 hari akan putus!" and card, M08 Prestasi 360 "Kombo Hari 1" / "Rekod Terbaik 5") and 0 / 0 (S15 "0 Hari berturut-turut", "Terbaik: 0 hari"; S18 Kad Kombo 0 / 0; M08 profile "0 Kombo"). | One M14 streak store read by every screen; the admin value follows the store that live shows in the shell and on M05/M08 (1 / best 5), so S15 and S18 show 1 and 5. The multiplier stays "1.0x" (the only observed step). Alternatives: (a) 0 / 0 everywhere — rejected: changes the header, M05 and M08 values, which are the majority and the shell's; (b) keep two stores — rejected: contradictory (D12). | Approved (D9) — M08 applies XR-M14-03 on its S18 |
| DV-M14-09 | D-9 | Contradictory values | One account shows four coin totals: 256 (M14 wallet = Σ of its 14 ledger rows, header chip, M05), 103 (M08 `/pelajar/1` "🪙 103 Syiling" with "397 syiling lagi ke Silver" — no header chip on that public page; it contradicts S11 "Perlu 244 syiling lagi" for the same threshold), 342,703 (M08 `/prestasi/1` "Koin", beside the header chip "256 koin" on the same page), 26 (M08 `/leaderboard` own card "Koin"). | One M14 wallet. **Derived figures (chosen):** M08 S18 syiling = `currentSyiling` (256, "244 syiling lagi ke Silver", as S11); M08 S6 "Koin" = `currentSyiling` (256 — the same word and value as the header chip on that page, so they never diverge after a conversion or a spend). **26 unchanged:** M08's named period sum of session coins (BR-M08-28), a leaderboard metric, not a balance. Alternatives: (a) M08 display constants 103 / 342,703 (D11 exception) — rejected: 342,703 would sit beside the computed chip, 103 contradicts S11 across screens, and constants exist only for account 1; (b) S6 "Koin" = `totalSyilingEarned` (v1.0) — rejected: equal today but it would differ from the chip "koin" after any conversion; (c) seed the wallet at 103 or 342,703 — rejected: contradicts the 14 observed ledger rows; (d) change 26 — rejected: it is defined over sessions for every learner. | Approved (D9) — applied by M08 (XR-M14-03) |
| DV-M14-10 | D-10 | Candidate — contradictory data | S4 lists token balances −1, −2, −3 (7 rows on the observed pages). | **Rejected — replicate live (data).** The seeds keep the observed negative values (seeds mirror observation). No UI changes. At runtime every debit is refused when the balance is too low (FN-M14-8.3.3; live M15 already disables spending below the cost), so no new negative value can appear. Alternative: clamp the display to 0 — rejected: changes observed data. | Rejected — replicate live |
| DV-M14-11 | layout375 | Unreadable text | Text under 12 px (snapshot `textUnder12px`): S2 L1–L5 11.2 px and "Jawab Betul"/"Menang" 10 px; S3, S4, S5 badges 11.2 px; S6 table 10 px; S11 difficulty badges 10.4 px; S13 11.2 px; S15 reward line 11.2 px, rarity and progress 10.4 px; S18 card labels 9.6 px and tier/coins 11.2 px; S19 badge threshold/bonus 10 px. | Raised to 12 px; nothing else changes (same rule as M01 DV-16, M04 DV-M04-17, M08 DV-18; XL2-28). Alternative: replicate — rejected: NFR-02 treats text < 12 px as unreadable (D9). | Approved (D9) |
| DV-M14-12 | §5.6 | Candidate — contradictory counts | S1 "Penukaran" 534 while the S5 "🔄 Tukar" filter lists 535 rows. | **Rejected — replicate live.** Two named figures of one dataset: "Penukaran" counts `token_conversion` rows (534); the filter lists every `convert` row, including the one legacy `token_convert` row of 27/02/2026 (535). Both are reproduced exactly; no screen shows two values for one label. | Rejected — replicate live |
| DV-M14-13 | §2.3 | Candidate — inconsistent labels | S3 "Kesukaran" option "Susah" for `hard` while the card badge and the student screens say "Sukar". | **Rejected — replicate live.** Both words mean "hard" and each control is consistent in itself; no value contradicts another. | Rejected — replicate live |
| DV-M14-14 | audit AUD-M14-02 (live 2026-09-26) | Broken control | S4 `sort` select: live keeps the chosen option in the select and in the page links, but `?sort=level`, `current_syiling` and `token_balance` (with or without `tier`) all list the rows in lifetime order (first rows 1,018,083 / 686,730 / 135,760 / 65,129 / 60,305 for every value). This is **not** observed sorting; it is the fix. | Each option sorts descending by the field its label names (`total_syiling_earned`, `current_syiling`, `token_balance`, `level`), ties by lifetime syiling then wallet creation; filters and paging unchanged. Other sorts have no observed page, so generated rows may appear on their page 1 (the NFR-M14-01 anchor check covers the default order only). Alternatives: (a) replicate (select kept, order always lifetime) — rejected: a control that does nothing is broken (D9); (b) remove the select — rejected: removes live UI. | Approved (D9; Delivery Lead) |
| DV-M14-15 | G4 review (v1.6) | Unreadable text (contrast) | S11 "Sistem Tier" and S12 tier-rate cards print the tier label in the tier's own colour on a 12 % tint of that colour: gold `#ffd700`, silver `#c0c0c0`, platinum `#e5e4e2` (contrast ≈ 1.4–1.8:1). | Only the tier **label text** of gold, silver and platinum becomes slate-800 `#1e293b` (consistent with DV-M14-06); swatches, borders, tints, emoji and the bronze label keep the live colours. Alternatives: (a) replicate — rejected: unreadable (D9, NFR-02); (b) change the tints — rejected: a larger visual change; (c) darken the colour per tier — rejected: invents new brand colours. | Approved (D9; Delivery Lead) |
| DV-M14-16 | - | Language (BM copy) | Gamification student screens (wallet, convert, achievements, kad kongsi): "Tips:", "Sistem Tier", "Kadar Penukaran Mengikut Tier", tier names "Bronze/Silver/Gold", "Lvl n", "Gamifikasi Dashboard" | "Petua:", "Sistem Peringkat", "Kadar Penukaran Mengikut Peringkat", "Gangsa/Perak/Emas", "Tahap n", "Papan Pemuka Gamifikasi". | Approved: user decision 2026-10-24 (system audit FB-025) |
| DV-M14-17 | - | Language (BM copy) | Gamification dashboard, leaderboard rows, share card and teacher badge list: "Gamifikasi Dashboard", "← Dashboard", "Level n", "Badge: ...", share text "capai Level n" | "Gamifikasi Papan Pemuka", "← Papan Pemuka", "Tahap n", "Lencana: ...", "capai Tahap n". | Approved: user decision 2026-10-24 (system audit FB-025) |

**Working-but-odd behaviour that stays as live (not deviations):** tier distribution in alphabetical order; English tier keys on admin screens and "🥉 Bronze" on Kad Kongsi; unknown `?rarity=` shows an empty grid without a message; "Pelajar Awal" and "Streak 7 Hari" share one criterion; "Pakar Matematik" counts any 200 kuiz; duplicate bank options ("BSN" / "Bank Simpanan Nasional", "TNG eWallet" / "Touch n Go"); perks of existing tiers are not editable; settings 5–9 are editable on both S9 and S10; tab titles with and without "— PRESTASIPLUS"; `?period=` ignored on S14; "Sekolah Saya" lists every teacher when the viewer has no school; S20 quick buttons above the balance stay enabled; the S8 status select allows any transition; "Kombo" / "Streak / Kombo" menu entries redirect to the dashboard; the header chip says "koin" while pages say "syiling"; S19/S8 dates use English month abbreviations; S17 has no pager.

---

## 8. Out of scope

| Item | Owner / reason |
|---|---|
| `/gamification/rewards`, `/gamification/mystery-box`, `/cabutan`, `/admin/hadiah`, `/cikgu/kelulusan-hadiah` | M15 (uses the M14 wallet and draw contracts) |
| `/leaderboard`, `/ranking`, `/pelajar/{id}`, `/prestasi/{id}` | M08 (reads the M14 wallet and streak) |
| `/dashboard` Kombo banner, quest widget, stat cards; practice sessions | M05 (calls the M14 credit contract, BR-31) |
| Mini-games, battles, tournaments, the tournament banner | M16 |
| `/guru/soalan/cipta` and teacher question creation | M10 (calls the M14 contribution hook) |
| Winner drawing of a cabutan, real payouts to banks, real vouchers | not observable (Q-M15-5); simulated / not built |
| Unobserved results of POSTs (messages, row layouts after create) | built as PROPOSED, provisional (OQ-M14-11) |
| Real server-side authorisation, CSRF, rate limits, PDPA processing of bank data | backend phase (SRS §11.1) |
| Global shells, notification bell, chatbot | global shell / M23, M22 |

---

## 9. Open questions

1. **OQ-M14-01 Live run with test accounts (blocking G5 for the provisional parts).** Every POST result (conversion, award, tier/challenge/badge/reward/settings/cost/draw saves, cash request and status changes), a student's and a teacher's own view, the earning triggers, the unlocked achievement and completed challenge styles, draw rows, referral stats above 0 and `/kombo` for a student were not observed. Until approved, every AC marked (provisional) stays provisional.
2. **OQ-M14-02 Tier assignment (Q3).** Live tiers match neither the current balance nor the lifetime total (platinum at balance 129 / lifetime 65,129; bronze at lifetime 609). The prototype upgrades when the balance reaches a threshold and never downgrades (INFERRED); seeds keep observed tiers.
3. **OQ-M14-03 Level and titles (Q4).** No formula reproduces the stored levels (xp 268 → level 13, xp 481 → level 5). The prototype stores the level and never changes it at runtime; the bar uses 100 + 10 × (level − 1) (one observed point). When xp ≥ xpNeeded (designed pelajar "916/100 XP", pelajarmaju "432/120 XP") the text shows both numbers and the bar is full — PROPOSED, listed in OQ-M14-12. Title cut-offs 2,000 / 3,500 / 5,000 / 10,000 are INFERRED inside the observed gaps (only Permulaan < 300 ≤ Pelajar is observed); titles between Pelajar and Master may exist on live.
4. **OQ-M14-04 Teacher contributions (Q5).** The admin has 20,719 contributed questions but no "+10" row; S22 shows 1 question / 10 syiling for one teacher and 1,559 / 0 for another. The prototype pays `coins_per_question` per new contribution (INFERRED, provisional) and ranks S22 by the stored `questionsCount`.
5. **OQ-M14-05 Student shop source and the legacy catalogue — CLOSED (user decision, 2026-09-26: "ikut macam mana ada sekarang").** The student shop `/gamification/rewards` (M15 S5) replicates live and stays empty for every account; no shop catalogue source is modelled (M15 v1.3), so the prototype shows neither the hadiah catalogue nor the legacy catalogue on S5. Ownership stays as decided on evidence: the 11-item syiling-priced catalogue (ids 1–11, `cost_value_sen`) is M14-owned — its only admin screen is M14 S10 and its one claim row (#42 "Tuntut: Lencana Super Learner" −100) is in the M14 ledger. No legacy claim path is built; the S10 counters read legacy claims (none).
6. **OQ-M14-06 Cash hold (Q6).** Whether "Boleh Ditebus" subtracts pending requests and when coins leave the teacher wallet. The prototype holds coins for PENDING / APPROVED / PROCESSING and debits at PAID (INFERRED). The two live requests belong to other teachers (the admin's own history is empty).
7. **OQ-M14-07 Challenge metrics (Q7).** The prototype adopts M05 BR-10. The admin's observed rows are not all reproduced by it: "Rajin Berlatih" (3 kuiz) completed on 11/05 after two SPM sessions, and "Cabaran Kilat" (20 correct in one session) completed with 14 and 11 in two sessions (25 in the day). Seeds keep the observed rows; the runtime rule is provisional.
8. **OQ-M14-08 Streak and login rows (Q2).** Which activities count as a streak day, and whether "Streak activity (daily_login)" (+2, 90 of 400 sampled rows) comes from a student login; the admin logs in daily and has no such row. The prototype counts sessions and student password logins (INFERRED).
9. **OQ-M14-09 XP source.** The admin has 8 XP after 26 correct session answers and 6 challenge completions worth 103 XP, so neither M05 BR-09 (10 × correct) nor challenge XP explains live XP. The prototype keeps the observed values and applies M05 BR-09 and challenge/achievement XP at runtime (INFERRED, provisional).
10. **OQ-M14-10 Referral mechanism.** M01 `/register` ignores `?ref=` in the UI (M01 FR-18, OBSERVED). The prototype keeps the page as live and asks M01 to carry the query code to the register call (XR-M14-02); rewards are INFERRED and provisional.
11. **OQ-M14-11 Post-submit states.** Success and error messages, validation copy from the server, the rows created by the admin forms (reward catalogue, redemption queue, draws), the unlocked and completed styles, the S20 history row and the S8 admin-note display are PROPOSED (SRS §8.2).
12. **OQ-M14-12 PROPOSED / INFERRED items to report at G1:** "Siap Hari Ini" = users who completed every active challenge today (INFERRED; non-blocking — reads 0 at the project clock, as observed); header titles (DV-M14-01); the "Kedudukan" share value (DV-M14-03); ledger descriptions "Ramalan SPM: …", "Pencapaian: {name}", "Tiket Cabutan: {title}", "Sumbang Soalan #{id}", "Tebus Tunai #{id}", referral descriptions; the history icons for spend / convert / bonus; "🟢 Aktifkan"; "Tidak Aktif" badge; the empty teacher history reusing "Belum ada transaksi"; the S11 / M05 display when xp ≥ xpNeeded ("916/100 XP", full bar); "Siap Hari Ini" as users who completed every active challenge; flash and error copy of SRS §8.2; completed-challenge and unlocked-achievement styles; teacher catalogue rows and shop cards; redemption rows; draw rows and statuses; title cut-offs.
13. **OQ-M14-13 Cross-module requests** (SRS §6.12): M05 (credit contract, BR-10 moved to M14, designed wallet values), M08 (derived coins and one streak, badge source), M01 (login hook, referral code), M02 (wallet and teacher anchors 4001–4108, 4201–4208), M10 (contribution hook, optional read of `questionsCount`), M15 (answers to XR-M15-01…08), M16 (game reward call), M07 (PKSK credit), global shell (menu entries, titles, chips).
14. **OQ-M14-14 Conversion hint on M15 (XR-M15-05).** M14 confirms the rate model: the tier `conversion_rate` (50 / 40 / 30 / 20 syiling per token) is the only conversion rule (OBSERVED in the S12 script and in the ledger: 400 → 8 at 50, 500 → 25 at 20, 20 → 1 at 20). M15's admin hint "100 syiling = 1 token = RM1" states a rate no tier uses — a wrong label under D9; the minimal fix recommended to M15 is "1 token = RM1" (drop "100 syiling = "). M15 decides its own DV.
15. **OQ-M14-15 Reward budget scope (XR-M15-06).** The RM10 / RM3 budget is expressed in "nilai-kos" sen, the unit of `cost_value_sen` of the legacy catalogue, on the same page ("digital = 0, tak makan bajet"). INFERRED: it applies to legacy-catalogue claims only, not to hadiah redemptions; no enforcement is built because no legacy claim path is built (OQ-M14-05 closed).
16. **OQ-M14-16 Ledger time zone.** Live ledger times look like UTC (S1 "13 minit yang lepas" for "26/09/2026 03:32" at a capture of 11:45 MYT). The rebuild displays the stored values unchanged, as M05 does for the same sessions, at the single project clock (25/09 15:40); the 10 observed rows stored after it are not seeded (SRS §6.11.1).
17. **OQ-M14-17 Overview definitions.** "Syiling Dijana" = Σ lifetime syiling of the wallets, "Token Ditukar" = Σ tokens of conversion rows and "Siap Hari Ini" = users who completed every active challenge today are INFERRED; all are exact named queries of the datasets (SRS §6.10). "Siap Hari Ini" as a count of completion rows would give 11 at the project clock (the designed pelajar and pelajarmaju completions of 25/09) against the observed 0.
18. **OQ-M14-18 Future readers of the streak.** M18 (`/kombo/sekolah/{id}`, `/kombo/ppd`, `/kombo/jpn`) will need aggregate streak queries (audit AUD-M14-14); for M18's XL gate.
19. **OQ-M14-19 M18 streak means (XR-M14-10).** M18's 8880 top-10 (Σ current 88) plus 4 more active pupils (≥ 1 each) give a mean of at least 6.6, not the observed 6.4; 7780's top-10 (Σ 102) plus 5 more give at least 7.1, not 7.0 (and BATANG PADANG 6.1, not "6"). M14 seeds the top-10 rows exactly with the remaining active pupils at `current` 1 and asks M18 to name the D9 value (means or top-10 rows).
20. **OQ-M14-20 "Muat Turun" PNG downloads (CLOSED — decided D25, 2026-10-03; v1.7).** The user allowed option (b): the button captures the user's own on-screen card with html2canvas 1.4.1 (scale 2, lazy-loaded) and downloads a PNG; this is not generated media under D22. Closes SRS SQ-M14-06.
