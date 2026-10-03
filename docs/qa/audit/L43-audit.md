# L43 "Kedai Hadiah Digital" - independent audit (M15 URS v1.4 / SRS v1.5)

Date: 2026-10-02. Auditor: independent audit agent. Live: Playwright lane 2 only, admin session already logged in, GET only (no submit, no POST, no "Tebus", no login/logout).
Scope: URS EP-M15-10, FN-M15-9.1.6/9.1.7, FN-M15-10.x, US-M15-22..25, AC-M15-22.1..25.3, DV-M15-16..19, coverage EL-M15-S10-001..019 and S11-001..004; SRS S10/S11, FR-M15-67..79, BR-M15-26..28, endpoints #19/#20, E2E-M15-58..71, XR-M15-13/14, OQ-M15-13..16. Docs were not edited (read-only); this report is the only doc written. New evidence images were written to `docs/discovery/img/L43/`.

## Verdict: PASS (no Critical, no Major; 6 Minor findings to fold into the next doc revision)

Every OBSERVED claim reproduced on live. DV-M15-16 is a genuine contradiction and is correctly handled. DV-M15-19 is confirmed with measurement (the real sizes are smaller than the doc's guess: 9px and 10px). DV-M15-17 is consistent with the shell-wide rule. The minor findings are wording or evidence upgrades, none changes the build.

## Findings

| ID | Severity | Finding | Evidence | Fix |
|---|---|---|---|---|
| AUD-L43-01 | Minor | DV-M15-19 states "about 10-11px, not measured". Measured: caption "100 syiling = 1 token" = **9px**; labels "Token Anda" and "Syiling" = **10px**; the chips are 12px, the subtitle 14px, the Tebusan Saya button 14px. All three texts are below 12px, so the DV is confirmed and no longer conditional. | Computed `font-size` via `getComputedStyle`, identical at 375, 768 and 1280 (Tailwind fixed sizes). | Edit the DV-M15-19 "Live" cell to "caption 9px; labels 10px (measured 2026-10-02)", change its status from "conditional on measurement" to "Approved (D9); measured", and update FN-M15-10.1.4. Builders raise all three to 12px; check that the card (369px natural width at 768/1280, 324px at 375) still fits. |
| AUD-L43-02 | Minor | The label copy is written "TOKEN ANDA" / "SYILING" (FN-10.1.3, AC-22.2, EL-S10-003/005, SRS §9). The DOM text is "Token Anda" / "Syiling" and CSS `text-transform: uppercase` renders it in capitals. | `textTransform: uppercase` on both label divs; the DOM text is mixed case. | State "rendered uppercase via CSS (DOM text 'Token Anda' / 'Syiling')". AC-22.2 and E2E-M15-59 should assert the rendered text, or the builder will hard-code capitals and break copy-paste and screen-reader text. |
| AUD-L43-03 | Minor | Coverage gap on S11: a decorative gift emoji "🎁" (48px, own div) sits above the empty text inside the white card and is not listed. S11 has 5 elements, not 4 (the coverage rows say 4/4 and total 273). S10 has no such emoji; its empty state is text only (verified: no emoji-only div in S10 `main`). | S11 inventory: `H1 📋 Tebusan Saya 24px`, `A 🎁 Kedai Hadiah 16px`, `DIV 🎁 48px`, `P Belum ada tebusan... 16px`, `A Layari Kedai Hadiah 16px`. Visible in `cikgu-hadiah-saya-1280.png` and `-768.png`. | Add EL-M15-S11-005 (icon/emoji, visible-default, "🎁" 48px above the empty text), map it to FN-M15-10.2.3, and update FR-M15-74 and AC-M15-23.1. Counts become S11 5/5 and M15 274/274 (262 mapped, 12 excluded). This also confirms that the "S10/S11 counted by hand" caveat in the coverage section was justified. |
| AUD-L43-04 | Minor | Evidence upgrade: FN-M15-10.1.7, BR-M15-27, FR-M15-71, AC-22.5/22.6 and E2E-M15-62/63 call two behaviours INFERRED. Both are now OBSERVED on live. (1) `?cat=flagship` makes "🏆 Mahkota" the active chip (bg rgb(124,58,237)) and "🌟 Semua" goes plain (rgb(241,245,249)). (2) `?cat=bogus` returns 200 with the same page, the same empty copy and **no chip active** (all ten chips rgb(241,245,249)). Also observed: `ewallet`, `telco` and `entertainment` show the same empty copy. | Computed chip background colours per URL; status 200 for all; the empty text present on every URL. | Change INFERRED to OBSERVED for the active-chip move and the unknown-`cat` case; extend the "OBSERVED for all, gaming, flagship" list. The behaviour already written in the docs is correct. |
| AUD-L43-05 | Minor | S11 pixel layout, listed "NOT OBSERVED" (URS §5, "none captured"), is now measured. SRS §10 says the title row "may stack"; it does not. h1 and the "🎁 Kedai Hadiah" link button stay on one row, the button right-aligned, at all three widths. At 375 the h1 wraps to two lines (174x64) beside the button (150x64). White card below, centred emoji, text and link. | Bounding boxes: 375 h1 [25,119,174,64], btn [200,119,150,64]; 768 h1 [43,184,188,32], btn [565,180,160,40]; 1280 h1 [344,139,188,32], btn [1032,135,160,40]. `scrollWidth` = viewport at all three. Screenshots added (below). | Replace the URS §5 S11 row with the measured layout and the new screenshots; reword the SRS §10 S11 row to "one row, button right, h1 may wrap at 375". |
| AUD-L43-06 | Minor | The 375 layout text is almost right but E2E-M15-70 ("card full width at 375, natural width under the subtitle at 768, right of the title block at 1280; chips 4 / 2 / 2 rows") is verified, with these exact numbers to use in the test: card 324px (full) at 375; 369px at 768 (x=43, below the h1) and at 1280 (x=861, same row as the h1); chip rows 4 / 2 / 2. The text is correct, no change needed. Recorded here only as confirmation, with the finding that the discovery doc says "At 1280 the chips wrap onto two rows" (also correct). | Same measurement run. | None (informational). |

Not a finding but noted: `src/shells/nav/user-nav.ts:455` still has `to: '/kedai-hadiah'`. This is expected, because the docs assign the fix to the shell owner (XR-M15-13) and the audit scope is docs. It must be fixed before the shell's G3; keep the XR open until then.

## Judgements requested

**DV-M15-16 (caption 100 vs 50) - truly contradictory: yes, keep the DV.** On the same admin account (256 syiling, tier Gangsa) `/gamification/convert` shows "Kadar: 50 syiling = 1 token (Gangsa)" and a tier table 50 / 40 / 30 / 20 ("ANDA" on Gangsa). `/cikgu/hadiah` shows "100 syiling = 1 token". Two live statements of the same exchange rate for one account disagree, and no live tier uses 100. The change is minimal (only the number), D12 holds (the wallet and tier rate are M14's) and the alternatives are recorded. M14 SRS XR-M15-05 already ruled the same "100 syiling" hint a wrong label. Caveat for the user-reversal path in OQ-M15-16(b): the live "100" is most likely a hard-coded template value, so a reversal is cheap.

**DV-M15-17 (header titles) - justified, consistent.** The header reads "Dashboard" / "Selamat datang kembali" on S10 and S11, and also on `/gamification/rewards` and `/gamification/convert` (the shell shows "Dashboard" on every user-shell page; `/admin/hadiah` shows "Dashboard / Selamat datang, Admin"). So it is the known shell-wide wrong title (DV-SH-03 / DV-M15-12), and the fix (page title plus the live subtitle) adds no new copy.

**DV-M15-18 (nav href) - confirmed.** `/kedai-hadiah`, `/hadiah`, `/kedai` and `/cikgu/hadiah/1` all return 404 ("404 - Halaman Tidak Dijumpai | PRESTASIPLUS"); `/cikgu/hadiah` is 200.

**DV-M15-19 (text size) - confirmed and measured**: see AUD-L43-01.

**D10, privacy, no invented behaviour:** no accessibility enhancements are added; screenshots show only avatar initials "AP" (no personal names; sidebar and header contain no person's name, verified by reading the aside/header text); populated states, Tebus and item detail are explicitly not built and labelled NOT OBSERVED. The labelled INFERRED items are marked as such. D12: S10 reads the wallet from M14 (#17 = `/api/gamification/wallet`; M14 #2 returns `tier.conversionRate`, so XR-M15-14 is already satisfied by the existing contract).

## Claims checked on live (all reproduced)

| Claim | Result |
|---|---|
| `/cikgu/hadiah` 200, tab title "Kedai Hadiah Digital", user shell, no redirect | OK |
| h1 "🎁 Kedai Hadiah Digital"; subtitle "Tukar token kepada hadiah digital — terus dihantar, tanpa pos." | OK (24px / 14px) |
| Balance card: Token 0, Syiling 256, caption "100 syiling = 1 token", white button "Tebusan Saya" → `/cikgu/hadiah/saya` | OK |
| 10 chips in order with `?cat=` values all, flagship, ewallet, telco, gaming, streaming, food_beverage, ecommerce, education, entertainment; labels with emoji as listed | OK (hrefs read from the DOM) |
| Empty copy "Tiada hadiah dalam kategori ini." for several cats (default, ewallet, telco, flagship, entertainment, bogus) | OK |
| Default active chip "🌟 Semua" (purple fill) | OK |
| `/cikgu/hadiah/saya` 200, title "Tebusan Saya", h1 "📋 Tebusan Saya", link "🎁 Kedai Hadiah" → `/cikgu/hadiah`, empty text, link "Layari Kedai Hadiah" → `/cikgu/hadiah` | OK |
| 404 for `/kedai-hadiah`, `/hadiah`, `/kedai`, `/cikgu/hadiah/1` | OK (status 404 on all four) |
| `/gamification/convert`: "Kadar: 50 syiling = 1 token (Gangsa)", tiers 50/40/30/20 | OK |
| No horizontal scroll at 375 / 768 / 1280 on S10 and S11 | OK |
| 375 / 768 / 1280 S10 layout (card full width, then under title, then right of title; chips 4/2/2 rows) | OK |

## Coverage verification (EL-M15-S10-001..019, S11-001..004)

S10: all 19 listed elements exist on live with the same text, href and order (heading, subtitle, 2 labels, 2 values, caption, Tebusan Saya link, 10 chips, empty text). No extra visible element in `main` other than a hidden tournament-banner script/template (declared out of count in the URS) was found. S10 map: 19/19 verified, 0 missing.
S11: 4/4 listed elements exist; **1 element is missing from the list** (the 48px gift emoji, AUD-L43-03). After that fix, the S10/S11 total is 19 + 5 = 24, M15 content 274/274 accounted for.
Automated inventory for both pages was produced in this audit (computed style and href dump of every text node, link and button in `main`; scripts were inline, nothing saved in the project) and matches the manual list except AUD-L43-03.

## Evidence produced

- `docs/discovery/img/L43/cikgu-hadiah-saya-375.png`, `-768.png`, `-1280.png` (S11; only avatar initials "AP" visible, no names, no masking needed).
- Measured values: see AUD-L43-01, 05, 06.

## Open items for the owner (not blocking)

- URS OQ-M15-14 can be closed after AUD-L43-01..05 are folded in; OQ-M15-13 and OQ-M15-16 still need the user.
- Murid view (Q-L43-2/3) stays "Perlu pengesahan"; an admin session cannot show it.
