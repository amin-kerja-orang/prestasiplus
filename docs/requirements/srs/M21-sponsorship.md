# M21 — Sponsorship & Anak Angkat — Software Requirements Specification

## 0. Document control

| Field | Value |
|---|---|
| Document | SRS — M21 Sponsorship & Anak Angkat |
| Version | 1.2 |
| Date | 2026-09-27 |
| Status | **Approved (G1) — v1.2** |
| Author | product-analyst (agent), all sections; §6 data, §7 mock API and §11 are written for review by solution-architect at G2 |
| Source URS | [urs/M21-sponsorship.md](../urs/M21-sponsorship.md) v1.2 (79 Functions, 23 stories, 75 ACs, coverage 345/345) |
| Source discovery | [M21-sponsorship.md](../../discovery/M21-sponsorship.md); inventory and seed snapshot `docs/discovery/inventory/M21/` (`_snapshot-2026-09-27.json`, captured 2026-09-27 10:25 MYT); screenshots `docs/discovery/img/M21/` |
| Related | [M01](M01-authentication.md) v1.12 (users base, guards, BR-07 landing pages, global 404 / 403, canonical accounts 1, 2, 3, 5, 6, 7), [M02](M02-users-schools.md) **v1.26** (users dataset, `sponsor` cell 6 with canonical 7 and the reserved anchors 5501–5502 (no e-mail assigned yet), parent links, student search), [M08](M08-student-performance.md) v1.10 ("Jadi Penaja"), [M15](M15-rewards-shop.md) v1.4, [M17](M17-admin-dashboard.md) v1.11 (Q-M17-SPONSORS, XR-M17-16), [M19](M19-finance.md) v1.3 (BR-M19-15 entitlement, OQ-M19-10), M24 (not yet specified), architecture overview v1.8 §6.6–§6.7 (datasets, provisional-store pattern), §6.12 (clock), [design/shells.md](../../design/shells.md), [design/design-system.md](../../design/design-system.md) **v1.9** §6 |

**Change log**

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-09-27 | First issue. 66 FRs, 20 business rules, 9 validation rules, 3 owned stores (Sponsor, AnakAngkat, FosterApplication; the sponsor store taken over from M17's provisional contract), 13 named queries, 19 mock endpoints (#6, #7, #17–#19 PROPOSED), 67 E2E (every one at 375 / 768 / 1280; 26 provisional), 10 SEC items, 10 owner requests. Reconciliation of every observed figure by hand (§6.9, 14 checks, all pass). User decision D14 applied to the e-mail notice of S7 (simulated log only). |
| 1.1 | 2026-09-27 | AUD round 1 fixes (`docs/qa/audit/M21-audit.md`). **AUD-M21-01:** API #9 returns `{name, email, school}`; FR-35 renders the SOURCE-DERIVED row (name; "{e-mail} · {school}"); XR-M21-01 (d) asks M02 for the school; §8.2 keeps only the limit and scope as PROPOSED. **AUD-02:** §10 and FR-18 name the sub-12 px elements. **AUD-03:** FR-34 `channel` required; FR-52 / V-M21-04 `postcode` `maxlength=5`; FR-31 and §10.1 the blue `fa-toggle-on` (`ToggleRight`). **AUD-04:** FR-54 / §8.1 footer order. **AUD-05:** citations M01 v1.12, M02 v1.26, M08 v1.10, M15 v1.4, M17 v1.11, design-system v1.9; XR-M21-08 **Applied**; XR-M21-01 (a) phrased as a request (5501–5502 are reserved without e-mails; 5503–5505 new). **AUD-06:** BR-16 / FR-31 "(code)" pattern INFERRED beyond SUSPENDED. **AUD-08:** §3.1 regenerated from the FR AC columns; FR-45 + AC-14.4, FR-66 + AC-22.5, new E2E-M21-68. **AUD-09:** E2E-64 and E2E-66 provisional. **AUD-11:** `irfanhakimi@demo.test`. Counts: 66 FR, 68 E2E (29 provisional). |
| 1.2 | 2026-09-27 | G1 approved by user 2026-09-27 with decisions: sponsor portal minimum (OQ-01), pending-sponsor actions Luluskan/Tolak only (OQ-02). URS reference moved to v1.2; citations re-checked (M01 v1.12, M02 v1.26, M15 v1.4, M17 v1.11, M19 v1.3, design-system v1.9 current; M04 v1.16, M14 v1.8, M20 v1.2, overview v1.8, build-plan v1.11 noted). §8.2 marked as reported at G1. D14 confirmed: no external-platform screens; e-mail and WhatsApp hand-offs are simulated or plain links. No FR, E2E, endpoint or observed value changed (66 FR, 68 E2E). |

### 0.1 Fidelity deviations referenced here

URS §7 is authoritative. Approved fixes: DV-M21-01 ("Lihat" → S3), 02 (405 → 404), 03 (S4 "Semua" = total), 05 (no horizontal scroll at 375), 06 (S6 header title), 07 (text ≥ 12 px), 08 (raw codes → BM labels), 12 (fictitious people), 14 (D14: simulated e-mail). Rejected — replicate live: DV-M21-04, 09, 10, 11, 13, 15.

---

## 1. Scope

The M21 prototype implements, against the mock service layer, the seven screens of URS §1 — sponsor list S1, add sponsor S2, edit sponsor S3, anak angkat S4, applications S5, application form S6, public sponsor registration S7 — plus the redirect of `GET /admin/sponsors/{id}` to S3 (DV-M21-01) and the **PROPOSED minimum sponsor portal** P1 `/sponsor/anak-angkat` and P2 `/sponsor/anak-angkat/pool` (with `/sponsor` and `/sponsor/rewards` redirecting to P1). M21 owns (D12) the stores Sponsor (DATA-M21-01; previously M17's provisional store), AnakAngkat (DATA-M21-02) and FosterApplication (DATA-M21-03). Every figure is computed per request from these stores through the named queries of §6.8; no display constant exists.

**Out of scope:** URS §8 — users (read and created through M01 / M02), the M17 dashboard (reads M21's summary), M15 rewards, M19 entitlement and payments, M24 agents, the rest of the sponsor portal, sponsor suspension / deletion, automatic expiry, real e-mail (D14), backend security.

---

## 2. Screens & routes

Query names are kept as on live (`search`, `status`, `category`, `page`) so bookmarked links work unchanged.

| # | Route | Screen | Primary actor(s) | Shell · header / tab title | API (§7) |
|---|---|---|---|---|---|
| S1 | `/admin/sponsors` | Pengurusan Penaja | Admin | SHA · "Pengurusan Penaja" / "Urus Penaja - Admin" | #1 |
| — | `/admin/sponsors/{id}` | redirect to S3 (DV-M21-01) | Admin | none | #2 (existence) |
| S2 | `/admin/sponsors/create` | Tambah Penaja Baru | Admin | SHA · "Tambah Penaja Baru" / "Tambah Penaja - Admin" | #3 |
| S3 | `/admin/sponsors/{id}/edit` | Edit Penaja | Admin | SHA · "Edit Penaja" + organisation / "Edit Penaja - Admin" | #2, #4, #5, #6, #7 |
| S4 | `/admin/anak-angkat` | Anak Angkat — Sponsorship | Admin | SHA · "Anak Angkat — Sponsorship" / "Pengurusan Anak Angkat" | #8, #9, #10, #11 |
| S5 | `/admin/anak-angkat/permohonan` | Permohonan Keluarga Angkat | Admin | SHA · "Permohonan Keluarga Angkat" / "Permohonan Anak Angkat" | #12, #13, #14 |
| S6 | `/mohon-keluarga-angkat` | Mohon Keluarga Angkat | All signed-in | SHU · "Mohon Keluarga Angkat" (DV-M21-06) / "Mohon Keluarga Angkat" | #15 |
| S7 | `/sponsor/register` | Pendaftaran Penaja | Guest, all | none (standalone) / "Daftar Penaja - PRESTASIPLUS" | #16 |
| P0 (PROPOSED) | `/sponsor`, `/sponsor/rewards` | redirect to P1 (approved sponsor) / 403 page (others) | Penaja | none | — |
| P1 (PROPOSED) | `/sponsor/anak-angkat` | Anak Angkat Saya | Penaja (approved) | SHU · "Anak Angkat Saya" / "Anak Angkat Saya - PRESTASIPLUS" | #17 |
| P2 (PROPOSED) | `/sponsor/anak-angkat/pool` | Pool Pelajar | Penaja (approved) | SHU · "Pool Pelajar" / "Pool Pelajar - PRESTASIPLUS" | #18, #19 |
| — | `/admin/anak-angkat/{x}` (GET), `/sponsor/profile` (GET), `/admin/anak-angkat/permohonan/{id}`, the probed routes of URS §1 | Global 404 (M01) | All | standalone | — |

`{id}` is an integer. The live form posts map to #3–#5, #10, #11, #13–#16.

---

## 3. Functional requirements

| ID | Requirement | FN | AC |
|---|---|---|---|
| FR-M21-01 | The admin shell SHALL show, inside the sidebar group "Pengguna" after M02's items, "Penajaan" (`fa-handshake`) → `/admin/sponsors`, "Anak Angkat" (`fa-child`) → `/admin/anak-angkat` and "Permohonan" (`fa-file-alt`) → `/admin/anak-angkat/permohonan`, with the group open and "Penajaan" active on S1–S3, "Anak Angkat" on S4, "Permohonan" on S5; and the bottom-nav link "Penaja" (`fa-handshake`) → `/admin/sponsors` below `lg`. The shell renders them; M21 registers the routes and their `activeGroup` / `activeItem`. | 1.1.1 | 01.1, 01.2 |
| FR-M21-02 | The user shell SHALL show "Mohon Keluarga Angkat" (`fa-hand-holding-heart`, pink) → `/mohon-keluarga-angkat` in "💎 KILLER FEATURES" between "Pembetulan" and "Penguasaan" for `student` and `admin` only (as the shell `user-nav.ts`). | 1.1.2 | 01.3 |
| FR-M21-03 | S1–S5 SHALL render in the admin-panel shell, S6, P1 and P2 in the user-portal shell, and S7 standalone (no sidebar, header or bottom nav). | 1.1.5 | 01.4 |
| FR-M21-04 | `/sponsor/register` SHALL be a public route reached by the M01 register link "Daftar sebagai Penaja" and the M08 "Jadi Penaja" CTA; S6 "sini" and the S7 footer links SHALL target `/register`, `/login` and `/`. | 1.1.6 | 01.5 |
| FR-M21-05 | Each screen SHALL set the header title / subtitle of URS FN-M21-1.1.3, with the dynamic subtitles organisation name (S3) and "Selamat datang, {first word of the viewer's name}" (S4, S5); S6 SHALL show "Mohon Keluarga Angkat" / "Selamat datang kembali" (DV-M21-06). | 1.1.3 | 02.1, 02.2 |
| FR-M21-06 | Each screen SHALL set the tab title of URS FN-M21-1.1.4 exactly. | 1.1.4 | 02.1, 02.2 |
| FR-M21-07 | S1–S6 and P0–P2 SHALL require a session (guest → `/login`; API `401 UNAUTHORIZED`); S7 and #16 SHALL be public and SHALL NOT redirect a signed-in user. | 1.2.1 | 03.1, 03.5 |
| FR-M21-08 | S1–S5 and #1–#14 SHALL be admin only: another role SHALL be sent to its M01 landing page and the API SHALL answer `403 FORBIDDEN`. | 1.2.2 | 03.2 |
| FR-M21-09 | S6 and #15 SHALL accept every signed-in role. | 1.2.3 | 03.3 |
| FR-M21-10 | P0–P2 and #17–#19 SHALL render the global 403 page (API `403`) for any signed-in user who is not a `sponsor` with an `APPROVED` sponsor record (BR-M21-20). | 1.2.4 | 03.4 |
| FR-M21-11 | An unknown sponsor id on S3 or on the redirect route, `/admin/anak-angkat/permohonan/{id}` and every probed route of URS §1 SHALL render the M01 global 404 page. | 1.2.5 | 04.1 |
| FR-M21-12 | A GET navigation to `/admin/anak-angkat/{x}` or `/sponsor/profile` SHALL render the global 404 page; the Symfony 405 copy SHALL NOT be rendered (DV-M21-02). | 1.2.6 | 04.2 |
| FR-M21-13 | `GET /admin/sponsors/{id}` SHALL redirect (`replace`) to `/admin/sponsors/{id}/edit` when the sponsor exists and render the 404 page otherwise; the 500 page SHALL NOT be rendered (DV-M21-01). The S1 row links "Lihat" (`fa-eye`) → `/admin/sponsors/{id}` and "Edit" (`fa-edit`) → `/admin/sponsors/{id}/edit` SHALL be kept. | 1.2.7, 2.1.6 | 04.3, 07.1 |
| FR-M21-14 | Dates SHALL be "dd/mm/yyyy" in MYT (BR-M21-17). | 1.3.1 | 05.1 |
| FR-M21-15 | Labels SHALL follow BR-M21-16 (BM sponsor status and category labels; capitalised English badges; raw applicant role; "(CODE)" on the S3 status card; DV-M21-08 fixes). | 1.3.2 | 05.2 |
| FR-M21-16 | #1, #8 and #12 SHALL page by 20 (PROPOSED) with `meta {page, perPage, total, lastPage}`; the pager SHALL render only when `lastPage > 1` or the requested page is beyond the last, keep the query values and use the Laravel pager copy "« Previous", "Next »", "Showing {from} to {to} of {total} results" / "Showing 0 of {total} results" (DV-M21-04); a page beyond the last SHALL return no row with `meta.total` = all matches. | 1.3.3 | 05.3 |
| FR-M21-17 | Data views SHALL show the shell loading behaviour while a request is pending and the M01 error convention on failure. | 1.3.4 | 05.4 |
| FR-M21-18 | Every M21 screen and P1 / P2 SHALL have no horizontal page scroll and no content text below 12 px at 375 / 768 / 1280 px (DV-M21-05, 07 — including the S4 sponsor category and student lines, the S4 search-row second line, the S5 student-cell lines, the S6 note, the S7 tile labels, step pills and footer texts); grids SHALL follow §10; wide tables SHALL scroll inside their card. | 1.3.5 | 23.1, 23.2 |
| FR-M21-19 | S1 SHALL show the five global cards of Q-M21-SPONSOR-STATS, unchanged by the filter. | 2.1.1 | 06.1, 06.3 |
| FR-M21-20 | S1 SHALL show "{n} penaja dijumpai" = `meta.total` of #1 and the link "Tambah Penaja" (`fa-plus-circle`) → S2. | 2.1.2 | 06.1, 06.3 |
| FR-M21-21 | S1 SHALL show the GET filter form of FN-M21-2.1.3 with the current values selected and the "Reset" link (`fa-times`) → `/admin/sponsors` only when a filter value is set. | 2.1.3 | 06.1, 06.3 |
| FR-M21-22 | #1 SHALL filter by BR-M21-04. | 2.1.4 | 06.3, 06.4 |
| FR-M21-23 | S1 SHALL show the table of FN-M21-2.1.5 (organisation + login e-mail, category label with the building icon, officer name + telephone or "-", status badge, date). | 2.1.5 | 06.2 |
| FR-M21-24 | #1 SHALL order by `createdAt` descending, ties by `id` ascending. | 2.1.7 | 06.2 |
| FR-M21-25 | When the page has no row, S1 SHALL show the single row "Tiada penaja dijumpai". | 2.1.8 | 06.3 |
| FR-M21-26 | S2 SHALL show the back link, the three sections, their fields, placeholders and HTML attributes (`required` on name and category; `type=url` on website; `type=email` on contact e-mail; category select without an empty option; "Negeri" free text) and the buttons "Tambah Penaja" / "Batal" → S1 (V-M21-01). | 2.2.1, 2.2.2, 2.2.3, 2.2.4, 2.2.5 | 08.1, 08.2, 08.4 |
| FR-M21-27 | "Tambah Penaja" SHALL call #3 (BR-M21-05); on 201 the admin SHALL land on S1 without flash text; on 422 the form SHALL show the messages of §8.2. | 2.2.6 | 08.3 |
| FR-M21-28 | S3 SHALL show the back link and the S2 sections prefilled from #2 with no placeholder, and the buttons "Kemaskini Penaja" (`fa-save`) / "Batal" → S1. | 2.3.1, 2.3.3 | 09.1, 09.2 |
| FR-M21-29 | S3 SHALL show the strip "{status label}" "Status", "{Q-M21-SPONSOR-REWARDS}" "Hadiah", "{createdAt}" "Tarikh Daftar" (DV-M21-08). | 2.3.2 | 09.1, 09.2, 05.2 |
| FR-M21-30 | "Kemaskini Penaja" SHALL call #4 (BR-M21-06); on 200 the admin SHALL land on S1 without flash text. | 2.3.5 | 09.3 |
| FR-M21-31 | S3 SHALL show the status card: blue `fa-toggle-on` icon + "Status Penaja:" + dot + label + "({code})" (OBSERVED for SUSPENDED; the pattern for the other statuses INFERRED); for `SUSPENDED` the button "Aktifkan Semula" (`fa-play-circle`) SHALL call `confirm('Aktifkan semula penaja ini?')` and on OK #5 (BR-M21-07), then reload S3. | 2.3.4, 2.3.6 | 10.1, 10.2 |
| FR-M21-32 | For `PENDING`, the status card SHALL show "Luluskan" (`fa-check`) with `confirm('Luluskan penaja ini?')` → #6 and "Tolak" (`fa-times`) with `confirm('Tolak penaja ini?')` → #7, then reload S3 (PROPOSED); `APPROVED` and `REJECTED` SHALL show no action. | 2.3.7 | 10.3 |
| FR-M21-33 | S4 SHALL show the four global cards of Q-M21-AA-STATS ("Jumlah Penaja" = Q-M21-AA-SPONSORS). | 3.1.1 | 11.1, 22.3 |
| FR-M21-34 | S4 SHALL show "Assign Anak Angkat" with the sponsor select (placeholder "Pilih Penaja" + Q-M21-SPONSOR-OPTIONS, `required`), the category select ("-", B40, Asnaf, Yatim, OKU), the channel select ("Direct", "Via Agent", `required`) and "Assign" (`fa-plus`). | 3.1.2, 3.1.4 | 12.1, 12.4 |
| FR-M21-35 | The student search box SHALL call #9 only when the trimmed query has ≥ 2 characters, 300 ms after the last keystroke; SHALL list each result of #9 as a clickable row with line 1 "{name}" (bold) and line 2 "{e-mail}" + " · {school}" when `school` is not null (SOURCE-DERIVED, live template; ≥ 12 px, DV-M21-07); a click SHALL set the hidden `student_email` and show "{name} ({e-mail})". | 3.1.3 | 12.2 |
| FR-M21-36 | "Assign" SHALL call #10 (BR-M21-10); on 201 the admin SHALL return to S4 (tab "Semua") without flash text; on 422 the message of §8.2 SHALL show. | 3.1.5 | 12.3, 12.4 |
| FR-M21-37 | S4 SHALL show the five tabs of Q-M21-AA-TABS with global counts, "Semua" = total (DV-M21-03), the current tab filled; tabs SHALL wrap at narrow widths (DV-M21-05). | 3.1.6 | 11.1, 11.3 |
| FR-M21-38 | S4 SHALL list Q-M21-AA-LIST(status) (id descending) with the columns and badges of FN-M21-3.1.7 (sponsor category as label, DV-M21-08) or the row "Tiada rekod". | 3.1.7, 3.1.9 | 11.2, 11.3 |
| FR-M21-39 | On an `active` row, "Graduate" and "Tarik" SHALL call #11 with `graduated` / `withdrawn` without a confirm and reload S4 on the same tab; other rows SHALL show no action. | 3.1.8 | 13.1, 13.2 |
| FR-M21-40 | S5 SHALL show the four tab cards of Q-M21-APP-TABS (global), default `pending`, the current one highlighted. | 4.1.1 | 14.1 |
| FR-M21-41 | S5 SHALL list Q-M21-APP-LIST(status) id descending with the columns of FN-M21-4.1.2 and the reason truncated by BR-M21-17. | 4.1.2, 4.1.6 | 14.1, 14.2 |
| FR-M21-42 | "Lulus" (`fa-check`) on a `pending` row SHALL call #13 without a confirm and reload S5 on the same tab (BR-M21-14). | 4.1.3 | 15.1 |
| FR-M21-43 | "Tolak" (`fa-times`) on a `pending` row SHALL call `confirm('Tolak permohonan ini?')` and on OK #14, then reload S5. | 4.1.4 | 15.2 |
| FR-M21-44 | When a tab has no row, S5 SHALL show "Tiada permohonan menunggu", "Tiada permohonan dalam pool", "Tiada permohonan ditaja" or "Tiada permohonan ditolak" (DV-M21-08). | 4.1.5 | 14.3 |
| FR-M21-45 | Rows in `approved`, `matched` and `rejected` SHALL show the badges "Approved", "Matched", "Rejected" and no action (INFERRED / PROPOSED). | 4.1.7 | 14.4, 15.1 |
| FR-M21-46 | S6 SHALL show the hero, the e-mail field with its hint and link, the category select and the income select of FN-M21-4.2.1–4.2.3. | 4.2.1, 4.2.2, 4.2.3 | 16.1 |
| FR-M21-47 | S6 SHALL show the reason textarea, the example box and the note; clicking an example SHALL set the textarea value to the example text including "• " without any request. | 4.2.4 | 16.2 |
| FR-M21-48 | S6 SHALL show the static info box of FN-M21-4.2.6 with the exact copy. | 4.2.6 | 16.3 |
| FR-M21-49 | "Hantar Permohonan" SHALL call #15 after the browser checks (V-M21-03); on 201 S6 SHALL reset the form and show the PROPOSED success notice; on 422 it SHALL show the PROPOSED message (BR-M21-13). | 4.2.5 | 17.1, 17.2, 17.3, 17.4 |
| FR-M21-50 | S7 SHALL show the H1 "PRESTASIPLUS", "Pendaftaran Penaja" and the three step pills with active / completed states. | 5.1.1 | 18.1 |
| FR-M21-51 | S7 step 1 SHALL show the fields and the 13 tiles of FN-M21-5.1.2; "Seterusnya" SHALL move to step 2 only when a tile is selected, otherwise `alert('Sila pilih kategori penaja.')`. | 5.1.2 | 18.1 |
| FR-M21-52 | S7 step 2 SHALL show the fields of FN-M21-5.1.3 with the 16-state select and `maxlength=5` on "Poskod"; "Kembali" SHALL keep the values; "Seterusnya" SHALL move to step 3 without validation. | 5.1.3 | 18.2 |
| FR-M21-53 | S7 step 3 SHALL show the fields of FN-M21-5.1.4; each eye button SHALL toggle its field between `password` and `text` and its icon between `fa-eye` and `fa-eye-slash`; the submit button SHALL show "Menghantar..." (`fa-circle-notch`) while #16 is pending. | 5.1.4 | 18.3 |
| FR-M21-54 | S7 SHALL show the footer of FN-M21-5.1.5 in the order "Sudah ada akaun?" "Log Masuk" → `/login` " · " "Daftar Sebagai Pelajar" → `/register`, then "Kembali ke Laman Utama" → `/`, all ≥ 12 px. | 5.1.5 | 18.4 |
| FR-M21-55 | "Hantar Permohonan" SHALL call #16 (BR-M21-08, V-M21-04); on 201 the card SHALL be replaced by the PROPOSED success panel; on 422 the step of the first error SHALL show with the messages of §8.2. | 5.1.6 | 19.1, 19.2, 19.3, 19.4 |
| FR-M21-56 | The portal SHALL admit only an approved sponsor (BR-M21-20). | 6.1.1 | 20.1 |
| FR-M21-57 | `/sponsor` SHALL redirect an approved sponsor to `/sponsor/anak-angkat`; the M01 landing page of role `sponsor` SHALL be `/sponsor` (XR-M21-02, PROPOSED). | 6.1.2 | 20.2 |
| FR-M21-58 | `/sponsor/rewards` SHALL redirect an approved sponsor to `/sponsor/anak-angkat`; `/sponsor/profile` (GET) SHALL render the 404 page. | 6.1.5, 6.1.6 | 20.2 |
| FR-M21-59 | P1 SHALL list Q-M21-SPONSOR-AA(viewer's sponsor) with the PROPOSED copy of FN-M21-6.1.3 and the link "Pool Pelajar". | 6.1.3 | 21.1, 21.2 |
| FR-M21-60 | P2 SHALL list Q-M21-POOL with "Taja" (`fa-handshake`) calling `confirm('Taja pelajar ini?')` and on OK #19 (BR-M21-15), then navigate to P1. | 6.1.4 | 21.1, 21.2 |
| FR-M21-61 | The Sponsor store SHALL hold exactly the fields and enums of DATA-M21-01. | 7.1.1 | 22.1 |
| FR-M21-62 | The AnakAngkat store SHALL hold exactly the fields and enums of DATA-M21-02. | 7.1.2 | 22.1 |
| FR-M21-63 | The FosterApplication store SHALL hold exactly the fields and enums of DATA-M21-03. | 7.1.3 | 22.1 |
| FR-M21-64 | Every displayed count SHALL come from a named query of §6.8, recomputed per request; M21 SHALL expose `sponsorship.sponsorSummary()` to M17 (§6.7). | 7.1.4 | 22.2, 22.3 |
| FR-M21-65 | M21 SHALL read and create users only through the M01 / M02 contract, read "Hadiah" through M15, and SHALL write nothing to M15, M17, M19 or M24 stores. | 7.1.5 | 22.4 |
| FR-M21-66 | Status changes SHALL follow the transition table of BR-M21-07, 11, 14, 15 and V-M21-07 (other transitions → `409 INVALID_STATE`); an anak-angkat record SHALL stay `active` when its sponsor is suspended. | 7.1.6 | 10.2, 13.1, 15.1, 21.2, 22.5 |

### 3.1 Traceability (US → FR → E2E)

| US | FR | E2E |
|---|---|---|
| US-M21-01 | 01, 02, 03, 04 | 01, 02, 03, 04, 05 |
| US-M21-02 | 05, 06 | 06, 07 |
| US-M21-03 | 07, 08, 09, 10 | 08, 09, 10, 11 |
| US-M21-04 | 11, 12, 13 | 12, 13, 14 |
| US-M21-05 | 14, 15, 16, 17, 29 | 15, 16, 17, 18 |
| US-M21-06 | 19, 20, 21, 22, 23, 24, 25 | 19, 20, 21, 22 |
| US-M21-07 | 13 | 14 |
| US-M21-08 | 26, 27 | 23, 24, 25 |
| US-M21-09 | 28, 29, 30 | 26, 27, 28 |
| US-M21-10 | 31, 32, 66 | 29, 30, 31 |
| US-M21-11 | 33, 37, 38 | 32, 33, 34 |
| US-M21-12 | 34, 35, 36 | 35, 36, 37, 38 |
| US-M21-13 | 39, 66 | 39, 40 |
| US-M21-14 | 40, 41, 44, 45 | 41, 42, 43, 44 |
| US-M21-15 | 42, 43, 45, 66 | 44, 45 |
| US-M21-16 | 46, 47, 48 | 46, 47, 48 |
| US-M21-17 | 49 | 49, 50, 51 |
| US-M21-18 | 50, 51, 52, 53, 54 | 52, 53, 54, 55 |
| US-M21-19 | 55 | 56, 57 |
| US-M21-20 | 56, 57, 58 | 58, 59 |
| US-M21-21 | 59, 60, 66 | 60, 61 |
| US-M21-22 | 33, 61, 62, 63, 64, 65, 66 | 62, 63, 64, 65, 68 |
| US-M21-23 | 18 | 66, 67 |

---

## 4. Business rules

| ID | Rule | Source |
|---|---|---|
| BR-M21-01 | **Access.** S1–S5, the redirect route and #1–#14: `admin` only. S6, #15: every signed-in role. S7, #16: public (guest and signed-in). P0–P2, #17–#19: `sponsor` with an `APPROVED` sponsor (BR-M21-20). Guest → `/login` except S7. | OBSERVED (admin, guest) / INFERRED / PROPOSED |
| BR-M21-02 | **Menus.** Admin sidebar "Pengguna" → "Penajaan", "Anak Angkat", "Permohonan"; admin bottom nav "Penaja"; user menu "Mohon Keluarga Angkat" for `student` and `admin`; no portal menu entry. | OBSERVED |
| BR-M21-03 | **Header / tab titles** are route meta with dynamic parts (organisation name on S3; viewer's first name on S4 / S5). | OBSERVED |
| BR-M21-04 | **Sponsor filter (#1).** `search` trimmed; case-insensitive substring of `name` or of the linked user's e-mail (INFERRED fields); `status` compared case-insensitively with the code; `category` exact code; empty = any; any other value matches nothing; AND; order `createdAt` desc, `id` asc; 20 per page; `meta.total` = all matches; the stats are over all sponsors. | OBSERVED / INFERRED |
| BR-M21-05 | **Admin create (#3).** New id = max + 1 (from 12); `status` `APPROVED` (INFERRED "auto-diluluskan"); `userId` null; every other field as sent (empty → null); `createdAt` = now. | INFERRED / PROPOSED |
| BR-M21-06 | **Admin update (#4).** Updates every form field; keeps `id`, `userId`, `status`, `createdAt`. | PROPOSED |
| BR-M21-07 | **Sponsor transitions.** Reactivate (#5): `SUSPENDED` → `APPROVED` (INFERRED). Approve (#6): `PENDING` → `APPROVED`; reject (#7): `PENDING` → `REJECTED` (PROPOSED). Any other source status → 409. No transition into `SUSPENDED` exists. Each change records a simulated e-mail notice to the linked user when one exists (D14, §6.13). | INFERRED / PROPOSED |
| BR-M21-08 | **Self-registration (#16).** Creates one user through the M01 / M02 contract (`role` `sponsor`, `name`, `email`, password; runtime id ≥ 9,000,001 per M02 §6.15) and one sponsor (`userId` = the new user, `name` = `organization_name`, `category`, organisation / contact / address fields, `status` `PENDING`, `createdAt` now); all or nothing; the visitor is not signed in. | INFERRED / PROPOSED |
| BR-M21-09 | **S4 figures.** "Jumlah Penaja" = count(distinct `sponsorId`) over all anak-angkat records (any status; C2, OQ-M21-10); "Pelajar Aktif Ditaja" / "Graduated" / "Withdrawn" = count by status; tabs: `all` = count(*), `active`, `graduated`, `withdrawn`, `expired` = count by status — all global (DV-M21-03). | OBSERVED / INFERRED |
| BR-M21-10 | **Assign (#10).** `sponsorId` must be an `APPROVED` sponsor; `studentEmail` must resolve to a user with role `student` (M02); `studentCategory` ∈ {B40, Asnaf, Yatim, OKU} or null; `channel` ∈ {direct, mlm}; creates a record `active`, `applicationId` null, `createdAt` now; no duplicate check (OQ-M21-12). | PROPOSED |
| BR-M21-11 | **Close (#11).** Only an `active` record; `status` ∈ {graduated, withdrawn}; no confirm (as live). `expired` is never set automatically (OQ-M21-11). | INFERRED |
| BR-M21-12 | **Sponsor options.** The S4 select lists `APPROVED` sponsors by name ascending (INFERRED; empty in the seed as live). | INFERRED |
| BR-M21-13 | **Application submit (#15).** `studentEmail` resolves to a `student` user (M02); `applicantUserId` = viewer, `applicantRole` = viewer's role code; `studentCategory` ∈ 5 values; `familyIncomeRange` ∈ 4 values or null; `reason` stored as typed; `status` `pending`; `createdAt` now; no duplicate check. | PROPOSED |
| BR-M21-14 | **Application review.** Lulus (#13): `pending` → `approved` ("Dalam Pool"); Tolak (#14): `pending` → `rejected`; other source status → 409. | INFERRED |
| BR-M21-15 | **Taja (#19, PROPOSED).** Only an `approved` application and an approved sponsor; application → `matched`; creates one anak-angkat record (`sponsorId` = viewer's sponsor, `studentId` of the application, `studentCategory` = the application category when ∈ {B40, Asnaf, Yatim, OKU} else null, `channel` `direct`, `status` `active`, `applicationId`, `createdAt` now); atomic. | PROPOSED |
| BR-M21-16 | **Labels.** Sponsor category code → label (13, §6.5); sponsor status `PENDING` "Menunggu", `APPROVED` "Diluluskan", `REJECTED` "Ditolak", `SUSPENDED` "Digantung"; S3 status card "{label} ({code})" (OBSERVED "Digantung (SUSPENDED)"; INFERRED for the other statuses); anak-angkat badge = ucfirst(status) ("Active", "Graduated", "Withdrawn", "Expired"); channel `direct` "Direct", `mlm` "Via Agent"; application badge = ucfirst(status) ("Pending", "Approved", "Matched", "Rejected"); applicant role raw code; empty category "-". | OBSERVED / INFERRED |
| BR-M21-17 | **Formats** (MYT): dates "dd/mm/yyyy"; reason display = the first 80 characters + "..." when the reason is longer than 80 characters, else the full text. | OBSERVED |
| BR-M21-18 | **Hadiah.** S3 "Hadiah" = M15 `rewards.countBySponsor(sponsorId)` (XR-M21-04); 0 for every seed sponsor. | OBSERVED (0) / INFERRED |
| BR-M21-19 | **S1 row.** "Organisasi" second line = the linked user's e-mail (none when `userId` is null); "Pegawai" = `contactPersonName` + `contactPhone` when a name exists, else "-". | OBSERVED / PROPOSED |
| BR-M21-20 | **Portal access.** The viewer's role is `sponsor` and the sponsor linked to the viewer has `status` `APPROVED`; otherwise 403 (the admin OBSERVED). | OBSERVED / PROPOSED |

---

## 5. Validation rules

| ID | Input | Rule | Error (PROPOSED COPY; 422 `VALIDATION_FAILED` with `fields`) |
|---|---|---|---|
| V-M21-01 | #3, #4 sponsor fields | `name` required, ≤ 150; `category` ∈ 13 codes; `website` empty or an `http(s)://` URL; `logoUrl` empty or an `http(s)://` URL (SEC-M21-05); `contactEmail` empty or an e-mail; every other text ≤ 255 | "Sila isi ruangan ini." (required), "Format URL tidak sah.", "Format e-mel tidak sah.", "Pilihan tidak sah." |
| V-M21-02 | #10 assign | `sponsorId` an `APPROVED` sponsor; `studentEmail` a `student` user; `studentCategory` null or one of 4; `channel` one of 2 | "Sila pilih pelajar daripada senarai carian.", "Penaja tidak sah." |
| V-M21-03 | #15 application | `studentEmail` required, e-mail, a `student` user; `studentCategory` required, one of 5; `familyIncomeRange` null or one of 4; `reason` required (no length limit on live; ≤ 5,000 stored, SEC-M21-07) | "Email pelajar tidak dijumpai dalam PrestasiPlus.", "Sila isi ruangan ini." |
| V-M21-04 | #16 registration | the 12 required fields of the snapshot present; `category` one of 13; `contactEmail` and `email` e-mails; `state` one of 16; `postcode` ≤ 5 characters (live `maxlength=5`); `email` not used by any user (M01 / M02); `password` ≥ 6 and equal to `password_confirmation`; `website` empty or `http(s)://` | "Sila pilih kategori penaja.", "E-mel ini telah didaftarkan.", "Kata laluan mesti sekurang-kurangnya 6 aksara.", "Pengesahan kata laluan tidak sepadan.", "Sila isi ruangan ini." |
| V-M21-05 | #9 search query | trimmed; < 2 characters → no call; ≤ 100 | — |
| V-M21-06 | path `{id}` | existing record | 404 `NOT_FOUND` → global 404 page |
| V-M21-07 | #5, #6, #7, #11, #13, #14, #19 | source status as BR-M21-07 / 11 / 14 / 15 | 409 `INVALID_STATE` |
| V-M21-08 | every mutation | CSRF header present (SEC-M21-04) | 419 |
| V-M21-09 | #1, #8, #12 query | `page` integer ≥ 1 (else 1); other values accepted as they are (unknown → no row) | — |

---

## 6. Data entities & fields

JSON fields are camelCase; ids are integers. "Now" is the shared mock clock (ADR-0006, architecture §6.12), project clock **2026-09-25T15:40:00+08:00**. M21 reads and creates users through the M01 / M02 contract (D12). Everything resets per E2E test (`mock.reset()`).

### 6.1 Referenced entities (owners; not redefined — D12)

| Entity | Owner | Fields M21 reads |
|---|---|---|
| User | M01 DATA-M01-01 / M02 v1.26 users dataset | `id`, `name`, `email`, `role`, school name (S5 "Pelajar" third line) |
| Student search | M02 (`/api/students/search` contract; XR-M21-01 d) | `{id, name, email, school}` of `student` users (`school` = school name or null; needed by the SOURCE-DERIVED S4 result row) |
| Reward items | M15 | `countBySponsor(sponsorId)` only (XR-M21-04) |
| Entitlement, payments | M19 | none (boundary; XR-M21-05) |

### 6.2 DATA-M21-01 — Sponsor (owned by M21; repository `sponsors`; materialised table; replaces M17's provisional store)

| Field | Type | Req | Notes |
|---|---|---|---|
| id | int | yes | Seed 6–11 (1–5 absent, as live); runtime from 12 |
| userId | int → User \| null | no | linked login (role `sponsor`); null for an admin-created sponsor |
| name | string ≤ 150 | yes | organisation name |
| category | enum (13 codes, §6.5) | yes | |
| description, tagline, website, logoUrl, registrationNumber | string \| null | no | |
| contactPersonName, contactPersonPosition, contactEmail, contactPhone | string \| null | no | fictitious in the seed (DV-M21-12) |
| address, city, state, postcode | string \| null | no | `state` free text |
| status | enum `PENDING` / `APPROVED` / `REJECTED` / `SUSPENDED` | yes | |
| createdAt | datetime | yes | "Tarikh Daftar", "Tarikh" |

### 6.3 DATA-M21-02 — AnakAngkat (owned by M21; repository `anakAngkat`)

| Field | Type | Req | Notes |
|---|---|---|---|
| id | int | yes | Seed 2 (1 absent, as live); runtime from 3 |
| sponsorId | int → Sponsor | yes | |
| studentId | int → User (student) | yes | |
| studentCategory | enum `B40` / `Asnaf` / `Yatim` / `OKU` \| null | no | null → "-" |
| channel | enum `direct` / `mlm` | yes | "Direct" / "Via Agent" |
| status | enum `active` / `graduated` / `withdrawn` / `expired` | yes | |
| applicationId | int → FosterApplication \| null | no | set by #19 (PROPOSED) |
| createdAt | datetime | yes | "Tarikh" |

### 6.4 DATA-M21-03 — FosterApplication (owned by M21; repository `fosterApplications`)

| Field | Type | Req | Notes |
|---|---|---|---|
| id | int | yes | Seed 1–3; runtime from 4 |
| studentId | int → User (student) | yes | resolved from the e-mail |
| applicantUserId | int → User | yes | |
| applicantRole | string (role code at submission) | yes | shown raw |
| studentCategory | enum `B40` / `Asnaf` / `Yatim` / `OKU` / `Lain-lain` | yes | |
| familyIncomeRange | enum `< RM1,000` / `RM1,000 - RM2,500` / `RM2,500 - RM4,000` / `> RM4,000` \| null | no | not displayed on any observed screen |
| reason | text | yes | stored as typed (the S6 bullet included) |
| status | enum `pending` / `approved` / `matched` / `rejected` | yes | |
| createdAt | datetime | yes | not displayed |

### 6.5 Constant enumerations

| Enum | Values → label (icon) |
|---|---|
| Sponsor category | `INDIVIDU` "Individu / Peribadi" (`fa-user`); `SYARIKAT_SWASTA` "Syarikat Swasta" (`fa-building`); `GLC` "Syarikat Berkaitan Kerajaan" (`fa-landmark`); `NGO` "Pertubuhan Bukan Kerajaan" (`fa-hands-helping`); `BADAN_KERAJAAN` "Badan / Agensi Kerajaan" (`fa-university`); `BANK` "Bank / Institusi Kewangan" (`fa-piggy-bank`); `UNIVERSITI` "Universiti / IPT" (`fa-graduation-cap`); `PERSATUAN` "Persatuan / Kesatuan" (`fa-users`); `KOPERASI` "Koperasi" (`fa-handshake`); `KEDAI_BUKU` "Kedai Buku / Alat Tulis" (`fa-book-reader`); `RESTORAN` "Restoran / F&B" (`fa-utensils`); `TEKNOLOGI` "Syarikat Teknologi" (`fa-laptop-code`); `PENDIDIKAN` "Penyedia Pendidikan" (`fa-chalkboard-teacher`) |
| States (S7) | Johor, Kedah, Kelantan, Melaka, Negeri Sembilan, Pahang, Perak, Perlis, Pulau Pinang, Sabah, Sarawak, Selangor, Terengganu, W.P. Kuala Lumpur, W.P. Putrajaya, W.P. Labuan |
| Application category labels (S6) | `B40` "B40 — Pendapatan rendah"; `Asnaf` "Asnaf — Layak bantuan zakat"; `Yatim` "Yatim — Tiada ibu/bapa"; `OKU` "OKU — Orang kurang upaya"; `Lain-lain` "Lain-lain" |
| Income labels (S6) | `< RM1,000` "Bawah RM1,000"; `RM1,000 - RM2,500`; `RM2,500 - RM4,000`; `> RM4,000` "Atas RM4,000" |

### 6.6 Read models

`SponsorRow` = `{id, name, loginEmail, categoryLabel, officer: {name, phone} \| null, status, statusLabel, createdAt}`; `SponsorStats` = `{total, pending, approved, rejected, suspended}`; `SponsorDetail` = sponsor fields + `{statusLabel, rewardsCount}`; `AnakAngkatRow` = `{id, sponsor: {name, categoryLabel}, student: {name, email}, studentCategory, channel, status, createdAt}`; `AnakAngkatStats` = `{sponsors, active, graduated, withdrawn}`; `AnakAngkatTabs` = `{all, active, graduated, withdrawn, expired}`; `ApplicationRow` = `{id, student: {name, email, schoolName \| null}, applicant: {name, role}, studentCategory, reasonShort, status}`; `ApplicationTabs` = `{pending, approved, matched, rejected}`.

### 6.7 Contract exposed to other modules

| Function | Consumer | Returns (seed) |
|---|---|---|
| `sponsorship.sponsorSummary()` | M17 Q-M17-SPONSORS (XR-M21-03) | `{total: 6, active: 0, pending: 0, rejected: 0, suspended: 6}` (`active` = `APPROVED`) |
| `sponsorship.sponsorForUser(userId)` | M01 landing / guard (XR-M21-02) | the sponsor linked to the user or null |

### 6.8 Named queries (every displayed count cites one)

Values at the project clock with the seed of §6.11.

| Query | Base | Definition | Value at the clock | Shown on |
|---|---|---|---|---|
| Q-M21-SPONSOR-STATS | sponsors | count(*), count by status | 6 / 0 / 0 / 0 / 6 | S1 cards |
| Q-M21-SPONSOR-LIST(filter, page) | sponsors ⋈ users | BR-M21-04 | all 6 (#11, #6–#10); `SUSPENDED` 6; other statuses 0; `SYARIKAT_SWASTA` 6; `INDIVIDU` 0; "Kedai" 1; "zzqxv" 0 | S1 count line, rows |
| Q-M21-SPONSOR-OPTIONS | sponsors | status `APPROVED`, name asc | [] | S4 select |
| Q-M21-SPONSOR-REWARDS(s) | M15 contract | BR-M21-18 | 0 for 6–11 | S3 "Hadiah" |
| Q-M21-SPONSOR-SUMMARY | sponsors | §6.7 | 6 · 0 · 0 · 0 · 6 | M17 cards |
| Q-M21-AA-SPONSORS | anakAngkat | count(distinct sponsorId) | 1 | S4 "Jumlah Penaja" |
| Q-M21-AA-STATS | anakAngkat | BR-M21-09 | 1 / 1 / 0 / 0 | S4 cards |
| Q-M21-AA-TABS | anakAngkat | BR-M21-09 | 1 / 1 / 0 / 0 / 0 | S4 tabs |
| Q-M21-AA-LIST(status, page) | anakAngkat ⋈ sponsors ⋈ users | status filter (`all` = any), id desc | [2] | S4 table |
| Q-M21-APP-TABS | fosterApplications | count by status | 3 / 0 / 0 / 0 | S5 tabs |
| Q-M21-APP-LIST(status, page) | fosterApplications ⋈ users | status filter, id desc | [3, 2, 1] | S5 table |
| Q-M21-POOL | fosterApplications | status `approved`, id asc | [] | P2 |
| Q-M21-SPONSOR-AA(s) | anakAngkat | sponsorId = s, id desc | sponsor 11: [2] | P1 |

### 6.9 Count reconciliation (every observed figure; by hand)

Clock = 2026-09-25T15:40:00+08:00; discovery snapshot = 2026-09-27 10:25 MYT. No M21 record changes between the two instants (no counter, no record dated after the clock).

| ID | Check | Result | Status |
|---|---|---|---|
| R01 | S1 cards | 6 sponsors; `SUSPENDED` 6 → 6 / 0 / 0 / 0 / 6 = live (all 11 filter states) | PASS |
| R02 | S1 status filters | `SUSPENDED` / `suspended` 6 (#11, #6–#10); `PENDING`, `pending`, `APPROVED`, `REJECTED` 0 = live | PASS |
| R03 | S1 category filters | `SYARIKAT_SWASTA` 6, `INDIVIDU` 0 = live | PASS |
| R04 | S1 search | "Kedai": names → #6 only; login e-mails `sponsor1…5@demo.test`, `penaja@demo.test` contain no "kedai" → 1 = live; "zzqxv" 0 = live | PASS |
| R05 | S1 order | `createdAt` #11 2026-03-31 > #6–#10 2026-02-06 (equal) → #11, then id asc 6–10 = live | PASS |
| R06 | S1 `?page=2` | 6 rows ≤ 20 → page 2 empty, `meta.total` 6 → "6 penaja dijumpai", "Showing 0 of 6 results" = live | PASS |
| R07 | S3 "Hadiah" | M15 count 0 for 6–11 = live | PASS |
| R08 | S4 cards | distinct sponsors {11} = 1; active 1; graduated 0; withdrawn 0 = live | PASS |
| R09 | S4 tabs | all 1, active 1, graduated 0, withdrawn 0, expired 0 = live on the default and "Aktif" tabs; on Graduated / Withdrawn / Expired live shows "Semua (0)", the rebuild "Semua (1)" (DV-M21-03, the only changed figure) | PASS (DV) |
| R10 | S4 select | `APPROVED` sponsors = none → only "Pilih Penaja" = live | PASS |
| R11 | S5 tabs and order | pending 3 (#3, #2, #1), approved / matched / rejected 0 = live | PASS |
| R12 | M17 cards | summary 6 · 0 active · 0 pending · 0 rejected · 6 suspended = M17 Q-M17-SPONSORS = live | PASS |
| R13 | M02 sponsor users | 6 sponsors ↔ 6 users with role `sponsor` (7, 5501–5505) = M02 cell 6 = live `?role=sponsor` 6 | PASS (XR-M21-01) |
| R14 | S1 "Jumlah" 6 vs S4 "Jumlah Penaja" 1 | two named queries (Q-M21-SPONSOR-STATS total, Q-M21-AA-SPONSORS) on different pages; no contradiction on one page (DV-M21-13) | PASS |

**Classification.** (a) Computed from M21's stores: R01–R06, R08–R12, R14. (b) Owner contracts: R07 (M15), R13 (M02). (c) D9 fixes: R09 only. No display constant.

### 6.10 Dataset spec (D11; every count is a named query of §6.8)

| Store | Owner | Primitive | Total at the clock | Facets (count-relevant) | Evidence | Runtime ids |
|---|---|---|---|---|---|---|
| `sponsors` | M21 (from M17's provisional contract) | materialised table (every row observed) | 6 | status, category, createdAt | snapshot `S1_sponsors`, `S3_sponsorFields`, `M17_sponsorCards` | 12 → |
| `anakAngkat` | M21 | materialised table | 1 | status, sponsorId | snapshot `S4_anakAngkat` | 3 → |
| `fosterApplications` | M21 | materialised table | 3 | status | snapshot `S5_applications` | 4 → |
| users (sponsor logins, 4 students, 1 parent) | **M01 / M02** | users dataset anchors (XR-M21-01) | — | — | snapshot `M02_sponsorUsers`, S4 / S5 rows | ≥ 9,000,001 (runtime) |

### 6.11 Seed (every value observed unless marked; people and contact data fictitious, DV-M21-12)

**A. Sponsors (6).** All `category` `SYARIKAT_SWASTA`, `status` `SUSPENDED`, `tagline` null, `logoUrl` null, `registrationNumber` null. Times of day designed (12:00 MYT); dates observed.

| id | userId (login e-mail) | name | description | website | createdAt | contact / address |
|---|---|---|---|---|---|---|
| 6 | 5501 (`sponsor1@demo.test`) | Kedai Buku Popular | Rangkaian kedai buku terbesar Malaysia. Menyediakan buku-buku pendidikan berkualiti untuk semua peringkat umur. | https://www.popular.com.my | 2026-02-06 12:00 | none |
| 7 | 5502 (`sponsor2@demo.test`) | Faber-Castell Malaysia | Penyedia alat tulis premium untuk pelajar. Pensil, pen warna, dan set lukisan berkualiti tinggi. | https://www.faber-castell.com.my | 2026-02-06 12:00 | none |
| 8 | 5503 (`sponsor3@demo.test`) | KidZania Kuala Lumpur | Taman tema pendidikan interaktif di mana kanak-kanak boleh bermain sambil belajar tentang pelbagai kerjaya. | https://www.kidzania.com.my | 2026-02-06 12:00 | none |
| 9 | 5504 (`sponsor4@demo.test`) | Petrosains Discovery Centre | Pusat penemuan sains interaktif di KLCC. Jelajahi dunia sains dan teknologi melalui pameran menarik. | https://www.petrosains.com.my | 2026-02-06 12:00 | none |
| 10 | 5505 (`sponsor5@demo.test`) | PRESTASIPLUS Official | Ganjaran rasmi dari PRESTASIPLUS — hadiah eksklusif untuk pelajar cemerlang! | https://jombelajar.my | 2026-02-06 12:00 | none |
| 11 | 7 (`penaja@demo.test`, canonical) | Alesa It Services | Syarikat IT | https://alesa.my | 2026-03-31 12:00 | officer "Hafiz Bin Contoh", "Pengurus", `pegawai.alesa@demo.test`, `0100000011`; "No. 1, Jalan Contoh 1/1", "Shah Alam", "Selangor", "40000" (all fictitious; presence observed) |

**B. Anak angkat (1).** #2 — sponsor 11, student **5234** "Irfan Hakimi Bin Contoh" (`irfanhakimi@demo.test`, fictitious; live shows a DELIMa-style address, replaced by the reserved demo domain so no seed address can match a real government mailbox, AUD-M21-11), `B40`, `direct`, `active`, 2026-03-31 12:00, `applicationId` null.

**C. Applications (3).** All `B40`, `pending`, `familyIncomeRange` null (not observed), `createdAt` designed (not displayed): #1 2026-09-01 10:00, #2 2026-09-02 10:00, #3 2026-09-02 10:05.

| id | student | applicant (role) | reason (stored) | S5 display |
|---|---|---|---|---|
| 1 | 5231 "Nur Hajar Binti Demo", `nurhajar@demo.test`, with a school (PROPOSED 900003 "SMK Demo Seri Putra", XR-M21-01) | 5231 herself (`student`) | S6 example 2 verbatim with "• " (observed) | "• Pelajar yatim piatu yang tinggal bersama nenek. Nenek sudah tua dan tiada pend..." |
| 2 | 5233 "Aina Sofea Binti Demo", `ainasofea@demo.test`, no school ("-") | 5412 "Rosnah Binti Demo" (`parent`) | "Kami sekeluarga berpendapatan rendah dan tidak mampu menanggung kos tuisyen untuk dua orang anak yang sedang bersekolah menengah." (fictitious; the live text is a parent's own words, 83 characters shown) | "Kami sekeluarga berpendapatan rendah dan tidak mampu menanggung kos tuisyen untu..." |
| 3 | 5232 "Adam Haikal Bin Demo", `adamhaikal@demo.test`, no school ("-") | 5412 "Rosnah Binti Demo" (`parent`) | same text as #2 (observed: the same parent text) | same as #2 |

**D. Enumerations:** §6.5.

**E. Test-only fixtures** (never loaded with the observed-figure checks): `m21-many` (19 extra `SUSPENDED` sponsors, ids 12–30, for paging); `m21-approved` (#6 `APPROVED`, for the assign and portal scenarios without the reactivate step); `m21-pending` (one `PENDING` sponsor with a login, for FR-M21-32).

### 6.12 Cross-module requests (XR-M21-nn; applied through the XL gate — M21 does not edit the owners' stores)

| ID | To | Request | Why | Status |
|---|---|---|---|---|
| XR-M21-01 | M02 (v1.26) | (a) **Sponsor logins (request):** the `sponsor` cell (live 6) = canonical 7 + 5501–5505 exactly. In M02 v1.26, 5501–5502 are only reserved sponsor anchor ids with no e-mail or name, and 5503–5505 do not exist. M21 requests that M02 **assign** the e-mails and names to the reserved 5501 → `sponsor1@demo.test`, 5502 → `sponsor2@demo.test`, and **create the new anchors** 5503 / 5504 / 5505 → `sponsor3@demo.test` / `sponsor4@demo.test` / `sponsor5@demo.test` (names "Penaja Demo 1"…"Penaja Demo 5"), each the login of sponsors 6–10; canonical 7 (`penaja@demo.test`, existing) is the login of #11. (b) **Student anchors** (role `student`, active, fictitious): **5231** "Nur Hajar Binti Demo" `nurhajar@demo.test` with a school (PROPOSED fixture school 900003, outside every register count); **5232** "Adam Haikal Bin Demo" `adamhaikal@demo.test` and **5233** "Aina Sofea Binti Demo" `ainasofea@demo.test`, no school (siblings); **5234** "Irfan Hakimi Bin Contoh" `irfanhakimi@demo.test`, school at M02's choice (all new anchors). (c) **Parent anchor 5412** "Rosnah Binti Demo" `rosnah@demo.test` linked to 5232 and 5233. All placed inside the existing cells (no count change; parent 38, student 4,533) and outside every M11 / M17 / M18 population; M02 confirms the ids and placements. (d) Expose `students.search(q)` → `[{id, name, email, school}]` (`school` = the student's school name or null; ≥ 2 characters, name or e-mail contains, ≤ 10) — the school is required by the SOURCE-DERIVED S4 result row (AUD-M21-01) — and `users.findByEmail(email)`. | Seed of S1, S4, S5 (C4); student search and e-mail resolution. | Requested |
| XR-M21-02 | M01 | (a) `users.create({role: 'sponsor', name, email, password})` for S7 (runtime ids per M02 §6.15; e-mail uniqueness); (b) route meta: `/admin/sponsors*`, `/admin/anak-angkat*` admin; `/mohon-keluarga-angkat` signed-in; `/sponsor/register` public without guest-only redirect; `/sponsor*` signed-in with the M21 portal guard; (c) BR-07 landing for `sponsor` → `/sponsor` (PROPOSED; today `/dashboard`, INFERRED) — pending OQ-M21-01; (d) the global 403 page for the portal guard. | S7 account creation; guards; sponsor landing (C5). | Requested |
| XR-M21-03 | M17 | Hand-over of the provisional sponsor store (XR-M17-16, XL3-23): M21 now owns `sponsors`; Q-M17-SPONSORS reads `sponsorship.sponsorSummary()` → `{total 6, active 0, pending 0, rejected 0, suspended 6}` (unchanged values); the provisional declaration (`owner: 'M21', provisional: true`) is removed; E2E-M17-17 stays green. | D12 single owner (C1). | Requested |
| XR-M21-04 | M15 | Expose `rewards.countBySponsor(sponsorId)` returning the number of reward items linked to a sponsor (0 for every seed sponsor; no link exists in M15 today). Confirm whether rewards carry a sponsor at all and what `/sponsor/rewards` should show (OQ-M21-08). | S3 "Hadiah" (C6). | Requested |
| XR-M21-05 | M19 | Confirm that M21 writes no payment or entitlement, and decide (with OQ-M19-10) whether an `active` anak-angkat record should make `isSubscribed` true for "1 sesi persekolahan"; until decided the prototype grants nothing. | S6 promise (C7). | Requested (decision) |
| XR-M21-06 | M24 | Confirm the meaning of channel `mlm` "Via Agent" (INFERRED: a Duta brought the sponsor) and whether an agent reference must be stored; M21 stores only the channel today. | C8. | Requested (confirmation only) |
| XR-M21-07 | Global shell (design/shells.md) | SHA group "Pengguna": "Penajaan" (`fa-handshake`), "Anak Angkat" (`fa-child`), "Permohonan" (`fa-file-alt`) after M02's items with active states; SHA bottom nav "Penaja" (`fa-handshake`); SHU "Mohon Keluarga Angkat" (already in `user-nav.ts`, student / admin); header titles with dynamic subtitles (§2); S6 header "Mohon Keluarga Angkat" (DV-M21-06). | Shell renders the entries. | Requested |
| XR-M21-08 | ui-ux-designer (design-system §6) | Add icon rows for `fa-hands-helping`, `fa-piggy-bank`, `fa-utensils` (S7 category tiles; see §10.1). | The icon guard fails on names without a row. | **Applied** (design-system v1.9: `HandHelping`, `PiggyBank`, `Utensils`) |
| XR-M21-09 | M08 | Confirm the "Jadi Penaja" CTA (`fa-heart`) targets `/sponsor/register` (M21 public route). | Entry link (FN-M21-1.1.6). | Requested (confirmation only) |
| XR-M21-10 | M22 | No e-mail or push notification is sent for sponsor registration, sponsor status changes, applications or sponsorships (D14: simulated log only, DV-M21-14). | Scope. | Requested (confirmation only) |

### 6.13 Test hooks (dev / test builds only)

`mock.reset()`; `mock.setUser(id)`; `__mock.setNow(iso)`; `mock.loadFixture('m21-many' | 'm21-approved' | 'm21-pending')`; `mock.sponsorship.mailLog()` returns the simulated e-mail notices (`{to, sponsorId, status, at}`) recorded by BR-M21-07 (D14; no e-mail leaves the prototype).

---

## 7. Mock API endpoints

Base `/api`; envelope and error format of SRS.md §7. Auth: **AD** admin; **U** any signed-in user; **P** public (guest or signed-in); **SP** approved sponsor. Guest → `401` (except P); wrong role → `403`; unknown ids → `404`. Every mutation requires the CSRF header (SEC-M21-04).

| # | Method | Path | Auth | Mut. | Request | Response (data) | Errors | Live equivalent |
|---|---|---|---|---|---|---|---|---|
| 1 | GET | `/api/admin/sponsors` | AD | no | `search?, status?, category?, page?` | `{data: SponsorRow[] (≤ 20), meta, stats: SponsorStats}` | 401, 403 | GET `/admin/sponsors` |
| 2 | GET | `/api/admin/sponsors/:id` | AD | no | — | `SponsorDetail` | 401, 403, 404 | GET `/admin/sponsors/{id}/edit` |
| 3 | POST | `/api/admin/sponsors` | AD | yes | sponsor fields | 201 `{id}` | 401, 403, 422 | POST `/admin/sponsors` |
| 4 | PUT | `/api/admin/sponsors/:id` | AD | yes | sponsor fields | `SponsorDetail` | 401, 403, 404, 422 | PUT `/admin/sponsors/{id}` |
| 5 | POST | `/api/admin/sponsors/:id/reactivate` | AD | yes | — | `{status: 'APPROVED'}` | 401, 403, 404, 409 | POST `/admin/sponsors/{id}/reactivate` |
| 6 | POST | `/api/admin/sponsors/:id/approve` | AD | yes | — | `{status: 'APPROVED'}` | 401, 403, 404, 409 | not observable (PROPOSED) |
| 7 | POST | `/api/admin/sponsors/:id/reject` | AD | yes | — | `{status: 'REJECTED'}` | 401, 403, 404, 409 | not observable (PROPOSED) |
| 8 | GET | `/api/admin/anak-angkat` | AD | no | `status?, page?` | `{data: AnakAngkatRow[] (≤ 20), meta, stats, tabs, sponsorOptions: [{id, name}]}` | 401, 403 | GET `/admin/anak-angkat` |
| 9 | GET | `/api/admin/anak-angkat/cari-pelajar` | AD | no | `q` (≥ 2 characters) | `[{name, email, school}]` (`school` = name or null; ≤ 10, PROPOSED limit) | 401, 403 | GET `/admin/anak-angkat/cari-pelajar?q=` |
| 10 | POST | `/api/admin/anak-angkat/assign` | AD | yes | `{sponsorId, studentEmail, studentCategory?, channel}` | 201 `{id}` | 401, 403, 422 | POST `/admin/anak-angkat/assign` |
| 11 | POST | `/api/admin/anak-angkat/:id/status` | AD | yes | `{status}` (graduated or withdrawn) | `{status}` | 401, 403, 404, 409, 422 | POST `/admin/anak-angkat/{id}/status` |
| 12 | GET | `/api/admin/anak-angkat/permohonan` | AD | no | `status?, page?` | `{data: ApplicationRow[] (≤ 20), meta, tabs}` | 401, 403 | GET `/admin/anak-angkat/permohonan` |
| 13 | POST | `/api/admin/anak-angkat/permohonan/:id/lulus` | AD | yes | — | `{status: 'approved'}` | 401, 403, 404, 409 | POST `…/permohonan/{id}/lulus` |
| 14 | POST | `/api/admin/anak-angkat/permohonan/:id/tolak` | AD | yes | — | `{status: 'rejected'}` | 401, 403, 404, 409 | POST `…/permohonan/{id}/tolak` |
| 15 | POST | `/api/mohon-keluarga-angkat` | U | yes | `{studentEmail, studentCategory, familyIncomeRange?, reason}` | 201 `{id}` | 401, 422 | POST `/mohon-keluarga-angkat` |
| 16 | POST | `/api/sponsor/register` | P | yes | organisation, contact, address and account fields | 201 `{sponsorId}` | 422 | POST `/sponsor/register` |
| 17 | GET | `/api/sponsor/anak-angkat` | SP | no | `page?` | `{sponsor: {id, name}, data: AnakAngkatRow[], meta}` | 401, 403 | not observable (PROPOSED) |
| 18 | GET | `/api/sponsor/pool` | SP | no | `page?` | `{data: ApplicationRow[], meta}` (no applicant data) | 401, 403 | not observable (PROPOSED) |
| 19 | POST | `/api/sponsor/pool/:applicationId/taja` | SP | yes | — | 201 `{anakAngkatId}` | 401, 403, 404, 409 | not observable (PROPOSED) |

Repository contract (`@/modules/m21-sponsorship/mock`): `sponsors.list(filter, page)`, `sponsors.stats()`, `sponsors.get(id)`, `sponsors.options()`, `sponsors.transition(id, action)`, `anakAngkat.list(status, page)`, `anakAngkat.stats()`, `anakAngkat.tabs()`, `anakAngkat.assign(…)`, `anakAngkat.close(id, status)`, `fosterApplications.list(status, page)`, `fosterApplications.tabs()`, `fosterApplications.submit(…)`, `fosterApplications.review(id, action)`, `sponsorship.sponsorSummary()`, `sponsorship.sponsorForUser(userId)`, `sponsorship.taja(applicationId, sponsorId)`.

---

## 8. States & messages

### 8.1 Observed copy (exact)

- **S1:** "Jumlah", "Menunggu", "Diluluskan", "Ditolak", "Digantung", "{n} penaja dijumpai", "Tambah Penaja", "Carian", "Nama, email...", "Status", "Semua Status", "Kategori", "Semua Kategori", "Cari", "Reset", columns "#", "Organisasi", "Kategori", "Pegawai", "Status", "Tarikh", "Tindakan", "-", "Lihat", "Edit", "Tiada penaja dijumpai", pager "« Previous", "Next »", "Showing 0 of 6 results", "1".
- **S2 / S3:** "Kembali ke Senarai Penaja", "Maklumat Organisasi", "Nama Organisasi *", "cth: Kedai Buku Popular", "Kategori *", "Penerangan", "Penerangan ringkas organisasi...", "Tagline", "cth: Membaca Jambatan Ilmu", "Website", "https://example.com", "URL Logo", "https://example.com/logo.png", "No. Pendaftaran (SSM/ROC)", "Maklumat Pegawai Perhubungan", "Nama Pegawai", "Jawatan", "Email", "Telefon", "Alamat", "Bandar", "Negeri", "Poskod", "Tambah Penaja", "Batal", "Status", "Hadiah", "Tarikh Daftar", "Kemaskini Penaja", "Status Penaja:", "(SUSPENDED)", "Aktifkan Semula", confirm "Aktifkan semula penaja ini?".
- **S4:** "Jumlah Penaja", "Pelajar Aktif Ditaja", "Graduated", "Withdrawn", "Assign Anak Angkat", "Penaja", "Pilih Penaja", "Cari Pelajar (nama/email)", "Taip nama atau email...", "Kategori", "-", "B40", "Asnaf", "Yatim", "OKU", "Saluran", "Direct", "Via Agent", "Assign", "Semua ({n})", "Aktif ({n})", "Graduated ({n})", "Withdrawn ({n})", "Expired ({n})", columns "#", "Penaja", "Pelajar", "Kategori", "Saluran", "Status", "Tarikh", "Aksi", "Active", "Graduate", "Tarik", "Tiada rekod".
- **S5:** "Menunggu", "Dalam Pool", "Ditaja", "Ditolak", columns "#", "Pelajar", "Pemohon", "Kategori", "Sebab", "Status", "Aksi", "parent", "student", "Pending", "Lulus", "Tolak", confirm "Tolak permohonan ini?".
- **S6:** discovery §2.6 and URS FN-M21-4.2.1–4.2.6 (all copy exact, including the 5 examples and the info box).
- **S7:** discovery §2.7 and URS FN-M21-5.1.1–5.1.5, alert "Sila pilih kategori penaja.", "Menghantar..."; footer order "Sudah ada akaun?" "Log Masuk" " · " "Daftar Sebagai Pelajar", then "Kembali ke Laman Utama".
- **S4 student-search row (SOURCE-DERIVED template):** "{name}" / "{e-mail}" + " · {school}" when the student has a school.
- **Global pages (M01):** 404 "404", "🔍", "Halaman Tidak Dijumpai", "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?", "Halaman Utama", "Mula Latihan"; 403 "403", "🚫", "Akses Ditolak", "Anda tidak mempunyai kebenaran untuk mengakses halaman ini. Sila log masuk dengan akaun yang betul atau hubungi pentadbir.", "Halaman Utama", "Log Masuk".

### 8.2 PROPOSED COPY and PROPOSED behaviour (reported at G1 2026-09-27; identical to URS OQ-M21-13; the portal rows (OQ-M21-01, "Bina minimum") and the pending-sponsor actions row (OQ-M21-02, Luluskan / Tolak only) are approved at G1 and stay labelled PROPOSED)

| Item | PROPOSED value | Reason |
|---|---|---|
| Sponsor portal P1 / P2 | P1 header "Anak Angkat Saya" / {organisation}, columns "Pelajar", "Kategori", "Status", "Tarikh", empty "Tiada rekod", link "Pool Pelajar"; P2 header "Pool Pelajar" / "Pilih pelajar untuk ditaja", columns "Pelajar", "Kategori", "Sebab", button "Taja" (`fa-handshake`), confirm "Taja pelajar ini?", empty "Tiada pelajar dalam pool"; tabs "Anak Angkat Saya - PRESTASIPLUS", "Pool Pelajar - PRESTASIPLUS"; `/sponsor` and `/sponsor/rewards` → P1 | OQ-M21-01 |
| Sponsor landing | `/sponsor` (XR-M21-02) | OQ-M21-01, C5 |
| Pending sponsor actions | "Luluskan" (`fa-check`) + "Luluskan penaja ini?"; "Tolak" (`fa-times`) + "Tolak penaja ini?" | OQ-M21-02 |
| Validation messages | V-M21-01…04 | OQ-M21-03 |
| S6 success notice | green notice above the form: "Permohonan anda telah dihantar. Admin akan menyemak permohonan dalam 1-3 hari bekerja." | OQ-M21-03 |
| S7 success panel | the card shows `fa-check-circle` "Pendaftaran Berjaya!", "Permohonan penaja anda telah dihantar dan akan disemak oleh pentadbir PRESTASIPLUS." and the button "Log Masuk" → `/login` | OQ-M21-03 |
| Landing after admin actions | S1 (create, update), S3 (reactivate, approve, reject), S4 same tab (assign → "Semua", graduate, withdraw), S5 same tab (lulus, tolak); no flash text | OQ-M21-03 |
| Student search | only the scope (students only; name or e-mail contains) and the limit (≤ 10 rows) — the row itself is SOURCE-DERIVED (§8.1) | OQ-M21-04 |
| Status card for other statuses | "{label} ({code})" and dot colour for PENDING / APPROVED / REJECTED (INFERRED from SUSPENDED) | AUD-M21-06 |
| Badges of unobserved statuses | "Graduated", "Withdrawn", "Expired", "Approved", "Matched", "Rejected" (ucfirst); colours INFERRED | OQ-M21-05 |
| S5 pending empty text | "Tiada permohonan menunggu" | DV-M21-08 pattern |
| Page size | 20 (S1, S4, S5) | OQ-M21-09 |
| E-mail notices | simulated log only (D14) | DV-M21-14 |

### 8.3 Loading and errors

Data views use the shell loading behaviour; a failed request shows the M01 global error convention; unknown ids render the global 404 page; non-sponsors on the portal see the global 403 page; confirms and the S7 category alert are browser dialogs as live. No M21-specific loading or error copy exists on live.

---

## 9. Permissions matrix

| Route / endpoint | Admin | Pelajar | Ibu Bapa | Guru | Admin Sekolah | PPD / JPN | Penaja (approved) | Penaja (other status) | Guest |
|---|---|---|---|---|---|---|---|---|---|
| S1–S5, redirect, #1–#14 | ✓ (OBSERVED) | → `/dashboard`, 403 | → landing, 403 | → landing, 403 | → landing, 403 | → landing, 403 | → landing, 403 | → landing, 403 | `/login` |
| S6, #15 | ✓ (OBSERVED) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | `/login` |
| Menu "Mohon Keluarga Angkat" | ✓ | ✓ (live menu) | — | — | — | — | — | — | — |
| S7, #16 | ✓ (OBSERVED, no redirect) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (OBSERVED) |
| P0–P2, #17–#19 | 403 page (OBSERVED) | 403 page | 403 page | 403 page | 403 page | 403 page | ✓ (PROPOSED) | 403 page (PROPOSED) | `/login` (OBSERVED) |

Admin and guest behaviour OBSERVED; every other cell INFERRED or PROPOSED (provisional, OQ-M21-01 / 07).

---

## 10. Responsive behaviour

Measured on live by `tools/jobs/M21-measure.js` (snapshot `layout`); the rebuild keeps these layouts except the fixes of DV-M21-05 / 07. Every row: no horizontal page scroll (`scrollWidth ≤ clientWidth`), no content text below 12 px.

| Screen | 375 | 768 | 1280 |
|---|---|---|---|
| S1 | stats 2 columns; table (≈ 543 px) scrolls in its card | stats 5; table (≈ 832 px) scrolls in its card | stats 5; table fits |
| S2 / S3 | form 1 column, address 1; S3 status card wraps (DV-M21-05) | 2 columns, address 3 | 2 columns, address 3 |
| S4 | stats 2; tabs wrap (DV-M21-05); table (≈ 702 px) scrolls in its card; sponsor category line, student line, badges, buttons and search-row second line ≥ 12 px (live 10 px at every width) | stats 4; table fits | stats 4; table fits |
| S5 | tab cards 2; table (≈ 777 px) scrolls in its card; both student-cell lines, badges, "Lulus" / "Tolak" ≥ 12 px (live 10 px at every width) | tab cards 4; table scrolls in its card | tab cards 4; table fits |
| S6 | single column; H1 24 px | single column centred (max ≈ 670 px) | same |
| S7 | tiles 2 columns; H1 24 px; the 13 tile labels, 3 step pills and 4 footer texts ≥ 12 px (live 10 px) | tiles 3; H1 48 px | tiles 3; H1 48 px |
| P1 / P2 (PROPOSED) | table scrolls in its card | same | table fits |
| 404 / 403 | standalone M01 pages | same | same |

Admin shell: sidebar drawer below `lg`, bottom nav with "Penaja" and "Lagi"; user shell as M01.

### 10.1 Visual fidelity — icons (design-system v1.9 §6)

| FA name (live) | Where | Lucide (design-system §6) |
|---|---|---|
| `fa-handshake` | SHA "Penajaan", bottom nav "Penaja", S7 tile "Koperasi", P2 "Taja" | `Handshake` |
| `fa-child`, `fa-file-alt` | SHA "Anak Angkat", "Permohonan" | `Baby` (approx), `FileText` |
| `fa-hand-holding-heart` | SHU "Mohon Keluarga Angkat" | `HeartHandshake` |
| `fa-plus-circle`, `fa-plus`, `fa-user-plus` | "Tambah Penaja", "Assign", "Assign Anak Angkat" | `CirclePlus`, `Plus`, `UserPlus` |
| `fa-search`, `fa-times` | "Cari", "Reset", "Tolak" | `Search`, `X` |
| `fa-ban`, `fa-eye`, `fa-edit` | S1 status badge, "Lihat", "Edit" | `Ban`, `Eye`, `SquarePen` |
| `fa-arrow-left`, `fa-arrow-right` | back links, S7 "Kembali" / "Seterusnya" | `ArrowLeft`, `ArrowRight` |
| `fa-building`, `fa-user-tie`, `fa-map-marker-alt` | S2 / S3 sections; S1 category; S7 pill and tile | `Building`, `UserRound` (approx), `MapPin` |
| `fa-save`, `fa-play-circle`, `fa-check` | "Kemaskini Penaja", "Aktifkan Semula", "Lulus", "Luluskan" | `Save`, `CirclePlay`, `Check` |
| `fa-paper-plane`, `fa-lightbulb` | "Hantar Permohonan", S6 examples | `Send`, `Lightbulb` |
| `fa-user`, `fa-lock`, `fa-eye-slash`, `fa-info-circle`, `fa-circle-notch`, `fa-home` | S7 pills, eye toggle, note, loading, footer | `User`, `Lock`, `EyeOff`, `Info`, `LoaderCircle`, `House` |
| `fa-landmark`, `fa-university`, `fa-graduation-cap`, `fa-users`, `fa-book-reader`, `fa-laptop-code`, `fa-chalkboard-teacher` | S7 category tiles | `Landmark`, `Landmark` (approx), `GraduationCap`, `Users`, `BookOpenText`, `Laptop` (approx), `Presentation` |
| `fa-check-circle` | S7 success panel (PROPOSED) | `CircleCheck` |
| `fa-heart` | M08 "Jadi Penaja" (owned by M08) | `Heart` |
| `fa-circle` | S6 banner (M16, excluded) | `Circle` |
| `fa-toggle-on` (blue) | S3 status card, before "Status Penaja:" | `ToggleRight` |
| `fa-hands-helping` | S7 tile "Pertubuhan Bukan Kerajaan" | `HandHelping` (added in v1.9, XR-M21-08 applied) |
| `fa-piggy-bank` | S7 tile "Bank / Institusi Kewangan" | `PiggyBank` (added in v1.9) |
| `fa-utensils` | S7 tile "Restoran / F&B" | `Utensils` (added in v1.9) |

---

## 11. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-M21-01 | Performance: every M21 endpoint answers from the mock within the configured latency; lists hold ≤ 20 rows per request; the student search is debounced 300 ms and needs ≥ 2 characters. |
| NFR-M21-02 | Determinism: seeds, ids and figures are identical for the same clock and actions (ADR-0006). |
| NFR-M21-03 | Localisation: copy as live (BM with the English terms of URS §0); dates per BR-M21-17 in MYT. |
| NFR-M21-04 | Accessibility: replicates live (D10) — native confirm and alert dialogs, labelled fields, the tile buttons and eye buttons as live; no enhancement. |
| NFR-M21-05 | Responsive: §10 at 375 / 768 / 1280, no horizontal page scroll (CLAUDE.md §7). |
| NFR-M21-06 | Privacy: fictitious people and contact data (DV-M21-12); student names, e-mails, family income and reasons only on admin screens (S4, S5) and, for pooled students, to approved sponsors without applicant data (P2). |

### 11.1 Security notes (backend phase; **security-engineer review required** — authentication (public registration), personal data of minors, new external input)

| ID | Risk | Requirement for the rebuild / backend |
|---|---|---|
| SEC-M21-01 | **Public account creation** (S7, #16): spam, bots, e-mail enumeration through "E-mel ini telah didaftarkan.". | Rate limit per IP, CAPTCHA or e-mail verification (backend), generic error wording decision at G4; pending sponsors get no portal access (BR-M21-20). |
| SEC-M21-02 | **Password handling** (S7): minimum 6 characters on live. | Hash with a slow algorithm; never log; backend recommendation: raise the minimum (not on live, not built). |
| SEC-M21-03 | **Student lookup** (#9) returns names and e-mails of minors. | Admin only; ≥ 2 characters; ≤ 10 rows; no other fields; audit log. |
| SEC-M21-04 | **CSRF** on every form (live forms carry `_token`). | Every mutation requires the CSRF token; `SameSite` cookies. |
| SEC-M21-05 | **Stored XSS / unsafe URLs** in organisation fields, website, logo URL and reasons written by guests or any user. | Store plain text; render escaped; accept only `http(s)://` URLs; never load `logoUrl` server-side (SSRF); no HTML in reasons. |
| SEC-M21-06 | **IDOR** on the portal and review actions (sequential ids). | #17–#19 scoped to the viewer's sponsor; admin endpoints check `role = admin` server-side. |
| SEC-M21-07 | **Sensitive family data** (reason, income, category B40 / Asnaf / Yatim / OKU) of minors. | Admin-only S5; P2 shows the reason to approved sponsors only (PROPOSED) — confirm at G4; cap stored reason length; PDPA retention policy (backend). |
| SEC-M21-08 | **Applying on behalf of any registered student** by e-mail (S6). | Record the applicant and role; rate limit; admin review before pooling (as live). |
| SEC-M21-09 | **Status changes** (reactivate, approve, reject, lulus, tolak, graduate, withdraw, taja). | Admin / approved sponsor only; transition checks (V-M21-07); audit log (who, when, record, from → to). |
| SEC-M21-10 | **No confirm on "Lulus", "Graduate", "Tarik"** (live, replicated). | Kept (D9: working as designed); backend audit log allows correction. |

---

## 12. E2E test scenarios

Every scenario runs on the three Playwright projects mobile 375×812, tablet 768×1024 and desktop 1280×800 (master SRS §10); a width-specific step names its width and the scenario still runs on all three. Default user: the admin (`mock.setUser(1)`); clock: the **project clock 2026-09-25T15:40:00+08:00**. Values are the seed of §6.11. **Provisional** scenarios assert INFERRED or PROPOSED behaviour. E-mail scenarios assert `mock.sponsorship.mailLog()` only (D14).

Provisional: 03, 09, 10, 17, 22, 25, 28, 30, 31, 36, 37, 38, 39, 40, 43, 44, 45, 50, 51, 56, 57, 58, 59, 60, 61, 64, 65, 66, 68 (29 of 68)

| ID | Scenario | FR | AC | Provisional |
|---|---|---|---|---|
| E2E-M21-01 | Admin at 1280 on S1: group "Pengguna" open, "Penajaan" active, "Anak Angkat" and "Permohonan" links; S3 "Penajaan" active; S4 "Anak Angkat" active; S5 "Permohonan" active. | 01 | 01.1 | no |
| E2E-M21-02 | Admin at 375 on S1: bottom nav "Penaja" → `/admin/sponsors`. | 01 | 01.2 | no |
| E2E-M21-03 | User menu "Mohon Keluarga Angkat" between "Pembetulan" and "Penguasaan" for admin and pelajar; absent for guru. | 02 | 01.3 | yes |
| E2E-M21-04 | S1–S5 admin shell; S6 user shell with "LIVE:", "MAIN", "DAFTAR" hidden; S7 without sidebar, header or bottom nav. | 03 | 01.4 | no |
| E2E-M21-05 | Guest on `/register` clicks "Daftar sebagai Penaja" → S7 with "Pendaftaran Penaja". | 04 | 01.5 | no |
| E2E-M21-06 | Headers and tab titles of S1, S2, S4, S5 (AC-02.1). | 05, 06 | 02.1 | no |
| E2E-M21-07 | S3 #6 / #11 subtitles and tab; S6 header "Mohon Keluarga Angkat" (not "Dashboard") and tab; S7 tab. | 05, 06 | 02.2 | no |
| E2E-M21-08 | Guest: the seven protected routes → `/login`; `/sponsor/register` renders; admin opens `/sponsor/register` → renders, no redirect. | 07 | 03.1, 03.5 | no |
| E2E-M21-09 | Pelajar opens the four admin routes → `/dashboard`; `GET /api/admin/sponsors` → 403. | 08 | 03.2 | yes |
| E2E-M21-10 | Pelajar and ibubapa open S6 → renders. | 09 | 03.3 | yes |
| E2E-M21-11 | Admin opens `/sponsor`, `/sponsor/anak-angkat`, `/sponsor/anak-angkat/pool`, `/sponsor/rewards` → 403 page copy and tab. | 10 | 03.4 | no |
| E2E-M21-12 | `/admin/sponsors/999999/edit`, `/admin/anak-angkat/permohonan/1` and every probed route of URS §1 → 404 copy. | 11 | 04.1 | no |
| E2E-M21-13 | `/admin/anak-angkat/2`, `/create`, `/pool`, `/sponsors`, `/sponsor/profile` → 404; "Oops! An Error Occurred" absent. | 12 | 04.2 | no |
| E2E-M21-14 | S1 row #11 "Lihat" → `/admin/sponsors/11/edit` (S3 #11), "Ralat Pelayan" absent; row #6 "Edit" and "Lihat" hrefs and targets; `/admin/sponsors/999999` → 404. | 13 | 04.3, 07.1 | no |
| E2E-M21-15 | Dates "31/03/2026" and "06/02/2026" on S1, S3 #6, S4. | 14 | 05.1 | no |
| E2E-M21-16 | Labels: S4 "B40", "Direct", "Active", tab labels, option "Via Agent", sponsor line "Syarikat Swasta" (no "SYARIKAT_SWASTA"); S5 "Pending", "student", "parent"; S3 strip "Digantung" (no "SUSPENDED") and card "(SUSPENDED)". | 15, 29 | 05.2 | no |
| E2E-M21-17 | Seed: no pager on S1, S4, S5; `?page=2` → "6 penaja dijumpai", "Tiada penaja dijumpai", "« Previous", "Next »", "Showing 0 of 6 results", "1"; fixture `m21-many`: 20 rows + pager keeping `status=SUSPENDED`. | 16 | 05.3 | yes (fixture part) |
| E2E-M21-18 | Latency 2 s → loading then S1 table; fault on #1 → M01 error convention. | 17 | 05.4 | no |
| E2E-M21-19 | S1 cards 6 / 0 / 0 / 0 / 6, count line, "Tambah Penaja" → S2, filter controls and options, no "Reset". | 19, 20, 21 | 06.1 | no |
| E2E-M21-20 | S1 table columns, order #11, #6–#10, row #11 and row #6 contents. | 23, 24 | 06.2 | no |
| E2E-M21-21 | Filters: Digantung / `?status=suspended` 6; Menunggu, Diluluskan, Ditolak 0 + "Tiada penaja dijumpai"; Syarikat Swasta 6; Individu 0; "Kedai" 1; "zzqxv" 0; cards unchanged; values kept; "Reset" shown and → `/admin/sponsors`. | 19, 20, 21, 22, 25 | 06.3 | no |
| E2E-M21-22 | Search "sponsor3" → #8 only. | 22 | 06.4 | yes |
| E2E-M21-23 | S2 layout: back link, every section, field, placeholder, category options (13, first "Individu / Peribadi", no empty), "Negeri" text input, buttons; "Batal" and back link → S1, nothing created. | 26 | 08.1, 08.4 | no |
| E2E-M21-24 | S2 empty name / website "abc" / contact e-mail "abc" → browser check stops the submit; 6 sponsors remain. | 26 | 08.2 | no |
| E2E-M21-25 | S2 create "Syarikat Contoh Sdn Bhd" / "Syarikat Teknologi" → S1 "7 penaja dijumpai", 7 / 0 / 1 / 0 / 6, row #12 first "Diluluskan" "25/09/2026"; S4 select lists it; M17 "Jumlah Penaja" 7 and "1 Aktif". | 27 | 08.3 | yes |
| E2E-M21-26 | S3 #6 prefilled values, no placeholders, strip "Digantung" / "0" / "06/02/2026", buttons. | 28, 29 | 09.1 | no |
| E2E-M21-27 | S3 #11 fictitious officer and address values and "31/03/2026". | 28, 29 | 09.2 | no |
| E2E-M21-28 | S3 #6 tagline "Membaca Jambatan Ilmu" + "Kemaskini Penaja" → S1; S3 #6 shows it; status and S1 cards unchanged. | 30 | 09.3 | yes |
| E2E-M21-29 | S3 #6 status card copy; "Aktifkan Semula" → confirm "Aktifkan semula penaja ini?"; Cancel changes nothing. | 31 | 10.1 | no |
| E2E-M21-30 | Confirm reactivate #6 → "Diluluskan" "(APPROVED)", no button; S1 6 / 0 / 1 / 0 / 5; S4 select lists "Kedai Buku Popular"; M17 "1 Aktif"; mail log +1 (D14). | 31, 66 | 10.2 | yes |
| E2E-M21-31 | Fixture `m21-pending`: S3 "Menunggu" "(PENDING)" with "Luluskan" / "Tolak"; approve → "Diluluskan"; second pending sponsor reject → "Ditolak", no action. | 32 | 10.3 | yes |
| E2E-M21-32 | S4 cards 1 / 1 / 0 / 0 and tabs "Semua (1)" (active), "Aktif (1)", "Graduated (0)", "Withdrawn (0)", "Expired (0)". | 33, 37 | 11.1 | no |
| E2E-M21-33 | S4 table columns and row #2 content with "Graduate" and "Tarik". | 38 | 11.2 | no |
| E2E-M21-34 | Tabs Graduated / Withdrawn / Expired → "Tiada rekod", cards 1 / 1 / 0 / 0, "Semua (1)"; Aktif → row #2. | 37, 38 | 11.3 | no |
| E2E-M21-35 | "Assign Anak Angkat" controls and options (select only "Pilih Penaja"). | 34 | 12.1 | no |
| E2E-M21-36 | Search: "H" → no request; "Hajar" + 300 ms → one request, dropdown includes a row "Nur Hajar Binti Demo" / "nurhajar@demo.test · SMK Demo Seri Putra" (≤ 10 rows); a student without a school shows the e-mail without " · "; click → "Nur Hajar Binti Demo (nurhajar@demo.test)". | 35 | 12.2 | yes |
| E2E-M21-37 | Fixture `m21-approved`: assign Kedai Buku Popular + Nur Hajar + Yatim + Via Agent → S4 2 / 2 / 0 / 0, "Semua (2)", row #3 first with "Via Agent", "25/09/2026". | 36 | 12.3 | yes |
| E2E-M21-38 | Assign with "Pilih Penaja" → browser check stops; with an approved sponsor and no student → PROPOSED message, nothing created. | 34, 36 | 12.4 | yes |
| E2E-M21-39 | "Graduate" on #2 (no confirm) → "Graduated", cards 1 / 0 / 1 / 0, tabs "Aktif (0)", "Graduated (1)", "Semua (1)". | 39, 66 | 13.1 | yes |
| E2E-M21-40 | Fresh seed: "Tarik" on #2 (no confirm) → "Withdrawn", cards 1 / 0 / 0 / 1. | 39 | 13.2 | yes |
| E2E-M21-41 | S5 tabs 3 / 0 / 0 / 0 (Menunggu current), columns, rows #3, #2, #1. | 40, 41 | 14.1 | no |
| E2E-M21-42 | S5 rows #1, #2, #3 contents incl. school line, applicant role and the two truncated reasons. | 41 | 14.2 | no |
| E2E-M21-43 | Tabs Dalam Pool / Ditaja / Ditolak → "Tiada permohonan dalam pool" / "ditaja" / "ditolak"; counts unchanged. | 44 | 14.3 | yes (copy) |
| E2E-M21-44 | "Lulus" #1 (no confirm) → "Menunggu 2", "Dalam Pool 1"; Dalam Pool tab lists #1 "Approved", no action; after "Tolak" #3 and a "Taja" (E2E-61 steps) the Ditolak and Ditaja tabs show "Rejected" / "Matched" rows without actions. | 42, 45, 66 | 15.1, 14.4 | yes |
| E2E-M21-45 | "Tolak" #3 → confirm "Tolak permohonan ini?"; Cancel no change; OK → "Ditolak 1", #3 "Rejected". | 43 | 15.2 | yes (OK part) |
| E2E-M21-46 | S6 hero, fields, placeholders, hint and "sini" → `/register`, both selects' options. | 46 | 16.1 | no |
| E2E-M21-47 | S6 example 2 click → textarea equals the text with "• ", no request; example 4 replaces it. | 47 | 16.2 | no |
| E2E-M21-48 | S6 note, button and info-box copy incl. "Guru / Kaunselor — mohon untuk pelajar yang dikenal pasti memerlukan". | 48 | 16.3 | no |
| E2E-M21-49 | S6 empty e-mail / category / reason or e-mail "abc" → browser check stops; S5 still "Menunggu 3". | 49 | 17.1 | no |
| E2E-M21-50 | Pelajar submits `pelajar@demo.test`, OKU, "Bawah RM1,000" → success notice, empty form, S5 "Menunggu 4" row #4 "student" "OKU"; ibubapa submits `pelajar2@demo.test` B40 → row with "parent". | 49 | 17.2, 17.4 | yes |
| E2E-M21-51 | Pelajar submits `tiada.pelajar@demo.test` and `guru@demo.test` → PROPOSED e-mail message, nothing created. | 49 | 17.3 | yes |
| E2E-M21-52 | S7 step 1 content and tiles; "Seterusnya" without a tile → alert "Sila pilih kategori penaja.", step 1 stays; "Koperasi" → step 2, first bar green. | 50, 51 | 18.1 | no |
| E2E-M21-53 | S7 step 2 fields, 16 states; "Kembali" keeps values; "Seterusnya" with empty fields → step 3. | 52 | 18.2 | no |
| E2E-M21-54 | S7 step 3 fields, note, buttons; eye toggles type and icon on both password fields. | 53 | 18.3 | no |
| E2E-M21-55 | S7 footer links and targets. | 54 | 18.4 | no |
| E2E-M21-56 | S7 submit with step 2 empty → nothing created; login e-mail `penaja@demo.test` → "E-mel ini telah didaftarkan."; 5-character or mismatched password → password message; nothing created. | 55 | 19.1, 19.3, 19.4 | yes |
| E2E-M21-57 | S7 valid registration "Syarikat Ujian Demo" → "Menghantar...", success panel with "Log Masuk"; S1 7 / 1 / 0 / 0 / 6 with "Menunggu" row; M02 `?role=sponsor` 7. | 55 | 19.2 | yes |
| E2E-M21-58 | `penaja@demo.test` (sponsor #11 suspended) signs in and opens `/sponsor` → 403 page. | 56 | 20.1 | yes |
| E2E-M21-59 | After E2E-57 and approval, the new sponsor signs in → lands on `/sponsor/anak-angkat`; `/sponsor/rewards` → P1; `/sponsor/profile` → 404. | 57, 58 | 20.2 | yes |
| E2E-M21-60 | That sponsor: P1 "Tiada rekod"; P2 "Tiada pelajar dalam pool". | 59, 60 | 21.1 | yes |
| E2E-M21-61 | After admin "Lulus" #1: P2 lists #1 with "Taja"; confirm "Taja pelajar ini?" → P1 lists "Nur Hajar Binti Demo" "B40" "Active"; S5 "Dalam Pool 0", "Ditaja 1"; S4 2 / 2 / 0 / 0 with the new row "Direct". | 59, 60, 66 | 21.2 | yes |
| E2E-M21-62 | Store contents at the clock: 6 sponsors (6–11, SYARIKAT_SWASTA, SUSPENDED), 1 anak angkat (#2), 3 applications (#1–#3 pending B40). | 61, 62, 63 | 22.1 | no |
| E2E-M21-63 | M17 dashboard sponsor cards 6 / "0 Aktif" / 0 / 0 / 6 from `sponsorship.sponsorSummary()`; M02 `?role=sponsor` 6 users linked to 6–11. | 64 | 22.2 | no |
| E2E-M21-64 | S1 "Jumlah" 6 and S4 "Jumlah Penaja" 1; after E2E-37 steps (provisional assign) S4 2 and S1 still 6. | 33, 64 | 22.3 | yes |
| E2E-M21-65 | S3 "Hadiah" 0 on 6–11; after an assign, M19 entitlement of 5231 unchanged and M19 S1 payment count unchanged. | 65 | 22.4 | yes |
| E2E-M21-66 | S1–S7 (every S7 step), S3 #6 / #11, P1 / P2 at 375 / 768 / 1280: `scrollWidth ≤ clientWidth`; no content text below 12 px (incl. the S7 pills and footer, S4 / S5 student lines; P1 / P2 are PROPOSED). | 18 | 23.1 | yes |
| E2E-M21-67 | Grid columns per AC-23.2 at each width (S1, S2, S3, S4, S5, S6, S7) and in-card table scroll on S1 / S4 / S5. | 18 | 23.2 | no |
| E2E-M21-68 | Fixture `m21-approved` and prior steps: `POST #5` on sponsor #6 (`APPROVED`), `#13` on a rejected application, `#11` on a graduated record, `#19` on a pending application → `409 INVALID_STATE`, stores unchanged; seed: S4 row #2 "Active" while S1 row #11 "Digantung". | 66 | 22.5 | yes |

---

## 13. Open questions

Identical to URS §9 (OQ-M21-01 … OQ-M21-13). Non-blocking for G1: all — OQ-M21-01 (sponsor portal minimum; the user should confirm at G1 whether to build it now), OQ-M21-02 / 03 / 04 / 05 / 09 / 12 (PROPOSED minimum, reported at G1 via §8.2), OQ-M21-06 / 11 (replicated / not built), OQ-M21-07 (provisional non-admin behaviour), OQ-M21-08 (owner decisions through XR-M21-04 / 05 / 06), OQ-M21-10 (definition, Perlu pengesahan). Owner requests XR-M21-01…10 (§6.12) go through the XL gate; XR-M21-01 (M02 anchors, e-mails and the `school` field of the student search) and XR-M21-03 (M17 hand-over) must be applied before M21 build; XR-M21-08 (3 icon rows) is already applied in design-system v1.9.
