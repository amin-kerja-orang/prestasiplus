# Game and gamification mechanics: PRD audit and merge-ready specs (R1)

Audit date 2026-11-04. Read-only audit of `docs/prd/r1/` (10, 20, 30, 40, 50, 60), the V2 captures (`.evidence/v2-screens/`, already quoted inside the PRD), the V3 code in the worktree and the V1/V2 docs (`docs/requirements/srs/M14-gamification.md`, `M16-battle-games.md`). No repo file was edited.

Status legend (PRD status = what the PRD text alone lets a cloud agent build):
- COMPLETE = buildable from the PRD as written. PARTIAL = some of the rule is there, numbers or states are missing. MISSING = not in the PRD (code or V1/V2 docs may have it).
- `[CODE]` = rule exists in V3 code (file:line). `[V2]` = observed in V2 capture. `[SRS]` = V1/V2 SRS in repo. `[PROPOSED]` = no source; minimal fair rule for minors. `[MISSING-NO-SOURCE]` = no source anywhere.
- Time zone for every day, week, month, reset, streak and limit: Asia/Kuala_Lumpur (UTC+8, no DST). Day = 00:00:00 to 23:59:59.999. Week = Monday 00:00 to Sunday 23:59:59.999. Month = calendar month. [CODE standings.windows.ts:11-30, wallet/streak.service.ts:18]

---------------------------------------------------------------------------------------------------

## 0. Headline findings (read first)

1. The PRD names about 14 games and says almost nothing about how any of them is played. Only the Battle Arena screen, the Cabutan, Kotak Misteri, Tukar Token, tier table and Rujuk Kawan values are specified. `10-murid.md` R1-MUR-21 (lines 879-907) has 7 functional requirements for the whole games hub. Papan Bijak, Perang Fakta, Benteng Ilmu, Perlumbaan Matematik, Kuiz Relay, Teka Silang Kata, Betul atau Salah, Cabaran Kilat, Tembak Jawapan, Susun Jawapan, Kad Memori, Jutawan Ilmu and Roda Nasib are named once (line 888) and never specified. A cloud agent would invent every number.
2. The "multiplayer" rooms and the Battle opponent are simulated in V3 code. Rooms: only the host plays, every other seat is a simulated bot [CODE engine.ts:83-87, rooms.service.ts:306 `addBot`]. Battle: the opponent is a real pupil's identity whose ten answers are pre-drawn by a random generator [CODE arena.service.ts:149-193, bots.ts:19-26]. The room bot pool even picks real pupils of the host's school "shown as players" [CODE bot-pool.ts:8-14, comment: "Open question 3: bots are real pupils shown as players; the lead decides before production"]. This is a privacy and honesty defect for minors. The PRD does not decide it.
3. No game writes to `practice_answers`. A grep of `games/`, `battle/`, `gamification/` for the answer store returns nothing. FR-MUR-21-4 and AC-MUR-21-6 demand it, so every game is an unbuilt requirement, not a "verify only" row.
4. Battle gives no reward at all: `port.onGameResult({coins: 0, xp: 0})` [CODE battle-engine.service.ts:137]. Room games and solo games use per-game coin constants (Benteng 8/35, Perang Fakta win 10, Mathrace 5, Betul/Salah 1-5 per correct, Jutawan 1000) that PRD 4.4 and FR-MUR-21-4 forbid ("the rate is the admin Syiling rate, not a game constant").
5. Cabaran Harian: the PRD requires a "Tuntut" claim (FR-MUR-30-3, counter "ganjaran dituntut"); the code has no claim endpoint and auto-credits when a session completes [CODE gamification.controller.ts:58-100, SRS BR-M14-13].
6. Tournament and Liga: the code can only create and list tournaments [CODE tournaments.service.ts:49-117]; league standings are "stored, never recomputed" [CODE leagues.repository.ts:204, SRS BR-M16-34]; a league is joined by a school, not by a pupil [CODE leagues.service.ts:185-198], while the PRD says a pupil taps "Sertai Liga Ini" (AC-MUR-23-1). No scoring formula exists anywhere.
7. Kedai Hadiah: seeds mark all 8 gaming gifts `requiresParentConsent: true` (status `pending_parent_consent`) but the parent-approval routes do not exist ("not in B1 (UD-3)") and the pupil status list has only 3 words. A pupil redeeming a gaming gift would be stuck forever. The per-pupil budget (`reward_budget_sen_session`) is stored but never checked in redeem [CODE shop.service.ts:74-110].
8. Kotak Misteri in code is four token boxes with uniform ranges and XP [CODE shop.constants.ts:40-45]; the PRD (from V2) wants one 50-syiling box with a 7-row odds table and no XP. The PRD odds are fully given; only the engine details are missing.
9. Tier and ranking basis contradict: V2 "0+ syiling sepanjang hayat" (lifetime) vs the code/SRS comparing `current_syiling` (balance) for tier upgrade [SRS BR-M14-08]; Kedudukan ranks by balance ("Kedudukan dikira berdasarkan baki syiling.") while Papan Pendahulu "all time = balance" too but the code ranks by lifetime earned [SRS BR-M14-17]. Spending coins in the shop would lower a pupil's rank.
10. Achievements: the PRD lists 3 badges (V2) and says "V3 has 25 (kept)". The 25 names, conditions and rewards exist only in a seed file [CODE prisma/seed/gamification-data.ts:23-47]. "Juara Battle" (V2) is not among the 25. "Si Pantas" can never unlock (`fast_answers` returns 0, gamification.service.ts:612-614). "Pelajar Awal" and "Streak 7 Hari" have the same condition.

---------------------------------------------------------------------------------------------------

## 1. Counts

Cells = mechanics x the 11 checks you listed, counting only cells that apply to the mechanic (for example no multiplayer check for a solo game).

| Result | Cells | Mechanics (of 25) |
|---|---|---|
| COMPLETE | 1 | 0 mechanics fully complete (Kotak Misteri price and odds is the only complete cell) |
| PARTIAL | 106 | 23 mechanics are PARTIAL overall (mostly via the generic FR-MUR-21-* lines) |
| MISSING | 63 | 2 mechanics are MISSING overall (Roda Nasib; Pencapaian rewards and rules) |
| Total | 170 | 25 |

Per-mechanic matrix (columns 1 entry, 2 selection, 3 turn/time, 4 scoring, 5 multiplayer, 6 rewards, 7 board/ranking, 8 economy, 9 achievements, 10 answer store, 11 errors; C/P/M, dash = not applicable):

| ID | Mechanic | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| GAME-01 | Battle Arena | P | P | M | M | P | M | P | - | M | P | M |
| GAME-02 | Papan Bijak | P | P | M | M | P | P | M | - | - | P | P |
| GAME-03 | Perang Fakta | P | P | M | M | M | P | M | - | - | P | P |
| GAME-04 | Benteng Ilmu | P | P | M | M | M | P | M | - | - | P | P |
| GAME-05 | Perlumbaan Matematik | P | P | M | M | M | P | M | - | - | P | P |
| GAME-06 | Kuiz Relay | P | P | M | M | M | P | M | - | - | P | P |
| GAME-07 | Teka Silang Kata | P | P | M | M | M | P | M | - | - | P | P |
| GAME-08..12 | Betul/Salah, Cabaran Kilat, Tembak Jawapan, Susun Jawapan, Kad Memori (each) | P | P | M | M | - | P | M | - | - | P | P |
| GAME-13 | Jutawan Ilmu | P | P | M | M | - | P | M | - | - | P | P |
| GAME-14 | Roda Nasib | M | - | M | M | - | M | - | M | - | - | M |
| GAME-15 | Liga, Tournament | P | P | M | M | P | M | P | - | M | P | M |
| GAME-16 | Papan Pendahulu, Kedudukan, Ranking, Sekolah Bersaing | - | - | - | P | - | - | P | - | - | - | P |
| GAME-17 | Syiling, XP, Level, Tier, Streak | - | - | - | P | - | P | - | P | - | - | M |
| GAME-18 | Tukar Token | P | - | - | - | - | - | - | P | - | - | P |
| GAME-19 | Cabaran Harian | P | - | P | P | - | P | - | - | - | P | P |
| GAME-20 | Misi Harian | P | P | M | P | - | P | - | - | - | P | M |
| GAME-21 | Kedai Hadiah, Tebusan | P | - | - | - | - | P | - | P | - | - | P |
| GAME-22 | Cabutan Bertuah | P | - | - | - | - | P | - | P | - | - | P |
| GAME-23 | Kotak Misteri | M | - | - | - | - | P | - | C | - | - | P |
| GAME-24 | Rujuk Kawan | P | - | - | - | - | P | - | P | - | - | P |
| GAME-25 | Pencapaian | - | - | - | - | - | M | - | - | P | - | M |

### Top 15 gaps (ordered by risk of a half-built result)

1. No game writes its answers to `practice_answers` (mode `game`); reports will not count games (GAME-00).
2. Battle/room "multiplayer" is simulated with real pupils' identities; the PRD does not decide real vs honest bot (GAME-01..07, decision D-GAME-1).
3. Battle gives 0 coins and 0 XP in code; the PRD never states Battle rewards (GAME-01).
4. Per-game coin constants contradict PRD 4.4 (rate is an admin setting); no daily cap, so turning "Mini-games beri syiling?" to Ya opens an exploit (GAME-00).
5. Turn/time rules of all 13 non-Battle games are in no PRD line (timers, timeout, leave, reconnect).
6. Scoring and tie-break of every game and every board are undefined in the PRD (code has points for solo games and Battle only).
7. Tournament formats (`knockout`, `league`, `hybrid`) and Liga scoring have no engine; a pupil cannot join; standings are never computed (GAME-15).
8. Cabaran Harian "Tuntut" claim has no API; rewards auto-credit (GAME-19).
9. Kedai Hadiah parent-consent status is unreachable and the budget is never enforced (GAME-21).
10. Cabutan draw: no "Cabut pemenang" engine, no fairness/audit rule, no cancel/refund rule (GAME-22).
11. Misi Harian `rewardCoins` can be 0..10,000 per pupil per mission: a teacher can mint unlimited coins (GAME-20).
12. Tier thresholds basis (lifetime vs balance) and ranking basis (balance vs earned) contradict (GAME-16, GAME-17).
13. Pencapaian: full list, conditions, rewards are only in a seed; "Si Pantas" cannot unlock; duplicate "Streak 7" badges; "Juara Battle" is missing (GAME-25).
14. Rujuk Kawan: reward 100 vs code 50+25, code length 7 vs V2 8, no abuse cap, no admin setting names (GAME-24).
15. Roda Nasib and "Pertandingan"/"Uji Minda" (routes in API-GAME-02) are in no PRD row at all (GAME-14).

### Constants that must become admin settings

All of section 3. The ones that are hard-coded constants today: syiling rate by mode (`MISSION_COINS_PER_CORRECT=3` at practice/rules.ts:50; `ROOM_COINS` rooms/engine/constants.ts:31-36; solo coin formulas solo.rules.ts:44-52; `jutawanCoins` solo.rules.ts:133; spin segment values spin.rules.ts:11-20; mystery box table shop.constants.ts:40-45; `REFERRAL_REWARD_REFERRER/REFEREE` 50/25 gamification.constants.ts:67-68; `DAILY_LOGIN_REWARD=2` gamification.constants.ts:71; `BATTLE_RULES` questions 10, seconds 15, queue 120 s, invitation 24 h battle/schema.ts:26-41; `GRACE_SECONDS=3` arena.service.ts:19; board `BOARD_FIXED` and room round constants engine/constants.ts:4-18; `MIN_MS_PER_ITEM`, `JUTAWAN_MIN_MS_PER_QUESTION` solo.rules.ts:142-143; `ACCURATE_SESSION_PCT=90` gamification.constants.ts:16; titles `TITLES` wallet.constants.ts:13-20; Tukar Token / tier rates are already DB rows).

---------------------------------------------------------------------------------------------------

## 2. Decisions the user must confirm (all have a default so cloud agents can proceed)

| ID | Decision | Default used in this spec |
|---|---|---|
| D-GAME-1 | Real opponents vs simulated | Real humans first. If none joins in time, an honestly labelled robot ("Robot PrestasiPlus", no real pupil identity, never counted in rankings, badges or leagues) is used. Setting `battle_bot_fallback_seconds` (Battle, default 30) and `games_room_bots_enabled` (rooms, default Ya). A real pupil is never used as a bot. |
| D-GAME-2 | Syiling from games | `games_award_syiling` stays Tidak (V2). When Ya, syiling = rate x correct answers, capped per day. |
| D-GAME-3 | Liga: school or pupil joins | School joins (code); pupils of the school count automatically. Pupil sees own contribution. |
| D-GAME-4 | Tournament formats in R1 | `single_match` and `league` only; `knockout` and `hybrid` hidden (no source defines pairing). |
| D-GAME-5 | Parent consent on Kedai Hadiah | Not built in R1; field kept, defaults false, all seeded gifts set false. |
| D-GAME-6 | Sekolah Bersaing minimum | Setting default 1 pupil (V2 parity); recommended 5. |

---------------------------------------------------------------------------------------------------

## 3. Gamification settings (admin-changeable; screen = Kawalan Reward / Tetapan Permainan / Tetapan Gamifikasi; only Admin Pusat may change; every write audited, FR-ADM-H0.3)

Store: the existing `gamification_settings` key/value table (DM-38 "existing tables are enough"); the PRD alias `reward_settings.mini_games_give_coins` = key `games_award_syiling`. A setting change applies only to events after the save.

| Setting key (screen label) | Default | Range | Source |
|---|---|---|---|
| `flat_quiz_reward` ("Syiling flat / soalan betul") | 1 | integer 0-20 | [V2] [CODE seed gamification-data.ts:59] |
| `games_award_syiling` ("Mini-games beri syiling?") | 0 = "Tidak (XP sahaja)" | 0/1 | [V2] |
| `xp_per_correct` | 10 | 1-100 | PRD 4.4 |
| `xp_level_size` | 1000 (level = floor(XP/1000)+1) | 100-10000 | PRD 4.4 |
| `games_daily_syiling_cap` | 100 per pupil per MYT day, all games together | 0-1000 (0 = no syiling from games) | [PROPOSED] |
| `games_daily_xp_cap` | 500 | 0-5000 | [PROPOSED] |
| `game_win_xp` / `game_draw_xp` / `game_play_xp` | 20 / 10 / 5 | 0-100 | [PROPOSED] |
| `game_win_bonus_syiling` | 5 (only when `games_award_syiling`=1) | 0-50 | [PROPOSED] |
| `games_min_ms_per_answer` | 1000 (solo, Kad Memori per move), 2000 Jutawan | 0-5000 | [CODE solo.rules.ts:142-143] |
| `battle_questions` / `battle_question_seconds` / `battle_grace_seconds` | 10 / 15 / 3 | 5-20 / 10-60 / 0-10 | [CODE battle/schema.ts:27-28, arena.service.ts:19] |
| `battle_queue_seconds` | 120 | 30-600 | [CODE battle/schema.ts:31] |
| `battle_bot_fallback_seconds` | 30 (0 = never use a robot) | 0-120 | [PROPOSED] |
| `battle_bot_accuracy_pct` | 60 | 10-90 | [PROPOSED] (code uses platform accuracy 82.84%, too hard to beat for a minor) |
| `battle_invitation_hours` | 24 | 1-72 | [CODE battle/schema.ts:33] |
| `games_room_bots_enabled` | 1 | 0/1 | [PROPOSED] |
| `games_absent_seconds` | 30 (no poll = absent) | 10-120 | [PROPOSED] |
| `boardgame_quiz_tiles` (Papan Bijak "Bilangan Petak Soalan") | 35 | 0-38 | [V2] [CODE games.constants.ts:35-36] |
| `challenge_accuracy_min_questions` | 5 (accuracy-type challenge and "Tepat Sasaran" need a session of at least 5 questions) | 1-20 | [PROPOSED] |
| `daily_login_syiling` | 2 | 0-10 | [SRS BR-M14-14] [CODE gamification.constants.ts:71] |
| `spm_first_session_syiling` | 7 (first SPM-mode session of the day) | 0-20 | [SRS BR-M14-14]; owner Bijak lane |
| `tier` rows (min syiling, conversion rate) | Gangsa 0/50, Perak 500/40, Emas 2000/30, Platinum 5000/20 | min strictly increasing, first = 0 | [V2] |
| `token_convert_unit` | 1 token per `rate` syiling (rate from tier) | n/a | [V2] |
| `mystery_box_cost` | 50 | 1-500 | [V2] |
| `mystery_box_daily_max` | 5 | 1-20 | [PROPOSED] |
| mystery prize rows (label, kind, amount, weight %, stock) | table in GAME-23 | weights are integers summing to 100 | [V2] |
| `draw_max_tickets_per_pupil` (per draw field) | 10 | 1-100 | [SRS V1 form] |
| `reward_budget_sen_session` ("Bajet tebus / sesi") | 300 (RM3.00; V2 value) | 0-100000 | [V2] (seed has 1000, V1 value; use the V2 value, D9 contradiction recorded) |
| `current_session_year` | 2026 | 2020-2100 | [V2] |
| `referral_referrer_syiling` | 100 | 0-1000 | [V2] |
| `referral_referee_syiling` | 0 | 0-1000 | [V2 silent], code has 25 |
| `referral_max_rewarded` | 20 friends per pupil | 1-200 | [PROPOSED] |
| `mission_reward_max` | 100 syiling per mission | 0-10000 | [PROPOSED] (contract allows 10000) |
| `sekolah_bersaing_min_pupils` | 1 | 1-50 | [D-GAME-6] |
| `sekolah_bersaing_top_n` | 30 | 10-100 | [V2] |

---------------------------------------------------------------------------------------------------

## 4. Game specs

Each block: audit table (rule | PRD status | code today | V2 | proposed) followed by the "Game spec" to merge. API names refer to `60-api-contract.md` IDs; where a new route or table is needed it is named `API-GAME-nn` / `DM-nn` with the next free number (API-GAME-11 up, DM-45 up) [PROPOSED names; the architect may renumber].

### GAME-00 Common rules for every game (merge as 10-murid section 4.4a)

| Rule | PRD | Code today | V2 | Proposal |
|---|---|---|---|---|
| Who may play | PARTIAL (FR-MUR-21-3 Tingkatan only) | contract still lists DARJAH_1..6 [CODE common.ts:86-98]; solo refuses < 7 | `/permainan` flag off | role student, active, T1-T5. Teacher/admin in Mod Pelajar: play yes, no reward, no standing, no practice_answers (is_test) |
| Question source | PARTIAL (FR-MUR-21-2, N05.3 OQ-G1) | text-only, approved MCQ [CODE games/core/game-questions.service.ts] | Battle approved only | approved, servable MCQ, text-only (no figure, no stimulus group). Reason `image_games` shown to admin. OQ-G1 decided: keep exclusion in R1 |
| Difficulty mix | MISSING | Jutawan only | n/a | see each game |
| No repeats | MISSING | none | n/a | within a session no question twice. Across sessions, prefer questions the pupil has not answered in a game in the last 14 days when the pool is at least 3 x the draw size, else allow |
| Answer store | PARTIAL | NONE written | n/a | see below |
| Reward formula | PARTIAL (4.4 table row "Games") | per-game constants | XP only | see below |
| Idempotency | MISSING | `key` on onGameResult, sourceId `game:<key>` [CODE wallet-rewards.ts:85] | n/a | one reward event per (game session id, user); replay returns the first result |
| Rate limits | n/a | GAMES_LIMITS [CODE games.constants.ts:13-19] | n/a | keep |

Game spec GAME-00:
1. **Answer store.** Every time a pupil answers (or times out on) a bank question in any game, write one `practice_answers` row: `mode='game'`, `attempt_id=<game session id>` (Battle: battle uuid; room: room code + `:` + start timestamp; solo: session uuid), `part_ref='<game_key>#<position>'` (game keys: `battle`, `papan-bijak`, `perang-fakta`, `benteng-ilmu`, `perlumbaan-matematik`, `kuiz-relay`, `teka-silang-kata`, `betul-salah`, `cabaran-kilat`, `tembak-jawapan`, `susun-jawapan`, `kad-memori`, `jutawan`), selected option (null on timeout), `is_correct`, seconds taken, `marks` 1 or 0 (DM-44). Timeout = a wrong answer with null option. Never written: robot answers, answers of Mod Pelajar, questions the game skipped. A game result without a bank question (Roda Nasib, Kad Memori move count) writes no row. Written in the same transaction as the game state change; unique on (`attempt_id`, `part_ref`, user) so a replay writes nothing twice. Acceptance: AC-MUR-21-6 stands.
2. **Reward formula** (replaces every per-game coin constant). Per finished game for the pupil:
   - XP = `xp_per_correct` x correct answers + (`game_win_xp` if won, `game_draw_xp` if draw, `game_play_xp` if finished and neither). Left early (forfeit) = 0 XP for the leaver, win XP for the opponent.
   - Syiling only if `games_award_syiling`=1: `flat_quiz_reward` x correct answers + `game_win_bonus_syiling` if won.
   - Daily caps: after `games_daily_xp_cap` XP or `games_daily_syiling_cap` syiling in one MYT day the rest is not credited. The result shows the capped amount.
   - A game finished faster than `games_min_ms_per_answer` x answers (any gap shorter than the minimum) is stored and scored but credits nothing and writes no personal best [CODE solo.rules.ts:136-152].
   - Ledger source `game:<game_key>`, description from `gameRow` [CODE wallet-rewards.ts:8-43], idempotency key = game session id.
3. **Result screen messages** (exact BM): reward line when credited "Anda dapat +{xp} mata dan +{syiling} syiling."; XP only "Anda dapat +{xp} mata."; cap reached "Had ganjaran permainan hari ini telah dicapai. Cuba lagi esok."; fast-play "Keputusan disimpan tanpa ganjaran."; server error mid-game "Ralat sambungan. Permainan anda disimpan. Cuba teruskan."
4. **Server error mid-game.** All game state lives on the server (rooms, Battle, solo sessions in DB). A failed action returns 5xx and changes nothing; the client retries the same action (idempotent by position). A session with no activity for 30 minutes is closed as `abandoned`: no reward, answers already written stay.
5. **Privacy.** Another pupil is shown as display name only (first given name plus first letter of the next name, e.g. "Aisyah B.", never a school) [PRD 4.3, 60 line 1054]. Robots are shown as "Robot PrestasiPlus".
6. **Hiding.** A game with fewer playable questions than its draw size is hidden from the hub (FR-MUR-21-1). Flag `permainan` off => 404 (API-AUTH-16).

---------------------------------------------------------------------------------------------------

### GAME-01 Battle Arena (Quick Match, Cabar Kawan, Battle Sekolah) `/battle`

| Rule | PRD | Code today | V2 | Proposed |
|---|---|---|---|---|
| Entry | PARTIAL (tabs Biasa/PKSK/SPM, subject, count chips 5/10/15/20, level list) | `question_type` biasa/pksk/spm; SPM needs grade >= 10 "Khas untuk pelajar Tingkatan 4 & 5 sahaja." [CODE battle-params.ts:53, battle/schema.ts:49]; count fixed at 10 | chips 5,10,15,20 shown | free; no cost; Quick Match/Battle Sekolah limit 20 battles per pupil per day (`battle_daily_max` [PROPOSED]); same Tingkatan only unless "open_to_all" |
| Count chips | PARTIAL | fixed 10 | 5/10/15/20 | chips honoured: 5, 10, 15, 20; default 10; the pool must hold the count or "Soalan tidak mencukupi." |
| Selection | PARTIAL | `deps.drawQuestions`, 10, from owner's level [CODE battle-engine.service.ts:58] | n/a | same subject, owner's Tingkatan, approved text MCQ; difficulty mix: 30% difficulty 1-2, 40% difficulty 3, 30% difficulty 4-5 (rounded; fill from nearest); both players get the same questions in the same order; no repeats; PKSK = chosen domain and target level T1/T4 |
| Turn/time | MISSING | per-player pace, 15 s each, 3 s grace, a late answer = timeout [CODE arena.service.ts:136-142] | overlay "Mencari Lawan..." timer, Batal | synchronous rounds, see spec |
| Scoring | MISSING in PRD | `1000 - round(500 x s / 15)`, s = whole seconds clamped 0..15; wrong/timeout 0 [CODE battle/schema.ts:109-113] | n/a | keep (evidence); winner/draw rule fixed below |
| Matchmaking | PARTIAL (labels only) | queue, bot on 3rd poll, expire 120 s, abandoned 10 s [CODE battle/schema.ts:29-32] | "Hanya pelajar gred sama boleh match", "Gred Saya" | see spec |
| Rewards | MISSING | 0 coins 0 XP [CODE battle-engine.service.ts:137] | n/a | GAME-00 formula |
| Ranking | PARTIAL | standings weekly/monthly/all_time; ties = stored order [SRS BR-M16-13] | "Ranking Pelajar", "Ranking Sekolah" empty states | see spec |
| Achievements | MISSING | none | "Juara Battle: Menang 10 battle" | GAME-25 |
| Answer store | PARTIAL | `battle_answers` only | n/a | GAME-00 |
| Errors | MISSING | BATTLE_MESSAGES [CODE battle/schema.ts:43-72] | n/a | list below |

Game spec GAME-01 (state machine):
- States: `queued` -> `matched` -> `active` -> (`finished` | `forfeited` | `abandoned`); invitation: `pending` -> (`accepted` -> `active` | `declined` | `expired`). Existing enums `BATTLE_STATUSES = active, finished, forfeited, abandoned` kept.
- **Quick Match / Battle Sekolah**: pupil picks mode tab, subject (or PKSK domain + level), count, level, queue visibility. A queue entry waits up to `battle_queue_seconds` (120). Matching order: same subject+type+count, same Tingkatan (unless "Keterlihatan Barisan" is off = any Tingkatan T1-T5), oldest entry first. Battle Sekolah additionally requires a different school and a pupil with a school. Client polls every 3 s. If no human within `battle_bot_fallback_seconds` (30), the server creates the battle with the robot (the pupil sees "Robot PrestasiPlus", chip "Latihan"; this battle does not enter standings, school ranking, league, "Juara Battle" progress or give win XP, only GAME-00 per-correct XP and play XP). After 120 s: status `expired`, message "Tiada lawan dijumpai.". "Batal" removes the entry at once. A queue entry not polled for 10 s is `abandoned` and never matched [CODE].
- **Cabar Kawan**: search needs at least 2 characters, returns at most 10 pupils of the SAME school only (first name + initial, no school, no avatar), role student, active, not self [CODE returns pupils of any school: change]. Invitation expires in `battle_invitation_hours` (24). Receiver sees it under "Cabaran Masuk": Terima / Tolak. One pending invitation per pair. Accept -> battle `active` with the same questions for both.
- **Round loop** (10 questions default): server stores `round_started_at` when both players are present, i.e. when the battle becomes active (round 1) or when both answered/timed out the previous round. Each round lasts `battle_question_seconds` (15) + `battle_grace_seconds` (3) at most. A player's answer after 18 s is a timeout. Round ends when both have answered/timed out or 18 s have passed. Both then see correct option, own points, opponent's points and running totals. Round points as the formula above.
- **Timeout** (no answer): 0 points, option null, counts as wrong in `practice_answers`.
- **Disconnect/reconnect**: all state is server-side; a player re-opening `/battle/arena/:uuid` resumes at the current round with the remaining time. A player with no poll for `games_absent_seconds` (30) is absent; each round an absent player times out. After 3 consecutive timeouts with no poll in between, the battle is forfeited by that player (status `forfeited`, opponent wins).
- **Leave early**: "Menyerah" (`POST /api/battle/forfeit/:uuid`) = forfeit: leaver loses whatever the scores; opponent gets win XP; leaver gets 0 XP.
- **Winner**: higher total score wins. Equal totals = draw ("Seri"), including 0-0 (the code gives 0-0 to player B [CODE battle/schema.ts:115-121, DV-M16-35]: wrong for minors, fixed to draw). A forfeit overrides scores.
- **Standings**: pupil standing = wins, battles, correct, accuracy % (correct/answered, whole number), total score. Periods Semua Masa / Minggu Ini (Mon 00:00 MYT) / Bulan Ini; rank order: wins desc, total score desc, accuracy desc, battles asc (fewer battles first), user id asc. School ranking (public, school names shown): per school sum of its pupils' Battle Sekolah score; order total score desc, wins desc, pupils who played desc, school name asc. Pupil rows show display name only. Robot battles excluded. Only the top 30 pupils and top 30 schools are listed; the viewer's own row is always shown.
- **Rewards**: GAME-00 formula (win +`game_win_xp`, draw +`game_draw_xp`, loss +`game_play_xp`).
- **Exact messages**: "Tiada lawan dijumpai." / "Soalan tidak mencukupi." / "Khas untuk pelajar Tingkatan 4 & 5 sahaja." / "Battle sudah tamat." / "Giliran tidak dijumpai." / "Cabaran tidak dijumpai." / "Ralat menghantar permohonan." / "Penerima tidak sah." [CODE BATTLE_MESSAGES]. New: result headline "Anda menang!", "Anda kalah.", "Seri!", forfeit "Lawan menyerah. Anda menang!", "Anda telah menyerah.", daily limit "Had battle hari ini telah dicapai. Cuba lagi esok.".
- **API**: API-GAME-03/04 exist. New: `battle_daily_max` setting; `GET /api/battle/arena/:uuid` returns `roundEndsAt`. DM: `battles`, `battle_participants.is_bot` exist; add `battles.counts_for_ranking boolean` (DM-45).

---------------------------------------------------------------------------------------------------

### GAME-02..07 Room games (common block)

Common PRD gap: no rule for any room game. Code facts [CODE games/rooms/*, engine/*]: 6-character code A-Z0-9; statuses `waiting`, `playing`, `finished`, `closed`; min/max players: Papan Bijak 2-6, Perang Fakta 2-6, Benteng Ilmu 2-2, Perlumbaan Matematik 2-4, Kuiz Relay 4-8, Teka Silang Kata 2-2 [CODE common.ts:42-49]; host starts; match modes `same_grade`, `same_level`, `custom` (Papan Bijak only); subjects Matematik, Bahasa Melayu, Bahasa Inggeris, Sains, Sejarah (Papan Bijak: not Sejarah) [CODE common.ts:66-71]; V1 hub: "Cipta Bilik Baru" (Subjek, Tahap Soalan, "Siapa Boleh Join?", "Maks Pemain"), "Masuk Bilik" (6-character code), "Cari Lawan Auto", "Cara Bermain" [PRD line 890].

Game spec GAME-02..07 common:
- **Room states**: `waiting` -> `playing` -> `finished`; `closed` when the host leaves a waiting room or after 15 minutes in `waiting` (`room_waiting_minutes` [PROPOSED] default 15). Host-only start; start needs at least the game's min players (humans plus robots if `games_room_bots_enabled`).
- **Join**: by 6-character code (wrong or 5-character code: "Kod bilik tidak sah." client check; unknown code "Bilik tidak dijumpai."; room full "Bilik sudah penuh." [PROPOSED text]; already started "Permainan sudah dimulakan."). Visible rooms list under "Bilik Terbuka" shows `waiting` rooms with free seats, newest first, max 6 [SRS BR-M16-17]. Only pupils whose Tingkatan fits the room's match mode can join: `same_grade` = same Tingkatan; `same_level` = same school level group (all T1-T5 = any); `custom` range from "grade_min".
- **Robots**: when `games_room_bots_enabled` and the host polls a `waiting` room below min players, one "Robot {n}" is added per poll until min players. Robots answer with accuracy `battle_bot_accuracy_pct` (60%) after a random 2-12 s. Robots never create standings, wins, leaderboards, badges or league points.
- **Absent player**: no poll for `games_absent_seconds` (30): auto-timeout of their turn/answer; after 3 consecutive auto-timeouts they are removed (their seat becomes a robot if enabled); if only one human remains the game ends, remaining human wins by default (win XP).
- **Leave early**: "Keluar" = forfeit for that player (0 XP); in `waiting` simply leaves; host leaving `waiting` closes the room.
- **Reward**: GAME-00 formula. Standing updates (wins, jumlah, betul, skor) only for humans vs at least one other human; matches with robots update nobody's standing (the code gives standings only to the acting human [CODE settlement.ts:83-87]; this is the honest version).
- **Answer store**: GAME-00 for each answered bank question.
- **Errors** [CODE GAMES_MESSAGES common.ts:115-169]: "Hanya hos boleh memulakan permainan.", "Permainan sudah dimulakan.", "Pemain belum mencukupi.", "Soalan tidak mencukupi.", "Bukan giliran anda.", "Bukan giliran anda untuk gulung dadu.", "Soalan tidak sah.", "Pilihan tidak sah.", "Masa tidak sah.", "Tindakan tidak sah.", "Soalan tidak sepadan.", "Jawapan tidak sah.", "Permainan belum bermula.", "Tiada soalan untuk dijawab.", "Tiada jam untuk permainan ini.", "Permainan tidak dijumpai.", "Bilik tidak dijumpai.", "Tahap soalan tidak sah.", "Julat tahap tidak sah.", "Bilangan pemain tidak sah.".
- **Polling**: client polls `GET /api/games/:game/rooms/:code` every 3 s (existing); server advances clocks when polled (`runClocks`).

#### GAME-02 Papan Bijak (ular & tangga, 2-6 players)
| Rule | PRD | Code | V2 | Proposed |
|---|---|---|---|---|
| Board | PARTIAL (admin only: 50 tiles, `Bilangan Petak Soalan`, breakdown 35 quiz / 6 ladders+snakes / 4 bonus+trap / 3 plain / 2 start+end) | 50 tiles; ladders 3, snakes 3, bonus 2, traps 2; `BOARD_STEP` 3 [CODE engine/constants.ts:4-8] | admin page | as code |
| Turn | MISSING | dice 1-6; turn order = join order; no question timer | n/a | below |
| Scoring | MISSING | `correct x 10 + 50` for the winner [CODE engine.ts:377] | n/a | below |

Game spec GAME-02: pool 40 questions drawn at start (no repeats; if all 40 are used the pool restarts reshuffled). Turn order = seat order. A turn: pupil taps "Gulung Dadu" within 30 s (else auto-roll); dice 1-6; move forward; tile at 50 or beyond = finish (win). Landing effects: ladder tile -> jump up to its target (tile + 5..15, never above 49); snake tile -> slide to target (tile minus 5..15, never below 2) [CODE engine.ts:197]; `bonus` -> +3 tiles; `trap` -> -3 tiles (not below 1); `quiz` tile -> question with 20 s timer: correct = stay and +1 correct; wrong or timeout = return to the tile held before the roll. A bonus/trap/ladder/snake target never triggers another effect. Winner = first to reach tile 50. Papan Bijak points per player = `10 x correct` + 50 if winner [CODE]. Standing row: menang, jumlah, betul, skor; Top 10 order: menang desc, skor desc, jumlah asc, user id asc; "Kadar" = round(menang/jumlah x 100); pill green >= 70, amber 40-69, red < 40 [SRS BR-M16-22]. Safety: if nobody reaches 50 after 200 rounds, highest tile wins, ties draw. Admin: `boardgame_quiz_tiles` 0-38 (hint "Maks 38 petak (48 available - 10 petak khas). Set 0 = tiada soalan.").

#### GAME-03 Perang Fakta
Game spec: 2-6 players, 15 rounds, `POOL_SIZE` 15 [CODE constants.ts:10-14]. Each round shows a statement made from one MCQ (the true statement uses the correct option text, the false one a wrong option) and 2 buttons "Betul" / "Salah" within 10 s (`PF_ROUND_MS`). Correct vote +1 point; wrong or timeout 0 (no negative marks). After all 15 rounds the highest points wins; equal top points = draw. Simultaneous rounds: round ends when everyone voted or 10 s passed. Answer store: one row per vote (the question is the source MCQ; correctness is the vote vs truth).

#### GAME-04 Benteng Ilmu (1v1)
Game spec: pool 30; both players start with 100 HP; each round one question, 15 s. A correct answer hits the opponent for 20 HP; a wrong or timeout answer costs the player 20 HP [CODE engine.ts:467-502]; both are resolved at round end. +10 points per correct. First player at 0 HP or below loses; both at 0 in the same round: higher points wins, equal = draw. If the 30 questions run out: higher HP wins, then points, then draw. Reward: win vs play via GAME-00 (not the old 35/8 coin constants).

#### GAME-05 Perlumbaan Matematik (2-4, subject Matematik)
Game spec: track of 20 steps; each player gets own questions (pool 40, no repeats per player), 20 s each; correct = +1 step, wrong/timeout = stay. First to 20 steps wins; two reach 20 in the same server second: earlier timestamp wins, still equal = draw. If all 40 are used first: most steps wins, equal = draw. Rank = 1 + players with more steps [CODE settlement.ts:105]. Subject fixed to Matematik; the lobby offers only Tingkatan.

#### GAME-06 Kuiz Relay (teams, 4-8)
Game spec: seats alternate into Team 1 and Team 2 [CODE engine.ts:148]; 10 rounds; round r is answered by seat `((r-1) mod players)+1`, 15 s; correct = `10 + max(0, 10 - seconds)` team points, wrong 0. Higher team total wins; equal totals = draw and no MVP (the code gives ties to Team 1: fixed). MVP = highest personal points on the winning team, tie by lowest user id; MVP gets the standing win. Everyone on the winning team gets `game_win_xp`.

#### GAME-07 Teka Silang Kata (1v1)
Game spec: 8 words from questions whose correct option text is 1-20 characters; whole game 300 s (`CROSSWORD_MS`); one attempt per word in order; answer compared after trim, whitespace collapse and lower-case; correct +1. Ends after word 8 or at 300 s; highest words wins; equal = draw.

---------------------------------------------------------------------------------------------------

### GAME-08..12 Solo mini-games (`/games/solo/:game`)
PRD: not named. Code has full rules [CODE solo.rules.ts, solo-lib.ts, pages]. Server computes the score from stored checks in order [CODE solo.rules.ts:74-110]; client timers only.

Common spec: no entry cost, unlimited plays; max 30 starts per minute (rate limit); items drawn without repeats; points shown as personal score; personal best per game kept; rewards by GAME-00 (not the old coin formulas). The server accepts checks only within `duration + 10 s` of session start; later checks are refused with "Masa sudah tamat.". Result titles are [CODE solo-lib.ts:54-82].

| ID | Game | Items | Clock/lives | Score per correct | Reset rule | Result title thresholds |
|---|---|---|---|---|---|---|
| GAME-08 | Betul atau Salah | 40 | 45 s total | `10 + min(streak,10) x 2` | wrong answer resets streak to 0 | >= 300 "🏆 LEGENDA!", >= 150 "🔥 LUAR BIASA!", >= 80 "✅ HEBAT!", else "💪 TERUSKAN!" |
| GAME-09 | Cabaran Kilat | 30 | 60 s total | `10 x min(combo,10)` | wrong resets combo to 0 | >= 500 "🏆 LEGENDA!", >= 300 "🔥 LUAR BIASA!", >= 150 "⚡ PANTAS!", else "💪 TERUSKAN!" |
| GAME-10 | Tembak Jawapan | 30 | 3 lives; tile falls `max(5, 15 - 0.7 x (level-1))` s + 0-2 s; a question with no correct tap by `base + 6 + options x 2` s costs a life; a wrong tap costs a life [CODE page :191-200] | `10 x level`; level = 1 + floor(correct/5) | game over at 0 lives or items done | >= 500 "🏆 SNIPER!", >= 200 "🎯 SHARP!", >= 80 "💪 BAGUS!", else "🔄 CUBA LAGI!" |
| GAME-11 | Susun Jawapan | 20 puzzles (answers <= 20 chars) | whole game 300 s [PROPOSED; no clock in code] | letters `max(5, 2 x tiles)`, words `3 x tiles` | skip allowed, no score | solved/total >= 0.9 "🏆 GENIUS!", >= 0.6 "🧩 BIJAK!", >= 0.3 "💪 BAGUS!", else "📚 TERUSKAN!" |
| GAME-12 | Kad Memori | 6 pairs, 12 cards, 4 x 3 | no clock; mismatch shown 800 ms | none; accuracy `round(6 / moves x 100)` | `moves` counts every flip pair, mismatches included | n/a |

Per game extras:
- GAME-08 answer "Betul"/"Salah" to a statement from an MCQ; each tap is final; hint of unanswered items none.
- GAME-09 MCQ with 4 options; next item after 400 ms.
- GAME-10 4 lanes, options rotated by question id; tile gap 1.8 s.
- GAME-11 letter tiles or word tiles; the built answer is compared trim + lower-case; hints none.
- GAME-12 pairs = question card + answer card; matched pairs stay open; a flipped non-matching pair closes after 800 ms; session ends when 6 pairs are matched. Personal best = fewest moves. Writes `practice_answers` for each matched pair (correct) only.
- Exact messages: "Keputusan tidak sah.", "Keputusan sudah dihantar.", "Sesi tidak dijumpai.", "Soalan tidak dijumpai.", "Soalan sudah dijawab.", "Kad sudah dipadankan.", "Sila padankan kad yang dibuka dahulu.", "Masa sudah tamat." (new).

### GAME-13 Jutawan Ilmu (15 questions, 3 lifelines)
| Rule | PRD | Code | Proposed |
|---|---|---|---|
| Entry | PARTIAL (named once) | subject + Tingkatan (>= 7 in code's numbering) [CODE jutawan.service.ts:54-56,119] | pupil's own Tingkatan or any T1-T5; subject with at least 15 approved text MCQs |
| Selection | MISSING | difficulty ladder Q1-4 = 1, Q5-8 = 2, Q9-12 = 3, Q13-15 = 4 [CODE solo.rules.ts:131]; fill from any difficulty if short | as code |
| Rules | MISSING | one wrong answer ends the game; level reached is the score; 50:1 lifeline "50:50" removes 2 wrong options, 3 lifelines, only one per question [CODE jutawan.service.ts:223-240]; no timer | add 60 s per question [PROPOSED `jutawan_question_seconds`]; timeout = wrong |

Game spec GAME-13: level = number of correct answers (0-15). Wrong/timeout ends the game with the level reached (no safe checkpoints; fair for minors, no loss of earned syiling because there is none at stake). Result: "Anda mencapai Tahap {level} daripada 15." Rewards: GAME-00 only (replaces the code ladder 1000/50/0 syiling [CODE solo.rules.ts:133]). `jutawan_level_bonus_syiling` is dropped. Pacing guard 2000 ms per answer. Personal best = highest level. Messages [CODE GAMES_MESSAGES]: "Permainan sudah tamat.", "Bantuan tidak sah.", "Tiada bantuan tersedia.", "Soalan tidak sepadan.", "Pilihan tidak sah.".

### GAME-14 Roda Nasib (daily spin)
Audit: PRD MISSING in all checks; code [CODE spin.rules.ts:11-20, spin.service.ts]: one spin per MYT day (unique `(user_id, spin_date)`), 8 segments with weights 25/20/15/8/3/15/10/4 totalling 100: "1 Syiling" 25, "3 Syiling" 20, "5 Syiling" 15, "10 Syiling" 8, "20 Syiling" 3, "Cuba Lagi" 15, "2 Syiling" 10, "7 Syiling" 4. Credited only when `games_award_syiling`=1; error "Anda sudah spin hari ini."
Game spec GAME-14: free, one spin per pupil per MYT day, any T1-T5 pupil. The server draws with a secure random number, stores the segment, then returns it; refreshing never redraws. Segment values and weights are admin rows (`spin_segments`, sum of weights = 100, 8 rows) with these defaults. Expected value = 0.25x1+0.20x3+0.15x5+0.08x10+0.03x20+0.10x2+0.04x7 = 3.48 syiling. When `games_award_syiling`=0 the wheel still spins but shows "Syiling tidak diberikan buat masa ini." and credits nothing and does not count toward `games_daily_syiling_cap`. Idempotency key `spin:<MYT date>`. Writes no `practice_answers`. Messages: "Anda sudah spin hari ini.", result "Anda dapat {label}!" and for "Cuba Lagi" "Cuba lagi esok!". API-GAME-02 exists. Because the wheel pays only syiling, the Roda Nasib card is hidden from the hub while `games_award_syiling`=0 (the V2 default), so no useless game is shown [PROPOSED].

### Unspecified routes "Pertandingan" and "Uji Minda" (`/games/pertandingan`, `/games/uji-minda` in API-GAME-02)
[MISSING-NO-SOURCE] PRD, V2 captures and code comments give no rules. Proposal: not shown in the hub in R1 (FR-MUR-21-1: no playable spec = hidden); keep routes returning 404 until specified.

---------------------------------------------------------------------------------------------------

### GAME-15 Liga and Tournament (`/tournament`, `/liga`, admin P2-14)

| Rule | PRD | Code today | V2 | Proposed |
|---|---|---|---|---|
| Entry | PARTIAL ("Sertai" joins once, not after close) | school joins by invite code; "Anda perlu mempunyai sekolah untuk menyertai liga ini." [CODE leagues.service.ts:185-198] | none (redirect) | D-GAME-3 |
| Scoring | MISSING | `total_score`, `avg_accuracy`, `wins` enum; standings stored, never recomputed | n/a | below |
| Formats | MISSING | `single_match`, `knockout`, `league`, `hybrid`; groups 2..8; create/list only [CODE battle/schema.ts:101] | n/a | D-GAME-4 |

Game spec GAME-15:
- **Liga** (type `league`/`friendly`, scope school/district/state/national, mode `mixed`/`quiz`/`multiplayer`, scoring `total_score`/`avg_accuracy`/`wins`, optional subject, class levels T1-T5, max schools 2-500, start/end date, invite code 6 chars A-Z0-9). Status `upcoming` (before start date) -> `active` -> `ended` (after end date, MYT end of day). A school joins once through its school admin or any teacher of the school with the code before it ends and while schools < max: errors "Kod jemputan tidak sah.", "Liga ini sudah tamat.", "Anda perlu mempunyai sekolah untuk menyertai liga ini.", "Sekolah anda sudah menyertai liga ini.", "Liga ini sudah penuh.", "Liga tidak dijumpai.", "Tarikh tamat mesti selepas tarikh mula.", "Had sekolah mesti antara 2 dan 500.", "Mata pelajaran tidak sah.", "Tingkatan tidak sah." [CODE GAMES_MESSAGES]. Pupils see "Sekolah anda menyertai liga ini" and their own contribution; no pupil taps "Sertai" (resolves AC-MUR-23-1: the AC becomes "the pupil appears in the school's contributors list").
- **Points** counted between start date 00:00 and end date 23:59:59 MYT from Tingkatan-level pupils of the school whose class level is in the league's levels: `quiz` mode = 1 point per correct answer in `practice_answers` with mode `latih_tubi`, `chapter`, `databank`, `game` and subject filter if set; `multiplayer` mode = `round(Battle score / 100)` per real (non-robot) Battle; `mixed` = both. Scoring: `total_score` = sum of points; `avg_accuracy` = correct / answered x 100 over quiz answers, 1 decimal, school needs at least 30 answers to be ranked; `wins` = number of won real Battles (quiz mode contributes 0).
- **Standing order** (per class-level tab): score desc, participants (distinct pupils with points) desc, school name asc. Recomputed every hour at minute 00 (MYT) while active and once at the end (final, frozen). "peserta", "skor" (1 decimal), "purata %" shown [SRS BR-M16-34].
- **Tournament** (admin-created, pupils or schools register; scope per admin form: level tingkatan4/tingkatan5/spm, question mode subject / exam_paper / random_mix). R1 formats `single_match` and `league`. Status `draft` -> `registration` -> `ongoing` -> `completed`; registration closes at `registration_closes_at` (must be after open date: "Tarikh tutup mesti selepas tarikh buka."), then `ongoing` at the first round start. A tournament is a series of R rounds (`single_match` R=1; `league` R=3, admin 1-10). Each round is an asynchronous same-paper quiz: 10 questions, 15 s each (Battle rules), open for 24 hours from the round start; each registered pupil plays once; round score = Battle points; the pupil who does not play scores 0. Final ranking: total score desc, accuracy desc, fastest total time asc, user id asc. Winners = top 3 (podium). The shell banner shows a tournament in `registration` or `ongoing` (existing `GET /tournament/active`). Errors [CODE BATTLE_MESSAGES]: "Tournament tidak dijumpai.", "Tajuk tournament diperlukan.", "Sila pilih tahap pendidikan.", "Format tidak sah.", "Sila pilih sumber soalan.".
- **API/DM**: API-GAME-05 + new `POST /api/tournaments/:uuid/register`, `POST /api/tournaments/:uuid/rounds/:n/start`, `GET /api/tournaments/:uuid/standings`; admin API-ADM-17 add `PUT /api/tournaments/:uuid`, `POST .../open`, `POST .../close`. DM-46 `tournament_rounds`, `tournament_entries`, `tournament_round_scores`; DM-47 `league_standings_recompute_at`.

---------------------------------------------------------------------------------------------------

### GAME-16 Papan Pendahulu, Kedudukan, Ranking Pelajar/Sekolah Battle, Sekolah Bersaing

| Rule | PRD | Code | V2 | Proposed |
|---|---|---|---|---|
| Scope | COMPLETE (Kelas, Sekolah tabs; Kedudukan cards Dalam sekolah/negeri/Kebangsaan + class) | `GET /api/gamification/leaderboard` ignores scope and period [CODE API-GAME-06] | observed | as PRD |
| Period | PARTIAL ("Semua Masa", "Minggu Ini", "Bulan Ini", reset time missing) | n/a | observed | week Mon 00:00 MYT, month calendar MYT, no daily/term board |
| Basis | PARTIAL (contradiction) | lifetime earned, then wallet created, then user id [SRS BR-M14-17] | "Kedudukan dikira berdasarkan baki syiling." | Kedudukan and "Semua Masa": balance `current_syiling` (V2 text); "Minggu Ini"/"Bulan Ini": sum of positive earn rows in the window. Spending lowers Kedudukan rank by design (V2 text). Recorded as a known V2 behaviour |
| Tie-break | MISSING ("ties by name" in FR-MUR-33-2) | see basis | n/a | coins desc, accuracy desc, longest streak desc, display name asc, user id asc |
| Shown to others | COMPLETE (first name only, 4.3) | | | as PRD |

Game spec GAME-16: top 10 shown plus podium (ranks 1-3) plus the viewer's own rank row at any depth (AC-MUR-33-2). Percentile "Kumpulan {p}% teratas" with p = round(rank / total x 100). Rank = 1 + number of pupils with a strictly better sort key (competition ranking); equal keys through the tie-break above always give distinct positions. A pupil with no school sees only applicable scopes and "Kedudukan belum tersedia" / "Akaun anda belum dikaitkan dengan sekolah atau kelas.". Boards refresh on request (no cache older than 60 s). Test accounts (Mod Pelajar) and inactive pupils excluded. Empty board "Belum ada pelajar dalam {kelas|sekolah} anda". Sekolah Bersaing: live ranking, schools with >= `sekolah_bersaing_min_pupils` pupils with sessions, top `sekolah_bersaing_top_n` (30), order: average session accuracy desc, pupils desc, total sessions desc, school name asc. API-GAME-06 gets `scope`, `period` query and `me`; DM none new.

---------------------------------------------------------------------------------------------------

### GAME-17 Syiling, XP, Level, Tier, Streak (Kombo), daily login

| Rule | PRD | Code | V2 | Proposed |
|---|---|---|---|---|
| Syiling per correct | COMPLETE (4.4 table: rate x correct; Bijak rate x marks; games per setting) | `flat_quiz_reward`, missions constant 3 | value 1 | as PRD; delete mission constant (already in PRD) |
| XP, level | COMPLETE (10/correct; level = floor(XP/1000)+1) | | "Mata (Lvl 1)" | as PRD |
| Streak | PARTIAL (first activity 1; same day unchanged; next day +1; gap resets to 1) | qualifying event = completed session of any mode or student password login; future `at` > 5 min refused; never moves backward [CODE streak.service.ts:45-58] | "🔥 {n} Streak", "Kombo" | add: qualifying event list; reset = no qualifying event on the MYT calendar day after the last one; a game session (GAME-00) does NOT count (only practice and Bijak sessions and login) [PROPOSED to stop game farming]; no multiplier (always 1.0x) |
| Daily login | MISSING | +2 syiling first student password login of MYT day [CODE gamification.constants.ts:71] | ledger text "Streak activity (daily_login)" [SRS] | setting `daily_login_syiling` 2; source `daily_login`; description "Streak activity (daily_login)" |
| SPM streak row | MISSING | not coded | +7 "Streak activity (spm)" [SRS] | setting `spm_first_session_syiling` 7, owner Bijak lane |
| Tier | PARTIAL (table 0/500/2000/5000 and FR-MUR-28-2 "lifetime syiling") | compares `current_syiling` [SRS BR-M14-08] | "0+ syiling sepanjang hayat" | tier = highest active tier with `min_syiling` <= lifetime `total_syiling_earned`; upgrade only, never demoted; deactivated tier skipped |
| Titles | MISSING | Permulaan 0, Pelajar 300, Master 2000, Grandmaster 3500, Legenda 5000, Mitos 10000 [CODE wallet.constants.ts:13-20] | observed 2 | keep; "Perlu {n} syiling lagi untuk gelaran ini" |
| Tier per-level rewards | MISSING | tier fields `quiz_reward_l1..l5`, PKSK 5, Papan Bijak 25 exist but `flat_quiz_reward` > 0 overrides them [SRS BR-M14-03] | Tier Config shows l1..l5 = 1..5, PKSK 5 | stay inert while `flat_quiz_reward` > 0; P2-02 must show them read-only with the note "Tidak digunakan selagi Syiling flat > 0." |

Game spec GAME-17 (beyond PRD 4.4): Wallet movement order in one completion: streak touch, then wallet credit, then challenges, then achievements (lock order streak -> wallet [CODE wallet.constants.ts:31]). All credits idempotent by `(user, source, source_id)`. No negative balance. Ledger types: `earn`, `bonus`, `refund` (credit), `spend`, `convert` (debit). Max 100,000 per single movement [CODE]. Messages: "Baki syiling tidak mencukupi.", "Baki token tidak mencukupi.", Mod Pelajar "Tidak dibenarkan dalam Mod Pelajar.". Tier up notification (in-app): "Tahniah! Anda naik ke tier {label}."

### GAME-18 Tukar Token
PRD COMPLETE for rates (50/40/30/20 by tier, `floor(N/rate)`). Missing and proposed:
- Convertible amount: multiples of the tier rate; tokens = N / rate; the amount debited = tokens x rate (the remainder is never taken; the code's SRS debits all N: fixed). Buttons 50, 250, "Semua" (= largest multiple of the rate <= balance). Below one token: observed V2 text "Anda perlu sekurang-kurangnya 50 syiling" / "untuk menukar 1 token. Teruskan berlatih untuk mengumpul syiling." with {rate} in place of 50.
- Tier used = tier at the time of the click. Tier does not change. Lifetime syiling unchanged.
- Daily limit: none. Idempotency: header `Idempotency-Key` (pattern `^[A-Za-z0-9_.:-]{1,100}$`) [CODE]; double click converts once.
- Messages: success "Berjaya menukar {s} syiling kepada {t} token." [PROPOSED]; short "Baki syiling tidak mencukupi."; no rate set "Kadar penukaran belum ditetapkan" / "Pentadbir belum menetapkan kadar tukaran syiling → token."; history empty "Belum ada penukaran."; row text "Tukar {s} syiling → {t} token" [SRS].
- Admin tier edit applies from the next conversion; past conversions are not recalculated (FR-ADM-P2-02.4).

### GAME-19 Cabaran Harian
| Rule | PRD | Code | Proposed |
|---|---|---|---|
| Reset | COMPLETE (midnight MYT) | per MYT day | as PRD |
| Progress | PARTIAL (shared definition) | metrics `sessions`, `correct`, `best_accuracy`, `best_correct_in_session`, `chapters`, `minutes`, `streak` [SRS BR-M14-12] | as code; accuracy metric needs a session of >= `challenge_accuracy_min_questions` (5) |
| Reward | PARTIAL | auto-credit on session completion [SRS BR-M14-13], no claim | claim, below |

Game spec GAME-19: each active challenge has type, target, `reward_syiling`, `reward_xp`, difficulty (Mudah/Sederhana/Sukar; DB easy/medium/hard). State per pupil per MYT day: `belum_selesai` -> `sedia_dituntut` (progress >= target) -> `dituntut`. New `POST /api/gamification/challenges/:id/claim` (API-GAME-07 addition): checks completed, not already claimed today, then credits `reward_syiling` syiling + `reward_xp` XP once (unique `(user_id, challenge_id, myt_date)` in DM-48 `challenge_claims`). Counter "{claimed} / {total} ganjaran dituntut". Progress is capped at target; the completion row is created at claim. A challenge deactivated after completion can still be claimed that day. Messages: "Ganjaran dituntut: +{n} syiling, +{m} mata." / "Cabaran belum selesai." / "Ganjaran sudah dituntut." / empty "Tiada cabaran aktif" / "Cabaran harian belum dibuka. Semak semula kemudian.". The 10 coded challenges and the 15 observed in V2 are admin data (list in 10-murid lines 1144-1146); not tuned.

### GAME-20 Misi Harian (teacher-set)
PRD: FR-GUR-2b-1..4, 4.4 N-2 rule, API-GAME `GET /api/missions/today`, API-GUR-11. Missing and proposed:
- A mission is valid on its `date` only (MYT 00:00-23:59:59), assigned to one class or all classes of the teacher; a pupil sees missions of own classes plus "Global" missions.
- Progress = number of correct answers by the pupil on that date in mission-mode sessions (mode `mission`) up to `targetQuestions`. Reward `rewardCoins` paid once at the moment progress reaches the target, idempotent `(pupil, mission)`, ledger "Misi Harian: {title}". Per-answer syiling follows the admin rate (default 1) as in every mode.
- `rewardCoins` range 0-`mission_reward_max` (100) [PROPOSED; the contract's 0-10000 allows a teacher to mint 10,000 syiling per pupil per mission]; `targetQuestions` 1-1000 [CODE]; at most 5 missions per teacher per day [PROPOSED]. Expired mission: not listed, progress frozen.
- Messages: create "Misi dicipta." [PROPOSED in PRD]; reached "Misi selesai! +{n} syiling."; error "Ganjaran misi melebihi had." for `rewardCoins` above the setting. Answers: mode `mission` into `practice_answers` (already a session mode). Delete keeps paid rewards (FR-GUR-2b-3).

### GAME-21 Kedai Hadiah (digital and physical) and Tebusan
| Rule | PRD | Code | Proposed |
|---|---|---|---|
| Price/stock | PARTIAL (FR-MUR-31-1/2) | `token_cost`, `stock_quantity` null = unlimited, `max_per_month_per_student` [CODE rewards.ts:128-151] | below |
| Statuses | PARTIAL (Menunggu, Dihantar, Dibatalkan) | + `pending_parent_consent` [CODE rewards.ts:43-48] | D-GAME-5 |
| Budget | PARTIAL (admin P2-09.1) | stored, not enforced [CODE shop.service.ts:74-110] | below |
| Errors | PARTIAL | exact codes with BM text [CODE rewards.ts:79-90] | below |

Game spec GAME-21: Redeem (`POST /api/hadiah/redemptions {rewardId}`): in one transaction, in this order: (1) gift active; (2) stock > 0 (null = unlimited): decrement; (3) monthly cap per pupil per MYT month; (4) session budget: sum of `cost_value_sen` of this pupil's non-cancelled non-digital redemptions in `current_session_year` plus this gift <= `reward_budget_sen_session`; digital gifts cost 0 sen and never consume budget; (5) token balance >= `token_cost`; (6) debit tokens (ledger source `hadiah_redeem`, refId `redemption:<id>`), create the redemption `pending_admin`. Any failure rolls back everything. Double click creates one redemption (Idempotency-Key or unique pupil+gift within 10 s [PROPOSED]). Pupil statuses: "Menunggu" (`pending_admin`), "Dihantar" (`delivered`, shows the code the admin pasted and the expiry `delivered_at + voucher_validity_days`, default 365; telco gifts 30), "Dibatalkan" (`cancelled`, "Token dikembalikan."). Admin cancel: refunds tokens once (`hadiah_refund`), restores reserved stock, pupil in-app notice "Tebusan anda dibatalkan. {n} token dikembalikan." Admin delivery needs the voucher code (1-100 chars). A cancelled redemption does not count toward the monthly cap or budget. A pupil cannot cancel. Physical gifts (types voucher/physical/experience/subscription in `syiling_rewards`, priced in syiling) follow the same pattern with syiling instead of tokens; physical delivery is handled by the school/admin outside the app, status words identical. D-GAME-5: R1 sets `requires_parent_consent=false` on every seeded gift and hides the field; `pending_parent_consent` is not produced. Messages (exact, from code): "Stok hadiah telah habis.", "Had tebusan bulanan dicapai.", "Token tidak mencukupi.", "Hadiah tidak dijumpai.", "Tebusan tidak dijumpai.", "Tebusan ini tidak lagi menunggu pemprosesan."; new "Had tebusan sesi ini telah dicapai." for budget; card footer "Perlu {n} token lagi" [V2]; empty "Tiada Hadiah Tersedia" / "Katalog hadiah belum dibuka untuk kategori ini." and "Anda belum menebus sebarang hadiah.". Kedai Hadiah Digital (`/cikgu/hadiah`) is the same catalogue and wallet (FD-MUR-33).

### GAME-22 Cabutan Bertuah
Game spec GAME-22: draw states `draft` -> `open` -> `closed` -> `drawn` (existing `draft/open/closed`; `drawn` = `winner` rows exist). A draw has title, description, ticket price in syiling (>= 1), max tickets per pupil (default 10), `closes_at` (MYT date; open through 23:59:59 MYT of that day [CODE rewards.ts:404]), prizes (label, quantity >= 1, value). Buy ticket: draw `open` and not past `closes_at` ("Cabutan ditutup."), tickets owned < max ("Had tiket dicapai."), balance >= price ("Baki syiling tidak mencukupi."); debit syiling with its own key `draw:<id>:ticket:<ticket id>` [CODE shop.service.ts:200]; each ticket is one entry. Admin "Tutup" closes sales; "Cabut pemenang": for each prize slot in position order pick one winner uniformly at random among tickets with a server cryptographic random generator, removing all tickets of a winner after they win (a pupil wins at most one prize per draw); record winner, ticket id, slot, time, admin id (`draw_winners` DM-36; unique `(draw_prize_id, slot)`); winners notified in-app "Tahniah! Anda memenangi {prize} dalam {title}."; the page shows to others the winner display name only; own win "Anda menang!". If tickets < prizes, fewer winners; no tickets: "Tiada peserta" and the draw stays `closed`. Cancel a draw before drawing: all tickets refunded once (`cabutan_refund`) and the draw `cancelled` [PROPOSED]. Prizes are handed over outside the app; admin marks delivered. Tickets are bought only with earned syiling, never money; per-pupil cap and the two daily limits above keep it from being a pressure mechanic. Audit log on every admin action. Empty "Tiada cabutan dibuka buat masa ini. Nanti datang lagi! 🎈". Detail messages as GAME-21 style. API: API-GAME-09 draws/close/winners; DM-36.

### GAME-23 Kotak Misteri
Audit: PRD price/odds/disclaimer COMPLETE [V2 + FR-MUR-35-1]; engine details MISSING.
Game spec GAME-23: one box, cost `mystery_box_cost` = 50 syiling. Prize table (weights are integer percent, sum 100, admin editable, stored in `mystery_boxes` + `mystery_box_prizes`, DM-37):
| Prize | Weight |
|---|---|
| 10 syiling | 40 |
| 25 syiling | 25 |
| 60 syiling | 15 |
| 1 token | 10 |
| 150 syiling | 6 |
| 3 token | 3 |
| 500 syiling (jackpot) | 1 |
Open: in one transaction check balance >= 50 and daily limit (`mystery_box_daily_max` 5 per MYT day), debit 50 (`mystery_box`), draw once with a secure random number against the cumulative weights (the draw happens on the server before the response; refresh never redraws; Idempotency-Key per click), credit the prize (syiling `earn` "Kotak Misteri: {prize}" or tokens `creditTokens`), record in history (last 10). No XP. Optional `stock` per prize: an exhausted prize is removed and the others renormalised at draw time. Expected value is about 42.75 syiling (token valued at 50) < 50, consistent with the disclaimer "Purata ganjaran lebih rendah daripada kos kotak — main untuk keseronokan, bukan untuk mengumpul syiling." Messages: short "Anda perlu {n} syiling lagi untuk membuka kotak." with button "Kumpul syiling"; "Baki syiling tidak mencukupi."; daily "Had kotak hari ini telah dicapai. Cuba lagi esok."; result "Tahniah! Anda dapat {prize}."; history empty "Anda belum membuka sebarang kotak.". Admin: weights must total 100 else "Jumlah peluang mesti 100%." Mod Pelajar refused. AC-MUR-35-2 harness unchanged. Replace the four token boxes in `shop.constants.ts`.

### GAME-24 Rujuk Kawan
Game spec GAME-24: code 8 characters A-Z0-9, unique, stable per pupil, created on first view (V2: 8; SRS: 7; follow V2). Link `…/daftar?rujuk={code}`. Reward: when a new student account registers with a valid school registration code AND a referral code of another existing pupil, the referrer gets `referral_referrer_syiling` (100) once per friend (unique referee id); the friend gets `referral_referee_syiling` (0 by default; V2 is silent). Cap `referral_max_rewarded` 20 rewarded friends per referrer; beyond that "Had rujukan dicapai." and no reward. Self-referral, same-account, a referee that already has a referrer, and a referrer who is a test account earn nothing. Not paid for teacher/parent registrations. Counters "Kawan disertakan", "Syiling bonus"; list shows only a count and total, never names (FR-MUR-36-4). Ledger "Rujukan kawan berjaya", source `referral`; idempotent by referee id. Badge "Sahabat Belajar" counts rewarded referrals. Messages: copy "Disalin"; empty "Belum ada kawan mendaftar melalui pautan anda. Kongsi pautan di atas untuk mula."; invalid code at registration "Kod rujukan tidak sah." and registration still succeeds. Admin screen P2-06 fields: `referral_referrer_syiling`, `referral_referee_syiling`, `referral_max_rewarded`.

### GAME-25 Pencapaian (badges)
PRD: 3 observed badges and "25 in V3". Full list from the seed [CODE prisma/seed/gamification-data.ts:23-47]; evaluation [CODE gamification.service.ts:572-639]. Evaluated after each completed practice session; propose also after: Battle end, Mystery box open, referral reward, challenge claim, daily login. Unlocked once; reward paid by the call that inserts the unlock (unique `(user, achievement)`), ledger "Pencapaian: {name}", source `achievement`; teachers and admins unlock nothing.

| # | Name | Condition (BM) | Rule | Rarity | Syiling | XP |
|---|---|---|---|---|---|---|
| 1 | Langkah Pertama | Jawab kuiz pertama anda | 1 completed practice session | Biasa | 5 | 3 |
| 2 | Pelajar Rajin | Jawab 10 kuiz | 10 sessions | Biasa | 15 | 10 |
| 3 | Streak 3 Hari | Login 3 hari berturut-turut | streak >= 3 | Biasa | 10 | 5 |
| 4 | Cendiakawan | Jawab 50 kuiz | 50 sessions | Jarang | 50 | 30 |
| 5 | Pengumpul Syiling | Kumpul 100 syiling pertama anda | lifetime >= 100 | Biasa | 10 | 5 |
| 6 | Tepat Sasaran | Capai 90% ketepatan dalam 10 kuiz | 10 sessions with accuracy >= 90% and >= 5 questions | Jarang | 40 | 25 |
| 7 | Penjelajah | Cuba latihan dari 5 subjek berbeza | answers in 5 distinct subjects | Biasa | 15 | 10 |
| 8 | Streak 7 Hari | Login 7 hari berturut-turut | streak >= 7 | Jarang | 30 | 15 |
| 9 | Pelajar Awal | Log masuk 7 hari berturut-turut | streak >= 7 (duplicate of #8; keep both, as seeded) | Biasa | 20 | 10 |
| 10 | Pakar Matematik | Jawab 200 kuiz | 200 sessions (name does not match the condition; seed as is, flagged for admin) | Epik | 150 | 75 |
| 11 | Streak 30 Hari | Login 30 hari berturut-turut | streak >= 30 | Epik | 100 | 50 |
| 12 | Legenda JomBelajar | Jawab 500 kuiz | 500 sessions | Legenda | 500 | 200 |
| 13 | Ahli Kotak Misteri | Buka 10 kotak misteri | 10 openings | Jarang | 30 | 20 |
| 14 | Streak 100 Hari | Login 100 hari berturut-turut | streak >= 100 | Legenda | 300 | 150 |
| 15 | Cabaran Selesai | Selesaikan 20 cabaran harian | 20 claims | Jarang | 35 | 25 |
| 16 | Tokoh Matematik | Jawab 100 soalan Matematik dengan betul | 100 correct Matematik answers | Jarang | 40 | 30 |
| 17 | Si Pantas | Jawab 50 soalan dalam masa kurang 10 saat setiap satu | 50 correct answers each under 10 s (from `practice_answers` seconds; code returns 0 today, cannot unlock) | Jarang | 35 | 25 |
| 18 | Sahabat Belajar | Jemput 3 rakan menggunakan kod rujukan | 3 rewarded referrals | Jarang | 50 | 30 |
| 19 | Hartawan Syiling | Kumpul 1,000 syiling sepanjang masa | lifetime >= 1000 | Epik | 100 | 75 |
| 20 | Penakluk Cabaran | Selesaikan 100 cabaran harian | 100 claims | Epik | 80 | 60 |
| 21 | Pakar Sains | Jawab 200 soalan Sains dengan betul | 200 correct Sains answers | Epik | 80 | 60 |
| 22 | Pengumpul Lencana | Kumpul 15 lencana pencapaian | 15 unlocked | Epik | 75 | 50 |
| 23 | Raja Syiling | Kumpul 5,000 syiling sepanjang masa | lifetime >= 5000 | Legenda | 500 | 250 |
| 24 | Ilmuwan Sejati | Jawab 1,000 soalan dengan ketepatan 85%+ | 1000 answers and overall accuracy >= 85% | Legenda | 300 | 200 |
| 25 | Wira JomBelajar | Lengkapkan semua cabaran dalam 30 hari berturut | all active challenges claimed on 30 consecutive MYT days | Legenda | 400 | 300 |
| 26 (V2) | Juara Battle | Menang 10 battle | 10 won real Battles (robot battles excluded) | Jarang | 30 | 20 [PROPOSED rewards] | |

Rarity labels Biasa / Jarang / Epik / Legenda. Locked badge label "Belum dibuka"; progress shown only for sessions-based badges (1, 10, 50, 200, 500). Counters: "Kemajuan lencana {n} / {total}" = unlocked / configured. In-app notice on unlock "Lencana baru: {name}!". Achievement syiling are admin data (not the flat rate) and do not count toward `games_daily_syiling_cap`. Admin edits conditions via P2 badge config (cross-ref). Row 26 is the only addition to the 25 and exists because V2 shows it.

---------------------------------------------------------------------------------------------------

## 5. Merge instructions for the PRD owner

1. Add GAME-00..25 as `10-murid.md` section 3C ("Game and gamification rules") and link each from R1-MUR-21/22/23/28..36 "Functional requirements".
2. Add section 3 as a table "Pengaturan Gamifikasi" to `30-admin-pusat.md` under P2-02/P2-06/P2-09/N-05, with the same keys.
3. Add API-GAME-11..14 (`claim`, tournaments register/round/standings, leaderboard `scope`/`period`, `challenge claim`) to `60-api-contract.md` and DM-45..48 to `50-data-model-erd.md`.
4. Replace the constants listed in section 1 with settings; delete `MISSION_COINS_PER_CORRECT`.
5. Change AC-MUR-23-1 (pupil joins) to D-GAME-3; change AC-MUR-21-6 to include the answer store for all 13 games; add AC per game from the numbers above (e.g. Betul atau Salah: with 4 correct in a row score = 12+14+16+18 = 60 points).
6. Questions for the user: D-GAME-1 to D-GAME-6 above.
