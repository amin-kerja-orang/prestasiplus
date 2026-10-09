# M16 — Battle, Games & Competitions — User Requirements Specification

## 0. Document control

| Field | Value |
|---|---|
| Document | URS — M16 Battle, Games & Competitions (Battle Arena and school battle ranking, the games hub and 17 games, multiplayer lobbies and rooms, single-player games, Roda Nasib, Jutawan Ilmu, weekly competition, Uji Minda, tournaments, leagues, Sekolah Bersaing, game settings, and the global tournament banner) |
| Version | 1.5 |
| Date | 2026-09-26 |
| Status | **Approved (G1)** 2026-09-27 — audit round 2 PASS (`docs/qa/audit/M16-audit.md`); v1.3 applies XL batch 3 round 1 (`docs/qa/audit/cross-module-logic-M12-M18.md`). v1.4 applies XL batch 3 round 2 (R2-07): M04 delivered the `jutawanQuestions` store, XR-M16-01 applied, no build-blocking item left. History: v1.1 addressed audit round 1 findings AUD-M16-01…12. Fidelity deviations decided under user rule D9 (standing, pre-approved) and D10. Every result of a live POST (match, room, spin, submit, league, tournament, settings) and every screen behind them (arena, rooms, tournament detail, Jutawan game) was not observable; those states are SOURCE-DERIVED where page scripts show them, otherwise INFERRED or PROPOSED, and provisional (discovery §9–§10). |
| Author | product-analyst (agent); data entities, datasets, simulation and mock API of the companion SRS by solution-architect (agent) |
| Source discovery | [M16-battle-games.md](../../discovery/M16-battle-games.md) (§1–§11, defects D-M16-1…31 in §8.2, §8.3 audit checklist, §9 open questions Q-M16-1…14, §10 states needing a live action, Appendices A–B); inventory [`inventory/M16/`](../../discovery/inventory/M16/) (`S1…S30-*.json`, 1,571 content elements over 189 states; `SHU-user-shell.json` 399, `SHA-admin-shell.json` 202; `_crawl.json` 314 URLs; `_summary.md`); dated seed snapshot `_snapshot-2026-09-26.json` (45 pages, 04:39 UTC = 12:39 MYT, students as `<student:n>` tokens, schools as live ids); masked screenshots `docs/discovery/img/M16/` (86) |
| Companion SRS | [srs/M16-battle-games.md](../srs/M16-battle-games.md) |
| Related | M01 (session, guard, 404 page, canonical accounts 1–11), M02 (users dataset §6.15 — M16 student anchors 4301–4377 and teacher 4401 requested; schools dataset — the battle schools 2710, 8078, 8080, 8082, 8090, 8106, 8880, 900 and the Sekolah Bersaing schools), M03 (subjects 1–31, levels 1–11), M04 (question store: game and battle pools, PKSK rows, SPM pool, Jutawan counts), M05 (practice sessions: weekly ranking S20; answer log not written by games), M06 (SPM subjects), M07 (PKSK domains and levels T1/T4), M08 (`/ranking`, `/leaderboard` — not M16), M11 ("Battle" / "Permainan" activities), M14 (wallet, XP, `games_award_syiling`, M14 BR-M14-21), the parent portal (the parent side of Uji Minda), the global shell / M23 ([design/shells.md](../../design/shells.md) DV-SH-03; the shell mounts the banner) |

**Change log**

| Version | Date | Change |
|---|---|---|
| 1.5 | 2026-09-27 | **XL batch 3 round 3** (R3-02; status stays Approved (G1)). pelajarmaju (account 4) is at fixture school **900004 "SK Demo Bestari"** (M02 v1.16): §6.11.4 weekly-ranking rank 14 corrected (was 900002); no other M16 reference to account 4's school. Traceability 0 errors. |
| 1.4 | 2026-09-27 | **XL batch 3 round 2** (R2-07; status stays Approved (G1)). M04 v1.11 delivers the `jutawanQuestions` store (143 cells, Σ 149,911, Q-JUT-COUNT; `questions.jutawan.count / sample / get / gradeAnswer`, keyless `sample`): DC-M16-02 retired — the S19 counts are M04 named-query reads and Jutawan play samples and grades through that contract; XR-M16-01 **applied**, no longer build-blocking. M07 v1.7 BR-M07-26 alignment recorded: the token `pksk` is the M05 session mode, the M14 source and the M16 battle `questionType`; a PKSK battle stays an M16 Battle record (never an M05 session) and reads PKSK rows only through M04 (XR-M16-08 noted by M07). Traceability 0 errors. |
| 1.3 | 2026-09-27 | **XL batch 3 round 1** (status stays Approved (G1)). XL3-16: S20 restated at the project clock with M05 v1.10 Q-WEEK-RANK — ranks 1–5 are M17's persons (pupil 2022 = token 59; M17's four 8082 week pupils = tokens 60–63), duplicate ids 4359–4377 dropped, ranks 6–20 placed (PROPOSED) inside M17 v1.3 §6.7 B's remaining 715 week answers (joint script check); the 26 Sep page stays the observed record. XL3-17: the battle store holds 168 battles (66 finished, 5 forfeited, 97 abandoned) and 47 game results so that M17's Q-M17-BATTLES (168 / 0 / 66; battles 0 / 4 / 23, games 0 / 5 / 47 over 7 / 30 / 90 days) are named queries on it; every observed standing still reproduced (standings script). XL3-18: anchor grades per M02 v1.12 §6.15 D (4301 8106 T5, 4320 8880 T5, 4321 2710 Darjah 6, 22 no-class no-school, 32 T4 pool, 4401 teacher). XL3-26: `canEarnSyiling` (M14) replaces `coinsEnabled`. XL3-25: bot accuracy = the M05 platform accuracy (82.84 %). XL3-27: pelajarmaju at rank 14. XR-M16-01 accepted by M04 (separate store), build-blocking until delivered. Coverage 1,571/1,571; traceability 0 errors. |
| 1.2 | 2026-09-27 | **G1 approved** after audit round 2 (PASS). R2-01: S28 weeks 14 Sep / 07 Sep / 31 Aug seeded with the top-up TU-M16-01 values (`_topup-2026-09-26.json`; % Aktif 0.0% at 14 Sep pos 21, 07 Sep pos 20, 31 Aug pos 20), every "(TU)" mark removed, OQ-M16-17 / SQ-M16-07 closed. R2-I1: "4302 had no school at battle time" labelled INFERRED. XR-M16-01 (M04 Jutawan store) stays build-blocking for the XL batch 3 gate. Coverage 1,571/1,571; traceability 0 errors. |
| 1.1 | 2026-09-26 | **Audit round 1** (`docs/qa/audit/M16-audit.md`, FAIL 0/2/10). AUD-01: the Sekolah Bersaing weeks of 14 Sep, 07 Sep and 31 Aug are seeded as observed by the audit (the 21 Sep list without row #46, observed order and values; cells the audit did not state are marked for a discovery top-up, TU-M16-01), the invented "− 0.1 per week" rule is removed (FN-10.1.5, AC-38.5). AUD-02: battle standings are **computed from the battle records** (D11) with 0–0 = win for player B (the only rule that reproduces the observed standings); the list colours that winner too (new DV-M16-35); 8082 all time is computed from its 5 recorded battles (new DV-M16-36); older unlisted battles are generated for 8106, 8078, 8080; ketepatan and skor stay stored job figures (DC-M16-03); DV-M16-26 corrected (now approved: S2 monthly rows computed). Minors: Roda Nasib `segment_index` 0-based (AUD-04); exact failure handlers and the messages "Ralat rangkaian." / "Ralat rangkaian. Sila cuba lagi." (AUD-05); `coinsEnabled` in the game payloads (AUD-06, XR-M16-02); complete sub-12 px list and a sweep AC (AUD-07); S4 overflow at 375 fixed by in-card scroll (new DV-M16-37, AUD-08); menu icon colours (AUD-09); 8880 / 2710 inactive as M18 (AUD-10); XR-07 impact on M14 (AUD-11); DC-M16-02 interim and XR-M16-01 build-blocking (AUD-12); complete G1 PROPOSED list with the bot accuracy read from M05 (AUD-03, I1); banner presentation (I5); game-page session on GET (I4, SEC-M16-11). 37 deviation decisions (27 approved, 10 rejected). Coverage and traceability re-run: 1,571/1,571, 0 errors. |
| 1.0 | 2026-09-26 | First issue under D7 (fidelity), D8 (proven completeness), D9/D10 (deviation rule, accessibility and scope), D11/D12 (virtual datasets, one owner per store), D4 (simulated realtime) and the privacy-over-fidelity rule. Ownership decision of the Delivery Lead: M16 owns the tournament banner (`GET /api/tournament/active`, three states, component), mounted by the global user shell. §6 coverage matrix generated by script from the inventory JSON: 1,571/1,571 content elements mapped, 0 unmapped; shells 601/601 accounted for. 34 deviation decisions (23 approved fixes, 11 rejected — replicate live). |

**Conventions** (same as M01–M15)
- Quoted UI copy is the exact live text. English or mixed words shown on live ("Battle Arena", "Quick Match", "Battle Sekolah", "Leaderboard", "HOT", "MULTIPLAYER", "Special Effect", "Speed Up", "Chain", "Combo", "Ranking Live", "SPM Mock", "MVP", "SNIPER!", "SHARP!", "GENIUS!", "Streak Avg", "Share ranking ini …", "opt-out") are live copy and are kept. Where CSS upper-cases text, this is stated.
- **OBSERVED** = seen on the live site (walk-through, inventory state, snapshot, screenshot). **SOURCE-DERIVED** (SOURCE) = read from page markup or script (Alpine components `battleLobby()`, `quickMatch()`, `betulSalah()`, `speedChallenge()`, `tembakJawapan()`, `susunJawapan()`, `memoryGame()`, `spinWheel`, `tournamentForm()`, `tournamentBanner()`), but the state was never produced by a real server answer. **INFERRED** = the most likely live behaviour, not observed. **PROPOSED** / **PROPOSED COPY** = a value, text or layout written for the rebuild (listed in §9, OQ-M16-15, for the Delivery Lead to report at G1). **SIMULATION** = behaviour that live performs with other people (opponents, matchmaking, room players) and that the prototype performs with deterministic bots (decision D4).
- **Provisional** = a requirement, AC or E2E that asserts INFERRED/PROPOSED/SIMULATION behaviour or a state that only a live action can show (the arena, rooms, the tournament detail, the Jutawan game, every POST result). It stays provisional until a live run with test accounts is approved (OQ-M16-01). E2E scenarios tagged `@provisional`.
- **D-M16-n** = live defect of discovery §8.2. **Q-M16-n** = discovery open question. **DV-M16-nn** = fidelity deviation (§7); anything not listed there must match live. **SEC-M16-nn** = risk in live behaviour (SRS §11.1). **XR-M16-nn** = cross-module request (SRS §6.12). **DC-M16-nn** = documented display constant (D11 exception).
- **Personal data.** Students are minors. Discovery tokenised every student (`<student:n>`, 77 distinct) and masked every school name. The rebuild seeds **fictitious** people only: token `<student:n>` becomes user **4300 + n** (a fictitious student of the M02 users dataset, XR-M16-04), except `<student:51>`, the admin account itself (the Papan Bijak #1, D-M16-15), which is user 1 "Admin Demo", tokens 59–63 (the S20 top five), which are M17's persons (pupil 2022 and M17's four 8082 week pupils), and tokens 64–77, which appear only on the post-clock S20 and are not seeded (v1.3, XL3-16). League 1's creator is fictitious teacher **4401**. School names come from the M02 schools dataset (public institutions; M02 decides the names). "Admin PRESTASI+" (live admin display name) is "Admin Demo" (M01).
- **Clock.** All values use the project clock `2026-09-25T15:40:00+08:00` (Friday; week Monday 21 – Sunday 27 Sep 2026; month September 2026), set with `mock.setNow`. Live relative times observed on 26 Sep 12:39 ("1 minggu yang lepas", "2 bulan yang lepas" …) are seeded as dates that give the same text at this clock (SRS §6.11).
- **Coins.** M14 owns the wallet. With the M14 seed (`games_award_syiling` = 0) games pay no syiling, so every syiling value that a game shows is the credited value, 0 (DV-M16-23); assertions with syiling above 0 use the M14 setting 1 (test fixture).

---

## 1. Overview

M16 is the **play and compete** area of PrestasiPlus. Students duel 1-v-1 in **Battle Arena** (quick match, school battle or a challenge to a friend) on a subject, a PKSK domain or SPM questions; schools are ranked by their pupils' battles. The **games hub** (`/permainan`) opens 17 games: a board game with snakes and ladders (**Papan Bijak**), five other multiplayer room games (**Perang Fakta**, **Benteng Ilmu**, **Perlumbaan Matematik**, **Kuiz Relay**, **Teka Silang Kata**), five single-player drills (**Betul atau Salah**, **Cabaran Kilat**, **Tembak Jawapan**, **Susun Jawapan**, **Kad Memori**), a daily wheel (**Roda Nasib**), a 15-question ladder (**Jutawan Ilmu**), a weekly practice competition (**Pertandingan Mingguan**), a parent-set challenge (**Uji Minda**) and **Sambung Kata** (500 on live). Schools compete in **tournaments** and **leagues**, and a weekly **Sekolah Bersaing** board compares schools' activity. Admins set the Papan Bijak board (`/admin/permainan`). A **tournament banner** on every user-portal page announces tournaments that are open or running.

All questions come from the M04 question store; coins and XP go through M14; the weekly competition reads M05 practice sessions. Live has no WebSocket: matchmaking and rooms work by HTTP polling every 3 s, which the prototype keeps, with simulated bot opponents (D4).

The TRACKER listed 8 routes; the crawl found **30 screens** (S1–S30) and several sub-routes:

| # | Route | Tab title (exact live) | Shell · header title / subtitle (live → rebuild) | Admin outcome (observed) |
|---|---|---|---|---|
| S1 | `/battle` | "Battle Arena" | SHU · "Battle Arena" / "Bertanding kuiz 1v1 dengan pelajar lain!" | 200; SPM locked (Darjah 4 account) |
| S2 | `/battle/leaderboard` | "Ranking Pelajar Battle" | SHU · "Ranking Pelajar Battle" / "Siapa pejuang terhebat minggu ini?" | 200; empty |
| S3 | `/battle/ranking-sekolah` (`?period=weekly\|monthly\|all_time&state=`) | "Papan Ranking Sekolah" | SHU · "Papan Ranking Sekolah" / "Ranking 10,218 sekolah seluruh Malaysia" | 200; weekly 0, monthly 1, all time 7 |
| S4 | `/battle/ranking-sekolah/{id}` **new** | "{sekolah}" | SHU · "{sekolah}" / "{negeri} · {jenis}" | 200 for every school; unknown id 404 |
| S5 | `/battle/history` **new, unlinked** | "Sejarah Battle" | SHU · "Sejarah Battle" / "Rekod pertandingan anda" | 200; empty |
| S6 | `/permainan` | "Permainan — PRESTASIPLUS" | SHU · "Dashboard" / "Selamat datang kembali" → "Zona Permainan" / "Selamat datang kembali" (DV-M16-01) | 200; 18 cards |
| S7 | `/papan-bijak` **new** | "Papan Bijak — PRESTASIPLUS" | → "Papan Bijak" (DV-M16-01) | 200 |
| S8–S12 | `/perang-fakta`, `/benteng-ilmu`, `/perlumbaan-matematik`, `/kuiz-relay`, `/teka-silang-kata` **new** | "{Game} — PRESTASIPLUS" | → "{Game}" (DV-M16-01) | 200 |
| S13–S16 | `/permainan/betul-salah`, `/permainan/cabaran-kilat`, `/permainan/tembak-jawapan`, `/permainan/susun-jawapan` (`?darjah=`) **new** | "Betul atau Salah ✅ — PRESTASIPLUS", "Cabaran Kilat ⚡ — …", "Tembak Jawapan 🎯 — …", "Susun Jawapan 🧩 — …" | → game title (DV-M16-01) | 200 |
| S17 | `/permainan/kad-memori` **new** | "Kad Memori — PRESTASIPLUS" | → "Kad Memori" | 200 |
| S18 | `/permainan/roda-nasib` **new** | "Roda Nasib — PRESTASIPLUS" | → "Roda Nasib" | 200 |
| S19 | `/permainan/jutawan` (`?darjah=`) **new** | "Jutawan Ilmu 💰 — PRESTASIPLUS" | → "Jutawan Ilmu" | 200 |
| S20 | `/permainan/pertandingan` **new** | "Pertandingan Mingguan — PRESTASIPLUS" | → "Pertandingan Mingguan" | 200 |
| S21 | `/permainan/uji-minda` **new** | "Uji Minda — Belum Ada Cabaran" | → "Uji Minda" | 200; empty |
| S22 | `/permainan/sambung-kata` **new** | — | — | **500** (empty body) → handled error page (DV-M16-03) |
| S23 | `/tournament` | "Liga & Tournament" | SHU · "Liga & Tournament" / "Senarai tournament antara sekolah" | 200; empty |
| S24 | `/tournament/admin/create` **new** | "Cipta Tournament" | SHU · "Cipta Tournament Baru" / "Tetapkan format, sumber soalan, dan jadual pendaftaran" | 200 |
| S25 | `/liga` | "Liga Pertandingan" | SHU · "Liga Pertandingan" / "Sertai dan urus pertandingan antara sekolah" | 200 |
| S26 | `/liga/cipta` **new** | "Cipta Liga" | SHU · "Cipta Liga Pertandingan" / "Tetapkan peraturan dan mulakan pertandingan antara sekolah" | 200 |
| S27 | `/liga/{id}` **new** | "{nama liga}" | SHU · "{nama liga}" / "Friendly · School" → "Persahabatan · Sekolah" (DV-M16-12) | 200 for 1, 2; else 404 |
| S28 | `/sekolah-bersaing` (`?week=`) | "Sekolah Bersaing — Leaderboard Mingguan" | **SHA** · "Dashboard" / "Selamat datang, Admin" → **SHU** · "Sekolah Bersaing" / "Selamat datang kembali" (DV-M16-02) | 200 |
| S29 | `/admin/permainan` | "Permainan - Admin Panel" | SHA · "🎮 Tetapan Permainan" / "Urus konfigurasi Papan Bijak, Kad Memori & permainan lain" | 200 |
| S30 | tournament banner `tournamentBanner()` in `<main>` of every SHU page | — | — | hidden: `GET /api/tournament/active` → `[]` |
| — | `/battle/arena/{uuid}` | — | provisional arena (§4 US-M16-09) | 404 for unknown uuids |
| — | `/papan-bijak/{code}`, `/{game}/{code}` | — | provisional rooms (US-M16-19) | 404 / redirect + flash for unknown codes |
| — | `/permainan/jutawan/main?subject=&darjah=` | — | provisional Jutawan game (US-M16-28) | not opened |
| — | `/tournament/{uuid}` | — | provisional detail (US-M16-34) | 404 (no tournament) |

**Cross-module notes.** `/ranking` and `/leaderboard` are **M08**; `/gamification/*` and the wallet, XP and `games_award_syiling` are **M14**; `/peta-belajar` (the Peta Pengembaraan card) is **M03**; `/practice` (S20 "Mula Latih Tubi") is **M05**; the parent "Cabaran Uji Minda" dashboard belongs to the parent portal. The banner is M16's although it renders on every module's user-portal page; the other modules' URS exclude its elements ("LIVE:", "MAIN", "DAFTAR") with M16 as owner, and this URS maps them (FN-M16-1.3.1).

### 1.1 What is real, what is simulated

| Part | Live | Rebuild |
|---|---|---|
| Lobby screens, rankings, hub, lobbies' forms, leaderboards, leagues, Sekolah Bersaing, settings | server-rendered pages | same content from the mock API (seeded from the snapshot) |
| Battle matchmaking | HTTP polling every 3 s against a server queue (SOURCE) | same polling contract; the other student is a **bot** (SIMULATION) |
| Arena, rooms, tournament detail, Jutawan game | exist, never observable | PROPOSED minimal screens, provisional |
| Single-player games | client-side games with server payloads and submits (SOURCE) | same client rules; payload from M04; submit to the mock |
| Coins | client-computed "Syiling" shown; M14 pays none (`games_award_syiling` = 0) | the credited amount is shown (0), DV-M16-23 |
| Weekly competition, school battle standings, league standings, Sekolah Bersaing | produced by server jobs (hourly / weekly cron) | stored job outputs seeded from the snapshot (documented display data); runtime battles and rooms update the M16-owned standings |

---

## 2. Actors

| Role | Involvement in M16 | Verified |
|---|---|---|
| Admin | Every screen S1–S30; admin-only S24 and S29; the admin panel group "Battle & Permainan". The admin account has a student profile (grade Darjah 4): SPM battle locked, Papan Bijak #1 (6 games), personal bests 38 / 40, 2 spins. | OBSERVED (admin account) |
| Pelajar (student) | Owner persona of S1–S23, S25–S28: battles, games, competitions, leagues. The unlocked SPM battle type is for Tingkatan 4–5 students (`pelajar@demo.test`, grade 10). | INFERRED (no student account; screens observed as admin) |
| Guru (teacher) | Opens the user-portal screens like any logged-in user; creating leagues (S26) fits teachers best (INFERRED). | INFERRED |
| Ibu Bapa (parent) | Sets Uji Minda challenges on the parent dashboard (out of scope); no M16 screen evidence. | UNVERIFIED |
| Admin Sekolah, PPD, JPN, Penaja | No evidence; the user-portal screens render for any logged-in role (INFERRED, provisional). | UNVERIFIED |
| Guest | Redirected to `/login` (M01 pattern). | INFERRED |
| Bot opponent | A simulated fictitious student that matches, answers and joins rooms in the prototype (D4). | SIMULATION |

---

## 3. Functional breakdown (Epic → Feature → Function)

Built from the element inventory (`docs/discovery/inventory/M16/`) and the Function catalogue used by the §6 script. "EL" lists inventory element IDs (prefix `EL-M16-`; `SHA`/`SHU` = shell files). Functions with EL "—" are behaviours (access and error rules, polling and simulation contracts, game rules, unobservable or PROPOSED states, cross-module contracts) with no element of their own. S30 captured the banner on `/permainan` and `/tournament`, so its host-page elements map to the S6 and S23 Functions.


### EP-M16-1 — Navigation, shell, access, tournament banner and cross-cutting rules


**FT-M16-1.1 — Menu entries, header titles, tab titles and shells**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M16-1.1.1 | User-portal menu entries (live order and icons): sidebar **"Sekolah Bersaing"** + badge "NEW" (`fa-trophy`, `data-tip` "Leaderboard mingguan sekolah-sekolah Malaysia") in group "✨ Visi & Pertandingan" and a second **"Sekolah Bersaing"** after "Profil Cerah" → `/sekolah-bersaing`; **"Liga Pertandingan"** (`fa-trophy`) → `/liga` after "Laporan Soalan"; in group "Pembelajaran" **"Permainan 🎮"** (`fa-gamepad`, badge "🎮") → `/permainan` and **"Tournament"** (`fa-trophy`) → `/tournament`; the drawer repeats "Permainan 🎮", "Tournament" and "Sekolah Bersaing NEW"; the bottom nav below 1024 px has **"Game"** (`fa-gamepad`) → `/permainan`. `/battle` has no user-portal menu entry (as live; reached from the S6 card and the admin menu). Icon colours (live, AUD-M16-09): "Sekolah Bersaing" (both entries) `fa-trophy text-amber-500`, "Liga Pertandingan" `text-yellow-500`, "Tournament" `text-amber-500`, "Permainan 🎮" `fa-gamepad` with no colour class on its own active page and `text-purple-500` in the drawer; the active entry takes the shell's active style (00-global-ui) | SHU-023–024, 049, 059, 070–071, 074, 211–212, 215, 226–227, 339 | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-1.1.2 | Admin-panel menu: collapsible group **"Battle & Permainan"** (`fa-bolt`, Alpine section key `battle`) with **"Battle Live"** (`fa-bolt`) → `/battle`, **"Ranking Sekolah"** (`fa-school`) → `/battle/ranking-sekolah`, **"Leaderboard"** (`fa-trophy`) → `/battle/leaderboard`, **"Tetapan Permainan"** (`fa-dice`) → `/admin/permainan`; the mobile "Lagi" list shows "Battle & Permainan" with "Battle Live" and "Tetapan Permainan" only (as live); group "✨ Visi & Pertandingan" has **"Sekolah Bersaing"** (`fa-trophy`) → `/sekolah-bersaing`. Admin links to user-portal routes (`/battle*`, `/sekolah-bersaing`) open them in the user-portal shell (FN-M16-1.1.5). Colours (live): the group items `text-slate-400 text-xs` in the sidebar; in the "Lagi" list "Battle Live" `text-red-500` and "Tetapan Permainan" `text-emerald-500` | SHA-063–067, 104, 170–172 | Admin | OBSERVED |
| FN-M16-1.1.3 | Shell header title / subtitle per screen (live → rebuild): S1 "Battle Arena" / "Bertanding kuiz 1v1 dengan pelajar lain!"; S2 "Ranking Pelajar Battle" / "Siapa pejuang terhebat minggu ini?"; S3 "Papan Ranking Sekolah" / "Ranking 10,218 sekolah seluruh Malaysia" (DV-M16-32); S4 "{nama sekolah}" / "{negeri} · {SK\|SMK}"; S5 "Sejarah Battle" / "Rekod pertandingan anda"; S23 "Liga & Tournament" / "Senarai tournament antara sekolah"; S24 "Cipta Tournament Baru" / "Tetapkan format, sumber soalan, dan jadual pendaftaran"; S25 "Liga Pertandingan" / "Sertai dan urus pertandingan antara sekolah"; S26 "Cipta Liga Pertandingan" / "Tetapkan peraturan dan mulakan pertandingan antara sekolah"; S27 "{nama liga}" / "{Jenis} · {Skop}" in BM labels ("Persahabatan · Sekolah", DV-M16-12); S29 "🎮 Tetapan Permainan" / "Urus konfigurasi Papan Bijak, Kad Memori & permainan lain". Live shows the generic "Dashboard" / "Selamat datang kembali" on S6–S21 and "Dashboard" / "Selamat datang, Admin" on S28; the rebuild shows the page title with the user-portal subtitle "Selamat datang kembali" (DV-M16-01, DV-M16-02, DV-SH-03): S6 "Zona Permainan", S7 "Papan Bijak", S8 "Perang Fakta", S9 "Benteng Ilmu", S10 "Perlumbaan Matematik", S11 "Kuiz Relay", S12 "Teka Silang Kata", S13 "Betul atau Salah", S14 "Cabaran Kilat", S15 "Tembak Jawapan", S16 "Susun Jawapan", S17 "Kad Memori", S18 "Roda Nasib", S19 "Jutawan Ilmu", S20 "Pertandingan Mingguan", S21 "Uji Minda", S28 "Sekolah Bersaing" | SHA-118–119, 198–199; SHU-136–137, 375–376, 380–399 | All logged-in (OBSERVED admin) | OBSERVED + DV-M16-01/02/12 |
| FN-M16-1.1.4 | Tab titles (exact live): S1 "Battle Arena", S2 "Ranking Pelajar Battle", S3 "Papan Ranking Sekolah", S4 "{nama sekolah}", S5 "Sejarah Battle", S6 "Permainan — PRESTASIPLUS", S7 "Papan Bijak — PRESTASIPLUS", S8 "Perang Fakta — PRESTASIPLUS", S9 "Benteng Ilmu — PRESTASIPLUS", S10 "Perlumbaan Matematik — PRESTASIPLUS", S11 "Kuiz Relay — PRESTASIPLUS", S12 "Teka Silang Kata — PRESTASIPLUS", S13 "Betul atau Salah ✅ — PRESTASIPLUS", S14 "Cabaran Kilat ⚡ — PRESTASIPLUS", S15 "Tembak Jawapan 🎯 — PRESTASIPLUS", S16 "Susun Jawapan 🧩 — PRESTASIPLUS", S17 "Kad Memori — PRESTASIPLUS", S18 "Roda Nasib — PRESTASIPLUS", S19 "Jutawan Ilmu 💰 — PRESTASIPLUS", S20 "Pertandingan Mingguan — PRESTASIPLUS", S21 "Uji Minda — Belum Ada Cabaran", S23 "Liga & Tournament", S24 "Cipta Tournament", S25 "Liga Pertandingan", S26 "Cipta Liga", S27 "{nama liga}", S28 "Sekolah Bersaing — Leaderboard Mingguan", S29 "Permainan - Admin Panel" | — | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-1.1.5 | Shells: S1–S28 render in the user-portal shell (SHU) for every role, the admin included (S28 moved from the admin layout, DV-M16-02), with drawer, chips strip and bottom nav below 1024 px; S29 renders in the admin-panel shell (SHA). The user-portal chips "koin" / "mata" / "hari" are M14 data. S13–S16 and S19 overlays (picker, countdown, result) cover the viewport above the shell | — | All logged-in (OBSERVED admin) | OBSERVED + DV-M16-02 |

**FT-M16-1.2 — Access, error pages and query tolerance**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M16-1.2.1 | Every M16 route and endpoint needs a session; a guest is sent to `/login` (M01 guard); endpoints answer 401 | — | Guest | INFERRED |
| FN-M16-1.2.2 | Role access: every logged-in role opens S1–S23, S25–S28 and the banner (OBSERVED for the admin; other roles INFERRED, provisional). `/tournament/admin/create` (S24), its POST and "Cipta Tournament Baru" on S23 are admin-only (INFERRED from the `/tournament/admin` prefix); `/admin/permainan` (S29) is admin-only; other roles on an admin-only route land on their M01 landing page and endpoints answer 403 `FORBIDDEN` | — | All | OBSERVED (admin) / INFERRED |
| FN-M16-1.2.3 | Not-found outcomes render the global 404 page of M01 ("404", "🔍", "Halaman Tidak Dijumpai", "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?", "Halaman Utama" → `/`, "Mula Latihan" → `/latih-tubi` as live, "PRESTASIPLUS"): `/battle/arena` (no uuid), `/battle/arena/{unknown uuid}`, `/battle/riwayat`, `/tournament/{unknown uuid}`, `/tournament/1`, `/tournament/admin`, `/tournament/create`, `/liga/1/edit`, `/admin/permainan/1`, `/admin/battle`, `/admin/tournament`, `/papan-bijak/{unknown code}` (OBSERVED); `/liga/sertai` (live GET 500) and `/permainan/roda-nasib/spin` (live GET 405) have no page in the SPA and also render the 404 page (DV-M16-33); unknown paths under `/permainan/*`, `/battle/*`, `/liga/*`, `/tournament/*` 404 (INFERRED) | — | All logged-in (OBSERVED admin) | OBSERVED + DV-M16-33 |
| FN-M16-1.2.4 | Query tolerance (OBSERVED): S2 ignores `?period=`; S3 `?period=` other than `weekly` / `monthly` / `all_time` shows all-time rows with no pill active (DV-M16-29, as live); S20 ignores `?week=`; the single-player games and Jutawan accept `?darjah=1…11` although the picker lists 1–4 (DV-M16-19); S28 `?week=YYYY-MM-DD` shows the week that contains the date (normalised to its Monday) and an invalid value is treated as absent (DV-M16-30) | — | All logged-in (OBSERVED admin) | OBSERVED + DV-M16-19/29/30 |

**FT-M16-1.3 — Tournament banner (global user-portal widget, owned by M16)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M16-1.3.1 | The banner is the first child of `<main>` on every user-portal page (every module, not only M16), mounted by the global user shell; on mount it calls `GET /api/tournament/active` once (no polling, no refresh), swallows every error, and renders nothing while the list is empty or failed (the observed state on live all day); it is absent from admin-panel pages and sits under the standalone game overlays. The hidden templates "LIVE:" (`fa-circle`), "MAIN" and "DAFTAR" exist on every user-portal page | S1-001–003; S2-001–003; S3-001–003; S4-001–003; S5-001–003; S6-001–003; S7-001–003; S8-001–003; S9-001–003; S10-001–003; S11-001–003; S12-001–003; S13-001–003; S14-001–003; S15-001–003; S16-001–003; S17-001–003; S18-001–003; S19-001–003; S20-001–003; S21-001–003; S23-001–003; S24-001–003; S25-001–003; S26-001–003; S27-001–003; S30-001–003, 005–007, 102–104, 106–108 | All logged-in (OBSERVED admin) | SOURCE / OBSERVED (empty) |
| FN-M16-1.3.2 | Registration item (`status` = `registration`, no live match): link `/tournament/{uuid}` (`block rounded-xl p-4 mb-2 shadow-sm`, hover `shadow-md`), indigo→purple gradient with `border-indigo-200`, round icon `bg-indigo-100` with `fa-trophy` (indigo-500), title `t.title` (`text-sm font-bold text-gray-800`), line "Pendaftaran dibuka" (`text-xs text-gray-500`) and the badge **"DAFTAR"** (`bg-indigo-600` white, `px-3 py-1 rounded-lg text-xs font-bold`); `live_match` takes precedence over `status` | S30-004 | All logged-in (OBSERVED admin) | SOURCE (placeholder data) |
| FN-M16-1.3.3 | Ongoing item (any other `status`, no live match): same indigo style and title, line **"Sedang berlangsung"**, no badge | S30-101 | All logged-in (OBSERVED admin) | SOURCE (placeholder data) |
| FN-M16-1.3.4 | Live-match item (`live_match` = `{school_a, school_b}`): red→orange gradient with `border-red-200`, icon `bg-red-100` `fa-broadcast-tower` (red-500), line (`text-red-600 font-bold`) with a 6 px pulsing `fa-circle` + **"LIVE: {school_a} vs {school_b}"**, badge **"MAIN"** (`bg-red-600`, white, `animate-pulse`) | S30-105 | All logged-in (OBSERVED admin) | SOURCE (placeholder data) |
| FN-M16-1.3.5 | Several active tournaments stack in API order (`:key` uuid); the data shape is `[{uuid, title, status, live_match: null \| {school_a, school_b}}]`; `active` = tournaments whose status is `registration` or `ongoing` (drafts and completed ones are never listed, INFERRED). The default seed has none (hidden, as live); the three item states come from test fixtures (provisional) | — | All logged-in (OBSERVED admin) | SOURCE / INFERRED |

**FT-M16-1.4 — Cross-cutting rules**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M16-1.4.1 | Readable text: every M16 text rendered below 12 px on live is raised to 12 px; nothing else changes (DV-M16-24). Measured on live (discovery §8.1 and audit sweep at 375): S6 badges 10.4 px; S7 labels "Subjek", "Tahap Soalan", "Siapa Boleh Join?", "Maks Pemain", "Padanan" 10 px, "(auto dari profil anda)" and "Tukar" 10 px, "Sistem cari pemain sepadan secara automatik" 10 px, initials circles 11.2 px, Top 10 header 10.4 px, Kadar pills 11.2 px; S13–S16 and S19 picker group label "🏫 Sekolah Rendah" 10.4 px; S15 "⚠ GARIS MAUT" 8.8 px; S19 "📚 PILIH SUBJEK" 10.4 px, "{n} soalan" 11.2 px; S27 chips 11.2 px, "Kod Jemputan" and the school sub-line 10 px; S28 "aktif" / "hari" / "per 10" 11.2 px; S29 stat labels 9 px at 375, "Tetapan papan permainan ular & tangga (50 petak)", "Permainan yang tersedia dalam sistem", suffix "petak" and help texts 10 px, bar label "{n} soalan" 9 px. Any other visible M16 text node below 12 px is raised as well | — | All logged-in (OBSERVED admin) | OBSERVED + DV-M16-24 |
| FN-M16-1.4.2 | Responsive: no horizontal page scroll at 320–1920 px; wide tables (S2, S3, S7 Top 10, S27 leaderboard) scroll inside their card below 768 px, no sticky column (S27 no longer clips, DV-M16-13); the S4 "Battle Terkini" list, which pushes the page to 392–416 px at 375 on live with long names, scrolls inside its card (NFR-RESP-05(b), DV-M16-37); S28 hides "Streak Avg" and "Nota/Pelajar" below 768 px (as live); per-screen rules in SRS §10 | — | All logged-in (OBSERVED admin) | OBSERVED + DV-M16-13 |
| FN-M16-1.4.3 | Privacy: every student, teacher and league-creator name on M16 screens (lobby "🏆 Pendahulu", Papan Bijak Top 10 and initials, Pertandingan ranking, Battle Terkini, Cabar Kawan results, incoming challenger, league creator) is a fictitious name from the M02 users dataset; the live names are never used (DV-M16-34). School names come from the M02 schools dataset | — | All logged-in (OBSERVED admin) | Privacy rule (CLAUDE.md §6) |
| FN-M16-1.4.4 | Simulation (decision D4): live has no WebSocket, SSE or Echo channel; every "realtime" behaviour is HTTP polling (3 s) or a page reload. The prototype keeps the polling contracts and simulates the other players with **bot opponents** from named PRNG streams (`m16:battle:<queueId>`, `m16:room:<code>`, `m16:spin:<userId>:<date>`), deterministic per id; every simulated behaviour is marked SIMULATION in the SRS and its assertions are provisional | — | System | Decision D4 |

### EP-M16-2 — Battle Arena (S1 `/battle`, S5 `/battle/history`, arena)


**FT-M16-2.1 — Lobby: hero, question type and topic selection**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M16-2.1.1 | Hero (red→orange gradient, `fa-bolt`): h2 "Battle Arena", badge "BARU", "Cabar kawan, cari lawan, atau wakili sekolah anda!" | S1-004–006 | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-2.1.2 | Question-type row: "Biasa" (`fa-book`; active = red→orange gradient) sets type `biasa` (default) and "PKSK" (`fa-shield-halved`; active = indigo→purple) sets type `pksk`; one flex row at every width | S1-007–009 | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-2.1.3 | SPM type for accounts below Tingkatan 4: "SPM" (`fa-graduation-cap` + `fa-lock`, `bg-gray-100 text-slate-400 cursor-not-allowed opacity-60`) never changes the type; a click toggles the dark tooltip (`fa-info-circle`) "Khas untuk pelajar Tingkatan 4 & 5 sahaja", which closes on a click outside | S1-010–011 | All logged-in (OBSERVED admin) | OBSERVED (Darjah 4 account) |
| FN-M16-2.1.4 | "Biasa" panel: "Subjek Teras" and 7 subject tiles (tinted square `{colour}20` with the icon, name) — Bahasa Melayu 1 `fa-book-open` #3B82F6, Bahasa Inggeris 2 `fa-globe` #8B5CF6, Matematik 3 `fa-calculator` #EF4444, Sains 4 `fa-flask` #10B981, Sejarah 5 `fa-clock` #F59E0B, Pendidikan Islam 6 `fa-moon` #059669, Pendidikan Moral 7 `fa-heart` #EC4899; toggle "Lagi 24 subjek lain" (`fa-chevron-down`) / "Tutup" (`fa-chevron-up`) shows ids 8–31 with the icons and colours of discovery A.1; a selected tile is `border-red-500 bg-red-50 shadow-md`; one subject at a time; tiles 2 columns below 640 px, 3 at `sm`, 4 at `md`+ | S1-012–044, 119 | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-2.1.5 | "PKSK" panel: "Pilih Domain PKSK" with the 15 M07 domain tiles (icon, colour, name of discovery A.2; selected = `bg-indigo-500 text-white`) and "Pilih Tahap" with two level buttons (`fa-seedling` → `T1`, `fa-tree` → `T4`) labelled **"Tingkatan 1"** and **"Tingkatan 4"** (live "Tahap 1 (Darjah 1-3)" / "Tahap 4 (Darjah 4-6)" contradict the M07 PKSK levels, DV-M16-31) | S1-045–063 | All logged-in (OBSERVED admin) | OBSERVED + DV-M16-31 |
| FN-M16-2.1.6 | `canStart`: `biasa` → a subject is selected; `pksk` → a domain **and** a level are selected; `spm` → an SPM subject is selected. Match parameters: `{question_type, open_to_all, subject_id}` or `{question_type, open_to_all, pksk_domain_id, pksk_target_level}` | — | All logged-in (OBSERVED admin) | SOURCE |
| FN-M16-2.1.7 | SPM type for Tingkatan 4 and 5 accounts (grade 10–11; e.g. `pelajar@demo.test`): "SPM" is enabled (no lock) and sets type `spm`; its panel lists the SPM subjects that have questions in the M04 SPM pool (Q-SPM-POOL > 0) as tiles in the "Biasa" tile style and sets `selectedSpmSubject`. The unlocked variant exists in the page script but was never rendered (Q-M16-3): layout PROPOSED, provisional | — | Pelajar T4/T5 | SOURCE-DERIVED / PROPOSED |
| FN-M16-2.1.8 | Links "Ranking Pelajar" (`fa-medal`) → `/battle/leaderboard` and "Ranking Sekolah" (`fa-school`) → `/battle/ranking-sekolah` (2 columns at every width) | S1-095–096 | All logged-in (OBSERVED admin) | OBSERVED |

**FT-M16-2.2 — Matchmaking: visibility, modes, search and polling**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M16-2.2.1 | "Keterlihatan Barisan" card (`fa-globe`, shown while not searching and not waiting): subtitle "Hanya pelajar gred sama boleh match" / "Semua gred boleh nampak & mohon sertai anda" and a switch (`x-model` `openToAll`, sr-only checkbox) labelled "Gred Saya" (slate) / "Terbuka" (blue) | S1-084–088, 120–121 | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-2.2.2 | Mode buttons (1 column below `md`, 3 at `md`+; `opacity-50` while disabled): "Quick Match" / "Cari lawan rawak dari darjah yang sama" (`fa-bolt`) → `POST /api/battle/quick-match`; "Cabar Kawan" / "Hantar cabaran kepada rakan anda" (`fa-user-group`) opens the Cabar Kawan modal; "Battle Sekolah" / "Lawan pelajar dari sekolah lain!" (`fa-school`) → `POST /api/battle/school-battle`. All three are disabled until `canStart`; Quick Match and Battle Sekolah also while a request is running (the live `loading` flag stays true for the whole search until `cancelSearch()`, discovery §S1.9, so they stay disabled while searching) | S1-089–094 | All logged-in (OBSERVED admin) | OBSERVED / SOURCE |
| FN-M16-2.2.3 | Searching card (while `searching`): spinner, h3 "Mencari Lawan...", "Menunggu pelajar sama darjah & subjek" (or "Menunggu pelajar dari mana-mana gred" when Terbuka), the elapsed time `m:ss`, and "Batal" (`fa-times`), which only resets the page state — no request is sent and the server queue is left to expire (DV-M16-05, as live) | S1-065–074 | All logged-in (OBSERVED admin) | OBSERVED / SOURCE |
| FN-M16-2.2.4 | Polling contract (SOURCE): a start response `{matched: true, battle_uuid}` goes straight to the arena; `{queue_id}` starts polling `GET /api/battle/poll-match/{queueId}` every **3 s**; the timer text changes only on each poll (0:00 → 0:03 → …); status `matched` + `battle_uuid` → arena; `incoming_challenge` → the incoming card while polling continues; `expired` or `not_found` → "Tiada lawan dijumpai. Sila cuba lagi."; after **120 s** → "Tiada lawan dijumpai dalam masa 2 minit. Sila cuba lagi."; **5 consecutive** failed polls → "Ralat berulang semasa mencari lawan. Sila cuba lagi." (non-OK) or "Ralat rangkaian berulang. Sila semak internet anda." (network); a missing queue id → "Ralat sistem: ID giliran tidak sah. Sila cuba lagi." | — | All logged-in (OBSERVED admin) | SOURCE |
| FN-M16-2.2.5 | Error banner (`errorMsg`): the message and a close button (`fa-times`) that clears it; start failures show `data.error` or `data.message`, else "Ralat dari server. Sila cuba lagi."; an unexpected body → "Respon tidak dijangka. Sila cuba lagi."; a network failure → "Ralat rangkaian. Sila semak internet anda." | S1-064, 110 | All logged-in (OBSERVED admin) | SOURCE |
| FN-M16-2.2.6 | Match redirect: on `matched` the page goes to `/battle/arena/{battle_uuid}` | — | All logged-in (OBSERVED admin) | SOURCE |
| FN-M16-2.2.7 | Simulated matchmaking (SIMULATION, D4): a queue is matched with a bot opponent on the **3rd poll** by default (about 9 s); the bot is a fictitious student of the same grade (or any grade when Terbuka) and, for Battle Sekolah, of another school; the question grade is the queue owner's; test hooks force `incoming_challenge`, `expired`, `not_found`, errors or no match (to reach 120 s); an abandoned queue (no poll for 10 s) is never matched and expires | — | System | SIMULATION (PROPOSED parameters) |

**FT-M16-2.3 — Incoming challenger and waiting for approval**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M16-2.3.1 | Incoming challenger (status `incoming_challenge` with `challenger {name, grade_label, school}`): the searching card becomes h3 "Cabaran Masuk!", "{name} ingin menyertai battle anda", chips grade label and school, "Soalan mengikut gred anda. Lawan akan bermain soalan gred anda." (`fa-info-circle`), "Terima" (`fa-check`) → `POST /api/battle/accept-challenger/{queueId}` → arena on `{matched, battle_uuid}`; "Tolak" (`fa-times`) → `POST /api/battle/reject-challenger/{queueId}` and polling continues. A `data.error` answer clears the incoming card and shows `data.error` in the error banner; a network failure shows the banner "Ralat rangkaian." (SOURCE `respondChallenger`) | S1-075–079, 111–118 | All logged-in (OBSERVED admin) | SOURCE (placeholder data) |
| FN-M16-2.3.2 | Waiting card (`challengerWaiting`): h3 "Menunggu Kelulusan...", "Menunggu {name} menerima permohonan anda", the grade line and "Batal" (discards the target). It follows `POST /api/battle/join-queue/{queueId}` and polls `GET /api/battle/poll-challenger/{queueId}` every 3 s: `matched` → arena; `rejected` → "{name} menolak permohonan anda."; `expired` / `not_found` → "Pemain sudah keluar dari barisan."; failures "Ralat menghantar permohonan." / "Ralat rangkaian. Sila cuba lagi.". **No control calls `requestJoinQueue` on live**, so the card is unreachable from the UI; the rebuild keeps it unreachable (DV-M16-06) and reaches it only through a test hook (provisional) | S1-080–083, 122–123 | All logged-in (OBSERVED admin) | SOURCE + DV-M16-06 |

**FT-M16-2.4 — Cabar Kawan (send a challenge) and Cabaran Masuk (received challenges)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M16-2.4.1 | Cabar Kawan modal (`fa-user-group` title, close `fa-times`, overlay click closes): input "Cari nama pelajar..." (debounce 300 ms; request only from 2 characters) → `GET /api/battle/search-opponent?q=` → `{users:[{id, name, school, avatar}]}`; each result is a row with avatar, name, school and `fa-paper-plane`; "Tiada pelajar dijumpai" when the query has ≥ 2 characters and no result | S1-097–103 | All logged-in (OBSERVED admin) | OBSERVED / SOURCE |
| FN-M16-2.4.2 | Send a challenge: a click on a result posts `POST /api/battle/invite` with the match parameters and `receiver_id`; the modal closes, and on `{success: true}` a native alert "Cabaran berjaya dihantar kepada {name}!" follows; a non-success answer does nothing more; a network failure alerts "Ralat menghantar cabaran." (SOURCE `sendChallenge`) | — | All logged-in (OBSERVED admin) | SOURCE |
| FN-M16-2.4.3 | Cabaran Masuk modal (`fa-envelope` title, close, overlay click closes): rows of sender name, sender school and "Terima" / "Tolak"; empty text "Tiada cabaran buat masa ini". The page loads `GET /api/battle/invitations` → `{invitations:[…]}` on every visit (as live); live has **no control that opens the modal** — the rebuild opens it automatically when the list is not empty (DV-M16-06); with an empty list it stays closed | S1-104–109 | All logged-in (OBSERVED admin) | OBSERVED + DV-M16-06 |
| FN-M16-2.4.4 | Answer an invitation: "Terima" → `POST /api/battle/invite/{uuid}/accept` → on `{success, battle_uuid}` the arena; a non-success answer does nothing; a network failure alerts "Ralat." (SOURCE `acceptInvitation`). "Tolak" → `POST /api/battle/invite/{uuid}/decline`; the row leaves the list only after the request completes; failures are silent (SOURCE `declineInvitation`) | — | All logged-in (OBSERVED admin) | SOURCE |

**FT-M16-2.5 — Arena `/battle/arena/{uuid}` (provisional, not observable on live)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M16-2.5.1 | The arena route exists only for a battle of the viewer; any other uuid renders the M01 404 page (OBSERVED for unknown uuids). Its content was never observable (Q-M16-1); the rebuild renders a **PROPOSED** arena built from observed parts: both players (name, school), "Skor" per player, "Soalan {n}/{total}", the question card and options "A. …"–"D. …" of Cabaran Kilat, a per-question countdown, the per-answer feedback "Lawan: betul" / "Lawan: salah" and "+{points}" (PROPOSED COPY, M16-T3 G4 2026-10-09) | — | All logged-in (OBSERVED admin) | OBSERVED (404) / PROPOSED |
| FN-M16-2.5.2 | Arena rules (INFERRED / PROPOSED, provisional): 10 questions from M04 (subject or PKSK domain and level, grade of the queue owner); each question 15 s; a correct answer scores 1000 − round(500 × seconds used ÷ 15) (500–1,000; fits every observed battle score 0–9,780 and the single-answer scores 800–966); wrong or no answer 0; the higher total wins; equal non-zero totals are a draw ("seri", observed 8830–8830); **0–0 is a win for player B** (INFERRED: the only rule under which the observed standings follow from the observed battles, DV-M16-35) | — | All logged-in (OBSERVED admin) | INFERRED / PROPOSED |
| FN-M16-2.5.3 | Bot opponent (SIMULATION): answers each question after 2–12 s and correctly with probability p = the M05 platform accuracy Q-ANS-CORRECT ÷ Q-ANS-ALL, read from the M05 named queries when the mock starts (82.84 % with M05 v1.10: 396,391 ÷ 478,499; never hard-coded), from the stream `m16:battle:<uuid>`; the bot score is revealed with the viewer's answer | — | System | SIMULATION |
| FN-M16-2.5.4 | Forfeit: `confirm("Tamatkan battle ini? Anda akan dikira kalah.")` → `POST /api/battle/forfeit/{uuid}` → the page reloads after any response (a `data.error` is ignored); a network failure alerts "Ralat. Sila cuba lagi." (SOURCE `forfeitBattle`; the arena button itself is PROPOSED "Tamatkan") | — | All logged-in (OBSERVED admin) | SOURCE / PROPOSED |
| FN-M16-2.5.5 | Result (PROPOSED): title "Menang", "Seri" or "Kalah" (the live words of "Menang/Seri/Kalah"), both scores, links "Mula Battle" → `/battle` and "Sejarah Battle" → `/battle/history`; the finished battle is written to the battle records (S4 "Battle Terkini", S5, M11 activity) and to the student and school standings of the week, month and all time (SRS BR-M16-12); the result is reported to M14 (FN-M16-12.1.1) | — | All logged-in (OBSERVED admin) | PROPOSED |

**FT-M16-2.6 — Battle history S5 `/battle/history`**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M16-2.6.1 | Empty state (no battle of the viewer): card `fa-bolt`, h3 "Tiada sejarah battle", "Mulakan pertandingan pertama anda sekarang!", link "Mula Battle" (`fa-bolt`) → `/battle`. The route has no menu entry or link on live (reached by URL, as live) | S5-004–007 | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-2.6.2 | Populated list (not observable, Q-M16-9): one row per finished battle of the viewer, newest first, in the S4 "Battle Terkini" row format (players, scores, winner green, relative time) — PROPOSED, provisional | — | All logged-in (OBSERVED admin) | PROPOSED |

### EP-M16-3 — Battle rankings (S2, S3, S4)


**FT-M16-3.1 — Student battle ranking S2 `/battle/leaderboard`**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M16-3.1.1 | Period pills "Mingguan" (default; active `bg-red-500 text-white`) and "Bulanan". Live pills only restyle and the table never changes (D-M16-4); the rebuild shows the weekly or monthly student standings for the active pill (DV-M16-04), computed from the battle records (DV-M16-26). No URL parameter (live ignores `?period=`) | S2-004–005 | All logged-in (OBSERVED admin) | OBSERVED + DV-M16-04 |
| FN-M16-3.1.2 | Table "#", "Pelajar", "Sekolah", "M/S/K", "Ketepatan", "Streak", "Skor" (scrolls in its card below 768 px); empty row (`colspan=7`) "Belum ada data ranking. Mula battle untuk muncul di sini!" — the weekly period is empty in the seed (as live) | S2-006–007 | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-3.1.3 | Rows from the battle records of the period (one row per student who battled): rank, name, school at battle time, "m/s/k" (counted from the records with the 0–0 rule of DV-M16-35), "{n}%", streak (consecutive wins, INFERRED), score (PROPOSED); order by score desc (INFERRED). Seed: the monthly period lists 4316 and 4317 (2/0/2 each, from the four September battles of 8082); ketepatan, streak and score are PROPOSED — provisional | — | All logged-in (OBSERVED admin) | INFERRED / PROPOSED |

**FT-M16-3.2 — School ranking S3 `/battle/ranking-sekolah`**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M16-3.2.1 | Hero `fa-school`: h2 "Papan Ranking Sekolah", "Sekolah mana paling hebat? Wakili sekolah anda!" | S3-004–005 | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-3.2.2 | Period links (GET): "Mingguan" `?period=weekly` (default), "Bulanan" `?period=monthly`, "Sepanjang Masa" `?period=all_time`; each keeps the selected state (`&state=`); the active one is `bg-blue-500 text-white` | S3-006–009, 033–035 | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-3.2.3 | State select: "Semua Negeri" + 16 states (Johor … Terengganu, discovery A.4), preloaded from the query; `onchange` → `?period={current}&state={value}` | S3-010 | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-3.2.4 | Podium (only when rows exist; `grid-cols-3` at every width, order 2nd–1st–3rd, `fa-crown` on the raised centre column): school name, state, "{skor}" "mata". The podium shows table rows 1–3 (on live a tie put 8082 on the podium and 8078 at #3, DV-M16-09) | S3-014–029 | All logged-in (OBSERVED admin) | OBSERVED + DV-M16-09 |
| FN-M16-3.2.5 | "Senarai Penuh" (`fa-list-ol`) table "#", "Sekolah", "Battle", "M/S/K", "Ketepatan", "Pelajar", "Skor" (scrolls in its card below 768 px); the school cell links to `/battle/ranking-sekolah/{id}` with the name and "{negeri} · {SK\|SMK}"; M/S/K is three spans "m/s/k"; order by Skor desc (ties: stored order); empty row (`colspan=7`) "Belum ada data ranking. Mula battle untuk melihat ranking sekolah!". "Battle", "M/S/K" and "Pelajar" are **computed from the battle records** (one side per school player at battle time, 0–0 = win for B; D11); "Ketepatan" and "Skor" are stored job figures (DC-M16-03). At the clock: weekly empty, monthly 1 school, all time 7 schools, equal to live except 8082 all time (DV-M16-36) | S3-011–013, 030–032, 036–037 | All logged-in (OBSERVED admin) | OBSERVED |

**FT-M16-3.3 — School detail S4 `/battle/ranking-sekolah/{id}`**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M16-3.3.1 | Hero `fa-school`: h2 school name, "PPD {daerah} · {negeri} · {SK\|SMK}"; every school of the M02 register renders (a school without battles shows zeros and empty states) | S4-004–005, 031 | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-3.3.2 | Four cards (`fa-bolt` red, `fa-trophy` amber, `fa-percentage` green, `fa-users` purple): "Jumlah Battle", "Kemenangan", "Ketepatan" ("{n}%"), "Pelajar Aktif" — the school's all-time battles, wins and distinct pupils computed from the battle records, and the stored all-time "Ketepatan" (DC-M16-03) (8106: 19 / 12 / 69% / 7; 8880: 3 / 2 / 33% / 1; 900: 0 / 0 / 0% / 0); 2 columns below `md`, 4 at `md`+ | S4-006–017, 032–036, 047–051 | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-3.3.3 | "Minggu Ini" (`fa-calendar-week`) and "Bulan Ini" (`fa-calendar`) boxes: "Ranking Nasional" "#n", "Battle", "Menang/Seri/Kalah" "m/s/k", "Skor"; they read the same weekly and monthly standings as S3, and "#n" is the school's position in that S3 list (live shows stale figures and several "#1", D-M16-10/11 → DV-M16-10); no standing → "Tiada data minggu ini" / "Tiada data bulan ini"; stacked below `md` | S4-018–025, 037–038 | All logged-in (OBSERVED admin) | OBSERVED + DV-M16-10 |
| FN-M16-3.3.4 | "Pejuang Terbaik Minggu Ini" (`fa-medal`): the school's pupils in the weekly student standings (top 5, INFERRED); empty "Tiada data pejuang minggu ini" (every school in the seed, as live) | S4-026–028 | All logged-in (OBSERVED admin) | OBSERVED / INFERRED |
| FN-M16-3.3.5 | "Battle Terkini" (`fa-history`): up to 10 battles of the school, newest first: player A (`text-slate-700` when A's current school is this school, else `text-blue-600`), score A, "vs", score B, player B (`text-blue-600`), relative time ("2 bulan yang lepas"); the winner's score is `text-green-600` — on a 0–0 battle player B's score (live colours by score only, so a 0–0 row shows no winner while the standings count it as B's win; DV-M16-35); a non-zero tie colours neither; empty "Tiada battle terkini"; the list scrolls inside its card at 375 px (DV-M16-37) | S4-029–030, 039 | All logged-in (OBSERVED admin) | OBSERVED / INFERRED (colour rule) |
| FN-M16-3.3.6 | An id that is not an M02 school → the M01 404 page (OBSERVED for 99999999) | S4-040–046 | All logged-in (OBSERVED admin) | OBSERVED |

### EP-M16-4 — Games hub S6 `/permainan`


**FT-M16-4.1 — Hub header, open rooms and game cards**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M16-4.1.1 | h1 "🎮 Zona Permainan" and "Main sambil belajar! Kumpul Syiling, naik ranking, dan jadi champion sekolah. Pilih permainan kegemaran kamu." (copy kept as live, DV-M16-23) | S6-004–005; S30-008–009 | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-4.1.2 | Open-rooms strip: with no waiting room "🌙", "Tiada bilik terbuka buat masa ini.", "Cipta bilik permainan dan jemput rakan-rakan!" (the seed state, as live); with waiting rooms (Q-OPEN-ROOMS > 0) one chip per room with the game emoji, name and code linking to the room (PROPOSED layout, provisional; Q-M16-11) | S6-006–008; S30-010–012 | All logged-in (OBSERVED admin) | OBSERVED / PROPOSED |
| FN-M16-4.1.3 | Card grid (1 / 2 / 3 columns): 18 cards in live order (17 games + the Peta Pengembaraan card); the whole card is clickable (`onclick`) and its button is a link to the same route; each card has an optional badge (with its own colours on the "BARU!"/"HOT!" badges), a banner emoji, h3, text, 1–2 chips and the button (discovery A.3) | — | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-4.1.4 | Cards 1–2: "🎲 Papan Bijak" "Board game matematik! Gulung dadu, jawab soalan, dan lumba ke garisan penamat bersama kawan." with the chip "🆕 Belum main lagi" only while the viewer has no Papan Bijak game (the admin has 6 → no chip, DV-M16-14) and `fa-play` "Main Sekarang" → `/papan-bijak`; "🔥 HOT" "⚔️ Battle Arena" "Duel 1-lawan-1 dengan pelajar lain! Siapa jawab betul dan cepat, dialah juara." with "🆕 Belum battle lagi" while the viewer has no battle and `fa-bolt` "Battle!" → `/battle` | S6-009–017; S30-013–021 | All logged-in (OBSERVED admin) | OBSERVED + DV-M16-14 |
| FN-M16-4.1.5 | Multiplayer cards (badge "👥 MULTIPLAYER"): "⚔️ Perang Fakta" "Betul atau Salah? Vote bersama 2-6 pemain! 15 pusingan, 10 saat setiap pernyataan." chips "👥 2-6 Pemain", "⚡ 10 Saat", `fa-fist-raised` "Main!"; "🏰 Benteng Ilmu" "Duel 1v1! Serang benteng lawan dengan kuasa ilmu. Jawab betul = serang, salah = rosak sendiri!" "🏰 HP 100", "⚡ Special Effect", `fa-shield-alt` "Duel!"; "🏎️ Perlumbaan Matematik" "Lumba ke garisan penamat! Jawab betul = maju 1 langkah. Siapa sampai 20 dulu menang!" "🏎️ 2-4 Pemain", "🏁 20 Langkah", `fa-flag-checkered` "Lumba!"; "🏃 Kuiz Relay" "Berpasukan! 2 pasukan jawab bergilir-gilir. Bonus kelajuan, pasukan terbaik menang!" "👥 4-8 Pemain", "🏆 2 Pasukan", `fa-users` "Main!"; "📝 Teka Silang Kata" "Isi silang kata lawan masa! 2 pemain, 5 minit, siapa isi paling banyak menang!" "📝 2 Pemain", "⏱️ 5 Minit", `fa-pencil-alt` "Main!" → their lobbies | S6-018–042; S30-022–046 | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-4.1.6 | Cards "✅❌ BARU!" (#ede9fe / #5b21b6) "✅ Betul atau Salah" "Kenyataan keluar laju — tekan Betul atau Salah dalam 45 saat! Bina kombo untuk bonus!" "⏱️ 45 Saat", "🔥 Kombo", `fa-check-circle` "Mula"; "📅 HARIAN" "🎯 Roda Nasib" "Pusing roda setiap hari untuk dapat ganjaran misteri — Syiling, bonus XP, atau cabaran khas!" "🎁 Hadiah Harian", "1x / hari", `fa-circle-notch` "Spin Sekarang!" (copy as live, DV-M16-22); "📅 MINGGUAN" "🏆 Pertandingan Mingguan" "Lumba dengan semua pelajar setiap minggu! Top 3 dapat Syiling bonus dan badge istimewa." "📊 Ranking Live", "🥇 Hadiah Top 3", `fa-trophy` "Lihat Ranking" | S6-043–057; S30-047–061 | All logged-in (OBSERVED admin) | OBSERVED + DV-M16-22 |
| FN-M16-4.1.7 | Card "🗺️ Peta Pengembaraan" "Jelajah dunia matematik! Selesaikan misi di setiap checkpoint untuk unlock kawasan baru." "🌍 Jelajah Dunia", "📈 Progress", `fa-map-marked-alt` "Jelajah" → `/peta-belajar` (M03 screen) | S6-058–061; S30-062–065 | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-4.1.8 | Card "👨‍👩‍👧 IBU BAPA" "🧠 Uji Minda" "Cabaran khas dari ibu/bapa kamu! Jawab soalan, kumpul mata, dan tebus hadiah istimewa." "🎁 Hadiah Custom", "⏳ Menunggu Ibu Bapa", `fa-brain` "Mula" → `/permainan/uji-minda` | S6-062–066; S30-066–070 | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-4.1.9 | Cards "⚡ BARU!" (#e0f2fe / #0369a1) "⚡ Cabaran Kilat" "60 saat! Jawab laju, bina combo, pecah rekod! Makin panjang kombo, makin banyak Syiling." "⏱️ 60 Saat", "🔥 Combo", `fa-bolt` "Mula!"; "💰 BARU!" (#fef3c7 / #92400e) "💰 Jutawan Ilmu" "Pilih subjek, jawab 15 soalan makin susah — menang sehingga 1,000 Syiling! 3 lifeline disediakan." "📚 Semua Subjek", "🏆 1000🪙", `fa-crown` "Main!"; "🧩 BARU!" (#ccfbf1 / #0f766e) "🧩 Susun Jawapan" "Huruf/perkataan bercampur aduk — susun semula untuk bentuk jawapan yang betul!" "🔤 Susun", "🧠 Logik", `fa-puzzle-piece` "Susun!"; "🎯 BARU!" (#fff7ed / #9a3412) "🎯 Tembak Jawapan" "Jawapan jatuh dari atas — tap yang betul sebelum sampai bawah! Makin laju setiap level!" "❤️ 3 Nyawa", "⚡ Speed Up", `fa-crosshairs` "Tembak!" | S6-067–086; S30-071–090 | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-4.1.10 | Card "🔗 BARU!" (#d1fae5 / #065f46) "🔗 Sambung Kata" "Taip perkataan bermula huruf terakhir! Bina rantaian paling panjang sebelum masa habis." "⌨️ Taip Laju", "🔗 Chain", `fa-link` "Mula!" → `/permainan/sambung-kata` (handled error page, DV-M16-03) | S6-087–091; S30-091–095 | All logged-in (OBSERVED admin) | OBSERVED + DV-M16-03 |
| FN-M16-4.1.11 | Card "🧠 HOT!" (#f3e8ff / #6b21a8) "🃏 Kad Memori" "Padankan soalan dengan jawapan yang betul! Cari semua pasangan kad sebelum masa habis." "🃏 6 Pasangan", "🧠 Ingatan", `fa-brain` "Main!" → `/permainan/kad-memori` (copy as live, DV-M16-21) | S6-092–096; S30-096–100 | All logged-in (OBSERVED admin) | OBSERVED + DV-M16-21 |

### EP-M16-5 — Multiplayer lobbies and rooms (S7–S12)


**FT-M16-5.1 — Papan Bijak lobby S7 `/papan-bijak`: create and join**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M16-5.1.1 | Hero h1 "🎲 Papan Bijak", "Board game quiz multiplayer — jemput kawan, gulung dadu, jawab soalan! 🐍🪜" | S7-004–005 | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-5.1.2 | "🆕 Cipta Bilik Baru" form `POST /papan-bijak/create`: "Subjek" `subject` (🔢 Matematik `MATEMATIK`, 📝 Bahasa Melayu `BAHASA_MELAYU`, 🔬 Sains `SAINS`, 🇬🇧 Bahasa Inggeris `BAHASA_INGGERIS`); "Tahap Soalan": the auto box "{grade}" + "(auto dari profil anda)" + "Tukar" (hidden `grade_level` from the profile, e.g. `DARJAH_4`); "Tukar" shows the select `grade_level` (optgroups "Sekolah Rendah" Darjah 1–6, "Sekolah Menengah" Tingkatan 1–5, the profile grade preselected) and "← Guna auto" returns to the auto box. An account without a grade starts in the select (INFERRED) | S7-006–019 | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-5.1.3 | "Siapa Boleh Join?" `match_mode`: "Tahap sama sahaja" `same_grade`, `same_level` labelled "Semua Darjah (1-6)" or "Semua Tingkatan (1-5)" by the chosen grade (fallback "Semua Darjah/Tingkatan"), "Pilih julat khas" `custom`; `custom` shows "Dari" `grade_min` / "Hingga" `grade_max` (D1–D6 = 1–6, T1–T5 = 7–11; default D1 / D6); "Maks Pemain" `max_players` "2 Pemain"…"6 Pemain" (default 4); submit "🎲 Cipta Bilik" → the new room (FN-M16-5.5.1) | S7-020–028 | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-5.1.4 | "🔑 Masuk Bilik" form `POST /papan-bijak/join`: "Kod Bilik (6 aksara)" `room_code` (`maxlength=6`, placeholder "ABC123", **required** — native bubble when empty), "🚀 Masuk Bilik"; a known joinable code → the room; an unknown code → the lobby with the flash "Bilik tidak dijumpai." at the top (INFERRED, as S8–S12; provisional) | S7-029–035 | All logged-in (OBSERVED admin) | OBSERVED / INFERRED |
| FN-M16-5.1.5 | "Cara Bermain:" "🎲 1. Gulung dadu dan bergerak di papan", "📝 2. Jatuh di petak kuiz — jawab soalan!", "🪜 3. Naik tangga untuk shortcut", "🐍 4. Elak ular yang menarik turun", "🏆 5. Sampai petak 50 dulu = MENANG!" | S7-036–041 | All logged-in (OBSERVED admin) | OBSERVED |

**FT-M16-5.2 — Papan Bijak "Cari Lawan Auto" (quick match)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M16-5.2.1 | Panel "🔍" h2 "Cari Lawan Auto" "Sistem cari pemain sepadan secara automatik": selects "Subjek" (the 4 subjects without emoji) and "Padanan" ("Tahap sama" / "Semua darjah/tingkatan"), button "🔍 Cari Lawan Sekarang" → `POST /papan-bijak/quick-match {subject, match_mode}` | S7-042–049 | All logged-in (OBSERVED admin) | OBSERVED / SOURCE |
| FN-M16-5.2.2 | Searching state: spinner, "Mencari lawan... {n}s" (elapsed +1 s every second), "Sila tunggu, sistem sedang mencari pemain sepadan", "Batal Carian" → `POST /papan-bijak/quick-match/cancel` → idle; polling `GET /papan-bijak/quick-match/poll` every 3 s: `matched` + `room_code` → `/papan-bijak/{room_code}`; `expired` → error "Tiada lawan dijumpai. Cuba lagi!"; `cancelled` → idle; no client timeout. A start answer with `data.error` shows it on the error line; a network failure shows "Ralat rangkaian. Sila cuba lagi." (SOURCE `startSearch`). SIMULATION: a bot room is found on the 3rd poll by default; the server expires a search after 120 s (INFERRED, PROPOSED value) | S7-050–054, 057, 059 | All logged-in (OBSERVED admin) | SOURCE / SIMULATION |
| FN-M16-5.2.3 | Error line (red text): live puts it inside the searching block that every error path hides, so it is never visible (D-M16-21); the rebuild shows the last error below "🔍 Cari Lawan Sekarang" until the next search starts (DV-M16-20) | S7-058 | All logged-in (OBSERVED admin) | OBSERVED + DV-M16-20 |

**FT-M16-5.3 — Papan Bijak "🏆 Papan Markah — Top 10 Juara"**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M16-5.3.1 | Table "#", "Pemain", "🏆 Menang", "🎮 Jumlah", "📊 Kadar", "⭐ Skor", "✅ Betul" (scrolls in its card below 768 px): rows 1–3 🥇🥈🥉 with gold / silver / bronze styling (🥇 `#FEF3C7→#FDE68A`, border `#FBBF24`), an initials circle and the name truncated to 15 characters + "..."; Kadar = round(Menang ÷ Jumlah × 100) "%" in a pill — green `#D1FAE5/#065F46` at ≥ 70 %, amber `#FEF3C7/#92400E` at 40–69 %, red `#FEE2E2/#991B1B` below 40 % (thresholds INFERRED from 10/10 observed rows); order Menang desc, then Skor desc; top 10; the seed holds the 10 observed rows (the admin #1: 4 / 6 / 67% / 90 / 13) | S7-055–056 | All logged-in (OBSERVED admin) | OBSERVED / INFERRED (thresholds) |

**FT-M16-5.4 — Lobbies S8–S12 (one template)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M16-5.4.1 | Hero per game: S8 "⚔️ Perang Fakta" "Betul atau Salah? Vote & buktikan pengetahuan kamu!" "2-6 pemain · 15 pusingan · 10 saat setiap soalan"; S9 "🏰 Benteng Ilmu" "Serang benteng lawan dengan kuasa ilmu! Jawab betul = serang, jawab salah = rosak sendiri!" "2 pemain · HP 100 · Giliran bertukar"; S10 "🏎️ Perlumbaan Matematik" "Jawab soalan, lari ke garisan penamat! Siapa paling pantas menang!" "2-4 pemain · 20 langkah · Siapa sampai dulu menang"; S11 "🏃‍♂️ Kuiz Relay" "Berpasukan! Jawab soalan secara bergilir-gilir. Pasukan terbaik menang!" "4-8 pemain · 2 pasukan · 10 pusingan"; S12 "📝 Teka Silang Kata" "Isi silang kata paling pantas! Lawan masa dan lawan untuk markah tertinggi!" "2 pemain · 5 minit · Markah tertinggi menang" | S8-004–006; S9-004–006; S10-004–006; S11-004–006; S12-004–006 | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-5.4.2 | "🏠 Cipta Bilik Baru" form `POST /{game}/create`: "Subjek" `subject` (Matematik, Bahasa Melayu, Bahasa Inggeris, Sains, Sejarah); "Tahap": "{grade} (auto)" + "Tukar" (one-way: shows the select `grade_level` Darjah 1–6 / Tingkatan 1–5 with the profile grade preselected; no way back, as live); "Siapa boleh join?" `match_mode` "Tahap sama sahaja" `same_grade` / "Semua Darjah / Semua Tingkatan" `same_level`; submit "{emoji} Cipta Bilik" (⚔️ / 🏰 / 🏎️ / 🏃‍♂️ / 📝) → the new room | S8-007–020; S9-007–020; S10-007–020; S11-007–020; S12-007–020 | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-5.4.3 | "🔑 Masuk Dengan Kod" form `POST /{game}/join`: `room_code` (`maxlength=6`, placeholder "Contoh: ABC123", shown upper case by CSS, **not** required), "Masuk"; a known joinable code → the room; unknown or empty → the lobby with the flash "Bilik tidak dijumpai." (INFERRED from the GET redirect; provisional) | S8-021–026; S9-021–026; S10-021–026; S11-021–026; S12-021–026 | All logged-in (OBSERVED admin) | OBSERVED / INFERRED |
| FN-M16-5.4.4 | "🏆 Pendahulu": up to 10 rows "🥇 / 🥈 / 🥉 / {n}. {name}" + value "{n} menang" (S11 "{n} kali MVP"); order value desc, ties in a stable seed order (live reorders ties per request, DV-M16-08); seed = the observed rows (S8 10, S9 8, S10 10, S11 1, S12 6) | S8-027–036; S9-027–036; S10-027–036; S11-027–030; S12-027–036 | All logged-in (OBSERVED admin) | OBSERVED + DV-M16-08 |
| FN-M16-5.4.5 | Room not found: `GET /{game}/{unknown code}` redirects to the lobby with the red flash "Bilik tidak dijumpai." (`bg-red-50 border-red-200 text-red-700`); live renders it at the bottom of the page, off-screen on arrival (D-M16-7); the rebuild renders it at the top of the lobby content (DV-M16-07). `/papan-bijak/{unknown code}` stays a 404 page (as live) | S8-037; S9-037; S10-037; S11-031; S12-037 | All logged-in (OBSERVED admin) | OBSERVED + DV-M16-07 |

**FT-M16-5.5 — Rooms `/{game}/{code}` (provisional, not observable on live)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M16-5.5.1 | Create and join: create stores a room `{code (6 characters A–Z 0–9, unique), game, subject, grade_level, match_mode, grade_min/max, max_players, host}` in status `waiting` and opens `/{game}/{code}`; join adds the viewer when the room is `waiting`, not full and the viewer's grade fits `match_mode` (INFERRED); a full or started room → the lobby flash "Bilik tidak dijumpai." (INFERRED, provisional) | — | All logged-in (OBSERVED admin) | INFERRED / PROPOSED |
| FN-M16-5.5.2 | Waiting room (PROPOSED, provisional): room code, game title, the players with their grade, the host's start button (PROPOSED "Mula") enabled at the game's minimum players; bots (SIMULATION) join one per poll up to the minimum; the page polls the room every 3 s (the only realtime pattern observed on live) | — | All logged-in (OBSERVED admin) | PROPOSED / SIMULATION |
| FN-M16-5.5.3 | Game rules from the live copy (SOURCE of the lobby lines and cards; everything else INFERRED): Papan Bijak — a 50-tile board (start, finish, 3 ladders, 3 snakes, 2 bonus, 2 traps, `boardgame_quiz_tiles` quiz tiles, the rest plain), 2–6 players, dice 1–6, a quiz tile asks one M04 question, first to tile 50 wins; Perang Fakta — 2–6 players, 15 rounds of one true/false statement, 10 s each, correct vote +1, most points wins; Benteng Ilmu — 2 players, HP 100 each, turns alternate, a correct answer damages the opponent and a wrong one damages oneself (20 HP each, PROPOSED); Perlumbaan Matematik — 2–4 players, a correct answer moves 1 step, first to 20 steps wins; Kuiz Relay — 4–8 players in 2 teams, 10 rounds, team members answer in turn, a correct answer scores for the team with a speed bonus, the team with more points wins and its top scorer is MVP; Teka Silang Kata — 2 players, 5 minutes, a crossword from M04 short answers, most filled words wins. Question UI reuses the Betul atau Salah and Cabaran Kilat cards (PROPOSED) | — | All logged-in (OBSERVED admin) | SOURCE (copy) / INFERRED / PROPOSED |
| FN-M16-5.5.4 | Room result (PROPOSED): the winner (team for Kuiz Relay) and the players' points; the lobby standings add a win to the winner (MVP for Kuiz Relay) and Papan Bijak also adds games, score and correct answers to every player; the room becomes `finished`; the result is reported to M14 per player (Papan Bijak `board_game_reward_correct` per correct and `board_game_reward_win` for the win when games pay syiling, FN-M16-12.1.1) | — | All logged-in (OBSERVED admin) | PROPOSED / INFERRED |

### EP-M16-6 — Single-player games (S13–S17)


**FT-M16-6.1 — Darjah picker (shared by S13–S16 and S19)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M16-6.1.1 | Without `?darjah` a full-screen overlay (`z-index:200`, dark gradient) shows the game emoji and title, "Pilih darjah / tingkatan kamu:", group "🏫 Sekolah Rendah" with links "Darjah 1"–"Darjah 4" (`?darjah=1…4`, hover border in the game colour) and "← Kembali ke Hub" → `/permainan`; the list stays Darjah 1–4 as live (DV-M16-19) and `?darjah=5…11` also works. Live starts the game under the overlay (D-M16-19); the rebuild starts the countdown or the game only after a darjah is chosen, and nothing is submitted from the picker (DV-M16-18) | S13-047–055; S14-055–063; S15-066–074; S16-072–080; S19-004–012 | All logged-in (OBSERVED admin) | OBSERVED + DV-M16-18/19 |

**FT-M16-6.2 — Betul atau Salah S13 `/permainan/betul-salah`**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M16-6.2.1 | Countdown: "✅❌ BETUL ATAU SALAH" and a big number 3 → 2 → 1 (800 ms each), then playing | S13-004–008 | All logged-in (OBSERVED admin) | OBSERVED / SOURCE |
| FN-M16-6.2.2 | Playing: streak badge "🔥 {n} KOMBO" (from 2; `hot` class from 5); bar "Skor" · clock `timeLeft` (red at ≤ 10) · "Betul"; "Kenyataan {n}", the statement card "{question} → {option}", buttons ❌ / ✅ (disabled while an answer is shown), legend "❌ SALAH ✅ BETUL"; feedback ✅ / ❌ for 700 ms | S13-009–018, 056–065 | All logged-in (OBSERVED admin) | OBSERVED / SOURCE |
| FN-M16-6.2.3 | Rules (SOURCE): 40 statements per load (M04 MCQ of the chosen darjah, true about half the time); 45 s; a correct answer adds `10 + min(streak,10) × 2` points and `min(streak,5)` syiling (counted, then displayed per DV-M16-23); a wrong answer resets the streak; the game ends at 0 s or after 40 statements. Titles: ≥ 300 "🏆 LEGENDA!", ≥ 150 "🔥 LUAR BIASA!", ≥ 80 "✅ HEBAT!", else "💪 TERUSKAN!" | — | All logged-in (OBSERVED admin) | SOURCE |
| FN-M16-6.2.4 | Result: emoji and title, "45 saat — Betul atau Salah!", tiles "Skor Total", "Ketepatan" (`betul/jawab`), "Kombo Max" ("{n} 🔥"), "Syiling" ("{n} 🪙", credited value, DV-M16-23), "🏆 REKOD BARU!" when the server says `is_new_record`, links "🔄 Main Lagi" → the same game, "🎮 Hub" → `/permainan`; the coin-fly animation plays only for a credited amount above 0 | S13-019–046 | All logged-in (OBSERVED admin) | OBSERVED + DV-M16-23 |

**FT-M16-6.3 — Cabaran Kilat S14 `/permainan/cabaran-kilat`**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M16-6.3.1 | Countdown "⚡ CABARAN KILAT" 3 → 2 → 1 | S14-004–005, 034–036 | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-6.3.2 | Playing: "🔥 {n}x COMBO" (from 2; `fire` from 5); bar "Skor" · clock · "Betul"; "Soalan {n}" with a difficulty chip "Mudah" (difficulty ≤ 2, green) / "Sederhana" (3, amber) / "Sukar" (4, red); question text and options "A. …"–"D. …" (correct → `correct`, wrong pick → `wrong`, then all disabled); screen flash and particles; 400 ms to the next question | S14-006–022, 037 | All logged-in (OBSERVED admin) | OBSERVED / SOURCE |
| FN-M16-6.3.3 | Rules (SOURCE): 30 MCQ (4 options, 1 correct; difficulty 1–4) per load; 60 s; correct: combo +1, mult = min(combo,10), score += 10 × mult, syiling += mult; wrong: combo 0. Titles: ≥ 500 "🏆 LEGENDA!", ≥ 300 "🔥 LUAR BIASA!", ≥ 150 "⚡ PANTAS!", else "💪 TERUSKAN!" | — | All logged-in (OBSERVED admin) | SOURCE |
| FN-M16-6.3.4 | Result: "60 saat penuh aksi!", "Skor Total", "Betul / Jawab", "Combo Max 🔥" ("{n}x"), "Syiling" (credited, DV-M16-23), "🏆 REKOD BARU!", "⚡ Main Lagi", "🎮 Hub" | S14-023–033, 038–054 | All logged-in (OBSERVED admin) | OBSERVED + DV-M16-23 |

**FT-M16-6.4 — Tembak Jawapan S15 `/permainan/tembak-jawapan`**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M16-6.4.1 | Countdown "🎯 TEMBAK JAWAPAN", 3 → 2 → 1 and "Tap jawapan yang betul sebelum jatuh!" | S15-004–010 | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-6.4.2 | HUD "Skor", "Level", 3 × ❤️ (a lost life is faded), "🪙" + syiling (the in-play amount of FN-M16-6.7.3: the computed amount when the payload says `canEarnSyiling`, else 0; DV-M16-23); "Soalan {n}" + the question; `#fallZone` (500 px tall) with the line "⚠ GARIS MAUT" (12 px, DV-M16-24) and falling tiles (text = option); banner "⚡ LEVEL {n}!" for 1.2 s | S15-011–018, 029–048, 065 | All logged-in (OBSERVED admin) | OBSERVED + DV-M16-23/24 |
| FN-M16-6.4.3 | Rules (SOURCE): 30 MCQ; 3 lives; tile fall time `max(5, 15 − (level − 1) × 0.7)` s + random 0–2 s, tiles 1.8 s apart, miss deadline `(base + 6 + options × 2)` s; correct tap: score += 10 × level, syiling += level, level +1 every 5 correct; wrong tap −1 life; a miss −1 life and counts as answered; ends at 0 lives or when all are answered. Titles: ≥ 500 "🏆 SNIPER!", ≥ 200 "🎯 SHARP!", ≥ 80 "💪 BAGUS!", else "🔄 CUBA LAGI!" | — | All logged-in (OBSERVED admin) | SOURCE |
| FN-M16-6.4.4 | Result: "Tembak Jawapan — Level {n}", "Skor Total", "Ketepatan", "Tertinggi" ("Level {n}"), "Syiling" (credited), "🔄 Main Lagi", "🎮 Hub" | S15-019–028, 049–064 | All logged-in (OBSERVED admin) | OBSERVED + DV-M16-23 |

**FT-M16-6.5 — Susun Jawapan S16 `/permainan/susun-jawapan`**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M16-6.5.1 | Header "Kembali" (`fa-arrow-left`) → `/permainan`, chips "Skor {n}" and "🪙 {n}" (the in-play amount of FN-M16-6.7.3), h2 "🧩 Susun Jawapan", 20 progress dots (active / done / wrong); starts in `playing` after the darjah is chosen (no countdown) | S16-004–007 | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-6.5.2 | Puzzle area: "Soalan {n} daripada {total}", the question; "📥 Jawapan Kamu:" drop area (a click on the area removes the last tile, a click on a tile removes it; empty hint "Klik huruf/perkataan di bawah untuk susun"); "🔤 Pilihan:" source tiles (a click places the tile) | S16-008–014, 022–039, 081, 083–084 | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-6.5.3 | "✅ Semak Jawapan" (disabled when empty or already checked) and "⏭️ Langkau Soalan Ini"; correct → "🎉 BETUL! +{points} mata" and "Seterusnya →"; wrong → "❌ Cuba lagi atau langkau", "🔄 Cuba Lagi" (resets the tiles of the puzzle), "⏭️ Langkau" | S16-015–021, 040–049, 082, 085–087 | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-6.5.4 | Rules (SOURCE): 20 puzzles `{question, answer, scrambled[], type letters\|words, difficulty 1–3, points}`; the check trims and ignores case (`words` join with a space); correct: score += points, syiling += ceil(points ÷ 3); no timer; points = max(5, tiles × 2) for `letters` and tiles × 3 for `words` (fits 20/20 observed puzzles; INFERRED server rule). Titles by solved ratio: ≥ 0.9 "🏆 GENIUS!", ≥ 0.6 "🧩 BIJAK!", ≥ 0.3 "💪 BAGUS!", else "📚 TERUSKAN!" | — | All logged-in (OBSERVED admin) | SOURCE / INFERRED |
| FN-M16-6.5.5 | Result: "Susun Jawapan selesai!", "Skor Total", "Selesai" (`solved/total`), "Syiling Diperolehi" (credited), "🔄 Main Lagi", "🎮 Hub" | S16-050–071 | All logged-in (OBSERVED admin) | OBSERVED + DV-M16-23 |

**FT-M16-6.6 — Kad Memori S17 `/permainan/kad-memori`**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M16-6.6.1 | Header: link "Permainan" (`fa-arrow-left`) → `/permainan`, h1 "🃏 Kad Memori", "Padankan soalan dengan jawapan yang betul!"; stats "⏱️ m:ss" (counts up from load, no limit), "👆 {n} langkah", "✅ {m} / 6 padan"; no darjah picker | S17-004–015 | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-6.6.2 | 12 cards (4 × 3; 98 px square at 375, 151 px at 768 / 1280): back "❓", front `type-question` / `type-answer` with the content; a move = 2 flips; a matching pair stays `matched`; a mismatch shows `wrong` and flips back after 800 ms; the server shuffles the 6 pairs (no client reshuffle, as live) | S17-016–028, 040–051, 067–100 | All logged-in (OBSERVED admin) | OBSERVED / SOURCE |
| FN-M16-6.6.3 | Rules: 6 pairs `{id, pair_id, type question\|answer, content, difficulty}` from M04 MCQ (question + correct option); complete → `POST …/submit {session_id, matches, total_pairs, moves, time_seconds}` → `results.syiling_earned` and `results.accuracy` (accuracy = round(6 ÷ moves × 100), INFERRED) | — | All logged-in (OBSERVED admin) | SOURCE / INFERRED |
| FN-M16-6.6.4 | Result overlay (a click outside does nothing): "🎉", "Tahniah!", "Semua kad berjaya dipadankan!", "Masa", "Langkah", "Ketepatan" ("{n}%"), "Syiling 🪙" ("+{n}", credited), "🔄 Main Lagi", "🏠 Hub" | S17-029–039, 052–066 | All logged-in (OBSERVED admin) | OBSERVED + DV-M16-23 |

**FT-M16-6.7 — Game sessions, results and coins**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M16-6.7.1 | Game payload: each load of S13–S17 creates a game session (`session_id` prefix `tf_` Betul/Salah, `speed_` Cabaran Kilat, `shoot_` Tembak, `ws_` Susun, `mem_` Kad Memori + 13 hex) and draws its items from the M04 question store (eligible MCQ of the darjah; Kad Memori and Susun without darjah use Darjah 1–4, INFERRED); the page also gets the viewer's `personalBest` where live shows it (admin: Betul atau Salah 38, Cabaran Kilat 40) | — | All logged-in (OBSERVED admin) | SOURCE / INFERRED |
| FN-M16-6.7.2 | Submit when the game ends: `POST /permainan/{game}/submit` with the SOURCE payload of each game → `{is_new_record, syiling_awarded}`; a new record = score above the stored personal best (INFERRED; the first result is a record); the result is stored (M11 "Permainan" activity) and reported to M14; a failed submit logs "Submit error:" and the result screen stays (as live) | — | All logged-in (OBSERVED admin) | SOURCE / INFERRED |
| FN-M16-6.7.3 | Syiling shown = syiling credited (DV-M16-23): the game payload (and the Roda Nasib page data) carries `canEarnSyiling` (= M14 `gamification.canEarnSyiling(userId)`: the game-coin setting `games_award_syiling` = 1 **and** the user's M02 `coinsEnabled`); while playing, every counter shows the computed amount of the game formula when `canEarnSyiling` is true, else 0; the result tiles, the coin-fly and the Roda Nasib modal use the `coinsCredited` returned after the submit (0 with the M14 seed; live shows the computed figure although no coin is paid, D-M16-24) | — | All logged-in (OBSERVED admin) | OBSERVED + DV-M16-23 |

### EP-M16-7 — Daily, weekly and parent games (S18–S22)


**FT-M16-7.1 — Roda Nasib S18 `/permainan/roda-nasib`**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M16-7.1.1 | Header: link "Permainan" → `/permainan`, h1 "🎯 Roda Nasib", "Pusing roda sekali sehari untuk hadiah misteri!"; chips "🎰 {n} kali spin" and "🪙 {n} Syiling dimenangkan" (Σ credited; admin 2 / 0) | S18-004–008 | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-7.1.2 | `<canvas>` wheel 380 × 380 (320 px at 375) with the 8 segments (label, colour, icon of discovery A.5) and the pointer "🎯"; button "🎯 SPIN!" / "⏳ Sedang Pusing..." / "✅ Sudah Spin Hari Ini" (disabled while spinning or after today's spin) | S18-009–010 | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-7.1.3 | Spin rules: `POST /permainan/roda-nasib/spin` → `{success, message, result {segment_index, label, icon, type, value}}` with a **0-based** `segment_index` (the wheel lands at `360 − (segment_index × 45 + 22.5)`°); the server picks the segment by weight (index 0 "1 Syiling" 25, 1 "3 Syiling" 20, 2 "5 Syiling" 15, 3 "10 Syiling" 8, 4 "20 Syiling" 3, 5 "Cuba Lagi" 15, 6 "2 Syiling" 10, 7 "7 Syiling" 4; Σ 100) from the stream `m16:spin:<userId>:<date>`; the wheel turns 5–8 times for 4.2 s; one spin per calendar day (MYT, reset at 00:00, INFERRED); a refused spin shows a native `alert(message)` and sets "✅ Sudah Spin Hari Ini" (PROPOSED COPY "Anda sudah spin hari ini.") | — | All logged-in (OBSERVED admin) | SOURCE / INFERRED / PROPOSED |
| FN-M16-7.1.4 | Prize modal: icon, label; for `syiling` with a credited amount "+{n} Syiling" and "Ditambah ke akaun kamu!" — while games pay no syiling (M14 `games_award_syiling` = 0) these two lines are not shown (DV-M16-23); for `nothing` "Jangan risau, cuba lagi esok!"; "Tutup" (and an overlay click) closes it | S18-011–025 | All logged-in (OBSERVED admin) | OBSERVED + DV-M16-23 |

**FT-M16-7.2 — Jutawan Ilmu S19 `/permainan/jutawan`**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M16-7.2.1 | Header: link "Permainan", h1 "💰 Jutawan Ilmu", "Pilih subjek, jawab 15 soalan — menang sampai 1,000 Syiling!"; stats "L{n}" "Rekod Tertinggi", "{n}" "Permainan", "1,000🪙" "Hadiah Utama" (admin L0 / 0); without `?darjah` "👆" "Pilih darjah atau tingkatan di atas untuk mula." | S19-013–023 | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-7.2.2 | With `?darjah=n`: "📚 PILIH SUBJEK (DARJAH n)" or "(TINGKATAN n−6)" and one link per subject with questions at that grade → `/permainan/jutawan/main?subject={id}&darjah={n}`: emoji, name, "{count} soalan", `fa-chevron-right`, 1 column below `md`, 2 at `md`+; lists and counts per grade exactly as discovery A.7, read from M04 Q-JUT-COUNT (`questions.jutawan.count(subjectId, level)`, the separate `jutawanQuestions` store of M04 v1.11; XR-M16-01 applied); the Jutawan game samples the same store, so the advertised count and the playable pool agree | S19-024–034 | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-7.2.3 | Game page `/permainan/jutawan/main` (not observable, Q-M16-7; PROPOSED, provisional): 15 questions of the subject and grade with rising difficulty (1 → 4), drawn keyless with M04 `questions.jutawan.sample` and checked with `questions.jutawan.gradeAnswer`, one wrong answer ends the game, 3 lifelines (PROPOSED: three uses of "50:50"), level reached "L{n}"; the result updates "Rekod Tertinggi" and "Permainan" and is reported to M14 (ledger wording "Jutawan Ilmu ({subjek}): Level {n}", observed on M14) | — | All logged-in (OBSERVED admin) | PROPOSED |

**FT-M16-7.3 — Pertandingan Mingguan S20 `/permainan/pertandingan`**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M16-7.3.1 | Header: link "Permainan", h1 "🏆 Pertandingan Mingguan", "Lumba dengan semua pelajar! Top 3 dapat Syiling bonus."; week card "📅 Minggu Ini" "{d Mon} — {d Mon yyyy}" (Monday–Sunday, e.g. "21 Sep — 27 Sep 2026"), "⏳ Tamat dalam" `#countdown` "{d}h {h}j {m}m" refreshed every 60 s, "Tamat!" at the end, "-" before the first tick; the week ends Sunday 23:59:59 **MYT** (live counts to the UTC literal, 08:00 MYT Monday, DV-M16-17) | S20-004–011, 059 | All logged-in (OBSERVED admin) | OBSERVED + DV-M16-17 |
| FN-M16-7.3.2 | Prizes (3 columns at every width): "🥇" "Juara" "+100 🪙", "🥈" "Naib Juara" "+50 🪙", "🥉" "Tempat Ketiga" "+25 🪙" (copy; payout not observable, not built, OQ-M16-10) | S20-012–023 | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-7.3.3 | Own status: a viewer without a completed practice session this week sees "📝", "Belum mula lagi minggu ini!", "Buat Latih Tubi untuk masuk ranking.", "Mula Latih Tubi" → `/practice` (M05); a ranked viewer sees PROPOSED COPY "📊 Kedudukan kamu: #{rank} · {betul} betul" (unobservable, provisional) | S20-024–028 | All logged-in (OBSERVED admin) | OBSERVED / PROPOSED |
| FN-M16-7.3.4 | "📊 Papan Ranking Mingguan": top 20 users by correct answers of completed M05 practice-mode sessions this week (M05 v1.10 Q-WEEK-RANK; at the project clock the list is restated with M17's persons, XL3-16, SRS §6.11.4; XR-M16-03), rows rank (🥇🥈🥉 with `from-amber-50`, then the number), name, "{n} sesi", "{n}" "betul" (green), "{x.x}%" "tepat"; ties by user id asc (INFERRED) | S20-029–058 | All logged-in (OBSERVED admin) | OBSERVED / INFERRED |

**FT-M16-7.4 — Uji Minda S21 `/permainan/uji-minda`**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M16-7.4.1 | Empty state (no challenge set by a parent): link "Permainan", "🧠", h1 "Uji Minda", "Cabaran khas dari ibu/bapa kamu! Tapi ibu/bapa kamu belum tetapkan cabaran lagi."; box "**Bagaimana nak mula?** Minta ibu atau bapa kamu log masuk ke PRESTASIPLUS, pergi ke **"Cabaran Uji Minda"** di dashboard mereka, dan tetapkan cabaran + hadiah untuk kamu!", "📋 Apa Ibu/Bapa boleh tetap:" with "✅ Bilangan soalan setiap set", "✅ Syiling per jawapan betul", "✅ Hadiah custom (cth: buku, jajan, trip)", "✅ Syiling minimum untuk claim hadiah". The populated student view and the parent side belong to the parent-portal owner (out of scope, OQ-M16-12) | S21-004–016 | All logged-in (OBSERVED admin) | OBSERVED |

**FT-M16-7.5 — Sambung Kata S22 `/permainan/sambung-kata`**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M16-7.5.1 | Live answers HTTP 500 with an empty body (the browser's "This page isn’t working" / "HTTP ERROR 500" / "Reload" page). The rebuild renders the app's handled error page as observed on S28 ("500", "⚙️", "Ralat Pelayan", "Sesuatu tidak kena di pihak kami. Pasukan teknikal telah dimaklumkan. Sila cuba sebentar lagi.", "Halaman Utama", "Cuba Semula", "PRESTASIPLUS") with status 500; no game is built (content not observable, Q-M16-8) (DV-M16-03) | S22-001–009 | All logged-in (OBSERVED admin) | OBSERVED + DV-M16-03 |

### EP-M16-8 — Tournaments (S23, S24, detail)


**FT-M16-8.1 — Tournament list S23 `/tournament`**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M16-8.1.1 | Hero `fa-trophy`: h2 "Liga & Tournament", "Bertanding antara sekolah dalam format liga, kalah mati, atau hibrid!" | S23-004–005; S30-109–110 | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-8.1.2 | Admin button "Cipta Tournament Baru" (`fa-plus`) → `/tournament/admin/create`; hidden for other roles (INFERRED) | S23-006; S30-111 | Admin | OBSERVED / INFERRED |
| FN-M16-8.1.3 | List: without a tournament the card `fa-trophy` "Tiada tournament aktif buat masa ini." (the seed, as live); with tournaments (status `registration` or `ongoing`) one card per tournament linking to `/tournament/{uuid}` with the title and the banner line ("Pendaftaran dibuka" / "Sedang berlangsung") — PROPOSED layout, provisional (Q-M16-4) | S23-007; S30-112 | All logged-in (OBSERVED admin) | OBSERVED / PROPOSED |

**FT-M16-8.2 — Create tournament S24 `/tournament/admin/create`**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M16-8.2.1 | Form `POST /tournament/admin` (`tournamentForm()`); "Maklumat Asas" (`fa-info-circle`): "Tajuk Tournament" `title` (required), "Penerangan" `description` (textarea, 3 rows), "Tahap Pendidikan" `education_level_id` (required: "-- Pilih --", "Tingkatan 4" `tingkatan4`, "Tingkatan 5" `tingkatan5`, "SPM (Tingkatan 4 & 5)" `spm`) | S24-004–013 | Admin | OBSERVED |
| FN-M16-8.2.2 | "Format" (`fa-trophy`) radio cards `format`: "Perlawanan Tunggal" `single_match`, "Kalah Mati" `knockout`, "Liga" `league`, "Hibrid (Liga + Kalah Mati)" `hybrid` (default); "Bilangan Kumpulan" `groups_count` (number, 2, min 2, max 8) only for `league` / `hybrid` | S24-014–025 | Admin | OBSERVED |
| FN-M16-8.2.3 | "Sumber Soalan" (`fa-question-circle`) radio cards `question_mode`: "Mengikut Mata Pelajaran" `subject` (default) → "Mata Pelajaran" `subject_id` ("-- Pilih --" + 31 subjects A→Z with `data-code`); "Mengikut Kertas Peperiksaan" `exam_paper` → "Kertas Peperiksaan" `exam_paper_id` with only "-- Pilih --" (no paper exists, as live, DV-M16-28); "Campuran Rawak" `random_mix` → "Pilih Mata Pelajaran" `mixed_subject_ids[]` (31 checkboxes A→Z) | S24-026–100 | Admin | OBSERVED + DV-M16-28 |
| FN-M16-8.2.4 | "Soalan & Masa" (`fa-clock`): "Jumlah Soalan" `total_questions` (required, 40, 5–100) and "Tetingkap Masa (minit)" `time_window_minutes` (required, 60, 10–180). SPM rule (SOURCE): on a subject change, when its code is in {BM 25, BI 40, MATH 40, SCI 40, SEJ 40, PI 40, PM 40, ADDMATH 20, PHY 40, CHEM 40, BIO 40, GEO 40, EKON 40, PSV 40, TI 40}, `total_questions` = that count and the note "Standard SPM Kertas 1: {n} soalan" appears; other subjects keep the previous value and note | S24-101–106, 124 | Admin | OBSERVED / SOURCE |
| FN-M16-8.2.5 | "Pemarkahan" (`fa-star`): "Top-N Pelajar (untuk skor sekolah)" `top_n_scoring` (required, 20, 1–50) with help "Sistem pilih N pelajar terbaik bagi setiap sekolah"; "Minimum Peserta" `min_participants` (required, 10, 1–100) with help "Minimum pelajar sekolah untuk kelayakan" | S24-107–114 | Admin | OBSERVED |
| FN-M16-8.2.6 | "Pendaftaran" (`fa-calendar`): "Tarikh Buka Pendaftaran" `registration_opens_at` and "Tarikh Tutup Pendaftaran" `registration_closes_at` (datetime-local, empty) | S24-115–120 | Admin | OBSERVED |
| FN-M16-8.2.7 | Buttons: "Batal" → `/tournament`; "Simpan Draf" (`fa-save`, `action=draft`) — invisible on live (white text on a transparent background, D-M16-28), rendered `bg-gray-600` with white text (DV-M16-27); "Cipta & Buka Pendaftaran" (`fa-rocket`, `action=open_registration`); an empty submit shows the native bubbles of the six required fields | S24-121–123 | Admin | OBSERVED + DV-M16-27 |
| FN-M16-8.2.8 | Save (not observable; INFERRED, provisional): server validation of SRS §5 (PROPOSED messages); `draft` → status `draft`; `open_registration` → status `registration`; the tournament gets a uuid and the admin returns to `/tournament` with a PROPOSED flash; a `registration` tournament appears in the banner and the list; at `registration_closes_at` it becomes `ongoing` (INFERRED) | — | Admin | INFERRED / PROPOSED |

**FT-M16-8.3 — Tournament detail `/tournament/{uuid}` (provisional)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M16-8.3.1 | Not observable (no tournament exists on live, Q-M16-4): the rebuild renders a PROPOSED read-only page — title, banner line, the saved fields of FN-M16-8.2 (format, groups, question source, questions, time window, Top-N, minimum participants, registration dates); brackets, groups, fixtures and live matches are not built; an unknown uuid → 404 (OBSERVED) | — | All logged-in (OBSERVED admin) | OBSERVED (404) / PROPOSED |

### EP-M16-9 — Leagues (S25–S27)


**FT-M16-9.1 — League list S25 `/liga`**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M16-9.1.1 | Buttons "Cipta Liga Baru" (`fa-plus`) → `/liga/cipta` and "Sertai dengan Kod" (`fa-ticket`) → join modal | S25-004–005 | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-9.1.2 | Tabs "Liga Saya ({n})" (default) / "Liga Terbuka ({n})" (active `bg-white shadow text-emerald-700`); "Liga Saya" = leagues that include the viewer's school (INFERRED; admin 0); empty: `fa-trophy`, "Belum menyertai mana-mana liga", "Cipta liga baru atau sertai menggunakan kod jemputan" | S25-006–010 | All logged-in (OBSERVED admin) | OBSERVED / INFERRED |
| FN-M16-9.1.3 | "Liga Terbuka" = leagues whose status is not `ended` (INFERRED; seed: liga 1): card → `/liga/{id}` with h3 name, status pill ("Akan Datang", no dot), chips scope "Sekolah" (`fa-bullseye`; live "School", DV-M16-12), type "Persahabatan" (`fa-gamepad`), subject (`fa-book`), "dd/mm - dd/mm/yyyy" (`fa-calendar`), "{n} sekolah" (`fa-school`), "Lihat →" | S25-011–013 | All logged-in (OBSERVED admin) | OBSERVED + DV-M16-12 |
| FN-M16-9.1.4 | Join modal (overlay click closes): form `POST /liga/sertai`, h3 "Sertai Liga", "Masukkan kod jemputan 8 aksara yang diberikan oleh penganjur.", input `invite_code` (`maxlength=8`, placeholder "cth: AB12CD34", required), "Batal" (closes and keeps the typed code, as live), "Sertai" | S25-014–021 | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-9.1.5 | Join outcome (not observable; INFERRED, provisional): a known code of a league that is not ended adds the viewer's school to the league and opens `/liga/{id}` with a PROPOSED success flash; unknown code, ended league, a viewer without a school or a school already in → PROPOSED error flash; `max_schools` reached → PROPOSED error flash | — | All logged-in (OBSERVED admin) | INFERRED / PROPOSED |

**FT-M16-9.2 — Create league S26 `/liga/cipta`**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M16-9.2.1 | Form `POST /liga/cipta`: "Nama Liga" `name` (required, placeholder "cth: Liga Sains Daerah Kluang 2026"); "Jenis" `type` (required: "Persahabatan" `friendly`, "Kejohanan" `tournament`, "Liga" `league`); "Skop" `scope` (required: "Sekolah" `school`, "Daerah" `district`, "Negeri" `state`, "Kebangsaan" `national`); "Mata Pelajaran (Pilihan)" `subject_id` ("Semua Mata Pelajaran" "" + 31 subjects A→Z); "Mod Permainan" `game_mode` (required: "Campuran" `mixed` selected, "Kuiz Sahaja" `quiz`, "Multiplayer Sahaja" `multiplayer`) | S26-004–015 | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-9.2.2 | "Tingkatan" `class_levels[]` checkboxes D1–D6, T1–T5 (grid 3 columns, 6 at `sm`) | S26-016–038 | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-9.2.3 | "Kaedah Skor" `scoring_method` (required: "Jumlah Markah" `total_score` selected, "Purata Ketepatan" `avg_accuracy`, "Bilangan Kemenangan" `wins`); "Tarikh Mula" `start_date` / "Tarikh Tamat" `end_date` (date, required); "Had Sekolah (Kosongkan jika tiada had)" `max_schools` (number 2–500, placeholder "cth: 50") | S26-039–046 | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-9.2.4 | Buttons "Batal" → `/liga` and "Cipta Liga"; an empty submit shows the native bubbles of the 7 required fields. Save (not observable; INFERRED, provisional): league with an 8-character invite code [A-Z0-9], creator = viewer, status `upcoming` ("Akan Datang"), the creator's school as first participant when the creator has one (INFERRED) → `/liga/{id}` with a PROPOSED flash | S26-047–048 | All logged-in (OBSERVED admin) | OBSERVED / INFERRED / PROPOSED |

**FT-M16-9.3 — League detail S27 `/liga/{id}`**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M16-9.3.1 | Header card: status pill with a 6 px `fa-circle` dot ("Akan Datang" `!bg-amber-100 !text-amber-700`, "Tamat" `!bg-slate-200 !text-slate-600`; stored status, DV-M16-11), chips subject (`fa-book`), "dd/mm - dd/mm/yyyy" (`fa-calendar`), "{n} sekolah" (`fa-school`), scoring label (`fa-trophy`, "Jumlah Markah"), "Dicipta oleh {name} · Tingkatan: {levels}" | S27-004–010, 035–039 | All logged-in (OBSERVED admin) | OBSERVED + DV-M16-11 |
| FN-M16-9.3.2 | "Kod Jemputan" box with the code (liga 1 `RMU4VCBS`, liga 2 `TEST2026`, visible to non-members as live) and "Kongsi" (`fa-whatsapp`) → `https://wa.me/?text=Jom+sertai+Liga+Pertandingan+%22{nama}%22+di+PrestasiPlus%21+Kod+Jemputan%3A+{kod}+%E2%80%94+prestasiplus.my%2Fliga+%F0%9F%8F%86` (new tab) | S27-011–013, 040–041 | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-9.3.3 | "Sertai Liga Ini" (form `POST /liga/sertai` with hidden `invite_code`): shown when the league is not ended and the viewer's school is not a participant (INFERRED; liga 1 yes, liga 2 no) | S27-042–045 | All logged-in (OBSERVED admin) | OBSERVED / INFERRED |
| FN-M16-9.3.4 | "Sekolah Peserta" (`fa-school`): school chips (`bg-slate-100`) of the participating schools | S27-014–017, 046 | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-9.3.5 | "Papan Pendahulu" (`fa-trophy`): one tab per class level of the league (`x-data` `activeLevel`, first level active `bg-emerald-600 text-white`), each a table "#", "Sekolah" (name + "PPD …, {negeri}"), "Peserta", "Skor" (1 decimal, "2,935.0"), "Purata" ("77.2%"), scrolling in its card at 375 px (DV-M16-13); without standings `fa-chart-bar` "Belum ada data papan pendahulu" "Data dikemas kini setiap jam"; standings are the stored hourly-job output (not recomputed in the prototype, OQ-M16-09) | S27-018–027, 047–048 | All logged-in (OBSERVED admin) | OBSERVED + DV-M16-13 |
| FN-M16-9.3.6 | An id that is not a league → the M01 404 page (OBSERVED for 0, 3–6, 999) | S27-028–034 | All logged-in (OBSERVED admin) | OBSERVED |

### EP-M16-10 — Sekolah Bersaing S28 `/sekolah-bersaing`


**FT-M16-10.1 — Weekly school leaderboard**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M16-10.1.1 | Amber hero h1 "🏆 Sekolah Bersaing", "Leaderboard mingguan — bandingkan sekolah-sekolah di Malaysia. Anda rasa bangga? Kongsi."; line "Minggu **{d Mon yyyy}** · **{n}** sekolah dalam pertandingan" (Monday of the shown week; the current week by default: "21 Sep 2026" · "49") | S28-001–005, 058, 068 | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-10.1.2 | Header row "#", "Sekolah", "% Aktif", "Streak Avg", "Nota/Pelajar"; "Streak Avg" and "Nota/Pelajar" hidden below 768 px (as live) | S28-006–010 | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-10.1.3 | Rows (page-local `.lb-row`; top 3 `gold` / `silver` / `bronze`): rank "🥇 🥈 🥉" then "#4"…, school name + state line, "{x.x}%" + "aktif", "🔥 {x.x}" + "hari", "{x.x}" + "per 10"; order = the stored rank of the weekly job (the rule is INFERRED, discovery §5.6); an opted-out school shows "Sekolah anonim" (copy; fixture only). Seed: the 49 observed rows of 21 Sep 2026 | S28-011–055 | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-10.1.4 | Footer tip "💡 **Untuk Cikgu Besar / PIBG:** Share ranking ini ke parent group WhatsApp. Pelajar nampak sekolah berbangga = lebih semangat. Sekolah yang opt-out akan paparkan sebagai "Sekolah anonim"." | S28-056–057 | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-10.1.5 | `?week=YYYY-MM-DD` (no UI control, as live) shows the week that contains the date, normalised to its Monday; the weeks of 14 Sep, 07 Sep and 31 Aug 2026 hold 48 schools each — the 21 Sep list without its row #46, in the observed order and with the observed values (SRS §6.11.6); a week without data shows the hero and "📊 Data minggu ini belum dijana." "Cron mingguan akan kira pada Isnin pagi. Tunggu kejap ya." (e.g. `?week=2025-01-06`) | S28-066–067 | All logged-in (OBSERVED admin) | OBSERVED |
| FN-M16-10.1.6 | `?week=` with an invalid value: live answers the "Ralat Pelayan" 500 page; the rebuild ignores the value and shows the current week (DV-M16-30) | S28-059–065 | All logged-in (OBSERVED admin) | OBSERVED + DV-M16-30 |

### EP-M16-11 — Game settings S29 `/admin/permainan`


**FT-M16-11.1 — Stats, Papan Bijak board settings and game list**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M16-11.1.1 | Four stat tiles (2 columns below `md`): "{n}" "Jumlah Bilik" (Q-ROOMS 160), "Sedang Aktif" (rooms `playing`, 0), "Selesai" (rooms `finished`, 0 — stored data kept as live, DV-M16-16), "Pemain Unik" (distinct room players, 189) | S29-001–012 | Admin | OBSERVED + DV-M16-16 |
| FN-M16-11.1.2 | Form `PUT /admin/permainan`, card "Papan Bijak" (`fa-chess-board`) "Tetapan papan permainan ular & tangga (50 petak)": "Bilangan Petak Soalan" (`fa-question-circle`) `boardgame_quiz_tiles` (number, stored 35, min 0, max 38, suffix "petak"), help "Maks 38 petak (48 available - 10 petak khas). Set 0 = tiada soalan."; "Pecahan Papan (50 petak)" (`fa-calculator`) with live values: "Petak soalan (quiz):" {tiles}, "Tangga (3) + Ular (3):" 6, "Bonus (2) + Perangkap (2):" 4, "Petak biasa (jalan kosong):" max(0, 48 − 10 − tiles), "Mula + Tamat:" 2; bar "{tiles} soalan" (width round(tiles ÷ 48 × 100) %) + "10 khas" (20.8 %) + "{rest} biasa"; a value above 38 shows the native range bubble | S29-013–036 | Admin | OBSERVED |
| FN-M16-11.1.3 | "Senarai Permainan" (`fa-gamepad`) "Permainan yang tersedia dalam sistem": 3 cards (`fa-chess-board`, `fa-clone`, `fa-bolt`) with the pill "Aktif" (`fa-circle` dot) and "Lihat" (`fa-external-link-alt`, new tab): "Papan Bijak" "Ular & tangga dengan soalan kuiz. Multiplayer 2-6 pemain." (live "2-4", contradicting the lobby 2–6, DV-M16-15) → `/papan-bijak`; "Kad Memori" "Padankan soalan dengan jawapan. 6 pasangan (12 kad)." → `/permainan/kad-memori`; "Battle Arena" "1v1 kuiz battle masa nyata. Pilih lawan & subjek." → `/battle` | S29-037–051 | Admin | OBSERVED + DV-M16-15 |
| FN-M16-11.1.4 | "Simpan Tetapan" (`fa-save`) saves `boardgame_quiz_tiles` (integer 0–38); success returns to the page with a PROPOSED flash and the new breakdown (not observable, provisional); new Papan Bijak rooms use the saved value | S29-052 | Admin | OBSERVED / PROPOSED |

### EP-M16-12 — Contracts with other modules (behaviour, no element of their own)


**FT-M16-12.1 — Owner contracts (D12)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M16-12.1.1 | Game and battle results to M14: every finished single-player game, room, battle, spin and Jutawan game calls `gamification.onGameResult(userId, {game, event, coins, xp, correct, total, detail})` → `{coinsCredited, xpAdded}` (M14 v1.1 BR-M14-21); M14 credits syiling only while `games_award_syiling` = 1 and M16 displays `coinsCredited`; M16 calls `gamification.canEarnSyiling(userId)` (M14 v1.3; setting ∧ the user's M02 `coinsEnabled`) to put `canEarnSyiling` in the game payloads for the in-play counters; `xp` = 0 until M14 defines game XP (the only XP figure in the game code is `mata: 0`) (XR-M16-02) | — | System | OBSERVED (M14 setting) / INFERRED |
| FN-M16-12.1.2 | Question pools from M04: games and battles draw eligible questions through `questions.*` (subject, level, difficulty, PKSK domain and level, SPM pool); Jutawan subject counts are an M04 named query (XR-M16-01). No game or battle answer is written to the M05 answer log (the live submits carry only totals; M11 counts them as separate "Battle" / "Permainan" activities) | — | System | OBSERVED / D12 |
| FN-M16-12.1.3 | Weekly practice ranking from M05: S20 reads M05 completed sessions of the week through a named query (Q-WEEK-RANK, XR-M16-03) | — | System | D12 |
| FN-M16-12.1.4 | Activity read for M11: `battles.countFor(userIds, {from, to})` and `gameResults.countFor(userIds, {from, to})` give the M11 "Battle" / "Permainan" activity counts and the battle correct/answered totals for "Skor Purata" (XR-M16-05) | — | System | D12 |
| FN-M16-12.1.5 | Users and schools from M01/M02: fictitious student anchors 4301–4377 and the battle, league and Sekolah Bersaing schools are M02 records; M16 stores only ids (XR-M16-04) | — | System | D12 |

---

## 4. User stories

Values in the ACs come from the seed (SRS §6.11). "The admin" = `admin@demo.test` (id 1; mirrors live: grade Darjah 4, school 900002). "The student" = `pelajar@demo.test` (id 2; Tingkatan 4, school 900001). "{name n}" = the fictitious name of user n in the M02 users dataset; "{school n}" = the name of school n in the M02 schools dataset. Clock `2026-09-25T15:40:00+08:00` unless stated. E2E run at 375×812, 768×1024 and 1280×800. **(provisional)** marks an AC that asserts INFERRED/PROPOSED/SIMULATION behaviour or a state live never showed.

| ID | Feature | MoSCoW | Story | Functions |
|---|---|---|---|---|
| US-M16-01 | FT-M16-1.1 | Must | As a user, I want the games, tournament, league and school-competition entries in my menu and the right page titles, so that I can find each screen and know where I am. | FN-M16-1.1.1–1.1.5 |
| US-M16-02 | FT-M16-1.2 | Must | As the owner, I want M16 closed to guests and to the wrong roles, and bad addresses and parameters to behave like live, so that the area is predictable. | FN-M16-1.2.1–1.2.4 |
| US-M16-03 | FT-M16-1.3 | Must | As a student on any page, I want a banner when a tournament is open for registration or running, so that I do not miss it. | FN-M16-1.3.1–1.3.5 |
| US-M16-04 | FT-M16-1.4 | Must | As a user on any device, I want readable, responsive screens with no real student names and honest simulated opponents, so that the prototype is usable and safe. | FN-M16-1.4.1–1.4.4 |
| US-M16-05 | FT-M16-2.1 | Must | As a student, I want to choose normal, PKSK or (in Tingkatan 4–5) SPM questions and a subject or domain before a battle, so that I duel on what I am studying. | FN-M16-2.1.1–2.1.8 |
| US-M16-06 | FT-M16-2.2 | Must | As a student, I want to find a random opponent of my grade or of another school and see the search progress, so that I can start a duel quickly. | FN-M16-2.2.1–2.2.7 |
| US-M16-07 | FT-M16-2.3 | Should | As a student waiting in the queue, I want to accept or reject a student who asks to join my battle, so that I choose my opponent. | FN-M16-2.3.1–2.3.2 |
| US-M16-08 | FT-M16-2.4 | Should | As a student, I want to challenge a named friend and to answer the challenges I receive, so that I can duel people I know. | FN-M16-2.4.1–2.4.4 |
| US-M16-09 | FT-M16-2.5 | Should | As a student in a matched battle, I want to answer the questions against my opponent, see the scores and the result, and be able to forfeit, so that the duel has an outcome. | FN-M16-2.5.1–2.5.5 |
| US-M16-10 | FT-M16-2.6 | Could | As a student, I want a history of my battles, so that I can see how I did. | FN-M16-2.6.1–2.6.2 |
| US-M16-11 | FT-M16-3.1 | Should | As a student, I want the weekly and monthly battle ranking of students, so that I can compare myself. | FN-M16-3.1.1–3.1.3 |
| US-M16-12 | FT-M16-3.2 | Must | As a student, I want the school battle ranking by period and state with a podium, so that I see which schools lead. | FN-M16-3.2.1–3.2.5 |
| US-M16-13 | FT-M16-3.3 | Must | As a student, I want a school's battle totals, this week and this month, its best fighters and its recent battles, so that I can follow my school. | FN-M16-3.3.1–3.3.6 |
| US-M16-14 | FT-M16-4.1 | Must | As a student, I want one hub that lists every game with its rules at a glance and any open room, so that I can pick a game. | FN-M16-4.1.1–4.1.11 |
| US-M16-15 | FT-M16-5.1 | Must | As a student, I want to create a Papan Bijak room with my subject, grade range and player limit, or join one by code, so that I can play with friends. | FN-M16-5.1.1–5.1.5 |
| US-M16-16 | FT-M16-5.2 | Should | As a student, I want the system to find Papan Bijak players for me, so that I can play without a code. | FN-M16-5.2.1–5.2.3 |
| US-M16-17 | FT-M16-5.3 | Should | As a student, I want the Papan Bijak top 10 with wins, games, rate, score and correct answers, so that I see the champions. | FN-M16-5.3.1 |
| US-M16-18 | FT-M16-5.4 | Must | As a student, I want each multiplayer lobby to let me create or join a room and see its leaders, and to be told clearly when a room code is wrong, so that I can start a game. | FN-M16-5.4.1–5.4.5 |
| US-M16-19 | FT-M16-5.5 | Could | As a student in a room, I want to wait for players, play by the game's rules and see who won, so that the room game works end to end. | FN-M16-5.5.1–5.5.4 |
| US-M16-20 | FT-M16-6.1 | Must | As a student, I want to choose my darjah before a single-player game starts, so that I do not lose time or submit a game I never played. | FN-M16-6.1.1 |
| US-M16-21 | FT-M16-6.2 | Must | As a student, I want to play Betul atau Salah for 45 seconds with a combo bonus and see my result, so that I drill facts fast. | FN-M16-6.2.1–6.2.4 |
| US-M16-22 | FT-M16-6.3 | Must | As a student, I want to play Cabaran Kilat for 60 seconds with a combo multiplier and see my result, so that I drill MCQs under time pressure. | FN-M16-6.3.1–6.3.4 |
| US-M16-23 | FT-M16-6.4 | Must | As a student, I want to shoot the right falling answer with three lives and rising levels, so that practice feels like a game. | FN-M16-6.4.1–6.4.4 |
| US-M16-24 | FT-M16-6.5 | Must | As a student, I want to rebuild scrambled answers, check, retry or skip, and see my result, so that I learn spellings and phrases. | FN-M16-6.5.1–6.5.5 |
| US-M16-25 | FT-M16-6.6 | Must | As a student, I want to match question cards with answer cards and see my time, moves and accuracy, so that I train memory. | FN-M16-6.6.1–6.6.4 |
| US-M16-26 | FT-M16-6.7 | Must | As a student, I want my game results saved with my personal best and only the coins I really receive shown, so that I trust the numbers. | FN-M16-6.7.1–6.7.3 |
| US-M16-27 | FT-M16-7.1 | Should | As a student, I want to spin the wheel once a day and see my prize, so that I have a daily reason to come back. | FN-M16-7.1.1–7.1.4 |
| US-M16-28 | FT-M16-7.2 | Should | As a student, I want to pick my grade and a subject with its question count for Jutawan Ilmu and play the 15-question ladder, so that I can aim for the top prize. | FN-M16-7.2.1–7.2.3 |
| US-M16-29 | FT-M16-7.3 | Must | As a student, I want this week's practice ranking, the prizes and the time left, so that I know how to get into the top 3. | FN-M16-7.3.1–7.3.4 |
| US-M16-30 | FT-M16-7.4 | Must | As a student, I want to know how Uji Minda starts when my parent has not set a challenge, so that I can ask them. | FN-M16-7.4.1 |
| US-M16-31 | FT-M16-7.5 | Must | As a student who opens Sambung Kata, I want a proper error page instead of a blank browser error, so that I can go back. | FN-M16-7.5.1 |
| US-M16-32 | FT-M16-8.1 | Must | As a user, I want the list of active tournaments (and, as admin, a way to create one), so that I see what is running. | FN-M16-8.1.1–8.1.3 |
| US-M16-33 | FT-M16-8.2 | Must | As an admin, I want to create a tournament with its format, question source, question count, time window, scoring and registration dates, as a draft or open for registration, so that schools can compete. | FN-M16-8.2.1–8.2.8 |
| US-M16-34 | FT-M16-8.3 | Could | As a user, I want a tournament's page from the banner or the list, so that I can read its settings. | FN-M16-8.3.1 |
| US-M16-35 | FT-M16-9.1 | Must | As a user, I want my leagues and the open leagues in two tabs and to join a league with its 8-character code, so that my school can take part. | FN-M16-9.1.1–9.1.5 |
| US-M16-36 | FT-M16-9.2 | Must | As a teacher, I want to create a league with its type, scope, subject, mode, levels, scoring, dates and school limit, so that I can organise a competition. | FN-M16-9.2.1–9.2.4 |
| US-M16-37 | FT-M16-9.3 | Must | As a user, I want a league's details, invite code with a WhatsApp share, participating schools and per-level leaderboard, and to join it, so that I can follow and join. | FN-M16-9.3.1–9.3.6 |
| US-M16-38 | FT-M16-10.1 | Must | As a head teacher or parent, I want the weekly school leaderboard by activity, streak and notes, and earlier weeks by link, so that I can share my school's standing. | FN-M16-10.1.1–10.1.6 |
| US-M16-39 | FT-M16-11.1 | Must | As an admin, I want room statistics, the Papan Bijak quiz-tile setting with a live board breakdown, and the list of games, so that I can configure the board. | FN-M16-11.1.1–11.1.4 |
| US-M16-40 | FT-M16-12.1 | Must | As the product owner, I want games and battles to use the owners' contracts for questions, coins, practice data, users and schools, and to feed teacher analytics, so that every module shows the same facts. | FN-M16-12.1.1–12.1.5 |

### Acceptance criteria

**US-M16-01 — Menu, titles and shells**
- **AC-M16-01.1** Given the admin at 1280px on a user-portal page, when the sidebar renders, then it shows "Sekolah Bersaing" with the badge "NEW" (`fa-trophy`) and a second "Sekolah Bersaing" → `/sekolah-bersaing`, "Liga Pertandingan" → `/liga`, "Permainan 🎮" (`fa-gamepad`) → `/permainan` and "Tournament" → `/tournament`, and no entry to `/battle`; at 375px the bottom nav has "Game" → `/permainan` and the drawer lists "Permainan 🎮", "Tournament" and "Sekolah Bersaing NEW".
- **AC-M16-01.2** Given the admin in the admin panel at 1280px, when the group "Battle & Permainan" is opened, then it lists "Battle Live" → `/battle`, "Ranking Sekolah" → `/battle/ranking-sekolah`, "Leaderboard" → `/battle/leaderboard`, "Tetapan Permainan" → `/admin/permainan`, and "✨ Visi & Pertandingan" has "Sekolah Bersaing"; at 768px the "Lagi" list shows "Battle Live" and "Tetapan Permainan"; clicking "Battle Live" opens `/battle` in the user-portal shell.
- **AC-M16-01.3** Given S1–S5 and S23–S27, when each loads, then the header shows the live title and subtitle of FN-M16-1.1.3 (e.g. S2 "Ranking Pelajar Battle" / "Siapa pejuang terhebat minggu ini?", S4 for 8106 "{school 8106}" / "Selangor · SMK", S27 for league 1 "Liga Sejarah 2026 5ST" / "Persahabatan · Sekolah").
- **AC-M16-01.4** Given S6–S21, when each loads, then the header shows the page title of FN-M16-1.1.3 ("Zona Permainan", "Papan Bijak", …, "Uji Minda") with "Selamat datang kembali", never "Dashboard" (DV-M16-01).
- **AC-M16-01.5** Given `/sekolah-bersaing`, when it loads for the admin, then it renders in the user-portal shell with the header "Sekolah Bersaing" / "Selamat datang kembali" (DV-M16-02); `/admin/permainan` renders in the admin panel with "🎮 Tetapan Permainan" / "Urus konfigurasi Papan Bijak, Kad Memori & permainan lain".
- **AC-M16-01.6** Given each of S1–S29, when it loads, then the tab title is the exact text of FN-M16-1.1.4.

**US-M16-02 — Access, errors and parameters**
- **AC-M16-02.1** Given no session, when I open `/battle`, `/permainan`, `/liga` or `/admin/permainan`, then I am sent to `/login` (provisional).
- **AC-M16-02.2** Given the student, when I open `/tournament/admin/create` or `/admin/permainan`, then I land on my M01 landing page, and `/tournament` shows no "Cipta Tournament Baru" (provisional).
- **AC-M16-02.3** Given the admin, when I open `/battle/arena`, `/battle/arena/00000000-0000-0000-0000-000000000000`, `/battle/riwayat`, `/tournament/1`, `/tournament/admin`, `/tournament/create`, `/liga/1/edit`, `/admin/permainan/1`, `/admin/battle`, `/admin/tournament` or `/papan-bijak/ZZZZZZ`, then the M01 404 page renders ("Halaman Tidak Dijumpai", "Halaman Utama", "Mula Latihan").
- **AC-M16-02.4** Given the admin, when I open `/liga/sertai` or `/permainan/roda-nasib/spin` directly, then the 404 page renders (DV-M16-33).
- **AC-M16-02.5** Given the admin, when I open `/battle/leaderboard?period=monthly`, then "Mingguan" is active; `/battle/ranking-sekolah?period=bogus` shows the 7 all-time rows with no active pill; `/permainan/pertandingan?week=1` equals the default page; `/permainan/jutawan?darjah=7` shows "📚 PILIH SUBJEK (TINGKATAN 1)"; `/sekolah-bersaing?week=2026-09-16` shows "Minggu **14 Sep 2026**".

**US-M16-03 — Tournament banner**
- **AC-M16-03.1** Given the default seed (no active tournament), when the admin opens `/dashboard`, `/permainan` and `/tournament`, then `GET /api/tournament/active` is called once per page load, returns `[]`, and no banner is rendered; no call is made on `/admin/permainan`.
- **AC-M16-03.2** Given the fixture "registration" tournament "Contoh Tournament Pendaftaran", when a user-portal page loads, then the top of the content shows one indigo card linking to `/tournament/{uuid}` with the title, "Pendaftaran dibuka" and the badge "DAFTAR" (provisional).
- **AC-M16-03.3** Given the fixtures "registration", "ongoing" and "live" tournaments, when a user-portal page loads, then three cards stack in API order: the second reads "Sedang berlangsung" without a badge, the third is red with "LIVE: {school A} vs {school B}" and the pulsing badge "MAIN" (provisional).
- **AC-M16-03.4** Given `mock.failNext('/api/tournament/active', 500)`, when a user-portal page loads, then no banner and no error message is shown, and the rest of the page renders.
- **AC-M16-03.5** Given the admin creates a tournament with "Cipta & Buka Pendaftaran", when any user-portal page loads, then the banner shows it with "Pendaftaran dibuka" and "DAFTAR"; a tournament saved with "Simpan Draf" never appears (provisional).

**US-M16-04 — Cross-cutting**
- **AC-M16-04.1** Given every M16 screen at 375px, when a sweep of all visible text nodes of the content area runs, then none renders below 12px (DV-M16-24), including every text listed in FN-M16-1.4.1 ("⚠ GARIS MAUT", "🏫 Sekolah Rendah", the S7 and S29 labels and help texts).
- **AC-M16-04.2** Given every M16 screen at 375, 768 and 1280px, when it renders, then the page has no horizontal scroll; the S2, S3, S7 and S27 tables scroll inside their card at 375px and the S27 "Purata" column is reachable (DV-M16-13); S4 of 8106 (whose seeded names include long ones) has no page scroll and its "Battle Terkini" list scrolls inside its card (DV-M16-37).
- **AC-M16-04.3** Given the seeded screens S3, S4, S7–S12, S20, S27, when they render, then every person's name is the M02 name of its fictitious user id (e.g. Perang Fakta #1 = {name 4326}) and the admin's name is "Admin Demo".
- **AC-M16-04.4** Given a quick match, a Papan Bijak quick match and a room with the same ids and seed, when they are replayed, then the bot opponents, their answers and the spin results are identical (deterministic streams) (provisional).

**US-M16-05 — Battle lobby selection**
- **AC-M16-05.1** Given the admin, when `/battle` loads, then the hero shows "Battle Arena", "BARU", "Cabar kawan, cari lawan, atau wakili sekolah anda!", "Biasa" is active, "Subjek Teras" lists Bahasa Melayu, Bahasa Inggeris, Matematik, Sains, Sejarah, Pendidikan Islam, Pendidikan Moral with their icons, and "Quick Match", "Cabar Kawan", "Battle Sekolah" are disabled.
- **AC-M16-05.2** Given the admin, when I click "Lagi 24 subjek lain", then 24 more tiles (Matematik Tambahan … Sains Sukan) appear and the toggle reads "Tutup"; when I pick "Matematik", then its tile is `border-red-500 bg-red-50` and the three mode buttons are enabled.
- **AC-M16-05.3** Given the admin, when I click "SPM", then the type stays "Biasa" and the tooltip "Khas untuk pelajar Tingkatan 4 & 5 sahaja" shows; a click elsewhere closes it.
- **AC-M16-05.4** Given the admin, when I click "PKSK", then "Pilih Domain PKSK" shows the 15 domains (Kecerdasan Insaniah … Artikulasi Penulisan) and "Pilih Tahap" shows "Tingkatan 1" and "Tingkatan 4" (DV-M16-31); the mode buttons enable only after a domain and a level are chosen.
- **AC-M16-05.5** Given the student (Tingkatan 4), when `/battle` loads, then "SPM" has no lock and selecting it shows the SPM subjects with Q-SPM-POOL > 0; picking one enables the mode buttons (provisional).
- **AC-M16-05.6** Given the admin, when I click "Ranking Pelajar" and "Ranking Sekolah", then I reach `/battle/leaderboard` and `/battle/ranking-sekolah`.

**US-M16-06 — Matchmaking**
- **AC-M16-06.1** Given the admin, when the "Keterlihatan Barisan" switch is off, then the subtitle reads "Hanya pelajar gred sama boleh match" with "Gred Saya"; switched on, "Semua gred boleh nampak & mohon sertai anda" with "Terbuka".
- **AC-M16-06.2** Given the admin with Matematik selected, when I click "Quick Match", then `POST /api/battle/quick-match` is sent with `{question_type: 'biasa', open_to_all: false, subject_id: 3}`, the card "Mencari Lawan..." "Menunggu pelajar sama darjah & subjek" "0:00" shows, and the time reads "0:03", "0:06" at the next polls (provisional for the timing of the bot).
- **AC-M16-06.3** Given a quick match in progress, when the bot is found on the 3rd poll, then the page goes to `/battle/arena/{uuid}` (provisional).
- **AC-M16-06.4** Given a search, when I click "Batal", then the lobby returns without any request to the server; the queue is never matched afterwards (provisional).
- **AC-M16-06.5** Given `mock.battleSim({mode: 'never'})`, when 120 s pass, then the search stops with "Tiada lawan dijumpai dalam masa 2 minit. Sila cuba lagi."; with mode `expired`, "Tiada lawan dijumpai. Sila cuba lagi."; with 5 consecutive failing polls, "Ralat berulang semasa mencari lawan. Sila cuba lagi."; with 5 network failures, "Ralat rangkaian berulang. Sila semak internet anda." (provisional).
- **AC-M16-06.6** Given a subject with no eligible question (Bahasa Cina, 19), when I click "Battle Sekolah", then the error banner reads "Ralat dari server. Sila cuba lagi." and its close button clears it (provisional).

**US-M16-07 — Incoming challenger and waiting**
- **AC-M16-07.1** Given a search and `mock.battleSim({mode: 'incoming'})`, when the next poll answers `incoming_challenge`, then the card shows "Cabaran Masuk!", "{bot name} ingin menyertai battle anda", the grade and school chips, "Soalan mengikut gred anda. Lawan akan bermain soalan gred anda.", "Terima" and "Tolak" (provisional).
- **AC-M16-07.2** Given the incoming card, when I click "Terima", then `POST /api/battle/accept-challenger/{queueId}` answers `{matched, battle_uuid}` and the arena opens; when I click "Tolak", then `reject-challenger` is sent and "Mencari Lawan..." returns (provisional).
- **AC-M16-07.3** Given the lobby, when it renders at any width, then no control starts a queue join and the "Menunggu Kelulusan..." card is not reachable (DV-M16-06); with the test hook `mock.battleWaiting(…)`, the card shows "Menunggu {name} menerima permohonan anda" and a `rejected` poll shows "{name} menolak permohonan anda." (provisional).

**US-M16-08 — Cabar Kawan and Cabaran Masuk**
- **AC-M16-08.1** Given the admin with Matematik selected, when I open "Cabar Kawan" and type one character, then no search request is sent; after "zzqxv" (300 ms), `GET /api/battle/search-opponent?q=zzqxv` returns no user and "Tiada pelajar dijumpai" shows; a click on the overlay closes the modal.
- **AC-M16-08.2** Given the admin searches "{first 3 letters of the name of 4326}", when the results show, then each row has the name, the school and a send icon; clicking it sends `POST /api/battle/invite` with `receiver_id: 4326`, alerts "Cabaran berjaya dihantar kepada {name 4326}!" and closes the modal (provisional).
- **AC-M16-08.3** Given the default seed, when `/battle` loads, then `GET /api/battle/invitations` returns `{invitations: []}` and the "Cabaran Masuk" modal stays closed.
- **AC-M16-08.4** Given the fixture invitation from {name 4301} of {school 8106}, when `/battle` loads, then the "Cabaran Masuk" modal opens by itself with the row and "Terima" / "Tolak" (DV-M16-06); "Terima" opens the arena; "Tolak" removes the row and shows "Tiada cabaran buat masa ini" (provisional).

**US-M16-09 — Arena**
- **AC-M16-09.1** Given a matched battle, when `/battle/arena/{uuid}` loads for one of its players, then both players, "Skor" 0 each, "Soalan 1/10", the question and four options "A. …"–"D. …" show; for another user or an unknown uuid the 404 page renders (provisional).
- **AC-M16-09.2** Given the arena, when I answer correctly after 3 s, then my score rises by 900 (1000 − round(500 × 3 ÷ 15)) and the bot's answer and score appear; a wrong answer adds 0 (provisional).
- **AC-M16-09.3** Given the arena, when I click "Tamatkan", then the confirm "Tamatkan battle ini? Anda akan dikira kalah." shows; OK sends `POST /api/battle/forfeit/{uuid}` and the result reads "Kalah" (provisional).
- **AC-M16-09.4** Given the last answer, when the battle ends, then the result shows "Menang", "Seri" or "Kalah" with both scores and the links "Mula Battle" and "Sejarah Battle"; the battle then appears first in S5 and in S4 "Battle Terkini" of the players' schools (provisional).

**US-M16-10 — Battle history**
- **AC-M16-10.1** Given the admin, when `/battle/history` loads, then it shows "Tiada sejarah battle", "Mulakan pertandingan pertama anda sekarang!" and "Mula Battle" → `/battle`.
- **AC-M16-10.2** Given the student after one finished battle, when `/battle/history` loads, then one row shows the two players, the scores (winner green) and "baru sahaja" (provisional).

**US-M16-11 — Student battle ranking**
- **AC-M16-11.1** Given the admin, when `/battle/leaderboard` loads, then "Mingguan" is active (`bg-red-500`) and the table "#", "Pelajar", "Sekolah", "M/S/K", "Ketepatan", "Streak", "Skor" shows "Belum ada data ranking. Mula battle untuk muncul di sini!".
- **AC-M16-11.2** Given the admin, when I click "Bulanan", then the pill turns active and the table lists the monthly standings computed from the battle records — {name 4316} and {name 4317}, "2/0/2" each (the four September battles of 8082 with 0–0 = win for B) — with PROPOSED ketepatan, streak and score (DV-M16-04, DV-M16-26) (provisional).
- **AC-M16-11.3** Given the student after winning one battle, when S2 loads, then "Mingguan" and "Bulanan" both list the student with "1/0/0" (provisional).

**US-M16-12 — School ranking**
- **AC-M16-12.1** Given the admin, when `/battle/ranking-sekolah` loads, then the hero reads "Papan Ranking Sekolah" / "Sekolah mana paling hebat? Wakili sekolah anda!", "Mingguan" is active (`bg-blue-500`), no podium shows and the table reads "Belum ada data ranking. Mula battle untuk melihat ranking sekolah!".
- **AC-M16-12.2** Given the admin, when I open "Bulanan", then one row shows #1 {school 8082} "Selangor · SMK", 8, "4/0/4", "58%", 2, 591.
- **AC-M16-12.3** Given the admin, when I open "Sepanjang Masa", then the 7 rows read 8106 19 12/1/6 69% 7 738; 8090 18 9/0/9 48% 2 519; 8078 40 20/0/20 29% 18 367; 8082 **10 5/0/5** 29% **4** 367 (computed from its 5 recorded battles, DV-M16-36); 8880 3 2/0/1 33% 1 340; 8080 30 15/0/15 24% 10 303; 2710 3 1/0/2 8% 1 87, and the podium shows 8106 738 in the raised centre, 8090 519 left and **8078** 367 right (DV-M16-09).
- **AC-M16-12.4** Given "Sepanjang Masa", when I choose "Johor" in the state select, then the URL becomes `?period=all_time&state=Johor`, the table lists #5 {school 8880} "Johor · SMK" and #7 {school 2710} "Johor · SK", the period links keep `&state=Johor`, and the podium still shows the national top 3.
- **AC-M16-12.5** Given the all-time table, when I click a school, then `/battle/ranking-sekolah/{id}` opens.

**US-M16-13 — School detail**
- **AC-M16-13.1** Given the admin, when `/battle/ranking-sekolah/8106` loads, then the hero shows {school 8106} and "PPD HULU LANGAT · Selangor · SMK", and the cards read "19" "Jumlah Battle", "12" "Kemenangan", "69%" "Ketepatan", "7" "Pelajar Aktif".
- **AC-M16-13.2** Given 8106, when the page loads, then "Minggu Ini" reads "Tiada data minggu ini" and "Bulan Ini" "Tiada data bulan ini" (DV-M16-10); for 8082, "Bulan Ini" reads "Ranking Nasional" "#1", "Battle" "8", "Menang/Seri/Kalah" "4/0/4", "Skor" "591".
- **AC-M16-13.3** Given 8106, when the page loads, then "Pejuang Terbaik Minggu Ini" reads "Tiada data pejuang minggu ini" and "Battle Terkini" lists 10 rows, newest first, the first "{name 4301}" (slate) 9445 vs **9763** (green) "{name 4302}" "2 bulan yang lepas" and the second 8830 vs 8830 with no green score.
- **AC-M16-13.4** Given school 900 (no battle), when its page loads, then the hero shows "PPD KUALA LANGAT · Selangor · SK", the cards 0 / 0 / 0% / 0 and every section its empty text including "Tiada battle terkini".
- **AC-M16-13.5** Given `/battle/ranking-sekolah/99999999`, when it loads, then the 404 page renders.
- **AC-M16-13.6** Given 8880 and 2710, when each loads, then the same 3 battles show, player {name 4320} in slate on the 8880 page and in blue on the 2710 page; the cards read 8880 "3" / "2" / "33%" / "1" and 2710 "3" / "1" / "8%" / "1"; on the 0–0 row the "0" of player B {name 4320} is green (DV-M16-35), so the list shows 2 wins and 1 loss for 8880.

**US-M16-14 — Games hub**
- **AC-M16-14.1** Given the admin, when `/permainan` loads, then it shows "🎮 Zona Permainan", the subtitle, "🌙", "Tiada bilik terbuka buat masa ini." and "Cipta bilik permainan dan jemput rakan-rakan!".
- **AC-M16-14.2** Given the admin, when the hub loads, then 18 cards show in the order Papan Bijak, Battle Arena, Perang Fakta, Benteng Ilmu, Perlumbaan Matematik, Kuiz Relay, Teka Silang Kata, Betul atau Salah, Roda Nasib, Pertandingan Mingguan, Peta Pengembaraan, Uji Minda, Cabaran Kilat, Jutawan Ilmu, Susun Jawapan, Tembak Jawapan, Sambung Kata, Kad Memori, with the badges, texts, chips and buttons of discovery A.3; the grid has 1 / 2 / 3 columns at 375 / 768 / 1280px.
- **AC-M16-14.3** Given the admin (6 Papan Bijak games, no battle), when the hub loads, then the Papan Bijak card has **no** "🆕 Belum main lagi" chip (DV-M16-14) and the Battle Arena card shows "🆕 Belum battle lagi"; for pelajar2 (no game, no battle) both chips show.
- **AC-M16-14.4** Given any card, when I click the card body or its button, then its route opens ("Jelajah" → `/peta-belajar`, "Mula!" on Sambung Kata → the error page of US-M16-31).
- **AC-M16-14.5** Given the fixture waiting room "PB1234" of Papan Bijak, when the hub loads, then the open-rooms strip shows it as a link to `/papan-bijak/PB1234` instead of the empty text (provisional).

**US-M16-15 — Papan Bijak create and join**
- **AC-M16-15.1** Given the admin, when `/papan-bijak` loads, then "🎲 Papan Bijak" and its subtitle show; "🆕 Cipta Bilik Baru" has "Subjek" (🔢 Matematik, 📝 Bahasa Melayu, 🔬 Sains, 🇬🇧 Bahasa Inggeris), the auto box "Darjah 4" "(auto dari profil anda)" "Tukar", "Siapa Boleh Join?" "Tahap sama sahaja", "Maks Pemain" "4 Pemain" and "🎲 Cipta Bilik".
- **AC-M16-15.2** Given the form, when I click "Tukar" and choose "Tingkatan 2", then the select shows the two optgroups, "← Guna auto" appears and the `same_level` option reads "Semua Tingkatan (1-5)"; "← Guna auto" restores the auto box.
- **AC-M16-15.3** Given the form, when I choose "Pilih julat khas", then "Dari" (D1) and "Hingga" (D6) appear with D1–D6 and T1–T5.
- **AC-M16-15.4** Given "🔑 Masuk Bilik", when I submit with an empty "Kod Bilik (6 aksara)", then the native required bubble shows and nothing is sent; the field accepts at most 6 characters.
- **AC-M16-15.5** Given the form, when I submit it with Matematik, Darjah 4, same grade, 4 players, then a room with a new 6-character code is created and `/papan-bijak/{code}` opens (provisional).
- **AC-M16-15.6** Given the admin, when the page loads, then "Cara Bermain:" lists the five lines "🎲 1. …" to "🏆 5. Sampai petak 50 dulu = MENANG!".

**US-M16-16 — Papan Bijak quick match**
- **AC-M16-16.1** Given the admin, when I click "🔍 Cari Lawan Sekarang", then `POST /papan-bijak/quick-match` is sent with `{subject: 'MATEMATIK', match_mode: 'same_grade'}` and the panel shows "Mencari lawan... 0s", then "1s", "2s" each second, "Sila tunggu, sistem sedang mencari pemain sepadan" and "Batal Carian" (provisional for the bot timing).
- **AC-M16-16.2** Given a search, when the 3rd poll answers `matched`, then `/papan-bijak/{room_code}` opens; when I click "Batal Carian" first, then `POST /papan-bijak/quick-match/cancel` is sent and the panel returns to idle (provisional).
- **AC-M16-16.3** Given `mock.pbQuickMatch({mode: 'expired'})`, when the poll answers `expired`, then the panel returns to idle and "Tiada lawan dijumpai. Cuba lagi!" stays visible under the button until the next search (DV-M16-20) (provisional).

**US-M16-17 — Papan Bijak top 10**
- **AC-M16-17.1** Given the admin, when `/papan-bijak` loads, then "🏆 Papan Markah — Top 10 Juara" lists 10 rows: 🥇 "Admin Demo" 4 / 6 / "67%" (amber) / 90 / 13; 🥈 {name 4320} 3 / 4 / "75%" (green) / 170 / 9; 🥉 {name 4352} 2 / 4 / "50%" / 230 / 18; 4 {name 4353} 2 / 8 / "25%" (red) / 225 / 46; … 10 {name 4358} 2 / 3 / "67%" / 60 / 10.
- **AC-M16-17.2** Given a name longer than 15 characters, when the row renders, then it shows the first 15 characters and "..." and the initials circle.

**US-M16-18 — Lobbies S8–S12**
- **AC-M16-18.1** Given the admin, when `/perang-fakta`, `/benteng-ilmu`, `/perlumbaan-matematik`, `/kuiz-relay` and `/teka-silang-kata` load, then each shows its h1, subtitle and rule line of FN-M16-5.4.1.
- **AC-M16-18.2** Given a lobby, when it loads, then "🏠 Cipta Bilik Baru" has "Subjek" (Matematik, Bahasa Melayu, Bahasa Inggeris, Sains, Sejarah), "Darjah 4 (auto)" + "Tukar", "Siapa boleh join?" and the button "{emoji} Cipta Bilik"; "Tukar" shows the "Tahap" select with Darjah 4 preselected and no way back.
- **AC-M16-18.3** Given "🔑 Masuk Dengan Kod", when I type "abc123", then it shows "ABC123"; an empty submit is not blocked by the browser (not required).
- **AC-M16-18.4** Given the admin, when `/perang-fakta` loads, then "🏆 Pendahulu" lists 10 rows "🥇 {name 4326}" "5 menang", "🥈 {name 4327}" "4 menang", "🥉 {name 4328}" "3 menang", "4. {name 4329}" "3 menang" … "10. {name 4334}" "2 menang"; Kuiz Relay lists one row "🥇 {name 4331}" "1 kali MVP"; the order is the same on every load (DV-M16-08).
- **AC-M16-18.5** Given the admin, when I open `/perang-fakta/XXXXXX`, then I land on `/perang-fakta` with the red flash "Bilik tidak dijumpai." at the top of the lobby, visible without scrolling at 375px (DV-M16-07); the same for the other four lobbies.
- **AC-M16-18.6** Given a lobby, when I submit "🔑 Masuk Dengan Kod" with an unknown code, then the lobby shows the same flash (provisional).

**US-M16-19 — Rooms**
- **AC-M16-19.1** Given a new Perang Fakta room, when `/perang-fakta/{code}` loads, then the room code, the host and "Mula" (disabled) show; after the next polls a bot joins and "Mula" enables at 2 players (provisional).
- **AC-M16-19.2** Given a started Perang Fakta room, when I play, then 15 rounds of one statement each run with a 10 s clock and the result shows the winner and every player's points (provisional).
- **AC-M16-19.3** Given a finished room that I win, when I return to its lobby, then my win count in "🏆 Pendahulu" rose by 1 and S29 "Selesai" rose by 1 (provisional).
- **AC-M16-19.4** Given a Papan Bijak room, when it starts, then the board has 50 tiles with 3 ladders, 3 snakes, 2 bonus, 2 traps and 35 quiz tiles (the S29 setting) (provisional).

**US-M16-20 — Darjah picker**
- **AC-M16-20.1** Given the admin, when `/permainan/betul-salah` loads without `?darjah`, then the overlay shows "✅", "Betul atau Salah", "Pilih darjah / tingkatan kamu:", "🏫 Sekolah Rendah", "Darjah 1"–"Darjah 4" and "← Kembali ke Hub"; the countdown and the clock have not started and no submit is sent even after 60 s (DV-M16-18).
- **AC-M16-20.2** Given the overlay, when I click "Darjah 4", then `?darjah=4` loads and the countdown starts; "← Kembali ke Hub" returns to `/permainan`.
- **AC-M16-20.3** Given S14, S15, S16 and S19, when each loads without `?darjah`, then the same overlay shows with the game's emoji and title.

**US-M16-21 — Betul atau Salah**
- **AC-M16-21.1** Given `?darjah=4`, when the page loads, then "✅❌ BETUL ATAU SALAH" counts 3, 2, 1 (800 ms each) and playing starts with "Skor" 0, "45", "Betul" 0 and "Kenyataan 1".
- **AC-M16-21.2** Given playing, when I answer 6 statements correctly in a row, then "🔥 6 KOMBO" shows with the `hot` class and the score equals Σ (10 + min(streak,10) × 2) with the streak counted after each answer (the order the M14 ledger row "Betul/Salah: 3 betul, streak 2" +4 confirms) = 12 + 14 + 16 + 18 + 20 + 22 = 102.
- **AC-M16-21.3** Given 45 s pass, when the game ends, then the result shows the title for the score, "45 saat — Betul atau Salah!", "Skor Total", "Ketepatan" `{betul}/{jawab}`, "Kombo Max" "{n} 🔥", "Syiling" "0 🪙", "🔄 Main Lagi" and "🎮 Hub", and `POST /permainan/betul-salah/submit` was sent once.
- **AC-M16-21.4** Given the admin (personal best 38), when the score is 102, then "🏆 REKOD BARU!" shows; with a score of 20 it does not.

**US-M16-22 — Cabaran Kilat**
- **AC-M16-22.1** Given `?darjah=4`, when playing starts, then "Soalan 1" with a difficulty chip ("Mudah" / "Sederhana" / "Sukar") and four options "A. …"–"D. …" show with "60" on the clock.
- **AC-M16-22.2** Given playing, when I pick the correct option, then it turns `correct`, all options disable, the score rises by 10 × combo and the next question comes after 400 ms; a wrong pick turns `wrong` and resets the combo.
- **AC-M16-22.3** Given 60 s pass, when the result shows, then it reads "60 saat penuh aksi!", "Skor Total", "Betul / Jawab", "Combo Max 🔥" "{n}x", "Syiling" "0 🪙", "⚡ Main Lagi", "🎮 Hub"; "🏆 REKOD BARU!" only above the personal best 40.

**US-M16-23 — Tembak Jawapan**
- **AC-M16-23.1** Given `?darjah=4`, when the countdown ends, then the HUD shows "Skor" 0, "Level" 1, three ❤️ and "🪙" 0, "Soalan 1" and tiles falling in the 500 px zone above "⚠ GARIS MAUT".
- **AC-M16-23.2** Given playing, when I tap 5 correct tiles, then "⚡ LEVEL 2!" shows for 1.2 s and "Level" reads 2; a wrong tap fades one ❤️.
- **AC-M16-23.3** Given three lives are lost, when the game ends, then the result shows "Tembak Jawapan — Level {n}", "Skor Total", "Ketepatan", "Tertinggi" "Level {n}", "Syiling" "0 🪙", "🔄 Main Lagi", "🎮 Hub".

**US-M16-24 — Susun Jawapan**
- **AC-M16-24.1** Given `?darjah=4`, when the game shows, then "Kembali", "Skor 0", "🪙 0", "🧩 Susun Jawapan", 20 dots, "Soalan 1 daripada 20", the question, "📥 Jawapan Kamu:" with "Klik huruf/perkataan di bawah untuk susun", "🔤 Pilihan:" tiles, a disabled "✅ Semak Jawapan" and "⏭️ Langkau Soalan Ini".
- **AC-M16-24.2** Given I place the tiles of the answer, when I click "✅ Semak Jawapan", then "🎉 BETUL! +{points} mata" and "Seterusnya →" show and "Skor" rises by the points.
- **AC-M16-24.3** Given a wrong arrangement, when I check, then "❌ Cuba lagi atau langkau", "🔄 Cuba Lagi" (tiles return) and "⏭️ Langkau" show; clicking a placed tile returns it to "🔤 Pilihan:".
- **AC-M16-24.4** Given the 20th puzzle is solved or skipped, when the result shows, then it reads the title for the ratio, "Susun Jawapan selesai!", "Skor Total", "Selesai" "{solved}/20", "Syiling Diperolehi" "0 🪙", "🔄 Main Lagi", "🎮 Hub".

**US-M16-25 — Kad Memori**
- **AC-M16-25.1** Given the admin, when `/permainan/kad-memori` loads, then "🃏 Kad Memori", "Padankan soalan dengan jawapan yang betul!", "⏱️ 0:00" counting up, "👆 0 langkah", "✅ 0 / 6 padan" and 12 face-down cards "❓" (4 × 3) show, without a darjah picker.
- **AC-M16-25.2** Given two cards of different pairs, when I flip them, then they show `wrong` and turn back after 800 ms and "langkah" reads 1; a matching pair stays open and "padan" reads 1.
- **AC-M16-25.3** Given all 6 pairs are matched, when the overlay shows, then it reads "🎉", "Tahniah!", "Semua kad berjaya dipadankan!", "Masa", "Langkah", "Ketepatan" "{n}%", "Syiling 🪙" "+0", "🔄 Main Lagi", "🏠 Hub"; a click outside does not close it.

**US-M16-26 — Game sessions and coins**
- **AC-M16-26.1** Given the admin opens S13–S17, when each loads, then its payload has the SOURCE counts (40 statements, 30 MCQ, 30 MCQ, 20 puzzles, 12 cards) drawn from M04 eligible questions (every item id exists in the M04 store) and a session id with the game prefix.
- **AC-M16-26.2** Given a finished game, when the submit is sent, then the body has the SOURCE fields of the game and the answer has `is_new_record` and `syiling_awarded`; the result is stored once (a second submit of the same session answers 409) (provisional).
- **AC-M16-26.3** Given the M14 seed (`games_award_syiling` = 0), when a game loads, then its payload has `canEarnSyiling: false` (M14 `canEarnSyiling(userId)`) and the in-game counters ("🪙" of Tembak and Susun) stay 0 while playing; when it ends, every syiling figure shows 0, no coin-fly plays and the M14 wallet does not change (DV-M16-23).
- **AC-M16-26.4** Given the M14 setting 1 (fixture), when Cabaran Kilat ends with 3 correct answers in a row, then "Syiling" shows 6 (1 + 2 + 3) and the M14 wallet rises by 6 (provisional).

**US-M16-27 — Roda Nasib**
- **AC-M16-27.1** Given the admin, when `/permainan/roda-nasib` loads, then "🎯 Roda Nasib", "Pusing roda sekali sehari untuk hadiah misteri!", "🎰 2 kali spin", "🪙 0 Syiling dimenangkan", the wheel with 8 segments and an enabled "🎯 SPIN!" show.
- **AC-M16-27.2** Given the admin, when I click "🎯 SPIN!", then the button reads "⏳ Sedang Pusing...", the wheel turns for 4.2 s, the prize modal shows the icon and label of the segment chosen by the stream `m16:spin:1:2026-09-25`, and afterwards the button reads "✅ Sudah Spin Hari Ini" (disabled) and "🎰 3 kali spin".
- **AC-M16-27.3** Given a `syiling` segment with the M14 seed, when the modal shows, then "+{n} Syiling" and "Ditambah ke akaun kamu!" are not shown and "🪙 0 Syiling dimenangkan" stays (DV-M16-23); with the setting 1 (fixture), "+5 Syiling" and "Ditambah ke akaun kamu!" show and the chip reads "🪙 5 Syiling dimenangkan" (provisional).
- **AC-M16-27.4** Given the "Cuba Lagi" segment (fixture seed), when the modal shows, then "😅", "Cuba Lagi" and "Jangan risau, cuba lagi esok!" show; "Tutup" closes it.
- **AC-M16-27.5** Given the admin already spun today, when the page loads, then "✅ Sudah Spin Hari Ini" is disabled; a forced spin request answers 409 and `alert("Anda sudah spin hari ini.")` (provisional); at 00:00 MYT the next day the button is enabled again (provisional).

**US-M16-28 — Jutawan Ilmu**
- **AC-M16-28.1** Given the admin, when `/permainan/jutawan` loads, then the picker overlay (amber hover) shows, and behind it "💰 Jutawan Ilmu", "Pilih subjek, jawab 15 soalan — menang sampai 1,000 Syiling!", "L0" "Rekod Tertinggi", "0" "Permainan", "1,000🪙" "Hadiah Utama", "👆" and "Pilih darjah atau tingkatan di atas untuk mula.".
- **AC-M16-28.2** Given `?darjah=4`, when the page loads, then "📚 PILIH SUBJEK (DARJAH 4)" lists "📝 Bahasa Melayu 579 soalan", "🇬🇧 Bahasa Inggeris 563 soalan", "🔢 Matematik 1077 soalan", "🔬 Sains 616 soalan", "📜 Sejarah 660 soalan", "☪️ Pendidikan Islam 369 soalan", "💛 Pendidikan Moral 312 soalan", "🌍 Geografi 200 soalan", "🕌 Bahasa Arab 500 soalan", "📖 Jawi 400 soalan", each → `/permainan/jutawan/main?subject={id}&darjah=4`.
- **AC-M16-28.3** Given `?darjah=10` and `?darjah=11`, when each loads, then the headings read "(TINGKATAN 4)" / "(TINGKATAN 5)" with the 20 subjects and counts of discovery A.7.
- **AC-M16-28.4** Given the Jutawan game for Matematik Darjah 4, when I answer 3 questions correctly and the 4th wrong, then the game ends at "L3", and back on S19 "Rekod Tertinggi" reads "L3" and "Permainan" "1" (provisional).
- **AC-M16-28.5** Given the game, when I use "50:50", then two wrong options disappear and the lifeline count drops from 3 to 2 (provisional).

**US-M16-29 — Pertandingan Mingguan**
- **AC-M16-29.1** Given the admin, when `/permainan/pertandingan` loads, then it shows "🏆 Pertandingan Mingguan", "Lumba dengan semua pelajar! Top 3 dapat Syiling bonus.", "📅 Minggu Ini" "21 Sep — 27 Sep 2026", "⏳ Tamat dalam" "2h 8j 19m" (to Sunday 23:59:59 MYT, DV-M16-17).
- **AC-M16-29.2** Given the page, when a minute passes, then the countdown reads "2h 8j 18m"; at Sunday 23:59:59 MYT it reads "Tamat!".
- **AC-M16-29.3** Given the page, when it renders, then the prizes read "🥇" "Juara" "+100 🪙", "🥈" "Naib Juara" "+50 🪙", "🥉" "Tempat Ketiga" "+25 🪙" in 3 columns at every width.
- **AC-M16-29.4** Given the admin (no practice session this week), when the page loads, then "📝", "Belum mula lagi minggu ini!", "Buat Latih Tubi untuk masuk ranking." and "Mula Latih Tubi" → `/practice` show.
- **AC-M16-29.5** Given the seed at the project clock, when "📊 Papan Ranking Mingguan" renders, then it lists the 20 users of M05 Q-WEEK-RANK (SRS §6.11.4): 🥇 {name 2022} "23 sesi" "450" "betul" "99.6%" "tepat", 🥈 {name W2} "18 sesi" "329" "99.7%", 🥉 {name W4} "15 sesi" "187" "90.7%" with the amber background, then 4 {name W3} 11 · 145 · 61.4%, 5 {name W5} 4 · 118 · 73.8%, 6 … 100 · 75.0%, and pelajarmaju at rank 14 (26, before the other 26 on user id) (provisional until M05 and M17 confirm XR-M16-03 / XR-M16-09).
- **AC-M16-29.6** Given the student with completed sessions this week, when the page loads, then the own-status card reads "📊 Kedudukan kamu: #{rank} · {betul} betul" (PROPOSED COPY) (provisional).

**US-M16-30 — Uji Minda**
- **AC-M16-30.1** Given the admin, when `/permainan/uji-minda` loads, then it shows "Permainan", "🧠", "Uji Minda", "Cabaran khas dari ibu/bapa kamu! Tapi ibu/bapa kamu belum tetapkan cabaran lagi.", the box "Bagaimana nak mula?" with "Cabaran Uji Minda" in bold, "📋 Apa Ibu/Bapa boleh tetap:" and the four "✅" lines.

**US-M16-31 — Sambung Kata**
- **AC-M16-31.1** Given the admin, when `/permainan/sambung-kata` loads, then the handled error page shows "500", "⚙️", "Ralat Pelayan", "Sesuatu tidak kena di pihak kami. Pasukan teknikal telah dimaklumkan. Sila cuba sebentar lagi.", "Halaman Utama" → `/` and "Cuba Semula" (reload) at every width (DV-M16-03).

**US-M16-32 — Tournament list**
- **AC-M16-32.1** Given the admin, when `/tournament` loads, then it shows "Liga & Tournament", "Bertanding antara sekolah dalam format liga, kalah mati, atau hibrid!", "Cipta Tournament Baru" → `/tournament/admin/create` and "Tiada tournament aktif buat masa ini.".
- **AC-M16-32.2** Given the fixtures "registration" and "ongoing", when `/tournament` loads, then two cards list the titles with "Pendaftaran dibuka" and "Sedang berlangsung", each linking to `/tournament/{uuid}` (provisional).

**US-M16-33 — Create tournament**
- **AC-M16-33.1** Given the admin, when `/tournament/admin/create` loads, then "Maklumat Asas", "Format" (Hibrid selected, "Bilangan Kumpulan" 2), "Sumber Soalan" (Mengikut Mata Pelajaran selected, "Mata Pelajaran" "-- Pilih --"), "Soalan & Masa" (40, 60), "Pemarkahan" (20, 10 with their help texts) and "Pendaftaran" (two empty date-times) show with "Batal", "Simpan Draf" and "Cipta & Buka Pendaftaran".
- **AC-M16-33.2** Given the form, when I choose "Kalah Mati" or "Perlawanan Tunggal", then "Bilangan Kumpulan" hides; "Liga" and "Hibrid" show it.
- **AC-M16-33.3** Given the form, when I choose "Mengikut Kertas Peperiksaan", then "Kertas Peperiksaan" shows only "-- Pilih --"; "Campuran Rawak" shows 31 subject checkboxes A→Z.
- **AC-M16-33.4** Given "Mata Pelajaran", when I choose Bahasa Melayu, then "Jumlah Soalan" becomes 25 and "Standard SPM Kertas 1: 25 soalan" shows; when I then choose Bahasa Arab, both stay unchanged.
- **AC-M16-33.5** Given the page at 1280px, when it renders, then "Simpan Draf" is visible as a grey button with white text and `fa-save` (DV-M16-27).
- **AC-M16-33.6** Given the empty form, when I click "Cipta & Buka Pendaftaran", then native required bubbles block the submit (title, level, questions, time window, Top-N, minimum participants) and nothing is sent.
- **AC-M16-33.7** Given a valid form, when I click "Cipta & Buka Pendaftaran", then the tournament is created with status `registration`, I return to `/tournament` with the PROPOSED flash and it is listed; with "Simpan Draf" it is created as `draft` and not listed (provisional).
- **AC-M16-33.8** Given "Batal", when I click it, then `/tournament` opens without a request.

**US-M16-34 — Tournament detail**
- **AC-M16-34.1** Given the fixture "registration" tournament, when I open it from the banner, then its page shows the title, "Pendaftaran dibuka" and the saved settings read-only (provisional).
- **AC-M16-34.2** Given an unknown uuid, when `/tournament/{uuid}` loads, then the 404 page renders.

**US-M16-35 — League list and join**
- **AC-M16-35.1** Given the admin, when `/liga` loads, then "Cipta Liga Baru", "Sertai dengan Kod", the tabs "Liga Saya (0)" (active) / "Liga Terbuka (1)" and "Belum menyertai mana-mana liga" "Cipta liga baru atau sertai menggunakan kod jemputan" show.
- **AC-M16-35.2** Given the admin, when I open "Liga Terbuka (1)", then one card shows "Liga Sejarah 2026 5ST", "Akan Datang", "Sekolah" (DV-M16-12), "Persahabatan", "Sejarah", "31/03 - 01/04/2026", "3 sekolah", "Lihat →" → `/liga/1`.
- **AC-M16-35.3** Given the admin, when I click "Sertai dengan Kod", then the modal "Sertai Liga" shows "Masukkan kod jemputan 8 aksara yang diberikan oleh penganjur." and the input "cth: AB12CD34" (max 8); an empty "Sertai" shows the required bubble; "Batal" closes and reopening shows the typed code.
- **AC-M16-35.4** Given the student (school 900001), when I join with "RMU4VCBS", then school 900001 joins league 1, "/liga/1" opens with the PROPOSED success flash and "Liga Saya (1)" lists it; an unknown code shows the PROPOSED error flash (provisional).

**US-M16-36 — Create league**
- **AC-M16-36.1** Given the admin, when `/liga/cipta` loads, then the fields of FN-M16-9.2.1–9.2.3 show with their options, "Campuran" and "Jumlah Markah" selected, and the 11 level checkboxes in 3 columns at 375px and 6 at 1280px.
- **AC-M16-36.2** Given the empty form, when I click "Cipta Liga", then native bubbles block the submit; "Batal" → `/liga`.
- **AC-M16-36.3** Given a valid form, when I click "Cipta Liga", then the league gets an 8-character code, status "Akan Datang", the creator line with my name, and `/liga/{id}` opens with the PROPOSED flash (provisional).

**US-M16-37 — League detail**
- **AC-M16-37.1** Given the admin, when `/liga/1` loads, then the header shows "Akan Datang" with a dot, "Sejarah", "31/03 - 01/04/2026", "3 sekolah", "Jumlah Markah", "Dicipta oleh {name 4401} · Tingkatan: T5", "Kod Jemputan" "RMU4VCBS" and "Sertai Liga Ini".
- **AC-M16-37.2** Given league 1, when I click "Kongsi", then a new tab opens `https://wa.me/?text=Jom+sertai+Liga+Pertandingan+%22Liga+Sejarah+2026+5ST%22+di+PrestasiPlus%21+Kod+Jemputan%3A+RMU4VCBS+%E2%80%94+prestasiplus.my%2Fliga+%F0%9F%8F%86`.
- **AC-M16-37.3** Given league 1, when the page loads, then "Sekolah Peserta" lists {school 8080}, {school 8082}, {school 8106} and "Papan Pendahulu" shows "Belum ada data papan pendahulu" and "Data dikemas kini setiap jam".
- **AC-M16-37.4** Given the admin, when `/liga/2` loads, then "Tamat", "Bahasa Melayu", "01/04 - 30/04/2026", "2 sekolah", "Jumlah Markah", "Dicipta oleh Admin Demo · Tingkatan: T4, T5", "TEST2026", no "Sertai Liga Ini", and the tabs "T4" (active) / "T5"; T4 lists 1 {school 8090} "PPD HULU LANGAT, Selangor" 8 "2,935.0" "77.2%" and 2 {school 8078} 0 "0.0" "0.0%"; T5 lists both with 0.
- **AC-M16-37.5** Given league 2 at 375px, when the leaderboard renders, then the table scrolls inside its card and "Purata" is reachable (DV-M16-13).
- **AC-M16-37.6** Given `/liga/3`, `/liga/0` or `/liga/999`, when it loads, then the 404 page renders.
- **AC-M16-37.7** Given the student, when I click "Sertai Liga Ini" on league 1, then my school joins and the button disappears (provisional).

**US-M16-38 — Sekolah Bersaing**
- **AC-M16-38.1** Given the admin, when `/sekolah-bersaing` loads, then the hero "🏆 Sekolah Bersaing" with its subtitle, "Minggu **21 Sep 2026** · **49** sekolah dalam pertandingan" and the header "#", "Sekolah", "% Aktif", "Streak Avg", "Nota/Pelajar" show.
- **AC-M16-38.2** Given the page at 1280px, when it renders, then 49 rows show; the first three are 🥇 (gold) Kelantan "0.0%" "🔥 15.0" "0.0", 🥈 (silver) Johor "🔥 9.3", 🥉 (bronze) Sabah "🔥 8.6"; row "#17" is Selangor "0.5%" "🔥 1.6"; row "#49" Selangor "🔥 0.0".
- **AC-M16-38.3** Given the page at 375px, when it renders, then "Streak Avg" and "Nota/Pelajar" are hidden and "aktif" is 12px.
- **AC-M16-38.4** Given the page, when it renders, then the footer reads "💡 **Untuk Cikgu Besar / PIBG:** Share ranking ini ke parent group WhatsApp. …".
- **AC-M16-38.5** Given `?week=2026-09-14`, `?week=2026-09-07`, `?week=2026-08-31`, when each loads, then "Minggu 14 Sep 2026 · 48", "07 Sep 2026 · 48" and "31 Aug 2026 · 48" show with 48 rows; `?week=2025-01-06` shows the hero and "📊 Data minggu ini belum dijana." "Cron mingguan akan kira pada Isnin pagi. Tunggu kejap ya."; on 14 Sep row 18 is Kelantan "0.0%" "🔥 2.4" and row 20 Kuala Lumpur "🔥 1.5"; on 31 Aug row 17 is Selangor "0.2%" "🔥 1.7"; none of the three weeks contains the 21 Sep row #46 (Sabah).
- **AC-M16-38.6** Given `?week=bogus`, when the page loads, then the current week (21 Sep 2026, 49) shows (DV-M16-30).

**US-M16-39 — Game settings**
- **AC-M16-39.1** Given the admin, when `/admin/permainan` loads, then the tiles read "160" "Jumlah Bilik", "0" "Sedang Aktif", "0" "Selesai", "189" "Pemain Unik".
- **AC-M16-39.2** Given the card "Papan Bijak", when it loads, then "Bilangan Petak Soalan" is 35 with "petak" and the help text, and the breakdown reads 35, 6, 4, 3, 2 with the bar "35 soalan", "10 khas", "3 biasa".
- **AC-M16-39.3** Given the field, when I type 38, then the breakdown reads "Petak biasa (jalan kosong):" 0 and "38 soalan"; with 0 it reads 38 plain tiles; with 50, "Simpan Tetapan" shows the native range bubble and nothing is sent.
- **AC-M16-39.4** Given "Senarai Permainan", when it renders, then three cards show "Papan Bijak" "Ular & tangga dengan soalan kuiz. Multiplayer 2-6 pemain." (DV-M16-15), "Kad Memori" "Padankan soalan dengan jawapan. 6 pasangan (12 kad).", "Battle Arena" "1v1 kuiz battle masa nyata. Pilih lawan & subjek.", each "Aktif" and "Lihat" (new tab) to its route.
- **AC-M16-39.5** Given the value 30, when I click "Simpan Tetapan", then the setting is saved, the page shows the PROPOSED flash and 30 after a reload, and a new Papan Bijak room uses 30 quiz tiles (provisional).

**US-M16-40 — Contracts with other modules**
- **AC-M16-40.1** Given any finished game, room, battle, spin or Jutawan game, when it is stored, then `gamification.onGameResult` is called once with `{game, event, coins, xp, correct, total, detail}` and the displayed syiling equals the returned `coinsCredited` (provisional until M14 accepts XR-M16-02).
- **AC-M16-40.2** Given finished games and battles, when the M05 answer log is counted, then Q-ANS-ALL is unchanged (478,499 at the clock); game and battle questions are M04 ids.
- **AC-M16-40.3** Given the M11 teacher view of a class whose student finished one battle and two games today, when the "Pecahan Aktiviti" panel loads, then "Battle" reads 1 and "Permainan" 2 (provisional until M11 adopts XR-M16-05).
- **AC-M16-40.4** Given the seed, when the M02 users and schools datasets are counted, then their totals are unchanged by the M16 anchors (users 4301–4377 except 4351, and 4401; schools 2710, 8078, 8080, 8082, 8090, 8106, 8880, 900 and the Sekolah Bersaing rows) (provisional until M02 accepts XR-M16-04).

---

## 5. UI expectations

| Screen | Key states (screenshots in `docs/discovery/img/M16/`) | Behaviour notes |
|---|---|---|
| S1 | default, subject selected, PKSK, SPM tip, challenge modal, searching, incoming, waiting, error, invitations (`battle-*.png`) | type row one flex row at every width; subject tiles 2 / 3 / 4 columns; mode buttons 1 column below `md`, 3 at `md`+; ranking links 2 columns; modals full width minus padding at 375; SPM tip dark tooltip. |
| S2 | default, mobile (`battle-leaderboard-*.png`) | pills; table scrolls in its card at 375 (4 of 7 columns visible). |
| S3 | all time, weekly empty, mobile (`battle-ranking-sekolah-*.png`) | podium 3 columns at every width; state select; table scrolls in its card at 375. |
| S4 | show, empty, mobile (`battle-ranking-sekolah-show*.png`) | cards 2 columns below `md`, 4 at `md`+; period boxes stacked below `md`. |
| S5 | `battle-history.png` | empty card centred. |
| S6 | desktop, tablet, mobile (`permainan-*.png`) | cards 1 / 2 / 3 columns; whole card clickable; badges ≥ 12 px (DV-M16-24). |
| S7 | desktop, custom range, searching, mobile (`papan-bijak-*.png`) | create / join 1 column below `md`; Top 10 scrolls in its card; labels ≥ 12 px. |
| S8–S12 | desktop, manual grade, room not found, mobile (`perang-fakta-*.png` and the four other lobbies) | create / join 1 column below `sm`; flash at the top (DV-M16-07). |
| S13–S16 | picker, countdown, playing, done (`betul-salah-*.png`, `cabaran-kilat-*.png`, `tembak-jawapan-*.png`, `susun-jawapan-*.png`) | full-screen game layouts; picker overlay covers the viewport and nothing runs under it (DV-M16-18); Tembak fall zone 500 px tall at every width. |
| S17 | desktop, complete, mobile (`kad-memori-*.png`) | 4 × 3 cards (98 px at 375, 151 px at 768 / 1280). |
| S18 | desktop, prize, mobile (`roda-nasib-*.png`) | canvas 320 px at 375, 380 px otherwise. |
| S19 | picker, subjects, mobile (`jutawan-*.png`) | subjects 1 column below `md`, 2 at `md`+. |
| S20 | desktop, mobile (`pertandingan-*.png`) | prize grid 3 columns at every width; ranking rows full width. |
| S21 | `uji-minda.png` | single card. |
| S22 | — (browser 500 on live) | handled error page (DV-M16-03). |
| S23 | `tournament-desktop.png` | hero and empty card. |
| S24 | desktop, random mix, SPM note, mobile (`tournament-create-*.png`) | form grids 1 column below `md`; radio cards wrap; "Simpan Draf" visible (DV-M16-27). |
| S25 | desktop, open tab, join modal, mobile (`liga-*.png`) | tabs; modal full width at 375. |
| S26 | desktop, mobile (`liga-cipta-*.png`) | form 1 column below `sm`; levels 3 / 6 columns. |
| S27 | upcoming, ended, ended mobile (`liga-show-*.png`) | chips wrap; leaderboard table scrolls in its card at 375 (DV-M16-13). |
| S28 | desktop, mobile, week empty (`sekolah-bersaing-*.png`) | user-portal shell (DV-M16-02); 2 columns hidden below 768. |
| S29 | desktop, mobile (`admin-permainan-*.png`) | tiles 2 columns below `md`; labels ≥ 12 px. |
| S30 | `tournament-banner-states.png`, `tournament-banner-mobile.png` | cards full width of the content area at every width; stacked. |
| Arena, rooms, tournament detail, Jutawan game | none (not observable) | PROPOSED minimal layouts of SRS §8.2, built from observed components; provisional. |

Loading: every screen shows the shared loading behaviour while the mock responds (live pages are server-rendered). The single-player games show their countdown only after the payload arrives. Errors outside the observed copy use the global error convention of M01. Success and error messages after a POST were never observed on live; they are PROPOSED COPY (SRS §8.2) and every AC asserting them is provisional.

---

## 6. Coverage matrix (completeness proof)

Source: `docs/discovery/inventory/M16/` (generated 2026-09-26). Generated by script (`matrix.cjs` in the author's scratchpad `m16-writer/`, from the Function catalogue `fns.cjs` and the inventory JSON). Every M16 content element (S1–S30) is listed with the Function that covers it; each element maps to exactly one entry. The tournament banner templates ("LIVE:", "MAIN", "DAFTAR") on every user-portal screen are M16's own and map to FN-M16-1.3.1; S30's host-page elements (it was captured on `/permainan` and `/tournament`) map to the S6 and S23 Functions; S22's elements are the browser's 500 page, mapped to the Function that replaces it (FN-M16-7.5.1). The shells (SHA, SHU) belong to the global shell / M23; their M16-relevant elements (menu entries, header titles and subtitles) are mapped and every other shell element is excluded with its owner. "Content" quotes the element text (first 80 characters), then name, type, target and icon.

**Summary**

| Set | Elements | Mapped to an M16 Function | Excluded (with reason) | Unmapped |
|---|---|---|---|---|
| S1 — `/battle` | 123 | 123 | 0 | 0 |
| S2 — `/battle/leaderboard` | 7 | 7 | 0 | 0 |
| S3 — `/battle/ranking-sekolah` | 37 | 37 | 0 | 0 |
| S4 — `/battle/ranking-sekolah/{id}` | 51 | 51 | 0 | 0 |
| S5 — `/battle/history` | 7 | 7 | 0 | 0 |
| S6 — `/permainan` | 96 | 96 | 0 | 0 |
| S7 — `/papan-bijak` | 59 | 59 | 0 | 0 |
| S8 — `/perang-fakta` | 37 | 37 | 0 | 0 |
| S9 — `/benteng-ilmu` | 37 | 37 | 0 | 0 |
| S10 — `/perlumbaan-matematik` | 37 | 37 | 0 | 0 |
| S11 — `/kuiz-relay` | 31 | 31 | 0 | 0 |
| S12 — `/teka-silang-kata` | 37 | 37 | 0 | 0 |
| S13 — `/permainan/betul-salah` | 65 | 65 | 0 | 0 |
| S14 — `/permainan/cabaran-kilat` | 63 | 63 | 0 | 0 |
| S15 — `/permainan/tembak-jawapan` | 74 | 74 | 0 | 0 |
| S16 — `/permainan/susun-jawapan` | 87 | 87 | 0 | 0 |
| S17 — `/permainan/kad-memori` | 100 | 100 | 0 | 0 |
| S18 — `/permainan/roda-nasib` | 25 | 25 | 0 | 0 |
| S19 — `/permainan/jutawan` | 34 | 34 | 0 | 0 |
| S20 — `/permainan/pertandingan` | 59 | 59 | 0 | 0 |
| S21 — `/permainan/uji-minda` | 16 | 16 | 0 | 0 |
| S22 — `/permainan/sambung-kata` | 9 | 9 | 0 | 0 |
| S23 — `/tournament` | 7 | 7 | 0 | 0 |
| S24 — `/tournament/admin/create` | 124 | 124 | 0 | 0 |
| S25 — `/liga` | 21 | 21 | 0 | 0 |
| S26 — `/liga/cipta` | 48 | 48 | 0 | 0 |
| S27 — `/liga/{id}` | 48 | 48 | 0 | 0 |
| S28 — `/sekolah-bersaing` | 68 | 68 | 0 | 0 |
| S29 — `/admin/permainan` | 52 | 52 | 0 | 0 |
| S30 — `(every SHU page) tournamentBanner()` | 112 | 112 | 0 | 0 |
| **M16 content (S1–S30)** | **1571** | **1571** | **0** | **0** |
| Admin-panel shell SHA (chrome of S28, S29 on live) | 202 | 13 | 189 | 0 |
| User-portal shell SHU (chrome of S1–S27, S30) | 399 | 37 | 362 | 0 |

**1571/1571 M16 content elements covered (1571 mapped, 0 excluded), 0 unmapped.** Including the shells: 2172/2172 elements accounted for (1621 mapped, 551 excluded with reason), 0 unmapped. 121 Functions appear in this matrix; the other 48 are behaviour-only Functions (access and error rules, polling and simulation contracts, game rules, unobservable or PROPOSED states, cross-module contracts) with no element of their own.

### 6.1 M16 content elements

#### S1 — `/battle` (123 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M16-S1-001 | text | hidden-only | "LIVE:", fa-circle | FN-M16-1.3.1 |
| EL-M16-S1-002 | text | hidden-only | "MAIN" | FN-M16-1.3.1 |
| EL-M16-S1-003 | text | hidden-only | "DAFTAR" | FN-M16-1.3.1 |
| EL-M16-S1-004 | heading | visible-default | "Battle Arena" | FN-M16-2.1.1 |
| EL-M16-S1-005 | badge | visible-default | "BARU" | FN-M16-2.1.1 |
| EL-M16-S1-006 | text | visible-default | "Cabar kawan, cari lawan, atau wakili sekolah anda!" | FN-M16-2.1.1 |
| EL-M16-S1-007 | card | visible-default | "Biasa" | FN-M16-2.1.2 |
| EL-M16-S1-008 | button | visible-default | "Biasa", type=submit, fa-book | FN-M16-2.1.2 |
| EL-M16-S1-009 | button | visible-default | "PKSK", type=submit, fa-shield-halved | FN-M16-2.1.2 |
| EL-M16-S1-010 | toggle | visible-default | "SPM", type=submit, fa-graduation-cap | FN-M16-2.1.3 |
| EL-M16-S1-011 | text | conditional | "Khas untuk pelajar Tingkatan 4 & 5 sahaja", fa-info-circle | FN-M16-2.1.3 |
| EL-M16-S1-012 | text | visible-default | "Subjek Teras" | FN-M16-2.1.4 |
| EL-M16-S1-013 | button | visible-default | "Bahasa Melayu", type=submit, fa-book-open | FN-M16-2.1.4 |
| EL-M16-S1-014 | button | visible-default | "Bahasa Inggeris", type=submit, fa-globe | FN-M16-2.1.4 |
| EL-M16-S1-015 | button | visible-default | "Matematik", type=submit, fa-calculator | FN-M16-2.1.4 |
| EL-M16-S1-016 | button | visible-default | "Sains", type=submit, fa-flask | FN-M16-2.1.4 |
| EL-M16-S1-017 | button | visible-default | "Sejarah", type=submit, fa-clock | FN-M16-2.1.4 |
| EL-M16-S1-018 | button | visible-default | "Pendidikan Islam", type=submit, fa-moon | FN-M16-2.1.4 |
| EL-M16-S1-019 | button | visible-default | "Pendidikan Moral", type=submit, fa-heart | FN-M16-2.1.4 |
| EL-M16-S1-020 | toggle | visible-default | "Lagi 24 subjek lain", type=submit, fa-chevron-down | FN-M16-2.1.4 |
| EL-M16-S1-021 | button | conditional | "Matematik Tambahan", type=submit, fa-superscript | FN-M16-2.1.4 |
| EL-M16-S1-022 | button | conditional | "Fizik", type=submit, fa-bolt | FN-M16-2.1.4 |
| EL-M16-S1-023 | button | conditional | "Kimia", type=submit, fa-flask-vial | FN-M16-2.1.4 |
| EL-M16-S1-024 | button | conditional | "Biologi", type=submit, fa-leaf | FN-M16-2.1.4 |
| EL-M16-S1-025 | button | conditional | "Geografi", type=submit, fa-map | FN-M16-2.1.4 |
| EL-M16-S1-026 | button | conditional | "Pendidikan Seni Visual", type=submit, fa-palette | FN-M16-2.1.4 |
| EL-M16-S1-027 | button | conditional | "Pendidikan Muzik", type=submit, fa-music | FN-M16-2.1.4 |
| EL-M16-S1-028 | button | conditional | "Pendidikan Jasmani & Kesihatan", type=submit, fa-heartbeat | FN-M16-2.1.4 |
| EL-M16-S1-029 | button | conditional | "Reka Bentuk & Teknologi", type=submit, fa-wrench | FN-M16-2.1.4 |
| EL-M16-S1-030 | button | conditional | "Sains Komputer", type=submit, fa-desktop | FN-M16-2.1.4 |
| EL-M16-S1-031 | button | conditional | "Bahasa Arab", type=submit, fa-language | FN-M16-2.1.4 |
| EL-M16-S1-032 | button | conditional | "Bahasa Cina", type=submit, fa-language | FN-M16-2.1.4 |
| EL-M16-S1-033 | button | conditional | "Bahasa Tamil", type=submit, fa-language | FN-M16-2.1.4 |
| EL-M16-S1-034 | button | conditional | "Prinsip Perakaunan", type=submit, fa-receipt | FN-M16-2.1.4 |
| EL-M16-S1-035 | button | conditional | "Ekonomi", type=submit, fa-chart-line | FN-M16-2.1.4 |
| EL-M16-S1-036 | button | conditional | "Perniagaan", type=submit, fa-briefcase | FN-M16-2.1.4 |
| EL-M16-S1-037 | button | conditional | "Pendidikan Al-Quran & As-Sunnah", type=submit, fa-book | FN-M16-2.1.4 |
| EL-M16-S1-038 | button | conditional | "Tasawwur Islam", type=submit, fa-book | FN-M16-2.1.4 |
| EL-M16-S1-039 | button | conditional | "Jawi", type=submit, fa-book | FN-M16-2.1.4 |
| EL-M16-S1-040 | button | conditional | "Pendidikan Syariah Islamiah", type=submit, fa-book | FN-M16-2.1.4 |
| EL-M16-S1-041 | button | conditional | "Sains Rumah Tangga", type=submit, fa-book | FN-M16-2.1.4 |
| EL-M16-S1-042 | button | conditional | "Pembuatan Pakaian Wanita", type=submit, fa-book | FN-M16-2.1.4 |
| EL-M16-S1-043 | button | conditional | "Pertanian", type=submit, fa-book | FN-M16-2.1.4 |
| EL-M16-S1-044 | button | conditional | "Sains Sukan", type=submit, fa-book | FN-M16-2.1.4 |
| EL-M16-S1-045 | text | conditional | "Pilih Domain PKSK" | FN-M16-2.1.5 |
| EL-M16-S1-046 | button | conditional | "Kecerdasan Insaniah", type=submit, fa-brain | FN-M16-2.1.5 |
| EL-M16-S1-047 | button | conditional | "Matematik", type=submit, fa-calculator | FN-M16-2.1.5 |
| EL-M16-S1-048 | button | conditional | "Sains", type=submit, fa-flask | FN-M16-2.1.5 |
| EL-M16-S1-049 | button | conditional | "Bahasa Inggeris", type=submit, fa-language | FN-M16-2.1.5 |
| EL-M16-S1-050 | button | conditional | "Sejarah Malaysia", type=submit, fa-landmark | FN-M16-2.1.5 |
| EL-M16-S1-051 | button | conditional | "Geografi", type=submit, fa-globe-asia | FN-M16-2.1.5 |
| EL-M16-S1-052 | button | conditional | "Kebudayaan Kaum", type=submit, fa-users | FN-M16-2.1.5 |
| EL-M16-S1-053 | button | conditional | "Sukan & Pencapaian", type=submit, fa-futbol | FN-M16-2.1.5 |
| EL-M16-S1-054 | button | conditional | "Mercu Tanda Malaysia", type=submit, fa-monument | FN-M16-2.1.5 |
| EL-M16-S1-055 | button | conditional | "Alam Sekitar", type=submit, fa-leaf | FN-M16-2.1.5 |
| EL-M16-S1-056 | button | conditional | "Teknologi & IT", type=submit, fa-laptop-code | FN-M16-2.1.5 |
| EL-M16-S1-057 | button | conditional | "Ekonomi Malaysia", type=submit, fa-chart-line | FN-M16-2.1.5 |
| EL-M16-S1-058 | button | conditional | "Inovasi & Pencipta", type=submit, fa-lightbulb | FN-M16-2.1.5 |
| EL-M16-S1-059 | button | conditional | "Isu Global", type=submit, fa-earth-asia | FN-M16-2.1.5 |
| EL-M16-S1-060 | button | conditional | "Artikulasi Penulisan", type=submit, fa-pen-fancy | FN-M16-2.1.5 |
| EL-M16-S1-061 | text | conditional | "Pilih Tahap" | FN-M16-2.1.5 |
| EL-M16-S1-062 | button | conditional | "Tahap 1 (Darjah 1-3)", type=submit, fa-seedling | FN-M16-2.1.5 |
| EL-M16-S1-063 | button | conditional | "Tahap 4 (Darjah 4-6)", type=submit, fa-tree | FN-M16-2.1.5 |
| EL-M16-S1-064 | button | conditional | button, type=submit, fa-times | FN-M16-2.2.5 |
| EL-M16-S1-065 | card | conditional | "Cabaran Masuk!" | FN-M16-2.2.3 |
| EL-M16-S1-066 | heading | hidden-only | "Mencari Lawan..." | FN-M16-2.2.3 |
| EL-M16-S1-067 | text | hidden-only | ":" | FN-M16-2.2.3 |
| EL-M16-S1-068 | button | hidden-only | "Batal", type=submit, fa-times | FN-M16-2.2.3 |
| EL-M16-S1-069 | heading | conditional | "Mencari Lawan..." | FN-M16-2.2.3 |
| EL-M16-S1-070 | text | conditional | "Menunggu pelajar dari mana-mana gred" | FN-M16-2.2.3 |
| EL-M16-S1-071 | text | conditional | ":" | FN-M16-2.2.3 |
| EL-M16-S1-072 | text | conditional | "0" | FN-M16-2.2.3 |
| EL-M16-S1-073 | text | conditional | "07" | FN-M16-2.2.3 |
| EL-M16-S1-074 | button | conditional | "Batal", type=submit, fa-times | FN-M16-2.2.3 |
| EL-M16-S1-075 | heading | hidden-only | "Cabaran Masuk!" | FN-M16-2.3.1 |
| EL-M16-S1-076 | text | hidden-only | "ingin menyertai battle anda" | FN-M16-2.3.1 |
| EL-M16-S1-077 | text | hidden-only | "Soalan mengikut gred anda. Lawan akan bermain soalan gred anda.", fa-info-circle | FN-M16-2.3.1 |
| EL-M16-S1-078 | button | hidden-only | "Terima", type=submit, fa-check | FN-M16-2.3.1 |
| EL-M16-S1-079 | button | hidden-only | "Tolak", type=submit, fa-times | FN-M16-2.3.1 |
| EL-M16-S1-080 | card | conditional | "Menunggu Kelulusan..." | FN-M16-2.3.2 |
| EL-M16-S1-081 | heading | conditional | "Menunggu Kelulusan..." | FN-M16-2.3.2 |
| EL-M16-S1-082 | text | conditional | "Menunggu menerima permohonan anda" | FN-M16-2.3.2 |
| EL-M16-S1-083 | button | conditional | "Batal", type=submit, fa-times | FN-M16-2.3.2 |
| EL-M16-S1-084 | card | visible-default | "Keterlihatan Barisan" | FN-M16-2.2.1 |
| EL-M16-S1-085 | text | visible-default | "Keterlihatan Barisan", fa-globe | FN-M16-2.2.1 |
| EL-M16-S1-086 | text | visible-default | "Hanya pelajar gred sama boleh match" | FN-M16-2.2.1 |
| EL-M16-S1-087 | label | visible-default | "Gred Saya" | FN-M16-2.2.1 |
| EL-M16-S1-088 | checkbox | hidden-only | checkbox, type=checkbox | FN-M16-2.2.1 |
| EL-M16-S1-089 | button | visible-default | "Quick Match Cari lawan rawak dari darjah yang sama", type=submit, fa-bolt | FN-M16-2.2.2 |
| EL-M16-S1-090 | heading | visible-default | "Quick Match" | FN-M16-2.2.2 |
| EL-M16-S1-091 | button | visible-default | "Cabar Kawan Hantar cabaran kepada rakan anda", type=submit, fa-user-group | FN-M16-2.2.2 |
| EL-M16-S1-092 | heading | visible-default | "Cabar Kawan" | FN-M16-2.2.2 |
| EL-M16-S1-093 | button | visible-default | "Battle Sekolah Lawan pelajar dari sekolah lain!", type=submit, fa-school | FN-M16-2.2.2 |
| EL-M16-S1-094 | heading | visible-default | "Battle Sekolah" | FN-M16-2.2.2 |
| EL-M16-S1-095 | link | visible-default | "Ranking Pelajar", → /battle/leaderboard, fa-medal | FN-M16-2.1.8 |
| EL-M16-S1-096 | link | visible-default | "Ranking Sekolah", → /battle/ranking-sekolah, fa-school | FN-M16-2.1.8 |
| EL-M16-S1-097 | modal | conditional | "Cabar Kawan" | FN-M16-2.4.1 |
| EL-M16-S1-098 | clickable | conditional | "Cabar Kawan Tiada pelajar dijumpai", fa-user-group | FN-M16-2.4.1 |
| EL-M16-S1-099 | heading | conditional | "Cabar Kawan" | FN-M16-2.4.1 |
| EL-M16-S1-100 | button | conditional | button, type=submit, fa-times | FN-M16-2.4.1 |
| EL-M16-S1-101 | input | conditional | input, type=text | FN-M16-2.4.1 |
| EL-M16-S1-102 | button | hidden-only | button, type=submit, fa-paper-plane | FN-M16-2.4.1 |
| EL-M16-S1-103 | image | hidden-only | image | FN-M16-2.4.1 |
| EL-M16-S1-104 | modal | conditional | "Cabaran Masuk" | FN-M16-2.4.3 |
| EL-M16-S1-105 | clickable | conditional | "Cabaran Masuk Tiada cabaran buat masa ini", fa-envelope | FN-M16-2.4.3 |
| EL-M16-S1-106 | heading | conditional | "Cabaran Masuk" | FN-M16-2.4.3 |
| EL-M16-S1-107 | button | conditional | button, type=submit, fa-times | FN-M16-2.4.3 |
| EL-M16-S1-108 | button | hidden-only | "Terima", type=submit | FN-M16-2.4.3 |
| EL-M16-S1-109 | button | hidden-only | "Tolak", type=submit | FN-M16-2.4.3 |
| EL-M16-S1-110 | empty-state | conditional | "Tiada lawan dijumpai dalam masa 2 minit. Sila cuba lagi." | FN-M16-2.2.5 |
| EL-M16-S1-111 | heading | conditional | "Cabaran Masuk!" | FN-M16-2.3.1 |
| EL-M16-S1-112 | text | conditional | "ingin menyertai battle anda" | FN-M16-2.3.1 |
| EL-M16-S1-113 | text | conditional | "<name>" | FN-M16-2.3.1 |
| EL-M16-S1-114 | badge | conditional | "Darjah 4" | FN-M16-2.3.1 |
| EL-M16-S1-115 | badge | conditional | "<school>" | FN-M16-2.3.1 |
| EL-M16-S1-116 | text | conditional | "Soalan mengikut gred anda. Lawan akan bermain soalan gred anda.", fa-info-circle | FN-M16-2.3.1 |
| EL-M16-S1-117 | button | conditional | "Terima", type=submit, fa-check | FN-M16-2.3.1 |
| EL-M16-S1-118 | button | conditional | "Tolak", type=submit, fa-times | FN-M16-2.3.1 |
| EL-M16-S1-119 | toggle | conditional | "Tutup", type=submit, fa-chevron-up | FN-M16-2.1.4 |
| EL-M16-S1-120 | label | conditional | "Terbuka" | FN-M16-2.2.1 |
| EL-M16-S1-121 | checkbox | hidden-only | checkbox, type=checkbox | FN-M16-2.2.1 |
| EL-M16-S1-122 | text | conditional | "<name>" | FN-M16-2.3.2 |
| EL-M16-S1-123 | text | conditional | "Darjah 4" | FN-M16-2.3.2 |

#### S2 — `/battle/leaderboard` (7 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M16-S2-001 | text | hidden-only | "LIVE:", fa-circle | FN-M16-1.3.1 |
| EL-M16-S2-002 | text | hidden-only | "MAIN" | FN-M16-1.3.1 |
| EL-M16-S2-003 | text | hidden-only | "DAFTAR" | FN-M16-1.3.1 |
| EL-M16-S2-004 | button | visible-default | "Mingguan", type=submit | FN-M16-3.1.1 |
| EL-M16-S2-005 | button | visible-default | "Bulanan", type=submit | FN-M16-3.1.1 |
| EL-M16-S2-006 | card | visible-default | "#" | FN-M16-3.1.2 |
| EL-M16-S2-007 | table | visible-default | table | FN-M16-3.1.2 |

#### S3 — `/battle/ranking-sekolah` (37 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M16-S3-001 | text | hidden-only | "LIVE:", fa-circle | FN-M16-1.3.1 |
| EL-M16-S3-002 | text | hidden-only | "MAIN" | FN-M16-1.3.1 |
| EL-M16-S3-003 | text | hidden-only | "DAFTAR" | FN-M16-1.3.1 |
| EL-M16-S3-004 | heading | visible-default | "Papan Ranking Sekolah" | FN-M16-3.2.1 |
| EL-M16-S3-005 | text | visible-default | "Sekolah mana paling hebat? Wakili sekolah anda!" | FN-M16-3.2.1 |
| EL-M16-S3-006 | card | visible-default | "Mingguan" | FN-M16-3.2.2 |
| EL-M16-S3-007 | link | visible-default | "Mingguan", → /battle/ranking-sekolah?period=weekly | FN-M16-3.2.2 |
| EL-M16-S3-008 | link | visible-default | "Bulanan", → /battle/ranking-sekolah?period=monthly | FN-M16-3.2.2 |
| EL-M16-S3-009 | link | visible-default | "Sepanjang Masa", → /battle/ranking-sekolah?period=all_time | FN-M16-3.2.2 |
| EL-M16-S3-010 | select | visible-default | select | FN-M16-3.2.3 |
| EL-M16-S3-011 | card | visible-default | "Senarai Penuh" | FN-M16-3.2.5 |
| EL-M16-S3-012 | heading | visible-default | "Senarai Penuh" | FN-M16-3.2.5 |
| EL-M16-S3-013 | table | visible-default | table | FN-M16-3.2.5 |
| EL-M16-S3-014 | card | conditional | "2" | FN-M16-3.2.4 |
| EL-M16-S3-015 | badge | conditional | "2" | FN-M16-3.2.4 |
| EL-M16-S3-016 | text | conditional | "<school>" | FN-M16-3.2.4 |
| EL-M16-S3-017 | text | conditional | "Selangor" | FN-M16-3.2.4 |
| EL-M16-S3-018 | text | conditional | "519" | FN-M16-3.2.4 |
| EL-M16-S3-019 | text | conditional | "mata" | FN-M16-3.2.4 |
| EL-M16-S3-020 | text | conditional | "<school>" | FN-M16-3.2.4 |
| EL-M16-S3-021 | text | conditional | "Selangor" | FN-M16-3.2.4 |
| EL-M16-S3-022 | text | conditional | "738" | FN-M16-3.2.4 |
| EL-M16-S3-023 | text | conditional | "mata" | FN-M16-3.2.4 |
| EL-M16-S3-024 | card | conditional | "3" | FN-M16-3.2.4 |
| EL-M16-S3-025 | badge | conditional | "3" | FN-M16-3.2.4 |
| EL-M16-S3-026 | text | conditional | "<school>" | FN-M16-3.2.4 |
| EL-M16-S3-027 | text | conditional | "Selangor" | FN-M16-3.2.4 |
| EL-M16-S3-028 | text | conditional | "367" | FN-M16-3.2.4 |
| EL-M16-S3-029 | text | conditional | "mata" | FN-M16-3.2.4 |
| EL-M16-S3-030 | link | conditional | "<school> Selangor · SMK", → /battle/ranking-sekolah/8106 | FN-M16-3.2.5 |
| EL-M16-S3-031 | link | conditional | "<school> Selangor · SMK", → /battle/ranking-sekolah/8090 | FN-M16-3.2.5 |
| EL-M16-S3-032 | link | conditional | "<school> Selangor · SMK", → /battle/ranking-sekolah/8078 | FN-M16-3.2.5 |
| EL-M16-S3-033 | link | conditional | "Mingguan", → /battle/ranking-sekolah?period=weekly&state=Johor | FN-M16-3.2.2 |
| EL-M16-S3-034 | link | conditional | "Bulanan", → /battle/ranking-sekolah?period=monthly&state=Johor | FN-M16-3.2.2 |
| EL-M16-S3-035 | link | conditional | "Sepanjang Masa", → /battle/ranking-sekolah?period=all_time&state=Johor | FN-M16-3.2.2 |
| EL-M16-S3-036 | link | conditional | "<school> Johor · SMK", → /battle/ranking-sekolah/8880 | FN-M16-3.2.5 |
| EL-M16-S3-037 | link | conditional | "<school> Johor · SK", → /battle/ranking-sekolah/2710 | FN-M16-3.2.5 |

#### S4 — `/battle/ranking-sekolah/{id}` (51 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M16-S4-001 | text | hidden-only | "LIVE:", fa-circle | FN-M16-1.3.1 |
| EL-M16-S4-002 | text | hidden-only | "MAIN" | FN-M16-1.3.1 |
| EL-M16-S4-003 | text | hidden-only | "DAFTAR" | FN-M16-1.3.1 |
| EL-M16-S4-004 | heading | visible-default | "<school>" | FN-M16-3.3.1 |
| EL-M16-S4-005 | text | visible-default | "PPD HULU LANGAT · Selangor · SMK" | FN-M16-3.3.1 |
| EL-M16-S4-006 | card | visible-default | "19" | FN-M16-3.3.2 |
| EL-M16-S4-007 | text | visible-default | "19" | FN-M16-3.3.2 |
| EL-M16-S4-008 | text | visible-default | "Jumlah Battle" | FN-M16-3.3.2 |
| EL-M16-S4-009 | card | visible-default | "12" | FN-M16-3.3.2 |
| EL-M16-S4-010 | text | visible-default | "12" | FN-M16-3.3.2 |
| EL-M16-S4-011 | text | visible-default | "Kemenangan" | FN-M16-3.3.2 |
| EL-M16-S4-012 | card | visible-default | "69%" | FN-M16-3.3.2 |
| EL-M16-S4-013 | text | visible-default | "69%" | FN-M16-3.3.2 |
| EL-M16-S4-014 | text | visible-default | "Ketepatan" | FN-M16-3.3.2 |
| EL-M16-S4-015 | card | visible-default | "7" | FN-M16-3.3.2 |
| EL-M16-S4-016 | text | visible-default | "7" | FN-M16-3.3.2 |
| EL-M16-S4-017 | text | visible-default | "Pelajar Aktif" | FN-M16-3.3.2 |
| EL-M16-S4-018 | card | visible-default | "Minggu Ini" | FN-M16-3.3.3 |
| EL-M16-S4-019 | heading | visible-default | "Minggu Ini" | FN-M16-3.3.3 |
| EL-M16-S4-020 | text | visible-default | "Ranking Nasional" | FN-M16-3.3.3 |
| EL-M16-S4-021 | text | visible-default | "#1" | FN-M16-3.3.3 |
| EL-M16-S4-022 | text | visible-default | "Battle" | FN-M16-3.3.3 |
| EL-M16-S4-023 | text | visible-default | "15" | FN-M16-3.3.3 |
| EL-M16-S4-024 | card | visible-default | "Bulan Ini" | FN-M16-3.3.3 |
| EL-M16-S4-025 | heading | visible-default | "Bulan Ini" | FN-M16-3.3.3 |
| EL-M16-S4-026 | card | visible-default | "Pejuang Terbaik Minggu Ini" | FN-M16-3.3.4 |
| EL-M16-S4-027 | heading | visible-default | "Pejuang Terbaik Minggu Ini" | FN-M16-3.3.4 |
| EL-M16-S4-028 | empty-state | visible-default | "Tiada data pejuang minggu ini" | FN-M16-3.3.4 |
| EL-M16-S4-029 | card | visible-default | "Battle Terkini" | FN-M16-3.3.5 |
| EL-M16-S4-030 | heading | visible-default | "Battle Terkini" | FN-M16-3.3.5 |
| EL-M16-S4-031 | text | conditional | "PPD KUALA LANGAT · Selangor · SK" | FN-M16-3.3.1 |
| EL-M16-S4-032 | card | conditional | "0" | FN-M16-3.3.2 |
| EL-M16-S4-033 | card | conditional | "0" | FN-M16-3.3.2 |
| EL-M16-S4-034 | card | conditional | "0%" | FN-M16-3.3.2 |
| EL-M16-S4-035 | text | conditional | "0%" | FN-M16-3.3.2 |
| EL-M16-S4-036 | card | conditional | "0" | FN-M16-3.3.2 |
| EL-M16-S4-037 | empty-state | conditional | "Tiada data minggu ini" | FN-M16-3.3.3 |
| EL-M16-S4-038 | empty-state | conditional | "Tiada data bulan ini" | FN-M16-3.3.3 |
| EL-M16-S4-039 | empty-state | conditional | "Tiada battle terkini" | FN-M16-3.3.5 |
| EL-M16-S4-040 | text | conditional | "404" | FN-M16-3.3.6 |
| EL-M16-S4-041 | text | conditional | "🔍" | FN-M16-3.3.6 |
| EL-M16-S4-042 | heading | conditional | "Halaman Tidak Dijumpai" | FN-M16-3.3.6 |
| EL-M16-S4-043 | text | conditional | "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL sal …" | FN-M16-3.3.6 |
| EL-M16-S4-044 | link | conditional | "Halaman Utama", → / | FN-M16-3.3.6 |
| EL-M16-S4-045 | link | conditional | "Mula Latihan", → /latih-tubi | FN-M16-3.3.6 |
| EL-M16-S4-046 | text | conditional | "PRESTASIPLUS" | FN-M16-3.3.6 |
| EL-M16-S4-047 | card | conditional | "30" | FN-M16-3.3.2 |
| EL-M16-S4-048 | card | conditional | "15" | FN-M16-3.3.2 |
| EL-M16-S4-049 | card | conditional | "24%" | FN-M16-3.3.2 |
| EL-M16-S4-050 | text | conditional | "24%" | FN-M16-3.3.2 |
| EL-M16-S4-051 | card | conditional | "10" | FN-M16-3.3.2 |

#### S5 — `/battle/history` (7 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M16-S5-001 | text | hidden-only | "LIVE:", fa-circle | FN-M16-1.3.1 |
| EL-M16-S5-002 | text | hidden-only | "MAIN" | FN-M16-1.3.1 |
| EL-M16-S5-003 | text | hidden-only | "DAFTAR" | FN-M16-1.3.1 |
| EL-M16-S5-004 | card | visible-default | "Tiada sejarah battle" | FN-M16-2.6.1 |
| EL-M16-S5-005 | heading | visible-default | "Tiada sejarah battle" | FN-M16-2.6.1 |
| EL-M16-S5-006 | text | visible-default | "Mulakan pertandingan pertama anda sekarang!" | FN-M16-2.6.1 |
| EL-M16-S5-007 | link | visible-default | "Mula Battle", → /battle, fa-bolt | FN-M16-2.6.1 |

#### S6 — `/permainan` (96 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M16-S6-001 | text | hidden-only | "LIVE:", fa-circle | FN-M16-1.3.1 |
| EL-M16-S6-002 | text | hidden-only | "MAIN" | FN-M16-1.3.1 |
| EL-M16-S6-003 | text | hidden-only | "DAFTAR" | FN-M16-1.3.1 |
| EL-M16-S6-004 | heading | visible-default | "🎮 Zona Permainan" | FN-M16-4.1.1 |
| EL-M16-S6-005 | text | visible-default | "Main sambil belajar! Kumpul Syiling, naik ranking, dan jadi champion sekolah. Pi …" | FN-M16-4.1.1 |
| EL-M16-S6-006 | text | visible-default | "🌙" | FN-M16-4.1.2 |
| EL-M16-S6-007 | empty-state | visible-default | "Tiada bilik terbuka buat masa ini." | FN-M16-4.1.2 |
| EL-M16-S6-008 | text | visible-default | "Cipta bilik permainan dan jemput rakan-rakan!" | FN-M16-4.1.2 |
| EL-M16-S6-009 | clickable | visible-default | "🎲 Papan Bijak Board game matematik! Gulung dadu, jawab soalan, dan lumba ke gar …", fa-play | FN-M16-4.1.4 |
| EL-M16-S6-010 | card | visible-default | "Papan Bijak" | FN-M16-4.1.4 |
| EL-M16-S6-011 | heading | visible-default | "Papan Bijak" | FN-M16-4.1.4 |
| EL-M16-S6-012 | link | visible-default | "Main Sekarang", → /papan-bijak, fa-play | FN-M16-4.1.4 |
| EL-M16-S6-013 | clickable | visible-default | "🔥 HOT ⚔️ Battle Arena Duel 1-lawan-1 dengan pelajar lain! Siapa jawab betul dan …", fa-bolt | FN-M16-4.1.4 |
| EL-M16-S6-014 | badge | visible-default | "🔥 HOT" | FN-M16-4.1.4 |
| EL-M16-S6-015 | card | visible-default | "Battle Arena" | FN-M16-4.1.4 |
| EL-M16-S6-016 | heading | visible-default | "Battle Arena" | FN-M16-4.1.4 |
| EL-M16-S6-017 | link | visible-default | "Battle!", → /battle, fa-bolt | FN-M16-4.1.4 |
| EL-M16-S6-018 | clickable | visible-default | "👥 MULTIPLAYER ⚔️ Perang Fakta Betul atau Salah? Vote bersama 2-6 pemain! 15 pus …", fa-fist-raised | FN-M16-4.1.5 |
| EL-M16-S6-019 | badge | visible-default | "👥 MULTIPLAYER" | FN-M16-4.1.5 |
| EL-M16-S6-020 | card | visible-default | "Perang Fakta" | FN-M16-4.1.5 |
| EL-M16-S6-021 | heading | visible-default | "Perang Fakta" | FN-M16-4.1.5 |
| EL-M16-S6-022 | link | visible-default | "Main!", → /perang-fakta, fa-fist-raised | FN-M16-4.1.5 |
| EL-M16-S6-023 | clickable | visible-default | "👥 MULTIPLAYER 🏰 Benteng Ilmu Duel 1v1! Serang benteng lawan dengan kuasa ilmu. …", fa-shield-alt | FN-M16-4.1.5 |
| EL-M16-S6-024 | badge | visible-default | "👥 MULTIPLAYER" | FN-M16-4.1.5 |
| EL-M16-S6-025 | card | visible-default | "Benteng Ilmu" | FN-M16-4.1.5 |
| EL-M16-S6-026 | heading | visible-default | "Benteng Ilmu" | FN-M16-4.1.5 |
| EL-M16-S6-027 | link | visible-default | "Duel!", → /benteng-ilmu, fa-shield-alt | FN-M16-4.1.5 |
| EL-M16-S6-028 | clickable | visible-default | "👥 MULTIPLAYER 🏎️ Perlumbaan Matematik Lumba ke garisan penamat! Jawab betul =  …", fa-flag-checkered | FN-M16-4.1.5 |
| EL-M16-S6-029 | badge | visible-default | "👥 MULTIPLAYER" | FN-M16-4.1.5 |
| EL-M16-S6-030 | card | visible-default | "Perlumbaan Matematik" | FN-M16-4.1.5 |
| EL-M16-S6-031 | heading | visible-default | "Perlumbaan Matematik" | FN-M16-4.1.5 |
| EL-M16-S6-032 | link | visible-default | "Lumba!", → /perlumbaan-matematik, fa-flag-checkered | FN-M16-4.1.5 |
| EL-M16-S6-033 | clickable | visible-default | "👥 MULTIPLAYER 🏃 Kuiz Relay Berpasukan! 2 pasukan jawab bergilir-gilir. Bonus k …", fa-users | FN-M16-4.1.5 |
| EL-M16-S6-034 | badge | visible-default | "👥 MULTIPLAYER" | FN-M16-4.1.5 |
| EL-M16-S6-035 | card | visible-default | "Kuiz Relay" | FN-M16-4.1.5 |
| EL-M16-S6-036 | heading | visible-default | "Kuiz Relay" | FN-M16-4.1.5 |
| EL-M16-S6-037 | link | visible-default | "Main!", → /kuiz-relay, fa-users | FN-M16-4.1.5 |
| EL-M16-S6-038 | clickable | visible-default | "👥 MULTIPLAYER 📝 Teka Silang Kata Isi silang kata lawan masa! 2 pemain, 5 minit …", fa-pencil-alt | FN-M16-4.1.5 |
| EL-M16-S6-039 | badge | visible-default | "👥 MULTIPLAYER" | FN-M16-4.1.5 |
| EL-M16-S6-040 | card | visible-default | "Teka Silang Kata" | FN-M16-4.1.5 |
| EL-M16-S6-041 | heading | visible-default | "Teka Silang Kata" | FN-M16-4.1.5 |
| EL-M16-S6-042 | link | visible-default | "Main!", → /teka-silang-kata, fa-pencil-alt | FN-M16-4.1.5 |
| EL-M16-S6-043 | clickable | visible-default | "✅❌ BARU! ✅ Betul atau Salah Kenyataan keluar laju — tekan Betul atau Salah dalam …", fa-check-circle | FN-M16-4.1.6 |
| EL-M16-S6-044 | badge | visible-default | "✅❌ BARU!" | FN-M16-4.1.6 |
| EL-M16-S6-045 | card | visible-default | "Betul atau Salah" | FN-M16-4.1.6 |
| EL-M16-S6-046 | heading | visible-default | "Betul atau Salah" | FN-M16-4.1.6 |
| EL-M16-S6-047 | link | visible-default | "Mula", → /permainan/betul-salah, fa-check-circle | FN-M16-4.1.6 |
| EL-M16-S6-048 | clickable | visible-default | "📅 HARIAN 🎯 Roda Nasib Pusing roda setiap hari untuk dapat ganjaran misteri — S …", fa-circle-notch | FN-M16-4.1.6 |
| EL-M16-S6-049 | badge | visible-default | "📅 HARIAN" | FN-M16-4.1.6 |
| EL-M16-S6-050 | card | visible-default | "Roda Nasib" | FN-M16-4.1.6 |
| EL-M16-S6-051 | heading | visible-default | "Roda Nasib" | FN-M16-4.1.6 |
| EL-M16-S6-052 | link | visible-default | "Spin Sekarang!", → /permainan/roda-nasib, fa-circle-notch | FN-M16-4.1.6 |
| EL-M16-S6-053 | clickable | visible-default | "📅 MINGGUAN 🏆 Pertandingan Mingguan Lumba dengan semua pelajar setiap minggu! T …", fa-trophy | FN-M16-4.1.6 |
| EL-M16-S6-054 | badge | visible-default | "📅 MINGGUAN" | FN-M16-4.1.6 |
| EL-M16-S6-055 | card | visible-default | "Pertandingan Mingguan" | FN-M16-4.1.6 |
| EL-M16-S6-056 | heading | visible-default | "Pertandingan Mingguan" | FN-M16-4.1.6 |
| EL-M16-S6-057 | link | visible-default | "Lihat Ranking", → /permainan/pertandingan, fa-trophy | FN-M16-4.1.6 |
| EL-M16-S6-058 | clickable | visible-default | "🗺️ Peta Pengembaraan Jelajah dunia matematik! Selesaikan misi di setiap checkpo …", fa-map-marked-alt | FN-M16-4.1.7 |
| EL-M16-S6-059 | card | visible-default | "Peta Pengembaraan" | FN-M16-4.1.7 |
| EL-M16-S6-060 | heading | visible-default | "Peta Pengembaraan" | FN-M16-4.1.7 |
| EL-M16-S6-061 | link | visible-default | "Jelajah", → /peta-belajar, fa-map-marked-alt | FN-M16-4.1.7 |
| EL-M16-S6-062 | clickable | visible-default | "👨‍👩‍👧 IBU BAPA 🧠 Uji Minda Cabaran khas dari ibu/bapa kamu! Jawab soalan, ku …", fa-brain | FN-M16-4.1.8 |
| EL-M16-S6-063 | badge | visible-default | "👨‍👩‍👧 IBU BAPA" | FN-M16-4.1.8 |
| EL-M16-S6-064 | card | visible-default | "Uji Minda" | FN-M16-4.1.8 |
| EL-M16-S6-065 | heading | visible-default | "Uji Minda" | FN-M16-4.1.8 |
| EL-M16-S6-066 | link | visible-default | "Mula", → /permainan/uji-minda, fa-brain | FN-M16-4.1.8 |
| EL-M16-S6-067 | clickable | visible-default | "⚡ BARU! ⚡ Cabaran Kilat 60 saat! Jawab laju, bina combo, pecah rekod! Makin panj …", fa-bolt | FN-M16-4.1.9 |
| EL-M16-S6-068 | badge | visible-default | "⚡ BARU!" | FN-M16-4.1.9 |
| EL-M16-S6-069 | card | visible-default | "Cabaran Kilat" | FN-M16-4.1.9 |
| EL-M16-S6-070 | heading | visible-default | "Cabaran Kilat" | FN-M16-4.1.9 |
| EL-M16-S6-071 | link | visible-default | "Mula!", → /permainan/cabaran-kilat, fa-bolt | FN-M16-4.1.9 |
| EL-M16-S6-072 | clickable | visible-default | "💰 BARU! 💰 Jutawan Ilmu Pilih subjek, jawab 15 soalan makin susah — menang sehi …", fa-crown | FN-M16-4.1.9 |
| EL-M16-S6-073 | badge | visible-default | "💰 BARU!" | FN-M16-4.1.9 |
| EL-M16-S6-074 | card | visible-default | "Jutawan Ilmu" | FN-M16-4.1.9 |
| EL-M16-S6-075 | heading | visible-default | "Jutawan Ilmu" | FN-M16-4.1.9 |
| EL-M16-S6-076 | link | visible-default | "Main!", → /permainan/jutawan, fa-crown | FN-M16-4.1.9 |
| EL-M16-S6-077 | clickable | visible-default | "🧩 BARU! 🧩 Susun Jawapan Huruf/perkataan bercampur aduk — susun semula untuk be …", fa-puzzle-piece | FN-M16-4.1.9 |
| EL-M16-S6-078 | badge | visible-default | "🧩 BARU!" | FN-M16-4.1.9 |
| EL-M16-S6-079 | card | visible-default | "Susun Jawapan" | FN-M16-4.1.9 |
| EL-M16-S6-080 | heading | visible-default | "Susun Jawapan" | FN-M16-4.1.9 |
| EL-M16-S6-081 | link | visible-default | "Susun!", → /permainan/susun-jawapan, fa-puzzle-piece | FN-M16-4.1.9 |
| EL-M16-S6-082 | clickable | visible-default | "🎯 BARU! 🎯 Tembak Jawapan Jawapan jatuh dari atas — tap yang betul sebelum samp …", fa-crosshairs | FN-M16-4.1.9 |
| EL-M16-S6-083 | badge | visible-default | "🎯 BARU!" | FN-M16-4.1.9 |
| EL-M16-S6-084 | card | visible-default | "Tembak Jawapan" | FN-M16-4.1.9 |
| EL-M16-S6-085 | heading | visible-default | "Tembak Jawapan" | FN-M16-4.1.9 |
| EL-M16-S6-086 | link | visible-default | "Tembak!", → /permainan/tembak-jawapan, fa-crosshairs | FN-M16-4.1.9 |
| EL-M16-S6-087 | clickable | visible-default | "🔗 BARU! 🔗 Sambung Kata Taip perkataan bermula huruf terakhir! Bina rantaian pa …", fa-link | FN-M16-4.1.10 |
| EL-M16-S6-088 | badge | visible-default | "🔗 BARU!" | FN-M16-4.1.10 |
| EL-M16-S6-089 | card | visible-default | "Sambung Kata" | FN-M16-4.1.10 |
| EL-M16-S6-090 | heading | visible-default | "Sambung Kata" | FN-M16-4.1.10 |
| EL-M16-S6-091 | link | visible-default | "Mula!", → /permainan/sambung-kata, fa-link | FN-M16-4.1.10 |
| EL-M16-S6-092 | clickable | visible-default | "🧠 HOT! 🃏 Kad Memori Padankan soalan dengan jawapan yang betul! Cari semua pasa …", fa-brain | FN-M16-4.1.11 |
| EL-M16-S6-093 | badge | visible-default | "🧠 HOT!" | FN-M16-4.1.11 |
| EL-M16-S6-094 | card | visible-default | "Kad Memori" | FN-M16-4.1.11 |
| EL-M16-S6-095 | heading | visible-default | "Kad Memori" | FN-M16-4.1.11 |
| EL-M16-S6-096 | link | visible-default | "Main!", → /permainan/kad-memori, fa-brain | FN-M16-4.1.11 |

#### S7 — `/papan-bijak` (59 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M16-S7-001 | text | hidden-only | "LIVE:", fa-circle | FN-M16-1.3.1 |
| EL-M16-S7-002 | text | hidden-only | "MAIN" | FN-M16-1.3.1 |
| EL-M16-S7-003 | text | hidden-only | "DAFTAR" | FN-M16-1.3.1 |
| EL-M16-S7-004 | heading | visible-default | "🎲 Papan Bijak" | FN-M16-5.1.1 |
| EL-M16-S7-005 | text | visible-default | "Board game quiz multiplayer — jemput kawan, gulung dadu, jawab soalan! 🐍🪜" | FN-M16-5.1.1 |
| EL-M16-S7-006 | card | visible-default | "🆕 Cipta Bilik Baru" | FN-M16-5.1.2 |
| EL-M16-S7-007 | heading | visible-default | "🆕 Cipta Bilik Baru" | FN-M16-5.1.2 |
| EL-M16-S7-008 | form | visible-default | form | FN-M16-5.1.2 |
| EL-M16-S7-009 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M16-5.1.2 |
| EL-M16-S7-010 | label | visible-default | "Subjek" | FN-M16-5.1.2 |
| EL-M16-S7-011 | select | visible-default | select, name=subject | FN-M16-5.1.2 |
| EL-M16-S7-012 | label | visible-default | "Tahap Soalan" | FN-M16-5.1.2 |
| EL-M16-S7-013 | text | visible-default | "Darjah 4" | FN-M16-5.1.2 |
| EL-M16-S7-014 | text | visible-default | "(auto dari profil anda)" | FN-M16-5.1.2 |
| EL-M16-S7-015 | button | visible-default | "Tukar", type=button | FN-M16-5.1.2 |
| EL-M16-S7-016 | hidden-field | hidden-only | hidden-field, name=grade_level, type=hidden | FN-M16-5.1.2 |
| EL-M16-S7-017 | label | conditional | "Tahap Soalan" | FN-M16-5.1.2 |
| EL-M16-S7-018 | button | conditional | "← Guna auto", type=button | FN-M16-5.1.2 |
| EL-M16-S7-019 | select | conditional | select, name=grade_level | FN-M16-5.1.2 |
| EL-M16-S7-020 | label | visible-default | "Siapa Boleh Join?" | FN-M16-5.1.3 |
| EL-M16-S7-021 | select | visible-default | select, name=match_mode | FN-M16-5.1.3 |
| EL-M16-S7-022 | label | conditional | "Dari" | FN-M16-5.1.3 |
| EL-M16-S7-023 | select | conditional | select, name=grade_min | FN-M16-5.1.3 |
| EL-M16-S7-024 | label | conditional | "Hingga" | FN-M16-5.1.3 |
| EL-M16-S7-025 | select | conditional | select, name=grade_max | FN-M16-5.1.3 |
| EL-M16-S7-026 | label | visible-default | "Maks Pemain" | FN-M16-5.1.3 |
| EL-M16-S7-027 | select | visible-default | select, name=max_players | FN-M16-5.1.3 |
| EL-M16-S7-028 | button | visible-default | "🎲 Cipta Bilik", type=submit | FN-M16-5.1.3 |
| EL-M16-S7-029 | card | visible-default | "🔑 Masuk Bilik" | FN-M16-5.1.4 |
| EL-M16-S7-030 | heading | visible-default | "🔑 Masuk Bilik" | FN-M16-5.1.4 |
| EL-M16-S7-031 | form | visible-default | form | FN-M16-5.1.4 |
| EL-M16-S7-032 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M16-5.1.4 |
| EL-M16-S7-033 | label | visible-default | "Kod Bilik (6 aksara)" | FN-M16-5.1.4 |
| EL-M16-S7-034 | input | visible-default | input, name=room_code, type=text | FN-M16-5.1.4 |
| EL-M16-S7-035 | button | visible-default | "🚀 Masuk Bilik", type=submit | FN-M16-5.1.4 |
| EL-M16-S7-036 | heading | visible-default | "Cara Bermain:" | FN-M16-5.1.5 |
| EL-M16-S7-037 | text | visible-default | "🎲 1. Gulung dadu dan bergerak di papan" | FN-M16-5.1.5 |
| EL-M16-S7-038 | text | visible-default | "📝 2. Jatuh di petak kuiz — jawab soalan!" | FN-M16-5.1.5 |
| EL-M16-S7-039 | text | visible-default | "🪜 3. Naik tangga untuk shortcut" | FN-M16-5.1.5 |
| EL-M16-S7-040 | text | visible-default | "🐍 4. Elak ular yang menarik turun" | FN-M16-5.1.5 |
| EL-M16-S7-041 | text | visible-default | "🏆 5. Sampai petak 50 dulu = MENANG!" | FN-M16-5.1.5 |
| EL-M16-S7-042 | text | visible-default | "🔍" | FN-M16-5.2.1 |
| EL-M16-S7-043 | heading | visible-default | "Cari Lawan Auto" | FN-M16-5.2.1 |
| EL-M16-S7-044 | text | visible-default | "Sistem cari pemain sepadan secara automatik" | FN-M16-5.2.1 |
| EL-M16-S7-045 | label | visible-default | "Subjek" | FN-M16-5.2.1 |
| EL-M16-S7-046 | select | visible-default | select | FN-M16-5.2.1 |
| EL-M16-S7-047 | label | visible-default | "Padanan" | FN-M16-5.2.1 |
| EL-M16-S7-048 | select | visible-default | select | FN-M16-5.2.1 |
| EL-M16-S7-049 | button | visible-default | "🔍 Cari Lawan Sekarang", type=submit | FN-M16-5.2.1 |
| EL-M16-S7-050 | card | hidden-only | "Mencari lawan... 0s" | FN-M16-5.2.2 |
| EL-M16-S7-051 | text | conditional | "Mencari lawan..." | FN-M16-5.2.2 |
| EL-M16-S7-052 | text | conditional | "30s" | FN-M16-5.2.2 |
| EL-M16-S7-053 | text | conditional | "Sila tunggu, sistem sedang mencari pemain sepadan" | FN-M16-5.2.2 |
| EL-M16-S7-054 | button | conditional | "Batal Carian", type=submit | FN-M16-5.2.2 |
| EL-M16-S7-055 | heading | visible-default | "🏆 Papan Markah — Top 10 Juara" | FN-M16-5.3.1 |
| EL-M16-S7-056 | table | visible-default | table | FN-M16-5.3.1 |
| EL-M16-S7-057 | card | conditional | "Mencari lawan... 30s" | FN-M16-5.2.2 |
| EL-M16-S7-058 | alert | conditional | "Tiada lawan dijumpai. Cuba lagi!" | FN-M16-5.2.3 |
| EL-M16-S7-059 | card | conditional | "Mencari lawan... 12s" | FN-M16-5.2.2 |

#### S8 — `/perang-fakta` (37 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M16-S8-001 | text | hidden-only | "LIVE:", fa-circle | FN-M16-1.3.1 |
| EL-M16-S8-002 | text | hidden-only | "MAIN" | FN-M16-1.3.1 |
| EL-M16-S8-003 | text | hidden-only | "DAFTAR" | FN-M16-1.3.1 |
| EL-M16-S8-004 | heading | visible-default | "⚔️ Perang Fakta" | FN-M16-5.4.1 |
| EL-M16-S8-005 | text | visible-default | "Betul atau Salah? Vote & buktikan pengetahuan kamu!" | FN-M16-5.4.1 |
| EL-M16-S8-006 | text | visible-default | "2-6 pemain · 15 pusingan · 10 saat setiap soalan" | FN-M16-5.4.1 |
| EL-M16-S8-007 | card | visible-default | "🏠 Cipta Bilik Baru" | FN-M16-5.4.2 |
| EL-M16-S8-008 | heading | visible-default | "🏠 Cipta Bilik Baru" | FN-M16-5.4.2 |
| EL-M16-S8-009 | form | visible-default | form | FN-M16-5.4.2 |
| EL-M16-S8-010 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M16-5.4.2 |
| EL-M16-S8-011 | label | visible-default | "Subjek" | FN-M16-5.4.2 |
| EL-M16-S8-012 | select | visible-default | select, name=subject | FN-M16-5.4.2 |
| EL-M16-S8-013 | label | visible-default | "Tahap" | FN-M16-5.4.2 |
| EL-M16-S8-014 | hidden-field | hidden-only | hidden-field, name=grade_level, type=hidden | FN-M16-5.4.2 |
| EL-M16-S8-015 | text | visible-default | "Darjah 4 (auto)" | FN-M16-5.4.2 |
| EL-M16-S8-016 | button | visible-default | "Tukar", type=button | FN-M16-5.4.2 |
| EL-M16-S8-017 | select | conditional | select, name=grade_level | FN-M16-5.4.2 |
| EL-M16-S8-018 | label | visible-default | "Siapa boleh join?" | FN-M16-5.4.2 |
| EL-M16-S8-019 | select | visible-default | select, name=match_mode | FN-M16-5.4.2 |
| EL-M16-S8-020 | button | visible-default | "⚔️ Cipta Bilik", type=submit | FN-M16-5.4.2 |
| EL-M16-S8-021 | card | visible-default | "🔑 Masuk Dengan Kod" | FN-M16-5.4.3 |
| EL-M16-S8-022 | heading | visible-default | "🔑 Masuk Dengan Kod" | FN-M16-5.4.3 |
| EL-M16-S8-023 | form | visible-default | form | FN-M16-5.4.3 |
| EL-M16-S8-024 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M16-5.4.3 |
| EL-M16-S8-025 | input | visible-default | input, name=room_code, type=text | FN-M16-5.4.3 |
| EL-M16-S8-026 | button | visible-default | "Masuk", type=submit | FN-M16-5.4.3 |
| EL-M16-S8-027 | card | visible-default | "🏆 Pendahulu" | FN-M16-5.4.4 |
| EL-M16-S8-028 | heading | visible-default | "🏆 Pendahulu" | FN-M16-5.4.4 |
| EL-M16-S8-029 | text | visible-default | "🥇 <name>" | FN-M16-5.4.4 |
| EL-M16-S8-030 | text | visible-default | "5 menang" | FN-M16-5.4.4 |
| EL-M16-S8-031 | text | visible-default | "🥈 <name>" | FN-M16-5.4.4 |
| EL-M16-S8-032 | text | visible-default | "4 menang" | FN-M16-5.4.4 |
| EL-M16-S8-033 | text | visible-default | "🥉 <name>" | FN-M16-5.4.4 |
| EL-M16-S8-034 | text | visible-default | "3 menang" | FN-M16-5.4.4 |
| EL-M16-S8-035 | text | visible-default | "4. <name>" | FN-M16-5.4.4 |
| EL-M16-S8-036 | text | visible-default | "3 menang" | FN-M16-5.4.4 |
| EL-M16-S8-037 | alert | conditional | "Bilik tidak dijumpai." | FN-M16-5.4.5 |

#### S9 — `/benteng-ilmu` (37 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M16-S9-001 | text | hidden-only | "LIVE:", fa-circle | FN-M16-1.3.1 |
| EL-M16-S9-002 | text | hidden-only | "MAIN" | FN-M16-1.3.1 |
| EL-M16-S9-003 | text | hidden-only | "DAFTAR" | FN-M16-1.3.1 |
| EL-M16-S9-004 | heading | visible-default | "🏰 Benteng Ilmu" | FN-M16-5.4.1 |
| EL-M16-S9-005 | text | visible-default | "Serang benteng lawan dengan kuasa ilmu! Jawab betul = serang, jawab salah = rosa …" | FN-M16-5.4.1 |
| EL-M16-S9-006 | text | visible-default | "2 pemain · HP 100 · Giliran bertukar" | FN-M16-5.4.1 |
| EL-M16-S9-007 | card | visible-default | "🏠 Cipta Bilik Baru" | FN-M16-5.4.2 |
| EL-M16-S9-008 | heading | visible-default | "🏠 Cipta Bilik Baru" | FN-M16-5.4.2 |
| EL-M16-S9-009 | form | visible-default | form | FN-M16-5.4.2 |
| EL-M16-S9-010 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M16-5.4.2 |
| EL-M16-S9-011 | label | visible-default | "Subjek" | FN-M16-5.4.2 |
| EL-M16-S9-012 | select | visible-default | select, name=subject | FN-M16-5.4.2 |
| EL-M16-S9-013 | label | visible-default | "Tahap" | FN-M16-5.4.2 |
| EL-M16-S9-014 | hidden-field | hidden-only | hidden-field, name=grade_level, type=hidden | FN-M16-5.4.2 |
| EL-M16-S9-015 | text | visible-default | "Darjah 4 (auto)" | FN-M16-5.4.2 |
| EL-M16-S9-016 | button | visible-default | "Tukar", type=button | FN-M16-5.4.2 |
| EL-M16-S9-017 | select | conditional | select, name=grade_level | FN-M16-5.4.2 |
| EL-M16-S9-018 | label | visible-default | "Siapa boleh join?" | FN-M16-5.4.2 |
| EL-M16-S9-019 | select | visible-default | select, name=match_mode | FN-M16-5.4.2 |
| EL-M16-S9-020 | button | visible-default | "🏰 Cipta Bilik", type=submit | FN-M16-5.4.2 |
| EL-M16-S9-021 | card | visible-default | "🔑 Masuk Dengan Kod" | FN-M16-5.4.3 |
| EL-M16-S9-022 | heading | visible-default | "🔑 Masuk Dengan Kod" | FN-M16-5.4.3 |
| EL-M16-S9-023 | form | visible-default | form | FN-M16-5.4.3 |
| EL-M16-S9-024 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M16-5.4.3 |
| EL-M16-S9-025 | input | visible-default | input, name=room_code, type=text | FN-M16-5.4.3 |
| EL-M16-S9-026 | button | visible-default | "Masuk", type=submit | FN-M16-5.4.3 |
| EL-M16-S9-027 | card | visible-default | "🏆 Pendahulu" | FN-M16-5.4.4 |
| EL-M16-S9-028 | heading | visible-default | "🏆 Pendahulu" | FN-M16-5.4.4 |
| EL-M16-S9-029 | text | visible-default | "🥇 <name>" | FN-M16-5.4.4 |
| EL-M16-S9-030 | text | visible-default | "2 menang" | FN-M16-5.4.4 |
| EL-M16-S9-031 | text | visible-default | "🥈 <name>" | FN-M16-5.4.4 |
| EL-M16-S9-032 | text | visible-default | "1 menang" | FN-M16-5.4.4 |
| EL-M16-S9-033 | text | visible-default | "🥉 <name>" | FN-M16-5.4.4 |
| EL-M16-S9-034 | text | visible-default | "1 menang" | FN-M16-5.4.4 |
| EL-M16-S9-035 | text | visible-default | "4. <name>" | FN-M16-5.4.4 |
| EL-M16-S9-036 | text | visible-default | "1 menang" | FN-M16-5.4.4 |
| EL-M16-S9-037 | alert | conditional | "Bilik tidak dijumpai." | FN-M16-5.4.5 |

#### S10 — `/perlumbaan-matematik` (37 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M16-S10-001 | text | hidden-only | "LIVE:", fa-circle | FN-M16-1.3.1 |
| EL-M16-S10-002 | text | hidden-only | "MAIN" | FN-M16-1.3.1 |
| EL-M16-S10-003 | text | hidden-only | "DAFTAR" | FN-M16-1.3.1 |
| EL-M16-S10-004 | heading | visible-default | "🏎️ Perlumbaan Matematik" | FN-M16-5.4.1 |
| EL-M16-S10-005 | text | visible-default | "Jawab soalan, lari ke garisan penamat! Siapa paling pantas menang!" | FN-M16-5.4.1 |
| EL-M16-S10-006 | text | visible-default | "2-4 pemain · 20 langkah · Siapa sampai dulu menang" | FN-M16-5.4.1 |
| EL-M16-S10-007 | card | visible-default | "🏠 Cipta Bilik Baru" | FN-M16-5.4.2 |
| EL-M16-S10-008 | heading | visible-default | "🏠 Cipta Bilik Baru" | FN-M16-5.4.2 |
| EL-M16-S10-009 | form | visible-default | form | FN-M16-5.4.2 |
| EL-M16-S10-010 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M16-5.4.2 |
| EL-M16-S10-011 | label | visible-default | "Subjek" | FN-M16-5.4.2 |
| EL-M16-S10-012 | select | visible-default | select, name=subject | FN-M16-5.4.2 |
| EL-M16-S10-013 | label | visible-default | "Tahap" | FN-M16-5.4.2 |
| EL-M16-S10-014 | hidden-field | hidden-only | hidden-field, name=grade_level, type=hidden | FN-M16-5.4.2 |
| EL-M16-S10-015 | text | visible-default | "Darjah 4 (auto)" | FN-M16-5.4.2 |
| EL-M16-S10-016 | button | visible-default | "Tukar", type=button | FN-M16-5.4.2 |
| EL-M16-S10-017 | select | conditional | select, name=grade_level | FN-M16-5.4.2 |
| EL-M16-S10-018 | label | visible-default | "Siapa boleh join?" | FN-M16-5.4.2 |
| EL-M16-S10-019 | select | visible-default | select, name=match_mode | FN-M16-5.4.2 |
| EL-M16-S10-020 | button | visible-default | "🏎️ Cipta Bilik", type=submit | FN-M16-5.4.2 |
| EL-M16-S10-021 | card | visible-default | "🔑 Masuk Dengan Kod" | FN-M16-5.4.3 |
| EL-M16-S10-022 | heading | visible-default | "🔑 Masuk Dengan Kod" | FN-M16-5.4.3 |
| EL-M16-S10-023 | form | visible-default | form | FN-M16-5.4.3 |
| EL-M16-S10-024 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M16-5.4.3 |
| EL-M16-S10-025 | input | visible-default | input, name=room_code, type=text | FN-M16-5.4.3 |
| EL-M16-S10-026 | button | visible-default | "Masuk", type=submit | FN-M16-5.4.3 |
| EL-M16-S10-027 | card | visible-default | "🏆 Pendahulu" | FN-M16-5.4.4 |
| EL-M16-S10-028 | heading | visible-default | "🏆 Pendahulu" | FN-M16-5.4.4 |
| EL-M16-S10-029 | text | visible-default | "🥇 <name>" | FN-M16-5.4.4 |
| EL-M16-S10-030 | text | visible-default | "2 menang" | FN-M16-5.4.4 |
| EL-M16-S10-031 | text | visible-default | "🥈 <name>" | FN-M16-5.4.4 |
| EL-M16-S10-032 | text | visible-default | "2 menang" | FN-M16-5.4.4 |
| EL-M16-S10-033 | text | visible-default | "🥉 <name>" | FN-M16-5.4.4 |
| EL-M16-S10-034 | text | visible-default | "1 menang" | FN-M16-5.4.4 |
| EL-M16-S10-035 | text | visible-default | "4. <name>" | FN-M16-5.4.4 |
| EL-M16-S10-036 | text | visible-default | "1 menang" | FN-M16-5.4.4 |
| EL-M16-S10-037 | alert | conditional | "Bilik tidak dijumpai." | FN-M16-5.4.5 |

#### S11 — `/kuiz-relay` (31 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M16-S11-001 | text | hidden-only | "LIVE:", fa-circle | FN-M16-1.3.1 |
| EL-M16-S11-002 | text | hidden-only | "MAIN" | FN-M16-1.3.1 |
| EL-M16-S11-003 | text | hidden-only | "DAFTAR" | FN-M16-1.3.1 |
| EL-M16-S11-004 | heading | visible-default | "🏃‍♂️ Kuiz Relay" | FN-M16-5.4.1 |
| EL-M16-S11-005 | text | visible-default | "Berpasukan! Jawab soalan secara bergilir-gilir. Pasukan terbaik menang!" | FN-M16-5.4.1 |
| EL-M16-S11-006 | text | visible-default | "4-8 pemain · 2 pasukan · 10 pusingan" | FN-M16-5.4.1 |
| EL-M16-S11-007 | card | visible-default | "🏠 Cipta Bilik Baru" | FN-M16-5.4.2 |
| EL-M16-S11-008 | heading | visible-default | "🏠 Cipta Bilik Baru" | FN-M16-5.4.2 |
| EL-M16-S11-009 | form | visible-default | form | FN-M16-5.4.2 |
| EL-M16-S11-010 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M16-5.4.2 |
| EL-M16-S11-011 | label | visible-default | "Subjek" | FN-M16-5.4.2 |
| EL-M16-S11-012 | select | visible-default | select, name=subject | FN-M16-5.4.2 |
| EL-M16-S11-013 | label | visible-default | "Tahap" | FN-M16-5.4.2 |
| EL-M16-S11-014 | hidden-field | hidden-only | hidden-field, name=grade_level, type=hidden | FN-M16-5.4.2 |
| EL-M16-S11-015 | text | visible-default | "Darjah 4 (auto)" | FN-M16-5.4.2 |
| EL-M16-S11-016 | button | visible-default | "Tukar", type=button | FN-M16-5.4.2 |
| EL-M16-S11-017 | select | conditional | select, name=grade_level | FN-M16-5.4.2 |
| EL-M16-S11-018 | label | visible-default | "Siapa boleh join?" | FN-M16-5.4.2 |
| EL-M16-S11-019 | select | visible-default | select, name=match_mode | FN-M16-5.4.2 |
| EL-M16-S11-020 | button | visible-default | "🏃‍♂️ Cipta Bilik", type=submit | FN-M16-5.4.2 |
| EL-M16-S11-021 | card | visible-default | "🔑 Masuk Dengan Kod" | FN-M16-5.4.3 |
| EL-M16-S11-022 | heading | visible-default | "🔑 Masuk Dengan Kod" | FN-M16-5.4.3 |
| EL-M16-S11-023 | form | visible-default | form | FN-M16-5.4.3 |
| EL-M16-S11-024 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M16-5.4.3 |
| EL-M16-S11-025 | input | visible-default | input, name=room_code, type=text | FN-M16-5.4.3 |
| EL-M16-S11-026 | button | visible-default | "Masuk", type=submit | FN-M16-5.4.3 |
| EL-M16-S11-027 | card | visible-default | "🏆 Pendahulu" | FN-M16-5.4.4 |
| EL-M16-S11-028 | heading | visible-default | "🏆 Pendahulu" | FN-M16-5.4.4 |
| EL-M16-S11-029 | text | visible-default | "🥇 <name>" | FN-M16-5.4.4 |
| EL-M16-S11-030 | text | visible-default | "1 kali MVP" | FN-M16-5.4.4 |
| EL-M16-S11-031 | alert | conditional | "Bilik tidak dijumpai." | FN-M16-5.4.5 |

#### S12 — `/teka-silang-kata` (37 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M16-S12-001 | text | hidden-only | "LIVE:", fa-circle | FN-M16-1.3.1 |
| EL-M16-S12-002 | text | hidden-only | "MAIN" | FN-M16-1.3.1 |
| EL-M16-S12-003 | text | hidden-only | "DAFTAR" | FN-M16-1.3.1 |
| EL-M16-S12-004 | heading | visible-default | "📝 Teka Silang Kata" | FN-M16-5.4.1 |
| EL-M16-S12-005 | text | visible-default | "Isi silang kata paling pantas! Lawan masa dan lawan untuk markah tertinggi!" | FN-M16-5.4.1 |
| EL-M16-S12-006 | text | visible-default | "2 pemain · 5 minit · Markah tertinggi menang" | FN-M16-5.4.1 |
| EL-M16-S12-007 | card | visible-default | "🏠 Cipta Bilik Baru" | FN-M16-5.4.2 |
| EL-M16-S12-008 | heading | visible-default | "🏠 Cipta Bilik Baru" | FN-M16-5.4.2 |
| EL-M16-S12-009 | form | visible-default | form | FN-M16-5.4.2 |
| EL-M16-S12-010 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M16-5.4.2 |
| EL-M16-S12-011 | label | visible-default | "Subjek" | FN-M16-5.4.2 |
| EL-M16-S12-012 | select | visible-default | select, name=subject | FN-M16-5.4.2 |
| EL-M16-S12-013 | label | visible-default | "Tahap" | FN-M16-5.4.2 |
| EL-M16-S12-014 | hidden-field | hidden-only | hidden-field, name=grade_level, type=hidden | FN-M16-5.4.2 |
| EL-M16-S12-015 | text | visible-default | "Darjah 4 (auto)" | FN-M16-5.4.2 |
| EL-M16-S12-016 | button | visible-default | "Tukar", type=button | FN-M16-5.4.2 |
| EL-M16-S12-017 | select | conditional | select, name=grade_level | FN-M16-5.4.2 |
| EL-M16-S12-018 | label | visible-default | "Siapa boleh join?" | FN-M16-5.4.2 |
| EL-M16-S12-019 | select | visible-default | select, name=match_mode | FN-M16-5.4.2 |
| EL-M16-S12-020 | button | visible-default | "📝 Cipta Bilik", type=submit | FN-M16-5.4.2 |
| EL-M16-S12-021 | card | visible-default | "🔑 Masuk Dengan Kod" | FN-M16-5.4.3 |
| EL-M16-S12-022 | heading | visible-default | "🔑 Masuk Dengan Kod" | FN-M16-5.4.3 |
| EL-M16-S12-023 | form | visible-default | form | FN-M16-5.4.3 |
| EL-M16-S12-024 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M16-5.4.3 |
| EL-M16-S12-025 | input | visible-default | input, name=room_code, type=text | FN-M16-5.4.3 |
| EL-M16-S12-026 | button | visible-default | "Masuk", type=submit | FN-M16-5.4.3 |
| EL-M16-S12-027 | card | visible-default | "🏆 Pendahulu" | FN-M16-5.4.4 |
| EL-M16-S12-028 | heading | visible-default | "🏆 Pendahulu" | FN-M16-5.4.4 |
| EL-M16-S12-029 | text | visible-default | "🥇 <name>" | FN-M16-5.4.4 |
| EL-M16-S12-030 | text | visible-default | "1 menang" | FN-M16-5.4.4 |
| EL-M16-S12-031 | text | visible-default | "🥈 <name>" | FN-M16-5.4.4 |
| EL-M16-S12-032 | text | visible-default | "1 menang" | FN-M16-5.4.4 |
| EL-M16-S12-033 | text | visible-default | "🥉 <name>" | FN-M16-5.4.4 |
| EL-M16-S12-034 | text | visible-default | "1 menang" | FN-M16-5.4.4 |
| EL-M16-S12-035 | text | visible-default | "4. <name>" | FN-M16-5.4.4 |
| EL-M16-S12-036 | text | visible-default | "1 menang" | FN-M16-5.4.4 |
| EL-M16-S12-037 | alert | conditional | "Bilik tidak dijumpai." | FN-M16-5.4.5 |

#### S13 — `/permainan/betul-salah` (65 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M16-S13-001 | text | hidden-only | "LIVE:", fa-circle | FN-M16-1.3.1 |
| EL-M16-S13-002 | text | hidden-only | "MAIN" | FN-M16-1.3.1 |
| EL-M16-S13-003 | text | hidden-only | "DAFTAR" | FN-M16-1.3.1 |
| EL-M16-S13-004 | modal | hidden-only | "✅❌ BETUL ATAU SALAH" | FN-M16-6.2.1 |
| EL-M16-S13-005 | text | hidden-only | "✅❌ BETUL ATAU SALAH" | FN-M16-6.2.1 |
| EL-M16-S13-006 | modal | visible-default | "✅❌ BETUL ATAU SALAH" | FN-M16-6.2.1 |
| EL-M16-S13-007 | text | visible-default | "✅❌ BETUL ATAU SALAH" | FN-M16-6.2.1 |
| EL-M16-S13-008 | text | visible-default | "2" | FN-M16-6.2.1 |
| EL-M16-S13-009 | badge | hidden-only | "🔥 0 KOMBO" | FN-M16-6.2.2 |
| EL-M16-S13-010 | text | conditional | "Skor" | FN-M16-6.2.2 |
| EL-M16-S13-011 | text | conditional | "0" | FN-M16-6.2.2 |
| EL-M16-S13-012 | text | conditional | "43" | FN-M16-6.2.2 |
| EL-M16-S13-013 | text | conditional | "Betul" | FN-M16-6.2.2 |
| EL-M16-S13-014 | text | conditional | "0" | FN-M16-6.2.2 |
| EL-M16-S13-015 | card | hidden-only | card | FN-M16-6.2.2 |
| EL-M16-S13-016 | button | hidden-only | "❌", type=submit | FN-M16-6.2.2 |
| EL-M16-S13-017 | button | hidden-only | "✅", type=submit | FN-M16-6.2.2 |
| EL-M16-S13-018 | text | hidden-only | "❌ SALAH ✅ BETUL" | FN-M16-6.2.2 |
| EL-M16-S13-019 | modal | hidden-only | modal | FN-M16-6.2.4 |
| EL-M16-S13-020 | card | hidden-only | card | FN-M16-6.2.4 |
| EL-M16-S13-021 | heading | hidden-only | heading | FN-M16-6.2.4 |
| EL-M16-S13-022 | text | hidden-only | "45 saat — Betul atau Salah!" | FN-M16-6.2.4 |
| EL-M16-S13-023 | text | hidden-only | "Skor Total" | FN-M16-6.2.4 |
| EL-M16-S13-024 | text | hidden-only | "Ketepatan" | FN-M16-6.2.4 |
| EL-M16-S13-025 | text | hidden-only | "Kombo Max" | FN-M16-6.2.4 |
| EL-M16-S13-026 | text | hidden-only | "Syiling" | FN-M16-6.2.4 |
| EL-M16-S13-027 | text | hidden-only | "🏆 REKOD BARU!" | FN-M16-6.2.4 |
| EL-M16-S13-028 | link | hidden-only | "🔄 Main Lagi", → /permainan/betul-salah | FN-M16-6.2.4 |
| EL-M16-S13-029 | link | hidden-only | "🎮 Hub", → /permainan | FN-M16-6.2.4 |
| EL-M16-S13-030 | modal | conditional | "Hebat!" | FN-M16-6.2.4 |
| EL-M16-S13-031 | card | conditional | "Hebat!" | FN-M16-6.2.4 |
| EL-M16-S13-032 | text | conditional | "✅" | FN-M16-6.2.4 |
| EL-M16-S13-033 | heading | conditional | "Hebat!" | FN-M16-6.2.4 |
| EL-M16-S13-034 | text | conditional | "45 saat — Betul atau Salah!" | FN-M16-6.2.4 |
| EL-M16-S13-035 | text | conditional | "0" | FN-M16-6.2.4 |
| EL-M16-S13-036 | text | conditional | "Skor Total" | FN-M16-6.2.4 |
| EL-M16-S13-037 | text | conditional | "0/0" | FN-M16-6.2.4 |
| EL-M16-S13-038 | text | conditional | "Ketepatan" | FN-M16-6.2.4 |
| EL-M16-S13-039 | text | conditional | "0 🔥" | FN-M16-6.2.4 |
| EL-M16-S13-040 | text | conditional | "Kombo Max" | FN-M16-6.2.4 |
| EL-M16-S13-041 | text | conditional | "0 🪙" | FN-M16-6.2.4 |
| EL-M16-S13-042 | text | conditional | "Syiling" | FN-M16-6.2.4 |
| EL-M16-S13-043 | text | hidden-only | "🏆 REKOD BARU!" | FN-M16-6.2.4 |
| EL-M16-S13-044 | text | conditional | "🏆 REKOD BARU!" | FN-M16-6.2.4 |
| EL-M16-S13-045 | link | conditional | "🔄 Main Lagi", → /permainan/betul-salah | FN-M16-6.2.4 |
| EL-M16-S13-046 | link | conditional | "🎮 Hub", → /permainan | FN-M16-6.2.4 |
| EL-M16-S13-047 | text | conditional | "✅" | FN-M16-6.1.1 |
| EL-M16-S13-048 | heading | conditional | "Betul atau Salah" | FN-M16-6.1.1 |
| EL-M16-S13-049 | text | conditional | "Pilih darjah / tingkatan kamu:" | FN-M16-6.1.1 |
| EL-M16-S13-050 | text | conditional | "🏫 Sekolah Rendah" | FN-M16-6.1.1 |
| EL-M16-S13-051 | link | conditional | "Darjah 1", → /permainan/betul-salah?darjah=1 | FN-M16-6.1.1 |
| EL-M16-S13-052 | link | conditional | "Darjah 2", → /permainan/betul-salah?darjah=2 | FN-M16-6.1.1 |
| EL-M16-S13-053 | link | conditional | "Darjah 3", → /permainan/betul-salah?darjah=3 | FN-M16-6.1.1 |
| EL-M16-S13-054 | link | conditional | "Darjah 4", → /permainan/betul-salah?darjah=4 | FN-M16-6.1.1 |
| EL-M16-S13-055 | link | conditional | "← Kembali ke Hub", → /permainan | FN-M16-6.1.1 |
| EL-M16-S13-056 | text | conditional | "Kenyataan 1" | FN-M16-6.2.2 |
| EL-M16-S13-057 | card | conditional | "Dalam konteks bab ini, "garisan menegak dan melintang membentuk petak grid" meru …" | FN-M16-6.2.2 |
| EL-M16-S13-058 | text | conditional | "Dalam konteks bab ini, "garisan menegak dan melintang membentuk petak grid" meru …" | FN-M16-6.2.2 |
| EL-M16-S13-059 | button | conditional | "❌", type=submit | FN-M16-6.2.2 |
| EL-M16-S13-060 | button | conditional | "✅", type=submit | FN-M16-6.2.2 |
| EL-M16-S13-061 | text | conditional | "❌ SALAH ✅ BETUL" | FN-M16-6.2.2 |
| EL-M16-S13-062 | badge | conditional | "🔥 6 KOMBO" | FN-M16-6.2.2 |
| EL-M16-S13-063 | card | conditional | "Apakah konsep tepat dalam Jawi D4 bagi fakta berikut: isi karangan perlu disusun …" | FN-M16-6.2.2 |
| EL-M16-S13-064 | card | conditional | "Rafiq's books fell on the floor. What kind thing can you say to him? → Let me he …" | FN-M16-6.2.2 |
| EL-M16-S13-065 | card | conditional | "Pilih nombor yang mempunyai 5 puluh ribu, 5 ribu, 6 ratus, 9 puluh dan 8 satu. → …" | FN-M16-6.2.2 |

#### S14 — `/permainan/cabaran-kilat` (63 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M16-S14-001 | text | hidden-only | "LIVE:", fa-circle | FN-M16-1.3.1 |
| EL-M16-S14-002 | text | hidden-only | "MAIN" | FN-M16-1.3.1 |
| EL-M16-S14-003 | text | hidden-only | "DAFTAR" | FN-M16-1.3.1 |
| EL-M16-S14-004 | modal | hidden-only | "⚡ CABARAN KILAT" | FN-M16-6.3.1 |
| EL-M16-S14-005 | text | hidden-only | "⚡ CABARAN KILAT" | FN-M16-6.3.1 |
| EL-M16-S14-006 | badge | visible-default | "🔥 6x COMBO" | FN-M16-6.3.2 |
| EL-M16-S14-007 | alert | hidden-only | alert | FN-M16-6.3.2 |
| EL-M16-S14-008 | alert | hidden-only | alert | FN-M16-6.3.2 |
| EL-M16-S14-009 | text | visible-default | "Skor" | FN-M16-6.3.2 |
| EL-M16-S14-010 | text | visible-default | "0" | FN-M16-6.3.2 |
| EL-M16-S14-011 | text | visible-default | "58" | FN-M16-6.3.2 |
| EL-M16-S14-012 | text | visible-default | "Betul" | FN-M16-6.3.2 |
| EL-M16-S14-013 | text | visible-default | "0" | FN-M16-6.3.2 |
| EL-M16-S14-014 | button | hidden-only | button, type=submit | FN-M16-6.3.2 |
| EL-M16-S14-015 | text | visible-default | "Soalan 1" | FN-M16-6.3.2 |
| EL-M16-S14-016 | badge | visible-default | "Sederhana" | FN-M16-6.3.2 |
| EL-M16-S14-017 | text | visible-default | "Ali ingin membaca al-Quran di kelas agama. Apakah adab yang paling betul?" | FN-M16-6.3.2 |
| EL-M16-S14-018 | button | hidden-only | button, type=submit | FN-M16-6.3.2 |
| EL-M16-S14-019 | button | visible-default | "A. membaca dengan tergesa-gesa tanpa adab", type=submit | FN-M16-6.3.2 |
| EL-M16-S14-020 | button | visible-default | "B. mengabaikan tajwid langsung", type=submit | FN-M16-6.3.2 |
| EL-M16-S14-021 | button | visible-default | "C. membaca dengan sebutan yang jelas", type=submit | FN-M16-6.3.2 |
| EL-M16-S14-022 | button | visible-default | "D. meletakkan al-Quran di tempat tidak sesuai", type=submit | FN-M16-6.3.2 |
| EL-M16-S14-023 | modal | hidden-only | modal | FN-M16-6.3.4 |
| EL-M16-S14-024 | card | hidden-only | card | FN-M16-6.3.4 |
| EL-M16-S14-025 | heading | hidden-only | heading | FN-M16-6.3.4 |
| EL-M16-S14-026 | text | hidden-only | "60 saat penuh aksi!" | FN-M16-6.3.4 |
| EL-M16-S14-027 | text | hidden-only | "Skor Total" | FN-M16-6.3.4 |
| EL-M16-S14-028 | text | hidden-only | "Betul / Jawab" | FN-M16-6.3.4 |
| EL-M16-S14-029 | text | hidden-only | "Combo Max 🔥" | FN-M16-6.3.4 |
| EL-M16-S14-030 | text | hidden-only | "Syiling" | FN-M16-6.3.4 |
| EL-M16-S14-031 | text | hidden-only | "🏆 REKOD BARU!" | FN-M16-6.3.4 |
| EL-M16-S14-032 | link | hidden-only | "⚡ Main Lagi", → /permainan/cabaran-kilat | FN-M16-6.3.4 |
| EL-M16-S14-033 | link | hidden-only | "🎮 Hub", → /permainan | FN-M16-6.3.4 |
| EL-M16-S14-034 | modal | conditional | "⚡ CABARAN KILAT" | FN-M16-6.3.1 |
| EL-M16-S14-035 | text | conditional | "⚡ CABARAN KILAT" | FN-M16-6.3.1 |
| EL-M16-S14-036 | text | conditional | "2" | FN-M16-6.3.1 |
| EL-M16-S14-037 | badge | hidden-only | "🔥 0x COMBO" | FN-M16-6.3.2 |
| EL-M16-S14-038 | modal | conditional | "Pantas!" | FN-M16-6.3.4 |
| EL-M16-S14-039 | card | conditional | "Pantas!" | FN-M16-6.3.4 |
| EL-M16-S14-040 | text | conditional | "⚡" | FN-M16-6.3.4 |
| EL-M16-S14-041 | heading | conditional | "Pantas!" | FN-M16-6.3.4 |
| EL-M16-S14-042 | text | conditional | "60 saat penuh aksi!" | FN-M16-6.3.4 |
| EL-M16-S14-043 | text | conditional | "0" | FN-M16-6.3.4 |
| EL-M16-S14-044 | text | conditional | "Skor Total" | FN-M16-6.3.4 |
| EL-M16-S14-045 | text | conditional | "0/0" | FN-M16-6.3.4 |
| EL-M16-S14-046 | text | conditional | "Betul / Jawab" | FN-M16-6.3.4 |
| EL-M16-S14-047 | text | conditional | "0x" | FN-M16-6.3.4 |
| EL-M16-S14-048 | text | conditional | "Combo Max 🔥" | FN-M16-6.3.4 |
| EL-M16-S14-049 | text | conditional | "0 🪙" | FN-M16-6.3.4 |
| EL-M16-S14-050 | text | conditional | "Syiling" | FN-M16-6.3.4 |
| EL-M16-S14-051 | text | hidden-only | "🏆 REKOD BARU!" | FN-M16-6.3.4 |
| EL-M16-S14-052 | text | conditional | "🏆 REKOD BARU!" | FN-M16-6.3.4 |
| EL-M16-S14-053 | link | conditional | "⚡ Main Lagi", → /permainan/cabaran-kilat | FN-M16-6.3.4 |
| EL-M16-S14-054 | link | conditional | "🎮 Hub", → /permainan | FN-M16-6.3.4 |
| EL-M16-S14-055 | text | conditional | "⚡" | FN-M16-6.1.1 |
| EL-M16-S14-056 | heading | conditional | "Cabaran Kilat" | FN-M16-6.1.1 |
| EL-M16-S14-057 | text | conditional | "Pilih darjah / tingkatan kamu:" | FN-M16-6.1.1 |
| EL-M16-S14-058 | text | conditional | "🏫 Sekolah Rendah" | FN-M16-6.1.1 |
| EL-M16-S14-059 | link | conditional | "Darjah 1", → /permainan/cabaran-kilat?darjah=1 | FN-M16-6.1.1 |
| EL-M16-S14-060 | link | conditional | "Darjah 2", → /permainan/cabaran-kilat?darjah=2 | FN-M16-6.1.1 |
| EL-M16-S14-061 | link | conditional | "Darjah 3", → /permainan/cabaran-kilat?darjah=3 | FN-M16-6.1.1 |
| EL-M16-S14-062 | link | conditional | "Darjah 4", → /permainan/cabaran-kilat?darjah=4 | FN-M16-6.1.1 |
| EL-M16-S14-063 | link | conditional | "← Kembali ke Hub", → /permainan | FN-M16-6.1.1 |

#### S15 — `/permainan/tembak-jawapan` (74 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M16-S15-001 | text | hidden-only | "LIVE:", fa-circle | FN-M16-1.3.1 |
| EL-M16-S15-002 | text | hidden-only | "MAIN" | FN-M16-1.3.1 |
| EL-M16-S15-003 | text | hidden-only | "DAFTAR" | FN-M16-1.3.1 |
| EL-M16-S15-004 | modal | hidden-only | "🎯 TEMBAK JAWAPAN" | FN-M16-6.4.1 |
| EL-M16-S15-005 | text | hidden-only | "🎯 TEMBAK JAWAPAN" | FN-M16-6.4.1 |
| EL-M16-S15-006 | text | hidden-only | "Tap jawapan yang betul sebelum jatuh!" | FN-M16-6.4.1 |
| EL-M16-S15-007 | modal | visible-default | "🎯 TEMBAK JAWAPAN" | FN-M16-6.4.1 |
| EL-M16-S15-008 | text | visible-default | "🎯 TEMBAK JAWAPAN" | FN-M16-6.4.1 |
| EL-M16-S15-009 | text | visible-default | "2" | FN-M16-6.4.1 |
| EL-M16-S15-010 | text | visible-default | "Tap jawapan yang betul sebelum jatuh!" | FN-M16-6.4.1 |
| EL-M16-S15-011 | text | hidden-only | "Skor" | FN-M16-6.4.2 |
| EL-M16-S15-012 | text | hidden-only | "Level" | FN-M16-6.4.2 |
| EL-M16-S15-013 | text | hidden-only | "❤️" | FN-M16-6.4.2 |
| EL-M16-S15-014 | text | hidden-only | "🪙" | FN-M16-6.4.2 |
| EL-M16-S15-015 | text | hidden-only | "Soalan" | FN-M16-6.4.2 |
| EL-M16-S15-016 | text | hidden-only | "⚠ GARIS MAUT" | FN-M16-6.4.2 |
| EL-M16-S15-017 | clickable | hidden-only | clickable | FN-M16-6.4.2 |
| EL-M16-S15-018 | alert | hidden-only | "⚡ LEVEL !" | FN-M16-6.4.2 |
| EL-M16-S15-019 | modal | hidden-only | modal | FN-M16-6.4.4 |
| EL-M16-S15-020 | card | hidden-only | card | FN-M16-6.4.4 |
| EL-M16-S15-021 | heading | hidden-only | heading | FN-M16-6.4.4 |
| EL-M16-S15-022 | text | hidden-only | "Tembak Jawapan — Level" | FN-M16-6.4.4 |
| EL-M16-S15-023 | text | hidden-only | "Skor Total" | FN-M16-6.4.4 |
| EL-M16-S15-024 | text | hidden-only | "Ketepatan" | FN-M16-6.4.4 |
| EL-M16-S15-025 | text | hidden-only | "Tertinggi" | FN-M16-6.4.4 |
| EL-M16-S15-026 | text | hidden-only | "Syiling" | FN-M16-6.4.4 |
| EL-M16-S15-027 | link | hidden-only | "🔄 Main Lagi", → /permainan/tembak-jawapan | FN-M16-6.4.4 |
| EL-M16-S15-028 | link | hidden-only | "🎮 Hub", → /permainan | FN-M16-6.4.4 |
| EL-M16-S15-029 | text | conditional | "Skor" | FN-M16-6.4.2 |
| EL-M16-S15-030 | text | conditional | "0" | FN-M16-6.4.2 |
| EL-M16-S15-031 | text | conditional | "Level" | FN-M16-6.4.2 |
| EL-M16-S15-032 | text | conditional | "1" | FN-M16-6.4.2 |
| EL-M16-S15-033 | text | hidden-only | "❤️" | FN-M16-6.4.2 |
| EL-M16-S15-034 | text | conditional | "❤️" | FN-M16-6.4.2 |
| EL-M16-S15-035 | text | conditional | "❤️" | FN-M16-6.4.2 |
| EL-M16-S15-036 | text | conditional | "❤️" | FN-M16-6.4.2 |
| EL-M16-S15-037 | text | conditional | "🪙" | FN-M16-6.4.2 |
| EL-M16-S15-038 | text | conditional | "0" | FN-M16-6.4.2 |
| EL-M16-S15-039 | text | conditional | "Soalan" | FN-M16-6.4.2 |
| EL-M16-S15-040 | text | conditional | "1" | FN-M16-6.4.2 |
| EL-M16-S15-041 | text | conditional | "Jika murid mengulang kaji fakta "tanda baca perlu digunakan mengikut jenis ayat" …" | FN-M16-6.4.2 |
| EL-M16-S15-042 | text | conditional | "⚠ GARIS MAUT" | FN-M16-6.4.2 |
| EL-M16-S15-043 | clickable | hidden-only | clickable | FN-M16-6.4.2 |
| EL-M16-S15-044 | clickable | conditional | "membaca tanpa memahami maksud teks" | FN-M16-6.4.2 |
| EL-M16-S15-045 | clickable | conditional | "menulis secara rawak tanpa melihat huruf" | FN-M16-6.4.2 |
| EL-M16-S15-046 | clickable | conditional | "mengabaikan bentuk huruf dan ejaan" | FN-M16-6.4.2 |
| EL-M16-S15-047 | clickable | conditional | "mengikut jenis ayat" | FN-M16-6.4.2 |
| EL-M16-S15-048 | alert | hidden-only | "⚡ LEVEL !" | FN-M16-6.4.2 |
| EL-M16-S15-049 | modal | conditional | "Hebat!" | FN-M16-6.4.4 |
| EL-M16-S15-050 | card | conditional | "Hebat!" | FN-M16-6.4.4 |
| EL-M16-S15-051 | text | conditional | "🎯" | FN-M16-6.4.4 |
| EL-M16-S15-052 | heading | conditional | "Hebat!" | FN-M16-6.4.4 |
| EL-M16-S15-053 | text | conditional | "Tembak Jawapan — Level" | FN-M16-6.4.4 |
| EL-M16-S15-054 | text | conditional | "1" | FN-M16-6.4.4 |
| EL-M16-S15-055 | text | conditional | "0" | FN-M16-6.4.4 |
| EL-M16-S15-056 | text | conditional | "Skor Total" | FN-M16-6.4.4 |
| EL-M16-S15-057 | text | conditional | "0/0" | FN-M16-6.4.4 |
| EL-M16-S15-058 | text | conditional | "Ketepatan" | FN-M16-6.4.4 |
| EL-M16-S15-059 | text | conditional | "Level 1" | FN-M16-6.4.4 |
| EL-M16-S15-060 | text | conditional | "Tertinggi" | FN-M16-6.4.4 |
| EL-M16-S15-061 | text | conditional | "0 🪙" | FN-M16-6.4.4 |
| EL-M16-S15-062 | text | conditional | "Syiling" | FN-M16-6.4.4 |
| EL-M16-S15-063 | link | conditional | "🔄 Main Lagi", → /permainan/tembak-jawapan | FN-M16-6.4.4 |
| EL-M16-S15-064 | link | conditional | "🎮 Hub", → /permainan | FN-M16-6.4.4 |
| EL-M16-S15-065 | alert | conditional | "⚡ LEVEL 2!" | FN-M16-6.4.2 |
| EL-M16-S15-066 | text | conditional | "🎯" | FN-M16-6.1.1 |
| EL-M16-S15-067 | heading | conditional | "Tembak Jawapan" | FN-M16-6.1.1 |
| EL-M16-S15-068 | text | conditional | "Pilih darjah / tingkatan kamu:" | FN-M16-6.1.1 |
| EL-M16-S15-069 | text | conditional | "🏫 Sekolah Rendah" | FN-M16-6.1.1 |
| EL-M16-S15-070 | link | conditional | "Darjah 1", → /permainan/tembak-jawapan?darjah=1 | FN-M16-6.1.1 |
| EL-M16-S15-071 | link | conditional | "Darjah 2", → /permainan/tembak-jawapan?darjah=2 | FN-M16-6.1.1 |
| EL-M16-S15-072 | link | conditional | "Darjah 3", → /permainan/tembak-jawapan?darjah=3 | FN-M16-6.1.1 |
| EL-M16-S15-073 | link | conditional | "Darjah 4", → /permainan/tembak-jawapan?darjah=4 | FN-M16-6.1.1 |
| EL-M16-S15-074 | link | conditional | "← Kembali ke Hub", → /permainan | FN-M16-6.1.1 |

#### S16 — `/permainan/susun-jawapan` (87 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M16-S16-001 | text | hidden-only | "LIVE:", fa-circle | FN-M16-1.3.1 |
| EL-M16-S16-002 | text | hidden-only | "MAIN" | FN-M16-1.3.1 |
| EL-M16-S16-003 | text | hidden-only | "DAFTAR" | FN-M16-1.3.1 |
| EL-M16-S16-004 | link | visible-default | "Kembali", → /permainan, fa-arrow-left | FN-M16-6.5.1 |
| EL-M16-S16-005 | badge | visible-default | "Skor 0" | FN-M16-6.5.1 |
| EL-M16-S16-006 | badge | visible-default | "🪙 0" | FN-M16-6.5.1 |
| EL-M16-S16-007 | heading | visible-default | "🧩 Susun Jawapan" | FN-M16-6.5.1 |
| EL-M16-S16-008 | text | hidden-only | "Soalan daripada" | FN-M16-6.5.2 |
| EL-M16-S16-009 | text | hidden-only | "📥 Jawapan Kamu:" | FN-M16-6.5.2 |
| EL-M16-S16-010 | clickable | hidden-only | clickable | FN-M16-6.5.2 |
| EL-M16-S16-011 | clickable | hidden-only | clickable | FN-M16-6.5.2 |
| EL-M16-S16-012 | text | hidden-only | "Klik huruf/perkataan di bawah untuk susun" | FN-M16-6.5.2 |
| EL-M16-S16-013 | text | hidden-only | "🔤 Pilihan:" | FN-M16-6.5.2 |
| EL-M16-S16-014 | clickable | hidden-only | clickable | FN-M16-6.5.2 |
| EL-M16-S16-015 | button | hidden-only | "✅ Semak Jawapan", type=submit | FN-M16-6.5.3 |
| EL-M16-S16-016 | text | hidden-only | "🎉 BETUL! + mata" | FN-M16-6.5.3 |
| EL-M16-S16-017 | button | hidden-only | "Seterusnya →", type=submit | FN-M16-6.5.3 |
| EL-M16-S16-018 | text | hidden-only | "❌ Cuba lagi atau langkau" | FN-M16-6.5.3 |
| EL-M16-S16-019 | button | hidden-only | "🔄 Cuba Lagi", type=submit | FN-M16-6.5.3 |
| EL-M16-S16-020 | button | hidden-only | "⏭️ Langkau", type=submit | FN-M16-6.5.3 |
| EL-M16-S16-021 | button | hidden-only | "⏭️ Langkau Soalan Ini", type=submit | FN-M16-6.5.3 |
| EL-M16-S16-022 | text | visible-default | "Soalan daripada" | FN-M16-6.5.2 |
| EL-M16-S16-023 | text | visible-default | "1" | FN-M16-6.5.2 |
| EL-M16-S16-024 | text | visible-default | "20" | FN-M16-6.5.2 |
| EL-M16-S16-025 | text | visible-default | "Pilih perkataan berimbuhan yang betul bagi kata dasar 'sapu'." | FN-M16-6.5.2 |
| EL-M16-S16-026 | text | visible-default | "📥 Jawapan Kamu:" | FN-M16-6.5.2 |
| EL-M16-S16-027 | clickable | visible-default | "y" | FN-M16-6.5.2 |
| EL-M16-S16-028 | clickable | hidden-only | clickable | FN-M16-6.5.2 |
| EL-M16-S16-029 | clickable | visible-default | "y" | FN-M16-6.5.2 |
| EL-M16-S16-030 | text | hidden-only | "Klik huruf/perkataan di bawah untuk susun" | FN-M16-6.5.2 |
| EL-M16-S16-031 | text | visible-default | "🔤 Pilihan:" | FN-M16-6.5.2 |
| EL-M16-S16-032 | clickable | hidden-only | clickable | FN-M16-6.5.2 |
| EL-M16-S16-033 | clickable | conditional | "hand" | FN-M16-6.5.2 |
| EL-M16-S16-034 | clickable | visible-default | "e" | FN-M16-6.5.2 |
| EL-M16-S16-035 | clickable | visible-default | "n" | FN-M16-6.5.2 |
| EL-M16-S16-036 | clickable | visible-default | "a" | FN-M16-6.5.2 |
| EL-M16-S16-037 | clickable | visible-default | "p" | FN-M16-6.5.2 |
| EL-M16-S16-038 | clickable | visible-default | "u" | FN-M16-6.5.2 |
| EL-M16-S16-039 | clickable | visible-default | "m" | FN-M16-6.5.2 |
| EL-M16-S16-040 | button | visible-default | "✅ Semak Jawapan", type=submit | FN-M16-6.5.3 |
| EL-M16-S16-041 | text | hidden-only | "🎉 BETUL! + mata" | FN-M16-6.5.3 |
| EL-M16-S16-042 | button | hidden-only | "Seterusnya →", type=submit | FN-M16-6.5.3 |
| EL-M16-S16-043 | text | visible-default | "🎉 BETUL! + mata" | FN-M16-6.5.3 |
| EL-M16-S16-044 | text | visible-default | "14" | FN-M16-6.5.3 |
| EL-M16-S16-045 | button | visible-default | "Seterusnya →", type=submit | FN-M16-6.5.3 |
| EL-M16-S16-046 | text | hidden-only | "❌ Cuba lagi atau langkau" | FN-M16-6.5.3 |
| EL-M16-S16-047 | button | hidden-only | "🔄 Cuba Lagi", type=submit | FN-M16-6.5.3 |
| EL-M16-S16-048 | button | hidden-only | "⏭️ Langkau", type=submit | FN-M16-6.5.3 |
| EL-M16-S16-049 | button | hidden-only | "⏭️ Langkau Soalan Ini", type=submit | FN-M16-6.5.3 |
| EL-M16-S16-050 | modal | hidden-only | modal | FN-M16-6.5.5 |
| EL-M16-S16-051 | card | hidden-only | card | FN-M16-6.5.5 |
| EL-M16-S16-052 | heading | hidden-only | heading | FN-M16-6.5.5 |
| EL-M16-S16-053 | text | hidden-only | "Susun Jawapan selesai!" | FN-M16-6.5.5 |
| EL-M16-S16-054 | text | hidden-only | "Skor Total" | FN-M16-6.5.5 |
| EL-M16-S16-055 | text | hidden-only | "Selesai" | FN-M16-6.5.5 |
| EL-M16-S16-056 | text | hidden-only | "Syiling Diperolehi" | FN-M16-6.5.5 |
| EL-M16-S16-057 | link | hidden-only | "🔄 Main Lagi", → /permainan/susun-jawapan | FN-M16-6.5.5 |
| EL-M16-S16-058 | link | hidden-only | "🎮 Hub", → /permainan | FN-M16-6.5.5 |
| EL-M16-S16-059 | modal | conditional | "BIJAK!" | FN-M16-6.5.5 |
| EL-M16-S16-060 | card | conditional | "BIJAK!" | FN-M16-6.5.5 |
| EL-M16-S16-061 | text | conditional | "🧩" | FN-M16-6.5.5 |
| EL-M16-S16-062 | heading | conditional | "BIJAK!" | FN-M16-6.5.5 |
| EL-M16-S16-063 | text | conditional | "Susun Jawapan selesai!" | FN-M16-6.5.5 |
| EL-M16-S16-064 | text | conditional | "0" | FN-M16-6.5.5 |
| EL-M16-S16-065 | text | conditional | "Skor Total" | FN-M16-6.5.5 |
| EL-M16-S16-066 | text | conditional | "0/20" | FN-M16-6.5.5 |
| EL-M16-S16-067 | text | conditional | "Selesai" | FN-M16-6.5.5 |
| EL-M16-S16-068 | text | conditional | "0 🪙" | FN-M16-6.5.5 |
| EL-M16-S16-069 | text | conditional | "Syiling Diperolehi" | FN-M16-6.5.5 |
| EL-M16-S16-070 | link | conditional | "🔄 Main Lagi", → /permainan/susun-jawapan | FN-M16-6.5.5 |
| EL-M16-S16-071 | link | conditional | "🎮 Hub", → /permainan | FN-M16-6.5.5 |
| EL-M16-S16-072 | text | conditional | "🧩" | FN-M16-6.1.1 |
| EL-M16-S16-073 | heading | conditional | "Susun Jawapan" | FN-M16-6.1.1 |
| EL-M16-S16-074 | text | conditional | "Pilih darjah / tingkatan kamu:" | FN-M16-6.1.1 |
| EL-M16-S16-075 | text | conditional | "🏫 Sekolah Rendah" | FN-M16-6.1.1 |
| EL-M16-S16-076 | link | conditional | "Darjah 1", → /permainan/susun-jawapan?darjah=1 | FN-M16-6.1.1 |
| EL-M16-S16-077 | link | conditional | "Darjah 2", → /permainan/susun-jawapan?darjah=2 | FN-M16-6.1.1 |
| EL-M16-S16-078 | link | conditional | "Darjah 3", → /permainan/susun-jawapan?darjah=3 | FN-M16-6.1.1 |
| EL-M16-S16-079 | link | conditional | "Darjah 4", → /permainan/susun-jawapan?darjah=4 | FN-M16-6.1.1 |
| EL-M16-S16-080 | link | conditional | "← Kembali ke Hub", → /permainan | FN-M16-6.1.1 |
| EL-M16-S16-081 | clickable | conditional | "Klik huruf/perkataan di bawah untuk susun" | FN-M16-6.5.2 |
| EL-M16-S16-082 | button | conditional | "⏭️ Langkau Soalan Ini", type=submit | FN-M16-6.5.3 |
| EL-M16-S16-083 | clickable | conditional | "menjejaskan" | FN-M16-6.5.2 |
| EL-M16-S16-084 | clickable | conditional | "ayat" | FN-M16-6.5.2 |
| EL-M16-S16-085 | text | conditional | "❌ Cuba lagi atau langkau" | FN-M16-6.5.3 |
| EL-M16-S16-086 | button | conditional | "🔄 Cuba Lagi", type=submit | FN-M16-6.5.3 |
| EL-M16-S16-087 | button | conditional | "⏭️ Langkau", type=submit | FN-M16-6.5.3 |

#### S17 — `/permainan/kad-memori` (100 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M16-S17-001 | text | hidden-only | "LIVE:", fa-circle | FN-M16-1.3.1 |
| EL-M16-S17-002 | text | hidden-only | "MAIN" | FN-M16-1.3.1 |
| EL-M16-S17-003 | text | hidden-only | "DAFTAR" | FN-M16-1.3.1 |
| EL-M16-S17-004 | link | visible-default | "Permainan", → /permainan, fa-arrow-left | FN-M16-6.6.1 |
| EL-M16-S17-005 | heading | visible-default | "🃏 Kad Memori" | FN-M16-6.6.1 |
| EL-M16-S17-006 | text | visible-default | "Padankan soalan dengan jawapan yang betul!" | FN-M16-6.6.1 |
| EL-M16-S17-007 | text | visible-default | "⏱️" | FN-M16-6.6.1 |
| EL-M16-S17-008 | text | visible-default | "0:04" | FN-M16-6.6.1 |
| EL-M16-S17-009 | text | visible-default | "langkah" | FN-M16-6.6.1 |
| EL-M16-S17-010 | text | visible-default | "👆" | FN-M16-6.6.1 |
| EL-M16-S17-011 | text | visible-default | "0" | FN-M16-6.6.1 |
| EL-M16-S17-012 | text | visible-default | "/ padan" | FN-M16-6.6.1 |
| EL-M16-S17-013 | text | visible-default | "✅" | FN-M16-6.6.1 |
| EL-M16-S17-014 | text | visible-default | "0" | FN-M16-6.6.1 |
| EL-M16-S17-015 | text | visible-default | "6" | FN-M16-6.6.1 |
| EL-M16-S17-016 | clickable | hidden-only | "❓" | FN-M16-6.6.2 |
| EL-M16-S17-017 | clickable | visible-default | "❓ Untuk melihat dan mengenal persekitaran" | FN-M16-6.6.2 |
| EL-M16-S17-018 | clickable | visible-default | "❓ Membuat rangka karangan" | FN-M16-6.6.2 |
| EL-M16-S17-019 | clickable | visible-default | "❓ Apakah langkah pertama yang perlu dilakukan sebelum menulis karangan?" | FN-M16-6.6.2 |
| EL-M16-S17-020 | clickable | visible-default | "❓ Ejaan yang manakah tepat untuk perkataan 'pemadam'?" | FN-M16-6.6.2 |
| EL-M16-S17-021 | clickable | visible-default | "❓ Apakah tugas utama mata pada manusia?" | FN-M16-6.6.2 |
| EL-M16-S17-022 | clickable | visible-default | "❓ Bentuk 2D manakah yang mempunyai 3 sisi?" | FN-M16-6.6.2 |
| EL-M16-S17-023 | clickable | visible-default | "❓ Aina mempunyai 11 kotak. Setiap kotak berisi 438 biji gula-gula. Kemudian, dia …" | FN-M16-6.6.2 |
| EL-M16-S17-024 | clickable | visible-default | "❓ pemadam" | FN-M16-6.6.2 |
| EL-M16-S17-025 | clickable | visible-default | "❓ Berapa panjang harakat bacaan untuk Mad Asli?" | FN-M16-6.6.2 |
| EL-M16-S17-026 | clickable | visible-default | "❓ 8268" | FN-M16-6.6.2 |
| EL-M16-S17-027 | clickable | visible-default | "❓ segi tiga" | FN-M16-6.6.2 |
| EL-M16-S17-028 | clickable | visible-default | "❓ 2 harakat" | FN-M16-6.6.2 |
| EL-M16-S17-029 | modal | hidden-only | "Tahniah!" | FN-M16-6.6.4 |
| EL-M16-S17-030 | card | hidden-only | "Tahniah!" | FN-M16-6.6.4 |
| EL-M16-S17-031 | text | hidden-only | "🎉" | FN-M16-6.6.4 |
| EL-M16-S17-032 | heading | hidden-only | "Tahniah!" | FN-M16-6.6.4 |
| EL-M16-S17-033 | text | hidden-only | "Semua kad berjaya dipadankan!" | FN-M16-6.6.4 |
| EL-M16-S17-034 | text | hidden-only | "Masa" | FN-M16-6.6.4 |
| EL-M16-S17-035 | text | hidden-only | "Langkah" | FN-M16-6.6.4 |
| EL-M16-S17-036 | text | hidden-only | "Ketepatan" | FN-M16-6.6.4 |
| EL-M16-S17-037 | text | hidden-only | "Syiling 🪙" | FN-M16-6.6.4 |
| EL-M16-S17-038 | link | hidden-only | "🔄 Main Lagi", → /permainan/kad-memori | FN-M16-6.6.4 |
| EL-M16-S17-039 | link | hidden-only | "🏠 Hub", → /permainan | FN-M16-6.6.4 |
| EL-M16-S17-040 | clickable | conditional | "❓ Neptun" | FN-M16-6.6.2 |
| EL-M16-S17-041 | clickable | conditional | "❓ Dalam konteks pembelajaran lanjutan, yang manakah kata kerja dalam konteks kat …" | FN-M16-6.6.2 |
| EL-M16-S17-042 | clickable | conditional | "❓ ا" | FN-M16-6.6.2 |
| EL-M16-S17-043 | clickable | conditional | "❓ Planet manakah paling jauh dari Matahari dalam konteks sistem suria set 8?" | FN-M16-6.6.2 |
| EL-M16-S17-044 | clickable | conditional | "❓ Dalam kad imbasan kelas, Guru menyebut ثَلَاثَةٌ di dalam kelas. Murid perlu m …" | FN-M16-6.6.2 |
| EL-M16-S17-045 | clickable | conditional | "❓ tiga" | FN-M16-6.6.2 |
| EL-M16-S17-046 | clickable | conditional | "❓ went" | FN-M16-6.6.2 |
| EL-M16-S17-047 | clickable | conditional | "❓ menyediakan sumber kehidupan kepada manusia" | FN-M16-6.6.2 |
| EL-M16-S17-048 | clickable | conditional | "❓ Finish the sentence: Nadia ____ to the bookstore yesterday." | FN-M16-6.6.2 |
| EL-M16-S17-049 | clickable | conditional | "❓ Apakah konsep tepat dalam Jawi D1 bagi fakta berikut: huruf alif ditulis sebag …" | FN-M16-6.6.2 |
| EL-M16-S17-050 | clickable | conditional | "❓ Alam sekitar perlu dijaga kerana ..." | FN-M16-6.6.2 |
| EL-M16-S17-051 | clickable | conditional | "❓ menulis" | FN-M16-6.6.2 |
| EL-M16-S17-052 | modal | conditional | "Tahniah!" | FN-M16-6.6.4 |
| EL-M16-S17-053 | card | conditional | "Tahniah!" | FN-M16-6.6.4 |
| EL-M16-S17-054 | text | conditional | "🎉" | FN-M16-6.6.4 |
| EL-M16-S17-055 | heading | conditional | "Tahniah!" | FN-M16-6.6.4 |
| EL-M16-S17-056 | text | conditional | "Semua kad berjaya dipadankan!" | FN-M16-6.6.4 |
| EL-M16-S17-057 | text | conditional | "0:04" | FN-M16-6.6.4 |
| EL-M16-S17-058 | text | conditional | "Masa" | FN-M16-6.6.4 |
| EL-M16-S17-059 | text | conditional | "0" | FN-M16-6.6.4 |
| EL-M16-S17-060 | text | conditional | "Langkah" | FN-M16-6.6.4 |
| EL-M16-S17-061 | text | conditional | "0%" | FN-M16-6.6.4 |
| EL-M16-S17-062 | text | conditional | "Ketepatan" | FN-M16-6.6.4 |
| EL-M16-S17-063 | text | conditional | "+0" | FN-M16-6.6.4 |
| EL-M16-S17-064 | text | conditional | "Syiling 🪙" | FN-M16-6.6.4 |
| EL-M16-S17-065 | link | conditional | "🔄 Main Lagi", → /permainan/kad-memori | FN-M16-6.6.4 |
| EL-M16-S17-066 | link | conditional | "🏠 Hub", → /permainan | FN-M16-6.6.4 |
| EL-M16-S17-067 | clickable | conditional | "❓ menyemak ejaan Jawi sebelum hantar" | FN-M16-6.6.2 |
| EL-M16-S17-068 | clickable | conditional | "❓ Aina menulis buku di perpustakaan." | FN-M16-6.6.2 |
| EL-M16-S17-069 | clickable | conditional | "❓ Lengkapkan ayat: Saya bermain bola ____." | FN-M16-6.6.2 |
| EL-M16-S17-070 | clickable | conditional | "❓ Apakah tindakan yang perlu dilakukan setelah menulis dalam tulisan Jawi?" | FN-M16-6.6.2 |
| EL-M16-S17-071 | clickable | conditional | "❓ Ayat yang betul daripada perkataan 'perpustakaan menulis di buku Aina' ialah?" | FN-M16-6.6.2 |
| EL-M16-S17-072 | clickable | conditional | "❓ di kantin" | FN-M16-6.6.2 |
| EL-M16-S17-073 | clickable | conditional | "❓ Hakim menyiapkan tugasan tanpa disuruh di rumah. Nilai apakah yang ditunjukkan …" | FN-M16-6.6.2 |
| EL-M16-S17-074 | clickable | conditional | "❓ Apakah pemahaman yang betul tentang "titik huruf perlu diletakkan dengan betul …" | FN-M16-6.6.2 |
| EL-M16-S17-075 | clickable | conditional | "❓ bertanggungjawab" | FN-M16-6.6.2 |
| EL-M16-S17-076 | clickable | conditional | "❓ titik huruf dengan betul" | FN-M16-6.6.2 |
| EL-M16-S17-077 | clickable | conditional | "❓ 17" | FN-M16-6.6.2 |
| EL-M16-S17-078 | clickable | conditional | "❓ 8 L + 9 L = ? (dalam L)" | FN-M16-6.6.2 |
| EL-M16-S17-079 | clickable | conditional | "❓ Silakan." | FN-M16-6.6.2 |
| EL-M16-S17-080 | clickable | conditional | "❓ Segi empat sama semua sisi sama panjang" | FN-M16-6.6.2 |
| EL-M16-S17-081 | clickable | conditional | "❓ Ali bertanya, 'Boleh saya masuk ke kelas?' Apakah jawapan yang paling sesuai u …" | FN-M16-6.6.2 |
| EL-M16-S17-082 | clickable | conditional | "❓ Sama-sama." | FN-M16-6.6.2 |
| EL-M16-S17-083 | clickable | conditional | "❓ Amir went to the science lab. It happened yesterday." | FN-M16-6.6.2 |
| EL-M16-S17-084 | clickable | conditional | "❓ Apa bezanya segi empat sama dengan segi empat tepat?" | FN-M16-6.6.2 |
| EL-M16-S17-085 | clickable | conditional | "❓ Apakah peranti yang paling sesuai untuk mengukur tempoh masa yang singkat sepe …" | FN-M16-6.6.2 |
| EL-M16-S17-086 | clickable | conditional | "❓ Jam randik" | FN-M16-6.6.2 |
| EL-M16-S17-087 | clickable | conditional | "❓ Siti berkata, "Terima kasih atas bantuan awak." Apakah jawapan yang paling ses …" | FN-M16-6.6.2 |
| EL-M16-S17-088 | clickable | conditional | "❓ rajin" | FN-M16-6.6.2 |
| EL-M16-S17-089 | clickable | conditional | "❓ Dalam tugasan pengukuhan, baca rangkap sajak: Rajin belajar setiap hari, Ilmu  …" | FN-M16-6.6.2 |
| EL-M16-S17-090 | clickable | conditional | "❓ Hakim was at the computer room the day before. Choose the right word." | FN-M16-6.6.2 |
| EL-M16-S17-091 | clickable | conditional | "❓ Pilih perkataan yang betul untuk melengkapkan frasa: baca ____" | FN-M16-6.6.2 |
| EL-M16-S17-092 | clickable | conditional | "❓ line up quietly" | FN-M16-6.6.2 |
| EL-M16-S17-093 | clickable | conditional | "❓ Namakan bentuk yang serupa dengan telur dan tiada sudut." | FN-M16-6.6.2 |
| EL-M16-S17-094 | clickable | conditional | "❓ prihatin" | FN-M16-6.6.2 |
| EL-M16-S17-095 | clickable | conditional | "❓ Teacher says, "Line Up Quietly." What should you do for this communication tas …" | FN-M16-6.6.2 |
| EL-M16-S17-096 | clickable | conditional | "❓ Atur huruf 'nroe' supaya menjadi perkataan yang bermakna." | FN-M16-6.6.2 |
| EL-M16-S17-097 | clickable | conditional | "❓ oren" | FN-M16-6.6.2 |
| EL-M16-S17-098 | clickable | conditional | "❓ Di rumah, Danish mengasingkan sisa kitar semula. Apakah nilai yang diamalkan o …" | FN-M16-6.6.2 |
| EL-M16-S17-099 | clickable | conditional | "❓ buku" | FN-M16-6.6.2 |
| EL-M16-S17-100 | clickable | conditional | "❓ Bujur" | FN-M16-6.6.2 |

#### S18 — `/permainan/roda-nasib` (25 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M16-S18-001 | text | hidden-only | "LIVE:", fa-circle | FN-M16-1.3.1 |
| EL-M16-S18-002 | text | hidden-only | "MAIN" | FN-M16-1.3.1 |
| EL-M16-S18-003 | text | hidden-only | "DAFTAR" | FN-M16-1.3.1 |
| EL-M16-S18-004 | link | visible-default | "Permainan", → /permainan, fa-arrow-left | FN-M16-7.1.1 |
| EL-M16-S18-005 | heading | visible-default | "🎯 Roda Nasib" | FN-M16-7.1.1 |
| EL-M16-S18-006 | text | visible-default | "Pusing roda sekali sehari untuk hadiah misteri!" | FN-M16-7.1.1 |
| EL-M16-S18-007 | text | visible-default | "🎰 2 kali spin" | FN-M16-7.1.1 |
| EL-M16-S18-008 | text | visible-default | "🪙 0 Syiling dimenangkan" | FN-M16-7.1.1 |
| EL-M16-S18-009 | text | visible-default | "🎯" | FN-M16-7.1.2 |
| EL-M16-S18-010 | button | visible-default | "🎯 SPIN!", type=submit | FN-M16-7.1.2 |
| EL-M16-S18-011 | card | hidden-only | card | FN-M16-7.1.4 |
| EL-M16-S18-012 | heading | hidden-only | heading | FN-M16-7.1.4 |
| EL-M16-S18-013 | text | hidden-only | "Ditambah ke akaun kamu!" | FN-M16-7.1.4 |
| EL-M16-S18-014 | text | hidden-only | "Jangan risau, cuba lagi esok!" | FN-M16-7.1.4 |
| EL-M16-S18-015 | button | hidden-only | "Tutup", type=submit | FN-M16-7.1.4 |
| EL-M16-S18-016 | card | conditional | "Cuba Lagi" | FN-M16-7.1.4 |
| EL-M16-S18-017 | text | conditional | "😅" | FN-M16-7.1.4 |
| EL-M16-S18-018 | heading | conditional | "Cuba Lagi" | FN-M16-7.1.4 |
| EL-M16-S18-019 | text | hidden-only | "Ditambah ke akaun kamu!" | FN-M16-7.1.4 |
| EL-M16-S18-020 | text | hidden-only | "Jangan risau, cuba lagi esok!" | FN-M16-7.1.4 |
| EL-M16-S18-021 | text | conditional | "Jangan risau, cuba lagi esok!" | FN-M16-7.1.4 |
| EL-M16-S18-022 | button | conditional | "Tutup", type=submit | FN-M16-7.1.4 |
| EL-M16-S18-023 | card | conditional | "5 Syiling" | FN-M16-7.1.4 |
| EL-M16-S18-024 | text | conditional | "+5 Syiling" | FN-M16-7.1.4 |
| EL-M16-S18-025 | text | conditional | "Ditambah ke akaun kamu!" | FN-M16-7.1.4 |

#### S19 — `/permainan/jutawan` (34 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M16-S19-001 | text | hidden-only | "LIVE:", fa-circle | FN-M16-1.3.1 |
| EL-M16-S19-002 | text | hidden-only | "MAIN" | FN-M16-1.3.1 |
| EL-M16-S19-003 | text | hidden-only | "DAFTAR" | FN-M16-1.3.1 |
| EL-M16-S19-004 | text | visible-default | "💰" | FN-M16-6.1.1 |
| EL-M16-S19-005 | heading | visible-default | "Jutawan Ilmu" | FN-M16-6.1.1 |
| EL-M16-S19-006 | text | visible-default | "Pilih darjah / tingkatan kamu:" | FN-M16-6.1.1 |
| EL-M16-S19-007 | text | visible-default | "🏫 Sekolah Rendah" | FN-M16-6.1.1 |
| EL-M16-S19-008 | link | visible-default | "Darjah 1", → /permainan/jutawan?darjah=1 | FN-M16-6.1.1 |
| EL-M16-S19-009 | link | visible-default | "Darjah 2", → /permainan/jutawan?darjah=2 | FN-M16-6.1.1 |
| EL-M16-S19-010 | link | visible-default | "Darjah 3", → /permainan/jutawan?darjah=3 | FN-M16-6.1.1 |
| EL-M16-S19-011 | link | visible-default | "Darjah 4", → /permainan/jutawan?darjah=4 | FN-M16-6.1.1 |
| EL-M16-S19-012 | link | visible-default | "← Kembali ke Hub", → /permainan | FN-M16-6.1.1 |
| EL-M16-S19-013 | link | visible-default | "Permainan", → /permainan, fa-arrow-left | FN-M16-7.2.1 |
| EL-M16-S19-014 | heading | visible-default | "💰 Jutawan Ilmu" | FN-M16-7.2.1 |
| EL-M16-S19-015 | text | visible-default | "Pilih subjek, jawab 15 soalan — menang sampai 1,000 Syiling!" | FN-M16-7.2.1 |
| EL-M16-S19-016 | text | visible-default | "L0" | FN-M16-7.2.1 |
| EL-M16-S19-017 | text | visible-default | "Rekod Tertinggi" | FN-M16-7.2.1 |
| EL-M16-S19-018 | text | visible-default | "0" | FN-M16-7.2.1 |
| EL-M16-S19-019 | text | visible-default | "Permainan" | FN-M16-7.2.1 |
| EL-M16-S19-020 | text | visible-default | "1,000🪙" | FN-M16-7.2.1 |
| EL-M16-S19-021 | text | visible-default | "Hadiah Utama" | FN-M16-7.2.1 |
| EL-M16-S19-022 | text | visible-default | "👆" | FN-M16-7.2.1 |
| EL-M16-S19-023 | text | visible-default | "Pilih darjah atau tingkatan di atas untuk mula." | FN-M16-7.2.1 |
| EL-M16-S19-024 | text | conditional | "📚 PILIH SUBJEK (DARJAH 4)" | FN-M16-7.2.2 |
| EL-M16-S19-025 | link | conditional | "📝 Bahasa Melayu 579 soalan", → /permainan/jutawan/main?subject=1&darjah=4, fa-chevron-right | FN-M16-7.2.2 |
| EL-M16-S19-026 | link | conditional | "🇬🇧 Bahasa Inggeris 563 soalan", → /permainan/jutawan/main?subject=2&darjah=4, fa-chevron-right | FN-M16-7.2.2 |
| EL-M16-S19-027 | link | conditional | "🔢 Matematik 1077 soalan", → /permainan/jutawan/main?subject=3&darjah=4, fa-chevron-right | FN-M16-7.2.2 |
| EL-M16-S19-028 | link | conditional | "🔬 Sains 616 soalan", → /permainan/jutawan/main?subject=4&darjah=4, fa-chevron-right | FN-M16-7.2.2 |
| EL-M16-S19-029 | link | conditional | "📜 Sejarah 660 soalan", → /permainan/jutawan/main?subject=5&darjah=4, fa-chevron-right | FN-M16-7.2.2 |
| EL-M16-S19-030 | link | conditional | "☪️ Pendidikan Islam 369 soalan", → /permainan/jutawan/main?subject=6&darjah=4, fa-chevron-right | FN-M16-7.2.2 |
| EL-M16-S19-031 | link | conditional | "💛 Pendidikan Moral 312 soalan", → /permainan/jutawan/main?subject=7&darjah=4, fa-chevron-right | FN-M16-7.2.2 |
| EL-M16-S19-032 | link | conditional | "🌍 Geografi 200 soalan", → /permainan/jutawan/main?subject=12&darjah=4, fa-chevron-right | FN-M16-7.2.2 |
| EL-M16-S19-033 | link | conditional | "🕌 Bahasa Arab 500 soalan", → /permainan/jutawan/main?subject=18&darjah=4, fa-chevron-right | FN-M16-7.2.2 |
| EL-M16-S19-034 | link | conditional | "📖 Jawi 400 soalan", → /permainan/jutawan/main?subject=26&darjah=4, fa-chevron-right | FN-M16-7.2.2 |

#### S20 — `/permainan/pertandingan` (59 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M16-S20-001 | text | hidden-only | "LIVE:", fa-circle | FN-M16-1.3.1 |
| EL-M16-S20-002 | text | hidden-only | "MAIN" | FN-M16-1.3.1 |
| EL-M16-S20-003 | text | hidden-only | "DAFTAR" | FN-M16-1.3.1 |
| EL-M16-S20-004 | link | visible-default | "Permainan", → /permainan, fa-arrow-left | FN-M16-7.3.1 |
| EL-M16-S20-005 | heading | visible-default | "🏆 Pertandingan Mingguan" | FN-M16-7.3.1 |
| EL-M16-S20-006 | text | visible-default | "Lumba dengan semua pelajar! Top 3 dapat Syiling bonus." | FN-M16-7.3.1 |
| EL-M16-S20-007 | card | visible-default | "📅 Minggu Ini" | FN-M16-7.3.1 |
| EL-M16-S20-008 | text | visible-default | "📅 Minggu Ini" | FN-M16-7.3.1 |
| EL-M16-S20-009 | text | visible-default | "21 Sep — 27 Sep 2026" | FN-M16-7.3.1 |
| EL-M16-S20-010 | text | visible-default | "⏳ Tamat dalam" | FN-M16-7.3.1 |
| EL-M16-S20-011 | text | visible-default | "1h 19j 36m" | FN-M16-7.3.1 |
| EL-M16-S20-012 | card | visible-default | "Juara" | FN-M16-7.3.2 |
| EL-M16-S20-013 | text | visible-default | "🥇" | FN-M16-7.3.2 |
| EL-M16-S20-014 | text | visible-default | "Juara" | FN-M16-7.3.2 |
| EL-M16-S20-015 | text | visible-default | "+100 🪙" | FN-M16-7.3.2 |
| EL-M16-S20-016 | card | visible-default | "Naib Juara" | FN-M16-7.3.2 |
| EL-M16-S20-017 | text | visible-default | "🥈" | FN-M16-7.3.2 |
| EL-M16-S20-018 | text | visible-default | "Naib Juara" | FN-M16-7.3.2 |
| EL-M16-S20-019 | text | visible-default | "+50 🪙" | FN-M16-7.3.2 |
| EL-M16-S20-020 | card | visible-default | "Tempat Ketiga" | FN-M16-7.3.2 |
| EL-M16-S20-021 | text | visible-default | "🥉" | FN-M16-7.3.2 |
| EL-M16-S20-022 | text | visible-default | "Tempat Ketiga" | FN-M16-7.3.2 |
| EL-M16-S20-023 | text | visible-default | "+25 🪙" | FN-M16-7.3.2 |
| EL-M16-S20-024 | card | visible-default | "Belum mula lagi minggu ini!" | FN-M16-7.3.3 |
| EL-M16-S20-025 | text | visible-default | "📝" | FN-M16-7.3.3 |
| EL-M16-S20-026 | text | visible-default | "Belum mula lagi minggu ini!" | FN-M16-7.3.3 |
| EL-M16-S20-027 | text | visible-default | "Buat Latih Tubi untuk masuk ranking." | FN-M16-7.3.3 |
| EL-M16-S20-028 | link | visible-default | "Mula Latih Tubi", → /practice | FN-M16-7.3.3 |
| EL-M16-S20-029 | card | visible-default | "📊 Papan Ranking Mingguan" | FN-M16-7.3.4 |
| EL-M16-S20-030 | heading | visible-default | "📊 Papan Ranking Mingguan" | FN-M16-7.3.4 |
| EL-M16-S20-031 | text | visible-default | "🥇" | FN-M16-7.3.4 |
| EL-M16-S20-032 | text | visible-default | "<name>" | FN-M16-7.3.4 |
| EL-M16-S20-033 | text | visible-default | "23 sesi" | FN-M16-7.3.4 |
| EL-M16-S20-034 | text | visible-default | "450" | FN-M16-7.3.4 |
| EL-M16-S20-035 | text | visible-default | "betul" | FN-M16-7.3.4 |
| EL-M16-S20-036 | text | visible-default | "99.6%" | FN-M16-7.3.4 |
| EL-M16-S20-037 | text | visible-default | "tepat" | FN-M16-7.3.4 |
| EL-M16-S20-038 | text | visible-default | "🥈" | FN-M16-7.3.4 |
| EL-M16-S20-039 | text | visible-default | "<name>" | FN-M16-7.3.4 |
| EL-M16-S20-040 | text | visible-default | "22 sesi" | FN-M16-7.3.4 |
| EL-M16-S20-041 | text | visible-default | "401" | FN-M16-7.3.4 |
| EL-M16-S20-042 | text | visible-default | "betul" | FN-M16-7.3.4 |
| EL-M16-S20-043 | text | visible-default | "99.3%" | FN-M16-7.3.4 |
| EL-M16-S20-044 | text | visible-default | "tepat" | FN-M16-7.3.4 |
| EL-M16-S20-045 | text | visible-default | "🥉" | FN-M16-7.3.4 |
| EL-M16-S20-046 | text | visible-default | "<name>" | FN-M16-7.3.4 |
| EL-M16-S20-047 | text | visible-default | "15 sesi" | FN-M16-7.3.4 |
| EL-M16-S20-048 | text | visible-default | "187" | FN-M16-7.3.4 |
| EL-M16-S20-049 | text | visible-default | "betul" | FN-M16-7.3.4 |
| EL-M16-S20-050 | text | visible-default | "90.7%" | FN-M16-7.3.4 |
| EL-M16-S20-051 | text | visible-default | "tepat" | FN-M16-7.3.4 |
| EL-M16-S20-052 | text | visible-default | "4" | FN-M16-7.3.4 |
| EL-M16-S20-053 | text | visible-default | "<name>" | FN-M16-7.3.4 |
| EL-M16-S20-054 | text | visible-default | "11 sesi" | FN-M16-7.3.4 |
| EL-M16-S20-055 | text | visible-default | "145" | FN-M16-7.3.4 |
| EL-M16-S20-056 | text | visible-default | "betul" | FN-M16-7.3.4 |
| EL-M16-S20-057 | text | visible-default | "61.4%" | FN-M16-7.3.4 |
| EL-M16-S20-058 | text | visible-default | "tepat" | FN-M16-7.3.4 |
| EL-M16-S20-059 | text | conditional | "1h 19j 35m" | FN-M16-7.3.1 |

#### S21 — `/permainan/uji-minda` (16 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M16-S21-001 | text | hidden-only | "LIVE:", fa-circle | FN-M16-1.3.1 |
| EL-M16-S21-002 | text | hidden-only | "MAIN" | FN-M16-1.3.1 |
| EL-M16-S21-003 | text | hidden-only | "DAFTAR" | FN-M16-1.3.1 |
| EL-M16-S21-004 | link | visible-default | "Permainan", → /permainan, fa-arrow-left | FN-M16-7.4.1 |
| EL-M16-S21-005 | text | visible-default | "🧠" | FN-M16-7.4.1 |
| EL-M16-S21-006 | heading | visible-default | "Uji Minda" | FN-M16-7.4.1 |
| EL-M16-S21-007 | text | visible-default | "Cabaran khas dari ibu/bapa kamu! Tapi ibu/bapa kamu belum tetapkan cabaran lagi." | FN-M16-7.4.1 |
| EL-M16-S21-008 | card | visible-default | "Bagaimana nak mula?" | FN-M16-7.4.1 |
| EL-M16-S21-009 | text | visible-default | "Minta ibu atau bapa kamu log masuk ke PRESTASIPLUS, pergi ke di dashboard mereka …" | FN-M16-7.4.1 |
| EL-M16-S21-010 | text | visible-default | "Bagaimana nak mula?" | FN-M16-7.4.1 |
| EL-M16-S21-011 | text | visible-default | ""Cabaran Uji Minda"" | FN-M16-7.4.1 |
| EL-M16-S21-012 | text | visible-default | "📋 Apa Ibu/Bapa boleh tetap:" | FN-M16-7.4.1 |
| EL-M16-S21-013 | text | visible-default | "✅ Bilangan soalan setiap set" | FN-M16-7.4.1 |
| EL-M16-S21-014 | text | visible-default | "✅ Syiling per jawapan betul" | FN-M16-7.4.1 |
| EL-M16-S21-015 | text | visible-default | "✅ Hadiah custom (cth: buku, jajan, trip)" | FN-M16-7.4.1 |
| EL-M16-S21-016 | text | visible-default | "✅ Syiling minimum untuk claim hadiah" | FN-M16-7.4.1 |

#### S22 — `/permainan/sambung-kata` (9 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M16-S22-001 | heading | visible-default | "This page isn’t working" | FN-M16-7.5.1 |
| EL-M16-S22-002 | text | visible-default | "is currently unable to handle this request." | FN-M16-7.5.1 |
| EL-M16-S22-003 | text | visible-default | "prestasiplus.my" | FN-M16-7.5.1 |
| EL-M16-S22-004 | text | visible-default | "HTTP ERROR 500" | FN-M16-7.5.1 |
| EL-M16-S22-005 | button | visible-default | "Reload", type=submit | FN-M16-7.5.1 |
| EL-M16-S22-006 | text | hidden-only | "is currently unable to handle this request." | FN-M16-7.5.1 |
| EL-M16-S22-007 | text | hidden-only | "prestasiplus.my" | FN-M16-7.5.1 |
| EL-M16-S22-008 | image | hidden-only | image | FN-M16-7.5.1 |
| EL-M16-S22-009 | image | hidden-only | image | FN-M16-7.5.1 |

#### S23 — `/tournament` (7 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M16-S23-001 | text | hidden-only | "LIVE:", fa-circle | FN-M16-1.3.1 |
| EL-M16-S23-002 | text | hidden-only | "MAIN" | FN-M16-1.3.1 |
| EL-M16-S23-003 | text | hidden-only | "DAFTAR" | FN-M16-1.3.1 |
| EL-M16-S23-004 | heading | visible-default | "Liga & Tournament" | FN-M16-8.1.1 |
| EL-M16-S23-005 | text | visible-default | "Bertanding antara sekolah dalam format liga, kalah mati, atau hibrid!" | FN-M16-8.1.1 |
| EL-M16-S23-006 | link | visible-default | "Cipta Tournament Baru", → /tournament/admin/create, fa-plus | FN-M16-8.1.2 |
| EL-M16-S23-007 | empty-state | visible-default | "Tiada tournament aktif buat masa ini." | FN-M16-8.1.3 |

#### S24 — `/tournament/admin/create` (124 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M16-S24-001 | text | hidden-only | "LIVE:", fa-circle | FN-M16-1.3.1 |
| EL-M16-S24-002 | text | hidden-only | "MAIN" | FN-M16-1.3.1 |
| EL-M16-S24-003 | text | hidden-only | "DAFTAR" | FN-M16-1.3.1 |
| EL-M16-S24-004 | form | visible-default | form | FN-M16-8.2.1 |
| EL-M16-S24-005 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M16-8.2.1 |
| EL-M16-S24-006 | card | visible-default | "Maklumat Asas" | FN-M16-8.2.1 |
| EL-M16-S24-007 | heading | visible-default | "Maklumat Asas" | FN-M16-8.2.1 |
| EL-M16-S24-008 | label | visible-default | "Tajuk Tournament" | FN-M16-8.2.1 |
| EL-M16-S24-009 | input | visible-default | input, name=title, type=text | FN-M16-8.2.1 |
| EL-M16-S24-010 | label | visible-default | "Penerangan" | FN-M16-8.2.1 |
| EL-M16-S24-011 | textarea | visible-default | textarea, name=description | FN-M16-8.2.1 |
| EL-M16-S24-012 | label | visible-default | "Tahap Pendidikan" | FN-M16-8.2.1 |
| EL-M16-S24-013 | select | visible-default | select, name=education_level_id | FN-M16-8.2.1 |
| EL-M16-S24-014 | card | visible-default | "Format" | FN-M16-8.2.2 |
| EL-M16-S24-015 | heading | visible-default | "Format" | FN-M16-8.2.2 |
| EL-M16-S24-016 | label | visible-default | "Perlawanan Tunggal" | FN-M16-8.2.2 |
| EL-M16-S24-017 | radio | visible-default | radio, name=format, type=radio | FN-M16-8.2.2 |
| EL-M16-S24-018 | label | visible-default | "Kalah Mati" | FN-M16-8.2.2 |
| EL-M16-S24-019 | radio | visible-default | radio, name=format, type=radio | FN-M16-8.2.2 |
| EL-M16-S24-020 | label | visible-default | "Liga" | FN-M16-8.2.2 |
| EL-M16-S24-021 | radio | visible-default | radio, name=format, type=radio | FN-M16-8.2.2 |
| EL-M16-S24-022 | label | visible-default | "Hibrid (Liga + Kalah Mati)" | FN-M16-8.2.2 |
| EL-M16-S24-023 | radio | visible-default | radio, name=format, type=radio | FN-M16-8.2.2 |
| EL-M16-S24-024 | label | visible-default | "Bilangan Kumpulan" | FN-M16-8.2.2 |
| EL-M16-S24-025 | input | visible-default | input, name=groups_count, type=number | FN-M16-8.2.2 |
| EL-M16-S24-026 | card | visible-default | "Sumber Soalan" | FN-M16-8.2.3 |
| EL-M16-S24-027 | heading | visible-default | "Sumber Soalan" | FN-M16-8.2.3 |
| EL-M16-S24-028 | label | visible-default | "Mengikut Mata Pelajaran" | FN-M16-8.2.3 |
| EL-M16-S24-029 | radio | visible-default | radio, name=question_mode, type=radio | FN-M16-8.2.3 |
| EL-M16-S24-030 | label | visible-default | "Mengikut Kertas Peperiksaan" | FN-M16-8.2.3 |
| EL-M16-S24-031 | radio | visible-default | radio, name=question_mode, type=radio | FN-M16-8.2.3 |
| EL-M16-S24-032 | label | visible-default | "Campuran Rawak" | FN-M16-8.2.3 |
| EL-M16-S24-033 | radio | visible-default | radio, name=question_mode, type=radio | FN-M16-8.2.3 |
| EL-M16-S24-034 | label | visible-default | "Mata Pelajaran" | FN-M16-8.2.3 |
| EL-M16-S24-035 | select | visible-default | select, name=subject_id | FN-M16-8.2.3 |
| EL-M16-S24-036 | label | conditional | "Kertas Peperiksaan" | FN-M16-8.2.3 |
| EL-M16-S24-037 | select | conditional | select, name=exam_paper_id | FN-M16-8.2.3 |
| EL-M16-S24-038 | label | conditional | "Pilih Mata Pelajaran" | FN-M16-8.2.3 |
| EL-M16-S24-039 | label | conditional | "Bahasa Arab" | FN-M16-8.2.3 |
| EL-M16-S24-040 | checkbox | conditional | checkbox, name=mixed_subject_ids[], type=checkbox | FN-M16-8.2.3 |
| EL-M16-S24-041 | label | conditional | "Bahasa Cina" | FN-M16-8.2.3 |
| EL-M16-S24-042 | checkbox | conditional | checkbox, name=mixed_subject_ids[], type=checkbox | FN-M16-8.2.3 |
| EL-M16-S24-043 | label | conditional | "Bahasa Inggeris" | FN-M16-8.2.3 |
| EL-M16-S24-044 | checkbox | conditional | checkbox, name=mixed_subject_ids[], type=checkbox | FN-M16-8.2.3 |
| EL-M16-S24-045 | label | conditional | "Bahasa Melayu" | FN-M16-8.2.3 |
| EL-M16-S24-046 | checkbox | conditional | checkbox, name=mixed_subject_ids[], type=checkbox | FN-M16-8.2.3 |
| EL-M16-S24-047 | label | conditional | "Bahasa Tamil" | FN-M16-8.2.3 |
| EL-M16-S24-048 | checkbox | conditional | checkbox, name=mixed_subject_ids[], type=checkbox | FN-M16-8.2.3 |
| EL-M16-S24-049 | label | conditional | "Biologi" | FN-M16-8.2.3 |
| EL-M16-S24-050 | checkbox | conditional | checkbox, name=mixed_subject_ids[], type=checkbox | FN-M16-8.2.3 |
| EL-M16-S24-051 | label | conditional | "Ekonomi" | FN-M16-8.2.3 |
| EL-M16-S24-052 | checkbox | conditional | checkbox, name=mixed_subject_ids[], type=checkbox | FN-M16-8.2.3 |
| EL-M16-S24-053 | label | conditional | "Fizik" | FN-M16-8.2.3 |
| EL-M16-S24-054 | checkbox | conditional | checkbox, name=mixed_subject_ids[], type=checkbox | FN-M16-8.2.3 |
| EL-M16-S24-055 | label | conditional | "Geografi" | FN-M16-8.2.3 |
| EL-M16-S24-056 | checkbox | conditional | checkbox, name=mixed_subject_ids[], type=checkbox | FN-M16-8.2.3 |
| EL-M16-S24-057 | label | conditional | "Jawi" | FN-M16-8.2.3 |
| EL-M16-S24-058 | checkbox | conditional | checkbox, name=mixed_subject_ids[], type=checkbox | FN-M16-8.2.3 |
| EL-M16-S24-059 | label | conditional | "Kimia" | FN-M16-8.2.3 |
| EL-M16-S24-060 | checkbox | conditional | checkbox, name=mixed_subject_ids[], type=checkbox | FN-M16-8.2.3 |
| EL-M16-S24-061 | label | conditional | "Matematik" | FN-M16-8.2.3 |
| EL-M16-S24-062 | checkbox | conditional | checkbox, name=mixed_subject_ids[], type=checkbox | FN-M16-8.2.3 |
| EL-M16-S24-063 | label | conditional | "Matematik Tambahan" | FN-M16-8.2.3 |
| EL-M16-S24-064 | checkbox | conditional | checkbox, name=mixed_subject_ids[], type=checkbox | FN-M16-8.2.3 |
| EL-M16-S24-065 | label | conditional | "Pembuatan Pakaian Wanita" | FN-M16-8.2.3 |
| EL-M16-S24-066 | checkbox | conditional | checkbox, name=mixed_subject_ids[], type=checkbox | FN-M16-8.2.3 |
| EL-M16-S24-067 | label | conditional | "Pendidikan Al-Quran & As-Sunnah" | FN-M16-8.2.3 |
| EL-M16-S24-068 | checkbox | conditional | checkbox, name=mixed_subject_ids[], type=checkbox | FN-M16-8.2.3 |
| EL-M16-S24-069 | label | conditional | "Pendidikan Islam" | FN-M16-8.2.3 |
| EL-M16-S24-070 | checkbox | conditional | checkbox, name=mixed_subject_ids[], type=checkbox | FN-M16-8.2.3 |
| EL-M16-S24-071 | label | conditional | "Pendidikan Jasmani & Kesihatan" | FN-M16-8.2.3 |
| EL-M16-S24-072 | checkbox | conditional | checkbox, name=mixed_subject_ids[], type=checkbox | FN-M16-8.2.3 |
| EL-M16-S24-073 | label | conditional | "Pendidikan Moral" | FN-M16-8.2.3 |
| EL-M16-S24-074 | checkbox | conditional | checkbox, name=mixed_subject_ids[], type=checkbox | FN-M16-8.2.3 |
| EL-M16-S24-075 | label | conditional | "Pendidikan Muzik" | FN-M16-8.2.3 |
| EL-M16-S24-076 | checkbox | conditional | checkbox, name=mixed_subject_ids[], type=checkbox | FN-M16-8.2.3 |
| EL-M16-S24-077 | label | conditional | "Pendidikan Seni Visual" | FN-M16-8.2.3 |
| EL-M16-S24-078 | checkbox | conditional | checkbox, name=mixed_subject_ids[], type=checkbox | FN-M16-8.2.3 |
| EL-M16-S24-079 | label | conditional | "Pendidikan Syariah Islamiah" | FN-M16-8.2.3 |
| EL-M16-S24-080 | checkbox | conditional | checkbox, name=mixed_subject_ids[], type=checkbox | FN-M16-8.2.3 |
| EL-M16-S24-081 | label | conditional | "Perniagaan" | FN-M16-8.2.3 |
| EL-M16-S24-082 | checkbox | conditional | checkbox, name=mixed_subject_ids[], type=checkbox | FN-M16-8.2.3 |
| EL-M16-S24-083 | label | conditional | "Pertanian" | FN-M16-8.2.3 |
| EL-M16-S24-084 | checkbox | conditional | checkbox, name=mixed_subject_ids[], type=checkbox | FN-M16-8.2.3 |
| EL-M16-S24-085 | label | conditional | "Prinsip Perakaunan" | FN-M16-8.2.3 |
| EL-M16-S24-086 | checkbox | conditional | checkbox, name=mixed_subject_ids[], type=checkbox | FN-M16-8.2.3 |
| EL-M16-S24-087 | label | conditional | "Reka Bentuk & Teknologi" | FN-M16-8.2.3 |
| EL-M16-S24-088 | checkbox | conditional | checkbox, name=mixed_subject_ids[], type=checkbox | FN-M16-8.2.3 |
| EL-M16-S24-089 | label | conditional | "Sains" | FN-M16-8.2.3 |
| EL-M16-S24-090 | checkbox | conditional | checkbox, name=mixed_subject_ids[], type=checkbox | FN-M16-8.2.3 |
| EL-M16-S24-091 | label | conditional | "Sains Komputer" | FN-M16-8.2.3 |
| EL-M16-S24-092 | checkbox | conditional | checkbox, name=mixed_subject_ids[], type=checkbox | FN-M16-8.2.3 |
| EL-M16-S24-093 | label | conditional | "Sains Rumah Tangga" | FN-M16-8.2.3 |
| EL-M16-S24-094 | checkbox | conditional | checkbox, name=mixed_subject_ids[], type=checkbox | FN-M16-8.2.3 |
| EL-M16-S24-095 | label | conditional | "Sains Sukan" | FN-M16-8.2.3 |
| EL-M16-S24-096 | checkbox | conditional | checkbox, name=mixed_subject_ids[], type=checkbox | FN-M16-8.2.3 |
| EL-M16-S24-097 | label | conditional | "Sejarah" | FN-M16-8.2.3 |
| EL-M16-S24-098 | checkbox | conditional | checkbox, name=mixed_subject_ids[], type=checkbox | FN-M16-8.2.3 |
| EL-M16-S24-099 | label | conditional | "Tasawwur Islam" | FN-M16-8.2.3 |
| EL-M16-S24-100 | checkbox | conditional | checkbox, name=mixed_subject_ids[], type=checkbox | FN-M16-8.2.3 |
| EL-M16-S24-101 | card | visible-default | "Soalan & Masa" | FN-M16-8.2.4 |
| EL-M16-S24-102 | heading | visible-default | "Soalan & Masa" | FN-M16-8.2.4 |
| EL-M16-S24-103 | label | visible-default | "Jumlah Soalan" | FN-M16-8.2.4 |
| EL-M16-S24-104 | input | visible-default | input, name=total_questions, type=number | FN-M16-8.2.4 |
| EL-M16-S24-105 | label | visible-default | "Tetingkap Masa (minit)" | FN-M16-8.2.4 |
| EL-M16-S24-106 | input | visible-default | input, name=time_window_minutes, type=number | FN-M16-8.2.4 |
| EL-M16-S24-107 | card | visible-default | "Pemarkahan" | FN-M16-8.2.5 |
| EL-M16-S24-108 | heading | visible-default | "Pemarkahan" | FN-M16-8.2.5 |
| EL-M16-S24-109 | label | visible-default | "Top-N Pelajar (untuk skor sekolah)" | FN-M16-8.2.5 |
| EL-M16-S24-110 | input | visible-default | input, name=top_n_scoring, type=number | FN-M16-8.2.5 |
| EL-M16-S24-111 | text | visible-default | "Sistem pilih N pelajar terbaik bagi setiap sekolah" | FN-M16-8.2.5 |
| EL-M16-S24-112 | label | visible-default | "Minimum Peserta" | FN-M16-8.2.5 |
| EL-M16-S24-113 | input | visible-default | input, name=min_participants, type=number | FN-M16-8.2.5 |
| EL-M16-S24-114 | text | visible-default | "Minimum pelajar sekolah untuk kelayakan" | FN-M16-8.2.5 |
| EL-M16-S24-115 | card | visible-default | "Pendaftaran" | FN-M16-8.2.6 |
| EL-M16-S24-116 | heading | visible-default | "Pendaftaran" | FN-M16-8.2.6 |
| EL-M16-S24-117 | label | visible-default | "Tarikh Buka Pendaftaran" | FN-M16-8.2.6 |
| EL-M16-S24-118 | input | visible-default | input, name=registration_opens_at, type=datetime-local | FN-M16-8.2.6 |
| EL-M16-S24-119 | label | visible-default | "Tarikh Tutup Pendaftaran" | FN-M16-8.2.6 |
| EL-M16-S24-120 | input | visible-default | input, name=registration_closes_at, type=datetime-local | FN-M16-8.2.6 |
| EL-M16-S24-121 | link | visible-default | "Batal", → /tournament | FN-M16-8.2.7 |
| EL-M16-S24-122 | button | visible-default | "Simpan Draf", type=submit, fa-save | FN-M16-8.2.7 |
| EL-M16-S24-123 | button | visible-default | "Cipta & Buka Pendaftaran", type=submit, fa-rocket | FN-M16-8.2.7 |
| EL-M16-S24-124 | text | conditional | "Standard SPM Kertas 1: 25 soalan" | FN-M16-8.2.4 |

#### S25 — `/liga` (21 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M16-S25-001 | text | hidden-only | "LIVE:", fa-circle | FN-M16-1.3.1 |
| EL-M16-S25-002 | text | hidden-only | "MAIN" | FN-M16-1.3.1 |
| EL-M16-S25-003 | text | hidden-only | "DAFTAR" | FN-M16-1.3.1 |
| EL-M16-S25-004 | link | visible-default | "Cipta Liga Baru", → /liga/cipta, fa-plus | FN-M16-9.1.1 |
| EL-M16-S25-005 | button | visible-default | "Sertai dengan Kod", type=submit, fa-ticket | FN-M16-9.1.1 |
| EL-M16-S25-006 | card | visible-default | "Liga Saya (0)" | FN-M16-9.1.2 |
| EL-M16-S25-007 | tab | visible-default | "Liga Saya (0)", type=submit | FN-M16-9.1.2 |
| EL-M16-S25-008 | tab | visible-default | "Liga Terbuka (1)", type=submit | FN-M16-9.1.2 |
| EL-M16-S25-009 | text | visible-default | "Belum menyertai mana-mana liga" | FN-M16-9.1.2 |
| EL-M16-S25-010 | text | visible-default | "Cipta liga baru atau sertai menggunakan kod jemputan" | FN-M16-9.1.2 |
| EL-M16-S25-011 | link | conditional | "Liga Sejarah 2026 5ST Akan Datang School Persahabatan Sejarah 31/03 - 01/04/2026 …", → /liga/1, fa-bullseye | FN-M16-9.1.3 |
| EL-M16-S25-012 | heading | conditional | "Liga Sejarah 2026 5ST" | FN-M16-9.1.3 |
| EL-M16-S25-013 | badge | conditional | "Akan Datang" | FN-M16-9.1.3 |
| EL-M16-S25-014 | modal | conditional | "Sertai Liga" | FN-M16-9.1.4 |
| EL-M16-S25-015 | form | conditional | form | FN-M16-9.1.4 |
| EL-M16-S25-016 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M16-9.1.4 |
| EL-M16-S25-017 | heading | conditional | "Sertai Liga" | FN-M16-9.1.4 |
| EL-M16-S25-018 | text | conditional | "Masukkan kod jemputan 8 aksara yang diberikan oleh penganjur." | FN-M16-9.1.4 |
| EL-M16-S25-019 | input | conditional | input, name=invite_code, type=text | FN-M16-9.1.4 |
| EL-M16-S25-020 | button | conditional | "Batal", type=button | FN-M16-9.1.4 |
| EL-M16-S25-021 | button | conditional | "Sertai", type=submit | FN-M16-9.1.4 |

#### S26 — `/liga/cipta` (48 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M16-S26-001 | text | hidden-only | "LIVE:", fa-circle | FN-M16-1.3.1 |
| EL-M16-S26-002 | text | hidden-only | "MAIN" | FN-M16-1.3.1 |
| EL-M16-S26-003 | text | hidden-only | "DAFTAR" | FN-M16-1.3.1 |
| EL-M16-S26-004 | form | visible-default | form | FN-M16-9.2.1 |
| EL-M16-S26-005 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M16-9.2.1 |
| EL-M16-S26-006 | label | visible-default | "Nama Liga" | FN-M16-9.2.1 |
| EL-M16-S26-007 | input | visible-default | input, name=name, type=text | FN-M16-9.2.1 |
| EL-M16-S26-008 | label | visible-default | "Jenis" | FN-M16-9.2.1 |
| EL-M16-S26-009 | select | visible-default | select, name=type | FN-M16-9.2.1 |
| EL-M16-S26-010 | label | visible-default | "Skop" | FN-M16-9.2.1 |
| EL-M16-S26-011 | select | visible-default | select, name=scope | FN-M16-9.2.1 |
| EL-M16-S26-012 | label | visible-default | "Mata Pelajaran (Pilihan)" | FN-M16-9.2.1 |
| EL-M16-S26-013 | select | visible-default | select, name=subject_id | FN-M16-9.2.1 |
| EL-M16-S26-014 | label | visible-default | "Mod Permainan" | FN-M16-9.2.1 |
| EL-M16-S26-015 | select | visible-default | select, name=game_mode | FN-M16-9.2.1 |
| EL-M16-S26-016 | label | visible-default | "Tingkatan" | FN-M16-9.2.2 |
| EL-M16-S26-017 | label | visible-default | "D1" | FN-M16-9.2.2 |
| EL-M16-S26-018 | checkbox | visible-default | checkbox, name=class_levels[], type=checkbox | FN-M16-9.2.2 |
| EL-M16-S26-019 | label | visible-default | "D2" | FN-M16-9.2.2 |
| EL-M16-S26-020 | checkbox | visible-default | checkbox, name=class_levels[], type=checkbox | FN-M16-9.2.2 |
| EL-M16-S26-021 | label | visible-default | "D3" | FN-M16-9.2.2 |
| EL-M16-S26-022 | checkbox | visible-default | checkbox, name=class_levels[], type=checkbox | FN-M16-9.2.2 |
| EL-M16-S26-023 | label | visible-default | "D4" | FN-M16-9.2.2 |
| EL-M16-S26-024 | checkbox | visible-default | checkbox, name=class_levels[], type=checkbox | FN-M16-9.2.2 |
| EL-M16-S26-025 | label | visible-default | "D5" | FN-M16-9.2.2 |
| EL-M16-S26-026 | checkbox | visible-default | checkbox, name=class_levels[], type=checkbox | FN-M16-9.2.2 |
| EL-M16-S26-027 | label | visible-default | "D6" | FN-M16-9.2.2 |
| EL-M16-S26-028 | checkbox | visible-default | checkbox, name=class_levels[], type=checkbox | FN-M16-9.2.2 |
| EL-M16-S26-029 | label | visible-default | "T1" | FN-M16-9.2.2 |
| EL-M16-S26-030 | checkbox | visible-default | checkbox, name=class_levels[], type=checkbox | FN-M16-9.2.2 |
| EL-M16-S26-031 | label | visible-default | "T2" | FN-M16-9.2.2 |
| EL-M16-S26-032 | checkbox | visible-default | checkbox, name=class_levels[], type=checkbox | FN-M16-9.2.2 |
| EL-M16-S26-033 | label | visible-default | "T3" | FN-M16-9.2.2 |
| EL-M16-S26-034 | checkbox | visible-default | checkbox, name=class_levels[], type=checkbox | FN-M16-9.2.2 |
| EL-M16-S26-035 | label | visible-default | "T4" | FN-M16-9.2.2 |
| EL-M16-S26-036 | checkbox | visible-default | checkbox, name=class_levels[], type=checkbox | FN-M16-9.2.2 |
| EL-M16-S26-037 | label | visible-default | "T5" | FN-M16-9.2.2 |
| EL-M16-S26-038 | checkbox | visible-default | checkbox, name=class_levels[], type=checkbox | FN-M16-9.2.2 |
| EL-M16-S26-039 | label | visible-default | "Kaedah Skor" | FN-M16-9.2.3 |
| EL-M16-S26-040 | select | visible-default | select, name=scoring_method | FN-M16-9.2.3 |
| EL-M16-S26-041 | label | visible-default | "Tarikh Mula" | FN-M16-9.2.3 |
| EL-M16-S26-042 | input | visible-default | input, name=start_date, type=date | FN-M16-9.2.3 |
| EL-M16-S26-043 | label | visible-default | "Tarikh Tamat" | FN-M16-9.2.3 |
| EL-M16-S26-044 | input | visible-default | input, name=end_date, type=date | FN-M16-9.2.3 |
| EL-M16-S26-045 | label | visible-default | "Had Sekolah (Kosongkan jika tiada had)" | FN-M16-9.2.3 |
| EL-M16-S26-046 | input | visible-default | input, name=max_schools, type=number | FN-M16-9.2.3 |
| EL-M16-S26-047 | link | visible-default | "Batal", → /liga | FN-M16-9.2.4 |
| EL-M16-S26-048 | button | visible-default | "Cipta Liga", type=submit | FN-M16-9.2.4 |

#### S27 — `/liga/{id}` (48 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M16-S27-001 | text | hidden-only | "LIVE:", fa-circle | FN-M16-1.3.1 |
| EL-M16-S27-002 | text | hidden-only | "MAIN" | FN-M16-1.3.1 |
| EL-M16-S27-003 | text | hidden-only | "DAFTAR" | FN-M16-1.3.1 |
| EL-M16-S27-004 | card | visible-default | "Kod Jemputan" | FN-M16-9.3.1 |
| EL-M16-S27-005 | badge | visible-default | "Tamat", fa-circle | FN-M16-9.3.1 |
| EL-M16-S27-006 | badge | visible-default | "Bahasa Melayu", fa-book | FN-M16-9.3.1 |
| EL-M16-S27-007 | badge | visible-default | "01/04 - 30/04/2026", fa-calendar | FN-M16-9.3.1 |
| EL-M16-S27-008 | badge | visible-default | "2 sekolah", fa-school | FN-M16-9.3.1 |
| EL-M16-S27-009 | badge | visible-default | "Jumlah Markah", fa-trophy | FN-M16-9.3.1 |
| EL-M16-S27-010 | text | visible-default | "Dicipta oleh <name> · Tingkatan: T4, T5" | FN-M16-9.3.1 |
| EL-M16-S27-011 | text | visible-default | "Kod Jemputan" | FN-M16-9.3.2 |
| EL-M16-S27-012 | text | visible-default | "TEST2026" | FN-M16-9.3.2 |
| EL-M16-S27-013 | link | visible-default | "Kongsi", → https://wa.me/?text=Jom+sertai+Liga+Pertandingan+%22Liga+Matematik+Spr, fa-whatsapp | FN-M16-9.3.2 |
| EL-M16-S27-014 | card | visible-default | "Sekolah Peserta" | FN-M16-9.3.4 |
| EL-M16-S27-015 | heading | visible-default | "Sekolah Peserta" | FN-M16-9.3.4 |
| EL-M16-S27-016 | text | visible-default | "<school>" | FN-M16-9.3.4 |
| EL-M16-S27-017 | text | visible-default | "<school>" | FN-M16-9.3.4 |
| EL-M16-S27-018 | card | visible-default | "Papan Pendahulu" | FN-M16-9.3.5 |
| EL-M16-S27-019 | heading | visible-default | "Papan Pendahulu" | FN-M16-9.3.5 |
| EL-M16-S27-020 | button | visible-default | "T4", type=submit | FN-M16-9.3.5 |
| EL-M16-S27-021 | button | visible-default | "T5", type=submit | FN-M16-9.3.5 |
| EL-M16-S27-022 | table | conditional | table | FN-M16-9.3.5 |
| EL-M16-S27-023 | badge | conditional | "1" | FN-M16-9.3.5 |
| EL-M16-S27-024 | badge | conditional | "2" | FN-M16-9.3.5 |
| EL-M16-S27-025 | table | visible-default | table | FN-M16-9.3.5 |
| EL-M16-S27-026 | badge | visible-default | "1" | FN-M16-9.3.5 |
| EL-M16-S27-027 | badge | visible-default | "2" | FN-M16-9.3.5 |
| EL-M16-S27-028 | text | conditional | "404" | FN-M16-9.3.6 |
| EL-M16-S27-029 | text | conditional | "🔍" | FN-M16-9.3.6 |
| EL-M16-S27-030 | heading | conditional | "Halaman Tidak Dijumpai" | FN-M16-9.3.6 |
| EL-M16-S27-031 | text | conditional | "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL sal …" | FN-M16-9.3.6 |
| EL-M16-S27-032 | link | conditional | "Halaman Utama", → / | FN-M16-9.3.6 |
| EL-M16-S27-033 | link | conditional | "Mula Latihan", → /latih-tubi | FN-M16-9.3.6 |
| EL-M16-S27-034 | text | conditional | "PRESTASIPLUS" | FN-M16-9.3.6 |
| EL-M16-S27-035 | badge | conditional | "Akan Datang", fa-circle | FN-M16-9.3.1 |
| EL-M16-S27-036 | badge | conditional | "Sejarah", fa-book | FN-M16-9.3.1 |
| EL-M16-S27-037 | badge | conditional | "31/03 - 01/04/2026", fa-calendar | FN-M16-9.3.1 |
| EL-M16-S27-038 | badge | conditional | "3 sekolah", fa-school | FN-M16-9.3.1 |
| EL-M16-S27-039 | text | conditional | "Dicipta oleh <name> · Tingkatan: T5" | FN-M16-9.3.1 |
| EL-M16-S27-040 | text | conditional | "RMU4VCBS" | FN-M16-9.3.2 |
| EL-M16-S27-041 | link | conditional | "Kongsi", → https://wa.me/?text=Jom+sertai+Liga+Pertandingan+%22Liga+Sejarah+2026+, fa-whatsapp | FN-M16-9.3.2 |
| EL-M16-S27-042 | form | conditional | form | FN-M16-9.3.3 |
| EL-M16-S27-043 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M16-9.3.3 |
| EL-M16-S27-044 | hidden-field | hidden-only | hidden-field, name=invite_code, type=hidden | FN-M16-9.3.3 |
| EL-M16-S27-045 | button | conditional | "Sertai Liga Ini", type=submit | FN-M16-9.3.3 |
| EL-M16-S27-046 | text | conditional | "<school>" | FN-M16-9.3.4 |
| EL-M16-S27-047 | empty-state | conditional | "Belum ada data papan pendahulu" | FN-M16-9.3.5 |
| EL-M16-S27-048 | text | conditional | "Data dikemas kini setiap jam" | FN-M16-9.3.5 |

#### S28 — `/sekolah-bersaing` (68 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M16-S28-001 | heading | visible-default | "🏆 Sekolah Bersaing" | FN-M16-10.1.1 |
| EL-M16-S28-002 | text | visible-default | "Leaderboard mingguan — bandingkan sekolah-sekolah di Malaysia. Anda rasa bangga? …" | FN-M16-10.1.1 |
| EL-M16-S28-003 | text | visible-default | "Minggu · sekolah dalam pertandingan" | FN-M16-10.1.1 |
| EL-M16-S28-004 | text | visible-default | "21 Sep 2026" | FN-M16-10.1.1 |
| EL-M16-S28-005 | text | visible-default | "49" | FN-M16-10.1.1 |
| EL-M16-S28-006 | text | visible-default | "#" | FN-M16-10.1.2 |
| EL-M16-S28-007 | text | visible-default | "Sekolah" | FN-M16-10.1.2 |
| EL-M16-S28-008 | text | visible-default | "% Aktif" | FN-M16-10.1.2 |
| EL-M16-S28-009 | text | visible-default | "Streak Avg" | FN-M16-10.1.2 |
| EL-M16-S28-010 | text | visible-default | "Nota/Pelajar" | FN-M16-10.1.2 |
| EL-M16-S28-011 | text | visible-default | "🥇" | FN-M16-10.1.3 |
| EL-M16-S28-012 | text | visible-default | "<school>" | FN-M16-10.1.3 |
| EL-M16-S28-013 | text | visible-default | "Kelantan" | FN-M16-10.1.3 |
| EL-M16-S28-014 | text | visible-default | "0.0%" | FN-M16-10.1.3 |
| EL-M16-S28-015 | text | visible-default | "aktif" | FN-M16-10.1.3 |
| EL-M16-S28-016 | text | visible-default | "🔥 15.0" | FN-M16-10.1.3 |
| EL-M16-S28-017 | text | visible-default | "hari" | FN-M16-10.1.3 |
| EL-M16-S28-018 | text | visible-default | "0.0" | FN-M16-10.1.3 |
| EL-M16-S28-019 | text | visible-default | "per 10" | FN-M16-10.1.3 |
| EL-M16-S28-020 | text | visible-default | "🥈" | FN-M16-10.1.3 |
| EL-M16-S28-021 | text | visible-default | "<school>" | FN-M16-10.1.3 |
| EL-M16-S28-022 | text | visible-default | "Johor" | FN-M16-10.1.3 |
| EL-M16-S28-023 | text | visible-default | "0.0%" | FN-M16-10.1.3 |
| EL-M16-S28-024 | text | visible-default | "aktif" | FN-M16-10.1.3 |
| EL-M16-S28-025 | text | visible-default | "🔥 9.3" | FN-M16-10.1.3 |
| EL-M16-S28-026 | text | visible-default | "hari" | FN-M16-10.1.3 |
| EL-M16-S28-027 | text | visible-default | "0.0" | FN-M16-10.1.3 |
| EL-M16-S28-028 | text | visible-default | "per 10" | FN-M16-10.1.3 |
| EL-M16-S28-029 | text | visible-default | "🥉" | FN-M16-10.1.3 |
| EL-M16-S28-030 | text | visible-default | "<school>" | FN-M16-10.1.3 |
| EL-M16-S28-031 | text | visible-default | "Sabah" | FN-M16-10.1.3 |
| EL-M16-S28-032 | text | visible-default | "0.0%" | FN-M16-10.1.3 |
| EL-M16-S28-033 | text | visible-default | "aktif" | FN-M16-10.1.3 |
| EL-M16-S28-034 | text | visible-default | "🔥 8.6" | FN-M16-10.1.3 |
| EL-M16-S28-035 | text | visible-default | "hari" | FN-M16-10.1.3 |
| EL-M16-S28-036 | text | visible-default | "0.0" | FN-M16-10.1.3 |
| EL-M16-S28-037 | text | visible-default | "per 10" | FN-M16-10.1.3 |
| EL-M16-S28-038 | text | visible-default | "#4" | FN-M16-10.1.3 |
| EL-M16-S28-039 | text | visible-default | "<school>" | FN-M16-10.1.3 |
| EL-M16-S28-040 | text | visible-default | "Sabah" | FN-M16-10.1.3 |
| EL-M16-S28-041 | text | visible-default | "0.0%" | FN-M16-10.1.3 |
| EL-M16-S28-042 | text | visible-default | "aktif" | FN-M16-10.1.3 |
| EL-M16-S28-043 | text | visible-default | "🔥 8.4" | FN-M16-10.1.3 |
| EL-M16-S28-044 | text | visible-default | "hari" | FN-M16-10.1.3 |
| EL-M16-S28-045 | text | visible-default | "0.0" | FN-M16-10.1.3 |
| EL-M16-S28-046 | text | visible-default | "per 10" | FN-M16-10.1.3 |
| EL-M16-S28-047 | text | visible-default | "#5" | FN-M16-10.1.3 |
| EL-M16-S28-048 | text | visible-default | "<school>" | FN-M16-10.1.3 |
| EL-M16-S28-049 | text | visible-default | "Selangor" | FN-M16-10.1.3 |
| EL-M16-S28-050 | text | visible-default | "0.0%" | FN-M16-10.1.3 |
| EL-M16-S28-051 | text | visible-default | "aktif" | FN-M16-10.1.3 |
| EL-M16-S28-052 | text | visible-default | "🔥 8.2" | FN-M16-10.1.3 |
| EL-M16-S28-053 | text | visible-default | "hari" | FN-M16-10.1.3 |
| EL-M16-S28-054 | text | visible-default | "0.0" | FN-M16-10.1.3 |
| EL-M16-S28-055 | text | visible-default | "per 10" | FN-M16-10.1.3 |
| EL-M16-S28-056 | text | visible-default | "💡 Share ranking ini ke parent group WhatsApp. Pelajar nampak sekolah berbangga  …" | FN-M16-10.1.4 |
| EL-M16-S28-057 | text | visible-default | "Untuk Cikgu Besar / PIBG:" | FN-M16-10.1.4 |
| EL-M16-S28-058 | text | conditional | "14 Sep 2026" | FN-M16-10.1.1 |
| EL-M16-S28-059 | text | conditional | "500" | FN-M16-10.1.6 |
| EL-M16-S28-060 | text | conditional | "⚙️" | FN-M16-10.1.6 |
| EL-M16-S28-061 | heading | conditional | "Ralat Pelayan" | FN-M16-10.1.6 |
| EL-M16-S28-062 | text | conditional | "Sesuatu tidak kena di pihak kami. Pasukan teknikal telah dimaklumkan. Sila cuba  …" | FN-M16-10.1.6 |
| EL-M16-S28-063 | link | conditional | "Halaman Utama", → / | FN-M16-10.1.6 |
| EL-M16-S28-064 | link | conditional | "Cuba Semula", → javascript:location.reload() | FN-M16-10.1.6 |
| EL-M16-S28-065 | text | conditional | "PRESTASIPLUS" | FN-M16-10.1.6 |
| EL-M16-S28-066 | text | conditional | "📊 Data minggu ini belum dijana." | FN-M16-10.1.5 |
| EL-M16-S28-067 | text | conditional | "Cron mingguan akan kira pada Isnin pagi. Tunggu kejap ya." | FN-M16-10.1.5 |
| EL-M16-S28-068 | text | conditional | "07 Sep 2026" | FN-M16-10.1.1 |

#### S29 — `/admin/permainan` (52 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M16-S29-001 | card | visible-default | "160" | FN-M16-11.1.1 |
| EL-M16-S29-002 | text | visible-default | "160" | FN-M16-11.1.1 |
| EL-M16-S29-003 | text | visible-default | "Jumlah Bilik" | FN-M16-11.1.1 |
| EL-M16-S29-004 | card | visible-default | "0" | FN-M16-11.1.1 |
| EL-M16-S29-005 | text | visible-default | "0" | FN-M16-11.1.1 |
| EL-M16-S29-006 | text | visible-default | "Sedang Aktif" | FN-M16-11.1.1 |
| EL-M16-S29-007 | card | visible-default | "0" | FN-M16-11.1.1 |
| EL-M16-S29-008 | text | visible-default | "0" | FN-M16-11.1.1 |
| EL-M16-S29-009 | text | visible-default | "Selesai" | FN-M16-11.1.1 |
| EL-M16-S29-010 | card | visible-default | "189" | FN-M16-11.1.1 |
| EL-M16-S29-011 | text | visible-default | "189" | FN-M16-11.1.1 |
| EL-M16-S29-012 | text | visible-default | "Pemain Unik" | FN-M16-11.1.1 |
| EL-M16-S29-013 | form | visible-default | form | FN-M16-11.1.2 |
| EL-M16-S29-014 | hidden-field | hidden-only | hidden-field, name=_token, type=hidden | FN-M16-11.1.2 |
| EL-M16-S29-015 | hidden-field | hidden-only | hidden-field, name=_method, type=hidden | FN-M16-11.1.2 |
| EL-M16-S29-016 | card | visible-default | "Papan Bijak" | FN-M16-11.1.2 |
| EL-M16-S29-017 | heading | visible-default | "Papan Bijak" | FN-M16-11.1.2 |
| EL-M16-S29-018 | text | visible-default | "Tetapan papan permainan ular & tangga (50 petak)" | FN-M16-11.1.2 |
| EL-M16-S29-019 | label | visible-default | "Bilangan Petak Soalan" | FN-M16-11.1.2 |
| EL-M16-S29-020 | input | visible-default | input, name=boardgame_quiz_tiles, type=number | FN-M16-11.1.2 |
| EL-M16-S29-021 | text | visible-default | "petak" | FN-M16-11.1.2 |
| EL-M16-S29-022 | text | visible-default | "Maks 38 petak (48 available - 10 petak khas). Set 0 = tiada soalan." | FN-M16-11.1.2 |
| EL-M16-S29-023 | text | visible-default | "Pecahan Papan (50 petak)", fa-calculator | FN-M16-11.1.2 |
| EL-M16-S29-024 | text | visible-default | "Petak soalan (quiz):" | FN-M16-11.1.2 |
| EL-M16-S29-025 | text | visible-default | "35" | FN-M16-11.1.2 |
| EL-M16-S29-026 | text | visible-default | "Tangga (3) + Ular (3):" | FN-M16-11.1.2 |
| EL-M16-S29-027 | text | visible-default | "6" | FN-M16-11.1.2 |
| EL-M16-S29-028 | text | visible-default | "Bonus (2) + Perangkap (2):" | FN-M16-11.1.2 |
| EL-M16-S29-029 | text | visible-default | "4" | FN-M16-11.1.2 |
| EL-M16-S29-030 | text | visible-default | "Petak biasa (jalan kosong):" | FN-M16-11.1.2 |
| EL-M16-S29-031 | text | visible-default | "3" | FN-M16-11.1.2 |
| EL-M16-S29-032 | text | visible-default | "Mula + Tamat:" | FN-M16-11.1.2 |
| EL-M16-S29-033 | text | visible-default | "2" | FN-M16-11.1.2 |
| EL-M16-S29-034 | text | visible-default | "35 soalan" | FN-M16-11.1.2 |
| EL-M16-S29-035 | text | visible-default | "10 khas" | FN-M16-11.1.2 |
| EL-M16-S29-036 | text | visible-default | "3 biasa" | FN-M16-11.1.2 |
| EL-M16-S29-037 | card | visible-default | "Senarai Permainan" | FN-M16-11.1.3 |
| EL-M16-S29-038 | heading | visible-default | "Senarai Permainan" | FN-M16-11.1.3 |
| EL-M16-S29-039 | text | visible-default | "Permainan yang tersedia dalam sistem" | FN-M16-11.1.3 |
| EL-M16-S29-040 | heading | visible-default | "Papan Bijak" | FN-M16-11.1.3 |
| EL-M16-S29-041 | text | visible-default | "Aktif", fa-circle | FN-M16-11.1.3 |
| EL-M16-S29-042 | text | visible-default | "Ular & tangga dengan soalan kuiz. Multiplayer 2-4 pemain." | FN-M16-11.1.3 |
| EL-M16-S29-043 | link | visible-default | "Lihat", → /papan-bijak, fa-external-link-alt | FN-M16-11.1.3 |
| EL-M16-S29-044 | heading | visible-default | "Kad Memori" | FN-M16-11.1.3 |
| EL-M16-S29-045 | text | visible-default | "Aktif", fa-circle | FN-M16-11.1.3 |
| EL-M16-S29-046 | text | visible-default | "Padankan soalan dengan jawapan. 6 pasangan (12 kad)." | FN-M16-11.1.3 |
| EL-M16-S29-047 | link | visible-default | "Lihat", → /permainan/kad-memori, fa-external-link-alt | FN-M16-11.1.3 |
| EL-M16-S29-048 | heading | visible-default | "Battle Arena" | FN-M16-11.1.3 |
| EL-M16-S29-049 | text | visible-default | "Aktif", fa-circle | FN-M16-11.1.3 |
| EL-M16-S29-050 | text | visible-default | "1v1 kuiz battle masa nyata. Pilih lawan & subjek." | FN-M16-11.1.3 |
| EL-M16-S29-051 | link | visible-default | "Lihat", → /battle, fa-external-link-alt | FN-M16-11.1.3 |
| EL-M16-S29-052 | button | visible-default | "Simpan Tetapan", type=submit, fa-save | FN-M16-11.1.4 |

#### S30 — `(every SHU page) tournamentBanner()` (112 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M16-S30-001 | text | hidden-only | "LIVE:", fa-circle | FN-M16-1.3.1 |
| EL-M16-S30-002 | text | hidden-only | "MAIN" | FN-M16-1.3.1 |
| EL-M16-S30-003 | text | hidden-only | "DAFTAR" | FN-M16-1.3.1 |
| EL-M16-S30-004 | link | visible-default | "Contoh Tournament Pendaftaran Pendaftaran dibuka DAFTAR", → /tournament/u-reg, fa-trophy | FN-M16-1.3.2 |
| EL-M16-S30-005 | text | hidden-only | "LIVE:", fa-circle | FN-M16-1.3.1 |
| EL-M16-S30-006 | text | hidden-only | "MAIN" | FN-M16-1.3.1 |
| EL-M16-S30-007 | text | hidden-only | "DAFTAR" | FN-M16-1.3.1 |
| EL-M16-S30-008 | heading | visible-default | "🎮 Zona Permainan" | FN-M16-4.1.1 |
| EL-M16-S30-009 | text | visible-default | "Main sambil belajar! Kumpul Syiling, naik ranking, dan jadi champion sekolah. Pi …" | FN-M16-4.1.1 |
| EL-M16-S30-010 | text | visible-default | "🌙" | FN-M16-4.1.2 |
| EL-M16-S30-011 | empty-state | visible-default | "Tiada bilik terbuka buat masa ini." | FN-M16-4.1.2 |
| EL-M16-S30-012 | text | visible-default | "Cipta bilik permainan dan jemput rakan-rakan!" | FN-M16-4.1.2 |
| EL-M16-S30-013 | clickable | visible-default | "🎲 Papan Bijak Board game matematik! Gulung dadu, jawab soalan, dan lumba ke gar …", fa-play | FN-M16-4.1.4 |
| EL-M16-S30-014 | card | visible-default | "Papan Bijak" | FN-M16-4.1.4 |
| EL-M16-S30-015 | heading | visible-default | "Papan Bijak" | FN-M16-4.1.4 |
| EL-M16-S30-016 | link | visible-default | "Main Sekarang", → /papan-bijak, fa-play | FN-M16-4.1.4 |
| EL-M16-S30-017 | clickable | visible-default | "🔥 HOT ⚔️ Battle Arena Duel 1-lawan-1 dengan pelajar lain! Siapa jawab betul dan …", fa-bolt | FN-M16-4.1.4 |
| EL-M16-S30-018 | badge | visible-default | "🔥 HOT" | FN-M16-4.1.4 |
| EL-M16-S30-019 | card | visible-default | "Battle Arena" | FN-M16-4.1.4 |
| EL-M16-S30-020 | heading | visible-default | "Battle Arena" | FN-M16-4.1.4 |
| EL-M16-S30-021 | link | visible-default | "Battle!", → /battle, fa-bolt | FN-M16-4.1.4 |
| EL-M16-S30-022 | clickable | visible-default | "👥 MULTIPLAYER ⚔️ Perang Fakta Betul atau Salah? Vote bersama 2-6 pemain! 15 pus …", fa-fist-raised | FN-M16-4.1.5 |
| EL-M16-S30-023 | badge | visible-default | "👥 MULTIPLAYER" | FN-M16-4.1.5 |
| EL-M16-S30-024 | card | visible-default | "Perang Fakta" | FN-M16-4.1.5 |
| EL-M16-S30-025 | heading | visible-default | "Perang Fakta" | FN-M16-4.1.5 |
| EL-M16-S30-026 | link | visible-default | "Main!", → /perang-fakta, fa-fist-raised | FN-M16-4.1.5 |
| EL-M16-S30-027 | clickable | visible-default | "👥 MULTIPLAYER 🏰 Benteng Ilmu Duel 1v1! Serang benteng lawan dengan kuasa ilmu. …", fa-shield-alt | FN-M16-4.1.5 |
| EL-M16-S30-028 | badge | visible-default | "👥 MULTIPLAYER" | FN-M16-4.1.5 |
| EL-M16-S30-029 | card | visible-default | "Benteng Ilmu" | FN-M16-4.1.5 |
| EL-M16-S30-030 | heading | visible-default | "Benteng Ilmu" | FN-M16-4.1.5 |
| EL-M16-S30-031 | link | visible-default | "Duel!", → /benteng-ilmu, fa-shield-alt | FN-M16-4.1.5 |
| EL-M16-S30-032 | clickable | visible-default | "👥 MULTIPLAYER 🏎️ Perlumbaan Matematik Lumba ke garisan penamat! Jawab betul =  …", fa-flag-checkered | FN-M16-4.1.5 |
| EL-M16-S30-033 | badge | visible-default | "👥 MULTIPLAYER" | FN-M16-4.1.5 |
| EL-M16-S30-034 | card | visible-default | "Perlumbaan Matematik" | FN-M16-4.1.5 |
| EL-M16-S30-035 | heading | visible-default | "Perlumbaan Matematik" | FN-M16-4.1.5 |
| EL-M16-S30-036 | link | visible-default | "Lumba!", → /perlumbaan-matematik, fa-flag-checkered | FN-M16-4.1.5 |
| EL-M16-S30-037 | clickable | visible-default | "👥 MULTIPLAYER 🏃 Kuiz Relay Berpasukan! 2 pasukan jawab bergilir-gilir. Bonus k …", fa-users | FN-M16-4.1.5 |
| EL-M16-S30-038 | badge | visible-default | "👥 MULTIPLAYER" | FN-M16-4.1.5 |
| EL-M16-S30-039 | card | visible-default | "Kuiz Relay" | FN-M16-4.1.5 |
| EL-M16-S30-040 | heading | visible-default | "Kuiz Relay" | FN-M16-4.1.5 |
| EL-M16-S30-041 | link | visible-default | "Main!", → /kuiz-relay, fa-users | FN-M16-4.1.5 |
| EL-M16-S30-042 | clickable | visible-default | "👥 MULTIPLAYER 📝 Teka Silang Kata Isi silang kata lawan masa! 2 pemain, 5 minit …", fa-pencil-alt | FN-M16-4.1.5 |
| EL-M16-S30-043 | badge | visible-default | "👥 MULTIPLAYER" | FN-M16-4.1.5 |
| EL-M16-S30-044 | card | visible-default | "Teka Silang Kata" | FN-M16-4.1.5 |
| EL-M16-S30-045 | heading | visible-default | "Teka Silang Kata" | FN-M16-4.1.5 |
| EL-M16-S30-046 | link | visible-default | "Main!", → /teka-silang-kata, fa-pencil-alt | FN-M16-4.1.5 |
| EL-M16-S30-047 | clickable | visible-default | "✅❌ BARU! ✅ Betul atau Salah Kenyataan keluar laju — tekan Betul atau Salah dalam …", fa-check-circle | FN-M16-4.1.6 |
| EL-M16-S30-048 | badge | visible-default | "✅❌ BARU!" | FN-M16-4.1.6 |
| EL-M16-S30-049 | card | visible-default | "Betul atau Salah" | FN-M16-4.1.6 |
| EL-M16-S30-050 | heading | visible-default | "Betul atau Salah" | FN-M16-4.1.6 |
| EL-M16-S30-051 | link | visible-default | "Mula", → /permainan/betul-salah, fa-check-circle | FN-M16-4.1.6 |
| EL-M16-S30-052 | clickable | visible-default | "📅 HARIAN 🎯 Roda Nasib Pusing roda setiap hari untuk dapat ganjaran misteri — S …", fa-circle-notch | FN-M16-4.1.6 |
| EL-M16-S30-053 | badge | visible-default | "📅 HARIAN" | FN-M16-4.1.6 |
| EL-M16-S30-054 | card | visible-default | "Roda Nasib" | FN-M16-4.1.6 |
| EL-M16-S30-055 | heading | visible-default | "Roda Nasib" | FN-M16-4.1.6 |
| EL-M16-S30-056 | link | visible-default | "Spin Sekarang!", → /permainan/roda-nasib, fa-circle-notch | FN-M16-4.1.6 |
| EL-M16-S30-057 | clickable | visible-default | "📅 MINGGUAN 🏆 Pertandingan Mingguan Lumba dengan semua pelajar setiap minggu! T …", fa-trophy | FN-M16-4.1.6 |
| EL-M16-S30-058 | badge | visible-default | "📅 MINGGUAN" | FN-M16-4.1.6 |
| EL-M16-S30-059 | card | visible-default | "Pertandingan Mingguan" | FN-M16-4.1.6 |
| EL-M16-S30-060 | heading | visible-default | "Pertandingan Mingguan" | FN-M16-4.1.6 |
| EL-M16-S30-061 | link | visible-default | "Lihat Ranking", → /permainan/pertandingan, fa-trophy | FN-M16-4.1.6 |
| EL-M16-S30-062 | clickable | visible-default | "🗺️ Peta Pengembaraan Jelajah dunia matematik! Selesaikan misi di setiap checkpo …", fa-map-marked-alt | FN-M16-4.1.7 |
| EL-M16-S30-063 | card | visible-default | "Peta Pengembaraan" | FN-M16-4.1.7 |
| EL-M16-S30-064 | heading | visible-default | "Peta Pengembaraan" | FN-M16-4.1.7 |
| EL-M16-S30-065 | link | visible-default | "Jelajah", → /peta-belajar, fa-map-marked-alt | FN-M16-4.1.7 |
| EL-M16-S30-066 | clickable | visible-default | "👨‍👩‍👧 IBU BAPA 🧠 Uji Minda Cabaran khas dari ibu/bapa kamu! Jawab soalan, ku …", fa-brain | FN-M16-4.1.8 |
| EL-M16-S30-067 | badge | visible-default | "👨‍👩‍👧 IBU BAPA" | FN-M16-4.1.8 |
| EL-M16-S30-068 | card | visible-default | "Uji Minda" | FN-M16-4.1.8 |
| EL-M16-S30-069 | heading | visible-default | "Uji Minda" | FN-M16-4.1.8 |
| EL-M16-S30-070 | link | visible-default | "Mula", → /permainan/uji-minda, fa-brain | FN-M16-4.1.8 |
| EL-M16-S30-071 | clickable | visible-default | "⚡ BARU! ⚡ Cabaran Kilat 60 saat! Jawab laju, bina combo, pecah rekod! Makin panj …", fa-bolt | FN-M16-4.1.9 |
| EL-M16-S30-072 | badge | visible-default | "⚡ BARU!" | FN-M16-4.1.9 |
| EL-M16-S30-073 | card | visible-default | "Cabaran Kilat" | FN-M16-4.1.9 |
| EL-M16-S30-074 | heading | visible-default | "Cabaran Kilat" | FN-M16-4.1.9 |
| EL-M16-S30-075 | link | visible-default | "Mula!", → /permainan/cabaran-kilat, fa-bolt | FN-M16-4.1.9 |
| EL-M16-S30-076 | clickable | visible-default | "💰 BARU! 💰 Jutawan Ilmu Pilih subjek, jawab 15 soalan makin susah — menang sehi …", fa-crown | FN-M16-4.1.9 |
| EL-M16-S30-077 | badge | visible-default | "💰 BARU!" | FN-M16-4.1.9 |
| EL-M16-S30-078 | card | visible-default | "Jutawan Ilmu" | FN-M16-4.1.9 |
| EL-M16-S30-079 | heading | visible-default | "Jutawan Ilmu" | FN-M16-4.1.9 |
| EL-M16-S30-080 | link | visible-default | "Main!", → /permainan/jutawan, fa-crown | FN-M16-4.1.9 |
| EL-M16-S30-081 | clickable | visible-default | "🧩 BARU! 🧩 Susun Jawapan Huruf/perkataan bercampur aduk — susun semula untuk be …", fa-puzzle-piece | FN-M16-4.1.9 |
| EL-M16-S30-082 | badge | visible-default | "🧩 BARU!" | FN-M16-4.1.9 |
| EL-M16-S30-083 | card | visible-default | "Susun Jawapan" | FN-M16-4.1.9 |
| EL-M16-S30-084 | heading | visible-default | "Susun Jawapan" | FN-M16-4.1.9 |
| EL-M16-S30-085 | link | visible-default | "Susun!", → /permainan/susun-jawapan, fa-puzzle-piece | FN-M16-4.1.9 |
| EL-M16-S30-086 | clickable | visible-default | "🎯 BARU! 🎯 Tembak Jawapan Jawapan jatuh dari atas — tap yang betul sebelum samp …", fa-crosshairs | FN-M16-4.1.9 |
| EL-M16-S30-087 | badge | visible-default | "🎯 BARU!" | FN-M16-4.1.9 |
| EL-M16-S30-088 | card | visible-default | "Tembak Jawapan" | FN-M16-4.1.9 |
| EL-M16-S30-089 | heading | visible-default | "Tembak Jawapan" | FN-M16-4.1.9 |
| EL-M16-S30-090 | link | visible-default | "Tembak!", → /permainan/tembak-jawapan, fa-crosshairs | FN-M16-4.1.9 |
| EL-M16-S30-091 | clickable | visible-default | "🔗 BARU! 🔗 Sambung Kata Taip perkataan bermula huruf terakhir! Bina rantaian pa …", fa-link | FN-M16-4.1.10 |
| EL-M16-S30-092 | badge | visible-default | "🔗 BARU!" | FN-M16-4.1.10 |
| EL-M16-S30-093 | card | visible-default | "Sambung Kata" | FN-M16-4.1.10 |
| EL-M16-S30-094 | heading | visible-default | "Sambung Kata" | FN-M16-4.1.10 |
| EL-M16-S30-095 | link | visible-default | "Mula!", → /permainan/sambung-kata, fa-link | FN-M16-4.1.10 |
| EL-M16-S30-096 | clickable | visible-default | "🧠 HOT! 🃏 Kad Memori Padankan soalan dengan jawapan yang betul! Cari semua pasa …", fa-brain | FN-M16-4.1.11 |
| EL-M16-S30-097 | badge | visible-default | "🧠 HOT!" | FN-M16-4.1.11 |
| EL-M16-S30-098 | card | visible-default | "Kad Memori" | FN-M16-4.1.11 |
| EL-M16-S30-099 | heading | visible-default | "Kad Memori" | FN-M16-4.1.11 |
| EL-M16-S30-100 | link | visible-default | "Main!", → /permainan/kad-memori, fa-brain | FN-M16-4.1.11 |
| EL-M16-S30-101 | link | conditional | "Contoh Tournament Berlangsung Sedang berlangsung", → /tournament/u-ongoing, fa-trophy | FN-M16-1.3.3 |
| EL-M16-S30-102 | text | hidden-only | "LIVE:", fa-circle | FN-M16-1.3.1 |
| EL-M16-S30-103 | text | hidden-only | "MAIN" | FN-M16-1.3.1 |
| EL-M16-S30-104 | text | hidden-only | "DAFTAR" | FN-M16-1.3.1 |
| EL-M16-S30-105 | link | conditional | "Contoh Tournament LIVE LIVE: <school> vs <school> MAIN", → /tournament/u-live, fa-broadcast-tower | FN-M16-1.3.4 |
| EL-M16-S30-106 | text | hidden-only | "LIVE:", fa-circle | FN-M16-1.3.1 |
| EL-M16-S30-107 | text | hidden-only | "MAIN" | FN-M16-1.3.1 |
| EL-M16-S30-108 | text | hidden-only | "DAFTAR" | FN-M16-1.3.1 |
| EL-M16-S30-109 | heading | conditional | "Liga & Tournament" | FN-M16-8.1.1 |
| EL-M16-S30-110 | text | conditional | "Bertanding antara sekolah dalam format liga, kalah mati, atau hibrid!" | FN-M16-8.1.1 |
| EL-M16-S30-111 | link | conditional | "Cipta Tournament Baru", → /tournament/admin/create, fa-plus | FN-M16-8.1.2 |
| EL-M16-S30-112 | empty-state | conditional | "Tiada tournament aktif buat masa ini." | FN-M16-8.1.3 |

### 6.2 Shell elements

The shells are chrome owned by the global shell / M23 (00-global-ui, design/shells.md). Their M16-relevant elements (M16 menu entries, header titles and subtitles) are mapped below; every other shell element is excluded with the reason counted under each table.

#### SHA — admin-panel shell — 202 elements, 13 mapped, 189 excluded

Mapped (listed individually):

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M16-SHA-063 | toggle | visible-default | "Battle & Permainan", type=submit, fa-bolt | FN-M16-1.1.2 |
| EL-M16-SHA-064 | link | conditional | "Battle Live", → /battle, fa-bolt | FN-M16-1.1.2 |
| EL-M16-SHA-065 | link | conditional | "Ranking Sekolah", → /battle/ranking-sekolah, fa-school | FN-M16-1.1.2 |
| EL-M16-SHA-066 | link | conditional | "Leaderboard", → /battle/leaderboard, fa-trophy | FN-M16-1.1.2 |
| EL-M16-SHA-067 | link | conditional | "Tetapan Permainan", → /admin/permainan, fa-dice | FN-M16-1.1.2 |
| EL-M16-SHA-104 | link | visible-default | "Sekolah Bersaing", → /sekolah-bersaing, fa-trophy | FN-M16-1.1.2 |
| EL-M16-SHA-118 | heading | visible-default | "Dashboard" | FN-M16-1.1.3 |
| EL-M16-SHA-119 | text | visible-default | "Selamat datang, Admin" | FN-M16-1.1.3 |
| EL-M16-SHA-170 | text | hidden-only | "Battle & Permainan" | FN-M16-1.1.2 |
| EL-M16-SHA-171 | link | hidden-only | "Battle Live", → /battle, fa-bolt | FN-M16-1.1.2 |
| EL-M16-SHA-172 | link | hidden-only | "Tetapan Permainan", → /admin/permainan, fa-dice | FN-M16-1.1.2 |
| EL-M16-SHA-198 | heading | conditional | "🎮 Tetapan Permainan" | FN-M16-1.1.3 |
| EL-M16-SHA-199 | text | conditional | "Urus konfigurasi Papan Bijak, Kad Memori & permainan lain" | FN-M16-1.1.3 |

Excluded (by reason):

- 168 × Excluded — admin panel shell / M23 (menu entry, section heading or control owned by 00-global-ui or by the module its link targets)
- 7 × Excluded — admin shell user block and logout (00-global-ui)
- 14 × Excluded — admin shell server-status pill (M23 / M17)

#### SHU — user-portal shell — 399 elements, 37 mapped, 362 excluded

Mapped (listed individually):

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M16-SHU-023 | link | visible-default | "Sekolah Bersaing NEW", → /sekolah-bersaing, fa-trophy | FN-M16-1.1.1 |
| EL-M16-SHU-024 | badge | visible-default | "NEW" | FN-M16-1.1.1 |
| EL-M16-SHU-049 | link | visible-default | "Sekolah Bersaing", → /sekolah-bersaing, fa-trophy | FN-M16-1.1.1 |
| EL-M16-SHU-059 | link | visible-default | "Liga Pertandingan", → /liga, fa-trophy | FN-M16-1.1.1 |
| EL-M16-SHU-070 | link | visible-default | "Permainan 🎮", → /permainan, fa-gamepad | FN-M16-1.1.1 |
| EL-M16-SHU-071 | badge | visible-default | "🎮" | FN-M16-1.1.1 |
| EL-M16-SHU-074 | link | visible-default | "Tournament", → /tournament, fa-trophy | FN-M16-1.1.1 |
| EL-M16-SHU-136 | heading | visible-default | "Battle Arena" | FN-M16-1.1.3 |
| EL-M16-SHU-137 | text | visible-default | "Bertanding kuiz 1v1 dengan pelajar lain!" | FN-M16-1.1.3 |
| EL-M16-SHU-211 | link | hidden-only | "Permainan 🎮", → /permainan, fa-gamepad | FN-M16-1.1.1 |
| EL-M16-SHU-212 | badge | hidden-only | "🎮" | FN-M16-1.1.1 |
| EL-M16-SHU-215 | link | hidden-only | "Tournament", → /tournament, fa-trophy | FN-M16-1.1.1 |
| EL-M16-SHU-226 | link | hidden-only | "Sekolah Bersaing NEW", → /sekolah-bersaing, fa-trophy | FN-M16-1.1.1 |
| EL-M16-SHU-227 | badge | hidden-only | "NEW" | FN-M16-1.1.1 |
| EL-M16-SHU-339 | link | conditional | "Game", → /permainan, fa-gamepad | FN-M16-1.1.1 |
| EL-M16-SHU-375 | heading | conditional | "Ranking Pelajar Battle" | FN-M16-1.1.3 |
| EL-M16-SHU-376 | text | conditional | "Siapa pejuang terhebat minggu ini?" | FN-M16-1.1.3 |
| EL-M16-SHU-380 | heading | conditional | "Papan Ranking Sekolah" | FN-M16-1.1.3 |
| EL-M16-SHU-381 | text | conditional | "Ranking 10,218 sekolah seluruh Malaysia" | FN-M16-1.1.3 |
| EL-M16-SHU-382 | heading | conditional | "<school>" | FN-M16-1.1.3 |
| EL-M16-SHU-383 | text | conditional | "Selangor · SMK" | FN-M16-1.1.3 |
| EL-M16-SHU-384 | text | conditional | "Selangor · SK" | FN-M16-1.1.3 |
| EL-M16-SHU-385 | heading | conditional | "Sejarah Battle" | FN-M16-1.1.3 |
| EL-M16-SHU-386 | text | conditional | "Rekod pertandingan anda" | FN-M16-1.1.3 |
| EL-M16-SHU-387 | heading | conditional | "Dashboard" | FN-M16-1.1.3 |
| EL-M16-SHU-388 | text | conditional | "Selamat datang kembali" | FN-M16-1.1.3 |
| EL-M16-SHU-389 | heading | conditional | "Liga & Tournament" | FN-M16-1.1.3 |
| EL-M16-SHU-390 | text | conditional | "Senarai tournament antara sekolah" | FN-M16-1.1.3 |
| EL-M16-SHU-391 | heading | conditional | "Cipta Tournament Baru" | FN-M16-1.1.3 |
| EL-M16-SHU-392 | text | conditional | "Tetapkan format, sumber soalan, dan jadual pendaftaran" | FN-M16-1.1.3 |
| EL-M16-SHU-393 | heading | conditional | "Liga Pertandingan" | FN-M16-1.1.3 |
| EL-M16-SHU-394 | text | conditional | "Sertai dan urus pertandingan antara sekolah" | FN-M16-1.1.3 |
| EL-M16-SHU-395 | heading | conditional | "Cipta Liga Pertandingan" | FN-M16-1.1.3 |
| EL-M16-SHU-396 | text | conditional | "Tetapkan peraturan dan mulakan pertandingan antara sekolah" | FN-M16-1.1.3 |
| EL-M16-SHU-397 | heading | conditional | "Liga Matematik Sprint Test" | FN-M16-1.1.3 |
| EL-M16-SHU-398 | text | conditional | "Friendly · School" | FN-M16-1.1.3 |
| EL-M16-SHU-399 | heading | conditional | "Liga Sejarah 2026 5ST" | FN-M16-1.1.3 |

Excluded (by reason):

- 285 × Excluded — global shell / M23 (menu entry, section heading or control owned by 00-global-ui or by the module its link targets)
- 12 × Excluded — M14 header chips (koin / mata / hari)
- 2 × Excluded — notification bell (M01 / M22)
- 5 × Excluded — global shell footer (00-global-ui)
- 23 × Excluded — global shell PWA prompt and bottom navigation (00-global-ui)
- 30 × Excluded — chatbot widget (M22)
- 5 × Excluded — global shell user card / drawer name (00-global-ui)


---

## 7. Fidelity deviations

These are the **only** intended differences from the live site. Anything not listed must match live (D7). Rule D9 (user, standing, pre-approved): where live is broken or contradictory, fix it minimally; where it works, replicate it exactly; when unsure whether something is broken, follow live. D10: accessibility replicates live; a deliberate, consistent limit is not broken; adding options to a working feature is new scope. CLAUDE.md §6: minimal fixes that create no new visible contradiction; seeds mirror observation. Precedents applied: header title from the route (DV-SH-03); 500 responses become handled; in-card scroll at 375 with no sticky column; text under 12 px raised to 12 px; an admin-layout page that is contradictory moves to the user layout; UTC shown as MYT is fixed; a game that starts under the overlay is a broken flow. Every fact cited is in discovery §1–§8, the inventory or the dated snapshot.

| ID | Discovery | Category | Live behaviour (evidence) | Rebuild behaviour (specified) and alternatives | Status |
|---|---|---|---|---|---|
| DV-M16-01 | D-M16-1 | Wrong title | The shell header reads "Dashboard" / "Selamat datang kembali" on every games page S6–S21 while the tab titles are correct (SHU-387/388; every screenshot). | Shell rule DV-SH-03: the page title — the h1 without its leading emoji ("Zona Permainan", "Papan Bijak", "Perang Fakta", …, "Jutawan Ilmu", "Pertandingan Mingguan", "Uji Minda"; for S13–S16 the game title of the picker) — with the live subtitle "Selamat datang kembali" kept (as M14 DV-M14-01). Alternatives: (a) the tab titles with "— PRESTASIPLUS" — rejected: suffix and emoji are tab-only; (b) drop the subtitle — rejected: the greeting is not wrong. | Approved (D9) |
| DV-M16-02 | D-M16-2 | Wrong title / contradictory layout | `/sekolah-bersaing` (not an `/admin` route, linked twice from the user-portal sidebar and its drawer) renders in the admin layout with "Dashboard" / "Selamat datang, Admin" (SHA-118/119). | The page renders in the **user-portal shell** for every role with "Sekolah Bersaing" / "Selamat datang kembali"; the admin-panel link opens it in the user shell like "Battle Live" → `/battle`. Alternatives: (a) keep the admin layout — rejected: pupils would get admin chrome on a user-sidebar page; (b) layout per role — rejected: one route with two layouts. | Approved (D9, precedent) |
| DV-M16-03 | D-M16-3 | Broken page | `/permainan/sambung-kata` answers HTTP 500 with an empty body (browser error page); the S6 card "Sambung Kata" / "Mula!" links to it. | The route renders the app's handled error page observed on S28 ("500", "⚙️", "Ralat Pelayan", text, "Halaman Utama", "Cuba Semula", "PRESTASIPLUS"); the card and link stay. No game is built (content not observable, Q-M16-8). Alternatives: (a) remove the card — rejected: removes live content; (b) build a word-chain game from the card copy — rejected: invented UX. | Approved (D9, precedent) |
| DV-M16-04 | D-M16-4 | Broken control | S2 pills "Mingguan" / "Bulanan" restyle only; the table never changes (x-data only). | The pills switch the table between the weekly and the monthly student standings (client-side, no URL parameter, as live). Seeds are empty for both periods (the live table was empty under both pills). Alternatives: (a) replicate — rejected: a control that does nothing is broken; (b) remove the pills — rejected: removes live content. | Approved (D9) |
| DV-M16-05 | D-M16-5 | Candidate — risk | "Batal" during a search sends no cancel request (the queue expires on the server); the timer text advances only every 3 s. | **Rejected — replicate live.** Both are deliberate script behaviour (no cancel endpoint exists among the 13 `/api/battle/*` endpoints); the mock never matches a queue that is no longer polled, so no ghost match appears. | Rejected — replicate live |
| DV-M16-06 | D-M16-6 | Unreachable control | The "Cabaran Masuk" (received challenges) modal has no opener although `GET /api/battle/invitations` runs on every load; `requestJoinQueue` and `forfeitBattle` have no caller on S1, so received challenges cannot be answered. | The modal **opens by itself** when the invitations list is not empty (no new control or copy); with an empty list nothing changes. The waiting side ("Menunggu Kelulusan...") stays unreachable as live: making it reachable needs a list of open queues that live does not have (new scope); it is kept for fidelity and reachable by a test hook. Forfeit is used by the provisional arena. Alternatives: (a) add a "Cabaran Masuk" button with a count — rejected: new control; (b) replicate — rejected: sent challenges could never be answered. | Approved (D9) — waiting side replicated |
| DV-M16-07 | D-M16-7 | Hidden feedback | S8–S12: an unknown room code redirects to the lobby with the flash "Bilik tidak dijumpai." rendered at the bottom, about 1,080 px down, off-screen on arrival; S7 answers a 404 page. | The flash renders at the **top** of the lobby content (same box and copy). S7's 404 for an unknown room URL stays (a 404 for an unknown URL is correct). Alternatives: (a) unify S7 to the redirect — rejected: changes working behaviour; (b) replicate — rejected: feedback nobody sees. | Approved (D9) |
| DV-M16-08 | D-M16-8 | Candidate — ordering | Pendahulu rows with equal values change order between requests. | **Rejected — replicate live** in substance: the mock needs one deterministic order, so ties keep the snapshot order (one of the live orders); no visible difference in kind. | Rejected — replicate live |
| DV-M16-09 | D-M16-9 | Contradictory values | S3 all time: the podium's 3rd place is 8082 (367) while the table's #3 is 8078 (367) (snapshot). | The podium shows rows 1–3 of the national ranking of the period (8078 third); under a state filter it still shows the national top 3 (as live). Alternatives: (a) break ties by id on both — rejected: changes the table order observed on live; (b) replicate — rejected: two different #3. | Approved (D9) |
| DV-M16-10 | D-M16-10, D-M16-11 | Contradictory values | S4 "Minggu Ini" / "Bulan Ini" show stale stored figures (8106 "this week" 15 battles for battles 2–3 months old; 8106 "Bulan Ini" = 8080's figures; several schools "#1" at once) while S3 weekly is empty. | The two boxes read the same weekly / monthly standings as S3 and "#n" is the school's position in that list; no standing → "Tiada data minggu ini" / "Tiada data bulan ini". At the clock only 8082 has a monthly standing (#1, 8, 4/0/4, 591, the live values). Alternatives: (a) keep the stored per-school rows — rejected: contradicts S3; (b) hide the boxes — rejected: removes content. | Approved (D9) |
| DV-M16-11 | D-M16-12 | Candidate — status | League 1 shows "Akan Datang" although its end date 01/04/2026 has passed. | **Rejected — replicate live.** The status is stored and managed by the organiser (league 2 shows "Tamat"); nothing shows that dates drive it; when unsure, follow live. The seed keeps "Akan Datang"; runtime status changes are not built (OQ-M16-09). | Rejected — replicate live |
| DV-M16-12 | D-M16-13 | Wrong label (language) | S25 chip "School" and S27 subtitle "Friendly · School" show raw enum values; the create form labels them "Sekolah" / "Persahabatan". | The form's BM labels: chip "Sekolah", subtitle "Persahabatan · Sekolah" (and every other type / scope value by its S26 label). Alternative: replicate — rejected: raw English enums on a BM screen. | Approved (D9) |
| DV-M16-13 | D-M16-14 | Layout breakage | S27 league 2 leaderboard at 375 px: a 335 px table inside a 310 px `overflow: visible` wrapper in a clipping card; "Purata" is cut. | The table scrolls horizontally inside its card (no sticky column), as S2/S3/S7 do on live. Alternative: stacked cards — rejected: new layout. | Approved (D9, precedent) |
| DV-M16-14 | D-M16-15 | Contradictory values | S6 Papan Bijak chip "🆕 Belum main lagi" while the same account is #1 of the Papan Bijak Top 10 with 6 games. | The chip is shown only while the viewer has no Papan Bijak game in the standings (the admin: none shown); the Battle chip "🆕 Belum battle lagi" follows the same rule (the admin has no battle: shown). No new copy for "played" (the played variant is unobservable). Alternatives: (a) invent a "played" chip — rejected: new copy; (b) replicate — rejected: contradicts the Top 10. | Approved (D9) |
| DV-M16-15 | D-M16-16 | Contradictory rules | S29 card "Ular & tangga dengan soalan kuiz. Multiplayer 2-4 pemain." vs the S7 "Maks Pemain" 2–6 (default 4). | Admin card copy "… Multiplayer 2-6 pemain." (only "4" → "6"); the working lobby control stays. Alternative: limit the lobby to 2–4 — rejected: changes a working control. | Approved (D9) |
| DV-M16-16 | D-M16-17 | Candidate — contradictory numbers | S29 "Selesai 0" with 160 rooms while the lobbies count wins. | **Rejected — replicate live (data).** The seed keeps 160 rooms, 0 playing, 0 finished (status `closed`, INFERRED) and the leaderboards as observed (seeds mirror observation). At runtime a finished room becomes `finished` and counts in "Selesai". | Rejected — replicate live |
| DV-M16-17 | D-M16-18 | Contradictory rule (time zone) | S20 counts down to the literal `2026-09-27T23:59:59.999999Z` (UTC), i.e. 07:59:59 MYT Monday, while the label says the week ends "27 Sep". | The week ends Sunday 23:59:59.999 **MYT** (Asia/Kuala_Lumpur); the countdown, the "Tamat!" moment and the weekly ranking window use it. Alternative: replicate — rejected: UTC shown as MYT (precedent). | Approved (D9, precedent) |
| DV-M16-18 | D-M16-19 | Broken flow | S13–S15: the game starts under the darjah picker; a pupil who lingers loses time, and Betul/Salah and Cabaran Kilat submit a result when the hidden timer ends. | Nothing runs under the picker: the countdown (S13–S15) or the game (S16) starts only after a darjah is chosen; no submit is sent from the picker. Alternative: replicate — rejected: phantom results (precedent). | Approved (D9, precedent) |
| DV-M16-19 | D-M16-20 | Candidate — label | The picker says "Pilih darjah / tingkatan kamu:" but lists Darjah 1–4 only; `?darjah=5…11` work. | **Rejected — replicate live.** Darjah 1–4 is the same deliberate, consistent limit as M03 Peta Belajar and M05 practice (D10); completing the list would be new scope; `?darjah=5…11` stays supported. | Rejected — replicate live |
| DV-M16-20 | D-M16-21 | Broken control | S7 quick-match error text sits inside the `searching` block, and every error path sets `searching=false`, so errors are never visible. | The last error ("Tiada lawan dijumpai. Cuba lagi!" or the server error) shows below "🔍 Cari Lawan Sekarang" until the next search starts; same copy and red style. Alternative: replicate — rejected: invisible feedback. | Approved (D9) |
| DV-M16-21 | D-M16-22 | Candidate — copy | The Kad Memori card says "… sebelum masa habis." but the game has no time limit (the clock counts up). | **Rejected — replicate live.** Promotional card copy; the game shows elapsed time; when unsure, follow live (no new copy). | Rejected — replicate live |
| DV-M16-22 | D-M16-23 | Candidate — copy | The Roda Nasib card promises "Syiling, bonus XP, atau cabaran khas" but the wheel has only Syiling and "Cuba Lagi". | **Rejected — replicate live.** Promotional "ganjaran misteri" copy; when unsure, follow live. | Rejected — replicate live |
| DV-M16-23 | D-M16-24 | Cross-module contradiction | Every game shows "Syiling" earned (client-computed; in-game counters, result tiles, coin-fly, Roda Nasib "+{n} Syiling … Ditambah ke akaun kamu!") while M14 has `games_award_syiling` = 0 ("0 = XP sahaja, tutup exploit") and pays nothing (no game ledger row after 25/05/2026; the admin's wheel "2 kali spin · 0 Syiling dimenangkan"). | Every syiling value a game shows is the **credited** amount returned by M14 (`onGameResult`): 0 with the M14 seed — counters and tiles read 0, no coin-fly, the Roda Nasib modal omits "+{n} Syiling" and "Ditambah ke akaun kamu!" when nothing is credited, "Syiling dimenangkan" sums credited coins. With `games_award_syiling` = 1 the computed amounts are credited and shown as live. Descriptive copy (hub subtitle, cards, "menang sampai 1,000 Syiling", prizes "+100 🪙") stays: it describes the configurable economy. Alternatives: (a) hide every syiling tile — rejected: removes layout and breaks the setting-1 case; (b) replicate — rejected: shows coins nobody receives; (c) pay the coins — rejected: contradicts M14's rule. M14 v1.1 already asks for exactly this (XR-M14-07: show the returned `coinsCredited`); the remaining details are XR-M16-02. | Approved (D9) |
| DV-M16-24 | D-M16-25 | Unreadable text | Text below 12 px on S6, S7, S13–S16 / S19 picker, S15 ("⚠ GARIS MAUT" 8.8 px), S19, S27, S28, S29 (9 px at 375) — discovery §8.1 and the audit sweep; the complete list is URS FN-M16-1.4.1. | Raised to 12 px; nothing else changes (same rule as M01 DV-16, M14 DV-M14-11). Alternative: replicate — rejected: NFR-02 treats text < 12 px as unreadable. | Approved (D9) |
| DV-M16-25 | D-M16-26 | Candidate — contradictory figures | S28 "% Aktif 0.0%" beside "Streak Avg 15.0 hari" for the same school. | **Rejected — replicate live.** Not a contradiction: "% Aktif" is rounded to 1 decimal (a few active pupils in a large school read 0.0 %) while the streak average is over the pupils who have a streak. | Rejected — replicate live |
| DV-M16-26 | D-M16-27 | Contradictory data | S2 lists no student in either period while S3 monthly lists 8082 with 2 pupils and S4 lists battles (v1.0 wrongly claimed that the monthly school row does not match the four September battles; it does, 8 sides 4/0/4, once 0–0 counts as a win for player B, AUD-M16-02). | Student standings are **computed from the battle records** like the school standings (D11, DV-M16-35): the weekly period stays empty (as live) and the monthly period lists the two 8082 pupils of the September battles, 4316 and 4317, "2/0/2" each; their ketepatan, streak and score have no observed value and are PROPOSED (provisional). Alternatives: (a) keep S2 empty in both periods (v1.0) — rejected: stored data that contradicts the battle records (D11); (b) invent observed-looking values — rejected. | Approved (D9 / D11) |
| DV-M16-27 | D-M16-28 | Visual bug | S24 "Simpan Draf" is invisible: `bg-gray-600` not compiled → transparent background with white text (measured). | Rendered with the intended `bg-gray-600` background and white text (`fa-save`). Alternative: replicate — rejected: an invisible working button. | Approved (D9) |
| DV-M16-28 | D-M16-29 | Candidate — empty control | S24 "Mengikut Kertas Peperiksaan" shows an empty "Kertas Peperiksaan" select. | **Rejected — replicate live.** The control works; no exam paper exists (data state). The list source is an open question (OQ-M16-11); the prototype lists none. | Rejected — replicate live |
| DV-M16-29 | D-M16-30 | Candidate — URL tolerance | S3 `?period=bogus` → all-time rows with no active pill. | **Rejected — replicate live.** Harmless tolerance of a hand-typed URL; no UI produces it. | Rejected — replicate live |
| DV-M16-30 | D-M16-31 | Broken page (input) | S28 `?week=bogus` → HTTP 500 "Ralat Pelayan". | An invalid `week` is ignored and the current week shows (as S20 ignores `?week=`). Alternative: 404 — rejected: an error for a harmless parameter. | Approved (D9, precedent "500 becomes handled") |
| DV-M16-31 | new (M07) | Wrong label (cross-module) | S1 PKSK levels read "Tahap 1 (Darjah 1-3)" / "Tahap 4 (Darjah 4-6)" for `T1` / `T4`, while M07 defines PKSK T1 / T4 as the entry tests for Tingkatan 1 / Tingkatan 4 and labels them "Tingkatan 1" / "Tingkatan 4" (M07 S7); "Tahap 4" does not exist in KSSR (Tahap 2 = Darjah 4–6). | Labels "Tingkatan 1" and "Tingkatan 4" (M07's wording), icons and values unchanged. Alternatives: (a) the M07 package names "PKSK Tingkatan 1 (SBP/MRSM)" — rejected: longer than needed; (b) replicate — rejected: contradicts M07. | Approved (D9) |
| DV-M16-32 | Q-M16-14 | D11 display constant | S3 subtitle "Ranking 10,218 sekolah seluruh Malaysia" while the M02 register has 10,220 schools (10,212 active). No M02 named query gives 10,218. | **DC-M16-01** = 10,218, a documented display constant (D11 exception): shown only in this subtitle, never next to a contradicting computed figure; M02 is asked for a definition (XR-M16-04); if M02 defines one, the constant is replaced by the query. **DC-M16-03** = the stored "Ketepatan" and "Skor" of the observed school standings (7 all-time rows and the 8082 September row): no battle field reproduces them; shown only in the S3 row, the S3 podium and the S4 card / period box of that school, never next to a contradicting computed figure; runtime battles add their increments to them (BR-M16-12). **DC-M16-02** (the 143 Jutawan counts of S19, no M04 objective-bank query reproduces them) is **retired in v1.4**: M04 v1.11 owns them as the separate `jutawanQuestions` store, S19 reads Q-JUT-COUNT and the game samples the same store (XR-M16-01 applied). Alternative: show Q-SCHOOLS 10,220 — rejected: changes an observed figure without evidence. | Approved (D11 exception) |
| DV-M16-33 | crawl | Error page | GET `/liga/sertai` → HTTP 500; GET `/permainan/roda-nasib/spin` → HTTP 405 (both are POST routes). | Both render the SPA 404 page (no page exists at these paths), as M15 DV-M15-08 for a 405. Alternative: replicate the raw 500/405 — rejected: broken pages. | Approved (D9, precedent) |
| DV-M16-34 | privacy | Personal data | Live shows real student and creator names on leaderboards, Battle Terkini, Pertandingan, the league creator line and opponent search. | Fictitious names only: token `<student:n>` → user 4300 + n (M02), `<student:51>` → the admin, tokens 59–63 → M17's persons (2022 and M17's 8082 week pupils), tokens 64–77 not seeded (XL3-16); the league 1 creator → user 4401. Same rule as M14/M15. | Approved (privacy rule) |
| DV-M16-35 | AUD-M16-02 | Contradictory rule | Live standings count a 0–0 battle as a **win for player B**: with that rule the observed battles reproduce 8090 9/0/9 (18 sides), 8082 September 4/0/4 (8 sides), 8880 2/0/1 and 2710 1/0/2, and 8106's single draw is its only non-zero tie (8830–8830); with "0–0 = seri" none of them match. The S4 list, however, colours by score only, so a 0–0 row shows no winner, and 8880's cards "2 Kemenangan" sit next to a list that reads 1 win, 1 undecided, 1 loss. | **One rule for both: 0–0 = win for player B.** The standings are computed with it (no observed standing changes) and the S4 list colours B's "0" green on the ten 0–0 rows. Alternatives: (a) 0–0 = seri everywhere — rejected: changes the observed M/S/K of 8090, 8082 (month), 8880, 2710 and more (at least 6 rows and their S4 cards); (b) replicate — rejected: the same page shows 2 wins next to a list with 1. Choice (a) of the audit, fewest visible changes (only the green colour of ten 0–0 rows). The runtime keeps the rule (INFERRED, PROPOSED). | Approved (D9) |
| DV-M16-36 | AUD-M16-02 | Contradictory values | S3 all time and S4 of 8082 show 40 battles, 20/0/20, 18 pupils (identical to 8078), while its "Battle Terkini" lists only 5 battles — fewer than the list maximum of 10, so they are its whole history (10 sides, 5/0/5, 4 pupils). | 8082 all time is computed from its 5 recorded battles: "Battle" 10, "M/S/K" 5/0/5, "Pelajar" 4; "Ketepatan" 29 % and "Skor" 367 stay (DC-M16-03), so the ranking order is unchanged. Alternatives: (a) generate 15 older battles — rejected: they would appear in the 10-row list, contradicting the observed 5 rows; (b) keep 40 as a display constant — rejected: the same page shows a complete list of 5. | Approved (D9 / D11) |
| DV-M16-37 | AUD-M16-08 | Layout breakage | S4 at 375 px: the "Battle Terkini" rows push the "{n} bulan yang lepas" span past the viewport; document `scrollWidth` 406 (8106), 392 (8090), 416 (8082) against 360 (audit). | The "Battle Terkini" list scrolls horizontally inside its card (NFR-RESP-05(b), no sticky column); the page never scrolls; 768 / 1280 unchanged. Alternative: truncate the names — rejected: hides observed text. | Approved (D9, precedent) |
| DV-M16-38 | XR-M16-10 (M16-T6 G4) | Contradictory values (cross-module) | S20 weekly ranking: live shows 90.7% (row 3) and 61.4% (row 4); the M05 practice store computes 93.5% for row 3. | Keep the computed values; no tuning of M05 or M16 data (D11). M05 seed reconciliation deferred to the M05 owner; E2E keeps the live targets as `test.fail`. | Approved (DL 2026-10-09; data deviation) |
| DV-M16-39 | M16-T6 G4 | Unreadable text | S23 hero title "Liga & Tournament" is dark on the violet gradient (≈2.7–2.9:1, below 3:1 for large text) while its subtitle and icon are white. | Title painted white; colour only. | Approved (D9) |
| DV-M16-40 | M16-T6 G4 | Unreadable text | S28 hero h1 and subtitle are white on the yellow-400→amber-500 gradient (≈1.5–2.2:1). | Text painted dark amber-brown; gradient and layout as live. | Approved (D9) |
| DV-M16-41 | M16-T3 G4 | Unreadable text | S3 and S4 hero titles are dark on the blue→violet / blue→indigo gradients (≈2.0–2.5:1). S1 (dark on red-orange, ≈3.4–4.8:1) is readable and stays as live. | S3 and S4 titles painted white; colour only. | Approved (D9; S1 rejected) |

**Working-but-odd behaviour that stays as live (not deviations):** `/battle` has no user-portal menu entry; `/battle/history` is not linked except its own "Mula Battle"; the whole S6 card is clickable; the S1 invitations request runs on every load; the SPM lock for non-T4/T5 accounts; the S1 timer changes only on each poll; S8–S12 "Tukar" is one-way while S7 has "← Guna auto"; S8–S12 room codes are not required while S7's is; Kad Memori cards are not reshuffled on the client; the Roda Nasib prize modal closes on an overlay click; the league invite code is visible to non-members; S25 "Batal" keeps the typed code; the S3 "#" column keeps the national rank under a state filter and the podium stays national; English words on live ("Battle Arena", "Quick Match", "Leaderboard", "Streak Avg", "MVP", "SNIPER!"); tab titles with and without "— PRESTASIPLUS"; S20 ignores `?week=`; S2 ignores `?period=`; `?darjah=5…11` works on the games although the picker lists Darjah 1–4; S28 has no week navigation control.

---

## 8. Out of scope

| Item | Owner / reason |
|---|---|
| `/ranking`, `/leaderboard` (academic rankings) | M08 |
| `/gamification/*`, the wallet, XP, tiers, `games_award_syiling`, coin ledger rows | M14 (M16 calls `onGameResult`) |
| `/peta-belajar` (Peta Pengembaraan card target) | M03 |
| `/practice` (S20 "Mula Latih Tubi") and the practice answer log | M05 |
| The parent "Cabaran Uji Minda" dashboard and the populated student Uji Minda | parent portal (owner to be assigned in TRACKER; OQ-M16-12) |
| Tournament brackets, groups, fixtures, schedules, live matches and results | not observable (Q-M16-4); only the PROPOSED read-only detail is built |
| League statuses between "Akan Datang" and "Tamat", member views, the hourly leaderboard job | not observable (Q-M16-5); stored standings are shown, no recompute |
| Weekly prize payout of Pertandingan Mingguan and the weekly Sekolah Bersaing job | not observable; seeded outputs only |
| Sambung Kata gameplay | broken on live (500), content not observable |
| Real-time transport (WebSocket), real opponents, real server scoring and anti-cheat | backend phase (SRS §11.1); the prototype simulates opponents (D4) |
| Global shells, notification bell, chatbot, header chips | global shell / M23, M22, M14 |

---

## 9. Open questions

1. **OQ-M16-01 Live run with test accounts (blocking G5 for the provisional parts).** The arena, every room, matchmaking results, invitations, the waiting card, forfeit, the tournament detail, the Jutawan game, the unlocked SPM battle, submit responses, a real spin, league create/join outcomes, tournament and settings saves were not observable. Every AC marked (provisional) stays provisional until a live run with two test student accounts and a teacher is approved.
2. **OQ-M16-02 Battle rules (Q-M16-1).** Question count (10), per-question time (15 s) and the speed-based points (500–1,000 per correct answer) are INFERRED from the observed scores (0–9,780; single-answer scores 800–966) and PROPOSED; the bot's accuracy is the M05 platform accuracy Q-ANS-CORRECT ÷ Q-ANS-ALL, read at mock start (82.84 % after M05 v1.10, XL batch 3).
3. **OQ-M16-03 Room games (Q-M16-2).** The six room pages, their boards and per-round mechanics are unobservable; the rebuild derives the rules from the lobby copy and builds a PROPOSED generic room; Benteng Ilmu damage (20 HP) and Kuiz Relay scoring are PROPOSED.
4. **OQ-M16-04 Unlocked SPM battle (Q-M16-3).** The SPM subject list for Tingkatan 4–5 is PROPOSED as the subjects of the M04 SPM pool.
5. **OQ-M16-05 Tournament lifecycle (Q-M16-4).** Who sees "Cipta Tournament Baru", the statuses after `registration`, when `ongoing` starts (the rebuild: at `registration_closes_at`), how schools register, brackets and live matches.
6. **OQ-M16-06 Jutawan game (Q-M16-7).** Prize ladder, the three lifelines (PROPOSED three uses of "50:50") and the level-to-coin table (M14 ledger shows "+50" and "+1,000" rows).
7. **OQ-M16-07 Roda Nasib (Q-M16-10).** The failure message (PROPOSED "Anda sudah spin hari ini.") and the daily reset time (INFERRED 00:00 MYT); whether the wheel counts as a "mini-game" for `games_award_syiling` (the rebuild: yes — one M14 rule for every M16 coin source; the admin's "0 Syiling dimenangkan" after 2 spins fits it).
8. **OQ-M16-08 Standings formulas.** School "Skor", "Ketepatan", "Pelajar"; student "Streak" and "Skor"; Papan Bijak "Skor"; Sekolah Bersaing ordering weights (discovery §5.6); league "Skor" / "Purata". Seeds keep the observed outputs; runtime increments use PROPOSED formulas (SRS BR-M16-12).
9. **OQ-M16-09 League status and hourly job.** Whether league statuses follow dates (DV-M16-11 keeps the stored status) and how the hourly leaderboard is computed.
10. **OQ-M16-10 Weekly prizes.** Whether and when "+100 / +50 / +25" syiling and the "badge istimewa" are paid (not built).
11. **OQ-M16-11 Exam papers.** Which store lists "Kertas Peperiksaan" on S24 (M06 mock exams? M04 papers?); empty as live.
12. **OQ-M16-12 Uji Minda owner.** The parent-portal module that owns "Cabaran Uji Minda" and the populated student view (TRACKER assignment).
13. **OQ-M16-13 "Tepat" definition.** 8 of the 20 observed Pertandingan rows cannot be Σ betul ÷ Σ answers (e.g. 187 at 90.7 %); the rebuild uses the mean of per-session accuracies (INFERRED), which every row can satisfy; M05 is asked to seed sessions that give the observed means (XR-M16-03).
14. **OQ-M16-14 Other roles.** Whether teachers, parents, school admins, PPD and JPN can play, create leagues and see S28 (INFERRED: every logged-in role, provisional).
15. **OQ-M16-15 PROPOSED items to report at G1 (complete list, v1.1):** header titles (DV-M16-01/02); PKSK labels (DV-M16-31); the 0–0 colour rule (DV-M16-35); the arena, room, tournament-detail and Jutawan-game layouts and copy ("Mula", "Tamatkan", result words "Menang" / "Seri" / "Kalah", "Kod Bilik: {code}", "Pusingan {n}/{total}", "🏆 {name} menang!", "Tahniah! Anda sampai L{n}.", lifeline "50:50"); the open-rooms chips; the S20 own-rank line "📊 Kedudukan kamu: #{rank} · {betul} betul"; the Roda Nasib refusal message "Anda sudah spin hari ini."; the flashes after tournament, league, join and settings saves (SRS §8.2); **all server validation messages V-M16-01…20** (SRS §5) incl. "Keputusan sudah dihantar." / "Keputusan tidak sah."; the league status label "Sedang Berlangsung"; the 24 h invitation expiry; the runtime standings formulas (skor += round(score ÷ 100), student ketepatan and streak, Papan Bijak skor 10 × correct + 50 for a win); the Jutawan difficulty schedule and coin ladder (L10 = 50, L15 = 1,000); the Papan Bijak wrong-answer move back and bonus / trap ±3; the Kuiz Relay speed bonus; the 8-word crossword; Benteng Ilmu 20 HP damage; Kad Memori coins = matches; the SIMULATION parameters — bot found on the 3rd poll, 10 s queue abandonment, 120 s server expiries, bot answer time 2–12 s, **bot accuracy = the M05 platform accuracy Q-ANS-CORRECT ÷ Q-ANS-ALL (82.84 % with M05 v1.10, read from the queries, not hard-coded)**, bots joining one per room poll; seed battle `correct = floor(score ÷ 500)`; the generated older battles of 8106, 8078, 8080 (SRS §6.11.1); SpinStats `lastSpinDate` 2026-09-24; the leagues' `gameMode` / `maxSchools`; the Sekolah Bersaing school placement; the anchors' grade (Tingkatan 4) and current schools.
16. **OQ-M16-16 Cross-module requests** (SRS §6.12): M04 (Jutawan store — applied, M04 v1.11 `jutawanQuestions`; game pools), M14 (result contract, XP rule, credited syiling), M05 (weekly ranking anchors and query), M02 (user anchors 4301–4377, 4401; school anchors 2710, 900; Sekolah Bersaing schools; 10,218), M11 (activity contract), M07 (confirm the level labels), global shell (mount the banner).
17. **OQ-M16-17 Discovery top-up TU-M16-01 (S28 earlier weeks) — Closed (v1.2).** The unstated cells were captured read-only (`docs/discovery/inventory/M16/_topup-2026-09-26.json`); three % Aktif cells were corrected to 0.0% (14 Sep position 21, 07 Sep position 20, 31 Aug position 20) and every other cell matched the seed; SRS §6.11.6 now holds only confirmed values.
