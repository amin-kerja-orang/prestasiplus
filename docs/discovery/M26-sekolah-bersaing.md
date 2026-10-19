# Discovery - L50 Sekolah Bersaing (matrix #45), Admin Sekolah

| Field | Value |
|---|---|
| Matrix row | L50 "Sekolah Bersaing" (matrix #45), role Admin Sekolah (AS, Release 1.0) |
| Nominal owner | M26 (ROLES-MATRIX-LINES.md) - **but see Finding 1: M16 already owns this screen (S28) and it is G1-approved** |
| Method | Code-based (D24), no browser. Reference = `D:\Dev Projects\prestasiplus-reference` (another team's reconstruction; secondary only) + our own M16 live captures |
| Date | 2026-10-03 |
| Provenance tags | LIVE-CAPTURE (from our M16 discovery of the live site, admin account), SERVER (reference replica code), NOT FOUND |

## 1. Findings that change the plan

1. **L50 is already specified and partly built under M16.** `/sekolah-bersaing` is M16 screen **S28** (URS EP-M16-10, US-M16-38, FN-M16-10.1.1-6, AC-M16-38.1-38.6; SRS FR-M16-127...131, BR-M16-35, DATA-M16-13, API #50 `GET /api/sekolah-bersaing?week=`, §6.11.6 seeds). M16 is G1 approved (audit round 2 PASS, TRACKER 2026-09-27). `docs/architecture/build-plan.md` row 45 already maps it to **M16-T6a** (needs M16-T1). The mock repository `src/modules/m16-battle-games/mock/repository/sekolah-bersaing.ts`, `api/battle.ts#fetchSekolahBersaing`, `Q-SB-WEEK` and the seed (`data/sekolah-bersaing-seed`) exist; the page (`pages/SekolahBersaingPage.vue`) and route (`routes/sekolah-bersaing.ts`) do not. Recommendation: **L50 needs no new module M26 work and no new URS/SRS**; reassign the row to M16 (T6a) and keep M26 for `/profil-cerah`, `/cita-cita`, `/cikgu-suara`, `/wellbeing/alerts` (TRACKER section M26 lists no Sekolah Bersaing item).
2. **Live is the spec; the reference server contradicts live.** Live (LIVE-CAPTURE, admin): weekly snapshot board, columns "#", "Sekolah", "% Aktif", "Streak Avg", "Nota/Pelajar", header "Minggu {d Mon yyyy} · {n} sekolah dalam pertandingan", `?week=`, "Sekolah anonim", WhatsApp footer tip. The reference student/admin view (`pelajar/sekolah-bersaing.blade.php`) is a live aggregate of `practice_sessions.accuracy` with columns "#", "Sekolah", "Negeri", "Ketepatan", "Pelajar" and top 30. These are different products. Per D24 and CLAUDE.md section 6, live wins; the SERVER material below is used only for what live cannot show (role differences, own-school highlight, state filter).
3. **Admin Sekolah has never been observed on live** for this page (no school-admin account; only the admin account was captured, rendering in the admin layout with header "Dashboard" / "Selamat datang, Admin", defect D-M16-2 / DV-M16-02 moves it to the user shell). School-admin behaviour is therefore INFERRED / SERVER only.

## 2. Routes

| Route | Method | Roles / middleware | Controller | Provenance |
|---|---|---|---|---|
| `/sekolah-bersaing` | GET | `auth` + `role:pelajar,guru,admin,admin_sekolah,pegawai_ppd` (web.php:1404 group; route at :1490). Comment at :1480-1489: staff accounts were previously bounced with 302 under `role:pelajar` | `SharedPortalPagesController@sekolahBersaing` - branches on role: `guru` delegates to `GuruCompetitionController@sekolahBersaing`; everyone else (pelajar, admin, **admin_sekolah**, pegawai_ppd) falls through to `StudentController@sekolahBersaing` ("admin roles fall through to the student view deliberately: that is what the origin does") | SERVER |
| `/guru/sekolah-bersaing` | GET | same group (web.php:1786) | `GuruCompetitionController@sekolahBersaing` | SERVER |
| `/sekolah-bersaing?week=YYYY-MM-DD` | GET | live: any logged-in role seen with admin | live job snapshot of that week (Monday-normalised); invalid value gives HTTP 500 on live | LIVE-CAPTURE |

- `EnsureRole` redirects a role outside the list to its home (`homeFor`); admin_sekolah is inside the list, so allowed (SERVER).
- Shell: school admin uses the **user shell** (docs/design/shells.md section 3; our `user-nav.ts` item `sekolah-bersaing` under section "Visi & Pertandingan" with roles `SA_`, and `sekolah-bersaing-ai` in the Pusat AI block with `AI_ALL`, tooltip "Leaderboard mingguan sekolah-sekolah Malaysia", badge NEW). Note: `SA_` = student + admin only. The matrix lists AS for this row; the AI block entry (`AI_ALL`, includes `school_admin`) already links `/sekolah-bersaing`, so the route is reachable by a school admin through that block. Verify with the roles-matrix screenshot whether the "Visi & Pertandingan" entry must also include `school_admin` (open question OQ-1).
- Reference admin layout lists it only under "Pratonton Pelajar" (`admin/layout.blade.php:689`), i.e. as a student preview, not a native admin page (SERVER).

## 3. Screen inventory and copy (authoritative = live, from M16 S28)

Source: `docs/discovery/inventory/M16/S28-sekolah-bersaing.json` (68 elements), URS section S28 table (EL-M16-S28-001...068), SRS section 6.11.6. All LIVE-CAPTURE unless stated.

| # | Element | Exact copy / rule |
|---|---|---|
| 1 | Hero h1 | "🏆 Sekolah Bersaing" (amber hero) |
| 2 | Hero subtitle | "Leaderboard mingguan - bandingkan sekolah-sekolah di Malaysia. Anda rasa bangga? Kongsi." (live uses a dash; take exact text from the URS EL-M16-S28-002 / inventory JSON) |
| 3 | Week line | "Minggu **{d Mon yyyy}** · **{n}** sekolah dalam pertandingan" - Monday of the shown week; default current week: "21 Sep 2026" / "49"; n = number of rows |
| 4 | Table header | "#", "Sekolah", "% Aktif", "Streak Avg", "Nota/Pelajar"; last two `display:none` below 768 px |
| 5 | Row | rank cell "🥇" "🥈" "🥉" then "#4"...; name + state line (e.g. "Kelantan"); "{x.x}%" + small "aktif"; "🔥 {x.x}" + small "hari"; "{x.x}" + small "per 10"; small text 11.2 px; top 3 styled gold / silver / bronze (`.lb-row`) |
| 6 | Opt-out | a school that opted out shows "Sekolah anonim" (copy only; never observed in data; no opt-out column exists in the reference schema) |
| 7 | Footer tip | "💡 **Untuk Cikgu Besar / PIBG:** Share ranking ini ke parent group WhatsApp. Pelajar nampak sekolah berbangga = lebih semangat. Sekolah yang opt-out akan paparkan sebagai "Sekolah anonim"." |
| 8 | Empty week | "📊 Data minggu ini belum dijana." / "Cron mingguan akan kira pada Isnin pagi. Tunggu kejap ya." with the hero still shown (e.g. `?week=2025-01-06`) |
| 9 | Invalid week | live: 500 page "Ralat Pelayan"; rebuild: ignore and show current week (DV-M16-30, SEC-M16-09) |
| 10 | Share button "Kongsi" | **NOT FOUND on live** (68 elements contain no button). The reference PRD (docs/prd.md:92, prd-teacher.md:371) mentions a "Kongsi" button; the word occurs only in the subtitle. Do not build a button. |
| 11 | Filters | none on live (no period/state/level control; `?week=` has no UI). Reference guru view has a "Negeri" select (see section 5), not observed on live for admin |
| 12 | Own-school highlight | none observed on live for admin (admin has no school). For admin sekolah: NOT OBSERVED. |

Rows seeded: the 49 observed rows of week 21 Sep 2026 and 48 rows for 14 Sep, 07 Sep, 31 Aug 2026 (SRS section 6.11.6, already in the M16 seed). Schools are M02 register schools by placement rule (PROPOSED), so no real school names are copied here.

## 4. Live computation (what is known)

- Data is produced by a weekly server job (Monday morning cron) and stored; the page shows the snapshot of the requested week (LIVE-CAPTURE copy + observation of past weeks).
- Order: not by one column. Rows 1-16 descend by Streak Avg (all 0.0% aktif); #17 (0.5%, 1.6) above #18 (0.0%, 1.8); #19 (0.4%, 1.1) above #20 (0.0%, 1.4). Fits `score = %aktif*a + streak*s` with 0.4 < a/s < 1.75 (INFERRED; discovery M16 section 5.6). "Nota/Pelajar" is 0.0 everywhere so its weight is unknown. The rebuild does not recompute: it stores the observed rank order (BR-M16-35).
- Defect D-M16-26: "0.0% aktif" beside "Streak Avg 15.0 hari" contradicts; kept as live (seed mirrors observation; D9 not applied, recorded in M16).
- NOT FOUND in the reference for the live metric: no code produces "% Aktif", "Nota/Pelajar" or "per 10", and there is no weekly cron or weekly snapshot table (`docs/gap-analysis.md` lines 22, 76, 128, 317 state the Monday job is not scheduled). The migration `school_battle_rankings` (school_id, battles_played, wins, draws, losses, accuracy, score) is the battle league table (BattleController), unrelated to this page.

## 5. SERVER material (reference replica, secondary)

Both queries (StudentController.php:1463; GuruCompetitionController.php:296):

```
schools JOIN users ON users.school_id = schools.id
        JOIN practice_sessions ON practice_sessions.user_id = users.id
WHERE schools.is_active = true   [AND schools.state = :negeri  (guru only)]
GROUP BY schools.id, schools.name, schools.state
SELECT round(avg(practice_sessions.accuracy),1) AS avg_acc, count(distinct users.id) AS active_students
ORDER BY avg_acc DESC LIMIT 30 (student/admin/admin_sekolah)  |  LIMIT 50 (guru)
```

| Item | Student / admin / admin_sekolah view (`pelajar/sekolah-bersaing.blade.php`) | Guru view (`guru/sekolah-bersaing.blade.php`) |
|---|---|---|
| Title / heading | "Sekolah Bersaing"; subheading "Kedudukan sekolah berdasarkan ketepatan latihan" | "Sekolah Bersaing" |
| Hero | "Papan Pemimpin" / "Sekolah Bersaing" / "Kedudukan sekolah teratas berdasarkan purata ketepatan latihan pelajar." | same, plus "Sekolah anda: #{rank}" when the teacher's school is ranked |
| Filter | none | label "Negeri", select "Semua Negeri" + distinct active school states (auto-submit); invalid value falls back to all |
| Columns | "#", "Sekolah", "Negeri" (hidden below md), "Ketepatan" (pill), "Pelajar" (hidden below sm) | adds "Streak Avg" ("🔥 x.x", = round(avg(student_wallets.streak_days),1) per school, 0 if none) and "Nota/Pelajar" (hard-coded 0.0), both hidden below lg |
| Ketepatan pill | green >= 70, amber >= 50, red < 50; "{avg_acc}%" | same |
| Own-school highlight | none (admin_sekolah runs as `demoStudent()`, so no own school) | row class `rank-highlight-mine`, suffix "(Sekolah Anda)" |
| Rank cells | 🥇 🥈 🥉 for 1-3, else number | same |
| Empty state | "🏫" "Belum ada data" / "Tiada rekod latihan sekolah lagi." | same |

Notes: the guru view's comment says the origin shows "Streak Avg" and a flat 0.0 "Nota/Pelajar" - consistent with live S28's columns, which supports live being a table of the same shape. The "Negeri" filter and "Sekolah anda: #" line are the replica team's claims about the teacher view; **not observed in our live capture** (admin account). Not to be built unless the live probe sees them for a school admin.

## 6. Data mapping to our stores (D12)

| Need | Owner | Existing store / contract | Note |
|---|---|---|---|
| Weekly snapshots (weekStart, rows, rank order, % aktif, streak avg, nota per 10, anonymous) | M16 | `sekolahBersaingTable`, repository `sekolahBersaing`, `Q-SB-WEEK`, seed `SB_WEEKS` | already built (M16-T1); no new schema |
| School name, state | M02 | `schools` dataset (rows resolved per SRS 6.11.6 placement) | as built |
| Streak Avg source | M14 (wallet streak) | live value is a stored job output; seed uses observed numbers | no runtime recompute (D11 allows documented display data) |
| % Aktif, Nota/Pelajar | none | observed constants (0.0 almost everywhere) | live definition unknown |
| M05 answers/sessions, M10 classes | - | not used by live S28; the SERVER query would use M05 sessions + M02 users but contradicts live | do not use |
| Own school of a school admin | M02 | `users.schoolId` (school_admin account) | only needed if a highlight is later observed |

## 7. Live-probe URL checklist (GET only, lane 1, school-admin account if available, else admin)

1. `/sekolah-bersaing` as school admin: header text (Dashboard vs "Sekolah Bersaing" / "Selamat datang kembali"), shell (admin vs user), any own-school highlight, any "Negeri" select, any "Kongsi" button, heading/subtitle exact punctuation (dash character), week line, row count, footer tip.
2. `/sekolah-bersaing?week=2026-09-14`, `?week=2026-09-16` (normalises to 14 Sep), `?week=2025-01-06` (empty state) as school admin: same results as admin?
3. `/sekolah-bersaing?negeri=Selangor` and `?negeri=Johor`: confirm whether a state filter exists on live (expected: ignored).
4. `/guru/sekolah-bersaing` (teacher account if available): "Negeri" filter, "Sekolah anda: #", "(Sekolah Anda)" suffix, "Ketepatan" vs "% Aktif".
5. Role-based sidebar of school admin: is "Sekolah Bersaing" present in both "Visi & Pertandingan" and the Pusat AI block; link target.
6. `/sekolah-bersaing?week=bogus` (expect 500 "Ralat Pelayan"; already known for admin).

## 8. Open questions

- OQ-1. Is the roles-matrix row for Admin Sekolah satisfied by the existing `sekolah-bersaing-ai` nav item (roles `AI_ALL`)? `SA_` omits `school_admin` for the "Visi & Pertandingan" duplicate. Check the matrix screenshot (`roles-matrix/*.jpeg`) and fix `user-nav.ts` if the school admin menu shows both entries. (Matters for the nav owner, not for this document.)
- OQ-2. Does a school admin see an own-school highlight or a state filter on live? (Probe items 1, 3.)
- OQ-3. Row ownership: confirm with the delivery lead that L50 moves from M26 to M16 (M16-T6a). If M26 must keep it, M26 would only re-reference S28; no duplicate schema (D12).
- OQ-4. Privacy: seeds use fictitious "SB-{state}-{n}" placeholders mapped to M02 schools; no real school names were taken from live for this note.

## 9. Recommended next step

Treat L50 as **Standard track on M16**: M16-T6a builds `SekolahBersaingPage.vue` + `routes/sekolah-bersaing.ts` against the existing repository (user shell, `layout: user`, roles student/teacher/school_admin/admin/ppd), then G4, then targeted G5 for AC-M16-38.1-38.6 plus one school-admin run. A brief live probe (section 7) should precede G5 only to settle OQ-2.
