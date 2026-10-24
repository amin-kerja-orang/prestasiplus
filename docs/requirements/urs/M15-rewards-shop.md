# M15 — Rewards Shop & Redemption — User Requirements Specification

## 0. Document control

| Field | Value |
|---|---|
| Document | URS — M15 Rewards Shop & Redemption |
| Version | 1.6 |
| Date | 2026-10-03 |
| Status | **Approved (G1)** for S1–S9 — 2026-09-26 (v1.3). **S10/S11 (roles-matrix row L43; v1.4, audit fixes v1.5) — Approved (G1), 2026-10-02:** independent audit PASS ([L43-audit.md](../../qa/audit/L43-audit.md), AUD-L43-01…05 applied in v1.5, OQ-M15-14 closed); OQ-M15-13 and OQ-M15-16 decided by the Delivery Lead under the user's standing instruction (finish Session 5; follow the OQ-M15-01 user precedent). Audit round 1 FAIL → v1.1; round 2 PASS → v1.2; OQ-M15-01 answered by the user → v1.3. Fidelity deviations decided under user rule D9 and D10. Populated states that were never observed on live (queue actions, parent controls, the enabled mystery box and its result, draw cards, the "On" pill) remain SOURCE-DERIVED / INFERRED / PROPOSED and provisional until a live run is approved (OQ-M15-09). |
| Author | product-analyst (agent); data entities and mock API of the companion SRS by solution-architect (agent) |
| Source discovery | [M15-rewards-shop.md](../../discovery/M15-rewards-shop.md) (§1–§9, defects D-M15-1…13 in §8.2, §8.3 audit-lesson checklist, Q-M15-1…8, Appendices A–B); inventory [`inventory/M15/`](../../discovery/inventory/M15/) (`S1…S9-*.json`, `SHA-admin-shell.json`, `SHU-user-shell.json`, `_crawl.json`, `_summary.md`, **seed snapshot `_snapshot-2026-09-26.json`**, captured 2026-09-26 11:46 MYT; raw states `inventory/_raw/M15/`, 54 states); masked screenshots `docs/discovery/img/M15/` (31) |
| Source discovery (v1.4, row L43) | [L43-kedai-hadiah-digital.md](../../discovery/L43-kedai-hadiah-digital.md) (live probe 2026-10-02, admin session, GET only, Playwright lane 2); screenshots `docs/discovery/img/L43/` (`cikgu-hadiah-1280.png`, `-768.png`, `-375.png`). The probe was manual; the independent audit [docs/qa/audit/L43-audit.md](../../qa/audit/L43-audit.md) (2026-10-02, PASS) produced the automated computed-style and href dump of S10/S11 and added `cikgu-hadiah-saya-375.png`, `-768.png`, `-1280.png` (S11). |
| Companion SRS | [srs/M15-rewards-shop.md](../srs/M15-rewards-shop.md) |
| Related | **M14** (owner of the wallet: syiling, tokens, XP, ledger, conversion; `/admin/reward-control` incl. the cabutan admin; the legacy 11-item reward table; discovery `M14-gamification.md`; [M14 SRS](../srs/M14-gamification.md) v1.0 §6.13 answers XR-M15-01…08: 01/02/03/08 accepted, 06/07 closed (no budget, no dependency), 05 decided (DV-M15-14), 04 ownership decided (the 11-item syiling catalogue is M14 DATA-M14-17) with the shop source open for the user), M01 (User, guest redirect, 404 page with "Mula Latihan" → `/practice` per M01 DV-02, canonical accounts 1–11), M02 (users dataset and id policy; ParentStudentLink — parent 6 linked to students 2 and 4), M05 (hands practice coins to the M14 wallet, BR-09/BR-31; M15 does not touch M05), M13 (the neighbouring "Cikgu Alesa Tools" menu group), M16 (tournament banner), global shell / M23 ([design/shells.md](../../design/shells.md), DV-SH-03, DV-SH-04) |

**Change log**

| Version | Date | Change |
|---|---|---|
| 1.6 | 2026-10-03 | **As-built update after the G4 review (doc only; status stays Approved (G1)).** New deviation **DV-M15-20** (D9, unreadable text): S6 disabled box button text white → `#4b5563` on the unchanged `#d1d5db` (FN-M15-6.1.4, AC-M15-15.3, §7). Parent approve/reject (#15/#16) require the parent role: non-parents get 403, an unlinked child still 404 (FN-M15-8.1.7, new AC-M15-20.5, provisional). Failed actions show the shared generic copy "Ralat berlaku. Sila cuba lagi." (FN-M15-9.1.4). Backend-only security notes are in SRS §11.1 (SEC-M15-11…18). Counts: 107 ACs (41 provisional); functions, stories and coverage matrix unchanged. |
| 1.5 | 2026-10-02 | **L43 audit PASS — AUD-L43-01…05 applied; L43 additions Approved (G1).** AUD-01: DV-M15-19 now MEASURED (caption 9px, card labels 10px; identical at 375/768/1280; no longer conditional; FN-10.1.4). AUD-02: the labels are DOM mixed case "Token Anda" / "Syiling" rendered upper case by CSS; AC-22.2 and E2E-59 assert the rendered text (FN-10.1.3, EL-S10-003/005). AUD-03: new EL-M15-S11-005 (decorative "🎁" 48px above the empty text; FN-10.2.3, AC-23.1): S11 = 5 elements, S10/S11 = 24, M15 content 274/274 (262 mapped, 12 excluded). AUD-04: `?cat=flagship` (active chip "Mahkota", "Semua" plain) and `?cat=bogus` (200, same empty copy, no chip active) are OBSERVED; `ewallet`, `telco`, `entertainment` also seen; INFERRED/provisional tags dropped (FN-10.1.7, AC-22.5, AC-22.6; provisional ACs 42 → 40). AUD-05: S11 layout measured (title row one line, button right at all widths; §5). OQ-M15-14 closed (audit done). OQ-M15-13 and OQ-M15-16 decided by the Delivery Lead (S10/S11 empty for every account, populated states not built, murid view Perlu pengesahan, DV-M15-16 kept, "Tebusan Saya" is part of row L43). XR-M15-13 Applied (lead changed `user-nav.ts:455` to `/cikgu/hadiah`; DV-M15-18 applied). No AC added: 106 ACs, 40 provisional. |
| 1.4 | 2026-10-02 | **Roles-matrix row L43 "Kedai Hadiah Digital" (student shop at `/cikgu/hadiah` and "Tebusan Saya" at `/cikgu/hadiah/saya`).** New screens S10 and S11 (EP-M15-10, FT-M15-10.1…10.3, FN-M15-10.1.1…10.3.6, FN-M15-9.1.6/9.1.7), stories US-M15-22…25, ACs AC-M15-22.1…25.3, coverage matrix S10 (19 elements) and S11 (4 elements), deviations DV-M15-16…19 (caption rate, header titles, nav href fix, caption size), out-of-scope rows, open questions OQ-M15-13…16. Both screens replicate the observed empty state for every account (precedent OQ-M15-01; decided in v1.5, OQ-M15-13). The student-nav href `/kedai-hadiah` (404 on live) is corrected to `/cikgu/hadiah` — recorded as XR-M15-13 for the shell owner (SRS §6.10). Existing numbering and S1–S9 content unchanged. Counts: 10 epics, 22 features, 129 functions, 25 stories, 87 → 106 ACs (34 → 42 provisional). |
| 1.3 | 2026-09-26 | **Approved (G1).** User answered OQ-M15-01 ("ikut macam mana ada sekarang"): OQ-01 and XR-M15-04 closed; S5 replicates live (empty state for every account; activating a reward does not populate the shop; no shop catalogue source modelled). FN-5.1.5, DV-M15-03, §5, §8 and OQ-01 reworded from BLOCKED to the decided rule. Coverage 250/250, trace 0 errors. |
| 1.2 | 2026-09-26 | Audit round 2 PASS; minor R2-02 fixed: FN-M15-1.1.6 scoped to the sidebar (active icon loses its colour class, "Kedai Hadiah" also `icon-gift`; the drawer keeps the colour). Coverage 250/250, trace 0 errors. |
| 1.1 | 2026-09-26 | **Revision history — v1.1, audit round 1** (`docs/qa/audit/M15-audit.md`, FAIL 0/1/7). AUD-01: DV-M15-14 reversed to **Approved (D9)** — hint "1 token = RM1" (FN-3.1.6, AC-09.1, AC-21.4, §1, OQ-10). AUD-02: M14 SRS v1.0 answers recorded (Related, OQ-11; OQ-12 closed). AUD-05: the S5 empty-state rule kept and noted in OQ-01 (M14 wording aligned at XL batch 3). AUD-06: "Cabutan Bertuah" icon vs gradient badge pill, the active icon loses its colour, drawer icon colours (FN-1.1.1, 1.1.2, 1.1.6, AC-01.1, AC-01.5). AUD-07: "Pelaras Token" sends the raw trimmed text; mock parse with `parseInt` semantics (FN-2.6.5, AC-08.5). AUD-08: OQ-10 is the complete PROPOSED list. I1: S2 wrapper 680px at 768 (DV-M15-01). Deviations now 7 approved fixes, 6 rejected, 1 privacy, 1 open. Coverage re-run 250/250, 0 unmapped; trace 0 errors. |
| 1.0 | 2026-09-26 | First issue under D7 (fidelity), D8 (proven completeness), D9/D10 (deviation rule, accessibility and scope), D11/D12 (datasets, one owner per store) and the privacy-over-fidelity rule. §6 coverage matrix generated by script from the inventory JSON: 250/250 content elements covered (238 mapped, 12 excluded with reason), 0 unmapped; shells 579/579 accounted for. 15 deviation rows: 6 approved fixes, 7 rejected — replicate live, 1 privacy replacement, and DV-M15-03 (D-M15-3, shop catalogue source) kept open as OQ-M15-01. 9 epics, 19 features, 108 functions, 21 stories, 87 ACs (34 provisional). |

**Conventions** (same as M01–M13)
- Quoted UI copy is the exact live text. English or mixed words shown on live ("Tebusan Queue", "Pending Admin", "Delivered", "Cancelled", "Display Order", "Vendor SKU (optional)", "Image URL (optional)", "Delivery", "Manual (admin paste)", "API (auto, future)", "Instant", "catalog", "Kembali ke Catalog", "rare" / "epic" / "legendary", "On"/"Off", the Laravel pager "Showing … results", "« Previous", "Next »") are live copy and are kept. Where CSS upper-cases text, this is stated ("upper case by CSS").
- **OBSERVED** = seen on the live site (walk-through, inventory state, snapshot, screenshot). **SOURCE-DERIVED** = taken from page markup, stylesheet or script captured read-only, but the state itself was never rendered on live (e.g. the bulk prompts, the result-modal and card CSS). **INFERRED** = the most likely live behaviour, not observed. **UNVERIFIED** = live behaviour exists but could not be observed; nothing is asserted beyond the evidence. **PROPOSED** / **PROPOSED COPY** = a value, text or layout written for the rebuild; listed in §9 OQ-M15-10 for the Delivery Lead to report at G1. **BLOCKED** = not built until an open question is answered.
- **Provisional** = an AC or E2E that asserts behaviour not observed on live (INFERRED / UNVERIFIED) or a PROPOSED UI for an unobserved state. It is tagged and stays provisional until a live run with test accounts is approved (OQ-M15-09). Approved deviations that fix an **observed** state are not provisional; their PROPOSED copy is still listed for G1.
- **D-M15-n** = live defect of discovery §8.2. **Q-M15-n** = discovery open question. **DV-M15-nn** = fidelity deviation (§7); anything not listed there must match live. **SEC-M15-nn** = risk in live behaviour, replicated with dummy data (SRS §11.1). **XR-M15-nn** = request to another module (SRS §6.10).
- **Personal data.** The only personal data in M15 is the "Pelajar" column of `/admin/hadiah/tebusan` (a student name line and an e-mail line, masked in every discovery file; the snapshot tokenises the owners as `<student:1>`, `<student:2>`). Under the project privacy rule (CLAUDE.md §6) the rebuild shows **fictitious** students (DV-M15-15): users 3151 "Pelajar Demo Hadiah 1" and 3152 "Pelajar Demo Hadiah 2", anchors inside the M02 users dataset (XR-M15-09). Vendor and brand names in the catalogue (Roblox, Touch n Go, Hotlink …) are companies, not people, and are kept as observed.
- **Admin mirror vs test fixtures** (SRS §6.8). The default seed mirrors live exactly: 59 rewards with their live ids and values, all Off; 3 cancelled redemptions; 4 mystery boxes; no opening; no draw; the admin wallet 256 syiling / 0 token / 8 XP (M14). Other states exist only as **test-only fixtures** loaded by E2E hooks; every assertion on them is provisional.

---

## 1. Overview

M15 is the **digital rewards shop** of the platform: admins keep a catalogue of vouchers and top-ups priced in **tokens** (1 token = RM1 on every live reward; syiling become tokens at M14's tier rates), students redeem them, a parent approves rewards flagged for consent, and an admin fulfils each redemption by buying a code from a reseller and pasting it ("Beli kod dari reseller, paste kat sini untuk hantar kepada pelajar."). It also holds two token/syiling sinks for students: the **mystery box** (4 boxes that cost 2/5/10/25 tokens and pay out syiling and XP) and the **lucky draw** ("Cabutan Bertuah", tickets bought with syiling). The wallet itself (syiling, tokens, XP, the ledger and the syiling → token conversion) belongs to **M14**; M15 reads balances and asks M14 to debit or credit them (D12).

The TRACKER checklist has 5 routes; the crawl found **9 screens** (4 new routes); **v1.4 adds S10 and S11** from roles-matrix row L43 (the student-facing "Kedai Hadiah Digital", owner M15; see EP-M15-10; the 59-gift admin catalogue S1 and S10 share the category names, but S10 is a separate screen, not an alias of S5):

| # | Route | Tab title (exact live) | Shell · header title / subtitle (live → rebuild) | Admin outcome (observed) |
|---|---|---|---|---|
| S1 | `/admin/hadiah` (`?cat=`, `?page=`) | "Admin — Kedai Hadiah" | SHA · "Dashboard" / "Selamat datang, Admin" → "Admin — Kedai Hadiah", no subtitle (DV-M15-12) | 200; 59 rewards, all "Off" |
| S2 | `/admin/hadiah/tebusan` (`?status=`) (new) | "Admin — Tebusan Hadiah" | SHA · → "Admin — Tebusan Hadiah" | 200; 3 rows, all "❌ Dibatalkan" |
| S3 | `/admin/hadiah/baharu` (new) | "Tambah Hadiah" | SHA · → "Tambah Hadiah" | 200 |
| S4 | `/admin/hadiah/{id}/edit` (new) | "Edit Hadiah" | SHA · → "Edit Hadiah" | 200 for ids 1–59; unknown id → 404 |
| S5 | `/gamification/rewards` | "Kedai Hadiah" | SHU · "Dashboard" / "Selamat datang kembali" → "Kedai Hadiah" / "Selamat datang kembali" | 200; empty state, "Baki Token 🎫" 0 |
| S6 | `/gamification/mystery-box` | "Kotak Misteri — PRESTASIPLUS" | SHU · → "Kotak Misteri" / "Selamat datang kembali" | 200; 4 boxes, all "🔒 Token Tidak Cukup" |
| S7 | `/cabutan` | "Cabutan Bertuah - PRESTASIPLUS" | SHU · → "Cabutan Bertuah" / "Selamat datang kembali" | 200; empty, "256 🪙" |
| S8 | `/cikgu/kelulusan-hadiah` | "Kelulusan Hadiah — Ibu Bapa" | SHU · → "Kelulusan Tebusan Hadiah" / "Selamat datang kembali" | 200; both lists empty |
| S9 | `GET /admin/hadiah/{id}` | "An Error Occurred: Method Not Allowed" | framework page → global 404 page (DV-M15-08) | 405 |
| S10 (v1.4, L43) | `/cikgu/hadiah` (`?cat=`) | "Kedai Hadiah Digital" | SHU · "Dashboard" / "Selamat datang kembali" → "Kedai Hadiah Digital" / "Selamat datang kembali" (DV-M15-17) | 200; balance card 0 token / 256 syiling, 10 chips, empty "Tiada hadiah dalam kategori ini." |
| S11 (v1.4, L43) | `/cikgu/hadiah/saya` | "Tebusan Saya" | SHU · → "Tebusan Saya" / "Selamat datang kembali" (DV-M15-17) | 200; empty "Belum ada tebusan. …" |

Access outcomes probed (all the global 404 page): `/gamification/rewards/1`, `/gamification/rewards/history`, `/gamification/redemptions`, `/gamification/mystery-box/1`, `/gamification/mystery-box/history`, `/cabutan/1`, `/cabutan/sejarah`, `/admin/cabutan`, `/admin/mystery-box`, `/admin/hadiah/tebusan/1`, `/admin/hadiah/99999/edit`. L43 probes (v1.4, global 404 page): `/kedai-hadiah`, `/hadiah`, `/kedai`, `/cikgu/hadiah/1`. M15 therefore has **no detail page, no student redemption-history page and no mystery-box or cabutan admin page**; the cabutan admin is M14 S10 and the mystery-box configuration is not editable in the UI.

**Cross-module notes.** Owned elsewhere and not specified here: `/admin/reward-control` (M14 S10: cabutan admin, the legacy 11-item reward-cost table), `/gamification/convert` (M14 S12, the only source of tokens), `/guru/gamifikasi/kedai` and `/admin/gamifikasi/guru/tebusan` (M14 teacher shop and queue — a separate flow), the `/gamification` "Kedai Hadiah" link (M14 S11), the tournament banner on S5–S8 (M16), the shell header chips "256 koin / 8 mata / 1 hari 🔥" (M14 / shell).

---

## 2. Actors

| Role | Involvement in M15 | Verified |
|---|---|---|
| Admin | S1–S4 (catalogue, bulk actions, create/edit), S2 (queue; fulfils and cancels redemptions — the actions were never rendered, Q-M15-1); also opens S5–S8 in the user shell with its own wallet (256 syiling, 0 token). | OBSERVED (admin account); fulfilment INFERRED |
| Pelajar (student) | Spends tokens in the shop (S5) and the mystery box (S6), and syiling in the lucky draw (S7). The S5 copy ("Tebus token anda …") and the S2 "Pelajar" column name students as the redeemers. **v1.4 (L43):** the student's menu entry "Kedai Hadiah 🎁 DIGITAL" opens S10 (digital shop) with S11 "Tebusan Saya"; both show the observed empty state. | INFERRED (no student account; S5 populated state not built — user decision OQ-M15-01; S10/S11 student view: Perlu pengesahan, OQ-M15-16 decided) |
| Ibu Bapa (parent) | Approves or rejects redemptions of rewards flagged "Perlu kelulusan ibu bapa" for their linked children on S8 ("Anak anda nak tebus hadiah yang memerlukan kelulusan ibu bapa. Sila semak."; pill "Pending Ibu Bapa"). Links are M02's (admin-made). | INFERRED (no parent account; Q-M15-3) |
| Guru (teacher) | No M15 role: teacher rewards are M14's separate `/guru/gamifikasi/*` flow. S8 sits under the teacher-AI prefix `/cikgu/` but its copy addresses parents (DV-M15-05). | INFERRED |
| Admin Sekolah, Penaja, PPD, JPN | No evidence of involvement. | UNVERIFIED |
| Guest | Redirected to `/login` (M01 pattern; not probed in M15 discovery). | INFERRED |
| Students named in the queue | Subjects of the data (minors), shown to admins only. | — |

---

## 3. Functional breakdown (Epic → Feature → Function)

Built from the element inventory (`docs/discovery/inventory/M15/`) and the snapshot. "EL" lists inventory element IDs (prefix `EL-M15-`). Functions with EL "—" are behaviours (access, server rules, SOURCE-DERIVED / PROPOSED / BLOCKED states, deviations without an element).

### EP-M15-1 — Navigation, shell and access

**FT-M15-1.1 — Menu entries, titles and shells**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M15-1.1.1 | User-portal sidebar group "Pembelajaran": entry **"Cabutan Bertuah"** with the **icon** `fa-ticket` `text-fuchsia-500`, followed by a **separate badge pill "🎟️"** (`ml-auto`, `bg-gradient-to-r from-fuchsia-100 to-pink-100 text-fuchsia-700 text-[10px] font-bold rounded-full`) → `/cabutan` (the inventory text "Cabutan Bertuah 🎟️" concatenates label and badge). The mobile menu's "Pembelajaran" sheet (below 1024px) repeats the entry with the icon `fa-ticket text-fuchsia-500` and the same badge at `text-[9px]`. The badge holds only an emoji, so DV-M15-13 does not apply to it | SHU-061, 072, 073, 201, 202, 213, 214 | Admin (OBSERVED); others INFERRED | OBSERVED |
| FN-M15-1.1.2 | User-portal sidebar block under "Syiling & Token 🏆" (M14): **"Kedai Hadiah"** (`fa-gift` with the custom class `icon-gift`, no Tailwind colour class) → `/gamification/rewards`, **"Kelulusan Hadiah"** (`fa-shield-halved`, `text-amber-500`) → `/cikgu/kelulusan-hadiah`, **"Kotak Misteri"** (`fa-box-open`, `text-indigo-500`) → `/gamification/mystery-box`, in the live order "Tukar Token", "Cabaran Harian", "Kedai Hadiah", "Kelulusan Hadiah", "Marketplace", "Papan Pendahulu", "Pencapaian", "Kotak Misteri", "Rujuk Kawan" (the others are M14/M20). The mobile menu's "Gamifikasi" sheet lists "Kedai Hadiah" (drawer icon `fa-gift text-pink-500`) and "Kotak Misteri" but **not** "Kelulusan Hadiah" (live capture, replicated per shells.md §6 rule 4; unification is the shell owner's DV-SH-04, XR-M15-11) | SHU-084, 085, 089, 294, 295, 299, 303 | Admin; others INFERRED | OBSERVED |
| FN-M15-1.1.3 | User-portal sidebar group "Cikgu Alesa Tools": **"Admin Tebusan"** (`fa-cogs`, `text-slate-500`) → **`/admin/hadiah/tebusan`** (DV-M15-04; live `/admin/hadiah`); sidebar only (not in the live mobile menu) | SHU-093, 097 | Admin | OBSERVED + DV-M15-04 |
| FN-M15-1.1.4 | User-portal sidebar group "Admin": **"Urus Hadiah"** (`fa-gift`, `text-pink-500`) → `/admin/hadiah`; the same entry in the mobile menu | SHU-110, 116, 312 | Admin | OBSERVED |
| FN-M15-1.1.5 | Admin-panel sidebar: collapsible group **"Gamifikasi"** (`fa-gamepad`) › **"Kedai Hadiah"** (`fa-gift`) → `/admin/hadiah`, between "Transaksi" and "Gamifikasi Guru" (the other items are M14); the bottom-nav "Lagi" popover section "Gamifikasi" repeats "Kedai Hadiah" → `/admin/hadiah` | SHA-054, 060, 164, 168 | Admin | OBSERVED |
| FN-M15-1.1.6 | Active state: the admin-panel "Kedai Hadiah" item carries the active style on S1–S4 (OBSERVED on S2; the group's expansion follows the shell rule); in the user portal the active item is "Kedai Hadiah" on S5, "Kotak Misteri" on S6, "Cabutan Bertuah" on S7 and "Kelulusan Hadiah" on S8. **In the sidebar only, the active entry's icon loses its colour class** (as live: on `/cabutan` the sidebar icon is `fas fa-ticket w-5 text-center text-lg` without `text-fuchsia-500`; on `/gamification/rewards` "Kedai Hadiah" also loses `icon-gift`); the active style supplies the colour. The mobile drawer keeps the icon colour on the active entry | — | All | OBSERVED |
| FN-M15-1.1.7 | Shell header title/subtitle (DV-M15-12, shell rule DV-SH-03): S1–S4 (admin panel) show the page's tab title with **no subtitle** (M04 DV-M04-02 pattern): "Admin — Kedai Hadiah", "Admin — Tebusan Hadiah", "Tambah Hadiah", "Edit Hadiah"; S5–S8 (user portal) show the page h1 without its leading emoji with the live subtitle "Selamat datang kembali" (M10/M13 pattern): "Kedai Hadiah", "Kotak Misteri", "Cabutan Bertuah", "Kelulusan Tebusan Hadiah". Live shows "Dashboard" / "Selamat datang, Admin" (SHA) and "Dashboard" / "Selamat datang kembali" (SHU) on every M15 page | SHA-118, 119; SHU-136, 137 | All | OBSERVED + DV-M15-12 |
| FN-M15-1.1.8 | Tab titles (exact live): S1 "Admin — Kedai Hadiah", S2 "Admin — Tebusan Hadiah", S3 "Tambah Hadiah", S4 "Edit Hadiah", S5 "Kedai Hadiah", S6 "Kotak Misteri — PRESTASIPLUS", S7 "Cabutan Bertuah - PRESTASIPLUS", S8 "Kelulusan Hadiah — Ibu Bapa"; the 404 page "404 - Halaman Tidak Dijumpai \| PRESTASIPLUS" | — | All | OBSERVED |
| FN-M15-1.1.9 | Shells: S1–S4 render in the admin-panel shell (SHA) with its sidebar, server-status chips and bottom nav; S5–S8 in the user-portal shell (SHU) with its header chips, tournament banner slot (M16) and bottom nav, for every role; the 404 outcome is the standalone 404 layout | — | All | OBSERVED (admin) |

**FT-M15-1.2 — Access and error outcomes**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M15-1.2.1 | Every M15 route requires a session; a guest is sent to `/login` (M01 pattern) | — | Guest | INFERRED |
| FN-M15-1.2.2 | `/admin/hadiah*` (S1–S4): role `admin` only; any other role is sent to its M01 landing page (M02 FR-M02-99 / M04 FR-M04-109 pattern) | — | All | OBSERVED (admin) / INFERRED |
| FN-M15-1.2.3 | S5–S8 open for every logged-in role (OBSERVED for the admin); S8 lists only the redemptions of the viewer's linked children (M02 links), so it is empty for users without children (as for the admin) | — | All | OBSERVED (admin) / INFERRED |
| FN-M15-1.2.4 | Global 404 page (M01): "404", "🔍", h1 "Halaman Tidak Dijumpai", "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?", "Halaman Utama" → `/`, "Mula Latihan" (→ `/practice` per M01 DV-02; live `/latih-tubi`), "PRESTASIPLUS"; for every probed 404 route of §1, for `/admin/hadiah/{id}/edit` with an unknown, deleted or non-numeric id | S4-045–051 | All | OBSERVED + M01 DV-02 |
| FN-M15-1.2.5 | GET `/admin/hadiah/{id}` (URL-typed only; the URL accepts only the form's PUT): live shows the framework page h1 "Oops! An Error Occurred", h2 'The server returned a "405 Method Not Allowed".', "Something is broken. Please let us know what you were doing when this error occurred. We will fix it as soon as possible. Sorry for any inconvenience caused." Rebuild: the global 404 page of FN-1.2.4 (DV-M15-08) | S9-001–003 | All | OBSERVED + DV-M15-08 |

### EP-M15-2 — Catalogue administration (S1 `/admin/hadiah`)

**FT-M15-2.1 — Header and summary cards**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M15-2.1.1 | h1 "🎁 Admin — Kedai Hadiah Digital", sub "Urus catalog hadiah + proses tebusan pelajar." | S1-001, 002 | Admin | OBSERVED |
| FN-M15-2.1.2 | Button link "Tebusan Queue" (`fa-clipboard-list`, background `#3b82f6`, white) → `/admin/hadiah/tebusan` | S1-003 | Admin | OBSERVED |
| FN-M15-2.1.3 | Button link "Tambah Hadiah" (`fa-plus`, `#10b981`) → `/admin/hadiah/baharu` | S1-004 | Admin | OBSERVED |
| FN-M15-2.1.4 | Card "Total Hadiah" (label `text-xs`, upper case by CSS, slate-500; value `text-2xl font-bold` slate-800) = number of rewards (**59**) | S1-005, 006 | Admin | OBSERVED (value) / INFERRED (definition) |
| FN-M15-2.1.5 | Card "Aktif" (emerald-600) = number of active rewards (**0**) | S1-007, 008 | Admin | OBSERVED / INFERRED |
| FN-M15-2.1.6 | Card "Tebusan Bulan Ini" (blue-600) = redemptions created in the current calendar month (Asia/Kuala_Lumpur), cancelled ones excluded (**0**; the 3 live rows are from 30/04) | S1-009, 010 | Admin | OBSERVED (value) / INFERRED (definition) |
| FN-M15-2.1.7 | Card "Pending Proses" (amber-600) = redemptions with status `pending_admin` (**0**) | S1-011, 012 | Admin | OBSERVED / INFERRED |
| FN-M15-2.1.8 | The four cards ignore the category filter and the page (always all 59 on live, snapshot `categoryFilter.*.cards`); grid 2×2 below `md`, 4 in a row from 768px | — | Admin | OBSERVED |

**FT-M15-2.2 — Category filter**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M15-2.2.1 | Ten pill links (`rounded-full text-xs`; active `#7c3aed`/white, others `#f1f5f9`/`#475569`), GET `?cat=`: "Semua" (`all`), "🏆 Mahkota" (`flagship`), "💳 E-Wallet" (`ewallet`), "📱 Telco" (`telco`), "🎮 Gaming" (`gaming`), "🎬 Streaming" (`streaming`), "🍔 F&B" (`food_beverage`), "🛒 E-Commerce" (`ecommerce`), "📚 Pembelajaran" (`education`), "🎭 Hiburan" (`entertainment`). No `cat` = "Semua" active. Rows per category: 4 · 8 · 11 · 8 · 6 · 8 · 5 · 6 · 3 = 59 | S1-013–022 | Admin | OBSERVED |
| FN-M15-2.2.2 | Unknown `cat` (e.g. `bogus`): 200, **no pill active**, the table shows the empty row (FN-2.3.5), cards unchanged | — | Admin | OBSERVED |

**FT-M15-2.3 — Catalogue table**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M15-2.3.1 | Table (`w-full text-sm`; header `bg-slate-50`, upper case by CSS, `text-xs`) with columns: select-all checkbox · "Hadiah" · "Kategori" · "RM" · "Token" · "Stok" · "Tebusan" · "Status" · "Tindakan" | S1-038 | Admin | OBSERVED |
| FN-M15-2.3.2 | Row cells: **Hadiah** = "{icon_emoji} {title}" (`font-semibold text-slate-800`) over "{vendor}" (`text-xs text-slate-500`); **Kategori** = the **long** label ("🏆 Mahkota", "💳 E-Wallet", "📱 Telco Topup", "🎮 Gaming", "🎬 Streaming", "🍔 Makanan & Minuman", "🛒 E-Commerce", "📚 Pembelajaran", "🎭 Hiburan"; DV-M15-02 replicate); **RM** "RM{denomination_rm}"; **Token** `{token_cost}` (`font-bold text-purple-600`); **Stok** `{stock_quantity}` or "∞" when empty; **Tebusan** = the reward's redemptions, cancelled ones excluded (0 on all 59 rows although rewards 10 and 16 have cancelled rows); **Status** pill (`text-[10px]` → 12px per DV-M15-13, bold, `rounded-full`) "Off" (`#94a3b8`/white) for inactive rewards. Order: `display_order` ascending (100, 110 … 680 = ids 1…59), then id ascending (INFERRED tie-break) | — | Admin | OBSERVED (cells, order) / INFERRED (count rule, tie-break) |
| FN-M15-2.3.3 | Status pill for an **active** reward: "On" on `#10b981`/white, same shape (PROPOSED COPY and colour; never rendered on live, Q-M15-6) | — | Admin | PROPOSED (provisional) |
| FN-M15-2.3.4 | "Tindakan": one link **"Edit"** (`#3b82f6`) → `/admin/hadiah/{id}/edit`; no per-row delete or toggle (delete only via bulk "Padam") | S1-041, 043, 045 | Admin | OBSERVED |
| FN-M15-2.3.5 | Empty row (single cell) "Tiada hadiah dalam kategori ini." when the filtered set has no reward (observed for `cat=bogus`) | — | Admin | OBSERVED |

**FT-M15-2.4 — Pagination**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M15-2.4.1 | 50 rows per page (Laravel Tailwind paginator), from 640px: "Showing {from} to {to} of {total} results" ("Showing 1 to 50 of 59 results", page 2 "Showing 51 to 59 of 59 results"), page links "1" "2" (current page not a link), previous/next arrow icons (`svg`), `aria-label` "Pagination Navigation" and "Go to page 2" as live; pager hidden when the filtered set fits one page (every category) | S1-048–054 | Admin | OBSERVED |
| FN-M15-2.4.2 | Below 640px the mobile pager "« Previous" / "Next »" (a disabled span at either end, a link otherwise, e.g. "Next »" → `?page=2`) | S1-046, 047, 055, 056 | Admin | OBSERVED |
| FN-M15-2.4.3 | Page beyond the last (`?page=3`): pager "Showing 0 of {total} results" with its page links, and the empty row. Live reuses "Tiada hadiah dalam kategori ini." (D-M15-7); rebuild shows **"Tiada hadiah di halaman ini."** when the filtered set is not empty (DV-M15-07; PROPOSED COPY), and keeps the live sentence when the set itself is empty | S1-057, 058 | Admin | OBSERVED + DV-M15-07 |
| FN-M15-2.4.4 | Pager links carry only `page` (not `cat`), as live (not reachable while no category exceeds 50 rows) | — | Admin | OBSERVED |

**FT-M15-2.5 — Selection and bulk toolbar**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M15-2.5.1 | One form `#bulk-form` POST `/admin/hadiah/bulk` wraps the toolbar and the table, with hidden `_token` (mock session token), `action` (`#bulk-action`), `stock_value` (`#bulk-stock-value`), `max_per_month_value` (`#bulk-max-month-value`), `token_cost_delta_pct` (`#bulk-token-pct`); no nested form (row "Edit" are links) | S1-023–028 | Admin | OBSERVED |
| FN-M15-2.5.2 | Row checkbox `ids[]` (value = reward id, class `.row-check`, `onchange="updateBulkUI()"`) in each row; header checkbox `#select-all` (`onchange="toggleAll(this)"`) ticks or unticks every rendered row; selection is **per page** (≤ 50); the master is ticked only when every row of the page is ticked | S1-039, 040, 042, 044 | Admin | OBSERVED / SOURCE-DERIVED |
| FN-M15-2.5.3 | Toolbar `#bulk-toolbar` (`bg-purple-50 border-purple-300 rounded-xl sticky top-2 z-20`): `display:none` until at least one row is ticked, then `display:flex` with "**{n}** hadiah dipilih" (`#bulk-count`) and 7 buttons (`type=button`, `text-xs font-bold`): "Aktifkan" (`fa-check`, `#10b981`), "Nyahaktifkan" (`fa-pause`, `#f59e0b`), "Set Stok" (`fa-boxes-stacked`, `#3b82f6`), "Had/Bulan" (`fa-calendar-day`, `#8b5cf6`), "Pelaras Token" (`fa-percent`, `#ec4899`), "Padam" (`fa-trash`, `#dc2626`), "Batal" (`#94a3b8`) | S1-029, 030 | Admin | OBSERVED |
| FN-M15-2.5.4 | Toolbar "Batal" (`clearSelection()`): unticks every row and the master and hides the toolbar; no navigation, no request | S1-037 | Admin | OBSERVED |

**FT-M15-2.6 — Bulk actions** (page script, discovery §5.3, §6.1, Appendix B; each action returns early with 0 ticks, writes `#bulk-action` and its value and submits `#bulk-form`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M15-2.6.1 | "Aktifkan" → `confirm("Aktifkan {n} hadiah?")`; OK → submit `action=activate` → the ticked rewards become active | S1-031 | Admin | SOURCE-DERIVED (dialog) / INFERRED (effect) |
| FN-M15-2.6.2 | "Nyahaktifkan" → `confirm("Nyahaktifkan {n} hadiah?")`; OK → `action=deactivate` → inactive | S1-032 | Admin | SOURCE-DERIVED / INFERRED |
| FN-M15-2.6.3 | "Set Stok" → `prompt("Tetapkan stok untuk {n} hadiah.\n\nMasukkan nombor (cth: 100), atau biarkan kosong untuk tanpa had (∞):")`; Cancel → nothing; empty → stock ∞; otherwise the text must match `^\d+$` and be ≤ 999999, else `alert("Masukkan nombor sah (0-999999) atau kosong untuk ∞.")` and nothing is sent; valid → `action=set_stock` + `stock_value` | S1-033 | Admin | SOURCE-DERIVED / INFERRED (effect) |
| FN-M15-2.6.4 | "Had/Bulan" → `prompt("Tetapkan had bulanan/pelajar untuk {n} hadiah.\n\nMasukkan nombor (cth: 5), atau 0 / kosong untuk tanpa had:")`; Cancel → nothing; must be empty or match `^\d+$` and ≤ 99, else `alert("Masukkan nombor sah (0-99) atau kosong untuk ∞.")`; valid → `action=set_max_per_month` + `max_per_month_value`; **0 and empty both store "no cap"** (the prompt's own meaning; DV-M15-09 replicate) | S1-034 | Admin | SOURCE-DERIVED / INFERRED (effect) |
| FN-M15-2.6.5 | "Pelaras Token" → `prompt("Pelaras kos token untuk {n} hadiah.\n\nMasukkan peratus pelarasan:\n  +50 = naik 50% (cth: 100 token → 150)\n  -25 = turun 25% (cth: 100 token → 75)\n\nRange: -90 hingga +500")`; Cancel → nothing; `parseInt` of the trimmed text must be a number in −90…+500 and not 0, else `alert("Masukkan peratus sah antara -90 dan +500 (bukan 0).")`; then `confirm("Sahkan: {naikkan\|turunkan} kos token sebanyak {abs}% untuk {n} hadiah?")` ("naikkan" for a positive value); OK → `action=set_token_cost` with `token_cost_delta_pct` = **the raw trimmed text**, not the parsed number (as live: "12.7", "+50abc" or "50%" pass the client check as 12, 50, 50 and are sent unchanged). The mock parses it with the same `parseInt` semantics (leading integer; "12.7" → 12) and refuses it only when it is not a number, outside −90…+500 or 0 (PROPOSED; the live server is UNVERIFIED) → each ticked reward's token cost × (1 + pct/100), rounded to an integer, at least 1 (rounding PROPOSED; server-side on live); RM is unchanged | S1-035 | Admin | SOURCE-DERIVED / INFERRED (effect) / PROPOSED (server parse, rounding) |
| FN-M15-2.6.6 | "Padam" → `confirm("Padam {n} hadiah secara kekal? (Hadiah dengan sejarah tebusan tidak akan dipadam)")`; OK → `action=delete` → ticked rewards with **no redemption row of any status** are deleted permanently; the others stay (as the dialog promises; e.g. rewards 10 and 16 with cancelled rows) | S1-036 | Admin | SOURCE-DERIVED (dialog, promise) / INFERRED (history = any row) |
| FN-M15-2.6.7 | After a bulk submit the same list URL (with its `cat` and `page`) reloads with no tick and no message (redirect and flash never observed, Q-M15-7; no copy invented) | — | Admin | INFERRED (provisional) |

### EP-M15-3 — Reward form (S3 create, S4 edit)

**FT-M15-3.1 — Create (S3 `/admin/hadiah/baharu`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M15-3.1.1 | Link "← Kembali ke senarai" → `/admin/hadiah`; white card (`max-w-3xl`); h1 "➕ Tambah Hadiah Baharu" | S3-001, 002 | Admin | OBSERVED |
| FN-M15-3.1.2 | Form POST `/admin/hadiah` with `_token` (mock session token); no `novalidate`. Labels `text-xs font-bold uppercase text-slate-600` (upper case by CSS), required marker "*" in `text-rose-500`; inputs `px-3 py-2 border-slate-300 rounded` | S3-003, 004 | Admin | OBSERVED |
| FN-M15-3.1.3 | "Kategori *" select `category`, `required`, 9 options `flagship` "🏆 Mahkota (RM500+)", `ewallet` "💳 E-Wallet", `telco` "📱 Telco", `gaming` "🎮 Gaming", `streaming` "🎬 Streaming", `food_beverage` "🍔 F&B", `ecommerce` "🛒 E-Commerce", `education` "📚 Pembelajaran", `entertainment` "🎭 Hiburan"; first option shown by default (no `selected`) | S3-005, 006 | Admin | OBSERVED |
| FN-M15-3.1.4 | "Vendor *" `vendor` text `required` `maxlength=100` placeholder "cth: Roblox, Touch n Go, Hotlink"; "Tajuk *" `title` text `required` `maxlength=200` placeholder "cth: TnG eWallet RM50" | S3-007–010 | Admin | OBSERVED |
| FN-M15-3.1.5 | "Penerangan" `description` textarea rows 2 `maxlength=1000`; "Terma Khas" `terms_text` textarea rows 2 `maxlength=2000` | S3-011, 012, 033, 034 | Admin | OBSERVED |
| FN-M15-3.1.6 | "Nilai (RM) *" `denomination_rm` number `required` min 1 max 10000; "Kos Token *" `token_cost` number `required` min 1 max 10000 with the hint **"1 token = RM1"** (`text-slate-400`, 12px; live reads "100 syiling = 1 token = RM1" at 10px — DV-M15-14, DV-M15-13). The two numbers are independent fields (equal on every live row, but not linked) | S3-013–016 | Admin | OBSERVED + DV-M15-14 |
| FN-M15-3.1.7 | "Emoji Icon" `icon_emoji` text `maxlength=8` placeholder "🎁" | S3-017, 018 | Admin | OBSERVED |
| FN-M15-3.1.8 | "Stok (kosong = tanpa had)" `stock_quantity` number min 0; "Maks/bulan/pelajar" `max_per_month_per_student` number min 1 max 99; "Sah Hari (default 365)" `voucher_validity_days` number min 1 max 1825, default 365 | S3-019–024 | Admin | OBSERVED |
| FN-M15-3.1.9 | "Delivery" `delivery_method` select `manual` "Manual (admin paste)" (default), `api` "API (auto, future)", `instant` "Instant"; "Vendor SKU (optional)" `vendor_sku` text `maxlength=100`; "Display Order" `display_order` number min 0 max 9999, default 100 | S3-025–030 | Admin | OBSERVED |
| FN-M15-3.1.10 | "Image URL (optional)" `image_url` type url `maxlength=500` (stored only; no observed screen shows it) | S3-031, 032 | Admin | OBSERVED |
| FN-M15-3.1.11 | Checkboxes (value 1, above a `border-t`): "Aktif" `is_active` **checked** by default; "Perlu kelulusan ibu bapa" `requires_parent_consent` unchecked | S3-035–038 | Admin | OBSERVED |
| FN-M15-3.1.12 | Layout: Kategori + Vendor (`md:grid-cols-2`); Tajuk; Penerangan; Nilai / Kos Token / Emoji (`md:grid-cols-3`); Stok / Maks / Sah Hari (3 columns); Delivery / SKU / Display Order (3 columns); Image URL; Terma Khas; the two checkboxes; buttons. One column below `md` | — | Admin | OBSERVED |
| FN-M15-3.1.13 | Submit "➕ Tambah" (`#10b981`): native validation first ("Please fill out this field." etc., browser text) on `vendor`, `title`, `denomination_rm`, `token_cost` and the range/URL/length constraints; valid → a new reward (next id, 60 on a fresh seed), then S1 (redirect INFERRED; no flash — none observed, Q-M15-7) | S3-039 | Admin | OBSERVED (validation) / INFERRED (result) |
| FN-M15-3.1.14 | "Batal" is a **link** (`#94a3b8`) to `/admin/hadiah`: full navigation, typed values discarded, no confirm | S3-040 | Admin | OBSERVED |

**FT-M15-3.2 — Edit (S4 `/admin/hadiah/{id}/edit`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M15-3.2.1 | Same card as S3; h1 "✏️ Edit Hadiah: {title}" with the title field (no icon), e.g. "✏️ Edit Hadiah: Roblox Gift Card RM10", "✏️ Edit Hadiah: Roblox Gift Card RM1000 🏆", "✏️ Edit Hadiah: Hotlink Topup RM5" | S4-002, 042, 052 | Admin | OBSERVED |
| FN-M15-3.2.2 | Form POST `/admin/hadiah/{id}` with `_token` and hidden `_method=PUT` | S4-003, 004, 005 | Admin | OBSERVED |
| FN-M15-3.2.3 | The 17 fields of S3 (same labels, names, constraints, order), pre-filled from the record: selects carry `selected` on the stored value, checkboxes `checked` per record, empty number fields `value=""` (stock ∞, no monthly cap), the stored description (e.g. "Tukar untuk Robux dalam Roblox.", "~13,400 Robux. Untuk mega-fan Roblox.", "Reload Hotlink prepaid.") | S4-006–039, 043, 044, 053, 054 | Admin | OBSERVED |
| FN-M15-3.2.4 | Submit "💾 Simpan" (`#10b981`): native validation; valid → the record is updated, then S1 (INFERRED; no flash) | S4-040 | Admin | OBSERVED (validation) / INFERRED (result) |
| FN-M15-3.2.5 | "← Kembali ke senarai" and "Batal" links → `/admin/hadiah` (discard, no confirm) | S4-001, 041 | Admin | OBSERVED |
| FN-M15-3.2.6 | No delete control on the form (delete only through the S1 bulk "Padam") | — | Admin | OBSERVED |

### EP-M15-4 — Redemptions (S2 queue and lifecycle)

**FT-M15-4.1 — Queue screen (S2 `/admin/hadiah/tebusan`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M15-4.1.1 | h1 "📋 Admin — Tebusan Hadiah Pelajar", sub "Beli kod dari reseller, paste kat sini untuk hantar kepada pelajar." | S2-001, 002 | Admin | OBSERVED |
| FN-M15-4.1.2 | Button link "Kembali ke Catalog" (`fa-store`, `#7c3aed`) → `/admin/hadiah` | S2-003 | Admin | OBSERVED |
| FN-M15-4.1.3 | Status pills (GET links; active `#7c3aed`): "⏳ Pending Admin" (`status=pending_admin`), "⏳ Pending Ibu Bapa" (`pending_parent_consent`), "🎁 Delivered" (`delivered`), "❌ Cancelled" (`cancelled`), "Semua" (`all`). No `status` = "⏳ Pending Admin" active (the default queue); unknown `status` → no pill active, empty row | S2-004–008 | Admin | OBSERVED |
| FN-M15-4.1.4 | Table columns "Pelajar" · "Hadiah" · "RM" · "Token" · "Status" · "Tarikh" · "Tindakan". Row: Pelajar = name (`font-semibold text-slate-800`) over e-mail (`text-xs text-slate-500`); Hadiah = reward title **without** the icon (`text-slate-700`) over vendor; RM "RM{n}"; Token `{n}` bold; Status pill (`rounded-full whitespace-nowrap`, bold, 10px on live → 12px per DV-M15-13); Tarikh "dd/mm HH:MM" 24-hour, **no year** (`text-xs text-slate-500`; DV-M15-06 replicate) | S2-009 | Admin | OBSERVED |
| FN-M15-4.1.5 | A `cancelled` row shows the pill "❌ Dibatalkan" (`#64748b`/white) and an **empty** Tindakan cell | — | Admin | OBSERVED |
| FN-M15-4.1.6 | Status pills in rows for the unobserved statuses (PROPOSED: the live filter labels reused — "⏳ Pending Admin" `#f59e0b`, "⏳ Pending Ibu Bapa" `#8b5cf6`, "🎁 Delivered" `#10b981`, white text; Q-M15-1) | — | Admin | PROPOSED (provisional) |
| FN-M15-4.1.7 | Rows newest first (INFERRED from the 3 rows), then id descending; 50 per page with the S1 pager (INFERRED; an empty paginator slot `div.mt-4` is present); empty row "Tiada tebusan dalam status ini." | — | Admin | OBSERVED (empty copy) / INFERRED (order, paging) |

**FT-M15-4.2 — Fulfilment by the admin** (actions never rendered on live, Q-M15-1)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M15-4.2.1 | A `pending_admin` row's Tindakan holds a code field (placeholder "Kod voucher", required) and a button "Hantar" (`#10b981`): the admin pastes the code bought from the reseller → status `delivered`, code stored, `deliveredAt` = now, expiry = now + the reward's `voucher_validity_days` (the S2 subtitle and "Manual (admin paste)"; layout and copy PROPOSED) | — | Admin | INFERRED (rule) / PROPOSED (UI, provisional) |
| FN-M15-4.2.2 | The same row has a button "Batalkan" (`#dc2626`) → status `cancelled`: the token cost is refunded to the student and the reserved stock is restored (Q-M15-8; PROPOSED UI, INFERRED effect) | — | Admin | INFERRED / PROPOSED (provisional) |
| FN-M15-4.2.3 | `pending_parent_consent` and `delivered` rows have no action (the parent decides the first; the second is final); `cancelled` rows have none (OBSERVED) | — | Admin | OBSERVED (cancelled) / INFERRED (others, provisional) |

**FT-M15-4.3 — Redemption rules**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M15-4.3.1 | Create a redemption (server rule; the student UI is not built by the user's decision, FN-5.1.5): the reward must be active; stock must be ∞ or ≥ 1; the student's non-cancelled redemptions of that reward in the current calendar month must be below its monthly cap (if any); the student's token balance (M14) must cover `token_cost`. Then, in one step: debit the tokens (M14), reserve 1 stock unit (if not ∞), store a snapshot (title, vendor, RM, token), status `pending_parent_consent` when the reward requires consent, otherwise `pending_admin` | — | Pelajar | INFERRED (provisional) |
| FN-M15-4.3.2 | Count definitions (one per figure, SRS §6.8): S1 "Tebusan" per reward and "Tebusan Bulan Ini" exclude cancelled rows; "Pending Proses" = `pending_admin` | — | Admin | OBSERVED (values) / INFERRED (definitions) |
| FN-M15-4.3.3 | A delivered code is stored with its expiry; no M15 screen shows it to the student (no history page exists: `/gamification/rewards/history` is 404; Q-M15-1) | — | Pelajar | OBSERVED (no page) / UNVERIFIED |

### EP-M15-5 — Student shop (S5 `/gamification/rewards`)

**FT-M15-5.1 — Shop page**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M15-5.1.1 | Hero `.shop-hero` (gradient `#059669 → #10b981 → #34d399`, radius 20px, stacks `flex-col md:flex-row`): h1 "🎁 Kedai Hadiah" (`text-sm sm:text-2xl`: 14px below 640, 24px from 640), sub "Tebus token anda untuk hadiah menarik!" | S5-004, 005 | All | OBSERVED |
| FN-M15-5.1.2 | Balance tile (`rgba(255,255,255,0.15)`): "{token balance}" over "Baki Token 🎫" — the viewer's token balance from the M14 wallet (admin **0**) | S5-006, 007 | All | OBSERVED |
| FN-M15-5.1.3 | Empty state: "🎁" (`text-3xl sm:text-6xl`), h2 "Tiada Hadiah Tersedia", "Hadiah akan ditambah tidak lama lagi. Tunggu ya!" | S5-008, 009, 010 | All | OBSERVED |
| FN-M15-5.1.4 | Query parameters are ignored (`?category=gaming` renders the same page) | — | All | OBSERVED |
| FN-M15-5.1.5 | **Populated shop and claim flow — not built (user decision on OQ-M15-01, 2026-09-26: follow live).** The page stylesheet describes unrendered cards (`.reward-card` radius 16px, `.featured` amber border and glow, `.reward-image` 160px, `.reward-type-badge` PHYSICAL/DIGITAL/VOUCHER/EXPERIENCE/SUBSCRIPTION, `.reward-price` 1.25rem `#1e40af`, `.claim-btn` blue gradient with `:disabled` opacity 0.5, `.stock-badge` in-stock/low-stock/out-stock) whose type names belong to the syiling-priced legacy catalogue of M14 S10, while the hero says "Baki Token" and the M15 catalogue is priced in tokens. Which catalogue S5 lists is not provable read-only and is not decided here. By the user's decision the prototype renders the observed empty state for every account, including when rewards are active; no card, no claim control and no shop catalogue source is built | — | Pelajar | SOURCE-DERIVED (CSS) / user decision |

### EP-M15-6 — Mystery box (S6 `/gamification/mystery-box`)

**FT-M15-6.1 — Box page**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M15-6.1.1 | Hero `.mystery-hero` (gradient `#1e1b4b → #312e81 → #4338ca`, centred): h1 "📦 Kotak Misteri", sub "Buka kotak & menang ganjaran rawak — nasib baik menanti!", chip "🎫 Token Anda: **{n}**" (M14 token balance; admin **0**) | S6-004–007 | All | OBSERVED |
| FN-M15-6.1.2 | Four sibling forms POST `/gamification/mystery-box/{1-4}/open` with only `_token` (mock session token), in a grid `repeat(auto-fill, minmax(220px, 1fr))` | S6-008, 009, 020, 021, 033, 034, 046, 047 | All | OBSERVED |
| FN-M15-6.1.3 | Box cards (header gradient `--box-color1/2`, icon, name, description, cost "{n} Token", "🪙 **{a-b}**", "⭐ **{a-b}** XP"): 1 📦 "Kotak Gangsa" "Kotak biasa — ganjaran kecil tapi pasti!" 2 Token, 1-20, 1-10, `#9ca3af → #6b7280`; 2 ribbon "rare" (`#3b82f6`) 🎁 "Kotak Perak" "Kotak lebih besar — peluang ganjaran lebih baik" 5 Token, 10-50, 5-25, `#3b82f6 → #2563eb`; 3 ribbon "epic" (`#8b5cf6`) ✨ "Kotak Emas" "Kotak premium — ganjaran besar menanti!" 10 Token, 25-150, 10-50, `#8b5cf6 → #7c3aed`; 4 ribbon "legendary" (gradient `#f59e0b → #ef4444`) 👑 "Kotak Legenda" "Kotak terhebat — ganjaran WOW!" 25 Token, 100-500, 25-100, `#f59e0b → #ef4444`. Ribbons are rotated 45° corner labels, lower case in the DOM and upper case by CSS ("RARE", "EPIC", "LEGENDARY"), 10.4px on live → 12px (DV-M15-13) | S6-010–018, 022–031, 035–044, 048–057 | All | OBSERVED |
| FN-M15-6.1.4 | Full-width submit per box: **disabled** "🔒 Token Tidak Cukup" (background `#d1d5db`, `cursor:not-allowed`; **text `#4b5563` instead of live white, DV-M15-20**) when the viewer's token balance is below the box cost (all four for the admin: 0 token) | S6-019, 032, 045, 058 | All | OBSERVED (state) / INFERRED (rule `balance < cost`) |
| FN-M15-6.1.5 | Card hover as live: the whole card keeps `cursor:pointer` and lifts on hover, the icon shakes (`boxShake 0.5s`), also when the button is disabled (DV-M15-11 replicate) | — | All | OBSERVED |

**FT-M15-6.2 — Opening a box** (never done on live; the result is computed server-side)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M15-6.2.1 | Enabled submit when balance ≥ cost: label "Buka Kotak" (PROPOSED COPY from the hero "Buka kotak"; the live enabled label was never rendered, Q-M15-4), background the box gradient | — | All | PROPOSED (provisional) |
| FN-M15-6.2.2 | Opening (one step, M14 wallet contract): debit the box cost in tokens; draw a syiling amount and an XP amount **inside the displayed ranges**; credit the syiling with the ledger description "Kotak Misteri: {name}" (the format OBSERVED in the M14 ledger, e.g. "Kotak Misteri: Kotak Legenda" +119…+479) and the XP; record the opening. The live odds are **UNVERIFIED** (only the ranges are published); the prototype's draw rule is a PROPOSED mechanism (SRS BR-M15-18), not a statement of live odds | — | All | OBSERVED (ranges, ledger text) / UNVERIFIED (odds) / PROPOSED (mock rule; provisional) |
| FN-M15-6.2.3 | Result modal (stylesheet classes only; no markup or script on live): `.modal-overlay` rgba(0,0,0,0.7), `.modal-content` max 400px, `.modal-result-icon` = the box icon, the box name, `.modal-reward` (`#7c3aed`) "+{coins} 🪙 · +{xp} XP", `.modal-close` purple button "Tutup" (content PROPOSED) | — | All | SOURCE-DERIVED (classes) / PROPOSED (content; provisional) |
| FN-M15-6.2.4 | History card (`.history-card`, `.history-item`; not in the live markup for the admin, who has no opening): heading "Sejarah Kotak Misteri", the viewer's openings newest first, each "Kotak Misteri: {name}", "+{coins} 🪙 · +{xp} XP", "dd/mm HH:MM"; hidden when there is none (content PROPOSED) | — | All | SOURCE-DERIVED (classes) / PROPOSED (content; provisional) |

### EP-M15-7 — Lucky draw (S7 `/cabutan`)

**FT-M15-7.1 — Draw page**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M15-7.1.1 | Header card (`bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white`, `flex-wrap`): h1 "🎟️ Cabutan Bertuah", sub "Guna syiling untuk beli tiket & menangi hadiah hebat!", tile "Syiling anda" (`text-xs`, upper case by CSS, indigo-100) over "**{syiling} 🪙**" (`text-2xl font-bold`; the M14 syiling balance, admin **256**) | S7-004–007 | All | OBSERVED |
| FN-M15-7.1.2 | h2 "Cabutan Dibuka" and, with no open draw, the dashed empty box (`border-dashed bg-gray-50`) "Tiada cabutan dibuka buat masa ini. Nanti datang lagi! 🎈" | S7-008, 009 | All | OBSERVED |
| FN-M15-7.1.3 | One card per **open** draw of the M14 draw store (created on M14 S10; no draw has ever existed on live, Q-M15-5), with the draw's own fields: title (h3), description, "Harga tiket: {ticket_cost_syiling} 🪙", "Tiket anda: {owned}/{max_tickets_per_student}", "Tutup: {closes_at dd/mm/yyyy}", the prize pool as "{label} × {qty}" lines, and the button "🎟️ Beli Tiket" (layout and copy PROPOSED) | — | All | INFERRED (fields: M14 S10 form) / PROPOSED (UI; provisional) |
| FN-M15-7.1.4 | "🎟️ Beli Tiket" buys one ticket through the M14 contract: debit `ticket_cost_syiling` from the syiling balance, add one ticket; disabled when the balance is below the price or the student already holds the maximum (PROPOSED UI, INFERRED rule) | — | All | INFERRED / PROPOSED (provisional) |
| FN-M15-7.1.5 | S7 lists only open draws; closed draws, draw results and winners have no M15 surface (the page has only "Cabutan Dibuka"; winner selection is M14's admin side) — nothing is built for them | — | All | OBSERVED (page structure) |

### EP-M15-8 — Parent consent (S8 `/cikgu/kelulusan-hadiah`)

**FT-M15-8.1 — Consent page**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M15-8.1.1 | h1 "👨‍👩‍👧 Kelulusan Tebusan Hadiah", sub "Anak anda nak tebus hadiah yang memerlukan kelulusan ibu bapa. Sila semak." | S8-004, 005 | All | OBSERVED |
| FN-M15-8.1.2 | h2 "⏳ Menunggu Kelulusan ({n})" ({n} = the viewer's children's `pending_parent_consent` redemptions; admin **0**) and, when none, the empty box "Tiada tebusan menunggu kelulusan." | S8-006, 007 | All | OBSERVED (0) / INFERRED (count) |
| FN-M15-8.1.3 | h2 "📜 Sejarah Tebusan Anak" and, when none, "Belum ada sejarah tebusan." | S8-008, 009 | All | OBSERVED |
| FN-M15-8.1.4 | Pending request card per redemption (PROPOSED): child name (bold), "{icon} {title}", "{token} token", "dd/mm HH:MM", buttons "✅ Lulus" (`#10b981`) and "❌ Tolak" (`#dc2626`); no confirm dialog | — | Ibu Bapa | PROPOSED (provisional) |
| FN-M15-8.1.5 | "✅ Lulus" → status `pending_admin` (the redemption enters the admin queue); "❌ Tolak" → `cancelled` with token refund and stock restored (as FN-4.2.2) | — | Ibu Bapa | INFERRED (provisional) |
| FN-M15-8.1.6 | History rows (PROPOSED): the children's redemptions that are not waiting for consent, newest first: child name, "{icon} {title}", the S2 status pill, "dd/mm HH:MM" | — | Ibu Bapa | PROPOSED (provisional) |
| FN-M15-8.1.7 | Scope: only redemptions of students linked to the viewer by an M02 ParentStudentLink; approving or rejecting any other redemption is refused (404); **(v1.6)** approve and reject are open to the parent role only — any other role is refused (403) | — | Ibu Bapa | INFERRED (provisional) |

### EP-M15-9 — Cross-cutting

**FT-M15-9.1 — Responsive, readability, accessibility, states, ownership**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M15-9.1.1 | No horizontal page scroll at any width; S1 and S2 tables scroll horizontally **inside their card** wherever they do not fit (375 and 768; DV-M15-01, NFR-RESP-05 b); every other layout replicates live (URS §5, SRS §10) | — | All | OBSERVED + DV-M15-01 |
| FN-M15-9.1.2 | No M15 content text below 12px (DV-M15-13): S1 "Off"/"On" pill, S2 status pills, S3/S4 hint, S6 ribbons; icons and emoji keep their size | — | All | DV-M15-13 |
| FN-M15-9.1.3 | Accessibility replicates live (D10): native validation bubbles (browser text), unlabelled row checkboxes, no added ARIA, dialogs are the browser's `confirm`/`prompt`/`alert` | — | All | OBSERVED |
| FN-M15-9.1.4 | Loading and errors follow the shared conventions (live pages are server-rendered; no M15-specific error copy exists); **(v1.6)** a failed action shows the shared generic copy "Ralat berlaku. Sila cuba lagi." and never the server's error message | — | All | INFERRED |
| FN-M15-9.1.5 | Ownership (D12): balances, debits and credits go only through the M14 wallet contract; users and parent links through M01/M02; draws and tickets through M14; M15 owns rewards, redemptions, mystery-box configuration and openings | — | All | D12 |
| FN-M15-9.1.6 | **(v1.4, L43)** S10 and S11: no horizontal page scroll at 375, 768 and 1280px; layouts as observed in the three L43 screenshots (§5); the page content sits in the user shell for every role | — | All | OBSERVED (screenshots, admin) |
| FN-M15-9.1.7 | **(v1.4, L43)** S10 and S11 are server-rendered on live (no shop JSON/XHR); the rebuild reads them through the mock endpoints of SRS §7 #17, #19, #20 and shows the shared loading/error convention (no L43-specific error copy was observed) | — | All | OBSERVED (no endpoint) / INFERRED (states) |

### EP-M15-10 — Digital rewards shop for students, row L43 (S10 `/cikgu/hadiah`, S11 `/cikgu/hadiah/saya`) — new in v1.4

Source: discovery L43 (live probe 2026-10-02, admin session, GET only). Labels as elsewhere: OBSERVED = seen on live as admin; INFERRED = most likely, not observed; NOT OBSERVED = could not be seen (the live catalogue is empty); **"Perlu pengesahan" = what a murid session would show is not observable from the admin session**. S10 is **not** an alias of S5: different route, title, subtitle, balance card, filters and empty copy (discovery §4). Per the OQ-M15-01 precedent (user: "ikut macam mana ada sekarang") both screens show the observed empty state for every account; nothing unobserved is built (FN-M15-10.1.9, FN-M15-10.2.4; applied to L43 by the Delivery Lead, OQ-M15-13 decided). The independent audit (AUD-L43, PASS) re-observed the page and upgraded several items to OBSERVED.

**FT-M15-10.1 — Shop page (S10 `/cikgu/hadiah`, query `?cat=`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M15-10.1.1 | Route `/cikgu/hadiah` renders in the **user-portal shell** (sidebar, top bar, chat button) for the admin with no redirect and no admin-specific chrome; tab title "Kedai Hadiah Digital". Live header shows "Dashboard" / "Selamat datang kembali" (rebuild: DV-M15-17). The admin sidebar has no entry that opens this page (the admin's "Kedai Hadiah" opens S5) | — | All | OBSERVED (admin) |
| FN-M15-10.1.2 | Title block: h1 "🎁 Kedai Hadiah Digital"; subtitle "Tukar token kepada hadiah digital — terus dihantar, tanpa pos." | S10-001, 002 | All | OBSERVED |
| FN-M15-10.1.3 | Balance card (gradient purple to pink): left block label "Token Anda" over the viewer's token balance (admin **0**), a vertical divider, a block label "Syiling" over the viewer's syiling balance (admin **256**), the caption (FN-10.1.4) under the syiling value, and the button (FN-10.1.5). Both figures come from the M14 wallet (`tokenBalance`, `currentSyiling`; D12). The two labels are **mixed case in the DOM ("Token Anda", "Syiling") and rendered upper case by CSS** ("TOKEN ANDA", "SYILING"); the rebuild keeps the text mixed case with `text-transform: uppercase`, so copied and read-out text is as live. Label size 10px on live (DV-M15-19, raised to 12px). Whether a murid sees the same layout and a different pair of values: Perlu pengesahan (Q-L43-2) | S10-003–006 | All | OBSERVED (admin; audit AUD-L43-02) / INFERRED (other roles) |
| FN-M15-10.1.4 | Caption under the syiling value. Live: "100 syiling = 1 token". Rebuild: **"{conversionRate} syiling = 1 token"** with the viewer's M14 tier rate (admin: Gangsa, **50**) — DV-M15-16; live size **9px** (measured), raised to ≥ 12px (DV-M15-19); the card (369px natural width at 768/1280, 324px at 375) must still fit | S10-007 | All | OBSERVED + DV-M15-16, 19 |
| FN-M15-10.1.5 | White button link "Tebusan Saya" with a clipboard icon in the balance card → `/cikgu/hadiah/saya` (S11); full navigation, no confirm | S10-008 | All | OBSERVED |
| FN-M15-10.1.6 | Ten category chips in a wrapping row, plain links (GET `?cat=`), in this order (emoji + label → value): "🌟 Semua" → `all`, "🏆 Mahkota" → `flagship`, "💳 E-Wallet" → `ewallet`, "📱 Telco" → `telco`, "🎮 Gaming" → `gaming`, "🎬 Streaming" → `streaming`, "🍔 Makan & Minum" → `food_beverage`, "🛒 Shopping" → `ecommerce`, "📚 Pembelajaran" → `education`, "🎭 Hiburan" → `entertainment`. Same nine category keys as the admin catalogue S1 (BR-M15-01) but **different labels** for two of them ("Makan & Minum", "Shopping"; S1 reads "F&B", "E-Commerce") and the chip "Semua" carries 🌟 (S1 has no emoji) — each screen is consistent with itself, so DV-M15-02 applies (replicate) | S10-009–018 | All | OBSERVED |
| FN-M15-10.1.7 | Chip state: no `cat` (or `cat=all`) → "🌟 Semua" has the active style (purple fill, white text), the others the plain chip style. For the other nine keys the page keeps the same layout and the same empty copy (OBSERVED for `all`, `gaming`, `flagship`, `ewallet`, `telco`, `entertainment`); the followed chip becomes the only active one (OBSERVED for `flagship`: "🏆 Mahkota" purple fill, "🌟 Semua" plain; the remaining keys follow the same pattern). An **unknown** `cat` value (e.g. `bogus`) returns 200 with the same page, the same empty copy and **no chip active** (OBSERVED, audit AUD-L43-04). No other query parameter is read | — | All | OBSERVED |
| FN-M15-10.1.8 | Empty state under the chips, centred, grey: "Tiada hadiah dalam kategori ini." — the same copy for every category and every account (never seen with cards) | S10-019 | All | OBSERVED |
| FN-M15-10.1.9 | **Not built (precedent of OQ-M15-01; NOT OBSERVED on live):** reward cards or grid, price, stock, "Tebus" button, confirm dialog, redemption result or refusal messages, item detail page (`/cikgu/hadiah/{id}` is 404). S10 shows the empty state for every account and every catalogue state, **including when rewards are active on S1** (the live inference "S10 = student front of the admin catalogue" rests only on category-name parity and is not provable read-only; discovery §4). No shop-items source is modelled | — | All | OBSERVED (empty) / user-decision precedent (applied, OQ-M15-13 decided) |

**FT-M15-10.2 — Tebusan Saya (S11 `/cikgu/hadiah/saya`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M15-10.2.1 | Route `/cikgu/hadiah/saya` renders in the user-portal shell; tab title "Tebusan Saya"; live header "Dashboard" / "Selamat datang kembali" (rebuild: DV-M15-17) | — | All | OBSERVED (admin) |
| FN-M15-10.2.2 | Title row: h1 "📋 Tebusan Saya" and a link button "🎁 Kedai Hadiah" → `/cikgu/hadiah` (back to the shop) | S11-001, 002 | All | OBSERVED |
| FN-M15-10.2.3 | Empty state inside a white card below the title row: a centred decorative "🎁" (48px, its own element), the text "Belum ada tebusan. Kumpul syiling dulu, lepas tukar token dan tebus hadiah." and the link "Layari Kedai Hadiah" → `/cikgu/hadiah` | S11-003, 004, 005 | All | OBSERVED |
| FN-M15-10.2.4 | **Not built (NOT OBSERVED on live; precedent OQ-M15-01):** the populated list of the viewer's redemptions, its status chips or pills, dates, codes and any filter or pager. S11 shows the empty state for every account. It does **not** read the M15 redemption store: the redemptions of S2 (the 3 seeded cancelled rows, the `queue` fixture) never appear on S11 (consequence recorded in OQ-M15-15) | — | All | OBSERVED (empty) / user-decision precedent (applied, OQ-M15-13 decided) |

**FT-M15-10.3 — Access, entry point and 404 outcomes (L43)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M15-10.3.1 | A guest opening S10 or S11 is sent to `/login` (M01 pattern; not probed) | — | Guest | INFERRED |
| FN-M15-10.3.2 | S10 and S11 open for every logged-in role (OBSERVED for the admin; the live student nav entry shows the screens are meant for the murid; teacher, parent and other roles INFERRED as S5/S6/S7, FN-M15-1.2.3). No role-specific content | — | All | OBSERVED (admin) / INFERRED |
| FN-M15-10.3.3 | The global 404 page (FN-M15-1.2.4) renders for `/kedai-hadiah`, `/hadiah`, `/kedai` and `/cikgu/hadiah/1` (any `/cikgu/hadiah/{id}` other than `saya`: INFERRED); there is no item-detail route | — | All | OBSERVED (4 URLs) |
| FN-M15-10.3.4 | Student sidebar entry "Kedai Hadiah 🎁" with the badge "DIGITAL" (student role only; label and badge OBSERVED in the murid screenshot, classes INFERRED) opens **`/cikgu/hadiah`**. The former prototype value `/kedai-hadiah` is 404 on live and has been corrected to `/cikgu/hadiah` (DV-M15-18; SRS XR-M15-13 Applied by the Delivery Lead in `user-nav.ts`). The reference rebuild's spec also points to `/cikgu/hadiah` (secondary source) | — | Pelajar | OBSERVED (live 404) / INFERRED (placement, classes) |
| FN-M15-10.3.5 | Active state: INFERRED — "Kedai Hadiah 🎁" is the active student-nav entry on S10 and on S11 (a sub-page of the shop); not observable as admin | — | Pelajar | INFERRED |
| FN-M15-10.3.6 | S5 (`/gamification/rewards`, "Kedai Hadiah", the "Kedai Hadiah" sidebar entry) and S10 are separate screens with different copy (FN-5.1.1 vs FN-10.1.2/10.1.3); both show an empty state; S5 keeps its own content unchanged | — | All | OBSERVED |

---

## 4. User stories

Values in the ACs come from the seed (SRS §6.8). "The admin" = `admin@demo.test` (id 1; wallet 256 syiling, 0 token, 8 XP; no linked child). "The student" = `pelajar@demo.test` (id 2) and "Pelajar Maju Demo" = id 4, both linked to "the parent" `ibubapa@demo.test` (id 6, M02 links 1–2). Fixture `queue` (test-only, SRS §6.9): 15101 `pending_admin` (student 2, reward 40 "TnG eWallet RM10", 10 token, 2026-09-24 20:15), 15102 `pending_parent_consent` (student 4, reward 1 "Roblox Gift Card RM10", 10 token, 2026-09-25 09:30), 15103 `delivered` (student 2, reward 26 "McD e-Voucher RM10", 10 token, 2026-09-19 21:00). Mock clock 2026-09-25T15:40:00+08:00. E2E run at 375×812, 768×1024 and 1280×800. **(provisional)** marks an AC that asserts INFERRED/UNVERIFIED behaviour or PROPOSED UI for an unobserved state.

| ID | Feature | MoSCoW | Story | Functions |
|---|---|---|---|---|
| US-M15-01 | FT-M15-1.1 | Must | As a user, I want the reward entries in my menu with the right page titles, so that I can find each page and know where I am. | FN-M15-1.1.1–1.1.9 |
| US-M15-02 | FT-M15-1.2 | Must | As the owner, I want M15 closed to guests, the admin pages closed to other roles, and wrong addresses to show the standard 404 page, so that the area behaves predictably. | FN-M15-1.2.1–1.2.5 |
| US-M15-03 | FT-M15-2.1 | Must | As an admin, I want the catalogue header with its two shortcuts and four summary cards, so that I see the size and state of the shop at a glance. | FN-M15-2.1.1–2.1.8 |
| US-M15-04 | FT-M15-2.2 / 2.3 | Must | As an admin, I want to filter the catalogue by category and read each reward's price, stock, redemptions and status, so that I can check the catalogue. | FN-M15-2.2.1, 2.2.2, 2.3.1, 2.3.2, 2.3.4, 2.3.5 |
| US-M15-05 | FT-M15-2.4 | Must | As an admin, I want the catalogue paged by 50 with the live pager, so that long lists stay usable. | FN-M15-2.4.1–2.4.4 |
| US-M15-06 | FT-M15-2.5 | Must | As an admin, I want to tick rewards and see a toolbar with the selection count, so that I can act on many rewards at once. | FN-M15-2.5.1–2.5.4 |
| US-M15-07 | FT-M15-2.6 | Must | As an admin, I want to activate, deactivate and delete the ticked rewards after a confirmation, so that I control what is offered. | FN-M15-2.6.1, 2.6.2, 2.6.6, 2.6.7, 2.3.3 |
| US-M15-08 | FT-M15-2.6 | Must | As an admin, I want to set stock, a monthly cap and a token-price adjustment for the ticked rewards with input checks, so that I manage supply and price quickly. | FN-M15-2.6.3, 2.6.4, 2.6.5 |
| US-M15-09 | FT-M15-3.1 | Must | As an admin, I want a form to add a reward with the live fields, defaults and limits, so that I can extend the catalogue. | FN-M15-3.1.1–3.1.14 |
| US-M15-10 | FT-M15-3.2 | Must | As an admin, I want to edit a reward in the same form pre-filled with its values, so that I can correct it. | FN-M15-3.2.1–3.2.6 |
| US-M15-11 | FT-M15-4.1 | Must | As an admin, I want the redemption queue filtered by status, defaulting to the requests waiting for me, so that I know what to process. | FN-M15-4.1.1–4.1.5, 4.1.7 |
| US-M15-12 | FT-M15-4.2 | Must | As an admin, I want to paste the code bought from the reseller to deliver a request, or cancel it, so that students receive their rewards. | FN-M15-4.1.6, 4.2.1, 4.2.2, 4.2.3, 4.3.3 |
| US-M15-13 | FT-M15-4.3 | Must | As the owner, I want every redemption checked against status, stock, monthly cap and token balance, with consent-flagged rewards routed to the parent, so that the shop cannot be abused. | FN-M15-4.3.1, 4.3.2, 9.1.5 |
| US-M15-14 | FT-M15-5.1 | Must | As a student, I want the shop page with my token balance and a clear message when nothing is offered, so that I know where I stand. | FN-M15-5.1.1–5.1.5 |
| US-M15-15 | FT-M15-6.1 | Must | As a student, I want to see the four mystery boxes with their cost and possible rewards, and which I cannot afford, so that I can decide. | FN-M15-6.1.1–6.1.5 |
| US-M15-16 | FT-M15-6.2 | Should | As a student with enough tokens, I want to open a box and see what I won, and my past openings, so that the reward feels real. | FN-M15-6.2.1–6.2.4 |
| US-M15-17 | FT-M15-7.1 | Must | As a student, I want the lucky-draw page with my syiling balance and the open draws, so that I know whether I can join. | FN-M15-7.1.1, 7.1.2, 7.1.5 |
| US-M15-18 | FT-M15-7.1 | Should | As a student, I want to buy tickets for an open draw with my syiling, within the limit, so that I can take part. | FN-M15-7.1.3, 7.1.4 |
| US-M15-19 | FT-M15-8.1 | Must | As a parent, I want a page listing my children's redemptions that wait for my approval and their history, so that I can review them. | FN-M15-8.1.1, 8.1.2, 8.1.3, 8.1.7 |
| US-M15-20 | FT-M15-8.1 | Must | As a parent, I want to approve or reject a request, so that my child only gets rewards I allow. | FN-M15-8.1.4, 8.1.5, 8.1.6 |
| US-M15-21 | FT-M15-9.1 | Must | As a user on a phone, tablet or desktop, I want every M15 screen to fit, keep its controls reachable and its text readable, so that I can use it anywhere. | FN-M15-9.1.1–9.1.4 |
| US-M15-22 | FT-M15-10.1 | Must | As a student, I want the digital rewards shop page showing my token and syiling balance, the conversion caption, the category chips and a clear message when no reward is offered, so that I know where I stand. | FN-M15-10.1.1–10.1.9 |
| US-M15-23 | FT-M15-10.2 | Must | As a student, I want a "Tebusan Saya" page with a way back to the shop and a clear message when I have no redemption, so that I know I have nothing to claim yet. | FN-M15-10.2.1–10.2.4 |
| US-M15-24 | FT-M15-10.3 | Must | As a student, I want the "Kedai Hadiah" menu entry to open the digital shop, guests to be sent to login and wrong addresses to show the standard 404 page, so that the entry never leads to a dead page. | FN-M15-10.3.1–10.3.6 |
| US-M15-25 | FT-M15-9.1 | Must | As a user on a phone, tablet or desktop, I want S10 and S11 to fit and stay readable, so that I can use them anywhere. | FN-M15-9.1.6, 9.1.7 |

### Acceptance criteria

**US-M15-01 — Menu, titles and shells**
- **AC-M15-01.1** Given the admin at 1280px on `/gamification/rewards`, when it loads, then the sidebar shows in "Pembelajaran" the entry "Cabutan Bertuah" with the icon `fa-ticket` in fuchsia-500 and the separate gradient badge pill "🎟️" (`from-fuchsia-100 to-pink-100`, `text-fuchsia-700`) → `/cabutan`; under "Syiling & Token 🏆" the entries in the order "Tukar Token", "Cabaran Harian", "Kedai Hadiah" (`fa-gift`) → `/gamification/rewards`, "Kelulusan Hadiah" (`fa-shield-halved`, amber-500) → `/cikgu/kelulusan-hadiah`, "Marketplace", "Papan Pendahulu", "Pencapaian", "Kotak Misteri" (`fa-box-open`, indigo-500) → `/gamification/mystery-box`, "Rujuk Kawan"; in "Admin" the entry "Urus Hadiah" (`fa-gift`, pink-500) → `/admin/hadiah`.
- **AC-M15-01.2** Given the admin at 375px, when the user-portal mobile menu is opened, then its "Pembelajaran" sheet has "Cabutan Bertuah" + "🎟️" → `/cabutan`, its "Gamifikasi" sheet has "Kedai Hadiah" → `/gamification/rewards` and "Kotak Misteri" → `/gamification/mystery-box`, "Urus Hadiah" → `/admin/hadiah` is present, and no mobile-menu entry reads "Kelulusan Hadiah" or "Admin Tebusan" (live capture).
- **AC-M15-01.3** Given the admin at 1280px on a user-portal page, when it loads, then "Cikgu Alesa Tools" holds "Admin Tebusan" (`fa-cogs`, slate-500) and its link targets `/admin/hadiah/tebusan` (DV-M15-04); following it opens S2.
- **AC-M15-01.4** Given the admin at 1280px on an admin-panel page, when the "Gamifikasi" group is expanded, then it lists "Overview", "Tier Config", "Cabaran", "Pelajar", "Transaksi", "Kedai Hadiah" (`fa-gift`) → `/admin/hadiah`, "Gamifikasi Guru", "Kawalan Reward"; at 375px the bottom-nav "Lagi" popover section "Gamifikasi" contains "Kedai Hadiah" → `/admin/hadiah`.
- **AC-M15-01.5** Given S1–S4, when each loads, then the admin-panel item "Kedai Hadiah" has the active style; given S5, S6, S7, S8 at 1280px, then the active user-portal item is "Kedai Hadiah", "Kotak Misteri", "Cabutan Bertuah", "Kelulusan Hadiah" respectively, and on S7 the "Cabutan Bertuah" icon has no `text-fuchsia-500` class; at 375px the mobile menu's "Cabutan Bertuah" icon is fuchsia-500 and its "Kedai Hadiah" icon pink-500.
- **AC-M15-01.6** Given S1, S2, S3, S4 (id 1), when each loads, then the header reads "Admin — Kedai Hadiah", "Admin — Tebusan Hadiah", "Tambah Hadiah", "Edit Hadiah" with no subtitle; given S5–S8, then it reads "Kedai Hadiah", "Kotak Misteri", "Cabutan Bertuah", "Kelulusan Tebusan Hadiah", each with "Selamat datang kembali" (DV-M15-12); no M15 page header reads "Dashboard".
- **AC-M15-01.7** Given S1–S8, when each loads, then the tab titles are "Admin — Kedai Hadiah", "Admin — Tebusan Hadiah", "Tambah Hadiah", "Edit Hadiah", "Kedai Hadiah", "Kotak Misteri — PRESTASIPLUS", "Cabutan Bertuah - PRESTASIPLUS", "Kelulusan Hadiah — Ibu Bapa"; S1–S4 render in the admin-panel shell and S5–S8 in the user-portal shell.

**US-M15-02 — Access and errors**
- **AC-M15-02.1** Given no session, when I open `/admin/hadiah`, `/admin/hadiah/tebusan`, `/gamification/rewards`, `/gamification/mystery-box`, `/cabutan` or `/cikgu/kelulusan-hadiah`, then I am sent to `/login` (provisional).
- **AC-M15-02.2** Given `pelajar@demo.test`, when I open `/admin/hadiah`, `/admin/hadiah/tebusan`, `/admin/hadiah/baharu` or `/admin/hadiah/1/edit`, then I land on `/dashboard` (M01 landing page) and no admin screen renders (provisional).
- **AC-M15-02.3** Given `pelajar@demo.test`, when I open S5, S6, S7 and S8, then each renders in the user-portal shell; S8 shows "⏳ Menunggu Kelulusan (0)" and both empty messages (the student has no linked child) (provisional).
- **AC-M15-02.4** Given the admin, when I open `/gamification/rewards/1`, `/gamification/rewards/history`, `/gamification/redemptions`, `/gamification/mystery-box/1`, `/gamification/mystery-box/history`, `/cabutan/1`, `/cabutan/sejarah`, `/admin/cabutan`, `/admin/mystery-box`, `/admin/hadiah/tebusan/1`, `/admin/hadiah/99999/edit` or `/admin/hadiah/abc/edit`, then the global 404 page shows "404", "🔍", "Halaman Tidak Dijumpai", "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?", "Halaman Utama" → `/`, "Mula Latihan" → `/practice`, "PRESTASIPLUS", tab "404 - Halaman Tidak Dijumpai \| PRESTASIPLUS".
- **AC-M15-02.5** Given the admin, when I open `/admin/hadiah/1` by GET, then the same 404 page renders and no text "Oops! An Error Occurred" or "405 Method Not Allowed" appears (DV-M15-08).

**US-M15-03 — Catalogue header and cards**
- **AC-M15-03.1** Given the admin on S1, when it loads, then it shows h1 "🎁 Admin — Kedai Hadiah Digital", "Urus catalog hadiah + proses tebusan pelajar.", "Tebusan Queue" (`fa-clipboard-list`, `#3b82f6`) → `/admin/hadiah/tebusan` and "Tambah Hadiah" (`fa-plus`, `#10b981`) → `/admin/hadiah/baharu`.
- **AC-M15-03.2** Given the default seed, when S1 loads, then the cards read "TOTAL HADIAH" 59, "AKTIF" 0, "TEBUSAN BULAN INI" 0, "PENDING PROSES" 0 (labels upper case by CSS; values in slate-800, emerald-600, blue-600, amber-600).
- **AC-M15-03.3** Given `?cat=telco`, `?cat=bogus` and `?page=2`, when each loads, then the four cards still read 59, 0, 0, 0.

**US-M15-04 — Category filter and table**
- **AC-M15-04.1** Given S1 without `cat`, when it loads, then the ten pills "Semua", "🏆 Mahkota", "💳 E-Wallet", "📱 Telco", "🎮 Gaming", "🎬 Streaming", "🍔 F&B", "🛒 E-Commerce", "📚 Pembelajaran", "🎭 Hiburan" link to `?cat=all`, `flagship`, `ewallet`, `telco`, `gaming`, `streaming`, `food_beverage`, `ecommerce`, `education`, `entertainment`, and only "Semua" has the active style (`#7c3aed`, white).
- **AC-M15-04.2** Given each category pill, when it is followed, then that pill alone is active and the table lists exactly: flagship 56–59 (4), ewallet 39–46 (8), telco 9–19 (11), gaming 1–8 (8), streaming 20–25 (6), food_beverage 26–33 (8), ecommerce 34–38 (5), education 47–52 (6), entertainment 53–55 (3), in id order, with no pager.
- **AC-M15-04.3** Given `?cat=bogus`, when it loads, then the page is shown (not an error), no pill is active and the table body is the single row "Tiada hadiah dalam kategori ini.".
- **AC-M15-04.4** Given S1, when it loads, then the table header shows a checkbox and "HADIAH", "KATEGORI", "RM", "TOKEN", "STOK", "TEBUSAN", "STATUS", "TINDAKAN" (upper case by CSS).
- **AC-M15-04.5** Given S1 page 1, when it loads, then the rows are ids 1…50 in order; row 1 reads "🎮 Roblox Gift Card RM10" / "Roblox", "🎮 Gaming", "RM10", "10", "∞", "0", "Off"; row 9 "📱 Hotlink Topup RM5" / "Hotlink", "📱 Telco Topup", "RM5", "5", "5", "0", "Off"; row 26 has Kategori "🍔 Makanan & Minuman"; rows 10 and 16 show Tebusan "0"; on page 2 row 59 reads "🏆 Roblox Gift Card RM1000 🏆" / "Roblox", "🏆 Mahkota", "RM1000", "1000", "∞", "0", "Off".
- **AC-M15-04.6** Given any row, when it renders, then Tindakan holds exactly one link "Edit" (`#3b82f6`) → `/admin/hadiah/{id}/edit` and no other control.

**US-M15-05 — Pagination**
- **AC-M15-05.1** Given S1 at 768px and 1280px, when page 1 loads, then the pager reads "Showing 1 to 50 of 59 results" with "1" (current, not a link) and "2" → `?page=2` and a next arrow → `?page=2`; page 2 reads "Showing 51 to 59 of 59 results" and lists ids 51–59.
- **AC-M15-05.2** Given any category pill, when it is followed, then no pager is shown.
- **AC-M15-05.3** Given S1 at 375px, when page 1 loads, then the pager shows "« Previous" (not a link) and "Next »" → `?page=2`; on page 2 "« Previous" → `?page=1` and "Next »" is not a link.
- **AC-M15-05.4** Given `?page=3`, when it loads, then the pager reads "Showing 0 of 59 results" and the table body is the single row "Tiada hadiah di halaman ini." (DV-M15-07); given `?cat=bogus&page=3`, then the row reads "Tiada hadiah dalam kategori ini.".

**US-M15-06 — Selection and toolbar**
- **AC-M15-06.1** Given S1 with nothing ticked, when I tick row 1, then the toolbar appears with "1 hadiah dipilih" and the buttons "Aktifkan", "Nyahaktifkan", "Set Stok", "Had/Bulan", "Pelaras Token", "Padam", "Batal" with the icons and colours of FN-2.5.3; after scrolling down the toolbar stays pinned near the top (sticky).
- **AC-M15-06.2** Given S1 page 1, when I tick the header checkbox, then all 50 rows are ticked and the toolbar reads "50 hadiah dipilih"; when I untick one row, then the header checkbox is unticked and the count is 49; when I tick it again, then the header checkbox is ticked; on page 2 the header checkbox ticks 9 rows.
- **AC-M15-06.3** Given S1 after load or after unticking every row, then the toolbar is hidden.
- **AC-M15-06.4** Given ticked rows, when I click the toolbar "Batal", then every checkbox is unticked, the toolbar is hidden, the URL is unchanged and no request is sent.

**US-M15-07 — Activate, deactivate, delete**
- **AC-M15-07.1** Given rows 1 and 2 ticked, when I click "Aktifkan" and accept "Aktifkan 2 hadiah?", then S1 reloads at the same URL with no tick, rows 1 and 2 show the pill "On" (PROPOSED) and the card "Aktif" reads 2 (provisional).
- **AC-M15-07.2** Given rows 1 and 2 ticked, when I click "Aktifkan", "Nyahaktifkan" or "Padam" and dismiss the dialog, then the dialog texts are "Aktifkan 2 hadiah?", "Nyahaktifkan 2 hadiah?" and "Padam 2 hadiah secara kekal? (Hadiah dengan sejarah tebusan tidak akan dipadam)", no request is sent and the ticks remain.
- **AC-M15-07.3** Given rewards 1 and 2 active, when I tick them, click "Nyahaktifkan" and accept, then both show "Off" and "Aktif" reads 0 (provisional).
- **AC-M15-07.4** Given rows 1 and 10 ticked, when I click "Padam" and accept, then reward 1 is gone, reward 10 remains (it has cancelled redemptions), "Total Hadiah" reads 58, the pager reads "Showing 1 to 50 of 58 results" and `/admin/hadiah/1/edit` shows the 404 page (provisional).
- **AC-M15-07.5** Given `?cat=gaming` with row 1 ticked, when I accept "Aktifkan", then the page reloads at `?cat=gaming` with no message (provisional).

**US-M15-08 — Stock, monthly cap, token price**
- **AC-M15-08.1** Given rows 1 and 2 ticked, when I click "Set Stok", then the prompt text is "Tetapkan stok untuk 2 hadiah.\n\nMasukkan nombor (cth: 100), atau biarkan kosong untuk tanpa had (∞):"; entering "abc", "-1", "1.5" or "1000000" shows the alert "Masukkan nombor sah (0-999999) atau kosong untuk ∞." and sends nothing; Cancel sends nothing.
- **AC-M15-08.2** Given rows 1 and 2 ticked, when I enter "100" in "Set Stok", then both rows show Stok "100"; when I then set "" (empty), they show "∞"; "0" shows "0" (provisional).
- **AC-M15-08.3** Given row 1 ticked, when I click "Had/Bulan", then the prompt text is "Tetapkan had bulanan/pelajar untuk 1 hadiah.\n\nMasukkan nombor (cth: 5), atau 0 / kosong untuk tanpa had:"; "100" or "abc" shows the alert "Masukkan nombor sah (0-99) atau kosong untuk ∞." and sends nothing; "5" → `/admin/hadiah/1/edit` shows "Maks/bulan/pelajar" 5; "0" and "" → the field is empty (no cap) (provisional).
- **AC-M15-08.4** Given row 2 ticked, when I click "Pelaras Token", then the prompt text is exactly the FN-2.6.5 text; "0", "-91", "501" or "abc" shows the alert "Masukkan peratus sah antara -90 dan +500 (bukan 0)." and sends nothing; "+50" asks "Sahkan: naikkan kos token sebanyak 50% untuk 1 hadiah?"; "-25" asks "Sahkan: turunkan kos token sebanyak 25% untuk 1 hadiah?"; dismissing sends nothing.
- **AC-M15-08.5** Given row 2 (50 token) ticked, when I accept "+50", then its Token reads 75 and RM stays "RM50"; given row 3 (100 token) and "-25", then it reads 75; given row 4 (5 token) and the raw text "12.7" (sent unchanged, applied as 12%), then it reads 6 (round(5.6)) (provisional).

**US-M15-09 — Create**
- **AC-M15-09.1** Given S3, when it loads, then it shows the link "← Kembali ke senarai" → `/admin/hadiah`, h1 "➕ Tambah Hadiah Baharu" and the 17 fields of FN-3.1.3–3.1.11 with their exact labels, names, types, constraints and placeholders; defaults: Kategori "🏆 Mahkota (RM500+)", "Sah Hari (default 365)" 365, Delivery "Manual (admin paste)", "Display Order" 100, "Aktif" checked, "Perlu kelulusan ibu bapa" unchecked, the rest empty; the "Kos Token" hint reads "1 token = RM1" (DV-M15-14) and is at least 12px.
- **AC-M15-09.2** Given S3 at 768px and 1280px, then Kategori and Vendor share a row, Nilai / Kos Token / Emoji Icon share a row, Stok / Maks / Sah Hari share a row and Delivery / Vendor SKU / Display Order share a row; at 375px every field is in one column.
- **AC-M15-09.3** Given S3 empty, when I click "➕ Tambah", then `vendor`, `title`, `denomination_rm` and `token_cost` are invalid (native bubble), no request is sent; "Kos Token" 0 or 10001, "Stok" −1, "Maks/bulan/pelajar" 0 or 100, "Sah Hari" 1826, "Display Order" 10000 and "Image URL" "abc" are each invalid and block the submit.
- **AC-M15-09.4** Given S3 with Kategori "📱 Telco", Vendor "Demo Telco", Tajuk "Topup Demo RM5", Nilai 5, Kos Token 5 and the other defaults, when I click "➕ Tambah", then S1 shows "Total Hadiah" 60, "Aktif" 1, and a new row "Topup Demo RM5" / "Demo Telco", "📱 Telco Topup", "RM5", "5", "∞", "0", "On" in second position (display order 100 after reward 1, id 60); no message is shown (provisional).
- **AC-M15-09.5** Given typed values on S3, when I click "Batal" or "← Kembali ke senarai", then S1 opens without a confirm and "Total Hadiah" still reads 59.

**US-M15-10 — Edit**
- **AC-M15-10.1** Given `/admin/hadiah/1/edit`, when it loads, then h1 reads "✏️ Edit Hadiah: Roblox Gift Card RM10" and the fields hold Kategori "🎮 Gaming", Vendor "Roblox", Tajuk "Roblox Gift Card RM10", Penerangan "Tukar untuk Robux dalam Roblox.", Nilai 10, Kos Token 10, Emoji "🎮", Stok empty, Maks/bulan/pelajar 30, Sah Hari 365, Delivery "Manual (admin paste)", Vendor SKU empty, Display Order 100, Image URL empty, Terma Khas empty, "Aktif" unchecked, "Perlu kelulusan ibu bapa" checked; the form posts to `/admin/hadiah/1` with `_method=PUT`.
- **AC-M15-10.2** Given `/admin/hadiah/9/edit`, then h1 "✏️ Edit Hadiah: Hotlink Topup RM5", Kategori "📱 Telco", Stok 5, Maks/bulan/pelajar empty, Sah Hari 30, consent unchecked; given `/admin/hadiah/59/edit`, then h1 "✏️ Edit Hadiah: Roblox Gift Card RM1000 🏆", Penerangan "~13,400 Robux. Untuk mega-fan Roblox.", Kategori "🏆 Mahkota (RM500+)", Nilai 1000, Maks/bulan/pelajar 1, consent checked.
- **AC-M15-10.3** Given `/admin/hadiah/9/edit`, when I change Tajuk to "Hotlink Topup RM5 Baru" and click "💾 Simpan", then S1 row 9 reads "📱 Hotlink Topup RM5 Baru" (provisional); when I clear Vendor and click "💾 Simpan", then Vendor is invalid and no request is sent.
- **AC-M15-10.4** Given S4 with a changed value, when I click "Batal" or "← Kembali ke senarai", then S1 opens and row 9 is unchanged; S4 has no delete control.

**US-M15-11 — Redemption queue**
- **AC-M15-11.1** Given S2, when it loads, then it shows h1 "📋 Admin — Tebusan Hadiah Pelajar", "Beli kod dari reseller, paste kat sini untuk hantar kepada pelajar." and "Kembali ke Catalog" (`fa-store`, `#7c3aed`) → `/admin/hadiah`.
- **AC-M15-11.2** Given the default seed, when S2 loads without `status`, then "⏳ Pending Admin" is the active pill, the pills link to `?status=pending_admin`, `pending_parent_consent`, `delivered`, `cancelled`, `all`, the columns are "PELAJAR", "HADIAH", "RM", "TOKEN", "STATUS", "TARIKH", "TINDAKAN" (upper case by CSS) and the body is "Tiada tebusan dalam status ini."; the same empty row shows for `pending_parent_consent` and `delivered`.
- **AC-M15-11.3** Given `?status=cancelled`, when it loads, then "❌ Cancelled" is active and three rows show, in this order: "Pelajar Demo Hadiah 1" / "hadiah1@demo.test", "Hotlink Topup RM10" / "Hotlink", "RM10", "10", "❌ Dibatalkan" (`#64748b`), "30/04 14:11", empty Tindakan; then twice "Pelajar Demo Hadiah 2" / "hadiah2@demo.test", "CelcomDigi Topup RM30" / "CelcomDigi", "RM30", "30", "❌ Dibatalkan", "30/04 04:54", empty Tindakan; `?status=all` shows the same three rows with "Semua" active.
- **AC-M15-11.4** Given `?status=bogus`, when it loads, then no pill is active and the body is "Tiada tebusan dalam status ini.".

**US-M15-12 — Fulfilment**
- **AC-M15-12.1** Given fixture `queue`, when S2 loads, then the `pending_admin` list holds 15101 ("Pelajar Demo" / "pelajar@demo.test", "TnG eWallet RM10" / "Touch n Go", "RM10", "10", pill "⏳ Pending Admin", "24/09 20:15") with a code field "Kod voucher", "Hantar" and "Batalkan"; `?status=pending_parent_consent` holds 15102 with pill "⏳ Pending Ibu Bapa" and no action; `?status=delivered` holds 15103 with pill "🎁 Delivered" and no action (provisional).
- **AC-M15-12.2** Given fixture `queue`, when I type "DEMO-TNG-0001" in 15101's field and click "Hantar", then the pending list is empty, 15101 appears under "🎁 Delivered", and S1 "Pending Proses" reads 0; with the field empty "Hantar" sends nothing (provisional).
- **AC-M15-12.3** Given fixture `queue` with student 2 holding 20 tokens, when I click "Batalkan" on 15101, then it appears under "❌ Cancelled" with "❌ Dibatalkan", student 2's token balance (M14) is 30 and reward 40's Stok reads 5 again (provisional).

**US-M15-13 — Redemption rules** (exercised through the test hook `m15Redeem`, because the shop UI is not built (OQ-M15-01 decision))
- **AC-M15-13.1** Given reward 40 active (stock 5) and student 2 with 20 tokens, when student 2 redeems it, then a `pending_admin` redemption exists with RM10 / 10 token, student 2 has 10 tokens, reward 40 shows Stok 4 and Tebusan 1 on S1 (provisional).
- **AC-M15-13.2** Given reward 1 active (consent) and student 4 with 15 tokens, when student 4 redeems it, then its status is `pending_parent_consent`, student 4 has 5 tokens, and the parent's S8 counts it (provisional).
- **AC-M15-13.3** Given student 2 with 5 tokens, when redeeming reward 40 (10 token), then it is refused (`INSUFFICIENT_TOKENS`) and nothing changes; given reward 41 inactive, then it is refused (`NOT_FOUND`) (provisional).
- **AC-M15-13.4** Given reward 40 active with Stok 0, then a redemption is refused (`OUT_OF_STOCK`); given reward 50 active (cap 1) already redeemed by student 2 this month, then a second one is refused (`MONTHLY_CAP`), and after that first one is cancelled a new one is accepted (provisional).
- **AC-M15-13.5** Given fixture `queue`, when S1 loads, then "Pending Proses" reads 1, "Tebusan Bulan Ini" 3, and the Tebusan column reads 1 for rewards 1, 26 and 40 and 0 for 10 and 16 (the three seeded cancelled rows are not counted) (provisional).

**US-M15-14 — Student shop**
- **AC-M15-14.1** Given the admin on S5, when it loads, then it shows h1 "🎁 Kedai Hadiah" (14px at 375, 24px from 640), "Tebus token anda untuk hadiah menarik!", the tile "0" / "Baki Token 🎫", and the empty state "🎁", "Tiada Hadiah Tersedia", "Hadiah akan ditambah tidak lama lagi. Tunggu ya!".
- **AC-M15-14.2** Given `/gamification/rewards?category=gaming`, when it loads, then it is identical to S5 without the query.
- **AC-M15-14.3** Given the admin's token balance set to 50 (M14 hook), when S5 loads, then the tile reads "50" (provisional).
- **AC-M15-14.4** Given reward 1 activated on S1, when S5 loads, then it still shows the empty state and no reward card or claim control (user decision, OQ-M15-01 closed) (provisional).

**US-M15-15 — Mystery box page**
- **AC-M15-15.1** Given the admin on S6, when it loads, then it shows "📦 Kotak Misteri", "Buka kotak & menang ganjaran rawak — nasib baik menanti!" and "🎫 Token Anda: 0".
- **AC-M15-15.2** Given S6, when it loads, then four cards show, in order, the icon, name, description, cost, "🪙" range and "⭐ … XP" range of FN-6.1.3 with their header colours; cards 2–4 carry the ribbons "RARE", "EPIC", "LEGENDARY" (upper case by CSS) and card 1 none; each card is a form posting to `/gamification/mystery-box/{1-4}/open`.
- **AC-M15-15.3** Given the admin with 0 tokens, when S6 loads, then all four buttons read "🔒 Token Tidak Cukup" on the `#d1d5db` background with text colour `#4b5563` (contrast ≥ 4.5:1, DV-M15-20) and are disabled, and clicking them sends nothing.

**US-M15-16 — Opening a box**
- **AC-M15-16.1** Given the admin with 5 tokens, when S6 loads, then "Kotak Gangsa" and "Kotak Perak" show the enabled "Buka Kotak" and "Kotak Emas" and "Kotak Legenda" stay "🔒 Token Tidak Cukup"; with 25 tokens all four are enabled (provisional).
- **AC-M15-16.2** Given the admin with 5 tokens and the next result set to 12 syiling and 4 XP, when I open "Kotak Gangsa", then a modal shows "📦", "Kotak Gangsa", "+12 🪙 · +4 XP" and "Tutup", and the chip reads "🎫 Token Anda: 3"; "Tutup" closes it (provisional).
- **AC-M15-16.3** Given that opening, when S6 reloads, then the card "Sejarah Kotak Misteri" lists "Kotak Misteri: Kotak Gangsa", "+12 🪙 · +4 XP", "25/09 15:40" first; with no opening the card is absent (provisional).
- **AC-M15-16.4** Given that opening, then the M14 wallet shows 268 syiling (256 + 12), 3 tokens and 12 XP, the M14 ledger has a row "Kotak Misteri: Kotak Gangsa" +12, and the S7 tile reads "268 🪙" (provisional).

**US-M15-17 — Lucky draw page**
- **AC-M15-17.1** Given the admin on S7 with no open draw, when it loads, then it shows "🎟️ Cabutan Bertuah", "Guna syiling untuk beli tiket & menangi hadiah hebat!", "SYILING ANDA" (upper case by CSS) "256 🪙", h2 "Cabutan Dibuka" and "Tiada cabutan dibuka buat masa ini. Nanti datang lagi! 🎈"; no winners or closed-draw section exists.

**US-M15-18 — Buying tickets**
- **AC-M15-18.1** Given an open M14 draw 1 "Cabutan Demo" (description "Cabutan ujian.", ticket 50 syiling, max 10 per student, prize pool `[{"label":"Baucar Topup RM50","value_sen":5000,"qty":1},{"label":"Baucar RM5","value_sen":500,"qty":10}]`, closes 2026-09-30), when S7 loads, then the empty box is gone and a card shows "Cabutan Demo", "Cabutan ujian.", "Harga tiket: 50 🪙", "Tiket anda: 0/10", "Tutup: 30/09/2026", "Baucar Topup RM50 × 1", "Baucar RM5 × 10" and "🎟️ Beli Tiket" (provisional).
- **AC-M15-18.2** Given that draw, when the admin clicks "🎟️ Beli Tiket", then the tile reads "206 🪙" and the card "Tiket anda: 1/10" (provisional).
- **AC-M15-18.3** Given a balance of 40 syiling, or 10 tickets already held, then "🎟️ Beli Tiket" is disabled; a draw that is closed or past its close date is not listed (provisional).

**US-M15-19 — Consent page**
- **AC-M15-19.1** Given the admin on S8, when it loads, then it shows "👨‍👩‍👧 Kelulusan Tebusan Hadiah", "Anak anda nak tebus hadiah yang memerlukan kelulusan ibu bapa. Sila semak.", "⏳ Menunggu Kelulusan (0)", "Tiada tebusan menunggu kelulusan.", "📜 Sejarah Tebusan Anak" and "Belum ada sejarah tebusan.".
- **AC-M15-19.2** Given fixture `queue`, when the parent (6) opens S8, then the heading reads "⏳ Menunggu Kelulusan (1)" with 15102 only and the history lists 15101 and 15103 (child 2); the admin and parent 5401 (no links) still see "(0)" and both empty messages (provisional).

**US-M15-20 — Approve or reject**
- **AC-M15-20.1** Given fixture `queue` and the parent on S8, then 15102 shows "Pelajar Maju Demo", "🎮 Roblox Gift Card RM10", "10 token", "25/09 09:30", "✅ Lulus" and "❌ Tolak" (provisional).
- **AC-M15-20.2** Given that card, when the parent clicks "✅ Lulus", then the heading reads "(0)" with "Tiada tebusan menunggu kelulusan.", the history lists 15102 with "⏳ Pending Admin", and S2's default list holds 15102 (provisional).
- **AC-M15-20.3** Given that card, when the parent clicks "❌ Tolak", then the history lists 15102 with "❌ Dibatalkan", student 4's token balance rises by 10 and reward 1's Tebusan reads 0 (provisional).
- **AC-M15-20.4** Given parent 5401 (no links), when it posts approve for 15102, then the request is refused (`NOT_FOUND`) and 15102 stays `pending_parent_consent` (provisional).
- **AC-M15-20.5** Given a session whose role is not parent (admin, student or teacher), when it posts approve or reject for 15102, then the request is refused (`FORBIDDEN`, 403, not 404) and 15102 stays `pending_parent_consent`; a parent without a link to that child still gets `NOT_FOUND` (provisional).

**US-M15-21 — Responsive, readability, accessibility, states**
- **AC-M15-21.1** Given S1–S8 and the 404 page at 375, 768 and 1280px, when each renders (S1 also with the toolbar visible), then the page has no horizontal scroll.
- **AC-M15-21.2** Given S1 and S2 (`?status=cancelled`) at 375 and 768px, when they render, then the table container scrolls horizontally inside its card, and after scrolling the S1 "Edit" link of row 1 and the S2 "TARIKH" and "TINDAKAN" columns are visible; at 1280px the tables fit without scrolling.
- **AC-M15-21.3** Given 375px, then S1 cards are 2×2, the pills wrap, the toolbar buttons wrap to three rows, S3/S4 fields are one column and S6 shows one box per row; at 768px S1 cards are one row of four, S6 shows three boxes per row; at 1280px S6 shows four.
- **AC-M15-21.4** Given every M15 screen at every width, when it renders, then no text inside the page content is smaller than 12px, including the "Off" pill, "❌ Dibatalkan", the "1 token = RM1" hint and the box ribbons (DV-M15-13).
- **AC-M15-21.5** Given S1 and S3, then the dialogs are the browser's own `confirm`/`prompt`/`alert`, the form errors are the browser's native bubbles, and no ARIA attribute is added beyond the live pager's.
- **AC-M15-21.6** Given the mock set to fail the next S1 or S2 list request, when the page loads, then the shared error state is shown (global convention) and the page does not scroll sideways.

**Row L43 (v1.4).** Fixtures as above. "The admin" = id 1 (wallet 256 syiling, 0 token, Gangsa tier, rate 50 per M14). "The student" = id 2 with the M14 hook `setWallet(2, {syiling: 300, tokens: 20})`. **(provisional)** as in the paragraph above; "Perlu pengesahan" items (murid view) are provisional. v1.5: the L43 audit observed `?cat=flagship` and `?cat=bogus`, so AC-22.5 and AC-22.6 are no longer provisional.

**US-M15-22 — Student shop page (S10)**
- **AC-M15-22.1** Given the admin, when I open `/cikgu/hadiah`, then the page renders in the user-portal shell with tab title "Kedai Hadiah Digital", header "Kedai Hadiah Digital" with the subtitle "Selamat datang kembali" (DV-M15-17), h1 "🎁 Kedai Hadiah Digital" and the subtitle "Tukar token kepada hadiah digital — terus dihantar, tanpa pos.".
- **AC-M15-22.2** Given the admin on S10, when it loads, then the balance card (purple-to-pink gradient) shows the label with the **rendered** text "TOKEN ANDA" (DOM text "Token Anda", upper case by CSS) and the value "0", a divider, the label with the rendered text "SYILING" (DOM "Syiling") and the value "256", the caption "50 syiling = 1 token" (DV-M15-16; live "100 syiling = 1 token") and a white button "Tebusan Saya" with a clipboard icon whose link is `/cikgu/hadiah/saya`.
- **AC-M15-22.3** Given S10 without `cat`, when it loads, then ten chips read "🌟 Semua", "🏆 Mahkota", "💳 E-Wallet", "📱 Telco", "🎮 Gaming", "🎬 Streaming", "🍔 Makan & Minum", "🛒 Shopping", "📚 Pembelajaran", "🎭 Hiburan" in that order, link to `?cat=all`, `flagship`, `ewallet`, `telco`, `gaming`, `streaming`, `food_beverage`, `ecommerce`, `education`, `entertainment`, and only "🌟 Semua" has the active style (purple fill, white text).
- **AC-M15-22.4** Given S10 without `cat`, when it loads, then the area below the chips reads "Tiada hadiah dalam kategori ini." (centred, grey) and no reward card, price, stock or "Tebus" control exists.
- **AC-M15-22.5** Given each of the ten chips, when it is followed (`?cat=all`, `flagship`, `gaming` OBSERVED; the others INFERRED), then the URL carries that `cat`, the page keeps the same title, balance card and chips, shows "Tiada hadiah dalam kategori ini.", and that chip alone is active (OBSERVED for `all`, `flagship`, `gaming`, `ewallet`, `telco`, `entertainment`).
- **AC-M15-22.6** Given `/cikgu/hadiah?cat=bogus`, when it loads, then the page is shown (200, not an error), the empty copy of AC-22.4 is shown and no chip is active (OBSERVED).
- **AC-M15-22.7** Given student 2 with 20 tokens and 300 syiling (M14 hook), when S10 loads, then the card shows "20" and "300" and the caption carries that student's M14 tier rate (provisional; the murid view is Perlu pengesahan).
- **AC-M15-22.8** Given reward 1 activated on S1 (hook) or any account, when S10 loads with any `cat`, then it still shows the empty state of AC-22.4 and no card or claim control (precedent OQ-M15-01; provisional).

**US-M15-23 — Tebusan Saya (S11)**
- **AC-M15-23.1** Given the admin, when I open `/cikgu/hadiah/saya`, then the user-portal shell shows tab title "Tebusan Saya", header "Tebusan Saya" with "Selamat datang kembali" (DV-M15-17), h1 "📋 Tebusan Saya", a link button "🎁 Kedai Hadiah" → `/cikgu/hadiah`, a decorative "🎁" (48px) above the text, the text "Belum ada tebusan. Kumpul syiling dulu, lepas tukar token dan tebus hadiah." and a link "Layari Kedai Hadiah" → `/cikgu/hadiah`; no list, chip or filter exists.
- **AC-M15-23.2** Given S11, when I follow "🎁 Kedai Hadiah" or "Layari Kedai Hadiah", then S10 opens in its default state (AC-22.3).
- **AC-M15-23.3** Given fixture `queue` (student 2 owns redemptions 15101 and 15103), when student 2 opens S11, then it still shows the empty state of AC-23.1 (S11 does not read the redemption store; precedent OQ-M15-01; provisional).

**US-M15-24 — Access, entry point and 404**
- **AC-M15-24.1** Given no session, when I open `/cikgu/hadiah`, `/cikgu/hadiah?cat=gaming` or `/cikgu/hadiah/saya`, then I am sent to `/login` (provisional).
- **AC-M15-24.2** Given a logged-in student, parent or teacher, when I open S10 and S11, then each renders in the user-portal shell with the same content as for the admin apart from the wallet figures (provisional; Perlu pengesahan for the murid view).
- **AC-M15-24.3** Given the admin, when I open `/kedai-hadiah`, `/hadiah`, `/kedai` or `/cikgu/hadiah/1`, then the global 404 page of AC-02.4 renders (tab "404 - Halaman Tidak Dijumpai | PRESTASIPLUS").
- **AC-M15-24.4** Given a logged-in student at 1280px, when I look at the user sidebar, then the entry "Kedai Hadiah 🎁" with the badge "DIGITAL" links to `/cikgu/hadiah` (not `/kedai-hadiah`) and following it opens S10, not the 404 page; the same target applies wherever the shell lists the entry (provisional; the student nav is INFERRED).
- **AC-M15-24.5** Given the admin, when I look at the user sidebar, then no entry links to `/cikgu/hadiah`, and the entry "Kedai Hadiah" → `/gamification/rewards` still opens S5 with its own title "Kedai Hadiah" and its own copy (AC-14.1).

**US-M15-25 — Responsive and readability (S10, S11)**
- **AC-M15-25.1** Given S10 and S11 at 375, 768 and 1280px, when each renders, then the page has no horizontal scroll; at 375 the balance card spans the content width with the button inside it and the chips wrap onto four rows; at 768 the card sits under the subtitle at its natural width (369px) and the chips wrap onto two rows (six and four); at 1280 the card sits at the right of the title block and the chips wrap onto two rows (eight and two).
- **AC-M15-25.2** Given S10 and S11 at every width, when they render, then no text inside the page content is smaller than 12px, including the caption (live 9px) and the two card labels (live 10px) (DV-M15-19); icons and emoji keep their size.
- **AC-M15-25.3** Given the mock set to fail the next wallet or shop-list request, when S10 loads, then the shared error state is shown (global convention), no L43-specific error copy appears and the page does not scroll sideways.

---

## 5. UI expectations

| Screen | Key states (screenshots in `docs/discovery/img/M15/`) | Behaviour notes |
|---|---|---|
| S1 | default (`hadiah-desktop/-tablet/-mobile.png`), category (`hadiah-cat-flagship.png`), bulk (`hadiah-bulk-toolbar.png`, `hadiah-mobile-bulk.png`), page 3 (`hadiah-page-3-empty.png`) | Header wraps at 375 (h1 two lines, the two buttons side by side, labels on two lines); cards 2×2 below 768, four from 768; pills wrap (4 rows at 375, 2 at 768/1280); table scrolls in its card at 375/768 (DV-M15-01); toolbar sticky, 3 rows of buttons at 375, 2 at 768 ("Batal" alone), 1 at 1280. |
| S2 | empty (`tebusan-desktop-empty.png`, `tebusan-mobile-empty.png`), all (`tebusan-desktop-all.png`, `tebusan-tablet-all.png`, `tebusan-mobile-all.png`) | h1 wraps to three lines at 375 beside "Kembali ke Catalog" (three-line label); pills two rows at 375; table scrolls in its card at 375/768 (DV-M15-01). |
| S3 / S4 | `baharu-desktop/-mobile.png`, `edit-desktop/-tablet/-mobile.png`, `edit-404.png` | Card `max-w-3xl`; one column below 768, 2/3-column rows from 768; buttons side by side at every width. |
| S5 | `rewards-desktop/-tablet/-mobile.png` | Hero stacks below 768; h1 14px below 640. Empty state only (user decision, OQ-M15-01). |
| S6 | `mystery-box-desktop/-tablet/-mobile.png` | Grid 1 column at 375 (cards 342×333), 3 at 768 (fourth on a second row), 4 at 1280. Result modal and history are PROPOSED (provisional). |
| S7 | `cabutan-desktop/-tablet/-mobile.png` | Header `flex-wrap`: the balance tile moves under the title at 375. Draw cards PROPOSED (provisional). |
| S8 | `kelulusan-desktop/-tablet/-mobile.png` | Single column at every width. Request cards and history rows PROPOSED (provisional). |
| S9 / 404 | `hadiah-show-405.png`, `edit-404.png` | Global 404 page for both (DV-M15-08). |
| S10 (v1.4) | `docs/discovery/img/L43/cikgu-hadiah-1280.png`, `-768.png`, `-375.png` | 1280: title block left, gradient balance card right on the same row; chips two rows (8 + 2); empty line centred below. 768: title block, then the card at natural width (about half the content width) left-aligned; chips two rows (6 + 4). 375: title (one line) and subtitle (two lines), the card full width (324px) with "TOKEN ANDA" on two lines and the button wrapping to "Tebusan / Saya", chips four rows (3 + 3 + 2 + 2). Chat button bottom right; bottom nav below 1024px. Empty state only (precedent OQ-M15-01). |
| S11 (v1.4; measured v1.5) | `docs/discovery/img/L43/cikgu-hadiah-saya-1280.png`, `-768.png`, `-375.png` | Title row stays on **one row at every width**: h1 left, the "🎁 Kedai Hadiah" button right-aligned, no overlap. 375: h1 wraps to two lines (174×64) beside the button (150×64); 768: h1 188×32, button 160×40 at the right; 1280: same sizes. Below: a white card with the centred 🎁 (48px), the empty text and the link. No horizontal scroll at any width. |

Loading: pages show the shared shell loading behaviour while the mock responds (live pages are server-rendered). No M15-specific error or success copy exists on live; after saves and bulk actions the rebuild shows no message (none observed, none invented; Q-M15-7).

---

## 6. Coverage matrix (completeness proof)

Source: `docs/discovery/inventory/M15/` (generated 2026-09-26). Generated by script (`matrix.cjs` in the author's scratchpad `m15-writer/`; reproducible from the Function catalogue above and the inventory JSON). Every M15 content element (S1–S9) is listed with the Function that covers it or with a concrete exclusion reason; each element maps to exactly one entry. Table cells of the catalogue and queue are not inventoried (discovery `_summary.md`); their content is covered by FN-M15-2.3.2 and FN-M15-4.1.4 from the snapshot.

**Summary**

| Set | Elements | Mapped to an M15 Function | Excluded (with reason) | Unmapped |
|---|---|---|---|---|
| S1 — `/admin/hadiah` | 58 | 58 | 0 | 0 |
| S2 — `/admin/hadiah/tebusan` | 9 | 9 | 0 | 0 |
| S3 — `/admin/hadiah/baharu` | 40 | 40 | 0 | 0 |
| S4 — `/admin/hadiah/{id}/edit` | 54 | 54 | 0 | 0 |
| S5 — `/gamification/rewards` | 10 | 7 | 3 | 0 |
| S6 — `/gamification/mystery-box` | 58 | 55 | 3 | 0 |
| S7 — `/cabutan` | 9 | 6 | 3 | 0 |
| S8 — `/cikgu/kelulusan-hadiah` | 9 | 6 | 3 | 0 |
| S9 — `/admin/hadiah/{id}` | 3 | 3 | 0 | 0 |
| **M15 content (S1–S9)** | **250** | **238** | **12** (M16 tournament banner "LIVE:", "MAIN", "DAFTAR" — EL-M15-S5…S8-001–003) | **0** |
| S10 — `/cikgu/hadiah` (v1.4, L43; audited v1.5) | 19 | 19 | 0 | 0 |
| S11 — `/cikgu/hadiah/saya` (v1.4, L43; audited v1.5) | 5 | 5 | 0 | 0 |
| **M15 content incl. L43 (S1–S11)** | **274** | **262** | **12** | **0** |
| SHA — admin-panel shell (chrome of S1–S4) | 207 | 6 | 201 | 0 |
| SHU — user-portal shell (chrome of S5–S8) | 372 | 21 | 351 | 0 |

**250/250 M15 content elements covered (238 mapped, 12 excluded with reason), 0 unmapped.** Including the two shells: 829/829 elements accounted for (265 mapped, 564 excluded with reason), 0 unmapped. 65 Functions appear in this matrix; the others are behaviour-only Functions (access, server rules, SOURCE-DERIVED or PROPOSED states, deviations without an element) with no element of their own.

### 6.1 M15 content elements

#### S1 — `/admin/hadiah` (58 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M15-S1-001 | heading | visible-default | "🎁 Admin — Kedai Hadiah Digital" | FN-M15-2.1.1 |
| EL-M15-S1-002 | text | visible-default | "Urus catalog hadiah + proses tebusan pelajar." | FN-M15-2.1.1 |
| EL-M15-S1-003 | link | visible-default | "Tebusan Queue", → /admin/hadiah/tebusan, fa-clipboard-list | FN-M15-2.1.2 |
| EL-M15-S1-004 | link | visible-default | "Tambah Hadiah", → /admin/hadiah/baharu, fa-plus | FN-M15-2.1.3 |
| EL-M15-S1-005 | text | visible-default | "Total Hadiah" | FN-M15-2.1.4 |
| EL-M15-S1-006 | text | visible-default | "59" | FN-M15-2.1.4 |
| EL-M15-S1-007 | text | visible-default | "Aktif" | FN-M15-2.1.5 |
| EL-M15-S1-008 | text | visible-default | "0" | FN-M15-2.1.5 |
| EL-M15-S1-009 | text | visible-default | "Tebusan Bulan Ini" | FN-M15-2.1.6 |
| EL-M15-S1-010 | text | visible-default | "0" | FN-M15-2.1.6 |
| EL-M15-S1-011 | text | visible-default | "Pending Proses" | FN-M15-2.1.7 |
| EL-M15-S1-012 | text | visible-default | "0" | FN-M15-2.1.7 |
| EL-M15-S1-013 | link | visible-default | "Semua", → /admin/hadiah?cat=all | FN-M15-2.2.1 |
| EL-M15-S1-014 | link | visible-default | "🏆 Mahkota", → /admin/hadiah?cat=flagship | FN-M15-2.2.1 |
| EL-M15-S1-015 | link | visible-default | "💳 E-Wallet", → /admin/hadiah?cat=ewallet | FN-M15-2.2.1 |
| EL-M15-S1-016 | link | visible-default | "📱 Telco", → /admin/hadiah?cat=telco | FN-M15-2.2.1 |
| EL-M15-S1-017 | link | visible-default | "🎮 Gaming", → /admin/hadiah?cat=gaming | FN-M15-2.2.1 |
| EL-M15-S1-018 | link | visible-default | "🎬 Streaming", → /admin/hadiah?cat=streaming | FN-M15-2.2.1 |
| EL-M15-S1-019 | link | visible-default | "🍔 F&B", → /admin/hadiah?cat=food_beverage | FN-M15-2.2.1 |
| EL-M15-S1-020 | link | visible-default | "🛒 E-Commerce", → /admin/hadiah?cat=ecommerce | FN-M15-2.2.1 |
| EL-M15-S1-021 | link | visible-default | "📚 Pembelajaran", → /admin/hadiah?cat=education | FN-M15-2.2.1 |
| EL-M15-S1-022 | link | visible-default | "🎭 Hiburan", → /admin/hadiah?cat=entertainment | FN-M15-2.2.1 |
| EL-M15-S1-023 | form | visible-default | form POST /admin/hadiah/bulk | FN-M15-2.5.1 |
| EL-M15-S1-024 | hidden-field | hidden-only | name=_token | FN-M15-2.5.1 |
| EL-M15-S1-025 | hidden-field | hidden-only | name=action | FN-M15-2.5.1 |
| EL-M15-S1-026 | hidden-field | hidden-only | name=stock_value | FN-M15-2.5.1 |
| EL-M15-S1-027 | hidden-field | hidden-only | name=max_per_month_value | FN-M15-2.5.1 |
| EL-M15-S1-028 | hidden-field | hidden-only | name=token_cost_delta_pct | FN-M15-2.5.1 |
| EL-M15-S1-029 | text | conditional | "hadiah dipilih" | FN-M15-2.5.3 |
| EL-M15-S1-030 | text | conditional | "50" | FN-M15-2.5.3 |
| EL-M15-S1-031 | button | conditional | "Aktifkan", type=button, fa-check | FN-M15-2.6.1 |
| EL-M15-S1-032 | button | conditional | "Nyahaktifkan", type=button, fa-pause | FN-M15-2.6.2 |
| EL-M15-S1-033 | button | conditional | "Set Stok", type=button, fa-boxes-stacked | FN-M15-2.6.3 |
| EL-M15-S1-034 | button | conditional | "Had/Bulan", type=button, fa-calendar-day | FN-M15-2.6.4 |
| EL-M15-S1-035 | button | conditional | "Pelaras Token", type=button, fa-percent | FN-M15-2.6.5 |
| EL-M15-S1-036 | button | conditional | "Padam", type=button, fa-trash | FN-M15-2.6.6 |
| EL-M15-S1-037 | button | conditional | "Batal", type=button | FN-M15-2.5.4 |
| EL-M15-S1-038 | table | visible-default | columns Hadiah · Kategori · RM · Token · Stok · Tebusan · Status · Tindakan | FN-M15-2.3.1 |
| EL-M15-S1-039 | checkbox | visible-default | type=checkbox | FN-M15-2.5.2 |
| EL-M15-S1-040 | checkbox | visible-default | name=ids[] | FN-M15-2.5.2 |
| EL-M15-S1-041 | link | visible-default | "Edit", → /admin/hadiah/1/edit | FN-M15-2.3.4 |
| EL-M15-S1-042 | checkbox | visible-default | name=ids[] | FN-M15-2.5.2 |
| EL-M15-S1-043 | link | visible-default | "Edit", → /admin/hadiah/2/edit | FN-M15-2.3.4 |
| EL-M15-S1-044 | checkbox | visible-default | name=ids[] | FN-M15-2.5.2 |
| EL-M15-S1-045 | link | visible-default | "Edit", → /admin/hadiah/3/edit | FN-M15-2.3.4 |
| EL-M15-S1-046 | text | conditional | "« Previous" | FN-M15-2.4.2 |
| EL-M15-S1-047 | pagination | conditional | "Next »", → /admin/hadiah?page=2 | FN-M15-2.4.2 |
| EL-M15-S1-048 | text | visible-default | "Showing to of results" | FN-M15-2.4.1 |
| EL-M15-S1-049 | text | visible-default | "1" | FN-M15-2.4.1 |
| EL-M15-S1-050 | text | visible-default | "50" | FN-M15-2.4.1 |
| EL-M15-S1-051 | text | visible-default | "59" | FN-M15-2.4.1 |
| EL-M15-S1-052 | text | visible-default | "1" | FN-M15-2.4.1 |
| EL-M15-S1-053 | pagination | visible-default | "2", → /admin/hadiah?page=2 | FN-M15-2.4.1 |
| EL-M15-S1-054 | pagination | visible-default | → /admin/hadiah?page=2, svg | FN-M15-2.4.1 |
| EL-M15-S1-055 | pagination | hidden-only | "« Previous", → /admin/hadiah?page=1 | FN-M15-2.4.2 |
| EL-M15-S1-056 | text | hidden-only | "Next »" | FN-M15-2.4.2 |
| EL-M15-S1-057 | text | conditional | "Showing 0 of results" | FN-M15-2.4.3 |
| EL-M15-S1-058 | pagination | conditional | "2", → /admin/hadiah?page=2 | FN-M15-2.4.3 |

#### S2 — `/admin/hadiah/tebusan` (9 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M15-S2-001 | heading | visible-default | "📋 Admin — Tebusan Hadiah Pelajar" | FN-M15-4.1.1 |
| EL-M15-S2-002 | text | visible-default | "Beli kod dari reseller, paste kat sini untuk hantar kepada pelajar." | FN-M15-4.1.1 |
| EL-M15-S2-003 | link | visible-default | "Kembali ke Catalog", → /admin/hadiah, fa-store | FN-M15-4.1.2 |
| EL-M15-S2-004 | filter | visible-default | "⏳ Pending Admin", → /admin/hadiah/tebusan?status=pending_admin | FN-M15-4.1.3 |
| EL-M15-S2-005 | filter | visible-default | "⏳ Pending Ibu Bapa", → /admin/hadiah/tebusan?status=pending_parent_consent | FN-M15-4.1.3 |
| EL-M15-S2-006 | filter | visible-default | "🎁 Delivered", → /admin/hadiah/tebusan?status=delivered | FN-M15-4.1.3 |
| EL-M15-S2-007 | filter | visible-default | "❌ Cancelled", → /admin/hadiah/tebusan?status=cancelled | FN-M15-4.1.3 |
| EL-M15-S2-008 | filter | visible-default | "Semua", → /admin/hadiah/tebusan?status=all | FN-M15-4.1.3 |
| EL-M15-S2-009 | table | visible-default | columns Pelajar · Hadiah · RM · Token · Status · Tarikh · Tindakan | FN-M15-4.1.4 |

#### S3 — `/admin/hadiah/baharu` (40 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M15-S3-001 | link | visible-default | "← Kembali ke senarai", → /admin/hadiah | FN-M15-3.1.1 |
| EL-M15-S3-002 | heading | visible-default | "➕ Tambah Hadiah Baharu" | FN-M15-3.1.1 |
| EL-M15-S3-003 | form | visible-default | form POST /admin/hadiah | FN-M15-3.1.2 |
| EL-M15-S3-004 | hidden-field | hidden-only | name=_token | FN-M15-3.1.2 |
| EL-M15-S3-005 | label | visible-default | "Kategori * 🏆 Mahkota (RM500+) 💳 E-Wallet 📱 Telco 🎮 Gaming 🎬 Streaming 🍔 F&B 🛒 E-Commerce 📚 Pembelajaran 🎭 Hiburan" | FN-M15-3.1.3 |
| EL-M15-S3-006 | select | visible-default | name=category | FN-M15-3.1.3 |
| EL-M15-S3-007 | label | visible-default | "Vendor *" | FN-M15-3.1.4 |
| EL-M15-S3-008 | input | visible-default | name=vendor | FN-M15-3.1.4 |
| EL-M15-S3-009 | label | visible-default | "Tajuk *" | FN-M15-3.1.4 |
| EL-M15-S3-010 | input | visible-default | name=title | FN-M15-3.1.4 |
| EL-M15-S3-011 | label | visible-default | "Penerangan" | FN-M15-3.1.5 |
| EL-M15-S3-012 | textarea | visible-default | name=description | FN-M15-3.1.5 |
| EL-M15-S3-013 | label | visible-default | "Nilai (RM) *" | FN-M15-3.1.6 |
| EL-M15-S3-014 | input | visible-default | name=denomination_rm | FN-M15-3.1.6 |
| EL-M15-S3-015 | label | visible-default | "Kos Token * 100 syiling = 1 token = RM1" | FN-M15-3.1.6 |
| EL-M15-S3-016 | input | visible-default | name=token_cost | FN-M15-3.1.6 |
| EL-M15-S3-017 | label | visible-default | "Emoji Icon" | FN-M15-3.1.7 |
| EL-M15-S3-018 | input | visible-default | name=icon_emoji | FN-M15-3.1.7 |
| EL-M15-S3-019 | label | visible-default | "Stok (kosong = tanpa had)" | FN-M15-3.1.8 |
| EL-M15-S3-020 | input | visible-default | name=stock_quantity | FN-M15-3.1.8 |
| EL-M15-S3-021 | label | visible-default | "Maks/bulan/pelajar" | FN-M15-3.1.8 |
| EL-M15-S3-022 | input | visible-default | name=max_per_month_per_student | FN-M15-3.1.8 |
| EL-M15-S3-023 | label | visible-default | "Sah Hari (default 365)" | FN-M15-3.1.8 |
| EL-M15-S3-024 | input | visible-default | name=voucher_validity_days | FN-M15-3.1.8 |
| EL-M15-S3-025 | label | visible-default | "Delivery Manual (admin paste) API (auto, future) Instant" | FN-M15-3.1.9 |
| EL-M15-S3-026 | select | visible-default | name=delivery_method | FN-M15-3.1.9 |
| EL-M15-S3-027 | label | visible-default | "Vendor SKU (optional)" | FN-M15-3.1.9 |
| EL-M15-S3-028 | input | visible-default | name=vendor_sku | FN-M15-3.1.9 |
| EL-M15-S3-029 | label | visible-default | "Display Order" | FN-M15-3.1.9 |
| EL-M15-S3-030 | input | visible-default | name=display_order | FN-M15-3.1.9 |
| EL-M15-S3-031 | label | visible-default | "Image URL (optional)" | FN-M15-3.1.10 |
| EL-M15-S3-032 | input | visible-default | name=image_url | FN-M15-3.1.10 |
| EL-M15-S3-033 | label | visible-default | "Terma Khas" | FN-M15-3.1.5 |
| EL-M15-S3-034 | textarea | visible-default | name=terms_text | FN-M15-3.1.5 |
| EL-M15-S3-035 | label | visible-default | "Aktif" | FN-M15-3.1.11 |
| EL-M15-S3-036 | checkbox | visible-default | name=is_active | FN-M15-3.1.11 |
| EL-M15-S3-037 | label | visible-default | "Perlu kelulusan ibu bapa" | FN-M15-3.1.11 |
| EL-M15-S3-038 | checkbox | visible-default | name=requires_parent_consent | FN-M15-3.1.11 |
| EL-M15-S3-039 | button | visible-default | "➕ Tambah", type=submit | FN-M15-3.1.13 |
| EL-M15-S3-040 | link | visible-default | "Batal", → /admin/hadiah | FN-M15-3.1.14 |

#### S4 — `/admin/hadiah/{id}/edit` (54 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M15-S4-001 | link | visible-default | "← Kembali ke senarai", → /admin/hadiah | FN-M15-3.2.5 |
| EL-M15-S4-002 | heading | visible-default | "✏️ Edit Hadiah: Roblox Gift Card RM10" | FN-M15-3.2.1 |
| EL-M15-S4-003 | form | visible-default | form POST /admin/hadiah/1 | FN-M15-3.2.2 |
| EL-M15-S4-004 | hidden-field | hidden-only | name=_token | FN-M15-3.2.2 |
| EL-M15-S4-005 | hidden-field | hidden-only | name=_method | FN-M15-3.2.2 |
| EL-M15-S4-006 | label | visible-default | "Kategori * 🏆 Mahkota (RM500+) 💳 E-Wallet 📱 Telco 🎮 Gaming 🎬 Streaming 🍔 F&B 🛒 E-Commerce 📚 Pembelajaran 🎭 Hiburan" | FN-M15-3.2.3 |
| EL-M15-S4-007 | select | visible-default | name=category | FN-M15-3.2.3 |
| EL-M15-S4-008 | label | visible-default | "Vendor *" | FN-M15-3.2.3 |
| EL-M15-S4-009 | input | visible-default | name=vendor | FN-M15-3.2.3 |
| EL-M15-S4-010 | label | visible-default | "Tajuk *" | FN-M15-3.2.3 |
| EL-M15-S4-011 | input | visible-default | name=title | FN-M15-3.2.3 |
| EL-M15-S4-012 | label | visible-default | "Penerangan Tukar untuk Robux dalam Roblox." | FN-M15-3.2.3 |
| EL-M15-S4-013 | textarea | visible-default | name=description | FN-M15-3.2.3 |
| EL-M15-S4-014 | label | visible-default | "Nilai (RM) *" | FN-M15-3.2.3 |
| EL-M15-S4-015 | input | visible-default | name=denomination_rm | FN-M15-3.2.3 |
| EL-M15-S4-016 | label | visible-default | "Kos Token * 100 syiling = 1 token = RM1" | FN-M15-3.2.3 |
| EL-M15-S4-017 | input | visible-default | name=token_cost | FN-M15-3.2.3 |
| EL-M15-S4-018 | label | visible-default | "Emoji Icon" | FN-M15-3.2.3 |
| EL-M15-S4-019 | input | visible-default | name=icon_emoji | FN-M15-3.2.3 |
| EL-M15-S4-020 | label | visible-default | "Stok (kosong = tanpa had)" | FN-M15-3.2.3 |
| EL-M15-S4-021 | input | visible-default | name=stock_quantity | FN-M15-3.2.3 |
| EL-M15-S4-022 | label | visible-default | "Maks/bulan/pelajar" | FN-M15-3.2.3 |
| EL-M15-S4-023 | input | visible-default | name=max_per_month_per_student | FN-M15-3.2.3 |
| EL-M15-S4-024 | label | visible-default | "Sah Hari (default 365)" | FN-M15-3.2.3 |
| EL-M15-S4-025 | input | visible-default | name=voucher_validity_days | FN-M15-3.2.3 |
| EL-M15-S4-026 | label | visible-default | "Delivery Manual (admin paste) API (auto, future) Instant" | FN-M15-3.2.3 |
| EL-M15-S4-027 | select | visible-default | name=delivery_method | FN-M15-3.2.3 |
| EL-M15-S4-028 | label | visible-default | "Vendor SKU (optional)" | FN-M15-3.2.3 |
| EL-M15-S4-029 | input | visible-default | name=vendor_sku | FN-M15-3.2.3 |
| EL-M15-S4-030 | label | visible-default | "Display Order" | FN-M15-3.2.3 |
| EL-M15-S4-031 | input | visible-default | name=display_order | FN-M15-3.2.3 |
| EL-M15-S4-032 | label | visible-default | "Image URL (optional)" | FN-M15-3.2.3 |
| EL-M15-S4-033 | input | visible-default | name=image_url | FN-M15-3.2.3 |
| EL-M15-S4-034 | label | visible-default | "Terma Khas" | FN-M15-3.2.3 |
| EL-M15-S4-035 | textarea | visible-default | name=terms_text | FN-M15-3.2.3 |
| EL-M15-S4-036 | label | visible-default | "Aktif" | FN-M15-3.2.3 |
| EL-M15-S4-037 | checkbox | visible-default | name=is_active | FN-M15-3.2.3 |
| EL-M15-S4-038 | label | visible-default | "Perlu kelulusan ibu bapa" | FN-M15-3.2.3 |
| EL-M15-S4-039 | checkbox | visible-default | name=requires_parent_consent | FN-M15-3.2.3 |
| EL-M15-S4-040 | button | visible-default | "💾 Simpan", type=submit | FN-M15-3.2.4 |
| EL-M15-S4-041 | link | visible-default | "Batal", → /admin/hadiah | FN-M15-3.2.5 |
| EL-M15-S4-042 | heading | conditional | "✏️ Edit Hadiah: Roblox Gift Card RM1000 🏆" | FN-M15-3.2.1 |
| EL-M15-S4-043 | label | conditional | "Penerangan ~13,400 Robux. Untuk mega-fan Roblox." | FN-M15-3.2.3 |
| EL-M15-S4-044 | textarea | conditional | name=description | FN-M15-3.2.3 |
| EL-M15-S4-045 | text | conditional | "404" | FN-M15-1.2.4 |
| EL-M15-S4-046 | text | conditional | "🔍" | FN-M15-1.2.4 |
| EL-M15-S4-047 | heading | conditional | "Halaman Tidak Dijumpai" | FN-M15-1.2.4 |
| EL-M15-S4-048 | text | conditional | "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?" | FN-M15-1.2.4 |
| EL-M15-S4-049 | link | conditional | "Halaman Utama", → / | FN-M15-1.2.4 |
| EL-M15-S4-050 | link | conditional | "Mula Latihan", → /latih-tubi | FN-M15-1.2.4 |
| EL-M15-S4-051 | text | conditional | "PRESTASIPLUS" | FN-M15-1.2.4 |
| EL-M15-S4-052 | heading | conditional | "✏️ Edit Hadiah: Hotlink Topup RM5" | FN-M15-3.2.1 |
| EL-M15-S4-053 | label | conditional | "Penerangan Reload Hotlink prepaid." | FN-M15-3.2.3 |
| EL-M15-S4-054 | textarea | conditional | name=description | FN-M15-3.2.3 |

#### S5 — `/gamification/rewards` (10 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M15-S5-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 / global tournament banner template (`tournamentBanner()`, hidden; not M15 content) |
| EL-M15-S5-002 | text | hidden-only | "MAIN" | Excluded — M16 / global tournament banner template (`tournamentBanner()`, hidden; not M15 content) |
| EL-M15-S5-003 | text | hidden-only | "DAFTAR" | Excluded — M16 / global tournament banner template (`tournamentBanner()`, hidden; not M15 content) |
| EL-M15-S5-004 | heading | visible-default | "🎁 Kedai Hadiah" | FN-M15-5.1.1 |
| EL-M15-S5-005 | text | visible-default | "Tebus token anda untuk hadiah menarik!" | FN-M15-5.1.1 |
| EL-M15-S5-006 | text | visible-default | "0" | FN-M15-5.1.2 |
| EL-M15-S5-007 | text | visible-default | "Baki Token 🎫" | FN-M15-5.1.2 |
| EL-M15-S5-008 | text | visible-default | "🎁" | FN-M15-5.1.3 |
| EL-M15-S5-009 | heading | visible-default | "Tiada Hadiah Tersedia" | FN-M15-5.1.3 |
| EL-M15-S5-010 | text | visible-default | "Hadiah akan ditambah tidak lama lagi. Tunggu ya!" | FN-M15-5.1.3 |

#### S6 — `/gamification/mystery-box` (58 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M15-S6-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 / global tournament banner template (`tournamentBanner()`, hidden; not M15 content) |
| EL-M15-S6-002 | text | hidden-only | "MAIN" | Excluded — M16 / global tournament banner template (`tournamentBanner()`, hidden; not M15 content) |
| EL-M15-S6-003 | text | hidden-only | "DAFTAR" | Excluded — M16 / global tournament banner template (`tournamentBanner()`, hidden; not M15 content) |
| EL-M15-S6-004 | heading | visible-default | "📦 Kotak Misteri" | FN-M15-6.1.1 |
| EL-M15-S6-005 | text | visible-default | "Buka kotak & menang ganjaran rawak — nasib baik menanti!" | FN-M15-6.1.1 |
| EL-M15-S6-006 | text | visible-default | "🎫 Token Anda:" | FN-M15-6.1.1 |
| EL-M15-S6-007 | text | visible-default | "0" | FN-M15-6.1.1 |
| EL-M15-S6-008 | form | visible-default | form POST /gamification/mystery-box/1/open | FN-M15-6.1.2 |
| EL-M15-S6-009 | hidden-field | hidden-only | name=_token | FN-M15-6.1.2 |
| EL-M15-S6-010 | text | visible-default | "📦" | FN-M15-6.1.3 |
| EL-M15-S6-011 | text | visible-default | "Kotak Gangsa" | FN-M15-6.1.3 |
| EL-M15-S6-012 | text | visible-default | "Kotak biasa — ganjaran kecil tapi pasti!" | FN-M15-6.1.3 |
| EL-M15-S6-013 | text | visible-default | "2" | FN-M15-6.1.3 |
| EL-M15-S6-014 | text | visible-default | "Token" | FN-M15-6.1.3 |
| EL-M15-S6-015 | text | visible-default | "🪙" | FN-M15-6.1.3 |
| EL-M15-S6-016 | text | visible-default | "1-20" | FN-M15-6.1.3 |
| EL-M15-S6-017 | text | visible-default | "⭐ XP" | FN-M15-6.1.3 |
| EL-M15-S6-018 | text | visible-default | "1-10" | FN-M15-6.1.3 |
| EL-M15-S6-019 | button | visible-default | "🔒 Token Tidak Cukup", type=submit, disabled | FN-M15-6.1.4 |
| EL-M15-S6-020 | form | visible-default | form POST /gamification/mystery-box/2/open | FN-M15-6.1.2 |
| EL-M15-S6-021 | hidden-field | hidden-only | name=_token | FN-M15-6.1.2 |
| EL-M15-S6-022 | text | visible-default | "rare" | FN-M15-6.1.3 |
| EL-M15-S6-023 | text | visible-default | "🎁" | FN-M15-6.1.3 |
| EL-M15-S6-024 | text | visible-default | "Kotak Perak" | FN-M15-6.1.3 |
| EL-M15-S6-025 | text | visible-default | "Kotak lebih besar — peluang ganjaran lebih baik" | FN-M15-6.1.3 |
| EL-M15-S6-026 | text | visible-default | "5" | FN-M15-6.1.3 |
| EL-M15-S6-027 | text | visible-default | "Token" | FN-M15-6.1.3 |
| EL-M15-S6-028 | text | visible-default | "🪙" | FN-M15-6.1.3 |
| EL-M15-S6-029 | text | visible-default | "10-50" | FN-M15-6.1.3 |
| EL-M15-S6-030 | text | visible-default | "⭐ XP" | FN-M15-6.1.3 |
| EL-M15-S6-031 | text | visible-default | "5-25" | FN-M15-6.1.3 |
| EL-M15-S6-032 | button | visible-default | "🔒 Token Tidak Cukup", type=submit, disabled | FN-M15-6.1.4 |
| EL-M15-S6-033 | form | visible-default | form POST /gamification/mystery-box/3/open | FN-M15-6.1.2 |
| EL-M15-S6-034 | hidden-field | hidden-only | name=_token | FN-M15-6.1.2 |
| EL-M15-S6-035 | text | visible-default | "epic" | FN-M15-6.1.3 |
| EL-M15-S6-036 | text | visible-default | "✨" | FN-M15-6.1.3 |
| EL-M15-S6-037 | text | visible-default | "Kotak Emas" | FN-M15-6.1.3 |
| EL-M15-S6-038 | text | visible-default | "Kotak premium — ganjaran besar menanti!" | FN-M15-6.1.3 |
| EL-M15-S6-039 | text | visible-default | "10" | FN-M15-6.1.3 |
| EL-M15-S6-040 | text | visible-default | "Token" | FN-M15-6.1.3 |
| EL-M15-S6-041 | text | visible-default | "🪙" | FN-M15-6.1.3 |
| EL-M15-S6-042 | text | visible-default | "25-150" | FN-M15-6.1.3 |
| EL-M15-S6-043 | text | visible-default | "⭐ XP" | FN-M15-6.1.3 |
| EL-M15-S6-044 | text | visible-default | "10-50" | FN-M15-6.1.3 |
| EL-M15-S6-045 | button | visible-default | "🔒 Token Tidak Cukup", type=submit, disabled | FN-M15-6.1.4 |
| EL-M15-S6-046 | form | visible-default | form POST /gamification/mystery-box/4/open | FN-M15-6.1.2 |
| EL-M15-S6-047 | hidden-field | hidden-only | name=_token | FN-M15-6.1.2 |
| EL-M15-S6-048 | text | visible-default | "legendary" | FN-M15-6.1.3 |
| EL-M15-S6-049 | text | visible-default | "👑" | FN-M15-6.1.3 |
| EL-M15-S6-050 | text | visible-default | "Kotak Legenda" | FN-M15-6.1.3 |
| EL-M15-S6-051 | text | visible-default | "Kotak terhebat — ganjaran WOW!" | FN-M15-6.1.3 |
| EL-M15-S6-052 | text | visible-default | "25" | FN-M15-6.1.3 |
| EL-M15-S6-053 | text | visible-default | "Token" | FN-M15-6.1.3 |
| EL-M15-S6-054 | text | visible-default | "🪙" | FN-M15-6.1.3 |
| EL-M15-S6-055 | text | visible-default | "100-500" | FN-M15-6.1.3 |
| EL-M15-S6-056 | text | visible-default | "⭐ XP" | FN-M15-6.1.3 |
| EL-M15-S6-057 | text | visible-default | "25-100" | FN-M15-6.1.3 |
| EL-M15-S6-058 | button | visible-default | "🔒 Token Tidak Cukup", type=submit, disabled | FN-M15-6.1.4 |

#### S7 — `/cabutan` (9 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M15-S7-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 / global tournament banner template (`tournamentBanner()`, hidden; not M15 content) |
| EL-M15-S7-002 | text | hidden-only | "MAIN" | Excluded — M16 / global tournament banner template (`tournamentBanner()`, hidden; not M15 content) |
| EL-M15-S7-003 | text | hidden-only | "DAFTAR" | Excluded — M16 / global tournament banner template (`tournamentBanner()`, hidden; not M15 content) |
| EL-M15-S7-004 | heading | visible-default | "🎟️ Cabutan Bertuah" | FN-M15-7.1.1 |
| EL-M15-S7-005 | text | visible-default | "Guna syiling untuk beli tiket & menangi hadiah hebat!" | FN-M15-7.1.1 |
| EL-M15-S7-006 | text | visible-default | "Syiling anda" | FN-M15-7.1.1 |
| EL-M15-S7-007 | text | visible-default | "256 🪙" | FN-M15-7.1.1 |
| EL-M15-S7-008 | heading | visible-default | "Cabutan Dibuka" | FN-M15-7.1.2 |
| EL-M15-S7-009 | empty-state | visible-default | "Tiada cabutan dibuka buat masa ini. Nanti datang lagi! 🎈" | FN-M15-7.1.2 |

#### S8 — `/cikgu/kelulusan-hadiah` (9 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M15-S8-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 / global tournament banner template (`tournamentBanner()`, hidden; not M15 content) |
| EL-M15-S8-002 | text | hidden-only | "MAIN" | Excluded — M16 / global tournament banner template (`tournamentBanner()`, hidden; not M15 content) |
| EL-M15-S8-003 | text | hidden-only | "DAFTAR" | Excluded — M16 / global tournament banner template (`tournamentBanner()`, hidden; not M15 content) |
| EL-M15-S8-004 | heading | visible-default | "👨‍👩‍👧 Kelulusan Tebusan Hadiah" | FN-M15-8.1.1 |
| EL-M15-S8-005 | text | visible-default | "Anak anda nak tebus hadiah yang memerlukan kelulusan ibu bapa. Sila semak." | FN-M15-8.1.1 |
| EL-M15-S8-006 | heading | visible-default | "⏳ Menunggu Kelulusan (0)" | FN-M15-8.1.2 |
| EL-M15-S8-007 | empty-state | visible-default | "Tiada tebusan menunggu kelulusan." | FN-M15-8.1.2 |
| EL-M15-S8-008 | heading | visible-default | "📜 Sejarah Tebusan Anak" | FN-M15-8.1.3 |
| EL-M15-S8-009 | text | visible-default | "Belum ada sejarah tebusan." | FN-M15-8.1.3 |

#### S9 — `/admin/hadiah/{id}` (3 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M15-S9-001 | heading | visible-default | "Oops! An Error Occurred" | FN-M15-1.2.5 |
| EL-M15-S9-002 | heading | visible-default | "The server returned a \"405 Method Not Allowed\"." | FN-M15-1.2.5 |
| EL-M15-S9-003 | text | visible-default | "Something is broken. Please let us know what you were doing when this error occurred. We will fix it as soon as possible. Sorry for any inconvenience caused." | FN-M15-1.2.5 |

#### S10 — `/cikgu/hadiah` (19 elements; v1.4, row L43)

Source: discovery L43 §2, observed as admin on 2026-10-02 (manual Playwright probe + screenshots; ids assigned by reading order). The independent audit ([L43-audit.md](../../qa/audit/L43-audit.md), PASS) produced an automated computed-style/href dump of `main` for S10 and S11 and verified all 19 S10 elements; it found one extra S11 element (EL-S11-005). Hidden-only elements (a tournament-banner template as on S5–S8) were not examined for S10 and are not counted.

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M15-S10-001 | heading | visible-default | "🎁 Kedai Hadiah Digital" | FN-M15-10.1.2 |
| EL-M15-S10-002 | text | visible-default | "Tukar token kepada hadiah digital — terus dihantar, tanpa pos." | FN-M15-10.1.2 |
| EL-M15-S10-003 | text | visible-default | DOM "Token Anda", rendered "TOKEN ANDA" (CSS upper case), 10px | FN-M15-10.1.3 (DV-M15-19) |
| EL-M15-S10-004 | text | visible-default | "0" (token balance) | FN-M15-10.1.3 |
| EL-M15-S10-005 | text | visible-default | DOM "Syiling", rendered "SYILING" (CSS upper case), 10px | FN-M15-10.1.3 (DV-M15-19) |
| EL-M15-S10-006 | text | visible-default | "256" (syiling balance) | FN-M15-10.1.3 |
| EL-M15-S10-007 | text | visible-default | "100 syiling = 1 token", 9px | FN-M15-10.1.4 (DV-M15-16, 19) |
| EL-M15-S10-008 | link | visible-default | "Tebusan Saya" (clipboard icon) → `/cikgu/hadiah/saya` | FN-M15-10.1.5 |
| EL-M15-S10-009 | link | visible-default | "🌟 Semua" `?cat=all`, active | FN-M15-10.1.6, 10.1.7 |
| EL-M15-S10-010 | link | visible-default | "🏆 Mahkota" `?cat=flagship` | FN-M15-10.1.6, 10.1.7 |
| EL-M15-S10-011 | link | visible-default | "💳 E-Wallet" `?cat=ewallet` | FN-M15-10.1.6, 10.1.7 |
| EL-M15-S10-012 | link | visible-default | "📱 Telco" `?cat=telco` | FN-M15-10.1.6, 10.1.7 |
| EL-M15-S10-013 | link | visible-default | "🎮 Gaming" `?cat=gaming` | FN-M15-10.1.6, 10.1.7 |
| EL-M15-S10-014 | link | visible-default | "🎬 Streaming" `?cat=streaming` | FN-M15-10.1.6, 10.1.7 |
| EL-M15-S10-015 | link | visible-default | "🍔 Makan & Minum" `?cat=food_beverage` | FN-M15-10.1.6, 10.1.7 |
| EL-M15-S10-016 | link | visible-default | "🛒 Shopping" `?cat=ecommerce` | FN-M15-10.1.6, 10.1.7 |
| EL-M15-S10-017 | link | visible-default | "📚 Pembelajaran" `?cat=education` | FN-M15-10.1.6, 10.1.7 |
| EL-M15-S10-018 | link | visible-default | "🎭 Hiburan" `?cat=entertainment` | FN-M15-10.1.6, 10.1.7 |
| EL-M15-S10-019 | empty-state | visible-default | "Tiada hadiah dalam kategori ini." | FN-M15-10.1.8, 10.1.9 |

#### S11 — `/cikgu/hadiah/saya` (5 elements; v1.4, row L43; EL-S11-005 added v1.5, AUD-L43-03)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M15-S11-001 | heading | visible-default | "📋 Tebusan Saya" | FN-M15-10.2.2 |
| EL-M15-S11-002 | link | visible-default | "🎁 Kedai Hadiah" → `/cikgu/hadiah` | FN-M15-10.2.2 |
| EL-M15-S11-003 | empty-state | visible-default | "Belum ada tebusan. Kumpul syiling dulu, lepas tukar token dan tebus hadiah." | FN-M15-10.2.3, 10.2.4 |
| EL-M15-S11-004 | link | visible-default | "Layari Kedai Hadiah" → `/cikgu/hadiah` | FN-M15-10.2.3 |
| EL-M15-S11-005 | icon | visible-default | "🎁" decorative emoji, 48px, own element above the empty text inside the white card | FN-M15-10.2.3 |

**L43 shell and 404 accounting.** The chrome around S10/S11 (sidebar, top bar with the coin / point / streak chips, bell, avatar initials, chat button, bottom nav) is the SHU shell of §6.2 (M23); it was seen in the screenshots but not re-inventoried, so it adds no new shell element. The student-only sidebar entry "Kedai Hadiah 🎁 DIGITAL" is not in the admin capture of SHU (admin cannot see it) and is covered by FN-M15-10.3.4/10.3.5 and XR-M15-13 (SRS §6.10). The four 404 URLs are covered by FN-M15-10.3.3.

### 6.2 Shell elements

The shells are chrome owned by the global shell / M23 and by the modules their links target (logo and brand = elements 001–003). The M15 menu entries, the group headings that hold them and the header title/subtitle are mapped individually; every other element is excluded with its owner.

#### SHA — admin-panel shell (chrome of S1–S4) — 207 elements, 6 M15-relevant

M15-relevant elements:

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M15-SHA-054 | toggle | visible-default | "Gamifikasi", type=submit, fa-gamepad | FN-M15-1.1.5 |
| EL-M15-SHA-060 | link | hidden-only | "Kedai Hadiah", → /admin/hadiah, fa-gift | FN-M15-1.1.5 |
| EL-M15-SHA-118 | heading | visible-default | "Dashboard" | FN-M15-1.1.7 |
| EL-M15-SHA-119 | text | visible-default | "Selamat datang, Admin" | FN-M15-1.1.7 |
| EL-M15-SHA-164 | text | hidden-only | "Gamifikasi" | FN-M15-1.1.5 |
| EL-M15-SHA-168 | link | hidden-only | "Kedai Hadiah", → /admin/hadiah, fa-gift | FN-M15-1.1.5 |

Excluded elements (201), listed individually:

| Element | Kind | Status | Content / attributes | Reason |
|---|---|---|---|---|
| EL-M15-SHA-001 | link | visible-default | → /admin | Excluded — global shell (logo/brand) |
| EL-M15-SHA-002 | image | visible-default | image | Excluded — global shell (logo/brand) |
| EL-M15-SHA-003 | text | visible-default | "Panel Pentadbir" | Excluded — global shell (logo/brand) |
| EL-M15-SHA-004 | link | visible-default | "Command Center LIVE", → /admin/command-center, fa-satellite-dish | Excluded — shell link owned by M17 |
| EL-M15-SHA-005 | badge | visible-default | "LIVE" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-006 | link | visible-default | "Aktiviti Harian", → /admin/command-center/daily-activity, fa-chart-line | Excluded — shell link owned by M17 |
| EL-M15-SHA-007 | link | visible-default | "Audio KBAT", → /admin/audio-kbat, fa-headphones | Excluded — shell link owned by M09 |
| EL-M15-SHA-008 | text | visible-default | "HARIAN" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-009 | link | visible-default | "Dashboard", → /admin, fa-tachometer-alt | Excluded — shell link owned by M17 |
| EL-M15-SHA-010 | link | visible-default | "Laporan Eksekutif", → /admin/laporan-eksekutif, fa-file-alt | Excluded — shell link owned by M17 |
| EL-M15-SHA-011 | text | visible-default | "ANALITIK" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-012 | link | visible-default | "Analitik", → /admin/analytics, fa-chart-pie | Excluded — shell link owned by M17 |
| EL-M15-SHA-013 | link | visible-default | "Monitoring", → /admin/monitoring, fa-binoculars | Excluded — shell link owned by M17 |
| EL-M15-SHA-014 | toggle | visible-default | "Kirkpatrick", type=submit, fa-microscope | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-015 | link | hidden-only | "Overview", → /admin/kirkpatrick, fa-th-large | Excluded — shell link owned by M12 |
| EL-M15-SHA-016 | link | hidden-only | "T1: Reaksi", → /admin/kirkpatrick/reaction, fa-smile | Excluded — shell link owned by M12 |
| EL-M15-SHA-017 | link | hidden-only | "T2: Pembelajaran", → /admin/kirkpatrick/learning, fa-brain | Excluded — shell link owned by M12 |
| EL-M15-SHA-018 | link | hidden-only | "T3: Tingkah Laku", → /admin/kirkpatrick/behavior, fa-running | Excluded — shell link owned by M12 |
| EL-M15-SHA-019 | link | hidden-only | "T4: Hasil", → /admin/kirkpatrick/results, fa-trophy | Excluded — shell link owned by M12 |
| EL-M15-SHA-020 | link | hidden-only | "Rantaian Impak", → /admin/kirkpatrick/chain, fa-link | Excluded — shell link owned by M12 |
| EL-M15-SHA-021 | link | hidden-only | "Intervensi", → /admin/kirkpatrick/interventions, fa-hand-holding-medical | Excluded — shell link owned by M12 |
| EL-M15-SHA-022 | link | visible-default | "Laporan", → /admin/laporan, fa-chart-bar | Excluded — shell link owned by M17 |
| EL-M15-SHA-023 | text | visible-default | "PENGURUSAN" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-024 | toggle | visible-default | "Kurikulum", type=submit, fa-sitemap | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-025 | link | hidden-only | "Kurikulum", → /admin/curriculum, fa-sitemap | Excluded — shell link owned by M03 |
| EL-M15-SHA-026 | link | hidden-only | "Subjek", → /admin/subjects, fa-book | Excluded — shell link owned by M03 |
| EL-M15-SHA-027 | link | hidden-only | "Tahap Pendidikan", → /admin/education-levels, fa-graduation-cap | Excluded — shell link owned by M03 |
| EL-M15-SHA-028 | toggle | visible-default | "Soalan", type=submit, fa-question-circle | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-029 | link | hidden-only | "Senarai Soalan", → /admin/questions, fa-list | Excluded — shell link owned by M04 |
| EL-M15-SHA-030 | link | hidden-only | "Import CSV", → /admin/questions/import, fa-file-csv | Excluded — shell link owned by M04 |
| EL-M15-SHA-031 | link | hidden-only | "Kualiti Soalan", → /admin/questions/quality, fa-clipboard-check | Excluded — shell link owned by M04 |
| EL-M15-SHA-032 | link | hidden-only | "Laporan Soalan", → /admin/question-reports, fa-flag | Excluded — shell link owned by M04 |
| EL-M15-SHA-033 | link | hidden-only | "Soalan Berstruktur", → /admin/structured-questions, fa-list-ol | Excluded — shell link owned by M04 |
| EL-M15-SHA-034 | link | hidden-only | "Kertas Soalan Guru", → /admin/question-submissions, fa-file-upload | Excluded — shell link owned by M04 |
| EL-M15-SHA-035 | toggle | visible-default | "Pengguna", type=submit, fa-users | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-036 | link | hidden-only | "Senarai Pengguna", → /admin/users, fa-users | Excluded — shell link owned by M02 |
| EL-M15-SHA-037 | link | hidden-only | "Sekolah", → /admin/schools, fa-school | Excluded — shell link owned by M02 |
| EL-M15-SHA-038 | link | hidden-only | "Langganan Sekolah", → /admin/school-subscriptions, fa-file-contract | Excluded — shell link owned by M02 |
| EL-M15-SHA-039 | link | hidden-only | "Import Pelajar", → /admin/import-students, fa-user-plus | Excluded — shell link owned by M02 |
| EL-M15-SHA-040 | link | hidden-only | "Pelajar Komplimen", → /admin/comp-students, fa-gift | Excluded — shell link owned by M02 |
| EL-M15-SHA-041 | link | hidden-only | "Import Pengguna", → /admin/users/bulk-import, fa-users-cog | Excluded — shell link owned by M02 |
| EL-M15-SHA-042 | link | hidden-only | "Penajaan", → /admin/sponsors, fa-handshake | Excluded — shell link owned by M21 |
| EL-M15-SHA-043 | link | hidden-only | "Anak Angkat", → /admin/anak-angkat, fa-child | Excluded — shell link owned by M21 |
| EL-M15-SHA-044 | link | hidden-only | "Permohonan", → /admin/anak-angkat/permohonan, fa-file-alt | Excluded — shell link owned by M21 |
| EL-M15-SHA-045 | toggle | visible-default | "SPM", type=submit, fa-graduation-cap | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-046 | link | hidden-only | "Databank Soalan", → /spm/tahun-lepas, fa-database | Excluded — shell link owned by M06 |
| EL-M15-SHA-047 | link | hidden-only | "Latih Tubi", → /spm/latih-tubi, fa-bolt | Excluded — shell link owned by M06 |
| EL-M15-SHA-048 | link | hidden-only | "Tracking A", → /spm/ramalan, fa-crosshairs | Excluded — shell link owned by M06 |
| EL-M15-SHA-049 | link | hidden-only | "Subjektif", → /spm/subjektif, fa-pen-fancy | Excluded — shell link owned by M06 |
| EL-M15-SHA-050 | toggle | visible-default | "Premium", type=submit, fa-shield-halved | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-051 | link | hidden-only | "PKSK Soalan", → /admin/pksk/questions, fa-shield-halved | Excluded — shell link owned by M07 |
| EL-M15-SHA-052 | link | hidden-only | "PKSK Akses", → /admin/pksk/access, fa-key | Excluded — shell link owned by M07 |
| EL-M15-SHA-053 | text | visible-default | "SISTEM" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-055 | link | hidden-only | "Overview", → /admin/gamification, fa-gamepad | Excluded — shell link owned by M14 |
| EL-M15-SHA-056 | link | hidden-only | "Tier Config", → /admin/gamification/tiers, fa-crown | Excluded — shell link owned by M14 |
| EL-M15-SHA-057 | link | hidden-only | "Cabaran", → /admin/gamification/challenges, fa-bullseye | Excluded — shell link owned by M14 |
| EL-M15-SHA-058 | link | hidden-only | "Pelajar", → /admin/gamification/students, fa-users | Excluded — shell link owned by M14 |
| EL-M15-SHA-059 | link | hidden-only | "Transaksi", → /admin/gamification/transactions, fa-receipt | Excluded — shell link owned by M14 |
| EL-M15-SHA-061 | link | hidden-only | "Gamifikasi Guru", → /admin/gamifikasi/guru, fa-chalkboard-teacher | Excluded — shell link owned by M14 |
| EL-M15-SHA-062 | link | hidden-only | "Kawalan Reward", → /admin/reward-control, fa-shield-halved | Excluded — shell link owned by M14 |
| EL-M15-SHA-063 | toggle | visible-default | "Battle & Permainan", type=submit, fa-bolt | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-064 | link | hidden-only | "Battle Live", → /battle, fa-bolt | Excluded — shell link owned by M16 |
| EL-M15-SHA-065 | link | hidden-only | "Ranking Sekolah", → /battle/ranking-sekolah, fa-school | Excluded — shell link owned by M16 |
| EL-M15-SHA-066 | link | hidden-only | "Leaderboard", → /battle/leaderboard, fa-trophy | Excluded — shell link owned by M16 |
| EL-M15-SHA-067 | link | hidden-only | "Tetapan Permainan", → /admin/permainan, fa-dice | Excluded — shell link owned by M16 |
| EL-M15-SHA-068 | toggle | visible-default | "Marketplace", type=submit, fa-shopping-bag | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-069 | link | hidden-only | "Produk", → /admin/marketplace/products, fa-shopping-bag | Excluded — shell link owned by M20 |
| EL-M15-SHA-070 | link | hidden-only | "Penjual", → /admin/marketplace/sellers, fa-store | Excluded — shell link owned by M20 |
| EL-M15-SHA-071 | toggle | visible-default | "Kandungan", type=submit, fa-newspaper | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-072 | link | hidden-only | "Banner", → /admin/banners, fa-image | Excluded — shell link owned by M09 |
| EL-M15-SHA-073 | link | hidden-only | "Artikel", → /admin/articles, fa-newspaper | Excluded — shell link owned by M09 |
| EL-M15-SHA-074 | link | hidden-only | "Nota", → /admin/notes, fa-sticky-note | Excluded — shell link owned by M09 |
| EL-M15-SHA-075 | link | hidden-only | "Push Notifikasi", → /admin/notifications, fa-bell | Excluded — shell link owned by M22 |
| EL-M15-SHA-076 | link | hidden-only | "Upload Screenshot", → /admin/tools/screenshots, fa-cloud-upload-alt | Excluded — shell link owned by M09 |
| EL-M15-SHA-077 | toggle | visible-default | "Kewangan", type=submit, fa-credit-card | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-078 | link | hidden-only | "Pembayaran", → /admin/payments, fa-credit-card | Excluded — shell link owned by M19 |
| EL-M15-SHA-079 | link | hidden-only | "Billing Dashboard", → /admin/billing, fa-chart-line | Excluded — shell link owned by M19 |
| EL-M15-SHA-080 | link | hidden-only | "Dunning Log", → /admin/dunning, fa-bell-slash | Excluded — shell link owned by M19 |
| EL-M15-SHA-081 | toggle | visible-default | "Sistem", type=submit, fa-cog | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-082 | link | hidden-only | "Performance", → /admin/performance, fa-gauge-high | Excluded — shell link owned by M17 |
| EL-M15-SHA-083 | link | hidden-only | "Tetapan", → /admin/settings, fa-cog | Excluded — shell link owned by M23 |
| EL-M15-SHA-084 | link | hidden-only | "Log Audit", → /admin/audit-logs, fa-clipboard-list | Excluded — shell link owned by M23 |
| EL-M15-SHA-085 | link | hidden-only | "Chatbot", → /admin/chatbot, fa-robot | Excluded — shell link owned by M22 |
| EL-M15-SHA-086 | text | visible-default | "🏆 Bilik Duta" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-087 | badge | visible-default | "DEV" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-088 | link | visible-default | "Bilik Duta", → /bilik-duta, fa-crown | Excluded — shell link owned by M24 |
| EL-M15-SHA-089 | link | visible-default | "Akademi Duta", → /akademi-duta, fa-graduation-cap | Excluded — shell link owned by M24 |
| EL-M15-SHA-090 | link | visible-default | "Permohonan Duta", → /admin/duta-applications, fa-clipboard-check | Excluded — shell link owned by M24 |
| EL-M15-SHA-091 | link | visible-default | "Duta Dashboard", → /duta-dashboard, fa-user-tie | Excluded — shell link owned by M24 |
| EL-M15-SHA-092 | link | visible-default | "Jemput Duta", → /jemput-duta, fa-school | Excluded — shell link owned by M24 |
| EL-M15-SHA-093 | link | visible-default | "Kem & Bootcamp", → /bilik-duta/kem, fa-campground | Excluded — shell link owned by M24 |
| EL-M15-SHA-094 | text | visible-default | "🤖 Pusat AI" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-095 | link | visible-default | "Kamus AI", → /pusat-ai/kamus, fa-book-open | Excluded — shell link owned by M25 |
| EL-M15-SHA-096 | link | visible-default | "Aktiviti Advisor", → /pusat-ai/aktiviti, fa-lightbulb | Excluded — shell link owned by M25 |
| EL-M15-SHA-097 | link | visible-default | "Pendamping Motivasi", → /pusat-ai/pendamping, fa-heart | Excluded — shell link owned by M25 |
| EL-M15-SHA-098 | link | visible-default | "SPM Walkthrough", → /pusat-ai/spm, fa-pen-to-square | Excluded — shell link owned by M06 |
| EL-M15-SHA-099 | link | visible-default | "Whiteboard → Quiz", → /pusat-ai/whiteboard, fa-clipboard-question | Excluded — shell link owned by M25 |
| EL-M15-SHA-100 | link | visible-default | "Parent Whisperer", → /pusat-ai/parent-whisperer, fa-comments | Excluded — shell link owned by M25 |
| EL-M15-SHA-101 | link | visible-default | "Doa & Motivasi", → /pusat-ai/doa, fa-mosque | Excluded — shell link owned by M25 |
| EL-M15-SHA-102 | text | visible-default | "✨ Visi & Pertandingan" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-103 | link | visible-default | "Profil Cerah", → /profil-cerah, fa-magic | Excluded — shell link owned by M26 |
| EL-M15-SHA-104 | link | visible-default | "Sekolah Bersaing", → /sekolah-bersaing, fa-trophy | Excluded — shell link owned by M16 |
| EL-M15-SHA-105 | link | visible-default | "Cita-Cita Hijrah", → /cita-cita, fa-star | Excluded — shell link owned by M26 |
| EL-M15-SHA-106 | link | visible-default | "Streak / Kombo", → /kombo, fa-fire | Excluded — shell link owned by M14 |
| EL-M15-SHA-107 | text | visible-default | "💎 Killer Features" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-108 | link | visible-default | "Cikgu Suara", → /cikgu-suara, fa-microphone | Excluded — shell link owned by M13 |
| EL-M15-SHA-109 | link | visible-default | "SPM Mock Exam", → /spm-mock, fa-file-pen | Excluded — shell link owned by M06 |
| EL-M15-SHA-110 | link | visible-default | "Wellbeing Alerts", → /wellbeing/alerts, fa-triangle-exclamation | Excluded — shell link owned by M26 |
| EL-M15-SHA-111 | link | visible-default | "Tetapan Peribadi", → /tetapan, fa-cog | Excluded — shell link owned by M01 |
| EL-M15-SHA-112 | link | visible-default | "Ke Dashboard", → /dashboard, fa-arrow-left | Excluded — shell link owned by M05 |
| EL-M15-SHA-113 | card | visible-default | "Admin PRESTASI+" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-114 | image | visible-default | image | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-115 | text | visible-default | "Admin PRESTASI+" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-116 | text | visible-default | "Admin" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-117 | link | visible-default | → /logout, fa-sign-out-alt | Excluded — shell link owned by M01 |
| EL-M15-SHA-120 | tooltip | hidden-only | "Uptime", fa-clock | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-121 | tooltip | visible-default | "Load: 0.54 / 8 cores", fa-microchip | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-122 | text | visible-default | "7%" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-123 | tooltip | visible-default | "18.2GB / 31.1GB", fa-memory | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-124 | text | visible-default | "58%" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-125 | tooltip | visible-default | "201.2GB / 398.7GB", fa-hard-drive | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-126 | text | visible-default | "50%" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-127 | tooltip | visible-default | "Uptime", fa-clock | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-128 | text | visible-default | "205d 1h" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-129 | image | visible-default | image | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-130 | link | visible-default | → /logout, fa-sign-out-alt | Excluded — shell link owned by M01 |
| EL-M15-SHA-131 | link | conditional | → /admin | Excluded — shell link owned by M17 |
| EL-M15-SHA-132 | image | conditional | image | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-133 | text | visible-default | "© 2026 PRESTASIPLUS. Hakcipta Terpelihara." | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-134 | text | visible-default | "Didikan penuh dari Malaysia 🇲🇾" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-135 | text | visible-default | "❤️" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-136 | link | conditional | "Dashboard", → /admin, fa-tachometer-alt | Excluded — shell link owned by M17 |
| EL-M15-SHA-137 | link | conditional | "Soalan", → /admin/questions, fa-question-circle | Excluded — shell link owned by M04 |
| EL-M15-SHA-138 | link | conditional | "Penaja", → /admin/sponsors, fa-handshake | Excluded — shell link owned by M21 |
| EL-M15-SHA-139 | link | conditional | "Pengguna", → /admin/users, fa-users | Excluded — shell link owned by M02 |
| EL-M15-SHA-140 | dropdown-trigger | conditional | "Lagi", type=submit, fa-ellipsis-h | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-141 | card | hidden-only | "SPM" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-142 | link | hidden-only | "Analitik", → /admin/analytics, fa-chart-pie | Excluded — shell link owned by M17 |
| EL-M15-SHA-143 | link | hidden-only | "Laporan Aktiviti", → /admin/laporan, fa-chart-bar | Excluded — shell link owned by M17 |
| EL-M15-SHA-144 | link | hidden-only | "Monitoring", → /admin/monitoring, fa-binoculars | Excluded — shell link owned by M17 |
| EL-M15-SHA-145 | link | hidden-only | "Kirkpatrick", → /admin/kirkpatrick, fa-microscope | Excluded — shell link owned by M12 |
| EL-M15-SHA-146 | text | hidden-only | "SPM" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-147 | link | hidden-only | "Databank Soalan", → /spm/tahun-lepas, fa-database | Excluded — shell link owned by M06 |
| EL-M15-SHA-148 | link | hidden-only | "Latih Tubi", → /spm/latih-tubi, fa-bolt | Excluded — shell link owned by M06 |
| EL-M15-SHA-149 | link | hidden-only | "Tracking A", → /spm/ramalan, fa-crosshairs | Excluded — shell link owned by M06 |
| EL-M15-SHA-150 | link | hidden-only | "Subjektif", → /spm/subjektif, fa-pen-fancy | Excluded — shell link owned by M06 |
| EL-M15-SHA-151 | text | hidden-only | "Soalan" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-152 | link | hidden-only | "Import CSV", → /admin/questions/import, fa-file-csv | Excluded — shell link owned by M04 |
| EL-M15-SHA-153 | link | hidden-only | "Kualiti Soalan", → /admin/questions/quality, fa-clipboard-check | Excluded — shell link owned by M04 |
| EL-M15-SHA-154 | link | hidden-only | "Laporan Soalan", → /admin/question-reports, fa-flag | Excluded — shell link owned by M04 |
| EL-M15-SHA-155 | link | hidden-only | "Soalan Berstruktur", → /admin/structured-questions, fa-list-ol | Excluded — shell link owned by M04 |
| EL-M15-SHA-156 | link | hidden-only | "Kertas Soalan Guru", → /admin/question-submissions, fa-file-upload | Excluded — shell link owned by M04 |
| EL-M15-SHA-157 | text | hidden-only | "Kurikulum" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-158 | link | hidden-only | "Kurikulum", → /admin/curriculum, fa-sitemap | Excluded — shell link owned by M03 |
| EL-M15-SHA-159 | link | hidden-only | "Subjek", → /admin/subjects, fa-book | Excluded — shell link owned by M03 |
| EL-M15-SHA-160 | link | hidden-only | "Tahap Pendidikan", → /admin/education-levels, fa-graduation-cap | Excluded — shell link owned by M03 |
| EL-M15-SHA-161 | text | hidden-only | "Premium" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-162 | link | hidden-only | "PKSK Soalan", → /admin/pksk/questions, fa-shield-halved | Excluded — shell link owned by M07 |
| EL-M15-SHA-163 | link | hidden-only | "PKSK Akses", → /admin/pksk/access, fa-key | Excluded — shell link owned by M07 |
| EL-M15-SHA-165 | link | hidden-only | "Overview", → /admin/gamification, fa-gamepad | Excluded — shell link owned by M14 |
| EL-M15-SHA-166 | link | hidden-only | "Tier Config", → /admin/gamification/tiers, fa-crown | Excluded — shell link owned by M14 |
| EL-M15-SHA-167 | link | hidden-only | "Cabaran", → /admin/gamification/challenges, fa-bullseye | Excluded — shell link owned by M14 |
| EL-M15-SHA-169 | link | hidden-only | "Gamifikasi Guru", → /admin/gamifikasi/guru, fa-chalkboard-teacher | Excluded — shell link owned by M14 |
| EL-M15-SHA-170 | text | hidden-only | "Battle & Permainan" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-171 | link | hidden-only | "Battle Live", → /battle, fa-bolt | Excluded — shell link owned by M16 |
| EL-M15-SHA-172 | link | hidden-only | "Tetapan Permainan", → /admin/permainan, fa-dice | Excluded — shell link owned by M16 |
| EL-M15-SHA-173 | text | hidden-only | "Kandungan" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-174 | link | hidden-only | "Banner", → /admin/banners, fa-image | Excluded — shell link owned by M09 |
| EL-M15-SHA-175 | link | hidden-only | "Artikel", → /admin/articles, fa-newspaper | Excluded — shell link owned by M09 |
| EL-M15-SHA-176 | link | hidden-only | "Nota", → /admin/notes, fa-sticky-note | Excluded — shell link owned by M09 |
| EL-M15-SHA-177 | link | hidden-only | "Push Notifikasi", → /admin/notifications, fa-bell | Excluded — shell link owned by M22 |
| EL-M15-SHA-178 | link | hidden-only | "Chatbot", → /admin/chatbot, fa-robot | Excluded — shell link owned by M22 |
| EL-M15-SHA-179 | link | hidden-only | "Upload Screenshot", → /admin/tools/screenshots, fa-cloud-upload-alt | Excluded — shell link owned by M09 |
| EL-M15-SHA-180 | text | hidden-only | "Marketplace" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-181 | link | hidden-only | "Produk", → /admin/marketplace/products, fa-shopping-bag | Excluded — shell link owned by M20 |
| EL-M15-SHA-182 | link | hidden-only | "Penjual", → /admin/marketplace/sellers, fa-store | Excluded — shell link owned by M20 |
| EL-M15-SHA-183 | text | hidden-only | "Sistem" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-184 | link | hidden-only | "Sekolah", → /admin/schools, fa-school | Excluded — shell link owned by M02 |
| EL-M15-SHA-185 | link | hidden-only | "Langganan Sekolah", → /admin/school-subscriptions, fa-file-contract | Excluded — shell link owned by M02 |
| EL-M15-SHA-186 | link | hidden-only | "Tetapan", → /admin/settings, fa-cog | Excluded — shell link owned by M23 |
| EL-M15-SHA-187 | link | hidden-only | "Pembayaran", → /admin/payments, fa-credit-card | Excluded — shell link owned by M19 |
| EL-M15-SHA-188 | link | hidden-only | "Billing Dashboard", → /admin/billing, fa-chart-line | Excluded — shell link owned by M19 |
| EL-M15-SHA-189 | link | hidden-only | "Dunning Log", → /admin/dunning, fa-bell-slash | Excluded — shell link owned by M19 |
| EL-M15-SHA-190 | link | hidden-only | "Log Audit", → /admin/audit-logs, fa-clipboard-list | Excluded — shell link owned by M23 |
| EL-M15-SHA-191 | link | hidden-only | "Performance", → /admin/performance, fa-gauge-high | Excluded — shell link owned by M17 |
| EL-M15-SHA-192 | link | hidden-only | "Import Pelajar", → /admin/import-students, fa-user-plus | Excluded — shell link owned by M02 |
| EL-M15-SHA-193 | link | hidden-only | "Import Pengguna", → /admin/users/bulk-import, fa-users-cog | Excluded — shell link owned by M02 |
| EL-M15-SHA-194 | link | hidden-only | "Student View", → /dashboard, fa-arrow-left | Excluded — shell link owned by M05 |
| EL-M15-SHA-195 | link | hidden-only | "Log Keluar", → /logout, fa-sign-out-alt | Excluded — shell link owned by M01 |
| EL-M15-SHA-196 | tooltip | conditional | "Load: 0.38 / 8 cores", fa-microchip | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-197 | tooltip | conditional | "201.1GB / 398.7GB", fa-hard-drive | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-198 | tooltip | conditional | "Load: 0.45 / 8 cores", fa-microchip | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-199 | tooltip | conditional | "18.1GB / 31.1GB", fa-memory | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-200 | tooltip | hidden-only | "Load: 0.8 / 8 cores", fa-microchip | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-201 | tooltip | conditional | "Load: 0.37 / 8 cores", fa-microchip | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-202 | tooltip | conditional | "201.3GB / 398.7GB", fa-hard-drive | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-203 | tooltip | conditional | "Load: 0.31 / 8 cores", fa-microchip | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-204 | tooltip | conditional | "201.4GB / 398.7GB", fa-hard-drive | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-205 | tooltip | conditional | "Load: 0.49 / 8 cores", fa-microchip | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-206 | tooltip | conditional | "Load: 0.41 / 8 cores", fa-microchip | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHA-207 | tooltip | hidden-only | "Load: 0.46 / 8 cores", fa-microchip | Excluded — global shell / M23 chrome (00-global-ui) |

#### SHU — user-portal shell (chrome of S5–S8) — 372 elements, 21 M15-relevant

M15-relevant elements:

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M15-SHU-061 | text | visible-default | "Pembelajaran" | FN-M15-1.1.1 |
| EL-M15-SHU-072 | link | visible-default | "Cabutan Bertuah 🎟️", → /cabutan, fa-ticket | FN-M15-1.1.1 |
| EL-M15-SHU-073 | badge | visible-default | "🎟️" | FN-M15-1.1.1 |
| EL-M15-SHU-084 | link | visible-default | "Kedai Hadiah", → /gamification/rewards, fa-gift | FN-M15-1.1.2 |
| EL-M15-SHU-085 | link | visible-default | "Kelulusan Hadiah", → /cikgu/kelulusan-hadiah, fa-shield-halved | FN-M15-1.1.2 |
| EL-M15-SHU-089 | link | visible-default | "Kotak Misteri", → /gamification/mystery-box, fa-box-open | FN-M15-1.1.2 |
| EL-M15-SHU-093 | text | visible-default | "Cikgu Alesa Tools" | FN-M15-1.1.3 |
| EL-M15-SHU-097 | link | visible-default | "Admin Tebusan", → /admin/hadiah, fa-cogs | FN-M15-1.1.3 |
| EL-M15-SHU-110 | text | visible-default | "Admin" | FN-M15-1.1.4 |
| EL-M15-SHU-116 | link | visible-default | "Urus Hadiah", → /admin/hadiah, fa-gift | FN-M15-1.1.4 |
| EL-M15-SHU-136 | heading | visible-default | "Dashboard" | FN-M15-1.1.7 |
| EL-M15-SHU-137 | text | visible-default | "Selamat datang kembali" | FN-M15-1.1.7 |
| EL-M15-SHU-201 | modal | hidden-only | "Pembelajaran" | FN-M15-1.1.1 |
| EL-M15-SHU-202 | text | hidden-only | "Pembelajaran" | FN-M15-1.1.1 |
| EL-M15-SHU-213 | link | hidden-only | "Cabutan Bertuah 🎟️", → /cabutan, fa-ticket | FN-M15-1.1.1 |
| EL-M15-SHU-214 | badge | hidden-only | "🎟️" | FN-M15-1.1.1 |
| EL-M15-SHU-294 | modal | hidden-only | "Gamifikasi" | FN-M15-1.1.2 |
| EL-M15-SHU-295 | text | hidden-only | "Gamifikasi" | FN-M15-1.1.2 |
| EL-M15-SHU-299 | link | hidden-only | "Kedai Hadiah", → /gamification/rewards, fa-gift | FN-M15-1.1.2 |
| EL-M15-SHU-303 | link | hidden-only | "Kotak Misteri", → /gamification/mystery-box, fa-box-open | FN-M15-1.1.2 |
| EL-M15-SHU-312 | link | hidden-only | "Urus Hadiah", → /admin/hadiah, fa-gift | FN-M15-1.1.4 |

Excluded elements (351), listed individually:

| Element | Kind | Status | Content / attributes | Reason |
|---|---|---|---|---|
| EL-M15-SHU-001 | link | visible-default | → /dashboard | Excluded — global shell (logo/brand) |
| EL-M15-SHU-002 | image | visible-default | image | Excluded — global shell (logo/brand) |
| EL-M15-SHU-003 | text | visible-default | "Platform Latih Tubi Nasional" | Excluded — global shell (logo/brand) |
| EL-M15-SHU-004 | link | visible-default | "Dashboard", → /dashboard, fa-home | Excluded — shell link owned by M05 |
| EL-M15-SHU-005 | link | visible-default | "Target SPM", → /target-spm, fa-bullseye | Excluded — shell link owned by M05 |
| EL-M15-SHU-006 | link | visible-default | "Misi Harian", → /misi-harian, fa-rocket | Excluded — shell link owned by M05 |
| EL-M15-SHU-007 | link | visible-default | "Remedial", → /remedial/saya, fa-flask | Excluded — shell link owned by M05 |
| EL-M15-SHU-008 | text | visible-default | "SPM" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-009 | link | visible-default | "SPM SPM", → /spm, fa-graduation-cap | Excluded — shell link owned by M06 |
| EL-M15-SHU-010 | badge | visible-default | "SPM" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-011 | link | visible-default | "Headcount", → /headcount, fa-chart-line | Excluded — shell link owned by M08 |
| EL-M15-SHU-012 | link | visible-default | "Prestasi", → /prestasi, fa-chart-bar | Excluded — shell link owned by M08 |
| EL-M15-SHU-013 | link | visible-default | "Analitik Adaptif", → /analitik/pelajar, fa-brain | Excluded — shell link owned by M08 |
| EL-M15-SHU-014 | link | visible-default | "Analisa Item", → /analisa-item, fa-magnifying-glass-chart | Excluded — shell link owned by M08 |
| EL-M15-SHU-015 | link | visible-default | "Kombo", → /kombo, fa-fire | Excluded — shell link owned by M14 |
| EL-M15-SHU-016 | link | visible-default | "Laporan Mingguan", → /laporan-mingguan, fa-file-lines | Excluded — shell link owned by M08 |
| EL-M15-SHU-017 | text | visible-default | "Pusat AI" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-018 | badge | visible-default | "NEW" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-019 | text | visible-default | "🤖 Cikgu Alesa AI" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-020 | link | visible-default | "Cikgu Alesa Chat AI", → /cikgu, fa-robot | Excluded — shell link owned by M13 |
| EL-M15-SHU-021 | badge | visible-default | "AI" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-022 | text | visible-default | "✨ Visi & Pertandingan" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-023 | link | visible-default | "Sekolah Bersaing NEW", → /sekolah-bersaing, fa-trophy | Excluded — shell link owned by M16 |
| EL-M15-SHU-024 | badge | visible-default | "NEW" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-025 | link | visible-default | "Tetapan Peribadi", → /tetapan, fa-cog | Excluded — shell link owned by M01 |
| EL-M15-SHU-026 | text | visible-default | "🏆 Bilik Duta · 🔒 PREVIEW" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-027 | link | visible-default | "Bilik Duta DEV", → /bilik-duta, fa-crown | Excluded — shell link owned by M24 |
| EL-M15-SHU-028 | badge | visible-default | "DEV" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-029 | text | visible-default | "🤖 AI Pintar (Pelajar)" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-030 | link | visible-default | "Wellbeing Alerts", → /wellbeing/alerts, fa-triangle-exclamation | Excluded — shell link owned by M26 |
| EL-M15-SHU-031 | link | visible-default | "Kamus AI", → /pusat-ai/kamus, fa-book-open | Excluded — shell link owned by M25 |
| EL-M15-SHU-032 | link | visible-default | "Pendamping Motivasi", → /pusat-ai/pendamping, fa-heart | Excluded — shell link owned by M25 |
| EL-M15-SHU-033 | link | visible-default | "Doa & Motivasi", → /pusat-ai/doa, fa-mosque | Excluded — shell link owned by M25 |
| EL-M15-SHU-034 | text | visible-default | "🎯 AI Pintar (Guru)" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-035 | link | visible-default | "Aktiviti Advisor", → /pusat-ai/aktiviti, fa-lightbulb | Excluded — shell link owned by M25 |
| EL-M15-SHU-036 | link | visible-default | "Whiteboard → Quiz", → /pusat-ai/whiteboard, fa-clipboard-question | Excluded — shell link owned by M25 |
| EL-M15-SHU-037 | link | visible-default | "RPH (Cikgu Alesa)", → /cikgu/rph, fa-clipboard-list | Excluded — shell link owned by M13 |
| EL-M15-SHU-038 | link | visible-default | "Semak Karangan (Cikgu Alesa)", → /cikgu/essay, fa-pen-fancy | Excluded — shell link owned by M13 |
| EL-M15-SHU-039 | link | visible-default | "PBD (Cikgu Alesa)", → /cikgu/pbd, fa-tasks | Excluded — shell link owned by M13 |
| EL-M15-SHU-040 | text | visible-default | "🛡️ Kawalan Kualiti" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-041 | link | visible-default | "Semakan Nota Master", → /admin/master-notes, fa-shield-alt | Excluded — shell link owned by M04 |
| EL-M15-SHU-042 | link | visible-default | "Audit Log", → /admin/audit-log, fa-clipboard-check | Excluded — shell link owned by M23 |
| EL-M15-SHU-043 | text | visible-default | "🏆 Bilik Duta" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-044 | link | visible-default | "Bilik Duta", → /bilik-duta, fa-crown | Excluded — shell link owned by M24 |
| EL-M15-SHU-045 | link | visible-default | "Akademi Duta", → /akademi-duta, fa-graduation-cap | Excluded — shell link owned by M24 |
| EL-M15-SHU-046 | link | visible-default | "Kem & Bootcamp", → /bilik-duta/kem, fa-campground | Excluded — shell link owned by M24 |
| EL-M15-SHU-047 | text | visible-default | "✨ Visi & Pertandingan" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-048 | link | visible-default | "Profil Cerah", → /profil-cerah, fa-magic | Excluded — shell link owned by M26 |
| EL-M15-SHU-049 | link | visible-default | "Sekolah Bersaing", → /sekolah-bersaing, fa-trophy | Excluded — shell link owned by M16 |
| EL-M15-SHU-050 | link | visible-default | "Cita-Cita Hijrah", → /cita-cita, fa-star | Excluded — shell link owned by M26 |
| EL-M15-SHU-051 | text | visible-default | "💎 Killer Features" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-052 | link | visible-default | "Cikgu Suara", → /cikgu-suara, fa-microphone | Excluded — shell link owned by M13 |
| EL-M15-SHU-053 | link | visible-default | "SPM Mock Exam", → /spm-mock, fa-file-pen | Excluded — shell link owned by M06 |
| EL-M15-SHU-054 | link | visible-default | "Wellbeing Alerts", → /wellbeing/alerts, fa-triangle-exclamation | Excluded — shell link owned by M26 |
| EL-M15-SHU-055 | link | visible-default | "Pembetulan", → /pembetulan, fa-arrows-rotate | Excluded — shell link owned by M05 |
| EL-M15-SHU-056 | link | visible-default | "Mohon Keluarga Angkat", → /mohon-keluarga-angkat, fa-hand-holding-heart | Excluded — shell link owned by M21 |
| EL-M15-SHU-057 | link | visible-default | "Penguasaan", → /penguasaan, fa-layer-group | Excluded — shell link owned by M05 |
| EL-M15-SHU-058 | link | visible-default | "Laporan Soalan", → /laporan-soalan, fa-flag | Excluded — shell link owned by M04 |
| EL-M15-SHU-059 | link | visible-default | "Liga Pertandingan", → /liga, fa-trophy | Excluded — shell link owned by M16 |
| EL-M15-SHU-060 | link | visible-default | "Perutusan", → /perutusan, fa-scroll | Excluded — shell link owned by M09 |
| EL-M15-SHU-062 | link | visible-default | "Latih Tubi", → /practice, fa-brain | Excluded — shell link owned by M05 |
| EL-M15-SHU-063 | link | visible-default | "Soalan by Chapter", → /practice/chapter, fa-layer-group | Excluded — shell link owned by M05 |
| EL-M15-SHU-064 | link | visible-default | "Soalan Berstruktur", → /latihan-berstruktur, fa-list-ol | Excluded — shell link owned by M05 |
| EL-M15-SHU-065 | link | visible-default | "Kedudukan", → /ranking, fa-trophy | Excluded — shell link owned by M08 |
| EL-M15-SHU-066 | link | visible-default | "PKSK PRO", → /pksk, fa-shield-halved | Excluded — shell link owned by M07 |
| EL-M15-SHU-067 | badge | visible-default | "PRO" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-068 | link | visible-default | "Artikel", → /artikel, fa-newspaper | Excluded — shell link owned by M09 |
| EL-M15-SHU-069 | link | visible-default | "Video", → /video, fa-play-circle | Excluded — shell link owned by M09 |
| EL-M15-SHU-070 | link | visible-default | "Permainan 🎮", → /permainan, fa-gamepad | Excluded — shell link owned by M16 |
| EL-M15-SHU-071 | badge | visible-default | "🎮" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-074 | link | visible-default | "Tournament", → /tournament, fa-trophy | Excluded — shell link owned by M16 |
| EL-M15-SHU-075 | link | visible-default | "Topik", → /topics, fa-book-open | Excluded — shell link owned by M03 |
| EL-M15-SHU-076 | link | visible-default | "Peta Belajar", → /peta-belajar, fa-map | Excluded — shell link owned by M03 |
| EL-M15-SHU-077 | link | visible-default | "Kelas Saya", → /kelas-saya, fa-book-reader | Excluded — shell link owned by M10 |
| EL-M15-SHU-078 | link | visible-default | "Set Soalan Guru", → /set-soalan-saya, fa-clipboard-list | Excluded — shell link owned by M10 |
| EL-M15-SHU-079 | link | visible-default | "Audio KBAT", → /audio-kbat, fa-headphones | Excluded — shell link owned by M09 |
| EL-M15-SHU-080 | link | visible-default | "Syiling & Token 🏆", → /gamification, fa-coins | Excluded — shell link owned by M14 |
| EL-M15-SHU-081 | badge | visible-default | "🏆" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-082 | link | visible-default | "Tukar Token", → /gamification/convert, fa-exchange-alt | Excluded — shell link owned by M14 |
| EL-M15-SHU-083 | link | visible-default | "Cabaran Harian", → /gamification/challenges, fa-bullseye | Excluded — shell link owned by M14 |
| EL-M15-SHU-086 | link | visible-default | "Marketplace", → /marketplace, fa-shopping-bag | Excluded — shell link owned by M20 |
| EL-M15-SHU-087 | link | visible-default | "Papan Pendahulu", → /gamification/leaderboard, fa-trophy | Excluded — shell link owned by M14 |
| EL-M15-SHU-088 | link | visible-default | "Pencapaian", → /gamification/achievements, fa-medal | Excluded — shell link owned by M14 |
| EL-M15-SHU-090 | link | visible-default | "Rujuk Kawan", → /gamification/referral, fa-user-plus | Excluded — shell link owned by M14 |
| EL-M15-SHU-091 | link | visible-default | "Cikgu Alesa AI", → /cikgu, fa-robot | Excluded — shell link owned by M13 |
| EL-M15-SHU-092 | badge | visible-default | "AI" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-094 | link | visible-default | "RPH (Rancangan Harian)", → /cikgu/rph, fa-file-alt | Excluded — shell link owned by M13 |
| EL-M15-SHU-095 | link | visible-default | "PBD Auto-Tag", → /cikgu/pbd, fa-clipboard-check | Excluded — shell link owned by M13 |
| EL-M15-SHU-096 | link | visible-default | "Mark Karangan", → /cikgu/essay, fa-pen-fancy | Excluded — shell link owned by M13 |
| EL-M15-SHU-098 | link | visible-default | "Timeline Saya", → /timeline, fa-camera | Excluded — shell link owned by M08 |
| EL-M15-SHU-099 | text | visible-default | "Portal Guru" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-100 | link | visible-default | "Dashboard Guru", → /guru, fa-chart-pie | Excluded — shell link owned by M10 |
| EL-M15-SHU-101 | link | visible-default | "Kelas Guru", → /guru/kelas, fa-chalkboard-teacher | Excluded — shell link owned by M10 |
| EL-M15-SHU-102 | link | visible-default | "Sumbang Soalan", → /guru/soalan, fa-pen-fancy | Excluded — shell link owned by M10 |
| EL-M15-SHU-103 | link | visible-default | "Databank Soalan", → /guru/databank, fa-database | Excluded — shell link owned by M10 |
| EL-M15-SHU-104 | text | visible-default | "PPD / JPN" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-105 | link | visible-default | "Dashboard PPD", → /ppd/dashboard, fa-building-columns | Excluded — shell link owned by M18 |
| EL-M15-SHU-106 | link | visible-default | "Statistik PPD", → /ppd/statistik-penggunaan, fa-chart-pie | Excluded — shell link owned by M18 |
| EL-M15-SHU-107 | link | visible-default | "Ranking Kebangsaan", → /ppd/ranking-kebangsaan, fa-trophy | Excluded — shell link owned by M18 |
| EL-M15-SHU-108 | link | visible-default | "Dashboard JPN", → /jpn/dashboard, fa-building-flag | Excluded — shell link owned by M18 |
| EL-M15-SHU-109 | link | visible-default | "Ranking Kebangsaan JPN", → /jpn/ranking-kebangsaan, fa-trophy | Excluded — shell link owned by M18 |
| EL-M15-SHU-111 | link | visible-default | "Ke Admin Panel", → /admin, fa-shield-halved | Excluded — shell link owned by M17 |
| EL-M15-SHU-112 | link | visible-default | "Soalan by Chapter", → /practice/chapter, fa-layer-group | Excluded — shell link owned by M05 |
| EL-M15-SHU-113 | link | visible-default | "Billing Dashboard", → /admin/billing, fa-chart-line | Excluded — shell link owned by M19 |
| EL-M15-SHU-114 | link | visible-default | "Urus Produk", → /admin/marketplace/products, fa-store | Excluded — shell link owned by M20 |
| EL-M15-SHU-115 | link | visible-default | "Urus Penjual", → /admin/marketplace/sellers, fa-user-tie | Excluded — shell link owned by M20 |
| EL-M15-SHU-117 | link | visible-default | "Gamifikasi Guru", → /admin/gamifikasi/guru, fa-chalkboard-teacher | Excluded — shell link owned by M14 |
| EL-M15-SHU-118 | link | visible-default | "Kertas Soalan Guru", → /admin/question-submissions, fa-file-upload | Excluded — shell link owned by M04 |
| EL-M15-SHU-119 | link | visible-default | "Profil Saya", → /profile, fa-user-circle | Excluded — shell link owned by M01 |
| EL-M15-SHU-120 | link | visible-default | "Pakej 💎", → /pricing, fa-crown | Excluded — shell link owned by M19 |
| EL-M15-SHU-121 | badge | visible-default | "💎" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-122 | link | visible-default | "Invois Saya", → /billing/invoices, fa-file-invoice | Excluded — shell link owned by M19 |
| EL-M15-SHU-123 | link | visible-default | "Panduan", → /panduan, fa-book | Excluded — shell link owned by M09 |
| EL-M15-SHU-124 | text | visible-default | "Bantuan" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-125 | link | visible-default | "Tiket Bantuan", → /pusat-tuisyen/tiket, fa-life-ring | Excluded — shell link owned by M22 |
| EL-M15-SHU-126 | link | visible-default | "Gambar Rajah 6,144", → /admin/soalan-gambar, fa-images | Excluded — shell link owned by M04 |
| EL-M15-SHU-127 | badge | visible-default | "6,144" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-128 | link | visible-default | "Urus Tiket 2", → /admin/tiket, fa-headset | Excluded — shell link owned by M22 |
| EL-M15-SHU-129 | badge | visible-default | "2" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-130 | card | visible-default | "<name>" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-131 | image | visible-default | image | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-132 | text | visible-default | "<name>" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-133 | text | visible-default | "<email>" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-134 | link | visible-default | → /logout, fa-sign-out-alt | Excluded — shell link owned by M01 |
| EL-M15-SHU-135 | toggle | visible-default | type=submit, fa-bars | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-138 | text | visible-default | "256" | Excluded — shell header counters (M14 wallet / streak; 00-global-ui) |
| EL-M15-SHU-139 | text | visible-default | "koin" | Excluded — shell header counters (M14 wallet / streak; 00-global-ui) |
| EL-M15-SHU-140 | text | visible-default | "8" | Excluded — shell header counters (M14 wallet / streak; 00-global-ui) |
| EL-M15-SHU-141 | text | visible-default | "mata" | Excluded — shell header counters (M14 wallet / streak; 00-global-ui) |
| EL-M15-SHU-142 | text | visible-default | "1" | Excluded — shell header counters (M14 wallet / streak; 00-global-ui) |
| EL-M15-SHU-143 | text | visible-default | "hari 🔥" | Excluded — shell header counters (M14 wallet / streak; 00-global-ui) |
| EL-M15-SHU-144 | link | visible-default | "99+", → /notifikasi, fa-bell | Excluded — shell link owned by M22 |
| EL-M15-SHU-145 | badge | visible-default | "99+" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-146 | image | visible-default | image | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-147 | link | visible-default | → /logout, fa-sign-out-alt | Excluded — shell link owned by M01 |
| EL-M15-SHU-148 | toggle | conditional | type=submit, fa-bars | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-149 | link | conditional | → /dashboard | Excluded — shell link owned by M05 |
| EL-M15-SHU-150 | image | conditional | image | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-151 | text | conditional | "256" | Excluded — shell header counters (M14 wallet / streak; 00-global-ui) |
| EL-M15-SHU-152 | text | conditional | "koin" | Excluded — shell header counters (M14 wallet / streak; 00-global-ui) |
| EL-M15-SHU-153 | text | conditional | "8" | Excluded — shell header counters (M14 wallet / streak; 00-global-ui) |
| EL-M15-SHU-154 | text | conditional | "mata" | Excluded — shell header counters (M14 wallet / streak; 00-global-ui) |
| EL-M15-SHU-155 | text | conditional | "1" | Excluded — shell header counters (M14 wallet / streak; 00-global-ui) |
| EL-M15-SHU-156 | text | conditional | "🔥" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-157 | text | visible-default | "© 2026 PRESTASIPLUS. Hakcipta Terpelihara" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-158 | text | visible-default | "✨" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-159 | text | visible-default | "Didikan penuh dari Malaysia" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-160 | text | visible-default | "❤️" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-161 | text | visible-default | "🇲🇾" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-162 | clickable | hidden-only | clickable | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-163 | modal | hidden-only | "<name>" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-164 | image | hidden-only | image | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-165 | text | hidden-only | "Platform Latih Tubi Nasional" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-166 | button | hidden-only | type=submit, fa-times | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-167 | image | hidden-only | image | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-168 | text | hidden-only | "<name>" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-169 | text | hidden-only | "admin" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-170 | link | hidden-only | "Dashboard", → /dashboard, fa-home | Excluded — shell link owned by M05 |
| EL-M15-SHU-171 | modal | hidden-only | "SPM" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-172 | text | hidden-only | "SPM" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-173 | link | hidden-only | "SPM SPM", → /spm, fa-graduation-cap | Excluded — shell link owned by M06 |
| EL-M15-SHU-174 | badge | hidden-only | "SPM" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-175 | link | hidden-only | "Headcount", → /headcount, fa-chart-line | Excluded — shell link owned by M08 |
| EL-M15-SHU-176 | link | hidden-only | "Prestasi", → /prestasi, fa-chart-bar | Excluded — shell link owned by M08 |
| EL-M15-SHU-177 | link | hidden-only | "Analisa Item", → /analisa-item, fa-magnifying-glass-chart | Excluded — shell link owned by M08 |
| EL-M15-SHU-178 | link | hidden-only | "Amaran Awal", → /amaran, fa-exclamation-triangle | Excluded — shell link owned by M18 |
| EL-M15-SHU-179 | link | hidden-only | "Kombo", → /kombo, fa-fire | Excluded — shell link owned by M14 |
| EL-M15-SHU-180 | link | hidden-only | "Cikgu Alesa AI", → /cikgu, fa-robot | Excluded — shell link owned by M13 |
| EL-M15-SHU-181 | badge | hidden-only | "AI" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-182 | link | hidden-only | "RPH", → /cikgu/rph, fa-file-alt | Excluded — shell link owned by M13 |
| EL-M15-SHU-183 | link | hidden-only | "PBD Auto-Tag", → /cikgu/pbd, fa-clipboard-check | Excluded — shell link owned by M13 |
| EL-M15-SHU-184 | link | hidden-only | "Mark Karangan", → /cikgu/essay, fa-pen-fancy | Excluded — shell link owned by M13 |
| EL-M15-SHU-185 | link | hidden-only | "Laporan Mingguan", → /laporan-mingguan, fa-file-lines | Excluded — shell link owned by M08 |
| EL-M15-SHU-186 | link | hidden-only | "Pembetulan", → /pembetulan, fa-arrows-rotate | Excluded — shell link owned by M05 |
| EL-M15-SHU-187 | link | hidden-only | "Penguasaan", → /penguasaan, fa-layer-group | Excluded — shell link owned by M05 |
| EL-M15-SHU-188 | link | hidden-only | "Laporan Soalan", → /laporan-soalan, fa-flag | Excluded — shell link owned by M04 |
| EL-M15-SHU-189 | link | hidden-only | "Command Center LIVE", → /ppd/command-center, fa-satellite-dish | Excluded — shell link owned by M18 |
| EL-M15-SHU-190 | badge | hidden-only | "LIVE" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-191 | link | hidden-only | "Dashboard PPD", → /ppd/dashboard, fa-building-columns | Excluded — shell link owned by M18 |
| EL-M15-SHU-192 | link | hidden-only | "Statistik Penggunaan", → /ppd/statistik-penggunaan, fa-chart-pie | Excluded — shell link owned by M18 |
| EL-M15-SHU-193 | link | hidden-only | "Ranking Kebangsaan", → /ppd/ranking-kebangsaan, fa-trophy | Excluded — shell link owned by M18 |
| EL-M15-SHU-194 | link | hidden-only | "Benchmark Sekolah", → /ppd/benchmark-sekolah, fa-ranking-star | Excluded — shell link owned by M18 |
| EL-M15-SHU-195 | link | hidden-only | "Peta Haba", → /ppd/peta-haba, fa-map-location-dot | Excluded — shell link owned by M18 |
| EL-M15-SHU-196 | link | hidden-only | "Export Laporan", → /ppd/export-laporan, fa-file-export | Excluded — shell link owned by M18 |
| EL-M15-SHU-197 | link | hidden-only | "Leaderboard Sekolah", → /ppd/leaderboard-sekolah, fa-trophy | Excluded — shell link owned by M18 |
| EL-M15-SHU-198 | link | hidden-only | "Dashboard JPN", → /jpn/dashboard, fa-building-flag | Excluded — shell link owned by M18 |
| EL-M15-SHU-199 | link | hidden-only | "Statistik Penggunaan", → /jpn/statistik-penggunaan, fa-chart-pie | Excluded — shell link owned by M18 |
| EL-M15-SHU-200 | link | hidden-only | "Ranking Kebangsaan", → /jpn/ranking-kebangsaan, fa-trophy | Excluded — shell link owned by M18 |
| EL-M15-SHU-203 | link | hidden-only | "Latih Tubi", → /practice, fa-brain | Excluded — shell link owned by M05 |
| EL-M15-SHU-204 | link | hidden-only | "Soalan by Chapter", → /practice/chapter, fa-layer-group | Excluded — shell link owned by M05 |
| EL-M15-SHU-205 | link | hidden-only | "Soalan Berstruktur", → /latihan-berstruktur, fa-list-ol | Excluded — shell link owned by M05 |
| EL-M15-SHU-206 | link | hidden-only | "Kedudukan", → /ranking, fa-trophy | Excluded — shell link owned by M08 |
| EL-M15-SHU-207 | link | hidden-only | "PKSK PRO", → /pksk, fa-shield-halved | Excluded — shell link owned by M07 |
| EL-M15-SHU-208 | badge | hidden-only | "PRO" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-209 | link | hidden-only | "Artikel", → /artikel, fa-newspaper | Excluded — shell link owned by M09 |
| EL-M15-SHU-210 | link | hidden-only | "Video", → /video, fa-play-circle | Excluded — shell link owned by M09 |
| EL-M15-SHU-211 | link | hidden-only | "Permainan 🎮", → /permainan, fa-gamepad | Excluded — shell link owned by M16 |
| EL-M15-SHU-212 | badge | hidden-only | "🎮" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-215 | link | hidden-only | "Tournament", → /tournament, fa-trophy | Excluded — shell link owned by M16 |
| EL-M15-SHU-216 | link | hidden-only | "Topik", → /topics, fa-book-open | Excluded — shell link owned by M03 |
| EL-M15-SHU-217 | link | hidden-only | "Peta Belajar", → /peta-belajar, fa-map | Excluded — shell link owned by M03 |
| EL-M15-SHU-218 | link | hidden-only | "Command Center LIVE", → /guru/command-center, fa-satellite-dish | Excluded — shell link owned by M10 |
| EL-M15-SHU-219 | badge | hidden-only | "LIVE" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-220 | text | hidden-only | "Pusat AI" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-221 | badge | hidden-only | "NEW" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-222 | text | hidden-only | "🤖 Cikgu Alesa AI" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-223 | link | hidden-only | "Cikgu Alesa Chat AI", → /cikgu, fa-robot | Excluded — shell link owned by M13 |
| EL-M15-SHU-224 | badge | hidden-only | "AI" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-225 | text | hidden-only | "✨ Visi & Pertandingan" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-226 | link | hidden-only | "Sekolah Bersaing NEW", → /sekolah-bersaing, fa-trophy | Excluded — shell link owned by M16 |
| EL-M15-SHU-227 | badge | hidden-only | "NEW" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-228 | link | hidden-only | "Tetapan Peribadi", → /tetapan, fa-cog | Excluded — shell link owned by M01 |
| EL-M15-SHU-229 | text | hidden-only | "🏆 Bilik Duta · 🔒 PREVIEW" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-230 | link | hidden-only | "Bilik Duta DEV", → /bilik-duta, fa-crown | Excluded — shell link owned by M24 |
| EL-M15-SHU-231 | badge | hidden-only | "DEV" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-232 | text | hidden-only | "🤖 AI Pintar (Pelajar)" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-233 | link | hidden-only | "Wellbeing Alerts", → /wellbeing/alerts, fa-triangle-exclamation | Excluded — shell link owned by M26 |
| EL-M15-SHU-234 | link | hidden-only | "Kamus AI", → /pusat-ai/kamus, fa-book-open | Excluded — shell link owned by M25 |
| EL-M15-SHU-235 | link | hidden-only | "Pendamping Motivasi", → /pusat-ai/pendamping, fa-heart | Excluded — shell link owned by M25 |
| EL-M15-SHU-236 | link | hidden-only | "Doa & Motivasi", → /pusat-ai/doa, fa-mosque | Excluded — shell link owned by M25 |
| EL-M15-SHU-237 | text | hidden-only | "🎯 AI Pintar (Guru)" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-238 | link | hidden-only | "Aktiviti Advisor", → /pusat-ai/aktiviti, fa-lightbulb | Excluded — shell link owned by M25 |
| EL-M15-SHU-239 | link | hidden-only | "Whiteboard → Quiz", → /pusat-ai/whiteboard, fa-clipboard-question | Excluded — shell link owned by M25 |
| EL-M15-SHU-240 | link | hidden-only | "RPH (Cikgu Alesa)", → /cikgu/rph, fa-clipboard-list | Excluded — shell link owned by M13 |
| EL-M15-SHU-241 | link | hidden-only | "Semak Karangan (Cikgu Alesa)", → /cikgu/essay, fa-pen-fancy | Excluded — shell link owned by M13 |
| EL-M15-SHU-242 | link | hidden-only | "PBD (Cikgu Alesa)", → /cikgu/pbd, fa-tasks | Excluded — shell link owned by M13 |
| EL-M15-SHU-243 | text | hidden-only | "🛡️ Kawalan Kualiti" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-244 | link | hidden-only | "Semakan Nota Master", → /admin/master-notes, fa-shield-alt | Excluded — shell link owned by M04 |
| EL-M15-SHU-245 | link | hidden-only | "Audit Log", → /admin/audit-log, fa-clipboard-check | Excluded — shell link owned by M23 |
| EL-M15-SHU-246 | modal | hidden-only | "HARIAN" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-247 | text | hidden-only | "HARIAN" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-248 | link | hidden-only | "Dashboard Guru", → /guru, fa-chart-pie | Excluded — shell link owned by M10 |
| EL-M15-SHU-249 | link | hidden-only | "Misi Harian", → /guru/misi-harian, fa-rocket | Excluded — shell link owned by M10 |
| EL-M15-SHU-250 | link | hidden-only | "Soalan by Chapter", → /practice/chapter, fa-layer-group | Excluded — shell link owned by M05 |
| EL-M15-SHU-251 | link | hidden-only | "Kelas Saya", → /guru/kelas, fa-chalkboard-teacher | Excluded — shell link owned by M10 |
| EL-M15-SHU-252 | link | hidden-only | "Pelajar Saya", → /guru/pelajar, fa-user-graduate | Excluded — shell link owned by M10 |
| EL-M15-SHU-253 | link | hidden-only | "Kehadiran Digital", → /guru/kehadiran-digital, fa-clipboard-check | Excluded — shell link owned by M10 |
| EL-M15-SHU-254 | modal | hidden-only | "PENGAJARAN" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-255 | text | hidden-only | "PENGAJARAN" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-256 | link | hidden-only | "Jadual Belajar", → /guru/jadual-belajar, fa-calendar-alt | Excluded — shell link owned by M10 |
| EL-M15-SHU-257 | link | hidden-only | "Broadcast", → /guru/broadcast, fa-bullhorn | Excluded — shell link owned by M10 |
| EL-M15-SHU-258 | link | hidden-only | "Kelas Live", → /guru/live-kelas, fa-broadcast-tower | Excluded — shell link owned by M10 |
| EL-M15-SHU-259 | modal | hidden-only | "PENILAIAN" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-260 | text | hidden-only | "PENILAIAN" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-261 | link | hidden-only | "Headcount", → /headcount, fa-chart-line | Excluded — shell link owned by M08 |
| EL-M15-SHU-262 | link | hidden-only | "Prestasi", → /prestasi/kelas, fa-chart-bar | Excluded — shell link owned by M08 |
| EL-M15-SHU-263 | link | hidden-only | "Laporan", → /guru/laporan, fa-chart-pie | Excluded — shell link owned by M11 |
| EL-M15-SHU-264 | link | hidden-only | "Amaran Awal", → /amaran, fa-exclamation-triangle | Excluded — shell link owned by M18 |
| EL-M15-SHU-265 | modal | hidden-only | "ANALITIK" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-266 | text | hidden-only | "ANALITIK" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-267 | link | hidden-only | "Monitoring", → /guru/monitoring, fa-binoculars | Excluded — shell link owned by M11 |
| EL-M15-SHU-268 | toggle | hidden-only | "Kirkpatrick", type=submit, fa-microscope | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-269 | link | hidden-only | "Ringkasan", → /guru/kirkpatrick, fa-home | Excluded — shell link owned by M12 |
| EL-M15-SHU-270 | link | hidden-only | "T1: Reaksi", → /guru/kirkpatrick/reaction, fa-smile | Excluded — shell link owned by M12 |
| EL-M15-SHU-271 | link | hidden-only | "T2: Pembelajaran", → /guru/kirkpatrick/learning, fa-graduation-cap | Excluded — shell link owned by M12 |
| EL-M15-SHU-272 | link | hidden-only | "T3: Tingkah Laku", → /guru/kirkpatrick/behavior, fa-running | Excluded — shell link owned by M12 |
| EL-M15-SHU-273 | link | hidden-only | "T4: Hasil", → /guru/kirkpatrick/results, fa-trophy | Excluded — shell link owned by M12 |
| EL-M15-SHU-274 | link | hidden-only | "Rantaian Impak", → /guru/kirkpatrick/chain, fa-link | Excluded — shell link owned by M12 |
| EL-M15-SHU-275 | link | hidden-only | "Intervensi", → /guru/kirkpatrick/interventions, fa-hand-holding-medical | Excluded — shell link owned by M12 |
| EL-M15-SHU-276 | link | hidden-only | "Analisis Item", → /guru/analisis-item, fa-chart-pie | Excluded — shell link owned by M11 |
| EL-M15-SHU-277 | link | hidden-only | "Perbandingan Kelas", → /guru/perbandingan-kelas, fa-balance-scale | Excluded — shell link owned by M11 |
| EL-M15-SHU-278 | link | hidden-only | "Laporan Mingguan", → /guru/laporan-mingguan-kelas, fa-calendar-week | Excluded — shell link owned by M11 |
| EL-M15-SHU-279 | modal | hidden-only | "BANK SOALAN" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-280 | text | hidden-only | "BANK SOALAN" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-281 | link | hidden-only | "Sumbang Soalan", → /guru/soalan, fa-pen-fancy | Excluded — shell link owned by M10 |
| EL-M15-SHU-282 | link | hidden-only | "Soalan & Rujukan", → /guru/soalan-guru, fa-book-open | Excluded — shell link owned by M10 |
| EL-M15-SHU-283 | link | hidden-only | "Soalan Berstruktur", → /guru/soalan-berstruktur, fa-list-ol | Excluded — shell link owned by M10 |
| EL-M15-SHU-284 | link | hidden-only | "Databank Soalan", → /guru/databank, fa-database | Excluded — shell link owned by M10 |
| EL-M15-SHU-285 | link | hidden-only | "Set Soalan", → /guru/set-soalan, fa-clipboard-list | Excluded — shell link owned by M10 |
| EL-M15-SHU-286 | modal | hidden-only | "LAIN-LAIN" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-287 | text | hidden-only | "LAIN-LAIN" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-288 | link | hidden-only | "Syiling & Ganjaran", → /guru/gamifikasi, fa-coins | Excluded — shell link owned by M14 |
| EL-M15-SHU-289 | link | hidden-only | "Sumbang Artikel", → /guru/artikel, fa-newspaper | Excluded — shell link owned by M10 |
| EL-M15-SHU-290 | link | hidden-only | "Video", → /video, fa-play-circle | Excluded — shell link owned by M09 |
| EL-M15-SHU-291 | link | hidden-only | "Kelas Saya BARU", → /kelas-saya, fa-book-reader | Excluded — shell link owned by M10 |
| EL-M15-SHU-292 | badge | hidden-only | "BARU" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-293 | link | hidden-only | "Set Soalan Guru", → /set-soalan-saya, fa-clipboard-list | Excluded — shell link owned by M10 |
| EL-M15-SHU-296 | link | hidden-only | "Syiling & Token", → /gamification, fa-coins | Excluded — shell link owned by M14 |
| EL-M15-SHU-297 | link | hidden-only | "Tukar Token", → /gamification/convert, fa-exchange-alt | Excluded — shell link owned by M14 |
| EL-M15-SHU-298 | link | hidden-only | "Cabaran Harian", → /gamification/challenges, fa-bullseye | Excluded — shell link owned by M14 |
| EL-M15-SHU-300 | link | hidden-only | "Marketplace", → /marketplace, fa-shopping-bag | Excluded — shell link owned by M20 |
| EL-M15-SHU-301 | link | hidden-only | "Papan Pendahulu", → /gamification/leaderboard, fa-trophy | Excluded — shell link owned by M14 |
| EL-M15-SHU-302 | link | hidden-only | "Pencapaian", → /gamification/achievements, fa-medal | Excluded — shell link owned by M14 |
| EL-M15-SHU-304 | link | hidden-only | "Rujuk Kawan", → /gamification/referral, fa-user-plus | Excluded — shell link owned by M14 |
| EL-M15-SHU-305 | link | hidden-only | "Timeline Saya", → /timeline, fa-camera | Excluded — shell link owned by M08 |
| EL-M15-SHU-306 | link | hidden-only | "Invois Saya", → /billing/invoices, fa-file-invoice | Excluded — shell link owned by M19 |
| EL-M15-SHU-307 | link | hidden-only | "Ke Admin Panel", → /admin, fa-shield-halved | Excluded — shell link owned by M17 |
| EL-M15-SHU-308 | link | hidden-only | "Soalan by Chapter", → /practice/chapter, fa-layer-group | Excluded — shell link owned by M05 |
| EL-M15-SHU-309 | link | hidden-only | "Billing Dashboard", → /admin/billing, fa-chart-line | Excluded — shell link owned by M19 |
| EL-M15-SHU-310 | link | hidden-only | "Urus Produk", → /admin/marketplace/products, fa-store | Excluded — shell link owned by M20 |
| EL-M15-SHU-311 | link | hidden-only | "Urus Penjual", → /admin/marketplace/sellers, fa-user-tie | Excluded — shell link owned by M20 |
| EL-M15-SHU-313 | link | hidden-only | "Gamifikasi Guru", → /admin/gamifikasi/guru, fa-chalkboard-teacher | Excluded — shell link owned by M14 |
| EL-M15-SHU-314 | link | hidden-only | "Profil Saya", → /profile, fa-user-circle | Excluded — shell link owned by M01 |
| EL-M15-SHU-315 | link | hidden-only | "Tetapan", → /settings, fa-cog | Excluded — shell link owned by M01 |
| EL-M15-SHU-316 | link | hidden-only | "Panduan", → /pusat-tuisyen/panduan, fa-book | Excluded — shell link owned by M09 |
| EL-M15-SHU-317 | link | hidden-only | "Log Keluar", → /logout, fa-sign-out-alt | Excluded — shell link owned by M01 |
| EL-M15-SHU-318 | text | hidden-only | "© 2026 PRESTASIPLUS 🇲🇾" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-319 | text | hidden-only | "Pasang PRESTASIPLUS" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-320 | text | hidden-only | "Akses pantas dari skrin utama" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-321 | button | hidden-only | "Pasang", type=submit | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-322 | button | hidden-only | "10", type=submit, fa-times | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-323 | card | hidden-only | "Pasang PRESTASIPLUS" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-324 | image | hidden-only | image | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-325 | heading | hidden-only | "Pasang PRESTASIPLUS" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-326 | text | hidden-only | "Ikuti langkah berikut:" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-327 | badge | hidden-only | "1" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-328 | text | hidden-only | "Tekan ikon Share" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-329 | text | hidden-only | "Ikon di bawah skrin Safari", fa-share-from-square | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-330 | badge | hidden-only | "2" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-331 | text | hidden-only | "Pilih \"Add to Home Screen\"" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-332 | text | hidden-only | "Scroll ke bawah, tekan Add to Home Screen", fa-plus-square | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-333 | badge | hidden-only | "3" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-334 | text | hidden-only | "Tekan \"Add\"" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-335 | text | hidden-only | "PRESTASIPLUS akan muncul di skrin utama anda" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-336 | button | hidden-only | "Faham!", type=submit | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-337 | link | conditional | "Home", → /dashboard, fa-home | Excluded — shell link owned by M05 |
| EL-M15-SHU-338 | link | conditional | "SPM", → /spm, fa-graduation-cap | Excluded — shell link owned by M06 |
| EL-M15-SHU-339 | link | conditional | "Game", → /permainan, fa-gamepad | Excluded — shell link owned by M16 |
| EL-M15-SHU-340 | link | conditional | "Topik", → /topics, fa-book-open | Excluded — shell link owned by M03 |
| EL-M15-SHU-341 | toggle | conditional | "Chat", type=submit, fa-comments | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-342 | toggle | conditional | "Lagi", type=submit, fa-bars | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-343 | card | hidden-only | "Pembantu PrestasiPlus" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-344 | text | hidden-only | "Pembantu PrestasiPlus" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-345 | text | hidden-only | "Sedia membantu anda" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-346 | button | hidden-only | type=submit, fa-times | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-347 | heading | hidden-only | "Selamat Datang!" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-348 | text | hidden-only | "Sila masukkan maklumat anda sebelum memulakan perbualan." | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-349 | form | hidden-only | form | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-350 | label | hidden-only | "Nama" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-351 | input | hidden-only | type=text | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-352 | label | hidden-only | "No. Telefon" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-353 | input | hidden-only | type=tel | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-354 | button | hidden-only | "Mula Berbual", type=submit, fa-comments, disabled | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-355 | card | hidden-only | card | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-356 | text | hidden-only | "Selamat datang, ! Saya Pembantu Maya PrestasiPlus. Bagaimana saya boleh membantu anda hari ini?" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-357 | button | hidden-only | "Apakah PrestasiPlus?", type=submit | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-358 | button | hidden-only | "Cara mendaftar", type=submit | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-359 | button | hidden-only | "Harga langganan", type=submit | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-360 | card | hidden-only | "<name>" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-361 | text | hidden-only | "Selamat datang, ! Saya Pembantu Maya PrestasiPlus. Bagaimana saya boleh membantu anda hari ini?" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-362 | text | hidden-only | "<name>" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-363 | button | hidden-only | "Apakah PrestasiPlus?", type=submit | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-364 | button | hidden-only | "Cara mendaftar", type=submit | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-365 | button | hidden-only | "Harga langganan", type=submit | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-366 | button | hidden-only | type=submit, fa-thumbs-up | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-367 | button | hidden-only | type=submit, fa-thumbs-down | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-368 | form | hidden-only | form | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-369 | textarea | hidden-only | textarea | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-370 | button | hidden-only | type=submit, fa-paper-plane, disabled | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-371 | text | hidden-only | "Dikuasakan oleh AI · Jawapan mungkin tidak sentiasa tepat" | Excluded — global shell / M23 chrome (00-global-ui) |
| EL-M15-SHU-372 | toggle | hidden-only | type=submit, fa-comments | Excluded — global shell / M23 chrome (00-global-ui) |

**Coverage result: 250/250 covered, 0 unmapped** (shells: 579/579 accounted for, 0 unmapped).

**Coverage result with L43 (v1.5): 274/274 M15 content elements covered (262 mapped, 12 excluded with reason), 0 unmapped; shells unchanged (579/579). Totals including shells: 853/853 accounted for (289 mapped, 564 excluded), 0 unmapped.** The S10/S11 part (24 elements) was confirmed by the independent audit (AUD-L43, PASS), whose automated dump matched the list except EL-S11-005, now added.

---

## 7. Fidelity deviations

These are the **only** intended differences from the live site. Anything not listed must match live (D7). Rule D9 (user, standing, pre-approved): where live is broken or contradictory, fix it minimally; where it works, replicate it exactly. D10: accessibility replicates live; a deliberate, consistent limit is not broken; adding options to a working feature is new scope. CLAUDE.md §6: minimal fixes that create no new visible contradiction; privacy overrides fidelity for personal names; when unsure whether something is broken, follow live. Rows "Rejected — replicate live" were candidates that turned out to work or could not be shown to be broken. Every fact cited below is in discovery §2, §5, §8, the snapshot or the inventory.

| ID | Discovery | Category | Live behaviour (evidence) | Rebuild behaviour (specified) and alternatives | Status |
|---|---|---|---|---|---|
| DV-M15-01 | D-M15-1 | Layout / responsive breakage (controls unreachable) | S1 and S2 tables sit in `overflow-hidden` wrappers: at 375 only the checkbox, "Hadiah" and "Kategori" of S1 are fully visible (table 693px in a 308px box) and only "Pelajar" and "Hadiah" of S2 (736 in 308); at 768 "Tindakan" is cut off on both (S1 693 in 666, S2 736 in 680) — the "Edit" links cannot be reached below ~800px and cannot be scrolled to (discovery §8.1, `hadiah-mobile.png`, `tebusan-mobile-all.png`). | Each table scrolls horizontally **inside its card** wherever it does not fit (NFR-RESP-05 b; M11/M13 precedent); the card keeps its border and radius; the page never scrolls sideways; column widths and cell content unchanged. Alternatives: (a) stacked row cards below 768 — rejected: a redesign of two screens and of the bulk-selection layout; (b) hide columns — rejected: removes data and the only edit path; (c) replicate — rejected: the only edit control is unreachable. | Approved (D9) |
| DV-M15-02 | D-M15-2 | Candidate — inconsistent labels | Category pills and form options read "📱 Telco", "🍔 F&B" (and the form "🏆 Mahkota (RM500+)"); the table reads "📱 Telco Topup", "🍔 Makanan & Minuman" (Appendix A.1). | **Rejected — replicate live.** Each label names the same category unambiguously and each place is consistent with itself (short labels on the controls, long descriptive labels in the table); no screen shows two values for one rule and nothing is misleading. Alternatives: (a) long labels everywhere — rejected: changes working pills and options; (b) short labels in the table — rejected: changes working cells. | Rejected — replicate live |
| DV-M15-03 | D-M15-3 | Contradictory sources (decided by the user) | S5 hero "Baki Token" and the M15 catalogue are token-priced, while the S5 stylesheet's card types (PHYSICAL/DIGITAL/VOUCHER/EXPERIENCE/SUBSCRIPTION) are those of the syiling-priced legacy catalogue in M14 S10 (11 items, 100–2,000 syiling). Which catalogue S5 lists cannot be proved read-only (Q-M15-2). | **Decided by the user (OQ-M15-01, 2026-09-26: "ikut macam mana ada sekarang"):** replicate live — the rebuild renders the observed empty state for every account, builds no populated shop and models no catalogue source (FN-5.1.5). XR-M15-04 closed. | Closed — user decision (OQ-M15-01): replicate live (empty shop, no source modelled) |
| DV-M15-04 | D-M15-4 | Wrong link target | User-portal sidebar "Admin Tebusan" ("Tebusan" = redemption; `fa-cogs`) links to the catalogue `/admin/hadiah`, which the neighbouring "Urus Hadiah" already opens; the redemption queue `/admin/hadiah/tebusan` has no menu entry anywhere (SHU-097, SHU-116). | "Admin Tebusan" → `/admin/hadiah/tebusan` (label, icon, group and position unchanged). Applied by the shell owner (XR-M15-11). Alternatives: (a) rename the entry to match the catalogue — rejected: duplicates "Urus Hadiah" and invents copy; (b) remove it — rejected: removes a live entry; (c) replicate — rejected: the label names a page the link does not open. | Approved (D9) — applied by shell / M23 |
| DV-M15-05 | D-M15-5 | Candidate — placement | The parent page lives at `/cikgu/kelulusan-hadiah` (the teacher-AI prefix) and its sidebar entry sits among the student gamification links; the admin (who sees every menu) sees it. What other roles see is not observed. | **Rejected — replicate live.** The route works and is linked; a prefix is not visible behaviour, and renaming the URL would break the live address for no user-visible gain. The entry stays where it is; which roles see it follows the shell's role filter (FR-G-04), recorded as INFERRED (parent and admin) in SRS §9. Alternatives: (a) move to `/ibubapa/…` — rejected: route change with no broken behaviour; (b) hide it from every role but parents — rejected: the live admin sees it (observed). | Rejected — replicate live |
| DV-M15-06 | D-M15-6 | Candidate — ambiguous data | S2 "Tarikh" shows "dd/mm HH:MM" without the year ("30/04 14:11"). | **Rejected — replicate live.** A consistent, readable format; the rows are also ordered newest first, so the order resolves the year. Adding a year changes a working format. Alternatives: (a) "dd/mm/yyyy HH:MM" — rejected: new format; (b) a year tooltip — rejected: new control. | Rejected — replicate live |
| DV-M15-07 | D-M15-7 | Wrong message | `?page=3` (beyond the last page) with "Semua" active shows the pager "Showing 0 of 59 results" next to the row "Tiada hadiah dalam kategori ini." — the row claims the category is empty while the pager on the same screen counts 59 rewards (`hadiah-page-3-empty.png`, snapshot `pager.page3`). | When the filtered set is **not** empty and the page is beyond the last, the row reads **"Tiada hadiah di halaman ini."** (PROPOSED COPY: the live sentence with "dalam kategori" replaced by "di halaman"); the pager is unchanged; an empty category keeps the live sentence. Alternatives: (a) redirect to the last page — rejected: a behaviour no other module has and a URL that changes under the user; (b) hide the row — rejected: an empty table body with no message; (c) replicate — rejected: two contradicting statements on one screen. | Approved (D9) |
| DV-M15-08 | D-M15-8 | Broken page (dead URL) | GET `/admin/hadiah/{id}` shows the English framework page "Oops! An Error Occurred" / 'The server returned a "405 Method Not Allowed".' with no way back (`hadiah-show-405.png`). URL-typed only. | The global 404 page (FN-1.2.4), as M08 DV-24, M10 DV-M10-26 and M13 DV-M13-10 (the SPA has no method-level routing). Alternatives: a BM 405 page — rejected: new page and copy; a redirect to S4 — rejected: invents a route behaviour. | Approved (D9) |
| DV-M15-09 | D-M15-9 | Candidate — contradictory rules | Bulk "Had/Bulan" prompt: "… atau 0 / kosong untuk tanpa had"; its alert: "Masukkan nombor sah (0-99) atau kosong untuk ∞."; the single-record field allows min 1 (empty = no cap). | **Rejected — replicate live.** No two statements contradict: the alert's range 0–99 includes 0, both texts say empty = no cap, and the prompt defines 0 = no cap; the form simply has no 0 because empty already means no cap. The rebuild stores bulk 0 and empty as "no cap" (null), so the edit form never shows an out-of-range 0 (FN-2.6.4). Alternatives: (a) change the alert to mention 0 — rejected: copy change on a working message; (b) reject 0 in bulk — rejected: contradicts the prompt. | Rejected — replicate live |
| DV-M15-10 | D-M15-10 | Candidate — data defect | Two identical cancelled redemptions of the same student, reward and minute ("CelcomDigi Topup RM30", "30/04 04:54"; INFERRED double submission). | **Rejected — replicate live** (these are data, not UI): both rows are seeded as observed. The missing double-submit guard is recorded as SEC-M15-03; the prototype's redeem rule is atomic per request but adds no new guard or copy. | Rejected — replicate live |
| DV-M15-11 | D-M15-11 | Candidate — visual | Disabled mystery-box cards keep `cursor:pointer`, the hover lift and the icon shake. | **Rejected — replicate live.** The button itself shows `not-allowed` and the lock label, so the state is clear; the lift is decorative and absent on touch. Alternatives: (a) remove hover on disabled cards — rejected: changes working styling; (b) grey out the card — rejected: new style. | Rejected — replicate live |
| DV-M15-12 | D-M15-12 (+ SHU header) | Wrong title | The admin-panel header reads "Dashboard" / "Selamat datang, Admin" on S1–S4 and the user-portal header "Dashboard" / "Selamat datang kembali" on S5–S8 (every screenshot). | Shell rule DV-SH-03: S1–S4 show the page's tab title with no subtitle (M04 DV-M04-02 pattern): "Admin — Kedai Hadiah", "Admin — Tebusan Hadiah", "Tambah Hadiah", "Edit Hadiah"; S5–S8 the h1 without its leading emoji with "Selamat datang kembali" (M10 DV-M10-01 / M13 DV-M13-08 pattern): "Kedai Hadiah", "Kotak Misteri", "Cabutan Bertuah", "Kelulusan Tebusan Hadiah". Alternatives: (a) the S1/S2 h1 ("Admin — Kedai Hadiah Digital") — rejected: longer than the header allows at 375 and differs from the M04 admin pattern; (b) new titles — rejected (new copy). | Approved (D9) |
| DV-M15-13 | D-M15-13 | Unreadable text (< 12px) | Measured: S1 status pill "Off" 10px; S2 status pill "❌ Dibatalkan" 10px; S3/S4 hint "100 syiling = 1 token = RM1" (text replaced by DV-M15-14) 10px; S6 ribbons "rare / epic / legendary" 10.4px (discovery §8.1). | Raised to 12px (the S6 ribbon band widens to fit; rotation, colours and position kept); icons and emoji keep their size (M03 DV-06b / M05 DV-11 / M08 DV-18 / M10 DV-28 / M11 DV-23 precedent). The PROPOSED pills (FN-2.3.3, FN-4.1.6) use the same 12px. Alternatives: replicate — rejected: NFR-02 names text below 12px as unreadable. | Approved (D9) |
| DV-M15-14 | — (cross-module; M14 discovery S12 / S9; M14 SRS §6.13 XR-M15-05; audit AUD-M15-01) | Wrong label | S3/S4 hint "100 syiling = 1 token = RM1" (10px). No live rule uses 100: the convert page applies tier rates 50 / 40 / 30 / 20 syiling per token ("Kadar: 50 syiling = 1 token (Gangsa)"; `const rate = 50`), and the cash rate is 10 syiling = 8 sen, so 100 syiling = RM0.80, not RM1. The convert page says tokens are for "tebus hadiah", so the hint and the student-facing rate describe the same exchange. M14, the owner of the rate, calls the hint a wrong label under D9 (XR-M15-05). | The hint reads **"1 token = RM1"** (PROPOSED COPY: only "100 syiling = " is removed), 12px (DV-M15-13), same place on S3 and S4. "1 token = RM1" holds on all 59 live rewards (`tokenCost` = `denominationRm`) and contradicts nothing visible; M14 precedent DV-M14-05 fixed the same kind of example label. Alternatives: (a) "50 syiling = 1 token = RM1" — rejected: the rate is tier-dependent and it would still contradict the cash rate; (b) remove the hint — rejected: removes correct guidance; (c) replicate — rejected: a wrong label the owner has confirmed (v1.0 "Rejected — pending M14", reversed in v1.1). | Approved (D9) |
| DV-M15-15 | privacy | Privacy (personal names) | The three cancelled rows name two real students with their e-mails (masked in discovery; tokenised `<student:1>`, `<student:2>` in the snapshot). | **Fictitious students** in the same structure: 3151 "Pelajar Demo Hadiah 1" `hadiah1@demo.test` and 3152 "Pelajar Demo Hadiah 2" `hadiah2@demo.test`, anchors inside the M02 users dataset (XR-M15-09). The real names and e-mails are never written in the repository, fixtures or screenshots. | Decided (privacy rule, CLAUDE.md §6) |
| DV-M15-16 | L43 (v1.4) | Contradictory rule / wrong label | S10 caption under the syiling value reads "100 syiling = 1 token". On the same admin account (256 syiling, tier Gangsa) the M14 pages state "50 syiling = 1 token" (S11 card, S12 "Kadar: 50 syiling = 1 token (Gangsa)"; `const rate = 50`), and tier rates are 50 / 40 / 30 / 20. No live rule uses 100 (same finding as DV-M15-14). | The caption reads **"{conversionRate} syiling = 1 token"**, the rate of the viewer's M14 tier from the wallet read (admin: "50 syiling = 1 token"); only the number changes, wording and place as live. Alternatives: (a) replicate "100 syiling = 1 token" — rejected: contradicts the convert page for the same account; (b) fixed "50 …" for everyone — rejected: wrong for higher tiers; (c) remove the caption — rejected: removes guidance. Kept by the Delivery Lead (OQ-M15-16 decided; the audit confirmed the contradiction, AUD-L43 judgement); the user may still ask for a reversal (cheap: the live "100" is most likely a hard-coded template value). | Approved (D9); kept; audit confirmed |
| DV-M15-17 | L43 (v1.4) | Wrong title | S10 and S11 show the shell header "Dashboard" / "Selamat datang kembali" (screenshots). | Same rule as DV-M15-12 (shell DV-SH-03): S10 header "Kedai Hadiah Digital", S11 "Tebusan Saya", each with the subtitle "Selamat datang kembali" (page h1 without its leading emoji). Alternative: new titles — rejected (new copy). | Approved (D9) |
| DV-M15-18 | L43 (v1.4) | Dead link (404) | The prototype's student-nav entry "Kedai Hadiah 🎁 DIGITAL" links to `/kedai-hadiah` (`src/shells/nav/user-nav.ts`, inferred when the murid screenshot gave only label and badge). On live `/kedai-hadiah`, `/hadiah` and `/kedai` are all 404; the shop is `/cikgu/hadiah` (reference spec row 73 agrees). | The entry links to `/cikgu/hadiah` (label, badge, group and position unchanged). Applied by the shell owner (XR-M15-13); this document edits no code. Alternatives: (a) keep `/kedai-hadiah` and add an alias route — rejected: invents a route that is 404 on live; (b) link to `/gamification/rewards` — rejected: a different screen with different copy. | Approved (D9) — **Applied** (Delivery Lead changed `user-nav.ts:455` to `/cikgu/hadiah`, XR-M15-13) |
| DV-M15-19 | L43 (v1.4) | Unreadable text (< 12px) | **Measured 2026-10-02 (audit AUD-L43-01, `getComputedStyle`, identical at 375/768/1280):** the S10 caption "100 syiling = 1 token" is **9px**; the labels "Token Anda" and "Syiling" (rendered upper case by CSS) are **10px**. Chips are 12px, subtitle 14px, button 14px. | The caption and both labels are raised to 12px (DV-M15-13 precedent); icons keep their size. The balance card (369px natural width at 768/1280, 324px at 375) must still fit with no horizontal scroll. | Approved (D9); measured |
| DV-M15-20 | G4 review (v1.6) | Unreadable text (contrast) | The disabled S6 box button "🔒 Token Tidak Cukup" shows white text on `#d1d5db` (≈1.5:1). | Text colour `#4b5563` (≈4.9:1) on the unchanged `#d1d5db` background; label, lock emoji, size, `not-allowed` cursor and the disabled state as live. Decided by the Delivery Lead (D9). Alternatives: (a) keep white — rejected: unreadable; (b) darken the background — rejected: a larger visual change to the disabled state; chosen: text colour only. | Approved (D9) |
| DV-M15-21 | - | Language (BM copy) | Rewards shop: digital shop chips and mystery box: Category chips "E-Wallet", "Telco", "Gaming", "Streaming", "Shopping", "E-Commerce"; mystery box ribbon "rare" / "epic" / "legendary" | "Dompet Digital", "Telekomunikasi", "Permainan", "Penstriman", "Beli-belah", "E-Dagang"; ribbon "Jarang" / "Epik" / "Legenda". | Approved: user decision 2026-10-24 (system audit FB-025) |

**Working-but-odd behaviour that stays as live (not deviations):** the S2 status pills are English ("❌ Cancelled") while the row badge is BM ("❌ Dibatalkan"); every live reward has token cost = RM value but the two fields are independent; the four S1 cards ignore the category filter; select-all works per page; the pager drops `cat`; "Batal" on S3/S4 discards without a confirm; "Batal" in the toolbar only clears ticks; the bulk "Had/Bulan" accepts 0 while the form's minimum is 1; the S5 h1 is 14px at 375; the mystery box shows only ranges, never odds; the mobile user menu lacks "Kelulusan Hadiah" and "Admin Tebusan" (shell DV-SH-04 owner); the S3/S4 native validation bubbles are the browser's (English in Chrome). **L43 (v1.4):** the S10 chips read "Makan & Minum" and "Shopping" where S1 reads "F&B" and "E-Commerce" (each screen consistent with itself, DV-M15-02 logic); the admin's own sidebar has no entry to S10; S5 and S10 are two different empty shops; "Tebusan Saya" is empty for every account even where the M15 redemption store holds rows for that user (OQ-M15-15).

---

## 8. Out of scope

| Item | Owner / reason |
|---|---|
| Wallet (syiling, tokens, XP, level, tier), the ledger, `/gamification/convert` and the header chips | M14 (M15 reads and asks M14 to debit/credit, XR-M15-01/02) |
| `/admin/reward-control` (cabutan admin, draw creation, winner selection, reward budget settings, the 11-item legacy reward-cost table) | M14 S10 (XR-M15-03, 04, 06) |
| Teacher reward shop and queue (`/guru/gamifikasi/kedai`, `/admin/gamifikasi/guru/tebusan`) | M14 (separate flow) |
| Parent↔child links and their administration | M02 (read through its contract, XR-M15-10) |
| Populated student shop, claim button, shop messages | not built — user decision on OQ-M15-01 (follow live) |
| (v1.4, L43) Populated S10 (reward cards, prices, stock, "Tebus" button, confirm and refusal copy, item detail), populated S11 (redemption list, status chips, delivered codes) | NOT OBSERVED on live (catalogue empty); not built — precedent OQ-M15-01, applied (OQ-M15-13 decided) |
| (v1.4, L43) Any POST of the L43 screens (the reference rebuild's `POST /gamification/rewards/{gift}/tebus` was never verified on live) | not built; no M15 shop endpoint beyond the empty reads of SRS §7 #19, #20 |
| (v1.4, L43) The student-nav entry itself (label, badge, placement in the sidebar) | shell owner / M23 (XR-M15-13); M15 specifies only its target |
| Where a student reads a delivered code (history page, notification, e-mail) | not observable (Q-M15-1, OQ-M15-03); no surface is invented; notifications are M22 |
| Mystery-box configuration UI, odds editor, daily limits | no live UI exists (`/admin/mystery-box` is 404); not built |
| Closed draws, results and winner announcements on S7 | no live surface; M14 owns the draw lifecycle |
| Real reseller purchase, API or instant delivery (`api`, `instant` options) | options are stored and shown only; no record uses them; no external service (D4) |
| Real server-side authorisation, CSRF, rate limits, PDPA processing | backend phase (SRS §11.1) |
| Global shells, tournament banner, chatbot, notification bell | global shell / M23, M16, M22 |

---

## 9. Open questions

1. **OQ-M15-01 Which catalogue does the student shop list? (Q-M15-2, D-M15-3)** **CLOSED — user decision (G1, 2026-09-26): "ikut macam mana ada sekarang" (follow what exists now).** S5 replicates live: it shows the observed empty state for every account; activating a reward on S1 does not populate the student shop in the prototype; no shop catalogue source is modelled and no card or claim UI is built. XR-M15-04 is closed on the same basis. Background (kept for the record): The M15 hadiah catalogue (59 token-priced rewards, all Off) or the M14 legacy catalogue (11 syiling-priced items in M14 S10, whose type names the S5 stylesheet uses)? Also: the card layout, the claim button label, the consent notice, the stock badges and the refusal messages. Until answered, S5 shows the empty state for every account (FN-5.1.5) and redemptions exist only through fixtures and the test hook. Consequence to note at G1: in the prototype, activating a reward on S1 does not make it appear on S5. **Agreed rule (v1.1, audit AUD-M15-05):** S5 renders the observed empty state for every account until this question is answered (FN-5.1.5 unchanged). M14 SRS §6.13 words it as "keeps M15 S5 on the hadiah catalogue (empty, as live)"; the Delivery Lead aligns M14's wording to this rule at XL batch 3. The user decides the source.
2. **OQ-M15-02 Admin fulfilment UI (Q-M15-1).** The live Tindakan controls for `pending_admin` / `pending_parent_consent` / `delivered` rows, their endpoints and validation were never rendered. PROPOSED: code field + "Hantar", "Batalkan" on `pending_admin` only.
3. **OQ-M15-03 Where does the student see a delivered code? (Q-M15-1).** No history page exists. The rebuild stores the code and its expiry and shows it nowhere (FN-4.3.3).
4. **OQ-M15-04 Parent view (Q-M15-3).** Request card, approve/reject controls and endpoints, history format, and which roles see the menu entry (INFERRED: parent and admin).
5. **OQ-M15-05 Mystery box (Q-M15-4).** Odds, the enabled button label, the result modal copy, the history list, any daily limit, and the ledger type of the syiling credit. PROPOSED: "Buka Kotak", the modal and history content of FN-6.2.3/6.2.4, the draw rule of SRS BR-M15-18 (not live odds).
6. **OQ-M15-06 Lucky draw (Q-M15-5).** Draw card, ticket purchase (one per click?), entry list, schedule, winners. PROPOSED: FN-7.1.3/7.1.4. The user owns the live site and could create a test draw for observation.
7. **OQ-M15-07 Flash and validation messages (Q-M15-7).** After create, update, bulk actions, delivery, cancel, approve and reject: none is shown in the rebuild (none observed).
8. **OQ-M15-08 Refund and cancellation (Q-M15-8).** INFERRED: a cancelled redemption (admin or parent) refunds its token cost and restores its stock; the student cannot cancel. The live refund ledger type exists in M14 ("↩️ Refund", 0 rows) but concerns syiling.
9. **OQ-M15-09 Live run with test accounts (blocking G5 for the provisional parts).** A student with tokens, a parent with a linked child and an active reward would let discovery observe the shop, the claim, the queue actions, S8 and the mystery box. Until then every AC marked (provisional) stays provisional.
10. **OQ-M15-10 PROPOSED items to report at G1 (complete list; = SRS §8.2):** the hint "1 token = RM1" (DV-M15-14); the "On" pill (label, `#10b981`); "Tiada hadiah di halaman ini." (DV-M15-07); the header titles (DV-M15-12); the S2 row pills for the three unobserved statuses and their colours; S2 page size 50; the code field "Kod voucher" with `maxlength` 100 and the code rule 1–100 characters (trimmed); "Hantar", "Batalkan"; "Batalkan", "✅ Lulus" and "❌ Tolak" without a confirm dialog; "Buka Kotak"; the result modal ("+{coins} 🪙 · +{xp} XP", "Tutup"), full-screen below `md` and 400px centred from `md`; "Sejarah Kotak Misteri" and its rows, capped at 10 rows; the mystery-box draw mechanism (seeded uniform integers inside the ranges — not the live odds, SRS BR-M15-18); the draw card ("Harga tiket:", "Tiket anda:", "Tutup:", "{label} × {qty}", "🎟️ Beli Tiket"), ordered by close date then id; one ticket per purchase; the S7 date format "dd/mm/yyyy" and the S8 row format "dd/mm HH:MM"; the S8 card ("{token} token", "✅ Lulus", "❌ Tolak") and history rows; the Pelaras Token rounding and the server parse of the raw text (FN-2.6.5); the runtime ids (new reward = highest id + 1; redemptions and openings from 9,000,001); the fictitious students 3151/3152 (DV-M15-15).
11. **OQ-M15-11 Cross-module requests (SRS §6.10; statuses from M14 SRS v1.0 §6.13):** M14 — XR-01 wallet read, XR-02 write contract, XR-03 draw and ticket store, XR-08 test hooks: **accepted**; XR-04 legacy catalogue ownership **decided** (M14 DATA-M14-17), shop source **open** for the user (OQ-M15-01 = M14 OQ-M14-05); XR-05 **decided** (DV-M15-14 approved); XR-06 **no** budget for hadiah; XR-07 **no** dependency (M14 BR-M14-31 counts its own catalogue); new XR-12 (openings count for the M14 achievement "Ahli Kotak Misteri"). M02 — anchors 3151/3152 (XR-09, queued for XL batch 3) and the parent-link read (XR-10). Global shell / M23 — the M15 menu entries with their icon and badge classes, DV-M15-04, the header titles and the mobile-menu gaps (XR-11). **v1.4 (L43):** Global shell / M23 — XR-M15-13 student-nav href `/kedai-hadiah` → `/cikgu/hadiah` (DV-M15-18; **Applied** v1.5) and the S10/S11 header titles (DV-M15-17, still for the shell owner); M14 — XR-M15-14 the wallet read must carry the viewer's tier `conversionRate` (already in M14 #2) for the S10 caption.
12. **OQ-M15-12 Reward budget — CLOSED (M14 SRS §6.13, XR-M15-06):** the RM10/sesi and RM3/bulan limits are in "nilai-kos" sen of M14's syiling-priced catalogue and do not apply to hadiah redemptions; M15 applies no budget check (SRS BR-M15-05).
13. **OQ-M15-13 (v1.4, L43; Q-L43-1) Populated S10 and S11 — apply the OQ-M15-01 precedent? CLOSED (v1.5): decided by the Delivery Lead under the user's standing instruction (finish Session 5; follow the OQ-M15-01 user precedent) — S10/S11 show the observed empty state for every account, populated states are not built (Perlu pengesahan with a murid session).** Original text: Card layout, price, stock, redeem flow and the populated "Tebusan Saya" are NOT OBSERVED. **Default applied in this version: empty state only, for every account** (like S5; no proposed populated states). The user confirms or asks for PROPOSED states. **Not blocking the build of the empty state;** blocks only a populated build. Consequence to note at G1: activating a reward on S1 does not make it appear on S10.
14. **OQ-M15-14 (v1.4) Independent audit of the L43 additions — CLOSED (v1.5): audit done, PASS (`docs/qa/audit/L43-audit.md`; AUD-L43-01…05 applied; automated dump produced by the audit; S10/S11 coverage 24/24).** Original text: CLAUDE.md §6 requires an automated element inventory plus an independent audit before a module is called complete. The L43 probe was a small manual GET-only observation (23 elements, 3 screenshots, no JSON inventory, no S11 screenshot). An audit agent must check §3 EP-M15-10, the S10/S11 coverage lists and the DV-M15-16…19 evidence against live (lane 2 or 3). The audit may also record S11 pixel layouts and the measured sizes needed by DV-M15-19.
15. **OQ-M15-15 (v1.4) Consistency of S11 with S2.** S11 shows "Belum ada tebusan." for every account while S2 (admin) lists the 3 seeded cancelled redemptions of fictitious students 3151/3152 and the `queue` fixture rows. If someone logs in as 3151, 3152, 2 or 4 the two screens disagree. Default: accepted as a consequence of the precedent (no login exists for 3151/3152 in the demo). Not blocking; accepted risk (OQ-M15-13 decided: the precedent stands).
16. **OQ-M15-16 (v1.4; Q-L43-2, Q-L43-3, Q-L43-4) Murid view and matrix row. CLOSED (v1.5) by the Delivery Lead (same standing instruction): (a) the murid view stays Perlu pengesahan (no murid session); (b) DV-M15-16 kept; (c) "Tebusan Saya" (S11) is part of row L43.** Original text: (a) Whether a murid sees the same layout, a different wallet pair and different empty copy is Perlu pengesahan (needs a murid-session probe; would also confirm the student-nav class, the active state and whether the caption shows the tier rate for that student). (b) DV-M15-16 replaces "100" with the viewer's tier rate by rule D9; the user may reverse it. (c) "Tebusan Saya" is treated as part of row L43 (the button sits on the shop page), not a separate matrix row — confirm. None of these blocks the build.