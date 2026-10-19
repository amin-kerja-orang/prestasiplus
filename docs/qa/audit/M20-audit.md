# M20 — Marketplace (admin products and sellers, buyer marketplace, product page, public shop, seller portal) — Independent Audit (AUD, round 1)

| Field | Value |
|---|---|
| Documents audited | `docs/requirements/urs/M20-marketplace.md` v1.0 (95 FN, 25 US, 92 AC, 13 DV, coverage matrix 1,286 rows), `docs/requirements/srs/M20-marketplace.md` v1.0 (78 FR, 22 BR, 11 V, 16 named queries, 24 endpoints, 85 E2E, 10 SEC, 7 XR, §6.9 reconciliation R01–R18) |
| Evidence | Discovery `M20-marketplace.md` (incl. §5.4 view ledger); `inventory/M20/*.json` (S1–S12, SHA, SHU, `_crawl.json`, `_snapshot-2026-09-27.json`, `_summary.md`); `img/M20/` (index only). Live re-walk on 2026-09-27, about 10:43–10:50 MYT, browser lane 2 (`playwright2`), admin account, read-only. |
| Screens re-opened live | S1 (1280, plus 375 / 768), S2 (1280), S3 #1 (1280, 375, 768), S4 (1280), S5 #1 (1280, 375, 768), S6 default (1280, 375, 768), S9 (1280, 375, 768), S10, S11, S12 #7 (1280); SHU account menu on S6. **S7 and S8 were not opened** (view counter); they were audited from the inventory and snapshot only. |
| Safety | A context-level route guard with a document cache was installed before the login. It aborted every non-GET request except `POST /login`, any wa.me / WhatsApp / payment-gateway host, write-shaped GETs (toggle, delete, approve, verify, ban, `/whatsapp`, logout, export, download, checkout, cart, pay) and **every `/marketplace/{anything}` path** (S7, S8, W). Verified by probes: `POST`, `DELETE`, `PUT /__m20a_probe`, `GET /marketplace/__m20a_probe/whatsapp`, `GET …/products/1/toggle`, `GET wa.me/…`, `GET /marketplace/{slug}`, `GET /marketplace/penjual/1` and `GET /logout` were all blocked. The service worker was disabled by an init script. Each M20 page was fetched from the server **once** (10 server GETs in total); the 375 / 768 re-loads were served from the guard cache (10 cache hits). 22 Cloudflare RUM beacons were blocked. Nothing was submitted, saved, deleted, uploaded, toggled, verified, banned or contacted; no confirm dialog was opened and no WhatsApp link was clicked. Page loads were ≥ 350 ms apart. No screenshot was taken. The browser was closed at the end, and this session's lane-2 console logs were deleted. **Incident (no effect):** the first guard installation failed (the sandbox has no `URL` global, so the handler threw). In that attempt one probe `POST /__m20a_probe`, a non-existent path, reached the server and got 404; no application route, product page or WhatsApp URL was requested. |
| View counters | **None moved.** Before and after this audit: S1 views #1 33, #2 14, #3 13, #4 5, #5 8, #6 3, #7 7, #8 19, #9 6, #10 9; S9 "Jumlah Tontonan" 117, "Klik WhatsApp" 16; S10 the same per-row views. These equal the discovery "after" column (§5.4), so the audit added no view and no click. |
| Privacy | Contact numbers and the e-mail were replaced with `<num>` / `<email>` inside the page scripts before they were returned; no number, e-mail or real name appears in this report or in any scratch file. The docs pass a scan: the only e-mails are `admin@demo.test` / `pelajar@demo.test`, and the only phone-shaped strings are the fictitious `0100000000`, `60100000000`, `0120000000` and `60120000000`. |
| Cross-module docs | M01 SRS v1.12 (account 1 "Admin Demo"), M02 SRS **v1.23**, M14 SRS v1.6 (admin 256 koin), M15 v1.4, M19 URS / SRS v1.3 (DV-M19-07, DV-M19-09 `60000000000`), design-system v1.8, `src/shells/nav/user-nav.ts`, `roles-matrix/` |
| Auditor | Independent audit agent (not an author) |
| Scripts | `<scratchpad>/m20-audit/cov.cjs` (matrix vs inventory: ids, kind, status, text, FN EL lists in both directions, exclusion reasons), `strict.cjs` (exact text equality), `trace.cjs` (E2E ACs ⊆ FR ACs, provisional list, tagged ACs, §3.1 table, SRS counts) |

## Verdict: **FAIL**

| Severity | Count |
|---|---|
| Critical | 0 |
| Major | 2 |
| Minor | 5 |
| Nit | 4 |
| Info | 2 |

What is good:
- **Coverage is complete (independent script).**
  - All 1,286 inventory elements have exactly one matrix row: 670 mapped and 616 excluded, with 0 unmapped, 0 duplicates and 0 rows for ids that are not in the inventory.
  - Kind and status match the inventory on every row.
  - Text matches on all 493 text elements. The 3 strict-equality differences are only nested `"` inside a quote.
  - Each mapped element's FN lists that element in its EL column, and each FN EL list points back to the same FN (0 disagreements).
  - The 21 content exclusions are exactly the M16 tournament banner ("LIVE:", "MAIN", "DAFTAR") on S6–S12. 16 SHA and 19 SHU exclusions name FN-M20-1.1.1–1.1.3, as the summary claims.
  - 61 of the 95 FNs appear in the matrix.
- **Traceability is clean (writer's script plus auditor's checks).**
  - Counts: 95 FN / 25 US / 92 AC / 78 FR / 85 E2E, with 0 errors.
  - Every E2E's ACs belong to its FRs.
  - The 29 provisional E2Es are exactly the §12 list.
  - Every AC that is tagged provisional, PROPOSED or INFERRED has at least one provisional E2E.
  - The SRS counts (22 BR, 11 V, 16 queries, 24 endpoints, 10 SEC, 7 XR) match the tables.
  - The §3.1 table has 3 small drifts (AUD-M20-10).
- **The live figures and copy are exact.**
  - **S1:** "10 produk dijumpai"; ids 1 → 10; row text, views, star "0", the "Baru" / "Terpakai" and "Active" badges; titles "Lihat", "Nyahaktif", "Edit", "Padam"; confirm "Padam produk ini?"; both selects and the placeholder; no "Reset".
  - **S2:** every label, hint, option, `min` / `step` / `accept` / `multiple` attribute and the seller option.
  - **S3 #1:** the prefilled values, "Gambar Sedia Ada (4)" with one "Utama".
  - **S4:** 0 / 1 / 1 / 1, the options, "Lihat Detail", confirm "Haramkan penjual ini?".
  - **S5:** the full text, "Produk (10)", "Ringkasan" 10 / ☆☆☆☆☆ / 0 / 09 Feb 2026 / 09 Feb 2026.
  - **S6:** the ten cards, in id order, match AC-15.2 / R05 / R09 character for character; the chips link to `?category={slug}` with "Semua" active; the three selects are as FN-4.1.1.
  - **S9:** 10 / 10 / 117 / 16 (live), "Verified", "(0 reviews)", "Produk Terbaru" #1–#6.
  - **S10:** 10 rows, edit links, delete confirms.
  - **S11 / S12:** the cards, with no "Penjual" / "Penghantaran" on either and no "Status Produk" on S12.
  - All tab titles and headers are as FN-1.1.3 / 1.1.4.
- **Seeds mirror observation.**
  - 10 products, ids 1–10, all active, available and seller #1.
  - All slugs, names, prices, original prices, categories, shipping methods, fees, locations and the ten descriptions equal the snapshot `S3_productFields`.
  - Image counts total 45; the observed delete-form ids agree with §6.11 C, and the first id of each product is correctly labelled INFERRED.
  - Views are the pre-discovery values (#1 30, #5 7, #7 5; Σ 111 = 117 − 6), and "Klik WhatsApp" is 16.
  - The seller cards are 0 / 1 / 1 / 1, and each of the 4 filter variants equals the snapshot.
  - No record is invented. The test-only fixtures are kept out of the observed checks.
- **The derived figures were re-computed.**
  - Discount badges, the price and Popular orders (the #4 / #7 tie is INFERRED and labelled), and the category orders.
  - After-action values: 81 = 111 − 30; 113 = 111 + 2; "-30%" for 3.50 / 5.00; "-38%" for 79.90 / 129.90; "Bergabung 8 bulan" on 10 Oct.
- **Deviations D9 / D10 / D14.**
  - **DV-01 (nested forms), confirmed live:** the product form's elements carry `_method` PUT **and** DELETE; the first × belongs to the product form and has no confirm; "Simpan Perubahan" and the file input have `form = null`; images 2–4 keep working forms with "Padam gambar ini?". The fix is minimal (separate forms; the same confirm on every ×) and creates no new contradiction.
  - **DV-02 / DV-03:** approved correctly. S5 was re-verified live: 10 of 10 thumbnails are `/storage/uploads/…` and broken.
  - **DV-06 (menu link), replicated correctly:** no menu of the admin account links to `/seller/*` (checked live on the SHU menu). The omission is consistent, so adding an entry is new scope, and it is left to the user as OQ-09.
  - **DV-10:** the owner shows as "Admin Demo". This agrees with M01 account 1 and the M09 precedent; it is a seed-consistency choice, not a privacy fix ("Admin PRESTASI+" is a system label), and the DV labels it so.
  - **DV-13 (D14):** no external or intermediate screen; the click is recorded; a plain `wa.me` link carries the fictitious number. The platform number `60000000000` matches M19 DV-M19-09.
  - **DV-04, 05, 07, 08, 11, 12:** rejected and replicated, with reasoning consistent with D9 "when unsure, follow live".
  - **The count "6 approved / 7 rejected" is correct.**
- **D11 / D12:** every displayed count cites one of the 16 named queries, "Klik WhatsApp" is a stored counter (C2), and there is no display constant. M20 owns its six stores and reads users only through M01 / M02 (XR-01).
- **Responsive.** Every E2E runs at 375 / 768 / 1280.
  - Live: no horizontal page scroll and no text below 12 px on S1, S3, S5, S6 and S9 at 375 and 768, or on every opened page at 1280.
  - The grids match SRS §10: S3 image grid 4 at every width; S5 1 / 2 / 3 layout and product grid 2 / 3; S6 2 / 3 / 4; S9 stats 2 / 4 and product grid 2 / 3.
- **Accessibility (D10).** NFR-04 replicates live: native confirms, hidden radios in tiles, and icon buttons with their live `title`. The one exception is `rel` (AUD-M20-03).

Why it fails (2 Major):
1. **The create forms preselect their tile radios on live, and the docs say they do not** (AUD-M20-01). As a result AC-08.2, AC-22.3 and E2E-28 / 76 test a state that cannot occur.
2. **The S7 WhatsApp button opens in a new tab on live** (`target="_blank"`, recorded in the inventory). The docs specify "same tab, INFERRED" and build the D14 hand-off on it (AUD-M20-02).

---

## Findings

| ID | Severity | Doc & section | Issue | Live / doc evidence | Owner | Required fix |
|---|---|---|---|---|---|---|
| AUD-M20-01 | **Major** | URS FN-M20-2.2.4 (l.137), FN-M20-2.2.5 (l.138), FN-M20-5.4.2 (l.247), AC-M20-08.2 (l.353), AC-M20-22.3 (l.433); SRS FR-M20-27 (l.92), V-M20-01 (l.210), E2E-M20-28 (l.604), E2E-M20-76 (l.652) | **The default checked tiles are observable, and the docs state the opposite.** FN-2.2.4 says "none preselected (INFERRED from the create form); a choice is required", and its Source column even says OBSERVED. Live S2 has `condition=new`, `stock_status=available` and `shipping_method=pickup` checked on load. Live S11 has `condition=new` and `stock_status=available` checked. None of the radios carries `required`; only `name`, `category_id` and `price` are `required`. The inventory records the same (`checkedIn` on EL-S2-023 / 030 / 039 and EL-S11-022 / 029). So "submit with no condition, no stock status or no shipping method → the browser required check stops it" (AC-08.2 / AC-22.3 / E2E-28 / 76) cannot happen on live or in a faithful rebuild. | Live `/admin/marketplace/products/create`, `/seller/produk/tambah` (`input:checked`, `[required]`); inventory S2 / S11 `checkedIn`. | M20 product-analyst | <br>• FN-2.2.4 / 2.2.5 / 5.4.2: "🆕 Baru", "✅ Ada" and (S2) "Ambil Sendiri" are checked on load (OBSERVED); the radios have no `required`; the `required` fields are `name`, `category_id` and `price`. <br>• FR-27: list the `required` fields and the checked defaults. <br>• AC-08.2 / 22.3, E2E-28 / 76: drop the "no condition / stock / shipping" cases; keep empty name, no category and price "0". <br>• Add an AC / E2E assertion for the three checked defaults. <br>• FN-5.4.4 "shipping `pickup` default" may then cite the S2 default as supporting evidence. |
| AUD-M20-02 | **Major** | URS FN-M20-4.2.4 (l.199), FN-M20-4.2.5 (l.200), AC-M20-16.1 (l.397), AC-M20-17.1 (l.405), matrix EL-M20-S7-026 / 045 / 069 (l.948 ff., the target is missing), DV-M20-13 (l.1882); SRS §2 row W (l.49), FR-M20-57 (l.122), FR-M20-58 (l.123), E2E-M20-55 / 61 / 62 | **"Hubungi Penjual di WhatsApp" opens a new tab on live; the docs say "same tab, INFERRED".** The inventory records `target="_blank"` on all three captured states (EL-S7-026, 045, 069). The observable attribute is contradicted and mislabelled INFERRED (D7). The D14 hand-off is built on it: FR-58 "W … `location.replace()` … on another error it SHALL return to S7", and E2E-61 "no screen renders". With a new tab, the W route runs in the new tab, and S7 stays open in the original tab. D14 is still satisfied (no WhatsApp or intermediate screen), but the flow, the failure path and the E2E mechanics differ. | Inventory S7 `target`; not re-opened live (view counter). | M20 product-analyst (with solution-architect for FR-58) | <br>• FN-4.2.4 / FR-57: the button opens `/marketplace/{slug}/whatsapp` in a new tab (`target="_blank"`, OBSERVED; `rel` as AUD-M20-03). <br>• FR-58 / FN-4.2.5 / DV-13: the W route in the new tab records the click, then replaces itself with the `wa.me` URL. On failure the new tab shows the M01 error convention or the 404 page, and S7 stays in the original tab. <br>• Add the target to the three matrix rows. <br>• AC-16.1 / 17.1 and E2E-55 / 61 / 62: assert the target and handle the popup (the `whatsappLog()` assertion stays). |
| AUD-M20-03 | Minor | SRS FR-M20-21 (l.86), SEC-M20-02 (l.557), E2E-M20-24 (l.600); URS DV table §7 | **`rel="noopener"` is an unlisted change.** Live S1 "Lihat" links have `target="_blank"` and **no `rel`** (all 10 checked live). The S5 `wa.me` link has `target="_blank"` and no `rel` (live). FR-21 requires `rel="noopener"`, and SEC-02 says "`rel="noopener"` where a link is rendered". This is the same pattern that M19 resolved in AUD-M19-06. | Live S1 `a[title=Lihat]`, S5 `a[href*="wa.me"]`. | M20 product-analyst | As M19: say "no `rel`, as live" in FR-21 (and in the S7 / S5 / S9 new-tab links) and keep `rel` hardening as a backend recommendation in SEC-02. Alternatively, list it as a DV approved as security-only. |
| AUD-M20-04 | Minor | URS FN-M20-5.2.2 (l.229), AC-M20-20.2 (l.421), matrix EL-M20-S9-018 (l.1049); FN-M20-3.2.2 (l.172), AC-M20-13.1 (l.379), matrix EL-M20-S5-011 (l.804); SRS FR-M20-43, FR-M20-66, E2E-43 / 69 | **Two more new-tab links are not specified.** S9 "Lihat Kedai Saya" → S8 and the S5 WhatsApp link both have `target="_blank"` on live. The docs give only the targets, so the rebuild would open them in the same tab. | Inventory S9-018, S5-011 `target`; S5 re-checked live. | M20 product-analyst | State "new tab (`target="_blank"`, no `rel`)" in FN-5.2.2 / FN-3.2.2, their FR / AC / E2E, and the two matrix rows. |
| AUD-M20-05 | Minor | URS §0 Related (l.14); SRS §0 Related (l.14), §6.1 (l.232), XR-M20-01 (l.397), XR-M20-07 (l.403), §10.1 (l.530–537), §13 (l.667) | **Cross-module citations are stale.** Current versions: M01 v1.12 (cited 1.11), M02 **v1.23** (cited 1.22), M14 v1.6 (1.5), M15 v1.4 (1.3), M19 **v1.3** (1.0), design-system **v1.8** (1.7). <br>**XR-M20-07 has already been applied:** design-system v1.8 added all eight icon rows (`ShoppingBag`, `UserRound`, `HandCoins`, `PencilRuler`, `Shirt`, `Tablet`, `Package`, `Phone`). So XR-07 "Requested", §10.1 "no §6 row — requested" and §13 "must be applied before build" are out of date. <br>**The content M20 relies on is unchanged:** account 1 "Admin Demo", the users contract, 256 koin, M19 DV-07 / DV-09 and `60000000000`. | File headers; design-system l.21. | M20 product-analyst | Cite the current versions. Mark XR-07 "Applied (design-system v1.8)" and fill the Lucide column of §10.1 with the v1.8 names. |
| AUD-M20-06 | Minor | Writer's `m20-writer/coverage.cjs`, `trace.cjs` | **The writer's check scripts are sound for what they test, but they are too weak to prove the matrix.** <br>• `coverage.cjs` checks that each inventory id has a row and that the cover is a known FN or an "Excluded" text. It does **not** check: <br>&nbsp;&nbsp;– that a row id exists in the inventory (only the screen prefix is tested); <br>&nbsp;&nbsp;– kind, status or quoted text; <br>&nbsp;&nbsp;– that the cited FN lists the element; <br>&nbsp;&nbsp;– that the exclusions are legitimate. <br>• `trace.cjs` does not check: <br>&nbsp;&nbsp;– E2E ACs ⊆ FR ACs; <br>&nbsp;&nbsp;– that the provisional flags equal the §12 list; <br>&nbsp;&nbsp;– the §3.1 table. <br>• The audit re-ran all these checks independently (`m20-audit/cov.cjs`, `strict.cjs`, `trace.cjs`). All pass except §3.1 (AUD-M20-10). Neither script can catch content errors such as AUD-01 / 02. | Script source. | M20 product-analyst (for future modules) | Optional for M20, since the audit scripts cover the gap. For later modules, extend the writer scripts with the checks above. The M19 audit `cov.cjs` is a template. |
| AUD-M20-07 | Minor | URS FN-M20-2.2.4 Source column (l.137) | Linked to AUD-01, and listed separately because it breaks the labelling rule: the Function text says "INFERRED" while the Source column says "OBSERVED", and neither is correct for the "none preselected" claim. The reviewer should check the other rows where a Function mixes an OBSERVED Source with INFERRED text: FN-2.1.6, 2.3.5, 4.2.3, 4.2.8 and 5.2.3 carry both labels, and those are correct. | URS l.137. | M20 product-analyst | Fix together with AUD-01. |
| AUD-M20-08 | Nit | URS §7 (l.1882–1883) | DV-M20-13 is listed before DV-M20-12. | URS l.1882. | M20 product-analyst | Reorder. |
| AUD-M20-09 | Nit | SRS E2E-M20-63 (AC-17.3), E2E-M20-82 (AC-24.3) | **Two non-provisional E2Es assert rebuild-only behaviour.** E2E-63 tests the W route on an unknown slug, which was never opened on live. E2E-82 performs "after a WhatsApp click", which depends on the PROPOSED hand-off (E2E-61 is provisional). | trace.cjs; SRS l.639, l.658. | M20 product-analyst | Mark them provisional, or split out the dependent step. |
| AUD-M20-10 | Nit | SRS §3.1 (l.151, 157, 170) | **§3.1 has drifted from the FR and E2E columns.** <br>• US-03 omits FR-63, whose AC 03.5 belongs to US-03. <br>• US-09 omits FR-54 (AC 09.4). <br>• US-21 lists FR-76, which has no US-21 AC. It comes only from E2E-72's FR column, and E2E-72's AC 21.2 belongs to FR-69. | Auditor `trace.cjs`. | M20 product-analyst | Regenerate §3.1 from the FR AC column. |
| AUD-M20-11 | Nit | URS FN-M20-1.1.2 (l.88), SRS FR-M20-02 | The user-menu "Marketplace" icon has the emerald class in the drawer, but in the account dropdown it has none (live SHU: `fas fa-shopping-bag w-5 text-center text-lg`, no colour class). The claim "emerald" holds only for one of the two menus. It is shell-owned, and `user-nav.ts` already carries the colour. | Live SHU on S6. | Global shell (note only) | Optional: say "emerald in the drawer" or leave it to the shell spec. |
| AUD-M20-12 | Info | URS DV-M20-04 (l.1874) | The URS rejects discovery's suggested fix (global cards) and replicates the filter-scoped cards. The reasoning (the cards agree with the list under them, and D9 says "when unsure, follow live") is sound, and the DV table records the alternative. The Delivery Lead may want to mention this reversal at G1. | Snapshot S4 filters. | — | None. |
| AUD-M20-13 | Info | — | A guard incident occurred during this audit, with no effect on live data (see the Safety row above): one POST reached a non-existent path and returned 404. View counters were unchanged. | Lane-2 console log (deleted). | — | None. |

---

## Scripted checks (summary)

| Script | Result |
|---|---|
| `m20-writer/coverage.cjs` (re-run) | 1,286 elements, 670 mapped, 616 excluded, 0 errors. |
| `m20-writer/trace.cjs` (re-run) | FN 95, US 25, AC 92, FR 78, E2E 85, DV 13, XR 7, SEC 10; 0 errors. |
| `m20-audit/cov.cjs` | 1,286 inventory = 1,286 rows; 0 unmapped, 0 duplicates, 0 non-inventory rows; 0 kind / status mismatches; 0 text mismatches; FN EL lists and the matrix agree in both directions; the 21 content exclusions are all the M16 banner; SHA 16 + SHU 19 FN-specified exclusions. |
| `m20-audit/strict.cjs` | 493 text elements; 3 exact-equality differences, all nested-quote artefacts (S2-007, S3-099, S12-052). |
| `m20-audit/trace.cjs` | E2E ACs ⊆ FR ACs (0 violations); provisional 29 = the §12 list; every provisional / PROPOSED / INFERRED AC has a provisional E2E; the SRS counts are as claimed; §3.1 has 3 drifts (AUD-10). |
| Reconciliation (by hand) | R01–R18 re-computed from the snapshot. The live S1 / S6 / S9 / S10 figures equal the discovery post-run values, and the seed equals the pre-run values of the ledger. |

## What was checked live against the discovery evidence

| Area | Checked | Result |
|---|---|---|
| S1 | count, filter options, placeholder, 10 rows (text, views, badges), action titles, confirm, link target / rel, no Reset, scroll and fonts at 3 widths | as discovery; no `rel` (AUD-03) |
| S2 | all labels, hints, options, input attributes, checked state | new: tiles preselected, radios not `required` (AUD-01) |
| S3 #1 | forms, `_method` values, × button forms and confirms, save / file `form`, headings, checked tiles, "Utama", image grid at 3 widths | D-M20-01 confirmed exactly as DV-01 describes |
| S4 | cards, options, row, eye title and link, ban confirm and title | as discovery |
| S5 #1 | full text (masked), thumbnails (10 / 10 broken `/storage/…`), WhatsApp link attributes, layout at 3 widths | as discovery; link opens a new tab (AUD-04) |
| S6 | selects and defaults, placeholder, chips and active chip, 10 cards, scroll and grid at 3 widths; SHU menu entries; no `/seller` link | as discovery |
| S9 / S10 / S11 / S12 #7 | cards 10 / 10 / 117 / 16, links, profile lines, latest six; list and confirms; create and edit cards, required fields, checked tiles | as discovery; S11 preselected tiles (AUD-01) |
| Counters | S1 / S10 per-product views and S9 totals, before and after | unchanged (no view added) |

Not re-opened on purpose: S7 and S8 (they count views or might), the W route, the 404 / 405 probes, and the S1 / S4 / S6 filter variants. The snapshot holds the filter results, and the defaults re-checked live match it exactly.

## Recommended routing

Route AUD-M20-01 … 07 to the M20 writer (product-analyst; solution-architect for the FR-58 flow in AUD-02) for v1.1. The Nits can be fixed in the same pass. After v1.1, run audit round 2 as a doc-only check: the evidence above is enough, and no further live capture is needed. S7 and S8 in particular must not be opened again.

---

## Round 2 (URS / SRS v1.1, 2026-09-27)

### Scope and method

- **Documents audited:** `urs/M20-marketplace.md` v1.1 and `srs/M20-marketplace.md` v1.1.
- **Doc-only:** no browser session was opened in this round. Each fix was compared with the round-1 live evidence (above) and with the discovery inventory and snapshot.
- **Scripts re-run:**
  - from `<scratchpad>/m20-audit/`: `cov.cjs`, `strict.cjs` and `trace.cjs`;
  - from `<scratchpad>/m20-writer/`: the strengthened `coverage.cjs` and `trace.cjs`, whose source was reviewed.
- **Regression grep** over both documents for stale text: "none preselected", "no condition / stock status / shipping method", "same tab", "return to S7", `noopener`, "v1.22", "M19 v1.0", "v1.7 §" and "— requested".

### Verdict: **PASS**

| Severity | Count |
|---|---|
| Critical | 0 |
| Major | 0 |
| Minor | 0 |
| Nit | 1 (AUD-M20-R2-01) |
| Info | 1 (AUD-M20-R2-02) |

All 11 actionable round-1 findings are closed, and the two Info items needed no action. The fixes introduced no new inconsistency. M20 v1.1 passes the AUD gate and can go to G1.

### Scripted checks

| Check | Result |
|---|---|
| `m20-audit/cov.cjs` | 1,286 inventory elements = 1,286 rows: 670 mapped, 616 excluded. 0 unmapped, 0 duplicates, 0 non-inventory ids, 0 kind / status / text mismatches. The FN EL lists and the matrix agree in both directions. The 21 content exclusions are all the M16 banner. 61 of the 95 FNs are in the matrix. |
| `m20-audit/strict.cjs` | 493 text elements. The same 3 nested-quote artefacts as round 1 (S2-007, S3-099, S12-052); none is a real mismatch. |
| `m20-audit/trace.cjs` | 0 E2E ACs outside their FRs. The provisional count is 31 listed = 31 flagged = 31 claimed of 85. Every tagged AC has a provisional E2E. **§3.1 now matches the FR / E2E columns (0 drifts).** The SRS counts are 78 FR / 22 BR / 11 V / 16 queries / 24 endpoints / 85 E2E / 10 SEC / 7 XR. |
| `m20-writer/coverage.cjs`, `trace.cjs` | 0 errors each. **The source now checks** kind, status and quoted text; the provisional list against the flags and the claimed counts; that each tagged AC has a provisional E2E; and the §3.1 table. AUD-06 is closed. |
| Regression grep | 0 stale hits in normative text. The only hits are the v1.1 change-log entry and the SEC-M20-02 backend recommendation, both intended. |

### Round-1 findings: verification

| ID | Status | Evidence (v1.1) |
|---|---|---|
| AUD-M20-01 (Major) | **Closed** | <br>• FN-2.2.4 (l.138), FN-2.2.5 (l.139) and FN-5.4.2 (l.248) state the observed checked tiles ("🆕 Baru", "✅ Ada" and, on S2, "Ambil Sendiri"). They say the radios carry no `required` and the only `required` fields are `name` / `category_id` / `price`. This matches the live round-1 read and the inventory `checkedIn` exactly. <br>• The matrix rows S2-023 / 030 / 039 and S11-022 / 029 say "checked on load". <br>• AC-08.1 / 22.1 assert the defaults. <br>• AC-08.2 / 22.3 and E2E-28 / 76 now test only an empty name, no category and price "0" ("defaults left checked"). <br>• FR-27 and V-M20-01 separate the HTML `required` fields (as live) from the server rules. <br>• FN-5.4.4 cites the S2 `pickup` default as supporting evidence and correctly stays PROPOSED. |
| AUD-M20-02 (Major) | **Closed** | <br>• FN-4.2.4 (l.200), FR-57, AC-16.1, E2E-55 and matrix S7-026 / 045 / 069 say `target="_blank"`, OBSERVED. <br>• **D14 wording is consistent in all six places** (FN-4.2.5 l.201, DV-13 l.1884, §2 row W, FR-58, BR-21 and §6.13 / §12): the W route runs in the new tab, records the click, renders no screen of its own and `location.replace`s itself with the `wa.me` URL; S7 stays open in the original tab; 404 and other failures show in the new tab. No WhatsApp or intermediate screen is built, so D14 holds. <br>• **The E2E flow is sound.** E2E-61 uses `page.waitForEvent('popup')`, aborts the external navigation, asserts the logged URL, and checks both that S7 is still open in the original tab and that the counter reads 17. E2E-62 opens two popups (→ 18). Both are provisional, which is correct for INFERRED counting and a PROPOSED message. <br>• AC-17.3 / E2E-63 (the W route typed directly for an unknown slug) is a plain navigation and stays valid. |
| AUD-M20-03 | **Closed** | FR-21, FR-43, FR-57, FR-66 and E2E-24 / 43 / 55 / 69 say "no `rel`, as live". SEC-02 keeps `rel="noopener noreferrer"` only as a backend recommendation, as in the M19 precedent. |
| AUD-M20-04 | **Closed** | S5 `wa.me` (FN-3.2.2, AC-13.1, FR-43, E2E-43, matrix S5-011) and S9 "Lihat Kedai Saya" (FN-5.2.2, AC-20.2, FR-66, E2E-69, matrix S9-018) open in a new tab. |
| AUD-M20-05 | **Closed** | <br>• The citations are now M01 v1.12, M02 v1.23, M14 v1.7, M15 v1.4, M19 v1.3 and design-system v1.8. M14 v1.7 is the current file on disk: it changed after round 1, and 256 koin is unchanged. <br>• XR-07 is "Applied (design-system v1.8)"; §10.1 carries the v1.8 Lucide names, and §13 has been updated. |
| AUD-M20-06 | **Closed** | The writer scripts were strengthened (see above). |
| AUD-M20-07 | **Closed** | FN-2.2.4's text and Source column both say OBSERVED. |
| AUD-M20-08 | **Closed** | DV-12 now comes before DV-13. |
| AUD-M20-09 | **Closed** | E2E-63 and E2E-82 are provisional (31 of 85). |
| AUD-M20-10 | **Closed** | §3.1 has been regenerated; the script finds 0 drifts. |
| AUD-M20-11 | **Closed** | FN-1.1.2 and FR-02 say "emerald in the mobile drawer, no colour class in the account dropdown, as live — shell-owned styling". |
| AUD-M20-12 / 13 (Info) | No action needed | — |

**Other v1.1 change: endpoint #19.** The PROPOSED endpoint note now reads "#11, #19 PROPOSED", which is correct: #19 `POST /api/seller/register` is the PROPOSED registration, and #20 is the observed seller list.

### New findings (round 2)

| ID | Severity | Doc & section | Issue | Evidence | Owner | Required fix |
|---|---|---|---|---|---|---|
| AUD-M20-R2-01 | Nit | URS FN-4.2.4 (l.200), FN-5.2.2 (l.230), AC-16.1, AC-20.2; SRS FR-57, FR-66, E2E-55, E2E-69 | **"No `rel`, as live" is observed only on S1 "Lihat" and the S5 `wa.me` link** (read live in round 1). The inventory does not record `rel`, and round 1 did not read `rel` on S9, nor on S7, which was not opened. So for S7 and S9 the absence of `rel` is a very likely inference from the same pattern, not an observation. It affects no visible behaviour. | Round-1 live reads; the inventory has no `rel` field. | M20 product-analyst | Optional: in FN-4.2.4 / 5.2.2, say "no `rel` (OBSERVED on S1 / S5; INFERRED for S7 / S9)". Alternatively, leave it and let QA confirm during G5. |
| AUD-M20-R2-02 | Info | SRS change log v1.0 (l.20) | The #19 correction was made inside the **v1.0** change-log row ("#11, #19 PROPOSED"), not only noted in v1.1. The v1.1 row mentions it, so the history is still traceable. | SRS l.20–21. | — | None. |

### Routing

M20 v1.1 passes AUD. It can go to G1, where the PROPOSED items of URS OQ-M20-12 / SRS §8.2 are reported to the user. R2-01 can be fixed at the next revision, or confirmed by QA; no re-audit is needed. Before build, the XL gate still has XR-M20-01…06 to process.
