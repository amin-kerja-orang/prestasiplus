# M15 — Rewards Shop & Redemption — Independent Audit (AUD, round 1)

| Field | Value |
|---|---|
| Documents audited | `docs/requirements/urs/M15-rewards-shop.md` v1.0, `docs/requirements/srs/M15-rewards-shop.md` v1.0 |
| Evidence | discovery `M15-rewards-shop.md` (§1–§9, D-M15-1…13), `inventory/M15/*.json` (+ `_summary.md`, `_crawl.json`, `_snapshot-2026-09-26.json`), `img/M15/`. Live re-walk on 2026-09-26 on browser lane 3 with the admin account, read-only. <br>• A context-level route guard aborted every non-GET request. The only exception was the login POST. The only non-GET requests the pages made were Cloudflare RUM beacons, and all of them were aborted. <br>• Nothing was clicked that mutates: no toggle, bulk action, save, delivery, box, ticket, approval or quiz. <br>• GETs were spaced at 450 ms or more. <br>• Page scripts and stylesheets were read with `document.scripts` / `<style>`. |
| Cross-module docs | M14 SRS v1.0 (§6.13 answers to XR-M15-01…08, BR-M14-16/22/29/31, DATA-M14-17/18/19), M14 discovery (S9 D-5, S12 convert page), M02 SRS v1.11 (§6.15 users dataset and id policy, DATA-M02-02 links), M01 SRS (BR-07, canonical accounts), `docs/design/shells.md` |
| Auditor | independent audit agent (not an author) |
| Screenshots | none taken. No finding needed a capture, and no personal data was captured. The "Pelajar" column of `/admin/hadiah/tebusan` was never returned from the page. It was only compared as equality booleans and salted hashes (see "Privacy check"). |

## Verdict: **FAIL**

| Severity | Count |
|---|---|
| Critical | 0 |
| Major | 1 |
| Minor | 7 |
| Info | 3 |

What is good:
- **Coverage is complete.** I re-ran the matrix by script (`<scratchpad>/m15-audit/matrix.cjs`) and got:
  - 829 inventory elements (S1 58, S2 9, S3 40, S4 54, S5 10, S6 58, S7 9, S8 9, S9 3, SHA 207, SHU 372) and 829 matrix rows. There are no duplicates, no unmapped elements and no extras.
  - M15 content is 250/250 (238 mapped, 12 excluded). The 12 exclusions are exactly the M16 tournament-banner triplets "LIVE:" / "MAIN" / "DAFTAR" (EL-M15-S5…S8-001–003).
  - Shells: 265 elements mapped and 564 excluded.
  - Every mapped FN exists (108 defined, 65 cited). The FN catalogue's "EL" column agrees with the matrix for every element (0 inconsistencies).
  - Every shell element whose href or text is an M15 target is mapped: SHA-060/168, SHU-072/084/085/089/097/116/213/299/303/312.
- **Traceability is clean** (`trace.cjs`):
  - Counts: 108 FN, 21 US, 87 AC (34 provisional), 66 FR and 57 E2E (25 provisional). They match the change-log counts.
  - Every FN has an FR and sits in a story. Every AC has an FR and an E2E, and every FR has an E2E.
  - Every E2E's FR list contains an FR that owns each of its ACs.
  - The provisional marks agree both ways, and every E2E runs at 375 / 768 / 1280.
- **The seed mirrors observation exactly.** `seed.cjs` compared SRS §6.7 with the snapshot's 59 edit forms and list rows, 24 fields per reward, and found **0 mismatches**. I also re-read all 59 rows on live today: the ids, titles, vendors, long category labels, RM, Token, Stok, Tebusan 0, "Off" and the edit links are identical.
  - The consent count (12), stock-5 count (19), cap count (25) and validity split (30 ×11 / 60 ×10 / 90 ×13 / 365 ×25) are correct.
  - The 3 cancelled redemptions, the 4 boxes and the admin wallet 256 / 0 / 8 match live.
  - Nothing is invented or tuned. The one INFERRED value, the year 2026, is labelled and never displayed.
- **The live copy and the page script are exact.** 64 claims were checked (list below). They include every bulk dialog, alert and regex, the 17 form fields with their attributes and defaults, the 405 and 404 pages, the tab titles and the stale "Dashboard" header.
- **The rejected deviations DV-02, 05, 06, 09, 10 and 11 are correct under D9/D10** (assessment below). The approved fixes DV-01, 04, 07, 08, 12 and 13 are minimal. My sweep of every text node below 12 px on S1–S8 found exactly the four items of DV-13 and nothing else.
- **Cross-module numbers agree.**
  - Wallet: admin 256 / 0 / 8 matches M14 #2, which also adds level 2.
  - Ledger text: "Kotak Misteri: {name}" matches BR-M14-22 (type `earn`, source `mystery_box`).
  - Contract names: `debitTokens`, `creditTokens`, `creditSyiling`, `addXp`, `debitSyiling` and `draws.*` match M14 §7.1.
  - Anchors 3151 / 3152 do not collide with M08 3001–3008 / 3201–3215, M09 3101–3109 or M14's requested 4001–4208.
  - Parent 6 ↔ students 2 and 4 and parent 5401 without links match M02 DATA-M02-02.
- **No real name appears.** The docs contain only fictitious people (see "Privacy check").

Why it fails (1 Major):
1. **DV-M15-14 keeps a wrong label (AUD-M15-01).**
   - The hint "100 syiling = 1 token = RM1" states a conversion rate that no live rule uses. The live convert page shows "Kadar: 50 syiling = 1 token (Gangsa)" and the tiers 50 / 40 / 30 / 20. The live cash rate is 10 syiling = 8 sen, so 100 syiling = RM0.80, not RM1.
   - The owner of the rate, M14, has now answered XR-M15-05: the hint is a wrong label under D9, and the minimal fix is "1 token = RM1".
   - The DV's own condition ("M15 will align the hint only if M14 decides the hint is wrong") is therefore met. The rejection must be reversed.

---

## Findings

| ID | Severity | Doc & section | Issue | Live / cross-module evidence | Required fix (owner) |
|---|---|---|---|---|---|
| AUD-M15-01 | **Major** | URS §7 DV-M15-14, FN-M15-3.1.6, AC-M15-09.1, AC-M15-21.4, §1 overview sentence, §9 OQ-M15-10 / 11; SRS §0.1, §6.10 XR-M15-05, §8.1 / §8.2, E2E-27 / 55 | DV-14 is "Rejected — replicate live (pending M14)". Under D9 the hint is broken:<br>• **It is a wrong label.** It states a rate (100 syiling per token) that no tier applies. The convert page says tokens are for redeeming these rewards ("Tukar syiling anda kepada token untuk tebus hadiah"), so the admin guidance and the student-facing rule describe the same exchange and contradict each other.<br>• **It also contradicts the cash-out rate.** The live cash rate gives 100 syiling = RM0.80, not RM1.<br>• **Precedent.** M14 already fixed the same kind of example label as a wrong label: D-5 / DV-M14-05, "(cth: 100 syiling = 8 sen)" → "10 syiling".<br>• **The owner has decided.** M14 SRS §6.13 answers XR-M15-05 with "a wrong label under D9 … minimal fix: '1 token = RM1'", so the "pending M14" reason no longer holds.<br>The part "1 token = RM1" is correct on every live row (`tokenCost` = `denominationRm` for all 59), so dropping only "100 syiling = " is the minimal change, and it creates no new contradiction. | Live `/gamification/convert` (read today): "Kadar: 50 syiling = 1 token (Gangsa)"; "🥉 Gangsa 0+ syiling 50 syiling/token", "🥈 Perak … 40", "🥇 Emas … 30", "💎 Platinum … 20". Live `/admin/hadiah/baharu`: hint "100 syiling = 1 token = RM1" at 10px. M14 discovery S9: `cash_rate_coins` 10 = `cash_rate_sen` 8. M14 SRS §6.13 XR-M15-05. | **product-analyst (URS) + solution-architect (SRS):**<br>• Change DV-M15-14 to **Approved (D9)**. Rebuild: the hint reads "1 token = RM1" (PROPOSED COPY), 12px, same place. Record these alternatives: (a) "50 syiling = 1 token = RM1" — rejected, the rate is tier-dependent and it would contradict the cash rate; (b) remove the hint — rejected, it removes correct guidance; (c) replicate — rejected, a wrong label that the owner has confirmed.<br>• Update FN-3.1.6, AC-09.1 and AC-21.4 (hint text), the §1 overview (the rate quoted as fact), SRS §8.1 → §8.2 (PROPOSED), OQ-M15-10 (add the copy), §0.1 (move DV-14 to the approved list) and XR-M15-05 (closed).<br>• Keep "100 syiling = 1 token = RM1" only as the recorded live text. |
| AUD-M15-02 | Minor | URS §0 "Related" ("M14 has no URS/SRS yet"), §8 rows, §9 OQ-M15-11 / 12; SRS §0 "Related", §6.1 (legacy catalogue "ownership pending"), §6.10 XR-01…08, BR-M15-05 ("No budget check (XR-M15-06)"), §13 SQ-M15-01 / 02 | Both docs predate M14 SRS v1.0. M14 §6.13 has now answered the requests:<br>• XR-01, 02, 03 and 08: accepted, with M15's names.<br>• XR-04: the 11-item syiling catalogue is **M14's** (DATA-M14-17). The shop source stays open with the user.<br>• XR-06: **no** budget for hadiah.<br>• XR-07: **no** dependency on the counters (BR-M14-31 counts the syiling catalogue).<br>• SQ-M15-02: answered. Token movements go to M14's internal TokenMovement log, never to the coin ledger.<br>The M15 docs still show these as open or "ownership pending". | M14 SRS §6.13, BR-M14-22, BR-M14-31, DATA-M14-17 | **solution-architect / product-analyst:**<br>• Add a status column to §6.10: XR-01/02/03/08 Accepted (M14 v1.0); XR-04 ownership decided (M14 DATA-M14-17), source open (OQ-M15-01 = M14 OQ-M14-05); XR-05 decided (see AUD-01); XR-06 No; XR-07 no dependency.<br>• §6.1: the legacy catalogue row → owner M14 DATA-M14-17.<br>• Close OQ-M15-12 and SQ-M15-02, and cite them from BR-M15-05.<br>• Refresh the "Related" rows. |
| AUD-M15-03 | Minor | SRS §7 #13 (errors), BR-M15-19, FR-M15-56, §6.10 XR-M15-02 (`debitSyiling … cabutan_ticket`) | The ticket-purchase error codes differ from the owner's contract. M15 #13 returns `404` for a draw that is not open and `409 TICKET_CAP \| INSUFFICIENT_BALANCE`. M14 BR-M14-29 `buyTicket` refuses with `DRAW_CLOSED`, `TICKET_LIMIT` and `INSUFFICIENT_BALANCE`.<br>Also, the ticket debit is made **inside** M14's `buyTicket` with the ledger description "Tiket Cabutan: {title}" (M14 PROPOSED COPY). M15 never calls `debitSyiling` for tickets, so XR-02 lists a call M15 does not make. Neither doc says that the student's M14 ledger gains that row, and AC-18.2 checks only the tile. | M14 SRS BR-M14-29, §7.1 (`draws.buyTicket`), E2E-M14-54 | **solution-architect:**<br>• #13 errors: `409 DRAW_CLOSED` (or state the mapping DRAW_CLOSED → 404), `409 TICKET_LIMIT`, `409 INSUFFICIENT_BALANCE`.<br>• Remove `debitSyiling(…cabutan_ticket)` from XR-02, or mark it "via `buyTicket`".<br>• Add to BR-M15-19 that M14 writes the `spend` row "Tiket Cabutan: {title}" (M14's copy).<br>• Optionally assert it in E2E-49 as provisional. |
| AUD-M15-04 | Minor | SRS §6.8 named queries, §7 (no repository contract for other modules), §6.10 | M14 BR-M14-16 evaluates the achievement "Ahli Kotak Misteri" as "10 M15 openings", and M14 §6.1 lists the M15 openings as a read. M15 exposes only Q-M15-OPENINGS, the viewer's **first 10** openings through #10, and no per-user count for another module. Under D12, M14 must use the owner's contract, so a named query is missing. | M14 SRS BR-M14-16, §6.1 row "HadiahReward, HadiahRedemption, MysteryBox openings — M15 — 'Ahli Kotak Misteri'" | **solution-architect:**<br>• Add the named query **Q-M15-OPENINGS-COUNT(userId)** = count(MysteryBoxOpening where userId). Its seed value is 0 for every user.<br>• Expose it in a short "Repository contract (consumers)" table: `mysteryBox.openingsCount(userId)` → M14.<br>• Route the entry to the next XL batch. |
| AUD-M15-05 | Minor | SRS §6.10 XR-M15-04; URS FN-M15-5.1.5, AC-M15-14.4 (vs M14 SRS §6.13) | The two docs describe S5 differently.<br>• **M14** says: "The prototype keeps M15 S5 on the **hadiah catalogue** (empty, as live)". That implies an activated reward would appear on S5.<br>• **M15** says S5 renders the empty state "for every account, including when rewards are active" (FR-M15-47, AC-14.4, E2E-42).<br>Both leave the source open for the user, but the prototype behaviour must be one rule. | M14 SRS §6.13 XR-M15-04 | **M15 (record) + M14 (wording), via XL batch 3:**<br>• Keep M15's BLOCKED rule. It is the conservative one and it invents no card UI.<br>• Ask M14 to reword its answer to "M15 S5 renders the observed empty state for every account until OQ-M14-05 / OQ-M15-01 is answered".<br>• Note the agreed rule in XR-04. |
| AUD-M15-06 | Minor | URS FN-M15-1.1.1, 1.1.2, 1.1.6, AC-M15-01.1; SRS FR-M15-01 / 04 | **The menu entry "Cabutan Bertuah" is described wrongly.** The docs call the "🎟️" badge "`fa-ticket`, `text-fuchsia-500`". On live, `fa-ticket text-fuchsia-500` is the **icon**. The badge is a separate pill: `bg-gradient-to-r from-fuchsia-100 to-pink-100 text-fuchsia-700 text-[10px] font-bold rounded-full` in the sidebar, `text-[9px]` in the drawer. A builder would render a fuchsia badge and an uncoloured icon.<br>**The active item drops its icon colour.** On `/cabutan` the sidebar icon is `fas fa-ticket w-5 text-center text-lg` with no colour, so the active style replaces it.<br>**The drawer colours differ from the sidebar.** Drawer "Kedai Hadiah" is `fa-gift text-pink-500`; the sidebar uses the custom class `icon-gift`, which the docs do not mention. | Live DOM, `/gamification/rewards` and `/cabutan` (1280): sidebar `<i class="fas fa-ticket … text-fuchsia-500">` + `<span class="ml-auto … from-fuchsia-100 to-pink-100 text-fuchsia-700 text-[10px] …">🎟️</span>`; on `/cabutan` the icon class has no `text-fuchsia-500`; drawer `fa-ticket … text-fuchsia-500` + badge `text-[9px]`; drawer `fa-gift … text-pink-500`; sidebar `fa-gift … icon-gift`. | **product-analyst:**<br>• State icon and badge separately, with the badge classes. The badge holds only an emoji, so DV-13 does not apply.<br>• Add "the active entry's icon loses its colour class (as live)" to FN-1.1.6.<br>• Give the drawer icon colours in FN-1.1.1 / 1.1.2.<br>• Pass the same to the shell owner through XR-M15-11. |
| AUD-M15-07 | Minor | URS FN-M15-2.6.5; SRS BR-M15-11 / 12, §7 #5 | "Pelaras Token" checks `parseInt(trimmed)` on the client but submits the **raw trimmed text** (`bulk-token-pct.value = trimmed`). So "12.7", "+50abc" and "50%" pass the client check (as 12, 50, 50) and reach the server unchanged. BR-M15-11 says the mock "re-checks the client limits and answers `422` otherwise". That leaves undefined whether these inputs, which live's client accepts, are applied or refused. The live server behaviour is UNVERIFIED, and no AC covers it. (The same applies to "Set Stok" / "Had/Bulan" with surrounding spaces, but those are trimmed and regex-checked, so they are fine.) | Live S1 script `doBulkTokenPct()`: `const num = parseInt(trimmed); if (isNaN(num) \|\| num < -90 \|\| num > 500 \|\| num === 0) {alert…}` … `document.getElementById('bulk-token-pct').value = trimmed;` | **solution-architect:**<br>• State in FN-2.6.5 that the raw trimmed text is sent.<br>• Specify the mock: `tokenCostDeltaPct` is parsed with `parseInt` semantics, like the client (integer prefix; "12.7" → 12), and is refused only outside −90…500 or at 0. Mark this PROPOSED, since the live server is UNVERIFIED.<br>• Optionally add "12.7" to AC-08.4 as provisional. |
| AUD-M15-08 | Minor | URS §9 OQ-M15-10; SRS §8.2 | The G1 list of PROPOSED items in the URS is incomplete compared with the SRS. Missing from OQ-M15-10:<br>• the mystery-box draw mechanism (BR-M15-18);<br>• one ticket per purchase (BR-M15-19);<br>• the delivery code limit of 1–100 characters and `maxlength` 100 (BR-M15-10, FR-M15-41);<br>• history capped at 10 rows (FR-M15-53);<br>• the result modal full-screen below `md` / 400 px from `md` (FR-M15-52);<br>• draw cards ordered by close date then id (FR-M15-55);<br>• "Batalkan" and "✅ Lulus" / "❌ Tolak" without a confirm (FR-M15-42, FN-8.1.4);<br>• the S7 date format "dd/mm/yyyy" and the S8 row date format (BR-M15-16);<br>• the runtime id ranges (BR-M15-14).<br>The Delivery Lead reports OQ-M15-10 at G1, so these would not reach the user. | — (internal) | **product-analyst:** Make OQ-M15-10 the complete list, the union with SRS §8.2 "Rules". Include the new hint copy from AUD-M15-01. |
| AUD-M15-I1 | Info | URS DV-M15-01, discovery §8.1 | At 768 the S2 table measures 736 px in a **680** px wrapper (the docs say 666). The S1 table is 693 px in 666 px, as the docs say. The conclusion ("Tindakan" cut off below about 800 px, fixed by in-card scroll) is unchanged. | Live, 768×1024: S1 `693 in 666 hidden`, S2 `736 in 680 hidden`; 375: S1 `693 in 308`, S2 `736 in 308` | Optionally correct the figure. |
| AUD-M15-I2 | Info | SRS XR-M15-09 | M02 v1.11 does not yet hold anchors 3151 / 3152 (TRACKER: queued for XL batch 3). When M02 applies them as students "without a school", its §6.15 student check line changes (no-school 22 → 24, and the remainder bucket drops by 2) while the 4,533 total stays. There is no id collision. | M02 SRS §6.15 B / C | Mention the bucket in XR-09 so M02 can update its check line. |
| AUD-M15-I3 | Info | URS DV-M15-10, DV-M15-15; SRS §6.8 | Confirmed read-only without reading names. The "Pelajar" cells of queue rows 2 and 3 (CelcomDigi, 04:54) are **identical**, and row 1 (Hotlink, 14:11) differs. So there are two students, and the duplicate belongs to one of them. The mapping 3151 → Hotlink and 3152 → both CelcomDigi rows is right. The rows expose no id (`<tr class>` only), so SQ-M15-03 holds. | Live `/admin/hadiah/tebusan?status=all`: equality booleans only | — |

---

## Deviation review (DV-M15-01…15)

| DV | Doc status | Audit | Reason |
|---|---|---|---|
| 01 in-card table scroll | Approved | **Agree** | Re-measured: at 375 and 768 the wrappers have `overflow: hidden` and the "Edit" and "Tindakan" columns cannot be reached, so the controls are unusable. The fix is the NFR-RESP-05 (b) in-card scroll, as in M11 / M13. |
| 02 short vs long category labels | Rejected | **Agree** | Pills and options read "📱 Telco" / "🍔 F&B"; the table reads "📱 Telco Topup" / "🍔 Makanan & Minuman" (re-read on all 59 rows). Each place is self-consistent, and both labels name the same category, so no screen states two values for one rule. Changing either would alter working copy. |
| 03 shop source | Open | **Agree (still open)** | S5 CSS re-read: `.reward-type-badge.PHYSICAL/DIGITAL/VOUCHER/EXPERIENCE/SUBSCRIPTION`, `.stock-badge.in/low/out-stock`, `.claim-btn`. The source cannot be proved read-only. M14 also leaves it open for the user. See AUD-05 for the wording. |
| 04 "Admin Tebusan" target | Approved | **Agree** | Live `Admin Tebusan → /admin/hadiah`, the same target as "Urus Hadiah". The queue has no menu entry. The label names a page the link does not open: a wrong link. |
| 05 `/cikgu/` prefix | Rejected | **Agree** | The route works (200) and is linked. A URL prefix is not visible behaviour. |
| 06 date without year | Rejected | **Agree** | Live "30/04 14:11", "30/04 04:54". The format is consistent and readable. Adding a year is new format. |
| 07 page-3 message | Approved | **Agree** | Live `?page=3`: "Showing 0 of 59 results" next to "Tiada hadiah dalam kategori ini." with "Semua" active, so the screen contradicts itself. The fix changes one phrase and keeps the empty-category case. |
| 08 405 → 404 | Approved | **Agree** | Live GET `/admin/hadiah/1` → 405, English framework page, no navigation. This follows the M08 / M10 / M13 precedent. |
| 09 Had/Bulan 0 | Rejected | **Agree** | Live source: the prompt says "0 / kosong untuk tanpa had"; the check is `trimmed !== '' && (!/^\d+$/ … > 99)`; the alert says "(0-99) atau kosong untuk ∞". No two statements contradict. Storing 0 as "no cap" is the prompt's own meaning, and it keeps the edit form's min 1 valid. |
| 10 duplicate cancelled rows | Rejected | **Agree** | These are data, not UI. Seeds mirror observation, and the duplicate is confirmed (I3). The missing guard is recorded as SEC-M15-03. |
| 11 disabled box hover | Rejected | **Agree** | The button itself is disabled with 🔒 and `not-allowed`. The hover is decorative, so this is a deliberate, consistent styling and not broken. |
| 12 header titles | Approved | **Agree** | Live header "Dashboard" / "Selamat datang, Admin" (SHA) and "Dashboard" / "Selamat datang kembali" (SHU) on every M15 page. This is shell rule DV-SH-03. |
| 13 text ≥ 12 px | Approved | **Agree** | The sweep of all visible text nodes in `<main>` on S1–S8 found exactly: "Off" 10px, "❌ Dibatalkan" 10px, the hint 10px on S3 / S4, and the ribbons 10.4px. The list is complete. |
| 14 conversion hint | Rejected (pending M14) | **Disagree — AUD-M15-01 (Major)** | See the assessment below. |
| 15 fictitious students | Decided | **Agree** | Two real students confirmed (I3). The docs contain no real name. |

### DV-M15-14 vs M14 XR-05 — assessment

**M14 is right. DV-M15-14 should become an approved minimal fix: "1 token = RM1".**

1. **The label is wrong, not a deliberate limitation.**
   - Live rate model: 50 / 40 / 30 / 20 syiling per token by tier (convert page, OBSERVED today). The admin's own tier is Gangsa, which is 50.
   - The number 100 appears in no conversion rule.
   - Syiling's cash value is 10 syiling = 8 sen, so "100 syiling = RM1" is false in both directions.
   - D9 lists "wrong labels" and "contradictory rules" as broken.
2. **The two screens describe the same exchange.** The convert page says tokens are for "tebus hadiah", and the hint sits on the field that prices those hadiah in tokens. The DV's argument ("different screen and audience; never next to a conversion figure") does not make a false statement correct. M14 fixed the analogous example label (DV-M14-05) without that argument.
3. **The owner has decided.** Under D12 the conversion rate belongs to M14. M14 SRS §6.13 calls the hint a wrong label and gives the minimal fix. The DV stated it would align once M14 decided, and "when unsure, follow live" no longer applies.
4. **The fix is minimal and safe.**
   - Only "100 syiling = " is removed.
   - "1 token = RM1" holds on every live reward (token cost = RM value on all 59) and contradicts nothing else visible.
   - Alternatives such as "50 syiling = 1 token" or a tier table would be new copy or wrong for three tiers.

---

## Coverage spot-check (30 elements, all correct)

I checked these mappings against the live DOM:
- **S1:** EL-M15-S1-001 / 002 → 2.1.1; 005–012 → 2.1.4–2.1.7; 013–022 → 2.2.1; 029 / 030 → 2.5.3; 031–036 → 2.6.1–2.6.6; 037 → 2.5.4; 038 → 2.3.1; 048–054 → 2.4.1; 057 / 058 → 2.4.3.
- **S2:** S2-001 / 002 → 4.1.1; 003 → 4.1.2; 004–008 → 4.1.3; 009 → 4.1.4.
- **S3 / S4:** S3-005 / 006 → 3.1.3; S3-013–016 → 3.1.6; S3-035–038 → 3.1.11; S4-002 → 3.2.1.
- **S5–S9:** S5-006 / 007 → 5.1.2; S6-019 / 032 / 045 / 058 → 6.1.4; S7-008 / 009 → 7.1.2; S8-006 / 007 → 8.1.2; S9-001–003 → 1.2.5.
- **Shells:** SHU-097 → 1.1.3; SHU-116 → 1.1.4; SHA-060 → 1.1.5.

## Claims verified against live (64; 2026-09-26, lane 3)

Functions covered: 1.1.1–1.1.4, 1.1.6, 1.1.7, 1.1.8, 1.2.4, 1.2.5, 2.1.1, 2.1.4–2.1.8, 2.2.1, 2.2.2, 2.3.1, 2.3.2, 2.3.4, 2.3.5, 2.4.1–2.4.3, 2.5.1–2.5.4, 2.6.1–2.6.6, 3.1.1–3.1.11, 3.1.14, 3.2.1–3.2.3, 4.1.1–4.1.5, 4.1.7 (empty copy, empty `div.mt-4`), 5.1.1–5.1.3, 5.1.5 (CSS), 6.1.1–6.1.4, 7.1.1, 7.1.2, 8.1.1–8.1.3 and 9.1.2. That is more than 60 of 108 Functions (> 25 %).

1. S1 tab "Admin — Kedai Hadiah"; h1 "🎁 Admin — Kedai Hadiah Digital"; sub "Urus catalog hadiah + proses tebusan pelajar."; header "Dashboard" / "Selamat datang, Admin".
2. Cards "TOTAL HADIAH 59 · AKTIF 0 · TEBUSAN BULAN INI 0 · PENDING PROSES 0" (upper case by CSS). The same values show at `?cat=bogus`.
3. Ten pills with `cat=all`, `flagship`, `ewallet`, `telco`, `gaming`, `streaming`, `food_beverage`, `ecommerce`, `education`, `entertainment`. "Semua" is active (`rgb(124,58,237)`); the others are `rgb(241,245,249)`.
4. Header cells: checkbox, HADIAH, KATEGORI, RM, TOKEN, STOK, TEBUSAN, STATUS, TINDAKAN.
5. **All 59 rows** (ids 1–50 on page 1, 51–59 on page 2) match SRS §6.7 and the snapshot. Every row is "Off" (`rgb(148,163,184)`, 10px) with Tebusan 0, including rewards 10 and 16.
6. Rows 1, 9, 26 and 59 match AC-04.5 exactly.
7. Pager text: "Showing 1 to 50 of 59 results 1 2"; page 2 "Showing 51 to 59 of 59 results"; page 3 "Showing 0 of 59 results" with "Tiada hadiah dalam kategori ini.".
8. `cat=telco` → ids 9–19, no pager. `cat=bogus` → "Tiada hadiah dalam kategori ini.".
9. Mobile pager at 375: "« Previous Next »".
10. `#bulk-form` POST `/admin/hadiah/bulk` with hidden `_token`, `action#bulk-action`, `stock_value#bulk-stock-value`, `max_per_month_value#bulk-max-month-value`, `token_cost_delta_pct#bulk-token-pct`.
11. `#select-all` `onchange="toggleAll(this)"`; `.row-check` `name="ids[]"` `onchange="updateBulkUI()"`; master sync `checked > 0 && checked === total`.
12. Toolbar `bg-purple-50 border-purple-300 rounded-xl … sticky top-2 z-20`, hidden by default.
13. Toolbar buttons "Aktifkan" `#10b981`, "Nyahaktifkan" `#f59e0b`, "Set Stok" `#3b82f6`, "Had/Bulan" `#8b5cf6`, "Pelaras Token" `#ec4899`, "Padam" `#dc2626`, "Batal" `#94a3b8`; each has its `onclick`.
14. The confirm texts for activate, deactivate and delete are exact.
15. The "Set Stok" prompt, its regex check (≤ 999999) and its alert are exact.
16. The "Had/Bulan" prompt, its regex check (≤ 99, 0 allowed) and its alert are exact.
17. The "Pelaras Token" prompt, the `parseInt` range check, the alert and the "Sahkan: naikkan/turunkan …" confirm are exact. The raw text is submitted (AUD-07).
18. S1 table at 375 is `693 in 308`, overflow hidden; at 768 it is `693 in 666`.
19. S2 tab "Admin — Tebusan Hadiah"; h1 "📋 Admin — Tebusan Hadiah Pelajar"; sub exact; "Kembali ke Catalog" → `/admin/hadiah`.
20. S2 pills and hrefs are exact. With no status, "⏳ Pending Admin" is active.
21. Header cells PELAJAR, HADIAH, RM, TOKEN, STATUS, TARIKH, TINDAKAN.
22. Default, `delivered` and `bogus` show "Tiada tebusan dalam status ini.". `bogus` activates no pill.
23. `cancelled` and `all`: three rows in the order Hotlink RM10 · 10 · "❌ Dibatalkan" · 30/04 14:11, then CelcomDigi RM30 · 30 · 30/04 04:54 twice. The pill is `rgb(100,116,139)` at 10px, and Tindakan is empty. "Semua" is active for `all`.
24. S2 table at 375 is `736 in 308`; at 768 it is `736 in 680` (I1).
25. S3 tab "Tambah Hadiah"; form action `/admin/hadiah`, no `novalidate`.
26. The 17 fields' names, types, required marks, min, max, maxlength and placeholders match FN-3.1.3–3.1.11.
27. Defaults: `flagship` first (not `selected`), 365, `manual`, 100, "Aktif" checked, consent unchecked.
28. Category options and delivery options are exact.
29. Hint "100 syiling = 1 token = RM1" at 10px (also on S4, and at 375 / 768).
30. S3 buttons: "➕ Tambah" (a button) and "Batal" (an `<a>`); "← Kembali ke senarai".
31. S4 `/admin/hadiah/1/edit`: h1 "✏️ Edit Hadiah: Roblox Gift Card RM10"; action `/admin/hadiah/1`; `_method=PUT`.
32. S4 values: gaming, Roblox, description "Tukar untuk Robux dalam Roblox.", 10, 10, 🎮, stock "", cap 30, 365, manual, SKU "", order 100, image "", terms "", active false, consent true.
33. `/admin/hadiah/99999/edit` and `/admin/hadiah/abc/edit` → 404, tab "404 - Halaman Tidak Dijumpai | PRESTASIPLUS", with the exact 404 copy, "Halaman Utama → /" and "Mula Latihan → /latih-tubi".
34. GET `/admin/hadiah/1` → 405, "An Error Occurred: Method Not Allowed", "Oops! An Error Occurred …", no links.
35. `/gamification/rewards/history`, `/cabutan/sejarah` and `/admin/mystery-box` → 404.
36. S5 tab "Kedai Hadiah"; h1, sub, "0" / "Baki Token 🎫", "🎁 Tiada Hadiah Tersedia", "Hadiah akan ditambah tidak lama lagi. Tunggu ya!".
37. S5 h1 is 14px at 375 and 24px at 768.
38. S5 stylesheet has the card, type-badge, stock-badge and claim-button classes (DV-03).
39. S6 tab "Kotak Misteri — PRESTASIPLUS"; hero copy and "🎫 Token Anda: 0" exact.
40. The four boxes' icon, name, description, cost, coin range and XP range are exact.
41. Ribbons RARE, EPIC, LEGENDARY (DOM lower case, `text-transform: uppercase`, 10.4px).
42. The four forms post to `/gamification/mystery-box/{1-4}/open` with `_token` only. Each button reads "🔒 Token Tidak Cukup" and is disabled.
43. No `.modal-overlay` and no `.history-card` in the markup.
44. S6 grid: 1 column (342 px) at 375, 3 at 768, 4 at 1280.
45. S7 tab "Cabutan Bertuah - PRESTASIPLUS"; h1, sub, "SYILING ANDA", "256 🪙", "Cabutan Dibuka", and the empty text with 🎈.
46. S8 tab "Kelulusan Hadiah — Ibu Bapa"; h1, sub, "⏳ Menunggu Kelulusan (0)", "Tiada tebusan menunggu kelulusan.", "📜 Sejarah Tebusan Anak", "Belum ada sejarah tebusan.".
47. S5–S8 header "Dashboard" / "Selamat datang kembali" (DV-12 evidence).
48. Sidebar order: Tukar Token, Cabaran Harian, Kedai Hadiah (`fa-gift`), Kelulusan Hadiah (`fa-shield-halved text-amber-500`), Marketplace, Papan Pendahulu, Pencapaian, Kotak Misteri (`fa-box-open text-indigo-500`), Rujuk Kawan.
49. "Admin Tebusan" (`fa-cogs text-slate-500`) → `/admin/hadiah` (DV-04 evidence).
50. "Urus Hadiah" (`fa-gift text-pink-500`) → `/admin/hadiah`, in the sidebar and the drawer.
51. Active items: "Kedai Hadiah" on S5 and "Cabutan Bertuah" on S7 carry `active`.
52. The "Cabutan Bertuah" icon and badge classes (AUD-06).
53. The drawer holds "Cabutan Bertuah", "Kedai Hadiah" and "Urus Hadiah".
54. `/gamification/convert` shows "Kadar: 50 syiling = 1 token (Gangsa)" and the tiers 50 / 40 / 30 / 20 (AUD-01).
55. The admin wallet from convert is 256 syiling / 0 token, matching S7 and S5 / S6.
56. The M15 text nodes below 12px are exactly the DV-13 list.
57. No horizontal page scroll on S1, S2, S3, S5 or S6 at 375 and 768 (`scrollWidth` ≤ viewport).
58. The S2 rows carry no redemption id (SQ-M15-03).
59. The S2 "Pelajar" cell is two lines (name and e-mail) on all three rows.
60. Rows 2 and 3 have the same student and row 1 a different one (I3).
61. S3 labels are upper case by CSS ("KATEGORI *", "STOK (KOSONG = TANPA HAD)", "SAH HARI (DEFAULT 365)", "VENDOR SKU (OPTIONAL)"), while the checkbox labels "Aktif" and "Perlu kelulusan ibu bapa" are not.
62. The S3 h1 is 20px and the S6 h1 is 17.6px. Both are above 12px, so there is no DV impact.
63. The S1 cards are unaffected by `page` (same values on page 2 / 3).
64. The S2 empty paginator slot `<div class="mt-4"></div>` is present (SQ-M15-04 evidence).

## Checks with no finding

- **Seeds mirror observation.** All 59 rewards × 24 fields, the 3 redemptions, the 4 boxes, 0 openings, 0 draws and the wallet 256 / 0 / 8 match. There are no tuned values, and the redemption ids 1–3 are labelled fictitious.
- **Every count is a named query.** The S1 cards, the Tebusan column, the pager totals, the S2 lists, the S8 "(n)" and history, the S6 history and the S7 open draws all map to Q-M15-*, and "No display constant is used" is true. The one gap is the missing consumer query of AUD-04.
- **D9 fixes are minimal** (DV-01, 04, 07, 08, 12, 13; see the review). **D10 is respected**: native dialogs and bubbles, no added ARIA, unlabelled checkboxes, and no new controls on observed screens.
- **Unobserved behaviour is not written as fact.** Every populated state is tagged INFERRED / PROPOSED / SOURCE-DERIVED and provisional, and the mystery-box odds are explicitly UNVERIFIED. One exception is the §1 overview's rate sentence (AUD-01).
- **Responsive behaviour** is specified at 375 / 768 / 1280 for S1–S8 and the 404 page (SRS §10, URS §5), and the E2E suite runs at all three widths.
- **The SEC items are adequate.** The 10 items cover voucher-code custody, client-only bulk checks, stock and cap races with double submission, consent bypass and IDOR on approve / reject, token debit and refund integrity, randomised paid rewards and draws for minors, minors' personal data, `image_url` schemes and the framework error page.
- **Cross-module contracts** (wallet and ledger names, draw store field names, M02 links, M01 landing `/dashboard` and 404) agree, apart from AUD-02 to AUD-05.

## Privacy check

- **Docs versus live names.** The words of the three live "Pelajar" cells (name and e-mail, including the Cloudflare `data-cfemail` payload) were hashed in the browser with a salt and SHA-256. Only the hashes left the page, and they were compared with every word of the URS, the SRS, the discovery narrative, the snapshot and the M14 SRS.
  - Result: one 4-letter hit, the English word "long" ("long label"), which is a false positive. No other token matched.
  - The docs name only the fictitious 3151 / 3152 and the canonical accounts.
- **Clean-up.** No screenshot or unmasked dump was written. The lane-3 console log holds only resource errors. The scratch scripts in `<scratchpad>/m15-audit/` were deleted after the run.

---

# Round 2 (targeted re-audit of URS/SRS v1.1, 2026-09-26)

| Field | Value |
|---|---|
| Documents audited | `docs/requirements/urs/M15-rewards-shop.md` v1.1 (1,464 lines), `docs/requirements/srs/M15-rewards-shop.md` v1.1 (649 lines) |
| Method | Each round-1 fix was checked at the cited lines. Coverage and traceability were re-run by script (`<scratchpad>/m15-audit-r2/check.cjs`, deleted afterwards). A regression grep covered every place that quotes the rate or hint, the ticket codes, `debitSyiling`, `Q-M15-OPENINGS-COUNT` / `openingsCount`, the icon classes and the stale "no SRS yet" / "ownership pending" / "pending M14" wording. <br>One live check was made for AUD-06, because the active-icon rule needed confirming on all four user pages: <br>• lane 3, admin, read-only; <br>• a context-level guard aborted every non-GET request except the login POST; only Cloudflare RUM beacons were aborted; <br>• page loads were spaced at 450 ms or more; <br>• no personal data was read, and the console log holds only resource and service-worker lines. |

## Verdict round 2: **PASS**

| Severity | Count |
|---|---|
| Critical | 0 |
| Major | 0 |
| Minor | 2 (new, from the edits; neither blocks G1) |
| Info | 1 |

- All 8 round-1 findings are fixed, and so are I1 and I2.
- **Coverage re-run.** There are 829 inventory elements and 829 matrix rows: 265 mapped and 564 excluded, with 0 duplicates, 0 unmapped, 0 extras and 0 references to unknown Functions. M15 content is still 250/250 (238 mapped + 12 banner exclusions).
- **Trace re-run.** Counts: 108 FN, 87 AC (34 provisional), 66 FR and 57 E2E (25 provisional). **0 errors**:
  - every FN has an FR;
  - every AC has an FR and an E2E;
  - every FR has an E2E;
  - every E2E's FR list covers its ACs;
  - the provisional marks agree both ways;
  - the raw row counts equal the parsed counts, so no row is broken by an unescaped `|`.

## Round-1 findings: status

| Finding | Status | Evidence (v1.1) |
|---|---|---|
| AUD-M15-01 (Major) DV-14 hint | **Fixed** | URS DV-M15-14 (L1426) is "Approved (D9)". It keeps the live text, the tier rates 50/40/30/20, the cash rate RM0.80, M14's decision, the DV-M14-05 precedent and the alternatives a/b/c. The hint "1 token = RM1" appears in FN-3.1.6 (L174, 12px), AC-09.1 (L384), AC-21.4 (L453), OQ-10 (L1462) and SRS §0.1 (L25), §6.10 XR-05 (L436), §8.2 (L495) and E2E-27 (L606, "no '100 syiling'"). The §1 overview (L35) now reads "1 token = RM1 on every live reward; syiling become tokens at M14's tier rates", which is correct. **Regression grep:** "100 syiling" survives only as the recorded live text: DV-13 (L1425, marked "text replaced by DV-M15-14"), DV-14, the inventory rows EL-S3-015 / EL-S4-016 (L596, L642, live element text, which is correct), XR-05 and §8.2 "live …". No place asserts it as the rebuild copy. |
| AUD-M15-02 M14 status | **Fixed** | URS "Related" (L14) summarises M14 §6.13. OQ-11 (L1463) gives the per-XR status, and OQ-12 (L1464) is CLOSED. In the SRS: <br>• §6.1 names GamificationReward as M14 DATA-M14-17 (L227) and TokenMovement as M14 DATA-M14-21 (L228). Both ids were checked against M14 SRS L390/L393. <br>• §6.10 has a new status column (L433–443), and BR-M15-05 (L165) cites the closed budget question. <br>• SQ-01 (L646) has been narrowed, and SQ-02 (L647) is CLOSED. <br>• The phrases "no URS/SRS yet", "no SRS yet" and "ownership pending" no longer appear. |
| AUD-M15-03 ticket codes | **Fixed** (see R2-01) | SRS #13 (L465) returns `409 DRAW_CLOSED` (missing or not open), `TICKET_LIMIT` or `INSUFFICIENT_BALANCE`, the M14 BR-M14-29 codes. BR-M15-19 (L179) has M14 `buyTicket` debit the syiling and write "Tiket Cabutan: {title}", with no M15 wallet call. FR-56 (L115) matches. E2E-49 (L628) asserts the ledger `spend` row −50 and the three codes. XR-02 (L433) no longer lists `debitSyiling`. `TICKET_CAP` appears nowhere. |
| AUD-M15-04 openings count | **Fixed** | Q-M15-OPENINGS-COUNT (L401) is a named query with seed 0. A repository contract table (L410) offers `mysteryBox.openingsCount(userId)` to M14 (BR-M14-16), and XR-M15-12 (L443) routes it to XL batch 3. There are no other references, so no stale ones. |
| AUD-M15-05 S5 rule | **Fixed** (recorded) | URS OQ-01 (L1453) states the agreed rule: S5 shows the empty state for every account. M14's wording is to be aligned at XL batch 3, where SRS XR-04 (L435) and SQ-01 (L646) also list it. The M14 SRS still carries the old wording, so the action stays with the Delivery Lead at XL batch 3, as planned. |
| AUD-M15-06 menu classes | **Fixed** (see R2-02) | <br>• FN-1.1.1 (L81) separates the icon `fa-ticket text-fuchsia-500` from the gradient badge pill (`text-[10px]` in the sidebar, `text-[9px]` in the drawer, no DV-13 because it holds only an emoji). <br>• FN-1.1.2 (L82) gives the sidebar `icon-gift` and the drawer `text-pink-500`. <br>• FN-1.1.6 (L86) states the active icon rule. <br>• AC-01.1 (L329) and AC-01.5 (L333) are updated, and so are SRS FR-01 (L60), FR-04 (L63), E2E-01 (L580) and E2E-03 (L582). <br>Re-checked live on S5–S8. |
| AUD-M15-07 raw "Pelaras Token" text | **Fixed** | FN-2.6.5 (L159) says the raw trimmed text is sent ("12.7", "+50abc", "50%" pass as 12, 50, 50) and that the mock parses it with `parseInt`, marked PROPOSED with the live server UNVERIFIED. BR-M15-11 (L171), BR-M15-12 (L172) and FR-29 (L88) agree. The new AC-08.5 (L381) and E2E-26 (L605) cases are correct: reward 4 costs 5 tokens, +12 % gives round(5.6) = 6, and `lastRequest` carries "12.7". |
| AUD-M15-08 PROPOSED list | **Fixed** | OQ-10 (L1462) is now "complete; = SRS §8.2" and contains every item round 1 listed as missing, plus the new hint. SRS §8.2 (L493–505) matches item for item (hint, no-confirm buttons, `maxlength` 100, modal layout, 10-row cap, draw order, date formats, runtime ids, raw-text parse). |
| I1 S2 width at 768 | **Fixed** | DV-M15-01 (L1413): "S1 693 in 666, S2 736 in 680". |
| I2 XR-09 bucket | **Fixed** | SRS XR-09 (L440): no-school students 22 → 24, the remainder bucket −2, and the 4,533 total unchanged. It is queued for XL batch 3. |
| I3 | — | Information only; no action needed. |

**Deviation totals after v1.1** (URS change log L20, SRS §0.1 L25): 7 approved fixes (01, 04, 07, 08, 12, 13, 14), 6 rejected (02, 05, 06, 09, 10, 11), 1 privacy (15) and 1 open (03), 15 in all. The totals agree between the two documents.

## New findings (round 2)

| ID | Severity | Doc & section | Issue | Evidence | Required fix (owner) |
|---|---|---|---|---|---|
| AUD-M15-R2-01 | Minor | SRS §6.10 XR-M15-03 (L434) | This is a stale cross-reference left by the AUD-03 edit. XR-03 still says `buyTicket(drawId, userId)` "(checks open, cap, balance; **debits via XR-02**)". XR-02 (L433) no longer contains a syiling debit for tickets and now says "Tickets need no M15 wallet call: M14 `draws.buyTicket` debits the syiling itself". The two rows point at each other with contradicting wording. | SRS L433 and L434; M14 BR-M14-29 | **solution-architect:** in XR-03, replace "debits via XR-02" with "debits the syiling itself and writes the ledger row 'Tiket Cabutan: {title}' (M14 BR-M14-29)". |
| AUD-M15-R2-02 | Minor | URS FN-M15-1.1.6 (L86), AC-M15-01.5 (L333); SRS FR-M15-04 (L63), E2E-03 (L582) | The active-icon rule is stated without scope ("the active entry's icon loses its colour class"). Live shows it applies to the **sidebar only**, and it also drops the custom `icon-gift` class. The **mobile drawer keeps the colour on the active entry**: on S5 the drawer "Kedai Hadiah [active]" is `fa-gift text-pink-500`; on S6 the drawer "Kotak Misteri [active]" is `text-indigo-500`; on S7 the drawer "Cabutan Bertuah [active]" is `text-fuchsia-500`. E2E-03 already expects this at 375 (Kedai Hadiah pink-500), but FR-04 read literally would strip it. | Live 2026-09-26, lane 3, 1280 DOM of both menus. Sidebar active icons: S5 `fa-gift` (no `icon-gift`), S6 `fa-box-open` (no `text-indigo-500`), S7 `fa-ticket` (no `text-fuchsia-500`), S8 `fa-shield-halved` (no `text-amber-500`). Drawer active icons keep `text-pink-500` / `text-indigo-500` / `text-fuchsia-500`. | **product-analyst:** FN-1.1.6 and FR-04: "In the **sidebar** the active entry's icon loses its colour class (for 'Kedai Hadiah' also `icon-gift`), as live on S5–S8; in the mobile drawer the active entry keeps its icon colour." Optionally assert the S6 drawer case in E2E-03. |
| AUD-M15-R2-I1 | Info | SRS #13 (L465) | A **missing** draw id now returns `409 DRAW_CLOSED` instead of `404`. That is acceptable, because the row states it and it follows the owner's code set. It only matters if the shared error convention requires 404 for an unknown id. The Delivery Lead may keep it as written. | — | None required. |

## Regression checks (no finding)

- **Rate and hint quotes.** Every "100 syiling" occurrence is marked as live text (L596, L642 inventory, DV-13, DV-14, XR-05, §8.2). §1, FN-3.1.6, AC-09.1, AC-21.4, E2E-27 and §8.2 use "1 token = RM1". AC-21.4 and E2E-55 still include the hint in the ≥ 12 px check.
- **Ticket codes.** `TICKET_CAP` has 0 hits. `DRAW_CLOSED` and `TICKET_LIMIT` appear only in BR-19, #13 and E2E-49, which are consistent with M14 BR-M14-29 and E2E-M14-54.
- **Openings count.** `Q-M15-OPENINGS-COUNT` and `openingsCount` appear only in §6.8, the contract table and XR-12 (plus the change log). There is no dangling reference, and "No display constant is used" still holds.
- **Unchanged content.** The seeds, the fixtures (`queue`, `draw`) and every AC value from round 1 are unchanged. The trace and matrix scripts confirm the IDs are intact.
- **Privacy.** No personal name was added. v1.1 contains only the fictitious 3151/3152 and the canonical accounts.

Round-2 result: **PASS**. The two Minor items (R2-01, R2-02) can be fixed in a v1.2 edit without another audit round.
