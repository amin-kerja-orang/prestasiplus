# Verification of cloud fixes

Verified on 2026-10-24 against `origin/claude/determined-dijkstra-ju5q60` @ `4469dc02`, served from the `pp-audit-verify` worktree on port 5199. Playwright MCP lanes were unavailable in this session, so checks ran in headless Chromium at exact viewports (light and dark). The lead viewed the key screenshots, including both Reopened items. Pass criteria = the FIXLOG "What changed" column.

**Result: 36 Verified / 2 Reopened (FB-023, FB-047).**

| FB | Fix commit (from cloud) | Result (Verified/Reopened) | Notes | Date |
|---|---|---|---|---|
| FB-001 | 858a347f, db405fe4 | Verified | ek-demo-1, 1280: attach/detach renumbers plain unique numbers; a gap (18, 19, 21) is kept; typed "1(a)" untouched; notice text exact. The second notice ("…mengikut susunan kertas") was not triggered. | 2026-10-24 |
| FB-002 | 06e6b155, c97a3e27 | Verified | mat1-g1-q1/sunting at 1280 light/dark and 375: "Rajah 1 dikongsi oleh 4 soalan: Soalan 1 (soalan ini), 2, 3, 4. …". The revision review-item variant was not checked. | 2026-10-24 |
| FB-003 | 41ceac09, 839e03c8 | Verified | /admin/spm/soalan 1280: "Kumpulan 4 soalan" chip on 12/12 group rows; drawer "Dikongsi dengan: Soalan N · id". | 2026-10-24 |
| FB-004 | 19222871, 8b6ca547 | Verified | A T1-T3 question with no unit went submit → Lulus & Terbit and shows in the bank as Diterbitkan with topic "Tingkatan 1-3 (di luar DSKP)". Observation: intake still shows "Saya sahkan unit DSKP" and requires SP for T1-T3. | 2026-10-24 |
| FB-005 | be456f48 | Verified | ek-demo-1 (102 fields) and sunting (14), light and dark: all use the same filled field style. | 2026-10-24 |
| FB-006 | f22adce2 | Verified | Dark: selected source-page tab 16.17:1. The selected pager button is a gradient (5.5:1 dark / 6.9:1 light). | 2026-10-24 |
| FB-007 | 73ab2bbc, bd3edad7, 7d9fb169 | Verified | Admin disabled primary 4.66:1 light / 5.28:1 dark (as FIXLOG). The learner 6:1 was not measured. | 2026-10-24 |
| FB-008 | db3b5c28, ffe22134 | Verified | kp-seed-1 "Tambah dari bank" picker text 16.17:1 dark / 11.8:1 light. | 2026-10-24 |
| FB-009 | 75f5b15c | Verified | soalan and semakan tables 1184 px at 1488 and fit the card at 1280 (Tindakan, Status, Semak visible; lead-checked FB-023-1280-light.png); at 768/1024 the table scrolls inside the card, page overflow 0. | 2026-10-24 |
| FB-010 | 5569b11b, 3dd3b8f9 | Verified | 375: cards render KaTeX and show Status + action (Pratonton / Semak / Buka, Padam / ekstrak fields). | 2026-10-24 |
| FB-011 | a6c1e595 | Verified | Source panel static, no max-height, nothing clipped; one page scroll. | 2026-10-24 |
| FB-012 | 1ff39c43 | Verified | 0 px overflow, 320-1280. | 2026-10-24 |
| FB-013 | 1c6b35f8 | Verified | Tag DSKP: 0 overflow, labels not clipped; 1 column at 320/375, 2 at 768/1280. | 2026-10-24 |
| FB-014 | 2fe1bf60 | Verified | 0 overflow at 768/1024/1280. The 3-column part row appears only once the editor is ≥ 512 px wide (first at 1488); at 1280 it is one column. | 2026-10-24 |
| FB-015 | faf8a8bc | Verified | PKSK questions and access at 768/1024: the table scrolls inside the card, Tindakan reachable, row menu opens, no text overlap. Observation: the "Tindakan" header is left-aligned while the icons are right-aligned. | 2026-10-24 |
| FB-016 | 98636033 | Verified | 1280: no text overflows its cell (the only +12 px is the 44 px checkbox hit area); source-file name truncated with an ellipsis. | 2026-10-24 |
| FB-017 | dfbac4d6 | Verified | 320: menu/search/theme 44x44, drawer close 44x44, brand 74x44, bar fits. Observation: the page title truncates ("Pengurusan Soa…"). | 2026-10-24 |
| FB-018 | 7e6b12af, 043df9d7 | Verified | Slide-over/modal close 44x44; "Sisip matematik" 167x44; Tarik 40 px mouse / 44 px touch. Modal close at 375 was not measured. | 2026-10-24 |
| FB-019 | 5d794e3b, 6ae921a4 | Verified | /admin/questions/create, 22 fields at 375x740, 375x560 and 320x640: the focused field always ends above the bar (min 8 px clear). | 2026-10-24 |
| FB-020 | 93c65c06 | Verified | 320: "14,462" fits; long labels wrap to 2 lines, no ellipsis. | 2026-10-24 |
| FB-021 | ed49bc5d, 85de6500, ffe22134 | Verified | /admin/spm/semakan/:key at 375/320: sticky bar with background, 2 rows, "Minta Pembetulan" not cut; no bar on a published item. | 2026-10-24 |
| FB-022 | fabef0bd | Verified | Student navigating in-app to 8 admin Bijak routes gets the in-place 403 at 1280 and 375; guest goes to /login?redirect=. (A full reload drops the mock session, so navigation was in-app.) | 2026-10-24 |
| FB-023 | 8428de2f | **Reopened** | The total is fixed (72 = 61 + 7 + 4, lead-checked), but the promised sub text "72 Terbit · 7 menunggu semakan" never appears. `BankPage.vue` passes `sub` with `density="compact"`, and the compact branch of `src/ds/DsStatTile.vue` does not render `sub`. Repro: admin → /admin/spm/soalan at 1280 or 320 → the four tiles show value + label only. Evidence: screens/img/FB-023-1280-light.png, FB-023-320-light.png. | 2026-10-24 |
| FB-043 | baa97420 | Verified | Sejarah K2 at 320/375/768: passage/table stimuli show an icon tile + "Lihat Bahan N"; full text only in the sheet; figures keep thumbnails; 1280 unchanged. | 2026-10-24 |
| FB-044 | f57c3f78 | Verified | Mod Peperiksaan at 320/375/414/768: "Hantar" in the Peta sheet on every question, opens the dialog "Belum dijawab: n soalan / Ditanda: n soalan". (Mod Latihan has no Hantar in the sheet; it finishes with "Selesai" on the last question, as before.) | 2026-10-24 |
| FB-046 | 11c048c8 | Verified | Focused fields on stimulus questions land below the sticky strip, also with the keypad open. | 2026-10-24 |
| FB-047 | 8942938e, 2eddbc2a, 905158e7 | **Reopened** | Below 768 all criteria pass (bottom sheet, display row + Tutup, covers footer, closes with Tutup/Esc/toggle/tap or focus outside; key taps and scroll do not close). **Defect from 768 on short viewports:** with the keypad open, scroll the paper back to the top → the sticky keypad is clamped by its parent, is drawn OVER the field being edited ("Langkah 1"), and its lower rows slip under the footer (lead-verified). Repro: mat-k2-2025-a, Mod Peperiksaan, at 1280x700, 1536x864, 1024x768 or 768x700 → Soalan 1 → open keypad on "Langkah 1" → wheel-scroll up. Not affected at 1280x900 / 1440x900. Likely cause (code read, not tested): keypad is `md:sticky bottom-0` inside the short MathField wrapper. Evidence: screens/img/FB-047-1280-light.png, FB-047-768-light.png. | 2026-10-24 |
| FB-048 | 35820ba4, 35d441be | Verified | Mat K2 Bahagian C, 5 scenarios at 320/375: auto-tick, disabled box + message, over-answer message, "Belum dijawab", result and progress bar consistent. Note: "Soalan yang dikira: 5" lists question numbers, easy to misread as a count. (The rule itself is being changed per mode — see ANSWERS.md FB-048.) | 2026-10-24 |
| FB-049 | 0bd250bf, 35d441be | Verified | "Perlu perhatian" matched the rule in 8 runs (Mat K2, Sejarah); "Tidak dikira" never listed. | 2026-10-24 |
| FB-050 | 3f1df8b5, 93bbd564 | Verified | inputmode decimal; "68ab", "abc", "2x+1" flagged with the exact hint; "3, 5", "3 dan 5", "1.2E3", "5.", "7 hari", "30 °C" accepted. | 2026-10-24 |
| FB-051 | bfc1b3f4 | Verified | Hub, cover, result, history at 320-768: no overflow; last content 40-62 px above the AI button, 124 px above the nav; AI button hides on scroll down, returns on scroll up/top/end/focus/route change. Known (accepted by the user): it can cover some text at the top of a page at 320-375. Resume-button stacking not re-checked. | 2026-10-24 |
| FB-052 | 32e1d968, 88e229a4 | Verified | Both modes at 320/360/375/414: all footer buttons visible, no horizontal scroll; Seterusnya wraps to a 2nd row at 320 (and at 375 on Q1-Q2 in Latihan). | 2026-10-24 |
| FB-053 | 94ea078f | Verified | Mat K1 cover "10 soalan"; Q4 option 22/3; unit placeholder "Tulis unit". | 2026-10-24 |
| FB-054 | a165ae1f | Verified | Title 12 px clear of "Tanda soalan" at 320/375/1036/1280, light and dark; wraps sensibly. | 2026-10-24 |
| FB-055 | 68d0d49b, d861886a | Verified | Current question framed in light and dark; legend has swatches; phone sheet uses the page-coloured card. Note: the "Belum" swatch is very faint in dark. | 2026-10-24 |
| FB-056 | 74651428, bb18bc9d, 1953b6ad | Verified | choose-N row 45 px; Unit, working-step and "Jawapan akhir" 52 px; theme/account/search 44x44; logo 44 px. (The user delegated the size decision: 44 px below 768 — see ANSWERS.md FB-056.) | 2026-10-24 |
| FB-057 | 70fd62f8 | Verified | Cover and hub hero text 10-11 px below the art at 320/375/414/639; beside the art from 640. | 2026-10-24 |
| FB-058 | b9448f4d | Verified (note) | Dark: the stimulus card fill is visible (#1e222b on #15181f, ~1.15:1, subtle). FIXLOG says "surface and border", but the commit changes only the fill; computed border width is 0. Cloud: correct the FIXLOG wording or add the border. | 2026-10-24 |

## Observations outside the FB list (not reopened)

- T1-T3 intake still shows "Saya sahkan unit DSKP" and requires SP, although the publish gate passes without a unit (relates to FB-004 / FB-026).
- Review queue shows "6 Menunggu" while the bank reports 7 pending (a 2-question group is one queue item).
- Possible: after an unfinished attempt, "Mula Semula" on the cover restarts in Mod Peperiksaan because the mode choice is hidden (unverified).
