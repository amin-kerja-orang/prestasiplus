# M16 — Element inventory & link crawl: summary

- **Captured:** 2026-09-26 from live https://prestasiplus.my, read-only, admin session on browser lane 3 (`playwright3`). Credentials are not stored.
- **Safety guard:** before any capture, the logged-in browser context got a Playwright route that **aborts every non-GET/HEAD request to prestasiplus.my**. It was verified with a POST probe ("Failed to fetch"). The guard was needed because four game pages auto-start on load and POST their result when the timer ends. No room, match, queue, invite, spin, league, tournament or settings request was ever sent.
- **Method:** the standard pipeline: `tools/inventory.js` → `tools/run-state.js` → `tools/split-batch.js` → `tools/merge-inventory.js` → `tools/diff-narrative.js`.
  - Capture plan: `tools/jobs/M16.js`, 189 UI states over 30 screens in groups A–K.
    - Group K is a top-up after reconciliation: S28 `?week=` states.
    - The S28 `query-ignored` raw state label was corrected in place, because the query turned out not to be ignored.
  - Screen map: `tools/jobs/M16.screens.json`, with `extraModuleRules` for the crawled sub-routes.
  - Post-merge helper: `tools/jobs/M16-payload.js` (§3).
  - IDs were kept stable across the top-up re-merge with `tools/jobs/M11-idpin.js`: S28 kept 58 ids and added 10; no other file changed.
  - Seed snapshot: `tools/jobs/M16-snapshot.js` → `_snapshot-2026-09-26.json`, built from one GET pass of 45 pages (04:39:15–04:39:42 UTC).
  - Responsive measurements: `tools/jobs/M16-measure.js` (27 URLs × 375 / 768 / 1280). The output was kept in a temporary folder; the results are in narrative §8.1.
  - Masked screenshots: `tools/shoot.js` with `tools/jobs/M16.shots.js` (86 PNGs in `docs/discovery/img/M16/`).
  - **No shared tool was modified.** The repo's `package.json` has `"type": "module"`, so the CommonJS tools ran from `.cjs` copies in the agent's scratchpad (`<scratchpad>/m16/tools/`). The only change in the copies is `merge-inventory` with `ROOT` fixed to the repo path.
- **Privacy:**
  - `M16MASK` (in `tools/jobs/M16.js`) masks student names in five places: lobby Pendahulu lists, the Papan Bijak Top 10 (name and initials), the Pertandingan Mingguan ranking, the school-detail Battle Terkini rows, and the league creator line.
  - It also masks school names (→ `<school>`, including `<title>`), Cloudflare e-mail payloads and avatars.
  - `tools/sanitize.js {selectors:['.m16n'], titleName:false}` runs afterwards on every screen except S1 and S7. On those two it would rewrite the non-personal Alpine literals `selectedSubjectName = '…'` and `autoGradeName = 'Darjah 4'`, and replace those subject names page-wide. They hold no personal data besides the Top 10, which M16MASK covers.
  - `piiLeakCheck` is 0 in every sanitized state.
  - A scripted check compared every M16 file in the repo (inventory, raw captures, snapshot, narrative, job scripts; PNGs excluded) against the 84 student names read from the live pages. **0 hits in M16-owned content.** The only matches (17) were one-word hits in question-bank text: in S13–S17 raw captures and one S17 memory-card data row (for example "Di rumah, {first name} mengasingkan …"). These are fictional or historical names in questions, not personal data.
  - The snapshot tokenises students as `<student:n>` and never stores the name map.
  - The temporary folder that held the unmasked page sources, the name list and the snapshot source was deleted.
- **Files:**
  - `S1-battle.json` … `S30-tournament-banner.json`;
  - layout chrome `SHU-user-shell.json` (S1–S27, S30) and `SHA-admin-shell.json` (S28, S29);
  - `_crawl.json`, `_snapshot-2026-09-26.json`;
  - raw captures `../_raw/M16/*.json` (189).
- **Status legend:** as M01–M15; `normalizeIds` on.
  - Rows were sampled with `opts.repeat`: ranking rows 3, Pendahulu rows 4, school battle rows 2, Top 10 rows 3, Pertandingan rows 4, Sekolah Bersaing rows 2 + the 3 medal rows. Totals are in `meta.repeats`.
  - The full row data is in the snapshot.

## 1. Per-screen counts

M16 content totals **1,571 elements** over 30 screens and **189** captured states (1280 / 768 / 375). The shells add 399 (SHU) and 202 (SHA) chrome elements, which are not M16 content.

| Screen (route) | Total | Visible default | Conditional | Hidden only | Mobile only | Desktop only | States | Data rows |
|---|---|---|---|---|---|---|---|---|
| S1-battle `/battle` | 123 | 28 | 78 | 17 | 0 | 0 | 19 | 0 |
| S2-battle-leaderboard `/battle/leaderboard` | 7 | 4 | 0 | 3 | 0 | 0 | 5 | 0 |
| S3-ranking-sekolah `/battle/ranking-sekolah` | 37 | 10 | 24 | 3 | 0 | 0 | 9 | 0 |
| S4-ranking-sekolah-show `/battle/ranking-sekolah/{id}` | 51 | 27 | 21 | 3 | 0 | 0 | 6 | 0 |
| S5-battle-history `/battle/history` | 7 | 4 | 0 | 3 | 0 | 0 | 3 | 0 |
| S6-permainan `/permainan` | 96 | 93 | 0 | 3 | 0 | 0 | 3 | 0 |
| S7-papan-bijak `/papan-bijak` | 59 | 38 | 14 | 7 | 0 | 0 | 9 | 0 |
| S8-perang-fakta `/perang-fakta` | 37 | 29 | 2 | 6 | 0 | 0 | 5 | 0 |
| S9-benteng-ilmu `/benteng-ilmu` | 37 | 29 | 2 | 6 | 0 | 0 | 5 | 0 |
| S10-perlumbaan-matematik `/perlumbaan-matematik` | 37 | 29 | 2 | 6 | 0 | 0 | 5 | 0 |
| S11-kuiz-relay `/kuiz-relay` | 31 | 23 | 2 | 6 | 0 | 0 | 5 | 0 |
| S12-teka-silang-kata `/teka-silang-kata` | 37 | 29 | 2 | 6 | 0 | 0 | 5 | 0 |
| S13-betul-salah `/permainan/betul-salah` | 65 | 3 | 40 | 22 | 1 | 0 | 8 | 6 |
| S14-cabaran-kilat `/permainan/cabaran-kilat` | 63 | 13 | 28 | 22 | 0 | 0 | 9 | 7 |
| S15-tembak-jawapan `/permainan/tembak-jawapan` | 74 | 4 | 43 | 27 | 0 | 0 | 8 | 7 |
| S16-susun-jawapan `/permainan/susun-jawapan` | 87 | 22 | 30 | 35 | 0 | 0 | 9 | 18 |
| S17-kad-memori `/permainan/kad-memori` | 100 | 24 | 61 | 15 | 11 | 12 | 5 | 59 |
| S18-roda-nasib `/permainan/roda-nasib` | 25 | 7 | 8 | 10 | 0 | 0 | 7 | 0 |
| S19-jutawan `/permainan/jutawan` | 34 | 20 | 11 | 3 | 0 | 0 | 5 | 0 |
| S20-pertandingan `/permainan/pertandingan` | 59 | 55 | 1 | 3 | 0 | 0 | 4 | 0 |
| S21-uji-minda `/permainan/uji-minda` | 16 | 13 | 0 | 3 | 0 | 0 | 3 | 0 |
| S22-sambung-kata `/permainan/sambung-kata` (500) | 9 | 5 | 0 | 4 | 0 | 0 | 2 | 0 |
| S23-tournament `/tournament` | 7 | 4 | 0 | 3 | 0 | 0 | 3 | 0 |
| S24-tournament-create `/tournament/admin/create` | 124 | 54 | 66 | 4 | 0 | 0 | 11 | 0 |
| S25-liga `/liga` | 21 | 7 | 10 | 4 | 0 | 0 | 7 | 0 |
| S26-liga-cipta `/liga/cipta` | 48 | 44 | 0 | 4 | 0 | 0 | 4 | 0 |
| S27-liga-show `/liga/{id}` | 48 | 21 | 22 | 5 | 0 | 0 | 7 | 0 |
| S28-sekolah-bersaing `/sekolah-bersaing` | 68 | 57 | 11 | 0 | 0 | 22 | 8 | 0 |
| S29-admin-permainan `/admin/permainan` | 52 | 50 | 0 | 2 | 0 | 2 | 6 | 0 |
| S30-tournament-banner (every SHU page) | 112 | 94 | 6 | 12 | 0 | 0 | 4 | 0 |
| SHU-user-shell (chrome) | 399 | — | — | — | — | — | 171 | — |
| SHA-admin-shell (chrome) | 202 | — | — | — | — | — | 13 | — |

Notes:
- The 3 hidden-only elements on most SHU screens are the tournament banner's templates ("LIVE:", "MAIN", "DAFTAR"). S30 captures the banner revealed.
- S30 is captured on `/tournament` and `/permainan`, so its total includes those pages' own content.
- S17 "desktop-only" / "mobile-only" are the card grid's random question contents (data rows) seen at one width only.
- S28 "desktop-only" 22 = the "Streak Avg" / "Nota/Pelajar" cells hidden below 768.

**Horizontal page overflow:** flagged in none of the 189 states. Direct measurement confirms page `scrollWidth` ≤ viewport everywhere. Content clipping (S27 liga 2 table at 375) is measured separately in narrative §8.1.

**Empty / error states captured:**
- S2 "Belum ada data ranking. Mula battle untuk muncul di sini!"; S3 "Belum ada data ranking. Mula battle untuk melihat ranking sekolah!";
- S4 "Tiada data minggu ini", "Tiada data bulan ini", "Tiada data pejuang minggu ini", "Tiada battle terkini", and 404;
- S5 "Tiada sejarah battle"; S6 "Tiada bilik terbuka buat masa ini."; S8–S12 flash "Bilik tidak dijumpai."; S21 parent empty state; S22 HTTP 500;
- S23 "Tiada tournament aktif buat masa ini."; S25 "Belum menyertai mana-mana liga"; S27 "Belum ada data papan pendahulu" and 404;
- S28 "📊 Data minggu ini belum dijana. Cron mingguan akan kira pada Isnin pagi. Tunggu kejap ya." and HTTP 500 (`?week=bogus`);
- S1 "Tiada pelajar dijumpai", "Tiada cabaran buat masa ini" and the error banner;
- native `required` bubbles (S7, S24, S25, S26) and the S29 range bubble.

## 2. Link crawl (`_crawl.json`)

314 URLs classified; **128 are M16**:
- the 8 TRACKER routes with every query variant (`period`, `state`, `week`, `darjah`);
- school detail ids; league ids;
- 13 `/api/battle/*` endpoints and `/api/tournament/active`;
- create / join / quick-match / submit / spin actions;
- the 10 Jutawan `main?subject=&darjah=4` links (href only).

The rest are shell links classified to their owning modules. Unknown (6): `/`, `/latih-tubi` (404-page links), `/fcm/token`, `/chatbot/send`, `/chatbot/rate`, `/chatbot/history?session_id=…` — all global shell endpoints.

**New routes (not in TRACKER):**
- Battle: `/battle/ranking-sekolah/{id}`, `/battle/history`, `/battle/arena/{uuid}` (match target; 404 without a match).
- Lobbies: `/papan-bijak` (+ `/{room_code}`, `/create`, `/join`, `/quick-match`, `/quick-match/poll`, `/quick-match/cancel`); `/perang-fakta`, `/benteng-ilmu`, `/perlumbaan-matematik`, `/kuiz-relay`, `/teka-silang-kata` (each + `/{code}`, `/create`, `/join`).
- Single-player games:
  - `/permainan/betul-salah`, `/permainan/cabaran-kilat`, `/permainan/tembak-jawapan`, `/permainan/susun-jawapan`, `/permainan/kad-memori` (each + `/submit`);
  - `/permainan/roda-nasib` (+ `/spin`);
  - `/permainan/jutawan` (+ `/main`);
  - `/permainan/pertandingan`, `/permainan/uji-minda`, `/permainan/sambung-kata` (500).
- Tournaments and leagues: `/tournament/admin/create` (+ POST `/tournament/admin`), `/tournament/{uuid}`, `/liga/cipta`, `/liga/{id}`, `/liga/sertai`.
- APIs: `/api/battle/*`.

**Probed:**
- **404:** `/battle/arena`, `/battle/arena/{fake uuid}`, `/battle/riwayat`, `/battle/ranking-sekolah/99999999`, `/tournament/{fake uuid}`, `/tournament/1`, `/tournament/admin`, `/tournament/create`, `/liga/0`, `/liga/3`–`/6`, `/liga/999`, `/liga/1/edit`, `/admin/permainan/1`, `/admin/battle`, `/admin/tournament`, `/papan-bijak/{unknown}`, `/api/battle/leaderboard`, `/api/battle/stats`.
- **500:** `/liga/sertai` (GET), `/permainan/sambung-kata`, `/sekolah-bersaing?week=bogus`. **405:** `/permainan/roda-nasib/spin` (GET).
- Read-only JSON: `/api/tournament/active` `[]`, `/api/battle/invitations` `{"invitations":[]}`, `/api/battle/search-opponent?q=zzqxv` `{"users":[]}`, `/api/battle/poll-match/0` and `/api/battle/poll-challenger/0` `{"status":"not_found"}`, `/papan-bijak/quick-match/poll` `{"status":"cancelled"}`.

**Owned elsewhere:** `/ranking`, `/leaderboard` → M08; `/gamification/leaderboard` and the wallet → M14; `/peta-belajar` → M03; `/practice` → M05; the parent "Cabaran Uji Minda" → parent portal.

## 3. Reconciliation

- **Payload strings.** The single-player pages embed a random question-bank payload in their Alpine component.
  - `inventory.js` harvested those strings into `jsMessages` (S13 345, S14 648, S15 597, S16 281, S17 64).
  - `tools/jobs/M16-payload.js` moved the payload strings (S13 320, S14 620, S15 573, S16 259, S17 45) into `payloadStrings {count, sources, note}`. A string was kept only if it also occurs in the page sources with the payload arrays removed, so UI literals stay in `jsMessages`.
  - It also marked the rendered payload items as `dataRow` (the current statement / question / options / falling tiles / puzzle tiles / memory cards; S13 6, S14 7, S15 7, S16 18, S17 59).
  - The payload shape is documented in narrative §6.4.
- **Diff result.** `node diff-narrative.cjs inventory/M16 docs/discovery/M16-battle-games.md` → **0 candidates on 28 of 30 screens**.
  - The 2 remaining candidates (S6-058, S30-062) are the same card "🗺️ Peta Pengembaraan … 🌍 Jelajah Dunia 📈 Progress Jelajah".
  - The tool's normaliser strips "🌍" **after** collapsing whitespace, which leaves a double space that no Markdown text can contain.
  - The card and its every part are quoted verbatim in narrative Appendix A.3 row 11 and Appendix B. This is a tool artefact, not a missing string.
- **Appendix B.** Appendix B of the narrative lists every remaining inventoried string verbatim (generated with `tools/jobs/M11-appendix.js`). Appendix B.1 repeats the 19 strings that contain emoji variation selectors in the normalised form that `diff-narrative.js` expects.

**Not in narrative:** (none)

## 4. Read-only limits

- **Not opened (joining or starting would register the account or write data):**
  - the battle arena, match search, invitations and queue join;
  - every game room and quick match;
  - Jutawan `/main`, Roda Nasib spin, all game submits;
  - tournament / league / settings form submits.
- **Revealed through the page's own Alpine state** with placeholder values instead: S1 searching / incoming / waiting / error / invitations; S7 searching / error; game countdown / playing / done / combo / level-up; S16 correct / wrong; S17 complete; S18 spinning / already-spun / prize modals; S30 banner states.
- **Account limits:**
  - admin grade Darjah 4, so the SPM battle type is locked;
  - no active tournament; leagues 1–2 only; admin not a league member;
  - the admin account never battled this week;
  - no open rooms; the admin sees `/sekolah-bersaing` in the admin layout.
- Full list with reasons: narrative §9 (open questions) and §10 (states requiring a live action).
