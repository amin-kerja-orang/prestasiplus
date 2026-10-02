# M15 — Rewards Shop & Redemption — Software Requirements Specification

## 0. Document control

| Field | Value |
|---|---|
| Document | SRS — M15 Rewards Shop & Redemption |
| Version | 1.4 |
| Date | 2026-09-26 |
| Status | **Approved (G1)** — 2026-09-26, together with the URS. The default seed mirrors live; S5 shows the empty state for every account by the user's decision on OQ-M15-01; other unobserved populated states remain provisional (OQ-M15-09). |
| Author | product-analyst (agent) for §1–§5, §8–§10, §12–§13; solution-architect (agent) for §6 data entities, seeds, dataset spec and cross-module requests, §7 mock API, §11 |
| Source URS | [urs/M15-rewards-shop.md](../urs/M15-rewards-shop.md) v1.0 (FN-M15-n.n.n, 21 stories, AC-M15-nn.m) |
| Source discovery | [M15-rewards-shop.md](../../discovery/M15-rewards-shop.md), inventory `docs/discovery/inventory/M15/` (incl. `_snapshot-2026-09-26.json`), screenshots `docs/discovery/img/M15/` |
| Related | [M14 SRS](M14-gamification.md) v1.0 (§6.13 answers to XR-M15-01…08, BR-M14-16/22/29/31, DATA-M14-17/18/19/21), [M01](M01-authentication.md) (User, guest redirect, landing pages BR-07, 404 page, canonical accounts 1–11), [M02](M02-users-schools.md) (users dataset §6.15 and id policy; DATA-M02-02 ParentStudentLink; parent 6 ↔ students 2, 4; parent 5401 without links), [M05](M05-practice.md) (BR-09/BR-31: practice coins go to the M14 wallet; no M15 dependency), M14 (discovery [M14-gamification.md](../../discovery/M14-gamification.md): wallet, ledger, conversion, `/admin/reward-control` S10 incl. draws and the syiling-priced catalogue), [M13](M13-cikgu-alesa.md) (neighbouring menu group), [design/shells.md](../../design/shells.md) (DV-SH-03, DV-SH-04), [architecture/overview.md](../../architecture/overview.md) (§6.6 datasets, §6.11 persistence, §6.12 clock, §6.13 hooks) |

**Change log**

| Version | Date | Change |
|---|---|---|
| 1.4 | 2026-09-27 | **M02 v1.23 change request XR-M02-02** (status stays Approved (G1)). XR-M15-09: users 3151 and 3152 are placed at school 2418 SEKOLAH KEBANGSAAN JELI (1), grade 6 (Darjah 6), no class (M02 §6.15 D); the superseded "no school" wording and the v1.11 check-line note are removed; status "Applied by M02". M15 shows only name and e-mail, so no visible value changes. Counts unchanged: 66 FRs, 57 E2E (25 provisional); 16 endpoints. |
| 1.3 | 2026-09-26 | **Approved (G1).** OQ-M15-01 closed by the user ("ikut macam mana ada sekarang"): FR-47, BR-22, #18, §1, §2 and XR-04 reworded — S5 replicates live (empty for every account; activation does not populate it; no shop catalogue source modelled). Counts unchanged. |
| 1.2 | 2026-09-26 | Audit round 2 PASS; minors fixed. R2-01: XR-M15-03 — M14 `buyTicket` debits the syiling itself and writes 'Tiket Cabutan: {title}'. R2-02: FR-M15-04 scoped — only the sidebar active icon loses its colour class (and "Kedai Hadiah" its `icon-gift`); the drawer keeps the colour. |
| 1.1 | 2026-09-26 | **Revision history — v1.1, audit round 1** (FAIL 0/1/7). AUD-01: DV-M15-14 approved (hint "1 token = RM1"; §0.1, §8.2, E2E-27). AUD-02: M14 SRS v1.0 answers — XR status column, legacy catalogue owner M14 DATA-M14-17 (§6.1), TokenMovement (§6.1), BR-M15-05 cites the closed budget question, SQ-02 closed. AUD-03: #13 codes `DRAW_CLOSED` / `TICKET_LIMIT` / `INSUFFICIENT_BALANCE`; no `debitSyiling` for tickets (M14 `buyTicket` debits and writes "Tiket Cabutan: {title}"; BR-M15-19, FR-56, E2E-49). AUD-04: Q-M15-OPENINGS-COUNT + consumer contract `mysteryBox.openingsCount`, XR-M15-12. AUD-05: S5 rule recorded in XR-04. AUD-06: menu icon/badge/active/drawer classes (FR-01, FR-04, E2E-01, E2E-03). AUD-07: raw "Pelaras Token" text and mock `parseInt` parse (FR-29, BR-11/12, E2E-26). AUD-08: §8.2 complete. I2: XR-09 bucket note. Icon note: `fa-store` → Lucide `Store` (§10). Counts unchanged: 66 FRs, 57 E2E (25 provisional); 16 endpoints. |
| 1.0 | 2026-09-26 | First issue. 66 FRs, 25 BRs, 4 owned entities, 16 mock endpoints (+ 2 referenced / reserved), 57 E2E (25 provisional), 10 SEC items, 11 cross-module requests. Traceability checked by script (§3.1). |

### 0.1 Fidelity deviations referenced here

URS §7 is authoritative. Approved fixes: DV-M15-01 (tables scroll in their card), 04 ("Admin Tebusan" → queue; applied by the shell), 07 (out-of-range page message), 08 (405 → 404), 12 (header titles), 13 (text ≥ 12px), 14 (hint "1 token = RM1", v1.1). Privacy: DV-M15-15 (fictitious students 3151/3152). Rejected — replicate live: DV-M15-02, 05, 06, 09, 10, 11. Open: DV-M15-03 (shop catalogue source, OQ-M15-01).

---

## 1. Scope

The M15 prototype implements, against the mock service layer, the screens of URS §1: the admin catalogue S1 with its bulk actions, the reward form S3/S4, the redemption queue S2 with the PROPOSED fulfilment controls, the student shop S5 (observed empty state only), the mystery box S6 with the PROPOSED opening flow, the lucky-draw page S7 with the PROPOSED ticket flow over M14 draws, the parent consent page S8 with the PROPOSED approve/reject flow, and the 404 outcomes (incl. S9). M15 owns the hadiah rewards, the redemptions, the mystery-box configuration and the openings (D12). It reads and writes the wallet, the ledger and the draws only through M14's contract, and users and parent links only through M01/M02.

**Out of scope:** URS §8 — the wallet and conversion (M14), `/admin/reward-control` (M14), the teacher shop (M14), the populated student shop (not built, user decision OQ-M15-01), code display to students, the mystery-box configuration UI, winners, real delivery integrations, the backend.

---

## 2. Screens & routes

| # | Route | Screen | Primary actor(s) | Shell · header / tab title | API (§7) |
|---|---|---|---|---|---|
| S1 | `/admin/hadiah` (`?cat=`, `?page=`) | Catalogue + bulk actions | Admin | SHA · "Admin — Kedai Hadiah" (no subtitle) / "Admin — Kedai Hadiah" | #1, #5 |
| S2 | `/admin/hadiah/tebusan` (`?status=`, `?page=`) | Redemption queue | Admin | SHA · "Admin — Tebusan Hadiah" / "Admin — Tebusan Hadiah" | #6, #7, #8 |
| S3 | `/admin/hadiah/baharu` | Create form | Admin | SHA · "Tambah Hadiah" / "Tambah Hadiah" | #3 |
| S4 | `/admin/hadiah/{id}/edit` | Edit form | Admin | SHA · "Edit Hadiah" / "Edit Hadiah" | #2, #4 |
| S5 | `/gamification/rewards` | Student shop (empty state for every account; user decision) | Pelajar; any logged-in user | SHU · "Kedai Hadiah" + "Selamat datang kembali" / "Kedai Hadiah" | #17 |
| S6 | `/gamification/mystery-box` | Mystery box | Pelajar; any logged-in user | SHU · "Kotak Misteri" + "Selamat datang kembali" / "Kotak Misteri — PRESTASIPLUS" | #10, #11 |
| S7 | `/cabutan` | Lucky draw | Pelajar; any logged-in user | SHU · "Cabutan Bertuah" + "Selamat datang kembali" / "Cabutan Bertuah - PRESTASIPLUS" | #12, #13 |
| S8 | `/cikgu/kelulusan-hadiah` | Parent consent | Ibu Bapa; any logged-in user (scoped) | SHU · "Kelulusan Tebusan Hadiah" + "Selamat datang kembali" / "Kelulusan Hadiah — Ibu Bapa" | #14, #15, #16 |
| S9 | GET `/admin/hadiah/{id}` | 404 (DV-M15-08) | All | standalone · "404 - Halaman Tidak Dijumpai \| PRESTASIPLUS" | — |
| — | `/gamification/rewards/1`, `/gamification/rewards/history`, `/gamification/redemptions`, `/gamification/mystery-box/1`, `/gamification/mystery-box/history`, `/cabutan/1`, `/cabutan/sejarah`, `/admin/cabutan`, `/admin/mystery-box`, `/admin/hadiah/tebusan/1`, `/admin/hadiah/{unknown or non-numeric}/edit` | 404 | All | standalone 404 | — |

`{id}` is an integer. Query names keep the live names (`cat`, `page`, `status`); unknown values are handled as live (§4). No route exists for a reward detail, a redemption detail, a student history or a mystery-box/cabutan admin.

---

## 3. Functional requirements

| ID | Requirement | FN | AC |
|---|---|---|---|
| FR-M15-01 | The user-portal menu SHALL hold the M15 entries of URS FN-M15-1.1.1, 1.1.2 and 1.1.4 with their labels, icons and icon colours ("Cabutan Bertuah": icon `fa-ticket text-fuchsia-500` plus the separate gradient badge pill "🎟️" `from-fuchsia-100 to-pink-100 text-fuchsia-700`, `text-[10px]` in the sidebar and `text-[9px]` in the mobile menu; sidebar "Kedai Hadiah" `fa-gift icon-gift`, mobile-menu "Kedai Hadiah" `fa-gift text-pink-500`), group positions and targets; the sidebar follows the live order; the mobile menu replicates the live capture ("Cabutan Bertuah", "Kedai Hadiah", "Kotak Misteri", "Urus Hadiah"; no "Kelulusan Hadiah") until the shell owner unifies the lists (DV-SH-04, XR-M15-11). | 1.1.1, 1.1.2, 1.1.4 | 01.1, 01.2 |
| FR-M15-02 | The sidebar entry "Admin Tebusan" (`fa-cogs`, slate-500, group "Cikgu Alesa Tools") SHALL link to `/admin/hadiah/tebusan` (DV-M15-04); it is not in the mobile menu (as live). | 1.1.3 | 01.2, 01.3 |
| FR-M15-03 | The admin-panel sidebar group "Gamifikasi" SHALL hold "Kedai Hadiah" (`fa-gift`) → `/admin/hadiah` between "Transaksi" and "Gamifikasi Guru"; the bottom-nav "Lagi" popover section "Gamifikasi" SHALL hold the same entry. | 1.1.5 | 01.4 |
| FR-M15-04 | Active items: admin-panel "Kedai Hadiah" on S1–S4; user-portal "Kedai Hadiah" on S5, "Kotak Misteri" on S6, "Cabutan Bertuah" on S7, "Kelulusan Hadiah" on S8; in the **sidebar** the active entry's icon drops its colour class ("Kedai Hadiah" also drops `icon-gift`), while the mobile drawer keeps the icon colour on the active entry (as live). | 1.1.6 | 01.5 |
| FR-M15-05 | Each M15 route SHALL declare its shell header (DV-M15-12, shell rule DV-SH-03): S1–S4 the tab title with no subtitle; S5–S8 the h1 without its leading emoji with "Selamat datang kembali" (URS FN-M15-1.1.7). No M15 page shows the fallback "Dashboard". | 1.1.7 | 01.6 |
| FR-M15-06 | Tab titles SHALL be the exact live strings of URS FN-M15-1.1.8; S1–S4 SHALL render in the admin-panel shell and S5–S8 in the user-portal shell for every role; 404 outcomes use the standalone 404 layout. | 1.1.8, 1.1.9 | 01.7 |
| FR-M15-07 | (INFERRED) Every M15 route SHALL redirect a guest to `/login` (M01 FR-M01-14); every M15 endpoint returns `401 UNAUTHORIZED`. | 1.2.1 | 02.1 |
| FR-M15-08 | (INFERRED) `/admin/hadiah*` routes SHALL require role `admin`; any other role is sent to its M01 landing page (BR-07) and the admin endpoints (#1–#8) return `403 FORBIDDEN`. | 1.2.2 | 02.2 |
| FR-M15-09 | S5–S8 SHALL open for every logged-in role; S8 and #14–#16 are scoped to the viewer's linked children (BR-M15-20). | 1.2.3 | 02.3 |
| FR-M15-10 | The global 404 page (M01; "Mula Latihan" → `/practice`) SHALL render for the probed routes of §2, and for `/admin/hadiah/{id}/edit` when the id is unknown, deleted or not numeric. | 1.2.4 | 02.4 |
| FR-M15-11 | GET `/admin/hadiah/{id}` SHALL render the global 404 page (DV-M15-08); the framework 405 page SHALL NOT be reproduced. | 1.2.5 | 02.5 |
| FR-M15-12 | S1 SHALL show h1 "🎁 Admin — Kedai Hadiah Digital", the sub "Urus catalog hadiah + proses tebusan pelajar." and the button links "Tebusan Queue" (`fa-clipboard-list`, `#3b82f6`) → `/admin/hadiah/tebusan` and "Tambah Hadiah" (`fa-plus`, `#10b981`) → `/admin/hadiah/baharu`. | 2.1.1, 2.1.2, 2.1.3 | 03.1 |
| FR-M15-13 | S1 SHALL show four cards "Total Hadiah" (Q-M15-TOTAL), "Aktif" (Q-M15-ACTIVE), "Tebusan Bulan Ini" (Q-M15-RED-MONTH), "Pending Proses" (Q-M15-PENDING-ADMIN) with the live styles; the cards SHALL NOT depend on `cat` or `page`; grid 2×2 below `md`, 4 columns from `md`. | 2.1.4, 2.1.5, 2.1.6, 2.1.7, 2.1.8 | 03.2, 03.3 |
| FR-M15-14 | S1 SHALL show the ten category pills of URS FN-M15-2.2.1 as GET links with the live styles; no `cat` (or `cat=all`) activates "Semua" and lists all rewards; a known key activates its pill and lists Q-M15-CAT(key); an unknown key activates no pill and lists nothing (200). | 2.2.1, 2.2.2 | 04.1, 04.2, 04.3 |
| FR-M15-15 | The S1 table SHALL have the columns of URS FN-M15-2.3.1 and the row cells of FN-M15-2.3.2 (long category label, "∞" for a null stock, Tebusan = Q-M15-RED-REWARD(id), pill "Off" for an inactive reward), ordered by `displayOrder` ascending then `id` ascending (BR-M15-02). | 2.3.1, 2.3.2 | 04.4, 04.5 |
| FR-M15-16 | An active reward's Status pill SHALL read "On" on `#10b981`/white, same shape and size as "Off" (PROPOSED; provisional). | 2.3.3 | 07.1 |
| FR-M15-17 | Each row's Tindakan SHALL hold only the link "Edit" (`#3b82f6`) → `/admin/hadiah/{id}/edit`. | 2.3.4 | 04.6 |
| FR-M15-18 | When the filtered set is empty the table body SHALL be one full-width row "Tiada hadiah dalam kategori ini.". | 2.3.5 | 04.3 |
| FR-M15-19 | S1 SHALL page by 50 (BR-M15-02) with the Laravel Tailwind pager from 640px: "Showing {from} to {to} of {total} results", page links (current page not a link), previous/next arrows, the live `aria-label`s; no pager when one page suffices; pager links carry only `page`. | 2.4.1, 2.4.4 | 05.1, 05.2 |
| FR-M15-20 | Below 640px the pager SHALL show "« Previous" / "Next »" (a non-link span at either end). | 2.4.2 | 05.3 |
| FR-M15-21 | A page beyond the last SHALL show the pager "Showing 0 of {total} results" with its page links and the row "Tiada hadiah di halaman ini." when the filtered set is not empty (DV-M15-07, PROPOSED COPY), or "Tiada hadiah dalam kategori ini." when it is empty. | 2.4.3 | 05.4 |
| FR-M15-22 | S1 SHALL wrap toolbar and table in one form (POST `/admin/hadiah/bulk` on live; mock #5) with the hidden fields of URS FN-M15-2.5.1; each row SHALL have a checkbox `ids[]` (value = id) that updates the toolbar on change; the header checkbox SHALL tick/untick every rendered row on change; the header checkbox is ticked only when every rendered row is ticked; selection is per page. | 2.5.1, 2.5.2 | 06.1, 06.2 |
| FR-M15-23 | The toolbar SHALL be hidden while no row is ticked and shown (sticky, `top-2`) with "{n} hadiah dipilih" and the seven buttons of URS FN-M15-2.5.3 otherwise. | 2.5.3 | 06.1, 06.3 |
| FR-M15-24 | The toolbar "Batal" SHALL untick every checkbox and hide the toolbar without navigating or sending a request. | 2.5.4 | 06.4 |
| FR-M15-25 | "Aktifkan" / "Nyahaktifkan" SHALL ask the browser `confirm("Aktifkan {n} hadiah?")` / `confirm("Nyahaktifkan {n} hadiah?")`; OK → #5 `activate` / `deactivate` (BR-M15-11); Cancel → nothing. | 2.6.1, 2.6.2 | 07.1, 07.2, 07.3 |
| FR-M15-26 | "Padam" SHALL ask `confirm("Padam {n} hadiah secara kekal? (Hadiah dengan sejarah tebusan tidak akan dipadam)")`; OK → #5 `delete`: rewards without any redemption row are removed permanently, the others are kept (BR-M15-24). | 2.6.6 | 07.2, 07.4 |
| FR-M15-27 | "Set Stok" SHALL run the live prompt and checks of URS FN-M15-2.6.3 (BR-M15-12); a valid entry → #5 `set_stock` with `stockValue` ("" → null). | 2.6.3 | 08.1, 08.2 |
| FR-M15-28 | "Had/Bulan" SHALL run the live prompt and checks of URS FN-M15-2.6.4; a valid entry → #5 `set_max_per_month`; "" and "0" store null (no cap). | 2.6.4 | 08.3 |
| FR-M15-29 | "Pelaras Token" SHALL run the live prompt, `parseInt` check, alert and confirmation of URS FN-M15-2.6.5; OK → #5 `set_token_cost` with `tokenCostDeltaPct` = the raw trimmed text (as live); the mock parses it with `parseInt` semantics (BR-M15-11; PROPOSED) and computes the new cost (rounding PROPOSED). | 2.6.5 | 08.4, 08.5 |
| FR-M15-30 | (INFERRED) After a successful #5 the page SHALL reload the same list URL (`cat`, `page` kept), with no tick and no message. | 2.6.7 | 07.5 |
| FR-M15-31 | S3 SHALL render the card, back link, h1 and the 17 fields of URS FN-M15-3.1.1–3.1.11 with their exact labels, names, types, constraints, placeholders, hint and defaults, in the layout of FN-M15-3.1.12 (one column below `md`). | 3.1.1, 3.1.2, 3.1.3, 3.1.4, 3.1.5, 3.1.6, 3.1.7, 3.1.8, 3.1.9, 3.1.10, 3.1.11, 3.1.12 | 09.1, 09.2 |
| FR-M15-32 | "➕ Tambah" SHALL rely on native validation (§5); a valid form → #3; on success navigate to `/admin/hadiah` with no message (INFERRED). | 3.1.13 | 09.3, 09.4 |
| FR-M15-33 | S3 "Batal" and "← Kembali ke senarai" SHALL be plain links to `/admin/hadiah` (no confirm; typed values discarded). | 3.1.14 | 09.5 |
| FR-M15-34 | S4 SHALL load the record (#2), render h1 "✏️ Edit Hadiah: {title}" and the S3 fields pre-filled (BR-M15-13); the form targets `/admin/hadiah/{id}` with `_method=PUT`. | 3.2.1, 3.2.2, 3.2.3 | 10.1, 10.2 |
| FR-M15-35 | "💾 Simpan" SHALL rely on native validation; a valid form → #4; on success navigate to `/admin/hadiah` with no message (INFERRED). | 3.2.4 | 10.3 |
| FR-M15-36 | S4 "Batal" and "← Kembali ke senarai" SHALL link to `/admin/hadiah` (discard); S4 SHALL have no delete control. | 3.2.5, 3.2.6 | 10.4 |
| FR-M15-37 | S2 SHALL show h1 "📋 Admin — Tebusan Hadiah Pelajar", the sub "Beli kod dari reseller, paste kat sini untuk hantar kepada pelajar." and "Kembali ke Catalog" (`fa-store`, `#7c3aed`) → `/admin/hadiah`. | 4.1.1, 4.1.2 | 11.1 |
| FR-M15-38 | S2 SHALL show the five status pills of URS FN-M15-4.1.3 as GET links; no `status` → `pending_admin` (active pill "⏳ Pending Admin"); `all` → every status; an unknown value → no pill active, empty list (BR-M15-15). | 4.1.3 | 11.2, 11.4 |
| FR-M15-39 | S2 SHALL list the matching redemptions (#6) with the columns and cells of URS FN-M15-4.1.4 ("dd/mm HH:MM" in Asia/Kuala_Lumpur, no year), newest first then id descending, 50 per page with the S1 pager; a cancelled row shows "❌ Dibatalkan" (`#64748b`) and an empty Tindakan; an empty list shows the row "Tiada tebusan dalam status ini.". | 4.1.4, 4.1.5, 4.1.7 | 11.3 |
| FR-M15-40 | Rows of the statuses `pending_admin`, `pending_parent_consent`, `delivered` SHALL show the PROPOSED pills "⏳ Pending Admin" (`#f59e0b`), "⏳ Pending Ibu Bapa" (`#8b5cf6`), "🎁 Delivered" (`#10b981`), white, same shape as "❌ Dibatalkan" (provisional). | 4.1.6 | 12.1 |
| FR-M15-41 | A `pending_admin` row SHALL offer a text field (placeholder "Kod voucher", `required`, maxlength 100) and "Hantar" (`#10b981`); submit → #7 (BR-M15-10); the row leaves the pending list (PROPOSED UI; provisional). The code is stored and not displayed to the student anywhere in M15. | 4.2.1, 4.3.3 | 12.2 |
| FR-M15-42 | A `pending_admin` row SHALL offer "Batalkan" (`#dc2626`, no confirm) → #8 (BR-M15-09) (PROPOSED UI; provisional). | 4.2.2 | 12.3 |
| FR-M15-43 | Rows in `pending_parent_consent`, `delivered` and `cancelled` SHALL have an empty Tindakan cell. | 4.2.3 | 11.3, 12.1 |
| FR-M15-44 | The redemption rule (#9 and the hook `m15Redeem`) SHALL apply BR-M15-05…08 in one atomic step, returning the error codes of §7 on refusal and changing nothing (provisional). | 4.3.1 | 13.1, 13.2, 13.3, 13.4 |
| FR-M15-45 | Every M15 count SHALL come from the named queries of §6.8 (cancelled rows excluded from Q-M15-RED-REWARD and Q-M15-RED-MONTH). | 4.3.2 | 13.5 |
| FR-M15-46 | S5 SHALL render the hero, the balance tile ("{tokenBalance}" from M14 #17 / "Baki Token 🎫") and the empty state of URS FN-M15-5.1.1–5.1.3 with the live sizes; query parameters are ignored. | 5.1.1, 5.1.2, 5.1.3, 5.1.4 | 14.1, 14.2, 14.3 |
| FR-M15-47 | **User decision (OQ-M15-01 closed, 2026-09-26: follow live):** S5 SHALL render the empty state for every account and every catalogue state; no reward card, claim control, shop catalogue source or shop endpoint is built (#18 not built). | 5.1.5 | 14.4 |
| FR-M15-48 | S6 SHALL render the hero, the chip "🎫 Token Anda: {tokenBalance}", and the four box cards and forms of URS FN-M15-6.1.1–6.1.3 from DATA-M15-03, with the live hover behaviour (FN-6.1.5). | 6.1.1, 6.1.2, 6.1.3, 6.1.5 | 15.1, 15.2 |
| FR-M15-49 | Each box button SHALL be disabled with "🔒 Token Tidak Cukup" (`#d1d5db`, `not-allowed`) when `tokenBalance < costTokens` (BR-M15-17). | 6.1.4 | 15.3, 16.1 |
| FR-M15-50 | Otherwise the button SHALL be enabled with the PROPOSED label "Buka Kotak" on the box gradient (provisional). | 6.2.1 | 16.1 |
| FR-M15-51 | Submitting an enabled box SHALL call #11 (BR-M15-18) and, on success, update the chip to the returned token balance (provisional). | 6.2.2 | 16.2, 16.4 |
| FR-M15-52 | A successful opening SHALL show the result modal of URS FN-M15-6.2.3 (full-screen below `md`, 400px centred from `md`); "Tutup" and the overlay close it (provisional). | 6.2.3 | 16.2 |
| FR-M15-53 | S6 SHALL show the history card of URS FN-M15-6.2.4 below the grid when the viewer has openings (newest first, 10 at most, PROPOSED), and no card otherwise (provisional). | 6.2.4 | 16.3 |
| FR-M15-54 | S7 SHALL render the header with "Syiling anda" / "{syilingBalance} 🪙" (M14 #17), h2 "Cabutan Dibuka" and, with no open draw, the empty box "Tiada cabutan dibuka buat masa ini. Nanti datang lagi! 🎈"; no closed-draw or winner section. | 7.1.1, 7.1.2, 7.1.5 | 17.1 |
| FR-M15-55 | S7 SHALL render one card per open draw (#12, BR-M15-19) with the PROPOSED content of URS FN-M15-7.1.3, ordered by close date then id (provisional). | 7.1.3, 7.1.5 | 18.1 |
| FR-M15-56 | "🎟️ Beli Tiket" SHALL call #13 (M14 `draws.buyTicket`, which debits the syiling and writes its ledger row) and update the tile and "Tiket anda" from the response; it is disabled when the balance is below the ticket price or the cap is reached (provisional). | 7.1.4 | 18.2, 18.3 |
| FR-M15-57 | S8 SHALL render h1, sub, "⏳ Menunggu Kelulusan ({n})" with its empty box and "📜 Sejarah Tebusan Anak" with its empty text (URS FN-M15-8.1.1–8.1.3), from #14. | 8.1.1, 8.1.2, 8.1.3 | 19.1 |
| FR-M15-58 | #14–#16 SHALL be scoped to the redemptions of the viewer's linked children (M02 links, BR-M15-20); any other id → `404 NOT_FOUND` (provisional). | 8.1.7 | 19.2, 20.4 |
| FR-M15-59 | Each pending request SHALL render the PROPOSED card of URS FN-M15-8.1.4 (provisional). | 8.1.4 | 20.1 |
| FR-M15-60 | "✅ Lulus" → #15, "❌ Tolak" → #16 (BR-M15-09, BR-M15-20); the page refreshes both lists (provisional). | 8.1.5 | 20.2, 20.3 |
| FR-M15-61 | The history SHALL list the children's redemptions that are not `pending_parent_consent`, newest first, with the PROPOSED row of URS FN-M15-8.1.6 (provisional). | 8.1.6 | 20.2, 20.3 |
| FR-M15-62 | Every M15 screen SHALL follow §10: no horizontal page scroll at 320–1920px; the S1 and S2 tables scroll inside their card where they do not fit (DV-M15-01); other layouts as live. | 9.1.1 | 21.1, 21.2, 21.3 |
| FR-M15-63 | No text inside M15 page content SHALL be smaller than 12px (DV-M15-13); icons and emoji keep their live size. | 9.1.2 | 21.4 |
| FR-M15-64 | Accessibility SHALL replicate live (D10): browser `confirm`/`prompt`/`alert` for the bulk actions, native validation bubbles, no added ARIA beyond the live pager labels, unlabelled row checkboxes as live. | 9.1.3 | 21.5 |
| FR-M15-65 | Loading and error states SHALL follow the shared conventions (SRS.md FR-G-10); M15 adds no error copy. | 9.1.4 | 21.6 |
| FR-M15-66 | Every balance read and every token, syiling or XP movement SHALL go through the M14 wallet contract (XR-M15-01/02) inside the same atomic step as the M15 change; M15 stores no balance of its own (D12). | 9.1.5 | 13.2, 16.4 |

### 3.1 Traceability (US → FR → E2E)

| US | FR | E2E |
|---|---|---|
| US-M15-01 | 01–06 | 01, 02, 03, 04 |
| US-M15-02 | 07–11 | 05, 06, 07, 08, 09 |
| US-M15-03 | 12, 13 | 10, 11 |
| US-M15-04 | 14, 15, 17, 18 | 12, 13 |
| US-M15-05 | 19, 20, 21 | 14, 15, 16 |
| US-M15-06 | 22, 23, 24 | 17 |
| US-M15-07 | 16, 25, 26, 30 | 18, 19, 20, 21 |
| US-M15-08 | 27, 28, 29 | 22, 23, 24, 25, 26 |
| US-M15-09 | 31, 32, 33 | 27, 28, 29, 30 |
| US-M15-10 | 34, 35, 36 | 31, 32, 33 |
| US-M15-11 | 37, 38, 39, 43 | 34, 35 |
| US-M15-12 | 40, 41, 42, 43 | 36, 37, 38 |
| US-M15-13 | 44, 45, 66 | 39, 40 |
| US-M15-14 | 46, 47 | 41, 42 |
| US-M15-15 | 48, 49 | 43 |
| US-M15-16 | 49–53, 66 | 44, 45, 46 |
| US-M15-17 | 54 | 47 |
| US-M15-18 | 55, 56 | 48, 49 |
| US-M15-19 | 57, 58 | 50, 51 |
| US-M15-20 | 58–61 | 51, 52, 53 |
| US-M15-21 | 62–65 | 54, 55, 56, 57 |

Checked by script (`trace.cjs`, author scratchpad `m15-writer/`): every FN of URS §3 has at least one FR; every AC has at least one FR and one E2E; every FR has at least one E2E; every provisional AC is covered only by provisional E2E and every provisional E2E covers at least one provisional AC; no table row has an unescaped `|`.

---

## 4. Business rules

| ID | Rule | Source |
|---|---|---|
| BR-M15-01 | **Categories** (key → pill / form option / table label): `flagship` "🏆 Mahkota" / "🏆 Mahkota (RM500+)" / "🏆 Mahkota"; `ewallet` "💳 E-Wallet" (all three); `telco` "📱 Telco" / "📱 Telco" / "📱 Telco Topup"; `gaming` "🎮 Gaming"; `streaming` "🎬 Streaming"; `food_beverage` "🍔 F&B" / "🍔 F&B" / "🍔 Makanan & Minuman"; `ecommerce` "🛒 E-Commerce"; `education` "📚 Pembelajaran"; `entertainment` "🎭 Hiburan". Pill order = this order after "Semua" (`all`); form option order = this order. | OBSERVED (DV-M15-02 replicate) |
| BR-M15-02 | **Catalogue order and paging.** `displayOrder` ascending, then `id` ascending; 50 per page; `from`/`to` are 1-based positions in the filtered set; beyond the last page `from`/`to` are null and the pager reads "Showing 0 of {total} results". | OBSERVED (order, 50, pager) / INFERRED (tie-break) |
| BR-M15-03 | **Cards.** Total = Q-M15-TOTAL; Aktif = Q-M15-ACTIVE; Tebusan Bulan Ini = Q-M15-RED-MONTH; Pending Proses = Q-M15-PENDING-ADMIN (§6.8). Independent of `cat` and `page`. | OBSERVED (values, independence) / INFERRED (definitions) |
| BR-M15-04 | **Tebusan column** = Q-M15-RED-REWARD(rewardId): the reward's redemptions whose status is not `cancelled` (rewards 10 and 16 show 0 with cancelled rows, OBSERVED). | OBSERVED / INFERRED |
| BR-M15-05 | **Eligibility of a redemption** (refusal code in brackets, checked in this order): reward exists and `isActive` (`NOT_FOUND`); `stockQuantity` null or ≥ 1 (`OUT_OF_STOCK`); if `maxPerMonthPerStudent` is set, the student's non-cancelled redemptions of the reward created in the current calendar month (Asia/Kuala_Lumpur, mock clock) < the cap (`MONTHLY_CAP`); the student's M14 token balance ≥ `tokenCost` (`INSUFFICIENT_TOKENS`). No budget check: M14 SRS §6.13 (XR-M15-06) confirms the RM10/RM3 budget applies only to M14's syiling-priced catalogue (OQ-M15-12 closed). | INFERRED (provisional) |
| BR-M15-06 | **Effects of a redemption** (one atomic step): M14 debits `tokenCost` tokens (`source: 'hadiah_redeem'`, `refId`); if `stockQuantity` is not null it decreases by 1 and `stockReserved = true`; the redemption stores the snapshot `rewardTitle`, `rewardVendor`, `rewardIcon`, `denominationRm`, `tokenCost`. A later price or title change does not alter existing rows. | INFERRED (provisional) |
| BR-M15-07 | **Initial status:** `pending_parent_consent` when the reward's `requiresParentConsent` is true, otherwise `pending_admin`. | INFERRED from the status keys, the consent field and the S8 copy |
| BR-M15-08 | **Status machine:** `pending_parent_consent` → `pending_admin` (parent approves) or `cancelled` (parent rejects); `pending_admin` → `delivered` (admin pastes a code) or `cancelled` (admin cancels); `delivered` and `cancelled` are final. Any other transition → `409 CONFLICT`. Students cannot cancel. | INFERRED (discovery §3.1; provisional) |
| BR-M15-09 | **Cancellation** (admin #8 or parent #16): status `cancelled`, `cancelledAt` = now, `cancelledBy` = `admin` \| `parent`; M14 credits back `tokenCost` tokens once (`source: 'hadiah_refund'`); if `stockReserved`, stock increases by 1 and `stockReserved = false`. | INFERRED (Q-M15-8; provisional) |
| BR-M15-10 | **Delivery** (#7): only from `pending_admin`; `voucherCode` = the trimmed code (1–100 characters, PROPOSED limit); `deliveredAt` = now; `expiresAt` = now + `voucherValidityDays` days (from the reward at delivery time); status `delivered`. | INFERRED (S2 subtitle, "Manual (admin paste)", "Sah Hari"; provisional) |
| BR-M15-11 | **Bulk actions** (#5) on the given ids (unknown ids ignored): `activate` → `isActive = true`; `deactivate` → false; `set_stock` → `stockQuantity` = null for "" else the integer (0–999999); `set_max_per_month` → null for "" or "0", else 1–99; `set_token_cost` → `pct = parseInt(tokenCostDeltaPct, 10)` on the raw trimmed text (leading integer: "12.7" → 12, "+50abc" → 50, "50%" → 50; PROPOSED, mirrors the client check; live server UNVERIFIED), refused with `422` only when `pct` is NaN, 0 or outside −90…500; then for each reward `tokenCost = max(1, min(10000, round(tokenCost × (1 + pct/100))))` (`round` half up; PROPOSED — live rounds server-side), `denominationRm` unchanged; `delete` → BR-M15-24. The server re-checks the client limits and answers `422` otherwise. | SOURCE-DERIVED (actions, limits) / INFERRED (effects) / PROPOSED (rounding) |
| BR-M15-12 | **Bulk client checks** (page script): "Set Stok" text must be "" or match `^\d+$` and ≤ 999999; "Had/Bulan" "" or `^\d+$` and ≤ 99; "Pelaras Token" `parseInt(trimmed)` must be a number with −90 ≤ n ≤ 500 and n ≠ 0, and the **raw trimmed text** (not n) is submitted; a failed check shows the live alert and sends nothing; a cancelled prompt or confirm sends nothing; 0 ticks → nothing (toolbar hidden). | SOURCE-DERIVED |
| BR-M15-13 | **Form ↔ record.** Create defaults: `category` first option (`flagship`), `voucherValidityDays` 365, `deliveryMethod` `manual`, `displayOrder` 100, `isActive` true, `requiresParentConsent` false, other fields empty. Empty optional fields store null; S4 renders null numbers as empty inputs and null texts as empty. `tokenCost` and `denominationRm` are independent (equal on every live row, not linked). | OBSERVED |
| BR-M15-14 | **Ids.** Rewards keep live ids 1–59; a new reward gets (highest id ever issued) + 1 = 60 on a fresh seed; deleted ids are never reused. Redemptions and openings created at runtime get ids from 9,000,001 (TRACKER floor, M13 precedent). | OBSERVED (1–59) / PROPOSED (runtime) |
| BR-M15-15 | **Queue filter.** `status` absent → `pending_admin`; one of the four keys → that status; `all` → every status; anything else → empty list, no pill active. | OBSERVED |
| BR-M15-16 | **Dates.** S2 and S8 rows "dd/mm HH:MM" (24-hour, zero-padded, Asia/Kuala_Lumpur, no year); S7 close date "dd/mm/yyyy" (PROPOSED). Storage ISO 8601 +08:00. | OBSERVED (S2) / PROPOSED (S7, S8) |
| BR-M15-17 | **Mystery-box availability:** a box is openable when the viewer's M14 token balance ≥ its `costTokens`; otherwise disabled with "🔒 Token Tidak Cukup". No daily limit (none observed). | OBSERVED (disabled at 0 < 2) / INFERRED (rule) |
| BR-M15-18 | **Opening** (#11; one atomic step): re-check BR-M15-17 (`409 INSUFFICIENT_TOKENS`); M14 debits `costTokens` tokens (`source: 'mystery_box'`); coins and XP are drawn as integers in [`coinMin`, `coinMax`] and [`xpMin`, `xpMax`] — **prototype mechanism (PROPOSED): uniform, from a PRNG seeded by (userId, opening count); this is not a statement of the live odds, which are UNVERIFIED**; the hook `m15MysteryNext({coins, xp})` fixes the next result; M14 credits the coins with the ledger description "Kotak Misteri: {name}" (format OBSERVED in the M14 ledger) and the XP; an opening row is stored. | OBSERVED (ranges, ledger text) / UNVERIFIED (odds) / PROPOSED (mechanism) |
| BR-M15-19 | **Draws** (M14 store DATA-M14-18/19, M14 BR-M14-29): S7 lists `draws.listOpenDraws(today)` = status `open` and `closesAt` ≥ today (Asia/Kuala_Lumpur). #13 calls `draws.buyTicket(drawId, userId)`: one ticket per call; refused with `DRAW_CLOSED` (draw not open), `TICKET_LIMIT` (the user already holds `maxTicketsPerStudent`) or `INSUFFICIENT_BALANCE` (`currentSyiling` < `ticketCostSyiling`); on success M14 itself debits the syiling and writes the ledger `spend` row "Tiket Cabutan: {title}" (M14 PROPOSED COPY, source `cabutan_ticket`) and a DrawTicket row. M15 makes no separate wallet call for tickets. Winner selection is M14's (not built). | OBSERVED (fields, syiling) / INFERRED / PROPOSED |
| BR-M15-20 | **Parent scope.** The viewer's children = M02 ParentStudentLink rows with `parentId` = viewer. S8 pending = children's `pending_parent_consent` redemptions (newest first); history = children's other redemptions (newest first). #15/#16 accept only a `pending_parent_consent` redemption of a child (`404` otherwise, `409` if it is no longer pending). Approve → `pending_admin`, `parentDecisionBy` = viewer, `parentDecidedAt` = now. | INFERRED (provisional) |
| BR-M15-21 | **Wallet atomicity:** every M15 step that moves tokens, syiling or XP calls the M14 contract once, inside the same mock transaction as the M15 write; if M14 refuses (`INSUFFICIENT_BALANCE`), nothing is written. | D12 / PROPOSED |
| BR-M15-22 | **Shop:** S5 lists nothing for every account, including when rewards are active; the balance tile still reads the token balance. No shop catalogue source is modelled. | User decision (OQ-M15-01, 2026-09-26) |
| BR-M15-23 | **Error outcomes:** GET `/admin/hadiah/{id}` and every unknown M15 path render the global 404 page (DV-M15-08); an unknown, deleted or non-numeric edit id → 404. | OBSERVED + DV-M15-08 |
| BR-M15-24 | **Delete:** a reward with at least one redemption row of any status is kept; the others are removed with every field; the response lists the kept ids (not shown on the page). | SOURCE-DERIVED (dialog promise) / INFERRED ("history" = any row) |
| BR-M15-25 | **Current month** for Q-M15-RED-MONTH and BR-M15-05 = the calendar month of the mock clock in Asia/Kuala_Lumpur (2026-09 at the anchor). | INFERRED |

---

## 5. Validation rules

| Screen | Field | Rule (client, native) | Message |
|---|---|---|---|
| S3/S4 | `category` | `required`; always has a value | — |
| S3/S4 | `vendor` | `required`, `maxlength=100` (typing stops) | browser-native (Chrome "Please fill out this field.") |
| S3/S4 | `title` | `required`, `maxlength=200` | native |
| S3/S4 | `description` | `maxlength=1000` | typing stops |
| S3/S4 | `denomination_rm` | number, `required`, min 1, max 10000 | native range/required |
| S3/S4 | `token_cost` | number, `required`, min 1, max 10000 | native |
| S3/S4 | `icon_emoji` | `maxlength=8` | typing stops |
| S3/S4 | `stock_quantity` | number, min 0 | native |
| S3/S4 | `max_per_month_per_student` | number, min 1, max 99 | native |
| S3/S4 | `voucher_validity_days` | number, min 1, max 1825 | native |
| S3/S4 | `delivery_method` | select of 3 | — |
| S3/S4 | `vendor_sku` | `maxlength=100` | typing stops |
| S3/S4 | `display_order` | number, min 0, max 9999 | native |
| S3/S4 | `image_url` | type url, `maxlength=500` | native ("Please enter a URL.") |
| S3/S4 | `terms_text` | `maxlength=2000` | typing stops |
| S1 bulk | Set Stok / Had/Bulan / Pelaras Token | BR-M15-12 | the three live alerts (§8.1) |
| S2 | code field (PROPOSED) | `required`, `maxlength=100`, trimmed on the server | native |

Server-side (mock #3/#4/#5/#7) re-checks the same limits and returns `422 VALIDATION_ERROR` with field keys; the UI cannot reach these responses through the native checks, so no BM field copy is specified (none observed; Q-M15-7).

---

## 6. Data entities & fields

*(solution-architect)* M15 stores are small **materialised** tables seeded from fixtures and reset per E2E test (`mock.reset()`), persisted as a row diff (architecture §6.11). They are not D11 virtual datasets: every live total M15 shows is small and fully observed (59 rewards, 3 redemptions, 4 boxes, 0 openings), so the stores hold every row and every count is a named query over them (§6.8). JSON fields are camelCase; the page forms keep the live snake_case field names and the page maps them. Ids are integers. "Now" is the mock clock (anchor 2026-09-25T15:40:00+08:00).

### 6.1 Referenced entities (owners; not redefined — D12)

| Entity | Owner | Fields M15 reads / asks for |
|---|---|---|
| User | M01 DATA-M01-01 / M02 §6.15 users dataset | `id`, `name`, `email`, `role` (S2 Pelajar column, S8 child name, guards) |
| ParentStudentLink | M02 DATA-M02-02 | `parentId`, `studentId` (BR-M15-20) |
| StudentWallet, CoinTransaction (ledger) | M14 (discovery §4; XR-M15-01/02) | `currentSyiling`, `tokenBalance`, `xp`; debit/credit operations with `source`, `description` |
| Draw, DrawTicket | M14 (discovery §4 "Draw (Cabutan)"; XR-M15-03) | `id`, `title`, `description`, `ticketCostSyiling`, `maxTicketsPerStudent`, `prizePool[{label, valueSen, qty}]`, `closesAt`, `status`; tickets per user |
| GamificationReward (syiling-priced catalogue, 11 items, with `costValueSen` and claims; M14 S10) | **M14 DATA-M14-17** (ownership decided, M14 SRS §6.13 XR-M15-04) | not used by M15; the shop source stays open (OQ-M15-01 = M14 OQ-M14-05) |
| TokenMovement | M14 DATA-M14-21 | written by M14 for every token debit/credit M15 requests (internal log, no screen) |

### 6.2 DATA-M15-01 — HadiahReward (owned by M15)

| Field | Type | Req | Notes (live form field) |
|---|---|---|---|
| id | int | yes | live 1–59; runtime BR-M15-14 |
| category | enum `flagship\|ewallet\|telco\|gaming\|streaming\|food_beverage\|ecommerce\|education\|entertainment` | yes | `category` |
| vendor | string ≤ 100 | yes | `vendor` |
| title | string ≤ 200 | yes | `title` (list line = `{iconEmoji} {title}`) |
| description | string ≤ 1000 \| null | no | `description` |
| denominationRm | int 1–10000 | yes | `denomination_rm` |
| tokenCost | int 1–10000 | yes | `token_cost` |
| iconEmoji | string ≤ 8 \| null | no | `icon_emoji` |
| stockQuantity | int ≥ 0 \| null | no | `stock_quantity`; null = ∞ |
| maxPerMonthPerStudent | int 1–99 \| null | no | `max_per_month_per_student`; null = no cap |
| voucherValidityDays | int 1–1825 | yes | `voucher_validity_days`, default 365 |
| deliveryMethod | enum `manual\|api\|instant` | yes | `delivery_method`, default `manual`; labels "Manual (admin paste)", "API (auto, future)", "Instant" |
| vendorSku | string ≤ 100 \| null | no | `vendor_sku` |
| displayOrder | int 0–9999 | yes | `display_order`, default 100 |
| imageUrl | url ≤ 500 \| null | no | `image_url` (stored only; SEC-M15-09) |
| termsText | string ≤ 2000 \| null | no | `terms_text` |
| isActive | bool | yes | `is_active` |
| requiresParentConsent | bool | yes | `requires_parent_consent` |
| createdAt, updatedAt | datetime | yes | not shown |

### 6.3 DATA-M15-02 — HadiahRedemption (owned by M15)

| Field | Type | Req | Notes |
|---|---|---|---|
| id | int | yes | seed 1–3; fixtures 15101–15199; runtime ≥ 9,000,001 |
| userId | int → User (student) | yes | S2 Pelajar (name, email) |
| rewardId | int → HadiahReward | yes | kept rewards only (BR-M15-24) |
| rewardTitle, rewardVendor, rewardIcon | string | yes / yes / no | snapshot (BR-M15-06); S2 shows title without icon |
| denominationRm, tokenCost | int | yes | snapshot; S2 "RM", "Token" |
| status | enum `pending_parent_consent\|pending_admin\|delivered\|cancelled` | yes | BR-M15-07/08 |
| stockReserved | bool | yes | BR-M15-06/09 |
| parentDecisionBy | int → User (parent) \| null | no | BR-M15-20 |
| parentDecidedAt | datetime \| null | no | |
| voucherCode | string ≤ 100 \| null | no | BR-M15-10; admin-only (SEC-M15-01) |
| deliveredAt, expiresAt | datetime \| null | no | BR-M15-10 |
| cancelledAt | datetime \| null | no | null on the 3 seeded rows (UNVERIFIED) |
| cancelledBy | enum `admin\|parent` \| null | no | null on the seeded rows |
| createdAt | datetime | yes | S2 "Tarikh" |

### 6.4 DATA-M15-03 — MysteryBox (owned by M15; constants, not editable — no live UI)

| id | name | description | icon | rarity | costTokens | coinMin–coinMax | xpMin–xpMax | color1 → color2 |
|---|---|---|---|---|---|---|---|---|
| 1 | Kotak Gangsa | Kotak biasa — ganjaran kecil tapi pasti! | 📦 | null | 2 | 1–20 | 1–10 | `#9ca3af` → `#6b7280` |
| 2 | Kotak Perak | Kotak lebih besar — peluang ganjaran lebih baik | 🎁 | rare (`#3b82f6`) | 5 | 10–50 | 5–25 | `#3b82f6` → `#2563eb` |
| 3 | Kotak Emas | Kotak premium — ganjaran besar menanti! | ✨ | epic (`#8b5cf6`) | 10 | 25–150 | 10–50 | `#8b5cf6` → `#7c3aed` |
| 4 | Kotak Legenda | Kotak terhebat — ganjaran WOW! | 👑 | legendary (gradient `#f59e0b` → `#ef4444`) | 25 | 100–500 | 25–100 | `#f59e0b` → `#ef4444` |

All values OBSERVED (snapshot `mysteryBox.boxes`). The M14 ledger shows real openings of "Kotak Legenda" paying +119…+479 syiling, inside 100–500 (M14 discovery §1.2).

### 6.5 DATA-M15-04 — MysteryBoxOpening (owned by M15)

| Field | Type | Req | Notes |
|---|---|---|---|
| id | int | yes | fixtures 15301–15399; runtime ≥ 9,000,001 |
| userId | int → User | yes | |
| boxId | int 1–4 | yes | |
| coins, xp | int | yes | inside the box ranges (BR-M15-18) |
| createdAt | datetime | yes | history "dd/mm HH:MM" |

### 6.6 Lookups (constants)

Categories BR-M15-01; statuses and pill labels URS FN-M15-4.1.3/4.1.5/4.1.6; delivery methods §6.2; bulk actions `activate`, `deactivate`, `delete`, `set_stock`, `set_max_per_month`, `set_token_cost`.

### 6.7 Seed — rewards (all 59, snapshot 2026-09-26 11:46 MYT; every value OBSERVED)

Every row: `isActive` **false**, `deliveryMethod` `manual`, `vendorSku` / `imageUrl` / `termsText` null. The list line is `{icon} {title}` (e.g. "🏆 Roblox Gift Card RM1000 🏆": icon "🏆", title "Roblox Gift Card RM1000 🏆"). Checks (script `seed.cjs` over the snapshot's 59 edit forms, 0 mismatches against the list rows): 59 rows; per category flagship 4, ewallet 8, telco 11, gaming 8, streaming 6, food_beverage 8, ecommerce 5, education 6, entertainment 3; consent 12 (ids 1–8, 56–59); stock 5 on 19 rows (all telco and ewallet), null on 40; monthly cap on 25 rows; validity 30 ×11, 60 ×10, 90 ×13, 365 ×25; `tokenCost` = `denominationRm` on every row; 59 distinct display orders 100…680.

| id | category | vendor | icon | title | description | denominationRm | tokenCost | stockQuantity | maxPerMonthPerStudent | voucherValidityDays | displayOrder | requiresParentConsent |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `gaming` | Roblox | 🎮 | Roblox Gift Card RM10 | Tukar untuk Robux dalam Roblox. | 10 | 10 | null (∞) | 30 | 365 | 100 | true |
| 2 | `gaming` | Roblox | 🎮 | Roblox Gift Card RM50 | ~700 Robux. Boleh beli items, premium pass. | 50 | 50 | null (∞) | 30 | 365 | 110 | true |
| 3 | `gaming` | Roblox | 🎮 | Roblox Gift Card RM100 | ~1,400 Robux + Premium 1 bulan. | 100 | 100 | null (∞) | 30 | 365 | 120 | true |
| 4 | `gaming` | Mobile Legends | 🎮 | ML 86 Diamonds | 86 Diamond untuk skin / battle pass. | 5 | 5 | null (∞) | 30 | 365 | 130 | true |
| 5 | `gaming` | Free Fire | 🎮 | FF 100 Diamonds | 100 Diamond Free Fire. | 10 | 10 | null (∞) | 30 | 365 | 140 | true |
| 6 | `gaming` | Genshin Impact | 🎮 | Genshin 60 Genesis Crystals | 60 Genesis Crystal. | 5 | 5 | null (∞) | 30 | 365 | 150 | true |
| 7 | `gaming` | PUBG Mobile | 🎮 | PUBG 60 UC | 60 Unknown Cash. | 5 | 5 | null (∞) | 30 | 365 | 160 | true |
| 8 | `gaming` | Steam | 🎮 | Steam Wallet RM30 | Steam credit untuk PC games. | 30 | 30 | null (∞) | 30 | 365 | 170 | true |
| 9 | `telco` | Hotlink | 📱 | Hotlink Topup RM5 | Reload Hotlink prepaid. | 5 | 5 | 5 | null | 30 | 180 | false |
| 10 | `telco` | Hotlink | 📱 | Hotlink Topup RM10 | Reload Hotlink prepaid. | 10 | 10 | 5 | null | 30 | 190 | false |
| 11 | `telco` | Hotlink | 📱 | Hotlink Topup RM30 | Reload Hotlink prepaid. | 30 | 30 | 5 | null | 30 | 200 | false |
| 12 | `telco` | Hotlink | 📱 | Hotlink Topup RM50 | Reload Hotlink prepaid. | 50 | 50 | 5 | null | 30 | 210 | false |
| 13 | `telco` | Celcom Xpax | 📱 | Xpax Topup RM10 | Reload Celcom Xpax. | 10 | 10 | 5 | null | 30 | 220 | false |
| 14 | `telco` | Celcom Xpax | 📱 | Xpax Topup RM30 | Reload Celcom Xpax. | 30 | 30 | 5 | null | 30 | 230 | false |
| 15 | `telco` | CelcomDigi | 📱 | CelcomDigi Topup RM10 | Reload Digi prepaid. | 10 | 10 | 5 | null | 30 | 240 | false |
| 16 | `telco` | CelcomDigi | 📱 | CelcomDigi Topup RM30 | Reload Digi prepaid. | 30 | 30 | 5 | null | 30 | 250 | false |
| 17 | `telco` | U Mobile | 📱 | U Mobile Topup RM10 | Reload U Mobile. | 10 | 10 | 5 | null | 30 | 260 | false |
| 18 | `telco` | U Mobile | 📱 | U Mobile Topup RM30 | Reload U Mobile. | 30 | 30 | 5 | null | 30 | 270 | false |
| 19 | `telco` | Yes 4G | 📱 | Yes 4G Topup RM10 | Reload Yes 4G. | 10 | 10 | 5 | null | 30 | 280 | false |
| 20 | `streaming` | Spotify | 🎵 | Spotify Premium 1 Bulan | Music streaming + offline + ad-free. | 17 | 17 | null (∞) | 12 | 60 | 290 | false |
| 21 | `streaming` | Netflix | 🎬 | Netflix Mobile 1 Bulan | Tonton drama, movies on mobile. | 17 | 17 | null (∞) | 12 | 60 | 300 | false |
| 22 | `streaming` | Netflix | 🎬 | Netflix Basic 3 Bulan | 3 bulan Netflix Basic plan. | 51 | 51 | null (∞) | 4 | 90 | 310 | false |
| 23 | `streaming` | YouTube | 📺 | YouTube Premium 1 Bulan | Ad-free + background play. | 24 | 24 | null (∞) | 12 | 60 | 320 | false |
| 24 | `streaming` | Disney+ Hotstar | 🎬 | Disney+ 1 Bulan | Marvel, Star Wars, drama. | 25 | 25 | null (∞) | 12 | 60 | 330 | false |
| 25 | `streaming` | iQiyi | 🎬 | iQiyi VIP Lite 1 Bulan | Drama Asia + variety shows. | 13 | 13 | null (∞) | 12 | 60 | 340 | false |
| 26 | `food_beverage` | McDonald's | 🍔 | McD e-Voucher RM10 | Voucher digital untuk outlet McD. | 10 | 10 | null (∞) | null | 90 | 350 | false |
| 27 | `food_beverage` | McDonald's | 🍔 | McD e-Voucher RM20 | Voucher digital untuk outlet McD. | 20 | 20 | null (∞) | null | 90 | 360 | false |
| 28 | `food_beverage` | KFC | 🍗 | KFC e-Voucher RM20 | Voucher digital outlet KFC. | 20 | 20 | null (∞) | null | 90 | 370 | false |
| 29 | `food_beverage` | Starbucks | ☕ | Starbucks e-Card RM30 | Reload Starbucks card. | 30 | 30 | null (∞) | null | 365 | 380 | false |
| 30 | `food_beverage` | Subway | 🥪 | Subway e-Voucher RM20 | Voucher Subway sandwich. | 20 | 20 | null (∞) | null | 90 | 390 | false |
| 31 | `food_beverage` | ZUS Coffee | ☕ | ZUS Coffee Voucher RM20 | Voucher ZUS app. | 20 | 20 | null (∞) | null | 90 | 400 | false |
| 32 | `food_beverage` | GrabFood | 🍱 | GrabFood Voucher RM30 | Diskaun delivery GrabFood. | 30 | 30 | null (∞) | null | 60 | 410 | false |
| 33 | `food_beverage` | foodpanda | 🐼 | foodpanda Voucher RM30 | Voucher foodpanda. | 30 | 30 | null (∞) | null | 60 | 420 | false |
| 34 | `ecommerce` | Shopee | 🛒 | Shopee Voucher RM10 | Voucher Shopee Mall / 9.9 sale. | 10 | 10 | null (∞) | null | 90 | 430 | false |
| 35 | `ecommerce` | Shopee | 🛒 | Shopee Voucher RM50 | Voucher Shopee Mall. | 50 | 50 | null (∞) | null | 90 | 440 | false |
| 36 | `ecommerce` | Shopee | 🛒 | Shopee Voucher RM100 | Voucher Shopee Mall. | 100 | 100 | null (∞) | null | 90 | 450 | false |
| 37 | `ecommerce` | Lazada | 🛍️ | Lazada Voucher RM30 | Voucher Lazada e-store. | 30 | 30 | null (∞) | null | 90 | 460 | false |
| 38 | `ecommerce` | Lazada | 🛍️ | Lazada Wallet RM50 | Top up Lazada Wallet credit. | 50 | 50 | null (∞) | null | 365 | 470 | false |
| 39 | `ewallet` | Touch n Go | 💳 | TnG eWallet RM5 | Topup TnG eWallet. | 5 | 5 | 5 | null | 365 | 480 | false |
| 40 | `ewallet` | Touch n Go | 💳 | TnG eWallet RM10 | Topup TnG eWallet. | 10 | 10 | 5 | null | 365 | 490 | false |
| 41 | `ewallet` | Touch n Go | 💳 | TnG eWallet RM30 | Topup TnG eWallet. | 30 | 30 | 5 | null | 365 | 500 | false |
| 42 | `ewallet` | Touch n Go | 💳 | TnG eWallet RM50 | Topup TnG eWallet. | 50 | 50 | 5 | null | 365 | 510 | false |
| 43 | `ewallet` | Touch n Go | 💳 | TnG eWallet RM100 | Topup TnG eWallet. | 100 | 100 | 5 | null | 365 | 520 | false |
| 44 | `ewallet` | Boost | 💳 | Boost Credit RM30 | Topup Boost wallet. | 30 | 30 | 5 | null | 365 | 530 | false |
| 45 | `ewallet` | GrabPay | 💳 | GrabPay Credit RM30 | Topup GrabPay wallet. | 30 | 30 | 5 | null | 365 | 540 | false |
| 46 | `ewallet` | Maybank | 💳 | MAE/DuitNow RM50 | DuitNow transfer ke akaun bank. | 50 | 50 | 5 | null | 365 | 550 | false |
| 47 | `education` | Popular | 📚 | Popular Bookstore RM30 | Voucher buku + alat tulis. | 30 | 30 | null (∞) | null | 365 | 560 | false |
| 48 | `education` | MPH | 📚 | MPH Bookstore RM30 | Voucher MPH stores. | 30 | 30 | null (∞) | null | 365 | 570 | false |
| 49 | `education` | Canva | 🎨 | Canva Pro 3 Bulan | Akses Canva Pro untuk projek sekolah. | 30 | 30 | null (∞) | 4 | 90 | 580 | false |
| 50 | `education` | Quizlet | 📚 | Quizlet Plus 1 Tahun | Flashcard + study tools premium. | 50 | 50 | null (∞) | 1 | 365 | 590 | false |
| 51 | `education` | Duolingo | 🦉 | Duolingo Super 1 Bulan | Ad-free + unlimited hearts. | 25 | 25 | null (∞) | 12 | 60 | 600 | false |
| 52 | `education` | PrestasiPlus | 🎓 | MUET Practice 3 Bulan | Akses penuh MUET prep tier. | 80 | 80 | null (∞) | 4 | 90 | 610 | false |
| 53 | `entertainment` | TGV Cinemas | 🎬 | TGV Movie Ticket | e-ticket 1 wayang TGV. | 18 | 18 | null (∞) | 4 | 60 | 620 | false |
| 54 | `entertainment` | GSC | 🎬 | GSC Movie Ticket | e-ticket 1 wayang GSC. | 18 | 18 | null (∞) | 4 | 60 | 630 | false |
| 55 | `entertainment` | K-Box | 🎤 | K-Box Karaoke 2 Jam | e-voucher 2 jam karaoke K-Box. | 35 | 35 | null (∞) | 2 | 90 | 640 | false |
| 56 | `flagship` | Touch n Go | 🏆 | TnG eWallet RM500 ⭐ | Topup eWallet RM500. Boleh shopping, topup, bil. | 500 | 500 | null (∞) | 1 | 365 | 650 | true |
| 57 | `flagship` | Touch n Go | 🏆 | TnG eWallet RM1000 🏆 | FLAGSHIP — Topup eWallet RM1000. Ganjaran tertinggi. | 1000 | 1000 | null (∞) | 1 | 365 | 660 | true |
| 58 | `flagship` | Shopee | 🏆 | Shopee Voucher RM1000 🏆 | Voucher beli apa-apa di Shopee. | 1000 | 1000 | null (∞) | 1 | 365 | 670 | true |
| 59 | `flagship` | Roblox | 🏆 | Roblox Gift Card RM1000 🏆 | ~13,400 Robux. Untuk mega-fan Roblox. | 1000 | 1000 | null (∞) | 1 | 365 | 680 | true |

### 6.8 Dataset spec and named queries (D11 format; materialised stores)

| Store (owner M15) | Seeded N | Id range | Runtime ids | Evidence |
|---|---|---|---|---|
| HadiahReward | 59 | 1–59 (live) | highest + 1 (60…) | snapshot `catalogue`, `editForms` |
| HadiahRedemption | 3 | 1–3 (fictitious; live shows no id) | ≥ 9,000,001 | snapshot `tebusan.cancelled` / `all` |
| MysteryBox | 4 | 1–4 (live form actions) | — (constants) | snapshot `mysteryBox` |
| MysteryBoxOpening | 0 | — | ≥ 9,000,001 | snapshot `mysteryBox.history` = 0 |

**Seeded redemptions** (every visible value OBSERVED; owners fictitious per DV-M15-15; the year 2026 is INFERRED — the M14 ledger and session year are 2026 — and never displayed):

| id | userId | rewardId | rewardTitle / vendor / icon | RM / token | status | createdAt | stockReserved |
|---|---|---|---|---|---|---|---|
| 1 | 3152 | 16 | "CelcomDigi Topup RM30" / "CelcomDigi" / 📱 | 30 / 30 | cancelled | 2026-04-30T04:54:00+08:00 | false |
| 2 | 3152 | 16 | "CelcomDigi Topup RM30" / "CelcomDigi" / 📱 | 30 / 30 | cancelled | 2026-04-30T04:54:00+08:00 | false |
| 3 | 3151 | 10 | "Hotlink Topup RM10" / "Hotlink" / 📱 | 10 / 10 | cancelled | 2026-04-30T14:11:00+08:00 | false |

Queue order (newest first, then id descending) = 3, 2, 1 — the live order "Hotlink … 14:11", then the two CelcomDigi rows. `cancelledAt`, `cancelledBy`, `parentDecision*`, `voucherCode` null (not observable). Users 3151 "Pelajar Demo Hadiah 1" `hadiah1@demo.test` and 3152 "Pelajar Demo Hadiah 2" `hadiah2@demo.test` are students registered by M02 as anchors in the users dataset (XR-M15-09).

**Wallet values (owner M14; OBSERVED):** admin (1) `currentSyiling` 256, `tokenBalance` 0, `xp` 8. M15 seeds no balance.

**Named queries** (every M15 count; value at the default seed and the mock anchor):

| Query | Definition | Seed value | Shown on |
|---|---|---|---|
| Q-M15-TOTAL | count(HadiahReward) | 59 | S1 "Total Hadiah"; "of {total}" with `cat=all` |
| Q-M15-ACTIVE | count(isActive) | 0 | S1 "Aktif" |
| Q-M15-CAT(key) | count(category = key); `all` → Q-M15-TOTAL; unknown → 0 | 4 / 8 / 11 / 8 / 6 / 8 / 5 / 6 / 3 | S1 list and pager total |
| Q-M15-RED-MONTH | count(redemption: createdAt in the current month (BR-M15-25) ∧ status ≠ cancelled) | 0 | S1 "Tebusan Bulan Ini" |
| Q-M15-PENDING-ADMIN | count(status = pending_admin) | 0 | S1 "Pending Proses" |
| Q-M15-RED-REWARD(id) | count(rewardId = id ∧ status ≠ cancelled) | 0 for every reward | S1 "Tebusan" |
| Q-M15-QUEUE(status) | redemptions of that status (`all` = every row; default `pending_admin`), newest first | pending_admin 0 · pending_parent_consent 0 · delivered 0 · cancelled 3 · all 3 | S2 |
| Q-M15-HISTORY-DELETE(id) | count(rewardId = id), any status | 2 for reward 16, 1 for reward 10, 0 otherwise | BR-M15-24 |
| Q-M15-CAP(user, reward) | count(userId, rewardId, current month, status ≠ cancelled) | 0 | BR-M15-05 |
| Q-M15-CONSENT-PENDING(parent) | count(status = pending_parent_consent ∧ userId ∈ children(parent)) | 0 for every parent (admin 0) | S8 "(n)" |
| Q-M15-CHILD-HISTORY(parent) | children's redemptions with status ≠ pending_parent_consent | empty for every parent (users 3151/3152 are linked to no parent) | S8 history |
| Q-M15-OPENINGS(user) | the user's openings, newest first, first 10 | empty | S6 history |
| Q-M15-OPENINGS-COUNT(user) | count(MysteryBoxOpening where userId = user) | 0 for every user | M14 achievement "Ahli Kotak Misteri" (M14 BR-M14-16; XR-M15-12) |
| Q-M15-OPEN-DRAWS | M14 draws open with `closesAt` ≥ today (M14 contract) | 0 (no draw ever existed) | S7 |

No display constant is used (every figure above is computed).

**Repository contract (consumers; D12).** Other modules read M15 stores only through these calls:

| Call | Returns | Consumer | Notes |
|---|---|---|---|
| `mysteryBox.openingsCount(userId)` | int = Q-M15-OPENINGS-COUNT(userId) | M14 (BR-M14-16, achievement "Ahli Kotak Misteri" at 10 openings) | M15 does not evaluate or pay the achievement; M14 reads the count after each opening or on its own evaluation trigger (M14's choice). Seed: 0 for every user. |

### 6.9 Test hooks and test-only fixtures (dev/test builds only; never in the default or demo seed)

Global hooks of architecture §6.13 (`reset`, `setNow`, `setLatency`, `failNext`, `setUser`, `lastRequest`). **M15 module hooks:** `m15LoadFixture(name)`, `m15Redeem({userId, rewardId})` (runs the #9 rule as that user; returns the #9 body or error code), `m15SetReward(id, patch)` (e.g. `{isActive: true}`, `{stockQuantity: 0}`), `m15MysteryNext({coins, xp})` (fixes the next opening). **Requested M14 hooks** (XR-M15-08): `setWallet(userId, {syiling?, tokens?, xp?})`, `getWallet(userId)`, `ledger(userId)`, `createDraw({...})`.

**Fixture `queue`** (loads rows directly, without wallet effects, then sets wallets):

| id | userId | rewardId | title / vendor / icon | RM / token | status | createdAt | Notes |
|---|---|---|---|---|---|---|---|
| 15101 | 2 | 40 | "TnG eWallet RM10" / "Touch n Go" / 💳 | 10 / 10 | pending_admin | 2026-09-24T20:15:00+08:00 | `stockReserved` true → reward 40 stock 4 |
| 15102 | 4 | 1 | "Roblox Gift Card RM10" / "Roblox" / 🎮 | 10 / 10 | pending_parent_consent | 2026-09-25T09:30:00+08:00 | reward 1 stock null |
| 15103 | 2 | 26 | "McD e-Voucher RM10" / "McDonald's" / 🍔 | 10 / 10 | delivered | 2026-09-19T21:00:00+08:00 | code "DEMO-MCD-0001", delivered 2026-09-20T10:00:00+08:00, expires +90 days |

Wallets set by the fixture (M14 hook): student 2 → 20 tokens; student 4 → 15 tokens. Resulting anchors: S1 "Pending Proses" 1, "Tebusan Bulan Ini" 3, Tebusan 1 for rewards 1, 26, 40; S2 default list 15101; parent 6 S8 "(1)" (15102) and history 15101, 15103.

**Fixture `draw`** (via M14 `createDraw`): id 1, "Cabutan Demo", "Cabutan ujian.", `ticketCostSyiling` 50 and `maxTicketsPerStudent` 10 (the M14 S10 form defaults), prize pool = the M14 S10 placeholder `[{"label":"Baucar Topup RM50","value_sen":5000,"qty":1},{"label":"Baucar RM5","value_sen":500,"qty":10}]`, `closesAt` 2026-09-30, open.

### 6.10 Cross-module requests (to the owners; D12)

| # | Owner | Request | Status (v1.1) |
|---|---|---|---|
| XR-M15-01 | M14 | **Wallet read:** `GET /api/gamification/wallet` → `{data: {currentSyiling, tokenBalance, xp, level}}` for the session user (used by S5 tile, S6 chip, S7 tile); admin values 256 / 0 / 8 as observed. | Accepted (M14 SRS v1.0 §6.13; #2 returns a superset incl. `level`) |
| XR-M15-02 | M14 | **Wallet write contract** (repository, atomic, refuses with `INSUFFICIENT_BALANCE` and writes nothing): `debitTokens(userId, n, {source, refId})` (`hadiah_redeem`, `mystery_box`), `creditTokens(userId, n, {source: 'hadiah_refund', refId})`, `creditSyiling(userId, n, {source: 'mystery_box', description: 'Kotak Misteri: {name}'})` (ledger format OBSERVED; M14 chooses the ledger `type`), `addXp(userId, n, {source})`. (Tickets need no M15 wallet call: M14 `draws.buyTicket` debits the syiling itself, XR-M15-03.) Negative balances must be impossible (M14 D-10 shows −1/−2 tokens on live; SEC-M15-05). Whether token movements are listed in a ledger is M14's decision. | Accepted with M15's names (M14 BR-M14-22, §7.1); token movements go to M14's internal TokenMovement log (DATA-M14-21), never to the coin ledger |
| XR-M15-03 | M14 | **Draw and ticket store** owned by M14 (draws are created and settled on M14 S10): `listOpenDraws(today)`, `ticketsOf(drawId, userId)`, `buyTicket(drawId, userId)` (checks open, cap, balance; M14 debits the syiling itself and writes 'Tiket Cabutan: {title}'). Field names as the S10 form (`title`, `description`, `ticket_cost_syiling`, `max_tickets_per_student`, `prize_pool`, `closes_at`, `open_now`). | Accepted (M14 DATA-M14-18/19, BR-M14-29) |
| XR-M15-04 | M14 + user | **Shop catalogue source (OQ-M15-01, D-M15-3):** which catalogue `/gamification/rewards` lists; and the owner of the 11-item legacy catalogue with `cost_value_sen` shown on S10 (M14 discovery calls it "the M15 catalogue"; it is syiling-priced and typed, unlike the 59 token-priced hadiah). M15 does not define it. | **Closed** — ownership: M14 DATA-M14-17; source: user decision on OQ-M15-01 (follow live; S5 empty for every account, no source modelled). M14 wording aligned at XL batch 3 |
| XR-M15-05 | M14 | **Conversion hint:** the live M15 form hint "100 syiling = 1 token = RM1" vs M14's tier rates 50/40/30/20. M14 decided it is a wrong label; M15 applies DV-M15-14 ("1 token = RM1"). | Decided: wrong label; DV-M15-14 approved ("1 token = RM1") |
| XR-M15-06 | M14 | **Reward budget** (S10 "Bajet tebus / sesi" RM10, "Sub-had tebus / bulan" RM3): does it apply to hadiah redemptions? M15 applies none (OQ-M15-12). | Closed: no budget for hadiah (OQ-M15-12 closed) |
| XR-M15-07 | M14 | **S10 counters** "Liabiliti sesi 2026", "Pelajar menebus", "Jumlah tebusan" (all 0 on live): if they count hadiah redemptions, M15 exposes a read query (e.g. Q-M15-RED-MONTH-style counts by session year); otherwise no dependency. | Closed: no M15 dependency (M14 BR-M14-31 counts its own catalogue) |
| XR-M15-08 | M14 | **Test hooks** `setWallet`, `getWallet`, `ledger`, `createDraw` (§6.9). | Accepted (M14 §6.14) |
| XR-M15-09 | M02 | **User anchors** 3151 "Pelajar Demo Hadiah 1" `hadiah1@demo.test` and 3152 "Pelajar Demo Hadiah 2" `hadiah2@demo.test`, role `student`, active, no parent link, in the student cell of the §6.15 users dataset (the cell still fits: 4,533 ≥ anchors + 2); the 4,533 total is unchanged. **v1.4 (M02 v1.23, XR-M02-02):** both are placed at school **2418** SEKOLAH KEBANGSAAN JELI (1), grade 6 (Darjah 6), no class, `lastLoginAt` null (M02 §6.15 D); they stay in M02's G bucket. M15 shows only name and e-mail, so no visible M15 value changes. | Applied by M02 (§6.15 D; v1.23 placement at 2418, grade 6) |
| XR-M15-10 | M02 | **Parent-link read:** `childrenOf(parentId) → studentId[]` over DATA-M02-02 (existing links 1–2: parent 6 ↔ students 2 and 4; parent 5401 without links). No change to M02 data. | Existing data; confirm at XL batch 3 |
| XR-M15-11 | Global shell / M23 | Add the M15 menu entries, badges and active rule (URS FN-M15-1.1.1–1.1.6), apply DV-M15-04 ("Admin Tebusan" → `/admin/hadiah/tebusan`) and the header titles of FN-1.1.7 (DV-SH-03). The live mobile menu lacks "Kelulusan Hadiah" and "Admin Tebusan"; M15 replicates the capture until DV-SH-04's single list (which would add both) is applied by the shell owner. | Open (shell owner) |
| XR-M15-12 | M14 | **Consumer contract offered:** `mysteryBox.openingsCount(userId)` (Q-M15-OPENINGS-COUNT) for the achievement "Ahli Kotak Misteri" (M14 BR-M14-16, §6.1). Route to XL batch 3. | New (v1.1, AUD-M15-04) |

---

## 7. Mock API endpoints

*(solution-architect)* Base `/api`; envelope, error format and locale of SRS.md §7 (list meta extended with `from`, `to` as in M01/M02). **AD** = admin session (guest `401`; other roles `403 FORBIDDEN`); **S** = any logged-in user (guest `401`). Every mutating call runs in one mock transaction with its M14 wallet call (BR-M15-21). The page routes keep the live URLs; the mock endpoints are the REST shape of the same actions (live forms post `_token`; the mock uses the session token instead).

| # | Method | Path | Auth | Mut. | Request | Response | Errors | Live equivalent |
|---|---|---|---|---|---|---|---|---|
| 1 | GET | `/api/admin/hadiah` | AD | no | `?cat=&page=` | 200 `{data: HadiahListItem[], meta: {page, pageSize: 50, totalItems, totalPages, from, to, activeCat: key \| 'all' \| null, cards: {total, active, redemptionsThisMonth, pendingAdmin}}}`; `HadiahListItem` = `{id, category, categoryLabel, vendor, title, iconEmoji, denominationRm, tokenCost, stockQuantity, redemptionCount, isActive}` | 401, 403 | GET `/admin/hadiah?cat=&page=` (HTML) |
| 2 | GET | `/api/admin/hadiah/:id` | AD | no | — | 200 `{data: HadiahReward}` | 404 `NOT_FOUND`, 401, 403 | GET `/admin/hadiah/{id}/edit` (HTML) |
| 3 | POST | `/api/admin/hadiah` | AD | yes | `HadiahInput` = every writable field of §6.2 | 201 `{data: HadiahReward}` | 422 `VALIDATION_ERROR` `{fields}`, 401, 403 | POST `/admin/hadiah` (form) |
| 4 | PUT | `/api/admin/hadiah/:id` | AD | yes | `HadiahInput` | 200 `{data: HadiahReward}` | 404, 422, 401, 403 | POST `/admin/hadiah/{id}` + `_method=PUT` |
| 5 | POST | `/api/admin/hadiah/bulk` | AD | yes | `{action: 'activate'\|'deactivate'\|'delete'\|'set_stock'\|'set_max_per_month'\|'set_token_cost', ids: int[], stockValue?: string, maxPerMonthValue?: string, tokenCostDeltaPct?: string}` | 200 `{data: {affected: int, keptIds: int[]}}` (`keptIds` only for `delete`, BR-M15-24) | 422 (unknown action, empty `ids`, value outside BR-M15-11/12), 401, 403 | POST `/admin/hadiah/bulk` (form: `action, stock_value, max_per_month_value, token_cost_delta_pct, ids[]`) |
| 6 | GET | `/api/admin/hadiah/redemptions` | AD | no | `?status=&page=` | 200 `{data: RedemptionListItem[], meta: {page, pageSize: 50, totalItems, totalPages, from, to, activeStatus: key \| 'all' \| null}}`; `RedemptionListItem` = `{id, user: {id, name, email}, rewardId, rewardTitle, rewardVendor, denominationRm, tokenCost, status, createdAt}` | 401, 403 | GET `/admin/hadiah/tebusan?status=` |
| 7 | POST | `/api/admin/hadiah/redemptions/:id/deliver` | AD | yes | `{code: string}` | 200 `{data: {id, status: 'delivered', deliveredAt, expiresAt}}` | 404, 409 `CONFLICT` (not `pending_admin`), 422 (blank/too long code), 401, 403 | unknown (Q-M15-1) |
| 8 | POST | `/api/admin/hadiah/redemptions/:id/cancel` | AD | yes | — | 200 `{data: {id, status: 'cancelled', refundedTokens}}` | 404, 409, 401, 403 | unknown (Q-M15-1) |
| 9 | POST | `/api/hadiah/redemptions` | S | yes | `{rewardId: int}` | 201 `{data: {id, status, tokenBalance}}` | 404 `NOT_FOUND`, 409 `OUT_OF_STOCK` \| `MONTHLY_CAP` \| `INSUFFICIENT_TOKENS` (the `message` is not displayed because S5 shows no shop by the user's decision on OQ-M15-01), 401 | unknown (Q-M15-2); used only by the hook `m15Redeem` |
| 10 | GET | `/api/gamification/mystery-boxes` | S | no | — | 200 `{data: {tokenBalance, boxes: MysteryBox[], history: {id, boxId, boxName, coins, xp, createdAt}[]}}` (history = Q-M15-OPENINGS) | 401 | GET `/gamification/mystery-box` (HTML) |
| 11 | POST | `/api/gamification/mystery-boxes/:id/open` | S | yes | — | 200 `{data: {openingId, boxId, boxName, icon, coins, xp, tokenBalance, syilingBalance}}` | 404 (box), 409 `INSUFFICIENT_TOKENS`, 401 | POST `/gamification/mystery-box/{id}/open` (`_token`; never sent) |
| 12 | GET | `/api/cabutan` | S | no | — | 200 `{data: {syilingBalance, draws: {id, title, description, ticketCostSyiling, maxTicketsPerStudent, ticketsOwned, closesAt, prizePool: {label, valueSen, qty}[]}[]}}` (M14 XR-03) | 401 | GET `/cabutan` (HTML) |
| 13 | POST | `/api/cabutan/:drawId/tickets` | S | yes | — | 201 `{data: {drawId, ticketsOwned, syilingBalance}}` | 409 `DRAW_CLOSED` (draw missing or not open) \| `TICKET_LIMIT` \| `INSUFFICIENT_BALANCE` (M14 BR-M14-29 codes), 401 | not rendered (Q-M15-5) |
| 14 | GET | `/api/parent/hadiah-approvals` | S (scoped) | no | — | 200 `{data: {pending: ParentItem[], history: ParentItem[]}}`; `ParentItem` = `{id, child: {id, name}, rewardTitle, rewardIcon, tokenCost, status, createdAt}` | 401 | GET `/cikgu/kelulusan-hadiah` (HTML) |
| 15 | POST | `/api/parent/hadiah-approvals/:id/approve` | S (scoped) | yes | — | 200 `{data: {id, status: 'pending_admin'}}` | 404 (not a child's), 409 (not pending consent), 401 | not rendered (Q-M15-3) |
| 16 | POST | `/api/parent/hadiah-approvals/:id/reject` | S (scoped) | yes | — | 200 `{data: {id, status: 'cancelled', refundedTokens}}` | 404, 409, 401 | not rendered |
| 17 | GET | `/api/gamification/wallet` | S | no | — | M14 (XR-M15-01) | 401 | — |
| 18 | GET | `/api/hadiah/shop` | — | — | — | **Not built (user decision, OQ-M15-01)** | — | — |

---

## 8. States & messages

### 8.1 Observed copy (exact)

| Screen | State | Copy |
|---|---|---|
| S1 | header | "🎁 Admin — Kedai Hadiah Digital" · "Urus catalog hadiah + proses tebusan pelajar." · "Tebusan Queue" · "Tambah Hadiah" |
| S1 | cards | "Total Hadiah" · "Aktif" · "Tebusan Bulan Ini" · "Pending Proses" |
| S1 | toolbar | "{n} hadiah dipilih" · "Aktifkan" · "Nyahaktifkan" · "Set Stok" · "Had/Bulan" · "Pelaras Token" · "Padam" · "Batal" |
| S1 | dialogs | "Aktifkan {n} hadiah?" · "Nyahaktifkan {n} hadiah?" · "Padam {n} hadiah secara kekal? (Hadiah dengan sejarah tebusan tidak akan dipadam)" · "Tetapkan stok untuk {n} hadiah.\n\nMasukkan nombor (cth: 100), atau biarkan kosong untuk tanpa had (∞):" · "Masukkan nombor sah (0-999999) atau kosong untuk ∞." · "Tetapkan had bulanan/pelajar untuk {n} hadiah.\n\nMasukkan nombor (cth: 5), atau 0 / kosong untuk tanpa had:" · "Masukkan nombor sah (0-99) atau kosong untuk ∞." · "Pelaras kos token untuk {n} hadiah.\n\nMasukkan peratus pelarasan:\n  +50 = naik 50% (cth: 100 token → 150)\n  -25 = turun 25% (cth: 100 token → 75)\n\nRange: -90 hingga +500" · "Masukkan peratus sah antara -90 dan +500 (bukan 0)." · "Sahkan: {naikkan\|turunkan} kos token sebanyak {abs}% untuk {n} hadiah?" |
| S1 | table / empty / pager | "Edit" · "Off" · "∞" · "Tiada hadiah dalam kategori ini." · "Showing {from} to {to} of {total} results" · "Showing 0 of {total} results" · "« Previous" · "Next »" |
| S2 | header, pills, empty | "📋 Admin — Tebusan Hadiah Pelajar" · "Beli kod dari reseller, paste kat sini untuk hantar kepada pelajar." · "Kembali ke Catalog" · "⏳ Pending Admin" · "⏳ Pending Ibu Bapa" · "🎁 Delivered" · "❌ Cancelled" · "Semua" · "❌ Dibatalkan" · "Tiada tebusan dalam status ini." |
| S3/S4 | form | labels, placeholders and options of URS FN-M15-3.1.3–3.1.11 · "➕ Tambah Hadiah Baharu" · "✏️ Edit Hadiah: {title}" · "← Kembali ke senarai" · "➕ Tambah" · "💾 Simpan" · "Batal" |
| S5 | default | "🎁 Kedai Hadiah" · "Tebus token anda untuk hadiah menarik!" · "Baki Token 🎫" · "🎁" · "Tiada Hadiah Tersedia" · "Hadiah akan ditambah tidak lama lagi. Tunggu ya!" |
| S6 | default | "📦 Kotak Misteri" · "Buka kotak & menang ganjaran rawak — nasib baik menanti!" · "🎫 Token Anda:" · box texts of DATA-M15-03 · "{n} Token" · "🪙" · "⭐ … XP" · "🔒 Token Tidak Cukup" |
| S7 | default | "🎟️ Cabutan Bertuah" · "Guna syiling untuk beli tiket & menangi hadiah hebat!" · "Syiling anda" · "{n} 🪙" · "Cabutan Dibuka" · "Tiada cabutan dibuka buat masa ini. Nanti datang lagi! 🎈" |
| S8 | default | "👨‍👩‍👧 Kelulusan Tebusan Hadiah" · "Anak anda nak tebus hadiah yang memerlukan kelulusan ibu bapa. Sila semak." · "⏳ Menunggu Kelulusan ({n})" · "Tiada tebusan menunggu kelulusan." · "📜 Sejarah Tebusan Anak" · "Belum ada sejarah tebusan." |
| 404 | all | M01 404 page (URS FN-M15-1.2.4) |

### 8.2 PROPOSED COPY and layouts (report at G1; URS OQ-M15-10)

| Where | PROPOSED |
|---|---|
| S1 | pill "On" (`#10b981`); out-of-range row "Tiada hadiah di halaman ini." (DV-M15-07) |
| S3/S4 | "Kos Token" hint "1 token = RM1" (DV-M15-14; live "100 syiling = 1 token = RM1") |
| S1–S8 | header titles of DV-M15-12 |
| S2 | row pills "⏳ Pending Admin" `#f59e0b`, "⏳ Pending Ibu Bapa" `#8b5cf6`, "🎁 Delivered" `#10b981`; code field placeholder "Kod voucher", `maxlength` 100; buttons "Hantar", "Batalkan" (no confirm); page size 50 |
| S6 | enabled button "Buka Kotak"; modal: box icon, box name, "+{coins} 🪙 · +{xp} XP", "Tutup", full-screen below `md` and 400px centred from `md`; history heading "Sejarah Kotak Misteri", rows "Kotak Misteri: {name}" · "+{coins} 🪙 · +{xp} XP" · "dd/mm HH:MM", at most 10 rows |
| S7 | draw card: title, description, "Harga tiket: {n} 🪙", "Tiket anda: {owned}/{max}", "Tutup: dd/mm/yyyy", "{label} × {qty}", "🎟️ Beli Tiket"; cards ordered by close date then id |
| S8 | request card: child name, "{icon} {title}", "{token} token", "dd/mm HH:MM", "✅ Lulus", "❌ Tolak" (no confirm); history row: child name, "{icon} {title}", the S2 pill, "dd/mm HH:MM" |
| Rules | Pelaras Token rounding and the server parse of the raw text (BR-M15-11); mystery-box draw mechanism (BR-M15-18); one ticket per purchase (BR-M15-19); code length 1–100 (BR-M15-10); date formats of S7/S8 (BR-M15-16); runtime ids (BR-M15-14) |

No flash, success or error message is added after any action (none observed; Q-M15-7).

### 8.3 Loading and errors

Lists and forms show the shared loading behaviour while the mock responds (default latency per architecture). A failed list or save shows the shared error convention (SRS.md FR-G-10); M15 adds no copy. Bulk actions and form submits disable their trigger while in flight (shared convention).

---

## 9. Permissions matrix

| Role | S1–S4 catalogue (#1–#5) | S2 queue (#6–#8) | S5 shop (#17) | S6 box (#10, #11) | S7 draw (#12, #13) | S8 consent (#14–#16) | Notes |
|---|---|---|---|---|---|---|---|
| Admin | view, create, edit, bulk (incl. delete) | view, deliver, cancel | view (own wallet) | view, open (own tokens) | view, buy (own syiling) | view (no children → empty) | OBSERVED screens; actions INFERRED/PROPOSED |
| Pelajar | → M01 landing / 403 | → landing / 403 | view | view, open | view, buy | view (empty) | INFERRED (provisional) |
| Ibu Bapa | → landing / 403 | → landing / 403 | view | view, open | view, buy | view, approve, reject (own children only) | INFERRED (provisional); menu entry visible to parent and admin (INFERRED, DV-M15-05) |
| Guru, Admin Sekolah, Penaja, PPD, JPN | → landing / 403 | → landing / 403 | view | view, open | view, buy | view (empty) | INFERRED / UNVERIFIED |
| Guest | → `/login` | → `/login` | → `/login` | → `/login` | → `/login` | → `/login` | INFERRED |

The mock enforces the same checks as the routes (403/404); these are prototype rules, not a security boundary (§11.1).

---

## 10. Responsive behaviour

Shell switch at 1024px (sidebar → drawer/"Lagi" + bottom nav) per design/shells.md. Tables use NFR-RESP-05 (b): horizontal scroll inside their card, no sticky column (DV-M15-01). Control sizes replicate live (D10); text ≥ 12px (DV-M15-13). **Icon note (FA → Lucide, design-system):** besides the existing mappings, M15 uses `fa-store` ("Kembali ke Catalog") → Lucide `Store`; the designer adds it to the design-system map (with `fa-ticket`, `fa-gift`, `fa-box-open`, `fa-shield-halved`, `fa-cogs`, `fa-clipboard-list`, `fa-boxes-stacked`, `fa-calendar-day`, `fa-percent`, `fa-pause`, `fa-trash` if not already mapped).

| Screen | 375 | 768 | 1280 |
|---|---|---|---|
| S1 | h1 two lines; "Tebusan Queue" and "Tambah Hadiah" side by side (labels wrap to two lines); cards 2×2; pills 4 rows; table scrolls inside its card; pager "« Previous"/"Next »"; toolbar sticky, buttons in 3 rows | cards one row of 4; pills 2 rows; table scrolls inside its card (Tindakan reachable); desktop pager; toolbar 2 rows ("Batal" alone) | table fits (no scroll); toolbar one row |
| S2 | h1 three lines beside "Kembali ke Catalog" (three-line label); pills 2 rows; table scrolls inside its card | table scrolls inside its card | fits |
| S3/S4 | card full width; one column; "➕ Tambah"/"💾 Simpan" and "Batal" side by side | 2/3-column rows | idem, card max 3xl |
| S5 | hero stacked; h1 14px | hero row from 768; h1 24px (from 640) | idem |
| S6 | 1 box per row; modal full-screen (NFR-RESP-07) | 3 per row (4th on row 2); modal 400px centred | 4 per row |
| S7 | balance tile under the title; draw cards full width | tile beside the title | idem |
| S8 | one column | idem | idem |
| 404 | centred card | idem | idem |

---

## 11. Non-functional requirements

| ID | Requirement | Global |
|---|---|---|
| NFR-M15-01 | Fidelity of the seed: the default and demo seed hold exactly the observed rewards (59, all inactive), the 3 cancelled redemptions, the 4 boxes and no opening; test fixtures load only through hooks in dev/test builds (never in the demo bundle). | D7, D11 |
| NFR-M15-02 | Privacy: only fictitious people (3151, 3152, canonical accounts); no real student name or e-mail in code, fixtures, logs or screenshots; admin views show student e-mails as live (SEC-M15-08). | NFR-05 |
| NFR-M15-03 | Atomicity: every M15 mutation and its M14 wallet call succeed or fail together (BR-M15-21); a test verifies no partial state after an injected wallet failure. | NFR-04 |
| NFR-M15-04 | Determinism: the mystery-box mechanism is seeded (BR-M15-18) so E2E and demos are repeatable; `m15MysteryNext` overrides it. | NFR-01 |
| NFR-M15-05 | Accessibility replicates live (D10; FR-M15-64). | NFR-02 |
| NFR-M15-06 | Locale: dates per BR-M15-16 in Asia/Kuala_Lumpur; money "RM{n}" without decimals as live. | NFR-08 |
| NFR-M15-07 | No external service: no reseller, API or instant delivery call; `api`/`instant` are stored values only (D4). | D4 |

### 11.1 Security notes (backend phase)

| ID | Live risk (replicated with dummy data) | Backend requirement |
|---|---|---|
| SEC-M15-01 | **Manual voucher-code exposure.** Codes are bearer value (money). The admin pastes them into a page; any admin can read them; the delivered code has no observed delivery channel to the student. | Encrypt codes at rest; show masked after delivery; role-scoped access with an audit log of every view and paste; never put codes in URLs, logs or notifications in clear; one-time reveal to the owning student; expiry enforcement; reseller purchase records reconciled with deliveries. |
| SEC-M15-02 | **Bulk actions** change price, stock, status or delete up to 50 rewards per submit; the checks and confirmations are client-side only; ids come from the client; `delete` is permanent. | Server-side validation of action, ids and values (BR-M15-11/12); CSRF on the form; authorisation per request; soft delete or an undo window; audit log with before/after values; cap on the price change per action. |
| SEC-M15-03 | **Stock and cap races / double submission.** Two identical redemptions were created in the same minute (D-M15-10); stock 5 rewards can be oversold by concurrent requests; the monthly cap can be exceeded the same way. | Atomic conditional decrement (`stock > 0`) and cap check in one transaction with row locks; an idempotency key per claim; unique constraint or dedupe window per (user, reward, minute). |
| SEC-M15-04 | **Parent-consent bypass.** The consent flag is per reward; S8 sits under `/cikgu/` and is open to every role; approve/reject ids are sequential. | Enforce `requiresParentConsent` at creation on the server; approve/reject only by a parent linked to the student (verify the M02 link, 404 otherwise); the admin must not deliver a `pending_parent_consent` request; the student cannot self-approve; audit parent decisions; consider parent verification (the link is admin-made). |
| SEC-M15-05 | **Token debits and refunds.** Live wallets hold negative token balances (M14 D-10); refunds on cancel are unobserved. | Check-and-debit atomically with a non-negative constraint; ledger every token movement; refund exactly once (status transition guard); reconcile wallet totals with the ledger. |
| SEC-M15-06 | **Mystery box = randomised paid reward for minors.** Odds are not disclosed; the outcome is server-side. | Server-side cryptographic RNG; publish odds as policy requires; spending limits for minors; legal review (gaming law, consumer protection); log every opening. |
| SEC-M15-07 | **Lucky draw for minors** paid with syiling; the prize pool is admin JSON (M14). | Validate the prize pool schema; enforce the ticket cap and balance atomically; auditable, reproducible winner selection; legal review; winner privacy. |
| SEC-M15-08 | **Minors' personal data in the queue** (names and e-mails of students on S2). | Admin-only access; data minimisation (e.g. mask e-mail); no export; PDPA notice and retention. |
| SEC-M15-09 | **`image_url` accepts any URL** (browser `type=url` also accepts `javascript:` and tracking hosts); it is stored though no screen shows it. | Allow only `https:` on an allow-listed host or an uploaded asset; never render it unsanitised; content-security policy. |
| SEC-M15-10 | **Framework error page** (405) reveals the stack and gives no navigation. | Custom error pages; no framework banner in production. |

---

## 12. E2E test scenarios

Every scenario runs on the three Playwright projects mobile 375×812, tablet 768×1024 and desktop 1280×800 (master SRS §10); when a step is width-specific it names the width and the scenario still runs on all three. Default user: the admin (`setUser(1)`); mock clock at the anchor. **Provisional** = asserts INFERRED/UNVERIFIED behaviour or PROPOSED UI for an unobserved state; tagged `@provisional` until OQ-M15-09 is answered. Provisional scenarios needing M14 hooks (XR-M15-08) are also blocked until M14 provides them.

| ID | Scenario | FR | AC | Provisional |
|---|---|---|---|---|
| E2E-M15-01 | User portal at 1280: sidebar entries, the "Cabutan Bertuah" icon (`fa-ticket`, fuchsia-500) and its separate gradient badge pill, icons, colours, order and targets; "Admin Tebusan" → `/admin/hadiah/tebusan` and opens S2; at 375 and 768 the mobile menu sheets hold "Cabutan Bertuah", "Kedai Hadiah", "Kotak Misteri", "Urus Hadiah" and no "Kelulusan Hadiah"/"Admin Tebusan". | 01, 02 | 01.1, 01.2, 01.3 | |
| E2E-M15-02 | Admin panel: "Gamifikasi" group items and "Kedai Hadiah" target at 1280; "Lagi" popover section at 375/768. | 03 | 01.4 | |
| E2E-M15-03 | Active items on S1–S4 (admin panel) and S5–S8 (user portal); on S7 the active "Cabutan Bertuah" icon has no `text-fuchsia-500`; at 375 the mobile-menu icons "Cabutan Bertuah" fuchsia-500 and "Kedai Hadiah" pink-500. | 04 | 01.5 | |
| E2E-M15-04 | Header titles/subtitles and tab titles of S1–S8; shells per screen; no "Dashboard" header. | 05, 06 | 01.6, 01.7 | |
| E2E-M15-05 | Guest: the six routes of AC-02.1 → `/login`. | 07 | 02.1 | yes |
| E2E-M15-06 | `pelajar@demo.test`: the four admin routes → `/dashboard`; #1 → 403. | 08 | 02.2 | yes |
| E2E-M15-07 | `pelajar@demo.test`: S5–S8 render in the user shell; S8 counts 0. | 09 | 02.3 | yes |
| E2E-M15-08 | Admin: every 404 route of AC-02.4 shows the exact 404 page, tab title and "Mula Latihan" → `/practice`. | 10 | 02.4 | |
| E2E-M15-09 | Admin: `/admin/hadiah/1` → 404 page; no "Oops! An Error Occurred". | 11 | 02.5 | |
| E2E-M15-10 | S1 header, buttons (colours, targets) and cards 59/0/0/0 with their colours. | 12, 13 | 03.1, 03.2 | |
| E2E-M15-11 | Cards unchanged at `?cat=telco`, `?cat=bogus`, `?page=2`. | 13 | 03.3 | |
| E2E-M15-12 | Pills (labels, hrefs, active style); each category lists its ids (4/8/11/8/6/8/5/6/3) with no pager; `cat=bogus` → no active pill, "Tiada hadiah dalam kategori ini.". | 14, 18 | 04.1, 04.2, 04.3 | |
| E2E-M15-13 | Table header; rows 1, 9, 26 on page 1 and 59 on page 2 match AC-04.5 exactly; ids 1…50 in order; each row has only "Edit" → edit URL. | 15, 17 | 04.4, 04.5, 04.6 | |
| E2E-M15-14 | Desktop pager (768, 1280): page 1 and page 2 texts, links, arrows, rows 51–59; no pager on category views. | 19 | 05.1, 05.2 | |
| E2E-M15-15 | Mobile pager at 375: "« Previous"/"Next »" link states on pages 1 and 2. | 20 | 05.3 | |
| E2E-M15-16 | `?page=3` → "Showing 0 of 59 results" + "Tiada hadiah di halaman ini."; `?cat=bogus&page=3` → "Tiada hadiah dalam kategori ini.". | 21 | 05.4 | |
| E2E-M15-17 | Tick row 1 → toolbar "1 hadiah dipilih", 7 buttons, sticky after scroll; select-all 50 / untick 49 / master sync / page 2 → 9; toolbar hidden with no tick; "Batal" clears ticks, hides the toolbar, no request (`lastRequest`). | 22, 23, 24 | 06.1, 06.2, 06.3, 06.4 | |
| E2E-M15-18 | Rows 1–2 ticked: dismissing "Aktifkan", "Nyahaktifkan", "Padam" dialogs shows the exact texts and sends nothing; ticks remain. | 25, 26 | 07.2 | |
| E2E-M15-19 | Accept "Aktifkan 2 hadiah?" → same URL, no tick, rows 1–2 "On", "Aktif" 2, no message; from `?cat=gaming` the URL stays `?cat=gaming`. | 16, 25, 30 | 07.1, 07.5 | yes |
| E2E-M15-20 | Rewards 1–2 active (hook) → "Nyahaktifkan" accepted → "Off", "Aktif" 0. | 25 | 07.3 | yes |
| E2E-M15-21 | "Padam" on 1 and 10 → 1 removed, 10 kept, "Total Hadiah" 58, "Showing 1 to 50 of 58 results", `/admin/hadiah/1/edit` → 404; #5 response `keptIds` [10]. | 26 | 07.4 | yes |
| E2E-M15-22 | "Set Stok" prompt text; "abc", "-1", "1.5", "1000000" → exact alert, no request; Cancel → no request. | 27 | 08.1 | |
| E2E-M15-23 | "Set Stok" "100" → Stok 100 on rows 1–2; "" → "∞"; "0" → "0". | 27 | 08.2 | yes |
| E2E-M15-24 | "Had/Bulan" prompt text; "100"/"abc" → alert, no request; "5" → edit form 5; "0" and "" → empty. | 28 | 08.3 | yes |
| E2E-M15-25 | "Pelaras Token" prompt text; "0", "-91", "501", "abc" → alert; "+50" / "-25" confirmation texts; dismiss → no request. | 29 | 08.4 | |
| E2E-M15-26 | Accept "+50" on reward 2 → Token 75, RM "RM50"; "-25" on reward 3 → 75; "12.7" on reward 4 → the request body carries "12.7" (`lastRequest`) and Token reads 6. | 29 | 08.5 | yes |
| E2E-M15-27 | S3 fields, labels, attributes, placeholders, defaults, the hint text "1 token = RM1" (no "100 syiling") at ≥ 12px; row layout at 768/1280 and one column at 375. | 31 | 09.1, 09.2 | |
| E2E-M15-28 | S3 empty submit → 4 invalid fields, no request; each out-of-range value of AC-09.3 blocks the submit. | 32 | 09.3 | |
| E2E-M15-29 | S3 valid submit (AC-09.4 values) → S1 "Total Hadiah" 60, "Aktif" 1, new row second with "📱 Telco Topup", "On"; no message. | 32 | 09.4 | yes |
| E2E-M15-30 | S3 "Batal" and back link → S1 with no confirm; total still 59. | 33 | 09.5 | |
| E2E-M15-31 | S4 prefill for ids 1, 9 and 59 (every field of AC-10.1/10.2); form action and `_method=PUT`. | 34 | 10.1, 10.2 | |
| E2E-M15-32 | S4 id 9: change Tajuk → "💾 Simpan" → S1 row 9 updated; cleared Vendor → invalid, no request. | 35 | 10.3 | yes |
| E2E-M15-33 | S4 "Batal"/back link → S1 unchanged; no delete control on S4. | 36 | 10.4 | |
| E2E-M15-34 | S2 header, back button, pills (hrefs, default active), columns, empty rows for default, pending_parent_consent, delivered; `status=bogus` → no active pill, empty row. | 37, 38 | 11.1, 11.2, 11.4 | |
| E2E-M15-35 | S2 `cancelled` and `all`: the three rows of AC-11.3 in order with exact cells, pill colour `#64748b`, empty Tindakan. | 39, 43 | 11.3 | |
| E2E-M15-36 | Fixture `queue`: 15101 row with the PROPOSED pill and controls; 15102 and 15103 in their lists with pills and no action. | 40, 43 | 12.1 | yes |
| E2E-M15-37 | Deliver 15101 with "DEMO-TNG-0001" → leaves the pending list, appears under Delivered, "Pending Proses" 0; empty field → no request. | 41 | 12.2 | yes |
| E2E-M15-38 | Cancel 15101 → Cancelled list; student 2 tokens 30 (`getWallet`); reward 40 Stok 5. | 42 | 12.3 | yes |
| E2E-M15-39 | `m15Redeem` rules: AC-13.1 (pending_admin, tokens 10, stock 4, Tebusan 1), AC-13.2 (pending_parent_consent, tokens 5), AC-13.3 (INSUFFICIENT_TOKENS, NOT_FOUND, nothing changes), AC-13.4 (OUT_OF_STOCK, MONTHLY_CAP, accepted after cancel); an injected M14 failure leaves no redemption and no stock change. | 44, 66 | 13.1, 13.2, 13.3, 13.4 | yes |
| E2E-M15-40 | Fixture `queue`: S1 "Pending Proses" 1, "Tebusan Bulan Ini" 3, Tebusan 1 for 1/26/40 and 0 for 10/16. | 45 | 13.5 | yes |
| E2E-M15-41 | S5 admin: hero, tile "0", empty state, h1 size 14px at 375 and 24px at 768/1280; `?category=gaming` identical. | 46 | 14.1, 14.2 | |
| E2E-M15-42 | S5: `setWallet(1, {tokens: 50})` → tile "50"; reward 1 activated → still the empty state, no card, no claim control. | 46, 47 | 14.3, 14.4 | yes |
| E2E-M15-43 | S6 admin: hero, chip "🎫 Token Anda: 0", four cards with exact texts, ribbons, colours and form actions; all buttons disabled "🔒 Token Tidak Cukup"; clicking sends nothing. | 48, 49 | 15.1, 15.2, 15.3 | |
| E2E-M15-44 | S6 with 5 tokens → boxes 1–2 "Buka Kotak", 3–4 locked; with 25 → all enabled. | 49, 50 | 16.1 | yes |
| E2E-M15-45 | `m15MysteryNext({coins: 12, xp: 4})`, open box 1 → modal (full-screen at 375, 400px at 768/1280) "📦", "Kotak Gangsa", "+12 🪙 · +4 XP", "Tutup"; chip 3; wallet 268 / 3 / 12 and ledger row "Kotak Misteri: Kotak Gangsa" +12; S7 tile "268 🪙". | 51, 52, 66 | 16.2, 16.4 | yes |
| E2E-M15-46 | After the opening, reload: "Sejarah Kotak Misteri" first row "Kotak Misteri: Kotak Gangsa", "+12 🪙 · +4 XP", "25/09 15:40"; without openings no history card. | 53 | 16.3 | yes |
| E2E-M15-47 | S7 admin: header, "SYILING ANDA" "256 🪙", "Cabutan Dibuka", empty text; no other section. | 54 | 17.1 | |
| E2E-M15-48 | Fixture `draw`: card content of AC-18.1; empty box gone. | 55 | 18.1 | yes |
| E2E-M15-49 | Buy a ticket → "206 🪙", "Tiket anda: 1/10", the M14 ledger (`ledger(1)`) has a `spend` row "Tiket Cabutan: Cabutan Demo" −50; #13 refusals return `DRAW_CLOSED` / `TICKET_LIMIT` / `INSUFFICIENT_BALANCE`; balance 40 → disabled; 10 tickets held → disabled; `setNow('2026-10-01T08:00:00+08:00')` → the draw is not listed. | 56 | 18.2, 18.3 | yes |
| E2E-M15-50 | S8 admin: exact h1, sub, headings "(0)" and both empty texts. | 57 | 19.1 | |
| E2E-M15-51 | Fixture `queue`, parent 6: "(1)", the 15102 card content, history 15101 and 15103; admin and parent 5401 still "(0)". | 58, 59 | 19.2, 20.1 | yes |
| E2E-M15-52 | Parent 6 "✅ Lulus" on 15102 → "(0)", history pill "⏳ Pending Admin", S2 default lists 15102; after reset, "❌ Tolak" → history "❌ Dibatalkan", student 4 tokens 25, reward 1 Tebusan 0. | 60, 61 | 20.2, 20.3 | yes |
| E2E-M15-53 | Parent 5401 posts approve for 15102 → 404; 15102 unchanged. | 58 | 20.4 | yes |
| E2E-M15-54 | Responsive sweep: S1 (with toolbar), S2, S3, S4, S5, S6, S7, S8, 404 at 375/768/1280 have `scrollWidth` ≤ viewport; S1/S2 table containers scroll at 375/768 (`scrollWidth` > `clientWidth`) and "Edit" / "TARIKH" / "TINDAKAN" become visible after scrolling; no scroll at 1280; S1 cards 2×2 vs 1×4, toolbar rows, S3 one column, S6 1/3/4 columns. | 62 | 21.1, 21.2, 21.3 | |
| E2E-M15-55 | Computed font sizes: no text node in M15 page content below 12px on S1–S8 at every width (incl. "Off", "❌ Dibatalkan", the hint, the ribbons). | 63 | 21.4 | |
| E2E-M15-56 | Dialogs are native (`page.on('dialog')` types confirm/prompt/alert); invalid form fields report `validity` natively; no `role`/`aria-*` attributes on M15 controls except the pager's live labels. | 64 | 21.5 | |
| E2E-M15-57 | `failNext('/api/admin/hadiah')` and `failNext('/api/admin/hadiah/redemptions')` → the shared error state; no horizontal scroll. | 65 | 21.6 | |

Provisional: E2E-M15-05, 06, 07, 19, 20, 21, 23, 24, 26, 29, 32, 36, 37, 38, 39, 40, 42, 44, 45, 46, 48, 49, 51, 52, 53 (25 of 57)

---

## 13. Open questions

URS §9 OQ-M15-01…12 apply unchanged. Additional SRS points:

1. **SQ-M15-01 Owner acceptance of §6.10.** M14 SRS v1.0 has accepted or closed XR-01/02/03/05/06/07/08 (status column); still open for the XL gate: XR-04 wording (S5 rule), XR-12 (openings count), M02 XR-09/10 and the shell owner's XR-11.
2. **SQ-M15-02 Token ledger — CLOSED (M14 SRS §6.13, BR-M14-22):** token debits and refunds from M15 go to M14's internal TokenMovement log (DATA-M14-21), not to the coin ledger and not to any screen; M15 passes `source` and `refId`. Syiling credits of the mystery box appear in the coin ledger as `earn` rows "Kotak Misteri: {name}".
3. **SQ-M15-03 Redemption ids.** Live never shows a redemption id; the seed uses 1–3 (fictitious) and fixtures 15101–15199. If a later live observation exposes ids (e.g. in the fulfilment form action), the seed will adopt them.
4. **SQ-M15-04 S2 paging.** The live queue never had more than 3 rows; 50 per page with the S1 pager is INFERRED from the empty paginator slot and the S1 paginator.
