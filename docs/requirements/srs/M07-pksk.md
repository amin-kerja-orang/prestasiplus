# M07 — Premium PKSK — Software Requirements Specification

## 0. Document control

| Field | Value |
|---|---|
| Document | SRS — M07 Premium PKSK |
| Version | 1.7 |
| Date | 2026-09-27 |
| Status | Approved (G1) |
| Authors | product-analyst (functional: §1–5, 8–10, 12–13) and solution-architect (data entities §6, mock API §7, NFR/SEC §11) — agent |
| Source URS | [urs/M07-pksk.md](../urs/M07-pksk.md) v1.7 |
| Evidence | [discovery/M07-pksk.md](../../discovery/M07-pksk.md), inventory `docs/discovery/inventory/M07/`, screenshots `docs/discovery/img/M07/` |

**Change log**

| Version | Date | Change |
|---|---|---|
| 1.7 | 2026-09-27 | **XL batch 3 round 1** (`docs/qa/audit/cross-module-logic-M12-M18.md`, XL3-22; M17 XR-M17-10, M04 v1.11, M14 XR-M14-08, M16 XR-M16-08). (a) PKSK seed difficulty split **253 / 253 / 191 / 66 / 0** (was 190/191/191/191), cited as the M04 named query Q-PKSK-DIFFICULTY (new request XR-M07-01; M04 v1.11 §6.13 already holds these cells); Σ 763 = Q-PKSK; the observed anchors (difficulty 2 × 3, difficulty 3 × 2) fit; Q-DIFFICULTY unchanged (§6.2, §6.8). (b) PKSK domain-practice sessions are recorded in the M05 session store with the new mode **`pksk`** and complete through M05 BR-31 with the steps of new BR-M07-26 (M14 syiling at the tier's PKSK rate); request XR-M07-02 to M05; §7 #21 returns `sessionId`; new FR-M07-65, E2E-M07-45 (provisional); M07, M05, M14 and M16 use the same token `pksk`. Exam attempts stay M07 records (SQ-M07-03). (c) New §13.1 cross-module requests and answers (XR-M07-01…03; XR-M14-08, XR-M16-08, XR-M17-10 answered). 65 FRs, 26 business rules, 45 E2E; traceability re-run 0 errors. Status stays Approved (G1). |
| 1.6 | 2026-09-25 | XL-37: BR-M07-24 and DATA-M07-02 `id` follow the M04 runtime id range (from 9,000,001, never max + 1); AC-M07-15.3 and E2E-M07-29 assert #9000001 for the first created question. Status stays Approved (G1). |
| 1.5 | 2026-09-25 | XL-31 (M04 v1.5 Q-DIFFICULTY): PKSK seed difficulty limited to 1–4 with the exact split 190/191/191/191 and no difficulty 5 (§6.2, §6.8); observed anchor values kept (2, 3). No AC/E2E assumed difficulty 5 or another spread. Status stays Approved (G1). |
| 1.4 | 2026-09-25 | XL-22: DV-M07-13 (content text below 12px raised to 12px) in FR-M07-62, E2E-M07-44 and §10; no font sizes are recorded in the M07 inventory, so the rule applies conditionally (as M04/M06). Status stays Approved (G1). |
| 1.3 | 2026-09-25 | Cross-module alignment: users use the canonical integer ids of M01 SRS v1.5 (§6.8); default access rows mapped to canonical accounts — row 1 Pelajar Demo (2), row 2 Ibu Bapa Demo (6), row 3 Pelajar Maju Demo (4); pelajar2 (3) has no grant; SQ-M07-02 closed. |
| 1.2 | 2026-09-25 | Audit round 2 (PASS) minor AUD-M07-11: §6.8 anchors 178432–178450 carry their full live texts and 178174 / 177919 / 178175 their live difficulty and explanation (OBSERVED; only the unread tail of the 178175 explanation stays seed-assigned). |
| 1.1 | 2026-09-25 | **Audit round 1 fixes** (`docs/qa/audit/M07-audit.md`) with Delivery Lead decisions. AUD-01: DV-M07-11 withdrawn; FR-16/17 now specify neutral provisional practice/exam pages (UNVERIFIED/INFERRED, L-2/L-3), new endpoints §7 #21–23, BR-M07-25, E2E-08 rewritten (no absence assertions). AUD-02: DV-M07-07 rejected; FR-63 now = in-card scroll as live; §10 and E2E-44 without a sticky column. AUD-03: question seed re-based on live (ids 177698–178460 contiguous, live page-39 anchors, the 13 live "inovasi" records, 178359 live text/difficulty/explanation); unobserved domain/level/text marked seed-assigned. AUD-04: default access seed = the 3 live rows; expired/revoked rows only via `seedPkskAccessEdgeCases()` in provisional E2E-39. AUD-05: §10 S5 768 filter wrap. AUD-06: BR-06/FR-26 case-insensitive values, trimmed search, unknown values OBSERVED. AUD-07: §9 guest row OBSERVED. AUD-08: FR-05/§8.3 locked card INFERRED only. AUD-09: provisional marks on E2E-05, 09, 42 (17 provisional scenarios in total; E2E-34 no longer provisional). AUD-10: FR-04/FR-13 hover and gradient styling. Now 64 FRs, 25 business rules, 23 mock endpoints (20 M07-owned), 44 E2E. |
| 1.0 | 2026-09-25 | First issue. 64 FRs, 24 business rules, 7 data entities + seed, 20 mock endpoints (17 M07-owned), 44 E2E scenarios on 3 viewports, 12 SEC items. Traceability checked by script (§12.1). |

Conventions as in the URS §0: OBSERVED / SOURCE-DERIVED / INFERRED / UNVERIFIED COPY / PROPOSED COPY / DV-M07-nn / SEC-M07-nn / L-n; D10 (accessibility replicates live). Exact live copy is quoted; displayed casing is given where CSS changes it.

### 0.1 Fidelity deviations referenced here

DV-M07-01 history page (PROPOSED COPY) · DV-M07-02 edit subtitle "Kemaskini soalan #{id}" · DV-M07-03 domain icons shown on S2/S3 · DV-M07-04 hub h1 white · DV-M07-05 Bahagian C can be saved · DV-M07-08 domain value reset on Bahagian change · DV-M07-09 stable access order (Delivery Lead choice) · DV-M07-12 404 "Mula Latihan" → `/practice` (= M01 DV-02) · DV-M07-13 no content text below 12px (XL-22). Replicated (not changed): DV-M07-06 generic tab titles, DV-M07-07 in-card table scroll, DV-M07-10 Bahagian colours. Withdrawn: DV-M07-11 (practice/exam are provisional pages, not a deviation). Full table: URS §7.

## 1. Scope

The mock implementation covers S1–S8 plus the DV-M07-01 history page and the provisional practice/exam pages (L-2/L-3), with dummy data behind a REST-shaped mock service layer (D1, D2):
- student: hub, level dashboards (T1/T4), domain list, exam history, provisional domain-practice and full-exam pages (UNVERIFIED, L-2/L-3), the level gate;
- admin: PKSK question list (stat cards, filters, bulk and row actions, pager), create, edit; access list, grant, revoke;
- access rules (grants, Kombo, expiry, revocation, the M02 flag, admin role) and the M07 entries of both shells.

Out of scope: URS §8 (M04 store/list/detail, M19 packages and prices, M02 user form, practice/exam UI pending L-2/L-3, real backend).

## 2. Screens & routes

| Route | Screen | Primary actor | Shell | Notes |
|---|---|---|---|---|
| `/pksk` | S1 hub | Logged-in user | user portal | |
| `/pksk/level/:level` | S2 dashboard | User with access to `level` | user portal | `level` ∈ `T1`, `T4`; else 404 (BR-M07-19); no access → redirect `/pksk` (FR-M07-19) |
| `/pksk/level/:level/domains` | S3 domains | same | user portal | |
| `/pksk/level/:level/history` | S4 history (DV-M07-01) | same | user portal | live HTTP 500 |
| `/pksk/level/:level/domain/:code` | S4a domain practice — provisional (L-2) | same | user portal (INFERRED) | `code` ∈ 15 codes, else 404 (INFERRED) |
| `/pksk/level/:level/exam` | S4b full exam — provisional (L-3) | same | user portal (INFERRED) | |
| `/admin/pksk/questions` | S5 list | Admin | admin | query `bahagian, level, status, search, page` |
| `/admin/pksk/questions/create` | S6 create | Admin | admin | |
| `/admin/pksk/questions/:id/edit` | S7 edit | Admin | admin | unknown / non-PKSK id → 404 |
| `/admin/pksk/access` | S8 access | Admin | admin | query `search, page` |

Tab titles (exact): S1–S4 "PRESTASIPLUS - Platform Latih Tubi Nasional" (DV-M07-06); S4a/S4b not observed (prototype uses the same default title, provisional); S5 "Soalan PKSK - Admin"; S6 "Tambah Soalan PKSK - Admin"; S7 "Edit Soalan PKSK - Admin"; S8 "Akses PKSK - Admin"; 404 page "404 - Halaman Tidak Dijumpai | PRESTASIPLUS" (M01).

Not routes (as live, not linked): `/admin/pksk`, `/admin/pksk/packages`, `/admin/pksk/domains`, `/admin/pksk/questions/:id` (live 405) → the SPA's global 404 page.

## 3. Functional requirements

| ID | Requirement | FN | Traces |
|---|---|---|---|
| FR-M07-01 | S1 SHALL set the shell header "PKSK" / "Persediaan Kemasukan SBP / MRSM / SMKA" and the tab title "PRESTASIPLUS - Platform Latih Tubi Nasional". | 1.1.1 | US-01; AC-01.1 |
| FR-M07-02 | S1 SHALL render the hero (rounded-3xl card, gradient indigo-600 → purple-600 → pink-500, dotted overlay, `fa-graduation-cap` 6xl white; h1 "Persediaan Kemasukan" text-4xl below `md`, in white — DV-M07-04; "SBP / MRSM / SMKA"; lead "Latih tubi soalan dan peperiksaan penuh untuk persediaan kemasukan sekolah berasrama penuh"). | 1.1.2 | US-01; AC-01.2 |
| FR-M07-03 | S1 SHALL render the card "Format Peperiksaan" (`fa-clipboard-list` indigo) with the three tiles of URS FN-M07-1.1.3 (letter circle colour, h3, bold count + "soalan"/"esei", "Pemberat: n%", icon chip), 1 column below `md`, 3 from `md`. | 1.1.3 | US-01; AC-01.3 |
| FR-M07-04 | S1 SHALL render "Pilih Tingkatan Anda" (`fa-layer-group`) and the T1/T4 cards (tile gradient, h3, text, `fa-play` "Mula Latihan" → `/pksk/level/{L}` as a full-width gradient button — T1 `from-indigo-600 to-purple-600`, T4 `from-purple-600 to-pink-600` — white bold text, `rounded-xl`, `hover:scale-105` with a coloured hover shadow), 1 column below `md`, 2 from `md`. No price, package name, "RM" amount or upsell link SHALL appear on any M07 student page. | 1.1.4, 1.1.6 | US-01; AC-01.4 |
| FR-M07-05 | Each level card SHALL use `GET /api/pksk/me/access` (§7 #1): when the level is accessible, `border-4 border-green-400 shadow-xl shadow-green-500/30` and the top-right badge `fa-unlock` "AKTIF" (`bg-green-500`, white) — static classes on live; otherwise the badge and green border/shadow are omitted and the rest of the card is unchanged (INFERRED only, L-1: live markup has no locked variant; locked copy/styling UNVERIFIED). | 1.1.5 | US-02; AC-02.1, AC-02.2, AC-02.3 |
| FR-M07-06 | S2 SHALL set the header "Dashboard PKSK - {L}" / "Pantau kemajuan latihan anda" and render `fa-arrow-left` "Kembali ke PKSK" → `/pksk`. | 1.2.1, 1.2.2 | US-03; AC-03.1 |
| FR-M07-07 | S2 SHALL render the readiness hero from `GET /api/pksk/levels/:level/dashboard` (§7 #3): "Skor Kesediaan Anda", `readiness.scorePct` as an integer + "%", grade pill `readiness.grade`, "Teruskan usaha anda!" (for every grade — UNVERIFIED for grades other than E, OQ-M07-04), "Jumlah Peperiksaan" `examCount`, "Purata Bahagian B" `bahagianBAvgPct` with one decimal + "%"; zero state "0%" / "E" / "0" / "0.0%" (BR-M07-09…11). | 1.2.3, 1.5.3 | US-03; AC-03.2, AC-03.3 |
| FR-M07-08 | S2 SHALL render the three shortcut cards of URS FN-M07-1.2.4 (whole card a link, hover scale-105) with the level in each href. | 1.2.4 | US-03; AC-03.4 |
| FR-M07-09 | S2 SHALL render "Penguasaan Domain" (`fa-chart-line`) with one card per Bahagian B domain (13, domain `order`), each: tile (domain colour at 13% alpha) containing the domain icon in the domain colour (DV-M07-03), h3 name, code, "Penguasaan" + `masteryPct` "%" in the domain colour, bar filled to `masteryPct`%. Bahagian A and C domains SHALL NOT be listed. | 1.2.5 | US-04; AC-04.1, AC-04.2, AC-04.4 |
| FR-M07-10 | Each S2 domain card SHALL have `fa-play` "Latih Sekarang" (background = domain colour tint, text = domain colour) → `/pksk/level/{L}/domain/{CODE}`. | 1.2.6 | US-04; AC-04.3 |
| FR-M07-11 | S3 SHALL set the header "Domain PKSK - {L}" / "Pilih domain untuk latih tubi" and render `fa-arrow-left` "Kembali ke Dashboard" → `/pksk/level/{L}`. | 1.3.1, 1.3.2 | US-05; AC-05.1 |
| FR-M07-12 | S3 SHALL render the three Bahagian sections (badge colour, h2, sub) of URS FN-M07-1.3.3 from `GET /api/pksk/levels/:level/domains` (§7 #4). | 1.3.3 | US-05; AC-05.2 |
| FR-M07-13 | Each S3 domain card SHALL be a link → `/pksk/level/{L}/domain/{CODE}` (`border-2 border-transparent`; on hover `scale-105`, `shadow-xl` and border blue-300 / purple-300 / pink-300 for A / B / C) with the domain icon (DV-M07-03), h3, code, `fa-question-circle` "Soalan" + `questionCount` (approved questions of that domain and level, BR-M07-05) and "Penguasaan" + `masteryPct`% + bar; 1 / 2 / 3 columns (below `md` / `md` / `lg`). | 1.3.4, 1.3.5 | US-05, US-23; AC-05.3, AC-05.4, AC-23.3 |
| FR-M07-14 | `/pksk/level/:level/history` SHALL render the DV-M07-01 page (never the 500 page): header "Sejarah PKSK - {L}" / "Lihat prestasi lepas", back link "Kembali ke Dashboard" → `/pksk/level/{L}`, and a read-only table "Tarikh" (dd/mm/yyyy), "Skor" ("{n}%"), "Gred" from `GET /api/pksk/levels/:level/exam-attempts` (§7 #6), newest first, with no actions, filters, pager or links. | 1.4.1, 1.4.2 | US-06; AC-06.1, AC-06.2 |
| FR-M07-15 | With no attempt, S4 SHALL show "Tiada sejarah peperiksaan." instead of the table. | 1.4.3 | US-06; AC-06.3 |
| FR-M07-16 | (Provisional, UNVERIFIED — L-2.) `/pksk/level/:level/domain/:code` SHALL render a neutral practice page from §7 #5: heading = the domain name, the session's questions (BR-M07-25) each with an answer input — option choices for A/B, a text area for C — and one submit button "Hantar" (PROPOSED COPY). "Hantar" SHALL post §7 #21 and then open `/pksk/level/{L}/domains`. No question count, layout, timer, feedback, score or result display is specified; the page is replaced after L-2. | 1.5.1 | US-07; AC-07.1 |
| FR-M07-17 | (Provisional, UNVERIFIED — L-3.) `/pksk/level/:level/exam` SHALL render a neutral exam page from §7 #22: heading "Peperiksaan Penuh" (live card copy), 30 Bahagian A items, 70 Bahagian B items and 1 Bahagian C essay (BR-M07-13, SOURCE-DERIVED), grouped A / B / C, each with an answer input, and one submit "Hantar" (PROPOSED COPY). "Hantar" SHALL post §7 #23 (completed attempt scored per BR-M07-09) and open `/pksk/level/{L}`. No timer, auto-submit, section navigation or result layout is specified; the page is replaced after L-3. | 1.5.2 | US-07; AC-07.2 |
| FR-M07-65 | (Provisional, INFERRED — L-2; v1.7.) §7 #21 SHALL record the submitted practice as one completed M05 PracticeSession with `mode = 'pksk'` through the M05 completion contract, with the steps of BR-M07-26 (QuizAnswer rows; no revision-queue, SubjectMastery or trial-counter change; M14 credit with mode `pksk`), update PkskDomainMastery (BR-M07-12) and return `{masteryPct, sessionId, gamification}`. The provisional page shows none of these values (no result display, FR-M07-16). | 1.5.1, 1.5.3 | US-07; AC-07.4 |
| FR-M07-18 | An unknown `level`, an unknown domain `code`, or an unknown/non-PKSK question id on S7 SHALL render the standalone global 404 page of M01 ("404", "🔍", "Halaman Tidak Dijumpai", text, "Halaman Utama" → `/`, "Mula Latihan" → `/practice` per DV-M07-12, "PRESTASIPLUS"; tab "404 - Halaman Tidak Dijumpai \| PRESTASIPLUS"). | 1.2.7, 1.3.6, 1.5.4, 2.3.8 | US-07, US-08, US-16; AC-07.3, AC-08.3, AC-16.7 |
| FR-M07-19 | Every `/pksk/level/:level/…` route SHALL check access (BR-M07-07): the level endpoints answer `403 FORBIDDEN` without access and the page then redirects (replace) to `/pksk` with no message (INFERRED, L-1). The unknown-level 404 check comes first. | 1.2.8, 3.2.1 | US-08; AC-08.1, AC-08.2 |
| FR-M07-20 | S5 SHALL set the header "Soalan PKSK" / "Urus soalan Pentaksiran Kemasukan Sekolah Khusus" and render `fa-plus` "Tambah Soalan" (green-600) → `/admin/pksk/questions/create`, right-aligned after the filters and wrapping below them when narrow. | 2.1.1, 2.1.4 | US-09; AC-09.1 |
| FR-M07-21 | S5 SHALL render five stat cards from `GET /api/admin/pksk-questions/stats` (§7 #8) — "Jumlah", "Diluluskan", "Menunggu", "Ting. 1", "Ting. 4" with the colours of URS FN-M07-2.1.2 — computed over all PKSK questions and never affected by filters, search or page (BR-M07-05). | 2.1.2 | US-09, US-10; AC-09.2, AC-10.2 |
| FR-M07-22 | S5 SHALL render the table of URS FN-M07-2.1.7: columns [checkbox] "Soalan" "Bahagian" "Domain" "Level" "Status" "Tindakan"; "Soalan" = text cut to 80 characters (trailing spaces trimmed) + "..." when longer, on one CSS-truncated line (`max-w-xs`); pills/chips with the observed colours; "Menunggu" and "Ditolak" pills use the §8.2 placeholder colours (UNVERIFIED, L-6). | 2.1.7 | US-09; AC-09.3 |
| FR-M07-23 | The list SHALL order rows by `createdAt` descending, then `id` ascending (BR-M07-06), 20 per page. | 2.1.13 | US-09; AC-09.4 |
| FR-M07-24 | S5 SHALL render the shared Laravel-style pager (M04 SRS §8.1): from 640px "Showing {from} to {to} of {total} results" + window + chevrons (aria "&laquo; Previous" / "Next &raquo;", "Go to page {n}"); below 640px "« Previous" / "Next »" (plain text when unavailable); every link keeps `bahagian`, `level`, `status`, `search`. No pager when there are no rows. | 2.1.10, 2.1.11 | US-09, US-10; AC-09.5, AC-10.2 |
| FR-M07-25 | S5 SHALL render the GET filter form of URS FN-M07-2.1.3; a change of any select SHALL navigate at once to the list with the new query (page reset), "Cari" or Enter in the search field submits all four values; the controls SHALL show the current query values. Below 768px the controls wrap (Bahagian + Level / Status + search / "Cari"); at 768px the selects and the search share one row and "Cari" wraps below; "Tambah Soalan" sits below at both. | 2.1.3 | US-10; AC-10.1, AC-10.2 |
| FR-M07-26 | The list SHALL apply `bahagian` (domain's Bahagian), `level`, `status` (values matched case-insensitively, e.g. `level=t1`) and `search` (trimmed, case-insensitive substring of the question text) with AND; unknown values match nothing (BR-M07-06, OBSERVED). | 2.1.13 | US-10; AC-10.3 |
| FR-M07-27 | With no matching row, S5 SHALL keep the table header and show one full-width row: `fa-inbox`, "Tiada soalan PKSK lagi", link "Tambah soalan pertama" → create; no pager. | 2.1.12 | US-10; AC-10.4 |
| FR-M07-28 | S5 selection: row checkboxes toggle their id in `selectedIds`; the header checkbox sets `selectedIds` to the ids of the current page when ticked and `[]` when unticked, and is not changed by row clicks. | 2.1.5 | US-11; AC-11.1, AC-11.2 |
| FR-M07-29 | The bulk bar (indigo-50) SHALL show only while `selectedIds.length > 0`, reading "{n} dipilih", with "Luluskan" (green-600) and "Tolak" (amber-600) that call §7 #13 with no confirm, and "Padam" (red-600) that first asks `window.confirm('Padam soalan terpilih?')` and sends nothing on cancel. | 2.1.6 | US-11; AC-11.3 |
| FR-M07-30 | After a bulk call (INFERRED, L-8) the list SHALL reload at the same URL with the success flash of §8.2 (UNVERIFIED COPY), the selection cleared and the stat cards refreshed. | 2.1.14 | US-11; AC-11.4, AC-11.5 |
| FR-M07-31 | Each row SHALL have `fa-edit` (indigo, icon only) → `/admin/pksk/questions/{id}/edit`; there is no view link. | 2.1.8 | US-12; AC-12.1 |
| FR-M07-32 | Each row SHALL have `fa-trash` (red-500, icon only) that asks `window.confirm('Padam soalan ini?')`; on OK it calls §7 #12 and reloads the list at the same URL with the §8.2 flash (INFERRED); on cancel nothing is sent. | 2.1.9, 2.1.14 | US-12; AC-12.2 |
| FR-M07-33 | S6 SHALL set the header "Tambah Soalan PKSK" / "Cipta soalan baru untuk PKSK" and render the card "Bahagian & Domain" of URS FN-M07-2.2.2: `bahagian` select (required), `pksk_domain_id` select (required) listing `-- Pilih domain --` + the domains of the chosen Bahagian by plain name (all 15 when none), `pksk_target_level` select (required, no empty option, default T1). | 2.2.1, 2.2.2 | US-13; AC-13.1, AC-13.2, AC-13.3 |
| FR-M07-34 | Changing `bahagian` SHALL refilter the domain list and set the domain value to '' (display and state, DV-M07-08); no other field SHALL change. | 2.2.8 | US-13; AC-13.4 |
| FR-M07-35 | S6 SHALL render the card "Soalan" of URS FN-M07-2.2.3 with "3 - Sederhana" preselected. | 2.2.3 | US-14; AC-14.1 |
| FR-M07-36 | S6 "Pilihan Jawapan" SHALL be visible unless Bahagian is C; its title SHALL carry "(Tiada jawapan betul/salah)" only for A; each row's "Betul" checkbox SHALL be visible only for B; any number of rows may be ticked. Hidden checkboxes keep their state. | 2.2.4, 2.2.5 | US-14; AC-14.2, AC-14.4 |
| FR-M07-37 | S6 SHALL start with 4 option rows; "Tambah Pilihan" appends an empty row and is hidden at 6 rows; each row's `fa-times` removes that row and is hidden at 2 rows; letters are recomputed from the row position (A, B, C…). | 2.2.5, 2.2.6 | US-14; AC-14.3 |
| FR-M07-38 | S6 SHALL use only native HTML validation (`required` on `bahagian`, `pksk_domain_id`, `pksk_target_level`, `question_text`, `difficulty_level` and the visible option texts; no `novalidate`, no custom message). While Bahagian is C the option inputs SHALL be `disabled` (not validated, not sent; values kept), so a C question with domain and text can be saved (DV-M07-05). | 2.2.9 | US-15; AC-15.1, AC-15.2 |
| FR-M07-39 | "Simpan Soalan" SHALL call §7 #10; on 201 the app opens `/admin/pksk/questions` with the §8.2 success flash (UNVERIFIED COPY); on 422 the field errors show under their fields in red (UNVERIFIED COPY) and the input is kept (INFERRED, L-5). | 2.2.10 | US-15; AC-15.3 |
| FR-M07-40 | "Kembali" (`fa-arrow-left`, S6 and S7) SHALL navigate to `/admin/pksk/questions` without a dialog and without saving. | 2.2.7, 2.3.7 | US-15, US-16; AC-15.4, AC-16.6 |
| FR-M07-41 | S7 SHALL set the header "Edit Soalan PKSK" / "Kemaskini soalan #{id}" (DV-M07-02). | 2.3.1 | US-16; AC-16.1 |
| FR-M07-42 | S7 SHALL load §7 #9 and preselect/prefill: `pksk_domain_id` (15 options "[{Bahagian}] {name}"), `pksk_target_level` ("Tingkatan 1" / "Tingkatan 4"), `status` ("Menunggu" / "Diluluskan" / "Ditolak", required), `question_text` (required, no label/placeholder), "Kesukaran" `difficulty_level` ("1"–"5", not required), "Penjelasan"; card layout 1 → 3 columns from `md` and "Kesukaran" in a 2-column grid at every width. | 2.3.2, 2.3.3 | US-16; AC-16.2 |
| FR-M07-43 | S7 SHALL render "Pilihan Jawapan" (no suffix) only when the saved Bahagian is A or B, with the saved options (no placeholder), "Betul" visible only when the saved Bahagian is B (A: checkbox hidden, state kept and sent), remove at >2, "Tambah Pilihan" at <6; changing the domain SHALL NOT change the card. | 2.3.4, 2.3.5, 2.3.6 | US-16; AC-16.3, AC-16.4 |
| FR-M07-44 | "Kemaskini" (`fa-save`, indigo-600) SHALL call §7 #11; on 200 the list opens with the §8.2 flash (INFERRED, L-5); on 422 errors show under the fields. | 2.3.7, 2.3.9 | US-16; AC-16.5 |
| FR-M07-45 | S8 SHALL set the header "Akses PKSK" / "Urus akses premium pengguna" and render three stat cards from §7 #15 ("Jumlah Akses Aktif" indigo-600, "Akses T1" blue-600, "Akses T4" purple-600; `grid-cols-3` at every width), unaffected by search and page. | 3.1.1, 3.1.2 | US-17; AC-17.1 |
| FR-M07-46 | S8 SHALL render the table of URS FN-M07-3.1.6 from §7 #14: "Pengguna" (name bold, e-mail text-xs), "Pakej" chip (package name without the level suffix), "Diberi Oleh" (granter name or "-"), "Tarikh" (`grantedAt` dd/mm/yyyy), "Tamat" (`expiresAt` dd/mm/yyyy or "Tiada had"), "Status" (§8.2 label), "Tindakan" ("Tarik" only on active rows). | 3.1.6 | US-17; AC-17.2 |
| FR-M07-47 | S8 rows SHALL be ordered by `grantedAt` descending, then `id` descending (DV-M07-09), 20 per page, identical on every load. | 3.1.9 | US-17; AC-17.2 |
| FR-M07-48 | S8 SHALL render the search card (GET `search`, "Cari nama / email...", `fa-search` "Cari"); with no row it keeps the header and shows one full-width row `fa-lock` "Tiada rekod akses"; the pager (FR-M07-24 component) shows only above 20 rows and keeps `search`. | 3.1.5, 3.1.8 | US-17; AC-17.3 |
| FR-M07-49 | "Beri Akses Baru" (`fa-plus`, green-600) SHALL toggle the grant form (fade/slide transition); the form starts hidden on every page load, keeps its values while hidden and has no cancel button. | 3.1.3 | US-18; AC-18.1 |
| FR-M07-50 | The grant form SHALL have "ID Pengguna" (`type=number`, placeholder "User ID", required, no min), "Pakej" (required, three options of §7 #18 labelled "{name} ({level})", first selected, no empty option), "Tamat Tempoh" (`type=date`, optional, no min) and `fa-check` "Beri Akses" (indigo-600); native validation only; 1 column below `md`, 4 from `md`. | 3.1.4 | US-18; AC-18.2, AC-18.3 |
| FR-M07-51 | "Beri Akses" SHALL call §7 #16; on 201 the page reloads (form hidden) with the §8.2 flash and the new row; on 422 the error shows under "ID Pengguna" (UNVERIFIED COPY) and nothing is added (INFERRED, L-7). | 3.1.10 | US-18, US-08; AC-18.4, AC-18.5, AC-08.2 |
| FR-M07-52 | "Tarik" (`fa-ban`, red-500) SHALL ask `window.confirm('Tarik balik akses?')`; on OK it calls §7 #17 and reloads with the §8.2 flash; the row stays with the revoked label and no "Tarik"; on cancel nothing is sent. | 3.1.7, 3.1.10 | US-19; AC-19.1, AC-19.2 |
| FR-M07-53 | Rows whose grant is expired or revoked SHALL show the §8.2 status label (UNVERIFIED COPY) instead of "Aktif", no "Tarik", and SHALL NOT count in the stat cards (INFERRED, L-7). | 3.1.10 | US-19, US-20; AC-19.3, AC-20.2 |
| FR-M07-54 | Level access SHALL follow BR-M07-07 (active grant for the level or ALL; M02 flag; admin role) everywhere: hub badges, level gate and level endpoints. | 3.2.1 | US-20, US-02; AC-20.1, AC-20.2, AC-20.3, AC-20.4 |
| FR-M07-55 | The access stat cards SHALL count per BR-M07-08 (a Kombo grant counts in "Akses T1" and "Akses T4"). | 3.2.2 | US-20; AC-20.5 |
| FR-M07-56 | The user shell SHALL list `fa-shield-halved` "PKSK" + indigo "PRO" pill → `/pksk` in the "Pembelajaran" section of the desktop sidebar (≥1024px) and of the drawer (<1024px). | 4.1.1 | US-21; AC-21.1 |
| FR-M07-57 | The admin shell SHALL have the collapsible group "Premium" (key `premium`, `fa-shield-halved` indigo, label upper case) with "PKSK Soalan" (`fa-shield-halved`) and "PKSK Akses" (`fa-key`), open by default on M07 admin pages (global rule: the group of the active page opens), and the same two links under "Premium" in the mobile "Lagi" sheet. | 4.2.1, 4.2.2 | US-21, US-09; AC-21.2, AC-21.3, AC-09.1 |
| FR-M07-58 | Every M07 route SHALL redirect a guest to `/login` (M01 FR-M01-14). | 4.3.1 | US-22; AC-22.1 |
| FR-M07-59 | `/admin/pksk/*` SHALL require the admin role: another role is redirected to its landing path (M01 BR-07) and every `/api/admin/pksk-*` endpoint answers `403 FORBIDDEN` (INFERRED, M02 FR-M02-99 pattern). | 4.3.2 | US-22; AC-22.2 |
| FR-M07-60 | PKSK questions SHALL be records of the M04 question store with the PKSK fields (§6.2): the M04 list, filters and counts SHALL exclude them; the M04 detail page SHALL show them (M04 change request, OQ-M07-09a). | 4.3.3 | US-23; AC-23.1, AC-23.2 |
| FR-M07-61 | Domain lists (S2, S3, S5 domain cell, S6, S7) SHALL come from §7 #2 and package lists (S8) from §7 #18 (M19-owned), never hard-coded in screens. | 4.3.4 | US-23, US-13, US-18; AC-13.2, AC-18.2 |
| FR-M07-62 | Every M07 screen SHALL have no horizontal page scroll at 320–1920px, SHALL follow the per-screen grids of §10, and SHALL render no content text inside `main` below 12px (DV-M07-13; icons excluded). | all screen FNs | US-24; AC-24.1, AC-24.3, AC-24.5 |
| FR-M07-63 | Below 1024px on S5 and below 768px on S8 the table SHALL scroll horizontally inside its card (`overflow-x-auto`) with no sticky column, and the page SHALL NOT scroll horizontally (as live; NFR-RESP-05 b; DV-M07-07 rejected). | 2.1.7, 3.1.6 | US-24; AC-24.2 |
| FR-M07-64 | S6 and S7 footers SHALL keep "Kembali" (left) and the submit (right) on one row at every width (`justify-between`); S7 "Kesukaran" stays in its 2-column grid at 375px. | 2.2.7, 2.3.3 | US-24; AC-24.4 |

## 4. Business rules

| ID | Rule | Source |
|---|---|---|
| BR-M07-01 | A question's Bahagian is its domain's Bahagian; it is not stored separately. The create form's `bahagian` only filters the domain list (the server ignores it apart from validating that the domain belongs to it). | INFERRED (R-6: edit has no Bahagian field; list shows the domain's letter) |
| BR-M07-02 | Question `status` ∈ `pending` "Menunggu", `approved` "Diluluskan", `rejected` "Ditolak"; any value may follow any other. Bulk `approve` → approved, `reject` → rejected, `delete` and row delete → permanently removed. | OBSERVED (values, labels) / INFERRED (transitions, hard delete) |
| BR-M07-03 | A question created on S6 is saved `approved` (OQ-M07-05). | INFERRED |
| BR-M07-04 | Options: Bahagian A and B questions hold 2–6 `{text, isCorrect}`; B may have any number of `isCorrect` (none included, OQ-M07-07); A stores the flags exactly as posted (live A records hold one `true`); C holds none. The edit form posts what it shows (options follow the saved Bahagian, OQ-M07-10). | OBSERVED (UI limits, stored flags) / INFERRED (server) |
| BR-M07-05 | Counts: S3 "Soalan" = questions with that domain and level and `status = approved`. S5 cards: "Jumlah" = all PKSK questions, "Diluluskan" = approved, "Menunggu" = pending, "Ting. 1" / "Ting. 4" = all PKSK questions of that level (every status). Student pages use approved questions only. | OBSERVED (values equal live: 763/763/0/383/380; S3 sums 383/380) / INFERRED (status scope) |
| BR-M07-06 | S5 list: filters AND-combined; `bahagian` matches the domain's Bahagian, `level` = `pkskTargetLevel`, `status`; filter values compare case-insensitively (`?level=t1` → 383); `search` is trimmed and a case-insensitive substring of `questionText` (`INOVASI`, ` inovasi ` → 13); unknown filter values (`status=zzz`, `bahagian=Z`, `level=T9`) match nothing; order `createdAt` desc, then `id` asc; 20 per page; pager links keep all filters. | OBSERVED (results, order, pager, case, trim, unknown values) |
| BR-M07-07 | User U can use level L when (a) U has an access row with `status = active`, `expiresAt` null or ≥ today (Asia/Kuala_Lumpur) and package level L or `ALL`; or (b) `U.hasPkskSubscription = true` (M02; both levels, no expiry, OQ-M07-01); or (c) U's role is `admin` (both levels, OQ-M07-03). | OBSERVED (admin AKTIF, Kombo 3/3/3) / INFERRED (rule) |
| BR-M07-08 | Access stats: "Jumlah Akses Aktif" = active rows (not revoked, not expired); "Akses T1" = active rows with package level T1 or ALL; "Akses T4" = T4 or ALL. The M02 flag and the admin role are not counted. | OBSERVED (3 Kombo → 3/3/3) / INFERRED |
| BR-M07-09 | Readiness `scorePct` = mean of the `scorePct` of the user's completed exams at that level, displayed rounded to an integer; 0 with no exam. An exam's `scorePct` = 0.2 × A% + 0.7 × B% + 0.1 × C% (the S1 weights). | SOURCE-DERIVED (weights) / INFERRED (OQ-M07-04) |
| BR-M07-10 | Grade from a percentage: A ≥ 80, B 65–79, C 50–64, D 40–49, E < 40 (E at 0% OBSERVED). | INFERRED (OQ-M07-04) |
| BR-M07-11 | "Jumlah Peperiksaan" = number of completed exams at the level; "Purata Bahagian B" = mean of their `bahagianBPct`, one decimal; 0.0 with none. | INFERRED |
| BR-M07-12 | Mastery = a stored percentage per user, level and domain (0 when absent). Provisional prototype rule until L-2/L-3: a submitted practice session sets the domain's mastery to its percentage of correct answers (A/B: the flagged option; C: the simulated marker, D4). | INFERRED (provisional) |
| BR-M07-13 | Full exam composition: 30 Bahagian A + 70 Bahagian B questions + 1 Bahagian C essay, from approved questions of the level. | SOURCE-DERIVED (S1 copy) / INFERRED (pool) |
| BR-M07-14 | Grant: `userId` must be an existing user; `packageId` ∈ 1, 2, 3; `expiresAt` optional date with no lower or upper bound (a past date gives an already-expired row). Creates `status = active`, `grantedById` = the admin, `grantedAt` = now. Several rows per user are allowed. | OBSERVED (form) / INFERRED (OQ-M07-06) |
| BR-M07-15 | Revoke: allowed only on an active, non-expired row; sets `status = revoked`, `revokedAt` = now; the row stays listed. Otherwise `409 CONFLICT`. | INFERRED (OQ-M07-06) |
| BR-M07-16 | Display status of an access row: `revoked` if revoked; else `expired` if `expiresAt` < today; else `active` ("Aktif"). An expiry date is valid through the end of that day. | OBSERVED ("Aktif") / INFERRED |
| BR-M07-17 | Access list order: `grantedAt` desc, then `id` desc (DV-M07-09). | DV-M07-09 |
| BR-M07-18 | Access search: case-insensitive substring of the user's name or e-mail; 20 per page. | INFERRED (placeholder "Cari nama / email...") |
| BR-M07-19 | `level` ∈ `T1`, `T4` (case-sensitive); `code` ∈ the 15 domain codes (every code valid for both levels). Anything else → 404. | OBSERVED (T9, ALL → 404) / INFERRED (code) |
| BR-M07-20 | Domain order everywhere = `order` (= id 1–15). Bahagian B list on S2 = domains 2–14. | OBSERVED |
| BR-M07-21 | M04 relation: a question with `pkskDomainId ≠ null` is a PKSK question; the M04 list, filters, tiles and counts exclude it; M04 `GET /api/questions/:id` returns it. PKSK endpoints accept only PKSK question ids (404/422 otherwise, SEC-M07-12). | OBSERVED (M04 list excludes, detail shows) / INFERRED (M04 counts, guard) |
| BR-M07-22 | Formats: dates dd/mm/yyyy (S8, S4); percentages as integers except "Purata Bahagian B" (one decimal); counts without separators (all < 1,000). | OBSERVED |
| BR-M07-23 | S5 text cut: `questionText` longer than 80 characters → first 80 characters, trailing spaces trimmed, + "..." (Laravel `Str::limit`). | OBSERVED (80 + "...") / INFERRED (trim) |
| BR-M07-24 | Question id numbering: PKSK rows share the M04 question store, so a PKSK question created at runtime takes the next id of the M04 runtime range, which starts at **9,000,001** and increases by 1 (never `max + 1`; M04 SRS §6.1 and §6.12 runtime id range, XL-37). On a fresh seed the first created question is #9000001. | M04 rule (XL-37) |
| BR-M07-25 | Provisional practice session: approved questions of the domain and level, in random order, 10 per session (prototype choice, not observed; all when fewer). Answers are never checked in the browser; `isCorrect` is not sent to the student (SEC-M07-07). | INFERRED (provisional, L-2) |
| BR-M07-26 | **Recording a PKSK practice session (v1.7, XL3-22; D12).** Practice sessions belong to M05's session store (DATA-M05-01), so a submitted domain practice (§7 #21) is stored there as one completed PracticeSession with **`mode = 'pksk'`** (a new M05 mode, XR-M07-02), never as an M07 copy. The same token `pksk` is the M14 session mode (BR-M14-03, source `quiz_pksk`) and the M16 battle `questionType` (BR-M16-03). The mock scores the answers on the server side (A/B: the flagged options; C: the simulated marker, D4) and hands the session to M05, which applies its completion contract BR-31 as follows: (1) session `mode = 'pksk'`, `subjectId = null`, link fields `pkskDomainId` and `pkskTargetLevel`, `questionCount` = items served, `correctCount`, `timeSpent` = seconds from the §7 #5 load to "Hantar" (PROPOSED), `startedAt`, `completedAt` = now, `status = completed`; (2) one QuizAnswer per item (`questionId` = the PKSK row, `subjectId` null, `isCorrect`); (3) revision queue — not touched (PKSK rows have no subject; M05 revision is per subject); (4) SubjectMastery — not touched; M07 updates its own PkskDomainMastery instead (BR-M07-12); (5) trial counter — not touched (PKSK access is BR-M07-07, not the M05 trial); (6) M14 `gamification.onSessionCompleted({…, mode: 'pksk', correct, total, …})` without `coinsPerCorrect`, so M14 credits the tier's `pksk_reward_correct` (live tier setting "🛡️ PKSK — Syiling per Jawab Betul", "Semua soalan PKSK (tiada level)", OBSERVED on M14 S2) with ledger source `quiz_pksk`; (7) M05 returns `sessionId` and the gamification result, and §7 #21 returns them with `masteryPct`. Full-exam attempts (§7 #23) are **not** M05 sessions and credit no syiling (DATA-M07-05; SQ-M07-03). The seed has no PKSK session, so no M05 count or seeded total changes. | OBSERVED (tier setting) / INFERRED (provisional, L-2) / Delivery Lead D12 |

## 5. Validation rules

Client checks are only the native HTML ones listed (as live, D10). Server messages are UNVERIFIED COPY; the mock returns them in `error.fields` and the form shows them under the field in red.

| Form / field | Rule | Message | Trigger |
|---|---|---|---|
| S6 `bahagian` | required; A, B or C | native bubble; server "Sila pilih bahagian." (UNVERIFIED COPY) | submit |
| S6/S7 `pksk_domain_id` | required; existing domain; on S6 must belong to `bahagian` | native bubble; server "Sila pilih domain." (UNVERIFIED COPY) | submit |
| S6/S7 `pksk_target_level` | required; T1 or T4 (no empty option) | — | — |
| S7 `status` | required; pending / approved / rejected | — | — |
| S6/S7 `question_text` | required | native bubble; server "Sila masukkan teks soalan." (UNVERIFIED COPY) | submit |
| S6 `difficulty_level` | required; 1–5 (default 3) | — | — |
| S7 `difficulty_level` | optional; 1–5 | — | — |
| S6/S7 `explanation` | optional | — | — |
| S6/S7 `options[i][text]` | required on visible rows (A/B); 2–6 rows (UI limits); disabled and not sent for C (DV-M07-05) | native bubble | submit |
| S6/S7 `options[i][is_correct]` | optional, value 1 | — | — |
| S8 `user_id` | required; integer; existing user | native bubble (empty); server "Pengguna tidak dijumpai." (UNVERIFIED COPY) | submit |
| S8 `pksk_package_id` | required; 1–3 | — | — |
| S8 `expires_at` | optional; valid date; no bound | — | — |
| Bulk `action`, `ids[]` | action ∈ approve/reject/delete; ≥1 id; every id a PKSK question | server 422 (not reachable from the UI) | submit |

## 6. Data entities & fields

*(solution-architect)* JSON fields are camelCase. IDs: SRS.md §7.4 exception applies — M07 shows or takes numeric ids (question "#178460" and `/…/{id}/edit`, access `access_id`, the "ID Pengguna" number field), so questions, domains, packages, access rows **and users** use integer ids (user ids: the canonical integer ids of M01 SRS v1.5, §6.8). Dates ISO 8601 with +08:00; "today" from the mock clock. All data lives in the in-memory store seeded from fixtures and reset per E2E test (`mock.reset()`).

### 6.1 DATA-M07-01 — PkskDomain (owned by M07; read-only)

| Field | Type | Req | Notes |
|---|---|---|---|
| id | int 1–15 | yes | live ids (URS Appendix-A values, §6.8) |
| bahagian | enum `A`, `B`, `C` | yes | |
| name | string | yes | BM name ("Matematik") |
| nameEn | string | yes | shipped as live (`allDomains`), not displayed |
| code | string `PKSK_*` | yes | unique; used in URLs |
| icon | string (FA name) | yes | e.g. `fa-calculator`; the prototype maps it to a Lucide icon (global icon map) |
| color | string hex | yes | e.g. `#3b82f6` |
| order | int | yes | = id |
| isActive | boolean | yes | all true |
| createdAt, updatedAt | datetime | yes | 2026-02-07T00:57:33+08:00 |

### 6.2 DATA-M07-02 — PKSK fields of the M04 Question (owned by M04; defined here)

PKSK questions are rows of DATA-M04-01 (M04 SRS §6.1). **Change request to M04 (OQ-M07-09a):** add the fields below; allow `subjectId`, `educationLevelId`, `options`, `correctAnswer` to be null for PKSK questions; exclude `pkskDomainId ≠ null` rows from every M04 list, filter, tile and count; the M04 detail page renders `pkskOptions` (0–6, any number of correct).

| Field | Type | Req | Notes |
|---|---|---|---|
| id | int | yes | shared M04 store; seed = live ids 177698–178460; runtime-created from 9,000,001 (BR-M07-24) |
| pkskDomainId | int → PkskDomain | yes (PKSK) | discriminator: non-null = PKSK question |
| pkskTargetLevel | enum `T1`, `T4` | yes | |
| questionText | string | yes | plain text |
| explanation | string \| null | no | C records hold the marking note |
| difficultyLevel | int 1–5 | yes | M04 scale (1 Sangat Mudah … 5 Sangat Sukar); seed uses 1–4 only: M04 Q-PKSK-DIFFICULTY 253 / 253 / 191 / 66 / 0 (§6.8; XR-M07-01; part of M04 Q-DIFFICULTY) |
| status | enum `pending`, `approved`, `rejected` | yes | subset of M04 statuses |
| pkskOptions | `{text: string, isCorrect: boolean}[]` | yes | length 0 (C) or 2–6 (A/B) |
| questionType | `mcq` (A/B) \| `essay` (C) | yes | INFERRED; lets M04 S3 pick its layout |
| subjectId, educationLevelId | null | — | PKSK questions have no subject or level (INFERRED) |
| createdAt, updatedAt | datetime | yes | order key |
| (derived) bahagian | `A`/`B`/`C` | — | from the domain (BR-M07-01) |

API shapes: `PkskQuestionListItem` = `{id, questionText, bahagian, domain: {id, code, name, icon, color}, targetLevel, status}`. `PkskQuestionDetail` = `{id, bahagian, pkskDomainId, pkskTargetLevel, status, questionText, difficultyLevel, explanation, options: [{text, isCorrect}]}`.

### 6.3 DATA-M07-03 — PkskPackage (owned by M19; M07 reads)

| Field | Type | Notes |
|---|---|---|
| id | int 1–3 | live option values |
| name | string | "PKSK Tingkatan 1 (SBP/MRSM)", "PKSK Tingkatan 4 (SBP/MRSM)", "PKSK Kombo (T1 + T4)" |
| level | enum `T1`, `T4`, `ALL` | select label "{name} ({level})"; table chip = name |
| (M19) price, … | — | not shown in M07; owned by M19 |

### 6.4 DATA-M07-04 — PkskAccess (owned by M07)

| Field | Type | Req | Notes |
|---|---|---|---|
| id | int | yes | live `access_id` |
| userId | int → User | yes | |
| packageId | int → PkskPackage | yes | |
| grantedById | int → User \| null | no | null → "-" |
| grantedAt | datetime | yes | "Tarikh" |
| expiresAt | date \| null | no | null → "Tiada had" |
| status | enum `active`, `revoked` | yes | |
| revokedAt | datetime \| null | no | |
| (derived) displayStatus | `active` \| `expired` \| `revoked` | — | BR-M07-16 |

API shape `PkskAccessItem` = `{id, user: {id, name, email}, package: {id, name, level}, grantedBy: {id, name} | null, grantedAt, expiresAt, status, displayStatus}`.

### 6.5 DATA-M07-05 — PkskExamAttempt (owned by M07; INFERRED, L-3)

`{id: int, userId: int, level: 'T1'|'T4', completedAt: datetime, scorePct: number (1 decimal), bahagianAPct, bahagianBPct, bahagianCPct: number, grade: 'A'…'E'}`. Only completed attempts are stored (the provisional exam page posts one per "Hantar", §7 #23).

### 6.6 DATA-M07-06 — PkskDomainMastery (owned by M07; INFERRED)

`{userId: int, level: 'T1'|'T4', domainId: int, masteryPct: int 0–100}`; absent = 0.

**PKSK practice sessions (owned by M05; v1.7).** M07 keeps no session or answer table of its own: a submitted domain practice is an M05 PracticeSession with `mode = 'pksk'` plus its QuizAnswer rows (DATA-M05-01/02; BR-M07-26, XR-M07-02). M07 stores only the mastery above and the exam attempts of §6.5.

### 6.7 DATA-M07-07 — User fields used (owned by M01/M02)

`id` (int, see §6 intro), `name`, `email`, `role`, `hasPkskSubscription` (M02 DATA-M02-01, boolean). M07 reads them; it writes none.

### 6.8 Seed data (fictitious people only)

**Clock:** `mock.setNow('2026-09-25T10:00:00+08:00')`.

**Users** — the canonical seed accounts owned by M01 SRS v1.5 (copy in docs/TRACKER.md "Canonical seed accounts"), with their canonical integer ids. No new account and no M07-specific user range: the 3 live default access rows are mapped to canonical accounts (fictitious users). The grant form takes these numeric ids; E2E reads them from the canonical table.

| id | E-mail | Name | Role | M07 use |
|---|---|---|---|---|
| 1 | admin@demo.test | Admin Demo | admin | admin; both levels by role; granter in the provisional edge-case fixture |
| 2 | pelajar@demo.test | Pelajar Demo | student | active Kombo (access row 1); two T1 exams; mastery |
| 3 | pelajar2@demo.test | Pelajar Dua Demo | student | no grant → no access (locked view); expired/revoked rows only in the provisional fixture |
| 4 | pelajarmaju@demo.test | Pelajar Maju Demo | student | active Kombo (access row 3) |
| 5 | guru@demo.test | Guru Demo | teacher | — (E2E-39 grants T4 to this id) |
| 6 | ibubapa@demo.test | Ibu Bapa Demo | parent | active Kombo (access row 2) |
| 7 | penaja@demo.test | Penaja Demo | sponsor | — |
| 8 | adminsekolah@demo.test | Pentadbir Sekolah Demo | school_admin | — |
| 9 | ppd@demo.test | Pegawai PPD Demo | ppd_officer | — |
| 10 | jpn@demo.test | Pegawai JPN Demo | jpn_officer | — |
| 11 | tidakaktif@demo.test | Pelajar Tidak Aktif Demo | student | — |

All `hasPkskSubscription = false`.

**Domains** — the 15 live records exactly:

| id | Bahagian | name | nameEn | code | icon | color |
|---|---|---|---|---|---|---|
| 1 | A | Kecerdasan Insaniah | Soft Skills Intelligence | PKSK_INSANIAH | fa-brain | #8b5cf6 |
| 2 | B | Matematik | Mathematics | PKSK_MATH | fa-calculator | #3b82f6 |
| 3 | B | Sains | Science | PKSK_SCI | fa-flask | #10b981 |
| 4 | B | Bahasa Inggeris | English Language | PKSK_ENG | fa-language | #ef4444 |
| 5 | B | Sejarah Malaysia | Malaysian History | PKSK_SEJ | fa-landmark | #f59e0b |
| 6 | B | Geografi | Geography | PKSK_GEO | fa-globe-asia | #06b6d4 |
| 7 | B | Kebudayaan Kaum | Cultural Heritage | PKSK_BUDAYA | fa-users | #ec4899 |
| 8 | B | Sukan & Pencapaian | Sports & Achievements | PKSK_SUKAN | fa-futbol | #84cc16 |
| 9 | B | Mercu Tanda Malaysia | Malaysian Landmarks | PKSK_MERCU | fa-monument | #f97316 |
| 10 | B | Alam Sekitar | Environment | PKSK_ALAM | fa-leaf | #22c55e |
| 11 | B | Teknologi & IT | Technology & IT | PKSK_TECH | fa-laptop-code | #6366f1 |
| 12 | B | Ekonomi Malaysia | Malaysian Economy | PKSK_EKON | fa-chart-line | #14b8a6 |
| 13 | B | Inovasi & Pencipta | Innovation & Inventors | PKSK_INOV | fa-lightbulb | #eab308 |
| 14 | B | Isu Global | Global Issues | PKSK_GLOBAL | fa-earth-asia | #0ea5e9 |
| 15 | C | Artikulasi Penulisan | Writing Articulation | PKSK_ESSAY | fa-pen-fancy | #a855f7 |

**Packages:** 1 "PKSK Tingkatan 1 (SBP/MRSM)" T1; 2 "PKSK Tingkatan 4 (SBP/MRSM)" T4; 3 "PKSK Kombo (T1 + T4)" ALL.

**Questions — 763, all `approved`** (the live counts; no tuned values). Per domain and level (live S3 values): Kecerdasan Insaniah 80 / 80; Matematik, Sains, Bahasa Inggeris 27 / 27 each; Sejarah Malaysia 27 / 24; Geografi, Kebudayaan Kaum, Sukan & Pencapaian, Mercu Tanda Malaysia, Alam Sekitar, Teknologi & IT, Ekonomi Malaysia, Inovasi & Pencipta, Isu Global 20 / 20 each; Artikulasi Penulisan 15 / 15 → T1 383, T4 380; A 160, B 573, C 30.

Ids are the live ids **177698–178460** (763, contiguous). Every question's Bahagian, domain, level and text is live where discovery or the audit captured it (anchors below); for the rest the domain and level are **seed-assigned** so that the per-domain × level totals above hold, and the texts are fictitious and seed-assigned (not presented as representative of live wording).

Anchors (live values unless marked "seed-assigned"):

| id | Domain | Level | Text | Notes |
|---|---|---|---|---|
| 178460 | Kebudayaan Kaum (B) | T4 | "Bagi calon T4, apakah tindakan terbaik apabila berlaku salah faham antara rakan berlainan budaya di sekolah?" | difficulty 3; explanation "Dialog berhemah dan rujukan kepada guru membantu menyelesaikan salah faham tanpa menjejaskan perpaduan."; options A "Mengadakan dialog secara sopan dan mendapatkan bantuan guru jika perlu." (correct), B "Menyebarkan cerita kepada kumpulan lain.", C "Menyalahkan budaya rakan tersebut.", D "Mengelak terus daripada bergaul dengannya."; newest `createdAt` |
| 178432–178440 | Ekonomi Malaysia (B) | T4 | OBSERVED, in id order: "Bagi calon T4, apakah maksud belanjawan peribadi?", "Bagi calon T4, mengapakah tabungan penting?", "Bagi calon T4, apakah perbezaan keperluan dan kehendak?", "Bagi calon T4, bagaimanakah usahawan membantu ekonomi?", "Bagi calon T4, apakah kesan inflasi kepada pengguna?", "Bagi calon T4, apakah maksud belanjawan peribadi dalam konteks T4?", "Bagi calon T4, mengapakah tabungan penting dalam konteks T4?", "Bagi calon T4, apakah perbezaan keperluan dan kehendak dalam konteks T4?", "Bagi calon T4, bagaimanakah usahawan membantu ekonomi dalam konteks T4?" | share one `createdAt` just below 178460 |
| 178441 | Inovasi & Pencipta (B) | T1 | "Bagi calon T1, apakah maksud inovasi?" | same `createdAt` as 178432 |
| 178442–178450 | Inovasi & Pencipta (B) | T4 | OBSERVED, in id order: "Bagi calon T4, apakah maksud inovasi?", "Bagi calon T4, mengapakah prototaip penting?", "Bagi calon T4, apakah ciri pencipta yang berjaya?", "Bagi calon T4, mengapakah hak cipta perlu dihormati?", "Bagi calon T4, apakah contoh inovasi sosial?", "Bagi calon T4, apakah maksud inovasi dalam konteks T4?", "Bagi calon T4, mengapakah prototaip penting dalam konteks T4?", "Bagi calon T4, apakah ciri pencipta yang berjaya dalam konteks T4?", "Bagi calon T4, mengapakah hak cipta perlu dihormati dalam konteks T4?" | same `createdAt` |
| 178359 | Kecerdasan Insaniah (A) | T1 | "Bagi calon T1, apabila rakan berlainan kaum menyambut perayaan, tindakan terbaik ialah ..." | difficulty 2; explanation "Menghormati kepelbagaian budaya ialah asas keharmonian."; options A "Memaksa rakan mengikut budaya sendiri.", B "Mengejek amalan tersebut.", C "Mengelak daripada bercakap dengannya.", D "Mengucapkan tahniah dan menghormati amalan perayaannya." (flagged correct, as live) |
| 178349 | Artikulasi Penulisan (C) | T1 | "Tulis karangan tentang cara pelajar boleh membantu rakan yang menghadapi masalah pembelajaran. (150-200 patah perkataan)" | no options; explanation "Dinilai berdasarkan kejelasan idea, susunan hujah, contoh relevan dan ketepatan bahasa." |
| 178174 | Isu Global (B) | T4 | "Apakah peranan Malaysia dalam PBB?" | page 39, first; difficulty 2, explanation "Malaysia aktif dalam PBB melalui misi pengaman, hak asasi manusia dan pembangunan lestari." (OBSERVED) |
| 177919 | Bahasa Inggeris (B) | T1 | 'What is the antonym of "generous"?' | page 39, second; shares the oldest `createdAt` with 178175; difficulty 2, explanation "The antonym (opposite) of generous is selfish." (OBSERVED) |
| 178175 | Isu Global (B) | T4 | "Bagaimanakah perubahan iklim mempengaruhi negara-negara pulau kecil?" | page 39, third; difficulty 3 (OBSERVED); explanation begins "Kenaikan paras laut mengancam kewujudan negara pulau kecil melalui banjir dan hakisan pant…" (OBSERVED prefix; the rest seed-assigned until read in full) |
| 178148 | Inovasi & Pencipta (B) | T1 | "Apakah maksud inovasi?" | "inovasi" hit |
| 178149 | Inovasi & Pencipta (B) | T1 | "Apakah perbezaan antara ciptaan (invention) dan inovasi?" | "inovasi" hit |
| 178159 | Inovasi & Pencipta (B) | T4 | "Bagaimanakah Malaysia boleh menjadi hab inovasi di Asia Tenggara?" | "inovasi" hit |
| 178161 | Inovasi & Pencipta (B) | T4 | "Analisakan peranan universiti dalam ekosistem inovasi Malaysia." | "inovasi" hit |
| 178323 | Inovasi & Pencipta (B) | T1 | "Apakah contoh inovasi sosial?" | "inovasi" hit |
| 178324 | Inovasi & Pencipta (B) | T1 | "Apakah maksud inovasi dalam konteks T1?" | "inovasi" hit |
| 178328 | Inovasi & Pencipta (B) | T1 | "Apakah contoh inovasi sosial dalam konteks T1?" | "inovasi" hit |
| 178329 | Inovasi & Pencipta (B) | T4 | "Apakah maksud inovasi dalam konteks T4?" | "inovasi" hit |
| 178333 | Inovasi & Pencipta (B) | T4 | "Apakah contoh inovasi sosial dalam konteks T4?" | "inovasi" hit |

Options, difficulty and explanation of anchors not listed in "Notes" are seed-assigned (4 options, one flagged, for A/B).

Remaining 729 rows (fixture `seedPkskQuestions()`, deterministic): ids = the rest of 177698–178460; domain and level seed-assigned so that every per-domain × level total holds (the anchors count towards them); texts fictitious (seed-assigned); difficulty seed-assigned within 1–4 (see the difficulty split below); 4 options (one flagged) for A/B, none for C. **Exactly 13 texts contain "inovasi"** — the 13 live records (178441, 178442, 178446, 178447, 178148, 178149, 178159, 178161, 178323, 178324, 178328, 178329, 178333); no seed-assigned text contains it. Filtered totals equal live: `bahagian=A` 160, `bahagian=C` 30, `level=T1&bahagian=B` 288.

**Difficulty split = M04 named query Q-PKSK-DIFFICULTY(d) (v1.7; XL3-22, M17 XR-M17-10, M04 SRS v1.11 §6.13; requested of M04 as XR-M07-01).** PKSK rows are M04 rows (D12), so M04 owns the facet and the count; M07 cites it and never counts it itself. Q-PKSK-DIFFICULTY(d) = Q-PKSK by `difficultyLevel`:

| Difficulty | 1 | 2 | 3 | 4 | 5 | Σ |
|---|---|---|---|---|---|---|
| PKSK rows | 253 | 253 | 191 | 66 | 0 | **763** = Q-PKSK |

Checks (script `pksk-diff.js`, v1.7): 253 + 253 + 191 + 66 + 0 = 763 = Q-PKSK ✔; T1 383 + T4 380 = 763 ✔. Constraints it satisfies: (i) none at 5 — the M05 S1 chart counts Q-DIFFICULTY = Q-ACTIVE + Q-PKSK and live shows 0 at difficulty 5; (ii) difficulty 4 ≤ 66 — M17 S10 shows the covered rows at difficulty 4 as 9,534 against Q-DIFFICULTY(4) 9,600, so the PKSK and excluded rows together hold 66 (M17 R-12, C-10); M04 v1.11 puts 0 excluded rows at difficulty 4, so PKSK takes all 66; (iii) Q-DIFFICULTY − Q-M17-COV-DIFF − PKSK = the M04 excluded rows 726 − 253 = 473, 984 − 253 = 731, 733 − 191 = 542, 66 − 66 = 0 (Σ 1,746 = M04 `coverageExcluded`) ✔; (iv) the observed anchor values count towards it and fit: difficulty 2 × 3 (178359, 178174, 177919) ≤ 253, difficulty 3 × 2 (178460, 178175) ≤ 191 ✔. Q-DIFFICULTY stays 39,694 / 47,138 / 33,720 / 9,600 / 0. Provenance: only the difficulty-4 bound and difficulty 5 = 0 follow from observed figures; the 253 / 253 / 191 split of the rest is a design value chosen in XL3-22 (no screen shows PKSK rows by difficulty, and no AC or E2E asserts it). Every non-anchor difficulty is seed-assigned to complete it. The form still offers 1–5 (as live); only the seed is limited.

`createdAt`: page 1 and page 39 reproduce the observed order (178460; then 178432…178450 sharing one timestamp; last 178174, then 177919 and 178175 sharing the oldest). Between them the order is INFERRED: pairs of ids sharing a timestamp (the audit read 177920, 178176, 177921, 178177, …), ties by id ascending (BR-M07-06).

**Access rows — default seed = the 3 live rows** (fictitious users; live ids 1–3, live dates, all "PKSK Kombo (T1 + T4)", "Diberi Oleh" "-", "Tiada had", "Aktif"):

| id | User | Package | grantedBy | grantedAt | expiresAt | status |
|---|---|---|---|---|---|---|
| 1 | Pelajar Demo (2) | 3 Kombo | null ("-") | 2026-02-28 | null | active |
| 2 | Ibu Bapa Demo (6) | 3 Kombo | null | 2026-02-28 | null | active |
| 3 | Pelajar Maju Demo (4) | 3 Kombo | null | 2026-04-22 | null | active |

Stats 3 / 3 / 3 (live). List order (BR-M07-17): 3, 2, 1 (equal dates → id descending). `pelajar2@demo.test` has no row (no access → the locked case).

**Provisional scenario fixture `seedPkskAccessEdgeCases()`** (used only by E2E-M07-39, never in the default seed; labels and whether live lists such rows are UNVERIFIED, L-7): id 4 Pelajar Dua Demo, package 1 T1, grantedBy Admin Demo, 2026-01-05, expires 2026-06-30 → expired; id 5 Pelajar Dua Demo, package 2 T4, grantedBy Admin Demo, 2026-03-10, no expiry, revoked 2026-05-02.

**Exam attempts:** `pelajar@demo.test` T1 — 2026-09-10T20:00 `scorePct` 46.0 (B 52.4) grade D; 2026-09-20T20:00 64.0 (B 67.0) grade C → dashboard "55%" C, "2", "59.7%". No other attempt.

**Mastery:** `pelajar@demo.test` T1 — Kecerdasan Insaniah 60, Matematik 70, Sains 55, Bahasa Inggeris 80, Sejarah Malaysia 40, Geografi 65, Artikulasi Penulisan 50; all else 0.

### 6.9 Fixture functions

`mock.reset()`, `mock.setNow(iso)` (shared); `seedPkskQuestions()` (above); `seedPkskAccessEdgeCases()` (provisional scenarios only); `mock.lastRequest(path)` (shared test hook, used to assert request bodies, e.g. no `options` for Bahagian C).

## 7. Mock API endpoints

Envelope and errors per SRS.md §7.2/§7.3. Auth: U = logged-in user, A = admin. "Mut." = mutating.

| # | Method | Path | Auth | Mut. | Request | Response (200 unless stated) | Errors | Live equivalent |
|---|---|---|---|---|---|---|---|---|
| 1 | GET | `/api/pksk/me/access` | U | no | — | `{data: {T1: bool, T4: bool}}` | 401 | server-rendered `/pksk` |
| 2 | GET | `/api/pksk-domains` | U | no | — | `{data: PkskDomain[]}` (15, by `order`) | 401 | create page `allDomains` |
| 3 | GET | `/api/pksk/levels/:level/dashboard` | U | no | — | `{data: {level, readiness: {scorePct: int, grade}, examCount: int, bahagianBAvgPct: number, domains: [{id, code, name, icon, color, masteryPct}]}}` (B only) | 401; 403 no access; 404 level | `GET /pksk/level/{L}` |
| 4 | GET | `/api/pksk/levels/:level/domains` | U | no | — | `{data: [{bahagian, name, subtitle, domains: [{id, code, name, icon, color, questionCount, masteryPct}]}]}` | 401; 403; 404 | `GET /pksk/level/{L}/domains` |
| 5 | GET | `/api/pksk/levels/:level/domains/:code` | U | no | — | `{data: {domain: {id, code, name, bahagian}, questions: [{id, questionText, options: [{text}]}]}}` (BR-M07-25; no `isCorrect`) — provisional | 401; 403; 404 level/code | `GET /pksk/level/{L}/domain/{CODE}` (not opened, L-2) |
| 6 | GET | `/api/pksk/levels/:level/exam-attempts` | U | no | — | `{data: [{id, completedAt, scorePct, grade}]}` (own, newest first) | 401; 403; 404 | `GET …/history` (live 500; DV-01) |
| 7 | GET | `/api/admin/pksk-questions` | A | no | `?bahagian&level&status&search&page` | `{data: PkskQuestionListItem[], meta: {page, pageSize: 20, totalItems, totalPages}}` | 401; 403 | `GET /admin/pksk/questions` |
| 8 | GET | `/api/admin/pksk-questions/stats` | A | no | — | `{data: {total, approved, pending, t1, t4}}` | 401; 403 | stat cards |
| 9 | GET | `/api/admin/pksk-questions/:id` | A | no | — | `{data: PkskQuestionDetail}` | 401; 403; 404 (unknown or non-PKSK id) | `GET …/{id}/edit` |
| 10 | POST | `/api/admin/pksk-questions` | A | yes | `{bahagian, pkskDomainId, pkskTargetLevel, questionText, difficultyLevel, explanation?, options?: [{text, isCorrect}]}` (no `options` for C) | 201 `{data: PkskQuestionDetail}` | 422 `fields` (§5); 401; 403 | `POST /admin/pksk/questions` |
| 11 | PUT | `/api/admin/pksk-questions/:id` | A | yes | `{pkskDomainId, pkskTargetLevel, status, questionText, difficultyLevel?, explanation?, options?}` | `{data: PkskQuestionDetail}` | 422; 404; 401; 403 | `PUT /admin/pksk/questions/{id}` |
| 12 | DELETE | `/api/admin/pksk-questions/:id` | A | yes | — | 204 | 404; 401; 403 | `DELETE /admin/pksk/questions/{id}` |
| 13 | POST | `/api/admin/pksk-questions/bulk` | A | yes | `{action: 'approve'\|'reject'\|'delete', ids: int[]}` | `{data: {affected: int}}` | 422 (empty ids, bad action, non-PKSK id); 401; 403 | `POST /admin/pksk/questions/bulk` |
| 14 | GET | `/api/admin/pksk-access` | A | no | `?search&page` | `{data: PkskAccessItem[], meta}` (BR-M07-17) | 401; 403 | `GET /admin/pksk/access` |
| 15 | GET | `/api/admin/pksk-access/stats` | A | no | — | `{data: {activeTotal, t1, t4}}` | 401; 403 | stat cards |
| 16 | POST | `/api/admin/pksk-access` | A | yes | `{userId: int, packageId: int, expiresAt: 'YYYY-MM-DD' \| null}` | 201 `{data: PkskAccessItem}` | 422 `fields.userId` "Pengguna tidak dijumpai." (UNVERIFIED COPY); 401; 403 | `POST /admin/pksk/access/grant` |
| 17 | POST | `/api/admin/pksk-access/:id/revoke` | A | yes | — | `{data: PkskAccessItem}` | 404; 409 not active; 401; 403 | `POST /admin/pksk/access/revoke` (`access_id`) |
| 18 | GET | `/api/pksk-packages` | A | no | — | `{data: PkskPackage[]}` (3) | 401; 403 | grant select — **M19-owned** (fixture here until M19) |
| 19 | GET | `/api/questions/:id` | A | no | — | M04 shape incl. the PKSK fields | 404 | **M04-owned** (M04 SRS §7) |
| 20 | PUT | `/api/admin/users/:id` | A | yes | `{…, hasPkskSubscription}` | M02 shape | M02 | **M02-owned** (M02 SRS §7 #5) |
| 21 | POST | `/api/pksk/levels/:level/domains/:code/practice-sessions` | U | yes | `{answers: [{questionId, optionIndex?, text?}]}` | 201 `{data: {masteryPct, sessionId, gamification: {coinsEarned, pointsEarned, streakCount, totalBalance}}}` (BR-M07-12, BR-M07-26: one M05 session `mode = 'pksk'`) — provisional | 401; 403; 404; 422 | not observed (L-2) |
| 22 | GET | `/api/pksk/levels/:level/exam` | U | no | — | `{data: {sections: [{bahagian, weightPct, questions: [{id, questionText, options: [{text}]}]}]}}` (30 / 70 / 1; no `isCorrect`) — provisional | 401; 403; 404 | not observed (L-3) |
| 23 | POST | `/api/pksk/levels/:level/exam-attempts` | U | yes | `{answers: [{questionId, optionIndex?, text?}]}` | 201 `{data: {id, completedAt, scorePct, grade}}` (BR-M07-09/10) — provisional | 401; 403; 404; 422 | not observed (L-3) |

## 8. States & messages

### 8.1 Per screen (exact live copy unless marked)

| Screen | State | Copy / behaviour |
|---|---|---|
| All | Loading | Live pages are server-rendered (no loading state observed). The prototype shows the shell's global page loader while a mock call is pending (FR-G-10; SQ-M07-01). |
| S1 | Access | "AKTIF" (`fa-unlock`) per accessible level; locked: no badge (L-1). |
| S2 | Zero | "0%", "E", "Teruskan usaha anda!", "0", "0.0%". |
| S3 | Counts | "Soalan" {n}, "Penguasaan" {n}%. |
| S4 | Empty | "Tiada sejarah peperiksaan." (PROPOSED COPY) |
| S4a/S4b | Provisional (L-2/L-3) | heading (domain name / "Peperiksaan Penuh"), items with answer inputs, "Hantar" (PROPOSED COPY); nothing else asserted. |
| S5 | Empty | `fa-inbox` "Tiada soalan PKSK lagi" + "Tambah soalan pertama". |
| S5 | Bulk bar | "{n} dipilih"; confirm "Padam soalan terpilih?". |
| S5 | Row delete | confirm "Padam soalan ini?". |
| S6/S7 | Validation | native `required` bubble (browser text). |
| S8 | Empty | `fa-lock` "Tiada rekod akses". |
| S8 | Revoke | confirm "Tarik balik akses?". |
| 404 | Unknown level / code / id | "404", "🔍", "Halaman Tidak Dijumpai", "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?", "Halaman Utama", "Mula Latihan", "PRESTASIPLUS". |

### 8.2 UNVERIFIED COPY and placeholder styles (L-5…L-8; replace when observed)

Flashes use the admin shell's flash component (global; success green, error red, one-time).

| Where | Text / style (UNVERIFIED COPY unless marked) |
|---|---|
| Create success | "Soalan PKSK berjaya ditambah." |
| Update success | "Soalan PKSK berjaya dikemaskini." |
| Row delete success | "Soalan PKSK berjaya dipadam." |
| Bulk approve / reject / delete | "{n} soalan telah diluluskan." / "{n} soalan telah ditolak." / "{n} soalan telah dipadam." |
| Grant success | "Akses PKSK berjaya diberi." |
| Revoke success | "Akses PKSK telah ditarik balik." |
| Grant: unknown user | "Pengguna tidak dijumpai." (under "ID Pengguna") |
| Question form server errors | §5 messages |
| Status pill "Menunggu" (S5) | amber-100 / amber-700 (placeholder colour, L-6) |
| Status pill "Ditolak" (S5) | red-100 / red-700 (placeholder colour, L-6) |
| Access status expired | "Tamat Tempoh", slate-100 / slate-600 pill (placeholder) |
| Access status revoked | "Ditarik", red-100 / red-700 pill (placeholder) |

PROPOSED COPY (owner acceptance at G1): DV-M07-01 "Sejarah PKSK - {L}", "Skor", "Gred", "Tiada sejarah peperiksaan."; provisional practice/exam pages "Hantar".

### 8.3 Live-session states

As URS §5.1: L-1 INFERRED only (FR-M07-05, 19); L-2, L-3 provisional pages (FR-M07-16, 17; §7 #5, #21–23) with BR-M07-09…13, 25 INFERRED; L-4 = DV-01 (FR-M07-14, 15); L-5 FR-M07-39, 44; L-6 §8.2 pill placeholders; L-7 FR-M07-51…53; L-8 FR-M07-30.

## 9. Permissions matrix

| Role | S1 hub | S2–S4, S4a, S4b (level L) | S5 list | S6/S7 create/edit | Bulk / delete | S8 view | Grant / revoke | Notes |
|---|---|---|---|---|---|---|---|---|
| Guest | → `/login` | → `/login` | → `/login` | → `/login` | — | → `/login` | — | OBSERVED (302 → `/login`) for `/pksk`, `/pksk/level/T1`, `/pksk/level/T1/domains`, `/pksk/level/T4/history`, `/admin/pksk/questions`, `/admin/pksk/questions/create`, `/admin/pksk/access`; exam and domain-practice routes INFERRED |
| Pelajar with access to L (grant, M02 flag) | view (L "AKTIF") | view | → landing, API 403 | → landing | — | → landing | — | INFERRED |
| Pelajar without access | view (no badge) | → `/pksk` (API 403) | → landing | → landing | — | → landing | — | INFERRED (L-1) |
| Other logged-in roles (Guru, Ibu Bapa, …) | as Pelajar | as Pelajar (grant-based) | → landing | → landing | — | → landing | — | INFERRED |
| Admin | view (both "AKTIF") | view (both levels) | view | yes | yes | view | yes | OBSERVED (screens) / INFERRED (role bypass, OQ-M07-03) |

## 10. Responsive behaviour

Shells: user portal — sidebar ≥1024px, header + drawer + bottom nav below (global); admin — sidebar ≥1024px, drawer + bottom tab bar + "Lagi" sheet below (NFR-RESP-04, global). No horizontal page scroll at 320–1920px (live has none in any captured state). Breakpoints are the live Tailwind classes; no deviation changes a layout (DV-M07-07 rejected). Text inside `main` is never below 12px (DV-M07-13).

| Screen | Below `md` (375) | `md` (768) | `lg`+ (1024/1280) | Deviation |
|---|---|---|---|---|
| S1 | format tiles 1 col; level cards 1 col; hero h1 text-4xl | tiles 3 cols; level cards 2 cols | same as `md` | DV-04 (colour only) |
| S2 | hero stacks (score, then the two stat boxes full width); shortcuts 1 col; domain cards 1 col | shortcuts 3 cols; domain cards 2 cols | domain cards 3 cols | DV-03 (icons) |
| S3 | cards 1 col | 2 cols | 3 cols | DV-03 |
| S4 | single column; table fits (3 short columns) | same | same | DV-01 |
| S4a, S4b | provisional single column (UNVERIFIED) | same | same | — (L-2/L-3) |
| S5 | stats 2 cols (5th alone); filters wrap (Bahagian + Level / Status + search / Cari), "Tambah Soalan" below; table (855px) scrolls inside its card, page does not; pager "« Previous" / "Next »" below 640px | stats 2 cols; three selects + search on one row, "Cari" wraps below, "Tambah Soalan" below; table scrolls inside its card; numbered pager from 640px | stats 5 cols; table fits | — (DV-07 rejected) |
| S6 | all grids 1 col; footer one row | card 1: 3 cols; difficulty half width (2-col grid) | same | DV-05, DV-08 (behaviour) |
| S7 | domain/sasaran/status 1 col; "Kesukaran" grid 2 cols; footer one row | 3 cols | same | DV-02 |
| S8 | stats 3 cols (narrow); header "Beri Akses" + button one row; grant form 1 col; table scrolls inside its card, page does not | grant form 4 cols; table fits | same | — (DV-07 rejected) |

Touch targets: icon-only actions keep their live visual size; NFR-RESP-03 (44px) applies through the hit area (padding), as M04.

## 11. Non-functional requirements

| ID | Category | Requirement | Traces |
|---|---|---|---|
| NFR-M07-01 | Performance | The 763-question fixture is paginated (20 rows); stats and S3 counts are computed from the store on request (single source, no stored totals). | NFR-01 |
| NFR-M07-02 | Accessibility | Replicates live (D10): native `required` bubbles, native `confirm()`, labels as live (the S7 question textarea has none), no added ARIA. Only DV-M07-04 (unreadable h1) changes a11y-relevant behaviour. | NFR-02 |
| NFR-M07-03 | Privacy | All users and grants are fictitious (§6.8); no live name, e-mail or grant date of a real user is used (the live access dates 28/02/2026 and 22/04/2026 are kept as dates only). | NFR-05 |
| NFR-M07-04 | Maintainability | Mock modules: `pkskDomains`, `pkskQuestions` (a view over the M04 question store), `pkskAccess`, `pkskProgress` (attempts, mastery); one file per resource. Practice sessions are written only through the M05 practice repository (mode `pksk`, BR-M07-26) and syiling only through M14 (via M05 BR-31); question counts only through M04 `questions.count` (Q-PKSK, Q-PKSK-DIFFICULTY). | NFR-07 |
| NFR-M07-05 | Localisation | dd/mm/yyyy dates and "today" in Asia/Kuala_Lumpur (BR-M07-16, 22). | NFR-08 |
| NFR-M07-06 | Security — for the backend phase (**security-engineer review required**) | The live behaviour replicated here carries these risks:<br>**SEC-M07-01** access is granted by a raw numeric user id with no picker and no confirmation of whose account it is: a typo grants a paid package to the wrong person; the server must validate the id, and the UI of the backend phase should show the resolved name before saving;<br>**SEC-M07-02** bulk "Padam" deletes up to 20 questions permanently after one browser confirm, and bulk "Luluskan"/"Tolak" change status with no confirm; no soft delete or audit log;<br>**SEC-M07-03** revoke has only a browser confirm and live records no granter ("Diberi Oleh" "-" on every live row): grants and revocations need an audit trail (who, when, which package);<br>**SEC-M07-04** the level gate must be enforced server-side on every level page and on every practice/exam endpoint (a T1-only user must not reach T4 by URL), and question/answer data must never be served for a level without access;<br>**SEC-M07-05** two independent entitlement sources (M02 `has_pksk_subscription` and M07 grants) can disagree; define one source of truth and show both on the access screen (OQ-M07-01);<br>**SEC-M07-06** the admin role bypass must be limited to the intended admin roles;<br>**SEC-M07-07** `isCorrect` flags (including the hidden flag on Bahagian A questions) must not be sent to students before an answer is submitted (exam integrity; the provisional endpoints §7 #5 and #22 omit them and score on the server side of the mock);<br>**SEC-M07-08** all state-changing POSTs (grant, revoke, bulk, create, update, delete) need CSRF protection and rate limiting;<br>**SEC-M07-09** question texts and explanations are admin-authored and shown to students: render as text, never as HTML (XSS); the raw Blade subtitle (DV-M07-02) shows templates can leak into output;<br>**SEC-M07-10** `expires_at` has no bounds (past or far-future dates) and grants have no duplicate check: validate server-side;<br>**SEC-M07-11** the access list and its search expose names and e-mails of paying users to every admin (PDPA): restrict to authorised admins and log access;<br>**SEC-M07-12** PKSK and M04 questions share one store and id sequence: `/admin/pksk/questions/{id}` update/delete and the bulk `ids[]` must accept only PKSK question ids, or a tampered id would change or delete an M04 question. | NFR-04 |

## 12. E2E test scenarios

Every scenario runs on the **mobile (375×812), tablet (768×1024) and desktop (1280×800)** Playwright projects, starts from `mock.reset()` and `mock.setNow('2026-09-25T10:00:00+08:00')`, logs in as `admin@demo.test` unless stated, and uses the §6.8 seed. Assertions are viewport-aware where the live layout differs by width (sidebar vs drawer, pager). User ids are read from the fixture by e-mail. Scenarios marked **provisional** assert UNVERIFIED or INFERRED behaviour and are re-baselined after the live session (OQ-M07-02). Provisional (18): E2E-02, 04, 05, 08, 09, 10, 11, 21, 22, 23, 29, 33, 37, 38, 39, 42, 43, 45 (steps as marked).

| ID | Scenario | FR | AC |
|---|---|---|---|
| E2E-M07-01 | Hub as admin: header "PKSK" / subtitle, tab title; hero icon, h1 text and computed colour rgb(255, 255, 255); three format tiles with exact copy and circle colours; two level cards with texts and "Mula Latihan" hrefs; the `<main>` text contains no price (`RM` followed by a number), no "harga" and no `/pricing` link; both "AKTIF" badges and green border. | 01, 02, 03, 04, 05 | 01.1, 01.2, 01.3, 01.4, 02.1 |
| E2E-M07-02 | Hub per user (**provisional** for the locked state): `pelajar@demo.test` → both "AKTIF" and both dashboards open; `pelajar2@demo.test` (no grant) → no badge, no green border, "Mula Latihan" still present. | 05, 54 | 02.2, 02.3, 20.1 |
| E2E-M07-03 | Admin T1 and T4 dashboards: headers, "Kembali ke PKSK" → `/pksk`, zero state "0%" "E" "Teruskan usaha anda!" "0" "0.0%", three shortcut texts/icons/hrefs per level. | 06, 07, 08 | 03.1, 03.2, 03.4 |
| E2E-M07-04 | `pelajar@demo.test` (**provisional** values): T1 "55%", "C", "2", "59.7%"; T4 zero state. | 07 | 03.3 |
| E2E-M07-05 | "Penguasaan Domain" (**provisional** for the `pelajar@demo.test` mastery values, INFERRED): exactly 13 cards in order with codes, no Kecerdasan Insaniah / Artikulasi Penulisan; each icon tile contains a rendered icon (non-empty SVG/glyph) coloured with the domain colour; "Latih Sekarang" hrefs for T1 and T4; as `pelajar@demo.test` T1 the mastery values and bar widths. | 09, 10 | 04.1, 04.2, 04.3, 04.4 |
| E2E-M07-06 | Domains T1 and T4: header, back link, three section badges/titles/subs, 1/13/1 cards, hrefs, counts (T1 sum 383, T4 sum 380, Sejarah Malaysia 27/24), icons rendered, admin mastery 0%, `pelajar@demo.test` T1 values. | 11, 12, 13 | 05.1, 05.2, 05.3, 05.4 |
| E2E-M07-07 | History: from the T1 dashboard "Sejarah" opens `/pksk/level/T1/history` with no "Ralat Pelayan"; as `pelajar@demo.test` rows "20/09/2026 64% C", "10/09/2026 46% D" and no button/link/select/pager in the table; T4 and admin → "Tiada sejarah peperiksaan.". | 14, 15 | 06.1, 06.2, 06.3 |
| E2E-M07-08 | **Provisional (pending L-2/L-3).** "Latih Sekarang" Matematik (S2) and the Matematik card (S3) → `/pksk/level/T1/domain/PKSK_MATH`, heading "Matematik", each item has an answer input, "Hantar" → `/pksk/level/T1/domains`; "Peperiksaan Penuh" → `/pksk/level/T1/exam`, heading "Peperiksaan Penuh", 30 + 70 + 1 items with answer inputs, "Hantar" → `/pksk/level/T1` with "Jumlah Peperiksaan" +1 and a new S4 row. No assertion on layout, question count per practice session, timer, feedback or result display. | 16, 17 | 07.1, 07.2 |
| E2E-M07-09 | 404s (**provisional** for the `PKSK_XYZ` step, INFERRED): `/pksk/level/T9`, `/pksk/level/ALL`, `/pksk/level/T9/domains`, `/pksk/level/T1/domain/PKSK_XYZ`, `/admin/pksk/questions/99999999/edit` → standalone 404 texts, "Halaman Utama" → `/`, "Mula Latihan" → `/practice`, tab title. | 18 | 08.3, 07.3, 16.7 |
| E2E-M07-10 | Gate (**provisional**): as `pelajar2@demo.test`, each of the five T1 routes redirects to `/pksk`; no message is shown; `/api/pksk/levels/T1/dashboard` answers 403. | 19 | 08.1 |
| E2E-M07-11 | Grant opens one level (**provisional**): admin grants "PKSK Tingkatan 1 (SBP/MRSM) (T1)" to `pelajar2@demo.test`'s id (no date) → flash, new first row "Pelajar Dua Demo" "PKSK Tingkatan 1 (SBP/MRSM)" "Admin Demo" "25/09/2026" "Tiada had" "Aktif" "Tarik", cards 4 / 4 / 3; log in as `pelajar2@demo.test` → only T1 "AKTIF", `/pksk/level/T1` opens, `/pksk/level/T4` → `/pksk`. | 19, 51, 54 | 08.2, 18.4 |
| E2E-M07-12 | S5 header/subtitle/tab; "Premium" group open with "PKSK Soalan" (≥1024) / via drawer (<1024); "Tambah Soalan" href and colour; stat values and colours 763/763/0/383/380. | 20, 21, 57 | 09.1, 09.2 |
| E2E-M07-13 | S5 table: column headers; 20 rows; first row cells (80-char text + "...", one line, "B" pill classes, `fa-users`-mapped icon in #ec4899 + "Kebudayaan Kaum", "T4" chip, "Diluluskan" pill, edit and delete icons). | 22 | 09.3 |
| E2E-M07-14 | Order: page 1 ids = [178460, 178432 … 178450]; `?page=39` ids = [178174, 177919, 178175]. | 23, 24 | 09.4 |
| E2E-M07-15 | Pager: ≥640px "Showing 1 to 20 of 763 results", links 1–10, "...", 38, 39, chevron aria labels; <640px "« Previous" as plain text and "Next »" → `?page=2`. | 24 | 09.5 |
| E2E-M07-16 | Filters: exact options of the three selects and the search placeholder; selecting "A - Insaniah" navigates to `?bahagian=A` without clicking "Cari"; select keeps "A - Insaniah"; stats unchanged; "Showing 1 to 20 of 160 results"; page-2 link `?bahagian=A&page=2` keeps the filter on the next page. | 25, 21, 24 | 10.1, 10.2 |
| E2E-M07-17 | Filter totals: `bahagian=C` → 30 (2 pages); `level=T1&bahagian=B` → 288; search "inovasi" + "Cari" → 13 rows, each containing "inovasi". | 26 | 10.3 |
| E2E-M07-18 | Empty row: `?status=pending`, `?status=rejected`, `?search=zzzzqqq` → header row kept, `fa-inbox` "Tiada soalan PKSK lagi", "Tambah soalan pertama" → create, no pager. | 27 | 10.4 |
| E2E-M07-19 | Selection: bar hidden; tick 1 → "1 dipilih" + three buttons with colours; untick → hidden; header → "20 dipilih"; untick one row → "19 dipilih", header still checked; untick header → hidden. | 28 | 11.1, 11.2 |
| E2E-M07-20 | Bulk dialogs: "Luluskan" and "Tolak" send the request with no dialog (dialog listener sees none); "Padam" shows "Padam soalan terpilih?", dismiss → no request. | 29 | 11.3 |
| E2E-M07-21 | Bulk reject (**provisional**): tick 2 → "Tolak" → same URL, flash, both rows "Ditolak", "Diluluskan" 761; `?status=rejected` → exactly those 2. | 30 | 11.4 |
| E2E-M07-22 | Bulk delete (**provisional**): tick 2 (both T4) → "Padam" → accept → rows gone, "Jumlah" 761, "Diluluskan" 761, "Ting. 4" 378. | 30 | 11.5 |
| E2E-M07-23 | Row actions: `fa-edit` of #178460 → `/admin/pksk/questions/178460/edit`; `fa-trash` → "Padam soalan ini?" dismiss → row kept; accept (**provisional**) → row gone, flash, "Jumlah" 762, "Ting. 4" 379. | 31, 32 | 12.1, 12.2 |
| E2E-M07-24 | Create page: header/subtitle/tab; "Bahagian" options; "Domain" 15 names with no Bahagian, 1 / 13 / 1 after A / B / C; "Sasaran" two options, T1 selected, no empty option. | 33, 61 | 13.1, 13.2, 13.3 |
| E2E-M07-25 | Domain reset (DV-08): B + "Sains", text, difficulty 4, explanation, T4, option texts, one "Betul" → switch to A → domain displays "-- Pilih domain --" and its value is ''; every other field unchanged. | 34 | 13.4 |
| E2E-M07-26 | Options by Bahagian: "Soalan" card labels, placeholders, difficulty default "3 - Sederhana"; none → 4 rows, no "Betul", no suffix; A → suffix, no "Betul"; B → "Betul" per row, two ticks allowed; C → card hidden. | 35, 36 | 14.1, 14.2, 14.4 |
| E2E-M07-27 | Limits: add twice → E, F, add button hidden; remove down to 2 → remove buttons hidden, letters A, B. | 37 | 14.3 |
| E2E-M07-28 | Validation: empty submit → `checkValidity()` false, `validity.valueMissing` on `bahagian`, no request; C + "Artikulasi Penulisan" + text → request sent, body has no `options` (`mock.lastRequest`), question stored with 0 options. | 38 | 15.1, 15.2 |
| E2E-M07-29 | Save B for T1 (**provisional**): list with flash, new question first with "Diluluskan" and edit link `/admin/pksk/questions/9000001/edit` (BR-M07-24), cards "764" / "764" / "0" / "384" / "380". | 39 | 15.3 |
| E2E-M07-30 | "Kembali" from create (after typing) and from edit (after changing the text) → list, no dialog, data unchanged (edit page shows the original text again). | 40 | 15.4, 16.6 |
| E2E-M07-31 | Edit: #178460 header "Kemaskini soalan #178460" (no "<?php"), tab; domain options "[A] …" / "[B] …" / "[C] …" with "[B] Kebudayaan Kaum" selected, "Tingkatan 4", "Diluluskan", text, "3", explanation, 4 options with A ticked; #178359 → no visible "Betul"; #178349 → no "Pilihan Jawapan" card. | 41, 42, 43 | 16.1, 16.2, 16.3 |
| E2E-M07-32 | Edit options: add → E; add to 6 → add hidden; remove to 2 → remove hidden; change domain to "[A] Kecerdasan Insaniah" → "Betul" still visible. | 43 | 16.4 |
| E2E-M07-33 | Edit save (**provisional**): #178460 status "Menunggu" → "Kemaskini" → list flash, row "Menunggu", cards "762" "Diluluskan", "1" "Menunggu". | 44 | 16.5 |
| E2E-M07-34 | Access list (default seed): header/subtitle/tab; cards 3/3/3 with colours; columns; exactly 3 rows in the order ids 3, 2, 1 on two consecutive loads; cells of each row (name, e-mail, "PKSK Kombo (T1 + T4)", "-", "22/04/2026" / "28/02/2026" / "28/02/2026", "Tiada had", "Aktif", "Tarik"). | 45, 46, 47 | 17.1, 17.2 |
| E2E-M07-35 | Access search: "maju" → 1 row (Pelajar Maju Demo), cards unchanged; "zzzzqqq" and `?page=2` → header kept + `fa-lock` "Tiada rekod akses". | 48 | 17.3 |
| E2E-M07-36 | Grant form: hidden on load; toggle shows/hides; typed "123" kept after close/reopen; labels, placeholder "User ID", `type=number`/`date`, package options and default, no empty option, no "Batal"; empty submit → native bubble, no request. | 49, 50, 61 | 18.1, 18.2, 18.3 |
| E2E-M07-37 | Grant unknown user (**provisional**): id 999999 → error under "ID Pengguna", no new row, cards 3/3/3. | 51 | 18.5 |
| E2E-M07-38 | Revoke: "Tarik" on Pelajar Demo → "Tarik balik akses?" dismiss → unchanged; accept (**provisional**) → flash, row kept with revoked label and no "Tarik", cards 2/2/2; `pelajar@demo.test` then sees no "AKTIF" and is redirected from `/pksk/level/T1`. | 52, 54 | 19.1, 19.2 |
| E2E-M07-39 | Rules (**provisional**): with `seedPkskAccessEdgeCases()` the expired row (Tamat "30/06/2026") and the revoked row show their labels, have no "Tarik" and are not counted (cards stay 3/3/3); grant T1 to `pelajar2@demo.test` with "Tamat Tempoh" 24/09/2026 → expired row, not counted, still no access; grant T4 to `guru@demo.test` → cards 4 / 3 / 4; set `pelajar2@demo.test` "Pakej PKSK" on (M02 edit form) → both levels "AKTIF" and open, access cards unchanged. | 53, 54, 55 | 19.3, 20.2, 20.3, 20.5 |
| E2E-M07-40 | Admin without a grant opens `/pksk/level/T1` and `/pksk/level/T4`. | 54 | 20.4 |
| E2E-M07-41 | Navigation: user shell — "PKSK" + "PRO" in "Pembelajaran" (sidebar ≥1024, drawer <1024) → `/pksk`; admin shell — "PREMIUM" group open with "PKSK Soalan" / "PKSK Akses" (≥1024), "Lagi" sheet "Premium" with both links (<1024). | 56, 57 | 21.1, 21.2, 21.3 |
| E2E-M07-42 | Access control (**provisional** for the role redirect and 403, INFERRED): guest → the six routes of AC-22.1 → `/login`; `pelajar@demo.test` → `/admin/pksk/questions` and `/admin/pksk/access` → `/dashboard`; `/api/admin/pksk-questions` and `/api/admin/pksk-access` → 403. | 58, 59 | 22.1, 22.2 |
| E2E-M07-43 | M04 relation: `/admin/questions?search=Bagi calon T4, apakah tindakan terbaik` → "Tiada soalan dijumpai"; `/admin/questions/178460` shows the text and 4 options; reject one T1 Matematik question (bulk) → `/pksk/level/T1/domains` Matematik "Soalan" "26" and admin "Ting. 1" still 383 (**provisional**). | 60, 13 | 23.1, 23.2, 23.3 |
| E2E-M07-44 | Responsive: for S1–S8, S4a, S4b `document.documentElement.scrollWidth ≤ innerWidth`; S5 (375, 768) and S8 (375): the table card has `scrollWidth > clientWidth` (in-card scroll), the page does not scroll, no cell is `position: sticky`, and scrolling the card to the end brings "Tindakan" into view; S5 at 768: "Cari" sits on a second row below the selects; grids per §10 (S2 domain columns 1/2/3, S5 stats 2/2/5, S8 stats 3, grant form 1/4); S6/S7 footer buttons share one row at 375 and S7 "Kesukaran" is 2 columns; every visible text node in `main` has a computed font size ≥12px (DV-M07-13). | 62, 63, 64 | 24.1, 24.2, 24.3, 24.4, 24.5 |
| E2E-M07-45 | **Provisional (pending L-2; v1.7).** As `pelajar@demo.test`: open `/pksk/level/T1/domain/PKSK_MATH`, choose the flagged option of every served item (read from the fixture), "Hantar" → `/pksk/level/T1/domains`. Then (M05/M14 mock state): exactly one new completed PracticeSession with `mode` "pksk", `subjectId` null, `pkskDomainId` 2, `pkskTargetLevel` "T1", `questionCount` = `correctCount` = items served, and that many new QuizAnswer rows all `isCorrect`; the M05 revision queue and SubjectMastery counters of the user are unchanged; M14 `onSessionCompleted` was called once with `mode` "pksk" and no `coinsPerCorrect`; the wallet balance changed by exactly the returned `coinsEarned`, and when it is > 0 one ledger row with source `quiz_pksk` exists; the S3 Matematik mastery reads "100%". No assertion on the coin amount (M14 BR-M14-03) or on any page display of these values. | 65 | 07.4 |

### 12.1 Traceability (US → FR → E2E)

Checked by script (`trace.js` in the author's scratchpad, Node) over this SRS and the URS: every FN in URS §3 is cited by ≥1 FR; every AC is cited by ≥1 FR and ≥1 E2E; every FR by ≥1 E2E; no reference points to a missing id. **Result (v1.7, 2026-09-27; script `m07-writer/trace.js`): 79 FN, each cited by ≥1 FR; 93 AC, each cited by ≥1 FR and ≥1 E2E; 65 FR, each cited by ≥1 E2E; 45 E2E; 24 stories; 0 dangling references.**

| US | FR | E2E |
|---|---|---|
| US-M07-01 | 01, 02, 03, 04 | 01 |
| US-M07-02 | 05, 54 | 01, 02 |
| US-M07-03 | 06, 07, 08 | 03, 04 |
| US-M07-04 | 09, 10 | 05 |
| US-M07-05 | 11, 12, 13 | 06 |
| US-M07-06 | 14, 15 | 07 |
| US-M07-07 | 16, 17, 18, 65 | 08, 09, 45 |
| US-M07-08 | 18, 19, 51 | 09, 10, 11 |
| US-M07-09 | 20, 21, 22, 23, 24, 57 | 12, 13, 14, 15 |
| US-M07-10 | 21, 24, 25, 26, 27 | 16, 17, 18 |
| US-M07-11 | 28, 29, 30 | 19, 20, 21, 22 |
| US-M07-12 | 31, 32 | 23 |
| US-M07-13 | 33, 34, 61 | 24, 25 |
| US-M07-14 | 35, 36, 37 | 26, 27 |
| US-M07-15 | 38, 39, 40 | 28, 29, 30 |
| US-M07-16 | 18, 40, 41, 42, 43, 44 | 09, 30, 31, 32, 33 |
| US-M07-17 | 45, 46, 47, 48 | 34, 35 |
| US-M07-18 | 49, 50, 51, 61 | 11, 36, 37 |
| US-M07-19 | 52, 53 | 38, 39 |
| US-M07-20 | 53, 54, 55 | 02, 39, 40 |
| US-M07-21 | 56, 57 | 41 |
| US-M07-22 | 58, 59 | 42 |
| US-M07-23 | 13, 60, 61 | 43 |
| US-M07-24 | 62, 63, 64 | 44 |

## 13. Open questions

Carried from URS §9 (OQ-M07-01…10), plus:

1. **SQ-M07-01 Loading state.** Live pages are server-rendered with no visible loading state; the prototype uses the shell's global page loader while a mock call is pending (FR-G-10). Confirm this matches the global decision made in M23/global UI.
2. **SQ-M07-02 Integer user ids (cross-module).** Closed in v1.3: M07 uses the canonical integer ids of M01 SRS v1.5 (§6.8).
3. **SQ-M07-03 Full-exam attempts and syiling (INFERRED, L-3; v1.7).** The prototype keeps exam attempts as M07 PkskExamAttempt records only: they are not M05 sessions (mode `pksk` is used for domain practice only) and credit no syiling. The live tier setting "Semua soalan PKSK (tiada level)" may also cover exam answers; confirm at L-3 and, if so, route exam completion through M05 BR-31 with mode `pksk` as BR-M07-26.

### 13.1 Cross-module requests and answers (v1.7, XL batch 3)

| ID | To | Request |
|---|---|---|
| XR-M07-01 | M04 | Add the named query **Q-PKSK-DIFFICULTY(d)** to §4.1 = Q-PKSK by `difficultyLevel`, value **253 / 253 / 191 / 66 / 0** (Σ 763 = Q-PKSK), served by `questions.count('Q-PKSK-DIFFICULTY', d)`; it is the PKSK part of Q-DIFFICULTY and equals the PKSK cell family already in M04 v1.11 §6.13 (`difficultyLevel` and `pkskDomainId` rows). M07 cites it in §6.2 and §6.8 and keeps the observed anchors (178359, 178174, 177919 at 2; 178460, 178175 at 3). No count changes: Q-DIFFICULTY stays 39,694 / 47,138 / 33,720 / 9,600 / 0 and M04's inactive difficulty-1 row count 6,245 already uses 253. |
| XR-M07-02 | M05 | (a) Add the value **`pksk`** to the DATA-M05-01 `mode` enum (M05 §6.1) and the link fields `pkskDomainId` (int, M07 domain 1–15) and `pkskTargetLevel` (`T1` / `T4`), null for every other mode; `subjectId` null for `pksk` (already nullable since v1.10) and QuizAnswer `subjectId` null for PKSK rows. (b) Let M07 complete a PKSK practice through the BR-31 contract without the #4/#5 quiz flow (e.g. a repository call `practice.completeSession({userId, mode: 'pksk', pkskDomainId, pkskTargetLevel, answers: [{questionId, isCorrect, selected}], startedAt, completedAt})`; name at M05's choice), applying steps (1), (2), (6), (7) and skipping (3) revision queue, (4) SubjectMastery and (5) trial counter, as M07 BR-M07-26; step (6) passes `mode: 'pksk'` and no `coinsPerCorrect`. (c) Decide how the M05 screens and named queries treat `pksk` sessions (S9 `/practice/history` label, S8, Q-SESS-USER and the all-mode counts) and relay the classification to M08/M11/M17 as SQ-10 did for the teacher modes; M07 proposes: listed on S9 with the "Latihan" badge and "PKSK" in the subject cell (PROPOSED COPY), counted in all-mode figures, absent from subject-scoped figures. The seed holds no `pksk` session, so no seeded total changes. |
| XR-M07-03 | M14 (FYI) | M07 relies on BR-M14-03 for the PKSK rate. Its precedence lists `flat_quiz_reward` (seed 1, > 0) before the tier rate, while PKSK sessions "use `pksk_reward_correct`"; state which wins for mode `pksk`. M07 asserts no coin amount (E2E-M07-45). |

Answers to requests addressed to M07:

| Request | Answer |
|---|---|
| M17 XR-M17-10 (PKSK difficulty split) | **Applied** in v1.7: 253 / 253 / 191 / 66 / 0 (§6.8, via M04 Q-PKSK-DIFFICULTY, XR-M07-01). Closes XL3-22 (split). |
| M14 XR-M14-08 (mode `pksk`) | **Accepted**: PKSK practice completes through M05 BR-31 with mode `pksk` (BR-M07-26, FR-M07-65; M05 change XR-M07-02). Closes XL3-22 (mode). |
| M16 XR-M16-08 (FYI: PKSK level labels, battles read PKSK rows through M04) | **Noted**, no M07 change: "Tingkatan 1" / "Tingkatan 4" are M07's labels for `T1` / `T4`; battles are M16 records with `questionType = 'pksk'` (the same token), not M05 sessions, and read PKSK rows only through M04. |
