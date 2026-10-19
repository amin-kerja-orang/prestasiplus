# M19 — Finance & Subscriptions (payments, payment detail and status edit, billing dashboard, dunning log, pricing, invoice history) — Independent Audit (AUD, round 1)

| Field | Value |
|---|---|
| Documents audited | `docs/requirements/urs/M19-finance.md` v1.0 (81 FN, 21 US, 83 AC, 16 DV, coverage matrix 983 rows), `docs/requirements/srs/M19-finance.md` v1.0 (61 FR, 20 BR, 7 V, 17 endpoints, 79 E2E, 10 SEC, 10 XR, §6.9 reconciliation R01–R22) |
| Evidence | Discovery `M19-finance.md`; `inventory/M19/*.json` (+ `_summary.md`, `_crawl.json`, `_snapshot-2026-09-27.json`); `img/M19/` (index only). Live re-walk on 2026-09-27 between about 05:19 and 05:45 MYT on browser lane 2 (`playwright2`) with the admin account, read-only. |
| Screens re-opened live | S1 (default, page 3, 9 filter / edge states), S2 (#65, #64, #25 and 55 more detail pages for the bill-code shape), S3 (#65, #64), S4 (375 / 768 / 1280), S5 (default + 10 filter / edge states), S6 (375 / 768 / 1280 + all 5 FAQ answers, one-open rule), S7 (1280), `/admin/payments/create`, `/admin/payments/99999999`, `/admin/payments/99999999/edit`, `/admin/payments/abc`, 5 of the 12 probed 404 routes, SHA "Kewangan" group, SHU account-menu entries. |
| Safety | A context-level route guard was installed before the login. It let through only GET requests and the one `POST /login`, and also aborted any payment-gateway or WhatsApp host, `/admin/export/*`, `*.pdf` and `/subscribe/*`. Verified by probes: `POST`, `DELETE` and `PUT /__m19_probe` were all blocked (before the first login and again before the re-login after the session expired). Nothing was submitted, saved, deleted, exported, downloaded or paid. No "Langgan", "Simpan", "Padam", "Padam Dipilih", PDF or WhatsApp link was clicked. The only client-side interactions were the S6 FAQ buttons. Page loads were ≥ 400 ms apart. No screenshot was taken. The browser was closed at the end. |
| Privacy | Payer names, e-mails and the random part of bill codes were never extracted into any file. Bill codes were reduced to their shape (digits → 9, letters → a/A); only the fixed prefix and the numeric user-id segment were kept. The lane-2 console log of this session was deleted. A grep of the URS, SRS, discovery and inventory for the payer names seen live finds 0 hits. No name, e-mail, phone number or IC appears in this report. |
| Cross-module docs | M02 SRS **v1.21** (the file on disk is already v1.21: DV-M02-15, BR-24 "active and inactive", §6.14 subscriptions, §6.15 anchors), M05 v1.16 BR-07, M09 anchors 3101–3109, M16 anchors 4301–4358, M17 BR-M17-03 / BR-M17-24 / Q-M17-SUBSCRIBED |
| Auditor | Independent audit agent (not an author) |
| Scripts | `<scratchpad>/m19-audit/cov.cjs` (coverage matrix against the inventory), `trace.cjs` (FN → FR → AC → E2E, provisional list, §3.1 table) |

## Verdict: **FAIL**

| Severity | Count |
|---|---|
| Critical | 0 |
| Major | 1 |
| Minor | 9 |
| Nit | 3 |
| Info | 2 |

What is good:
- **Coverage is complete (script re-run).**
  - All 983 inventory elements are in the matrix (395 content + 214 SHA + 374 SHU): 389 mapped, 594 excluded.
  - The 6 content exclusions are the M16 banner triplets S6-001…003 and S7-001…003.
  - There are no duplicates, no unknown ids, and no bad FN references. The kind and status match the inventory on every row.
  - Every quoted text matches the inventory, apart from 4 rows where `\"` is escaped inside the quote.
  - 45 of the 81 FNs appear in the matrix.
- **Traceability is clean (script).**
  - Counts: 81 FN, 21 US, 83 AC, 61 FR and 79 E2E.
  - Nothing is missing: every FN has an FR, every AC has an FR and an E2E, and every FR has an E2E.
  - There are no bad references, and each E2E's ACs belong to its FRs.
  - The 26 provisional E2E are exactly the §12 list. The §3.1 table is incomplete (see AUD-M19-12).
- **Live figures are exact, and unchanged since discovery.** Each of the following was re-checked live:
  - **S1 cards and filters.**
    - Cards: 59 / 8 / 51 / 0 / RM240.00, the same in every filter and page state.
    - Filter results: paid 8 (ids 65, 57, 40, 35, 32, 31, 25, 20), pending "Showing 1 to 20 of 51 results", personal 8, paid + personal = #65 and #25.
    - These return the empty state: failed, bizappay, pksk, `status=bogus` and `page=99`. "Reset" is shown only while a filter is set; it is absent on `page=99`.
  - **S1 list.**
    - Page 1 lists ids 65 → 46, and page 3 lists 25 … 15, 12, 14, 13, 11, 10, 9, 8, 7.
    - Every row's Pakej / Gateway / Jumlah / Status / Tarikh cell matches SRS §6.11 A. Dates are zero-padded ("01 Jul", "08 May"), which confirms BR-M19-19 "dd MMM".
  - **S2 and S3.**
    - #65, #64 and #25: banners, amounts, "Dibayar pada …" and "Tarikh Dicipta" are as in AC-10.1–10.3. "Gateway Ref" is "—" on all 58 detail pages opened.
    - The S3 radio set and the note text are as specified.
    - Tab titles and headers are as in §1.
  - **S4.**
    - Cards 9 / 94 / 0 / RM90.00 "September 2026", and the single package tile 9 "Pakej SPM Tingkatan 5".
    - All 20 recent rows match (date, amount, "Berjaya" / "Menunggu"). "Jenis" reads "Regular" on all 20, including #65, which confirms DV-M19-04's evidence.
    - Grid columns are 1 / 2 / 4. The table is 705 px and scrolls in cards of 318 / 667 px, and fits at 1280.
  - **S5.**
    - Cards 21 / 0 / 7 / 0; 21 rows, the first "#23 Individual 5600 1 Hari 21 Jul 2026 08:00" and the last "#3 School 4 7 Hari 15 May 2026 08:00".
    - Filters: school 3, individual 18, and 7 each for 7d / 3d / 1d. These show "📭 Tiada log dunning dijumpai.": expired, grace_start, grace_end and `type=bogus`.
    - `?page=2` gives "Showing 0 of 21 results 1". "Sub ID" is never a link.
    - The header is the wrong "Dashboard / Selamat datang, Admin", which confirms DV-M19-02.
  - **S6.**
    - Every card, feature line, hint, level, school tile, comparison cell (✓ / ✗ as FN-5.1.9) and pill string matches FN-5.1.1–5.1.10.
    - The forms are `POST /subscribe/regular billing=monthly` and `/subscribe/personal` with `monthly` or `onetime`.
    - All 5 FAQ answers match verbatim, and only one answer is open at a time: opening 4 closes 1, and a second click closes it.
    - H1 is 20 / 30 / 30 px. The grids are 1-1-1 / 2-3-2 / 4-3-4, and the comparison table is 394 px inside 340 px at 375.
    - The header shows "Dashboard / Selamat datang kembali", which confirms DV-M19-03.
  - **S7.** Every string and both `/pricing` links match.
  - **Menus and errors.**
    - SHA "Kewangan" holds "Pembayaran", "Billing Dashboard" and "Dunning Log", and the SHU menu holds "Pakej 💎", "Invois Saya" and "Billing Dashboard".
    - `/admin/payments/create` returns 500 "Ralat Pelayan". `/99999999` and `/99999999/edit` return 404, and so do `/admin/subscriptions`, `/billing`, `/billing/invoices/1`, `/pakej` and `/admin/invoices`.
    - No horizontal page scroll was found at 375, 768 or 1280 (S1, S4 and S6 measured).
- **Dunning ↔ payments inference is now confirmed.** The live bill code of each paid monthly payment carries the payer's user id (AUD-M19-01). #20 → 4373, #31 → 5450, #32 → 5451, #35 → 3614, #40 → 5475 and #57 → 5600 are exactly the six individual "Sub ID" chains. So FN-M19-4.2.2 / BR-M19-11 "Sub ID = payer user id" is observed, not only inferred, and OQ-M19-06 can be closed.
- **Deviations DV-M19-01…16 apply D9 correctly.**
  - **Approved:**
    - 01 (500 → 404), 02 / 03 (wrong headers) and 04 (a one-cell fix: only #65 differs, re-checked live) are sound.
    - 06 (< 12 px → 12 px) follows the precedents. Its evidence list is inaccurate; see AUD-M19-05.
    - 07 (405 → 404, a DL decision), 09 (privacy) and 10 (D4) are sound.
  - **Rejected, correctly:** 05, 08, 11, 12, 13 and 15 are consistent live behaviour, and the reasoning is sound.
  - **Display constant:** 14 → DC-M19-01 is D11-compliant. 94 is shown only on S4, and no screen of any module shows a count of individually subscribed users. M17 BR-M17-24 is a per-user chip, and M17 Q-M17-SUBSCRIBED counts schools.
  - **Referred:** 16 was applied by M02 (FR-M02-40 "RM200").
- **Seeds mirror observation.**
  - Every one of the 59 payments (type, billing, amount, status, created time, paid minute) and the 21 dunning rows equals live.
  - No record is invented. Payers are fictitious ("Pembayar Demo NN"), as the privacy rule requires.
  - The only non-observed values are the bill codes (AUD-M19-01) and the payer ids (AUD-M19-02).
- **D12 ownership is respected.**
  - M19 owns Payment, DunningLog, PricingPlan, PkskPackage and the Invoice read model.
  - `SchoolSubscription` / `SchoolPackage` and the user package fields are read or written only through M02 contracts (XR-M19-01/02/04).
  - The M14 / M15 boundary is stated (BR-M19-18, XR-M19-07).
- **Responsive and accessibility.**
  - Every E2E runs at 375 / 768 / 1280.
  - SRS §10 matches the live measurements.
  - NFR-M19-04 replicates live accessibility (D10), with one exception: `rel` (AUD-M19-06).

Why it fails (1 Major):
1. The payment bill-code and gateway-bill-code formats in the seed, the ACs and BR-M19-12 are invented (`PP{yyyymmdd}{id4}`, `sim` + 5). The live format is observable and structured: `JB-{REGULAR|PERSONAL}-{MON|ONE}-{userId}-{8 alphanumerics}`, and the gateway bill code is 8 lowercase alphanumerics. It is a visible field on S2 (and S3), so the rebuild must replicate its shape, with a fictitious random part (AUD-M19-01).

---

## Findings

| ID | Severity | Doc & section | Issue | Live / doc evidence | Owner | Required fix |
|---|---|---|---|---|---|---|
| AUD-M19-01 | **Major** | SRS BR-M19-12 (l.167), §6.2 `billCode` / `gatewayBillCode` (l.218–219), §6.11 A (l.375–435, 59 codes), §8.2 "Codes" (l.563), NFR-M19-02; URS §0 privacy bullet (l.26), AC-M19-07.4 (l.323), AC-M19-10.1 (l.340), OQ-M19-11 (l.1546); E2E-M19-27, 38 | **The code format is invented, and the observable live format is ignored.** Discovery kept only presence flags, and the docs then designed a new format marked "fictitious format, PROPOSED". Live S2 "Bill Code" has a fixed structure on all 58 detail pages opened: `JB-` + type (`REGULAR` / `PERSONAL`) + `-` + billing (`MON` / `ONE`) + `-` + the payer's user id + `-` + 8 mixed-case alphanumerics. For example, the shapes are #65 `JB-PERSONAL-MON-5600-Aa99aaaa`, #25 `JB-PERSONAL-ONE-4382-AAAAAA9a` and #7 `JB-REGULAR-MON-3101-9aaAA9AA`. "Gateway Bill Code" is 8 lowercase alphanumerics (for example `aaa9a9a9`, `99aaaaaa`). Both are monospace. The shape is a visible, working live feature, so D7 / D9 requires replicating it. Privacy requires only that the **random** part is fictitious. | Live `/admin/payments/{7…65}` read 2026-09-27 (shapes only; random parts never stored). | M19 solution-architect + product-analyst | <br>• Define `billCode = "JB-" + upper(type) + "-" + (billing = monthly ? "MON" : "ONE") + "-" + userId + "-" + 8 PRNG alphanumerics (mixed case)` and `gatewayBillCode` = 8 PRNG lowercase alphanumerics. Mark the structure OBSERVED and the random parts fictitious. <br>• Regenerate the 59 seed codes (§6.11 A), BR-12, §6.2, §8.2, the URS privacy bullet and OQ-11. <br>• Update AC-07.4 / AC-10.1, E2E-27 / 38 (for example, search by "JB-PERSONAL-MON-5600-…"). <br>• Record the format in discovery §2.2 as an observation. |
| AUD-M19-02 | Minor | SRS §6.10 payer table (l.335–368), XR-M19-02 (l.476); URS §0 l.28, FN-M19-4.2.2 (l.198), OQ-M19-06 (l.1541); AC-03.4 / 07.4 / 18.3 / 19.x ("payer 3318", "payer 3301") | **Payer user ids are observable.** The bill code gives every payer's live id. The 24 payers the SRS places at 3301–3324 are live: #7/8 3101, #9 2370, #10/11/36 3108, #12 4220, #13 4230, #14/15 4221, #17/18 4321, #21–25 4382, #26 5436, #27–29 5440, #30 5441, #33 4275, #34/41 5456, #37/38 5530, #42/45 5542, #43/44 5547, #46–49 5550, #50/51 5563, #52/53 5532, #54/55 5426, #56 5605, #58 5612, #59/60 5613 and #61 5593. The six chain ids are confirmed. The payer grouping (30 payers) in §6.10 is correct. <br>Mirroring the ids exactly collides with existing anchors: 3101 and 3108 are M09 fixtures (3101–3109), 4321 is an M16 / M02 anchor (a primary pupil of 2710), and 5605 is an M02 fixture (5601–5605). So this needs an owner decision, not a silent choice. <br>FN-4.2.2 still says "INFERRED" and OQ-06 is still open, although the ids are now proven. | Live S2 bill codes (user-id segment only). | M19 solution-architect; M02 at the XL gate | <br>• Mark FN-4.2.2 / BR-11 "Sub ID = payer user id" as OBSERVED (bill-code evidence) and close OQ-06. <br>• Either adopt the live ids for the payers whose id is free (and list the 4 collisions with a documented substitute), or keep 3301–3324 and record in §6.10 that live ids differ, with the reason (collisions). Either way the bill code must embed the seed's user id (AUD-01). |
| AUD-M19-03 | Minor | URS FN-M19-1.2.4 (l.97, "unknown or non-numeric `{id}` … OBSERVED"), AC-M19-04.1 (l.303), §7 DV-M19-01 (l.1491); SRS FR-M19-10, E2E-M19-13 (l.658) | **`/admin/payments/abc` answers HTTP 500 on live, not 404.** It shows "500 - Ralat Pelayan \| PRESTASIPLUS", the same page as `/create`. The docs state 404 for non-numeric ids as observed, which makes this an unlisted deviation (D7). The 404 fix itself is the right D9 choice (broken route, DV-01 precedent). | Live `/admin/payments/abc` → 500 (2026-09-27). | M19 product-analyst | Extend DV-M19-01 to "`/admin/payments/create` **and any non-numeric id** → 500 on live → global 404". Label the non-numeric case in FN-1.2.4 as DV-01, not OBSERVED. |
| AUD-M19-04 | Minor | URS FN-M19-2.3.1, 2.5.3, 2.6.2 (l.162), 2.6.3, 3.1.7 (l.178), 4.1.4, 5.1.3–5.1.6; AC-M19-11.1 (l.347), AC-M19-13.1 (l.360), DV-M19-04 (l.1494); SRS FR-M19-39, BR-M19-09, E2E-M19-42, 50 | **CSS text transforms are not specified, and three ACs assert the wrong displayed string.** Live computed styles: <br>• S3 summary shows "**Personal · Toyyibpay**" / "Regular · Toyyibpay" (capitalised), but AC-11.1 expects "personal · toyyibpay". <br>• S4 "Jenis" badge shows "**Regular**" (capitalised), so DV-04's fixed cell will read "Personal", but AC-13.1 / E2E-50 / DV-04 expect "personal" / "regular". <br>• `text-transform: uppercase` is used on every table header (S1, S4, S5, for example "PELAJAR", "SUB ID"), on the S2 field labels ("BILL CODE", "TARIKH DICIPTA"), on S3 "STATUS PEMBAYARAN", and on the S6 sub-labels and ribbons ("LANGGANAN BULANAN", "PER SESI PEMBELAJARAN", "SESI PERSEKOLAHAN", "VIA PPD", "POPULAR", "TERBAIK NILAI"). <br>The URS convention (l.23) promises "Where CSS capitalises a text this is stated", but it is stated only for S2 values. | Live `getComputedStyle(...).textTransform` on S1 / S2 / S3 / S4 / S5 / S6. | M19 product-analyst | State the transform per element (DOM text kept as quoted; displayed upper-case or capitalised). Fix AC-11.1 ("Personal · Toyyibpay" as displayed), AC-13.1 / E2E-50 and DV-04 (displayed "Personal" on #65, "Regular" on the rest). |
| AUD-M19-05 | Minor | URS FN-M19-1.3.4 (l.108), DV-M19-06 (l.1496), AC-M19-05.4 (l.312); SRS FR-M19-16, E2E-M19-20, §10 | **The DV-06 evidence list is inaccurate, and the AC does not cover everything FR-16 requires.** <br>• **S1:** the row **e-mail line is 12 px**, not 10 px. The 40 sub-10-px texts are the 20 "Monthly" / "Onetime" lines and the 20 times, and they are 10 px at **all three widths**, not only at 375. <br>• **S6:** the 11 texts at 10 px (every width) are 3 hints + "Minima 100 pelajar …" + 4 tile captions + **3 ribbons ("Via PPD", "Popular", "Terbaik Nilai")**. The docs call them "hints and school-tile captions". <br>AC-05.4 / E2E-20 test only the listed items at 375, so the ribbons and the 768 / 1280 sub-lines could stay at 10 px while FR-16 says no text is below 12 px. | Live font scan S1 / S4 / S6 at 375 / 768 / 1280 (S4 has no text < 12 px). | M19 product-analyst | Correct the DV-06 / FN-1.3.4 evidence (drop "e-mail", add the ribbons, "all widths"). Make AC-05.4 / E2E-20 assert ≥ 12 px for every listed text at all three widths. |
| AUD-M19-06 | Minor | SRS FR-M19-47 (l.107), SEC-M19-09 (l.633), E2E-M19-61 (l.706); URS DV-M19-09 (l.1499) | **The `rel` attribute is an unlisted change.** Live has `target="_blank"` with **no `rel`** on both WhatsApp links. The SRS requires `rel="noopener noreferrer"` and E2E-61 asserts it, while DV-09 says "new-tab behaviour unchanged". The change is invisible and defensible as security hardening (modern browsers imply `noopener`), but it is not in the deviation table. | Live S6 `a[href*="wa.me"]` attributes. | M19 product-analyst | Either add it to DV-09 (or a new DV) as a security-only, invisible change approved under SEC-09, or drop it from FR-47 / E2E-61. |
| AUD-M19-07 | Minor | URS FN-M19-2.6.2 (l.162), AC-M19-11.1; SRS §8.1 S3 | **The S3 summary card also shows the bill code** (monospace line under the payer, EL-M19-S3-009, masked in the inventory). FN-2.6.2 lists only "payer name and e-mail, amount, {type} · {gateway}", so the element is mapped but its content is not specified. | Live `/admin/payments/65/edit`, `/64/edit`; inventory S3-006…009. | M19 product-analyst | Add "bill code (monospace)" to FN-2.6.2, AC-11.1 and §8.1 S3, with the AUD-01 format. |
| AUD-M19-08 | Minor | SRS BR-M19-14 (l.169), XR-M19-04 (l.478), §6.10 (5600 `personal` until 13 Oct); M02 FR-M02-40 label | **The `personal` expiry rule contradicts itself.** Activation gives `personal` · `monthly` payers the package `personal` with expiry +1 month (payer 5600 → 2026-10-13). XR-04 tells M02 that `computeExpiry` gives `personal` → next 10 January. M02 S3 labels `personal` "Personal Per Sesi — RM200 (hingga 10 Jan)". So an admin opening payer 5600 on M02 S3 would see "(hingga 10 Jan)" against a 13 Oct expiry, which is a new visible contradiction created by a PROPOSED rule. | SRS l.169, l.478; M02 SRS l.138. | M19 solution-architect (with M02) | <br>• Make `computeExpiry(package, billing, from)` depend on `billing`, and state which one M02 S3 uses when only the package is set (there is no billing on that form). <br>• Or record the label clash as a known consequence (M02 copy is observed) and list it in §8.2 / OQ-11. <br>• Mark the whole rule INFERRED / PROPOSED consistently. |
| AUD-M19-09 | Minor | SRS BR-M19-03 (l.158) source "OBSERVED"; URS FN-M19-5.2.1 | **Unobserved behaviour is labelled OBSERVED.** "New `personal` · `onetime` payment = 200.00" is not observed: every observed onetime payment is RM90.00, and none has been created since the price shown became RM200. The S6 price is observed; the charged amount is INFERRED. FN-5.2.1 correctly says INFERRED, so the SRS disagrees with the URS. | Snapshot / live S1: 7 onetime rows, all RM90.00. | M19 product-analyst | Label BR-03 "OBSERVED (displayed prices, historical amounts) / INFERRED (charged amount of new payments = displayed price)". |
| AUD-M19-10 | Minor | URS §0 "Related" (l.14), §7.1 (l.1512); SRS §0 "Related" (l.14), XR-M19-02 (l.476) | **M02 dependency is stale (v1.20 cited; M02 is now v1.21).** <br>• **Dependency analysis:** M19 does **not** read BR-24 `used` or the 3,152 / 4,092 figures. S4 reads subscription `status` / `schoolPackageId`, and S5 reads `endsAt` of id 4. Those are unchanged in v1.21 §6.14, so no M19 figure depends on the BR-24 resolution. <br>• **What does depend on it:** XR-M19-02 (placing 30 active payer students). Under v1.21 DV-M02-15, per-school counts include every student, active or not, and the platform pins are 3,152 active / 1,708 logged-in students. The XR only says "a cell no observed list reads", with "school, grade and `lastLoginAt` unconstrained". That is too loose: <br>&nbsp;&nbsp;– a payer placed at any of the 12 subscription schools changes an observed `used`; <br>&nbsp;&nbsp;– a payer at a register school changes M11; <br>&nbsp;&nbsp;– a changed `lastLoginAt` moves 1,708. | M02 SRS v1.21 change log (l.41), BR-24 (l.273); SRS l.335, l.476. | M19 solution-architect; raise at XL | Cite M02 v1.21. Tighten XR-M19-02: each payer replaces a generated **active student with no school (or a non-register, non-subscription school), keeping that row's `isActive` and `lastLoginAt`**, so 4,533 / 3,152 / 1,708 / every `used` value are unchanged. Add the id-collision point of AUD-02. State explicitly that M19 figures are independent of BR-24. |
| AUD-M19-11 | Nit | SRS §12 provisional list (l.642) | Provisional flags are inconsistent with §12's own rule. <br>• E2E-05, 38, 42 and 50 assert "Pembayar Demo 01" (they need XR-M19-02) but are not provisional, while E2E-27 and 29 are provisional for the same reason. <br>• E2E-32 and 40 assert the INFERRED post-delete landing (FN-2.4.4). <br>• E2E-37 asserts the PROPOSED 1–20 limit. <br>• E2E-56 asserts the INFERRED job's no-back-fill. | trace.cjs; SRS l.640–724. | M19 product-analyst | Mark them provisional, or split out the name / inferred assertions. |
| AUD-M19-12 | Nit | SRS §3.1 traceability table (l.123–147) | The table omits E2E that the FR mapping links: US-05 (33, 55), US-08 (26), US-09 (32, 40), US-12 (69), US-17 (12), US-18 (43), US-19 (12, 64). | trace.cjs | M19 product-analyst | Regenerate §3.1 from the FR / E2E columns. |
| AUD-M19-13 | Nit | URS §6.1 EL-M19-S2-030 / 036 (l.591, 597), FN-M19-1.2.5 EL "S2-031–035", DV-M19-01 "S2-030–036" | EL-S2-030 ("500" / "404", one merged element visible in both the create-500 and not-found states) and S2-036 are mapped to the 404 function, while DV-01 cites 030–036 as the 500 page. The mapping is fine, but the three references disagree. | inventory S2 `visibleIn`. | M19 product-analyst | Note that 030 / 034 / 036 are shared by both error states, and align the EL ranges in FN-1.2.4, FN-1.2.5 and DV-01. |
| AUD-M19-14 | Info | SRS V-M19-06 (l.188) | "Unknown `type` → no row (INFERRED as S1)" is now observed: `/admin/dunning?type=bogus` gives the empty state plus "Reset". | Live S5. | — | Relabel it OBSERVED (optional). |
| AUD-M19-15 | Info | SRS Q-M19-SCH-ACTIVE vs M17 Q-M17-SUBSCRIBED | M19 counts `status = active`; M17 also requires the period to contain now. Both give 9 at the clock (all active rows run to 2027), so no contradiction is visible. They are two definitions of "active school subscription" on different pages. | M17 SRS l.218, l.340. | — | Optional: cite M17's definition in §6.9 "Different definitions" or align them. |

---

## Scripted checks (summary)

| Script | Result |
|---|---|
| `cov.cjs` | Inventory 983 elements; matrix 983 rows, 0 duplicates, 0 unknown, 0 unmapped, 389 mapped, 594 excluded, 0 bad FN references, 0 kind / status mismatches. Text: 0 real mismatches (4 rows only escape `"`). 81 FNs, 45 in the matrix. Per screen: S1 102, S2 50, S3 35, S4 35, S5 32, S6 128 (3 excluded), S7 13 (3 excluded), SHA 214 / SHU 374 all excluded. |
| `trace.cjs` | 81 FN / 21 US / 83 AC / 61 FR / 79 E2E. No FN without an FR, no AC without an FR or E2E, no FR without an E2E, 0 bad references, E2E ACs ⊆ their FRs' ACs, provisional 26 = the §12 list. §3.1 table incomplete (AUD-12). |
| Reconciliation (by hand against live) | R01–R14 and R19 re-observed live: counts, filters, order, dates, S4 rows and figures, dunning rows and filters. The R15 / R16 chains are confirmed by the bill-code user ids. R10 / R13 / R17 / R18 clock logic re-checked: no payment after 13 Sep, no log after 21 Jul, and the #65 chain falls on 6 / 10 / 12 Oct, after the 25 Sep clock. R20: DC-M19-01 is shown nowhere else. |

## What was checked live against the discovery evidence

| Area | Checked | Result |
|---|---|---|
| S1 | cards, 11 URL states, headers, 39 row cells, pager text, Reset rule, font sizes at 3 widths, page scroll | all as discovery, except that the e-mail line is 12 px (AUD-05) |
| S2 | #65 / #64 / #25 full content (non-PII), 58 bill-code / gateway-code shapes, "—" ref, 404 / 500 / non-numeric | new: bill-code format (AUD-01), payer ids (AUD-02), `abc` → 500 (AUD-03) |
| S3 | #65 / #64 content, radio set, note, title, 404 | summary includes the bill code (AUD-07); capitalised type · gateway (AUD-04) |
| S4 | all figures, 20 rows, grids and table overflow at 3 widths, header | as discovery; displayed "Regular" (AUD-04) |
| S5 | cards, 21 rows, 10 filter / edge states, pager, header, links | as discovery; `type=bogus` observed (AUD-14) |
| S6 | full text, forms, comparison table, 5 FAQ answers and the one-open rule, WhatsApp attributes, fonts, grids, H1 at 3 widths, header | as discovery; ribbons at 10 px (AUD-05); no `rel` (AUD-06) |
| S7 | full text, links, title, header | as discovery |
| Shells / errors | SHA "Kewangan" group, SHU menu entries, 5 probe routes → 404, create → 500 | as discovery |

Not re-opened (covered by discovery and unchanged in principle): the S1 selection bar (Alpine-only), the S1 pager at 375, S5 at 375 / 768, S7 at 375 / 768, the remaining 7 probe routes, and `GET /subscribe/*` (blocked by the guard on purpose).

## Recommended routing

Route AUD-M19-01 to AUD-M19-10 to the M19 writer (product-analyst + solution-architect) for v1.1. AUD-01 and AUD-02 go together: the code format embeds the seed user id. Raise AUD-02 and AUD-10 (payer anchor ids and placement under M02 v1.21) at the XL gate together with XR-M19-02. The Nits can be fixed in the same pass. After v1.1, run audit round 2 as a doc-only check. No further live capture is needed; the evidence above is sufficient.

---

## Round 2 (URS / SRS v1.1, 2026-09-27)

### Scope and method

- **Documents audited:** `urs/M19-finance.md` v1.1 and `srs/M19-finance.md` v1.1.
- **Doc-only:** there was no browser session in this round. Every fix was compared with the round-1 live evidence (above) and the discovery inventory.
- **Cross-module check:** M02 SRS as it is on disk. The file is now **v1.23**; its v1.22 entry applies XR-M19-01 / 02 / 04.
- **Scripts:** from `<scratchpad>/m19-audit/`:
  - `cov.cjs` and `trace.cjs` were re-run;
  - a new `codes.cjs` checks all 59 seed bill codes against the format, the payer column and the payer ids the audit observed live.

### Verdict: **PASS**

| Severity | Count |
|---|---|
| Critical | 0 |
| Major | 0 |
| Minor | 2 (AUD-M19-R2-01, R2-02) |
| Nit | 1 (R2-03) |
| Info | 1 (R2-04) |

All 15 round-1 findings are closed. R2-01 is a data conflict in M02's anchor table and must be fixed before M19's build starts (at the XL gate). R2-02 is a trade-off in a PROPOSED rule; the Delivery Lead should confirm it at G1. Neither blocks G1.

### Scripted checks

| Check | Result |
|---|---|
| `cov.cjs` | 983 / 983 elements, 389 mapped, 594 excluded, 0 unmapped, 0 unknown, 0 duplicates, 0 bad FN references, **0 text mismatches**, 0 kind / status mismatches. 82 FNs, 45 in the matrix. |
| `trace.cjs` | **82 FN / 21 US / 84 AC / 62 FR / 80 E2E**. <br>• No FN without an FR, no AC without an FR or an E2E, and no FR without an E2E. <br>• 0 bad references; every E2E's ACs belong to its FRs. <br>• The 29 provisional E2E are exactly the §12 list. <br>• The §3.1 table now lists every linked E2E: 0 missing, 0 extra. |
| `codes.cjs` | 59 / 59 bill codes match `JB-{TYPE}-{MON\|ONE}-{userId}-{8 alphanumerics}`, and the type, billing and user-id segments equal the row's `type` / `billing` / `userId`. 59 / 59 gateway codes are 8 lowercase alphanumerics. All 59 + 59 codes are unique. The payer grouping equals the live grouping. 46 codes embed a seeded id that differs from the live one (see R2-03). |

### Round-1 findings: verification

| ID | Status | Evidence (v1.1) |
|---|---|---|
| AUD-M19-01 | **Closed** | <br>• The observed structure is used in the URS §0 privacy bullet (l.27), BR-M19-12 (random parts from PRNG stream `m19.codes`, structure OBSERVED), §6.2 and all 59 rows of §6.11 A (script above), and §8.2. <br>• AC-07.4 (full code and the "JB-REGULAR-MON-5600-" prefix → 4 rows, which is correct: #64, #63, #62, #57), AC-10.1, AC-11.1 and E2E-27 / 38 / 42 are updated. <br>• R23 has been added. |
| AUD-M19-02 | **Closed** | <br>• FN-4.2.2 (l.200) is now OBSERVED, OQ-06 is closed (l.1545) and R24 has been added. <br>• DV-M19-17 records the live-id difference, the four collisions (3101, 3108, 4321, 5605) and the alternatives; it is a DL decision. <br>• The ids chosen are exactly those that M02 v1.22 placed (M02 l.531 / 629). <br>• Count nit: R2-03. |
| AUD-M19-03 | **Closed** | <br>• DV-01 (l.1494) covers `/abc` as observed and `/abc/edit` as INFERRED. <br>• FN-1.2.4 is limited to numeric ids, and FN-1.2.5 covers non-numeric ids. <br>• AC-04.1 / 04.2 and E2E-13 / 14 are updated. |
| AUD-M19-04 | **Closed** | <br>• FN-1.3.7 (l.112) lists every transform the audit measured: the uppercase headers of S1 / S4 / S5, the S2 labels, the S3 label, and the S6 sub-labels and ribbons; and the capitalised S2 values, S3 summary, S4 badge and S1 gateway. <br>• FR-62, AC-05.6 and E2E-80 are new. <br>• AC-11.1 ("Personal · Toyyibpay"), AC-13.1 / E2E-50 ("Personal" / "Regular") and DV-04 (l.1497) now use the displayed text. |
| AUD-M19-05 | **Closed** | <br>• DV-06 (l.1499) and FN-1.3.4 now say the e-mail line is 12 px, the 40 S1 sub-lines are 10 px at every width, and the 11 S6 texts are 4 hints + 4 captions + 3 ribbons. <br>• AC-05.4 (l.314), FR-16 and E2E-20 apply at every width, ribbons included. |
| AUD-M19-06 | **Closed** | DV-09 (l.1502), FR-47 and E2E-61 say "no `rel`", as live. SEC-09 is now a backend recommendation only. |
| AUD-M19-07 | **Closed** | FN-2.6.2 (l.164), AC-11.1, E2E-42, FR-33 and §8.1 include the S3 bill code. |
| AUD-M19-08 | **Closed, with a follow-up** | <br>• There is now one rule: BR-14 = M02 BR-12 `computeExpiry`, and `personal` → next 10 Jan for both plans. XR-04 is applied, and FN-5.2.5 / FR-54 and R25 are consistent with it. <br>• Payer 5600's expiry and reminders moved: AC-11.3, AC-15.2 (3 / 7 / 9 Jan 2027, rows #24 = 3318 and #25 = 5600 by user id ascending, cards 23 / 2 / 7 / 0 — arithmetic checked), AC-16.6, AC-18.2, AC-18.3, R17 (#25 and #65 chains) and E2E-44 / 57 / 70 / 71. <br>• No school or individual expiry falls between the clock and 3 Jan 2027, so "no row until 3 Jan" holds. <br>• Follow-ups: R2-01 and R2-02. |
| AUD-M19-09 | **Closed** | BR-03 (l.160) is labelled "OBSERVED (displayed prices, historical amounts) / INFERRED (charged amount)". AC-18.2 and OQ-11 match. |
| AUD-M19-10 | **Closed** | <br>• Both docs cite M02 v1.22, and XR-01 / 02 / 04 are marked "Applied". <br>• XR-02 now requires that each payer keeps the replaced row's `isActive` and `lastLoginAt`. M02 v1.22 places the 30 payers on active, never-logged-in, class-less, answer-less grade-11 rows of 8102. Its build line keeps 4,533 / 3,152 / 1,708 and every `used` value. <br>• M19 figures do not read BR-24, which is stated (§6.9 classification). |
| AUD-M19-11 | **Closed** | E2E-32, 37, 40 and 56 are provisional (29 of 80). E2E-05 / 38 / 42 / 50 need no flag now that XR-M19-02 is applied in M02 v1.22. |
| AUD-M19-12 | **Closed** | §3.1 has been regenerated (script: 0 missing, 0 extra). |
| AUD-M19-13 | **Closed** | FN-1.2.4 / 1.2.5 and DV-01 name the shared elements S2-030 / 034 / 036 and the 500-only elements 031–033 / 035 consistently. |
| AUD-M19-14 | **Closed** | V-M19-06 is now OBSERVED. |
| AUD-M19-15 | **Closed** | The M17 definition is cited in §6.9. |

**Regression scan:**
- No stale value remains in the M19 docs: grep for `PP20`, `sim0`, "13 Oct", "2026-10-13" and "6 / 10 / 12 Oct" finds 0 hits in normative text.
- The deviation count reads 8 + 6 + 1 + 1 + 1 = 17 (URS l.1512).
- No real payer name was added (grep with the round-1 name list: 0 hits).

### New findings (round 2)

| ID | Severity | Doc & section | Issue | Evidence | Owner | Required fix |
|---|---|---|---|---|---|---|
| AUD-M19-R2-01 | Minor | M02 SRS §6.14 "Payers (M19, v1.22)" row (M02 l.531) and BR-12 (M02 l.263); M19 SRS §6.10 `<payer:1>` (l.344), XR-M19-02 / 04 ("Applied") | **The owner's store still holds the old expiry for payer 5600.** <br>• M02's payer row says 5600 `personal` **2026-10-13 12:35**, while M19 v1.1 §6.10 / R25 / AC-18.3 say **2027-01-10 23:59:59**. XR-02 says "package and expiry as the table", so the two tables must agree. <br>• With M02's value, the reminder job (BR-M19-11 reads `subscriptionExpiresAt` from M02) would write 6 / 10 / 12 Oct rows. That contradicts AC-15.2 / E2E-57 ("no row until 3 Jan 2027"). <br>• M02 BR-12 defines `personal` only "(billing `onetime`) → next 10 January". M19 BR-14 applies it to `personal` · `monthly` as well, so "XR-04 applied, same rule" is not yet literally true. | M02 SRS l.531, l.263; M19 SRS l.171, l.344, l.483. | M02 solution-architect (M19 to raise at the XL gate) | Update the M02 payer row to 5600 `personal` 2027-01-10 23:59:59. Make M02 BR-12 say that `personal` → next 10 January regardless of billing (or "for both personal plans, M19 BR-M19-14"). Fix both before M19's build. |
| AUD-M19-R2-02 | Minor | URS FN-M19-5.2.5 (l.229), OQ-M19-11 (l.1550); SRS BR-M19-14, AC-M19-18.2, E2E-70 | **The AUD-08 fix removes one tension but creates another.** It is PROPOSED either way, so this needs an explicit G1 confirmation. <br>• Under "`personal` → next 10 Jan for both plans", "Personal Bulanan" ("Langganan Bulanan", "RM90 /bulan", "bayar bila perlu", "Sesuai cuba dulu sebelum komit setahun") paid on 11 January gives the same ~12 months as "Personal Setahun" at RM200. Paid on 20 December, it gives 3 weeks. <br>• This contradicts the S6 copy the rule serves, and the discovery inference §5.2 "#65 … end 13 Oct". <br>• The alternative (monthly → +1 month) keeps S6 coherent but conflicts with the static M02 option label "(hingga 10 Jan)". <br>• Nothing is observable at the clock either way: no expiry is displayed, and both reminder chains fall after the clock. The OQ-11 entry lists the rule but not the trade-off. | S6 live copy (round 1); discovery §5.2 l.178; URS l.229. | Delivery Lead at G1; M19 product-analyst | In OQ-11, state the trade-off (S6 "/bulan" semantics vs the M02 label) and record the Delivery Lead's choice as a decision. If the choice stays, add one sentence to FN-5.2.5 noting the S6 copy tension. |
| AUD-M19-R2-03 | Nit | URS DV-M19-17 (l.1509) | "the user-id segment of the **53** bill codes of those 24 payers". The seed has **46** payments by the 24 non-chain payers (59 − 13 payments of the six chain payers: #16, 19, 20, 31, 32, 35, 39, 40, 57, 62–65). | `codes.cjs`: 46 codes embed a seeded id that differs from the live one. | M19 product-analyst | Change 53 → 46. |
| AUD-M19-R2-04 | Info | URS / SRS §0 "Related" (M02 v1.22) | M02 is now v1.23 (S11 pupil totals, OQ-M17-11). The v1.23 change does not touch the payer rows, subscriptions or BR-12, so the M19 citation of v1.22 is still correct for the content it relies on. | M02 SRS l.8, l.43. | — | Optional: cite "v1.22 (unchanged in v1.23 for M19)" at the next revision. |

### Routing

M19 v1.1 passes the AUD gate and can go to G1 (user approval). Then:
- Report R2-02 at G1 as a Delivery Lead decision on the PROPOSED activation rule.
- Fix R2-01 in M02, at the XL gate before the M19 build. After it is fixed, AC-15.2 / E2E-57 hold against the owner's store.
- Fix R2-03 (and R2-04 if wanted) in v1.2. No re-audit is needed; a spot check is enough.
