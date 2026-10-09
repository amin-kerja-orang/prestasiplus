# M16 — Battle, Games & Competitions — Software Requirements Specification

## 0. Document control

| Field | Value |
|---|---|
| Document | SRS — M16 Battle, Games & Competitions |
| Version | 1.6 |
| Date | 2026-09-26 |
| Status | **Approved (G1)** 2026-09-27 — audit round 2 PASS, together with the URS; v1.3 applies XL batch 3 round 1. v1.4 applies XL batch 3 round 2 (R2-07): XR-M16-01 applied (M04 v1.11 `jutawanQuestions`), no build-blocking item left. Every POST result, the arena, the rooms, the tournament detail and the Jutawan game are SOURCE-DERIVED, INFERRED or PROPOSED and provisional (URS OQ-M16-01); every behaviour of other players is a SIMULATION (decision D4). |
| Author | product-analyst (agent) for §1–§5, §8–§10, §12–§13; solution-architect (agent) for §6 data entities, datasets, seeds, simulation and cross-module contracts, §7 mock API, polling contract and repository contract, §11 |
| Source URS | [urs/M16-battle-games.md](../urs/M16-battle-games.md) v1.0 (FN-M16-n.n.n, 40 stories, AC-M16-nn.m) |
| Source discovery | [M16-battle-games.md](../../discovery/M16-battle-games.md), inventory `docs/discovery/inventory/M16/` (incl. `_snapshot-2026-09-26.json`), screenshots `docs/discovery/img/M16/` |
| Related | [M01](M01-authentication.md) (session, guard, 404 page, canonical accounts), [M02](M02-users-schools.md) v1.11 (users dataset §6.15 and id policy, schools dataset), [M03](M03-curriculum.md) (subjects 1–31, levels 1–11), [M04](M04-question-bank.md) v1.9 (`questions.*`, Q-ELIGIBLE, Q-SPM-POOL, PKSK rows), [M05](M05-practice.md) v1.8 (PracticeSession dataset §6.14, Q-SESS-USER, platform accuracy), [M06](M06-spm.md) (SPM subjects), [M07](M07-pksk.md) (15 domains, levels T1/T4), [M08](M08-student-performance.md) (not M16: `/ranking`, `/leaderboard`), [M11](M11-teacher-analytics.md) (BR-M11-04/05 "Battle" / "Permainan"), [M14](M14-gamification.md) (BR-M14-21, `onGameResult`, `settings.get('games_award_syiling')`, BR-M14-35 relative time), [design/shells.md](../../design/shells.md) (DV-SH-03; banner slot), [architecture/overview.md](../../architecture/overview.md) (§6.6 datasets, §6.7 repositories, §6.12 clock, §6.13 hooks, §10 shell contracts) |

**Change log**

| Version | Date | Change |
|---|---|---|
| 1.6 | 2026-09-27 | **M02 v1.23 change request XR-M02-01** (status stays Approved (G1)). The current M02 school / grade of the 22 no-class players changes: 4302–4310 at 9167 and 4311–4315, 4318, 4319, 4322–4324 at 9806 (Tingkatan 1–3, grades 7–9), 4325 at 2418 (Darjah 6); 4316 and 4317 stay no school, grade 10 (S2 monthly rows, DV-M16-26). Updated §6.11.1 (S4 colour line), §6.11.4 and XR-M16-04. Battle rows keep their stored battle-time school; S4 player-A colours stay `text-blue-600` (9167, 9806, 2418 are not listed schools; BR-M16-14 fit 47/47 unchanged); S2 weekly empty and monthly 4316 / 4317 unchanged; S3, S20, lobby standings, Papan Bijak Top 10 and leagues show no current school of these players. No observed value or stated count changes. |
| 1.5 | 2026-09-27 | **XL batch 3 round 3** (R3-02; status stays Approved (G1)). pelajarmaju (account 4) is at fixture school **900004 "SK Demo Bestari"** (M02 v1.16): §6.11.4 weekly-ranking rank 14 corrected (was 900002); no other M16 reference to account 4's school. Traceability 0 errors. |
| 1.4 | 2026-09-27 | **XL batch 3 round 2** (R2-07; status stays Approved (G1)). M04 v1.11 delivers the `jutawanQuestions` store (143 cells, Σ 149,911, Q-JUT-COUNT; `questions.jutawan.count / sample / get / gradeAnswer`, keyless `sample`): DC-M16-02 retired — the S19 counts are M04 named-query reads and Jutawan play samples and grades through that contract; XR-M16-01 **applied**, no longer build-blocking. M07 v1.7 BR-M07-26 alignment recorded: the token `pksk` is the M05 session mode, the M14 source and the M16 battle `questionType`; a PKSK battle stays an M16 Battle record (never an M05 session) and reads PKSK rows only through M04 (XR-M16-08 noted by M07). Traceability 0 errors. |
| 1.3 | 2026-09-27 | **XL batch 3 round 1** (`docs/qa/audit/cross-module-logic-M12-M18.md`; status stays Approved (G1)). XL3-16: §6.11.4 S20 at the project clock on M05 v1.10 Q-WEEK-RANK with M17 identities (2022, W2–W5), 4359–4377 dropped, ranks 6–20 inside M17 §6.7 B budgets (`wk.cjs`), XR-M16-03 rewritten, new XR-M16-09 to M17. XL3-17: Battle status `abandoned`; 168 battles (66 finished + 5 forfeited + 97 abandoned) and 47 seeded game results; Q-M17-BATTLES hosted as M16 named queries (§6.10, §7.2); standings unchanged (`stand.cjs`). XL3-18: §6.11.4 and XR-M16-04 per M02 v1.12 §6.15 D. XL3-26: #32 / #34 `canEarnSyiling` (M14 v1.3). XL3-25: BR-08 bot = M05 platform accuracy (82.84 %). XL3-27: E2E-73 pelajarmaju rank 14. XR-M16-01 accepted. Traceability 0 errors. |
| 1.2 | 2026-09-27 | **G1 approved** after audit round 2 (PASS). R2-01: S28 weeks 14 Sep / 07 Sep / 31 Aug seeded with the top-up TU-M16-01 values (`_topup-2026-09-26.json`; % Aktif 0.0% at 14 Sep pos 21, 07 Sep pos 20, 31 Aug pos 20), every "(TU)" mark removed, OQ-M16-17 / SQ-M16-07 closed. R2-I1: "4302 had no school at battle time" labelled INFERRED. XR-M16-01 (M04 Jutawan store) stays build-blocking for the XL batch 3 gate. Coverage 1,571/1,571; traceability 0 errors. |
| 1.1 | 2026-09-26 | **Audit round 1** (`docs/qa/audit/M16-audit.md`). AUD-01: §6.11.6 earlier weeks seeded as observed (top-up TU-M16-01 for unstated cells). AUD-02: BattleStanding is a computed view of the battle records (BR-M16-12 rewritten; 0–0 = win for B, DV-M16-35; generated older battles §6.11.1; 8082 all time DV-M16-36; Ketepatan / Skor = DC-M16-03). AUD-04: `segment_index` 0-based (BR-29, §6.6, #35, fixtures). AUD-05: exact failure handlers (FR-28/31/33/37, FN 5.2.2, §7.1, §8.1). AUD-06: `coinsEnabled` in #32 / #34 (BR-28, FR-92, XR-02). AUD-07: text sweep (FR-12, E2E-12). AUD-08: S4 in-card scroll (DV-M16-37, §10, FR-13, E2E-13). AUD-09: menu colours (XR-06). AUD-10: XR-04 inactive 8880 / 2710 (M18). AUD-11: XR-07 impact on M14. AUD-12: XR-01 build-blocking. I1: bot accuracy read from M05 (BR-08). I4: SEC-M16-11. Traceability re-run 0 errors. |
| 1.0 | 2026-09-26 | First issue. M16 owns battles, queues, invitations, battle and game standings, rooms, game sessions, spins, tournaments, leagues, the Sekolah Bersaing weekly snapshots, the game settings and the **tournament banner contract** (§6.13). 14 owned entities; 52 mock endpoints incl. the 13 live `/api/battle/*` endpoints and their polling contract; repository contract; FRs, BRs, E2E and SEC items per §3–§12; traceability checked by script (§3.1). |

### 0.1 Fidelity deviations referenced here

URS §7 is authoritative. Approved fixes: DV-M16-01 (header titles), 02 (`/sekolah-bersaing` in the user shell), 26 (student standings computed), 35 (0–0 = win for B, list colour), 36 (8082 all time from its records), 37 (S4 list scrolls in its card), 03 (Sambung Kata handled 500), 04 (S2 pills work), 06 (Cabaran Masuk opens itself), 07 (room flash at the top), 09 (podium = table rows 1–3), 10 (S4 period boxes from S3 standings), 12 (BM enum labels), 13 (S27 table scrolls in its card), 14 (Papan Bijak chip from the standings), 15 (admin card "2-6 pemain"), 17 (week ends in MYT), 18 (no game under the picker), 20 (quick-match error visible), 23 (syiling shown = syiling credited), 24 (text ≥ 12 px), 27 ("Simpan Draf" visible), 30 (invalid `week` ignored), 31 (PKSK labels "Tingkatan 1/4"), 32 (DC-M16-01 10,218), 33 (405/500 GET routes → 404), 34 (fictitious names). Rejected — replicate live: DV-M16-05, 08, 11, 16, 19, 21, 22, 25, 28, 29.

Documented data deviation (DL decision 2026-10-09): **DV-M16-38** — S20 Pertandingan weekly ranking shows the values **computed** from the M05 practice store (row 3 = 93.5%); live shows 90.7% (row 3) and 61.4% (row 4). No tuning of M05 or M16 values (D11). The M05 seed reconciliation is deferred to the M05 owner (TRACKER XR-M16-10, not blocking); E2E keeps the live targets as `test.fail`.

Deferred (release 1.0 = student scope): S24 `/tournament/admin/create` and the other admin/seller tournament screens. The admin-only "Cipta Tournament Baru" link on S23 stays as observed and resolves only once S24 is built (TRACKER XR-M16-11; not a D9 fix, does not block L28).

---

## 1. Scope

The M16 prototype implements, against the mock service layer, the 30 screens of URS §1, the global tournament banner and the provisional arena, room, tournament-detail and Jutawan-game pages. M16 owns (D12): battles and their queues, invitations and arena answers; the student and school battle standings per period; game rooms and their players; the per-game standings (lobby leaderboards, Papan Bijak Top 10); single-player game sessions, personal bests and Jutawan stats; Roda Nasib spins; tournaments; leagues, their schools and standings; the weekly Sekolah Bersaing snapshots; the game settings (`boardgame_quiz_tiles`); the tournament banner contract. M16 reads users and schools (M01/M02), subjects and levels (M03), questions (M04), practice sessions (M05, weekly ranking) and PKSK domains (M07); it changes wallets only through M14 (`onGameResult`).

**Simulation (D4).** Live has no WebSocket, SSE or Echo channel. The prototype keeps every observed polling contract and replaces other people with deterministic bots (§4 BR-M16-05, BR-M16-08, BR-M16-19). Every simulated value is marked SIMULATION; its assertions are provisional.

**Out of scope:** URS §8 — M08 rankings, M14 screens and ledger rules, M03 Peta Belajar, M05 practice, the parent Uji Minda side, tournament brackets/fixtures/live matches, league lifecycle jobs, prize payouts, Sambung Kata gameplay, real realtime transport and server anti-cheat (the backend phase, §11.1).

---

## 2. Screens & routes

| # | Route | Screen | Primary actor(s) | Shell · header / tab title | API (§7) |
|---|---|---|---|---|---|
| S1 | `/battle` | Battle Arena lobby | All logged-in | SHU · "Battle Arena" / "Battle Arena" | #2–#13, #15 |
| — | `/battle/arena/:uuid` | Arena (provisional) | Battle players | SHU · "Battle Arena" / "Battle Arena" | #14, #16, #17 |
| S2 | `/battle/leaderboard` | Student battle ranking | All | SHU · "Ranking Pelajar Battle" / same | #18 |
| S3 | `/battle/ranking-sekolah` (`?period=&state=`) | School ranking | All | SHU · "Papan Ranking Sekolah" / same | #19 |
| S4 | `/battle/ranking-sekolah/:id` | School detail | All | SHU · "{sekolah}" / "{sekolah}" | #20 |
| S5 | `/battle/history` | Battle history | All | SHU · "Sejarah Battle" / same | #21 |
| S6 | `/permainan` | Games hub | All | SHU · "Zona Permainan" / "Permainan — PRESTASIPLUS" | #22 |
| S7 | `/papan-bijak` | Papan Bijak lobby | All | SHU · "Papan Bijak" / "Papan Bijak — PRESTASIPLUS" | #23–#25, #29–#31 |
| S8–S12 | `/perang-fakta`, `/benteng-ilmu`, `/perlumbaan-matematik`, `/kuiz-relay`, `/teka-silang-kata` | Lobbies | All | SHU · "{Game}" / "{Game} — PRESTASIPLUS" | #23–#25 |
| — | `/papan-bijak/:code`, `/{game}/:code` | Rooms (provisional) | Room players | SHU · "{Game}" / "{Game} — PRESTASIPLUS" | #26–#28 |
| S13–S17 | `/permainan/betul-salah`, `/cabaran-kilat`, `/tembak-jawapan`, `/susun-jawapan` (`?darjah=`), `/permainan/kad-memori` | Single-player games | All | SHU · game title / live tab title | #32, #33 |
| S18 | `/permainan/roda-nasib` | Roda Nasib | All | SHU · "Roda Nasib" / "Roda Nasib — PRESTASIPLUS" | #34, #35 |
| S19 | `/permainan/jutawan` (`?darjah=`) | Jutawan Ilmu | All | SHU · "Jutawan Ilmu" / "Jutawan Ilmu 💰 — PRESTASIPLUS" | #36 |
| — | `/permainan/jutawan/main` (`?subject=&darjah=`) | Jutawan game (provisional) | All | SHU · "Jutawan Ilmu" / same | #37–#39 |
| S20 | `/permainan/pertandingan` | Weekly competition | All | SHU · "Pertandingan Mingguan" / live tab | #40 |
| S21 | `/permainan/uji-minda` | Uji Minda | All | SHU · "Uji Minda" / "Uji Minda — Belum Ada Cabaran" | #41 |
| S22 | `/permainan/sambung-kata` | handled error page (DV-M16-03) | All | standalone 500 page | — |
| S23 | `/tournament` | Tournament list | All | SHU · "Liga & Tournament" / same | #42 |
| S24 | `/tournament/admin/create` | Create tournament | Admin | SHU · "Cipta Tournament Baru" / "Cipta Tournament" | #43, #44 |
| — | `/tournament/:uuid` | Tournament detail (provisional) | All | SHU · "{title}" / "{title}" | #45 |
| S25 | `/liga` | League list | All | SHU · "Liga Pertandingan" / same | #46, #48 |
| S26 | `/liga/cipta` | Create league | All (INFERRED) | SHU · "Cipta Liga Pertandingan" / "Cipta Liga" | #47 |
| S27 | `/liga/:id` | League detail | All | SHU · "{nama}" / "{Jenis} · {Skop}" (BM) | #49, #48 |
| S28 | `/sekolah-bersaing` (`?week=`) | Weekly school board | All | SHU · "Sekolah Bersaing" / "Sekolah Bersaing — Leaderboard Mingguan" | #50 |
| S29 | `/admin/permainan` | Game settings | Admin | SHA · "🎮 Tetapan Permainan" / "Permainan - Admin Panel" | #51, #52 |
| S30 | every user-portal page | Tournament banner | All | first child of `<main>` | #1 |

Header subtitles: S1–S5, S23–S27, S29 as URS FN-M16-1.1.3; S6–S21 and S28 "Selamat datang kembali" (DV-M16-01/02). `{id}` values are integers (M02 school ids, league ids); battle and tournament ids are UUIDs (`uuid('m16:battle')` / `uuid('m16:tournament')`); room codes are 6 characters. Query names keep the live names (`period`, `state`, `darjah`, `week`, `subject`).

---

## 3. Functional requirements

Column "FN" lists URS Functions (prefix `FN-M16-` omitted); column "AC" lists URS acceptance criteria (prefix `AC-M16-` omitted). SHALL statements about SIMULATION or PROPOSED behaviour are provisional.

| ID | Requirement | FN | AC |
|---|---|---|---|
| FR-M16-01 | The user-portal nav definition SHALL contain the M16 entries of URS FN-M16-1.1.1 in live order (sidebar, drawer, bottom nav "Game"), with no entry to `/battle`. | 1.1.1 | 01.1 |
| FR-M16-02 | The admin-panel nav definition SHALL contain the group "Battle & Permainan" (section key `battle`) with its four links, the "Lagi" subset "Battle Live" / "Tetapan Permainan", and "Sekolah Bersaing" in "✨ Visi & Pertandingan"; links to user-portal routes open them in the user shell. | 1.1.2 | 01.2 |
| FR-M16-03 | Each M16 route SHALL declare the header title and subtitle of URS FN-M16-1.1.3 (route meta, DV-SH-03): live values on S1–S5, S23–S27, S29; page titles with "Selamat datang kembali" on S6–S21 and S28 (DV-M16-01/02); S4 and S27 titles from the loaded record; S27 subtitle "{type label} · {scope label}" in BM (DV-M16-12); S3 subtitle "Ranking {DC-M16-01} sekolah seluruh Malaysia". | 1.1.3 | 01.3, 01.4 |
| FR-M16-04 | Each M16 route SHALL set the exact tab title of URS FN-M16-1.1.4 and the shell of FN-M16-1.1.5 (SHU for S1–S28 and the provisional pages, SHA for S29). | 1.1.4, 1.1.5 | 01.5, 01.6 |
| FR-M16-05 | Every M16 route SHALL require a session (guest → `/login`); S24 and S29 SHALL require role `admin` (others → their M01 landing page); every endpoint SHALL answer 401 without a session and 403 `FORBIDDEN` for a wrong role (BR-M16-01). | 1.2.1, 1.2.2 | 02.1, 02.2 |
| FR-M16-06 | The router SHALL render the M01 404 page for the not-found outcomes of URS FN-M16-1.2.3, including `/liga/sertai` and `/permainan/roda-nasib/spin` (DV-M16-33). | 1.2.3 | 02.3, 02.4 |
| FR-M16-07 | Query parameters SHALL be tolerated as URS FN-M16-1.2.4 (S2 `period` ignored, S3 unknown `period` → all time without an active pill, S20 `week` ignored, games `darjah` 1–11, S28 `week` normalised to Monday and invalid values ignored). | 1.2.4 | 02.5 |
| FR-M16-08 | The global user shell SHALL mount `<TournamentBanner>` as the first child of the content area on every user-portal page (not on admin-panel pages); on mount it SHALL call `GET /api/tournament/active` once, keep an empty list on any failure without a message, and render nothing while the list is empty (§6.13). | 1.3.1, 1.3.5 | 03.1, 03.4 |
| FR-M16-09 | For an item with `status = 'registration'` and no `live_match` the banner SHALL render the indigo card with `fa-trophy`, the title, "Pendaftaran dibuka" and the badge "DAFTAR", linking to `/tournament/{uuid}`. | 1.3.2 | 03.2 |
| FR-M16-10 | For other items the banner SHALL render "Sedang berlangsung" without a badge, or, when `live_match` is set, the red card with `fa-broadcast-tower`, the pulsing dot, "LIVE: {school_a} vs {school_b}" and the pulsing "MAIN" badge; several items stack in response order. | 1.3.3, 1.3.4, 1.3.5 | 03.3 |
| FR-M16-11 | `GET /api/tournament/active` SHALL list exactly the tournaments whose status is `registration` or `ongoing` (BR-M16-38), so a tournament opened for registration appears on every user page and a draft never does. | 1.3.5 | 03.5 |
| FR-M16-12 | Every visible M16 text node that live renders below 12 px SHALL render at 12 px (the list of URS FN-M16-1.4.1 and any other, DV-M16-24). | 1.4.1 | 04.1 |
| FR-M16-13 | Every M16 screen SHALL have no horizontal page scroll from 320 px; the S2, S3, S7 and S27 tables and the S4 "Battle Terkini" list SHALL scroll inside their card below 768 px without a sticky column (DV-M16-13, DV-M16-37); §10 per screen. | 1.4.2 | 04.2 |
| FR-M16-14 | Every person shown by M16 SHALL be read by user id from the M02 users dataset (fictitious anchors of §6.11); no live name SHALL appear in code, fixtures or screenshots (DV-M16-34). | 1.4.3 | 04.3 |
| FR-M16-15 | Bots, matchmaking timings, room players, spin results and game payloads SHALL be drawn from the named PRNG streams of BR-M16-05/19/25/29, so identical ids and seed give identical outcomes. | 1.4.4 | 04.4 |
| FR-M16-16 | S1 SHALL render the hero and the type row (Biasa default, PKSK) of URS FN-M16-2.1.1–2.1.2 from `GET /api/battle/lobby` (§7 #15). | 2.1.1, 2.1.2 | 05.1 |
| FR-M16-17 | The "Biasa" panel SHALL render the 7 core subject tiles and the toggle "Lagi 24 subjek lain" / "Tutup" revealing subjects 8–31 with the icons and colours of discovery A.1; one subject can be selected (`border-red-500 bg-red-50 shadow-md`). | 2.1.4 | 05.1, 05.2 |
| FR-M16-18 | For a viewer with grade below 10 the "SPM" button SHALL render locked and only toggle the tooltip "Khas untuk pelajar Tingkatan 4 & 5 sahaja" (closed on an outside click). | 2.1.3 | 05.3 |
| FR-M16-19 | The "PKSK" panel SHALL render the 15 M07 domains and the level buttons "Tingkatan 1" (`T1`) / "Tingkatan 4" (`T4`) (DV-M16-31); `canStart` SHALL follow BR-M16-03 and enable the three mode buttons. | 2.1.5, 2.1.6 | 05.2, 05.4 |
| FR-M16-20 | For a viewer with grade 10 or 11 the "SPM" button SHALL be enabled and show the subjects with Q-SPM-POOL > 0 as tiles (PROPOSED layout). | 2.1.7 | 05.5 |
| FR-M16-21 | S1 SHALL link "Ranking Pelajar" → `/battle/leaderboard` and "Ranking Sekolah" → `/battle/ranking-sekolah`. | 2.1.8 | 05.6 |
| FR-M16-22 | The "Keterlihatan Barisan" switch SHALL toggle `open_to_all` and its texts "Hanya pelajar gred sama boleh match" / "Semua gred boleh nampak & mohon sertai anda", "Gred Saya" / "Terbuka". | 2.2.1 | 06.1 |
| FR-M16-23 | "Quick Match" and "Battle Sekolah" SHALL post the match parameters to §7 #2 / #3 and "Cabar Kawan" SHALL open the modal; all three are disabled until `canStart`, and the two posting buttons also while a request runs. | 2.2.2 | 05.1, 06.2 |
| FR-M16-24 | While searching, S1 SHALL show the searching card of URS FN-M16-2.2.3; "Batal" SHALL reset the page state and send no request (DV-M16-05). | 2.2.3 | 06.2, 06.4 |
| FR-M16-25 | The client SHALL poll §7 #4 every 3 s, update the timer text on each poll, and apply the status handling, the 120 s timeout and the 5-consecutive-error rule of §7.1 with their exact messages. | 2.2.4 | 06.2, 06.5 |
| FR-M16-26 | Start failures SHALL show the error banner with `data.error`, `data.message` or "Ralat dari server. Sila cuba lagi." ("Respon tidak dijangka. Sila cuba lagi.", "Ralat rangkaian. Sila semak internet anda." as §7.1); the close button clears it. | 2.2.5 | 06.6 |
| FR-M16-27 | A `matched` answer SHALL navigate to `/battle/arena/{battle_uuid}`; the mock SHALL simulate matchmaking per BR-M16-05 (bot on the 3rd poll; abandoned queues never matched) with the test hooks of §6.14. | 2.2.6, 2.2.7 | 06.3, 06.4 |
| FR-M16-28 | On `incoming_challenge` the searching card SHALL become "Cabaran Masuk!" with the challenger's name, grade, school and "Terima" / "Tolak" posting §7 #5 / #6; polling continues after "Tolak"; a `data.error` answer clears the card and shows the error banner, a network failure the banner "Ralat rangkaian.". | 2.3.1 | 07.1, 07.2 |
| FR-M16-29 | The waiting card and `requestJoinQueue` (§7 #12, #13) SHALL exist but no UI control SHALL start them (DV-M16-06); the hook `battleWaiting` reaches the card and its three messages. | 2.3.2 | 07.3 |
| FR-M16-30 | The "Cabar Kawan" modal SHALL search §7 #7 after 300 ms of typing from 2 characters and render results or "Tiada pelajar dijumpai"; an overlay click closes it. | 2.4.1 | 08.1 |
| FR-M16-31 | A click on a result SHALL post §7 #8 with the match parameters and `receiver_id`, close the modal and, on success, alert "Cabaran berjaya dihantar kepada {name}!"; a non-success answer does nothing more; a network failure alerts "Ralat menghantar cabaran.". | 2.4.2 | 08.2 |
| FR-M16-32 | S1 SHALL load §7 #9 on every visit and open the "Cabaran Masuk" modal automatically when the list is not empty (DV-M16-06); the empty text is "Tiada cabaran buat masa ini". | 2.4.3 | 08.3, 08.4 |
| FR-M16-33 | "Terima" / "Tolak" of an invitation SHALL post §7 #10 / #11; accept opens the arena on success, does nothing on a non-success answer and alerts "Ralat." on a network failure; decline removes the row after the request completes and fails silently. | 2.4.4 | 08.4 |
| FR-M16-34 | `/battle/arena/:uuid` SHALL load §7 #16 for a player of that battle (else the 404 page) and render the PROPOSED arena of URS FN-M16-2.5.1. | 2.5.1 | 09.1 |
| FR-M16-35 | The arena SHALL apply BR-M16-07 (10 questions, 15 s, 1000 − round(500 × s ÷ 15) per correct answer) through §7 #17. | 2.5.2 | 09.2 |
| FR-M16-36 | The mock SHALL answer for the bot per BR-M16-08 and return its answer and score with each of the viewer's answers. | 2.5.3 | 09.2 |
| FR-M16-37 | "Tamatkan" SHALL `confirm("Tamatkan battle ini? Anda akan dikira kalah.")` and post §7 #14, reload after any response (a `data.error` is ignored) and alert "Ralat. Sila cuba lagi." on a network failure; the reloaded arena shows the loss. | 2.5.4 | 09.3 |
| FR-M16-38 | A finished battle SHALL show "Menang" / "Seri" / "Kalah", both scores and the two links, and SHALL be written per BR-M16-10 and BR-M16-12 and reported to M14 (BR-M16-28). | 2.5.5 | 09.4 |
| FR-M16-39 | S5 SHALL render the empty card of URS FN-M16-2.6.1 when the viewer has no finished battle (§7 #21). | 2.6.1 | 10.1 |
| FR-M16-40 | S5 SHALL list the viewer's finished battles newest first in the S4 row format (PROPOSED). | 2.6.2 | 10.2 |
| FR-M16-41 | S2 SHALL render the pills (Mingguan default) and the 7-column table from §7 #18 for the active period, with the empty row text; switching the pill reloads the period (DV-M16-04). | 3.1.1, 3.1.2 | 11.1, 11.2 |
| FR-M16-42 | S2 rows SHALL show rank, name, school at battle time, "m/s/k", "{n}%", streak and score of the student standings computed from the battle records (BR-M16-12; monthly seed rows 4316, 4317, DV-M16-26). | 3.1.3 | 11.3 |
| FR-M16-43 | S3 SHALL render the hero, the three period links (keeping `state`) with the active pill and the empty text from §7 #19. | 3.2.1, 3.2.2 | 12.1 |
| FR-M16-44 | S3 SHALL list the school standings of the period — "Battle", "M/S/K", "Pelajar" computed from the battle records, "Ketepatan" and "Skor" stored (BR-M16-12, DC-M16-03; 8082 all time DV-M16-36) — filtered by state, ordered per BR-M16-13, with "#" = the national rank, the school link, "{negeri} · {SK\|SMK}" and "m/s/k". | 3.2.5 | 12.2, 12.3, 12.5 |
| FR-M16-45 | S3 SHALL render the podium from rows 1–3 of the national ranking of the period (DV-M16-09), unfiltered by state, only when rows exist. | 3.2.4 | 12.3, 12.4 |
| FR-M16-46 | The state select SHALL list "Semua Negeri" + 16 states, preload the query and navigate to `?period={current}&state={value}` on change. | 3.2.3 | 12.4 |
| FR-M16-47 | S4 SHALL render the hero and the four cards from the school's computed all-time standing and stored "Ketepatan" (zeros without battles) for every M02 school (§7 #20). | 3.3.1, 3.3.2 | 13.1, 13.4 |
| FR-M16-48 | S4 "Minggu Ini" / "Bulan Ini" SHALL read the weekly / monthly standing and its S3 rank, or the empty texts (DV-M16-10). | 3.3.3 | 13.2 |
| FR-M16-49 | S4 SHALL render "Pejuang Terbaik Minggu Ini" and "Battle Terkini" per BR-M16-14 (last 10 battles; A colour by current school; winner green incl. B on 0–0, DV-M16-35; relative time BR-M16-37; in-card scroll at 375 px, DV-M16-37). | 3.3.4, 3.3.5 | 13.3, 13.4, 13.6 |
| FR-M16-50 | S4 SHALL render the 404 page for an id that is not an M02 school. | 3.3.6 | 13.5 |
| FR-M16-51 | S6 SHALL render the header and the open-rooms strip (empty text when Q-OPEN-ROOMS = 0; PROPOSED room chips otherwise) from §7 #22. | 4.1.1, 4.1.2 | 14.1, 14.5 |
| FR-M16-52 | S6 SHALL render the 18 cards of discovery A.3 in live order with their badges (and badge colours), emojis, texts, chips and buttons; the whole card and its button navigate to the card route. | 4.1.3, 4.1.5, 4.1.6, 4.1.7, 4.1.8, 4.1.9, 4.1.10, 4.1.11 | 14.2, 14.4 |
| FR-M16-53 | The Papan Bijak and Battle Arena cards SHALL show "🆕 Belum main lagi" / "🆕 Belum battle lagi" only while the viewer has no Papan Bijak game / no battle (DV-M16-14). | 4.1.4 | 14.3 |
| FR-M16-54 | S7 SHALL render the hero and the create form's subject and grade controls (auto box from the profile, "Tukar", select with optgroups, "← Guna auto"). | 5.1.1, 5.1.2 | 15.1, 15.2 |
| FR-M16-55 | S7 "Siapa Boleh Join?" SHALL relabel `same_level` by the chosen grade, show "Dari" / "Hingga" for `custom`, and offer "Maks Pemain" 2–6 (default 4). | 5.1.3 | 15.1, 15.3 |
| FR-M16-56 | S7 "🔑 Masuk Bilik" SHALL require a room code (native bubble), accept at most 6 characters and post §7 #25. | 5.1.4 | 15.4 |
| FR-M16-57 | "🎲 Cipta Bilik" SHALL post §7 #24 and open `/papan-bijak/{code}`. | 5.1.3 | 15.5 |
| FR-M16-58 | S7 SHALL render "Cara Bermain:" with the five live lines. | 5.1.5 | 15.6 |
| FR-M16-59 | "Cari Lawan Auto" SHALL post §7 #29, count "Mencari lawan... {n}s" each second, poll §7 #30 every 3 s (matched → room; expired → error; cancelled → idle) and cancel through §7 #31; the mock matches per BR-M16-24. | 5.2.1, 5.2.2 | 16.1, 16.2 |
| FR-M16-60 | The quick-match error SHALL stay visible below the button until the next search (DV-M16-20). | 5.2.3 | 16.3 |
| FR-M16-61 | S7 SHALL render the Top 10 of BR-M16-22 (medals, initials, 15-character truncation, Kadar pill colours) from §7 #23. | 5.3.1 | 17.1, 17.2 |
| FR-M16-62 | S8–S12 SHALL render their hero, subtitle and rule line (URS FN-M16-5.4.1). | 5.4.1 | 18.1 |
| FR-M16-63 | S8–S12 "🏠 Cipta Bilik Baru" SHALL render subject, one-way "Tukar" grade select, "Siapa boleh join?" and the game's button, and post §7 #24. | 5.4.2 | 18.2 |
| FR-M16-64 | S8–S12 "🔑 Masuk Dengan Kod" SHALL show the code upper case, not require it, and post §7 #25; an unknown code returns to the lobby with the flash. | 5.4.3 | 18.3, 18.6 |
| FR-M16-65 | S8–S12 "🏆 Pendahulu" SHALL list up to 10 standings of the game (value desc, stable ties; "{n} menang" or "{n} kali MVP"). | 5.4.4 | 18.4 |
| FR-M16-66 | `/{game}/{unknown code}` for S8–S12 SHALL redirect to the lobby and render "Bilik tidak dijumpai." at the top of the content (DV-M16-07). | 5.4.5 | 18.5 |
| FR-M16-67 | Room creation and join SHALL follow BR-M16-18 (code, status, capacity, grade fit). | 5.5.1 | 19.1 |
| FR-M16-68 | The room page SHALL poll §7 #26 every 3 s and render the PROPOSED waiting room; bots join per BR-M16-19; the host starts through §7 #27. INFERRED (M16-T4 G4, 2026-10-09): opening a room link as a non-player calls the join endpoint first (same grade, capacity and status checks as BR-M16-18), so the hub strip chips resolve; a refused join follows the unknown-room path. Round and game clocks come from the server view (`roundSecondsLeft`, `secondsLeft`) and expired time is resolved on poll, so a reload never restarts a clock. | 5.5.2 | 19.1 |
| FR-M16-69 | Room play SHALL follow the per-game rules of BR-M16-20 through §7 #28, using `boardgame_quiz_tiles` for Papan Bijak. | 5.5.3 | 19.2, 19.4 |
| FR-M16-70 | A finished room SHALL show the winner and points, set status `finished` and update the game standings per BR-M16-21, and report each player to M14. | 5.5.4 | 19.3 |
| FR-M16-71 | S13–S16 and S19 SHALL show the darjah picker without `?darjah` and start nothing until a darjah is chosen (DV-M16-18); the list is Darjah 1–4 and "← Kembali ke Hub" (DV-M16-19). | 6.1.1 | 20.1, 20.2, 20.3 |
| FR-M16-72 | S13 SHALL run the 3-2-1 countdown (800 ms steps) before playing. | 6.2.1 | 21.1 |
| FR-M16-73 | S13 playing SHALL render the kombo badge, the bar, "Kenyataan {n}", the statement, ❌ / ✅ and the legend, with 700 ms feedback. | 6.2.2 | 21.2 |
| FR-M16-74 | S13 SHALL score per BR-M16-26 (45 s, 40 statements). | 6.2.3 | 21.2, 21.3 |
| FR-M16-75 | S13 SHALL render the result of URS FN-M16-6.2.4, with "🏆 REKOD BARU!" when `is_new_record`. | 6.2.4 | 21.3, 21.4 |
| FR-M16-76 | S14 SHALL run the countdown and render the playing view of URS FN-M16-6.3.1–6.3.2 (difficulty chip, options, 400 ms step). | 6.3.1, 6.3.2 | 22.1, 22.2 |
| FR-M16-77 | S14 SHALL score per BR-M16-26 (60 s, 30 MCQ, combo multiplier). | 6.3.3 | 22.2 |
| FR-M16-78 | S14 SHALL render the result of URS FN-M16-6.3.4. | 6.3.4 | 22.3 |
| FR-M16-79 | S15 SHALL run the countdown and render the HUD, the fall zone with "⚠ GARIS MAUT" and the level-up banner. | 6.4.1, 6.4.2 | 23.1, 23.2 |
| FR-M16-80 | S15 SHALL apply the fall timing, lives and level rules of BR-M16-26. | 6.4.3 | 23.2, 23.3 |
| FR-M16-81 | S15 SHALL render the result of URS FN-M16-6.4.4. | 6.4.4 | 23.3 |
| FR-M16-82 | S16 SHALL render the header, progress dots and puzzle area of URS FN-M16-6.5.1–6.5.2. | 6.5.1, 6.5.2 | 24.1 |
| FR-M16-83 | S16 SHALL provide check, next, retry, skip and tile removal per URS FN-M16-6.5.3. | 6.5.3 | 24.2, 24.3 |
| FR-M16-84 | S16 SHALL check and score per BR-M16-26 (trim, case-insensitive, points). | 6.5.4 | 24.2 |
| FR-M16-85 | S16 SHALL render the result of URS FN-M16-6.5.5. | 6.5.5 | 24.4 |
| FR-M16-86 | S17 SHALL render the header and the up-counting stats of URS FN-M16-6.6.1. | 6.6.1 | 25.1 |
| FR-M16-87 | S17 SHALL render the 12 cards and the flip, match and 800 ms mismatch behaviour. | 6.6.2 | 25.2 |
| FR-M16-88 | S17 SHALL submit on completion and read `results.syiling_earned` and `results.accuracy` (BR-M16-26). | 6.6.3 | 25.3 |
| FR-M16-89 | S17 SHALL render the result overlay, which an outside click does not close. | 6.6.4 | 25.3 |
| FR-M16-90 | §7 #32 SHALL create a game session and return the SOURCE payload of the game from M04 per BR-M16-25, with the viewer's personal best. | 6.7.1 | 26.1 |
| FR-M16-91 | §7 #33 SHALL validate and store the result once (409 on a repeat), set `is_new_record` per BR-M16-27 and return `syiling_awarded`. | 6.7.2 | 21.4, 26.2 |
| FR-M16-92 | Every syiling figure of a game SHALL show the credited amount (BR-M16-28, DV-M16-23): in-play counters use `canEarnSyiling` of §7 #32 / #34 (M14 `canEarnSyiling(userId)`; the computed amount when true, else 0); result tiles, the Roda Nasib modal and the coin-fly use the returned `coinsCredited`; the coin-fly plays only when it is above 0. | 6.7.3 | 26.3, 26.4 |
| FR-M16-93 | S18 SHALL render the header, the two chips, the canvas wheel and the three button states from §7 #34. | 7.1.1, 7.1.2 | 27.1 |
| FR-M16-94 | "🎯 SPIN!" SHALL post §7 #35; the mock picks the segment per BR-M16-29, the wheel turns 4.2 s, and a second spin the same MYT day is refused. | 7.1.3 | 27.2, 27.5 |
| FR-M16-95 | The prize modal SHALL show icon and label, "+{n} Syiling" / "Ditambah ke akaun kamu!" only for a credited amount, "Jangan risau, cuba lagi esok!" for `nothing`, and "Tutup". | 7.1.4 | 27.3, 27.4 |
| FR-M16-96 | S19 SHALL render the header, the stats "L{n}" / games / "1,000🪙" and the hint of URS FN-M16-7.2.1 from §7 #36. | 7.2.1 | 28.1 |
| FR-M16-97 | S19 with `?darjah` SHALL list the subjects and counts of Q-JUT-COUNT for that grade with "(DARJAH n)" / "(TINGKATAN n−6)". | 7.2.2 | 28.2, 28.3 |
| FR-M16-98 | The provisional Jutawan game SHALL follow BR-M16-30 through §7 #37–#39 and update the S19 stats. | 7.2.3 | 28.4, 28.5 |
| FR-M16-99 | S20 SHALL render the header, the week label and the MYT countdown of BR-M16-31 (60 s refresh, "Tamat!", "-" before the first tick) (DV-M16-17). | 7.3.1 | 29.1, 29.2 |
| FR-M16-100 | S20 SHALL render the three prize cards in 3 columns at every width. | 7.3.2 | 29.3 |
| FR-M16-101 | S20 SHALL render the own-status card for a viewer without a session this week, or the PROPOSED rank line otherwise. | 7.3.3 | 29.4, 29.6 |
| FR-M16-102 | S20 SHALL list the top 20 of Q-WEEK-RANK with medals, sessions, correct and accuracy (BR-M16-31). | 7.3.4 | 29.5 |
| FR-M16-103 | S21 SHALL render the empty Uji Minda page of URS FN-M16-7.4.1 (§7 #41 returns no challenge). | 7.4.1 | 30.1 |
| FR-M16-104 | `/permainan/sambung-kata` SHALL render the handled 500 page (DV-M16-03). | 7.5.1 | 31.1 |
| FR-M16-105 | S23 SHALL render the hero and, for admins only, "Cipta Tournament Baru". | 8.1.1, 8.1.2 | 32.1 |
| FR-M16-106 | S23 SHALL list the active tournaments of §7 #42 (PROPOSED cards) or "Tiada tournament aktif buat masa ini.". | 8.1.3 | 32.1, 32.2 |
| FR-M16-107 | S24 "Maklumat Asas" SHALL render title, description and education level with their live options. | 8.2.1 | 33.1 |
| FR-M16-108 | S24 "Format" SHALL render the four radio cards (Hibrid default) and show "Bilangan Kumpulan" (2, 2–8) only for league / hybrid. | 8.2.2 | 33.1, 33.2 |
| FR-M16-109 | S24 "Sumber Soalan" SHALL switch between the subject select, the empty exam-paper select (DV-M16-28) and the 31 checkboxes. | 8.2.3 | 33.3 |
| FR-M16-110 | S24 "Soalan & Masa" SHALL render the two numbers and apply the SPM count rule of URS FN-M16-8.2.4. | 8.2.4 | 33.1, 33.4 |
| FR-M16-111 | S24 SHALL render "Pemarkahan" and "Pendaftaran" with their defaults, limits and help texts. | 8.2.5, 8.2.6 | 33.1 |
| FR-M16-112 | S24 SHALL render "Batal" (link), a visible "Simpan Draf" (DV-M16-27) and "Cipta & Buka Pendaftaran", and block an invalid submit with native bubbles. | 8.2.7 | 33.5, 33.6, 33.8 |
| FR-M16-113 | §7 #44 SHALL validate per §5 and create the tournament as `draft` or `registration` (BR-M16-32), then return to `/tournament` with the PROPOSED flash. | 8.2.8 | 33.7 |
| FR-M16-114 | `/tournament/:uuid` SHALL render the PROPOSED read-only detail from §7 #45 or the 404 page. | 8.3.1 | 34.1, 34.2 |
| FR-M16-115 | S25 SHALL render the two buttons and the tabs with counts; "Liga Saya" per BR-M16-33 with its empty text. | 9.1.1, 9.1.2 | 35.1 |
| FR-M16-116 | S25 "Liga Terbuka" SHALL render one card per open league with the pill, BM chips (DV-M16-12), dates, school count and "Lihat →". | 9.1.3 | 35.2 |
| FR-M16-117 | S25 SHALL render the join modal (required 8-character code; "Batal" keeps the value; overlay click closes). | 9.1.4 | 35.3 |
| FR-M16-118 | §7 #48 SHALL join the viewer's school per BR-M16-33 and return the PROPOSED flash or error. | 9.1.5 | 35.4 |
| FR-M16-119 | S26 SHALL render the fields of URS FN-M16-9.2.1–9.2.3 with their options, defaults and limits. | 9.2.1, 9.2.2, 9.2.3 | 36.1 |
| FR-M16-120 | S26 SHALL block an invalid submit with native bubbles, link "Batal" → `/liga`, and §7 #47 SHALL create the league per BR-M16-33. | 9.2.4 | 36.2, 36.3 |
| FR-M16-121 | S27 SHALL render the header card (status pill with dot, chips, creator line) from §7 #49. | 9.3.1 | 37.1, 37.4 |
| FR-M16-122 | S27 SHALL render the invite code and the WhatsApp "Kongsi" URL of URS FN-M16-9.3.2 (new tab). | 9.3.2 | 37.1, 37.2 |
| FR-M16-123 | S27 SHALL render "Sertai Liga Ini" only when the league is not ended and the viewer's school is not in it, posting §7 #48. | 9.3.3 | 37.1, 37.4, 37.7 |
| FR-M16-124 | S27 SHALL render the participating schools as chips. | 9.3.4 | 37.3 |
| FR-M16-125 | S27 SHALL render the per-level leaderboard tabs and tables, or the empty state, scrolling in the card at 375 px (DV-M16-13). | 9.3.5 | 37.3, 37.4, 37.5 |
| FR-M16-126 | S27 SHALL render the 404 page for an unknown league id. | 9.3.6 | 37.6 |
| FR-M16-127 | S28 SHALL render the hero, the week line and the header row (two columns hidden below 768 px) from §7 #50 in the user shell (DV-M16-02). | 10.1.1, 10.1.2 | 38.1, 38.3 |
| FR-M16-128 | S28 SHALL render the week's rows in stored rank order with medals and gold / silver / bronze styles. | 10.1.3 | 38.2, 38.3 |
| FR-M16-129 | S28 SHALL render the footer tip. | 10.1.4 | 38.4 |
| FR-M16-130 | S28 SHALL show the week of `?week=` (Monday-normalised) or the "belum dijana" empty state. | 10.1.5 | 38.5 |
| FR-M16-131 | S28 SHALL ignore an invalid `week` (DV-M16-30). | 10.1.6 | 38.6 |
| FR-M16-132 | S29 SHALL render the four tiles from §7 #51 (Q-ROOMS, Q-ROOMS-PLAYING, Q-ROOMS-FINISHED, Q-ROOM-PLAYERS). | 11.1.1 | 39.1 |
| FR-M16-133 | S29 SHALL render the tiles setting with the live breakdown and bar, updating as the value changes, with native range validation 0–38. | 11.1.2 | 39.2, 39.3 |
| FR-M16-134 | S29 SHALL render the three game cards with "Aktif" and "Lihat" (new tab) and the Papan Bijak text "Multiplayer 2-6 pemain." (DV-M16-15). | 11.1.3 | 39.4 |
| FR-M16-135 | "Simpan Tetapan" SHALL put §7 #52 and new Papan Bijak rooms SHALL use the saved value. | 11.1.4 | 39.5 |
| FR-M16-136 | Every finished game, room, battle, spin and Jutawan game SHALL call M14 `gamification.onGameResult(userId, {game, event, coins, xp, correct, total, detail})` once (XR-M16-02) and display the returned `coinsCredited`. | 12.1.1 | 26.4, 40.1 |
| FR-M16-137 | Games and battles SHALL read questions only through `questions.*` (M04) and SHALL NOT write the M05 answer log. | 12.1.2 | 26.1, 40.2 |
| FR-M16-138 | S20 SHALL read the weekly ranking through the M05 named query Q-WEEK-RANK (XR-M16-03). | 12.1.3 | 29.5 |
| FR-M16-139 | The repository SHALL offer `battles.countFor` and `gameResults.countFor` to M11 (§7.2, XR-M16-05). | 12.1.4 | 40.3 |
| FR-M16-140 | M16 anchors SHALL be registered in the M02 datasets without changing their totals (XR-M16-04). | 12.1.5 | 04.3, 40.4 |

### 3.1 Traceability (US → FR → E2E)

Generated by script from the FR table (§3) and the E2E table (§12); checked by `trace.cjs` (see the change log).

| US | FR | E2E |
|---|---|---|
| US-M16-01 | 01, 02, 03, 04 | 01, 02, 03, 04, 05 |
| US-M16-02 | 05, 06, 07 | 06, 07, 08 |
| US-M16-03 | 08, 09, 10, 11 | 09, 10, 11 |
| US-M16-04 | 12, 13, 14, 15, 140 | 12, 13, 14, 15 |
| US-M16-05 | 16, 17, 18, 19, 20, 21, 23 | 16, 17, 18, 19, 20 |
| US-M16-06 | 22, 23, 24, 25, 26, 27 | 21, 22, 23, 24, 25 |
| US-M16-07 | 28, 29 | 26, 27 |
| US-M16-08 | 30, 31, 32, 33 | 28, 29, 30, 31 |
| US-M16-09 | 34, 35, 36, 37, 38 | 32, 33, 34, 35 |
| US-M16-10 | 39, 40 | 35, 36 |
| US-M16-11 | 41, 42 | 37, 38 |
| US-M16-12 | 43, 44, 45, 46 | 39, 40 |
| US-M16-13 | 47, 48, 49, 50 | 41, 42 |
| US-M16-14 | 51, 52, 53 | 43, 44, 45 |
| US-M16-15 | 54, 55, 56, 57, 58 | 46, 47, 48 |
| US-M16-16 | 59, 60 | 49 |
| US-M16-17 | 61 | 50 |
| US-M16-18 | 62, 63, 64, 65, 66 | 51, 52, 53, 54 |
| US-M16-19 | 67, 68, 69, 70 | 55, 56 |
| US-M16-20 | 71 | 57 |
| US-M16-21 | 72, 73, 74, 75, 91 | 58 |
| US-M16-22 | 76, 77, 78 | 59 |
| US-M16-23 | 79, 80, 81 | 60 |
| US-M16-24 | 82, 83, 84, 85 | 61 |
| US-M16-25 | 86, 87, 88, 89 | 62 |
| US-M16-26 | 90, 91, 92, 136, 137 | 63, 64, 65, 66 |
| US-M16-27 | 93, 94, 95 | 67, 68, 69 |
| US-M16-28 | 96, 97, 98 | 70, 71 |
| US-M16-29 | 99, 100, 101, 102, 138 | 72, 73 |
| US-M16-30 | 103 | 74 |
| US-M16-31 | 104 | 75 |
| US-M16-32 | 105, 106 | 76, 77 |
| US-M16-33 | 107, 108, 109, 110, 111, 112, 113 | 11, 78, 79 |
| US-M16-34 | 114 | 80, 81 |
| US-M16-35 | 115, 116, 117, 118 | 82, 83 |
| US-M16-36 | 119, 120 | 84, 85 |
| US-M16-37 | 121, 122, 123, 124, 125, 126 | 86, 87, 88 |
| US-M16-38 | 127, 128, 129, 130, 131 | 89, 90 |
| US-M16-39 | 132, 133, 134, 135 | 56, 91, 92 |
| US-M16-40 | 136, 137, 139, 140 | 93, 94, 95, 96 |

---

## 4. Business rules

| ID | Rule | Source |
|---|---|---|
| BR-M16-01 | **Access.** Guest → `/login`; every endpoint 401 without a session. S24, §7 #43–#44 and S29, §7 #51–#52: role `admin` (others → M01 landing page; 403 `FORBIDDEN`). Every other M16 screen and endpoint: any logged-in role. The arena (#16, #17) and a room's endpoints (#26–#28) answer 404 to users who are not players of that battle / room. | OBSERVED (admin) / INFERRED |
| BR-M16-02 | **Grades.** User grade 1–6 = Darjah 1–6, 7–11 = Tingkatan 1–5 (M01/M03); game enums `DARJAH_1…6`, `TINGKATAN_1…5`; the custom range 1–11; labels "Darjah n" / "Tingkatan n" (grade label of the incoming chip, e.g. "Darjah 4"). A user without a grade has no auto grade (S7–S12 open on the select, INFERRED). | OBSERVED / INFERRED |
| BR-M16-03 | **Battle start** (#2 quick match, #3 school battle). Body `{question_type, open_to_all, subject_id}` or `{question_type: 'pksk', open_to_all, pksk_domain_id, pksk_target_level}` or `{question_type: 'spm', open_to_all, subject_id}`. `canStart` (client) and server: `biasa` needs a subject 1–31; `pksk` needs a domain 1–15 and level `T1`/`T4`; `spm` needs a viewer grade 10–11 (else 403) and a subject with Q-SPM-POOL > 0. The pool for the battle (grade of the queue owner): `biasa` = M04 Q-ELIGIBLE MCQ of the subject at the owner's level; `pksk` = M04 PKSK rows of the domain and level (the token `pksk` is the same as the M05 session mode and M14 source of M07 v1.7 BR-M07-26, but a PKSK battle stays an M16 Battle record, never an M05 session); `spm` = Q-SPM-POOL of the subject. A pool with fewer than 10 questions → 422 `{}` (no message; the client shows its fallback "Ralat dari server. Sila cuba lagi."). Otherwise a BattleQueue is created (status `waiting`, `createdAt` = now) and `{queue_id}` is returned. | SOURCE / INFERRED |
| BR-M16-04 | **Queue statuses** (#4): `waiting` (no change), `incoming_challenge` + `challenger {name, grade_label, school}`, `matched` + `battle_uuid`, `expired` (120 s after creation without a match, INFERRED), `not_found` (unknown id or not the owner — observed for id 0). A queue that has not been polled for 10 s is `abandoned`: it is never matched and becomes `expired` (SIMULATION rule for the client-only "Batal", DV-M16-05). | SOURCE / INFERRED / SIMULATION |
| BR-M16-05 | **Simulated matchmaking** (SIMULATION, D4). On the 3rd poll of a `waiting` queue the mock creates a bot opponent and a Battle and answers `matched`. The bot is a generated fictitious student of the M02 users dataset drawn from the stream `m16:battle:<queueId>`: same grade as the owner (any grade when `open_to_all`), for `school_battle` a school different from the owner's (for `quick_match` any school). Hooks (§6.14) switch a queue to `incoming` (the 2nd poll answers `incoming_challenge` with a bot challenger; "Terima" matches, "Tolak" returns to `waiting` and the next bot comes on the 3rd poll after that), `never`, `expired`, `not_found`, `error:<status>` or `network`. | SIMULATION (PROPOSED parameters) |
| BR-M16-06 | **Invitations** (#8–#11). `invite` stores `{uuid, sender, receiver_id, params, status 'pending', createdAt}`; `receiver_id` must be an existing student other than the sender (else 422 `{error}` INFERRED); `invitations` lists the viewer's pending invitations newest first as `{uuid, sender_name, sender_school}`; `accept` creates the Battle (the sender is player A) → `{success: true, battle_uuid}`; `decline` → status `declined`, `{success: true}`; an invitation older than 24 h is `expired` and no longer listed (PROPOSED). A bot receiver never answers (SIMULATION). | SOURCE / INFERRED / PROPOSED |
| BR-M16-07 | **Arena rules** (INFERRED / PROPOSED, provisional). 10 questions drawn from the battle pool with the stream `m16:battle:<uuid>`, served without the correct key; each question 15 s; a correct answer scores `1000 − round(500 × s ÷ 15)` (s = whole seconds used, 0–15), a wrong answer or a timeout 0; the battle ends after question 10 or a forfeit; winner = higher total; equal non-zero totals = `seri`; **0–0 = player B wins** (the rule the observed standings follow, DV-M16-35; kept at runtime, PROPOSED). Fits every observed battle score (0–9,780; single-correct 800–966). | INFERRED / PROPOSED |
| BR-M16-08 | **Bot answers** (SIMULATION). For each question the bot answers after `2 + 10 × u` seconds (u from the stream) and is correct when `u2 < p`, where p = the M05 platform accuracy Q-ANS-CORRECT ÷ Q-ANS-ALL read from the M05 named queries when the mock starts (82.84 % with M05 v1.10: 396,391 ÷ 478,499; never hard-coded); its score uses BR-M16-07. | SIMULATION |
| BR-M16-09 | **Forfeit** (#14). Only a player of an unfinished battle; the forfeiting player loses whatever the scores (the opponent is the winner); status `forfeited`; the page reloads. | SOURCE / INFERRED |
| BR-M16-10 | **Battle record.** `{uuid, mode, questionType, subjectId?, pkskDomainId?, pkskTargetLevel?, playerA, playerB, schoolAId, schoolBId (schools at battle time, null for a player without a school), scoreA, scoreB, correctA, correctB, answered, winner 'A'\|'B'\|null (null = seri), status 'active'\|'finished'\|'forfeited'\|'abandoned', createdAt, finishedAt}`; winner per BR-M16-07 (0–0 → B; a forfeit = loss of the forfeiting player). `abandoned` (PROPOSED status, XL3-17) = a matched battle that never completed; it counts in the M17 totals but not in standings, S4, S5 or M11. The seed holds 168 battles (§6.11.1): the 47 listed, 24 generated older ones (5 of them forfeited by their loser) and 97 abandoned. | SOURCE (fields) / INFERRED / PROPOSED |
| BR-M16-11 | **Opponent search** (#7): q trimmed, ≥ 2 characters (else `{users: []}`); users with role `student`, name contains q (case-insensitive), not the viewer; order name A→Z; at most 10; fields `{id, name, school, avatar}` (school name or ""). | SOURCE (shape) / INFERRED (filters) |
| BR-M16-12 | **Standings are computed from the battle records** (D11) — statuses `finished` and `forfeited` only. For each period `weekly` (Monday–Sunday MYT), `monthly` (calendar month MYT), `all_time` and each scope: school — one side per player whose school at battle time is the school (a battle between two of its pupils counts twice); student — one side per player. `battles` = sides; `menang` / `seri` / `kalah` by the winner (BR-M16-07, 0–0 → B; forfeit = kalah); `pelajar` = distinct players of the school sides; student `streak` = consecutive wins up to the latest battle (INFERRED); `ketepatan` and `skor`: for the 8 observed school rows the stored job figures (DC-M16-03) plus the increments of runtime battles, otherwise computed — ketepatan = round(Σ correct ÷ Σ answered × 100), skor = Σ round(player score ÷ 100) (PROPOSED). The seed battles reproduce every observed Battle / M/S/K / Pelajar except 8082 all time (DV-M16-36). | OBSERVED (values) / D11 / INFERRED / PROPOSED |
| BR-M16-13 | **School ranking order** (S3): skor desc; equal skor keep the stored order (seed: 8078 before 8082); "#" = position in the national list of the period (kept under a state filter); the podium = national rows 1–3 (DV-M16-09); state filter = school's M02 state. Unknown `period` → all_time, no pill active. | OBSERVED + DV-M16-09 |
| BR-M16-14 | **School detail** (S4): cards = the computed all-time standing and its "Ketepatan" (zeros without battles); period boxes = the weekly / monthly standing with its rank (DV-M16-10); "Pejuang Terbaik Minggu Ini" = the top 5 weekly student standings whose current school is this school, by skor desc (INFERRED; empty in the seed); "Battle Terkini" = the last 10 finished battles with `schoolAId` or `schoolBId` = this school, newest first; player A is `text-slate-700` when A's **current** M02 school is this school, else `text-blue-600`; player B always `text-blue-600`; the winner's score `text-green-600` — on 0–0 player B's (DV-M16-35); a non-zero tie colours neither; the list scrolls inside its card below 768 px (DV-M16-37). | OBSERVED / INFERRED (colour rule fits 47/47 rows) |
| BR-M16-15 | **Period windows** use Asia/Kuala_Lumpur and the mock clock: week Monday 00:00 – Sunday 23:59:59.999; month calendar month; the default seed clock gives week 21–27 Sep 2026 and month September 2026. | OBSERVED + DV-M16-17 |
| BR-M16-16 | **Hub chips** (S6): "🆕 Belum main lagi" while Q-PB-PLAYED(viewer) = 0 (Papan Bijak standings `jumlah`); "🆕 Belum battle lagi" while Q-BAT-USER(viewer) = 0 (DV-M16-14). | OBSERVED + DV-M16-14 |
| BR-M16-17 | **Open rooms** (S6): Q-OPEN-ROOMS = rooms in status `waiting` that are not full (any game, newest first, at most 6, INFERRED); the seed has none. | OBSERVED (empty) / INFERRED |
| BR-M16-18 | **Rooms** (#24–#28). Code: 6 characters from [A-Z0-9], unique among rooms, from `uuid`-like stream `m16:room-code`; upper-cased on input. Status `waiting` → `playing` (host start) → `finished`; seed rooms are `closed` (DV-M16-16). Join (#25): the code exists, status `waiting`, players < capacity (Papan Bijak `max_players`; other games the maximum of their rule line) and the viewer's grade fits `match_mode` (`same_grade` equal grade; `same_level` same school level, primary 1–6 / secondary 7–11; `custom` within `grade_min`–`grade_max`); a player already in the room rejoins; anything else → the lobby flash "Bilik tidak dijumpai." (INFERRED). | OBSERVED (form) / INFERRED |
| BR-M16-19 | **Room simulation** (SIMULATION). While `waiting`, each poll (#26) of the host adds one bot until the game's minimum players (Papan Bijak 2, Perang Fakta 2, Benteng Ilmu 2, Perlumbaan 2, Kuiz Relay 4, Teka Silang Kata 2); bots are generated fictitious students of a fitting grade (stream `m16:room:<code>`); in play bots answer per BR-M16-08. | SIMULATION |
| BR-M16-20 | **Room game rules** (copy SOURCE; details INFERRED / PROPOSED): Papan Bijak — board of 50 tiles: tile 1 start, 50 finish, 3 ladders, 3 snakes, 2 bonus (+3 tiles), 2 traps (−3 tiles), `boardgame_quiz_tiles` quiz tiles, the rest plain, placed by the stream `m16:room:<code>:board`; turns in join order; dice 1–6; a quiz tile asks one M04 question (correct: stay; wrong: back to the previous tile, PROPOSED); first to 50 wins. Perang Fakta — 15 rounds of one statement (BR-M16-25 format), 10 s each, +1 per correct vote. Benteng Ilmu — 2 players, HP 100, alternate turns, correct: opponent −20 HP, wrong: self −20 HP (PROPOSED); first at 0 loses. Perlumbaan Matematik — 2–4 players, Matematik (or the room subject) questions in parallel, correct +1 step, first to 20. Kuiz Relay — 4–8 players in 2 teams (alternate join order), 10 rounds, team members answer in turn, correct +10 + speed bonus `max(0, 10 − s)` (PROPOSED), higher team wins; MVP = the top scorer of the winning team. Teka Silang Kata — 2 players, 5 minutes, a crossword of 8 words from M04 short correct options (PROPOSED), most words wins. | SOURCE (copy) / INFERRED / PROPOSED |
| BR-M16-21 | **Game standings** (per game, per user): lobbies `wins` (Kuiz Relay `mvp`); Papan Bijak `menang`, `jumlah` (games), `skor`, `betul`. Seed = the observed rows (§6.11.3). A finished room adds 1 win to the winner (or MVP), and for Papan Bijak adds 1 game to every player, `betul` + correct answers and `skor` + (10 × correct + 50 for the win, PROPOSED). | OBSERVED / PROPOSED |
| BR-M16-22 | **Papan Bijak Top 10**: users with `jumlah` > 0 ordered by `menang` desc, then `skor` desc, then stored order; Kadar = round(menang ÷ jumlah × 100); pill green at ≥ 70, amber at 40–69, red below 40 (INFERRED thresholds, fit 10/10); name truncated to 15 characters + "..."; initials = first letters of the first two words. | OBSERVED / INFERRED |
| BR-M16-23 | **Lobby leaders** ("🏆 Pendahulu"): up to 10 users by value desc, ties by the seed order, then by the time the value was reached (DV-M16-08); medals for 1–3, "{n}." after. | OBSERVED + DV-M16-08 |
| BR-M16-24 | **Papan Bijak quick match** (#29–#31; SIMULATION): a search `{subject, match_mode}` answers `{status: 'searching'}`; its 3rd poll creates a Papan Bijak room with the searcher and one bot (status `waiting`, 4 players max) and answers `{status: 'matched', room_code}`; after 120 s without a match `expired` (PROPOSED value); cancel → `cancelled`; the idle poll answers `{status: 'cancelled'}` (OBSERVED). | SOURCE / SIMULATION |
| BR-M16-25 | **Single-player payloads** (#32) from M04 through `questions.*` (eligible MCQ, `mcq` type): level = `darjah` (S13–S16), Darjah 1–4 for S17 (INFERRED; Kad Memori has no picker and every observed card is primary content); stream `m16:solo:<sessionId>`. Betul atau Salah: 40 items `{id, statement: "{question} → {option}", is_true, difficulty}` — the correct option with probability ½, else a random wrong one (INFERRED; 19/40 true observed). Cabaran Kilat: 30 `{id, question_text, difficulty, options[4] {id, text, correct}}`. Tembak Jawapan: 30 `{id, question, difficulty, options[4] {text, correct}}`. Susun Jawapan: 20 `{id, question, answer, scrambled[], type, difficulty, points}` from questions whose correct option has ≤ 20 characters: one word → `letters` (the letters shuffled), several words → `words` (the words shuffled); points = max(5, tiles × 2) for letters, tiles × 3 for words. Kad Memori: 6 questions → 12 cards `{id, pair_id 0–5, type question\|answer, content, difficulty}` shuffled. Session id = prefix (`tf_`, `speed_`, `shoot_`, `ws_`, `mem_`) + 13 hex. `personalBest` = the stored best score of the viewer (BR-M16-27). | SOURCE (shapes) / INFERRED (selection) |
| BR-M16-26 | **Game scoring** (client, SOURCE). Betul atau Salah: on a correct answer `streak += 1`, `score += 10 + min(streak, 10) × 2`, `coins += min(streak, 5)` (order confirmed by the M14 ledger row "Betul/Salah: 3 betul, streak 2" +4 of 19/02/2026); wrong → streak 0; 45 s or 40 items. Cabaran Kilat: correct → `combo += 1`, `mult = min(combo, 10)`, `score += 10 × mult`, `coins += mult`; wrong → combo 0; 60 s or 30 items; 400 ms between items (M14 ledger "Cabaran Kilat: 3 betul, combo 2x" +4 of 11/02/2026 fits). Tembak Jawapan: level starts 1; fall time `max(5, 15 − (level − 1) × 0.7)` + u × 2 s; tiles 1.8 s apart; deadline `(base + 6 + options × 2)` s; correct tap `score += 10 × level`, `coins += level`, level +1 every 5 correct; wrong tap or miss −1 life (a miss counts as answered); ends at 0 lives or all answered. Susun Jawapan: check `trim().toLowerCase()`, words joined with one space; correct `score += points`, `coins += ceil(points ÷ 3)`. Kad Memori: move = 2 flips; mismatch back after 800 ms. Result titles as URS FN-M16-6.2.3 … 6.5.4. | SOURCE |
| BR-M16-27 | **Submit** (#33). Bodies: Betul atau Salah `{session_id, correct_count, total_answered, streak, score, syiling_earned}`; Cabaran Kilat `{…, max_combo, score, syiling_earned}`; Tembak `{…, max_level, score, syiling_earned}`; Susun `{session_id, solved_count, total_puzzles, score, syiling_earned}`; Kad Memori `{session_id, matches, total_pairs, moves, time_seconds}`. The mock checks the session belongs to the viewer and is not yet submitted (409), and the values are possible (e.g. `correct_count ≤ total_answered ≤` items, `score ≤` the maximum for those counts, `matches = total_pairs = 6`, `moves ≥ 6`) → else 422 (§5). `is_new_record` = score > the stored personal best (a first result is a record); Kad Memori answers `{results: {syiling_earned, accuracy: round(6 ÷ moves × 100)}}`. The stored GameResult feeds M11 and the personal best. **Backend phase:** the server serves items without keys, checks every answer and computes score and coins itself (SEC-M16-01). | SOURCE / INFERRED |
| BR-M16-28 | **Coins** (DV-M16-23). Each finished game, room, battle, spin and Jutawan game calls M14 `gamification.onGameResult(userId, {game, event, coins, xp, correct, total, detail})` once (M14 v1.1 BR-M14-21 → `{coinsCredited, xpAdded}`), where `xp` = 0 (only `mata: 0` exists in the game code; M14 decides game XP), `detail` carries `maxCombo` / `maxStreak` / `level` / `solved` / `moves` for the ledger wording, and `coins` is the SOURCE computed amount (Kad Memori PROPOSED `matches`; Papan Bijak correct × `board_game_reward_correct` + win × `board_game_reward_win`; Benteng / Perang Fakta / Perlumbaan the M14 ledger rates `benteng_play` 8, `benteng_win` 35, `perang_fakta_win` 10, `mathrace_play` 5; Roda Nasib the segment value; Jutawan the M14 ledger amounts). M14 credits them only while `games_award_syiling` = 1 and returns `coinsCredited`; M16 shows it everywhere a game shows syiling after the result. **During play** the counters need to know before any credit whether the viewer can earn: #32 and #34 return `canEarnSyiling` = M14 `gamification.canEarnSyiling(userId)` (the setting ∧ the user's M02 `coinsEnabled`, M14 v1.3), and the in-play amount = the computed amount when true, else 0. With the M14 seed (0) every figure is 0. | OBSERVED (setting, rates) / INFERRED |
| BR-M16-29 | **Roda Nasib** (#34–#35). Segments with the live **0-based** `segment_index` (index, label, type, value, weight): 0 "1 Syiling" 1 w25 · 1 "3 Syiling" 3 w20 · 2 "5 Syiling" 5 w15 · 3 "10 Syiling" 10 w8 · 4 "20 Syiling" 20 w3 · 5 "Cuba Lagi" nothing 0 w15 · 6 "2 Syiling" 2 w10 · 7 "7 Syiling" 7 w4 (Σ 100); the client lands the wheel at `360 − (segment_index × 45 + 22.5)`°. The segment is picked by weight from the stream `m16:spin:<userId>:<yyyy-mm-dd>`. One spin per user per MYT calendar day (reset 00:00, INFERRED); a second → 409 `{success: false, message: "Anda sudah spin hari ini."}` (PROPOSED COPY; the client alerts it and sets `alreadySpun`). Stats: `spins` + 1, `won` + `coinsCredited`. `alreadySpun` = a spin exists today. | SOURCE / INFERRED / PROPOSED |
| BR-M16-30 | **Jutawan Ilmu.** Counts per grade × subject = M04 Q-JUT-COUNT (`questions.jutawan.count(subjectId, level)`, the `jutawanQuestions` store of M04 v1.11 — 143 cells, Σ 149,911 = discovery A.7); only subjects with a count are listed, in the A.7 order. Game (PROVISIONAL): 15 questions of the subject and grade drawn keyless with `questions.jutawan.sample({subjectId, level, difficulty}, n, rng)` (stream `m16:jutawan:<sessionId>`), difficulty 1 for questions 1–4, 2 for 5–8, 3 for 9–12, 4 for 13–15 (PROPOSED), each answer checked with `questions.jutawan.gradeAnswer(id, optionId)`; one wrong answer ends the game; level reached L = number answered correctly in a row (0–15); 3 lifelines "50:50" (two wrong options removed, from `questions.jutawan.get` on the server); stats `bestLevel` = max L, `games` + 1. Coins per level: M14 ledger "Jutawan Ilmu ({subjek}): Level {n}" with +50 / +1,000 observed; the ladder is PROPOSED (L15 = 1,000, L10 = 50, others 0). | copy / PROPOSED |
| BR-M16-31 | **Pertandingan Mingguan.** Week = BR-M16-15 (ends Sunday 23:59:59 MYT, DV-M16-17); countdown text "{d}h {h}j {m}m" (floor), refreshed every 60 s, "Tamat!" at or after the end. Q-WEEK-RANK (M05 v1.10): users with ≥ 1 completed practice-mode session in the week (SPM modes excluded), `sesi` = count, `betul` = Σ `correctCount`, `tepat` = mean of the sessions' `correctCount ÷ questionCount × 100`, 1 decimal (INFERRED: Σ betul ÷ Σ answers cannot give 8 of the 20 observed values, e.g. 187 at 90.7 %); order `betul` desc, then user id asc; top 20. | OBSERVED / INFERRED |
| BR-M16-32 | **Tournaments.** Create (#44): `action=draft` → status `draft`; `open_registration` → `registration`; uuid from `uuid('m16:tournament')`; `ongoing` from `registration_closes_at` (INFERRED; without a close date it stays `registration`); `completed` not reachable in the prototype. The SPM count rule of URS FN-M16-8.2.4 runs in the form. The list (#42) and the banner (#1) show `registration` and `ongoing`. | OBSERVED (form) / INFERRED |
| BR-M16-33 | **Leagues.** Create (#47): invite code 8 characters [A-Z0-9] unique (stream `m16:league-code`), status `upcoming`, creator = viewer, schools = the creator's school when set (INFERRED). "Liga Saya" = leagues with the viewer's school; "Liga Terbuka" = leagues with status ≠ `ended` (INFERRED). Join (#48): code exists, status ≠ `ended`, the viewer has a school not yet in the league, `max_schools` not reached → the school joins; else a PROPOSED error. Status is stored ("Akan Datang" `upcoming`, "Tamat" `ended`; other values PROPOSED "Sedang Berlangsung" `ongoing`) and never changed by dates (DV-M16-11). Labels: type `friendly` "Persahabatan", `tournament` "Kejohanan", `league` "Liga"; scope `school` "Sekolah", `district` "Daerah", `state` "Negeri", `national` "Kebangsaan"; scoring `total_score` "Jumlah Markah", `avg_accuracy` "Purata Ketepatan", `wins` "Bilangan Kemenangan" (DV-M16-12). Share URL of URS FN-M16-9.3.2 with `encodeURIComponent`-style `+` spaces as live. | OBSERVED / INFERRED / PROPOSED |
| BR-M16-34 | **League standings**: stored hourly-job output per level `{schoolId, peserta, skor (1 decimal), purata %}` (seed §6.11.5); tabs = the league's class levels that have standings; without standings the empty state (no tabs); no recompute in the prototype (OQ-M16-09). | OBSERVED |
| BR-M16-35 | **Sekolah Bersaing.** A week = its Monday (MYT); default = the current week; `?week=` a valid date → its week; invalid → current (DV-M16-30); the page shows the stored snapshot rows of that week in stored rank order; header count = the number of rows (Q-SB-WEEK); a week without a snapshot → the empty state. Seed: 21 Sep (49 rows) and 14 Sep, 07 Sep, 31 Aug (48 rows each, the 21 Sep schools without row #46, observed order and values, §6.11.6). Opted-out schools display "Sekolah anonim" (fixture only). | OBSERVED / INFERRED |
| BR-M16-36 | **Game settings** (#51–#52): `boardgame_quiz_tiles` integer 0–38 (stored 35); plain tiles = max(0, 48 − 10 − tiles); bar widths round(tiles ÷ 48 × 100) %, 10 ÷ 48 = 20.8 %, rest; tiles = Q-ROOMS 160, Q-ROOMS-PLAYING 0, Q-ROOMS-FINISHED 0, Q-ROOM-PLAYERS 189. | OBSERVED |
| BR-M16-37 | **Relative time** (S4, S5): the shared formatter of M14 BR-M14-35 with a week step (it changes M14's 7–29-day output, XR-M16-07) — < 1 min "baru sahaja", minutes "{n} minit yang lepas", hours "{n} jam yang lepas", days < 7 "{n} hari yang lepas", 7–29 days "{floor(d ÷ 7)} minggu yang lepas" (OBSERVED "1 minggu yang lepas"), months (30-day) "{n} bulan yang lepas", years "{n} tahun yang lepas" (XR-M16-07). | OBSERVED / INFERRED |
| BR-M16-38 | **Banner data** (#1): `[{uuid, title, status, live_match: null \| {school_a, school_b}}]` for tournaments with status `registration` or `ongoing`, ordered by `registration_opens_at` then creation; `live_match` is set only by the test fixture (live matches are not built). | SOURCE / INFERRED |

## 5. Validation rules

Client validation replicates live: native HTML constraints (`required`, `min`, `max`, `maxlength`) with the browser's own bubbles (not rendered by the app, as live). Server messages were never observable; the mock answers `422 VALIDATION_ERROR` with the PROPOSED BM messages below (SRS.md §7.3), shown in the global error convention (M01).

| ID | Form / field | Rule (client · server) | Message (server, PROPOSED) |
|---|---|---|---|
| V-M16-01 | S7 create `subject` | one of `MATEMATIK`, `BAHASA_MELAYU`, `SAINS`, `BAHASA_INGGERIS` | "Subjek tidak sah." |
| V-M16-02 | S7/S8–S12 `grade_level` | one of `DARJAH_1…6`, `TINGKATAN_1…5` | "Tahap soalan tidak sah." |
| V-M16-03 | S7 `match_mode` / `grade_min` / `grade_max` / `max_players` | enum; `custom` needs 1 ≤ min ≤ max ≤ 11; players 2–6 | "Julat tahap tidak sah." / "Bilangan pemain tidak sah." |
| V-M16-04 | S7 join `room_code` | client `required`, `maxlength=6` · server: known code (BR-M16-18) | redirect + flash "Bilik tidak dijumpai." (OBSERVED copy) |
| V-M16-05 | S8–S12 create `subject` | one of the 5 lobby subjects | "Subjek tidak sah." |
| V-M16-06 | S8–S12 join `room_code` | not required, `maxlength=6` · server: known code | redirect + flash "Bilik tidak dijumpai." |
| V-M16-07 | S24 `title` | `required` · ≤ 255 characters | "Tajuk tournament diperlukan." |
| V-M16-08 | S24 `education_level_id` | `required` · `tingkatan4`, `tingkatan5`, `spm` | "Sila pilih tahap pendidikan." |
| V-M16-09 | S24 `format`, `groups_count` | enum · 2–8 when league / hybrid | "Bilangan kumpulan mesti antara 2 dan 8." |
| V-M16-10 | S24 `question_mode` + `subject_id` / `exam_paper_id` / `mixed_subject_ids[]` | server: a subject for `subject`, a paper for `exam_paper`, ≥ 1 subject for `random_mix` (INFERRED) | "Sila pilih sumber soalan." |
| V-M16-11 | S24 `total_questions`, `time_window_minutes`, `top_n_scoring`, `min_participants` | `required` + min/max (5–100, 10–180, 1–50, 1–100) | "Nilai di luar julat." |
| V-M16-12 | S24 registration dates | server: close ≥ open when both set (INFERRED) | "Tarikh tutup mesti selepas tarikh buka." |
| V-M16-13 | S25 / S27 `invite_code` | client `required` (S25), `maxlength=8` · server BR-M16-33 | "Kod jemputan tidak sah." · "Sekolah anda sudah menyertai liga ini." · "Liga ini sudah penuh." · "Anda perlu mempunyai sekolah untuk menyertai liga." |
| V-M16-14 | S26 `name`, `type`, `scope`, `game_mode`, `scoring_method`, `start_date`, `end_date` | client `required` · end ≥ start (INFERRED) | "Sila lengkapkan semua medan wajib." · "Tarikh tamat mesti selepas tarikh mula." |
| V-M16-15 | S26 `max_schools` | empty or 2–500 | "Had sekolah mesti antara 2 dan 500." |
| V-M16-16 | S29 `boardgame_quiz_tiles` | client `min=0 max=38` · integer 0–38 | "Nilai mesti antara 0 dan 38." |
| V-M16-17 | #2 / #3 battle start | BR-M16-03 | 422 `{}` / 403 `{}` (client fallback "Ralat dari server. Sila cuba lagi.") |
| V-M16-18 | #7 search `q` | < 2 characters → empty result (no error) | — |
| V-M16-19 | #33 submit | BR-M16-27 (session owner, once, possible values) | 409 `{message: "Keputusan sudah dihantar."}` · 422 `{message: "Keputusan tidak sah."}` (PROPOSED; the client only logs "Submit error:") |
| V-M16-20 | #35 spin | once per MYT day | 409 "Anda sudah spin hari ini." (PROPOSED) |

---

## 6. Data entities & fields

### 6.1 Referenced entities (owners; not redefined — D12)

| Entity | Owner | Used for |
|---|---|---|
| User (id, name, role, grade, schoolId, avatar) | M01 / M02 | players, bots (generated users), league creators, opponent search |
| School (id, name, state, ppd, type SK/SMK) | M02 | battle standings, S4, leagues, Sekolah Bersaing, battle sides |
| Subject (1–31, name, code, icon, colour), Level (1–11) | M03 | subject tiles, league / tournament subject selects, Jutawan headings |
| Question (objective, PKSK rows, SPM pool) | M04 | every game and battle item (`questions.*`); Jutawan counts (XR-M16-01) |
| PkskDomain (1–15, name, icon, colour) | M07 (rows in M04) | S1 PKSK panel |
| PracticeSession | M05 | S20 weekly ranking (Q-WEEK-RANK, XR-M16-03), bot accuracy (Q-ANS-CORRECT ÷ Q-ANS-ALL) |
| StudentWallet, settings `games_award_syiling`, tier `board_game_reward_*` | M14 | coins through `onGameResult` (BR-M16-28) |

### 6.2 DATA-M16-01 — Battle, DATA-M16-02 — BattleQueue, DATA-M16-03 — BattleInvitation, DATA-M16-04 — BattleAnswer (owner M16)

| Entity | Field | Type | Req. | Notes |
|---|---|---|---|---|
| Battle | uuid | string (UUID) | yes | `uuid('m16:battle')`; seed battles have fixed uuids `00000000-0000-4000-8000-0000000000nn` (nn = seed #) |
| | mode | enum `quick_match`, `school_battle`, `challenge`, `queue_join` | yes | seeds `quick_match` (INFERRED; S4 does not show it) |
| | questionType | enum `biasa`, `pksk`, `spm` | yes | seeds `biasa` |
| | subjectId / pkskDomainId / pkskTargetLevel | int / int / enum `T1`, `T4` | cond. | seeds null (not observed) |
| | playerA, playerB | user id | yes | A = queue owner / invitation sender |
| | schoolAId, schoolBId | school id \| null | yes | schools of the players when the battle was created |
| | scoreA, scoreB | int 0–10,000 | yes | observed 0–9,780 |
| | correctA, correctB, answered | int | yes | seeds: correct = floor(score ÷ 500) capped at 10 (PROPOSED), answered 10 |
| | winner | `A`, `B`, null | — | null = seri |
| | status | enum `active`, `finished`, `forfeited`, `abandoned` (PROPOSED, XL3-17) | yes | seeds: 66 `finished`, 5 `forfeited`, 97 `abandoned` |
| | createdAt, finishedAt | ISO datetime | yes | seeds §6.11.1 |
| BattleQueue | id | int (sequence from 1) | yes | `queue_id` |
| | ownerId, params (`question_type`, `open_to_all`, subject / domain / level), mode | — | yes | |
| | status | enum `waiting`, `incoming_challenge`, `matched`, `expired`, `abandoned` | yes | BR-M16-04 |
| | challenger | `{userId, name, grade_label, school}` \| null | — | incoming only |
| | battleUuid, polls, lastPolledAt, createdAt | — | — | |
| BattleInvitation | uuid, senderId, receiverId, params, status (`pending`, `accepted`, `declined`, `expired`), createdAt | — | yes | BR-M16-06 |
| BattleAnswer | battleUuid, playerId, index 1–10, questionId, optionId, correct, seconds, points | — | yes | arena (provisional) |

### 6.3 DATA-M16-05 — BattleStanding (owner M16; computed view of the battle records + stored DC-M16-03 figures)

| Field | Type | Notes |
|---|---|---|
| scope | enum `student`, `school` | |
| subjectId | user id or school id | |
| period | enum `weekly`, `monthly`, `all_time` + `periodStart` (Monday / first of month; null for all time) | |
| battles, menang, seri, kalah | int | computed from Battle (BR-M16-12) |
| correct, answered | int | ketepatan = round(correct ÷ answered × 100); the 8 observed school rows carry the stored "%" (DC-M16-03) |
| pelajar | int | computed: distinct players of the school's sides |
| streak | int | student only |
| skor | int | stored DC-M16-03 for the 8 observed school rows (+ runtime increments); otherwise computed (PROPOSED) |
| orderKey | int | stored order for equal skor (seed: live order) |

### 6.4 DATA-M16-06 — GameRoom and RoomPlayer, DATA-M16-07 — GameStanding (owner M16)

| Entity | Field | Type | Notes |
|---|---|---|---|
| GameRoom | code | string(6) | key |
| | game | enum `papan-bijak`, `perang-fakta`, `benteng-ilmu`, `perlumbaan-matematik`, `kuiz-relay`, `teka-silang-kata` | |
| | subject | enum `MATEMATIK`, `BAHASA_MELAYU`, `BAHASA_INGGERIS`, `SAINS`, `SEJARAH` | |
| | gradeLevel, matchMode, gradeMin, gradeMax, maxPlayers | as the forms | |
| | hostId, status (`waiting`, `playing`, `finished`, `closed`), createdAt, startedAt, finishedAt, state (board positions / HP / steps / team scores / round) | | `closed` = seed rooms (DV-M16-16) |
| RoomPlayer | roomCode, userId, team (Kuiz Relay), points, correct, isBot | | 189 distinct users over the 160 seed rooms |
| GameStanding | game, userId, wins (or mvp), jumlah, skor, betul (Papan Bijak), orderKey, reachedAt | | seed §6.11.3 |

### 6.5 DATA-M16-08 — GameSession, DATA-M16-09 — PersonalBest and JutawanStats (owner M16)

| Entity | Field | Notes |
|---|---|---|
| GameSession | id (`tf_…`, `speed_…`, `shoot_…`, `ws_…`, `mem_…`, `jut_…` + 13 hex), userId, game, darjah, itemIds[], createdAt, submittedAt, result (the submit body), score, coinsComputed, coinsCredited, isNewRecord | payload items are not stored (re-derived from the stream); seed: **47 submitted results** for M17 (§6.11.1) |
| PersonalBest | userId, game, bestScore | seed: user 1 `betul-salah` 38, `cabaran-kilat` 40 (observed `personalBest`) |
| JutawanStats | userId, bestLevel, games | seed: none (admin "L0" / "0" = defaults) |

### 6.6 DATA-M16-10 — Spin and SpinStats (owner M16)

| Entity | Field | Notes |
|---|---|---|
| Spin | userId, date (MYT), segmentIndex 0–7 (live 0-based), type, value, credited, createdAt | runtime only |
| SpinStats | userId, spins, won, lastSpinDate | seed: user 1 spins 2, won 0, lastSpinDate 2026-09-24 (PROPOSED: before today, so "🎯 SPIN!" is enabled as observed) |

### 6.7 DATA-M16-11 — Tournament (owner M16)

`{uuid, title, description, educationLevelId ('tingkatan4' | 'tingkatan5' | 'spm'), format ('single_match' | 'knockout' | 'league' | 'hybrid'), groupsCount?, questionMode ('subject' | 'exam_paper' | 'random_mix'), subjectId?, examPaperId?, mixedSubjectIds[], totalQuestions, timeWindowMinutes, topNScoring, minParticipants, registrationOpensAt?, registrationClosesAt?, status ('draft' | 'registration' | 'ongoing' | 'completed'), liveMatch?: {schoolA, schoolB} (fixture only), createdBy, createdAt}` — seed: none (as live).

### 6.8 DATA-M16-12 — League, LeagueSchool, LeagueStanding (owner M16)

| Entity | Fields | Notes |
|---|---|---|
| League | id (int; seed 1, 2; runtime from 3), name, type, scope, subjectId?, gameMode, classLevels[], scoringMethod, startDate, endDate, maxSchools?, inviteCode (8), creatorId, status (`upcoming`, `ongoing`, `ended`), createdAt | §6.11.5 |
| LeagueSchool | leagueId, schoolId, joinedAt | |
| LeagueStanding | leagueId, level, schoolId, peserta, skor (1 decimal), purata (1 decimal %) , order | stored job output |

### 6.9 DATA-M16-13 — SekolahBersaingWeek (owner M16) and DATA-M16-14 — GameSettings (owner M16)

| Entity | Fields | Notes |
|---|---|---|
| SekolahBersaingWeek | weekStart (Monday), rows[{rank, schoolId, aktifPct (1 decimal), streakAvg (1 decimal), notaPer10 (1 decimal), anonymous}] | stored weekly job output |
| GameSettings | `boardgame_quiz_tiles` int 0–38 | seed 35 |
| PbQuickMatchSearch | userId, subject, matchMode, status (`searching`, `matched`, `expired`, `cancelled`), polls, roomCode?, createdAt | BR-M16-24 |

### 6.10 Named count queries (every displayed count cites one)

| Query | Definition | Value at the clock | Figures |
|---|---|---|---|
| Q-BAT-SCH(period, state?) | school standings of the period, computed from Battle (BR-M16-12/13) | weekly 0 · monthly 1 (8082) · all_time 7 | S3 rows, podium; S4 rank |
| Q-BAT-STU(period) | student standings of the period, computed from Battle | weekly 0 · monthly 2 (4316, 4317) · all_time every battle player | S2 rows |
| Q-BAT-RECENT(school) | ≤ 10 finished battles of the school (BR-M16-14) | 8106 10 · 8090 9 · 8078 10 · 8082 5 · 8880 3 · 2710 3 · 8080 10 · 900 0 | S4 "Battle Terkini" |
| Q-BAT-USER(user) | finished and forfeited battles of the user | user 1: 0 | S5, S6 chip |
| Q-M16-BATTLES() | all battles / `active` / `finished` (M17 Q-M17-BATTLES, XR-M17-15) | 168 / 0 / 66 | M17 S1 "Battle Arena" |
| Q-M16-BATTLES-WIN(window) | battles created in the window (any status) · submitted game results in the window, both by students | 7 d 0 · 0; 30 d 4 · 5; 90 d 23 · 47 | M17 "Battle" / "Permainan" counts |
| Q-PB-TOP10 | BR-M16-22 | 10 rows | S7 Top 10 |
| Q-PB-PLAYED(user) | Papan Bijak `jumlah` of the user | user 1: 6 | S6 chip |
| Q-LOBBY-TOP(game) | BR-M16-23 | Perang Fakta 10 · Benteng 8 · Perlumbaan 10 · Kuiz Relay 1 · Teka 6 | S8–S12 "🏆 Pendahulu" |
| Q-OPEN-ROOMS | BR-M16-17 | 0 | S6 strip |
| Q-ROOMS · Q-ROOMS-PLAYING · Q-ROOMS-FINISHED | rooms total / `playing` / `finished` | 160 · 0 · 0 | S29 tiles |
| Q-ROOM-PLAYERS | distinct users over RoomPlayer | 189 | S29 "Pemain Unik" |
| Q-SPIN(user) | SpinStats spins / won | user 1: 2 / 0 | S18 chips |
| Q-JUT-COUNT(darjah, subject) | M04 named query `questions.jutawan.count(subjectId, level)` (`jutawanQuestions`, M04 v1.11; XR-M16-01 applied) | discovery A.7 (143 cells, Σ 149,911) | S19 "{n} soalan" |
| Q-JUT-STATS(user) | bestLevel / games | user 1: 0 / 0 | S19 stats |
| Q-WEEK-RANK(week) | M05 BR-M16-31 | 20 rows (anchors §6.11.4 + designed users per M05) | S20 |
| Q-TOURN-ACTIVE | tournaments `registration` or `ongoing` | 0 | S23, banner |
| Q-LEAGUE-MINE(user) · Q-LEAGUE-OPEN | BR-M16-33 | user 1: 0 · 1 | S25 tab counts |
| Q-LEAGUE-SCHOOLS(id) | LeagueSchool count | 1: 3 · 2: 2 | S25 / S27 "{n} sekolah" |
| Q-SB-WEEK(week) | rows of the week snapshot | 2026-09-21: 49 · 09-14: 48 · 09-07: 48 · 08-31: 48 · others 0 | S28 line |
| DC-M16-01 | documented display constant (DV-M16-32) | 10,218 | S3 subtitle only |
| DC-M16-02 | **retired in v1.4** (replaced by M04 Q-JUT-COUNT) | — | — |
| DC-M16-03 | stored "Ketepatan" / "Skor" of the 8 observed school standings (DV-M16-32) | §6.11.2 | S3, S4 |

### 6.11 Seed and dataset spec

#### 6.11.0 Dataset spec (format of M02 §6.15 / M10 §6.2.1)

| Store | Kind, total and source | Count-relevant fields | Observed counts (evidence) | Ids | Anchors (seed) | D9 / D11 value |
|---|---|---|---|---|---|---|
| Battle | materialised; **168** seed rows = 47 observed "Battle Terkini" rows (8880 and 2710 share 3) + 24 generated older battles (8106 9, 8078 10, 8080 5; 5 of the 8078 ones `forfeited`) that reach the observed totals + 97 `abandoned` battles of the 22 no-class anchors (M17 totals) | schoolAId, schoolBId, winner, status, createdAt | S4 lists (snapshot), S3 totals, M17 168 / 0 / 66 and 0 / 4 / 23 | UUID; seeds fixed | §6.11.1 | DV-M16-35 (0–0 → B), DV-M16-36 (8082) |
| BattleStanding | computed view of Battle; stored Ketepatan / Skor of the 8 observed school rows (DC-M16-03) | scope, period, subjectId | all_time 7, monthly 1, weekly 0 (snapshot) | composite | §6.11.2 | DV-M16-26, DV-M16-36 |
| GameStanding | materialised display data | game, userId | 35 lobby rows + 10 Papan Bijak rows (snapshot) | composite | §6.11.3 | DV-M16-08 (stable ties) |
| GameRoom / RoomPlayer | materialised, **160** generated rooms (status `closed`), players generated so that distinct users = **189** | status, game | S29 160 / 0 / 0 / 189 | codes from the stream `m16:seed-rooms`; generated players = the 38 users of the game standings (§6.11.3) + 151 generated students of M02 | none beyond the standing users | DV-M16-16 (replicate) |
| SekolahBersaingWeek | materialised snapshots: 4 weeks | weekStart, rows | 21 Sep 49 rows (observed values); 14 Sep, 07 Sep, 31 Aug 48 rows each (observed by the audit: the 21 Sep schools without row #46, observed order and values; every cell confirmed by the top-up TU-M16-01, §6.11.6) | week key | §6.11.6 | none |
| League / LeagueSchool / LeagueStanding | materialised 2 / 5 / 4 | status, schools | liga 1, 2 (snapshot) | 1, 2; runtime 3+ | §6.11.5 | DV-M16-11 (stored status) |
| PersonalBest / SpinStats / JutawanStats | materialised per user | — | admin 38 / 40; 2 spins / 0; L0 / 0 | user id | user 1 | none |
| GameSettings | 1 row | — | 35 | — | — | none |
| GameSession | materialised; **47** submitted results (M17 games 0 / 5 / 47 over 7 / 30 / 90 days) | createdAt, userId, game | M17 S1 | session ids | §6.11.1 | none |
| Tournament, BattleQueue, BattleInvitation, Spin, PbQuickMatchSearch | runtime (empty seed) | — | live 0 / empty | runtime | test fixtures §6.11.7 | none |

#### 6.11.1 Battles (47; `createdAt` chosen so the S4 relative text is the observed one at the clock; within one bin the minutes keep the live list order)

Players are the fictitious anchors (§6.11.4); "school" = school at battle time; the current school of each player (M02, XR-M16-04) gives the S4 colour: 4301 → 8106, 4320 → 8880, 4321 → 2710; 4302–4310 → 9167, 4311–4315, 4318, 4319, 4322–4324 → 9806, 4325 → 2418 (M02 v1.23, XR-M02-01); 4316, 4317 → no school (PROPOSED; fits the 47 observed colours: none of 9167, 9806, 2418 is a listed school, so every such player A stays `text-blue-600` as before). The school at battle time is the stored `schoolAId` / `schoolBId` of each row below and does not follow the v1.23 move.

| # | createdAt | player A (school) | score A | score B | player B (school) | winner | S4 text | listed on |
|---|---|---|---:|---:|---|---|---|---|
| 1 | 2026-07-20T21:58:00+08:00 | 4301 (8106) | 9445 | 9763 | 4302 (no school) | B | "2 bulan yang lepas" | 8106 |
| 2 | 2026-07-20T21:57:00+08:00 | 4301 (8106) | 8830 | 8830 | 4302 (no school) | seri | "2 bulan yang lepas" | 8106 |
| 3 | 2026-07-20T21:56:00+08:00 | 4301 (8106) | 8514 | 8663 | 4302 (no school) | B | "2 bulan yang lepas" | 8106 |
| 4 | 2026-07-20T21:55:00+08:00 | 4301 (8106) | 7730 | 9497 | 4302 (no school) | B | "2 bulan yang lepas" | 8106 |
| 5 | 2026-07-20T21:54:00+08:00 | 4301 (8106) | 9196 | 9780 | 4302 (no school) | B | "2 bulan yang lepas" | 8106 |
| 6 | 2026-07-20T21:53:00+08:00 | 4301 (8106) | 883 | 0 | 4302 (no school) | A | "2 bulan yang lepas" | 8106 |
| 7 | 2026-07-20T21:52:00+08:00 | 4301 (8106) | 8447 | 8413 | 4302 (no school) | A | "2 bulan yang lepas" | 8106 |
| 8 | 2026-07-20T21:51:00+08:00 | 4301 (8106) | 0 | 950 | 4302 (no school) | B | "2 bulan yang lepas" | 8106 |
| 9 | 2026-06-20T21:58:00+08:00 | 4302 (no school) | 0 | 3682 | 4303 (8106) | B | "3 bulan yang lepas" | 8106 |
| 10 | 2026-06-20T21:57:00+08:00 | 4302 (no school) | 9629 | 2698 | 4303 (8106) | A | "3 bulan yang lepas" | 8106 |
| 11 | 2026-06-20T21:56:00+08:00 | 4304 (8090) | 3099 | 3814 | 4305 (8090) | B | "3 bulan yang lepas" | 8090 |
| 12 | 2026-06-20T21:55:00+08:00 | 4304 (8090) | 0 | 9146 | 4305 (8090) | B | "3 bulan yang lepas" | 8090 |
| 13 | 2026-06-20T21:54:00+08:00 | 4304 (8090) | 8046 | 7746 | 4305 (8090) | A | "3 bulan yang lepas" | 8090 |
| 14 | 2026-06-20T21:53:00+08:00 | 4304 (8090) | 6897 | 7580 | 4305 (8090) | B | "3 bulan yang lepas" | 8090 |
| 15 | 2026-06-20T21:52:00+08:00 | 4305 (8090) | 4665 | 2015 | 4304 (8090) | A | "3 bulan yang lepas" | 8090 |
| 16 | 2026-06-20T21:51:00+08:00 | 4305 (8090) | 5380 | 1366 | 4304 (8090) | A | "3 bulan yang lepas" | 8090 |
| 17 | 2026-06-20T21:50:00+08:00 | 4304 (8090) | 8946 | 8230 | 4305 (8090) | A | "3 bulan yang lepas" | 8090 |
| 18 | 2026-06-20T21:49:00+08:00 | 4305 (8090) | 0 | 0 | 4304 (8090) | B (0–0, INFERRED) | "3 bulan yang lepas" | 8090 |
| 19 | 2026-06-20T21:48:00+08:00 | 4305 (8090) | 0 | 0 | 4304 (8090) | B (0–0, INFERRED) | "3 bulan yang lepas" | 8090 |
| 20 | 2026-05-20T21:58:00+08:00 | 4306 (8078) | 0 | 800 | 4307 (8078) | B | "4 bulan yang lepas" | 8078 |
| 21 | 2026-05-20T21:57:00+08:00 | 4306 (8078) | 0 | 5965 | 4307 (8078) | B | "4 bulan yang lepas" | 8078 |
| 22 | 2026-05-20T21:56:00+08:00 | 4307 (8078) | 0 | 7946 | 4306 (8078) | B | "4 bulan yang lepas" | 8078 |
| 23 | 2026-05-20T21:55:00+08:00 | 4307 (8078) | 0 | 0 | 4306 (8078) | B (0–0, INFERRED) | "4 bulan yang lepas" | 8078 |
| 24 | 2026-05-20T21:54:00+08:00 | 4307 (8078) | 0 | 0 | 4306 (8078) | B (0–0, INFERRED) | "4 bulan yang lepas" | 8078 |
| 25 | 2026-05-20T21:53:00+08:00 | 4308 (8078) | 6780 | 7382 | 4309 (8078) | B | "4 bulan yang lepas" | 8078 |
| 26 | 2026-05-20T21:52:00+08:00 | 4309 (8078) | 5914 | 6031 | 4308 (8078) | B | "4 bulan yang lepas" | 8078 |
| 27 | 2026-05-20T21:51:00+08:00 | 4310 (8078) | 9681 | 8911 | 4311 (8078) | A | "4 bulan yang lepas" | 8078 |
| 28 | 2026-05-20T21:50:00+08:00 | 4312 (8078) | 0 | 6931 | 4313 (8078) | B | "4 bulan yang lepas" | 8078 |
| 29 | 2026-04-20T21:58:00+08:00 | 4314 (8078) | 2398 | 2583 | 4315 (8078) | B | "5 bulan yang lepas" | 8078 |
| 30 | 2026-09-16T21:58:00+08:00 | 4316 (8082) | 8313 | 6230 | 4317 (8082) | A | "1 minggu yang lepas" | 8082 |
| 31 | 2026-09-16T21:57:00+08:00 | 4316 (8082) | 0 | 0 | 4317 (8082) | B (0–0, INFERRED) | "1 minggu yang lepas" | 8082 |
| 32 | 2026-09-16T21:56:00+08:00 | 4316 (8082) | 8430 | 8930 | 4317 (8082) | B | "1 minggu yang lepas" | 8082 |
| 33 | 2026-09-16T21:55:00+08:00 | 4316 (8082) | 6431 | 3465 | 4317 (8082) | A | "1 minggu yang lepas" | 8082 |
| 34 | 2026-05-20T21:49:00+08:00 | 4318 (8082) | 0 | 4515 | 4319 (8082) | B | "4 bulan yang lepas" | 8082 |
| 35 | 2026-03-20T21:58:00+08:00 | 4320 (8880) | 0 | 816 | 4321 (2710) | B | "6 bulan yang lepas" | 8880, 2710 |
| 36 | 2026-03-20T21:57:00+08:00 | 4321 (2710) | 0 | 0 | 4320 (8880) | B (0–0, INFERRED) | "6 bulan yang lepas" | 2710, 8880 |
| 37 | 2026-03-20T21:56:00+08:00 | 4320 (8880) | 966 | 0 | 4321 (2710) | A | "6 bulan yang lepas" | 8880, 2710 |
| 38 | 2026-06-20T21:47:00+08:00 | 4322 (8080) | 6131 | 7329 | 4323 (8080) | B | "3 bulan yang lepas" | 8080 |
| 39 | 2026-06-20T21:46:00+08:00 | 4323 (8080) | 6714 | 0 | 4322 (8080) | A | "3 bulan yang lepas" | 8080 |
| 40 | 2026-06-20T21:45:00+08:00 | 4323 (8080) | 0 | 6447 | 4322 (8080) | B | "3 bulan yang lepas" | 8080 |
| 41 | 2026-06-20T21:44:00+08:00 | 4324 (8080) | 0 | 0 | 4325 (8080) | B (0–0, INFERRED) | "3 bulan yang lepas" | 8080 |
| 42 | 2026-06-20T21:43:00+08:00 | 4324 (8080) | 0 | 0 | 4325 (8080) | B (0–0, INFERRED) | "3 bulan yang lepas" | 8080 |
| 43 | 2026-06-20T21:42:00+08:00 | 4325 (8080) | 0 | 1516 | 4324 (8080) | B | "3 bulan yang lepas" | 8080 |
| 44 | 2026-06-20T21:41:00+08:00 | 4324 (8080) | 0 | 0 | 4325 (8080) | B (0–0, INFERRED) | "3 bulan yang lepas" | 8080 |
| 45 | 2026-06-20T21:40:00+08:00 | 4325 (8080) | 0 | 0 | 4324 (8080) | B (0–0, INFERRED) | "3 bulan yang lepas" | 8080 |
| 46 | 2026-06-20T21:39:00+08:00 | 4325 (8080) | 2815 | 1132 | 4324 (8080) | A | "3 bulan yang lepas" | 8080 |
| 47 | 2026-06-20T21:38:00+08:00 | 4324 (8080) | 0 | 2932 | 4325 (8080) | B | "3 bulan yang lepas" | 8080 |

Battle totals: 47 rows; per school list: 8106 10, 8090 9, 8078 10, 8082 5, 8880 3, 2710 3 (the 8880 rows), 8080 10, 900 0.

Winner rule of the seed rows: higher score; equal non-zero scores = seri (battle 2); **0–0 = win for player B** (ten rows; INFERRED from the observed standings, DV-M16-35). The school "at battle time" of 4302 is none (**INFERRED**: it is blue on the 8106 list, and only without its sides does 8106 stay at 19 sides).

**Generated older battles (D11 virtual rows; never in a 10-row list, because each such school's list is already full):**
- 8106 — 9 battles on 2026-02-01 … 2026-02-09 at 21:00. Player A is a pupil of 8106 at battle time (5 generated M02 students, so 8106 has 7 distinct pupils with 4301 and 4303). Player B is a generated student without a school. A wins each (PROPOSED scores: A 5,000–9,000, B lower).
- 8078 — 10 intra-school battles on 2026-02-10 … 2026-02-19 (8 generated pupils, 18 with 4306–4315), each with one winner and no tie.
- 8080 — 5 intra-school battles on 2026-02-20 … 2026-02-24 (6 generated pupils, 10 with 4322–4325), each with one winner.

Players are drawn from the stream `m16:seed-battles`; `correct` = floor(score ÷ 500), capped at 10 (PROPOSED). Five of the ten generated 8078 battles are `forfeited` by their loser (the outcome is unchanged, so every standing stays).

**M17 totals (XL3-17, PROPOSED records).** 97 `abandoned` battles between the 22 no-class anchors (4302–4319, 4322–4325; no school at battle time, so no standing, S4 list or M11 effect): 11 created between 2026-06-27 and 2026-08-25, 86 between 2026-01-05 and 2026-06-19. With the 47 listed (battles 1–8 on 20 Jul and 30–33 on 16 Sep inside the 90-day window) this gives Q-M16-BATTLES 168 total / 0 active / 66 finished and 0 / 4 / 23 battles over 7 / 30 / 90 days. **47 submitted game results** (S13–S17 games, PROPOSED mix) of the same 22 anchors: 5 between 2026-08-27 and 2026-09-17, 42 between 2026-06-27 and 2026-08-25 (0 / 5 / 47); they pay no syiling (M14 seed) and write no ledger row. Checked by `stand.cjs`: every observed standing reproduced, M17 counts exact. With the 47 listed battles, these give the observed all-time "Battle", "M/S/K" and "Pelajar" of every school exactly, except 8082 (DV-M16-36).

#### 6.11.2 Battle standings (computed from the records; Ketepatan and Skor stored, DC-M16-03)

Rule: one side per player whose school at battle time is the school (a battle between two pupils of one school counts twice); the outcome follows the winner rule above; periods per BR-M16-15. Result at the clock (✓ = equal to live):

| Period | Order | School | "{negeri} · {jenis}" | Battle | M | S | K | Pelajar | Ketepatan (DC) | Skor (DC) | vs live |
|---|---:|---|---|---:|---:|---:|---:|---:|---|---:|---|
| all_time | 1 | 8106 | Selangor · SMK | 19 | 12 | 1 | 6 | 7 | 69% | 738 | ✓ |
| all_time | 2 | 8090 | Selangor · SMK | 18 | 9 | 0 | 9 | 2 | 48% | 519 | ✓ |
| all_time | 3 | 8078 | Selangor · SMK | 40 | 20 | 0 | 20 | 18 | 29% | 367 | ✓ |
| all_time | 4 | 8082 | Selangor · SMK | 10 | 5 | 0 | 5 | 4 | 29% | 367 | DV-M16-36 (live 40 · 20/0/20 · 18) |
| all_time | 5 | 8880 | Johor · SMK | 3 | 2 | 0 | 1 | 1 | 33% | 340 | ✓ |
| all_time | 6 | 8080 | Selangor · SMK | 30 | 15 | 0 | 15 | 10 | 24% | 303 | ✓ |
| all_time | 7 | 2710 | Johor · SK | 3 | 1 | 0 | 2 | 1 | 8% | 87 | ✓ |
| monthly (2026-09) | 1 | 8082 | Selangor · SMK | 8 | 4 | 0 | 4 | 2 | 58% | 591 | ✓ |

Other standings:
- Weekly (week of 2026-09-21): none (✓).
- Student standings: weekly none. Monthly: 4316 and 4317, 2/0/2 each (battles 30–33); their ketepatan, streak and skor are PROPOSED (DV-M16-26). All time: computed from every battle (not shown on S2).
- Equal Skor keep the stored order (8078 before 8082).

S4 hero lines (M02 anchors, XR-M16-04):
- 8106, 8090, 8078, 8082, 8080: "PPD HULU LANGAT · Selangor · SMK".
- 8880: "PPD KLUANG · Johor · SMK".
- 2710: "PPD KLUANG · Johor · SK".
- 900: "PPD KUALA LANGAT · Selangor · SK" (no battle).


#### 6.11.3 Game standings (observed order = stored order)

| Game | Rows (order: user id = value) |
|---|---|
| Perang Fakta (wins) | 1. 4326 = 5 · 2. 4327 = 4 · 3. 4328 = 3 · 4. 4329 = 3 · 5. 4330 = 3 · 6. 4331 = 3 · 7. 4302 = 3 · 8. 4332 = 2 · 9. 4333 = 2 · 10. 4334 = 2 |
| Benteng Ilmu (wins) | 1. 4335 = 2 · 2. 4301 = 1 · 3. 4336 = 1 · 4. 4320 = 1 · 5. 4337 = 1 · 6. 4331 = 1 · 7. 4338 = 1 · 8. 4339 = 1 |
| Perlumbaan Matematik (wins) | 1. 4330 = 2 · 2. 4302 = 2 · 3. 4340 = 1 · 4. 4341 = 1 · 5. 4342 = 1 · 6. 4343 = 1 · 7. 4344 = 1 · 8. 4325 = 1 · 9. 4345 = 1 · 10. 4346 = 1 |
| Kuiz Relay (MVP) | 1. 4331 = 1 |
| Teka Silang Kata (wins) | 1. 4332 = 1 · 2. 4347 = 1 · 3. 4348 = 1 · 4. 4349 = 1 · 5. 4350 = 1 · 6. 4328 = 1 |

Papan Bijak (Top 10; name length class from live: "long" = more than 15 characters, so the M02 name of that anchor must be longer than 15 characters):

| Rank | User | Menang | Jumlah | Kadar | Pill | Skor | Betul | Name |
|---:|---|---:|---:|---|---|---:|---:|---|
| 1 | 1 (admin) | 4 | 6 | 67% | amber | 90 | 13 | ≤ 15 characters |
| 2 | 4320 | 3 | 4 | 75% | green | 170 | 9 | ≤ 15 characters |
| 3 | 4352 | 2 | 4 | 50% | amber | 230 | 18 | > 15 characters |
| 4 | 4353 | 2 | 8 | 25% | red | 225 | 46 | > 15 characters |
| 5 | 4354 | 2 | 6 | 33% | red | 185 | 26 | > 15 characters |
| 6 | 4355 | 2 | 2 | 100% | green | 185 | 11 | ≤ 15 characters |
| 7 | 4356 | 2 | 3 | 67% | amber | 165 | 19 | > 15 characters |
| 8 | 4321 | 2 | 5 | 40% | amber | 100 | 14 | ≤ 15 characters |
| 9 | 4357 | 2 | 6 | 33% | red | 65 | 13 | > 15 characters |
| 10 | 4358 | 2 | 3 | 67% | amber | 60 | 10 | > 15 characters |

Distinct users in the game standings: 38 (all are room players of the seed rooms).

#### 6.11.4 Fictitious user anchors (XR-M16-04; placements per M02 v1.12 §6.15 D, no-class players per M02 v1.23 XR-M02-01)

Each discovery token `<student:n>` is user 4300 + n, with these exceptions:
- **Token 51** is the admin itself (user 1).
- **Tokens 59–63** (the S20 week top five) are M17's persons: pupil **2022** and M17's four 8082 week pupils. XR-M16-09 proposes ids 2013–2016 for those four.
- **Tokens 64–77** appear only on the post-clock S20 and are not seeded (XL3-16).

One person has one id, so users **4359–4377 are not created**.

| Ids | Role · school · grade | Login / class | Used by M16 |
|---|---|---|---|
| 4301 | student · 8106 · T5 register row | per the 8106 cell (logged in, Aktif) | battles 1–8, Benteng Ilmu |
| 4320 | student · 8880 · T5 register row (not one of the 26 T4) | logged in | battles 35–37, Papan Bijak #2, Benteng Ilmu |
| 4321 | student · 2710 · **primary (Darjah 6)**, one of 2710's 4 pupils, not the answering one | never logged in | battles 35–37, Papan Bijak #8 |
| 4302–4319, 4322–4325 (22) | students · **no M10 class** · current school and grade per M02 v1.23 (XR-M02-01): **4302–4310** at **9167** and **4311–4315, 4318, 4319, 4322–4324** at **9806** (Tingkatan 1–3, grades 7–9, M02 generator split); **4325** at **2418** (Darjah 6); **4316, 4317** no school, grade 10 (the S2 monthly rows, DV-M16-26). Battle rows keep their stored battle-time school (§6.11.1), so no M16 value changes | never logged in | battles, lobby standings, the abandoned battles and the 47 game results of §6.11.1 |
| 4326–4358 except 4351 (32) | students · no school · grade 10 · T4-class members (T4 pool) | never logged in | lobby standings and Papan Bijak Top 10 |
| 4401 | teacher · no school | logged in | league 1 creator |

The anchors marked "> 15 characters" in §6.11.3 get names longer than 15 characters. The M02 row "4326–4377 \ 4351 (51)" shrinks to 4326–4358 \ 4351 (32) (XR-M16-04).

**S20 weekly ranking at the project clock** (Q-WEEK-RANK of M05 v1.10, BR-M16-31; XL3-16). The live page was read on Saturday 26 Sep at 14:22, after the clock. It is kept as the observed record (discovery snapshot): 4359 → 450 · 23 · 99.6 … rank 20 → 26 · 1 · 65.0; Σ 138 sessions, 2,098 correct. The seed restates it at 25 Sep 15:40:
- Ranks 1–5 are the same persons, with M17's pre-clock values: 2022 = 452 answers · 450 correct; W2 = 330 · 329, 75 post-clock answers removed; W3, W4, W5 as observed.
- **8106 pupils:** the 1,761-month pupil and 8106 pupils A and B have their week sessions in SPM modes, which S20 excludes (XR-M16-09).
- **Ranks 6–20** are M02 generated register pupils (M05 places the sessions). They sit at the schools of M17 §6.7 B, inside M17's week figures:
  - Named pupils use 1,793 answers; the remaining 715 are 8106 90, 8082 70, 8078 295, 8080 100, 8090 95, 8088 20, 8284 5 and no school 40.
  - Nine observed row values (100, 78, 60, 46, 36, 34, 29, 28, 26) are kept where the per-school budgets allow. The rest are the remainders.
  - The no-school 40 answers are held by 7 pupils with at most 5 correct each, so none enters the top 20.
- The joint script check `wk.cjs` matches every per-school answer total, accuracy (1 decimal) and pupil count of M17 §6.7 B exactly.
- Every value except ranks 1, 3, 4 and 5 is **PROPOSED**. Designed accounts enter at their computed rank (M05; pelajarmaju ties 26 and wins on id 4, XL3-27).


| Rank | Pupil | School | Sesi | Betul | Tepat | Source |
|---:|---|---|---:|---:|---:|---|
| 1 | 2022 | 8080 | 23 | 450 | 99.6 | observed (pupil 2022; S20 rank 1 = token 59) |
| 2 | W2 | 8082 | 18 | 329 | 99.7 | observed person (S20 rank 2, token 60); values at the clock (M17: 330 answers · 99.7 %), sessions PROPOSED |
| 3 | W4 | 8082 | 15 | 187 | 90.7 | observed (S20 rank 3, token 61) |
| 4 | W3 | 8082 | 11 | 145 | 61.4 | observed (S20 rank 4, token 62) |
| 5 | W5 | 8082 | 4 | 118 | 73.8 | observed (S20 rank 5, token 63) |
| 6 | 8078-a | 8078 | 11 | 100 | 75.0 | PROPOSED placement of the observed row r6 |
| 7 | 8090-a | 8090 | 2 | 78 | 97.5 | PROPOSED placement of the observed row r9 |
| 8 | 8078-b | 8078 | 3 | 60 | 100.0 | PROPOSED placement of the observed row r11 |
| 9 | 8080-a | 8080 | 6 | 46 | 76.7 | PROPOSED placement of the observed row r13 |
| 10 | 8078-c | 8078 | 3 | 36 | 88.3 | PROPOSED placement of the observed row r14 |
| 11 | 8082-e | 8082 | 2 | 34 | 85.0 | PROPOSED placement of the observed row r15 |
| 12 | 8106-a | 8106 | 4 | 29 | 72.5 | PROPOSED placement of the observed row r17 |
| 13 | 8106-b | 8106 | 5 | 28 | 96.0 | PROPOSED placement of the observed row r19 |
| 14 | 4 (pelajarmaju) | 900004 SK Demo Bestari | 4 | 26 | (M05) | designed pelajarmaju (M05) |
| 15 | 8078-d | 8078 | 1 | 26 | 65.0 | PROPOSED placement of the observed row r20 |
| 16 | 8088-a | 8088 | 1 | 15 | 75.0 | PROPOSED (M17 remainder) |
| 17 | 8082-f | 8082 | 1 | 13 | 86.7 | PROPOSED (M17 remainder) |
| 18 | 8090-b | 8090 | 1 | 11 | 73.3 | PROPOSED (M17 remainder) |
| 19 | 8078-e | 8078 | 1 | 10 | 47.6 | PROPOSED (M17 remainder) |
| 20 | 8080-b | 8080 | 1 | 10 | 40.0 | PROPOSED (M17 remainder) |


#### 6.11.5 Leagues (observed; ids kept)

| id | name | type · scope | subject | levels | scoring | dates | code | creator | status | schools | standings |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | "Liga Sejarah 2026 5ST" | friendly · school | 5 Sejarah | T5 | total_score | 2026-03-31 – 2026-04-01 | `RMU4VCBS` | 4401 | upcoming ("Akan Datang") | 8080, 8082, 8106 | none |
| 2 | "Liga Matematik Sprint Test" | friendly · school | 1 Bahasa Melayu (as the live chip) | T4, T5 | total_score | 2026-04-01 – 2026-04-30 | `TEST2026` | 1 (admin) | ended ("Tamat") | 8078, 8090 | T4: 1. 8090 peserta 8, skor 2935.0, purata 77.2 · 2. 8078 0, 0.0, 0.0; T5: 1. 8090 0, 0.0, 0.0 · 2. 8078 0, 0.0, 0.0 |

`gameMode` and `maxSchools` of both leagues are not shown anywhere: PROPOSED `mixed` and null. Admin (school 900002) is in neither → "Liga Saya (0)", "Liga Terbuka (1)".

#### 6.11.6 Sekolah Bersaing (week of 2026-09-21, observed values)

School ids: the n-th row of a state takes the n-th school of that state in the M02 register (ascending id), skipping the fixture schools 900001–900099 and the battle anchors 2710, 8078, 8080, 8082, 8090, 8106, 8880, 900 (PROPOSED placement; M02 names; XR-M16-04). Per state: Selangor 22, Johor 5, Sabah 4, Kuala Lumpur 4, Kedah 3, Pahang 3, Kelantan 2, Perak 2, Melaka 2, Terengganu 2 (Σ 49). "SB-{state}-{n}" below names that placement.

| Rank | Style | State | School | % Aktif | Streak Avg | Nota/Pelajar |
|---|---|---|---|---:|---:|---:|
| 🥇 | gold | Kelantan | SB-Kelantan-1 | 0.0% | 15.0 | 0.0 |
| 🥈 | silver | Johor | SB-Johor-1 | 0.0% | 9.3 | 0.0 |
| 🥉 | bronze | Sabah | SB-Sabah-1 | 0.0% | 8.6 | 0.0 |
| #4 | — | Sabah | SB-Sabah-2 | 0.0% | 8.4 | 0.0 |
| #5 | — | Selangor | SB-Selangor-1 | 0.0% | 8.2 | 0.0 |
| #6 | — | Selangor | SB-Selangor-2 | 0.0% | 8.1 | 0.0 |
| #7 | — | Johor | SB-Johor-2 | 0.0% | 7.9 | 0.0 |
| #8 | — | Kedah | SB-Kedah-1 | 0.0% | 7.2 | 0.0 |
| #9 | — | Perak | SB-Perak-1 | 0.0% | 7.0 | 0.0 |
| #10 | — | Johor | SB-Johor-3 | 0.0% | 6.8 | 0.0 |
| #11 | — | Melaka | SB-Melaka-1 | 0.0% | 6.6 | 0.0 |
| #12 | — | Johor | SB-Johor-4 | 0.0% | 6.4 | 0.0 |
| #13 | — | Kedah | SB-Kedah-2 | 0.0% | 5.7 | 0.0 |
| #14 | — | Melaka | SB-Melaka-2 | 0.0% | 5.6 | 0.0 |
| #15 | — | Johor | SB-Johor-5 | 0.0% | 5.3 | 0.0 |
| #16 | — | Perak | SB-Perak-2 | 0.0% | 4.9 | 0.0 |
| #17 | — | Selangor | SB-Selangor-3 | 0.5% | 1.6 | 0.0 |
| #18 | — | Selangor | SB-Selangor-4 | 0.0% | 1.8 | 0.0 |
| #19 | — | Selangor | SB-Selangor-5 | 0.4% | 1.1 | 0.0 |
| #20 | — | Kelantan | SB-Kelantan-2 | 0.0% | 1.4 | 0.0 |
| #21 | — | Selangor | SB-Selangor-6 | 0.0% | 1.1 | 0.0 |
| #22 | — | Selangor | SB-Selangor-7 | 0.0% | 1.1 | 0.0 |
| #23 | — | Selangor | SB-Selangor-8 | 0.0% | 1.1 | 0.0 |
| #24 | — | Selangor | SB-Selangor-9 | 0.0% | 1.0 | 0.0 |
| #25 | — | Selangor | SB-Selangor-10 | 0.0% | 1.0 | 0.0 |
| #26 | — | Selangor | SB-Selangor-11 | 0.0% | 1.0 | 0.0 |
| #27 | — | Selangor | SB-Selangor-12 | 0.0% | 1.0 | 0.0 |
| #28 | — | Selangor | SB-Selangor-13 | 0.0% | 1.0 | 0.0 |
| #29 | — | Selangor | SB-Selangor-14 | 0.0% | 1.0 | 0.0 |
| #30 | — | Selangor | SB-Selangor-15 | 0.0% | 1.0 | 0.0 |
| #31 | — | Selangor | SB-Selangor-16 | 0.0% | 1.0 | 0.0 |
| #32 | — | Pahang | SB-Pahang-1 | 0.0% | 1.0 | 0.0 |
| #33 | — | Pahang | SB-Pahang-2 | 0.0% | 1.0 | 0.0 |
| #34 | — | Kedah | SB-Kedah-3 | 0.0% | 1.0 | 0.0 |
| #35 | — | Terengganu | SB-Terengganu-1 | 0.0% | 1.0 | 0.0 |
| #36 | — | Terengganu | SB-Terengganu-2 | 0.0% | 1.0 | 0.0 |
| #37 | — | Sabah | SB-Sabah-3 | 0.0% | 1.0 | 0.0 |
| #38 | — | Selangor | SB-Selangor-17 | 0.0% | 1.0 | 0.0 |
| #39 | — | Selangor | SB-Selangor-18 | 0.0% | 1.0 | 0.0 |
| #40 | — | Selangor | SB-Selangor-19 | 0.0% | 1.0 | 0.0 |
| #41 | — | Selangor | SB-Selangor-20 | 0.0% | 1.0 | 0.0 |
| #42 | — | Selangor | SB-Selangor-21 | 0.0% | 1.0 | 0.0 |
| #43 | — | Pahang | SB-Pahang-3 | 0.0% | 1.0 | 0.0 |
| #44 | — | Kuala Lumpur | SB-KualaLumpur-1 | 0.0% | 1.0 | 0.0 |
| #45 | — | Kuala Lumpur | SB-KualaLumpur-2 | 0.0% | 1.0 | 0.0 |
| #46 | — | Kuala Lumpur | SB-KualaLumpur-3 | 0.0% | 1.0 | 0.0 |
| #47 | — | Sabah | SB-Sabah-4 | 0.0% | 1.0 | 0.0 |
| #48 | — | Kuala Lumpur | SB-KualaLumpur-4 | 0.0% | 1.0 | 0.0 |
| #49 | — | Selangor | SB-Selangor-22 | 0.0% | 0.0 | 0.0 |

Weeks 2026-09-14, 2026-09-07 and 2026-08-31 (observed by the audit round 1 re-walk, AUD-M16-01): each is the 21 Sep list **without its row #46** (Sabah), 48 rows, same school ids, in the observed order; "Nota/Pelajar" 0.0 everywhere; values equal to 21 Sep except the stated ones. Every cell is confirmed by the audit and by discovery top-up TU-M16-01 (`docs/discovery/inventory/M16/_topup-2026-09-26.json`), which corrected three % Aktif cells to 0.0% (14 Sep position 21, 07 Sep position 20, 31 Aug position 20). Any other week: no snapshot (e.g. 2025-01-06 → empty state, OBSERVED).

**Week 2026-09-14** (48 rows; position → 21 Sep rank; values as 21 Sep unless stated; every cell confirmed by the audit round 1 re-walk and top-up TU-M16-01, `_topup-2026-09-26.json`):

| Position | 21 Sep rank | School | State | % Aktif | Streak Avg | Nota/Pelajar |
|---:|---:|---|---|---:|---:|---:|
| 1 | 1 | SB-Kelantan-1 | Kelantan | 0.0% | 15.0 | 0.0 |
| 2 | 2 | SB-Johor-1 | Johor | 0.0% | 9.3 | 0.0 |
| 3 | 3 | SB-Sabah-1 | Sabah | 0.0% | 8.6 | 0.0 |
| 4 | 4 | SB-Sabah-2 | Sabah | 0.0% | 8.4 | 0.0 |
| 5 | 5 | SB-Selangor-1 | Selangor | 0.0% | 8.2 | 0.0 |
| 6 | 6 | SB-Selangor-2 | Selangor | 0.0% | 8.1 | 0.0 |
| 7 | 7 | SB-Johor-2 | Johor | 0.0% | 7.9 | 0.0 |
| 8 | 8 | SB-Kedah-1 | Kedah | 0.0% | 7.2 | 0.0 |
| 9 | 9 | SB-Perak-1 | Perak | 0.0% | 7.0 | 0.0 |
| 10 | 10 | SB-Johor-3 | Johor | 0.0% | 6.8 | 0.0 |
| 11 | 11 | SB-Melaka-1 | Melaka | 0.0% | 6.6 | 0.0 |
| 12 | 12 | SB-Johor-4 | Johor | 0.0% | 6.4 | 0.0 |
| 13 | 13 | SB-Kedah-2 | Kedah | 0.0% | 5.7 | 0.0 |
| 14 | 14 | SB-Melaka-2 | Melaka | 0.0% | 5.6 | 0.0 |
| 15 | 15 | SB-Johor-5 | Johor | 0.0% | 5.3 | 0.0 |
| 16 | 16 | SB-Perak-2 | Perak | 0.0% | 4.9 | 0.0 |
| 17 | 17 | SB-Selangor-3 | Selangor | 0.5% | 1.6 | 0.0 |
| 18 | 20 | SB-Kelantan-2 | Kelantan | 0.0% | 2.4 | 0.0 |
| 19 | 18 | SB-Selangor-4 | Selangor | 0.2% | 1.8 | 0.0 |
| 20 | 48 | SB-KualaLumpur-4 | Kuala Lumpur | 0.0% | 1.5 | 0.0 |
| 21 | 19 | SB-Selangor-5 | Selangor | 0.0% | 1.1 | 0.0 |
| 22 | 21 | SB-Selangor-6 | Selangor | 0.0% | 1.1 | 0.0 |
| 23 | 22 | SB-Selangor-7 | Selangor | 0.0% | 1.1 | 0.0 |
| 24 | 23 | SB-Selangor-8 | Selangor | 0.0% | 1.1 | 0.0 |
| 25 | 24 | SB-Selangor-9 | Selangor | 0.0% | 1.0 | 0.0 |
| 26 | 25 | SB-Selangor-10 | Selangor | 0.0% | 1.0 | 0.0 |
| 27 | 26 | SB-Selangor-11 | Selangor | 0.0% | 1.0 | 0.0 |
| 28 | 27 | SB-Selangor-12 | Selangor | 0.0% | 1.0 | 0.0 |
| 29 | 28 | SB-Selangor-13 | Selangor | 0.0% | 1.0 | 0.0 |
| 30 | 29 | SB-Selangor-14 | Selangor | 0.0% | 1.0 | 0.0 |
| 31 | 30 | SB-Selangor-15 | Selangor | 0.0% | 1.0 | 0.0 |
| 32 | 31 | SB-Selangor-16 | Selangor | 0.0% | 1.0 | 0.0 |
| 33 | 32 | SB-Pahang-1 | Pahang | 0.0% | 1.0 | 0.0 |
| 34 | 33 | SB-Pahang-2 | Pahang | 0.0% | 1.0 | 0.0 |
| 35 | 34 | SB-Kedah-3 | Kedah | 0.0% | 1.0 | 0.0 |
| 36 | 35 | SB-Terengganu-1 | Terengganu | 0.0% | 1.0 | 0.0 |
| 37 | 36 | SB-Terengganu-2 | Terengganu | 0.0% | 1.0 | 0.0 |
| 38 | 37 | SB-Sabah-3 | Sabah | 0.0% | 1.0 | 0.0 |
| 39 | 38 | SB-Selangor-17 | Selangor | 0.0% | 1.0 | 0.0 |
| 40 | 39 | SB-Selangor-18 | Selangor | 0.0% | 1.0 | 0.0 |
| 41 | 40 | SB-Selangor-19 | Selangor | 0.0% | 1.0 | 0.0 |
| 42 | 41 | SB-Selangor-20 | Selangor | 0.0% | 1.0 | 0.0 |
| 43 | 42 | SB-Selangor-21 | Selangor | 0.0% | 1.0 | 0.0 |
| 44 | 43 | SB-Pahang-3 | Pahang | 0.0% | 1.0 | 0.0 |
| 45 | 44 | SB-KualaLumpur-1 | Kuala Lumpur | 0.0% | 1.0 | 0.0 |
| 46 | 45 | SB-KualaLumpur-2 | Kuala Lumpur | 0.0% | 1.0 | 0.0 |
| 47 | 47 | SB-Sabah-4 | Sabah | 0.0% | 1.0 | 0.0 |
| 48 | 49 | SB-Selangor-22 | Selangor | 0.0% | 0.0 | 0.0 |

**Week 2026-09-07** (48 rows; position → 21 Sep rank; values as 21 Sep unless stated; every cell confirmed by the audit round 1 re-walk and top-up TU-M16-01, `_topup-2026-09-26.json`):

| Position | 21 Sep rank | School | State | % Aktif | Streak Avg | Nota/Pelajar |
|---:|---:|---|---|---:|---:|---:|
| 1 | 1 | SB-Kelantan-1 | Kelantan | 0.0% | 15.0 | 0.0 |
| 2 | 2 | SB-Johor-1 | Johor | 0.0% | 9.3 | 0.0 |
| 3 | 3 | SB-Sabah-1 | Sabah | 0.0% | 8.6 | 0.0 |
| 4 | 4 | SB-Sabah-2 | Sabah | 0.0% | 8.4 | 0.0 |
| 5 | 5 | SB-Selangor-1 | Selangor | 0.0% | 8.2 | 0.0 |
| 6 | 6 | SB-Selangor-2 | Selangor | 0.0% | 8.1 | 0.0 |
| 7 | 7 | SB-Johor-2 | Johor | 0.0% | 7.9 | 0.0 |
| 8 | 8 | SB-Kedah-1 | Kedah | 0.0% | 7.2 | 0.0 |
| 9 | 9 | SB-Perak-1 | Perak | 0.0% | 7.0 | 0.0 |
| 10 | 10 | SB-Johor-3 | Johor | 0.0% | 6.8 | 0.0 |
| 11 | 11 | SB-Melaka-1 | Melaka | 0.0% | 6.6 | 0.0 |
| 12 | 12 | SB-Johor-4 | Johor | 0.0% | 6.4 | 0.0 |
| 13 | 13 | SB-Kedah-2 | Kedah | 0.0% | 5.7 | 0.0 |
| 14 | 14 | SB-Melaka-2 | Melaka | 0.0% | 5.6 | 0.0 |
| 15 | 15 | SB-Johor-5 | Johor | 0.0% | 5.3 | 0.0 |
| 16 | 16 | SB-Perak-2 | Perak | 0.0% | 4.9 | 0.0 |
| 17 | 17 | SB-Selangor-3 | Selangor | 0.5% | 1.6 | 0.0 |
| 18 | 18 | SB-Selangor-4 | Selangor | 0.4% | 1.8 | 0.0 |
| 19 | 20 | SB-Kelantan-2 | Kelantan | 0.0% | 2.2 | 0.0 |
| 20 | 19 | SB-Selangor-5 | Selangor | 0.0% | 1.2 | 0.0 |
| 21 | 21 | SB-Selangor-6 | Selangor | 0.0% | 1.1 | 0.0 |
| 22 | 22 | SB-Selangor-7 | Selangor | 0.0% | 1.1 | 0.0 |
| 23 | 23 | SB-Selangor-8 | Selangor | 0.0% | 1.1 | 0.0 |
| 24 | 24 | SB-Selangor-9 | Selangor | 0.0% | 1.0 | 0.0 |
| 25 | 25 | SB-Selangor-10 | Selangor | 0.0% | 1.0 | 0.0 |
| 26 | 26 | SB-Selangor-11 | Selangor | 0.0% | 1.0 | 0.0 |
| 27 | 27 | SB-Selangor-12 | Selangor | 0.0% | 1.0 | 0.0 |
| 28 | 28 | SB-Selangor-13 | Selangor | 0.0% | 1.0 | 0.0 |
| 29 | 29 | SB-Selangor-14 | Selangor | 0.0% | 1.0 | 0.0 |
| 30 | 30 | SB-Selangor-15 | Selangor | 0.0% | 1.0 | 0.0 |
| 31 | 31 | SB-Selangor-16 | Selangor | 0.0% | 1.0 | 0.0 |
| 32 | 32 | SB-Pahang-1 | Pahang | 0.0% | 1.0 | 0.0 |
| 33 | 33 | SB-Pahang-2 | Pahang | 0.0% | 1.0 | 0.0 |
| 34 | 34 | SB-Kedah-3 | Kedah | 0.0% | 1.0 | 0.0 |
| 35 | 35 | SB-Terengganu-1 | Terengganu | 0.0% | 1.0 | 0.0 |
| 36 | 36 | SB-Terengganu-2 | Terengganu | 0.0% | 1.0 | 0.0 |
| 37 | 37 | SB-Sabah-3 | Sabah | 0.0% | 1.0 | 0.0 |
| 38 | 38 | SB-Selangor-17 | Selangor | 0.0% | 1.0 | 0.0 |
| 39 | 39 | SB-Selangor-18 | Selangor | 0.0% | 1.0 | 0.0 |
| 40 | 40 | SB-Selangor-19 | Selangor | 0.0% | 1.0 | 0.0 |
| 41 | 41 | SB-Selangor-20 | Selangor | 0.0% | 1.0 | 0.0 |
| 42 | 42 | SB-Selangor-21 | Selangor | 0.0% | 1.0 | 0.0 |
| 43 | 43 | SB-Pahang-3 | Pahang | 0.0% | 1.0 | 0.0 |
| 44 | 44 | SB-KualaLumpur-1 | Kuala Lumpur | 0.0% | 1.0 | 0.0 |
| 45 | 45 | SB-KualaLumpur-2 | Kuala Lumpur | 0.0% | 1.0 | 0.0 |
| 46 | 47 | SB-Sabah-4 | Sabah | 0.0% | 1.0 | 0.0 |
| 47 | 48 | SB-KualaLumpur-4 | Kuala Lumpur | 0.0% | 1.0 | 0.0 |
| 48 | 49 | SB-Selangor-22 | Selangor | 0.0% | 0.0 | 0.0 |

**Week 2026-08-31** (48 rows; position → 21 Sep rank; values as 21 Sep unless stated; every cell confirmed by the audit round 1 re-walk and top-up TU-M16-01, `_topup-2026-09-26.json`):

| Position | 21 Sep rank | School | State | % Aktif | Streak Avg | Nota/Pelajar |
|---:|---:|---|---|---:|---:|---:|
| 1 | 1 | SB-Kelantan-1 | Kelantan | 0.0% | 15.0 | 0.0 |
| 2 | 2 | SB-Johor-1 | Johor | 0.0% | 9.3 | 0.0 |
| 3 | 3 | SB-Sabah-1 | Sabah | 0.0% | 8.6 | 0.0 |
| 4 | 4 | SB-Sabah-2 | Sabah | 0.0% | 8.4 | 0.0 |
| 5 | 5 | SB-Selangor-1 | Selangor | 0.0% | 8.2 | 0.0 |
| 6 | 6 | SB-Selangor-2 | Selangor | 0.0% | 8.1 | 0.0 |
| 7 | 7 | SB-Johor-2 | Johor | 0.0% | 7.9 | 0.0 |
| 8 | 8 | SB-Kedah-1 | Kedah | 0.0% | 7.2 | 0.0 |
| 9 | 9 | SB-Perak-1 | Perak | 0.0% | 7.0 | 0.0 |
| 10 | 10 | SB-Johor-3 | Johor | 0.0% | 6.8 | 0.0 |
| 11 | 11 | SB-Melaka-1 | Melaka | 0.0% | 6.6 | 0.0 |
| 12 | 12 | SB-Johor-4 | Johor | 0.0% | 6.4 | 0.0 |
| 13 | 13 | SB-Kedah-2 | Kedah | 0.0% | 5.7 | 0.0 |
| 14 | 14 | SB-Melaka-2 | Melaka | 0.0% | 5.6 | 0.0 |
| 15 | 15 | SB-Johor-5 | Johor | 0.0% | 5.3 | 0.0 |
| 16 | 16 | SB-Perak-2 | Perak | 0.0% | 4.9 | 0.0 |
| 17 | 18 | SB-Selangor-4 | Selangor | 0.2% | 1.7 | 0.0 |
| 18 | 19 | SB-Selangor-5 | Selangor | 0.4% | 1.2 | 0.0 |
| 19 | 20 | SB-Kelantan-2 | Kelantan | 0.0% | 1.6 | 0.0 |
| 20 | 17 | SB-Selangor-3 | Selangor | 0.0% | 1.6 | 0.0 |
| 21 | 21 | SB-Selangor-6 | Selangor | 0.0% | 1.1 | 0.0 |
| 22 | 22 | SB-Selangor-7 | Selangor | 0.0% | 1.1 | 0.0 |
| 23 | 23 | SB-Selangor-8 | Selangor | 0.0% | 1.1 | 0.0 |
| 24 | 24 | SB-Selangor-9 | Selangor | 0.0% | 1.0 | 0.0 |
| 25 | 25 | SB-Selangor-10 | Selangor | 0.0% | 1.0 | 0.0 |
| 26 | 26 | SB-Selangor-11 | Selangor | 0.0% | 1.0 | 0.0 |
| 27 | 27 | SB-Selangor-12 | Selangor | 0.0% | 1.0 | 0.0 |
| 28 | 28 | SB-Selangor-13 | Selangor | 0.0% | 1.0 | 0.0 |
| 29 | 29 | SB-Selangor-14 | Selangor | 0.0% | 1.0 | 0.0 |
| 30 | 30 | SB-Selangor-15 | Selangor | 0.0% | 1.0 | 0.0 |
| 31 | 31 | SB-Selangor-16 | Selangor | 0.0% | 1.0 | 0.0 |
| 32 | 32 | SB-Pahang-1 | Pahang | 0.0% | 1.0 | 0.0 |
| 33 | 33 | SB-Pahang-2 | Pahang | 0.0% | 1.0 | 0.0 |
| 34 | 34 | SB-Kedah-3 | Kedah | 0.0% | 1.0 | 0.0 |
| 35 | 35 | SB-Terengganu-1 | Terengganu | 0.0% | 1.0 | 0.0 |
| 36 | 36 | SB-Terengganu-2 | Terengganu | 0.0% | 1.0 | 0.0 |
| 37 | 37 | SB-Sabah-3 | Sabah | 0.0% | 1.0 | 0.0 |
| 38 | 38 | SB-Selangor-17 | Selangor | 0.0% | 1.0 | 0.0 |
| 39 | 39 | SB-Selangor-18 | Selangor | 0.0% | 1.0 | 0.0 |
| 40 | 40 | SB-Selangor-19 | Selangor | 0.0% | 1.0 | 0.0 |
| 41 | 41 | SB-Selangor-20 | Selangor | 0.0% | 1.0 | 0.0 |
| 42 | 42 | SB-Selangor-21 | Selangor | 0.0% | 1.0 | 0.0 |
| 43 | 43 | SB-Pahang-3 | Pahang | 0.0% | 1.0 | 0.0 |
| 44 | 44 | SB-KualaLumpur-1 | Kuala Lumpur | 0.0% | 1.0 | 0.0 |
| 45 | 45 | SB-KualaLumpur-2 | Kuala Lumpur | 0.0% | 1.0 | 0.0 |
| 46 | 47 | SB-Sabah-4 | Sabah | 0.0% | 1.0 | 0.0 |
| 47 | 48 | SB-KualaLumpur-4 | Kuala Lumpur | 0.0% | 1.0 | 0.0 |
| 48 | 49 | SB-Selangor-22 | Selangor | 0.0% | 0.0 | 0.0 |


#### 6.11.7 Test-only fixtures (unobserved states; never in the default seed; loaded with `mock.m16Fixture(name)`)

| Fixture | Content | Used by |
|---|---|---|
| `tournaments` | "Contoh Tournament Pendaftaran" (status `registration`), "Contoh Tournament Berlangsung" (`ongoing`), "Contoh Tournament LIVE" (`ongoing`, `liveMatch` {8106, 8090}) — the placeholder titles used by discovery | E2E-M16-10, 77, 80 |
| `invitation` | pending invitation from 4301 (current school 8106, so `sender_school` = the M02 name of 8106) to the viewer | E2E-M16-31 |
| `openRoom` | Papan Bijak room `PB1234`, status `waiting`, host 4320, 1 player | E2E-M16-45 |
| `settingCoins` | M14 `games_award_syiling` = 1 (through M14's `settings.set` hook) | E2E-M16-66, 69 |
| `spinNothing` / `spinSyiling5` | forces the next `segment_index` to 5 ("Cuba Lagi") / 2 ("5 Syiling") (0-based as live) | E2E-M16-68, 69 |
| `anonymousSchool` | marks one S28 row `anonymous` → "Sekolah anonim" | component test only (copy; no AC) |

### 6.12 Cross-module requests (to the owners; D12)

| ID | To | Request |
|---|---|---|
| XR-M16-01 | M04 | **Applied (v1.4):** M04 v1.11 delivers the separate `jutawanQuestions` store (143 cells, Σ 149,911, Q-JUT-COUNT; `questions.jutawan.count / sample / get / gradeAnswer`, keyless `sample`); DC-M16-02 retired; not build-blocking. (a) **Jutawan counts.** Live shows 143 subject × grade counts (Σ 149,911, discovery A.7) that no M04 named query reproduces (e.g. Sejarah T1 2,974 > Q-ALL(Sejarah, T1) 2,447; Pendidikan Syariah Islamiah at T1 363 where M04 has no T1 row; Bahasa Melayu T4 369 < Q-ACTIVE 748). Proposal: an M04-owned store `jutawanQuestions` (a separate dataset like `structuredQuestions`, outside Q-ALL / N 466,041) with exactly these cells, exposed as `questions.jutawan.count(subjectId, level)` and `questions.jutawan.sample({subjectId, level, difficulty}, n, rng)`. The S19 counts are its count query and the Jutawan game samples and grades the same store, so the advertised count and the playable pool agree. (b) **Game pools:** confirm `questions.sample(filter, n, rng)` accepts `{educationLevelIds, subjectId?, questionType: 'mcq', eligible: true}`, the PKSK filter `{pkskDomainId, pkskTargetLevel}` and `spmPool`, and returns rows without keys plus `questions.gradeAnswer`. (c) Report source `papan_bijak` and "Bilik: {code}" (M04 OQ-11): M16 rooms pass `source: 'papan_bijak'` and `roomCode` if a room question is reported (PROPOSED; no report entry point observed in rooms). |
| XR-M16-02 | M14 | (a) Accept in `gamification.onGameResult(userId, {game, event, coins?, xp})` → `{coinsCredited, xpAdded}` (M14 v1.1) the extra fields `correct`, `total` and `detail` (`maxCombo`, `maxStreak`, `level`, `solved`, `moves`) so the ledger can keep the observed wording ("Cabaran Kilat: 3 betul, combo 2x", "Betul/Salah: 3 betul, streak 2", "Jutawan Ilmu ({subjek}): Level {n}"); (a2) serve `gamification.canEarnSyiling(userId)` (M14 v1.3: `games_award_syiling` = 1 ∧ the user's M02 `coinsEnabled`), which M16 sends as `canEarnSyiling` with every game payload so the in-play counters show the credited amount before `onGameResult` runs (AUD-M16-06, XL3-26); M16 passes `xp: 0` (the only XP value in the game code is `mata: 0` of the coin-fly) until M14 defines game XP; (b) confirm that Roda Nasib, Jutawan, rooms and battles fall under the same setting (M16 assumes yes, DV-M16-23); (c) game sources and ledger wording for the setting-1 case (the ledger sample's `papan_bijak`, `papan_bijak_win`, `benteng_play`, `benteng_win`, `perang_fakta_win`, `mathrace_play`, `jutawan_ilmu`, plus PROPOSED `roda_nasib`, `betul_salah`, `cabaran_kilat`, `tembak_jawapan`, `susun_jawapan`, `kad_memori`, `battle`). |
| XR-M16-03 | M05 | Serve **Q-WEEK-RANK(week)** (M05 v1.10; BR-M16-31) over sessions placed at the project clock as SRS §6.11.4 (XL3-16): pupil 2022 (23 sessions, 450 correct), M17's four 8082 week pupils (329 / 187 / 145 / 118 correct; 18 / 15 / 11 / 4 sessions), the 8106 1,761-month pupil and 8106 pupils A / B in SPM modes (excluded from the ranking), and ranks 6–20 as M02 generated register pupils inside M17 §6.7 B's remaining week answers (joint script `wk.cjs`: every per-school total, accuracy and pupil count met exactly; no-school 40 answers over 7 pupils with ≤ 5 correct each). Designed accounts at their computed rank (pelajarmaju 26 → rank 14, XL3-27). Game and battle answers are **not** written to the answer log. |
| XR-M16-04 | M02 | Placements as M02 v1.12 §6.15 D (XL3-18): 4301 student 8106 T5 register row; 4320 student 8880 T5 register row; 4321 student 2710 primary (Darjah 6), not answering; 4302–4319, 4322–4325 (22) no class — **v1.6 (M02 v1.23, XR-M02-01):** 4302–4310 at 9167 and 4311–4315, 4318, 4319, 4322–4324 at 9806 (grades 7–9), 4325 at 2418 (Darjah 6), 4316 and 4317 no school, grade 10; battle rows keep their stored battle-time school, so no visible M16 value changes (S2, S3, S4 colours, S20, lobby standings, Papan Bijak Top 10, leagues); **4326–4358 \ 4351 (32)** no school, grade 10, T4 pool (v1.3: 4359–4377 are **not** created — tokens 59–63 are M17's persons, 64–77 not seeded; please shrink the "51" row); 4401 teacher, no school; names longer than 15 characters for 4352, 4353, 4354, 4356, 4357, 4358. Schools 900 (active), 2710 and 8880 (**inactive**, as M18). The Sekolah Bersaing placement rule of §6.11.6. A definition for "10,218" or DC-M16-01 stays a constant. |
| XR-M16-05 | M11 | Adopt `battles.countFor(userIds, {from, to})` → `{count, correct, answered}` and `gameResults.countFor(userIds, {from, to})` → `{count}` (§7.2) for "Battle" / "Permainan" (BR-M11-04) and the "Battle" bar of "Skor Purata" (BR-M11-05). The seed battles' players (4301–4325) are in no M10 class, so the observed M11 figures stay 0. |
| XR-M16-06 | Global shell (F-19 / design/shells.md) | Mount `<TournamentBanner>` (§6.13) as the first child of the user-portal content area on every user page, not on admin-panel pages; register the M16 route meta titles of §2 (DV-SH-03); menu icon colours of URS FN-M16-1.1.1 / 1.1.2 ("Sekolah Bersaing" and "Tournament" `text-amber-500`, "Liga Pertandingan" `text-yellow-500`, "Permainan 🎮" no colour on its active page and `text-purple-500` in the drawer; admin group items `text-slate-400 text-xs`, "Lagi" "Battle Live" `text-red-500`, "Tetapan Permainan" `text-emerald-500`). |
| XR-M16-07 | Foundation formatter (F-03) / M14 BR-M14-35 | Add the week step "{n} minggu yang lepas" for 7–29 days to the shared relative-time formatter (OBSERVED on M16 S4; Laravel `diffForHumans`). **This changes M14 BR-M14-35 for 7–29 days ("{n} hari yang lepas" → "{floor(d ÷ 7)} minggu yang lepas")**; M14 checks every AC / E2E that asserts "hari" at 7 days or more; its observed values (minit, jam, bulan) are unchanged. |
| XR-M16-08 | M07 | **Noted by M07 v1.7** (BR-M07-26, XR table): the token `pksk` is shared by the M05 session mode, the M14 source and the M16 battle `questionType`; PKSK battles stay M16 Battle records and read PKSK rows through M04. Original FYI: S1 shows the PKSK levels as "Tingkatan 1" / "Tingkatan 4" (M07's labels) instead of live "Tahap 1 (Darjah 1-3)" / "Tahap 4 (Darjah 4-6)" (DV-M16-31); battles read PKSK rows through M04. |
| XR-M16-09 | M17 | (XL3-16/17) (a) Confirm the ids of the four 8082 week pupils (PROPOSED 2013 = W2, 2014 = W3, 2015 = W4, 2016 = W5 in M17's 2013–2060 block) — they are S20 ranks 2–5 at the clock; (b) re-derive the 25 Sep placements with the observed S20 session counts (W5 = **4** sessions this week, not 8 × 20) and put the week sessions of the 8106 1,761-month pupil and pupils A / B in SPM modes (or other values that keep them out of the top five); (c) read Q-M17-BATTLES from M16 Q-M16-BATTLES / Q-M16-BATTLES-WIN (§6.10; battles = created in the window, any status). |

### 6.13 Contract offered — tournament banner (M16 → global user shell and every module)

| Item | Contract |
|---|---|
| Component | `<TournamentBanner />` exported from `@/modules/m16-battle-games` (no props); mounted once by the user-portal shell as the first child of the content area (`mb-4` wrapper); renders nothing while loading, on error, or with an empty list; not mounted in the admin-panel shell or in standalone pages (404, 500, login). |
| Data | `GET /api/tournament/active` (§7 #1) → `200 TournamentActive[]` where `TournamentActive = {uuid: string, title: string, status: 'registration' \| 'ongoing', live_match: null \| {school_a: string, school_b: string}}`; the body is a **bare array** (as live, not the list envelope); any non-2xx or network error = empty list, no message, no retry. |
| Request | once per page load (router navigation = a new load of the shell content), headers `Accept: application/json`, `X-Requested-With: XMLHttpRequest`; no polling. |
| States | hidden · registration ("Pendaftaran dibuka" + "DAFTAR") · ongoing ("Sedang berlangsung") · live match ("LIVE: {school_a} vs {school_b}" + "MAIN"); several stack (BR-M16-38). |
| Links | each item → `/tournament/{uuid}` (M16 provisional detail). |
| Other modules | M01, M03, M04, M05, M06, M07, M08, M09, M10, M12, M13, M14, M15 and later user-portal modules exclude the banner elements ("LIVE:", "MAIN", "DAFTAR") in their URS and render nothing for it; E2E of those modules run with the default seed (hidden banner). |

### 6.14 Test hooks (dev/test builds only; architecture §6.13)

Global hooks of the architecture plus the **M16 module hooks**: `battleSim({mode: 'match' | 'incoming' | 'never' | 'expired' | 'not_found' | 'error:<status>' | 'network', afterPolls?})` (next queue); `battleWaiting({targetUserId, outcome: 'matched' | 'rejected' | 'expired'})` (reaches the unreachable waiting card, DV-M16-06); `pbQuickMatch({mode: 'match' | 'expired'})`; `roomBots({count})`; `m16Fixture(name)` (§6.11.7); `setBattleScores(uuid, {a, b})`; `spinNext(segmentIndex)`; `m16Standings()` (returns the standings for assertions); `resetM16()`.

---

## 7. Mock API endpoints

Conventions: SRS.md §7 (envelope `{data, meta}` for lists, `{data}` for objects, error `{error: {code, message, fields?}}`) **except** where live shows the JSON shape (the 13 `/api/battle/*` endpoints, the Papan Bijak quick match, the spin, the submits and the banner), which keep the live bodies so the page scripts can be replicated. Auth: U = any logged-in user, AD = admin; P = a player of that battle / room. "Mut." = mutating. "Live" = the live counterpart. Handlers are pure functions of (request, db, clock, prng) (architecture §6.4); SIM = simulated behaviour.

| # | Method | Path | Auth | Mut. | Request | Response (200 unless stated) | Errors | Live |
|---|---|---|---|---|---|---|---|---|
| 1 | GET | `/api/tournament/active` | U | no | — | bare array `TournamentActive[]` (§6.13) | 401 | same (observed `[]`) |
| 2 | POST | `/api/battle/quick-match` | U | yes | `{question_type, open_to_all, subject_id?, pksk_domain_id?, pksk_target_level?}` | `{queue_id}` (the mock never answers `{matched: true, battle_uuid}` directly; the client supports it) | 422 `{}`, 403 `{}` (BR-M16-03) | same (not sent on live) |
| 3 | POST | `/api/battle/school-battle` | U | yes | as #2 | `{queue_id}` | as #2 | same |
| 4 | GET | `/api/battle/poll-match/{queueId}` | U | yes (poll count, SIM) | — | `{status: 'waiting'}` \| `{status: 'incoming_challenge', challenger: {name, grade_label, school}}` \| `{status: 'matched', battle_uuid}` \| `{status: 'expired'}` \| `{status: 'not_found'}` | 500 (hook) | same (observed `not_found` for 0) |
| 5 | POST | `/api/battle/accept-challenger/{queueId}` | U (owner) | yes | — | `{matched: true, battle_uuid}` | 404 `{error}` (the client shows it in the error banner) | same |
| 6 | POST | `/api/battle/reject-challenger/{queueId}` | U (owner) | yes | — | `{success: true}` (queue back to `waiting`) | 404 `{error}` | same |
| 7 | GET | `/api/battle/search-opponent?q=` | U | no | `q` | `{users: [{id, name, school, avatar}]}` (BR-M16-11) | — | same (observed `{"users":[]}`) |
| 8 | POST | `/api/battle/invite` | U | yes | #2 params + `receiver_id` | `{success: true}` | 422 `{error}` | same |
| 9 | GET | `/api/battle/invitations` | U | no | — | `{invitations: [{uuid, sender_name, sender_school}]}` | — | same (observed empty) |
| 10 | POST | `/api/battle/invite/{uuid}/accept` | U (receiver) | yes | — | `{success: true, battle_uuid}` | 404 `{error}` | same |
| 11 | POST | `/api/battle/invite/{uuid}/decline` | U (receiver) | yes | — | `{success: true}` | 404 `{error}` | same |
| 12 | POST | `/api/battle/join-queue/{queueId}` | U | yes | — | `{success: true}` | 404 `{error: "Ralat menghantar permohonan."}` | same (no UI caller, DV-M16-06) |
| 13 | GET | `/api/battle/poll-challenger/{queueId}` | U | no | — | `{status: 'waiting' \| 'matched' \| 'rejected' \| 'expired' \| 'not_found', battle_uuid?}` | — | same (observed `not_found` for 0) |
| 14 | POST | `/api/battle/forfeit/{uuid}` | P | yes | — | `{success: true}` (BR-M16-09) | 404, 409 (finished) | same (no caller on S1) |
| 15 | GET | `/api/battle/lobby` | U | no | — | `{data: {grade, gradeLabel, spmUnlocked: grade ≥ 10, subjects: [{id, name, icon, colour, core}] (31), pkskDomains: [{id, name, icon, colour}] (15), spmSubjects: [{id, name}] (only when unlocked)}}` | 401 | server-rendered S1 |
| 16 | GET | `/api/battle/arena/{uuid}` | P | no | — | `{data: {uuid, status, you: 'A'\|'B', players: {A: {name, school}, B: {…}}, scores, index, total: 10, question: {id, text, options: [{id, label, text}]} (no key), secondsLeft, result?}}` (PROVISIONAL) | 404 | page `/battle/arena/{uuid}` (not observed) |
| 17 | POST | `/api/battle/arena/{uuid}/answer` | P | yes | `{questionId, optionId \| null, seconds}` | `{data: {correct, correctOptionId, points, you: {score}, opponent: {answered: true, correct, score}, next?: question, result?: {winner, scoreA, scoreB}}}` (BR-M16-07/08; PROVISIONAL) | 404, 409, 422 | not observed |
| 18 | GET | `/api/battle/standings/students?period=weekly\|monthly` | U | no | `period` | `{data: [{rank, userId, name, school, menang, seri, kalah, ketepatan, streak, skor}]}` computed from Battle | 401 | server-rendered S2 (live `/api/battle/leaderboard` is 404) |
| 19 | GET | `/api/battle/standings/schools?period=&state=` | U | no | `period` (default weekly; unknown → all_time + `activePeriod: null`), `state` | `{data: {activePeriod, rows: [{rank, schoolId, name, state, type, battles, menang, seri, kalah, ketepatan, pelajar, skor}], podium: [{column: 1\|2\|3, schoolId, name, state, skor}]}}` | 401 | server-rendered S3 |
| 20 | GET | `/api/battle/schools/{id}` | U | no | — | `{data: {school: {id, name, ppd, state, type}, allTime: {battles, menang, ketepatan, pelajar}, week: null \| {rank, battles, menang, seri, kalah, skor}, month: null \| {…}, fighters: [{userId, name, skor}], recent: [{uuid, playerA: {id, name, homeHere}, scoreA, scoreB, playerB: {id, name}, winner, createdAt}]}}` | 404 | server-rendered S4 |
| 21 | GET | `/api/battle/history` | U | no | — | `{data: [recent-row shape of #20]}` newest first | 401 | server-rendered S5 |
| 22 | GET | `/api/games/hub` | U | no | — | `{data: {openRooms: [{game, code, host, players, max}], chips: {papanBijakPlayed: bool, battled: bool}}}` | 401 | server-rendered S6 |
| 23 | GET | `/api/games/{game}/lobby` | U | no | `game` ∈ 6 room games | `{data: {autoGrade: 'DARJAH_4' \| null, autoGradeName, leaders: [{rank, userId, name, value}] \| top10: [{rank, userId, name, initials, menang, jumlah, kadar, skor, betul}], flash?}}` | 404 (unknown game) | server-rendered S7–S12 |
| 24 | POST | `/api/games/{game}/rooms` | U | yes | S7: `{subject, grade_level, match_mode, grade_min?, grade_max?, max_players}`; S8–S12: `{subject, grade_level, match_mode}` | `201 {data: {code}}` | 422 (V-M16-01…05) | form POST `/{game}/create` |
| 25 | POST | `/api/games/{game}/rooms/join` | U | yes | `{room_code}` | `{data: {code}}` | 404 `{error: {code: 'NOT_FOUND', message: "Bilik tidak dijumpai."}}` → lobby + flash | form POST `/{game}/join` |
| 26 | GET | `/api/games/{game}/rooms/{code}` | P | yes (bot joins, SIM) | — | `{data: {code, game, status, host, players: [{id, name, grade, team?, points, isBot}], settings, state, round?, question? (no key), result?}}` (poll every 3 s; PROVISIONAL) | 404 (unknown: S7 page 404, S8–S12 redirect + flash) | page `/{game}/{code}` |
| 27 | POST | `/api/games/{game}/rooms/{code}/start` | P (host) | yes | — | `{data: room}` | 409 (not enough players), 403 | not observed |
| 28 | POST | `/api/games/{game}/rooms/{code}/action` | P | yes | `{type: 'roll'}` (Papan Bijak) \| `{type: 'answer', questionId, optionId \| value, seconds}` | `{data: room}` (BR-M16-20) | 409, 422 | not observed |
| 29 | POST | `/api/papan-bijak/quick-match` | U | yes | `{subject, match_mode}` | `{status: 'searching'}` | 422 `{error}` | `/papan-bijak/quick-match` |
| 30 | GET | `/api/papan-bijak/quick-match/poll` | U | yes (SIM) | — | `{status: 'searching'}` \| `{status: 'matched', room_code}` \| `{status: 'expired'}` \| `{status: 'cancelled'}` (idle) | — | same (observed `{"status":"cancelled"}`) |
| 31 | POST | `/api/papan-bijak/quick-match/cancel` | U | yes | — | `{status: 'cancelled'}` | — | same |
| 32 | GET | `/api/games/solo/{game}?darjah=` | U | yes (session) | `game` ∈ `betul-salah`, `cabaran-kilat`, `tembak-jawapan`, `susun-jawapan`, `kad-memori`; `darjah` 1–11 (not for Kad Memori) | `{data: {sessionId, personalBest, canEarnSyiling, statements \| questions \| puzzles \| cards}}` (BR-M16-25; keys included as live, SEC-M16-01; `canEarnSyiling` = M14 `canEarnSyiling(userId)`, BR-M16-28) | 422 (darjah) | embedded in the page |
| 33 | POST | `/api/games/solo/{game}/submit` | U | yes | BR-M16-27 bodies | `{is_new_record, syiling_awarded}`; Kad Memori `{results: {syiling_earned, accuracy}}` | 409, 422 (V-M16-19) | `/permainan/{game}/submit` |
| 34 | GET | `/api/games/roda-nasib` | U | no | — | `{data: {segments: [8 × {label, type, value, weight, color, icon}] (index 0–7), spins, won, alreadySpun, canEarnSyiling}}` | 401 | server-rendered S18 |
| 35 | POST | `/api/games/roda-nasib/spin` | U | yes | — | `{success: true, message: '', result: {segment_index (0-based, 0–7), label, icon, type, value}, coinsCredited}` | 409 `{success: false, message: "Anda sudah spin hari ini."}` | `/permainan/roda-nasib/spin` |
| 36 | GET | `/api/games/jutawan?darjah=` | U | no | `darjah` 1–11 or none | `{data: {bestLevel, games, heading?, subjects?: [{id, name, emoji, colour, count}]}}` (M04 Q-JUT-COUNT via `questions.jutawan.count`) | 422 | server-rendered S19 |
| 37 | POST | `/api/games/jutawan/start` | U | yes | `{subject, darjah}` | `{data: {sessionId, index: 1, question (no key), lifelines: 3}}` (PROVISIONAL) | 422 | `/permainan/jutawan/main` (not opened) |
| 38 | POST | `/api/games/jutawan/{sessionId}/answer` | U | yes | `{questionId, optionId}` | `{data: {correct, level, next?, result?: {level, credited}}}` (PROVISIONAL) | 404, 409 | not observed |
| 39 | POST | `/api/games/jutawan/{sessionId}/lifeline` | U | yes | `{type: '50:50'}` | `{data: {removedOptionIds: [2 ids], lifelines}}` (PROVISIONAL) | 409 (none left) | not observed |
| 40 | GET | `/api/games/pertandingan` | U | no | — (`week` ignored) | `{data: {weekStart, weekEnd, endsAt (MYT ISO), prizes: [100, 50, 25], me: null \| {rank, betul}, rows: [{rank, userId, name, sesi, betul, tepat}]}}` (Q-WEEK-RANK) | 401 | server-rendered S20 |
| 41 | GET | `/api/games/uji-minda` | U | no | — | `{data: {challenge: null}}` | 401 | server-rendered S21 |
| 42 | GET | `/api/tournaments` | U | no | — | `{data: [{uuid, title, status}]}` (`registration`, `ongoing`) | 401 | server-rendered S23 |
| 43 | GET | `/api/tournaments/form-options` | AD | no | — | `{data: {educationLevels: [3], subjects: [{id, name, code}] (31, A→Z), examPapers: [], spmCounts: {BM: 25, …}}}` | 403 | server-rendered S24 |
| 44 | POST | `/api/tournaments` | AD | yes | the S24 fields + `action: 'draft' \| 'open_registration'` | `201 {data: {uuid, status}}` | 422 (V-M16-07…12), 403 | `/tournament/admin` |
| 45 | GET | `/api/tournaments/{uuid}` | U | no | — | `{data: Tournament}` (drafts only for admins) (PROVISIONAL) | 404 | `/tournament/{uuid}` (404 observed) |
| 46 | GET | `/api/leagues` | U | no | — | `{data: {mine: [LeagueCard], open: [LeagueCard]}}`; `LeagueCard = {id, name, status, statusLabel, scopeLabel, typeLabel, subjectName, startDate, endDate, schools}` | 401 | server-rendered S25 |
| 47 | POST | `/api/leagues` | U | yes | the S26 fields | `201 {data: {id}}` | 422 (V-M16-14/15) | `/liga/cipta` |
| 48 | POST | `/api/leagues/join` | U | yes | `{invite_code}` | `{data: {id}}` | 422 (V-M16-13) | `/liga/sertai` |
| 49 | GET | `/api/leagues/{id}` | U | no | — | `{data: {id, name, typeLabel, scopeLabel, status, statusLabel, subjectName, startDate, endDate, scoringLabel, creatorName, classLevels, inviteCode, shareUrl, canJoin, schools: [{id, name}], standings: {T4?: [{rank, schoolId, name, ppdState, peserta, skor, purata}], …}}}` | 404 | server-rendered S27 |
| 50 | GET | `/api/sekolah-bersaing?week=` | U | no | `week` (any; invalid ignored) | `{data: {weekStart, count, rows: [{rank, schoolName, state, aktifPct, streakAvg, notaPer10, anonymous}]}}` (`rows: []` → empty state) | 401 | server-rendered S28 |
| 51 | GET | `/api/admin/games` | AD | no | — | `{data: {stats: {rooms, playing, finished, players}, settings: {boardgameQuizTiles}}}` | 403 | server-rendered S29 |
| 52 | PUT | `/api/admin/games/settings` | AD | yes | `{boardgame_quiz_tiles}` | `{data: {boardgameQuizTiles}}` | 422 (V-M16-16), 403 | `PUT /admin/permainan` |

**Web-route counterparts not built as endpoints:** `/permainan/jutawan/main` (the provisional page calls #37); `/papan-bijak/{code}` and `/{game}/{code}` (pages calling #26–#28). The live 404 JSON routes `/api/battle/leaderboard` and `/api/battle/stats` are not created.

### 7.1 Polling contract (SOURCE; kept exactly)

| Flow | Request / interval | Client rules | Messages (exact) |
|---|---|---|---|
| Battle search | #2 / #3 once, then #4 every **3 s** | the timer text is set from elapsed seconds on each poll only; `matched` + `battle_uuid` → `/battle/arena/{uuid}`; `incoming_challenge` → incoming card, keep polling; `expired` / `not_found` → stop; **120 s** since start → stop; **5 consecutive** failures → stop (a success resets the counter); "Batal" → stop, no request | "Tiada lawan dijumpai. Sila cuba lagi." · "Tiada lawan dijumpai dalam masa 2 minit. Sila cuba lagi." · "Ralat berulang semasa mencari lawan. Sila cuba lagi." (5 non-OK) · "Ralat rangkaian berulang. Sila semak internet anda." (5 network) · "Ralat sistem: ID giliran tidak sah. Sila cuba lagi." (no `queue_id`) · start: `data.error` / `data.message` / "Ralat dari server. Sila cuba lagi." · "Respon tidak dijangka. Sila cuba lagi." · "Ralat rangkaian. Sila semak internet anda." |
| Incoming challenger | #5 / #6 once | `data.error` → clear the card, banner `data.error`; network → banner | "Ralat rangkaian." |
| Waiting for approval | #12 once, then #13 every 3 s | `matched` → arena; `rejected` / `expired` / `not_found` → stop | "{name} menolak permohonan anda." · "Pemain sudah keluar dari barisan." · "Ralat menghantar permohonan." · "Ralat rangkaian. Sila cuba lagi." |
| Papan Bijak quick match | #29 once, then #30 every **3 s**; elapsed +1 every second | `matched` + `room_code` → room; `expired` → error; `cancelled` → idle; no client timeout; "Batal Carian" → #31 | start `data.error` → error line; network → "Ralat rangkaian. Sila cuba lagi."; poll `expired` → "Tiada lawan dijumpai. Cuba lagi!" (visible after the search, DV-M16-20) |
| Room (PROVISIONAL) | #26 every 3 s while the page is open | the only realtime pattern on live; no WebSocket | — |
| Banner | #1 once per page load | no polling | — |

### 7.2 Repository contract (`@/modules/m16-battle-games/mock`, architecture §6.7)

| Function | Used by | Rule |
|---|---|---|
| `battles.countFor(userIds, {from, to})` → `{count, correct, answered}` | M11 | finished and forfeited battles of the users (both sides) in the window (XR-M16-05) |
| `gameResults.countFor(userIds, {from, to})` → `{count}` | M11 | submitted single-player sessions, finished rooms and Jutawan games of the users |
| `tournaments.active()` | banner (#1) | BR-M16-38 |
| `standings.school(schoolId, period)` | M17 (if it ever shows battles; none observed) | BR-M16-12 |
| `battles.m17Counts()` → `{total, active, finished}` · `battles.windowCounts(window)` → `{battles, games}` | M17 (XR-M17-15) | Q-M16-BATTLES, Q-M16-BATTLES-WIN (§6.10): 168 / 0 / 66; 7 d 0 · 0, 30 d 4 · 5, 90 d 23 · 47 |

M16 calls: `questions.sample / gradeAnswer / namedCount` and `questions.jutawan.count / sample / get / gradeAnswer` (M04 v1.11, XR-M16-01 applied), `practice.weekRank(week)` (M05 Q-WEEK-RANK, XR-M16-03), `users.get / search`, `schools.get / list` (M01/M02), `curriculum.subjects()` (M03), `gamification.onGameResult`, `gamification.canEarnSyiling(userId)`, tier `boardGameRewardCorrect` / `boardGameRewardWin` (M14).

## 8. States & messages

### 8.1 Observed copy (exact)

| Screen | State | Copy |
|---|---|---|
| S1 | SPM locked | "Khas untuk pelajar Tingkatan 4 & 5 sahaja" |
| S1 | searching / incoming / waiting | "Mencari Lawan...", "Menunggu pelajar sama darjah & subjek", "Menunggu pelajar dari mana-mana gred", "Batal"; "Cabaran Masuk!", "{name} ingin menyertai battle anda", "Soalan mengikut gred anda. Lawan akan bermain soalan gred anda.", "Terima", "Tolak"; "Menunggu Kelulusan...", "Menunggu {name} menerima permohonan anda" |
| S1 | modals and handlers | "Cari nama pelajar...", "Tiada pelajar dijumpai"; send challenge: "Cabaran berjaya dihantar kepada {name}!" (success), "Ralat menghantar cabaran." (network); accept invitation: "Ralat." (network); decline: silent; incoming challenger: banner `data.error` or "Ralat rangkaian." (network); forfeit: "Tamatkan battle ini? Anda akan dikira kalah.", "Ralat. Sila cuba lagi." (network); "Tiada cabaran buat masa ini" |
| S1 | errors | §7.1 |
| S2 / S3 | empty | "Belum ada data ranking. Mula battle untuk muncul di sini!" / "Belum ada data ranking. Mula battle untuk melihat ranking sekolah!" |
| S4 | empty | "Tiada data minggu ini", "Tiada data bulan ini", "Tiada data pejuang minggu ini", "Tiada battle terkini" |
| S5 | empty | "Tiada sejarah battle", "Mulakan pertandingan pertama anda sekarang!", "Mula Battle" |
| S6 | empty rooms | "🌙", "Tiada bilik terbuka buat masa ini.", "Cipta bilik permainan dan jemput rakan-rakan!" |
| S7 | quick match | "Mencari lawan... {n}s", "Sila tunggu, sistem sedang mencari pemain sepadan", "Batal Carian", "Tiada lawan dijumpai. Cuba lagi!", "Ralat rangkaian. Sila cuba lagi." |
| S8–S12 | not found | "Bilik tidak dijumpai." |
| S13–S17 | results | titles "🏆 LEGENDA!", "🔥 LUAR BIASA!", "✅ HEBAT!", "💪 TERUSKAN!", "⚡ PANTAS!", "🏆 SNIPER!", "🎯 SHARP!", "💪 BAGUS!", "🔄 CUBA LAGI!", "🏆 GENIUS!", "🧩 BIJAK!", "📚 TERUSKAN!"; "🏆 REKOD BARU!"; "Tahniah!", "Semua kad berjaya dipadankan!" |
| S18 | prize | "+{n} Syiling", "Ditambah ke akaun kamu!", "Jangan risau, cuba lagi esok!", "Tutup"; buttons "🎯 SPIN!", "⏳ Sedang Pusing...", "✅ Sudah Spin Hari Ini" |
| S19 | no darjah | "👆", "Pilih darjah atau tingkatan di atas untuk mula." |
| S20 | not ranked / end | "Belum mula lagi minggu ini!", "Buat Latih Tubi untuk masuk ranking.", "Tamat!", "-" |
| S21 | empty | URS FN-M16-7.4.1 |
| S23 | empty | "Tiada tournament aktif buat masa ini." |
| S24 | SPM note | "Standard SPM Kertas 1: {n} soalan" |
| S25 | empty | "Belum menyertai mana-mana liga", "Cipta liga baru atau sertai menggunakan kod jemputan" |
| S27 | empty standings | "Belum ada data papan pendahulu", "Data dikemas kini setiap jam" |
| S28 | empty week | "📊 Data minggu ini belum dijana.", "Cron mingguan akan kira pada Isnin pagi. Tunggu kejap ya."; "Sekolah anonim" |
| S22 (DV-M16-03) | handled 500 | "500", "⚙️", "Ralat Pelayan", "Sesuatu tidak kena di pihak kami. Pasukan teknikal telah dimaklumkan. Sila cuba sebentar lagi.", "Halaman Utama", "Cuba Semula", "PRESTASIPLUS" |
| 404 | not found | M01 page ("Halaman Tidak Dijumpai" …) |

### 8.2 PROPOSED COPY and PROPOSED layouts (report at G1; URS OQ-M16-15)

| Where | PROPOSED |
|---|---|
| Arena | header with both players' names and schools, "Skor" per player, "Soalan {n}/10", the Cabaran Kilat question card and options, a 15 s countdown bar, button "Tamatkan"; result card title "Menang" / "Seri" / "Kalah", "{scoreA} vs {scoreB}", links "Mula Battle" → `/battle`, "Sejarah Battle" → `/battle/history` |
| S5 rows | the S4 "Battle Terkini" row |
| S6 open rooms | one chip per room: game emoji + game name + "{code}" + "{players}/{max}" |
| Rooms | waiting card: game h1, "Kod Bilik: {code}", players list (name, "Darjah n" / "Tingkatan n", "Hos"), button "Mula" (host); play: round "Pusingan {n}/{total}" or the game's metric (board tiles, "HP {n}", "{n}/20 langkah", team scores); result: "🏆 {name} menang!" (Kuiz Relay "🏆 Pasukan {A\|B} menang!" + "MVP: {name}") and "🎮 Hub" |
| Jutawan game | "L{n}" ladder of 15, question card, "50:50" (×3), result "Tahniah! Anda sampai L{n}." with "🔄 Main Lagi" and "🎮 Hub" |
| S20 ranked viewer | "📊 Kedudukan kamu: #{rank} · {betul} betul" |
| S18 refusal | `alert("Anda sudah spin hari ini.")` |
| S23 list | one card per tournament: `fa-trophy`, title, the banner line |
| Tournament detail | title, banner line, a definition list of the saved fields with the S24 labels |
| Flashes | tournament saved "Tournament berjaya dicipta."; league created "Liga berjaya dicipta."; league joined "Berjaya menyertai liga."; settings saved "Tetapan berjaya disimpan."; errors per §5 |

### 8.3 Loading and errors

Server-rendered on live; the SPA shows the shared loading state until the first response. S13–S17 show nothing of the game until the payload arrives, then the countdown. Endpoint failures other than the observed ones show the M01 error convention; the banner never shows an error (§6.13).

---

## 9. Permissions matrix

"View" = open the screen; "Create / Edit / Delete" = mutating actions. Only the admin was observed; every other cell is INFERRED and provisional.

| Role | View | Create | Edit | Delete | Notes |
|---|---|---|---|---|---|
| Admin | S1–S30, arena / rooms of which they are a player | battles, invitations, rooms, game sessions, spins, Jutawan games, tournaments (S24), leagues, league joins | game settings (S29) | — | OBSERVED (screens); the admin plays with its student profile (grade Darjah 4) |
| Pelajar | S1–S23, S25–S28, own arena / rooms / history | battles, invitations, rooms, sessions, spins, Jutawan games, leagues, joins (with a school) | — | — | INFERRED; SPM battle only at grade 10–11 |
| Guru | as Pelajar | as Pelajar (league creation expected) | — | — | INFERRED |
| Ibu Bapa, Penaja, Admin Sekolah, PPD, JPN | as Pelajar (no role evidence) | as Pelajar | — | — | INFERRED / UNVERIFIED |
| Guest | — (→ `/login`) | — | — | — | INFERRED (M01 pattern) |
| Bot (SIMULATION) | — | joins queues and rooms through the mock only | — | — | not a user role |

Nothing in M16 can be deleted from the UI (as live). Admin-only: S24 + #43–#44; S29 + #51–#52; "Cipta Tournament Baru".

## 10. Responsive behaviour

Breakpoints per NFR-RESP (Tailwind `sm` 640, `md` 768, `lg` 1024). The user-portal shell switches to drawer + bottom nav below 1024 px (00-global-ui). No M16 screen may scroll the page horizontally (NFR-RESP-01).

| Screen | < 640 (375) | 640–1023 (768) | ≥ 1024 (1280) |
|---|---|---|---|
| S1 | type row 1 flex row (109 / 109 / 77 px); subject tiles 2 columns; mode buttons 1 column; ranking links 2 columns; modals full width minus padding | tiles 3 (sm) → 4 (md) columns; mode buttons 3 columns (md) | same as md; centred lobby |
| S2 / S3 | tables scroll in their card (4 of 7 columns visible); podium 3 columns | table fits | table fits |
| S4 | cards 2 columns; period boxes stacked; "Battle Terkini" list scrolls inside its card (DV-M16-37; live page scrolled to 392–416 px) | cards 4 columns (md); boxes side by side; list fits | same |
| S5 / S21 / S23 | single card | same | same |
| S6 | cards 1 column; badges 12 px | 2 columns | 3 columns |
| S7 | create / join 1 column; Top 10 scrolls in its card (4 of 7 visible); labels 12 px | 2 columns (md) | 2 columns |
| S8–S12 | create / join 1 column; flash at the top | 2 columns (sm+) | 2 columns |
| S13–S16 | full-screen game; picker overlay covers the viewport; Tembak fall zone 342 × 500 | same (zone width follows the viewport) | zone 958 × 500 |
| S17 | 4 × 3 cards, 98 px | 151 px | 151 px |
| S18 | canvas 320 px | 380 px | 380 px |
| S19 | subjects 1 column; picker full screen | 2 columns (md) | 2 columns |
| S20 | prizes 3 columns; rows full width | same | same |
| S24 / S26 | form 1 column; S26 levels 3 columns | 2 columns (md / sm); levels 6 columns | same |
| S25 | tabs full width; join modal full width (NFR-RESP-07) | modal centred | same |
| S27 | chips wrap; leaderboard scrolls in its card (DV-M16-13) | table fits | same |
| S28 | "Streak Avg" and "Nota/Pelajar" hidden; 12 px sublabels | columns shown (md) | same |
| S29 | tiles 2 columns; labels 12 px; drawer admin shell | tiles 4 columns (md) | sidebar shell |
| S30 | cards full content width, stacked | same | same |
| Arena / rooms / detail / Jutawan game (PROPOSED) | 1 column; options stacked; players list above the play area | 2 columns where the S1 / S14 components do | same |

## 11. Non-functional requirements

| ID | Requirement | Global NFR |
|---|---|---|
| NFR-M16-01 | Polling timers (3 s search and room polls, 1 s quick-match counter, 60 s S20 countdown, game clocks) SHALL run on the shared clock so Playwright's clock controls them; no timer SHALL keep running after the page is left. | NFR-01 |
| NFR-M16-02 | Every simulation SHALL be deterministic per id and seed (named streams of §4); `setRandomSeed` changes them all. | NFR-07 |
| NFR-M16-03 | Privacy: only fictitious people (M02 anchors 4301–4377, 4401, canonical accounts); no live name in code, fixtures, logs or screenshots. | NFR-05 |
| NFR-M16-04 | Text ≥ 12 px on every M16 screen (DV-M16-24); animations (wheel 4.2 s, flips 800 ms, countdown 800 ms) as live, no reduced-motion change (D10). | NFR-02 |
| NFR-M16-05 | Standings and leaderboards SHALL read stored rows (O(rows)), never scan the M05 answer log; Q-WEEK-RANK SHALL use the M05 pre-aggregated counters. | NFR-01 |

### 11.1 Security notes (backend phase; the prototype replicates live with dummy data)

| ID | Risk in live behaviour | Backend requirement |
|---|---|---|
| SEC-M16-01 | **Client-side scoring and shipped answer keys.** S13–S17 embed `is_true`, `correct`, `answer` and `pair_id` in the page and post client-computed `score` and `syiling_earned`; any student can post any score (the reason M14 turned game coins off). | The server serves items without keys, receives each answer (or the answer list) and computes correct counts, score, combo, level and coins itself; it rejects results that are impossible for the time played; the prototype keeps client scoring for fidelity (§4 BR-M16-27) and only checks plausibility. |
| SEC-M16-02 | **CSRF token embedded in the S7 script** (normal for Laravel) and every POST is cookie-authenticated. | Keep CSRF protection on every mutating route, including JSON routes. |
| SEC-M16-03 | **Opponent search exposes minors.** `/api/battle/search-opponent` returns the name, school and avatar of any student to any logged-in user from 2 characters. | Restrict to friends / same school or class, require more characters, rate-limit, return first name + initial, exclude opted-out users. |
| SEC-M16-04 | **Queue and battle ids in URLs** (`poll-match/{id}`, `accept-challenger/{id}`, `forfeit/{uuid}`, integer queue ids). | Authorise every call against the queue owner / battle player (IDOR); unguessable queue ids; server-side expiry of abandoned queues. |
| SEC-M16-05 | **Unlimited challenges and joins.** `invite`, `join-queue` and room joins have no visible limit; room codes are 6 characters. | Rate-limit invites, joins and code attempts per user; block lists; expire invitations. |
| SEC-M16-06 | **Daily spin enforced in the page** (`alreadySpun`). | Enforce one spin per user per day server-side (unique constraint) and pick the segment server-side (already so). |
| SEC-M16-07 | **Public leaderboards of minors** (Pendahulu, Top 10, Pertandingan, Battle Terkini, Sekolah Bersaing share tip). | Display names policy (first name + initial), opt-out per student and per school ("Sekolah anonim"), PDPA notice. |
| SEC-M16-08 | **League invite codes visible to non-members** and joins by code for any user with a school; league creation by any role. | Decide who may create and join; rate-limit joins; organiser approval option. |
| SEC-M16-09 | **Unvalidated input to 500** (`/sekolah-bersaing?week=bogus`, GET on POST routes). | Validate every query parameter; return 404/422, never 500 (the prototype does, DV-M16-30/33). |
| SEC-M16-10 | **Tournament admin routes by prefix only** (`/tournament/admin/*`). | Role checks in the server, not only in the menu. |
| SEC-M16-11 | **A GET creates state.** Each GET of a game page (S13–S17) creates a server game session (`session_id` in the HTML), exposed to prefetch and CSRF-style triggering. | Create sessions on an explicit POST; GET stays safe. |

## 12. E2E test scenarios

Every scenario runs on the three Playwright projects (mobile 375×812, tablet 768×1024, desktop 1280×800) at the clock `2026-09-25T15:40:00+08:00` with the default seed unless it names a fixture or hook. `@provisional` = column "Prov." yes. Column "FR" lists FR numbers (prefix `FR-M16-` omitted), column "AC" the URS ACs (prefix `AC-M16-` omitted).

| ID | Scenario | FR | AC | Prov. |
|---|---|---|---|---|
| E2E-M16-01 | User menus: admin at 1280 sidebar entries and targets, no `/battle` entry; at 375 bottom nav "Game" and drawer entries. | 01 | 01.1 | |
| E2E-M16-02 | Admin panel group "Battle & Permainan" (1280) and the "Lagi" subset (768); "Battle Live" opens `/battle` in the user shell. | 02, 04 | 01.2 | |
| E2E-M16-03 | Header title / subtitle of S1–S5 and S23–S27 (8106, league 1). | 03 | 01.3 | |
| E2E-M16-04 | Header titles of S6–S21 are the page titles with "Selamat datang kembali"; "Dashboard" never appears. | 03 | 01.4 | |
| E2E-M16-05 | S28 in the user shell with "Sekolah Bersaing"; S29 in the admin shell; tab titles of S1–S29. | 04 | 01.5, 01.6 | |
| E2E-M16-06 | Guest → `/login` for four routes; student → landing page for S24 and S29; S23 without "Cipta Tournament Baru". | 05 | 02.1, 02.2 | yes |
| E2E-M16-07 | 404 page for the 11 URLs of AC-02.3 and for `/liga/sertai`, `/permainan/roda-nasib/spin`. | 06 | 02.3, 02.4 | |
| E2E-M16-08 | Query tolerance of AC-02.5 (S2, S3 bogus, S20, S19 darjah 7, S28 Monday normalisation). | 07 | 02.5 | |
| E2E-M16-09 | Banner hidden on `/dashboard`, `/permainan`, `/tournament` (one request each, `[]`), no request on `/admin/permainan`; `failNext` 500 → no banner, page intact. | 08 | 03.1, 03.4 | |
| E2E-M16-10 | Fixture `tournaments`: registration card ("Pendaftaran dibuka", "DAFTAR", link), ongoing card, live card ("LIVE: … vs …", "MAIN"), stacked in order. | 09, 10 | 03.2, 03.3 | yes |
| E2E-M16-11 | Admin creates a tournament with "Cipta & Buka Pendaftaran" → banner on `/dashboard` and card on S23; a draft appears nowhere. | 11, 113 | 03.5, 33.7 | yes |
| E2E-M16-12 | At 375, a sweep of every visible text node of the content area of every M16 screen: none below 12 px (incl. the FN-M16-1.4.1 list). | 12 | 04.1 | |
| E2E-M16-13 | `scrollWidth ≤ innerWidth` on every M16 route at the three sizes; S2, S3, S7, S27 tables and the S4 "Battle Terkini" list (8106 with its seeded long names) scroll in their card; S27 "Purata" reachable. | 13 | 04.2 | |
| E2E-M16-14 | Names on S4, S7, S8, S20, S27 equal the M02 names of their user ids; "Admin Demo" as the Top 10 #1. | 14 | 04.3 | |
| E2E-M16-15 | Replay a quick match, a Papan Bijak quick match and a spin twice with the same seed → identical bot names, answers and segment. | 15 | 04.4 | yes |
| E2E-M16-16 | S1 default: hero, "Biasa" active, 7 tiles, buttons disabled; "Lagi 24 subjek lain" → 24 tiles and "Tutup"; Matematik selected → buttons enabled. | 16, 17, 19 | 05.1, 05.2 | |
| E2E-M16-17 | "SPM" for the admin: tooltip toggles, closes on an outside click, type stays "Biasa". | 18 | 05.3 | |
| E2E-M16-18 | "PKSK": 15 domains, levels "Tingkatan 1" / "Tingkatan 4"; buttons enable only after domain + level. | 19 | 05.4 | |
| E2E-M16-19 | Student (grade 10): "SPM" unlocked, SPM subject tiles, selection enables the buttons. | 20 | 05.5 | yes |
| E2E-M16-20 | "Ranking Pelajar" and "Ranking Sekolah" links. | 21 | 05.6 | |
| E2E-M16-21 | Visibility switch texts both ways. | 22 | 06.1 | |
| E2E-M16-22 | Quick Match with Matematik: request body, searching card "0:00" → "0:03" → "0:06", arena after the 3rd poll. | 23, 24, 25, 27 | 06.2, 06.3 | yes |
| E2E-M16-23 | "Batal" during a search: no request after the click; the abandoned queue is `expired` in the store and never matched. | 24, 27 | 06.4 | yes |
| E2E-M16-24 | Hooks `never` (advance 120 s), `expired`, 5 × `error:500`, 5 × `network` → the four messages. | 25 | 06.5 | yes |
| E2E-M16-25 | Battle Sekolah with Bahasa Cina (0 questions) → banner "Ralat dari server. Sila cuba lagi."; close clears it. | 26 | 06.6 | yes |
| E2E-M16-26 | Hook `incoming`: the incoming card copy; "Tolak" → searching again; second run "Terima" → arena. | 28 | 07.1, 07.2 | yes |
| E2E-M16-27 | No control starts a queue join at any width; hook `battleWaiting` shows the waiting card, then `rejected` shows "{name} menolak permohonan anda.". | 29 | 07.3 | yes |
| E2E-M16-28 | Cabar Kawan: 1 character sends nothing; "zzqxv" → "Tiada pelajar dijumpai"; overlay click closes. | 30 | 08.1 | |
| E2E-M16-29 | Cabar Kawan search for 4326's name → row → send → alert text, modal closed, invitation stored for 4326. | 31 | 08.2 | yes |
| E2E-M16-30 | Default: `invitations` requested on load, modal closed. | 32 | 08.3 | |
| E2E-M16-31 | Fixture `invitation`: modal opens itself; "Tolak" → empty text; reload with the fixture, "Terima" → arena. | 32, 33 | 08.4 | yes |
| E2E-M16-32 | Arena loads for a player (players, scores 0, "Soalan 1/10", 4 options); another user and a random uuid → 404. | 34 | 09.1 | yes |
| E2E-M16-33 | Arena: correct answer at 3 s → +900; wrong → +0; the bot's answer and score appear (seeded stream). | 35, 36 | 09.2 | yes |
| E2E-M16-34 | "Tamatkan" → confirm text → OK → result "Kalah". | 37 | 09.3 | yes |
| E2E-M16-35 | Finish 10 questions → result title and scores; the battle is first in S5 ("baru sahaja") and in S4 "Battle Terkini" of the player's school. | 38, 40 | 09.4, 10.2 | yes |
| E2E-M16-36 | S5 empty for the admin. | 39 | 10.1 | |
| E2E-M16-37 | S2 default: "Mingguan" active, the 7 columns and the empty text. | 41 | 11.1 | |
| E2E-M16-38 | "Bulanan" lists 4316 and 4317 "2/0/2"; after the student wins a battle, weekly and monthly rows "1/0/0". | 41, 42 | 11.2, 11.3 | yes |
| E2E-M16-39 | S3 weekly empty, monthly 8082 row, all-time 7 rows (8082 "10" "5/0/5" "4", DV-M16-36) and podium 8106 / 8090 / 8078. | 43, 44, 45 | 12.1, 12.2, 12.3 | |
| E2E-M16-40 | S3 all time + Johor: URL, rows #5 and #7, links keep `state`, podium national; click a school → S4. | 44, 45, 46 | 12.4, 12.5 | |
| E2E-M16-41 | S4 8106: hero, cards, both period boxes empty, "Pejuang" empty, 10 battles with the first two rows as AC-13.3. | 47, 48, 49 | 13.1, 13.2, 13.3 | |
| E2E-M16-42 | S4 900 zeros and empty states; 99999999 → 404; 8880 vs 2710 colours of 4320, their cards 3/2/33%/1 and 3/1/8%/1, the green "0" of B on the 0–0 row; 8082 "Bulan Ini" #1 8 4/0/4 591. | 47, 48, 49, 50 | 13.2, 13.4, 13.5, 13.6 | |
| E2E-M16-43 | S6 header, empty rooms, 18 cards in order with badges, chips, buttons; card body and button navigate; 1 / 2 / 3 columns. | 51, 52 | 14.1, 14.2, 14.4 | |
| E2E-M16-44 | S6 chips: admin (no Papan Bijak chip, Battle chip); pelajar2 (both chips). | 53 | 14.3 | |
| E2E-M16-45 | Fixture `openRoom`: the strip shows the room link to `/papan-bijak/PB1234`. | 51 | 14.5 | yes |
| E2E-M16-46 | S7 create form: options, auto box, "Tukar" → select with optgroups, Tingkatan 2 → "Semua Tingkatan (1-5)", "← Guna auto"; custom range; "Cara Bermain:". | 54, 55, 58 | 15.1, 15.2, 15.3, 15.6 | |
| E2E-M16-47 | S7 join: empty submit blocked by the native bubble; 7th character not accepted. | 56 | 15.4 | |
| E2E-M16-48 | S7 create (Matematik, Darjah 4, same grade, 4) → `/papan-bijak/{code}` with a 6-character code. | 57, 67 | 15.5 | yes |
| E2E-M16-49 | Papan Bijak quick match: request body, counter 0s → 2s, matched room on the 3rd poll; cancel; hook `expired` → error visible after the search. | 59, 60 | 16.1, 16.2, 16.3 | yes |
| E2E-M16-50 | Top 10 rows, pills, medals, truncation and initials. | 61 | 17.1, 17.2 | |
| E2E-M16-51 | S8–S12 heroes, create forms (one-way "Tukar"), join input upper case and not required. | 62, 63, 64 | 18.1, 18.2, 18.3 | |
| E2E-M16-52 | Pendahulu rows of S8 and S11; the same order on two loads. | 65 | 18.4 | |
| E2E-M16-53 | `/perang-fakta/XXXXXX` (and the four other lobbies) → lobby with the flash at the top, visible at 375 without scrolling. | 66 | 18.5 | |
| E2E-M16-54 | S8 join with an unknown code → lobby flash. | 64 | 18.6 | yes |
| E2E-M16-55 | Perang Fakta room: waiting, bot joins, "Mula", 15 rounds at 10 s (clock), result; lobby win +1; S29 "Selesai" +1. | 67, 68, 69, 70 | 19.1, 19.2, 19.3 | yes |
| E2E-M16-56 | Save 30 quiz tiles in S29 → reload shows 30; a new Papan Bijak room has 30 quiz tiles and the 3/3/2/2 special tiles. | 69, 135 | 19.4, 39.5 | yes |
| E2E-M16-57 | Picker on S13 (nothing runs, no submit after 60 s), "Darjah 4" starts; S14, S15, S16, S19 overlays; "← Kembali ke Hub". | 71 | 20.1, 20.2, 20.3 | |
| E2E-M16-58 | Betul atau Salah: countdown steps, 6 correct → "🔥 6 KOMBO" hot and score 102, time up → result tiles, one submit, "🏆 REKOD BARU!" above 38. | 72, 73, 74, 75, 91 | 21.1, 21.2, 21.3, 21.4 | |
| E2E-M16-59 | Cabaran Kilat: question with difficulty chip, correct / wrong classes and combo, 400 ms step, result above / below 40. | 76, 77, 78 | 22.1, 22.2, 22.3 | |
| E2E-M16-60 | Tembak Jawapan: HUD, 5 correct → "⚡ LEVEL 2!", wrong tap fades a heart, 3 lives lost → result. | 79, 80, 81 | 23.1, 23.2, 23.3 | |
| E2E-M16-61 | Susun Jawapan: layout, correct check "+{points} mata", wrong → retry / skip, tile removal, result after 20. | 82, 83, 84, 85 | 24.1, 24.2, 24.3, 24.4 | |
| E2E-M16-62 | Kad Memori: layout without picker, mismatch back after 800 ms, match, complete overlay not closed by an outside click. | 86, 87, 88, 89 | 25.1, 25.2, 25.3 | |
| E2E-M16-63 | Payload counts and prefixes of S13–S17; every item id exists in M04 and is eligible. | 90, 137 | 26.1 | |
| E2E-M16-64 | Submit stores once; a second submit of the session → 409. | 91 | 26.2 | yes |
| E2E-M16-65 | With the M14 seed every game shows "0 🪙" / "+0", no coin-fly, wallet unchanged. | 92 | 26.3 | |
| E2E-M16-66 | Fixture `settingCoins`: Cabaran Kilat 3 correct in a row → "6 🪙" and wallet +6. | 92, 136 | 26.4 | yes |
| E2E-M16-67 | Roda Nasib: header, chips "2 kali spin" / "0 Syiling dimenangkan", 8 segments; spin → "⏳ Sedang Pusing...", modal of the seeded segment, then "✅ Sudah Spin Hari Ini" and "3 kali spin". | 93, 94 | 27.1, 27.2 | |
| E2E-M16-68 | Fixture `spinNothing`: "😅", "Cuba Lagi", "Jangan risau, cuba lagi esok!", "Tutup" closes. | 95 | 27.4 | |
| E2E-M16-69 | Fixture `spinSyiling5` (segment_index 2) with setting 0 (no "+5 Syiling" lines) and with `settingCoins` ("+5 Syiling", "Ditambah ke akaun kamu!", chip 5); forced second spin → 409 alert; next day enabled. | 94, 95 | 27.3, 27.5 | yes |
| E2E-M16-70 | Jutawan: picker, header and stats; `?darjah=4` 10 subjects with counts and links; `?darjah=10` / `11` headings and 20 subjects. | 96, 97 | 28.1, 28.2, 28.3 | |
| E2E-M16-71 | Jutawan game Matematik D4: 3 correct then wrong → "L3"; S19 "L3" / "1"; "50:50" removes 2 options, lifelines 2. | 98 | 28.4, 28.5 | yes |
| E2E-M16-72 | S20: header, week "21 Sep — 27 Sep 2026", countdown "2h 8j 19m" then "2h 8j 18m", "Tamat!" at the end; prizes; admin own-status card and link. | 99, 100, 101 | 29.1, 29.2, 29.3, 29.4 | |
| E2E-M16-73 | S20 ranking at the clock: 20 rows of Q-WEEK-RANK as §6.11.4 (2022 450, W2 329, W4 187, W3 145, W5 118, …; pelajarmaju rank 14 on the 26 tie); student with sessions sees the PROPOSED rank line. | 101, 102, 138 | 29.5, 29.6 | yes |
| E2E-M16-74 | S21 empty copy. | 103 | 30.1 | |
| E2E-M16-75 | `/permainan/sambung-kata` → handled 500 page, "Cuba Semula" reloads. | 104 | 31.1 | |
| E2E-M16-76 | S23 hero, admin button, empty text. | 105, 106 | 32.1 | |
| E2E-M16-77 | Fixture `tournaments`: two cards on S23 linking to their uuids. | 106 | 32.2 | yes |
| E2E-M16-78 | S24 defaults; format switching; source switching (empty paper select, 31 checkboxes); SPM count BM → 25 + note, then Bahasa Arab unchanged; "Simpan Draf" visible; empty submit blocked; "Batal". | 107, 108, 109, 110, 111, 112 | 33.1, 33.2, 33.3, 33.4, 33.5, 33.6, 33.8 | |
| E2E-M16-79 | S24 valid submit with each action → status, redirect, flash, list. | 113 | 33.7 | yes |
| E2E-M16-80 | Fixture `tournaments`: open the registration one from the banner → read-only detail. | 114 | 34.1 | yes |
| E2E-M16-81 | `/tournament/{random uuid}` → 404. | 114 | 34.2 | |
| E2E-M16-82 | S25 tabs and counts, empty "Liga Saya", open card chips with "Sekolah", join modal (required, keeps value, overlay closes). | 115, 116, 117 | 35.1, 35.2, 35.3 | |
| E2E-M16-83 | Student joins with "RMU4VCBS" → league 1 with the flash, "Liga Saya (1)"; unknown code → error flash. | 118 | 35.4 | yes |
| E2E-M16-84 | S26 fields, defaults, level grid 3 / 6 columns; empty submit blocked; "Batal". | 119, 120 | 36.1, 36.2 | |
| E2E-M16-85 | S26 valid submit → league with an 8-character code, "Akan Datang", creator line, flash. | 120 | 36.3 | yes |
| E2E-M16-86 | `/liga/1`: header, code, "Kongsi" URL, "Sertai Liga Ini", schools, empty standings. | 121, 122, 123, 124, 125 | 37.1, 37.2, 37.3 | |
| E2E-M16-87 | `/liga/2`: header, no "Sertai", T4 / T5 tables; 375 scroll in the card; `/liga/3`, `/liga/0`, `/liga/999` → 404. | 121, 123, 125, 126 | 37.4, 37.5, 37.6 | |
| E2E-M16-88 | Student "Sertai Liga Ini" on league 1 → school listed, button gone. | 123 | 37.7 | yes |
| E2E-M16-89 | S28 default: hero, week line, header row, 49 rows with medals and styles (rows #17 and #49 as AC-38.2), two columns hidden at 375, footer. | 127, 128, 129 | 38.1, 38.2, 38.3, 38.4 | |
| E2E-M16-90 | S28 `?week=` 2026-09-14 / 09-07 / 08-31 → 48 rows without the 21 Sep row #46, the rows of AC-38.5 (14 Sep #18 Kelantan 🔥 2.4, #20 Kuala Lumpur 🔥 1.5; 31 Aug #17 Selangor 0.2 % 🔥 1.7); 2025-01-06 → empty state; `bogus` → current week. | 130, 131 | 38.5, 38.6 | |
| E2E-M16-91 | S29 tiles 160 / 0 / 0 / 189, breakdown 35 → 38 → 0, range bubble at 50, game list with "Multiplayer 2-6 pemain." and "Lihat" targets. | 132, 133, 134 | 39.1, 39.2, 39.3, 39.4 | |
| E2E-M16-92 | Settings save 30 → flash, reload 30. | 135 | 39.5 | yes |
| E2E-M16-93 | Repository level: each finished game type calls `onGameResult` once with the documented payload; the displayed syiling equals `credited`. | 136 | 40.1 | yes |
| E2E-M16-94 | Repository level: after games and a battle, Q-ANS-ALL stays 478,499 and every item id is an M04 id; Q-M16-BATTLES 168 / 0 / 66 and Q-M16-BATTLES-WIN 0 · 0, 4 · 5, 23 · 47 at the clock. | 137 | 40.2 | |
| E2E-M16-95 | M11 S1 for a class with one battle and two games of a student today → "Battle" 1, "Permainan" 2. | 139 | 40.3 | yes |
| E2E-M16-96 | Repository level: M02 users and schools totals unchanged with the M16 anchors registered. | 140 | 40.4 | yes |

Provisional: E2E-M16-06, 10, 11, 15, 19, 22, 23, 24, 25, 26, 27, 29, 31, 32, 33, 34, 35, 38, 45, 48, 49, 54, 55, 56, 64, 66, 69, 71, 73, 77, 79, 80, 83, 85, 88, 92, 93, 95, 96 (39 of 96)

## 13. Open questions

1. **SQ-M16-01 Owner acceptance of §6.12.** M04 (XR-01 Jutawan store, pools), M14 (XR-02 contract, XP rule, scope of the setting), M05 (XR-03 weekly anchors and Q-WEEK-RANK), M02 (XR-04 anchors, placements, 10,218), M11 (XR-05), the global shell (XR-06 banner mount), the formatter (XR-07) — items for the next XL gate; the provisional ACs that depend on them stay provisional.
2. **SQ-M16-02 Live run** (URS OQ-M16-01): arena, rooms, submits, invitations, tournament and league saves, SPM unlocked battle, spin outcome, Jutawan game.
3. **SQ-M16-03 Simulation parameters** (URS OQ-M16-15): bot on the 3rd poll, 120 s server expiries, 10 s abandonment, 2–12 s bot answers at the M05 platform accuracy (read from Q-ANS-CORRECT ÷ Q-ANS-ALL, 82.84 % with M05 v1.10), bots joining one per room poll — PROPOSED values for the Delivery Lead to confirm at G1.
4. **SQ-M16-04 Standings runtime formulas** (URS OQ-M16-08): school / student "Skor", student "Streak", Papan Bijak "Skor"; seeds keep the observed values.
5. **SQ-M16-05 Display constants.** DC-M16-01 (10,218) until M02 answers; DC-M16-02 retired in v1.4 (M04 Q-JUT-COUNT, XR-M16-01 applied); DC-M16-03 (stored Ketepatan / Skor of 8 school rows).
7. **SQ-M16-07 Discovery top-up TU-M16-01** — **Closed (v1.2):** captured in `_topup-2026-09-26.json`; seeded in §6.11.6.
6. Carried from the URS: OQ-M16-02 … OQ-M16-16.
